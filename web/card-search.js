/**
 * 字盒搜尋的純函式（墨池網頁、iPhone 抽牌橋、MCP 共用）。
 * 不碰 DOM：MCP 在 Node 裡載這支，cards.js 再轉出口給畫面用。
 * 比對前都換成同一種寫法（searchKey）：小寫、底線當空白、繁體換成簡體。
 * 空白分開＝每一段都要有。2026-10-21 實測 60 個常見說法：簡體、底線、兩個條件全部 0 張；
 * 完全相符的那張常常不在第一（按 Enter 放錯牌）。
 */
import { toSimplified } from "./t2s.js";
import { SEARCH_WORDS } from "./search-words.js";

export const searchKey = (s) => toSimplified(String(s ?? "").toLowerCase().replace(/_/g, " ")).replace(/\s+/g, " ").trim();

const keyCache = new WeakMap();
function keysOf(c) {
  let k = keyCache.get(c);
  if (!k) {
    // 角色牌另外對作品：打「航海王」「one piece」就列出那部作品的角色。
    k = { zh: searchKey(c.zh), tag: searchKey(c.tag), raw: c.tag, extra: c.suit === "chara" ? searchKey(`${c.groupZh || ""} ${c.item?.series || ""}`) : "" };
    keyCache.set(c, k);
  }
  return k;
}

let lastQ = null;
let lastTerms = [];
function termsOf(q) {
  if (q !== lastQ) {
    lastQ = q;
    lastTerms = searchKey(q).split(" ").filter(Boolean);
  }
  return lastTerms;
}

// 同義詞（search-words.js）：打的某一段等於鍵，就帶出那幾張（「胖」→ 豐滿、「夕陽」→ 日落）。
const WORDS = new Map(Object.entries(SEARCH_WORDS).map(([w, tags]) => [searchKey(w), tags]));
const wordAt = (k, t) => WORDS.get(t)?.indexOf(k.raw) ?? -1;
const hits = (k, t) => k.zh.includes(t) || k.tag.includes(t) || (!!k.extra && k.extra.includes(t)) || wordAt(k, t) >= 0;

const HAN = /[㐀-鿿]/;
// 連在一起的中文中間可以略過的零碎（穿著、在海邊的）。著的簡體是着，兩種都認。
const SKIP = new Set(["的", "著", "着", "在"]);

// 拆詞用的詞典：同義詞鍵＋牌的中文名（至少兩個字；一個字的「雨」「人」什麼句子都吃得下，留給猜）。
const nameDict = new Set();
let maxName = 2;
let namesReady = false;
function addName(zh) {
  const k = searchKey(zh).replace(/ /g, "");
  const n = [...k].length;
  if (n < 2) return;
  nameDict.add(k);
  if (n > maxName) maxName = n;
}
for (const w of Object.keys(SEARCH_WORDS)) addName(w);

/** buildLibrary 建完整本詞庫後叫一次。只從當次搜尋的 pool 學的話，花色篩過就拆不出被收起來的詞。 */
export function indexSearchNames(cards) {
  for (const c of cards || []) if (c?.zh) addName(c.zh);
  namesReady = true;
}

export function cardMatches(c, q) {
  if (!q) return true;
  const terms = termsOf(q);
  if (!terms.length) return true;
  const k = keysOf(c);
  // 英文的牌名本身就有空白（red hair）：整句先比一次，比不到才拆開每一段都要有。
  return (terms.length > 1 && hits(k, terms.join(" "))) || terms.every((t) => hits(k, t));
}

/**
 * 跟搜尋字有多接近（小的排前面）：完全相符 → 開頭相符 → 英文某個字的開頭 → 中文名裡有 → tag 裡有 → 同義詞（照表上的順序）→ 作品名。
 * 搜「和服」第一張是和服，不是「和服敞開」。
 */
export function matchRank(c, q) {
  return rankBy(keysOf(c), termsOf(q).join(" "));
}

function rankBy(k, qk) {
  if (!qk) return 0;
  if (k.zh === qk || k.tag === qk) return 0;
  if (k.zh.startsWith(qk) || k.tag.startsWith(qk)) return 1;
  if (k.tag.includes(" " + qk) || k.tag.includes("(" + qk)) return 2;
  if (k.zh.includes(qk)) return 3;
  if (k.tag.includes(qk)) return 4;
  const w = wordAt(k, qk);
  if (w >= 0) return 4.5 + w / 1000;
  return 5;
}

function rankList(list, qk) {
  return list.map((c, i) => [c, rankBy(keysOf(c), qk), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
}

/**
 * 牌名裡沒有這個字、只靠同義詞對上（MCP 要標「同義詞」）。
 * 猜的結果（「下雨」對到「雨」）不算：中文名並沒有包含整句。
 */
export function isSynonymOnly(card, terms) {
  const k = keysOf(card);
  const keyed = (terms || []).map((t) => searchKey(t)).filter(Boolean);
  if (!keyed.length) return false;
  const name = (s) => k.zh.includes(s) || k.tag.includes(s) || (!!k.extra && k.extra.includes(s));
  if (keyed.some(name)) return false;
  return keyed.some((s) => wordAt(k, s) >= 0);
}

/**
 * 找不到的時候猜：牌名的字依序都出現在打的字裡（打「紅頭髮」→ 紅髮、「下雨」→ 雨）。
 * 牌名至少要佔打的字的一半，不然「的」「人」這種一個字的牌什麼都對得上。長的排前面。
 */
function guessCards(pool, q, limit = 8) {
  const qk = termsOf(q).join("");
  if ([...qk].length < 2) return [];
  const chars = [...qk];
  const within = (name) => {
    let i = 0;
    for (const ch of chars) if (ch === name[i]) i++;
    return i === name.length;
  };
  const out = [];
  for (const c of pool) {
    const name = [...keysOf(c).zh.replace(/ /g, "")];
    if (!name.length || name.length * 2 < chars.length || name.length >= chars.length) continue;
    if (within(name)) out.push({ c, n: name.length });
  }
  return out.sort((a, b) => b.n - a.n).slice(0, limit).map((x) => x.c);
}

/** 沒有空白的中文，最長優先拆成詞典裡的詞。拆不出兩段以上就回 null，呼叫端改走猜。 */
function segmentChinese(q) {
  const raw = [...String(q ?? "").trim()];
  if (raw.length < 2 || raw.some((ch) => /\s/.test(ch))) return null;
  const simp = raw.map((ch) => toSimplified(ch.toLowerCase()));
  if (!simp.some((ch) => HAN.test(ch)) || simp.some((ch) => /[a-z0-9]/i.test(ch))) return null;
  const parts = [];
  let i = 0;
  while (i < simp.length) {
    let best = 0;
    const room = Math.min(maxName, simp.length - i);
    for (let len = room; len >= 2; len--) {
      if (nameDict.has(simp.slice(i, i + len).join(""))) {
        best = len;
        break;
      }
    }
    if (best) {
      parts.push(raw.slice(i, i + best).join(""));
      i += best;
      continue;
    }
    if (SKIP.has(simp[i]) || SKIP.has(raw[i])) {
      i++;
      continue;
    }
    return null;
  }
  return parts.length >= 2 ? parts : null;
}

// 分別找只給中文：英文拆開來每個字都太常見（red hair long 會冒出一百多張紅血球、小紅帽）。
function anyList(pool, rawTerms) {
  const seen = new Set();
  const any = [];
  for (const raw of rawTerms) {
    const t = searchKey(raw);
    if (!t) continue;
    const one = rankList(pool.filter((c) => !seen.has(c) && hits(keysOf(c), t)), t);
    for (const c of one) {
      seen.add(c);
      any.push(c);
    }
  }
  return any;
}

// guess 時英文複數改回單數再找一次（baseball bats → baseball bat、butterflies → butterfly）。
// glasses 這種本來就對得到的走不到這裡。比對是「包含」，所以 races 削成 rac 也對得到 race；
// 只有 -ies 要換回 y（strawberries 削成 strawberri 什麼都對不到）。
function stemEn(word) {
  if (HAN.test(word) || word.length < 4) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function searchInner(pool, q, allowStem) {
  const typed = String(q ?? "").trim().split(/\s+/).filter(Boolean);
  const terms = termsOf(q);
  if (!terms.length) return { list: pool, mode: "all", terms: [] };
  const all = pool.filter((c) => cardMatches(c, q));
  if (all.length) return { list: rankList(all, terms.join(" ")), mode: "all", terms: typed };
  // 使用者常把兩個詞黏在一起打（海邊夕陽、白髮微笑）。有空白的維持原來的切法。
  if (terms.length === 1 && HAN.test(terms[0])) {
    const seg = segmentChinese(q);
    if (seg) {
      const any = anyList(pool, seg);
      if (any.length) return { list: any, mode: "any", terms: seg };
    }
  }
  if (terms.length > 1 && terms.every((t) => HAN.test(t))) {
    const any = anyList(pool, typed);
    if (any.length) return { list: any, mode: "any", terms: typed };
  }
  if (allowStem) {
    const stemmed = terms.map(stemEn);
    if (stemmed.some((t, i) => t !== terms[i] && t.length >= 2)) {
      const again = searchInner(pool, stemmed.join(" "), false);
      if (again.list.length) return { list: again.list, mode: "guess", terms: typed };
    }
  }
  const guess = guessCards(pool, q);
  return guess.length ? { list: guess, mode: "guess", terms: typed } : { list: [], mode: "none", terms: typed };
}

/**
 * 篩過花色、分級…之後的 pool 裡搜 q：回 { list, mode, terms }。
 *   all：每一段都有的（照 matchRank 排）。
 *   any：沒有一張同時都有。空白分開的各段，或連寫的中文拆出來的段，照段的順序排。terms 是拆出來的段（照打的字，不是簡體）。
 *   guess：都找不到，猜的（含英文複數去掉 s／es 再找）。none：真的沒有。
 */
export function searchCards(pool, q) {
  if (!namesReady) indexSearchNames(pool);
  return searchInner(pool, q, true);
}

/** 牌格上面那一行。any 用拆出來的段，不是再照空白切（連寫的「海邊夕陽」沒有空白）。 */
export function searchNoteText(res, q) {
  if (res?.mode === "any") {
    const terms = res.terms?.length ? res.terms : String(q ?? "").trim().split(/\s+/).filter(Boolean);
    return `沒有一張同時有「${terms.join("」「")}」，分別找到這些`;
  }
  if (res?.mode === "guess") return `找不到「${String(q ?? "").trim()}」，你是不是要找這幾張？`;
  return "";
}
