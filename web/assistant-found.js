/**
 * 助手找到的牌：浮空小字盒（聊天室「看這 N 張」）。
 *
 * 找牌一次找到幾十張時，聊天室只列前幾張；這裡把全部攤開，照花色分（跟字盒一樣的花色鈕，各寫幾張），
 * 選了花色再照小分類分。點牌放進合成池（從這張牌飛過去），再點一次拿掉。
 * 不擋畫面（不是彈窗）：開著也能照常點字盒、改規則；Esc、✕、新對話收起來。
 *
 * 動態（只動 transform／opacity；減少動態時直接切換）：
 *   打開：從「看這 N 張」那顆鈕長出來，牌一張張發下來。收起：縮回那顆鈕（鈕不在了就原地淡出）。
 *   換花色、小分類：留下的牌從舊位置滑到新位置（FLIP），離開的在原地淡出縮小，新來的依序浮上來。
 *   選中的花色底下一塊墨色滑過去；小分類那一排展開、收起有高度過渡。
 *   點牌：牌飛進合成池，這張彈一下、勾蓋上去；拿掉時勾淡出。
 *
 * 只在 AI 助手打開時才會被叫到：實驗功能關著時頁面上沒有這個節點。
 */
import { el } from "./ui.js";
import { reducedMotion, DUR, CURVE, css } from "./motion.js";
import { t } from "./i18n.js";
import { CARD_SUIT_INFO, CARD_SUITS } from "./cards.js";

let root = null;
let state = null;
let anchorNode = null;

const fill = (tpl, ...args) => String(tpl).replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
const MAX_ANIM = 36; // 一次最多替幾張牌做動畫（其他直接到位）：上百張一起動反而掉格

function onKey(e) {
  if (e.key === "Escape" && root && !document.querySelector(".overlay")) {
    e.stopPropagation();
    closeFound();
  }
}

/** 從某個點長出來／縮回去：transform-origin 設在那個點（相對小字盒）。 */
function originAt(node, point) {
  const box = node.getBoundingClientRect();
  if (!point) return "50% 0";
  const x = Math.max(-box.width, Math.min(box.width * 2, point.x - box.left));
  const y = Math.max(-box.height, Math.min(box.height * 2, point.y - box.top));
  return `${x}px ${y}px`;
}
function centerOf(node) {
  if (!node?.isConnected || !node.getClientRects().length) return null;
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function closeFound() {
  if (!root) return;
  const node = root;
  const back = centerOf(anchorNode);
  root = null;
  state = null;
  anchorNode = null;
  removeEventListener("keydown", onKey, true);
  // 收起的那一刻就不能再點、讀屏也不念；縮回那顆鈕後拿掉（動畫沒跑完也照時間拿掉）。
  node.inert = true;
  node.setAttribute("aria-hidden", "true");
  if (reducedMotion()) return node.remove();
  node.style.transformOrigin = originAt(node, back);
  node.animate(
    [{ opacity: 1, transform: "none" }, { opacity: 0, transform: back ? "scale(0.3)" : "translateY(10px) scale(0.97)" }],
    { duration: DUR.medium, easing: css(CURVE.exit), fill: "forwards" }
  );
  setTimeout(() => node.remove(), DUR.medium + 40);
}

/**
 * ctx：助手的工作台（cardFace、cardMeta、pin、unpin）。tags：找到的全部牌。anchor：按下去的那顆鈕（從那裡長出來）。
 */
export function openFound({ ctx, tags, anchor = null }) {
  const metas = [];
  const seen = new Set();
  for (const tag of tags || []) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    const m = ctx.cardMeta?.(tag);
    if (m) metas.push(m);
  }
  if (!metas.length) return;
  const fresh = !root;
  if (!root) build();
  anchorNode = anchor;
  state = { ctx, metas, suit: "", group: "" };
  root.querySelector(".ai-found-title").textContent = fill(t("助手找到的 {0} 張"), metas.length);
  buildSuits();
  buildGrid();
  paintGroups(false);
  applyFilter();
  moveInk(false);
  if (!reducedMotion()) {
    if (fresh) {
      root.style.transformOrigin = originAt(root, centerOf(anchor));
      root.animate([{ opacity: 0, transform: "scale(0.35)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    }
    deal(visibleCards(), fresh ? 140 : 40);
  }
  root.querySelector(".ai-found-close").focus({ preventScroll: true });
}

function build() {
  const close = el("button", { class: "ghost icon-btn ai-found-close", type: "button", title: "收起", "aria-label": "收起" }, "✕");
  close.addEventListener("click", closeFound);
  root = el(
    "section",
    { class: "ai-found", id: "ai-found", role: "dialog", "aria-modal": "false", "aria-labelledby": "ai-found-title" },
    el("header", { class: "ai-found-head" }, el("h3", { class: "ai-found-title", id: "ai-found-title" }), close),
    el("div", { class: "ai-found-suits", role: "group", "aria-label": "花色" }),
    el("div", { class: "ai-found-groups", role: "group", "aria-label": "小分類", hidden: true }),
    el("div", { class: "ai-found-scroll" }, el("div", { class: "ai-found-grid" })),
    el("p", { class: "ai-found-hint" }, "點牌放進合成池，再點一次拿掉。")
  );
  document.body.append(root);
  // 合成池在別處改了（字盒點牌、助手、復原）：滑鼠回到小字盒時照實際的重畫勾選。
  root.addEventListener("pointerenter", syncFound);
  addEventListener("keydown", onKey, true);
}

function counts(list, key) {
  const m = new Map();
  for (const x of list) m.set(x[key], (m.get(x[key]) || 0) + 1);
  return m;
}

/* ---------- 花色列：鈕只在換一批牌時重建；選哪一個只換 aria-pressed、墨色滑過去 ---------- */
function buildSuits() {
  const { metas } = state;
  const suits = root.querySelector(".ai-found-suits");
  const bySuit = counts(metas, "suit");
  const rank = (s) => (CARD_SUITS.includes(s) ? CARD_SUITS.indexOf(s) : 99);
  const order = [...bySuit.keys()].sort((a, b) => rank(a) - rank(b));
  suits.replaceChildren(
    el("span", { class: "ai-found-ink", "aria-hidden": "true" }),
    el("button", { class: "suit-tab pressable", type: "button", dataset: { suit: "" }, "aria-pressed": "true", onclick: () => pick("", "") }, "全部", el("span", { class: "ai-found-n" }, String(metas.length))),
    ...order.map((s) =>
      el(
        "button",
        { class: "suit-tab pressable", type: "button", style: `--suit: var(--suit-${s})`, dataset: { suit: s }, "aria-pressed": "false", onclick: () => pick(s, "") },
        el("b", { class: "suit-glyph", "aria-hidden": "true" }, CARD_SUIT_INFO[s]?.glyph || "?"),
        CARD_SUIT_INFO[s]?.zh || s,
        el("span", { class: "ai-found-n" }, String(bySuit.get(s)))
      )
    )
  );
}

/** 墨色：選中的那顆底下一塊，換選的時候滑過去（量位置、用 transform 動，不動 left／width）。 */
function moveInk(animate = true) {
  const suits = root.querySelector(".ai-found-suits");
  const ink = suits.querySelector(".ai-found-ink");
  const on = suits.querySelector(`button[data-suit="${CSS.escape(state.suit)}"]`);
  for (const b of suits.querySelectorAll("button[data-suit]")) b.setAttribute("aria-pressed", b === on ? "true" : "false");
  if (!ink || !on) return;
  const box = suits.getBoundingClientRect();
  const r = on.getBoundingClientRect();
  const was = ink.dataset.x ? { x: +ink.dataset.x, y: +ink.dataset.y, w: +ink.dataset.w } : null;
  const now = { x: r.left - box.left, y: r.top - box.top, w: r.width };
  Object.assign(ink.style, { width: `${now.w}px`, height: `${r.height}px`, transform: `translate(${now.x}px, ${now.y}px)` });
  Object.assign(ink.dataset, { x: now.x, y: now.y, w: now.w });
  if (!animate || !was || reducedMotion()) return;
  ink.animate(
    [{ transform: `translate(${was.x}px, ${was.y}px) scaleX(${was.w / now.w})` }, { transform: `translate(${now.x}px, ${now.y}px)` }],
    { duration: DUR.medium, easing: css(CURVE.travel) }
  );
}

/* ---------- 小分類列：選了花色才有；展開、收起有高度過渡 ---------- */
function paintGroups(animate = true) {
  const { metas } = state;
  const groups = root.querySelector(".ai-found-groups");
  const inSuit = state.suit ? metas.filter((m) => m.suit === state.suit) : [];
  const byGroup = counts(inSuit, "group");
  const show = !!state.suit && byGroup.size >= 2;
  const key = show ? `${state.suit}` : "";
  const wasShown = !groups.hidden;
  const before = wasShown ? groups.offsetHeight : 0;
  if (groups.dataset.key !== key) {
    groups.dataset.key = key;
    if (show) {
      const zhOf = new Map(inSuit.map((m) => [m.group, m.groupZh]));
      groups.replaceChildren(
        el("button", { class: "chip-toggle pressable", type: "button", dataset: { group: "" }, "aria-pressed": "true", onclick: () => pick(state.suit, "") }, "全部"),
        ...[...byGroup.keys()].map((g) => {
          const zh = String(zhOf.get(g) || g);
          const cut = zh.indexOf("・");
          return el(
            "button",
            { class: "chip-toggle pressable", type: "button", dataset: { group: g }, "aria-pressed": "false", onclick: () => pick(state.suit, g) },
            cut > 0 ? zh.slice(cut + 1) : zh,
            el("span", { class: "ai-found-n" }, String(byGroup.get(g)))
          );
        })
      );
    } else groups.replaceChildren();
  }
  for (const b of groups.querySelectorAll("button[data-group]")) b.setAttribute("aria-pressed", b.dataset.group === state.group ? "true" : "false");
  groups.hidden = !show;
  if (!animate || reducedMotion()) return;
  const after = show ? groups.offsetHeight : 0;
  if (before === after && wasShown === show) return;
  if (show) {
    // 一排籤從上面長出來：高度 0 → 實際（只有這一小排，量一次），籤依序落下。
    groups.animate([{ height: `${before}px`, opacity: wasShown ? 1 : 0 }, { height: `${after}px`, opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
    if (!wasShown || groups.dataset.fresh !== key)
      [...groups.children].forEach((n, i) =>
        n.animate([{ opacity: 0, transform: "translateY(-6px) scale(0.92)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: 40 + i * 24, easing: css(CURVE.out), fill: "backwards" })
      );
    groups.dataset.fresh = key;
  } else if (wasShown) {
    // 收起：留一個影子把高度收掉（真的那排已經 hidden，下面的牌一起往上滑）。
    const ghost = el("div", { class: "ai-found-groups-ghost", "aria-hidden": "true" });
    groups.after(ghost);
    ghost.animate([{ height: `${before}px` }, { height: "0px" }], { duration: DUR.short, easing: css(CURVE.exit) }).onfinish = () => ghost.remove();
    setTimeout(() => ghost.remove(), DUR.short + 60);
  }
}

/* ---------- 牌 ---------- */
function buildGrid() {
  const grid = root.querySelector(".ai-found-grid");
  const key = state.metas.map((m) => m.tag).join("|");
  if (grid.dataset.key === key && grid.childElementCount) return;
  grid.dataset.key = key;
  grid.replaceChildren(...state.metas.map(cardButton));
  root.querySelector(".ai-found-scroll").scrollTop = 0;
}

function applyFilter() {
  const grid = root.querySelector(".ai-found-grid");
  for (const n of grid.children) {
    const show = (!state.suit || n.dataset.suit === state.suit) && (!state.group || n.dataset.group === state.group);
    n.hidden = !show;
    n.setAttribute("aria-pressed", state.ctx.cardMeta?.(n.dataset.tag)?.inPool ? "true" : "false");
  }
}

function visibleCards() {
  return [...root.querySelectorAll(".ai-found-card:not([hidden])")];
}

/** 在捲動框看得到的那幾張（動畫只做這些）。 */
function inView(cards) {
  const box = root.querySelector(".ai-found-scroll").getBoundingClientRect();
  return cards.filter((n) => {
    const r = n.getBoundingClientRect();
    return r.bottom > box.top - 40 && r.top < box.bottom + 40;
  });
}

/** 發牌：一張張從上面落下、帶一點歪斜，最後擺正。 */
function deal(cards, delay0 = 0) {
  inView(cards).slice(0, MAX_ANIM).forEach((n, i) => {
    const tilt = (i % 2 ? 1 : -1) * (2 + (i % 3));
    n.animate(
      [{ opacity: 0, transform: `translateY(-18px) rotate(${tilt}deg) scale(0.9)` }, { opacity: 1, transform: "none" }],
      { duration: DUR.long, delay: delay0 + i * 22, easing: css(CURVE.settle), fill: "backwards" }
    );
  });
}

/** 換花色／小分類：留下的牌滑到新位置，離開的原地淡出（影子），新來的依序浮上來。 */
function pick(suit, group) {
  if (!state || (state.suit === suit && state.group === group)) return;
  const scroll = root.querySelector(".ai-found-scroll");
  const motion = !reducedMotion();
  const beforeVisible = motion ? inView(visibleCards()) : [];
  const first = new Map(beforeVisible.map((n) => [n, n.getBoundingClientRect()]));
  const suitChanged = state.suit !== suit;
  state.suit = suit;
  state.group = group;
  moveInk(motion);
  paintGroups(motion);
  applyFilter();
  scroll.scrollTop = 0;
  if (!motion) return;
  // 離開的：在原本的位置放一張影子淡出縮小（真的那張已經 hidden，版面照新的排）。
  const layer = root.querySelector(".ai-found-scroll");
  const lbox = layer.getBoundingClientRect();
  let gone = 0;
  for (const [n, r] of first) {
    if (!n.hidden || gone >= MAX_ANIM) continue;
    gone++;
    const ghost = n.cloneNode(true);
    ghost.className = "ai-found-ghost";
    ghost.removeAttribute("id");
    ghost.hidden = false;
    Object.assign(ghost.style, { left: `${r.left - lbox.left}px`, top: `${r.top - lbox.top + layer.scrollTop}px`, width: `${r.width}px`, height: `${r.height}px` });
    layer.append(ghost);
    ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.9)" }], { duration: DUR.micro, easing: css(CURVE.exit), fill: "forwards" }).onfinish = () => ghost.remove();
    setTimeout(() => ghost.remove(), DUR.micro + 80);
  }
  // 留下的：從舊位置滑到新位置。新來的：依序浮上來。
  let fresh = 0;
  for (const n of inView(visibleCards()).slice(0, MAX_ANIM)) {
    const was = first.get(n);
    if (was) {
      const r = n.getBoundingClientRect();
      const dx = was.left - r.left;
      const dy = was.top - r.top;
      if (dx || dy) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: DUR.medium, delay: 40, easing: css(CURVE.travel), fill: "backwards" });
    } else {
      n.animate(
        [{ opacity: 0, transform: `translateY(${suitChanged ? 14 : 8}px) scale(0.94)` }, { opacity: 1, transform: "none" }],
        { duration: DUR.medium, delay: 60 + fresh++ * 18, easing: css(CURVE.out), fill: "backwards" }
      );
    }
  }
}

function cardButton(m) {
  const face = state.ctx.cardFace?.(m.tag) || el("span", { class: "ai-found-blank", dataset: { noI18n: "" } }, m.tag);
  // 被目前分級、尺度擋著的牌：淡一點、滑鼠提示寫原因（放得進合成池，但這一檔抽不到）。
  const b = el(
    "button",
    {
      class: "ai-found-card pressable",
      type: "button",
      dataset: { tag: m.tag, suit: m.suit, group: m.group, ...(m.blocked ? { blocked: m.blocked } : {}) },
      "aria-pressed": m.inPool ? "true" : "false",
      ...(m.blocked ? { title: t("被目前的分級或尺度擋著") } : {}),
    },
    face
  );
  b.addEventListener("click", () => toggle(b));
  return b;
}

function toggle(b) {
  if (!state) return;
  const tag = b.dataset.tag;
  const inPool = state.ctx.cardMeta?.(tag)?.inPool;
  try {
    // 放進去時從這張牌飛到合成池（跟從字盒點一樣）；拿掉直接拿。
    if (inPool) state.ctx.unpin([tag]);
    else state.ctx.pin([tag], { from: () => b.getBoundingClientRect() });
  } catch {
    /* 放不進去（互斥、禁用）：狀態照實際的畫 */
  }
  const now = !!state.ctx.cardMeta?.(tag)?.inPool;
  b.setAttribute("aria-pressed", now ? "true" : "false");
  // 勾蓋上去／淡出：只在這一下播（重畫時不播）。
  b.dataset.just = now ? "in" : "out";
  clearTimeout(b._just);
  b._just = setTimeout(() => delete b.dataset.just, DUR.long + 60);
  if (reducedMotion()) return;
  const face = b.firstElementChild;
  if (now) face?.animate([{ transform: "scale(1)" }, { transform: "scale(0.9)", offset: 0.35 }, { transform: "scale(1.04)", offset: 0.7 }, { transform: "scale(1)" }], { duration: DUR.long, easing: css(CURVE.out) });
  else face?.animate([{ transform: "scale(1)" }, { transform: "scale(0.96)" }, { transform: "scale(1)" }], { duration: DUR.short, easing: css(CURVE.out) });
  if (!now && inPool) b.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
}

export function syncFound() {
  if (root && state) applyFilter();
}
