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
  const request = ++loadRequest, startedAt = revision;
  try {
    const r = await fetch("/api/card-groups", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const groups = (await r.json()).groups || [];
    // 較晚開始的讀取，或已完成的增刪，才代表目前的群組。
    if (request === loadRequest && startedAt === revision) {
      cache = groups;
      notify();
    }
  } catch (err) {
    if (strict) throw err;
  }
  return cache;
}

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
  if (!r.ok || !j.ok) throw new Error(j.error || `伺服器回 ${r.status}`);
  revision++;
  cache = j.groups || cache;
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
 */
export function resolveGroupPools(settings, groups, seed, keep = null) {
  const byId = new Map((groups || []).map((g) => [g.id, g]));
  const groupPools = {};
  const groupNames = {};
  const groupIds = {};
  for (const section of GROUP_SECTIONS) {
    const { ids, mode } = pickOf(settings, section);
    const chosen = ids.map((id) => byId.get(id)).filter((g) => g && g.section === section && g.tags?.length);
    if (!chosen.length) continue;
    let use = chosen;
    const kept = keep?.[section] ? chosen.filter((g) => keep[section].includes(g.id)) : [];
    if (kept.length) use = kept;
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
export function withGroupPools(settings, groups, seed, keep = null) {
  if (!settings?.groups) return settings;
  const { groupPools, groupNames, groupIds } = resolveGroupPools(settings, groups, seed, keep);
  if (!Object.keys(groupPools).length) return settings;
  return { ...settings, groupPools, groupNames, groupIds };
}
