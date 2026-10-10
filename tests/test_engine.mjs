#!/usr/bin/env node
/** Engine pin / imply tests. Failures print and exit 1. */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  applyBan,
  applyClear,
  applyPin,
  cycleTag,
  defaultSettings,
  contradictions,
  QUOTA_SECTIONS,
  drawOne,
  ERAS,
  identityPins,
  identityBans,
  isIdentityItem,
  heatMismatches,
  handUsageWarnings,
  itemFitsHeats,
  sanitizeSettings,
  sanitizeMustDraw,
  MUST_MAX,
  SCENE_MODES,
  sceneModeOf,
  indexLexicon,
  labelOf,
  missingPins,
  pinMissLine,
  clashLine,
  knownTags,
  mulberry32,
  isCharacter,
  CHARACTER_MAX,
  mutexSiblings,
  actionGarmentKeys,
  actionFitsClothes,
  placeFitsActs,
  placesInEra,
  parseWeighted,
  formatWeighted,
  insertTriggerAfterCast,
  toggleHeat,
  HEATS,
  sfwBlocked,
  explicitOnly,
  ratingBlocked,
  RATINGS,
  heatPresetOf,
  weightsForHeats,
  nextTagWeight,
  stepTagWeight,
  clampTagWeight,
  applyTagWeights,
  settleGenCard,
  FEMALE_COUNT,
  MALE_COUNT,
  hasFemale,
  hasMale,
  applyPresetTags,
  BUILTIN_PRESETS,
  sanitizePinPresets,
  sanitizePresetOwned,
  toggleNamedPreset,
  presetActive,
  presetState,
  sportHeatWarnings,
  sportPinWarnings,
  sportPlacePinWarnings,
  clearPresetTags,
  togglePresetTags,
  NEEDS_CONTEXT,
  CTX_PULLS_ACC,
} from "../web/engine.js";
import {
  SPORT_BUTTONS,
  SPORT_BY_ID,
  SPORT_ACT_PLACE,
  SPORT_IDENTITY,
  SPORT_PRESETS,
  SPORT_TAG_SCOPE,
  SPORT_VENUES,
  allSportTags,
  sportTagAllowed,
  sportOwnedTags,
  sportPresetTags,
} from "../web/sports.js";
import {
  supportCandidateAllowed,
  validateSupportShadow,
} from "../web/shadow-validator.js";

// 不依賴 bottom/onepiece slot、但確實遮到下半身的服裝。engine 有一份幾乎
// 一樣的清單；這份是手寫對照，故意不從 production 反射出來。
const LOWER_COVER = new Set([
  "dress", "school uniform", "leotard", "bodysuit", "skirt", "shorts", "pants",
  "swimsuit", "bikini", "one-piece swimsuit", "panties",
  "chinese clothes", "ancient greek clothes", "armor", "chainmail", "kimono",
  "japanese clothes", "yukata", "sportswear", "loincloth",
]);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(ROOT, "web/lexicon.json"), "utf8"));
const lex = indexLexicon(data);

let failed = 0;
function eq(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    failed += 1;
    console.error(`FAIL ${name}\n  got  ${a}\n  want ${b}`);
  } else console.log(`ok   ${name}`);
}
function ok(name, cond, detail) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${name}${detail ? "\n  " + detail : ""}`);
  } else console.log(`ok   ${name}`);
}

function settings() {
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  s.heats = ["tease", "flash", "sex"];
  return s;
}

// 「看得出是哪個時代」的嚴格判準：這個字屬於該時代，而且現代不會有。
//
// 不能用 engine 的 eraSpecific()：它只要求 era 清單裡有該時代且沒有 "any"，
// 而 skirt 的 era 是 ["modern","victorian","medieval","ancient_china"] ——
// 拿來當抽取偏好沒問題，拿來當「這張看得出是中世紀」就會自己騙自己。
// 第一版我就是這樣寫的，被自己加的對照組抓到（現代圖 6/30 誤判）。
function eraReadable(have, era) {
  for (const t of have) {
    const e = lex.byTag.get(t)?.era || [];
    if (e.length && !e.includes("any") && e.includes(era) && !e.includes("modern")) return true;
  }
  return false;
}

function tagsOf(drawn) {
  return new Set(drawn.positive.split(", ").map((t) => t.trim()));
}

function drawN(pinned, banned, n, seed0 = 1000) {
  const s = settings();
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(drawOne(lex, s, pinned, banned, mulberry32(seed0 + i), seed0 + i));
  }
  return out;
}

{
  const sibs = new Set(mutexSiblings(lex, "goblin"));
  ok("cached siblings: goblin mutexes orc", sibs.has("orc"));
  ok("cached siblings: goblin keeps monster boy", !sibs.has("monster boy"));
  const pool = lex.byMutex.get("feature:race") || [];
  ok("byMutex race pool has goblin", pool.some((it) => it.tag === "goblin"));
}

{
  const next = applyPin(lex, new Set(), new Set(["bikini"]), "micro bikini");
  ok(
    "pin micro after ban bikini unbans bikini",
    next.pinned.has("micro bikini") && next.pinned.has("bikini") && !next.userBanned.has("bikini"),
    `pinned=${[...next.pinned]} banned=${[...next.userBanned]}`
  );
}

{
  let pinned = new Set();
  let userBanned = new Set();
  ({ pinned, userBanned } = cycleTag(lex, pinned, userBanned, "bikini"));
  ({ pinned, userBanned } = cycleTag(lex, pinned, userBanned, "bikini"));
  ({ pinned, userBanned } = cycleTag(lex, pinned, userBanned, "micro bikini"));
  const draws = drawN(pinned, userBanned, 40);
  const miss = draws.filter((d) => missingPins(d.positive, pinned).includes("bikini"));
  const without = draws.filter((d) => !tagsOf(d).has("bikini") || !tagsOf(d).has("micro bikini"));
  eq("ban bikini then pin micro: missing bikini count", miss.length, 0);
  eq("ban bikini then pin micro: both in POS", without.length, 0);
}

{
  const pinned = new Set(["micro bikini"]);
  const draws = drawN(pinned, new Set(), 40, 2000);
  const without = draws.filter((d) => !tagsOf(d).has("bikini") || !tagsOf(d).has("micro bikini"));
  eq("pin micro only: implied bikini still in POS", without.length, 0);
}

{
  const pinned = new Set(["micro bikini", "bikini"]);
  const draws = drawN(pinned, new Set(), 20, 3000);
  const miss = draws.filter((d) => missingPins(d.positive, pinned).length);
  eq("pin both: no missing", miss.length, 0);
}

{
  const item = lex.byTag.get("sundress");
  if (item && (item.implies || []).includes("dress")) {
    const next = applyPin(lex, new Set(), new Set(["dress"]), "sundress");
    ok(
      "pin sundress after ban dress unbans dress",
      next.pinned.has("dress") && !next.userBanned.has("dress"),
      `pinned=${[...next.pinned]} banned=${[...next.userBanned]}`
    );
    const draws = drawN(next.pinned, next.userBanned, 20, 4000);
    const without = draws.filter((d) => !tagsOf(d).has("sundress") || !tagsOf(d).has("dress"));
    eq("pin sundress: dress in POS", without.length, 0);
  } else {
    console.log("skip sundress/dress (lexicon has no imply)");
  }
}

const WESTERN_CLOTHES = [
  "dress",
  "sundress",
  "wedding dress",
  "short dress",
  "shirt",
  "blouse",
  "jeans",
  "hoodie",
  "t-shirt",
  "bikini",
  "micro bikini",
  "miniskirt",
  "pants",
  "shorts",
  "school uniform",
  "sweater",
  "tank top",
  "necktie",
  "high heels",
  "lingerie",
  "bra",
  "panties",
  "evening gown",
  "lab coat",
  "sneakers",
  "yoga pants",
];
const MODERN_PLACES = [
  "pool",
  "office",
  "classroom",
  "train",
  "car interior",
  "elevator",
  "skyscraper",
  "neon lights",
  "cityscape",
  "love hotel",
];

function eraDraws(era, n = 60, seed0 = 9000) {
  const s = settings();
  s.eras = [era];
  s.girl = true;
  s.boy = false;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(drawOne(lex, s, new Set(), new Set(), mulberry32(seed0 + i), seed0 + i));
  }
  return out;
}

{
  const draws = eraDraws("ancient_china", 80, 9100);
  const hits = [];
  for (const d of draws) {
    const tags = tagsOf(d);
    if (d.era !== "ancient_china") hits.push("era=" + d.era);
    for (const t of WESTERN_CLOTHES) if (tags.has(t)) hits.push(t);
    for (const t of MODERN_PLACES) if (tags.has(t)) hits.push(t);
  }
  eq("ancient_china: no western clothes or modern places", [...new Set(hits)], []);
  const missingClothes = draws.filter((d) => {
    const t = tagsOf(d);
    const nude = t.has("nude") || t.has("completely nude");
    if (nude) return false;
    return !(t.has("chinese clothes") || t.has("hanfu") || t.has("ruqun"));
  });
  eq("ancient_china: era clothes when not nude", missingClothes.length, 0);
}

{
  const draws = eraDraws("edo", 40, 9200);
  const hits = [];
  for (const d of draws) {
    const tags = tagsOf(d);
    for (const t of ["dress", "bikini", "jeans", "hoodie", "school uniform"]) {
      if (tags.has(t)) hits.push(t);
    }
  }
  eq("edo: no western street clothes", [...new Set(hits)], []);
}

{
  const item = lex.byTag.get("cherry blossoms");
  eq("cherry blossoms mutex is weather", item?.mutex, "weather");
  ok("cherry blossoms is any-era", (item?.era || []).includes("any"));
  ok("cherry blossoms mutexes snow", mutexSiblings(lex, "cherry blossoms").includes("snow"));
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["edo"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  let cherry = 0;
  let both = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(94000 + i), 94000 + i));
    if (h.has("cherry blossoms")) cherry += 1;
    if (h.has("cherry blossoms") && h.has("snow")) both += 1;
  }
  ok("edo does not stamp cherry blossoms every draw", cherry < 20, `cherry=${cherry}/80`);
  eq("cherry blossoms never stacks with snow", both, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  s.eras = ["edo"];
  let shoji = 0;
  let tatami = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(94100 + i), 94100 + i));
    if (h.has("shoji")) shoji += 1;
    if (h.has("tatami")) tatami += 1;
  }
  ok("edo does not stamp shoji every leftover slot", shoji < 20, `shoji=${shoji}/80`);
  ok("edo does not stamp tatami every leftover slot", tatami < 20, `tatami=${tatami}/80`);
  s.eras = ["ancient_greece"];
  let pillar = 0;
  let marble = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(94200 + i), 94200 + i));
    if (h.has("pillar")) pillar += 1;
    if (h.has("marble")) marble += 1;
  }
  ok("greece does not stamp pillar every leftover slot", pillar < 20, `pillar=${pillar}/80`);
  ok("greece does not stamp marble every leftover slot", marble < 20, `marble=${marble}/80`);
}

{
  const temple = lex.byTag.get("temple");
  ok("temple is not a greek place", !((temple?.era || []).includes("ancient_greece")));
  ok("temple is chinese-era", (temple?.era || []).includes("ancient_china"));
  ok("temple is edo-era", (temple?.era || []).includes("edo"));
  const ASIAN_PLACE = [
    "temple",
    "shrine",
    "pagoda",
    "torii",
    "east asian architecture",
  ];
  const hits = [];
  for (const d of eraDraws("ancient_greece", 80, 94300)) {
    const h = tagsOf(d);
    for (const t of ASIAN_PLACE) if (h.has(t)) hits.push(t);
  }
  eq("ancient_greece: no east asian temples", [...new Set(hits)], []);
}

{
  let pinned = new Set(["bikini"]);
  let userBanned = new Set();
  const group = ["bikini", "dress", "shirt"];
  for (const t of group) {
    ({ pinned, userBanned } = applyBan(lex, pinned, userBanned, t));
  }
  ok(
    "ban group: all banned, pins cleared",
    group.every((t) => userBanned.has(t)) && !pinned.has("bikini"),
    `pinned=${[...pinned]} banned=${[...userBanned]}`
  );
  for (const t of group) {
    ({ pinned, userBanned } = applyClear(pinned, userBanned, t));
  }
  ok(
    "clear group: bans lifted",
    group.every((t) => !userBanned.has(t)),
    `banned=${[...userBanned]}`
  );
}

{
  const s = settings();
  s.girl = false;
  s.boy = false;
  s.eras = ["modern"];
  let boys = 0;
  for (let i = 0; i < 80; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(9300 + i), 9300 + i);
    if (hasMale([...tagsOf(d)])) boys += 1;
  }
  ok("both genders off still draws mixed (some boys)", boys > 0, `boys=${boys}/80`);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  let femFlag = 0;
  let femCloth = 0;
  let femFeat = 0;
  let breasts = 0;
  let soft = 0;
  let natural = 0;
  for (let i = 0; i < 50; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(12000 + i), 12000 + i);
    const have = tagsOf(d);
    if (d.female) femFlag += 1;
    if (have.has("soft breasts")) soft += 1;
    if (have.has("natural breasts")) natural += 1;
    for (const t of have) {
      const it = lex.byTag.get(t);
      if (it?.gate === "female" && it.section === "clothing") femCloth += 1;
      if (it?.gate === "female" && it.section === "feature") femFeat += 1;
      if (t.includes("breast")) breasts += 1;
    }
  }
  eq("girl-only sets female flag", femFlag, 50);
  ok("girl-only draws female clothing", femCloth > 0, `femCloth=${femCloth}`);
  ok("girl-only draws female features", femFeat > 0, `femFeat=${femFeat}`);
  ok("girl-only can draw breasts", breasts > 0, `breasts=${breasts}`);
  eq("girl-only never emits non-Danbooru soft breasts", soft, 0);
  eq("girl-only never emits non-Danbooru natural breasts", natural, 0);
  ok("soft breasts is absent from lexicon", !lex.byTag.has("soft breasts"));
  ok("natural breasts is absent from lexicon", !lex.byTag.has("natural breasts"));
}

{
  const s = settings();
  s.girl = false;
  s.boy = true;
  s.eras = ["modern"];
  let maleFlag = 0;
  let maleFeat = 0;
  let breastFeel = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(13000 + i), 13000 + i);
    const have = tagsOf(d);
    if (d.male) maleFlag += 1;
    if (have.has("soft breasts") || have.has("natural breasts")) breastFeel += 1;
    for (const t of have) {
      const it = lex.byTag.get(t);
      if (it?.gate === "male" && it.section === "feature") maleFeat += 1;
    }
  }
  eq("boy-only sets male flag", maleFlag, 40);
  ok("boy-only draws male features", maleFeat > 0, `maleFeat=${maleFeat}`);
  eq("boy-only has no breast feel tags", breastFeel, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["edo"];
  const hits = [];
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(14000 + i), 14000 + i);
    const tags = tagsOf(d);
    if (tags.has("armor")) {
      const era = lex.byTag.get("armor")?.era || [];
      if (!era.includes("edo") && !era.includes("any")) hits.push("armor");
    }
  }
  eq("edo does not pull medieval-only armor", hits.length, 0);
}

{
  ok(
    "white shirt does not mutex shirt",
    !mutexSiblings(lex, "white shirt").includes("shirt"),
    "siblings=" + mutexSiblings(lex, "white shirt").filter((t) => t.includes("shirt")).join(",")
  );
  ok(
    "white dress does not mutex dress",
    !mutexSiblings(lex, "white dress").includes("dress")
  );
  const pinShirt = applyPin(lex, new Set(), new Set(), "white shirt");
  ok("pin white shirt also pins shirt", pinShirt.pinned.has("shirt") && pinShirt.pinned.has("white shirt"));
  const dShirt = drawOne(
    lex,
    Object.assign(settings(), { eras: ["modern"], girl: true, boy: false }),
    pinShirt.pinned,
    new Set(),
    mulberry32(77),
    77
  );
  const have = tagsOf(dShirt);
  ok("white shirt draw keeps shirt", have.has("white shirt") && have.has("shirt"));
}

{
  ok(
    "cowgirl does not mutex umbrella sex",
    !mutexSiblings(lex, "cowgirl position").includes("sex")
  );
  const pin = applyPin(lex, new Set(), new Set(), "cowgirl position");
  ok("pin cowgirl also pins sex", pin.pinned.has("sex") && pin.pinned.has("cowgirl position"));
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  const d = drawOne(lex, s, pin.pinned, new Set(), mulberry32(88), 88);
  const have = tagsOf(d);
  ok("cowgirl draw keeps sex", have.has("cowgirl position") && have.has("sex"));
}

{
  const BODY = {
    "doggystyle": "all fours",
    "standing doggystyle": "standing",
    "standing sex": "standing",
    "full nelson": "standing",
    "suspended congress": "standing",
    "reverse suspended congress": "standing",
    "missionary": "on back",
    "mating press": "on back",
    "piledriver (sex)": "on back",
    "prone bone": "on stomach",
    "spooning": "on side",
    "cowgirl position": "sitting",
    "reverse cowgirl position": "sitting",
    "girl on top": "sitting",
    "upright straddle": "sitting",
    "reverse upright straddle": "sitting",
    "squatting cowgirl position": "squatting",
    "69": "lying",
    "sitting on face": "sitting",
  };
  for (const [act, pose] of Object.entries(BODY)) {
    ok(`${act} implies ${pose}`, (lex.byTag.get(act)?.implies || []).includes(pose));
  }
  ok(
    "fellatio does not imply a body pose",
    !(lex.byTag.get("fellatio")?.implies || []).some((t) => lex.byTag.get(t)?.mutex === "body_pose")
  );
  ok("sleeping heat has no sex", !(lex.byTag.get("sleeping")?.heat || []).includes("sex"));
  ok("dancing heat has no sex", !(lex.byTag.get("dancing")?.heat || []).includes("sex"));

  const pinDs = applyPin(lex, new Set(["standing"]), new Set(), "doggystyle");
  ok("pin doggystyle drops standing", !pinDs.pinned.has("standing"));
  ok("pin doggystyle pins all fours", pinDs.pinned.has("all fours"));

  const s = settings();
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  let clash = 0;
  let rest = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(41000 + i), 41000 + i));
    const present = Object.keys(BODY).filter((act) => h.has(act));
    const primary = present.filter(
      (act) => !present.some((o) => o !== act && (lex.byTag.get(o)?.implies || []).includes(act))
    );
    for (const act of primary) {
      if (!h.has(BODY[act])) clash += 1;
    }
    if (h.has("standing") && h.has("missionary")) clash += 1;
    if (h.has("sleeping") || h.has("dancing")) rest += 1;
  }
  eq("sex act keeps its body pose", clash, 0);
  eq("sex heat never sleeping or dancing", rest, 0);
}

{
  ok("pov implies looking at viewer", (lex.byTag.get("pov")?.implies || []).includes("looking at viewer"));
  ok(
    "pov crotch implies looking at viewer",
    (lex.byTag.get("pov crotch")?.implies || []).includes("looking at viewer")
  );
  const pinPov = applyPin(lex, new Set(["looking at another"]), new Set(), "pov");
  ok("pin pov pins looking at viewer", pinPov.pinned.has("looking at viewer"));
  ok("pin pov drops looking at another", !pinPov.pinned.has("looking at another"));

  const s = settings();
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  let pairPov = 0;
  for (let i = 0; i < 80; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(43000 + i), 43000 + i);
    const h = tagsOf(d);
    if (d.people >= 2 && (h.has("pov") || h.has("pov crotch"))) pairPov += 1;
  }
  eq("unpinned pair sex never auto-draws pov", pairPov, 0);

  const pinOnly = applyPin(lex, new Set(), new Set(), "pov").pinned;
  let extraBoy = 0;
  let missLook = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinOnly, new Set(), mulberry32(43100 + i), 43100 + i);
    const h = tagsOf(d);
    if (h.has("1boy") || d.people >= 2) extraBoy += 1;
    if (!h.has("looking at viewer")) missLook += 1;
  }
  eq("pinned pov mixed sex stays one visible person", extraBoy, 0);
  eq("pinned pov keeps looking at viewer", missLook, 0);

  const both = applyPin(lex, new Set(["1girl", "1boy"]), new Set(), "pov").pinned;
  const dBoth = drawOne(lex, s, both, new Set(), mulberry32(43200), 43200);
  const hBoth = tagsOf(dBoth);
  ok("explicit 1girl+1boy+pov keeps both", hBoth.has("1girl") && hBoth.has("1boy") && hBoth.has("pov"));

  const cgPov = applyPin(lex, applyPin(lex, new Set(), new Set(), "cowgirl position").pinned, new Set(), "pov").pinned;
  const dCg = drawOne(lex, s, cgPov, new Set(), mulberry32(43300), 43300);
  const hCg = tagsOf(dCg);
  ok("cowgirl+pov keeps cowgirl", hCg.has("cowgirl position"));
  ok("cowgirl+pov has no visible boy", !hCg.has("1boy"));
  // 2026-10-09：胸部互動進池後，這顆種子抽到背景人群 people。
  // 引擎因此寫 solo focus、拿掉 solo。畫面上仍是一個女生，沒有男生。
  ok("cowgirl+pov is solo", hCg.has("solo") || hCg.has("solo focus"));
  ok("cowgirl+pov looks at viewer", hCg.has("looking at viewer"));
}

{
  const pull = lex.byTag.get("dress pull");
  ok(
    "dress pull is pose not onepiece",
    pull && pull.section === "pose" && pull.mutex !== "onepiece",
    JSON.stringify({ section: pull?.section, mutex: pull?.mutex })
  );
  const ds = lex.byTag.get("dress shirt");
  ok(
    "dress shirt is a shirt (top)",
    ds && ds.mutex === "top" && (ds.implies || []).includes("shirt"),
    JSON.stringify({ mutex: ds?.mutex, implies: ds?.implies })
  );
}

{
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  let pinned = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  pinned = applyPin(lex, pinned, new Set(), "1boy").pinned;
  let both = 0;
  let onepieceClash = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(16000 + i), 16000 + i);
    const have = tagsOf(d);
    if (have.has("sex") && (have.has("cowgirl position") || have.has("girl on top") || have.has("vaginal") || have.has("oral") || have.has("doggystyle"))) {
      both += 1;
    }
    if (have.has("competition swimsuit") && have.has("one-piece swimsuit") && have.has("blue one-piece swimsuit")) {
      onepieceClash += 1;
    }
    if (d.conflicts.some((c) => c[0] === "onepiece")) onepieceClash += 1;
  }
  ok("pair+sex heat can draw sex with a position", both > 0, `both=${both}/40`);
  eq("no onepiece child-child clash", onepieceClash, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["medieval"];
  s.lockScene = false;
  s.sceneMode = "weird";
  // 2026-09-15：時代錨如果佔住 place 這一格，就會把場地那一格整個吃掉
  // （奇葩模式 castle 100%）。改成 35% 機率之後，castle/armor 這兩個字不再是
  // 每張都有 —— 但要守的東西從來不是「這兩個字」，是「看得出是中世紀」。
  // 實跑掉出來的那幾張是 cloak/tent/oil lamp/tower 和 cloak/palace/candelabra，
  // 中世紀得很。所以改成驗那個性質：這比原本只認兩個字涵蓋更廣，不是把尺改短。
  const medievalSignal = (have) => eraReadable(have, "medieval");
  const pinned = applyPin(lex, new Set(), new Set(), "bikini").pinned;
  let modern = 0;
  let missingAnchor = 0;
  let missingBikini = 0;
  for (let i = 0; i < 30; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(17000 + i), 17000 + i);
    if (d.era !== "medieval") modern += 1;
    const have = tagsOf(d);
    if (!have.has("bikini")) missingBikini += 1;
    if (!medievalSignal(have)) missingAnchor += 1;
  }
  eq("exclusive medieval beats bikini pin for era", modern, 0);
  eq("medieval + bikini pin still has bikini", missingBikini, 0);
  eq("medieval + bikini pin 仍看得出是中世紀", missingAnchor, 0);
  // 對照組：這條斷言真的會紅嗎？現代的圖不該有任何中世紀訊號。
  {
    const m = settings();
    m.girl = true;
    m.boy = false;
    m.eras = ["modern"];
    let falsePositive = 0;
    for (let i = 0; i < 30; i++) {
      if (medievalSignal(tagsOf(drawOne(lex, m, new Set(), new Set(), mulberry32(17500 + i), 17500 + i)))) {
        falsePositive += 1;
      }
    }
    eq("對照組：現代的圖不會被誤判成有中世紀訊號", falsePositive, 0);
  }
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  let hair = 0;
  let eyes = 0;
  let breasts = 0;
  let body = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(18000 + i), 18000 + i);
    const have = tagsOf(d);
    if ([...have].some((t) => lex.byTag.get(t)?.mutex === "hair_color")) hair += 1;
    if ([...have].some((t) => lex.byTag.get(t)?.mutex === "eye_color")) eyes += 1;
    if ([...have].some((t) => lex.byTag.get(t)?.mutex === "breast_size")) breasts += 1;
    if (
      // 跟下面「flash always has a body garment」同一個修正：用 mutex 判主衣是錯的，
      // dress／shirt／skirt／kimono／sportswear 的 mutex 全是 null。改看是不是
      // 遮身體的那一層。門檻沒動（還是 >=36），修的是判準：同一批種子下
      // 舊判準 35/40、新判準 39/40，而剩下那一張真的只穿內衣。
      [...have].some((t) => {
        const it = lex.byTag.get(t);
        if (!it || it.layer !== "garment") return false;
        return !["underwear", "legs", "feet"].includes(it.group);
      })
    ) {
      body += 1;
    }
  }
  ok("modern girl usually has hair color", hair >= 36, `hair=${hair}/40`);
  ok("modern girl usually has eye color", eyes >= 36, `eyes=${eyes}/40`);
  ok("modern girl usually has breast size", breasts >= 36, `breasts=${breasts}/40`);
  ok("modern tease usually has a body garment", body >= 36, `body=${body}/40`);
}

{
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  let pinned = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  pinned = applyPin(lex, pinned, new Set(), "1boy").pinned;
  let acts = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(18100 + i), 18100 + i);
    const have = tagsOf(d);
    if (
      [...have].some((t) => {
        const it = lex.byTag.get(t);
        return t === "sex" || it?.mutex === "sex_act";
      })
    ) {
      acts += 1;
    }
  }
  ok("pair sex heat usually has a sex act", acts >= 32, `acts=${acts}/40`);
}

{
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  let pinned = applyPin(lex, new Set(), new Set(), "micro bikini").pinned;
  pinned = applyPin(lex, pinned, new Set(), "1girl").pinned;
  pinned = applyPin(lex, pinned, new Set(), "1boy").pinned;
  let sexHeat = 0;
  let acts = 0;
  let keptBikini = 0;
  for (let i = 0; i < 20; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(19100 + i), 19100 + i);
    if (d.heat === "sex") sexHeat += 1;
    const have = tagsOf(d);
    if (have.has("micro bikini")) keptBikini += 1;
    if ([...have].some((t) => t === "sex" || lex.byTag.get(t)?.mutex === "sex_act")) acts += 1;
  }
  ok("sex-only heat stays sex when micro bikini is pinned", sexHeat === 20, `sexHeat=${sexHeat}/20`);
  ok("pinned micro bikini still enters sex draws", keptBikini === 20, `bikini=${keptBikini}/20`);
  ok("sex-only + pair + bikini pin still gets a sex act", acts >= 16, `acts=${acts}/20`);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["tease", "flash"];
  s.weights = { tease: 0.5, flash: 0.5, sex: 0 };
  const pinned = applyPin(lex, new Set(), new Set(), "flashing").pinned;
  let flash = 0;
  for (let i = 0; i < 20; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(19200 + i), 19200 + i);
    if (d.heat === "flash") flash += 1;
  }
  ok("tease+flash allowlist + flashing pin still rolls flash", flash === 20, `flash=${flash}/20`);
}

{
  const has = (tag, h) => (lex.byTag.get(tag)?.heat || []).includes(h);
  ok("micro bikini allows sex", has("micro bikini", "sex"));
  ok("bikini allows sex", has("bikini", "sex"));
  ok("dress allows sex", has("dress", "sex"));
  ok("undressing allows sex", has("undressing", "sex"));
  ok("flashing allows sex", has("flashing", "sex"));
  ok("one eye closed allows sex", has("one eye closed", "sex"));
  ok("indian style allows sex", has("indian style", "sex"));
  ok("bed allows tease", has("bed", "tease"));
  ok("torii allows sex", has("torii", "sex"));
  ok("wet hair allows sex", has("wet hair", "sex"));
  ok("nude allows tease", has("nude", "tease"));
  ok("nude allows flash", has("nude", "flash"));
  ok("nude allows sex", has("nude", "sex"));
  ok("completely nude allows tease", has("completely nude", "tease"));
  ok("sex toy stays sex-only", JSON.stringify(lex.byTag.get("sex toy")?.heat) === '["sex"]');
  ok("ahegao stays sex-only", JSON.stringify(lex.byTag.get("ahegao")?.heat) === '["sex"]');
}

{
  const pinned = applyPin(lex, new Set(), new Set(), "micro bikini").pinned;
  ok("sex-only does not clash with micro bikini", !heatMismatches(lex, pinned, ["sex"]).includes("micro bikini"));
  ok("sex-only does not clash with undressing", !heatMismatches(lex, applyPin(lex, new Set(), new Set(), "undressing").pinned, ["sex"]).includes("undressing"));
  ok("tease-only clash lists fellatio", heatMismatches(lex, applyPin(lex, new Set(), new Set(), "fellatio").pinned, ["tease"]).includes("fellatio"));
  ok("tease-only does not clash with nude", !heatMismatches(lex, applyPin(lex, new Set(), new Set(), "nude").pinned, ["tease"]).includes("nude"));
  // 2026-09-15：「活動」這一檔沒有自己的池子 —— 詞庫裡沒有任何一個字的 heat
  // 含 "activity"，所以它只能借 tease 的。整池照收的話，面板那句「只勾活動＝日常，
  // 沒有走光或做愛」就是假的：實測只勾活動 1200 張，naked coat 90、netorare 5、
  // paizuri gesture 4。現在池子照借，情色內容扣掉。
  //
  // 但**裸體是例外**：泡溫泉沒穿衣服是場景決定的，不是尺度決定的。所以 nude
  // 跟「只勾活動」仍然不衝突，這條原本的斷言維持不變 —— 我中途一度把它翻面，
  // 是因為第一版連 layer=skin 一起擋掉，那是我的錯不是它的錯。
  {
    const nudePin = applyPin(lex, new Set(), new Set(), "nude").pinned;
    ok("activity-only does not clash with nude", !heatMismatches(lex, nudePin, ["activity"]).includes("nude"));
    // 但明確不是日常的東西就該提示：裸身外套、微型比基尼不是去買菜穿的。
    ok("activity-only 釘 naked coat 會提示尺度對不上",
       heatMismatches(lex, applyPin(lex, new Set(), new Set(), "naked coat").pinned, ["activity"]).includes("naked coat"));
    const s2 = settings();
    s2.girl = true;
    s2.boy = false;
    s2.rating = "explicit";
    s2.heats = ["activity"];
    let lost = 0;
    for (let i = 1; i <= 60; i++) {
      if (!tagsOf(drawOne(lex, s2, applyPin(lex, new Set(), new Set(), "naked coat").pinned, new Set(), mulberry32(i * 19), i * 19)).has("naked coat")) lost += 1;
    }
    eq("activity-only 釘了仍然一定進圖（提示歸提示，釘選不動）", lost, 0);
    // 沒釘的時候才擋：日常不該自己冒出裸身外套或 netorare。
    let leaked = 0;
    for (let i = 1; i <= 200; i++) {
      const h = tagsOf(drawOne(lex, s2, new Set(), new Set(), mulberry32(i * 23), i * 23));
      if (h.has("naked coat") || h.has("netorare") || h.has("groping")) leaked += 1;
    }
    eq("activity-only 沒釘就不會自己冒出情色內容", leaked, 0);
  }
  ok("shopping is available in activity-only", itemFitsHeats(lex.byTag.get("shopping"), ["activity"]));
  ok("bathing is available in activity-only", itemFitsHeats(lex.byTag.get("bathing"), ["activity"]));
  ok("cowgirl is not available in activity-only", !itemFitsHeats(lex.byTag.get("cowgirl position"), ["activity"]));
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["edo"];
  let day = 0;
  let maleHair = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(18200 + i), 18200 + i);
    const have = tagsOf(d);
    if ([...have].some((t) => lex.byTag.get(t)?.mutex === "day_night")) day += 1;
    if (have.has("male pubic hair")) maleHair += 1;
  }
  ok("edo usually has day or night", day >= 36, `day=${day}/40`);
  eq("girl-only does not draw male pubic hair", maleHair, 0);
}

{
  const kinds = [];
  const combos = [
    { girl: true, boy: false, eras: ["modern"], heats: ["tease", "flash", "sex"] },
    { girl: true, boy: false, eras: ["ancient_china"], heats: ["sex"] },
    { girl: false, boy: true, eras: ["edo"], heats: ["tease", "flash"] },
    { girl: true, boy: true, eras: ["medieval"], heats: ["flash"] },
    { girl: true, boy: false, eras: ["victorian"], heats: ["tease"] },
    { girl: true, boy: true, eras: ["ancient_greece"], heats: ["tease", "flash", "sex"] },
  ];
  for (const combo of combos) {
    const s = settings();
    Object.assign(s, combo);
    for (let i = 0; i < 25; i++) {
      const d = drawOne(lex, s, new Set(), new Set(), mulberry32(15000 + i), 15000 + i);
      if (d.conflicts.length) kinds.push("conflict:" + JSON.stringify(d.conflicts[0]));
      const set = tagsOf(d);
      if (set.has("solo") && (set.has("2girls") || set.has("2boys") || set.has("3girls"))) {
        kinds.push("solo_multi");
      }
      if (set.has("indoors") && set.has("outdoors")) kinds.push("in_out");
      if (set.has("day") && set.has("night")) kinds.push("day_night");
      const hasGirl = [...set].some((t) => FEMALE_COUNT.has(t));
      const hasBoy = [...set].some((t) => MALE_COUNT.has(t));
      for (const t of set) {
        const it = lex.byTag.get(t);
        if (!it) continue;
        if (it.gate === "female" && !hasGirl) kinds.push("fem_gate:" + t);
        if (it.gate === "male" && !hasBoy) kinds.push("male_gate:" + t);
        const er = it.era;
        if (er && er.length && !er.includes("any") && !er.includes(d.era)) {
          kinds.push("era:" + t + "@" + d.era);
        }
      }
    }
  }
  eq("scan: no contradictions across eras/heats", [...new Set(kinds)], []);
}

const PRE_MODERN = ["ancient_china", "ancient_greece", "medieval", "edo"];
const MODERN_ONLY = [
  "gaming chair",
  "swivel chair",
  "office chair",
  "living room",
  "bathroom",
  "kitchen",
  "bathtub",
  "ceiling light",
  "city lights",
  "pool ladder",
  "beach towel",
  "restaurant",
  "watch",
  "hard hat",
  "police hat",
  "vibrator",
  "egg vibrator",
  "handbag",
  "beach umbrella",
  "no bra",
  "no panties",
  "panties aside",
  "bra pull",
  "panty pull",
  "hand in panties",
  "sports bra lift",
  "shirt lift",
  "blue necktie",
  "black necktie",
  "black bowtie",
  "blue bodysuit",
  "black leotard",
  "power armor",
  "detached collar",
];

{
  for (const tag of MODERN_ONLY) {
    const item = lex.byTag.get(tag);
    const era = item?.era || [];
    ok(
      `${tag} is not any-era`,
      item && era.length && !era.includes("any"),
      `${tag} era=${JSON.stringify(era)}`
    );
    ok(
      `${tag} does not leak into pre-modern`,
      era.every((e) => !PRE_MODERN.includes(e)),
      `${tag} era=${JSON.stringify(era)}`
    );
  }
}

{
  const leaks = [];
  for (const era of PRE_MODERN) {
    const s = settings();
    s.girl = true;
    s.boy = true;
    s.eras = [era];
    s.heats = ["tease", "flash", "sex"];
    for (let i = 0; i < 50; i++) {
      const d = drawOne(lex, s, new Set(), new Set(), mulberry32(21000 + i), 21000 + i);
      const have = tagsOf(d);
      for (const tag of MODERN_ONLY) {
        if (have.has(tag)) leaks.push(era + ":" + tag);
      }
    }
  }
  eq("pre-modern draws never pick modern furniture/clothes/poses", [...new Set(leaks)], []);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["medieval"];
  s.lockScene = false;
  s.sceneMode = "weird";
  const pinned = applyPin(lex, new Set(), new Set(), "sports bra").pinned;
  let chair = 0;
  let missingBra = 0;
  let missingCastle = 0;
  for (let i = 0; i < 30; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(22000 + i), 22000 + i);
    const have = tagsOf(d);
    if (have.has("gaming chair") || have.has("swivel chair")) chair += 1;
    // sports bra 不再連帶 bra：Danbooru 上 sports_bra 沒有任何 implication，
    // 顏色款也只 implies sports_bra。運動內衣在他們的分類裡不是 bra。
    if (!have.has("sports bra")) missingBra += 1;
    // 同上：驗「看得出是中世紀」，不是驗那兩個字。
    if (!eraReadable(have, "medieval")) missingCastle += 1;
    if (d.era !== "medieval") chair += 1;
  }
  eq("medieval + sports bra pin still medieval", chair, 0);
  eq("medieval + sports bra pin keeps sports bra", missingBra, 0);
  eq("medieval + sports bra pin 仍看得出是中世紀", missingCastle, 0);
}

{
  eq("shirt sits with tops, not accessories", lex.byTag.get("shirt")?.group, "top");
  eq("bikini sits with one-piece", lex.byTag.get("bikini")?.group, "onepiece");
  eq("hanfu sits in era clothes", lex.byTag.get("hanfu")?.group, "era");
  eq("kimono sits in era clothes", lex.byTag.get("kimono")?.group, "era");
  eq("chinese clothes sits in era clothes", lex.byTag.get("chinese clothes")?.group, "era");
  eq("earrings stay accessories", lex.byTag.get("earrings")?.group, "acc");
  eq("white shirt stays top", lex.byTag.get("white shirt")?.group, "top");
  eq("ponytail is hair style", lex.byTag.get("ponytail")?.group, "hair_style");
  eq("wavy hair is hair style", lex.byTag.get("wavy hair")?.group, "hair_style");
  eq("pubic hair is not a hair style", lex.byTag.get("pubic hair")?.group, "body_f");
  eq("female pubic hair is not a hair style", lex.byTag.get("female pubic hair")?.group, "body_f");
  eq("male pubic hair is not a hair style", lex.byTag.get("male pubic hair")?.group, "body_m");
  eq("leg hair is not a hair style", lex.byTag.get("leg hair")?.group, "body_m");
  eq("facial hair is not a hair style", lex.byTag.get("facial hair")?.group, "body_m");
  eq("grabbing another's hair is a sex pose, not a hair style", lex.byTag.get("grabbing another's hair")?.group, "sex");
  eq("hair flower is not a hair style", lex.byTag.get("hair flower")?.group, "other");
  eq("wet hair is not a hair style", lex.byTag.get("wet hair")?.group, "skin");
  eq("two-tone hair sits with hair color", lex.byTag.get("two-tone hair")?.group, "hair_color");
  ok("pubic hair is not identity", !isIdentityItem(lex.byTag.get("pubic hair")));
  ok("ponytail is identity", isIdentityItem(lex.byTag.get("ponytail")));
  ok(
    "sex preset is sex-only",
    data.heatWeights.sex.sex === 1 && data.heatWeights.sex.tease === 0 && data.heatWeights.sex.flash === 0
  );
  ok("flash preset exists", data.heatWeights.flash && data.heatWeights.flash.flash === 1);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  let garments = 0;
  let accessories = 0;
  let styles = 0;
  let poses = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(19000 + i), 19000 + i);
    const have = tagsOf(d);
    if ([...have].some((t) => lex.byTag.get(t)?.group === "hair_style")) styles += 1;
    if ([...have].some((t) => lex.byTag.get(t)?.mutex === "body_pose")) poses += 1;
    for (const t of have) {
      const it = lex.byTag.get(t);
      if (!it || it.section !== "clothing") continue;
      if (it.layer === "skin") continue;
      if (it.layer === "accessory") accessories += 1;
      else if (it.layer === "garment") garments += 1;
    }
  }
  ok("modern tease draws more garments than accessories", garments > accessories, `garments=${garments} acc=${accessories}`);
  ok("modern tease usually has a hair style", styles >= 32, `styles=${styles}/40`);
  ok("modern tease usually has a body pose", poses >= 32, `poses=${poses}/40`);
}

function indoorOutdoorClash(have) {
  const names = have;
  const indoor = names.has("indoors");
  const outdoor = names.has("outdoors");
  if (indoor && outdoor) return "both in_out";
  for (const t of names) {
    const it = lex.byTag.get(t);
    const impl = it?.implies || [];
    if (impl.includes("indoors") && outdoor) return t + "+outdoors";
    if (impl.includes("outdoors") && indoor) return t + "+indoors";
  }
  return null;
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const hits = [];
  const extraBodies = [];
  for (let i = 0; i < 50; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(23000 + i), 23000 + i);
    const have = tagsOf(d);
    const clash = indoorOutdoorClash(have);
    if (clash) hits.push(clash);
    const one = [...have].find((t) => lex.byTag.get(t)?.mutex === "onepiece");
    if (one) {
      // extra !== one：這四個字本身也可能是那件主衣。以前 leotard 沒有互斥格，
      // 所以永遠不會被選成 one；補回互斥格之後它會自己撞自己，報出
      // 「leotard + leotard」這種假失敗（實際輸出是 leotard + cardigan，沒問題）。
      for (const extra of ["leotard", "pants", "skirt", "shirt"]) {
        if (extra !== one && have.has(extra) && !(lex.byTag.get(one)?.implies || []).includes(extra)) {
          extraBodies.push(one + "+" + extra);
        }
      }
    }
  }
  eq("modern tease: no indoor place with outdoors", [...new Set(hits)], []);
  eq("modern tease: onepiece does not stack unrelated umbrellas", [...new Set(extraBodies)], []);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["edo"];
  s.heats = ["flash"];
  s.weights = { tease: 0, flash: 1, sex: 0 };
  let penis = 0;
  let lookOther = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(23100 + i), 23100 + i);
    const have = tagsOf(d);
    if (have.has("penis on ass")) penis += 1;
    if (have.has("looking at another") && have.has("solo")) lookOther += 1;
  }
  eq("girl-only flash does not draw penis on ass", penis, 0);
  eq("solo does not look at another", lookOther, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  let pairs = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(23200 + i), 23200 + i);
    if (d.people >= 2) pairs += 1;
  }
  ok("sex heat with both genders usually draws a pair", pairs >= 28, `pairs=${pairs}/40`);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease", "flash", "sex"];
  const hits = [];
  for (let i = 0; i < 50; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(24000 + i), 24000 + i);
    const have = tagsOf(d);
    if ([...have].some((t) => MALE_COUNT.has(t))) {
      hits.push("cast:" + [...have].filter((t) => MALE_COUNT.has(t)).join(","));
    }
    for (const t of have) {
      const it = lex.byTag.get(t);
      if (it?.gate === "male") hits.push("gate:" + t);
    }
    if (have.has("clothed male nude female") || have.has("clothed female nude male")) hits.push("clothed-cross");
  }
  eq("girl-only never draws a boy or male-gated tag", [...new Set(hits)], []);
}

{
  ok("goblin mutexes orc", mutexSiblings(lex, "goblin").includes("orc"));
  ok("goblin does not mutex monster boy", !mutexSiblings(lex, "goblin").includes("monster boy"));
  const pin = applyPin(lex, new Set(), new Set(), "goblin");
  ok("pin goblin also pins monster boy", pin.pinned.has("goblin") && pin.pinned.has("monster boy"));
  const s = settings();
  s.girl = false;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  s.sceneMode = "diverse";
  let races = 0;
  let clash = 0;
  let girlGob = 0;
  for (let i = 0; i < 80; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(25000 + i), 25000 + i);
    const have = tagsOf(d);
    const got = [...have].filter((t) => lex.byTag.get(t)?.mutex === "race");
    if (got.length) races += 1;
    if (got.length > 1) clash += 1;
  }
  const sg = settings();
  sg.girl = true;
  sg.boy = false;
  sg.eras = ["modern"];
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, sg, new Set(), new Set(), mulberry32(25100 + i), 25100 + i);
    if (tagsOf(d).has("goblin") || tagsOf(d).has("orc") || tagsOf(d).has("wolf boy")) girlGob += 1;
  }
  const pinnedDraw = drawOne(
    lex,
    s,
    applyPin(lex, new Set(), new Set(), "orc").pinned,
    new Set(),
    mulberry32(99),
    99
  );
  const ph = tagsOf(pinnedDraw);
  ok("boy-only sometimes draws a race", races >= 8 && races <= 55, `races=${races}/80`);
  eq("never two race tags at once", clash, 0);
  eq("girl-only does not draw male races", girlGob, 0);
  ok("pin orc stays orc not goblin", ph.has("orc") && !ph.has("goblin"), [...ph].filter((t) => lex.byTag.get(t)?.mutex === "race").join(","));
}

{
  ok("fat man mutexes muscular male", mutexSiblings(lex, "fat man").includes("muscular male"));
  ok("fat man mutexes plump", mutexSiblings(lex, "fat man").includes("plump"));
  ok("fat man does not mutex otaku", !mutexSiblings(lex, "fat man").includes("otaku"));
  ok("fat man does not mutex ugly bastard", !mutexSiblings(lex, "fat man").includes("ugly bastard"));
  // 原本這兩條用 nerd/otaku。nerd 在 Danbooru 是 0 張、2026-09-18 移除，
  // 所以換成同型的 coke-bottle glasses/glasses —— 守的是同一件事：
  // 父子相依不互斥，而且釘子項會連父項一起釘。
  ok("coke-bottle glasses does not mutex glasses", !mutexSiblings(lex, "coke-bottle glasses").includes("glasses"));
  const pinCoke = applyPin(lex, new Set(), new Set(), "coke-bottle glasses");
  ok("pin coke-bottle glasses also pins glasses", pinCoke.pinned.has("coke-bottle glasses") && pinCoke.pinned.has("glasses"));
  const pinFat = applyPin(lex, new Set(), new Set(), "fat man");
  ok("pin fat man also pins fat", pinFat.pinned.has("fat") && pinFat.pinned.has("fat man"));
  const s = settings();
  s.girl = false;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const dFat = drawOne(lex, s, pinFat.pinned, new Set(), mulberry32(101), 101);
  const haveFat = tagsOf(dFat);
  ok("pin fat man keeps fat man", haveFat.has("fat man") && haveFat.has("fat"));
  ok("pin fat man drops muscle", !haveFat.has("muscular male") && !haveFat.has("bara") && !haveFat.has("toned male"));
  let girlUgly = 0;
  const sg = settings();
  sg.girl = true;
  sg.boy = false;
  sg.eras = ["modern"];
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, sg, new Set(), new Set(), mulberry32(25200 + i), 25200 + i);
    const h = tagsOf(d);
    if (h.has("ugly bastard") || h.has("fat man") || h.has("otaku")) girlUgly += 1;
  }
  eq("girl-only does not draw ugly/fat/otaku men", girlUgly, 0);
}

{
  ok("cowboy shot is not a female count", !FEMALE_COUNT.has("cowboy shot") && !hasFemale(["cowboy shot"]));
  ok("cowboy shot is not a male count", !MALE_COUNT.has("cowboy shot") && !hasMale(["cowboy shot"]));
  ok("1boy counts as male", hasMale(["1boy"]) && !hasMale(["girl on top"]));
}

{
  ok("dutch angle is in lexicon", lex.byTag.has("dutch angle"));
  ok("light smile is in lexicon", lex.byTag.has("light smile"));
  eq("dutch angle mutex", lex.byTag.get("dutch angle")?.mutex, "camera");
  // 原本問 looking away（2023-06 被 Danbooru 停用改標，2026-09-18 移除），
  // 換成它的替代字 averting eyes —— 同一格、同一件事。
  eq("averting eyes mutex", lex.byTag.get("averting eyes")?.mutex, "gaze");
  ok("dutch angle mutexes cowboy shot", mutexSiblings(lex, "dutch angle").includes("cowboy shot"));
  eq("smile mutex", lex.byTag.get("smile")?.mutex, "expression");
  ok("smile mutexes frown", mutexSiblings(lex, "smile").includes("frown"));
  ok("smile does not mutex one eye closed", !mutexSiblings(lex, "smile").includes("one eye closed"));
  const pinSmile = applyPin(lex, new Set(), new Set(), "light smile");
  ok("light smile keeps smile", pinSmile.pinned.has("light smile") && pinSmile.pinned.has("smile"));
  // 原本驗的是 extreme close-up -> close-up。extreme close-up 是自創字（Danbooru
  // 查無，close-up 才是真的，63,844 篇），已移除；這條要守的「釘子標籤會一起釘上
  // implies 的父標籤」仍然成立，改用一對還活著的來驗，覆蓋沒有減少。
  const pinHoop = applyPin(lex, new Set(), new Set(), "hoop earrings");
  ok("pin hoop earrings also pins earrings", pinHoop.pinned.has("hoop earrings") && pinHoop.pinned.has("earrings"));
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  let faces = 0;
  let twoCam = 0;
  let twoMood = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(27000 + i), 27000 + i);
    const h = tagsOf(d);
    const cams = [...h].filter((t) => lex.byTag.get(t)?.mutex === "camera");
    if (cams.length > 1) {
      const keep = cams.filter((t) => !cams.some((o) => o !== t && (lex.byTag.get(t)?.implies || []).includes(o)));
      if (keep.length > 1) twoCam += 1;
    }
    const moods = [...h].filter((t) => lex.byTag.get(t)?.mutex === "expression");
    const moodRoots = moods.filter(
      (t) => !moods.some((o) => o !== t && (lex.byTag.get(o)?.implies || []).includes(t))
    );
    if (moodRoots.length > 1) twoMood += 1;
    if ([...h].some((t) => lex.byTag.get(t)?.group === "face")) faces += 1;
  }
  eq("tease never two camera frames", twoCam, 0);
  eq("tease never two mood expressions", twoMood, 0);
  ok("modern tease usually has an expression", faces >= 28, `faces=${faces}/40`);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  // 承諾是「誘惑尺度不會硬脫光」，但**洗澡當下例外** —— 那是既有且刻意的行為
  // （泡澡不穿袍子）。原本這條寫成「40 張裡全裸 0 張」，而它會過只是因為
  // seed 26000～26039 剛好沒有一顆落在浴場：擴大到 6000 張量出來全裸 32 張，
  // **32 張全部在浴場、浴場外 0 張**。規則沒破，是斷言表達錯了。
  // 跟同一輪裡「must beats era」那條（39/40 其實是淋浴間）是同一種病。
  const BATH_OK = [
    "bath", "bathtub", "bathing", "onsen", "shower (place)", "ofuro", "bathhouse",
    "sauna", "bubble bath", "showering", "hot spring", "washing hair", "shared bathing",
  ];
  const nude = [];
  let nudeInBath = 0;
  let bathScenes = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(26000 + i), 26000 + i);
    const h = tagsOf(d);
    const inBath = BATH_OK.some((t) => h.has(t));
    if (inBath) bathScenes += 1;
    if (h.has("nude") || h.has("completely nude")) {
      if (inBath) nudeInBath += 1;
      else nude.push(i);
    }
  }
  eq("tease never force-nudes outside the bath", nude.length, 0);
  // 護欄：上面那條若因為 40 張裡一顆浴場都沒抽到而「空過」，這條會紅。
  // 沒有它的話，把整個浴場例外寫死成永不觸發也照樣通過。
  ok("tease sample actually reaches a bath scene", bathScenes > 0,
     `40 張裡浴場 ${bathScenes} 張、其中全裸 ${nudeInBath} 張`);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["flash"];
  s.weights = { tease: 0, flash: 1, sex: 0 };
  s.lockScene = false;
  s.sceneMode = "weird";
  const nude = [];
  const noGarment = [];
  const noAct = [];
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(26100 + i), 26100 + i);
    const h = tagsOf(d);
    // 公開裸體是走光組的字，自己帶出 nude，收尾會把沒釘住的衣服脫掉。
    // 那不是服裝段的裸體骰（走光本來就不擲那顆骰子）。
    // 詞庫變大之後這 40 張會抽到一張，不能算「硬脫光」。
    const publicNude = h.has("public nudity");
    if ((h.has("nude") || h.has("completely nude")) && !publicNude) nude.push(i);
    // 「身上有主衣」不能用 mutex 判。詞庫裡 layer=garment 而 mutex 不是那三種的
    // 有 103 個，包含 dress、shirt、skirt、school uniform、kimono、sportswear ——
    // 也就是說「只穿一件洋裝」會被這條判成沒穿衣服。這條之所以一直是綠的，
    // 是因為它只抽 40 顆種子：同樣的判準拿去抽 2000 張，在**這次改動之前**就已經
    // 有 26 張(1.3%) 被判成沒主衣了。它是靠運氣過的，不是靠正確。
    //
    // 改看「是不是遮身體的那一層」：layer=garment 且不屬於內衣／腿／腳。
    // 這樣 sportswear、dress、shirt 都算數，thong、no bra、襪子、鞋子都不算。
    const garment = [...h].some((t) => {
      const it = lex.byTag.get(t);
      if (!it || it.section !== "clothing") return false;
      if (it.layer !== "garment") return false;
      return !["underwear", "legs", "feet"].includes(it.group);
    });
    if (!garment && !publicNude) noGarment.push(i);
    const act = [...h].some((t) => {
      const it = lex.byTag.get(t);
      return it && (it.mutex === "clothes_action" || it.group === "flash");
    });
    if (!act) noAct.push(i);
  }
  eq("flash never force-nudes", nude.length, 0);
  eq("flash always has a body garment", noGarment.length, 0);
  eq("flash always has a clothes action", noAct.length, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  let nude = 0;
  let clothed = 0;
  for (let i = 0; i < 50; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(26200 + i), 26200 + i);
    const h = tagsOf(d);
    if (h.has("nude") || h.has("completely nude")) nude += 1;
    else clothed += 1;
  }
  ok("sex heat is not always nude", clothed >= 8, `clothed=${clothed} nude=${nude}`);
}

{
  const cg = lex.byTag.get("cowgirl position");
  ok("cowgirl mutex is sex_act", cg && cg.mutex === "sex_act");
  ok("cowgirl needs pair", (cg?.needs || []).includes("pair"));
  ok("cowgirl needs male", (cg?.needs || []).includes("male"));
  ok("cowgirl needs female", (cg?.needs || []).includes("female"));
  const fell = lex.byTag.get("fellatio");
  ok("fellatio needs male", (fell?.needs || []).includes("male"));
  ok("fellatio needs pair", (fell?.needs || []).includes("pair"));
  const oral = lex.byTag.get("oral");
  ok("oral umbrella has no mutex", oral && !oral.mutex);
  ok("oral mutexExtra sex_act", (oral?.mutexExtra || []).includes("sex_act"));
  ok("oral still mutexes cowgirl", mutexSiblings(lex, "oral").includes("cowgirl position"));
  const breasts = lex.byTag.get("huge breasts");
  ok("huge breasts needs female", (breasts?.needs || []).includes("female"));
  const kiss = lex.byTag.get("kiss");
  ok("kiss needs pair", (kiss?.needs || []).includes("pair"));
}

{
  const s = settings();
  s.counts.feature = "x";
  const dump = drawOne(lex, s, new Set(), new Set(), mulberry32(1), 1);
  const feats = [...tagsOf(dump)].filter((t) => lex.byTag.get(t)?.section === "feature");
  ok("NaN feature count does not dump the pool", feats.length <= 20, `feature=${feats.length}`);
  s.counts.feature = 1e9;
  const huge = drawOne(lex, s, new Set(), new Set(), mulberry32(2), 2);
  const feats2 = [...tagsOf(huge)].filter((t) => lex.byTag.get(t)?.section === "feature");
  ok("huge feature count is capped", feats2.length <= 50, `feature=${feats2.length}`);
}

{
  const dirty = sanitizeSettings(
    {
      n: "",
      width: "",
      height: -5,
      counts: { feature: "x", pose: 1e9 },
      heats: ["nope"],
      eras: ["future"],
      girl: "yes",
      boy: 0,
    },
    data
  );
  ok("junk n falls back", dirty.n >= 1 && dirty.n <= 10);
  ok("junk width falls back", dirty.width === 1024);
  ok("negative height clamps to 256", dirty.height === 256);
  eq("junk feature count is 0", dirty.counts.feature, 0);
  ok("huge pose count clamps to 10", dirty.counts.pose === 10);
  eq("missing count keys keep defaults", dirty.counts.subject, data.defaults.counts.subject);
  ok("junk heats fall back", dirty.heats.length > 0 && dirty.heats.every((h) => ["tease", "flash", "sex"].includes(h)));
  ok("junk eras fall back", dirty.eras.length > 0 && dirty.eras.every((e) => ERAS.includes(e)));
}

{
  const custom = sanitizeSettings(
    {
      heatPreset: "custom",
      heats: ["tease", "sex"],
      weights: { flash: 0, sex: 0.5, tease: 0.5 },
    },
    data
  );
  eq("custom heatPreset is kept", custom.heatPreset, "custom");
  ok("custom keeps flash off", custom.heats.includes("tease") && custom.heats.includes("sex") && !custom.heats.includes("flash"));
  const partial = sanitizeSettings({ n: 2, counts: { feature: 3 } }, data);
  eq("n-only keeps default feature-adjacent counts", partial.counts.subject, data.defaults.counts.subject);
  eq("partial feature count is kept", partial.counts.feature, 3);
  eq("n-only keeps default pose count", partial.counts.pose, data.defaults.counts.pose);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const d = drawOne(lex, s, new Set(), new Set(), mulberry32(42), 42);
  const parts = d.positive.split(", ").map((t) => t.trim()).filter(Boolean);
  const firstCloth = parts.findIndex((t) => lex.byTag.get(t)?.section === "clothing");
  const firstPose = parts.findIndex((t) => lex.byTag.get(t)?.section === "pose");
  ok(
    "clothing comes before pose in POS",
    firstCloth >= 0 && firstPose >= 0 && firstCloth < firstPose,
    `cloth@${firstCloth} pose@${firstPose} pos=${d.positive}`
  );
  const qAt = parts.indexOf("masterpiece");
  // 尾巴的字跟著滑桿走（色情 nsfw+explicit／敏感 sensitive／全年齡 sfw+general），
  // 所以這裡找「哪一個尾巴在場」，而不是寫死 nsfw —— 這條測的是位置，不是尺度。
  // 尾巴的內容由 test_draw_contracts 第 5 組守。
  const nsfwAt = Math.max(
    parts.lastIndexOf("nsfw"), parts.lastIndexOf("explicit"),
    parts.lastIndexOf("sensitive"), parts.lastIndexOf("general"), parts.lastIndexOf("sfw")
  );
  const girlAt = parts.indexOf("1girl");
  ok("quality sits after subject", qAt > girlAt && girlAt >= 0, `girl@${girlAt} quality@${qAt}`);
  ok("quality sits after nsfw tail", qAt > nsfwAt && nsfwAt >= 0, `nsfw@${nsfwAt} quality@${qAt}`);
  ok("default draw has no anime coloring", !parts.includes("anime coloring"));
  ok("default draw has no absurdres", !parts.includes("absurdres"));
  ok("default draw has no highres", !parts.includes("highres"));
  ok("default draw has no very aesthetic", !parts.includes("very aesthetic"));
  ok("default draw keeps masterpiece", parts.includes("masterpiece"));
  ok("default draw keeps best quality", parts.includes("best quality"));
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const pinned = applyPin(lex, new Set(), new Set(), "anime coloring").pinned;
  const d = drawOne(lex, s, pinned, new Set(), mulberry32(43), 43);
  const parts = d.positive.split(", ").map((t) => t.trim()).filter(Boolean);
  ok("pinned anime coloring enters POS", parts.includes("anime coloring"));
  ok(
    "style sits before quality",
    parts.indexOf("anime coloring") >= 0 && parts.indexOf("anime coloring") < parts.indexOf("masterpiece"),
    `style@${parts.indexOf("anime coloring")} quality@${parts.indexOf("masterpiece")}`
  );
  eq("anime coloring is optional quality", lex.byTag.get("anime coloring")?.section, "quality");
  eq("anime coloring is style group", lex.byTag.get("anime coloring")?.group, "style");
  eq("absurdres is optional boost", lex.byTag.get("absurdres")?.group, "boost");
}

{
  const styleTags = [
    "lineart",
    "screentones",
    "watercolor (medium)",
    "monochrome",
    "1990s (style)",
    "2000s (style)",
    "retro artstyle",
    "thick outlines",
    "drop shadow",
  ];
  const boostTags = ["newest", "highly aesthetic"];
  for (const tag of styleTags) {
    eq(`${tag} is optional quality`, lex.byTag.get(tag)?.section, "quality");
    eq(`${tag} is style group`, lex.byTag.get(tag)?.group, "style");
  }
  for (const tag of boostTags) {
    eq(`${tag} is optional quality`, lex.byTag.get(tag)?.section, "quality");
    eq(`${tag} is boost group`, lex.byTag.get(tag)?.group, "boost");
  }
  eq("lineart zh", lex.byTag.get("lineart")?.zh, "線稿");
  eq("screentones zh", lex.byTag.get("screentones")?.zh, "網點");
  eq("watercolor zh", lex.byTag.get("watercolor (medium)")?.zh, "水彩");
  eq("1990s zh", lex.byTag.get("1990s (style)")?.zh, "1990s 畫風");

  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const d = drawOne(lex, s, new Set(), new Set(), mulberry32(44), 44);
  const parts = d.positive.split(", ").map((t) => t.trim()).filter(Boolean);
  for (const tag of [...styleTags, ...boostTags]) {
    ok(`default draw has no ${tag}`, !parts.includes(tag));
  }

  const pinWater = applyPin(lex, new Set(["anime coloring"]), new Set(), "watercolor (medium)");
  ok("watercolor pin drops anime coloring", !pinWater.pinned.has("anime coloring"));
  ok("watercolor pin keeps watercolor", pinWater.pinned.has("watercolor (medium)"));

  const pinEra = applyPin(lex, new Set(["1990s (style)"]), new Set(), "retro artstyle");
  ok("retro pin drops 1990s", !pinEra.pinned.has("1990s (style)"));

  // 原本這裡用 thick outlines/clean lines 示範同格互斥。clean lines 是 0 張、
  // 2026-09-18 移除，line_weight 只剩 thick outlines 一個成員，沒有同伴可以擠掉。
  // 同一件事上面兩條（watercolor 擠掉 anime coloring、retro 擠掉 1990s）還在守。

  const pinAes = applyPin(lex, new Set(["very aesthetic"]), new Set(), "highly aesthetic");
  ok("highly aesthetic pin drops very aesthetic", !pinAes.pinned.has("very aesthetic"));

  const pinDrop = applyPin(lex, new Set(["anime coloring"]), new Set(), "drop shadow");
  ok("drop shadow stacks with anime coloring", pinDrop.pinned.has("anime coloring") && pinDrop.pinned.has("drop shadow"));

  const pinnedNew = applyPin(lex, new Set(), new Set(), "newest").pinned;
  const dNew = drawOne(lex, s, pinnedNew, new Set(), mulberry32(45), 45);
  ok("pinned newest enters POS", dNew.positive.split(", ").includes("newest"));
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const first = drawOne(lex, s, new Set(), new Set(), mulberry32(9001), 9001);
  const ident = identityPins(lex, first.positive);
  ok("identity harvest has hair color", [...ident].some((t) => lex.byTag.get(t)?.mutex === "hair_color"));
  ok("identity harvest skips clothing", ![...ident].some((t) => lex.byTag.get(t)?.section === "clothing"));
  ok("identity harvest skips pose", ![...ident].some((t) => lex.byTag.get(t)?.section === "pose"));
  const hair = [...ident].find((t) => lex.byTag.get(t)?.mutex === "hair_color");
  const eyes = [...ident].find((t) => lex.byTag.get(t)?.mutex === "eye_color");
  let sameHair = 0;
  let sameEyes = 0;
  let clothChanged = 0;
  const firstCloth = [...tagsOf(first)].filter((t) => lex.byTag.get(t)?.section === "clothing").sort().join("|");
  for (let i = 0; i < 8; i++) {
    const pin = new Set(ident);
    const d = drawOne(lex, s, pin, new Set(), mulberry32(9100 + i), 9100 + i);
    const have = tagsOf(d);
    if (hair && have.has(hair)) sameHair += 1;
    if (eyes && have.has(eyes)) sameEyes += 1;
    const cloth = [...have].filter((t) => lex.byTag.get(t)?.section === "clothing").sort().join("|");
    if (cloth !== firstCloth) clothChanged += 1;
  }
  ok("later draws keep harvested hair color", !hair || sameHair === 8, `hair=${hair} kept=${sameHair}/8`);
  ok("later draws keep harvested eye color", !eyes || sameEyes === 8, `eyes=${eyes} kept=${sameEyes}/8`);
  ok("later draws can still change clothes", clothChanged >= 1, `changed=${clothChanged}/8`);
  eq("samePerson defaults off", defaultSettings(data).samePerson, false);
}

{
  ok(
    "no panties does not imply panties",
    !((lex.byTag.get("no panties")?.implies || []).includes("panties"))
  );
  ok("no bra does not imply bra", !((lex.byTag.get("no bra")?.implies || []).includes("bra")));
  ok(
    "open shirt still implies shirt",
    (lex.byTag.get("open shirt")?.implies || []).includes("shirt")
  );
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["flash"];
  s.weights = { tease: 0, flash: 1, sex: 0 };
  let bothPanties = 0;
  let bothBra = 0;
  for (let i = 0; i < 50; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(30000 + i), 30000 + i));
    if (h.has("no panties") && h.has("panties")) bothPanties += 1;
    if (h.has("no bra") && h.has("bra")) bothBra += 1;
  }
  eq("flash never stacks no panties with panties", bothPanties, 0);
  eq("flash never stacks no bra with bra", bothBra, 0);
  const pinNone = applyPin(lex, new Set(), new Set(), "no panties");
  ok("pin no panties does not pin panties", pinNone.pinned.has("no panties") && !pinNone.pinned.has("panties"));
  let handInNone = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinNone.pinned, new Set(), mulberry32(30900 + i), 30900 + i));
    if (h.has("hand in panties")) handInNone += 1;
  }
  eq("no panties flash does not pick hand in panties", handInNone, 0);
}

{
  const s = settings();
  s.girl = false;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const pinBald = applyPin(lex, new Set(), new Set(), "bald").pinned;
  let hairColor = 0;
  let hairStyle = 0;
  let lostBald = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinBald, new Set(), mulberry32(30100 + i), 30100 + i));
    if (!h.has("bald")) lostBald += 1;
    if ([...h].some((t) => t !== "bald" && lex.byTag.get(t)?.mutex === "hair_color")) hairColor += 1;
    if (
      [...h].some((t) => {
        const it = lex.byTag.get(t);
        return it && it.group === "hair_style";
      })
    ) {
      hairStyle += 1;
    }
  }
  eq("pin bald stays bald", lostBald, 0);
  eq("bald pin never draws a hair color", hairColor, 0);
  eq("bald pin never draws a hair style", hairStyle, 0);
}

{
  const eye = lex.byTag.get("eye contact");
  ok("eye contact needs pair", (eye?.needs || []).includes("pair"));
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const pinned = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  let soloEye = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(30200 + i), 30200 + i));
    if (h.has("solo") && h.has("eye contact")) soloEye += 1;
  }
  eq("solo 1girl never draws eye contact", soloEye, 0);
}

{
  ok("ponytail mutexes twintails", mutexSiblings(lex, "ponytail").includes("twintails"));
  ok("ponytail mutexes hair bun", mutexSiblings(lex, "ponytail").includes("hair bun"));
  ok(
    "side ponytail does not mutex ponytail",
    !mutexSiblings(lex, "side ponytail").includes("ponytail")
  );
  const pinSide = applyPin(lex, new Set(), new Set(), "side ponytail");
  ok(
    "pin side ponytail also pins ponytail",
    pinSide.pinned.has("side ponytail") && pinSide.pinned.has("ponytail")
  );
  ok("swept bangs is in the lexicon", !!lex.byTag.get("swept bangs"));
  ok("swept bangs is not a hair_style mutex", !lex.byTag.get("swept bangs")?.mutex);
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  const EXCLUSIVE = new Set([
    "ponytail",
    "high ponytail",
    "side ponytail",
    "twintails",
    "braid",
    "twin braids",
    "single braid",
    "hime cut",
    "hair bun",
    "double bun",
    "single hair bun",
    "drill hair",
  ]);
  let clash = 0;
  for (let i = 0; i < 50; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(30300 + i), 30300 + i));
    const got = [...h].filter((t) => EXCLUSIVE.has(t));
    const roots = got.filter(
      (t) => !got.some((o) => o !== t && (lex.byTag.get(o)?.implies || []).includes(t))
    );
    if (roots.length > 1) clash += 1;
  }
  eq("tease never two exclusive hair styles", clash, 0);
}

{
  eq("female pubic hair gate", lex.byTag.get("female pubic hair")?.gate, "female");
  ok(
    "female pubic hair is flash/sex",
    JSON.stringify(lex.byTag.get("female pubic hair")?.heat) === '["flash","sex"]'
  );
  eq("arm hair gate", lex.byTag.get("arm hair")?.gate, "male");
  eq("leg hair gate", lex.byTag.get("leg hair")?.gate, "male");
  const sg = settings();
  sg.girl = true;
  sg.boy = false;
  sg.eras = ["modern"];
  let girlMaleHair = 0;
  for (let i = 0; i < 50; i++) {
    const h = tagsOf(drawOne(lex, sg, new Set(), new Set(), mulberry32(30400 + i), 30400 + i));
    if (h.has("arm hair") || h.has("leg hair") || h.has("chest hair")) girlMaleHair += 1;
  }
  eq("girl-only does not draw male body hair", girlMaleHair, 0);
  const sb = settings();
  sb.girl = false;
  sb.boy = true;
  sb.eras = ["modern"];
  let boyFemPubic = 0;
  for (let i = 0; i < 50; i++) {
    const h = tagsOf(drawOne(lex, sb, new Set(), new Set(), mulberry32(30500 + i), 30500 + i));
    if (h.has("female pubic hair")) boyFemPubic += 1;
  }
  eq("boy-only does not draw female pubic hair", boyFemPubic, 0);
}

{
  const pull = lex.byTag.get("one-piece swimsuit pull");
  ok(
    "swimsuit pull does not imply a swimsuit",
    pull &&
      !(pull.implies || []).includes("swimsuit") &&
      !(pull.implies || []).includes("one-piece swimsuit"),
    JSON.stringify(pull?.implies)
  );
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["flash"];
  s.weights = { tease: 0, flash: 1, sex: 0 };
  const pinned = applyPin(lex, new Set(), new Set(), "sundress").pinned;
  let swimOnDress = 0;
  let swimActOnDress = 0;
  let lostDress = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(30600 + i), 30600 + i);
    const h = tagsOf(d);
    if (!h.has("sundress")) lostDress += 1;
    if (h.has("sundress") && (h.has("one-piece swimsuit") || h.has("swimsuit"))) swimOnDress += 1;
    if (
      h.has("sundress") &&
      (h.has("one-piece swimsuit pull") || h.has("swimsuit aside") || h.has("bikini bottom aside"))
    ) {
      swimActOnDress += 1;
    }
  }
  eq("sundress pin stays", lostDress, 0);
  eq("sundress flash never also has a swimsuit", swimOnDress, 0);
  eq("sundress flash never picks a swimsuit action", swimActOnDress, 0);
}

{
  // 自慰是單人的預設。四肢截斷不能用手，植卵、機械、觸手這些不用手的單人體位也算。
  // 要第二個人的體位不在這份清單裡。
  const SOLO_SEX = new Set([
    "masturbation",
    "female masturbation",
    "male masturbation",
    "fingering",
    "masturbation through clothes",
    "object insertion",
    "tentacle sex",
    "sex machine",
    "large insertion",
    "urethral insertion",
    "egg laying",
    "nipple penetration",
  ]);
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  const pinned = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  let miss = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinned, new Set(), mulberry32(30700 + i), 30700 + i);
    const h = tagsOf(d);
    if (d.people !== 1) miss += 1;
    // 貞操帶鎖著下體時引擎刻意不硬補自慰（engine.js「貞操帶是另一件事：下體鎖著就不要硬補」），
    // HEAD 釘貞操帶時也是 63/200 張沒有。以前這 40 顆種子剛好沒抽到貞操帶，第六輪亂數位移後抽到了。
    else if (h.has("chastity belt")) continue;
    else if (![...h].some((t) => SOLO_SEX.has(t))) miss += 1;
  }
  eq("girl-only solo sex always has a masturbation tag", miss, 0);
  const sb = settings();
  sb.girl = false;
  sb.boy = true;
  sb.eras = ["modern"];
  sb.heats = ["sex"];
  sb.weights = { tease: 0, flash: 0, sex: 1 };
  const pinBoy = applyPin(lex, new Set(), new Set(), "1boy").pinned;
  let missB = 0;
  for (let i = 0; i < 30; i++) {
    const d = drawOne(lex, sb, pinBoy, new Set(), mulberry32(30800 + i), 30800 + i);
    const h = tagsOf(d);
    if (d.people !== 1) missB += 1;
    else if (![...h].some((t) => SOLO_SEX.has(t))) missB += 1;
  }
  eq("boy-only solo sex always has a masturbation tag", missB, 0);
}

{
  eq("undressing is not a dress action", actionGarmentKeys("undressing"), []);
  ok("pants pull names pants", actionGarmentKeys("pants pull").includes("pants"));
  ok("panty pull names panty", actionGarmentKeys("panty pull").includes("panty"));
  ok("dress pull names dress", actionGarmentKeys("dress pull").includes("dress"));
  ok("downblouse names blouse", actionGarmentKeys("downblouse").includes("blouse"));
  eq("undressing fits a hoodie", actionFitsClothes("undressing", ["hoodie"]), 2);
  eq("dress pull does not fit a hoodie", actionFitsClothes("dress pull", ["hoodie"]), 0);
  eq("dress pull fits sundress", actionFitsClothes("dress pull", ["sundress"]), 2);
  eq("pants pull does not fit cheerleader", actionFitsClothes("pants pull", ["cheerleader"]), 0);
  eq("pants pull fits jeans", actionFitsClothes("pants pull", ["jeans"]), 2);
  eq("pants pull fits yoga pants", actionFitsClothes("pants pull", ["yoga pants"]), 2);
  eq("panty pull fits thong", actionFitsClothes("panty pull", ["thong"]), 2);
  eq("panty pull does not fit cheerleader", actionFitsClothes("panty pull", ["cheerleader"]), 0);
  eq("hand in panties does not fit no panties", actionFitsClothes("hand in panties", ["no panties"]), 0);
  eq("shirt lift fits white shirt", actionFitsClothes("shirt lift", ["white shirt"]), 2);
  eq("downblouse does not fit cheerleader", actionFitsClothes("downblouse", ["cheerleader"]), 0);
  eq("through clothes does not fit nude", actionFitsClothes("masturbation through clothes", ["nude"]), 0);
  eq("through clothes does not fit empty", actionFitsClothes("masturbation through clothes", []), 0);
  eq("through clothes does not fit towel only", actionFitsClothes("masturbation through clothes", ["towel"]), 0);
  eq("through clothes fits a shirt", actionFitsClothes("masturbation through clothes", ["white shirt"]), 2);
  eq("upskirt does not fit nude", actionFitsClothes("upskirt", ["nude"]), 0);
  eq("upskirt fits a skirt", actionFitsClothes("upskirt", ["miniskirt"]), 2);
  eq("undressing does not fit nude", actionFitsClothes("undressing", ["nude"]), 0);
  eq("clothes lift does not fit nude", actionFitsClothes("clothes lift", ["nude"]), 0);
  eq("clothes lift fits a shirt", actionFitsClothes("clothes lift", ["white shirt"]), 2);
  eq("flashing does not fit nude", actionFitsClothes("flashing", ["nude"]), 0);
  eq("cameltoe does not fit nude", actionFitsClothes("cameltoe", ["nude"]), 0);
  eq("clothed sex does not fit nude", actionFitsClothes("clothed sex", ["nude"]), 0);
  eq("covering breasts still fits nude", actionFitsClothes("covering breasts", ["nude"]), 1);
  eq("adjusting clothes does not fit nude", actionFitsClothes("adjusting clothes", ["nude"]), 0);
  eq("clothes tug does not fit nude", actionFitsClothes("clothes tug", ["nude"]), 0);
  eq("adjusting clothes fits a shirt", actionFitsClothes("adjusting clothes", ["white shirt"]), 2);
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["flash"];
  s.weights = { tease: 0, flash: 1, sex: 0 };
  let mismatch = 0;
  let noAct = 0;
  for (let i = 0; i < 50; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(31000 + i), 31000 + i);
    const h = tagsOf(d);
    const cloth = [...h].filter((t) => lex.byTag.get(t)?.section === "clothing");
    const acts = [...h].filter((t) => {
      const it = lex.byTag.get(t);
      return it && (it.mutex === "clothes_action" || it.group === "flash");
    });
    if (!acts.length) noAct += 1;
    for (const a of acts) {
      if (actionFitsClothes(a, cloth) === 0) mismatch += 1;
    }
  }
  eq("flash named clothes action matches a worn garment", mismatch, 0);
  eq("flash still has a clothes action", noAct, 0);
  const pinCheer = applyPin(lex, new Set(), new Set(), "cheerleader").pinned;
  let cheerMismatch = 0;
  let cheerNoAct = 0;
  let cheerPants = 0;
  for (let i = 0; i < 80; i++) {
    const d = drawOne(lex, s, pinCheer, new Set(), mulberry32(31100 + i), 31100 + i);
    const h = tagsOf(d);
    if (!h.has("cheerleader")) cheerMismatch += 1;
    const cloth = [...h].filter((t) => lex.byTag.get(t)?.section === "clothing");
    const acts = [...h].filter((t) => {
      const it = lex.byTag.get(t);
      return it && (it.mutex === "clothes_action" || it.group === "flash");
    });
    if (!acts.length) cheerNoAct += 1;
    for (const a of acts) {
      if (actionFitsClothes(a, cloth) === 0) cheerMismatch += 1;
    }
    if (h.has("pants pull") && actionFitsClothes("pants pull", cloth) === 0) cheerPants += 1;
  }
  eq("cheerleader flash never picks a mismatched named action", cheerMismatch, 0);
  eq("cheerleader flash still has a flash action", cheerNoAct, 0);
  eq("cheerleader flash never pants-pulls without pants", cheerPants, 0);
  const pinHood = applyPin(lex, new Set(), new Set(), "hoodie").pinned;
  let hoodDressAct = 0;
  for (let i = 0; i < 80; i++) {
    const d = drawOne(lex, s, pinHood, new Set(), mulberry32(31400 + i), 31400 + i);
    const h = tagsOf(d);
    const cloth = [...h].filter((t) => lex.byTag.get(t)?.section === "clothing");
    if (h.has("dress pull") && actionFitsClothes("dress pull", cloth) === 0) hoodDressAct += 1;
  }
  eq("hoodie flash never dress-pulls without a dress", hoodDressAct, 0);
}

{
  const trib = lex.byTag.get("tribadism");
  ok("tribadism needs yuri", (trib?.needs || []).includes("yuri"));
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  let pinned = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  pinned = applyPin(lex, pinned, new Set(), "1boy").pinned;
  let withBoy = 0;
  for (let i = 0; i < 50; i++) {
    const h = tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(31200 + i), 31200 + i));
    if (h.has("tribadism")) withBoy += 1;
  }
  eq("1girl+1boy sex never draws tribadism", withBoy, 0);
}

{
  const NEW_POS = [
    "upright straddle",
    "reverse upright straddle",
    "reverse suspended congress",
    "piledriver (sex)",
    "boy on top",
    "thigh sex",
    "frottage",
    "reverse spitroast",
  ];
  for (const tag of NEW_POS) {
    const it = lex.byTag.get(tag);
    ok(`${tag} is in the lexicon`, !!it);
    eq(`${tag} is a pose`, it?.section, "pose");
    eq(`${tag} mutex is sex_act`, it?.mutex, "sex_act");
    ok(`${tag} is sex-only heat`, JSON.stringify(it?.heat) === '["sex"]');
    ok(`${tag} implies sex`, (it?.implies || []).includes("sex"));
    ok(`${tag} needs pair`, (it?.needs || []).includes("pair"));
  }
  ok("upright straddle mutexes cowgirl", mutexSiblings(lex, "upright straddle").includes("cowgirl position"));
  ok("piledriver (sex) mutexes missionary", mutexSiblings(lex, "piledriver (sex)").includes("missionary"));
  ok("boy on top mutexes girl on top", mutexSiblings(lex, "boy on top").includes("girl on top"));
  ok("reverse spitroast mutexes spitroast", mutexSiblings(lex, "reverse spitroast").includes("spitroast"));
  eq("parse piledriver (sex)", parseWeighted("piledriver (sex)"), { tag: "piledriver (sex)", weight: 1 });
  eq("parse weighted piledriver (sex)", parseWeighted("(piledriver (sex):1.2)"), { tag: "piledriver (sex)", weight: 1.2 });
  const pin = applyPin(lex, new Set(), new Set(), "piledriver (sex)");
  ok(
    "pin piledriver (sex) also pins sex",
    pin.pinned.has("piledriver (sex)") && pin.pinned.has("sex")
  );
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  let cowgirl = 0;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, s, pin.pinned, new Set(), mulberry32(32100 + i), 32100 + i));
    if (h.has("cowgirl position") || h.has("missionary")) cowgirl += 1;
    if (!h.has("piledriver (sex)") || !h.has("sex")) cowgirl += 1;
  }
  eq("pin piledriver (sex) keeps it and never a rival position", cowgirl, 0);
  const sg = settings();
  sg.girl = true;
  sg.boy = false;
  sg.eras = ["modern"];
  sg.heats = ["sex"];
  sg.weights = { tease: 0, flash: 0, sex: 1 };
  let girlBoyTop = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sg, new Set(), new Set(), mulberry32(32200 + i), 32200 + i));
    if (h.has("boy on top")) girlBoyTop += 1;
  }
  eq("girl-only never draws boy on top", girlBoyTop, 0);
  const sb = settings();
  sb.girl = false;
  sb.boy = true;
  sb.eras = ["modern"];
  sb.heats = ["sex"];
  sb.weights = { tease: 0, flash: 0, sex: 1 };
  let boyStraddle = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sb, new Set(), new Set(), mulberry32(32300 + i), 32300 + i));
    if (h.has("upright straddle") || h.has("reverse upright straddle")) boyStraddle += 1;
  }
  eq("boy-only never draws upright straddle", boyStraddle, 0);
}

{
  const k = lex.byTag.get("loli");
  ok("loli is in the lexicon", !!k);
  eq("loli is a female feature", k?.section, "feature");
  eq("loli gate is female", k?.gate, "female");
  // 2026-09-15：拿掉 flat chest -> small breasts（以及 loli -> small breasts）。
  // Danbooru 上 flat_chest 沒有任何 implication，而且兩者都是 mutex=breast_size ——
  // 平胸和小胸是同一把尺上的兩個點，不是父子。實測 17% 的圖同時寫著兩個。
  //
  // 有可能的反面理由是出圖品質（flat chest 單獨下去會不會畫成中性胸？），
  // 所以真的出了圖：同 seed、同提示詞，只差這一個字，兩個 seed 都清楚是女性、
  // 沒有中性化。既有測試沒有寫下理由，圖也不支持那個理由，所以照資料修正。
  ok("loli 不再連帶 small breasts", !(k?.implies || []).includes("small breasts"));
  ok("loli implies flat chest", (k?.implies || []).includes("flat chest"));
  ok("loli implies petite", (k?.implies || []).includes("petite"));
  ok("flat chest 不再 implies small breasts（Danbooru 沒有這條）",
     !(lex.byTag.get("flat chest")?.implies || []).includes("small breasts"));
  eq("flat chest mutex is breast_size", lex.byTag.get("flat chest")?.mutex, "breast_size");
  eq("petite mutex is height", lex.byTag.get("petite")?.mutex, "height");
  ok("loli mutexes tall female", mutexSiblings(lex, "loli").includes("tall female"));
  ok("petite mutexes tall female", mutexSiblings(lex, "petite").includes("tall female"));
  ok("petite does not mutex loli", !mutexSiblings(lex, "petite").includes("loli"));
  ok("flat chest mutexes huge breasts", mutexSiblings(lex, "flat chest").includes("huge breasts"));
  // 拆掉父子關係之後，兩者回到正常的互斥關係：同一個 breast_size 格只能有一個值。
  ok("flat chest 與 small breasts 互斥（同一個 breast_size 格）",
     mutexSiblings(lex, "flat chest").includes("small breasts"));
  ok("loli does not mutex mature female", !mutexSiblings(lex, "loli").includes("mature female"));
  const pin = applyPin(lex, new Set(), new Set(), "loli");
  ok(
    "pin loli also pins petite and flat chest",
    pin.pinned.has("loli") && pin.pinned.has("petite") && pin.pinned.has("flat chest")
  );
  ok("pin loli 不再連帶 small breasts", !pin.pinned.has("small breasts"));
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  let miss = 0;
  let tall = 0;
  let big = 0;
  for (let i = 0; i < 30; i++) {
    const d = drawOne(lex, s, pin.pinned, new Set(), mulberry32(31500 + i), 31500 + i);
    const h = tagsOf(d);
    // 原本這裡還要求 h.has("adult")。adult 在 Danbooru 是 0 張、模型沒把它當 tag
    // 學過，2026-09-18 移除 —— 它當初是被無條件塞進每一張圖的，所以出現在這條
    // 2026-09-28：loli 本身隨機和釘選都不輸出。applyPin 仍會把 petite、
    // flat chest 放進釘選，這兩個字留著，所以高個子和大胸仍被互斥擋掉。
    if (h.has("loli")) miss += 1;
    if (!h.has("petite") || !h.has("flat chest")) miss += 1;
    if (h.has("tall female")) tall += 1;
    if (h.has("huge breasts") || h.has("large breasts") || h.has("gigantic breasts") || h.has("medium breasts")) {
      big += 1;
    }
  }
  eq("pin loli does not draw loli, petite and flat chest stay", miss, 0);
  eq("pin loli never draws tall female", tall, 0);
  eq("pin loli never draws a larger bust", big, 0);
  const sb = settings();
  sb.girl = false;
  sb.boy = true;
  sb.eras = ["modern"];
  let boyKokod = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sb, new Set(), new Set(), mulberry32(31600 + i), 31600 + i));
    if (h.has("loli")) boyKokod += 1;
  }
  eq("boy-only never draws loli", boyKokod, 0);
}

{
  const k = lex.byTag.get("shota");
  ok("shota is in the lexicon", !!k);
  eq("shota is a male feature", k?.section, "feature");
  eq("shota gate is male", k?.gate, "male");
  ok("shota implies short male", (k?.implies || []).includes("short male"));
  eq("shota mutex is height_m", k?.mutex, "height_m");
  eq("short male mutex is height_m", lex.byTag.get("short male")?.mutex, "height_m");
  eq("tall male mutex is height_m", lex.byTag.get("tall male")?.mutex, "height_m");
  ok("shota mutexes tall male", mutexSiblings(lex, "shota").includes("tall male"));
  ok("short male mutexes tall male", mutexSiblings(lex, "short male").includes("tall male"));
  ok("short male does not mutex shota", !mutexSiblings(lex, "short male").includes("shota"));
  ok("shota does not mutex loli", !mutexSiblings(lex, "shota").includes("loli"));
  ok("shota does not mutex petite", !mutexSiblings(lex, "shota").includes("petite"));
  ok("shota does not mutex tall female", !mutexSiblings(lex, "shota").includes("tall female"));
  ok("shota does not mutex muscular male", !mutexSiblings(lex, "shota").includes("muscular male"));
  ok("shota does not mutex old man", !mutexSiblings(lex, "shota").includes("old man"));
  ok("shota does not mutex dwarf", !mutexSiblings(lex, "shota").includes("dwarf"));
  const pin = applyPin(lex, new Set(), new Set(), "shota");
  ok(
    "pin shota also pins short male",
    pin.pinned.has("shota") && pin.pinned.has("short male")
  );
  const s = settings();
  s.girl = false;
  s.boy = true;
  s.eras = ["modern"];
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  let miss = 0;
  let tall = 0;
  for (let i = 0; i < 30; i++) {
    const d = drawOne(lex, s, pin.pinned, new Set(), mulberry32(31700 + i), 31700 + i);
    const h = tagsOf(d);
    if (h.has("shota")) miss += 1;
    if (!h.has("short male")) miss += 1;
    if (h.has("tall male")) tall += 1;
  }
  eq("pin shota does not draw shota, short male stays", miss, 0);
  // 2026-09-28 起釘選也不輸出 shota。short male 是 applyPin 另外釘上的，留著。
  {
    const sAuto = settings();
    sAuto.girl = false;
    sAuto.boy = true;
    sAuto.eras = ["modern"];
    sAuto.heats = ["tease", "flash", "sex"];
    let auto = 0;
    for (let i = 0; i < 300; i++) {
      const h = tagsOf(drawOne(lex, sAuto, new Set(), new Set(), mulberry32(31800 + i), 31800 + i));
      if (h.has("shota")) auto += 1;
    }
    eq("shota never comes from auto-draw", auto, 0);
  }
  ok("adult is gone from the lexicon", !lex.byTag.has("adult"));
  eq("pin shota never draws tall male", tall, 0);
  const sg = settings();
  sg.girl = true;
  sg.boy = false;
  sg.eras = ["modern"];
  let girlKkob = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sg, new Set(), new Set(), mulberry32(31800 + i), 31800 + i));
    if (h.has("shota")) girlKkob += 1;
  }
  eq("girl-only never draws shota", girlKkob, 0);
}

{
  // 觸發詞插在卡司前綴之後。2026-09-18 之前這些例子都寫著 adult，因為那時候
  // 它是無條件掛在每一張圖上的卡司字之一；移除之後卡司前綴就只剩人數與 solo。
  // 守的東西沒變：觸發詞要落在人數／solo 之後、其餘內容之前。
  eq(
    "trigger after 1girl solo",
    insertTriggerAfterCast("1girl, solo, long hair, masterpiece", "char"),
    "1girl, solo, char, long hair, masterpiece"
  );
  eq(
    "empty trigger leaves pos",
    insertTriggerAfterCast("1girl, solo, long hair", ""),
    "1girl, solo, long hair"
  );
  eq("empty pos is just trigger", insertTriggerAfterCast("", "char"), "char");
  eq(
    "trigger after mixed counts",
    insertTriggerAfterCast("1girl, 1boy, nsfw", "foo, bar"),
    "1girl, 1boy, foo, bar, nsfw"
  );
  eq(
    "trigger respects weighted count",
    insertTriggerAfterCast("(1girl:1.1), solo, long hair", "char"),
    "(1girl:1.1), solo, char, long hair"
  );
  // adult 不再是卡司前綴的一部分：就算字面上出現，觸發詞也不該再等它。
  eq(
    "adult is no longer part of the cast prefix",
    insertTriggerAfterCast("1girl, solo, adult, long hair", "char"),
    "1girl, solo, char, adult, long hair"
  );
  eq(
    "no prefix puts trigger first",
    insertTriggerAfterCast("long hair, masterpiece", "char"),
    "char, long hair, masterpiece"
  );

  eq("parse plain tag", parseWeighted("petite"), { tag: "petite", weight: 1 });
  eq("parse weighted tag", parseWeighted("(petite:1.2)"), { tag: "petite", weight: 1.2 });
  eq("parse weighted place tag", parseWeighted("(bar (place):0.8)"), { tag: "bar (place)", weight: 0.8 });
  eq("format default weight is bare", formatWeighted("petite", 1), "petite");
  eq("format upweight", formatWeighted("petite", 1.2), "(petite:1.2)");
  eq("format integer weight", formatWeighted("loli", 1.0), "loli");
  eq("next weight from 1 is 1.1", nextTagWeight(1), 1.1);
  eq("next weight from 1.5 wraps to 0.6", nextTagWeight(1.5), 0.6);
  eq("next weight from 0.9 wraps to 1", nextTagWeight(0.9), 1);
  eq("step up from 1 is 1.1", stepTagWeight(1, 1), 1.1);
  eq("step down from 1 is 0.9", stepTagWeight(1, -1), 0.9);
  eq("step up clamps at 1.5", stepTagWeight(1.5, 1), 1.5);
  eq("step down clamps at 0.6", stepTagWeight(0.6, -1), 0.6);
  eq("clamp 1.2 stays", clampTagWeight(1.2), 1.2);
  eq("clamp 2 down to 1.5", clampTagWeight(2), 1.5);
  eq("clamp 0.1 up to 0.6", clampTagWeight(0.1), 0.6);
  eq("clamp NaN to 1", clampTagWeight(NaN), 1);
  eq("clamp 1.23 rounds to 1.2", clampTagWeight(1.23), 1.2);
  eq("clamp empty to 1", clampTagWeight(), 1);
  eq(
    "apply weights wraps only changed tags",
    applyTagWeights("1girl, petite, flat chest", new Map([["petite", 1.2], ["loli", 1.4]])),
    "1girl, (petite:1.2), flat chest"
  );
  eq(
    "apply weights keeps existing wrap if map empty",
    applyTagWeights("1girl, (petite:1.3)", new Map()),
    "1girl, (petite:1.3)"
  );
}

{
  eq("skip current card continues batch", settleGenCard({ skipping: true, aborting: false, errName: "AbortError", finished: false }), "skip");
  eq("skip wins over batch cancel", settleGenCard({ skipping: true, aborting: true, errName: "AbortError", finished: false }), "skip");
  eq("skip wins over late done", settleGenCard({ skipping: true, aborting: false, finished: true }), "skip");
  eq("batch cancel marks cancel", settleGenCard({ skipping: false, aborting: true, errName: "AbortError", finished: false }), "cancel");
  eq("abort error without skip is cancel", settleGenCard({ skipping: false, aborting: false, errName: "AbortError", finished: false }), "cancel");
  eq("finished without skip is ok", settleGenCard({ skipping: false, aborting: false, finished: true }), "ok");
  eq("comfy error is error", settleGenCard({ skipping: false, aborting: false, finished: true, hadError: true }), "error");
  eq("unfinished stream is interrupt", settleGenCard({ skipping: false, aborting: false, finished: false }), "interrupt");
}

{
  const pos = "1girl, solo";
  // 這張圖自己打架的那一行。引擎每次抽完都算 contradictions()，但在 2026-09-18
  // 之前**沒有任何地方讀它** —— 算出「同時是室內又室外」然後丟掉，使用者拿到
  // 一張壞圖卻沒有提示。自然抽取撞不到（8640 張 0 次、單一釘選 11080 張 0 次），
  // 要兩個互相矛盾的釘選才會（釘露營配更衣室，實測 2500 組配對抽 9996 張撞 14 張）。
  eq("clash line is empty when the picture agrees with itself",
     clashLine(lex, ["1girl", "solo", "park", "outdoors", "day"]), "");
  ok("clash line catches indoors + outdoors",
     clashLine(lex, ["1girl", "indoors", "outdoors"]).includes("室內和室外"));
  ok("clash line catches day + night",
     clashLine(lex, ["1girl", "day", "night"]).includes("白天和夜晚"));
  ok("clash line catches solo with a crowd",
     clashLine(lex, ["solo", "2girls"]).includes("單人"));
  ok("clash line catches nude with a garment",
     clashLine(lex, ["nude", "dress"]).includes("全裸"));
  // 室內外會被 implies 那一圈重複報好幾筆。只能講一次，而且要點名具體的字 ——
  // 字面上的 indoors／outdoors 對使用者沒有資訊，他要知道的是「哪一個釘選害的」。
  {
    const line = clashLine(lex, ["1girl", "camping", "changing room", "indoors", "outdoors"]);
    eq("clash line says indoors/outdoors once", line.split("同時是室內和室外").length - 1, 1);
    ok("clash line names the culprit tags", line.includes(labelOf(lex, "camping")), line);
  }
  // 接受字串也接受陣列 —— 卡片上存的是 POS 字串。
  eq("clash line accepts a POS string",
     clashLine(lex, "1girl, indoors, outdoors"), clashLine(lex, ["1girl", "indoors", "outdoors"]));
  eq("pin miss line empty with no pins", pinMissLine(lex, pos, new Set()), "");
  const withPin = pinMissLine(lex, pos, new Set(["bikini"]));
  ok("pin miss line lists current miss", withPin.startsWith("釘選未入：") && withPin.includes(labelOf(lex, "bikini")));
  eq("pin miss line clears after unpin", pinMissLine(lex, pos, new Set()), "");
  ok(
    "pin miss line ignores tags already in POS",
    pinMissLine(lex, "1girl, bikini", new Set(["bikini"])) === ""
  );
  const atDraw = new Set(["bikini"]);
  const later = new Set(["bikini", "1boy", "mature female", "huge breasts"]);
  const scoped = pinMissLine(lex, pos, later, atDraw);
  ok(
    "later extra pins not dumped into miss line",
    scoped.startsWith("釘選未入：") &&
      scoped.includes(labelOf(lex, "bikini")) &&
      !scoped.includes(labelOf(lex, "1boy")) &&
      !scoped.includes(labelOf(lex, "mature female"))
  );
  eq("unpin after draw clears scoped miss", pinMissLine(lex, pos, new Set(), atDraw), "");
  eq("empty draw snapshot shows no miss", pinMissLine(lex, pos, later, new Set()), "");
}

{
  const kept = knownTags(lex, ["1girl", "not-a-tag", 3, ""]);
  ok("knownTags keeps 1girl", kept.includes("1girl"));
  ok("knownTags drops unknown", !kept.includes("not-a-tag"));
  eq("knownTags length", kept.length, 1);
}

{
  const bed = lex.byTag.get("on bed");
  const chair = lex.byTag.get("on chair");
  eq("on bed is env", bed?.section, "env");
  eq("on chair is env", chair?.section, "env");
  eq("on bed mutex is furniture", bed?.mutex, "furniture");
  eq("on chair mutex is furniture", chair?.mutex, "furniture");
  ok("on bed does not mutex sitting", !mutexSiblings(lex, "on bed").includes("sitting"));
  const pinBed = applyPin(lex, new Set(["sitting"]), new Set(), "on bed");
  ok("pin on bed keeps sitting", pinBed.pinned.has("sitting") && pinBed.pinned.has("on bed"));
  const pinLie = applyPin(lex, new Set(["lying"]), new Set(), "on bed");
  ok("pin on bed keeps lying", pinLie.pinned.has("lying") && pinLie.pinned.has("on bed"));
}

{
  ok("straddling implies sitting", (lex.byTag.get("straddling")?.implies || []).includes("sitting"));
  ok("straddling needs pair", (lex.byTag.get("straddling")?.needs || []).includes("pair"));
  ok("sitting on lap implies sitting", (lex.byTag.get("sitting on lap")?.implies || []).includes("sitting"));
  const pinStr = applyPin(lex, new Set(["all fours"]), new Set(), "straddling");
  ok("pin straddling drops all fours", !pinStr.pinned.has("all fours"));
  ok("pin straddling pins sitting", pinStr.pinned.has("sitting") && pinStr.pinned.has("straddling"));
}

{
  for (const tag of ["hug", "cuddling", "hug from behind", "sitting on lap", "holding hands"]) {
    ok(`${tag} needs pair`, (lex.byTag.get(tag)?.needs || []).includes("pair"));
  }
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  s.eras = ["modern"];
  const pinHug = applyPin(lex, new Set(), new Set(), "hug").pinned;
  let hugSolo = 0;
  let hugBoy = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinHug, new Set(), mulberry32(96000 + i), 96000 + i);
    const h = tagsOf(d);
    if (!h.has("hug") || d.people < 2) hugSolo += 1;
    if (h.has("1boy") || h.has("2boys")) hugBoy += 1;
  }
  eq("girl-only pin hug is a pair of girls", hugSolo, 0);
  eq("girl-only pin hug never adds a boy", hugBoy, 0);
}

{
  const three = lex.byTag.get("threesome");
  const group = lex.byTag.get("group sex");
  const mmf = lex.byTag.get("mmf threesome");
  const ffm = lex.byTag.get("ffm threesome");
  ok("threesome needs group", (three?.needs || []).includes("group"));
  ok("group sex needs group", (group?.needs || []).includes("group"));
  ok("mmf threesome needs group", (mmf?.needs || []).includes("group"));
  ok("mmf threesome needs 2male", (mmf?.needs || []).includes("2male"));
  ok("mmf threesome needs female", (mmf?.needs || []).includes("female"));
  ok("ffm threesome needs group", (ffm?.needs || []).includes("group"));
  ok("ffm threesome needs 2female", (ffm?.needs || []).includes("2female"));
  ok("ffm threesome needs male", (ffm?.needs || []).includes("male"));
  ok("spitroast needs group", (lex.byTag.get("spitroast")?.needs || []).includes("group"));
  ok("spitroast needs 2male", (lex.byTag.get("spitroast")?.needs || []).includes("2male"));

  const s = settings();
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  const pin3 = applyPin(lex, new Set(), new Set(), "threesome").pinned;
  let under3 = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pin3, new Set(), mulberry32(96100 + i), 96100 + i);
    const h = tagsOf(d);
    if (!h.has("threesome") || d.people < 3) under3 += 1;
  }
  eq("pin threesome always has 3+ people", under3, 0);

  const pinMmf = applyPin(lex, new Set(), new Set(), "mmf threesome").pinned;
  let mmfBad = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinMmf, new Set(), mulberry32(96200 + i), 96200 + i);
    const h = tagsOf(d);
    const boys = (h.has("3boys") ? 3 : 0) || (h.has("2boys") ? 2 : 0) || (h.has("1boy") ? 1 : 0);
    if (!h.has("mmf threesome") || d.people < 3 || boys < 2 || !(h.has("1girl") || h.has("2girls") || h.has("3girls"))) {
      mmfBad += 1;
    }
  }
  eq("pin mmf threesome is 2+ boys and a girl", mmfBad, 0);

  const pinFfm = applyPin(lex, new Set(), new Set(), "ffm threesome").pinned;
  let ffmBad = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinFfm, new Set(), mulberry32(96300 + i), 96300 + i);
    const h = tagsOf(d);
    const girls = (h.has("4girls") ? 4 : 0) || (h.has("3girls") ? 3 : 0) || (h.has("2girls") ? 2 : 0) || (h.has("1girl") ? 1 : 0);
    if (!h.has("ffm threesome") || d.people < 3 || girls < 2 || !(h.has("1boy") || h.has("2boys"))) {
      ffmBad += 1;
    }
  }
  eq("pin ffm threesome is 2+ girls and a boy", ffmBad, 0);

  let locked = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  locked = applyPin(lex, locked, new Set(), "1boy").pinned;
  let leftover3 = 0;
  for (let i = 0; i < 60; i++) {
    const h = tagsOf(drawOne(lex, s, locked, new Set(), mulberry32(96400 + i), 96400 + i));
    if (h.has("threesome") || h.has("group sex") || h.has("mmf threesome") || h.has("ffm threesome")) leftover3 += 1;
  }
  eq("1girl+1boy never leftover 3P", leftover3, 0);
}

{
  const need = (tag) => lex.byTag.get(tag)?.needs || [];
  const item = (tag) => lex.byTag.get(tag);
  ok("5girls is a female count", item("5girls")?.mutex === "female_count" && item("5girls")?.section === "subject");
  ok("fivesome needs five people", ["five", "pair", "group", "crowd"].every((k) => need("fivesome").includes(k)));
  ok("fivesome is not a sex act", item("fivesome")?.mutex == null && item("fivesome")?.heat?.includes("sex") && !item("fivesome")?.heat?.includes("tease"));
  ok("foursome needs a crowd", need("foursome").includes("crowd") && need("foursome").includes("group"));
  ok("double handjob is two penises", item("double handjob")?.mutex === "sex_act" && need("double handjob").includes("2male") && (item("double handjob")?.implies || []).includes("handjob"));
  ok("two-handed handjob is one penis", item("two-handed handjob")?.mutex === "sex_act" && !need("two-handed handjob").includes("2male") && (item("two-handed handjob")?.implies || []).includes("handjob"));
  ok("cooperative handjob needs two girls", need("cooperative handjob").includes("2female") && need("cooperative handjob").includes("male"));
  ok("looking at penis is a gaze", item("looking at penis")?.section === "pose" && item("looking at penis")?.mutex === "gaze" && !item("looking at penis")?.heat?.includes("tease"));
  ok("flaccid is male skin", item("flaccid")?.section === "feature" && item("flaccid")?.layer === "skin" && need("flaccid").includes("male") && (item("flaccid")?.implies || []).includes("penis"));
  ok("half-erect stays off the sex group", item("half-erect")?.group === "body_m" && item("half-erect")?.layer === "skin");
  ok("phimosis can stack with an erection", item("phimosis")?.mutex == null && item("phimosis")?.group === "body_m");
  ok("cum in ass is received by a woman", need("cum in ass").includes("male") && need("cum in ass").includes("female") && !(item("cum in ass")?.implies || []).includes("anal"));
  ok("cum in pussy implies cum and not vaginal", (item("cum in pussy")?.implies || []).includes("cum") && !(item("cum in pussy")?.implies || []).includes("vaginal"));
  ok("cum on clothes needs a male", need("cum on clothes").includes("male") && (item("cum on clothes")?.implies || []).includes("cum"));
  ok("cum in mouth is received by a woman", need("cum in mouth").includes("male") && need("cum in mouth").includes("female"));
  ok("facial is received by a woman", need("facial").includes("female"));
  ok("cum pool is a sex result, not a place", item("cum pool")?.section === "pose" && item("cum pool")?.mutex == null && (item("cum pool")?.heat || []).join(",") === "sex" && need("cum pool").includes("male") && need("cum pool").includes("female") && (item("cum pool")?.implies || []).includes("cum"));
  ok("bare cum now needs a male", need("cum").includes("male"));
  ok("after ejaculation is aftermath", (item("after ejaculation")?.implies || []).includes("cum") && item("after ejaculation")?.mutex == null);
  ok("precum is not cum", (item("precum")?.implies || []).includes("penis") && !(item("precum")?.implies || []).includes("cum"));
  ok("penis awe stays an expression", item("penis awe")?.mutex === "expression" && !item("penis awe")?.heat?.includes("tease"));
  for (const tag of ["phimosis", "flaccid", "precum", "fivesome", "double handjob", "half-erect", "cum on clothes", "gokkun"]) {
    ok(`${tag} is explicit-only`, explicitOnly(item(tag)));
  }

  const sexBoth = settings();
  sexBoth.girl = true;
  sexBoth.boy = true;
  sexBoth.heats = ["sex"];
  sexBoth.weights = { tease: 0, flash: 0, sex: 1 };
  sexBoth.eras = ["modern"];

  const pinFiveGirl = applyPin(lex, new Set(), new Set(), "fivesome").pinned;
  const girlOnly = settings();
  girlOnly.girl = true;
  girlOnly.boy = false;
  girlOnly.heats = ["sex"];
  girlOnly.weights = { tease: 0, flash: 0, sex: 1 };
  girlOnly.eras = ["modern"];
  let fiveGirlBad = 0;
  for (let i = 0; i < 20; i++) {
    const d = drawOne(lex, girlOnly, pinFiveGirl, new Set(), mulberry32(97100 + i), 97100 + i);
    const h = tagsOf(d);
    if (!h.has("fivesome") || !h.has("5girls") || d.people < 5) fiveGirlBad += 1;
  }
  eq("girl-only pin fivesome is 5girls", fiveGirlBad, 0);

  const pinFive = applyPin(lex, new Set(), new Set(), "fivesome").pinned;
  let fiveBad = 0;
  for (let i = 0; i < 20; i++) {
    const d = drawOne(lex, sexBoth, pinFive, new Set(), mulberry32(97200 + i), 97200 + i);
    if (!tagsOf(d).has("fivesome") || d.people < 5) fiveBad += 1;
  }
  eq("pin fivesome always has 5+ people", fiveBad, 0);

  const pinDH = applyPin(lex, new Set(), new Set(), "double handjob").pinned;
  let dhBad = 0;
  let dhArms = 0;
  for (let i = 0; i < 30; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinDH, new Set(), mulberry32(97300 + i), 97300 + i));
    const boys = (h.has("3boys") ? 3 : 0) || (h.has("2boys") ? 2 : 0) || (h.has("1boy") ? 1 : 0);
    if (!h.has("double handjob") || !h.has("handjob") || boys < 2) dhBad += 1;
    if (h.has("arms behind back") || h.has("arms behind head") || h.has("crossed arms")) dhArms += 1;
  }
  eq("pin double handjob keeps handjob and 2+ boys", dhBad, 0);
  eq("double handjob never auto both-arms poses", dhArms, 0);

  let lockedPair = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  lockedPair = applyPin(lex, lockedPair, new Set(), "1boy").pinned;
  let dhLeak = 0;
  for (let i = 0; i < 40; i++) {
    if (tagsOf(drawOne(lex, sexBoth, lockedPair, new Set(), mulberry32(97400 + i), 97400 + i)).has("double handjob")) dhLeak += 1;
  }
  eq("1girl+1boy never draws double handjob", dhLeak, 0);

  const pinFlaccid = applyPin(lex, new Set(), new Set(), "flaccid").pinned;
  let stateBad = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinFlaccid, new Set(), mulberry32(97500 + i), 97500 + i));
    if (h.has("erection") || h.has("half-erect") || h.has("precum") || h.has("precum drip") || h.has("twitching penis") || h.has("ejaculation")) stateBad += 1;
  }
  eq("flaccid blocks erection, precum, and ejaculation", stateBad, 0);

  const pinCumClothes = applyPin(lex, new Set(), new Set(), "cum on clothes").pinned;
  let nudeBad = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinCumClothes, new Set(), mulberry32(97600 + i), 97600 + i));
    if (h.has("nude") || h.has("completely nude")) nudeBad += 1;
  }
  eq("cum on clothes blocks full nude", nudeBad, 0);

  const pinAfter = applyPin(lex, new Set(), new Set(), "after ejaculation").pinned;
  let phaseBad = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinAfter, new Set(), mulberry32(97700 + i), 97700 + i));
    if (h.has("imminent penetration") || h.has("imminent fellatio") || h.has("precum")) phaseBad += 1;
  }
  eq("after ejaculation blocks imminent acts and precum", phaseBad, 0);

  let girlPenis = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, girlOnly, new Set(), new Set(), mulberry32(97800 + i), 97800 + i));
    if (["penis", "flaccid", "precum", "phimosis", "erection", "fivesome", "cum", "cum on body", "large testicles", "huge testicles", "small testicles", "covered testicles", "testicle sucking", "testicle grab", "stomach bulge", "cum on pussy", "nursing handjob", "straddling paizuri", "mutual masturbation", "licking nipple", "leg lock", "grabbing from behind", "kissing neck", "head between breasts", "breast smother", "spanking"].some((t) => h.has(t))) girlPenis += 1;
  }
  eq("girl-only sex does not emit penis or cum", girlPenis, 0);

  const boyOnlySex = settings();
  boyOnlySex.girl = false;
  boyOnlySex.boy = true;
  boyOnlySex.heats = ["sex"];
  boyOnlySex.weights = { tease: 0, flash: 0, sex: 1, activity: 0 };
  boyOnlySex.eras = ["modern"];
  const boyReceives = ["cum in mouth", "facial", "gokkun", "cum on tongue", "cum in ass", "penis on face", "penis over eyes", "cum pool", "cum on body", "stomach bulge", "cum on pussy", "nursing handjob", "straddling paizuri", "mutual masturbation", "licking nipple", "leg lock", "grabbing from behind", "kissing neck", "head between breasts", "breast smother", "spanking", "tentacle sex", "tentacles", "anal fingering", "folded", "spread ass", "sideboob", "underboob", "backboob", "bodystocking", "pasties", "torn thighhighs", "butt plug", "anal beads", "hickey", "crotch rope", "pussy juice trail", "pussy juice puddle", "torogao", "female ejaculation"];
  let boyRecv = 0;
  for (let i = 0; i < 24; i++) {
    const h = tagsOf(drawOne(lex, boyOnlySex, new Set(), new Set(), mulberry32(98920 + i), 98920 + i));
    if (boyReceives.some((t) => h.has(t))) boyRecv += 1;
  }
  eq("boy-only sex does not make the boy the one receiving cum", boyRecv, 0);

  let sawFive = 0;
  let fiveMiss = 0;
  for (let i = 0; i < 250; i++) {
    const d = drawOne(lex, sexBoth, new Set(), new Set(), mulberry32(97900 + i), 97900 + i);
    if (d.people >= 5) {
      sawFive += 1;
      if (!tagsOf(d).has("fivesome")) fiveMiss += 1;
    }
  }
  ok("both-gender sex sometimes reaches 5 people", sawFive > 0, `seen=${sawFive}`);
  eq("5-person sex is stamped fivesome", fiveMiss, 0);

  // 五人升級是另一條亂數，只看種子。釘了 solo 的抽，同一批種子不能被升級成五人。
  let soloFive = 0;
  for (let i = 0; i < 250; i++) {
    const d = drawOne(lex, sexBoth, new Set(["solo"]), new Set(), mulberry32(97900 + i), 97900 + i);
    if (d.people >= 5 || tagsOf(d).has("fivesome")) soloFive += 1;
  }
  eq("pinned solo is never upgraded to five", soloFive, 0);

  // 釘 solo 就是一個人：1girl／1boy 是單數，以前刪人數的 regex 對不上，會變成「1girl, 1boy, solo」；
  // 隨機抽到的人群也會把 solo 換成 solo focus。兩邊性別都開的性愛最容易撞到。
  let soloMany = 0;
  let soloGone = 0;
  for (let i = 0; i < 300; i++) {
    const d = drawOne(lex, sexBoth, new Set(["solo"]), new Set(), mulberry32(96400 + i), 96400 + i);
    if (d.people !== 1) soloMany += 1;
    if (!tagsOf(d).has("solo")) soloGone += 1;
  }
  eq("pinned solo draws exactly one person", soloMany, 0);
  eq("pinned solo stays solo (not solo focus)", soloGone, 0);
  // 釘了互相矛盾的 solo 和要兩人的牌：兩張都留（是使用者釘的），但要報相剋、點名是哪一張。
  eq("solo + hetero is a clash naming hetero", JSON.stringify(contradictions(lex, ["solo", "hetero"])), JSON.stringify([["solo_count", "solo", "hetero"]]));
  eq("solo + 1girl + 1boy is a clash", contradictions(lex, ["1girl", "1boy", "solo"]).length, 1);
  eq("1girl solo is not a clash", contradictions(lex, ["1girl", "solo"]).length, 0);
  // 疊印台拿釘選算相剋：卡司還沒補齊，釘 1girl＋口交不是打架（抽的時候會補男生）。只有補不起來的才報。
  for (const pins of [["1girl", "hetero"], ["1girl", "fellatio"], ["1boy", "paizuri"], ["1girl", "threesome"]]) {
    eq(`pins ${pins.join("+")} is not a clash on the proof sheet`, JSON.stringify(contradictions(lex, pins, { pins: true })), "[]");
  }
  eq("pins yuri + 2boys is a clash on the proof sheet", JSON.stringify(contradictions(lex, ["2boys", "yuri"], { pins: true })), JSON.stringify([["cast_need", "yuri", "2boys"]]));

  // 釘選和卡司：百合／磨鏡不能配男生；只開男生時 4P／5P 仍要補滿人數；單人焦點不能再寫 solo。
  const boyOnlyCast = settings();
  boyOnlyCast.girl = false;
  boyOnlyCast.boy = true;
  boyOnlyCast.heats = ["sex"];
  boyOnlyCast.weights = { tease: 0, flash: 0, sex: 1 };
  boyOnlyCast.eras = ["modern"];
  const girlCount = (h) => (h.has("5girls") ? 5 : h.has("4girls") ? 4 : h.has("3girls") ? 3 : h.has("2girls") ? 2 : h.has("multiple girls") ? 2 : h.has("1girl") ? 1 : 0);
  const boyCount = (h) => (h.has("3boys") ? 3 : h.has("2boys") ? 2 : h.has("multiple boys") ? 2 : h.has("1boy") ? 1 : 0);
  let yuriBad = 0;
  for (const tag of ["yuri", "tribadism"]) {
    const pin = applyPin(lex, new Set(), new Set(), tag).pinned;
    for (const scene of [sexBoth, boyOnlyCast]) {
      for (let i = 0; i < 30; i++) {
        const h = tagsOf(drawOne(lex, scene, pin, new Set(), mulberry32(99200 + i), 99200 + i));
        if (!h.has(tag) || boyCount(h) > 0 || girlCount(h) < 2) yuriBad += 1;
      }
    }
  }
  eq("pinned yuri and tribadism stay two or more girls and no boy", yuriBad, 0);

  // 排比胸、被胸包圍：男女都開時不能補成兩女兩男。釘了 1boy 就留一個男生，人數用女生補滿。
  // 協力性事仍要補男生。輪姦、以及排比胸再釘輪姦，不能被這條帶走。
  let girlCrowdBad = 0;
  for (const tag of ["bust chart", "surrounded by breasts"]) {
    const pin = applyPin(lex, new Set(), new Set(), tag).pinned;
    for (const scene of [sexBoth, girlOnly]) {
      for (let i = 0; i < 20; i++) {
        const d = drawOne(lex, scene, pin, new Set(), mulberry32(99500 + i), 99500 + i);
        const h = tagsOf(d);
        if (!h.has(tag) || d.people < 4 || girlCount(h) < 4 || boyCount(h) > 0) girlCrowdBad += 1;
      }
    }
  }
  eq("pinned bust chart and surrounded by breasts are four girls", girlCrowdBad, 0);

  let oneBoyBad = 0;
  for (const tag of ["bust chart", "surrounded by breasts"]) {
    let pin = applyPin(lex, new Set(), new Set(), tag).pinned;
    pin = applyPin(lex, pin, new Set(), "1boy").pinned;
    for (let i = 0; i < 10; i++) {
      const d = drawOne(lex, sexBoth, pin, new Set(), mulberry32(99620 + i), 99620 + i);
      const h = tagsOf(d);
      if (!h.has(tag) || !h.has("1boy") || h.has("2boys") || h.has("3boys") || girlCount(h) < 3 || d.people < 4) oneBoyBad += 1;
    }
  }
  eq("pinned 1boy on a girl crowd stays one boy and at least three girls", oneBoyBad, 0);

  let teamBad = 0;
  const pinTeam = applyPin(lex, new Set(), new Set(), "teamwork (sexual)").pinned;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinTeam, new Set(), mulberry32(99720 + i), 99720 + i));
    if (!h.has("teamwork (sexual)") || girlCount(h) < 2 || boyCount(h) < 1) teamBad += 1;
  }
  eq("pinned teamwork stays at least two girls and a boy", teamBad, 0);

  let gbCastBad = 0;
  const pinGbCast = applyPin(lex, new Set(), new Set(), "gangbang").pinned;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinGbCast, new Set(), mulberry32(99820 + i), 99820 + i));
    if (!h.has("gangbang") || boyCount(h) < 1 || girlCount(h) < 1) gbCastBad += 1;
  }
  let mixCrowdBad = 0;
  for (let i = 0; i < 10; i++) {
    let pin = applyPin(lex, new Set(), new Set(), "bust chart").pinned;
    pin = applyPin(lex, pin, new Set(), "gangbang").pinned;
    const h = tagsOf(drawOne(lex, sexBoth, pin, new Set(), mulberry32(99920 + i), 99920 + i));
    if (!h.has("gangbang") || !h.has("bust chart") || boyCount(h) < 1) mixCrowdBad += 1;
  }
  eq("pinned gangbang still has a boy, even beside bust chart", gbCastBad + mixCrowdBad, 0);

  let headBad = 0;
  for (const [tag, need] of [["foursome", 4], ["gangbang", 4], ["fivesome", 5]]) {
    const pin = applyPin(lex, new Set(), new Set(), tag).pinned;
    for (let i = 0; i < 20; i++) {
      const d = drawOne(lex, boyOnlyCast, pin, new Set(), mulberry32(99320 + i), 99320 + i);
      if (!tagsOf(d).has(tag) || d.people < need) headBad += 1;
    }
  }
  eq("boy-only pin of foursome, gangbang, or fivesome still fills the count", headBad, 0);

  let focusBad = 0;
  const pinFocus = applyPin(lex, new Set(), new Set(), "solo focus").pinned;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinFocus, new Set(), mulberry32(99440 + i), 99440 + i));
    if (!h.has("solo focus") || h.has("solo")) focusBad += 1;
  }
  eq("pinned solo focus is not also solo", focusBad, 0);
  ok("yuri with a boy is a cast clash", contradictions(lex, ["yuri", "1girl", "1boy"]).some((row) => row[0] === "cast_need" && row[1] === "yuri"));
  ok("foursome with one boy is a cast clash", contradictions(lex, ["foursome", "1boy"]).some((row) => row[0] === "cast_need" && row[1] === "foursome"));
  ok("solo and solo focus clash", contradictions(lex, ["solo", "solo focus", "1girl"]).some((row) => row[0] === "solo_focus"));

  let sawFour = 0;
  let fourMiss = 0;
  let strayFive = 0;
  for (let i = 0; i < 300; i++) {
    const d = drawOne(lex, girlOnly, new Set(), new Set(), mulberry32(98200 + i), 98200 + i);
    const h = tagsOf(d);
    if (h.has("5girls") || h.has("fivesome")) strayFive += 1;
    if (d.people === 4) {
      sawFour += 1;
      if (!h.has("foursome")) fourMiss += 1;
    }
  }
  eq("girl-only never rolls 5girls", strayFive, 0);
  ok("girl-only sex sometimes reaches 4 girls", sawFour > 0, `seen=${sawFour}`);
  eq("4-person sex is stamped foursome", fourMiss, 0);

  ok("large testicles is male skin", item("large testicles")?.section === "feature" && item("large testicles")?.layer === "skin" && item("large testicles")?.group === "body_m" && (item("large testicles")?.implies || []).includes("testicles") && (item("large testicles")?.implies || []).includes("penis"));
  ok("huge testicles stays off the sex group", item("huge testicles")?.group === "body_m");
  ok("small testicles is the other size", item("small testicles")?.section === "feature" && need("small testicles").includes("male"));
  ok("covered testicles can be flash", (item("covered testicles")?.heat || []).includes("flash") && (item("covered testicles")?.heat || []).includes("sex") && !(item("covered testicles")?.heat || []).includes("tease") && (item("covered testicles")?.implies || []).length === 0);
  ok("testicle sucking takes the sex act", item("testicle sucking")?.mutex === "sex_act" && need("testicle sucking").includes("pair") && (item("testicle sucking")?.implies || []).includes("testicles"));
  ok("testicle grab is not a sex act", item("testicle grab")?.mutex == null && need("testicle grab").includes("pair") && (item("testicle grab")?.implies || []).includes("penis"));
  ok("stomach bulge stacks with a position", item("stomach bulge")?.mutex == null && need("stomach bulge").includes("male") && need("stomach bulge").includes("female") && (item("stomach bulge")?.implies || []).includes("sex") && !(item("stomach bulge")?.implies || []).includes("vaginal"));
  ok("cum on pussy does not take the act", item("cum on pussy")?.mutex == null && (item("cum on pussy")?.implies || []).includes("cum") && !(item("cum on pussy")?.implies || []).includes("vaginal"));
  ok("nursing handjob is a handjob", item("nursing handjob")?.mutex === "sex_act" && need("nursing handjob").includes("pair") && need("nursing handjob").includes("female") && (item("nursing handjob")?.implies || []).includes("handjob"));
  ok("straddling paizuri keeps paizuri", item("straddling paizuri")?.mutex === "sex_act" && (item("straddling paizuri")?.implies || []).includes("paizuri") && (item("straddling paizuri")?.implies || []).includes("straddling"));
  ok("tentacle sex is one woman and tentacles", item("tentacle sex")?.mutex === "sex_act" && !need("tentacle sex").includes("pair") && !need("tentacle sex").includes("male") && need("tentacle sex").includes("female") && (item("tentacle sex")?.implies || []).includes("tentacles") && !(item("tentacle sex")?.implies || []).includes("sex"));
  ok("tentacles stay sex-only", (item("tentacles")?.heat || []).join(",") === "sex" && item("tentacles")?.group === "sex" && item("tentacles")?.gate === "female");
  ok("torogao is a sex face", item("torogao")?.mutex === "expression" && (item("torogao")?.heat || []).join(",") === "sex" && item("torogao")?.group === "face");
  ok("sideboob is her chest", item("sideboob")?.section === "feature" && item("sideboob")?.group === "body_f" && need("sideboob").includes("female") && !need("sideboob").includes("male"));
  ok("torn thighhighs keep the stocking", item("torn thighhighs")?.mutex === "legs" && (item("torn thighhighs")?.implies || []).includes("thighhighs") && (item("torn thighhighs")?.heat || []).includes("tease"));
  ok("butt plug stays out of tease", (item("butt plug")?.heat || []).join(",") === "sex" && (item("butt plug")?.implies || []).includes("sex toy") && item("butt plug")?.section === "pose");
  ok("spread ass is sex not flash", item("spread ass")?.group === "sex" && (item("spread ass")?.heat || []).includes("flash"));
  ok("kissing neck can be sensitive", item("kissing neck")?.group === "flash" && need("kissing neck").includes("male") && need("kissing neck").includes("female"));
  ok("bodystocking is one garment", item("bodystocking")?.mutex === "onepiece" && item("bodystocking")?.group === "onepiece");
  const pinTentacle = applyPin(lex, new Set(), new Set(), "tentacle sex").pinned;
  let tentacleBad = 0;
  for (let i = 0; i < 20; i++) {
    const d = drawOne(lex, girlOnly, pinTentacle, new Set(), mulberry32(98700 + i), 98700 + i);
    const h = tagsOf(d);
    // 兩女時「sex」自己進得了池（pair 成立）。觸手性交沒有 implies sex，所以單人不能帶出 sex，也不能帶出男生。
    if (!h.has("tentacle sex") || !h.has("tentacles") || h.has("1boy") || h.has("penis") || (d.people < 2 && h.has("sex"))) tentacleBad += 1;
  }
  eq("girl-only tentacle sex is her and tentacles", tentacleBad, 0);
  const pinNurse = applyPin(lex, new Set(), new Set(), "nursing handjob").pinned;
  let nurseBad = 0;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinNurse, new Set(), mulberry32(98800 + i), 98800 + i));
    const girls = (h.has("1girl") ? 1 : 0) + (h.has("2girls") ? 2 : 0);
    const boys = (h.has("1boy") ? 1 : 0) + (h.has("2boys") ? 2 : 0) + (h.has("3boys") ? 3 : 0);
    if (!h.has("nursing handjob") || !h.has("handjob") || girls < 1 || boys < 1 || h.has("arms behind back")) nurseBad += 1;
  }
  eq("nursing handjob is a woman, a man, and a free hand", nurseBad, 0);
  for (const tag of ["large testicles", "huge testicles", "small testicles", "covered testicles", "testicle sucking", "testicle grab"]) {
    ok(`${tag} is explicit-only`, explicitOnly(item(tag)));
  }
  const pinLarge = applyPin(lex, new Set(["huge testicles", "small testicles"]), new Set(), "large testicles").pinned;
  ok("large testicles drops the other sizes", pinLarge.has("large testicles") && !pinLarge.has("huge testicles") && !pinLarge.has("small testicles"));
  let sizeBad = 0;
  for (let i = 0; i < 30; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinLarge, new Set(), mulberry32(98500 + i), 98500 + i));
    if (!h.has("large testicles") || !h.has("testicles") || !h.has("penis") || h.has("huge testicles") || h.has("small testicles") || h.has("covered testicles")) sizeBad += 1;
  }
  eq("large testicles keeps the parent and blocks covered", sizeBad, 0);
  const pinCovered = applyPin(lex, new Set(), new Set(), "covered testicles").pinned;
  let coverBad = 0;
  for (let i = 0; i < 30; i++) {
    const h = tagsOf(drawOne(lex, sexBoth, pinCovered, new Set(), mulberry32(98600 + i), 98600 + i));
    if (h.has("nude") || h.has("completely nude") || h.has("large testicles") || h.has("testicles") || h.has("huge testicles") || h.has("small testicles")) coverBad += 1;
  }
  eq("covered testicles blocks nude and bare sizes", coverBad, 0);
  const pinSuck = applyPin(lex, new Set(), new Set(), "testicle sucking").pinned;
  let suckBad = 0;
  for (let i = 0; i < 24; i++) {
    const d = drawOne(lex, sexBoth, pinSuck, new Set(), mulberry32(98700 + i), 98700 + i);
    const h = tagsOf(d);
    if (!h.has("testicle sucking") || !h.has("testicles") || h.has("fellatio") || h.has("vaginal") || d.people < 2) suckBad += 1;
  }
  eq("testicle sucking keeps balls and blocks another act", suckBad, 0);
}

{
  ok("holding sex toy does not need pair", !((lex.byTag.get("holding sex toy")?.needs || []).includes("pair")));
  for (const tag of ["lifting person", "happy sex", "ass grab", "breast sucking"]) {
    ok(`${tag} needs pair`, (lex.byTag.get(tag)?.needs || []).includes("pair"));
  }
  ok("jack-o' challenge implies all fours", (lex.byTag.get("jack-o' challenge")?.implies || []).includes("all fours"));
  ok("standing on one leg implies standing", (lex.byTag.get("standing on one leg")?.implies || []).includes("standing"));
  const pinJack = applyPin(lex, new Set(["sitting"]), new Set(), "jack-o' challenge");
  ok("pin jack-o' challenge drops sitting", !pinJack.pinned.has("sitting"));
  ok("pin jack-o' challenge pins all fours", pinJack.pinned.has("all fours"));
}

{
  const ACT = ["bathing", "showering", "swimming", "wading", "floating"];
  for (const tag of ACT) {
    const it = lex.byTag.get(tag);
    ok(`${tag} is in the lexicon`, !!it);
    eq(`${tag} is a pose`, it?.section, "pose");
    eq(`${tag} mutex is activity`, it?.mutex, "activity");
  }
  ok("bathing mutexes swimming", mutexSiblings(lex, "bathing").includes("swimming"));
  ok("showering mutexes bathing", mutexSiblings(lex, "showering").includes("bathing"));
  ok("showering implies shower (place)", (lex.byTag.get("showering")?.implies || []).includes("shower (place)"));
  ok("showering is modern-only", JSON.stringify(lex.byTag.get("showering")?.era) === '["modern"]');
  ok("washing hair implies wet hair", (lex.byTag.get("washing hair")?.implies || []).includes("wet hair"));
  ok("washing back needs pair", (lex.byTag.get("washing back")?.needs || []).includes("pair"));
  ok("shared bathing needs pair", (lex.byTag.get("shared bathing")?.needs || []).includes("pair"));
  ok("shared bathing implies bathing", (lex.byTag.get("shared bathing")?.implies || []).includes("bathing"));
  ok("mixed-sex bathing implies bathing", (lex.byTag.get("mixed-sex bathing")?.implies || []).includes("bathing"));
  eq("ofuro is env", lex.byTag.get("ofuro")?.section, "env");
  eq("bathhouse is env", lex.byTag.get("bathhouse")?.section, "env");
  ok("ofuro implies bath", (lex.byTag.get("ofuro")?.implies || []).includes("bath"));
  const pinShower = applyPin(lex, new Set(), new Set(), "showering");
  ok("pin showering pins shower (place)", pinShower.pinned.has("showering") && pinShower.pinned.has("shower (place)"));
  const pinBath = applyPin(lex, new Set(["swimming"]), new Set(), "bathing");
  ok("pin bathing drops swimming", !pinBath.pinned.has("swimming") && pinBath.pinned.has("bathing"));
  const greeceHits = [];
  for (const d of eraDraws("ancient_greece", 60, 97000)) {
    const h = tagsOf(d);
    if (h.has("showering") || h.has("shower (place)") || h.has("onsen") || h.has("bathhouse") || h.has("ofuro")) {
      greeceHits.push([...h].filter((t) => ["showering", "shower (place)", "onsen", "bathhouse", "ofuro"].includes(t)).join(","));
    }
  }
  eq("ancient_greece: no modern shower or japanese bathhouse", greeceHits, []);
}

{
  const DAILY = [
    "eating",
    "drinking",
    "reading",
    "cooking",
    "shopping",
    "singing",
    "karaoke",
    "playing guitar",
    "playing games",
    "playing video games",
    "playing sports",
    "studying",
    "writing",
    "drawing (action)",
    "painting (action)",
    "stretching",
    "yoga",
    "exercising",
    "training",
    "fishing",
    "camping",
    "picnic",
    "hiking",
    "sunbathing",
    "smoking",
    "cleaning",
    "talking on phone",
    "selfie",
    "taking picture",
    "driving",
    "horseback riding",
    "riding bicycle",
  ];
  for (const tag of DAILY) {
    const it = lex.byTag.get(tag);
    ok(`${tag} is in the lexicon`, !!it);
    eq(`${tag} is a pose`, it?.section, "pose");
    eq(`${tag} mutex is activity`, it?.mutex, "activity");
  }
  ok("eating mutexes swimming", mutexSiblings(lex, "eating").includes("swimming"));
  ok("reading mutexes cooking", mutexSiblings(lex, "reading").includes("cooking"));
  ok("karaoke implies singing", (lex.byTag.get("karaoke")?.implies || []).includes("singing"));
  ok("playing video games implies playing games", (lex.byTag.get("playing video games")?.implies || []).includes("playing games"));
  ok("picnic implies outdoors", (lex.byTag.get("picnic")?.implies || []).includes("outdoors"));
  ok("picnic implies eating", (lex.byTag.get("picnic")?.implies || []).includes("eating"));
  ok("fishing implies outdoors", (lex.byTag.get("fishing")?.implies || []).includes("outdoors"));
  ok("camping implies outdoors", (lex.byTag.get("camping")?.implies || []).includes("outdoors"));
  ok("hiking implies outdoors", (lex.byTag.get("hiking")?.implies || []).includes("outdoors"));
  ok("sunbathing implies outdoors", (lex.byTag.get("sunbathing")?.implies || []).includes("outdoors"));
  ok("shopping is modern-only", JSON.stringify(lex.byTag.get("shopping")?.era) === '["modern"]');
  ok("talking on phone is modern-only", JSON.stringify(lex.byTag.get("talking on phone")?.era) === '["modern"]');
  const pinKara = applyPin(lex, new Set(["swimming"]), new Set(), "karaoke");
  ok("pin karaoke drops swimming", !pinKara.pinned.has("swimming"));
  ok("pin karaoke pins singing", pinKara.pinned.has("karaoke") && pinKara.pinned.has("singing"));
  const pinPic = applyPin(lex, new Set(), new Set(), "picnic");
  ok("pin picnic pins outdoors and eating", pinPic.pinned.has("outdoors") && pinPic.pinned.has("eating"));
  const MODERN_ACT = [
    "shopping",
    "karaoke",
    "playing video games",
    "talking on phone",
    "selfie",
    "driving",
    "riding bicycle",
  ];
  const greeceMod = [];
  for (const d of eraDraws("ancient_greece", 50, 97100)) {
    const h = tagsOf(d);
    for (const t of MODERN_ACT) if (h.has(t)) greeceMod.push(t);
  }
  eq("ancient_greece: no modern daily activities", [...new Set(greeceMod)], []);
}

{
  for (const tag of [
    "netorare",
    "cheating (relationship)",
    "groping",
    "chikan",
    "breastfeeding",
    "carrying",
    "size difference",
  ]) {
    ok(`${tag} needs pair`, (lex.byTag.get(tag)?.needs || []).includes("pair"));
  }
  ok("voyeurism does not need pair", !((lex.byTag.get("voyeurism")?.needs || []).includes("pair")));
  ok("gangbang needs group", (lex.byTag.get("gangbang")?.needs || []).includes("group"));
  ok("gangbang needs crowd", (lex.byTag.get("gangbang")?.needs || []).includes("crowd"));
  ok("gangbang implies group sex", (lex.byTag.get("gangbang")?.implies || []).includes("group sex"));
  ok("object insertion mutex is sex_act", lex.byTag.get("object insertion")?.mutex === "sex_act");
  ok("dildo implies sex toy", (lex.byTag.get("dildo")?.implies || []).includes("sex toy"));
  ok("breastfeeding implies lactation", (lex.byTag.get("breastfeeding")?.implies || []).includes("lactation"));
  // 原本用 pink nipples（0 張，2026-09-18 移除），換成同格同 gate 的 nipples。
  ok("nipples needs female", (lex.byTag.get("nipples")?.needs || []).includes("female"));
  ok("furrowed brow mutex is expression", lex.byTag.get("furrowed brow")?.mutex === "expression");
  ok("looking around mutex is gaze", lex.byTag.get("looking around")?.mutex === "gaze");
  eq("office lady mutex is job", lex.byTag.get("office lady")?.mutex, "job");
  ok("office lady implies pantyhose", (lex.byTag.get("office lady")?.implies || []).includes("pantyhose"));
  ok("office lady implies pencil skirt", (lex.byTag.get("office lady")?.implies || []).includes("pencil skirt"));
  ok("nurse implies nurse cap", (lex.byTag.get("nurse")?.implies || []).includes("nurse cap"));
  ok("doctor implies lab coat", (lex.byTag.get("doctor")?.implies || []).includes("lab coat"));
  ok("salaryman implies suit", (lex.byTag.get("salaryman")?.implies || []).includes("suit"));
  ok("salaryman needs male", (lex.byTag.get("salaryman")?.needs || []).includes("male"));
  ok("policewoman implies police uniform", (lex.byTag.get("policewoman")?.implies || []).includes("police uniform"));
  ok("waitress implies apron", (lex.byTag.get("waitress")?.implies || []).includes("apron"));
  ok("idol implies idol clothes", (lex.byTag.get("idol")?.implies || []).includes("idol clothes"));
  eq("fitness gym is env", lex.byTag.get("fitness gym")?.section, "env");
  eq("hospital is env", lex.byTag.get("hospital")?.section, "env");
  eq("locker room is env", lex.byTag.get("locker room")?.section, "env");
  const pinOl = applyPin(lex, new Set(["nurse"]), new Set(), "office lady");
  ok("pin office lady drops nurse", !pinOl.pinned.has("nurse"));
  ok(
    "pin office lady pins skirt clothes",
    pinOl.pinned.has("office lady") && pinOl.pinned.has("pantyhose") && pinOl.pinned.has("pencil skirt")
  );
  const pinGb = applyPin(lex, new Set(), new Set(), "gangbang").pinned;
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  let gbShort = 0;
  for (let i = 0; i < 30; i++) {
    const d = drawOne(lex, s, pinGb, new Set(), mulberry32(97200 + i), 97200 + i);
    if (!tagsOf(d).has("gangbang") || d.people < 4) gbShort += 1;
  }
  eq("pin gangbang always has 4+ people", gbShort, 0);
  const pinNtr = applyPin(lex, new Set(), new Set(), "netorare").pinned;
  let ntrSolo = 0;
  for (let i = 0; i < 20; i++) {
    const d = drawOne(lex, s, pinNtr, new Set(), mulberry32(97300 + i), 97300 + i);
    if (!tagsOf(d).has("netorare") || d.people < 2) ntrSolo += 1;
  }
  eq("pin netorare is a pair", ntrSolo, 0);
  const greeceJob = [];
  for (const d of eraDraws("ancient_greece", 40, 97400)) {
    const h = tagsOf(d);
    for (const t of ["nurse", "office lady", "condom", "fitness gym", "hospital", "locker room"]) {
      if (h.has(t)) greeceJob.push(t);
    }
  }
  eq("ancient_greece: no modern jobs or clinics", [...new Set(greeceJob)], []);
}

{
  const s = settings();
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  s.counts.pose = 20;
  const DAILY = [
    "shopping",
    "driving",
    "cooking",
    "karaoke",
    "playing video games",
    "studying",
    "riding bicycle",
    "hiking",
    "camping",
    "fishing",
  ];
  let daily = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(140000 + i), 140000 + i));
    if (DAILY.some((t) => h.has(t))) daily += 1;
  }
  eq("sex heat does not auto-draw daily activities", daily, 0);
  const pinShop = applyPin(lex, new Set(), new Set(), "shopping").pinned;
  const dShop = drawOne(lex, s, pinShop, new Set(), mulberry32(141000), 141000);
  ok("pin shopping still wins on sex heat", tagsOf(dShop).has("shopping"));
}

{
  eq("toggleHeat adds a second scale", toggleHeat(["tease"], "flash"), ["tease", "flash"]);
  eq("toggleHeat cannot drop the last scale", toggleHeat(["tease"], "tease"), ["tease"]);
  eq("toggleHeat drops one of three", toggleHeat(["tease", "flash", "sex"], "sex"), ["tease", "flash"]);
  eq("toggleHeat mixed selects all", toggleHeat(["tease"], "mixed"), ["tease", "flash", "sex"]);
  eq("toggleHeat adds activity", toggleHeat(["tease"], "activity"), ["activity", "tease"]);
  eq("toggleHeat mixed drops activity", toggleHeat(["activity"], "mixed"), ["tease", "flash", "sex"]);
  eq("heatPresetOf one is that heat", heatPresetOf(["sex"]), "sex");
  eq("heatPresetOf activity is activity", heatPresetOf(["activity"]), "activity");
  eq("heatPresetOf two is custom", heatPresetOf(["tease", "sex"]), "custom");
  eq("heatPresetOf three is mixed", heatPresetOf(["tease", "flash", "sex"]), "mixed");
  eq("heatPresetOf all four is custom", heatPresetOf(["activity", "tease", "flash", "sex"]), "custom");
  const pairW = weightsForHeats(["tease", "flash"]);
  eq("two heats split weight", pairW.tease, 0.5);
  eq("two heats leave the third at 0", pairW.sex, 0);
  const mixedW = weightsForHeats(["tease", "flash", "sex"], { mixed: { tease: 0.3, flash: 0.3, sex: 0.4 } });
  eq("all three keep mixed sex weight", mixedW.sex, 0.4);
  const pair = sanitizeSettings({ heats: ["tease", "flash"] }, data);
  eq("sanitize two heats is custom", pair.heatPreset, "custom");
  ok("sanitize two heats keeps flash", pair.heats.includes("flash") && !pair.heats.includes("sex"));
  eq("sanitize two heats zeros sex weight", pair.weights.sex, 0);
  const s = settings();
  s.heats = ["tease", "flash"];
  s.heatPreset = "custom";
  s.weights = { tease: 0.5, flash: 0.5, sex: 0 };
  s.girl = true;
  s.boy = true;
  s.eras = ["modern"];
  let sexAct = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(143000 + i), 143000 + i));
    if ([...h].some((t) => lex.byTag.get(t)?.mutex === "sex_act")) sexAct += 1;
  }
  eq("tease+flash never rolls a sex act", sexAct, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["tease"];
  s.weights = { tease: 1, flash: 0, sex: 0 };
  s.eras = ["modern"];
  let withAct = 0;
  let withSexAct = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(142000 + i), 142000 + i));
    const act = [...h].some((t) => lex.byTag.get(t)?.mutex === "activity");
    const sex = [...h].some((t) => lex.byTag.get(t)?.mutex === "sex_act");
    if (act) withAct += 1;
    if (sex) withSexAct += 1;
  }
  ok("tease heat usually draws one activity", withAct >= 32, `activity=${withAct}/40`);
  eq("tease heat does not draw a sex act", withSexAct, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.heatPreset = "activity";
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  let withAct = 0;
  let withSexAct = 0;
  let withFlash = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(144000 + i), 144000 + i));
    if ([...h].some((t) => lex.byTag.get(t)?.mutex === "activity")) withAct += 1;
    if ([...h].some((t) => lex.byTag.get(t)?.mutex === "sex_act")) withSexAct += 1;
    if ([...h].some((t) => lex.byTag.get(t)?.mutex === "clothes_action")) withFlash += 1;
  }
  ok("activity heat usually draws one activity", withAct >= 32, `activity=${withAct}/40`);
  eq("activity heat does not draw a sex act", withSexAct, 0);
  eq("activity heat does not draw clothes-off", withFlash, 0);
  ok(
    "cowgirl clashes with activity-only",
    heatMismatches(lex, new Set(["cowgirl position"]), ["activity"]).includes("cowgirl position")
  );
}

{
  for (const tag of [
    "amazon position",
    "spooning",
    "footjob",
    "anilingus",
    "suspended congress",
    "sex from behind",
    "grabbing another's breast",
    "grabbing another's ass",
    "grabbing another's hair",
    "guided breast grab",
  ]) {
    ok(`${tag} needs pair`, (lex.byTag.get(tag)?.needs || []).includes("pair"));
  }
  ok("object insertion stays solo-ok", !((lex.byTag.get("object insertion")?.needs || []).includes("pair")));
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["sex"];
  s.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  s.counts.pose = 12;
  const TWO_PERSON = [
    "amazon position",
    "spooning",
    "footjob",
    "anilingus",
    "grabbing another's breast",
    "grabbing another's ass",
    "grabbing another's hair",
    "guided breast grab",
    "groping",
    "kiss",
    "hug",
  ];
  let coupleOnSolo = 0;
  for (let i = 0; i < 50; i++) {
    const d = drawOne(lex, s, new Set(), new Set(), mulberry32(145000 + i), 145000 + i);
    const h = tagsOf(d);
    if (d.people === 1 && TWO_PERSON.some((t) => h.has(t))) coupleOnSolo += 1;
  }
  eq("girl-only sex never leftover two-person acts", coupleOnSolo, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["sex"];
  s.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  s.eras = ["modern"];
  s.counts.pose = 12;
  let pin = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  pin = applyPin(lex, pin, new Set(), "nude").pinned;
  let through = 0;
  let noSolo = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pin, new Set(), mulberry32(148000 + i), 148000 + i);
    const h = tagsOf(d);
    if (h.has("masturbation through clothes")) through += 1;
    // 自慰、指交，或任何不要求第二個人的性愛行為（機器、觸手、道具、產卵）。
    // 洗腦、催眠這種主題不佔體位格，不能拿來充數。
    const soloAct = [...h].some((t) => {
      if (t === "masturbation" || t === "female masturbation" || t === "fingering") return true;
      const it = lex.byTag.get(t);
      return !!it && it.mutex === "sex_act" && !(it.needs || []).includes("pair");
    });
    if (!soloAct) noSolo += 1;
  }
  eq("nude solo sex never through-clothes", through, 0);
  eq("nude solo sex still has a masturbation tag", noSolo, 0);
  const CLOTHES_ONLY = [
    "masturbation through clothes",
    "clothes lift",
    "clothes pull",
    "clothing aside",
    "undressing",
    "upskirt",
    "cameltoe",
    "wedgie",
    "flashing",
    "strap slip",
    "areola slip",
    "nipple slip",
    "one breast out",
    "erection under clothes",
    "bulge",
    "clothed sex",
    "paizuri under clothes",
    "clothed female nude male",
    "adjusting clothes",
    "clothes tug",
  ];
  let clothesOnNude = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pin, new Set(), mulberry32(149000 + i), 149000 + i);
    const h = tagsOf(d);
    if (CLOTHES_ONLY.some((t) => h.has(t))) clothesOnNude += 1;
  }
  eq("nude solo sex never clothes-only acts", clothesOnNude, 0);
  const flash = settings();
  flash.girl = true;
  flash.boy = false;
  flash.heats = ["flash"];
  flash.weights = { activity: 0, tease: 0, flash: 1, sex: 0 };
  flash.eras = ["modern"];
  let flashBad = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, flash, pin, new Set(), mulberry32(150000 + i), 150000 + i);
    const h = tagsOf(d);
    if (CLOTHES_ONLY.some((t) => h.has(t))) flashBad += 1;
  }
  eq("nude flash never clothes-only acts", flashBad, 0);
  const tease = settings();
  tease.girl = true;
  tease.boy = false;
  tease.heats = ["tease"];
  tease.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  tease.eras = ["modern"];
  tease.counts.pose = 12;
  let teaseBad = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, tease, pin, new Set(), mulberry32(151000 + i), 151000 + i);
    const h = tagsOf(d);
    if (CLOTHES_ONLY.some((t) => h.has(t))) teaseBad += 1;
  }
  eq("nude tease never clothes-only acts", teaseBad, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.counts.pose = 10;
  s.counts.env = 6;
  const pinOut = applyPin(lex, new Set(), new Set(), "outdoors").pinned;
  const indoorPlace = ["living room", "bathroom", "bedroom", "office", "classroom", "kitchen"];
  let indoorOnOut = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinOut, new Set(), mulberry32(152000 + i), 152000 + i));
    if (indoorPlace.some((t) => h.has(t))) indoorOnOut += 1;
  }
  eq("pin outdoors never auto indoor places", indoorOnOut, 0);
  const pinIn = applyPin(lex, new Set(), new Set(), "indoors").pinned;
  const outdoorAct = ["camping", "picnic", "hiking", "sunbathing", "beach"];
  let outOnIn = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinIn, new Set(), mulberry32(153000 + i), 153000 + i));
    if (outdoorAct.some((t) => h.has(t))) outOnIn += 1;
  }
  eq("pin indoors never auto outdoor activities/places", outOnIn, 0);
  const sex = settings();
  sex.girl = true;
  sex.boy = true;
  sex.heats = ["tease"];
  sex.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  sex.eras = ["modern"];
  const pinSex = applyPin(lex, new Set(), new Set(), "cowgirl position").pinned;
  const DAILY = ["shopping", "driving", "cooking", "studying", "karaoke", "hiking", "camping"];
  let dailyOnSex = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sex, pinSex, new Set(), mulberry32(154000 + i), 154000 + i));
    if (DAILY.some((t) => h.has(t))) dailyOnSex += 1;
  }
  eq("pinned sex act does not auto daily activity", dailyOnSex, 0);
}

{
  const pinHead = applyPin(lex, new Set(), new Set(), "shower head");
  ok("shower head pin walks to shower place", pinHead.pinned.has("shower (place)"));
  ok("shower head pin walks to indoors", pinHead.pinned.has("indoors"));
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["tease"];
  s.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.counts.env = 6;
  let out = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinHead.pinned, new Set(), mulberry32(155000 + i), 155000 + i));
    if (h.has("outdoors")) out += 1;
  }
  eq("pin shower head never auto outdoors", out, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  const pinSleep = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  const AWAKE = [
    "eating",
    "hiking",
    "swimming",
    "cooking",
    "reading",
    "dancing",
    "picnic",
    "stretching",
    "yoga",
    "studying",
    "sunbathing",
    "smoking",
    "drinking",
    "floating",
    "bathing",
    "showering",
  ];
  let awake = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSleep, new Set(), mulberry32(156000 + i), 156000 + i));
    if (AWAKE.some((t) => h.has(t))) awake += 1;
  }
  eq("sleeping never auto awake activities", awake, 0);
  const pinSeiza = applyPin(lex, new Set(), new Set(), "seiza").pinned;
  const MOVE = ["swimming", "horseback riding", "riding bicycle", "hiking", "wading"];
  let move = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSeiza, new Set(), mulberry32(157000 + i), 157000 + i));
    if (MOVE.some((t) => h.has(t))) move += 1;
  }
  eq("seiza never auto moving activities", move, 0);
  const pinHof = applyPin(lex, new Set(), new Set(), "head out of frame").pinned;
  const FACE = ["looking at viewer", "smile", "one eye closed", "ahegao", "closed eyes", "facial", "cum in mouth"];
  let face = 0;
  const tease = settings();
  tease.girl = true;
  tease.boy = false;
  tease.heats = ["tease"];
  tease.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  tease.eras = ["modern"];
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinHof, new Set(), mulberry32(158000 + i), 158000 + i));
    if (FACE.some((t) => h.has(t))) face += 1;
  }
  eq("head out of frame never auto face tags", face, 0);
  const sexS = settings();
  sexS.girl = true;
  sexS.boy = true;
  sexS.heats = ["sex"];
  sexS.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  sexS.eras = ["modern"];
  sexS.sceneMode = "diverse";
  let sexFace = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sexS, pinHof, new Set(), mulberry32(180000 + i), 180000 + i));
    if (["facial", "cum in mouth", "closed eyes", "looking at penis"].some((t) => h.has(t))) sexFace += 1;
  }
  eq("head out of frame never auto facial/cum in mouth", sexFace, 0);
  let lookPenis = 0;
  const boyHof = { ...sexS, girl: false, boy: true };
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, boyHof, pinHof, new Set(), mulberry32(245000 + i), 245000 + i));
    if ([...h].some((t) => t === "looking at penis" || /^looking /.test(t))) lookPenis += 1;
  }
  eq("head out of frame never auto looking at penis", lookPenis, 0);
  const pinClosed = applyPin(lex, new Set(), new Set(), "closed eyes").pinned;
  let hofAfter = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinClosed, new Set(), mulberry32(181000 + i), 181000 + i));
    if (h.has("head out of frame") || h.has("lower body")) hofAfter += 1;
  }
  eq("closed eyes never auto faceless camera", hofAfter, 0);
}

{
  const fat = settings();
  fat.girl = true;
  fat.boy = false;
  fat.heats = ["tease"];
  fat.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  fat.eras = ["modern"];
  fat.sceneMode = "normal";
  fat.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const EYE = ["one eye closed", "empty eyes", "sparkling eyes", "half-closed eyes", "rolling eyes"];
  const MOUTH = ["open mouth", "clenched teeth", "biting own lip", "tongue out", "parted lips", "licking lips", "drooling"];
  let twoEye = 0;
  let twoMouth = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, fat, new Set(), new Set(), mulberry32(190000 + i), 190000 + i));
    if (EYE.filter((t) => h.has(t)).length > 1) twoEye += 1;
    if (MOUTH.filter((t) => h.has(t)).length > 1) twoMouth += 1;
  }
  eq("pose10 never two leftover eye extras", twoEye, 0);
  eq("pose10 never two leftover mouth extras", twoMouth, 0);
  const pinSleepFat = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  fat.heats = ["activity"];
  fat.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  let sleepFace = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, fat, pinSleepFat, new Set(), mulberry32(191000 + i), 191000 + i));
    if ([...EYE, ...MOUTH].some((t) => h.has(t))) sleepFace += 1;
  }
  eq("sleeping pose10 never leftover eye/mouth extras", sleepFace, 0);
  const pinLivFat = applyPin(lex, new Set(), new Set(), "living room").pinned;
  let skyIn = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, fat, pinLivFat, new Set(), mulberry32(192000 + i), 192000 + i));
    if (["tree", "bush", "sky", "blue sky", "orange sky", "snow", "cherry blossoms"].some((t) => h.has(t))) {
      skyIn += 1;
    }
  }
  eq("indoors env10 never outdoor leftover sky/tree", skyIn, 0);
  const weird = { ...fat, sceneMode: "weird", lockScene: false, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  let weirdSky = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, weird, pinLivFat, new Set(), mulberry32(193000 + i), 193000 + i));
    if (["tree", "bush", "sky", "blue sky", "orange sky", "starry sky", "cherry blossoms"].some((t) => h.has(t))) {
      weirdSky += 1;
    }
  }
  eq("weird indoors env10 never outdoor leftover", weirdSky, 0);
  const pinKit = applyPin(lex, new Set(), new Set(), "kitchen").pinned;
  let bedKit = 0;
  let wetKit = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, fat, pinKit, new Set(), mulberry32(194000 + i), 194000 + i));
    if (h.has("on bed") || h.has("bed sheet")) bedKit += 1;
    if (h.has("partially submerged") || h.has("splashing")) wetKit += 1;
  }
  eq("kitchen pose10 never on bed leftover", bedKit, 0);
  eq("kitchen pose10 never water leftovers", wetKit, 0);
  const pinClosed2 = applyPin(lex, new Set(), new Set(), "closed eyes").pinned;
  let spark = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, fat, pinClosed2, new Set(), mulberry32(195000 + i), 195000 + i));
    if (["sparkling eyes", "one eye closed", "empty eyes", "looking at viewer", "looking ahead"].some((t) => h.has(t))) spark += 1;
  }
  eq("closed eyes never leftover sparkle/one eye closed/gaze", spark, 0);
  const pinOl = applyPin(lex, new Set(), new Set(), "office lady").pinned;
  const ol = { ...fat, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 }, eras: ["modern"], drawJob: true };
  let olOut = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, ol, pinOl, new Set(), mulberry32(196000 + i), 196000 + i));
    if (h.has("outdoors")) olOut += 1;
  }
  eq("normal office lady never auto outdoors", olOut, 0);
  const pinSwimSex = applyPin(lex, new Set(), new Set(), "swimming").pinned;
  const swimSex = settings();
  swimSex.girl = true;
  swimSex.boy = false;
  swimSex.heats = ["sex"];
  swimSex.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  swimSex.eras = ["victorian"];
  swimSex.sceneMode = "normal";
  swimSex.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const WATER2 = ["pool", "beach", "ocean", "underwater", "poolside", "pond"];
  let drySwim = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, swimSex, pinSwimSex, new Set(), mulberry32(197000 + i), 197000 + i));
    if (!WATER2.some((t) => h.has(t))) drySwim += 1;
  }
  eq("normal sex+pin swimming still has water place", drySwim, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.sceneMode = "normal";
  s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const pinSwim = applyPin(lex, new Set(), new Set(), "swimming").pinned;
  let plant = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSwim, new Set(), mulberry32(206000 + i), 206000 + i));
    if (["standing", "squatting", "kneeling", "on one knee"].some((t) => h.has(t))) plant += 1;
  }
  eq("swimming never auto standing/squatting/kneeling", plant, 0);
  const pinHofEyes = applyPin(lex, new Set(), new Set(), "head out of frame").pinned;
  let hofEyes = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinHofEyes, new Set(), mulberry32(301000 + i), 301000 + i));
    if (
      [...h].some((t) => {
        const it = lex.byTag.get(t);
        return it && (it.mutex === "eye_color" || it.group === "eyes");
      })
    ) {
      hofEyes += 1;
    }
  }
  eq("head out of frame never auto eye tags", hofEyes, 0);
  const pinJog = applyPin(lex, new Set(), new Set(), "jogging").pinned;
  let jogStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinJog, new Set(), mulberry32(302000 + i), 302000 + i));
    if (h.has("standing")) jogStand += 1;
  }
  eq("jogging never auto standing", jogStand, 0);
  const pinLook = applyPin(lex, new Set(), new Set(), "looking at viewer").pinned;
  let lookSleep = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinLook, new Set(), mulberry32(303000 + i), 303000 + i));
    if (h.has("sleeping")) lookSleep += 1;
  }
  eq("looking at viewer never auto sleeping", lookSleep, 0);
  {
    const actOnly = {
      ...s,
      heats: ["activity"],
      weights: { activity: 1, tease: 0, flash: 0, sex: 0 },
      sceneMode: "normal",
    };
    for (const p of BUILTIN_PRESETS) {
      let miss = 0;
      for (let i = 0; i < 12; i++) {
        const pinned = togglePresetTags(lex, p.tags, new Set());
        const h = tagsOf(drawOne(lex, actOnly, pinned, new Set(), mulberry32(410000 + i), 410000 + i));
        if (![...h].some((t) => lex.byTag.get(t)?.mutex === "activity")) miss += 1;
      }
      eq(`activity heat + ${p.id} always has activity`, miss, 0);
    }
    const pinGuitar = applyPin(lex, new Set(), new Set(), "playing guitar").pinned;
    let noGuitar = 0;
    for (let i = 0; i < 16; i++) {
      const h = tagsOf(drawOne(lex, actOnly, pinGuitar, new Set(), mulberry32(411000 + i), 411000 + i));
      if (!h.has("guitar")) noGuitar += 1;
    }
    eq("playing guitar brings guitar prop", noGuitar, 0);
    const pinFloat = applyPin(lex, new Set(), new Set(), "floating").pinned;
    let floatSit = 0;
    for (let i = 0; i < 24; i++) {
      const h = tagsOf(drawOne(lex, actOnly, pinFloat, new Set(), mulberry32(413000 + i), 413000 + i));
      if (h.has("sitting")) floatSit += 1;
    }
    eq("floating never auto sitting", floatSit, 0);
    const pinAmz = applyPin(lex, new Set(), new Set(), "amazon position").pinned;
    const sexS = {
      ...s,
      heats: ["sex"],
      weights: { activity: 0, tease: 0, flash: 0, sex: 1 },
      girl: true,
      boy: true,
    };
    let amzTd = 0;
    for (let i = 0; i < 24; i++) {
      const h = tagsOf(drawOne(lex, sexS, pinAmz, new Set(), mulberry32(414000 + i), 414000 + i));
      if (h.has("top-down bottom-up")) amzTd += 1;
    }
    eq("amazon position never auto top-down bottom-up", amzTd, 0);
    const pinPixie = applyPin(lex, new Set(), new Set(), "pixie cut").pinned;
    let pixieBun = 0;
    for (let i = 0; i < 24; i++) {
      const h = tagsOf(drawOne(lex, actOnly, pinPixie, new Set(), mulberry32(415000 + i), 415000 + i));
      if (h.has("double bun") || h.has("hair bun") || h.has("single hair bun")) pixieBun += 1;
    }
    eq("pixie cut never auto hair bun/double bun", pixieBun, 0);
    const pinDrive = applyPin(lex, new Set(), new Set(), "driving").pinned;
    let driveGlass = 0;
    for (let i = 0; i < 24; i++) {
      const h = tagsOf(drawOne(lex, actOnly, pinDrive, new Set(), mulberry32(416000 + i), 416000 + i));
      if (h.has("breasts on glass") || h.has("against glass") || h.has("breasts on table")) driveGlass += 1;
    }
    eq("driving never auto breasts on glass/table", driveGlass, 0);
    const pinCook = applyPin(lex, new Set(), new Set(), "cooking").pinned;
    let noPan = 0;
    const cookProps = new Set();
    for (let i = 0; i < 16; i++) {
      const h = tagsOf(drawOne(lex, actOnly, pinCook, new Set(), mulberry32(412000 + i), 412000 + i));
      const got = ["frying pan", "ladle"].filter((p) => h.has(p));
      if (!got.length) noPan += 1;
      for (const p of got) cookProps.add(p);
    }
    // 保證的是「煮飯一定帶得到廚具」，不是「一定是平底鍋」—— 後者只是當初
    // ACT_PROP.cooking 裡只有一個字的副產物。清單變成候選集合之後，平底鍋與
    // 湯杓各半，所以這裡問的是「有沒有拿到其中之一」。
    eq("cooking brings a cooking prop", noPan, 0);
    // 但放寬不能變成放水：只寫上面那條，把 ACT_PROP.cooking 改回單一個字
    // 也照樣通過。這條守住「真的有在隨機挑」。
    ok("cooking prop is not always the same one", cookProps.size >= 2, [...cookProps].join("/"));
    const sNorm = {
      ...s,
      heats: ["activity"],
      weights: { activity: 1, tease: 0, flash: 0, sex: 0 },
      sceneMode: "normal",
      lockScene: true,
      counts: { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 },
    };
    const pinLivN = applyPin(lex, new Set(), new Set(), "living room").pinned;
    let envJunk = 0;
    const envBad = [
      "beach umbrella",
      "innertube",
      "ocean",
      "pool",
      "golf club",
      "tennis racket",
      "basketball (object)",
      "mountain",
    ];
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sNorm, pinLivN, new Set(), mulberry32(417000 + i), 417000 + i));
      if (envBad.some((t) => h.has(t))) envJunk += 1;
    }
    eq("normal living room never leftover water/sport env", envJunk, 0);
    const pinPoolN = applyPresetTags(lex, BUILTIN_PRESETS.find((p) => p.id === "pool").tags, new Set());
    let clothJunk = 0;
    const clothBad = ["clipboard", "necktie", "bowtie", "stethoscope", "nurse cap", "hard hat", "police hat", "lab coat"];
    for (let i = 0; i < 40; i++) {
      const d = drawOne(lex, sNorm, pinPoolN, new Set(), mulberry32(418000 + i), 418000 + i);
      if (d.sections.clothing.some((t) => clothBad.includes(t))) clothJunk += 1;
    }
    eq("normal pool never leftover job/office accessories", clothJunk, 0);
    let shoeSock = 0;
    for (let i = 0; i < 80; i++) {
      const h = tagsOf(drawOne(lex, sNorm, new Set(), new Set(), mulberry32(419000 + i), 419000 + i));
      if (
        ["sandals", "boots", "sneakers", "geta", "shoes", "zouri", "pantyhose", "kneehighs", "white socks"].some((t) =>
          h.has(t)
        )
      ) {
        shoeSock += 1;
      }
    }
    ok("normal still draws shoes or socks", shoeSock > 0, `shoeSock=${shoeSock}/80`);
    const pinSwimN = applyPin(lex, new Set(), new Set(), "swimming").pinned;
    let swimBoots = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sNorm, pinSwimN, new Set(), mulberry32(421000 + i), 421000 + i));
      if (h.has("boots") || h.has("sneakers") || h.has("high heels")) swimBoots += 1;
    }
    eq("pinned swimming never leftover boots/sneakers/heels", swimBoots, 0);
  }
  const pinHof2 = applyPin(lex, new Set(), new Set(), "head out of frame").pinned;
  const tease = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  let hofMouth = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinHof2, new Set(), mulberry32(207000 + i), 207000 + i));
    if (["french kiss", "finger to mouth", "eating", "covering own mouth"].some((t) => h.has(t))) hofMouth += 1;
  }
  eq("head out of frame never auto mouth acts", hofMouth, 0);
  const pinSleep3 = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  let sleepLook = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSleep3, new Set(), mulberry32(208000 + i), 208000 + i));
    if ([...h].some((t) => t.startsWith("looking ") || t === "kiss")) sleepLook += 1;
  }
  eq("sleeping never auto looking/kiss leftovers", sleepLook, 0);
  // kissing 在 2026-09-17 被 Danbooru 別名併成 kiss 之後，allow() 裡兩處
  // `t === "kissing"` 變成永遠比不到。睡著擋視線那條有 `/^looking /` 仍活著，
  // 但「先釘接吻再抽睡著」只靠那個死字。詞庫裡 kiss 要 pair，所以上面那條
  // 單人測試看不見這條路。同一組 seed 218000 起 400 張，修前 1 張睡著。
  const pinKissSleep = applyPin(lex, new Set(), new Set(), "kiss").pinned;
  const kissPair = {
    ...s,
    girl: true,
    boy: true,
    heats: ["tease"],
    weights: { activity: 0, tease: 1, flash: 0, sex: 0 },
  };
  let kissSleep = 0;
  for (let i = 0; i < 400; i++) {
    const h = tagsOf(drawOne(lex, kissPair, pinKissSleep, new Set(), mulberry32(218000 + i), 218000 + i));
    if (h.has("sleeping")) kissSleep += 1;
  }
  eq("pinned kiss never auto sleeping", kissSleep, 0);
  const boyN = { ...s, girl: false, boy: true, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  let raceMale = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, boyN, new Set(), new Set(), mulberry32(209000 + i), 209000 + i));
    if (h.has("dark-skinned male")) raceMale += 1;
  }
  eq("normal mode never auto dark-skinned male", raceMale, 0);
}

{
  const tease = settings();
  tease.girl = true;
  tease.boy = false;
  tease.heats = ["tease"];
  tease.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  tease.eras = ["modern"];
  const pinDay = applyPin(lex, new Set(), new Set(), "day").pinned;
  let stars = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinDay, new Set(), mulberry32(159000 + i), 159000 + i));
    if (h.has("starry sky") || h.has("moonlight")) stars += 1;
  }
  eq("day never auto starry sky or moonlight", stars, 0);
  const pinSun = applyPin(lex, new Set(), new Set(), "sunbathing").pinned;
  let nightSun = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinSun, new Set(), mulberry32(175000 + i), 175000 + i));
    if (h.has("night") || h.has("starry sky") || h.has("moonlight")) nightSun += 1;
  }
  eq("sunbathing never auto night/starry/moonlight", nightSun, 0);
  const pinNight = applyPin(lex, new Set(), new Set(), "night").pinned;
  let dayNight = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinNight, new Set(), mulberry32(176000 + i), 176000 + i));
    if (h.has("sunlight") || h.has("sunbathing") || h.has("blue sky")) dayNight += 1;
  }
  eq("night never auto sunlight/sunbathing/blue sky", dayNight, 0);
  const pinBlue = applyPin(lex, new Set(), new Set(), "blue sky").pinned;
  let blueStars = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinBlue, new Set(), mulberry32(182000 + i), 182000 + i));
    if (h.has("starry sky") || h.has("moonlight") || h.has("night")) blueStars += 1;
  }
  eq("blue sky never auto starry/moonlight/night", blueStars, 0);
  const pinMoon = applyPin(lex, new Set(), new Set(), "moonlight").pinned;
  let moonDay = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, tease, pinMoon, new Set(), mulberry32(183000 + i), 183000 + i));
    if (h.has("orange sky") || h.has("blue sky") || h.has("sunlight")) moonDay += 1;
  }
  eq("moonlight never auto orange/blue sky or sunlight", moonDay, 0);
  const pinDrive = applyPin(lex, new Set(), new Set(), "driving").pinned;
  const actS = settings();
  actS.girl = true;
  actS.boy = false;
  actS.heats = ["activity"];
  actS.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  actS.eras = ["modern"];
  actS.sceneMode = "diverse";
  let groundDrive = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, actS, pinDrive, new Set(), mulberry32(177000 + i), 177000 + i));
    if (["all fours", "crawling", "top-down bottom-up"].some((t) => h.has(t))) groundDrive += 1;
  }
  eq("driving never auto ground body", groundDrive, 0);
  let lieDrive = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, actS, pinDrive, new Set(), mulberry32(184000 + i), 184000 + i));
    if (["on stomach", "on back", "on side", "sleeping"].some((t) => h.has(t))) lieDrive += 1;
  }
  eq("driving never auto lying/sleeping body", lieDrive, 0);
  const pinSleep2 = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  let wash = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, actS, pinSleep2, new Set(), mulberry32(178000 + i), 178000 + i));
    if (h.has("partially submerged")) wash += 1;
  }
  eq("sleeping never auto partially submerged", wash, 0);
}

{
  eq("sanitize clamps counts to 10", sanitizeSettings({ counts: { pose: 99, env: 15 } }, data).counts.pose, 10);
  eq("sanitize clamps env count to 10", sanitizeSettings({ counts: { env: 15 } }, data).counts.env, 10);
}

{
  eq("sceneMode defaults normal", defaultSettings(data).sceneMode, "normal");
  eq("lockScene defaults on", defaultSettings(data).lockScene, true);
  eq("sanitize lockScene false becomes weird", sanitizeSettings({ lockScene: false }, data).sceneMode, "weird");
  eq("sanitize sceneMode diverse", sanitizeSettings({ sceneMode: "diverse" }, data).sceneMode, "diverse");
  eq("sceneModeOf weird", sceneModeOf({ sceneMode: "weird" }), "weird");
  ok("SCENE_MODES has three", SCENE_MODES.length === 3);
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.lockScene = true;
  s.counts.env = 6;
  const pinSwim = applyPin(lex, new Set(), new Set(), "swimming").pinned;
  const WATER = ["pool", "poolside", "pool ladder", "beach", "ocean", "underwater", "bathtub", "bathroom", "shower (place)", "onsen", "ofuro", "bathhouse", "bubble bath", "bath"];
  let dry = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSwim, new Set(), mulberry32(160000 + i), 160000 + i));
    if (!WATER.some((t) => h.has(t))) dry += 1;
  }
  eq("lockScene swimming always has water place", dry, 0);
  const pinLiv = applyPin(lex, new Set(), new Set(), "living room").pinned;
  let wet = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinLiv, new Set(), mulberry32(161000 + i), 161000 + i));
    if (["swimming", "wading", "horseback riding", "hiking"].some((t) => h.has(t))) wet += 1;
  }
  eq("lockScene living room never swim/horse/hike", wet, 0);
  const pinOfuro = applyPin(lex, new Set(), new Set(), "ofuro").pinned;
  let shoes = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinOfuro, new Set(), mulberry32(162000 + i), 162000 + i));
    if (["geta", "zouri", "boots", "sneakers"].some((t) => h.has(t))) shoes += 1;
  }
  eq("lockScene ofuro never outdoor shoes", shoes, 0);
  const pinBath = applyPin(lex, new Set(), new Set(), "bathing").pinned;
  let castle = 0;
  const med = { ...s, eras: ["medieval"] };
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, med, pinBath, new Set(), mulberry32(163000 + i), 163000 + i));
    if (h.has("castle")) castle += 1;
  }
  eq("lockScene bathing never castle", castle, 0);
  const pinPicnic = applyPin(lex, new Set(), new Set(), "picnic").pinned;
  let under = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinPicnic, new Set(), mulberry32(164000 + i), 164000 + i));
    if (h.has("underwater") || h.has("ocean") || h.has("pool")) under += 1;
  }
  eq("lockScene picnic never underwater/ocean/pool", under, 0);
  const pinPark = applyPin(lex, new Set(), new Set(), "park").pinned;
  let indoorLeftover = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinPark, new Set(), mulberry32(189000 + i), 189000 + i));
    if (["tatami", "office chair", "gaming chair", "swivel chair", "shoji", "carpet"].some((t) => h.has(t))) {
      indoorLeftover += 1;
    }
  }
  eq("lockScene park never indoor floor/office chair", indoorLeftover, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.lockScene = true;
  const pinCrawl = applyPin(lex, new Set(), new Set(), "crawling").pinned;
  let picnic = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinCrawl, new Set(), mulberry32(165000 + i), 165000 + i));
    if (h.has("picnic") || h.has("eating")) picnic += 1;
  }
  eq("crawling never auto picnic/eating", picnic, 0);
  const pinDance = applyPin(lex, new Set(), new Set(), "dancing").pinned;
  let study = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinDance, new Set(), mulberry32(166000 + i), 166000 + i));
    if (h.has("studying") || h.has("writing") || h.has("reading")) study += 1;
  }
  eq("dancing never auto studying/writing/reading", study, 0);
  const pinSquat = applyPin(lex, new Set(), new Set(), "squatting").pinned;
  let horse = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSquat, new Set(), mulberry32(167000 + i), 167000 + i));
    if (h.has("horseback riding")) horse += 1;
  }
  eq("squatting never auto horseback riding", horse, 0);
  const pinFloat = applyPin(lex, new Set(), new Set(), "floating").pinned;
  const PLANTED = ["crawling", "all fours", "squatting", "standing", "kneeling", "on one knee", "seiza", "wariza", "indian style", "dancing"];
  let planted = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinFloat, new Set(), mulberry32(168000 + i), 168000 + i));
    if (PLANTED.some((t) => h.has(t))) planted += 1;
  }
  eq("floating never auto planted body poses", planted, 0);
  const pinGames = applyPin(lex, new Set(), new Set(), "playing games").pinned;
  let fours = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinGames, new Set(), mulberry32(170000 + i), 170000 + i));
    if (h.has("all fours") || h.has("crawling") || h.has("top-down bottom-up")) fours += 1;
  }
  eq("playing games never auto ground body", fours, 0);
  const pinDance2 = applyPin(lex, new Set(), new Set(), "dancing").pinned;
  let yoga = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinDance2, new Set(), mulberry32(171000 + i), 171000 + i));
    if (h.has("yoga") || h.has("stretching")) yoga += 1;
  }
  eq("dancing never auto yoga/stretching", yoga, 0);
}

{
  const s = settings();
  s.girl = false;
  s.boy = true;
  s.heats = ["tease"];
  s.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.sceneMode = "normal";
  s.lockScene = true;
  let race = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(172000 + i), 172000 + i));
    if ([...h].some((t) => lex.byTag.get(t)?.mutex === "race")) race += 1;
  }
  eq("normal mode never auto male race", race, 0);
  const pinDoc = applyPin(lex, new Set(), new Set(), "doctor").pinned;
  s.drawJob = true;
  let bath = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinDoc, new Set(), mulberry32(173000 + i), 173000 + i));
    if (["bathhouse", "ofuro", "onsen", "bathroom", "bathtub"].some((t) => h.has(t))) bath += 1;
  }
  eq("normal doctor never auto bath place", bath, 0);
  const pinGuitar = applyPin(lex, new Set(), new Set(), "playing guitar").pinned;
  const lock = settings();
  lock.girl = true;
  lock.boy = false;
  lock.heats = ["activity"];
  lock.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  lock.eras = ["modern"];
  lock.sceneMode = "diverse";
  lock.lockScene = true;
  lock.counts.env = 6;
  let guitarBath = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, lock, pinGuitar, new Set(), mulberry32(174000 + i), 174000 + i));
    if (["bathtub", "ofuro", "bathhouse", "bathroom", "shower (place)"].some((t) => h.has(t))) guitarBath += 1;
  }
  eq("lockScene guitar never bath place", guitarBath, 0);
  const pinCook = applyPin(lex, new Set(), new Set(), "cooking").pinned;
  let dryCook = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, lock, pinCook, new Set(), mulberry32(179000 + i), 179000 + i));
    if (h.has("cooking") && !h.has("kitchen")) dryCook += 1;
  }
  eq("lockScene cooking always has kitchen", dryCook, 0);
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.sceneMode = "normal";
  s.lockScene = true;
  s.counts.env = 6;
  const pinStudy = applyPin(lex, new Set(), new Set(), "studying").pinned;
  const med = { ...s, eras: ["medieval"] };
  let studyCastle = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, med, pinStudy, new Set(), mulberry32(185000 + i), 185000 + i));
    if (["castle", "beach", "onsen", "ocean", "underwater"].some((t) => h.has(t))) studyCastle += 1;
  }
  eq("normal studying never castle/beach/onsen", studyCastle, 0);
  const pinVg = applyPin(lex, new Set(), new Set(), "playing video games").pinned;
  const mod = { ...s, eras: ["modern"] };
  let vgOut = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, mod, pinVg, new Set(), mulberry32(186000 + i), 186000 + i));
    if (["beach", "castle", "onsen", "street", "forest", "ocean"].some((t) => h.has(t))) vgOut += 1;
  }
  eq("normal video games never outdoor/bath places", vgOut, 0);
  const pinEat = applyPin(lex, new Set(), new Set(), "eating").pinned;
  let eatWet = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, mod, pinEat, new Set(), mulberry32(187000 + i), 187000 + i));
    if (["shower (place)", "underwater", "ocean", "pool"].some((t) => h.has(t))) eatWet += 1;
  }
  eq("normal eating never shower/underwater/pool", eatWet, 0);
  const pinRead = applyPin(lex, new Set(), new Set(), "reading").pinned;
  const READ_OK = [
    "library",
    "bedroom",
    "living room",
    "cafe",
    "classroom",
    "clubroom",
    "maid cafe",
    "park bench",
    "garden",
    "shrine",
    "pavilion",
    "office",
    "train",
    "train interior",
    // 2026-09-15 加的：這些也是坐得下來看書的地方。判斷標準是「一個人會不會
    // 在那裡坐著看書」—— 公寓、旅館房間、宅邸、宮殿、王座、旅籠、陽台、
    // 中庭、被爐、帳篷都會；城堡、大廳、酒館、舞廳不算，所以沒有列進來。
    //（原本還有宿舍，但 dormitory 在 Danbooru 是 0 張，2026-09-18 移除。）
    "apartment",
    "hotel room",
    "mansion",
    "palace",
    "throne",
    "throne room",
    "ryokan",
    "balcony",
    "courtyard",
    "futon",
    "tent",
  ];
  let readMiss = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, mod, pinRead, new Set(), mulberry32(188000 + i), 188000 + i));
    if (!READ_OK.some((t) => h.has(t))) readMiss += 1;
  }
  eq("normal reading always has a reading place", readMiss, 0);
}

{
  eq("drawJob defaults off", defaultSettings(data).drawJob, false);
  eq("sanitize keeps drawJob on", sanitizeSettings({ drawJob: true }, data).drawJob, true);
  const off = settings();
  off.girl = true;
  off.boy = false;
  off.heats = ["tease"];
  off.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  off.eras = ["modern"];
  off.drawJob = false;
  let jobsOff = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, off, new Set(), new Set(), mulberry32(146000 + i), 146000 + i));
    if ([...h].some((t) => lex.byTag.get(t)?.mutex === "job")) jobsOff += 1;
  }
  eq("drawJob off does not auto-draw a job", jobsOff, 0);
  const on = { ...off, drawJob: true };
  let jobsOn = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, on, new Set(), new Set(), mulberry32(147000 + i), 147000 + i));
    if ([...h].some((t) => lex.byTag.get(t)?.mutex === "job")) jobsOn += 1;
  }
  ok("drawJob on usually draws a job", jobsOn >= 32, `jobs=${jobsOn}/40`);
}

{
  ok("builtin presets exist", BUILTIN_PRESETS.length >= 4);
  const ol = BUILTIN_PRESETS.find((p) => p.id === "ol-office");
  const haveBoobs = applyPin(lex, new Set(), new Set(), "huge breasts").pinned;
  ok("huge breasts pin sticks", haveBoobs.has("huge breasts"));
  const pool = BUILTIN_PRESETS.find((p) => p.id === "pool");
  const merged = applyPresetTags(lex, pool.tags, haveBoobs);
  ok("pool preset keeps huge breasts", merged.has("huge breasts"));
  ok("pool preset pins pool", merged.has("pool"));
  ok("pool preset pins swimming", merged.has("swimming"));
  const haveRoom = applyPin(lex, haveBoobs, new Set(), "living room").pinned;
  const merged2 = applyPresetTags(lex, pool.tags, haveRoom);
  ok("pool preset drops living room", !merged2.has("living room") && merged2.has("huge breasts"));
  const haveDress = applyPin(lex, haveBoobs, new Set(), "evening gown").pinned;
  const merged3 = applyPresetTags(lex, pool.tags, haveDress);
  ok("pool preset drops evening gown", !merged3.has("evening gown") && merged3.has("huge breasts"));
  ok("pool preset starts active", presetActive(lex, pool.tags, merged));
  ok("huge breasts only is not pool-active", !presetActive(lex, pool.tags, haveBoobs));
  const cleared = clearPresetTags(lex, pool.tags, merged);
  ok("clear pool keeps huge breasts", cleared.has("huge breasts"));
  ok("clear pool drops pool", !cleared.has("pool"));
  ok("clear pool drops swimming", !cleared.has("swimming"));
  ok("cleared pool is not active", !presetActive(lex, pool.tags, cleared));
  const togOn = togglePresetTags(lex, pool.tags, haveBoobs);
  ok("toggle on pins pool", togOn.has("pool") && togOn.has("huge breasts"));
  const togOff = togglePresetTags(lex, pool.tags, togOn);
  ok("toggle off drops pool keeps boobs", !togOff.has("pool") && !togOff.has("swimming") && togOff.has("huge breasts"));
  {
    const cabin = BUILTIN_PRESETS.find((p) => p.id === "cabin");
    const xmas = BUILTIN_PRESETS.find((p) => p.id === "xmas");
    const hoops = BUILTIN_PRESETS.find((p) => p.id === "hoops");
    const cabinOn = togglePresetTags(lex, cabin.tags, haveBoobs);
    const xmasOn = togglePresetTags(lex, xmas.tags, cabinOn);
    ok("switching preset drops previous combo", !xmasOn.has("flight attendant") && !xmasOn.has("airplane interior"));
    ok("switching preset keeps identity", xmasOn.has("huge breasts") && xmasOn.has("santa costume"));
    ok("only new preset is active", !presetActive(lex, cabin.tags, xmasOn) && presetActive(lex, xmas.tags, xmasOn));
    const cabinOn2 = togglePresetTags(lex, cabin.tags, haveBoobs);
    const hoopsOn = togglePresetTags(lex, hoops.tags, cabinOn2);
    ok("court preset drops cabin from POS", !hoopsOn.has("flight attendant") && !hoopsOn.has("airplane interior") && hoopsOn.has("basketball court") && hoopsOn.has("huge breasts"));
    ok("only court preset is active", !presetActive(lex, cabin.tags, hoopsOn) && presetActive(lex, hoops.tags, hoopsOn));
    const hoopsOff = togglePresetTags(lex, hoops.tags, hoopsOn);
    ok("second click drops the only preset", !hoopsOff.has("basketball court") && hoopsOff.has("huge breasts") && !presetActive(lex, hoops.tags, hoopsOff));
  }
  {
    const sClear = settings();
    sClear.girl = true;
    sClear.boy = false;
    sClear.heats = ["activity"];
    sClear.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
    sClear.eras = ["modern"];
    sClear.sceneMode = "normal";
    let forced = 0;
    for (let i = 0; i < 20; i++) {
      const h = tagsOf(drawOne(lex, sClear, togOff, new Set(), mulberry32(275000 + i), 275000 + i));
      if (h.has("pool") && h.has("swimming")) forced += 1;
    }
    ok("cleared pool combo is not forced into every POS", forced < 16, `both=${forced}/20`);
  }
  const olPins = applyPresetTags(lex, ol.tags);
  ok("OL preset pins office lady", olPins.has("office lady"));
  ok("OL preset pins pantyhose", olPins.has("pantyhose"));
  ok("OL preset pins office", olPins.has("office"));
  const onsen = BUILTIN_PRESETS.find((p) => p.id === "onsen");
  const onsenPins = applyPresetTags(lex, onsen.tags);
  ok("onsen preset pins onsen", onsenPins.has("onsen"));
  ok("onsen preset pins bathing", onsenPins.has("bathing"));
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.sceneMode = "normal";
  s.lockScene = true;
  s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const pinPool = applyPresetTags(lex, pool.tags, new Set());
  let badCloth = 0;
  for (let i = 0; i < 40; i++) {
    const d = drawOne(lex, s, pinPool, new Set(), mulberry32(198000 + i), 198000 + i);
    const cloth = d.sections.clothing.filter((t) => {
      const it = lex.byTag.get(t);
      if (!it || it.section !== "clothing" || it.layer !== "garment") return false;
      if (it.tag === "wet clothes") return false;
      if (/\b(swimsuit|bikini)\b/.test(it.tag)) return false;
      if ((it.implies || []).some((x) => /\b(swimsuit|bikini)\b/.test(x))) return false;
      return true;
    });
    if (cloth.length) badCloth += 1;
  }
  eq("normal pool preset never auto office/armor garments", badCloth, 0);

  function presetBad(id, seed, isBad) {
    const p = BUILTIN_PRESETS.find((x) => x.id === id);
    const pin = applyPresetTags(lex, p.tags, new Set());
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const d = drawOne(lex, s, pin, new Set(), mulberry32(seed + i), seed + i);
      const cloth = d.sections.clothing.filter((t) => {
        const it = lex.byTag.get(t);
        if (!it || it.layer !== "garment") return false;
        return isBad(it.tag);
      });
      if (cloth.length) n += 1;
    }
    return n;
  }
  eq(
    "normal onsen never auto armor/suit/sneakers",
    presetBad("onsen", 199000, (t) => /\b(armor|suit|sneakers|boots|geta|idol clothes|latex)\b/.test(t)),
    0
  );
  eq(
    "normal classroom never auto swimsuit/armor/maid",
    presetBad("classroom", 200000, (t) => /\b(swimsuit|bikini|armor|maid)\b/.test(t)),
    0
  );
  eq(
    "normal OL never auto swimsuit/armor/maid",
    presetBad("ol-office", 201000, (t) => /\b(swimsuit|bikini|armor|maid|hakama)\b/.test(t)),
    0
  );
  eq(
    "normal nurse never auto swimsuit/armor/maid",
    presetBad("nurse", 202000, (t) => /\b(swimsuit|bikini|armor|maid|hakama|serafuku)\b/.test(t)),
    0
  );
  eq(
    "normal maid never auto swimsuit/armor/school uniform",
    presetBad("maid", 203000, (t) => /\b(swimsuit|bikini|armor|school uniform|police)\b/.test(t)),
    0
  );
  eq(
    "normal police never auto swimsuit/maid/hakama",
    presetBad("police", 204000, (t) => /\b(swimsuit|bikini|maid|hakama|armor)\b/.test(t)),
    0
  );
  eq(
    "normal beach never auto armor/suit",
    presetBad("beach", 205000, (t) => /\b(armor|suit|hakama)\b/.test(t) && !/\b(swimsuit|bikini)\b/.test(t)),
    0
  );
  eq(
    "normal onsen never auto gym/swimsuit/coat/sportswear",
    presetBad("onsen", 220000, (t) =>
      /\b(gym uniform|swimsuit|bikini|lab coat|sports bra|evening gown|necktie|hoodie|shirt)\b/.test(t) ||
      /fishnet/.test(t) ||
      /\bcoat\b/.test(t)
    ),
    0
  );
  eq(
    "normal classroom never auto wedding dress/hard hat",
    presetBad("classroom", 221000, (t) => /\b(wedding dress|hard hat)\b/.test(t)),
    0
  );
  eq(
    "normal nurse never auto wedding dress",
    presetBad("nurse", 223000, (t) => /\b(wedding dress)\b/.test(t)),
    0
  );
  {
    const pinMaid = applyPresetTags(lex, BUILTIN_PRESETS.find((p) => p.id === "maid").tags, new Set());
    let maidPlace = 0;
    // 門檻沒動（還是一張都不准跑到名單外），放寬的是「女僕會在的地方」這份手寫規格：
    // 原本六個裡有兩個是歷史時代限定，現代的女僕只剩四個地方可去，每次都長一樣。
    const MAID_OK = [
      "mansion", "kitchen", "living room", "bedroom", "hotel room", "palace",
      "hallway", "balcony", "greenhouse", "library", "garden",
      "cafe", "maid cafe",
    ];
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinMaid, new Set(), mulberry32(225000 + i), 225000 + i));
      const places = [...h].filter((t) => lex.byTag.get(t)?.mutex === "place" || lex.byTag.get(t)?.group === "place");
      if (places.length && !places.some((p) => MAID_OK.includes(p))) maidPlace += 1;
    }
    eq("normal maid preset stays in maid places", maidPlace, 0);
    const jobOn = { ...s, drawJob: true, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
    let otherJob = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, jobOn, pinMaid, new Set(), mulberry32(226000 + i), 226000 + i));
      if ([...h].some((t) => lex.byTag.get(t)?.mutex === "job")) otherJob += 1;
    }
    eq("pin maid never auto another job", otherJob, 0);
    // 場地清單（JOB_PLACE／ACT_PLACE）都是不分時代寫的。拿它去判斷「這個活動有沒有
    // 地方可做」之前必須先套時代濾鏡，否則會用一個當下根本不存在的場地去證明
    // 「有地方可去」—— 活動被放行，場地那一格卻誰也填不進去。
    //
    // courtyard 就是這樣的一個字：它讀起來像個合理的女僕場地，同時又在 SPORT_PLACE
    // 裡，而它的 era 只有古代。少了濾鏡，把它收進女僕的場地清單就會讓運動活動
    // 通過可行性檢查、跟女僕裝一起抽出來，然後現代根本沒有中庭可以站。
    // 實測過一次：3000 張裡冒出 178 張運動圖，每一張都沒有場地。
    const maidish = new Set(["living room", "kitchen", "bedroom", "courtyard"]);
    const canProve = (act, era) => {
      const usable = placesInEra(maidish, lex, era);
      return [...usable].some((p) => placeFitsActs(p, new Set([act]), true));
    };
    eq("時代濾鏡在現代濾掉中庭", placesInEra(maidish, lex, "modern").has("courtyard"), false);
    eq("時代濾鏡在中世紀留住中庭", placesInEra(maidish, lex, "medieval").has("courtyard"), true);
    eq("時代濾鏡留下的通用場地沒被誤殺", placesInEra(maidish, lex, "modern").has("living room"), true);
    eq("現代不能拿中庭證明這裡可以運動", canProve("playing sports", "modern"), false);
    eq("中世紀可以拿中庭證明這裡可以運動", canProve("playing sports", "medieval"), true);

    const pinOnsen = applyPresetTags(lex, BUILTIN_PRESETS.find((p) => p.id === "onsen").tags, new Set());
    let bathChair = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinOnsen, new Set(), mulberry32(227000 + i), 227000 + i));
      if (["gaming chair", "office chair", "swivel chair"].some((t) => h.has(t))) bathChair += 1;
    }
    eq("normal onsen never auto office/gaming chairs", bathChair, 0);
    const pinDrive = applyPin(lex, new Set(), new Set(), "driving").pinned;
    let driveBody = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinDrive, new Set(), mulberry32(228000 + i), 228000 + i));
      if (["standing", "squatting", "kneeling", "on one knee", "sleeping", "all fours"].some((t) => h.has(t))) {
        driveBody += 1;
      }
    }
    eq("driving never auto planted/ground body", driveBody, 0);
    const pinHof3 = applyPin(lex, new Set(), new Set(), "head out of frame").pinned;
    const teaseHof = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
    let hofSelfie = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, teaseHof, pinHof3, new Set(), mulberry32(229000 + i), 229000 + i));
      if (h.has("selfie") || h.has("taking picture")) hofSelfie += 1;
    }
    eq("head out of frame never auto selfie/taking picture", hofSelfie, 0);
    const sexHof = { ...s, girl: true, boy: true, heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 } };
    let hof69 = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sexHof, pinHof3, new Set(), mulberry32(230000 + i), 230000 + i));
      if (["69", "french kiss"].some((t) => h.has(t))) hof69 += 1;
    }
    eq("head out of frame never auto 69/kissing", hof69, 0);
    const pinSleep4 = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
    let sleepGest = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinSleep4, new Set(), mulberry32(231000 + i), 231000 + i));
      if (
        ["ojou-sama pose", "paizuri gesture", "reaching towards viewer", "heart hands", "v", "recording"].some((t) =>
          h.has(t)
        )
      ) {
        sleepGest += 1;
      }
    }
    eq("sleeping never auto awake leftover gestures", sleepGest, 0);
    const pinPolice = applyPresetTags(lex, BUILTIN_PRESETS.find((p) => p.id === "police").tags, new Set());
    const policeSex = {
      ...s,
      heats: ["sex"],
      weights: { activity: 0, tease: 0, flash: 0, sex: 1 },
    };
    let policePublic = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, policeSex, pinPolice, new Set(), mulberry32(232000 + i), 232000 + i));
      if (["street", "city", "cityscape", "alley", "park", "beach"].some((t) => h.has(t))) policePublic += 1;
    }
    eq("normal police sex never auto public outdoor place", policePublic, 0);
    // 這幾條守的是「場景不該無故拖進別的行業的配件」。但配件本來就有合法的來由 ——
    // 引擎宣告過 NEEDS_CONTEXT（麥克風要有人唱歌、安全帽要有人騎車或在工地），
    // 甚至會主動拉（CTX_PULLS_ACC 有 riding bicycle -> bicycle helmet 0.45）。
    // 所以「配件出現」不等於違規，「配件出現而它的來由不在場」才是。
    //
    // 原本只看配件名字，於是海邊騎腳踏車戴安全帽被算成違規 —— 那是引擎刻意做的事。
    // 這個洞四條斷言都有（microphone 哪天配上 singing 也會誤報），所以修在共用的
    // helper 上而不是把 helmet 從清單裡刪掉：刪掉是放寬，這樣是把規格寫對。
    //
    // 來由清單在這裡人工維護，不從 engine.js 反射 —— 從實作反射出來的規格只能
    // 驗實作自不自洽。
    const ACC_REASON = {
      helmet: ["riding bicycle", "skiing", "construction site", "construction worker"],
      "bicycle helmet": ["riding bicycle", "street", "city", "park", "stadium"],
      "hard hat": ["construction site", "construction worker"],
      microphone: ["singing", "karaoke", "idol", "concert", "stage", "bar (place)", "karaoke box"],
      clipboard: ["nurse", "doctor", "clinic", "hospital", "teacher", "classroom"],
      stethoscope: ["nurse", "doctor", "clinic", "hospital"],
      innertube: ["pool", "beach", "swimming", "poolside"],
      "beach umbrella": ["beach", "pool", "poolside"],
    };
    function presetAcc(id, seed, isBad) {
      const p = BUILTIN_PRESETS.find((x) => x.id === id);
      const pin = applyPresetTags(lex, p.tags, new Set());
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const d = drawOne(lex, s, pin, new Set(), mulberry32(seed + i), seed + i);
        const all = new Set([...d.positive.split(", ")]);
        const orphan = d.sections.clothing.filter((t) => {
          if (!isBad(t)) return false;
          const why = ACC_REASON[t];
          if (!why) return true; // 沒宣告來由的，出現就是無故
          return !why.some((r) => all.has(r));
        });
        if (orphan.length) n += 1;
      }
      return n;
    }
    eq(
      "normal onsen never auto police/nurse hat or beach umbrella",
      presetAcc("onsen", 233000, (t) => /\b(police hat|nurse cap|beach umbrella|helmet|innertube|umbrella)\b/.test(t)),
      0
    );
    eq(
      "normal pool never auto necktie/microphone/clipboard",
      presetAcc("pool", 234000, (t) => /\b(necktie|microphone|clipboard|hard hat|helmet)\b/.test(t)),
      0
    );
    eq(
      "normal beach never auto necktie/hard hat/microphone",
      presetAcc("beach", 235000, (t) => /\b(necktie|hard hat|microphone|helmet)\b/.test(t)),
      0
    );
    eq(
      "normal police never auto innertube/stethoscope/nurse cap",
      presetAcc("police", 236000, (t) => /\b(innertube|stethoscope|nurse cap|hard hat|helmet)\b/.test(t)),
      0
    );
    const pinHofRead = applyPin(lex, new Set(), new Set(), "head out of frame").pinned;
    let hofRead = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinHofRead, new Set(), mulberry32(237000 + i), 237000 + i));
      if (["reading", "studying", "writing", "washing hair", "adjusting hair", "cunnilingus", "oral"].some((t) => h.has(t))) hofRead += 1;
    }
    eq("head out of frame never auto reading/washing hair/oral", hofRead, 0);
    const pinOffice = applyPin(lex, new Set(), new Set(), "office").pinned;
    let washOffice = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinOffice, new Set(), mulberry32(238000 + i), 238000 + i));
      if (h.has("washing hair") || h.has("washing back")) washOffice += 1;
    }
    eq("office never auto washing hair/back without water", washOffice, 0);
    const pinSleep5 = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
    let sleepExpr = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinSleep5, new Set(), mulberry32(239000 + i), 239000 + i));
      if (["come hither", "scared", "angry", "naughty face", "ahegao"].some((t) => h.has(t))) sleepExpr += 1;
    }
    eq("sleeping never auto awake expressions", sleepExpr, 0);
    const pinCrawl = applyPin(lex, new Set(), new Set(), "crawling").pinned;
    let crawlChair = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinCrawl, new Set(), mulberry32(240000 + i), 240000 + i));
      if (h.has("on chair")) crawlChair += 1;
    }
    eq("crawling never auto on chair", crawlChair, 0);
    const pinSit = applyPin(lex, new Set(), new Set(), "sitting").pinned;
    let sitContra = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinSit, new Set(), mulberry32(241000 + i), 241000 + i));
      if (h.has("contrapposto")) sitContra += 1;
    }
    eq("sitting never auto contrapposto", sitContra, 0);
    let hofHead = 0;
    const sexHof2 = { ...s, girl: true, boy: true, heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 } };
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sexHof2, pinHofRead, new Set(), mulberry32(242000 + i), 242000 + i));
      if (h.has("head tilt") || h.has("after fellatio") || h.has("after paizuri")) hofHead += 1;
    }
    eq("head out of frame never auto head tilt/after fellatio", hofHead, 0);
    const pinSeiza2 = applyPin(lex, new Set(), new Set(), "seiza").pinned;
    let seizaLegs = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinSeiza2, new Set(), mulberry32(243000 + i), 243000 + i));
      if (h.has("legs up")) seizaLegs += 1;
    }
    eq("seiza never auto legs up", seizaLegs, 0);
    eq(
      "normal onsen never auto high heels",
      presetAcc("onsen", 244000, (t) => t === "high heels"),
      0
    );

    let hofKiss = 0;
    const teaseHof2 = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 }, eras: ["medieval"] };
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, teaseHof2, pinHofRead, new Set(), mulberry32(248000 + i), 248000 + i));
      if (["closed mouth", "kiss", "breast focus"].some((t) => h.has(t))) hofKiss += 1;
    }
    eq("head out of frame never auto kiss/closed mouth/breast focus", hofKiss, 0);
    const pinCookMed = applyPin(lex, new Set(), new Set(), "cooking").pinned;
    const medCook = { ...s, eras: ["medieval"] };
    // 庭院的爐灶也是煮飯的地方，不是只有室內灶房：原本的清單還收過 great hall，
    // 可見這條從來不是在要求「室內」，而是在要求「煮得成飯的地方」。門檻沒動，
    // 還是一張都不准漏（eq ..., 0），只是「煮得成飯的地方」多了中世紀的庭院。
    const COOK_OK = ["kitchen", "castle", "palace", "courtyard"];
    let cookOut = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, medCook, pinCookMed, new Set(), mulberry32(249000 + i), 249000 + i));
      if (h.has("cooking") && !COOK_OK.some((t) => h.has(t))) cookOut += 1;
    }
    eq("medieval cooking always has a cook place", cookOut, 0);
    // 江戶 + 性愛 + 煮飯：場地必須煮得了飯。旅館和城堡都在煮飯清單裡。
    // 私密白名單拿掉之前，城堡被擋在外面，只剩旅館。
    const COOK_OK_EDO = ["kitchen", "castle", "palace", "courtyard", "ryokan"];
    const pinCookEdo = applyPin(lex, new Set(), new Set(), "cooking").pinned;
    const edoSexCook = {
      ...s,
      eras: ["edo"],
      heats: ["sex"],
      weights: { activity: 0, tease: 0, flash: 0, sex: 1 },
    };
    let edoCookOut = 0;
    for (let i = 0; i < 80; i++) {
      const h = tagsOf(drawOne(lex, edoSexCook, pinCookEdo, new Set(), mulberry32(910000 + i), 910000 + i));
      if (h.has("cooking") && !COOK_OK_EDO.some((t) => h.has(t))) edoCookOut += 1;
    }
    eq("edo sex cooking always has a cook place", edoCookOut, 0);
    // 同一類洞：性愛熱度只准私密場地，但有些活動的 ACT_PLACE 全是公共／專用場館。
    // 釘住那個活動（自動抽牌不會抽，因為不在 SEX_OK_ACTIVITY）場地格就空掉。
    // 實測 40/40：購物、開車、網球、維多利亞「做運動」。
    function sexPinPlaceMiss(act, era, seed) {
      const st = {
        ...s,
        eras: [era],
        heats: ["sex"],
        weights: { activity: 0, tease: 0, flash: 0, sex: 1 },
      };
      const pin = applyPin(lex, new Set(), new Set(), act).pinned;
      let miss = 0;
      for (let i = 0; i < 40; i++) {
        const h = tagsOf(drawOne(lex, st, pin, new Set(), mulberry32(seed + i), seed + i));
        if (!h.has(act)) continue;
        const has = [...h].some((t) => {
          const it = lex.byTag.get(t);
          return it && (it.mutex === "place" || it.group === "place");
        });
        if (!has) miss += 1;
      }
      return miss;
    }
    eq("sex+pin shopping always has a place", sexPinPlaceMiss("shopping", "modern", 920000), 0);
    eq("sex+pin driving always has a place", sexPinPlaceMiss("driving", "modern", 920080), 0);
    eq("sex+pin tennis always has a place", sexPinPlaceMiss("tennis", "modern", 920160), 0);
    eq("sex+pin victorian sports always has a place", sexPinPlaceMiss("playing sports", "victorian", 920240), 0);
    // 同一類洞換到職業：性愛熱度在場上有職業時會擋掉 PUBLIC_SEX_PLACE。
    // 消防員的 JOB_PLACE 全是 street／city／cityscape，三個都在公開清單裡，
    // 釘消防員開著性愛就 40/40 沒場地。偵探有辦公室／圖書館，不是這個洞。
    function sexPinJobPlaceMiss(job, era, seed) {
      const st = {
        ...s,
        eras: [era],
        heats: ["sex"],
        weights: { activity: 0, tease: 0, flash: 0, sex: 1 },
      };
      const pin = applyPin(lex, new Set(), new Set(), job).pinned;
      let miss = 0;
      const places = [];
      for (let i = 0; i < 40; i++) {
        const h = tagsOf(drawOne(lex, st, pin, new Set(), mulberry32(seed + i), seed + i));
        if (!h.has(job)) continue;
        let place = null;
        for (const t of h) {
          const it = lex.byTag.get(t);
          if (it && (it.mutex === "place" || it.group === "place")) {
            place = t;
            break;
          }
        }
        if (!place) miss += 1;
        else places.push(place);
      }
      return { miss, places };
    }
    const fireSex = sexPinJobPlaceMiss("firefighter", "modern", 930000);
    eq("sex+pin firefighter always has a place", fireSex.miss, 0);
    ok(
      "sex+pin firefighter stays on the job's streets",
      fireSex.places.length === 40 &&
        fireSex.places.every((p) => p === "street" || p === "city" || p === "cityscape"),
      `places=${[...new Set(fireSex.places)]}`
    );
    const detSex = sexPinJobPlaceMiss("detective", "modern", 930080);
    eq("sex+pin detective always has a place", detSex.miss, 0);
    ok(
      "sex+pin detective never auto public sex place",
      detSex.places.every((p) => !["street", "city", "cityscape", "alley", "park", "beach", "ocean", "rooftop"].includes(p)),
      `places=${[...new Set(detSex.places)]}`
    );
    {
      const st = {
        ...s,
        eras: ["modern"],
        heats: ["sex"],
        weights: { activity: 0, tease: 0, flash: 0, sex: 1 },
      };
      let pub = 0;
      let both = 0;
      for (let i = 0; i < 80; i++) {
        const h = tagsOf(drawOne(lex, st, new Set(), new Set(), mulberry32(930160 + i), 930160 + i));
        if (["street", "city", "cityscape", "alley", "park", "beach", "ocean", "rooftop"].some((t) => h.has(t))) pub += 1;
        if (h.has("indoors") && h.has("outdoors")) both += 1;
      }
      ok("unpinned modern sex can use a public place", pub > 0, `public=${pub}/80`);
      eq("unpinned modern sex never stacks indoors and outdoors", both, 0);
    }
    // 職業場地若「有一個室內」就擋 outdoors，偵探／女警這種室內外都有的職業
    // 會 100% 抽不到大街：抽菸／騎車／開車的場地只剩街上，街上又 implies
    // outdoors，場地格空掉（實測偵探 tease 14/40、女警 12/40）。
    // 改成「場地全是室內才擋」。OL 只有辦公室，既有那條 outdoors=0 繼續守。
    function teasePinJobPlaceMiss(job, era, seed) {
      const st = {
        ...s,
        eras: [era],
        heats: ["tease"],
        weights: { activity: 0, tease: 1, flash: 0, sex: 0 },
      };
      const pin = applyPin(lex, new Set(), new Set(), job).pinned;
      let miss = 0;
      for (let i = 0; i < 40; i++) {
        const h = tagsOf(drawOne(lex, st, pin, new Set(), mulberry32(seed + i), seed + i));
        if (!h.has(job)) continue;
        const has = [...h].some((t) => {
          const it = lex.byTag.get(t);
          return it && (it.mutex === "place" || it.group === "place");
        });
        if (!has) miss += 1;
      }
      return miss;
    }
    eq("tease+pin detective always has a place", teasePinJobPlaceMiss("detective", "modern", 940000), 0);
    eq("tease+pin policewoman always has a place", teasePinJobPlaceMiss("policewoman", "modern", 940080), 0);
    {
      // 刪掉兩個自創胸型詞後，候選池位移曾讓這顆 seed 抽到
      // detective + taking picture + breasts on table：前兩者只交集 street，
      // 後者又強制室內，最後整張圖沒有任何 place。自動特徵必須讓場景骨架優先。
      const st = {
        ...s,
        eras: ["modern"],
        heats: ["tease"],
        weights: { activity: 0, tease: 1, flash: 0, sex: 0 },
      };
      const pin = applyPin(lex, new Set(), new Set(), "detective").pinned;
      const h = tagsOf(drawOne(lex, st, pin, new Set(), mulberry32(940014), 940014));
      const places = [...h].filter((t) => {
        const it = lex.byTag.get(t);
        return it && (it.mutex === "place" || it.group === "place");
      });
      ok("detective photo seed keeps a real place", places.length > 0, `places=${places}`);
    }
    const flashS = { ...s, heats: ["flash"], weights: { activity: 0, tease: 0, flash: 1, sex: 0 }, eras: ["victorian"] };
    let flashSleep = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, flashS, new Set(), new Set(), mulberry32(250000 + i), 250000 + i));
      if (h.has("sleeping")) flashSleep += 1;
    }
    eq("flash never auto sleeping", flashSleep, 0);
    let hofPhone = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinHofRead, new Set(), mulberry32(252000 + i), 252000 + i));
      if (h.has("talking on phone") || h.has("breast sucking")) hofPhone += 1;
    }
    eq("head out of frame never auto phone/breast sucking", hofPhone, 0);
    const pinKneel = applyPin(lex, new Set(), new Set(), "kneeling").pinned;
    let kneelChair = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinKneel, new Set(), mulberry32(253000 + i), 253000 + i));
      if (h.has("on chair")) kneelChair += 1;
    }
    eq("kneeling never auto on chair", kneelChair, 0);
    for (const lie of ["on back", "on stomach", "on side", "lying"]) {
      const pinLie = applyPin(lex, new Set(), new Set(), lie).pinned;
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const h = tagsOf(drawOne(lex, s, pinLie, new Set(), mulberry32(282000 + i), 282000 + i));
        if (h.has("on chair")) n += 1;
      }
      eq(`${lie} never auto on chair`, n, 0);
    }
    const pinBathDance = applyPin(lex, new Set(), new Set(), "bathing").pinned;
    let bathDance = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, pinBathDance, new Set(), mulberry32(276000 + i), 276000 + i));
      if (h.has("dancing")) bathDance += 1;
    }
    eq("bathing never auto dancing", bathDance, 0);
    {
      function bodyGarments(h) {
        return [...h].filter((t) => {
          const it = lex.byTag.get(t);
          return it && it.section === "clothing" && it.layer === "garment";
        });
      }
      const pinOnsenNude = applyPresetTags(lex, onsen.tags, new Set());
      const onsenSex = {
        ...s,
        heats: ["sex"],
        weights: { activity: 0, tease: 0, flash: 0, sex: 1 },
      };
      let onsenNude = 0;
      let onsenClash = 0;
      for (let i = 0; i < 80; i++) {
        const h = tagsOf(drawOne(lex, onsenSex, pinOnsenNude, new Set(), mulberry32(271000 + i), 271000 + i));
        if (h.has("nude") || h.has("completely nude")) {
          onsenNude += 1;
          if (bodyGarments(h).length) onsenClash += 1;
        }
      }
      ok("normal onsen sex sometimes nudes", onsenNude >= 8, `nudes=${onsenNude}/80`);
      eq("onsen nude never stacks garments", onsenClash, 0);
      let onsenActNude = 0;
      for (let i = 0; i < 80; i++) {
        const h = tagsOf(drawOne(lex, s, pinOnsenNude, new Set(), mulberry32(272000 + i), 272000 + i));
        if (h.has("nude") || h.has("completely nude")) onsenActNude += 1;
      }
      ok("normal onsen activity sometimes nudes", onsenActNude >= 8, `nudes=${onsenActNude}/80`);
      const pinPoolNude = applyPresetTags(lex, pool.tags, new Set());
      let poolNude = 0;
      let poolClash = 0;
      for (let i = 0; i < 80; i++) {
        const h = tagsOf(drawOne(lex, onsenSex, pinPoolNude, new Set(), mulberry32(273000 + i), 273000 + i));
        if (h.has("nude") || h.has("completely nude")) {
          poolNude += 1;
          if (bodyGarments(h).length) poolClash += 1;
        }
      }
      ok("normal pool sex sometimes nudes", poolNude >= 5, `nudes=${poolNude}/80`);
      eq("pool nude never stacks garments", poolClash, 0);
      const pinOlNude = applyPresetTags(lex, ol.tags, new Set());
      let olNude = 0;
      for (let i = 0; i < 40; i++) {
        const h = tagsOf(drawOne(lex, onsenSex, pinOlNude, new Set(), mulberry32(274000 + i), 274000 + i));
        if (h.has("nude") || h.has("completely nude")) olNude += 1;
      }
      eq("normal OL preset never auto nude over pinned clothes", olNude, 0);
    }
    const ARMS = [
      "arms behind back",
      "arms behind head",
      "crossed arms",
      "heart hands",
      "v",
      "reaching towards viewer",
      "hands on own hips",
      "hands on own breasts",
      "hand in pocket",
      "index fingers together",
      "beckoning",
    ];
    let twoArms = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(254000 + i), 254000 + i));
      if (ARMS.filter((t) => h.has(t)).length > 1) twoArms += 1;
    }
    eq("pose10 never two leftover arm extras", twoArms, 0);
    function busyArms(pinTag, seed) {
      const pin = applyPin(lex, new Set(), new Set(), pinTag).pinned;
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const h = tagsOf(drawOne(lex, s, pin, new Set(), mulberry32(seed + i), seed + i));
        if (ARMS.some((t) => h.has(t))) n += 1;
      }
      return n;
    }
    eq("playing guitar never auto busy-arm leftovers", busyArms("playing guitar", 255000), 0);
    eq("talking on phone never auto busy-arm leftovers", busyArms("talking on phone", 256000), 0);
    eq("writing never auto busy-arm leftovers", busyArms("writing", 257000), 0);
    eq("cooking never auto busy-arm leftovers", busyArms("cooking", 258000), 0);
    eq("eating never auto busy-arm leftovers", busyArms("eating", 259000), 0);
    eq("drawing never auto busy-arm leftovers", busyArms("drawing (action)", 260000), 0);
    eq("crawling never auto busy-arm leftovers", busyArms("crawling", 261000), 0);
    const sTease = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
    const sFlash = { ...s, heats: ["flash"], weights: { activity: 0, tease: 0, flash: 1, sex: 0 } };
    function neverAuto(set, pinTag, bad, seed) {
      const pin = applyPin(lex, new Set(), new Set(), pinTag).pinned;
      let n = 0;
      for (let i = 0; i < 40; i++) {
        const h = tagsOf(drawOne(lex, set, pin, new Set(), mulberry32(seed + i), seed + i));
        if (bad.some((t) => h.has(t))) n += 1;
      }
      return n;
    }
    const LEGS = ["crossed legs", "legs up", "m legs"];
    let twoLegs = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sTease, new Set(), new Set(), mulberry32(286000 + i), 286000 + i));
      if (LEGS.filter((t) => h.has(t)).length > 1) twoLegs += 1;
    }
    eq("pose10 never two leftover leg extras", twoLegs, 0);
    eq("crawling never auto crossed legs", neverAuto(sTease, "crawling", ["crossed legs"], 286040), 0);
    eq("all fours never auto crossed legs", neverAuto(sTease, "all fours", ["crossed legs"], 286080), 0);
    eq("top-down bottom-up never auto crossed legs", neverAuto(sTease, "top-down bottom-up", ["crossed legs"], 286120), 0);
    eq("crawling never auto legs up", neverAuto(sTease, "crawling", ["legs up"], 286160), 0);
    eq("kneeling never auto crossed legs", neverAuto(sTease, "kneeling", ["crossed legs"], 286200), 0);
    eq("on one knee never auto crossed legs", neverAuto(sTease, "on one knee", ["crossed legs"], 286240), 0);
    eq("squatting never auto legs up", neverAuto(sTease, "squatting", ["legs up"], 286280), 0);
    eq("seiza never auto crossed legs", neverAuto(sTease, "seiza", ["crossed legs"], 286320), 0);
    // 原本問的是 one knee up（0 張，2026-09-18 移除）。盤腿跟「抬腿」系列全部
    // 矛盾，所以改問還活著的那兩個，守的是同一件事。
    eq("indian style never auto legs up/m legs", neverAuto(sTease, "indian style", ["legs up", "m legs"], 286360), 0);
    eq("dancing never auto crossed legs", neverAuto(sTease, "dancing", ["crossed legs"], 286400), 0);
    eq("dancing never auto legs up", neverAuto(sTease, "dancing", ["legs up"], 286440), 0);
    eq("standing never auto legs up", neverAuto(sTease, "standing", ["legs up", "m legs"], 286480), 0);
    eq("on back never auto leaning forward", neverAuto(sTease, "on back", ["leaning forward"], 286520), 0);
    eq("on stomach never auto leaning back", neverAuto(sTease, "on stomach", ["leaning back"], 286560), 0);
    eq("all fours never auto leaning back", neverAuto(sTease, "all fours", ["leaning back"], 286600), 0);
    eq("bathing never auto after bathing", neverAuto(sTease, "bathing", ["after bathing"], 286640), 0);
    eq("lower body never auto breast hold", neverAuto(sTease, "lower body", ["breast hold", "breastfeeding", "spread cleavage"], 286680), 0);
    eq("expressionless never auto one eye closed", neverAuto(sTease, "expressionless", ["one eye closed"], 286720), 0);
    eq("on back never auto bent over", neverAuto(sFlash, "on back", ["bent over"], 286760), 0);
    eq("overcast never auto blue sky", neverAuto(s, "overcast", ["blue sky"], 286800), 0);
    eq("overcast never auto starry sky", neverAuto(s, "overcast", ["starry sky"], 286840), 0);
    eq("rain never auto starry sky", neverAuto(s, "rain", ["starry sky"], 286880), 0);
    eq("head out of frame never auto singing", neverAuto(s, "head out of frame", ["singing", "karaoke"], 286920), 0);
    eq("hiking never auto kneeling", neverAuto(s, "hiking", ["kneeling", "on one knee"], 286960), 0);
    eq("eating never auto clenched teeth", neverAuto(s, "eating", ["clenched teeth"], 287000), 0);
    eq("driving never auto on chair", neverAuto(s, "driving", ["on chair"], 287040), 0);
    const pinSleepNew = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
    let sleepExpr2 = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sTease, pinSleepNew, new Set(), mulberry32(287080 + i), 287080 + i));
      if (["surprised", "embarrassed", "nervous"].some((t) => h.has(t))) sleepExpr2 += 1;
    }
    eq("sleeping never auto surprised/embarrassed/nervous", sleepExpr2, 0);
  }
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["tease", "flash", "sex"];
  s.weights = { activity: 0, tease: 0.34, flash: 0.33, sex: 0.33 };
  s.eras = ["modern"];
  s.sceneMode = "weird";
  s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  let bothHair = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(278000 + i), 278000 + i));
    const tex = ["straight hair", "wavy hair", "curly hair"].filter((t) => h.has(t));
    if (tex.length > 1) bothHair += 1;
  }
  eq("never two hair textures", bothHair, 0);
  const boyS = { ...s, girl: false, boy: true, sceneMode: "normal", heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 }, eras: ["edo"] };
  let ageClash = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, boyS, new Set(), new Set(), mulberry32(279000 + i), 279000 + i));
    if (h.has("shota") && (h.has("mature male") || h.has("old man"))) ageClash += 1;
  }
  eq("never shota with mature/old man", ageClash, 0);
  const mixS = { ...s, girl: true, boy: true, sceneMode: "normal", heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 }, eras: ["edo"] };
  let mixNoBoy = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, mixS, new Set(), new Set(), mulberry32(280000 + i), 280000 + i));
    if (h.has("mixed-sex bathing") && !h.has("1boy") && !h.has("2boys") && !h.has("multiple boys")) mixNoBoy += 1;
  }
  eq("mixed-sex bathing never without a boy", mixNoBoy, 0);
  {
    const h = tagsOf(drawOne(lex, mixS, new Set(), new Set(), mulberry32(710013), 710013));
    const bad = h.has("mixed-sex bathing") && !h.has("1boy") && !h.has("2boys") && !h.has("multiple boys");
    eq("seed 710013 mixed-sex bathing has a boy", bad, false);
  }
  const pinG = applyPin(lex, new Set(), new Set(), "playing guitar").pinned;
  const actS = { ...s, heats: ["activity"], weights: { activity: 1, tease: 0, flash: 0, sex: 0 }, sceneMode: "normal", eras: ["ancient_china"] };
  let hips = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, actS, pinG, new Set(), mulberry32(281000 + i), 281000 + i));
    if (h.has("hands on own hips")) hips += 1;
  }
  eq("playing guitar never auto hands on own hips", hips, 0);
  const cleaned = sanitizePinPresets(
    [
      { name: "  我的OL  ", tags: ["office lady", "not-a-tag"] },
      { name: "", tags: ["nurse"] },
      { tags: ["maid"] },
    ],
    lex
  );
  eq("sanitize preset name trimmed", cleaned[0].name, "我的OL");
  ok("sanitize drops unknown tags", cleaned[0].tags.includes("office lady") && !cleaned[0].tags.includes("not-a-tag"));
  eq("sanitize drops nameless presets", cleaned.length, 1);
}

{
  const need = [
    "airplane interior",
    "airport",
    "basketball court",
    "tennis court",
    "soccer field",
    "baseball stadium",
    "running track",
    "soccer ball",
    "basketball (object)",
    "tennis ball",
    "soccer uniform",
    "tennis uniform",
    "baseball uniform",
    "volleyball uniform",
    "buruma",
    "firefighter",
    "scientist",
    "construction worker",
    "rape",
    "small penis",
    "jogging",
    "skiing",
    "karaoke box",
    "convenience store",
    "movie theater",
    "church",
    "prison",
    "handcuffs",
  ];
  for (const t of need) eq(`lex has ${t}`, lex.byTag.has(t), true);
  const rapeIt = lex.byTag.get("rape");
  ok("rape is sex-heat only", !!(rapeIt && (rapeIt.heat || []).includes("sex") && !(rapeIt.heat || []).includes("activity")));
  eq("rape is not an activity mutex", rapeIt && rapeIt.mutex, null);
  // 場地不再 imply 球具：Danbooru 是「畫面看得到什麼才標什麼」，有球場不代表有球。
  // 這條 implies 會害使用者從必進 POS 移掉球之後又被自動加回來。
  const bb = applyPin(lex, new Set(), new Set(), "basketball court").pinned;
  ok("basketball court does not imply the ball", !bb.has("basketball (object)"));
  ok("basketball court still implies outdoors", bb.has("outdoors"));
  const sN = settings();
  sN.girl = true;
  sN.boy = true;
  sN.heats = ["sex"];
  sN.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  sN.eras = ["modern"];
  sN.sceneMode = "normal";
  sN.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const pinRape = applyPin(lex, new Set(), new Set(), "rape").pinned;
  let rapeHome = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sN, pinRape, new Set(), mulberry32(310000 + i), 310000 + i));
    if (["classroom", "bedroom", "living room", "kitchen"].some((t) => h.has(t))) rapeHome += 1;
  }
  eq("normal rape never auto classroom/home daily", rapeHome, 0);
  const pinClass = applyPin(lex, new Set(), new Set(), "classroom").pinned;
  let classRape = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sN, pinClass, new Set(), mulberry32(310040 + i), 310040 + i));
    if (h.has("rape")) classRape += 1;
  }
  eq("normal classroom never auto rape", classRape, 0);
  const sAct = { ...sN, heats: ["activity"], weights: { activity: 1, tease: 0, flash: 0, sex: 0 } };
  let actRape = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sAct, new Set(), new Set(), mulberry32(310080 + i), 310080 + i));
    if (h.has("rape")) actRape += 1;
  }
  eq("activity heat never auto rape", actRape, 0);
  const pinCourt = applyPin(lex, new Set(), new Set(), "basketball court").pinned;
  let wrongBall = 0;
  let wrongWear = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sAct, pinCourt, new Set(), mulberry32(310120 + i), 310120 + i));
    if (["soccer ball", "tennis ball", "baseball (object)", "bowling ball"].some((t) => h.has(t))) wrongBall += 1;
    if (["soccer uniform", "tennis uniform", "baseball uniform"].some((t) => h.has(t))) wrongWear += 1;
  }
  eq("normal basketball court never auto other balls", wrongBall, 0);
  eq("normal basketball court never auto other sport uniforms", wrongWear, 0);
  const pinFa = applyPin(lex, new Set(), new Set(), "flight attendant").pinned;
  let faWrong = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sAct, pinFa, new Set(), mulberry32(310160 + i), 310160 + i));
    if (["classroom", "onsen", "kitchen", "pool"].some((t) => h.has(t))) faWrong += 1;
  }
  eq("normal flight attendant never auto classroom/onsen/kitchen/pool", faWrong, 0);
  {
    const cabin = BUILTIN_PRESETS.find((p) => p.id === "cabin");
    const pinCabin = applyPresetTags(lex, cabin.tags, new Set());
    const sSex = { ...sAct, heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 } };
    let cabinGolf = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sSex, pinCabin, new Set(), mulberry32(311200 + i), 311200 + i));
      if (["golf course", "golf ball", "golf club"].some((t) => h.has(t))) cabinGolf += 1;
    }
    eq("normal sex cabin never auto golf", cabinGolf, 0);
  }
  eq("skiing never auto tennis kit", neverAuto2(sAct, "skiing", ["tennis uniform", "tennis ball", "tennis racket"], 311240), 0);
  {
    const nurse = BUILTIN_PRESETS.find((p) => p.id === "nurse");
    const pinN = applyPresetTags(lex, nurse.tags, new Set());
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sAct, pinN, new Set(), mulberry32(311280 + i), 311280 + i));
      if (["baseball uniform", "soccer uniform", "tennis uniform", "cheerleader"].some((t) => h.has(t))) n += 1;
    }
    eq("normal nurse never auto sport uniforms", n, 0);
  }
  const pinJog = applyPin(lex, new Set(), new Set(), "jogging").pinned;
  let jogSleep = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sAct, pinJog, new Set(), mulberry32(310200 + i), 310200 + i));
    if (h.has("sleeping")) jogSleep += 1;
  }
  eq("jogging never auto sleeping", jogSleep, 0);
  const pinSmall = applyPin(lex, new Set(["huge penis"]), new Set(), "small penis").pinned;
  ok("small penis mutex huge penis", pinSmall.has("small penis") && !pinSmall.has("huge penis"));
  function neverAuto2(set, pinTag, bad, seed) {
    const pin = applyPin(lex, new Set(), new Set(), pinTag).pinned;
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, set, pin, new Set(), mulberry32(seed + i), seed + i));
      if (bad.some((t) => h.has(t))) n += 1;
    }
    return n;
  }
  eq("diving never auto seiza", neverAuto2(sAct, "diving", ["seiza", "wariza", "indian style"], 310240), 0);
  eq("after bathing never auto diving", neverAuto2(sN, "after bathing", ["diving"], 310280), 0);
  eq("indoors never auto campfire", neverAuto2(sAct, "office", ["campfire"], 310320), 0);
  eq("outdoors never auto bunk bed", neverAuto2(sAct, "shrine", ["bunk bed"], 310360), 0);
  eq("jogging never auto kneeling", neverAuto2(sAct, "jogging", ["kneeling", "on one knee"], 310400), 0);
  eq("jogging never auto sitting", neverAuto2(sAct, "jogging", ["sitting", "squatting", "on chair"], 310480), 0);
  eq("skiing never auto sitting", neverAuto2(sAct, "skiing", ["sitting", "kneeling", "on chair"], 310520), 0);
  eq("weightlifting never auto lying", neverAuto2(sAct, "weightlifting", ["lying", "on back", "on stomach", "on side"], 310560), 0);
  eq("dancing never auto shopping", neverAuto2(sAct, "dancing", ["shopping"], 310600), 0);
  eq("dancing never auto weightlifting", neverAuto2(sAct, "dancing", ["weightlifting"], 310640), 0);
  eq("head out of frame never auto smoking", neverAuto2(sAct, "head out of frame", ["smoking"], 310680), 0);
  eq("hiking never auto sitting", neverAuto2(sAct, "hiking", ["sitting", "squatting", "on chair"], 310720), 0);
  eq("crawling never auto talking on phone", neverAuto2(sAct, "crawling", ["talking on phone"], 310760), 0);
  eq("drinking never auto busy-arm leftovers", neverAuto2(sAct, "drinking", ["arms behind head", "arms behind back", "crossed arms"], 310800), 0);
  eq("closed eyes never auto reading", neverAuto2(sAct, "closed eyes", ["reading", "studying"], 310840), 0);
  eq("after bathing never auto splashing", neverAuto2(sN, "after bathing", ["splashing"], 310880), 0);
  eq("heart hands never auto clothes tug", neverAuto2(sAct, "heart hands", ["clothes tug", "paizuri gesture", "breast hold"], 310920), 0);
  eq("taking picture never auto arms behind back", neverAuto2(sAct, "taking picture", ["arms behind back", "crossed arms"], 310960), 0);
  const sTease2 = { ...sAct, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  eq("lower body never auto nipple slip", neverAuto2(sTease2, "lower body", ["nipple slip", "areola slip", "breast suppress"], 311000), 0);
  eq("closed eyes never auto writing", neverAuto2(sAct, "closed eyes", ["writing", "drawing (action)", "playing games"], 311040), 0);
  eq("playing games never auto heart hands", neverAuto2(sAct, "playing games", ["heart hands", "hands on own hips", "arms behind back"], 311080), 0);
  eq("horseback riding never auto on chair", neverAuto2(sAct, "horseback riding", ["on chair"], 311120), 0);
  eq("on stomach never auto m legs", neverAuto2(sTease2, "on stomach", ["m legs"], 311160), 0);
  eq("all fours never auto breasts on table", neverAuto2(sTease2, "all fours", ["breasts on table", "breasts on glass"], 311320), 0);
  eq("sleeping never auto breasts on table", neverAuto2(sTease2, "sleeping", ["breasts on table"], 311360), 0);
  eq("smoking never auto crossed arms", neverAuto2(sAct, "smoking", ["crossed arms", "arms behind back"], 311400), 0);
  eq("lying never auto shopping", neverAuto2(sAct, "lying", ["shopping"], 311440), 0);
  eq("on stomach never auto playing guitar", neverAuto2(sAct, "on stomach", ["playing guitar"], 311480), 0);
  eq("expressionless never auto rolling eyes", neverAuto2(sTease2, "expressionless", ["rolling eyes"], 311520), 0);
  eq("driving never auto legs up", neverAuto2(sAct, "driving", ["legs up"], 311560), 0);
  eq("seiza never auto shopping", neverAuto2(sAct, "seiza", ["shopping"], 311600), 0);
  eq("riding bicycle never auto hands on own hips", neverAuto2(sAct, "riding bicycle", ["hands on own hips"], 311640), 0);
  {
    const sSex2 = { ...sAct, heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 } };
    eq("skiing never auto amazon position", neverAuto2(sSex2, "skiing", ["amazon position", "masturbation"], 311680), 0);
  }
  const pinUni = applyPin(lex, new Set(), new Set(), "basketball uniform").pinned;
  let uniBall = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sAct, pinUni, new Set(), mulberry32(310440 + i), 310440 + i));
    if (["soccer ball", "bowling ball", "tennis ball", "baseball (object)"].some((t) => h.has(t))) uniBall += 1;
  }
  eq("normal basketball uniform never auto other balls", uniBall, 0);
  for (const id of ["cabin", "cinema", "conveni", "church-nun", "hoops", "tennis", "soccer", "baseball", "fire", "prison"]) {
    const p = BUILTIN_PRESETS.find((x) => x.id === id);
    ok(`preset ${id} exists`, !!p);
    if (p) {
      const pins = applyPresetTags(lex, p.tags);
      ok(`preset ${id} pins its tags`, p.tags.every((t) => pins.has(t)));
    }
  }
}

{
  const s = settings();
  s.girl = true;
  s.boy = false;
  s.heats = ["activity"];
  s.weights = { activity: 1, tease: 0, flash: 0, sex: 0 };
  s.eras = ["modern"];
  s.sceneMode = "normal";
  s.lockScene = true;
  s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const waterOffice = (t) =>
    /\b(armor|suit|blazer|lab coat|hakama|cheerleader)\b/.test(t) && !/\b(swimsuit|bikini)\b/.test(t);
  const pinSwim = applyPin(lex, new Set(), new Set(), "swimming").pinned;
  let swimArmor = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSwim, new Set(), mulberry32(430000 + i), 430000 + i));
    if ([...h].some(waterOffice)) swimArmor += 1;
  }
  eq("pinned swimming never leftover armor/suit/cheerleader", swimArmor, 0);
  const sDiv = { ...s, sceneMode: "diverse" };
  let divArmor = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sDiv, pinSwim, new Set(), mulberry32(430040 + i), 430040 + i));
    if ([...h].some(waterOffice)) divArmor += 1;
  }
  eq("diverse swimming never leftover armor/suit/cheerleader", divArmor, 0);
  const pinCook = applyPin(lex, new Set(), new Set(), "cooking").pinned;
  const sChina = { ...s, eras: ["ancient_china"] };
  const COOK_PLACE = ["kitchen", "castle", "palace", "courtyard"];
  let dryChina = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sChina, pinCook, new Set(), mulberry32(430080 + i), 430080 + i));
    if (h.has("cooking") && !COOK_PLACE.some((t) => h.has(t))) dryChina += 1;
  }
  eq("ancient_china cooking always has a cook place", dryChina, 0);
  const sSex = { ...s, heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 } };
  let drySex = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sSex, pinCook, new Set(), mulberry32(430120 + i), 430120 + i));
    if (h.has("cooking") && !h.has("kitchen")) drySex += 1;
  }
  eq("sex heat cooking always has kitchen", drySex, 0);
  const pinBath = applyPin(lex, new Set(), new Set(), "bathing").pinned;
  let bathSuit = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sDiv, pinBath, new Set(), mulberry32(430160 + i), 430160 + i));
    if ([...h].some((t) => /\b(suit|armor|blazer|sneakers|boots)\b/.test(t))) bathSuit += 1;
  }
  eq("diverse bathing never leftover suit/armor/shoes", bathSuit, 0);
  let cheerPin = applyPin(lex, new Set(), new Set(), "cheerleader").pinned;
  cheerPin = applyPin(lex, cheerPin, new Set(), "pool").pinned;
  let keptCheer = 0;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, s, cheerPin, new Set(), mulberry32(430200 + i), 430200 + i));
    if (h.has("cheerleader")) keptCheer += 1;
  }
  eq("pinned cheerleader at pool stays", keptCheer, 20);
  const pinPool = applyPresetTags(lex, BUILTIN_PRESETS.find((p) => p.id === "pool").tags, new Set());
  let autoCheer = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinPool, new Set(), mulberry32(430220 + i), 430220 + i));
    if (h.has("cheerleader")) autoCheer += 1;
  }
  eq("pool preset never auto cheerleader", autoCheer, 0);
  const pinTable = applyPin(lex, new Set(), new Set(), "breasts on table").pinned;
  let tableOut = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sDiv, pinTable, new Set(), mulberry32(430260 + i), 430260 + i));
    if (h.has("outdoors") && !h.has("indoors")) tableOut += 1;
  }
  eq("breasts on table never leftover outdoors without indoors", tableOut, 0);
  const sWeird = { ...s, sceneMode: "weird", lockScene: false, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  const pinPlane = applyPin(lex, new Set(), new Set(), "airplane interior").pinned;
  let divePlane = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sWeird, pinPlane, new Set(), mulberry32(431000 + i), 431000 + i));
    if (["swimming", "diving", "wading"].some((t) => h.has(t))) divePlane += 1;
  }
  eq("weird airplane never auto swim/dive/wade", divePlane, 0);
  const pinCinema = applyPin(lex, new Set(), new Set(), "movie theater").pinned;
  const sWeirdAct = { ...sWeird, heats: ["activity"], weights: { activity: 1, tease: 0, flash: 0, sex: 0 } };
  let horseCinema = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sWeirdAct, pinCinema, new Set(), mulberry32(431040 + i), 431040 + i));
    if (h.has("horseback riding")) horseCinema += 1;
  }
  eq("weird movie theater never auto horseback", horseCinema, 0);
  const pinSki = applyPin(lex, new Set(), new Set(), "skiing").pinned;
  let maidSki = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSki, new Set(), mulberry32(431080 + i), 431080 + i));
    if (h.has("maid")) maidSki += 1;
  }
  eq("normal skiing never auto maid", maidSki, 0);
  const pinDojo = applyPin(lex, new Set(), new Set(), "dojo").pinned;
  let ballDojo = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinDojo, new Set(), mulberry32(431120 + i), 431120 + i));
    if (["basketball uniform", "tennis uniform", "soccer uniform"].some((t) => h.has(t))) ballDojo += 1;
  }
  eq("normal dojo never auto ball uniforms", ballDojo, 0);
  const pinPrison = applyPin(lex, new Set(), new Set(), "prison").pinned;
  let bunnyPrison = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinPrison, new Set(), mulberry32(431160 + i), 431160 + i));
    if (["playboy bunny", "idol clothes", "cheerleader"].some((t) => h.has(t))) bunnyPrison += 1;
  }
  eq("normal prison never auto bunny/idol/cheerleader", bunnyPrison, 0);
  const pinSleep = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  let sleepCity = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSleep, new Set(), mulberry32(431200 + i), 431200 + i));
    if (["city", "cityscape", "street"].some((t) => h.has(t))) sleepCity += 1;
  }
  eq("normal sleeping never auto city/street", sleepCity, 0);
  const pinBiki = applyPin(lex, new Set(), new Set(), "bikini").pinned;
  const sTease = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  let pocketBiki = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sTease, pinBiki, new Set(), mulberry32(431240 + i), 431240 + i));
    if (h.has("hand in pocket")) pocketBiki += 1;
  }
  eq("bikini never auto hand in pocket", pocketBiki, 0);
  const pinFinger = applyPin(lex, new Set(), new Set(), "fingering").pinned;
  const sSexWeird = { ...s, heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 }, sceneMode: "weird", lockScene: false };
  let armsFinger = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sSexWeird, pinFinger, new Set(), mulberry32(431280 + i), 431280 + i));
    if (h.has("arms under breasts") || h.has("arms behind back") || h.has("heart hands")) armsFinger += 1;
  }
  eq("fingering never auto both-arms poses", armsFinger, 0);
  let panNoCook = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(431320 + i), 431320 + i));
    if (h.has("frying pan") && !h.has("cooking")) panNoCook += 1;
  }
  eq("frying pan never without cooking", panNoCook, 0);
  const pinFish = applyPin(lex, new Set(), new Set(), "fishing").pinned;
  let fishFeet = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinFish, new Set(), mulberry32(440000 + i), 440000 + i));
    if (["boots", "sandals", "shoes", "sneakers"].some((t) => h.has(t))) fishFeet += 1;
  }
  ok("pinned fishing can still draw boots/sandals/shoes", fishFeet > 0, `feet=${fishFeet}/80`);
  const pinSleep2 = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  const SLEEP_BAD = [
    "tennis court",
    "soccer field",
    "pool",
    "classroom",
    "office",
    "running track",
    "boxing ring",
    "skyscraper",
    "golf course",
    "rice paddy",
    "basketball court",
  ];
  let sleepBad = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSleep2, new Set(), mulberry32(440080 + i), 440080 + i));
    if (SLEEP_BAD.some((t) => h.has(t))) sleepBad += 1;
  }
  eq("normal sleeping never auto sport/work places", sleepBad, 0);
  const pinDrive2 = applyPin(lex, new Set(), new Set(), "driving").pinned;
  let driveSwim = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinDrive2, new Set(), mulberry32(440120 + i), 440120 + i));
    if ([...h].some((t) => /\b(bikini|swimsuit)\b/.test(t))) driveSwim += 1;
  }
  eq("normal driving never leftover swimsuit", driveSwim, 0);
  const pinCookLap = applyPin(lex, new Set(), new Set(), "cooking").pinned;
  let cookLap = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinCookLap, new Set(), mulberry32(440160 + i), 440160 + i));
    if (h.has("sitting on lap") || h.has("straddling")) cookLap += 1;
  }
  eq("cooking never auto sitting on lap/straddling", cookLap, 0);
  function leftoverSwim(pinTag, seed) {
    const p = applyPin(lex, new Set(), new Set(), pinTag).pinned;
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, s, p, new Set(), mulberry32(seed + i), seed + i));
      if ([...h].some((t) => /\b(bikini|swimsuit)\b/.test(t))) n += 1;
    }
    return n;
  }
  eq("normal karaoke never leftover swimsuit", leftoverSwim("karaoke", 440200), 0);
  eq("normal cafe never leftover swimsuit", leftoverSwim("cafe", 440240), 0);
  eq("normal restaurant never leftover swimsuit", leftoverSwim("restaurant", 440280), 0);
  eq("normal shopping never leftover swimsuit", leftoverSwim("shopping", 440320), 0);
  const sTeaseN = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  const pinSleep3 = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  let sleepSwim = 0;
  let sleepSuit = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sTeaseN, pinSleep3, new Set(), mulberry32(440360 + i), 440360 + i));
    if ([...h].some((t) => /\b(bikini|swimsuit)\b/.test(t))) sleepSwim += 1;
    if ([...h].some((t) => /\b(wedding dress|evening gown|power armor)\b/.test(t))) sleepSuit += 1;
  }
  eq("normal sleeping never leftover swimsuit", sleepSwim, 0);
  eq("normal sleeping never leftover wedding dress/evening gown", sleepSuit, 0);
  const pinFish2 = applyPin(lex, new Set(), new Set(), "fishing").pinned;
  let fishStand = 0;
  let fishFeet2 = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinFish2, new Set(), mulberry32(440400 + i), 440400 + i));
    if (h.has("standing")) fishStand += 1;
    if (["boots", "sandals", "shoes", "sneakers"].some((t) => h.has(t))) fishFeet2 += 1;
  }
  ok("pinned fishing can stand", fishStand > 0, `stand=${fishStand}/80`);
  ok("pinned fishing can draw boots/sandals/shoes after swim-unlock", fishFeet2 > 0, `feet=${fishFeet2}/80`);
  const pinCamp = applyPin(lex, new Set(), new Set(), "camping").pinned;
  let campTent = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinCamp, new Set(), mulberry32(440480 + i), 440480 + i));
    if (h.has("tent")) campTent += 1;
  }
  ok("pinned camping can draw tent", campTent > 0, `tent=${campTent}/40`);
  const sMed = { ...s, eras: ["medieval"] };
  const pinPal = applyPin(lex, new Set(), new Set(), "palace").pinned;
  let palArmor = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sMed, pinPal, new Set(), mulberry32(440520 + i), 440520 + i));
    if ([...h].some((t) => /\barmor\b/.test(t))) palArmor += 1;
  }
  ok("medieval palace can still have armor", palArmor > 0, `armor=${palArmor}/40`);
  const pinLock = applyPin(lex, new Set(), new Set(), "locker room").pinned;
  let lockSwim = 0;
  // 第六輪（2026-10-06）服裝池變大，更衣室抽到泳裝從約 12% 降到 8%（400 張 47 → 32），
  // 40 張剛好抽到 0。規則沒變（抽得到），樣本放大到 120。
  for (let i = 0; i < 120; i++) {
    const h = tagsOf(drawOne(lex, s, pinLock, new Set(), mulberry32(440560 + i), 440560 + i));
    if ([...h].some((t) => /\b(bikini|swimsuit)\b/.test(t))) lockSwim += 1;
  }
  ok("locker room can draw swimsuit", lockSwim > 0, `swim=${lockSwim}/40`);
  const pinBeach = applyPin(lex, new Set(), new Set(), "beach").pinned;
  let beachCasual = 0;
  let beachSuit = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinBeach, new Set(), mulberry32(440600 + i), 440600 + i));
    if (["sundress", "shirt", "white shirt", "school uniform"].some((t) => h.has(t))) beachCasual += 1;
    if ([...h].some((t) => /\b(armor|suit)\b/.test(t) && !/swimsuit/.test(t))) beachSuit += 1;
  }
  ok("beach can draw sundress/shirt/school uniform", beachCasual > 0, `casual=${beachCasual}/40`);
  eq("beach never leftover armor/suit", beachSuit, 0);
  const pinWade = applyPin(lex, new Set(), new Set(), "wading").pinned;
  let wadeStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinWade, new Set(), mulberry32(440640 + i), 440640 + i));
    if (h.has("standing")) wadeStand += 1;
  }
  ok("pinned wading can stand", wadeStand > 0, `stand=${wadeStand}/40`);
  const pinBathLie = applyPin(lex, new Set(), new Set(), "bathing").pinned;
  const sTeaseB = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  let bathLie = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sTeaseB, pinBathLie, new Set(), mulberry32(440680 + i), 440680 + i));
    if (["lying", "on back", "reclining"].some((t) => h.has(t))) bathLie += 1;
  }
  ok("pinned bathing can lie/recline", bathLie > 0, `lie=${bathLie}/40`);
  const pinCookStand = applyPin(lex, new Set(), new Set(), "cooking").pinned;
  let cookStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinCookStand, new Set(), mulberry32(440720 + i), 440720 + i));
    if (h.has("standing")) cookStand += 1;
  }
  ok("pinned cooking can stand", cookStand > 0, `stand=${cookStand}/40`);
  const pinClean = applyPin(lex, new Set(), new Set(), "cleaning").pinned;
  let cleanStand = 0;
  // 身體格降權後，釘打掃的站姿大約一成。seed 440760 起的 40 張剛好是 0，80 張裡看得到。
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinClean, new Set(), mulberry32(440760 + i), 440760 + i));
    if (h.has("standing")) cleanStand += 1;
  }
  ok("pinned cleaning can stand", cleanStand > 0, `stand=${cleanStand}/80`);
  const pinCarry = applyPin(lex, new Set(), new Set(), "carrying").pinned;
  let carryStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinCarry, new Set(), mulberry32(440800 + i), 440800 + i));
    if (h.has("standing")) carryStand += 1;
  }
  ok("pinned carrying can stand", carryStand > 0, `stand=${carryStand}/40`);
  const sJob = { ...s, drawJob: true };
  const pinKit = applyPin(lex, new Set(), new Set(), "kitchen").pinned;
  let kitMaid = 0;
  // maid 在這組設定下本來就稀有（約 0.9%），80 個 seed 的窗口太容易整段落空。
  // 2026-10-10：兩人互動補 25 個字，亂數順序跟著變，這 400 張剛好 0。3000 張改前 16、改後 11（約 0.4%），
  // 規則沒變（抽得到），樣本放大到 2000。
  for (let i = 0; i < 2000; i++) {
    const h = tagsOf(drawOne(lex, sJob, pinKit, new Set(), mulberry32(440840 + i), 440840 + i));
    if (h.has("maid")) kitMaid += 1;
  }
  ok("pinned kitchen can still draw maid", kitMaid > 0, `maid=${kitMaid}/2000`);
  eq("diverse eating fits classroom", placeFitsActs("classroom", new Set(["eating"]), false), true);
  eq("normal eating does not fit classroom", placeFitsActs("classroom", new Set(["eating"]), true), false);
  const pinEat = applyPin(lex, new Set(), new Set(), "eating").pinned;
  const sNormEat = { ...s, sceneMode: "normal", lockScene: true };
  let normClass = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sNormEat, pinEat, new Set(), mulberry32(441000 + i), 441000 + i));
    if (h.has("classroom")) normClass += 1;
  }
  eq("normal eating never auto classroom", normClass, 0);
  const pinFit = applyPin(lex, new Set(), new Set(), "fitting room").pinned;
  let fitSwim = 0;
  // 第三輪衣服進池之後，釘試衣間的泳裝大約百分之六。seed 441040 起的 40 張剛好是 0，80 張裡看得到。
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinFit, new Set(), mulberry32(441040 + i), 441040 + i));
    if ([...h].some((t) => /\b(bikini|swimsuit)\b/.test(t))) fitSwim += 1;
  }
  ok("fitting room can draw swimsuit", fitSwim > 0, `swim=${fitSwim}/80`);
  const pinUw = applyPin(lex, new Set(), new Set(), "underwater").pinned;
  let uwSwim = 0;
  let uwStreet = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinUw, new Set(), mulberry32(441080 + i), 441080 + i));
    if ([...h].some((t) => /\b(bikini|swimsuit)\b/.test(t))) uwSwim += 1;
    if (["sundress", "school uniform", "maid", "shirt", "white shirt"].some((t) => h.has(t))) uwStreet += 1;
  }
  ok("underwater can draw swimsuit", uwSwim > 0, `swim=${uwSwim}/40`);
  eq("underwater never leftover street clothes", uwStreet, 0);
  const pinBikeSit = applyPin(lex, new Set(), new Set(), "riding bicycle").pinned;
  let bikeSit = 0;
  let bikeChair = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinBikeSit, new Set(), mulberry32(441120 + i), 441120 + i));
    if (h.has("sitting")) bikeSit += 1;
    if (h.has("on chair")) bikeChair += 1;
  }
  ok("pinned riding bicycle can sit", bikeSit > 0, `sit=${bikeSit}/40`);
  eq("riding bicycle never auto on chair", bikeChair, 0);
  const pinEx = applyPin(lex, new Set(), new Set(), "exercising").pinned;
  let exStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinEx, new Set(), mulberry32(441160 + i), 441160 + i));
    if (h.has("standing")) exStand += 1;
  }
  ok("pinned exercising can stand", exStand > 0, `stand=${exStand}/40`);
  const pinLift = applyPin(lex, new Set(), new Set(), "weightlifting").pinned;
  let liftStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinLift, new Set(), mulberry32(441200 + i), 441200 + i));
    if (h.has("standing")) liftStand += 1;
  }
  ok("pinned weightlifting can stand", liftStand > 0, `stand=${liftStand}/40`);
  const pinSport = applyPin(lex, new Set(), new Set(), "playing sports").pinned;
  let sportStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSport, new Set(), mulberry32(441240 + i), 441240 + i));
    if (h.has("standing")) sportStand += 1;
  }
  ok("pinned playing sports can stand", sportStand > 0, `stand=${sportStand}/40`);
  const pinDrink = applyPin(lex, new Set(), new Set(), "drinking").pinned;
  let iza = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinDrink, new Set(), mulberry32(441280 + i), 441280 + i));
    if (h.has("izakaya")) iza += 1;
  }
  ok("normal drinking can be at izakaya", iza > 0, `izakaya=${iza}/80`);
  const pinGames = applyPin(lex, new Set(), new Set(), "playing video games").pinned;
  let cafeNet = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinGames, new Set(), mulberry32(441360 + i), 441360 + i));
    if (h.has("internet cafe")) cafeNet += 1;
  }
  ok("normal video games can be at internet cafe", cafeNet > 0, `netcafe=${cafeNet}/80`);
  const pinPhone = applyPin(lex, new Set(), new Set(), "talking on phone").pinned;
  let carPhone = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinPhone, new Set(), mulberry32(441440 + i), 441440 + i));
    if (h.has("car interior")) carPhone += 1;
  }
  ok("normal phone can be in car interior", carPhone > 0, `car=${carPhone}/80`);
  const pinSleepAir = applyPin(lex, new Set(), new Set(), "sleeping").pinned;
  const sTeaseAir = { ...s, heats: ["tease"], weights: { activity: 0, tease: 1, flash: 0, sex: 0 } };
  let sleepAir = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, sTeaseAir, pinSleepAir, new Set(), mulberry32(441520 + i), 441520 + i));
    if (h.has("airplane interior")) sleepAir += 1;
  }
  ok("normal sleeping can be on an airplane", sleepAir > 0, `plane=${sleepAir}/80`);
  const pinJog = applyPin(lex, new Set(), new Set(), "jogging").pinned;
  const sFlash = { ...s, heats: ["flash"], weights: { activity: 0, tease: 0, flash: 1, sex: 0 } };
  let jogSpread = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, sFlash, pinJog, new Set(), mulberry32(441600 + i), 441600 + i));
    if (h.has("spread legs") || h.has("m legs")) jogSpread += 1;
  }
  eq("jogging never leftover m legs/spread legs", jogSpread, 0);
  let pinJogM = applyPin(lex, new Set(), new Set(), "jogging").pinned;
  pinJogM = applyPin(lex, pinJogM, new Set(), "m legs").pinned;
  let kept = 0;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, sFlash, pinJogM, new Set(), mulberry32(441680 + i), 441680 + i));
    if (h.has("jogging") && h.has("m legs")) kept += 1;
  }
  eq("pinned jogging + m legs stays", kept, 20);
  const pinRead = applyPin(lex, new Set(), new Set(), "reading").pinned;
  let readBook = 0;
  const readProps = new Set();
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinRead, new Set(), mulberry32(441720 + i), 441720 + i));
    const got = ["book", "newspaper"].filter((p) => h.has(p));
    if (got.length) readBook += 1;
    for (const p of got) readProps.add(p);
  }
  // 同 cooking 那條：保證的是「讀東西一定有東西可讀」。報紙是現代／維多利亞
  // 才有的候選，所以古代時代仍然只會是書。
  eq("pinned reading always keeps something to read", readBook, 40);
  ok("reading prop is not always the same one", readProps.size >= 2, [...readProps].join("/"));
  const pinSelfie = applyPin(lex, new Set(), new Set(), "selfie").pinned;
  let selfiePhone = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSelfie, new Set(), mulberry32(441760 + i), 441760 + i));
    if (h.has("cellphone")) selfiePhone += 1;
  }
  eq("pinned selfie always keeps cellphone", selfiePhone, 40);
  const pinBathRoom = applyPin(lex, new Set(), new Set(), "bathroom").pinned;
  let bathCasual = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinBathRoom, new Set(), mulberry32(441800 + i), 441800 + i));
    if (["shirt", "white shirt", "pajamas", "school uniform", "sundress"].some((t) => h.has(t))) bathCasual += 1;
  }
  ok("bathroom without bathing can draw casual clothes", bathCasual > 0, `casual=${bathCasual}/40`);
  const pinBeachShoes = applyPin(lex, new Set(), new Set(), "beach").pinned;
  let beachShoes = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinBeachShoes, new Set(), mulberry32(441840 + i), 441840 + i));
    if (["sneakers", "shoes", "sandals"].some((t) => h.has(t))) beachShoes += 1;
  }
  ok("beach without swimming can draw sneakers/sandals", beachShoes > 0, `shoes=${beachShoes}/40`);
  const pinHike = applyPin(lex, new Set(), new Set(), "hiking").pinned;
  let hikeStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinHike, new Set(), mulberry32(441880 + i), 441880 + i));
    if (h.has("standing")) hikeStand += 1;
  }
  ok("pinned hiking can stand", hikeStand > 0, `stand=${hikeStand}/40`);
  const pinSkiStand = applyPin(lex, new Set(), new Set(), "skiing").pinned;
  let skiStand = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinSkiStand, new Set(), mulberry32(441920 + i), 441920 + i));
    if (h.has("standing")) skiStand += 1;
  }
  ok("pinned skiing can stand", skiStand > 0, `stand=${skiStand}/40`);
  const pinReadTrain = applyPin(lex, new Set(), new Set(), "reading").pinned;
  let readTrain = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinReadTrain, new Set(), mulberry32(441960 + i), 441960 + i));
    if (h.has("train") || h.has("train interior")) readTrain += 1;
  }
  ok("normal reading can be on a train", readTrain > 0, `train=${readTrain}/80`);
  const pinEatIza = applyPin(lex, new Set(), new Set(), "eating").pinned;
  let eatIza = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinEatIza, new Set(), mulberry32(442040 + i), 442040 + i));
    if (h.has("izakaya")) eatIza += 1;
  }
  ok("normal eating can be at izakaya", eatIza > 0, `izakaya=${eatIza}/80`);
  const pinSmoke = applyPin(lex, new Set(), new Set(), "smoking").pinned;
  let smokeIza = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinSmoke, new Set(), mulberry32(442120 + i), 442120 + i));
    if (h.has("izakaya")) smokeIza += 1;
  }
  ok("normal smoking can be at izakaya", smokeIza > 0, `izakaya=${smokeIza}/80`);
  const pinSelfieCar = applyPin(lex, new Set(), new Set(), "selfie").pinned;
  let selfieCar = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, s, pinSelfieCar, new Set(), mulberry32(442200 + i), 442200 + i));
    if (h.has("car interior")) selfieCar += 1;
  }
  ok("normal selfie can be in a car", selfieCar > 0, `car=${selfieCar}/80`);
  const pinPicnic = applyPin(lex, new Set(), new Set(), "picnic").pinned;
  let picnicArms = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinPicnic, new Set(), mulberry32(442280 + i), 442280 + i));
    if (h.has("arms under breasts") || h.has("heart hands") || h.has("crossed arms")) picnicArms += 1;
  }
  eq("picnic never leftover both-arms poses", picnicArms, 0);
  const pinTrack = applyPin(lex, new Set(), new Set(), "running track").pinned;
  for (const mode of ["normal", "diverse", "weird"]) {
    const sm = { ...s, sceneMode: mode, lockScene: mode !== "weird" };
    let bedOnTrack = 0;
    for (let i = 0; i < 40; i++) {
      const h = tagsOf(drawOne(lex, sm, pinTrack, new Set(), mulberry32(442320 + mode.length * 40 + i), 442320 + mode.length * 40 + i));
      if (h.has("on bed") || h.has("bed sheet")) bedOnTrack += 1;
    }
    eq(`${mode} running track never leftover on bed/bed sheet`, bedOnTrack, 0);
  }
  let pinTrackBed = applyPin(lex, new Set(), new Set(), "running track").pinned;
  pinTrackBed = applyPin(lex, pinTrackBed, new Set(), "on bed").pinned;
  let keptBed = 0;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, s, pinTrackBed, new Set(), mulberry32(442480 + i), 442480 + i));
    if (h.has("running track") && h.has("on bed")) keptBed += 1;
  }
  eq("pinned running track + on bed stays", keptBed, 20);
  let pinTrackSheet = applyPin(lex, new Set(), new Set(), "running track").pinned;
  pinTrackSheet = applyPin(lex, pinTrackSheet, new Set(), "bed sheet").pinned;
  let keptSheet = 0;
  for (let i = 0; i < 20; i++) {
    const h = tagsOf(drawOne(lex, s, pinTrackSheet, new Set(), mulberry32(442500 + i), 442500 + i));
    if (h.has("running track") && h.has("bed sheet")) keptSheet += 1;
  }
  eq("pinned running track + bed sheet stays", keptSheet, 20);
  const pinBedroom = applyPin(lex, new Set(), new Set(), "bedroom").pinned;
  const sDivBed = { ...s, sceneMode: "diverse", lockScene: true };
  let bedKept = 0;
  for (let i = 0; i < 80; i++) {
    const h = tagsOf(drawOne(lex, sDivBed, pinBedroom, new Set(), mulberry32(442520 + i), 442520 + i));
    if (h.has("on bed") || h.has("bed sheet")) bedKept += 1;
  }
  ok("diverse bedroom leftover can keep on bed/bed sheet", bedKept > 0, `bed=${bedKept}/80`);
  const sWeird2 = { ...s, sceneMode: "weird", lockScene: false };
  const pinWade2 = applyPin(lex, new Set(), new Set(), "wading").pinned;
  let wadeLie = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sWeird2, pinWade2, new Set(), mulberry32(442600 + i), 442600 + i));
    if (["crawling", "on back", "lying", "on stomach"].some((t) => h.has(t))) wadeLie += 1;
  }
  eq("wading never leftover crawl/lie", wadeLie, 0);
  const pinDive = applyPin(lex, new Set(), new Set(), "diving").pinned;
  let diveDry = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sWeird2, pinDive, new Set(), mulberry32(442640 + i), 442640 + i));
    if (["bathroom", "prison", "colonnade", "classroom"].some((t) => h.has(t))) diveDry += 1;
  }
  eq("weird diving never leftover dry indoor", diveDry, 0);
  let pinCookLie = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  pinCookLie = applyPin(lex, pinCookLie, new Set(), "solo").pinned;
  pinCookLie = applyPin(lex, pinCookLie, new Set(), "cooking").pinned;
  let cookLie = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinCookLie, new Set(), mulberry32(442680 + i), 442680 + i));
    if (["lying", "on back", "on stomach"].some((t) => h.has(t))) cookLie += 1;
  }
  eq("cooking never leftover lie/on back/on stomach", cookLie, 0);
  let pinEatProne = applyPin(lex, new Set(), new Set(), "1girl").pinned;
  pinEatProne = applyPin(lex, pinEatProne, new Set(), "solo").pinned;
  pinEatProne = applyPin(lex, pinEatProne, new Set(), "eating").pinned;
  let eatProne = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinEatProne, new Set(), mulberry32(442720 + i), 442720 + i));
    if (h.has("on stomach")) eatProne += 1;
  }
  eq("eating never leftover on stomach", eatProne, 0);
  const pinBike = applyPin(lex, new Set(), new Set(), "riding bicycle").pinned;
  let bikeIn = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sWeird2, pinBike, new Set(), mulberry32(442760 + i), 442760 + i));
    if (["train interior", "movie theater", "classroom"].some((t) => h.has(t))) bikeIn += 1;
  }
  eq("bicycle never leftover indoor rooms", bikeIn, 0);
  const pinGuit = applyPin(lex, new Set(), new Set(), "playing guitar").pinned;
  const sSexG = { ...s, heats: ["sex"], weights: { activity: 0, tease: 0, flash: 0, sex: 1 } };
  let gitMast = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, sSexG, pinGuit, new Set(), mulberry32(442800 + i), 442800 + i));
    if (h.has("masturbation") || h.has("female masturbation")) gitMast += 1;
  }
  eq("guitar never leftover masturbation", gitMast, 0);
  const pinFishDance = applyPin(lex, new Set(), new Set(), "fishing").pinned;
  let fishDance = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinFishDance, new Set(), mulberry32(442840 + i), 442840 + i));
    if (h.has("dancing")) fishDance += 1;
  }
  eq("fishing never leftover dancing", fishDance, 0);
  const pinFlat = applyPin(lex, new Set(), new Set(), "flat chest").pinned;
  let hang = 0;
  for (let i = 0; i < 40; i++) {
    const h = tagsOf(drawOne(lex, s, pinFlat, new Set(), mulberry32(442880 + i), 442880 + i));
    if (h.has("hanging breasts")) hang += 1;
  }
  eq("flat chest never leftover hanging breasts", hang, 0);

  const shadowIntegrationDraw = drawOne(
    lex,
    defaultSettings(data),
    new Set(),
    new Set(),
    mulberry32(42),
    42,
  );
  eq("shadow integration keeps seed 42 POS byte-identical", shadowIntegrationDraw.positive,
    // 第十四次：跑完 verify_danbooru_tags.mjs --all（整個詞庫 1450 個字）之後的清理，
    // 一共移除二十個模型沒把它們當 tag 學過的字，外加一個假的時代錨：
    //
    //   十四個「從來沒有圖用過」（post_count 0 且沒有 alias 紀錄）：milf、
    //   violet eyes、pink nipples、presenting ass、one knee up、pinned down、
    //   self fondling、open-air bath、dormitory、food stall、nerd、hobgoblin、
    //   webtoon、clean lines
    //
    //   六個「2022～23 就被 Danbooru 停用改標」（2024 的訓練快照裡已經是 0 張，
    //   模型學到的是替代字，而替代字都已經在詞庫裡跟舊名搶同一格）：bangs、
    //   amber eyes、silver hair、looking away、creampie、areolae
    //
    //   時代錨 modern（Danbooru 上是 artist 分類、post_count 0，而現代本來就
    //   不需要錨 —— 實測 96.8% 的現代圖另外帶著現代專屬的場地或服裝）
    //
    // 二十一個字從候選池消失，牌序整條位移，所以差很多 —— 不是金標壞掉。
    // 另外少了開頭的 adult：它同樣是 0 張、模型沒學過，而且不是抽來的、是被
    // 無條件塞進每一張圖的，所以拿掉它**不會**動到牌序（同一批 seed 的
    // loli 23→23、petite 164→164 逐字相同），只是這一個字不見了。
    // 新的這張仍然自洽，而且**沒有 modern 這個字**卻明顯是現代：love hotel、
    // 檯燈、散景、夾克。詳細裁決與量測見討論區。
    // 衣著權重的時代層從 12/9 提到 40/30（修時代還原度）後 RNG 路徑刻意改變；
    // 2026-09-15 再次重產兩次：先是 PRIVATE_SEX_PLACE 擴到含各時代的私密場地，
    // 後是光源那一格開始真的會填（以前 14 個光源只有 3% 機率出現）。兩次都讓
    // 候選池變大、RNG 路徑移位。分布差異記在 findings.md，不是拿金標蓋問題。
    // 同日第三次：拿掉 sports bra -> bra（Danbooru 上沒有這條 implication）。
    // 第四次：場地那一格從硬桶改成 4:1 軟權重（era:[any] 場地本來幾乎抽不到，
    // beach 在 18000 張裡是 0）。場地換了，整條 RNG 就跟著換人，所以這次差很多 ——
    // 不是金標壞掉，是那一格真的改了。理由與量測見 findings.md Loop 14 第四節。
    // 第十次：洗澡當下不再穿袍子。這一張正是淋浴間，naked towel -> completely nude
    // 就是那一擲真的生效了（作者本來寫的 0.34 以前問的是 pinned，自然抽到的浴場
    // 永遠不觸發）。leaning forward -> bondage 是牌序位移。
    // 第九次：移除五個 Danbooru 查無的自創字（lotus pond／great hall／
    // extreme close-up／washing body／free use）。候選池少了五個，牌序整條位移，
    // 所以差異比較大。新的這張仍然自洽：shower (place) + indoors + steam，
    // 蒸氣出現在淋浴間是對的。
    // 第八次：配件補回互斥格（necklace／bowtie／necktie／gloves 家族在 normal 模式
    // 整族抽不到）。這一張多出來的 hoop earrings + earrings 就是 jewelry 那一格
    // 多了競爭者的結果 —— 純粹是多了兩個字，其餘一個 byte 都沒動，沒有重排。
    // 第七次：預設 env 配額 4 -> 6（通用 fill("env") 以前一格預算都不剩，天空、
    // 家具、攝影感、運動器材共 40 個字在預設設定下永遠抽不到）。這一張多出來的
    // chromatic aberration 正是那批字之一 —— 金標本身就是這次改動的示範。
    // 同時 nude -> bathrobe、pointing at viewer -> female ejaculation 是牌序位移。
    // 第六次：天氣那一格開始會填了（室外 15% 擲骰，浴場改擲蒸氣）。這一張抽到的是
    // onsen，所以蒸氣那一擲有發生、只是沒中（0.35），但那一次 rand() 就足以把後面
    // 整條序列往後推 —— 差異因此不只一格：naked towel -> nude、leaning forward ->
    // pointing at viewer、day/spotlight -> sunset/backlighting。這是牌序位移，
    // 不是哪一條規則變鬆。理由與量測見討論區。
    // 第五次：拿掉每張圖硬掛的 soft lighting（Danbooru 0 篇，也不在
    // Illustrious 的訓練字彙裡）。同時被拿掉的 cinematic lighting 與 firelight 沒有
    // 讓這條 RNG 路徑位移，所以這次的差異就只有少了那一個字。
    // 這次差異只有少一個 bra，其餘一個 byte 都沒動 —— 沒有重排、沒有換字，
    // 正是「只改該改的那一格」應有的樣子。
    // 第十三次（同一批改動，分兩次量）：服裝的傘狀父項補回互斥格（UMBRELLA 把 bikini／dress／shirt 這些
    // 通用詞的 mutex 清成 None，於是釘比基尼會配上襯衫加裙子），外加「只穿一件」
    // 與「泳衣不配內衣」兩條規則。服裝那一整段的候選集合都變了，牌序整條位移。
    // 新的這張自洽：浴缸、室內、黃昏光。
    // 第十二次：傢俱那一格補上專屬的 fillSlot（跟天氣、光源當初同一種病 ——
    // env 的五個格子都有人填，只有 furniture 沒有，整格只有 0.4%，連 on bed 在
    // 5184 張的面板掃描裡都是 0）。這一張本身沒有傢俱，但室內的傢俱擲骰有發生、
    // 只是沒中，那一次 rand() 就把後面整條序列往後推 —— nude -> bathrobe、
    // sunrise/ceiling light/surreal -> dusk/shadow/bokeh 都是牌序位移。
    // 新的這張仍然自洽：浴缸、室內、黃昏光；浴袍配浴缸沒問題，「洗澡時不穿袍子」
    // 那條規則管的是正在洗澡的活動，這一張的活動是別的。
    // 第十一次：special_prompts 語料稽核加進 105 個字（詞庫 1292 -> 1397）。
    // 候選池變大 13%，牌序整條位移，所以這次差異很大 —— 不是哪條規則變鬆。
    // 新的這一張自洽：bathtub + indoors + nude + female masturbation 說得通，
    // 而且裡面就有兩個這次新加的字（nervous smile、surreal），正好是這次改動的示範。
    // 第十五次：移除不是 Danbooru tag 的 soft breasts / natural breasts。
    // 候選池縮小會讓同一串 RNG 映射到不同候選；新結果仍有完整人物、動作、場景與光線，
    // 且固定快照依然逐字驗證，避免後續變更悄悄改掉 seed 42。
    // 第十六次（2026-09-26）：詞庫加進背景／用色／打光／特效／構圖 47 個字，場地前面多了一格
    // 「背景」。這張從浴場換成白背景的立繪。
    // 第十七次（2026-09-27）：精液類改成必須有男性才進池（女生單獨的圖不再抽到 cum）。
    // 候選池變小，同一串亂數落到別的字。這張仍是單人女性的性愛，沒有陰莖或精液。
    // 第十八次（2026-09-27）：加 30 個色情字。單人女性能進池的那些讓候選池變大，
    // 牌序整條位移。這張仍是 1girl solo 的性愛，沒有男生、陰莖或精液。
    // 第十九次（2026-09-28）：鳥瞰、貼地仰視進鏡頭池；用過的保險套改成只有性愛。
    // 誘惑的鏡頭洗牌和衣服池都挪了，牌序整條位移。不再出現 hand in panties 是池子挪動，
    // 不是那個洞補上了。這張仍是 1girl solo，沒有男生、陰莖或粗暴。
    // 第二十次（2026-09-28）：現代、三檔都進的新衣服進了衣服池，牌序再位移一次。
    // 女巫帽不在現代，廚師預設不抽。這張仍是 1girl solo，溫泉、裸巾、沒有男生。
    // 第二十一次（2026-09-28）：舉手、走路、跑步、跳躍、四種髮型，以及瑪麗珍鞋、及膝靴、格裙進池。
    // 立乳不進誘惑。內射受孕和抓手腕要一男一女，不進單人女性。這張仍是 1girl solo 的性愛，
    // 旅館、沒有男生。
    // 第二十二次（2026-09-28）：第三輪 22 個新字進池。抓頭髮本來就在，改成只有性愛的姿勢，
    // 不另加同名的一筆。單人女性能進的髮型、表情、衣服和特徵讓候選池變大，牌序整條位移。
    // 按住頭要一男一女，不進這張。這張仍是 1girl solo，沒有男生。
    // 第二十三次（2026-09-28）：loli 離開候選池。沒有水的濕、雪配泳衣、騎車配走跑跳、
    // 跳水配走跑劈腿、漂浮配走跑、被褥配直立、全身動作配半身構圖、沒有怪物的獠牙都不再成立。
    // 現代外套和聚光燈的權重也降了。牌序再位移一次。這張仍是 1girl solo，沒有男生。
    // 第二十四次（2026-09-28）：站立劈腿、踮腳、走路、跑步、跳躍在身體格降權。
    // 站立劈腿再按種子擋掉三成。牌序再位移一次。這張仍是 1girl solo，沒有男生。
    // 第二十五次（2026-09-28）：立乳、穴口滴精離開池。抓手腕改成 holding another's wrist，
    // 要一男一女，不進這張。牌序再位移一次。這張仍是 1girl solo，沒有男生。
    // 第二十六次（2026-09-29）：路人不再跟「無人類」寫在同一行硬擋，環境池多了一個字。
    // 這張的環境落點換了，後面的束縛沒抽到，手銬也就沒被拉進來，換成咬自己的嘴唇。
    // 仍是單人女性、道場、室內、夜。乳貼和運動服這張都沒補。
    // 第二十七次（2026-09-29）：沒釘場所的性愛不再只用私密場地，場地權重改成平的。
    // 這張是性愛，場地從道場換成巴士車廂，後面的表情和畫面字跟著換。仍是單人女性、室內。
    // 第二十八次（2026-10-05）：56 個現役詞進池。鏡頭、表情、衣服、破衣、膚況和
    // 全年齡場地會挪動單人女性的牌序。性愛主題不佔體位格。這張仍是 1girl solo，
    // 水手服、隔著衣服自慰、車廂，沒有男生、陰莖或精液。
    // 第二十九次（2026-10-05）：CSV 缺的現役詞進池。looking away 不收回。
    // 牌序再位移一次。這張仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十次（2026-10-05）：第二輪 149 個現役詞進池。這張換成澡堂、全身塗裝、指交。
    // 仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十一次（2026-10-05）：第三輪 104 個現役詞進池。這張換成山、單眼眼罩、
    // 肚臍穿環、性愛機器。仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十二次（2026-10-06）：第四輪 157 個、地點與第五輪 247 個現役詞進池。
    // 這張換成自由女神、超級英雄裝、拉鍊。仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十三次（2026-10-06）：第六輪 CSV 119 個現役詞進池（袖長、蝴蝶結、獸耳這些）。
    // 這張換成超短裙、過大襯衫、峽谷、人力車。仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十四次（2026-10-06）：花紋衣服拿掉，駕駛員服換成機甲駕駛服。
    // 這張換成過大的衣服、破襯衫、藍內褲、屈膝禮、背面。仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十五次（2026-10-09）：胸圍改成照常見程度加權（fillBreastSize，種子派生的獨立亂數）。只有胸圍這張變（中等胸部 → 巨乳），其餘逐字相同。
    // 第三十六次（2026-10-09）：長相自由格照常見程度加權（FEATURE_SHARE）。鞭痕、巨臀、臀部刺青換成乳搖、胸擱桌上、亮瞳孔；
    // 長相不同，後面的姿勢、場景跟著換（單膝跪、仰角、餐廳）。仍是 1girl solo，沒有男生。
    // 第三十七次（2026-10-09）：胸部互動 118 個現役詞進池。這張換成羽毛翅膀、紫洋裝、指交、晴空塔。
    // 仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十八次（2026-10-09）：第三、四輪 38 個現役詞進池。這張換成大量泌乳、觸手夾乳、玄關。
    // 仍是 1girl solo，沒有男生，也沒有人類陰莖。
    // 第三十九次（2026-10-09）：正常場景不再自己補手的構圖母題（HAND_MOTIF）。只有觸手夾乳換成乳頭牽繩。仍是 1girl solo，沒有男生。
    "1girl, solo, very short hair, yellow eyes, aqua hair, undercut, huge breasts, hair flower, excessive lactation, lactation, completely nude, jewelry, glasses, neck ribbon, ribbon, masturbation, squatting, portrait, averting eyes, naughty face, nipple leash, genkan, indoors, twilight, moonlight, confetti, nsfw, explicit, masterpiece, best quality, amazing quality");
  ok("drawOne exposes shadow diagnostics", Array.isArray(shadowIntegrationDraw.shadowViolations));

  const eatProneShadow = validateSupportShadow({
    tags: ["eating", "on stomach", "1girl", "solo"],
    pinned: new Set(),
    mode: "normal",
    people: 1,
  });
  eq("shadow detects normal eating prone", eatProneShadow.map((v) => v.rule_id), ["support:eating-prone"]);
  eq("shadow eating prone is hard auto conflict", [eatProneShadow[0]?.severity, eatProneShadow[0]?.origin], ["hard", "auto-conflict"]);

  const cookSupineShadow = validateSupportShadow({
    tags: ["cooking", "on back", "1girl", "solo"],
    pinned: [],
    mode: "normal",
    people: 1,
  });
  eq("shadow detects normal cooking supine", cookSupineShadow.map((v) => v.rule_id), ["support:cooking-supine"]);
  eq("shadow detects normal cooking prone as normal-only", validateSupportShadow({
    tags: ["cooking", "on stomach", "1girl", "solo"], mode: "normal", people: 1,
  }).map((v) => v.rule_id), ["support:cooking-prone-normal"]);

  const wadeCrawlShadow = validateSupportShadow({
    tags: ["wading", "crawling", "1girl", "solo"],
    pinned: [],
    mode: "weird",
    people: 1,
  });
  eq("shadow detects weird wading crawl", wadeCrawlShadow.map((v) => v.rule_id), ["support:wading-planted"]);

  const wadeBackShadow = validateSupportShadow({
    tags: ["wading", "on back", "1girl", "solo"],
    pinned: [],
    mode: "diverse",
    people: 1,
  });
  eq("shadow detects diverse wading supine", wadeBackShadow.map((v) => v.rule_id), ["support:wading-planted"]);

  eq("shadow allows weird eating prone", validateSupportShadow({
    tags: ["eating", "on stomach", "1girl", "solo"], mode: "weird", people: 1,
  }), []);
  eq("shadow allows weird cooking prone", validateSupportShadow({
    tags: ["cooking", "on stomach", "1girl", "solo"], mode: "weird", people: 1,
  }), []);
  eq("shadow ignores adjudicated-soft cleaning side", validateSupportShadow({
    tags: ["cleaning", "on side", "1girl", "solo"], mode: "normal", people: 1,
  }), []);
  eq("shadow skips same-actor rules for unattributed pairs", validateSupportShadow({
    tags: ["eating", "on stomach", "1girl", "1boy"], mode: "normal", people: 2,
  }), []);

  const pinnedSupportShadow = validateSupportShadow({
    tags: ["eating", "on stomach", "1girl", "solo"],
    pinned: new Set(["eating", "on stomach"]),
    mode: "normal",
    people: 1,
  });
  eq("shadow preserves two-sided pinned conflict as warning", {
    severity: pinnedSupportShadow[0]?.severity,
    declared: pinnedSupportShadow[0]?.declared_severity,
    origin: pinnedSupportShadow[0]?.origin,
  }, { severity: "warning", declared: "hard", origin: "pinned-conflict" });
  eq("candidate gate allows fully pinned conflict", supportCandidateAllowed({
    used: new Set(["eating"]),
    candidate: "on stomach",
    pinned: new Set(["eating", "on stomach"]),
    mode: "normal",
    people: 1,
  }), true);
  eq("candidate gate rejects automatic conflict", supportCandidateAllowed({
    used: new Set(["eating"]),
    candidate: "on stomach",
    pinned: new Set(["eating"]),
    mode: "normal",
    people: 1,
  }), false);
  eq("candidate gate ignores tags outside the four rules", supportCandidateAllowed({
    used: new Set(["eating", "on stomach"]),
    candidate: "blue eyes",
    pinned: new Set(),
    mode: "normal",
    people: 1,
  }), true);
  eq("candidate gate rejects a second forbidden pose on an existing conflict", supportCandidateAllowed({
    used: new Set(["cooking", "on back"]),
    candidate: "lying",
    pinned: new Set(),
    mode: "normal",
    people: 1,
  }), false);
  eq("diverse cooking on stomach is not the normal-only rule", supportCandidateAllowed({
    used: new Set(["cooking"]),
    candidate: "on stomach",
    pinned: new Set(),
    mode: "diverse",
    people: 1,
  }), true);
  eq("weird still rejects wading while crawling", supportCandidateAllowed({
    used: new Set(["wading"]),
    candidate: "crawling",
    pinned: new Set(),
    mode: "weird",
    people: 1,
  }), false);
  eq("two people skip the same-actor support rules", supportCandidateAllowed({
    used: new Set(["eating"]),
    candidate: "on stomach",
    pinned: new Set(),
    mode: "normal",
    people: 2,
  }), true);
}


// --- 必抽 ------------------------------------------------------------------
{
  const groupCount = (drawn, section, group) => {
    let n = 0;
    for (const t of drawn.positive.split(", ")) {
      const it = lex.byTag.get(t.trim());
      if (it && it.section === section && it.group === group) n += 1;
    }
    return n;
  };
  const mutexCount = (drawn, name) => {
    let n = 0;
    for (const t of drawn.positive.split(", ")) {
      const it = lex.byTag.get(t.trim());
      if (it && it.mutex === name) n += 1;
    }
    return n;
  };
  const draw = (tweak, seed) => {
    const s = settings();
    tweak(s);
    return drawOne(lex, s, new Set(), new Set(), mulberry32(seed), seed);
  };

  // 沒設必抽就什麼都沒變。
  const plain = draw(() => {}, 90001);
  eq("no mustDraw means empty report", plain.mustReport, []);

  // 必抽 3 個誘惑：tease 池子有 57 個又不互斥，只開誘惑時每一張都該抽滿。
  let teaseShort = 0;
  for (let i = 0; i < 40; i++) {
    const d = draw((s) => {
      s.heats = ["tease"];
      s.mustDraw = { "pose:tease": 3 };
    }, 90100 + i);
    if (groupCount(d, "pose", "tease") < 3) teaseShort += 1;
  }
  eq("must 3 tease always lands 3", teaseShort, 0);

  const teaseOne = draw((s) => {
    s.heats = ["tease"];
    s.mustDraw = { "pose:tease": 3 };
  }, 90100);
  eq("must report counts what landed", teaseOne.mustReport, [
    { key: "pose:tease", section: "pose", group: "tease", want: 3, got: 3 },
  ]);

  // 身體對不上時必抽要讓步，而且如實回報 —— 不硬湊出手在兩個地方的圖。
  let honestWhenShort = 0;
  let sawShort = 0;
  // 2026-10-09：胸部互動讓誘惑池變大，前 60 張都抽滿 3 個。短少還在，最早出現在 seed 90180。
  // 2026-10-09 第二次：第三、四輪又多了擁抱和手勢，短少提前到 seed 90123。窗口維持 160。
  for (let i = 0; i < 160; i++) {
    const d = draw((s) => {
      s.mustDraw = { "pose:tease": 3 };
    }, 90100 + i);
    const got = groupCount(d, "pose", "tease");
    if (got < 3) sawShort += 1;
    if (d.mustReport[0].got === got) honestWhenShort += 1;
  }
  eq("must report never lies", honestWhenShort, 160);
  ok("sex acts really can crowd out a must pose", sawShort > 0, `sawShort=${sawShort}`);

  // 互斥絕不破：髮色槽再怎麼必抽也只能有一個。
  let hairClash = 0;
  for (let i = 0; i < 40; i++) {
    const d = draw((s) => {
      s.mustDraw = { "feature:hair_color": 5 };
    }, 90200 + i);
    if (mutexCount(d, "hair_color") > 1) hairClash += 1;
  }
  eq("must never doubles a mutex slot", hairClash, 0);

  // 必抽的權限大於時代：clothing:era 全是非現代衣，現代場也要抽得出來。
  //
  // 洗澡淋浴游泳那種場景要排除：那時身上本來就不該有衣服，必抽一件和服進浴室
  // 不是「必抽的權限大於時代」該證明的事。原本寫死 40/40 只是剛好那批種子裡
  // 沒有浴場景；補上互斥格之後 RNG 位移，seed 90321 抽到 showering +
  // shower (place)，這條就紅了 —— 是這條的前提有例外沒寫，不是必抽變弱了。
  let eraGot = 0;
  let eraEligible = 0;
  for (let i = 0; i < 40; i++) {
    const d = draw((s) => {
      s.eras = ["modern"];
      s.mustDraw = { "clothing:era": 1 };
    }, 90300 + i);
    const h = tagsOf(d);
    if (["showering", "bathing", "swimming", "shared bathing", "diving"].some((t) => h.has(t))) continue;
    eraEligible += 1;
    if (groupCount(d, "clothing", "era") >= 1) eraGot += 1;
  }
  ok("必抽時代服飾的取樣夠多", eraEligible >= 35, `eraEligible=${eraEligible}/40`);
  eq("must beats era", eraGot, eraEligible);

  // 對照組：沒設必抽時，現代場不該冒出古裝。
  // 韓服、德式服裝、越南服裝是現代也穿的文化總稱，hanbok／dirndl／ao dai 會把它們帶出來。
  // 分組放在時代服，是為了跟和服、漢服放在一起，不是因為它們不該出現在現代。
  let eraLeak = 0;
  for (let i = 0; i < 40; i++) {
    const d = draw((s) => {
      s.eras = ["modern"];
    }, 90300 + i);
    let historical = false;
    for (const t of d.positive.split(", ")) {
      const it = lex.byTag.get(t.trim());
      if (!it || it.section !== "clothing" || it.group !== "era") continue;
      const eras = it.era || [];
      if (!eras.length || eras.includes("any") || eras.includes("modern")) continue;
      historical = true;
      break;
    }
    if (historical) eraLeak += 1;
  }
  eq("era still walls off without must", eraLeak, 0);

  // 尺度是硬牆：必抽不准繞過 heat 閘。只開誘惑時，只有 lexicon 自己標成誘惑也能用的
  // 性愛字（例如 spooning）可以出現，heat 只寫 sex 的一律不准。
  let heatLeak = 0;
  let honest = 0;
  for (let i = 0; i < 30; i++) {
    const d = draw((s) => {
      s.heats = ["tease"];
      s.mustDraw = { "pose:sex": 2 };
    }, 90400 + i);
    for (const t of d.positive.split(", ")) {
      const it = lex.byTag.get(t.trim());
      if (!it || it.group !== "sex") continue;
      const h = it.heat;
      if (Array.isArray(h) && h.length && !h.includes(d.heat)) heatLeak += 1;
    }
    const r = d.mustReport[0];
    if (r && r.got === groupCount(d, "pose", "sex")) honest += 1;
  }
  eq("must never bypasses the heat gate", heatLeak, 0);
  eq("must report matches what actually landed", honest, 30);

  // 女／男是硬牆：只開女時，必抽男體型拿不到任何 gate=male 的字。
  // （muscular／plump／skinny 在 lexicon 裡是 gate=any，男女通用，不算漏。）
  let maleLeak = 0;
  for (let i = 0; i < 30; i++) {
    const d = draw((s) => {
      s.girl = true;
      s.boy = false;
      s.mustDraw = { "feature:body_m": 3 };
    }, 90500 + i);
    for (const t of d.positive.split(", ")) {
      const it = lex.byTag.get(t.trim());
      if (it && it.gate === "male") maleLeak += 1;
    }
  }
  eq("must never bypasses the cast gate", maleLeak, 0);

  // 已封鎖的字不會被必抽撿回來。
  const banned = new Set(
    lex.bySection.pose.filter((it) => it.group === "tease").map((it) => it.tag)
  );
  const allBanned = drawOne(
    lex,
    Object.assign(settings(), { mustDraw: { "pose:tease": 2 } }),
    new Set(),
    banned,
    mulberry32(90600),
    90600
  );
  eq("must respects user bans", groupCount(allBanned, "pose", "tease"), 0);

  // 設定值清洗
  eq("mustDraw drops quality", sanitizeMustDraw({ "quality:style": 2 }), {});
  eq("mustDraw drops zero and negatives", sanitizeMustDraw({ "pose:tease": 0, "pose:sex": -3 }), {});
  eq("mustDraw drops malformed keys", sanitizeMustDraw({ tease: 2, ":x": 1, "pose:": 1 }), {});
  eq("mustDraw caps at MUST_MAX", sanitizeMustDraw({ "pose:tease": 999 }), { "pose:tease": MUST_MAX });
  eq("mustDraw floors floats", sanitizeMustDraw({ "pose:tease": 2.9 }), { "pose:tease": 2 });
  eq(
    "sanitizeSettings keeps mustDraw",
    sanitizeSettings({ mustDraw: { "pose:tease": 3 } }, data).mustDraw,
    { "pose:tease": 3 }
  );

  // 一次幾張解除上限（無限抽會用到）
  eq("n is no longer capped at 10", sanitizeSettings({ n: 50 }, data).n, 50);
  eq("n still floors at 1", sanitizeSettings({ n: 0 }, data).n, defaultSettings(data).n);
  eq("n rejects negatives", sanitizeSettings({ n: -4 }, data).n, 1);
}


// --- 運動釘選組合 ---------------------------------------------------------
{
  const byId = (id) => BUILTIN_PRESETS.find((p) => p.id === id);
  const tagsOfPreset = (id) => sportPresetTags(SPORT_BY_ID.get(id));
  const pinSet = (tags) => applyPresetTags(lex, tags, new Set());
  const drawWith = (pins, seed) => {
    const s = settings();
    return drawOne(lex, s, pins, new Set(), mulberry32(seed), seed);
  };

  // Invalid Danbooru venues must not survive in either the generated lexicon or preset source.
  ok("lexicon excludes the nonexistent ski slope tag", !lex.byTag.has("ski slope"));
  ok("sport presets exclude the nonexistent ski slope tag",
    !SPORT_PRESETS.some((p) => sportPresetTags(p).includes("ski slope")));
  {
    const skiingPins = applyPin(lex, new Set(), new Set(), "skiing").pinned;
    let leakedSkiSlope = 0;
    for (let i = 0; i < 300; i++) {
      if (tagsOf(drawWith(skiingPins, 760000 + i)).has("ski slope")) leakedSkiSlope += 1;
    }
    eq("pinned skiing never emits the nonexistent ski slope tag", leakedSkiSlope, 0);
  }

  // 1) 按鈕顯示運動名稱，不是場地名稱
  eq("hoops preset is named 籃球", byId("hoops")?.name, "籃球");
  eq("tennis preset is named 網球", byId("tennis")?.name, "網球");
  eq("soccer preset is named 足球", byId("soccer")?.name, "足球");
  eq("baseball preset is named 棒球", byId("baseball")?.name, "棒球");
  eq("track preset is named 田徑", byId("track")?.name, "田徑");
  ok("no preset is still named after a venue",
    !BUILTIN_PRESETS.some((p) => /球場$|田徑場$/.test(p.name)),
    BUILTIN_PRESETS.filter((p) => /球場$|田徑場$/.test(p.name)).map((p) => p.name).join(","));
  for (const id of ["volleyball", "badminton", "tabletennis"]) {
    eq(`${id} pins the older school gym venue`, SPORT_BY_ID.get(id)?.venue, ["school gym"]);
  }
  ok("sports court no longer forces outdoors",
    !(lex.byTag.get("sports court")?.implies || []).includes("outdoors"));
  ok("fitness gym is not an automatic sport activity venue",
    !Object.values(SPORT_ACT_PLACE).some((places) => places.includes("fitness gym")));

  {
    const defaults = defaultSettings(data);
    eq("sport activity pinning defaults off", defaults.pinSportActivity, false);
    eq("sanitize keeps sport activity pinning on",
      sanitizeSettings({ ...defaults, pinSportActivity: true }, data).pinSportActivity, true);
    eq("regular sport kit still excludes activity",
      sportPresetTags(SPORT_BY_ID.get("tennis")).includes("tennis"), false);
    eq("activity-pin option includes activity",
      sportPresetTags(SPORT_BY_ID.get("tennis"), true).includes("tennis"), true);
  }

  // Compatibility is declared explicitly; generic tags never create a sport identity.
  ok("playing sports is neutral", !SPORT_TAG_SCOPE.has("playing sports"));
  ok("sportswear is neutral", !SPORT_TAG_SCOPE.has("sportswear"));
  ok("sneakers is neutral", !SPORT_TAG_SCOPE.has("sneakers"));
  ok("playing sports fits a tennis court",
    sportTagAllowed("playing sports", new Set(["tennis court"])));
  ok("sports court fits tennis gear",
    sportTagAllowed("sports court", new Set(["tennis", "tennis racket"])));
  ok("cleats fit track and field",
    sportTagAllowed("cleats", new Set(["track and field", "running track"])));
  eq("playing sports plus tennis does not warn",
    sportPinWarnings(lex, new Set(["tennis court", "playing sports"])), []);
  ok("soccer ball still conflicts with basketball court",
    !sportTagAllowed("soccer ball", new Set(["basketball court"])));
  ok("badminton racket still conflicts with tennis court",
    !sportTagAllowed("badminton racket", new Set(["tennis court"])));

  for (const [tag, scope] of SPORT_TAG_SCOPE) {
    for (const other of SPORT_TAG_SCOPE.keys()) {
      const otherScope = SPORT_TAG_SCOPE.get(other);
      const overlaps = [...scope].some((id) => otherScope.has(id));
      if (overlaps) {
        ok(`scope overlap is symmetric: ${tag} + ${other}`,
          sportTagAllowed(tag, new Set([other])) && sportTagAllowed(other, new Set([tag])));
      }
    }
  }
  for (const neutral of ["playing sports", "sportswear", "sneakers", "goggles", "knee pads", "baseball cap"]) {
    for (const scoped of SPORT_TAG_SCOPE.keys()) {
      ok(`neutral ${neutral} never constrains ${scoped}`,
        sportTagAllowed(neutral, new Set([scoped])));
    }
  }
  for (const [venue, meta] of Object.entries(SPORT_VENUES)) {
    for (const id of meta.sports) {
      const p = SPORT_BY_ID.get(id);
      const exclusive = [...SPORT_TAG_SCOPE].find(([, ids]) => ids.size === 1 && ids.has(id))?.[0];
      if (!p || !p.activity || !exclusive) continue;
      ok(`${venue} is compatible with ${id}`,
        sportTagAllowed(venue, new Set([exclusive])));
      ok(`${p.activity} derives ${venue} as an allowed place`,
        (SPORT_ACT_PLACE[p.activity] || []).includes(venue));
    }
  }

  {
    const inventory = new Set(allSportTags());
    for (const p of SPORT_PRESETS) {
      if (p.activity) ok(`inventory includes activity ${p.activity}`, inventory.has(p.activity));
      for (const t of [...sportPresetTags(p), ...(p.optionalEquipment || [])]) {
        ok(`inventory includes preset tag ${t}`, inventory.has(t));
      }
    }
    for (const places of Object.values(SPORT_ACT_PLACE)) {
      for (const place of places) ok(`inventory includes compatible venue ${place}`, inventory.has(place));
    }
    eq("every sport inventory tag exists in lexicon",
      [...inventory].filter((t) => !lex.byTag.has(t)).sort(), []);
  }

  // 2) 每個運動：tag 都在 lexicon、整套進得去、再點一次整套出來、不動無關釘選
  for (const p of SPORT_BUTTONS) {
    const tags = sportPresetTags(p);
    const missing = tags.filter((t) => !lex.byTag.has(t));
    eq(`${p.name} tags all exist in lexicon`, missing, []);

    const preset = byId(p.id);
    ok(`${p.name} has a builtin preset button`, !!preset, `id=${p.id}`);
    if (!preset) continue;
    eq(`${p.name} preset tags come from SPORT_PRESETS`, preset.tags, tags);

    const base = new Set(["huge breasts", "blue eyes", "long hair"]);
    const on = togglePresetTags(lex, tags, base);
    const notPinned = tags.filter((t) => !on.has(t));
    eq(`${p.name} pins its whole kit`, notPinned, []);
    ok(`${p.name} keeps identity pins`,
      on.has("huge breasts") && on.has("blue eyes") && on.has("long hair"));
    eq(`${p.name} reads as fully on`, presetState(lex, tags, on), "on");

    const off = togglePresetTags(lex, tags, on);
    const stillThere = tags.filter((t) => off.has(t));
    eq(`${p.name} second click drops its whole kit`, stillThere, []);
    ok(`${p.name} second click keeps identity pins`,
      off.has("huge breasts") && off.has("blue eyes") && off.has("long hair"));
    eq(`${p.name} reads as off`, presetState(lex, tags, off), "off");
  }

  // 3) partial：單獨拿掉一項，不能被任何東西自動加回來
  {
    const tags = tagsOfPreset("hoops");
    let pins = togglePresetTags(lex, tags, new Set(["huge breasts"]));
    ok("basketball kit starts complete", presetState(lex, tags, pins) === "on");

    pins = applyClear(pins, new Set(), "basketball uniform").pinned;
    ok("removed uniform is gone", !pins.has("basketball uniform"));
    ok("removing uniform keeps the court", pins.has("basketball court"));
    ok("removing uniform keeps the ball", pins.has("basketball (object)"));
    eq("partial kit reads as mixed", presetState(lex, tags, pins), "mixed");

    // 重新整理 / 存讀檔都不可以把它加回來
    const resynced = knownTags(lex, [...pins]);
    ok("sanitising pins does not resurrect the uniform", !resynced.includes("basketball uniform"));
    const reloaded = applyPresetTags(lex, [...pins], new Set());
    ok("rebuilding pins does not resurrect the uniform", !reloaded.has("basketball uniform"));
    ok("rebuilding pins keeps the court", reloaded.has("basketball court"));

    // regression：場地不可以靠 implies 把球和制服拖回來
    const courtOnly = applyPresetTags(lex, ["basketball court"], new Set());
    ok("court alone does not imply the ball", !courtOnly.has("basketball (object)"));
    ok("court alone does not imply the uniform", !courtOnly.has("basketball uniform"));
    const tennisCourtOnly = applyPresetTags(lex, ["tennis court"], new Set());
    ok("tennis court alone does not imply the ball", !tennisCourtOnly.has("tennis ball"));
    const fieldOnly = applyPresetTags(lex, ["soccer field"], new Set());
    ok("soccer field alone does not imply the ball", !fieldOnly.has("soccer ball"));
    const stadiumOnly = applyPresetTags(lex, ["baseball stadium"], new Set());
    ok("baseball stadium alone does not imply the ball", !stadiumOnly.has("baseball (object)"));
    const alleyOnly = applyPresetTags(lex, ["bowling alley"], new Set());
    ok("bowling alley alone does not imply the ball", !alleyOnly.has("bowling ball"));

    // 再點一次才補回來
    const refilled = togglePresetTags(lex, tags, pins);
    ok("clicking the partial preset restores the uniform", refilled.has("basketball uniform"));
    eq("restored kit reads as on", presetState(lex, tags, refilled), "on");
    ok("restoring keeps the unrelated pin", refilled.has("huge breasts"));

    // 移除必進 POS 不等於 ban
    ok("removing from the kit does not ban the tag",
      !applyClear(pins, new Set(), "basketball uniform").userBanned.has("basketball uniform"));
  }

  // 4) 換運動：清掉上一個運動的場地／制服／球具，保留身份
  {
    const hoops = tagsOfPreset("hoops");
    const tennis = tagsOfPreset("tennis");
    const all = BUILTIN_PRESETS.map((p) => p.tags);
    let pins = togglePresetTags(lex, hoops, new Set(["huge breasts", "blue eyes"]), all);
    pins = togglePresetTags(lex, tennis, pins, all);
    ok("switching sports drops the old court", !pins.has("basketball court"));
    ok("switching sports drops the old ball", !pins.has("basketball (object)"));
    ok("switching sports drops the old uniform", !pins.has("basketball uniform"));
    const missing = tennis.filter((t) => !pins.has(t));
    eq("switching sports pins the new kit", missing, []);
    ok("switching sports keeps identity", pins.has("huge breasts") && pins.has("blue eyes"));

    // 共用裝備（球鞋）不該讓舊運動一直顯示半亮：識別性成員一個都不在就是 off。
    const hoopsBtn = BUILTIN_PRESETS.find((x) => x.id === "hoops");
    ok("shared sneakers alone does not keep basketball half-lit",
      pins.has("sneakers") && presetState(lex, hoops, pins, hoopsBtn.core) === "off",
      `state=${presetState(lex, hoops, pins, hoopsBtn.core)} sneakers=${pins.has("sneakers")}`);
    // 但真的少一件的時候還是要是 mixed
    let partial = togglePresetTags(lex, hoops, new Set(), all);
    partial = applyClear(partial, new Set(), "sneakers").pinned;
    eq("dropping one kit member still reads as mixed",
      presetState(lex, hoops, partial, hoopsBtn.core), "mixed");
    ok("core excludes shared gear", !hoopsBtn.core.includes("sneakers") && hoopsBtn.core.includes("basketball court"));
  }

  // 5) 抽牌互斥：釘一個運動，跑固定 seed，不可以混進別的運動
  {
    const foreignOf = (id) => {
      const mine = sportOwnedTags(SPORT_BY_ID.get(id));
      const out = new Set();
      for (const [tag, ids] of SPORT_IDENTITY) {
        if (mine.has(tag)) continue;
        if (ids.has(id)) continue;
        out.add(tag);
      }
      return out;
    };
    for (const p of SPORT_BUTTONS) {
      const tags = sportPresetTags(p);
      const pins = pinSet(tags);
      const foreign = foreignOf(p.id);
      const leaks = new Map();
      for (let i = 0; i < 120; i++) {
        const seed = 770000 + i;
        const d = drawWith(pins, seed);
        for (const t of d.positive.split(", ")) {
          const tag = t.trim();
          if (foreign.has(tag)) leaks.set(tag, (leaks.get(tag) || 0) + 1);
        }
      }
      eq(`${p.name} never mixes in another sport`, [...leaks.keys()].sort(), []);
    }
  }

  // 6) 點名案例
  {
    const has = (id, tag, n = 120) => {
      const pins = pinSet(tagsOfPreset(id));
      for (let i = 0; i < n; i++) {
        const d = drawWith(pins, 781000 + i);
        if (d.positive.split(", ").some((t) => t.trim() === tag)) return true;
      }
      return false;
    };
    ok("basketball never draws a soccer ball", !has("hoops", "soccer ball"));
    ok("basketball never draws a tennis ball", !has("hoops", "tennis ball"));
    ok("tennis never draws a badminton racket", !has("tennis", "badminton racket"));
    ok("tennis never draws a basketball", !has("tennis", "basketball (object)"));
    ok("table tennis never draws a tennis racket", !has("tabletennis", "tennis racket"));
    ok("swimming never draws sneakers", !has("swim", "sneakers"));
    ok("swimming never draws boots", !has("swim", "boots"));
    ok("swimming never draws high heels", !has("swim", "high heels"));
    ok("cycling never lands in a bedroom", !has("cycling", "bedroom"));
    ok("cycling never lands in a bathroom", !has("cycling", "bathroom"));
    ok("cycling never lands on a bed", !has("cycling", "on bed"));

    const baseballKit = sportPresetTags(SPORT_BY_ID.get("baseball"));
    ok("baseball does not force both bat and mitt",
      baseballKit.includes("baseball bat") && !baseballKit.includes("baseball mitt"));
    ok("baseball mitt is only an optional extra",
      (SPORT_BY_ID.get("baseball").optionalEquipment || []).includes("baseball mitt"));
    ok("volleyball does not use volleyball court",
      !sportPresetTags(SPORT_BY_ID.get("volleyball")).includes("volleyball court"));
    const bad = sportPresetTags(SPORT_BY_ID.get("badminton"));
    ok("badminton always has racket and shuttlecock",
      bad.includes("badminton racket") && bad.includes("shuttlecock"));
    const tt = sportPresetTags(SPORT_BY_ID.get("tabletennis"));
    ok("table tennis uses the paddle, not a tennis racket",
      tt.includes("table tennis paddle") && !tt.includes("tennis racket"));
    const arc = sportPresetTags(SPORT_BY_ID.get("archery"));
    ok("archery uses arrow (projectile), not the deprecated arrow",
      arc.includes("arrow (projectile)") && !arc.includes("arrow"));
    ok("archery does not use yumi", !arc.includes("yumi"));

    // 沒有任何 preset 用到禁用清單上的 tag
    const banned = new Set(["basketball", "baseball", "volleyball", "volleyball court",
      "baseball glove", "cycling", "golf uniform", "tennis shoes", "archery range",
      "ice rink", "arrow", "yumi"]);
    const used = new Set();
    for (const p of SPORT_PRESETS) {
      for (const t of [...sportPresetTags(p), ...(p.optionalEquipment || [])]) {
        if (banned.has(t)) used.add(t);
      }
    }
    eq("no preset uses a deprecated or empty tag", [...used], []);
  }

  // 6b) 活動 tag 不釘死：改由當張的尺度決定
  {
    const heatSettings = (heats) => {
      const s = settings();
      s.girl = true;
      s.boy = false;
      s.heats = heats;
      s.weights = weightsForHeats(heats, data.heatWeights);
      s.eras = ["modern"];
      s.sceneMode = "normal";
      s.lockScene = true;
      return s;
    };
    const isSex = (tag) => {
      const it = lex.byTag.get(tag);
      return !!it && (it.mutex === "sex_act" || it.group === "sex");
    };

    for (const p of SPORT_BUTTONS) {
      const kit = sportPresetTags(p);
      ok(`${p.name} does not pin its activity`, !kit.includes(p.activity), kit.join(","));
      ok(`${p.name} still pins venue/kit/clothing`,
        [...(p.venue || []), ...(p.equipment || []), ...(p.clothing || [])].every((t) => kit.includes(t)));
      if (p.activity === "playing sports") {
        ok(`${p.name} generic activity is neutral`, !SPORT_IDENTITY.has(p.activity));
      } else {
        ok(`${p.name} activity still carries its sport identity`,
          (SPORT_IDENTITY.get(p.activity) || new Set()).has(p.id));
      }
    }

    // 性愛尺度：抽得到性愛動作，整套裝備還在
    for (const p of SPORT_BUTTONS) {
      const kit = sportPresetTags(p);
      const pins = pinSet(kit);
      let withSex = 0;
      let keptKit = 0;
      for (let i = 0; i < 40; i++) {
        const seed = 915000 + i;
        const d = drawOne(lex, heatSettings(["sex"]), pins, new Set(), mulberry32(seed), seed);
        const got = new Set(d.positive.split(", ").map((t) => t.trim()));
        if ([...got].some(isSex)) withSex += 1;
        if (kit.every((t) => got.has(t))) keptKit += 1;
      }
      // 拳擊手套會刻意擋掉所有需要裸手／手指的性行為，所以可用池比其他運動小。
      const minimumSex = p.id === "boxing" ? 10 : 28;
      ok(`${p.name} draws sex acts at sex heat`, withSex >= minimumSex, `sex=${withSex}/40`);
      ok(`${p.name} keeps its kit at sex heat`, keptKit >= 28, `kit=${keptKit}/40`);
    }

    // 活動尺度：該運動自己的活動會被帶上來
    for (const p of SPORT_BUTTONS) {
      const pins = pinSet(sportPresetTags(p));
      let gotAct = 0;
      let foreignAct = 0;
      for (let i = 0; i < 60; i++) {
        const seed = 916000 + i;
        const d = drawOne(lex, heatSettings(["activity"]), pins, new Set(), mulberry32(seed), seed);
        const got = d.positive.split(", ").map((t) => t.trim());
        if (got.includes(p.activity)) gotAct += 1;
        for (const t of got) {
          const own = SPORT_IDENTITY.get(t);
          const it = lex.byTag.get(t);
          if (it && it.mutex === "activity" && own && !own.has(p.id)) foreignAct += 1;
        }
      }
      ok(`${p.name} picks up its own activity at activity heat`, gotAct >= 40, `act=${gotAct}/60`);
      eq(`${p.name} never picks another sport's activity`, foreignAct, 0);
    }

    // 運動器材本身限定場地：沒有場地的運動也不會掉進浴室臥室
    {
      const indoorsy = ["bathroom", "bedroom", "office", "classroom", "kitchen", "hotel room", "living room", "on bed"];
      for (const p of SPORT_BUTTONS) {
        const pins = pinSet(sportPresetTags(p));
        const bad = new Set();
        for (let i = 0; i < 80; i++) {
          const seed = 917000 + i;
          const d = drawOne(lex, heatSettings(["tease", "flash", "sex"]), pins, new Set(), mulberry32(seed), seed);
          for (const t of d.positive.split(", ")) {
            const tag = t.trim();
            if (indoorsy.includes(tag)) bad.add(tag);
          }
        }
        eq(`${p.name} never lands in an impossible room`, [...bad].sort(), []);
      }
    }

    // chooseHeat 的釘選否決本來把「活動」整個濾掉，因為它拿原始 heat 陣列硬比，
    // 沒有套 itemFitsHeats（那邊認為 heat 含 tease 的 tag 在活動尺度下可用）。
    eq("no lexicon tag declares the activity heat",
      lex.data.tags.filter((t) => Array.isArray(t.heat) && t.heat.includes("activity")).length, 0);
    {
      const pins = pinSet(sportPresetTags(SPORT_BY_ID.get("hoops")));
      const seen = (heats) => {
        const cfg = heatSettings(heats);
        const out = new Set();
        for (let i = 0; i < 160; i++) {
          const seed = 930000 + i;
          out.add(drawOne(lex, cfg, pins, new Set(), mulberry32(seed), seed).heat);
        }
        return out;
      };
      ok("activity heat lands when it is the only one", seen(["activity"]).has("activity"));
      ok("activity heat still lands next to sex", seen(["activity", "sex"]).has("activity"));
      ok("sex heat still lands next to activity", seen(["activity", "sex"]).has("sex"));
      const all = seen(["activity", "tease", "flash", "sex"]);
      for (const h of ["activity", "tease", "flash", "sex"]) {
        ok(`${h} heat lands with all four on`, all.has(h), [...all].join(","));
      }
    }

    // 使用者自己手動把活動釘進去又選性愛：保留他的釘選，但要講清楚
    {
      let pins = pinSet(sportPresetTags(SPORT_BY_ID.get("hoops")));
      pins = applyPin(lex, pins, new Set(), "playing sports").pinned;
      ok("a hand-pinned sport activity is kept", pins.has("playing sports"));
      let withSex = 0;
      for (let i = 0; i < 40; i++) {
        const seed = 915900 + i;
        const d = drawOne(lex, heatSettings(["sex"]), pins, new Set(), mulberry32(seed), seed);
        if (d.positive.split(", ").map((t) => t.trim()).some(isSex)) withSex += 1;
      }
      eq("a hand-pinned sport activity really does block sex acts", withSex, 0);
      ok("and that clash is reported, not silent",
        sportHeatWarnings(lex, pins, ["sex"]).length > 0);
      eq("no warning without the activity",
        sportHeatWarnings(lex, pinSet(sportPresetTags(SPORT_BY_ID.get("hoops"))), ["sex"]), []);
      eq("no warning at activity heat", sportHeatWarnings(lex, pins, ["activity"]), []);
    }
  }

  // 7) 使用者自己釘兩個互斥運動：保留，並且回報 warning，不靜默刪除
  {
    let pins = new Set();
    for (const t of ["basketball court", "tennis racket"]) {
      pins = applyPin(lex, pins, new Set(), t).pinned;
    }
    ok("explicit cross-sport pins are both kept",
      pins.has("basketball court") && pins.has("tennis racket"));
    const d = drawWith(pins, 790001);
    const got = new Set(d.positive.split(", ").map((t) => t.trim()));
    ok("explicit cross-sport pins survive the draw",
      got.has("basketball court") && got.has("tennis racket"));
    ok("cross-sport pins are reported", sportPinWarnings(lex, pins).length > 0);
  }

  // 7b) 使用者自己釘了「運動器材／活動 + 不相容場地」：保留，但正常／多元要提示。
  {
    const bad = new Set(["living room", "tennis racket"]);
    ok(
      "explicit gear/place conflict is reported in normal mode",
      sportPlacePinWarnings(lex, bad, { sceneMode: "normal" }).length > 0
    );
    ok(
      "explicit gear/place conflict is reported in diverse mode",
      sportPlacePinWarnings(lex, bad, { sceneMode: "diverse" }).length > 0
    );
    eq(
      "explicit gear/place conflict is allowed without warning in weird mode",
      sportPlacePinWarnings(lex, bad, { sceneMode: "weird" }),
      []
    );
    ok(
      "generic sport activity/place conflict is reported",
      sportPlacePinWarnings(
        lex,
        new Set(["living room", "playing sports"]),
        { sceneMode: "normal" }
      ).length > 0
    );
    for (const pins of [
      ["tennis court", "tennis racket"],
      ["school gym", "badminton racket"],
      ["running track", "bicycle"],
      ["school gym", "playing sports"],
      ["living room", "sneakers"],
    ]) {
      eq(
        `compatible/neutral explicit pins do not warn: ${pins.join(" + ")}`,
        sportPlacePinWarnings(lex, new Set(pins), { sceneMode: "normal" }),
        []
      );
    }
  }

  // 8) Named preset provenance: only remove what that click actually added.
  {
    const cyclingPreset = byId("cycling");
    const boxingPreset = byId("boxing");
    const swimPreset = byId("swim");

    // hat 換成 necklace：單車預設帶著 bicycle helmet，而 hat 補回 headwear 互斥格
    // 之後兩者是真的衝突 —— 戴著帽子再戴一頂安全帽本來就不該畫得出來。
    // 以前 hat 能存活只是因為它沒有格子，那是 UMBRELLA 把通用詞的 mutex 清掉的
    // 副作用，不是這條測試想保護的東西。
    //
    // 這條要守的是「只移除這一次點擊加進來的東西」，所以改用不衝突的手動釘選來守，
    // 同時把「衝突的手動釘選會被讓位」也寫成斷言 —— 比原本只斷言一半更強。
    let state = toggleNamedPreset(
      lex,
      cyclingPreset,
      new Set(["outdoors", "necklace", "sneakers"]),
      null
    );
    ok("manual outdoors survives applying cycling", state.pinned.has("outdoors"));
    ok("manual necklace survives applying cycling", state.pinned.has("necklace"));
    ok("manual sneakers is not claimed by cycling", !state.presetOwned.tags.includes("sneakers"));
    {
      const clash = toggleNamedPreset(lex, cyclingPreset, new Set(["hat"]), null);
      ok("conflicting manual hat gives way to the preset helmet",
        !clash.pinned.has("hat") && clash.pinned.has("bicycle helmet"));
    }
    const cyclingAdded = new Set(state.presetOwned.tags);
    const beforeOff = new Set(state.pinned);
    state = toggleNamedPreset(lex, cyclingPreset, state.pinned, state.presetOwned);
    eq("preset toggle off removes exactly what it added",
      [...beforeOff].filter((t) => !state.pinned.has(t)).sort(), [...cyclingAdded].sort());
    ok("manual outdoors remains after cycling toggle off", state.pinned.has("outdoors"));
    ok("manual necklace remains after cycling toggle off", state.pinned.has("necklace"));
    ok("manual sneakers remains after cycling toggle off", state.pinned.has("sneakers"));

    state = toggleNamedPreset(lex, boxingPreset, new Set(["boxing gloves", "blue eyes"]), null);
    ok("manual boxing gloves is not claimed by boxing", !state.presetOwned.tags.includes("boxing gloves"));
    state = toggleNamedPreset(lex, swimPreset, state.pinned, state.presetOwned);
    ok("switching boxing to swim keeps a manually pinned glove", state.pinned.has("boxing gloves"));
    ok("switching A to B removes the A-owned ring", !state.pinned.has("boxing ring"));
    ok("switching A to B keeps identity", state.pinned.has("blue eyes"));

    eq("legacy ownership migrates conservatively to null", sanitizePresetOwned(undefined, lex), null);
    eq("malformed ownership migrates conservatively to null",
      sanitizePresetOwned({ id: "cycling", tags: "bicycle" }, lex), null);
    eq("ownership round-trips known tags",
      sanitizePresetOwned({ id: "cycling", tags: ["bicycle", "unknown tag"] }, lex),
      { id: "cycling", tags: ["bicycle"] });
  }

  // 9) Worn boxing gloves occupy fingers; scene props do not.
  {
    const freeHandActs = new Set([
      "handjob", "fingering", "masturbation", "female masturbation",
      "male masturbation", "masturbation through clothes",
    ]);
    const sexSettings = settings();
    sexSettings.girl = true;
    sexSettings.boy = false;
    sexSettings.heats = ["sex"];
    sexSettings.weights = weightsForHeats(["sex"], data.heatWeights);
    sexSettings.eras = ["modern"];
    sexSettings.sceneMode = "normal";
    sexSettings.lockScene = true;

    const boxingPins = pinSet(tagsOfPreset("boxing"));
    let boxingConflicts = 0;
    let boxingOtherSex = 0;
    for (let i = 0; i < 1000; i++) {
      const seed = 970000 + i;
      const got = tagsOf(drawOne(lex, sexSettings, boxingPins, new Set(), mulberry32(seed), seed));
      if ([...got].some((t) => freeHandActs.has(t))) boxingConflicts += 1;
      if ([...got].some((t) => {
        const it = lex.byTag.get(t);
        return it && (it.group === "sex" || it.mutex === "sex_act") && !freeHandActs.has(t);
      })) boxingOtherSex += 1;
    }
    eq("boxing gloves never auto-pair with free-finger sex acts", boxingConflicts, 0);
    ok("boxing gloves still allow other sex acts", boxingOtherSex > 0, `other=${boxingOtherSex}`);

    const manual = new Set(["boxing gloves", "fingering"]);
    const manualDraw = tagsOf(drawOne(lex, sexSettings, manual, new Set(), mulberry32(971001), 971001));
    ok("explicit boxing gloves and fingering pins are both kept",
      manualDraw.has("boxing gloves") && manualDraw.has("fingering"));
    ok("explicit occupied-hand conflict is reported", handUsageWarnings(manual).length > 0);

    for (const id of ["tennis", "archery"]) {
      const pins = pinSet(tagsOfPreset(id));
      let sawFingering = 0;
      for (let i = 0; i < 500; i++) {
        const seed = 972000 + i;
        const got = tagsOf(drawOne(lex, sexSettings, pins, new Set(), mulberry32(seed), seed));
        if (got.has("fingering")) sawFingering += 1;
      }
      ok(`${id} scene props do not block fingering`, sawFingering > 0, `seen=${sawFingering}`);
    }
  }
}

// --- 暮光是日夜過渡，不屬於任何一側（Codex 裁決 2026-09-13）------------------
// sunset / dusk 以前被當成白天側硬擋，而且只補了 dusk 的反向規則，於是
//   - market stall + sunset 漏出去（場地比時間早抽，反向規則不存在）
//   - sunset + starry sky、dusk + moonlight 這類自然的光線過渡反而被擋掉
// 正確模型是三類：嚴格白天(DAY_MARK) / 嚴格夜側(NIGHT_MARK) / 過渡(sunset,dusk)，
// 過渡不參與硬互斥。sunset/dusk/night 本來就同屬 day_night 互斥，不必額外擋。
{
  // 環境詞要抽得動才驗得了 sky / light：正常模式不跑 fill("env")。
  const envSettings = (mode) => {
    const s = defaultSettings(data);
    s.girl = true;
    s.heats = ["activity", "tease", "flash", "sex"];
    s.sceneMode = mode;
    s.counts.env = 10;
    return s;
  };
  const seenWith = (pin, want, mode = "weird", n = 300) => {
    const s = envSettings(mode);
    for (let i = 1; i <= n; i++) {
      const got = tagsOf(drawOne(lex, s, new Set([pin]), new Set(), mulberry32(i), i));
      if (got.has(want)) return i; // 回傳第一個命中的 seed，方便重播
    }
    return 0;
  };

  // 先證明這些字在這個設定下本來就抽得到，否則下面的斷言會空過。
  ok("twilight control: starry sky 抽得到", seenWith("night", "starry sky") > 0);
  ok("twilight control: market stall 抽得到", seenWith("night", "market stall") > 0);
  ok("twilight control: dusk 抽得到", seenWith("outdoors", "dusk") > 0);

  // 過渡時段和夜側可以共存，而且兩個方向都要通（換順序結果相同）。
  // 2026-10-09 第二次：第三、四輪 38 個字進池，釘 dusk 要到 seed 307 才抽到 market stall。
  // 正向搜尋放到 600。嚴格白天／夜側的互斥仍只看前 300 張。
  for (const [pin, want] of [
    ["market stall", "sunset"],
    ["market stall", "dusk"],
    ["starry sky", "sunset"],
    ["starry sky", "dusk"],
    ["moonlight", "sunset"],
    ["moonlight", "dusk"],
    ["sunset", "starry sky"],
    ["dusk", "market stall"],
  ]) {
    const seed = seenWith(pin, want, "weird", 600);
    ok(`twilight: 釘「${pin}」抽得到「${want}」`, seed > 0,
      `weird / counts.env=10 / 全熱度，seed 1..600 一次都沒出現`);
  }

  // 嚴格白天 ↔ 嚴格夜側仍然對稱互斥，暮光的改動不能鬆到這裡。
  for (const [pin, never] of [
    ["market stall", "day"],
    ["market stall", "sunlight"],
    ["market stall", "blue sky"],
    ["night", "sunlight"],
    ["night", "blue sky"],
    ["day", "starry sky"],
    ["day", "moonlight"],
    ["blue sky", "market stall"],
  ]) {
    const seed = seenWith(pin, never);
    ok(`day/night: 釘「${pin}」不該抽到「${never}」`, seed === 0,
      seed ? `seed=${seed} 抽出來了` : "");
  }
}

// --- 環境段：counts.env 要真的有作用，且 era:["any"] 不能結構性餓死 -----------
// （Codex 裁決 2026-09-13 第三輪）
//
// 兩個 bug 疊在一起：
//   1. fill("env") 以前只在非正常模式跑，而正常模式是預設 —— 左欄「環境」那個
//      數字在預設設定下 2/4/10 給出一模一樣的結果，等於死的 UI。
//   2. fill() 給 env 的 prefer 是 (eraSpecific && mutex)，而 takeFromPool 的桶
//      是「抽乾桶 0 才輪到桶 1」。lighting 只有一格，桶 0 一定先把它拿走，於是
//      light 群裡 10 個 era:["any"] 的字機率恆為 0 —— 不是低，是零。
//
// 驗收刻意不鎖死比例：只驗「非零、明顯有差、零 hard conflict」。
{
  const envSettings = (over = {}) => {
    const s = defaultSettings(data);
    s.girl = true;
    s.heats = ["activity", "tease", "flash", "sex"];
    return Object.assign(s, over, { counts: Object.assign({ ...s.counts }, over.counts) });
  };
  const runEnv = (over, n = 300, seed0 = 77000) => {
    const s = envSettings(over);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(drawOne(lex, s, new Set(), new Set(), mulberry32(seed0 + i), seed0 + i));
    }
    return out;
  };
  const envTagsOf = (drawn) =>
    [...tagsOf(drawn)].filter((t) => lex.byTag.get(t)?.section === "env");
  const avgEnv = (runs) => runs.reduce((n, d) => n + envTagsOf(d).length, 0) / runs.length;

  const lightsOf = (runs, pick) => {
    let n = 0;
    for (const d of runs) {
      for (const t of tagsOf(d)) {
        const it = lex.byTag.get(t);
        if (it && it.group === "light" && pick(it)) n += 1;
      }
    }
    return n;
  };
  const eraAny = (it) => (it.era || []).includes("any");

  // 1) 正常模式必須尊重「環境」目標數。不鎖死平均值，只要求明顯有差。
  const lowN = runEnv({ sceneMode: "normal", counts: { env: 4 } });
  const highN = runEnv({ sceneMode: "normal", counts: { env: 10 } });
  const lo = avgEnv(lowN);
  const hi = avgEnv(highN);
  ok(
    "env: 正常模式 counts.env=10 明顯多於 =4",
    hi > lo + 1.5,
    `env=4 平均 ${lo.toFixed(2)}，env=10 平均 ${hi.toFixed(2)}`
  );

  // 2) 多補出來的字不能是靠放寬 gate 換來的：hard invariant 必須全綠。
  let clash = 0;
  let firstClash = "";
  for (const d of highN) {
    const list = [...tagsOf(d)];
    const bad = contradictions(lex, list);
    if (bad.length) {
      clash += 1;
      if (!firstClash) firstClash = `seed ${d.seed}：${bad.map((x) => x.join(":")).join(" / ")}`;
    }
  }
  ok("env: 正常模式高 env 不製造矛盾", clash === 0, firstClash);

  // 室內外、日夜這兩條最容易被「多塞幾個」破壞，單獨再驗一次。
  let envBad = 0;
  let envBadWhy = "";
  const DAY = new Set(["day", "sunrise", "sunlight", "sunbathing", "blue sky", "orange sky"]);
  const NIGHT = new Set(["night", "starry sky", "moonlight", "market stall"]);
  for (const d of highN) {
    const names = tagsOf(d);
    const why = [];
    if (names.has("indoors") && names.has("outdoors")) why.push("indoors+outdoors");
    const dd = [...names].filter((t) => DAY.has(t));
    const nn = [...names].filter((t) => NIGHT.has(t));
    if (dd.length && nn.length) why.push(`${dd.join("+")} 撞 ${nn.join("+")}`);
    if (why.length) {
      envBad += 1;
      if (!envBadWhy) envBadWhy = `seed ${d.seed}：${why.join("、")}`;
    }
  }
  ok("env: 高 env 不打破室內外／日夜", envBad === 0, envBadWhy);

  // 3) counts.env=0 ＝場景整段不補（2026-09-25 專案主決定，見 討論區.md）：
  // 場地／室內外／時間這些骨架也不補。還能出現的只有別段的字 implies 帶進來的。
  const zeroS = envSettings({ sceneMode: "normal", counts: { env: 0 } });
  const zeroN = [];
  for (let i = 0; i < 300; i++) zeroN.push(drawOne(lex, zeroS, new Set(), new Set(), mulberry32(77000 + i), 77000 + i, { trace: true }));
  const engineEnv = zeroN.filter((d) =>
    (d.trace?.kept || []).some((k) => lex.byTag.get(k.tag)?.section === "env" && k.source !== "implies" && k.source !== "bind")
  );
  ok("env: counts.env=0 引擎不再自己補場景（連骨架也不補）", engineEnv.length === 0, engineEnv[0] ? `seed ${engineEnv[0].seed}：${envTagsOf(engineEnv[0]).join("、")}` : "");

  // 4) 同一個 era 裡，era 專屬和 era:["any"] 的燈光都要抽得到（都非零）。
  const specHits = lightsOf(highN, (it) => !eraAny(it));
  const anyHits = lightsOf(highN, eraAny);
  ok("light: era 專屬燈光抽得到", specHits > 0, `${specHits} 次`);
  ok(
    "light: era:[any] 燈光抽得到（不再被硬排序餓死）",
    anyHits > 0,
    `era 專屬 ${specHits} 次，era=any ${anyHits} 次`
  );

  // 4b) 場地那一格是同一個病。燈光是硬排序把 era:["any"] 餓死，場地也是 ——
  // 而且更嚴重，因為場地只有一格，「抽乾時代專屬才輪到中性」幾乎不會輪到。
  // 實測修之前：現代 16 個中性場地合計只有 5%，beach 在 18000 張裡是 0 次。
  const placesOf = (runs, pick) => {
    let n = 0;
    for (const d of runs) {
      for (const t of tagsOf(d)) {
        const it = lex.byTag.get(t);
        if (it && it.section === "env" && it.mutex === "place" && pick(it)) n += 1;
      }
    }
    return n;
  };
  for (const era of ["modern", "edo", "medieval"]) {
    const runs = runEnv({ sceneMode: "diverse", eras: [era], counts: { env: 8 } }, 300, 91000);
    const spec = placesOf(runs, (it) => !eraAny(it));
    const anyP = placesOf(runs, eraAny);
    ok(
      `place: ${era} 的 era:[any] 場地抽得到（不再被硬排序餓死）`,
      anyP > 0,
      `era 專屬 ${spec} 次，era=any ${anyP} 次`
    );
    ok(`place: ${era} 的 era 專屬場地仍然是主角`, spec > anyP, `${spec} vs ${anyP}`);
  }

  // 5) 古代不能冒出只屬於現代的燈光。
  const MODERN_ONLY = ["spotlight", "neon lights", "ceiling light", "city lights"];
  for (const era of ["ancient_china", "medieval", "edo"]) {
    const runs = runEnv({ sceneMode: "normal", eras: [era], counts: { env: 10 } }, 200, 78000);
    const leak = [];
    for (const d of runs) {
      for (const t of tagsOf(d)) if (MODERN_ONLY.includes(t)) leak.push(`${t}@${d.seed}`);
    }
    ok(`light: ${era} 不會漏出現代燈光`, leak.length === 0, leak.slice(0, 3).join(", "));
  }
}

// --- 運動器材 × 場地：兩個方向都要擋（Codex 2026-09-13 第四輪四類護欄）-------
// sportPlaceOk() 只在「候選是場地」時擋，所以「場地先定、器材後抽」整個繞過去 ——
// 正常模式打開 env filler 之後，客廳就抽得到網球拍（網球服先進場給了運動身分，
// 球拍再跟著合法進來）。sportGearPlaceOk() 補上反向。
// 兩支都只看 SPORT_GEAR_IDENTITY（活動＋場地＋器材，**不含服裝**），所以
// 穿網球服待在客廳可以，把球拍放進客廳不行。
{
  const sportSettings = (mode) => {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = true;
    s.heats = ["activity", "tease", "flash", "sex"];
    s.sceneMode = mode;
    s.lockScene = true;
    s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
    return s;
  };
  const hits = (mode, pins, want, n = 200, seed0 = 600000) => {
    const s = sportSettings(mode);
    const pinned = new Set(pins);
    let n1 = 0;
    for (let i = 1; i <= n; i++) {
      const got = tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(seed0 + i), seed0 + i));
      if (got.has(want)) n1 += 1;
    }
    return n1;
  };

  // 護欄 1：場地先進、器材後抽 —— 正常與多元都不該漏。
  for (const mode of ["normal", "diverse"]) {
    for (const [place, gear] of [
      ["living room", "tennis racket"],
      ["kitchen", "golf club"],
      ["classroom", "basketball (object)"],
      ["bathroom", "bicycle"],
    ]) {
      const n = hits(mode, [place], gear);
      ok(`gear/place ${mode}：釘「${place}」不該抽到「${gear}」`, n === 0, `${n}/200`);
    }
  }

  // 護欄 2：器材先進、場地後抽 —— 反方向也要 0（sportPlaceOk 那半邊）。
  for (const mode of ["normal", "diverse"]) {
    for (const [gear, place] of [
      ["tennis racket", "living room"],
      ["golf club", "kitchen"],
      ["bicycle", "bathroom"],
    ]) {
      const n = hits(mode, [gear], place);
      ok(`gear/place ${mode}：釘「${gear}」不該抽到「${place}」`, n === 0, `${n}/200`);
    }
  }

  // 護欄 3a：奇葩模式本來就放生，不該被這條規則綁住。
  ok(
    "gear/place 奇葩：釘「living room」仍抽得到「tennis racket」",
    hits("weird", ["living room"], "tennis racket") > 0
  );

  // 護欄 3b：使用者明講要的組合，任何模式都不准靜默刪掉。
  for (const mode of ["normal", "diverse", "weird"]) {
    const s = sportSettings(mode);
    const pinned = new Set(["living room", "tennis racket"]);
    let kept = 0;
    for (let i = 1; i <= 60; i++) {
      const got = tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(610000 + i), 610000 + i));
      if (got.has("living room") && got.has("tennis racket")) kept += 1;
    }
    ok(
      `gear/place ${mode}：明確釘的「living room + tennis racket」不被刪`,
      kept === 60,
      `只留住 ${kept}/60`
    );
  }

  // 護欄 4：共享相容不能被誤殺。
  // school gym 同時是好幾種室內運動的場地；sports court 也是共享的；
  // running track 收 track 和 cycling；而純運動服／球鞋是中性的，不該限制場地。
  for (const [place, gear] of [
    ["school gym", "volleyball (object)"],
    ["school gym", "badminton racket"],
    ["sports court", "tennis racket"],
    ["running track", "bicycle"],
    ["tennis court", "tennis racket"],
  ]) {
    // 排球沒有自己的活動字，活動格常常先抽成網球、羽球、桌球，球就進不了場。
    // 剩下的窗口裡它跟兩百多個環境字搶名額。400 張只中 2 次，200 張會空過。
    // 斷言仍是「至少一次」：學校體育館沒有把排球誤殺。
    const nDraw = gear === "volleyball (object)" ? 1000 : 200;
    const n = hits("normal", [place], gear, nDraw);
    ok(`gear/place 共享相容：釘「${place}」抽得到「${gear}」`, n > 0, `${n}/${nDraw}`);
  }
  ok(
    "gear/place：中性運動服不限制場地（釘 sneakers 仍抽得到 living room）",
    hits("normal", ["sneakers"], "living room") > 0
  );
  // 這一條的 n 從預設 200 提到 1000。**斷言本身沒有改**（仍然是 > 0）——
  // 改的只有取樣數，因為 200 張對這個組合來說在刀鋒上：實測命中率約 3.5%，
  // 而配件互斥格補完之後牌序位移，原本落在窗內的 3 次剛好被推出去。
  // 證明不變式沒壞：修前／修後 N=1000 是 35／34，N=4000 是 142／149。
  ok(
    "gear/place：中性運動服不限制場地（釘 sportswear 仍抽得到 kitchen）",
    hits("normal", ["sportswear"], "kitchen", 1000) > 0
  );
}

// --- 室內外：兩個方向都要擋 --------------------------------------------------
// 靜態掃 allow() 的單向 guard 時抓到的（Codex 第四輪第 5 點）。
//
// 舊規則只寫了「室內已定 → 擋戶外景物」和「戶外已定 → 擋室內道具」，
// 沒寫反向。而 in_out 是 fillSlot("env","in_out") 抽的，排在 fill("env") 之前，
// 所以一般抽取碰不到 —— 但只要使用者把 tree 這種戶外景物釘起來，順序就翻過來了：
//
//   釘 tree，seed 700001 → 最終 POS：tree, futon, indoors, gaming chair, ...
//   釘 against window，seed 700001 → 最終 POS：against window, open-air bath, outdoors, campfire, ...
//
// 兩者都違反 allow() 自己已經宣告的契約（`used.has("indoors") && OUTDOOR_LEFTOVER`
// 與 `against window && outdoors && !indoors`），而且 contradictions() 抓不到。
{
  const ioSettings = () => {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = true;
    s.heats = ["activity", "tease", "flash", "sex"];
    s.sceneMode = "normal";
    s.lockScene = true;
    s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
    return s;
  };
  const bothIn = (pin, other, n = 250, seed0 = 700000) => {
    const s = ioSettings();
    const pinned = new Set([pin]);
    for (let i = 1; i <= n; i++) {
      const got = tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(seed0 + i), seed0 + i));
      if (got.has(pin) && got.has(other)) return seed0 + i; // 第一個重播 seed
    }
    return 0;
  };

  // 戶外景物先釘 → 不該再抽到 indoors。
  for (const t of ["tree", "bush", "campfire", "starry sky", "cherry blossoms"]) {
    const seed = bothIn(t, "indoors");
    ok(`in/out：釘「${t}」不該再抽到 indoors`, seed === 0, seed ? `seed=${seed}` : "");
  }
  // 室內道具先釘 → 不該再抽到 outdoors。
  for (const t of ["tatami", "curtains", "gaming chair", "office chair", "shoji"]) {
    const seed = bothIn(t, "outdoors");
    ok(`in/out：釘「${t}」不該再抽到 outdoors`, seed === 0, seed ? `seed=${seed}` : "");
  }
  // 靠窗／靠玻璃先釘 → 不該再抽到 outdoors（除非同時有 indoors）。
  for (const t of ["against window", "against glass"]) {
    const s = ioSettings();
    const pinned = new Set([t]);
    let bad = 0;
    let firstSeed = 0;
    for (let i = 1; i <= 250; i++) {
      const got = tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(700000 + i), 700000 + i));
      if (got.has(t) && got.has("outdoors") && !got.has("indoors")) {
        bad += 1;
        if (!firstSeed) firstSeed = 700000 + i;
      }
    }
    ok(`in/out：釘「${t}」不該落在純戶外`, bad === 0, firstSeed ? `${bad}/250，seed=${firstSeed}` : "");
  }

  // 護欄：修了反向之後，正向不能壞掉，室內外本身也還要抽得出來。
  for (const [pin, want] of [["tree", "outdoors"], ["tatami", "indoors"], ["against window", "indoors"]]) {
    ok(`in/out 護欄：釘「${pin}」仍抽得到「${want}」`, bothIn(pin, want) > 0);
  }
}

// --- 「每段目標數」只能列出真的吃這個數字的段 -------------------------------
// counts.subject 從 0 到 10 一律給出同樣的結果：主體段整段就是卡司（人數、solo、
// adult），由 chooseCast() 依 castWeights 決定，drawOne 從頭到尾沒有 fill("subject")。
// 左欄卻為它畫了一個輸入框 —— 使用者調了半天什麼都不會變。
//
// 這條測試守的是雙向的：QUOTA_SECTIONS 列出的每一段都必須真的有反應，
// 沒列出的每一段都必須真的沒反應。UI 由 QUOTA_SECTIONS 生成，所以兩邊不會再漂開。
{
  const countSettings = (want) => {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = true;
    s.heats = ["activity", "tease", "flash", "sex"];
    for (const k of Object.keys(s.counts)) s.counts[k] = want;
    return s;
  };
  const perSection = (want, n = 150, seed0 = 820000) => {
    const s = countSettings(want);
    const got = {};
    for (let i = 0; i < n; i++) {
      const drawn = drawOne(lex, s, new Set(), new Set(), mulberry32(seed0 + i), seed0 + i);
      for (const t of tagsOf(drawn)) {
        const sec = lex.byTag.get(t)?.section;
        if (sec) got[sec] = (got[sec] || 0) + 1;
      }
    }
    for (const k of Object.keys(got)) got[k] /= n;
    return got;
  };

  const low = perSection(2);
  const high = perSection(10);
  const allSections = Object.keys(defaultSettings(data).counts);

  for (const sec of allSections) {
    const responds = (high[sec] || 0) > (low[sec] || 0) + 1;
    const listed = QUOTA_SECTIONS.includes(sec);
    ok(
      `counts：「${sec}」${listed ? "列在 QUOTA_SECTIONS，就必須有反應" : "沒列進去，就必須真的沒反應"}`,
      responds === listed,
      `counts=2 得 ${(low[sec] || 0).toFixed(2)}，counts=10 得 ${(high[sec] || 0).toFixed(2)}`
    );
  }

  ok(
    "counts：主體段不列入（卡司由 chooseCast 決定，不吃 quota）",
    !QUOTA_SECTIONS.includes("subject")
  );
  ok("counts：QUOTA_SECTIONS 不是空的", QUOTA_SECTIONS.length > 0);
  ok(
    "counts：QUOTA_SECTIONS 每一項都是真的 section",
    QUOTA_SECTIONS.every((s) => allSections.includes(s)),
    QUOTA_SECTIONS.join(", ")
  );
}

// --- 一個字不該跟它自己 implies 的字打架 -----------------------------------
// commit() 驗證相依字時會先把父字暫時放進 used（護士在場，聽診器才合法）。
// 但父子同屬一個排他集合時這招會反咬：karaoke 和它 implies 的 singing 都在
// HANDS_BUSY_ACT 裡，於是驗 singing 的時候撞到剛放進去的 karaoke，整個 commit 被拒。
//
// 實測這是迴歸：86a3a1b 的同一批 600 張裡 karaoke 6 次、playing video games 2 次、
// picnic 1 次；把相依字改走 allow() 之後三個都變成 0。
{
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  s.drawJob = true;
  s.heats = ["activity", "tease", "flash", "sex"];
  s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const seen = new Map();
  for (let i = 1; i <= 2000; i++) {
    for (const t of tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(950000 + i), 950000 + i))) {
      seen.set(t, (seen.get(t) || 0) + 1);
    }
  }
  // 斷言放在三者的**總和**上，不是各自 >0。活動槽只有一格要跟 51 個活動搶，
  // 這三個單獨都只有 1–5/600，RNG 稍微一位移就可能變 0 而假紅。
  // 迴歸發生時三個會同時歸零（父子衝突擋的是 commit 整體），所以總和的鑑別力
  // 一樣強，餘裕卻大得多。
  const kids = ["karaoke", "playing video games", "picnic"];
  const total = kids.reduce((n, t) => n + (seen.get(t) || 0), 0);
  ok(
    "父子相依：跟自己 implies 的字同屬忙手活動的三個字抽得到",
    total >= 5,
    `${kids.map((t) => `${t}=${seen.get(t) || 0}`).join("、")}，總和 ${total}`
  );
  // 護欄：父子放行不能變成「兩個無關的忙手活動也放行」。
  const BUSY = ["playing guitar", "cooking", "driving", "fishing", "smoking", "shopping", "cleaning"];
  let clash = 0;
  let why = "";
  for (let i = 1; i <= 600; i++) {
    const got = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(950000 + i), 950000 + i));
    const hit = BUSY.filter((t) => got.has(t));
    if (hit.length > 1) {
      clash += 1;
      if (!why) why = `seed ${950000 + i}：${hit.join(" + ")}`;
    }
  }
  ok("父子相依：無關的忙手活動仍然互斥", clash === 0, why);
}

// --- 被別名取代的舊名，正規名要抽得到 ---------------------------------------
// 這一段本來測的是「同義詞不要同時吐兩個字」：panting/heavy breathing、
// kissing/kiss 在 Danbooru 是別名，而詞庫兩半都留著（刻意的加權），所以要擋住
// 兩個一起出現。
//
// 72c54e7 把那四個舊名整批從詞庫拿掉之後，**這段的前提就沒了** —— 詞庫裡
// 已經沒有任何一組別名配對（hairclip 也不在，只留刻意保留的 hairpin）。
// 而那次順手把 PAIRS 的每一組刪成只剩正規名那一半：
//
//     ["panting", "heavy breathing"]  ->  ["heavy breathing"]
//     ["kissing", "kiss"]             ->  ["kiss"]
//
// 於是 `const [a, b] = ["kiss"]` 讓 b 變成 undefined，`got.has(undefined)`
// 永遠是 false —— 「不同時出現」那兩條**從那次之後就無法失敗**。
// 跟 server.py 那條寫在 sys.exit(1) 後面的檢查同一種病：看起來在守，其實沒有。
//
// 「不同時出現」的保證現在由 test_lexicon_integrity.mjs 在**源頭**守著，而且更強：
// 那裡直接斷言 kissing／panting／breast grab／chinese architecture 不准出現在
// 詞庫裡（附 Danbooru 的 alias 建立日期）。兩個字都不在，自然不會同時出現。
//
// 這裡留下的是那一段唯一還有對象的一半：**正規名要真的抽得到**。舊名被拿掉之後
// 如果正規名因為別的規則抽不到，這個概念就整個消失了，而源頭那條檢查看不到這件事。
{
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  s.heats = ["activity", "tease", "flash", "sex"];
  s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const CANON = ["heavy breathing", "kiss", "grabbing another's breast", "one eye closed"];
  const each = new Map();
  for (let i = 1; i <= 3000; i++) {
    const got = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
    for (const t of CANON) if (got.has(t)) each.set(t, (each.get(t) || 0) + 1);
  }
  for (const t of CANON) {
    ok(`取代舊名的正規名抽得到：「${t}」`, (each.get(t) || 0) > 0, `3000 張裡 ${each.get(t) || 0} 次`);
  }
}

// --- 鏡頭要在臉部特徵之前決定 -----------------------------------------------
// head out of frame 和 lower body 禁止眼睛特徵，但 fillSlot("feature","eye_color")
// 排在 fillSlot("pose","camera") 前面 —— 眼睛顏色永遠先落定，這兩個鏡頭於是每次
// 都被自己的規則擋掉。普通自動抽取 0/600，其他鏡頭（pov、from behind、close-up）
// 都正常。
//
// 既有的 HOF 測試都是先「釘選」再驗它擋掉臉部標籤，證明的是互斥；順序性餓死要黑箱才抓得到。
{
  const camSettings = () => {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = false;
    s.heats = ["activity", "tease", "flash", "sex"];
    s.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
    return s;
  };
  const autoHits = (want, n = 600, seed0 = 960000) => {
    const s = camSettings();
    let hit = 0;
    for (let i = 1; i <= n; i++) {
      if (tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(seed0 + i), seed0 + i)).has(want)) hit += 1;
    }
    return hit;
  };

  // head out of frame / lower body 是釘選專用，這裡刻意不為它們寫斷言：
  // 寫「抽得到」會紅（現況如此），寫「抽不到」是把一個未必想保留的現況釘成契約。
  // 決定與量測寫在 engine.js 的 camera 槽註解與 docs/pose-tag-deep-review.md。
  // 一般鏡頭的可達性仍然要顧，那才是這批測試守的東西。
  for (const cam of ["pov", "from behind", "close-up"]) {
    ok(`鏡頭可達 對照組：「${cam}」抽得到`, autoHits(cam) > 0);
  }

  // 護欄一：使用者明確釘了臉部標籤時，自動的無臉鏡頭仍要被擋（不准刪 pin）。
  for (const pin of ["closed eyes", "looking at viewer"]) {
    const s = camSettings();
    const pinned = new Set([pin]);
    let bad = 0;
    let lost = 0;
    for (let i = 1; i <= 300; i++) {
      const got = tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(970000 + i), 970000 + i));
      if (got.has("head out of frame") || got.has("lower body")) bad += 1;
      if (!got.has(pin)) lost += 1;
    }
    ok(`鏡頭護欄：釘了「${pin}」就不該自動抽到無臉鏡頭`, bad === 0, `${bad}/300`);
    ok(`鏡頭護欄：釘的「${pin}」不會被刪掉`, lost === 0, `掉了 ${lost}/300`);
  }

  // 護欄二：無臉鏡頭進來時，最終 POS 不該還有眼睛／視線這些看不到的東西。
  const s = camSettings();
  let leak = 0;
  let why = "";
  for (let i = 1; i <= 600; i++) {
    const got = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(960000 + i), 960000 + i));
    if (!got.has("head out of frame") && !got.has("lower body")) continue;
    const face = [...got].filter((t) => {
      const it = lex.byTag.get(t);
      return it && (it.mutex === "eye_color" || it.mutex === "gaze" || it.group === "eyes" || /^looking /.test(t));
    });
    if (face.length) {
      leak += 1;
      if (!why) why = `seed ${960000 + i}：${face.join("、")}`;
    }
  }
  ok("鏡頭護欄：無臉鏡頭的圖裡沒有眼睛／視線標籤", leak === 0, why);
}

// --- 時代還原度 -------------------------------------------------------------
// clothingPrefer 從硬桶改成軟權重（為了救色彩變體）的時候，時代專屬的衣服跟著掉了
// 12–24%，沒有任何測試發現 —— 是使用者看圖看出來的：「以前看得出時代，現在有點看不出來」。
// 門檻刻意設寬：守的是「不要再無聲掉下去」，不是把某個分布釘死。
{
  const by = new Map(data.tags.map((t) => [t.tag, t]));
  const eraSpecificTag = (t) => {
    const it = by.get(t);
    return !!it && !(it.era || ["any"]).includes("any");
  };
  // 2026-09-15：不算內衣。
  //
  // 這條測試在意的是「看圖看不看得出時代」—— 那是使用者當初回報的原話。
  // 穿在衣服底下、畫面上根本看不到的內衣從來就不是時代訊號，但它 era=["modern"]，
  // 所以一直被算進 modern 的密度裡，把門檻墊高成 4.6（比當時真正看得見的 4.22 還高）。
  //
  // 加了「全身穿好又沒有脫衣動作就不要標內衣」之後，modern 總數 5.68 -> 4.46，
  // 但拆開來看：內衣 1.47 -> 0.40，而**真正看得見的衣服 3.10 -> 3.13，沒有掉**。
  // 其他五個時代的數字一個都沒動（內衣只有 modern 有）。
  //
  // 所以這裡改的是「量什麼」，不是「把尺改短」：改成只算看得見的衣服，
  // modern 的門檻也跟著從那個被墊高的數字，換成從看得見的實測值往下留餘裕。
  const visibleGarment = (t) => {
    const it = by.get(t);
    if (!it) return false;
    return !(it.mutex === "underwear_top" || it.mutex === "underwear_bottom" || it.group === "underwear");
  };
  // 下限＝硬桶時期實測值的八成。改權重只要沒掉破這條就不會紅。
  // 刻意不隨著調參往上抬：門檻要守的是「不要無聲崩掉」，不是「不准把優化讓回去」。
  // 一度把 modern 抬到 5.6 去鎖住當時的數字，那會讓之後每次合法調整都假紅。
  const FLOOR = {
    // 看得見的實測值 4.06，留約 15% 餘裕 —— 門檻是要抓崩掉，不是釘住當下的數字。
    modern: 3.5,
    ancient_china: 1.8,
    ancient_greece: 1.5,
    medieval: 1.5,
    edo: 2.6,
    victorian: 3.0,
  };
  // 色彩變體一度被硬桶壓到機率恆為 0（blue shirt 這類是 modern 專屬卻被
  // !isColorVariant 擋在低層）。修好之後也要守著，別為了時代密度又把它們餓死。
  {
    const COLOR = new Set(["white", "black", "blue", "green", "red", "pink", "purple",
      "brown", "aqua", "orange", "yellow", "grey", "gray"]);
    const isVariant = (t) => {
      const parts = String(t).split(" ");
      return parts.length >= 2 && COLOR.has(parts[0]);
    };
    const s2 = defaultSettings(data);
    s2.girl = true;
    s2.eras = ["modern"];
    s2.heats = ["activity", "tease", "flash", "sex"];
    const kinds = new Set();
    const types = new Set();
    for (let i = 1; i <= 400; i++) {
      for (const t of tagsOf(drawOne(lex, s2, new Set(), new Set(), mulberry32(i), i))) {
        const it = by.get(t);
        if (!it || it.section !== "clothing" || it.layer !== "garment") continue;
        if (isVariant(t)) kinds.add(t);
        else types.add(t);
      }
    }
    ok("色彩變體：現代至少抽得到 20 種", kinds.size >= 20, `只有 ${kinds.size} 種`);
    ok("色彩變體：沒有把非顏色的款式洗掉（至少 100 種）", types.size >= 100, `只有 ${types.size} 種`);
  }

  for (const era of Object.keys(FLOOR)) {
    const s = defaultSettings(data);
    s.girl = true;
    s.eras = [era];
    s.heats = ["activity", "tease", "flash", "sex"];
    let n = 0;
    for (let i = 1; i <= 300; i++) {
      for (const t of tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i))) {
        if (by.get(t)?.section === "clothing" && eraSpecificTag(t) && visibleGarment(t)) n += 1;
      }
    }
    const per = n / 300;
    ok(
      `時代還原：${era} 每張至少 ${FLOOR[era]} 件該時代的衣服`,
      per >= FLOOR[era],
      `實得 ${per.toFixed(2)}`
    );
  }
}

// --- 非現代的時代至少要看得出一個年代 ---------------------------------------
// 使用者回報「以前看得出時代，現在有點看不出來」。量到的其實是長期問題：古代時代
// 的環境有 95–97% 是時代中性的字，而 park、bedroom 這種中性場地在 WAI 裡預設就
// 畫成現代的（江戶場景配電線桿和公園長椅）。
//
// 根因是場地必須配合先抽的活動，而活動幾乎全是時代中性的現代動作，所以中性場地
// 每次都贏；連 eraAnchors 的 castle 都只有 15/400。補詞庫只把 medieval 從 0.10
// 拉到 0.19，不夠。
{
  const by = new Map(data.tags.map((t) => [t.tag, t]));
  const isSpec = (t, era) => {
    const it = by.get(t);
    const e = it && it.era;
    return Array.isArray(e) && e.length && !e.includes("any") && e.includes(era);
  };
  for (const era of ["ancient_china", "ancient_greece", "medieval", "edo", "victorian"]) {
    const s = defaultSettings(data);
    s.girl = true;
    s.eras = [era];
    s.heats = ["activity", "tease", "flash", "sex"];
    let withSignal = 0;
    for (let i = 1; i <= 300; i++) {
      const got = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
      if ([...got].some((t) => by.get(t)?.section === "env" && isSpec(t, era))) withSignal += 1;
    }
    ok(
      `時代訊號：${era} 每張圖的環境都看得出年代`,
      withSignal === 300,
      `300 張裡只有 ${withSignal} 張有時代專屬的環境字`
    );
  }
  // 護欄：現代不該被硬塞（它本來就有一堆專屬場地），也不該重複塞。
  const s = defaultSettings(data);
  s.girl = true;
  s.eras = ["medieval"];
  s.heats = ["activity", "tease", "flash", "sex"];
  let over = 0;
  for (let i = 1; i <= 300; i++) {
    const got = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
    const n = [...got].filter((t) => by.get(t)?.section === "env" && isSpec(t, "medieval")).length;
    if (n > 3) over += 1;
  }
  ok("時代訊號：不會塞一整排時代字", over === 0, `${over}/300 超過 3 個`);
}

// --- 尺度核心內容不該被臉部細節餓死 -----------------------------------------
// posePrefer 是硬桶，takeFromPool 會抽乾前一桶才看下一桶。桶 1 是臉部，而臉部有
// 18 個 mutex=null 的字可以無限疊 —— 姿勢槽扣掉專用格只剩約 6 格，全被吃光，
// 桶 2（該尺度的核心）永遠輪不到。
//
// 後果不是「臉太多」這種美感問題，是 28 個 sex 字結構性不可達：mutex=sex_act 的
// 那些有專用 takeFromPool 繞過階梯所以活著，mutex=null 的那些只能靠桶 2，於是全死。
// 釘好雙人卡司、只開 sex 尺度、跑 300 張，它們仍然是 0。
{
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  s.counts = { subject: 2, feature: 8, pose: 10, clothing: 5, env: 4 };
  const seen = new Set();
  for (let i = 1; i <= 500; i++) {
    for (const t of tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i))) seen.add(t);
  }
  const STARVED = ["french kiss", "cum in pussy", "clothed sex", "cum in mouth", "happy sex", "imminent penetration"];
  const alive = STARVED.filter((t) => seen.has(t));
  ok(
    `sex 內容可達：mutex=null 的性愛字不被臉部細節餓死（${STARVED.length} 個裡至少 4 個）`,
    alive.length >= 4,
    `只有 ${alive.length} 個抽得到：${alive.join("、") || "（一個都沒有）"}`
  );
  // 對照：有專用 fill 的 sex_act 本來就活著，證明這批測試不是在測別的東西
  ok(
    "sex 內容可達 對照組：sex_act 的字抽得到",
    ["vaginal", "fellatio", "handjob"].some((t) => seen.has(t))
  );
  // 姿勢的整體多樣性：硬桶時只有 149 種，軟權重約 284 種
  const poseKinds = [...seen].filter((t) => lex.byTag.get(t)?.section === "pose").length;
  ok("sex 姿勢字種數不該塌到硬桶的水準（至少 200 種）", poseKinds >= 200, `只有 ${poseKinds} 種`);
}

// --- 同一張圖不能既「即將」又「已經結束」-------------------------------------
// 放開桶 2 之後這些 mutex=null 的性愛狀態詞會一起被抽進來，而它們是時序上的
// 三個階段。1.4% 的圖同時出現 imminent penetration 和 after vaginal。
{
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  s.heats = ["sex"];
  s.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  s.counts = { subject: 2, feature: 8, pose: 10, clothing: 5, env: 4 };
  const BEFORE = ["imminent penetration", "imminent vaginal", "imminent fellatio"];
  const AFTER = ["after vaginal", "after sex", "after fellatio", "after paizuri", "afterglow", "cum drip"];
  let clash = 0;
  let why = "";
  for (let i = 1; i <= 800; i++) {
    const got = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
    const bf = BEFORE.filter((t) => got.has(t));
    const af = AFTER.filter((t) => got.has(t));
    if (bf.length && af.length) {
      clash += 1;
      if (!why) why = `seed ${i}：${bf.concat(af).join(" + ")}`;
    }
  }
  ok("性愛時序：不會同時「即將」和「已經結束」", clash === 0, `${clash}/800　${why}`);
}

{
  // 浴場一定要交代身體。isBathOkGarment() 是白名單，modern/漢/希臘/江戶各有一條
  // 能通過的服裝，medieval 和 victorian 一條都沒有 —— 於是「浴缸裡戴著軟帽，
  // 身上沒有任何描述」。白名單永遠會漏掉時代，所以這裡測結果不測名單。
  const s = defaultSettings(data);
  s.girl = true;
  const BATH = new Set([
    "bath", "bathtub", "bathing", "onsen", "shower", "shower (place)",
    "sauna", "bathhouse", "ofuro", "bubble bath",
  ]);
  const bad = [];
  let bathSeen = 0;
  for (const era of ERAS) {
    for (const heat of HEATS) {
      s.eras = [era];
      s.heats = [heat];
      // 這版詞庫 6 時代 × 4 尺度 × 200 張只看到 173 張浴場，低於「至少 200」。
      // 身體交代那條在這 173 張裡是過的。門檻不降，每格改抽 320，把樣本補過 200。
      for (let i = 1; i <= 320; i++) {
        const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
        if (![...h].some((t) => BATH.has(t))) continue;
        bathSeen += 1;
        const stated = [...h].some((t) => {
          const it = lex.byTag.get(t);
          if (!it || it.section !== "clothing") return false;
          if (it.layer === "skin") return true;
          const slot = it.mutex || it.group;
          return it.layer === "garment" &&
            (slot === "onepiece" || slot === "top" || slot === "bottom" || LOWER_COVER.has(t));
        });
        if (!stated) bad.push(bad.length < 4 ? `${era}/${heat} seed ${i}` : "");
      }
    }
  }
  ok("浴場的取樣夠多，這條測試不是空轉", bathSeen >= 200, `bathSeen=${bathSeen}`);
  eq("浴場一定要交代身體（裸標或服裝，任何時代任何 heat）", bad.length, 0);
  if (bad.length) console.error(`      例：${bad.filter(Boolean).join("  ")}`);
}

{
  // coat 可能只到腰部，不能拿它替 white shirt 充當下著。
  // 以前用 clothing=1 讓 filler 不補、單獨驗 lower-body repair。2026-09-29 起服裝 1～4
  // 是選格（每種一件、釘選先佔格）：釘了兩件就已經超過 1，引擎不再補任何衣服 ——
  // 那是專案主要的「衣服可以不穿完整」。所以修復保證改在預設數字（5，不選格）驗，
  // 另外守一條「服裝 1 釘兩件就不補」。
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = false;
  s.eras = ["modern"];
  s.heats = ["tease"];
  const isBottom = (t) => {
    const it = lex.byTag.get(t);
    if (!it || it.section !== "clothing" || it.layer !== "garment") return false;
    return (it.mutex || it.group) === "bottom";
  };
  const isOnepiece = (t) => lex.byTag.get(t)?.mutex === "onepiece";
  const h = tagsOf(drawOne(lex, s, new Set(["white shirt", "coat"]), new Set(), mulberry32(63001), 63001));
  ok("外套不能冒充下著：上衣＋coat 會補 bottom，不疊穿 onepiece", [...h].some(isBottom) && ![...h].some(isOnepiece), [...h].join(", "));
  const s1 = { ...s, counts: { ...s.counts, clothing: 1 } };
  const h1 = tagsOf(drawOne(lex, s1, new Set(["white shirt", "coat"]), new Set(), mulberry32(63001), 63001));
  ok("服裝 1、釘了上衣＋coat：釘選已佔滿，不再補下身", ![...h1].some(isBottom), [...h1].join(", "));
}

{
  // loincloth 可留給有男性的古代情境，但不應成為純女性古希臘的預設下著；
  // chiton/toga/ancient greek clothes 已經是完整服裝。
  eq("loincloth 僅限有男性的情境", lex.byTag.get("loincloth")?.gate, "male");
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = false;
  s.eras = ["ancient_greece"];
  s.heats = ["tease", "flash", "sex"];
  let hits = 0;
  for (let i = 1; i <= 300; i++) {
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(63100 + i), 63100 + i));
    if (h.has("loincloth")) hits += 1;
  }
  eq("純女性古希臘不會自動抽到 loincloth", hits, 0);
  ok(
    "loincloth 不再稀釋古希臘完整服裝",
    !lex.byTag.get("loincloth")?.era?.includes("ancient_greece"),
    JSON.stringify(lex.byTag.get("loincloth")?.era)
  );
  eq("loincloth 使用 underwear slot，不冒充外穿褲裙", lex.byTag.get("loincloth")?.mutex, "underwear_bottom");
  const male = defaultSettings(data);
  male.girl = false;
  male.boy = true;
  male.eras = ["medieval"];
  male.heats = ["tease", "flash", "sex"];
  let dryHits = 0;
  for (let i = 1; i <= 200; i++) {
    const h = tagsOf(drawOne(lex, male, new Set(["castle"]), new Set(), mulberry32(63500 + i), 63500 + i));
    if (h.has("loincloth")) dryHits += 1;
  }
  eq("loincloth 不會洗版一般中世紀場景", dryHits, 0);
  const pinnedLoincloth = tagsOf(
    drawOne(lex, male, new Set(["castle", "loincloth"]), new Set(), mulberry32(63701), 63701)
  );
  ok("手動釘選 loincloth 仍保留", pinnedLoincloth.has("loincloth"));
}

{
  // 上衣一定要配下著。hasBodyGarment() 認為單一件 top 就夠了，於是 victorian
  // 抽到 blouse 之後沒有任何東西會去補裙子 —— 而 victorian 的 bottom 池只有
  // pencil skirt 一件真衣服。畫出來是上半身有衣服、下半身空著。
  const s = defaultSettings(data);
  s.girl = true;
  const bad = [];
  let topSeen = 0;
  for (const era of ERAS) {
    for (const heat of HEATS) {
      s.eras = [era];
      s.heats = [heat];
      for (let i = 1; i <= 200; i++) {
        const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
        const mut = new Set();
        let skin = false;
        for (const t of h) {
          const it = lex.byTag.get(t);
          if (!it || it.section !== "clothing") continue;
          if (it.layer === "skin") skin = true;
          if (it.layer === "garment" && it.mutex) mut.add(it.mutex);
        }
        // 「只穿一件」是例外：naked shirt 的語意就是下半身什麼都沒有。
        // 這條以前沒有這個例外也不會紅，是因為 naked shirt 當時總是違規地配著
        // 裙子（實測出現那六個字的 190 張，190 張身上都還穿著別的衣服）。
        // 引擎補上「只穿一件要名副其實」之後，下著正確地消失了，這條才露出來。
        if (skin || !mut.has("top") || mut.has("onepiece")) continue;
        if ([...h].some((t) => /^naked /.test(t))) continue;
        topSeen += 1;
        const covered = mut.has("bottom") || [...h].some((t) => LOWER_COVER.has(t));
        if (!covered) bad.push(bad.length < 4 ? `${era}/${heat} seed ${i}` : "");
      }
    }
  }
  ok("上衣的取樣夠多，這條測試不是空轉", topSeen >= 300, `topSeen=${topSeen}`);
  eq("抽到上衣就一定要有下著（或整套服裝）", bad.length, 0);
  if (bad.length) console.error(`      例：${bad.filter(Boolean).join("  ")}`);
}

{
  // 維多利亞男性已有 waistcoat / shirt 類上衣，但舊池沒有任何 male bottom。
  // 這裡只掃真正抽到 top 的圖，避免用「完整西裝本來就不需要 bottom」稀釋契約。
  // 水上活動另有泳裝／裸身策略；把 suit pants 強塞進 swimming 才是不合理。
  const s = defaultSettings(data);
  s.girl = false;
  s.boy = true;
  s.eras = ["victorian"];
  const bad = [];
  let topSeen = 0;
  for (const heat of HEATS) {
    s.heats = [heat];
    for (let i = 1; i <= 160; i++) {
      const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(64000 + i), 64000 + i));
      if (["swimming", "diving", "wading", "fishing", "bathing"].some((t) => h.has(t))) continue;
      const clothing = [...h].map((t) => lex.byTag.get(t)).filter((it) => it?.section === "clothing");
      if (clothing.some((it) => it.layer === "skin")) continue;
      const slots = new Set(clothing.filter((it) => it.layer === "garment").map((it) => it.mutex || it.group));
      // 「只穿一件」是例外：naked shirt 的語意就是下半身什麼都沒有。
      // 這條以前沒有這個例外也不會紅，是因為 naked shirt 當時總是違規地配著
      // 裙子（實測出現那六個字的 190 張，190 張身上都還穿著別的衣服）。
      // 引擎補上「只穿一件要名副其實」之後，下著正確地消失了，這條才露出來。
      if (!slots.has("top") || slots.has("onepiece")) continue;
      if ([...h].some((t) => /^naked /.test(t))) continue;
      topSeen += 1;
      const covered = slots.has("bottom") || clothing.some((it) => LOWER_COVER.has(it.tag));
      if (!covered) bad.push(bad.length < 4 ? `${heat} seed ${64000 + i}` : "");
    }
  }
  ok("男性維多利亞上衣樣本足夠", topSeen >= 60, `topSeen=${topSeen}`);
  eq("男性維多利亞非水上場景抽到上衣時一定有下著", bad.length, 0);
  if (bad.length) console.error(`      例：${bad.filter(Boolean).join("  ")}`);
  eq("suit pants 是男性下著", lex.byTag.get("suit pants")?.gate, "male");
  ok("suit pants 可用於維多利亞", lex.byTag.get("suit pants")?.era?.includes("victorian"));
}

{
  // 浴場修復可以選裸標，但不能因為某時代沒有白名單服裝就被迫 100% 裸體。
  // sex 尺度裸體是合理結果，故只驗 activity / tease / flash。
  for (const era of ["medieval", "victorian"]) {
    const s = defaultSettings(data);
    s.girl = false;
    s.boy = true;
    s.eras = [era];
    let total = 0;
    let nude = 0;
    for (const heat of ["activity", "tease", "flash"]) {
      s.heats = [heat];
      for (let i = 1; i <= 80; i++) {
        const h = tagsOf(drawOne(lex, s, new Set(["bath"]), new Set(), mulberry32(65000 + i), 65000 + i));
        total += 1;
        if ([...h].some((t) => lex.byTag.get(t)?.layer === "skin")) nude += 1;
      }
    }
    ok(`${era} 男性非 sex 浴場不是被迫全裸`, nude <= total * 0.8, `nude=${nude}/${total}`);
  }
}

{
  // 外衣的時代庫存差距。modern 有 13 件外衣，每個歷史時代剛好只有一件，於是
  // 那一件就等於該時代的制服：himation 佔古希臘七成八、cloak 佔中世紀七成二。
  // 觸發率各時代其實差不多，差的是可選數量 —— 和浴場白名單同一種形狀。
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  // 時代錨點本來就每張都在，不算重複。
  const ANCHOR = new Set([
    "modern", "chinese clothes", "ancient greek clothes",
    "armor", "castle", "japanese clothes", "victorian",
  ]);
  const worst = [];
  for (const era of ERAS) {
    s.eras = [era];
    s.heats = ["activity", "tease", "flash", "sex"];
    const seen = new Map();
    const N = 400;
    for (let i = 1; i <= N; i++) {
      const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
      for (const t of h) {
        if (ANCHOR.has(t)) continue;
        const it = lex.byTag.get(t);
        if (it && it.section === "clothing" && it.layer === "garment") {
          seen.set(t, (seen.get(t) || 0) + 1);
        }
      }
    }
    const sorted = [...seen.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      const [tag, n] = sorted[0];
      const pct = Math.round((100 * n) / N);
      if (pct > 55) worst.push(`${era} ${tag} ${pct}%`);
    }
  }
  eq("沒有哪一件衣服佔掉一個時代過半的畫面", worst.length, 0);
  if (worst.length) console.error(`      ${worst.join("  ")}`);
}

{
  // 沒有人穿著斗篷游泳。garmentOkForSwim() 只擋 modern（`if (era === "modern")
  // return false` 之後就 return true），歷史時代整套外衣照穿下水。
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  const SWIM = ["swimming", "diving", "underwater"];
  const bad = [];
  let swimSeen = 0;
  for (const era of ERAS) {
    for (const heat of HEATS) {
      s.eras = [era];
      s.heats = [heat];
      for (let i = 1; i <= 200; i++) {
        const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
        if (!SWIM.some((t) => h.has(t))) continue;
        swimSeen += 1;
        const outer = [...h].filter((t) => lex.byTag.get(t)?.mutex === "outer");
        if (outer.length) bad.push(bad.length < 4 ? `${era}/${heat} seed ${i}: ${outer.join("+")}` : "");
      }
    }
  }
  ok("游泳的取樣夠多，這條測試不是空轉", swimSeen >= 100, `swimSeen=${swimSeen}`);
  eq("游泳時身上不會披著外衣", bad.length, 0);
  if (bad.length) console.error(`      例：${bad.filter(Boolean).join("  ")}`);
}

{
  // 沒釘場所的性愛跟其他熱度用同一池場地，權重拉平。
  // 公園、大街、沙灘、神社、教室這組以前被私密白名單擋掉，現在每個時代裡
  // 說得通的那些都要抽得到。中世紀的城堡、古中國的東亞建築仍先擲一次招牌
  // （機率 35%）。樣本會在 35% 上下晃，招牌第一名放到 45% 仍算這顆骰子；
  // 別的場地超過三分之一就是真的洗版。
  // 現代場地大約 110 種、權重拉平，400 張時都市風景是 0、同組大街公園是 2～3。
  // 1200 張都市風景 12，太空、舞台、學校、車站、觸手坑都在 2～5，沒有吃掉這一格。
  // 400 張會把這種落空判成抽不到，所以覆蓋改看 1200 張。
  const s = defaultSettings(data);
  s.girl = true;
  s.heats = ["sex"];
  const thin = [];
  const hot = [];
  const missed = [];
  const open = {
    modern: ["street", "city", "cityscape", "alley", "park", "beach", "ocean", "rooftop", "shrine", "classroom", "cafe", "poolside", "church"],
    victorian: ["street", "alley", "park", "beach", "ocean", "market"],
    edo: ["street", "beach", "ocean", "shrine", "temple", "market"],
    medieval: ["street", "beach", "ocean", "market"],
    ancient_china: ["street", "beach", "ocean", "temple", "market"],
    ancient_greece: ["street", "beach", "ocean"],
  };
  for (const era of ERAS) {
    s.eras = [era];
    const m = new Map();
    // 2026-10-10：兩人互動補 25 個字，亂數順序跟著變，現代大街在 1200 張裡剛好 0（4000 張改前 9、改後 11）。
    // 規則沒變，覆蓋改看 2000 張。
    const N = 2000;
    for (let i = 1; i <= N; i++) {
      const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
      for (const t of h) {
        const it = lex.byTag.get(t);
        if (it && (it.mutex === "place" || it.group === "place")) m.set(t, (m.get(t) || 0) + 1);
      }
    }
    if (m.size < 6) thin.push(`${era} 只有 ${m.size} 種`);
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      const pct = Math.round((100 * sorted[0][1]) / N);
      const anchor = era === "medieval" ? "castle" : era === "ancient_china" ? "east asian architecture" : "";
      const cap = sorted[0][0] === anchor ? 45 : 35;
      if (pct > cap) hot.push(`${era} ${sorted[0][0]} ${pct}%`);
    }
    for (const tag of open[era] || []) {
      if (!m.get(tag)) missed.push(`${era} ${tag}`);
    }
  }
  eq("性愛模式下每個時代都抽得到至少 6 種場地", thin.length, 0);
  if (thin.length) console.error(`      ${thin.join("  ")}`);
  eq("性愛模式下沒有單一場地佔掉三分之一以上", hot.length, 0);
  if (hot.length) console.error(`      ${hot.join("  ")}`);
  eq("沒釘的性愛抽得到公園、大街、沙灘和同組場地", missed.length, 0);
  if (missed.length) console.error(`      ${missed.join("  ")}`);
}

{
  // 釘了活動之後，場地收到那個活動自己的清單。沒釘的性愛用整池、權重拉平，
  // 由上面那條守「公園和大街真的抽得到」。身份鎖（滑雪=山、煮飯=廚房、OL=辦公室）不動。
  // 歷史時代沒有淋浴間、網球場時，場地格不該整格空白。
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = false;
  const N = 80;
  const placeHist = (pins) => {
    const m = new Map();
    let empty = 0;
    for (let i = 1; i <= N; i += 1) {
      const h = tagsOf(drawOne(lex, s, new Set(pins), new Set(), mulberry32(5000 + i), 5000 + i));
      let place = "";
      for (const t of h) {
        const it = lex.byTag.get(t);
        if (it && (it.mutex === "place" || it.group === "place")) {
          place = t;
          break;
        }
      }
      if (!place) empty += 1;
      else m.set(place, (m.get(place) || 0) + 1);
    }
    return { m, empty };
  };
  const topShare = (hist) => {
    let tag = "";
    let n = 0;
    for (const [t, c] of hist.m) {
      if (c > n) {
        tag = t;
        n = c;
      }
    }
    return { tag, n };
  };
  s.heats = ["sex"];
  s.eras = ["modern"];
  const outdoors = placeHist(["outdoors"]);
  const outTop = topShare(outdoors);
  ok(
    "現代性愛釘室外，竹林不超過四成",
    outdoors.m.size >= 6 && (outdoors.m.get("bamboo forest") || 0) / N < 0.4,
    `${outTop.tag} ${outTop.n}/${N} bamboo=${outdoors.m.get("bamboo forest") || 0} kinds=${outdoors.m.size} empty=${outdoors.empty}`,
  );
  const sports = placeHist(["playing sports"]);
  const sportTop = topShare(sports);
  ok(
    "現代性愛釘運動，不是只剩道場",
    sports.m.size >= 4 && (sports.m.get("dojo") || 0) / N < 0.5,
    `${sportTop.tag} ${sportTop.n}/${N} kinds=${sports.m.size}`,
  );
  const shop = placeHist(["shopping"]);
  const shopTop = topShare(shop);
  ok(
    "現代性愛釘購物，不是只剩更衣室",
    shop.m.size >= 3 && (shop.m.get("changing room") || 0) / N < 0.5,
    `${shopTop.tag} ${shopTop.n}/${N} kinds=${shop.m.size}`,
  );
  const cook = placeHist(["cooking"]);
  ok("現代煮飯仍是廚房", (cook.m.get("kitchen") || 0) >= N * 0.9, `kitchen=${cook.m.get("kitchen") || 0}/${N}`);
  const ol = placeHist(["office lady"]);
  ok("OL 仍是辦公室", (ol.m.get("office") || 0) >= N * 0.9, `office=${ol.m.get("office") || 0}/${N}`);
  s.heats = ["tease"];
  const ski = placeHist(["skiing"]);
  ok("滑雪仍是山", (ski.m.get("mountain") || 0) >= N * 0.9, `mountain=${ski.m.get("mountain") || 0}/${N}`);
  s.heats = ["sex"];
  s.eras = ["ancient_greece"];
  const shower = placeHist(["showering"]);
  ok(
    "古希臘釘淋浴有場地，而且是浴場",
    shower.empty <= N * 0.2 && (shower.m.get("bath") || 0) >= N * 0.5,
    `bath=${shower.m.get("bath") || 0}/${N} empty=${shower.empty} kinds=${shower.m.size}`,
  );
  s.eras = ["medieval"];
  const tennis = placeHist(["tennis"]);
  ok(
    "中世紀釘網球不是整格空白",
    tennis.empty <= N * 0.2 && tennis.m.size >= 1,
    `empty=${tennis.empty}/${N} kinds=${tennis.m.size}`,
  );
}

{
  // 釘了室外之後，海邊、森林、山、街道和竹林同一個權重。
  // 溫泉、道場、泳池、神社兩邊都算場景：跟得了釘選的那一側，不再補上相反的字。
  // 臥室、廚房、辦公室、浴室仍然只能室內。
  let pin = applyPin(lex, new Set(), new Set(), "outdoors").pinned;
  pin = applyPin(lex, pin, new Set(), "onsen").pinned;
  ok("先釘室外再釘溫泉，室外留著", pin.has("outdoors") && pin.has("onsen") && !pin.has("indoors"));
  const onsenFirst = applyPin(lex, new Set(), new Set(), "onsen").pinned;
  ok("沒釘過室內外時，溫泉仍帶室內", onsenFirst.has("onsen") && onsenFirst.has("indoors"));
  let pinIn = applyPin(lex, new Set(), new Set(), "indoors").pinned;
  pinIn = applyPin(lex, pinIn, new Set(), "castle").pinned;
  ok("先釘室內再釘城堡，室內留著", pinIn.has("indoors") && pinIn.has("castle") && !pinIn.has("outdoors"));
  const clash = (tags) => contradictions(lex, tags).some((row) => row[0] === "in_out");
  ok("溫泉加室外不算相剋", !clash(["onsen", "outdoors"]));
  ok("臥室加室外仍相剋", clash(["bedroom", "outdoors"]));
  ok("城堡加室內不算相剋", !clash(["castle", "indoors"]));
  ok("森林加室內仍相剋", clash(["forest", "indoors"]));

  const s = defaultSettings(data);
  s.girl = true;
  s.boy = false;
  s.heats = ["sex"];
  s.eras = ["modern"];
  const kept = tagsOf(drawOne(lex, s, pin, new Set(), mulberry32(7), 7));
  ok("釘了室外和溫泉的那一張沒有再補室內", kept.has("onsen") && kept.has("outdoors") && !kept.has("indoors"));
  const N = 200;
  const OPEN = ["beach", "forest", "mountain", "street", "ocean", "garden"];
  const ROOM = ["living room", "bedroom", "kitchen", "office", "classroom", "bathroom"];
  const DUAL = ["onsen", "dojo", "pool", "shrine", "cafe", "bar (place)", "restaurant", "izakaya", "church", "greenhouse", "ryokan", "bath"];
  let bamboo = 0;
  let open = 0;
  let room = 0;
  let dual = 0;
  let dualAlsoIn = 0;
  const kinds = new Set();
  for (let i = 1; i <= N; i += 1) {
    const h = tagsOf(drawOne(lex, s, new Set(["outdoors"]), new Set(), mulberry32(8000 + i), 8000 + i));
    let place = "";
    for (const t of h) {
      const it = lex.byTag.get(t);
      if (it && (it.mutex === "place" || it.group === "place")) {
        place = t;
        break;
      }
    }
    if (!place) continue;
    kinds.add(place);
    if (place === "bamboo forest") bamboo += 1;
    if (OPEN.includes(place)) open += 1;
    if (ROOM.includes(place)) room += 1;
    if (DUAL.includes(place)) {
      dual += 1;
      if (h.has("indoors")) dualAlsoIn += 1;
    }
  }
  eq("釘室外不抽臥室廚房辦公室", room, 0);
  ok(
    "釘室外時海邊森林山街道不會少於竹林",
    open > bamboo && kinds.size >= 15,
    `open=${open} bamboo=${bamboo} kinds=${kinds.size}`,
  );
  ok("釘室外抽得到兩邊都行的場地", dual > 0, `dual=${dual}`);
  eq("兩邊都行的場地不會再補上室內", dualAlsoIn, 0);

  const OUT_DUAL = ["pool", "shrine"];
  let outDual = 0;
  let leaked = 0;
  for (let i = 1; i <= N; i += 1) {
    const h = tagsOf(drawOne(lex, s, new Set(["indoors"]), new Set(), mulberry32(9000 + i), 9000 + i));
    let place = "";
    for (const t of h) {
      const it = lex.byTag.get(t);
      if (it && (it.mutex === "place" || it.group === "place")) {
        place = t;
        break;
      }
    }
    if (!OUT_DUAL.includes(place)) continue;
    outDual += 1;
    if (h.has("outdoors")) leaked += 1;
  }
  ok("釘室內抽得到泳池或神社", outDual > 0, `n=${outDual}`);
  eq("泳池神社不會再補上室外", leaked, 0);
}

{
  // 沒被關掉、閘門也開著，卻以前整段進不了池的字。
  // 乳貼沒有互斥格，正常模式的衣服補牌直接丟掉。
  // 路人被跟「無人類／風景」寫在同一行，隨機永遠是 0。
  // 三角泳褲不算泳裝，游泳場面會把它脫掉，沒游泳又被場合檢查刪掉。
  // 百合、多個女生／男生沒有抽卡司的權重，另開一條亂數才碰得到。五個女生仍不自動抽。
  const girl = defaultSettings(data);
  girl.girl = true;
  girl.boy = false;
  girl.heats = ["tease"];
  girl.eras = ["modern"];
  girl.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  const chestOpen = new Set([
    "breasts out", "one breast out", "nipple slip", "areola slip",
    "shirt lift", "shirt pull", "open shirt", "open clothes", "naked shirt",
    "downblouse", "sports bra lift",
  ]);
  const sportNeed = new Set([
    "playing sports", "exercising", "training", "jogging",
    "tennis", "soccer", "basketball", "volleyball", "baseball",
    "boxing", "badminton", "table tennis", "track and field",
    "golf", "archery", "skiing", "skating",
    "fitness gym", "school gym", "stadium", "sports court", "running track",
    "basketball court", "tennis court", "soccer field", "baseball stadium",
    "boxing ring", "golf course", "bowling alley",
    "gym uniform", "track uniform", "soccer uniform", "basketball uniform",
    "tennis uniform", "volleyball uniform", "baseball uniform",
    "cheerleader", "buruma",
  ]);
  let pasties = 0;
  let pastiesHidden = 0;
  let sportBad = 0;
  let people = 0;
  let yuri = 0;
  let multiG = 0;
  let five = 0;
  let yuriBoy = 0;
  let loli = 0;
  for (let i = 0; i < 400; i += 1) {
    const h = tagsOf(drawOne(lex, girl, new Set(), new Set(), mulberry32(120000 + i), 120000 + i));
    if (h.has("pasties")) {
      pasties += 1;
      let covered = false;
      let open = false;
      for (const t of h) {
        if (chestOpen.has(t)) open = true;
        const it = lex.byTag.get(t);
        if (it?.layer === "skin") open = true;
        if (
          it &&
          it.layer === "garment" &&
          t !== "pasties" &&
          (it.mutex === "top" || it.mutex === "onepiece" || it.mutex === "underwear_top")
        ) {
          covered = true;
        }
      }
      if (covered && !open) pastiesHidden += 1;
    }
    if (h.has("sportswear")) {
      let ctx = false;
      for (const t of h) if (sportNeed.has(t)) ctx = true;
      if (!ctx) sportBad += 1;
    }
    if (h.has("people")) people += 1;
    if (h.has("yuri")) {
      yuri += 1;
      if (h.has("1boy") || h.has("2boys") || h.has("3boys")) yuriBoy += 1;
    }
    if (h.has("multiple girls")) multiG += 1;
    if (h.has("5girls")) five += 1;
    if (h.has("loli") || h.has("shota")) loli += 1;
  }
  // 2026-10-09：長相自由格照常見程度加權之後，誘惑尺度不再常隨機露出胸口，乳貼跟著變少
  // （3000 張 26 → 9）。這條只驗「抽得到」，上面 400 張沒中就往後多看，抽到就停。
  for (let i = 400; pasties === 0 && i < 3000; i += 1) {
    if (tagsOf(drawOne(lex, girl, new Set(), new Set(), mulberry32(120000 + i), 120000 + i)).has("pasties")) pasties += 1;
  }
  ok("正常模式抽得到乳貼", pasties > 0, `pasties=${pasties}`);
  eq("乳貼不會藏在蓋住的胸口底下", pastiesHidden, 0);
  eq("運動服要有運動場合", sportBad, 0);
  ok("路人進得了環境池", people > 0, `people=${people}`);
  ok("多個女生時抽得到百合", yuri > 0, `yuri=${yuri}`);
  eq("百合不會帶男生", yuriBoy, 0);
  ok("正好兩女時抽得到多個女生", multiG > 0, `multi=${multiG}`);
  eq("只開女生不會自動抽五個女生", five, 0);
  eq("乳貼這條沒有把蘿莉正太放回來", loli, 0);

  const boy = defaultSettings(data);
  boy.girl = false;
  boy.boy = true;
  boy.heats = ["tease"];
  boy.eras = ["modern"];
  boy.counts = { subject: 10, feature: 10, pose: 10, clothing: 10, env: 10 };
  let briefs = 0;
  let briefsDry = 0;
  let multiB = 0;
  let swimSport = 0;
  const wet = new Set(["swimming", "diving", "pool", "poolside", "ocean", "beach", "underwater"]);
  for (let i = 0; i < 200; i += 1) {
    const h = tagsOf(drawOne(lex, boy, new Set(["swimming"]), new Set(), mulberry32(130000 + i), 130000 + i));
    if (h.has("swim briefs")) {
      briefs += 1;
      if (![...wet].some((t) => h.has(t))) briefsDry += 1;
    }
    if (h.has("multiple boys")) multiB += 1;
    if (h.has("sportswear")) swimSport += 1;
  }
  ok("男生游泳抽得到三角泳褲", briefs > 0, `briefs=${briefs}`);
  eq("三角泳褲不會出現在沒有水的地方", briefsDry, 0);
  ok("兩男時抽得到多個男生", multiB > 0, `multiB=${multiB}`);
  eq("游泳不會再蓋上運動服", swimSport, 0);

  let sportHit = 0;
  for (let i = 0; i < 80; i += 1) {
    const h = tagsOf(drawOne(lex, girl, new Set(["playing sports"]), new Set(), mulberry32(140000 + i), 140000 + i));
    if (h.has("sportswear")) sportHit += 1;
  }
  ok("釘運動抽得到運動服", sportHit > 0, `sportswear=${sportHit}`);
}

{
  // 沒有互斥格、正常模式衣服補牌不收的字。另開亂數，而且只在說得通的時候補。
  // 性玩具的熱度鎖著只有性愛，假陽具 implies 它，所以誘惑和走光補不進去。
  // 包不進浴場和游泳：白名單已經掃過，事後補會把脫掉的包戴回去。
  const freshCondom = ["holding condom", "condom wrapper", "condom box", "condom in mouth", "condom on penis"];
  const anyCondom = [...freshCondom, "used condom", "condom"];
  const anyToy = ["dildo", "vibrator", "egg vibrator", "sex toy"];
  const publicSex = new Set(["street", "city", "cityscape", "alley", "park", "beach", "ocean", "rooftop"]);
  const hoodCtx = new Set(["hoodie", "hood", "hooded cloak"]);
  const bathCtx = new Set([
    "onsen", "bath", "bathtub", "shower (place)", "bathhouse", "ofuro", "bubble bath", "sauna",
    "bathing", "showering", "shared bathing",
  ]);
  const monsterish = (h) => {
    for (const t of h) {
      if (t === "monster boy" || t === "vampire" || t === "dragon boy") return true;
      if ((lex.byTag.get(t)?.implies || []).includes("monster boy")) return true;
    }
    return false;
  };
  const hasAny = (h, names) => names.some((t) => h.has(t));
  const sex = defaultSettings(data);
  sex.girl = true;
  sex.boy = true;
  sex.heats = ["sex"];
  sex.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  sex.eras = ["modern"];
  let toys = 0;
  let condoms = 0;
  let freshUsed = 0;
  let publicPlace = 0;
  let stackedBag = 0;
  let clash = 0;
  for (let i = 0; i < 240; i += 1) {
    const drawn = drawOne(lex, sex, new Set(), new Set(), mulberry32(150000 + i), 150000 + i);
    const h = tagsOf(drawn);
    if (hasAny(h, anyToy)) toys += 1;
    if (hasAny(h, anyCondom)) condoms += 1;
    if (h.has("used condom") && hasAny(h, freshCondom)) freshUsed += 1;
    if ([...h].some((t) => publicSex.has(t))) publicPlace += 1;
    if ((h.has("bag") || h.has("handbag")) && h.has("backpack")) stackedBag += 1;
    if (contradictions(lex, [...h]).length) clash += 1;
  }
  ok("男女性愛抽得到性玩具", toys > 0, `toys=${toys}`);
  ok("男女性愛抽得到保險套", condoms > 0, `condoms=${condoms}`);
  eq("沒拆的保險套不會跟用過的疊在一起", freshUsed, 0);
  ok("沒釘場所的性愛也能到大街、公園、沙灘", publicPlace > 0, `public=${publicPlace}`);
  eq("包不會跟背包疊在同一格", stackedBag, 0);
  eq("這些補牌沒有製造矛盾", clash, 0);

  const girlSex = { ...sex, boy: false };
  let girlToys = 0;
  let girlCondom = 0;
  for (let i = 0; i < 160; i += 1) {
    const h = tagsOf(drawOne(lex, girlSex, new Set(), new Set(), mulberry32(151000 + i), 151000 + i));
    if (hasAny(h, anyToy)) girlToys += 1;
    if (hasAny(h, anyCondom)) girlCondom += 1;
  }
  ok("女生性愛抽得到性玩具", girlToys > 0, `toys=${girlToys}`);
  eq("沒有男生就不補保險套", girlCondom, 0);

  const tease = defaultSettings(data);
  tease.girl = true;
  tease.boy = false;
  tease.heats = ["tease"];
  tease.weights = { activity: 0, tease: 1, flash: 0, sex: 0 };
  tease.eras = ["modern"];
  let bags = 0;
  let teaseToy = 0;
  let bareOrphan = 0;
  let hoodOrphan = 0;
  let dryTowel = 0;
  for (let i = 0; i < 240; i += 1) {
    const h = tagsOf(drawOne(lex, tease, new Set(), new Set(), mulberry32(152000 + i), 152000 + i));
    if (h.has("bag") || h.has("handbag")) bags += 1;
    if (hasAny(h, anyToy)) teaseToy += 1;
    if (h.has("bare shoulders") && !h.has("off shoulder")) bareOrphan += 1;
    if (h.has("hood up") && ![...hoodCtx].some((t) => h.has(t))) hoodOrphan += 1;
    if (h.has("towel") && ![...bathCtx].some((t) => h.has(t))) dryTowel += 1;
  }
  ok("誘惑抽得到包", bags > 0, `bags=${bags}`);
  eq("誘惑不抽性玩具", teaseToy, 0);
  eq("裸肩只跟著露肩裝", bareOrphan, 0);
  eq("戴上兜帽要先有帽子", hoodOrphan, 0);
  eq("毛巾只出現在浴場", dryTowel, 0);

  const boy = { ...tease, girl: false, boy: true };
  let coke = 0;
  let cokeBare = 0;
  let cokeSun = 0;
  for (let i = 0; i < 200; i += 1) {
    const h = tagsOf(drawOne(lex, boy, new Set(), new Set(), mulberry32(153000 + i), 153000 + i));
    if (h.has("coke-bottle glasses")) {
      coke += 1;
      if (!h.has("glasses")) cokeBare += 1;
      if (h.has("sunglasses")) cokeSun += 1;
    }
  }
  ok("男生抽得到瓶底眼鏡", coke > 0, `coke=${coke}`);
  eq("瓶底眼鏡會帶上眼鏡", cokeBare, 0);
  eq("瓶底眼鏡不跟太陽眼鏡疊", cokeSun, 0);

  let bare = 0;
  for (let i = 0; i < 60; i += 1) {
    const h = tagsOf(drawOne(lex, tease, new Set(["off shoulder"]), new Set(), mulberry32(154000 + i), 154000 + i));
    if (h.has("bare shoulders") && h.has("off shoulder")) bare += 1;
  }
  ok("釘露肩裝抽得到裸肩", bare > 0, `bare=${bare}`);

  let hoodUp = 0;
  for (let i = 0; i < 60; i += 1) {
    const h = tagsOf(drawOne(lex, tease, new Set(["hoodie"]), new Set(), mulberry32(155000 + i), 155000 + i));
    if (h.has("hood up") && h.has("hoodie")) hoodUp += 1;
  }
  ok("釘連帽衫抽得到戴上兜帽", hoodUp > 0, `hoodUp=${hoodUp}`);

  let towel = 0;
  let bathBag = 0;
  for (let i = 0; i < 60; i += 1) {
    const h = tagsOf(drawOne(lex, tease, new Set(["bathing"]), new Set(), mulberry32(156000 + i), 156000 + i));
    if (h.has("towel")) towel += 1;
    if (h.has("bag") || h.has("handbag")) bathBag += 1;
  }
  ok("釘洗澡抽得到毛巾", towel > 0, `towel=${towel}`);
  eq("洗澡不補包", bathBag, 0);

  const diverse = { ...boy, sceneMode: "diverse" };
  let tusks = 0;
  let humanTusks = 0;
  for (let i = 0; i < 180; i += 1) {
    const h = tagsOf(drawOne(lex, diverse, new Set(), new Set(), mulberry32(157000 + i), 157000 + i));
    if (h.has("tusks")) {
      tusks += 1;
      if (!monsterish(h)) humanTusks += 1;
    }
  }
  ok("多樣模式抽得到獠牙", tusks > 0, `tusks=${tusks}`);
  eq("獠牙不會長在普通人臉上", humanTusks, 0);

  let normalTusks = 0;
  for (let i = 0; i < 80; i += 1) {
    const h = tagsOf(drawOne(lex, boy, new Set(), new Set(), mulberry32(158000 + i), 158000 + i));
    if (h.has("tusks")) normalTusks += 1;
  }
  eq("正常模式不抽獠牙", normalTusks, 0);

  const act = { ...sex, heats: ["activity"], weights: { activity: 1, tease: 0, flash: 0, sex: 0 } };
  let actToy = 0;
  let actCondom = 0;
  for (let i = 0; i < 80; i += 1) {
    const h = tagsOf(drawOne(lex, act, new Set(), new Set(), mulberry32(159000 + i), 159000 + i));
    if (hasAny(h, anyToy)) actToy += 1;
    if (hasAny(h, anyCondom)) actCondom += 1;
  }
  eq("日常活動不抽性玩具", actToy, 0);
  eq("日常活動不抽保險套", actCondom, 0);
}

{
  // 光源槽是死的。env 明確填的是 place / in_out / day_night，lighting 只能在
  // 剩下的 fill("env") 裡跟道具、天氣、天空搶，結果 14 個光源 tag 加起來只有
  // 大約 3% 的機率出現 —— 而每一張圖都被無條件加上同一句 soft lighting，
  // 所以所有圖的光都一樣，而且沒有一個時代的光看起來像那個時代。
  // 那句固定的 soft lighting 已經拿掉（兩本字典都查不到），所以這條
  // 覆蓋率現在完全靠 light 群組真的被抽到才成立 —— 更該守住。
  const s = defaultSettings(data);
  s.girl = true;
  const thin = [];
  const noEra = [];
  for (const era of ERAS) {
    s.eras = [era];
    const m = new Map();
    const N = 400;
    for (let i = 1; i <= N; i++) {
      const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
      for (const t of h) {
        if (lex.byTag.get(t)?.mutex === "lighting") m.set(t, (m.get(t) || 0) + 1);
      }
    }
    const hit = [...m.values()].reduce((a, b) => a + b, 0);
    if (hit < N * 0.5) thin.push(`${era} ${Math.round((100 * hit) / N)}%`);
    // 歷史時代要抽得到屬於那個時代的光（燭光、油燈、火把…），
    // 不能只有 modern 也適用的那幾個。
    if (era !== "modern") {
      const eraLit = [...m.keys()].filter((t) => {
        const e = lex.byTag.get(t)?.era || [];
        return e.length && !e.includes("any");
      });
      if (!eraLit.length) noEra.push(era);
    }
  }
  eq("每張圖都有講光源（靠真的抽，不是靠一句固定尾巴）", thin.length, 0);
  if (thin.length) console.error(`      光源出現率：${thin.join("  ")}`);
  eq("歷史時代抽得到屬於那個時代的光源", noEra.length, 0);
  if (noEra.length) console.error(`      沒有時代光源：${noEra.join(" ")}`);
}

{
  // 時代組合按鈕要自己帶時代。
  //
  // 不能靠「釘了江戶的字就自動變江戶」—— 單一時代是使用者的硬選擇，贏過有衝突的
  // 釘選，那條契約有測試在守（"exclusive medieval beats bikini pin for era"）。
  // 我一度改了 chooseEra() 去讓 pin 贏，當場打破那條契約，已經還原。
  // 所以每個時代組合都必須自己宣告 era，按鈕按下去時由 UI 套進設定。
  const ERA_PRESETS = {
    samurai: "edo",
    ninja: "edo",
    oiran: "edo",
    knight: "medieval",
    gladiator: "ancient_greece",
    hanfu: "ancient_china",
    ballroom: "victorian",
  };
  const missing = [];
  const wrong = [];
  for (const [id, want] of Object.entries(ERA_PRESETS)) {
    const p = BUILTIN_PRESETS.find((x) => x.id === id);
    if (!p) {
      missing.push(id);
      continue;
    }
    if (!p.era) {
      missing.push(`${id} 沒有 era 欄位`);
      continue;
    }
    if (!p.era.includes(want)) wrong.push(`${id} era=${JSON.stringify(p.era)} 應含 ${want}`);
    // 宣告的時代下，釘選的字全都要是合法的
    const s2 = defaultSettings(data);
    s2.girl = true;
    s2.eras = [...p.era];
    let pinned = new Set();
    for (const t of p.tags) pinned = applyPin(lex, pinned, new Set(), t).pinned;
    let lost = 0;
    for (let i = 1; i <= 40; i++) {
      const h = tagsOf(drawOne(lex, s2, pinned, new Set(), mulberry32(i), i));
      if (!p.tags.every((t) => h.has(t))) lost += 1;
    }
    if (lost) wrong.push(`${id} 有 ${lost}/40 張把釘選的字弄丟了`);
  }
  eq("每個時代組合都宣告了 era", missing.length, 0);
  if (missing.length) console.error(`      ${missing.join("  ")}`);
  eq("時代組合宣告的時代正確，且釘選的字留得住", wrong.length, 0);
  if (wrong.length) console.error(`      ${wrong.join("  ")}`);
}

{
  // 色情模式關掉之後，畫面上不可以有任何情色的字。
  //
  // 規則寫對了和畫面乾淨是兩件事：補救邏輯（浴場補衣、上衣補下著）、implies、
  // bind 都可能從側門把東西塞回來。所以這裡測的是「實際抽出來的每一個字」，
  // 不是「規則涵蓋了幾個字」。
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  s.rating = "general";
  const leaks = new Map();
  let noTail = 0;
  let hadNsfw = 0;
  let total = 0;
  const kinds = new Set();
  for (const era of ERAS) {
    for (const heat of HEATS) {
      s.eras = [era];
      s.heats = [heat];
      for (let i = 1; i <= 40; i++) {
        const arr = drawOne(lex, s, new Set(), new Set(), mulberry32(i), i).positive.split(", ");
        total += 1;
        if (!arr.includes("sfw")) noTail += 1;
        if (arr.includes("nsfw") || arr.includes("explicit")) hadNsfw += 1;
        for (const t of arr) {
          kinds.add(t);
          const it = lex.byTag.get(t);
          if (it && sfwBlocked(it)) leaks.set(t, (leaks.get(t) || 0) + 1);
        }
      }
    }
  }
  ok("SFW 的取樣夠多，這條測試不是空轉", total >= 900 && kinds.size >= 300,
     `${total} 張，${kinds.size} 種字`);
  eq("SFW：正面不帶 nsfw/explicit", hadNsfw, 0);
  eq("SFW：正面帶著 sfw", noTail, 0);
  eq("SFW：沒有任何被擋的字漏出來", leaks.size, 0);
  if (leaks.size) console.error(`      漏出來的：${[...leaks.keys()].slice(0, 8).join("  ")}`);

  // 開著色情模式時，這些字本來就該抽得到 —— 不然上面等於測了個空殼。
  const s2 = defaultSettings(data);
  s2.girl = true;
  s2.heats = ["sex"];
  let sexy = 0;
  for (let i = 1; i <= 200; i++) {
    const arr = drawOne(lex, s2, new Set(), new Set(), mulberry32(i), i).positive.split(", ");
    if (arr.some((t) => { const it = lex.byTag.get(t); return it && sfwBlocked(it); })) sexy += 1;
  }
  ok("色情模式開著時，那些字抽得到（證明上面擋的是真的有在擋）", sexy > 150,
     `${sexy}/200`);

  // 釘選會繞過 allow()，所以光擋 allow() 不夠：關掉色情模式之前釘的 nude
  // 會原封不動留在圖上。這條測的是「連釘選都擋得住」。
  const sPin = defaultSettings(data);
  sPin.girl = true;
  sPin.rating = "general";
  const stuck = [];
  const goneWhenOn = [];
  for (const tag of ["nude", "completely nude", "sex", "nipples", "bra"]) {
    if (!lex.byTag.has(tag)) continue;
    const pin = applyPin(lex, new Set(), new Set(), tag).pinned;
    let got = 0;
    for (let i = 1; i <= 40; i++) {
      if (tagsOf(drawOne(lex, sPin, pin, new Set(), mulberry32(i), i)).has(tag)) got += 1;
    }
    if (got) stuck.push(`${tag} ${got}/40`);
    // 反過來：色情模式開著時，同樣的釘選一定要留得住，否則是把功能弄壞了
    const sOn = defaultSettings(data);
    sOn.girl = true;
    let kept = 0;
    for (let i = 1; i <= 40; i++) {
      if (tagsOf(drawOne(lex, sOn, pin, new Set(), mulberry32(i), i)).has(tag)) kept += 1;
    }
    if (kept < 40) goneWhenOn.push(`${tag} 只留住 ${kept}/40`);
  }
  eq("SFW：連釘選的情色字也要擋掉", stuck.length, 0);
  if (stuck.length) console.error(`      ${stuck.join("  ")}`);
  eq("色情模式開著時，釘選照常生效（沒有被誤傷）", goneWhenOn.length, 0);
  if (goneWhenOn.length) console.error(`      ${goneWhenOn.join("  ")}`);
}

{
  // 正常模式說「不抽男人人種」，那就一個都不能有。
  //
  // 這條規則本來寫成 `item.mutex === "race"`，但 monster boy 是那一組的傘狀父標籤
  // （goblin 等等 implies 它），它的 mutex 是 null —— 於是從規則旁邊溜過去，
  // 正常模式每 800 張還是會冒出 41 個光禿禿的「怪物男」。
  const s = defaultSettings(data);
  s.girl = false;
  s.boy = true;
  s.heats = ["tease", "flash", "sex"];
  s.sceneMode = "normal";
  const leaked = new Map();
  for (let i = 1; i <= 400; i++) {
    for (const t of tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i))) {
      if (lex.byTag.get(t)?.group === "race") leaked.set(t, (leaked.get(t) || 0) + 1);
    }
  }
  eq("正常模式一個男人人種都不抽（含傘狀的 monster boy）", leaked.size, 0);
  if (leaked.size) console.error(`      漏出來的：${[...leaked.keys()].join(" ")}`);

  // 反面：多元模式本來就該抽得到，而且要有多樣性，否則上面等於測了個空殼。
  const sD = { ...s, sceneMode: "diverse" };
  const kinds = new Set();
  for (let i = 1; i <= 400; i++) {
    for (const t of tagsOf(drawOne(lex, sD, new Set(), new Set(), mulberry32(i), i))) {
      if (lex.byTag.get(t)?.group === "race") kinds.add(t);
    }
  }
  ok("多元模式抽得到人種，而且不只一兩種", kinds.size >= 15, `${kinds.size} 種`);

  // 使用者自己釘的仍然算數 —— 這條規則有 !pinned 的例外，不能被我改掉。
  const pin = applyPin(lex, new Set(), new Set(), "goblin").pinned;
  let kept = 0;
  for (let i = 1; i <= 40; i++) {
    if (tagsOf(drawOne(lex, s, pin, new Set(), mulberry32(i), i)).has("goblin")) kept += 1;
  }
  eq("正常模式下釘選的人種仍然留得住", kept, 40);
}

{
  // 「同一個人」：一批圖裡的身分特徵要剛好等於第一張那一組。
  //
  // 以前只有 identityPins()，把第一張抽到的釘起來 —— 第一張「沒有」的欄位在後面
  // 幾張仍然空著可以自由補，於是第三張突然多了一撮呆毛、一個馬尾，或整個人變得
  // 肌肉發達。實測 960 批裡有 685 批會漂移，而且第一張的特徵一次都沒掉：
  // 問題從頭到尾是「多出來」，不是「少掉」。
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = false;
  s.samePerson = true;
  let batches = 0;
  let lost = 0;
  let gained = 0;
  let clothMoved = 0;
  const examples = [];
  for (const era of ERAS) {
    s.eras = [era];
    for (let b = 0; b < 12; b++) {
      batches += 1;
      let ident = new Set();
      let identBan = new Set();
      let first = null;
      const cloth = new Set();
      for (let i = 0; i < 5; i++) {
        const seed = b * 1000 + i + 1;
        const d = drawOne(
          lex, s,
          ident.size ? new Set([...ident]) : new Set(),
          identBan.size ? new Set([...identBan]) : new Set(),
          mulberry32(seed), seed
        );
        const arr = d.positive.split(", ");
        cloth.add(arr.filter((t) => lex.byTag.get(t)?.section === "clothing").join("|"));
        const mine = new Set(arr.filter((t) => isIdentityItem(lex.byTag.get(t))));
        if (i === 0) {
          ident = identityPins(lex, d.positive);
          identBan = identityBans(lex, d.positive);
          first = mine;
          continue;
        }
        for (const t of first) if (!mine.has(t)) lost += 1;
        for (const t of mine) {
          if (!first.has(t)) {
            gained += 1;
            if (examples.length < 4) examples.push(`${era} 批 ${b} 第 ${i + 1} 張多了 ${t}`);
          }
        }
      }
      if (cloth.size > 1) clothMoved += 1;
    }
  }
  ok("同一個人的取樣夠多，這條測試不是空轉", batches >= 60, `${batches} 批`);
  eq("同一個人：第一張的身分特徵一個都不能掉", lost, 0);
  eq("同一個人：後面幾張不能多出新的身分特徵", gained, 0);
  if (gained) console.error(`      ${examples.join("  ")}`);
  // 反面：鎖的是人不是場景，衣服還是要照抽，否則等於把功能鎖死了
  eq("同一個人：衣服仍然每批都有變化", clothMoved, batches);
}

{
  // 只勾「活動」時，畫面上寫的是日常，沒有走光或做愛。
  //
  // 浴場補救那一段（服裝先於場地決定，場地選到浴場之後衣服被掃掉，這裡再補一件）
  // 的池子裡含裸標 —— 於是只勾活動的 3000 張裡會漏出兩張全裸。有衣服可穿就該
  // 穿衣服，真的一件都沒有才退回裸標，否則浴場又會變回什麼都沒交代。
  const s = defaultSettings(data);
  s.girl = true;
  s.boy = true;
  s.heats = ["activity"];
  const BATH = new Set([
    "bath", "bathtub", "bathing", "onsen", "shower", "shower (place)",
    "bathhouse", "ofuro", "bubble bath",
  ]);
  let skin = 0;
  let bath = 0;
  let bare = 0;
  let total = 0;
  for (const era of ERAS) {
    s.eras = [era];
    for (let i = 1; i <= 200; i++) {
      const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
      total += 1;
      if ([...h].some((t) => lex.byTag.get(t)?.layer === "skin")) skin += 1;
      if ([...h].some((t) => BATH.has(t))) {
        bath += 1;
        const stated = [...h].some((t) => {
          const it = lex.byTag.get(t);
          return it && it.section === "clothing" && (it.layer === "skin" || it.layer === "garment");
        });
        if (!stated) bare += 1;
      }
    }
  }
  ok("活動尺度的取樣夠多，這條測試不是空轉", total >= 1000 && bath >= 30,
     `${total} 張，浴場 ${bath}`);
  eq("只勾活動時不會有裸標", skin, 0);
  eq("只勾活動時浴場仍然交代得出身體（沒有為了不裸而留白）", bare, 0);

  // 反面：走光與性愛本來就該抽得到裸標，否則上面等於把功能關掉了
  const sSex = defaultSettings(data);
  sSex.girl = true;
  sSex.heats = ["sex"];
  let sexSkin = 0;
  for (let i = 1; i <= 300; i++) {
    if ([...tagsOf(drawOne(lex, sSex, new Set(), new Set(), mulberry32(i), i))]
      .some((t) => lex.byTag.get(t)?.layer === "skin")) sexSkin += 1;
  }
  ok("性愛尺度仍然抽得到裸標（證明上面擋的是真的有在擋）", sexSkin > 80, `${sexSkin}/300`);
}

{
  // 三段分級：每一段都不能漏出該段不該有的字，而且下一段要真的比上一段寬。
  const leaks = {};
  const kinds = {};
  for (const rating of RATINGS) {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = true;
    s.rating = rating;
    const bad = new Set();
    const seen = new Set();
    for (const era of ERAS) {
      for (const heat of HEATS) {
        s.eras = [era];
        s.heats = [heat];
        for (let i = 1; i <= 25; i++) {
          for (const t of tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i))) {
            seen.add(t);
            if (ratingBlocked(lex.byTag.get(t), rating)) bad.add(t);
          }
        }
      }
    }
    leaks[rating] = bad;
    kinds[rating] = seen.size;
  }
  for (const rating of RATINGS) {
    eq(`分級 ${rating}：沒有該級不該有的字漏出來`, leaks[rating].size, 0);
    if (leaks[rating].size) console.error(`      ${[...leaks[rating]].slice(0, 6).join("  ")}`);
  }
  // 階梯要真的是階梯，不是三個一樣的東西
  ok("分級是階梯：敏感比全年齡寬", kinds.sensitive > kinds.general,
     `general=${kinds.general} sensitive=${kinds.sensitive}`);
  ok("分級是階梯：色情比敏感寬", kinds.explicit > kinds.sensitive,
     `sensitive=${kinds.sensitive} explicit=${kinds.explicit}`);

  // 界線要照使用者定的走：敏感＝性感但不露、不做愛、不內衣、不走光
  const line = [
    ["bent over", "sensitive"], ["cleavage", "sensitive"], ["straddling", "sensitive"],
    ["microskirt", "sensitive"], ["fishnet thighhighs", "sensitive"],
    ["nude", "explicit"], ["sex", "explicit"], ["bra", "explicit"],
    ["panties", "explicit"], ["skirt lift", "explicit"], ["upskirt", "explicit"],
    ["ejaculation", "explicit"], ["cumdrip", "explicit"], ["nipples", "explicit"],
  ];
  const wrong = [];
  // 字不在詞庫就**紅**，不要靜默跳過 —— 原本是 `if (!it) continue;`，
  // 於是 2026-09-18 移除 pink nipples 之後這一條就無聲少掉一個案例，
  // 測試縮水而沒有人會發現。這跟 kiss/undefined 那條是同一種病。
  for (const [tag] of line) {
    if (!lex.byTag.get(tag)) wrong.push(`${tag} 不在詞庫（這條界線案例失效了）`);
  }
  for (const [tag, firstAllowed] of line) {
    const it = lex.byTag.get(tag);
    if (!it) continue;
    if (ratingBlocked(it, "explicit")) wrong.push(`${tag} 在色情也被擋`);
    if (firstAllowed === "sensitive" && ratingBlocked(it, "sensitive")) {
      wrong.push(`${tag} 應該在敏感可用`);
    }
    if (firstAllowed === "explicit" && !ratingBlocked(it, "sensitive")) {
      wrong.push(`${tag} 不該在敏感出現`);
    }
    if (!ratingBlocked(it, "general")) wrong.push(`${tag} 不該在全年齡出現`);
  }
  eq("分級界線符合設定（敏感＝穿著衣服的性感）", wrong.length, 0);
  if (wrong.length) console.error(`      ${wrong.join("  ")}`);

  // 舊存檔相容：以前存的是布林 sfw
  eq("舊存檔 sfw:true 對應到全年齡", sanitizeSettings({ sfw: true }, data).rating, "general");
  eq("舊存檔 sfw:false 對應到色情", sanitizeSettings({ sfw: false }, data).rating, "explicit");
}

// 配件的場合規則。這一段是因為我自己把它改壞過兩次才補的：
//   第一版用黑名單 —— 沒列到的東西全部從洞裡走過去（溫泉戴拳擊手套）。
//   第二版把檢查寫進 allow() —— 那裡看到的 used 還沒有場地和活動，
//   於是 animal collar 86->0、leash 19->0、clipboard 15->0、handcuffs 14->0，
//   五個字直接變成永遠抽不到，而所有測試都是綠的。
// 所以這裡驗的是「規格」，不是分布：表從 engine.js import 進來，不抄第二份。
{
  let n = 0;
  const offenders = new Map();
  for (const mode of ["normal", "diverse", "weird"]) {
    for (const heat of ["activity", "tease", "flash", "sex"]) {
      for (const rating of ["general", "sensitive", "explicit"]) {
        for (let i = 1; i <= 60; i++) {
          const s = settings();
          s.girl = true;
          s.boy = true;
          s.sceneMode = mode;
          s.heats = [heat];
          s.rating = rating;
          const seed = i * 31 + heat.length;
          const have = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(seed), seed));
          n += 1;
          for (const [tag, need] of Object.entries(NEEDS_CONTEXT)) {
            if (!have.has(tag)) continue;
            if ([...have].some((t) => need.has(t))) continue;
            offenders.set(tag, (offenders.get(tag) || 0) + 1);
          }
        }
      }
    }
  }
  eq(`配件沒有場合就不該出現（${n} 張）`, offenders.size, 0);
  if (offenders.size) console.error(`      ${[...offenders].map(([t, c]) => `${t}:${c}`).join("  ")}`);

  // 反面：擋歸擋，不能擋到抽不到。釘住場合之後，配對的配件要真的拉得進來。
  const unreachable = [];
  for (const [ctx, acc] of CTX_PULLS_ACC) {
    if (!lex.byTag.has(ctx) || !lex.byTag.has(acc)) { unreachable.push(`${acc}（詞庫沒有）`); continue; }
    let pinned = applyPin(lex, new Set(), new Set(), ctx).pinned;
    // shoulder armor 只在中世紀有，釘 armor 不會把時代拉過去（既有行為），
    // 所以這裡把時代一起指定，驗的是「有場合就拉得到」而不是時代規則。
    const era = (lex.byTag.get(acc)?.era || []).filter((e) => e !== "any");
    let hit = 0;
    for (let i = 1; i <= 120; i++) {
      const s = settings();
      s.girl = true;
      s.boy = false;
      s.rating = "explicit";
      if (era.length) s.eras = era;
      if (tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(i * 13), i * 13)).has(acc)) hit += 1;
    }
    if (hit === 0) unreachable.push(`${acc}（釘了 ${ctx} 仍 0/120）`);
  }
  eq("釘住場合之後配對的配件抽得到", unreachable.length, 0);
  if (unreachable.length) console.error(`      ${unreachable.join("  ")}`);

  // 釘選永遠優先：使用者自己釘的配件不會被場合規則刪掉。
  let dropped = 0;
  for (const tag of Object.keys(NEEDS_CONTEXT)) {
    if (!lex.byTag.has(tag)) continue;
    const pinned = applyPin(lex, new Set(), new Set(), tag).pinned;
    for (let i = 1; i <= 40; i++) {
      const s = settings();
      s.girl = true;
      s.rating = "explicit";
      if (!tagsOf(drawOne(lex, s, pinned, new Set(), mulberry32(i * 7), i * 7)).has(tag)) dropped += 1;
    }
  }
  eq("釘選的配件不會被場合規則刪掉", dropped, 0);
}

// --- 分級是階梯 -------------------------------------------------------------
// 敏感擋掉的字，全年齡一定也要擋。以前兩層各用各的判準（敏感看名單、全年齡看字面
// regex），沒有任何東西保證這件事，於是 netorare / voyeurism / breastfeeding
// 在敏感被擋、全年齡卻放行 —— 實抽 2800 張全年齡的圖，netorare 47 次、voyeurism 72 次。
{
  const broken = data.tags.filter(
    (t) => ratingBlocked(t, "sensitive") && !ratingBlocked(t, "general")
  );
  eq("分級是階梯：敏感擋掉的全年齡一定也擋", broken.length, 0);
  if (broken.length) console.error(`      ${broken.slice(0, 6).map((t) => t.tag).join("、")}`);
  // 反面：階梯不能靠「全年齡把全部擋光」成立。
  const okInGeneral = data.tags.filter((t) => !ratingBlocked(t, "general"));
  ok("全年齡仍然有夠多的字可用（不是靠全擋來滿足階梯）", okInGeneral.length >= 900,
     `只剩 ${okInGeneral.length} 個`);
}

// --- 整套服裝的搭配 ---------------------------------------------------------
// 使用者回報：釘了軍服，圖裡卻是「military uniform, blue jacket, jacket」。
// 量過之後發現是整批的：女僕裝 92% 會疊外套、軍服／警服／西裝 75%、和服 35% 配襯衫。
{
  const by = new Map(data.tags.map((t) => [t.tag, t]));
  const outfitSettings = () => {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = false;
    s.rating = "explicit";
    s.sceneMode = "normal";
    return s;
  };
  let layered = 0;
  let lostPin = 0;
  for (const outfit of ["military uniform", "maid", "business suit", "police uniform"]) {
    const pin = applyPin(lex, new Set(), new Set(), outfit).pinned;
    for (let i = 1; i <= 80; i++) {
      const have = tagsOf(drawOne(lex, outfitSettings(), pin, new Set(), mulberry32(i * 31), i * 31));
      if (!have.has(outfit)) lostPin += 1;
      for (const t of have) {
        const it = by.get(t);
        if (it && it.group === "outer" && !pin.has(t)) layered += 1;
      }
    }
  }
  eq("整套制服不會再疊一件外套", layered, 0);
  eq("釘的制服本身不會被弄丟", lostPin, 0);

  // 時代服裝底下不塞別的時代的衣服 —— 但同時代的、以及 era:["any"] 的要留著。
  let wrongEra = 0;
  const kimonoPin = applyPin(lex, new Set(), new Set(), "kimono").pinned;
  for (let i = 1; i <= 200; i++) {
    const have = tagsOf(drawOne(lex, outfitSettings(), kimonoPin, new Set(), mulberry32(i * 17), i * 17));
    for (const t of have) {
      const it = by.get(t);
      if (!it || it.section !== "clothing" || it.layer !== "garment" || kimonoPin.has(t)) continue;
      const slot = it.mutex === "top" || it.mutex === "bottom" ? it.mutex
        : it.group === "outer" ? "outer" : null;
      if (!slot) continue;
      const eras = it.era || [];
      if (!eras.includes("any") && !eras.includes("edo")) wrongEra += 1;
    }
  }
  eq("和服底下不會出現別的時代的上下身衣服", wrongEra, 0);
  // 反面：era:["any"] 是「每個時代都能用」，不是「哪個時代都不屬於」。
  // 少了這一條，和服在場時 topless female / bottomless 會被一起擋掉，
  // 但「和服褪到腰間」是正常畫法。
  for (const t of ["topless female", "bottomless"]) {
    if (!lex.byTag.has(t)) continue;
    const both = applyPin(lex, applyPin(lex, new Set(), new Set(), "kimono").pinned, new Set(), t).pinned;
    let kept = 0;
    for (let i = 1; i <= 40; i++) {
      if (tagsOf(drawOne(lex, outfitSettings(), both, new Set(), mulberry32(i * 23), i * 23)).has(t)) kept += 1;
    }
    eq(`和服搭配 era:[any] 的「${t}」仍然成立`, kept, 40);
  }
}

// --- 看不見的內衣 -----------------------------------------------------------
// Danbooru 上標 panties 的意思是「畫面上看得見」。全身穿好、又沒有任何脫衣或裸露
// 動作，卻標著內衣，那是訓練集裡沒有的組合（實測釘女僕裝 100% 帶內衣，其中 31%
// 連一個脫衣動作都沒有）。
{
  const by = new Map(data.tags.map((t) => [t.tag, t]));
  const isUnder = (it) =>
    !!it && (it.mutex === "underwear_top" || it.mutex === "underwear_bottom" || it.group === "underwear");
  let ghost = 0;
  let n = 0;
  for (const heat of ["activity", "tease", "flash", "sex"]) {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = true;
    s.rating = "explicit";
    s.heats = [heat];
    for (let i = 1; i <= 250; i++) {
      const have = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i * 41 + heat.length), i * 41 + heat.length));
      n += 1;
      const items = [...have].map((t) => by.get(t)).filter(Boolean);
      const exposed = items.some(
        (it) => it.mutex === "clothes_action" || it.group === "flash" || it.group === "sex" || it.layer === "skin"
      );
      if (exposed) continue;
      const covered = items.some((it) => it.section === "clothing" && it.layer === "garment" && !isUnder(it) &&
        (it.mutex === "onepiece" || it.mutex === "bottom" || it.group === "onepiece" || it.group === "bottom"));
      if (!covered) continue;
      if (items.some(isUnder)) ghost += 1;
    }
  }
  eq(`穿好了又沒脫衣動作就不該標內衣（${n} 張）`, ghost, 0);

  // 反面一：只穿內衣的造型不能被這條規則抹掉。
  //
  // 「underwear only」有一個**別條規則**的合法例外：泡澡游泳會把內衣脫掉，
  // 而那個字的意思是「身上只有內衣」，內衣沒了它就是空話，所以 drawOne() 會把它
  // 整個拿掉（2026-09-19 加的，Danbooru 上 underwear only + bathing 只有 0.12%）。
  // 那跟這裡要守的「看不見的內衣」規則無關，所以這條改成：**留下來，或者是水景**，
  // 除此之外的任何理由消失都算紅。張數一格都沒放鬆 —— 40 張每一張都要合格。
  const WATER_SCENE = new Set([
    "bath", "bathtub", "bathing", "onsen", "shower (place)", "ofuro", "bathhouse",
    "sauna", "bubble bath", "showering", "hot spring", "washing hair", "shared bathing",
    "swimming", "diving", "pool", "underwater", "ocean", "beach", "poolside", "pool ladder",
  ]);
  for (const t of ["lingerie", "underwear only", "bra", "panties"]) {
    if (!lex.byTag.has(t)) continue;
    const pin = applyPin(lex, new Set(), new Set(), t).pinned;
    let ok40 = 0;
    let kept = 0;
    let excused = 0;
    for (let i = 1; i <= 40; i++) {
      const s = defaultSettings(data);
      s.girl = true;
      s.rating = "explicit";
      const have = tagsOf(drawOne(lex, s, pin, new Set(), mulberry32(i * 29), i * 29));
      if (have.has(t)) { kept += 1; ok40 += 1; continue; }
      if (t === "underwear only" && [...have].some((x) => WATER_SCENE.has(x))) {
        excused += 1;
        ok40 += 1;
      }
    }
    eq(`釘了「${t}」只會因為水景消失，不會被「看不見的內衣」規則刪掉`, ok40, 40);
    // 護欄：全部被「水景」放行掉的話上面那條就空過了。這個字要真的還留得住。
    ok(`釘了「${t}」大多數時候真的留著`, kept >= 30, `留 ${kept}/40、水景放行 ${excused}`);
  }

  // 反面二：兜襠布的 mutex 是 underwear_bottom，group 卻是 era。兩邊判準不一致時
  // 它會同時算「遮蔽物」和「該刪的內衣」，然後把自己刪掉 —— 中世紀浴場就變成
  // 沒有任何身體交代。這條守的是那個。
  if (lex.byTag.has("loincloth")) {
    const s = defaultSettings(data);
    s.girl = false;
    s.boy = true;
    s.heats = ["activity"];
    s.eras = ["medieval"];
    let bare = 0;
    let bath = 0;
    const BATH = new Set(["bath", "bathtub", "bathing", "onsen", "shower", "ofuro"]);
    for (let i = 1; i <= 400; i++) {
      const have = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i), i));
      if (![...have].some((t) => BATH.has(t))) continue;
      bath += 1;
      const stated = [...have].some((t) => {
        const it = lex.byTag.get(t);
        return it && it.section === "clothing" && (it.layer === "skin" || it.layer === "garment");
      });
      if (!stated) bare += 1;
    }
    ok("中世紀浴場的取樣夠多", bath >= 10, `只有 ${bath} 張`);
    eq("內衣規則不會把唯一的身體交代刪掉（兜襠布不會自己刪自己）", bare, 0);
  }
}

// --- 釘了會讓性愛抽不到的字，一定要出提示 -----------------------------------
// 使用者回報：色情＋正常＋性愛＋釘泳池，結果抽不到性愛。泳池本身沒問題（單釘泳池
// 是 100%），是釘選裡另外有個運動活動 —— 打球跟做愛不能同時發生，那是物理。
//
// 但當時 sleeping 會讓性愛歸零而且**完全沒有提示**，因為提示只看 mutex="activity"，
// 而 sleeping 是 body_pose。使用者只會看到「選了性愛卻一張都沒有」。
//
// 這條測試不信任任何手寫名單：它自己去跑，找出「釘下去會讓性愛歸零」的字，
// 再要求每一個都有提示。以後有人新增這種字，這裡會自己紅。
{
  const by = new Map(data.tags.map((t) => [t.tag, t]));
  const isSexTag = (t) => {
    const it = by.get(t);
    return !!it && (it.mutex === "sex_act" || it.group === "sex");
  };
  const sexRate = (pinnedSet, n) => {
    let hit = 0;
    for (let i = 1; i <= n; i++) {
      const s = defaultSettings(data);
      s.rating = "explicit";
      s.sceneMode = "normal";
      s.heats = ["sex"];
      s.weights = weightsForHeats(["sex"], lex.data.heatWeights);
      const have = tagsOf(drawOne(lex, s, pinnedSet, new Set(), mulberry32(i * 37), i * 37));
      if ([...have].some(isSexTag)) hit += 1;
    }
    return hit / n;
  };
  // 候選只掃 pose（活動與身體姿勢），其他段落不會擋性愛，掃全庫太慢。
  const candidates = data.tags.filter(
    (t) => t.section === "pose" && (t.mutex === "activity" || t.mutex === "body_pose")
  );
  const silent = [];
  let killers = 0;
  for (const t of candidates) {
    let pinnedSet;
    try { pinnedSet = applyPin(lex, new Set(), new Set(), t.tag).pinned; } catch { continue; }
    if (sexRate(pinnedSet, 16) > 0.05) continue;
    killers += 1;
    if (!sportHeatWarnings(lex, pinnedSet, ["sex"]).length) silent.push(t.tag);
  }
  ok("取樣夠多：真的有找到會擋性愛的字", killers >= 10, `只找到 ${killers} 個`);
  eq("會讓性愛抽不到的字，每一個都會出提示", silent.length, 0);
  if (silent.length) console.error(`      無聲歸零：${silent.join("、")}`);

  // 反面：泡在水裡的活動可以跟性愛並存，不能被誤報成阻擋。
  const wet = ["swimming", "diving", "bathing", "wading", "floating", "showering"];
  const wrong = wet.filter((t) => {
    if (!lex.byTag.has(t)) return false;
    return sportHeatWarnings(lex, applyPin(lex, new Set(), new Set(), t).pinned, ["sex"]).length > 0;
  });
  eq("泡在水裡的活動不會被誤報成擋住性愛", wrong.length, 0);
  if (wrong.length) console.error(`      被誤報：${wrong.join("、")}`);

  // 泳池 preset 本身不擋性愛 —— 使用者回報的那個組合要是好的。
  const poolPin = applyPresetTags(lex, BUILTIN_PRESETS.find((p) => p.id === "pool").tags, new Set());
  ok("釘泳池 preset 抽得到性愛", sexRate(poolPin, 40) > 0.8, "泳池本身不該擋性愛");
  eq("釘泳池 preset 不會出現「擋住性愛」的提示", sportHeatWarnings(lex, poolPin, ["sex"]).length, 0);
}

// --- hetero：一男一女又真的在做，就要標上 -----------------------------------
// Danbooru 上「1girl 1boy sex」有 98.9% 同時帶 hetero，而我們一直沒給 ——
// 因為 hetero 的 section 是 subject，而 drawOne() 刻意沒有 fill("subject")。
// 那個設計對「人數」是對的，卻把配對描述一起排除了。
{
  const by = new Map(data.tags.map((t) => [t.tag, t]));
  const isSexTag = (t) => {
    const it = by.get(t);
    return !!it && (it.mutex === "sex_act" || it.group === "sex");
  };
  // 用 engine 匯出的 FEMALE_COUNT / MALE_COUNT，不要自己寫一個正規表示式 ——
  // 人數字的清單只該有一份，手抄的那份會跟著詞庫長大而失準。
  const hasGirl = (arr) => arr.some((t) => FEMALE_COUNT.has(t));
  const hasBoy = (arr) => arr.some((t) => MALE_COUNT.has(t));

  let mixedSex = 0;
  let mixedSexTagged = 0;
  let wrongNoSex = 0;
  let wrongSameSex = 0;
  for (const [g, b] of [[true, false], [false, true], [true, true]]) {
    for (const heat of ["activity", "tease", "flash", "sex"]) {
      for (let i = 1; i <= 120; i++) {
        const s = defaultSettings(data);
        s.girl = g;
        s.boy = b;
        s.rating = "explicit";
        s.heats = [heat];
        const arr = [...tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i * 31 + heat.length), i * 31 + heat.length))];
        const mixed = hasGirl(arr) && hasBoy(arr);
        const sex = arr.some(isSexTag);
        const het = arr.includes("hetero");
        if (mixed && sex) {
          mixedSex += 1;
          if (het) mixedSexTagged += 1;
        } else if (het) {
          if (mixed) wrongNoSex += 1;
          else wrongSameSex += 1;
        }
      }
    }
  }
  ok("取樣夠多：真的抽到一男一女的性愛圖", mixedSex >= 30, `只有 ${mixedSex} 張`);
  eq("一男一女＋有性行為 -> 一定標 hetero", mixedSex - mixedSexTagged, 0);
  eq("沒有性行為就不標 hetero", wrongNoSex, 0);
  eq("同性或單人不標 hetero", wrongSameSex, 0);

  // yuri 不跟 hetero 一樣每張都補。Danbooru「2girls sex」只有 6.6% 帶 yuri。
  // 完全不抽又只剩釘選，所以多女、沒有男生時大約一成，而且用另一條亂數。
  // 上限守的是「不會變成每一張都有」。
  let yuriAuto = 0;
  let yuriSolo = 0;
  let yuriWithBoy = 0;
  for (let i = 1; i <= 400; i++) {
    const s = defaultSettings(data);
    s.girl = true;
    s.boy = false;
    s.rating = "explicit";
    s.heats = ["sex"];
    const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(i * 17), i * 17));
    if (!h.has("yuri")) continue;
    yuriAuto += 1;
    const girls = h.has("4girls") ? 4 : h.has("3girls") ? 3 : h.has("2girls") ? 2 : h.has("1girl") ? 1 : 0;
    if (girls < 2) yuriSolo += 1;
    if (h.has("1boy") || h.has("2boys") || h.has("3boys")) yuriWithBoy += 1;
  }
  ok("多女性愛抽得到百合，但不是每張都有", yuriAuto > 0 && yuriAuto <= 40, `yuri=${yuriAuto}`);
  eq("百合不會補在單人身上", yuriSolo, 0);
  eq("這批百合抽樣沒有男生", yuriWithBoy, 0);
}

// --- 新詞：鏡頭、保險套、粗暴 ------------------------------------------------
// 鳥瞰／貼地仰視跟俯視／仰視是父子，同一格可以並存。未拆的保險套可以同時在，
// 套上與用過不行。勒頸四個只留一個。事後不跟進行中的粗暴疊，掌痕可以留下。
{
  const needsBoth = (tag) => {
    const it = lex.byTag.get(tag);
    const needs = it && it.needs ? it.needs : [];
    return needs.includes("male") && needs.includes("female") && needs.includes("pair");
  };
  const bird = lex.byTag.get("bird's eye view");
  const worm = lex.byTag.get("worm's eye view");
  ok("bird's eye view implies from above", !!(bird && (bird.implies || []).includes("from above")));
  eq("bird's eye view shares the camera slot", bird && bird.mutex, "camera");
  ok("worm's eye view implies from below", !!(worm && (worm.implies || []).includes("from below")));
  eq("worm's eye view shares the camera slot", worm && worm.mutex, "camera");
  eq("bird's eye and from above are not a camera clash", contradictions(lex, ["bird's eye view", "from above"]).length, 0);
  ok(
    "bird's eye and worm's eye clash as two cameras",
    contradictions(lex, ["bird's eye view", "worm's eye view"]).some((row) => row[0] === "camera")
  );
  eq("wide shot stays a camera", lex.byTag.get("wide shot") && lex.byTag.get("wide shot").mutex, "camera");
  eq("looking up stays a gaze", lex.byTag.get("looking up") && lex.byTag.get("looking up").mutex, "gaze");
  const silly = lex.byTag.get("fucked silly");
  ok("fucked silly does not imply sex", !!silly && !(silly.implies || []).includes("sex"));
  eq("fucked silly stays sex-heat", JSON.stringify(silly && silly.heat), JSON.stringify(["sex"]));
  const cum = lex.byTag.get("excessive cum");
  ok(
    "excessive cum still needs a man and a woman",
    !!(cum && (cum.needs || []).includes("male") && (cum.needs || []).includes("female"))
  );

  const usedCondom = lex.byTag.get("used condom");
  eq("used condom is sex-heat only", JSON.stringify(usedCondom && usedCondom.heat), JSON.stringify(["sex"]));
  ok("used condom still implies condom", !!(usedCondom && (usedCondom.implies || []).includes("condom")));
  ok("plain condom stays drawable at tease", (lex.byTag.get("condom").heat || []).includes("tease"));
  const onPenis = lex.byTag.get("condom on penis");
  ok(
    "condom on penis stays the existing during-state and does not imply penis",
    !!(onPenis && onPenis.section === "feature" && (onPenis.implies || []).includes("condom") && !(onPenis.implies || []).includes("penis") && (onPenis.heat || []).includes("flash") && (onPenis.heat || []).includes("sex"))
  );
  ok(
    "condom on penis needs a man, not a woman",
    !!(onPenis && (onPenis.needs || []).includes("male") && !(onPenis.needs || []).includes("female"))
  );
  ok("condom box does not imply condom", !(lex.byTag.get("condom box").implies || []).includes("condom"));

  const couple = [
    "rape",
    "after rape",
    "rough sex",
    "strangling",
    "neck grab",
    "headlock",
    "rear naked choke",
    "asphyxiation",
    "slap mark",
  ];
  for (const tag of couple) {
    const it = lex.byTag.get(tag);
    ok(`${tag} is in the lexicon`, !!it);
    eq(`${tag} is sex-heat only`, JSON.stringify(it && it.heat), JSON.stringify(["sex"]));
    ok(`${tag} needs a man and a woman`, needsBoth(tag));
    eq(`${tag} is not a sex-act slot`, it && it.mutex, null);
  }

  const sex = defaultSettings(data);
  sex.girl = true;
  sex.boy = true;
  sex.heats = ["sex"];
  sex.weights = { activity: 0, tease: 0, flash: 0, sex: 1 };
  sex.eras = ["modern"];
  sex.sceneMode = "normal";
  sex.lockScene = true;
  sex.rating = "explicit";
  const neverWith = (pin, banned, n, seed0) => {
    const pinned = applyPin(lex, new Set(), new Set(), pin).pinned;
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const got = tagsOf(drawOne(lex, sex, pinned, new Set(), mulberry32(seed0 + i), seed0 + i));
      if (banned.some((tag) => got.has(tag))) hit += 1;
    }
    return hit;
  };
  const keptAll = (pins, banned, n, seed0) => {
    let pinned = new Set();
    for (const pin of pins) pinned = applyPin(lex, pinned, new Set(), pin).pinned;
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const got = tagsOf(drawOne(lex, sex, pinned, new Set(), mulberry32(seed0 + i), seed0 + i));
      if (pins.every((tag) => got.has(tag)) && !banned.some((tag) => got.has(tag))) hit += 1;
    }
    return hit;
  };

  eq("holding condom never with used condom", neverWith("holding condom", ["used condom"], 30, 151000), 0);
  eq("condom wrapper never with condom on penis", neverWith("condom wrapper", ["condom on penis"], 30, 151040), 0);
  eq(
    "unopened condom pieces stay together",
    keptAll(["holding condom", "condom wrapper", "condom box"], ["used condom", "condom on penis"], 20, 151080),
    20
  );
  eq("condom in mouth never with closed mouth", neverWith("closed mouth", ["condom in mouth"], 30, 151120), 0);
  eq("holding condom never with boxing gloves", neverWith("boxing gloves", ["holding condom"], 20, 151160), 0);
  eq(
    "two grips never together",
    neverWith("strangling", ["neck grab", "headlock", "rear naked choke"], 40, 151200),
    0
  );
  eq(
    "after rape never with rough sex, a grip, or asphyxiation",
    neverWith("after rape", ["rough sex", "strangling", "neck grab", "headlock", "rear naked choke", "asphyxiation"], 40, 151260),
    0
  );
  eq(
    "after rape can keep a slap mark and a bedroom",
    keptAll(["after rape", "slap mark", "bedroom"], ["strangling", "rough sex"], 20, 151320),
    20
  );
  eq("pinned bird's eye never also draws worm's eye", neverWith("bird's eye view", ["worm's eye view"], 20, 151360), 0);
  ok("pinning bird's eye view keeps from above", applyPin(lex, new Set(), new Set(), "bird's eye view").pinned.has("from above"));

  const girl = defaultSettings(data);
  girl.girl = true;
  girl.boy = false;
  girl.heats = ["sex"];
  girl.rating = "explicit";
  let leak = 0;
  for (let i = 0; i < 60; i++) {
    const got = tagsOf(drawOne(lex, girl, new Set(), new Set(), mulberry32(152000 + i), 152000 + i));
    if (couple.some((tag) => got.has(tag))) leak += 1;
  }
  eq("girl-only sex never draws the rough family", leak, 0);

  const tease = defaultSettings(data);
  tease.girl = true;
  tease.boy = true;
  tease.heats = ["tease"];
  let teaseHit = 0;
  const sexOnly = couple.concat(["used condom", "holding condom", "condom on penis", "condom wrapper", "condom box", "condom in mouth"]);
  for (let i = 0; i < 40; i++) {
    const got = tagsOf(drawOne(lex, tease, new Set(), new Set(), mulberry32(152200 + i), 152200 + i));
    if (sexOnly.some((tag) => got.has(tag))) teaseHit += 1;
  }
  eq("tease never draws sex-only condom or rough tags", teaseHit, 0);

  const pinRape = applyPin(lex, new Set(), new Set(), "rape").pinned;
  let rapeNoBoy = 0;
  for (let i = 0; i < 20; i++) {
    const got = tagsOf(drawOne(lex, girl, pinRape, new Set(), mulberry32(153000 + i), 153000 + i));
    if (got.has("rape") && !got.has("1boy") && !got.has("2boys") && !got.has("3boys")) rapeNoBoy += 1;
  }
  eq("pinned rape brings a man even when the boy switch is off", rapeNoBoy, 0);
}

// --- 職業與服裝 -------------------------------------------------------------
// 髮帶和髮箍不佔頭飾格，彼此只留一個，可以跟貝雷帽同時在。
// 女巫帶出女巫帽。廚師不帶出廚師帽，場地是廚房或餐廳。
{
  const ribbon = lex.byTag.get("hair ribbon");
  const band = lex.byTag.get("hairband");
  const witch = lex.byTag.get("witch");
  const chef = lex.byTag.get("chef");
  eq("hair ribbon does not take the hat slot", ribbon && ribbon.mutex, "hair_acc");
  eq("hairband shares that slot", band && band.mutex, "hair_acc");
  ok("hair ribbon and hairband clash", contradictions(lex, ["hair ribbon", "hairband"]).length > 0);
  ok("a hair ribbon can sit with a beret", contradictions(lex, ["hair ribbon", "beret"]).length === 0);
  ok("witch implies witch hat", !!(witch && (witch.implies || []).includes("witch hat")));
  ok("witch hat implies hat", (lex.byTag.get("witch hat").implies || []).includes("hat"));
  ok("witch hat stays in the witch eras", JSON.stringify(lex.byTag.get("witch hat").era) === JSON.stringify(["medieval", "victorian"]));
  ok("fingerless gloves imply gloves", (lex.byTag.get("fingerless gloves").implies || []).includes("gloves"));
  ok("fingerless gloves clash with boxing gloves", contradictions(lex, ["fingerless gloves", "boxing gloves"]).length > 0);
  const fur = lex.byTag.get("fur trim");
  ok("fur trim is a fabric detail and does not take the coat slot", !!(fur && fur.group === "fabric" && !fur.mutex));
  const girlOutfit = lex.byTag.get("magical girl");
  ok("magical girl is a female one-piece", !!(girlOutfit && girlOutfit.mutex === "onepiece" && girlOutfit.gate === "female"));
  ok("chef does not imply the hat", !(chef && (chef.implies || []).includes("chef hat")));
  ok("chef hat is headwear", lex.byTag.get("chef hat").mutex === "headwear");

  const plain = defaultSettings(data);
  let chefLeak = 0;
  for (let i = 0; i < 40; i++) {
    if (tagsOf(drawOne(lex, plain, new Set(), new Set(), mulberry32(154000 + i), 154000 + i)).has("chef")) chefLeak += 1;
  }
  eq("default draws do not pull the chef job", chefLeak, 0);

  const jobOn = defaultSettings(data);
  jobOn.drawJob = true;
  jobOn.eras = ["modern"];
  const pinChef = applyPin(lex, new Set(), new Set(), "chef").pinned;
  let badPlace = 0;
  let seen = 0;
  for (let i = 0; i < 20; i++) {
    const got = tagsOf(drawOne(lex, jobOn, pinChef, new Set(), mulberry32(154200 + i), 154200 + i));
    if (!got.has("chef")) continue;
    seen += 1;
    const place = [...got].find((t) => lex.byTag.get(t)?.mutex === "place");
    if (place && place !== "kitchen" && place !== "restaurant") badPlace += 1;
  }
  ok("pinned chef was drawn", seen > 0);
  eq("pinned chef stays in a kitchen or a restaurant", badPlace, 0);
}

// --- 走路、髮型、受孕 -------------------------------------------------------
// 半扎不佔髮型格，可以跟馬尾同時在。跑步不進浴室。
// 立乳和穴口滴精已從詞庫拿掉。抓手腕的現役名是 holding another's wrist。
{
  const half = lex.byTag.get("half updo");
  const braid = lex.byTag.get("single braid");
  const band = lex.byTag.get("low twintails");
  const intakes = lex.byTag.get("hair intakes");
  ok("half updo does not take the hairstyle slot", !!(half && !half.mutex));
  ok("a half updo can sit with a ponytail", contradictions(lex, ["half updo", "ponytail"]).length === 0);
  ok("hair intakes can sit with a ponytail", contradictions(lex, ["hair intakes", "ponytail"]).length === 0);
  ok("single braid implies braid", !!(braid && (braid.implies || []).includes("braid")));
  ok("single braid clashes with twintails", contradictions(lex, ["single braid", "twintails"]).length > 0);
  ok("single braid can sit with braid", contradictions(lex, ["single braid", "braid"]).length === 0);
  ok("low twintails imply twintails", !!(band && (band.implies || []).includes("twintails")));
  ok("walking shares the standing slot", lex.byTag.get("walking").mutex === "body_pose");
  ok("running clashes with sitting", contradictions(lex, ["running", "sitting"]).length > 0);
  ok("jumping clashes with lying", contradictions(lex, ["jumping", "lying"]).length > 0);
  const needsCouple = (item) => {
    const needs = item && item.needs ? item.needs : [];
    return needs.includes("pair") && needs.includes("male") && needs.includes("female");
  };
  const preg = lex.byTag.get("impregnation");
  ok("impregnation does not imply pregnant", !(preg && (preg.implies || []).includes("pregnant")));
  ok("impregnation needs a man and a woman", needsCouple(preg));
  ok("cumdrip from pussy is not a tag", !lex.byTag.has("cumdrip from pussy"));
  ok("erect nipples is not a tag", !lex.byTag.has("erect nipples"));
  ok("wrist grab is not a tag", !lex.byTag.has("wrist grab"));
  const wrist = lex.byTag.get("holding another's wrist");
  ok("holding another's wrist is not one of the neck grips", needsCouple(wrist));
  ok("holding another's wrist can sit with strangling", contradictions(lex, ["holding another's wrist", "strangling"]).length === 0);
  ok("panties around one leg take the panty slot", lex.byTag.get("panties around one leg").mutex === "underwear_bottom");
  ok("knee boots do not imply boots", !(lex.byTag.get("knee boots").implies || []).includes("boots"));
  ok("plaid skirt implies skirt", (lex.byTag.get("plaid skirt").implies || []).includes("skirt"));

  const teaseOnly = defaultSettings(data);
  teaseOnly.heats = ["tease"];

  const girl = defaultSettings(data);
  girl.girl = true;
  girl.boy = false;
  girl.heats = ["sex"];
  let pairLeak = 0;
  for (let i = 0; i < 60; i++) {
    const got = tagsOf(drawOne(lex, girl, new Set(), new Set(), mulberry32(155200 + i), 155200 + i));
    if (got.has("impregnation") || got.has("holding another's wrist")) pairLeak += 1;
  }
  eq("girl-only sex never draws impregnation or a wrist hold", pairLeak, 0);

  const hasBoy = (got) => got.has("1boy") || got.has("2boys") || got.has("3boys");
  const hasGirl = (got) => got.has("1girl") || got.has("2girls") || got.has("3girls") || got.has("4girls") || got.has("5girls");
  const pinWrist = applyPin(lex, new Set(), new Set(), "holding another's wrist").pinned;
  const pinPreg = applyPin(lex, new Set(), new Set(), "impregnation").pinned;
  let wristSeen = 0;
  let wristNoBoy = 0;
  let pregSeen = 0;
  let pregNoBoy = 0;
  for (let i = 0; i < 20; i++) {
    const gotW = tagsOf(drawOne(lex, girl, pinWrist, new Set(), mulberry32(155500 + i), 155500 + i));
    if (gotW.has("holding another's wrist")) {
      wristSeen += 1;
      if (!hasBoy(gotW) || !hasGirl(gotW)) wristNoBoy += 1;
    }
    const gotP = tagsOf(drawOne(lex, girl, pinPreg, new Set(), mulberry32(155600 + i), 155600 + i));
    if (gotP.has("impregnation")) {
      pregSeen += 1;
      if (!hasBoy(gotP) || !hasGirl(gotP)) pregNoBoy += 1;
    }
  }
  ok("pinned holding another's wrist was drawn with the boy switch off", wristSeen > 0);
  eq("pinned holding another's wrist brings a man and a woman", wristNoBoy, 0);
  ok("pinned impregnation was drawn with the boy switch off", pregSeen > 0);
  eq("pinned impregnation brings a man and a woman", pregNoBoy, 0);

  const bath = applyPin(lex, new Set(), new Set(), "bathroom").pinned;
  let sprint = 0;
  for (let i = 0; i < 80; i++) {
    const got = tagsOf(drawOne(lex, teaseOnly, bath, new Set(), mulberry32(155400 + i), 155400 + i));
    if (got.has("running") || got.has("jumping")) sprint += 1;
  }
  eq("running and jumping stay out of a bathroom", sprint, 0);

  const both = applyPin(lex, bath, new Set(), "running").pinned;
  const kept = tagsOf(drawOne(lex, teaseOnly, both, new Set(), mulberry32(155480), 155480));
  ok("pinned running stays in a pinned bathroom", kept.has("running") && kept.has("bathroom"));
}

// --- 第三輪：馬尾、表情、衣服、前提 -----------------------------------------
{
  const implies = (tag) => lex.byTag.get(tag).implies || [];
  const needsCouple = (item) => {
    const needs = item && item.needs ? item.needs : [];
    return needs.includes("pair") && needs.includes("male") && needs.includes("female");
  };
  for (const tag of ["low ponytail", "braided ponytail", "folded ponytail"]) {
    ok(`${tag} implies ponytail and not braid`, implies(tag).includes("ponytail") && !implies(tag).includes("braid"));
    ok(`${tag} can sit with ponytail`, contradictions(lex, [tag, "ponytail"]).length === 0);
    ok(`${tag} clashes with twintails`, contradictions(lex, [tag, "twintails"]).length > 0);
  }
  ok("grin does not imply smile", !implies("grin").includes("smile"));
  ok("grin clashes with smile", contradictions(lex, ["grin", "smile"]).length > 0);
  ok("tearing up implies tears and not crying", implies("tearing up").includes("tears") && !implies("tearing up").includes("crying"));
  ok("tearing up clashes with crying", contradictions(lex, ["tearing up", "crying"]).length > 0);
  ok("tearing up can sit with tears", contradictions(lex, ["tearing up", "tears"]).length === 0);
  ok("turtleneck does not imply sweater", !implies("turtleneck").includes("sweater"));
  ok("turtleneck clashes with a turtleneck sweater", contradictions(lex, ["turtleneck", "turtleneck sweater"]).length > 0);
  ok("hairclip clashes with a hair ribbon", contradictions(lex, ["hairclip", "hair ribbon"]).length > 0);
  ok("headphones do not imply a hat", !implies("headphones").includes("hat"));
  ok("headphones clash with a sun hat", contradictions(lex, ["headphones", "sun hat"]).length > 0);
  ok("sun hat implies hat", implies("sun hat").includes("hat"));
  ok("sun hat can sit with hat", contradictions(lex, ["sun hat", "hat"]).length === 0);
  ok("wrist cuffs do not imply handcuffs", !implies("wrist cuffs").includes("handcuffs"));
  ok("tiptoes imply standing", implies("tiptoes").includes("standing"));
  ok("tiptoes can sit with standing", contradictions(lex, ["tiptoes", "standing"]).length === 0);
  ok("standing split clashes with sitting", contradictions(lex, ["standing split", "sitting"]).length > 0);
  ok("cleft of venus stays in flash and sex", JSON.stringify(lex.byTag.get("cleft of venus").heat) === JSON.stringify(["flash", "sex"]));
  ok("cleft of venus is a female body feature", lex.byTag.get("cleft of venus").group === "body_f");
  ok("cleft of venus does not imply pussy", !implies("cleft of venus").includes("pussy"));
  ok("covering privates stay in flash and sex", JSON.stringify(lex.byTag.get("covering privates").heat) === JSON.stringify(["flash", "sex"]));
  ok("covering privates do not imply nude", !implies("covering privates").includes("nude"));
  const head = lex.byTag.get("hand on another's head");
  const hair = lex.byTag.get("grabbing another's hair");
  ok("a hand on her head needs a man and a woman", needsCouple(head));
  ok("grabbing her hair needs a man and a woman", needsCouple(hair));
  ok("grabbing her hair is sex only", JSON.stringify(hair.heat) === JSON.stringify(["sex"]));
  ok("a hand on her head is not a neck grip", contradictions(lex, ["hand on another's head", "strangling"]).length === 0);
  ok("skindentation does not imply thighhighs", !implies("skindentation").includes("thighhighs"));
  ok("hood up does not imply hood", !implies("hood up").includes("hood"));

  const teaseOnly = defaultSettings(data);
  teaseOnly.heats = ["tease"];
  let teaseLeak = 0;
  for (let i = 0; i < 80; i++) {
    const got = tagsOf(drawOne(lex, teaseOnly, new Set(), new Set(), mulberry32(156000 + i), 156000 + i));
    if (got.has("cleft of venus") || got.has("covering privates") || got.has("grabbing another's hair")) teaseLeak += 1;
  }
  eq("tease never draws cleft, covering privates, or a hair grab", teaseLeak, 0);

  const girl = defaultSettings(data);
  girl.girl = true;
  girl.boy = false;
  girl.heats = ["sex"];
  let pairLeak = 0;
  let splitInSex = 0;
  for (let i = 0; i < 80; i++) {
    const got = tagsOf(drawOne(lex, girl, new Set(), new Set(), mulberry32(156200 + i), 156200 + i));
    if (got.has("hand on another's head") || got.has("grabbing another's hair")) pairLeak += 1;
    if (got.has("standing split")) splitInSex += 1;
  }
  eq("girl-only sex never draws a head pat or a hair grab", pairLeak, 0);
  eq("unpinned standing split stays out of sex", splitInSex, 0);

  const bed = applyPin(lex, new Set(), new Set(), "on bed").pinned;
  let uprightOnBed = 0;
  for (let i = 0; i < 40; i++) {
    const got = tagsOf(drawOne(lex, teaseOnly, bed, new Set(), mulberry32(156400 + i), 156400 + i));
    if (got.has("standing split") || got.has("tiptoes")) uprightOnBed += 1;
  }
  eq("standing split and tiptoes stay off a bed", uprightOnBed, 0);

  const pinToe = applyPin(lex, new Set(), new Set(), "tiptoes").pinned;
  const toe = tagsOf(drawOne(lex, teaseOnly, pinToe, new Set(), mulberry32(156850), 156850));
  ok("pinned tiptoes brings standing", toe.has("tiptoes") && toe.has("standing"));
  const pinSplit = applyPin(lex, new Set(), new Set(), "standing split").pinned;
  const split = tagsOf(drawOne(lex, girl, pinSplit, new Set(), mulberry32(156860), 156860));
  ok("pinned standing split stays in sex", split.has("standing split"));

  const pinShort = applyPin(lex, new Set(), new Set(), "short hair").pinned;
  let shortPony = 0;
  for (let i = 0; i < 40; i++) {
    const got = tagsOf(drawOne(lex, teaseOnly, pinShort, new Set(), mulberry32(156800 + i), 156800 + i));
    if (got.has("low ponytail") || got.has("braided ponytail") || got.has("folded ponytail")) shortPony += 1;
  }
  eq("short hair does not wear a ponytail variant", shortPony, 0);

  const pinRun = applyPin(lex, new Set(), new Set(), "running").pinned;
  let legWithRun = 0;
  for (let i = 0; i < 40; i++) {
    const got = tagsOf(drawOne(lex, teaseOnly, pinRun, new Set(), mulberry32(156500 + i), 156500 + i));
    if (got.has("running") && got.has("leg up")) legWithRun += 1;
  }
  eq("leg up stays off a pinned run", legWithRun, 0);

  const legwear = new Set(["thighhighs", "pantyhose", "kneehighs", "socks"]);
  const hoods = new Set(["hoodie", "hood", "hooded cloak"]);
  let indentBad = 0;
  let hoodBad = 0;
  const mixed = defaultSettings(data);
  for (let i = 0; i < 200; i++) {
    const got = tagsOf(drawOne(lex, mixed, new Set(), new Set(), mulberry32(156600 + i), 156600 + i));
    if (got.has("skindentation") && ![...legwear].some((t) => got.has(t))) indentBad += 1;
    if (got.has("hood up") && ![...hoods].some((t) => got.has(t))) hoodBad += 1;
  }
  eq("skindentation never appears without legwear", indentBad, 0);
  eq("hood up never appears without a hood garment", hoodBad, 0);

  const hasBoy = (got) => got.has("1boy") || got.has("2boys") || got.has("3boys");
  const hasGirl = (got) => got.has("1girl") || got.has("2girls") || got.has("3girls") || got.has("4girls") || got.has("5girls");
  const pinHead = applyPin(lex, new Set(), new Set(), "hand on another's head").pinned;
  const pinHair = applyPin(lex, new Set(), new Set(), "grabbing another's hair").pinned;
  let headSeen = 0;
  let headBad = 0;
  let hairSeen = 0;
  let hairBad = 0;
  for (let i = 0; i < 20; i++) {
    const gotH = tagsOf(drawOne(lex, girl, pinHead, new Set(), mulberry32(157000 + i), 157000 + i));
    if (gotH.has("hand on another's head")) {
      headSeen += 1;
      if (!hasBoy(gotH) || !hasGirl(gotH)) headBad += 1;
    }
    const gotR = tagsOf(drawOne(lex, girl, pinHair, new Set(), mulberry32(157100 + i), 157100 + i));
    if (gotR.has("grabbing another's hair")) {
      hairSeen += 1;
      if (!hasBoy(gotR) || !hasGirl(gotR)) hairBad += 1;
    }
  }
  ok("pinned hand on head was drawn with the boy switch off", headSeen > 0);
  eq("pinned hand on head brings a man and a woman", headBad, 0);
  ok("pinned hair grab was drawn with the boy switch off", hairSeen > 0);
  eq("pinned hair grab brings a man and a woman", hairBad, 0);
}

// --- 品質規則：未成年不輸出，怪組合為 0 ------------------------------------
{
  const upright = new Set(["standing", "walking", "running", "jumping", "standing split", "tiptoes"]);
  const full = new Set(["walking", "running", "jumping", "standing split", "tiptoes", "leg up"]);
  const half = new Set(["portrait", "upper body", "close-up", "face", "head out of frame"]);
  const wetOk = NEEDS_CONTEXT.wet;
  const monster = (tag, have) => {
    if (tag === "monster boy" || tag === "vampire" || tag === "dragon boy") return true;
    return (lex.byTag.get(tag)?.implies || []).includes("monster boy") && have.has(tag);
  };
  const bad = { loli: 0, shota: 0, wet: 0, swim: 0, bike: 0, dive: 0, float: 0, futon: 0, crop: 0, tusks: 0 };
  let n = 0;
  for (const cast of ["girl", "boy", "both"]) {
    for (const heat of ["tease", "flash", "sex"]) {
      for (let i = 0; i < 40; i++) {
        const s = settings();
        s.girl = cast !== "boy";
        s.boy = cast !== "girl";
        s.heats = [heat];
        s.eras = ["modern"];
        s.sceneMode = "normal";
        s.rating = "explicit";
        const seed = 880000 + n;
        const h = tagsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(seed), seed));
        n += 1;
        if (h.has("loli")) bad.loli += 1;
        if (h.has("shota")) bad.shota += 1;
        if (h.has("wet") && ![...h].some((t) => wetOk.has(t))) bad.wet += 1;
        if ((h.has("swimsuit") || h.has("bikini") || h.has("school swimsuit") || [...h].some((t) => t.includes("swimsuit") || t.includes("bikini"))) && h.has("snow")) bad.swim += 1;
        if (h.has("riding bicycle") && (h.has("walking") || h.has("running") || h.has("jumping"))) bad.bike += 1;
        if (h.has("diving") && (h.has("walking") || h.has("running") || h.has("standing split"))) bad.dive += 1;
        if (h.has("floating") && (h.has("walking") || h.has("running"))) bad.float += 1;
        if (h.has("futon") && [...h].some((t) => upright.has(t))) bad.futon += 1;
        if ([...h].some((t) => full.has(t)) && [...h].some((t) => half.has(t))) bad.crop += 1;
        if (h.has("tusks") && ![...h].some((t) => monster(t, h))) bad.tusks += 1;
      }
    }
  }
  for (const tag of ["loli", "shota"]) {
    const pin = applyPin(lex, new Set(), new Set(), tag).pinned;
    for (let i = 0; i < 40; i++) {
      const s = settings();
      s.girl = true;
      s.boy = true;
      s.heats = ["sex"];
      s.eras = ["modern"];
      s.rating = "explicit";
      const seed = 890000 + (tag === "loli" ? 0 : 100) + i;
      const h = tagsOf(drawOne(lex, s, pin, new Set(), mulberry32(seed), seed));
      if (h.has("loli")) bad.loli += 1;
      if (h.has("shota")) bad.shota += 1;
    }
  }
  eq(`品質規則九格各 40 張加釘選，怪組合是 0（${n} 張隨機）`, Object.values(bad).reduce((a, b) => a + b, 0), 0);
  if (Object.values(bad).some((v) => v)) console.error(`      ${JSON.stringify(bad)}`);
}

{
  // 角色類別（2026-10-10）：抽角色勾選、照人數性別抽、釘的角色補人數、有角色就不抽長相、系列名、characterBan。
  const s = settings();
  const charsOf = (p) => p.split(", ").filter((t) => isCharacter(lex.byTag.get(t)));
  let leak = 0;
  for (let i = 0; i < 400; i++) if (charsOf(drawOne(lex, s, new Set(), new Set(), mulberry32(930000 + i), 930000 + i).positive).length) leak += 1;
  eq("角色：抽角色關著（預設）不會隨機抽到角色", leak, 0);
  ok("角色：抽角色、加入系列名預設都關", s.drawCharacter === false && s.characterSeries === false);

  const on = { ...s, drawCharacter: true };
  const pin2g = applyPin(lex, new Set(), new Set(), "2girls").pinned;
  let rightCount = 0;
  let female = 0;
  for (let i = 0; i < 60; i++) {
    const d = drawOne(lex, on, pin2g, new Set(), mulberry32(931000 + i), 931000 + i);
    const cs = charsOf(d.positive);
    if (cs.length === 2) rightCount += 1;
    if (cs.every((t) => lex.byTag.get(t).gate === "female")) female += 1;
  }
  eq("角色：釘 2girls、抽角色打開：每張都是兩個角色", rightCount, 60);
  eq("角色：兩個女生抽到的都是女角色", female, 60);
  const pinBoy = applyPin(lex, new Set(), new Set(), "1boy").pinned;
  const sBoy = { ...on, girl: false, boy: true };
  const boyChars = charsOf(drawOne(lex, sBoy, pinBoy, new Set(), mulberry32(931500), 931500).positive);
  ok("角色：只有一個男生就抽一個男角色", boyChars.length === 1 && lex.byTag.get(boyChars[0]).gate === "male", boyChars.join());
  const pin5 = applyPin(lex, new Set(), new Set(), "5girls").pinned;
  const many = charsOf(drawOne(lex, on, pin5, new Set(), mulberry32(931600), 931600).positive);
  ok(`角色：五個女生最多抽 ${CHARACTER_MAX} 個角色`, many.length === CHARACTER_MAX, many.join(" + "));

  let pinC = applyPin(lex, new Set(), new Set(), "yor briar").pinned;
  pinC = applyPin(lex, pinC, new Set(), "makima (chainsaw man)").pinned;
  ok("角色：兩個女角色可以同時釘（角色之間不互斥）", pinC.has("yor briar") && pinC.has("makima (chainsaw man)"));
  let castOkN = 0;
  let lookLeak = 0;
  const LOOK = new Set(["hair_len", "hair_color", "hair_style", "eyes", "race"]);
  for (let i = 0; i < 80; i++) {
    const d = drawOne(lex, s, pinC, new Set(), mulberry32(932000 + i), 932000 + i);
    const tags = d.positive.split(", ");
    // 至少兩個女生（4% 的「五人圖」升級會變成 4girls 1boy，照樣成立）。
    const girls = ["2girls", "3girls", "4girls", "5girls", "6+girls"].some((t) => tags.includes(t));
    if (girls && tags.includes("yor briar") && tags.includes("makima (chainsaw man)")) castOkN += 1;
    if (tags.some((t) => { const it = lex.byTag.get(t); return it && (LOOK.has(it.group) || it.mutex === "breast_size" || it.sub === "nonhuman"); })) lookLeak += 1;
  }
  eq("角色：釘了約兒和瑪奇瑪（沒釘人數）：至少兩個女生、兩個都在", castOkN, 80);
  eq("角色：有角色就不再抽髮長、髮色、髮型、瞳色、人種、胸部大小、獸耳翅膀", lookLeak, 0);
  const pinRed = applyPin(lex, applyPin(lex, new Set(), new Set(), "yor briar").pinned, new Set(), "red hair").pinned;
  ok("角色：釘的髮色照留（使用者明講要換）", tagsOf(drawOne(lex, s, pinRed, new Set(), mulberry32(932500), 932500)).has("red hair"));

  const pinYor = applyPin(lex, new Set(), new Set(), "yor briar").pinned;
  const plain = drawOne(lex, s, pinYor, new Set(), mulberry32(933000), 933000).positive.split(", ");
  const withSeries = drawOne(lex, { ...s, characterSeries: true }, pinYor, new Set(), mulberry32(933000), 933000).positive.split(", ");
  ok("角色：加入系列名關著不送作品名", !plain.includes("spy x family"));
  ok("角色：加入系列名打開，作品名緊接在角色後面", withSeries[withSeries.indexOf("yor briar") + 1] === "spy x family", withSeries.slice(0, 6).join(", "));
  const pinTwo = applyPin(lex, pinYor, new Set(), "twilight (spy x family)").pinned;
  const twoSeries = drawOne(lex, { ...s, characterSeries: true }, pinTwo, new Set(), mulberry32(933100), 933100).positive.split(", ");
  eq("角色：同作品兩個角色，作品名只寫一次", twoSeries.filter((t) => t === "spy x family").length, 1);

  // 只抽同系列：釘了約兒＋2girls 1boy → 另外兩個都是間諜家家酒；沒開就不挑作品。
  let pinS = applyPin(lex, new Set(), new Set(), "yor briar").pinned;
  pinS = applyPin(lex, pinS, new Set(), "2girls").pinned;
  pinS = applyPin(lex, pinS, new Set(), "1boy").pinned;
  let sameAll = 0;
  let mixed = 0;
  for (let i = 0; i < 40; i++) {
    const seed = 934000 + i;
    const cs = charsOf(drawOne(lex, { ...on, characterSameSeries: true }, pinS, new Set(), mulberry32(seed), seed).positive);
    if (cs.length === 3 && cs.every((t) => lex.byTag.get(t).series === "spy x family")) sameAll += 1;
    const free = charsOf(drawOne(lex, on, pinS, new Set(), mulberry32(seed), seed).positive);
    if (free.some((t) => lex.byTag.get(t).series !== "spy x family")) mixed += 1;
  }
  eq("角色：只抽同系列＋釘約兒（2 女 1 男）：另外兩個都是同作品、性別對", sameAll, 40);
  ok("角色：沒開只抽同系列就不挑作品（不會一直抽到間諜家家酒）", mixed > 30, `${mixed}/40`);
  const pin3 = applyPin(lex, new Set(), new Set(), "3girls").pinned;
  let oneSeries = 0;
  for (let i = 0; i < 30; i++) {
    const cs = charsOf(drawOne(lex, { ...on, characterSameSeries: true }, pin3, new Set(), mulberry32(934500 + i), 934500 + i).positive);
    if (cs.length === 3 && new Set(cs.map((t) => lex.byTag.get(t).series)).size === 1) oneSeries += 1;
  }
  eq("角色：只抽同系列、沒釘角色、3girls：先挑湊得齊三個女角色的作品", oneSeries, 30);

  const ban = new Set(data.characterBan || []);
  ok("角色：characterBan 有清單（未成年、學生、童顏、真人、非人形）", ban.size > 1000 && ban.has("anya (spy x family)"), String(ban.size));
  eq("角色：被 ban 的角色不是詞庫的牌", data.tags.filter((t) => ban.has(t.tag)).length, 0);
  const pinBan = applyPin(lex, new Set(), new Set(), "anya (spy x family)").pinned;
  ok("角色：被 ban 的角色釘不上去", !tagsOf(drawOne(lex, s, pinBan, new Set(), mulberry32(933200), 933200)).has("anya (spy x family)"));
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok");
