/**
 * 墨池、疊印台共用的小動作：分段選項的滑塊、數字增減的滾動、清單增減時旁邊的讓位（FLIP）。
 *
 * 前兩個是自動的：initMotion() 之後，頁面上任何 .segmented 和 .stepper output 改了，
 * 這裡看得到（MutationObserver）就補上動作，各個 render 函式不必各自記得呼叫。
 * 這兩個房間的控制項大多是「點了就整組重畫」，所以滑塊記的是上一次的位置（依那一組的
 * aria-label），新畫出來的那一組從舊位置滑過去。
 */

import { getSfx } from "./sfx.js";

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 動態詞彙：兩個房間的曲線與時間（跟 tokens.css 的 --ease-*／--dur-* 同一套） ---------- */

/**
 * out     進場、落定、回彈之後的收尾：一開始就快、長長地停下來。
 * in      離場（長的、≥ 300ms）：慢慢起步、越走越快，走的時候不拖泥帶水。
 * exit    短的離場（< 250ms）：in 太陡，短時間裡前半段幾乎不動、最後一下才消失；這條一開始就在走。
 * inOut   原地的狀態轉換（展開、收合）。
 * travel  牌飛越畫面：從靜止加速（不會瞬間移位），大半段在減速、輕輕落下。
 * settle  落地那一下的回彈（略過頭再回來）。
 */
export const CURVE = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  exit: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1],
  travel: [0.22, 0.06, 0.08, 1],
  settle: [0.2, 0.9, 0.3, 1.2],
};
export const DUR = { micro: 120, short: 220, medium: 320, long: 420, xl: 540, story: 800, develop: 1200, breath: 1400 };
export const css = (c) => `cubic-bezier(${c.join(", ")})`;

/** cubic-bezier 曲線 → 函式 t(0..1) → 進度。JS 自己算位置的動畫（飛行）跟 CSS 用同一條曲線。 */
export function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** 飛行要多久：照距離，近的快、遠的慢一點（300px 約 350ms，1000px 約 500ms）。 */
export function travelTime(dist) {
  return Math.round(Math.max(320, Math.min(540, 280 + dist * 0.22)));
}

// 同一格先量完所有落點再畫影子；每張仍逐格追落點、沿用原本的時間與阻尼。
// 多張追同一個元素時只量一次，避免影子的樣式寫入夾在別張的量測之間。
const flightFrames = new Set();
let flightRaf = 0;
function scheduleFlights() {
  if (flightRaf || !flightFrames.size) return;
  flightRaf = requestAnimationFrame((now) => {
    flightRaf = 0;
    const cache = new Map();
    const measured = [...flightFrames].map((frame) => [frame, frame.measure(cache)]);
    for (const [frame, rect] of measured) if (flightFrames.has(frame)) frame.paint(now, rect);
    scheduleFlights();
  });
}

/**
 * 牌飛過去（會追落點）：影子 ghost 從 from 飛到 target() 「現在」的位置。
 * 每一格重量一次落點，所以路上版面動了（整列重排、托盤變寬、捲動）也剛好落在牌上，
 * 不會飛到舊位置、落地再跳一下。路徑往上拱成弧、途中微微轉、中段稍微放大（像被拿起來），
 * 兩端都是正的、原尺寸。ghost 由呼叫端做好（通常是那張牌的複製），落地後這裡拿掉。
 *
 * from：{ left, top, width[, height] }。target：() => Element 或 rect（拿不到就沿用上一次的）。
 * 選項：duration（預設照距離）、delay、curve、arc（弧高 px）、tilt（最大轉角）、
 *       startScale（出發時的縮放）、endScale（落地大小／落點寬）、endOpacity、startRotate／endRotate（起飛、落地的角度）、
 *       scaleLate（大小晚點才變）、
 *       zIndex、onLand。回傳 { cancel, duration }。
 */
export function flight(ghost, from, target, opts = {}) {
  const { delay = 0, curve = CURVE.travel, arc = 34, tilt = -5, lift = 0.05, endScale = 1, endOpacity = 1, endRotate = 0, startRotate = 0, startScale = 1, scaleLate = 0, zIndex = 90, onLand = null } = opts;
  const fh = from.height || from.width * 1.4625;
  Object.assign(ghost.style, {
    position: "fixed",
    left: from.left + "px",
    top: from.top + "px",
    width: from.width + "px",
    margin: "0",
    zIndex: String(zIndex),
    pointerEvents: "none",
    transformOrigin: "50% 50%",
    willChange: "transform, opacity",
    // 影子是牌的複製，牌本身有 transform 的過渡（hover 浮起用）：每一格改位置都被過渡拖著走，
    // 一路落後在曲線後面，最後一格離落點還差 15～20px 就被拿掉，真的那張在落點冒出來 —— 看得到一跳。
    // 位置、大小、影子、透明度每一格都由這裡算好，不要再過渡一次。
    transition: "none",
  });
  ghost.style.setProperty("--card-w", from.width + "px");
  ghost.setAttribute("aria-hidden", "true");
  let last = null;
  const resolve = (cache = null) => {
    const n = typeof target === "function" ? target() : target;
    if (n && typeof n.getBoundingClientRect === "function") {
      if (!n.isConnected) return last;
      // 落點是元素：中心用外框的中心，大小用它自己的寬高（托盤的牌是轉過的，外框比牌大一圈）。
      let rect = cache?.get(n);
      if (!rect) {
        const r = n.getBoundingClientRect();
        const w = n.offsetWidth || r.width;
        const h = n.offsetHeight || r.height;
        rect = w ? { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h } : null;
        if (cache) cache.set(n, rect);
      }
      if (rect) last = rect;
      return last;
    }
    if (n && n.width) last = { left: n.left, top: n.top, width: n.width, height: n.height || n.width * 1.4625 };
    return last;
  };
  const first = resolve() || { left: from.left, top: from.top, width: from.width, height: fh };
  const fcx = from.left + from.width / 2;
  const fcy = from.top + fh / 2;
  const duration = opts.duration || travelTime(Math.hypot(first.left + first.width / 2 - fcx, first.top + first.height / 2 - fcy));
  const ease = bezier(curve);
  let done = false;
  let fallback = 0;
  let t0 = null;
  // 瞄準點：跟著落點走但有阻尼（落點突然跳一大段，影子不會跟著瞬移），最後一段完全換成真的落點，
  // 所以一定剛好落在牌上。
  let aim = { ...first };
  let lastNow = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(fallback);
    flightFrames.delete(frame);
    if (!flightFrames.size) {
      cancelAnimationFrame(flightRaf);
      flightRaf = 0;
    }
    ghost.remove();
    if (onLand) onLand();
  };
  const paint = (p, dt = 16, raw = resolve() || first) => {
    const e = ease(p);
    const k = 1 - Math.exp(-dt / 70);
    for (const key of ["left", "top", "width", "height"]) aim[key] += (raw[key] - aim[key]) * k;
    const w = e * e * e * e;
    const to = {};
    for (const key of ["left", "top", "width", "height"]) to[key] = aim[key] + (raw[key] - aim[key]) * w;
    const tcx = to.left + to.width / 2;
    const tcy = to.top + to.height / 2;
    const bump = Math.sin(Math.PI * p);
    const x = fcx + (tcx - fcx) * e - fcx;
    const y = fcy + (tcy - fcy) * e - arc * bump - fcy;
    // scaleLate：大小晚一點才變（0＝跟位置一起變；1＝幾乎到了才縮）—— 飛進小東西（標籤）時，
    // 一路都還是一張牌、最後一段才被收進去，不是一出發就縮成一個點。
    const se = scaleLate ? Math.pow(e, 1 + scaleLate * 3) : e;
    // startScale：出發時比 from 小（從標籤裡長出來）。影子本身永遠是一張正常大小的牌，只用 scale 縮放
    // —— 用寬度縮成一點點再放大，牌上固定 px 的東西（墨點、框線）會跟著被放大好幾倍。
    const s = (startScale + ((to.width * endScale) / from.width - startScale) * se) * (1 + lift * bump);
    // 轉角：途中微微轉（tilt），落地時轉到落點自己的角度（endRotate，托盤那把扇形每張斜一點）。
    ghost.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${(tilt * bump + startRotate * (1 - e) + endRotate * e).toFixed(2)}deg) scale(${s.toFixed(4)})`;
    // 影子跟著高度：飛到弧頂最深最散，落地前收回貼著桌面的那一層。
    ghost.style.boxShadow = `0 1px 0 var(--color-shine) inset, 0 ${(6 + 18 * bump).toFixed(1)}px ${(14 + 22 * bump).toFixed(1)}px var(--color-shade)`;
    if (endOpacity !== 1) ghost.style.opacity = String(1 + (endOpacity - 1) * Math.max(0, (e - 0.6) / 0.4));
  };
  paint(0);
  document.body.append(ghost);
  const frame = {
    measure: (cache) => resolve(cache) || first,
    paint(now, raw) {
      if (done) return;
      if (t0 === null) t0 = now + delay;
      const p = Math.max(0, Math.min(1, (now - t0) / duration));
      paint(p, lastNow === null ? 16 : Math.max(1, now - lastNow), raw);
      lastNow = now;
      if (p >= 1) finish();
    },
  };
  flightFrames.add(frame);
  scheduleFlights();
  // 分頁在背景時 rAF 不跑：時間到了直接落地，不會卡一張影子在畫面上。
  fallback = setTimeout(finish, delay + duration + 300);
  return { cancel: finish, duration };
}

/* ---------- 分段選項：選到的那一格底下有一塊會滑的底 ---------- */

const thumbAt = new Map();

function segKey(seg) {
  return seg.getAttribute("aria-label") || seg.dataset.kind || [...seg.children].map((b) => b.textContent).join("|");
}

function syncThumbs(root = document) {
  for (const seg of root.querySelectorAll(".segmented")) {
    const on = seg.querySelector(':scope > [aria-checked="true"], :scope > [aria-pressed="true"]');
    let thumb = seg.querySelector(":scope > .seg-thumb");
    if (!on || !seg.offsetWidth) {
      thumb?.remove();
      continue;
    }
    const key = segKey(seg);
    const to = { x: on.offsetLeft, w: on.offsetWidth, h: on.offsetHeight, y: on.offsetTop };
    const fresh = !thumb;
    if (fresh) {
      thumb = document.createElement("span");
      thumb.className = "seg-thumb";
      thumb.setAttribute("aria-hidden", "true");
      seg.prepend(thumb);
      seg.classList.add("has-thumb");
      const from = thumbAt.get(key);
      if (from && !reducedMotion()) {
        place(thumb, from, false);
        void thumb.offsetWidth;
      } else place(thumb, to, false);
    }
    thumb.dataset.v = on.dataset.v || "";
    const at = thumbAt.get(key);
    if (fresh || !at || at.x !== to.x || at.w !== to.w) place(thumb, to, !reducedMotion());
    thumbAt.set(key, to);
  }
}

function place(thumb, r, animate) {
  thumb.style.transition = animate ? "" : "none";
  thumb.style.width = r.w + "px";
  thumb.style.height = r.h + "px";
  thumb.style.transform = `translate(${r.x}px, ${r.y}px)`;
}

/* ---------- 數字增減：往上加從底下滾上來，往下減從上面滾下來 ---------- */

const stepAt = new Map();

function stepKey(out) {
  return out.closest(".stepper")?.querySelector(".stepper-label")?.textContent || out.getAttribute("aria-label") || "";
}

function syncSteppers(root = document) {
  for (const out of root.querySelectorAll(".stepper output")) {
    const key = stepKey(out);
    const v = Number(out.textContent);
    const was = stepAt.get(key);
    stepAt.set(key, v);
    if (was === undefined || Number.isNaN(v) || v === was || reducedMotion()) continue;
    const up = v > was;
    out.animate(
      [
        { transform: `translateY(${up ? 60 : -60}%)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: DUR.short, easing: css(CURVE.out) }
    );
  }
}

/* ---------- 自動：DOM 一變就補上 ---------- */

let scheduled = false;
let syncing = false;
let ready = false;
function schedule() {
  // 開機過程一直在改 DOM。這時候量滑塊會逼整頁同步排版，算進同一個長任務。
  // 等這一格排完、畫上去，settleMotion() 才把 ready 打開。
  if (!ready || scheduled || syncing) return;
  scheduled = true;
  const run = () => {
    scheduled = false;
    syncing = true;
    try {
      syncThumbs();
      syncSteppers();
    } finally {
      syncing = false;
    }
  };
  // 分頁在背景時 rAF 不跑，那時仍用微任務，滑塊才不會停在半路。
  if (document.hidden) queueMicrotask(run);
  else requestAnimationFrame(run);
}

/** 開機的 DOM 都放好了：下一格排完版、畫上去之後再量滑塊。 */
export function settleMotion() {
  delete document.documentElement.dataset.booting;
  playPageEntrance();
  if (document.hidden) {
    ready = true;
    schedule();
    return;
  }
  requestAnimationFrame(() => setTimeout(() => {
    ready = true;
    schedule();
  }, 0));
}

/* ---------- 開版：直接開啟／重新整理，從頁首到首屏的牌依序落定 ---------- */

let pageEntered = false;
export function playPageEntrance() {
  if (pageEntered) return;
  pageEntered = true;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const skip = () => media.matches || document.hidden || window.scrollY > 24 ||
    performance.getEntriesByType("navigation")[0]?.type === "back_forward" ||
    document.documentElement.dataset.vt || document.documentElement.dataset.vtIn || document.documentElement.dataset.vtPlayed;
  if (skip()) return;

  let frame = 0;
  let stopped = false;
  const animations = new Set();
  // 先落定再讓點擊／拖曳讀尺寸；不攔截事件、不鎖操作。固定的托盤與操作列不參與。
  const inputs = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "pagehide"];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const event of inputs) window.removeEventListener(event, stop, true);
    document.removeEventListener("visibilitychange", visibility);
    media.removeEventListener?.("change", preference);
  };
  const preference = () => { if (media.matches) stop(); };
  const visibility = () => { if (document.hidden) stop(); };
  for (const event of inputs) window.addEventListener(event, stop, { capture: true, passive: true });
  document.addEventListener("visibilitychange", visibility, { passive: true });
  media.addEventListener?.("change", preference);

  frame = requestAnimationFrame(() => {
    if (stopped || skip()) return stop();
    const groups = [
      [".mast", 0, 6],
      [".library .panel-head, .case-head", 40, 8],
      [".lib-search, #case-q", 65, 8],
      [".suit-tabs, .case-tabs", 85, 8],
      ["#pool > .panel-head, .plate-head", 60, 10],
      [".pool-well, .register", 100, 14],
      [".rules, .trials-head, .preview", 140, 10],
      [".go-bar, .trials, .print-bar", 170, 10],
      [".wall-head, .wall-empty, .line-title, .line-empty", 190, 8],
      // 卡冊（book.html）：標題列、工具列，牌照下面那條一張張落定。
      [".book-head", 40, 8],
      [".book-bar", 70, 8],
      // 作品冊（album.html）：標題列；牆上的圖自己會錯開浮上來（album.js）。
      [".album-head", 40, 8],
    ];
    const candidates = [];
    const seen = new Set();
    for (const [selector, delay, rise] of groups) {
      for (const node of document.querySelectorAll(selector)) {
        if (seen.has(node) || candidates.length >= 20) continue;
        seen.add(node);
        candidates.push({ node, delay, rise, card: false });
      }
    }
    const cards = document.querySelectorAll(".lib-grid > .card:nth-child(-n+18), .case-grid > .card:nth-child(-n+18), .book-grid > .book-cell:nth-child(-n+18)");
    [...cards].slice(0, 18).forEach((node, i) => candidates.push({ node, delay: 100 + i * 12, rise: 14, card: true }));
    // 首屏之外不量更多牌；所有幾何讀取先一起做完，才開始寫入動畫。
    const visible = candidates.filter(({ node }) => {
      const r = node.getBoundingClientRect();
      return r.width && r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    for (const { node, delay, rise, card } of visible) {
      if (typeof node.animate !== "function") continue;
      const animation = node.animate(
        [{ opacity: 0, translate: `0 ${rise}px`, ...(card ? { scale: "0.985" } : {}) },
          { opacity: 1, translate: "0 0", ...(card ? { scale: "1" } : {}) }],
        { id: "web6-page-enter", duration: card ? DUR.medium : DUR.long, delay, easing: css(CURVE.out), fill: "both" }
      );
      animations.add(animation);
      const release = () => {
        animation.cancel();
        animations.delete(animation);
        if (!animations.size) stop();
      };
      animation.finished.then(release, release);
    }
    if (!animations.size) stop();
  });
}

/** 重播整把牌原有的 deal：一次重設、一次排版，保留各張的 --i 錯開。 */
export function replayDeal(container) {
  const cards = [...container.querySelectorAll(".card")];
  if (!cards.length) return;
  cards.forEach((card, i) => {
    card.classList.remove("dealt");
    card.style.setProperty("--i", String(i));
  });
  void container.offsetWidth;
  for (const card of cards) card.classList.add("dealt");
}

/* ---------- 按下去的手感：墨暈、蓋章、搖頭 ---------- */

// 同一套手感的東西。其他元件要一樣：加 class="pressable" 或 data-press。
// 不能叫 .press：疊印台整個印刷機的外框就是 .press，按住裡面任何一張牌整塊都會被壓小。
const PRESS = ".btn, .mast-tools .ghost, .pressable, [data-press]";

/** 從 (x, y)（視窗座標；沒給就是正中間）暈開一圈墨。重複按會從頭再暈一次。 */
export function inkPress(el, x, y) {
  if (!el || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const px = x === undefined ? r.width / 2 : x - r.left;
  const py = y === undefined ? r.height / 2 : y - r.top;
  el.style.setProperty("--px", `${px}px`);
  el.style.setProperty("--py", `${py}px`);
  // 暈到最遠的那個角：大按鈕、小按鈕都剛好蓋滿。
  el.style.setProperty("--ink-reach", `${Math.ceil(Math.hypot(Math.max(px, r.width - px), Math.max(py, r.height - py)))}px`);
  el.classList.remove("is-inking");
  void el.offsetWidth;
  el.classList.add("is-inking");
  clearTimeout(el._inkTimer);
  el._inkTimer = setTimeout(() => el.classList.remove("is-inking"), DUR.xl + 40);
}

/** 狀態換過去了（開／關、選中）：蓋一下章。 */
export function seat(el) {
  if (!el || reducedMotion()) return;
  // 章本來沒蓋過：直接掛上就會從第一格開始播。為了重播去讀 offsetWidth 會逼整頁排版，
  // 載入時每顆選中的按鈕都這樣一次，長任務就從這裡來。只有章還在、要重頭播，才讀一次。
  const replay = el.classList.contains("is-seated");
  if (replay) {
    el.classList.remove("is-seated");
    void el.offsetWidth;
  }
  el.classList.add("is-seated");
  clearTimeout(el._seatTimer);
  el._seatTimer = setTimeout(() => el.classList.remove("is-seated"), DUR.medium + 40);
}

/** 這一下做不了：輕輕搖頭（按鈕還在、只是現在不行，比什麼都不發生好懂）。 */
export function refuse(el) {
  if (!el || reducedMotion()) return;
  el.classList.remove("is-refused");
  void el.offsetWidth;
  el.classList.add("is-refused");
  clearTimeout(el._refuseTimer);
  el._refuseTimer = setTimeout(() => el.classList.remove("is-refused"), DUR.medium + 40);
}

let pressWired = false;
function wirePress() {
  if (pressWired) return;
  pressWired = true;
  // 墨在「放開」那一刻暈開（按住時是壓痕，放開才是印上去）。只認按下去的那一顆，拖出去放開不算。
  let down = null;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest?.(PRESS);
      down = el && !el.disabled ? { el, id: e.pointerId } : null;
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    "pointerup",
    (e) => {
      if (!down || down.id !== e.pointerId) return;
      const { el } = down;
      down = null;
      if (el.disabled || !el.isConnected) return;
      // 用位置判斷放開時還在不在按鈕上：有的按鈕按下去會重寫自己的內容（偏好卡牌的標籤），e.target 已經不在了。
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      inkPress(el, e.clientX, e.clientY);
      if (el.dataset.sfx !== "off") getSfx().tap();
    },
    { capture: true, passive: true }
  );
  document.addEventListener("pointercancel", () => (down = null), { capture: true, passive: true });
  // 鍵盤按 Enter／空白鍵：從正中間暈開，手感跟滑鼠一樣。
  document.addEventListener(
    "keydown",
    (e) => {
      if ((e.key !== "Enter" && e.key !== " ") || e.repeat) return;
      const el = e.target.closest?.(PRESS);
      if (el && el === e.target && !el.disabled) {
        inkPress(el);
        if (el.dataset.sfx !== "off") getSfx().tap();
      }
    },
    { capture: true }
  );
  // aria-pressed 換了（開關按鈕）：蓋一下章。
  // 第一次寫上屬性是畫出來，不是使用者切換。那時蓋章會為了重播動畫去量版面，載入就多一次整頁排版。
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.oldValue === null) continue;
      if (r.target.matches?.(PRESS)) seat(r.target);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["aria-pressed"] });
}

/* ---------- 手機：頂欄往上滑就冒出來 ----------
 * 手機的頂欄將近 100px，一直黏著太佔地方，以前是跟著頁面捲走；可是捲深了要切頁、換分級，
 * 得一路滑回最上面。現在：往下捲它照樣離開（滑上去），往上滑一小段就從上面滑下來，
 * 回到頂端就是原本的樣子。html[data-mast]：away 收起、peek 冒出來（styles.css）。
 * 小抖動不算：往下累積 12px 才收、往上累積 24px 才出來（iOS 捲到底的回彈不會把它叫出來）。 */
function watchMastPeek() {
  const mast = document.querySelector(".mast");
  if (!mast) return;
  const phone = matchMedia("(max-width: 44rem)");
  const root = document.documentElement;
  let lastY = scrollY;
  let down = 0;
  let up = 0;
  let ticking = false;
  const set = (v) => {
    if ((root.dataset.mast || "") === v) return;
    if (v) root.dataset.mast = v;
    else delete root.dataset.mast;
  };
  const update = () => {
    ticking = false;
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    // 鍵盤走在頂欄裡、頂欄的選單開著：不收。
    if (!phone.matches || y <= 8 || mast.contains(document.activeElement)) {
      down = up = 0;
      return set(y <= 8 || !phone.matches ? "" : root.dataset.mast === "away" ? "peek" : root.dataset.mast || "");
    }
    if (dy > 0) {
      down += dy;
      up = 0;
      if (down > 12 && y > mast.offsetHeight / 2) set("away");
    } else if (dy < 0) {
      up -= dy;
      down = 0;
      if (up > 24) set("peek");
    }
  };
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  // 分頁在背景時 rAF 不跑：回來時對一次。
  document.addEventListener("visibilitychange", () => { if (!document.hidden) update(); });
  phone.addEventListener?.("change", () => set(""));
}

export function initMotion() {
  wirePress();
  watchMastPeek();
  // 發牌（.dealt）的動畫是 fill: both，播完如果 class 還掛著，那個「已結束」的動畫就一直留著：
  // 墨池抽 50 次牌留下 1350 個，而且它的 transform: none 壓過牌 hover 時的抬起。
  // 播完就拿掉 class，最後一格本來就等於牌的原樣，看不出差別。
  document.addEventListener("animationend", (e) => {
    const t = e.target;
    if ((e.animationName === "deal" || e.animationName === "fade-in") && t.classList?.contains("dealt")) t.classList.remove("dealt");
  });
  // 只在分段選項、數字步進器真的有變的時候才量：以前頁面上任何 DOM 一動（放一張牌、飛行的影子、
  // 成品的進度）都排一次，下一格就把每一組滑塊量一遍 —— 每次都逼整頁排版，牆上成品多的時候一次 40ms。
  const WATCH = ".segmented, .stepper";
  const relevant = (r) => {
    const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
    if (t && t.closest && t.closest(WATCH)) return true;
    for (const n of r.addedNodes) if (n.nodeType === 1 && (n.matches(WATCH) || n.querySelector(WATCH))) return true;
    return false;
  };
  new MutationObserver((records) => {
    if (records.some(relevant)) schedule();
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-checked", "aria-pressed"],
  });
  window.addEventListener("resize", () => {
    thumbAt.clear();
    for (const t of document.querySelectorAll(".seg-thumb")) t.remove();
    schedule();
  });
  schedule();
}

/* ---------- FLIP：清單增減時，旁邊的東西滑到新位置，不是一格一格跳 ---------- */

/**
 * flip(container, () => { ...改 DOM... })：改之前量一次每個子元素的位置，改完再量一次，
 * 位置變了的從舊位置滑過去。新加進來的不管（呼叫端自己決定它怎麼進場）。
 */
export function flip(container, mutate, { duration = DUR.medium } = {}) {
  if (!container || reducedMotion()) {
    mutate();
    return;
  }
  const before = new Map();
  for (const n of container.children) before.set(n, n.getBoundingClientRect());
  mutate();
  const after = [...container.children].filter((n) => before.has(n)).map((n) => [n, n.getBoundingClientRect()]);
  for (const [n, b] of after) {
    const a = before.get(n);
    if (!a) continue;
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration, easing: css(CURVE.out) });
  }
}

/**
 * flipBy：整塊重畫（replaceChildren）也能讓位 —— 節點換了新的，就用 key（牌名）認人。
 * 重畫前記下每張的位置，重畫後同一張從舊位置滑到新位置。
 * alias(key) 回傳「沒有舊位置時可以借用的 key」：疊印台的影子被收下變成正式的牌，
 * 就從影子的位置滑進去。
 */
export function flipBy(container, selector, key, mutate, { duration = DUR.medium, alias = null } = {}) {
  if (!container || reducedMotion()) {
    mutate();
    return;
  }
  const before = new Map();
  for (const n of container.querySelectorAll(selector)) {
    const k = key(n);
    if (k && !before.has(k)) before.set(k, n.getBoundingClientRect());
  }
  mutate();
  if (!before.size) return;
  const after = [];
  for (const n of container.querySelectorAll(selector)) {
    const k = key(n);
    const a = before.get(k) || (alias && before.get(alias(k)));
    if (!a) continue;
    after.push([n, a, n.getBoundingClientRect()]);
  }
  for (const [n, a, b] of after) {
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration, easing: css(CURVE.out) });
  }
}

/**
 * 一疊牌收回去：先從各自的位置滑到 pile 疊成一疊（每張錯開一點、歪一點），
 * 再整疊一起飛到 home 縮小淡掉。一張張各飛各的回字盒，牌多的時候路線交叉、看起來在亂飛；
 * 收成一疊再一起走，是「把桌上的牌掃成一堆收起來」。
 *
 * snaps：[{ node, rect }]（拿掉之前量的）。pile、home：{ x, y } 視窗座標（中心點）；home 可以是 null
 * （字盒不在畫面上）：那就疊好之後原地淡掉。cls：飛行影子要加的 class（疊印台是 "flying"）。
 * 回傳整段要多久（毫秒），呼叫端用來排「字盒收下」那一下。
 */
export function gatherHome(snaps, pile, home, { cls = "", duration = DUR.xl, start = 0 } = {}) {
  if (reducedMotion() || !snaps.length || !pile) return 0;
  const n = snaps.length;
  snaps.forEach((snap, i) => {
    const r = snap.rect;
    if (!r.width) return;
    const g = snap.node.cloneNode(true);
    if (cls) g.classList.add(cls);
    g.classList.remove("is-related", "is-stamped", "is-clash", "is-returned");
    Object.assign(g.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", margin: "0", zIndex: String(80 + i), pointerEvents: "none" });
    g.style.setProperty("--card-w", r.width + "px");
    document.body.append(g);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 疊成一疊：越後面的越往上一點、角度錯開（像手收牌）。
    const k = i - (n - 1) / 2;
    const px = pile.x - cx + k * 1.5;
    const py = pile.y - cy - i * 1.2;
    const rot = k * 3;
    const s1 = Math.min(1, 96 / r.width);
    // 兩段各用各的曲線（整段只給一條曲線會把兩段一起扭曲）：
    // 聚攏＝減速停進那一疊（out，視覺上大約 110ms 就疊好）；收走＝帶一點初速離開、進字盒前放慢。
    // 中間不另外停：out 的尾巴本身就是那一拍「疊好了」。
    const frames = [
      { transform: "none", opacity: 1, easing: css(CURVE.out) },
      { transform: `translate(${px}px, ${py}px) scale(${s1}) rotate(${rot}deg)`, opacity: 1, offset: 0.3, easing: css([0.3, 0.1, 0.4, 1]) },
      // 飛的路上是實的，快進字盒才淡掉（只寫 opacity：transform 照上下兩格接著走）。
      { opacity: 1, offset: 0.78 },
    ];
    if (home) {
      frames.push({ transform: `translate(${home.x - cx}px, ${home.y - cy}px) scale(${s1 * 0.35}) rotate(${rot - 12}deg)`, opacity: 0 });
    } else {
      frames.push({ transform: `translate(${px}px, ${py + 10}px) scale(${s1 * 0.9}) rotate(${rot}deg)`, opacity: 0 });
    }
    // 聚攏那段各自出發（最多差 80ms），之後同一時間一起走。
    const delay = start + Math.min(80, i * 14);
    g.animate(frames, { duration: duration - (delay - start), delay, easing: "linear", fill: "both" });
    setTimeout(() => g.remove(), start + duration + 40);
  });
  return start + duration;
}

/** 一個東西離場：縮一點、淡掉，結束後才真的拿掉（done 裡做 DOM 移除，通常配 flip）。 */
export function leave(node, done, { duration = DUR.short } = {}) {
  if (!node || reducedMotion()) {
    done();
    return;
  }
  const a = node.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: "scale(0.92)", opacity: 0 },
    ],
    { duration, easing: css(CURVE.exit), fill: "forwards" }
  );
  let finished = false;
  const end = () => {
    if (finished) return;
    finished = true;
    done();
  };
  a.onfinish = end;
  a.oncancel = end;
  setTimeout(end, duration + 150);
}

/** 一個東西進場：從上面一點浮下來。 */
export function enter(node, { delay = 0 } = {}) {
  if (!node || reducedMotion()) return;
  node.animate(
    [
      { transform: "translateY(-12px) scale(0.97)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    { duration: DUR.long, delay, easing: css(CURVE.out), fill: "backwards" }
  );
}

/** 按鈕自己說「好了」：字換成 done 一下子再換回來（複製、存檔這種看不到結果的動作）。 */
export function confirmButton(btn, done = "已複製", ms = 1400) {
  if (!btn) return;
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.textContent = done;
  btn.classList.add("is-confirmed");
  clearTimeout(btn._confirmTimer);
  btn._confirmTimer = setTimeout(() => {
    btn.textContent = btn.dataset.label;
    btn.classList.remove("is-confirmed");
  }, ms);
}
