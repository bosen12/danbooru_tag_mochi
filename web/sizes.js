/**
 * 生圖尺寸（墨池、疊印台、iPhone App 的抽牌橋共用一份）。都是 SDXL 常用的約一百萬像素、64 的倍數。
 * id 不能改：存檔、成品、App 都用 id 或寬高對回來（square／portrait／landscape 是最早那三個）。
 *   zh：選單上的字（「直 832×1216」）；short：只有方向（疊印台自己接寬高）。
 */
export const SIZES = [
  { id: "square", short: "方", zh: "方 1024²", w: 1024, h: 1024 },
  { id: "portrait-45", short: "直", zh: "直 896×1152", w: 896, h: 1152 },
  { id: "portrait", short: "直", zh: "直 832×1216", w: 832, h: 1216 },
  { id: "portrait-tall", short: "直", zh: "直 768×1344", w: 768, h: 1344 },
  { id: "landscape", short: "橫", zh: "橫 1216×832", w: 1216, h: 832 },
  { id: "landscape-wide", short: "橫", zh: "橫 1344×768", w: 1344, h: 768 },
];

/** 寬高對到的那一個（對不到就第一個：方）。 */
export const sizeOf = (w, h) => SIZES.find((s) => s.w === w && s.h === h) || SIZES[0];

/**
 * 選單旁邊的小方框：照長寬比畫一個小框，換尺寸時框從舊的比例變形成新的（groups.css 以外的 styles.css .size-ratio）。
 * paint(w, h) 換比例。只在網頁上用（抽牌橋不碰 DOM）。
 */
export function ratioBox(w, h) {
  const box = document.createElement("span");
  box.className = "size-ratio";
  box.setAttribute("aria-hidden", "true");
  const paint = (nw, nh) => {
    const long = Math.max(nw, nh) || 1;
    box.style.setProperty("--rw", (nw / long).toFixed(4));
    box.style.setProperty("--rh", (nh / long).toFixed(4));
    box.title = `${nw}×${nh}`;
  };
  paint(w, h);
  return { box, paint };
}
