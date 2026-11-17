/**
 * 卡片群組：長相、服裝、姿勢、場景各自可以有好幾組牌（A、B、C），抽牌時選每一段要從哪幾組抽。
 * 存在伺服器（/api/card-groups，card_groups.py），手機、電腦共用一份。
 *
 * 跟牌組不一樣：牌組是「這幾張全部帶上」，群組是「這一段從這裡面挑」。群組只管它有放牌的小類，
 * 沒放的照常從整個詞庫補（設計：docs/superpowers/specs/2026-11-16-card-groups-design.md）。
 *
 * 這一支只有資料和抽牌前的解析，不碰畫面（node 測試直接 import）。
 *   settings.groups = { feature: { ids: [...], mode: "whole" | "mix" }, ... }   哪一段勾了哪幾組（墨池的設定）
 *   withGroupPools(settings, groups, seed) → 多了 groupPools／groupNames 的 settings（引擎只認這兩個）
 */

export const GROUP_SECTIONS = ["feature", "clothing", "pose", "env"];
export const GROUP_MODES = ["whole", "mix"];

let cache = null;
let revision = 0;
let loadRequest = 0;
let loading = null;
let loadedAt = 0;
let writeQueue = Promise.resolve();
const listeners = new Set();

const notify = () => {
  for (const fn of listeners) {
    try {
      fn(cache);
    } catch (err) {
      console.error(err);
    }
  }
};

/** 群組清單變了（讀到新的、存了、刪了）就叫 fn(groups)；回傳取消訂閱。 */
export function onGroupsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadGroups({ strict = false } = {}) {
  if (!loading) loading = readGroups().finally(() => { loading = null; });
  try { return await loading; }
  catch (err) { if (strict) throw err; return cache; }
}

async function readGroups() {
  const request = ++loadRequest, startedAt = revision;
  const r = await fetch("/api/card-groups", { cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  const groups = (await r.json()).groups || [];
  // 較晚開始的讀取，或已完成的增刪，才代表目前的群組。
  if (request === loadRequest && startedAt === revision) {
    cache = groups;
    loadedAt = Date.now();
    notify();
  }
  return cache;
}

export async function freshGroups(maxAgeMs) {
  if (cache !== null && Date.now() - loadedAt <= maxAgeMs) return cache;
  return loadGroups();
}

const refresh = () => { if (cache !== null) void loadGroups(); };
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  document.addEventListener("prerenderingchange", refresh);
}
if (typeof addEventListener === "function") addEventListener("pageshow", e => { if (e.persisted) refresh(); });

/** 上一次讀到的群組（還沒讀過是 null）。 */
export const cachedGroups = () => cache;

function call(url, method, body) {
  // 伺服器每次回完整清單。增刪（含復原）依序送出，回應跟實際寫入的順序才一致。
  const pending = writeQueue.then(() => requestWrite(url, method, body));
  writeQueue = pending.catch(() => {});
  return pending;
}

async function requestWrite(url, method, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) {
    const err = Object.assign(new Error(j.error || `伺服器回 ${r.status}`), { bad: j.bad || [], code: j.code, status: r.status });
    if (r.status === 404 || r.status === 409) await loadGroups();
    throw err;
  }
  revision++;
  cache = j.groups || cache;
  loadedAt = Date.now();
  notify();
  return j.group;
}

export const saveGroup = (group) => call("/api/card-groups", "POST", group);
export const deleteGroup = (id) => call(`/api/card-groups/${encodeURIComponent(id)}`, "DELETE");

/** 設定裡一段的勾選，整理成 { ids, mode }（壞的、重複的拿掉）。 */
export function pickOf(settings, section) {
  const raw = settings?.groups?.[section];
  const ids = Array.isArray(raw?.ids) ? [...new Set(raw.ids.filter((x) => typeof x === "string" && x))] : [];
  return { ids, mode: GROUP_MODES.includes(raw?.mode) ? raw.mode : "whole" };
}

// 跟引擎同一個 mulberry32；挑「整組一起」用哪一組用種子派生的獨立亂數，主亂數一次都不多吃。
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SECTION_SALT = { feature: 0x0c4a7d11, clothing: 0x1b93e5a7, pose: 0x2f6c0b39, env: 0x3d18f4c5 };

/**
 * 這一張要用的群組牌：{ groupPools: { section: [tags] }, groupNames: { section: [名字] }, groupIds: { section: [id] } }。
 * 勾了但已經刪掉、或是空的群組略過；一段整個沒有東西就不放那一段（引擎照舊抽）。
 * 整組一起：每一段各自用 (seed ^ 段落的鹽) 挑一組，同一顆種子永遠挑同一組。
 * keep（{ section: [id] }）：這幾段直接用這幾組，不再挑 —— 「同一個人」第 2 張起沿用第 1 張挑中的長相群組。
 * options.only：只用該張圖原本的群組，忽略目前勾選；沒列的段落不使用群組。
 * options.usable：整組一起先排除沒有任何可用牌的群組；舊的第四參數仍可直接傳 keep。
 */
export function resolveGroupPools(settings, groups, seed, options = null) {
  const { keep, only, usable } = options && ["keep", "only", "usable"].some(k => k in options) ? options : { keep: options };
  const byId = new Map((groups || []).map((g) => [g.id, g]));
  const groupPools = {};
  const groupNames = {};
  const groupIds = {};
  for (const section of GROUP_SECTIONS) {
    const pick = pickOf(settings, section);
    const ids = only != null ? only[section] || [] : pick.ids;
    const mode = pick.mode;
    let chosen = ids.map((id) => byId.get(id)).filter((g) => g && g.section === section && g.tags?.length);
    if (mode === "whole" && usable) chosen = chosen.filter(g => g.tags.some(usable));
    if (!chosen.length) continue;
    let use = chosen;
    const kept = keep?.[section] ? chosen.filter((g) => keep[section].includes(g.id)) : [];
    if (only != null) use = chosen;
    else if (kept.length) use = kept;
    else if (mode === "whole" && chosen.length > 1) {
      const rand = mulberry32((((Number(seed) >>> 0) ^ SECTION_SALT[section]) >>> 0));
      use = [chosen[Math.floor(rand() * chosen.length)]];
    }
    groupPools[section] = [...new Set(use.flatMap((g) => g.tags))];
    groupNames[section] = use.map((g) => g.name);
    groupIds[section] = use.map((g) => g.id);
  }
  return { groupPools, groupNames, groupIds };
}

/** 給引擎的 settings：多了這一張的 groupPools／groupNames／groupIds。沒勾群組就原封不動回傳同一個物件。 */
export function withGroupPools(settings, groups, seed, options = null) {
  if (!settings?.groups && options?.only == null) return settings;
  const { groupPools, groupNames, groupIds } = resolveGroupPools(settings, groups, seed, options);
  if (!Object.keys(groupPools).length && options?.only == null) return settings;
  return { ...settings, groupPools, groupNames, groupIds };
}
