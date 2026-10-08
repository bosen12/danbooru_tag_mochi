/**
 * 教學影片裡墨池的成品牆：一張張成品（只抽牌的草稿、印製中、顯影、印好），
 * 「牌 · N」展開的那一疊牌、撤下與復原、Hires。頁面會捲（wall.scroll），特效跟著捲。
 * 每一張成品照時間演：spec 寫它什麼時候出現、什麼時候送去印、什麼時候印好；牆自己排位置（新的排最前面）。
 * 位置在 M（會跟著頁面捲）的座標；游標在螢幕座標，用 m.toO(P, t) 換算。
 */
import { EZ, seg, lerp, spring, mk, put, setHTML, esc, env, box, cardEl, suitOf, zhOf } from "./tut-kit.js";

export const WALL = { x0: -350, y0: 161, colPitch: 387, rowPitch: 692, w: 363, h: 530 };
const SUIT_ORDER = ["cast", "look", "wear", "pose", "scene", "style"];

/** 排位置：每次有東西出現／消失，其他的滑到新的位置（新的排最前面）。回傳 sh → 位置關鍵點。 */
function reflowKeys(shots, posOf, lag = 0.06) {
  const alive = (sh) => {
    const w = [[sh.tCreate, sh.tRemove ?? Infinity]];
    if (sh.tRestore != null) w.push([sh.tRestore, Infinity]);
    return w;
  };
  const evs = new Set();
  for (const sh of shots) for (const [a, b2] of alive(sh)) {
    evs.add(a);
    if (b2 !== Infinity) evs.add(b2);
  }
  const keys = new Map(shots.map((sh) => [sh, []]));
  for (const t of [...evs].sort((a, b2) => a - b2)) {
    const live = shots.filter((sh) => alive(sh).some(([a, b2]) => t + 1e-6 >= a && t + 1e-6 < b2)).sort((x, y) => y.order - x.order);
    live.forEach((sh, i) => keys.get(sh).push([t + lag, posOf(i, live.length)]));
  }
  return keys;
}

export function buildWall(m) {
  const { M, S } = m;
  const wall = { shots: [], scrollKeys: [[0, 0]], last: 0 };
  const posOf = (i) => ({ x: WALL.x0 + (i % 3) * WALL.colPitch, y: WALL.y0 + Math.floor(i / 3) * WALL.rowPitch });

  /* ---------- 頁面捲動 ---------- */
  wall.scroll = (t, y, dur = 0.8) => {
    wall.scrollKeys.push([t, wall.last], [t + dur, y]);
    wall.last = y;
  };
  wall.scrollAt = (t) => {
    const ks = wall.scrollKeys;
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        const [t0, y0] = ks[i - 1];
        const [t1, y1] = ks[i];
        return t1 === t0 ? y1 : lerp(y0, y1, EZ.inOut(seg(t, t0, t1)));
      }
    }
    return ks[ks.length - 1][1];
  };
  m.scrollAt = wall.scrollAt;
  m.fx.scrollFn = wall.scrollAt;
  m.toO = (P, t) => ({ x: P.x, y: P.y - wall.scrollAt(t) });

  /* ---------- 一張成品 ---------- */
  wall.add = (spec) => {
    const sh = { ...spec, order: wall.shots.length };
    const el = mk("div", "tb tshot", M);
    el.style.left = "0";
    el.style.top = "0";
    el.style.width = WALL.w + "px";
    el.style.height = "660px";
    el.style.display = "none";
    const frame = mk("div", "tframe", el);
    Object.assign(frame.style, { left: "0", top: "0", width: WALL.w + "px", height: WALL.h + "px" });
    const img = mk("img", "", frame);
    img.src = spec.img;
    img.alt = "";
    if (spec.hue) img.dataset.hue = spec.hue;
    img.style.opacity = "0";
    if (spec.n % 2 === 1 && !spec.flag) img.style.transform = "scaleX(-1)";
    const draft = mk("div", "draft", frame);
    let fan = null;
    if (spec.kind === "draft") {
      fan = mk("div", "tb", draft);
      fan.style.left = "0";
      fan.style.top = "0";
      const tags = (spec.fan || []).slice(0, 7);
      sh.fanCards = tags.map((tag, i) => {
        const c = cardEl(tag, 104, fan);
        const off = i - (tags.length - 1) / 2;
        put(c, { x: 181 + off * 44, y: 190 + off * off * 5, rz: off * 7.5, s: 1 });
        c.style.zIndex = String(10 + i);
        return c;
      });
      mk("p", "tb tl", draft, "只抽了牌，還沒送去印").style.cssText += ";left:0;right:0;top:335px;text-align:center;font:500 16px/1 var(--font-body);color:var(--color-ink-2)";
      sh.sendBtn = mk("div", "tb tbtn pri sm", draft, "送去印這張");
      Object.assign(sh.sendBtn.style, { left: "116px", top: "408px", width: "131px", height: "36px" });
    }
    const prog = mk("div", "tprog", frame, "<i></i>");
    prog.style.opacity = "0";
    const veil = mk("div", "tb", frame);
    Object.assign(veil.style, { left: "0", right: "0", bottom: "0", height: "120px", background: "linear-gradient(transparent, rgb(0 0 0 / 0.78))", opacity: "0", display: "flex", alignItems: "flex-end", padding: "0 16px 18px", font: "700 17px/1 var(--font-display)", color: "#fff", boxSizing: "border-box", width: WALL.w + "px" });
    const scan = mk("i", "hi-scan", frame);
    scan.style.opacity = "0";
    const sizeTag = mk("div", "hi-tag", frame);
    sizeTag.style.opacity = "0";
    const same = spec.flag ? mk("div", "tb tbtn sm", frame, esc(spec.flag)) : null;
    if (same) Object.assign(same.style, { left: "12px", top: "12px", height: "26px", padding: "0 10px", background: "var(--color-accent-2)", borderColor: "var(--color-accent)", color: "#fff", opacity: "0" });
    // 底下：狀態、種子、時代；「牌 · N」和按鈕
    const meta = mk("div", "tb tmeta", el);
    Object.assign(meta.style, { left: "0", top: "544px" });
    const status = mk("span", "", meta);
    const seedEl = mk("code", "", meta, `seed ${esc(spec.seed)}`);
    const eraEl = mk("span", "", meta, esc(spec.era || ""));
    const n = (spec.mine?.length || 0) + (spec.drawn?.length || 0);
    const suits = SUIT_ORDER.filter((s) => [...(spec.mine || []), ...(spec.drawn || [])].some((t) => suitOf(t) === s));
    const toggle = mk("div", "tb ttoggle", el, `<span class="mini">${suits.map((s) => `<i style="--suit:var(--suit-${s})"></i>`).join("")}</span>牌 · ${n}`);
    Object.assign(toggle.style, { left: "0", top: "574px" });
    const hiresBtn = mk("div", "tb tbtn ghost sm", el, "Hires");
    Object.assign(hiresBtn.style, { left: "126px", top: "574px", width: "62px", height: "34px" });
    const copyBtn = mk("div", "tb tbtn ghost sm", el, "複製 POS");
    Object.assign(copyBtn.style, { left: "196px", top: "574px", width: "88px", height: "34px" });
    const reBtn = mk("div", "tb tbtn ghost sm", el, "同種子重印");
    Object.assign(reBtn.style, { left: "0", top: "616px", width: "112px", height: "34px" });
    const rmBtn = mk("div", "tb tbtn ghost sm", el, "撤下");
    Object.assign(rmBtn.style, { left: "120px", top: "616px", width: "56px", height: "34px" });
    Object.assign(sh, { el, frame, img, draft, prog, veil, scan, sizeTag, same, status, meta, toggle, hiresBtn, copyBtn, reBtn, rmBtn, seedEl, eraEl, fan, panels: [] });
    wall.shots.push(sh);
    return sh;
  };

  /* ---------- 「牌 · N」展開的那一疊牌 ---------- */
  wall.expand = (sh, t0, t1) => {
    const panel = mk("div", "tb tdeal", sh.el);
    Object.assign(panel.style, { left: "0", top: "616px", width: WALL.w + "px", height: "372px", opacity: "0", zIndex: "6" });
    mk("h4", "", panel, `你選的<span>${sh.mine.length} 張</span>`).style.cssText += ";position:absolute;left:18px;top:16px";
    mk("h4", "", panel, `抽到的<span>${sh.drawn.length} 張・拖進合成池就釘住，丟進廢字簍就封鎖</span>`).style.cssText += ";position:absolute;left:18px;top:114px;white-space:nowrap;font-size:14px";
    const cards = [];
    const put1 = (tag, x, y, rz, i) => {
      const c = cardEl(tag, 46, panel);
      c.style.zIndex = String(i);
      cards.push({ tag, el: c, x, y, rz, i });
    };
    sh.mine.forEach((tag, i) => put1(tag, 18 + 23 + i * 46.5, 76, 0, i));
    // 抽到的：每種花色一把扇子，每把最多 7 張，疊著排（真的畫面也是這樣）
    const bySuit = new Map();
    for (const tag of sh.drawn) {
      const s = suitOf(tag);
      if (!bySuit.has(s)) bySuit.set(s, []);
      bySuit.get(s).push(tag);
    }
    let row = 0;
    let idx = sh.mine.length;
    for (const s of SUIT_ORDER) {
      const list = bySuit.get(s);
      if (!list) continue;
      list.slice(0, 7).forEach((tag, k) => put1(tag, 18 + 23 + k * 44, 178 + row * 68, 0, idx++));
      row++;
      if (row >= 3) break;
    }
    const obj = { sh, panel, cards, t0, t1 };
    sh.panels.push(obj);
    sh.toggleOn = [...(sh.toggleOn || []), [t0, t1]];
    return obj;
  };
  /** 展開的那疊牌裡某一張的位置（M 座標）。 */
  wall.panelCard = (obj, tag, t) => {
    const c = obj.cards.find((k) => k.tag === tag);
    if (!c) throw new Error(`展開的牌裡沒有 ${tag}`);
    const p = wall.pos(obj.sh, t);
    return { x: p.x + c.x, y: p.y + 616 + c.y };
  };

  /* ---------- 排位置 ---------- */
  let cacheSig = "";
  let cache = null;
  wall.pos = (sh, t, dur = 0.5) => {
    const sig = wall.shots.map((k) => `${k.tCreate}|${k.tRemove}|${k.tRestore}`).join(";");
    if (sig !== cacheSig) {
      cacheSig = sig;
      cache = reflowKeys(wall.shots, posOf);
    }
    const ks = cache.get(sh);
    if (!ks || !ks.length) return { x: 0, y: 0 };
    let i = 0;
    while (i + 1 < ks.length && ks[i + 1][0] <= t) i++;
    const prev = i ? ks[i - 1][1] : ks[0][1];
    const p = EZ.out(seg(t, ks[i][0], ks[i][0] + dur));
    return { x: lerp(prev.x, ks[i][1].x, p), y: lerp(prev.y, ks[i][1].y, p) };
  };
  wall.finalize = () => {};
  /** 一張成品身上的某個位置（M 座標）。 */
  const OFF = { send: [181, 426], toggle: [56, 591], hires: [157, 591], copy: [240, 591], reprint: [56, 633], remove: [148, 633], frame: [181, 265], seed: [92, 552], img: [181, 265] };
  wall.anchor = (sh, name, t) => {
    const p = wall.pos(sh, t);
    const o = OFF[name];
    return { x: p.x + o[0], y: p.y + o[1] };
  };

  /* ---------- 每一格 ---------- */
  wall.render = (t) => {
    m.M.style.transform = `translateY(${(-wall.scrollAt(t)).toFixed(2)}px)`;
    for (const sh of wall.shots) {
      const alive = t >= sh.tCreate - 0.001 && (sh.tRemove == null || t < sh.tRemove + 0.4 || (sh.tRestore != null && t >= sh.tRestore - 0.001));
      if (!alive) {
        if (sh.el.style.display !== "none") sh.el.style.display = "none";
        continue;
      }
      if (sh.el.style.display) sh.el.style.display = "";
      const p = wall.pos(sh, t);
      const enter = EZ.out(seg(t, sh.tCreate, sh.tCreate + 0.5));
      // 撤下：縮小、淡掉；復原：彈回來
      let gone = 0;
      if (sh.tRemove != null && t >= sh.tRemove) gone = 1 - (sh.tRestore != null && t >= sh.tRestore ? EZ.out(seg(t, sh.tRestore, sh.tRestore + 0.45)) : 0);
      const leave = sh.tRemove != null && t >= sh.tRemove ? EZ.exit(seg(t, sh.tRemove, sh.tRemove + 0.32)) : 0;
      const back = sh.tRestore != null && t >= sh.tRestore ? EZ.out(seg(t, sh.tRestore, sh.tRestore + 0.45)) : 0;
      const vis = sh.tRemove != null && t >= sh.tRemove ? (sh.tRestore != null && t >= sh.tRestore ? back : 1 - leave) : 1;
      void gone;
      const op = enter * vis;
      const sc = lerp(0.94, 1, enter) * lerp(0.9, 1, vis);
      sh.el.style.opacity = op.toFixed(3);
      sh.el.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y + (1 - enter) * -46).toFixed(1)}px) scale(${sc.toFixed(4)})`;
      sh.el.style.transformOrigin = "50% 30%";

      // 內容：草稿 → 印製中 → 顯影 → 印好
      const isDraft = sh.kind === "draft";
      const runStart = sh.tRun0 ?? sh.tCreate;
      const prog = seg(t, runStart, sh.tRun1);
      const running = t >= runStart && t < sh.tRun1;
      const dev = EZ.out(seg(t, sh.tRun1, sh.tRun1 + 1.2));
      if (isDraft) {
        const d = t < runStart ? 1 : 1 - EZ.out(seg(t, runStart, runStart + 0.25));
        sh.draft.style.opacity = d.toFixed(3);
        sh.draft.style.display = d <= 0 ? "none" : "";
        if (sh.sendBtn) sh.sendBtn.style.transform = `scale(${t > sh.tSend && t < sh.tSend + 0.1 ? 0.9 : 1})`;
        sh.fanCards?.forEach((c, i) => {
          const dealt = EZ.out(seg(t, sh.tCreate + 0.05 + i * 0.05, sh.tCreate + 0.5 + i * 0.05));
          c.style.opacity = dealt.toFixed(3);
        });
      } else sh.draft.style.display = "none";
      const showImg = !isDraft || t >= runStart;
      sh.img.style.opacity = showImg ? "1" : "0";
      const hueF = sh.hue ? ` hue-rotate(${sh.hue}deg)` : "";
      let hiP = 0;
      let hiDev = 1;
      if (sh.hires) {
        hiP = seg(t, sh.hires.t0, sh.hires.t1);
        hiDev = EZ.out(seg(t, sh.hires.t1, sh.hires.t1 + 1.0));
      }
      if (running) {
        const e = EZ.inOut(prog);
        sh.img.style.filter = `blur(${lerp(30, 4, e).toFixed(1)}px) saturate(${lerp(0.15, 0.9, e).toFixed(2)}) brightness(${lerp(1.7, 1.05, e).toFixed(2)}) contrast(${lerp(0.7, 1, e).toFixed(2)})${hueF}`;
      } else if (sh.hires && t >= sh.hires.t0 && t < sh.hires.t1 + 1.0) {
        // Hires：重畫細節（略糊、慢慢清楚），由上往下掃
        const e = t < sh.hires.t1 ? EZ.inOut(hiP) : 1;
        const blur = t < sh.hires.t1 ? lerp(0, 6, Math.sin(Math.PI * Math.min(1, hiP * 1.15))) : lerp(6, 0, hiDev) * 0;
        sh.img.style.filter = `blur(${blur.toFixed(1)}px) brightness(${lerp(1, 1.15, Math.sin(Math.PI * e)).toFixed(2)})${hueF}`;
      } else {
        sh.img.style.filter = `blur(${((1 - dev) * 3).toFixed(1)}px) saturate(${lerp(0.9, 1, dev).toFixed(2)}) brightness(${lerp(1.05, 1, dev).toFixed(2)})${hueF}`;
        if (t < runStart) sh.img.style.filter = "blur(30px)";
      }
      sh.prog.style.opacity = running ? "1" : "0";
      sh.prog.firstChild.style.transform = `scaleX(${prog.toFixed(3)})`;
      // Hires 的面紗：進度字、掃描線、尺寸
      const hiOn = !!sh.hires && t >= sh.hires.t0 && t < sh.hires.t1 + 0.5;
      sh.veil.style.opacity = hiOn && t < sh.hires.t1 ? "1" : "0";
      if (hiOn) setHTML(sh.veil, `Hires 深度 ${sh.hires.scale}× · ${Math.max(1, Math.round(hiP * 20))}/20`);
      sh.scan.style.opacity = hiOn && t < sh.hires.t1 ? "1" : "0";
      sh.scan.style.transform = `translateY(${(hiP * WALL.h).toFixed(1)}px)`;
      const sizeOn = sh.hires && t >= sh.hires.t1;
      sh.sizeTag.style.opacity = sizeOn ? EZ.out(seg(t, sh.hires.t1, sh.hires.t1 + 0.4)).toFixed(3) : "0";
      if (sizeOn) setHTML(sh.sizeTag, `${sh.hires.w} × ${sh.hires.h}`);
      if (sh.same) sh.same.style.opacity = EZ.out(seg(t, sh.flagAt ?? sh.tCreate + 0.4, (sh.flagAt ?? sh.tCreate + 0.4) + 0.3)).toFixed(3);
      // 狀態字
      let text;
      if (isDraft && t < runStart) text = "只抽牌";
      else if (running) text = `印製中 ${Math.max(1, Math.round(prog * 25))}/25`;
      else if (sh.hires && t >= sh.hires.t0 && t < sh.hires.t1) text = `Hires 深度 ${sh.hires.scale}×`;
      else if (sh.hires && t >= sh.hires.t1) text = `Hires ${sh.hires.w}×${sh.hires.h}`;
      else text = "印好了";
      setHTML(sh.status, text);
      sh.status.style.color = running ? "var(--color-accent)" : "";
      // 按鈕按下去的回饋
      const press = (btn, list) => {
        let s = 1;
        for (const a of list || []) if (t > a && t < a + 0.1) s = 0.9;
        btn.style.transform = `scale(${s})`;
      };
      press(sh.hiresBtn, sh.pressHires);
      press(sh.reBtn, sh.pressReprint);
      press(sh.rmBtn, sh.pressRemove);
      press(sh.toggle, sh.pressToggle);
      const copied = (sh.pressCopy || []).some((a) => t >= a && t < a + 1.3);
      press(sh.copyBtn, sh.pressCopy);
      setHTML(sh.copyBtn, copied ? "已複製 ✓" : "複製 POS");
      sh.copyBtn.style.color = copied ? "var(--color-good)" : "";
      const open = (sh.toggleOn || []).some(([a, b2]) => t >= a && t < b2);
      sh.toggle.classList.toggle("on", open);
      // 展開的牌
      for (const pn of sh.panels) {
        const show = t >= pn.t0 - 0.02 && t < pn.t1 + 0.3;
        const pOp = EZ.out(seg(t, pn.t0, pn.t0 + 0.25)) * (1 - EZ.exit(seg(t, pn.t1, pn.t1 + 0.28)));
        pn.panel.style.display = show ? "" : "none";
        pn.panel.style.opacity = pOp.toFixed(3);
        if (!show) continue;
        for (const c of pn.cards) {
          const d = EZ.out(seg(t, pn.t0 + 0.1 + c.i * 0.028, pn.t0 + 0.1 + c.i * 0.028 + 0.4));
          const dragging = (wall.panelDrag || []).some((w) => w.tag === c.tag && t >= w.t0 && t <= w.t1);
          c.el.classList.toggle("is-dragging", dragging);
          put(c.el, { x: c.x, y: c.y + (1 - d) * 26, rz: c.rz + (1 - d) * 8, s: lerp(0.8, 1, d), o: d });
        }
      }
    }
  };
  wall.panelDrag = [];
  return wall;
}
