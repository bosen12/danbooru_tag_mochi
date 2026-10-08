/** 墨池的畫面零件：建元素、遮罩、提示、滑鼠停留說明。只產生 DOM，不管流程。 */
import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { DUR, CURVE, css, reducedMotion } from "./motion.js";
import { translateTree } from "./i18n.js";

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return translateTree(node);
}

export const ICONS = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>',
};

/* ---------- 遮罩 ---------- */

let openOverlays = [];

export function openSheet(title, body, { wide = false, onClose, foot, translateTitle = true } = {}) {
  const lastFocus = document.activeElement;
  const titleId = "sheet-" + Math.random().toString(36).slice(2, 8);
  const closeBtn = el("button", { class: "sheet-close", type: "button", "aria-label": "關閉", html: ICONS.close });
  // 手機上彈窗是一張從底部拉上來的紙：上緣一條握把，往下拉就收起來（見 swipeToClose）。
  const grip = el("div", { class: "sheet-grip", "aria-hidden": "true" });
  const sheet = el(
    "div",
    { class: wide ? "sheet sheet-wide" : "sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId },
    grip,
    el("h2", { id: titleId, dataset: translateTitle ? {} : { noI18n: "" } }, title),
    closeBtn,
    body,
    foot && foot.filter(Boolean).length ? el("div", { class: "sheet-foot" }, foot) : null
  );
  // 捲動鎖在 html 上、背景設成 inert —— 跟排字匣、導影台同一把鎖（web/scroll-lock.js），
  // 開彈窗時背景不會跳，鍵盤也 Tab 不到被蓋住的東西。
  const overlayId = "overlay-" + titleId;
  const overlay = el("div", { class: "overlay", id: overlayId }, sheet);
  const close = () => {
    if (!overlay.isConnected || overlay.dataset.closing) return;
    overlay.dataset.closing = "true";
    document.removeEventListener("keydown", onKey, true);
    openOverlays = openOverlays.filter((o) => o !== overlay);
    unlockScroll(overlayId);
    setTimeout(() => overlay.remove(), 170);
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    onClose && onClose();
  };
  closeBtn.addEventListener("click", close);
  swipeToClose(sheet, close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  const onKey = (e) => {
    if (openOverlays.at(-1) !== overlay) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      const f = [...sheet.querySelectorAll("button, [href], input, select, [tabindex]:not([tabindex='-1'])")].filter((n) => !n.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  document.addEventListener("keydown", onKey, true);
  document.body.append(overlay);
  openOverlays.push(overlay);
  lockScroll(overlayId);
  (sheet.querySelector(".sheet-foot .btn-primary") || closeBtn).focus({ preventScroll: true });
  return { close, sheet };
}

/**
 * 手機：按住抽屜頂端（握把或標題）往下拉，紙跟著手指走；拉超過 90px 或往下甩就收起來，
 * 不到就彈回去。只認觸控、只在內容捲在最上面時 —— 不跟捲動內文搶。
 * 握把和標題設了 touch-action: none（styles.css），瀏覽器才不會把這一下當成捲動拿走。
 */
function swipeToClose(sheet, close) {
  if (!matchMedia("(max-width: 40rem)").matches) return;
  let drag = null;
  sheet.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || sheet.scrollTop > 0) return;
    if (!e.target.closest(".sheet-grip, h2") || e.target.closest("button, a")) return;
    drag = { id: e.pointerId, y: e.clientY, t: performance.now(), dy: 0 };
    try {
      sheet.setPointerCapture(e.pointerId);
    } catch {
      /* 指標已經不在：照樣處理 */
    }
  });
  sheet.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // 往上拉只給一點點阻力，不讓紙離開底邊。
    const raw = e.clientY - drag.y;
    drag.dy = raw > 0 ? raw : raw / 6;
    sheet.style.animation = "none";
    sheet.style.transform = `translateY(${drag.dy.toFixed(1)}px)`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, t } = drag;
    drag = null;
    const speed = dy / Math.max(1, performance.now() - t);
    if (dy > 90 || (dy > 24 && speed > 0.6)) {
      if (!reducedMotion()) {
        sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(100%)" }], {
          duration: DUR.short,
          easing: css(CURVE.exit),
          fill: "forwards",
        });
      }
      close();
      return;
    }
    if (dy && !reducedMotion()) {
      sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.settle) });
    }
    sheet.style.transform = "";
  };
  sheet.addEventListener("pointerup", end);
  sheet.addEventListener("pointercancel", end);
}

export function anyOverlay() {
  return openOverlays.length > 0;
}

/* ---------- 提示 ---------- */

let toastTimer = null;
// 帶按鈕的提示還剩多久：滑鼠移過去、鍵盤走到按鈕上就先停住倒數（伸手去按的時候不會剛好消失）。
let toastDeadline = 0;
let toastLeft = 0;
let toastNow = null;
let toastWired = false;

function hideToast() {
  const t = document.getElementById("toast");
  clearTimeout(toastTimer);
  toastNow = null;
  if (t) t.dataset.show = "false";
}

function wireToast(t) {
  if (toastWired) return;
  toastWired = true;
  const hold = () => {
    if (!toastNow || t.dataset.paused === "true") return;
    clearTimeout(toastTimer);
    toastLeft = Math.max(0, toastDeadline - Date.now());
    t.dataset.paused = "true";
  };
  const release = () => {
    if (!toastNow || t.dataset.paused !== "true" || t.matches(":hover") || t.contains(document.activeElement)) return;
    t.dataset.paused = "false";
    // 放開之後至少再留一秒多，不要一移開就不見。
    const ms = Math.max(toastLeft, 1400);
    toastDeadline = Date.now() + ms;
    toastTimer = setTimeout(hideToast, ms);
  };
  t.addEventListener("pointerenter", hold);
  t.addEventListener("focusin", hold);
  t.addEventListener("pointerleave", release);
  t.addEventListener("focusout", () => setTimeout(release, 0));
}

/**
 * 畫面下方的提示。action：{ label, run, key? } 帶一顆按鈕（例如「復原」），這時提示多留一會兒、
 * 可以點；按了就收起來。底下一條線倒數還剩多久；key 是鍵盤上也能按的那個字（見 runToastAction）。
 * 沒帶 action 的跟以前一樣 2.6 秒自己消失。
 */
export function toast(text, { action = null, ms = action ? 5200 : 2600 } = {}) {
  const t = document.getElementById("toast");
  if (!t) return;
  wireToast(t);
  t.replaceChildren(document.createTextNode(text));
  toastNow = action;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-action pressable";
    b.textContent = action.label;
    if (action.key) {
      const k = document.createElement("kbd");
      k.textContent = action.key;
      b.append(k);
      b.setAttribute("aria-keyshortcuts", action.key);
    }
    b.addEventListener("click", () => {
      hideToast();
      action.run();
    });
    t.append(b);
    // 倒數線：每次都是新的一條，動畫從頭跑（CSS 用 --toast-ms）。
    const clock = document.createElement("i");
    clock.className = "toast-clock";
    clock.setAttribute("aria-hidden", "true");
    t.append(clock);
  }
  t.style.setProperty("--toast-ms", ms + "ms");
  t.dataset.action = action ? "true" : "false";
  t.dataset.paused = "false";
  t.dataset.show = "true";
  clearTimeout(toastTimer);
  toastDeadline = Date.now() + ms;
  toastTimer = setTimeout(hideToast, ms);
}

/** 提示上那顆按鈕的快捷鍵（墨池的 Z＝復原）：提示還在、快捷鍵對得上就按它，回傳有沒有按到。 */
export function runToastAction(key) {
  const t = document.getElementById("toast");
  const a = toastNow;
  if (!a || !a.key || a.key.toLowerCase() !== String(key).toLowerCase() || !t || t.dataset.show !== "true") return false;
  hideToast();
  a.run();
  return true;
}

/* ---------- 滑鼠停留說明：滑鼠停 800ms，鍵盤聚焦立刻 ---------- */

let tip = null;
let tipTimer = null;
const FINE = typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;

export function attachTip(node, build) {
  node.addEventListener("focus", () => {
    if (node.matches(":focus-visible")) showTip(node, build());
  });
  node.addEventListener("blur", hideTip);
  if (!FINE) return;
  node.addEventListener("pointerenter", () => {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(node, build()), 800);
  });
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("pointerdown", hideTip);
}

function showTip(node, content) {
  if (!node.isConnected || !content || document.body.dataset.dragging === "true") return;
  if (!tip) {
    tip = el("div", { class: "hover-tip", role: "tooltip" });
    document.body.append(tip);
  }
  tip.replaceChildren(content);
  const r = node.getBoundingClientRect();
  const w = 240;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  tip.style.left = left + "px";
  tip.dataset.show = "true";
  const h = tip.offsetHeight;
  let top = r.top - h - 10;
  if (top < 8) top = r.bottom + 10;
  tip.style.top = top + "px";
}

export function hideTip() {
  clearTimeout(tipTimer);
  if (tip) tip.dataset.show = "false";
}
