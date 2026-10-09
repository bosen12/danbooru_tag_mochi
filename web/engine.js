/** Tag-case draw: cast → heat → era → gated pools → commit mutex/bind/imply → reconcile. */

import {
  SUPPORT_CANDIDATE_TAGS,
  supportCandidateAllowed,
  validateSupportShadow,
} from "./shadow-validator.js";
import {
  SPORT_ACT_PLACE,
  SPORT_GEAR_IDENTITY,
  SPORT_BUTTONS,
  SPORT_IDENTITY,
  SPORT_MOVE_ACTS,
  SPORT_NEUTRAL_GEAR,
  SPORT_PRESETS,
  sportGearIdsOf,
  sportIdsOf,
  sportPresetTags,
  sportTagAllowed,
} from "./sports.js";

import {
  HEATS,
  MIXED_HEATS,
  toggleHeat,
  heatPresetOf,
  weightsForHeats,
} from "./heats.js";
import {
  createTracer,
  summarizeTrace,
  SOURCES,
  REASONS,
  STAGES,
} from "./trace.js";
import {
  explicitOnly,
  ratingOf,
  ratingBlocked,
  sfwBlocked,
  sfwOn,
  ratingOfDrawnTags,
  RATINGS,
  RATING_LABEL,
  hasExplicitContent,
  evaluateRating,
} from "./rules/rating.js";
import {
  FEMALE_COUNT,
  MALE_COUNT,
  COUNT_NUM,
  hasFemale,
  hasMale,
  personCount,
  genderCount,
  gateOk,
  castOk,
  evaluateCast,
} from "./rules/cast.js";
import {
  actionGarmentKeys,
  needsBodyClothes,
  needsClothingDependency,
  clothingWearsKey,
  actionFitsClothes,
  evaluateClothingLayer,
  evaluateUnderwearVisibility,
} from "./rules/clothing.js";
import { diffKept, rejectRemoved } from "./rules/reconcile.js";
import {
  buildMutexIndexFromLex,
  prefilterPoolByMutex,
} from "./m-mutex-index.js";
import {
  SCENE_MODES,
  SCENE_MODE_LABELS,
  sceneModeOf,
  scenePolicyOf,
  lockSceneOn,
} from "./scene-policy.js";

export {
  SCENE_MODES,
  SCENE_MODE_LABELS,
  sceneModeOf,
  HEATS,
  MIXED_HEATS,
  toggleHeat,
  heatPresetOf,
  weightsForHeats,
  explicitOnly,
  ratingOf,
  ratingBlocked,
  sfwBlocked,
  sfwOn,
  ratingOfDrawnTags,
  RATINGS,
  RATING_LABEL,
  FEMALE_COUNT,
  MALE_COUNT,
  hasFemale,
  hasMale,
  personCount,
  actionGarmentKeys,
  needsBodyClothes,
  clothingWearsKey,
  actionFitsClothes,
  evaluateRating,
  evaluateCast,
  evaluateClothingLayer,
  evaluateUnderwearVisibility,
  SOURCES,
  REASONS,
  STAGES,
  summarizeTrace,
};
// 可以跟性愛動作並存的活動。其餘會動的活動（打球、騎馬、跑步）跟性愛互斥 ——
// 那是物理，不是尺度。
//
// diving 是 2026-09-16 補的：它跟 swimming／wading／floating 一樣在 WATER_ACT
// 裡，中文是「潛水」不是「跳水」，泡在水裡這件事跟游泳同一類。漏掉它沒有理由，
// 結果是「游泳可以、潛水不行」。WATER_ACT 裡只剩 fishing 不在這裡，那個有道理：
// 釣魚是手上拿著竿子站在岸上，不是泡在水裡。
const SEX_OK_ACTIVITY = new Set([
  "bathing",
  "showering",
  "swimming",
  "wading",
  "floating",
  "shared bathing",
  "diving",
]);

// 不是「活動」但一樣會讓性愛抽不到的身體姿勢。
// sleeping 的互斥寫在 allow() 裡（睡著時整段 pose 只留鏡頭／身體／表情／脫衣），
// 所以它不是 mutex="activity"，sportHeatWarnings 本來看不到它 ——
// 使用者釘了「睡著」再選性愛，會一張都抽不到而且**畫面上完全沒有提示**。
const SEX_BLOCKING_BODY = new Set(["sleeping"]);

const STILL_BODY = new Set(["sleeping", "lying", "on back", "on stomach", "on side", "reclining"]);
const LOCKED_SIT = new Set(["seiza", "wariza", "indian style"]);
const GROUND_BODY = new Set(["all fours", "crawling", "top-down bottom-up"]);
// 站著、走著、跑著的人不會同時「在沙發上」。on bed／on chair 這幾個字原本是
// body_pose，被改成 env/furniture 之後就脫離了姿勢相容那一整套檢查，於是
// 「standing + on couch」這種組合一直畫得出來（基準線 4/24，六分之一）。
const UPRIGHT_BODY = new Set(["standing", "walking", "walking away", "running", "jumping", "standing split", "tiptoes"]);
// 騎車是坐著。跳水、漂浮跟走跑不能同時成立。全身動作不配半身鏡頭。
// 背對走遠就是走路，同一組限制。
const BIKE_BLOCK_BODY = new Set(["walking", "walking away", "running", "jumping"]);
const DIVE_BLOCK_BODY = new Set(["walking", "walking away", "running", "standing split"]);
const FLOAT_BLOCK_BODY = new Set(["walking", "walking away", "running"]);
const FULL_SHOT_BODY = new Set(["walking", "walking away", "running", "jumping", "standing split", "tiptoes", "leg up"]);
const HALF_SHOT = new Set(["portrait", "upper body", "close-up", "face", "head out of frame"]);
// 跑步、跳躍進不了的小室內。沒有衣櫃這個字，試衣間和更衣室是現成的小隔間。
const NO_SPRINT_PLACE = new Set([
  "bathroom",
  "shower (place)",
  "bathtub",
  "toilet stall",
  "fitting room",
  "changing room",
  "ofuro",
  "bubble bath",
]);

// 「只穿一件」的字。naked coat 的意思就是**除了大衣什麼都沒穿**，所以它跟任何
// 主衣、內衣都是矛盾的。這件事以前完全沒有被擋：實測 1500 張裡出現這六個字的
// 190 張，**190 張身上都還穿著別的衣服**（naked coat 配 idol clothes、
// naked jacket 配 evening gown 加運動內衣）。
//
// 會漏掉是因為互斥格不夠用：naked sweater／naked apron／naked towel 的格子是
// onepiece，擋得住別的主衣但擋不住內衣；而 naked coat／naked jacket 的格子是
// outer —— 外套格當然擋不住洋裝。這是語意問題，不是格子問題，所以要一條規則。
const NAKED_ONLY = new Set([
  "naked sweater", "naked shirt", "naked apron", "naked towel", "naked coat", "naked jacket",
  "naked ribbon", "naked bandage", "painted clothes",
]);
// 會被「只穿一件」排除的：身上的主要衣物與內衣。外套不算（naked coat 自己就是外套），
// 襪子鞋子也不算（光腳穿大衣跟穿著襪子穿大衣都成立）。
const BODY_WORN_GROUP = new Set(["onepiece", "top", "bottom", "underwear", "era"]);
// 「只穿內衣」的方向跟 NAKED_ONLY 相反：那邊是連內衣都不能有，這邊是**只能**有內衣。
//
// Danbooru wiki 寫得很明確：「Wearing only underwear by itself, such as a bra and
// panties, lingerie, boxers, etc. ... Thighhighs or socks may be worn」——
// 襪類明文放行，外套與主要衣物不行。共現率也對得上（underwear only 共 80,742 張）：
//
//     panties 87.0%、bra 63.4%、thighhighs 25.5%、garter belt 6.9%、socks 4.1%
//     jacket 1.2%、coat 0.25%
//
// 修之前釘住「只穿內衣」抽 600 張，**79.5% 身上穿著非內衣的衣服** ——
// 夾克 178、大衣 157、開襟衫 69。標著只穿內衣卻套著大衣，那個字等於沒作用。
const UNDERWEAR_ONLY_BAD = new Set(["onepiece", "top", "bottom", "outer", "era"]);
// 袖子描述預設身上有一件「有袖子的衣服」，只穿內衣時沒有那一件。
// fabric 那一組不能整組擋 —— see-through clothes／fishnets／latex 可以是在講內衣本身。
const SLEEVE_WORD = new Set([
  "long sleeves", "short sleeves", "wide sleeves", "puffy sleeves",
  "detached sleeves", "sleeves rolled up",
  // 第六輪。無袖也是在講「那件衣服」，只穿內衣時沒有那一件。
  "sleeveless", "puffy short sleeves", "puffy long sleeves", "sleeves past wrists",
  "juliet sleeves", "frilled sleeves", "layered sleeves",
]);
const underwearOnlyClash = (item) =>
  !!item &&
  item.section === "clothing" &&
  (UNDERWEAR_ONLY_BAD.has(item.group) ||
    SLEEVE_WORD.has(item.tag) ||
    // 泳裝在別的衣服底下，就不是只穿內衣。
    item.tag === "swimsuit under clothes" ||
    // 運動服蓋住下半身，但沒有上衣或下身格，群組擋不到。
    item.tag === "sportswear");

// 泳衣底下不穿內衣。比基尼配運動內褲是穿兩層。
const isSwimGarment = (item) =>
  !!item && item.section === "clothing" && item.layer === "garment" &&
  (item.tag.includes("bikini") || item.tag.includes("swimsuit"));
// 坐著或跪著做不了的活動。清單從 sports.js 算出來，不手抄，免得加新運動時失同步。
// 例外寫在 SEATED_OK_SPORT：跪射是合理的姿勢；騎車和游泳本來就有自己的姿勢規則。
const SEATED_OK_SPORT = new Set(["archery", "riding bicycle", "swimming", "skiing"]);
const SEATED_BAD_SPORT = new Set([
  "playing sports",
  "training",
  "exercising",
  ...SPORT_MOVE_ACTS.filter((a) => !SEATED_OK_SPORT.has(a)),
]);
const MOVE_ACT = new Set([
  "swimming",
  "hiking",
  "horseback riding",
  "riding bicycle",
  "playing sports",
  "exercising",
  "training",
  "dancing",
  "jogging",
  "skiing",
  "diving",
  "weightlifting",
]);
const STAND_OK_MOVE = new Set([
  "exercising",
  "training",
  "playing sports",
  "weightlifting",
  "hiking",
  "skiing",
]);
for (const act of SPORT_MOVE_ACTS) {
  MOVE_ACT.add(act);
  STAND_OK_MOVE.add(act);
}
const AWAKE_ACT = new Set([
  ...MOVE_ACT,
  "fishing",
  "wading",
  "carrying",
  "cooking",
  "cleaning",
  "eating",
  "reading",
  "drawing (action)",
  "painting (action)",
  "singing",
  "karaoke",
  "shopping",
  "driving",
  "writing",
  "picnic",
  "playing games",
  "playing video games",
  "playing guitar",
  "selfie",
  "talking on phone",
  "taking picture",
  "stretching",
  "yoga",
  "studying",
  "sunbathing",
  "smoking",
  "drinking",
  "floating",
  "bathing",
  "showering",
  "shared bathing",
  "diving",
  "weightlifting",
]);
/**
 * 同一個概念的兩種寫法。詞庫兩個都留著是刻意的 —— 同一個概念有兩張抽獎券，
 * 雙人情境要的就是這個加權 —— 但最後只該吐一個字出來。提示詞本來就超過 75 token，
 * 同義詞佔兩格純粹是白費。
 *
 * 這裡只放真的是別名的。general/specific 的父子對（extreme close-up → close-up、
 * high ponytail → ponytail）不算重複，Danbooru 本來就那樣疊，交給 parentChild()。
 */
/**
 * 性愛的三個時序階段：即將 / 進行中 / 已結束。這些字多半沒有 mutex，硬桶時代因為
 * 桶 2 根本輪不到所以碰不上，放開之後就會疊出「imminent penetration + after vaginal」
 * 這種同一張圖既還沒開始又已經結束的東西（實測 1.4%）。
 *
 * 只擋「即將」對「已結束」。進行中和任何一邊都說得通 —— 正在做的時候可以剛結束
 * 上一輪，也可以即將換下一個動作。
 */
const SEX_PHASE_BEFORE = new Set([
  "imminent penetration",
  "imminent vaginal",
  "imminent fellatio",
  // 還沒拆開用的保險套。跟「已經用過」不能出現在同一張。
  "holding condom",
  "condom wrapper",
  "condom box",
  "condom in mouth",
]);
const SEX_PHASE_AFTER = new Set([
  "after vaginal",
  "after sex",
  "after fellatio",
  "after paizuri",
  "after ejaculation",
  "after anal",
  "afterglow",
  // 詞庫裡的字是 cumdrip，沒有空格。舊的 "cum drip" 留著，避免哪天寫法回來對不上。
  "cum drip",
  "cumdrip",
  "cumdrip from penis",
  "used condom",
  "after rape",
]);
// 未使用的可以同時在（拿著＋包裝＋盒子）。套上跟用過各是另一態，三態互斥。
const CONDOM_UNUSED = new Set(["holding condom", "condom wrapper", "condom box", "condom in mouth"]);
const CONDOM_USING = new Set(["condom on penis"]);
const CONDOM_USED = new Set(["used condom"]);
function condomState(tag) {
  if (CONDOM_UNUSED.has(tag)) return "unused";
  if (CONDOM_USING.has(tag)) return "using";
  if (CONDOM_USED.has(tag)) return "used";
  return "";
}
function condomStateClash(tag, used) {
  const state = condomState(tag);
  if (!state) return false;
  for (const t of used) {
    if (t === tag) continue;
    const other = condomState(t);
    if (other && other !== state) return true;
  }
  return false;
}
// 一張圖只留一個主勒法。粗暴、窒息、掌痕、強姦不在這裡，可以跟其中一個同時成立。
const GRIP = new Set(["strangling", "neck grab", "headlock", "rear naked choke"]);
// 事後還在勒、還在粗暴交，是進行中的動作。掌痕會留下，不在這組。
const ROUGH_DURING = new Set([
  "strangling",
  "neck grab",
  "headlock",
  "rear naked choke",
  "asphyxiation",
  "rough sex",
]);
const PENIS_STATE = new Set(["erection", "half-erect", "flaccid"]);
const PRECUM_TAGS = new Set(["precum", "precum drip", "precum string"]);
const FULL_NUDE = new Set(["nude", "completely nude"]);
const CLOTHED_ONLY = new Set(["cum on clothes", "penis peek", "erection under clothes", "covered testicles", "blood on clothes"]);
const PENIS_ON_HEAD = new Set(["penis over eyes", "penis on face"]);
const EJACULATION_ACT = new Set(["ejaculation", "projectile cum", "handsfree ejaculation"]);

function peerIn(tag, used, group) {
  if (!group.has(tag)) return false;
  for (const t of used) if (t !== tag && group.has(t)) return true;
  return false;
}

function sexPhaseClash(tag, used) {
  if (SEX_PHASE_BEFORE.has(tag)) {
    for (const t of used) if (SEX_PHASE_AFTER.has(t)) return true;
  }
  if (SEX_PHASE_AFTER.has(tag)) {
    for (const t of used) if (SEX_PHASE_BEFORE.has(t)) return true;
  }
  return false;
}

const SYNONYM_GROUPS = [
  new Set(["heavy breathing"]),
  new Set(["kiss"]),
];

function synonymClash(tag, used) {
  for (const g of SYNONYM_GROUPS) {
    if (!g.has(tag)) continue;
    for (const t of used) if (t !== tag && g.has(t)) return true;
  }
  return false;
}

const FACELESS_CAM = new Set(["head out of frame", "lower body"]);
const FACE_NEED_TAGS = new Set([
  "closed eyes",
  "facial",
  "cum in mouth",
  "condom in mouth",
  "cum on face",
  "cum on tongue",
  "cum on hair",
  "gokkun",
  "penis over eyes",
  "penis on face",
  "licking penis",
  "testicle sucking",
  "covering own mouth",
  "french kiss",
  "finger to mouth",
  "eating",
  "drinking",
  "selfie",
  "taking picture",
  "69",
  "reading",
  "studying",
  "writing",
  "washing hair",
  "adjusting hair",
  "cunnilingus",
  "oral",
  "fellatio",
  "irrumatio",
  "head tilt",
  "after fellatio",
  "after paizuri",
  "closed mouth",
  "kiss",
  "paizuri",
  "breast focus",
  "talking on phone",
  "breast sucking",
  "licking nipple",
  "kissing neck",
  "head between breasts",
  "breast smother",
  "singing",
  "karaoke",
  "smoking",
  "painting (action)",
  "tongue",
  "teeth",
  "playing games",
  "playing video games",
]);
// 乳貼要畫在看得到的胸口上。上衣還扣著、只是旁邊有性愛或掀裙子，不算露出。
const CHEST_OPEN_TAGS = new Set([
  "breasts out",
  "one breast out",
  "nipple slip",
  "areola slip",
  "shirt lift",
  "shirt pull",
  "open shirt",
  "open clothes",
  "naked shirt",
  "downblouse",
  "sports bra lift",
]);
const CHEST_NEED_TAGS = new Set([
  "breast hold",
  "breastfeeding",
  "spread cleavage",
  "paizuri gesture",
  "cum on breasts",
  "nipple tweak",
  "breast press",
  "arms under breasts",
  "arm under breasts",
  "breasts on table",
  "breasts on glass",
  "grabbing own breast",
  "breast bondage",
  "between breasts",
  "clothes between breasts",
  "breasts out",
  "hands on own breasts",
  "hand on own chest",
  "bouncing breasts",
  "guided breast grab",
  "nipple slip",
  "areola slip",
  "breast suppress",
  "tweaking own nipple",
  "breast rest",
  "breast lift",
  "hanging breasts",
  "breasts apart",
  "breasts squeezed together",
]);
const BED_PLACE = new Set(["bedroom", "bed", "hotel room", "love hotel", "futon"]);
const SKY_EXTRA = new Set(["sky", "blue sky", "orange sky"]);
const DAY_MARK = new Set(["day", "sunrise", "sunlight", "sunbeam", "dappled sunlight", "sunbathing", "blue sky", "orange sky"]);
const NIGHT_MARK = new Set(["night", "starry sky", "moonlight", "market stall"]);
// 這些光源本身就交代了「天是暗的」：篝火、火把、燭光、油燈、街燈。
// 它們不在 NIGHT_MARK 裡，因為 NIGHT_MARK 的成員彼此互斥（一張圖只能有一個
// 夜的講法），而光源是另一個槽，可以和 night 並存 —— 只是不能和白天並存。
const DARK_LIGHT = new Set([
  "city lights",
  "bonfire",
  "torch",
  "candlelight",
  "candle",
  "lantern",
  "oil lamp",
  "fireplace",
  "chandelier",
  "candelabra",
  "lamppost",
]);
const SLEEP_BAD_POSE = new Set([
  "partially submerged",
  "washing hair",
  "splashing",
  "breasts on table",
  "breasts on glass",
  "over shoulder",
  "grabbing own breast",
  "bent over",
  "presenting",
  "grinding",
  "hand on own crotch",
  "masturbation through clothes",
  "female masturbation",
  "fingering",
]);
const SLEEP_BAD_EXPR = new Set([
  "shy",
  "come hither",
  "scared",
  "angry",
  "naughty face",
  "ahegao",
  "seductive smile",
  "smug",
  "surprised",
  "embarrassed",
  "nervous",
]);
const EYE_EXTRA = new Set(["one eye closed", "empty eyes", "sparkling eyes", "half-closed eyes", "rolling eyes", "crazy eyes"]);
const MOUTH_EXTRA = new Set([
  "open mouth",
  "clenched teeth",
  "biting own lip",
  "tongue out",
  "parted lips",
  "licking lips",
  "licking",
  "drooling",
  "moaning",
  "condom in mouth",
  "blowing kiss",
]);
const OUTDOOR_LEFTOVER = new Set([
  "tree",
  "bush",
  "sky",
  "blue sky",
  "orange sky",
  "starry sky",
  "snow",
  "water",
  "cherry blossoms",
  "campfire",
  "horse",
  "bonfire",
  // 路燈是街上的東西。
  "lamppost",
  "pine tree",
  "willow",
  "rice paddy",
]);

function usedMutexTags(used, lex, mutex) {
  const s = new Set();
  for (const t of used) {
    if (lex.byTag.get(t)?.mutex === mutex) s.add(t);
  }
  return s;
}

function activityFitsBody(act, body) {
  if (body.has("sleeping") && AWAKE_ACT.has(act)) return false;
  // 跑步、跳躍是移動本身，不跟讀書、吃飯這類靜態活動疊。走路可以逛街、慢跑。
  if ((body.has("running") || body.has("jumping")) && !MOVE_ACT.has(act)) return false;
  if (
    (body.has("walking") || body.has("walking away")) &&
    (BATH_ACT.has(act) ||
      act === "reading" ||
      act === "studying" ||
      act === "eating" ||
      act === "drinking" ||
      act === "cooking" ||
      act === "sunbathing" ||
      act === "yoga" ||
      act === "stretching")
  ) {
    return false;
  }
  if (
    body.has("dancing") &&
    act !== "dancing" &&
    (MOVE_ACT.has(act) ||
      act === "reading" ||
      act === "eating" ||
      act === "picnic" ||
      act === "playing games" ||
      act === "playing video games" ||
      act === "drawing (action)" ||
      act === "painting (action)" ||
      act === "playing guitar" ||
      act === "floating" ||
      act === "studying" ||
      act === "writing" ||
      act === "drinking" ||
      act === "yoga" ||
      act === "stretching" ||
      act === "sunbathing" ||
      act === "smoking" ||
      act === "bathing" ||
      act === "showering" ||
      act === "shared bathing" ||
      act === "swimming" ||
      act === "wading" ||
      act === "diving" ||
      act === "shopping" ||
      act === "weightlifting" ||
      act === "washing hair")
  ) {
    return false;
  }
  if ([...body].some((t) => STILL_BODY.has(t)) && MOVE_ACT.has(act)) return false;
  if (body.has("standing") && MOVE_ACT.has(act) && !STAND_OK_MOVE.has(act)) return false;
  if (act === "driving" && [...body].some((t) => t !== "sitting")) {
    return false;
  }
  if ([...body].some((t) => LOCKED_SIT.has(t)) && (MOVE_ACT.has(act) || act === "wading")) return false;
  if ([...body].some((t) => LOCKED_SIT.has(t)) && (act === "yoga" || act === "stretching")) return false;
  if (
    [...body].some((t) => GROUND_BODY.has(t)) &&
    (MOVE_ACT.has(act) ||
      act === "eating" ||
      act === "picnic" ||
      act === "reading" ||
      act === "drawing (action)" ||
      act === "painting (action)" ||
      act === "playing guitar" ||
      act === "studying" ||
      act === "writing" ||
      act === "drinking" ||
      act === "playing games" ||
      act === "playing video games" ||
      act === "floating" ||
      act === "driving" ||
      act === "sunbathing" ||
      act === "yoga" ||
      act === "stretching" ||
      act === "weightlifting" ||
      act === "shopping")
  ) {
    return false;
  }
  if ([...body].some((t) => STILL_BODY.has(t) || LOCKED_SIT.has(t)) && act === "shopping") return false;
  if (SEATED_BAD_SPORT.has(act) && (body.has("sitting") || body.has("kneeling"))) {
    return false;
  }
  if (
    act === "floating" &&
    [...body].some(
      (t) =>
        GROUND_BODY.has(t) ||
        LOCKED_SIT.has(t) ||
        t === "squatting" ||
        t === "kneeling" ||
        t === "on one knee" ||
        t === "standing" ||
        t === "dancing" ||
        t === "sitting" ||
        LIE_BODY.has(t)
    )
  ) {
    return false;
  }
  if (
    act === "horseback riding" &&
    (body.has("standing") ||
      body.has("squatting") ||
      body.has("kneeling") ||
      body.has("on one knee") ||
      [...body].some((t) => STILL_BODY.has(t) || LOCKED_SIT.has(t) || GROUND_BODY.has(t)))
  ) {
    return false;
  }
  if (
    (act === "swimming" || act === "diving") &&
    (body.has("standing") ||
      body.has("squatting") ||
      body.has("kneeling") ||
      body.has("on one knee") ||
      body.has("sitting") ||
      [...body].some((t) => LIE_BODY.has(t) || GROUND_BODY.has(t)))
  ) {
    return false;
  }
  if (
    act === "wading" &&
    (body.has("squatting") ||
      body.has("kneeling") ||
      body.has("on one knee") ||
      body.has("sitting") ||
      [...body].some((t) => LOCKED_SIT.has(t) || LIE_BODY.has(t) || GROUND_BODY.has(t)))
  ) {
    return false;
  }
  if (
    (act === "hiking" || act === "playing sports" || act === "riding bicycle" || act === "jogging" || act === "skiing") &&
    (body.has("kneeling") || body.has("on one knee"))
  ) {
    return false;
  }
  if (act === "riding bicycle" && body.has("squatting")) return false;
  if (
    (act === "jogging" || act === "skiing" || act === "hiking") &&
    (body.has("sitting") || body.has("squatting"))
  ) {
    return false;
  }
  if (
    act === "weightlifting" &&
    [...body].some((t) => STILL_BODY.has(t) || LOCKED_SIT.has(t))
  ) {
    return false;
  }
  if (
    (act === "jogging" || act === "skiing" || act === "hiking") &&
    (body.has("sitting") || body.has("sitting on face"))
  ) {
    return false;
  }
  return true;
}

const WATER_PLACE = new Set([
  "pool",
  "poolside",
  "beach",
  "ocean",
  "underwater",
  "pond",
  "river",
  "onsen",
  "bath",
  "bathroom",
  "bathtub",
  "shower (place)",
  "bathhouse",
  "ofuro",
  "bubble bath",
]);
const WATER_ACT = new Set(["swimming", "wading", "floating", "fishing", "bathing", "showering", "shared bathing", "diving"]);
// floating 也可以是漂浮在空中，不能單獨替 splashing / washing 類細節證明有水。
const WATER_SOURCE_ACT = new Set([...WATER_ACT].filter((tag) => tag !== "floating"));
const WATER_DETAIL = new Set([
  "partially submerged",
  "splashing",
  "washing hair",
  "washing back",
]);
const BATH_PLACE = new Set([
  "onsen",
  "bath",
  "bathroom",
  "bathtub",
  "shower (place)",
  "bathhouse",
  "ofuro",
  "bubble bath",
  "sauna",
]);
const BATH_ACT = new Set(["bathing", "showering", "shared bathing"]);
// 洗澡**當下**不會穿的東西。isBathOkGarment() 收的是「浴場」的衣服，那對更衣室、
// 洗完、泡湯前後都對，但對「正在洗」太寬 —— 浴袍是洗完才披上的。
//
// Danbooru（分母是該動作的總數）：
//   bathing 18,182   裸 67.2%  towel 28.9%  naked towel 10.6%  wet clothes 1.6%
//                    浴袍 0.1%  浴衣 0.4%  bath yukata 0.2%  褌 0.2%  chemise 0.0%
//   showering 6,606  裸 64.6%  towel 9.5%   浴袍 0.1%
// 整個袍子／和服那一類都在 0.0～0.4%，是同一個現象，所以整類一起處理。
const NOT_WHILE_WASHING = new Set(["bathrobe", "yukata", "bath yukata", "fundoshi", "chemise"]);
function washingNow(used) {
  for (const t of used) if (BATH_ACT.has(t)) return true;
  return false;
}
// steam 掛在 mutex:"weather" 底下，但它不是天氣：Danbooru 上它在室內（15.0%）比在
// 室外（9.0%）多，而且 12.4% 跟 onsen 同框 —— 那是浴場的蒸氣。跟著天氣那格在室外
// 抽出來會擺錯地方，所以它要有自己的場合。
// 分兩檔，因為 Danbooru 上「這個場合有幾成帶蒸氣」差很多：
//   onsen 37.8%、sauna 43.0%、bathing 28.6%、shared bathing 26.7%
//   bathroom 14.3%、bathtub 14.6%
// 熱水池和洗澡間不是同一件事，用一個數字蓋過去會讓浴室霧茫茫。
const STEAM_HOT = new Set([
  "onsen", "sauna", "hot spring", "bathing", "shared bathing", "steaming body",
]);
const STEAM_MILD = new Set([
  "bath", "bathroom", "bathtub", "shower (place)", "bathhouse", "ofuro", "bubble bath",
  "showering", "after bathing",
]);
const STEAM_CTX = new Set([...STEAM_HOT, ...STEAM_MILD]);
// 真正的天氣只在室外。天氣那一格自己有室外判斷，但通用的 fill("env") 在張數調高時
// 也搆得到 mutex:"weather"，那裡沒有任何室內外檢查 —— 實測 seed 3「抽好抽滿」抽出
// 「sauna, indoors, ... fog」，三溫暖裡起霧。所以閘要放在 allow()，兩條路徑一起擋。
// in_out 在 fillSlot("env","in_out") 就定了，排在天氣那格和 fill("env") 前面，
// 所以這裡問得到答案。（Danbooru 佐證：snow 在室內只有 2.1%、cherry blossoms 2.5%。）
const OUTDOOR_WEATHER = new Set(["rain", "overcast", "snow", "fog", "cherry blossoms"]);

const BATH_BAD_CLOTHES = new Set([
  "geta",
  "zouri",
  "boots",
  "sneakers",
  "shoes",
  "hakama",
  "armor",
  "plate armor",
  "suit",
  "necktie",
  "blazer",
  "japanese armor",
  "sandals",
  "hard hat",
  "stethoscope",
  "lab coat",
]);

function isBathBadCloth(tag) {
  if (BATH_BAD_CLOTHES.has(tag)) return true;
  if (
    /\b(armor|suit|necktie|sneakers|boots|geta|zouri|shoes|hakama|blazer|sandals|hard hat|stethoscope|helmet|high heels|pantyhose|track jacket)\b/.test(
      tag
    )
  ) {
    return true;
  }
  return false;
}
const INDOOR_ROOM = new Set([
  "bedroom",
  "bed",
  "hotel room",
  "love hotel",
  "kitchen",
  "living room",
  "office",
  "classroom",
  "library",
  "changing room",
  "locker room",
  "train",
  "train interior",
  "car interior",
  "elevator",
  "hallway",
  "cafe",
  "bar (place)",
  "fitting room",
  "restaurant",
  "clinic",
  "hospital",
  "mansion",
  "palace",
  "futon",
  "couch",
  "airplane interior",
  "cockpit",
  "bus interior",
  "movie theater",
  "convenience store",
  "supermarket",
  "internet cafe",
  "prison",
  "prison cell",
  "dungeon",
  "glory hole",
  "casino",
  "nightclub",
  "laboratory",
  "church",
  "dojo",
  "barn",
  "karaoke box",
  "apartment",
  "bowling alley",
  "boxing ring",
  "izakaya",
  "tavern",
  "ryokan",
  "fitness gym",
  "school gym",
]);
const INDOOR_PROP = new Set([
  "shouji",
  "carpet",
  "curtains",
  "bed sheet",
  "window",
  "tatami",
  "office chair",
  "gaming chair",
  "swivel chair",
  // 光源那一格裝的多半是「東西」而不是「光的性質」：WAI 會照著畫出一根蠟燭、
  // 一盞吊燈。以前光源幾乎抽不到所以看不出來，改成每張都填之後就露餡了 ——
  // 生出來的圖裡有一根蠟燭立在運動場草地上。這幾樣只能在室內。
  "candle",
  "candelabra",
  "chandelier",
  "fireplace",
  // 天花板燈裝在天花板上，窗光是從窗戶照進「室內」的光 —— 兩個都不可能在戶外。
  // 這兩個是舊有的問題，但光源以前只有 3% 機率抽到所以看不出來；改成每張都填
  // 之後，2400 張裡就有 23 張天花板燈在戶外、75 張人在戶外卻打著窗光。
  "ceiling light",
  "window light",
  // 搬不出去的室內物件。lamp 是桌燈／立燈（不是路燈，路燈是 lamppost），
  // folding screen 是屏風 —— 室內隔間用的。
  //
  // 注意：statue、arch、stone wall 我本來也以為是戶外的，量完才發現它們在
  // 室內完全合理（宮殿大廳的雕像、廳堂的拱門、城堡內側的石牆），所以沒有動它們。
  "lamp",
  "folding screen",
  "piano",
  "clock",
  "birdcage",
  // 書桌。不在這張表時，釘 desk 場地後填，18/40 張跑去公園／球場。
  // 鏡子不加：mirror selfie 在公園靠 implies mirror，加進去會把戶外鏡自拍掐死。
  // 桌子／櫃檯／置物櫃不加：野餐、攤位、海灘置物櫃是合法戶外。
  "desk",
  // 床頭櫃／洗手台／白板／牌桌／檯燈：釘了之後 in_out 後填，17～25/40 張
  // 跑去公園／泳池。lamp 已在表裡，desk lamp 是同一類實體燈具。
  // 詞庫鍵是 shouji 不是 shoji（舊鍵是死字）。fusuma 是襖，跟紙拉門一樣不能擺戶外。
  "nightstand",
  "sink",
  "whiteboard",
  "poker table",
  "desk lamp",
  "fusuma",
]);
const SPORT_PLACE = new Set([
  "fitness gym",
  "school gym",
  "park",
  "beach",
  "courtyard",
  "poolside",
  "rooftop",
  "pool",
  "basketball court",
  "tennis court",
  "soccer field",
  "baseball stadium",
  "bowling alley",
  "boxing ring",
  "running track",
  "sports court",
  "golf course",
  "stadium",
  "dojo",
]);
// 加油站是現代的戶外。不在這份清單時，釘了開車就永遠不停在那裡。
const DRIVE_PLACE = new Set(["car", "car interior", "street", "city", "cityscape", "alley", "gas station"]);

// drawOne 會在 used 上掛 _rev，每次真正新增或刪除才加一。allow() 在兩次變更之間
// 會被呼叫上千次，場地／活動／職業都是把整份 used 掃過再做成小集合。
// 回傳的是快取本體。sportGearPlaceOk 要加床和沙發時自己複製，不能寫進這裡。
function recall(used, key) {
  const rev = used._rev;
  if (rev === undefined) return undefined;
  const hit = used[key];
  if (hit && hit.rev === rev) return hit.value;
  return undefined;
}

function remember(used, key, value) {
  const rev = used._rev;
  if (rev !== undefined) used[key] = { rev, value };
  return value;
}

function usedHas(used, key, pred) {
  const hit = recall(used, key);
  if (hit !== undefined) return hit;
  for (const tag of used) if (pred(tag)) return remember(used, key, true);
  return remember(used, key, false);
}

function watchUsed(used) {
  const add = used.add;
  const del = used.delete;
  used._rev = 0;
  used.add = function (tag) {
    const had = this.has(tag);
    const out = add.call(this, tag);
    if (!had) this._rev += 1;
    return out;
  };
  used.delete = function (tag) {
    const had = this.has(tag);
    const out = del.call(this, tag);
    if (had) this._rev += 1;
    return out;
  };
}

function usedPlaces(used, lex) {
  const hit = recall(used, "_places");
  if (hit !== undefined) return hit;
  const s = new Set();
  for (const t of used) {
    const it = lex.byTag.get(t);
    if (it && (it.mutex === "place" || it.group === "place")) s.add(t);
  }
  return remember(used, "_places", s);
}

function usedActs(used, lex) {
  const hit = recall(used, "_acts");
  if (hit !== undefined) return hit;
  const s = new Set();
  for (const t of used) {
    if (lex.byTag.get(t)?.mutex === "activity") s.add(t);
  }
  return remember(used, "_acts", s);
}

const FISH_PLACE = new Set(["beach", "ocean", "poolside", "pool", "pond", "river"]);
// 煮飯的場地以前有兩份：ACT_PLACE.cooking 一份、placeFitsActs() 裡又寫死一份。
// 釣魚和開車都是共用 FISH_PLACE／DRIVE_PLACE，只有煮飯把清單抄成字面值，所以
// 兩邊會各自漂移 —— 寫實模式走 ACT_PLACE、非寫實模式走那份寫死的，同一個時代
// 能不能煮飯要看模式。合成一份之後就不可能再不同步。
//
// 補 courtyard 是因為古希臘原本一格煮飯的場地都沒有：kitchen 是維多利亞之後才有
// 的場地，castle／palace 又都不屬於古希臘，所以「煮飯」在那個時代是一個連場地都
// 排不進去的活動 —— 開了 lockScene 會被整個刪掉，沒開就畫出一張沒有場地的圖。
// 庭院爐灶補上之後，古希臘、中世紀、古中國都有地方煮飯了（江戶本來就有 castle）。
//
// 古希臘那次只補 courtyard，因為它的 era 不含 modern：現代的抽法一個字都不會變。
// tent / food stall 含 modern，補下去會跟「lockScene 的煮飯就是要在廚房」打架。
// field 不收：曠野生火最弱。
//
// ryokan 是後來為了江戶 × 性愛 × 煮飯才加的。COOK_PLACE ∩ PRIVATE_SEX_PLACE ∩ edo
// 以前是空的：castle 是江戶唯一的煮飯場地但不在私密清單，kitchen 在私密清單
// 但 era 沒有 edo。開了 lockScene 又抽到性愛，釘煮飯的圖 100% 沒有場地。
// 旅館會開飯、era 含 edo、已經在 PRIVATE_SEX_PLACE。它也含 modern，但 lockScene
// 仍會把現代的煮飯換成廚房，所以現代的測試一個字都不會變。不把 courtyard
// 再加進女僕場地：那會讓女僕去運動，見 JOB_PLACE.maid。
const COOK_PLACE = new Set(["kitchen", "castle", "palace", "courtyard", "ryokan"]);
const INDOOR_FURN = new Set(["on bed", "on chair", "office chair", "gaming chair", "swivel chair", "bunk bed", "on couch", "on desk", "wooden horse", "vacuum bed"]);
const DRY_NO_WATER = new Set([
  "airplane interior",
  "cockpit",
  "movie theater",
  "church",
  "classroom",
  "office",
  "library",
  "living room",
  "bedroom",
  "hotel room",
  "basketball court",
  "tennis court",
  "soccer field",
  "baseball stadium",
  "bowling alley",
  "boxing ring",
  "dojo",
  "fitness gym",
  "school gym",
  "running track",
  "bathroom",
  "prison",
  "colonnade",
  "train interior",
  "hallway",
  "elevator",
]);
// 能坐下來讀書寫字的地方。原本這三組只列了現代的房間，而正常模式下
// 「有 ACT_PLACE 表的活動必須把場地列進去」—— 沒被列到的場地等於做不了那件事。
// 結果是 130 個場地裡有 39 個只配得到一個活動（carrying），73 個配不到 4 個：
// 釘「宮殿」的人有 52% 會拿到平底鍋，因為煮飯是少數列了 palace 的活動。
const DESK_PLACE = new Set([
  "library", "bedroom", "living room", "cafe", "maid cafe", "classroom", "clubroom", "office",
  "park bench", "garden", "shrine", "pavilion", "east asian architecture",
  // 住得下人、坐得下來的地方，古今都有
  // 補的是「坐得下來看書寫字的地方」。城堡、大廳、酒館、舞廳、神殿刻意不補 ——
  // 既有測試 "normal studying never castle/beach/onsen" 明講不要在城堡唸書，
  // 那是有意的內容契約，我一開始把 castle 加進來就是把它撞掉了。
  // 社團教室是同一類。王座廳 implies 王座，王座已經在裡面，廳本身沒有的話
  // 讀書時 commit 驗父字過不了，廳就永遠不出現。
  "apartment", "hotel room", "mansion", "palace", "throne", "throne room",
  "ryokan", "balcony", "courtyard", "futon", "tent",
]);
const HOME_PLACE = new Set([
  "bedroom", "living room", "hotel room", "futon",
  "apartment", "mansion", "palace", "ryokan", "castle",
]);
// 第五輪這些房間就是吃飯的地方，清單卻沒跟上。placeFitsActs 只認字面，
// 不跟著 implies 走：女僕咖啡廳 implies cafe，cafe 在清單裡，廳自己仍被拒。
// 釘吃飯 120 張，cafe 和餐廳有抽到，飯廳、食堂、迴轉壽司、屋台、女僕咖啡廳是 0。
// 子字要過關，它帶出來的場地父字也得在同一份清單上，否則 commit 整筆退回。
// 煮飯仍只用下面的 COOK_PLACE，飯廳不進廚房。
const MEAL_PLACE = new Set([
  "restaurant", "cafe", "maid cafe", "kitchen", "dining room", "cafeteria",
  "conveyor belt sushi", "yatai", "living room", "park", "garden", "beach", "courtyard",
  "apartment", "hotel room", "mansion", "palace", "throne", "throne room",
  "balcony", "pavilion", "east asian architecture", "rooftop", "tent", "field", "izakaya",
  "castle", "tavern", "ryokan", "ballroom",
]);
// 「活動在某個時代一個場地都排不進去」是結構性的洞：開了 lockScene 會把活動整個
// 刪掉，沒開就畫出一張沒有場地的圖。把活動×時代窮舉一遍，只有四對中獎：古希臘的
// drinking／cooking、中世紀的 singing、維多利亞的 archery —— 前三個的場地清單整份
// 都是現代或日式場地，最後一個只有體育場館（射箭場、體育館、道場）。
// 補的是那個時代真的有的場地：會飲的中庭與柱廊、酒館裡的吟遊、草坪上的射箭。
//
// 這不是放寬規則 —— scripts/test_draw_contracts.mjs 有一條窮舉的守門檢查，
// 任何活動在任何時代只要連半個合時代的場地都排不進去就會紅燈。
export const ACT_PLACE = {
  bathing: new Set([...BATH_PLACE]),
  showering: new Set(["bathroom", "shower (place)"]),
  // 池、海、沙灘、水下都是任何時代。古中國游泳若只有這四個，場地永遠不是時代專屬，
  // 人再穿漢服也只靠衣服。池塘、河是這個時代真的有的水。
  swimming: new Set(["pool", "ocean", "beach", "underwater", "pond", "river"]),
  "pole dancing": new Set(["stage"]),
  wading: new Set(["beach", "ocean", "pool", "poolside", "pond", "river"]),
  floating: new Set(["pool", "ocean", "bathtub", "ofuro", "onsen", "bubble bath", "pond", "river"]),
  "shared bathing": new Set(["onsen", "bathhouse", "ofuro", "bath"]),
  eating: new Set([...MEAL_PLACE, "movie theater", "airplane interior", "convenience store", "izakaya", "festival", "market", "ryokan", "tavern"]),
  drinking: new Set(["cafe", "maid cafe", "bar (place)", "restaurant", "kitchen", "dining room", "cafeteria", "conveyor belt sushi", "yatai", "living room", "movie theater", "airplane interior", "izakaya", "festival", "market", "ryokan", "tavern", "ballroom", "courtyard", "garden", "balcony", "colonnade", "village"]),
  reading: new Set([...DESK_PLACE, "train", "train interior"]),
  cooking: COOK_PLACE,
  // 店和四家子店。子店 implies shop，只加子店時 commit 會因為 shop 不在
  // 這份清單上而整筆失敗。釘購物 120 張只有超商和超市，這五個是 0。
  // 洗衣店不是在購物，不收。
  shopping: new Set([
    "street",
    "city",
    "cityscape",
    "fitting room",
    "changing room",
    "convenience store",
    "supermarket",
    "market stall",
    "market",
    "festival",
    "village",
    "shop",
    "bakery",
    "clothes shop",
    "flower shop",
    "bookstore",
  ]),
  singing: new Set(["living room", "bar (place)", "park", "rooftop", "karaoke box", "church", "shrine", "festival", "ballroom", "ryokan", "colonnade", "tavern", "market", "courtyard", "castle"]),
  karaoke: new Set(["bar (place)", "living room", "karaoke box"]),
  "playing guitar": new Set(["bedroom", "living room", "park", "rooftop", "balcony", "garden"]),
  "playing games": new Set([...HOME_PLACE, "internet cafe"]),
  "playing video games": new Set([...HOME_PLACE, "internet cafe"]),
  "playing sports": SPORT_PLACE,
  studying: DESK_PLACE,
  writing: DESK_PLACE,
  "drawing (action)": new Set(["bedroom", "living room", "classroom", "cafe", "maid cafe", "park", "garden"]),
  "painting (action)": new Set(["bedroom", "living room", "garden", "park", "courtyard", "pavilion", "east asian architecture"]),
  dancing: new Set(["living room", "park", "rooftop", "school gym", "bar (place)", "fitness gym", "ballroom", "palace", "colonnade", "ryokan", "festival"]),
  stretching: new Set(["bedroom", "living room", "fitness gym", "park", "rooftop", "beach"]),
  yoga: new Set(["bedroom", "living room", "fitness gym", "park", "rooftop", "beach"]),
  exercising: SPORT_PLACE,
  training: new Set([...SPORT_PLACE, "battlefield", "dojo", "castle", "colonnade"]),
  archery: new Set(["garden", "park", "forest"]),
  fishing: FISH_PLACE,
  camping: new Set(["forest", "park", "bamboo forest", "garden", "ruins", "tent", "river", "field", "cave", "jungle", "rural"]),
  picnic: new Set(["park", "garden", "beach", "forest", "courtyard", "rural", "village"]),
  hiking: new Set(["forest", "park", "bamboo forest", "garden", "mountain", "river", "bridge", "field", "battlefield", "ruins", "colonnade", "cave", "jungle", "rural"]),
  jogging: new Set(["park", "street", "running track", "stadium", "garden", "city", "cityscape", "alley"]),
  skiing: new Set(["mountain"]),
  diving: new Set(["ocean", "underwater", "pool", "pond", "river"]),
  weightlifting: new Set(["fitness gym", "school gym"]),
  sunbathing: new Set(["beach", "poolside", "rooftop", "balcony", "park"]),
  sleeping: new Set([
    "bedroom",
    "hotel room",
    "love hotel",
    "living room",
    "bed",
    "apartment",
    "onsen",
    "ryokan",
    "tent",
    "train interior",
    "futon",
    "airplane interior",
    "canopy bed",
  ]),
  smoking: new Set(["balcony", "rooftop", "street", "alley", "bar (place)", "cafe", "maid cafe", "izakaya", "bridge", "courtyard"]),
  cleaning: new Set(["living room", "kitchen", "bedroom", "bathroom", "hallway", "office", "classroom", "church", "hospital", "infirmary", "prison"]),
  "talking on phone": new Set([
    "living room",
    "bedroom",
    "street",
    "office",
    "cafe",
    "maid cafe",
    "balcony",
    "airplane interior",
    "airport",
    "cockpit",
    "hospital",
    "clinic",
    "infirmary",
    "church",
    "prison",
    "construction site",
    "movie theater",
    "convenience store",
    "car interior",
  ]),
  selfie: new Set([
    "living room",
    "bedroom",
    "park",
    "beach",
    "cafe",
    "maid cafe",
    "rooftop",
    "church",
    "shrine",
    "airplane interior",
    "office",
    "hospital",
    "clinic",
    "infirmary",
    "prison",
    "dojo",
    "movie theater",
    "convenience store",
    "construction site",
    "car interior",
  ]),
  "taking picture": new Set(["park", "garden", "beach", "street", "shrine", "cafe", "maid cafe", "church", "dojo"]),
  driving: DRIVE_PLACE,
  "horseback riding": new Set(["forest", "park", "garden", "courtyard", "ruins"]),
  "riding bicycle": new Set(["street", "park", "city", "alley"]),
};
// 從 sports.js 補進新運動的場地，免得射箭掉進臥室、自行車掉到床上。
for (const [act, places] of Object.entries(SPORT_ACT_PLACE)) {
  ACT_PLACE[act] = new Set([...(ACT_PLACE[act] || []), ...places]);
}
// 時代招牌場地（castle / east asian architecture）出現在多少比例的圖上。
// 舊行為是無條件蓋章，等於 100%，而且會把唯一的場地格佔滿。
const PLACE_ANCHOR_CHANCE = 0.35;

// —— 沒有人物（no humans）——
// 這個引擎整個是繞著人物寫的：先挑卡司，再補長相、衣服、姿勢、活動、性愛，很多規則都看「誰在畫面上」。
// no humans 直接丟進隨機池會抽出「no humans, red hair, standing」這種東西，所以它是一個模式：
// 釘了它，那一張走 drawNoHumans（只抽場景），釘選時把人物相關的牌拿掉，兩者同時出現算相剋。
export const NO_HUMANS = "no humans";
const NO_HUMANS_INNER = Symbol("noHumansInner");
// 沒有人也說得通的鏡頭：拍景的遠近、角度。其餘（半身、全身、pov、背影…）都在說一個人。
const SCENERY_CAMERA = new Set(["wide shot", "very wide shot", "from above", "from below", "dutch angle", "fisheye"]);
// 場景段裡其實在說人的：一群人、人的剪影、單人焦點。
const PERSON_ENV = new Set(["crowd", "people", "silhouette"]);
// 背景裡的一群人。
const CROWD_TAGS = new Set(["crowd", "people"]);
// 不會有一群人的地方（自己家裡、關起門來的）。溫泉、澡堂是公共的，不在這裡。
const CROWD_BAD_PLACE = new Set([
  "bedroom", "hotel room", "love hotel", "bathroom", "bathtub", "bath", "shower (place)", "ofuro",
  "toilet stall", "changing room", "living room", "kitchen", "bubble bath", "car interior", "futon",
]);

/** 這個字需要畫面上有人嗎（no humans 模式下要拿掉的那些）。 */
export function isPersonTag(lex, tag) {
  if (tag === NO_HUMANS || tag === "scenery") return false;
  const it = lex.byTag.get(tag);
  if (!it) return false;
  if (it.section === "subject" || it.section === "feature" || it.section === "clothing") return true;
  if (it.section === "pose") return !SCENERY_CAMERA.has(tag);
  if (it.section === "env") {
    if (PERSON_ENV.has(tag) || it.group === "furniture") return true;
    if (it.gate && it.gate !== "any") return true;
    return (it.needs || []).length > 0;
  }
  return false;
}

// 背景格：沒有活動要配場地的時候，這個比例的圖改用素色／圖樣背景代替場地。
// Danbooru 上 simple background 有 290 萬張、white background 236 萬張，是全站最常見的
// 構圖之一（立繪、頭像、角色設定圖）；只靠釘選的話它永遠是 0。
// 只在現代：歷史時代的時代感一大半靠場地撐（見 fillSlot("env","place") 那段），不能拿掉。
const BACKGROUND_CHANCE = 0.12;
// 背景格裡常見的那幾個多給一點權重，圓點、網點這種當配角。
const COMMON_BG = new Set(["simple background", "white background", "grey background", "gradient background"]);
// 純色背景上還說得通的光：打在人身上的，不是來自場景的。
const BG_OK_LIGHT = new Set(["backlighting", "sidelighting", "spotlight", "shadow", "light rays", "dim lighting", "silhouette"]);

// 純色背景上放不下的景物：建築、地面、植物、水、天體、人群。桌椅、道具、鏡頭效果不在這裡 ——
// 「坐在椅子上的立繪」在素色背景上本來就很常見，拿著茶杯也是。
const BG_SCENERY = new Set([
  "veranda", "wooden floor", "stone lantern", "koi", "noren", "fusuma", "rock garden", "arch",
  "stone wall", "greco-roman architecture", "tower", "windmill", "bamboo", "pillar", "stone floor",
  "shouji", "tatami", "lotus", "willow", "pine tree", "water", "curtains", "tree", "carpet", "bush",
  "locker", "campfire", "stained glass", "iron bars", "railing", "tiles", "rubble", "crowd", "people", "grass",
  "sand", "moss", "full moon", "falling leaves",
]);

/** 跟純色／圖樣背景放不到一起的東西：天空、天氣、傢俱格、景物、來自場景的光源。 */
function bgClash(item) {
  if (!item) return false;
  if (item.group === "sky" || item.mutex === "weather" || item.group === "furniture") return true;
  if (BG_SCENERY.has(item.tag)) return true;
  return item.group === "light" && !BG_OK_LIGHT.has(item.tag);
}

// 活動定下來之後蓋一個道具上去。每一項是**候選集合**，不是優先序 ——
// stampActProps() 會先用 eraOk／heatOk 篩掉不合的，再從剩下的隨機挑一個。
//
// 早期每一項都只有一個字，於是 12 個活動的道具是 100% 固定的：實測 9600 張，
// 每一張 cooking 都是平底鍋、每一張 cleaning 都是掃把、每一張 writing 都是原子筆。
// 而那個「唯一」在非現代時代還是錯的 —— 江戶抽菸 22/22 拿香菸、古中國寫字
// 50/50 拿原子筆。時代分支靠的是各道具自己的 era 欄（見 merge_lexicon.py），
// 不是寫死在這張表裡：這裡列出所有可能，篩選交給既有的 eraOk。
const ACT_PROP = {
  "playing guitar": ["guitar"],
  reading: ["book", "newspaper"],
  studying: ["book"],
  writing: ["calligraphy brush", "quill", "pen", "pencil"],
  "talking on phone": ["cellphone"],
  selfie: ["cellphone"],
  "taking picture": ["cellphone", "camera"],
  smoking: ["kiseru", "smoking pipe", "cigar", "cigarette"],
  cooking: ["frying pan", "ladle"],
  shopping: ["shopping bag"],
  driving: ["steering wheel"],
  "riding bicycle": ["bicycle"],
  cleaning: ["broom", "mop", "bucket"],
  fishing: ["fishing rod"],
  "playing video games": ["game controller"],
  "painting (action)": ["paintbrush"],
  // 跟 writing 同一組筆，由 eraOk 篩。不蓋 paintbrush：那是繪畫的身份。
  // 實測釘 drawing (action) 40/40 沒有鉛筆／原子筆。
  "drawing (action)": ["calligraphy brush", "quill", "pen", "pencil"],
  karaoke: ["microphone"],
  singing: ["microphone"],
  // 直播蓋手機，不蓋麥克風：麥克風是唱歌／卡拉 OK 的身份。cellphone 沒有
  // NEEDS_CONTEXT，stamp 後不會被剝。實測釘 livestream 40/40 沒道具。
  livestream: ["cellphone"],
};
const JOB_PLACE = {
  "office lady": new Set(["office"]),
  salaryman: new Set(["office"]),
  // 保健室跟診所、醫院是同一類房間。釘護士 80 張原本全落在後兩個。
  // 保健室不在 SPORT_PLACE，加進來不會多放行任何活動。
  nurse: new Set(["clinic", "hospital", "infirmary"]),
  doctor: new Set(["clinic", "hospital", "infirmary"]),
  teacher: new Set(["classroom", "library", "school gym"]),
  // 女僕咖啡廳 implies cafe，cafe 已在清單上。沒有廳本身的話服務員到不了那家店。
  waitress: new Set(["restaurant", "cafe", "maid cafe", "bar (place)", "izakaya"]),
  barista: new Set(["cafe", "restaurant"]),
  chef: new Set(["kitchen", "restaurant"]),
  policewoman: new Set(["street", "city", "cityscape", "alley", "office", "prison"]),
  // 女僕原本只有六個場地，而其中 mansion 是維多利亞、palace 是古中國／中世紀，
  // 所以**現代的女僕實際上只有四個地方可去**：釘 maid 抽 3000 張，只看得到
  // living room 1583、hotel room 682、kitchen 641、bedroom 94 —— 一半以上都在客廳。
  // 女僕是很常抽到的一件衣服，每次都長一樣。補完是 9 種、客廳從 53% 降到 34%。
  //
  // 補的都還是「女僕會在的地方」，不是把限制拿掉：走廊（janitor 本來就有它）、
  // 庭園、陽台、溫室、書房。
  //
  // **刻意不補 courtyard**，儘管它看起來跟庭園一樣合理。路徑是這樣的：
  //
  //   1. courtyard 在 SPORT_PLACE 裡（見上面那個 Set），而 playing sports／
  //      exercising／training 的場地清單就是 SPORT_PLACE。
  //   2. 下面 allow() 有一條（搜 actFitsSomePlaces(item.tag, JOB_PLACE.maid)）：
  //      場上有女僕又沒有真正的職業 tag 時，**活動候選**必須至少能在女僕的某個
  //      場地發生。補了 courtyard，這一關對運動活動就變成通過 —— 於是運動活動
  //      開始跟女僕裝一起抽出來。
  //   3. 但那一關**不看時代**。預設時代是現代，而 courtyard 的 era 只有
  //      古中國／古希臘／中世紀。放行的理由（可以在中庭運動）在現代根本不存在，
  //      所以場地那一格誰也排不進去。
  //
  // 實測：補 courtyard 之後釘 maid 的 3000 張裡冒出 178 張運動圖，而且**每一張都
  // 沒有場地**（0 -> 178）。少補這一個就完全沒有這條路。
  //
  // 咖啡廳要補，跟中庭是相反的情況。釘女僕再釘吃飯，80 張裡 cafe 是 0：
  // 吃飯清單裡有 cafe，女僕清單沒有，placeFitsJob 先拒了。女僕咖啡廳 implies
  // cafe，只加子字的話 commit 同樣退回。兩個都是現代、都不在 SPORT_PLACE。
  // 對過活動表：加進去之後，現代沒有任何原本排不進女僕場地的活動因此過關。
  maid: new Set([
    "mansion", "kitchen", "living room", "bedroom", "hotel room", "palace",
    "hallway", "balcony", "greenhouse", "library", "garden",
    "cafe", "maid cafe",
  ]),
  "flight attendant": new Set(["airplane interior", "airport", "cockpit"]),
  firefighter: new Set(["street", "city", "cityscape"]),
  scientist: new Set(["laboratory"]),
  farmer: new Set(["farm", "barn", "rice paddy"]),
  "construction worker": new Set(["construction site"]),
  janitor: new Set(["hallway", "classroom", "office", "hospital", "school gym", "living room"]),
  "race queen": new Set(["stadium", "street", "city"]),
  soldier: new Set(["ruins", "street", "city", "forest"]),
  butler: new Set(["mansion", "living room", "hallway", "ballroom", "palace"]),
  detective: new Set(["office", "street", "city", "cityscape", "alley", "library"]),
  ballerina: new Set(["stage"]),
  dominatrix: new Set(["dungeon", "bedroom"]),
  astronaut: new Set(["space"]),
  bartender: new Set(["bar (place)"]),
  wizard: new Set(["library", "mansion"]),
  lifeguard: new Set(["beach", "pool", "poolside"]),
  // 西部牛仔女。不要寫成 cowgirl，那是騎乘位。
  "cowgirl (western)": new Set(["farm", "barn", "street"]),
  stripper: new Set(["stage"]),
  // 沒有攝影棚。模特兒不硬綁舞台。
  cashier: new Set(["convenience store", "supermarket"]),
  coach: new Set(["school gym", "fitness gym"]),
  queen: new Set(["palace"]),
};
const RAPE_BAD_PLACE = new Set(["classroom", "bedroom", "living room", "kitchen", "bed", "futon"]);
// 運動互斥全部從 web/sports.js 那份單一資料來源算出來。以前這裡自己列球、球拍、
// 制服和 SPORT_KIT 四份清單，改一個地方就會跟其他三份失同步。
//
// 判斷方式是「運動身分」：每個帶身分的 tag 記著哪些運動用得到它，場上所有這種 tag
// 的交集如果空了就是混到別的運動。所以 tennis racket + tennis ball 本來就共存
// （兩個都只屬於網球），但 basketball court + soccer ball 交集是空的，擋掉。
// 球鞋、運動服這類通用裝備不帶身分，不會害任何運動互斥。
const SPORT_VENUES = new Set();
const SPORT_ACTS = new Set();
for (const p of SPORT_PRESETS) {
  for (const v of p.venue || []) SPORT_VENUES.add(v);
  if (p.activity) SPORT_ACTS.add(p.activity);
}

function sportFieldOf(used) {
  for (const t of used) {
    if (SPORT_VENUES.has(t)) return t;
  }
  return null;
}

function sportKitOk(item, used) {
  return sportTagAllowed(item.tag, used);
}

/**
 * 運動器材本身就限定場地：球拍、腳踏車、弓在浴室裡不成立。
 *
 * 活動 tag 不再釘死之後（改由尺度決定），沒有場地的運動就失去了 ACT_PLACE 的約束，
 * 自行車會掉進浴室。這裡補回來：場上看得出是哪個運動，場地就必須是那個運動的
 * 場地，或它的活動本來就允許的場地。查不到場地資訊的運動不限制。
 */
function compatibleSportPlaces(ids) {
  const okPlaces = new Set();
  if (!ids || !ids.size) return okPlaces;
  for (const sp of SPORT_PRESETS) {
    if (!ids.has(sp.id)) continue;
    for (const v of sp.venue || []) okPlaces.add(v);
    for (const pl of ACT_PLACE[sp.activity] || []) okPlaces.add(pl);
  }
  return okPlaces;
}

/**
 * 一組運動身分與一組場地是否相容。候選 gate 與釘選 warning 共用這個純函式，
 * 避免兩邊各抄一份場地清單後逐漸失同步。
 */
export function sportIdsFitPlaces(ids, places) {
  if (!ids || !ids.size || !places || !places.size) return true;
  const okPlaces = compatibleSportPlaces(ids);
  if (!okPlaces.size) return true;
  for (const place of places) if (okPlaces.has(place)) return true;
  return false;
}

// 床不是 place，但它就是床。usedPlaces() 只收 mutex==="place"／group==="place"，
// 而 on bed 的 mutex 是 furniture，所以運動器材的場地檢查從**兩個方向**都漏掉它。
// 以前沒人發現，是因為 bicycle 和 on bed 在舊的 env 配額下都抽不到；配額調到 6
// 之後第一次跑就抽出「自行車 + on bed」—— 床上騎腳踏車。
// "on sofa" 在這裡放了很久，但**詞庫裡從來沒有那個字** —— Danbooru 的正規名是
// on couch（on sofa 是它的別名），而我們收的是 couch。也就是說這條防護對沙發
// 一次都沒有生效過。on couch 現在補進詞庫了，這裡跟著指對。
const SPORT_BAD_FURNITURE = new Set(["on bed", "bunk bed", "on couch"]);

function sportPlaceOk(item, used) {
  const placeLike =
    item.mutex === "place" || item.group === "place" || SPORT_BAD_FURNITURE.has(item.tag);
  if (!placeLike) return true;
  // 只看器材，不看服裝：穿排球服在廚房是可以的，浴室騎腳踏車不行。
  return sportIdsFitPlaces(sportGearIdsOf(used), new Set([item.tag]));
}

// sportPlaceOk() 的反向。上面那支只在「候選是場地」時擋，所以場地先定、器材後抽
// 就整個繞過去了 —— 客廳抽到網球拍就是這樣來的（網球服先進場給了運動身分，
// 球拍再跟著合法進來）。意圖在 sportPlaceOk 的註解裡寫得很清楚：浴室騎腳踏車不行。
// 兩個方向都要擋，規則才不會被抽取順序左右。
//
// SPORT_GEAR_IDENTITY 裡的不只是手持器材，還包含活動與場地本身 —— 這是刻意的：
// 補牌補回來的活動在場地定了之後，要受同一個方向的檢查。它唯一排除的是服裝，
// 所以穿網球服待在客廳可以，把球拍或「打網球」這個動作放進客廳不行。
function sportGearPlaceOk(item, used, lex) {
  const own = SPORT_GEAR_IDENTITY.get(item.tag);
  if (!own || !own.size) return true;
  const places = new Set(usedPlaces(used, lex));
  for (const t of used) if (SPORT_BAD_FURNITURE.has(t)) places.add(t);
  return sportIdsFitPlaces(own, places);
}

// 同一個場地字，室內、室外都畫得成。釘了其中一邊時，不要因為詞庫的 implies
// 把這個場地擋掉，也不要再補上相反的那個字；沒有釘室內外時，詞庫的 implies 照舊。
// 臥室、廚房、辦公室、浴室不在這裡：那些釘了室外仍然不該出現。
const BOTH_IO = new Set([
  "onsen",
  "bath",
  "dojo",
  "pool",
  "castle",
  "shrine",
  "temple",
  "church",
  "palace",
  "mansion",
  "ruins",
  "greenhouse",
  "ryokan",
  "courtyard",
  "cafe",
  "bar (place)",
  "restaurant",
  "izakaya",
  "tavern",
]);

function oppositeInOut(dep) {
  if (dep === "indoors") return "outdoors";
  if (dep === "outdoors") return "indoors";
  return "";
}

// 兩邊都行的場地，對方那一側已經在場上時，略過詞庫要補的室內／室外。
function keepPlaceSide(tag, dep, otherIsIn) {
  const other = oppositeInOut(dep);
  return !!other && BOTH_IO.has(tag) && otherIsIn(other);
}

// 以前沒釘場所的性愛只准一份私密白名單，公園、沙灘、大街、神社整組進不來。
// 那張表已拿掉：性愛跟其他熱度用同一池場地，再由活動和職業把自己的場地收窄。
// 職業這條仍避開公開場所，除非這個職業的場地全是公開的（消防員只有大街）。
const PUBLIC_SEX_PLACE = new Set(["street", "city", "cityscape", "alley", "park", "beach", "ocean", "rooftop"]);

// sceneMode / lockScene / realistic — single source: ./scene-policy.js
// (re-exported above; drawOne hoists scenePolicyOf once; lockSceneOn for pin warnings)

function usedJobs(used, lex) {
  const hit = recall(used, "_jobs");
  if (hit !== undefined) return hit;
  const s = new Set();
  for (const t of used) {
    if (lex.byTag.get(t)?.mutex === "job") s.add(t);
  }
  return remember(used, "_jobs", s);
}

function placeFitsJob(place, jobs, used) {
  if (jobs.size) {
    for (const j of jobs) {
      const ok = JOB_PLACE[j];
      if (ok && !ok.has(place)) return false;
    }
    return true;
  }
  if (used && used.has("maid") && JOB_PLACE.maid && !JOB_PLACE.maid.has(place)) {
    if (isSwimScene(used) || isBathScene(used)) return true;
    return false;
  }
  return true;
}

export function placeFitsActs(place, acts, realistic = false) {
  if (!acts.size) return true;
  if (realistic) {
    let listed = 0;
    for (const a of acts) {
      const ok = ACT_PLACE[a];
      if (!ok) continue;
      listed += 1;
      if (!ok.has(place)) return false;
    }
    if (listed === acts.size) return true;
  }
  if (acts.has("fishing")) return FISH_PLACE.has(place);
  if ([...acts].some((a) => WATER_ACT.has(a))) return WATER_PLACE.has(place);
  if (acts.has("horseback riding")) return !INDOOR_ROOM.has(place) && !BATH_PLACE.has(place);
  if (acts.has("driving")) return DRIVE_PLACE.has(place);
  if (acts.has("cooking")) return COOK_PLACE.has(place);
  if (acts.has("picnic")) {
    return (
      !INDOOR_ROOM.has(place) &&
      !BATH_PLACE.has(place) &&
      place !== "underwater" &&
      place !== "ocean" &&
      place !== "pool"
    );
  }
  if (acts.has("camping")) {
    return (
      ["forest", "park", "bamboo forest", "garden", "ruins"].includes(place) ||
      (!INDOOR_ROOM.has(place) && place !== "cityscape" && place !== "city" && place !== "street" && !BATH_PLACE.has(place))
    );
  }
  if (acts.has("playing sports") || acts.has("exercising") || acts.has("training")) return SPORT_PLACE.has(place);
  if (acts.has("hiking")) return !INDOOR_ROOM.has(place) && !BATH_PLACE.has(place);
  if (acts.has("skiing")) return place === "mountain";
  if (acts.has("karaoke")) {
    if (realistic) return place === "bar (place)" || place === "living room" || place === "karaoke box";
    return place !== "elevator" && !BATH_PLACE.has(place);
  }
  if (acts.has("playing guitar")) return !BATH_PLACE.has(place);
  if (acts.has("playing video games") || acts.has("playing games")) return !BATH_PLACE.has(place);
  if (acts.has("shopping")) return !BATH_PLACE.has(place) && place !== "bedroom";
  if (acts.has("sunbathing")) return !INDOOR_ROOM.has(place) && !BATH_PLACE.has(place);
  if (acts.has("studying") || acts.has("writing")) return !BATH_PLACE.has(place) && place !== "bar (place)";
  return true;
}

function actFitsPlaces(act, places, realistic = false) {
  if (!places.size) return true;
  return [...places].every((p) => placeFitsActs(p, new Set([act]), realistic));
}

function actFitsSomePlaces(act, places, realistic = false) {
  if (!places.size) return true;
  return [...places].some((p) => placeFitsActs(p, new Set([act]), realistic));
}

/**
 * 把一份場地清單收斂成「這個時代真的存在的那些」。
 *
 * 場地清單（JOB_PLACE、ACT_PLACE）都是不分時代寫的，拿它們做可行性判斷時必須先
 * 過這一關，否則會用一個當下根本不存在的場地去證明「有地方可去」。
 */
export function placesInEra(places, lex, era) {
  const out = new Set();
  for (const p of places) {
    const it = lex.byTag.get(p);
    if (it && eraOk(it, era)) out.add(p);
  }
  return out;
}

function jobPlacesOf(jobs) {
  const s = new Set();
  for (const j of jobs) {
    for (const p of JOB_PLACE[j] || []) s.add(p);
  }
  return s;
}

function isBathScene(used) {
  const hit = recall(used, "_bath");
  if (hit !== undefined) return hit;
  for (const t of used) {
    if (BATH_ACT.has(t)) return remember(used, "_bath", true);
  }
  for (const t of used) {
    if (t === "bathroom") continue;
    if (BATH_PLACE.has(t)) return remember(used, "_bath", true);
  }
  return remember(used, "_bath", false);
}

function isSwimAct(used) {
  return used.has("swimming") || used.has("diving");
}

function isSwimScene(used) {
  const hit = recall(used, "_swim");
  if (hit !== undefined) return hit;
  if (used.has("fishing") && !isSwimAct(used) && !used.has("wading")) {
    return remember(used, "_swim", false);
  }
  if (isSwimAct(used) || used.has("wading")) return remember(used, "_swim", true);
  for (const t of used) {
    if (t === "pool" || t === "poolside" || t === "beach" || t === "ocean" || t === "underwater") {
      return remember(used, "_swim", true);
    }
  }
  return remember(used, "_swim", false);
}

function isSwimClothItem(item) {
  if (!item || item.section !== "clothing") return false;
  if (item.layer === "skin" || item.layer === "accessory") return true;
  if (item.tag === "wet clothes" || item.tag === "swim briefs") return true;
  if (/\b(swimsuit|bikini)\b/.test(item.tag)) return true;
  if ((item.implies || []).some((d) => /\b(swimsuit|bikini)\b/.test(d))) return true;
  return false;
}

function pinnedNonSwimGarment(used, pinned, lex) {
  for (const t of pinned) {
    const it = lex.byTag.get(t);
    if (it && it.section === "clothing" && it.layer === "garment" && !isSwimClothItem(it)) return true;
  }
  return false;
}

function swimwearLocked(used, pinned, lex, era, realistic) {
  return realistic && isSwimScene(used) && !pinnedNonSwimGarment(used, pinned, lex);
}

function garmentOkForSwim(item, era) {
  if (isSwimClothItem(item)) return true;
  if (/\b(armor|suit|maid)\b/.test(item.tag)) return false;
  // 沒有人披著斗篷游泳。歷史時代一件泳裝都沒有，底下那句 return true 等於
  // 讓整套外衣跟著下水 —— 古希臘有九成七的游泳畫面裹著 himation。
  if (item.mutex === "outer") return false;
  if (era === "modern") return false;
  return true;
}

function sceneClothKind(used) {
  const hit = recall(used, "_scene");
  if (hit !== undefined) return hit;
  return remember(used, "_scene", sceneClothKindOf(used));
}

function sceneClothKindOf(used) {
  if (isSwimAct(used) || used.has("underwater")) return "swim";
  if (used.has("changing room") || used.has("locker room") || used.has("fitting room")) return "dressing";
  if (isBathScene(used)) return "bath";
  if (
    !isSwimAct(used) &&
    (used.has("beach") || used.has("poolside") || used.has("ocean") || used.has("pool"))
  ) {
    return "shore";
  }
  if (used.has("office lady") || used.has("salaryman") || used.has("office")) return "office";
  if (used.has("nurse")) return "nurse";
  if (used.has("maid")) return "maid";
  if (used.has("policewoman") || used.has("police uniform")) return "police";
  if (used.has("classroom") || used.has("school uniform")) return "school";
  if (used.has("kitchen") || used.has("cooking")) return "kitchen";
  if (used.has("flight attendant") || used.has("airplane interior") || used.has("cockpit")) return "cabin";
  if (used.has("skiing")) return "sport";
  if (used.has("firefighter")) return "fire";
  if (used.has("scientist") || used.has("laboratory")) return "lab";
  if (used.has("construction worker") || used.has("construction site")) return "site";
  if (used.has("nun") || used.has("church")) return "church";
  if (used.has("prison")) return "prison";
  if (used.has("dojo")) return "dojo";
  if (used.has("driving") || used.has("car interior") || used.has("car")) return "drive";
  if (used.has("sleeping")) return "sleep";
  if (used.has("shopping") || used.has("convenience store") || used.has("supermarket")) return "shop";
  if (used.has("karaoke") || used.has("karaoke box") || used.has("singing")) return "indoor";
  if (
    sportFieldOf(used) ||
    [...used].some((t) => SPORT_ACTS.has(t)) ||
    used.has("fitness gym") ||
    used.has("school gym") ||
    used.has("exercising") ||
    used.has("training") ||
    used.has("weightlifting")
  ) {
    return "sport";
  }
  if (used.has("indoors") && !isSwimScene(used) && !isBathScene(used)) return "indoor";
  return null;
}

const SCENE_BAD_CLOTH = {
  office: /\b(swimsuit|bikini|armor|hakama|maid|kimono|yukata|school swimsuit|evening gown|wedding dress)\b/,
  school: /\b(swimsuit|bikini|armor|maid|evening gown|police uniform|wedding dress|hard hat|soccer uniform|basketball uniform|tennis uniform|volleyball uniform)\b/,
  nurse: /\b(swimsuit|bikini|armor|maid|school uniform|serafuku|evening gown|hakama|police|wedding dress|baseball uniform|soccer uniform|tennis uniform|volleyball uniform|basketball uniform|cheerleader)\b/,
  maid: /\b(swimsuit|bikini|armor|school uniform|police|evening gown|hakama|lab coat)\b/,
  police: /\b(swimsuit|bikini|maid|school swimsuit|evening gown|hakama|armor)\b/,
  kitchen: /\b(swimsuit|bikini|armor|evening gown|hakama|police)\b/,
  cabin: /\b(swimsuit|bikini|armor|maid|wedding dress|yukata|hakama|kimono|cheerleader)\b/,
  fire: /\b(swimsuit|bikini|wedding dress|maid|yukata|evening gown)\b/,
  lab: /\b(swimsuit|bikini|armor|maid|wedding dress)\b/,
  site: /\b(swimsuit|bikini|wedding dress|evening gown|yukata|maid)\b/,
  church: /\b(swimsuit|bikini|armor|maid|police uniform)\b/,
  prison: /\b(wedding dress|evening gown|swimsuit|bikini|playboy bunny|idol clothes|cheerleader|maid)\b/,
  sport: /\b(armor|maid|wedding dress|evening gown|hakama|yukata|kimono|lab coat)\b/,
  dojo: /\b(swimsuit|bikini|basketball uniform|tennis uniform|soccer uniform|volleyball uniform|cheerleader|maid)\b/,
  drive: /\b(swimsuit|bikini|armor|evening gown|wedding dress|hakama|school swimsuit|cheerleader|maid)\b/,
  dressing: /\b(armor|suit|evening gown|wedding dress|hakama|lab coat)\b/,
  shore: /\b(armor|suit|maid|evening gown|wedding dress|lab coat|hakama)\b/,
  sleep: /\b(swimsuit|bikini|armor|cheerleader|wedding dress|evening gown|school swimsuit)\b/,
  shop: /\b(swimsuit|bikini|armor|evening gown|wedding dress|school swimsuit)\b/,
  indoor: /\b(swimsuit|bikini|armor|school swimsuit|cheerleader)\b/,
};

// 不使用 onepiece/bottom mutex、但畫面上確實遮到下半身的服裝。engine 早期只認
// 三個 body mutex，於是 kimono、ancient greek clothes 這種整套服裝和
// underwear_bottom 的 loincloth 在補救邏輯眼中等於沒穿。
const LOWER_COVER_TAGS = new Set([
  "dress",
  "school uniform",
  "leotard",
  "bodysuit",
  "skirt",
  "shorts",
  "pants",
  "swimsuit",
  "bikini",
  "one-piece swimsuit",
  "panties",
  "chinese clothes",
  "ancient greek clothes",
  "armor",
  "chainmail",
  "kimono",
  "japanese clothes",
  "yukata",
  "sportswear",
  "loincloth",
]);

// 本身就已經含外衣的整套服裝。再疊一件休閒外套就變成兩件外套 ——
// 使用者回報的就是這個：釘了軍服，結果圖裡「military uniform, blue jacket, jacket」。
//
// 實測釘下去之後身上多一件外套的比例：女僕裝 92%、軍服／警服／西裝 75%、
// 婚紗 66%、水手服 66%。不是偶發。
//
// 這裡只收「整套本來就有外衣」或「整套是完整造型」的。洋裝、泳裝、比基尼
// 不在內 —— 洋裝配大衣、比基尼配罩衫都是正常搭配，那一格要留著。
const OUTFIT_HAS_OUTER = new Set([
  "military uniform",
  "police uniform",
  "business suit",
  "suit",
  "tuxedo",
  "gakuran",
  "nun",
  "bathrobe",
  "maid",
  "santa costume",
  "miko",
  "plate armor",
  "japanese armor",
  "chinese armor",
  "leather armor",
  "power armor",
]);

// 整套的時代服裝：底下不該再塞別的時代的上下身衣服。
// 和服配襯衫配裙子不是搭配，是三件不相干的衣服疊在一起（實測釘和服有 32% 配襯衫、
// 26% 配裙子）。值得注意的是這不是時代判斷錯 —— 和服出現在現代場景很正常，
// 廟會就是這樣穿；錯的是**底下那件**。
// 對應的時代寫在值裡，所以同時代的搭配仍然成立（和服配袴、漢服配襦裙）。
const ERA_OUTFIT_ERA = new Map([
  ["kimono", "edo"],
  ["yukata", "edo"],
  ["white kimono", "edo"],
  ["blue kimono", "edo"],
  ["purple kimono", "edo"],
  ["bath yukata", "edo"],
  ["japanese clothes", "edo"],
  ["hanfu", "ancient_china"],
  ["ruqun", "ancient_china"],
  ["tangzhuang", "ancient_china"],
  ["chinese clothes", "ancient_china"],
  ["toga", "ancient_greece"],
  ["chiton", "ancient_greece"],
  ["peplos", "ancient_greece"],
  ["ancient greek clothes", "ancient_greece"],
]);

// 足袋、女用木屐是江戶鞋子，但不是主軸。跟木屐、草履同一階（時代加權 30）時，
// 900 張裡木屐＋草履只剩 43%。不吃時代加權；在非現代還跟其他「不是這個時代的鞋子」
// 一起放到更低的衣服階。女用木屐仍帶出木屐，足袋仍佔鞋子格。
const EDO_SIDE_FEET = new Set(["tabi", "okobo"]);

const BODY_GARMENT_SLOTS = new Set(["onepiece", "top", "bottom"]);

function bodyGarmentSlot(item) {
  if (!item || item.section !== "clothing" || item.layer !== "garment") return null;
  if (BODY_GARMENT_SLOTS.has(item.mutex)) return item.mutex;
  if (BODY_GARMENT_SLOTS.has(item.group)) return item.group;
  return null;
}

function isBodyGarment(item) {
  return Boolean(bodyGarmentSlot(item)) || LOWER_COVER_TAGS.has(item?.tag);
}

function coversLowerBody(item) {
  const slot = bodyGarmentSlot(item);
  return slot === "onepiece" || slot === "bottom" || LOWER_COVER_TAGS.has(item?.tag);
}

function isBathOkGarment(item) {
  if (!item || item.section !== "clothing") return true;
  if (item.layer === "skin") return true;
  const t = item.tag;
  return (
    t === "wet clothes" ||
    t === "naked towel" ||
    t === "bathrobe" ||
    t === "yukata" ||
    t === "bath yukata" ||
    t === "fundoshi" ||
    t === "loincloth" ||
    t === "japanese clothes" ||
    t === "chinese clothes" ||
    t === "hanfu" ||
    t === "ruqun" ||
    t === "ancient greek clothes" ||
    // 亞麻襯衣提供中世紀／維多利亞女性浴場的非裸體選項。
    t === "chemise"
  );
}

// 需要場合才成立的配件。沒有對應的活動／場地／身分就不該出現。
//
// 以前這些是在 allow() 裡一條一條手寫的 if，寫到哪擋到哪：stethoscope、hard hat、
// police hat、lab coat 有，goggles、swim cap、boxing gloves、microphone 沒有 ——
// 結果辦公室裡有人戴蛙鏡、教堂裡有人拿麥克風、溫泉裡有人戴拳擊手套。
// 運動服沒有互斥格。沒有這張表時，收尾的低機率會把它蓋到西裝、旗袍、泳裝上。
const SPORTWEAR_NEEDS = new Set([
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

export const NEEDS_CONTEXT = {
  "beach umbrella": new Set(["beach", "poolside"]),
  innertube: new Set(["swimming", "wading", "floating", "pool", "poolside", "beach", "ocean"]),
  goggles: new Set([
    "swimming", "diving", "pool", "poolside", "underwater", "ocean", "skiing",
    "laboratory", "scientist", "construction site", "construction worker",
  ]),
  "swim cap": new Set(["swimming", "diving", "pool", "poolside", "underwater", "ocean"]),
  "boxing gloves": new Set(["boxing", "fitness gym", "stadium", "training", "exercising"]),
  "knee pads": new Set([
    "playing sports", "exercising", "training", "skiing", "basketball", "volleyball",
    "skating", "stadium", "school gym", "fitness gym",
  ]),
  microphone: new Set(["singing", "karaoke"]),
  clipboard: new Set([
    "office", "office lady", "salaryman", "teacher", "classroom", "nurse", "doctor",
    "clinic", "hospital", "laboratory", "scientist", "construction site",
  ]),
  // 這四個是原本手寫規則允許的範圍，原樣搬過來。騎士配頭盔照理也說得通，
  // 但那是擴大行為、不是修這個 bug，這次不動。
  helmet: new Set(["riding bicycle", "skiing", "construction site", "construction worker"]),
  "bicycle helmet": new Set(["riding bicycle", "street", "city", "park", "stadium"]),
  "shoulder armor": new Set([
    "armor", "plate armor", "leather armor", "chinese armor", "japanese armor",
    "knight", "samurai", "gladiator", "viking", "battlefield", "castle",
  ]),
  // 寵物／拘束類的東西要有那個情境，不能當成一般飾品隨便出現
  "animal collar": new Set(["pet play", "leash", "bondage", "bdsm"]),
  leash: new Set(["pet play", "animal collar", "collar", "bondage", "bdsm"]),
  handcuffs: new Set(["bondage", "bdsm", "prison", "policewoman", "police uniform"]),
  "o-ring": new Set(["bondage", "bdsm", "lingerie", "swimsuit", "bikini"]),
  // 襪勒肉、戴上兜帽的前提是衣服。特徵比衣服先抽，所以不能在 allow() 裡問，
  // 這裡等衣服定案再刪。釘選和必抽留著。
  skindentation: new Set(["thighhighs", "pantyhose", "kneehighs", "socks"]),
  "hood up": new Set(["hoodie", "hood", "hooded cloak"]),
  // 濕也是特徵，比場地和天氣先抽。沒有水、雨、雪就在收尾拿掉。
  // 漂浮可以在空中，不能單獨證明身上是濕的。
  wet: new Set([
    ...WATER_PLACE,
    ...BATH_PLACE,
    ...WATER_SOURCE_ACT,
    ...WATER_DETAIL,
    "rain",
    "snow",
    "lake",
    "river",
    "sea",
    "water",
  ]),
  // 桌子底下要先有桌子。少了這條，「under table」會變成傢俱那一格最好填的字
  // （它幾乎不跟任何姿勢衝突），實測佔掉那一格的 64%，還把 on bed 從 8 擠到 3 ——
  // 而且畫面上根本沒有桌子。on desk 同理。
  "under table": new Set(["table", "desk", "poker table", "counter", "kotatsu"]),
  // 我從語料加進來的那批道具，原本一個前提都沒寫，於是它們散落到任何地方 ——
  // 實測 4200 張裡 desk lamp 有 93% 出現在沒有桌子、書房、臥室的場合（它掛在
  // lighting 互斥格，而那一格 100% 的圖都會填，所以它會去照亮海灘和溫泉），
  // nightstand／poker table／sink／steering wheel／whiteboard 更是 100%。
  // 這正是這張表上面 cleats 那條註解在講的同一件事：沒有那個場合就不該出現。
  "desk lamp": new Set(["desk", "on desk", "office", "bedroom", "classroom", "library", "hotel room", "studying", "writing", "reading"]),
  nightstand: new Set(["bedroom", "hotel room", "love hotel", "bed", "on bed"]),
  "poker table": new Set(["casino", "nightclub", "bar (place)"]),
  sink: new Set(["bathroom", "kitchen", "clinic", "hospital"]),
  counter: new Set(["kitchen", "cafe", "maid cafe", "bar (place)", "restaurant", "convenience store", "supermarket", "izakaya"]),
  "steering wheel": new Set(["car", "car interior", "driving", "cockpit", "airplane interior", "racing suit"]),
  "shopping cart": new Set(["supermarket", "convenience store", "shopping", "market"]),
  "microphone stand": new Set(["singing", "karaoke", "karaoke box", "bar (place)", "livestream"]),
  whiteboard: new Set(["classroom", "office", "teacher", "laboratory", "studying"]),
  "christmas tree": new Set(["christmas", "winter", "living room"]),
  "on desk": new Set(["desk", "table", "classroom", "office", "whiteboard"]),
  // 沙發要有個放沙發的地方。這一格六個字裡，on bed 有 BED_PLACE、bunk bed 要
  // 臥室或旅館房間、on desk 與 under table 有這張表、on chair 有一串動作衝突 ——
  // 只有 on couch 什麼前提都沒有，於是它在傢俱這一格佔到 53～57%，
  // 剛好在稽核那條 55% 集中度上下翻面。補上前提之後跟其他五個對稱。
  //
  // 名單取「會擺沙發的室內場所」。Danbooru 上 couch 有 77,265 張但只有 866 張
  // 同時標 living room —— 那是因為多數沙發圖根本沒標房間，不是沙發不在客廳，
  // 所以這裡按語意列，不按共現率剪。
  "on couch": new Set([
    "living room", "hotel room", "love hotel", "apartment", "mansion",
    "cafe", "bar (place)", "office", "internet cafe", "karaoke box",
    "nightclub", "casino", "movie theater", "clinic", "ryokan",
  ]),
  shibari: new Set(["bondage", "bdsm", "restrained"]),
  "bound wrists": new Set(["bondage", "bdsm", "restrained", "handcuffs"]),
  "ball gag": new Set(["bondage", "bdsm", "restrained"]),
  "nipple clamps": new Set(["bondage", "bdsm", "restrained"]),
  "remote control vibrator": new Set(["bondage", "bdsm", "restrained", "sex toy", "vibrator"]),

  // 衣服也適用同一條規則。這張表本來只收配件，但「沒有那個場合就不該出現」
  // 跟它是配件還是衣服無關 —— 實測釘女僕裝會配到足球釘鞋 33%，全庫 2800 張裡
  // cleats 出現 274 次而其中 90% 身上沒有任何運動場合。
  // 與其另開一張衣服專用的表，不如把這張表的名字改對（本來就沒有濾 layer）。
  cleats: new Set([
    "playing sports", "exercising", "training", "soccer", "track and field",
    "baseball", "jogging", "stadium", "sports court", "running track",
    "school gym", "fitness gym", "field",
  ]),
  "swim briefs": new Set(["swimming", "diving", "pool", "poolside", "ocean", "beach", "underwater"]),
  "gym uniform": new Set([
    "playing sports", "exercising", "training", "school gym", "stadium",
    "sports court", "running track", "fitness gym",
  ]),
  "track uniform": new Set([
    "track and field", "jogging", "running track", "stadium", "playing sports",
    "exercising", "training", "school gym",
  ]),
  sportswear: SPORTWEAR_NEEDS,

  // 三把傘原本是 allow() 裡各自一行的 if。但傘要看的天氣和場地都排在衣服後面才填，
  // 在 allow() 問「有沒有下雨」永遠是沒有 —— 三個字於是全部抽不到。實測 rain 自然
  // 出現 65/600 張而 umbrella 0 次，把 rain 釘起來（釘選在衣服之前就進 used）立刻
  // 變 29 次。這就是上面那段註解在講的同一個坑，跟 animal collar、leash、clipboard
  // 那一輪一模一樣，只是這三個當時沒搬乾淨。
  //
  // 場合集合原樣沿用舊的手寫規則，不趁機擴大 —— 擴大是另一件事，不是修這個 bug。
  umbrella: new Set(["rain", "overcast"]),
  parasol: new Set(["beach", "garden", "park", "poolside"]),
  "beach umbrella": new Set(["beach", "poolside", "ocean"]),
  // 調整眼鏡、調整手套是姿勢，不佔活動格。沒有那件東西就拿掉，也不從有眼鏡就必定拉。
  "adjusting eyewear": new Set(["glasses", "coke-bottle glasses", "goggles", "sunglasses"]),
  "adjusting gloves": new Set(["gloves", "elbow gloves", "black gloves", "fingerless gloves", "latex gloves"]),
};

// 上面那張表只做了負向的一半：沒有場合就刪掉。
// 少了正向的一半，配件就只能靠「瞎抽剛好碰上場合」存活 —— 實測釘住 pet play
// 抽 400 張，leash 出現 0 次；釘 boxing，拳擊手套 4 次；釘 armor，肩甲 0 次。
// 對照 microphone 釘 singing 是 400/400，因為 ACT_PROP 會在活動定下來之後
// 把麥克風拉進來。負向擋、正向拉，兩半要齊。
//
// 只收「有那個場合就幾乎一定有那個東西」的配對，而且是擲骰子不是必定 ——
// stampActProps() 無條件蓋章正是之前宮廷裡 52% 都在拿平底鍋的原因。
export const CTX_PULLS_ACC = [
  ["pet play", "animal collar", 0.8],
  ["pet play", "leash", 0.4],
  ["bondage", "handcuffs", 0.4],
  ["bondage", "shibari", 0.45],
  ["bondage", "bound wrists", 0.35],
  ["bdsm", "ball gag", 0.3],
  ["bdsm", "nipple clamps", 0.2],
  // 這一條是補漏：remote control vibrator 有 NEEDS_CONTEXT 擋著卻沒有任何正向拉取，
  // 於是兩邊都是 0 —— 正是上面那段註解在講的「只擋不拉，出現率就是零」。
  ["restrained", "remote control vibrator", 0.25],
  ["boxing", "boxing gloves", 0.85],
  ["playing sports", "knee pads", 0.25],
  ["riding bicycle", "bicycle helmet", 0.45],
  ["armor", "shoulder armor", 0.5],
  ["plate armor", "shoulder armor", 0.5],
  // Danbooru 實測：標了 rain 的圖有 31.9% 同時有 umbrella（15,598／48,876），
  // 跟 knee pads 0.25、bicycle helmet 0.45 同一個量級，照量到的數字給 0.3。
  ["rain", "umbrella", 0.3],
  // 露肩裝本身就是肩膀露出來。連帽衫、兜帽、兜帽斗篷同理，沒有這條的話
  // hood up 先被抽走、衣服還沒填，收尾的場合檢查會把它刪光。
  ["off shoulder", "bare shoulders", 0.75],
  ["hoodie", "hood up", 0.45],
  ["hood", "hood up", 0.5],
  ["hooded cloak", "hood up", 0.4],
];

// 運動的器材。跟 CTX_PULLS_ACC 同一件事，但**不能**放進那張表 —— 那個迴圈外面
// 包著 `clothBudget > 0`（配件屬於衣服，使用者把服裝設成 0 就是不要衣服），
// 而球拍是 env、跟衣服的額度無關：全裸打網球一樣該有球拍。
//
// 修之前釘住運動抽 300 張的實測，器材幾乎不存在：
//
//   tennis        球拍 2、球 3        soccer      球 6
//   badminton     球拍 5、羽球 2      golf        球桿 3、球 7
//   table tennis  球拍 5、球 2        archery     弓 3
//
// 也就是 300 張網球圖裡有 298 張沒有球拍。原因跟天氣、光源、傢俱當初一樣：
// 器材在詞庫裡，但只能在通用的 fill("env") 裡跟三百多個字搶剩餘配額。
// 那三格是補專屬的 fillSlot，這裡不行 —— 器材是「這個運動的」而不是「每張圖
// 都該有一個」，所以走 CTX_PULLS_ACC 那種「有場合才拉」的形式。
//
// 機率全部取自 Danbooru 共現率，跟 rain -> umbrella 那條同一套作法：
export const CTX_PULLS_GEAR = [
  ["table tennis", "table tennis paddle", 0.9],   // 560/605
  ["archery", "bow (weapon)", 0.88],              // 1722/1947
  ["tennis", "tennis racket", 0.79],              // 728/926
  ["golf", "golf club", 0.79],                    // 279/355
  ["badminton", "badminton racket", 0.78],        // 130/167
  ["soccer", "soccer ball", 0.51],                // 950/1874
  ["table tennis", "table tennis ball", 0.51],    // 306/605
  ["tennis", "tennis ball", 0.47],                // 438/926
  ["badminton", "shuttlecock", 0.41],             // 68/167
  ["golf", "golf ball", 0.28],                    // 99/355
];

// 沒有收進上表的：clipboard、o-ring，以及 beach umbrella 和 parasol。
// 後兩個量過：beach -> beach umbrella 只有 8.8%（11,711／133,200），
// garden -> parasol 2.0%、park -> parasol 0.3%。海灘不代表有遮陽傘，公園不代表有陽傘 ——
// 硬拉只是為了讓數字不是 0，跟下面這兩個的理由一樣。
// 辦公室不代表有寫字板，比基尼不代表有 O 環 —— 那是我自己想出來的關聯，不是那個
// 場合本來就有的東西。硬收進來只是為了讓數字不是 0，那是在替指標作答。
// 代價是這兩個字現在幾乎抽不到（4320 張裡各 1 次）。這是刻意的：它們以前是
// 「沒場合也會出現」，現在是「有場合才出現、而那個場合很少」—— 後者才是對的。

const SCENE_BAD_ACC = {
  office: /\b(police hat|nurse cap|hard hat|helmet|stethoscope|innertube|beach umbrella)\b/,
  school: /\b(police hat|nurse cap|hard hat|helmet|stethoscope|innertube|beach umbrella)\b/,
  nurse: /\b(police hat|hard hat|helmet|innertube|beach umbrella)\b/,
  maid: /\b(police hat|nurse cap|hard hat|helmet|stethoscope|innertube|beach umbrella)\b/,
  police: /\b(nurse cap|hard hat|helmet|stethoscope|innertube|beach umbrella)\b/,
  kitchen: /\b(innertube|beach umbrella|hard hat|police hat|nurse cap|helmet)\b/,
  swim: /\b(necktie|bowtie|microphone|clipboard|hard hat|helmet|police hat|nurse cap|stethoscope)\b/,
  // 沙灘／池畔／海邊（sceneClothKind 叫它 "shore"）原本**整個沒有條目** ——
  // accessoryOkForKind() 查不到 kind 就直接放行，於是海邊什麼配件都能戴。
  // 以前看不出來，是因為 necktie／bowtie 這些字的 mutex 是空的、在 normal
  // 模式根本抽不到；補上互斥格之後第一次跑就抽出「沙灘 + 領帶」。
  // 沿用 swim 的名單：海邊可以穿著衣服，但辦公室和工地的東西不該出現。
  shore: /\b(necktie|bowtie|microphone|clipboard|hard hat|helmet|police hat|nurse cap|stethoscope)\b/,
  bath: /\b(necktie|bowtie|police hat|nurse cap|hard hat|helmet|stethoscope|microphone|clipboard|innertube|beach umbrella|umbrella|high heels)\b/,
};

// 泡澡與游泳的配件改用白名單。
//
// 原本 SCENE_BAD_ACC.bath 是一份 13 樣的黑名單，於是沒被列到的東西全部從洞裡
// 走過去：600 張溫泉圖裡 collar 428 次、gloves 275、goggles 195、baseball cap 147，
// 還有拳擊手套和寵物項圈 —— 泡溫泉戴著手套、棒球帽和項圈。
//
// 黑名單在這裡註定有洞：配件有 79 個，而「下水時會脫掉什麼」是開放集合。
// 白名單是封閉的：只留真的會戴著下水的東西（綁起來的頭髮、戒指耳環、眼鏡、毛巾）。
// 使用者自己釘的配件不受影響 —— allow() 與場景掃描都有 pinned 例外。
const BATH_OK_ACC = new Set([
  "barefoot",
  "towel",
  // 泡湯把頭髮盤起來，這幾樣正是拿來盤頭髮的
  "hair ornament",
  "hairpin",
  "hair stick",
  "kanzashi",
  // 戒指耳環多半不會為了泡澡特地拔掉
  "ring",
  "wedding ring",
  "earrings",
  "stud earrings",
  "hoop earrings",
  "glasses",
]);

// 游泳多了泳具；泡澡不該有蛙鏡和泳帽。
const SWIM_OK_ACC = new Set([...BATH_OK_ACC, "goggles", "swim cap", "innertube"]);

function accessoryOkForKind(item, kind) {
  if (!item || item.layer !== "accessory") return true;
  if (kind === "bath") return BATH_OK_ACC.has(item.tag);
  if (kind === "swim") return SWIM_OK_ACC.has(item.tag);
  const re = SCENE_BAD_ACC[kind];
  return !(re && re.test(item.tag));
}

function garmentOkForKind(item, kind, era) {
  if (!item || item.section !== "clothing") return true;
  if (item.layer === "accessory") return accessoryOkForKind(item, kind);
  if (kind === "school" && item.tag === "school swimsuit") return true;
  if (kind === "indoor" && /\barmor\b/.test(item.tag) && (era === "medieval" || era === "edo")) return true;
  if (kind === "swim") {
    if (item.layer === "skin") return true;
    return garmentOkForSwim(item, era);
  }
  if (kind === "bath") {
    if (item.layer === "skin") return true;
    return isBathOkGarment(item);
  }
  if (item.layer === "skin") return true;
  const re = SCENE_BAD_CLOTH[kind];
  if (re && re.test(item.tag)) return false;
  return true;
}

function sceneClothLocked(used, pinned, lex, era, lockOn) {
  if (!lockOn) return null;
  return sceneClothKind(used);
}

export const ERAS = [
  "modern",
  "ancient_china",
  "ancient_greece",
  "medieval",
  "edo",
  "victorian",
];
export const ERA_LABELS = {
  modern: "現代",
  ancient_china: "古中國",
  ancient_greece: "古希臘",
  medieval: "中世紀",
  edo: "江戶",
  victorian: "維多利亞",
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

function pickWeighted(map, rand) {
  const entries = Object.entries(map).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (!total) return null;
  let x = rand() * total;
  for (const [key, w] of entries) {
    x -= w;
    if (x <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function shuffle(list, rand) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function erasOf(item) {
  const e = item?.era;
  if (!e || !e.length || e.includes("any")) return null;
  return e;
}

function erasIntersect(a, b) {
  if (!a || !b) return true;
  return a.some((x) => b.includes(x));
}

const LEAN_POSE = new Set(["leaning forward", "leaning back", "leaning to the side", "leaning on object"]);
const ARM_POSE = new Set([
  "arms up",
  "arms behind back",
  "arms behind head",
  "crossed arms",
  "heart hands",
  "v",
  "reaching towards viewer",
  "hands on own hips",
  "hand on own hip",
  "hands on own breasts",
  "hand in pocket",
  "index fingers together",
  "beckoning",
  // 單手上舉留一隻手。雙手垂下、雙手插袋佔滿兩隻手，跟單手不同組。
  "arm up",
  // 第六輪：舉手、雙臂伸展、手枕腦後也是手臂擺在哪，同一時間只有一種。
  "hand up",
  "hands up",
  "outstretched arms",
  "arm behind head",
  "arm support",
  "arms at sides",
  "hands in pockets",
]);
const LIE_BODY = new Set(["lying", "on back", "on stomach", "on side", "reclining"]);
const LEG_EXTRA = new Set(["crossed legs", "legs up", "m legs", "leg lift"]);
const HAIR_TEXTURE = new Set(["straight hair", "wavy hair", "curly hair"]);
const PENIS_SIZE = new Set(["small penis", "large penis", "huge penis"]);
const TESTICLE_SIZE = new Set(["small testicles", "large testicles", "huge testicles"]);
const TESTICLE_BARE = new Set(["testicles", "small testicles", "large testicles", "huge testicles"]);
const BOOK_ACT = new Set(["reading", "studying"]);
const HANDS_BUSY_ACT = new Set([
  "playing guitar",
  "talking on phone",
  "writing",
  "drawing (action)",
  "painting (action)",
  "cooking",
  "eating",
  "weightlifting",
  "drinking",
  "selfie",
  "fishing",
  "taking picture",
  "washing hair",
  "playing games",
  "playing video games",
  "recording",
  "smoking",
  "driving",
  "riding bicycle",
  "washing back",
  "shopping",
  "cleaning",
  "singing",
  "karaoke",
  "picnic",
]);
// Only worn blockers belong here. A racket/bat/bow in the scene does not prove somebody is holding it.
const HANDS_OCCUPIED = new Set(["boxing gloves"]);
const NEEDS_FREE_HAND = new Set([
  "handjob",
  "double handjob",
  "two-handed handjob",
  "cooperative handjob",
  "testicle grab",
  "fingering",
  "masturbation",
  "female masturbation",
  "male masturbation",
  "masturbation through clothes",
  "nursing handjob",
  "anal fingering",
  "mutual masturbation",
  "spanking",
  "holding condom",
  "strangling",
  "neck grab",
  "headlock",
  "rear naked choke",
  "holding another's wrist",
  "covering privates",
  "hand on another's head",
  "grabbing another's hair",
  "hands on own thighs",
]);
const HANDS_BUSY_BODY = new Set(["crawling", "all fours", "top-down bottom-up", "bondage", "restrained", "handcuffs", "bound wrists"]);
const BOTH_ARMS = new Set([
  "arms up",
  "hands up",
  "outstretched arms",
  "arms behind back",
  "arms behind head",
  "crossed arms",
  "heart hands",
  "hands on own hips",
  "hands on own breasts",
  "index fingers together",
  "paizuri gesture",
  "spread cleavage",
  "breast hold",
  "arms under breasts",
  "v arms",
  "double v",
  "w arms",
  "arms at sides",
  "hands in pockets",
  "own hands together",
  "interlocked fingers",
  "dual wielding",
  "aiming",
  "tying hair",
]);
const HAND_GESTURE = new Set([
  "finger to mouth",
  "hand on own hip",
  "hand on own chest",
  "hand on own hip",
  "adjusting hair",
  "adjusting clothes",
  "clothes tug",
  "paizuri gesture",
  "breast hold",
  "hands on own breasts",
  "pointing at viewer",
  "ojou-sama pose",
  "grabbing own breast",
  "holding hands",
  "recording",
  "spread cleavage",
  "breasts squeezed together",
  "clothes pull",
  "panty pull",
  "bra pull",
  "wedgie",
  "salute",
  "outstretched hand",
  "hand on own cheek",
  "hand on own chin",
  "thumbs up",
  "finger gun",
  "ok sign",
  "covering own eyes",
  "finger heart",
  "hand on own face",
  "hand in own hair",
  "hand on own thigh",
  "hand on own knee",
  "hand on own neck",
  "holding own wrist",
  "paw pose",
  "shushing",
  "adjusting eyewear",
  "adjusting gloves",
  "holding weapon",
  "holding sword",
  "holding gun",
  "holding knife",
  "holding staff",
  "pointing",
  "index finger raised",
  "reaching",
  "waving",
  "punching",
  "hand on another's shoulder",
  "hand on another's face",
  "hand on another's cheek",
  "feeding",
  "between fingers",
  // 第六輪：握拳、手上拿著杯子／手機／傘／扇子。一隻手一次做一件事，跟其他手勢同一格。
  "clenched hand",
  "holding cup",
  "holding phone",
  "holding umbrella",
  "holding fan",
]);
const MALE_FACE = new Set(["facial hair", "stubble", "beard", "goatee", "mustache"]);
const GAG_BLOCKS = new Set([
  "fellatio", "deepthroat", "irrumatio", "cunnilingus", "anilingus",
  "kiss", "french kiss", "kissing neck", "licking penis", "imminent fellatio",
  "reverse fellatio", "throat bulge", "licking",
]);
// 同一張嘴只能有一種口塞。變體 implies gag，父子不算兩種。
// 嘴叼物（第六輪）也算嘴裡的一樣東西：跟口塞不並存，口交、接吻也進不來。
const GAG_KIND = new Set(["gag", "tape gag", "bit gag", "ring gag", "ball gag", "mouth hold"]);
// 膠帶和咬棒把嘴封住。開口器是撐開，不在這組。
const CLOSED_GAG = new Set(["tape gag", "bit gag"]);
const NOT_PUBLIC_SCENE = new Set([
  "bedroom", "hotel room", "love hotel", "bathroom", "shower", "bathtub", "on bed", "bed",
]);
const AMPUTEE_MOVE = new Set(["walking", "walking away", "running", "jumping", "tiptoes", "footjob", "thigh sex", "leg lock", "hugging own legs", "fetal position", "curled up", "kicking"]);
// 穿在手上、臂上、或綁在兩腿之間的東西。無袖上衣不算。
const AMPUTEE_WORN = new Set([
  "wide sleeves", "long sleeves", "short sleeves", "sleeves rolled up",
  "detached sleeves", "puffy sleeves", "wrist cuffs", "spreader bar",
  "pillory", "stocks",
  "cuffs", "straitjacket", "bound ankles", "frogtie", "hogtie",
  "bandaged arm", "bandaged leg",
  // 第六輪：新的袖子、臂鎧、腕帶、裸臂都要有手臂。
  "puffy short sleeves", "puffy long sleeves", "sleeves past wrists", "juliet sleeves",
  "frilled sleeves", "layered sleeves", "gauntlets", "wristband", "bare arms",
]);
// 這些手是對方的。單人又四肢截斷時沒有手；有第二個人就可以。
const PARTNER_HAND = new Set(["fisting", "anal fisting", "urethral fingering", "slapping", "nipple pull", "crotch grab"]);
// 沒有手時才補的體位。不要把「所有單人 sex_act」都算進來。
const AMPUTEE_HANDLESS = new Set([
  "object insertion", "tentacle sex", "sex machine", "large insertion",
  "urethral insertion", "egg laying", "nipple penetration",
]);
const PUPIL_SHAPE = new Set(["symbol-shaped pupils", "slit pupils", "ringed eyes", "star-shaped pupils"]);
// 背包格。自動補牌仍只擲包和手提包；肩背包、小袋、行李箱抽到時佔同一格。
const BAG_SLOT = new Set(["bag", "handbag", "shoulder bag", "pouch", "suitcase"]);
const MATERIAL = new Set(["denim", "shiny clothes", "leather", "satin"]);
// 貞操帶蓋住的是她的下體。口交、乳交、手交、足交、腋交、乳頭插入這類不開鎖。
// 人數標籤（3P、亂交）不在這裡：它們只是在「已經有合法行為」時順便出現。
const CHASTITY_OK = new Set([
  "paizuri", "paizuri under clothes", "perpendicular paizuri", "straddling paizuri",
  "fellatio", "deepthroat", "irrumatio", "imminent fellatio", "licking penis", "oral",
  "handjob", "double handjob", "two-handed handjob", "cooperative handjob", "nursing handjob",
  "footjob", "armpit sex", "nipple penetration", "69", "vore",
  "male masturbation", "testicle sucking", "testicle grab",
  // 帶子在她身上。髮交、平胸摩擦、女攻、前列腺按摩都不開她的帶子。
  "hairjob", "naizuri", "pegging", "prostate milking", "reverse fellatio",
]);
// 沒有佔住性愛動作格、但一樣要打開帶子的字。隔著衣服自慰留著：那是頂著帶子磨。
const CHASTITY_CROTCH = new Set([
  "masturbation", "female masturbation", "fingering", "anal fingering",
  "hand in panties", "grinding",
  "guided penetration", "imminent penetration", "deep penetration",
  "clothed sex", "stealth sex", "spread pussy", "spread ass",
  "after vaginal", "after anal", "cum in pussy", "cum on pussy", "cum in ass",
  "prolapse", "anal prolapse", "butt plug", "anal beads", "crotch rope", "stomach bulge",
  "pussy peek", "penetration through clothes", "knotting", "peeing", "excessive pussy juice",
  // 獸姦、獵奇性交、排泄、把人吞回體內，都要打開帶子才做得到。
  "bestiality", "necrophilia", "scat", "unbirthing",
  "interspecies", "gaping", "speculum", "pussy piercing",
  "public use", "crotch grab", "crotch kick", "underwater sex",
  "bandaid on pussy",
]);

function needsLimbs(item) {
  if (!item) return false;
  if (AMPUTEE_MOVE.has(item.tag) || AMPUTEE_WORN.has(item.tag)) return true;
  if (BOTH_ARMS.has(item.tag) || HAND_GESTURE.has(item.tag) || ARM_POSE.has(item.tag)) return true;
  if (NEEDS_FREE_HAND.has(item.tag) || HANDS_BUSY_ACT.has(item.tag)) return true;
  return item.mutex === "feet" || item.mutex === "legs" || item.mutex === "hands";
}

function chastityCloses(item) {
  if (!item || item.tag === "chastity belt" || item.tag === "sex") return false;
  if (CHASTITY_OK.has(item.tag)) return false;
  if (item.mutex === "sex_act") return true;
  return CHASTITY_CROTCH.has(item.tag);
}

function extraMutex(item) {
  if (item._mx) return item._mx;
  const groups = [];
  if (item.mutex) groups.push(item.mutex);
  for (const g of item.mutexExtra || []) {
    if (g && !groups.includes(g)) groups.push(g);
  }
  if (LEAN_POSE.has(item.tag)) groups.push("lean");
  if (ARM_POSE.has(item.tag)) groups.push("arms");
  if (BOTH_ARMS.has(item.tag)) groups.push("both_arms");
  if (LEG_EXTRA.has(item.tag)) groups.push("legs");
  if (HAIR_TEXTURE.has(item.tag)) groups.push("hair_texture");
  if (PENIS_SIZE.has(item.tag)) groups.push("penis_size");
  if (TESTICLE_SIZE.has(item.tag)) groups.push("testicle_size");
  if (HAND_GESTURE.has(item.tag) && item.tag !== "holding hands") groups.push("hand_g");
  if (item.tag === "navel" || item.tag === "covered navel") groups.push("navel");
  if (item.tag === "pale skin" || item.tag === "dark skin" || item.tag === "very dark skin" || item.tag === "black skin") groups.push("skin_tone");
  if (item.tag === "nipples" || item.tag === "covered nipples") groups.push("nipple_show");
  if (/\b(necktie|bowtie)\b/.test(item.tag)) groups.push("neckwear");
  if (item.mutex === "held_prop" || item.mutex === "sport_prop") groups.push("held");
  // 背包和瓶底眼鏡沒有詞庫互斥格，正常模式的衣服補牌不會選它們。
  // 補牌時仍要佔住背包格、眼鏡格，才不會跟背包或普通眼鏡疊在一起。
  if (BAG_SLOT.has(item.tag) && !groups.includes("bag")) groups.push("bag");
  if (item.tag === "coke-bottle glasses" && !groups.includes("eyewear")) groups.push("eyewear");
  if ((item.tag === "pasties" || item.tag === "nipple tassels") && !groups.includes("chest_cover")) {
    groups.push("chest_cover");
  }
  item._mx = groups;
  return groups;
}

function relOf(item) {
  if (item._rel) return item._rel;
  const rel = new Set();
  for (const x of item.bind || []) rel.add(x);
  for (const x of item.implies || []) rel.add(x);
  item._rel = rel;
  return rel;
}

function parentChild(lex, a, b) {
  const A = lex.byTag.get(a);
  const B = lex.byTag.get(b);
  if (A && relOf(A).has(b)) return true;
  if (B && relOf(B).has(a)) return true;
  return false;
}

export function indexLexicon(data) {
  const byTag = new Map();
  const bySection = { quality: [], subject: [], feature: [], pose: [], clothing: [], env: [] };
  const mutexOf = new Map();
  const byMutex = new Map();
  const byGroup = new Map();
  // 細分類（scripts/subgroups.py）：只給人找字和必抽用。key 一樣是「段:id」。
  const bySub = new Map();
  for (const item of data.tags) {
    extraMutex(item);
    relOf(item);
    byTag.set(item.tag, item);
    if (bySection[item.section]) bySection[item.section].push(item);
    for (const g of extraMutex(item)) {
      if (!mutexOf.has(g)) mutexOf.set(g, []);
      mutexOf.get(g).push(item.tag);
    }
    if (item.mutex) {
      const k = item.section + ":" + item.mutex;
      if (!byMutex.has(k)) byMutex.set(k, []);
      byMutex.get(k).push(item);
    }
    if (item.group) {
      const k = item.section + ":" + item.group;
      if (!byGroup.has(k)) byGroup.set(k, []);
      byGroup.get(k).push(item);
    }
    if (item.sub) {
      const k = item.section + ":" + item.sub;
      if (!bySub.has(k)) bySub.set(k, []);
      bySub.get(k).push(item);
    }
  }
  const siblings = new Map();
  const lexStub = { byTag };
  for (const item of data.tags) {
    const related = new Set([item.tag, ...relOf(item)]);
    const out = new Set();
    for (const g of extraMutex(item)) {
      for (const t of mutexOf.get(g) || []) {
        if (related.has(t) || parentChild(lexStub, item.tag, t)) continue;
        out.add(t);
      }
    }
    siblings.set(item.tag, [...out]);
  }
  return { data, byTag, bySection, mutexOf, siblings, byMutex, byGroup, bySub };
}

function implyChain(lex, tag) {
  const out = [];
  const seen = new Set();
  const q = [tag];
  while (q.length) {
    const cur = q.shift();
    const item = lex.byTag.get(cur);
    if (!item) continue;
    for (const d of [...(item.implies || []), ...(item.bind || [])]) {
      if (seen.has(d) || d === tag) continue;
      seen.add(d);
      out.push(d);
      q.push(d);
    }
  }
  return out;
}

export function mutexSiblings(lex, tag) {
  const cached = lex.siblings && lex.siblings.get(tag);
  if (cached) return cached;
  const item = lex.byTag.get(tag);
  if (!item) return [];
  const related = new Set([tag, ...relOf(item)]);
  const out = new Set();
  for (const g of extraMutex(item)) {
    for (const t of lex.mutexOf.get(g) || []) {
      if (related.has(t) || parentChild(lex, tag, t)) continue;
      out.add(t);
    }
  }
  return [...out];
}

function eraCompatible(lex, tagA, tagB) {
  const a = erasOf(lex.byTag.get(tagA));
  const b = erasOf(lex.byTag.get(tagB));
  return erasIntersect(a, b);
}

export function applyPin(lex, pinned, userBanned, tag) {
  const nextPin = new Set(pinned);
  const nextBan = new Set(userBanned);
  nextBan.delete(tag);
  // 沒有人物跟人物的牌互斥：釘了 no humans，卡司、長相、衣服、姿勢、人群…都拿下來；
  // 反過來，已經釘了 no humans 又釘一張在說人的牌，no humans 讓出來。
  if (tag === NO_HUMANS) {
    for (const t of [...nextPin]) if (isPersonTag(lex, t)) nextPin.delete(t);
  } else if (nextPin.has(NO_HUMANS) && isPersonTag(lex, tag)) {
    nextPin.delete(NO_HUMANS);
  }
  for (const sib of mutexSiblings(lex, tag)) nextPin.delete(sib);
  for (const other of [...nextPin]) {
    if (other !== tag && !eraCompatible(lex, tag, other)) nextPin.delete(other);
  }
  nextPin.add(tag);
  const item = lex.byTag.get(tag);
  if (item) {
    for (const b of item.bind || []) {
      nextPin.add(b);
      nextBan.delete(b);
    }
    for (const i of implyChain(lex, tag)) {
      // 先釘了室外再釘溫泉，不該把室外換掉。沒有釘過室內外時，溫泉仍會帶進室內。
      if (keepPlaceSide(tag, i, (other) => nextPin.has(other))) continue;
      const depItem = lex.byTag.get(i);
      const rootItem = lex.byTag.get(tag);
      // 同一格的孫字不釘。澀谷帶出東京，東京再帶出城市時，城市跟澀谷搶場地，
      // 澀谷會從釘選裡消失。抽的時候本來就會把這個孫字丟掉，釘選跟抽對齊。
      if (
        depItem && rootItem && depItem.mutex && depItem.mutex === rootItem.mutex &&
        !parentChild(lex, tag, i)
      ) continue;
      nextPin.add(i);
      nextBan.delete(i);
      for (const sib of mutexSiblings(lex, i)) nextPin.delete(sib);
    }
  }
  return { pinned: nextPin, userBanned: nextBan };
}

export function applyBan(lex, pinned, userBanned, tag) {
  const nextPin = new Set(pinned);
  const nextBan = new Set(userBanned);
  nextPin.delete(tag);
  const item = lex.byTag.get(tag);
  if (item) {
    for (const b of item.bind || []) nextPin.delete(b);
  }
  nextBan.add(tag);
  return { pinned: nextPin, userBanned: nextBan };
}

export const IDENTITY_MUTEX = new Set([
  "hair_length",
  "hair_color",
  "eye_color",
  "breast_size",
  "race",
  "male_build",
]);

export function isIdentityItem(item) {
  if (!item) return false;
  return IDENTITY_MUTEX.has(item.mutex) || item.group === "hair_style";
}

// 「同一個人」要鎖住的另一半。
//
// identityPins() 只把第一張抽到的身分特徵釘起來，於是第一張沒有的欄位在後面幾張
// 仍然是空的、可以自由補 —— 實測 960 批裡有 685 批，第三張突然多了一撮呆毛、
// 一個馬尾，或是整個人變得肌肉發達。第一張的特徵一次都沒掉（0 次），
// 問題從頭到尾是「多出來」。
//
// 同一個人就是同一個人：身分特徵要剛好等於第一張那一組，多的一律不准。
// 被釘選連帶帶出來的父標籤已經在 pins 裡，所以不會誤禁到它們。
export function identityBans(lex, positive) {
  const keep = identityPins(lex, positive);
  const out = new Set();
  for (const item of lex.data.tags) {
    if (!isIdentityItem(item)) continue;
    if (keep.has(item.tag)) continue;
    out.add(item.tag);
  }
  return out;
}

export function identityPins(lex, positive) {
  let pinned = new Set();
  let banned = new Set();
  for (const t of String(positive || "")
    .split(",")
    .map((s) => parseWeighted(s).tag)
    .filter(Boolean)) {
    if (!isIdentityItem(lex.byTag.get(t))) continue;
    const next = applyPin(lex, pinned, banned, t);
    pinned = next.pinned;
    banned = next.userBanned;
  }
  return pinned;
}

export const BUILTIN_PRESETS = [
  { id: "ol-office", name: "OL 辦公室", tags: ["office lady", "office"] },
  { id: "onsen", name: "溫泉", tags: ["onsen", "bathing"] },
  { id: "pool", name: "泳池", tags: ["pool", "swimming"] },
  { id: "beach", name: "海邊", tags: ["beach"] },
  { id: "classroom", name: "教室", tags: ["classroom", "school uniform"] },
  { id: "nurse", name: "護士", tags: ["nurse"] },
  { id: "maid", name: "女僕", tags: ["maid"] },
  { id: "police", name: "女警", tags: ["policewoman"] },
  { id: "cabin", name: "空姐機艙", tags: ["flight attendant", "airplane interior"] },
  { id: "cinema", name: "電影院", tags: ["movie theater"] },
  { id: "conveni", name: "便利商店", tags: ["convenience store"] },
  { id: "church-nun", name: "教堂修女", tags: ["nun", "church"] },
  { id: "shrine", name: "神社巫女", tags: ["miko", "shrine"] },
  { id: "wedding", name: "婚禮", tags: ["wedding dress", "church"] },
  { id: "site", name: "工地", tags: ["construction worker", "construction site"] },
  { id: "fire", name: "消防員", tags: ["firefighter"] },
  { id: "prison", name: "監獄", tags: ["prison"] },
  { id: "xmas", name: "聖誕", tags: ["santa costume"] },
  { id: "ski", name: "滑雪", tags: ["skiing"] },
  { id: "dojo", name: "道場", tags: ["dojo"] },
  // 時代組合。每一組自己帶 era：單一時代是使用者的硬選擇，會贏過有衝突的釘選
  // （契約見 chooseEra() 的註解），所以不能指望「釘了武士就自動變江戶」——
  // 按鈕按下去時要把時代一起套進設定，否則會畫出現代廚房裡的武士。
  // 身分＋場地兩個字就夠，其餘讓它自己抽，才不會每次按下去都長一樣。
  { id: "samurai", name: "武士", tags: ["samurai", "dojo"], era: ["edo"] },
  { id: "ninja", name: "忍者", tags: ["ninja", "bamboo forest"], era: ["edo"] },
  { id: "oiran", name: "花魁", tags: ["oiran", "ryokan"], era: ["edo"] },
  { id: "knight", name: "騎士", tags: ["knight", "castle"], era: ["medieval"] },
  { id: "gladiator", name: "角鬥士", tags: ["gladiator", "colonnade"], era: ["ancient_greece"] },
  { id: "battlefield", name: "戰場", tags: ["battlefield", "banner"], era: ["ancient_china", "medieval", "edo"] },
  { id: "hanfu", name: "漢服庭園", tags: ["hanfu", "courtyard"], era: ["ancient_china"] },
  { id: "palace", name: "宮廷", tags: ["princess", "palace"], era: ["ancient_china", "medieval"] },
  { id: "ballroom", name: "維多利亞舞會", tags: ["ballroom", "evening gown"], era: ["victorian"] },
  { id: "witch", name: "女巫", tags: ["witch", "forest"], era: ["medieval", "victorian"] },
  // 運動組合全部由 web/sports.js 產生：按鈕寫運動名稱，一次帶進活動、場地、器材、服裝。
  ...SPORT_BUTTONS.map((p) => ({
    id: p.id,
    name: p.name,
    tags: sportPresetTags(p),
    // 活動不進必進 POS，抽牌時按尺度自動帶上。留著只是給 UI 說明用。
    activity: p.activity || null,
    // core 是「這套的識別性成員」。球鞋、運動服這種跨運動通用的裝備不算，
    // 否則換到網球之後籃球會因為共用球鞋而一直顯示半亮。
    core: sportPresetTags(p).filter((t) => !SPORT_NEUTRAL_GEAR.has(t)),
    sport: true,
  })),
];

export function applyPresetTags(lex, tags, existing = new Set()) {
  const presetMutex = new Set();
  const seen = new Set();
  const mark = (tag) => {
    if (seen.has(tag)) return;
    seen.add(tag);
    const item = lex.byTag.get(tag);
    if (!item) return;
    for (const g of extraMutex(item)) presetMutex.add(g);
    for (const d of [...(item.implies || []), ...(item.bind || [])]) mark(d);
  };
  for (const t of tags || []) mark(t);
  const clearsClothes = [...seen].some((t) => {
    const it = lex.byTag.get(t);
    if (!it) return false;
    return (
      it.section === "env" ||
      it.section === "clothing" ||
      it.mutex === "place" ||
      it.mutex === "activity" ||
      it.mutex === "job"
    );
  });
  let pinned = new Set();
  for (const t of existing) {
    const item = lex.byTag.get(t);
    if (!item) continue;
    if (clearsClothes && item.section === "clothing" && item.layer === "garment") continue;
    if ([...extraMutex(item)].some((g) => presetMutex.has(g))) continue;
    pinned.add(t);
  }
  let banned = new Set();
  for (const tag of tags || []) {
    if (!lex.byTag.has(tag)) continue;
    const next = applyPin(lex, pinned, banned, tag);
    pinned = next.pinned;
    banned = next.userBanned;
  }
  return pinned;
}

export function presetOwnedTags(lex, tags) {
  const seen = new Set();
  const mark = (tag) => {
    if (!tag || seen.has(tag)) return;
    const item = lex.byTag.get(tag);
    if (!item) return;
    seen.add(tag);
    for (const d of [...(item.implies || []), ...(item.bind || [])]) mark(d);
  };
  for (const t of tags || []) mark(t);
  return seen;
}

/**
 * "on" 全在、"mixed" 只剩一部分、"off" 一個都不在。
 *
 * core 是選填的「識別性成員」清單：只要 core 一個都不在就算 off，即使還有共用
 * 裝備留著。這樣換運動之後舊運動不會因為共用球鞋而一直顯示半亮。
 */
export function presetState(lex, tags, pinned, core) {
  const need = (tags || []).filter((t) => lex.byTag.has(t));
  if (!need.length) return "off";
  if (Array.isArray(core) && core.length) {
    const anyCore = core.some((t) => lex.byTag.has(t) && pinned.has(t));
    if (!anyCore) return "off";
  }
  let have = 0;
  for (const t of need) if (pinned.has(t)) have += 1;
  if (!have) return "off";
  return have === need.length ? "on" : "mixed";
}

export function presetActive(lex, tags, pinned, core) {
  return presetState(lex, tags, pinned, core) === "on";
}

/**
 * 使用者自己釘了互相矛盾的運動時回報一下。專案既有政策是保留明確釘選並顯示 warning，
 * 不靜默刪掉使用者要的東西 —— 這裡只負責講，不動 pinned。
 */
/**
 * 釘著的活動會不會擋掉性愛動作。engine 的規則是「會動的活動」跟性愛不能並存
 * （游泳、泡澡那些在 SEX_OK_ACTIVITY 白名單裡例外）。這裡只負責講，不動 pinned ——
 * 使用者自己釘的東西不靜默刪掉。
 */
export function sportHeatWarnings(lex, pinned, heats) {
  if (!(heats || []).includes("sex")) return [];
  const blocking = [];
  for (const t of pinned) {
    const it = lex.byTag.get(t);
    if (!it) continue;
    // 兩種都要收：會動的活動，以及 sleeping 這種不是 activity 的身體姿勢。
    // 只看 mutex==="activity" 的話，睡著就會變成無聲歸零。
    if (it.mutex === "activity" && MOVE_ACT.has(t) && !SEX_OK_ACTIVITY.has(t)) blocking.push(t);
    else if (SEX_BLOCKING_BODY.has(t)) blocking.push(t);
  }
  return blocking.length ? [{ kind: "sexActivity", tags: blocking }] : [];
}

/** Explicit user pins are preserved, but surface worn-hand/free-finger conflicts. */
export function handUsageWarnings(pinned) {
  const occupied = [...pinned].filter((tag) => HANDS_OCCUPIED.has(tag));
  const needsFree = [...pinned].filter((tag) => NEEDS_FREE_HAND.has(tag));
  return occupied.length && needsFree.length
    ? [{ kind: "hands", tags: [...occupied, ...needsFree] }]
    : [];
}

export function sportPinWarnings(lex, pinned) {
  const ids = sportIdsOf(pinned);
  if (ids === null || ids.size > 0) return [];
  const tags = [...pinned].filter((t) => SPORT_IDENTITY.has(t));
  return tags.length > 1 ? [{ kind: "sport", tags }] : [];
}

/** Explicit place + sport-gear/activity pins survive, but normal/diverse surfaces the clash. */
export function sportPlacePinWarnings(lex, pinned, settings) {
  if (!lockSceneOn(settings)) return [];
  const places = usedPlaces(pinned, lex);
  if (!places.size) return [];
  const gear = [...pinned].filter((tag) => SPORT_GEAR_IDENTITY.has(tag) && !places.has(tag));
  const bad = [];
  if (gear.length) {
    const ids = sportGearIdsOf(gear);
    // Cross-sport explicit pins have their own, more specific warning.
    if (ids && ids.size && !sportIdsFitPlaces(ids, places)) bad.push(...gear);
  }
  // Generic `playing sports` intentionally carries no sport identity, but it is still an activity
  // with a declared SPORT_PLACE dependency and therefore must participate in the pin warning.
  for (const tag of pinned) {
    if (!SPORT_ACTS.has(tag) || SPORT_GEAR_IDENTITY.has(tag)) continue;
    const allowed = ACT_PLACE[tag];
    if (allowed && ![...places].some((place) => allowed.has(place))) bad.push(tag);
  }
  return bad.length ? [{ kind: "sportPlace", tags: [...places, ...bad] }] : [];
}

export function clearPresetTags(lex, tags, existing = new Set()) {
  const drop = presetOwnedTags(lex, tags);
  const keep = [];
  for (const t of existing) {
    if (!drop.has(t)) keep.push(t);
  }
  let pinned = new Set();
  let banned = new Set();
  for (const t of keep) {
    if (!lex.byTag.has(t)) continue;
    const next = applyPin(lex, pinned, banned, t);
    pinned = next.pinned;
    banned = next.userBanned;
  }
  return pinned;
}

function sameTagList(a, b) {
  const A = new Set(a || []);
  const B = new Set(b || []);
  if (A.size !== B.size) return false;
  for (const t of A) if (!B.has(t)) return false;
  return true;
}

export function togglePresetTags(lex, tags, existing = new Set(), others) {
  if (presetActive(lex, tags, existing)) return clearPresetTags(lex, tags, existing);
  const lists = others || BUILTIN_PRESETS.map((p) => p.tags);
  let pinned = existing;
  for (const ot of lists) {
    if (sameTagList(ot, tags)) continue;
    pinned = clearPresetTags(lex, ot, pinned);
  }
  return applyPresetTags(lex, tags, pinned);
}

/** Persisted ownership for the last named preset. Missing legacy state is deliberately not inferred. */
export function sanitizePresetOwned(raw, lex) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (!Array.isArray(raw.tags)) return null;
  const tags = [...new Set(knownTags(lex, raw.tags))];
  return tags.length ? { id: raw.id.trim(), tags } : null;
}

/** Named preset ownership is `{ id, tags }`. `new Set(owned)` throws. */
export function ownedTagSet(owned) {
  if (!owned) return new Set();
  if (owned instanceof Set) return owned;
  if (Array.isArray(owned)) return new Set(owned);
  if (Array.isArray(owned.tags)) return new Set(owned.tags);
  return new Set();
}

export function snapshotPresetOwned(owned) {
  if (!owned || typeof owned !== "object") return null;
  if (typeof owned.id === "string" && Array.isArray(owned.tags)) {
    return { id: owned.id, tags: owned.tags.slice() };
  }
  return null;
}

/** Keep ownership aligned after the user removes or bans one of the preset-added tags. */
export function prunePresetOwned(raw, pinned, lex) {
  const owned = sanitizePresetOwned(raw, lex);
  if (!owned) return null;
  const tags = owned.tags.filter((tag) => pinned.has(tag));
  return tags.length ? { id: owned.id, tags } : null;
}

/**
 * Toggle one named preset without guessing which pre-existing pins belong to it.
 * Only the exact tags introduced by this helper are later eligible for removal.
 */
export function toggleNamedPreset(lex, preset, existing = new Set(), rawOwned = null) {
  if (!preset || typeof preset.id !== "string" || !Array.isArray(preset.tags)) {
    return { pinned: new Set(existing), presetOwned: prunePresetOwned(rawOwned, existing, lex), action: "noop" };
  }
  const id = preset.id;
  const owned = prunePresetOwned(rawOwned, existing, lex);
  const state = presetState(lex, preset.tags, existing, preset.core);

  if (state === "on") {
    // A legacy/manual full kit has no provable ownership. Preserve it rather than deleting user data.
    if (!owned || owned.id !== id) {
      return { pinned: new Set(existing), presetOwned: owned, action: "protected" };
    }
    const drop = new Set(owned.tags);
    return {
      pinned: new Set([...existing].filter((tag) => !drop.has(tag))),
      presetOwned: null,
      action: "removed",
    };
  }

  let base = new Set(existing);
  let keptOwned = [];
  if (owned && owned.id === id) {
    keptOwned = owned.tags.filter((tag) => base.has(tag));
  } else if (owned) {
    const drop = new Set(owned.tags);
    base = new Set([...base].filter((tag) => !drop.has(tag)));
  }

  const pinned = applyPresetTags(lex, preset.tags, base);
  const added = [...pinned].filter((tag) => !base.has(tag));
  const tags = [...new Set([...keptOwned, ...added])].filter((tag) => pinned.has(tag));
  return {
    pinned,
    presetOwned: tags.length ? { id, tags } : null,
    action: state === "mixed" ? "completed" : "applied",
  };
}

export function sanitizePinPresets(raw, lex) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const p of raw) {
    if (!p || typeof p.name !== "string") continue;
    const name = p.name.trim().slice(0, 20);
    if (!name || seen.has(name)) continue;
    const tags = knownTags(lex, Array.isArray(p.tags) ? p.tags : []);
    if (!tags.length) continue;
    seen.add(name);
    out.push({ name, tags });
    if (out.length >= 16) break;
  }
  return out;
}

// 面板上「存目前釘選」那顆鈕的判斷。sanitizePinPresets 是防禦性的：讀 localStorage
// 時遇到壞資料就默默丟掉，那是對的。但同一個函式拿來處理「使用者剛剛按下存檔」
// 就變成災難 —— 空白名稱、重名、第 17 組全都是靜靜消失，畫面卻照樣說「已存」。
// 拒絕的理由要帶得出來，呼叫端才能把它講給人聽。
export const PIN_PRESET_LIMIT = 16;
export const PIN_PRESET_NAME_MAX = 20;

export function addPinPreset(list, entry, lex) {
  const current = Array.isArray(list) ? list : [];
  const name = typeof entry?.name === "string" ? entry.name.trim().slice(0, PIN_PRESET_NAME_MAX) : "";
  if (!name) return { ok: false, reason: "empty", list: current };
  const tags = knownTags(lex, Array.isArray(entry?.tags) ? entry.tags : []);
  if (!tags.length) return { ok: false, reason: "no-tags", list: current };
  if (current.some((p) => p && typeof p.name === "string" && p.name.trim() === name)) {
    return { ok: false, reason: "duplicate", list: current, name };
  }
  if (current.length >= PIN_PRESET_LIMIT) return { ok: false, reason: "full", list: current, name };
  return { ok: true, list: [...current, { name, tags }], name };
}

export function applyClear(pinned, userBanned, tag) {
  const nextPin = new Set(pinned);
  const nextBan = new Set(userBanned);
  nextPin.delete(tag);
  nextBan.delete(tag);
  return { pinned: nextPin, userBanned: nextBan };
}

export function autoBannedFromPins(lex, pinned) {
  const banned = new Set();
  for (const tag of pinned) {
    for (const sib of mutexSiblings(lex, tag)) {
      if (!pinned.has(sib)) banned.add(sib);
    }
  }
  return banned;
}

export function tagState(tag, pinned, userBanned, autoBanned) {
  if (pinned.has(tag)) return "pinned";
  if (userBanned.has(tag) || autoBanned.has(tag)) return "banned";
  return "pool";
}

export function cycleTag(lex, pinned, userBanned, tag) {
  const auto = autoBannedFromPins(lex, pinned);
  const state = tagState(tag, pinned, userBanned, auto);
  if (state === "pool" || (state === "banned" && auto.has(tag) && !userBanned.has(tag))) {
    return applyPin(lex, pinned, userBanned, tag);
  }
  if (state === "pinned") return applyBan(lex, pinned, userBanned, tag);
  return applyClear(pinned, userBanned, tag);
}

const FEMALE_SEQ = ["1girl", "2girls", "3girls", "4girls", "5girls"];
const MALE_SEQ = ["1boy", "2boys", "3boys"];

function bumpGender(parts, female, want) {
  const seq = female ? FEMALE_SEQ : MALE_SEQ;
  const extra = female ? "multiple girls" : "multiple boys";
  // 6人以上、4個男生只給釘選。已經釘了就不要換成較小的人數牌。
  const wide = female ? ["6+girls"] : ["4boys", "6+boys"];
  if (genderCount(parts, female) >= want) return parts;
  if (parts.some((t) => wide.includes(t))) return parts;
  const pick = seq.find((t) => COUNT_NUM[t] >= want) || seq[seq.length - 1];
  const drop = new Set([extra, ...seq, ...wide]);
  return [...parts.filter((t) => !drop.has(t)), pick];
}

function ensureCast(parts, settings, ctx) {
  let out = parts.slice();
  if (ctx.needYaoi) out = out.filter((t) => !FEMALE_COUNT.has(t));
  if (ctx.needYuri) out = out.filter((t) => !MALE_COUNT.has(t));
  if (ctx.needFemale && !ctx.needYaoi && !hasFemale(out)) out.push("1girl");
  if (ctx.needMale && !ctx.needYuri && !hasMale(out)) out.push("1boy");
  if (ctx.need2Female && !ctx.needYaoi) out = bumpGender(out, true, 2);
  if (ctx.need2Male && !ctx.needYuri) out = bumpGender(out, false, 2);
  // 排比胸、被胸包圍要多個女生再湊滿四人。男女都開時，下面的平衡會補成兩女兩男；
  // 丹維幾乎沒有兩個男生。別的牌自己要求人群（輪姦、4P、5P）時不走這裡。
  // 已經有男生就留著，差的人數補女生，不要再補第二個男生。
  if (ctx.girlCrowd >= 4 && !ctx.needYaoi) {
    if (!ctx.needMale) out = out.filter((t) => !MALE_COUNT.has(t));
    const boys = genderCount(out, false);
    const wantGirls = Math.max(2, ctx.girlCrowd - boys);
    out = bumpGender(out, true, Math.min(wantGirls, 5));
  }
  const min = ctx.needFive ? 5 : ctx.needCrowd ? 4 : ctx.needGroup ? 3 : ctx.needPair ? 2 : 1;
  const canGirl = settings.girl !== false && !ctx.needYaoi;
  const canBoy = settings.boy !== false && !ctx.needYuri;
  let guard = 0;
  while (personCount(out) < min && guard++ < 8) {
    const before = personCount(out);
    const g = genderCount(out, true);
    const b = genderCount(out, false);
    if (canGirl && canBoy) {
      if (g === 0) out.push("1girl");
      else if (b === 0) out.push("1boy");
      else if (g <= b) out = bumpGender(out, true, g + 1);
      else out = bumpGender(out, false, b + 1);
    } else if (canGirl) out = bumpGender(out, true, g + 1);
    else if (canBoy) out = bumpGender(out, false, b + 1);
    // 男生最多 3boys。釘了 4P／5P、又只開男生時，卡在 3 人就永遠補不滿。
    // 牌要的是人數，不是「面板上的性別開關」；差的人數用另一個性別補。
    if (personCount(out) === before) {
      const gg = genderCount(out, true);
      const bb = genderCount(out, false);
      if (gg < 5 && !ctx.needYaoi) out = bumpGender(out, true, gg + 1);
      else if (!ctx.needYuri && bb < 3) out = bumpGender(out, false, bb + 1);
      else break;
    }
  }
  return out;
}

export function itemFitsHeats(item, heats) {
  if (!item) return false;
  const hs = item.heat && item.heat.length ? item.heat : MIXED_HEATS;
  const enabled = HEATS.filter((h) => (heats || []).includes(h));
  if (!enabled.length) return true;
  return enabled.some((h) => {
    if (h === "activity") {
      // 詞庫裡**沒有任何**一個字的 heat 含 "activity"（實測 337 件衣服、355 個
      // 姿勢、295 個特徵全都沒有），所以「活動」這一檔本來就只能借 tease 的池子。
      // 但整池照收就把面板上那句「只勾活動＝日常，沒有走光或做愛」變成假的：
      // 只勾活動抽 1200 張，naked coat 90 次、netorare 5 次、groping 6 次、
      // paizuri gesture 4 次、pink nipples 25 次。
      //
      // 所以借池子照借，情色內容扣掉 —— 短裙去買菜沒問題，裸身外套去買菜不是日常。
      if (!hs.includes("tease") && !hs.includes("activity")) return false;
      // 裸體是例外，要放行。泡溫泉、洗澡本來就沒穿衣服，那是場景決定的，不是尺度 ——
      // 場景那一套（sceneClothKind / 浴場脫衣）已經在管什麼時候該裸。
      // 我第一版把 layer=skin 一起擋掉，結果「正常模式 溫泉 活動」變成 0/80 永遠不裸，
      // 被既有測試抓到。擋的應該是「日常不會發生的事」，不是「沒穿衣服」。
      if (item.layer === "skin") return true;
      return !hasExplicitContent(item);
    }
    return hs.includes(h);
  });
}

function heatOk(item, heat) {
  return itemFitsHeats(item, [heat]);
}

const HISTORICAL = new Set(["ancient_china", "ancient_greece", "medieval", "edo"]);

function eraOk(item, era) {
  const eras = item.era;
  const isAny = !eras || !eras.length || eras.includes("any");
  if (isAny) {
    if (
      HISTORICAL.has(era) &&
      item.section === "clothing" &&
      item.layer === "garment" &&
      (item.mutex === "onepiece" || item.mutex === "top" || item.mutex === "bottom")
    ) {
      return false;
    }
    return true;
  }
  return eras.includes(era);
}

// 這個職業在這個時代的場地是不是「有地方可去、而且全是公開性愛場地」。
// 場上有職業時，性愛會擋掉 PUBLIC_SEX_PLACE；消防員的清單全是大街，
// 擋完就 100% 沒場地。偵探有辦公室，不是這個洞，不能放行。
function jobHasOnlyPublicPlaces(job, era, lex) {
  const set = JOB_PLACE[job];
  if (!set) return false;
  let any = false;
  for (const p of set) {
    const it = lex.byTag.get(p);
    if (!it || !eraOk(it, era)) continue;
    any = true;
    if (!PUBLIC_SEX_PLACE.has(p)) return false;
  }
  return any;
}

// 職業場地全是室外時，室內專用姿勢（胸壓桌／玻璃）會先佔場，場地格再填
// 就 100% 空。allow() 本來就擋「已經有 outdoors」的這兩個姿勢；釘消防員時
// outdoors 是場地暗示進來的，場地還沒抽，這一關看不見。
function jobHasOnlyOutdoorPlaces(job, era, lex) {
  const set = JOB_PLACE[job];
  if (!set) return false;
  let any = false;
  for (const p of set) {
    const it = lex.byTag.get(p);
    if (!it || !eraOk(it, era)) continue;
    any = true;
    if (INDOOR_ROOM.has(p)) return false;
  }
  return any;
}

// 職業場地全是室內時才擋 outdoors。舊寫法是「清單裡有一個室內就擋」，
// 偵探同時有辦公室和大街，抽菸／騎車只能去街上，街上 implies outdoors，
// 場地格就空了（實測 tease 14/40）。OL 只有辦公室，仍然擋。
function jobHasOnlyIndoorPlaces(job, era, lex) {
  const set = JOB_PLACE[job];
  if (!set) return false;
  let any = false;
  for (const p of set) {
    const it = lex.byTag.get(p);
    if (!it || !eraOk(it, era)) continue;
    any = true;
    if (!INDOOR_ROOM.has(p)) return false;
  }
  return any;
}

function jobHasSleepPlace(job, era, lex) {
  const set = JOB_PLACE[job];
  const sleepAt = ACT_PLACE.sleeping;
  if (!set || !sleepAt) return false;
  for (const p of set) {
    if (!sleepAt.has(p)) continue;
    const it = lex.byTag.get(p);
    if (it && eraOk(it, era)) return true;
  }
  return false;
}

// 活動在這個時代有沒有室內／室外場地。釘了室內物件之後 outdoors 被擋，
// 只剩室外場地的活動（騎馬、足球、游泳）會把場地格抽空；釘了雨之後
// 室內房間被擋，只剩室內場地的活動（煮飯、打掃、洗澡）同一種空場。
// 詞庫裡 implies 了哪一邊，commit 時就一定帶那一邊進來 —— BOTH_IO 說泳池室內外都行，
// 但 pool implies outdoors，跟床頭櫃的 indoors 永遠放不在一起。可行性判斷要照詞庫。
function placeCountsIndoor(place, lex) {
  const it = lex.byTag.get(place);
  if (it && (it.implies || []).includes("outdoors")) return false;
  if (BOTH_IO.has(place)) return true;
  if (INDOOR_ROOM.has(place)) return true;
  return !!(it && (it.implies || []).includes("indoors"));
}

function placeCountsOutdoor(place, lex) {
  const it = lex.byTag.get(place);
  if (it && (it.implies || []).includes("indoors")) return false;
  if (BOTH_IO.has(place)) return true;
  if (!it) return false;
  if ((it.implies || []).includes("outdoors")) return true;
  if (INDOOR_ROOM.has(place) || (it.implies || []).includes("indoors")) return false;
  return true;
}

// 釘了雨或室內物件之後，活動能不能留下，要看「這個時代、這一側、而且職業／女僕裝
// 也准」的場地還在不在。只問有沒有室外場地會漏：伸展的室外是公園，女僕裝卻只准
// 庭園和陽台，兩邊一交集就是空的，場地格跟著空。
function actHasUsableSide(act, era, lex, used, side) {
  const set = ACT_PLACE[act];
  if (!set) return false;
  const jobs = usedJobs(used, lex);
  for (const p of set) {
    const it = lex.byTag.get(p);
    if (!it || !eraOk(it, era)) continue;
    if (side === "out") {
      if (!placeCountsOutdoor(p, lex)) continue;
      // 雨那條不認 BOTH_IO。會帶出室內、或本身是室內房間的，都不算室外。
      if (INDOOR_ROOM.has(p) || (it.implies || []).includes("indoors")) continue;
    } else if (!placeCountsIndoor(p, lex)) {
      continue;
    }
    if (!placeFitsJob(p, jobs, used)) continue;
    return true;
  }
  return false;
}

function eraSpecific(item, era) {
  const eras = item.era;
  return Array.isArray(eras) && eras.length && !eras.includes("any") && eras.includes(era);
}

function pinContext(lex, pinned) {
  let needFemale = false;
  let needMale = false;
  let needPair = false;
  let needGroup = false;
  let needCrowd = false;
  let needFive = false;
  let need2Male = false;
  let need2Female = false;
  let needYuri = false;
  let needYaoi = false;
  let girlCrowd = 0;
  let otherCrowd = false;
  const heatLists = [];
  const eraLists = [];
  for (const tag of pinned) {
    const item = lex.byTag.get(tag);
    if (!item) continue;
    const needs = item.needs || [];
    if (item.gate === "female" || needs.includes("female") || FEMALE_COUNT.has(tag)) {
      needFemale = true;
    }
    if (item.gate === "male" || needs.includes("male") || MALE_COUNT.has(tag)) {
      needMale = true;
    }
    if (needs.includes("pair")) needPair = true;
    if (needs.includes("group")) needGroup = true;
    if (needs.includes("crowd")) needCrowd = true;
    if (needs.includes("five")) needFive = true;
    const asksCrowd = needs.includes("crowd") || needs.includes("five");
    const girlSide = needs.includes("2female")
      && !needs.includes("male")
      && !needs.includes("2male")
      && !needs.includes("yaoi")
      && item.gate !== "male";
    if (asksCrowd && girlSide) girlCrowd = Math.max(girlCrowd, needs.includes("five") ? 5 : 4);
    else if (asksCrowd) otherCrowd = true;
    if (needs.includes("2male")) {
      needMale = true;
      need2Male = true;
    }
    if (needs.includes("2female")) {
      needFemale = true;
      need2Female = true;
    }
    // 百合這個字的 needs 只有 pair、female，castOk 不會因此把男生排掉。
    // 磨鏡則是 needs 裡寫了 yuri。兩種都是「只要女生、至少兩個」。
    if (tag === "yuri" || needs.includes("yuri")) {
      needFemale = true;
      needPair = true;
      need2Female = true;
      needYuri = true;
    }
    // 男同性戀題材對照百合。兄弟要兩個男生，但可以有女生，不走這裡。
    if (tag === "yaoi" || needs.includes("yaoi")) {
      needMale = true;
      needPair = true;
      need2Male = true;
      needYaoi = true;
    }
    heatLists.push(item.heat && item.heat.length ? item.heat : MIXED_HEATS);
    const e = erasOf(item);
    if (e) eraLists.push(e);
  }
  if (otherCrowd || needYaoi) girlCrowd = 0;
  return { needFemale, needMale, needPair, needGroup, needCrowd, needFive, need2Male, need2Female, needYuri, needYaoi, girlCrowd, heatLists, eraLists };
}

function intersectOrUnion(lists) {
  if (!lists.length) return null;
  let acc = lists[0].slice();
  for (const hs of lists.slice(1)) {
    const hit = acc.filter((h) => hs.includes(h));
    if (!hit.length) {
      const u = new Set();
      for (const L of lists) for (const x of L) u.add(x);
      return [...u];
    }
    acc = hit;
  }
  return acc;
}

function chooseCast(lex, settings, pinned, banned, rand, ctx) {
  ctx = ctx || pinContext(lex, pinned);
  const povLock = pinned.has("pov") || pinned.has("pov crotch");
  const forced = [];
  for (const t of ["1girl", "2girls", "3girls", "4girls", "5girls", "6+girls", "1boy", "2boys", "3boys", "4boys", "6+boys"]) {
    if (pinned.has(t) && !banned.has(t)) forced.push(t);
  }
  let parts;
  if (forced.length) {
    parts = [...forced];
  } else if (povLock) {
    let girl = settings.girl;
    let boy = settings.boy;
    if (ctx.needFemale) girl = true;
    if (boy && !girl) parts = ["1boy"];
    else parts = ["1girl"];
  } else {
    let girl = settings.girl;
    let boy = settings.boy;
    if (ctx.needFemale || ctx.needYuri) girl = true;
    if (ctx.needMale && !ctx.needYuri) boy = true;
    if (ctx.needYuri) boy = false;
    if (ctx.needYaoi) {
      girl = false;
      boy = true;
    }
    let table;
    if (girl && boy) {
      table = lex.data.castWeights.mixed;
      if ((settings.heats || []).length === 1 && settings.heats[0] === "sex") {
        // 這張表以前寫死在這裡，跟詞庫的 castWeights 各走各的 —— 補了詞庫那邊的
        // 「一女兩男」之後，勾純性愛照樣抽不到兩男，因為走的是這張寫死的。
        // 現在以詞庫為唯一來源，找不到才退回 mixed。
        table = lex.data.castWeights.sex || table;
      }
    } else if (boy && !girl) table = lex.data.castWeights.boy_only;
    else if (girl && !boy) table = lex.data.castWeights.girl_only;
    else table = lex.data.castWeights.mixed;
    const usable = {};
    for (const [k, w] of Object.entries(table)) {
      const bits = k.split(",").map((s) => s.trim());
      if (bits.some((b) => banned.has(b))) continue;
      usable[k] = w;
    }
    const key = pickWeighted(usable, rand) || (girl || !boy ? "1girl" : "1boy");
    parts = key.split(",").map((s) => s.trim());
  }
  if (!povLock) parts = ensureCast(parts, settings, ctx);
  const n = personCount(parts);
  if (n === 1 && !banned.has("solo") && (!ctx.needPair || povLock) && (pinned.has("solo") || !pinned.has("solo focus"))) parts.push("solo");
  if (n > 1) parts = parts.filter((t) => t !== "solo");
  if (pinned.has("solo") && n > 1 && !ctx.needPair) {
    // 1girl、1boy 是單數，以前的 /^(\d+)boys$/ 對不上，1boy 會留下來變成「1girl, 1boy, solo」。
    parts = parts.filter((t) => !FEMALE_COUNT.has(t) && !MALE_COUNT.has(t));
    if (ctx.needFemale || settings.girl !== false) parts.unshift("1girl");
    else parts.unshift("1boy");
    parts.push("solo");
  }
  return [...new Set(parts)];
}

function chooseHeat(settings, pinned, lex, rand, ctx) {
  const enabled = HEATS.filter((h) => settings.heats.includes(h));
  ctx = ctx || pinContext(lex, pinned);
  const fromPins = intersectOrUnion(ctx.heatLists);
  let allowed = enabled.length ? enabled : ["tease"];
  if (fromPins && fromPins.length) {
    // 同一個概念要用同一套規則：itemFitsHeats() 把「heat 含 tease」的 tag 視為
    // 活動尺度也能用，這裡不能改拿原始陣列硬比，否則詞庫裡 987 個 tease/flash/sex
    // 的 tag 只要被釘到一個，「活動」就永遠選不到。
    const fits = (h) => fromPins.includes(h) || (h === "activity" && fromPins.includes("tease"));
    const hit = allowed.filter(fits);
    if (hit.length) allowed = hit;
  }
  const weights = { ...settings.weights };
  const filtered = {};
  for (const h of allowed) filtered[h] = weights[h] > 0 ? weights[h] : 1;
  return pickWeighted(filtered, rand) || allowed[0];
}

function chooseEra(settings, pinned, lex, rand, ctx) {
  let pool = (settings.eras || ERAS).filter((e) => ERAS.includes(e));
  if (!pool.length) pool = ["modern"];
  // 單一時代是使用者的硬選擇，贏過有衝突的釘選 —— 這條有測試在守
  // （"exclusive medieval beats bikini pin for era"）。所以「釘武士就變江戶」
  // 不能走這裡實作，得由組合按鈕自己帶時代（BUILTIN_PRESETS 的 era 欄位）。
  if (pool.length === 1) return pool[0];
  ctx = ctx || pinContext(lex, pinned);
  const fromPins = intersectOrUnion(ctx.eraLists);
  if (fromPins && fromPins.length) {
    const hit = pool.filter((e) => fromPins.includes(e));
    pool = hit.length ? hit : fromPins.filter((e) => ERAS.includes(e));
    if (!pool.length) pool = fromPins;
  }
  const weights = {};
  for (const e of pool) weights[e] = e === "modern" ? 1.4 : 1;
  return pickWeighted(weights, rand) || pool[0];
}

export function eraMismatches(lex, pinned, era) {
  const out = [];
  for (const t of pinned) {
    const item = lex.byTag.get(t);
    const e = item?.era;
    if (!e || !e.length || e.includes("any")) continue;
    if (!e.includes(era)) out.push(t);
  }
  return out;
}

export function heatMismatches(lex, pinned, heats) {
  const enabled = HEATS.filter((h) => (heats || []).includes(h));
  if (!enabled.length) return [];
  const out = [];
  for (const t of pinned) {
    const item = lex.byTag.get(t);
    if (!item) continue;
    if (!itemFitsHeats(item, enabled)) out.push(t);
  }
  return out;
}

function mutexBusy(lex, mutexTaken, tag) {
  const item = lex.byTag.get(tag);
  if (!item) return false;
  for (const g of extraMutex(item)) {
    if (mutexTaken.has(g) && mutexTaken.get(g) !== tag) return true;
  }
  return false;
}

function mutexOccupants(lex, mutexTaken, tag) {
  const item = lex.byTag.get(tag);
  const out = [];
  if (!item) return out;
  for (const g of extraMutex(item)) {
    const old = mutexTaken.get(g);
    if (old && old !== tag) out.push(old);
  }
  return out;
}

function dependents(lex, tag) {
  const item = lex.byTag.get(tag);
  if (!item) return [];
  return [...(item.bind || []), ...(item.implies || [])];
}

function depAllowed(lex, tag, era) {
  const item = lex.byTag.get(tag);
  if (!item) return false;
  if (era && !eraOk(item, era)) return false;
  return true;
}

function makeCommit(lex, used, mutexTaken, banned, era, allowDep) {
  const occupy = (tag) => {
    const item = lex.byTag.get(tag);
    if (item) {
      for (const g of extraMutex(item)) {
        const old = mutexTaken.get(g);
        if (old && old !== tag && !parentChild(lex, tag, old)) used.delete(old);
        mutexTaken.set(g, tag);
      }
    }
    used.add(tag);
  };
  return function commit(tag) {
    if (!tag || used.has(tag) || banned.has(tag)) return false;
    if (mutexBusy(lex, mutexTaken, tag)) return false;
    const deps = implyChain(lex, tag);
    // Validate dependencies in the context they will actually enter. A nurse makes nurse cap valid,
    // a doctor makes stethoscope valid, etc.; validating the dependent before its source existed made
    // every such source structurally unreachable. This temporary source is always rolled back before
    // the real atomic occupy pass below.
    used.add(tag);
    try {
      for (const d of deps) {
        if (keepPlaceSide(tag, d, (other) => used.has(other) || mutexTaken.get("in_out") === other)) continue;
        if (used.has(d) || !depAllowed(lex, d, era)) continue;
        if (banned.has(d)) return false;
        if (mutexOccupants(lex, mutexTaken, d).some((occ) => !parentChild(lex, occ, d))) return false;
        const di = lex.byTag.get(d);
        if (di?.mutex === "body_pose") {
          for (const a of usedActs(used, lex)) {
            if (!activityFitsBody(a, new Set([d]))) return false;
          }
        }
        if (allowDep && di && di.mutex !== "held_prop" && !allowDep(di)) {
          // 上面那個暫時的 used.add(tag) 是為了讓「護士在場，聽診器才合法」成立，
          // 但父子同屬一個排他集合時會反咬自己：karaoke 和它 implies 的 singing
          // 都算忙手活動，驗 singing 的時候撞到剛放進去的 karaoke，整條 commit 被拒。
          // 所以再問一次「把父字拿掉還是不合法嗎」—— 只有跟別的東西衝突才真的拒絕。
          // 一個字不該跟它自己 implies 的字打架。
          used.delete(tag);
          const blockedByOthers = !allowDep(di);
          used.add(tag);
          if (blockedByOthers) return false;
        }
      }
    } finally {
      used.delete(tag);
    }
    occupy(tag);
    for (const d of deps) {
      if (keepPlaceSide(tag, d, (other) => used.has(other) || mutexTaken.get("in_out") === other)) continue;
      if (banned.has(d) || used.has(d) || !depAllowed(lex, d, era)) continue;
      if (mutexBusy(lex, mutexTaken, d) && !parentChild(lex, tag, d)) continue;
      occupy(d);
    }
    return true;
  };
}

const COLOR_WORD = new Set([
  "white",
  "black",
  "blue",
  "green",
  "red",
  "pink",
  "purple",
  "brown",
  "aqua",
  "orange",
  "yellow",
  "grey",
  "gray",
]);

function isColorVariant(item) {
  const parts = String(item.tag || "").split(" ");
  return parts.length >= 2 && COLOR_WORD.has(parts[0]);
}

// 長相的自由格（固定格之外、補到「每段抽幾個」的那幾張）抽什麼。
//
// 以前整段長相牌一起平均抽，牌越多的小分類越常中：非人特徵有 30 張，就佔最大份，
// 每張圖都冒出翅膀、狐尾、嘴角流血、母女、懷孕這種會改寫整張圖設定的字。
// 自由格要補的是細節（睫毛、瀏海、腮紅、妝、體型），不是新的設定：
// 先決定每一家佔幾成（份量就是意圖，不隨詞庫長大而變），家裡再平均挑；
// 特別搶戲的個別字再壓低。想要那些設定就釘它，或開多元／奇葩（奇葩照舊平均抽）。
const FEATURE_FAMILY = {
  eye_shape: "eyes", hair_detail: "hair", makeup: "makeup", skin_flush: "flush",
  bf_shape: "build", bm_build: "build", skin_tone: "tone", mouth_bits: "mouth", wear_bits: "wear",
  skin_mark: "mark", tattoo: "tattoo", hair_shape: "hair_shape", body_part: "body_part",
  nonhuman: "nonhuman", persona: "persona", relation: "relation", bf_intimate: "intimate",
  bm_penis: "intimate", bf_touch: "touch", bm_hair: "body_hair", job_classic: "job", job_modern: "job",
};
const FEATURE_SHARE = {
  eyes: 14, hair: 14, flush: 12, makeup: 9, build: 8, job: 6, tone: 5, mouth: 5, wear: 4, mark: 4,
  hair_shape: 3, tattoo: 3, body_part: 3, intimate: 3, touch: 3, body_hair: 2, nonhuman: 2,
  persona: 1, relation: 1, other: 3,
};
// 多元：非人特徵、人設放寬（人種格也是多元才開）。
const FEATURE_SHARE_DIVERSE = { ...FEATURE_SHARE, nonhuman: 8, persona: 3, mark: 6, tattoo: 5 };
const FEATURE_SHARE_HEAT = { flash: { intimate: 8, touch: 5 }, sex: { intimate: 9, touch: 6 } };
const FEATURE_LOUD = new Set([
  "pregnant", "quadruple amputee", "giantess", "minigirl", "old woman", "old man", "obese", "fat man",
  "blood from mouth", "blood on face", "nosebleed", "injury", "whip marks", "bite mark",
  "symbol-shaped pupils", "star-shaped pupils", "ringed eyes", "white pupils", "glowing hair",
  "green skin", "colored skin", "genderswap", "futanari", "saliva", "saliva trail",
]);
const FEATURE_LOUD_FACTOR = 0.3;

function featureFamilyOf(item) {
  return FEATURE_FAMILY[item.sub] || "other";
}

// 胸圍的相對常見程度（fillBreastSize 用）。沒列到的同格新字一律 10。
const BREAST_WEIGHT = {
  "medium breasts": 30,
  "large breasts": 26,
  "small breasts": 18,
  "huge breasts": 13,
  "flat chest": 8,
  "gigantic breasts": 5,
};

function takeFromPool(pool, count, rand, commit, prefer, allow, mPre) {
  if (mPre && mPre.taken && mPre.taken.size) {
    pool = prefilterPoolByMutex(mPre.idx, mPre.taken, pool).kept;
  }
  let buckets;
  if (prefer && Array.isArray(prefer.softTiers) && prefer.softTiers.length) {
    const tiers = prefer.softTiers;
    const weights = prefer.weights || [];
    // Tier predicates are pure for one takeFromPool call. Cache their result once per candidate;
    // the old loop recomputed every tier for every remaining candidate after each pick.
    const candidates = pool.map((item) => {
      const tier = tiers.findIndex((fn) => fn(item));
      const index = tier < 0 ? tiers.length : tier;
      return { item, weight: Math.max(0.01, Number(weights[index]) || 1) };
    });
    // 單一格的軟權重在池子被規則收得很小時會一家獨大：一個時代字 14、其餘各 1，
    // 四個候選裡時代字吃掉八成。大池子每個字本來就低於上限，權重不動，亂數序列也不變。
    if (Number.isFinite(prefer.capShare) && candidates.length >= 2) {
      const cap = candidates.length === 2 ? Math.max(prefer.capShare, 0.65) : prefer.capShare;
      let total = 0;
      let maxW = 0;
      for (const c of candidates) {
        total += c.weight;
        if (c.weight > maxW) maxW = c.weight;
      }
      if (maxW > cap * total + 1e-6) {
        const ws = candidates.map((c) => c.weight);
        for (let iter = 0; iter < 8; iter += 1) {
          let sum = 0;
          for (const w of ws) sum += w;
          const limit = cap * sum;
          let excess = 0;
          let under = 0;
          let any = false;
          const over = new Array(ws.length);
          for (let i = 0; i < ws.length; i += 1) {
            over[i] = ws[i] > limit + 1e-6;
            if (over[i]) {
              any = true;
              excess += ws[i] - limit;
              ws[i] = limit;
            } else under += ws[i];
          }
          if (!any || under <= 0) break;
          for (let i = 0; i < ws.length; i += 1) {
            if (!over[i]) ws[i] += (excess * ws[i]) / under;
          }
        }
        for (let i = 0; i < candidates.length; i += 1) candidates[i].weight = ws[i];
      }
    }
    let n = 0;
    while (n < count && candidates.length) {
      let total = 0;
      for (const candidate of candidates) total += candidate.weight;
      let cursor = rand() * total;
      let index = candidates.length - 1;
      for (let i = 0; i < candidates.length; i += 1) {
        cursor -= candidates[i].weight;
        if (cursor <= 0) {
          index = i;
          break;
        }
      }
      const [{ item }] = candidates.splice(index, 1);
      if (allow && !allow(item)) continue;
      if (commit(item.tag)) n += 1;
    }
    return n;
  } else if (Array.isArray(prefer) && prefer.length) {
    const seen = new Set();
    buckets = [];
    for (const fn of prefer) {
      const b = [];
      for (const item of pool) {
        if (seen.has(item.tag) || !fn(item)) continue;
        seen.add(item.tag);
        b.push(item);
      }
      buckets.push(b);
    }
    buckets.push(pool.filter((item) => !seen.has(item.tag)));
  } else if (typeof prefer === "function") {
    buckets = [pool.filter(prefer), pool.filter((item) => !prefer(item))];
  } else {
    buckets = [pool];
  }
  let n = 0;
  for (const bucket of buckets) {
    for (const item of shuffle(bucket, rand)) {
      if (n >= count) break;
      if (allow && !allow(item)) continue;
      if (commit(item.tag)) n += 1;
    }
    if (n >= count) break;
  }
  return n;
}

export function reconcile(lex, used, female, male, people, pinned = new Set(), lockScene = true) {
  const order = { subject: 0, feature: 1, clothing: 2, pose: 3, env: 4 };
  const items = [...used].map(
    (t) => lex.byTag.get(t) || { tag: t, section: "env", layer: "normal" }
  );
  const pinItems = items.filter((i) => pinned.has(i.tag));
  const rest = items
    .filter((i) => !pinned.has(i.tag))
    .sort((a, b) => (order[a.section] ?? 9) - (order[b.section] ?? 9));

  const taken = new Map();
  let keep = [];
  for (const item of pinItems) {
    keep.push(item);
    for (const g of extraMutex(item)) taken.set(g, item.tag);
  }
  for (const item of rest) {
    if (
      !castOk(item, female, male, people, genderCount(used, true), genderCount(used, false)) &&
      item.section !== "subject"
    ) {
      continue;
    }
    let ok = true;
    for (const g of extraMutex(item)) {
      if (taken.has(g) && taken.get(g) !== item.tag && !parentChild(lex, taken.get(g), item.tag)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    keep.push(item);
    for (const g of extraMutex(item)) taken.set(g, item.tag);
  }

  const isNudeItem = (i) =>
    i.tag === "nude" ||
    i.tag === "completely nude" ||
    (i.section === "clothing" && i.layer === "skin");
  const nudePinned = keep.some((i) => pinned.has(i.tag) && isNudeItem(i));
  const garmentPinned = keep.some(
    (i) => pinned.has(i.tag) && i.section === "clothing" && i.layer === "garment"
  );
  const nude = keep.some(isNudeItem);
  if (nude && !garmentPinned) {
    keep = keep.filter(
      (i) =>
        pinned.has(i.tag) ||
        i.section !== "clothing" ||
        i.layer === "skin" ||
        i.layer === "accessory"
    );
  } else if (nude && garmentPinned && !nudePinned) {
    keep = keep.filter((i) => !isNudeItem(i) || pinned.has(i.tag));
  } else if (taken.has("onepiece")) {
    keep = keep.filter(
      (i) =>
        pinned.has(i.tag) ||
        i.section !== "clothing" ||
        (i.mutex !== "top" && i.mutex !== "bottom") ||
        i.layer === "accessory"
    );
  }

  if (lockScene) {
    const tags = new Set(keep.map((i) => i.tag));
    if (isBathScene(tags)) {
      keep = keep.filter((i) => pinned.has(i.tag) || !isBathBadCloth(i.tag));
    }
    if (isSwimAct(tags) || tags.has("wading") || tags.has("underwater")) {
      keep = keep.filter(
        (i) =>
          pinned.has(i.tag) ||
          !/\b(armor|suit|blazer|lab coat|hakama|necktie|boots|sneakers|high heels)\b/.test(i.tag)
      );
    }
    // 水上細節可能先靠一個 activity 通過 allow()，但該 activity 又在上面的場景
    // reconcile 被移除。用最終集合再驗一次，避免留下 splashing 卻沒有任何水源。
    const finalTags = new Set(keep.map((i) => i.tag));
    const hasWater = [...finalTags].some(
      (tag) => WATER_PLACE.has(tag) || BATH_PLACE.has(tag) || WATER_SOURCE_ACT.has(tag) || BATH_ACT.has(tag)
    );
    if (!hasWater) {
      keep = keep.filter((i) => pinned.has(i.tag) || !WATER_DETAIL.has(i.tag));
    }
  }

  if (people > 1) keep = keep.filter((i) => i.tag !== "solo" || pinned.has("solo"));
  if (people === 1 && !keep.some((i) => i.tag === "solo")) {
    const solo = lex.byTag.get("solo");
    if (solo) keep.push(solo);
  }

  if (keep.some((i) => i.tag === "bald")) {
    keep = keep.filter((i) => {
      if (pinned.has(i.tag) || i.tag === "bald") return true;
      if (i.mutex === "hair_color" || i.group === "hair_style") return false;
      return true;
    });
  }

  return new Set(keep.map((i) => i.tag));
}

/**
 * opts.pins：tags 是疊印台上的釘選，不是抽完的結果。卡司還沒補齊（釘 1girl＋口交，抽的時候會補一個男生），
 * 所以 cast_need 只報補不起來的那種：要只有女生的牌（百合、磨鏡）配上釘住的男生人數牌。
 */
export function contradictions(lex, tags, opts = {}) {
  const items = tags.map((t) => lex.byTag.get(t)).filter(Boolean);
  const found = [];
  const seen = new Map();
  for (const item of items) {
    for (const g of extraMutex(item)) {
      if (seen.has(g) && seen.get(g) !== item.tag) {
        if (!parentChild(lex, seen.get(g), item.tag)) {
          found.push([g, seen.get(g), item.tag]);
        }
      } else seen.set(g, item.tag);
    }
  }
  const names = new Set(tags);
  // solo 是畫面上只有一個人。卡司加起來超過一人（1girl＋1boy 也算），或釘了一張
  // 要兩人以上的牌（hetero、fellatio、threesome…），都跟它打架。點名是哪一張。
  if (names.has("solo")) {
    let heads = 0;
    let multi = null;
    for (const t of tags) {
      if (FEMALE_COUNT.has(t) || MALE_COUNT.has(t)) {
        heads += COUNT_NUM[t] || 0;
        if ((COUNT_NUM[t] || 0) > 1 && !multi) multi = t;
      }
    }
    const crowdNeed = ["pair", "group", "crowd", "five"];
    const needy = tags.find((t) => t !== "solo" && (lex.byTag.get(t)?.needs || []).some((k) => crowdNeed.includes(k)));
    const other = multi || (heads > 1 ? tags.find((t) => t !== "1girl" && MALE_COUNT.has(t)) || tags.find((t) => FEMALE_COUNT.has(t) || MALE_COUNT.has(t)) : null) || needy;
    if (other) found.push(["solo_count", "solo", other]);
  }
  if (names.has("solo") && names.has("solo focus")) found.push(["solo_focus", "solo", "solo focus"]);
  // 人數已經寫在卡司上、卻跟某張牌的 needs／gate 對不起來。單獨一張「要兩人」的牌
  // 不算：抽的時候會把人補上。這裡抓的是結果裡已經有 1girl／1boy，人還是不夠或性別錯了。
  {
    let girls = 0;
    let boys = 0;
    let maleTag = null;
    let femaleTag = null;
    for (const t of tags) {
      if (FEMALE_COUNT.has(t)) {
        girls += COUNT_NUM[t] || 0;
        if (!femaleTag) femaleTag = t;
      }
      if (MALE_COUNT.has(t)) {
        boys += COUNT_NUM[t] || 0;
        if (!maleTag) maleTag = t;
      }
    }
    if (girls + boys > 0) {
      const female = girls > 0;
      const male = boys > 0;
      const peopleN = girls + boys;
      for (const t of tags) {
        if (t === "solo" || t === "solo focus") continue;
        const item = lex.byTag.get(t);
        if (!item) continue;
        const needs = item.needs || [];
        const yuriBad = (item.tag === "yuri" || needs.includes("yuri")) && (male || girls < 2);
        if (opts.pins) {
          if ((item.tag === "yuri" || needs.includes("yuri")) && male) found.push(["cast_need", item.tag, maleTag]);
          if ((item.tag === "yaoi" || needs.includes("yaoi")) && female) found.push(["cast_need", item.tag, femaleTag]);
          continue;
        }
        if (!yuriBad && gateOk(item, female, male) && castOk(item, female, male, peopleN, girls, boys)) continue;
        let pointed = maleTag || femaleTag;
        if ((item.tag === "yuri" || needs.includes("yuri")) && maleTag) pointed = maleTag;
        else if ((needs.includes("male") || item.gate === "male") && !male) pointed = femaleTag || pointed;
        else if ((needs.includes("female") || item.gate === "female") && !female) pointed = maleTag || pointed;
        found.push(["cast_need", item.tag, pointed || item.tag]);
      }
    }
  }
  const nude = names.has("nude") || names.has("completely nude");
  if (nude && (names.has("dress") || names.has("sundress") || names.has("jeans"))) {
    found.push(["nude_garment", "nude", "garment"]);
  }
  if (names.has("indoors") && names.has("outdoors")) found.push(["in_out", "indoors", "outdoors"]);
  if (names.has("day") && names.has("night")) found.push(["day_night", "day", "night"]);
  for (const t of tags) {
    const impl = lex.byTag.get(t)?.implies || [];
    if (BOTH_IO.has(t)) continue;
    if (impl.includes("indoors") && names.has("outdoors")) found.push(["in_out", t, "outdoors"]);
    if (impl.includes("outdoors") && names.has("indoors")) found.push(["in_out", t, "indoors"]);
  }
  // 純色背景配天空、天氣、景物、場景光（跟 allow() 同一條 bgClash），落葉配室內。
  // 疊印台的校樣靠這裡畫「相剋」線：釘了白背景又釘星空，要看得出來哪裡打架。
  for (const t of tags) {
    if (lex.byTag.get(t)?.mutex !== "background") continue;
    // white background 帶進來的 simple background 不另外畫一條，線只畫在釘的那張上。
    if (tags.some((o) => o !== t && (lex.byTag.get(o)?.implies || []).includes(t))) continue;
    for (const u of tags) if (u !== t && bgClash(lex.byTag.get(u))) found.push(["background", t, u]);
  }
  if (names.has("falling leaves") && names.has("indoors")) found.push(["in_out", "falling leaves", "indoors"]);
  // 沒有人物，又有在說人的牌（卡司、長相、衣服、姿勢、人群…）。
  if (names.has(NO_HUMANS)) {
    for (const t of tags) if (isPersonTag(lex, t)) found.push(["no_humans", NO_HUMANS, t]);
  }
  // solo 是「畫面上只有一個人」；有人群就不是了（該用 solo focus）。
  for (const c of CROWD_TAGS) {
    if (!names.has(c)) continue;
    if (names.has("solo")) found.push(["solo_crowd", "solo", c]);
    for (const t of tags) if (CROWD_BAD_PLACE.has(t)) found.push(["crowd_place", c, t]);
  }
  return found;
}


function stageAborted(drawOpts) {
  return !!(drawOpts.signal && drawOpts.signal.aborted);
}

/** §1／§2 UI hooks only. Never put used/positive in the event. */
function emitDrawStage(drawOpts, event) {
  if (stageAborted(drawOpts)) return { cancel: true };
  if (typeof drawOpts.onStage !== "function") {
    return stageAborted(drawOpts) ? { cancel: true } : null;
  }
  try {
    const result = drawOpts.onStage(event);
    if (result && result.cancel) return { cancel: true };
  } catch {
    return { cancel: true };
  }
  return stageAborted(drawOpts) ? { cancel: true } : null;
}

function cancelledDrawResult({ heat, era, female, male, people, seed }) {
  return {
    cancelled: true,
    heat,
    era,
    female,
    male,
    people,
    seed,
    mustReport: [],
    sections: {
      quality: [],
      style: [],
      subject: [],
      feature: [],
      pose: [],
      clothing: [],
      env: [],
      nsfw: [],
    },
    positive: "",
    shadowViolations: [],
    conflicts: [],
    eraClash: [],
    heatClash: [],
    trace: null,
  };
}

/**
 * 釘了 no humans 的那一張：只抽場景。
 *
 * 借用 drawOne 的場景那一整套（場地、時代、室內外、日夜、光源、天氣、特效、背景格…），
 * 人物那幾段（長相、衣服、姿勢）張數設 0、情境只開「活動」—— 走光、性愛的強制規則都不會啟動；
 * 抽完再把所有在說人的字拿掉（卡司、傢俱、人群、只限男女的場景字…），前面放 no humans。
 * 背景不是素色的話再帶 scenery（素色背景上沒有人，比較像靜物，不是風景）。
 * 尾巴照舊跟滑桿走（「滑桿說了算」那條）。
 */
function drawNoHumans(lex, settings, pinned, userBanned, rand, seed, opts) {
  const keepPins = new Set([...pinned].filter((t) => t !== NO_HUMANS && t !== "scenery" && !isPersonTag(lex, t)));
  const mustDraw = {};
  for (const [k, v] of Object.entries((settings && settings.mustDraw) || {})) {
    if (k.startsWith("env:") || k.startsWith("quality:")) mustDraw[k] = v;
  }
  const inner = sanitizeSettings(
    { ...settings, heats: ["activity"], weights: null, counts: { ...(settings.counts || {}), feature: 0, clothing: 0, pose: 0 } },
    lex.data
  );
  inner.mustDraw = mustDraw;
  const d = drawOne(lex, inner, keepPins, userBanned, rand, seed, { ...(opts || {}), [NO_HUMANS_INNER]: true });
  if (d.cancelled) return d;
  const sec = d.sections || {};
  const env = (sec.env || []).filter((t) => !isPersonTag(lex, t));
  const camera = (sec.pose || []).filter((t) => SCENERY_CAMERA.has(t));
  const solid = env.some((t) => lex.byTag.get(t)?.mutex === "background");
  const subject = solid ? [NO_HUMANS] : [NO_HUMANS, "scenery"];
  const nsfw = sec.nsfw || [];
  const style = sec.style || [];
  const quality = sec.quality || [];
  const positive = [...new Set([...subject, ...camera, ...env, ...nsfw, ...style, ...quality])];
  let trace = d.trace;
  if (trace) {
    const final = new Set(positive);
    const kept = (trace.kept || []).filter((e) => final.has(e.tag));
    kept.unshift({ tag: NO_HUMANS, status: "kept", source: "pin", stage: "pin" });
    if (subject.includes("scenery")) kept.splice(1, 0, { tag: "scenery", status: "kept", source: "implies", stage: "pin", parent: NO_HUMANS });
    trace = { ...trace, kept };
  }
  return {
    ...d,
    heat: "activity",
    female: false,
    male: false,
    people: 0,
    mustReport: (d.mustReport || []).filter((m) => m.section === "env" || m.section === "quality"),
    sections: { quality, style, subject, feature: [], pose: camera, clothing: [], env, nsfw },
    positive: positive.join(", "),
    shadowViolations: [],
    conflicts: contradictions(lex, positive),
    heatClash: [],
    trace,
  };
}

// 看起來未成年的字：任何路徑都不輸出（隨機、釘選、預設組都一樣）。
const NEVER_DRAW = new Set(["loli", "shota"]);

export function drawOne(lex, settings, pinned, userBanned, rand, seed, opts) {
  // 釘選會繞過 allow() 直接放進畫面，所以在最前面就從釘選裡拿掉。
  if (pinned && [...pinned].some((t) => NEVER_DRAW.has(t))) pinned = new Set([...pinned].filter((t) => !NEVER_DRAW.has(t)));
  if (!(opts && opts[NO_HUMANS_INNER]) && pinned && typeof pinned.has === "function" && pinned.has(NO_HUMANS) && !(userBanned && userBanned.has && userBanned.has(NO_HUMANS))) {
    return drawNoHumans(lex, settings, pinned, userBanned, rand, seed, opts);
  }
  const drawOpts = opts && typeof opts === "object" ? opts : {};
  const tracer = createTracer({ enabled: !!drawOpts.trace, debug: !!drawOpts.debugTrace });
  const presetOwned = ownedTagSet(drawOpts.presetOwned);
  const requestedPins = new Set(pinned);
  const tagSources = tracer.enabled ? new Map() : null;
  const commitMeta = { source: SOURCES.random, stage: STAGES.fill, parent: null };
  const rating = ratingOf(settings);
  const sfw = rating !== "explicit";
  const blockedByRating = (item) => ratingBlocked(item, rating);
  // Scene policy once per draw — allow/allowSlow (and related) close over these.
  // Values ≡ SCENE_POLICY[mode].lockScene / realistic (not raw settings flags).
  const { mode: sceneMode, lockScene: lockOn, realistic: real } = scenePolicyOf(settings);
  // 釘選會繞過 allow()（forcePin 就是為了「使用者說了算」而存在的），所以光在
  // allow() 擋是不夠的：關掉色情模式之前釘的 nude、sex 會原封不動留在圖上，
  // 實測 60/60。關掉色情模式時，這些釘選一律當作不存在 —— 這是整個模式的
  // 保證，不能有例外。使用者原本的釘選沒有被改掉，重新打開就回來了。
  if (sfw) {
    const cleaned = new Set();
    for (const t of pinned) {
      if (!blockedByRating(lex.byTag.get(t))) cleaned.add(t);
      else if (tracer.enabled) {
        tracer.reject({
          tag: t,
          source: presetOwned.has(t) ? SOURCES.preset : SOURCES.pin,
          stage: STAGES.pin,
          reason: REASONS.rating_mismatch,
        });
      }
    }
    pinned = cleaned;
  }
  const autoBan = autoBannedFromPins(lex, pinned);
  const banned = new Set([...userBanned, ...autoBan]);
  const used = new Set();
  watchUsed(used);
  const mutexTaken = new Map();
  // M-class pool prefilter (整桶跳過). Does not replace item._mx inside allow / S path.
  const mIdx = lex._mIdx || (lex._mIdx = buildMutexIndexFromLex(lex));
  const mPool = (pool) => {
    if (!mutexTaken.size) return pool;
    return prefilterPoolByMutex(mIdx, mutexTaken, pool).kept;
  };
  const mPre = { idx: mIdx, taken: mutexTaken };

  const ctx = pinContext(lex, pinned);
  const heat = chooseHeat(settings, pinned, lex, rand, ctx);
  const era = chooseEra(settings, pinned, lex, rand, ctx);
  let allow = () => true;
  const rawCommit = makeCommit(lex, used, mutexTaken, banned, era, (item) => allow(item));
  // 「不補」＝那一段整段不補（2026-09-25 專案主決定，見 討論區.md）。
  // 以前 counts 只管 fill() 的通用補牌；髮長、瞳色、鏡頭、表情、場地、室內外、晝夜、光源、
  // 最低限度的衣服這些骨架格走 fillSlot／時代錨／修復，完全不看 counts —— 四段都設 0，
  // 每張照樣有約 15 個非畫質字是引擎補的（實測 400 張平均 15.5）。
  // 閘門下在 commit：只擋引擎自己要補的（random／era_anchor／repair）。
  // 釘選走 forcePin 不經過這裡；釘選 implies／bind 帶上來的、必抽、人物（subject 不在
  // QUOTA_SECTIONS）、畫質字都照舊。
  const zeroSections = new Set(QUOTA_SECTIONS.filter((s) => settings.counts && Number(settings.counts[s]) === 0));
  // 骨架格的開關（2026-09-29 專案主決定）：同一道閘門細到「段:小分類」。
  // 骨架格不看數字，以前「姿勢 1」照樣補五格；現在數字比骨架少時，只補 skeletonLit()
  // 選中的那幾格，其他的在這裡擋掉。
  // 數字比骨架少時，那一段的「擲骰格」（天氣、坐臥面、背景、人種…）也一起停：
  // 使用者說的是「只要 N 個」。背景是地點的替代品，跟著地點那格走。
  // 不擋的：性愛／走光動作（尺度管）、職業（「抽職業」開關管）、場景的「其他」
  // （多半是活動附帶的道具，釣魚要有釣竿）。
  const offGroups = new Set();
  const groupsBySection = lex._groupsBySection || (lex._groupsBySection = (() => {
    const m = {};
    for (const it of lex.data.tags || []) (m[it.section] ||= new Set()).add(it.group);
    return m;
  })());
  for (const section of Object.keys(SKELETON)) {
    if (zeroSections.has(section)) continue;
    const keys = skeletonKeys(section);
    const lit = new Set(skeletonLit(settings, section));
    if (lit.size >= keys.length) continue;
    if (lit.has("env:place")) lit.add("env:background");
    for (const g of groupsBySection[section] || []) {
      const k = section + ":" + g;
      if (!lit.has(k) && !SKELETON_KEEP.has(k)) offGroups.add(k);
    }
  }
  const offKeysOf = (it) =>
    it.section === "clothing" ? clothingKindKeys(it) : [it.section + ":" + it.group];
  const ENGINE_FILL = new Set([SOURCES.random, SOURCES.era_anchor, SOURCES.repair]);
  const innerCommit = zeroSections.size || offGroups.size
    ? (tag) => {
        if (ENGINE_FILL.has(commitMeta.source)) {
          const it = lex.byTag.get(tag);
          if (zeroSections.has(it?.section)) return false;
          if (it && offKeysOf(it).some((k) => offGroups.has(k))) return false;
        }
        return rawCommit(tag);
      }
    : rawCommit;
  const commit = tracer.enabled
    ? (tag) => {
        const before = new Set(used);
        const ok = innerCommit(tag);
        if (ok) {
          for (const t of used) {
            if (before.has(t)) continue;
            if (t === tag) {
              tagSources.set(t, commitMeta.source);
              tracer.keep({ tag: t, source: commitMeta.source, stage: commitMeta.stage, parent: commitMeta.parent });
            } else {
              const item = lex.byTag.get(tag);
              const bound = !!(item && (item.bind || []).includes(t));
              const src = bound ? SOURCES.bind : SOURCES.implies;
              tagSources.set(t, src);
              tracer.keep({ tag: t, source: src, stage: commitMeta.stage, parent: tag });
            }
          }
          for (const t of before) {
            if (used.has(t)) continue;
            tracer.reject({
              tag: t,
              source: tagSources.get(t) || SOURCES.random,
              stage: commitMeta.stage,
              reason: REASONS.replaced,
              related: [tag],
            });
            tagSources.delete(t);
          }
        }
        return ok;
      }
    : innerCommit;
  let cast = chooseCast(lex, settings, pinned, banned, rand, ctx);
  // 五人只在「兩邊性別都開、這一抽是性愛、沒有釘人數或特定多人」時，用另一條亂數
  // 低機率換掉卡司。不碰主 rand，沒升級的種子後面的衣服姿勢照舊。
  const countPinned = ["1girl", "2girls", "3girls", "4girls", "5girls", "6+girls", "1boy", "2boys", "3boys", "4boys", "6+boys"].some((t) =>
    pinned.has(t)
  );
  if (
    heat === "sex" &&
    settings.girl !== false &&
    settings.boy &&
    !countPinned &&
    // 釘了 solo 的人，chooseCast 已經把卡司收回一人；升級不能把它蓋掉。
    !pinned.has("solo") &&
    !pinned.has("pov") &&
    !pinned.has("pov crotch") &&
    !ctx.needGroup &&
    !ctx.needCrowd &&
    !ctx.need2Male &&
    !ctx.need2Female &&
    !ctx.needFive &&
    !ctx.needYaoi &&
    personCount(cast) < 5 &&
    Number.isFinite(seed)
  ) {
    const fiveRand = mulberry32(((seed >>> 0) ^ 0x0f17e50e) >>> 0);
    if (fiveRand() < 0.04) {
      const options = [
        ["4girls", "1boy"],
        ["3girls", "2boys"],
        ["2girls", "3boys"],
      ]
        .filter((parts) => parts.every((t) => lex.byTag.has(t) && !banned.has(t)))
        // 釘住的字要在新卡司裡照樣成立（例如只要女生的 yuri 類），不然升級等於把釘選丟掉。
        .filter((parts) => {
          const girls = genderCount(parts, true);
          const boys = genderCount(parts, false);
          return [...pinned].every((t) => {
            const it = lex.byTag.get(t);
            return !it || castOk(it, girls > 0, boys > 0, girls + boys, girls, boys);
          });
        });
      if (options.length) cast = options[Math.floor(fiveRand() * options.length)];
    }
  }
  let female = hasFemale(cast);
  let male = hasMale(cast);
  let people = personCount(cast);

  for (const t of cast) commit(t);

  const forcePin = (tag, parent, root) => {
    if (!tag || used.has(tag)) return;
    if (userBanned.has(tag) && !pinned.has(tag)) return;
    const origin = root || tag;
    const item = lex.byTag.get(tag);
    if (item) {
      for (const g of extraMutex(item)) {
        const old = mutexTaken.get(g);
        if (old && old !== tag && !pinned.has(old) && !parentChild(lex, tag, old)) {
          if (tracer.enabled) {
            tracer.reject({
              tag: old,
              source: tagSources.get(old) || SOURCES.random,
              stage: STAGES.pin,
              reason: REASONS.replaced,
              related: [tag],
            });
            tagSources.delete(old);
          }
          used.delete(old);
        }
      }
    }
    used.add(tag);
    if (tracer.enabled) {
      let source = SOURCES.pin;
      if (parent) {
        const pItem = lex.byTag.get(parent);
        source = pItem && (pItem.bind || []).includes(tag) ? SOURCES.bind : SOURCES.implies;
      } else if (presetOwned.has(tag)) source = SOURCES.preset;
      tagSources.set(tag, source);
      tracer.keep({ tag, source, stage: STAGES.pin, parent: parent || undefined });
    }
    if (item) {
      for (const g of extraMutex(item)) mutexTaken.set(g, tag);
      for (const d of dependents(lex, tag)) {
        // 兩邊都行的場地：使用者已經釘了另一側，就不要把詞庫的室內／室外再補進來。
        if (keepPlaceSide(tag, d, (other) => pinned.has(other) || used.has(other))) continue;
        if (banned.has(d) && !pinned.has(d)) continue;
        if (!pinned.has(d) && era && !depAllowed(lex, d, era)) continue;
        const di = lex.byTag.get(d);
        const originItem = lex.byTag.get(origin);
        // 根字沒有直接帶出的同格孫字不要補。東京自己被釘時仍會帶出城市。
        if (
          di && originItem && di.mutex && di.mutex === originItem.mutex &&
          !parentChild(lex, origin, d)
        ) continue;
        forcePin(d, tag, origin);
      }
    }
  };
  // 已經被另一張釘選帶出來的字不再當根。否則澀谷帶出的東京會自己再帶出城市。
  const impliedPin = new Set();
  for (const tag of pinned) {
    const it = lex.byTag.get(tag);
    if (!it) continue;
    for (const d of [...(it.implies || []), ...(it.bind || [])]) {
      if (pinned.has(d)) impliedPin.add(d);
    }
  }
  for (const tag of pinned) {
    if (impliedPin.has(tag)) continue;
    forcePin(tag);
  }

  const subjectNow = [...used].filter((t) => {
    const it = lex.byTag.get(t);
    return it && it.section === "subject";
  });
  if (subjectNow.length) {
    female = hasFemale(subjectNow);
    male = hasMale(subjectNow);
    people = personCount(subjectNow);
  }
  // §1 Intent frozen — UI progress only; no used/positive in payload.
  if (
    emitDrawStage(drawOpts, {
      stage: "intent",
      intent: {
        rating,
        heat,
        era,
        cast: { female, male, people },
        pinConflicts: [],
      },
    })?.cancel
  ) {
    return cancelledDrawResult({ heat, era, female, male, people, seed });
  }
  const hasUsed = (predicate) => {
    for (const tag of used) if (predicate(tag)) return true;
    return false;
  };
  // 走光／衣服動作每過一次 allow() 就問一次這個，以前每次都重掃 used、重跑
  // actionFitsClothes 的 token 與正則：走光圖的補抽對五十幾個字各問一次，
  // 實測那一段 0.65 ms、佔整張 20%。used 沒變（_rev 相同）就不必重算。
  const actionFitsWorn = (item) => {
    let memo = recall(used, "_wornFit");
    if (memo === undefined) {
      const cloth = [];
      for (const t of used) {
        const it = lex.byTag.get(t);
        if (it && it.section === "clothing") cloth.push(t);
      }
      memo = remember(used, "_wornFit", { cloth, fit: new Map() });
    }
    let fit = memo.fit.get(item.tag);
    if (fit === undefined) {
      fit = actionFitsClothes(item.tag, memo.cloth);
      memo.fit.set(item.tag, fit);
    }
    return fit;
  };
  const wearsBodyClothes = () => {
    if (
      someUsed(
        (it) =>
          it.tag === "nude" ||
          it.tag === "completely nude" ||
          (it.section === "clothing" && it.layer === "skin")
      )
    ) {
      return false;
    }
    return someUsed(
      (it) =>
        it.section === "clothing" &&
        it.layer === "garment" &&
        (it.mutex === "onepiece" || it.mutex === "top" || it.mutex === "bottom")
    );
  };
  const genderNow = () => {
    const rev = used._rev;
    const hit = used._gg;
    if (hit && hit.rev === rev) return hit;
    const next = { rev, girls: genderCount(used, true), boys: genderCount(used, false) };
    used._gg = next;
    return next;
  };
  allow = (item, opts) => {
    if (banned.has(item.tag) || used.has(item.tag)) return false;
    // 關掉色情模式：情色的字一個都不准進場。放在 banned/used 之後、其餘 O(1)
    // 關卡之前：純 short-circuit，同一個 blockedByRating / sfw，只改何時判斷。
    // 後面所有補救邏輯（浴場補衣、上衣補下著、必抽）也都走 allow，
    // 所以不會有人從側門把它們塞回來。
    if (sfw && blockedByRating(item)) return false;
    // 這三道關卡只看候選字自己：O(1)、沒有副作用、不消耗 rand。
    // 它們原本排在第 9、第 10、和 272 道關卡裡的最後一道，而量出來每抽一張圖
    // allow() 被呼叫 2141 次、擋掉 1180 次，其中
    //   尺度／人選  319 次（27%）
    //   時代        265 次（22%）
    //   互斥格      195 次（16.5%）
    // ——— 三道合計 66% 的拒絕，卻排在整串的第 9、10 和最後。排在它們前面的
    // supportCandidateAllowed 每次呼叫配置一個物件字面值、佔總時間 6.5%，
    // 由那 66% 一起埋單。
    //
    // 純判斷式重排不改變任何結果（全部是 `if (...) return false` 的 AND 串，
    // 沒有一道會寫東西或抽亂數）。實測 12 種情境 × seed 42..241 共 2400 張
    // 逐字指紋不變，而每張快 29%（與 HEAD 交錯跑三輪取中位數）。
    // 守衛在 test_draw_baseline.mjs：指紋一條、順序三條。
    if (!heatOk(item, heat) || !gateOk(item, female, male)) return false;
    // 必抽（opts.skipEra）只繞過時代這一關。互斥、尺度、性別、物理支撐照擋。
    if (!(opts && opts.skipEra) && !eraOk(item, era)) return false;
    for (const g of extraMutex(item)) {
      if (mutexTaken.has(g)) return false;
    }
    if (SUPPORT_CANDIDATE_TAGS.has(item.tag) && !supportCandidateAllowed({
      used,
      candidate: item.tag,
      pinned,
      mode: sceneMode,
      people,
    })) return false;
    // 過了上面這幾道的字才進後面那串。函式本身有一千多行，絕大多數候選在
    // 尺度、時代或互斥就離開；把它們留在同一支函式裡，光是呼叫就要付整支的進場成本。
    return allowSlow(item);
  };

  // 釘了室內外、天氣、傢俱或自帶場地的活動時，場地池會被收到很少幾個字。
  // 那時候才封頂，避免竹林或道場吃掉整格。沒釘的性愛不再另走私密白名單。
  let sexPlaceRelax = null;
  const relaxesPrivateSex = () => {
    if (sexPlaceRelax !== null) return sexPlaceRelax;
    let yes = pinned.has("outdoors") || pinned.has("indoors");
    if (!yes) {
      for (const t of pinned) {
        if (
          OUTDOOR_WEATHER.has(t) ||
          OUTDOOR_LEFTOVER.has(t) ||
          INDOOR_PROP.has(t) ||
          INDOOR_FURN.has(t)
        ) {
          yes = true;
          break;
        }
        const it = lex.byTag.get(t);
        if (!it) continue;
        const implied = it.implies || [];
        if (implied.includes("outdoors") || implied.includes("indoors")) {
          yes = true;
          break;
        }
        if (it.mutex === "activity" && ACT_PLACE[t]) {
          yes = true;
          break;
        }
      }
    }
    sexPlaceRelax = yes;
    return yes;
  };
  const fittingPlace = new Map();
  const eraHasFittingPlace = (acts) => {
    const key = [...acts].sort().join("\0");
    const hit = fittingPlace.get(key);
    if (hit !== undefined) return hit;
    let yes = false;
    const list = lex.bySection.env;
    for (let i = 0; i < list.length; i += 1) {
      const cand = list[i];
      if (cand.mutex !== "place" && cand.group !== "place") continue;
      if (!eraOk(cand, era)) continue;
      if (placeFitsActs(cand.tag, acts, real)) {
        yes = true;
        break;
      }
    }
    fittingPlace.set(key, yes);
    return yes;
  };
  let sportEra = null;
  const eraHasSportPlace = () => {
    if (sportEra !== null) return sportEra;
    let yes = false;
    for (const p of SPORT_PLACE) {
      const it = lex.byTag.get(p);
      if (it && eraOk(it, era)) {
        yes = true;
        break;
      }
    }
    sportEra = yes;
    return yes;
  };

  const allowSlow = (item) => {
    // loincloth 是中世紀男性浴場的可辨識替代衣著，不是每張中世紀圖的制服。
    // 服裝先於自然場景抽取，故一般 fill 先略過；場景確定為浴場後的 repair 仍可選。
    // forcePin 不走 allow，因此使用者明確釘選在任何場景都會完整保留。
    if (item.tag === "loincloth" && !pinned.has(item.tag) && !isBathScene(used)) return false;
    // 同義詞只留一個。這條天生對稱 —— 不管誰先進場，後來那個都會被擋。
    if (synonymClash(item.tag, used)) return false;
    // 同一張圖不能既還沒開始又已經結束。天生對稱，誰先進場都擋得住。
    if (sexPhaseClash(item.tag, used)) return false;
    if (condomStateClash(item.tag, used)) return false;
    if (peerIn(item.tag, used, GRIP)) return false;
    if (ROUGH_DURING.has(item.tag) && hasUsed((t) => SEX_PHASE_AFTER.has(t))) return false;
    if (SEX_PHASE_AFTER.has(item.tag) && hasUsed((t) => ROUGH_DURING.has(t))) return false;
    if (peerIn(item.tag, used, PENIS_STATE)) return false;
    if (peerIn(item.tag, used, PENIS_ON_HEAD)) return false;
    // 先走汁是射之前。軟掉、以及已經結束的那一輪，都不再滴先走汁。
    // 射精後可以是軟的，所以 flaccid 不跟 SEX_PHASE_AFTER 互斥。
    if (PRECUM_TAGS.has(item.tag) && (used.has("flaccid") || hasUsed((t) => SEX_PHASE_AFTER.has(t)))) return false;
    if ((item.tag === "flaccid" || SEX_PHASE_AFTER.has(item.tag)) && hasUsed((t) => PRECUM_TAGS.has(t))) return false;
    if (item.tag === "twitching penis" && used.has("flaccid")) return false;
    if (item.tag === "flaccid" && used.has("twitching penis")) return false;
    if (EJACULATION_ACT.has(item.tag) && used.has("flaccid")) return false;
    if (item.tag === "flaccid" && hasUsed((t) => EJACULATION_ACT.has(t))) return false;
    if (CLOTHED_ONLY.has(item.tag) && hasUsed((t) => FULL_NUDE.has(t))) return false;
    if (FULL_NUDE.has(item.tag) && hasUsed((t) => CLOTHED_ONLY.has(t))) return false;
    // 大睪丸寫的是看得到的睪丸。被衣服擋住時不再同時標尺寸，也不再標裸露的 testicles。
    if (item.tag === "covered testicles" && hasUsed((t) => TESTICLE_BARE.has(t))) return false;
    if (TESTICLE_BARE.has(item.tag) && used.has("covered testicles")) return false;
    // 裸手性愛是單人 sex 場景的主要可用活動；非運動情境不要隨機抽入拳擊手套
    // 把整個 sex_act 槽堵死。使用者或拳擊 preset 明確釘選時仍完整尊重。
    if (item.tag === "boxing gloves" && heat === "sex" && !pinned.has(item.tag)) return false;
    if (NEEDS_FREE_HAND.has(item.tag) && hasUsed((tag) => HANDS_OCCUPIED.has(tag))) return false;
    if (HANDS_OCCUPIED.has(item.tag) && hasUsed((tag) => NEEDS_FREE_HAND.has(tag))) return false;
    const cast = genderNow();
    if (!castOk(item, female, male, people, cast.girls, cast.boys)) return false;
    if (used.has("bald") && (item.mutex === "hair_color" || item.group === "hair_style" || item.group === "hair_color")) return false;
    if (item.tag === "bald" && someUsed((it) => it.group === "hair_color" || it.group === "hair_style")) return false;
    // 動物種類（詞庫的 kind，merge_lexicon.py 的 KIND）：貓耳只配貓娘，兔尾不配狐尾，龍角不配惡魔角。
    // 同種的耳朵、尾巴、角、種族可以疊；沒有種類的字（獸耳、尾巴、精靈）跟誰都能放。
    if (item.kind && someUsed((it) => it.kind && it.kind !== item.kind)) return false;
    if (item.tag === "fat" && used.has("skinny")) return false;
    if (item.tag === "skinny" && used.has("fat")) return false;
    if (item.tag === "long sleeves" && used.has("short sleeves")) return false;
    if (item.tag === "short sleeves" && used.has("long sleeves")) return false;
    // loli、shota：這個工具不畫看起來未成年的人。隨機抽不到，釘住也不給。
    // 釘選在 drawOne 一開頭就從 pin 集合拿掉，這裡再擋一次，避免別的路徑繞進來。
    //
    // shota 原本靠「跟 adult 互斥」永遠抽不到。2026-09-18 拿掉 adult 之後改成直接規則。
    // 2026-09-28 品質檢查：loli 仍會自動出現（1350 張有 5 張），連釘選也關掉。
    if (NEVER_DRAW.has(item.tag)) return false;
    // 獠牙是獸人、吸血鬼這類才有的。虎牙 fang 是普通人的牙齒，不走這裡。
    // 種族在特徵補牌之前就填了，所以這裡問得到。正常模式不抽種族，獠牙也就不出現。
    if (
      item.tag === "tusks" &&
      !pinned.has(item.tag) &&
      !hasUsed((t) => {
        if (t === "monster boy" || t === "vampire" || t === "dragon boy") return true;
        return (lex.byTag.get(t)?.implies || []).includes("monster boy");
      })
    ) {
      return false;
    }
    if (
      needsClothingDependency(item) && item.section !== "clothing" &&
      actionFitsWorn(item) === 0
    ) {
      return false;
    }
    // 這一關是給動作用的（needsBodyClothes 的參數就叫 actionTag）：掀裙子要先有裙子。
    // 但那條 /through clothes/ 正規表達式也會抓到衣服，而衣服不必再去找一件自己。
    // bra visible through clothes 的 garment key 就是 bra，於是它被要求身上另外有
    // 一件 bra —— 可是所有的 bra 都跟它搶同一個 underwear_top 格：先有 bra 就沒
    // 格子，沒 bra 就不給進。它是 underwear_top 十個字裡唯一抽不到的那個（實測
    // 0/1500；把剛好不佔格的 bra 釘起來才變 79/800，釘 sports bra 佔走格子又回到 0）。
    //
    // 它真正需要的是「身上有衣服可以透出來」，那就是 wearsBodyClothes()。隔壁的
    // see-through clothes 沒有 garment key，本來走的就是這條路 —— 詞庫裡只有這兩個
    // 衣服會被那條正規表達式抓到，所以這個例外只影響這一個字。
    const selfIsTheGarment = item.section === "clothing";
    if (
      needsBodyClothes(item.tag) &&
      ((!selfIsTheGarment && actionFitsWorn(item) === 0) || !wearsBodyClothes())
    ) {
      return false;
    }
    if (item.tag === "mixed-sex bathing" && (!male || !female)) return false;
    if (item.mutex === "activity" && !activityFitsBody(item.tag, usedMutexTags(used, lex, "body_pose"))) return false;
    if (item.mutex === "body_pose") {
      const acts = usedActs(used, lex);
      for (const a of acts) {
        if (!activityFitsBody(a, new Set([item.tag]))) return false;
      }
    }
    const needsFace =
      item.mutex === "gaze" ||
      item.mutex === "expression" ||
      item.mutex === "eye_color" ||
      item.group === "face" ||
      item.group === "eyes" ||
      FACE_NEED_TAGS.has(item.tag) ||
      item.tag === "glasses" ||
      item.tag === "tears" ||
      item.tag === "one eye closed" ||
      /^looking /.test(item.tag);
    const faceless = usedHas(used, "_face", (t) => FACELESS_CAM.has(t));
    if (needsFace && faceless) return false;
    if (faceless) {
      for (const d of item.implies || []) {
        const di = lex.byTag.get(d);
        if (
          FACE_NEED_TAGS.has(d) ||
          di?.mutex === "gaze" ||
          di?.mutex === "eye_color" ||
          di?.group === "eyes" ||
          /^looking /.test(d)
        ) {
          return false;
        }
      }
    }
    if (FACELESS_CAM.has(item.tag)) {
      for (const t of used) {
        const it = lex.byTag.get(t);
        if (
          it &&
          (it.mutex === "gaze" ||
            it.mutex === "expression" ||
            it.mutex === "eye_color" ||
            it.group === "face" ||
            it.group === "eyes" ||
            FACE_NEED_TAGS.has(t) ||
            t === "glasses" ||
            t === "tears" ||
            t === "one eye closed" ||
            t === "lipstick" ||
            /^looking /.test(t))
        ) {
          return false;
        }
      }
    }
    // 只有「嚴格白天」和「嚴格夜側」互斥，而且兩邊對稱。
    // sunset / dusk 是日夜過渡，兩側都相容，刻意不參與這條硬擋 —— 黃昏看見星星或
    // 月光本來就合理，夜市在日落時分開張也是。它們和 day / night 同屬 day_night
    // 互斥，該擋的那一半互斥系統已經擋掉了。
    if (NIGHT_MARK.has(item.tag) && hasUsed((t) => DAY_MARK.has(t))) return false;
    if (DAY_MARK.has(item.tag) && hasUsed((t) => NIGHT_MARK.has(t))) return false;
    // 純色背景：沒有天空、天氣、傢俱，也沒有窗光、城市燈光這種場景光。兩個方向都擋。
    if (item.mutex === "background" && hasUsed((t) => bgClash(lex.byTag.get(t)))) return false;
    if (bgClash(item) && hasUsed((t) => lex.byTag.get(t)?.mutex === "background")) return false;
    // 正午的篝火、白天的街燈。天生對稱：光源先進場或白天先進場都擋得住。
    if (DARK_LIGHT.has(item.tag) && hasUsed((t) => DAY_MARK.has(t))) return false;
    if (DAY_MARK.has(item.tag) && hasUsed((t) => DARK_LIGHT.has(t))) return false;
    if (heat === "flash" && item.tag === "sleeping" && !pinned.has("sleeping")) return false;
    if (used.has("sleeping") && SLEEP_BAD_POSE.has(item.tag)) return false;
    if (item.tag === "sleeping" && hasUsed((t) => SLEEP_BAD_POSE.has(t))) return false;
    if (used.has("sleeping") && SLEEP_BAD_EXPR.has(item.tag)) return false;
    if (item.tag === "sleeping") {
      if (hasUsed((t) => lex.byTag.get(t)?.mutex === "gaze" || /^looking /.test(t) || t === "kiss")) {
        return false;
      }
    }
    if (used.has("sleeping")) {
      if (item.mutex === "gaze" || /^looking /.test(item.tag) || item.tag === "kiss") return false;
      for (const d of item.implies || []) {
        if (lex.byTag.get(d)?.mutex === "gaze") return false;
      }
      if (
        item.section === "pose" &&
        !pinned.has(item.tag) &&
        item.mutex !== "camera" &&
        item.mutex !== "body_pose" &&
        item.mutex !== "expression" &&
        item.mutex !== "clothes_action" &&
        item.group !== "flash"
      ) {
        return false;
      }
    }
    if (EYE_EXTRA.has(item.tag) && hasUsed((t) => EYE_EXTRA.has(t))) return false;
    if (MOUTH_EXTRA.has(item.tag) && hasUsed((t) => MOUTH_EXTRA.has(t))) return false;
    if (used.has("sleeping") && (EYE_EXTRA.has(item.tag) || MOUTH_EXTRA.has(item.tag))) return false;
    if (used.has("closed eyes") || used.has("covering own eyes")) {
      if (EYE_EXTRA.has(item.tag) || item.mutex === "gaze" || /^looking /.test(item.tag)) return false;
      for (const d of item.implies || []) {
        if (lex.byTag.get(d)?.mutex === "gaze") return false;
      }
    }
    if (
      item.tag === "covering own eyes" &&
      hasUsed((t) => EYE_EXTRA.has(t) || lex.byTag.get(t)?.mutex === "gaze" || /^looking /.test(t))
    ) {
      return false;
    }
    if (
      (used.has("closed mouth") || used.has("covering own mouth")) &&
      MOUTH_EXTRA.has(item.tag)
    ) {
      return false;
    }
    if ((item.tag === "closed mouth" || item.tag === "covering own mouth") && hasUsed((t) => MOUTH_EXTRA.has(t))) {
      return false;
    }
    // 睜眼流淚跟閉眼、睡著互相抵銷。普通的 crying 仍可閉眼。
    if (
      item.tag === "crying with eyes open" &&
      (used.has("closed eyes") || used.has("sleeping"))
    ) {
      return false;
    }
    if (
      (item.tag === "closed eyes" || item.tag === "sleeping") &&
      used.has("crying with eyes open")
    ) {
      return false;
    }
    // 口塞佔住嘴。口交、接吻進不來；反過來也一樣。
    // 膠帶和咬棒把嘴封住，不能再張嘴。開口器是撐開，要帶著張嘴，所以不在 CLOSED_GAG。
    if ((item.tag === "gag" || item.tag === "mouth hold") && hasUsed((t) => GAG_BLOCKS.has(t))) return false;
    if (GAG_BLOCKS.has(item.tag) && hasUsed((t) => GAG_KIND.has(t))) return false;
    if (CLOSED_GAG.has(item.tag) && hasUsed((t) => MOUTH_EXTRA.has(t))) return false;
    if (MOUTH_EXTRA.has(item.tag) && hasUsed((t) => CLOSED_GAG.has(t))) return false;
    if (
      GAG_KIND.has(item.tag) &&
      hasUsed((t) => GAG_KIND.has(t) && t !== item.tag && !parentChild(lex, item.tag, t))
    ) {
      return false;
    }
    // 只穿比基尼上衣就是下身沒穿。下身裸是它自己帶進來的。
    if (
      item.tag === "bikini top only" &&
      hasUsed((t) => {
        const it = lex.byTag.get(t);
        return it && (it.mutex === "bottom" || it.mutex === "underwear_bottom" || it.mutex === "onepiece") &&
          !parentChild(lex, item.tag, t);
      })
    ) {
      return false;
    }
    if (
      used.has("bikini top only") &&
      (item.mutex === "bottom" || item.mutex === "underwear_bottom" || item.mutex === "onepiece") &&
      !parentChild(lex, "bikini top only", item.tag)
    ) {
      return false;
    }
    // 無臉男沒有鬍子。不把它算進無臉構圖，女生的表情還在。
    if (item.tag === "faceless male" && hasUsed((t) => MALE_FACE.has(t))) return false;
    if (MALE_FACE.has(item.tag) && used.has("faceless male")) return false;
    // 第一人稱的手是觀看者的手。畫面上已經有兩個人時不再加。
    if (item.tag === "pov hands" && people >= 2 && !pinned.has("pov hands")) return false;
    // 公開裸體、公共跳蛋不進臥室這類私密場景。
    if (
      (item.tag === "public nudity" || item.tag === "public vibrator") &&
      hasUsed((t) => NOT_PUBLIC_SCENE.has(t))
    ) {
      return false;
    }
    if (
      NOT_PUBLIC_SCENE.has(item.tag) &&
      (used.has("public nudity") || used.has("public vibrator"))
    ) {
      return false;
    }
    // 四肢都沒了，就不再抽用手、用腳、走路、手套、袖子、分腿棍。觀看者的手（pov hands）不是她的。
    // 拳交在有第二個人時可以是對方的手，單人則沒有手可伸。
    if (item.tag === "quadruple amputee" && hasUsed((t) => needsLimbs(lex.byTag.get(t)))) return false;
    if (item.tag === "quadruple amputee" && people < 2 && hasUsed((t) => PARTNER_HAND.has(t))) return false;
    if (needsLimbs(item) && used.has("quadruple amputee") && item.tag !== "pov hands") return false;
    if (PARTNER_HAND.has(item.tag) && people < 2 && used.has("quadruple amputee")) return false;
    if (item.tag === "minigirl" && used.has("giantess")) return false;
    if (item.tag === "giantess" && used.has("minigirl")) return false;
    if (PUPIL_SHAPE.has(item.tag) && hasUsed((t) => PUPIL_SHAPE.has(t) && t !== item.tag)) return false;
    if (MATERIAL.has(item.tag) && hasUsed((t) => t !== item.tag && (MATERIAL.has(t) || lex.byTag.get(t)?.mutex === "fabric"))) return false;
    if (item.mutex === "fabric" && hasUsed((t) => MATERIAL.has(t))) return false;
    if (item.tag === "space" && (used.has("indoors") || used.has("outdoors"))) return false;
    if ((item.tag === "indoors" || item.tag === "outdoors") && used.has("space")) return false;
    // 真空床、木馬這類室內傢俱會把室內外閘死在室內。太空又不准寫室內，
    // 兩件都在時室內外會整格空白（釘真空床、seed 15005）。
    if (item.tag === "space" && hasUsed((t) => INDOOR_FURN.has(t))) return false;
    if (INDOOR_FURN.has(item.tag) && used.has("space")) return false;
    // 貞操帶蓋住下體。泛用的「sex」是性交；口交那些字也會暗示它，所以父字已經在場時放行。
    const beltOpen =
      hasUsed((t) => chastityCloses(lex.byTag.get(t))) ||
      (used.has("sex") && !hasUsed((t) => CHASTITY_OK.has(t)));
    if (item.tag === "chastity belt" && beltOpen) return false;
    if (chastityCloses(item) && used.has("chastity belt")) return false;
    if (item.tag === "sex" && used.has("chastity belt") && !hasUsed((t) => CHASTITY_OK.has(t))) return false;
    if (SKY_EXTRA.has(item.tag) && hasUsed((t) => SKY_EXTRA.has(t))) return false;
    if ((item.tag === "on bed" || item.tag === "bed sheet") && usedPlaces(used, lex).size && ![...usedPlaces(used, lex)].some((p) => BED_PLACE.has(p))) {
      return false;
    }
    if (
      WATER_DETAIL.has(item.tag) &&
      !hasUsed(
        (t) => WATER_PLACE.has(t) || BATH_PLACE.has(t) || WATER_SOURCE_ACT.has(t) || BATH_ACT.has(t)
      )
    ) {
      return false;
    }
    if (used.has("indoors") && OUTDOOR_LEFTOVER.has(item.tag)) return false;
    if (used.has("outdoors") && INDOOR_PROP.has(item.tag)) return false;
    // 反向。單看這兩行擋不到東西 —— indoors／outdoors 多半是場地「暗示」進來的
    // （futon → indoors、open-air bath → outdoors）。但 commit() 現在會把暗示鏈
    // 的每一個字送進 allow()，所以這兩行是那條路徑真正的閘門：少了它們，釘一個
    // 戶外景物之後 indoors 照樣補得進來（釘 tree、seed 700005 → tree, futon, indoors）。
    if (item.tag === "indoors" && hasUsed((t) => OUTDOOR_LEFTOVER.has(t))) return false;
    if (item.tag === "outdoors" && hasUsed((t) => INDOOR_PROP.has(t))) return false;
    if (used.has("outdoors") && item.tag === "bunk bed") return false;
    if (item.tag === "outdoors" && used.has("bunk bed")) return false;
    if (
      (used.has("jogging") || used.has("skiing") || used.has("hiking")) &&
      (item.tag === "sitting on face" || item.tag === "sitting")
    ) {
      return false;
    }
    if (
      (item.tag === "jogging" || item.tag === "skiing" || item.tag === "hiking") &&
      (used.has("sitting on face") || used.has("sitting"))
    ) {
      return false;
    }
    if (
      item.tag === "on chair" &&
      hasUsed(
        (t) =>
          GROUND_BODY.has(t) ||
          LOCKED_SIT.has(t) ||
          LIE_BODY.has(t) ||
          t === "floating" ||
          t === "squatting" ||
          t === "kneeling" ||
          t === "on one knee" ||
          t === "driving" ||
          t === "jogging" ||
          t === "skiing" ||
          t === "hiking" ||
          t === "horseback riding" ||
          t === "standing" ||
          t === "dancing" ||
          t === "suspended congress"
      )
    ) {
      return false;
    }
    if (
      used.has("on chair") &&
      (GROUND_BODY.has(item.tag) ||
        LOCKED_SIT.has(item.tag) ||
        LIE_BODY.has(item.tag) ||
        item.tag === "floating" ||
        item.tag === "squatting" ||
        item.tag === "kneeling" ||
        item.tag === "on one knee" ||
        item.tag === "driving" ||
        item.tag === "jogging" ||
        item.tag === "skiing" ||
        item.tag === "hiking" ||
        item.tag === "horseback riding" ||
        item.tag === "standing" ||
        item.tag === "dancing" ||
        item.tag === "suspended congress")
    ) {
      return false;
    }
    if (
      item.tag === "contrapposto" &&
      hasUsed(
        (t) =>
          STILL_BODY.has(t) ||
          GROUND_BODY.has(t) ||
          LOCKED_SIT.has(t) ||
          t === "sitting" ||
          t === "squatting" ||
          t === "kneeling" ||
          t === "on one knee"
      )
    ) {
      return false;
    }
    if (
      used.has("contrapposto") &&
      item.mutex === "body_pose" &&
      item.tag !== "standing" &&
      item.tag !== "dancing"
    ) {
      return false;
    }
    if (item.tag === "legs up" && hasUsed((t) => LOCKED_SIT.has(t))) return false;
    if (LOCKED_SIT.has(item.tag) && used.has("legs up")) return false;
    if (item.tag === "spread legs" && hasUsed((t) => LOCKED_SIT.has(t))) return false;
    if (LOCKED_SIT.has(item.tag) && used.has("spread legs")) return false;
    {
      const legClashBody = (t) =>
        GROUND_BODY.has(t) ||
        LOCKED_SIT.has(t) ||
        t === "kneeling" ||
        t === "on one knee" ||
        t === "squatting" ||
        t === "dancing";
      if (LEG_EXTRA.has(item.tag) && hasUsed(legClashBody)) return false;
      if (legClashBody(item.tag) && hasUsed((t) => LEG_EXTRA.has(t))) return false;
      if ((item.tag === "legs up" || item.tag === "m legs") && used.has("standing")) return false;
      if (item.tag === "standing" && (used.has("legs up") || used.has("m legs"))) return false;
    }
    if (LEAN_POSE.has(item.tag) && hasUsed((t) => LIE_BODY.has(t))) return false;
    if (LIE_BODY.has(item.tag) && hasUsed((t) => LEAN_POSE.has(t))) return false;
    if (item.tag === "leaning back" && hasUsed((t) => GROUND_BODY.has(t))) return false;
    if (GROUND_BODY.has(item.tag) && used.has("leaning back")) return false;
    if (item.tag === "bent over" && hasUsed((t) => LIE_BODY.has(t))) return false;
    if (LIE_BODY.has(item.tag) && used.has("bent over")) return false;
    if (item.tag === "m legs" && (used.has("on stomach") || used.has("on side"))) return false;
    if (item.tag === "crossed legs" && used.has("on stomach")) return false;
    if (item.tag === "on stomach" && used.has("crossed legs")) return false;
    if ((item.tag === "on stomach" || item.tag === "on side") && used.has("m legs")) return false;
    if (
      (item.tag === "breasts on table" || item.tag === "breasts on glass") &&
      hasUsed((t) => LIE_BODY.has(t) || GROUND_BODY.has(t))
    ) {
      return false;
    }
    if (
      (LIE_BODY.has(item.tag) || GROUND_BODY.has(item.tag)) &&
      (used.has("breasts on table") || used.has("breasts on glass"))
    ) {
      return false;
    }
    if (item.tag === "hand in pocket" && (used.has("nude") || used.has("completely nude"))) return false;
    if ((item.tag === "nude" || item.tag === "completely nude") && used.has("hand in pocket")) return false;
    if (item.tag === "hand in pocket" && hasUsed((t) => /\b(bikini|swimsuit)\b/.test(t))) return false;
    if (/\b(bikini|swimsuit)\b/.test(item.tag) && used.has("hand in pocket")) return false;
    if (BOTH_ARMS.has(item.tag) && hasUsed((t) => NEEDS_FREE_HAND.has(t))) return false;
    if (NEEDS_FREE_HAND.has(item.tag) && hasUsed((t) => BOTH_ARMS.has(t))) return false;
    if (
      used.has("lower body") &&
      (BOTH_ARMS.has(item.tag) || HAND_GESTURE.has(item.tag) || ARM_POSE.has(item.tag) || HANDS_BUSY_ACT.has(item.tag))
    ) {
      return false;
    }
    if (
      item.tag === "lower body" &&
      hasUsed((t) => BOTH_ARMS.has(t) || HAND_GESTURE.has(t) || ARM_POSE.has(t) || HANDS_BUSY_ACT.has(t))
    ) {
      return false;
    }
    if (item.tag === "playing guitar" && used.has("on stomach")) return false;
    if (item.tag === "on stomach" && used.has("playing guitar")) return false;
    if (item.tag === "washing back" && used.has("on stomach")) return false;
    if (item.tag === "on stomach" && used.has("washing back")) return false;
    if (
      (item.tag === "breasts on table" || item.tag === "breasts on glass") &&
      (used.has("dancing") ||
        used.has("diving") ||
        used.has("suspended congress") ||
        hasUsed((t) => WATER_ACT.has(t) || t === "wading"))
    ) {
      return false;
    }
    if (
      (item.tag === "dancing" ||
        item.tag === "diving" ||
        item.tag === "suspended congress" ||
        WATER_ACT.has(item.tag) ||
        item.tag === "wading") &&
      (used.has("breasts on table") || used.has("breasts on glass"))
    ) {
      return false;
    }
    if (item.tag === "amazon position" && used.has("top-down bottom-up")) return false;
    if (item.tag === "top-down bottom-up" && used.has("amazon position")) return false;
    if (item.tag === "sitting" && used.has("floating")) return false;
    if (item.tag === "floating" && used.has("sitting")) return false;
    if (
      item.tag === "floating" &&
      (used.has("against glass") || used.has("against window") || used.has("against wall"))
    ) {
      return false;
    }
    if (
      (item.tag === "against glass" || item.tag === "against window" || item.tag === "against wall") &&
      used.has("floating")
    ) {
      return false;
    }
    if (item.tag === "horseback riding" && used.has("legs up")) return false;
    if (item.tag === "legs up" && used.has("horseback riding")) return false;
    if (item.tag === "hanging breasts" && hasUsed((t) => LIE_BODY.has(t) || t === "on stomach")) return false;
    if ((LIE_BODY.has(item.tag) || item.tag === "on stomach") && used.has("hanging breasts")) return false;
    if (item.tag === "amazon position" && hasUsed((t) => LIE_BODY.has(t) || t === "on side" || t === "on stomach")) {
      return false;
    }
    if ((LIE_BODY.has(item.tag) || item.tag === "on side" || item.tag === "on stomach") && used.has("amazon position")) {
      return false;
    }
    if (item.tag === "driving" && hasUsed((t) => BOTH_ARMS.has(t))) return false;
    if (BOTH_ARMS.has(item.tag) && used.has("driving")) return false;
    if (item.tag === "cooking" && used.has("sitting")) return false;
    if (item.tag === "sitting" && used.has("cooking")) return false;
    if (
      (item.tag === "sitting on lap" || item.tag === "straddling") &&
      (used.has("cooking") || used.has("cleaning") || used.has("riding bicycle"))
    ) {
      return false;
    }
    if (
      (item.tag === "cooking" || item.tag === "cleaning" || item.tag === "riding bicycle") &&
      (used.has("sitting on lap") || used.has("straddling"))
    ) {
      return false;
    }
    if (item.tag === "cooking" && used.has("on chair")) return false;
    if (item.tag === "on chair" && used.has("cooking")) return false;
    if (item.tag === "carrying" && used.has("on one knee")) return false;
    if (item.tag === "on one knee" && used.has("carrying")) return false;
    if (item.tag === "carrying" && (used.has("squatting") || used.has("kneeling"))) return false;
    if ((item.tag === "squatting" || item.tag === "kneeling") && used.has("carrying")) return false;
    if (item.tag === "on back" && (used.has("against wall") || used.has("against window") || used.has("against glass"))) {
      return false;
    }
    if (
      (item.tag === "against wall" || item.tag === "against window" || item.tag === "against glass") &&
      used.has("on back")
    ) {
      return false;
    }
    if (item.tag === "hard hat" && used.has("helmet")) return false;
    if (item.tag === "helmet" && used.has("hard hat")) return false;
    if (item.tag === "panties aside" && used.has("masturbation through clothes")) return false;
    if (item.tag === "masturbation through clothes" && used.has("panties aside")) return false;
    if (item.tag === "leaning back" && used.has("breasts on glass")) return false;
    if (item.tag === "breasts on glass" && used.has("leaning back")) return false;
    if (MOVE_ACT.has(item.tag) && used.has("ojou-sama pose")) return false;
    if (item.tag === "ojou-sama pose" && hasUsed((t) => MOVE_ACT.has(t))) return false;
    if (MOVE_ACT.has(item.tag) && used.has("spread legs")) return false;
    if (item.tag === "spread legs" && hasUsed((t) => MOVE_ACT.has(t))) return false;
    if (item.tag === "hat" && hasUsed((t) => FACELESS_CAM.has(t))) return false;
    if (
      (item.tag === "necktie" || item.tag === "bowtie") &&
      hasUsed((t) => WATER_ACT.has(t) && t !== "fishing")
    ) {
      return false;
    }
    if (
      WATER_ACT.has(item.tag) &&
      item.tag !== "fishing" &&
      (used.has("necktie") ||
        used.has("bowtie") ||
        used.has("boots") ||
        used.has("sneakers") ||
        used.has("high heels"))
    ) {
      return false;
    }
    if (
      (item.tag === "boots" || item.tag === "sneakers") &&
      hasUsed((t) => WATER_ACT.has(t) && t !== "fishing")
    ) {
      return false;
    }
    if (item.tag === "on stomach" && (used.has("against window") || used.has("against glass") || used.has("against wall"))) {
      return false;
    }
    if (
      (item.tag === "against window" || item.tag === "against glass" || item.tag === "against wall") &&
      used.has("on stomach")
    ) {
      return false;
    }
    if (item.tag === "carrying" && used.has("sitting on lap")) return false;
    if (item.tag === "sitting on lap" && used.has("carrying")) return false;
    if (item.tag === "singing" && used.has("on stomach")) return false;
    if (item.tag === "on stomach" && used.has("singing")) return false;
    if (item.tag === "amazon position" && used.has("all fours")) return false;
    if (item.tag === "all fours" && used.has("amazon position")) return false;
    if (item.tag === "hanging breasts" && used.has("sleeping")) return false;
    if (item.tag === "sleeping" && used.has("hanging breasts")) return false;
    if (item.tag === "hanging breasts" && used.has("flat chest")) return false;
    if (item.tag === "flat chest" && used.has("hanging breasts")) return false;
    if (item.tag === "dancing" && hasUsed((t) => HANDS_BUSY_ACT.has(t))) return false;
    if (HANDS_BUSY_ACT.has(item.tag) && used.has("dancing")) return false;
    if (
      (item.tag === "masturbation" || item.tag === "female masturbation" || item.tag === "male masturbation") &&
      hasUsed((t) => HANDS_BUSY_ACT.has(t))
    ) {
      return false;
    }
    if (
      HANDS_BUSY_ACT.has(item.tag) &&
      (used.has("masturbation") || used.has("female masturbation") || used.has("male masturbation"))
    ) {
      return false;
    }
    if (
      (item.tag === "riding bicycle" || item.tag === "driving") &&
      [...usedPlaces(used, lex)].some((p) => INDOOR_ROOM.has(p) && p !== "car interior")
    ) {
      return false;
    }
    if (
      (item.mutex === "place" || item.group === "place") &&
      INDOOR_ROOM.has(item.tag) &&
      item.tag !== "car interior" &&
      (used.has("riding bicycle") || used.has("driving")) &&
      !pinned.has(item.tag)
    ) {
      return false;
    }
    if (item.tag === "diving" && used.has("washing hair")) return false;
    if (item.tag === "washing hair" && used.has("diving")) return false;
    if (item.tag === "singing" && used.has("all fours")) return false;
    if (item.tag === "all fours" && used.has("singing")) return false;
    if (item.tag === "school uniform" && used.has("gym uniform")) return false;
    if (item.tag === "gym uniform" && used.has("school uniform")) return false;
    if (item.tag === "school uniform" && used.has("cheerleader")) return false;
    if (item.tag === "cheerleader" && used.has("school uniform")) return false;
    if (item.tag === "lying" && (used.has("against window") || used.has("against glass") || used.has("against wall"))) {
      return false;
    }
    if (
      (item.tag === "against window" || item.tag === "against glass" || item.tag === "against wall") &&
      used.has("lying")
    ) {
      return false;
    }
    if (item.tag === "eating" && used.has("on back")) return false;
    if (item.tag === "on back" && used.has("eating")) return false;
    if (item.tag === "closed eyes" && used.has("reading")) return false;
    if (item.tag === "reading" && used.has("closed eyes")) return false;
    if (MOVE_ACT.has(item.tag) && used.has("hand on own crotch")) return false;
    if (item.tag === "hand on own crotch" && hasUsed((t) => MOVE_ACT.has(t))) return false;
    if (item.tag === "sweater pull" && hasUsed((t) => HANDS_BUSY_ACT.has(t))) return false;
    if (HANDS_BUSY_ACT.has(item.tag) && used.has("sweater pull")) return false;
    if (item.tag === "masturbation through clothes" && hasUsed((t) => MOVE_ACT.has(t))) return false;
    if (MOVE_ACT.has(item.tag) && used.has("masturbation through clothes")) return false;
    if (
      ((WATER_ACT.has(item.tag) && item.tag !== "fishing") || used.has("pool") || used.has("ocean")) &&
      item.tag === "high heels"
    ) {
      return false;
    }
    if (item.tag === "high heels" && hasUsed((t) => WATER_ACT.has(t) && t !== "fishing")) return false;
    if (item.tag === "showering" && hasUsed((t) => LIE_BODY.has(t))) return false;
    if (LIE_BODY.has(item.tag) && used.has("showering")) return false;
    if (item.tag === "riding bicycle" && used.has("on chair")) return false;
    if (item.tag === "on chair" && used.has("riding bicycle")) return false;
    if (item.tag === "candlelight" && (used.has("underwater") || used.has("swimming") || used.has("diving"))) return false;
    if ((item.tag === "underwater" || item.tag === "swimming" || item.tag === "diving") && used.has("candlelight")) {
      return false;
    }
    // 同理的反向：靠窗／靠玻璃先進場，outdoors 就不能再從暗示鏈補進來。
    if (
      item.tag === "outdoors" &&
      !used.has("indoors") &&
      (used.has("against window") || used.has("against glass"))
    ) {
      return false;
    }
    if ((item.tag === "against window" || item.tag === "against glass") && used.has("outdoors") && !used.has("indoors")) {
      return false;
    }
    if (item.tag === "restrained" && (used.has("fingering") || used.has("female masturbation") || used.has("masturbation"))) {
      return false;
    }
    if ((item.tag === "fingering" || item.tag === "female masturbation" || item.tag === "masturbation") && used.has("restrained")) {
      return false;
    }
    if (item.tag === "come hither" && hasUsed((t) => HANDS_BUSY_ACT.has(t))) return false;
    if (HANDS_BUSY_ACT.has(item.tag) && used.has("come hither")) return false;
    if (item.tag === "breasts on table" && used.has("leaning back")) return false;
    if (item.tag === "leaning back" && used.has("breasts on table")) return false;
    if (
      (item.tag === "breasts on table" || item.tag === "breasts on glass") &&
      used.has("outdoors") &&
      !used.has("indoors")
    ) {
      return false;
    }
    if (
      item.tag === "outdoors" &&
      (used.has("breasts on table") || used.has("breasts on glass")) &&
      !used.has("indoors")
    ) {
      return false;
    }
    if (
      (used.has("breasts on table") || used.has("breasts on glass")) &&
      (item.implies || []).includes("outdoors")
    ) {
      return false;
    }
    if (
      (item.tag === "breasts on table" || item.tag === "breasts on glass") &&
      hasUsed((t) => (lex.byTag.get(t)?.implies || []).includes("outdoors"))
    ) {
      return false;
    }
    if (item.tag === "breasts on table" || item.tag === "breasts on glass") {
      const listed = [...usedJobs(used, lex)].filter((j) => JOB_PLACE[j]);
      if (listed.length > 0 && listed.every((j) => jobHasOnlyOutdoorPlaces(j, era, lex))) return false;
    }
    if (item.tag === "hand in panties" && hasUsed((t) => MOVE_ACT.has(t))) return false;
    if (MOVE_ACT.has(item.tag) && used.has("hand in panties")) return false;
    if (
      item.tag === "floating" &&
      (used.has("leaning forward") || used.has("leaning back") || used.has("contrapposto") || used.has("crossed legs"))
    ) {
      return false;
    }
    if (
      (item.tag === "leaning forward" ||
        item.tag === "leaning back" ||
        item.tag === "contrapposto" ||
        item.tag === "crossed legs") &&
      used.has("floating")
    ) {
      return false;
    }
    if (BOTH_ARMS.has(item.tag) && hasUsed((t) => MOVE_ACT.has(t))) return false;
    if (MOVE_ACT.has(item.tag) && hasUsed((t) => BOTH_ARMS.has(t))) return false;
    if (item.tag === "amazon position" && (used.has("crawling") || used.has("seiza") || used.has("wariza"))) return false;
    if ((item.tag === "crawling" || item.tag === "seiza" || item.tag === "wariza") && used.has("amazon position")) {
      return false;
    }
    if (item.tag === "crossed legs" && (used.has("horseback riding") || hasUsed((t) => MOVE_ACT.has(t)))) {
      return false;
    }
    if ((item.tag === "horseback riding" || MOVE_ACT.has(item.tag)) && used.has("crossed legs")) return false;
    {
      const plantedTease = (t) =>
        t === "against window" ||
        t === "against glass" ||
        t === "against wall" ||
        t === "contrapposto" ||
        t === "leaning back" ||
        t === "leaning forward" ||
        t === "arched back";
      if (plantedTease(item.tag) && hasUsed((t) => MOVE_ACT.has(t))) return false;
      if (MOVE_ACT.has(item.tag) && hasUsed(plantedTease)) return false;
    }
    if (
      item.tag === "bunk bed" &&
      // kids room 不在詞庫裡，Danbooru 上也是 0 張 —— 懸空的條件，拿掉。
      !hasUsed((t) => t === "bedroom" || t === "hotel room")
    ) {
      return false;
    }
    {
      const shortHair = (t) =>
        t === "pixie cut" || t === "short hair" || t === "very short hair" || t === "bob cut";
      const longStyle = (t) =>
        t === "twintails" ||
        t === "high ponytail" ||
        t === "ponytail" ||
        t === "side ponytail" ||
        t === "drill hair" ||
        t === "twin braids" ||
        t === "braid" ||
        t === "hime cut" ||
        t === "hair over shoulder" ||
        t === "hair bun" ||
        t === "single hair bun" ||
        t === "double bun" ||
        t === "low ponytail" ||
        t === "braided ponytail" ||
        t === "folded ponytail";
      if (shortHair(item.tag) && hasUsed(longStyle)) return false;
      if (longStyle(item.tag) && hasUsed(shortHair)) return false;
    }
    if (item.tag === "legs up" && used.has("driving")) return false;
    if (item.tag === "driving" && used.has("legs up")) return false;
    {
      const waterPlantAct = (t) => t === "swimming" || t === "diving";
      const waterPlantBody = (t) =>
        t === "standing" ||
        t === "squatting" ||
        t === "kneeling" ||
        t === "on one knee" ||
        t === "standing sex" ||
        t === "contrapposto";
      if (waterPlantBody(item.tag) && hasUsed(waterPlantAct)) return false;
      if (waterPlantAct(item.tag) && hasUsed(waterPlantBody)) return false;
    }
    if (item.mutex === "held_prop") {
      const acts = usedActs(used, lex);
      // 電話、智慧型手機、布偶、自拍棒不是拍照清單裡的道具。不豁免就永遠抽不到。
      // 它們仍佔手持格。手機不在這組：只有拍照、直播、講電話才進。
      // 智慧型手機帶出來的手機是 implies，手持物的依賴不走這道閘。
      if (
        item.tag !== "phone" &&
        item.tag !== "smartphone" &&
        item.tag !== "stuffed toy" &&
        item.tag !== "teddy bear" &&
        item.tag !== "selfie stick" &&
        ![...acts].some((a) => (ACT_PROP[a] || []).includes(item.tag))
      ) return false;
    }
    // 這兩個是 env prop，而且 mustDraw 跑在一般場景 fill 之前。只靠最後的
    // NEEDS_CONTEXT cleanup 不夠：mustDraw 會把抽中的字鎖住，錯場也不能刪。
    // 因此在已釘／已選的水域情境不存在時，候選階段就不讓它們進池。
    if (
      (item.tag === "beach umbrella" || item.tag === "innertube") &&
      !hasUsed((t) => NEEDS_CONTEXT[item.tag].has(t))
    ) {
      return false;
    }
    if (item.tag === "stethoscope" && !hasUsed((t) => t === "nurse" || t === "doctor" || t === "clinic" || t === "hospital")) {
      return false;
    }
    if (item.tag === "hard hat" && !hasUsed((t) => t === "construction worker" || t === "construction site")) {
      return false;
    }
    if (item.tag === "lab coat" && !hasUsed((t) => t === "scientist" || t === "laboratory" || t === "doctor")) {
      return false;
    }
    // 整套制服已經自帶外衣，不要再疊第二件。使用者明確釘的不受影響。
    if (item.group === "outer" && !pinned.has(item.tag)) {
      for (const t of used) {
        if (OUTFIT_HAS_OUTER.has(t)) return false;
      }
    }
    // 整套的時代服裝底下，不要塞別的時代的上下身衣服。
    // 同時代的照樣可以（和服配袴），所以比的是時代不是「有沒有穿」。
    if (!pinned.has(item.tag)) {
      // 外衣也算：和服該配羽織，不是配現代夾克（羽織是 edo，所以照樣過得去）。
      const slot = bodyGarmentSlot(item) || (item.group === "outer" ? "outer" : null);
      if (slot === "top" || slot === "bottom" || slot === "outer") {
        for (const t of used) {
          const era0 = ERA_OUTFIT_ERA.get(t);
          if (!era0) continue;
          const eras = item.era || [];
          // era:["any"] 是「每個時代都能用」，不是「哪個時代都不屬於」。
          // 少了這一句，topless female / topless male / bottomless（都是 any）
          // 會在和服、漢服、托加在場時被擋掉 —— 但「和服褪到腰間」是正常的畫法，
          // 那三個字講的是身體狀態，本來就跟時代無關。
          if (eras.includes("any")) continue;
          if (!eras.includes(era0)) return false;
        }
      }
    }
    if (item.tag === "police hat" && !used.has("policewoman") && !used.has("police uniform")) return false;
    if (item.tag === "nurse cap" && !used.has("nurse")) return false;
    if (item.tag === "tsurime" && used.has("tareme")) return false;
    if (item.tag === "tareme" && used.has("tsurime")) return false;
    if (
      item.tag === "closed eyes" &&
      (used.has("playing video games") ||
        used.has("playing games") ||
        used.has("painting (action)") ||
        used.has("writing") ||
        used.has("drawing (action)") ||
        used.has("studying"))
    ) {
      return false;
    }
    if (
      (item.tag === "playing video games" ||
        item.tag === "playing games" ||
        item.tag === "painting (action)" ||
        item.tag === "writing" ||
        item.tag === "drawing (action)" ||
        item.tag === "studying") &&
      used.has("closed eyes")
    ) {
      return false;
    }
    // 場地在 fillSlot("env","place") 就定了，排在天氣那一格前面，所以這條問得到答案，
    // 放 allow() 是對的（而不是事後刪除）—— 這樣天氣那一格也不會把名額浪費在
    // 一個注定要被刪掉的 steam 上。
    if (item.tag === "steam" && !hasUsed((t) => STEAM_CTX.has(t))) return false;
    // 時代符號最多三個。以前這件事是靠 env 配額小而「隱性」成立的 —— 配額從 4 放到
    // 6 之後，中世紀 300 張裡有 28 張塞了四個以上（城堡＋火把＋掛毯＋旗幟…），
    // 整張圖變成年代符號展示。既有測試「不會塞一整排時代字」抓到的就是這個。
    //
    // **現代不套這條。** 在現代，「時代專屬」等於「現代的東西」：283 個 env 裡有 120 個
    // 掛著 era:["modern"]，而中性的只有 70 個。枕頭和鏡子不是年代符號，拿同一把尺去量
    // 等於把現代的道具整批壓回三個，剛剛放寬的配額又被自己收回去 —— 實測就是這樣，
    // 高爾夫球桿、籃球那批運動器材又變回抽不到。
    // 那條既有測試自己也只跑中世紀，註解還寫著「現代不該被硬塞（它本來就有一堆專屬場地）」。
    if (item.section === "env" && era !== "modern" && eraSpecific(item, era)) {
      let n = 0;
      for (const t of used) {
        const it = lex.byTag.get(t);
        if (it && it.section === "env" && eraSpecific(it, era)) n += 1;
      }
      if (n >= 3) return false;
    }
    if (OUTDOOR_WEATHER.has(item.tag) && used.has("indoors") && !used.has("outdoors")) return false;
    // 反向。雪／櫻花在 OUTDOOR_LEFTOVER 裡，釘了不會進室內；雨／霧／陰天不在，
    // 也不 implies outdoors。釘雨時場地還沒填，客廳照收（實測 20～27/40 indoors）。
    if (
      usedHas(used, "_wx", (t) => OUTDOOR_WEATHER.has(t)) &&
      !used.has("outdoors") &&
      (item.tag === "indoors" ||
        (item.implies || []).includes("indoors") ||
        INDOOR_ROOM.has(item.tag))
    ) {
      return false;
    }
    if (item.tag === "wading" && (used.has("legs up") || used.has("m legs"))) return false;
    if ((item.tag === "legs up" || item.tag === "m legs") && used.has("wading")) return false;
    if (
      (item.tag === "swimming" || item.tag === "diving") &&
      (used.has("legs up") || used.has("m legs") || used.has("leg lift") || used.has("on chair"))
    ) {
      return false;
    }
    if (
      (item.tag === "legs up" ||
        item.tag === "m legs" ||
        item.tag === "leg lift" ||
        item.tag === "on chair") &&
      (used.has("swimming") || used.has("diving"))
    ) {
      return false;
    }
    if (item.tag === "footjob" && used.has("feet out of frame")) return false;
    if (item.tag === "feet out of frame" && used.has("footjob")) return false;
    if (item.tag === "footjob" && used.has("upper body")) return false;
    if (item.tag === "upper body" && used.has("footjob")) return false;
    if (item.tag === "pussy focus" && used.has("upper body")) return false;
    if (item.tag === "upper body" && used.has("pussy focus")) return false;
    if (item.tag === "wading" && used.has("on chair")) return false;
    if (item.tag === "on chair" && used.has("wading")) return false;
    if (item.tag === "sitting on face" && used.has("on chair")) return false;
    if (item.tag === "on chair" && used.has("sitting on face")) return false;
    if (item.tag === "bald" && used.has("wet hair")) return false;
    if (item.tag === "wet hair" && used.has("bald")) return false;
    if (item.tag === "cooking" && used.has("squatting")) return false;
    if (item.tag === "squatting" && used.has("cooking")) return false;
    if (item.tag === "cleaning" && used.has("sitting")) return false;
    if (item.tag === "sitting" && used.has("cleaning")) return false;
    if (item.tag === "hanging breasts" && used.has("leaning back")) return false;
    if (item.tag === "leaning back" && used.has("hanging breasts")) return false;
    if (item.tag === "selfie" && hasUsed((t) => BOTH_ARMS.has(t))) return false;
    if (BOTH_ARMS.has(item.tag) && used.has("selfie")) return false;
    if (item.tag === "lipstick" && hasUsed((t) => FACELESS_CAM.has(t))) return false;
    if (item.tag === "sunbathing" && used.has("rain")) return false;
    if (item.tag === "rain" && used.has("sunbathing")) return false;
    if (item.tag === "facing away" && (used.has("one eye closed") || used.has("selfie") || used.has("looking at viewer"))) return false;
    if ((item.tag === "one eye closed" || item.tag === "selfie" || item.tag === "looking at viewer") && used.has("facing away")) {
      return false;
    }
    if (item.tag === "breasts squeezed together" && used.has("breasts apart")) return false;
    if (item.tag === "breasts apart" && used.has("breasts squeezed together")) return false;
    if (item.tag === "horseback riding" && used.has("m legs")) return false;
    if (item.tag === "m legs" && used.has("horseback riding")) return false;
    if (item.tag === "cooking" && used.has("kneeling")) return false;
    if (item.tag === "kneeling" && used.has("cooking")) return false;
    if (item.tag === "cooking" && used.has("on one knee")) return false;
    if (item.tag === "on one knee" && used.has("cooking")) return false;
    if (item.tag === "closed eyes" && (used.has("taking picture") || used.has("selfie"))) return false;
    if ((item.tag === "taking picture" || item.tag === "selfie") && used.has("closed eyes")) return false;
    if (item.tag === "amazon position" && used.has("standing")) return false;
    if (item.tag === "standing" && used.has("amazon position")) return false;
    if (MOVE_ACT.has(item.tag) && (used.has("legs up") || used.has("leg lift"))) return false;
    if ((item.tag === "legs up" || item.tag === "leg lift") && hasUsed((t) => MOVE_ACT.has(t))) return false;
    if (item.tag === "horseback riding" && used.has("on one knee")) return false;
    if (item.tag === "on one knee" && used.has("horseback riding")) return false;
    if (item.tag === "singing" && used.has("paizuri gesture")) return false;
    if (item.tag === "paizuri gesture" && used.has("singing")) return false;
    if (item.tag === "skiing" && used.has("looking at mirror")) return false;
    if (item.tag === "looking at mirror" && used.has("skiing")) return false;
    if (item.tag === "breasts on table" && (used.has("bathtub") || used.has("beach") || used.has("ocean") || used.has("pool"))) {
      return false;
    }
    if (
      item.tag === "driving" &&
      (used.has("breasts on table") ||
        used.has("breasts on glass") ||
        used.has("against wall") ||
        used.has("against window") ||
        used.has("against glass"))
    ) {
      return false;
    }
    if (
      (item.tag === "breasts on table" ||
        item.tag === "breasts on glass" ||
        item.tag === "against wall" ||
        item.tag === "against window" ||
        item.tag === "against glass") &&
      used.has("driving")
    ) {
      return false;
    }
    if (item.tag === "carrying" && used.has("sitting")) return false;
    if (item.tag === "sitting" && used.has("carrying")) return false;
    if (item.tag === "indian style" && used.has("amazon position")) return false;
    if (item.tag === "amazon position" && used.has("indian style")) return false;
    if (
      (item.tag === "breasts on table" || item.tag === "breasts on glass") &&
      (hasUsed((t) => MOVE_ACT.has(t)) || used.has("horseback riding"))
    ) {
      return false;
    }
    if (
      (MOVE_ACT.has(item.tag) || item.tag === "horseback riding") &&
      (used.has("breasts on table") || used.has("breasts on glass"))
    ) {
      return false;
    }
    if ((item.tag === "yoga" || item.tag === "stretching") && hasUsed((t) => STILL_BODY.has(t))) return false;
    if (STILL_BODY.has(item.tag) && (used.has("yoga") || used.has("stretching"))) return false;
    if (item.mutex === "sex_act" || item.group === "sex") {
      const acts = usedActs(used, lex);
      if ([...acts].some((a) => MOVE_ACT.has(a) && !SEX_OK_ACTIVITY.has(a))) return false;
    }
    if (MOVE_ACT.has(item.tag) && !SEX_OK_ACTIVITY.has(item.tag)) {
      if (hasUsed((t) => lex.byTag.get(t)?.mutex === "sex_act" || lex.byTag.get(t)?.group === "sex")) {
        return false;
      }
    }
    if (
      (used.has("closed eyes") || used.has("covering own eyes")) &&
      (item.tag === "glowing eyes" || item.tag === "glowing eye" || item.tag === "dilated pupils")
    ) return false;
    if (
      (item.tag === "closed eyes" || item.tag === "covering own eyes") &&
      (used.has("glowing eyes") || used.has("glowing eye") || used.has("dilated pupils"))
    ) return false;
    if (
      item.tag === "after bathing" &&
      hasUsed(
        (t) =>
          BATH_ACT.has(t) ||
          (WATER_ACT.has(t) && t !== "fishing") ||
          t === "washing hair" ||
          t === "splashing" ||
          t === "partially submerged"
      )
    ) {
      return false;
    }
    if (
      used.has("after bathing") &&
      (BATH_ACT.has(item.tag) ||
        (WATER_ACT.has(item.tag) && item.tag !== "fishing") ||
        item.tag === "washing hair" ||
        item.tag === "splashing" ||
        item.tag === "partially submerged")
    ) {
      return false;
    }
    if (
      item.tag === "overcast" &&
      (used.has("blue sky") || used.has("starry sky") || used.has("orange sky") || used.has("sunlight"))
    ) {
      return false;
    }
    if (
      (item.tag === "blue sky" || item.tag === "starry sky" || item.tag === "orange sky" || item.tag === "sunlight") &&
      used.has("overcast")
    ) {
      return false;
    }
    if (item.tag === "rain" && used.has("starry sky")) return false;
    // 落葉要有樹：室內不會飄葉子。兩個方向都擋 —— 室內場地是靠 implies 帶 indoors 進來的，
    // commit() 會拿這條去驗那個 indoors，所以落葉先在場時，臥室、教室整個抽不進來。
    // （詞庫那邊不讓非場地的環境字帶 indoors／outdoors，見 merge_lexicon.apply_relations。）
    if (item.tag === "falling leaves" && used.has("indoors")) return false;
    // no humans 是另一種抽法，scenery／solo focus 是收尾才補的字，不進隨機池。
    // people（路人）跟 crowd 同一件事，以前寫在這行就變成永遠抽不到。
    if (item.tag === NO_HUMANS || item.tag === "scenery" || item.tag === "solo focus") return false;
    if (item.tag === "people" && used.has("crowd")) return false;
    if (item.tag === "crowd" && used.has("people")) return false;
    // 人群不在自己家裡：已經在臥室、浴室、客廳…就不抽人群。
    // 反方向只擋「釘的」人群：隨機抽到的人群不能把情境要的場地擋掉（做菜一定在廚房、性愛要私密場地）——
    // 那種時候讓人群讓出來，最後整理時拿掉（見下面組 POS 那段）。
    if (CROWD_TAGS.has(item.tag) && hasUsed((t) => CROWD_BAD_PLACE.has(t))) return false;
    if (CROWD_BAD_PLACE.has(item.tag) && [...CROWD_TAGS].some((c) => used.has(c) && pinned.has(c))) return false;
    if (item.tag === "indoors" && used.has("falling leaves")) return false;
    if (item.tag === "starry sky" && used.has("rain")) return false;
    if (item.tag === "lower body" && hasUsed((t) => CHEST_NEED_TAGS.has(t))) return false;
    if (CHEST_NEED_TAGS.has(item.tag) && used.has("lower body")) return false;
    if (
      used.has("expressionless") &&
      (item.tag === "one eye closed" || EYE_EXTRA.has(item.tag) || item.tag === "clenched teeth" || item.tag === "fucked silly")
    ) {
      return false;
    }
    if (
      item.tag === "expressionless" &&
      (used.has("one eye closed") ||
        used.has("clenched teeth") ||
        used.has("fucked silly") ||
        hasUsed((t) => EYE_EXTRA.has(t)))
    ) {
      return false;
    }
    if (
      used.has("expressionless") &&
      (item.tag === "licking lips" || item.tag === "tongue out" || item.tag === "biting own lip")
    ) {
      return false;
    }
    if (
      item.tag === "expressionless" &&
      (used.has("licking lips") || used.has("tongue out") || used.has("biting own lip"))
    ) {
      return false;
    }
    if (
      used.has("closed eyes") &&
      (item.tag === "reading" ||
        item.tag === "studying" ||
        item.tag === "taking picture" ||
        item.tag === "writing" ||
        item.tag === "drawing (action)" ||
        item.tag === "playing games" ||
        item.tag === "playing video games" ||
        item.tag === "painting (action)")
    ) {
      return false;
    }
    if (
      (item.tag === "reading" ||
        item.tag === "studying" ||
        item.tag === "taking picture" ||
        item.tag === "writing" ||
        item.tag === "drawing (action)" ||
        item.tag === "playing games" ||
        item.tag === "playing video games" ||
        item.tag === "painting (action)") &&
      used.has("closed eyes")
    ) {
      return false;
    }
    if (item.tag === "clenched teeth" || item.tag === "biting own lip" || item.tag === "licking lips") {
      const acts = usedActs(used, lex);
      if (
        acts.has("eating") ||
        acts.has("singing") ||
        acts.has("karaoke") ||
        acts.has("drinking") ||
        acts.has("talking on phone") ||
        acts.has("smoking")
      ) {
        return false;
      }
    }
    if (
      (item.tag === "eating" ||
        item.tag === "singing" ||
        item.tag === "karaoke" ||
        item.tag === "drinking" ||
        item.tag === "talking on phone" ||
        item.tag === "smoking") &&
      (used.has("clenched teeth") || used.has("biting own lip") || used.has("licking lips"))
    ) {
      return false;
    }
    {
      const handsBusy = usedHas(used, "_hands", (t) => HANDS_BUSY_ACT.has(t) || HANDS_BUSY_BODY.has(t));
      if (ARM_POSE.has(item.tag) && !pinned.has(item.tag) && handsBusy) return false;
      if (BOTH_ARMS.has(item.tag) && !pinned.has(item.tag) && handsBusy) return false;
      if (HANDS_BUSY_ACT.has(item.tag) && hasUsed((t) => BOTH_ARMS.has(t))) return false;
      if (ARM_POSE.has(item.tag) && hasUsed((t) => BOTH_ARMS.has(t)) && !BOTH_ARMS.has(item.tag)) return false;
      if (BOTH_ARMS.has(item.tag) && hasUsed((t) => ARM_POSE.has(t) && !BOTH_ARMS.has(t))) return false;
      if (HAND_GESTURE.has(item.tag) && !pinned.has(item.tag) && handsBusy) return false;
      if (HANDS_BUSY_ACT.has(item.tag) && hasUsed((t) => ARM_POSE.has(t))) return false;
      if (HANDS_BUSY_ACT.has(item.tag) && hasUsed((t) => HAND_GESTURE.has(t))) return false;
      if (item.section === "clothing") {
        // 「只穿一件」：兩個方向都要擋，因為服裝那一段的填入順序不固定。
        if (NAKED_ONLY.has(item.tag)) {
          for (const t of used) {
            const it = lex.byTag.get(t);
            if (it && it.section === "clothing" && BODY_WORN_GROUP.has(it.group)) return false;
          }
        } else if (BODY_WORN_GROUP.has(item.group)) {
          if (hasUsed((t) => NAKED_ONLY.has(t))) return false;
        }
        // 只穿內衣：外套、上衣、下身、整套、時代服裝與袖子描述都不能並存。
        if (item.tag === "underwear only") {
          for (const t of used) {
            if (underwearOnlyClash(lex.byTag.get(t))) return false;
          }
        } else if (used.has("underwear only") && underwearOnlyClash(item)) {
          return false;
        }
        // 泳衣與內衣二選一。
        if (isSwimGarment(item)) {
          for (const t of used) {
            if (lex.byTag.get(t)?.group === "underwear") return false;
          }
        } else if (item.group === "underwear") {
          if (hasUsed((t) => isSwimGarment(lex.byTag.get(t)))) return false;
        }
      }
      // 傢俱：室內才有，而且人得在上面 —— 站著的人不會「在沙發上」。
      // 這一格從 pose 搬到 env 之後就漏掉了姿勢相容檢查，而通用的 fill("env")
      // 也不管室內外（基準線裡 24 張有傢俱的圖，8 張是室外、4 張配站姿）。
      if (item.mutex === "furniture") {
        if (used.has("outdoors")) return false;
        if (hasUsed((t) => UPRIGHT_BODY.has(t))) return false;
      }
      // 釘沙發／床時姿勢還沒填。standing → 傢俱已擋，反向沒擋，實測釘沙發
      // 6/40 張站著。on chair 另有雙向規則。on desk 站著合理，不擋。
      if (
        UPRIGHT_BODY.has(item.tag) &&
        (used.has("on bed") || used.has("on couch") || used.has("bunk bed") || used.has("under table") || used.has("futon"))
      ) {
        return false;
      }
      // 被褥跟 on bed 一樣擋直立。它不在 furniture 那一格，反向要自己寫。
      if (item.tag === "futon" && hasUsed((t) => UPRIGHT_BODY.has(t))) return false;
      // 詞庫沒有「衣櫃」。試衣間、更衣室是現有的小室內。床上已經由上面的直立規則擋住。
      // 性愛那一檔不抽走路、跑步、跳躍、站立劈腿：這些佔走身體格，會把體位擠掉。
      // 踮腳留著，它是站著的一種。
      if (
        (item.tag === "walking" || item.tag === "walking away" || item.tag === "running" || item.tag === "jumping" || item.tag === "standing split") &&
        heat === "sex" &&
        !pinned.has(item.tag)
      ) {
        return false;
      }
      // 站立劈腿的權重降到 1:300 之後，誘惑仍有大約 2%。那些圖裡它是當下唯一合法的身體姿勢，
      // 權重不會把它讓給別人。再按種子擋掉三成，誘惑才會落到 1% 左右。釘選不走這裡。
      if (
        item.tag === "standing split" &&
        !pinned.has(item.tag) &&
        ((Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x45d9f3b) >>> 16) % 100) >= 70
      ) {
        return false;
      }
      if ((item.tag === "running" || item.tag === "jumping") && !pinned.has(item.tag) && hasUsed((t) => NO_SPRINT_PLACE.has(t))) {
        return false;
      }
      if (NO_SPRINT_PLACE.has(item.tag) && !pinned.has(item.tag) && hasUsed((t) => t === "running" || t === "jumping")) {
        return false;
      }
      // 單腿抬起可以疊在站、躺、體位上，不跟跑步、跳躍同時成立。
      if (item.tag === "leg up" && !pinned.has(item.tag) && hasUsed((t) => t === "running" || t === "jumping")) {
        return false;
      }
      if ((item.tag === "running" || item.tag === "jumping") && !pinned.has(item.tag) && used.has("leg up")) {
        return false;
      }
      // 騎腳踏車是坐著。走路、跑步、跳躍讓出來。坐著騎留著。
      if (BIKE_BLOCK_BODY.has(item.tag) && !pinned.has(item.tag) && used.has("riding bicycle")) return false;
      if (item.tag === "riding bicycle" && !pinned.has(item.tag) && hasUsed((t) => BIKE_BLOCK_BODY.has(t))) return false;
      // 跳水時人不在跑、不在走、也不做站立劈腿。
      if (DIVE_BLOCK_BODY.has(item.tag) && !pinned.has(item.tag) && used.has("diving")) return false;
      if (item.tag === "diving" && !pinned.has(item.tag) && hasUsed((t) => DIVE_BLOCK_BODY.has(t))) return false;
      // 漂浮不跟走路、跑步同時成立。水裡站著留著。
      if (FLOAT_BLOCK_BODY.has(item.tag) && !pinned.has(item.tag) && used.has("floating")) return false;
      if (item.tag === "floating" && !pinned.has(item.tag) && hasUsed((t) => FLOAT_BLOCK_BODY.has(t))) return false;
      // 全身動作不配肖像、上半身、特寫、臉、頭出鏡。站著本身不在這份清單。
      if (FULL_SHOT_BODY.has(item.tag) && !pinned.has(item.tag) && hasUsed((t) => HALF_SHOT.has(t))) return false;
      if (HALF_SHOT.has(item.tag) && !pinned.has(item.tag) && hasUsed((t) => FULL_SHOT_BODY.has(t))) return false;
      // 雪不跟泳衣、比基尼疊。學校泳衣的名字裡有 swimsuit，走同一條。
      if (isSwimGarment(item) && !pinned.has(item.tag) && used.has("snow")) return false;
      if (item.tag === "snow" && !pinned.has(item.tag) && hasUsed((t) => isSwimGarment(lex.byTag.get(t)))) return false;
      if (HANDS_BUSY_BODY.has(item.tag) && hasUsed((t) => ARM_POSE.has(t))) return false;
      if (HANDS_BUSY_ACT.has(item.tag) && hasUsed((t) => HANDS_BUSY_BODY.has(t))) return false;
      if (HANDS_BUSY_ACT.has(item.tag) && hasUsed((t) => HANDS_BUSY_ACT.has(t))) return false;
      if (HANDS_BUSY_BODY.has(item.tag) && [...usedActs(used, lex)].some((a) => HANDS_BUSY_ACT.has(a))) return false;
      if (HAND_GESTURE.has(item.tag) && hasUsed((t) => BOTH_ARMS.has(t) || HANDS_BUSY_BODY.has(t))) return false;
      {
        if (BOOK_ACT.has(item.tag) && hasUsed((t) => BOTH_ARMS.has(t) || HAND_GESTURE.has(t))) return false;
        if ((BOTH_ARMS.has(item.tag) || HAND_GESTURE.has(item.tag)) && hasUsed((t) => BOOK_ACT.has(t))) {
          return false;
        }
      }
      if (
        (BOTH_ARMS.has(item.tag) || HANDS_BUSY_BODY.has(item.tag)) &&
        hasUsed((t) => HAND_GESTURE.has(t))
      ) {
        return false;
      }
    }
    {
      const places = usedPlaces(used, lex);
      const acts = usedActs(used, lex);
      if (WATER_ACT.has(item.tag) && [...places].some((p) => DRY_NO_WATER.has(p))) return false;
      if (DRY_NO_WATER.has(item.tag) && [...acts].some((a) => WATER_ACT.has(a)) && !pinned.has(item.tag)) {
        return false;
      }
      if (item.tag === "horseback riding" && [...places].some((p) => DRY_NO_WATER.has(p) || p === "movie theater")) {
        return false;
      }
      if (
        (item.mutex === "place" || item.group === "place") &&
        (DRY_NO_WATER.has(item.tag) || item.tag === "movie theater") &&
        used.has("horseback riding") &&
        !pinned.has(item.tag)
      ) {
        return false;
      }
    }
    if (lockOn) {
      if (!sportKitOk(item, used)) return false;
      if (!sportPlaceOk(item, used)) {
        // 網球場、高爾夫球場只有現代。歷史時代釘了該運動時，專用場地一個都不在，
        // 這條會把所有場地擋光。退到這個時代還有的運動場，而不是整格空白。
        const placeLike = item.mutex === "place" || item.group === "place";
        const specific = compatibleSportPlaces(sportGearIdsOf(used));
        let inEra = false;
        for (const p of specific) {
          const it = lex.byTag.get(p);
          if (it && eraOk(it, era)) {
            inEra = true;
            break;
          }
        }
        if (!placeLike || inEra || !SPORT_PLACE.has(item.tag)) return false;
      }
      if (!sportGearPlaceOk(item, used, lex)) return false;
      if (
        (item.mutex === "sport_ball" || item.mutex === "sport_prop") &&
        sportIdsOf(used) === null
      ) {
        return false;
      }
    }
    if (real) {
      if (item.tag === "rape" && hasUsed((t) => RAPE_BAD_PLACE.has(t))) return false;
      if (RAPE_BAD_PLACE.has(item.tag) && used.has("rape")) return false;
      // 做菜在最後的修復步驟一定會要廚房，而廚房在上面那張清單裡。抽 rape 的時候廚房
      // 往往還沒上場，於是 rape 過關、修復時廚房被擋 —— 場地已經刪了，整張圖沒有場地
      // （釘做菜的性愛圖實測 10/600）。所以把「會要廚房的活動」當成廚房本身來擋。
      if (item.tag === "rape" && used.has("cooking")) return false;
      if (item.tag === "cooking" && used.has("rape")) return false;
    }
    if (lockOn) {
      // 辦公室／大街都不在睡覺場地裡。自動抽睡著會讓釘偵探／OL 的場地格空掉。
      // 明確釘睡著仍可自相衝突。清潔工的客廳在清單裡，還是可以睡。
      if (item.tag === "sleeping" && !pinned.has("sleeping")) {
        const listed = [...usedJobs(used, lex)].filter((j) => JOB_PLACE[j]);
        if (listed.length > 0 && listed.every((j) => !jobHasSleepPlace(j, era, lex))) return false;
      }
      if (item.mutex === "activity" && !pinned.has(item.tag)) {
        const indoorFix = hasUsed((t) => INDOOR_PROP.has(t) || INDOOR_FURN.has(t));
        // 以前多一句 !used.has("outdoors")；雨後來 implies outdoors，這條就永遠不成立，
        // 釘雨照樣抽到煮飯、洗澡這種只在室內做的活動，場地格因此空著。
        const outdoorWx = hasUsed((t) => OUTDOOR_WEATHER.has(t));
        if (indoorFix || outdoorWx) {
          if (!ACT_PLACE[item.tag]) return false;
          if (indoorFix && !actHasUsableSide(item.tag, era, lex, used, "in")) return false;
          if (outdoorWx && !actHasUsableSide(item.tag, era, lex, used, "out")) return false;
        }
      }
      const acts = usedActs(used, lex);
      const places = usedPlaces(used, lex);
      if ((item.mutex === "place" || item.group === "place") && !placeFitsActs(item.tag, acts, real)) {
        // 活動清單在這個時代一個場地都對不上時，硬交集會把場地格抽空
        // （歷史時代釘淋浴、網球、卡拉 OK，實測整格是空的）。
        // 洗澡退到浴場，運動退到這個時代還在的運動場，其餘不要留白。
        if (eraHasFittingPlace(acts)) return false;
        const bath = [...acts].some((a) => BATH_ACT.has(a));
        const water = [...acts].some((a) => WATER_ACT.has(a));
        const sport = [...acts].some(
          (a) => SPORT_ACTS.has(a) || a === "playing sports" || a === "exercising" || a === "training"
        );
        if (bath) {
          if (!BATH_PLACE.has(item.tag)) return false;
        } else if (water) {
          if (!WATER_PLACE.has(item.tag) && !BATH_PLACE.has(item.tag)) return false;
        } else if (sport && eraHasSportPlace() && !SPORT_PLACE.has(item.tag)) {
          return false;
        }
      }
      if (item.mutex === "activity" && !actFitsPlaces(item.tag, places, real)) return false;
      if (item.section === "clothing" && isBathScene(used) && isBathBadCloth(item.tag)) return false;
      {
        const kind = sceneClothLocked(used, pinned, lex, era, true);
        if (
          kind &&
          item.section === "clothing" &&
          (item.layer === "garment" || item.layer === "accessory") &&
          !garmentOkForKind(item, kind, era) &&
          !pinned.has(item.tag)
        ) {
          return false;
        }
      }
      if (
        (item.tag === "breasts on table" || item.tag === "breasts on glass") &&
        !pinned.has(item.tag)
      ) {
        // 這兩個構圖會把後續場地限制為室內。若場上的職業／活動只剩戶外交集，
        // 先收下它們會讓 place 池變空（例如 detective + taking picture 只交集 street）。
        // 自動特徵應讓路；使用者明確釘選仍由上面的 pinned 例外保留。
        const jobs = usedJobs(used, lex);
        const acts = usedActs(used, lex);
        const places = usedPlaces(used, lex);
        const currentPlaceWorks =
          places.size > 0 && [...places].some((place) => INDOOR_ROOM.has(place));
        const canStillPickIndoorPlace = lex.bySection.env.some(
          (candidate) =>
            (candidate.mutex === "place" || candidate.group === "place") &&
            INDOOR_ROOM.has(candidate.tag) &&
            !banned.has(candidate.tag) &&
            eraOk(candidate, era) &&
            heatOk(candidate, heat) &&
            gateOk(candidate, female, male) &&
            placeFitsActs(candidate.tag, acts, real) &&
            placeFitsJob(candidate.tag, jobs, used) &&
            sportPlaceOk(candidate, used) &&
            sportGearPlaceOk(candidate, used, lex)
        );
        if (
          (places.size > 0 && !currentPlaceWorks) ||
          (used.has("outdoors") && !used.has("indoors")) ||
          (hasUsed((t) => OUTDOOR_WEATHER.has(t)) && !used.has("outdoors")) ||
          (!places.size && !canStillPickIndoorPlace)
        ) {
          return false;
        }
      }
      if (
        (used.has("breasts on table") || used.has("breasts on glass")) &&
        (item.mutex === "place" || item.group === "place") &&
        !INDOOR_ROOM.has(item.tag)
      ) {
        return false;
      }
      if (used.has("outdoors") && INDOOR_PROP.has(item.tag)) return false;
      // 釘 on bed 時場地／in_out 還沒填。outdoors → 床已擋，反向沒擋，
      // 實測釘床／椅／沙發 15～20/40 張自動 outdoors。bunk bed 本來就雙向。
      if (used.has("outdoors") && INDOOR_FURN.has(item.tag)) return false;
      if (item.tag === "outdoors" && hasUsed((t) => INDOOR_FURN.has(t))) return false;
      if (
        (item.implies || []).includes("outdoors") &&
        hasUsed((t) => INDOOR_FURN.has(t))
      ) {
        return false;
      }
      if (used.has("indoors") && item.tag === "starry sky") return false;
      if (
        INDOOR_FURN.has(item.tag) &&
        hasUsed((t) => t === "underwater" || t === "ocean" || t === "pool" || t === "car interior" || BATH_PLACE.has(t))
      ) {
        return false;
      }
    }
    if (real) {
      if (used.has("sleeping") && (item.tag === "city" || item.tag === "cityscape" || item.tag === "street")) {
        return false;
      }
      if ((item.tag === "city" || item.tag === "cityscape" || item.tag === "street") && used.has("sleeping")) {
        return false;
      }
      if (
        used.has("sleeping") &&
        (item.mutex === "place" || item.group === "place") &&
        ACT_PLACE.sleeping &&
        !ACT_PLACE.sleeping.has(item.tag)
      ) {
        return false;
      }
      // 正常模式不抽男人人種。這條本來寫成 `item.mutex === "race"`，但 monster boy
      // 是那一組的傘狀父標籤（goblin 等等 implies 它），mutex 是 null —— 於是它
      // 從規則旁邊溜過去，正常模式每 800 張還是會有 41 張冒出一個光禿禿的
      // 「怪物男」。改看 group 才擋得住整組。
      if (item.group === "race" && !pinned.has(item.tag)) return false;
      if (item.tag === "dark-skinned male" && !pinned.has(item.tag)) return false;
      const jobs = usedJobs(used, lex);
      if ((item.mutex === "place" || item.group === "place") && !placeFitsJob(item.tag, jobs, used)) {
        return false;
      }
      if (item.mutex === "activity") {
        // 可行性檢查要套時代濾鏡。這一關問的是「這個活動至少有一個地方可以做」，
        // 但場地清單是不分時代的：清單裡唯一撐住這個活動的場地若不屬於當前時代，
        // 「有地方可去」就是假的 —— 活動被放行，場地那一格卻誰也填不進去。
        // （courtyard 補進 maid 時就是這樣：中庭同時是女僕場地也是運動場地，
        // 運動活動因此過關，但中庭不是現代的字，於是 178 張運動圖全都沒有場地。）
        // 清單為空代表那個職業在這個時代一個場地都沒有 —— 今天沒有這種職業
        // （查過，0 組），真的出現的話活動也一定排不進去，擋掉是對的。
        const jp = jobPlacesOf(jobs);
        if (jp.size) {
          const usable = placesInEra(jp, lex, era);
          if (!usable.size || !actFitsSomePlaces(item.tag, usable, true)) return false;
        }
        if (!jobs.size && used.has("maid")) {
          const usable = placesInEra(JOB_PLACE.maid, lex, era);
          if (!usable.size || !actFitsSomePlaces(item.tag, usable, true)) return false;
        }
      }
      for (const d of item.implies || []) {
        const dit = lex.byTag.get(d);
        if (!dit || (dit.mutex !== "place" && dit.group !== "place")) continue;
        if (!placeFitsJob(d, jobs, used)) return false;
      }
      if (heat === "sex" && (item.mutex === "place" || item.group === "place")) {
        const acts = usedActs(used, lex);
        const water = [...acts].some((a) => WATER_ACT.has(a) || BATH_ACT.has(a));
        if (water) {
          if (!WATER_PLACE.has(item.tag) && !BATH_PLACE.has(item.tag)) return false;
        } else if (jobs.size && PUBLIC_SEX_PLACE.has(item.tag)) {
          // 自動抽的有職業性愛仍避開大街。只有「場上已有職業、且那些職業在這個
          // 時代的場地全是公開場所」才放行 —— 否則釘消防員開著性愛會 100% 沒場地
          // （實測 40/40）。偵探的辦公室不在公開清單，繼續走室內。
          const listed = [...jobs].filter((j) => JOB_PLACE[j]);
          const onlyPublic =
            listed.length > 0 && listed.every((j) => jobHasOnlyPublicPlaces(j, era, lex));
          if (!onlyPublic) return false;
        }
      }
      if (item.tag === "outdoors") {
        const listed = [...jobs].filter((j) => JOB_PLACE[j]);
        if (listed.length > 0 && listed.every((j) => jobHasOnlyIndoorPlaces(j, era, lex))) return false;
      }
    }
    return true;
  };


  const counts = settings.counts;
  // 衣著需要「偏好」而不是「硬分桶」。硬分桶會先把高順位抽到滿才看下一桶，
  // top／bottom／onepiece 各只有一格時，顏色變體的實際機率因此永遠是 0。
  // 權重保留年代合身、完整服裝優先，同時讓低順位衣著仍有非零機會。
  // 時代專屬的加權，現代的鞋子與布料除外。
  // 古代這個加權是正確性：江戶該穿木屐，不是皮鞋。可是現代的鞋子格只有 sneakers／cleats／
  // high heels 是「現代專屬」，布料格只有 latex／fishnets —— 加權全壓在這兩三個字上：
  // 實測現代 3000 張 sneakers 佔鞋子 47%、latex 佔布料 53%。涼鞋、靴子、襪子本來就是
  // 現代的東西，在現代不需要靠加權「顯示年代」。主要衣服（上衣／下身／一件式）照舊加權。
  // 現代的外套不再吃時代加權：夾克、大衣和它們的顏色款以前跟時代上衣同一階，
  // 1350 張裡夾克 26.5%、大衣 16.1%。降到普通衣服那一階，跟開襟衫、西裝外套一起分。
  // 羽織、斗篷仍吃時代加權。古代的鞋子與主衣不變；足袋和女用木屐除外，見 EDO_SIDE_FEET。
  // 三層時代加權都要改：只排除第二層的話，sneakers 會掉進第三層（時代專屬＋衣服，
  // 不管是不是顏色款）拿到 20，幾乎沒改善（實測 47% → 36%）。
  const MODERN_PLAIN_SLOTS = new Set(["feet", "fabric"]);
  const eraBoost = (item) =>
    eraSpecific(item, era) &&
    !EDO_SIDE_FEET.has(item.tag) &&
    !(era === "modern" && MODERN_PLAIN_SLOTS.has(item.mutex));
  const clothingPrefer = {
    softTiers: [
      (item) =>
        eraBoost(item) &&
        item.layer === "garment" &&
        !isColorVariant(item) &&
        (item.mutex === "onepiece" || item.mutex === "top" || item.mutex === "bottom"),
      (item) =>
        eraBoost(item) &&
        item.layer === "garment" &&
        !isColorVariant(item) &&
        !(era === "modern" && item.mutex === "outer"),
      // 顏色變體也可能是這個時代專屬的 —— blue shirt 就是 modern 專屬。
      // 舊的階梯用 !isColorVariant 把它們一路壓到最底層，等於自己把時代訊號丟掉：
      // 這一層加回來之後，現代的時代衣服從 5.32 升到 6.21（比硬桶時期的 5.79 還高），
      // 同時可達的顏色款式從 26 種變成 52 種。古代時代沒有顏色變體，完全不受影響。
      (item) =>
        eraBoost(item) &&
        item.layer === "garment" &&
        !(era === "modern" && item.mutex === "outer"),
      (item) =>
        item.layer === "garment" &&
        !isColorVariant(item) &&
        (item.mutex === "onepiece" || item.mutex === "top" || item.mutex === "bottom"),
      // 非現代、又不是這個時代的鞋子（江戶的靴子、足袋、女用木屐）不要跟普通衣服同一階。
      // 否則木屐／草履的 30 被七雙時代不限的鞋子加上這兩個新字稀釋，江戶鞋子不再以木屐為主。
      // 現代不套這條：現代鞋子的平衡是另外調過的（球鞋不得超過 25%）。
      (item) =>
        item.layer === "garment" &&
        !isColorVariant(item) &&
        !(era !== "modern" && item.mutex === "feet" && !eraBoost(item)),
      (item) => item.layer === "garment",
    ],
    // 前兩層是「這件衣服屬於這個時代」，權重和後面拉開一個量級 —— 時代對不對是
    // 正確性，顏色夠不夠多樣是豐富度，正確性要壓過豐富度。
    //
    // 這裡本來是硬桶（前一桶抽乾才輪到下一桶），改成軟權重是為了救色彩變體
    // （blue shirt 這類本身是 modern 專屬，卻因為 !isColorVariant 被壓在最低層，
    // 硬桶下機率恆為 0）。但 12:1 的差距不夠，時代專屬的衣服跟著掉了 12–24%：
    // 中世紀 2.18 → 1.66、江戶 3.33 → 2.57，古代本來就沒幾件，掉一件就看不出年代。
    // 40:6 把時代還原到硬桶水準（古中國和維多利亞甚至更好），色彩變體仍有 24 種可達。
    weights: [40, 30, 20, 6, 4, 2, 1],
  };
  // 硬桶會抽乾前一桶才看下一桶，而桶 1（臉部）有 18 個 mutex=null 的字可以無限疊。
  // 姿勢槽扣掉專用格只剩約 6 格，臉部全吃光，桶 2 永遠輪不到 —— 結果是 28 個 sex 字
  // 結構性不可達（有專用 fill 的 sex_act 活著，mutex=null 的那些全死），姿勢字種數
  // 也卡在 149。改軟權重之後 284 種，核心內容從 1.78 上到 3.85。
  //
  // 臉部從 5.2 降到 1.9 是代價。孤立提示詞裡臉部字確實會複合出表情強度，但完整
  // 提示詞有性愛情境撐著，同 seed 對照圖的表情沒有變弱（docs/compare-pose/）。
  const posePrefer = {
    softTiers: [
      (item) => item.mutex === "body_pose" || item.mutex === "camera" || item.mutex === "gaze",
      (item) => item.group === "face",
      (item) => heat === "sex" && (item.mutex === "sex_act" || item.group === "sex"),
      (item) => heat === "flash" && (item.mutex === "clothes_action" || item.group === "flash"),
      (item) => heat === "tease" && item.group === "tease",
    ],
    weights: [8, 8, 10, 10, 10, 3],
  };
  // 選格模式按已滿足的分類計數；不同分類的釘選、同義父字不吃掉其他格。
  // 全開模式沿用原來的段落張數，保持既有抽牌結果。
  const selectedSlots = new Map(Object.keys(SKELETON)
    .filter((section) => Number(counts[section]) < skeletonCap(section))
    .map((section) => [section, new Set(skeletonLit(settings, section))]));
  const countSection = (section) => {
    const selected = selectedSlots.get(section);
    if (selected) {
      const filled = new Set();
      for (const t of used) {
        const it = lex.byTag.get(t);
        if (it?.section === section) for (const k of offKeysOf(it)) if (selected.has(k)) filled.add(k);
      }
      return filled.size;
    }
    let n = 0;
    for (const t of used) {
      if (lex.byTag.get(t)?.section === section) n += 1;
    }
    return n;
  };
  const someUsed = (fn) => {
    for (const t of used) {
      const it = lex.byTag.get(t);
      if (it && fn(it, t)) return true;
    }
    return false;
  };

  // 泡澡／游泳本來就沒什麼好穿的，但服裝段的目標數不知道這件事：衣服被場景掃掉
  // 之後，那個額度會整批轉去補配件 —— 溫泉圖平均 4.6 件配件、0.8 件衣服，
  // 而一般場景是 0.7 件配件、5.4 件衣服。
  //
  // 以前那些額度填的是項圈、手套、棒球帽（黑名單沒列到的），改成白名單之後填的
  // 變成髮飾、眼鏡、耳環，每張都有 —— 問題從來不是「填什麼」，是「不該填那麼多」。
  //
  // 這個上限一定要下在 want，不能下在 fill 的過濾函式：那個函式是先把整池篩完
  // 才開始 commit，計數在裡面永遠是 0（我第一版就是這樣寫的，完全沒有作用）。
  const WATER_CLOTH_WANT = 3;
  const clothingWant = (base) => {
    const kind = sceneClothLocked(used, mustPins(), lex, era, lockOn);
    if (kind !== "bath" && kind !== "swim") return base;
    return Math.min(base, WATER_CLOTH_WANT);
  };

  const fill = (section, extraFilter) => {
    let want = Math.max(0, Math.min(10, Number(counts[section]) || 0));
    if (section === "clothing") want = clothingWant(want);
    const need = want - countSection(section);
    if (need <= 0) return;
    const selected = selectedSlots.get(section);
    const fillAllowed = selected ? (item) => {
      if (!offKeysOf(item).some((key) => selected.has(key) && !someUsed(
        (it) => it.section === section && offKeysOf(it).includes(key)
      ))) return false;
      return allow(item);
    } : allow;
    const pool = mPool(lex.bySection[section]).filter((item) =>
      (!extraFilter || extraFilter(item)) && fillAllowed(item)
    );
    let prefer = null;
    if (section === "clothing") prefer = clothingPrefer;
    else if (section === "pose") prefer = posePrefer;
    // env 刻意不給 prefer。takeFromPool 的桶是「抽乾桶 0 才輪到桶 1」，而 lighting
    // 之類的互斥只有一格 —— 舊的 (eraSpecific && mutex) 會讓桶 0 每次都先把那一格
    // 拿走，light 群裡 10 個 era:["any"] 的字機率恆為 0。era:["any"] 的意思是每個
    // 時代都能用，不是次等候選；真正不屬於當代的字 eraOk() 已經擋掉了。
    // 年代骨架與主場地由 stampAnchors("env") 和 fillSlot("env", "place") 負責。
    if (section === "feature" && !selected && sceneMode !== "weird") return fillFeatureFlavor(pool, need);
    takeFromPool(pool, need, rand, commit, prefer, fillAllowed, mPre);
  };

  // 長相自由格（FEATURE_SHARE 的說明）。主亂數照舊洗一次牌、吃掉一樣多次，後面服裝、
  // 姿勢、場景的抽法對每顆種子都不變；挑哪幾張用種子派生的獨立亂數。
  const featureRand = Number.isFinite(seed) ? mulberry32(((seed >>> 0) ^ 0x00f1a7e5) >>> 0) : rand;
  const fillFeatureFlavor = (pool, need) => {
    if (mPre && mPre.taken && mPre.taken.size) pool = prefilterPoolByMutex(mPre.idx, mPre.taken, pool).kept;
    const shuffled = shuffle(pool, rand);
    // 走光、性愛的畫面，私密部位和觸碰本來就是重點，不是搶戲：份量照尺度拉回來。
    const share = { ...(sceneMode === "diverse" ? FEATURE_SHARE_DIVERSE : FEATURE_SHARE), ...(FEATURE_SHARE_HEAT[heat] || {}) };
    const famSize = new Map();
    for (const item of shuffled) famSize.set(featureFamilyOf(item), (famSize.get(featureFamilyOf(item)) || 0) + 1);
    const candidates = shuffled.map((item) => {
      const fam = featureFamilyOf(item);
      const w = (share[fam] ?? share.other) / famSize.get(fam);
      return { item, weight: FEATURE_LOUD.has(item.tag) ? w * FEATURE_LOUD_FACTOR : w };
    });
    let n = 0;
    while (n < need && candidates.length) {
      let cursor = featureRand() * candidates.reduce((sum, c) => sum + c.weight, 0);
      let index = candidates.length - 1;
      for (let i = 0; i < candidates.length; i += 1) {
        cursor -= candidates[i].weight;
        if (cursor <= 0) {
          index = i;
          break;
        }
      }
      const [{ item }] = candidates.splice(index, 1);
      if (allow(item) && commit(item.tag)) n += 1;
    }
  };

  // 佔住 place 這一格的時代錨，改成「偏好」而不是「無條件蓋章」。
  //
  // 六個時代裡只有兩個錨是場地：castle（medieval）和 chinese architecture
  // （ancient_china）。它們一蓋下去就把唯一的場地格佔滿，接著
  // fillSlot("env","place") 看到 mutexTaken 有 place 就直接 return ——
  // 那一格等於不存在。
  //
  // 結果是反過來的：奇葩模式 castle 佔 100%，多元 62%，正常反而只有 19%。
  // 正常模式之所以最鬆，是因為 allow() 會用 placeFitsActs 擋掉不合活動的城堡，
  // 剛好把格子讓回來。**規則放得越鬆、畫面反而越單調**，跟面板上寫的
  // 「多元＝只鎖場景配對與物理，奇葩＝只鎖物理」正好相反。
  //
  // 其他四個時代的錨不佔場地格（armor、japanese clothes、modern…），
  // 它們的場地本來就很散（edo dojo 10%、victorian park 9%），這也反過來說明
  // 問題出在「佔格子」而不是「錨」本身。
  const stampAnchors = (section) => {
    for (const t of lex.data.eraAnchors?.[era] || []) {
      // 錨點可以有一組同義的替代字（chinese clothes / hanfu）。每次隨機挑一個，
      // 否則同一個時代的每一張圖都由同一個字開頭。挑到的字被擋下來時，
      // 同組其他字還有機會，所以不會因為換寫法就少掉時代訊號。
      const alts = lex.data.eraAnchorAlts?.[t] || [t];
      const pool = [];
      for (const alt of alts) {
        const item = lex.byTag.get(alt);
        if (!item || item.section !== section) continue;
        if (used.has(alt) || banned.has(alt)) continue;
        if (!allow(item)) continue;
        pool.push(item);
      }
      if (!pool.length) continue;
      const pick = pool[Math.floor(rand() * pool.length)];
      // 場地錨改成擲骰子。不用「軟權重」是因為 takeFromPool 的權重是**逐個字**算的，
      // 不是逐層：castle 一個字權重 6，要跟十幾個中世紀場地（各 3）和十六個中性
      // 場地（各 1）比，算出來只有 9%。想調到某個比例就得把權重寫成 37 這種數字，
      // 而那個數字會隨著詞庫長大而失準 —— 那是在對著池子大小調參，不是在表達意圖。
      // 機率直接就是意圖：這個時代有多少比例的圖用它的招牌場地。
      if (pick.mutex === "place") {
        if (rand() >= PLACE_ANCHOR_CHANCE) continue;
      }
      commitMeta.source = SOURCES.era_anchor;
      commitMeta.stage = STAGES.fill;
      commit(pick.tag);
      commitMeta.source = SOURCES.random;
      commitMeta.stage = STAGES.fill;
    }
  };

  const fillSlot = (section, mutexName, preferOverride) => {
    if (mutexTaken.has(mutexName)) return;
    const indexed = lex.byMutex && lex.byMutex.get(section + ":" + mutexName);
    let pool = mPool(indexed || lex.bySection[section].filter((item) => item.mutex === mutexName)).filter(
      (item) => allow(item)
    );
    if (section === "pose" && mutexName === "camera" && people >= 2) {
      pool = pool.filter((item) => item.tag !== "pov" && item.tag !== "pov crotch" && item.tag !== "pov hands");
    }
    let prefer = preferOverride;
    if (prefer == null) {
      if (section === "clothing") prefer = clothingPrefer;
      else if (section === "env") prefer = (item) => eraSpecific(item, era);
    }
    takeFromPool(pool, 1, rand, commit, prefer, allow, mPre);
  };

  // 胸圍：以前跟其他格一樣六種平均抽，全年齡、只開活動也有三成五是 huge／gigantic。
  // 改成照常見程度加權。主亂數照舊洗一次牌（吃掉一樣多次），所以同一顆種子的其他牌
  // 一張都不變；加權用種子派生的獨立亂數（同 compositionRand 的做法）。
  const breastRand = Number.isFinite(seed) ? mulberry32(((seed >>> 0) ^ 0x00b2e457) >>> 0) : rand;
  const fillBreastSize = () => {
    if (mutexTaken.has("breast_size")) return;
    const indexed = lex.byMutex && lex.byMutex.get("feature:breast_size");
    let pool = mPool(indexed || lex.bySection.feature.filter((item) => item.mutex === "breast_size")).filter((item) => allow(item));
    if (mPre && mPre.taken && mPre.taken.size) pool = prefilterPoolByMutex(mPre.idx, mPre.taken, pool).kept;
    const candidates = shuffle(pool, rand).map((item) => ({ item, weight: BREAST_WEIGHT[item.tag] ?? 10 }));
    while (candidates.length) {
      let cursor = breastRand() * candidates.reduce((sum, c) => sum + c.weight, 0);
      let index = candidates.length - 1;
      for (let i = 0; i < candidates.length; i += 1) {
        cursor -= candidates[i].weight;
        if (cursor <= 0) {
          index = i;
          break;
        }
      }
      const [{ item }] = candidates.splice(index, 1);
      if (allow(item) && commit(item.tag)) return;
    }
  };

  // 場上已經看得出是哪個運動時，活動欄優先挑那個運動自己的活動（排球場 → 做運動，
  // 而不是逛街）。抽不到也沒關係，場地本來就會把不合的活動擋掉。
  const sportActivityPrefer = () => {
    const ids = sportIdsOf(used);
    if (!ids || !ids.size) return null;
    const wanted = new Set();
    for (const sp of SPORT_PRESETS) {
      if (sp.activity && ids.has(sp.id)) wanted.add(sp.activity);
    }
    if (!wanted.size) return null;
    return (item) => wanted.has(item.tag);
  };

  const fillGroup = (section, groupName) => {
    if (someUsed((it) => it.group === groupName)) return;
    const indexed = lex.byGroup && lex.byGroup.get(section + ":" + groupName);
    const pool = mPool(indexed || lex.bySection[section].filter((item) => item.group === groupName)).filter(
      (item) => allow(item)
    );
    takeFromPool(pool, 1, rand, commit, null, allow, mPre);
  };

  // 必抽：使用者在小分類旁指定「這一類至少要 N 個」。跑在骨架與通用補牌之前，
  // 所以它佔到的名額會被 countSection() 算進去，left rail 的「每段抽幾個」自動扣掉。
  // 權限比時代大（skipEra），但互斥、尺度、女／男、已關閉、已選都照擋 —— 互斥由
  // commit() 的 mutexBusy() 把關，所以必抽 2 絕不會給出兩個互斥的 tag。
  const mustWants = [];
  // 必抽抽到的字（含它帶進來的相依字）要跟釘選一樣受保護，否則最後的 reconcile()
  // 會被後committed 的字擠掉，性愛的全裸規則也會把必抽的衣服整排剝光。
  const mustLocked = new Set();
  const mustAllow = (item) => {
    if (!allow(item, { skipEra: true })) return false;
    // commit() 的 implyChain 只檢查時代，所以必抽有機會靠相依字把尺度／性別牆繞過去
    // （例如 spooning 在誘惑也能用，但它 implies sex）。這裡先把整條鏈驗過再說。
    for (const dep of implyChain(lex, item.tag)) {
      const it = lex.byTag.get(dep);
      if (!it) continue;
      if (!heatOk(it, heat) || !gateOk(it, female, male)) return false;
    }
    return true;
  };
  const mustSpec =
    settings.mustDraw && typeof settings.mustDraw === "object" ? settings.mustDraw : null;
  if (mustSpec) {
    for (const key of Object.keys(mustSpec)) {
      const sep = key.indexOf(":");
      if (sep <= 0) continue;
      const section = key.slice(0, sep);
      const group = key.slice(sep + 1);
      const want = Math.max(0, Math.min(MUST_MAX, Math.floor(Number(mustSpec[key])) || 0));
      if (!want || section === "quality" || !lex.bySection[section]) continue;
      const inKey = mustMatcher(lex, key, section, group);
      mustWants.push({ key, section, group, want, inKey });
      let have = 0;
      for (const t of used) {
        if (inKey(lex.byTag.get(t))) have += 1;
      }
      if (have >= want) continue;
      const indexed = (lex.bySub && lex.bySub.get(key)) || (lex.byGroup && lex.byGroup.get(key));
      const pool = mPool(indexed || lex.bySection[section].filter(inKey)).filter((item) =>
        mustAllow(item)
      );
      const before = new Set(used);
      commitMeta.source = SOURCES.must_draw;
      commitMeta.stage = STAGES.must_draw;
      takeFromPool(pool, want - have, rand, commit, null, mustAllow, mPre);
      commitMeta.source = SOURCES.random;
      commitMeta.stage = STAGES.fill;
      for (const t of used) if (!before.has(t)) mustLocked.add(t);
    }
  }
  // 「使用者明講要什麼」這一層，必抽比照釘選：場景服裝規則和最後的 reconcile 都讓路。
  // sceneClothLocked() 本來就是這樣對待釘選的。真正的互斥、以及身體姿勢對不上（例如
  // 性愛體位跟雙手抱胸）仍然照擋，抽不到就在 mustReport 如實回報。
  const mustPins = () => (mustLocked.size ? new Set([...pinned, ...mustLocked]) : pinned);

  // 少量 tease 畫面先決定「無臉構圖」，再讓後續 feature/pose 配合它。
  //
  // 這兩個 camera 以前排在眼睛、表情與活動後面，所以 allow() 每次都看到衝突，
  // 自然抽取是 0。單純把所有 camera 提前又會讓 lower body 擋掉 flash/sex 必須有的
  // 手部與胸部動作；因此只在沒有核心活動保證的 tease 尺度建立低機率 profile。
  // pin 與 mustDraw 若已佔 camera，使用者意圖優先，不再擲這次 profile。
  //
  // 構圖 profile 使用由 seed 派生的獨立亂數流。若在主 rand() 多抽一次，所有 tease
  // 結果（包括職業場地、衣服與姿勢）都會整串位移；新增一個 camera 不該改寫其餘
  // 94% 畫面的既有行為。UI 與正式測試都會傳數字 seed，fallback 僅供外部呼叫者。
  const compositionRand = Number.isFinite(seed)
    ? mulberry32(((seed >>> 0) ^ 0x0051f15e) >>> 0)
    : rand;
  if (heat === "tease" && !mutexTaken.has("camera") && compositionRand() < 0.06) {
    const faceless = ["head out of frame", "lower body"]
      .map((tag) => lex.byTag.get(tag))
      .filter((item) => item && allow(item));
    takeFromPool(faceless, 1, compositionRand, commit, null, allow, mPre);
  }
  // §2 Composition planned — coarse flags only; never emit concrete camera/place tags.
  {
    const cameraProfile =
      used.has("head out of frame") || used.has("lower body") ? "faceless" : "normal";
    if (
      emitDrawStage(drawOpts, {
        stage: "composition",
        plan: {
          cameraProfile,
          sceneSlots: {},
          fallbacks: [],
        },
      })?.cancel
    ) {
      return cancelledDrawResult({ heat, era, female, male, people, seed });
    }
  }

  // 釘選／必抽額外保留，不覆蓋使用者選中的分類。
  // 同類已存在時 fillSlot 的 mutex／fillGroup 的 group 檢查會避免重複補牌。

  fillSlot("feature", "hair_length");
  fillSlot("feature", "eye_color");
  if (!used.has("bald")) {
    fillSlot("feature", "hair_color");
    fillGroup("feature", "hair_style");
  }
  if (female) fillBreastSize();
  // 人種格在正常模式由 allow() 擋掉。多元／奇葩才擲。以前只在有男生時擲，
  // 女角的惡魔娘、史萊姆娘、乳牛娘就永遠進不了只有女生的多元圖。
  if (!real && (female || male) && rand() < 0.38) fillSlot("feature", "race");
  if (settings.drawJob && !used.has("maid")) fillSlot("feature", "job");
  if (heat !== "sex" && !someUsed((it) => it.mutex === "sex_act" || it.tag === "sex")) {
    fillSlot("pose", "activity", sportActivityPrefer() || undefined);
  }
  fill("feature", (item) => {
    // 同上：一般補牌也要看 group，否則傘狀的 monster boy 會自己被補進來。
    // 具體人種由上面的 fillSlot("feature", "race") 負責，它會連帶 implies 出父標籤。
    if (item.group === "race") return false;
    if (item.mutex === "job" && (!settings.drawJob || used.has("maid"))) return false;
    return true;
  });

  const clothingPinned = someUsed((it, t) => it.section === "clothing" && pinned.has(t));
  const garmentPinned = someUsed(
    (it, t) => pinned.has(t) && it.section === "clothing" && it.layer === "garment"
  );
  const nudePinned = someUsed((it) => it.section === "clothing" && it.layer === "skin");
  if (
    !garmentPinned &&
    !nudePinned &&
    heat !== "flash" &&
    !mutexTaken.has("onepiece") &&
    !mutexTaken.has("top") &&
    !mutexTaken.has("bottom")
  ) {
    const kind = sceneClothKind(pinned);
    let nudeChance = 0;
    if (kind === "bath") nudeChance = 0.34;
    else if (kind === "swim") nudeChance = 0.18;
    else if (heat === "sex") nudeChance = 0.2;
    if (nudeChance && rand() < nudeChance) {
      const skins = lex.bySection.clothing.filter(
        (item) => (item.tag === "nude" || item.tag === "completely nude") && allow(item)
      );
      takeFromPool(skins, 1, rand, commit, null, allow, mPre);
    }
  }
  if (
    heat === "sex" &&
    !clothingPinned &&
    !nudePinned &&
    !someUsed((it) => it.section === "clothing" && it.layer === "skin") &&
    !mutexTaken.has("onepiece") &&
    !mutexTaken.has("top") &&
    !mutexTaken.has("bottom")
  ) {
    const cover = lex.bySection.clothing.filter(
      (item) =>
        (item.layer === "skin" ||
          (item.layer === "garment" && (item.mutex === "onepiece" || item.mutex === "top" || item.mutex === "bottom"))) &&
        allow(item)
    );
    takeFromPool(cover, 1, rand, commit, clothingPrefer, allow, mPre);
  }
  const nudeAccMutex = new Set(["jewelry", "eyewear", "neckwear", "hands", "headwear", "feet", "hair_acc"]);
  const wornAccMutex = new Set([
    "feet", "waist", "legs", "jewelry", "eyewear", "neckwear",
    "underwear_top", "underwear_bottom", "outer", "hands", "headwear",
    "hair_acc", "bag",
  ]);
  const gotNude = someUsed((it) => it.section === "clothing" && it.layer === "skin");
  const hasBodyGarment = () =>
    someUsed((it) => {
      if (it.section !== "clothing") return false;
      if (it.layer === "skin") return true;
      return isBodyGarment(it);
    });
  if (gotNude) {
    fill("clothing", (item) => {
      if (!(item.layer === "accessory" || item.layer === "skin")) return false;
      if (!lockOn) return true;
      if (item.layer === "skin") return true;
      if (item.tag === "stethoscope" || item.tag === "nurse cap") return used.has("nurse") || used.has("doctor");
      if (item.tag === "hard hat") return used.has("construction worker") || used.has("construction site");
      if (item.tag === "police hat") return used.has("policewoman") || used.has("police uniform");
      if (item.tag === "lab coat") return used.has("scientist") || used.has("doctor") || used.has("laboratory");
      if (nudeAccMutex.has(item.mutex) && !mutexTaken.has(item.mutex)) return true;
      return false;
    });
  } else {
    stampAnchors("clothing");
    if (!hasBodyGarment()) {
      const pool = lex.bySection.clothing.filter(
        (item) =>
          item.layer === "garment" &&
          (item.mutex === "onepiece" || item.mutex === "top" || item.mutex === "bottom") &&
          allow(item)
      );
      takeFromPool(pool, 1, rand, commit, clothingPrefer, allow, mPre);
    }
    fill("clothing", (item) => {
      if (item.layer === "skin") return false;
      if (item.layer === "garment" && !item.mutex) {
        if (item.group === "fabric") return true;
        return someUsed((it) => relOf(it).has(item.tag));
      }
      if (item.mutex === "onepiece" || item.mutex === "top" || item.mutex === "bottom") {
        if (mutexTaken.has("onepiece") || item.mutex === "onepiece") return false;
        if (mutexTaken.has(item.mutex)) return false;
        return true;
      }
      if (lockOn) {
        if (item.layer === "garment" && someUsed((it) => relOf(it).has(item.tag))) return true;
        if (item.tag === "stethoscope" || item.tag === "nurse cap") return used.has("nurse") || used.has("doctor");
        if (item.tag === "hard hat") return used.has("construction worker") || used.has("construction site");
        if (item.tag === "police hat") return used.has("policewoman") || used.has("police uniform");
        if (item.tag === "lab coat") return used.has("scientist") || used.has("doctor") || used.has("laboratory");
        // waist 是新加的格子（obi／sash／belt）。腰上的東西以前 mutex 是空的，
        // 於是在這條路徑上一律被擋 —— 江戶的 obi 在 3000 張裡是 0。
        if (wornAccMutex.has(item.mutex) && !mutexTaken.has(item.mutex)) return true;
        return false;
      }
      return true;
    });
  }

  // 這裡曾經有一段「只穿內衣就補兩格內衣」。量過之後拿掉了：A/B 跑同一批 seed，
  // 有沒有那段的結果**逐字相同**（400 張都留下 318 張）。原因是通用的
  // fill("clothing") 本來就會把內衣填上，而填不上的那些是被浴場事後脫掉的 ——
  // 在這個位置補也會被脫。真正有效的是下面那條「沒有內衣就把這個字拿掉」。
  const soloSex = (tag) =>
    tag === "masturbation" ||
    tag === "female masturbation" ||
    tag === "male masturbation" ||
    tag === "fingering" ||
    tag === "masturbation through clothes";
  if (heat === "sex" && people >= 2) {
    const acts = lex.bySection.pose.filter(
      (item) => (item.mutex === "sex_act" || item.tag === "sex") && allow(item)
    );
    takeFromPool(acts, 1, rand, commit, null, allow, mPre);
  }
  if (heat === "sex" && people === 1) {
    const acts = lex.bySection.pose.filter((item) => soloSex(item.tag) && allow(item));
    takeFromPool(acts, 1, rand, commit, null, allow, mPre);
  }
  // 身體格以前均權。品質規則之後同一批種子：預設（seed 170000，3000 張）站立劈腿 7.0%、
  // 踮腳 6.9%、走跑跳合計 11.8%，五個動態姿勢合計 25.8%。只開誘惑（seed 180000）
  // 站立劈腿 12.6%、踮腳 7.2%、走跑跳 17.5%，合計 37.3%。站著只有 14–17%。
  // 站立劈腿權重 1、踮腳 60、走跑跳各 50，其餘身體姿勢 300。
  // 權重差拉大之後，只剩「它是唯一合法姿勢」的那些圖還會抽到站立劈腿，所以 allow() 再按種子擋掉三成。
  // 釘選在這格之前就佔住，不受這組權重影響。未釘選的站立劈腿、走路、跑步、跳躍在性愛進不了池。
  fillSlot("pose", "body_pose", {
    softTiers: [
      (item) =>
        item.tag !== "standing split" &&
        item.tag !== "tiptoes" &&
        item.tag !== "walking" &&
        item.tag !== "walking away" &&
        item.tag !== "running" &&
        item.tag !== "jumping",
      (item) => item.tag === "walking" || item.tag === "walking away" || item.tag === "running" || item.tag === "jumping",
      (item) => item.tag === "tiptoes",
      (item) => item.tag === "standing split",
    ],
    weights: [300, 50, 60, 1],
  });
  // 一般 camera 仍放在臉部特徵後；只有上方 tease profile 會先保留無臉構圖。
  // 這可讓 head out of frame / lower body 自然可達，又不會讓它們擋掉 flash/sex
  // 必須保證的手臂、胸部或性愛動作。詳見 docs/pose-tag-deep-review.md §2。
  fillSlot("pose", "camera");
  fillSlot("pose", "gaze");
  fillSlot("pose", "expression");
  const hasSexAct = someUsed((it) => it.mutex === "sex_act" || it.tag === "sex");
  if (heat !== "sex" && !hasSexAct) fillSlot("pose", "activity", sportActivityPrefer() || undefined);
  const stampActProps = () => {
    for (const a of usedActs(used, lex)) {
      const props = ACT_PROP[a] || [];
      // 這個活動已經有道具了就不要再來一次。stampActProps() 一張圖裡會跑三次，
      // 而 karaoke implies singing、兩個都在 ACT_PROP 裡 —— 少了這一關，
      // 第二輪會為同一件事再擲一次骰子（擲了也白擲，held_prop 那一格已經被佔）。
      if (props.some((p) => used.has(p))) continue;
      const fit = props.filter((p) => {
        if (banned.has(p)) return false;
        const item = lex.byTag.get(p);
        return !!item && eraOk(item, era) && heatOk(item, heat);
      });
      if (!fit.length) continue;
      // 從合格的裡面隨機挑。舊寫法是 `commit(prop); break;` 取第一個 ——
      // 那是無條件 break，清單一旦有多個字，第一個被 commit 拒絕（互斥格已被
      // 別的活動佔走）就整個放棄，後面的字連試都不會試到。
      const start = Math.floor(rand() * fit.length);
      for (let k = 0; k < fit.length; k += 1) {
        if (commit(fit[(start + k) % fit.length])) break;
      }
    }
  };
  stampActProps();
  if (heat === "flash") {
    const hasAct = someUsed((it) => it.mutex === "clothes_action" || it.group === "flash");
    if (!hasAct) {
      // 補抽時所有「現在成立」的走光動作放進同一個池子，衣服吻合的字權重 10。
      // 以前先填 clothes_action 格（shirt pull／dress pull…），失敗才輪到 flash 群；
      // 同樣要衣服的 shirt lift／dress lift／skirt lift／upskirt 因此幾乎抽不到。
      // 實測 3000 張現代走光：shirt pull 17.8%、shirt lift 0、dress lift 0。
      //
      // 試過的兩個極端：
      //   要衣服的先抽（硬分層）：內褲、胸罩幾乎每張都在，cameltoe／panty pull 變成
      //     永遠成立，不要衣服的四十幾個動作從 56.9% 掉到 18.9% —— 就是討論區
      //     2026-09-19 那條：往有優先序的格子放永遠成立的字，等於把後面關掉。
      //   一字一票：多樣性最高，但跟衣服綁在一起的動作從 48% 掉到 11%，那是原本
      //     刻意偏好的連貫性（掀的就是身上那件）。
      // 權重 10 讓兩類比例回到原本（綁衣服 46.2%／不綁 58.3%，原本 48.1%／56.9%），
      // 同類裡不再一家獨大：有效種類 28.1 → 40.6，最大宗 17.8% → 6.1%。
      // 衣服檢查（有快取、便宜）排在 allow() 前面：衣服不合的字連 allow() 都不必跑。
      // 兩者都是純判斷式的 AND，順序不影響結果與候選順序。
      const flashActs = lex.bySection.pose.filter(
        (item) =>
          (item.mutex === "clothes_action" || item.group === "flash") &&
          actionFitsWorn(item) !== 0 &&
          allow(item)
      );
      const garmentFits = (item) => actionGarmentKeys(item.tag).length > 0 && actionFitsWorn(item) === 2;
      takeFromPool(flashActs, 1, rand, commit, { softTiers: [garmentFits], weights: [10, 1] }, allow, mPre);
    }
    if (!someUsed((it) => it.mutex === "clothes_action" || it.group === "flash")) {
      fillSlot("pose", "clothes_action", [
        (item) => actionFitsWorn(item) === 2,
        (item) => actionFitsWorn(item) === 1,
      ]);
      if (!someUsed((it) => it.mutex === "clothes_action" || it.group === "flash")) {
        fillGroup("pose", "flash");
      }
    }
  }
  stampAnchors("env");
  // 場地也改成軟權重，理由跟燈光那一格一模一樣。
  //
  // fillSlot 的 env 預設偏好是硬桶：時代專屬的抽乾了才輪到 era:["any"]。而場地
  // 只有一格，所以「輪到」幾乎不會發生 —— 實測現代 86 個時代專屬場地拿走 95%，
  // 16 個中性場地（沙灘、海洋、森林、山）合計只有 5%，beach 在 18000 張裡是 0。
  // 古中國 67% 都是 chinese architecture，中世紀 70% 都是 castle。
  //
  // 這件事這個檔案自己已經想通過一次：fill(section) 那裡的註解寫著
  // 「era:["any"] 的意思是每個時代都能用，不是次等候選」，所以 fill("env") 早就
  // 拿掉了 prefer。漏掉的是場地這一格。燈光那一格也是同一個病，用 4:1 修好的。
  //
  // 四比一改成十四比一（2026-09-17）。原本的說法是「時代味不靠這一格扛，底下的
  // 『時代風味』那一格（不佔互斥格的景物）才是」—— 但實測那個設計撐不住：
  //
  //   古中國 4000 張，時代訊號由誰扛：服裝＋場地 60.9%、**只有服裝 34.9%**、
  //   只有場地 3.5%、兩個都沒有 0.7%。
  //
  // 也就是三分之一的圖，時代感只靠衣服撐著 —— 人一脫光就什麼都不剩，只剩
  // 紙燈籠、珠子那種小道具，而那撐不起一張圖。專案主回報的正是這種：
  // 「nude + underwater + paper lantern」完全看不出古中國。
  //
  // 十四比一之後：只靠衣服 34.9% -> 26.3%，兩個都沒有 0.7% -> 0.3%。
  // 中性場地沒有被餓死（這正是當初設成四比一要防的）：歷史時代的場地種類
  // 52 -> 50、中性種類 13 -> 12，beach 155 -> 123，仍然抽得到。
  //
  // 再往上加幾乎沒有用：二十五比一也只到 24.1%，因為剩下的中性場地多半是
  // 情境規則塞進來的（做愛要私密場地、泡澡要浴場），不是這一格抽出來的。
  // 要再往下就得去查「為什麼時代專屬場地在那些情境被擋掉」，那是另一件事。
  // 背景格（BACKGROUND_CHANCE）：排在場地前面，抽到就佔住 place／in_out／day_night，
  // 場地那一格看到 place 被佔就直接跳過。要配場地的圖不走這條：活動、有專屬場地的職業
  // （消防員在街上、偵探在辦公室 —— 釘職業的性愛圖「一定有場地」那幾條測試守著）、
  // 運動、泡澡游泳。
  if (
    (!era || era === "modern") &&
    !mutexTaken.has("place") &&
    !usedPlaces(used, lex).size &&
    !usedActs(used, lex).size &&
    ![...used].some((t) => JOB_PLACE[t]) &&
    !sportIdsOf(used)?.size &&
    !isSwimScene(used) &&
    !isBathScene(used) &&
    rand() < BACKGROUND_CHANCE
  ) {
    fillSlot("env", "background", {
      softTiers: [(item) => COMMON_BG.has(item.tag)],
      weights: [4, 1],
    });
  }
  // 十四比一在大池子裡每個時代場地大約 3%。釘了活動、池子被收到幾個字時，
  // 唯一的時代場地會吃掉七到九成。候選達到兩個就封頂：兩個字最多 65%，
  // 三個以上最多 40%。沒有這些釘選時不封頂，既有種子的抽法不變。
  // 使用者已經釘了室內或室外時，時代權重不再加在場地上：海邊、森林、山、街道
  // 和竹林、公園都是這一側的場景，權重一樣。時代錨（城堡、東亞建築）仍在上面擲過。
  const sidePinned = pinned.has("outdoors") || pinned.has("indoors");
  // 性愛的場地跟誘惑用同一池，權重拉平。否則公園、巷弄是時代專屬（14），
  // 海邊、街道、海洋是任何時代（1），開了白名單也幾乎抽不到。
  // 釘了室內或室外時本來就是 1:1。誘惑、走光、活動仍是 14:1。
  // 拉平只在現代。歷史時代的時代感有一大半靠場地扛，性愛圖人又常常脫光：
  // 全拉平時古中國「只靠衣服」33.9%（audit_draw_invariants 上限 30%）。
  // 歷史時代的性愛改成 3:1，而且招牌場地（城堡、東亞建築）不吃這個加權 ——
  // 它們已經先擲過 PLACE_ANCHOR_CHANCE，再加權就超過 test_engine 的「單一場地 ≤35%」。
  // 量過（各 400／3000 張）：3:1 只靠衣服 29.0%、沒有場地過 35%、大街海邊都抽得到；
  // 4:1 東亞建築 36%，5:1 中世紀大街、維多利亞海邊抽不到。兩份規格在這裡互相拉扯，
  // 3 是唯一兩邊都過的整數，緩衝很薄（29.0% 對 30%）。
  //
  // 詞庫變大之後古中國又越線（3000 張、seed 310000：只靠衣服 30.3%、完全沒訊號 2.8%）。
  // 沒訊號的 83 張裡 68 張是性愛、沒有活動、也沒有時代衣服（人脫光，場地是海底、沙灘
  // 這種中性字）。身上已經有時代衣服的性愛仍用 3:1，大街和海邊才留得住；
  // 沒有時代衣服時改回 14:1，跟誘惑、走光同一套，招牌場地一樣不吃這個加權。
  const evenPlace = sidePinned || (heat === "sex" && (!era || era === "modern"));
  const sexEra = heat === "sex" && !evenPlace;
  const noEraCloth = !!(era && era !== "modern" && !someUsed(
    (it) => it.section === "clothing" && eraSpecific(it, era)
  ));
  const anchorPlaces = sexEra
    ? new Set((lex.data.eraAnchors?.[era] || []).flatMap((t) => lex.data.eraAnchorAlts?.[t] || [t]))
    : null;
  // 活動比衣服先抽。女僕裝是後來才穿上的，所以上面那道閘看不到它。
  // 伸展配女僕、又釘了雨：公園不算女僕的地方，臥室又被雨擋住，場地格會空。
  // 這時候把還沒釘死的活動拿掉，場地照女僕和雨去填；下面場景鎖會再補一個配得上場地的活動。
  if (lockOn) {
    const indoorFix = [...used].some((t) => INDOOR_PROP.has(t) || INDOOR_FURN.has(t));
    const outdoorWx = [...used].some((t) => OUTDOOR_WEATHER.has(t));
    if (indoorFix || outdoorWx) {
      for (const a of [...usedActs(used, lex)]) {
        if (pinned.has(a)) continue;
        if (outdoorWx && !actHasUsableSide(a, era, lex, used, "out")) {
          used.delete(a);
          if (mutexTaken.get("activity") === a) mutexTaken.delete("activity");
          continue;
        }
        if (indoorFix && !actHasUsableSide(a, era, lex, used, "in")) {
          used.delete(a);
          if (mutexTaken.get("activity") === a) mutexTaken.delete("activity");
        }
      }
    }
  }
  fillSlot(
    "env",
    "place",
    evenPlace
      ? {
          softTiers: [() => false],
          weights: [1, 1],
          ...(relaxesPrivateSex() ? { capShare: 0.4 } : {}),
        }
      : {
          softTiers: [(item) => eraSpecific(item, era) && !(sexEra && anchorPlaces.has(item.tag))],
          weights: [sexEra && !noEraCloth ? 3 : 14, 1],
          ...(relaxesPrivateSex() ? { capShare: 0.4 } : {}),
        },
  );
  // 女僕裝不是職業，但場地會照女僕的屋子收。購物的場地跟那份清單沒有交集，
  // 釘了購物又抽到女僕裝，場地就空了。裝沒被釘、也不是必抽時，把裝拿掉，
  // 下面的修補才能把試衣間補回來。已有場地的圖不走這裡。
  if (
    real &&
    !usedPlaces(used, lex).size &&
    used.has("maid") &&
    !mustPins().has("maid")
  ) {
    const acts = [...usedActs(used, lex)].filter((a) => ACT_PLACE[a]);
    const maidOk = placesInEra(JOB_PLACE.maid, lex, era);
    const fitsMaid = acts.some((a) => [...ACT_PLACE[a]].some((p) => maidOk.has(p)));
    if (acts.length && !fitsMaid) {
      used.delete("maid");
      if (mutexTaken.get("onepiece") === "maid") mutexTaken.delete("onepiece");
    }
  }
  if (real && !usedPlaces(used, lex).size) {
    for (const a of usedActs(used, lex)) {
      for (const p of ACT_PLACE[a] || []) {
        const item = lex.byTag.get(p);
        if (!item) continue;
        if (!allow(item)) continue;
        if (commit(p)) break;
      }
      if (usedPlaces(used, lex).size) break;
    }
  }
  fillSlot("env", "in_out");
  // 天氣。這一格以前完全沒人填，而通用的 fill("env") 在預設張數下一格預算都不剩
  // （place / in_out / day_night / lighting 四格，加上場地免費帶進來的 indoors／
  // outdoors，把當時預設的 env:4 用完；那個預設後來調到 6），所以
  // rain、snow、fog、overcast、cherry blossoms 這幾個字在預設設定下是 0 —— 不是
  // 抽得少，是結構性抽不到。跟光源當初一模一樣的病。
  //
  // 但不能照抄光源那格的做法。光源是每張圖都有，天氣不是：Danbooru 上六個天氣字
  // 加起來最多只佔室外圖的 6.6%（rain 2.00%、snow 2.89%、cherry blossoms 2.37%、
  // steam 0.84%、fog 0.46%、overcast 0.39%）。無條件填等於每張圖都在下雨，而且
  // 室內也會下。所以這裡是「室外才擲骰子」。
  //
  // 15% 比 Danbooru 的基礎比例略高 —— 這是隨機器，看得到才有意義 —— 但仍在同一個
  // 量級。室外約佔六成，所以全體大約 9% 的圖會有天氣。
  //
  // 蒸氣跟天氣互斥（同一個 mutex），所以兩者在這裡二選一：有浴場就是蒸氣，
  // 否則室外才擲天氣。
  //
  // 蒸氣**不能**放進 CTX_PULLS_ACC —— 那個迴圈外面包著 kind !== "bath" &&
  // kind !== "swim"（「泡澡游泳不拉，那邊的配件本來就要少」），所以一進浴場整段
  // 就被跳過，寫在那裡是死碼。我第一版就是寫在那裡，實測釘 onsen 抽 400 張
  // steam 是 0 才發現。
  //
  // commit() 只驗相依字、不驗這個字本身，所以 allow() 這一關要自己過 ——
  // 跟 CTX_PULLS_ACC 那邊同樣的理由。
  const steamItem = lex.byTag.get("steam");
  const steamChance = [...used].some((t) => STEAM_HOT.has(t))
    ? 0.35
    : [...used].some((t) => STEAM_MILD.has(t))
      ? 0.15
      : 0;
  if (steamChance > 0 && steamItem && !used.has("steam") && eraOk(steamItem, era) &&
      heatOk(steamItem, heat) && gateOk(steamItem, female, male) && allow(steamItem)) {
    if (rand() < steamChance) commit("steam");
  } else if (steamChance === 0 && used.has("outdoors") && rand() < 0.15) {
    fillSlot("env", "weather");
  }
  // 傢俱。跟天氣當初一樣的病：place／in_out／weather／day_night／lighting 都有
  // 專屬的 fillSlot，只有 furniture 沒有 —— 那六個字（on bed／on chair／on couch／
  // bunk bed／on desk／under table）只能在通用的 fill("env") 裡跟另外三百多個 env
  // 字搶剩餘配額，結果整格只有 0.4% 的圖填得到，連 on bed 這種最基本的概念在
  // 5184 張的面板掃描裡都是 0。
  //
  // 同樣不能無條件填：不是每張圖都有人坐在什麼東西上。室內才擲骰子，
  // 跟天氣「室外才擲」對稱。
  //
  // **不套用 env 預設的「時代專屬優先」偏好。** 那個偏好是為了時代訊號而存在
  // （寶塔說這是古中國），但傢俱不是時代訊號 —— 沙發不會告訴人這是哪個年代，
  // 時代限制由各字自己的 era 欄過濾就夠了。套上去的後果是：現代這一格裡
  // 「時代專屬」的只有 bunk bed／on couch／on desk 三個，而前兩者之外
  // on couch 是**唯一沒有前提條件**的（on bed 要臥室類場地、bunk bed 要
  // 臥室或旅館房間、on desk 與 under table 有 NEEDS_CONTEXT），於是它把
  // 現代那一整份掃走 —— 實測佔掉這一格 53～57%，剛好在稽核那條
  //「沒有任何一格被單一個字吃掉」的 55% 上下翻面。
  //
  // 這正是那條守衛自己寫的病徵：「把一個『永遠成立』的字放進一個『有優先序』
  // 的格子，等於把那一格關掉」。拿掉偏好，六個字按各自的資格公平競爭。
  if (used.has("indoors") && rand() < 0.2) {
    fillSlot("env", "furniture", () => false);
  }
  fillSlot("env", "day_night");
  // 光源。以前沒有人明確填這一格，lighting 只能在剩下的 fill("env") 裡跟道具、
  // 天氣、天空搶名額，14 個光源 tag 加起來只有大約 3% 的機率出現 —— 而且每張
  // 圖都被無條件加上同一句 soft lighting，所以光其實都一樣。那句固定尾巴後來
  // 也拿掉了（Danbooru 0 篇，也不在 Illustrious 的訓練字彙裡），現在打光完全
  // 靠這一格真的抽到。fillSlot 的 env 預設偏好就是「時代專屬優先」，所以古代
  // 會先拿到燭光、油燈、火把。
  // 偏好用軟權重不用硬桶：fillSlot 的 env 預設偏好是硬排序（時代專屬先抽完才輪到
  // 中性），而歷史時代現在有五到九個時代光源，硬排序會把 window light、
  // sidelighting 這些中性光源整個餓死 —— 既有測試「era:[any] 燈光抽得到」
  // 就是在守這件事。四比一：時代光源仍然是主角，中性光源留得下來。
  // 聚光燈是現代專屬，本來跟天花板燈同一階（權重 4），現代九格裡它自己就到兩成。
  // 把它降到跟 sidelighting 這些中性光同一階。古代的火把、油燈仍是權重 4。
  fillSlot("env", "lighting", {
    softTiers: [(item) => eraSpecific(item, era) && item.tag !== "spotlight"],
    weights: [4, 1],
  });
  // 時代風味：非現代的時代，畫面上至少要有一個看得出年代的環境字。
  //
  // 場地那一格幫不上忙 —— 場地必須配合先抽的活動，而活動幾乎全是時代中性的現代
  // 動作，所以中性場地每次都贏（中世紀最常抽到 bedroom、park、beach，castle 只有
  // 15/400，連 eraAnchors 都被擋掉）。結果是古代場景有 95–97% 的環境字是中性的，
  // 而 park、bedroom 這種字在 WAI 裡預設就畫成現代的：江戶場景配電線桿和公園長椅。
  //
  // 這一格挑的優先是「不佔互斥格的景物」（拱門、石牆、竹子、紙燈籠）—— 它們不是
  // 場地，所以不必配合活動，也不會跟已經選好的場地打架。補詞庫只能把中世紀從
  // 0.10 拉到 0.19；真正缺的是這一格。
  //
  // 已經看得出年代就不做事，所以不會在有城堡的圖上再疊一座塔。
  if (era && era !== "modern" && !someUsed((it) => it.section === "env" && eraSpecific(it, era))) {
    const flavour = lex.bySection.env.filter((item) => eraSpecific(item, era) && allow(item));
    takeFromPool(flavour, 1, rand, commit, (item) => !item.mutex, allow, mPre);
  }
  // 時代道具：一件那個年代的東西。
  //
  // 上面那一格挑的是「場景」（石牆、拱門、竹林），這一格挑的是「東西」（香爐、
  // 古琴、戰旗、茶壺）。special_prompts 裡那三包古中國（Grok 寫的 495 個檔）每一張
  // 都同時有這兩樣，而我們原本只有場景 —— 道具雖然在詞庫裡，卻因為 env 的名額
  // 先被場地／室內外／日夜／光源用掉，每個道具只剩大約 1% 的機率露臉。
  //
  // 只在歷史時代跑：現代的「道具」是手機和遊戲手把，那本來就不缺。
  //
  // 一件年代道具是裝飾，所以它跟著 counts 走。（2026-09-25 起 counts=0 連場地、
  // 室內外、日夜、光源這些骨架也不補 —— 見 drawOne 開頭的 zeroSections。）
  // 不這樣做的話，我加的這一格會讓環境滑桿在 0~5 之間完全沒有效果。
  if (era && era !== "modern" && Number(counts.env) > 0) {
    const props = lex.bySection.env.filter(
      (item) => item.group === "other" && !item.mutex && eraSpecific(item, era) && allow(item)
    );
    takeFromPool(props, 1, rand, commit, null, allow, mPre);
  }
  // 環境段無條件補到目標數。以前這裡只在非正常模式跑，而正常模式是預設 ——
  // 左欄「環境」那個數字 2/4/10 給出一模一樣的結果，是個死的控制項。
  // fill() 算的是 want - countSection()，骨架已經達標時本來就不會多塞，
  // 所以預設值 4 的畫面幾乎不變；使用者拉到 10 才會拿到額外的環境細節，
  // 而且每一個都還是要過 allow() 的時代、室內外、場地與日夜這幾關。
  fill("env");
  stampActProps();

  if (lockOn) {
    const places = usedPlaces(used, lex);
    const needsPlace = (act) =>
      !!ACT_PLACE[act] ||
      act === "cooking" ||
      act === "driving" ||
      WATER_ACT.has(act) ||
      act === "horseback riding" ||
      act === "playing sports" ||
      act === "exercising" ||
      act === "training";
    for (const t of [...used]) {
      if (pinned.has(t)) continue;
      const it = lex.byTag.get(t);
      if (!it || it.mutex !== "activity") continue;
      if (places.size && !actFitsPlaces(t, places, real)) {
        used.delete(t);
        if (mutexTaken.get("activity") === t) mutexTaken.delete("activity");
      }
    }
    if (
      heat !== "sex" &&
      !usedActs(used, lex).size &&
      !someUsed((it) => it.mutex === "sex_act" || it.tag === "sex")
    ) {
      fillSlot("pose", "activity");
    }
    stampActProps();
  }

  {
    const guard = mustPins();
    const kind = sceneClothLocked(used, guard, lex, era, lockOn);
    if (kind) {
      const pinRel = new Set();
      for (const p of guard) {
        const pit = lex.byTag.get(p);
        if (pit) for (const r of relOf(pit)) pinRel.add(r);
      }
      // 袍子類只有在「拿掉之後還穿得上別的」時才排除。
      //
      // 第一版沒有這個條件，結果把不准裸體的情境逼到只剩裸標：維多利亞男性浴場
      // 240 張裡 226 張全裸、只勾活動也冒出 21 張裸標、tease 也被迫裸一次。
      // 袍子在那些情境是**唯一的有穿選項**，不是多餘的 —— 它對「浴場」是對的，
      // 只是對「正在洗」不對。兩者都要顧，所以條件是「有替代品才排除」。
      const dropRobes =
        washingNow(used) &&
        lex.bySection.clothing.some(
          (item) =>
            item.layer !== "skin" &&
            !NOT_WHILE_WASHING.has(item.tag) &&
            isBodyGarment(item) &&
            garmentOkForKind(item, kind, era) &&
            // 這裡不能用 allow()：要拿掉的那件袍子**此刻還佔著 onepiece 格**，
            // allow() 會因此否決所有 onepiece 的替代品，條件永遠不成立、修法整個空轉。
            // 要問的是「這個字在這個時代／熱度／性別下本來能不能用」，不是「現在這一格空不空」。
            eraOk(item, era) &&
            heatOk(item, heat) &&
            gateOk(item, female, male)
        );
      for (const t of [...used]) {
        if (guard.has(t) || pinRel.has(t)) continue;
        const it = lex.byTag.get(t);
        if (
          it &&
          it.section === "clothing" &&
          (it.layer === "garment" || it.layer === "accessory") &&
          (!garmentOkForKind(it, kind, era) ||
            (dropRobes && NOT_WHILE_WASHING.has(it.tag)))
        ) {
          used.delete(t);
          for (const g of extraMutex(it)) {
            if (mutexTaken.get(g) === t) mutexTaken.delete(g);
          }
        }
      }
      if (!someUsed((it) => it.section === "clothing" && it.layer === "skin") && !hasBodyGarment()) {
        // 服裝是在場地之前決定的，場地選到浴場之後上面那圈掃描會把衣服刪掉，
        // 這裡再補一件。池子必須包含裸標，以及不使用三種 body mutex 的完整
        // 服裝；只收 onepiece/top/bottom 曾讓部分時代的浴場補救池變成空集合。
        const pool = lex.bySection.clothing.filter(
          (item) =>
            (item.layer === "skin" || isBodyGarment(item)) &&
            garmentOkForKind(item, kind, era) &&
            allow(item)
        );
        // 正在洗就把袍子類排掉 —— 但只在還留得下「有穿的」選項時。
        // 光看 narrowed.length 不夠：那個池子含裸標，袍子拿掉之後可能只剩裸標，
        // 於是不准裸的情境被逼著裸。要看的是「還有沒有非裸標的選項」。
        if (dropRobes) {
          const narrowed = pool.filter((item) => !NOT_WHILE_WASHING.has(item.tag));
          if (narrowed.some((item) => item.layer !== "skin")) {
            pool.length = 0;
            pool.push(...narrowed);
          }
        }
        // 只勾「活動」時畫面上說好的是日常，沒有走光或做愛 —— 補救時就不該
        // 拿裸體交差。有衣服可穿就穿衣服，真的一件都沒有才退回裸標
        //（不然浴場又會變回什麼都沒交代）。實測這條沒加之前，
        // 只勾活動的 3000 張裡會漏出兩張全裸。
        // 池子空了的退路：一條浴巾。
        //
        // 中世紀男性在全年齡尺度下，浴場的每一個選項都被擋掉：wet clothes／
        // naked towel／nude 被分級擋、loincloth 和 fundoshi 也被分級擋、chemise 是
        // female-only、bathrobe 和 yukata 的時代不對。於是 4.25% 的圖**整張沒有任何
        // 衣物或裸標**（實測 85/2000，三個例子全是 bathing）。
        //
        // 唯一活得下來的是 towel：era any、gate any、全年齡不擋。但它 layer=accessory、
        // mutex 是空的，normal 模式的 fill("clothing") 根本挑不到它（那是先前查到的
        // 34 個「mutex 空的配件抽不到」之一）。
        //
        // 只在 pool 真的空的時候才補，所以其他情境一個都不受影響 —— 那些情境的
        // pool 本來就不是空的。
        if (!pool.length) {
          const towel = lex.byTag.get("towel");
          if (towel && allow(towel)) pool.push(towel);
        }
        const dressed = pool.filter((item) => item.layer !== "skin");
        const rescue = heat === "activity" && dressed.length ? dressed : pool;
        // 先照真實比例擲一次裸體，再退回服裝池。
        //
        // 上面 4800 多行那段本來就有「浴場 34% 裸」的意圖，但它問的是
        // sceneClothKind(**pinned**) —— 服裝在場地之前就決定了，那時候 used 裡還沒有
        // 浴場，所以作者只能拿 pinned 當依據。結果是：**只有使用者自己釘了浴場才會
        // 觸發**，自然抽到浴場的永遠不會。
        //
        // 實測後果（8000 張，正在洗澡的 213 張）：
        //     裸 0%      Danbooru 是 67%
        //     浴巾 6.6%  Danbooru 是 40%
        //     浴袍 23.5% Danbooru 是 0.09%   <- 浴袍是洗完才穿的
        //
        // 這裡是場地已經定了的地方，所以同一個意圖放這裡才會真的生效。
        // 機率沿用作者原本寫的 0.34，不自己另外發明一個數字。
        // 只勾「活動」時仍然不准拿裸體交差（上面那條既有規則）。
        const skins = rescue.filter((item) => item.layer === "skin");
        commitMeta.source = SOURCES.repair;
        commitMeta.stage = STAGES.repair;
        if (kind === "bath" && heat !== "activity" && skins.length && rand() < 0.34) {
          takeFromPool(skins, 1, rand, commit, null, allow, mPre);
        } else {
          takeFromPool(rescue, 1, rand, commit, clothingPrefer, allow, mPre);
        }
        commitMeta.source = SOURCES.random;
        commitMeta.stage = STAGES.fill;
      }
      for (const t of [...used]) {
        if (pinned.has(t)) continue;
        const it = lex.byTag.get(t);
        if (!it) continue;
        const cloth = [];
        for (const x of used) {
          if (lex.byTag.get(x)?.section === "clothing") cloth.push(x);
        }
        const badAction =
          needsClothingDependency(it) &&
          actionFitsClothes(t, cloth) === 0;
        if (!badAction) continue;
        used.delete(t);
        for (const g of extraMutex(it)) {
          if (mutexTaken.get(g) === t) mutexTaken.delete(g);
        }
      }
      if (heat === "flash" && !someUsed((it) => it.mutex === "clothes_action" || it.group === "flash")) {
        fillSlot("pose", "clothes_action", [
          (item) => actionFitsWorn(item) === 2,
          (item) => actionFitsWorn(item) === 1,
        ]);
        if (!someUsed((it) => it.mutex === "clothes_action" || it.group === "flash")) {
          fillGroup("pose", "flash");
        }
      }
      if (heat === "sex" && people === 1 && !someUsed((it) => soloSex(it.tag))) {
        const acts = lex.bySection.pose.filter((item) => soloSex(item.tag) && allow(item));
        takeFromPool(acts, 1, rand, commit, null, allow, mPre);
      }
    }
  }

  {
    // 上衣有了、下著沒有。hasBodyGarment() 看到一件 top 就算通過，所以沒有任何
    // 一步會去補裙子；victorian 有六件上衣、bottom 池卻只有一條真裙子，畫出來
    // 就是上半身穿好、下半身什麼都沒交代。
    const lowerMut = new Set();
    let lowerSkin = false;
    for (const t of used) {
      const it = lex.byTag.get(t);
      if (!it || it.section !== "clothing") continue;
      if (it.layer === "skin") lowerSkin = true;
      const slot = bodyGarmentSlot(it);
      if (slot) lowerMut.add(slot);
    }
    const lowerCovered =
      lowerMut.has("bottom") ||
      lowerMut.has("onepiece") ||
      someUsed((it) => coversLowerBody(it));
    if (!lowerSkin && lowerMut.has("top") && !lowerCovered) {
      const kind = sceneClothLocked(used, mustPins(), lex, era, lockOn);
      const pool = lex.bySection.clothing.filter(
        (item) =>
          item.layer === "garment" &&
          bodyGarmentSlot(item) === "bottom" &&
          (!kind || garmentOkForKind(item, kind, era)) &&
          allow(item)
      );
      takeFromPool(pool, 1, rand, commit, clothingPrefer, allow, mPre);
    }
  }

  fill("pose", (item) => {
    if (people >= 2 && soloSex(item.tag)) return false;
    if ((heat === "sex" || hasSexAct) && item.mutex === "activity" && !SEX_OK_ACTIVITY.has(item.tag)) return false;
    return true;
  });
  if (heat === "sex" && people === 1 && !someUsed((it) => soloSex(it.tag))) {
    for (const t of [...used]) {
      if (pinned.has(t)) continue;
      if (!BOTH_ARMS.has(t)) continue;
      const it = lex.byTag.get(t);
      used.delete(t);
      if (it) {
        for (const g of extraMutex(it)) {
          if (mutexTaken.get(g) === t) mutexTaken.delete(g);
        }
      }
    }
    const acts = lex.bySection.pose.filter((item) => soloSex(item.tag) && allow(item));
    takeFromPool(acts, 1, rand, commit, null, allow, mPre);
  }
  // 四肢都沒了，自慰和單人拳交都不成立。貞操帶是另一件事：下體鎖著就不要硬補插入。
  // 只在完全沒有動作時，從這份不用手的清單補一個。新的單人體位（灌腸、植卵）
  // 不自動塞進來，避免以後每加一個字就改寫這條補法。
  if (
    heat === "sex" &&
    people === 1 &&
    used.has("quadruple amputee") &&
    !used.has("chastity belt") &&
    !someUsed((it) => soloSex(it.tag) || it.mutex === "sex_act" || it.tag === "sex")
  ) {
    const acts = lex.bySection.pose.filter((item) => AMPUTEE_HANDLESS.has(item.tag) && allow(item));
    takeFromPool(acts, 1, rand, commit, null, allow, mPre);
  }

  if (
    [...usedActs(used, lex)].some(
      (a) => WATER_ACT.has(a) && a !== "fishing" && a !== "wading"
    )
  ) {
    for (const t of [...used]) {
      if (pinned.has(t)) continue;
      if (
        t === "boots" ||
        t === "sneakers" ||
        t === "high heels" ||
        t === "shoes" ||
        t === "necktie" ||
        t === "bowtie" ||
        t === "armor" ||
        t === "plate armor" ||
        t === "japanese armor" ||
        t === "suit" ||
        t === "blazer" ||
        t === "lab coat"
      ) {
        const it = lex.byTag.get(t);
        used.delete(t);
        if (it) {
          for (const g of extraMutex(it)) {
            if (mutexTaken.get(g) === t) mutexTaken.delete(g);
          }
        }
      }
    }
    if (used.has("swimming") || used.has("diving")) {
      for (const t of [...used]) {
        if (pinned.has(t)) continue;
        if (t === "sandals") used.delete(t);
      }
    }
  }
  // 全裸的人不會有「被遮住的乳頭」或「被遮住的肚臍」。
  //
  // 這兩個字是 feature，在 clothing 之前就抽好了，所以候選那一關問不到「後面會不會
  // 抽到裸體」—— 跟 5236 行記的那個順序陷阱同一類，只能在這裡反向清掉。
  // 實測：出現「隔著衣服」類字的 217 張裡有 8 張身上根本沒有遮身體的衣服，
  // 而那 8 張全部是 covered nipples 配 nude／completely nude。
  if (used.has("nude") || used.has("completely nude")) {
    for (const t of ["covered nipples", "covered navel"]) {
      if (used.has(t) && !pinned.has(t)) used.delete(t);
    }
  }
  if (lockOn && used.has("cooking") && !used.has("kitchen")) {
    const kit = lex.byTag.get("kitchen");
    if (kit && eraOk(kit, era)) {
      // 先把原本的場地拿掉（廚房要那一格），廚房放不進去就還原 —— 不管是誰擋的，
      // 都不能留下一張沒有場地的圖。
      const removed = [];
      for (const t of [...used]) {
        if (pinned.has(t)) continue;
        const it = lex.byTag.get(t);
        if (!it) continue;
        if (it.mutex === "place" || it.group === "place" || t === "outdoors") {
          used.delete(t);
          const freed = [];
          for (const g of extraMutex(it)) {
            if (mutexTaken.get(g) === t) {
              mutexTaken.delete(g);
              freed.push(g);
            }
          }
          removed.push([t, freed]);
        }
      }
      if (!(allow(kit) && commit("kitchen"))) {
        for (const [t, freed] of removed) {
          used.add(t);
          for (const g of freed) if (!mutexTaken.has(g)) mutexTaken.set(g, t);
        }
      }
    }
  }
  if (
    lockOn &&
    (used.has("breasts on table") || used.has("breasts on glass")) &&
    used.has("outdoors") &&
    !used.has("indoors")
  ) {
    for (const t of [...used]) {
      if (pinned.has(t)) continue;
      const it = lex.byTag.get(t);
      if (t === "outdoors" || (it?.implies || []).includes("outdoors")) {
        used.delete(t);
        if (it) {
          for (const g of extraMutex(it)) {
            if (mutexTaken.get(g) === t) mutexTaken.delete(g);
          }
        }
      }
    }
    const inn = lex.byTag.get("indoors");
    if (inn && allow(inn)) commit("indoors");
  }
  {
    const places = usedPlaces(used, lex);
    const onBed = used.has("on bed") || used.has("bed sheet");
    if (onBed && places.size && ![...places].some((p) => BED_PLACE.has(p))) {
      for (const t of ["on bed", "bed sheet"]) {
        if (pinned.has(t) || !used.has(t)) continue;
        const it = lex.byTag.get(t);
        used.delete(t);
        if (it) {
          for (const g of extraMutex(it)) {
            if (mutexTaken.get(g) === t) mutexTaken.delete(g);
          }
        }
      }
    }
  }
  // ===========================================================================
  // 收尾階段：全部填完、reconcile() 之前。
  //
  // 「這個字配不配得上場面」的規則要放這裡，不要放 allow()。
  //
  // 原因是順序：allow() 在每一格被填的當下呼叫，而那時候後面的格子還沒填。
  // 服裝在 fill("clothing") 就定了，場地 fillSlot("env","place")、
  // 活動 fillSlot("pose","activity")、脫衣動作都排在它後面 —— 所以在 allow() 裡
  // 問「身上有沒有那個場合」，答案永遠是沒有。
  //
  // 這個坑這一輪踩了兩次：
  //   配件的場合檢查寫進 allow()，五個字直接變成永遠抽不到，六套測試全綠。
  //   內衣的「看不看得見」需要知道有沒有脫衣動作，那也是之後才決定的。
  //
  // 辨認方法：規則要看的東西，是不是在這個字被抽的當下就已經定了？
  //   已經定了（互斥格、性別、時代、熱度）-> allow()
  //   要等別的格子（場地、活動、姿勢、脫衣）-> 這裡
  //
  // 這裡的每一段都要：用 mustPins() 當護身符（釘選與必抽不能刪），
  // 刪字時一併清掉 mutexTaken，並且量「還抽不抽得到」而不是只量「壞的不見了」。
  // ===========================================================================

  // 一男一女又真的在做，就補上 hetero。
  //
  // Danbooru 上標了「1girl 1boy sex」的圖有 **98.9%** 同時帶 hetero
  // （282,780 / 285,992），所以模型看那組字的時候，hetero 幾乎一定在場。
  // 我們一直沒給，等於少了它最熟悉的那一個配對訊號。
  //
  // 之所以會漏，是因為 hetero 的 section 是 subject，而 drawOne() 刻意沒有
  // fill("subject")（主體段整段由 chooseCast 決定人數，見 QUOTA_SECTIONS 的註解）。
  // 那個設計對「人數」是對的，但把 hetero 這種**配對描述**一起排除掉了。
  //
  // yuri 不跟 hetero 一樣無條件補：「2girls sex」只有 6.6% 帶 yuri。
  // 完全不抽又會讓這個字只剩釘選。另開一條亂數，大約一成的多女、沒有男生的圖才補，
  // 不消耗主亂數，沒抽到的種子後面的衣服姿勢照舊。
  //
  // 只在有性行為時補 hetero。純粹一男一女同框（沒有性）在 Danbooru 上是 58%，
  // 不夠高到可以無條件加。
  if (female && male && !used.has("hetero") && lex.byTag.has("hetero")) {
    const doingIt = [...used].some((t) => {
      const it = lex.byTag.get(t);
      return it && (it.mutex === "sex_act" || it.group === "sex");
    });
    if (doingIt) commit("hetero");
  }
  if (
    Number.isFinite(seed) &&
    female &&
    !male &&
    people >= 2 &&
    !used.has("yuri") &&
    !banned.has("yuri")
  ) {
    const yuriRand = mulberry32(((seed >>> 0) ^ 0x79757269) >>> 0);
    const item = lex.byTag.get("yuri");
    if (item && yuriRand() < 0.1 && allow(item)) commit("yuri");
  }
  // multiple girls 的 implies 是 2girls。三人以上再補會跟人數格打架，所以只在正好兩女時抽。
  if (Number.isFinite(seed) && used.has("2girls") && !used.has("multiple girls") && !banned.has("multiple girls")) {
    const r = mulberry32(((seed >>> 0) ^ 0x6d676972) >>> 0);
    const item = lex.byTag.get("multiple girls");
    if (item && r() < 0.4 && allow(item)) commit("multiple girls");
  }
  if (Number.isFinite(seed) && used.has("2boys") && !used.has("3boys") && !used.has("multiple boys") && !banned.has("multiple boys")) {
    const r = mulberry32(((seed >>> 0) ^ 0x6d626f79) >>> 0);
    const item = lex.byTag.get("multiple boys");
    if (item && r() < 0.4 && allow(item)) commit("multiple boys");
  }
  // 乳貼、運動服沒有互斥格。放進一般衣服池會跟時代衣服同一階，400 張裡八成都會中。
  // 另開一條亂數，沒中的種子主亂數不動。服裝張數 0 就是不要衣服，這裡不能再補。
  // 乳貼只在胸口露得出來時考慮：沒有上衣／連身／胸罩，或已經掀開、走光、裸體。
  // 運動服只在真的有運動場合時考慮，避免蓋到西裝和旗袍上。
  if (Number.isFinite(seed) && Math.max(0, Number(counts.clothing) || 0) > 0) {
    let chestCovered = false;
    let chestOpen = false;
    let sportCtx = false;
    for (const t of used) {
      if (CHEST_OPEN_TAGS.has(t)) chestOpen = true;
      if (SPORTWEAR_NEEDS.has(t)) sportCtx = true;
      const it = lex.byTag.get(t);
      if (!it) continue;
      if (it.layer === "skin") chestOpen = true;
      if (
        it.layer === "garment" &&
        t !== "pasties" &&
        (it.mutex === "top" || it.mutex === "onepiece" || it.mutex === "underwear_top")
      ) {
        chestCovered = true;
      }
    }
    const r = mulberry32(((seed >>> 0) ^ 0x70617374) >>> 0);
    if ((!chestCovered || chestOpen) && r() < 0.22) {
      const opts = [];
      for (const t of ["pasties", "cross pasties"]) {
        const item = lex.byTag.get(t);
        if (item && !used.has(t) && !banned.has(t) && allow(item)) opts.push(item);
      }
      if (opts.length) commit(opts[Math.floor(r() * opts.length)].tag);
    }
    if (!chestCovered || chestOpen) {
      const tasselRand = mulberry32(((seed >>> 0) ^ 0x74617373) >>> 0);
      const tassels = lex.byTag.get("nipple tassels");
      if (
        tassels &&
        !used.has("nipple tassels") &&
        !used.has("pasties") &&
        !banned.has("nipple tassels") &&
        tasselRand() < 0.1 &&
        allow(tassels)
      ) {
        commit("nipple tassels");
      }
    }
    const sport = lex.byTag.get("sportswear");
    if (sport && sportCtx && !used.has("sportswear") && !banned.has("sportswear") && r() < 0.3 && allow(sport)) {
      commit("sportswear");
    }
  }
  // 沒有互斥格的包、瓶底眼鏡、保險套、玩具。放進衣服池會跟時代衣服搶同一階。
  // 另開亂數；沒中的種子，主亂數和前面的衣服姿勢都不動。
  // 寫字夾板、陽傘、O 環不在這裡：那些場合並不代表一定有那個東西。
  if (Number.isFinite(seed) && Math.max(0, Number(counts.clothing) || 0) > 0) {
    const r = mulberry32(((seed >>> 0) ^ 0x61636373) >>> 0);
    const pick = (names) => {
      const opts = [];
      for (const t of names) {
        const item = lex.byTag.get(t);
        if (item && !used.has(t) && !banned.has(t) && allow(item)) opts.push(item);
      }
      if (!opts.length) return;
      commit(opts[Math.floor(r() * opts.length)].tag);
    };
    // 包和瓶底眼鏡是這一段才補的，浴場白名單已經掃過了。
    // 不擋的話，溫泉和游泳會重新戴上剛被脫掉的包。眼鏡可以下水，瓶底眼鏡不行。
    const clothKind = sceneClothLocked(used, mustPins(), lex, era, lockOn);
    const inWater = clothKind === "bath" || clothKind === "swim";
    if (!mutexTaken.has("bag") && !inWater && r() < 0.12) pick(["bag", "handbag"]);
    if (male && !mutexTaken.has("eyewear") && !inWater && r() < 0.1) {
      pick(["coke-bottle glasses"]);
    }
    if (heat === "sex" && male && r() < 0.2) {
      pick(["holding condom", "condom wrapper", "condom box", "condom in mouth"]);
    }
    if (heat === "sex" && male && [...used].some((t) => SEX_PHASE_AFTER.has(t)) && r() < 0.35) {
      pick(["used condom"]);
    }
    // 假陽具的熱度寫了誘惑和走光，但它 implies 的「性玩具」被鎖成只有性愛。
    // commit 會把父字一起放進來，父字過不了熱度，整筆就失敗。震動棒本來也只有性愛。
    // 所以玩具只在性愛補，不在誘惑和走光空轉一顆骰子。
    if (heat === "sex" && r() < 0.16) {
      pick(["dildo", "vibrator", "egg vibrator", "strap-on", "vibrator cord", "vibrator in thighhighs", "vibrator on nipple"]);
    }
  }
  // 口塞、分腿棍、公共跳蛋沒有衣服白名單上的互斥格。另開亂數，不挪動上面那條玩具骰子。
  if (Number.isFinite(seed) && heat === "sex" && Math.max(0, Number(counts.clothing) || 0) > 0) {
    const gearRand = mulberry32(((seed >>> 0) ^ 0x6b696e6b) >>> 0);
    if (gearRand() < 0.1) {
      const opts = [];
      for (const t of ["gag", "tape gag", "bit gag", "ring gag", "spreader bar", "public vibrator"]) {
        const item = lex.byTag.get(t);
        if (item && !used.has(t) && !banned.has(t) && allow(item)) opts.push(item);
      }
      if (opts.length) commit(opts[Math.floor(gearRand() * opts.length)].tag);
    }
  }
  // 枷鎖、搾乳也沒有白名單上的互斥格。不塞進上面那個池，口塞的比例才不會被稀釋。
  if (Number.isFinite(seed) && heat === "sex" && Math.max(0, Number(counts.clothing) || 0) > 0) {
    const lockRand = mulberry32(((seed >>> 0) ^ 0x6c6f636b) >>> 0);
    if (lockRand() < 0.08) {
      const opts = [];
      for (const t of ["pillory", "stocks", "restraints", "milking machine", "breast pump"]) {
        const item = lex.byTag.get(t);
        if (item && !used.has(t) && !banned.has(t) && allow(item)) opts.push(item);
      }
      if (opts.length) commit(opts[Math.floor(lockRand() * opts.length)].tag);
    }
  }
  // 繩子比枷鎖常見。不塞進上面那個池，枷鎖的比例才不會被繩子吃掉。
  if (Number.isFinite(seed) && heat === "sex" && Math.max(0, Number(counts.clothing) || 0) > 0) {
    const ropeRand = mulberry32(((seed >>> 0) ^ 0x726f7065) >>> 0);
    if (ropeRand() < 0.1) {
      const opts = [];
      for (const t of ["rope", "shackles", "chain leash", "nipple rings", "nipple bar", "speculum", "nose hook"]) {
        const item = lex.byTag.get(t);
        if (item && !used.has(t) && !banned.has(t) && allow(item)) opts.push(item);
      }
      if (opts.length) commit(opts[Math.floor(ropeRand() * opts.length)].tag);
    }
  }
  // 光環、穿孔、OK繃、臂章、針沒有互斥格。放進衣服池會跟時代衣服同一階，幾乎每張都中。
  // 另開亂數，大約一成的圖補一件。浴場不補，免得剛脫掉又戴回去。
  if (Number.isFinite(seed) && Math.max(0, Number(counts.clothing) || 0) > 0) {
    const accRand = mulberry32(((seed >>> 0) ^ 0x68616c6f) >>> 0);
    const accKind = sceneClothLocked(used, mustPins(), lex, era, lockOn);
    if (accKind !== "bath" && accKind !== "swim" && accRand() < 0.1) {
      const opts = [];
      for (const t of ["halo", "piercing", "ear piercing", "tongue piercing", "bandaid", "armband", "needle", "belly chain", "nose ring"]) {
        const item = lex.byTag.get(t);
        if (item && !used.has(t) && !banned.has(t) && allow(item)) opts.push(item);
      }
      if (opts.length) commit(opts[Math.floor(accRand() * opts.length)].tag);
    }
  }
  // 假獸耳很常見，但不佔帽子格，也不暗示真的獸耳。另開一顆骰子。
  if (Number.isFinite(seed) && Math.max(0, Number(counts.clothing) || 0) > 0) {
    const earRand = mulberry32(((seed >>> 0) ^ 0x65617273) >>> 0);
    const earKind = sceneClothLocked(used, mustPins(), lex, era, lockOn);
    const ears = lex.byTag.get("fake animal ears");
    if (
      ears &&
      earKind !== "bath" &&
      earKind !== "swim" &&
      !used.has("fake animal ears") &&
      !banned.has("fake animal ears") &&
      earRand() < 0.18 &&
      allow(ears)
    ) {
      commit("fake animal ears");
    }
  }
  {
    const tusks = lex.byTag.get("tusks");
    if (Number.isFinite(seed) && tusks && !used.has("tusks") && !banned.has("tusks") && allow(tusks)) {
      const r = mulberry32(((seed >>> 0) ^ 0x7475736b) >>> 0);
      if (r() < 0.45) commit("tusks");
    }
  }

  // 四人、五人在性愛時直接補上人數標籤。五人幾乎不會從姿勢池自己抽到
  // （要 people>=5，而權重表沒有五人），所以升級或釘選之後在這裡蓋章。
  if (heat === "sex" && people >= 5 && !used.has("fivesome")) {
    const it = lex.byTag.get("fivesome");
    if (it && allow(it)) commit("fivesome");
  }
  if (heat === "sex" && people === 4 && !used.has("fivesome") && !used.has("foursome")) {
    const it = lex.byTag.get("foursome");
    if (it && allow(it)) commit("foursome");
  }

  // 正向的一半：場合已經定了，把跟它成對的配件拉進來。
  // 泡澡游泳不拉 —— 那邊的配件本來就要少，不是要多。
  {
    const kind = sceneClothLocked(used, mustPins(), lex, era, lockOn);
    // 使用者把服裝目標數設成 0，就是不要衣服。這一段是在額度花完之後才 commit 的，
    // 不擋的話會直接跨過那個 0（實測釘住場合時 1000 張裡有 442 張冒出配件）。
    //
    // 旁邊的 stampActProps() 有同樣的問題 —— 釘 singing、服裝設 0，microphone
    // 照樣 300/300 出現，新舊版都一樣。那是既有行為，不在這次動的範圍，
    // 但新加的東西不該拿它當藉口。
    const clothBudget = Math.max(0, Math.min(10, Number(counts.clothing) || 0));
    if (clothBudget > 0 && kind !== "bath" && kind !== "swim") {
      for (const [ctx, acc, chance] of CTX_PULLS_ACC) {
        if (!used.has(ctx) || used.has(acc)) continue;
        const item = lex.byTag.get(acc);
        if (!item) continue;
        if (!eraOk(item, era) || !heatOk(item, heat) || !gateOk(item, female, male)) continue;
        // 用 allow() 而不是自己再寫一遍條件。commit() 只驗相依字、不驗這個字本身，
        // 所以這一關得自己過 —— 但要過的是既有那一關，不是我另外寫的一關。
        // （例如 allow() 裡有「性愛熱度不要隨機抽入拳擊手套」那條，自己寫會漏掉。）
        if (!allow(item)) continue;
        if (rand() < chance) commit(acc);
      }
    }
    // 毛巾在浴場白名單裡，但上面那段刻意跳過浴場，所以自然抽到浴場時毛巾仍是 0。
    // 只裹毛巾是衣服，跟這條配件不是同一個字。
    if (clothBudget > 0 && kind === "bath" && !used.has("towel") && !banned.has("towel")) {
      const towel = lex.byTag.get("towel");
      if (towel && allow(towel) && rand() < 0.4) commit("towel");
    }
  }

  // 運動器材。刻意**不掛**任何額度：器材跟 stampActProps() 蓋的道具是同一件事
  // （這個活動需要的那個東西），而平底鍋也不看 counts。實測 counts.env 設 0
  // 時場地、晝夜、光源、傢俱全部照常出現（它們走 fillSlot，本來就繞過額度），
  // 所以那個數字的語意是「通用補牌要補幾個」，不是「env 字上限」——
  // 把球拍掛上去等於用一個管不到別人的閘門去管它。
  {
    for (const [act, gear, chance] of CTX_PULLS_GEAR) {
      if (!used.has(act) || used.has(gear)) continue;
      const item = lex.byTag.get(gear);
      if (!item) continue;
      if (!eraOk(item, era) || !heatOk(item, heat) || !gateOk(item, female, male)) continue;
      // 跟上面那個迴圈同樣的理由：要過的是既有的 allow()，不是我另外寫的一關。
      // 運動那邊的 sportKitOk／sportGearPlaceOk／「沒有運動身分就不給器材」
      // 都在裡面，自己寫一定會漏。
      if (!allow(item)) continue;
      if (rand() < chance) commit(gear);
    }
  }

  // 全身穿好了還標著內衣，而且沒有任何脫衣或裸露的動作 —— 那件內衣看不見。
  //
  // Danbooru 上標 panties 的意思是「畫面上看得見」，所以「軍服＋panties」在訓練集
  // 裡代表掀起來或脫一半，不是「裡面穿著內褲」。實測釘女僕裝 600 張，100% 帶著內衣，
  // 其中 31% 連一個脫衣/裸露的動作都沒有。
  //
  // 跟配件那一段同樣的理由放在這裡而不是 allow()：脫衣動作是在服裝之後才決定的，
  // 在 allow() 裡看不到。
  {
    const guard = mustPins();
    const exposed = [...used].some((t) => {
      const it = lex.byTag.get(t);
      if (!it) return false;
      return it.mutex === "clothes_action" || it.group === "flash" ||
             it.group === "sex" || it.layer === "skin";
    });
    if (!exposed) {
      // 「是不是內衣」兩邊必須用同一個判準，否則同一件衣服會既算遮蔽物又算被遮的內衣，
      // 然後把自己刪掉。loincloth 就是這樣：mutex=underwear_bottom 但 group=era，
      // 於是「遮蔽物要排除 group==underwear」放它過關，「要刪的內衣看 mutex」又抓住它。
      // 中世紀浴場只剩兜襠布當身體交代時，它把自己刪光，圖裡就沒人說身上有什麼了 ——
      // 既有測試「只勾活動時浴場仍然交代得出身體」抓到的就是這一張。
      const isUnderwearItem = (it) =>
        !!it && (it.mutex === "underwear_top" || it.mutex === "underwear_bottom" ||
                 it.group === "underwear");
      const covered = [...used].some((t) => {
        const it = lex.byTag.get(t);
        // 「只穿內衣」自己佔連身格，coversLowerBody 會把它當成外衣。
        // 那一句的意思正好相反：內衣就是身上的衣服，不該拿它當理由把內衣刪掉。
        return it && t !== "underwear only" && coversLowerBody(it) && !isUnderwearItem(it);
      });
      if (covered) {
        for (const t of [...used]) {
          if (guard.has(t)) continue;
          const it = lex.byTag.get(t);
          if (!it || it.section !== "clothing") continue;
          if (!isUnderwearItem(it)) continue;
          used.delete(t);
          for (const g of extraMutex(it)) {
            if (mutexTaken.get(g) === t) mutexTaken.delete(g);
          }
        }
      }
    }
  }

  // 配件的場合檢查要放在這裡，不能放在 allow()。
  //
  // 我第一版放在 allow() 裡，結果 animal collar 86->0、leash 19->0、clipboard 15->0、
  // knee pads 13->0、handcuffs 14->0 —— 全部變成永遠抽不到。原因是順序：
  // 衣服在 fill("clothing") 就填完了，而場地 fillSlot("env","place") 和活動
  // fillSlot("pose","activity") 都在那之後才跑。allow() 看到的 used 裡根本還沒有
  // 場地和活動，「沒有場合」這個條件於是永遠成立。
  //
  // police hat 要 policewoman、nurse cap 要 nurse 之所以沒事，純粹是因為那兩個是
  // 職業，在 fillSlot("feature","job") 就定了 —— 剛好排在衣服前面。我照抄那個寫法，
  // 卻沒注意到它依賴的是排序而不是規則本身。
  //
  // 這裡是全部填完、reconcile() 之前，該知道的都知道了。旁邊的 ACT_PROP 收尾
  // 用的就是同一個位置和同一個手法。
  {
    // mustPins() 而不是 pinned：必抽抽到的字跟釘選一樣不能被刪掉。
    const guard = mustPins();
    for (const [tag, need] of Object.entries(NEEDS_CONTEXT)) {
      if (!used.has(tag) || guard.has(tag)) continue;
      if ([...used].some((t) => need.has(t))) continue;
      const it = lex.byTag.get(tag);
      used.delete(tag);
      if (it) {
        for (const g of extraMutex(it)) {
          if (mutexTaken.get(g) === tag) mutexTaken.delete(g);
        }
      }
    }
  }
  {
    const acts = usedActs(used, lex);
    const needed = new Set();
    for (const a of acts) {
      for (const p of ACT_PROP[a] || []) needed.add(p);
    }
    for (const [act, props] of Object.entries(ACT_PROP)) {
      if (acts.has(act)) continue;
      for (const p of props) {
        if (pinned.has(p) || needed.has(p)) continue;
        const it = lex.byTag.get(p);
        used.delete(p);
        if (it) {
          for (const g of extraMutex(it)) {
            if (mutexTaken.get(g) === p) mutexTaken.delete(g);
          }
        }
      }
    }
  }

  // 上面已不再把「只穿內衣」當成外衣。這裡補的是另一種空話：
  // 沒有互斥格的布料和襪子把衣服額度填滿，內衣從頭就沒抽到。
  // 水景不補。已經有外衣遮住下半身的也不補，免得內褲塞回衣服底下。
  if (used.has("underwear only") && !isBathScene(used) && !isSwimScene(used)) {
    const wornUw = (it) =>
      !!it &&
      it.group === "underwear" &&
      !it.tag.startsWith("no ") &&
      it.tag !== "panties aside" &&
      it.tag !== "panties around one leg" &&
      it.tag !== "bra visible through clothes";
    const hasUnder = [...used].some((t) => wornUw(lex.byTag.get(t)));
    const covered = [...used].some((t) => {
      const it = lex.byTag.get(t);
      return it && t !== "underwear only" && coversLowerBody(it) && it.group !== "underwear" &&
        it.mutex !== "underwear_top" && it.mutex !== "underwear_bottom";
    });
    if (!hasUnder && !covered) {
      const pool = lex.bySection.clothing.filter((item) => wornUw(item) && allow(item));
      takeFromPool(pool, 1, rand, commit, null, allow, mPre);
    }
  }

  const enteredUsed = tracer.enabled ? new Set(used) : used;
  const kept = reconcile(lex, used, female, male, people, mustPins(), lockOn);

  // NEEDS_CONTEXT 要在 reconcile **之後**再掃一次。
  //
  // 上面那次掃在 reconcile 之前，該知道的都知道了 —— 但 reconcile 自己還會再刪東西
  // （最明顯的是 lockScene 會刪掉沒有場地的活動），於是前提在掃完之後才消失，
  // 道具就變成孤兒。這正是 test_draw_contracts.mjs 契約一開頭描述的那一類：
  // 「擋在候選階段，但最終 POS 是 reconcile() 之後才定案的」。
  //
  // 實測是 desk lamp 露出來的：它的前提多半是 studying／reading 這類活動，
  // 而那些活動被 lockScene 刪掉之後，檯燈就留在浴缸和餐廳裡。
  // 掃第二次只會刪掉真的沒有前提的字，所以對其餘十八條也只有好處。
  {
    const guard = mustPins();
    for (const [tag, need] of Object.entries(NEEDS_CONTEXT)) {
      if (!kept.has(tag) || guard.has(tag)) continue;
      if ([...kept].some((t) => need.has(t))) continue;
      kept.delete(tag);
    }
  }

  // 「只穿內衣」沒有內衣就是一句空話。
  //
  // 浴場與性愛場景會把內衣脫掉（那是對的 —— 沒有人穿內衣泡澡），但那個字留了下來，
  // 畫面上就變成「只穿內衣」卻一件內衣都沒有。實測釘住它抽 600 張有 114 張這樣，
  // 全部是現代的浴場（bathing／bubble bath）或性愛場景。
  //
  // 這裡連明確釘選一起清，所以不能走上面那個 NEEDS_CONTEXT 迴圈（它有 mustPins()
  // 護著）。理由跟「洗澡當下不再穿袍子」同一條：場景說了算，而卡片上的
  // 「釘選未入」會把這件事告訴使用者，不是無聲吃掉。
  if (kept.has("underwear only")) {
    const stillUnderwear = [...kept].some((t) => lex.byTag.get(t)?.group === "underwear");
    if (!stillUnderwear) kept.delete("underwear only");
  }
  // 衣服底下的泳裝自己不是那件衣服。吊襪帶和過膝襪有互斥格，但不是蓋住它的外衣。
  if (kept.has("swimsuit under clothes")) {
    const outer = [...kept].some((t) => {
      if (t === "swimsuit under clothes") return false;
      const it = lex.byTag.get(t);
      return it && it.section === "clothing" && it.layer === "garment" && UNDERWEAR_ONLY_BAD.has(it.group);
    });
    if (!outer) kept.delete("swimsuit under clothes");
  }

  const quality = lex.data.quality.slice();
  const style = [];
  const subject = [];
  const feature = [];
  const pose = [];
  const clothing = [];
  const env = lex.data.alwaysEnv.slice();
  const bucket = { subject, feature, pose, clothing, env };

  for (const t of cast) {
    if (kept.has(t) && !subject.includes(t)) subject.push(t);
  }
  if (people === 1 && !subject.includes("solo") && (pinned.has("solo") || (!pinned.has("solo focus") && !subject.includes("solo focus")))) subject.push("solo");

  for (const tag of kept) {
    const item = lex.byTag.get(tag);
    if (!item) continue;
    if (item.section === "subject") {
      if (!subject.includes(tag)) subject.push(tag);
    } else if (item.section === "quality") {
      if (!quality.includes(tag) && !style.includes(tag)) style.push(tag);
    } else if (bucket[item.section] && !bucket[item.section].includes(tag)) {
      bucket[item.section].push(tag);
    }
  }
  // 在自己家裡的場景不會有人群：隨機抽到、後來又進了私人場地的人群拿掉（釘的人群那種場地本來就進不來）。
  if (env.some((t) => CROWD_BAD_PLACE.has(t))) {
    for (let i = env.length - 1; i >= 0; i--) if (CROWD_TAGS.has(env[i]) && !pinned.has(env[i])) env.splice(i, 1);
  }
  // 釘了 solo 就是要畫面上只有一個人：隨機抽到的人群拿掉，不要反過來把 solo 換成 solo focus。
  if (pinned.has("solo")) {
    for (let i = env.length - 1; i >= 0; i--) if (CROWD_TAGS.has(env[i]) && !pinned.has(env[i])) env.splice(i, 1);
  }
  // 有人群（crowd／people）：畫面上不只一個人，只是焦點在一個主角身上 ——
  // Danbooru 用 solo focus，不是 solo（solo 是「畫面上只有一個人」）。要等上面各段都填好才看得到人群。
  if (env.some((t) => CROWD_TAGS.has(t))) {
    const i = subject.indexOf("solo");
    if (i >= 0 && !pinned.has("solo")) subject.splice(i, 1);
    if (people === 1 && !subject.includes("solo focus")) subject.push("solo focus");
  }
  // reconcile 在單人時會補回 solo。釘了單人焦點就是不要再寫 solo。
  if (subject.includes("solo focus") && !pinned.has("solo")) {
    const i = subject.indexOf("solo");
    if (i >= 0) subject.splice(i, 1);
  }
  // 尾巴就是滑桿選的那一級。選色情就寫 nsfw, explicit。
  //
  // 這裡曾經是「照實際抽到的內容推一級出來，滑桿只當上限」，動機是實測到
  // 尺度=活動 時 100% 的圖沒有任何情色內容卻都標著 explicit —— 一張穿好衣服在
  // 超市買東西的圖配上 nsfw, explicit，那個組合在訓練標註裡不存在。
  //
  // 但那個設計的代價更大，而且是專案主自己發現的：預設尺度（混合）在色情模式下，
  // 2000 張裡只有 22% 真的寫了 explicit，57% 寫成 sfw, general。選了色情卻拿到
  // 全年齡的標註，比偶爾標過頭難接受得多 —— 而且判準本身還會漏字（breast bondage、
  // breasts on glass、grabbing another's breast 都被判成 general）。
  //
  // 漏字那件事仍然值得修，但那是詞庫分類的問題；尾巴該不該由內容決定是另一回事，
  // 這裡照專案主的決定走：滑桿說了算。
  const shownRating = rating;
  const nsfw =
    shownRating === "explicit"
      ? lex.data.nsfwTail
      : shownRating === "sensitive"
        ? lex.data.sensitiveTail || []
        : lex.data.sfwTail || [];
  const ordered = [...subject, ...feature, ...clothing, ...pose, ...env, ...nsfw, ...style, ...quality];
  const seen = new Set();
  const positive = [];
  for (const t of ordered) {
    if (seen.has(t)) continue;
    seen.add(t);
    positive.push(t);
  }
  const shadowViolations = validateSupportShadow({
    tags: positive,
    pinned,
    mode: sceneMode,
    people,
  });

  const mustReport = mustWants.map(({ key, section, group, want, inKey }) => {
    let got = 0;
    for (const t of positive) {
      if (inKey(lex.byTag.get(t))) got += 1;
    }
    return { key, section, group, want, got };
  });

  let trace = null;
  if (tracer.enabled) {
    const final = new Set(positive);
    const { removed } = diffKept(enteredUsed, final);
    rejectRemoved(tracer, removed, {
      sourceOf: (t) => tagSources.get(t) || SOURCES.random,
      reason: REASONS.reconcile,
      stage: STAGES.reconcile,
    });
    const qualitySet = new Set(lex.data.quality || []);
    const envSet = new Set(lex.data.alwaysEnv || []);
    const nsfwSet = new Set(nsfw);
    for (const t of positive) {
      let source = tagSources.get(t) || SOURCES.random;
      if (qualitySet.has(t) || envSet.has(t) || nsfwSet.has(t)) source = SOURCES.fixed;
      if (presetOwned.has(t)) source = SOURCES.preset;
      else if (pinned.has(t)) source = SOURCES.pin;
      tracer.keep({ tag: t, source, stage: STAGES.tail });
    }
    for (const t of mustLocked) {
      if (final.has(t)) continue;
      tracer.reject({
        tag: t,
        source: SOURCES.must_draw,
        stage: STAGES.must_draw,
        reason: REASONS.mutex,
      });
    }
    trace = summarizeTrace(tracer.events(), {
      finalTags: positive,
      pinned: requestedPins,
      presetOwned,
      mustTags: mustLocked,
      debug: !!drawOpts.debugTrace,
    });
  }

  return {
    heat,
    era,
    female,
    male,
    people,
    seed,
    mustReport,
    sections: { quality, style, subject, feature, pose, clothing, env, nsfw },
    positive: positive.join(", "),
    shadowViolations,
    conflicts: contradictions(lex, positive),
    eraClash: eraMismatches(lex, pinned, era),
    heatClash: heatMismatches(lex, pinned, settings.heats),
    trace,
  };
}

/**
 * 真的會吃「每段目標數」的段。左欄的輸入框照這份清單生成。
 *
 * 主體段刻意不在裡面：那一段整段就是卡司（人數、solo），由 chooseCast()
 * 依 castWeights 決定，drawOne() 從頭到尾沒有 fill("subject")。以前 UI 照樣為它
 * 畫了一個輸入框，使用者從 0 調到 10 什麼都不會變。要改卡司請用左欄的男／女開關，
 * 或直接把 1girl／2girls 這類字釘起來。
 */
export const QUOTA_SECTIONS = ["feature", "pose", "clothing", "env"];

export const MUST_MAX = 20;

// 骨架格：每張各補一個、不看 counts 的那幾格（fillSlot／fillGroup）。排列順序就是
// 「保留的優先序」—— 數字設得比骨架少時，從最後面開始不補。三個介面都從這裡讀。
// 服裝刻意不列：它的骨架是「最低限度要穿衣服」，拆不成固定的小分類。
// 性愛動作、走光動作不是骨架格，由尺度那一排管（沒勾那個尺度就根本不會出現）。
export const SKELETON = {
  feature: [
    ["hair_len", "髮長"],
    ["eyes", "眼睛"],
    ["hair_color", "髮色"],
    ["hair_style", "髮型"],
    ["body_f", "身材（女）"],
  ],
  pose: [
    ["body", "身體姿勢"],
    ["face", "表情"],
    ["camera", "鏡頭"],
    ["gaze", "視線"],
    ["activity", "活動"],
  ],
  env: [
    ["place", "地點"],
    ["inout", "室內外"],
    ["time", "晝夜"],
    ["light", "光線"],
  ],
  // 服裝沒有每張必補的固定格，數字本來就接近「幾件」。所以門檻是預設值 5 而不是 8：
  // 設 5 以上照舊自由補；1～4 只補亮著的那幾種、每種一件（2026-09-29 專案主：衣服有時候
  // 不需要穿完整，要跟姿勢、場景一樣能選）。預設順序每一級都是完整的一套：
  // 1 連身、2 ＋腿襪、3 ＋飾品、4 ＋鞋履；想要不完整的就把連身換成上衣。
  clothing: [
    ["onepiece", "連身／套裝"],
    ["legs", "腿襪"],
    ["acc", "飾品"],
    ["feet", "鞋履"],
    ["top", "上衣"],
    ["bottom", "下身"],
    ["outer", "外套"],
    ["underwear", "內衣"],
  ],
};

// 數字低於這個才展開選格。沒寫的就是骨架格數。
const SKELETON_CAP = { clothing: 5 };

/** 這一段數字低於多少時要選格。 */
export function skeletonCap(section) {
  return SKELETON_CAP[section] ?? (SKELETON[section] || []).length;
}

// 時代服裝同時佔著一般的格子（和服佔連身、羽織佔外套）：關掉「連身」，和服也不補。
const ERA_CLOTH_KIND = {
  top: "top", bottom: "bottom", onepiece: "onepiece", outer: "outer", feet: "feet",
  underwear_top: "underwear", underwear_bottom: "underwear",
};

/** 這件衣服歸哪幾個種類開關管（"clothing:top" 這種 key）。 */
export function clothingKindKeys(item) {
  if (!item || item.section !== "clothing") return [];
  const out = ["clothing:" + item.group];
  if (item.group === "era" && ERA_CLOTH_KIND[item.mutex]) out.push("clothing:" + ERA_CLOTH_KIND[item.mutex]);
  return out;
}

// 數字比骨架少時也不擋的小分類（理由見 drawOne 的 offGroups）。
// 服裝：日式服裝這種時代總稱字、裸身不佔格（佔格子的時代服裝由 clothingKindKeys 對到那一格）。
const SKELETON_KEEP = new Set(["pose:sex", "pose:flash", "feature:job", "env:other", "clothing:era", "clothing:nude"]);

const skeletonKeys = (section) => (SKELETON[section] || []).map(([g]) => section + ":" + g);

/**
 * 這一段實際會補哪幾格骨架（依優先序）。數字 ≥ 骨架格數：全補。
 * 數字比骨架少：只補沒被關掉的，而且最多補「數字」那麼多格 —— 所以舊存檔裡
 * 「姿勢 1」這種設定也會照數字走，不必先去點過開關。數字 0 由 zeroSections 處理。
 */
export function skeletonLit(settings, section) {
  const keys = skeletonKeys(section);
  // 沒給這一段的數字（沒經過 sanitizeSettings 的呼叫端）：跟以前一樣全補。
  // 不能當成 0 —— zeroSections 只認明寫的 0，兩邊對不上會把整段骨架擋光。
  const raw = settings?.counts?.[section];
  if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return keys;
  const n = Math.max(0, Math.min(10, Number(raw)));
  if (!keys.length || n === 0) return [];
  if (n >= skeletonCap(section)) return keys;
  const off = new Set(settings.offGroups || []);
  return keys.filter((k) => !off.has(k)).slice(0, n);
}

/** 改數字：回傳 { counts, offGroups }。往下按從優先序最後面開始熄，往上按依序亮回來。 */
export function stepSkeleton(settings, section, next) {
  const v = Math.max(0, Math.min(10, Math.round(Number(next)) || 0));
  const counts = { ...settings.counts, [section]: v };
  const keys = skeletonKeys(section);
  const others = (settings.offGroups || []).filter((k) => !keys.includes(k));
  if (!keys.length || v >= skeletonCap(section)) return { counts, offGroups: others };
  if (v === 0) return { counts, offGroups: [...(settings.offGroups || [])] };
  const lit = skeletonLit(settings, section);
  for (const k of keys) {
    if (lit.length >= v) break;
    if (!lit.includes(k)) lit.push(k);
  }
  const keep = new Set(lit.slice(0, v));
  return { counts, offGroups: sanitizeOffGroups([...others, ...keys.filter((k) => !keep.has(k))]) };
}

/** 數字不變，換一格：key 亮起來，victim（沒給就是優先序最後那一格）熄掉。 */
export function swapSkeleton(settings, section, key, victim) {
  const keys = skeletonKeys(section);
  const lit = skeletonLit(settings, section);
  if (!keys.includes(key) || lit.includes(key) || !lit.length) return null;
  const out = lit.includes(victim) ? victim : lit[lit.length - 1];
  const keep = new Set([...lit.filter((k) => k !== out), key]);
  const others = (settings.offGroups || []).filter((k) => !keys.includes(k));
  return { offGroups: sanitizeOffGroups([...others, ...keys.filter((k) => !keep.has(k))]) };
}

// settings.offGroups：["section:group", …]，引擎不自己補的骨架格。釘選、必抽、相依字照舊。
export function sanitizeOffGroups(raw) {
  if (!Array.isArray(raw)) return [];
  const all = new Set(Object.keys(SKELETON).flatMap(skeletonKeys));
  return [...new Set(raw.filter((k) => typeof k === "string" && all.has(k)))].sort();
}

// 必抽的 key 是「段:細分類」（左欄、字盒列的那一格）。細分類沒有這個 id 時退回
// 「段:小分類」：拆開之前存的設定（例如 pose:sex）照整個小分類抽，不會默默失效。
function mustMatcher(lex, key, section, id) {
  if (lex.bySub && lex.bySub.has(key)) return (it) => !!it && it.section === section && it.sub === id;
  return (it) => !!it && it.section === section && it.group === id;
}

// settings.mustDraw is keyed "section:sub" (or a legacy "section:group") -> how many it must contribute.
export function sanitizeMustDraw(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of Object.keys(raw)) {
    const sep = key.indexOf(":");
    if (sep <= 0 || sep === key.length - 1) continue;
    if (key.slice(0, sep) === "quality") continue;
    const n = Math.floor(Number(raw[key]));
    if (!Number.isFinite(n) || n <= 0) continue;
    out[key] = Math.min(MUST_MAX, n);
  }
  return out;
}

export function defaultSettings(data) {
  const d = data.defaults;
  return {
    n: d.n,
    width: d.width,
    height: d.height,
    counts: { ...d.counts },
    girl: d.girl,
    boy: d.boy,
    heats: [...d.heats],
    heatPreset: d.heatPreset,
    weights: { ...data.heatWeights[d.heatPreset] },
    eras: d.eras ? [...d.eras] : [...ERAS],
    samePerson: false,
    drawJob: false,
    rating: "explicit",
    pinSportActivity: false,
    lockScene: true,
    sceneMode: "normal",
    mustDraw: {},
    offGroups: [],
  };
}

export function sanitizeSettings(raw, data) {
  const base = defaultSettings(data);
  if (!raw || typeof raw !== "object") return base;
  const counts = { ...base.counts };
  const incoming = raw.counts && typeof raw.counts === "object" ? raw.counts : {};
  for (const key of Object.keys(counts)) {
    if (incoming[key] === undefined || incoming[key] === null) continue;
    counts[key] = Math.max(0, Math.min(10, Number(incoming[key]) || 0));
  }
  const girl = raw.girl === true || raw.girl === false ? raw.girl : base.girl;
  const boy = raw.boy === true || raw.boy === false ? raw.boy : base.boy;
  const heats = Array.isArray(raw.heats) ? raw.heats.filter((h) => HEATS.includes(h)) : [];
  const selected = heats.length ? HEATS.filter((h) => heats.includes(h)) : [...base.heats];
  const heatPreset = heatPresetOf(selected);
  const weights = weightsForHeats(selected, data.heatWeights);
  if (raw.weights && typeof raw.weights === "object") {
    for (const h of HEATS) {
      const w = Number(raw.weights[h]);
      if (Number.isFinite(w) && w >= 0) weights[h] = w;
    }
  }
  const eras = Array.isArray(raw.eras) ? raw.eras.filter((e) => ERAS.includes(e)) : [];
  let sceneMode = SCENE_MODES.includes(raw.sceneMode) ? raw.sceneMode : null;
  if (!sceneMode) sceneMode = raw.lockScene === false ? "weird" : "normal";
  return {
    n: Math.max(1, Math.floor(Number(raw.n) || base.n)),
    width: Math.max(256, Math.min(2048, Number(raw.width) || base.width)),
    height: Math.max(256, Math.min(2048, Number(raw.height) || base.height)),
    counts,
    girl: girl || boy ? girl : true,
    boy: girl || boy ? boy : true,
    heats: selected,
    heatPreset,
    weights,
    eras: eras.length ? eras : [...base.eras],
    samePerson: raw.samePerson === true,
    drawJob: raw.drawJob === true,
    // 舊存檔存的是布林 sfw，沿用時對應到全年齡。
    rating: RATINGS.includes(raw.rating)
      ? raw.rating
      : raw.sfw === true
        ? "general"
        : "explicit",
    pinSportActivity: raw.pinSportActivity === true,
    sceneMode,
    lockScene: sceneMode !== "weird",
    mustDraw: sanitizeMustDraw(raw.mustDraw),
    offGroups: sanitizeOffGroups(raw.offGroups),
  };
}

const WEIGHT_STEPS = [10, 11, 12, 13, 14, 15, 6, 7, 8, 9];

export function parseWeighted(part) {
  const s = String(part || "").trim();
  const m = s.match(/^\((.+):(\d+(?:\.\d+)?)\)$/);
  if (m) {
    const weight = Number(m[2]);
    return { tag: m[1].trim(), weight: Number.isFinite(weight) ? weight : 1 };
  }
  return { tag: s, weight: 1 };
}

export function formatWeight(w) {
  const n = Math.round((Number(w) || 1) * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const TAG_WEIGHT_MIN = 0.6;
export const TAG_WEIGHT_MAX = 1.5;
export const TAG_WEIGHT_PRESETS = [0.6, 0.8, 1, 1.2, 1.5];

export function clampTagWeight(weight) {
  const n = Number(weight);
  let t = Math.round((Number.isFinite(n) ? n : 1) * 10);
  if (t > 15) t = 15;
  if (t < 6) t = 6;
  return t / 10;
}

export function formatWeighted(tag, weight) {
  if (!tag) return "";
  const n = Math.round((Number(weight) || 1) * 10) / 10;
  if (n === 1) return tag;
  return `(${tag}:${formatWeight(n)})`;
}

const CAST_PREFIX = new Set([...FEMALE_COUNT, ...MALE_COUNT, "solo"]);

// Danbooru 的消歧義標籤自帶括號（bow (weapon)、arrow (projectile)、1990s (style)），
// 而括號在 ComfyUI 的提示詞語法裡是「加權群組」。實測（comfy/sd1_clip.py 的
// token_weights + escape_important，直接跑使用者本機那份）：
//
//   "1girl, solo, 1990s (style)"  ->  1.0 "1girl, solo, 1990s "  /  1.1 "style"
//
// 括號被吃掉、裡面的字還被意外加重 1.1 倍。送到模型的不是 `bow (weapon)`（武器）
// 而是 `bow`（緞帶蝴蝶結）加上一個被加重的 `weapon` —— 消歧義標籤的用途正好被
// 反過來用。實測 5400 張裡有 23% 至少含一個這種標籤。
//
// ComfyUI 認 `\(` `\)` 當字面括號，所以送出去之前把標籤本身的括號跳脫掉。
// 我們自己加的權重語法 `(tag:1.2)` 不能跳脫，所以逐段拆開、只跳脫標籤文字，
// 再用 formatWeighted 把權重包回去。
// 先還原再跳脫，所以重複呼叫不會把 `\(` 變成 `\\(`。出口只有兩個、
// 來源都是沒跳脫的正規形式，但這個函式很容易被誤加在第三個地方。
export function escapeForComfy(positive) {
  const esc = (t) =>
    t
      .split("\\(").join("(")
      .split("\\)").join(")")
      .replace(/[()]/g, (c) => "\\" + c);
  const out = [];
  for (const part of String(positive || "").split(",")) {
    const { tag, weight } = parseWeighted(part);
    if (!tag) continue;
    out.push(formatWeighted(esc(tag), weight));
  }
  return out.join(", ");
}

export function insertTriggerAfterCast(positive, trigger) {
  const trig = String(trigger || "").trim();
  const pos = String(positive || "").trim();
  if (!trig) return pos;
  if (!pos) return trig;
  const parts = pos.split(",").map((s) => s.trim()).filter(Boolean);
  const extra = trig.split(",").map((s) => s.trim()).filter(Boolean);
  let i = 0;
  while (i < parts.length) {
    const { tag } = parseWeighted(parts[i]);
    if (!CAST_PREFIX.has(tag)) break;
    i += 1;
  }
  parts.splice(i, 0, ...extra);
  return parts.join(", ");
}

export function nextTagWeight(weight) {
  let t = Math.round((Number(weight) || 1) * 10);
  if (!WEIGHT_STEPS.includes(t)) t = 10;
  const i = WEIGHT_STEPS.indexOf(t);
  return WEIGHT_STEPS[(i + 1) % WEIGHT_STEPS.length] / 10;
}

export function stepTagWeight(weight, dir) {
  const cur = Math.round(clampTagWeight(weight) * 10);
  return clampTagWeight((cur + (dir < 0 ? -1 : 1)) / 10);
}

// 「重新生成這張」要重現的是這張卡**抽的時候**那組條件，不是面板現在停在哪裡。
//
// 每一個會影響出圖的欄位都必須在這裡表態：屬於卡片，還是屬於即時設定。
// rating 當初沒表態，於是重抽會拿新分級的負面去配舊分級的正面 —— 同一個字
// 同時出現在正面與負面。loras 和 ckpt 一直都是對的，只有 rating 漏了，
// 因為這個判斷散在兩個函式裡、沒有一個地方需要把清單寫完整。
//
// 抽到這裡來的用意就是「有一個地方需要寫完整」：欄位少一個，測試會紅。
export const JOB_CARD_FIELDS = ["positive", "loras", "ckpt", "rating", "workflowId"];

export function jobFields(card, live) {
  const c = card || {};
  const l = live || {};
  return {
    positive: String(c.positive || ""),
    // 空陣列是有意義的 —— 那張卡就是沒掛 LoRA。所以只有「根本不是陣列」
    // （卡片沒存、或存的 JSON 壞了）才退回即時值。
    loras: Array.isArray(c.loras) ? c.loras : Array.isArray(l.loras) ? l.loras : [],
    ckpt: c.ckpt || l.ckpt || "",
    rating: c.rating || l.rating || "explicit",
    // 空字串是有意義的：那張卡用內建 workflow。沒有這個欄位才退回即時選擇。
    workflowId: c.workflowId != null ? String(c.workflowId) : String(l.workflowId || ""),
  };
}

export function settleGenCard({ aborting = false, skipping = false, errName = "", finished = false, hadError = false } = {}) {
  if (skipping) return "skip";
  if (aborting || errName === "AbortError") return "cancel";
  if (hadError) return "error";
  if (finished) return "ok";
  return "interrupt";
}

export function applyTagWeights(positive, weights) {
  const map = weights instanceof Map ? weights : new Map(Object.entries(weights || {}));
  const out = [];
  for (const part of String(positive || "").split(",")) {
    const parsed = parseWeighted(part);
    if (!parsed.tag) continue;
    const w = map.has(parsed.tag) ? Number(map.get(parsed.tag)) : parsed.weight;
    out.push(formatWeighted(parsed.tag, w));
  }
  return out.join(", ");
}

export function missingPins(positive, pinned) {
  const have = new Set(
    String(positive || "")
      .split(",")
      .map((s) => parseWeighted(s).tag)
      .filter(Boolean)
  );
  return [...pinned].filter((t) => !have.has(t));
}

export function pinMissLine(lex, positive, pinned, pinsAtDraw) {
  const scope = pinsAtDraw
    ? [...pinned].filter((t) => pinsAtDraw.has(t))
    : pinned;
  const miss = missingPins(positive, scope);
  if (!miss.length) return "";
  return "釘選未入：" + miss.map((t) => labelOf(lex, t)).join("、");
}

/**
 * 這張圖自己打架的地方，講成人話。空字串代表沒問題。
 *
 * `contradictions()` 早就在算這件事，而且 drawOne() 每次都把結果放進回傳值的
 * `conflicts` —— 但**沒有任何地方讀它**（改這個之前 `grep -rn conflicts web/*.js`
 * 只命中 engine.js 自己）。也就是說引擎知道「這張圖同時是室內又室外」，
 * 然後把結論丟掉，使用者拿到一張壞圖卻沒有任何提示。
 *
 * 自然抽取不會撞到（實測 8640 張 0 次，單一釘選 11080 張也是 0），
 * 要兩個互相矛盾的釘選才會 —— 例如釘「露營」配「更衣室」：前者 implies
 * outdoors、後者 implies indoors，兩個都是明確釘選所以都會留下。
 * 那是「使用者說了算」的正確行為，但**至少要告訴他**。
 * 實測 2500 組隨機配對抽 9996 張，撞到 14 張。
 *
 * 左欄那三條 clash 提示（角色／尺度／時代）是從**釘選**算的、在抽之前；
 * 這一條是從**抽完的 POS** 算的，跟 pinMissLine 同一個位置、同一個形狀。
 */
export function clashLine(lex, tags) {
  const list = Array.isArray(tags) ? tags : String(tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const found = contradictions(lex, list);
  if (!found.length) return "";
  const L = (t) => labelOf(lex, t);
  // 室內外會被 implies 那一圈重複報好幾筆（indoors/outdoors 本身一筆、每個
  // implies 到它們的字各一筆）。先把具名的那些收起來，最後只講一句 ——
  // 而且要講**具體的字**（露營、更衣室），字面上的 indoors／outdoors 沒有資訊。
  const inOutNamed = new Set();
  let inOut = false;
  const seen = new Set();
  const parts = [];
  for (const [kind, a, b] of found) {
    if (kind === "in_out") {
      inOut = true;
      for (const t of [a, b]) if (t !== "indoors" && t !== "outdoors") inOutNamed.add(t);
      continue;
    }
    const key = kind === "day_night" ? kind : kind + "|" + a + "|" + b;
    if (seen.has(key)) continue;
    seen.add(key);
    if (kind === "day_night") parts.push("同時是白天和夜晚");
    else if (kind === "solo_count") parts.push("寫著單人卻有兩個以上的人");
    else if (kind === "solo_focus") parts.push("寫著單人又寫著單人焦點");
    else if (kind === "cast_need") parts.push(`${L(a)} 跟現在的人數對不上`);
    else if (kind === "nude_garment") parts.push("說全裸卻還穿著衣服");
    else parts.push(`${L(a)} 和 ${L(b)} 不能同時成立`);
  }
  if (inOut) {
    parts.unshift(
      inOutNamed.size
        ? `同時是室內和室外（${[...inOutNamed].map(L).join("、")}）`
        : "同時是室內和室外"
    );
  }
  return "這張圖自己打架：" + parts.join("；");
}

export function knownTags(lex, tags) {
  return [...(tags || [])].filter((t) => typeof t === "string" && t && lex.byTag.has(t));
}

export function labelOf(lex, tag) {
  const item = lex.byTag.get(tag);
  if (item?.zh) return item.zh;
  if (lex.data.zh && lex.data.zh[tag]) return lex.data.zh[tag];
  return tag;
}
