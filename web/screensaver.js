/**
 * 螢幕保護：閒置一陣子（預設 30 秒）就出來一條無盡的牌河；按 Enter 或空白鍵（或點一下）回到原本的畫面。
 * 滑鼠動到、滾輪不會把它關掉（2026-10-15 專案主：滑鼠很容易不小心動到），只讓右下的提示亮一下。
 *   - 牌照頂端的分級挑（或設定成只放全年齡），被封鎖的牌不出現；最近生成的圖晾在中間輪流飛過，
 *     剛印好的那張會飛到正前方顯影。要模糊的分級（預設色情）先糊掉再上場。
 *   - 3D 場景在 screensaver-gl.js（three.js），第一次要出來時才載入；沒有 WebGL 就不出來。
 *   - 回來的那一下（按鍵、點擊）會被吃掉，不會順便按到底下的按鈕或快捷鍵。
 *   - 設定（閒置多久、範圍、模糊）在頂欄的月亮鈕；只存在這台瀏覽器。
 * 墨池、疊印台、卡冊、作品冊都掛（mountScreensaver）；介紹影片、教學不掛。
 */
import { el, openSheet } from "./ui.js";
import { english, t } from "./i18n.js";
import { reducedMotion, DUR, CURVE, css } from "./motion.js";
import { buildLibrary, createAssets, CARD_SUITS, CARD_SUIT_INFO } from "./cards.js";
import { ratingBlocked } from "./rules/rating.js";
import { viewSrc } from "./gen.js";
import * as S from "./store.js";

const KEY = "mochi.screensaver.v1";
const DEFAULTS = { idle: 30, scope: "rating", blur: "explicit" };
const IDLE = [
  [0, "關"],
  [30, "30 秒"],
  [60, "1 分"],
  [180, "3 分"],
  [300, "5 分"],
  [600, "10 分"],
];
const SCOPE = [
  ["rating", "跟頂端分級"],
  ["general", "只放全年齡"],
];
const BLUR = [
  ["none", "不模糊"],
  ["explicit", "色情的"],
  ["sensitive", "敏感和色情的"],
];
const TIERS = ["general", "sensitive", "explicit"];
const ORIGIN_ZH = { mochi: "墨池", fuse: "疊印台", case: "排字匣" };
// 每一幕的片名（左邊浮出來的明體大字）。
const ACT_NO = ["第一幕", "第二幕", "第三幕", "第四幕"];
const ACT_TITLE = { river: "牌河", mandala: "牌陣", wave: "牌浪", rain: "墨雨" };
const SUIT_LETTER = { cast: "C", chara: "R", look: "A", wear: "W", pose: "P", scene: "S", style: "F" };
const SUIT_FALLBACK = { cast: "#8ea6c9", chara: "#7fb7c2", look: "#d07f8e", wear: "#a58bcf", pose: "#5fb096", scene: "#c9a45e", style: "#a9b76a" };
const MOON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3v3M15.5 4.5h3"/></svg>';

export function loadSaver() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return {
      idle: IDLE.some(([v]) => v === s?.idle) ? s.idle : DEFAULTS.idle,
      scope: SCOPE.some(([v]) => v === s?.scope) ? s.scope : DEFAULTS.scope,
      blur: BLUR.some(([v]) => v === s?.blur) ? s.blur : DEFAULTS.blur,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSaver(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 存不了：這次照樣用 */
  }
}

/** 照設定，哪些分級的牌和圖可以上場；哪些要糊掉。 */
function allowed(conf) {
  const rating = conf.scope === "general" ? "general" : S.loadSettings()?.rating || "general";
  return new Set(TIERS.slice(0, Math.max(1, TIERS.indexOf(rating) + 1)));
}
const blurred = (conf, rating) => (conf.blur === "explicit" ? rating === "explicit" : conf.blur === "sensitive" ? rating === "explicit" || rating === "sensitive" : false);

const preloadHref = (prefix, fallback) => document.querySelector(`link[rel="preload"][href^="${prefix}"]`)?.href || fallback;

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** 牌河用的牌：允許的分級、沒被封鎖；有插畫的優先（最多 220 張），沒插畫的混一點進去。 */
async function riverCards(conf) {
  const [data, manifest] = await Promise.all([
    fetch(preloadHref("lexicon.json", "lexicon.json")).then((r) => r.json()),
    fetch(preloadHref("cards/manifest.json", "cards/manifest.json")).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  const lib = buildLibrary(data, { ratingBlocked });
  const assets = createAssets(manifest);
  const ok = allowed(conf);
  const bans = new Set(S.loadBans());
  const root = getComputedStyle(document.documentElement);
  const color = (s) => root.getPropertyValue(`--suit-${s}`).trim() || SUIT_FALLBACK[s] || "#9aa";
  const pool = lib.cards.filter((c) => ok.has(c.rating) && !bans.has(c.tag));
  const thumb = (tag) => {
    const s = assets.sources(tag);
    return s?.srcset ? s.srcset.split(" ")[0] : s?.src || null;
  };
  const withArt = shuffle(pool.filter((c) => thumb(c.tag))).slice(0, 200);
  const without = shuffle(pool.filter((c) => !thumb(c.tag))).slice(0, withArt.length ? 24 : 180);
  riverCards.total = pool.length;
  return shuffle([...withArt, ...without]).map((c) => ({
    blur: blurred(conf, c.rating),
    name: english ? c.tag : c.zh,
    glyph: english ? SUIT_LETTER[c.suit] || "?" : CARD_SUIT_INFO[c.suit]?.glyph || "?",
    color: color(CARD_SUITS.includes(c.suit) ? c.suit : "cast"),
    src: thumb(c.tag),
  }));
}

/** 出圖日誌最近的幾張（印好的、不是 Hires 那筆）。 */
async function recentPrints(conf, limit = 24) {
  try {
    const r = await fetch(`/api/genlog?limit=${limit}`, { cache: "no-store" });
    if (!r.ok) return [];
    const ok = allowed(conf);
    return ((await r.json()).items || [])
      .filter((e) => e.ok && e.image && e.kind !== "hires" && ok.has(e.rating || "general"))
      .map((e) => ({ id: e.id || e.image, src: viewSrc(e.image), blur: blurred(conf, e.rating || "general"), origin: e.origin }));
  } catch {
    return [];
  }
}

let active = null;
let lastInput = performance.now();
let broken = false;

/** 現在就出來（「現在看看」、閒置到了）。 */
export async function startScreensaver() {
  if (active || broken) return;
  const conf = loadSaver();
  const calm = reducedMotion();
  const canvas = el("canvas", { class: "saver-gl", "aria-hidden": "true" });
  const fresh = el("p", { class: "saver-fresh", "aria-hidden": "true" });
  const title = el("div", { class: "saver-act", "aria-hidden": "true" });
  const clock = el("span", { class: "saver-clock" });
  // 右下時間左邊：正在印的那張到幾 %、排隊幾張、今晚印好幾張；ComfyUI 連不上也寫在這裡（renderStatus）。
  const status = el("span", { class: "saver-status" });
  const layer = el(
    "div",
    { class: "saver", id: "screensaver", role: "presentation" },
    canvas,
    title,
    fresh,
    el("div", { class: "saver-foot" }, el("span", { class: "saver-mark" }, "墨池"), el("span", { class: "saver-hint" }, matchMedia("(pointer: coarse)").matches ? "點一下回來" : "按 Enter 或空白鍵回來"), status, clock)
  );
  const state = { layer, gl: null, timer: 0, poll: 0, jobsPoll: 0, seen: new Set(), at: performance.now(), done: null, comfy: true, jobs: [] };
  active = state;
  document.body.append(layer);
  const tick = () => {
    const d = new Date();
    clock.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  tick();
  state.timer = setInterval(tick, 10000);
  if (!calm) layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.develop, easing: css(CURVE.out) });

  let mod;
  try {
    mod = await import("./screensaver-gl.js");
  } catch {
    broken = true;
    return stopScreensaver(true);
  }
  const [cards, prints] = await Promise.all([riverCards(conf).catch(() => []), recentPrints(conf)]);
  if (active !== state) return;
  if (!cards.length) return stopScreensaver(true);
  for (const p of prints) state.seen.add(p.id);
  const total = riverCards.total || cards.length;
  const subOf = {
    river: () => `${total.toLocaleString("en-US")} 張牌，從墨裡流過來`,
    mandala: () => (prints.length ? `一圈一圈轉成一朵花，中間是你最近印的 ${Math.min(prints.length, 6)} 張` : "一圈一圈，轉成一朵花"),
    wave: () => "翻過去，就換成別張",
    rain: () => "一張一張，落下來",
  };
  const gl = await mod.createSaverGL(canvas, cards, prints.slice(0, 16), {
    english,
    calm,
    onAct(act, n) {
      // 換幕：左邊浮出「第幾幕・片名・一句話」，字從糊到清楚、字距從寬收回來，停一下再淡掉。
      title.replaceChildren(
        el("span", { class: "saver-act-no" }, ACT_NO[n % ACT_NO.length]),
        el("b", { class: "saver-act-title" }, ACT_TITLE[act]),
        el("span", { class: "saver-act-sub" }, subOf[act]())
      );
      title.getAnimations().forEach((a) => a.cancel());
      if (calm) return title.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: DUR.story * 9, fill: "forwards" });
      title.animate(
        [
          { opacity: 0, filter: "blur(14px)", letterSpacing: "0.5em", transform: "translateY(10px)" },
          { opacity: 1, filter: "blur(0px)", letterSpacing: "0.18em", transform: "none", offset: 0.22 },
          { opacity: 1, filter: "blur(0px)", letterSpacing: "0.14em", transform: "none", offset: 0.78 },
          { opacity: 0, filter: "blur(8px)", letterSpacing: "0.1em", transform: "translateY(-6px)" },
        ],
        { duration: DUR.story * 10, delay: n ? DUR.breath : DUR.story, easing: css(CURVE.out), fill: "both" }
      );
    },
    onFresh(p) {
      fresh.textContent = `剛印好・${ORIGIN_ZH[p.origin] || "新的一張"}`;
      fresh.getAnimations().forEach((a) => a.cancel());
      fresh.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none", offset: 0.1 },
          { opacity: 1, transform: "none", offset: 0.8 },
          { opacity: 0, transform: "translateY(-4px)" },
        ],
        { duration: DUR.story * 8, easing: css(CURVE.out), fill: "forwards" }
      );
    },
  }).catch(() => null);
  if (active !== state) return gl?.stop();
  if (!gl) {
    broken = true;
    return stopScreensaver(true);
  }
  state.gl = gl;
  gl.start();
  canvas.classList.add("is-on");
  // 一律每秒最多 60 格。以前只有在印圖時才限，平常螢幕能跑多快就畫多快（165Hz 的螢幕每秒 165 格），
  // 螢幕保護常常一開就是一整晚，顯示卡白白多做將近三倍的工；60 格看起來一樣順。
  gl.setMaxFps(SAVER_FPS);
  const renderStatus = () => {
    if (active !== state) return;
    const run = state.jobs.find((j) => j.state === "running");
    const queued = state.jobs.filter((j) => j.state === "queued").length;
    const bits = [];
    if (run) bits.push(`${run.kind === "hires" ? (run.face ? "修臉" : "Hires") : "印製中"} ${Math.round((run.progress || 0) * 100)}%`);
    if (queued) bits.push(`排隊 ${queued} 張`);
    if (!run && !queued && !state.comfy) bits.push("ComfyUI 連不上");
    if (state.done && (state.done.n || run || queued)) bits.push(`${state.done.label}印好 ${state.done.n}${state.done.more ? "+" : ""} 張`);
    // 每一段各自翻（英文版畫面上永遠是英文，比對也要比翻過的）。
    const text = bits.map((b) => t(b)).join(english ? " · " : "・");
    const label = status.querySelector(".saver-status-text") || status.appendChild(el("span", { class: "saver-status-text" }));
    if (label.textContent !== text) label.textContent = text;
    status.dataset.on = text ? "true" : "false";
    status.dataset.warn = !run && !queued && !state.comfy ? "true" : "false";
    // 正在印的那張：字底下一條細線走進度。
    status.style.setProperty("--p", run ? String(run.progress || 0) : "0");
    status.dataset.running = run ? "true" : "false";
  };
  // 印製進度：每 2 秒問一次伺服器（墨池、疊印台、別的分頁送的都算）。
  const pollJobs = async () => {
    if (document.hidden || active !== state) return;
    const jobs = await activeJobs();
    if (jobs) state.jobs = jobs;
    renderStatus();
  };
  // 今晚印好幾張、ComfyUI 在不在：每 8 秒問一次。
  const pollCount = async () => {
    if (active !== state) return;
    const [done, up] = await Promise.all([printedTonight(), comfyUp()]);
    if (done) state.done = done;
    state.comfy = up;
    renderStatus();
  };
  pollJobs();
  pollCount();
  state.jobsPoll = setInterval(pollJobs, 2000);
  // 新印好的：每 8 秒看一次出圖日誌。
  state.poll = setInterval(async () => {
    if (document.hidden) return;
    pollCount();
    for (const p of (await recentPrints(loadSaver(), 8)).reverse()) {
      if (state.seen.has(p.id) || active !== state) continue;
      state.seen.add(p.id);
      gl.addFresh(p);
    }
  }, 8000);
}

const SAVER_FPS = 60;

/** 伺服器那邊還在排隊、正在畫、剛印完的工作（GET /api/gen/active）。問不到回 null（畫面照舊）。 */
async function activeJobs() {
  try {
    const r = await fetch("/api/gen/active", { cache: "no-store" });
    if (!r.ok) return null;
    const { jobs } = await r.json();
    return Array.isArray(jobs) ? jobs : null;
  } catch {
    return null;
  }
}

/** ComfyUI 在不在（/api/ping）。問不到伺服器也算不在。 */
async function comfyUp() {
  try {
    const r = await fetch("/api/ping", { cache: "no-store" });
    return r.ok && !!(await r.json()).ok;
  } catch {
    return false;
  }
}

/**
 * 「今晚」印好幾張：18:00 到隔天 06:00 算今晚（過了午夜不歸零，整晚無限抽才數得對），06:00～18:00 算今天。
 * 從出圖日誌數印好的（Hires、修臉不算一張）。
 */
export function nightWindow(now = new Date()) {
  const d = new Date(now);
  const h = d.getHours();
  if (h >= 18 || h < 6) {
    if (h < 6) d.setDate(d.getDate() - 1);
    d.setHours(18, 0, 0, 0);
    return { since: d.getTime(), label: "今晚" };
  }
  d.setHours(6, 0, 0, 0);
  return { since: d.getTime(), label: "今天" };
}

async function printedTonight() {
  const { since, label } = nightWindow();
  try {
    const r = await fetch("/api/genlog?limit=500", { cache: "no-store" });
    if (!r.ok) return null;
    const { items = [], more = false } = await r.json();
    const mine = items.filter((e) => e.ok && e.kind !== "hires" && (e.at || 0) >= since);
    // 一頁 500 筆全在這段時間裡、後面還有：寫「500+」。
    return { label, n: mine.length, more: more && mine.length === items.length };
  } catch {
    return null;
  }
}

/** 測試用：現在畫面上那一部（可以 seek 到某一幕）。 */
export const _saverGL = () => active?.gl || null;

/** 收起來：淡出、把 GPU 的東西都還回去。 */
export function stopScreensaver(now = false) {
  const state = active;
  if (!state) return;
  active = null;
  lastInput = performance.now();
  clearInterval(state.timer);
  clearInterval(state.poll);
  clearInterval(state.jobsPoll);
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    state.gl?.stop();
    state.layer.remove();
  };
  if (now || reducedMotion()) return done();
  state.layer.style.pointerEvents = "none";
  state.layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.long, easing: css(CURVE.exit), fill: "forwards" }).finished.then(done, done);
  // 保險：畫面忙（顯卡慢、分頁在背景）時動畫會被拖住，時間到一定收掉。
  setTimeout(done, DUR.long + DUR.short);
}

/** 設定：閒置多久、範圍、模糊。三排選項，換了馬上存。 */
function openSettings() {
  let conf = loadSaver();
  const row = (label, items, key, help) => {
    const box = el(
      "div",
      { class: "segmented saver-seg", role: "radiogroup", "aria-label": label },
      items.map(([v, text]) =>
        el(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": conf[key] === v ? "true" : "false",
            dataset: { v: String(v) },
            onclick: () => {
              conf = { ...conf, [key]: v };
              saveSaver(conf);
              for (const b of box.querySelectorAll("button")) b.setAttribute("aria-checked", b.dataset.v === String(v) ? "true" : "false");
            },
          },
          text
        )
      )
    );
    return el("div", { class: "saver-row" }, el("span", { class: "saver-label" }, label), box, help ? el("p", { class: "saver-help" }, help) : null);
  };
  let sheet;
  sheet = openSheet(
    "螢幕保護",
    el(
      "div",
      { class: "saver-settings" },
      el("p", { class: "saver-lead" }, "閒置一陣子就飛進一條無盡的牌河，你最近生成的圖晾在中間，剛印好的會飛到眼前顯影。按 Enter 或空白鍵（或點一下）回來；滑鼠不小心動到不會關掉。"),
      row("閒置多久出現", IDLE, "idle"),
      row("放哪些牌和圖", SCOPE, "scope", "跟頂端分級：頂端選到哪一級，那一級以下的牌和圖都會出現。"),
      row("要模糊的圖", BLUR, "blur", "生成的圖和牌的插畫都算；模糊的只看得到顏色，牌名照樣看得到。")
    ),
    {
      foot: [
        el("button", { class: "btn", type: "button", onclick: () => sheet.close() }, "好"),
        el(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            onclick: () => {
              sheet.close();
              setTimeout(startScreensaver, 250);
            },
          },
          "現在看看"
        ),
      ],
    }
  );
}

/** 每一頁開好之後叫一次：頂欄掛月亮鈕、開始看有沒有閒置。 */
export function mountScreensaver() {
  const sound = document.getElementById("sound-btn");
  if (sound && !document.getElementById("saver-btn")) {
    sound.before(el("button", { class: "ghost icon-btn", id: "saver-btn", type: "button", title: "螢幕保護", "aria-label": "螢幕保護設定", html: MOON, onclick: openSettings }));
  }
  // 滑鼠動到、按了別的鍵：右下「按 Enter 或空白鍵回來」亮一下，告訴人怎麼回去。
  let eatClickUntil = 0;
  const nudge = () => {
    const hint = active?.layer.querySelector(".saver-hint");
    if (!hint || hint.getAnimations().length) return;
    hint.animate([{ opacity: 1, color: "#f1ead9" }, { opacity: 1, color: "#f1ead9", offset: 0.6 }, {}], { duration: DUR.develop, easing: css(CURVE.out) });
  };
  const wake = (e) => {
    if (active) {
      // 螢幕保護開著時，什麼都不傳給底下的頁面（按鍵、點擊、滾輪都吃掉）。
      if (e.cancelable && e.type !== "pointermove") e.preventDefault();
      e.stopPropagation();
      // 剛出來的那一下（最後一個鍵還沒放開、手還在滑鼠上）不算。
      if (performance.now() - active.at < 600) return;
      const back =
        (e.type === "keydown" && (e.key === "Enter" || e.key === " " || e.key === "Escape")) ||
        e.type === "pointerdown" ||
        e.type === "touchstart";
      if (back) {
        // 點一下回來：放開那一下的 click 會落在底下的頁面上，一起吃掉。
        if (e.type !== "keydown") eatClickUntil = performance.now() + 700;
        return stopScreensaver();
      }
      if (e.type === "pointermove" || e.type === "wheel" || e.type === "keydown") nudge();
      return;
    }
    if (e.type === "click" && performance.now() < eatClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      eatClickUntil = 0;
      return;
    }
    lastInput = performance.now();
  };
  for (const type of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "click"]) addEventListener(type, wake, { capture: true, passive: false });
  addEventListener("scroll", () => (lastInput = performance.now()), { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (active?.gl) active.gl.pause(document.hidden);
    if (!document.hidden) lastInput = performance.now();
  });
  // 自動化測試（navigator.webdriver）不會自己跳出來，免得蓋住別的測試；「現在看看」照樣可以叫、動一下照樣收。
  if (navigator.webdriver) return;
  setInterval(() => {
    if (active || broken || document.hidden) return;
    const { idle } = loadSaver();
    if (!idle || performance.now() - lastInput < idle * 1000) return;
    // 影片在播（介紹影片、教學嵌在頁面裡）時不出來。
    if ([...document.querySelectorAll("video")].some((v) => !v.paused)) return;
    startScreensaver();
  }, 1000);
}
