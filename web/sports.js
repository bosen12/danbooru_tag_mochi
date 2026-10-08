// 運動的單一資料來源。
//
// 以前運動規則散在 BUILTIN_PRESETS、SPORT_KIT、SPORT_BALL、SPORT_PROP、SPORT_UNIFORMS
// 五個常數裡，改一個地方就會跟其他四個失同步。現在只有這一份，其餘全部由它算出來：
// 釘選組合的 tags、抽牌時的運動互斥、活動能配哪些場地、測試案例。
//
// tag 全部用專案內的空格格式，且都通過 Danbooru API 核實（category=0、post_count>0、
// 非 deprecated）。核實腳本：scripts/verify_danbooru_tags.mjs。
//
// 刻意不用的 tag，理由記在這裡免得以後有人「順手補回去」：
//   basketball / baseball          deprecated
//   volleyball                     已 alias 到 2026 年的新名稱
//   volleyball court               post_count 0
//   baseball glove                 alias，正解是 baseball mitt
//   cycling / golf uniform         post_count 0
//   tennis shoes / archery range   post_count 0
//   ice rink                       post_count 0
//   arrow / yumi                   deprecated，正解是 arrow (projectile)
//   basketball (sport) 等三個      2026 年才建立，WAI Illustrious 的舊 Danbooru 語彙吃不到

// 跨運動通用的裝備。這些**不代表運動身分**，所以不參與互斥判斷
// （球鞋、運動服、護膝、蛙鏡、棒球帽在非運動圖裡也很常見）。
export const SPORT_NEUTRAL_GEAR = new Set([
  "sneakers",
  "sportswear",
  "goggles",
  "knee pads",
  "baseball cap",
]);

// preset: false 的項目不會出現在釘選組合按鈕上，只是讓抽牌時的運動互斥認得它們。
export const SPORT_PRESETS = [
  {
    id: "hoops", // 舊 id，保留相容
    name: "籃球",
    activity: "playing sports",
    venue: ["basketball court"],
    equipment: ["basketball (object)"],
    clothing: ["basketball uniform", "sneakers"],
    optionalEquipment: [],
  },
  {
    id: "tennis",
    name: "網球",
    // 有自己的 activity tag，就不要再疊 playing sports —— 兩個 activity 會互斥。
    activity: "tennis",
    venue: ["tennis court"],
    equipment: ["tennis racket", "tennis ball"],
    clothing: ["tennis uniform", "sneakers"],
    optionalEquipment: [],
  },
  {
    id: "soccer",
    name: "足球",
    activity: "soccer",
    venue: ["soccer field"],
    equipment: ["soccer ball"],
    clothing: ["soccer uniform", "cleats"],
    optionalEquipment: [],
  },
  {
    id: "baseball",
    name: "棒球",
    activity: "playing sports",
    venue: ["baseball stadium"],
    // 球棒進、手套不進：單人構圖同時拿棒子和守備手套會變成打者兼守備員。
    equipment: ["baseball (object)", "baseball bat"],
    clothing: ["baseball uniform", "baseball cap", "cleats"],
    optionalEquipment: ["baseball mitt"],
  },
  {
    id: "volleyball",
    name: "排球",
    activity: "playing sports",
    // volleyball court 的 post_count 是 0；用較早且已驗證的學校體育館。
    venue: ["school gym"],
    equipment: ["volleyball (object)"],
    clothing: ["volleyball uniform", "knee pads", "sneakers"],
    optionalEquipment: [],
  },
  {
    id: "badminton",
    name: "羽球",
    activity: "badminton",
    venue: ["school gym"],
    equipment: ["badminton racket", "shuttlecock"],
    // Danbooru 沒有堪用的 badminton uniform，不發明。
    clothing: ["sportswear", "sneakers"],
    optionalEquipment: [],
  },
  {
    id: "tabletennis",
    name: "桌球",
    activity: "table tennis",
    venue: ["school gym"],
    // 球拍是 table tennis paddle，不是 post_count 0 的 table tennis racket。
    equipment: ["table tennis paddle", "table tennis ball"],
    clothing: ["sportswear", "sneakers"],
    optionalEquipment: [],
  },
  {
    id: "swim",
    name: "游泳",
    activity: "swimming",
    venue: ["pool"],
    equipment: [],
    clothing: ["competition swimsuit", "swim cap", "goggles"],
    optionalEquipment: [],
  },
  {
    id: "boxing",
    name: "拳擊",
    activity: "boxing",
    venue: ["boxing ring"],
    equipment: [],
    // 拳擊手套是戴在身上的（lexicon 裡是 clothing/acc/hands），不是會限定場地的器材。
    // 放進 equipment 會讓隨機抽到手套的廚房場景被擋掉廚房。
    clothing: ["boxing gloves", "boxing shorts"],
    optionalEquipment: [],
  },
  {
    id: "track", // 舊 id，保留相容
    name: "田徑",
    activity: "track and field",
    venue: ["running track"],
    equipment: [],
    // relay baton 只代表接力賽，不該是每張田徑圖的必進項目。
    clothing: ["track uniform", "sneakers"],
    optionalEquipment: [],
  },
  {
    id: "golf",
    name: "高爾夫",
    activity: "golf",
    venue: ["golf course"],
    equipment: ["golf club", "golf ball"],
    // golf uniform 的 post_count 是 0。
    clothing: ["sportswear"],
    optionalEquipment: [],
  },
  {
    id: "cycling",
    name: "自行車",
    activity: "riding bicycle",
    venue: [],
    equipment: ["bicycle"],
    clothing: ["bicycle helmet", "sportswear", "sneakers"],
    optionalEquipment: [],
  },
  {
    id: "archery",
    name: "射箭",
    activity: "archery",
    venue: [],
    equipment: ["bow (weapon)", "arrow (projectile)"],
    clothing: ["sportswear"],
    optionalEquipment: [],
  },

  // 以下沒有按鈕，只是讓互斥規則認得既有的滑雪和保齡球。
  {
    id: "ski",
    name: "滑雪",
    preset: false,
    activity: "skiing",
    venue: ["mountain"],
    equipment: [],
    clothing: [],
    optionalEquipment: [],
  },
  {
    id: "bowling",
    name: "保齡球",
    preset: false,
    activity: null,
    venue: ["bowling alley"],
    equipment: ["bowling ball"],
    clothing: [],
    optionalEquipment: [],
  },
];

/**
 * 這個 preset 的「必進 POS」清單：場地 → 器材 → 服裝。
 *
 * 活動 tag 預設不在裡面。第二個參數為 true 時才加入，讓使用者可以選擇
 * 是否把運動動作也固定進必進 POS。未固定時改由抽牌按當張尺度決定：
 * 抽到活動／誘惑／走光尺度就自動帶上該運動的活動（見 engine 的活動欄偏好），
 * 抽到性愛尺度就讓位給體位。釘死的話性愛動作會被整個擋掉（會動的活動跟性愛
 * 動作不能並存），選「活動＋性愛」就永遠只剩一邊。
 *
 * 運動身分仍然由活動 tag 參與判斷，見 SPORT_IDENTITY。
 */
export function sportPresetTags(p, includeActivity = false) {
  if (!p) return [];
  return [
    ...(includeActivity && p.activity ? [p.activity] : []),
    ...(p.venue || []),
    ...(p.equipment || []),
    ...(p.clothing || []),
  ];
}

/** 這個運動的主活動 tag（沒有就回 null）。抽牌時用來優先挑對的活動。 */
export function sportActivityOf(p) {
  return (p && p.activity) || null;
}

/** 會出現在釘選組合列上的運動。 */
export const SPORT_BUTTONS = SPORT_PRESETS.filter((p) => p.preset !== false);

export const SPORT_BY_ID = new Map(SPORT_PRESETS.map((p) => [p.id, p]));

/**
 * 場地 → 哪些運動可以合理使用它。這是活動配場地的唯一資料來源；一般城市、山、
 * 公園等雖然本身不帶運動身分，仍可在這裡宣告成某項運動的合理場地。
 */
export const SPORT_VENUES = {
  "basketball court": { sports: ["hoops"], where: "either" },
  "tennis court": { sports: ["tennis"], where: "either" },
  "soccer field": { sports: ["soccer"], where: "outdoor" },
  "baseball stadium": { sports: ["baseball"], where: "outdoor" },
  "sports court": {
    sports: ["hoops", "tennis", "volleyball", "badminton", "tabletennis", "archery"],
    where: "either",
  },
  "school gym": {
    sports: ["hoops", "tennis", "volleyball", "badminton", "tabletennis", "boxing", "archery"],
    where: "indoor",
  },
  pool: { sports: ["swim"], where: "either" },
  "boxing ring": { sports: ["boxing"], where: "indoor" },
  "running track": { sports: ["track", "cycling"], where: "outdoor" },
  stadium: { sports: ["soccer", "track", "archery", "cycling"], where: "outdoor" },
  park: { sports: ["soccer", "cycling"], where: "outdoor" },
  "golf course": { sports: ["golf"], where: "outdoor" },
  street: { sports: ["cycling"], where: "outdoor" },
  city: { sports: ["cycling"], where: "outdoor" },
  cityscape: { sports: ["cycling"], where: "outdoor" },
  alley: { sports: ["cycling"], where: "outdoor" },
  forest: { sports: ["cycling"], where: "outdoor" },
  mountain: { sports: ["cycling", "ski"], where: "outdoor" },
  garden: { sports: ["cycling"], where: "outdoor" },
  courtyard: { sports: ["cycling", "archery"], where: "outdoor" },
  beach: { sports: ["cycling"], where: "outdoor" },
  dojo: { sports: ["archery"], where: "indoor" },
  "bowling alley": { sports: ["bowling"], where: "indoor" },
};

/**
 * 明確的 tag → 運動相容範圍。沒列出的 tag 都是 neutral，永遠不建立運動限制。
 * 這裡描述相容性，不從「某套 preset 剛好包含什麼」反推，避免 kit membership 被誤當身分。
 */
const SPORT_TAG_SCOPE_DATA = {
  "basketball court": ["hoops"],
  "basketball (object)": ["hoops"],
  "basketball uniform": ["hoops"],
  tennis: ["tennis"],
  "tennis court": ["tennis"],
  "tennis racket": ["tennis"],
  "tennis ball": ["tennis"],
  "tennis uniform": ["tennis"],
  soccer: ["soccer"],
  "soccer field": ["soccer"],
  "soccer ball": ["soccer"],
  "soccer uniform": ["soccer"],
  "baseball stadium": ["baseball"],
  "baseball (object)": ["baseball"],
  "baseball bat": ["baseball"],
  "baseball mitt": ["baseball"],
  "baseball uniform": ["baseball"],
  "volleyball (object)": ["volleyball"],
  "volleyball uniform": ["volleyball"],
  badminton: ["badminton"],
  "badminton racket": ["badminton"],
  shuttlecock: ["badminton"],
  "table tennis": ["tabletennis"],
  "table tennis paddle": ["tabletennis"],
  "table tennis ball": ["tabletennis"],
  swimming: ["swim"],
  pool: ["swim"],
  "competition swimsuit": ["swim"],
  "swim cap": ["swim"],
  boxing: ["boxing"],
  "boxing ring": ["boxing"],
  "boxing gloves": ["boxing"],
  "boxing shorts": ["boxing"],
  "track and field": ["track"],
  "running track": ["track", "cycling"],
  "track uniform": ["track"],
  cleats: ["soccer", "baseball", "track"],
  golf: ["golf"],
  "golf course": ["golf"],
  "golf club": ["golf"],
  "golf ball": ["golf"],
  "riding bicycle": ["cycling"],
  bicycle: ["cycling"],
  "bicycle helmet": ["cycling"],
  archery: ["archery"],
  "bow (weapon)": ["archery"],
  "arrow (projectile)": ["archery"],
  skiing: ["ski"],
  "bowling alley": ["bowling"],
  "bowling ball": ["bowling"],
  "sports court": ["hoops", "tennis", "volleyball", "badminton", "tabletennis", "archery"],
  "school gym": ["hoops", "tennis", "volleyball", "badminton", "tabletennis", "boxing", "archery"],
};

export const SPORT_TAG_SCOPE = new Map(
  Object.entries(SPORT_TAG_SCOPE_DATA).map(([tag, sports]) => [tag, new Set(sports)])
);

// 舊名稱保留給 engine 與外部呼叫者；內容現在是顯式 scope，不再由 preset 反推。
export const SPORT_IDENTITY = SPORT_TAG_SCOPE;

/** 活動 → 合理場地，由 SPORT_VENUES 與 preset activity 同源推導。 */
export const SPORT_ACT_PLACE = (() => {
  const out = {};
  for (const p of SPORT_PRESETS) {
    if (!p.activity) continue;
    if (!out[p.activity]) out[p.activity] = [];
    for (const [venue, meta] of Object.entries(SPORT_VENUES)) {
      if (meta.sports.includes(p.id) && !out[p.activity].includes(venue)) out[p.activity].push(venue);
    }
  }
  return out;
})();

/**
 * 只由「活動＋場地＋器材」建的身分表，**不含服裝**。
 *
 * 限定場地要用這一份：人可以穿著排球服在廚房，但不能在浴室騎腳踏車。用含服裝的
 * SPORT_IDENTITY 去限場地會誤傷 —— 隨機抽到釘鞋的煮飯場景會被擋掉廚房。
 */
export const SPORT_GEAR_IDENTITY = (() => {
  const m = new Map();
  const add = (tag) => {
    const scope = SPORT_TAG_SCOPE.get(tag);
    if (scope) m.set(tag, new Set(scope));
  };
  for (const p of SPORT_PRESETS) {
    add(p.activity);
    for (const t of [...(p.venue || []), ...(p.equipment || []), ...(p.optionalEquipment || [])]) {
      add(t);
    }
  }
  for (const venue of Object.keys(SPORT_VENUES)) add(venue);
  return m;
})();

/** 只看器材的交集。回 null＝沒有器材線索。 */
export function sportGearIdsOf(tags) {
  let ids = null;
  for (const t of tags) {
    const own = SPORT_GEAR_IDENTITY.get(t);
    if (!own) continue;
    if (ids === null) {
      ids = new Set(own);
      continue;
    }
    for (const id of [...ids]) if (!own.has(id)) ids.delete(id);
  }
  return ids;
}

/** preset 擁有的 tag（含選配器材）—— 用來判斷「這個 tag 是不是這個運動的」。 */
export function sportOwnedTags(p) {
  return new Set([
    ...(p.activity ? [p.activity] : []),
    ...sportPresetTags(p),
    ...(p.optionalEquipment || []),
  ]);
}

/**
 * 從一堆 tag 推出還剩哪些運動說得通。
 * 回 null＝完全沒有運動線索，不構成限制；回空集合＝已經自相矛盾。
 */
export function sportIdsOf(tags) {
  let ids = null;
  for (const t of tags) {
    const own = SPORT_IDENTITY.get(t);
    if (!own) continue;
    if (ids === null) {
      ids = new Set(own);
      continue;
    }
    for (const id of [...ids]) if (!own.has(id)) ids.delete(id);
  }
  return ids;
}

/** 這個 tag 能不能和已經在場上的東西共存（同一個運動才行）。 */
export function sportTagAllowed(tag, used) {
  const own = SPORT_IDENTITY.get(tag);
  if (!own) return true; // 不帶運動身分的字一律放行
  const ids = sportIdsOf(used);
  if (ids === null) return true; // 場上還沒有運動線索
  for (const id of own) if (ids.has(id)) return true;
  return false;
}

/** 驗證器的完整 inventory：preset 各角色與所有相容場地都只從這裡匯出。 */
export function allSportTags() {
  const tags = new Set(Object.keys(SPORT_VENUES));
  for (const p of SPORT_PRESETS) {
    if (p.activity) tags.add(p.activity);
    for (const t of [...sportPresetTags(p), ...(p.optionalEquipment || [])]) tags.add(t);
  }
  for (const places of Object.values(SPORT_ACT_PLACE)) for (const place of places) tags.add(place);
  return [...tags].sort();
}

/** 新加的運動活動 tag。engine 要把它們一起當成「會動的活動」處理。 */
export const SPORT_MOVE_ACTS = [
  "tennis",
  "soccer",
  "badminton",
  "table tennis",
  "boxing",
  "track and field",
  "golf",
  "archery",
];
