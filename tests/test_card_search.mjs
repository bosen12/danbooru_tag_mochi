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
const { buildLibrary, searchCards, searchKey } = await import(new URL(dir + "cards.js", import.meta.url));
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
