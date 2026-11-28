/**
 * 卡片詳情的「相關的牌」：Danbooru 上常一起出現的 tag。
 * 字盒（app.js 的 showCard）和卡冊（book.js 的 openCard）共用。疊印台的放大卡不加。
 *
 * 伺服器 /api/related 已經擋過一輪。這裡再擋：禁用角色、HARD_BANNED、guard、
 * 分級擋掉的、廢字簍、自製牌、詞庫裡沒有的。沒有檔、連不上：這一區不出現，不跳錯。
 *
 * 同一個回應也帶這張牌的 Danbooru wiki 說明（web/tag_wiki.json），畫在「相關的牌」上面。
 * 未成年的字資料照存，只靠 hardban（HARD_BANNED、禁用角色）擋：伺服器擋一次，這裡再擋一次。
 */
import { cardNode, setCardFlag } from "./cards.js";
import { el, resizeSheet } from "./ui.js";
import { enter, dropAnimated, reducedMotion } from "./motion.js";
import { t, english } from "./i18n.js";

const LIMIT = 8;
const DOTS = ["", "相關度：一格", "相關度：兩格", "相關度：三格"];

/** 底線當空白、空白收成一格、小寫。 */
export function normTag(raw) {
  return String(raw ?? "").replaceAll("_", " ").replace(/\s+/g, " ").trim().toLowerCase();
}

/** 相關度三格。不寫小數。已經過 0.05 的才會出現，所以最少一格。 */
export function relatedDots(milli) {
  const n = Number(milli);
  if (!Number.isFinite(n) || n < 200) return 1;
  if (n < 500) return 2;
  return 3;
}

export function relatedDotLabel(milli) {
  return DOTS[relatedDots(milli)];
}

/** 滑鼠放在點上看的數字：0～1，兩位小數（Danbooru 上一起出現的程度，cosine）。 */
export function relatedValue(milli) {
  const n = Number(milli);
  return Number.isFinite(n) ? (Math.max(0, Math.min(1000, n)) / 1000).toFixed(2) : "";
}

function nameSet(value) {
  if (typeof value === "function" && value.length === 0) return nameSet(value());
  if (typeof value === "function") return value;
  const set = new Set();
  const list = value instanceof Set ? value : Array.isArray(value) ? value : [];
  for (const item of list) {
    const name = normTag(item);
    if (name) set.add(name);
  }
  return set;
}

function named(bucket, tag) {
  const key = normTag(tag);
  if (!key || !bucket) return false;
  if (typeof bucket === "function") return !!bucket(tag) || !!bucket(key);
  return bucket.has(key);
}

/**
 * 依出現順序留下可以顯示的牌，最多 limit 張（預設 8）。
 * ctx.card(名字) 回詞庫那張；沒有的丟掉。
 * hardBanned／characterBan／guard／trash：Set、陣列，或零引數函式（現在的廢字簍）。
 * ratingBlocked(card)、custom(card)：回 true 就丟掉。
 */
export function filterRelated(pairs, ctx = {}) {
  const limit = Number.isFinite(ctx.limit) ? ctx.limit : LIMIT;
  if (limit <= 0) return [];
  const self = normTag(ctx.self);
  const hard = nameSet(ctx.hardBanned);
  const chars = nameSet(ctx.characterBan);
  const guard = nameSet(ctx.guard);
  const trash = nameSet(ctx.trash);
  const seen = new Set();
  const out = [];
  for (const pair of Array.isArray(pairs) ? pairs : []) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const raw = pair[0];
    const milli = Number(pair[1]);
    if (typeof raw !== "string" || !Number.isFinite(milli)) continue;
    const key = normTag(raw);
    if (!key || key === self || seen.has(key)) continue;
    const card = typeof ctx.card === "function" ? ctx.card(raw) || ctx.card(key) : null;
    if (!card || typeof card.tag !== "string") continue;
    const canon = normTag(card.tag);
    if (!canon || canon === self || seen.has(canon)) continue;
    if (card.banned || card.custom || card.suit === "custom") continue;
    if (typeof ctx.custom === "function" && ctx.custom(card)) continue;
    if (typeof ctx.ratingBlocked === "function" && ctx.ratingBlocked(card)) continue;
    if (named(hard, canon) || named(chars, canon) || named(guard, canon) || named(trash, canon)) continue;
    seen.add(key);
    seen.add(canon);
    out.push({ tag: card.tag, milli, card });
    if (out.length >= limit) break;
  }
  return out;
}

const cache = new Map();
const inflight = new Map();
let era = 0;

export function clearRelatedCache() {
  era += 1;
  cache.clear();
  inflight.clear();
}

function pairsOf(items, key) {
  if (!items || typeof items !== "object") return [];
  if (Array.isArray(items[key])) return items[key];
  for (const [name, value] of Object.entries(items)) {
    if (normTag(name) === key && Array.isArray(value)) return value;
  }
  return [];
}

function wikiOf(wiki, key) {
  if (!wiki || typeof wiki !== "object") return "";
  for (const [name, value] of Object.entries(wiki)) {
    if (normTag(name) === key && typeof value === "string") return value.trim();
  }
  return "";
}

/** 這張牌自己能不能顯示說明：只看 hardban（HARD_BANNED、禁用角色）。 */
export function wikiAllowed(tag, ctx = {}) {
  const key = normTag(tag);
  if (!key) return false;
  return !named(nameSet(ctx.hardBanned), key) && !named(nameSet(ctx.characterBan), key);
}

/**
 * 說明：中文介面有翻好的中文就顯示中文（滑鼠移上去看英文原文）；沒翻的、英文介面顯示 Danbooru 的英文原文。
 * 兩種都標 lang 和 data-no-i18n：介面翻譯（i18n.js）不碰、讀屏照語言念。
 */
function wikiSectionOf(en, zh) {
  const useZh = !english && !!zh;
  return el(
    "section",
    { class: "tag-wiki" },
    el("h3", {}, "Danbooru 說明"),
    el(
      "p",
      { class: "tag-wiki-text", lang: useZh ? "zh-Hant" : "en", translate: "no", dataset: { noI18n: "" }, title: useZh ? en : undefined },
      useZh ? zh : en
    )
  );
}

/** 同一張牌這頁只問一次。連不上、回應不對：不記快取，下次開詳情再試。 */
export function loadRelated(tag, fetchImpl = globalThis.fetch) {
  const key = normTag(tag);
  if (!key) return Promise.resolve({ items: [], wiki: "", guard: new Set() });
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const started = era;
  const job = (async () => {
    try {
      const res = await fetchImpl(`/api/related?${new URLSearchParams({ tag: key })}`, { cache: "no-store" });
      if (started !== era) return null;
      if (!res?.ok) return null;
      const data = await res.json();
      if (started !== era) return null;
      if (!data || data.ok === false) return null;
      const guard = new Set((Array.isArray(data.guard) ? data.guard : []).map(normTag).filter(Boolean));
      const packed = { items: pairsOf(data.items, key), wiki: wikiOf(data.wiki, key), wikiZh: wikiOf(data.wikiZh, key), guard };
      if (started === era) cache.set(key, packed);
      return packed;
    } catch {
      return null;
    } finally {
      if (inflight.get(key) === job) inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

function dotsOf(milli) {
  const n = relatedDots(milli);
  // 相關值（0.61 這種）：滑鼠移到這一格（整張小牌，不用瞄準 7px 的點）就在點旁邊淡入；手機一直顯示（styles.css）。
  // 以前只掛在點的 title 上，要停在小點上一秒多才看得到（2026-11-28 專案主：滑鼠放上牌看不到相關值）。
  const label = `${relatedDotLabel(milli)}（${relatedValue(milli)}）`;
  return el(
    "span",
    { class: "related-dots", role: "img", "aria-label": label, title: label },
    [1, 2, 3].map((i) => el("i", { class: i <= n ? "is-on" : "", "aria-hidden": "true" })),
    el("b", { class: "related-val", "aria-hidden": "true" }, relatedValue(milli))
  );
}

function paintSlot(slot, card, opts) {
  const node = slot.querySelector(".card");
  if (!node) return;
  const flag = opts.flag?.(card) || null;
  if (flag?.kind === "pool") node.dataset.state = "pinned";
  else if (flag?.kind === "ban") node.dataset.state = "banned";
  else node.dataset.state = "";
  setCardFlag(node, flag);
  const add = slot.querySelector(".related-add");
  if (!add) return;
  const pressed = !!opts.pressed?.(card);
  add.setAttribute("aria-pressed", pressed ? "true" : "false");
  const label = opts.addLabel?.(card);
  if (!label) return;
  const text = t(label);
  add.setAttribute("aria-label", text);
  add.title = text;
}

function slotOf(item, opts) {
  const flag = opts.flag?.(item.card) || null;
  const node = cardNode(item.card, opts.assets, { flag });
  if (flag?.kind === "pool") node.dataset.state = "pinned";
  else if (flag?.kind === "ban") node.dataset.state = "banned";
  node.addEventListener("click", () => opts.onOpen?.(item.card, node));
  const label = opts.addLabel?.(item.card) || "放進合成池";
  const add = el("button", {
    class: "related-add",
    type: "button",
    title: label,
    "aria-label": label,
    "aria-pressed": opts.pressed?.(item.card) ? "true" : "false",
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onAdd?.(item.card, node);
    },
  });
  const face = el("div", { class: "related-face" }, node, add);
  return el("div", { class: "related-slot", dataset: { tag: item.card.tag }, title: `${item.card.zh || item.card.tag}・${relatedDotLabel(item.milli)}（${relatedValue(item.milli)}）` }, face, dotsOf(item.milli));
}

function sectionOf(items, opts, pack) {
  const row = el("div", { class: "related-row" });
  for (const item of items) row.append(slotOf(item, opts));
  const section = el(
    "section",
    { class: "related-cards" },
    el("h3", {}, "相關的牌"),
    el("p", { class: "related-sub" }, "Danbooru 上常一起出現"),
    row
  );
  section._related = { opts, pack };
  return section;
}

const mounted = new Set();

/** 詳情視窗長高、變矮（說明和相關的牌晚到、拿掉一張）：整個視窗一起平順地過去（ui.js 的 resizeSheet）。 */
function growOf(node) {
  return resizeSheet(node?.closest?.(".sheet"));
}

/**
 * 預先抓：滑鼠停在牌上一下（0.12 秒）、或手指按下去（長按要半秒才開詳情）就先問。
 * 右鍵、長按打開詳情時資料多半已經在快取裡，跟著視窗一起進場，不用再長高。
 * 只裝一次；沒有 document（node 測試）什麼都不做。
 */
let prefetchInstalled = false;
export function installRelatedPrefetch(root = globalThis.document) {
  if (prefetchInstalled || !root?.addEventListener) return;
  prefetchInstalled = true;
  let timer = 0;
  let pending = "";
  const tagOf = (e) => e.target?.closest?.(".card[data-tag]")?.dataset?.tag || "";
  root.addEventListener(
    "pointerover",
    (e) => {
      const tag = tagOf(e);
      if (tag === pending) return;
      clearTimeout(timer);
      pending = tag;
      if (!tag) return;
      timer = setTimeout(() => loadRelated(tag).catch(() => {}), e.pointerType === "mouse" ? 120 : 0);
    },
    { passive: true }
  );
  root.addEventListener(
    "pointerdown",
    (e) => {
      const tag = tagOf(e);
      if (tag) loadRelated(tag).catch(() => {});
    },
    { passive: true }
  );
}

/** 「← 上一張」：關掉最上面這張詳情，底下原本那張還在。（舊的疊視窗做法；現在用 relatedTrail。） */
export function relatedBack(close) {
  return el("button", { class: "related-back", type: "button", onclick: () => close?.() }, "← 上一張");
}

/** 幾個點以上（1～3）→ 相關值（×1000）至少多少。跟 relatedDots 的分界一樣：兩格是 0.2 起、三格是 0.5 起。 */
export const DOT_MIN = Object.freeze({ 1: 0, 2: 200, 3: 500 });

/**
 * 從幾張牌的相關牌裡挑（補相關牌：更多規則從合成池的牌、合成池牌的右鍵小面板從那一張）：
 *   - 相關度至少 dots 個點；同一張被好幾張牌推薦，取最高的那個值；
 *   - 照相關度由高到低（一樣高照名字），起點那幾張、exclude 裡的不算；
 *   - 顯示的那套過濾照用（ctx：禁用角色、HARD_BANNED、分級、廢字簍、自製牌、詞庫裡沒有的）。
 * 回傳 [{ tag, milli, card }]，最多 limit 張。讀不到關聯：空的。
 */
export async function pickRelated(seeds, { dots = 2, limit = 64, ctx = {}, exclude = [], fetchImpl } = {}) {
  const list = [...new Set([...(seeds || [])].map(String).filter(Boolean))];
  if (!list.length) return [];
  const floor = DOT_MIN[dots] ?? DOT_MIN[2];
  const skip = new Set([...list, ...(exclude || [])].map(normTag));
  const packs = await Promise.all(list.map((t) => loadRelated(t, fetchImpl).catch(() => null)));
  const best = new Map();
  for (const pack of packs) {
    if (!pack) continue;
    for (const item of filterRelated(pack.items, { ...ctx, limit: 9999, guard: pack.guard })) {
      if (item.milli < floor) continue;
      const key = normTag(item.tag);
      if (skip.has(key)) continue;
      const had = best.get(key);
      if (!had || had.milli < item.milli) best.set(key, item);
    }
  }
  return [...best.values()]
    .sort((x, y) => y.milli - x.milli || (x.tag < y.tag ? -1 : x.tag > y.tag ? 1 : 0))
    .slice(0, Math.max(0, limit));
}

/** 同一個視窗裡最多記幾張看過的牌（更早的丟掉）。 */
export const TRAIL_MAX = 12;

/**
 * 要去 next 時的麵包屑：next 已經在路上（制服 → 水手服 → 又點回制服）就退回那一步，不繞圈；
 * 不然接在後面，只留最後 TRAIL_MAX 張。
 */
export function trailTo(next, trail) {
  const list = Array.isArray(trail) ? trail : [];
  const key = normTag(next);
  const at = list.findIndex((t) => normTag(t) === key);
  return (at >= 0 ? list.slice(0, at) : list).slice(-TRAIL_MAX);
}

/**
 * 在同一個視窗裡從相關的牌一路點下去：最上面一排「← 制服 › 水手服 › 現在這張」。
 * trail＝之前看過的牌（舊→新，不含現在這張）；go(i) 回到 trail[i]。← 回上一張。
 * 太長只顯示最後三張，前面收成「…」（點了回到第一張）。名字照呼叫端（英文版給 tag）。
 */
export function relatedTrail(trail, current, { nameOf = (x) => x, go } = {}) {
  if (!Array.isArray(trail) || !trail.length) return null;
  const crumb = (i) =>
    el("button", { class: "detail-trail-step", type: "button", dataset: { noI18n: "" }, onclick: () => go?.(i) }, nameOf(trail[i]));
  const parts = [];
  const from = trail.length > 3 ? trail.length - 3 : 0;
  if (from > 0) {
    parts.push(el("button", { class: "detail-trail-step", type: "button", title: nameOf(trail[0]), "aria-label": nameOf(trail[0]), dataset: { noI18n: "" }, onclick: () => go?.(0) }, "…"));
    parts.push(el("span", { class: "detail-trail-sep", "aria-hidden": "true" }, "›"));
  }
  for (let i = from; i < trail.length; i++) {
    parts.push(crumb(i));
    parts.push(el("span", { class: "detail-trail-sep", "aria-hidden": "true" }, "›"));
  }
  parts.push(el("span", { class: "detail-trail-now", "aria-current": "page", dataset: { noI18n: "" } }, nameOf(current)));
  return el(
    "nav",
    { class: "detail-trail", "aria-label": "看過的牌" },
    el("button", { class: "related-back", type: "button", title: "上一張", "aria-label": "上一張", onclick: () => go?.(trail.length - 1) }, "←"),
    el("div", { class: "detail-trail-path" }, parts)
  );
}

/**
 * 清單回來才把這一區放進 parent（放在 opts.before 前面，沒有就接在最後）。
 * 空的、資料不在、這時詳情已經關了：什麼都不留。
 * 長出來用 heightChange，小牌照順序淡入；減少動態直接出現。
 */
export function mountRelated(parent, opts = {}) {
  if (!parent || !opts.tag || !opts.assets) return;
  // 已經抓過（預先抓、或這頁開過）：馬上放進去，跟著視窗一起進場，不用再長高、不會跳。
  const ready = cache.get(normTag(opts.tag));
  if (ready) {
    placeRelated(parent, opts, ready, false);
    return;
  }
  loadRelated(opts.tag, opts.fetchImpl).then((pack) => {
    if (pack && parent.isConnected) placeRelated(parent, opts, pack, true);
  }).catch(() => {});
}

function placeRelated(parent, opts, pack, late) {
  let items = [];
  let wiki = "";
  try {
    const ctx = typeof opts.context === "function" ? opts.context() : opts.context || {};
    items = filterRelated(pack.items, { ...ctx, self: opts.tag, guard: pack.guard });
    if (pack.wiki && wikiAllowed(opts.tag, ctx)) wiki = pack.wiki;
  } catch {
    return;
  }
  if ((!items.length && !wiki) || !parent.isConnected) return;
  // 晚到的才要過渡；當下就放的是進場的一部分。但視窗正在變高度（同一個視窗換牌、回上一張）時，
  // 當下放的也要接進那段動畫：不然動畫的終點沒算到這一區，播完一格跳到全高（實測回上一張跳 253px）。
  const resizing = parent.closest?.(".sheet")?._grow?.playState === "running";
  const finish = late || resizing ? growOf(parent) : () => {};
  const motion = late && !reducedMotion();
  const before = opts.before;
  const place = (node) => {
    if (before && before.parentNode === parent) parent.insertBefore(node, before);
    else parent.append(node);
  };
  if (wiki) {
    const box = wikiSectionOf(wiki, pack.wikiZh);
    place(box);
    if (motion) enter(box);
  }
  if (items.length) {
    const section = sectionOf(items, opts, pack);
    place(section);
    mounted.add(section);
    if (motion) {
      const slots = section.querySelectorAll(".related-slot");
      slots.forEach((slot, i) => enter(slot, { delay: i * 42 }));
    }
  }
  finish();
}

/** 池子、廢字簍、分級、送去墨池變了：章跟著換；不能再顯示的用 dropAnimated 拿掉。 */
export function refreshRelated() {
  for (const section of [...mounted]) {
    if (!section.isConnected) {
      mounted.delete(section);
      continue;
    }
    const { opts, pack } = section._related || {};
    const row = section.querySelector(".related-row");
    if (!opts || !pack || !row) continue;
    let allowed;
    try {
      const ctx = typeof opts.context === "function" ? opts.context() : opts.context || {};
      allowed = new Map(filterRelated(pack.items, { ...ctx, self: opts.tag, guard: pack.guard }).map((item) => [normTag(item.tag), item]));
    } catch {
      continue;
    }
    const doomed = [];
    for (const slot of [...row.children]) {
      const item = allowed.get(normTag(slot.dataset.tag));
      if (!item) doomed.push(slot);
      else paintSlot(slot, item.card, opts);
    }
    if (!doomed.length) continue;
    const finish = growOf(section.parentElement || section);
    for (const slot of doomed) dropAnimated(slot);
    if (!row.children.length) {
      mounted.delete(section);
      dropAnimated(section);
    }
    finish();
  }
}
