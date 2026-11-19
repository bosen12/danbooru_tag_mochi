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
const { buildLibrary, searchCards, searchKey, searchNoteText, warmSearchKeys } = await import(new URL(dir + "cards.js", import.meta.url));
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
  // 英文不拆成單字（red、long 一拆就冒出上百張）；三個字以上只退到連續的兩個字：red hair long → red hair
  const rhl = find("red hair long");
  assert.equal(rhl.mode, "near");
  assert.equal(rhl.near, "red hair");
  assert.ok(rhl.list.length < 60 && rhl.list.every((c) => /red/.test(c.tag) && /hair/.test(c.tag)), rhl.list.map((c) => c.tag).join(","));
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

// 開好之後閒下來先算搜尋鍵（app.js 的 warmSearchSoon）：時間快用完就停、回傳下次從哪裡接；接著算完回 -1。
// 先算過的跟當場算的一樣（搜尋結果不變）。
test("warmSearchKeys：照閒置時間分段、算完回 -1、結果不變", () => {
  const fresh = buildLibrary(data, { ratingBlocked }).cards;
  let budget = 0;
  const deadline = { timeRemaining: () => (budget-- > 0 ? 50 : 0) };
  budget = 2;
  const next = warmSearchKeys(fresh, 0, deadline);
  assert.ok(next > 0 && next < fresh.length, `第一段停在 ${next}`);
  assert.equal(warmSearchKeys(fresh, next), -1);
  for (const q of ["紅髮", "red_hair", "海边", "smile"]) assert.deepEqual(searchCards(fresh, q).list.map((c) => c.tag), searchCards(cards, q).list.map((c) => c.tag), q);
});

test("a phrase longer than any card name falls back to its shorter pieces (脫衣服 → 脫衣)", async () => {
  const { shorterTerms } = await import(new URL(dir + "card-search.js", import.meta.url));
  const r = find("脫衣服");
  assert.equal(r.mode, "near");
  assert.equal(r.near, "脫衣");
  const tags = r.list.map((c) => c.tag);
  assert.ok(tags.includes("undressing") && tags.includes("partially undressed"), tags.join(","));
  assert.equal(searchNoteText(r, "脫衣服"), "找不到「脫衣服」，照「脫衣」找到這些");
  // 猜得到的照舊用猜的（紅頭髮 → 紅髮，不是「頭髮」一大堆）
  assert.equal(find("紅頭髮").mode, "guess");
  // 英文、帶空白、兩個字、一個字不拆
  assert.deepEqual(shorterTerms("undressing"), []);
  // 英文：三個字以上照連續的字由長到短，最短兩個字；兩個字的不拆（拆成單字雜訊太多）
  assert.deepEqual(shorterTerms("fur trimmed white coat").slice(0, 3), ["fur trimmed white", "trimmed white coat", "fur trimmed"]);
  assert.deepEqual(shorterTerms("red hair"), []);
  assert.deepEqual(shorterTerms("long_red_hair"), ["long red", "red hair"]);
  const en = find("fur trimmed white coat");
  assert.equal(en.mode, "near");
  assert.equal(en.near, "fur trimmed");
  assert.equal(en.list[0]?.tag, "fur-trimmed coat", en.list.map((c) => c.tag).join(","));
  assert.equal(searchNoteText(en, "fur trimmed white coat"), "找不到「fur trimmed white coat」，照「fur trimmed」找到這些");
  assert.deepEqual(shorterTerms("紅 髮"), []);
  assert.deepEqual(shorterTerms("帽子"), []);
  assert.deepEqual(shorterTerms("脫衣服").slice(0, 2), ["脫衣", "衣服"]);
  assert.ok(shorterTerms("一二三四五六七八九十").length <= 12);
  assert.equal(find("鑫").mode, "none");
});
