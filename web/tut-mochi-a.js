/**
 * 墨池的教學（一）：認識畫面、放牌的三種方法、牌跟牌的關係。二在 tut-mochi-b.js。
 * 每一章 = 游標的路徑＋點擊時間、牌的進出（PoolTL）、字盒視圖的更換、鏡頭、字幕、音效；
 * 時間都用 bar(小節, 拍) 排，點擊和落地踩在拍子上。
 * 「放一張牌會發生什麼」（誰被帶上來、誰被擠掉）不是手寫的：sim.pin() 呼叫真的 applyPin，畫面照它的結果演。
 */
import { EZ, seg, lerp, spring, mk, put, setHTML, esc, V, env, makeScene, K, arc, box, label, suitOf, zhOf, cardEl } from "./tut-kit.js";
import { calmTrack } from "./tut-kit.js";
import { applyPin, contradictions, ACT_PLACE } from "./engine.js";
import { relationsOf } from "./fuse-bed.js";
import { CH } from "./tut-chapters.js";
import { b, B, buildMochiScreen, buildLibrary, buildPool, buildSearch, peekAt, toastAt, noteAt, noteBtnPos, tipAt, POOL, LIBRARY, viewList } from "./tut-mochi.js";
import { buildMochiPartB } from "./tut-mochi-b.js";

/** 鏡頭放大 s 倍需要的 z（perspective 1500）。 */
export const zoomZ = (s) => 1500 * (1 - 1 / s);
/** 看向螢幕上的 (x, y)，放大 s 倍；動作往上抬一點，下方留給字幕。 */
export const focus = (x, y, s = 1, rot = {}) => V(x, y + 62 / s, zoomZ(s), rot.rx ?? 0, rot.ry ?? 0, rot.rz ?? 0);

export const SUIT_COLOR = {
  cast: "oklch(72% 0.07 250)",
  look: "oklch(68% 0.11 8)",
  wear: "oklch(66% 0.1 305)",
  pose: "oklch(68% 0.09 165)",
  scene: "oklch(72% 0.1 72)",
  style: "oklch(74% 0.09 115)",
};

/** 「換下來的原因」那一行字（app.js 的 replaceNote）：同一格、時代、沒有人物。 */
export function replaceNote(tag, gone) {
  const lex = env.lex;
  const item = lex.byTag.get(tag);
  const eraOf = (it) => (it?.era || []).filter((e) => e !== "any");
  const clash = (o) => {
    const a = eraOf(item);
    const b2 = eraOf(lex.byTag.get(o));
    return a.length && b2.length && !a.some((e) => b2.includes(e));
  };
  const era = gone.filter(clash);
  const slot = gone.filter((o) => !clash(o));
  const z = (t) => `「${zhOf(t)}」`;
  const bits = [];
  if (slot.length) bits.push(`同一格只留一張：${slot.map(z).join("")}換成${z(tag)}`);
  if (era.length) bits.push(`${era.map(z).join("")}跟${z(tag)}不是同一個時代，先拿下來了`);
  return bits.join("；");
}

/** 真的引擎在算「這一步池裡會怎樣」。 */
export function makeSim() {
  let pinned = new Set();
  const bans = new Set();
  return {
    pin(tag) {
      const before = new Set(pinned);
      const r = applyPin(env.lex, pinned, bans, tag);
      pinned = r.pinned;
      return { added: [...pinned].filter((t) => !before.has(t) && t !== tag), removed: [...before].filter((t) => !pinned.has(t)) };
    },
    unpin(tag) {
      const before = new Set(pinned);
      pinned.delete(tag);
      for (const x of env.lex.byTag.get(tag)?.bind || []) pinned.delete(x);
      return { removed: [...before].filter((t) => !pinned.has(t)) };
    },
    has: (t) => pinned.has(t),
    list: () => [...pinned],
  };
}

/** 游標的「筆」：一路記著現在在哪、什麼時候到，moveTo 排下一段（走弧線）。 */
export function makePen(cur, start, t0 = 0) {
  let p = start;
  let t = t0;
  return {
    get pos() {
      return p;
    },
    moveTo(tArrive, P, o = {}) {
      const dur = o.dur ?? 0.6;
      const tStart = Math.max(t, tArrive - dur);
      cur.path(K(tStart, p.x, p.y), K(tArrive, P.x, P.y, o));
      p = P;
      t = tArrive;
      return this;
    },
    /** 原地不動到 t（下一次移動從這裡出發）。 */
    wait(tt) {
      t = Math.max(t, tt);
      return this;
    },
  };
}

export function buildMochiScene(ctx) {
  const { world, hud, text, step, keycaps, gact, SCENES } = ctx;
  const S = makeScene("mochi", { world, hud, tint: [0.62, 0.1, 200] });
  SCENES.mochi = S;
  const m = buildMochiScreen(S, ctx);
  const lib = buildLibrary(m);
  const pool = buildPool(m, lib);
  const search = buildSearch(m);
  const cur = m.cursor;
  const fx = m.fx;
  const sim = makeSim();
  const post = []; // pool.finalize() 之後才做（要知道牌最後落在哪一格）
  m.lib = lib;
  m.pool = pool;
  m.search = search;
  m.sim = sim;
  m.post = post;
  const T0 = b(6);

  // 字盒一開始：全部（第一頁是人數的牌）。
  lib.view("all", { suit: "all" }, 0);

  /* ---------- 小工具 ---------- */
  const pen = makePen(cur, { x: 330, y: -180 }, T0);
  const tabAt = (id) => m.ui.tabPos[id];

  /** 點一個花色分頁 / 小分類晶片 / 任何位置：游標過去、按下、（同一刻）字盒換視圖。 */
  const clickAt = (t, P, o = {}) => {
    pen.moveTo(t, P, { dur: o.dur ?? 0.55, bow: o.bow });
    cur.click(t);
    S.cue({ t, kind: "click", gain: 0.15 });
  };

  /** 點一張牌：游標過去、按下、牌飛進池子（照真的引擎：誰被帶上來、誰被擠掉）。 */
  function pinCard(viewId, tag, tClick, { dur = B * 1.05, lift = 130, hoverLead = 0.3, quiet = false } = {}) {
    const tLand = tClick + dur;
    const from = lib.slot(viewId, tag);
    clickAt(tClick, from, { dur: 0.5 });
    lib.hover.push({ tag, view: viewId, t0: tClick - hoverLead, t1: tClick + 0.08 });
    const r = sim.pin(tag);
    const span = pool.add(tag, tLand, { mode: "fly", tClick, tLand, from, lift });
    r.removed.forEach((x) => {
      pool.remove(x, tLand + 0.02, { mode: "lift" });
      S.cue({ t: tLand + 0.02, kind: "unwind", gain: 0.06, dur: 0.4 });
    });
    r.added.forEach((x, i) => {
      const s = pool.add(x, tLand + 0.42 + i * 0.16, { mode: "pop" });
      s.carriedBy = tag;
      S.cue({ t: tLand + 0.42 + i * 0.16, kind: "pop", gain: 0.11, f: 420 + i * 90 });
    });
    if (!quiet) S.cue({ t: tLand, kind: "stamp", gain: 0.26 });
    post.push(() => {
      const c = SUIT_COLOR[suitOf(tag)];
      fx.trail({ path: (t) => arc(from, pool.slotPos(span, t), EZ.travel(seg(t, tClick, tLand)), lift), t0: tClick, t1: tLand, color: c, size: 11 });
      const p = pool.slotPos(span, tLand);
      fx.ring({ x: p.x, y: p.y, t0: tLand, color: c, r0: 40, r1: 130, w: 5 });
      fx.sparks({ x: p.x, y: p.y, t0: tLand, n: 10, r: 70, color: c, seed: tClick * 7 });
    });
    return { span, tLand, ...r };
  }

  /* =====================================================================
   * 01 認識畫面（bar 6–11）
   * ===================================================================== */
  {
    const c = CH.screen;
    // 螢幕開機：從遠處轉正、升起來，玻璃上掃過一道光。
    S.act([T0 - 0.1, T0 + 1.6], (t) => {
      const p = EZ.out(seg(t, T0 + 0.05, T0 + 1.15));
      m.frame.style.opacity = Math.min(1, p * 2.2).toFixed(3);
      m.frame.style.transform = `translateY(${((1 - p) * 40).toFixed(1)}px) scale(${lerp(0.94, 1, p).toFixed(4)})`;
    });
    S.cue({ t: T0 - 0.15, kind: "whoosh", gain: 0.14, dur: 1.4 }, { t: T0 + 0.9, kind: "sparkle", gain: 0.05 });

    // 三個地方的名字：數字＋名字，一個接一個彈出來，同時那一塊描一圈光。
    const tag = (n, zh, en, x, y, t0, t1) => {
      const el = mk("div", "w ttag", S.root, `<i>${n}</i><span>${zh}<small>${en}</small></span>`);
      S.act([t0 - 0.1, t1 + 0.5], (t) => {
        const p = EZ.out(seg(t, t0, t0 + 0.5));
        const q = EZ.exit(seg(t, t1, t1 + 0.35));
        put(el, { x, y: y + (1 - p) * 34, z: 70, s: lerp(0.7, 1, p) + spring(t - t0 - 0.5, 0.04, 7, 22), o: p * (1 - q) });
      }, el);
      S.cue({ t: t0, kind: "pop", gain: 0.14, f: 380 + n * 60 });
    };
    tag(1, "字盒", "每個字是一張牌", -560, 60, b(7, 1), b(9, 0));
    tag(2, "合成池", "放進來的，每張圖都有", 200, -226, b(8, 0), b(9, 3));
    tag(3, "成品牆", "印好的圖收在這裡", 200, 250, b(8, 3), b(10, 2));
    fx.frameGlow({ x: -592, y: 25, w: 405, h: 812, t0: b(7, 1), t1: b(9, 0), r: 18 });
    fx.frameGlow({ x: 212, y: -224, w: 1100, h: 176, t0: b(8, 0), t1: b(9, 3), r: 18 });
    fx.frameGlow({ x: 218, y: 268, w: 1147, h: 322, t0: b(8, 3), t1: b(10, 2), r: 18 });

    text.chapter("01", c.zh, c.en, b(6, 3), b(8, 1));
    text.say("墨池只有*三塊*：挑牌、放牌、看成品", "Mochi in three parts — pick, place, see", b(9, 0), b(10, 3));
  }

  /* =====================================================================
   * 02 放牌的三種方法（bar 11–23）
   * ===================================================================== */
  {
    const c = CH.place;
    text.chapter("02", c.zh, c.en, b(11, 0), b(12, 2));

    // 游標從右邊進來，先去點「長相」分頁。
    cur.show(b(10, 3), b(23, 0));

    /* ---- 方法一：點一下（bar 11–13.5） ---- */
    const tTabLook = b(11, 2);
    lib.view("look", { suit: "look" }, tTabLook + 0.05);
    clickAt(tTabLook, tabAt("look"));
    const tChipLen = b(11, 3);
    lib.view("len", { suit: "look", group: "hair_len" }, tChipLen + 0.05);
    clickAt(tChipLen, lib.chipPos("look", "hair_len"), { dur: 0.45 });
    pinCard("len", "long hair", b(12, 0));
    const tChipCol = b(12, 1);
    lib.view("color", { suit: "look", group: "hair_color" }, tChipCol + 0.05);
    clickAt(tChipCol, lib.chipPos("len", "hair_color"), { dur: 0.4 });
    pinCard("color", "red hair", b(12, 2));
    const tTabCast = b(12, 3);
    lib.view("cast", { suit: "cast" }, tTabCast + 0.05);
    clickAt(tTabCast, tabAt("cast"), { dur: 0.4 });
    pinCard("cast", "1girl", b(13, 0));
    step(1, "*點一下*，牌就飛進合成池", "Click a card — it flies into the pool", b(11, 1), b(13, 3));

    /* ---- 方法二：拖曳（bar 13.5–16.5） ---- */
    const tTabScene = b(13, 2);
    lib.view("scene", { suit: "scene" }, tTabScene + 0.05);
    clickAt(tTabScene, tabAt("scene"), { dur: 0.45 });
    const tChipWeather = b(13, 3);
    lib.view("weather", { suit: "scene", group: "weather" }, tChipWeather + 0.05);
    clickAt(tChipWeather, lib.chipPos("scene", "weather"), { dur: 0.45 });
    {
      // 抓起 → 拖過去（合成池亮起邊）→ 放開 → 落定
      const tag = "cherry blossoms";
      const from = lib.slot("weather", tag);
      const tGrab = b(14, 0);
      const tDrop = b(15, 1);
      const tLand = tDrop + 0.5;
      const target = { x: POOL.cx + 60, y: POOL.y };
      pen.moveTo(tGrab, from, { dur: 0.55 });
      cur.click(tGrab);
      cur.hold(tGrab, tDrop);
      // 拖著走：先往上抬，再一路弧線到池子中間
      pen.moveTo(b(14, 3), { x: -160, y: -170 }, { dur: 1.0, bow: 0.16 });
      pen.moveTo(tDrop, target, { dur: 0.7, bow: 0.06 });
      lib.drag.push({ tag, view: "weather", t0: tGrab, t1: tLand });
      lib.hover.push({ tag, view: "weather", t0: tGrab - 0.3, t1: tGrab });
      sim.pin(tag);
      pool.add(tag, tLand, { mode: "drag", tGrab, tDrop, tLand, from, cur });
      S.cue({ t: tGrab, kind: "click", gain: 0.16 }, { t: tGrab + 0.05, kind: "pop", gain: 0.07, f: 300 }, { t: tLand, kind: "stamp", gain: 0.28 });
      // 拖到池子上面時池子亮起來（跟真的一樣：亮邊）
      S.act([b(14, 2.6), tLand + 0.2], (t) => {
        const on = t >= b(14, 2.9) && t < tDrop + 0.05;
        m.ui.poolWell.classList.toggle("over", on);
      });
      post.push(() => {
        const sp = pool.spans.find((s) => s.tag === tag);
        const p = pool.slotPos(sp, tLand);
        fx.trail({ path: (t) => cur.at(t), t0: b(14, 1), t1: tDrop, color: SUIT_COLOR.scene, size: 8, len: 0.25 });
        fx.ring({ x: p.x, y: p.y, t0: tLand, color: SUIT_COLOR.scene, r0: 40, r1: 130, w: 5 });
        fx.sparks({ x: p.x, y: p.y, t0: tLand, n: 12, r: 80, color: SUIT_COLOR.scene, seed: 3 });
      });
    }
    // Esc：拖到一半不想放了，按 Esc，牌彈回原位。
    {
      const tag = "rain";
      const from = lib.slot("weather", tag);
      const tGrab = b(15, 3);
      const tEsc = b(16, 1);
      const tBack = tEsc + 0.6;
      pen.moveTo(tGrab, from, { dur: 0.5 });
      cur.click(tGrab);
      cur.hold(tGrab, tEsc);
      pen.moveTo(tEsc, { x: -60, y: -150 }, { dur: 0.9, bow: 0.14 });
      lib.drag.push({ tag, view: "weather", t0: tGrab, t1: tBack });
      const ghost = cardEl(tag, LIBRARY.w, m.O);
      ghost.style.zIndex = "40";
      S.act([tGrab - 0.05, tBack + 0.2], (t) => {
        const home = from;
        const grab = EZ.out(seg(t, tGrab, tGrab + 0.18));
        const c0 = cur.at(t);
        const back = EZ.out(seg(t, tEsc, tBack));
        const x = lerp(lerp(home.x, c0.x, grab), home.x, back);
        const y = lerp(lerp(home.y, c0.y + 6, grab), home.y, back);
        const rz = (t < tEsc ? Math.max(-12, Math.min(12, (cur.at(t).x - cur.at(t - 0.05).x) * 0.25)) : 0) * (1 - back);
        put(ghost, { x, y, rz, s: lerp(1, 1.1, grab) * lerp(1, 1 / 1.1, back) + (t > tBack ? spring(t - tBack, 0.05, 8, 22) : 0), o: t < tBack + 0.02 ? 1 : 0 });
      }, ghost);
      S.cue({ t: tGrab, kind: "click", gain: 0.14 }, { t: tEsc, kind: "key", gain: 0.2 }, { t: tEsc + 0.05, kind: "unwind", gain: 0.08, dur: 0.5 }, { t: tBack, kind: "tick", gain: 0.1 });
      keycaps([{ label: "Esc", t: tEsc, wide: true, tag: "取消" }]);
    }
    step(2, "*拖進去*：放開前按 *Esc* 就取消", "Drag it in — Esc puts it back", b(14, 0), b(16, 3));

    /* ---- 方法三：搜尋（bar 17–20.5） ---- */
    {
      const tSlash = b(17, 0);
      const box = m.ui.search;
      void box;
      pen.moveTo(tSlash + 0.5, { x: 200, y: -260 }, { dur: 1.0, bow: 0.1 }); // 游標讓開，這一段只用鍵盤
      keycaps([{ label: "/", t: tSlash, tag: "找牌" }]);
      S.cue({ t: tSlash, kind: "key", gain: 0.2 });
      search.focusAt(tSlash, b(20, 1));
      const tType = b(17, 1.5);
      const q1 = "日落";
      const doneAt = search.type(tType, q1, 0.3);
      search.keyTimes().filter((x) => x >= tType).forEach((x) => S.cue({ t: x, kind: "key", gain: 0.12 }));
      const q1List = viewList({ q: q1 });
      lib.view("q1", { q: q1 }, doneAt + 0.05, { tags: q1List.map((k) => k.tag), total: q1List.length });
      const first = q1List[0].tag;
      lib.enter.push({ tag: first, view: "q1", t0: doneAt + 0.4, t1: b(18, 3) + 0.05 });
      const tEnter = b(18, 2);
      keycaps([{ label: "Enter", t: tEnter, wide: true, tag: "放進池" }], { x: 1750 });
      S.cue({ t: tEnter, kind: "key", gain: 0.22 });
      // Enter 放進第一張（游標不用動）；字全選著，直接打下一個
      const from = lib.slot("q1", first);
      const tLand = tEnter + B * 1.05;
      const r = sim.pin(first);
      const span = pool.add(first, tLand, { mode: "fly", tClick: tEnter, tLand, from, lift: 110 });
      r.added.forEach((x, i) => pool.add(x, tLand + 0.42 + i * 0.16, { mode: "pop" }));
      S.cue({ t: tLand, kind: "stamp", gain: 0.26 });
      search.select(tEnter + 0.05);
      post.push(() => {
        const cc = SUIT_COLOR[suitOf(first)];
        fx.trail({ path: (t) => arc(from, pool.slotPos(span, t), EZ.travel(seg(t, tEnter, tLand)), 110), t0: tEnter, t1: tLand, color: cc, size: 11 });
        const p = pool.slotPos(span, tLand);
        fx.ring({ x: p.x, y: p.y, t0: tLand, color: cc, r0: 40, r1: 130, w: 5 });
        fx.sparks({ x: p.x, y: p.y, t0: tLand, n: 10, r: 70, color: cc, seed: 9 });
      });
      // 下一個：打「kimono」— 現代的字盒裡沒有和服（時代不對），字盒會說一聲
      const tType2 = b(19, 0);
      const q2 = "kimono";
      const done2 = search.type(tType2, q2, 0.16);
      search.keyTimes().filter((x) => x >= tType2).forEach((x) => S.cue({ t: x, kind: "key", gain: 0.1 }));
      if (viewList({ q: q2 }).length) throw new Error("現代的字盒裡不該找得到 kimono（教學要示範「找不到」）");
      lib.view("q2", { q: q2 }, done2 + 0.05, { tags: [], total: 0, empty: true });
      search.refuse(done2 + 0.08);
      S.cue({ t: done2 + 0.08, kind: "clash", gain: 0.06 });
      step(3, "按 */* 找牌，*Enter* 放上第一張", "Press / to search, Enter to place", b(16, 3), b(19, 1));
      text.say("字盒裡找不到？*時代*不對，等一下講", "Not found? Wrong era — more on that soon", b(19, 1.2), b(20, 3));
    }

    /* ---- 指著牌看放大牌、認識池裡的東西（bar 20.5–23） ---- */
    {
      const tag = "red hair";
      const sp = pool.spans.find((s) => s.tag === tag);
      const tH = b(20, 3);
      post.push(() => {
        const p = pool.slotPos(sp, tH);
        pen.moveTo(tH, { x: p.x, y: p.y + 20 }, { dur: 0.9, bow: 0.1 });
        peekAt(m, tag, p.x + 40, p.y + 60, tH + 0.35, b(22, 1));
        S.cue({ t: tH, kind: "hover", gain: 0.05 });
      });
      text.say("指著牌，旁邊浮出*放大牌*", "Hover a card for a closer look", b(21, 0.5), b(22, 3));
    }
  }

  /* =====================================================================
   * 03 牌跟牌的關係（bar 23–31）
   * ===================================================================== */
  {
    const c = CH.rels;
    text.chapter("03", c.zh, c.en, b(23, 0), b(24, 2));
    const spanOf = (tag, t) => [...pool.spans].reverse().find((s) => s.tag === tag && s.tin <= t + 1e-6);

    /* ---- 附帶：太陽裙自己帶了「洋裝」（bar 23–25） ---- */
    {
      const tTab = b(23, 1);
      lib.view("wear", { suit: "wear" }, tTab + 0.05);
      clickAt(tTab, tabAt("wear"), { dur: 0.5 });
      const r = pinCard("wear", "sundress", b(23, 3));
      const dress = r.added[0];
      if (dress !== "dress") throw new Error(`太陽裙應該帶「洋裝」：${r.added}`);
      const tPop = r.tLand + 0.42;
      pool.marks.push({ tag: "sundress", kind: "related", t0: tPop + 0.3, t1: b(25, 0) }, { tag: "dress", kind: "related", t0: tPop + 0.3, t1: b(25, 0) });
      post.push(() => {
        const a = () => pool.slotPos(spanOf("sundress", tPop), 99999 && tPop + 1);
        const bb = () => pool.slotPos(spanOf("dress", tPop), tPop + 1);
        fx.link({ a: (t) => pool.slotPos(spanOf("sundress", t), t), b: (t) => pool.slotPos(spanOf("dress", t), t), t0: tPop + 0.15, t1: b(25, 0) - 0.3, color: "oklch(70% 0.14 305)", w: 4, bow: 0.22 });
        void a;
        void bb;
        const pa = pool.slotPos(spanOf("sundress", tPop + 1), tPop + 1);
        const pb = pool.slotPos(spanOf("dress", tPop + 1), tPop + 1);
        tipAt(m, "附帶：牌自己帶上來的", "Some cards bring a friend", (pa.x + pb.x) / 2, POOL.y - 115, tPop + 0.4, b(25, 0) - 0.2);
      });
      step(1, "*附帶*：有的牌會自己帶一張來", "Some cards bring a friend along", b(23, 1), b(25, 0));
    }

    /* ---- 互斥：同一格只留一張（bar 25–27） ---- */
    let tSwapBack;
    {
      const P = { x: -580, y: -297 };
      const tFocus = b(25, 0);
      clickAt(tFocus, P, { dur: 0.7 });
      search.focusAt(tFocus, b(29, 1));
      search.clear(tFocus + 0.02);
      const q = "短髮";
      const doneAt = search.type(b(25, 1.2), q, 0.3);
      search.keyTimes().filter((x) => x >= b(25, 1.2) && x <= doneAt + 0.01).forEach((x) => S.cue({ t: x, kind: "key", gain: 0.1 }));
      const list = viewList({ q });
      lib.view("q3", { q }, doneAt + 0.05, { tags: list.map((k) => k.tag), total: list.length });
      const r = pinCard("q3", "short hair", b(26, 0));
      if (r.removed[0] !== "long hair") throw new Error(`短髮應該擠掉長髮：${r.removed}`);
      const html = `${replaceNote("short hair", ["long hair"])}<b>換回</b>`;
      const btn = noteBtnPos(m, html);
      tSwapBack = b(27, 0);
      noteAt(m, r.tLand, tSwapBack + 0.4, html, { pressAt: tSwapBack });
      clickAt(tSwapBack, btn, { dur: 0.7 });
      // 換回：長髮回來，短髮被擠掉
      const back = sim.pin("long hair");
      back.removed.forEach((x) => pool.remove(x, tSwapBack + 0.05, { mode: "lift" }));
      pool.add("long hair", tSwapBack + 0.15, { mode: "pop" });
      S.cue({ t: tSwapBack + 0.15, kind: "pop", gain: 0.1, f: 360 }, { t: tSwapBack + 0.05, kind: "unwind", gain: 0.06, dur: 0.4 });
      step(2, "*同一格只留一張*：新的換掉舊的，可以換回", "One card per slot — new replaces old, and you can undo", b(25, 0), b(27, 3));
    }

    /* ---- 相剋：同時成立不了（bar 27.5–31） ---- */
    {
      const tSel = b(27, 2);
      const P = { x: -580, y: -297 };
      clickAt(tSel, P, { dur: 0.6 });
      const q = zhOf("white background");
      search.clear(tSel + 0.02);
      const doneAt = search.type(b(27, 3), q, 0.22);
      search.keyTimes().filter((x) => x >= b(27, 3) && x <= doneAt + 0.01).forEach((x) => S.cue({ t: x, kind: "key", gain: 0.1 }));
      const list = viewList({ q });
      if (list[0].tag !== "white background") throw new Error(`搜尋「${q}」第一張應該是 white background：${list.map((k) => k.tag)}`);
      lib.view("q4", { q }, doneAt + 0.05, { tags: list.map((k) => k.tag), total: list.length });
      lib.enter.push({ tag: "white background", view: "q4", t0: doneAt + 0.35, t1: b(28, 3) + 0.05 });
      const tEnter = b(28, 3);
      keycaps([{ label: "Enter", t: tEnter, wide: true, tag: "放進池" }]);
      S.cue({ t: tEnter, kind: "key", gain: 0.22 });
      const from = lib.slot("q4", "white background");
      const tLand = tEnter + B * 1.05;
      const r = sim.pin("white background");
      const span = pool.add("white background", tLand, { mode: "fly", tClick: tEnter, tLand, from, lift: 110 });
      r.added.forEach((x, i) => {
        const s = pool.add(x, tLand + 0.42 + i * 0.16, { mode: "pop" });
        s.carriedBy = "white background";
      });
      S.cue({ t: tLand, kind: "stamp", gain: 0.26 }, { t: tLand + 0.42, kind: "pop", gain: 0.1, f: 420 });
      post.push(() => {
        const cc = SUIT_COLOR.scene;
        fx.trail({ path: (t) => arc(from, pool.slotPos(span, t), EZ.travel(seg(t, tEnter, tLand)), 110), t0: tEnter, t1: tLand, color: cc, size: 11 });
        const p = pool.slotPos(span, tLand);
        fx.ring({ x: p.x, y: p.y, t0: tLand, color: cc, r0: 40, r1: 130, w: 5 });
      });
      // 相剋：白背景跟櫻花同時成立不了（真的引擎算的），兩張描紅、抖一下，池子底下說一句。
      const pins = sim.list();
      const rels = relationsOf({ pins, carried: { "simple background": "white background" } }, { lex: env.lex, contradictions, actPlace: ACT_PLACE }).filter((x) => x.kind === "clash");
      if (!rels.length) throw new Error("白背景應該跟池裡的牌相剋");
      const [ra, rb] = [rels[0].a, rels[0].b];
      const tClash = tLand + 0.7;
      const others = new Set(rels.flatMap((x) => [x.a, x.b]));
      others.forEach((tg) => pool.marks.push({ tag: tg, kind: "clash", t0: tClash, t1: b(30, 0) }));
      const more = rels.length > 1 ? `（還有 ${rels.length - 1} 組）` : "";
      const html = `<em>相剋</em>「${zhOf(ra)}」跟「${zhOf(rb)}」同時成立不了，引擎會摘掉其中一個${more}`;
      noteAt(m, tClash, b(30, 1), html, { kind: "clash" });
      S.cue({ t: tClash, kind: "clash", gain: 0.1 });
      // 拿掉：指到牌右上角出現 ×，按下去
      const tX1 = b(29, 3);
      post.push(() => {
        const sp = pool.spans.find((s) => s.tag === "white background");
        const p = pool.slotPos(sp, tX1);
        pool.xs.push({ tag: "white background", t0: tX1 - 0.6, t1: tX1 + 0.1 });
        pen.moveTo(tX1, { x: p.x + 43, y: p.y - 65 }, { dur: 0.9 });
        cur.click(tX1);
        S.cue({ t: tX1, kind: "click", gain: 0.15 });
      });
      const un = sim.unpin("white background");
      pool.remove("white background", tX1 + 0.05, { mode: "home", to: lib.slot("q4", "white background"), dur: 0.6 });
      S.cue({ t: tX1 + 0.05, kind: "unwind", gain: 0.07, dur: 0.5 });
      void un;
      const tX2 = b(30, 1.5);
      post.push(() => {
        const sp = pool.spans.find((s) => s.tag === "simple background");
        const p = pool.slotPos(sp, tX2);
        pool.xs.push({ tag: "simple background", t0: tX2 - 0.5, t1: tX2 + 0.1 });
        pen.moveTo(tX2, { x: p.x + 43, y: p.y - 65 }, { dur: 0.7 });
        cur.click(tX2);
        S.cue({ t: tX2, kind: "click", gain: 0.15 });
      });
      sim.unpin("simple background");
      pool.remove("simple background", tX2 + 0.05, { mode: "lift" });
      step(3, "*相剋*：成立不了的，會描紅提醒你", "Clashes get flagged — clear them with ×", b(28, 0), b(30, 3));
    }
  }

  // 收尾：註冊每一格要畫的東西。
  const camMore = buildMochiPartB({ S, m, lib, pool, search, cur, fx, sim, post, pen, ctx, text, step, keycaps, gact, pinCard, clickAt });
  pool.finalize();
  pool.build();
  post.forEach((f) => f());
  S.act([0, 1e9], (t) => {
    search.render(t);
    lib.render(t);
    pool.render(t);
    cur.render(t);
    fx.render(t);
    m.frame.style.setProperty("--glare", `${((t * 22) % 260 - 60).toFixed(1)}%`);
  });

  /* ---------- 鏡頭 ---------- */
  const cam = calmTrack(
    [
      [T0 - 0.1, V(0, -60, zoomZ(0.5), 22, -34, -3)],
      [b(7, 0), focus(0, 0, 0.84, { rx: 4, ry: -7 }), EZ.out],
      [b(10, 1), focus(0, 0, 0.87, { rx: 2, ry: -2 })],
      [b(11, 1), focus(-220, -130, 1.55), EZ.inOut],
      [b(13, 3), focus(-200, -130, 1.55)],
      [b(14, 2), focus(-150, -150, 1.5), EZ.inOut],
      [b(16, 3), focus(-210, -160, 1.6), EZ.inOut],
      [b(20, 3), focus(-100, -170, 1.55), EZ.inOut],
      [b(22, 3), focus(-20, -160, 1.4), EZ.inOut],
      [b(23, 0), focus(-250, -130, 1.5), EZ.inOut],
      [b(23, 3), focus(-110, -170, 1.4), EZ.inOut],
      [b(24, 1.5), focus(30, -210, 1.65), EZ.inOut],
      [b(24, 3.6), focus(-30, -190, 1.5), EZ.inOut],
      [b(25, 1), focus(-250, -150, 1.5), EZ.inOut],
      [b(26, 0), focus(-110, -170, 1.4), EZ.inOut],
      [b(26, 1.5), focus(30, -170, 1.5), EZ.inOut],
      [b(27, 2), focus(-230, -150, 1.5), EZ.inOut],
      [b(28, 3), focus(-100, -170, 1.4), EZ.inOut],
      [b(29, 1), focus(120, -190, 1.55), EZ.inOut],
      [b(30, 3.9), focus(120, -190, 1.55)],
      ...camMore,
    ],
    { until: b(10, 1) }
  );
  S.cam = cam;
  S.tint = [0.62, 0.1, 200];
  return { S, m };
}
