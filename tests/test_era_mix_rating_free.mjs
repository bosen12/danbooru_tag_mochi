// 時代「隨機／混合」（settings.eraMix）與分級「不限制」（settings.ratingFree）的引擎行為。
// 隨機＝每張挑一個時代、整張照那個時代（以前叫混合）；混合＝不同時代的東西可以一起出現（漢服配摩天樓）。
// 不限制＝所有牌不受全年齡／敏感／色情限制；分級鈕照樣選，選的那一級是圖本身的分級（提示詞尾巴照它）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const eng = await import("../web/engine.js");
const { ratingBlocked, ratingOf } = await import("../web/rules/rating.js");
const data = JSON.parse(readFileSync(new URL("../web/lexicon.json", import.meta.url), "utf8"));
const lex = eng.indexLexicon(data);
const tagsOf = (d) => String(d.positive).split(",").map((x) => eng.parseWeighted(x).tag.replace(/\\([()])/g, "$1"));
const draws = (settings, pins, n = 60) => Array.from({ length: n }, (_, i) => eng.drawOne(lex, settings, new Set(pins), new Set(), eng.mulberry32(i + 1), i + 1));
const offEra = (tags, era) => tags.filter((t) => { const e = lex.byTag.get(t)?.era; return e && e.length && !e.includes("any") && !e.includes(era); });

test("sanitizeSettings keeps eraMix and ratingFree (and defaults them off)", () => {
  const base = eng.sanitizeSettings({}, data);
  assert.equal(base.eraMix, false);
  assert.equal(base.ratingFree, false);
  const on = eng.sanitizeSettings({ eraMix: true, ratingFree: true }, data);
  assert.equal(on.eraMix, true);
  assert.equal(on.ratingFree, true);
  assert.equal(eng.sanitizeSettings({ eraMix: "yes" }, data).eraMix, false);
});

test("random era: pinning hanfu keeps the whole image in ancient China", () => {
  const settings = eng.sanitizeSettings({ rating: "general", eras: [...eng.ERAS] }, data);
  for (const d of draws(settings, ["hanfu"])) {
    assert.equal(d.era, "ancient_china");
    assert.deepEqual(offEra(tagsOf(d), "ancient_china"), [], d.positive);
  }
});

test("mixed era: items from other eras appear next to hanfu, and the era reads mixed", () => {
  const settings = eng.sanitizeSettings({ rating: "general", eras: [...eng.ERAS], eraMix: true }, data);
  const out = draws(settings, ["hanfu"]);
  assert.ok(out.every((d) => d.era === "mixed"));
  assert.ok(out.every((d) => tagsOf(d).includes("hanfu")), "the pin stays");
  const mixed = out.filter((d) => offEra(tagsOf(d), "ancient_china").length).length;
  assert.ok(mixed >= out.length * 0.8, `only ${mixed}/${out.length} images mixed eras`);
});

test("mixed era: pinning hanfu after skyscraper keeps both (applyPin eraMix)", () => {
  let pins = new Set();
  for (const t of ["skyscraper", "hanfu"]) pins = eng.applyPin(lex, pins, new Set(), t, { eraMix: true }).pinned;
  assert.ok(pins.has("skyscraper") && pins.has("hanfu"), [...pins].join(", "));
  let strict = new Set();
  for (const t of ["skyscraper", "hanfu"]) strict = eng.applyPin(lex, strict, new Set(), t).pinned;
  assert.ok(!strict.has("skyscraper"), "without eraMix the clashing era still steps aside");
  const settings = eng.sanitizeSettings({ rating: "general", eras: [...eng.ERAS], eraMix: true }, data);
  for (const d of draws(settings, ["skyscraper", "hanfu"], 20)) assert.ok(tagsOf(d).includes("skyscraper") && tagsOf(d).includes("hanfu"), d.positive);
});

test("mixed era does not leak into the next draw (the flag is per draw)", () => {
  const mix = eng.sanitizeSettings({ rating: "general", eras: [...eng.ERAS], eraMix: true }, data);
  const one = eng.sanitizeSettings({ rating: "general", eras: ["ancient_china"] }, data);
  eng.drawOne(lex, mix, new Set(["hanfu"]), new Set(), eng.mulberry32(7), 7);
  const d = eng.drawOne(lex, one, new Set(["hanfu"]), new Set(), eng.mulberry32(7), 7);
  assert.equal(d.era, "ancient_china");
  assert.deepEqual(offEra(tagsOf(d), "ancient_china"), []);
  assert.deepEqual(eng.eraMismatches(lex, new Set(["skyscraper"]), "mixed"), [], "mixed: no pin is out of era");
});

test("rating free: general draws can include blocked cards, and the image keeps the picked rating", () => {
  const heats = ["activity", "tease", "flash", "sex"];
  const off = eng.sanitizeSettings({ rating: "general", heats }, data);
  const on = eng.sanitizeSettings({ rating: "general", heats, ratingFree: true }, data);
  assert.equal(ratingOf(on), "explicit");
  assert.equal(ratingOf(off), "general");
  const blockedIn = (d) => tagsOf(d).some((t) => { const it = lex.byTag.get(t); return it && ratingBlocked(it, "general"); });
  const offDraws = draws(off, []);
  assert.equal(offDraws.filter(blockedIn).length, 0, "free off: general stays general");
  const onDraws = draws(on, []);
  assert.ok(onDraws.filter(blockedIn).length > 10, "free on: blocked cards show up");
  const tail = (d, list) => list.every((t) => tagsOf(d).includes(t));
  for (const [rating, key] of [["general", "sfwTail"], ["sensitive", "sensitiveTail"], ["explicit", "nsfwTail"]]) {
    const list = data[key] || [];
    if (!list.length) continue;
    const picked = eng.sanitizeSettings({ rating, heats, ratingFree: true }, data);
    assert.ok(draws(picked, [], 12).every((d) => tail(d, list)), `free on + ${rating}: the prompt tail follows the picked rating`);
  }
});
