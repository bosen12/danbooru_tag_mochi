/** Clothing keys, underwear / layer helpers. No UI copy. */
import { REASONS } from "../trace.js";

const GARMENT_KEYS = [
  "shirt",
  "dress",
  "skirt",
  "sweater",
  "bikini",
  "swimsuit",
  "bra",
  "panties",
  "panty",
  "leotard",
  "coat",
  "jacket",
  "kimono",
  "yukata",
  "pants",
  "shorts",
  "jeans",
  "hoodie",
  "blouse",
  "towel",
];

const KEY_WEAR = {
  panty: ["panties", "thong", "panty"],
  panties: ["panties", "thong", "panty"],
  pants: ["pants", "jeans", "shorts"],
  jeans: ["jeans", "pants"],
  shorts: ["shorts"],
};

function tagTokens(tag) {
  return String(tag || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

export function actionGarmentKeys(actionTag) {
  const toks = new Set(tagTokens(actionTag));
  const keys = GARMENT_KEYS.filter((g) => toks.has(g));
  // downblouse 是「從領口往下看」，任何上衣都成立。舊寫法是 /blouse/ 子字串比對，
  // 詞庫裡只命中這一個字，效果等於「只認 blouse 這一件」：3000 張現代走光裡只有
  // 42 張穿 blouse，downblouse 抽到 2 次。
  // sports bra lift 的 token 裡有 bra，於是任何一件胸罩都算數；它要的是 sports bra。
  // 這個誤判在走光補抽改成一字一票之後會被放大（實測 17.2%，排第一）。
  if (/sports bra/.test(actionTag)) {
    const i = keys.indexOf("bra");
    if (i >= 0) keys.splice(i, 1, "sports bra");
  }
  if (/(^|\s)downblouse$/.test(actionTag)) {
    for (const k of ["shirt", "blouse", "dress", "sweater", "hoodie"]) if (!keys.includes(k)) keys.push(k);
  }
  if (/upskirt/.test(actionTag)) {
    if (!keys.includes("skirt")) keys.push("skirt");
    if (!keys.includes("dress")) keys.push("dress");
  }
  if (/(cameltoe|wedgie)/.test(actionTag) && !keys.includes("panty")) keys.push("panty");
  return keys;
}

export function needsBodyClothes(actionTag) {
  const t = String(actionTag || "").toLowerCase();
  return (
    /through clothes|under clothes/.test(t) ||
    t === "clothed sex" ||
    t === "clothed female nude male" ||
    t === "clothes lift" ||
    t === "clothes pull" ||
    t === "clothing aside" ||
    t === "undressing" ||
    t === "undressing another" ||
    t === "clothes grab" ||
    t === "upskirt" ||
    t === "cameltoe" ||
    t === "wedgie" ||
    t === "strap slip" ||
    t === "areola slip" ||
    t === "nipple slip" ||
    t === "one breast out" ||
    t === "flashing" ||
    t === "erection under clothes" ||
    t === "bulge" ||
    t === "adjusting clothes" ||
    t === "clothes tug"
  );
}

export function clothingWearsKey(clothingTag, key) {
  const tag = String(clothingTag || "").toLowerCase();
  if (!tag || tag.startsWith("no ")) return false;
  // 泳裝在衣服底下。這句自己不是那件泳裝，也不能拿來證明身上有衣服。
  if (tag === "swimsuit under clothes") return false;
  const aliases = KEY_WEAR[key] || [key];
  const toks = new Set(tagTokens(tag));
  return aliases.some((w) => {
    if (tag === w || tag.endsWith(" " + w) || tag.endsWith(w)) return true;
    return tagTokens(w).every((t) => toks.has(t));
  });
}

const CLOTHES_ACCESSORY = new Set([
  "towel",
  "belt",
  "earrings",
  "kanzashi",
  "necklace",
  "bracelet",
  "choker",
  "ring",
  "hairband",
  "hair ornament",
]);

function wornBodyGarments(clothingTags) {
  return (clothingTags || []).filter((t) => {
    if (!t || t.startsWith("no ") || t === "nude" || t === "completely nude") return false;
    if (CLOTHES_ACCESSORY.has(t)) return false;
    return GARMENT_KEYS.some((k) => k !== "towel" && clothingWearsKey(t, k));
  });
}

export function actionFitsClothes(actionTag, clothingTags) {
  const worn = (clothingTags || []).filter(Boolean);
  const keys = actionGarmentKeys(actionTag);
  if (needsBodyClothes(actionTag)) {
    if (worn.some((t) => t === "nude" || t === "completely nude")) return 0;
    if (keys.length) return keys.some((k) => worn.some((c) => clothingWearsKey(c, k))) ? 2 : 0;
    return wornBodyGarments(worn).length ? 2 : 0;
  }
  if (!keys.length) return 1;
  return keys.some((k) => worn.some((c) => clothingWearsKey(c, k))) ? 2 : 0;
}

/** Garment-named pose actions also need a fit check outside the flash group. */
export function needsClothingDependency(item) {
  return !!item && (
    item.mutex === "clothes_action" || item.group === "flash" ||
    needsBodyClothes(item.tag) ||
    (item.section === "pose" && actionGarmentKeys(item.tag).length > 0)
  );
}


export { wornBodyGarments };

export function evaluateClothingLayer(item, ctx) {
  const used = ctx.used || new Set();
  const pinned = ctx.pinned || new Set();
  if (!item) return { ok: true };
  const nude = used.has("nude") || used.has("completely nude") || item.tag === "nude" || item.tag === "completely nude";
  const isGarment = item.section === "clothing" && item.layer === "garment";
  if (nude && isGarment && !pinned.has(item.tag) && item.layer !== "accessory") {
    return { ok: false, reason: REASONS.clothing_layer, related: ["nude"] };
  }
  return { ok: true };
}

export function evaluateUnderwearVisibility(item, ctx) {
  if (!item) return { ok: true };
  const used = ctx.used || new Set();
  const underwear = item.mutex === "underwear_top" || item.mutex === "underwear_bottom" || item.group === "underwear";
  if (!underwear) return { ok: true };
  const clothesAction = [...used].some((t) => {
    const it = ctx.lex?.byTag.get(t);
    return it && (it.mutex === "clothes_action" || it.group === "flash");
  });
  const covering = [...used].some((t) => {
    const it = ctx.lex?.byTag.get(t);
    return it && it.section === "clothing" && it.layer === "garment" && (it.mutex === "onepiece" || it.mutex === "top" || it.mutex === "bottom");
  });
  if (covering && !clothesAction && !(ctx.pinned || new Set()).has(item.tag)) {
    return { ok: false, reason: REASONS.underwear_hidden, related: [...used].filter((t) => ctx.lex?.byTag.get(t)?.layer === "garment") };
  }
  return { ok: true };
}
