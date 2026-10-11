/** Shared starter stories from the Fuse Bed. */
export const STARTERS = [
  // 現代
  { name: "雨夜街角", tags: ["umbrella", "rain", "night", "street"] },
  { name: "書房午後", tags: ["reading", "library", "glasses"] },
  { name: "海邊黃昏", tags: ["sundress", "beach", "sunset"] },
  { name: "咖啡店", tags: ["apron", "cafe", "smile"] },
  { name: "放學教室", tags: ["school uniform", "classroom", "sunset"] },
  { name: "屋頂星空", tags: ["rooftop", "starry sky", "night"] },
  { name: "白底立繪", tags: ["white background", "standing", "smile"] },
  { name: "閃亮舞台", tags: ["idol", "spotlight", "microphone", "sparkle"] },
  { name: "霓虹街頭", tags: ["jacket", "city lights", "neon lights", "night"] },
  { name: "櫻花校園", tags: ["school uniform", "falling petals", "cherry blossoms"] },
  { name: "雨後公園", tags: ["umbrella", "park", "rain"] },
  { name: "夏日泳池", tags: ["one-piece swimsuit", "pool", "splashing", "blue sky"] },
  { name: "單車兜風", tags: ["riding bicycle", "blue sky", "smile"] },
  { name: "早晨廚房", tags: ["apron", "kitchen", "cooking", "window light"] },
  { name: "賴床", tags: ["pajamas", "bedroom", "sleeping"] },
  { name: "樹影散步", tags: ["dress", "forest", "dappled sunlight"] },
  { name: "秋日落葉", tags: ["sweater", "park", "falling leaves"] },
  { name: "街頭帽T", tags: ["hoodie", "street", "day"] },
  { name: "溫泉", tags: ["onsen", "steam", "towel"] },
  { name: "電車窗邊", tags: ["train interior", "sitting", "window light"] },
  { name: "像素小品", tags: ["pixel art", "simple background", "smile"] },
  { name: "九〇年代", tags: ["1990s (style)", "anime coloring", "looking at viewer"] },
  { name: "魔法光點", tags: ["magic", "light particles", "fantasy"] },
  // 其他時代
  { name: "春日和服", tags: ["kimono", "cherry blossoms", "smile"] },
  { name: "夏祭浴衣", tags: ["yukata", "paper lantern", "festival", "night"] },
  { name: "道場", tags: ["hakama", "dojo"] },
  { name: "古風庭園", tags: ["hanfu", "east asian architecture", "bamboo"] },
  { name: "城堡騎士", tags: ["armor", "castle", "cape"] },
  { name: "維多利亞茶會", tags: ["victorian", "dress", "teacup"] },
  { name: "希臘神殿", tags: ["ancient greek clothes", "greco-roman architecture", "sunlight"] },
];

/** Reuse Fuse's three-story draw, filtering complete stories and avoiding the last group. */
export function pickStarters(allowed, avoid = [], rand = Math.random) {
  const ok = STARTERS.filter(s => s.tags.every(allowed));
  const fresh = ok.filter(s => !avoid.includes(s.name));
  const bag = [...(fresh.length >= 3 ? fresh : ok)];
  const out = [];
  while (out.length < 3 && bag.length) out.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
  return out;
}

/** Keep normal redraws stable; replace choices invalidated by rating or bans. */
export function refreshStarters(current, allowed, rand = Math.random) {
  return current?.length && current.every(s => s.tags.every(allowed))
    ? current
    : pickStarters(allowed, [], rand);
}
