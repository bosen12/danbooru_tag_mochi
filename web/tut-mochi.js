/**
 * 教學影片裡的墨池螢幕：介面（桅杆、字盒、合成池、規則、抽牌列、成品牆）畫成 1600×880 的一台螢幕，
 * 尺寸跟真的畫面 1:1；游標在裡面點、拖、按。這個檔案只管「介面」和「時間軸的底層」：
 *   字盒的視圖（花色、小分類、搜尋結果）什麼時候換、牌怎麼發出來
 *   合成池的牌什麼時候飛進來、被擠掉、飛回去（用 PoolTL 排時間，位置照置中排版算）
 *   成品牆的一張張成品（草稿、印製中、顯影、展開）
 * 每一章要演什麼，寫在 tut-mochi-a.js（放牌、關係）和 tut-mochi-b.js（規則、抽牌、成品牆、手牌）。
 * 規則全部是真引擎算的（applyPin、ratingBlocked）：哪張牌會帶哪張來、換掉誰，畫面照它的結果演。
 */
import { EZ, seg, lerp, quad, spring, esc, mk, put, setHTML, V, SW, SH, env, makeScreen, box, label, makeCursor, cardEl, addFlag, stampFlag, suitOf, zhOf, arc } from "./tut-kit.js";
import { bar, BEAT } from "./tutorial-score.js";
import { ratingBlocked } from "./rules/rating.js";
import { CARD_SUIT_INFO, cardFacts } from "./cards.js";
import { english, t as translate } from "./i18n.js";

export const b = bar;
export const B = BEAT;

/* ================= 版面（離螢幕中心的座標，跟真的畫面 1:1） ================= */

export const LIBRARY = { x0: -725, y0: -128, dx: 92, dy: 131, cols: 4, w: 84 };
export const slotOf = (i) => ({ x: LIBRARY.x0 + (i % LIBRARY.cols) * LIBRARY.dx, y: LIBRARY.y0 + Math.floor(i / LIBRARY.cols) * LIBRARY.dy });
export const POOL = { cx: 212, y: -224, pitch: 108, w: 96, left: -333, top: -307, width: 1090, height: 165 };

const RATING_TIER = ["general", "sensitive", "explicit"];
const RATING_ZH = { general: "全年齡", sensitive: "敏感", explicit: "色情" };
const HEAT_ZH = ["活動", "誘惑", "走光", "性愛"];
const SUITS = ["cast", "look", "wear", "pose", "scene", "style"];

/** 字盒裡看不看得到（跟 app.js 的 visible() 同一套，只是不看合成池）。 */
export function visibleIn(card, { rating = "general", era = "modern" } = {}) {
  if (ratingBlocked(card.item, rating)) return false;
  if (card.gate === "male") return false;
  if (era !== "mixed" && !card.eras.includes("any") && !card.eras.includes(era)) return false;
  return true;
}

/** 字盒的一個視圖：花色／小分類／搜尋字，加上分級、時代。 */
export function viewList({ suit = "all", group = "", q = "", rating = "general", era = "modern" } = {}) {
  const Q = q.toLowerCase();
  // Illustration downloads do not change the scripted cards or group chips.
  // cardEl renders the same text placeholders as the workbench.
  return env.lib.cards.filter((c) => visibleIn(c, { rating, era }) && (suit === "all" || c.suit === suit) && (!group || c.group === group || c.item.group === group) && (!Q || c.zh.toLowerCase().includes(Q) || c.tag.includes(Q)));
}
export function countOf(opts) {
  const Q = (opts.q || "").toLowerCase();
  return env.lib.cards.filter((c) => visibleIn(c, opts) && (!opts.suit || opts.suit === "all" || c.suit === opts.suit) && (!opts.group || c.group === opts.group || c.item.group === opts.group) && (!Q || c.zh.toLowerCase().includes(Q) || c.tag.includes(Q))).length;
}

/* ================= 建畫面 ================= */

const ICON = {
  lora: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 8v8h6"/></svg>`,
  model: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>`,
  flow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="12" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M8 7l8 4M8 17l8-4"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="7" width="8" height="12" rx="1.5" transform="rotate(-14 7 13)"/><rect x="8" y="5" width="8" height="12" rx="1.5"/><rect x="13" y="7" width="8" height="12" rx="1.5" transform="rotate(14 17 13)"/></svg>`,
  dice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/></svg>`,
};
export { ICON };

/** 分段選項（尺度分級、人物）：thumb 的位置由 set(i) 決定。回傳 { el, set(i, ex?) }。 */
export function segmented(parent, x, y, labels, w, h = 40, { cls = "" } = {}) {
  const el = box(parent, "tseg " + cls, x, y, labels.length * w + 6, h);
  const th = mk("i", "th", el);
  th.style.width = w + "px";
  const items = labels.map((l) => {
    const s = mk("span", "", el, esc(l));
    s.style.width = w + "px";
    return s;
  });
  let cur = -1;
  return {
    el,
    set(i, ex = false) {
      if (i === cur && th.classList.contains("ex") === ex) return;
      cur = i;
      th.style.transform = `translateX(${i * w}px)`;
      th.classList.toggle("ex", ex);
      items.forEach((s, k) => s.classList.toggle("on", k === i));
    },
    /** thumb 滑動中的位置（連續值）。 */
    slide(f, ex = false) {
      th.style.transform = `translateX(${(f * w).toFixed(1)}px)`;
      th.classList.toggle("ex", ex);
      items.forEach((s, k) => s.classList.toggle("on", Math.abs(k - f) < 0.5));
    },
  };
}

export function buildMochiScreen(S, ctx) {
  const scr = makeScreen(S, { x: 0, y: 0 });
  const { O, fx, frame } = scr;
  const m = { scr, O, fx, frame, S, ctx, ui: {} };

  /* ---------- 桅杆 ---------- */
  box(O, "tmast", -800, -440, 1600, 56);
  label(O, "twm", -782, -426, "墨池");
  const nav = box(O, "tnav", -717, -430, 156, 38, `<i class="on">墨池</i><i>疊印台</i>`);
  m.ui.navFuse = { x: -640, y: -411 };
  label(O, "tmore", -548, -424, "介紹影片");
  m.ui.rating = segmented(O, 45, -432, RATING_TIER.map((r) => RATING_ZH[r]), 60, 44);
  m.ui.rating.set(0);
  m.ui.ratingX = (i) => 45 + 3 + i * 60 + 30;
  box(O, "tbtn", 239, -432, 119, 44, `${ICON.lora}<span>選 LoRA</span>`);
  m.ui.loraBtn = { x: 298, y: -410 };
  box(O, "tbtn", 367, -432, 180, 44, `${ICON.model}<span>waiIllustriousS…</span>`);
  m.ui.modelBtn = { x: 457, y: -410 };
  box(O, "tbtn", 555, -430, 40, 40, ICON.flow);
  m.ui.flowBtn = { x: 575, y: -410 };
  box(O, "tbtn", 603, -430, 40, 40, ICON.sound);
  m.ui.soundBtn = { x: 623, y: -410 };
  label(O, "tping", 660, -419, `<i></i>Comfy 已連`);

  /* ---------- 字盒 ---------- */
  label(O, "thead", -767, -354, "字盒");
  m.ui.count = box(O, "tcount tl", -600, -347, 203, 14, "");
  m.ui.count.style.textAlign = "right";
  m.ui.search = box(O, "tsearch", -767, -317, 370, 40, `<span class="ph">搜尋：紅髮、kimono…（按 / 跳到這裡）</span><span class="tx"></span><span class="tcaret"></span>`);
  m.ui.searchPh = m.ui.search.querySelector(".ph");
  m.ui.searchTx = m.ui.search.querySelector(".tx");
  m.ui.searchCaret = m.ui.search.querySelector(".tcaret");
  m.ui.searchCaret.style.visibility = "hidden";
  // 花色分頁（全部 + 六個花色）：位置照真的畫面，兩排。
  const TAB_POS = { all: [-767, -266, 44], cast: [-718, -266, 65], look: [-648, -266, 62], wear: [-579, -266, 64], pose: [-509, -266, 64], scene: [-767, -230, 66], style: [-697, -230, 65] };
  m.ui.tabs = {};
  m.ui.tabPos = {};
  for (const [id, [x, y, w]] of Object.entries(TAB_POS)) {
    const suit = id === "all" ? null : id;
    const el = box(O, "tchip" + (suit ? "" : " flat"), x, y, w, 34, suit ? `<b>${esc(CARD_SUIT_INFO[suit].glyph)}</b>${esc(CARD_SUIT_INFO[suit].zh)}` : "全部");
    if (suit) el.style.setProperty("--suit", `var(--suit-${suit})`);
    m.ui.tabs[id] = el;
    m.ui.tabPos[id] = { x: x + w / 2, y: y + 17 };
  }
  // 小分類晶片：選了花色才有（放在第二排底下 y=-188 起）。
  m.ui.groupBox = box(O, "tb", -767, -190, 370, 34, "");
  m.ui.groupBox.style.display = "none";

  m.ui.libEmpty = box(O, "tb", -767, -150, 370, 60, "字盒裡沒有「kimono」。可能被分級、性別或時代收起來了。");
  m.ui.libEmpty.style.cssText += ";font:500 15px/1.5 var(--font-body);color:var(--color-muted);opacity:0";

  /* ---------- 合成池（在 M：會跟著頁面捲） ---------- */
  const M = mk("div", "torg", O);
  M.style.left = "0";
  M.style.top = "0";
  m.M = M;
  label(M, "thead", -333, -354, "合成池");
  m.ui.poolCount = box(M, "tcount tl", 200, -347, 480, 14, "");
  m.ui.poolCount.style.textAlign = "right";
  m.ui.poolCount.style.fontFamily = "var(--font-body)";
  m.ui.poolCount.style.fontSize = "13px";
  m.ui.clear = box(M, "tbtn ghost sm", 706, -352, 51, 32, "清空");
  m.ui.clearBtn = { x: 731, y: -336 };
  m.ui.poolWell = box(M, "tpool", POOL.left, POOL.top, POOL.width, POOL.height);
  m.ui.poolEmpty = box(M, "tpool-empty", POOL.left, POOL.top, POOL.width, POOL.height, `<b>把字拖進來</b><span>放進來的字，每一張圖都一定有；其他格子引擎補。</span>`);
  m.ui.note = box(M, "tnote", -333, -128, 760, 24, "");
  m.ui.note.style.opacity = "0";
  // 規則
  label(M, "tlab", -333, -96, "尺度");
  m.ui.heat = HEAT_ZH.map((z, i) => {
    const x = -292 + i * 64.5;
    const el = box(M, "tpill on", x, -107, 57, 36, esc(z));
    return { el, x: x + 28, y: -89 };
  });
  m.ui.heat[0].el.classList.remove("on"); // 預設：誘惑、走光、性愛開著，活動關著
  label(M, "tlab", -26, -96, "時代");
  m.ui.era = box(M, "tselect", 16, -109, 156, 40, `<span>現代</span>`);
  m.ui.eraBtn = { x: 94, y: -89 };
  m.ui.eraMenu = box(M, "tmenu", 16, -68, 156, 6 * 34 + 8, ["現代", "古中國", "古希臘", "中世紀", "江戶", "維多利亞"].map((z) => `<i>${z}</i>`).join(""));
  m.ui.eraMenu.style.display = "none";
  label(M, "tlab", 190, -96, "人物");
  m.ui.who = segmented(M, 232, -109, ["女", "男", "不限"], 46, 40);
  m.ui.who.set(0);
  label(M, "tlab", -333, -56, "▸ 更多規則：每段張數與選格、尺寸、場景、職業");
  m.ui.moreBtn = { x: -240, y: -48 };
  box(M, "tb", -350, -21, 1107, 1).style.background = "var(--color-rule-2)";
  // 抽牌列
  m.ui.stepN = 1;
  m.ui.stepper = box(M, "tstep", -333, -2, 149, 34, `<span>一次</span><i>−</i><b>1</b><i>＋</i>`);
  m.ui.stepVal = m.ui.stepper.querySelector("b");
  m.ui.stepPlus = { x: -333 + 149 - 17, y: 15 };
  m.ui.infinite = box(M, "tswitch", -166, 4, 100, 22, `<i></i>無限抽`);
  m.ui.infiniteBtn = { x: -148, y: 15 };
  m.ui.same = box(M, "tswitch", -56, 4, 110, 22, `<i></i>同一個人`);
  m.ui.sameBtn = { x: -38, y: 15 };
  m.ui.status = box(M, "tl", 60, 5, 280, 20, "");
  m.ui.status.style.font = "500 14px/20px var(--font-body)";
  m.ui.status.style.color = "var(--color-muted)";
  m.ui.stopBtn = box(M, "tbtn", 424, -4, 60, 38, "停");
  m.ui.stopBtn.style.display = "none";
  m.ui.stopPos = { x: 454, y: 15 };
  m.ui.handBtn = box(M, "tbtn", 355, -4, 150, 38, `${ICON.hand}<span>偏好卡牌</span><b>0/10</b>`);
  m.ui.handPos = { x: 430, y: 15 };
  m.ui.pBtn = box(M, "tbtn", 518, -4, 79, 38, "只抽牌");
  m.ui.pPos = { x: 557, y: 15 };
  m.ui.gBtn = box(M, "tbtn pri", 610, -8, 147, 46, `<span>抽並生圖</span><small>×1</small>`);
  m.ui.gPos = { x: 683, y: 15 };
  m.ui.gCount = m.ui.gBtn.querySelector("small");
  // 生圖種子
  label(M, "tlab", -333, 62, "生圖種子");
  m.ui.seedSeg = segmented(M, -265, 51, ["隨機", "固定"], 56, 36);
  m.ui.seedSeg.set(0);
  m.ui.seedFixBtn = { x: -265 + 3 + 56 + 28, y: 69 };
  m.ui.seedInput = box(M, "tinput", -143, 52, 148, 34, `<span>每張隨機</span>`);
  m.ui.seedTx = m.ui.seedInput.querySelector("span");
  m.ui.dice = box(M, "tbtn", 12, 52, 34, 34, ICON.dice);
  // 成品牆
  label(M, "thead", -333, 118, "成品");
  m.ui.wallHint = label(M, "tcount", -30, 126, "每張圖用了哪些牌收在「牌 · N」裡：你放進池子的，和引擎抽到的。");
  m.ui.wallHint.style.fontFamily = "var(--font-body)";
  m.ui.wallHint.style.fontSize = "13px";
  m.ui.expandAll = box(M, "tbtn ghost sm", 622, 116, 66, 32, "全部展開");
  m.ui.collapseAll = box(M, "tbtn ghost sm", 696, 116, 66, 32, "全部收起");
  m.ui.wallEmpty = box(M, "tpool-empty", -333, 170, 1090, 220, `<b>還沒有成品</b><span>放幾個字進合成池，就能抽牌並生圖。</span>`);
  m.ui.wallEmpty.style.border = "1px dashed var(--color-rule-2)";
  m.ui.wallEmpty.style.borderRadius = "14px";

  /* ---------- 廢字簍、提示條、浮動列（不跟頁面捲） ---------- */
  m.ui.trash = box(O, "ttrash", 697, 367, 76, 76, `${ICON.trash}<b>0</b><span>廢字簍</span>`);
  m.ui.trashN = m.ui.trash.querySelector("b");
  m.ui.trashPos = { x: 735, y: 405 };
  m.ui.toast = box(O, "ttoast", -200, 360, 400, 50, "");
  m.ui.toast.style.opacity = "0";
  m.ui.float = box(O, "tfloat", 250, 372, 520, 56, "");
  m.ui.float.style.opacity = "0";

  /* ---------- 游標 ---------- */
  m.cursor = makeCursor(scr);
  m.cursorActs = [];
  return m;
}

/* ================= 字盒的視圖 ================= */

/**
 * 字盒視圖的時間軸。lib.view(id, opts, t0)：從 t0 起字盒換成這一組牌（新的一批依序發出來）。
 * 每個視圖最多畫 20 張（4×5），牌是真的牌。lib.render(t) 在每一格畫出目前的視圖。
 */
export function buildLibrary(m) {
  const { O } = m;
  const geo = m.libGeo || LIBRARY;
  const slotOf = (i) => ({ x: geo.x0 + (i % geo.cols) * geo.dx, y: geo.y0 + Math.floor(i / geo.cols) * geo.dy });
  const lib = { views: [], byId: new Map(), pinAt: (tag, t) => false, marks: [] };
  lib.view = (id, opts, t0, extra = {}) => {
    const list = extra.tags ? extra.tags.map((t) => env.lib.byTag.get(t)).filter(Boolean) : viewList(opts);
    const cards = list.slice(0, 20).map((c, i) => {
      const el = cardEl(c.tag, geo.w, O);
      el.style.zIndex = "1";
      const flag = addFlag(el, "池中", "pool");
      const chip = mk("span", "enter-chip", el.querySelector(".card"), "Enter");
      chip.style.opacity = "0";
      return { tag: c.tag, el, flag, chip, i };
    });
    // 選了花色才有小分類晶片（一排排的，會把底下的牌往下推）。
    let chips = null;
    let gridDy = 0;
    // The scripted tour uses stable engine groups. Subcategories can move cards
    // (for example, cherry blossoms now lives in Plants) without changing the tour.
    const engineOrder = new Map(Object.values(env.data.groupOrder).flat().map((g, i) => [g, i]));
    const groups = opts.suit && opts.suit !== "all" && !extra.noChips ? [...new Map(viewList({ ...opts, group: "", q: "" }).map((c) => [c.item.group, [env.data.groupZh[c.item.group] || c.groupZh, c.seal]])).entries()].sort((a, b) => (engineOrder.get(a[0]) ?? 999) - (engineOrder.get(b[0]) ?? 999)).slice(0, 6) : [];
    if (groups.length >= 2) {
      chips = box(O, "tb", -767, -190, 370, null, "");
      chips.style.display = "flex";
      chips.style.flexWrap = "wrap";
      chips.style.gap = "6px";
      const items = [["", ["全部", ""]], ...groups].map(([g, [zh, seal]]) => {
        const c = mk("span", "tchip flat" + ((opts.group || "") === g ? " on" : ""), chips, (seal ? `<b style="background:var(--color-paper-4);color:var(--color-ink-2)">${esc(seal)}</b>` : "") + esc(zh));
        c.style.position = "relative";
        return { g, el: c };
      });
      gridDy = (chips.offsetHeight || 40) + 8;
      chips.style.visibility = "hidden";
      chips._items = items;
    }
    const v = { id, opts, t0, cards, total: extra.total ?? countOf(opts), t1: Infinity, tab: extra.tab ?? (opts.suit || "all"), chips, gridDy, empty: !!extra.empty };
    const prev = lib.views[lib.views.length - 1];
    if (prev) prev.t1 = t0;
    lib.views.push(v);
    lib.byId.set(id, v);
    return v;
  };
  /** 這個視圖裡某個小分類晶片的中心（離螢幕中心的座標）。 */
  lib.chipPos = (id, g) => {
    const v = lib.byId.get(id);
    const it = v.chips && v.chips._items.find((k) => k.g === g);
    if (!it) throw new Error(`視圖 ${id} 沒有小分類 ${g}`);
    return { x: -767 + it.el.offsetLeft + it.el.offsetWidth / 2, y: -190 + it.el.offsetTop + it.el.offsetHeight / 2 };
  };
  lib.slot = (id, tag) => {
    const v = lib.byId.get(id);
    const c = v && v.cards.find((k) => k.tag === tag);
    if (!c) throw new Error(`字盒視圖 ${id} 裡沒有 ${tag}`);
    const q = slotOf(c.i);
    return { x: q.x, y: q.y + v.gridDy };
  };
  lib.index = (id, tag) => lib.byId.get(id).cards.findIndex((k) => k.tag === tag);
  // 個別牌的狀態視窗：hover（浮起）、drag（原位留虛線空位）、enter（右下角出現 Enter）。
  lib.hover = [];
  lib.drag = [];
  lib.enter = [];
  lib.dim = []; // 灰掉（超出目前規則）
  const inWin = (list, tag, t, view) => list.some((w) => w.tag === tag && (!w.view || w.view === view) && t >= w.t0 && t <= w.t1);
  lib.render = (t) => {
    let cur = -1;
    for (let i = 0; i < lib.views.length; i++) if (t >= lib.views[i].t0) cur = i;
    lib.views.forEach((v, vi) => {
      const on = vi === cur || (vi === cur - 1 && t < lib.views[cur].t0 + 0.28);
      v.cards.forEach((c) => {
        if (!on) {
          if (c.el.style.visibility !== "hidden") c.el.style.visibility = "hidden";
          return;
        }
        const s = slotOf(c.i);
        const born = t - v.t0;
        const deal = vi === cur ? EZ.out(seg(born, 0.03 + c.i * 0.022, 0.03 + c.i * 0.022 + 0.42)) : 1;
        const out = vi === cur ? 1 : 1 - EZ.exit(seg(t, lib.views[cur].t0, lib.views[cur].t0 + 0.2));
        const hot = inWin(lib.hover, c.tag, t, v.id);
        const drag = inWin(lib.drag, c.tag, t, v.id);
        const pinned = lib.pinAt(c.tag, t);
        const dim = inWin(lib.dim, c.tag, t, v.id);
        c.el.classList.toggle("is-dragging", drag);
        c.el.classList.toggle("is-pinned", pinned && !drag);
        c.el.classList.toggle("is-hot", hot);
        stampFlag(c.flag, t, pinned ? lib.pinTime(c.tag, t) : 1e9);
        const enter = inWin(lib.enter, c.tag, t, v.id);
        c.chip.style.opacity = enter ? "1" : "0";
        put(c.el, { x: s.x, y: s.y + v.gridDy + (1 - deal) * 34 - (hot ? 4 : 0), rz: (1 - deal) * (c.i % 2 ? 5 : -5), s: lerp(0.9, 1, deal) * (hot ? 1.04 : 1), o: deal * out * (dim ? 0.3 : 1) });
      });
    });
    // 計數、分頁、小分類：跟著視圖走。
    if (cur >= 0) {
      const v = lib.views[cur];
      setHTML(m.ui.count, `${v.total.toLocaleString("en-US")} / 1,572 張`);
      for (const [id, el] of Object.entries(m.ui.tabs)) el.classList.toggle("on", id === v.tab);
    }
    lib.views.forEach((v, vi) => {
      if (!v.chips) return;
      const on = vi === cur;
      v.chips.style.visibility = on ? "visible" : "hidden";
      if (on) {
        const born = t - v.t0;
        v.chips._items.forEach((it, i) => {
          const p = EZ.out(seg(born, 0.02 + i * 0.03, 0.02 + i * 0.03 + 0.3));
          it.el.style.opacity = p.toFixed(3);
          it.el.style.transform = `translateY(${((1 - p) * 10).toFixed(1)}px)`;
        });
      }
    });
    // 沒有符合的：字盒說一句話。
    const cv = cur >= 0 ? lib.views[cur] : null;
    m.ui.libEmpty.style.opacity = cv && cv.empty ? EZ.out(seg(t, cv.t0 + 0.1, cv.t0 + 0.4)).toFixed(3) : "0";
  };
  return lib;
}

/* ================= 合成池的時間軸 ================= */

/**
 * PoolTL：合成池裡每張牌「什麼時候進來、怎麼進來、什麼時候走、怎麼走」。
 *   enter：{ mode: "fly", tClick, from }           從字盒那張飛過來（tClick 出發、tLand 落定）
 *          { mode: "drag", tGrab, tDrop, tLand, from, cur }   照游標的位置拖著走
 *          { mode: "pop" }                          被帶上來的牌：從底下彈出來
 *          { mode: "none" }                         本來就在（不演）
 *   leave：{ mode: "lift" }｜{ mode: "home", to }    飄走／飛回字盒那一格
 * 位置照置中排版算：每次有牌進出，其他的牌滑到新的位置（進來之前先讓出一格）。
 */
export const TRAY = { cx: 20, y: 372, pitch: 96, w: 104, fan: true };
export function buildPool(m, lib, cfg = { ...POOL, parent: null, main: true }) {
  const parent = cfg.parent || m.M;
  const spans = [];
  const tl = { spans, marks: [], xs: [], clashes: [] };
  const last = (tag) => [...spans].reverse().find((s) => s.tag === tag);
  tl.add = (tag, t, enter = { mode: "pop" }) => {
    const s = { tag, tin: t, tout: Infinity, enter, leave: { mode: "lift" }, order: spans.length };
    s.tAppear = enter.mode === "fly" ? enter.tClick : enter.mode === "drag" ? enter.tGrab : t;
    s.tLand = enter.mode === "fly" ? enter.tLand : enter.mode === "drag" ? enter.tLand : t;
    s.tin = s.tLand;
    spans.push(s);
    return s;
  };
  tl.remove = (tag, t, leave = { mode: "lift" }) => {
    const s = [...spans].reverse().find((k) => k.tag === tag && k.tout === Infinity);
    if (!s) throw new Error(`池裡沒有 ${tag}（${t.toFixed(2)}）`);
    s.tout = t;
    s.leave = leave;
    s.tGone = t + (leave.mode === "home" ? (leave.dur || 0.55) : 0.45);
    return s;
  };
  tl.alive = (t) => spans.filter((s) => t >= s.tin && t < s.tout);
  tl.count = (t) => tl.alive(t).length;
  tl.pinAt = (tag, t) => spans.some((s) => s.tag === tag && t >= s.tin && t < s.tout);
  tl.pinTime = (tag, t) => {
    const s = spans.filter((k) => k.tag === tag && k.tin <= t).pop();
    return s ? s.tin : 1e9;
  };
  lib.pinAt = tl.pinAt;
  lib.pinTime = tl.pinTime;

  /** 排版：在所有進出的時間點算出每張牌的 x，之後照 tag 查。 */
  tl.finalize = () => {
    const evs = [];
    for (const s of spans) {
      evs.push({ t: (s.enter.mode === "fly" || s.enter.mode === "drag" ? s.tLand - 0.34 : s.tin - 0.02), s, add: true });
      if (s.tout !== Infinity) evs.push({ t: s.tout + 0.08, s, add: false });
    }
    evs.sort((a, b) => a.t - b.t);
    const live = [];
    for (const ev of evs) {
      if (ev.add) live.push(ev.s);
      else live.splice(live.indexOf(ev.s), 1);
      const n = live.length;
      live.forEach((s, i) => {
        (s.keys ||= []).push([ev.t, cfg.cx + (i - (n - 1) / 2) * cfg.pitch]);
      });
    }
  };
  const xOf = (s, t) => {
    const ks = s.keys;
    if (!ks || !ks.length) return cfg.cx;
    let i = 0;
    while (i + 1 < ks.length && ks[i + 1][0] <= t) i++;
    const prev = i ? ks[i - 1][1] : ks[0][1];
    return lerp(prev, ks[i][1], EZ.out(seg(t, ks[i][0], ks[i][0] + 0.42)));
  };
  tl.xOf = xOf;
  tl.slotPos = (s, t) => {
    const x = xOf(s, t);
    if (!cfg.fan) return { x, y: cfg.y, rz: 0 };
    const off = (x - cfg.cx) / cfg.pitch;
    return { x, y: cfg.y + off * off * 5, rz: off * 3.2 };
  };

  // 每張牌一個元素（同一個字回來時重用）。
  const els = new Map();
  const elOf = (tag) => {
    if (!els.has(tag)) {
      const el = cardEl(tag, cfg.w, parent);
      el.style.zIndex = cfg.z || "5";
      const x = mk("i", "tx-btn", el, "×");
      x.style.right = "-8px";
      x.style.top = "-8px";
      x.style.opacity = "0";
      els.set(tag, { el, x, carry: addFlag(el, "附帶", "src") });
    }
    return els.get(tag);
  };
  tl.el = (tag) => elOf(tag).el;
  tl.build = () => {
    for (const tag of new Set(spans.map((s) => s.tag))) elOf(tag);
  };

  tl.render = (t) => {
    for (const [tag, o] of els) {
      const ss = spans.filter((s) => s.tag === tag);
      let st = null;
      for (const s of ss) {
        const gone = s.tout === Infinity ? Infinity : s.tGone;
        if (t >= s.tAppear - 0.001 && t < gone) st = s;
      }
      if (!st) {
        if (o.el.style.visibility !== "hidden") o.el.style.visibility = "hidden";
        continue;
      }
      const s = st;
      let x, y, sc = 1, rz = 0, op = 1, z = 5, lifted = false;
      const slot = tl.slotPos(s, t);
      const baseRz = slot.rz || 0;
      if (t < s.tin && (s.enter.mode === "fly" || s.enter.mode === "drag")) {
        // 還沒落定：飛過來、或拖著走。
        const e = s.enter;
        if (e.mode === "fly") {
          const p = EZ.travel(seg(t, e.tClick, e.tLand));
          const a = arc(e.from, slot, p, e.lift ?? 130);
          x = a.x;
          y = a.y;
          sc = lerp(LIBRARY.w / cfg.w, 1, p) * (1 + Math.sin(Math.PI * p) * 0.1);
          rz = -7 * Math.sin(Math.PI * p);
          z = 30;
          lifted = true;
        } else {
          // drag：抓起來（原位 → 游標）、拖著走（跟著游標）、放開（飛到位子）
          const cur = e.cur.at(t);
          const grab = EZ.out(seg(t, e.tGrab, e.tGrab + 0.18));
          const home = e.from;
          const drop = EZ.travel(seg(t, e.tDrop, e.tLand));
          const hold = { x: cur.x + (e.grabOff?.x ?? 0), y: cur.y + (e.grabOff?.y ?? 8) };
          const gx = lerp(home.x, hold.x, grab);
          const gy = lerp(home.y, hold.y, grab);
          x = lerp(gx, slot.x, drop);
          y = lerp(gy, slot.y, drop);
          // 傾斜跟著游標左右甩的速度
          const c0 = e.cur.at(t - 0.05);
          const vx = (cur.x - c0.x) / 0.05;
          rz = Math.max(-14, Math.min(14, -2 + vx * 0.012)) * (1 - drop);
          sc = lerp(LIBRARY.w / cfg.w, 1.12, grab) * lerp(1, 1 / 1.12, drop);
          z = 40;
          lifted = t < e.tDrop + 0.2;
        }
      } else {
        x = slot.x;
        y = slot.y;
        rz = baseRz;
        const e = s.enter;
        if (e.mode === "pop") {
          const p = EZ.out(seg(t, s.tin, s.tin + 0.42));
          y += (1 - p) * 18;
          sc = lerp(0.7, 1, p) + Math.max(0, spring(t - s.tin - 0.3, 0.05, 8, 22));
          op = Math.min(1, p * 3);
        } else {
          sc = 1 + spring(t - s.tin, 0.06, 7, 20);
        }
      }
      // 離開
      if (s.tout !== Infinity && t >= s.tout) {
        const lv = s.leave;
        const p = seg(t, s.tout, s.tGone);
        if (lv.mode === "home") {
          const q = EZ.travel(p);
          const from = { x, y };
          const a = arc(from, lv.to, q, 90);
          x = a.x;
          y = a.y;
          sc = lerp(1, LIBRARY.w / cfg.w, q);
          rz = 6 * Math.sin(Math.PI * q);
          op = 1 - EZ.exit(seg(p, 0.85, 1));
          z = 30;
        } else {
          const q = EZ.in(p);
          y -= 34 * q;
          rz += 12 * q;
          sc *= 1 - 0.12 * q;
          op = 1 - EZ.exit(seg(p, 0.35, 1));
        }
      }
      // 相關的牌亮起來、相剋的牌抖一下描紅
      let related = false;
      let clash = false;
      let shake = 0;
      for (const mk_ of tl.marks) {
        if (mk_.tag !== tag || t < mk_.t0 || t > mk_.t1) continue;
        if (mk_.kind === "related") related = true;
        if (mk_.kind === "clash") {
          clash = true;
          shake = Math.sin((t - mk_.t0) * 60) * 5 * Math.exp(-(t - mk_.t0) * 5);
        }
      }
      o.el.classList.toggle("is-related", related);
      o.el.classList.toggle("is-clash", clash);
      o.el.classList.toggle("is-lifted", lifted);
      const carried = s.enter.mode === "pop" && s.carriedBy;
      stampFlag(o.carry, t, carried ? s.tin + 0.15 : 1e9);
      const xs = tl.xs.find((w) => w.tag === tag && t >= w.t0 && t <= w.t1);
      o.x.style.opacity = xs ? "1" : "0";
      put(o.el, { x: x + shake, y, rz, s: sc, o: op });
      o.el.style.zIndex = String(z);
    }
    // 數字和空狀態（只有合成池自己有）
    if (!cfg.main) return;
    const n = tl.count(t);
    setHTML(m.ui.poolCount, n ? `<b style="color:var(--color-ink);font-weight:500">${n}</b> 張會一定進圖` : "");
    const empty = n === 0 && !spans.some((s) => t >= s.tAppear && t < (s.tout === Infinity ? Infinity : s.tGone));
    m.ui.poolEmpty.style.opacity = empty ? "1" : "0";
    m.ui.clear.style.opacity = n ? "1" : "0.35";
  };
  return tl;
}

/* ================= 搜尋框 ================= */

/** 搜尋框：focus 的時間窗、每個時間點框裡的字（打字、全選、清掉）。 */
export function buildSearch(m) {
  const s = { evs: [{ t: -1e9, text: "", sel: false }], focus: [], shake: [], last: "" };
  const push = (ev) => {
    s.evs.push(ev);
    s.evs.sort((a, b) => a.t - b.t);
    s.last = ev.text;
  };
  s.focusAt = (t0, t1) => s.focus.push([t0, t1]);
  /** 從 t 起一個字一個字打出來（每個字 per 秒）；回傳打完的時間。 */
  s.type = (t, text, per = 0.22) => {
    if (english) {
      const translated = translate(text);
      per *= Math.max(1, text.length - 1) / Math.max(1, translated.length - 1);
      text = translated;
    }
    const chars = [...text];
    chars.forEach((_, i) => push({ t: t + i * per, text: chars.slice(0, i + 1).join(""), sel: false, key: true }));
    return t + (chars.length - 1) * per;
  };
  s.select = (t) => push({ t, text: s.last, sel: true });
  s.clear = (t) => push({ t, text: "", sel: false });
  s.refuse = (t) => s.shake.push(t);
  /** 這一刻打了第幾個字（給鍵盤音效）。 */
  s.keyTimes = () => s.evs.filter((e) => e.key).map((e) => e.t);
  s.render = (t) => {
    let ev = s.evs[0];
    for (const e of s.evs) if (e.t <= t) ev = e;
    const on = s.focus.some(([a, b]) => t >= a && t <= b);
    m.ui.search.classList.toggle("on", on);
    m.ui.searchPh.style.display = ev.text ? "none" : "";
    setHTML(m.ui.searchTx, ev.sel && ev.text ? `<span class="tx sel">${esc(ev.text)}</span>` : esc(ev.text));
    m.ui.searchCaret.style.visibility = on && !(ev.sel && ev.text) && Math.floor(t * 2.4) % 2 === 0 ? "visible" : "hidden";
    let dx = 0;
    for (const a of s.shake) if (t >= a && t < a + 0.4) dx += Math.sin((t - a) * 60) * 7 * Math.exp(-(t - a) * 7);
    m.ui.search.style.transform = dx ? `translateX(${dx.toFixed(1)}px)` : "";
  };
  return s;
}

/* ================= 放大牌（滑鼠停在牌上浮出來的那張） ================= */

export function peekAt(m, tag, x, y, t0, t1, { side = "right" } = {}) {
  const el = mk("div", "w tpeek", m.O);
  el.style.zIndex = "30";
  const face = mk("div", "tpeek-face", el);
  const big = cardEl(tag, 228, face);
  put(big, { x: 114, y: 167 });
  const c = env.lib.byTag.get(tag);
  const facts = cardFacts(c, env.lex, env.data).slice(0, 3);
  mk("p", "tpeek-en", el, esc(tag));
  mk("p", "tpeek-facts", el, facts.map(([k, v]) => `<b>${esc(k)}</b>${esc(v)}`).join("<br>"));
  m.S.act([t0 - 0.05, t1 + 0.4], (t) => {
    const p = EZ.out(seg(t, t0, t0 + 0.28)) * (1 - EZ.exit(seg(t, t1, t1 + 0.22)));
    const dir = side === "right" ? 1 : -1;
    put(el, { x: x + dir * (150 + (1 - p) * -14), y, s: lerp(0.92, 1, p), o: p });
  }, el);
  m.S.cue({ t: t0, kind: "pop", gain: 0.06, f: 520 });
}

/* ================= 提示條（底下那條「撤下了…　復原」） ================= */

/**
 * 提示條：t0 出現、t1 消失，底下一條線倒數；action：按鈕的字（帶 key 就多一個鍵帽小標）。
 * pressAt：游標按下它的時間（按鈕縮一下、提示收起）。
 */
export function toastAt(m, t0, t1, text, { action = null, key = null, pressAt = null } = {}) {
  const el = m.ui.toast;
  const end = pressAt != null ? Math.min(t1, pressAt + 0.25) : t1;
  const html = `<span>${esc(text)}</span>${action ? `<b>${esc(action)}${key ? `<kbd>${esc(key)}</kbd>` : ""}</b>` : ""}<i class="clock"></i>`;
  m.S.act([t0 - 0.05, end + 0.4], (t) => {
    const p = EZ.out(seg(t, t0, t0 + 0.3)) * (1 - EZ.exit(seg(t, end, end + 0.3)));
    if (el._h !== html) {
      el.innerHTML = html;
      el._h = html;
    }
    el.style.opacity = p.toFixed(3);
    el.style.transform = `translateY(${((1 - p) * 16).toFixed(1)}px)`;
    const clock = el.querySelector(".clock");
    if (clock) clock.style.transform = `scaleX(${(1 - seg(t, t0, t1)).toFixed(3)})`;
    const btn = el.querySelector("b");
    if (btn && pressAt != null) btn.style.transform = `scale(${t > pressAt && t < pressAt + 0.1 ? 0.88 : 1})`;
  });
  m.S.cue({ t: t0, kind: "toast", gain: 0.06 });
}

/** 量一行說明裡「換回」按鈕的位置（離螢幕中心）。 */
export function noteBtnPos(m, html) {
  const t = box(m.M, "tb tnote", -333, -128, 760, 24, html);
  t.style.visibility = "hidden";
  const bt = t.querySelector("b");
  const p = bt ? { x: -333 + bt.offsetLeft + bt.offsetWidth / 2, y: -128 + bt.offsetTop + bt.offsetHeight / 2 } : { x: 0, y: 0 };
  t.remove();
  return p;
}

/** 指出「這裡」的小標籤（橘底白字，尖角指著下面的東西）。 */
export function tipAt(m, text, en, x, y, t0, t1, { parent = m.M, up = false } = {}) {
  const el = mk("div", "w ttip" + (up ? " up" : ""), parent, esc(text) + (en ? `<small>${esc(en)}</small>` : ""));
  el.style.zIndex = "35";
  m.S.act([t0 - 0.1, t1 + 0.4], (t) => {
    const p = EZ.out(seg(t, t0, t0 + 0.4));
    const q = EZ.exit(seg(t, t1, t1 + 0.3));
    put(el, { x, y: y + (1 - p) * (up ? 12 : -12), s: lerp(0.85, 1, p) + spring(t - t0 - 0.4, 0.03, 7, 22), o: p * (1 - q) });
  }, el);
  m.S.cue({ t: t0, kind: "pop", gain: 0.1, f: 520 });
}

/** 池子底下那一行說明（同一格只留一張／相剋…）：某段時間出現，可以帶一顆「換回」。 */
export function noteAt(m, t0, t1, html, { kind = "swap", back = false, pressAt = null } = {}) {
  const n = m.ui.note;
  m.S.act([t0 - 0.05, t1 + 0.4], (t) => {
    const p = EZ.out(seg(t, t0, t0 + 0.32)) * (1 - EZ.exit(seg(t, t1, t1 + 0.3)));
    setHTML(n, html);
    n.className = "tb tnote" + (kind === "clash" ? " clash" : "");
    n.style.opacity = p.toFixed(3);
    n.style.transform = `translateY(${((1 - p) * 8).toFixed(1)}px)`;
    const btn = n.querySelector("b");
    if (btn && pressAt != null) btn.style.transform = `scale(${(t > pressAt && t < pressAt + 0.1 ? 0.9 : 1).toFixed(2)})`;
  });
}

export function ratioOf(x, y) {
  return { x, y };
}

export { CARD_SUIT_INFO, suitOf, zhOf, V, SW, SH, lerp, quad, spring, seg, EZ, put, esc, mk, setHTML, arc };
