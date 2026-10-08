/**
 * Hires 對比（墨池、疊印台共用）。
 *
 * 做過 Hires 的圖，詳情右邊提示詞底下多一張示意圖（左半原圖、右半 Hires，中間一條線，
 * 滑鼠移上去線會掃一下）。點它開一個全螢幕的對比視窗：
 *   - 圖從示意圖飛出、放大到定位；落定後分隔線自己左右掃一趟，示範「這條線可以拖」。
 *   - 分隔線在螢幕座標上：拖線比較；在圖上單擊，線滑過去。
 *   - 滾輪以游標為中心放大，數值追目標（每格收斂一段），連續、不跳格；拖曳平移，放開有慣性；
 *     雙擊在「符合視窗」和「1:1 實際像素」之間切換；手機雙指縮放。
 *   - ←／→ 移線、+／− 縮放、0 還原、Esc 關閉。
 *
 * 效能：全部只動 transform，合成器跑、不重畫：
 *   - 右半的 Hires 不用 clip-path 裁，改成「外框 translateX(d)、超出切掉，內層 translateX(-d) 抵回來」，
 *     拖線、縮放時兩層都只是位移。
 *   - 追目標的收斂依經過的時間算（不是每格固定一段），60Hz、144Hz 的手感一樣。
 *   - 倍率字、無障礙數值只在變了／停下來時才寫（每格改字會逼排版）。
 *   - 動的時候才掛 will-change，停下來就拿掉 —— 掛著的話瀏覽器會沿用小倍率的點陣去放大，放大後就糊了。
 *   - 滑鼠移到示意圖上就先把兩張大圖解碼好，點下去幾乎不用等。
 */
import { el, ICONS } from "./ui.js";
import { viewSrc } from "./gen.js";
import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { reducedMotion, seat, DUR, CURVE, css } from "./motion.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 這一張能不能對比：做過 Hires、原圖還在。 */
export function canCompare(t) {
  return !!(t && t.hires && t.baseImage && t.image && t.status !== "failed");
}

function sizesOf(t) {
  const bw = t.width || 1;
  const bh = t.height || 1;
  const hw = t.hires?.width || bw;
  const hh = t.hires?.height || bh;
  return { bw, bh, hw, hh };
}

/** 詳情右邊的示意圖（一顆按鈕）。 */
export function compareThumb(t) {
  if (!canCompare(t)) return null;
  const { bw, bh, hw, hh } = sizesOf(t);
  const before = viewSrc(t.baseImage);
  const after = viewSrc(t.image);
  const frame = el(
    "span",
    { class: "cmp-thumb-frame", style: `aspect-ratio: ${hw} / ${hh}` },
    el("img", { src: before, alt: "", decoding: "async", draggable: "false" }),
    // 右半：外框往右推 50%（超出切掉），裡面的圖推回 -50% —— 滑過時兩層一起動，只是位移。
    el("span", { class: "cmp-thumb-cut" }, el("span", { class: "cmp-thumb-inner" }, el("img", { src: after, alt: "", decoding: "async", draggable: "false" }))),
    el("span", { class: "cmp-thumb-line", "aria-hidden": "true" }, el("i")),
    el("span", { class: "cmp-thumb-tag cmp-thumb-a", "aria-hidden": "true" }, "A"),
    el("span", { class: "cmp-thumb-tag cmp-thumb-b", "aria-hidden": "true" }, "B")
  );
  const btn = el(
    "button",
    {
      class: "cmp-thumb",
      type: "button",
      "aria-label": `開啟 Hires 對比：原圖 ${bw}×${bh}，Hires ${hw}×${hh}`,
    },
    frame,
    el(
      "span",
      { class: "cmp-thumb-cap" },
      el("b", {}, "原圖 ↔ Hires"),
      el("small", {}, `${bw}×${bh} → ${hw}×${hh}・點開左右拉動比較`)
    )
  );
  btn.addEventListener("click", () => openCompare(t, frame));
  // 滑鼠移上來（或鍵盤走到）就先把兩張大圖解碼好：點下去時飛出來的那一格不必再等解碼。
  const warm = () => {
    if (btn._warm) return;
    btn._warm = true;
    for (const src of [before, after]) {
      const im = new Image();
      im.decoding = "async";
      im.src = src;
      im.decode?.().catch(() => {});
    }
  };
  btn.addEventListener("pointerenter", warm);
  btn.addEventListener("focus", warm);
  return btn;
}

/** 全螢幕對比。from：示意圖那一框（飛出的起點）。 */
export function openCompare(t, from = null) {
  if (!canCompare(t)) return;
  const reduced = reducedMotion();
  const { bw, bh, hw, hh } = sizesOf(t);
  const before = viewSrc(t.baseImage);
  const after = viewSrc(t.image);
  const lastFocus = document.activeElement;

  const imgA = el("img", { src: before, alt: `原圖 ${bw}×${bh}`, draggable: "false", decoding: "async" });
  const imgB = el("img", { src: after, alt: `Hires ${hw}×${hh}`, draggable: "false", decoding: "async" });
  const layerA = el("div", { class: "cmp-layer" }, imgA);
  const layerB = el("div", { class: "cmp-layer" }, imgB);
  const inner = el("div", { class: "cmp-cut-inner" }, layerB);
  const cut = el("div", { class: "cmp-cut" }, inner);
  const knob = el("span", {
    class: "cmp-knob",
    "aria-hidden": "true",
    html: '<svg viewBox="0 0 24 24"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  });
  const line = el("div", { class: "cmp-line", role: "slider", tabindex: "0", "aria-label": "分隔線：左邊原圖、右邊 Hires", "aria-valuemin": "0", "aria-valuemax": "100" }, knob);
  const world = el("div", { class: "cmp-world" }, layerA, cut, line);
  const tagA = el("span", { class: "cmp-tag cmp-tag-a" }, el("b", {}, "A"), el("span", {}, "原圖"), el("small", {}, `${bw}×${bh}`));
  const tagB = el("span", { class: "cmp-tag cmp-tag-b" }, el("small", {}, `${hw}×${hh}`), el("span", {}, "Hires"), el("b", {}, "B"));
  const zoomBtn = el("button", { class: "cmp-zoom", type: "button", title: "在「符合視窗」和「1:1 實際像素」之間切換（雙擊圖也可以）" }, "");
  const touch = matchMedia("(pointer: coarse)").matches;
  const hint = el("p", { class: "cmp-hint" }, touch ? "拖分隔線比較・雙指縮放・拖曳移動・點兩下 1:1" : "拖分隔線比較・滾輪放大・拖曳移動・雙擊 1:1");
  const close = el("button", { class: "cmp-close", type: "button", "aria-label": "關閉對比（Esc）", html: ICONS.close });
  const stage = el("div", { class: "cmp-stage" }, world, tagA, tagB, hint, zoomBtn);
  // id 要跟鎖的名字一樣：scroll-lock.js 靠「元素 id＝鎖的名字」認出誰是前景，
  // 其他掛在 body 上的一律設成 inert（沒有 id 的話這個視窗自己也會被關成收不到滑鼠）。
  const box = el("div", { class: "cmp", id: "compare-view", tabindex: "-1", role: "dialog", "aria-modal": "true", "aria-label": `Hires 對比：原圖 ${bw}×${bh}，Hires ${hw}×${hh}` }, stage, close);
  document.body.append(box);
  lockScroll("compare-view");

  // ---------- 狀態：圖左上角在螢幕上的位置 (x, y)、倍率 z（1 = 符合視窗）、分隔線 d（螢幕 x）----------
  let sw = 0, sh = 0, fw = 0, fh = 0; // 舞台大小、符合視窗時圖的大小
  const cur = { x: 0, y: 0, z: 1, d: 0 };
  const tgt = { x: 0, y: 0, z: 1, d: 0 };
  let maxZ = 8;
  let raf = 0;
  let moving = false;
  let settleTimer = 0;

  // 舞台的位置只在視窗改大小時變：量一次存起來。每個滑鼠事件都去量的話，剛寫完 transform
  // 就讀位置，會逼瀏覽器當場重算一次版面。
  let stageRect = null;
  function measure() {
    const r = (stageRect = stage.getBoundingClientRect());
    sw = r.width;
    sh = r.height;
    const s = Math.min(sw / hw, sh / hh);
    fw = hw * s;
    fh = hh * s;
    layerA.style.width = layerB.style.width = fw + "px";
    layerA.style.height = layerB.style.height = fh + "px";
    cut.style.width = inner.style.width = sw + "px";
    cut.style.height = inner.style.height = sh + "px";
    // 最多放到實際像素的 4 倍（至少是符合視窗的 3 倍）。
    maxZ = Math.max(3, (hw / fw) * 4);
  }
  function fitState(o) {
    o.z = 1;
    o.x = (sw - fw) / 2;
    o.y = (sh - fh) / 2;
  }
  // 放大時圖要蓋住舞台（不露出空白）；比舞台小的那一軸置中。
  function clampPan(o) {
    const w = fw * o.z;
    const h = fh * o.z;
    o.x = w <= sw ? (sw - w) / 2 : clamp(o.x, sw - w, 0);
    o.y = h <= sh ? (sh - h) / 2 : clamp(o.y, sh - h, 0);
  }
  function clampLine(o) {
    const left = Math.max(0, o.x);
    const right = Math.min(sw, o.x + fw * o.z);
    o.d = clamp(o.d, left, right);
  }
  let shownPct = -1;
  function paint() {
    const tr = `translate(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px) scale(${cur.z.toFixed(5)})`;
    layerA.style.transform = tr;
    layerB.style.transform = tr;
    const d = cur.d.toFixed(2);
    cut.style.transform = `translateX(${d}px)`;
    inner.style.transform = `translateX(-${d}px)`;
    line.style.transform = `translateX(${d}px)`;
    const pct = Math.round(((cur.z * fw) / hw) * 100);
    if (pct !== shownPct) {
      shownPct = pct;
      zoomBtn.textContent = `${pct}%`;
      const native = Math.abs(pct - 100) <= 2 ? "true" : "false";
      // 剛好走到 1:1：倍率那顆蓋一下章（跟其他「到位了」的回饋一樣）。
      if (native === "true" && zoomBtn.dataset.native === "false") seat(zoomBtn);
      zoomBtn.dataset.native = native;
    }
  }
  function announceLine() {
    const imgW = fw * cur.z;
    line.setAttribute("aria-valuenow", String(Math.round(imgW ? ((cur.d - cur.x) / imgW) * 100 : 50)));
  }
  function setMoving(on) {
    if (on === moving) return;
    moving = on;
    box.dataset.moving = on ? "true" : "false"; // CSS：動的時候才 will-change
  }
  // 數值追目標：依經過的時間收斂（時間常數 70ms，指數趨近），滾輪連續捲也是一條平滑的曲線；
  // 60Hz、144Hz 的螢幕走的是同一條曲線。
  let lastT = 0;
  function tick(now) {
    raf = 0;
    const dt = lastT ? Math.min(64, now - lastT) : 16;
    lastT = now;
    const k = reduced ? 1 : 1 - Math.exp(-dt / 70);
    let done = true;
    for (const key of ["x", "y", "z", "d"]) {
      const diff = tgt[key] - cur[key];
      const eps = key === "z" ? 0.0005 : 0.1;
      if (Math.abs(diff) > eps) {
        cur[key] += diff * k;
        done = false;
      } else cur[key] = tgt[key];
    }
    paint();
    if (!done) {
      setMoving(true);
      raf = requestAnimationFrame(tick);
    } else {
      lastT = 0;
      announceLine();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => setMoving(false), 120);
    }
  }
  function go() {
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function jump() {
    Object.assign(cur, tgt);
    paint();
  }

  // 以螢幕上 (px, py) 這一點為中心，把目標倍率改成 z。
  function zoomAt(px, py, z) {
    z = clamp(z, 1, maxZ);
    const r = z / tgt.z;
    // 分隔線跟著圖上同一點走（放大時它還在比較的是同一處）。
    const imgT = tgt.x;
    tgt.d = px - (px - tgt.d) * r;
    tgt.x = px - (px - imgT) * r;
    tgt.y = py - (py - tgt.y) * r;
    tgt.z = z;
    clampPan(tgt);
    clampLine(tgt);
    go();
  }

  // ---------- 開場：從示意圖飛出來，落定後分隔線掃一趟 ----------
  measure();
  fitState(cur);
  cur.d = cur.x + fw / 2;
  Object.assign(tgt, cur);
  paint();
  box.dataset.state = "in";
  // 等解碼的那一下先藏著：不然圖會先出現在定位，再跳回示意圖那裡飛出來（閃一下）。
  if (!reduced) world.style.opacity = "0";
  const intro = async () => {
    // 圖還沒解碼好就先等一下（示意圖用的是同一個網址，通常已經在快取裡）。decode() 在某些環境
    // 不會 settle，所以配一個保底時間。
    await Promise.race([Promise.all([imgA.decode?.(), imgB.decode?.()].map((p) => p?.catch(() => {}))), new Promise((r) => setTimeout(r, 450))]);
    if (!box.isConnected) return;
    world.style.opacity = "";
    // 示意圖跟大圖是同一張：飛出去的時候原地先藏起來，飛回去落地才出現。
    if (from?.isConnected) from.style.visibility = "hidden";
    if (reduced) return;
    const fr = from?.isConnected ? from.getBoundingClientRect() : null;
    const sr = stageRect || stage.getBoundingClientRect();
    if (fr && fr.width) {
      const s = fr.width / fw;
      const dx = fr.left - (sr.left + cur.x);
      const dy = fr.top - (sr.top + cur.y);
      // transform-origin 先設好，不放進關鍵影格：放進去的話整段動畫可能被拉回主執行緒跑。
      world.style.transformOrigin = `${cur.x}px ${cur.y}px`;
      world.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        { duration: DUR.long, easing: css(CURVE.out) }
      );
    } else {
      world.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], {
        duration: DUR.medium,
        easing: css(CURVE.out),
      });
    }
    // 分隔線掃一趟：往右、往左、回中間。示範它能拖，也讓兩邊的差別先被看到一次。
    const mid = cur.x + fw / 2;
    const seq = [
      [mid + fw * 0.18, DUR.long],
      [mid - fw * 0.16, DUR.xl],
      [mid, DUR.long],
    ];
    await new Promise((r) => setTimeout(r, DUR.long));
    for (const [d, ms] of seq) {
      if (!box.isConnected || touched) return;
      tgt.d = d;
      go();
      await new Promise((r) => setTimeout(r, ms));
    }
  };
  let touched = false;
  intro();

  // ---------- 操作 ----------
  const local = (e) => {
    const r = stageRect || stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  // 拖線、平移：這一格要畫就排一次，同一格裡來好幾個滑鼠事件也只畫一次。
  let paintRaf = 0;
  const paintSoon = () => {
    if (!paintRaf) paintRaf = requestAnimationFrame(() => {
      paintRaf = 0;
      paint();
    });
  };
  const firstTouch = () => {
    if (touched) return;
    touched = true;
    box.dataset.touched = "true"; // 提示淡掉
  };

  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      firstTouch();
      const p = local(e);
      // 觸控板的捏合送的是 ctrlKey + 小的 deltaY：同一條公式，係數大一點。
      const k = e.ctrlKey ? 0.012 : 0.0016;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(p.x, p.y, tgt.z * Math.exp(-dy * k));
    },
    { passive: false }
  );

  const pts = new Map();
  let drag = null; // { kind: "line" | "pan" | "pinch", ... }
  let vel = { x: 0, y: 0, t: 0 };

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest(".cmp-zoom")) return;
    firstTouch();
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* 指標已經不在（例如觸控被系統收走）：照樣處理這一下，只是拖出舞台就收不到 */
    }
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      drag = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), z: tgt.z };
      return;
    }
    const onLine = e.target.closest(".cmp-line") || Math.abs(p.x - cur.d) < 14;
    drag = onLine
      ? { kind: "line" }
      : { kind: "pan", sx: p.x, sy: p.y, ox: tgt.x, oy: tgt.y, od: tgt.d, t: performance.now(), moved: false };
    box.dataset.drag = drag.kind;
    vel = { x: 0, y: 0, t: performance.now(), px: p.x, py: p.y };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId) || !drag) return;
    const p = local(e);
    pts.set(e.pointerId, p);
    if (drag.kind === "pinch" && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, drag.z * (dist / (drag.dist || 1)));
      return;
    }
    if (drag.kind === "line") {
      tgt.d = p.x;
      clampLine(tgt);
      cur.d = tgt.d; // 拖線要跟手，不追
      paintSoon();
      return;
    }
    const dx = p.x - drag.sx;
    const dy = p.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    // 平移：圖和分隔線一起走（線比較的是圖上同一處）。
    tgt.x = drag.ox + dx;
    tgt.y = drag.oy + dy;
    tgt.d = drag.od + (tgt.x - drag.ox);
    clampPan(tgt);
    tgt.d = drag.od + (tgt.x - drag.ox);
    clampLine(tgt);
    Object.assign(cur, tgt);
    paintSoon();
    const now = performance.now();
    const dt = Math.max(1, now - vel.t);
    vel = { x: (p.x - vel.px) / dt, y: (p.y - vel.py) / dt, t: now, px: p.x, py: p.y };
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (drag?.kind === "pinch") {
      if (pts.size === 0) drag = null;
      return;
    }
    if (drag?.kind === "pan") {
      if (!drag.moved && performance.now() - drag.t < 300) {
        // 單擊：分隔線滑到這裡。
        tgt.d = local(e).x;
        clampLine(tgt);
        go();
      } else if (!reduced && performance.now() - vel.t < 60) {
        // 放開時還在動：順著慣性滑一段。
        const ox = tgt.x;
        tgt.x += vel.x * 180;
        tgt.y += vel.y * 180;
        clampPan(tgt);
        tgt.d += tgt.x - ox;
        clampLine(tgt);
        go();
      }
    }
    if (drag?.kind === "line") announceLine();
    drag = null;
    box.dataset.drag = "";
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);

  const toggleNative = (px = sw / 2, py = sh / 2) => {
    const native = hw / fw; // 1:1 實際像素的倍率
    zoomAt(px, py, tgt.z > 1.05 ? 1 : Math.max(native, 1.5));
    if (tgt.z === 1) {
      fitState(tgt);
      tgt.d = clamp(tgt.d, tgt.x, tgt.x + fw);
      go();
    }
  };
  stage.addEventListener("dblclick", (e) => {
    if (e.target.closest(".cmp-zoom")) return;
    const p = local(e);
    toggleNative(p.x, p.y);
  });
  zoomBtn.addEventListener("click", () => toggleNative());

  // ---------- 鍵盤（掛在 window 的捕獲階段：比底下詳情彈窗的 Esc／Tab 早，只關這一層）----------
  const onKey = (e) => {
    if (!box.isConnected) return;
    const k = e.key;
    if (k === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      shut();
      return;
    }
    if (k === "Tab") {
      e.stopImmediatePropagation();
      const f = [line, zoomBtn, close];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
      return;
    }
    const imgW = fw * tgt.z;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      tgt.d += (k === "ArrowLeft" ? -1 : 1) * imgW * (e.shiftKey ? 0.1 : 0.03);
      clampLine(tgt);
      go();
    } else if (k === "+" || k === "=") zoomAt(tgt.d, sh / 2, tgt.z * 1.4);
    else if (k === "-" || k === "_") zoomAt(tgt.d, sh / 2, tgt.z / 1.4);
    else if (k === "0") {
      fitState(tgt);
      tgt.d = tgt.x + fw / 2;
      go();
    } else return;
    firstTouch();
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener("keydown", onKey, true);

  const onResize = () => {
    const rel = fw ? (tgt.d - tgt.x) / (fw * tgt.z) : 0.5;
    measure();
    fitState(tgt);
    tgt.d = tgt.x + fw * rel;
    jump();
  };
  window.addEventListener("resize", onResize);

  function shut() {
    if (box.dataset.state === "out") return;
    box.dataset.state = "out";
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    cancelAnimationFrame(raf);
    unlockScroll("compare-view");
    cancelAnimationFrame(paintRaf);
    const bye = () => {
      box.remove();
      if (from) from.style.visibility = "";
    };
    const fr = from?.isConnected ? from.getBoundingClientRect() : null;
    const sr = stageRect || stage.getBoundingClientRect();
    const onScreen = fr && fr.width && fr.bottom > 0 && fr.top < innerHeight;
    if (reduced) bye();
    else if (onScreen) {
      // 飛回示意圖：跟開場那一下是一對。從現在看到的樣子（放大了也一樣）縮回去，
      // 標籤、提示、分隔線先淡掉（CSS 看 data-state="out"），只留圖在飛，落地前一刻才淡。
      const s = fr.width / (fw * cur.z);
      const dx = fr.left - (sr.left + cur.x);
      const dy = fr.top - (sr.top + cur.y);
      world.getAnimations().forEach((a) => a.cancel());
      world.style.transformOrigin = `${cur.x}px ${cur.y}px`;
      world.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], {
        duration: DUR.medium,
        easing: css(CURVE.inOut),
        fill: "forwards",
      });
      const a = box.animate([{ opacity: 1 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }], { duration: DUR.medium, fill: "forwards" });
      a.onfinish = bye;
      setTimeout(bye, DUR.medium + 200);
    } else {
      const a = box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" });
      a.onfinish = bye;
      setTimeout(bye, DUR.short + 200);
    }
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }
  close.addEventListener("click", shut);
  // 焦點放在視窗本身（不畫外框）：用滑鼠的人不會看到分隔線上一直掛著一圈焦點框；按 Tab 才走到線上。
  box.focus({ preventScroll: true });
  return { close: shut };
}
