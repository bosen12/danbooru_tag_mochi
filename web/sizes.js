/**
 * 生圖尺寸（墨池、疊印台、iPhone App 的抽牌橋共用一份）。SDXL／Illustrious 常用的一百萬到一百六十萬像素、64 的倍數。
 * id 不能改：存檔、成品、App 都用 id 或寬高對回來（square／portrait／landscape 是最早那三個）。
 *   zh：選單上的字（「直 832×1216」）；short：只有方向（疊印台自己接寬高）。
 *   ratio、note、star：滑鼠移到選項上跳出來的說明（sizeTip）：比例、適合畫什麼、推薦的打星。
 * 選單照方、直、橫排，直、橫各自從接近方的排到最長的。
 * 2026-11-22 專案主給的推薦表：加了 1024×1344、896×1344、1024×1536、960×1280、1152×896，用途照表寫；
 * 896×1152、768×1344 不在表上（原本就有，留著），用途是這邊補的。
 */
export const SIZES = [
  { id: "square", short: "方", zh: "方 1024²", w: 1024, h: 1024, ratio: "1:1", note: "頭像、方形插畫" },
  { id: "portrait-45", short: "直", zh: "直 896×1152", w: 896, h: 1152, ratio: "7:9", note: "接近方的直圖：胸像、半身" },
  { id: "portrait-1024x1344", short: "直", zh: "直 1024×1344", w: 1024, h: 1344, ratio: "16:21", note: "通用人物、半身、全身", star: true },
  { id: "portrait-960x1280", short: "直", zh: "直 960×1280", w: 960, h: 1280, ratio: "3:4", note: "人物插畫、半身" },
  { id: "portrait", short: "直", zh: "直 832×1216", w: 832, h: 1216, ratio: "13:19", note: "單人角色、節省 VRAM" },
  { id: "portrait-896x1344", short: "直", zh: "直 896×1344", w: 896, h: 1344, ratio: "2:3", note: "全身立繪、角色設計", star: true },
  { id: "portrait-1024x1536", short: "直", zh: "直 1024×1536", w: 1024, h: 1536, ratio: "2:3", note: "修長構圖、全身人物" },
  { id: "portrait-tall", short: "直", zh: "直 768×1344", w: 768, h: 1344, ratio: "4:7", note: "細長直圖：全身站姿、手機桌布" },
  { id: "landscape-1152x896", short: "橫", zh: "橫 1152×896", w: 1152, h: 896, ratio: "9:7", note: "橫向人物、雙人" },
  { id: "landscape", short: "橫", zh: "橫 1216×832", w: 1216, h: 832, ratio: "19:13", note: "場景、多人構圖" },
  { id: "landscape-wide", short: "橫", zh: "橫 1344×768", w: 1344, h: 768, ratio: "7:4", note: "寬幅場景、風景" },
];

/** 滑鼠移到尺寸選項（和選單本身）上跳出來的說明：「⭐ 推薦・16:21・通用人物、半身、全身」。英文版整句在 en.js。 */
export const sizeTip = (s) => `${s.star ? "⭐ 推薦・" : ""}${s.ratio}・${s.note}`;

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
