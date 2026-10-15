/**
 * 點縮圖放大：圖從牆上（晾紙繩、作品冊、卡冊）原地長大，飛到彈窗中間的大圖；
 * 關彈窗時再縮回原本那一格。墨池、疊印台、作品冊、卡冊都用這一支。
 *
 * 做法（FLIP）：影子是一張 <img>，直接放在大圖畫面上的位置、用大圖的大小，
 * 從縮圖的位置「位移＋等比縮放」過去 —— 只動 transform，交給合成器，生圖時主執行緒忙也不掉格。
 * 縮圖常是裁過的（object-fit: cover，作品冊的方格），影子另外用 clip-path 從縮圖露出的那一塊
 * 展開到整張；大圖是 contain（留白邊）的，量的是圖真正畫出來的那一塊，不是元素外框。
 * 飛的時候縮圖和大圖都先藏起來，畫面上只有一張圖在動；落地才換回真的。
 *
 * 大圖還沒載好（排版量不到大小）：最多等一下下，等不到就照舊只有彈窗的進場，不硬飛。
 * 減少動態、縮圖不在畫面上：都不飛。
 */
import { css, reducedMotion, travelTime } from "./motion.js";

const WAIT_MS = 320;

// 速度：比牌飛（motion.js 的 travelTime，320～540ms、travel 曲線）快一點就好。
// 「飛多遠」算位移加上變大多少（圖常常就在原地長大），時間打九折、落在 400～490ms；
// 曲線比牌的柔一點起步，不像以前那條一開頭就衝完一半。縮回去再快一成：關掉是要回到牆上，不必再看一次。
const ZOOM_CURVE = [0.3, 0.6, 0.15, 1];
function zoomTime(small, big, factor = 1) {
  const c = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  const [ax, ay] = c(small.drawn);
  const [bx, by] = c(big.drawn);
  const reach = Math.hypot(bx - ax, by - ay) + Math.abs(big.drawn.height - small.drawn.height);
  return Math.round(Math.max(400, travelTime(reach) * 0.9) * factor);
}

/** 一張圖「畫出來的那一塊」（drawn）和「看得到的那一塊」（shown）。量不到就回 null。 */
function picture(img, aspect) {
  if (!img || !img.isConnected) return null;
  const r = img.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const a = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : aspect || r.width / r.height;
  const fit = getComputedStyle(img).objectFit;
  let w = r.width;
  let h = r.height;
  if (fit === "contain" || fit === "scale-down") {
    if (w / h > a) w = h * a;
    else h = w / a;
  } else if (fit === "cover") {
    if (w / h > a) h = w / a;
    else w = h * a;
  }
  const drawn = { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
  const shown = fit === "cover" ? { left: r.left, top: r.top, width: r.width, height: r.height } : drawn;
  // 圓角：圖自己有就用圖的，沒有就看外面那一格（畫框常是 overflow: hidden 帶圓角）。
  const radius = parseFloat(getComputedStyle(img).borderTopLeftRadius) || parseFloat(getComputedStyle(img.parentElement).borderTopLeftRadius) || 0;
  return { drawn, shown, radius, rect: r };
}

const onScreen = (r) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

/** 把「縮圖那一塊」換成影子（放在大圖位置、大圖大小）自己的座標：transform 和 clip-path。 */
function pose(small, big) {
  const s = small.drawn.width / big.drawn.width;
  const x = small.drawn.left - big.drawn.left;
  const y = small.drawn.top - big.drawn.top;
  const t = ((small.shown.top - small.drawn.top) / s).toFixed(2);
  const l = ((small.shown.left - small.drawn.left) / s).toFixed(2);
  const b = ((small.drawn.top + small.drawn.height - small.shown.top - small.shown.height) / s).toFixed(2);
  const rr = ((small.drawn.left + small.drawn.width - small.shown.left - small.shown.width) / s).toFixed(2);
  return {
    transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(5)})`,
    clipPath: `inset(${t}px ${rr}px ${b}px ${l}px round ${(small.radius / s).toFixed(2)}px)`,
  };
}

/** 彈窗本身的進場（往上滑一點、放大一點）先快轉到最後一格量位置，再倒回來照常播。 */
function settledRect(sheet, measure) {
  const anims = [sheet, sheet.parentElement].flatMap((n) => (n ? n.getAnimations() : []));
  // 大圖晚到時彈窗已經播到一半：量完放回原本那一格，不要從頭重播。
  const was = anims.map((a) => a.currentTime);
  for (const a of anims) a.currentTime = a.effect.getComputedTiming().endTime;
  const out = measure();
  anims.forEach((a, i) => (a.currentTime = was[i]));
  return out;
}

/**
 * from：縮圖的 <img>（或回傳它的函式：關彈窗時牆可能重畫過，要重新找）。
 * sheet：openSheet 回來的 .sheet；to：彈窗裡的大圖 <img>。
 * aspect：圖的寬高比（大圖還沒載好時用來算 contain 的白邊）。
 */
export function zoomFromThumb({ from, sheet, to, aspect }) {
  if (!sheet || !to || reducedMotion()) return;
  const thumbOf = () => {
    const n = typeof from === "function" ? from() : from;
    return n && n.isConnected && n.tagName === "IMG" && n.naturalWidth ? n : null;
  };
  const first = thumbOf();
  if (!first || !onScreen(first.getBoundingClientRect())) return;

  let ghost = null;
  let anim = null;
  let closed = false;

  const reveal = () => {
    to.style.visibility = "";
    const t = thumbOf();
    if (t) t.style.visibility = "";
    first.style.visibility = "";
  };
  const drop = () => {
    ghost?.remove();
    ghost = null;
    anim = null;
    reveal();
  };

  const makeGhost = (big) => {
    const src = to.complete && to.naturalWidth ? to.currentSrc || to.src : first.currentSrc || first.src;
    const g = new Image();
    g.decoding = "sync";
    g.src = src;
    g.alt = "";
    g.setAttribute("aria-hidden", "true");
    g.className = "zoom-ghost";
    Object.assign(g.style, {
      position: "fixed",
      margin: "0",
      padding: "0",
      border: "0",
      maxWidth: "none",
      maxHeight: "none",
      objectFit: "fill",
      zIndex: "210",
      pointerEvents: "none",
      transformOrigin: "0 0",
      willChange: "transform",
      left: big.drawn.left + "px",
      top: big.drawn.top + "px",
      width: big.drawn.width + "px",
      height: big.drawn.height + "px",
    });
    document.body.append(g);
    return g;
  };

  const open = () => {
    if (closed) return;
    const small = picture(first, aspect);
    const big = settledRect(sheet, () => picture(to, aspect));
    if (!small || !big || !onScreen(small.rect)) return;
    ghost = makeGhost(big);
    const start = pose(small, big);
    const end = { transform: "none", clipPath: `inset(0px 0px 0px 0px round ${big.radius.toFixed(2)}px)` };
    to.style.visibility = "hidden";
    first.style.visibility = "hidden";
    const ms = zoomTime(small, big);
    anim = ghost.animate([start, end], { duration: ms, easing: css(ZOOM_CURVE), fill: "both" });
    anim.onfinish = () => {
      if (!closed) land();
    };
    setTimeout(() => !closed && ghost && drop(), ms + 1600);
  };
  // 落地：大圖還在載（影子用的是縮圖那張），影子先留著等它載好再換，不要露出一塊空白。
  const land = () => {
    if (to.complete) return drop();
    const done = () => !closed && ghost && drop();
    to.addEventListener("load", done, { once: true });
    to.addEventListener("error", done, { once: true });
    setTimeout(done, 1200);
  };

  // 大圖排得出大小就飛（寬高比先給了的，圖還沒載好也行；同一張圖在快取裡通常當場就好）；
  // 排不出來就等它載好，等太久就算了，照舊只有彈窗的進場。
  const r = to.getBoundingClientRect();
  if (r.width && r.height) open();
  else {
    const t0 = performance.now();
    to.addEventListener("load", () => performance.now() - t0 < WAIT_MS && open(), { once: true });
  }

  // 關彈窗（ui.js 在 close() 時發 sheet-close）：從大圖現在的位置縮回縮圖那一格。
  sheet.addEventListener(
    "sheet-close",
    () => {
      closed = true;
      // 還在飛進來：原路倒回去。
      if (anim && anim.playState === "running") {
        anim.onfinish = drop;
        anim.reverse();
        setTimeout(() => ghost && drop(), 540 + 400);
        return;
      }
      drop();
      const thumb = thumbOf();
      if (!thumb || reducedMotion() || !to.isConnected || !(to.complete && to.naturalWidth)) return;
      const big = picture(to, aspect);
      const small = picture(thumb, aspect);
      if (!big || !small || !onScreen(small.rect) || !onScreen(big.rect)) return;
      ghost = makeGhost(big);
      to.style.visibility = "hidden";
      thumb.style.visibility = "hidden";
      const end = pose(small, big);
      const ms = zoomTime(small, big, 0.9);
      anim = ghost.animate([{ transform: "none", clipPath: `inset(0px 0px 0px 0px round ${big.radius.toFixed(2)}px)` }, end], {
        duration: ms,
        easing: css(ZOOM_CURVE),
        fill: "both",
      });
      anim.onfinish = drop;
      // 保險：分頁在背景時動畫不跑，回來不要留一張影子蓋著。
      setTimeout(() => ghost && drop(), ms + 400);
    },
    { once: true }
  );
}
