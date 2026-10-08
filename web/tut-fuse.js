/**
 * 疊印台的教學：一張牌一層墨（六層疊起來的 3D 開場）→ 放牌 → 影子與關係 → 四張試印 → 付印與晾紙 → 撤回、清版、起手式。
 * 畫面是 1600×880 的一台螢幕（跟真的疊印台 1:1）。所有結果都是真引擎算的：
 *   放一張牌會帶上誰、擠掉誰（fuse-bed 的 placeCard）、相剋（relationsOf）、
 *   影子＝引擎用四個種子照現在的版抽出來補的牌（idata.drawAt）。
 */
import { EZ, seg, lerp, spring, mk, put, setHTML, esc, V, env, makeScene, makeScreen, box, label, makeCursor, cardEl, addFlag, stampFlag, suitOf, zhOf, hasCard, arc, K, pressScale } from "./tut-kit.js";
import { calmTrack } from "./tut-kit.js";
import { contradictions, ACT_PLACE, applyPin } from "./engine.js";
import { REGISTERS, REGISTER_ROLE, emptyBed, placeCard, removeCard, relationsOf } from "./fuse-bed.js";
import { CARD_SUIT_INFO } from "./cards.js";
import { CH } from "./tut-chapters.js";
import { b, B, buildLibrary, segmented, ICON, tipAt, toastAt } from "./tut-mochi.js";
import { focus, zoomZ, makePen, SUIT_COLOR } from "./tut-mochi-a.js";

/* ================= 版面（離螢幕中心，跟真的疊印台 1:1；真的 y 減 440） ================= */
const ROWTOP = -232;
const ROWH = 100;
const rowIndex = (suit) => REGISTERS.indexOf(suit);
const rowY = (suit) => ROWTOP + rowIndex(suit) * ROWH + ROWH / 2;
const X0 = -346; // 版上第一張牌的左緣
const PW = 66; // 你的牌寬
const PITCH = 72;
const GW = 54; // 影子寬
const GP = 58;
const GCAP = 6; // 每列最多畫幾張影子，多的收成 +N
const RX = 448; // 右欄左緣
const RCX = 624;
const SEEDS = [
  [40, 57, 19, 28],
  [61, 88, 33, 14],
];
const LETTERS = ["A", "B", "C", "D"];
const TILE = [
  { x: 466, y: -15 },
  { x: 623, y: -15 },
  { x: 466, y: 58 },
  { x: 623, y: 58 },
];
const PRINT_BTN = { x: RCX, y: 243 };
const ROPE_Y = -364;
const ropeX = (i) => -690 + i * 60;

export function buildFuseScene(ctx) {
  const { world, hud, text, step, keycaps, SCENES, shared } = ctx;
  const S = makeScene("fuse", { world, hud, tint: [0.62, 0.11, 25] });
  SCENES.fuse = S;
  const { ENG, idata } = shared;
  const T0 = b(66);
  const scr = makeScreen(S, { x: 0, y: 0 });
  const { O, fx, frame } = scr;
  const cur = makeCursor(scr);

  /* ---------- 靜態畫面 ---------- */
  box(O, "tmast", -800, -440, 1600, 56);
  label(O, "twm", -782, -426, "墨池");
  const nav = box(O, "tnav", -717, -430, 156, 38, `<i>墨池</i><i class="on">疊印台</i>`);
  label(O, "tmore", -548, -424, "介紹影片");
  const rating = segmented(O, 45, -432, ["全年齡", "敏感", "色情"], 60, 44);
  rating.set(0);
  box(O, "tbtn", 239, -432, 119, 44, `${ICON.lora}<span>選 LoRA</span>`);
  box(O, "tbtn", 367, -432, 180, 44, `${ICON.model}<span>waiIllustriousS…</span>`);
  box(O, "tbtn", 555, -430, 40, 40, ICON.flow);
  box(O, "tbtn", 603, -430, 40, 40, ICON.sound);
  label(O, "tping", 660, -419, `<i></i>Comfy 已連`);
  void nav;

  label(O, "thead", -783, -372, "晾紙");
  const rope = box(O, "tb", -712, ROPE_Y, 1495, 1, "");
  rope.style.background = "var(--color-rule)";
  box(O, "tb", -800, -290, 1600, 1, "").style.background = "var(--color-rule-2)";
  box(O, "tb", -448, -289, 1, 730, "").style.background = "var(--color-rule-2)";
  box(O, "tb", RX, -289, 1, 730, "").style.background = "var(--color-rule-2)";

  // 字盒（左欄）
  label(O, "thead", -783, -282, "字盒");
  const libCount = box(O, "tcount tl", -640, -274, 192, 14, "");
  libCount.style.textAlign = "right";
  box(O, "tsearch", -783, -243, 322, 40, `<span class="ph">找牌：紅髮、kimono…（按 /）</span>`);
  box(O, "tchip flat", -783, -193, 52, 30, "全部");
  box(O, "tchip flat on", -725, -193, 60, 30, "相配").style.setProperty("--suit", "var(--color-accent)");
  ["cast", "look", "wear", "pose", "scene", "style"].forEach((suit, i) => {
    const c = box(O, "tchip flat", -659 + i * 36, -193, 30, 30, `<b>${esc(CARD_SUIT_INFO[suit].glyph)}</b>`);
    c.style.setProperty("--suit", `var(--suit-${suit})`);
  });

  // 卡池（中欄）：標題、按鈕、六列
  label(O, "thead", -423, -270, "卡池");
  const sub = label(O, "tcount", -364, -262, "");
  sub.style.fontFamily = "var(--font-body)";
  sub.style.fontSize = "13px";
  box(O, "tbtn ghost sm", 168, -277, 140, 34, `${ICON.hand}<span>偏好卡牌</span><b>0/10</b>`);
  const undoBtn = box(O, "tbtn ghost sm", 316, -277, 52, 34, "撤回");
  const clearBtn = box(O, "tbtn ghost sm", 376, -277, 52, 34, "清版");
  const rows = REGISTERS.map((suit, i) => {
    const y = ROWTOP + i * ROWH;
    const el = box(O, "treg", -447, y, 895, ROWH, "");
    el.style.setProperty("--suit", `var(--suit-${suit})`);
    const rk = mk("div", "tb rk tl", el, esc(CARD_SUIT_INFO[suit].glyph));
    Object.assign(rk.style, { left: "22px", top: "26px" });
    const rn = mk("div", "tb rn tl", el, `${esc(REGISTER_ROLE[suit])}<small></small>`);
    Object.assign(rn.style, { left: "72px", top: "34px" });
    const div = mk("i", "tb", el);
    Object.assign(div.style, { top: "10px", width: "0", height: "80px", borderLeft: "1px dashed var(--color-rule)", opacity: "0" });
    const more = mk("div", "tb tchip flat", el, "");
    Object.assign(more.style, { top: "36px", height: "28px", padding: "0 10px", opacity: "0", fontSize: "13px" });
    return { suit, y, el, rn, rk, div, more, glow: [] };
  });
  const emptyHint = box(O, "tb", -300, -80, 600, 260, `<b>版還是空的</b><span>從字盒挑牌，或用下面的起手式；留白的層由引擎補上。</span>`);
  Object.assign(emptyHint.style, { display: "grid", placeItems: "center", alignContent: "center", gap: "8px", textAlign: "center", opacity: "0" });
  emptyHint.querySelector("b").style.cssText = "font:800 26px/1 var(--font-display);color:var(--color-ink-2)";
  emptyHint.querySelector("span").style.cssText = "font:500 15px/1.4 var(--font-body);color:var(--color-muted)";
  const STARTERS = [
    { name: "海邊黃昏", tags: ["sundress", "beach", "sunset"] },
    { name: "雨夜街角", tags: ["umbrella", "rain", "night", "street"] },
    { name: "咖啡店", tags: ["apron", "cafe", "smile"] },
  ].map((s) => ({ ...s, tags: s.tags.filter(hasCard) }));
  const starterEls = STARTERS.map((s, i) => {
    const e = box(O, "toc", -260 + i * 178, 120, 170, 56, `<b style="--suit:var(--color-accent)">★</b><span style="font-size:20px">${esc(s.name)}</span>`);
    e.style.opacity = "0";
    e.style.font = "800 20px/1 var(--font-display)";
    return { ...s, el: e, x: -260 + i * 178 + 85, y: 148 };
  });
  const relLabel = label(O, "tl", -300, -84, "");
  void relLabel;

  // 右欄：預覽、四張試印、付印
  const pvFrame = box(O, "tb", RX + 16, -288, 320, 196, "");
  for (const [cx, cy, bt, bl, br, bb] of [[0, 0, "2px", "2px", "0", "0"], [1, 0, "2px", "0", "2px", "0"], [0, 1, "0", "2px", "0", "2px"], [1, 1, "0", "0", "2px", "2px"]]) {
    const c = mk("i", "tcrop", pvFrame);
    Object.assign(c.style, { left: cx ? "302px" : "0", top: cy ? "178px" : "0", borderTopWidth: bt, borderLeftWidth: bl, borderRightWidth: br, borderBottomWidth: bb });
  }
  const pvMsg = box(O, "tb", RX + 16, -228, 320, 90, `<b>選試印後付印</b><span>從下方選一張試印，再付印成圖。</span>`);
  Object.assign(pvMsg.style, { display: "grid", placeItems: "center", alignContent: "center", gap: "8px", textAlign: "center" });
  pvMsg.querySelector("b").style.cssText = "font:800 18px/1 var(--font-display);color:var(--color-ink-2)";
  pvMsg.querySelector("span").style.cssText = "font:500 13px/1.3 var(--font-body);color:var(--color-muted)";
  const pvCap = label(O, "tl", RX + 130, -122, `<b style="font:800 15px/1 var(--font-display)">預覽</b> <span style="font:500 13px/1 var(--font-body);color:var(--color-muted);margin-left:8px">還沒付印</span>`);
  // 預覽區裡的紙（付印時出現）
  const paper = mk("div", "tb tpaper", O);
  Object.assign(paper.style, { left: "0", top: "0", width: "148px", height: "204px", opacity: "0", zIndex: "6" });
  const ph = mk("div", "ph", paper);
  Object.assign(ph.style, { left: "8px", top: "8px", width: "132px", height: "188px" });
  const phImg = mk("img", "", ph);
  phImg.alt = "";
  const prog = mk("div", "tprog", ph, "<i></i>");
  const roller = mk("i", "tb", paper);
  Object.assign(roller.style, { left: "0", top: "0", width: "148px", height: "36px", background: "linear-gradient(transparent, rgb(0 0 0 / 0.55), transparent)", opacity: "0" });

  label(O, "thead", RX + 18, -70 + 4, "試印").style.fontSize = "17px";
  const tiles = LETTERS.map((L, i) => {
    const el = box(O, "ttrial", TILE[i].x - 8, TILE[i].y - 6, 154, 68, "");
    return { el, L };
  });
  label(O, "tl", RX + 60, -66, `<span style="font:500 12px/1 var(--font-body);color:var(--color-muted)">同一批種子，每疊一張牌就重跑</span>`);
  const reroll = box(O, "tbtn ghost sm", 700, -80, 84, 32, "換一批");
  const detail = box(O, "tb", RX + 18, 134, 316, 96, "");
  const printBtn = box(O, "tbtn pri", RX + 18, 220, 307, 46, "付 印");
  printBtn.style.fontSize = "18px";
  label(O, "tl", RX + 18, 291, `<span style="font:600 14px/1 var(--font-body);color:var(--color-ink-2)">＋ 更多設定與操作</span>`);
  label(O, "tl", RX + 18, 328, `<span style="font:500 12px/1 var(--font-mono);color:var(--color-muted)">/ 找牌　Z 撤回　1–4 試印　R 換一批　P 付印</span>`);
  const note = box(O, "tnote", -330, -258, 500, 26, "");
  note.style.opacity = "0";

  // 晾紙繩上的一張張作品
  const hangs = [];

  /* ---------- 字盒 ---------- */
  const pick = ["1girl", "long hair", "red hair", "sundress", "smile", "standing", "beach", "sunset", "school uniform", "indoors", "night", "kimono"].filter((t) => hasCard(t) && env.assets.art(t));
  const fill = env.lib.cards.filter((c) => env.assets.art(c.tag) && !c.eras.includes("edo") && !pick.includes(c.tag) && c.gate !== "male").slice(0, 24).map((c) => c.tag);
  const libTags = [...pick.filter((t) => t !== "kimono"), ...fill];
  const m = { O, S, ui: { count: libCount, tabs: {}, libEmpty: box(O, "tb", -783, -100, 300, 40, "") }, libGeo: { x0: -732, y0: -83, dx: 103, dy: 150, cols: 3, w: 98 } };
  m.ui.libEmpty.style.opacity = "0";
  const lib = buildLibrary(m);
  lib.view("fits", { suit: "all" }, 0, { tags: libTags, total: 1572, tab: "all", noChips: true });
  for (const t of pick) if (!lib.byId.get("fits").cards.some((c) => c.tag === t) && t !== "kimono") throw new Error(`疊印台的字盒缺 ${t}`);

  /* ---------- 版的資料：一張張牌的進出（用真的 placeCard / removeCard） ---------- */
  let bed = emptyBed();
  const spans = [];
  const pinsEv = [{ t: -1e9, pins: [], carried: {} }];
  const srcEv = [[-1e9, 0]]; // 影子看哪一張試印（選中的、或滑鼠停著預覽的）
  const selEv = [[-1e9, 0]];
  const seedEv = [[-1e9, 0]];
  const glowOf = (suit, t0, t1) => rows[rowIndex(suit)].glow.push([t0, t1]);
  const last = (a, t) => {
    let v = a[0];
    for (const e of a) if (e[0] <= t + 1e-6 && e[0] >= v[0]) v = e;
    return v[1];
  };
  const pinsAt = (t) => {
    let e = pinsEv[0];
    for (const x of pinsEv) if (x.t <= t + 1e-6 && x.t >= e.t) e = x;
    return e;
  };
  const marks = [];
  const xs = [];
  const starterShow = [];
  const noteWins = [];
  const marksFor = (tag, t0, t1) => marks.push({ tag, kind: "related", t0, t1 });

  const addSpan = (tag, tin, enter, o = {}) => {
    const s = { tag, row: suitOf(tag), tin, tout: Infinity, enter, leave: { mode: "lift" }, order: spans.length, ...o };
    s.tAppear = enter.mode === "fly" ? enter.tClick : tin;
    spans.push(s);
    return s;
  };
  const endSpan = (tag, t, leave = { mode: "lift" }) => {
    const s = [...spans].reverse().find((k) => k.tag === tag && k.tout === Infinity);
    if (!s) throw new Error(`版上沒有 ${tag}（${t.toFixed(2)}）`);
    s.tout = t;
    s.leave = leave;
    s.tGone = t + (leave.mode === "home" ? leave.dur || 0.6 : leave.mode === "sweep" ? 0.7 : 0.45);
    return s;
  };
  const homeOf = (tag) => {
    const v = lib.byId.get("fits");
    return v.cards.some((c) => c.tag === tag) ? { mode: "home", to: lib.slot("fits", tag), dur: 0.62 } : { mode: "lift" };
  };
  /** 放一張牌：真的 placeCard 算出誰被帶上來、誰被擠掉；tLand＝落在版上的時間。 */
  function place(tag, tClick, tLand, from, o = {}) {
    const r = placeCard(bed, tag, { lex: env.lex, applyPin });
    bed = r.bed;
    const main = addSpan(tag, tLand, { mode: "fly", tClick, tLand, from, lift: o.lift ?? 120 });
    const out = { main, carried: [], replaced: [], events: r.events };
    for (const ev of r.events) {
      if (ev.kind === "replace") {
        endSpan(ev.out, tLand + 0.03, homeOf(ev.out));
        out.replaced.push(ev.out);
        S.cue({ t: tLand + 0.03, kind: "unwind", gain: 0.07, dur: 0.45 });
      }
    }
    let n = 0;
    for (const ev of r.events) {
      if (ev.kind === "carry") {
        const sp = addSpan(ev.tag, tLand + 0.42 + n * 0.16, { mode: "pop" }, { carriedBy: ev.from });
        out.carried.push(sp);
        S.cue({ t: sp.tin, kind: "pop", gain: 0.1, f: 420 + n * 90 });
        n++;
      }
    }
    pinsEv.push({ t: tLand, pins: bed.pins.slice(), carried: { ...bed.carried } });
    glowOf(suitOf(tag), tLand - 0.2, tLand + 0.9);
    S.cue({ t: tLand, kind: "stamp", gain: 0.26 });
    return out;
  }
  function remove(tag, t, leave) {
    const r = removeCard(bed, tag);
    bed = r.bed;
    for (const x of r.events[0]?.tags || [tag]) endSpan(x, t, x === tag ? leave || homeOf(x) : { mode: "lift" });
    pinsEv.push({ t: t + 0.05, pins: bed.pins.slice(), carried: { ...bed.carried } });
    return r;
  }

  /* ---------- 排位（連續的：進來之前先讓出一格，走掉之後才收攏） ---------- */
  const pres = (s, t) => EZ.out(seg(t, s.tin - 0.34, s.tin + 0.06)) * (1 - (s.tout === Infinity ? 0 : EZ.inOut(seg(t, s.tout, s.tout + 0.42))));
  const userCount = (row, t, before = null) => {
    let n = 0;
    for (const o of spans) {
      if (o.row !== row) continue;
      if (before && o.order >= before.order) continue;
      n += pres(o, t);
    }
    return n;
  };
  const userPos = (s, t) => ({ x: X0 + userCount(s.row, t, s) * PITCH + PW / 2, y: rowY(s.row) });
  const spanOf = (tag, t) => [...spans].reverse().find((k) => k.tag === tag && k.tin <= t + 1e-6 && (k.tout === Infinity || t < k.tout));
  const ghostPos = (row, i, t) => {
    const n = userCount(row, t);
    return { x: X0 + n * PITCH + (n > 0.05 ? 24 : 4) + i * GP + GW / 2, y: rowY(row) };
  };

  /* ---------- 影子：引擎照現在的版、四個種子抽出來補的牌（真的引擎） ---------- */
  const settings = env.settings;
  const trialCache = new Map();
  const trialsFor = (pins, set) => {
    const key = pins.join("|") + "#" + set;
    if (!trialCache.has(key)) {
      const list = SEEDS[set].map((seed) => {
        const d = idata.drawAt(ENG, env.lex, settings, pins, seed);
        const extra = d.tags.filter((t) => !pins.includes(t) && hasCard(t) && env.assets.art(t));
        const got = (t) => d.tags.includes(t);
        return { seed, tags: d.tags, extra, got };
      });
      trialCache.set(key, list);
    }
    return trialCache.get(key);
  };
  /** t 這一刻影子長怎樣：每列的影子（最多 GCAP 張＋還有幾張）。 */
  const ghostState = (t) => {
    const pins = pinsAt(t).pins;
    const set = last(seedEv, t);
    const src = last(srcEv, t);
    if (!pins.length) return { pins, set, src, byRow: new Map(), trials: null };
    const trials = trialsFor(pins, set);
    const byRow = new Map();
    for (const tag of trials[src].extra) {
      const r = suitOf(tag);
      if (!byRow.has(r)) byRow.set(r, []);
      byRow.get(r).push(tag);
    }
    return { pins, set, src, byRow, trials };
  };
  const changeTimes = () => [...pinsEv.map((e) => e.t), ...srcEv.map((e) => e[0]), ...seedEv.map((e) => e[0])].filter((x) => x > -1e8).sort((x, y) => x - y);
  const lastChange = (t) => {
    let c = -1e9;
    for (const x of changeTimes()) if (x <= t + 1e-6) c = x;
    return c;
  };

  // 事先把所有會用到的影子牌做好（播放時不再建 DOM）：在最後才做（build）。
  const ghostEls = new Map();
  const ghostEl = (tag) => {
    if (!ghostEls.has(tag)) {
      const el = cardEl(tag, GW, O, { ghost: true });
      el.style.zIndex = "3";
      ghostEls.set(tag, el);
    }
    return ghostEls.get(tag);
  };
  const buildGhosts = () => {
    for (const t of changeTimes()) {
      const st = ghostState(t + 0.01);
      for (const list of st.byRow.values()) list.slice(0, GCAP).forEach(ghostEl);
    }
  };

  /* ---------- 版上的牌（實牌）的元素 ---------- */
  const els = new Map();
  const elOf = (tag) => {
    if (!els.has(tag)) {
      const el = cardEl(tag, PW, O);
      el.style.zIndex = "5";
      const x = mk("i", "tx-btn", el, "×");
      x.style.right = "-8px";
      x.style.top = "-8px";
      x.style.opacity = "0";
      const dots = mk("div", "tink", el.querySelector(".card"), "<i></i><i></i><i></i><i></i>");
      Object.assign(dots.style, { position: "absolute", left: "50%", bottom: "-6px", transform: "translateX(-50%)", zIndex: "4" });
      dots.style.setProperty("--suit", `var(--suit-${suitOf(tag)})`);
      els.set(tag, { el, x, dots, carry: addFlag(el, "附帶", "src") });
    }
    return els.get(tag);
  };

  /* ---------- 關係線與提示 ---------- */
  const REL_COLOR = { carry: "oklch(70% 0.14 305)", clash: "oklch(64% 0.2 25)", echo: "oklch(74% 0.14 155)" };
  function showRel(kind, a, b_, t0, t1, labelText) {
    fx.link({
      a: (t) => userPos(spanOf(a, t) || spanOf(a, t0 + 1), t),
      b: (t) => userPos(spanOf(b_, t) || spanOf(b_, t0 + 1), t),
      t0,
      t1,
      color: REL_COLOR[kind],
      w: kind === "clash" ? 4 : 3,
      bow: kind === "carry" ? -0.35 : 0.3,
      dash: kind === "clash" ? [10, 6] : [4, 8],
    });
    const A = userPos(spanOf(a, t0 + 1), t0 + 1);
    const Bp = userPos(spanOf(b_, t0 + 1), t0 + 1);
    if (labelText) tipAt({ S, M: O }, labelText, "", (A.x + Bp.x) / 2, Math.min(A.y, Bp.y) - 64, t0 + 0.2, t1, { parent: O });
  }

  /* ---------- 游標＆常用動作 ---------- */
  const pen = makePen(cur, { x: 300, y: 380 }, T0);
  const clickAt = (t, P, o = {}) => {
    pen.moveTo(t, P, { dur: o.dur ?? 0.6, bow: o.bow });
    cur.click(t);
    S.cue({ t, kind: "click", gain: 0.15 });
  };
  const hoverWin = [];
  /** 字盒點一張牌，牌飛上版。 */
  function libClick(tag, tClick, o = {}) {
    const from = lib.slot("fits", tag);
    pen.moveTo(tClick, from, { dur: 0.6 });
    cur.click(tClick);
    S.cue({ t: tClick, kind: "click", gain: 0.15 });
    lib.hover.push({ tag, view: "fits", t0: tClick - 0.3, t1: tClick + 0.08 });
    const r = place(tag, tClick, tClick + B * 1.05, from, o);
    const c = SUIT_COLOR[suitOf(tag)];
    fx.trail({ path: (t) => arc(from, userPos(r.main, t), EZ.travel(seg(t, tClick, r.main.tin)), o.lift ?? 120), t0: tClick, t1: r.main.tin, color: c, size: 11 });
    postList.push(() => {
      const p = userPos(r.main, r.main.tin);
      fx.ring({ x: p.x, y: p.y, t0: r.main.tin, color: c, r0: 36, r1: 110, w: 5 });
      fx.sparks({ x: p.x, y: p.y, t0: r.main.tin, n: 9, r: 60, color: c, seed: tClick * 3 });
    });
    return r;
  }
  const postList = [];
  lib.pinAt = (tag, t) => spans.some((s) => s.tag === tag && t >= s.tin && t < s.tout);
  lib.pinTime = (tag, t) => (spans.filter((s) => s.tag === tag && s.tin <= t).pop() || { tin: 1e9 }).tin;

  /* ---------- 印製 ---------- */
  const printJobs = [];
  const printSel = []; // 每次付印選的哪一張
  const IMG = [shared.art.fuseA, shared.art.fuseB, shared.art.fuseC, ""];

  /* =====================================================================
   * 08 一張牌，一層墨（bar 66–72）：六層疊起來的 3D 開場 → 疊成螢幕
   * ===================================================================== */
  {
    const c = CH.layers;
    text.chapter("08", c.zh, c.en, b(66, 2), b(68, 0));
    const stack = mk("div", "w", S.root);
    const sheets = REGISTERS.map((suit, i) => {
      const tag = { cast: "1girl", look: "red hair", wear: "sundress", pose: "standing", scene: "beach", style: (env.lib.cards.find((k) => k.suit === "style" && env.assets.art(k.tag)) || {}).tag }[suit];
      const el = mk("div", "w", stack);
      const card = mk("div", "tb tsheet", el);
      Object.assign(card.style, { left: "-230px", top: "-150px", width: "460px", height: "300px", background: `linear-gradient(135deg, color-mix(in oklch, var(--suit-${suit}) 26%, oklch(15% 0.014 250 / 0.94)), oklch(14% 0.012 250 / 0.94))`, border: `2px solid var(--suit-${suit})`, overflow: "hidden" });
      mk("b", "tb tl", card, esc(CARD_SUIT_INFO[suit].glyph)).style.cssText = `left:26px;top:20px;font:900 150px/1 var(--font-display);color:var(--suit-${suit});opacity:.92`;
      mk("div", "tb tl", card, `${esc(REGISTER_ROLE[suit])}<small style="display:block;margin-top:8px;font:500 15px/1 var(--font-mono);color:var(--color-muted)">LAYER ${i + 1} / 6</small>`).style.cssText = "left:30px;top:196px;font:800 40px/1 var(--font-display);color:var(--color-ink)";
      const cw = cardEl(tag, 150, card);
      cw.style.zIndex = "2";
      put(cw, { x: 338, y: 150 });
      return { suit, el, tag, i };
    });
    S.act([T0 - 0.1, b(70, 3)], (t) => {
      // 一層層飛進來（從後面），散開在 z 上；然後合起來。
      const explode = EZ.inOut(seg(t, b(66, 0.5), b(66, 3.6))) * (1 - EZ.inOut(seg(t, b(69, 0), b(69, 3))));
      const dissolve = EZ.exit(seg(t, b(70, 0), b(70, 2.6)));
      sheets.forEach((s, i) => {
        const p = EZ.out(seg(t, T0 + 0.1 + i * 0.16, T0 + 0.9 + i * 0.16));
        const zc = (2.5 - i) * 240;
        const z = lerp(-1300, lerp(i * -8 + 20, zc, explode), p);
        const y = (i - 2.5) * 6 * explode + (1 - p) * -120;
        put(s.el, { x: (i - 2.5) * -100 * explode, y: y + (i - 2.5) * -26 * explode, z, rz: (1 - p) * (i % 2 ? 8 : -8), s: 1, o: p * (1 - dissolve) });
      });
      const rot = lerp(-34, -6, EZ.inOut(seg(t, b(66, 0), b(69, 0)))) * (1 - EZ.inOut(seg(t, b(69, 0), b(70, 0)))) + EZ.inOut(seg(t, b(66, 0), b(69, 0))) * 0;
      const tilt = lerp(14, 3, EZ.inOut(seg(t, b(66, 0), b(69, 0)))) * (1 - EZ.inOut(seg(t, b(69, 0), b(70, 0))));
      put(stack, { ry: rot, rx: tilt, z: 0, s: 1 });
    }, stack);
    // 一層一層點名：亮一下，同時出一個音
    sheets.forEach((s, i) => {
      const t0 = b(67, 0) + i * 0.62;
      S.act([t0 - 0.1, t0 + 0.8], (t) => {
        const p = EZ.out(seg(t, t0, t0 + 0.25)) * (1 - EZ.exit(seg(t, t0 + 0.4, t0 + 0.8)));
        s.el.style.filter = p > 0.02 ? `brightness(${(1 + p * 0.55).toFixed(3)})` : "";
      });
      S.cue({ t: t0, kind: "pop", gain: 0.11, f: 330 * Math.pow(2, i / 6) });
    });
    S.cue({ t: T0 - 0.1, kind: "whoosh", gain: 0.16, dur: 1.4 }, { t: b(69, 0), kind: "swell", gain: 0.09, dur: 2.2 }, { t: b(70, 0), kind: "stamp", gain: 0.32 }, { t: b(70, 0.2), kind: "sparkle", gain: 0.1 });
    text.say("一張牌，是*一層墨*", "One card is one layer of ink", b(67, 0), b(68, 3));
    text.say("六層疊起來，就是*一張圖的配方*", "Six layers stacked — one image's recipe", b(68, 3), b(70, 0));
    ctx.cut(b(70, 0), "flash");
    ctx.cut(T0, "ink", "50% 50%");
  }

  /* 螢幕從疊起來的墨裡浮現 */
  S.act([0, b(72, 0)], (t) => {
    const p = EZ.out(seg(t, b(70, 0), b(70, 3)));
    frame.style.opacity = Math.min(1, p * 1.8).toFixed(3);
    frame.style.transform = `scale(${lerp(0.7, 1, p).toFixed(4)})`;
  });
  // 三塊的名字
  {
    const tag = (n, zh, en, x, y, t0, t1) => {
      const el = mk("div", "w ttag", S.root, `<i>${n}</i><span>${zh}<small>${en}</small></span>`);
      S.act([t0 - 0.1, t1 + 0.5], (t) => {
        const p = EZ.out(seg(t, t0, t0 + 0.5));
        const q = EZ.exit(seg(t, t1, t1 + 0.35));
        put(el, { x, y: y + (1 - p) * 34, z: 70, s: lerp(0.7, 1, p) + spring(t - t0 - 0.5, 0.04, 7, 22), o: p * (1 - q) });
      }, el);
      S.cue({ t: t0, kind: "pop", gain: 0.14, f: 380 + n * 60 });
    };
    tag(1, "字盒", "挑牌", -600, 20, b(70, 3), b(71, 1.5));
    tag(2, "卡池", "六列＝六層墨", -20, -280, b(71, 1), b(72, 0));
    tag(3, "試印", "四張，選一張付印", 640, 100, b(71, 2.5), b(72, 1.5));
    fx.frameGlow({ x: -623, y: 80, w: 350, h: 720, t0: b(70, 3), t1: b(71, 1.5), r: 14 });
    fx.frameGlow({ x: 0, y: 68, w: 890, h: 600, t0: b(71, 1), t1: b(72, 0), r: 14 });
    fx.frameGlow({ x: 624, y: 60, w: 340, h: 760, t0: b(71, 2.5), t1: b(72, 1.5), r: 14 });
  }

  /* =====================================================================
   * 09 放牌（bar 72–80）
   * ===================================================================== */
  cur.show(b(71, 3), b(112, 3));
  {
    const c = CH.fplace;
    text.chapter("09", c.zh, c.en, b(72, 0), b(73, 1));
    const seq = [
      ["1girl", b(72, 1.5), 0],
      ["red hair", b(73, 2.5), 0],
      ["long hair", b(74, 2), 0],
      ["sundress", b(75, 0.5), 1],
      ["standing", b(76, 0.5), 0],
      ["beach", b(77, 0), 1],
      ["sunset", b(78, 0), 0],
    ];
    const outs = {};
    for (const [tag, t] of seq) {
      const r = libClick(tag, t);
      outs[tag] = r;
      if (tag === "sundress" && r.carried[0]?.tag !== "dress") throw new Error("太陽裙應該帶洋裝");
      if (tag === "beach" && !r.carried.length) throw new Error("beach 應該帶 outdoors");
    }
    step(1, "*點一下*：牌飛到自己那一層", "Click a card — it flies to its own layer", b(72, 0.5), b(75, 0));
    step(2, "有的牌會*帶一張來*，同一層只留一張", "Some cards bring a friend; one card per slot", b(75, 0), b(78, 0));
    // 附帶：太陽裙→洋裝、海灘→戶外
    showRel("carry", "sundress", "dress", outs.sundress.carried[0].tin + 0.2, b(76, 1), "附帶");
    showRel("carry", "beach", outs.beach.carried[0].tag, outs.beach.carried[0].tin + 0.2, b(78, 3), "附帶");
    marksFor(outs.sundress.carried[0].tag, outs.sundress.carried[0].tin + 0.1, b(76, 1));
    marksFor("sundress", outs.sundress.carried[0].tin + 0.1, b(76, 1));
    // 右邊：試印的字（四張試印跟著版重跑）
    text.say("每放一張，右邊*四張試印*就重跑一次", "Every card reruns the four proofs", b(78, 1), b(79, 3.6));
    // 游標移到右欄一下
    const tR = b(79, 0);
    pen.moveTo(tR, { x: 620, y: 40 }, { dur: 1.0, bow: 0.1 });
  }

  /* =====================================================================
   * 10 影子與關係（bar 80–89）
   * ===================================================================== */
  {
    const c = CH.shadow;
    text.chapter("10", c.zh, c.en, b(80, 0), b(81, 1.5));
    tipAt({ S, M: O }, "影子：引擎替你補的牌", "", -80, -210, b(80, 2), b(82, 1), { parent: O, up: false });
    text.say("灰色的是*影子*：沒放的層，引擎替你補", "Grey shadows — what the engine fills in", b(81, 0), b(82, 3.5));
    // 收下一張影子：滑鼠停上去 → 選單 → 收下這張
    const tHover = b(82, 3);
    const tAdopt = b(83, 3);
    const st = ghostState(tHover);
    const rowPick = ["wear", "pose", "look", "style", "scene"].find((r) => st.byRow.get(r)?.length);
    const gTag = st.byRow.get(rowPick)[0];
    const gPos = ghostPos(rowPick, 0, tHover);
    pen.moveTo(tHover, gPos, { dur: 1.0, bow: 0.1 });
    const menu = mk("div", "w tmenu", O, `<i class="on">收下這張</i><i>加進偏好卡牌</i>`);
    menu.style.zIndex = "30";
    menu.style.width = "150px";
    S.act([tHover, tAdopt + 0.3], (t) => {
      const p = EZ.out(seg(t, tHover + 0.5, tHover + 0.8)) * (1 - EZ.exit(seg(t, tAdopt, tAdopt + 0.2)));
      put(menu, { x: gPos.x + 86, y: gPos.y + 66, s: lerp(0.9, 1, p), o: p });
    }, menu);
    S.cue({ t: tHover + 0.5, kind: "pop", gain: 0.08, f: 460 });
    // 滑鼠按下「收下這張」：影子飛進「你的牌」那一邊
    const mPos = { x: gPos.x + 86, y: gPos.y + 66 - 17 };
    clickAt(tAdopt, mPos, { dur: 0.6 });
    const from = ghostPos(rowPick, 0, tAdopt);
    const r = place(gTag, tAdopt, tAdopt + 0.55, from, { lift: 50 });
    lib.hover.length; // 保持型別
    void r;
    step(3, "點影子，*收下這張*：它就固定在版上", "Click a shadow to keep it", b(82, 2), b(85, 0));
    fx.trail({ path: (t) => arc(from, userPos(r.main, t), EZ.travel(seg(t, tAdopt, r.main.tin)), 50), t0: tAdopt, t1: r.main.tin, color: SUIT_COLOR[suitOf(gTag)], size: 10 });

    // 相剋：海灘 ＋ 室內 → 同時成立不了
    const tIn = b(85, 0.5);
    const inR = libClick("indoors", tIn);
    const tClash = inR.main.tin + 0.35;
    marks.push({ tag: "beach", kind: "clash", t0: tClash, t1: b(87, 1.5) }, { tag: "indoors", kind: "clash", t0: tClash, t1: b(87, 1.5) });
    showRel("clash", "beach", "indoors", tClash, b(87, 1.4), "相剋");
    const rel = relationsOf(bed, { lex: env.lex, contradictions, actPlace: ACT_PLACE }).filter((x) => x.kind === "clash");
    if (!rel.length) throw new Error("海灘＋室內應該相剋");
    noteAt(tClash, b(87, 3), `<em>相剋</em>「${zhOf(rel[0].a)}」跟「${zhOf(rel[0].b)}」同時成立不了，引擎會擠掉其中一個`, "clash");
    S.cue({ t: tClash, kind: "clash", gain: 0.11 });
    step(4, "*相剋*：同時成立不了的，描紅提醒你", "Clashes are flagged in red", b(85, 0), b(87, 3.5));
    // 把室內拿掉（指到牌角出現 ×，按下去）
    const tX = b(87, 1.5);
    postList.push(() => {
      const p = userPos(spanOf("indoors", tX), tX);
      xs.push({ tag: "indoors", t0: tX - 0.6, t1: tX + 0.1 });
      pen.moveTo(tX, { x: p.x + 33, y: p.y - 46 }, { dur: 0.9 });
      cur.click(tX);
      S.cue({ t: tX, kind: "click", gain: 0.15 });
    });
    remove("indoors", tX + 0.05, homeOf("indoors"));
    text.say("放不下的影子收成 *+N*，隨時點開", "Extra shadows fold into +N", b(88, 0), b(88, 3.9));
  }

  /* =====================================================================
   * 11 四張試印（bar 89–97）
   * ===================================================================== */
  {
    const c = CH.proof;
    text.chapter("11", c.zh, c.en, b(89, 0), b(90, 1.5));
    tipAt({ S, M: O }, "四張試印：同一批種子", "", 620, -120, b(89, 1), b(91, 0), { parent: O, up: true });
    // 滑鼠停在 B 上：影子先換成 B 補的（只是看看）
    const tB = b(90, 0);
    pen.moveTo(tB, { x: TILE[1].x + 70, y: TILE[1].y + 30 }, { dur: 1.0, bow: 0.1 });
    srcEv.push([tB + 0.25, 1]);
    srcEv.push([b(91, 0), 0]);
    const tipB = b(90, 0.5);
    tipAt({ S, M: O }, "停一下：先預覽 B 補的", "", TILE[1].x + 70, TILE[1].y - 45, tipB, b(90, 3.5), { parent: O, up: false });
    // 按 2 → 選 B；按 3 → 選 C；按 1 → 回 A
    const keys = [
      ["2", b(91, 1), 1],
      ["3", b(92, 0.5), 2],
      ["1", b(93, 0), 0],
    ];
    for (const [k, t, idx] of keys) {
      keycaps([{ label: k, t, tag: `試印 ${LETTERS[idx]}` }]);
      selEv.push([t, idx]);
      srcEv.push([t, idx]);
      S.cue({ t, kind: "key", gain: 0.2 });
    }
    step(1, "*1–4* 選試印：影子跟著換", "Keys 1–4 pick a proof", b(90, 3), b(93, 3));
    // 牌角四個點：四張試印裡，你的牌進了幾張
    tipAt({ S, M: O }, "牌角四個點：四張試印有幾張用到", "", -200, 150, b(93, 1.5), b(95, 0), { parent: O, up: false });
    // R：換一批
    const tR = b(95, 0);
    keycaps([{ label: "R", t: tR, tag: "換一批" }]);
    S.cue({ t: tR, kind: "key", gain: 0.2 }, { t: tR + 0.1, kind: "whoosh", gain: 0.08, dur: 0.6 });
    clickAt(tR + 0.02, { x: 742, y: -64 }, { dur: 0.7 });
    seedEv.push([tR + 0.05, 1]);
    step(2, "*R*：換一批種子，四張全部重抽", "R rerolls all four", b(94, 2), b(96, 3.5));
    // 回到第一批
    text.say("挑順眼的那張，就*付印*", "Pick the one you like, then print", b(96, 0), b(96, 3.9));
    selEv.push([b(96, 2), 0]);
    srcEv.push([b(96, 2), 0]);
    seedEv.push([b(96, 2), 0]);
  }

  /* =====================================================================
   * 12 付印與晾紙（bar 97–105）
   * ===================================================================== */
  {
    const c = CH.print;
    text.chapter("12", c.zh, c.en, b(97, 0), b(98, 1));
    function printJob(letterIdx, tKey, tDone, ropeIdx) {
      const tHang = tDone + 1.0;
      printJobs.push({ idx: letterIdx, t0: tKey, t1: tDone, tHang, rope: ropeIdx });
      keycaps([{ label: "P", t: tKey, tag: "付印" }]);
      clickAt(tKey, PRINT_BTN, { dur: 0.9 });
      S.cue({ t: tKey, kind: "key", gain: 0.2 }, { t: tKey + 0.1, kind: "swell", gain: 0.06, dur: 2.6 }, { t: tDone, kind: "sparkle", gain: 0.08 }, { t: tHang, kind: "stamp", gain: 0.18 });
      hangs.push({ idx: letterIdx, t: tHang, rope: ropeIdx });
    }
    printJob(0, b(97, 2), b(99, 2.6), 0);
    step(1, "*P* 付印：紙從滾筒下過，圖慢慢顯出來", "P prints — the image develops on paper", b(97, 1), b(100, 0));
    text.say("印好的，*夾到晾紙繩上*", "Finished prints hang on the rope", b(100, 0), b(101, 3));
    // 再印 B
    selEv.push([b(101, 0), 1]);
    srcEv.push([b(101, 0), 1]);
    keycaps([{ label: "2", t: b(101, 0), tag: "試印 B" }]);
    S.cue({ t: b(101, 0), kind: "key", gain: 0.2 });
    printJob(1, b(101, 2), b(103, 2.6), 1);
    step(2, "同時可以*印好幾張*，晾在繩上", "Print several — they hang side by side", b(101, 1), b(104, 3));
    // 印好之後鈕變成 Hires
    text.say("印好的圖還能*Hires*，畫得更細", "Hires adds detail to a finished print", b(103, 3), b(104, 3.9));
  }

  /* =====================================================================
   * 13 撤回、清版、起手式（bar 105–112）
   * ===================================================================== */
  {
    const c = CH.more;
    text.chapter("13", c.zh, c.en, b(105, 0), b(106, 1));
    // Z：撤回一步（最後放的那張飛回字盒）
    const tZ = b(105, 2);
    keycaps([{ label: "Z", t: tZ, tag: "撤回" }]);
    S.cue({ t: tZ, kind: "key", gain: 0.2 }, { t: tZ + 0.05, kind: "unwind", gain: 0.08, dur: 0.5 });
    pen.moveTo(tZ, { x: 342, y: -260 }, { dur: 0.9 });
    cur.click(tZ);
    selEv.length;
    const lastTag = bed.pins[bed.pins.length - 1];
    remove(lastTag, tZ + 0.05, homeOf(lastTag));
    step(1, "*Z* 撤回：放錯了一鍵回到上一步", "Z undoes the last step", b(105, 1), b(107, 0));
    const savedBed = { pins: bed.pins.slice(), carried: { ...bed.carried } };
    // 清版：一起收回字盒
    const tC = b(107, 1);
    clickAt(tC, { x: 402, y: -260 }, { dur: 0.8 });
    const alive = spans.filter((s) => s.tout === Infinity).map((s) => s.tag);
    alive.forEach((tag, i) => endSpan(tag, tC + 0.05 + i * 0.05, homeOf(tag)));
    bed = emptyBed();
    pinsEv.push({ t: tC + 0.1, pins: [], carried: {} });
    step(2, "*清版*：整版收回字盒，重新開始", "Clear the bench and start over", b(107, 0), b(109, 0));
    S.cue({ t: tC, kind: "click", gain: 0.14 }, { t: tC + 0.1, kind: "whoosh", gain: 0.1, dur: 0.6 });
    // 空版 → 起手式
    const tStart = b(108, 2.5);
    const S1 = starterEls[0];
    clickAt(tStart, { x: S1.x, y: S1.y }, { dur: 0.9 });
    S.cue({ t: tStart + 0.02, kind: "pop", gain: 0.1, f: 500 });
    S1.tags.forEach((tag, i) => {
      const tl = tStart + 0.2 + i * 0.32;
      place(tag, tl - 0.4, tl + 0.4, { x: S1.x, y: S1.y }, { lift: 70 });
    });
    starterShow.push([b(107, 3), tStart + 0.15]);
    step(3, "第一次不知道放什麼？*起手式*一點就疊好", "Starters: a ready-made bed in one click", b(108, 0), b(110, 0));
    // 晾紙繩上的作品：點它，回到那一版
    const tRope = b(110, 1);
    const hp = hangs[0];
    const ropePt = { x: ropeX(hp.rope) + 22, y: ROPE_Y + 48 };
    clickAt(tRope, ropePt, { dur: 1.1, bow: 0.1 });
    // 先把起手式那版收掉，再讓保存的那一版從繩子上飛回來
    const tBack = tRope + 0.05;
    spans.filter((s) => s.tout === Infinity).forEach((s, i) => endSpan(s.tag, tBack + i * 0.03, { mode: "lift" }));
    bed = { pins: [], carried: {} };
    pinsEv.push({ t: tBack + 0.1, pins: [], carried: {} });
    let n = 0;
    for (const tag of savedBed.pins) {
      const carriedBy = savedBed.carried[tag];
      const tl = tBack + 0.45 + n * 0.12;
      if (carriedBy) addSpan(tag, tl + 0.4, { mode: "pop" }, { carriedBy });
      else addSpan(tag, tl + 0.42, { mode: "fly", tClick: tl, tLand: tl + 0.42, from: ropePt, lift: 90 });
      n++;
    }
    bed = savedBed;
    pinsEv.push({ t: tBack + 0.45 + n * 0.12 + 0.5, pins: savedBed.pins.slice(), carried: { ...savedBed.carried } });
    S.cue({ t: tRope, kind: "click", gain: 0.15 }, { t: tBack + 0.45, kind: "swell", gain: 0.07, dur: 1.0 });
    step(4, "點晾紙繩上的作品，*回到那一版*", "Click a hanging print to restore that bed", b(110, 0), b(112, 0));
    text.say("版、種子、試印，*全部照原樣回來*", "Everything comes back exactly as printed", b(111, 0), b(111, 3.9));
  }

  /* ---------- 版上的一句說明 ---------- */
  function noteAt(t0, t1, html, kind = "swell") {
    noteWins.push([t0, t1 + 0.3]);
    S.act([t0 - 0.05, t1 + 0.4], (t) => {
      const p = EZ.out(seg(t, t0, t0 + 0.32)) * (1 - EZ.exit(seg(t, t1, t1 + 0.3)));
      setHTML(note, html);
      note.className = "tb tnote" + (kind === "clash" ? " clash" : "");
      note.style.opacity = p.toFixed(3);
      note.style.transform = `translateY(${((1 - p) * 8).toFixed(1)}px)`;
    });
  }

  /* ---------- 每一格畫什麼 ---------- */
  const paperState = { hang: [] };
  const tileHtml = new Map();
  const heldFmt = (n) => (n < 10 ? String(n) : String(n));
  void heldFmt;
  S.act([0, 1e9], (t) => {
    /* --- 字盒 --- */
    lib.render(t);
    /* --- 版的列 --- */
    const st = ghostState(t);
    const total = st.pins.length;
    rows.forEach((r) => {
      const n = spans.filter((s) => s.row === r.suit && t >= s.tin && (s.tout === Infinity || t < s.tout)).length;
      const g = r.glow.some(([a, c2]) => t >= a && t < c2);
      r.el.classList.toggle("glow", g);
      setHTML(r.rn, `${esc(REGISTER_ROLE[r.suit])}<small>${n ? n : ""}</small>`);
    });
    // 副標題：試印 A：你的 N 張，引擎補 M 張
    const selNow = last(selEv, t);
    if (st.trials) {
      const tr = st.trials[selNow];
      setHTML(sub, `試印 ${LETTERS[selNow]}：你的 ${total} 張，引擎補 ${tr.extra.length} 張`);
    } else setHTML(sub, "");
    sub.style.opacity = noteWins.some(([a, c2]) => t >= a && t < c2) ? "0" : "1";
    emptyHint.style.opacity = total === 0 && t > b(70, 3) ? String(1 - Math.min(1, spans.some((s) => t >= s.tAppear && t < (s.tout === Infinity ? 1e9 : s.tGone)) ? 1 : 0)) : "0";
    let starterOn = 0;
    for (const [a, c2] of starterShow) starterOn = Math.max(starterOn, EZ.out(seg(t, a, a + 0.4)) * (1 - EZ.exit(seg(t, c2, c2 + 0.3))));
    starterEls.forEach((s, i) => {
      s.el.style.opacity = starterOn.toFixed(3);
      s.el.style.transform = `translateY(${((1 - starterOn) * 14 + i * 0).toFixed(1)}px)`;
    });

    /* --- 你的牌 --- */
    for (const [tag, o] of els) {
      const list = spans.filter((s) => s.tag === tag);
      let s = null;
      for (const k of list) {
        const gone = k.tout === Infinity ? Infinity : k.tGone;
        if (t >= k.tAppear - 0.001 && t < gone) s = k;
      }
      if (!s) {
        if (o.el.style.visibility !== "hidden") o.el.style.visibility = "hidden";
        continue;
      }
      const slot = userPos(s, t);
      let x;
      let y;
      let sc = 1;
      let rz = 0;
      let op = 1;
      let z = 5;
      let lifted = false;
      if (t < s.tin && s.enter.mode === "fly") {
        const e = s.enter;
        const p = EZ.travel(seg(t, e.tClick, e.tLand));
        const a = arc(e.from, slot, p, e.lift ?? 120);
        x = a.x;
        y = a.y;
        sc = lerp(98 / PW, 1, p) * (1 + Math.sin(Math.PI * p) * 0.1);
        rz = -7 * Math.sin(Math.PI * p);
        z = 30;
        lifted = true;
      } else {
        x = slot.x;
        y = slot.y;
        const e = s.enter;
        if (e.mode === "pop") {
          const p = EZ.out(seg(t, s.tin, s.tin + 0.42));
          y += (1 - p) * 18;
          sc = lerp(0.7, 1, p) + Math.max(0, spring(t - s.tin - 0.3, 0.05, 8, 22));
          op = Math.min(1, p * 3);
        } else sc = 1 + spring(t - s.tin, 0.06, 7, 20);
      }
      if (s.tout !== Infinity && t >= s.tout) {
        const lv = s.leave;
        const p = seg(t, s.tout, s.tGone);
        if (lv.mode === "home") {
          const q = EZ.travel(p);
          const a = arc({ x, y }, lv.to, q, 90);
          x = a.x;
          y = a.y;
          sc = lerp(1, 98 / PW, q);
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
      let related = false;
      let clash = false;
      let shake = 0;
      for (const mk_ of marks) {
        if (mk_.tag !== tag || t < mk_.t0 || t > mk_.t1) continue;
        if (mk_.kind === "related") related = true;
        if (mk_.kind === "clash") {
          clash = true;
          shake = Math.sin((t - mk_.t0) * 60) * 4 * Math.exp(-(t - mk_.t0) * 5);
        }
      }
      o.el.classList.toggle("is-related", related);
      o.el.classList.toggle("is-clash", clash);
      o.el.classList.toggle("is-lifted", lifted);
      stampFlag(o.carry, t, s.carriedBy && s.enter.mode === "pop" ? s.tin + 0.15 : 1e9);
      const xw = xs.find((w) => w.tag === tag && t >= w.t0 && t <= w.t1);
      o.x.style.opacity = xw ? "1" : "0";
      // 牌角四個點：四張試印裡有幾張真的用到
      const trs = st.trials;
      const dotsOn = trs && t > s.tin + 0.5;
      o.dots.style.opacity = dotsOn ? String(EZ.out(seg(t, s.tin + 0.5, s.tin + 0.9))) : "0";
      if (dotsOn) {
        [...o.dots.children].forEach((d, i) => {
          const on = trs[i].got(tag) ? "1" : "0";
          if (d.dataset.on !== on) d.dataset.on = on;
        });
      }
      put(o.el, { x: x + shake, y, rz, s: sc, o: op });
      o.el.style.zIndex = String(z);
    }

    /* --- 影子（灰色的牌）：換了一批就滑進來、舊的淡出 --- */
    {
      const tc = lastChange(t);
      const pv = ghostState(tc - 0.02);
      const p = EZ.out(seg(t, tc, tc + 0.5));
      const showing = new Set();
      for (const r of rows) {
        const cur_ = (st.byRow.get(r.suit) || []).slice(0, GCAP);
        const prev = (pv.byRow.get(r.suit) || []).slice(0, GCAP);
        const cn = userCount(r.suit, t);
        r.div.style.opacity = cur_.length && cn > 0.4 ? "0.9" : "0";
        r.div.style.left = `${X0 + 447 + cn * PITCH + 6}px`;
        const rest = (st.byRow.get(r.suit) || []).length - cur_.length;
        if (rest > 0) {
          const pos = ghostPos(r.suit, cur_.length, t);
          setHTML(r.more, `+${rest}`);
          r.more.style.left = `${pos.x - GW / 2 + 447}px`;
          r.more.style.opacity = String(EZ.out(seg(t, tc + 0.3, tc + 0.6)));
        } else r.more.style.opacity = "0";
        const draw = (list, kind) => {
          list.forEach((tag, i) => {
            const el = ghostEl(tag);
            const inOther = (kind === "cur" ? prev : cur_).indexOf(tag);
            const pos = ghostPos(r.suit, i, t);
            const from = inOther >= 0 ? ghostPos(r.suit, inOther, t) : pos;
            const gx = kind === "cur" ? lerp(from.x, pos.x, p) : pos.x;
            const op = kind === "cur" ? (inOther >= 0 ? 1 : p) : 1 - p;
            if (kind === "prev" && cur_.includes(tag)) return;
            showing.add(tag);
            put(el, { x: gx, y: pos.y + (kind === "cur" && inOther < 0 ? (1 - p) * 10 : 0), s: 1, o: op * (st.pins.length || kind === "prev" ? 1 : 0) });
          });
        };
        draw(cur_, "cur");
        if (p < 1) draw(prev, "prev");
      }
      for (const [tag, el] of ghostEls) if (!showing.has(tag) && el.style.visibility !== "hidden") el.style.visibility = "hidden";
    }

    /* --- 右欄：四張試印 --- */
    {
      const trs = st.trials;
      const sel = selNow;
      const previewing = st.src !== sel;
      tiles.forEach((tl, i) => {
        tl.el.classList.toggle("on", i === sel && st.pins.length > 0);
        let html;
        if (!trs) html = `<b class="let">${tl.L}</b><div>補 —</div>`;
        else {
          const ex = trs[i].extra;
          const pk = ["cast", "look", "wear", "pose", "scene", "style"].map((s2) => ex.find((tag) => suitOf(tag) === s2)).filter(Boolean).slice(0, 4);
          html = `<b class="let">${tl.L}</b><div>補 ${ex.length} 現代<div class="pk">${pk.map((tag) => `<i style="--suit:var(--suit-${suitOf(tag)});background-image:url('${env.assets.art(tag)}')"></i>`).join("")}</div></div>`;
        }
        if (tileHtml.get(tl) !== html) {
          tileHtml.set(tl, html);
          tl.el.innerHTML = html;
        }
        tl.el.style.outline = previewing && i === st.src ? "1.5px dashed var(--color-ink-2)" : "";
      });
      setHTML(detail, trs ? `<div style="display:flex;gap:14px;align-items:center"><b class="ttrial-let" style="display:grid;place-items:center;width:52px;height:52px;border:2px solid var(--color-accent);border-radius:8px;color:var(--color-accent);font:800 30px/1 var(--font-display)">${LETTERS[sel]}</b><div style="font:500 14px/1.45 var(--font-body);color:var(--color-ink-2)"><b style="font:800 18px/1 var(--font-display);color:var(--color-ink)">試印 ${LETTERS[sel]}</b><br>你的 ${st.pins.length} 張・引擎補 ${trs[sel].extra.length} 張<br>現代・全年齡</div></div>` : "");
      // 付印鈕：按下去的回饋、印好之後換成 Hires
      let s = 1;
      let label2 = "付 印";
      for (const j of printJobs) {
        s *= pressScale(t, j.t0);
        if (t >= j.t1 + 0.4 && t < j.t1 + 3.3) label2 = "Hires";
      }
      printBtn.style.transform = s === 1 ? "" : `scale(${s.toFixed(4)})`;
      setHTML(printBtn, label2);
      pvMsg.style.opacity = printJobs.some((j) => t >= j.t0 && t < j.tHang) ? "0" : "1";
    }
    // 換一批鈕、撤回、清版的按下
    for (const [el, ts] of [[reroll, [b(95, 0) + 0.02]], [undoBtn, [b(105, 2)]], [clearBtn, [b(107, 1)]]]) {
      let s = 1;
      for (const a of ts) s *= pressScale(t, a);
      el.style.transform = s === 1 ? "" : `scale(${s.toFixed(4)})`;
    }

    /* --- 付印：預覽區的紙、滾筒、顯影、夾上晾紙繩 --- */
    {
      let job = null;
      for (const j of printJobs) if (t >= j.t0 && t < j.tHang + 0.05) job = j;
      const src = job && IMG[job.idx];
      if (job && src) {
        if (phImg._src !== src) {
          phImg.src = src;
          phImg._src = src;
        }
        const pIn = EZ.out(seg(t, job.t0, job.t0 + 0.5));
        const roll = seg(t, job.t0 + 0.3, job.t1);
        const dev = EZ.inOut(roll);
        const hang = EZ.in(seg(t, job.tHang - 1.0, job.tHang));
        const target = { x: ropeX(job.rope) + 22, y: ROPE_Y + 34 };
        const px = lerp(RCX, target.x, hang);
        const py = lerp(-190, target.y, hang);
        const sc = lerp(1, 0.31, hang);
        paper.style.opacity = (pIn * (1 - (t >= job.tHang ? 1 : 0))).toFixed(3);
        paper.style.transform = `translate(${(px - 74).toFixed(1)}px, ${(py - 102 + (1 - pIn) * -30).toFixed(1)}px) scale(${sc.toFixed(4)})`;
        paper.style.transformOrigin = "50% 50%";
        phImg.style.filter = `blur(${lerp(22, 0, dev).toFixed(1)}px) saturate(${lerp(0.2, 1, dev).toFixed(2)}) brightness(${lerp(1.6, 1, dev).toFixed(2)})`;
        prog.style.opacity = roll < 1 ? "1" : "0";
        prog.firstChild.style.transform = `scaleX(${roll.toFixed(3)})`;
        roller.style.opacity = roll > 0 && roll < 1 ? "1" : "0";
        roller.style.transform = `translateY(${(roll * 176).toFixed(1)}px)`;
        setHTML(pvCap, `<b style="font:800 15px/1 var(--font-display)">試印 ${LETTERS[job.idx]}</b> <span style="font:500 13px/1 var(--font-body);color:var(--color-muted);margin-left:8px">${roll < 1 ? `印製中 ${Math.max(1, Math.round(roll * 25))}/25` : "印好了"}</span>`);
      } else {
        paper.style.opacity = "0";
        setHTML(pvCap, `<b style="font:800 15px/1 var(--font-display)">預覽</b> <span style="font:500 13px/1 var(--font-body);color:var(--color-muted);margin-left:8px">還沒付印</span>`);
      }
    }
    // 晾紙繩上的作品
    hangs.forEach((h, i) => {
      if (!h.el) {
        const el = mk("div", "tb tpaper", O);
        Object.assign(el.style, { width: "46px", height: "64px", zIndex: "6" });
        const img = mk("div", "ph", el);
        Object.assign(img.style, { left: "3px", top: "3px", width: "40px", height: "58px", background: `center / cover url('${IMG[h.idx] || ""}')` });
        mk("i", "tpeg", el).style.cssText = "top:-8px;width:10px;height:15px;margin-left:-5px";
        h.el = el;
      }
      const on = t >= h.t - 0.02;
      h.el.style.display = on ? "" : "none";
      if (on) {
        const drop = spring(t - h.t, 5, 6, 20);
        h.el.style.transform = `translate(${ropeX(h.rope)}px, ${ROPE_Y + 2}px) rotate(${drop.toFixed(2)}deg)`;
        h.el.style.transformOrigin = "50% 0";
      }
    });
    cur.render(t);
    fx.render(t);
    frame.style.setProperty("--glare", `${((t * 22) % 260 - 60).toFixed(1)}%`);
  });
  void paperState;

  /* ---------- 收尾：先把所有會用到的元素建好 ---------- */
  for (const tag of new Set(spans.map((s) => s.tag))) elOf(tag);
  buildGhosts();
  postList.forEach((f) => f());

  /* ---------- 鏡頭 ---------- */
  const cam = calmTrack(
    [
      [T0 - 0.1, V(0, 0, -300, 14, -30, 0)],
      [b(66, 3), V(0, 0, 200, 8, -22, 0), EZ.inOut],
      [b(68, 3), V(0, 0, 250, 4, 14, 0), EZ.inOut],
      [b(69, 3), V(0, 0, 100, 0, 0, 0), EZ.inOut],
      [b(70, 2), focus(0, 0, 0.86, { rx: 3, ry: 4 }), EZ.out],
      [b(71, 3), focus(0, 0, 0.9, { rx: 1, ry: 1 })],
      [b(72, 1), focus(-330, -30, 1.35), EZ.inOut],
      [b(75, 0), focus(-250, 20, 1.4), EZ.inOut],
      [b(77, 0), focus(-230, 130, 1.35), EZ.inOut],
      [b(78, 3), focus(-120, 60, 1.1), EZ.inOut],
      [b(79, 3), focus(300, 20, 1.3), EZ.inOut],
      [b(80, 0), focus(-100, 20, 1.3), EZ.inOut],
      [b(82, 0), focus(-100, 30, 1.6), EZ.inOut],
      [b(84, 0), focus(-230, 10, 1.35), EZ.inOut],
      [b(85, 3), focus(-160, 130, 1.5), EZ.inOut],
      [b(88, 0), focus(-100, 40, 1.15), EZ.inOut],
      [b(89, 0), focus(560, 20, 1.5), EZ.inOut],
      [b(93, 0), focus(60, 60, 1.2), EZ.inOut],
      [b(94, 3), focus(560, 20, 1.5), EZ.inOut],
      [b(97, 0), focus(560, -60, 1.45), EZ.inOut],
      [b(100, 0), focus(-20, -190, 1.25), EZ.inOut],
      [b(101, 2), focus(560, -40, 1.45), EZ.inOut],
      [b(104, 0), focus(-20, -170, 1.2), EZ.inOut],
      [b(105, 0), focus(-40, -10, 1.1), EZ.inOut],
      [b(107, 0), focus(-50, 40, 1.25), EZ.inOut],
      [b(109, 0), focus(-40, 20, 1.15), EZ.inOut],
      [b(110, 0), focus(-100, -140, 1.3), EZ.inOut],
      [b(111, 2), focus(-40, 10, 1.0), EZ.inOut],
      [b(113, 0), focus(0, 0, 0.8, { rx: 6, ry: -10 }), EZ.inOut],
    ],
    { until: b(71, 3) }
  );
  S.cam = cam;
  return { S };
}
