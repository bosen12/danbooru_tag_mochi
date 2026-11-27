/**
 * 帶入相關牌：合成池裡一張牌按右鍵（或詳情裡「帶入相關牌…」）浮出的小面板。
 * 選「幾個點以上」「最多幾張」，下面當場列出會帶入哪幾張（照相關度由高到低），按「帶入 N 張」就放進合成池。
 * 跟「更多規則」的補相關牌同一套挑法（related.js 的 pickRelated），設定也是同一份（settings.relatedFill 的 dots、max）。
 *
 * 呼叫端（app.js）給：
 *   pick(dots)     → Promise<[{ tag, milli, card }]>，已經照門檻、相關度排好，也拿掉了會擠掉池子裡的牌的（最多 12 張）
 *   onChange(v)    → 存 { dots, max }
 *   onBring(items, from) → 放進合成池；from 是每張預覽小籤的位置（牌從那裡飛進池子）
 * 關掉：Esc、點外面、捲動、視窗變大小、按了帶入。
 */
import { el } from "./ui.js";
import { DUR, CURVE, css, reducedMotion, dropAnimated } from "./motion.js";
import { relatedDots, relatedValue } from "./related.js";
import { t } from "./i18n.js";

export const FILL_MAX = 8;
let open = null;

export function closeRelatedFill() {
  if (!open) return;
  const o = open;
  open = null;
  o.cleanup();
  if (reducedMotion()) return void o.box.remove();
  const a = o.box.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-4px) scale(0.98)" }], { duration: DUR.micro, easing: css(CURVE.exit), fill: "forwards" });
  a.onfinish = () => dropAnimated(o.box);
}

function dotsNode(n) {
  return el("span", { class: "rf-dots", "aria-hidden": "true" }, [1, 2, 3].map((i) => el("i", { class: i <= n ? "is-on" : "" })));
}

export function openRelatedFill(anchor, { name = "", dots = 2, max = 3, pick, onChange, onBring, nameOf = (c) => c.zh || c.tag } = {}) {
  closeRelatedFill();
  if (!anchor || typeof pick !== "function") return;
  let state = { dots: [1, 2, 3].includes(dots) ? dots : 2, max: Math.max(1, Math.min(FILL_MAX, Number(max) || 3)) };
  let items = [];
  let seq = 0;

  const dotBtns = [1, 2, 3].map((n) =>
    el(
      "button",
      { class: "rf-seg pressable", type: "button", "aria-pressed": n === state.dots ? "true" : "false", "aria-label": t(`${n} 個點以上`), title: t(`${n} 個點以上`), onclick: () => setDots(n) },
      dotsNode(n),
      n < 3 ? el("span", { class: "rf-seg-plus" }, "以上") : null
    )
  );
  const maxOut = el("output", { class: "rf-n" }, String(state.max));
  const minus = el("button", { class: "rf-step pressable", type: "button", "aria-label": "少一張", onclick: () => setMax(state.max - 1) }, "−");
  const plus = el("button", { class: "rf-step pressable", type: "button", "aria-label": "多一張", onclick: () => setMax(state.max + 1) }, "+");
  const list = el("div", { class: "rf-list", "aria-live": "polite" });
  const note = el("p", { class: "rf-note" });
  const go = el("button", { class: "btn btn-primary rf-go", type: "button", onclick: () => bring() });
  const box = el(
    "div",
    { class: "rf-pop", role: "dialog", "aria-label": t("帶入相關牌") },
    el("div", { class: "rf-head" }, el("b", {}, "帶入相關牌"), el("span", { class: "rf-sub" }, el("span", { dataset: { noI18n: "" } }, name), el("span", {}, " 在 Danbooru 上常一起出現的"))),
    el("div", { class: "rf-row" }, el("span", { class: "rf-label" }, "相關度"), el("div", { class: "rf-segs", role: "group" }, dotBtns)),
    el("div", { class: "rf-row" }, el("span", { class: "rf-label" }, "最多"), el("div", { class: "rf-stepper" }, minus, maxOut, plus), el("span", { class: "rf-unit" }, "張")),
    list,
    note,
    el("div", { class: "rf-foot" }, go)
  );
  box.dataset.loading = "true";
  document.body.append(box);

  // 位置只在打開時算一次：放在牌下面就釘上緣、往下長；下面放不下就放上面、釘下緣、往上長。
  // 以前清單讀回來每次重算 top：放在上面時面板會整塊往上跳（2026-11-28）。
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = Math.max(box.offsetHeight, 220);
    const gap = 8;
    const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    box.style.left = `${Math.round(left)}px`;
    if (r.bottom + gap + h <= innerHeight - 8 || r.top - gap - h < 8) {
      box.style.top = `${Math.round(Math.max(8, Math.min(r.bottom + gap, innerHeight - h - 8)))}px`;
      box.style.bottom = "auto";
      box.style.transformOrigin = "top left";
    } else {
      box.style.top = "auto";
      box.style.bottom = `${Math.round(innerHeight - (r.top - gap))}px`;
      box.style.transformOrigin = "bottom left";
    }
  };
  // 面板高度變了（清單讀回來、最多幾張改了）：從舊高度平順變過去，不一格跳。
  const resize = (from) => {
    if (reducedMotion() || !box.isConnected) return;
    const to = box.offsetHeight;
    if (Math.abs(to - from) < 2) return;
    box._grow?.cancel();
    box._grow = box.animate([{ height: `${from}px`, overflow: "hidden" }, { height: `${to}px`, overflow: "hidden" }], { duration: DUR.short + 60, easing: css(CURVE.travel) });
  };

  function paintControls() {
    dotBtns.forEach((b, i) => b.setAttribute("aria-pressed", i + 1 === state.dots ? "true" : "false"));
    maxOut.textContent = String(state.max);
    minus.disabled = state.max <= 1;
    plus.disabled = state.max >= FILL_MAX;
  }

  function paintList(animate) {
    const from = box.offsetHeight;
    const shown = items.slice(0, state.max);
    // 讀取中：先放幾個淡淡的佔位小籤撐住高度，讀回來換成真的（面板不會先矮後高）。
    if (box.dataset.loading && !items.length) {
      list.replaceChildren(...Array.from({ length: Math.min(state.max, 4) }, () => el("span", { class: "rf-chip rf-chip-ghost", "aria-hidden": "true" })));
    } else list.replaceChildren(
      ...shown.map((it, i) =>
        el(
          "span",
          { class: "rf-chip", dataset: { tag: it.tag }, title: `${t(["", "相關度：一格", "相關度：兩格", "相關度：三格"][relatedDots(it.milli)])}（${relatedValue(it.milli)}）`, style: `--i: ${i}` },
          el("span", { class: "rf-chip-name", dataset: { noI18n: "" } }, nameOf(it.card)),
          dotsNode(relatedDots(it.milli))
        )
      )
    );
    if (box.dataset.loading) note.textContent = t("讀取中…");
    else if (!items.length) note.textContent = t("沒有符合的相關牌");
    else if (items.length < state.max) note.textContent = t(`符合的只有 ${items.length} 張`);
    else note.textContent = "";
    note.hidden = !note.textContent;
    go.disabled = !shown.length;
    go.textContent = shown.length ? t(`帶入 ${shown.length} 張`) : box.dataset.loading ? t("帶入") : t("沒有可以帶入的");
    if (animate && !reducedMotion()) {
      list.querySelectorAll(".rf-chip").forEach((c, i) =>
        c.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, delay: i * 35, easing: css(CURVE.out), fill: "backwards" })
      );
    }
    resize(from);
  }

  async function load() {
    const mine = ++seq;
    box.dataset.loading = "true";
    let got = [];
    try {
      got = await pick(state.dots);
    } catch {
      got = [];
    }
    if (mine !== seq || open?.box !== box) return;
    delete box.dataset.loading;
    items = Array.isArray(got) ? got : [];
    paintList(true);
  }

  function setDots(n) {
    if (n === state.dots) return;
    state = { ...state, dots: n };
    paintControls();
    onChange?.({ ...state });
    load();
  }
  function setMax(n) {
    const v = Math.max(1, Math.min(FILL_MAX, n));
    if (v === state.max) return;
    state = { ...state, max: v };
    paintControls();
    onChange?.({ ...state });
    paintList(false);
  }
  function bring() {
    const shown = items.slice(0, state.max);
    if (!shown.length) return;
    const from = new Map([...list.querySelectorAll(".rf-chip")].map((c) => [c.dataset.tag, c.getBoundingClientRect()]));
    closeRelatedFill();
    onBring?.(shown, from);
  }

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeRelatedFill();
      anchor.focus?.({ preventScroll: true });
    }
  };
  const onDown = (e) => {
    if (!box.contains(e.target) && e.target !== anchor) closeRelatedFill();
  };
  const onMove = () => closeRelatedFill();
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onDown, true);
  addEventListener("resize", onMove);
  addEventListener("scroll", onMove, { capture: true, passive: true });
  open = {
    box,
    cleanup() {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      removeEventListener("resize", onMove);
      removeEventListener("scroll", onMove, { capture: true });
    },
  };
  paintControls();
  paintList(false);
  place();
  if (!reducedMotion()) {
    box.animate([{ opacity: 0, transform: "translateY(-6px) scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
  }
  (dotBtns[state.dots - 1] || go).focus({ preventScroll: true });
  load();
}
