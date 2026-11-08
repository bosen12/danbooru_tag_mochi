// 字盒搜尋（web6/cards.js 的 searchCards、cardMatches、matchRank）：2026-10-21 實測 60 個常見說法，
// 簡體、底線、兩個條件全部 0 張，完全相符的那張常常不在第一（按 Enter 放錯牌）。這裡把改好的樣子守住。
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

// 這邊的 web6/ 少了 web/ 的共用檔（伺服器是兩層合起來給的）：web6 找不到的照 web/ 找。開源版合成一個 web/，用不到。
register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(spec, ctx, next) {
  if (ctx.parentURL && ctx.parentURL.includes("/web6/") && (spec.startsWith("./") || spec.startsWith("../"))) {
    const u = new URL(spec, ctx.parentURL);
    if (u.protocol === "file:" && !existsSync(fileURLToPath(u))) return next(u.href.replace("/web6/", "/web/"), ctx);
  }
  return next(spec, ctx);
}`)
);
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });

const dir = existsSync(new URL("../web6/cards.js", import.meta.url)) ? "../web6/" : "../web/";
const { buildLibrary, searchCards, searchKey, searchNoteText } = await import(new URL(dir + "cards.js", import.meta.url));
const { ratingBlocked } = await import(new URL("../web/rules/rating.js", import.meta.url));
const data = JSON.parse(readFileSync(new URL("../web/lexicon.json", import.meta.url), "utf8"));
const cards = buildLibrary(data, { ratingBlocked }).cards;
const find = (q) => searchCards(cards, q.toLowerCase());
const first = (q) => find(q).list[0]?.tag;

test("searchKey: lower case, underscores as spaces, traditional to simplified", () => {
  assert.equal(searchKey("Red_Hair"), "red hair");
  assert.equal(searchKey("紅髮"), searchKey("红发"));
  assert.equal(searchKey("  雙馬尾  "), "双马尾");
});

test("the exact card comes first, so Enter places the right one", () => {
  assert.equal(first("和服"), "kimono");
  assert.equal(first("水手服"), "serafuku");
  assert.equal(first("女僕"), "maid");
  assert.equal(first("Kimono"), "kimono");
  assert.equal(first("yor"), "yor briar", "a word start beats the middle of conveyor");
});

test("simplified Chinese and Danbooru underscores find the same cards", () => {
  assert.equal(first("红发"), "red hair");
  assert.equal(first("猫耳"), "cat ears");
  assert.equal(first("双马尾"), "twintails");
  assert.equal(first("眼镜"), "glasses");
  assert.equal(first("red_hair"), "red hair");
});

test("space-separated terms must all match one card", () => {
  const r = find("白 和服");
  assert.equal(r.mode, "all");
  assert.equal(r.list[0].tag, "white kimono");
  assert.equal(find("hair long").list[0]?.tag, "long hair");
});

test("Chinese terms with no single card fall back to each term separately", () => {
  const r = find("長髮 紅髮");
  assert.equal(r.mode, "any");
  const tags = r.list.map((c) => c.tag);
  assert.ok(tags.includes("long hair") && tags.includes("red hair"));
  assert.ok(tags.indexOf("long hair") < tags.indexOf("red hair"), "in the order typed");
  assert.equal(find("red hair long").mode, "none", "English words are too common to split (would flood)");
});

test("no match guesses cards whose name is spelled inside the query", () => {
  for (const [q, tag] of [["紅頭髮", "red hair"], ["摩天大樓", "skyscraper"], ["下雨", "rain"]]) {
    const r = find(q);
    assert.equal(r.mode, "guess", q);
    assert.equal(r.list[0].tag, tag, q);
  }
  assert.equal(find("鑫").mode, "none", "a one-character query does not guess");
});

// 2026-11-02 走查：搜「胖」只有胖製作，「開槍」只猜到槍，「黑絲」「墨鏡」「夕陽」一張都沒有。同義詞表在 web6/search-words.js。
const { SEARCH_WORDS } = await import(new URL(dir + "search-words.js", import.meta.url));

test("every synonym points at a card that exists, so a renamed tag cannot fail silently", () => {
  const tags = new Set(data.tags.map((x) => x.tag));
  for (const [word, list] of Object.entries(SEARCH_WORDS)) {
    assert.ok(list.length, word);
    for (const tag of list) assert.ok(tags.has(tag), `${word} → ${tag} is not in the lexicon`);
  }
});

test("everyday words find the cards named differently", () => {
  const has = (q, tag) => assert.ok(find(q).list.some((c) => c.tag === tag), `${q} should find ${tag}`);
  has("胖", "plump");
  has("胖", "fat rolls");
  assert.equal(first("開槍"), "firing");
  assert.equal(first("黑絲"), "black pantyhose");
  assert.equal(first("墨鏡"), "sunglasses");
  assert.equal(first("夕陽"), "sunset");
  assert.equal(first("帽T"), "hoodie");
  assert.equal(first("Q版"), "chibi");
  // 簡體照樣對得上；牌名直接有的字排在同義詞前面
  assert.equal(first("黑丝"), "black pantyhose");
  const fat = find("胖").list.map((c) => c.tag);
  assert.ok(fat.indexOf("obese") < fat.indexOf("plump"), "過胖 has 胖 in its name, 豐滿 only through the synonym");
  // 兩段：每一段都可以靠同義詞（「黑」在牌名、「絲襪」靠同義詞）
  const black = find("黑 絲襪");
  assert.equal(black.mode, "all");
  assert.deepEqual(black.list.map((c) => c.tag).sort(), ["black pantyhose", "black thighhighs"]);
});

// 連寫的中文、英文複數、牌格那一行（中文句子要對得上 en.js 的模板，英文版才換得了）。
const { templates } = await import(new URL(dir + "locales/en.js", import.meta.url));
const enOf = (text) => {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const compiled = [...templates]
    .sort((a, b) => b[0].replace(/\{\d+\}/g, "").length - a[0].replace(/\{\d+\}/g, "").length)
    .map(([source, target]) => {
      const parts = source.split(/\{\d+\}/);
      return { re: new RegExp("^" + parts.map(escape).join("([\\s\\S]*?)") + "$"), target };
    });
  for (const { re, target } of compiled) {
    const match = text.match(re);
    if (match) return target.replace(/\{(\d+)(!?)\}/g, (_, i) => match[Number(i) + 1]);
  }
  return null;
};

test("unspaced Chinese splits into lexicon words and the note uses those pieces", () => {
  const sea = find("海邊夕陽");
  assert.equal(sea.mode, "any");
  assert.deepEqual(sea.terms, ["海邊", "夕陽"]);
  const tags = sea.list.map((c) => c.tag);
  assert.ok(tags.includes("beach") && tags.includes("sunset"), tags.slice(0, 8).join(", "));
  assert.ok(tags.indexOf("beach") < tags.indexOf("sunset"), "beach then sunset, in the order of the pieces");
  const note = searchNoteText(sea, "海邊夕陽");
  assert.equal(note, "沒有一張同時有「海邊」「夕陽」，分別找到這些");
  assert.equal(enOf(note), "No single card has all of “海邊」「夕陽”; showing each separately");
  const both = find("白髮微笑");
  assert.equal(both.mode, "any");
  assert.deepEqual(both.terms, ["白髮", "微笑"]);
  assert.ok(both.list.some((c) => c.tag === "white hair") && both.list.some((c) => c.tag === "smile"));
  assert.ok(both.list.findIndex((c) => c.tag === "white hair") < both.list.findIndex((c) => c.tag === "smile"));
  const spaced = find("長髮 紅髮");
  assert.equal(searchNoteText(spaced, "長髮 紅髮"), "沒有一張同時有「長髮」「紅髮」，分別找到這些");
});

test("a phrase that does not split still guesses, and English plurals guess the singular", () => {
  for (const [q, tag] of [["下雨", "rain"], ["雨天", "rain"]]) {
    const r = find(q);
    assert.equal(r.mode, "guess", q);
    assert.equal(r.list[0].tag, tag, q);
    assert.equal(searchNoteText(r, q), `找不到「${q}」，你是不是要找這幾張？`);
  }
  assert.equal(enOf(searchNoteText(find("下雨"), "下雨")), "No match for “下雨”. Did you mean these?");
  const wear = find("穿著和服");
  assert.equal(wear.mode, "guess");
  assert.ok(wear.list.some((c) => c.tag === "kimono"), wear.list.slice(0, 8).map((c) => c.tag).join(", "));
  const bats = find("baseball bats");
  assert.equal(bats.mode, "guess");
  assert.equal(bats.list[0].tag, "baseball bat");
  assert.deepEqual(bats.terms, ["baseball", "bats"]);
  // -ies 換回 y：只去掉 es 會變成 strawberri，什麼都對不到。
  for (const [q, tag] of [["strawberries", "strawberry"], ["butterflies", "butterfly"]]) {
    const r = find(q);
    assert.equal(r.mode, "guess", q);
    assert.equal(r.list[0].tag, tag, q);
  }
  assert.equal(find("baseball bat").mode, "all");
  assert.equal(find("glasses").mode, "all");
  assert.equal(find("glasses").list[0].tag, "glasses");
});
