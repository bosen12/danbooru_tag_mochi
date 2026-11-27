// 詞庫換過名的字：存著的舊名先換成新名（一定要第一個 import，見 tag-renames.js）。
import "./tag-renames.js";
import { guardPrerender, prerenderNeighbors, whenActive } from "./prerender.js";
import { dateLocale, english, t } from "./i18n.js";
/**
 * 作品冊：收藏的成品（album-save.js 從墨池、疊印台收進來；存在伺服器 recipes.py，圖另存一份）。
 *   - 大圖牆：照每張的長寬比排（album.css 的 columns），新的在前；超出頂端分級的先收起來。
 *     存了配方還沒生圖的，畫框裡攤這件的牌（最多七張），底下仍寫「只有配方，尚無圖片」。
 *   - 找作品：作品名、牌的中文名、提示詞。
 *   - 點一張：大圖、你選的牌、全部的牌、尺寸／種子／底模。主鈕「照這張再印」：牌、份量、時代、種子、底模、LoRA
 *     一起交給墨池；其他（只帶牌、複製提示詞、開原圖、從作品冊拿掉）手機上收進「⋯」（foot-more.js）。
 *   - 牌名是可以點的籤：打開卡冊那張牌的詳情（book.html#card=…）。
 *   - 網址帶 #作品編號（收藏完按「打開作品冊」過來）：這一級看得到就直接打開。
 *     看不到時沿用牆上的切換提示，等使用者按了才寫進共用分級、打開詳情（不先改，免得另一個墨池分頁被一起調高）。
 *   - 「日誌」分頁：印過的每一張，不只收藏的（album-log.js）。網址帶 ?tab=log 直接開在日誌。
 *   - 「模型」分頁：每個底模、LoRA 的成績單（album-models.js）；點一張跳到日誌只看它印的。
 *   - 分輯：依時代、髮色、服裝、場景把作品分段（album-groups.js）；詳情裡列出相似的作品。
 */
import { RATING_LABEL, ratingBlocked } from "./rules/rating.js";
import { mountRatingFree } from "./rating-free.js";
import { buildLibrary, createAssets, ERA_ZH } from "./cards.js";
import { hasTerms, searchKey } from "./card-search.js";
import { artFallback, bindArt } from "./card-images.js";
import { el, openSheet, toast, syncChoices, bootFailed, friendlyError, isNetError } from "./ui.js";
import { copyText } from "./copy-text.js";
import { zoomFromThumb } from "./zoom.js";
import { mountKeysHelp } from "./keys-help.js";
import { mountTour } from "./tour.js";
import { mountScreensaver } from "./screensaver.js";
import { mountGenStatus } from "./gen-status.js";
import { initMotion, settleMotion, seat, refuse, enter, leave, reducedMotion, swapIn, heightChange, ghostOut, CURVE, DUR, css } from "./motion.js";
import { pingLoop } from "./ping.js";
import { getSfx } from "./sfx.js";
import { transferLabel, reviewTransfer } from "./transfer.js";
import * as S from "./store.js";
import { tagsOfPositive } from "./usage.js";
import { removeFromAlbum } from "./album-save.js";
import { weightsOfPositive } from "./weights.js";
import { createLog, LOG_FILTERS, cardHref } from "./album-log.js";
import { createModels } from "./album-models.js";
import { GROUPINGS, groupWorks, similarWorks } from "./album-groups.js";
import { footMore } from "./foot-more.js";
import { handOffCustom, startFromPrompt } from "./custom-cards.js";

// 背後預先開好的這一頁（prerender.js）：點進去之前這個房間讀的存檔被別頁改過，就重新整理。
guardPrerender("album");

const sfx = getSfx();
const $ = (id) => document.getElementById(id);
const RANK = { general: 0, sensitive: 1, explicit: 2 };

let lib = null;
// 詞庫的舊名→新名（做成自製牌時拆提示詞用）。
let renamed = {};
let works = [];
let rating = "general";
// 深連結指到目前分級看不到的作品：先記住編號，等使用者自己按切換再寫設定、開詳情。
let hashWant = "";
// 分級「不限制」（rating-free.js，跟墨池同一份設定）：開著每件作品都看得到。
let free = false;
const seeRating = () => (free ? "explicit" : rating);
let ratingFreePaint = null;
let query = "";
// 分頁：works（收藏的）／log（印過的每一張）。
const TABS = [
  ["works", "作品"],
  ["log", "日誌"],
  ["models", "模型"],
];
let tab = TABS.some(([v]) => v === new URLSearchParams(location.search).get("tab")) ? new URLSearchParams(location.search).get("tab") : "works";
let logFilter = "all";
// 成績單上的「預設」是空底模，不是名字叫預設的模型。搜尋字對不上日誌（日誌裡這欄是空的）。
let logEmptyCkpt = false;
// 分輯（作品分頁）：記在這個瀏覽器。
const GROUP_KEY = "mochi.album.group.v1";
let grouping = (() => {
  try {
    const v = localStorage.getItem(GROUP_KEY);
    return GROUPINGS.some(([g]) => g === v) ? v : "none";
  } catch {
    return "none";
  }
})();
let log = null;
let models = null;
const PLACEHOLDER = { works: "找作品：牌名、提示詞…", log: "找印過的：牌名、提示詞、底模、LoRA…", models: "找模型：底模、LoRA 的名字…" };

const zh = (t) => lib?.byTag.get(t)?.zh || t;
const fileUrl = (ref) => (ref && ref.file ? `/api/recipes/files/${encodeURIComponent(ref.file)}` : null);
// 牆上、相似那一排的小格子：要 480 寬的縮圖（伺服器縮成 webp）。以前格子只有 180～270px 寬，抓的是 832×1216 的原圖，
// 有的作品沒有縮圖就直接是 1MB 多的 PNG。縮不了的伺服器照舊回原圖。
const smallUrl = (ref) => {
  const u = fileUrl(ref);
  return u && `${u}?w=480`;
};
const phoneView = () => matchMedia("(max-width: 40rem)").matches;
const cardsOf = (w) => tagsOfPositive(w.positive || "").filter((t) => lib.byTag.has(t));
const mineOf = (w) => (Array.isArray(w.pinned) ? w.pinned : []).filter((t) => lib.byTag.has(t));
// 沒有圖、但提示詞裡有詞庫牌：畫框改攤牌。有圖（含讀取失敗）不走這裡。
const needsRecipeFan = (w) => !fileUrl(w.thumbnail) && !fileUrl(w.image) && cardsOf(w).length > 0;
// 找相似用：去掉每張都有的人數牌（1個女性、單人），留下看得出差別的。角色牌也在人物那一段，但它最看得出差別：留著。
const isCharTag = (t) => lib.byTag.get(t)?.item?.group === "character";
const tellingOf = (w) => (w._telling ??= cardsOf(w).filter((t) => lib.byTag.get(t)?.item?.section !== "subject" || isCharTag(t)));

// 格式器建一次重複用：每格各呼叫一次 toLocaleDateString，作品冊 150 件時換分頁光它就佔 80ms。
let dateFmt = null;
let dateFmtFor = "";
function dateText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (!dateFmt || dateFmtFor !== String(dateLocale)) {
    dateFmt = new Intl.DateTimeFormat(dateLocale, { year: "numeric", month: "numeric", day: "numeric" });
    dateFmtFor = String(dateLocale);
  }
  return dateFmt.format(d);
}

/* ================= 只有配方：畫框裡攤牌 ================= */
// 最多攤七張（跟成品牆「只抽了牌」那一手一樣）。多的寫「＋N」。
// 樣式在 album.css 的「只有配方：攤牌」（web7 的 album.css 同一份，那邊用不到）。
const FAN_MAX = 7;
const FAN_SUITS = new Set(["cast", "chara", "look", "wear", "pose", "scene", "style", "custom"]);
let cardAssets = null;

// 插畫清單只抓一次。沒有、或讀失敗：牌面改畫一個字，作品冊照開。
async function ensureCardArt() {
  if (cardAssets) return;
  let manifest = {};
  try {
    const r = await fetch("cards/manifest.json");
    if (r.ok) manifest = await r.json();
  } catch { /* 下面用空清單 */ }
  cardAssets = createAssets(manifest && typeof manifest === "object" ? manifest : {});
}

// 七張以內照 cardsOf 的順序。超過才把你選的（仍須在 cardsOf 裡）排前面，免得七張都是每張都有的人數牌。
function fanTags(w) {
  const all = cardsOf(w);
  if (all.length <= FAN_MAX) return { shown: all, extra: 0 };
  const mine = new Set(mineOf(w));
  const shown = [...all.filter((t) => mine.has(t)), ...all.filter((t) => !mine.has(t))].slice(0, FAN_MAX);
  return { shown, extra: all.length - FAN_MAX };
}

function fanGlyph(card) {
  const text = !card ? "·" : english ? String(card.tag || "").slice(0, 2).toUpperCase() || "·" : [...(card.zh || "")][0] || "·";
  return el("b", {}, text);
}

// 牌面走 card-images.js：bindArt 照牌的大小挑細縮圖，失敗再退原圖。不自己拼檔名。
function fanFace(tag) {
  const card = lib.byTag.get(tag);
  const mini = cardAssets?.mini(tag) || null;
  const sources = cardAssets?.sources(tag) || null;
  if (!mini && !sources) return fanGlyph(card);
  const img = el("img", { alt: "", decoding: "async", draggable: "false" });
  bindArt(img, mini, sources, "hand");
  img.addEventListener("error", () => {
    if (!artFallback(img)) img.replaceWith(fanGlyph(card));
  });
  return img;
}

function recipeFan(w, kind) {
  const { shown, extra } = fanTags(w);
  if (!shown.length) return null;
  const n = shown.length;
  const cards = shown.map((tag, i) => {
    const card = lib.byTag.get(tag);
    const off = i - (n - 1) / 2;
    const suit = FAN_SUITS.has(card?.suit) ? card.suit : "look";
    return el(
      "span",
      {
        class: "album-fan-card",
        style: `--o:${off};--y:${(off * off).toFixed(2)};--i:${Math.round(12 - Math.abs(off) * 2)};--suit:var(--suit-${suit})`,
      },
      fanFace(tag)
    );
  });
  return el(
    "span",
    { class: `album-fan is-${kind}`, style: `--n:${n}`, "aria-hidden": "true" },
    cards,
    extra > 0 ? el("span", { class: "album-fan-more", title: `還有 ${extra} 張牌` }, `＋${extra}`) : null
  );
}

function recipeFrame(w, kind, style) {
  const fan = recipeFan(w, kind);
  return el(
    "span",
    { class: fan ? "album-frame is-recipe" : "album-frame", style: style || undefined },
    fan,
    el("span", { class: "album-noimg" }, "只有配方，尚無圖片")
  );
}

/* ================= 開機 ================= */

async function boot() {
  initMotion();
  // 快捷鍵說明（電腦）：頂欄的「?」、按 ? 打開（keys-help.js）。
  mountKeysHelp("album");
  // 新手導覽（頂欄「教學」右邊的「導覽」；第一次來會問要不要走一遍）：tour.js。
  mountTour("album");
  mountScreensaver();
  // 墨池、疊印台正在印的：頂欄看得到，點了回去（gen-status.js）。
  mountGenStatus("album");
  try {
    const data = await fetch(document.querySelector('link[rel="preload"][href^="lexicon.json"]')?.href || "lexicon.json").then((r) => r.json());
    lib = buildLibrary(data, { ratingBlocked });
    renamed = data.renamed || {};
  } catch (err) {
    // 連線問題（手機網路斷一下、伺服器沒開）：說「連不到主機」、給重試；不是叫人用 start.bat 開。
    if (isNetError(err)) return bootFailed(err);
    $("album").replaceChildren(el("p", { class: "album-hint" }, "讀不到詞庫。請用 start.bat 開，而不是直接點 HTML。", el("br"), String(err)));
    return;
  }
  rating = (S.loadSettings() || {}).rating || "general";
  free = (S.loadSettings() || {}).ratingFree === true;
  log = createLog({
    lib,
    zh,
    isCard: (t) => lib.byTag.has(t),
    getWorks: () => works,
    toMochi,
    reloadWorks: async () => {
      await load();
      log.reindex();
    },
    onStats: (r) => {
      if (tab === "log") paintLogSum(r);
    },
  });
  models = createModels({
    zh,
    isCard: (t) => lib.byTag.has(t),
    sectionOf: (t) => lib.byTag.get(t)?.item?.section,
    // 點一張成績單：篩選先回到「全部」（剛才停在「收藏的」會把這模型印壞的、沒收藏的藏掉）。
    // 空底模的名字是「預設」，拿去當搜尋字對不到日誌（那一欄是空的）。用旗標只留空底模，框留空。
    openLogFor: (name) => {
      logFilter = "all";
      const empty = !!name && typeof name === "object" && name.emptyCkpt;
      logEmptyCkpt = empty;
      const q = $("album-q");
      if (empty) {
        q.value = "";
        query = "";
      } else {
        const text = typeof name === "string" ? name : "";
        q.value = text;
        query = text.trim().toLowerCase();
      }
      // 已經在日誌：pickTab 看分頁沒變就直接返回，篩選和找字不會重畫。
      if (tab === "log") {
        renderTabs();
        render();
        return;
      }
      pickTab("log");
    },
  });
  renderRating();
  ratingFreePaint = mountRatingFree({
    get: () => free,
    set: (on) => {
      free = on;
      S.saveSettings({ ...(S.loadSettings() || {}), ratingFree: on });
      render();
    },
  });
  renderTabs();
  wireSearch();
  wireSound();
  pingLoop();
  await load();
  if (tab === "log") await log.load();
  if (tab === "models") await models.load();
  render({ deal: true });
  settleMotion();
  // 開好了：左右相鄰的房間在背後先開好，換過去不用再等開頁（prerender.js）。
  whenActive(prerenderNeighbors);
  openFromHash();
  addEventListener("hashchange", openFromHash);
  // 別的分頁收了新的作品：回到這一頁時重新讀一次。分級也補讀（這一頁在背後時別的房間可能調過）。
  // 網路、主機回來（伺服器重開：ping.js 替瀏覽器發 online）也讀一次：讀不到的那一頁自己補上。
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAlbum();
  });
  addEventListener("online", () => {
    if (!document.hidden) refreshAlbum();
  });
  async function refreshAlbum() {
    applySharedRating();
    const before = works.map((w) => w.id).join();
    const failedBefore = loadFailed;
    const logHad = tab === "log" && log.loaded && log.items.length > 0;
    await load();
    // 日誌開著：回來時重讀最新一頁。失敗留著已翻到的；成功按 id 合併，不把捲動拉回第一頁。
    if (tab === "log") {
      const ok = await log.load({ refresh: logHad });
      if (!ok && logHad) toast("讀不到日誌：伺服器沒開、或還是舊版（重開一次伺服器）。");
      if (logHad && log.items.length && log.keepView({ scroll: true })) return;
      return render();
    }
    if (tab === "models") {
      await models.load();
      return render();
    }
    // 上次讀不到、畫面寫著「讀不到作品冊」（一件都沒有時才這樣寫），這次讀到了：要重畫把它換掉。
    // 作品一直在畫面上的（讀失敗時照舊留著）不重畫：id 沒變就不動格子（網路一閃又回來時，格子不要整面重建）。
    if (works.map((w) => w.id).join() !== before || (failedBefore && !loadFailed && !before)) render();
  }
  // 別的分頁改了共用尺度：這一頁還開著就要跟著換，作品編號一樣也要重畫牆。
  addEventListener("storage", (e) => {
    if (e.key === S.SETTINGS_KEY) applySharedRating();
  });
  // 從別的房間按上一頁回來（bfcache）：開機不會重跑，尺度可能已經被那一頁改掉。
  addEventListener("pageshow", (e) => {
    if (e.persisted) applySharedRating();
  });
}

// 上一次讀作品冊失敗了：畫面要說「讀不到」，不能說「還沒有收藏的作品」（看起來像資料被刪了）。
let loadFailed = false;
// 讀作品冊的序號：切回分頁時讀的清單還在路上就刪了一件，舊清單晚到會把刪掉的那件又放回來。
// 開始新的一次讀、刪掉一件都加一，過期的回應不寫進 works。
let loadSeq = 0;

async function load() {
  const mine = ++loadSeq;
  try {
    const r = await fetch("/api/recipes", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    if (mine !== loadSeq) return;
    works = (j.items || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    for (const w of works) {
      const cards = cardsOf(w);
      w._text = [w.name, w.positive, ...cards.map(zh)].join(" ").toLowerCase();
      // 跟卡冊同一套比對（簡體、底線、空白分開每段都要有）；角色牌另外對作品名（打「間諜家家酒」找得到約兒）。
      w._key = searchKey([w._text, ...cards.flatMap((t) => { const c = lib.byTag.get(t); return c?.suit === "chara" ? [c.groupZh, c.item?.series] : []; })].join(" "));
    }
    loadFailed = false;
    // 格子快取只留還在的作品（別的分頁刪掉的不要一直佔著）。
    const ids = new Set(works.map((w) => w.id));
    for (const id of tileCache.keys()) if (!ids.has(id)) tileCache.delete(id);
  } catch {
    if (mine !== loadSeq) return;
    // 讀過的照舊留著（切回分頁時網路一閃，不要整面清空）。
    loadFailed = true;
    toast("讀不到作品冊：伺服器沒開，或連不到主機");
  }
  // 有圖的作品冊不到插畫清單。抓清單失敗也不要把整本作品冊說成讀不到。
  if (!loadFailed && works.some(needsRecipeFan)) await ensureCardArt();
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
            // 跟墨池同一個尺度：這裡換了，回墨池也是這一檔。
            S.saveSettings({ ...(S.loadSettings() || {}), rating: r });
            renderRating();
            seat(box.querySelector('[aria-checked="true"]'));
            render();
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

function wireSearch() {
  const q = $("album-q");
  let timer = 0;
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // 人自己打了字：空底模那面旗標要放下，不然清掉字還是只剩空底模。
      logEmptyCkpt = false;
      query = q.value.trim().toLowerCase();
      render();
    }, 140);
  });
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && q.value) {
      q.value = "";
      query = "";
      logEmptyCkpt = false;
      render();
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && !document.querySelector(".overlay")) {
      e.preventDefault();
      q.focus();
    }
  });
}

/* ================= 分頁 ================= */

function renderTabs() {
  const box = $("album-tabs");
  syncChoices(box, "aria-checked", [
    ...TABS.map(([v, label]) =>
      el(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": tab === v ? "true" : "false",
          dataset: { v },
          onclick: () => pickTab(v),
        },
        label
      )
    ),
  ]);
  const filters = $("log-filters");
  filters.hidden = tab !== "log";
  syncChoices(filters, "aria-pressed", [
    ...LOG_FILTERS.map(([v, label]) =>
      el(
        "button",
        {
          class: "group-chip pressable",
          type: "button",
          "aria-pressed": logFilter === v ? "true" : "false",
          dataset: { v },
          onclick: () => {
            if (logFilter === v) return;
            logFilter = v;
            renderTabs();
            render();
          },
        },
        label
      )
    ),
  ]);
  const groupBox = $("works-group");
  groupBox.hidden = tab !== "works";
  syncChoices(groupBox, "aria-pressed", [
    el("span", { class: "works-group-lead" }, "分輯"),
    ...GROUPINGS.map(([v, label]) =>
      el(
        "button",
        {
          class: "group-chip pressable",
          type: "button",
          "aria-pressed": grouping === v ? "true" : "false",
          dataset: { v },
          onclick: () => {
            if (grouping === v) return;
            grouping = v;
            try {
              localStorage.setItem(GROUP_KEY, v);
            } catch {
              /* 存不了：這一次照樣分 */
            }
            renderTabs();
            render({ deal: true });
          },
        },
        label
      )
    ),
  ]);
  $("album-q").placeholder = PLACEHOLDER[tab];
}

// 第幾次換分頁：換過來的那一頁（和它上面那排篩選）淡進來一次，之後同一頁重畫不再演。
let tabTurn = 0;
// 作品牆每一次繪製的編號。提示卡退場是晚一拍才換清單；那一拍只能改「還是這一輪」的牆。
let gridPaint = 0;

async function pickTab(v) {
  if (tab === v) return;
  tab = v;
  tabTurn += 1;
  // 換分頁記在網址上：重新整理、上一頁回來還是這一頁（不推新的歷史，免得上一頁要按好幾次）。
  const u = new URL(location.href);
  if (tab === "works") u.searchParams.delete("tab");
  else u.searchParams.set("tab", tab);
  history.replaceState(null, "", u.pathname + u.search + u.hash);
  // 日誌的篩選列、作品的分輯列：換分頁時收起的那一排淡出（殘影），出來的那一排照舊淡進來（下面的 swapIn）。
  const barGhosts = [$("log-filters"), $("works-group")].filter((b) => b && !b.hidden).map((b) => ghostOut(b.parentElement, `:scope > #${b.id}`));
  renderTabs();
  for (const g of barGhosts) g.done();
  seat($("album-tabs").querySelector('[aria-checked="true"]'));
  const turn = `${tab}:${tabTurn}`;
  // 慢的日誌／成績單回來時，人可能已經點回作品。只留快取，不要再把整排作品發一次牌。
  const mine = tab;
  const turnN = tabTurn;
  const still = () => tab === mine && tabTurn === turnN;
  for (const row of [$("log-filters"), $("works-group")]) if (row && !row.hidden) swapIn(row, turn, { firstToo: true });
  // 沒成功讀過，或上次失敗：切回日誌再試一次。讀到一半失敗的，用已有的頁當底去合併，不清空。
  if (mine === "log" && (!log.loaded || log.failed)) {
    render();
    await log.load({ refresh: !!(log.loaded && log.items.length) });
    if (!still()) return;
  }
  // 成績單每次換過來都重算（剛才可能又印了、又收藏了）。
  if (mine === "models") {
    if (!models.loaded) render();
    await models.load();
    if (!still()) return;
  }
  if (!still()) return;
  render({ deal: true });
}

/* ================= 大圖牆 ================= */

const visible = (w) => (RANK[w.rating] ?? 2) <= RANK[seeRating()];

// 開著的那件詳情。別的房間把分級調低、這件已經看不到時要把窗關掉，不能留著受限的圖。
let openDetail = null;

/**
 * 共用尺度（rating、ratingFree）跟別的房間是同一份。
 * 作品 id 沒變也要重畫：調低之後頂欄、牆、開著的詳情都得跟著，不能只比清單。
 */
function applySharedRating() {
  const s = S.loadSettings() || {};
  const next = typeof s.rating === "string" && RANK[s.rating] != null ? s.rating : "general";
  const nextFree = s.ratingFree === true;
  if (next === rating && nextFree === free) return false;
  rating = next;
  free = nextFree;
  renderRating();
  // 開著的詳情、相似列、日誌詳情都在 render 開頭收：同頁按分級鈕不走這裡，也要收得到。
  render();
  return true;
}

/** 分級變了（這一頁的鈕，或別的房間寫進同一份設定）：看不到的詳情關掉，還看得到的就把相似列重算。 */
function guardOpenDetails() {
  if (openDetail) {
    const w = works.find((x) => x.id === openDetail.id);
    if (!w || !visible(w)) openDetail.close();
    else refreshSimilar();
  }
  log?.guardRating?.(seeRating());
}

/**
 * 作品都被分級擋住：以前只寫一行「看不到」，要自己想到去頂欄換。說清楚有幾件、要哪一級，給一鍵換（跟卡冊一樣）。
 */
function ratingNeed(target) {
  if (target) return (RANK[target.rating] ?? 2) <= RANK.sensitive ? "sensitive" : "explicit";
  return works.some((w) => (RANK[w.rating] ?? 2) <= RANK.sensitive) ? "sensitive" : "explicit";
}

function hiddenNote(target) {
  const need = ratingNeed(target);
  const n = works.filter((w) => !visible(w)).length;
  const node = el(
    "div",
    { class: "album-empty album-empty-rating" },
    el("b", {}, `${n} 件作品在${RATING_LABEL[rating]}看不到`),
    el("span", {}, `${RATING_LABEL[need]}以上才有，或打開分級左邊的「不限制」。`),
    el(
      "span",
      { class: "album-empty-acts" },
      el("button", { class: "btn btn-small", type: "button", onclick: () => $("rating")?.querySelector(`[data-v="${need}"]`)?.click() }, `切到${RATING_LABEL[need]}`),
      el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => $("rating-free")?.click() }, "打開不限制")
    )
  );
  node.dataset.need = need;
  node.dataset.for = target?.id || "";
  return node;
}

// 日誌摘要：數字跟「還有更早的」分開，英文版才翻得到後半句。翻頁後外層也要跟著換。
function paintLogSum(r) {
  const sum = $("album-sum");
  if (!sum || tab !== "log") return;
  const g = heightChange(sum);
  if (!log.loaded || !r?.total) {
    if (sum.textContent) sum.replaceChildren();
    g.done();
    return;
  }
  let num = sum.querySelector("[data-log-n]");
  if (!num) {
    num = el("span", { dataset: { logN: "1" } }, String(r.shown));
    const unit = el("span", { dataset: { logUnit: "1" } }, " 張");
    sum.replaceChildren(num, unit);
    num.dataset.swapKey = `n:${r.shown}`;
  } else if (num.dataset.swapKey !== `n:${r.shown}`) {
    num.textContent = String(r.shown);
    swapIn(num, `n:${r.shown}`, { firstToo: true });
  }
  let more = sum.querySelector("[data-log-more]");
  if (r.more && !more) {
    more = el("span", { dataset: { logMore: "1" } }, "（還有更早的）");
    sum.querySelector("[data-log-unit]")?.after(more);
    enter(more);
  } else if (!r.more && more) leave(more, () => more.remove());
  const hidText = r.hidden ? `・${r.hidden} 張在${RATING_LABEL[rating]}看不到` : "";
  let hid = sum.querySelector("[data-log-hid]");
  if (hidText && !hid) {
    hid = el("span", { dataset: { logHid: "1", src: hidText } }, hidText);
    sum.append(hid);
    enter(hid);
  } else if (hidText && hid && hid.dataset.src !== hidText) {
    hid.dataset.src = hidText;
    hid.textContent = hidText;
    swapIn(hid, hidText, { firstToo: true });
  } else if (!hidText && hid) leave(hid, () => hid.remove());
  g.done();
}

/** 作品、模型分頁的摘要（「5 件作品・3 件在全年齡看不到」）：字換了就淡進來，不是一格換掉。 */
function setSum(text) {
  const sum = $("album-sum");
  // 英文版畫面上已經是英文：比對要用 t(text)，不然每次都當成換字、量高度又彈一下。
  if (sum.textContent === t(text) && !sum.querySelector("[data-log-n]")) return;
  const g = heightChange(sum);
  sum.textContent = text;
  if (text) swapIn(sum, "sum:" + text, { firstToo: true });
  else delete sum.dataset.swapKey;
  g.done();
}

// 換分頁時正在離開的那一頁：畫面上看得到的項目淡出（殘影），新的一頁照舊淡進來。以前舊的一格不見。
const PANE_ITEMS = ".album-tile:not([hidden]), .album-group > .log-day-head, .log-row, .log-day-head, .log-more, .model-card, .album-empty, .album-hint";
let paneShown = "";

function render({ deal = false } = {}) {
  guardOpenDetails();
  const grid = $("album-grid");
  const logBox = $("album-log");
  const modelBox = $("album-models");
  const panes = { works: grid, log: logBox, models: modelBox };
  const leaving = paneShown && paneShown !== tab ? panes[paneShown] : null;
  const ghost = leaving && !leaving.hidden ? ghostOut(leaving, PANE_ITEMS) : null;
  paneShown = tab;
  grid.hidden = tab !== "works";
  logBox.hidden = tab !== "log";
  modelBox.hidden = tab !== "models";
  ghost?.done();
  if (tabTurn) swapIn({ works: grid, log: logBox, models: modelBox }[tab], `${tab}:${tabTurn}`, { firstToo: true });
  if (tab === "models") {
    $("album-hint").hidden = true;
    const r = models.render(modelBox, { query, rating: seeRating() }, { deal });
    setSum(r.total ? `從日誌裡印好的 ${r.total} 張算` : "");
    return;
  }
  if (tab === "log") {
    $("album-hint").hidden = true;
    log.render(logBox, { query, filter: logFilter, rating: seeRating(), emptyCkpt: logEmptyCkpt }, { deal });
    return;
  }
  const shown = works.filter((w) => visible(w) && (!query || w._text.includes(query) || hasTerms(w._key, query)));
  const hidden = works.filter((w) => !visible(w)).length;
  $("album-hint").hidden = works.length > 0 || loadFailed;
  setSum(works.length ? `${shown.length} 件作品${hidden ? `・${hidden} 件在${RATING_LABEL[rating]}看不到` : ""}` : "");
  const groups = groupWorks(shown, shown.length ? grouping : "none", { lib, eraZh: ERA_ZH, cardsOf });
  const grouped = groups.length > 1 || (groups[0] && groups[0].label);
  grid.classList.toggle("is-grouped", !!grouped);
  const tiles = [];
  const parts = grouped
    ? groups.map((g) => {
        const ts = g.items.map(tileOf);
        tiles.push(...ts);
        return el(
          "section",
          { class: "album-group", dataset: { rest: g.rest ? "true" : "false" } },
          el("h3", { class: "log-day-head" }, g.label, el("small", {}, `${g.items.length} 件`)),
          el("div", { class: "album-grid-in", role: "list" }, ts)
        );
      })
    : (groups[0]?.items || []).map((w) => {
        const t = tileOf(w);
        tiles.push(t);
        return t;
      });
  if (loadFailed && !works.length) {
    grid.replaceChildren(
      el(
        "p",
        { class: "album-empty" },
        "讀不到作品冊：伺服器沒開，或連不到主機。作品都還在伺服器上。",
        " ",
        el("button", { class: "btn btn-small", type: "button", onclick: async () => (await load(), render({ deal: true })) }, "重試")
      )
    );
    return;
  }
  const pending = hashWant ? works.find((w) => w.id === hashWant) : null;
  const wantGate = !!(pending && !visible(pending));
  const oldNote = grid.querySelector(":scope > .album-empty-rating");
  let note = null;
  if (wantGate || (!tiles.length && works.length && !query)) {
    const target = wantGate ? pending : null;
    const need = ratingNeed(target);
    // 正在退場的那張提示卡已經淡到看不見。這輪還要提示的話換一張新的，不要把舊的貼回來。
    if (oldNote && oldNote.dataset.need === need && !oldNote.getAnimations().length) {
      oldNote.dataset.for = target?.id || "";
      note = oldNote;
    } else note = hiddenNote(target);
  }
  const body = tiles.length || !works.length
    ? (note ? [note, ...parts] : parts)
    : [note, query ? el("p", { class: "album-empty" }, `找不到「${query}」`) : null].filter(Boolean);
  // 退場結束時只准最新一輪改清單。快速切回全年齡時，上一輪不能把受限作品放回來。
  const paint = ++gridPaint;
  const applyGrid = () => {
    if (paint !== gridPaint) return;
    // 這輪還要用同一張提示卡：停掉把它淡掉的退場，不然摘要對了、提示卻是透明的。
    if (note) for (const a of note.getAnimations()) a.cancel();
    const prev = new Set([...grid.querySelectorAll(".album-tile")].map((n) => n.dataset.id));
    // 換分輯、找字：留下來的作品從原本的位置滑到新位置，拿掉的淡出（殘影），分段標題淡進來。
    // 以前整面一格重排（2026-11-21 專案主：切換不能生硬）。藏起來的（分級調低）不演：那是要立刻看不到的。
    const before = new Map();
    const heads = new Set([...grid.querySelectorAll(":scope > .album-group > .log-day-head")].map((h) => h.firstChild?.textContent || ""));
    if (!deal && !reducedMotion()) {
      for (const n of grid.querySelectorAll(".album-tile:not([hidden])")) {
        const r = n.getBoundingClientRect();
        if (r.width && r.bottom > -80 && r.top < innerHeight + 80) before.set(n.dataset.id, r);
      }
    }
    const tileKey = (n) => (n.classList.contains("album-tile") ? n.dataset.id : "head:" + (n.firstChild?.textContent || ""));
    const ghost = !deal ? ghostOut(grid, ".album-tile:not([hidden]), .album-group > .log-day-head", { key: tileKey, onlyGone: true }) : null;
    grid.replaceChildren(...body);
    if (note && note !== oldNote) enter(note);
    if (deal && !reducedMotion()) {
      // 分段的標題（江戶 3 件…）跟著發牌一起淡進來，不是先整排印好、作品才落下。
      for (const h of grid.querySelectorAll(":scope > .album-group > .log-day-head")) {
        h.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out), fill: "backwards" });
      }
      tiles.slice(0, 12).forEach((t, i) =>
        t.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
          duration: DUR.long,
          delay: DUR.micro + i * 40,
          easing: css(CURVE.out),
          fill: "backwards",
        })
      );
    } else if (!deal) {
      // 分級打開後才冒出來的格子要進場；本來就在牆上的不要再演一次。
      [...grid.querySelectorAll(".album-tile")].filter((n) => !prev.has(n.dataset.id)).slice(0, 12).forEach((n, i) => enter(n, { delay: DUR.micro + i * 24 }));
      if (!reducedMotion()) {
        let moving = 0;
        for (const n of grid.querySelectorAll(".album-tile")) {
          const was = before.get(n.dataset.id);
          if (!was) continue;
          const r = n.getBoundingClientRect();
          const dx = was.left - r.left;
          const dy = was.top - r.top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
          n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
            duration: Math.min(DUR.long + Math.hypot(dx, dy) * 0.15, 600),
            delay: Math.min(moving++, 12) * 14,
            easing: css(CURVE.travel),
            fill: "backwards",
          });
        }
        for (const h of grid.querySelectorAll(":scope > .album-group > .log-day-head")) {
          if (heads.has(h.firstChild?.textContent || "")) continue;
          h.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: DUR.micro, easing: css(CURVE.out), fill: "backwards" });
        }
      }
    }
    ghost?.done();
    maybeOpenHash();
  };
  // 降級當下就把看不了的格子藏起來、點不了。提示卡可以照舊退場，不必等它播完才收。
  for (const node of grid.querySelectorAll(".album-tile")) {
    const cur = works.find((x) => x.id === node.dataset.id);
    if (cur && visible(cur)) continue;
    node.hidden = true;
    node.disabled = true;
  }
  if (oldNote && oldNote !== note) leave(oldNote, applyGrid);
  else applyGrid();
}

// 牆上的格子照作品留著重用（卡冊的 cells 同一招）：換分頁、換分段、搜尋都是同一批作品重新排，
// 以前每次整片重建，150 件時手機換回「作品」分頁要 256ms。名字、圖、日期變了才重做那一格。
const tileCache = new Map();
function tileOf(w) {
  // 沒圖的那格，牌或你選的變了要重攤。有圖的不把整段提示詞算進簽名（換分頁時每格都比一次）。
  const sig = [w.name, w.thumbnail?.file, w.image?.file, w.width, w.height, w.createdAt, String(dateLocale), needsRecipeFan(w) ? `${cardsOf(w).join("\u0001")}\u0002${mineOf(w).join("\u0001")}` : ""].join("|");
  const had = tileCache.get(w.id);
  if (had && had.sig === sig) {
    had.node._work = w;
    // 降級時直接把格子藏起來。節點留在快取裡，分級再打開要把它們放回來，不能一直 hidden。
    had.node.hidden = false;
    had.node.disabled = false;
    return had.node;
  }
  const node = tile(w);
  node._work = w;
  tileCache.set(w.id, { sig, node });
  return node;
}

function tile(w) {
  const src = smallUrl(w.thumbnail) || smallUrl(w.image);
  const ratio = w.width && w.height ? `${w.width} / ${w.height}` : "2 / 3";
  const born = performance.now();
  const img = src
    ? el("img", {
        src,
        alt: "",
        loading: "lazy",
        decoding: "async",
        onerror: (e) => {
          const full = fileUrl(w.image);
          if (full && e.currentTarget.getAttribute("src") !== full) e.currentTarget.src = full;
          else e.currentTarget.replaceWith(el("span", { class: "album-noimg" }, "圖片讀取失敗"));
        },
        onload: (e) => {
          // 晚到的圖淡進來；本來就在快取裡的直接出現（不閃一格空白）。
          if (performance.now() - born > 80 && !reducedMotion()) e.currentTarget.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
        },
      })
    : null;
  const node = el(
    "button",
    { class: "album-tile pressable", type: "button", role: "listitem", dataset: { id: w.id }, "aria-label": `${w.name}，${dateText(w.createdAt)}` },
    src ? el("span", { class: "album-frame", style: `aspect-ratio: ${ratio}` }, img) : recipeFrame(w, "tile", `aspect-ratio: ${ratio}`),
    el("span", { class: "album-cap" }, el("b", { dataset: { noI18n: "" } }, w.name), el("small", {}, dateText(w.createdAt)))
  );
  // 切回分頁後清單換了新物件、id 沒變就不會重畫。點的時候拿這個 id 現在的那一筆，不拿做出這格時的物件。
  // 再對一次分級：上一輪退場若把舊格子放回來，這一級看不到的也不能打開。
  node.addEventListener("click", () => {
    const cur = works.find((x) => x.id === node.dataset.id);
    if (cur && visible(cur)) openWork(cur);
  });
  return node;
}

/* ================= 一張作品 ================= */

// 同一件作品的「照這張再印」處理中（讀配方，或確認窗還沒關）：再點、再按 Enter 都不另讀、不另開窗。
const reprintBusy = new Set();

/**
 * 等配方時把鈕上的字換成「讀取作品配方…」，寬度先量好釘住。
 * 字變長變短都會把這一排的其他鈕擠開；量的是邊框外寬，按鈕本來就是 border-box。
 */
function holdReprint(btn) {
  // offsetWidth 是排版寬，不受彈窗進場的縮放影響。再設 minWidth、flexShrink：
  // 這顆鈕在彈性列裡，overflow:hidden 會讓最小內容寬變成 0，列一緊它就被壓窄。
  const width = btn.offsetWidth;
  const kids = [...btn.childNodes];
  btn.style.width = `${width}px`;
  btn.style.minWidth = `${width}px`;
  btn.style.flexShrink = "0";
  btn.style.overflow = "hidden";
  btn.setAttribute("aria-busy", "true");
  btn.replaceChildren("讀取作品配方…");
  return () => {
    btn.style.width = "";
    btn.style.minWidth = "";
    btn.style.flexShrink = "";
    btn.style.overflow = "";
    btn.removeAttribute("aria-busy");
    if (kids.length) btn.replaceChildren(...kids);
  };
}

/**
 * 照這張再印：作品冊清單裡的 LoRA 只有檔名（/api/recipes 的摘要），強度、選過的觸發詞在完整那一份裡。
 * 先讀這一件的完整配方再交給墨池；以前直接拿清單那一列，墨池用預設強度 0.8 和第一個觸發詞重印（第五輪 Astra 找到）。
 * 讀不到（舊作品、斷線）照舊用清單那一列。讀取中鎖住這一筆，雙擊不會疊兩層確認窗。
 */
async function reprintWork(all, w, btn) {
  if (!btn || reprintBusy.has(w.id)) return;
  // 這次讀取只屬於按下它的那張詳情。關掉 A 去看 B 之後，A 的配方晚到也不能寫便條、不能把人送去墨池。
  const sheet = btn.closest(".sheet");
  const overlay = sheet?.closest(".overlay");
  const ac = new AbortController();
  let dropped = false;
  const drop = () => {
    dropped = true;
    ac.abort();
  };
  sheet?.addEventListener("sheet-close", drop, { once: true });
  const alive = () => !dropped && !!overlay?.isConnected && overlay.dataset.closing !== "true";
  reprintBusy.add(w.id);
  let held = true;
  const release = () => {
    if (!held) return;
    held = false;
    reprintBusy.delete(w.id);
  };
  let restore = () => {};
  try {
    let src = w;
    if (w.loras?.length) {
      restore = holdReprint(btn);
      let full = null;
      let failed = false;
      try {
        const r = await fetch(`/api/recipes/${encodeURIComponent(w.id)}`, { signal: ac.signal, cache: "no-store" });
        full = r.ok ? await r.json() : null;
        if (!r.ok || full == null) failed = true;
      } catch (err) {
        if (err?.name === "AbortError" || !alive()) return;
        failed = true;
      }
      restore();
      restore = () => {};
      if (!alive()) return;
      if (!failed && Array.isArray(full?.recipe?.loras)) src = { ...w, loras: full.recipe.loras };
      // 讀不到就放掉這把鎖，鈕回到原字，可以立刻重按；確認窗若已經開著，不會再疊一層。
      if (failed) release();
    }
    if (!alive()) return;
    const opened = toMochi(all, `全部 ${all.length} 張牌`, w, btn, { recipe: S.recipeOf(src), onClose: release });
    if (!opened) release();
  } catch {
    restore();
    release();
  } finally {
    // 關窗中止的那一輪：鈕可能已經卸掉，鎖要放，免得這件作品再打開時按不了。
    if (!alive()) {
      restore();
      release();
    }
  }
}

/** 詳情底下「相似的作品」：用到的牌重疊多的幾件（這一級分級看得到的），點一下換過去看。 */
function similarBox(w, sheetOf) {
  const list = similarWorks(w, works.filter(visible), tellingOf, 6, isCharTag);
  if (!list.length) return null;
  return el(
    "section",
    { class: "album-similar", dataset: { ids: list.map(({ work: x }) => x.id).join("\0") } },
    el("h3", {}, `相似的作品・${list.length}`),
    el(
      "div",
      { class: "album-similar-row" },
      list.map(({ work: x, both }) => {
        const src = smallUrl(x.thumbnail) || smallUrl(x.image);
        return el(
          "button",
          {
            class: "album-similar-item pressable",
            type: "button",
            title: `${x.name}：${both} 張牌一樣`,
            onclick: () => {
              // 打開詳情之後分級可能被別的房間調低。用現在的作品、現在看不看得見，不要用當初算列時抓住的那件。
              const cur = works.find((y) => y.id === x.id);
              if (!cur || !visible(cur)) return;
              sheetOf()?.close();
              setTimeout(() => openWork(cur), reducedMotion() ? 0 : DUR.short);
            },
          },
          src
            ? el("span", { class: "album-frame", style: x.width && x.height ? `aspect-ratio: ${x.width} / ${x.height}` : "" }, el("img", { src, alt: "", loading: "lazy", decoding: "async", onerror: e => e.currentTarget.replaceWith(el("span", { class: "album-noimg" }, "圖片讀取失敗")) }))
            : recipeFrame(x, "similar", x.width && x.height ? `aspect-ratio: ${x.width} / ${x.height}` : ""),
          el("small", {}, `${both} 張一樣`)
        );
      })
    )
  );
}

function maybeOpenHash() {
  if (!hashWant || tab !== "works") return;
  const w = works.find((x) => x.id === hashWant);
  if (!w || !visible(w)) return;
  hashWant = "";
  $("album-grid").querySelector(`.album-tile[data-id="${CSS.escape(w.id)}"]`)?.scrollIntoView({ block: "center" });
  openWork(w);
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) {
    if (!hashWant) return;
    hashWant = "";
    if (tab === "works") render();
    return;
  }
  const w = works.find((x) => x.id === id);
  if (!w) {
    hashWant = "";
    return toast("這件作品不在作品冊裡了");
  }
  if (!visible(w)) {
    // 不寫設定。另一個墨池分頁聽的是同一份分級，這裡先改過去，那邊抽牌也跟著變。
    hashWant = id;
    if (tab !== "works") pickTab("works");
    else render();
    return;
  }
  hashWant = "";
  $("album-grid").querySelector(`.album-tile[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" });
  openWork(w);
}

function chips(tags, kind, weights = {}) {
  // 調過份量的牌寫上數字（跟合成池牌角的數字一樣）。
  return el(
    "div",
    { class: `album-chips is-${kind}` },
    tags.map((t) => el("a", { class: "album-chip pressable", href: cardHref(t), title: `${t}・在卡冊看這張牌` }, zh(t) + (weights[t] ? ` ${weights[t]}` : "")))
  );
}

/** 作品的牌 → 卡冊的「新增自製牌」：你選的在前（帶份量），再接引擎補的；品質詞、分級尾巴不要。 */
function customFromWork(w, mine, rest) {
  const ws = weightsOfPositive(w.positive);
  const tags = [...mine, ...rest].map((t) => (ws[t] && ws[t] !== 1 ? `(${t}:${ws[t]})` : t));
  const start = startFromPrompt(tags.join(", "), { lib, renamed, rating: w.rating || "general", name: String(w.name || "").slice(0, 24) });
  if (!handOffCustom(start)) toast("無法交接，請檢查瀏覽器儲存空間。");
}

/**
 * 牌交給墨池。recipe（照這張再印）：時代、種子、底模、LoRA 一起帶過去（store.js 的 recipeOf），
 * 墨池收到後套好牌和時代、固定種子，底模、LoRA 問一聲要不要換。
 */
function toMochi(tags, label, w, button = document.activeElement, { recipe = null, onClose } = {}) {
  // 份量（weights.js）從提示詞讀回來：收藏時調過的牌，帶回去還是那個份量。
  const all = weightsOfPositive(w?.positive);
  return reviewTransfer("pool", tags, all, zh, () => sendToMochi(tags, label, all, recipe, button), { onClose });
}

function sendToMochi(tags, label, all, recipe, button) {
  if (!S.handOffPool(tags, "album", Object.fromEntries(tags.filter((t) => all[t]).map((t) => [t, all[t]])), recipe)) {
    if (button?.matches?.("button")) refuse(button);
    toast("無法交接選牌，請檢查瀏覽器儲存空間。");
    return false;
  }
  toast(recipe ? `照這張再印：${label}帶去墨池…` : `${label}帶去墨池…`);
  setTimeout(() => (location.href = "./"), reducedMotion() ? 0 : DUR.short);
}

/** 詳情還開著、這件仍看得到：相似列照現在的分級重算。少掉的收起來，不是留著還點得開。 */
function refreshSimilar() {
  const detail = openDetail;
  const body = detail?.body;
  if (!body?.isConnected) return;
  const w = works.find((x) => x.id === detail.id);
  if (!w || !visible(w)) return;
  const ids = similarWorks(w, works.filter(visible), tellingOf, 6, isCharTag).map(({ work: x }) => x.id).join("\0");
  // 相似列在 .album-info 裡，不是詳情根節點的直接子。用 :scope > 找不到，分級調低後舊列還留著、點得開。
  const old = body.querySelector(".album-similar");
  if ((old?.dataset.ids || "") === ids) return;
  const next = ids ? similarBox(w, () => detail) : null;
  if (old && next) {
    leave(old, () => {
      if (!old.isConnected || openDetail !== detail) return;
      old.replaceWith(next);
      enter(next);
    });
  } else if (old) leave(old, () => old.remove());
  else if (next) {
    body.append(next);
    enter(next);
  }
}

function openWork(w) {
  // 網址、相似列、遲到的點擊都走這裡。這一級已經看不到就不要打開。
  if (!w || !visible(w)) return;
  sfx.open?.();
  const full = fileUrl(w.image) || fileUrl(w.thumbnail);
  const mine = mineOf(w);
  const all = cardsOf(w);
  const rest = all.filter((t) => !mine.includes(t));
  const ckpt = String(w.checkpoint || "").split(/[\\/]/).pop().replace(/\.safetensors$/i, "");
  const facts = [
    ["尺寸", w.width && w.height ? `${w.width}×${w.height}` : "—"],
    ["種子", String(w.seed ?? "—")],
    ["分級", RATING_LABEL[w.rating] || w.rating],
    ["時代", ERA_ZH[w.era] || w.era || "—"],
    ["底模", ckpt || "—"],
    // LoRA 存的是 { file, strength… }（以前當字串印，變成 [object Object]）。
    ["LoRA", (w.loras || []).filter(Boolean).map((x) => String(typeof x === "string" ? x : x.file || x.name || "").split(/[\\/]/).pop().replace(/\.safetensors$/i, "") + (x && x.strength != null && x.strength !== 1 ? ` ${x.strength}` : "")).join("、") || "沒有"],
    ["收藏於", dateText(w.createdAt)],
  ];
  let sheet = null;
  const failedImageText = "圖片讀取失敗。可以重試，或把牌帶回墨池重新生成。";
  const imageStatus = el("span", {}, failedImageText);
  let retrying = false;
  const retryImage = el("button", { class: "btn btn-small", type: "button", onclick: () => {
    if (retrying) return;
    retrying = true;
    // disabled 按鈕在部分瀏覽器會失去焦點；先移到仍可讀的狀態，再按讀取結果接回去。
    if (document.activeElement === retryImage) imageNote.focus({ preventScroll: true });
    retryImage.disabled = true;
    imageNote.setAttribute("aria-busy", "true");
    imageStatus.textContent = "正在重新讀取圖片…";
    imageBlank.textContent = "正在重新讀取圖片…";
    image.src = `${full}${full.includes("?") ? "&" : "?"}retry=${Date.now()}`;
  } }, "重試讀取圖片");
  const imageNote = el("p", { class: "album-image-note", role: "status", tabindex: "-1", hidden: true }, imageStatus, retryImage);
  // 手機上詳情的圖拿 960 寬的（作品冊存的常是 1MB 多的 PNG，走 Tailscale 要等）；「開原圖」照舊連原檔。
  const image = full ? el("img", { src: phoneView() && w.image?.file ? `${full}?w=960` : full, alt: w.name, onerror: () => {
    if (image.getAttribute("src") !== full && !retrying) return void (image.src = full);
    retrying = false;
    retryImage.disabled = false;
    imageNote.removeAttribute("aria-busy");
    imageStatus.textContent = failedImageText;
    image.hidden = true;
    imageNote.hidden = false;
    if (document.activeElement === imageNote) retryImage.focus({ preventScroll: true });
    big.removeAttribute("href");
    imageBlank.hidden = false;
    imageBlank.textContent = "圖片讀取失敗";
  }, onload: () => {
    const recovered = retrying;
    retrying = false;
    retryImage.disabled = false;
    imageNote.removeAttribute("aria-busy");
    image.hidden = false;
    imageBlank.hidden = true;
    big.href = full;
    // 重試成功後按鈕會收起；仍在按鈕上的鍵盤焦點移到已恢復的原圖連結。
    if (document.activeElement === retryImage || document.activeElement === imageNote) big.focus({ preventScroll: true });
    imageNote.hidden = true;
    if (recovered && !reducedMotion()) image.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
  } }) : null;
  const imageBlank = el("span", { class: "album-noimg", hidden: !!full }, full ? "圖片讀取失敗" : "只有配方，尚無圖片");
  // 有網址的圖（含後來讀取失敗）不攤牌。沒有任何詞庫牌時 recipeFan 回 null，畫框維持原本那行小字。
  const fan = full ? null : recipeFan(w, "detail");
  const big = el(full ? "a" : "div", { class: fan ? "album-big is-recipe" : "album-big", href: full || undefined, target: full ? "_blank" : undefined, rel: full ? "noopener" : undefined, style: w.width && w.height ? `aspect-ratio: ${w.width} / ${w.height}` : "" }, image, fan, imageBlank);
  const del = el("button", { class: "btn btn-small album-del", type: "button" }, "從作品冊拿掉");
  let armed = 0;
  del.addEventListener("click", async () => {
    // 拿掉會連另存的那份圖一起刪：按兩次才算，第一次先說清楚。
    if (!armed) {
      del.textContent = "再按一次：連存的圖一起刪";
      del.dataset.armed = "true";
      armed = setTimeout(() => {
        armed = 0;
        del.textContent = "從作品冊拿掉";
        delete del.dataset.armed;
      }, 3500);
      return;
    }
    clearTimeout(armed);
    del.disabled = true;
    let goneAlready = false;
    try {
      await removeFromAlbum(w.id);
    } catch (err) {
      // 伺服器說找不到：別的分頁、別的裝置已經拿掉了。目的一樣，照拿掉處理，不要寫「拿不掉」、格子還留在牆上
      // （2026-11-20 第五輪 Opus：兩個作品冊並排，一邊刪了，另一邊再刪就卡住，要切走再切回來）。
      if (err?.status !== 404) {
        del.disabled = false;
        refuse(del);
        return toast(`拿不掉：${friendlyError(err)}`);
      }
      goneAlready = true;
    }
    sheet.close();
    loadSeq++;
    // 開著詳情時清單可能已經換過一批物件（同 id）。用物件比對刪不到新的那筆，牆上就留著。
    works = works.filter((x) => x.id !== w.id);
    if (hashWant === w.id) hashWant = "";
    tileCache.delete(w.id);
    const node = $("album-grid").querySelector(`.album-tile[data-id="${CSS.escape(w.id)}"]`);
    leave(node, () => render());
    toast(goneAlready ? `「${w.name}」已經在別的地方拿掉了` : `「${w.name}」拿出作品冊了`);
  });
  const body = el(
    "div",
    { class: "album-detail" },
    big,
    el(
      "div",
      { class: "album-info" },
      full ? imageNote : el("p", { class: "workspace-purpose" }, "這件作品只存了配方。把牌帶回墨池，就能重新生成圖片。"),
      el("dl", { class: "album-facts" }, facts.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)])),
      mine.length ? el("section", {}, el("h3", {}, `你選的牌・${mine.length}`), chips(mine, "mine", weightsOfPositive(w.positive))) : null,
      rest.length ? el("section", {}, el("h3", {}, `${mine.length ? "引擎補的" : "這張用到的牌"}・${rest.length}`), chips(rest, "drawn")) : null,
      el("details", { class: "album-pos" }, el("summary", {}, "提示詞"), el("pre", { class: "pos-text" }, w.positive || "")),
      similarBox(w, () => sheet)
    )
  );
  // 主鈕：照這張再印（全部的牌＋份量＋時代＋種子＋底模＋LoRA）。只帶牌的是次要的，手機上收進「⋯」。
  const again = all.length
    ? el("button", { class: "btn btn-small btn-primary reprint-btn", type: "button", title: "牌、份量、時代、種子、底模、LoRA 一起帶去墨池", onclick: (e) => reprintWork(all, w, e.currentTarget) }, transferLabel("pool", "照這張再印"))
    : null;
  const s = openSheet(w.name, body, {
    translateTitle: false,
    wide: true,
    foot: footMore(again, [
      mine.length
        ? el("button", { class: "btn btn-small", type: "button", onclick: (e) => toMochi(mine, `你選的 ${mine.length} 張`, w, e.currentTarget) }, transferLabel("pool", "只帶你選的牌"))
        : all.length
          ? el("button", { class: "btn btn-small", type: "button", onclick: (e) => toMochi(all, `全部 ${all.length} 張`, w, e.currentTarget) }, transferLabel("pool", "只帶牌"))
          : null,
      // 自製牌：這件的牌（你選的在前，帶份量）換到卡冊的「新增自製牌」，挑掉不要的再存。
      all.length
        ? el("button", { class: "btn btn-small", type: "button", title: "把這件用到的牌包成一張自製牌（到卡冊編輯）", onclick: () => customFromWork(w, mine, rest) }, "做成自製牌")
        : null,
      el(
        "button",
        {
          class: "btn btn-small",
          type: "button",
          onclick: async (e) => {
            const b = e.currentTarget;
            const ok = await copyText(w.positive || "");
            if (ok) {
              b.textContent = "已複製";
              setTimeout(() => (b.textContent = "複製提示詞"), 1400);
            } else {
              refuse(b);
            }
          },
        },
        "複製提示詞"
      ),
      full ? el("a", { class: "btn btn-small", href: full, target: "_blank", rel: "noopener" }, "開原圖") : null,
      del,
    ]),
  });
  sheet = s;
  openDetail = { id: w.id, close: () => s.close(), body };
  s.sheet.addEventListener("sheet-close", () => {
    if (openDetail?.id === w.id) openDetail = null;
  }, { once: true });
  // 圖從作品冊那一格長大到彈窗、關掉時縮回去（zoom.js）；那一格不在畫面上（從網址 #編號 直接打開）就照舊淡進來。
  const tile = () => $("album-grid").querySelector(`.album-tile[data-id="${CSS.escape(w.id)}"] .album-frame img`);
  const t = tile();
  const tr = t && t.getBoundingClientRect();
  if (full && tr && tr.width && tr.bottom > 0 && tr.top < innerHeight) zoomFromThumb({ from: tile, sheet: s.sheet, to: image, aspect: w.width && w.height ? w.width / w.height : 0 });
  else if (!reducedMotion()) image?.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
  if (!reducedMotion()) {
    [...body.querySelectorAll(".album-chip")].slice(0, 30).forEach((c, i) => enter(c, { delay: DUR.short + i * 14 }));
  }
  // 關掉時把 #編號 拿掉：重新整理不會又自己打開。
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

// 開機到一半出錯（本機存檔讀不懂、連不到主機）：不要停在「正在讀詞庫…」，說清楚、給重試或重設（ui.js 的 bootFailed）。
boot().catch(bootFailed);
