/**
 * Hires：把印好的一張放大、重畫細節，做好的大圖直接換掉原本那張（墨池成品牆、疊印台晾紙繩共用）。
 *
 *   快速 —— 圖在 latent 裡放大，再用 0.5 的重繪強度畫一次細節。快，構圖不動。
 *   深度 —— 先用放大模型（RealESRGAN anime）補細節，再用 0.4 輕輕重畫。慢一些，線條最乾淨。
 *
 * 後端走同一條 /api/gen（payload 多一個 hires），所以斷線重接、停、心跳都跟付印一樣。
 * 原圖留在 target.baseImage：再做一次 Hires 永遠從原圖放大（不會越放越大、越放越糊），也可以還原。
 *
 * target 是墨池的 shot 或疊印台的 print，要有 image、positive、loras、ckpt、rating、width、height。
 * 進行中的狀態掛在 target.hi（不存檔）；做好的結果是 target.hires（存檔）。
 */
import { el } from "./ui.js";
import { t as translate } from "./i18n.js";
import { createGenerator } from "./gen.js";
import { currentHiresSampling } from "./workflow.js";
import { seat, refuse, reducedMotion, DUR, CURVE, css } from "./motion.js";

export const HIRES_MODES = {
  quick: { zh: "快速", def: 1.5, note: "在原圖上放大，再重畫一次細節。快，構圖不動。" },
  deep: { zh: "深度", def: 2, note: "先用放大模型補細節，再輕輕重畫。慢一些，線條最乾淨。" },
};
const MIN = 1.25;
const MAX = 3;
const STEP = 0.25;
// 跟伺服器同一套上限：每邊 4096、總像素 4096² 的一半。超過的倍率在選單裡就按不下去。
const SIDE_MAX = 4096;
const PIXELS_MAX = (4096 * 4096) / 2;
const PREF_KEY = "web6.hires";

const round8 = (n) => Math.round(n / 8) * 8;
export const hiresSize = (w, h, scale) => [round8(w * scale), round8(h * scale)];
const fits = (w, h, s) => {
  const [W, H] = hiresSize(w, h, s);
  return W <= SIDE_MAX && H <= SIDE_MAX && W * H <= PIXELS_MAX;
};
/** 這張最多能放大幾倍（照 STEP 一格一格往上試）。 */
export function maxScale(w, h) {
  let best = 0;
  for (let s = MIN; s <= MAX + 1e-9; s += STEP) if (fits(w, h, s)) best = s;
  return best;
}
const fmt = (s) => (Number.isInteger(s) ? String(s) : s.toFixed(2).replace(/0$/, "")) + "×";

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    return {
      mode: p.mode === "deep" ? "deep" : "quick",
      quick: Number(p.quick) >= MIN && Number(p.quick) <= MAX ? Number(p.quick) : HIRES_MODES.quick.def,
      deep: Number(p.deep) >= MIN && Number(p.deep) <= MAX ? Number(p.deep) : HIRES_MODES.deep.def,
    };
  } catch {
    return { mode: "quick", quick: HIRES_MODES.quick.def, deep: HIRES_MODES.deep.def };
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* 無痕模式：這次記不住就算了 */
  }
}

/** 原圖的尺寸（Hires 過的，width/height 仍是原圖的：同種子重印、回到這一版都要用原本的尺寸）。 */
const baseSize = (t) => [t.width || 1024, t.height || 1024];

/** 狀態一句話：「Hires 快速 1.5×・繪製 8/20」。 */
export function hiresLabel(t) {
  const hi = t.hi;
  if (!hi) return "";
  const head = `Hires ${HIRES_MODES[hi.mode].zh} ${fmt(hi.scale)}`;
  return hi.status === "queued" ? `${head}・排隊中` : hi.status === "running" ? `${head}・${hi.note || "重畫中"}` : hi.status === "failed" ? `${head}沒做成：${hi.note}` : head;
}

export const hiresBusy = (t) => !!t.hi && (t.hi.status === "queued" || t.hi.status === "running");

/**
 * 跑 Hires 的佇列（自己一條，跟付印分開：按「停」停付印，不會連 Hires 一起砍）。
 * hooks.update(target)：target.hi 或 target.image 變了。
 * hooks.done(target)：新圖換上去了（呼叫端存檔、播顯影）。
 */
export function createHires(hooks) {
  const tasks = new Map(); // task.id → task
  const gen = createGenerator({
    origin: hooks.origin,
    payload: (task) => {
      const t = task.target;
      return {
        width: t.width,
        height: t.height,
        loras: t.loras,
        ckpt: t.ckpt,
        rating: t.rating,
        // 工作流面板裡這一種 Hires 改過的 steps／CFG／denoise。
        hires: { mode: task.mode, scale: task.scale, image: t.baseImage || t.image, ...(task.sampling || {}) },
      };
    },
    update: (task) => {
      const t = task.target;
      if (t.hi?.task !== task.id) return; // 已經被取消或換成新的一次
      // 拿到伺服器的工作編號就先存一次：做到一半重新整理頁面，用它接回去（跟付印一樣）。
      if (task.job && t.hi.job !== task.job) {
        t.hi = { ...t.hi, job: task.job };
        hooks.save && hooks.save(t);
      }
      if (task.status === "done") {
        tasks.delete(task.id);
        if (!t.baseImage) t.baseImage = t.image;
        const [W, H] = hiresSize(...baseSize(t), task.scale);
        const r = task.result || {};
        // 最後一幀預覽墊在底下，新圖從它上面由上往下顯影（不會先跳回舊圖再顯影）。
        t._hiresUnder = t.hi?.preview || null;
        t.image = task.image;
        t.hires = { mode: task.mode, scale: task.scale, width: r.width || W, height: r.height || H, seed: task.seed, sampling: task.sampling || {} };
        t.hi = null;
        hooks.update(t);
        hooks.done && hooks.done(t);
        return;
      }
      if (task.status === "failed" || task.status === "cancelled") {
        tasks.delete(task.id);
        t.hi = task.status === "failed" ? { ...t.hi, status: "failed", note: task.note || "Comfy 報錯" } : null;
        hooks.update(t);
        return;
      }
      t.hi = {
        ...t.hi,
        status: task.status === "running" && task.note !== "排隊中" ? "running" : "queued",
        progress: task.progress || 0,
        note: task.note,
        // Comfy 一路送來的預覽幀（跟付印一樣看得到它一步步重畫）。
        preview: task.preview || t.hi?.preview || null,
      };
      hooks.update(t);
    },
    stopped: () => {},
  });

  return {
    start(t, mode, scale) {
      if (hiresBusy(t) || !(t.baseImage || t.image)) return false;
      const task = {
        id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        target: t,
        mode,
        scale,
        sampling: currentHiresSampling(mode),
        positive: t.positive,
        seed: Math.floor(Math.random() * 2 ** 32),
      };
      tasks.set(task.id, task);
      t.hi = { task: task.id, mode, scale, sampling: task.sampling, status: "queued", progress: 0, note: "" };
      hooks.update(t);
      gen.enqueue(task);
      return true;
    },
    /** 重新整理之前做到一半的那張（存檔裡有 hiresJob）：用工作編號接回去，從頭重播進度。 */
    resume(t, saved) {
      if (!saved || !saved.job || !HIRES_MODES[saved.mode] || hiresBusy(t)) return false;
      const task = {
        id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        target: t,
        mode: saved.mode,
        scale: saved.scale,
        sampling: saved.sampling || {},
        positive: t.positive,
        seed: 0,
        job: saved.job,
      };
      tasks.set(task.id, task);
      t.hi = { task: task.id, mode: saved.mode, scale: saved.scale, sampling: task.sampling, status: "queued", progress: 0, note: "接回剛才那張…", job: saved.job };
      hooks.update(t);
      gen.resume(task);
      return true;
    },
    /** 停這一張的 Hires。 */
    cancel(t) {
      if (!t.hi) return;
      const id = t.hi.task;
      t.hi = null;
      hooks.update(t);
      const task = tasks.get(id);
      if (!task) return;
      tasks.delete(id);
      gen.cancelOne(task);
    },
    /** 換回原圖。 */
    restore(t) {
      if (!t.baseImage) return false;
      t.image = t.baseImage;
      t.baseImage = null;
      t.hires = null;
      hooks.update(t);
      return true;
    },
    /** 失敗的那一行按掉。 */
    dismiss(t) {
      if (t.hi && t.hi.status === "failed") {
        t.hi = null;
        hooks.update(t);
      }
    },
    get busy() {
      return gen.busy;
    },
  };
}

/* ================= 選單 ================= */

let openPicker = null;

export function closeHiresPicker({ focus = false } = {}) {
  const p = openPicker;
  if (!p) return;
  openPicker = null;
  p.cleanup();
  const node = p.node;
  if (focus) p.anchor.focus({ preventScroll: true });
  p.anchor.setAttribute("aria-expanded", "false");
  if (reducedMotion()) return node.remove();
  node.animate(
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: `translateY(${p.below ? -4 : 4}px)` },
    ],
    { duration: DUR.micro, easing: css(CURVE.exit), fill: "forwards" }
  ).onfinish = () => node.remove();
}

/**
 * 從 anchor 那顆鈕彈出 Hires 選單。
 * opts.onStart(mode, scale)；opts.onRestore()（有 Hires 過才出現「還原原圖」）。
 */
export function openHiresPicker(anchor, t, { onStart, onRestore }) {
  if (openPicker && openPicker.anchor === anchor) return closeHiresPicker({ focus: true });
  closeHiresPicker();
  const prefs = loadPrefs();
  const [w, h] = baseSize(t);
  const top = maxScale(w, h);
  let mode = prefs.mode;
  const scaleOf = (m) => Math.min(prefs[m], top);
  let scale = scaleOf(mode);

  const out = el("output", {}, fmt(scale));
  const size = el("span", { class: "hp-size" });
  const note = el("p", { class: "hp-note" });
  const minus = el("button", { class: "pressable", type: "button", "aria-label": "倍率少一格" }, "−");
  const plus = el("button", { class: "pressable", type: "button", "aria-label": "倍率多一格" }, "＋");
  const go = el("button", { class: "btn btn-small btn-primary hp-go", type: "button" }, "開始 Hires");
  const sync = () => {
    out.textContent = fmt(scale);
    const [W, H] = hiresSize(w, h, scale);
    size.textContent = `${w}×${h} → ${W}×${H}`;
    note.textContent = HIRES_MODES[mode].note;
    minus.disabled = scale <= MIN + 1e-9;
    plus.disabled = scale + STEP > top + 1e-9;
    plus.title = plus.disabled && scale < MAX ? `這張最多放大到 ${fmt(top)}` : "";
  };
  const bump = (d) => {
    const next = Math.round((scale + d * STEP) / STEP) * STEP;
    if (next < MIN - 1e-9 || next > top + 1e-9) return refuse(d > 0 ? plus : minus);
    scale = next;
    prefs[mode] = scale;
    savePrefs(prefs);
    sync();
  };
  minus.onclick = () => bump(-1);
  plus.onclick = () => bump(1);

  const modes = el(
    "div",
    { class: "segmented hp-modes", role: "radiogroup", "aria-label": "Hires 方式" },
    Object.entries(HIRES_MODES).map(([m, info]) =>
      el(
        "button",
        {
          class: "pressable",
          type: "button",
          role: "radio",
          dataset: { v: m },
          "aria-checked": m === mode ? "true" : "false",
          onclick: (e) => {
            if (mode === m) return;
            mode = m;
            prefs.mode = m;
            savePrefs(prefs);
            // 每種各記各的倍率：快速停在 1.5、深度停在 2，切過去就是那一種上次用的。
            scale = scaleOf(m);
            for (const b of modes.children) b.setAttribute("aria-checked", b === e.currentTarget ? "true" : "false");
            seat(e.currentTarget);
            sync();
          },
        },
        info.zh
      )
    )
  );

  const done = t.hires;
  const node = el(
    "div",
    { class: "hires-pop", role: "dialog", "aria-label": "Hires：放大並重畫細節" },
    el("div", { class: "hp-head" }, el("b", {}, "Hires"), size),
    modes,
    el("div", { class: "hp-row" }, el("span", { class: "stepper hp-scale" }, el("span", { class: "stepper-label" }, "倍率"), minus, out, plus)),
    note,
    top < MIN ? el("p", { class: "hp-note", dataset: { kind: "err" } }, "這張已經太大，不能再放大。") : null,
    done
      ? el(
          "p",
          { class: "hp-was" },
          `現在是 ${HIRES_MODES[done.mode]?.zh || ""} ${fmt(done.scale)}（${done.width}×${done.height}）`,
          el(
            "button",
            {
              class: "hp-restore",
              type: "button",
              onclick: () => {
                closeHiresPicker({ focus: true });
                onRestore && onRestore();
              },
            },
            "還原原圖"
          )
        )
      : null,
    el("div", { class: "hp-acts" }, go)
  );
  go.disabled = top < MIN;
  go.onclick = () => {
    closeHiresPicker({ focus: true });
    onStart(mode, scale);
  };
  sync();
  document.body.append(node);

  // 擺在按鈕下方，放不下就放上方；左右不超出畫面。
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const pw = node.offsetWidth;
    const ph = node.offsetHeight;
    const below = r.bottom + 8 + ph <= innerHeight - 8 || r.top - 8 - ph < 8;
    node.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + "px";
    node.style.top = (below ? Math.min(r.bottom + 8, innerHeight - ph - 8) : r.top - 8 - ph) + "px";
    node.style.transformOrigin = `${Math.max(12, Math.min(pw - 12, r.left + r.width / 2 - parseFloat(node.style.left)))}px ${below ? "0" : "100%"}`;
    return below;
  };
  const below = place();
  anchor.setAttribute("aria-expanded", "true");
  if (!reducedMotion()) {
    node.animate(
      [
        { opacity: 0, transform: `translateY(${below ? -6 : 6}px) scale(0.97)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: DUR.short, easing: css(CURVE.out) }
    );
  }
  modes.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });

  const y0 = scrollY;
  const onDown = (e) => {
    if (!node.contains(e.target) && !anchor.contains(e.target)) closeHiresPicker();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeHiresPicker({ focus: true });
    } else if (e.key === "Enter" && e.target === node.querySelector('[aria-checked="true"]')) {
      e.preventDefault();
      go.click();
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.target.closest(".hp-modes")) {
      e.preventDefault();
      const other = modes.querySelector('[aria-checked="false"]');
      other.click();
      other.focus();
    }
  };
  // 頁面捲了一段（手機上手指一滑）：選單不跟著跑，直接收掉。
  const onScroll = () => Math.abs(scrollY - y0) > 8 && closeHiresPicker();
  const onResize = () => place();
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey, true);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onResize);
  openPicker = {
    anchor,
    node,
    below,
    cleanup() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
    },
  };
}

/* ================= 圖上的進度 ================= */

/**
 * 在畫框（frame）上畫 Hires 進行中的樣子：一條套準線照進度由上往下掃，線下的圖稍微壓暗
 * （「這一段還沒重畫」），左下角一行狀態和一顆停。沒在做就拿掉。
 */
export function paintHiresVeil(frame, t, { onCancel, onDismiss }) {
  let veil = frame.querySelector(":scope > .hires-veil");
  const hi = t.hi;
  if (!hi) {
    if (veil && !veil.classList.contains("is-leaving")) {
      veil.classList.add("is-leaving");
      const v = veil;
      if (reducedMotion()) v.remove();
      else
        v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" }).onfinish = () => v.remove();
    }
    return;
  }
  if (!veil || veil.classList.contains("is-leaving")) {
    veil = el(
      "div",
      { class: "hires-veil" },
      el("img", { class: "hv-preview", alt: "", "aria-hidden": "true", decoding: "async", hidden: true }),
      el("div", { class: "hv-dim" }),
      el("div", { class: "hv-rule" }),
      el("div", { class: "hv-bar" }, el("span", { class: "hv-text", role: "status" }), el("button", { class: "hv-act pressable", type: "button" }))
    );
    frame.append(veil);
  }
  veil.dataset.status = hi.status;
  const pv = veil.querySelector(".hv-preview");
  if (hi.preview && pv.getAttribute("src") !== hi.preview) {
    // 新的一幀解碼好才換上：上一幀留著，不會閃一下空白。
    const next = new Image();
    next.onload = () => {
      if (!veil.isConnected || t.hi?.preview !== hi.preview) return;
      const first = pv.hidden;
      pv.src = hi.preview;
      pv.hidden = false;
      veil.dataset.preview = "true";
      if (first && !reducedMotion()) pv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
    };
    next.src = hi.preview;
  }
  veil.style.setProperty("--p", String(hi.status === "running" ? hi.progress || 0 : 0));
  const text = veil.querySelector(".hv-text");
  const label = hiresLabel(t);
  if (text.textContent !== translate(label)) text.textContent = label;
  const act = veil.querySelector(".hv-act");
  const failed = hi.status === "failed";
  act.textContent = failed ? "知道了" : "停";
  act.onclick = (e) => {
    e.stopPropagation();
    failed ? onDismiss() : onCancel();
  };
}
