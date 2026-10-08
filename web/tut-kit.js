/**
 * 教學影片的零件（tutorial.js、tut-*.js 用）：
 *   makeScene   一幕：世界裡的根節點、字幕層、要更新的東西（跟 film.js 一樣，全部只看時間 t）
 *   makeScreen  一台「螢幕」：墨池／疊印台的畫面被畫在這裡面（1600×880，原點在正中央）
 *   createFx    螢幕上的畫布特效：牌飛行的軌跡、墨圈、火花、關係線
 *   makeCursor  游標：走弧線、按下去、按住拖著走、點擊時散一圈
 *   keycap      鍵帽：畫面上要按哪個鍵，就在角落壓一下那個鍵
 *   widgets     按鈕、開關、分段選項、步進器…（樣子跟真的介面一樣，畫在 tutorial.css）
 *
 * 螢幕裡的東西用「離正中央多遠」定位：(0, 0) 是螢幕中心，x 往右、y 往下。
 */
import { EZ, seg, lerp, quad, spring, esc, mk, put, setHTML } from "./film-kit.js";
import { cardNode, eagerArt } from "./cards.js";

export const SW = 1600;
export const SH = 880;
export const V = (x, y, z, rx = 0, ry = 0, rz = 0) => ({ x, y, z, rx, ry, rz });

/** 頁面共用的環境：boot() 之後填。 */
export const env = { lib: null, assets: null, lex: null, settings: null };

/* ================= 牌 ================= */

export const suitOf = (tag) => env.lib.byTag.get(tag)?.suit || "look";
export const zhOf = (tag) => env.lib.byTag.get(tag)?.zh || tag;
export const hasCard = (tag) => !!env.lib.byTag.get(tag);

/** 一張真的牌（墨池的牌、真的插畫）：中心在 (0,0)，用 put() 擺。 */
export function cardEl(tag, w, parent, { ghost = false, cls = "" } = {}) {
  const c = env.lib.byTag.get(tag);
  const holder = mk("div", "w wc" + (ghost ? " is-ghost" : "") + (cls ? " " + cls : ""), parent);
  if (!c) return holder;
  const node = eagerArt(cardNode(c, env.assets, { tagName: "div" }));
  node.style.setProperty("--card-w", w + "px");
  for (const img of node.querySelectorAll("img")) img.sizes = Math.round(w * 1.2) + "px";
  holder.append(node);
  holder.style.setProperty("--card-w", w + "px");
  holder.dataset.tag = tag;
  return holder;
}

/** 牌上蓋的章（池中、附帶…）：先做好、藏起來，之後用 stampFlag(el, t, at) 一格一格演。 */
export function addFlag(holder, text, kind = "pool") {
  const art = holder.querySelector(".card-art");
  const f = mk("span", "card-flag", art, esc(text));
  f.dataset.kind = kind;
  f.style.opacity = "0";
  return f;
}
export function stampFlag(f, t, at) {
  if (!f) return;
  const p = seg(t, at, at + 0.42);
  f.style.opacity = p > 0 ? Math.min(1, p * 3).toFixed(3) : "0";
  const s = p <= 0 ? 1.8 : p < 0.55 ? lerp(1.8, 0.92, EZ.out(p / 0.55)) : lerp(0.92, 1, EZ.out((p - 0.55) / 0.45));
  f.style.scale = s.toFixed(3);
}

/* ================= 幕 ================= */

export function makeScene(name, { world, hud, tint = [0.62, 0.1, 250] }) {
  const root = mk("div", "grp", world);
  const layer = mk("div", "scene-hud", hud);
  const S = {
    name,
    root,
    hud: layer,
    acts: [],
    cues: [],
    shakes: [],
    tint,
    cam: () => V(0, 0, 0),
    act(win, update, el = null) {
      S.acts.push({ win, update, el });
    },
    cue(...c) {
      S.cues.push(...c);
    },
  };
  return S;
}

/* ================= 螢幕 ================= */

export function makeScreen(S, { x = 0, y = 0, cls = "" }) {
  const frame = mk("div", "tscreen " + cls, S.root);
  Object.assign(frame.style, { left: `${x - SW / 2}px`, top: `${y - SH / 2}px`, width: SW + "px", height: SH + "px" });
  const O = mk("div", "torg", frame);
  const canvas = mk("canvas", "tfx", frame);
  canvas.width = SW;
  canvas.height = SH;
  const OC = mk("div", "torg", frame);
  const fx = createFx(canvas);
  return { frame, O, OC, fx, x, y, W: SW, H: SH };
}

/** 靜態的一塊（左上角在離中心 (x, y) 的地方）。 */
export function box(parent, cls, x, y, w, h, html) {
  const n = mk("div", "tb " + cls, parent, html);
  n.style.left = x + "px";
  n.style.top = y + "px";
  if (w != null) n.style.width = w + "px";
  if (h != null) n.style.height = h + "px";
  return n;
}

/** 靜態的字：左上角在 (x, y)，不換行。 */
export function label(parent, cls, x, y, html) {
  const n = mk("div", "tb tl " + cls, parent, html);
  n.style.left = x + "px";
  n.style.top = y + "px";
  return n;
}

/* ================= 畫布特效 ================= */

export function createFx(canvas) {
  const g = canvas.getContext("2d");
  const items = [];
  let sc = false;
  return {
    items,
    /** 頁面捲動的量（時間 → 像素）：登記在 scrolled() 裡的特效跟著頁面一起捲。 */
    scrollFn: () => 0,
    scrolled(fn) {
      sc = true;
      try {
        fn();
      } finally {
        sc = false;
      }
    },
    add(t0, t1, draw) {
      items.push({ t0, t1, draw, scrolls: sc });
    },
    render(t) {
      g.clearRect(0, 0, SW, SH);
      g.save();
      g.translate(SW / 2, SH / 2);
      g.lineCap = "round";
      const dy = this.scrollFn(t);
      for (const it of items) {
        if (t < it.t0 || t > it.t1) continue;
        if (it.scrolls && dy) {
          g.save();
          g.translate(0, -dy);
          it.draw(g, t, t - it.t0);
          g.restore();
        } else it.draw(g, t, t - it.t0);
      }
      g.restore();
    },
    /** 墨圈：牌落定的地方散開一圈（牌自己花色的顏色）。 */
    ring({ x, y, t0, dur = 0.7, r0 = 24, r1 = 110, color = "#e5583a", w = 4, a = 0.85 }) {
      this.add(t0, t0 + dur, (g, t, e) => {
        const p = EZ.out(e / dur);
        g.globalAlpha = (1 - p) * a;
        g.strokeStyle = color;
        g.lineWidth = Math.max(0.5, w * (1 - p * 0.65));
        g.beginPath();
        g.arc(x, y, lerp(r0, r1, p), 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      });
    },
    /** 火花：從一點往四周噴。 */
    sparks({ x, y, t0, dur = 0.8, n = 14, r = 90, color = "#ffd9a0", seed = 1 }) {
      const R = mulberry(seed);
      const parts = Array.from({ length: n }, () => ({ a: R() * Math.PI * 2, d: r * (0.4 + R() * 0.7), s: 1.5 + R() * 2.5 }));
      this.add(t0, t0 + dur, (g, t, e) => {
        const p = EZ.out(e / dur);
        g.fillStyle = color;
        for (const q of parts) {
          g.globalAlpha = (1 - p) * 0.9;
          g.beginPath();
          g.arc(x + Math.cos(q.a) * q.d * p, y + Math.sin(q.a) * q.d * p + p * p * 16, q.s * (1 - p * 0.6), 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      });
    },
    /** 軌跡：牌飛行時後面拖著一條漸淡的光點（path(t) → {x, y}）。 */
    trail({ path, t0, t1, color = "#e5583a", len = 0.3, size = 9 }) {
      this.add(t0, t1 + len, (g, t) => {
        const N = 16;
        const fade = t > t1 ? 1 - (t - t1) / len : 1;
        for (let i = 0; i < N; i++) {
          const tt = Math.min(t, t1) - (i / N) * len * (t > t1 ? 1 : 1);
          if (tt < t0) continue;
          const p = path(tt);
          const k = 1 - i / N;
          g.globalAlpha = 0.5 * k * k * fade;
          g.fillStyle = color;
          g.beginPath();
          g.arc(p.x, p.y, size * (0.25 + 0.75 * k), 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      });
    },
    /** 兩點之間一條線（端點可以隨時間動）。dash：虛線；draw：0..1 畫出來的進度。 */
    link({ a, b, t0, t1, color = "#b58cff", dash = [8, 8], w = 3, bow = 0.18, drawIn = 0.5, fadeOut = 0.35 }) {
      this.add(t0, t1 + fadeOut, (g, t, e) => {
        const A = a(t);
        const B = b(t);
        const p = EZ.out(seg(t, t0, t0 + drawIn));
        const q = 1 - EZ.exit(seg(t, t1, t1 + fadeOut));
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const cx = (A.x + B.x) / 2 - dy * bow;
        const cy = (A.y + B.y) / 2 + dx * bow;
        g.globalAlpha = q;
        g.strokeStyle = color;
        g.lineWidth = w;
        g.setLineDash(dash);
        g.lineDashOffset = -t * 26;
        g.beginPath();
        g.moveTo(A.x, A.y);
        const N = 26;
        for (let i = 1; i <= N * p; i++) {
          const u = i / N;
          g.lineTo(quad(A.x, cx, B.x, u), quad(A.y, cy, B.y, u));
        }
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      });
    },
    /** 一圈光暈框（指出「就是這裡」）。 */
    frameGlow({ x, y, w, h, t0, t1, color = "#e5583a", r = 14, pulse = true }) {
      this.add(t0, t1 + 0.3, (g, t) => {
        const p = EZ.out(seg(t, t0, t0 + 0.25)) * (1 - EZ.exit(seg(t, t1, t1 + 0.3)));
        const k = pulse ? 0.6 + 0.4 * Math.sin((t - t0) * 6.2) : 1;
        g.globalAlpha = p * (0.55 + 0.35 * k);
        g.strokeStyle = color;
        g.lineWidth = 3;
        g.shadowColor = color;
        g.shadowBlur = 22 * p;
        roundRect(g, x - w / 2 - 6 * (1 - p), y - h / 2 - 6 * (1 - p), w + 12 * (1 - p), h + 12 * (1 - p), r);
        g.stroke();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      });
    },
  };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================= 游標 ================= */

const ARROW = `<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M5 3v21l5.6-5.2 3.7 8.3 3.6-1.6-3.7-8.2 7.6-.5z" fill="#fff" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

/** 游標的一個關鍵點：K(時間, x, y, { ease, bow })。bow：路上拱起來多少（跟距離的比例，人手不會走直線）。 */
export const K = (t, x, y, o = {}) => ({ t, x, y, ...o });

/**
 * 游標。script：keys（K 的陣列）、clicks（按下去的時間）、holds（按住拖著走：[放下前, 放開]）、
 * shows（[出現, 消失]，預設整段都在）。render(t) 只看時間。
 */
export function makeCursor(screen, { color = "#fff" } = {}) {
  const el = mk("div", "tcursor", screen.OC, ARROW);
  const c = { el, keys: [], clicks: [], holds: [], shows: [[-1e9, 1e9]], tip: { x: 0, y: 0 } };
  c.path = (...keys) => {
    c.keys.push(...keys);
    c.keys.sort((a, b) => a.t - b.t);
    return c;
  };
  c.hold = (t0, t1) => {
    c.holds.push([t0, t1]);
    return c;
  };
  c.show = (t0, t1) => {
    if (c.shows[0][0] === -1e9) c.shows = [];
    c.shows.push([t0, t1]);
    return c;
  };
  c.at = (t) => {
    const ks = c.keys;
    if (!ks.length) return { x: 0, y: 0 };
    if (t <= ks[0].t) return { x: ks[0].x, y: ks[0].y };
    for (let i = 1; i < ks.length; i++) {
      const k1 = ks[i];
      if (t <= k1.t) {
        const k0 = ks[i - 1];
        const p = (k1.ease || EZ.travel)(seg(t, k0.t, k1.t));
        const dx = k1.x - k0.x;
        const dy = k1.y - k0.y;
        const d = Math.hypot(dx, dy) || 1;
        const bow = (k1.bow ?? 0.09) * d * Math.sin(Math.PI * p);
        return { x: lerp(k0.x, k1.x, p) - (dy / d) * bow, y: lerp(k0.y, k1.y, p) + (dx / d) * bow };
      }
    }
    const l = ks[ks.length - 1];
    return { x: l.x, y: l.y };
  };
  c.render = (t) => {
    const vis = c.shows.some(([a, b]) => t >= a && t <= b);
    if (!vis) {
      el.style.visibility = "hidden";
      return;
    }
    const p = c.at(t);
    let s = 1;
    for (const tc of c.clicks) s *= 1 - 0.16 * (t > tc && t < tc + 0.1 ? 1 : 0) + (t >= tc + 0.1 ? spring(t - tc - 0.1, 0.05, 9, 26) : 0);
    const held = c.holds.some(([a, b]) => t >= a && t <= b);
    if (held) s *= 0.9;
    const fade = c.shows.reduce((m, [a, b]) => Math.max(m, EZ.out(seg(t, a, a + 0.25)) * (1 - EZ.exit(seg(t, b - 0.25, b)))), 0);
    el.style.visibility = "visible";
    el.style.opacity = fade.toFixed(3);
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${held ? -8 : 0}deg)`;
    c.tip = p;
  };
  // 點擊：按下去縮一下，游標尖端散一圈（畫在畫布上）。
  c.click = (...ts) => {
    for (const t of ts) {
      c.clicks.push(t);
      screen.fx.add(t, t + 0.5, (g, tt, e) => {
        const p = EZ.out(e / 0.5);
        const at = c.at(t);
        g.globalAlpha = (1 - p) * 0.9;
        g.strokeStyle = color;
        g.lineWidth = 3 * (1 - p * 0.7);
        g.beginPath();
        g.arc(at.x + 2, at.y + 3, lerp(6, 34, p), 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      });
    }
    return c;
  };
  return c;
}

/* ================= 鍵帽（畫面下方，字幕旁邊） ================= */

/**
 * 按一個鍵：出現、壓下去（t）、放開、淡掉。keys：[{ label, t, wide? }]，同時在畫面上的排成一列。
 * on：hud 那層的登記函式（on(win, update, el)）；parent：hud。
 */
export function keycaps(parent, on, keys, { x = 1750, y = 962 } = {}) {
  keys.forEach(({ label, t, dur = 0.2, wide = false, tag = "" }, i) => {
    const el = mk("div", "tkey" + (wide ? " is-wide" : ""), parent, `<b>${esc(label)}</b>${tag ? `<small>${esc(tag)}</small>` : ""}`);
    el.style.left = x + "px";
    el.style.top = y + "px";
    const a = t - 0.32;
    const z = t + dur + 0.9;
    on([a, z + 0.4], (tt) => {
      const pin = EZ.out(seg(tt, a, a + 0.28));
      const pout = EZ.exit(seg(tt, z, z + 0.35));
      const down = tt >= t && tt < t + dur;
      const rel = tt >= t + dur ? spring(tt - t - dur, 0.06, 8, 24) : 0;
      el.classList.toggle("is-down", down);
      el.style.opacity = (pin * (1 - pout)).toFixed(3);
      el.style.transform = `translate(-50%, -50%) translateY(${((1 - pin) * 26 + (down ? 5 : 0)).toFixed(1)}px) scale(${(1 + rel).toFixed(3)})`;
    }, el);
    void i;
  });
}

/* ================= 鏡頭 ================= */

const zoomOf = (z) => 1500 / (1500 - z);

/**
 * 教學用的鏡頭：到了關鍵點就停住，不要一直漂（一直推拉看起來像在抖）。
 * keys：[[時間, V, ease?], …]，時間＝鏡頭「到位」的時刻；每一段只在到位前 move 秒內移動（依距離 0.8–1.4 秒），其他時間不動。
 * 跟前一個停點差不多的（平移不到 minDist、縮放差不到 minZoom、轉角差不到 2°）直接略過，免得鏡頭碎動。
 * until 之前的關鍵點照舊整段慢慢滑（開場那種運鏡）。
 */
export function calmTrack(keys, { until = -Infinity, minDist = 90, minZoom = 0.15 } = {}) {
  const ks = [keys[0]];
  for (const k of keys.slice(1)) {
    const a = ks[ks.length - 1][1];
    const v = k[1];
    const small =
      k[0] > until &&
      Math.hypot(v.x - a.x, v.y - a.y) < minDist &&
      Math.abs(zoomOf(v.z) - zoomOf(a.z)) < minZoom &&
      Math.abs(v.rx - a.rx) + Math.abs(v.ry - a.ry) + Math.abs(v.rz - a.rz) < 2;
    if (!small) ks.push(k);
  }
  const moves = ks.map((k, i) => {
    if (!i) return 0;
    const a = ks[i - 1][1];
    const v = k[1];
    const d = Math.hypot(v.x - a.x, v.y - a.y) + Math.abs(zoomOf(v.z) - zoomOf(a.z)) * 500;
    return Math.min(1.4, Math.max(0.8, 0.7 + d / 900));
  });
  return (t) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      const [t1, v1] = ks[i];
      if (t <= t1) {
        const [t0, v0] = ks[i - 1];
        const start = t1 <= until ? t0 : Math.max(t0, t1 - moves[i]);
        const p = EZ.inOut(seg(t, start, t1));
        const o = {};
        for (const k in v1) o[k] = lerp(v0[k] ?? v1[k], v1[k], p);
        return o;
      }
    }
    return ks[ks.length - 1][1];
  };
}

/* ================= 動作的小函式 ================= */

/** 按下去的回饋：t 落在 [at, at+0.1] 縮一下，然後彈回。 */
export function pressScale(t, at, amt = 0.07) {
  if (t < at) return 1;
  if (t < at + 0.1) return 1 - amt;
  return 1 + spring(t - at - 0.1, amt * 0.7, 9, 26);
}

/** 牌飛過去的路徑：從 a 到 b，弧線往上拱。 */
export function arc(a, b, p, lift = 120) {
  return { x: lerp(a.x, b.x, p) + (b.y - a.y) * 0.04 * Math.sin(Math.PI * p), y: quad(a.y, Math.min(a.y, b.y) - lift, b.y, p) };
}

/** 只有窗口內才更新 display（S.act 的 el 參數做同樣的事；這裡給沒有 act 的元素用）。 */
export function showIf(el, on) {
  const want = on ? "" : "none";
  if (el.style.display !== want) el.style.display = want;
}

export { EZ, seg, lerp, quad, spring, esc, mk, put, setHTML };
