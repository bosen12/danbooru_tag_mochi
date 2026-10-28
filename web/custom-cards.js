/**
 * 自製牌（卡冊的「自製」花色）：存讀、變成牌庫裡的牌、拆提示詞、卡面提示詞、分級下限、封鎖、分享碼。
 * 伺服器那頭是 custom_cards.py（/api/custom-cards）；編輯畫面在 custom-editor.js。
 *
 * 引擎眼中自製牌就是好幾張牌：放進合成池時逐張釘上成員（members），詞庫外的字（extra）接在提示詞裡。
 * 牌庫裡它是一張 tag 為 "custom:<id>" 的牌，花色 "custom"；字盒、偏好卡牌、卡冊都把它當一般的牌畫。
 */
import { HARD_BANNED } from "./card-art.js";
import { matchRank, cardMatches, CARD_SUIT_INFO } from "./cards.js";

export const CUSTOM = "custom:";
export const isCustomTag = (t) => typeof t === "string" && t.startsWith(CUSTOM);
export const customTag = (id) => CUSTOM + id;
const RATINGS = ["general", "sensitive", "explicit"];
export const RATING_NAME = { general: "全年齡", sensitive: "敏感", explicit: "色情" };
export const MAX_MEMBERS = 20;
export const MAX_EXTRA = 12;
// 編輯畫面的段落順序（跟字盒的花色一樣）；詞庫外排最後。
export const SUIT_ORDER = ["cast", "chara", "look", "wear", "pose", "scene", "style"];

// 「自製」花色的名字和章（只在 web6 用；共用的 CARD_SUITS 不加，別的版面不受影響）。
CARD_SUIT_INFO.custom ||= { zh: "自製", glyph: "製" };

let cache = null;
let loading = null;
const listeners = new Set();

/** 讀伺服器上的自製牌（同一頁只讀一次；force 再讀）。讀不到回空陣列。 */
export function loadCustom({ force = false } = {}) {
  if (cache && !force) return Promise.resolve(cache);
  if (loading && !force) return loading;
  loading = fetch("/api/custom-cards", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { cards: [] }))
    .then((j) => set(Array.isArray(j.cards) ? j.cards : []))
    .catch(() => cache || set([]))
    .finally(() => (loading = null));
  return loading;
}

export const customList = () => cache || [];
export const customById = (id) => customList().find((c) => c.id === id) || null;
export const customOf = (tag) => (isCustomTag(tag) ? customById(tag.slice(CUSTOM.length)) : null);

/** 自製牌換了（存、刪、別的分頁改的）：重畫用。回傳取消的函式。 */
export function onCustomChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set(list) {
  cache = list;
  for (const fn of listeners) {
    try {
      fn(list);
    } catch (err) {
      console.error(err);
    }
  }
  return list;
}

/** 存了、刪了：叫別的分頁重讀。只有真的改了才叫 —— 讀一次就叫的話，墨池在背景先開好的隔壁房間
 *  一讀就叫回來、互相叫個不停，畫面一直重畫。 */
function tellOtherTabs() {
  try {
    localStorage.setItem("mochi.custom.v1", String(Date.now()));
  } catch {}
}

// 別的分頁存了、刪了：重新讀一次（localStorage 的 storage 事件只在別的分頁觸發）。
addEventListener("storage", (e) => {
  if (e.key === "mochi.custom.v1") loadCustom({ force: true });
});

async function call(url, method, body) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

/** 存一張（新的沒有 id）。draft：預覽卡面的代號，存檔時轉正。回傳存好的那張。 */
export async function saveCustom(card, { draft = "" } = {}) {
  const j = await call("/api/custom-cards", "POST", { ...card, ...(draft ? { draft } : {}) });
  set(j.cards);
  tellOtherTabs();
  return j.card;
}

/** 刪一張，回傳刪掉的那份（按「復原」時原樣 saveCustom 回去，卡面也接得回來）。 */
export async function deleteCustom(id) {
  const j = await call(`/api/custom-cards/${encodeURIComponent(id)}`, "DELETE");
  set(j.cards);
  tellOtherTabs();
  return j.card;
}

/* ---------------- 卡面預覽 ---------------- */

export async function startPreview({ positive, rating, seed, draft }) {
  return call("/api/custom-cards/preview", "POST", { positive, rating, ...(Number.isInteger(seed) ? { seed } : {}), ...(draft ? { draft } : {}) });
}
export async function previewState(draft) {
  return call(`/api/custom-cards/preview/${draft}`, "GET");
}
export function dropPreview(draft) {
  if (!draft) return;
  // 關分頁時也要送得出去：keepalive。
  fetch(`/api/custom-cards/preview/${draft}`, { method: "DELETE", keepalive: true }).catch(() => {});
}
export const previewUrl = (draft, v) => `/api/custom-cards/draft/${draft}.webp?v=${v || Date.now()}`;
export const artUrlOf = (c) => (c?.face?.art ? `/api/custom-cards/art/${c.face.art}` : null);

/* ---------------- 變成牌庫裡的牌 ---------------- */

/** 引擎的分級判斷（rules/rating.js）照詞庫條目的 heat、group 算：讓自製牌在它自己的分級以下被擋。 */
function itemFor(c) {
  const tag = customTag(c.id);
  const base = { tag, section: "custom", group: "custom", sub: "custom", layer: "normal", mutex: null, bind: [], implies: [], era: ["any"], gate: "any", zh: c.name, custom: true };
  if (c.rating === "explicit") return { ...base, group: "sex", heat: ["sex"] };
  if (c.rating === "sensitive") return { ...base, heat: ["flash", "sex"] };
  return { ...base, heat: ["tease", "flash", "sex"] };
}

export function libCardOf(c) {
  const item = itemFor(c);
  return { tag: item.tag, zh: c.name, spine: c.name, suit: "custom", group: "custom", groupZh: "自製", seal: null, rating: c.rating, gate: "any", eras: ["any"], item, custom: c };
}

/** 把自製牌放進牌庫（先拿掉舊的）。lib：buildLibrary 的結果。回傳 lib。 */
export function addCustomToLib(lib, list = customList()) {
  if (!lib) return lib;
  for (const c of lib.cards.filter((x) => x.suit === "custom")) lib.byTag.delete(c.tag);
  lib.cards = lib.cards.filter((x) => x.suit !== "custom");
  for (const c of list) {
    const card = libCardOf(c);
    lib.cards.push(card);
    lib.byTag.set(card.tag, card);
  }
  return lib;
}

/** 卡面：自製牌的圖在伺服器另一個地方（/api/custom-cards/art/）；其他照舊問原本的 assets。 */
export function withCustomArt(assets) {
  if (!assets || assets._custom) return assets;
  return {
    ...assets,
    _custom: true,
    art(tag) {
      return isCustomTag(tag) ? artUrlOf(customOf(tag)) : assets.art(tag);
    },
    sources(tag) {
      if (!isCustomTag(tag)) return assets.sources ? assets.sources(tag) : null;
      const c = customOf(tag);
      const full = artUrlOf(c);
      if (!full) return null;
      return { src: full, srcset: `${full.replace(/\.webp$/, ".thumb.webp")} 200w, ${full} 480w`, sizes: "auto, 120px" };
    },
    mini(tag) {
      return isCustomTag(tag) ? null : assets.mini?.(tag);
    },
  };
}

/* ---------------- 內容 ---------------- */

const wTxt = (w) => (Number.isFinite(w) && w !== 1 ? String(Math.round(w * 10) / 10) : "");

/** 送去生圖的那段：成員＋詞庫外，照順序、帶權重。 */
export function fillText(c) {
  const one = (t, w) => (wTxt(w) ? `(${t}:${wTxt(w)})` : t);
  return [...(c.members || []).map((m) => one(m.tag, m.w)), ...(c.extra || []).map((x) => one(x.text, x.w))].join(", ");
}

/** 詞庫外的字接進提示詞的那段（墨池放進合成池時用）。 */
export function extraText(c) {
  return (c.extra || []).map((x) => (wTxt(x.w) ? `(${x.text}:${wTxt(x.w)})` : x.text)).join(", ");
}

/** 分級下限：成員牌分級最高的那張。lib 的 card.rating 跟卡面分級同一套算法（ratingTier）。 */
export function ratingFloor(members, lib) {
  let best = 0;
  for (const m of members || []) {
    const r = lib?.byTag.get(m.tag)?.rating;
    if (RATINGS.includes(r)) best = Math.max(best, RATINGS.indexOf(r));
  }
  return RATINGS[best];
}
export const ratingAtLeast = (r, floor) => RATINGS.indexOf(r) >= RATINGS.indexOf(floor);

/* ---------------- 封鎖（跟 server.banned_in_prompt 同一套，畫面先擋；伺服器那頭還會再擋一次） ---------------- */

const HARD = new Set(HARD_BANNED.map((t) => t.toLowerCase()));
let charBan = new Set();
/** 詞庫讀好時呼叫一次：禁用角色名單（lexicon.json 的 characterBan）。 */
export function setCharacterBan(list) {
  charBan = new Set((list || []).map((t) => String(t).toLowerCase()));
}
export function normTag(raw) {
  let t = String(raw || "").trim().replace(/\\\(/g, "(").replace(/\\\)/g, ")");
  t = t.replace(/^[([{]+/, "").replace(/:\s*-?[\d.]+\s*[)\]}]*$/, "");
  const open = (t.match(/[([{]/g) || []).length;
  while (t && /[)\]}]$/.test(t) && (t.match(/[)\]}]/g) || []).length > open) t = t.slice(0, -1).trimEnd();
  return t.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
export const isBannedWord = (t) => HARD.has(normTag(t)) || charBan.has(normTag(t));

/* ---------------- 貼提示詞：拆成詞庫的牌和詞庫外的字 ---------------- */

/**
 * text：一整串提示詞。lib：牌庫（byTag、cards）；renamed：詞庫的舊名→新名。
 * 回傳 { members:[{tag,w}], extra:[{text,w}], banned:[字], suggest:{原字: 建議的 tag} }。
 * 對法：tag 本身 → 舊名換新名 → 中文名（完全一樣）。對不到就是詞庫外，另外找一個拼法很像的當建議。
 */
export function parsePrompt(text, { lib, renamed = {} }) {
  const byZh = zhIndex(lib);
  const members = [];
  const extra = [];
  const banned = [];
  const suggest = {};
  const seen = new Set();
  for (const raw of String(text || "").split(/[,，、\n]/)) {
    const piece = raw.trim();
    if (!piece) continue;
    const m = /^[([{]*(.*?)(?::\s*(-?[\d.]+))?\s*[)\]}]*$/.exec(piece);
    const w = m && m[2] ? clampW(parseFloat(m[2])) : 1;
    const t = normTag(piece);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    if (isBannedWord(t)) {
      banned.push(t);
      continue;
    }
    let tag = lib.byTag.has(t) ? t : renamed[t] && lib.byTag.has(renamed[t]) ? renamed[t] : byZh.get(piece.replace(/[()[\]{}:\d.\s]+$/g, "").trim()) || null;
    if (tag && lib.byTag.get(tag)?.suit === "custom") tag = null;
    if (tag) {
      if (!members.some((x) => x.tag === tag)) members.push({ tag, w });
    } else {
      // 詞庫外：照原樣留（小寫、底線換空白），權重另外記。
      extra.push({ text: t, w });
      const near = nearest(lib, t);
      if (near) suggest[t] = near;
    }
  }
  return { members, extra, banned, suggest };
}

const clampW = (w) => (Number.isFinite(w) && w >= 0.5 && w <= 1.5 ? Math.round(w * 10) / 10 : 1);

const zhCache = new WeakMap();
function zhIndex(lib) {
  let m = zhCache.get(lib);
  if (!m) {
    m = new Map();
    for (const c of lib.cards) if (c.suit !== "custom" && c.zh && !m.has(c.zh)) m.set(c.zh, c.tag);
    zhCache.set(lib, m);
  }
  return m;
}

/** 拼法很像的詞庫 tag（blond hair → blonde hair）：先看搜尋排第一的，再比編輯距離。 */
function nearest(lib, t) {
  let best = null;
  let bestD = Infinity;
  const pool = lib.cards.filter((c) => c.suit !== "custom" && cardMatches(c, t.split(" ")[0]));
  for (const c of pool.slice(0, 400)) {
    const d = editDistance(c.tag, t);
    if (d < bestD || (d === bestD && matchRank(c, t) < matchRank(best, t))) {
      best = c;
      bestD = d;
    }
  }
  return best && bestD <= Math.max(1, Math.floor(t.length / 5)) ? best.tag : null;
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = keep;
    }
  }
  return prev[b.length];
}

/* ---------------- 卡面提示詞（自動產生）：照 web/card-art.js 的卡面規則 ---------------- */

const QUALITY = "masterpiece, best quality, amazing quality";
const TAIL = { general: "sfw, general", sensitive: "sensitive", explicit: "nsfw, explicit" };
const GIRLS = /^(?:\d\+?girls?|multiple girls|yuri)$/;
const BOYS = /^(?:\d\+?boys?|multiple boys)$/;
const MULTI = /^(?:[2-9]\+?(?:girls|boys)|multiple (?:girls|boys)|yuri)$/;

/**
 * c：{members, extra, rating}。lex：indexLexicon 的結果（byTag 有 section、group、series）。
 * 成員照順序；有人物補 adult（多人補成熟）；有角色補作品名；沒鏡頭補取景、沒場景補白底；結尾分級、畫質詞。
 */
export function autoFace(c, lex) {
  const tags = (c.members || []).map((m) => m.tag);
  const items = tags.map((t) => lex?.byTag.get(t)).filter(Boolean);
  const people = !tags.includes("no humans") && (items.some((it) => ["subject", "feature", "clothing", "pose"].includes(it.section)) || !items.length);
  const out = [];
  const push = (t) => t && !out.includes(t) && out.push(t);
  const castTags = tags.filter((t) => lex?.byTag.get(t)?.section === "subject");
  for (const t of castTags) {
    push(t);
    const series = lex?.byTag.get(t)?.series;
    if (series) push(String(series));
  }
  if (people) {
    if (!castTags.some((t) => GIRLS.test(t) || BOYS.test(t) || t === "solo")) out.unshift("1girl");
    push("adult");
    const group = castTags.some((t) => MULTI.test(t)) || (castTags.some((t) => GIRLS.test(t)) && castTags.some((t) => BOYS.test(t)));
    if (group && castTags.some((t) => GIRLS.test(t))) push("mature female");
    if (group && castTags.some((t) => BOYS.test(t))) (push("adult male"), push("mature male"));
  }
  for (const t of tags) if (!castTags.includes(t)) push(t);
  for (const x of c.extra || []) push(x.text);
  const hasCamera = items.some((it) => it.group === "camera");
  const hasScene = items.some((it) => it.section === "env");
  if (people && !hasCamera) push("upper body");
  if (!hasScene) (push("simple background"), push("white background"));
  return `${out.join(", ")}, ${TAIL[c.rating] || TAIL.general}, ${QUALITY}`;
}

/* ---------------- 分享碼 ---------------- */

const SHARE = "mochi-card:";

/** 一行文字：名字、分級、成員、詞庫外（不含卡面圖）。 */
export function shareCode(c) {
  const body = { v: 1, n: c.name, r: c.rating, m: (c.members || []).map((m) => (m.w !== 1 ? [m.tag, m.w] : m.tag)), x: (c.extra || []).map((x) => (x.w !== 1 ? [x.text, x.w] : x.text)) };
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return SHARE + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 讀分享碼，回 {name, rating, members, extra}（還沒過詞庫、封鎖；給 parse 再整理）。讀不懂丟錯。 */
export function readShareCode(text) {
  const s = String(text || "").trim();
  const at = s.indexOf(SHARE);
  if (at < 0) throw new Error("不是自製牌的分享碼（要是 mochi-card: 開頭）");
  const b64 = s.slice(at + SHARE.length).split(/\s/)[0].replace(/-/g, "+").replace(/_/g, "/");
  let body;
  try {
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    body = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
  } catch {
    throw new Error("分享碼壞掉了，請整段重新複製");
  }
  const pair = (v) => (Array.isArray(v) ? [String(v[0]), Number(v[1])] : [String(v), 1]);
  return {
    name: String(body.n || "").slice(0, 24),
    rating: RATINGS.includes(body.r) ? body.r : "general",
    members: (body.m || []).slice(0, MAX_MEMBERS).map(pair).map(([tag, w]) => ({ tag, w: clampW(w) })),
    extra: (body.x || []).slice(0, MAX_EXTRA).map(pair).map(([text, w]) => ({ text, w: clampW(w) })),
  };
}

/** 照段落排：人數、角色、長相、服裝、姿勢、場景、風格（同一段維持原本順序）。 */
export function bySuit(members, lib) {
  const rank = (t) => {
    const i = SUIT_ORDER.indexOf(lib?.byTag.get(t)?.suit);
    return i < 0 ? 99 : i;
  };
  return members.map((m, i) => [m, rank(m.tag), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
}

/* ---------------- 從別的房間開編輯（成品、牌組、作品冊 → 卡冊） ---------------- */

const START_KEY = "mochi.custom.start.v1";

/** 寫一張便條（要先填好的內容），換到卡冊打開「新增自製牌」。回傳 false＝存不進瀏覽器。 */
export function handOffCustom(start) {
  try {
    localStorage.setItem(START_KEY, JSON.stringify({ start, at: Date.now() }));
  } catch {
    return false;
  }
  location.href = "book.html#custom-new";
  return true;
}

/** 卡冊打開時拿便條（拿了就丟；30 分鐘以前的不算）。 */
export function takeCustomStart() {
  try {
    const raw = JSON.parse(localStorage.getItem(START_KEY) || "null");
    localStorage.removeItem(START_KEY);
    return raw && Date.now() - (Number(raw.at) || 0) < 30 * 60 * 1000 ? raw.start : null;
  } catch {
    return null;
  }
}

/** 一段提示詞（成品的 positive）＋分級 → 編輯面板的起點。品質、分級尾巴的字不要。 */
export function startFromPrompt(positive, { lib, renamed = {}, rating = "general", name = "" } = {}) {
  const skip = new Set(["masterpiece", "best quality", "amazing quality", "high quality", "absurdres", "highres", "sfw", "nsfw", "general", "sensitive", "explicit", "adult", "very aesthetic", "newest"]);
  const kept = String(positive || "").split(",").filter((p) => !skip.has(normTag(p)));
  const r = parsePrompt(kept.join(","), { lib, renamed });
  return { name, rating, members: r.members.slice(0, MAX_MEMBERS), extra: r.extra.slice(0, MAX_EXTRA) };
}
