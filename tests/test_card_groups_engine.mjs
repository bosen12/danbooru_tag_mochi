// 卡片群組的抽牌（web/engine.js 的 groupGateOf＋commit 閘門，web6/card-groups.js 的解析）。
// 沒勾群組：同一顆種子一字不差。有群組：群組有放的小類只出群組的牌、「每段抽幾個」先從群組抽、
// 群組的牌被規則擋光就照常補、出處記成 group。整組一起每張只用一組；混著抽會跨組。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { indexLexicon, defaultSettings, sanitizeSettings, drawOne, mulberry32, groupSlotKey, ratingBlocked, stepSkeleton, swapSkeleton, skeletonLit } from "../web/engine.js";
import { existsSync } from "node:fs";
// 開源版把 web6/ 合進 web/：兩邊都跑得動。
const groupsJs = existsSync(resolve(import.meta.dirname, "../web6/card-groups.js")) ? "../web6/card-groups.js" : "../web/card-groups.js";
const { resolveGroupPools, withGroupPools, pickOf } = await import(new URL(groupsJs, import.meta.url));

const data = JSON.parse(readFileSync(resolve(import.meta.dirname, "../web/lexicon.json"), "utf8"));
const lex = indexLexicon(data);
let failed = 0;
const ok = (name, cond, got) => {
  console.log((cond ? "ok   " : "FAIL ") + name + (cond || got === undefined ? "" : `  got=${JSON.stringify(got)}`));
  if (!cond) failed++;
};
const need = (tags) => {
  for (const t of tags) assert.ok(lex.byTag.has(t), `詞庫要有 ${t}`);
  return tags;
};
const base = (patch = {}) => sanitizeSettings({ ...defaultSettings(data), ...patch }, data);
const draw = (settings, seed, pins = []) => drawOne(lex, settings, new Set(pins), new Set(), mulberry32(seed), seed, { trace: true });
const SEEDS = Array.from({ length: 160 }, (_, i) => 90210 + i * 7);
const keysOf = (tag) => [groupSlotKey(lex.byTag.get(tag))];
const sourceMap = (out) => new Map(out.trace.kept.map((k) => [k.tag, k.source]));

// 1. 沒勾群組：結果一個字都不差（groups 有勾但沒有 groupPools、groupPools 是空的也一樣）
{
  const variants = [base(), base({ rating: "general", heats: ["activity"] }), base({ counts: { feature: 3, pose: 2, clothing: 6, env: 2 } }), base({ sceneMode: "weird" })];
  let same = 0, total = 0;
  for (const s of variants) {
    for (const seed of SEEDS.slice(0, 60)) {
      const a = draw(s, seed).positive;
      const b = draw({ ...s, groups: { feature: { ids: ["g-x"], mode: "whole" } } }, seed).positive;
      const c = draw({ ...s, groupPools: {} }, seed).positive;
      const d = draw({ ...s, groupPools: { feature: ["not a tag"], clothing: [] } }, seed).positive;
      total++;
      if (a === b && a === c && a === d) same++;
    }
  }
  ok(`沒有群組時同一顆種子一字不差（${same}/${total}）`, same === total);
}

// 2. 長相群組：群組有放的小類只出群組的牌；沒放的小類照常
{
  const group = need(["blonde hair", "blue eyes", "twintails"]);
  const covered = new Set(group.flatMap(keysOf));
  const s = { ...base({ rating: "general", heats: ["activity"] }), groupPools: { feature: group } };
  let leak = [], hits = 0, other = 0;
  for (const seed of SEEDS) {
    const out = draw(s, seed);
    const src = sourceMap(out);
    for (const t of out.sections.feature) {
      const engine = ["random", "era_anchor", "group"].includes(src.get(t));
      if (!engine) continue;
      if (group.includes(t)) hits++;
      else if (keysOf(t).some((k) => covered.has(k))) leak.push(t);
      else other++;
    }
  }
  ok("群組有放的小類（髮色、瞳色、髮型）不出群組外的牌", leak.length === 0, leak.slice(0, 8));
  ok("群組的牌真的抽得到", hits > SEEDS.length, hits);
  ok("群組沒放的小類（髮長、身材…）照常補", other > SEEDS.length, other);
}

// 3. 服裝群組 10 件、服裝抽 3：先從群組抽
{
  const group = need(["serafuku", "pleated skirt", "thighhighs", "loafers", "hair ribbon", "cardigan", "sailor collar", "kneehighs", "red neckerchief", "school bag"].filter((t) => lex.byTag.has(t)));
  const s = { ...base({ rating: "general", heats: ["activity"], counts: { ...base().counts, clothing: 3 } }), groupPools: { clothing: group } };
  let fromGroup = 0, n = 0, groupSrc = 0;
  for (const seed of SEEDS) {
    const out = draw(s, seed);
    const src = sourceMap(out);
    const mine = out.sections.clothing.filter((t) => group.includes(t));
    fromGroup += mine.length;
    groupSrc += mine.filter((t) => src.get(t) === "group").length;
    n++;
  }
  ok(`服裝 3 張平均至少 2 張來自群組（平均 ${(fromGroup / n).toFixed(2)}）`, fromGroup / n >= 2, fromGroup / n);
  ok("群組抽到的牌出處記成 group", groupSrc > n, groupSrc);
}

// 4. 群組的牌全被分級擋掉：那一格照常從詞庫補，不會空掉，也不會冒出群組的牌
{
  const blocked = data.tags.filter((t) => t.section === "pose" && ratingBlocked(t, "general")).slice(0, 6).map((t) => t.tag);
  assert.ok(blocked.length >= 3, "要有全年齡擋掉的姿勢");
  const s = { ...base({ rating: "general", heats: ["activity"] }), groupPools: { pose: blocked } };
  let empty = 0, leaked = 0;
  for (const seed of SEEDS.slice(0, 80)) {
    const out = draw(s, seed);
    if (!out.sections.pose.length) empty++;
    if (out.sections.pose.some((t) => blocked.includes(t))) leaked++;
  }
  ok("群組被分級擋光：姿勢照常有", empty === 0, empty);
  ok("群組被分級擋光：被擋的牌不會出現", leaked === 0, leaked);
}

// 4b. 格子要夠細：群組只放睫毛，瞳色照常抽；只放髮帶，眼鏡、耳環照常抽
{
  const s = { ...base({ rating: "general", heats: ["activity"] }), groupPools: { feature: need(["eyelashes"]), clothing: need(["hair ribbon"]) } };
  let eyeColor = 0, otherAcc = 0;
  for (const seed of SEEDS) {
    const out = draw(s, seed);
    if (out.sections.feature.some((t) => lex.byTag.get(t)?.mutex === "eye_color")) eyeColor++;
    if (out.sections.clothing.some((t) => ["eyewear", "jewelry", "headwear"].includes(lex.byTag.get(t)?.mutex))) otherAcc++;
  }
  const plain = base({ rating: "general", heats: ["activity"] });
  let eyePlain = 0;
  for (const seed of SEEDS) if (draw(plain, seed).sections.feature.some((t) => lex.byTag.get(t)?.mutex === "eye_color")) eyePlain++;
  ok(`只放睫毛：瞳色照常（${eyeColor}/${SEEDS.length}，沒群組 ${eyePlain}）`, eyeColor >= eyePlain * 0.9, [eyeColor, eyePlain]);
  ok(`只放髮帶：眼鏡、耳環、頭飾照樣抽得到（${otherAcc}）`, otherAcc > 0, otherAcc);
}

// 4c. 群組的牌用掉了也不放行：長相群組只有一種髮型，整張圖的髮型（有互斥的那一格）都只能是它
{
  const s = { ...base({ rating: "general", heats: ["activity"], counts: { ...base().counts, feature: 10 } }), groupPools: { feature: need(["twintails"]) } };
  let other = 0;
  for (const seed of SEEDS) {
    const out = draw(s, seed);
    if (out.sections.feature.some((t) => t !== "twintails" && lex.byTag.get(t)?.mutex === "hair_style")) other++;
  }
  ok("群組那一格只出群組的牌（張數開到 10 也一樣）", other === 0, other);
}

// 4d. 連身＋上衣＋下著放同一組：每張穿一套（連身，或上衣＋下著），裙子不會每次被收尾拿掉（Grok 第二輪）
{
  const group = need(["dress", "shirt", "pleated skirt"]);
  const s = { ...base({ rating: "general", heats: ["activity"] }), groupPools: { clothing: group } };
  let dress = 0, skirt = 0, both = 0, plainTop = 0;
  for (const seed of SEEDS) {
    const c = draw(s, seed).sections.clothing;
    if (c.includes("dress")) dress++;
    if (c.includes("pleated skirt")) skirt++;
    if (c.includes("dress") && (c.includes("shirt") || c.includes("pleated skirt"))) both++;
    if (c.some((t) => t !== "shirt" && lex.byTag.get(t)?.mutex === "top")) plainTop++;
  }
  ok(`連身、上衣＋下著兩套都會出現（洋裝 ${dress}、百褶裙 ${skirt}）`, dress > 10 && skirt > 10, [dress, skirt]);
  ok("同一張不會連身又上衣下著", both === 0, both);
  ok("上衣格不冒出群組外的上衣", plainTop === 0, plainTop);
}

// 4e. 組內互擋（短髮擋雙馬尾）：髮型那格留空，不冒出群組外的髮型
{
  const group = need(["short hair", "twintails"]);
  const s = { ...base({ rating: "general", heats: ["activity"] }), groupPools: { feature: group } };
  let outside = 0;
  for (const seed of SEEDS) {
    const f = draw(s, seed).sections.feature;
    if (f.some((t) => t !== "twintails" && lex.byTag.get(t)?.mutex === "hair_style")) outside++;
  }
  ok("組內互擋時髮型不從詞庫補", outside === 0, outside);
}

// 4f. 群組管很多格時，長相張數不會比沒群組多很多（骨架格先花名額）
{
  const counts = { ...base().counts, feature: 5 };
  const many = need(["blonde hair", "blue eyes", "twintails", "long hair", "blush", "collarbone", "freckles", "mole under eye", "eyelashes", "thick eyebrows", "fang", "pointy ears"].filter((t) => lex.byTag.has(t)));
  const plain = base({ rating: "general", heats: ["activity"], counts });
  const s = { ...plain, groupPools: { feature: many } };
  let a = 0, b = 0;
  for (const seed of SEEDS.slice(0, 60)) {
    a += draw(plain, seed).sections.feature.length;
    b += draw(s, seed).sections.feature.length;
  }
  ok(`長相張數（沒群組 ${(a / 60).toFixed(2)}、有群組 ${(b / 60).toFixed(2)}）差不到 1.5 張`, b / 60 - a / 60 < 1.5, [a / 60, b / 60]);
}

// 4g. 有角色、長相只選「體型」一格（專案主 2026-11-16 回報：抽到角色時體型群組完全沒抽）：照樣從群組抽，而且群組每張都輪得到
{
  const tags = need(["perky breasts", "underboob", "backboob", "huge breasts", "large breasts"]);
  for (const chara of [false, true]) {
    let s0 = base({ rating: "sensitive", heats: ["tease"], drawCharacter: chara, counts: { ...base().counts, feature: 1 } });
    s0 = sanitizeSettings({ ...s0, ...stepSkeleton(s0, "feature", 1) }, data);
    s0 = sanitizeSettings({ ...s0, ...swapSkeleton(s0, "feature", "feature:body_f", skeletonLit(s0, "feature")[0]) }, data);
    const s = { ...s0, groupPools: { feature: tags } };
    let hit = 0;
    const seen = new Set();
    for (const seed of SEEDS.slice(0, 60)) {
      const f = draw(s, seed).sections.feature.filter((t) => tags.includes(t));
      if (f.length) hit++;
      f.forEach((t) => seen.add(t));
    }
    ok(`${chara ? "有角色" : "沒角色"}：體型那一格從群組抽（${hit}/60），群組 ${seen.size} 種都輪得到`, hit >= 57 && seen.size >= 4, [hit, [...seen]]);
  }
}

// 5. 釘選照留：釘了群組外的同小類牌，照樣在
{
  const s = { ...base({ rating: "general", heats: ["activity"] }), groupPools: { feature: need(["blonde hair"]) } };
  let kept = 0;
  for (const seed of SEEDS.slice(0, 40)) if (draw(s, seed, need(["black hair"])).sections.feature.includes("black hair")) kept++;
  ok("釘選不受群組影響", kept === 40, kept);
}

// 6. 抽牌前的解析：整組一起每張只用一組、同一顆種子固定；混著抽合在一起；刪掉、空的、別段的略過
{
  const groups = [
    { id: "g-a", name: "A", section: "feature", tags: ["blonde hair", "twintails"] },
    { id: "g-b", name: "B", section: "feature", tags: ["black hair", "long hair"] },
    { id: "g-e", name: "空", section: "feature", tags: [] },
    { id: "g-c", name: "衣", section: "clothing", tags: ["serafuku"] },
  ];
  const whole = { groups: { feature: { ids: ["g-a", "g-b", "g-e", "g-gone", "g-c"], mode: "whole" } } };
  const picked = new Set();
  let stable = true;
  for (const seed of SEEDS.slice(0, 40)) {
    const r = resolveGroupPools(whole, groups, seed);
    const again = resolveGroupPools(whole, groups, seed);
    if (JSON.stringify(r) !== JSON.stringify(again)) stable = false;
    picked.add(r.groupNames.feature.join());
    if (r.groupNames.feature.length !== 1) stable = false;
  }
  ok("整組一起：每張只用一組，同一顆種子固定", stable);
  ok("整組一起：不同種子兩組都會輪到（空的、刪掉的、別段的不算）", picked.size === 2 && picked.has("A") && picked.has("B"), [...picked]);
  const mix = resolveGroupPools({ groups: { feature: { ids: ["g-a", "g-b"], mode: "mix" } } }, groups, 1);
  ok("混著抽：兩組合在一起", mix.groupPools.feature.length === 4 && mix.groupNames.feature.join() === "A,B", mix);
  const same = { rating: "general" };
  ok("沒勾群組：withGroupPools 回傳同一個物件", withGroupPools(same, groups, 1) === same);
  ok("勾的都不能用：withGroupPools 回傳同一個物件", withGroupPools({ groups: { pose: { ids: ["g-a"] } } }, groups, 1).groupPools === undefined);
  ok("pickOf 預設整組一起", pickOf({}, "feature").mode === "whole");
}

// 7. 設定存讀：sanitizeSettings 留住勾選、丟掉壞的；沒勾就沒有這個欄位
{
  const s = sanitizeSettings({ ...defaultSettings(data), groups: { feature: { ids: ["g-a", "g-a", 5, ""], mode: "mix" }, quality: { ids: ["g-q"] }, env: { ids: [] } } }, data);
  ok("勾選存得住、去重、壞的丟掉、不認得的段落丟掉", JSON.stringify(s.groups) === JSON.stringify({ feature: { ids: ["g-a"], mode: "mix" } }), s.groups);
  ok("沒勾群組：設定裡沒有 groups", sanitizeSettings(defaultSettings(data), data).groups === undefined);
}

console.log(failed ? `${failed} failed` : "all ok");
process.exit(failed ? 1 : 0);
