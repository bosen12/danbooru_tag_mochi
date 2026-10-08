/**
 * 卡牌的共用部分：花色、分級、插畫 prompt、檔名。墨池（web6）、字鋪（zipu）、
 * 排字匣的卡牌模式（web/tag-cards.js）、烘焙腳本共用。
 *
 * 零 import：分級判斷（ratingBlocked）和情境表（ACT_PLACE）由呼叫端傳進來，
 * 所以 node（烘焙腳本、測試）跟瀏覽器用的是同一份。
 */

/** 永遠不做成卡、不畫插畫、抽牌時一律封鎖的字。不是設定，是底線。 */
export const HARD_BANNED = Object.freeze(["loli", "shota"]);
const HARD = new Set(HARD_BANNED);

/**
 * 小分類的一字章：蓋在書脊最下面，疊成一排也分得出「這張是鏡頭、那張是表情」。
 * 鑰匙是 section|group（同一個 group 名在不同花色可能是不同意思，例如 sex）。
 * 「其他」、只有一種的（風格、人數以外的主體）不蓋，免得每張都有一個沒意義的字。
 * 墨池、疊印台、排字匣的卡牌模式、字鋪都讀這一份，同一張牌在哪裡都蓋同一個字。
 */
export const GROUP_SEAL = {
  "pose|activity": "動",
  "pose|body": "身",
  "pose|camera": "鏡",
  "pose|face": "表",
  "pose|gaze": "視",
  "pose|tease": "誘",
  "pose|flash": "走",
  "pose|sex": "性",
  "clothing|top": "上",
  "clothing|bottom": "下",
  "clothing|outer": "外",
  "clothing|onepiece": "連",
  "clothing|underwear": "內",
  "clothing|legs": "襪",
  "clothing|feet": "鞋",
  "clothing|acc": "飾",
  "clothing|fabric": "材",
  "clothing|era": "時",
  "clothing|nude": "裸",
  "feature|hair_color": "色",
  "feature|hair_len": "長",
  "feature|hair_style": "型",
  "feature|eyes": "眼",
  "feature|skin": "膚",
  "feature|makeup": "妝",
  "feature|body_f": "體",
  "feature|body_m": "體",
  "feature|job": "職",
  "feature|race": "族",
  "feature|sex": "性",
  "env|place": "地",
  "env|light": "光",
  "env|background": "背",
  "env|effect": "效",
  "env|time": "晝",
  "env|sky": "天",
  "env|weather": "氣",
  "env|inout": "室",
  "env|furniture": "坐",
  "subject|count_f": "女",
  "subject|count_m": "男",
};

/** 這張牌的小分類章（詞庫的 item，或至少帶 section、group 的物件）。沒有就 null。 */
export function groupSeal(item) {
  return (item && GROUP_SEAL[`${item.section}|${item.group}`]) || null;
}

export const CARD_SUITS = ["cast", "look", "wear", "pose", "scene", "style"];
export const CARD_SUIT_INFO = {
  cast: { zh: "人數", glyph: "人" },
  look: { zh: "長相", glyph: "容" },
  wear: { zh: "服裝", glyph: "衣" },
  pose: { zh: "姿勢", glyph: "姿" },
  scene: { zh: "場景", glyph: "景" },
  style: { zh: "風格", glyph: "風" },
};

const SECTION_SUIT = { subject: "cast", feature: "look", clothing: "wear", pose: "pose", env: "scene", quality: "style" };

export function cardSuit(item) {
  if (!item) return null;
  if (item.group === "job") return "wear";
  if (item.section === "quality" && item.group !== "style" && item.group !== "boost") return null;
  return SECTION_SUIT[item.section] || null;
}

/** 這個字能不能當一張牌。畫質固定詞（masterpiece…）和底線封鎖的字不行。 */
export function isCard(item) {
  return !!item && !HARD.has(item.tag) && !!cardSuit(item);
}

/** 字的分級：全年齡放行的是 general，敏感才放行的是 sensitive，其餘是 explicit。 */
export function ratingTier(item, ratingBlocked) {
  if (!ratingBlocked) return "general";
  if (!ratingBlocked(item, "general")) return "general";
  if (!ratingBlocked(item, "sensitive")) return "sensitive";
  return "explicit";
}

export function artFile(tag) {
  return tag.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() + ".webp";
}

/**
 * 牌面插畫的 <img> 屬性。manifest 那筆有 thumb:true 就多給一個 200px 的縮圖，
 * 讓瀏覽器照實際畫出來的寬度自己挑：字盒、牌堆一格 90px 拿縮圖（約 9KB），
 * 放大牌、校樣拿原圖（約 36KB）。sizes="auto" 只對 loading="lazy" 有效，
 * 不支援的瀏覽器退回後面的 120px。沒有縮圖就只有 src，跟以前一樣。
 */
export function artSources(entry, base = "cards/") {
  if (!entry || !entry.file) return null;
  const q = versionQuery(entry);
  const full = base + entry.file + q;
  if (!entry.thumb) return { src: full };
  return { src: full, srcset: `${base}thumb/${entry.file}${q} 200w, ${full} 480w`, sizes: "auto, 120px" };
}

/** 原圖網址（放大牌、校樣、詳情）。 */
export function artUrl(entry, base = "cards/") {
  return entry && entry.file ? base + entry.file + versionQuery(entry) : null;
}

/**
 * manifest 的 v 是內容雜湊：接在網址後面，伺服器就整年快取（server.py _serve_static）；
 * 重烤之後雜湊變了網址也跟著變，不會拿到舊圖。舊的 manifest 沒有 v 就不接，照舊每次驗證。
 */
function versionQuery(entry) {
  return entry.v ? "?v=" + encodeURIComponent(entry.v) : "";
}

/** 把 artSources 的結果套到一個 <img> 上（先設 sizes／srcset 再設 src，免得先抓一次原圖）。 */
export function applyArtSources(img, sources) {
  if (!sources) return img;
  img.loading = "lazy";
  if (sources.sizes) img.sizes = sources.sizes;
  if (sources.srcset) img.srcset = sources.srcset;
  img.src = sources.src;
  return img;
}

/* ---------- 插畫 prompt ---------- */

// 畫出來跟任何一張都一樣的字：用鉛字版卡面。
const NO_ART = new Set(["looking at viewer", "looking ahead", "closed mouth", "straight-on", "absurdres", "highres", "very aesthetic", "highly aesthetic", "newest"]);

// 每一類字用一種鏡頭，讓那個字成為畫面的主角（字鋪試生 20 張後定下來的）。
const PERSON_FRAME = {
  // 髮色、髮型：頭肩特寫（2026-10-07 起）。上半身構圖在小小的牌面上頭只佔一角，字盒裡分不出差別。
  hair_color: "portrait",
  hair_style: "portrait",
  hair_len: "full body",
  eyes: "portrait",
  makeup: "portrait",
  skin: "upper body",
  other: "upper body",
  race: "upper body",
  face: "portrait",
  gaze: "upper body",
  camera: "",
  body: "full body",
  tease: "full body",
  flash: "cowboy shot",
  sex: "",
  nude: "full body",
  job: "full body, standing",
  onepiece: "full body, standing",
  era: "full body, standing",
  bottom: "full body, standing",
  legs: "full body, standing",
  feet: "full body, standing",
  underwear: "cowboy shot, standing",
  top: "cowboy shot, standing",
  outer: "cowboy shot, standing",
  fabric: "cowboy shot, standing",
  acc: "upper body",
  body_f: "cowboy shot, standing",
  body_m: "cowboy shot, standing",
  style: "upper body",
  count_f: "full body",
  count_m: "full body",
  extra: "upper body",
};

// 單獨畫會怪的字，補一個道具。
const ART_EXTRA = {
  sitting: "chair",
  "crossed legs": "sitting, chair",
  "indian style": "floor",
  "against wall": "wall",
  "against glass": "window",
  "looking at mirror": "mirror",
  "looking outside": "window",
  sleeping: "bed, pillow",
  lying: "bed",
  "on back": "bed",
  "on side": "bed",
  reclining: "couch",
  "hair flower": "portrait",
  "hair scrunchie": "ponytail",
  bride: "full body, wedding dress",
  umbrella: "full body, holding umbrella",
  bag: "cowboy shot",
  cape: "full body",
  "hooded cloak": "full body",
  cloak: "full body",
  boots: "full body",
  "high heels": "full body",
  // 多人的牌拉近到上半身時，底模會把中間那個畫成小孩；全身站著排開就不會。
  "multiple girls": "full body, standing",
  "multiple boys": "full body, standing, facial hair",
  // Danbooru 上 testicle sucking 幾乎都同時標 oral，標 sex 的很少。
  // 牌面若帶著 sex，底模會把嘴放在龜頭上，畫成口交。
  "testicle sucking": "oral, close-up",
  // 視線本身不 implies penis（penis 只有 sex，走光會整張抽失敗）。牌面仍要看得到。
  "looking at penis": "penis",
  "cum pool": "lying, on back, on bed, excessive cum",
  "female ejaculation": "pussy juice, spread legs, mature female",
  "stomach bulge": "vaginal, nude, lying, on back",
  "cum on pussy": "spread legs",
  "pussy juice trail": "spread legs",
  "pussy juice puddle": "sitting, spread legs",
  "nursing handjob": "breasts, penis, close-up",
  "straddling paizuri": "on lap, breasts",
  "anal fingering": "ass, from behind",
  "mutual masturbation": "penis, sitting",
  "licking nipple": "breasts, nipples, close-up",
  "tentacle sex": "nude",
  "tentacles": "nude",
  "leg lock": "lying, legs up",
  "folded": "on back, legs up, nude",
  "spread ass": "ass, from behind",
  "grabbing from behind": "standing, from behind",
  "kissing neck": "neck, from side, close-up",
  "head between breasts": "breasts",
  "breast smother": "breasts",
  "spanking": "ass, bent over, from behind",
  "hickey": "neck, close-up",
  "torogao": "close-up, blush",
  "butt plug": "ass, from behind, nude",
  "anal beads": "ass, from behind, nude",
  "crotch rope": "standing, nude",
  "sideboob": "breasts, from side",
  "underboob": "breasts, from below",
  "backboob": "breasts, from behind",
  bodystocking: "full body",
  pasties: "breasts, upper body",
  "torn thighhighs": "full body",
  "bird's eye view": "full body, standing",
  "worm's eye view": "full body, standing, low angle",
  "fingerless gloves": "hands, upper body",
  "thigh boots": "full body, standing, thighs",
  "sunglasses": "face, close-up",
  "scarf": "neck, upper body",
  "hair ribbon": "hair, upper body",
  hairband: "hair, upper body",
  "fur trim": "coat, upper body",
  "witch hat": "hat, upper body",
  "maid headdress": "head, upper body",
  loafers: "feet, full body, standing",
  "magical girl": "full body, standing",
  "garter straps": "thighs, thighhighs",
  backpack: "from behind, upper body",
  beret: "hat, upper body",
  tiara: "hair, upper body",
  "chef hat": "hat, upper body",
  chef: "chef hat, upper body",
  "holding condom": "hand, upper body",
  "condom in mouth": "close-up, face, long hair, mature female",
  "condom box": "condom",
  "after rape": "nude, lying, on bed, tears, cum on body, afterglow",
  "rough sex": "nude, sex",
  strangling: "neck, from side, close-up",
  "neck grab": "neck, close-up",
  headlock: "upper body",
  "rear naked choke": "from behind, nude, upper body",
  asphyxiation: "neck, close-up",
  "slap mark": "face, cheek, close-up",
  "arms up": "upper body",
  walking: "full body, outdoors",
  running: "full body, outdoors",
  jumping: "full body",
  "single braid": "hair, upper body",
  "low twintails": "hair, upper body",
  "half updo": "hair, upper body",
  "hair intakes": "hair, upper body",
  impregnation: "vaginal, cum, lying, on bed",
  "panties around one leg": "panties, thighs, full body",
  // 上半身加 hand 會把男方的手畫到胸口。側面近景才看得到被握住的手腕。
  "holding another's wrist": "from side, close-up, outstretched arms, wrist, forearm, a hand gripping the wrist",
  "mary janes": "feet, full body, standing",
  "knee boots": "full body, standing, thighs",
  "plaid skirt": "skirt, full body, standing",
  "low ponytail": "hair, upper body",
  "braided ponytail": "hair, upper body",
  "folded ponytail": "hair, upper body",
  grin: "face, close-up",
  "tearing up": "face, close-up, tears",
  turtleneck: "shirt, upper body",
  hairclip: "hair, upper body",
  headphones: "headphones, upper body",
  "wrist cuffs": "tank top, bare shoulders, sleeveless, wrist, upper body",
  "sun hat": "hat, upper body, outdoors",
  "standing split": "full body",
  tiptoes: "full body, standing",
  "nose blush": "portrait, blush",
  sweatdrop: "portrait, sweat",
  fang: "face, close-up, mature female",
  "mole under mouth": "portrait",
  skindentation: "thighhighs, thighs, cowboy shot, mature female",
  "cleft of venus": "thighs, mature female, close-up",
  "hood up": "hoodie, hood up, upper body",
  "leg up": "full body",
  "covering privates": "hand, crotch, mature female, full body",
  "hand on another's head": "head, hand, upper body",
  "grabbing another's hair": "hair, hand, from side, upper body",
};

// 精液落在對方身上，或這個動作的對象是女生。
// needs 只有 male 時卡司會變成 1boy solo，圖就變成射進男生嘴裡。
// 男生自己的陰莖、射精、先走汁不在這裡，那些維持 1boy solo。
const HETERO_PICTURE = new Set([
  "cum in mouth",
  "facial",
  "gokkun",
  "cum on tongue",
  "cum on hair",
  "cum on body",
  "cum on stomach",
  "cum on legs",
  "cum on feet",
  "cum on hands",
  "cum on clothes",
  "cum in ass",
  "cum overflow",
  "internal cumshot",
  "excessive cum",
  "after anal",
  "after sex",
  "after vaginal",
  "deep penetration",
  "penis over eyes",
  "penis on face",
  "looking at penis",
  "cum pool",
  "stomach bulge",
  "cum on pussy",
  "nursing handjob",
  "straddling paizuri",
  "mutual masturbation",
  "licking nipple",
  "leg lock",
  "grabbing from behind",
  "kissing neck",
  "head between breasts",
  "breast smother",
  "spanking",
  "rape",
  "after rape",
  "rough sex",
  "strangling",
  "neck grab",
  "headlock",
  "rear naked choke",
  "asphyxiation",
  "slap mark",
  "impregnation",
  "holding another's wrist",
  "hand on another's head",
  "grabbing another's hair",
]);

// 牌面不要帶的 implies。抽牌邏輯仍保留；只影響插畫。
const ART_SKIP_IMPLY = {
  "testicle sucking": new Set(["sex"]),
};

const ART_NEG = {
  "testicle sucking": "fellatio",
  // 粗暴類不要畫成血腥傷口。掌痕若被 injury 壓掉，烘焙後再拿掉 injury 重烤。
  rape: "guro, blood, injury",
  "after rape": "guro, blood, injury, penetration",
  "worm's eye view": "worm, insect, bug, earthworm, caterpillar",
  "rough sex": "guro, blood, injury",
  strangling: "guro, blood, injury",
  "neck grab": "guro, blood, injury",
  headlock: "guro, blood, injury",
  "rear naked choke": "guro, blood, injury",
  asphyxiation: "guro, blood, injury",
  "slap mark": "guro, blood, injury",
  // 內射受孕是性行為，不是懷孕的肚子。
  impregnation: "pregnant, pregnant belly, maternity",
  // 抓手腕的手要在手腕上，不要改畫成摸胸。
  "holding another's wrist": "breast grab, grabbing another's breast, groping, paizuri, nipple tweak, hands on breasts, covering breasts, holding hands, handshake, interlocked fingers, ass grab, grabbing another's ass, breasts, ass, thighs, nipples, bandage, bandages, gauze, wristband, wrist wrap",
  fang: "vampire, demon",
  "covering privates": "spread pussy, visible pussy",
  // 高領衫不要畫成高領毛衣。汗滴、鼻頭紅不要畫成眼淚。腕環是裸腕上的環，不是女僕袖口。
  turtleneck: "sweater, ribbed sweater, turtleneck sweater",
  sweatdrop: "tears, crying, tearing up",
  "nose blush": "tears, crying, tearing up",
  "mole under mouth": "freckles, mole under eye",
  "wrist cuffs": "maid, maid headdress, dress, apron, frills, long sleeves, sleeves, shirt cuffs, handcuffs",
  skindentation: "latex, leotard, bodysuit, bodystocking, school uniform, serafuku, plaid skirt, child, teenage",
};

// 學校味重的衣著：畫的一定是成年人。
// 魔法少女在 Danbooru 上偏年幼的畫法，樂福鞋底模會自己配上學生制服：兩張都要明講成年。
const SCHOOL_CODED = new Set(["school uniform", "serafuku", "sailor dress", "school swimsuit", "gym uniform", "buruma", "magical girl", "loafers", "mary janes", "plaid skirt"]);

// 場景節裡要有人才畫得出來的：傢俱（坐在上面）、背景（白背景沒有人就是一張白紙）、
// 畫面特效（速度線、集中線、花瓣都是圍著人物的）。剪影也是 —— 沒有人就沒有剪影。
const SCENE_WITH_PERSON = new Set(["furniture", "background", "effect"]);
const ENV_WITH_PERSON = new Set(["silhouette"]);

// 場景節裡的物件：用風景去畫會小到看不見，改畫靜物。
export const STILL_LIFE = new Set([
  "incense burner", "incense", "folding fan", "hand fan", "scroll", "calligraphy", "guqin", "erhu",
  "teapot", "teacup", "folding screen", "lotus", "chrysanthemum", "silk", "beads", "spear", "polearm",
  "shield", "drum", "table", "amphora", "grapes", "wine glass", "lyre", "olive", "trident",
  "pocket watch", "cane", "birdcage", "violin", "lace", "rose", "clock", "pillow", "bed sheet", "chair",
  "swivel chair", "office chair", "gaming chair", "shower head", "innertube", "mirror",
  "full-length mirror", "tissue box", "basketball (object)", "soccer ball", "tennis ball",
  "volleyball (object)", "baseball (object)", "bowling ball", "golf ball", "tennis racket",
  "baseball bat", "golf club", "badminton racket", "table tennis paddle", "baseball mitt",
  "bow (weapon)", "shuttlecock", "table tennis ball", "arrow (projectile)", "guitar", "book", "pen",
  "cellphone", "cigarette", "frying pan", "shopping bag", "broom", "fishing rod", "game controller",
  "paintbrush", "kiseru", "smoking pipe", "cigar", "calligraphy brush", "quill", "pencil", "newspaper",
  "mop", "bucket", "ladle", "camera", "desk", "nightstand", "whiteboard", "microphone stand",
  "tea set", "crystal ball", "ofuda", "lamp", "oil lamp", "candelabra", "candle", "desk lamp",
  "microphone", "stethoscope", "condom", "condom wrapper", "condom box", "dildo", "vibrator", "sex toy", "lube",
]);

export const ART_SEED = 1383;
const QUALITY = "masterpiece, best quality, amazing quality";
const TAIL = { general: "sfw, general", sensitive: "sensitive", explicit: "nsfw, explicit" };

const MULTI = /^(?:[2-9]\+?(?:girls|boys)|multiple (?:girls|boys)|yuri)$/;

/** 這組卡司是不是不只一個人（同性別多人，或一男一女以上）。 */
const GIRLS = /^(?:\d\+?girls?|multiple girls|yuri)$/;
const BOYS = /^(?:\d\+?boys?|multiple boys)$/;

function isGroup(cast) {
  return cast.some((t) => MULTI.test(t)) || (cast.some((t) => GIRLS.test(t)) && cast.some((t) => BOYS.test(t)));
}

/**
 * 畫兩個人以上時，底模很愛把其中一個畫小、畫成小孩：2girls 出了一個穿帽 T 的小孩，
 * 4girls、2boys、multiple boys 都像全家福，一男一女的 kabedon、carrying 女生穿得像學生。
 * 只寫 adult 壓不住，正面補 mature female／male，負面再擋（見 artNegative）。
 */
function grownUps(cast) {
  if (!isGroup(cast)) return cast;
  const out = [...cast];
  if (out.some((t) => GIRLS.test(t)) && !out.includes("mature female")) out.push("mature female");
  if (out.some((t) => BOYS.test(t))) {
    if (!out.includes("adult male")) out.push("adult male");
    if (!out.includes("mature male")) out.push("mature male");
  }
  return out;
}

/** 畫這張牌要幾個人、誰。依詞庫的 needs／gate 判斷。 */
function castFor(item) {
  return grownUps(castOf(item));
}

function castOf(item) {
  const needs = new Set(item.needs || []);
  const tag = item.tag;
  // 人數牌。4boys 會被下面的數字規則接住。6+ 有加號，要先寫。
  if (tag === "6+girls") return ["6+girls", "adult"];
  if (tag === "6+boys") return ["6+boys", "adult male"];
  // 男同性戀題材和兄弟不要走「兩個男生再加一個女生」那條。
  if (tag === "yaoi" || needs.has("yaoi")) return ["2boys", "yaoi", "adult male"];
  if (tag === "brothers") return ["2boys", "brothers", "adult male"];
  // 姊妹、母女是兩個成年女性，不是百合。
  if (tag === "sisters" || tag === "mother and daughter") return ["2girls", tag, "mature female", "adult"];
  if (tag === "family") return ["1girl", "1boy", "family", "adult"];
  if (item.section === "subject") {
    if (/^\d(girls?|boys?)$/.test(tag)) return [tag, tag.includes("boy") ? "adult male" : "adult"];
    if (tag === "solo") return ["1girl", "solo", "adult"];
    // 詞庫裡 multiple girls／boys implies 2girls／2boys，卡司跟著畫兩個，不要自己打架。
    if (tag === "multiple girls") return ["2girls", "multiple girls", "adult"];
    if (tag === "multiple boys") return ["2boys", "multiple boys", "adult male"];
    if (tag === "hetero") return ["1girl", "1boy", "hetero", "adult"];
    if (tag === "yuri") return ["2girls", "yuri", "adult"];
  }
  if (HETERO_PICTURE.has(tag)) return ["1girl", "1boy", "hetero", "adult"];
  if (needs.has("five")) return ["4girls", "1boy", "adult"];
  if (needs.has("2female") && needs.has("male")) return ["2girls", "1boy", "adult"];
  if (needs.has("yuri") || needs.has("2female")) return ["2girls", "yuri", "adult"];
  if (needs.has("2male")) return ["1girl", "2boys", "adult"];
  if (needs.has("group") || needs.has("crowd")) return ["1girl", "multiple boys", "adult"];
  if (needs.has("pair")) return ["1girl", "1boy", "hetero", "adult"];
  if (item.gate === "male" || needs.has("male")) {
    return needs.has("female") ? ["1girl", "1boy", "hetero", "adult"] : ["1boy", "solo", "adult male"];
  }
  const out = ["1girl", "solo", "adult"];
  if (item.group === "body_f" || SCHOOL_CODED.has(tag)) out.push("mature female");
  return out;
}

/**
 * 一張牌的插畫 prompt。沒有插畫（純字版）回 null。
 * ctx: { byTag, actPlace, ratingBlocked }
 * 回傳 { positive, rating, negative }：rating 決定烘焙時用哪一級的負面詞，
 * negative 是這張另外要接上去的（擋未成年、擋全家福構圖）。
 */
export function artPrompt(item, ctx = {}) {
  if (!isCard(item) || NO_ART.has(item.tag)) return null;
  const rating = ratingTier(item, ctx.ratingBlocked);
  const byTag = ctx.byTag || new Map();
  const skip = ART_SKIP_IMPLY[item.tag];
  const implied = (item.implies || []).filter((t) => !skip || !skip.has(t));
  const extra = [ART_EXTRA[item.tag], ...implied, ...(item.bind || [])].filter((t) => t && (ART_EXTRA[item.tag] === t || byTag.has(t)));
  let parts;
  if (item.tag === "no humans") {
    parts = ["no humans", "scenery", "landscape", "sky", "cloud"];
  } else if (item.tag === "solo focus") {
    parts = ["1girl", "solo focus", "adult", "crowd", "street", "upper body"];
  } else if (STILL_LIFE.has(item.tag)) {
    parts = ["no humans", "still life", item.tag, ...extra, "simple background"];
  } else if (item.section === "env" && !SCENE_WITH_PERSON.has(item.group) && !ENV_WITH_PERSON.has(item.tag)) {
    parts = ["no humans", "scenery", item.tag, ...extra];
  } else if (item.group === "activity") {
    const places = ctx.actPlace && ctx.actPlace[item.tag];
    let place = "";
    if (places) for (const p of places) { place = p; break; }
    parts = [...castFor(item), item.tag, ...extra, place || "simple background"];
  } else if (item.section === "env") {
    parts = [...castFor(item), item.tag, ...extra, "full body"];
  } else {
    const framed = extra.some((e) => /\b(body|shot|portrait)\b/.test(e));
    const frame = framed ? "" : PERSON_FRAME[item.group] ?? "upper body";
    const bg = item.group === "camera" || item.group === "sex" ? "simple background" : "simple background, white background";
    parts = [...castFor(item), item.tag, ...extra, frame, bg];
  }
  const tags = [...new Set(parts.join(", ").split(",").map((s) => s.trim()).filter(Boolean))];
  const negative = [artNegative(tags), ART_NEG[item.tag], HETERO_PICTURE.has(item.tag) ? "yaoi" : ""].filter(Boolean).join(", ");
  return { positive: `${tags.join(", ")}, ${TAIL[rating]}, ${QUALITY}`, rating, negative };
}

// 有人的牌一律擋掉看起來未成年的畫法；server 的分級負面詞沒有這一項。
const AGE_GUARD = ["loli", "shota", "child", "aged down", "teenage", "kid", "toddler"];
// 多人的牌再擋「全家福」構圖 —— 小孩就是從這裡混進來的。
const GROUP_GUARD = ["family", "mother and daughter", "father and son", "siblings", "height difference"];

/** 插畫的額外負面詞（接在 server 的分級負面詞後面）。正面有的字不放，免得自己打架。 */
export function artNegative(tags) {
  if (tags.includes("no humans")) return "";
  const add = [...AGE_GUARD, ...(isGroup(tags) ? GROUP_GUARD : [])];
  return add.filter((t) => !tags.includes(t)).join(", ");
}
