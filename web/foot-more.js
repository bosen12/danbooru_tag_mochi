/**
 * 彈窗底部的按鈕：電腦上一排攤開；手機上只留主鈕＋「⋯」，其他的收進「⋯」打開的小選單。
 * 手機的彈窗底部只有一排寬，五顆按鈕會擠成兩三排、把圖往上推（作品冊、日誌的詳情）。
 *
 *   footMore(primary, rest)  回傳要放進 openSheet({ foot }) 的那一串
 * 選單從「⋯」往上長；點選單裡的按鈕照原本的動作做，做完選單收起來（「再按一次才刪」那種會留著讓人按第二次）。
 */
import { el } from "./ui.js";
import { reducedMotion, DUR, CURVE, css } from "./motion.js";

export const NARROW = "(max-width: 40rem)";

export function footMore(primary, rest, { narrow = matchMedia(NARROW).matches } = {}) {
  const items = rest.filter(Boolean);
  if (!narrow || !items.length) return [primary, ...items];
  const menu = el("div", { class: "foot-more-menu", role: "menu", hidden: true }, items);
  for (const b of items) b.setAttribute("role", "menuitem");
  const btn = el(
    "button",
    { class: "btn btn-small foot-more-btn", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": "更多動作", title: "更多動作" },
    "⋯"
  );
  const wrap = el("div", { class: "foot-more" }, btn, menu);
  const outside = (e) => {
    if (!wrap.contains(e.target)) shut();
  };
  const onKey = (e) => {
    if (e.key !== "Escape" || menu.hidden) return;
    e.stopPropagation();
    shut();
    btn.focus({ preventScroll: true });
  };
  function shut() {
    if (menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function open() {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", onKey, true);
    if (!reducedMotion()) menu.animate([{ opacity: 0, transform: "translateY(6px) scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
    items[0]?.focus({ preventScroll: true });
  }
  btn.addEventListener("click", () => (menu.hidden ? open() : shut()));
  // 選單裡按下去：照原本的動作做完再收（下一輪：原本的 click 先跑完）。武裝中的刪除鈕留著給第二下。
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("button, a");
    if (!b) return;
    setTimeout(() => {
      if (b.dataset.armed !== "true") shut();
    }, 0);
  });
  return [primary, wrap];
}
