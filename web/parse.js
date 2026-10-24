// 詞庫換過名的字：存著的舊名先換成新名（一定要第一個 import，見 tag-renames.js）。
import "./tag-renames.js";
import { guardPrerender, prerenderNeighbors, whenActive } from "./prerender.js";
/**
 * 解析池：丟一張圖進來，ComfyUI 的 WD14 Tagger 認出畫面裡的字（server.py 的 /api/parse、image_parse.py），
 * 詞庫有的變成牌，挑好帶去墨池的合成池或疊印台。
 *
 *   - 放圖：拖進來、貼上（Ctrl+V）、點一下選圖。網頁先縮到長邊 1024 再送（Tagger 本來就縮成 448 才看）。
 *   - 解析中：圖上一道朱光從上掃到下，底下數秒數；等太久說可能是 ComfyUI 在忙或第一次下載模型。
 *   - 牌從圖裡飛出來，照花色落進各自那一格。每張標「確定」（≥ 0.7）或「可能」（≥ 最低信心）：
 *     Tagger 不回分數，所以伺服器跑兩層門檻，兩層都有的就是確定。上面可以切換只要確定的，不必重跑。
 *   - 點一張就不帶它；分級擋住的牌先不帶（到頂欄換分級就能帶）。詞庫沒有的字列在下面，可以複製。
 *   - 帶走：選好的牌飛進按鈕，再換版過去（合成池：store.js 的 handOffPool；疊印台：handOffFuse）。
 *   - 解析設定（模型、最低信心、角色門檻、不要的字）存在這個瀏覽器（mochi.parse.v1），每次解析一起送。
 *   - 剛才解析的那一張跟著這個分頁（sessionStorage）：帶去合成池、再回來，還在。重新整理就是空的。
 */
import { ratingBlocked, RATING_LABEL } from "./rules/rating.js";
import { mountRatingFree } from "./rating-free.js";
import { buildLibrary, createAssets, cardNode, eagerArt, sizeCards, CARD_SUIT_INFO, CARD_SUITS } from "./cards.js";
import { el, openSheet, toast, syncChoices, bootFailed, friendlyError, isNetError } from "./ui.js";
import { mountKeysHelp } from "./keys-help.js";
import { mountTour } from "./tour.js";
import { mountScreensaver } from "./screensaver.js";
import { mountGenStatus } from "./gen-status.js";
import { initMotion, settleMotion, seat, refuse, flight, reducedMotion, CURVE, DUR, css } from "./motion.js";
import { pingLoop } from "./ping.js";
import { getSfx } from "./sfx.js";
import { attachTilt } from "./card-tilt.js";
import { cloneCard } from "./card-images.js";
import { parsePrompt } from "./paste-prompt.js";
import * as S from "./store.js";

guardPrerender("parse");

const sfx = getSfx();
const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = "mochi.parse.v1";
const TAB_KEY = "mochi.parse.tab.v1";
// 送出去的圖：長邊 1024。Tagger 縮成 448 才看，再大只是傳得慢；畫面上的底片也用這一張。
const SEND_EDGE = 1024;
// 存在分頁裡的那一張小一點（sessionStorage 只有幾 MB）。
const KEEP_EDGE = 640;
// 等多久開始說「可能在忙」。
const SLOW_MS = 7000;
// 上下排（跟 parse.css 的 52rem 一致）。
const narrow = matchMedia("(max-width: 52rem)");

let data = null;
let lib = null;
let assets = null;
let rating = "general";
let free = false;
let ratingFreePaint = null;
let defaults = { model: "wd-vit-tagger-v3", threshold: 0.35, characterThreshold: 0.85, exclude: "" };
let models = [];
let sure = 0.7;

// 這一張：圖（data URL）、伺服器回的字、解析時用的設定。
let shot = null;
// 對過詞庫的結果：cards [{ tag, raw, sure }]、unknown [{ raw, sure }]、blocked [raw]。
let parsed = null;
// 使用者點掉的牌。
let off = new Set();
// "all"：確定＋可能；"sure"：只要確定的。
let trust = "all";
let busy = false;
let job = 0;
let tick = 0;

const zh = (tag) => lib?.byTag.get(tag)?.zh || tag;
const seeRating = () => (free ? "explicit" : rating);
const locked = (tag) => {
  const c = lib.byTag.get(tag);
  return !!c && ratingBlocked(c.item, seeRating());
};
const shown = (c) => trust === "all" || c.sure;
const picked = () => (parsed ? parsed.cards.filter((c) => shown(c) && !off.has(c.tag) && !locked(c.tag)) : []);

function loadTagger() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}
const tagger = () => ({ ...defaults, ...loadTagger() });
function saveTagger(next) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* 存不了：這次照樣用 */
  }
}

/* ================= 開機 ================= */

async function boot() {
  initMotion();
  mountKeysHelp("parse");
  mountTour("parse");
  mountScreensaver();
  mountGenStatus("parse");
  try {
    const [lexicon, manifest] = await Promise.all([
      fetch(document.querySelector('link[rel="preload"][href^="lexicon.json"]')?.href || "lexicon.json").then((r) => r.json()),
      fetch(document.querySelector('link[rel="preload"][href^="cards/manifest.json"]')?.href || "cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    data = lexicon;
    lib = buildLibrary(data, { ratingBlocked });
    assets = createAssets(manifest);
  } catch (err) {
    if (isNetError(err)) return bootFailed(err);
    $("parse").replaceChildren(el("p", { class: "parse-empty" }, "讀不到詞庫。請用 start-web6.bat 開，而不是直接點 HTML。", el("br"), String(err)));
    return;
  }
  const app = S.loadSettings() || {};
  rating = app.rating || "general";
  free = app.ratingFree === true;
  renderRating();
  ratingFreePaint = mountRatingFree({
    get: () => free,
    set: (on) => {
      free = on;
      S.saveSettings({ ...(S.loadSettings() || {}), ratingFree: on });
      paintLocks();
    },
  });
  wireSound();
  wireDrop();
  wireBar();
  $("parse-gear").addEventListener("click", openSettings);
  restore();
  pingLoop();
  fetchOptions();
  settleMotion();
  whenActive(prerenderNeighbors);
}

/** 伺服器的預設值、模型清單（設定面板用）。ComfyUI 沒開也照樣能開頁。 */
async function fetchOptions() {
  try {
    const r = await fetch("/api/parse", { cache: "no-store" });
    const j = await r.json();
    if (j.defaults) defaults = { ...defaults, ...j.defaults };
    if (typeof j.sure === "number") sure = j.sure;
    models = Array.isArray(j.models) ? j.models : [];
    return j;
  } catch {
    return null;
  }
}

/* ================= 頂欄 ================= */

function renderRating() {
  const box = $("rating");
  syncChoices(box, "aria-checked",
    ...["general", "sensitive", "explicit"].map((r) =>
      el(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": rating === r ? "true" : "false",
          dataset: { v: r },
          onclick: () => {
            if (rating === r) return;
            rating = r;
            S.saveSettings({ ...(S.loadSettings() || {}), rating: r });
            renderRating();
            seat(box.querySelector('[aria-checked="true"]'));
            paintLocks();
          },
        },
        RATING_LABEL[r]
      )
    )
  );
  ratingFreePaint?.();
}

function wireSound() {
  const snd = $("sound-btn");
  const sync = () => {
    snd.setAttribute("aria-pressed", sfx.on ? "true" : "false");
    const label = sfx.on ? "聲音：開（點一下關掉）" : "聲音：關（點一下打開）";
    snd.setAttribute("aria-label", label);
    snd.title = label;
    snd.innerHTML = sfx.on
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>`;
  };
  sync();
  snd.addEventListener("click", () => {
    sfx.on = !sfx.on;
    sync();
    if (sfx.on) sfx.deal(3);
  });
}

/* ================= 放圖 ================= */

function wireDrop() {
  const plate = $("parse-plate");
  const file = $("parse-file");
  file.addEventListener("change", () => {
    const f = file.files?.[0];
    file.value = "";
    if (f) take(f);
  });
  // 整頁都收得下：拖到哪裡都算，底片亮起來告訴你放這裡。
  let depth = 0;
  const hasFile = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  addEventListener("dragenter", (e) => {
    if (!hasFile(e)) return;
    depth += 1;
    plate.dataset.over = "";
  });
  addEventListener("dragleave", (e) => {
    if (!hasFile(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) delete plate.dataset.over;
  });
  addEventListener("dragover", (e) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  addEventListener("drop", (e) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    depth = 0;
    delete plate.dataset.over;
    const f = [...(e.dataTransfer.files || [])].find((x) => x.type.startsWith("image/"));
    if (f) take(f);
    else toast("要一張圖（PNG、JPEG、WebP）");
  });
  document.addEventListener("paste", (e) => {
    const t = e.target;
    if (t?.closest?.("input, textarea, select, [contenteditable]") || document.querySelector(".overlay")) return;
    const f = [...(e.clipboardData?.items || [])].find((x) => x.kind === "file" && x.type.startsWith("image/"))?.getAsFile();
    if (!f) {
      if (e.clipboardData?.getData("text")) toast("剪貼簿裡是文字。要變成牌的提示詞，到墨池按 Ctrl+V；這裡要貼一張圖。");
      return;
    }
    e.preventDefault();
    take(f);
  });
}

/** 圖 → 長邊 edge 的 data URL（WebP，瀏覽器不會存 WebP 的話用 JPEG）。 */
async function shrink(blob, edge) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  // 透明的地方墊白（Tagger 自己也是墊白；黑底會被認成 black background）。
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  let url = c.toDataURL("image/webp", 0.92);
  if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", 0.92);
  return { url, w, h };
}

async function take(blob) {
  if (!blob.type.startsWith("image/")) return toast("要一張圖（PNG、JPEG、WebP）");
  let img;
  try {
    img = await shrink(blob, SEND_EDGE);
  } catch {
    return toast("這張圖打不開，換一張試試");
  }
  shot = { url: img.url, w: img.w, h: img.h, name: blob.name || "" };
  parsed = null;
  off = new Set();
  showShot({ fresh: true });
  run();
}

/** 底片換成這一張。fresh：剛放進來的，演一段顯影。 */
function showShot({ fresh = false } = {}) {
  const plate = $("parse-plate");
  const img = $("parse-img");
  img.src = shot.url;
  $("parse-frame").style.setProperty("--ratio", `${shot.w} / ${shot.h}`);
  const was = plate.dataset.state;
  $("parse-drop").hidden = true;
  $("parse-shot").hidden = false;
  if (fresh && !reducedMotion()) {
    // 顯影：從一團墨暈開成清楚的圖。換一張（本來就有圖）時舊的那張先縮下去。
    $("parse-frame").animate(
      [
        { opacity: 0, transform: "scale(1.035)", filter: "blur(14px) saturate(0.2) brightness(1.6)" },
        { opacity: 1, transform: "none", filter: "none" },
      ],
      { duration: was === "empty" || !was ? DUR.develop : DUR.story, easing: css(CURVE.out) }
    );
    sfx.lift?.();
  }
}

/* ================= 解析 ================= */

async function run() {
  if (!shot) return;
  const mine = ++job;
  busy = true;
  setState("loading");
  const t0 = performance.now();
  clearInterval(tick);
  const say = () => {
    const s = (performance.now() - t0) / 1000;
    status(
      s * 1000 < SLOW_MS
        ? el("span", { class: "parse-run" }, el("span", {}, "解析中…"), el("b", { class: "parse-secs" }, `${s.toFixed(1)} 秒`))
        : el("span", { class: "parse-run" }, el("span", {}, "還在解析…"), el("b", { class: "parse-secs" }, `${s.toFixed(0)} 秒`), el("span", { class: "parse-why" }, "ComfyUI 可能正在印別張（等那張印完就輪到），或第一次用這個模型、正在下載。"))
    );
  };
  say();
  tick = setInterval(say, 100);
  let j = null;
  let err = null;
  try {
    const r = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: shot.url, settings: tagger() }),
    });
    j = await r.json().catch(() => ({ ok: false, error: `伺服器回 ${r.status}` }));
    if (!r.ok || !j.ok) err = j;
  } catch (e) {
    err = { error: friendlyError(e) };
  }
  if (mine !== job) return;
  clearInterval(tick);
  busy = false;
  if (err) {
    setState("error");
    const retry = el("button", { class: "link-btn pressable", type: "button", onclick: () => run() }, "再試一次");
    status(el("span", { class: "parse-err" }, err.error || "解析失敗"), " ", err.code === "no_tagger" ? null : retry);
    sfx.fail?.();
    return;
  }
  shot.tags = j.tags || [];
  shot.settings = j.settings || tagger();
  shot.secs = (performance.now() - t0) / 1000;
  digest();
  setState("done");
  paintStatus();
  render({ deal: true });
  keep();
}

function setState(s) {
  $("parse-plate").dataset.state = s;
  $("parse-again").hidden = true;
}

function status(...kids) {
  $("parse-status").replaceChildren(...kids.filter(Boolean));
}

function paintStatus() {
  if (!shot?.tags) return;
  const model = String(shot.settings?.model || "").replace(/^wd-/, "");
  status(
    // 每一段自己一個節點（英文版一段段換），中間的「・」由 CSS 畫。
    el(
      "span",
      { class: "parse-done" },
      el("span", {}, `認出 ${shot.tags.length} 個字`),
      el("b", {}, `${parsed.cards.length} 張是牌`),
      shot.secs ? el("span", {}, `${shot.secs.toFixed(1)} 秒`) : null
    ),
    el("span", { class: "parse-model", title: "解析用的模型（解析設定裡換）" }, model)
  );
}

/** 伺服器的字 → 牌、詞庫沒有、不收（跟「貼上提示詞變成牌」同一套比對：paste-prompt.js）。 */
function digest() {
  const sureOf = new Map(shot.tags.map((x) => [x.tag, !!x.sure]));
  const res = parsePrompt(shot.tags.map((x) => x.tag).join("\n"), {
    lexTags: data.tags.map((t) => t.tag),
    banned: data.characterBan || [],
    isCard: (t) => lib.byTag.has(t),
    zh,
  });
  parsed = {
    cards: res.cards.map(({ tag, raw }) => ({ tag, raw, sure: sureOf.get(raw) ?? true })),
    unknown: [...res.unknown, ...res.engine].map((raw) => ({ raw, sure: sureOf.get(raw) ?? false })),
    blocked: res.blocked,
    quality: res.quality,
  };
}

/* ================= 牌 ================= */

const cells = new Map();

function cellOf(c) {
  let cell = cells.get(c.tag);
  if (cell) return cell;
  const card = lib.byTag.get(c.tag);
  const node = eagerArt(cardNode(card, assets, { tagName: "button" }));
  node.classList.add("pressable");
  node.addEventListener("click", () => toggle(c.tag, cell));
  cell = el(
    "div",
    { class: "parse-cell", role: "listitem", dataset: { tag: c.tag } },
    node,
    el("span", { class: "parse-tick", "aria-hidden": "true" }),
    el("span", { class: "parse-conf" }, el("i", { "aria-hidden": "true" }), el("i", { "aria-hidden": "true" }), el("span", { class: "parse-conf-text" }))
  );
  cells.set(c.tag, cell);
  return cell;
}

function paintCell(cell, c) {
  const lock = locked(c.tag);
  const on = !off.has(c.tag) && !lock;
  cell.dataset.sure = c.sure ? "1" : "0";
  cell.dataset.on = on ? "1" : "0";
  if (lock) cell.dataset.lock = "";
  else delete cell.dataset.lock;
  cell.hidden = !shown(c);
  const name = zh(c.tag);
  cell.querySelector(".parse-conf-text").textContent = lock ? `${RATING_LABEL[rating]}用不了` : c.sure ? "確定" : "可能";
  const btn = cell.querySelector(".card");
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.title = lock ? `${name}：${RATING_LABEL[rating]}用不了（到頂欄換分級）` : on ? `${name}：會帶走，點一下不帶` : `${name}：不帶，點一下帶走`;
}

/** 整個結果區重畫。deal：牌從圖裡飛出來。 */
function render({ deal = false } = {}) {
  const groups = $("parse-groups");
  const has = !!parsed;
  $("parse-empty").hidden = has;
  $("parse-tools").hidden = !has || !parsed.cards.length;
  $("parse-bar").hidden = !has;
  if (!has) {
    groups.replaceChildren();
    $("parse-extra").replaceChildren();
    return;
  }
  for (const tag of [...cells.keys()]) if (!parsed.cards.some((c) => c.tag === tag)) cells.delete(tag);
  const order = (c) => (c.sure ? 0 : 1);
  const sections = CARD_SUITS.map((suit) => {
    const list = parsed.cards.filter((c) => lib.byTag.get(c.tag).suit === suit).sort((a, b) => order(a) - order(b));
    if (!list.length) return null;
    const grid = el("div", { class: "parse-grid", role: "list" }, list.map((c) => cellOf(c)));
    const info = CARD_SUIT_INFO[suit];
    return el(
      "section",
      { class: "parse-suit", dataset: { suit } },
      el("h3", { class: "parse-suit-head" }, el("span", { class: "parse-suit-glyph suit-glyph", "aria-hidden": "true" }, info.glyph), info.zh, el("span", { class: "parse-suit-n" })),
      grid
    );
  }).filter(Boolean);
  groups.replaceChildren(...sections);
  if (!parsed.cards.length) groups.append(el("p", { class: "parse-none" }, "一張牌都對不上：詞庫沒有這些字。下面列出認出來的字，可以複製去別處用。"));
  for (const g of groups.querySelectorAll(".parse-grid")) sizeCards(g);
  attachTilt(groups);
  renderTrust();
  paintAll();
  renderExtra();
  if (!deal) return;
  // 手機（上下排）：牌落在圖的下面、畫面外。先捲到牌那裡，再讓牌從（捲上去的）圖那邊落下來。
  const out = $("parse-out");
  if (narrow.matches && out.getBoundingClientRect().top > innerHeight * 0.55) {
    const head = parseFloat(getComputedStyle(document.querySelector(".mast")).height) || 0;
    const y = scrollY + out.getBoundingClientRect().top - (getComputedStyle(document.querySelector(".mast")).position === "sticky" ? head : 0) - 12;
    if (reducedMotion()) return void scrollTo(0, y);
    for (const c of out.querySelectorAll(".parse-cell")) c.style.opacity = "0";
    scrollTo({ top: y, behavior: "smooth" });
    setTimeout(() => {
      for (const c of out.querySelectorAll(".parse-cell")) c.style.opacity = "";
      dealIn();
    }, 420);
    return;
  }
  dealIn();
}

function paintAll() {
  if (!parsed) return;
  for (const c of parsed.cards) {
    const cell = cells.get(c.tag);
    if (cell) paintCell(cell, c);
  }
  for (const sec of $("parse-groups").querySelectorAll(".parse-suit")) {
    const all = [...sec.querySelectorAll(".parse-cell")];
    const vis = all.filter((x) => !x.hidden);
    sec.hidden = !vis.length;
    sec.querySelector(".parse-suit-n").textContent = String(vis.filter((x) => x.dataset.on === "1").length);
  }
  paintCount();
}

function paintCount() {
  const n = picked().length;
  const btns = [$("parse-to-pool"), $("parse-to-fuse")];
  for (const b of btns) b.disabled = !n;
  $("parse-count").replaceChildren(n ? el("span", {}, el("b", {}, String(n)), " ", el("span", {}, "張要帶走")) : el("span", {}, "還沒選牌"));
  const all = $("parse-all");
  const can = parsed ? parsed.cards.filter((c) => shown(c) && !locked(c.tag)) : [];
  const every = can.length && can.every((c) => !off.has(c.tag));
  all.textContent = every ? "全不選" : "全選";
  all.setAttribute("aria-pressed", every ? "true" : "false");
}

function paintLocks() {
  paintAll();
}

function toggle(tag, cell) {
  if (locked(tag)) {
    refuse(cell.querySelector(".card"));
    toast(`${zh(tag)}：${RATING_LABEL[rating]}用不了，到頂欄換分級`);
    return;
  }
  if (off.has(tag)) off.delete(tag);
  else off.add(tag);
  sfx.tap?.();
  const c = parsed.cards.find((x) => x.tag === tag);
  paintCell(cell, c);
  if (!reducedMotion()) {
    const on = !off.has(tag);
    cell.querySelector(".parse-tick").animate(
      on ? [{ transform: "scale(0.4)", opacity: 0 }, { transform: "scale(1.15)", opacity: 1, offset: 0.6 }, { transform: "none", opacity: 1 }] : [{ transform: "none" }, { transform: "scale(0.6)" }],
      { duration: DUR.medium, easing: css(on ? CURVE.settle : CURVE.out) }
    );
  }
  paintAll();
  keep();
}

/** 牌從圖裡飛出來：每張從圖上隨機一點、縮小透明，飛到自己那一格。確定的先到。 */
function dealIn() {
  if (reducedMotion()) return;
  const frame = $("parse-frame").getBoundingClientRect();
  const nodes = [...$("parse-groups").querySelectorAll(".parse-cell:not([hidden])")];
  const rects = nodes.map((n) => n.getBoundingClientRect());
  // 由上往下、由左往右；確定的先飛。
  const order = nodes
    .map((n, i) => ({ n, r: rects[i], sure: n.dataset.sure === "1" }))
    .filter(({ r }) => r.width && r.bottom > -200 && r.top < innerHeight + 200)
    .sort((a, b) => (b.sure - a.sure) || a.r.top - b.r.top || a.r.left - b.r.left);
  const rand = mulberry(nodes.length * 7919 + 13);
  order.forEach(({ n, r }, i) => {
    const fx = frame.left + frame.width * (0.2 + 0.6 * rand());
    const fy = frame.top + frame.height * (0.15 + 0.7 * rand());
    const dx = fx - (r.left + r.width / 2);
    const dy = fy - (r.top + r.height / 2);
    const spin = (rand() - 0.5) * 24;
    const delay = 120 + Math.min(i, 36) * 32;
    n.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.28) rotate(${spin}deg)`, opacity: 0 },
        { transform: `translate(${dx * 0.85}px, ${dy * 0.85}px) scale(0.42) rotate(${spin * 0.8}deg)`, opacity: 1, offset: 0.12 },
        { transform: "none", opacity: 1 },
      ],
      { duration: DUR.story, delay, easing: css(CURVE.out), fill: "backwards" }
    );
  });
  for (const [i, h] of [...$("parse-groups").querySelectorAll(".parse-suit-head")].entries())
    h.animate([{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, delay: 80 + i * 60, easing: css(CURVE.out), fill: "backwards" });
  // 掃描線最後再亮一下、收掉（styles：.parse-frame[data-flash]）。
  const f = $("parse-frame");
  f.dataset.flash = "";
  setTimeout(() => delete f.dataset.flash, DUR.develop);
  setTimeout(() => sfx.deal?.(Math.min(8, order.length || 1)), 140);
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 確定／全部 ---------- */

function renderTrust() {
  const box = $("parse-trust");
  const nSure = parsed.cards.filter((c) => c.sure).length;
  syncChoices(box, "aria-checked",
    ...[
      ["all", `全部 ${parsed.cards.length}`],
      ["sure", `只要確定的 ${nSure}`],
    ].map(([v, label]) =>
      el("button", { type: "button", role: "radio", "aria-checked": trust === v ? "true" : "false", dataset: { v }, onclick: () => setTrust(v) }, label)
    )
  );
}

/** 切換確定／全部：要藏的牌縮下去，留下的滑到新位置（FLIP），回來的從原地浮上來。 */
function setTrust(v) {
  if (trust === v || !parsed) return;
  const groups = $("parse-groups");
  const before = new Map([...groups.querySelectorAll(".parse-cell:not([hidden])")].map((n) => [n, n.getBoundingClientRect()]));
  const heads = new Map([...groups.querySelectorAll(".parse-suit:not([hidden]) > .parse-suit-head")].map((n) => [n, n.getBoundingClientRect()]));
  trust = v;
  renderTrust();
  seat($("parse-trust").querySelector('[aria-checked="true"]'));
  const leaving = [...before.keys()].filter((n) => !shown(parsed.cards.find((c) => c.tag === n.dataset.tag)));
  const go = () => {
    paintAll();
    if (reducedMotion()) return;
    for (const n of groups.querySelectorAll(".parse-cell:not([hidden])")) {
      const was = before.get(n);
      const now = n.getBoundingClientRect();
      if (!was) {
        n.animate([{ opacity: 0, transform: "translateY(10px) scale(0.92)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, delay: DUR.micro, easing: css(CURVE.out), fill: "backwards" });
        continue;
      }
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) + Math.abs(dy) < 1) continue;
      n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    }
    for (const [h, was] of heads) {
      if (!h.isConnected || h.parentElement.hidden) continue;
      const now = h.getBoundingClientRect();
      const dy = was.top - now.top;
      if (Math.abs(dy) >= 1) h.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    }
  };
  if (!leaving.length || reducedMotion()) {
    go();
  } else {
    const outs = leaving.map((n) => n.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.86)" }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" }));
    setTimeout(() => {
      go();
      for (const a of outs) a.cancel();
    }, DUR.short);
  }
  keep();
}

/* ---------- 詞庫沒有的 ---------- */

function renderExtra() {
  const box = $("parse-extra");
  const unknown = parsed.unknown;
  const parts = [];
  if (unknown.length) {
    const copy = el(
      "button",
      {
        class: "link-btn pressable",
        type: "button",
        onclick: async (e) => {
          const b = e.currentTarget;
          try {
            await navigator.clipboard.writeText(unknown.map((u) => u.raw.replace(/_/g, " ")).join(", "));
            b.textContent = "複製了";
            setTimeout(() => (b.textContent = "複製"), 1400);
          } catch {
            refuse(b);
          }
        },
      },
      "複製"
    );
    parts.push(
      el(
        "details",
        { class: "parse-more" },
        el("summary", {}, el("span", {}, `詞庫沒有的字・${unknown.length}`), copy),
        el("p", { class: "parse-more-note" }, "認得出來、但詞庫沒有這張牌（或是引擎自己會處理的字）。粗體是確定的。"),
        el("div", { class: "parse-chips" }, unknown.map((u) => el("span", { class: "parse-chip", dataset: { sure: u.sure ? "1" : "0" } }, u.raw.replace(/_/g, " "))))
      )
    );
  }
  if (parsed.blocked.length)
    parts.push(el("p", { class: "parse-blocked" }, `不收 ${parsed.blocked.length} 個字（未成年相關、或不能用的角色）。`));
  box.replaceChildren(...parts);
}

/* ================= 帶走 ================= */

function wireBar() {
  $("parse-all").addEventListener("click", () => {
    if (!parsed) return;
    const can = parsed.cards.filter((c) => shown(c) && !locked(c.tag));
    const every = can.every((c) => !off.has(c.tag));
    for (const c of can) every ? off.add(c.tag) : off.delete(c.tag);
    sfx.tap?.();
    paintAll();
    keep();
  });
  $("parse-to-pool").addEventListener("click", (e) => send("pool", e.currentTarget));
  $("parse-to-fuse").addEventListener("click", (e) => send("fuse", e.currentTarget));
  $("parse-again").addEventListener("click", () => run());
  addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || document.querySelector(".overlay")) return;
    if (e.target?.closest?.("input, textarea, select, button, a, summary, [contenteditable]")) return;
    if (!$("parse-to-pool").disabled && !$("parse-bar").hidden) {
      e.preventDefault();
      send("pool", $("parse-to-pool"));
    }
  });
}

let leaving = false;
function send(where, btn) {
  if (leaving) return;
  const list = picked();
  if (!list.length) return refuse(btn);
  const tags = list.map((c) => c.tag);
  const ok = where === "pool" ? S.handOffPool(tags, "parse") : S.handOffFuse(tags, {}, "parse");
  if (!ok) {
    refuse(btn);
    return toast("無法交接選牌，請檢查瀏覽器儲存空間。");
  }
  leaving = true;
  keep();
  const href = where === "pool" ? "./" : "fuse.html";
  if (reducedMotion()) return void (location.href = href);
  // 選好的牌一張張飛進按鈕（畫面上看得到的前 16 張），最後一張落地就換版。
  const flying = list
    .map((c) => cells.get(c.tag)?.querySelector(".card"))
    .filter(Boolean)
    .map((n) => ({ n, r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.width && r.bottom > 0 && r.top < innerHeight)
    .slice(0, 16);
  let last = 0;
  flying.forEach(({ n, r }, i) => {
    const ghost = cloneCard(n);
    const delay = i * 36;
    const f = flight(ghost, { left: r.left, top: r.top, width: r.width, height: r.height }, btn, { delay, endScale: 0.32, endOpacity: 0.2, scaleLate: 0.4, arc: 60, tilt: -8 });
    last = Math.max(last, delay + f.duration);
    n.closest(".parse-cell").animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: DUR.short, delay, fill: "forwards" });
  });
  btn.animate([{ transform: "none" }, { transform: "scale(1.06)", offset: 0.7 }, { transform: "none" }], { duration: DUR.medium, delay: Math.max(0, last - DUR.short), easing: css(CURVE.settle) });
  setTimeout(() => sfx.deal?.(Math.min(6, flying.length || 1)), 60);
  setTimeout(() => (location.href = href), Math.min(1600, last + DUR.micro));
}

// 從墨池／疊印台按「上一頁」回來（bfcache）：畫面還是飛走那一刻的樣子，把牌叫回來。
addEventListener("pageshow", (e) => {
  if (!e.persisted || !leaving) return;
  leaving = false;
  for (const cell of cells.values()) for (const a of cell.getAnimations()) a.cancel();
});

/* ================= 跟著分頁的那一張 ================= */

function keep() {
  if (!shot?.tags) return;
  // 存小一張：sessionStorage 只有幾 MB。
  const save = (url) => S.saveTab(TAB_KEY, { url, w: shot.w, h: shot.h, tags: shot.tags, settings: shot.settings, secs: shot.secs, off: [...off], trust, at: Date.now() });
  if (shot.small) return save(shot.small);
  fetch(shot.url)
    .then((r) => r.blob())
    .then((b) => shrink(b, KEEP_EDGE))
    .then((s) => {
      shot.small = s.url;
      save(s.url);
    })
    .catch(() => {});
}

function restore() {
  const was = S.loadTab(TAB_KEY);
  if (!was || typeof was.url !== "string" || !Array.isArray(was.tags) || Date.now() - (Number(was.at) || 0) > 6 * 60 * 60 * 1000) {
    setState("empty");
    render();
    return;
  }
  shot = { url: was.url, small: was.url, w: was.w || 1, h: was.h || 1, tags: was.tags, settings: was.settings, secs: was.secs };
  off = new Set(Array.isArray(was.off) ? was.off : []);
  trust = was.trust === "sure" ? "sure" : "all";
  showShot();
  digest();
  setState("done");
  paintStatus();
  render();
}

/* ================= 解析設定 ================= */

async function openSettings() {
  const cur = tagger();
  const modelSel = el("select", { class: "parse-set-model", "aria-label": "解析模型" });
  const fillModels = () => {
    const list = models.length ? models : [cur.model];
    if (!list.includes(cur.model)) list.unshift(cur.model);
    modelSel.replaceChildren(...list.map((m) => el("option", { value: m, selected: m === cur.model }, m + (m === defaults.model ? "（預設）" : ""))));
  };
  fillModels();
  if (!models.length) fetchOptions().then(fillModels);
  const slider = (label, key, lo, hi, note) => {
    const out = el("output", { class: "parse-set-val" });
    const input = el("input", { type: "range", min: String(lo), max: String(hi), step: "0.05", value: String(cur[key]), "aria-label": label });
    const sync = () => (out.textContent = Number(input.value).toFixed(2));
    input.addEventListener("input", sync);
    sync();
    return { input, row: el("label", { class: "parse-set-row" }, el("span", { class: "parse-set-label" }, label, out), input, el("span", { class: "parse-set-note" }, note)) };
  };
  const th = slider("最低信心", "threshold", 0.05, 0.95, `低一點認得多、也比較會亂猜；${sure.toFixed(2)} 以上的標「確定」。`);
  const ch = slider("角色門檻", "characterThreshold", 0.05, 1, "角色名字要多有把握才列出來；設 1 就不認角色。");
  const ex = el("textarea", { class: "parse-set-ex", rows: "3", placeholder: "例如：simple background, white background", "aria-label": "不要的字" });
  ex.value = cur.exclude || "";
  const body = el(
    "div",
    { class: "parse-set" },
    el("label", { class: "parse-set-row" }, el("span", { class: "parse-set-label" }, "解析模型"), modelSel, el("span", { class: "parse-set-note" }, "ComfyUI 的 WD14 Tagger 認得的模型。沒下載過的第一次用會先下載（幾百 MB）。")),
    th.row,
    ch.row,
    el("label", { class: "parse-set-row" }, el("span", { class: "parse-set-label" }, "不要的字"), ex, el("span", { class: "parse-set-note" }, "逗號分開，底線、空格都可以。這些字不會出現。"))
  );
  const reset = el("button", { class: "btn", type: "button" }, "恢復預設");
  const save = el("button", { class: "btn btn-primary", type: "button" }, "存起來");
  const { close } = openSheet("解析設定", body, { foot: [reset, save] });
  reset.addEventListener("click", () => {
    modelSel.value = defaults.model;
    th.input.value = String(defaults.threshold);
    ch.input.value = String(defaults.characterThreshold);
    ex.value = defaults.exclude || "";
    for (const i of [th.input, ch.input]) i.dispatchEvent(new Event("input"));
  });
  save.addEventListener("click", () => {
    const next = { model: modelSel.value, threshold: Number(th.input.value), characterThreshold: Number(ch.input.value), exclude: ex.value.trim() };
    const changed = JSON.stringify(next) !== JSON.stringify({ model: cur.model, threshold: Number(cur.threshold), characterThreshold: Number(cur.characterThreshold), exclude: String(cur.exclude || "") });
    saveTagger(next);
    close();
    if (!changed) return;
    toast("解析設定存好了");
    // 已經有一張：問要不要用新設定重跑（不自己重跑：可能只是先調好、等下一張）。
    if (shot && !busy) {
      const again = $("parse-again");
      again.hidden = false;
      if (!reducedMotion()) again.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    }
  });
}

boot();
