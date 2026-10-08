/**
 * 介紹影片（film.js）和它的成品圖（scripts/render_intro_art.mjs）共用的資料：
 * 同一組釘選、同一套挑種子的規則 —— 影片上寫的種子、提示詞，就是 ComfyUI 真的畫出那張圖用的。
 */
// 引擎的函式由呼叫的人傳進來（eng＝{ drawOne, mulberry32, applyPin, emptyBed, placeCard }）：
// 網頁上 engine.js 是伺服器從 web/ 補上的，node 直接 import 找不到 web6/engine.js。

// 整組不要的（抽到就換下一個種子）：公開展示不放裸露、內衣、泳裝、哭泣…
// 身材誇張（large／huge／gigantic breasts）、蒙眼、曬痕這類也不當展示圖。
export const DRAW_BAD = /nude|naked|pant(y|ie)|underwear|lingerie|cleavage|bikini|swimsuit|sex|blood|cry|tears|bath|wet|lying|large breasts|huge breasts|gigantic breasts|blindfold|tanlines|gag|collar|leash|bondage|restrained|sweat|from behind|ass|squatting|spread legs|from below|upskirt|skirt lift|midriff|navel/;

/** 墨池那段放進合成池的五張。 */
export const MOCHI_POOL = ["1girl", "red hair", "kimono", "cherry blossoms", "sunset"];
/** 疊印台那段照順序放上版的牌。 */
export const FUSE_ORDER = ["1girl", "red hair", "long hair", "kimono", "standing", "cherry blossoms", "sunset"];

/** 從 from 開始往後找 count 個乾淨的種子，回傳 [{ seed, positive, tags }]。 */
export function cleanDraws(eng, lex, settings, pins, count, from = 1) {
  const out = [];
  for (let seed = from; out.length < count && seed < 5000; seed++) {
    const positive = eng.drawOne(lex, settings, new Set(pins), new Set(), eng.mulberry32(seed), seed).positive;
    const tags = positive.split(",").map((s) => s.trim()).filter(Boolean);
    if (!tags.includes("1girl")) continue;
    if (tags.some((t) => DRAW_BAD.test(t))) continue;
    out.push({ seed, positive, tags });
  }
  return out;
}

/** 疊印台的版：照 FUSE_ORDER 用真的 placeCard 放（互斥、附帶都照引擎）。 */
export function fuseBed(eng, lex, has = () => true) {
  let bed = eng.emptyBed();
  const order = FUSE_ORDER.filter(has);
  for (const t of order) bed = eng.placeCard(bed, t, { lex, applyPin: eng.applyPin }).bed;
  return { bed, order };
}

/**
 * 挑定的種子。先用 cleanDraws 篩掉不適合展示的，再把候選真的送進 ComfyUI 畫
 * （node scripts/render_intro_art.mjs <伺服器> --candidates 6 <資料夾>），用眼睛挑構圖。
 * 影片上的種子、提示詞就是這幾個；換了底模或詞庫要重挑。
 */
export const PICKED = { mochi: 24, fuse: [40, 57, 19, 28] };

/** 用指定的種子抽一張（跟 cleanDraws 回傳一樣的形狀）。 */
export function drawAt(eng, lex, settings, pins, seed) {
  const positive = eng.drawOne(lex, settings, new Set(pins), new Set(), eng.mulberry32(seed), seed).positive;
  return { seed, positive, tags: positive.split(",").map((s) => s.trim()).filter(Boolean) };
}

/** 影片裡出現的成品：墨池一張、疊印台試印 A（付印）、B、C（晾在繩上），D 只有影子。 */
export function filmPrints(eng, lex, settings) {
  const mochi = drawAt(eng, lex, settings, MOCHI_POOL, PICKED.mochi);
  const { bed } = fuseBed(eng, lex);
  const trials = PICKED.fuse.map((seed) => drawAt(eng, lex, settings, bed.pins, seed));
  return {
    mochi: { ...mochi, pins: MOCHI_POOL },
    fuseA: { ...trials[0], pins: bed.pins },
    fuseB: { ...trials[1], pins: bed.pins },
    fuseC: { ...trials[2], pins: bed.pins },
    trials,
    bed,
  };
}
