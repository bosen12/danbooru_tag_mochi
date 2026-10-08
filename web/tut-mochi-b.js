/**
 * 墨池的教學（二）：規則、抽牌與生圖、成品牆、偏好卡牌與廢字簍。一在 tut-mochi-a.js。
 * 抽到什麼牌是真的引擎抽的（cleanDraws 用池裡現在的牌當釘選、挑乾淨的種子）；
 * 哪張牌放進池會擠掉誰，照 sim.pin（真的 applyPin）。成品圖是 ComfyUI 畫的那幾張（換色相當不同的張）。
 */
import { EZ, seg, lerp, spring, mk, put, setHTML, esc, env, box, label, cardEl, suitOf, zhOf, hasCard, K, arc, pressScale } from "./tut-kit.js";
import { b, B, POOL, LIBRARY, viewList, countOf, buildPool, TRAY, tipAt, toastAt, noteAt, ICON, segmented } from "./tut-mochi.js";
import { CH } from "./tut-chapters.js";
import { buildWall } from "./tut-wall.js";
import { replaceNote, focus, SUIT_COLOR } from "./tut-mochi-a.js";

/** 一個會變的值：events 是 [時間, 值]；tween(dur) 的話兩個值之間走過去。 */
function timeline(init) {
  const ev = [[-1e9, init]];
  return {
    set(t, v) {
      ev.push([t, v]);
      ev.sort((a, c) => a[0] - c[0]);
    },
    at(t) {
      let v = ev[0][1];
      for (const e of ev) if (e[0] <= t) v = e[1];
      return v;
    },
    /** 連續值：換值後 dur 秒內滑過去。 */
    glide(t, dur = 0.28) {
      let i = 0;
      while (i + 1 < ev.length && ev[i + 1][0] <= t) i++;
      const prev = i ? ev[i - 1][1] : ev[0][1];
      return lerp(prev, ev[i][1], EZ.inOut(seg(t, ev[i][0], ev[i][0] + dur)));
    },
  };
}

export function buildMochiPartB(P) {
  const { S, m, lib, pool, search, cur, fx, sim, post, pen, text, step, keycaps, pinCard, clickAt, ctx } = P;
  const { shared } = ctx;
  const wall = buildWall(m);
  const at = b;
  const camKeys = [];
  const cam = (t, x, y, s, rot, ease = EZ.inOut) => camKeys.push([t, focus(x, y, s, rot), ease]);
  const presses = [];
  const press = (el, ...ts) => presses.push([el, ts]);

  // 頁面往上捲的時候，桅杆（跟它上面的東西）要壓在頁面上面。
  for (const el of [...m.O.children]) if (el.classList.contains("tb") && parseFloat(el.style.top) < -380) el.style.zIndex = "30";
  cur.show(at(23), at(64, 3));

  const M2 = (pt, t) => m.toO(pt, t);
  /** 點頁面裡（會捲的那一塊）的一個位置。 */
  const clickM = (t, pt, o = {}) => clickAt(t, M2(pt, t), o);
  const nav = m.O.querySelector(".tnav");

  /* ---------- 會變的介面狀態 ---------- */
  const rating = timeline(0);
  const heat0 = timeline(false);
  const eraTx = timeline("現代");
  const eraMenu = []; // [t0, t1]
  const eraPick = timeline(-1);
  const who = timeline(0);
  const stepN = timeline(1);
  const infinite = timeline(false);
  const same = timeline(false);
  const status = timeline("");
  const stop = []; // [t0, t1]
  const seedMode = timeline(0);
  const seedTx = timeline("每張隨機");
  const trashN = timeline(0);
  const trashArm = [];
  const navFuse = timeline(false);

  const sumOf = (o) => countOf({ suit: "all", ...o });
  const n0 = sumOf({ rating: "general", era: "modern" });
  const n1 = sumOf({ rating: "sensitive", era: "modern" });
  const allView = lib.byId.get("all");
  const allTags = allView.cards.map((c) => c.tag);

  /* =====================================================================
   * 04 規則（bar 31–37）
   * ===================================================================== */
  {
    const c = CH.rules;
    text.chapter("04", c.zh, c.en, at(31, 0), at(32, 2));
    cam(at(31, 0), 150, -320, 1.55);
    cam(at(32, 0), -20, -130, 1.5);
    cam(at(33, 2), 130, -60, 1.6);
    cam(at(34, 1), -300, -190, 1.4);
    cam(at(35, 3), -100, -190, 1.4);

    // 分級：全年齡 → 敏感（字盒的數字變多）→ 回全年齡
    const tR1 = at(31, 2);
    clickAt(tR1, { x: m.ui.ratingX(1), y: -410 }, { dur: 0.7, bow: 0.12 });
    rating.set(tR1, 1);
    lib.view("r1", { suit: "all", rating: "sensitive" }, tR1 + 0.05, { tags: allTags, total: n1, tab: "all" });
    S.cue({ t: tR1 + 0.05, kind: "swell", gain: 0.05, dur: 0.6 });
    tipAt(m, `分級：全年齡 ${n0} → 敏感 ${n1} 張`, "", 340, -350, tR1 + 0.3, at(32, 1), { parent: m.O });
    const tR0 = at(32, 0.5);
    clickAt(tR0, { x: m.ui.ratingX(0), y: -410 }, { dur: 0.5 });
    rating.set(tR0, 0);
    lib.view("r0", { suit: "all" }, tR0 + 0.05, { tags: allTags, total: n0, tab: "all" });
    step(1, "*分級*：決定字盒看得到哪些牌", "Rating decides which cards you see", at(31, 0.5), at(33, 0));

    // 尺度：活動打開
    const tH = at(32, 2);
    clickM(tH, { x: m.ui.heat[0].x, y: m.ui.heat[0].y }, { dur: 0.7 });
    heat0.set(tH, true);
    press(m.ui.heat[0].el, tH);
    tipAt(m, "尺度：抽牌會出現到哪一種程度", "", m.ui.heat[1].x + 20, -150, tH + 0.2, at(33, 1), { up: false });
    S.cue({ t: tH, kind: "tick", gain: 0.1 });

    // 時代：下拉選單 → 江戶（字盒只留這個時代的牌）
    const tE = at(33, 0);
    clickM(tE, { x: m.ui.eraBtn.x, y: m.ui.eraBtn.y }, { dur: 0.65 });
    eraMenu.push([tE, at(33, 2.3)]);
    S.cue({ t: tE, kind: "pop", gain: 0.1, f: 400 });
    const tPick = at(33, 2);
    clickM(tPick, { x: 94, y: 89 }, { dur: 0.5 });
    eraPick.set(tPick - 0.3, 4);
    eraTx.set(tPick, "江戶");
    S.cue({ t: tPick, kind: "tick", gain: 0.12 });
    const edoTags = viewList({ era: "edo" }).slice(0, 20).map((k) => k.tag);
    lib.view("edo", { suit: "all", era: "edo" }, tPick + 0.05, { tags: edoTags, total: sumOf({ rating: "general", era: "edo" }), tab: "all" });
    tipAt(m, "時代：字盒只留江戶的牌", "", 94, -150, tPick + 0.3, at(34, 0), { up: false });

    // 人物：女 → 不限 → 女
    const tW1 = at(34, 0.5);
    clickM(tW1, { x: 232 + 3 + 46 * 2 + 23, y: -89 }, { dur: 0.6 });
    who.set(tW1, 2);
    const tW2 = at(34, 3);
    clickM(tW2, { x: 232 + 3 + 23, y: -89 }, { dur: 0.5 });
    who.set(tW2, 0);
    tipAt(m, "人物：女、男、不限", "", 280, -150, tW1 + 0.3, tW2, { up: false });

    // 搜尋 kimono：這個時代才找得到；放進池會把不同時代的牌（太陽裙…）換下來
    const tS = at(34, 3.4);
    clickAt(tS, { x: -580, y: -297 }, { dur: 0.6 });
    search.focusAt(tS, at(36, 3));
    search.clear(tS + 0.02);
    const tType = at(35, 0.4);
    const q = "kimono";
    const done = search.type(tType, q, 0.14);
    search.keyTimes().filter((x) => x >= tType && x <= done + 0.01).forEach((x) => S.cue({ t: x, kind: "key", gain: 0.1 }));
    const list = viewList({ q, era: "edo" });
    if (list[0]?.tag !== "kimono") throw new Error(`江戶的字盒搜尋 kimono 第一張應該是 kimono：${list.slice(0, 3).map((k) => k.tag)}`);
    lib.view("q5", { q, era: "edo" }, done + 0.05, { tags: list.map((k) => k.tag), total: list.length });
    lib.enter.push({ tag: "kimono", view: "q5", t0: done + 0.3, t1: at(35, 2.4) });
    const tEnter = at(35, 2);
    keycaps([{ label: "Enter", t: tEnter, wide: true, tag: "放進池" }]);
    S.cue({ t: tEnter, kind: "key", gain: 0.22 });
    const from = lib.slot("q5", "kimono");
    const tLand = tEnter + B * 1.05;
    const r = sim.pin("kimono");
    const span = pool.add("kimono", tLand, { mode: "fly", tClick: tEnter, tLand, from, lift: 110 });
    r.removed.forEach((x) => pool.remove(x, tLand + 0.03, { mode: "lift" }));
    r.added.forEach((x, i) => {
      const s = pool.add(x, tLand + 0.42 + i * 0.16, { mode: "pop" });
      s.carriedBy = "kimono";
      S.cue({ t: tLand + 0.42 + i * 0.16, kind: "pop", gain: 0.1, f: 420 + i * 90 });
    });
    if (!r.removed.length) throw new Error("kimono 放進池，應該把別的時代的牌換下來（太陽裙之類）");
    S.cue({ t: tLand, kind: "stamp", gain: 0.26 }, { t: tLand + 0.03, kind: "unwind", gain: 0.07, dur: 0.5 });
    search.select(tEnter + 0.05);
    post.push(() => {
      const cc = SUIT_COLOR.wear;
      fx.trail({ path: (t) => arc(from, pool.slotPos(span, t), EZ.travel(seg(t, tEnter, tLand)), 110), t0: tEnter, t1: tLand, color: cc, size: 11 });
      const p = pool.slotPos(span, tLand);
      fx.ring({ x: p.x, y: p.y, t0: tLand, color: cc, r0: 40, r1: 130, w: 5 });
      fx.sparks({ x: p.x, y: p.y, t0: tLand, n: 10, r: 70, color: cc, seed: 13 });
    });
    noteAt(m, tLand + 0.2, at(36, 3.6), replaceNote("kimono", r.removed), { kind: "swap" });
    step(2, "*時代*不同的牌放不到一起：新的來，舊的先拿下", "Cards from different eras don't mix", at(33, 0), at(36, 3));
    text.say("這是規則在幫你擋掉會壞掉的組合", "Rules keep impossible combinations out", at(36, 0.3), at(36, 3.6));
  }

  /* =====================================================================
   * 05 抽牌與生圖（bar 37–48）
   * ===================================================================== */
  const art = [shared.art.mochi, shared.art.fuseA, shared.art.fuseB, shared.art.fuseC];
  const artAt = (i) => art[i % art.length];
  const hueAt = (i) => [0, 0, 0, 0, 14, -12, 22, -22, 8][i % 9];
  const edoSettings = { ...env.settings, eras: ["edo"] };
  const pinsNow = () => sim.list();
  const makeDraws = (n, from) => {
    const d = shared.idata.cleanDraws(shared.ENG, env.lex, edoSettings, pinsNow(), n, from);
    if (!d.length) throw new Error("抽不到乾淨的種子");
    return Array.from({ length: n }, (_, i) => d[i % d.length]);
  };
  const shotSpec = (draw, i) => {
    const pins = pinsNow();
    const mine = pins.filter(hasCard);
    const drawn = draw.tags.filter((t) => !pins.includes(t) && hasCard(t));
    return { seed: draw.seed, era: "江戶", mine: mine.slice(0, 7), drawn: drawn.slice(0, 18), fan: drawn, img: artAt(i), hue: hueAt(i), n: i };
  };
  const allShots = [];
  let shotN = 0;
  const addShot = (draw, t, o = {}) => {
    const spec = { ...shotSpec(draw, shotN++), tCreate: t, tRun1: t + 3.4, ...o };
    const sh = wall.add(spec);
    S.cue({ t: t + 0.05, kind: "pop", gain: 0.09, f: 460 }, { t: spec.tRun1, kind: "sparkle", gain: 0.06 });
    allShots.push(sh);
    return sh;
  };

  {
    const c = CH.draw;
    text.chapter("05", c.zh, c.en, at(37, 0), at(38, 2));
    cam(at(37, 0), 150, -110, 1.35);
    wall.scroll(at(37, 0.4), 150, 0.9);
    S.cue({ t: at(37, 0.4), kind: "whoosh", gain: 0.06, dur: 0.9 });

    // 只抽牌（P）→ 草稿：一把扇子 → 送去印這張
    const draws = makeDraws(8, 1);
    const tP = at(37, 3);
    clickM(tP, m.ui.pPos, { dur: 0.9 });
    press(m.ui.pBtn, tP);
    keycaps([{ label: "P", t: tP, tag: "只抽牌" }]);
    S.cue({ t: tP, kind: "key", gain: 0.2 });
    status.set(tP, "抽牌中…");
    status.set(tP + 0.5, "");
    const tDraft = tP + 0.4;
    const tSend = at(39, 1);
    const draft = addShot(draws[0], tDraft, { kind: "draft", tSend, tRun0: tSend + 0.05, tRun1: tSend + 3.6 });
    step(1, "*只抽牌*：先看抽到什麼，滿意再印", "Draw only — look first, print later", at(37, 0.5), at(39, 3));
    cam(at(38, 2), 220, -10, 1.45);
    // 游標去按「送去印這張」
    const tHover = tSend - 0.3;
    pen.wait(tHover);
    clickAt(tSend, M2(wall.anchor(draft, "send", tSend), tSend), { dur: 0.9 });
    status.set(tSend, "印製中…");
    status.set(tSend + 3.7, "");
    S.cue({ t: tSend, kind: "click", gain: 0.16 }, { t: tSend + 0.1, kind: "swell", gain: 0.05, dur: 1.4 });

    // 一次抽三張（＋、＋），G：抽並生圖
    const tPlus1 = at(41, 0);
    const tPlus2 = at(41, 1.6);
    clickM(tPlus1, m.ui.stepPlus, { dur: 0.9 });
    stepN.set(tPlus1, 2);
    press(m.ui.stepper, tPlus1);
    clickM(tPlus2, m.ui.stepPlus, { dur: 0.4 });
    stepN.set(tPlus2, 3);
    S.cue({ t: tPlus1, kind: "tick", gain: 0.12 }, { t: tPlus2, kind: "tick", gain: 0.12, f: 520 });
    cam(at(40, 3), 60, -50, 1.5);
    const tG = at(42, 0);
    keycaps([{ label: "G", t: tG, tag: "抽並生圖" }]);
    clickM(tG, m.ui.gPos, { dur: 0.6 });
    press(m.ui.gBtn, tG);
    S.cue({ t: tG, kind: "key", gain: 0.2 });
    status.set(tG, "印製中…");
    status.set(tG + 4.8, "");
    [0, 1, 2].forEach((k) => addShot(draws[1 + k], tG + 0.15 + k * 0.32, { tRun1: tG + 3.0 + k * 0.9 }));
    step(2, "*一次*抽幾張，*G* 抽完就生圖", "Set how many — G draws and prints", at(40, 2), at(43, 0));
    cam(at(42, 1), 200, -40, 1.25);
  }
  {
    // 無限抽：一張接一張，按停
    const draws = makeDraws(8, 40);
    const tInf = at(43, 0);
    clickM(tInf, m.ui.infiniteBtn, { dur: 0.8 });
    press(m.ui.infinite, tInf);
    infinite.set(tInf, true);
    S.cue({ t: tInf, kind: "click", gain: 0.14 }, { t: tInf + 0.1, kind: "swell", gain: 0.05, dur: 2.4 });
    status.set(tInf, "無限抽中…");
    stop.push([tInf + 0.3, at(45, 3)]);
    const spawn = [at(43, 2), at(44, 0.5), at(44, 3), at(45, 1.5)];
    spawn.forEach((t, k) => addShot(draws[k], t, { tRun1: t + 3.0 }));
    step(3, "*無限抽*：一張接一張，按停就停", "Infinite draw — keep going until you stop", at(43, 0), at(45, 3));
    cam(at(43, 0), 260, -30, 1.3);
    const tStop = at(45, 2.5);
    keycaps([{ label: "Esc", t: tStop, wide: true, tag: "停" }]);
    clickM(tStop, m.ui.stopPos, { dur: 1.0 });
    press(m.ui.stopBtn, tStop);
    S.cue({ t: tStop, kind: "key", gain: 0.2 });
    infinite.set(tStop, false);
    status.set(tStop, "已停");
    status.set(tStop + 1.6, "");
  }
  {
    // 同一個人＋固定種子
    const tSame = at(46, 1);
    cam(at(45, 3.5), -20, -20, 1.55);
    clickM(tSame, m.ui.sameBtn, { dur: 0.9 });
    press(m.ui.same, tSame);
    same.set(tSame, true);
    S.cue({ t: tSame, kind: "click", gain: 0.14 });
    const tFix = at(46, 3);
    clickM(tFix, m.ui.seedFixBtn, { dur: 0.7 });
    seedMode.set(tFix, 1);
    seedTx.set(tFix + 0.1, "2026");
    S.cue({ t: tFix, kind: "click", gain: 0.14 });
    step(4, "*同一個人*、*固定種子*：換場景不換人", "Same person, fixed seed — new scenes, same face", at(46, 0), at(48, 0));
    tipAt(m, "換場景，人不變", "", 0, 60, tSame + 0.3, at(47, 2), { up: true });
    const draws = makeDraws(3, 90);
    const tG2 = at(47, 1);
    keycaps([{ label: "G", t: tG2, tag: "抽並生圖" }]);
    clickM(tG2, m.ui.gPos, { dur: 0.9 });
    press(m.ui.gBtn, tG2);
    S.cue({ t: tG2, kind: "key", gain: 0.2 });
    cam(at(47, 0.2), 220, -30, 1.3);
    [0, 1, 2].forEach((k) => addShot(draws[k], tG2 + 0.15 + k * 0.3, { tRun1: tG2 + 2.2 + k * 0.5, hue: [0, 8, -8][k], img: artAt(0), flag: "同一個人" }));
  }

  /* =====================================================================
   * 06 成品牆（bar 48–57）
   * ===================================================================== */
  const first = () => allShots[allShots.length - 3]; // 最後一批裡最先印的那張（最前面那排的第一張要用最新的）
  {
    const c = CH.wall;
    text.chapter("06", c.zh, c.en, at(48, 0), at(49, 2));
    // 用最新一批的第一張（擺在牆的最前面）示範。
    const sh = allShots[allShots.length - 1];
    const mineN = sh.mine.length;
    wall.scroll(at(48, 0), 700, 1.0);
    S.cue({ t: at(48, 0), kind: "whoosh", gain: 0.06, dur: 1 });
    cam(at(48, 0), 60, 40, 1.3);
    cam(at(48, 3), -150, 130, 1.7);
    const tTog = at(48, 3);
    clickM(tTog, wall.anchor(sh, "toggle", tTog), { dur: 0.9 });
    press(sh.toggle, tTog);
    sh.pressToggle = [tTog];
    const panelEnd = at(53, 2);
    const panel = wall.expand(sh, tTog + 0.05, panelEnd);
    S.cue({ t: tTog + 0.05, kind: "swell", gain: 0.04, dur: 0.5 });
    step(1, "*牌 · N*：這張圖用了哪些牌", "Every print keeps its cards", at(48, 1), at(50, 0));
    cam(at(49, 0), -160, 190, 1.85);

    const drawnCards = panel.cards.filter((k) => k.i >= mineN && !sim.has(k.tag));
    if (drawnCards.length < 2) throw new Error("展開的牌裡至少要有兩張抽到的");
    /** 從展開的牌抓一張、拖到別處（螢幕座標，不跟頁面捲）。 */
    const ghostFor = (tag, tGrab, tRelease, tGone, endAt) => {
      const g = cardEl(tag, LIBRARY.w, m.O);
      g.style.zIndex = "60";
      const from = M2(wall.panelCard(panel, tag, tGrab), tGrab);
      S.act([tGrab - 0.05, tGone + 0.3], (t) => {
        const c0 = cur.at(t);
        const grab = EZ.out(seg(t, tGrab, tGrab + 0.2));
        if (t < tRelease) {
          const vx = (c0.x - cur.at(t - 0.05).x) / 0.05;
          const rz = Math.max(-14, Math.min(14, vx * 0.012));
          put(g, { x: lerp(from.x, c0.x, grab), y: lerp(from.y, c0.y + 8, grab), rz: rz * grab, s: lerp(46 / LIBRARY.w, 1.12, grab), o: 1 });
        } else if (endAt) {
          const p = EZ.in(seg(t, tRelease, tGone));
          put(g, { x: lerp(c0.x, endAt.x, p), y: lerp(c0.y + 8, endAt.y, p), rz: p * 220, s: lerp(1.12, 0.05, p), o: 1 - EZ.exit(seg(p, 0.7, 1)) });
        } else put(g, { x: c0.x, y: c0.y, s: 1, o: 0 });
      }, g);
      wall.panelDrag.push({ tag, t0: tGrab, t1: tGone });
      return from;
    };

    // ① 拖進合成池：拖到畫面邊緣，頁面自己往上捲
    {
      const tag = drawnCards[0].tag;
      const tGrab = at(49, 3);
      const tEdge = at(50, 1.6);
      const tDrop = at(51, 0.6);
      const from = ghostFor(tag, tGrab, tDrop, tDrop, null);
      pen.moveTo(tGrab, from, { dur: 0.7 });
      cur.click(tGrab);
      cur.hold(tGrab, tDrop);
      pen.moveTo(tEdge, { x: -40, y: -395 }, { dur: 0.9, bow: 0.05 });
      wall.scroll(tEdge, 0, 1.5);
      S.cue({ t: tGrab, kind: "click", gain: 0.15 }, { t: tEdge, kind: "whoosh", gain: 0.07, dur: 1.4 });
      const target = { x: POOL.cx + 110, y: POOL.y };
      pen.moveTo(tDrop, target, { dur: 0.7, bow: 0.05 });
      const r = sim.pin(tag);
      const tLand = tDrop + 0.5;
      const span = pool.add(tag, tLand, { mode: "fly", tClick: tDrop, tLand, from: target, lift: 30 });
      r.removed.forEach((x) => pool.remove(x, tLand + 0.03, { mode: "lift" }));
      r.added.forEach((x, i) => pool.add(x, tLand + 0.42 + i * 0.16, { mode: "pop" }).carriedBy = tag);
      S.cue({ t: tDrop, kind: "click", gain: 0.12 }, { t: tLand, kind: "stamp", gain: 0.28 });
      S.act([tEdge, tLand + 0.2], (t) => m.ui.poolWell.classList.toggle("over", t >= tEdge + 1.1 && t < tDrop + 0.05));
      post.push(() => {
        const p = pool.slotPos(span, tLand);
        const cc = SUIT_COLOR[suitOf(tag)];
        fx.ring({ x: p.x, y: p.y, t0: tLand, color: cc, r0: 40, r1: 130, w: 5 });
        fx.sparks({ x: p.x, y: p.y, t0: tLand, n: 12, r: 80, color: cc, seed: 21 });
      });
      step(2, "*拖進合成池*：以後每張圖都有這張", "Drag a drawn card into the pool", at(49, 2), at(51, 3));
      tipAt(m, "拖到畫面邊緣，頁面自己捲", "", 330, -330, tEdge + 0.2, tEdge + 1.6, { parent: m.O, up: true });
      cam(at(50, 0), -30, -120, 1.15);
      cam(at(51, 0), 60, -160, 1.4);
    }

    // ② 丟進廢字簍：這張牌以後不再抽到
    {
      const tag = drawnCards[1].tag;
      wall.scroll(at(51, 2), 700, 1.0);
      cam(at(51, 3), 280, 80, 1.15);
      const tGrab = at(52, 1);
      const tDrop = at(53, 0);
      const trash = m.ui.trashPos;
      const from = ghostFor(tag, tGrab, tDrop, tDrop + 0.55, trash);
      pen.moveTo(tGrab, from, { dur: 0.9 });
      cur.click(tGrab);
      cur.hold(tGrab, tDrop);
      pen.moveTo(tDrop, { x: trash.x, y: trash.y - 10 }, { dur: 0.9, bow: 0.1 });
      trashArm.push([tDrop - 0.45, tDrop + 0.5]);
      trashN.set(tDrop + 0.5, 1);
      S.cue({ t: tGrab, kind: "click", gain: 0.15 }, { t: tDrop + 0.3, kind: "unwind", gain: 0.1, dur: 0.5 }, { t: tDrop + 0.55, kind: "stamp", gain: 0.16 });
      step(3, "*丟進廢字簍*：這張牌不會再被抽到", "Toss it in the bin — never drawn again", at(51, 3), at(53, 3));
      post.push(() => fx.ring({ x: trash.x, y: trash.y, t0: tDrop + 0.5, color: "#e5583a", r0: 30, r1: 100, w: 4 }));
      wall.panelDrag.push({ tag, t0: tGrab, t1: tDrop + 0.55 });
    }

    // ③ Hires、複製 POS
    {
      const tHi = at(54, 0);
      cam(at(53, 2), 0, 20, 1.25);
      sh.pressHires = [tHi];
      clickM(tHi, wall.anchor(sh, "hires", tHi), { dur: 1.0 });
      sh.hires = { t0: tHi + 0.3, t1: tHi + 3.0, scale: 2, w: 1664, h: 2432 };
      S.cue({ t: tHi, kind: "click", gain: 0.15 }, { t: tHi + 0.35, kind: "swell", gain: 0.06, dur: 2.7 }, { t: sh.hires.t1, kind: "sparkle", gain: 0.08 });
      step(4, "*Hires*：同一張，畫得更細", "Hires — the same image, more detail", at(53, 3), at(55, 3));
      const tCp = at(55, 3);
      sh.pressCopy = [tCp];
      clickM(tCp, wall.anchor(sh, "copy", tCp), { dur: 0.8 });
      S.cue({ t: tCp, kind: "click", gain: 0.14 }, { t: tCp + 0.05, kind: "tick", gain: 0.1 });
      text.say("*複製 POS*：整組提示詞帶走，*同種子重印*：一樣的圖再來一張", "Copy the prompt · reprint with the same seed", at(55, 1), at(57, 0));
    }

    // ④ 撤下 → 提示條 → Z 復原
    {
      const tRm = at(56, 0);
      const tZ = at(56, 3);
      cam(at(55, 3.5), 0, 60, 1.25);
      sh.pressRemove = [tRm];
      clickM(tRm, wall.anchor(sh, "remove", tRm), { dur: 0.8 });
      sh.tRemove = tRm + 0.05;
      sh.tRestore = tZ + 0.1;
      toastAt(m, tRm + 0.3, tZ + 0.5, "撤下了一張成品", { action: "復原", key: "Z", pressAt: tZ });
      keycaps([{ label: "Z", t: tZ, tag: "復原" }]);
      S.cue({ t: tRm, kind: "click", gain: 0.14 }, { t: tRm + 0.1, kind: "unwind", gain: 0.08, dur: 0.5 }, { t: tZ, kind: "key", gain: 0.2 }, { t: tZ + 0.1, kind: "pop", gain: 0.12, f: 380 });
      pen.wait(tZ);
    }
  }

  /* =====================================================================
   * 07 偏好卡牌與廢字簍、換到疊印台（bar 57–64）
   * ===================================================================== */
  {
    const c = CH.tray;
    text.chapter("07", c.zh, c.en, at(57, 0), at(58, 2));
    wall.scroll(at(57, 0), 0, 1.0);
    cam(at(57, 0), 20, -40, 1.0);
    cam(at(58, 0), -250, 20, 1.3);
    cam(at(60, 1), 20, 90, 1.1);
    // 偏好卡牌托盤（在畫面底部，不跟頁面捲）
    const trayBox = box(m.O, "tb ttray", -410, 258, 860, 190, "");
    trayBox.style.opacity = "0";
    trayBox.style.zIndex = "3";
    const trayTitle = mk("div", "tb tab", trayBox, `偏好卡牌<small>0 / 10 · 拖牌進來收藏，一鍵送進池子</small>`);
    Object.assign(trayTitle.style, { left: "22px", top: "14px" });
    const tray = buildPool(m, lib, { ...TRAY, parent: m.O, main: false, z: "12" });
    tray.el = tray.el; // 讓 lint 知道我們用了它
    const trayOpen = [at(57, 2), at(63, 0)];
    const handN = timeline(0);

    const tHand = at(57, 2);
    clickAt(tHand, M2(m.ui.handPos, tHand), { dur: 0.8 });
    press(m.ui.handBtn, tHand);
    S.cue({ t: tHand, kind: "click", gain: 0.14 }, { t: tHand + 0.05, kind: "swell", gain: 0.05, dur: 0.6 });
    step(1, "*偏好卡牌*：常用的牌先收起來", "Favorites — keep the cards you love", at(57, 1), at(60, 0));

    // 從字盒拖兩張進去
    const tTab = at(58, 1);
    lib.view("hand", { suit: "look" }, tTab + 0.05, { tab: "look" });
    search.clear(tTab);
    clickAt(tTab, m.ui.tabPos.look, { dur: 0.6 });
    const picks = lib.byId.get("hand").cards.map((k) => k.tag).filter((t) => !sim.has(t)).slice(0, 3);
    picks.forEach((tag, k) => {
      const from = lib.slot("hand", tag);
      const tGrab = at(58, 3 + k * 1.6 - (k > 1 ? 0.6 : 0));
      const tDrop = tGrab + 0.95;
      const tLand = tDrop + 0.45;
      pen.moveTo(tGrab, from, { dur: 0.5 });
      cur.click(tGrab);
      cur.hold(tGrab, tDrop);
      pen.moveTo(tDrop, { x: 20 + (k - 1) * 90, y: 350 }, { dur: 0.7, bow: 0.08 });
      lib.drag.push({ tag, view: "hand", t0: tGrab, t1: tLand });
      tray.add(tag, tLand, { mode: "drag", tGrab, tDrop, tLand, from, cur });
      handN.set(tLand, k + 1);
      S.cue({ t: tGrab, kind: "click", gain: 0.14 }, { t: tLand, kind: "stamp", gain: 0.22 });
    });
    lib.byId.get("hand").cards.forEach(() => 0);

    // 出牌：點托盤裡的牌 → 飛進合成池（托盤裡還留著）
    const outTag = picks[1];
    const tOut = at(61, 0);
    step(2, "*出牌*：點一下，牌飛進合成池", "Play a card — it flies to the pool", at(60, 2), at(62, 0));
    {
      const trayCard = () => tray.slotPos(tray.spans.find((s) => s.tag === outTag), tOut);
      // 托盤的位置要等排版好才知道 → post
      post.push(() => {
        const fromP = trayCard();
        pen.moveTo(tOut, { x: fromP.x, y: fromP.y - 20 }, { dur: 0.9, bow: 0.1 });
        cur.click(tOut);
        S.cue({ t: tOut, kind: "click", gain: 0.15 });
      });
      const r = sim.pin(outTag);
      const tLand = tOut + B * 1.05;
      const pFrom = { x: 20 + 0 * 90, y: 372 };
      const span = pool.add(outTag, tLand, { mode: "fly", tClick: tOut, tLand, from: pFrom, lift: 150 });
      r.removed.forEach((x) => pool.remove(x, tLand + 0.03, { mode: "lift" }));
      r.added.forEach((x, i) => pool.add(x, tLand + 0.42 + i * 0.16, { mode: "pop" }).carriedBy = outTag);
      S.cue({ t: tLand, kind: "stamp", gain: 0.26 });
      post.push(() => {
        const p = pool.slotPos(span, tLand);
        const cc = SUIT_COLOR[suitOf(outTag)];
        fx.ring({ x: p.x, y: p.y, t0: tLand, color: cc, r0: 40, r1: 130, w: 5 });
        fx.sparks({ x: p.x, y: p.y, t0: tLand, n: 10, r: 70, color: cc, seed: 31 });
      });
      cam(at(61, 2), 20, -20, 1.05);
    }

    // 清空 → 提示條 → Z
    {
      trayOpen[1] = at(62, 0);
      const tCl = at(62, 1);
      const tZ = at(63, 0);
      clickM(tCl, m.ui.clearBtn, { dur: 1.0 });
      press(m.ui.clear, tCl);
      // 池裡現在有的牌都飄走，Z 之後一張張彈回來
      const alive = pool.alive(tCl).map((s) => s.tag);
      const outs = alive.map((tag, i) => pool.remove(tag, tCl + 0.05 + i * 0.06, { mode: "lift" }));
      void outs;
      alive.forEach((tag, i) => pool.add(tag, tZ + 0.2 + i * 0.09, { mode: "pop" }));
      post.push(() =>
        fx.scrolled(() =>
          fx.add(tCl, tCl + 0.7, (g, t, e) => {
            const p = EZ.out(e / 0.7);
            g.globalAlpha = (1 - p) * 0.5;
            const grd = g.createLinearGradient(-330 + p * 1100, 0, -260 + p * 1100, 0);
            grd.addColorStop(0, "rgba(255,255,255,0)");
            grd.addColorStop(1, "rgba(255,255,255,0.9)");
            g.fillStyle = grd;
            g.fillRect(-333, -307, 1090, 165);
            g.globalAlpha = 1;
          })
        )
      );
      toastAt(m, tCl + 0.3, tZ + 0.5, `清空了 ${alive.length} 張`, { action: "復原", key: "Z", pressAt: tZ });
      keycaps([{ label: "Z", t: tZ, tag: "復原" }]);
      S.cue({ t: tCl, kind: "click", gain: 0.14 }, { t: tCl + 0.1, kind: "whoosh", gain: 0.1, dur: 0.6 }, { t: tZ, kind: "key", gain: 0.2 }, { t: tZ + 0.25, kind: "pop", gain: 0.1, f: 400 });
      step(3, "*清空*不怕手滑：*Z* 全部救回來", "Clear is safe — Z brings everything back", at(62, 0), at(63, 3));
      cam(at(61, 3), 20, -110, 1.1);
      cam(at(63, 1), 20, -60, 1.0);
      pen.wait(tZ);
    }

    // 換到疊印台
    {
      const tNav = at(64, 0.6);
      cur.show(at(63, 3), at(65, 2));
      clickAt(tNav, m.ui.navFuse, { dur: 1.1, bow: 0.12 });
      navFuse.set(tNav, true);
      S.cue({ t: tNav, kind: "click", gain: 0.16 }, { t: tNav + 0.05, kind: "sparkle", gain: 0.08 });
      cam(at(64, 0), -420, -300, 1.7);
      cam(at(65, 1), -420, -320, 2.4, { rz: -2 });
      text.say("再來，換*疊印台*", "Next: the Overprint bench", at(64, 0.6), at(65, 3));
    }

    // 托盤每一格的畫面（開合、張數）
    S.act([0, 1e9], (t) => {
      const on = t >= trayOpen[0] && t < trayOpen[1] + 0.4;
      const p = EZ.out(seg(t, trayOpen[0], trayOpen[0] + 0.5)) * (1 - EZ.exit(seg(t, trayOpen[1], trayOpen[1] + 0.35)));
      trayBox.style.opacity = on ? p.toFixed(3) : "0";
      trayBox.style.transform = `translateY(${((1 - p) * 60).toFixed(1)}px)`;
      const n = handN.at(t);
      setHTML(trayTitle, `偏好卡牌<small>${n} / 10 · 拖牌進來收藏，一鍵送進池子</small>`);
      const hb = m.ui.handBtn.querySelector("b");
      if (hb) hb.textContent = `${n}/10`;
    });
    // 托盤裡的牌要等排版（finalize）之後才畫：先登記
    P.trayFinalize = () => {
      tray.finalize();
      tray.build();
    };
    S.act([0, 1e9], (t) => tray.render(t));
  }
  P.trayFinalize();
  wall.finalize();

  /* ---------- 每一格：介面狀態、成品牆 ---------- */
  S.act([0, 1e9], (t) => {
    wall.render(t);
    m.ui.rating.slide(rating.glide(t));
    m.ui.heat[0].el.classList.toggle("on", heat0.at(t));
    const eraSpan = m.ui.era.querySelector("span");
    setHTML(eraSpan, esc(eraTx.at(t)));
    const menuOn = eraMenu.some(([a, c]) => t >= a && t < c);
    m.ui.eraMenu.style.display = menuOn ? "" : "none";
    if (menuOn) {
      [...m.ui.eraMenu.children].forEach((it, i) => {
        it.classList.toggle("on", i === eraPick.at(t));
        it.style.opacity = EZ.out(seg(t, eraMenu[0][0] + i * 0.03, eraMenu[0][0] + 0.2 + i * 0.03)).toFixed(3);
      });
    }
    m.ui.who.slide(who.glide(t));
    m.ui.stepVal.textContent = String(stepN.at(t));
    m.ui.gCount.textContent = `×${stepN.at(t)}`;
    m.ui.infinite.classList.toggle("on", infinite.at(t));
    m.ui.same.classList.toggle("on", same.at(t));
    setHTML(m.ui.status, esc(status.at(t)));
    const stopOn = stop.some(([a, c]) => t >= a && t < c);
    m.ui.stopBtn.style.display = stopOn ? "" : "none";
    m.ui.handBtn.style.visibility = stopOn ? "hidden" : "visible";
    m.ui.seedSeg.slide(seedMode.glide(t));
    setHTML(m.ui.seedTx, esc(seedMode.at(t) ? seedTx.at(t) : "每張隨機"));
    m.ui.seedInput.style.opacity = seedMode.at(t) ? "1" : "0.55";
    const n = trashN.at(t);
    setHTML(m.ui.trashN, String(n));
    m.ui.trash.classList.toggle("armed", trashArm.some(([a, c]) => t >= a && t < c));
    m.ui.trash.style.transform = trashArm.some(([a, c]) => t >= c - 0.05 && t < c + 0.3) ? `scale(${(1 + spring(t - (trashArm.find(([a, c]) => t >= c - 0.05 && t < c + 0.3)?.[1] ?? 0) + 0.05, 0.12, 8, 18)).toFixed(3)})` : "";
    const first0 = allShots[0];
    m.ui.wallEmpty.style.opacity = first0 ? (1 - EZ.out(seg(t, first0.tCreate, first0.tCreate + 0.3))).toFixed(3) : "1";
    nav.children[0].classList.toggle("on", !navFuse.at(t));
    nav.children[1].classList.toggle("on", navFuse.at(t));
    for (const [el, ts] of presses) {
      let s = 1;
      for (const a of ts) s *= pressScale(t, a);
      el.style.transform = s === 1 ? "" : `scale(${s.toFixed(4)})`;
    }
  });
  void first;
  return camKeys;
}
