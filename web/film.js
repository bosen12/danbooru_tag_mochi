/**
 * 排字匣的介紹影片（三分鐘版）。畫面、配樂都在這一頁即時產生：
 *   牌就是墨池的牌（cards.js 的 cardNode、真的插畫），提示詞是真的引擎抽的（固定種子），
 *   疊印台的層、附帶是 fuse-bed.js 真的算的，時代、分級的數字直接從詞庫算。
 *   開場、結尾的星河是 three.js（film-gl.js）：整本詞庫的牌，六種花色是六條旋臂。
 *
 * 每個東西都有 update(t)，只看時間 t —— 可以任意快轉、倒轉、一格一格輸出。
 * 播放時 t 取自配樂的時鐘（film-score.js，128 BPM，一小節 1.875 秒）。
 *
 * 片子是一串「段落」（SEGS）：每段把影片的時間 T 對到某一幕自己的時間 t。
 * 兩分鐘版的場景（排字匣、墨池、疊印台、找牌、撤回）原封搬過來、快 4/3 倍播：
 * 舊的一小節 2.5 秒快 4/3 倍正好是新的一小節，原本踩在拍子上的地方在這裡也踩在拍子上。
 * 新的場景（時代與分級、牌·N 與無限抽、Hires、快剪、開場、結尾）用自己的時間。
 *
 *   0:00  開場：墨滴 → 牌炸成星河 → 鏡頭穿過去 → 收成標題
 *   0:19  排字匣：看中文送英文、互斥、附帶 │ 0:30 時代、分級 │ 0:41 一鍵抽整組
 *   0:47  墨池：牌牆、合成池、送 ComfyUI 顯影 │ 1:06 牌·N、無限抽 │ 1:13 Hires
 *   1:19  找牌與拖曳 │ 1:26 偏好卡牌 │ 1:30 清版、撤回
 *   1:36  疊印台：六層、影子、四張試印、關係、付印、晾紙繩
 *   2:04  快剪：固定種子、工作流與 LoRA、手機斷線接回、Telegram／Discord、分頁標題、本機開源
 *   2:26  結尾：牌炸成球、攤成牌牆、捲成漩渦、標題、git clone
 * 測試用：window.__intro.seek(秒) 直接畫出那一格（不出聲）；網址 ?t=秒 從那裡開始。
 */
import { createScore, buildEvents, bar, BEAT, LENGTH, secAt } from "./film-score.js";
import { buildLibrary, createAssets, cardNode, eagerArt, CARD_SUIT_INFO, CARD_SUITS } from "./cards.js";
import { ratingBlocked } from "./rules/rating.js";
import { indexLexicon, defaultSettings, sanitizeSettings, drawOne, mulberry32, applyPin } from "./engine.js";
import { emptyBed, placeCard, REGISTERS, REGISTER_ROLE } from "./fuse-bed.js";
import { EZ, seg, lerp, quad, spring, esc, mk, track, put, setHTML, rng } from "./film-kit.js";
import { createGL } from "./film-gl.js";
import { makeText } from "./film-text.js";
import * as idata from "./intro-data.js";
import { english, t as translate } from "./i18n.js";

const $ = (id) => document.getElementById(id);
/** 兩分鐘版的小節（96 BPM）。搬過來的場景裡的時間都是用它算的。 */
const obar = (n, beat = 0) => n * 2.5 + beat * 0.625;
/** 舊場景快幾倍：舊的一小節 2.5 秒 → 新的一小節 1.875 秒。 */
const K = 4 / 3;

/* ================= 舞台、幕 ================= */

const stage = $("stage");
const world = $("world");
const worldBox = $("world-box");
const hudEl = $("hud");
const gacts = []; // 影片時間 T 的東西（字幕、轉場）
const gcues = []; // 影片時間 T 的音效

const SCENES = {};
/**
 * 一幕：自己的世界根節點（root）、自己的字幕層（hud）、自己的時間。
 * 不在這一幕的時候整幕藏起來。
 */
function scene(name, { tint = [0.62, 0.1, 250] } = {}) {
  const root = mk("div", "grp", world);
  const hud = mk("div", "scene-hud", hudEl);
  const s = {
    name,
    root,
    hud,
    acts: [],
    cues: [],
    shakes: [],
    tint,
    cam: () => V(0, 0, 0),
    act(win, update, el = null) {
      s.acts.push({ win, update, el });
    },
    cue(...c) {
      s.cues.push(...c);
    },
    group(x = 0, y = 0) {
      const g = mk("div", "grp", root);
      g.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      return g;
    },
  };
  SCENES[name] = s;
  return s;
}

/**
 * 片子的段落：[T0, T1, 幕, t0, 倍速]。這一段裡，那一幕的時間 t = t0 + (T − T0) × 倍速。
 */
const SEGS = [
  [0, bar(10), "open", 0, 1],
  [bar(10), bar(16), "case", 10, K],
  [bar(16), bar(22), "era", 0, 1],
  [bar(22), bar(25), "case", 25, K],
  [bar(25), bar(35), "mochi", 32.5, K],
  [bar(35), bar(39), "detail", 0, 1],
  [bar(39), bar(42), "hires", 0, 1],
  [bar(42), bar(46), "search", 47.5, K],
  [bar(46), bar(48), "mochi", 57.5, K],
  [bar(48), bar(51), "undo", 97.5, K],
  [bar(51), bar(66), "over", 70, K],
  [bar(66), bar(78), "montage", 0, 1],
  [bar(78), LENGTH + 5, "finale", bar(78), 1],
];
function segAt(T) {
  for (const s of SEGS) if (T >= s[0] && T < s[1]) return s;
  return SEGS[SEGS.length - 1];
}
/** 某一幕自己時間上的音效 → 影片時間（那一刻沒被剪進片子就不要）。 */
function sceneCuesToFilm(s) {
  const out = [];
  for (const c of s.cues) {
    for (const [T0, T1, name, t0, k] of SEGS) {
      if (name !== s.name) continue;
      const T = T0 + (c.t - t0) / k;
      if (T >= T0 && T < T1) out.push({ ...c, t: T });
    }
  }
  return out;
}

const gact = (win, update, el = null) => gacts.push({ win, update, el });

/* ================= 字幕、標題（不跟鏡頭轉） ================= */

// 逐字翻出的字、砸下來的大字、章節記號：跟教學影片共用（film-text.js），這裡登記在影片時間上。
const { kinetic, say, slam, chapter } = makeText({ hud: hudEl, on: gact });

/* ================= 牌、成品 ================= */

let lib = null;
let assets = null;
let lex = null;
let settings = null;

function cardEl(tag, w, parent, { ghost = false } = {}) {
  const c = lib.byTag.get(tag);
  const holder = mk("div", "w wc" + (ghost ? " is-ghost" : ""), parent);
  if (!c) return holder;
  const node = eagerArt(cardNode(c, assets, { tagName: "div" }));
  node.style.setProperty("--card-w", w + "px");
  for (const img of node.querySelectorAll("img")) img.sizes = Math.round(w * 1.2) + "px";
  holder.append(node);
  holder.style.setProperty("--card-w", w + "px");
  return holder;
}

const suitOf = (tag) => lib.byTag.get(tag)?.suit || "look";
const zhOf = (tag) => lib.byTag.get(tag)?.zh || tag;
const hasCard = (tag) => !!(lib.byTag.get(tag) && !ratingBlocked(lib.byTag.get(tag).item, "general"));
const hasArt = (tag) => hasCard(tag) && !!assets.art(tag);
// Scene roles must exist before first-time card downloads finish. cardNode
// already renders text placeholders; only image-only scenes require hasArt.
const pickArt = (list, n) => list.filter(hasCard).slice(0, n);

/** 一張「成品」：ComfyUI 真的畫出來的那張（web6/intro-art/）。 */
function printEl(src, w, h, parent, label = "") {
  const el = mk("figure", "w print", parent);
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.margin = "0";
  const shot = mk("div", "shot", el);
  const img = mk("img", "", shot);
  img.src = src || "";
  img.decoding = "sync";
  img.alt = "";
  mk("figcaption", "", el, label);
  return el;
}

// 公開展示：摘錄裡不秀身材、裸露、哭泣這類字（引擎照規則抽，展示只挑乾淨的種子、摘乾淨的字）。
const BAD = /breast|chest|wet|nude|naked|pant(y|ie)|cleavage|underwear|bath|lingerie|\bass\b|thigh|navel|gyaru|bikini|swimsuit|cry|tears|empty eyes|blood|sweat|lying|armpit|skin|sex|kiss|size difference|flat|curvy|plump|muscular|pregnant/;
const ENG = { drawOne, mulberry32, applyPin, emptyBed, placeCard };

/* ================= 鏡頭 ================= */

const V = (x, y, z, rx = 0, ry = 0, rz = 0) => ({ x, y, z, rx, ry, rz });

/** 撞一下的鏡頭晃動：[[時間, 幅度], …]。 */
function shakeOf(list, t) {
  let x = 0;
  let y = 0;
  for (const [at, amp] of list) {
    const d = t - at;
    if (d < 0 || d > 0.8) continue;
    x += spring(d, amp, 6, 47);
    y += spring(d, amp * 0.7, 6, 39);
  }
  return { x, y };
}

/* ================= 開場 ================= */

function buildOpen(data) {
  const S = scene("open", { tint: [0.62, 0.19, 33] });
  const IMPACT = bar(1);
  // 墨滴：從上面落下，打在畫面中央散開三圈。
  const drop = mk("div", "k ink-drop", S.hud);
  S.act([0, IMPACT + 0.1], (t) => {
    const p = EZ.in(seg(t, 0.35, IMPACT));
    drop.style.opacity = t < 0.3 ? 0 : 1;
    drop.style.transform = `translate(-50%, -50%) translateY(${lerp(-40, 540, p).toFixed(1)}px) scaleY(${(1 + p * 0.9).toFixed(2)})`;
    drop.style.visibility = t > IMPACT ? "hidden" : "";
  }, drop);
  for (let i = 0; i < 3; i++) {
    const r = mk("div", "k ink-ring", S.hud);
    const a = IMPACT + i * 0.18;
    S.act([a, a + 1.8], (t) => {
      const p = EZ.out(seg(t, a, a + 1.7));
      r.style.opacity = ((1 - p) * 0.9).toFixed(3);
      r.style.transform = `translate(-50%, -50%) scale(${(1 + p * (22 + i * 9)).toFixed(2)}, ${(1 + p * (7 + i * 3)).toFixed(2)})`;
    }, r);
  }
  const blot = mk("div", "k ink-blot", S.hud);
  S.act([IMPACT - 0.05, IMPACT + 3], (t) => {
    const p = EZ.out(seg(t, IMPACT, IMPACT + 2.8));
    blot.style.opacity = (Math.min(1, seg(t, IMPACT, IMPACT + 0.15)) * (1 - p)).toFixed(3);
    blot.style.transform = `translate(-50%, -50%) scale(${(0.1 + p * 2.6).toFixed(3)}, ${(0.05 + p * 1).toFixed(3)})`;
  }, blot);
  S.shakes.push([IMPACT, 9]);
  S.cue({ t: 0.35, kind: "whoosh", gain: 0.06, dur: 1.4 });
  S.cue({ t: IMPACT, kind: "impact", gain: 0.5 });

  // 一拍一個字，閃在星河前面：英文 tag＋中文。
  const R = rng(11);
  data.words.forEach((tag, i) => {
    const at = IMPACT + 0.95 + i * BEAT;
    if (at > bar(7)) return;
    const el = mk("div", "k k-flash", S.hud, `${esc(tag)}<small>${esc(zhOf(tag))}</small>`);
    el.style.setProperty("--suit", `var(--suit-${suitOf(tag)})`);
    const side = i % 2 ? 1 : -1;
    el.style.left = `${Math.round(960 + side * (260 + R() * 420))}px`;
    el.style.top = `${Math.round(200 + R() * 640)}px`;
    S.cue({ t: at, kind: "tick", gain: 0.05 });
    S.act([at - 0.05, at + BEAT * 1.6], (t) => {
      const p = seg(t, at, at + 0.12);
      const q = EZ.in(seg(t, at + BEAT * 0.9, at + BEAT * 1.5));
      el.style.opacity = (p * (1 - q) * 0.9).toFixed(3);
      el.style.transform = `translate(-50%, -50%) scale(${(lerp(1.3, 1, EZ.out(p)) + q * 0.15).toFixed(3)})`;
      el.style.filter = p < 1 || q > 0 ? `blur(${((1 - p) * 10 + q * 8).toFixed(1)}px)` : "";
    }, el);
  });

  // 整本詞庫的數字（跟星河一起出現）。
  const stats = mk("div", "k k-stats", S.hud);
  stats.style.left = "110px";
  stats.style.top = "850px";
  S.act([bar(4) - 0.1, bar(7) + 0.6], (t) => {
    const p = EZ.out(seg(t, bar(4), bar(4) + 0.6));
    const q = EZ.exit(seg(t, bar(7), bar(7) + 0.4));
    const v = Math.round(data.tagCount * EZ.out(seg(t, bar(4), bar(5) + 1)));
    setHTML(stats, `<b>${v.toLocaleString("en-US")}</b><span>個 Danbooru tag · 每個都有中文<small>TAGS IN THE LEXICON</small></span><b>6</b><span>種花色 ＝ 六條旋臂<small>SUITS · ONE ARM EACH</small></span>`);
    stats.style.opacity = (p * (1 - q)).toFixed(3);
    stats.style.transform = `translate(0, -50%) translateX(${((1 - p) * -40).toFixed(1)}px)`;
  }, stats);

  // 標題砸下來。
  S.cue({ t: bar(7), kind: "whoosh", gain: 0.12, dur: 1.8 });
  slam({ zh: "排字匣", en: "DANBOORU CASE", x: 960, y: 470, inAt: bar(8), outAt: bar(10) - 0.55, cls: "is-title" });
  say("一張圖，是*一組字*", "Every image is a set of words", bar(8) + 0.9, bar(10) - 0.6, { y: 760 });
}

/* ================= 排字匣（兩分鐘版的場景，快 4/3 倍） ================= */

const X1 = 0;
const X2 = 5200;
const X3 = 10400;

const OLD_TINT = [
  [0, [0.62, 0.19, 33]],
  [30, [0.6, 0.16, 33]],
  [34, [0.62, 0.1, 200]],
  [68, [0.62, 0.1, 200]],
  [72, [0.7, 0.12, 70]],
  [106, [0.7, 0.12, 70]],
  [110, [0.6, 0.03, 250]],
];
function oldTint(t) {
  for (let i = 1; i < OLD_TINT.length; i++) {
    if (t <= OLD_TINT[i][0]) {
      const p = EZ.inOut(seg(t, OLD_TINT[i - 1][0], OLD_TINT[i][0]));
      return OLD_TINT[i - 1][1].map((v, k) => lerp(v, OLD_TINT[i][1][k], p));
    }
  }
  return OLD_TINT[OLD_TINT.length - 1][1];
}

function buildTagCase(data) {
  const S = scene("case");
  S.tint = oldTint;
  const g = S.group(X1, 0);

  // 提示詞框：一個字一個字打出來。
  const pos = mk("div", "w pos", g);
  mk("span", "pos-label", pos, "POS");
  const text = mk("span", "pos-text", pos);
  const caret = mk("i", "pos-caret", pos);
  const typed = data.typed.join(", ");
  const T0 = 10.9;
  const T1 = 15.0;
  const perChar = (T1 - T0) / typed.length;
  for (let i = 0; i < typed.length; i++) if (typed[i] !== " ") S.cue({ t: T0 + i * perChar, kind: "tick", gain: 0.05 });
  const swapped = typed.replace("long hair", "short hair");
  S.act([10, 25.6], (t) => {
    const p = EZ.out(seg(t, 10.1, 10.9));
    const up = EZ.inOut(seg(t, 24.2, 25.2));
    put(pos, { x: 0, y: lerp(-160, -330, up) + (1 - p) * 40, z: 0, rx: (1 - p) * 30, o: p * (1 - up) });
    const k = Math.floor(seg(t, T0, T1) * typed.length);
    const s = t >= 17.55 ? swapped : typed.slice(0, k);
    if (text.textContent !== s) text.textContent = s;
    caret.style.opacity = t > T1 + 0.2 ? (Math.floor(t * 2.4) % 2 ? "0.15" : "1") : "1";
  }, pos);

  // 打完變成一張張字條。
  const chipOf = (tag) => {
    const el = mk("div", "w chip", g, `<b>${esc(CARD_SUIT_INFO[suitOf(tag)].glyph)}</b><span>${esc(zhOf(tag))}</span><small>${esc(tag)}</small>`);
    el.style.setProperty("--suit", `var(--suit-${suitOf(tag)})`);
    return el;
  };
  const chips = data.typed.map((tag) => ({ tag, el: chipOf(tag) }));
  const short = chipOf("short hair");
  const jc = chipOf("japanese clothes");

  // 量寬度排一排（字型載好之後才量）。
  const widths = chips.map((c) => c.el.offsetWidth || 220);
  const gap = 18;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  let cx = -total / 2;
  chips.forEach((c, i) => {
    c.x = cx + widths[i] / 2;
    cx += widths[i] + gap;
  });
  const charW = 34 * 0.6;
  let at = 0;
  chips.forEach((c) => {
    c.sx = -740 + 34 + 26 + 22 + (at + c.tag.length / 2) * charW;
    at += c.tag.length + 2;
  });
  const lh = chips.find((c) => c.tag === "long hair");
  const ki = chips.find((c) => c.tag === "kimono");
  data.lhx = lh.x;
  data.kx = ki.x;
  const ROW = 20;

  chips.forEach((c, i) => {
    const a = 15.15 + i * 0.08;
    S.act([15, 25.6], (t) => {
      const p = EZ.out(seg(t, a, a + 0.75));
      const up = EZ.inOut(seg(t, 24.2, 25.2));
      let x = lerp(c.sx, c.x, p);
      let y = lerp(-160, ROW, p);
      let rz = 0;
      let o = p;
      if (c === lh) {
        // 被短髮撞開：轉著掉下去。
        const hit = seg(t, 17.5, 18.7);
        const e = EZ.in(hit);
        x += -hit * 120;
        y += e * 320;
        rz = -e * 38;
        o *= 1 - EZ.in(seg(t, 17.9, 18.7));
        c.el.classList.toggle("is-bad", t > 17.3 && t < 18.8);
      }
      const pulse = c === ki ? Math.max(0, spring(t - 21.25, 0.12, 5, 14)) : 0;
      put(c.el, { x, y: lerp(y, y - 150, up), s: 1 + pulse, rz, o: o * (1 - up) });
    }, c.el);
  });

  // 互斥：短髮從右邊飛進來，撞開長髮，站進它的位置。
  S.cue({ t: 17.5, kind: "clash" });
  S.shakes.push([17.5, 12]);
  S.act([16.2, 25.6], (t) => {
    const p = EZ.travel(seg(t, 16.35, 17.5));
    const up = EZ.inOut(seg(t, 24.2, 25.2));
    const x = quad(1100, 700, lh.x, p);
    const y = quad(ROW + 40, -260, ROW, p);
    put(short, { x, y: lerp(y, y - 150, up), rz: (1 - p) * 14, s: 1 + spring(t - 17.5, 0.06, 6, 16), o: Math.min(1, seg(t, 16.3, 16.6)) * (1 - up) });
  }, short);
  const ring = mk("div", "w ring", g);
  S.act([17.4, 18.6], (t) => {
    const p = EZ.out(seg(t, 17.5, 18.5));
    Object.assign(ring.style, { width: "60px", height: "60px" });
    put(ring, { x: lh.x - 60, y: ROW, s: 1 + p * 7, o: (1 - p) * 0.9 });
  }, ring);
  const lab1 = mk("div", "w rel-label", g, `同一格只留一張<small>one card per slot</small>`);
  lab1.style.setProperty("--suit-wear", "var(--color-accent)");
  S.act([17.4, 20.8], (t) => {
    const p = EZ.out(seg(t, 17.65, 18.3));
    const q = EZ.exit(seg(t, 20.1, 20.5));
    put(lab1, { x: lh.x, y: ROW - 120 + (1 - p) * 20, o: p * (1 - q) });
  }, lab1);

  // 附帶：和服把「和服類」帶上來，中間一條虛線。
  S.cue({ t: 21.25, kind: "chime", gain: 0.1 });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "w rel");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  g.append(svg);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "oklch(66% 0.1 305)");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-dasharray", "8 8");
  svg.append(path);
  const jcTo = { x: ki.x + 60, y: ROW + 150 };
  S.act([21, 25.6], () => {}, jc);
  S.act([21, 25.6], (t) => {
    const p = EZ.out(seg(t, 21.25, 22.15));
    const up = EZ.inOut(seg(t, 24.2, 25.2));
    put(jc, { x: lerp(ki.x, jcTo.x, p), y: lerp(ROW, jcTo.y, p) - up * 150, s: lerp(0.3, 1, p), o: Math.min(1, p * 3) * (1 - up) });
    const x1 = ki.x;
    const y1 = ROW + 30;
    const x2 = lerp(ki.x, jcTo.x, p);
    const y2 = lerp(ROW, jcTo.y, p) - 30;
    svg.style.visibility = "visible";
    svg.style.transform = `translate3d(0, ${(-up * 150).toFixed(1)}px, 0)`;
    svg.style.opacity = (Math.min(1, p * 2) * (1 - up)).toFixed(3);
    path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 - 60}, ${x2} ${y2}`);
    path.style.strokeDashoffset = String(-t * 30);
  }, svg);
  const lab2 = mk("div", "w rel-label", g, `附帶：牌會把上一層帶上來<small>a card carries its parent</small>`);
  S.act([21.4, 24.6], (t) => {
    const p = EZ.out(seg(t, 21.7, 22.4));
    const q = EZ.exit(seg(t, 23.9, 24.3));
    put(lab2, { x: ki.x + 60, y: ROW + 260 + (1 - p) * 20, o: p * (1 - q) });
  }, lab2);

  // 一鍵抽整組：三排拉霸，照拍子一排一排停下來（真的引擎抽的）。
  const LOCK = [obar(10, 2), obar(11), obar(11, 2)];
  const rowsY = [-150, -20, 110];
  data.draws.forEach((d, r) => {
    const el = mk("div", "w slotrow", g);
    const seedEl = mk("span", "seed", el, `seed ${d.seed}`);
    const body = mk("span", "", el);
    const shown = d.tags.filter((tag) => !BAD.test(tag)).slice(0, 13);
    const finalHtml = shown.map((tag) => (data.pins.includes(tag) ? `<em>${esc(tag)}</em>` : esc(tag))).join(", ") + ", …";
    S.cue({ t: LOCK[r], kind: "stamp", gain: 0.3 });
    for (let tt = 25.3 + r * 0.03; tt < LOCK[r]; tt += 0.11) S.cue({ t: tt, kind: "tick", gain: 0.025 });
    S.act([24.6, 32.6], (t) => {
      const p = EZ.out(seg(t, 24.8 + r * 0.12, 25.6 + r * 0.12));
      const q = EZ.exit(seg(t, 31.1, 31.7));
      const locked = t >= LOCK[r];
      el.classList.toggle("is-locked", locked);
      let html;
      if (locked) html = finalHtml;
      else {
        const f = Math.floor(t / 0.07) + r * 7;
        const pick = [];
        for (let k = 0; k < 11; k++) pick.push(data.words[Math.floor((((f * 131 + k * 71 + r * 13) % 997) / 997) * data.words.length)]);
        html = pick.map(esc).join(", ");
      }
      setHTML(body, html);
      const lp = spring(t - LOCK[r], 0.035, 7, 18);
      put(el, { x: (1 - p) * 700, y: rowsY[r], z: 0, s: 1 + (locked ? Math.max(0, lp) : 0), o: p * (1 - q), blur: locked ? 0 : 1.2 + Math.sin(t * 40 + r) * 0.4 });
      seedEl.style.opacity = locked ? "1" : "0.45";
    }, el);
  });

  // 數字。
  const stats = [
    [data.count, "張牌 · CARDS", -560],
    [6, "花色 · SUITS", 0],
    [0, "互相打架 · CONFLICTS", 560],
  ];
  stats.forEach(([n, label, x], i) => {
    const el = mk("div", "w stat", g);
    S.act([29, 32.6], (t) => {
      const p = EZ.out(seg(t, 29.2 + i * 0.15, 30.1 + i * 0.15));
      const q = EZ.exit(seg(t, 31.1, 31.6));
      const v = Math.round(n * EZ.out(seg(t, 29.2, 30.4)));
      setHTML(el, `${v.toLocaleString("en-US")}<small>${esc(label)}</small>`);
      put(el, { x, y: 300 + (1 - p) * 30, o: p * (1 - q) });
    }, el);
  });

  const lhx = X1 + lh.x;
  const kx = X1 + ki.x;
  const cam = track([
    [9.4, V(X1, -40, -300, 6, -8, 0)],
    [10.6, V(X1, -80, -240, 10, -8, 0), EZ.out],
    [15.0, V(X1, -60, -140, 6, 4, 0)],
    [16.6, V(X1 + 160, -10, -60, 4, -4, 0)],
    [17.5, V(lhx, 10, 200, 0, 0, -1), EZ.in],
    [19.6, V(lhx, 20, 110, 2, 0, 0), EZ.out],
    [21.2, V(kx + 40, 60, 120, 4, 2, 0)],
    [23.8, V(kx + 60, 90, 40, 6, -3, 0)],
    [25.0, V(X1, -20, -220, 4, -6, 0)],
    [26.0, V(X1, -20, -160, 2, 0, 0), EZ.out],
    [29.2, V(X1, 40, -80, 0, 3, 0)],
    [32.6, V(X1, 60, -20, 0, 0, 0)],
  ]);
  S.cam = cam;
}

/* ================= 時代、分級（新） ================= */

function buildEra(data) {
  const S = scene("era", { tint: [0.62, 0.12, 70] });
  const g = S.group(0, 0);
  const ERAS = [["any", "不限"], ["modern", "現代"], ["ancient_china", "古中國"], ["medieval", "中世紀"], ["edo", "江戶"], ["victorian", "維多利亞"]];
  // 什麼時候選哪個時代（小節對齊）。
  const STEPS = [[0, 0], [bar(1), 4], [bar(2), 3]];
  const eraAt = (u) => {
    let k = 0;
    for (let i = 0; i < STEPS.length; i++) if (u >= STEPS[i][0]) k = i;
    return k;
  };

  // 時代選單：一排膠囊，底下一塊會滑的底。
  const bar0 = mk("div", "w era-bar", g);
  const thumb = mk("i", "era-thumb", bar0);
  ERAS.forEach(([, zh]) => mk("span", "", bar0, esc(zh)));
  const PILL = 150;
  S.act([0, 5.7], (u) => {
    const p = EZ.out(seg(u, 0.05, 0.6));
    const q = EZ.exit(seg(u, 5.1, 5.5));
    const k = eraAt(u);
    const from = STEPS[Math.max(0, k - 1)][1];
    const to = STEPS[k][1];
    const m = EZ.out(seg(u, STEPS[k][0], STEPS[k][0] + 0.35));
    thumb.style.transform = `translateX(${(lerp(from, to, k === 0 ? 1 : m) * PILL).toFixed(1)}px)`;
    put(bar0, { x: 0, y: -330 + (1 - p) * -40, o: p * (1 - q) });
  }, bar0);
  for (const [at] of STEPS.slice(1)) S.cue({ t: at, kind: "stamp", gain: 0.28 }, { t: at + 0.1, kind: "whoosh", gain: 0.08, dur: 0.6 });

  // 牌：對得上這個時代的站在一排，對不上的掉下去、蓋一個「時代不對」。
  const cards = data.era.map((d, i) => {
    const el = cardEl(d.tag, 124, g);
    const mark = mk("span", "era-x", el, "時代不對");
    return { ...d, el, mark, i };
  });
  const layout = (k) => {
    const era = ERAS[STEPS[k][1]][0];
    const inRow = cards.filter((c) => era === "any" || c.fit[era]);
    const n = inRow.length;
    const pos = new Map();
    inRow.forEach((c, j) => pos.set(c, { x: (j - (n - 1) / 2) * 148, y: 40, out: false }));
    for (const c of cards) if (!pos.has(c)) pos.set(c, { x: (c.i - (cards.length - 1) / 2) * 170, y: 900, out: true });
    return pos;
  };
  const L = STEPS.map((_, k) => layout(k));
  cards.forEach((c) => {
    S.act([0, 5.9], (u) => {
      const p = EZ.out(seg(u, 0.25 + c.i * 0.05, 0.85 + c.i * 0.05));
      const k = eraAt(u);
      const A = L[Math.max(0, k - 1)].get(c);
      const B = L[k].get(c);
      const d = STEPS[k][0] + c.i * 0.03;
      const m = k === 0 ? 1 : B.out && !A.out ? EZ.in(seg(u, d, d + 0.5)) : EZ.out(seg(u, d, d + 0.55));
      const x = lerp(A.x, B.x, m);
      const y = lerp(A.y, B.y, m);
      const outness = lerp(A.out ? 1 : 0, B.out ? 1 : 0, m);
      const exit = EZ.in(seg(u, 5.1 + c.i * 0.02, 5.6 + c.i * 0.02));
      c.el.classList.toggle("is-out", outness > 0.5);
      c.mark.style.opacity = outness.toFixed(3);
      put(c.el, { x, y: y + (1 - p) * 380 - exit * 700, z: -outness * 420, rz: outness * (c.i % 2 ? 9 : -9), s: 1 + Math.max(0, spring(u - d - 0.55, B.out ? 0 : 0.05, 7, 20)), o: p * lerp(1, 0.4, outness) * (1 - exit) });
    }, c.el);
  });
  const local = { on: S.act, parent: S.hud };
  say("時代對不上的字，*根本抽不到*", "Off-era words never get drawn — the engine checks every card", 0.5, 5.0, local);

  // 三段分級：三根柱子＝各檔可以抽的牌數，一條線往下壓，線以上的都抽不到。
  const TIERS = [["全年齡", "general", data.tiers[0]], ["敏感", "sensitive", data.tiers[1]], ["色情", "explicit", data.tiers[2]]];
  const max = data.tiers[2];
  const U0 = bar(3);
  const SEL = [[U0 + 0.25, 2], [bar(4), 1], [bar(5), 0]];
  const selAt = (u) => {
    let s = 2;
    for (const [at, k] of SEL) if (u >= at) s = k;
    return s;
  };
  for (const [at] of SEL.slice(1)) S.cue({ t: at, kind: "stamp", gain: 0.32 });
  const H = 520;
  const BASE = 300;
  const cols = TIERS.map(([zh, key, n], i) => {
    const el = mk("div", "w tier", g);
    const fill = mk("div", "tier-fill", el);
    const num = mk("div", "tier-num", el);
    mk("div", "tier-name", el, `${esc(zh)}<small>${key}</small>`);
    return { el, fill, num, n, i };
  });
  cols.forEach((c) => {
    S.act([U0 - 0.2, 11.3], (u) => {
      const p = EZ.out(seg(u, U0 + c.i * 0.1, U0 + 0.8 + c.i * 0.1));
      const grow = EZ.out(seg(u, U0 + 0.2 + c.i * 0.1, U0 + 1.3 + c.i * 0.1));
      const sel = selAt(u);
      const h = (H * c.n) / max;
      c.fill.style.height = `${(h * grow).toFixed(1)}px`;
      c.el.classList.toggle("is-off", c.i > sel);
      c.el.classList.toggle("is-on", c.i === sel);
      setHTML(c.num, Math.round(c.n * grow).toLocaleString("en-US") + "<small>張牌可抽</small>");
      c.num.style.transform = `translateY(${(-h * grow).toFixed(1)}px)`;
      put(c.el, { x: (c.i - 1) * 380, y: BASE, z: 0, ry: (1 - p) * -40, o: p });
    }, c.el);
  });
  const line = mk("div", "w cutline", g, "<span>這條線以上的字，一個都抽不到 · 負面詞自動補上</span>");
  S.act([bar(4) - 0.2, 11.3], (u) => {
    const sel = selAt(u);
    const prev = sel === 1 ? 2 : 1;
    const at = sel === 1 ? bar(4) : bar(5);
    const m = EZ.out(seg(u, at, at + 0.45));
    const hOf = (k) => (H * cols[k].n) / max;
    const y = BASE - lerp(hOf(prev), hOf(sel), m) - 4;
    const p = EZ.out(seg(u, bar(4), bar(4) + 0.4));
    put(line, { x: 0, y, z: 30, o: p });
  }, line);
  say("尺度三段：*檔位之外的字一個都抽不到*", "Three rating tiers — nothing above the line is ever drawn", U0 + 0.3, 10.9, local);

  S.cam = track([
    [0, V(-120, -40, -260, 8, 10, 0)],
    [bar(2), V(60, -10, -150, 6, -4, 0)],
    [bar(3) - 0.2, V(160, 40, -120, 5, -10, 0)],
    [bar(3) + 0.3, V(0, 60, -420, 14, 22, 0), EZ.whip],
    [bar(5), V(0, 40, -300, 10, -6, 0)],
    [bar(6), V(40, 20, -240, 8, -14, 0)],
  ]);
}

/* ================= 墨池（兩分鐘版的場景） ================= */

function buildMochi(data) {
  const S = scene("mochi");
  S.tint = oldTint;
  const g = S.group(X2, 0);

  // 牌牆：九欄四列，斜著立在後面。
  const COLS = 9;
  const CW = 118;
  const wall = [];
  const ang = (24 * Math.PI) / 180;
  const base = { x: -200, y: -300, z: -700 };
  const DEP = data.pool.map((_, k) => 39.4 + k * 0.625);
  const departOf = (tag) => DEP[data.pool.indexOf(tag)];
  data.wall.forEach((tag, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const lx = (col - (COLS - 1) / 2) * 142;
    const ly = (row - 1.5) * 196;
    const pos = { x: base.x + lx * Math.cos(ang), y: base.y + ly, z: base.z - lx * Math.sin(ang), ry: 24 };
    const el = cardEl(tag, CW, g);
    const a = 32.7 + col * 0.05 + row * 0.08;
    wall.push({ tag, el, pos });
    S.act([32.4, 71], (t) => {
      const p = EZ.out(seg(t, a, a + 0.8));
      const gone = data.pool.includes(tag) ? seg(t, departOf(tag), departOf(tag) + 0.05) : 0;
      const back = data.pool.includes(tag) ? EZ.out(seg(t, 65.1, 65.6)) : 0;
      const fade = EZ.exit(seg(t, 68.4, 69.4));
      put(el, { x: pos.x, y: pos.y + Math.sin(t * 1.2 + i) * 3, z: pos.z, ry: pos.ry + (1 - p) * -110, o: p * Math.max(1 - gone, back) * (1 - fade) });
    }, el);
  });
  const wallOf = (tag) => wall.find((w) => w.tag === tag)?.pos || { x: 0, y: -200, z: -400, ry: 0 };

  // 合成池。
  const pool = mk("div", "w pool", g);
  mk("div", "pool-label", pool, `合成池<small>POOL</small>`);
  const PY = 250;
  S.act([38, 71], (t) => {
    const p = EZ.out(seg(t, 38.4, 39.4));
    const fade = EZ.exit(seg(t, 67.6, 68.6));
    put(pool, { x: 0, y: PY + (1 - p) * 60, z: 0, rx: (1 - p) * 25, o: p * (1 - fade) });
  }, pool);
  const slotX = (k) => -375 + k * 150;

  // 牌從牆上一張張飛進池子（照拍子落地、壓一下、散一圈墨）。
  data.pool.forEach((tag, k) => {
    const el = cardEl(tag, CW, g);
    const from = wallOf(tag);
    const d = DEP[k];
    const land = d + 0.62;
    S.cue({ t: land, kind: "stamp", gain: 0.32 });
    const r = mk("div", "w ring", g);
    r.style.setProperty("--ring", `var(--suit-${suitOf(tag)})`);
    Object.assign(r.style, { width: "150px", height: "150px" });
    S.act([land - 0.05, land + 0.6], (t) => {
      const p = EZ.out(seg(t, land, land + 0.55));
      put(r, { x: slotX(k), y: PY, s: 0.6 + p * 0.9, o: (1 - p) * 0.8 });
    }, r);
    S.act([d - 0.05, 68.6], (t) => {
      const p = EZ.travel(seg(t, d, land));
      const bump = Math.sin(Math.PI * p);
      const g1 = EZ.out(seg(t, 64.0, 64.45));
      const g2 = EZ.inOut(seg(t, 64.45, 65.3));
      let x = quad(from.x, (from.x + slotX(k)) / 2, slotX(k), p);
      let y = quad(from.y, Math.min(from.y, PY) - 280, PY, p);
      let z = quad(from.z, 200, 0, p);
      x = lerp(x, (k - 2) * 4, g1);
      y = lerp(y, PY - k * 2, g1);
      x = lerp(x, from.x, g2);
      y = lerp(y, from.y, g2);
      z = lerp(z, from.z, g2);
      const s = (1 + bump * 0.12) * (1 + spring(t - land, 0.05, 7, 20)) * lerp(1, 0.9, g1);
      put(el, { x, y, z, ry: lerp(from.ry, 0, p) + g2 * 24, rz: bump * -7 + (k - 2) * 3 * g1, s, o: Math.min(1, seg(t, d, d + 0.05)) * (1 - seg(t, 65.1, 65.35)) });
    }, el);
  });

  // 抽並生圖：按下去、進度條、成品顯影。
  const go = mk("div", "w go", g, `抽並生圖 <small>DRAW &amp; RENDER ×1</small>`);
  S.cue({ t: 50.0, kind: "impact", gain: 0.28 });
  S.shakes.push([50.0, 5]);
  S.act([47.8, 58.6], (t) => {
    const p = EZ.out(seg(t, 48.2, 49.0));
    const press = t > 50 && t < 50.14 ? 0.94 : 1 + spring(t - 50.14, 0.04, 8, 20);
    const q = EZ.exit(seg(t, 57.6, 58.2));
    put(go, { x: 0, y: 405 + (1 - p) * 40, s: press, o: p * (1 - q) });
  }, go);
  const meterBox = mk("div", "w", g);
  const meter = mk("div", "meter", meterBox, "<i></i>");
  const mLabel = mk("div", "meter-label", meterBox);
  meterBox.style.display = "grid";
  meterBox.style.gap = "12px";
  meterBox.style.justifyItems = "center";
  S.act([50, 58.6], (t) => {
    const p = EZ.out(seg(t, 50.15, 50.6));
    const q = EZ.exit(seg(t, 57.6, 58.2));
    const f = EZ.inOut(seg(t, 50.4, 55.0));
    meter.firstChild.style.transform = `scaleX(${f.toFixed(3)})`;
    const step = Math.max(1, Math.round(f * 25));
    const s = translate(f < 1 ? `繪製 ${step}/25 · ComfyUI 即時預覽` : "好了 · done");
    if (mLabel.textContent !== s) mLabel.textContent = s;
    put(meterBox, { x: 0, y: 490, o: p * (1 - q) });
  }, meterBox);
  const out = printEl(data.art.mochi, 440, 643, g, `<span>成品 · output</span><span>牌 ${data.cardCount} · seed ${data.prints.mochi.seed}</span>`);
  const shot = out.querySelector(".shot");
  S.act([50.3, 68.8], (t) => {
    // 預覽：一按下去就出現一張很糊、很亮的「latent 預覽」，邊畫邊清楚。
    const p = EZ.out(seg(t, 50.4, 51.2));
    const dev = EZ.inOut(seg(t, 50.6, 58.2));
    const q = EZ.exit(seg(t, 67.4, 68.4));
    shot.style.filter = `blur(${((1 - dev) * 30).toFixed(1)}px) saturate(${lerp(0.1, 1, dev).toFixed(2)}) brightness(${lerp(1.7, 1, dev).toFixed(2)}) contrast(${lerp(0.7, 1, dev).toFixed(2)})`;
    put(out, { x: 700, y: -40 + (1 - p) * 60, z: 40, ry: -10 + (1 - p) * -20, rz: 2, s: lerp(0.96, 1, dev), o: p * (1 - q) });
  }, out);

  // 偏好卡牌：托盤從底下浮上來，一張打進池子。
  const tray = mk("div", "w tray", g);
  mk("div", "tray-label", tray, `偏好卡牌 5/10<small>FAVORITES</small>`);
  const TY = 570;
  S.act([58, 71], (t) => {
    const p = EZ.out(seg(t, 58.4, 59.4));
    const q = EZ.exit(seg(t, 67.8, 68.8));
    put(tray, { x: 0, y: TY + (1 - p) * 260, z: 80, rx: 8, o: p * (1 - q) });
  }, tray);
  const PLAY = 2;
  const playOut = obar(24, 1) - 0.62;
  const playLand = obar(24, 1);
  S.cue({ t: playLand, kind: "stamp", gain: 0.3 });
  data.tray.forEach((tag, k) => {
    const el = cardEl(tag, 110, g);
    const fx = -300 + k * 150;
    const fr = (k - 2) * 4;
    S.act([58, 71], (t) => {
      const p = EZ.out(seg(t, 58.6 + k * 0.07, 59.5 + k * 0.07));
      const q = EZ.exit(seg(t, 67.8, 68.8));
      let x = fx;
      let y = TY + 28 + Math.abs(k - 2) * Math.abs(k - 2) * 5 + (1 - p) * 260;
      let z = 90;
      let rz = fr;
      let s = 1;
      if (k === PLAY) {
        const a = EZ.travel(seg(t, playOut, playLand));
        const px = slotX(5);
        x = quad(fx, (fx + px) / 2, px, a);
        y = quad(y, PY - 200, PY, a);
        z = lerp(90, 0, a);
        rz = fr * (1 - a);
        s = 1 + Math.sin(Math.PI * a) * 0.1 + spring(t - playLand, 0.05, 7, 20);
      }
      put(el, { x, y, z, rz, s, o: p * (1 - q) });
    }, el);
  });

  kinetic({ cls: "k-big", zh: "墨池", en: "MOCHI · THE CARD TABLE", x: 150, y: 470, inAt: 33.2, outAt: 37.6, st: 0.12, drift: -6, on: S.act, parent: S.hud });

  S.cam = track([
    [32.5, V(X2 - 1100, -60, -420, 2, 38, 0)],
    [36.6, V(X2 - 520, -120, -170, 4, 20, 0)],
    [39.2, V(X2 - 200, 40, -60, 6, 10, 0)],
    [42.8, V(X2, 160, 40, 8, 0, 0)],
    [47.2, V(X2, 300, -20, 6, 0, 0)],
    [50.2, V(X2 + 220, 290, -80, 4, -4, 0)],
    [55.2, V(X2 + 520, 60, 120, 2, -12, 0)],
    [57.5, V(X2 + 560, 40, 180, 2, -14, 0)],
    [57.6, V(X2 + 200, 180, -120, 4, -4, 0)],
    [59.8, V(X2, 440, -60, 14, 0, 0)],
    [62.5, V(X2, 430, -10, 12, 0, 0)],
  ]);
}

/* ================= 牌 · N、無限抽（新） ================= */

function buildDetail(data) {
  const S = scene("detail", { tint: [0.62, 0.1, 200] });
  const g = S.group(0, 0);
  const PX = -420;
  const PY = -60;
  const print = printEl(data.art.mochi, 440, 643, g, `<span>成品</span><span>seed ${data.prints.mochi.seed}</span>`);
  const tab = mk("div", "w fold-tab", g, `牌 · ${data.yours.length + data.engine.length}<i></i>`);
  const TAB = { x: PX, y: PY + 360 };
  S.cue({ t: BEAT, kind: "tick", gain: 0.09 });

  // 兩排牌：你放的（亮框）、引擎抽的。從「牌 · N」那顆一張張翻出來。
  const W = 112;
  const rowY = [-200, 150];
  const labA = mk("div", "w row-label", g, `你放的 <b>${data.yours.length}</b><small>YOURS</small>`);
  const labB = mk("div", "w row-label", g, `引擎抽的 <b>${data.engine.length}</b><small>THE ENGINE'S</small>`);
  const rows = [data.yours, data.engine];
  let n = 0;
  rows.forEach((list, r) => {
    list.forEach((tag, j) => {
      const el = cardEl(tag, W, g);
      if (r === 0) el.classList.add("is-lit");
      const at = BEAT * 1.25 + n++ * (BEAT / 4);
      const to = { x: -40 + j * 128, y: rowY[r] };
      S.cue({ t: at + 0.4, kind: "stamp", gain: 0.12 });
      S.act([at - 0.05, 4.1], (u) => {
        const p = EZ.travel(seg(u, at, at + 0.42));
        const q = EZ.in(seg(u, 3.4 + j * 0.02, 3.8 + j * 0.02));
        const bump = Math.sin(Math.PI * p);
        put(el, { x: quad(TAB.x, (TAB.x + to.x) / 2, to.x, p), y: quad(TAB.y, Math.min(TAB.y, to.y) - 160, to.y, p) - q * 500, z: bump * 120, rz: bump * -8, s: lerp(0.4, 1, p) * (1 + spring(u - at - 0.42, 0.05, 7, 20)), o: Math.min(1, p * 4) * (1 - q) });
      }, el);
    });
  });
  [labA, labB].forEach((lab, r) => {
    // 標籤左邊對齊那一排的第一張（.w 是以中心擺的）。
    const lw = lab.offsetWidth || 300;
    S.act([0.5, 4.1], (u) => {
      const p = EZ.out(seg(u, 0.6 + r * 0.4, 1.1 + r * 0.4));
      const q = EZ.exit(seg(u, 3.4, 3.7));
      put(lab, { x: -40 - W / 2 + lw / 2, y: rowY[r] - 120, o: p * (1 - q) });
    }, lab);
  });
  S.act([0, 4.1], (u) => {
    const press = u > BEAT && u < BEAT + 0.12 ? 0.92 : 1 + spring(u - BEAT - 0.12, 0.05, 8, 20);
    const q = EZ.exit(seg(u, 3.4, 3.7));
    tab.classList.toggle("is-open", u > BEAT);
    put(tab, { x: TAB.x, y: TAB.y, s: press, o: 1 - q });
  }, tab);

  // 無限抽：八格牆，一拍換一格（原地重畫），不位移、不捲動。
  const SW = 300;
  const SH = 438;
  const slotPos = (i) => ({ x: ((i % 4) - 1.5) * 330, y: (Math.floor(i / 4) - 0.5) * 480 });
  const H0 = 4.2;
  const hopAt = (u) => (u < H0 ? -1 : Math.floor((u - H0) / BEAT));
  const imgs = data.wallImgs;
  const slots = [];
  for (let i = 0; i < 8; i++) {
    const el = printEl(imgs[i % imgs.length], SW, SH, g, `<span>#${i + 1}</span><span></span>`);
    el.classList.add("slot");
    const cap = el.querySelector("figcaption span:last-child");
    const img = el.querySelector("img");
    const meterEl = mk("i", "slot-meter", el);
    slots.push({ el, img, cap, meterEl, i });
  }
  // 成品那一張就是第一格：從大張縮進牆上。
  S.act([0, 7.6], (u) => {
    const m = EZ.inOut(seg(u, 3.75, 4.35));
    const p0 = slotPos(0);
    put(print, { x: lerp(PX, p0.x, m), y: lerp(PY, p0.y, m), s: lerp(1, SW / 440, m), o: 1 - seg(u, 4.3, 4.36) });
  }, print);
  slots.forEach((sl) => {
    const P = slotPos(sl.i);
    S.act([3.7, 7.6], (u) => {
      const p = sl.i === 0 ? seg(u, 4.3, 4.36) : EZ.out(seg(u, 3.85 + sl.i * 0.06, 4.35 + sl.i * 0.06));
      const k = hopAt(u);
      // 這一格被輪到幾次、最近一次是什麼時候。
      let gen = 0;
      let last = -9;
      if (k >= sl.i) {
        gen = Math.floor((k - sl.i) / 8) + 1;
        last = H0 + (sl.i + (gen - 1) * 8) * BEAT;
      }
      const src = imgs[(sl.i + gen * 8) % imgs.length];
      if (sl.img.getAttribute("src") !== src) sl.img.setAttribute("src", src);
      const f = gen ? EZ.out(seg(u, last, last + 0.3)) : 1;
      const active = k >= 0 && k % 8 === sl.i;
      sl.el.classList.toggle("is-active", active);
      sl.meterEl.style.transform = `scaleX(${active ? seg(u, H0 + k * BEAT, H0 + (k + 1) * BEAT).toFixed(3) : 0})`;
      setHTML(sl.cap, gen ? `第 ${sl.i + gen * 8 + 1} 張` : "");
      put(sl.el, { x: P.x, y: P.y + (1 - p) * 60, ry: (1 - f) * 90, o: p });
    }, sl.el);
  });
  for (let k = 0; H0 + k * BEAT < 7.5; k++) S.cue({ t: H0 + k * BEAT, kind: "tick", gain: 0.06 });
  const inf = mk("div", "w inf-label", g);
  S.act([4, 7.6], (u) => {
    const p = EZ.out(seg(u, 4.1, 4.6));
    const k = Math.max(0, hopAt(u) + 1);
    setHTML(inf, english ? `∞ <span>Continuous · <b>${8 + k}</b> images so far</span>` : `∞ <span>無限抽 · 已經畫了 <b>${8 + k}</b> 張</span>`);
    put(inf, { x: 0, y: -560, o: p });
  }, inf);

  const local = { on: S.act, parent: S.hud };
  say("每張圖用了哪些牌，*攤開給你看*", "Every image lists its cards — yours and the engine's", 0.7, 3.4, local);
  say("無限抽：*八格牆原地輪替*，連錯三張自動停", "Infinite draw — eight slots rotate in place; three failures and it stops", 4.2, 7.2, local);
  S.cam = track([
    [0, V(-300, -20, 60, 2, 10, 0)],
    [1.4, V(-80, 0, -140, 4, -6, 0), EZ.out],
    [3.6, V(-40, 0, -120, 4, -8, 0)],
    [4.5, V(0, -20, -780, 2, 0, 0), EZ.inOut],
    [7.5, V(0, -20, -700, 4, 3, 0)],
  ]);
}

/* ================= Hires（新） ================= */

function buildHires(data) {
  const S = scene("hires", { tint: [0.6, 0.12, 290] });
  const g = S.group(0, 0);
  const W = 520;
  const H = 760;
  const PX = -200;
  const frame = mk("div", "w hi-print", g);
  frame.style.width = W + "px";
  frame.style.height = H + "px";
  const low = mk("canvas", "hi-low", frame);
  low.width = W;
  low.height = H;
  const hi = mk("img", "hi-full", frame);
  hi.src = data.art.fuseA;
  hi.alt = "";
  hi.decoding = "sync";
  const scan = mk("i", "hi-scan", frame);
  const tag = mk("div", "hi-tag", frame);
  let drawn = false;
  const drawLow = () => {
    if (drawn || !hi.complete || !hi.naturalWidth) return;
    // 解析度低的那張：先縮成六分之一再放回來（糊、有點色塊）。
    const c = document.createElement("canvas");
    c.width = Math.round(W / 6);
    c.height = Math.round(H / 6);
    const cx = c.getContext("2d");
    const s = Math.max(c.width / hi.naturalWidth, c.height / hi.naturalHeight);
    cx.drawImage(hi, (c.width - hi.naturalWidth * s) / 2, (c.height - hi.naturalHeight * s) / 2, hi.naturalWidth * s, hi.naturalHeight * s);
    const lx = low.getContext("2d");
    lx.imageSmoothingEnabled = true;
    lx.drawImage(c, 0, 0, W, H);
    drawn = true;
  };
  const SC0 = 1.5;
  const SC1 = 3.7;
  S.cue({ t: 1.2, kind: "stamp", gain: 0.3 }, { t: SC0, kind: "riser", gain: 0.05, dur: SC1 - SC0 }, { t: SC1, kind: "chime", gain: 0.1 });
  S.act([0, 5.7], (u) => {
    drawLow();
    const p = EZ.out(seg(u, 0, 0.5));
    const sc = EZ.inOut(seg(u, SC0, SC1));
    hi.style.clipPath = `inset(0 0 ${((1 - sc) * 100).toFixed(2)}% 0)`;
    scan.style.transform = `translateY(${(sc * H).toFixed(1)}px)`;
    scan.style.opacity = u > SC0 - 0.1 && u < SC1 + 0.2 ? "1" : "0";
    const w0 = hi.naturalWidth || 832;
    const h0 = hi.naturalHeight || 1216;
    const k = lerp(1, 2, sc);
    setHTML(tag, `${Math.round((w0 * k) / 8) * 8} × ${Math.round((h0 * k) / 8) * 8}`);
    put(frame, { x: PX, y: 0, ry: (1 - p) * 20, o: p });
  }, frame);

  // 右邊的 Hires 選單：快速／深度，挑深度、按下去。
  const panel = mk("div", "w hi-panel", g, `<h3>Hires <small>放大、重畫細節</small></h3>`);
  const modes = [
    ["快速", "1.5×", "在 latent 裡放大，再重畫一次細節。快，構圖不動。"],
    ["深度", "2×", "先用放大模型補細節，再輕輕重畫。線條最乾淨。"],
  ].map(([zh, x, note]) => mk("div", "hi-mode", panel, `<b>${zh}</b><span>${x}</span><small>${note}</small>`));
  const btn = mk("div", "hi-go", panel, "Hires ×2");
  const keep = mk("div", "hi-keep", panel, "原圖留著 · 隨時還原");
  S.act([0, 5.7], (u) => {
    const p = EZ.out(seg(u, 0.2, 0.8));
    modes[0].classList.toggle("is-on", u < 0.8);
    modes[1].classList.toggle("is-on", u >= 0.8);
    btn.style.transform = `scale(${u > 1.2 && u < 1.32 ? 0.92 : 1 + spring(u - 1.32, 0.04, 8, 20)})`;
    btn.classList.toggle("is-busy", u > 1.2 && u < SC1);
    const kp = EZ.out(seg(u, SC1 + 0.2, SC1 + 0.6));
    keep.style.opacity = kp.toFixed(3);
    keep.style.transform = `translateY(${((1 - kp) * 14).toFixed(1)}px)`;
    put(panel, { x: 420, y: -40, ry: (1 - p) * -30 - 8, o: p });
  }, panel);
  S.cue({ t: 0.8, kind: "tick", gain: 0.09 });

  say("Hires：*放大、重畫細節*", "Hires — upscale, redraw the detail, keep the original", 0.4, 5.2, { x: 1360, y: 960, on: S.act, parent: S.hud });
  S.cam = track([
    [0, V(80, -20, -160, 4, -8, 0)],
    [SC0, V(-60, -10, -40, 2, -4, 0)],
    [SC0 + 0.8, V(PX, -260, 420, 0, 0, 0), EZ.inOut],
    [SC1, V(PX, 120, 440, 0, 0, 0), EZ.lin],
    [SC1 + 0.7, V(40, -20, -120, 3, -6, 0), EZ.inOut],
    [5.7, V(60, -20, -140, 4, -8, 0)],
  ]);
}

/* ================= 找牌與拖曳（兩分鐘版剪輯版的場景） ================= */

const XS = 20000;
const XU = 26000;

function buildSearch(data) {
  const S = scene("search", { tint: [0.62, 0.1, 200] });
  const g = S.group(XS, -50);
  const W = 112;
  const colX = (c) => (c - 2.5) * 138;
  const rowY = [-125, 50];
  const grid = data.grid.map((tag, i) => ({ tag, el: cardEl(tag, W, g), x: colX(i % 6), y: rowY[Math.floor(i / 6)] }));
  const byTag = (t) => grid.find((c) => c.tag === t);
  const q1 = byTag(data.q1);
  const q2 = byTag(data.q2);
  const dragged = byTag(data.drag);

  const chip = (c) => {
    const k = mk("span", "enter-chip", c.el.firstChild, "Enter");
    k.style.animation = "none";
    k.style.opacity = "0";
    return k;
  };
  const chip1 = chip(q1);
  const chip2 = chip(q2);

  const box = mk("div", "w sbox", g);
  mk("span", "sbox-label", box, "找牌");
  const text = mk("span", "sbox-text", box);
  const caret = mk("i", "sbox-caret", box);
  const TYPE = [
    [48.9, english ? "red" : "紅"],
    [49.2, english ? "red hair" : "紅髮"],
    [51.15, english ? "ki" : "和"],
    [51.45, english ? "kimono" : "和服"],
  ];
  for (const [t] of TYPE) S.cue({ t, kind: "tick", gain: 0.06 });
  const ENTER1 = obar(20);
  const ENTER2 = obar(21);
  S.cue({ t: ENTER1, kind: "tick", gain: 0.09 }, { t: ENTER2, kind: "tick", gain: 0.09 });
  S.act([47, 59.6], (T) => {
    const p = EZ.out(seg(T, 47.5, 48.4));
    put(box, { x: 0, y: -340 + (1 - p) * -40, o: p });
    let s = "";
    for (const [t, v] of TYPE) if (T >= t) s = v;
    if (text.textContent !== s) text.textContent = s;
    text.classList.toggle("is-selected", (T > ENTER1 + 0.2 && T < 51.15) || T > ENTER2 + 0.2);
    caret.style.opacity = Math.floor(T * 2.4) % 2 ? "0.2" : "1";
  }, box);

  const pool = mk("div", "w pool", g);
  pool.style.width = "820px";
  pool.style.height = "210px";
  mk("div", "pool-label", pool, "合成池<small>POOL</small>");
  S.act([47, 59.6], (T) => {
    const p = EZ.out(seg(T, 48.2, 49.0));
    const q = EZ.in(seg(T, 53.4, 54.0));
    put(pool, { x: 0, y: 265 + (1 - p) * 60 + q * 80, rx: (1 - p) * 20, o: p * (1 - q) });
  }, pool);
  const tray = mk("div", "w tray", g);
  mk("div", "tray-label", tray, "偏好卡牌 5/10<small>FAVORITES</small>");
  S.act([47, 59.6], (T) => {
    const p = EZ.out(seg(T, 53.7, 54.5));
    put(tray, { x: 0, y: 265 + (1 - p) * 200, o: p });
  }, tray);

  const matchAt = (c, T) => {
    if (T >= 49.45 && T < ENTER1 + 0.9) return c === q1;
    if (T >= 51.7 && T < 53.4) return c === q2;
    return null;
  };
  grid.forEach((c, i) => {
    const a = 47.6 + i * 0.05;
    const flyTo = c === q1 ? { x: -120, t0: ENTER1 } : c === q2 ? { x: 120, t0: ENTER2 } : null;
    if (flyTo) S.cue({ t: flyTo.t0 + 0.625, kind: "stamp", gain: 0.3 });
    S.act([47, 59.6], (T) => {
      const p = EZ.out(seg(T, a, a + 0.7));
      const m = matchAt(c, T);
      const dim1 = m === false && T < 51.7 ? EZ.out(seg(T, 49.45, 49.8)) : 0;
      const dim2 = m === false && T >= 51.7 ? EZ.out(seg(T, 51.7, 52.0)) : 0;
      const dim = Math.max(dim1, dim2) * (1 - EZ.out(seg(T, 53.4, 53.9)));
      let x = c.x;
      let y = c.y;
      let z = 0;
      let s = 1;
      let rz = 0;
      let o = p * lerp(1, 0.22, dim);
      if (flyTo) {
        const f = EZ.travel(seg(T, flyTo.t0, flyTo.t0 + 0.625));
        const bump = Math.sin(Math.PI * f);
        x = quad(c.x, (c.x + flyTo.x) / 2, flyTo.x, f);
        y = quad(c.y, -270, 265, f);
        z = bump * 120;
        s = (1 + bump * 0.1) * (1 + spring(T - flyTo.t0 - 0.625, 0.05, 7, 20));
        rz = -bump * 6;
        const q = EZ.in(seg(T, 53.4, 54.0));
        y += q * 80;
        o = f > 0 ? p * (1 - q) : o;
      }
      if (c === dragged) {
        const lift = EZ.out(seg(T, 54.7, 54.9));
        const mv = EZ.inOut(seg(T, 54.85, 56.2));
        const land = seg(T, 56.2, 56.25);
        x = quad(c.x, c.x - 120, data.dropX, mv);
        y = quad(c.y, 180, 277, mv);
        s = lerp(1, 1.08, lift) * lerp(1, 104 / W / 1.08, land) + spring(T - 56.25, 0.05, 7, 20);
        z = lift * 90 * (1 - land) + land * 20;
        rz = Math.sin(mv * Math.PI) * -5;
      }
      put(c.el, { x, y, z, rz, s, o });
      c.el.classList.toggle("is-lit", c === dragged && T > 54.7 && T < 56.3);
    }, c.el);
  });
  S.act([49.5, 53.5], (T) => {
    chip1.style.opacity = T > 49.6 && T < ENTER1 + 0.05 ? "1" : "0";
    chip2.style.opacity = T > 51.8 && T < ENTER2 + 0.05 ? "1" : "0";
  });

  const TW = 104;
  const base = data.tray.map((tag, i) => ({ tag, el: cardEl(tag, TW, g), i }));
  const slotX = (i, n) => (i - (n - 1) / 2) * (TW + 18);
  S.cue({ t: 56.25, kind: "stamp", gain: 0.3 });
  base.forEach((c) => {
    S.act([47, 59.6], (T) => {
      const p = EZ.out(seg(T, 53.9 + c.i * 0.06, 54.6 + c.i * 0.06));
      const open = EZ.out(seg(T, 55.5, 56.1));
      const idx = c.i >= data.gapAt ? c.i + 1 : c.i;
      const x = lerp(slotX(c.i, 4), slotX(idx, 5), open);
      put(c.el, { x, y: 277 + (1 - p) * 200, z: 20, o: p });
    }, c.el);
  });
  const cur = mk("div", "w cursor", g);
  S.act([54, 57.2], (T) => {
    const a = EZ.out(seg(T, 54.3, 54.6));
    const q = EZ.exit(seg(T, 56.5, 56.9));
    const mv = EZ.inOut(seg(T, 54.85, 56.2));
    const x = quad(dragged.x, dragged.x - 120, data.dropX, mv) + 20;
    const y = quad(dragged.y, 180, 277, mv) + 30;
    const press = T > 54.7 && T < 56.25 ? 0.8 : 1;
    put(cur, { x, y, z: 160, s: press, o: a * (1 - q) });
  }, cur);

  S.cam = track([
    [47.5, V(XS, -40, -200, 8, -8, 0)],
    [50, V(XS, -20, -40, 4, -2, 0), EZ.out],
    [53.5, V(XS, 0, -30, 5, 2, 0)],
    [56.5, V(XS, 40, 30, 6, 3, 0)],
    [57.5, V(XS, 40, 50, 6, 1, 0)],
  ]);
}

/* ================= 清版、撤回（兩分鐘版剪輯版的場景） ================= */

function buildUndo(data) {
  const S = scene("undo", { tint: [0.62, 0.1, 200] });
  const g = S.group(XU, -60);
  const W = 104;
  const rowX = (i) => 90 + (i - 2.5) * 134;
  const ROW_Y = -210;
  const TRAY_Y = 230;
  const CASE = { x: -610, y: -210 };

  const plate = mk("div", "w pool", g);
  plate.style.width = "900px";
  plate.style.height = "230px";
  mk("div", "pool-label", plate, "卡池<small>PLATE</small>");
  const tray = mk("div", "w tray", g);
  mk("div", "tray-label", tray, "偏好卡牌<small>FAVORITES</small>");
  const box = mk("div", "w casebox", g, "<b>字盒</b><small>CASE</small>");
  const btn = mk("div", "w go", g);
  S.act([96.8, 108.6], (T) => {
    put(plate, { x: 90, y: ROW_Y, o: 1 });
    put(tray, { x: 90, y: TRAY_Y, o: 1 });
    put(box, { x: CASE.x, y: CASE.y, o: 1 });
    const undo = T >= 101.9;
    setHTML(btn, undo ? "撤回 <small>UNDO · Z</small>" : "清版 <small>CLEAR</small>");
    const tp = undo ? 102.5 : 98.75;
    const press = T > tp && T < tp + 0.14 ? 0.92 : 1 + spring(T - tp - 0.14, 0.05, 8, 20);
    put(btn, { x: 560, y: -400, s: press, o: 1 - EZ.inOut(seg(T, 101.6, 101.9)) * (1 - EZ.inOut(seg(T, 101.9, 102.2))) });
  }, btn);
  S.cue({ t: 98.75, kind: "whoosh", gain: 0.14, dur: 0.8 }, { t: 102.5, kind: "whoosh", gain: 0.14, dur: 0.8 });

  const TW = 104;
  const tslot = (i, n) => 90 + (i - (n - 1) / 2) * (TW + 18);
  const handN = (T) => lerp(3, 5, EZ.out(seg(T, 98.75, 99.25))) - lerp(0, 2, EZ.out(seg(T, 102.5, 103.0)));
  data.tray.forEach((tag, i) => {
    const el = cardEl(tag, TW, g);
    S.act([96.8, 108.6], (T) => put(el, { x: tslot(i, handN(T)), y: TRAY_Y + 12, z: 20 }), el);
  });

  const nFav = data.row.filter((t) => data.favs.includes(t)).length;
  let favK = 0;
  let caseK = 0;
  data.row.forEach((tag, i) => {
    const el = cardEl(tag, W, g);
    const fav = data.favs.includes(tag);
    const k = fav ? favK++ : caseK++;
    const home = { x: rowX(i), y: ROW_Y };
    const hs = { x: tslot(3 + data.favs.indexOf(tag), 5), y: TRAY_Y + 12 };
    const b0 = 102.5 + 0.18 + nFav * 0.045 + k * 0.07;
    if (fav) S.cue({ t: 98.75 + k * 0.045 + 0.62, kind: "stamp", gain: 0.22 }, { t: 102.5 + k * 0.045 + 0.62, kind: "stamp", gain: 0.26 });
    else S.cue({ t: b0 + 0.62, kind: "stamp", gain: 0.24 });
    S.act([96.8, 108.6], (T) => {
      let x = home.x;
      let y = home.y;
      let z = 30;
      let s = 1;
      let rz = 0;
      let o = 1;
      if (fav) {
        const t1 = 98.75 + k * 0.045;
        const t2 = 102.5 + k * 0.045;
        const out = EZ.travel(seg(T, t1, t1 + 0.62));
        const back = EZ.travel(seg(T, t2, t2 + 0.62));
        const bo = Math.sin(Math.PI * out);
        const bb = Math.sin(Math.PI * back);
        x = lerp(lerp(home.x, hs.x, out), home.x, back);
        y = lerp(lerp(home.y, hs.y, out), home.y, back) - (bo + bb) * 40;
        z = 30 + (bo + bb) * 80;
        rz = (bo - bb) * 5;
        s = 1 + (bo + bb) * 0.08 + spring(T - t1 - 0.62, 0.04, 7, 20) + spring(T - t2 - 0.62, 0.05, 7, 20);
      } else {
        const g1 = EZ.out(seg(T, 98.86, 99.2));
        const g2 = EZ.travel(seg(T, 99.2, 99.95));
        const pile = { x: 20 + (k - 1.5) * 3, y: ROW_Y - k * 2 };
        x = lerp(lerp(home.x, pile.x, g1), CASE.x, g2);
        y = lerp(lerp(home.y, pile.y, g1), CASE.y, g2) - Math.sin(Math.PI * g2) * 60;
        s = lerp(1, 0.55, g2);
        rz = (k - 1.5) * 3 * g1;
        o = 1 - EZ.in(seg(T, 99.6, 99.95));
        if (T >= b0) {
          const back = EZ.travel(seg(T, b0, b0 + 0.62));
          const bb = Math.sin(Math.PI * back);
          x = lerp(CASE.x, home.x, back);
          y = lerp(CASE.y, home.y, back) - bb * 70;
          z = 30 + bb * 90;
          s = lerp(0.7, 1, back) * (1 + bb * 0.08) + spring(T - b0 - 0.62, 0.05, 7, 20);
          rz = -bb * 5;
          o = Math.min(1, seg(T, b0, b0 + 0.08));
        }
      }
      put(el, { x, y, z, s, rz, o });
      el.classList.toggle("is-lit", fav && T > 97.6 && T < 98.7);
    }, el);
  });

  S.cam = track([
    [97.5, V(XU, -20, -220, 6, 10, 0)],
    [99.5, V(XU, -10, -70, 5, 2, 0), EZ.out],
    [102.5, V(XU, -10, -60, 5, -2, 0)],
    [105, V(XU, -20, -10, 4, -5, 0)],
  ]);
}

/* ================= 疊印台（兩分鐘版的場景） ================= */

function buildOverprint(data) {
  const S = scene("over");
  S.tint = oldTint;
  const g = S.group(X3, 0);
  const EN = { style: "STYLE", pose: "POSE", wear: "WEAR", look: "LOOK", cast: "CAST", scene: "SCENE" };
  const flatY = (i) => -345 + i * 138;
  const depthZ = (i) => (2.5 - i) * 230;
  const collapse = (t) => EZ.inOut(seg(t, 100.0, 102.4));
  const dim = (t) => EZ.inOut(seg(t, 102.2, 103.4));
  const plateOf = {};
  REGISTERS.forEach((suit, i) => {
    const el = mk("div", "w plate", g);
    el.style.setProperty("--suit", `var(--suit-${suit})`);
    mk("div", "plate-head", el, `<b>${CARD_SUIT_INFO[suit].glyph}</b><span>${REGISTER_ROLE[suit]}</span><small>${EN[suit]}</small>`);
    if (!data.rows[suit].length) mk("div", "plate-empty", el, suit === "style" ? "不罩色 · no overlay" : "空著：引擎會補 · the engine fills it");
    plateOf[suit] = { el, i };
    const a = 70.4 + i * 0.16;
    S.act([70, 111], (t) => {
      const p = EZ.out(seg(t, a, a + 1.1));
      const c = collapse(t);
      const fade = EZ.exit(seg(t, 107.6, 109.6));
      el.classList.toggle("is-glow", data.glow(suit, t));
      put(el, { x: lerp(-i * 30, 0, c), y: flatY(i), z: lerp(depthZ(i), 0, c) + (1 - p) * -700, o: p * (1 - fade) * lerp(1, 0.14, dim(t)) });
    }, el);
  });
  const rowPos = (suit, t) => {
    const i = plateOf[suit].i;
    const c = collapse(t);
    return { x: lerp(-i * 30, 0, c), y: flatY(i), z: lerp(depthZ(i), 0, c) };
  };

  // 你的牌：一張張落進自己花色的那一層。
  const UW = 92;
  const userX = (k) => -660 + 250 + k * 108;
  data.drops.forEach(({ tag, suit, k, at, carried }) => {
    const el = cardEl(tag, UW, g);
    S.cue({ t: at + (carried ? 0 : 0.42), kind: carried ? "chime" : "stamp", gain: carried ? 0.07 : 0.3 });
    S.act([at - 0.1, 111], (t) => {
      const r = rowPos(suit, t);
      const p = EZ.out(seg(t, at, at + 0.42));
      const fade = EZ.exit(seg(t, 107.6, 109.6));
      const lit = t > 95 && t < 99.9 && (tag === "kimono" || tag === "japanese clothes");
      el.classList.toggle("is-lit", lit);
      const from = carried ? { x: userX(k - 1), y: 0, z: 30 } : { x: userX(k) + 60, y: -420, z: 380 };
      put(el, {
        x: r.x + lerp(from.x, userX(k), p),
        y: r.y + lerp(from.y, 0, p),
        z: r.z + lerp(from.z, 12, p),
        rz: (1 - p) * (carried ? 0 : 14),
        s: (carried ? lerp(0.4, 1, p) : 1) + spring(t - at - 0.42, 0.05, 7, 20),
        o: Math.min(1, seg(t, at, at + 0.1)) * (1 - fade) * lerp(1, 0.14, dim(t)),
      });
    }, el);
  });

  // 引擎的影子：四張試印各一組，換試印時整排翻過去。
  const GW = 74;
  const TRIAL_AT = [80.4, obar(34, 2), obar(35, 2), obar(36, 2), obar(37, 2)];
  const trialIdx = (t) => (t < TRIAL_AT[1] ? 0 : t < TRIAL_AT[2] ? 1 : t < TRIAL_AT[3] ? 2 : t < TRIAL_AT[4] ? 3 : 0);
  for (const t of TRIAL_AT.slice(1)) S.cue({ t, kind: "chime", gain: 0.06 });
  REGISTERS.forEach((suit) => {
    const ux = userX(data.rows[suit].length) + 20;
    data.trials.forEach((trial, j) => {
      (trial.rows[suit] || []).forEach((tag, k) => {
        const el = cardEl(tag, GW, g, { ghost: true });
        const gx = ux + k * 86;
        S.act([80, 111], (t) => {
          const r = rowPos(suit, t);
          const cur = trialIdx(t);
          const intro = EZ.out(seg(t, 80.6 + plateOf[suit].i * 0.12 + k * 0.05, 81.3 + plateOf[suit].i * 0.12 + k * 0.05));
          let flip = 0;
          let on = cur === j;
          for (let s = 1; s < TRIAL_AT.length; s++) {
            const sw = TRIAL_AT[s] + k * 0.03 + plateOf[suit].i * 0.02;
            if (t >= sw && t < sw + 0.36) {
              const prev = s - 1;
              const next = s === 4 ? 0 : s;
              const half = t < sw + 0.18;
              if (half && prev === j) {
                on = true;
                flip = seg(t, sw, sw + 0.18) * 90;
              } else if (!half && next === j) {
                on = true;
                flip = (1 - seg(t, sw + 0.18, sw + 0.36)) * -90;
              } else on = false;
            }
          }
          const fade = EZ.exit(seg(t, 107.6, 109.6));
          const c = collapse(t);
          put(el, { x: r.x + gx, y: r.y + 6, z: r.z + 6, ry: flip + (1 - intro) * -80, o: on ? intro * (1 - fade) * lerp(1, 0.5, c) * lerp(1, 0.14, dim(t)) : 0 });
        }, el);
      });
    });
  });
  ["A", "B", "C", "D"].forEach((L, j) => {
    const el = mk("div", "w trial", g, `${L}<small>seed ${data.trials[j]?.seed ?? ""}</small>`);
    S.act([80, 111], (t) => {
      const p = EZ.out(seg(t, 80.3 + j * 0.1, 81.1 + j * 0.1));
      const fade = EZ.exit(seg(t, 99.6, 100.4));
      el.classList.toggle("is-on", trialIdx(t) === j);
      const c = collapse(t);
      put(el, { x: 780, y: -225 + j * 150, z: lerp(260, 0, c), s: trialIdx(t) === j ? 1.06 : 1, o: p * (1 - fade) });
    }, el);
  });
  // 重抽只要 25ms：換試印那一下旁邊亮一個計時。
  const ms = mk("div", "w ms-tag", g, "25 ms");
  S.act([83, 97], (t) => {
    const hit = TRIAL_AT.slice(1).find((a) => t >= a - 0.05 && t < a + 1.4);
    const o = hit ? EZ.out(seg(t, hit, hit + 0.15)) * (1 - EZ.exit(seg(t, hit + 1.0, hit + 1.35))) : 0;
    const c = collapse(t);
    put(ms, { x: 780, y: -380, z: lerp(260, 0, c), o });
  }, ms);

  // 附帶的線：和服 → 和服類。
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "w rel");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  g.append(svg);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "oklch(70% 0.12 305)");
  path.setAttribute("stroke-width", "4");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  const relLab = mk("div", "w rel-label", g, `附帶<small>carries</small>`);
  S.act([94.8, 100.6], () => {}, relLab);
  const kimono = data.drops.find((d) => d.tag === "kimono");
  const jcd = data.drops.find((d) => d.tag === "japanese clothes");
  if (kimono && jcd) {
    S.act([94.8, 100.6], (t) => {
      const r = rowPos("wear", t);
      const p = EZ.out(seg(t, 95.2, 96.3));
      const q = EZ.exit(seg(t, 99.6, 100.3));
      const x1 = r.x + userX(kimono.k);
      const x2 = r.x + userX(jcd.k);
      const y = r.y + 75;
      path.setAttribute("d", `M ${x1} ${y} C ${x1} ${y + 90}, ${x2} ${y + 90}, ${x2} ${y}`);
      const len = 260;
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = String(len * (1 - p));
      svg.style.visibility = "visible";
      svg.style.transform = `translate3d(0, 0, ${(r.z + 14).toFixed(1)}px)`;
      svg.style.opacity = (1 - q).toFixed(3);
      put(relLab, { x: (x1 + x2) / 2, y: y + 120, z: r.z + 40, o: EZ.out(seg(t, 95.8, 96.5)) * (1 - q) });
    }, svg);
  }

  // 疊合 → 閃一下 → 付印：成品從版上顯影，再晾到繩上。
  S.cue({ t: 102.5, kind: "impact", gain: 0.42 });
  S.shakes.push([102.5, 14]);
  const flash = mk("div", "flash", S.hud);
  S.act([102, 104], (t) => {
    const p = seg(t, 102.45, 102.6);
    const q = EZ.out(seg(t, 102.6, 103.6));
    flash.style.opacity = (p * (1 - q) * 0.8).toFixed(3);
  }, flash);
  const line = mk("div", "w line", g);
  line.style.width = "1700px";
  const LINE_Y = -440;
  S.act([103.8, 111], (t) => {
    const p = EZ.out(seg(t, 104.2, 105.2));
    const fade = EZ.exit(seg(t, 107.8, 109.8));
    line.style.clipPath = `inset(0 ${((1 - p) * 50).toFixed(1)}% 0 ${((1 - p) * 50).toFixed(1)}%)`;
    put(line, { x: 0, y: LINE_Y, z: 0, o: 1 - fade });
  }, line);
  [
    [data.art.fuseB, `B · ${data.prints.fuseB.seed}`],
    [data.art.fuseC, `C · ${data.prints.fuseC.seed}`],
  ].forEach(([src, cap], k) => {
    const el = printEl(src, 210, 330, g, `<span>試印 ${cap}</span>`);
    mk("i", "peg", el);
    const hx = k === 0 ? -520 : 520;
    S.act([104, 111], (t) => {
      const p = EZ.out(seg(t, 104.6 + k * 0.2, 105.4 + k * 0.2));
      const fade = EZ.exit(seg(t, 107.8, 109.8));
      put(el, { x: hx, y: LINE_Y + 150 + (1 - p) * -60, z: 0, rz: spring(t - 104.6 - k * 0.2, 5, 1.6, 5), o: p * (1 - fade) });
    }, el);
  });
  const main = printEl(data.art.fuseA, 520, 760, g, `<span>付印 · printed</span><span>試印 A · seed ${data.prints.fuseA.seed}</span>`);
  mk("i", "peg", main);
  const mshot = main.querySelector(".shot");
  S.cue({ t: 106.25, kind: "stamp", gain: 0.25 });
  S.act([102.4, 111], (t) => {
    const dev = EZ.inOut(seg(t, 102.6, 105.0));
    const up = EZ.travel(seg(t, 105.2, 106.25));
    const fade = EZ.exit(seg(t, 107.8, 109.8));
    mshot.style.filter = `blur(${((1 - dev) * 26).toFixed(1)}px) saturate(${lerp(0.2, 1, dev).toFixed(2)}) brightness(${lerp(1.9, 1, dev).toFixed(2)})`;
    const hy = LINE_Y + 150;
    put(main, { x: 0, y: lerp(0, hy, up), z: lerp(160, 10, up), s: lerp(lerp(0.9, 1, dev), 0.42, up), rz: spring(t - 106.25, 6, 1.7, 5.5), o: Math.min(1, seg(t, 102.5, 102.9)) * (1 - fade) });
  }, main);

  kinetic({ cls: "k-big", zh: "疊印台", en: "OVERPRINT", x: 1790, y: 250, align: "right", inAt: 70.6, outAt: 75.2, st: 0.12, drift: 6, on: S.act, parent: S.hud });

  S.cam = track([
    [70, V(X3 + 600, -260, -1500, 34, 70, 0)],
    [70.8, V(X3 + 240, -120, -1000, 24, 46, 0), EZ.out],
    [73.2, V(X3 + 80, -60, -720, 20, 36, 0)],
    [76.2, V(X3, -20, -580, 16, 28, 0)],
    [80.6, V(X3 + 60, 10, -560, 14, 24, 0)],
    [86.2, V(X3 + 160, 10, -580, 12, 20, -1)],
    [94.2, V(X3 + 100, 0, -540, 10, 16, 0)],
    [95.8, V(X3 - 260, -130, -60, 8, 10, 0)],
    [99.8, V(X3 - 220, -130, -90, 6, 8, 0)],
    [102.4, V(X3, 0, -300, 0, 0, 0)],
    [104.9, V(X3, 0, -200, 0, 0, 0)],
    [107.5, V(X3, -240, -300, -4, 0, 0)],
  ]);
}

/* ================= 快剪：還有這些（新） ================= */

function buildMontage(data) {
  const S = scene("montage", { tint: [0.6, 0.08, 250] });
  const SHOT = bar(2);
  const GAP = 3200;
  const shots = [];
  const shot = (i, fn) => {
    const g = S.group(i * GAP, 0);
    const u0 = i * SHOT;
    // 每一個鏡頭自己的時間 v（0..SHOT）。
    const act = (win, update, el) => S.act([u0 + win[0], u0 + win[1]], (u) => update(u - u0), el);
    const cue = (c) => S.cue({ ...c, t: c.t + u0 });
    fn(g, act, cue);
    shots.push(i);
  };
  const W = [-0.05, SHOT + 0.05];

  // 0 固定種子：數字輪轉、上鎖。
  shot(0, (g, act, cue) => {
    const box = mk("div", "w seed-box", g);
    mk("span", "seed-label", box, "生圖種子");
    const seg0 = mk("div", "seed-seg", box, `<span>隨機</span><span>固定</span><i></i>`);
    const odo = mk("div", "odo", box);
    const FINAL = "73052918";
    const wheels = [...FINAL].map((d) => {
      const w = mk("span", "odo-w", odo);
      const strip = mk("span", "odo-s", w, "0123456789".repeat(4).split("").map((c) => `<i>${c}</i>`).join(""));
      return { strip, d: +d };
    });
    const lock = mk("div", "w lock", g, `<svg viewBox="0 0 64 80" width="96" height="120"><path class="shackle" d="M16 38V24a16 16 0 0 1 32 0v14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><rect x="6" y="36" width="52" height="40" rx="8" fill="currentColor"/></svg>`);
    const shackle = lock.querySelector(".shackle");
    const note = mk("div", "w mono-note", g, "一次幾張、無限抽，每張都用同一顆 · 抽牌照樣隨機");
    for (let k = 0; k < 12; k++) cue({ t: 0.25 + k * 0.06, kind: "tick", gain: 0.04 });
    cue({ t: 1.6, kind: "stamp", gain: 0.34 });
    act(W, (v) => {
      const p = EZ.out(seg(v, 0, 0.4));
      wheels.forEach((w, i) => {
        const stop = 0.75 + i * 0.07;
        // 轉三圈多再停在那個數字上（條上 0–9 重複四次）。
        const pos = (30 + w.d) * EZ.out(seg(v, 0.1, stop));
        w.strip.style.transform = `translateY(${((-pos * 100) / 40).toFixed(3)}%)`;
      });
      seg0.classList.toggle("is-fixed", v >= 1.6);
      put(box, { x: -160, y: -40, ry: (1 - p) * 30, o: p });
    }, box);
    act(W, (v) => {
      const drop = EZ.out(seg(v, 1.3, 1.6));
      const close = EZ.in(seg(v, 1.45, 1.6));
      shackle.style.transform = `translateY(${((1 - close) * -14).toFixed(1)}px)`;
      put(lock, { x: 560, y: -40 - (1 - drop) * 300, s: 1 + spring(v - 1.6, 0.08, 7, 20), rz: (1 - drop) * -20, o: Math.min(1, drop * 3) });
    }, lock);
    act(W, (v) => put(note, { x: 60, y: 170, o: EZ.out(seg(v, 1.8, 2.3)) }), note);
  });

  // 1 工作流、LoRA：節點圖一個個接起來，POS 流進 Positive。
  shot(1, (g, act, cue) => {
    const NODES = [
      ["ckpt", "Load Checkpoint", "WAI · Illustrious", -760, -40],
      ["lora", "LoRA Loader", "觸發詞拼進 POS", -380, -250],
      ["clip", "CLIP Text Encode", "Positive ← 排字匣", -380, 150],
      ["ks", "KSampler", "steps 25 · cfg 6.5", 60, -40],
      ["vae", "VAE Decode", "", 440, -40],
      ["save", "Save Image", "→ 墨池", 800, -40],
    ];
    const at = { ckpt: 0.35, lora: 1.95, clip: 0.47, ks: 0.59, vae: 0.71, save: 0.83 };
    const node = {};
    for (const [id, title, note, x, y] of NODES) {
      const el = mk("div", "w wf-node" + (id === "lora" ? " is-lora" : ""), g, `<b>${esc(title)}</b><small>${esc(note)}</small><i class="p-in"></i><i class="p-out"></i>`);
      node[id] = { el, x, y };
      cue({ t: at[id], kind: "tick", gain: 0.06 });
      act(W, (v) => {
        const p = EZ.out(seg(v, at[id], at[id] + 0.35));
        put(el, { x, y: y + (1 - p) * 40, s: lerp(0.7, 1, p), o: p });
      }, el);
    }
    const file = mk("div", "w wf-file", g, `{ }<small>workflow_api.json</small>`);
    act(W, (v) => {
      const p = EZ.out(seg(v, 0, 0.3));
      const q = EZ.in(seg(v, 0.3, 0.5));
      put(file, { x: 0, y: -300 + p * 260, s: 1 - q * 0.6, o: p * (1 - q) });
    }, file);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "w rel wf-wires");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    g.append(svg);
    const WIRES = [
      ["ckpt", "clip", 0.8, 1.95],
      ["ckpt", "ks", 0.9, 99],
      ["clip", "ks", 1.0, 99],
      ["ks", "vae", 1.1, 99],
      ["vae", "save", 1.2, 99],
      ["ckpt", "lora", 2.2, 99],
      ["lora", "clip", 2.35, 99],
    ].map(([a, b, t0, t1]) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("fill", "none");
      p.setAttribute("stroke-width", "4");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke", a === "lora" || b === "lora" ? "oklch(74% 0.12 305)" : "oklch(78% 0.1 70)");
      svg.append(p);
      const A = node[a];
      const B = node[b];
      const x1 = A.x + 140;
      const x2 = B.x - 140;
      p.setAttribute("d", `M ${x1} ${A.y} C ${x1 + 120} ${A.y}, ${x2 - 120} ${B.y}, ${x2} ${B.y}`);
      p.style.strokeDasharray = "1200";
      return { p, t0, t1 };
    });
    act(W, (v) => {
      svg.style.visibility = "visible";
      for (const w of WIRES) {
        const p = EZ.out(seg(v, w.t0, w.t0 + 0.4));
        w.p.style.strokeDashoffset = String(1200 * (1 - p));
        w.p.style.opacity = (1 - EZ.exit(seg(v, w.t1, w.t1 + 0.3))).toFixed(3);
      }
    }, svg);
    // POS 的字條流進 Positive。
    data.typed.slice(0, 5).forEach((tag, k) => {
      const el = mk("div", "w wf-pill", g, esc(tag));
      const t0 = 1.25 + k * 0.1;
      act(W, (v) => {
        const p = EZ.travel(seg(v, t0, t0 + 0.5));
        put(el, { x: quad(-760 + k * 60, -600, node.clip.x, p), y: quad(360, 330, node.clip.y + 20, p), s: lerp(1, 0.4, p), o: Math.min(1, seg(v, t0, t0 + 0.08)) * (1 - seg(v, t0 + 0.45, t0 + 0.5)) });
      }, el);
    });
    // 跑起來：一顆光點沿著 KSampler → Save 走。
    const dot = mk("div", "w wf-dot", g);
    act(W, (v) => {
      const p = EZ.inOut(seg(v, 2.7, 3.5));
      put(dot, { x: lerp(node.ks.x, node.save.x, p), y: -40, o: v > 2.65 && v < 3.55 ? 1 : 0 });
    }, dot);
  });

  // 2 手機：走 Tailscale 生圖、斷線、自己接回來。
  shot(2, (g, act, cue) => {
    const phone = mk("div", "w phone", g);
    mk("div", "phone-head", phone, "墨池 <small>100.x.x.x:8796</small>");
    const scr = mk("div", "phone-shot", phone);
    const img = mk("img", "", scr);
    img.src = data.art.fuseB;
    img.alt = "";
    const ring = mk("div", "phone-ring", phone, `<svg viewBox="0 0 120 120" width="150" height="150"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="8"/><circle class="arc" cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="327" transform="rotate(-90 60 60)"/></svg><b></b>`);
    const arc = ring.querySelector(".arc");
    const pct = ring.querySelector("b");
    const banner = mk("div", "phone-banner", phone);
    const CUT0 = 1.2;
    const CUT1 = 2.05;
    cue({ t: CUT0, kind: "glitch", gain: 0.07 });
    cue({ t: CUT1, kind: "chime", gain: 0.1 });
    const prog = (v) => (v < CUT0 ? lerp(0, 0.46, EZ.lin(seg(v, 0.1, CUT0))) : v < CUT1 ? 0.46 : lerp(0.46, 1, EZ.out(seg(v, CUT1, 3.2))));
    act(W, (v) => {
      const p = EZ.out(seg(v, 0, 0.45));
      const f = prog(v);
      const down = v >= CUT0 && v < CUT1;
      arc.style.strokeDashoffset = String(327 * (1 - f));
      setHTML(pct, f >= 1 ? "好了" : `${Math.round(f * 100)}%`);
      img.style.filter = `blur(${((1 - f) * 22).toFixed(1)}px) saturate(${lerp(0.2, 1, f).toFixed(2)})${down ? " hue-rotate(40deg)" : ""}`;
      ring.style.opacity = f >= 1 ? String(1 - EZ.exit(seg(v, 3.25, 3.5))) : "1";
      phone.classList.toggle("is-down", down);
      setHTML(banner, down ? "連線中斷… 伺服器先把這一張留著" : v >= CUT1 && v < 3.3 ? "接回來了 · 同一張、同一個進度" : "");
      banner.dataset.kind = down ? "down" : "up";
      const jit = down ? Math.sin(v * 90) * 6 : 0;
      put(phone, { x: -340 + jit, y: 0, ry: (1 - p) * -30 + 12, rz: -3, o: p });
    }, phone);
    const net = mk("div", "w net", g, `<span class="net-pc">伺服器<small>你的電腦</small></span><i class="net-line"></i><span class="net-ph">手機<small>Tailscale</small></span>`);
    act(W, (v) => {
      const p = EZ.out(seg(v, 0.2, 0.7));
      net.classList.toggle("is-down", v >= CUT0 && v < CUT1);
      put(net, { x: 360, y: -60, o: p });
    }, net);
    const t30 = mk("div", "w big-num", g, "30<small>秒內斷線都接得回來</small>");
    act(W, (v) => put(t30, { x: 360, y: 190, s: 1 + spring(v - CUT1, 0.06, 7, 20), o: EZ.out(seg(v, CUT1, CUT1 + 0.3)) }), t30);
  });

  // 3 推送：成品排進佇列（蓋紙飛機）、飛到 Telegram、Discord。
  shot(3, (g, act, cue) => {
    const pr = printEl(data.art.fuseC, 300, 440, g, `<span>成品</span><span>seed ${data.prints.fuseC.seed}</span>`);
    const plane = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M2 11.5 22 3l-7 18-3.5-7.5z" fill="currentColor"/><path d="M11.5 13.5 22 3" stroke="rgba(0,0,0,0.35)" stroke-width="1.4"/></svg>`;
    const stamp = mk("i", "plane-stamp", pr, plane);
    act(W, (v) => {
      const p = EZ.out(seg(v, 0, 0.4));
      stamp.style.opacity = EZ.out(seg(v, 0.35, 0.5)).toFixed(3);
      stamp.style.transform = `scale(${lerp(2.2, 1, EZ.out(seg(v, 0.35, 0.55))).toFixed(3)}) rotate(-12deg)`;
      put(pr, { x: -620, y: 0, ry: 14, o: p });
    }, pr);
    cue({ t: 0.4, kind: "stamp", gain: 0.25 });
    const CH = [
      ["Telegram", "# 成品", -210, 0.7],
      ["Discord", "# 成品", 210, 1.05],
    ];
    CH.forEach(([name, room, y, t0], k) => {
      const panel = mk("div", "w chan", g, `<header><b>${name}</b><span>${room}</span></header><div class="msg"><img alt="" src="${data.art.fuseC}"><p>seed ${data.prints.fuseC.seed} · ${esc(data.pinsLine)}</p></div>`);
      const msg = panel.querySelector(".msg");
      const fly = mk("div", "w plane", g, plane);
      cue({ t: t0, kind: "whoosh", gain: 0.1, dur: 0.6 });
      cue({ t: t0 + 0.6, kind: "chime", gain: 0.07 });
      act(W, (v) => {
        const p = EZ.out(seg(v, 0.2 + k * 0.1, 0.6 + k * 0.1));
        const m = EZ.out(seg(v, t0 + 0.55, t0 + 0.85));
        msg.style.opacity = m.toFixed(3);
        msg.style.transform = `translateY(${((1 - m) * 20).toFixed(1)}px)`;
        put(panel, { x: 380, y, ry: -10, o: p });
      }, panel);
      act(W, (v) => {
        const f = EZ.travel(seg(v, t0, t0 + 0.6));
        put(fly, { x: quad(-480, -60, 150, f), y: quad(-120, y - 260, y, f), rz: lerp(-20, 10, f), s: lerp(1.3, 0.6, f), o: v > t0 && v < t0 + 0.62 ? 1 : 0 });
      }, fly);
    });
  });

  // 4 分頁標題：切到別的分頁，墨池的分頁標題自己報進度。
  shot(4, (g, act, cue) => {
    const bw = mk("div", "w browser", g);
    const tabs = mk("div", "br-tabs", bw);
    mk("span", "br-tab", tabs, "GitHub · danbooru_tag_mochi");
    mk("span", "br-tab is-front", tabs, "文件 · README");
    const ours = mk("span", "br-tab is-ours", tabs);
    mk("div", "br-page", bw, "<i></i><i></i><i></i><i></i>");
    const big = mk("div", "w tab-big", g);
    const P0 = 0.3;
    const P1 = 2.4;
    act(W, (v) => {
      const p = EZ.out(seg(v, 0, 0.4));
      const f = EZ.lin(seg(v, P0, P1));
      const done = v >= P1 + 0.05;
      const title = done ? "印好了 · 墨池" : `${Math.round(f * 100)}% · 墨池`;
      setHTML(ours, `<i style="--f:${(done ? 1 : f).toFixed(3)}"></i>${title}`);
      setHTML(big, `<i style="--f:${(done ? 1 : f).toFixed(3)}"></i>${title}`);
      big.classList.toggle("is-done", done);
      put(bw, { x: 0, y: -170, rx: 10, o: p });
      put(big, { x: 0, y: 190, s: 1 + spring(v - P1 - 0.05, 0.06, 7, 20), o: EZ.out(seg(v, 0.2, 0.6)) });
    }, bw);
    for (let k = 0; k < 10; k++) cue({ t: P0 + k * 0.21, kind: "tick", gain: 0.03 });
    cue({ t: P1 + 0.05, kind: "chime", gain: 0.1 });
  });

  // 5 本機、開源：黑窗一行行印出來，蓋一個 MIT 的章。
  shot(5, (g, act, cue) => {
    const term = mk("div", "w term", g, `<header><i></i><i></i><i></i><span>start.bat</span></header>`);
    const body = mk("pre", "", term);
    const LINES = [
      ["$ start.bat", "cmd"],
      ["Python 3 · 標準函式庫，不用裝任何套件", ""],
      ["ComfyUI ✓ 127.0.0.1:8188", "ok"],
      [`卡面 ✓ ${data.artCount.toLocaleString("en-US")} 張`, "ok"],
      ["墨池    http://127.0.0.1:8796", ""],
      ["Tailscale http://100.x.x.x:8796", ""],
      ["只收本機與 Tailscale 的連線", "dim"],
    ];
    LINES.forEach((_, k) => cue({ t: 0.2 + k * 0.22, kind: "tick", gain: 0.05 }));
    act(W, (v) => {
      const p = EZ.out(seg(v, 0, 0.4));
      const n = Math.floor(seg(v, 0.2, 0.2 + LINES.length * 0.22) * LINES.length + 0.001);
      setHTML(body, LINES.slice(0, n).map(([s, c]) => `<span class="${c}">${esc(translate(s))}</span>`).join("\n") + (Math.floor(v * 3) % 2 ? "▍" : ""));
      put(term, { x: -150, y: -20, ry: 10, o: p });
    }, term);
    const mit = mk("div", "w mit", g, "MIT<small>開源 · 自由改</small>");
    cue({ t: 2.2, kind: "stamp", gain: 0.4 });
    act(W, (v) => {
      const p = seg(v, 2.05, 2.2);
      put(mit, { x: 560, y: 150, s: lerp(2.4, 1, EZ.out(p)) + spring(v - 2.2, 0.05, 8, 22), rz: -14, o: Math.min(1, p * 3) });
    }, mit);
  });

  const TEXT = [
    ["固定種子：*同一種雜訊*，換字比較", "Pin the seed — same noise, different words"],
    ["你自己的 ComfyUI 工作流、LoRA，*直接接上*", "Bring your own ComfyUI workflow and LoRAs"],
    ["手機走 Tailscale 也能畫：*斷線自動接回*", "Render from your phone — dropped connections reattach"],
    ["每張成圖，*自動送到* Telegram、Discord", "Every print, posted to Telegram and Discord"],
    ["切到別的分頁，*標題也在報進度*", "Switch tabs — the title keeps reporting progress"],
    ["全部在你的機器上跑 · *開源 MIT*", "Runs on your machine — open source, MIT"],
  ];
  const T0 = bar(66);
  TEXT.forEach(([zh, en], i) => say(zh, en, T0 + i * SHOT + 0.25, T0 + (i + 1) * SHOT - 0.35));

  // 鏡頭：每個鏡頭自己慢慢推、微微轉；鏡頭之間硬切（轉場加甩鏡）。
  S.cam = (u) => {
    const i = Math.min(5, Math.floor(u / SHOT));
    const v = u - i * SHOT;
    const e = EZ.out(seg(v, 0, SHOT));
    const dir = i % 2 ? 1 : -1;
    return V(i * GAP + dir * lerp(60, -40, e), lerp(-10, 10, e), lerp(-240, -60, e), 6, dir * lerp(10, 4, e), 0);
  };
}

/* ================= 結尾 ================= */

function buildFinale(data) {
  const S = scene("finale", { tint: [0.6, 0.04, 250] });
  const F = bar(78);
  slam({ zh: "排字匣", en: "TAG CASE", sub: "看中文、送英文，*規則替你把關*", x: 470, y: 470, inAt: F + 0.1, outAt: bar(80) - 0.3 });
  slam({ zh: "墨池", en: "MOCHI", sub: "每個字都是一張牌，*放進去的一定有*", x: 1450, y: 470, inAt: bar(80), outAt: bar(82) - 0.3 });
  slam({ zh: "疊印台", en: "OVERPRINT", sub: "一張牌一層墨，*看得見引擎補了什麼*", x: 960, y: 470, inAt: bar(82), outAt: bar(83) + 1 });
  // 牌牆：整本詞庫。
  const wallCap = mk("div", "k k-wallcap", hudEl);
  wallCap.style.left = "960px";
  wallCap.style.top = "930px";
  gact([bar(83) + 0.5, bar(86) + 0.6], (t) => {
    const p = EZ.out(seg(t, bar(84), bar(84) + 0.6));
    const q = EZ.exit(seg(t, bar(86), bar(86) + 0.4));
    const v = Math.round(data.artCount * EZ.out(seg(t, bar(84), bar(85))));
    setHTML(wallCap, `<b>${v.toLocaleString("en-US")}</b> 張牌面，每一張都是 ComfyUI 畫的<small>EVERY CARD FACE PAINTED BY COMFYUI</small>`);
    wallCap.style.opacity = (p * (1 - q)).toFixed(3);
    wallCap.style.transform = `translate(-50%, -50%) translateY(${((1 - p) * 20).toFixed(1)}px)`;
  }, wallCap);

  const TT = bar(87) + 0.2;
  kinetic({ cls: "k-title", zh: "排字匣", en: "DANBOORU CASE", x: 960, y: 400, align: "center", inAt: TT, outAt: bar(94) + 1, st: 0.1 });
  kinetic({ cls: "k-cap", zh: "排字匣　·　墨池　·　疊印台", en: "TAG CASE · MOCHI · OVERPRINT", x: 960, y: 620, align: "center", inAt: TT + 0.8, outAt: bar(94) + 1, st: 0.04 });
  const cmd = "git clone https://github.com/bosen12/danbooru_tag_mochi";
  const mono = mk("div", "k k-mono", hudEl);
  mono.style.left = "960px";
  mono.style.top = "770px";
  const C0 = bar(89);
  const C1 = bar(90) + 0.4;
  for (let i = 0; i < cmd.length; i += 2) gcues.push({ t: C0 + (i / cmd.length) * (C1 - C0), kind: "tick", gain: 0.04 });
  gact([C0 - 0.2, bar(95)], (t) => {
    const k = Math.floor(seg(t, C0, C1) * cmd.length);
    const q = EZ.exit(seg(t, bar(94) + 1, bar(94) + 1.6));
    const tail = t > C1 + 0.5 ? `<br><span class="dim">start.bat → http://127.0.0.1:8796/intro.html</span>` : "";
    const caret = Math.floor(t * 2.4) % 2 ? "" : "▍";
    setHTML(mono, `<span class="prompt">$</span> ${esc(cmd.slice(0, k))}${t < C1 + 0.3 ? caret : ""}${tail}`);
    mono.style.transform = "translate(-50%, 0)";
    mono.style.opacity = (Math.min(1, seg(t, C0 - 0.2, C0 + 0.1)) * (1 - q)).toFixed(3);
  }, mono);
  const black = mk("div", "k fade-black", hudEl);
  gact([bar(94), LENGTH + 5], (t) => {
    black.style.opacity = EZ.inOut(seg(t, bar(95) - 0.4, LENGTH - 0.3)).toFixed(3);
  }, black);
  S.cam = () => V(0, 0, 0);
}

/* ================= 章節、字幕（影片時間） ================= */

function buildCaptions() {
  chapter("01", "排字匣", "TAG CASE", bar(10) + 0.2, bar(12) + 1);
  say("看中文，*送英文*給 ComfyUI", "Read it in Chinese — ComfyUI gets the English tags", bar(10) + 0.7, bar(12) + 1.4);
  say("衝突的字不會同框；*附帶的一起帶上*", "Clashing tags never share a frame; implied ones come along", bar(13) + 0.2, bar(15) + 1.4);
  say("按一下，*整組抽齊*——而且種子重播得出來", "One press fills the rest — and every seed replays exactly", bar(22) + 0.3, bar(24) + 1.3, { y: 150 });
  chapter("02", "墨池", "MOCHI", bar(25) + 0.3, bar(27));
  say("每一個字，都是一張*有插畫的牌*", "Every word is an illustrated card", bar(27) + 0.3, bar(29));
  say("放進合成池的，*每張圖都一定有*", "Whatever sits in the pool is in every image", bar(29) + 0.4, bar(31) + 0.6);
  say("送去 ComfyUI，*即時預覽*、就地顯影", "Sent to ComfyUI — live preview, developed in place", bar(32) + 0.3, bar(34) + 1.4);
  say("找牌：打字，*按 Enter 就放上*", "Search — type it, press Enter, it's placed", bar(42) + 0.4, bar(44) + 0.2);
  say("拖到托盤：*放在哪，就插在哪*", "Drag to the tray — it lands right where you drop it", bar(44) + 0.6, bar(45) + 1.5);
  say("偏好卡牌：最常用的十張，*隨手打出*", "Favorites — your ten, one tap away", bar(46) + 0.3, bar(47) + 1.4);
  say("清版有去處；*撤回就原路飛回*", "Clear has somewhere to go — undo flies it all back", bar(48) + 0.4, bar(50) + 1.4);
  chapter("03", "疊印台", "OVERPRINT", bar(51) + 0.2, bar(53));
  const O = (t) => bar(51) + (t - 70) * 0.75;
  say("一張牌，*就是一層墨*", "Every card is a layer of ink", O(71.8), O(75.8));
  say("牌自己落進*它花色的那一層*", "Each card falls into the layer of its suit", O(76.4), O(80.4));
  say("灰色的影子：*引擎替你補的牌*", "Grey shadows — the cards the engine fills in", O(80.9), O(85.7));
  say("四張試印，每疊一張 *25ms 重抽*", "Four proofs, redrawn in 25 ms with every card", O(86.0), O(93.9));
  say("牌跟牌的關係，*畫在版上*", "Relations are drawn right on the plate", O(95.1), O(99.8));
  say("疊好了，*就付印*", "Stack it. Then print.", O(100.3), O(104.4));
  say("晾紙繩：*每一張都能回到那一版*", "The drying line — every print leads back to its plate", O(104.9), bar(66) - 0.35);
}

/* ================= 轉場 ================= */

// [時間, 種類, 參數]：whip＝甩鏡（dir 往哪邊甩）、ink＝墨從角落漫過來、flash＝白閃、zoom＝衝進去。
const CUTS = [
  [bar(10), "flash"],
  [bar(16), "whip", 1],
  [bar(22), "whip", -1],
  [bar(25), "ink", "0% 100%"],
  [bar(35), "zoom"],
  [bar(39), "whip", 1],
  [bar(42), "whip", -1],
  [bar(46), "whip", 1],
  [bar(48), "whip", -1],
  [bar(51), "ink", "100% 0%"],
  [bar(51), "flash"],
  [bar(66), "flash"],
  [bar(68), "whip", 1],
  [bar(70), "whip", -1],
  [bar(72), "whip", 1],
  [bar(74), "whip", -1],
  [bar(76), "whip", 1],
  [bar(78), "flash"],
];
const WHIP = 0.24;
for (const [at, kind] of CUTS) {
  if (kind === "whip") gcues.push({ t: at - 0.22, kind: "whoosh", gain: 0.12, dur: 0.45 });
  if (kind === "zoom") gcues.push({ t: at - 0.35, kind: "whoosh", gain: 0.14, dur: 0.6 });
}

/** 這一格的轉場效果：{ dx, s, blur, flash, ink }。 */
function cutFx(T) {
  const fx = { dx: 0, s: 1, blur: 0, flash: 0, ink: null };
  for (const [at, kind, arg] of CUTS) {
    const d = T - at;
    if (d < -1 || d > 1.2) continue;
    if (kind === "whip" && Math.abs(d) < WHIP) {
      const dir = arg;
      fx.dx += d < 0 ? -dir * 1100 * EZ.in(seg(d, -WHIP, 0)) : dir * 1100 * (1 - EZ.out(seg(d, 0, WHIP)));
      fx.blur = Math.max(fx.blur, (1 - Math.abs(d) / WHIP) * 26);
    } else if (kind === "zoom" && d > -0.45 && d < 0.4) {
      fx.s *= d < 0 ? 1 + EZ.in(seg(d, -0.45, 0)) * 1.4 : lerp(0.6, 1, EZ.out(seg(d, 0, 0.4)));
      fx.blur = Math.max(fx.blur, d < 0 ? EZ.in(seg(d, -0.45, 0)) * 30 : (1 - seg(d, 0, 0.4)) * 20);
      fx.flash = Math.max(fx.flash, d < 0 ? seg(d, -0.08, 0) * 0.6 : (1 - EZ.out(seg(d, 0, 0.3))) * 0.6);
    } else if (kind === "flash" && d > -0.12 && d < 0.8) {
      fx.flash = Math.max(fx.flash, d < 0 ? seg(d, -0.12, 0) * 0.85 : (1 - EZ.out(seg(d, 0, 0.75))) * 0.85);
    } else if (kind === "ink" && d > -0.8 && d < 1.0) {
      fx.ink = { grow: EZ.in(seg(d, -0.8, 0)), clear: EZ.out(seg(d, 0, 1.0)), from: arg };
    }
  }
  return fx;
}

/* ================= 背景（畫布） ================= */

const bg = $("bg");
const bgc = bg.getContext("2d");
function drawBg(T, tint, pulse) {
  const [l, c, h] = tint;
  bgc.fillStyle = "#07090d";
  bgc.fillRect(0, 0, 960, 540);
  const blobs = [
    [480 + Math.sin(T * 0.13) * 220, 250 + Math.cos(T * 0.11) * 90, 420, 0.22 + pulse * 0.06],
    [180 + Math.cos(T * 0.09) * 120, 430 + Math.sin(T * 0.17) * 60, 300, 0.12],
    [800 + Math.sin(T * 0.07 + 1) * 120, 120 + Math.cos(T * 0.12) * 70, 260, 0.1],
  ];
  for (const [x, y, r, a] of blobs) {
    const g = bgc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `oklch(${(l * 0.45).toFixed(3)} ${(c * 0.6).toFixed(3)} ${h.toFixed(1)} / ${a.toFixed(3)})`);
    g.addColorStop(1, "oklch(0.1 0.01 250 / 0)");
    bgc.fillStyle = g;
    bgc.fillRect(0, 0, 960, 540);
  }
}

/* ================= 大鼓的震動 ================= */

const KICKS = buildEvents([]).filter((e) => e.kind === "kick").map((e) => e.t);
function kickPulse(T) {
  let lo = 0;
  let hi = KICKS.length - 1;
  if (hi < 0 || T < KICKS[0]) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (KICKS[mid] <= T) lo = mid;
    else hi = mid - 1;
  }
  const d = T - KICKS[lo];
  return d < 0.5 ? Math.exp(-d * 9) : 0;
}

/* ================= 畫一格 ================= */

function runActs(list, t) {
  for (const a of list) {
    const on = t >= a.win[0] && t <= a.win[1];
    if (a.el) {
      const want = on ? "" : "none";
      if (a.el.style.display !== want) a.el.style.display = want;
    }
    if (on) a.update(t);
  }
}

let gl = null;
const blurEl = $("whipblur");
const wipeEl = $("wipe");
const flashEl = $("flash");
let activeScene = null;

function render(T) {
  const [T0, , name, t0, k] = segAt(T);
  const S = SCENES[name];
  const t = t0 + (T - T0) * k;
  if (activeScene !== S) {
    for (const s of Object.values(SCENES)) {
      const on = s === S;
      s.root.style.display = on ? "" : "none";
      s.hud.style.display = on ? "" : "none";
    }
    activeScene = S;
  }
  const bars = T / bar(1);
  const kind = secAt(Math.floor(bars)).kind;
  const pulse = kind === "intro" || kind === "title" || kind === "break" || kind === "outro" || kind === "end" ? kickPulse(T) * 0.4 : kickPulse(T);
  drawBg(T, typeof S.tint === "function" ? S.tint(t) : S.tint, pulse);
  gl?.render(T, pulse);

  // 鏡頭＋撞擊的晃動＋大鼓的輕推＋轉場。
  const c = S.cam(t);
  const sh = shakeOf(S.shakes, t);
  const gsh = shakeOf(GLOBAL_SHAKES, T);
  world.style.transform = `translate3d(${(sh.x + gsh.x).toFixed(2)}px, ${(sh.y + gsh.y).toFixed(2)}px, ${c.z.toFixed(1)}px) rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg) rotateZ(${c.rz.toFixed(2)}deg) translate3d(${(-c.x).toFixed(1)}px, ${(-c.y).toFixed(1)}px, 0)`;
  const fx = cutFx(T);
  const punch = 1 + pulse * 0.012;
  worldBox.style.transform = fx.dx || fx.s !== 1 || punch !== 1 ? `translateX(${fx.dx.toFixed(1)}px) scale(${(fx.s * punch).toFixed(4)})` : "";
  if (fx.blur > 0.3) {
    blurEl.style.display = "";
    const b = `blur(${fx.blur.toFixed(1)}px)`;
    blurEl.style.backdropFilter = b;
    blurEl.style.webkitBackdropFilter = b;
  } else if (blurEl.style.display !== "none") blurEl.style.display = "none";
  flashEl.style.opacity = fx.flash > 0.004 ? fx.flash.toFixed(3) : "0";
  if (fx.ink) {
    wipeEl.style.clipPath = `circle(${(fx.ink.grow * 150).toFixed(1)}% at ${fx.ink.from})`;
    wipeEl.style.opacity = (1 - fx.ink.clear).toFixed(3);
    wipeEl.style.filter = fx.ink.clear > 0.01 ? `blur(${(fx.ink.clear * 30).toFixed(1)}px)` : "";
  } else wipeEl.style.clipPath = "circle(0% at 0% 100%)";

  runActs(S.acts, t);
  runActs(gacts, T);
}

const GLOBAL_SHAKES = [
  [bar(8), 16],
  [bar(51), 12],
  [bar(78), 14],
];

/* ================= 開機 ================= */

async function boot() {
  const status = $("load-status");
  const loadBar = $("load-bar");
  const [data, manifest] = await Promise.all([
    fetch("lexicon.json").then((r) => r.json()),
    fetch("cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  lib = buildLibrary(data, { ratingBlocked });
  assets = createAssets(manifest);
  lex = indexLexicon(data);
  settings = sanitizeSettings({ ...defaultSettings(data), rating: "general" }, data);
  await document.fonts.ready;

  // ---- 影片要用的資料（真的詞庫、真的引擎） ----
  const words = pickArt(
    ["1girl", "long hair", "red hair", "kimono", "cherry blossoms", "sunset", "smile", "standing", "school uniform", "night", "city lights", "rain", "umbrella", "glasses", "hoodie", "ponytail", "twintails", "blue eyes", "dress", "beach", "snow", "sitting", "library", "cafe", "sparkle", "lantern", "starry sky", "bicycle", "braid", "hat", "cat", "window", "flower", "sky", "cloud", "forest", "river", "street"],
    34
  );
  const typed = ["1girl", "long hair", "red hair", "kimono", "standing", "cherry blossoms", "sunset"];
  const pins = ["red hair", "kimono"];
  const draws = idata.cleanDraws(ENG, lex, settings, pins, 3, 1);
  const pool = pickArt(idata.MOCHI_POOL, 5);
  const wallExtra = pickArt(
    ["smile", "standing", "school uniform", "night", "city lights", "rain", "umbrella", "glasses", "hoodie", "ponytail", "twintails", "blue eyes", "dress", "beach", "snow", "sitting", "library", "cafe", "sparkle", "lantern", "starry sky", "bicycle", "braid", "long hair", "hat", "forest", "river", "street", "window", "cloud", "flower", "short hair", "sky"],
    36 - pool.length
  );
  for (const c of lib.cards) {
    if (wallExtra.length >= 36 - pool.length) break;
    if (!pool.includes(c.tag) && !wallExtra.includes(c.tag) && hasArt(c.tag)) wallExtra.push(c.tag);
  }
  const wall = [];
  const slots = [10, 13, 16, 20, 23];
  let e = 0;
  for (let i = 0; i < 36; i++) {
    const pk = slots.indexOf(i);
    wall.push(pk >= 0 && pool[pk] ? pool[pk] : wallExtra[e++] || pool[0]);
  }
  const tray = pickArt(["smile", "night", "lantern", "sparkle", "umbrella", "starry sky"], 5);

  // 疊印台：真的 placeCard 一張張放（互斥、附帶都照引擎）。
  let bed = emptyBed();
  const placeOrder = idata.FUSE_ORDER.filter((t) => lib.byTag.has(t));
  for (const t of placeOrder) bed = placeCard(bed, t, { lex, applyPin }).bed;
  const rows = Object.fromEntries(REGISTERS.map((s) => [s, []]));
  for (const t of bed.pins) rows[suitOf(t)].push(t);
  const DROP0 = obar(30, 2);
  const drops = [];
  let n = 0;
  for (const t of placeOrder) {
    if (!bed.pins.includes(t)) continue;
    const suit = suitOf(t);
    drops.push({ tag: t, suit, k: rows[suit].indexOf(t), at: DROP0 + n * 0.625, carried: false });
    for (const [child, parent] of Object.entries(bed.carried)) {
      if (parent === t) drops.push({ tag: child, suit: suitOf(child), k: rows[suitOf(child)].indexOf(child), at: DROP0 + n * 0.625 + 0.45, carried: true });
    }
    n++;
  }
  const prints = idata.filmPrints(ENG, lex, settings);
  const trials = prints.trials.map(({ seed, tags }) => {
    const r = Object.fromEntries(REGISTERS.map((s) => [s, []]));
    for (const t of tags) {
      if (bed.pins.includes(t) || !hasArt(t) || BAD.test(t)) continue;
      const s = suitOf(t);
      if (r[s].length < 5) r[s].push(t);
    }
    return { seed, rows: r };
  });
  const glowAt = drops.map((d) => [d.suit, d.at + 0.42]);
  const glow = (suit, t) => glowAt.some(([s, at]) => s === suit && t >= at && t < at + 0.5);

  // 成品圖：ComfyUI 畫的（沒有 intro-art 就退回櫻花那張牌的插畫，影片照樣能看）。
  const artManifest = await fetch("intro-art/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const art = Object.fromEntries(["mochi", "fuseA", "fuseB", "fuseC"].map((k) => [k, artManifest[k] ? `intro-art/${artManifest[k].file}?v=${artManifest[k].seed}` : assets.art("cherry blossoms")]));

  // 墨池成品用了哪些牌：你放的（池子）、引擎抽的（摘乾淨、有插畫的）。
  const engineCards = prints.mochi.tags.filter((t) => !pool.includes(t) && hasArt(t) && !BAD.test(t)).slice(0, 8);
  const mochiCards = pool.length + prints.mochi.tags.filter((t) => !pool.includes(t) && lib.byTag.has(t)).length;
  // 無限抽的牆：四張真的成品，其餘用場景牌的插畫（也是 ComfyUI 烘的）。
  const wallImgs = [art.mochi, art.fuseA, art.fuseB, art.fuseC, ...["starry sky", "cherry blossoms", "city lights", "rain", "beach", "snow", "forest", "library", "cafe", "sunset", "lantern", "river"].filter(hasArt).slice(0, 12).map((t) => assets.art(t))];

  // 時代：真的讀每張牌的 era。
  const eraTags = pickArt(["kimono", "torii", "samurai", "shrine", "paper lantern", "jeans", "skyscraper", "headphones", "school uniform", "plate armor", "castle", "knight", "sneakers", "armor", "hanfu"], 10);
  const era = eraTags.map((tag) => {
    const eras = lib.byTag.get(tag).eras;
    const fit = Object.fromEntries(["modern", "ancient_china", "medieval", "edo", "victorian"].map((k) => [k, eras.includes("any") || eras.includes(k)]));
    return { tag, fit };
  });
  const tiers = [
    lib.cards.filter((c) => c.rating === "general").length,
    lib.cards.filter((c) => c.rating !== "explicit").length,
    lib.cards.length,
  ];
  const artCount = lib.cards.filter((c) => assets.art(c.tag)).length;

  // ---- 搭景 ----
  buildOpen({ words, tagCount: data.tags.length });
  const caseData = { typed, pins, draws, words, count: lib.cards.length };
  buildTagCase(caseData);
  buildEra({ era, tiers });
  buildMochi({ wall, pool, tray, art, prints, cardCount: mochiCards });
  buildDetail({ art, prints, yours: pool, engine: engineCards, wallImgs });
  buildHires({ art });
  buildSearch({
    grid: pickArt(["red hair", "school uniform", "night", "smile", "kimono", "umbrella", "sunset", "lantern", "snow", "cafe", "starry sky", "library"], 12),
    q1: "red hair",
    q2: "kimono",
    drag: "starry sky",
    tray: tray.slice(0, 4),
    gapAt: 2,
    dropX: 0,
  });
  buildUndo({
    row: pickArt(["1girl", "red hair", "kimono", "smile", "sunset", "lantern"], 6),
    favs: ["smile", "lantern"].filter(hasArt),
    tray: pickArt(["night", "umbrella", "sparkle", "starry sky", "rain"], 3),
  });
  buildOverprint({ rows, drops, trials, glow, art, prints });
  buildMontage({ art, prints, typed, artCount, pinsLine: prints.fuseC.tags.filter((t) => !BAD.test(t)).slice(0, 5).join(", ") + ", …" });
  buildFinale({ artCount });
  buildCaptions();

  // ---- 星河（three.js）：有插畫的全年齡牌，照花色排 ----
  const R = rng(3);
  const glCards = lib.cards
    .filter((c) => hasArt(c.tag))
    .map((c) => ({ c, k: R() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 640)
    .map(({ c }) => c)
    .sort((a, b) => CARD_SUITS.indexOf(a.suit) - CARD_SUITS.indexOf(b.suit));
  const COLOR = { cast: "#8ea6c9", look: "#d07f8e", wear: "#a58bcf", pose: "#5fb096", scene: "#c9a45e", style: "#a9b76a" };
  const thumbOf = (tag) => {
    const s = assets.sources(tag);
    return s?.srcset ? s.srcset.split(" ")[0] : s?.src || null;
  };
  status.textContent = "排星河 · Building the galaxy";
  gl = await createGL(
    $("gl"),
    glCards.map((c) => ({ zh: english ? c.tag : c.zh, glyph: english ? ["C", "A", "W", "P", "S", "F"][CARD_SUITS.indexOf(c.suit)] : CARD_SUIT_INFO[c.suit].glyph, color: COLOR[c.suit], suitIndex: CARD_SUITS.indexOf(c.suit), src: thumbOf(c.tag) })),
    {
      onProgress(done, total) {
        loadBar.style.transform = `scaleX(${((done / total) * 0.5).toFixed(3)})`;
        status.textContent = `排星河 ${done}/${total} · Building the galaxy`;
      },
    }
  ).catch(() => null);
  if (!gl) $("gl").style.display = "none";

  // ---- 等圖都載好（最多十五秒） ----
  const imgs = [...stage.querySelectorAll("img")];
  let done = 0;
  const tick = () => {
    done++;
    loadBar.style.transform = `scaleX(${(0.5 + (done / imgs.length) * 0.5).toFixed(3)})`;
    status.textContent = `載入插畫 ${done}/${imgs.length} · Loading art`;
  };
  await Promise.race([
    Promise.all(
      imgs.map((im) =>
        im.complete
          ? (tick(), null)
          : new Promise((r) => {
              im.addEventListener("load", () => (tick(), r()), { once: true });
              im.addEventListener("error", () => (tick(), r()), { once: true });
            })
      )
    ),
    new Promise((r) => setTimeout(r, 15000)),
  ]);
  status.textContent = assets.count() ? "好了 · Ready" : "還沒有卡面插畫：牌會是字的佔位牌 · No card art yet — cards show placeholders";
  return [...gcues, ...Object.values(SCENES).flatMap(sceneCuesToFilm)];
}

/* ================= 播放控制 ================= */

let score = null;
let tPaused = 0;

const clock = () => (score && score.playing ? Math.min(LENGTH, score.now()) : tPaused);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

let drawnAt = -1;
function frame() {
  const t = clock();
  // 暫停時同一格不用一直重畫（停在星河那幾秒，WebGL 每一幀重畫會一直吃 GPU）。
  if (t !== drawnAt) {
    render(t);
    drawnAt = t;
  }
  $("fill").style.transform = `scaleX(${(t / LENGTH).toFixed(4)})`;
  $("time").textContent = `${fmt(t)} / ${fmt(LENGTH)}`;
  if (t >= LENGTH - 0.01 && score?.playing) {
    score.pause();
    tPaused = LENGTH;
    showGate(true);
  }
  requestAnimationFrame(frame);
}

function play(from = tPaused) {
  tPaused = from;
  score.play(from);
  $("pp").innerHTML = PAUSE_ICON;
}
function pause() {
  tPaused = clock();
  score.pause();
  $("pp").innerHTML = PLAY_ICON;
}
function seek(t) {
  const to = Math.max(0, Math.min(LENGTH - 0.05, t));
  if (score.playing) score.play(to);
  tPaused = to;
}

const PLAY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>';

function showGate(replay) {
  $("gate").classList.remove("is-gone");
  if (replay) {
    $("play").querySelector("span").textContent = "再播一次 Replay";
    tPaused = 0;
  }
}

function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `scale(${s})`;
}

let idle = 0;
function wake() {
  $("bar").classList.add("is-shown");
  $("frame").classList.remove("is-idle");
  clearTimeout(idle);
  idle = setTimeout(() => {
    $("bar").classList.remove("is-shown");
    $("frame").classList.add("is-idle");
  }, 2200);
}

/** 閘門上的版本選擇：三分鐘完整版在這一頁；使用教學（墨池・疊印台）在 tutorial.html。 */
function wireCuts() {
  const box = $("cuts");
  if (!box) return;
  for (const b of box.querySelectorAll("button")) {
    b.setAttribute("aria-checked", b.dataset.cut === "full" ? "true" : "false");
    b.addEventListener("click", () => {
      if (b.dataset.cut === "full") return $("play").focus();
      location.href = new URL("tutorial.html", location.href).href;
    });
  }
}

async function main() {
  wireCuts();
  fit();
  addEventListener("resize", fit);
  const q = new URLSearchParams(location.search);
  tPaused = Math.max(0, Math.min(LENGTH - 1, parseFloat(q.get("t")) || 0));
  const cues = await boot();
  score = createScore(cues);
  render(tPaused);
  requestAnimationFrame(frame);
  const btn = $("play");
  btn.disabled = false;
  btn.focus();
  btn.addEventListener("click", () => {
    $("gate").classList.add("is-gone");
    play(tPaused >= LENGTH - 0.1 ? 0 : tPaused);
    wake();
  });
  $("pp").innerHTML = PLAY_ICON;
  $("pp").addEventListener("click", () => (score.playing ? pause() : play()));
  $("track").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * LENGTH);
  });
  addEventListener("mousemove", wake);
  addEventListener("keydown", (e) => {
    if (!$("gate").classList.contains("is-gone")) return;
    if (e.key === " ") {
      e.preventDefault();
      score.playing ? pause() : play();
    } else if (e.key === "ArrowRight") seek(clock() + 5);
    else if (e.key === "ArrowLeft") seek(clock() - 5);
    else if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } else if (e.key === "m" || e.key === "M") score.setMuted(!score.muted);
    else if (e.key === "r" || e.key === "R") seek(0);
    wake();
  });
  // 測試、錄影用：不出聲，直接畫某一格。介面跟兩分鐘版一樣（scripts/export_intro_video.mjs 用）。
  window.__intro = {
    seek(t) {
      tPaused = t;
      render(t);
      drawnAt = t;
      return t;
    },
    /** 輸出影片檔用：整首配樂離線算好，存成 16-bit WAV，用 wavChunk(i) 一段段拿（base64）。回傳段數。 */
    async renderAudio() {
      const buf = await score.render(48000);
      const n = buf.length;
      const ch = [buf.getChannelData(0), buf.getChannelData(1)];
      const bytes = new Uint8Array(44 + n * 4);
      const dv = new DataView(bytes.buffer);
      const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
      str(0, "RIFF");
      dv.setUint32(4, 36 + n * 4, true);
      str(8, "WAVEfmt ");
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, 2, true);
      dv.setUint32(24, 48000, true);
      dv.setUint32(28, 48000 * 4, true);
      dv.setUint16(32, 4, true);
      dv.setUint16(34, 16, true);
      str(36, "data");
      dv.setUint32(40, n * 4, true);
      let o = 44;
      for (let i = 0; i < n; i++) {
        for (const c of ch) {
          const v = Math.max(-1, Math.min(1, c[i]));
          dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
          o += 2;
        }
      }
      const SIZE = 3 << 20;
      window.__wavParts = [];
      for (let i = 0; i < bytes.length; i += SIZE) {
        let bin = "";
        const part = bytes.subarray(i, i + SIZE);
        for (let k = 0; k < part.length; k += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(k, k + 0x8000));
        window.__wavParts.push(btoa(bin));
      }
      return window.__wavParts.length;
    },
    wavChunk(i) {
      return window.__wavParts[i];
    },
    jump(t) {
      seek(t);
      return t;
    },
    get time() {
      return clock();
    },
    length: LENGTH,
    gl: () => !!gl,
  };
}

main();
