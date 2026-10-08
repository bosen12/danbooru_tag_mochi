/** Rating / SFW gates. No UI copy. */
import { MIXED_HEATS } from "../heats.js";
import { REASONS } from "../trace.js";

const SFW_NSFW_RE =
  /\b(nipples?|areolae?|pussy|pussies|penis|testicl|cum\w*|anus|anal|sex|erections?|bulge|masturbat|fellatio|paizuri|cunnilingus|orgasm|ahegao|condoms?|dildos?|vibrators?|bondage|bdsm|rape|molest|groping|lewd|cameltoe|upskirt|downblouse|crotch|cleavage|naked|nude|topless|bottomless|panties|panty|bra|lingerie|underwear|thong|garter|fundoshi|pubic|drool|ejaculat|lactation)\b/i;

// 這幾個字會被上面的規則誤傷，但它們本身不情色：流汗、淋濕、蒸氣。
const SFW_KEEP = new Set(["sweat", "wet", "wet hair", "steam"]);

// regex 抓不到、但一樣不該出現的。
const SFW_EXTRA = new Set([
  // 這兩個本來全年齡就抽得到，但實測帶著 3 倍於基準的成人圖，
  // 語意上也確實是「性感取向」而不是中性 —— 往上挪一層到敏感。
  "biting own lip",      // 3.1x
  "legs up",             // 3.2x
  "thigh gap",
  "mole on breast",
  "wet shirt",
  "spread cleavage",
  "breast focus",
  "pov crotch",
  "collar",
  "leash",
  "pet play",
  "torn clothes",
  "wardrobe malfunction",
  "public indecency",
  "exhibitionism",
  "saliva",
  "heart-shaped pupils",
  "fucked silly",
  "rolling eyes",
  // 實際抽 4320 張之後看出來的漏網：規則對了，但這些字規則抓不到。
  // 透視與極度暴露的衣著
  "see-through shirt",
  "micro bikini",
  "slingshot swimsuit",
  "revealing clothes",
  "tight clothes",
  "microskirt",
  "unbuttoned shirt",
  "wet clothes",
  // 臀部特寫
  "ass",
  "huge ass",
  "ass ripple",
  "grabbing another's ass",
  "hand on own ass",
  // 挑逗的表情與動作
  "naughty face",
  "seductive smile",
  "licking lips",
  "clothes tug",
  "come hither",
  "cheating (relationship)",
  // 全年齡＝連暗示都沒有。這幾個沒有露點，但畫面上讀起來就是性感取向 ——
  // 兩段制的時候它們待在「關掉色情」那一檔，正是那時候會生出
  // 網襪＋極短洋裝＋背向蹲姿的原因。現在它們有 sensitive 可以去。
  "fishnet thighhighs",
  "fishnets",
  "short dress",
  "garter belt",
  "thigh strap",
  "bare shoulders",
  "off shoulder",
  // 2026-09-22 greylist P0：heat 掛 tease+flash+sex 的走光／成人主題漏網
  // （!heat.includes("tease") 擋不住）。勿改成「heat 含 flash|sex 就擋」——
  // 那會誤殺 ~1178 個三池萬用字（含 1girl）。
  "accidental exposure",
  "lifting own clothes",
  "breastfeeding",
  "voyeurism",
  "netorare",
  "bouncing",
  // 側乳／下乳／背乳是身材走光，敏感可以，全年齡不行。
  "sideboob",
  "underboob",
  "backboob",
  "bodystocking",
  "torn thighhighs",
  "backless outfit",
  "harem outfit",
  "virgin killer sweater",
  "body writing",
  "cleavage cutout",
  "fishnet pantyhose",
  "torn pantyhose",
  "negligee",
  "micro shorts",
  "latex legwear",
  "skin tight",
  "hidden camera",
  "highleg leotard",
  "backless dress",
  "strapless dress",
  "bikini armor",
  "catsuit",
  "latex bodysuit",
  "underbust",
  "legs over head",
  "pole dancing",
  "ass tattoo",
  "tramp stamp",
  // 破襯衫、破裙子跟破衣一樣，三檔都進，全年齡不行。
  "torn shirt",
  "torn skirt",
]);

// 三段分級，對齊 Danbooru 自己的 rating 階梯。
//
//   general    全年齡：連暗示都沒有
//   sensitive  敏感：性感，但沒有露點、沒有性行為、沒有內衣外穿、沒有走光
//   explicit   色情：現狀
//
// 中間這段是為了解掉一個兩段制解不掉的問題：兩段的時候「關掉色情」同時要
// 負責「乾淨」和「不色情」，結果兩件事都做不好 —— 實測會生出網襪＋極短洋裝＋
// 背向蹲姿的圖，沒有露點卻明顯是性感取向。
//
// group="flash" 這一組混了兩種東西，不能整組處理：
//   掀裙、拉衣、走光、滑落  -> 那是脫衣，只有 explicit 能有
//   彎腰、張腿、跪趴、跨坐  -> 穿著衣服擺姿勢，正是 sensitive 的內容
// 這正是「規則掛錯層級」那條教訓：group 不等於概念。
const FLASH_UNDRESS_RE =
  /\b(lift|pull|aside|slip|undress|flashing|exhibitionism|wedgie|grab|tweak|chikan|nude|spread pussy)\b/i;

// 這些不是暴露，是明講的性 —— 不管穿多少都只能在 explicit。
const EXPLICIT_ONLY_EXTRA = new Set([
  // 2026-09-15 逐字對 Danbooru 的實際 rating 分布查過之後補的。
  // 判準是「相對全站基準的倍率」而不是原始百分比 —— 全站有 20.2% 的圖是 q+e，
  // 所以一個字帶著 20% 成人圖只代表它很普通。第一版直接看百分比，
  // 把 v（比 YA）、head tilt（歪頭）都判成敏感，明顯是被基準騙了。
  //
  // 收進來的只有語意上本來就是「露出／性器／性行為／高潮狀態」的字，
  // 純粹的身體姿勢（spread legs、m legs、straddling、bent over）留在敏感 ——
  // 那些字配上穿著整齊的衣服仍然成立，是不是色情由衣服決定。
  "one breast out",      // 4.9x，字面就是露出來了
  // 2026-09-18 補的四個，全部是這張表當初漏掉的同族。
  //
  // 漏掉的後果看得見：「只勾活動＝日常」那一檔是**借 tease 的池子**再靠
  // hasExplicitContent() 把情色扣掉（見下面 2820 行那段），而這四個掛在
  // feature/body_f，group 看不見、EXPLICIT_RE 也咬不到，於是整批溜進日常。
  // 實測色情分級只勾活動抽 4200 張：breasts out 96 次、grabbing own breast 54、
  // guided breast grab 46、grabbing another's ass 41 —— 面板上那句
  //「沒有走光或做愛」被打臉。
  //
  // 比例照這張表原本的判準量（相對全站 20.2% 基準的倍率）：
  "breasts out",          // 4.89x（e98.7%）—— one breast out 的複數，同一個意思卻漏了
  "guided breast grab",   // 4.85x（e98.0%）
  "grabbing another's ass", // 4.78x（e96.6%）—— 跟已收的 grabbing another's breast 同級
  "grabbing own breast",  // 4.22x（e85.3%）—— 比已收的 hand on own crotch 4.1x 還高
  //
  // **刻意不收**的對照組，它們是形狀不是動作，照這張表的規矩留在敏感：
  //   unaligned breasts 4.15x、breasts apart 3.68x、breast suppress 3.04x、
  //   breast rest 1.96x、arm under breasts 1.63x
  // grabbing another's hair 3.84x 也不收：倍率在範圍內，但抓頭髮本身不是
  // 露出／性器／性行為，收它就等於只看數字不看語意。
  "covering breasts",    // 3.5x，遮胸的前提是沒穿
  "covering crotch",     // 3.9x，同上
  "covering privates",
  "cleft of venus",
  "bulge",               // 4.1x，性器輪廓
  "hand on own crotch",  // 4.1x
  "grinding",            // 5.0x，性行為
  "moaning",             // 5.0x，e98%
  "fucked silly",        // 4.9x，e98%
  "rolling eyes",        // 4.8x，e94%，翻白眼是 ahegao 的一部分
  "aroused",             // 4.5x
  "heavy breathing",     // 3.9x
  // 3.9x
  "see-through shirt",
  "micro bikini",
  "slingshot swimsuit",
  "naked coat",
  "naked jacket",
  "pussy focus",
  "cameltoe",
  "masturbation through clothes",
  "groping",
  "netorare",
  "cheating (relationship)",
  "voyeurism",
  "breastfeeding",
  "used condom",
  "dildo",
  "condom",
  "torogao",
  "pasties",
  "futanari",
  "public nudity",
  "o-ring bikini",
  "reverse bunnysuit",
  "gag",
  "spreader bar",
  "wooden horse",
  "glory hole",
  "quadruple amputee",
  "breast expansion",
  "tally",
  "nipple tassels",
  "tentacle pit",
  "vacuum bed",
  "breast pump",
  "milking machine",
  "pillory",
  "stocks",
  "restraints",
  "whip marks",
  "rope",
  "cuffs",
  "shackles",
  "tape gag",
  "bit gag",
  "ring gag",
  "strap-on",
  "nose hook",
  "speculum",
  "chain leash",
  "straitjacket",
  "bikini top only",
  "uncensored",
  "branded",
  "rape face",
]);

// 只有 explicit 能出現：真正的性、裸露、脫衣走光、內衣當外衣。
// explicit 專屬的字眼。比 general 那條窄：cleavage、crotch、彎腰張腿這些
// 「穿著衣服的性感」要留給 sensitive，所以不在這條裡面。
// 字根要吃得下複數與複合字：加了字界的 nipple 配不到 "puffy nipples"，
// 加了字界的 cum 配不到 "cumdrip" —— 兩個都真的漏過。
const EXPLICIT_RE = new RegExp(
  "\\b(nipples?|areolae?|pussy|pussies|penis|testicl|cum\\w*|anus|anal|sex|erections?|" +
    "masturbat|fellatio|cunnilingus|orgasm|ahegao|condom|dildo|vibrator|" +
    "bondage|bdsm|rape|molest|nude|naked|topless|bottomless|panties|panty|bra|" +
    "lingerie|underwear|thong|garter|fundoshi|pubic|ejaculat|lactation|" +
    "upskirt|downblouse|cameltoe)\\b",
  "i"
);

export function explicitOnly(item) {
  if (!item) return false;
  const tag = item.tag;
  if (SFW_KEEP.has(tag)) return false;
  if (item.layer === "skin") return true;
  // 用 group 不用 mutex：ejaculation、cumdrip、masturbation 都是 group="sex"
  // 但 mutex 是 null，寫成 mutex === "sex_act" 的話它們會整批從旁邊走過去
  // 混進 sensitive。這是這個 session 第四次踩到「規則掛錯層級」。
  if (item.group === "sex" || item.mutex === "sex_act") return true;
  // 脫衣動作是 explicit，但「穿著衣服擺姿勢」不是 —— 所以不用 heat 判斷。
  // flash 那一檔的姿勢（彎腰、張腿、跨坐）heat 裡本來就沒有 tease，
  // 拿 heat 當鑰匙會把整個 sensitive 檔位掏空。
  if (item.mutex === "clothes_action") return true;
  if (item.mutex === "underwear_top" || item.mutex === "underwear_bottom") return true;
  if (item.group === "flash" && FLASH_UNDRESS_RE.test(tag)) return true;
  if (EXPLICIT_ONLY_EXTRA.has(tag)) return true;
  if (EXPLICIT_RE.test(tag)) return true;
  return false;
}

// 畫面上真的有什麼，決定這張圖是哪一級 —— 而不是滑桿說了算。
//
// Danbooru 的 rating 是從內容推出來的，WAI 也是照那個對應訓練的。滑桿只代表
// 「我最多接受到哪一級」，不代表「每張都要標到那一級」。兩者混為一談的後果是：
// 滑桿放色情、尺度選「活動」，一張全身穿好、在超市買東西的圖照樣被寫上
// nsfw, explicit —— 那個組合在訓練集裡不存在，模型只能往色情的方向硬拉。
//
// 實測（每格 400 張，六個時代都一樣）：
//   尺度=活動 或 誘惑 -> 100% 的圖沒有任何情色內容，卻都標著 explicit
//   預設尺度（誘惑＋走光＋性愛）-> 29%
//   走光、性愛 -> 0%（這兩個本來就名副其實）
//
// 判準只認畫面上的東西，不碰 heat/gate 那些「能不能抽」的欄位 ——
// 我一開始拿 explicitOnly() 來當判準是錯的：那是閘不是分類器，
// 只要一個字的 heat 沒有 tease 就回 true，連 shopping 都被算成情色內容。
// 這裡用的是 Danbooru 的**內容**階梯，不是本程式的**權限**階梯。兩者不一樣：
//   權限階梯（ratingBlocked / EXPLICIT_RE）說「敏感級不准出現內衣」—— 那是使用者
//   自己訂的門檻，加了字界的 bra 連 sports bra 都算。
//   內容階梯說「看得見內衣 = sensitive，露點與性行為 = explicit」—— 那是訓練集
//   實際的標法，也是這條尾巴要對齊的東西。
// 拿權限階梯當內容判準，穿運動內衣做健身會被標成 explicit。
const EXPLICIT_CONTENT_RE = new RegExp(
  "\\b(pussy|pussies|penis|testicl|cum\\w*|anus|anal|sex|erections?|" +
    "masturbat|fellatio|paizuri|cunnilingus|orgasm|ahegao|fucked|" +
    "rape|molest|groping|ejaculat|lactation|nude|naked|topless|bottomless|" +
    "nipples?|areolae?|pubic|dildos?|vibrators?|condoms?)\\b",
  "i"
);

// 看得出尺度但還沒到露點的：內衣外露、泳裝、透視、乳溝、走光。
const SENSITIVE_CONTENT_RE = new RegExp(
  "\\b(panty|panties|bra|lingerie|underwear|thong|garter|fundoshi|" +
    "bikini|swimsuit|see-through|wet clothes|cleavage|underboob|sideboob|backboob|" +
    "bodystocking|torn thighhighs|" +
    "cameltoe|upskirt|downblouse|crotch|bulge|revealing)\\b",
  "i"
);

export function hasExplicitContent(item) {
  if (!item) return false;
  // sweat / wet / steam 會被字面規則誤傷，沿用既有的例外名單。
  if (SFW_KEEP.has(item.tag)) return false;
  if (item.layer === "skin") return true;
  if (item.mutex === "sex_act" || item.group === "sex") return true;
  if (item.mutex === "clothes_action") return true;
  if (EXPLICIT_ONLY_EXTRA.has(item.tag)) return true;
  // group="flash" 混了脫衣跟穿著衣服擺姿勢，不能整組算。但光看
  // FLASH_UNDRESS_RE 會漏掉 masturbation through clothes、hand on own crotch
  // 這種同屬 flash 卻明確情色的字 —— 實測就出過「masturbation through clothes
  // + fucked silly」被標成 sfw, general 的圖，比原本的問題還糟。
  return EXPLICIT_CONTENT_RE.test(item.tag);
}

export function hasSensitiveContent(item) {
  if (!item) return false;
  if (SFW_KEEP.has(item.tag)) return false;
  if (item.mutex === "underwear_top" || item.mutex === "underwear_bottom") return true;
  if (item.group === "flash") return true;
  return SENSITIVE_CONTENT_RE.test(item.tag);
}

// 照畫面推一級出來，再被滑桿壓上限（滑桿是天花板，不是目標）。
export function ratingOfDrawnTags(items, cap) {
  let level = "general";
  for (const it of items) {
    if (hasExplicitContent(it)) { level = "explicit"; break; }
    if (hasSensitiveContent(it)) level = "sensitive";
  }
  const order = { general: 0, sensitive: 1, explicit: 2 };
  return order[level] <= order[cap] ? level : cap;
}

export const RATINGS = ["general", "sensitive", "explicit"];
export const RATING_LABEL = { general: "全年齡", sensitive: "敏感", explicit: "色情" };

export function ratingOf(settings) {
  const r = settings && settings.rating;
  return RATINGS.includes(r) ? r : "explicit";
}

// 某個字在某一級之下能不能出現。
// general 沿用已經逐字審過、實抽 4320 張驗證過的 sfwBlocked()，不重寫。
export function ratingBlocked(item, rating) {
  if (rating === "explicit") return false;
  if (rating === "sensitive") return explicitOnly(item);
  // 全年齡是階梯的最底層，所以「敏感擋掉的，這裡一定也擋」。
  //
  // 以前這兩層各用各的判準：敏感看 explicitOnly()（含 EXPLICIT_ONLY_EXTRA 名單），
  // 全年齡看 sfwBlocked()（字面 regex）。兩邊沒有任何東西保證是階梯，於是
  // netorare、voyeurism、breastfeeding 在敏感被擋、在全年齡卻放行 ——
  // 因為那三個字裡沒有任何一個 regex 認得的詞。實抽 2800 張全年齡的圖，
  // netorare 47 次、voyeurism 72 次。
  //
  // 補名單只能修掉這三個，補階梯才是修掉這一類。
  return sfwBlocked(item) || explicitOnly(item);
}

export function sfwBlocked(item) {
  if (!item) return false;
  const tag = item.tag;
  if (SFW_KEEP.has(tag)) return false;
  if (item.layer === "skin") return true;
  if (item.mutex === "sex_act") return true;
  if (item.group === "flash") return true;
  if (item.mutex === "clothes_action") return true;
  if (item.mutex === "underwear_top" || item.mutex === "underwear_bottom") return true;
  const heat = item.heat && item.heat.length ? item.heat : MIXED_HEATS;
  // 只在 flash/sex 才出現的字，本來就是為了那兩檔而存在的。
  if (!heat.includes("tease")) return true;
  if (SFW_EXTRA.has(tag)) return true;
  // 胸部：mutex=breast_size 是體型，其餘（抓、托、夾、特寫）都擋。
  if (/\bbreasts?\b/i.test(tag) && item.mutex !== "breast_size") return true;
  if (SFW_NSFW_RE.test(tag)) return true;
  return false;
}

// 舊的布林開關還留著給既有呼叫端用：非 explicit 就代表要過濾。
export function sfwOn(settings) {
  return ratingOf(settings) !== "explicit";
}


export function evaluateRating(item, rating) {
  if (!item) return { ok: false, reason: REASONS.rating_mismatch };
  if (ratingBlocked(item, rating)) {
    return { ok: false, reason: REASONS.rating_mismatch };
  }
  return { ok: true };
}
