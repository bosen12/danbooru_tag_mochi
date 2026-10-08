/**
 * 墨池牌面插畫挑圖：照這張牌實際畫出來的大小 × DPR，挑一張剛好的細縮圖（mini）。
 *
 * 為什麼不交給 srcset：插畫是 object-fit: cover，要縮到的是「整張圖蓋滿格子」的寬（約等於牌寬），
 * 不是 <img> 的寬；而且 Chromium 把圖縮小超過一半就改用 mipmap，線條出鋸齒（毛邊）——
 * 200px 縮圖畫進 91px 的牌、480px 原圖畫進 92px 的合成池都是這樣。實測（8 倍超取樣當參考）
 * 來源寬是畫出寬的 1.2～2 倍最乾淨，srcset 的「挑夠大的最小一張」做不到這個區間，所以自己挑。
 *
 * 檔案與 manifest 的格式見 scripts/card_thumbnails.py。mini 對不上原圖現在的版本（重烤過）、
 * 或根本沒有，就照舊用 card-art.js 的縮圖／原圖（applyArtSources），什麼都不會壞。
 * 挑到的 mini 載入失敗就退回原圖；原圖也失敗才交給呼叫的人（牌面會拿掉 <img> 顯示字）。
 *
 * 量尺寸：每張圖只在第一次排版後讓 ResizeObserver 看一眼就放掉（不常駐、不留參照），
 * 還沒排版就被拿掉的，定時掃一次放掉。視窗大小或 DPR（換螢幕、縮放）變了，
 * 才把畫面上的圖（img[data-art-pick]）再看一眼。
 */
import { applyArtSources } from "./card-art.js";

// 來源寬 ÷ 畫出寬：先挑 ≥ AIM 的最小一張；那張超過 2 倍（會走 mipmap）而小一號還有 LOW 以上，就用小一號。
// 牌階 160／240／320／原圖 480。桌機 DPR 1 的牌（90～92px）拿 160（約 1.75 倍），70px 的手牌也是 160；
// DPR 2 的牌（約 181～197，含手機）拿 240（1.2～1.33 倍；實測 1.33 倍比 320 還乾淨，也比 320 省一半流量）。
// 夠大的只剩原圖、而最大的 mini 也有 LOW 以上，就用 mini：iPhone（DPR 3）一張 92px 的牌要 276，
// 320 是 1.16 倍，3 倍螢幕上看不出差別；原圖每張 36KB、320 只要 24KB，一頁幾十張差很多。
const AIM = 1.2;
const LOW = 1.1;
const HIGH = 2;
// 原圖 480×702；mini 也是同一個比例。
const SRC_W = 480;
const SRC_AR = 480 / 702;
// 還沒量過時先猜的「蓋滿寬」（CSS px）：桌機一張牌約 90～92px，手牌 70px。量到之後就用量到的。
const guess = { card: 92, hand: 70 };

/**
 * manifest 一筆 → { full, list: [{ w, url }]（小到大） }；沒有可用的 mini 回 null。
 * entry.file 要先換成 artFile(tag)（跟 card-art.js 的 artUrl 同一個規矩）。
 */
export function miniSet(entry, base = "cards/") {
  const mini = entry && entry.mini;
  if (!mini || typeof mini !== "object" || !entry.v || mini.src !== entry.v || !mini.w) return null;
  const stem = entry.file.replace(/\.webp$/i, "");
  const list = Object.entries(mini.w)
    .map(([w, h]) => ({ w: Number(w), h }))
    .filter(({ w, h }) => Number.isInteger(w) && w > 0 && w < SRC_W && /^[0-9a-f]{10}$/.test(h))
    .sort((a, b) => a.w - b.w)
    .map(({ w, h }) => ({ w, url: `${base}mini/${w}/${stem}-${h}.webp?v=${h}` }));
  if (!list.length) return null;
  return { full: `${base}${entry.file}?v=${encodeURIComponent(entry.v)}`, list };
}

/** 要畫成 need 個裝置像素寬：照上面的規矩在 mini 和原圖裡挑一張的網址。 */
export function chooseArt(set, need) {
  const all = [...set.list, { w: SRC_W, url: set.full }];
  const i = all.findIndex((c) => c.w >= need * AIM);
  if (i < 0) return set.full;
  if (i > 0 && (all[i].w > need * HIGH || i === all.length - 1) && all[i - 1].w >= need * LOW) return all[i - 1].url;
  return all[i].url;
}

/** cover 之後圖要蓋滿的寬（CSS px）：格子比圖窄，就是高 × 圖的寬高比。 */
export function coverWidth(w, h) {
  return Math.max(w, h * SRC_AR);
}

const dpr = () => (typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1);

/* ---------- 量一眼就放掉的 ResizeObserver ---------- */

const bound = new WeakMap(); // img → { set, kind }
const pending = new Set(); // 還在等第一次排版的
let ro = null;
let sweepTimer = 0;

function observer() {
  if (ro || typeof ResizeObserver !== "function") return ro;
  ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const img = e.target;
      const b = bound.get(img);
      const { width, height } = e.contentRect;
      if (!b || !width || !height) {
        if (!img.isConnected) release(img);
        continue;
      }
      const cover = coverWidth(width, height);
      guess[b.kind] = cover;
      const url = chooseArt(b.set, cover * dpr());
      if (img.dataset.artFallback !== "1" && img.getAttribute("src") !== url) img.src = url;
      release(img);
    }
  });
  return ro;
}

function release(img) {
  ro?.unobserve(img);
  pending.delete(img);
}

function watch(img) {
  const o = observer();
  if (!o) return;
  pending.add(img);
  o.observe(img);
  scheduleSweep();
}

// 建好、還沒排版就被丟掉的（重畫掉的牌、從沒顯示過的分頁）：ResizeObserver 不會再回報它們，定時放掉。
function scheduleSweep() {
  if (sweepTimer) return;
  sweepTimer = setTimeout(() => {
    sweepTimer = 0;
    for (const img of pending) if (!img.isConnected) release(img);
    if (pending.size) scheduleSweep();
  }, 4000);
}

// 視窗大小、DPR 變了：畫面上的圖再量一眼（不是常駐觀察）。
let lastDpr = 0;
let resizeTimer = 0;
function remeasure() {
  for (const img of document.querySelectorAll("img[data-art-pick]")) if (bound.has(img) && img.dataset.artFallback !== "1") watch(img);
}
function listenViewport() {
  if (lastDpr || typeof window === "undefined") return;
  lastDpr = dpr();
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      lastDpr = dpr();
      remeasure();
    }, 200);
  });
  // 監聽的是「現在這個 DPR」的媒體查詢，變了就換一個新的來聽（resize 可能先把 lastDpr 更新掉，照樣要換）。
  const onDpr = () => {
    listenDpr();
    if (dpr() === lastDpr) return;
    lastDpr = dpr();
    remeasure();
  };
  const listenDpr = () => matchMedia(`(resolution: ${dpr()}dppx)`).addEventListener("change", onDpr, { once: true });
  listenDpr();
}

/**
 * 給一個 <img> 掛上插畫。有可用的 mini：先照上一次量到的大小挑一張（重畫的牌立刻有圖），
 * 第一次排版後照實際大小改挑（lazy 的圖這時還沒開始抓，不會多抓一次）。
 * 沒有 mini：照舊 applyArtSources(legacy)。kind：「card」一般的牌、「hand」手牌。
 */
export function bindArt(img, set, legacy, kind = "card") {
  if (!set) return applyArtSources(img, legacy);
  img.loading = "lazy";
  bound.set(img, { set, kind });
  img.dataset.artPick = kind;
  img.src = chooseArt(set, (guess[kind] || guess.card) * dpr());
  listenViewport();
  watch(img);
  return img;
}

/**
 * <img> 載入失敗：挑的是 mini 就退回原圖，回 true；本來就是原圖（或沒掛過）回 false，交給呼叫的人。
 */
export function artFallback(img) {
  const b = bound.get(img);
  if (!b || img.dataset.artFallback === "1" || img.getAttribute("src") === b.set.full) return false;
  img.dataset.artFallback = "1";
  release(img);
  img.src = b.set.full;
  return true;
}

/** 測試用：現在有幾張圖等著量、上一次量到的大小。 */
export function _artStats() {
  return { pending: pending.size, guess: { ...guess } };
}
