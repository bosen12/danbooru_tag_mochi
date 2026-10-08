/**
 * 廢字簍面板（墨池）：點右下角的廢字簍，旁邊浮出一塊面板，列出封鎖了的字。
 *
 * 以前是蓋住整頁的彈窗：要封鎖十個字得開關十次。現在面板不擋畫面 ——
 * 開著的時候字盒整欄描一圈紅色虛線，點字盒的牌就丟進來（牌飛進面板），再點一次撿回去；
 * 點面板裡的牌也是撿回去（牌飛回字盒那一格）。Esc、再點一次廢字簍、或按「完成」收起來。
 *
 * 動態：面板從簍子那個角展開（牌依序浮上來），收起來時縮回簍子；丟進來的牌一路褪成灰、落地亮一圈；
 * 撿回去的從面板飛回字盒那一格，看不到那一格就原地浮起來淡掉；旁邊的牌滑過去補位、數字跳一下。
 *
 * 房間要給的：
 *   anchor          廢字簍那顆鈕（面板貼在它上面）
 *   makeNode(t)     畫一張牌（跟字盒同一個元件）
 *   onRescue(t)     撿回一張
 *   onRescueAll()   全部撿回來
 *   onToggle(open)  開、關（房間把挑牌模式收掉、重畫字盒記號）
 *   homeOf(t)       撿回去的牌要飛去哪（字盒那一張；沒有就 null）
 *   decorate(n, t)  面板上的牌做好之後給房間掛東西（拖曳）
 */
import { flip, flight, CURVE, DUR, css } from "./motion.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// 面板收成簍子那個角（右下，尖角的位置）；::after 的尖角在面板外面，底下多留 12px 不要被切掉。
const FOLDED = "inset(calc(100% - 34px) 14px -12px calc(100% - 78px) round 999px)";
const UNFOLDED = "inset(0px 0px -12px 0px round 10px)";
const GREY = "grayscale(0.85)";
// 一次撿回很多張（全部撿回來）：只讓前面幾張飛，其他的直接收，不然滿天都是牌。
const MAX_FLY = 12;

export function createTrashPanel({ anchor, makeNode, onRescue, onRescueAll, onToggle = () => {}, homeOf = () => null, decorate = () => {} }) {
  let open = false;
  let closeTimer = 0;
  const nodes = new Map();

  const el = document.createElement("section");
  el.className = "trash-panel";
  el.id = "trash-panel";
  el.hidden = true;
  el.setAttribute("aria-label", "廢字簍");
  el.innerHTML = `
    <header class="tp-head">
      <h2 class="tp-title">廢字簍<b>0</b></h2>
      <span class="tp-acts"><button class="btn btn-small btn-ghost tp-all" type="button">全部撿回來</button><button class="btn btn-small tp-done" type="button">完成</button></span>
    </header>
    <p class="tp-hint">點左邊字盒的牌就丟進來，再點一次撿回去。這裡的字不會被抽到。</p>
    <div class="tp-grid" role="list"></div>
    <p class="tp-empty">還是空的。點字盒裡不想看到的牌，或把牌拖進來。</p>`;
  document.body.append(el);
  const grid = el.querySelector(".tp-grid");
  const count = el.querySelector(".tp-title b");
  const empty = el.querySelector(".tp-empty");
  const allBtn = el.querySelector(".tp-all");
  el.querySelector(".tp-done").addEventListener("click", () => setOpen(false));
  allBtn.addEventListener("click", () => onRescueAll());

  function setOpen(v) {
    v = !!v;
    if (v === open) return;
    open = v;
    clearTimeout(closeTimer);
    anchor.setAttribute("aria-expanded", open ? "true" : "false");
    anchor.dataset.open = open ? "true" : "false";
    document.body.dataset.trashEdit = open ? "true" : "false";
    el.getAnimations().forEach((x) => x.cancel());
    if (open) {
      el.hidden = false;
      if (!reduced()) {
        // 從簍子那個角長出來：先是一顆小圓，攤開成面板；裡面的牌晚一點依序浮上來。
        el.animate([{ clipPath: FOLDED, opacity: 0.4 }, { clipPath: UNFOLDED, opacity: 1 }], { duration: DUR.long, easing: css(CURVE.out) });
        const kids = [...grid.children].slice(0, 24);
        const step = Math.min(22, 260 / Math.max(1, kids.length));
        kids.forEach((n, i) =>
          n.animate([{ opacity: 0, transform: "translateY(12px) scale(0.94)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: 90 + i * step, easing: css(CURVE.out), fill: "backwards" })
        );
      }
    } else if (reduced()) el.hidden = true;
    else {
      el.animate([{ clipPath: UNFOLDED, opacity: 1 }, { clipPath: FOLDED, opacity: 0 }], { duration: DUR.medium, easing: css(CURVE.in), fill: "forwards" });
      // 不靠 onfinish（分頁在背景時動畫可能不走）：時間到就收。
      closeTimer = setTimeout(() => {
        if (open) return;
        el.hidden = true;
        el.getAnimations().forEach((x) => x.cancel());
      }, DUR.medium + 20);
    }
    onToggle(open);
  }

  function cardFor(tag) {
    const node = makeNode(tag);
    node.setAttribute("role", "listitem");
    node.tabIndex = 0;
    node.title = "點一下撿回去";
    node.addEventListener("click", () => onRescue(tag));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onRescue(tag);
      }
    });
    decorate(node, tag);
    return node;
  }

  const inView = (r) => r && r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  /** 撿回去的那張（snap＝拿掉之前拍下的複製＋位置）：飛回字盒那一格，看不到那一格就原地浮起來淡掉。 */
  function leave({ ghost: g, rect: r }, tag, delay) {
    const home = homeOf(tag);
    const hr = home?.getBoundingClientRect();
    if (home && inView(hr)) {
      // 顏色一路回來；字盒那張先藏著，影子落地才亮、輕輕彈一下。
      home.style.visibility = "hidden";
      const { duration } = flight(g, r, () => home, {
        delay,
        arc: 60,
        tilt: 6,
        onLand: () => {
          home.style.visibility = "";
          if (!reduced()) home.animate([{ scale: "1.08" }, { scale: "1" }], { duration: DUR.medium, easing: css(CURVE.settle) });
        },
      });
      g.animate([{ filter: GREY, opacity: 0.85 }, { filter: "none", opacity: 1 }], { duration, delay, easing: "linear", fill: "both" });
      return;
    }
    Object.assign(g.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", margin: "0", zIndex: "95", pointerEvents: "none" });
    g.style.setProperty("--card-w", r.width + "px");
    document.body.append(g);
    g.animate(
      [
        { transform: "none", opacity: 1, filter: GREY },
        { transform: "translateY(-8px) scale(1.05)", opacity: 1, filter: "none", offset: 0.35 },
        { transform: "translateY(-30px) scale(0.9)", opacity: 0, filter: "none" },
      ],
      { duration: DUR.medium, delay, easing: css(CURVE.inOut), fill: "both" }
    );
    setTimeout(() => g.remove(), delay + DUR.medium + 60);
  }

  /**
   * 跟著封鎖清單重排：新的排最前面（剛丟進來的就在眼前）；撿走的飛回字盒，旁邊的滑過來補位。
   * arriving：剛丟進來、影子還在路上的那張 —— 先藏著，影子落地（land(tag)）才亮。
   */
  function sync(tags, { arriving = null } = {}) {
    const want = new Set(tags);
    const gone = [...nodes.keys()].filter((t) => !want.has(t));
    const added = tags.filter((t) => !nodes.has(t));
    const before = count.textContent;
    count.textContent = String(tags.length);
    if (open && before !== count.textContent && !reduced()) {
      count.animate([{ transform: "translateY(-5px) scale(1.3)", color: "var(--color-accent)" }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.settle) });
    }
    empty.hidden = tags.length > 0;
    allBtn.disabled = tags.length === 0;
    if (!gone.length && !added.length) return;
    // 撿走的：拿掉之前先拍下位置和樣子（原位馬上讓出來給其他牌補位），之後影子從這裡出發。
    const snaps =
      open && !reduced()
        ? gone.slice(0, MAX_FLY).map((t) => {
            const n = nodes.get(t);
            const rect = n.getBoundingClientRect();
            const ghost = n.cloneNode(true);
            ghost.style.visibility = "";
            return { t, snap: { ghost, rect } };
          }).filter((s) => s.snap.rect.width)
        : [];
    const mutate = () => {
      for (const t of gone) {
        nodes.get(t).remove();
        nodes.delete(t);
      }
      for (const t of [...added].reverse()) {
        const n = cardFor(t);
        if (t === arriving) n.style.visibility = "hidden";
        nodes.set(t, n);
        grid.prepend(n);
      }
    };
    if (open) flip(grid, mutate);
    else mutate();
    const step = Math.min(40, 360 / Math.max(1, snaps.length));
    snaps.forEach(({ t, snap }, i) => leave(snap, t, i * step));
  }

  return {
    el,
    sync,
    toggle: () => setOpen(!open),
    open: () => setOpen(true),
    close: () => setOpen(false),
    get isOpen() {
      return open;
    },
    /** 面板上那張牌（影子飛過來的落點）。 */
    nodeOf: (tag) => nodes.get(tag) || null,
    /** 影子落地：那張亮出來，輕輕彈一下、外面亮一圈紅。 */
    land(tag) {
      const n = nodes.get(tag);
      if (!n) return;
      n.style.visibility = "";
      if (reduced()) return;
      n.animate([{ scale: "1.12" }, { scale: "1" }], { duration: DUR.medium, easing: css(CURVE.settle) });
      n.animate([{ boxShadow: "0 0 0 3px var(--color-accent), var(--shadow-card)" }, { boxShadow: "0 0 0 12px transparent, var(--shadow-card)" }], { duration: DUR.xl, easing: css(CURVE.out) });
    },
    /** 丟進來的影子路上褪成灰（跟面板上的牌同一個樣子）。 */
    fade(ghost, duration) {
      if (!reduced()) ghost.animate([{ filter: "none" }, { filter: GREY }], { duration, easing: "linear", fill: "forwards" });
    },
  };
}
