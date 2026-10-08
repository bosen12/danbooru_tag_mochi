/**
 * 三分鐘版介紹影片（film.js、film-gl.js）共用的小工具：曲線、關鍵格軌道、在 3D 世界裡擺東西。
 * 全部只看時間 t —— 同一個 t 永遠畫出同一格，所以可以任意快轉、倒轉、一格一格輸出。
 */
import { bezier, CURVE } from "./motion.js";
import { translateTree } from "./i18n.js";

export const EZ = Object.fromEntries(Object.entries(CURVE).map(([k, c]) => [k, bezier(c)]));
EZ.lin = (p) => p;
/** 很陡的加速（甩鏡、吸進去）。 */
EZ.whip = bezier([0.8, 0, 0.2, 1]);
/** 砸下來：一開始就很快，最後一點點回彈。 */
EZ.slam = bezier([0.2, 1.4, 0.4, 1]);

export const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const seg = (t, a, b) => cl((t - a) / (b - a));
export const lerp = (a, b, p) => a + (b - a) * p;
/** 二次貝茲（弧線飛行）。 */
export const quad = (a, c, b, p) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * c + p * p * b;
/** 衰減的彈簧（撞一下、晾在繩上擺盪）。 */
export const spring = (dt, amp, k = 2.4, w = 8) => (dt < 0 ? 0 : amp * Math.exp(-dt * k) * Math.cos(dt * w));
/** 進場 × (1 − 離場)。 */
export const life = (t, a, b, inDur = 0.5, outDur = 0.4) => EZ.out(seg(t, a, a + inDur)) * (1 - EZ.exit(seg(t, b, b + outDur)));

export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

/** 固定種子的亂數（跟 engine.js 的 mulberry32 同一種）。 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mk(tag, cls, parent, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  if (parent) parent.append(n);
  return translateTree(n);
}

/** 關鍵格軌道：[[t, {x, y, …}, 曲線?], …]，兩格之間用後面那一格的曲線（預設 inOut）。 */
export function track(keys, ease = EZ.inOut) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e1] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const p = (e1 || ease)(seg(t, t0, t1));
        const o = {};
        for (const k in v1) o[k] = lerp(v0[k] ?? v1[k], v1[k], p);
        return o;
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** 世界裡的東西：以 (x, y, z) 為中心擺，轉角、縮放、透明、模糊。 */
export function put(el, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, o = 1, blur = 0 }) {
  if (o <= 0.002) {
    if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
    return;
  }
  if (el.style.visibility !== "visible") el.style.visibility = "visible";
  el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${s.toFixed(4)})`;
  el.style.opacity = o >= 0.999 ? "" : o.toFixed(3);
  el.style.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : "";
}

/** 只改有變的：同一個字串就不動 DOM。 */
export function setHTML(el, html) {
  if (el._html !== html) {
    el.innerHTML = html;
    translateTree(el);
    el._html = html;
  }
}
