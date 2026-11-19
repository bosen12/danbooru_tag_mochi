// 選格的「隨機」開關（2026-11-19）：開著的段可以亮好幾格，每張從亮著的格子裡隨機挑「每段抽幾個」那麼多格。
//   node scripts/test_skel_random.mjs
// 守住：開關規則（保留亮著的、最後一格不能熄、改數字不熄候選、關掉照數字收回）、每張真的隨機挑、
// 固定種子可重現、沒開隨機時抽出來跟以前一模一樣。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const E = await import(new URL("../web/engine.js", import.meta.url));
const data = JSON.parse(readFileSync(new URL("../web/lexicon.json", import.meta.url), "utf8"));
const lex = E.indexLexicon(data);
const base = () => E.sanitizeSettings({ counts: { feature: 8, clothing: 1, pose: 6, env: 6 }, rating: "general" }, data);
const apply = (s, patch) => (patch ? Object.assign(s, patch) : s);

test("sanitize keeps only real sections", () => {
  assert.deepEqual(E.sanitizeSettings({ skelRandom: ["clothing", "bogus", 3, "clothing"] }, data).skelRandom, ["clothing"]);
  assert.deepEqual(E.sanitizeSettings({}, data).skelRandom, []);
});

test("turning random on keeps the lit slots; candidates toggle; the last one stays", () => {
  const s = base();
  const before = E.skeletonLit(s, "clothing");
  assert.equal(before.length, 1);
  apply(s, E.setSkelRandom(s, "clothing", true));
  assert.deepEqual(s.skelRandom, ["clothing"]);
  assert.deepEqual(E.skeletonLit(s, "clothing"), before, "turning it on must not light every slot");
  apply(s, E.toggleSkeleton(s, "clothing", "clothing:top"));
  apply(s, E.toggleSkeleton(s, "clothing", "clothing:outer"));
  assert.deepEqual(E.skeletonLit(s, "clothing"), ["clothing:onepiece", "clothing:top", "clothing:outer"]);
  apply(s, E.toggleSkeleton(s, "clothing", "clothing:top"));
  assert.deepEqual(E.skeletonLit(s, "clothing"), ["clothing:onepiece", "clothing:outer"]);
  apply(s, E.toggleSkeleton(s, "clothing", "clothing:onepiece"));
  assert.equal(E.toggleSkeleton(s, "clothing", "clothing:outer"), null, "the last candidate cannot be turned off");
});

test("changing the count keeps candidates; turning random off trims to the count", () => {
  const s = base();
  apply(s, E.setSkelRandom(s, "clothing", true));
  for (const k of ["clothing:top", "clothing:outer", "clothing:feet"]) apply(s, E.toggleSkeleton(s, "clothing", k));
  apply(s, E.stepSkeleton(s, "clothing", 2));
  assert.equal(E.skeletonLit(s, "clothing").length, 4, "stepping the number must not drop candidates");
  apply(s, E.setSkelRandom(s, "clothing", false));
  assert.equal(E.skeletonLit(s, "clothing").length, 2, "off: back to exactly the count");
  assert.deepEqual(s.skelRandom, []);
});

test("skeletonDraw picks the count from the candidates, reproducibly", () => {
  const s = base();
  apply(s, E.setSkelRandom(s, "clothing", true));
  for (const k of ["clothing:top", "clothing:outer"]) apply(s, E.toggleSkeleton(s, "clothing", k));
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const a = E.skeletonDraw(s, "clothing", E.mulberry32(i));
    const b = E.skeletonDraw(s, "clothing", E.mulberry32(i));
    assert.deepEqual(a, b);
    assert.equal(a.length, 1);
    seen.add(a[0]);
  }
  assert.deepEqual([...seen].sort(), ["clothing:onepiece", "clothing:outer", "clothing:top"]);
  // 沒開隨機：就是 skeletonLit
  const plain = base();
  assert.deepEqual(E.skeletonDraw(plain, "clothing", E.mulberry32(1)), E.skeletonLit(plain, "clothing"));
});

test("drawn images spread over the candidates and repeat with the same seed", () => {
  const s = base();
  apply(s, E.setSkelRandom(s, "clothing", true));
  for (const k of ["clothing:top", "clothing:outer"]) apply(s, E.toggleSkeleton(s, "clothing", k));
  const tally = {};
  for (let i = 0; i < 150; i++) {
    const seed = 2000 + i;
    const out = E.drawOne(lex, s, new Set(), new Set(), E.mulberry32(seed), seed);
    const again = E.drawOne(lex, s, new Set(), new Set(), E.mulberry32(seed), seed);
    assert.equal(out.positive, again.positive, "same seed, same image");
    for (const kind of new Set((out.sections?.clothing || []).flatMap((t) => E.supplementKindKeys(lex.byTag.get(t))))) tally[kind] = (tally[kind] || 0) + 1;
  }
  for (const k of ["clothing:onepiece", "clothing:top", "clothing:outer"]) assert.ok((tally[k] || 0) >= 25, `${k}: ${tally[k] || 0} of 150 (${JSON.stringify(tally)})`);
});

test("without random, draws are exactly as before", () => {
  const plain = base();
  const explicitOff = { ...base(), skelRandom: [] };
  const otherOn = base();
  apply(otherOn, E.setSkelRandom(otherOn, "pose", true)); // 別段開隨機、但亮著的跟原本一樣：服裝這段不受影響
  for (let i = 0; i < 40; i++) {
    const seed = 500 + i;
    const a = E.drawOne(lex, plain, new Set(), new Set(), E.mulberry32(seed), seed);
    const b = E.drawOne(lex, explicitOff, new Set(), new Set(), E.mulberry32(seed), seed);
    assert.equal(a.positive, b.positive);
  }
  // 沒有 skelRandom 欄位的舊設定（沒經過 sanitize）也照舊
  const legacy = { ...base() };
  delete legacy.skelRandom;
  for (let i = 0; i < 10; i++) {
    const seed = 900 + i;
    assert.equal(
      E.drawOne(lex, legacy, new Set(), new Set(), E.mulberry32(seed), seed).positive,
      E.drawOne(lex, base(), new Set(), new Set(), E.mulberry32(seed), seed).positive
    );
  }
});
