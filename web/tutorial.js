/**
 * 墨池、疊印台的使用教學影片（四分半）。畫面、配樂都在這一頁即時產生：
 *   墨池、疊印台的介面畫成一台螢幕（tut-mochi.js、tut-fuse.js），游標在裡面點、拖、按；
 *   牌是真的牌、規則是真引擎算的（誰帶誰、誰擠掉誰、什麼時代、相剋），成品是 ComfyUI 真的畫的。
 *   鏡頭在螢幕前推、拉、甩，字幕一步一步說「這一步做什麼」，需要按鍵的時候角落壓一個鍵帽。
 *
 * 跟介紹影片（film.js）一樣：每個東西都有 update(t)，只看時間 t —— 可以任意快轉、倒轉、一格一格輸出。
 * 播放時 t 取自配樂的時鐘（tutorial-score.js，112 BPM），畫面永遠跟音樂對齊：點擊、按鍵、牌落地都排在拍子上。
 *
 *   0:00  開場：三張牌、一次生圖，然後才說「這是什麼」
 *   0:13  墨池：認識畫面 → 放牌的三種方法 → 牌跟牌的關係 → 規則 → 抽牌與生圖 → 成品牆 → 偏好卡牌與廢字簍
 *   2:19  疊印台：一張牌一層墨 → 放牌 → 影子與關係 → 四張試印 → 付印與晾紙 → 撤回、清版、起手式
 *   3:55  收尾：所有快捷鍵一次看完
 * 測試用：window.__intro.seek(秒) 直接畫出那一格（不出聲）；網址 ?t=秒 從那裡開始。輸出影片檔的介面跟介紹影片一樣。
 */
import { createScore, buildEvents, bar, BEAT, LENGTH, secAt } from "./tutorial-score.js";
import { buildLibrary as buildCardLibrary, createAssets } from "./cards.js";
import { ratingBlocked } from "./rules/rating.js";
import { indexLexicon, defaultSettings, sanitizeSettings, drawOne, mulberry32, applyPin } from "./engine.js";
import { emptyBed, placeCard } from "./fuse-bed.js";
import * as idata from "./intro-data.js";
import { EZ, seg, lerp, spring, mk, esc, rng } from "./film-kit.js";
import { makeText } from "./film-text.js";
import { env, V, keycaps } from "./tut-kit.js";
import { CHAPTERS, chapterAt } from "./tut-chapters.js";
import { buildOpen } from "./tut-open.js";
import { buildMochiScene } from "./tut-mochi-a.js";
import { buildFuseScene } from "./tut-fuse.js";
import { buildOutro } from "./tut-outro.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const world = $("world");
const worldBox = $("world-box");
const hudEl = $("hud");

/* ================= 幕、字幕 ================= */

const SCENES = {};
const gacts = []; // 影片時間 T 的東西（字幕、鍵帽、進度點）
const gcues = []; // 影片時間 T 的音效
const gact = (win, update, el = null) => gacts.push({ win, update, el });
const text = makeText({ hud: hudEl, on: gact });

/**
 * 畫面下方的字幕（step、say）都先排隊，全部場景建好之後照時間排序才做出來（flushCaptions）：
 * 下一句要進來之前，上一句一定已經離場 —— 不會兩句疊在一起。
 */
const captionQueue = [];
const queueStep = (n, zh, en, inAt, outAt, o = {}) => captionQueue.push({ kind: "step", args: [n, zh, en], inAt, outAt, o });
const queueSay = (zh, en, inAt, outAt, o = {}) => captionQueue.push({ kind: "say", args: [zh, en], inAt, outAt, o });
function flushCaptions() {
  captionQueue.sort((a, b) => a.inAt - b.inAt);
  captionQueue.forEach((c, i) => {
    const next = captionQueue[i + 1];
    // 離場要 0.3 秒多（一個字一個字走）：下一句進來前 0.45 秒就開始走。
    const outAt = next ? Math.max(c.inAt + 0.8, Math.min(c.outAt, next.inAt - 0.45)) : c.outAt;
    if (c.kind === "step") makeStep(...c.args, c.inAt, outAt, c.o);
    else sayNow(...c.args, c.inAt, outAt, c.o);
  });
  captionQueue.length = 0;
}
const sayNow = text.say;

/** 這一步做什麼：左邊一個數字徽章，右邊一句話（重點用 *…* 上色），英文小字在下面。 */
function makeStep(n, zh, en, inAt, outAt, o = {}) {
  const box = text.kinetic({ cls: "k-step", zh, en, x: 960, y: 946, align: "center", inAt, outAt, st: 0.022, ...o });
  const w = box.offsetWidth || 900;
  const badge = mk("div", "tbadge", hudEl, String(n));
  badge.style.left = `${960 - w / 2 - 62}px`;
  badge.style.top = "922px";
  gact([inAt - 0.1, outAt + 0.6], (t) => {
    const p = EZ.out(seg(t, inAt, inAt + 0.4));
    const q = EZ.exit(seg(t, outAt, outAt + 0.3));
    badge.style.opacity = (Math.min(1, p * 2.4) * (1 - q)).toFixed(3);
    badge.style.transform = `scale(${(lerp(0.3, 1, p) + spring(t - inAt - 0.4, 0.06, 7, 22)).toFixed(3)})`;
  }, badge);
  return box;
}

/** 章節的進度點（上面那一排）：現在這章拉長、旁邊寫「墨池 03 · 名稱」。 */
function buildRail() {
  const rail = mk("div", "trail", hudEl);
  rail.style.left = "96px";
  rail.style.top = "56px";
  const dots = CHAPTERS.map((c, i) => {
    const d = mk("i", "", rail);
    if (c.part && i) d.style.marginLeft = "18px";
    return d;
  });
  const name = mk("span", "", rail);
  const first = bar(CHAPTERS[0].from) - 0.3;
  const last = bar(CHAPTERS[CHAPTERS.length - 1].to);
  gact([first, last], (t) => {
    const cur = chapterAt(t);
    const p = EZ.out(seg(t, first + 0.3, first + 1)) * (1 - EZ.exit(seg(t, last - 0.6, last)));
    rail.style.opacity = p.toFixed(3);
    dots.forEach((d, i) => {
      d.className = i < cur ? "done" : i === cur ? "now" : "";
    });
    if (cur >= 0) {
      const c = CHAPTERS[cur];
      const part = CHAPTERS.slice(0, cur + 1).reverse().find((k) => k.part)?.part || "";
      const s = `<b>${esc(part)} ${String(cur + 1).padStart(2, "0")}</b>${esc(c.zh)}`;
      if (name._h !== s) {
        name.innerHTML = s;
        name._h = s;
      }
    }
  }, rail);
}

/* ================= 背景 ================= */

const bg = $("bg");
const bgc = bg.getContext("2d");
function drawBg(T, tint, pulse) {
  const [l, c, h] = tint;
  bgc.fillStyle = "#07090d";
  bgc.fillRect(0, 0, 960, 540);
  const blobs = [
    [480 + Math.sin(T * 0.13) * 220, 250 + Math.cos(T * 0.11) * 90, 420, 0.22 + pulse * 0.05],
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

/* ================= 轉場 ================= */

// [時間, 種類, 參數]：whip＝畫面糊一下（鏡頭在甩）、ink＝墨從角落漫過來、flash＝白閃。
const CUTS = [];
const cut = (t, kind, arg) => CUTS.push([t, kind, arg]);
const WHIP = 0.3;

function cutFx(T) {
  const fx = { blur: 0, flash: 0, ink: null };
  for (const [at, kind, arg] of CUTS) {
    const d = T - at;
    if (d < -1 || d > 1.2) continue;
    if (kind === "whip" && Math.abs(d) < (arg || WHIP)) {
      const w = arg || WHIP;
      fx.blur = Math.max(fx.blur, (1 - Math.abs(d) / w) * 22);
    } else if (kind === "flash" && d > -0.12 && d < 0.8) {
      fx.flash = Math.max(fx.flash, d < 0 ? seg(d, -0.12, 0) * 0.85 : (1 - EZ.out(seg(d, 0, 0.75))) * 0.85);
    } else if (kind === "ink" && d > -0.8 && d < 1.0) {
      fx.ink = { grow: EZ.in(seg(d, -0.8, 0)), clear: EZ.out(seg(d, 0, 1.0)), from: arg || "0% 100%" };
    }
  }
  return fx;
}

/* ================= 大鼓的輕推 ================= */

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

/* ================= 撞擊時的鏡頭晃動 ================= */

function shakeOf(list, t) {
  let y = 0;
  for (const [at, amp] of list) {
    const d = t - at;
    if (d < 0 || d > 0.9) continue;
    y += amp * 0.35 * Math.sin(Math.min(1, d / 0.5) * Math.PI) * Math.exp(-d * 3);
  }
  return { x: 0, y };
}

/* ================= 畫一格 ================= */

// 影片的段落：[起, 迄, 幕]。每一幕自己的鏡頭、自己的東西；時間就是影片的時間。
const SEGS = [
  [0, bar(6), "open"],
  [bar(6), bar(66), "mochi"],
  [bar(66), bar(114), "fuse"],
  [bar(114), 1e9, "outro"],
];
const segAt = (T) => (SEGS.find(([a, b]) => T >= a && T < b) || SEGS[SEGS.length - 1])[2];

function runActs(list, t) {
  for (const a of list) {
    const [w0, w1] = a.win;
    if (t >= w0 && t <= w1) {
      if (a.el && a.el.style.display) a.el.style.display = "";
      a.update(t);
      a.side = 0;
    } else {
      // 窗外：跳著看（拖進度條）也要落在正確的「已結束／還沒開始」狀態 —— 邊界那一刻更新一次。
      const side = t < w0 ? -1 : 1;
      if (a.side !== side) {
        a.side = side;
        a.update(side < 0 ? w0 : w1);
      }
      if (a.el && a.el.style.display !== "none") a.el.style.display = "none";
    }
  }
}

const blurEl = $("whipblur");
const wipeEl = $("wipe");
const flashEl = $("flash");
let activeScene = null;

function render(T) {
  const S = SCENES[segAt(T)];
  if (activeScene !== S) {
    for (const s of Object.values(SCENES)) {
      const on = s === S;
      s.root.style.display = on ? "" : "none";
      s.hud.style.display = on ? "" : "none";
    }
    activeScene = S;
  }
  const kind = secAt(Math.floor(T / bar(1))).kind;
  const pulse = kind === "intro" || kind === "break" || kind === "end" ? kickPulse(T) * 0.4 : kickPulse(T);
  drawBg(T, typeof S.tint === "function" ? S.tint(T) : S.tint, pulse);

  const c = S.cam(T);
  const sh = shakeOf(S.shakes, T);
  world.style.transform = `translate3d(${sh.x.toFixed(2)}px, ${sh.y.toFixed(2)}px, ${c.z.toFixed(1)}px) rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg) rotateZ(${c.rz.toFixed(2)}deg) translate3d(${(-c.x).toFixed(1)}px, ${(-c.y).toFixed(1)}px, 0)`;
  const fx = cutFx(T);
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

  runActs(S.acts, T);
  runActs(gacts, T);
}

/* ================= 開機 ================= */

async function boot() {
  const status = $("load-status");
  const loadBar = $("load-bar");
  const [data, manifest] = await Promise.all([
    fetch("lexicon.json").then((r) => r.json()),
    fetch("cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  env.lib = buildCardLibrary(data, { ratingBlocked });
  env.assets = createAssets(manifest);
  env.lex = indexLexicon(data);
  env.settings = sanitizeSettings({ ...defaultSettings(data), rating: "general" }, data);
  env.data = data;
  await document.fonts.ready;

  // 成品圖：ComfyUI 畫的（沒有 intro-art 就退回櫻花那張牌的插畫，影片照樣能看）。
  const artManifest = await fetch("intro-art/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const art = Object.fromEntries(["mochi", "fuseA", "fuseB", "fuseC"].map((k) => [k, artManifest[k] ? `intro-art/${artManifest[k].file}?v=${artManifest[k].seed}` : env.assets.art("cherry blossoms")]));
  const ENG = { drawOne, mulberry32, applyPin, emptyBed, placeCard };
  const prints = idata.filmPrints(ENG, env.lex, env.settings);
  const shared = { art, prints, ENG, idata, data };

  const ctx = { world, hud: hudEl, gact, gcues, text: { ...text, say: queueSay }, step: queueStep, keycaps: (keys, o) => keycaps(hudEl, gact, keys, o), cut, shared, SCENES };
  buildOpen(ctx);
  buildMochiScene(ctx);
  buildFuseScene(ctx);
  buildOutro(ctx);
  flushCaptions();
  buildRail();

  // 等圖都載好（最多十五秒）
  const imgs = [...stage.querySelectorAll("img")];
  let done = 0;
  const tick = () => {
    done++;
    loadBar.style.transform = `scaleX(${(done / imgs.length).toFixed(3)})`;
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
  status.textContent = env.assets.count() ? "好了 · Ready" : "還沒有卡面插畫：牌會是字的佔位牌 · No card art yet — cards show placeholders";
  const cues = [...gcues, ...Object.values(SCENES).flatMap((s) => s.cues)];
  return cues;
}

/* ================= 播放控制 ================= */

let score = null;
let tPaused = 0;

const clock = () => (score && score.playing ? Math.min(LENGTH, score.now()) : tPaused);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

let drawnAt = -1;
function frame() {
  const t = clock();
  // 暫停時同一格不用一直重畫。
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

/** 閘門上的選片：介紹影片（intro.html）／使用教學（這一頁）。 */
function wireFilms() {
  const box = $("cuts");
  if (!box) return;
  $("len").textContent = fmt(LENGTH);
  for (const btn of box.querySelectorAll("button")) {
    btn.setAttribute("aria-checked", btn.dataset.film === "tutorial" ? "true" : "false");
    btn.addEventListener("click", () => {
      if (btn.dataset.film === "tutorial") return $("play").focus();
      location.href = new URL("intro.html", location.href).href;
    });
  }
}

async function main() {
  wireFilms();
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
  // 測試、錄影用：不出聲，直接畫某一格。介面跟介紹影片一樣（scripts/export_intro_video.mjs 用）。
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
    scenes: SCENES,
  };
}

// 幕在 builder 裡自己登記到這裡。
export { SCENES, V, rng, BEAT };

main();
