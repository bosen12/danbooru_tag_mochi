// 詞庫換過名的字：存著的舊名先換成新名（一定要第一個 import，見 tag-renames.js）。
import "./tag-renames.js";
import { guardPrerender, prerenderNeighbors, whenActive } from "./prerender.js";
import { dateLocale, english, t } from "./i18n.js";
import { cloneCard } from "./card-images.js";
/**
 * 卡冊：每張牌進過幾張圖。
 *
 * 次數由墨池、疊印台記（usage.js）：墨池每抽出一張、疊印台每付印一張，用到的牌各加一。
 * 這一頁只讀、排、看：
 *   - 多到少／少到多、新到舊／舊到新，花色、細分類、找字、只看用過的、含禁用。
 *   - 換排序、換花色時，還在畫面上的牌從舊位置滑到新位置（FLIP），新來的錯開浮上來。
 *   - 點一張牌：牌飛進詳情，大數字從 0 數上來，看你親手放幾次、引擎補幾次、最近一次。
 *     「帶去墨池」把它放進墨池的合成池（store.js 的交接便條）再換版過去。
 *   - 別的分頁抽完牌：這裡的數字跟著跳一下（storage 事件），排序不自己亂動，給一顆「重新排序」。
 */
import { indexLexicon } from "./engine.js";
import { ratingBlocked, RATING_LABEL } from "./rules/rating.js";
import { mountRatingFree } from "./rating-free.js";
import { buildLibrary, sizeCards, groupChips, genderChips, chipRun, seriesRun, createAssets, cardNode, cardFacts, setCardFlag, eagerArt, cardMatches, searchCards, searchNote, matchRank, CARD_SUIT_INFO, CARD_SUITS } from "./cards.js";
import { el, openSheet, toast, syncChoices, bootFailed, friendlyError, isNetError } from "./ui.js";
import { zoomFromThumb } from "./zoom.js";
import { mountKeysHelp } from "./keys-help.js";
import { mountTour } from "./tour.js";
import { mountScreensaver } from "./screensaver.js";
import { mountGenStatus } from "./gen-status.js";
import { openDecks } from "./decks.js";
import { openPaste } from "./paste-prompt.js";
import { measure, evaluate, announce, openWall } from "./achievements.js";
import { initMotion, settleMotion, seat, refuse, flight, reducedMotion, swapIn, rowChange, CURVE, DUR, css } from "./motion.js";
import { viewSrc } from "./gen.js";
import { pingLoop } from "./ping.js";
import { getSfx } from "./sfx.js";
import { attachPeek } from "./card-peek.js";
import { attachTilt } from "./card-tilt.js";
import { createDrag } from "./drag.js";
import { favChars, paintFavChar, favZone, dropToFav, flyToFav, heartIcon } from "./fav-chars.js";
import * as S from "./store.js";
import { USAGE_KEY, loadUsage, seedUsage, fetchUsage, tagsOfPositive } from "./usage.js";
import { weightsOfPositive } from "./weights.js";

// 背後預先開好的這一頁（prerender.js）：點進去之前這個房間讀的存檔被別頁改過，就重新整理。
guardPrerender("book");

const sfx = getSfx();
const $ = (id) => document.getElementById(id);
const UI_KEY = "mochi.book.v1";
// 只畫看得到的那幾排（2026-10-24）：以前一批批往下補、從不拿掉，捲到底一千多格、兩萬多個節點，
// 手機（CPU 降速 4 倍）捲 2 秒卡 23 次。現在格子固定高度，照捲動位置算該畫第幾排到第幾排，
// 上下各一塊空白撐住高度；捲出去的格子拿掉（節點留著，捲回來直接接上）。
// 畫面上方多留半屏、下方多留一屏半：往下捲時下一排已經在了，圖也先開始抓。
const BEHIND = 0.5;
const AHEAD = 1.5;
// 一格畫面最多花幾毫秒做新的牌：做不完的先放空位撐住版面，下一格接著換（以前一次 24 張，手機 50～70ms）。
const BUDGET_MS = 6;
// 做好的格子最多留幾個：捲很遠之後最久沒看到的放掉，記憶體不會一直長。
const CACHE_MAX = 900;
// 電腦（滑鼠）：卡盒「＋」、愛心等滑鼠移過去才做（每格少四五個節點）；觸控一直看得到，照舊一開始就做。
const HOVER = matchMedia("(hover: hover) and (pointer: fine)");
const ORDER_ZH = { desc: "多到少", asc: "少到多", good: "出好圖", bad: "常撤下", new: "新到舊", old: "舊到新" };
const ORDER_MARK = { desc: "↓", asc: "↑", good: "★", bad: "✕", new: "↓", old: "↑" };
// 禁用角色的原因（跟詞庫表同一套說法）。
const BAN_REASON = {
  minor: "未滿 18 歲",
  student: "學生",
  childlike: "外觀像兒童",
  real_person: "真人／VTuber",
  non_human: "非人形",
  unsure: "年齡查不到或沒把握",
};
const banReason = (card) => BAN_REASON[card.reason] || "禁用";
// 牌的戰績（出好圖／常撤下）：印好的圖裡，用了這張牌的有幾成被收藏、幾成被單張撤下。
// 從出圖日誌算（server.py 的 /api/genlog/stats），所以只算有日誌之後印的。
// 少於 WAR_MIN 張的不排（印 1 張收 1 張就 100%，沒意義）；排的時候用信賴下界，
// 印得多又穩定的排在「偶爾一次」前面。
const WAR_MIN = 3;
let war = null;
const warOf = (tag) => (war && war.cards[tag]) || [0, 0, 0];
const isWar = () => ui.order === "good" || ui.order === "bad";
const isDate = () => ui.order === "new" || ui.order === "old";
function lowerBound(k, n, z = 1.28) {
  if (!n) return 0;
  const p = k / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
}
const warScore = (tag) => {
  const [n, fav, drop] = warOf(tag);
  return lowerBound(ui.order === "good" ? fav : drop, n);
};
const pct = (k, n) => (n ? Math.round((k / n) * 100) : 0);

async function fetchWar() {
  try {
    const r = await fetch("/api/genlog/stats", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    war = { cards: j.cards || {}, total: j.total || 0, fav: j.fav || 0, discard: j.discard || 0, since: j.since || 0 };
  } catch {
    war = war || { cards: {}, total: 0, since: 0, failed: true };
  }
  return war;
}

let data = null;
let lex = null;
// 詞庫索引（cardFacts 用）：開頁不建，第一次打開詳情、浮空放大卡才建。
const lexNow = () => (lex ||= indexLexicon(data));
let lib = null;
let assets = null;
let usage = null;
let rating = "general";
// 分級「不限制」（rating-free.js，跟墨池同一份設定）：開著所有牌都看得到，當色情處理。
let free = false;
const seeRating = () => (free ? "explicit" : rating);
let ratingFreePaint = null;
let list = [];
// 牌的節點留著重用：換排序時同一張牌是同一個節點，才滑得過去，圖也不必重載。
const cells = new Map();
const ui = S.typedLike({ suit: "all", group: "", query: "", order: "desc", usedOnly: false, showBanned: false, charGender: "" }, readUi());
// 搜尋字跟著這個分頁走（store.js 的 saveTab／loadTab，跟合成池同一套）：去墨池放一張牌再回來，剛才找的字還在，
// 「回到剛才看的地方」（spotSig 裡有搜尋字）也對得上。重新整理照舊是空的；離開太久（半小時）不帶回來。
const QUERY_TAB = "mochi.book.query.v1";
{
  const back = S.loadTab(QUERY_TAB);
  if (back && typeof back.q === "string" && Date.now() - (Number(back.at) || 0) < 30 * 60 * 1000) ui.query = back.q;
}
addEventListener("pagehide", () => S.saveTab(QUERY_TAB, { q: ui.query, at: Date.now() }));
// 存檔裡的花色不是現在有的（改版、壞掉）：回到「全部」，不然卡冊整片是空的。
if (ui.suit !== "all" && !CARD_SUITS.includes(ui.suit)) ui.suit = "all";

function readUi() {
  try {
    const u = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    return u && typeof u === "object" ? u : {};
  } catch {
    return {};
  }
}
function saveUi() {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ suit: ui.suit, group: ui.group, order: ui.order, usedOnly: ui.usedOnly, showBanned: ui.showBanned, charGender: ui.charGender }));
  } catch {
    /* 存不了就算了 */
  }
}

/** 加入日（web/tag_dates.json）貼到牌上，並把禁用角色補進卡冊。不進詞庫的抽牌清單。 */
function attachDates(lib, dates) {
  const added = (dates && dates.added) || {};
  // 加入時間記到分鐘（scripts/tag_dates.py）：addedAt 拿來排（同一天的照先後），added 只留日期給畫面用。
  // 舊版的 tag_dates.json 只有日期，一樣能用。
  for (const card of lib.cards) {
    card.addedAt = added[card.tag] || "";
    card.added = card.addedAt.slice(0, 10);
  }
  for (const row of (dates && dates.banned) || []) {
    const tag = row && row.tag;
    if (!tag || lib.byTag.has(tag) || tag === "loli" || tag === "shota") continue;
    const gate = row.gate === "female" || row.gate === "male" ? row.gate : "any";
    const card = {
      tag,
      zh: row.zh || tag,
      suit: "chara",
      group: row.group || "character",
      groupZh: row.groupZh || "角色",
      seal: null,
      rating: "general",
      gate,
      eras: ["any"],
      addedAt: row.added || added[tag] || "",
      added: (row.added || added[tag] || "").slice(0, 10),
      banned: true,
      reason: row.reason || "",
      item: {
        tag,
        zh: row.zh || tag,
        section: "subject",
        group: "character",
        sub: row.group || "character",
        series: row.series || "",
        gate,
        era: ["any"],
        heat: ["tease"],
        implies: [],
        bind: [],
        mutex: null,
      },
    };
    lib.cards.push(card);
    lib.byTag.set(tag, card);
  }
}

const countOf = (tag) => usage.counts[tag] || 0;
const lastOf = (tag) => usage.last[tag] || 0;
// 數字格式器建一次重用：toLocaleString 每次都建一個，開頁時手機（降速 4 倍）光這個 32ms。
const numFmt = new Intl.NumberFormat(dateLocale);
const fmt = (n) => numFmt.format(n);

/* ================= 開機 ================= */

async function boot() {
  initMotion();
  // 快捷鍵說明（電腦）：頂欄的「?」、按 ? 打開（keys-help.js）。
  mountKeysHelp("book");
  // 新手導覽（頂欄「教學」右邊的「導覽」；第一次來會問要不要走一遍）：tour.js。
  mountTour("book");
  mountScreensaver();
  // 墨池、疊印台正在印的：頂欄看得到，點了回去（gen-status.js）。
  mountGenStatus("book");
  // 加入日（852KB）跟詞庫一起開始抓，但不等它：先畫第一屏，到了再補上日期。
  // 現在就要用到的（照日期排、含禁用）才等它，不然要整格重畫一次。
  const datesP = fetch(document.querySelector('link[rel="preload"][href^="tag_dates.json"]')?.href || "tag_dates.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let datesLate = false;
  try {
    const [lexicon, manifest] = await Promise.all([
      fetch(document.querySelector('link[rel="preload"][href^="lexicon.json"]')?.href || "lexicon.json").then((r) => r.json()),
      fetch(document.querySelector('link[rel="preload"][href^="cards/manifest.json"]')?.href || "cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    data = lexicon;
    lib = buildLibrary(data, { ratingBlocked });
    if (isDate() || ui.showBanned) attachDates(lib, await datesP);
    else datesLate = true;
    assets = createAssets(manifest);
  } catch (err) {
    // 連線問題（手機網路斷一下、伺服器沒開）：說「連不到主機」、給重試；不是叫人用 start.bat 開。
    if (isNetError(err)) return bootFailed(err);
    $("book").replaceChildren(el("p", { class: "book-empty" }, "讀不到詞庫。請用 start.bat 開，而不是直接點 HTML。", el("br"), String(err)));
    return;
  }
  rating = (S.loadSettings() || {}).rating || "general";
  free = (S.loadSettings() || {}).ratingFree === true;
  // 第一次打開：從成品牆、晾紙繩補算（只做一次）。
  usage = seedUsage((t) => lib.byTag.has(t));
  if (!ORDER_ZH[ui.order]) ui.order = "desc";
  // 戰績排序：先等一下日誌的統計（畫兩次會整片跳）；伺服器慢就先畫、回來再排。
  const warReady = fetchWar();
  if (isWar()) await Promise.race([warReady, new Promise((r) => setTimeout(r, 900))]);
  // 這個瀏覽器還沒跟伺服器對過（新手機、清過資料）：本機的排序跟正本差很多，
  // 先畫本機的、正本一到整格重排，第一批牌的圖白載、版面也多排一次。等正本一下下再畫，
  // 伺服器慢（或沒開）就不等了，照舊先畫本機的、回來再換。
  let first = null;
  if (!usage.synced) {
    first = fetchUsage();
    const u = await Promise.race([first, new Promise((r) => setTimeout(r, 700))]);
    if (u) {
      usage = u;
      first = Promise.resolve(null); // 已經是正本了，下面不用再問一次
    }
  }

  watchMast();
  buildBox();
  renderRating();
  ratingFreePaint = mountRatingFree({
    get: () => free,
    set: (on) => {
      free = on;
      S.saveSettings({ ...(S.loadSettings() || {}), ratingFree: on });
      renderSuits();
      render();
      renderSummary();
    },
  });
  renderSort();
  renderUsedToggle();
  renderBannedToggle();
  renderSuits();
  wireSearch();
  mountMiniBar();
  sizeCells($("book-grid"));
  wireGrid();
  render({ animate: false, deal: true });
  restoreSpot();
  watchScroll();
  if (datesLate)
    datesP.then((dates) => {
      attachDates(lib, dates);
      // 日期到了：畫面上的格子補上那一行。等的時候已經切到照日期排、含禁用的話，整格照新的重排一次。
      if (isDate() || ui.showBanned) render({ animate: false });
      else repaintLive();
      renderSummary();
    });
  addEventListener("pagehide", saveSpot);
  renderSummary({ count: true });
  pingLoop();
  wireSound();
  watchOtherTabs();
  // 先用這個瀏覽器的快取畫，伺服器的正本（所有裝置共用）回來再換上；之後定時問一次。
  (first || fetchUsage()).then((u) => applyUsage(u, { quiet: true }));
  watchServer();
  warReady.then(() => {
    if (isWar()) (render(), renderSummary());
    // 日誌的統計到了，成就才算得完整：這時才比對、跳「解鎖」。
    renderAch({ announceNew: true });
  });
  $("book-ach").addEventListener("click", openAch);
  renderAch();
  // 滑鼠停在牌上：跟墨池、疊印台同一張浮空放大卡，多一行用過幾次。
  attachPeek($("book-grid"), ".card[data-tag]", peekInfo);
  attachTilt($("book-grid"));
  sizeCards($("book-grid"));
  settleMotion();
  // 開好了：左右相鄰的房間在背後先開好，換過去不用再等開頁（prerender.js）。
  whenActive(prerenderNeighbors);
  // 作品冊、成品上點牌名過來（book.html#card=red%20hair）：直接打開那張牌的詳情。
  openFromHash();
  addEventListener("hashchange", openFromHash);
}

/** 網址帶 #card=<tag>：打開那張牌的詳情（作品冊的牌名籤點過來的）。打開後把 #card 拿掉，重新整理不會又開。 */
function openFromHash() {
  const m = /^#card=(.+)$/.exec(location.hash);
  if (!m) return;
  let tag = "";
  try {
    tag = decodeURIComponent(m[1]);
  } catch {
    return;
  }
  history.replaceState(null, "", location.pathname + location.search);
  const card = lib.byTag.get(tag);
  if (!card) return toast("詞庫裡沒有這張牌了");
  // 牌在清單裡（沒被篩掉）：捲到那一排、接上，從它飛進詳情；不在（被篩掉）照樣打開詳情。
  const i = list.indexOf(card);
  if (i >= 0 && rowH) {
    scrollTo({ top: gridTopY() + Math.floor(i / cols) * rowH - innerHeight / 3, behavior: "instant" });
    layoutWindow();
  }
  const node = cells.get(tag)?.isConnected ? cells.get(tag).querySelector(".card") : null;
  openCard(card, node);
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
          onclick: (e) => {
            if (rating === r) return;
            const focused = document.activeElement === e.currentTarget;
            rating = r;
            // 跟墨池同一個尺度：這裡換了，回墨池也是這一檔。
            S.saveSettings({ ...(S.loadSettings() || {}), rating: r });
            renderRating();
            const selected = box.querySelector('[aria-checked="true"]');
            if (focused) selected?.focus({ preventScroll: true });
            seat(selected);
            renderSuits();
            render();
            renderSummary();
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

/* ================= 摘要：用過幾張、共幾次 ================= */

let sumShown = { used: 0, total: 0 };
function renderSummary({ count = false } = {}) {
  const pool = lib.cards.filter(drawable);
  const used = pool.filter((c) => countOf(c.tag) > 0).length;
  const total = pool.reduce((n, c) => n + countOf(c.tag), 0);
  const box = $("book-sum");
  if (isWar()) {
    // 戰績排序：摘要換成整體的比例——每張牌跟它比，才知道算好還是算差。
    clearInterval(box._tick);
    const t = war?.total || 0;
    box.replaceChildren(
      el("span", {}, "日誌裡印好 "),
      el("b", { class: "book-sum-n" }, fmt(t)),
      el("span", {}, " 張"),
      t ? el("span", { class: "book-sum-dot", "aria-hidden": "true" }, "・") : null,
      t ? el("span", {}, `整體收藏 ${pct(war.fav, t)}%・撤下 ${pct(war.discard, t)}%`) : null
    );
    sumShown = { used: -1, total: -1 };
    return;
  }
  // 換分級、尺度後牌的總數變了：那一段淡進來（數字自己會數過去）。
  const poolChanged = box._poolLen !== undefined && box._poolLen !== pool.length;
  box._poolLen = pool.length;
  // 一行只建一次，數字數上去時只換數字：那一段的淡入不會被每一格重畫打斷。
  // 沒連上伺服器、這台又沒有快取：寫「讀不到」，不要寫「0 次」（看起來像紀錄被清掉了）。
  if (usage?.unreachable && !total) {
    clearInterval(box._tick);
    box.replaceChildren(el("span", {}, "讀不到伺服器上的使用次數：伺服器沒開，或連不到主機"));
    sumShown = { used: -1, total: -1 };
    return;
  }
  const nU = el("b", { class: "book-sum-n" });
  const nT = el("b", { class: "book-sum-n" });
  const of = el("span", {}, ` ／ ${fmt(pool.length)} 張用過`);
  box.replaceChildren(nU, of, el("span", { class: "book-sum-dot", "aria-hidden": "true" }, "・"), el("span", {}, "共 "), nT, el("span", {}, " 次"));
  if (poolChanged && !reducedMotion()) of.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
  const paint = (u, t) => {
    nU.textContent = fmt(u);
    nT.textContent = fmt(t);
  };
  const from = count ? { used: 0, total: 0 } : sumShown;
  sumShown = { used, total };
  // 從戰績換回來（from 是 -1）：直接寫上，不從 0 數。
  if (reducedMotion() || from.used < 0 || (from.used === used && from.total === total)) return paint(used, total);
  // 數字從舊值數到新值（開頁時從 0）：用計時器不用 rAF，分頁在背景也會停在對的數字。
  const t0 = performance.now();
  const dur = count ? DUR.develop : DUR.long;
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  clearInterval(box._tick);
  box._tick = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    const e = ease(k);
    paint(Math.round(from.used + (used - from.used) * e), Math.round(from.total + (total - from.total) * e));
    if (k >= 1) clearInterval(box._tick);
  }, 33);
}

/* ================= 工具列：花色、排序、只看用過的、找字 ================= */

function renderSuits() {
  const tabs = $("book-suits");
  const pool = lib.cards.filter(visibleCard);
  const usedIn = (s) => pool.filter((c) => (s === "all" || c.suit === s) && countOf(c.tag) > 0).length;
  const totalIn = (s) => pool.filter((c) => c.suit === s).length || 1;
  tabs.replaceChildren(
    el("button", { class: "suit-tab pressable", type: "button", "aria-pressed": ui.suit === "all" ? "true" : "false", onclick: (e) => pickSuit("all", e.currentTarget) }, "全部"),
    ...CARD_SUITS.map((s) =>
      el(
        "button",
        {
          class: "suit-tab pressable",
          type: "button",
          // --lit：這個花色點亮了幾成，畫成圖章外圈的一圈（book.css）。
          style: `--suit: var(--suit-${s}); --lit: ${(usedIn(s) / totalIn(s)).toFixed(3)}`,
          "aria-pressed": ui.suit === s ? "true" : "false",
          title: `${CARD_SUIT_INFO[s].zh}：點亮 ${usedIn(s)} / ${totalIn(s)} 張`,
          onclick: (e) => pickSuit(s, e.currentTarget),
        },
        el("b", { "aria-hidden": "true" }, CARD_SUIT_INFO[s].glyph),
        CARD_SUIT_INFO[s].zh
      )
    )
  );
  renderGroups();
}

/**
 * 篩選、排序換了：捲過頭的話捲回來，換好的牌從第一張開始看。
 *   電腦（工具列黏在頂欄底下）：捲到牌格頂端剛好貼著工具列；還沒捲到牌格就不動。
 *   手機（工具列不黏，跟著捲走）：只有換排序（always）才回卡冊頂端，跟以前一樣。
 */
function backToTop({ always = false } = {}) {
  const tools = $("book-tools");
  if (getComputedStyle(tools).position === "sticky") {
    const below = tools.getBoundingClientRect().height + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mast-h")) || 0);
    const top = $("book-grid").getBoundingClientRect().top + scrollY - below - 8;
    if (scrollY > top) scrollTo({ top, behavior: "instant" });
    return;
  }
  if (!always) return;
  const top = $("book").getBoundingClientRect().top + scrollY - 8;
  if (scrollY > top) scrollTo({ top, behavior: "instant" });
}

/** 頂欄的高度放進 --mast-h（工具列黏在它底下）。頂欄換行、字級跟著螢幕放大時會變。 */
function watchMast() {
  const mast = document.querySelector(".mast");
  if (!mast) return;
  const put = () => document.documentElement.style.setProperty("--mast-h", mast.getBoundingClientRect().height + "px");
  put();
  if (typeof ResizeObserver === "function") new ResizeObserver(put).observe(mast);
}

function pickSuit(s, from) {
  if (ui.suit === s) return;
  const focused = document.activeElement === from;
  ui.suit = s;
  ui.group = "";
  saveUi();
  renderSuits();
  const selected = $("book-suits").querySelector('[aria-pressed="true"]');
  if (focused) selected?.focus({ preventScroll: true });
  seat(selected);
  backToTop();
  render();
}

// 角色的小分類是作品（七十幾部），黏在工具列裡會佔掉半個畫面：只有角色這頁把籤放在牌上面跟著捲。
const FLOW_GROUP_SUITS = new Set(["chara"]);

/** 現在放小分類籤的那一格：籤少黏在工具列裡，籤多跟著捲。 */
function groupsBox() {
  const flow = $("book-groups-flow");
  return flow && !flow.hidden ? flow : $("book-groups");
}

function renderGroups() {
  const sticky = $("book-groups");
  const flow = $("book-groups-flow");
  const now = $("book-group-now");
  // 籤列出現、收起、變高變矮時，下面的牌滑過去，不是一格跳（rowChange）。
  const rowMove = rowChange(flow, $("book-grid"));
  for (const b of [sticky, flow, now]) {
    if (!b) continue;
    b.hidden = true;
    b.replaceChildren();
  }
  if (ui.suit === "all") return rowMove.done();
  const runs = groupChips(lib.cards.filter((c) => c.suit === ui.suit && visibleCard(c) && genderOk(c)));
  if (ui.group && !runs.some((r) => r.items.some((i) => i.g === ui.group))) ui.group = "";
  const count = runs.reduce((n, r) => n + r.items.length, 0);
  const many = !!flow && FLOW_GROUP_SUITS.has(ui.suit);
  const box = many ? flow : sticky;
  // 角色頁一律留著：性別籤在這一排，篩到沒牌時也要能切回來。
  box.hidden = ui.suit !== "chara" && count < 2;
  // 籤跟著捲走了：黏住的工具列留一顆「現在篩的這一格 ✕」，捲到多下面都知道在看哪一格，點一下回到全部。
  if (many && ui.group && now) {
    const cur = runs.flatMap((r) => r.items).find((i) => i.g === ui.group);
    if (cur) {
      now.hidden = false;
      now.replaceChildren(
        el("button", { class: "group-chip pressable", type: "button", "aria-pressed": "true", "aria-label": `${cur.zh}：清掉篩選`, onclick: (e) => pickGroup("", e.currentTarget) }, cur.short, el("span", { "aria-hidden": "true" }, " ✕"))
      );
    }
  }
  const chip = (i, inRun) =>
    el(
      "button",
      { class: "group-chip pressable", type: "button", "aria-pressed": ui.group === i.g ? "true" : "false", "aria-label": i.short === i.zh ? null : i.zh, onclick: (e) => pickGroup(i.g, e.currentTarget) },
      i.seal && !inRun ? el("b", { class: "chip-seal", "aria-hidden": "true" }, i.seal) : null,
      i.short
    );
  const all = [
    el("button", { class: "group-chip pressable", type: "button", "aria-pressed": ui.group === "" ? "true" : "false", onclick: (e) => pickGroup("", e.currentTarget) }, "全部"),
    ...runs.map((r) =>
      r.fam
        ? chipRun(r, r.items.map((i) => chip(i, true)), { fold: ui.suit === "chara", picked: ui.group })
        : chip(r.items[0], false)
    ),
  ];
  box.replaceChildren(...(ui.suit === "chara" ? [genderChips(ui.charGender, pickGender), seriesRun(all)] : all));
  swapIn(box, ui.suit);
  rowMove.done();
}

function pickGroup(g, from) {
  if (ui.group === g) return;
  ui.group = g;
  saveUi();
  renderGroups();
  const selected = [...groupsBox().querySelectorAll(".group-chip:not([data-gender])")].find((b) => b.getAttribute("aria-pressed") === "true");
  if (from && document.activeElement === from) selected?.focus({ preventScroll: true });
  seat(selected);
  backToTop();
  render();
}

function renderSort() {
  const box = $("book-sort");
  syncChoices(box, "aria-checked",
    ...Object.keys(ORDER_ZH).map((o) =>
      el(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": ui.order === o ? "true" : "false",
          onclick: (e) => {
            if (ui.order === o) return;
            const focused = document.activeElement === e.currentTarget;
            ui.order = o;
            saveUi();
            renderSort();
            const selected = box.querySelector('[aria-checked="true"]');
            if (focused) selected?.focus({ preventScroll: true });
            seat(selected);
            // 換排序：先回到頂端，讓「最多／最少」的那幾張在眼前排好。
            backToTop({ always: true });
            render({ shuffle: true });
            renderSummary();
            // 戰績要日誌：還沒讀到（或讀過一陣子了）就問一次，回來再排。
            if (isWar()) fetchWar().then(() => isWar() && (render(), renderSummary()));
          },
        },
        el("span", { class: "sort-arrow", "aria-hidden": "true" }, ORDER_MARK[o]),
        ORDER_ZH[o]
      )
    )
  );
}

function renderBannedToggle() {
  const b = $("book-banned");
  b.setAttribute("aria-pressed", ui.showBanned ? "true" : "false");
  b.onclick = () => {
    ui.showBanned = !ui.showBanned;
    saveUi();
    b.setAttribute("aria-pressed", ui.showBanned ? "true" : "false");
    seat(b);
    backToTop();
    renderSuits();
    render();
  };
}

function renderUsedToggle() {
  const b = $("book-used");
  b.setAttribute("aria-pressed", ui.usedOnly ? "true" : "false");
  b.onclick = () => {
    ui.usedOnly = !ui.usedOnly;
    saveUi();
    b.setAttribute("aria-pressed", ui.usedOnly ? "true" : "false");
    seat(b);
    backToTop();
    render();
  };
}

function wireSearch() {
  const q = $("book-q");
  q.value = ui.query;
  let timer = 0;
  const apply = () => {
    clearTimeout(timer);
    if (ui.query === q.value.trim()) return;
    ui.query = q.value.trim();
    backToTop();
    render();
  };
  q.addEventListener("input", (e) => {
    clearTimeout(timer);
    // 注音、倉頡組字中不排：每按一鍵就用半個字搜一次，整片閃「沒有符合」，看起來像在等。選完字（compositionend）立刻排。
    if (e.isComposing) return;
    // 打字時等一下下再排：每打一個字就整片滑一次太吵。
    timer = setTimeout(apply, 140);
  });
  q.addEventListener("compositionend", apply);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && q.value) {
      q.value = "";
      ui.query = "";
      render();
    } else if (e.key === "Enter") {
      const first = $("book-grid").querySelector(".card");
      if (first) first.click();
      else refuse(q);
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && !document.querySelector(".overlay")) {
      e.preventDefault();
      q.focus();
    }
  });
}

/* ================= 手機：頂欄往上滑回來時多接一條小工具列 =================
 * 手機的工具列不黏（兩三行高，加上頂欄會佔掉四分之一個螢幕），捲到中間想換花色、排序、找別的牌
 * 得一路捲回頂端。頂欄往上滑冒出來（motion.js 的 watchMastPeek，html[data-mast="peek"]）而工具列已經捲走時，
 * 頂欄底下多接一條 44px：找牌、花色、排序、清除篩選；頂欄收回去它也跟著收。
 * 花色、排序按的是工具列上原本那幾顆（同一套規則、同一個畫面）。 */
const MINI_MQ = "(max-width: 40rem)";

function filtersOn() {
  return ui.suit !== "all" || !!ui.group || !!ui.query || ui.usedOnly || ui.showBanned || !!ui.charGender;
}

function clearFilters() {
  ui.suit = "all";
  ui.group = "";
  ui.query = "";
  ui.usedOnly = false;
  ui.showBanned = false;
  ui.charGender = "";
  $("book-q").value = "";
  saveUi();
  renderSuits();
  renderUsedToggle();
  renderBannedToggle();
  render();
  renderSummary();
}

function mountMiniBar() {
  const mq = matchMedia(MINI_MQ);
  const q = el("input", { class: "book-mini-q", type: "search", placeholder: "找牌", "aria-label": "找牌", autocomplete: "off", enterkeyhint: "search" });
  const suitBtn = el("button", { class: "book-mini-btn pressable", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", dataset: { menu: "suit" } });
  const sortBtn = el("button", { class: "book-mini-btn pressable", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", dataset: { menu: "sort" } });
  const clear = el("button", { class: "book-mini-btn book-mini-clear pressable", type: "button", title: "清除篩選", "aria-label": "清除篩選" }, "清除");
  const menu = el("div", { class: "book-mini-menu", role: "menu", hidden: true });
  const bar = el("div", { class: "book-mini", id: "book-mini", role: "toolbar", "aria-label": "卡冊工具", dataset: { show: "false" }, inert: true }, el("div", { class: "book-mini-in" }, q, suitBtn, sortBtn, clear), menu);
  document.body.append(bar);
  const sync = () => {
    if (document.activeElement !== q) q.value = ui.query;
    const s = ui.suit === "all" ? null : CARD_SUIT_INFO[ui.suit];
    suitBtn.replaceChildren(s ? el("b", { class: "suit-glyph", "aria-hidden": "true", style: `color: var(--suit-${ui.suit})` }, s.glyph) : null, el("span", {}, s ? s.zh : "全部花色"));
    suitBtn.setAttribute("aria-label", t(`花色：${s ? s.zh : "全部"}`));
    sortBtn.replaceChildren(el("span", { class: "sort-arrow", "aria-hidden": "true" }, ORDER_MARK[ui.order]), el("span", {}, ORDER_ZH[ui.order]));
    sortBtn.setAttribute("aria-label", t(`排序：${ORDER_ZH[ui.order]}`));
    clear.hidden = !filtersOn();
  };
  bar._sync = sync;
  let shown = false;
  const show = (on) => {
    if (on === shown) return;
    shown = on;
    if (on) sync();
    else shutMenu();
    bar.dataset.show = on ? "true" : "false";
    bar.inert = !on;
  };
  function shutMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    for (const b of [suitBtn, sortBtn]) b.setAttribute("aria-expanded", "false");
  }
  function openMenu(kind, btn) {
    if (!menu.hidden && menu.dataset.kind === kind) return shutMenu();
    menu.dataset.kind = kind;
    // 選單裡的每一顆按的是工具列上原本那一顆：規則、存檔、動畫都是同一套。
    const source = kind === "suit" ? [...$("book-suits").querySelectorAll(".suit-tab")] : [...$("book-sort").querySelectorAll("button")];
    menu.replaceChildren(
      ...source.map((orig) =>
        el(
          "button",
          {
            class: "book-mini-item pressable",
            type: "button",
            role: "menuitemradio",
            "aria-checked": orig.getAttribute("aria-pressed") === "true" || orig.getAttribute("aria-checked") === "true" ? "true" : "false",
            style: orig.getAttribute("style") || undefined,
            onclick: () => {
              shutMenu();
              orig.click();
              // 換了花色、排序：從第一張開始看（手機的工具列不黏，回到牌格頂端）。
              const top = $("book-grid").getBoundingClientRect().top + scrollY - bar.offsetHeight - 8;
              if (scrollY > top) scrollTo({ top, behavior: "instant" });
              sync();
            },
          },
          [...orig.childNodes].map((n) => n.cloneNode(true))
        )
      )
    );
    menu.hidden = false;
    for (const b of [suitBtn, sortBtn]) b.setAttribute("aria-expanded", b === btn ? "true" : "false");
    if (!reducedMotion()) menu.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
  }
  suitBtn.addEventListener("click", () => openMenu("suit", suitBtn));
  sortBtn.addEventListener("click", () => openMenu("sort", sortBtn));
  clear.addEventListener("click", () => {
    shutMenu();
    clearFilters();
    sync();
    toast("篩選都清掉了");
  });
  // 找牌：跟上面那個搜尋框同一份（打在這裡等於打在那裡，排法、組字規則都一樣）。
  q.addEventListener("input", (e) => {
    const main = $("book-q");
    main.value = q.value;
    main.dispatchEvent(new InputEvent("input", { isComposing: e.isComposing }));
    clear.hidden = !filtersOn() && !q.value.trim();
  });
  q.addEventListener("compositionend", () => $("book-q").dispatchEvent(new Event("compositionend")));
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") q.blur();
    else if (e.key === "Escape" && q.value) {
      q.value = "";
      q.dispatchEvent(new Event("input"));
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!bar.contains(e.target)) shutMenu();
  }, true);
  // 跟著頂欄：頂欄冒出來（peek）、而且原本那排工具列已經捲到頂欄後面去了，才接上來。
  // 捲回工具列看得到的地方就收（上面就有原本那排）；正在打字、選單開著時不收。
  const root = document.documentElement;
  const update = () => {
    if (!mq.matches) return show(false);
    const mastH = parseFloat(getComputedStyle(root).getPropertyValue("--mast-h")) || 0;
    const past = $("book-tools").getBoundingClientRect().bottom < mastH;
    if (shown && past && (document.activeElement === q || !menu.hidden)) return;
    show(past && root.dataset.mast === "peek");
  };
  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ["data-mast"] });
  let ticking = false;
  addEventListener("scroll", () => {
    if (!shown || ticking) return;
    ticking = true;
    requestAnimationFrame(() => ((ticking = false), update()));
  }, { passive: true });
  mq.addEventListener("change", update);
}

/* ================= 牌格 ================= */

/** 能拿去抽的牌。禁用角色只在卡冊裡查日期，不進使用統計、名次、成就。 */
// 分級擋不擋：每張牌、每一檔各算一次就記住（規則是固定的）。以前每次排、篩都把 7238 張重算一遍。
const blockedMemo = new Map();
function blocked(card, level) {
  let m = blockedMemo.get(card);
  if (!m) blockedMemo.set(card, (m = {}));
  return (m[level] ??= ratingBlocked(card.item, level));
}
const drawable = (card) => !card.banned && !blocked(card, seeRating());

function visibleCard(card) {
  if (card.banned) return ui.showBanned;
  return !blocked(card, seeRating());
}

/** 角色頁的「性別：全部／女／男」：只是瀏覽篩選，不影響花色的點亮數。 */
const genderOk = (c) => ui.suit !== "chara" || !ui.charGender || c.gate === ui.charGender;

function pickGender(g, from) {
  if (ui.charGender === g) return;
  const focused = document.activeElement === from;
  ui.charGender = g;
  saveUi();
  renderGroups();
  if (focused) groupsBox().querySelector(`[data-gender="${g}"]`)?.focus({ preventScroll: true });
  backToTop();
  render();
}

// 上一次 listNow 的搜尋結果是哪一種（searchCards 的 mode）：牌格上面那一行說明要用。
let lastFound = { list: [], mode: "all" };

function listNow() {
  const q = ui.query.toLowerCase();
  const order = new Map(lib.cards.map((c, i) => [c.tag, i]));
  const base = lib.cards.filter(
    (c) =>
      visibleCard(c) &&
      genderOk(c) &&
      (ui.suit === "all" || c.suit === ui.suit) &&
      (!ui.group || c.group === ui.group) &&
      (!ui.usedOnly || countOf(c.tag) > 0) &&
      (!isWar() || warOf(c.tag)[0] >= WAR_MIN)
  );
  // 搜尋（cards.js 的 searchCards）：分別找到的、猜的照它的順序；每段都有的照下面的排序，
  // 再讓完全相符、開頭相符的排前面（按 Enter 打開的就是它）。
  lastFound = q ? searchCards(base, q) : { list: base, mode: "all" };
  // 整盒找得到、只是被分級擋住：交給 emptyNote 說清楚，不要用猜的蓋過去。
  if (lastFound.mode !== "all" && lib.cards.some((c) => cardMatches(c, q))) lastFound = { list: [], mode: "none" };
  if (lastFound.mode !== "all") return lastFound.list;
  const out = lastFound.list.slice();
  if (isWar()) out.sort((a, b) => warScore(b.tag) - warScore(a.tag) || warOf(b.tag)[0] - warOf(a.tag)[0] || order.get(a.tag) - order.get(b.tag));
  // 沒有日期的排最後。同一天維持字盒順序（花色 → 細分類）。
  // 沒有日期的：詞庫剛加、還沒重跑 scripts/tag_dates.py 的字，其實是最新的。新到舊排最前面，舊到新排最後。
  // 同一天的照加入的時間先後（一天可能進好幾批）。
  else if (ui.order === "new") out.sort((a, b) => (b.addedAt || "9999-99-99").localeCompare(a.addedAt || "9999-99-99") || order.get(a.tag) - order.get(b.tag));
  else if (ui.order === "old") out.sort((a, b) => (a.addedAt || "9999-99-99").localeCompare(b.addedAt || "9999-99-99") || order.get(a.tag) - order.get(b.tag));
  // 次數一樣時：多到少看誰最近用過，少到多照字盒的順序（花色 → 細分類）。
  else if (ui.order === "desc") out.sort((a, b) => countOf(b.tag) - countOf(a.tag) || lastOf(b.tag) - lastOf(a.tag) || order.get(a.tag) - order.get(b.tag));
  else out.sort((a, b) => countOf(a.tag) - countOf(b.tag) || order.get(a.tag) - order.get(b.tag));
  if (q) {
    const rank = new Map(out.map((c) => [c, matchRank(c, q)]));
    out.sort((a, b) => rank.get(a) - rank.get(b));
  }
  return out;
}

/** 一張牌的格子：牌＋底下的次數。名次（前三）、沒用過的樣子每次排完重上。 */
function cellOf(card) {
  let cell = cells.get(card.tag);
  if (cell) {
    // 最近用到的排到後面（Map 照放進去的順序）：快取滿了先放掉最久沒看到的。
    cells.delete(card.tag);
    cells.set(card.tag, cell);
    return cell;
  }
  // 禁用角色不接卡面：舊圖就算還在磁碟上，也不在卡冊裡顯示。
  const node = cardNode(card, card.banned ? { art: () => null, sources: () => null, mini: () => null } : assets);
  // 點牌打開詳情：整格網格一個監聽（wireGrid），不再每張牌各掛一個。
  const n = el("b", { class: "book-n" });
  const meta = el("span", { class: "book-meta" }, n, el("span", { class: "book-unit" }), el("span", { class: "book-when" }));
  cell = el("div", { class: "book-cell", role: "listitem", dataset: { tag: card.tag } }, node, meta);
  cell._card = card;
  // 禁用角色沒有卡盒、也沒有愛心：不能帶去抽。電腦上等滑鼠移過去才做（wireGrid）。
  if (!card.banned) {
    if (HOVER.matches) cell._lazyButtons = true;
    else addButtons(cell, card);
  }
  // 角色牌：左下角一顆愛心（點一下加進偏好角色），也可以直接拖到畫面右緣的愛心。
  if (card.suit === "chara" && !card.banned) {
    paintFavChar(node, card.tag);
    favDrag().attach(node, { tag: card.tag, from: "book" });
  }
  cells.set(card.tag, cell);
  if (cells.size > CACHE_MAX) {
    for (const [tag, c] of cells) {
      if (cells.size <= CACHE_MAX * 0.8) break;
      if (!c.isConnected) cells.delete(tag);
    }
  }
  return cell;
}

/** 卡盒「＋」、角色的愛心。 */
function addButtons(cell, card) {
  cell._lazyButtons = false;
  cell.append(boxAddButton(card));
  if (card.suit === "chara") cell.append(favAddButton(card));
  paintBoxMark(cell, card.tag);
}

/** 網格上的事件：點牌開詳情；滑鼠移到（或 Tab 到）一格才做那一格的按鈕。 */
function wireGrid() {
  const grid = $("book-grid");
  grid.addEventListener("click", (e) => {
    const node = e.target.closest?.(".book-cell > .card");
    const cell = node?.parentElement;
    if (!cell?._card || !grid.contains(cell)) return;
    openCard(cell._card, node);
  });
  const arm = (e) => {
    const cell = e.target.closest?.(".book-cell");
    if (cell?._lazyButtons && cell._card) addButtons(cell, cell._card);
  };
  grid.addEventListener("pointerover", arm, { passive: true });
  grid.addEventListener("focusin", arm);
}

function paintCell(cell, card, rank) {
  const c = countOf(card.tag);
  cell.dataset.unused = c ? "false" : "true";
  cell.dataset.banned = card.banned ? "true" : "false";
  const n = cell.querySelector(".book-n");
  const unit = cell.querySelector(".book-unit");
  const when = cell.querySelector(".book-when");
  if (isWar()) {
    // 戰績：大字是幾成，小字是「收藏（撤下）・印過幾張」。日期留在第三行。
    const [w, fav, drop] = warOf(card.tag);
    const k = ui.order === "good" ? fav : drop;
    cell.dataset.war = ui.order;
    cell.dataset.warZero = k ? "false" : "true";
    delete cell.dataset.face;
    n.textContent = `${pct(k, w)}%`;
    unit.textContent = `${ui.order === "good" ? "收藏" : "撤下"}・${fmt(w)} 張`;
    when.textContent = card.added || "";
  } else if (isDate()) {
    delete cell.dataset.war;
    delete cell.dataset.warZero;
    cell.dataset.face = "date";
    n.textContent = card.added || "—";
    unit.textContent = card.added ? "加入" : "沒有日期";
    when.textContent = c ? `${fmt(c)} 次` : "未使用";
  } else {
    delete cell.dataset.war;
    delete cell.dataset.warZero;
    delete cell.dataset.face;
    n.textContent = c ? fmt(c) : "—";
    unit.textContent = c ? "次" : "未使用";
    when.textContent = card.added || "";
  }
  const old = cell.querySelector(".book-rank");
  if (rank) {
    if (!old || old.textContent !== String(rank)) {
      old?.remove();
      const seal = el("span", { class: "book-rank", dataset: { r: String(rank) }, "aria-label": `第 ${rank} 名` }, String(rank));
      cell.querySelector(".card").append(seal);
      cell._stampRank = true;
    }
  } else old?.remove();
  if (card.banned) setCardFlag(cell.querySelector(".card"), { kind: "ban", text: "禁用" });
  else paintBoxMark(cell, card.tag);
  const [w, fav, drop] = warOf(card.tag);
  const addedNote = card.added ? `，${card.added} 加入` : "";
  cell
    .querySelector(".card")
    .setAttribute(
      "aria-description",
      isWar()
        ? `印過 ${w} 張，收藏 ${fav} 張、撤下 ${drop} 張${rank ? `，第 ${rank} 名` : ""}${addedNote}`
        : c
          ? `用過 ${c} 次${rank ? `，第 ${rank} 名` : ""}${addedNote}`
          : card.added
            ? `還沒用過，${card.added} 加入`
            : "還沒用過"
    );
}

/* ================= 只畫看得到的那幾排 =================
 * list 是整份排好的牌；畫面上只接 list[winStart..winEnd) 這一段（live），上下各一塊空白（book-pad）撐住高度。
 * 格子固定高（--book-cell-h，第一次畫好量一次，格寬變了再量），所以第 i 張在第 floor(i / cols) 排、
 * 離網格頂端 排數 × rowH，不用一格格量。 */
let cols = 1;
let rowH = 0;
let gapY = 0;
let padY = 0;
let padTop = null;
let padBottom = null;
let tail = null;
let live = [];
let winStart = 0;
let winEnd = 0;
let scrollFrame = 0;
let fillFrame = 0;
let aheadId = 0;
// 上一次照捲動位置接牌時，畫面頂端那一排的第一張（換寬時捲回它）。
let topIndex = 0;

/**
 * 卡冊的格寬（book.css 的 .book-grid 改成一排排折行）：跟 grid 的 repeat(auto-fill, minmax(最小, 1fr)) 同一個算法，
 * 能放幾欄就放幾欄、平分剩下的寬。視窗一變就重算，格高跟著重量。
 */
function sizeCells(grid) {
  let lastW = 0;
  const fit = () => {
    // 網格的高一直在變（捲動時上下的空白）：寬沒變就不重算。
    if (grid.clientWidth === lastW) return;
    lastW = grid.clientWidth;
    const cs = getComputedStyle(grid);
    const w = grid.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    if (!(w > 0)) return;
    // 換寬之前畫面頂端是第幾張（上一次捲動時記下的；這時版面已經照新寬度排過，現量會量錯）：
    // 換完捲回那張牌所在的那一排，不然排數變了，看到的是別處。
    const anchor = live.length && rowH && topIndex > 0 ? topIndex : -1;
    const min = parseFloat(cs.getPropertyValue("--book-min")) || 104;
    const gap = parseFloat(cs.columnGap) || 0;
    cols = Math.max(1, Math.floor((w + gap) / (min + gap)));
    gapY = parseFloat(cs.rowGap) || 0;
    padY = parseFloat(cs.paddingTop) || 0;
    // 往下取到 0.01px：四捨五入多出一點點，最後一欄就會被擠到下一排。
    const cell = `${Math.floor(((w - gap * (cols - 1)) / cols) * 100) / 100}px`;
    if (grid.style.getPropertyValue("--book-cell-w") !== cell) grid.style.setProperty("--book-cell-w", cell);
    // 欄數、格寬變了：格高跟著變。拿畫面上的格子（已經是新寬度）直接重量，捲回剛才那張，再重接這一段。
    // 以前先清掉 rowH 重畫：中間那一下網格只剩前幾排，頁面變短、捲動位置被瀏覽器夾掉，畫面一片空白。
    if (live.length && measureRow()) {
      if (anchor >= 0) scrollTo({ top: gridTopY() + Math.floor(anchor / cols) * rowH, behavior: "instant" });
      layoutWindow(true);
    }
  };
  fit();
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(grid);
}

/** 網格內容（第一排）在整頁的哪個高度。 */
const gridTopY = () => $("book-grid").getBoundingClientRect().top + scrollY + padY;

/** 量一排多高：拿現在畫好的格子（不是空位）裡最高的，定成全部格子的高。 */
function measureRow() {
  const grid = $("book-grid");
  const probes = live.filter((n) => !n._skel).slice(0, cols * 2);
  if (!probes.length) return false;
  grid.style.removeProperty("--book-cell-h");
  let h = 0;
  for (const c of probes) h = Math.max(h, c.offsetHeight);
  if (!h) return false;
  grid.style.setProperty("--book-cell-h", `${h}px`);
  rowH = h + gapY;
  return true;
}

/** 現在該畫哪一段：[開始, 結束)，都是整排。 */
function windowNow() {
  if (!list.length) return [0, 0];
  if (!rowH) return [0, Math.min(list.length, cols * 6)];
  const top = scrollY - gridTopY();
  topIndex = Math.max(0, Math.floor(top / rowH)) * cols;
  const r0 = Math.max(0, Math.floor((top - innerHeight * BEHIND) / rowH));
  const r1 = Math.max(r0 + 1, Math.ceil((top + innerHeight * (1 + AHEAD)) / rowH));
  return [Math.min(list.length, r0 * cols), Math.min(list.length, r1 * cols)];
}

/** 空白撐住跳過的排數：n 排 = n × rowH（空白本身跟第一排之間還有一個列間距）。0 排就拿掉，不留間距。 */
function setPad(pad, rows) {
  const h = rows > 0 && rowH ? rows * rowH - gapY : 0;
  pad.hidden = !(h > 0);
  pad.style.height = `${Math.max(0, h)}px`;
}

/** 第 i 張牌的格子：做過的直接拿來、重上次數；這一格畫面的時間用完了就先放空位。 */
function nodeAt(i, t0) {
  const card = list[i];
  if (!cells.has(card.tag) && performance.now() - t0 > BUDGET_MS) {
    const s = el("div", { class: "book-cell is-skel", "aria-hidden": "true" });
    s._skel = true;
    return s;
  }
  const cell = cellOf(card);
  paintCell(cell, card, rankAt(card, i));
  // 接上畫面的格子（看得到的和下方一屏半）：圖立刻開始抓，不等捲到眼前。
  const img = cell.querySelector('img[loading="lazy"]');
  if (img) img.loading = "eager";
  return cell;
}

/**
 * 照捲動位置接上該畫的那一段。force：整段重接（換排序、換篩選、格寬變了）。
 * 一般捲動只在頭尾加減幾排：留下來的格子不動，不必整片重新算樣式。
 */
function layoutWindow(force = false) {
  const grid = $("book-grid");
  if (!padTop) return;
  const [s, e] = windowNow();
  if (!force && s === winStart && e === winEnd) return;
  const t0 = performance.now();
  if (force || e <= winStart || s >= winEnd) {
    live = [];
    for (let i = s; i < e; i++) live.push(nodeAt(i, t0));
    grid.replaceChildren(padTop, ...live, padBottom, ...(tail ? [tail] : []));
  } else {
    for (; winStart < s; winStart++) live.shift().remove();
    for (; winEnd > e; winEnd--) live.pop().remove();
    const head = [];
    for (let i = s; i < winStart; i++) head.push(nodeAt(i, t0));
    if (head.length) {
      padTop.after(...head);
      live.unshift(...head);
    }
    const more = [];
    for (let i = winEnd; i < e; i++) more.push(nodeAt(i, t0));
    if (more.length) {
      padBottom.before(...more);
      live.push(...more);
    }
  }
  winStart = s;
  winEnd = e;
  setPad(padTop, Math.floor(s / cols));
  setPad(padBottom, Math.ceil(list.length / cols) - Math.ceil(e / cols));
  // 第一次畫：量好一排多高，照真的捲動位置再接一次。
  if (!rowH && live.length && measureRow()) return layoutWindow(true);
  if (live.some((n) => n._skel)) fillSoon();
  else buildAhead();
}

/** 空位一格畫面換幾張成真的牌（同樣的時間預算），換完為止。 */
function fillSoon() {
  if (fillFrame) return;
  fillFrame = requestAnimationFrame(() => {
    fillFrame = 0;
    const t0 = performance.now();
    for (let k = 0; k < live.length; k++) {
      if (!live[k]._skel) continue;
      if (performance.now() - t0 > BUDGET_MS) break;
      const cell = nodeAt(winStart + k, Infinity);
      live[k].replaceWith(cell);
      live[k] = cell;
    }
    if (live.some((n) => n._skel)) fillSoon();
    else buildAhead();
  });
}

const idle = typeof requestIdleCallback === "function" ? requestIdleCallback : (fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 60);
/** 閒下來時先把下方一屏的格子做好（不接上畫面）：捲下去時直接接上，不用當場做。 */
function buildAhead() {
  if (aheadId || !rowH) return;
  aheadId = idle((deadline) => {
    aheadId = 0;
    const end = Math.min(list.length, winEnd + Math.ceil(innerHeight / rowH) * cols);
    for (let i = winEnd; i < end; i++) {
      if (cells.has(list[i].tag)) continue;
      if (deadline.timeRemaining() < 2) return buildAhead();
      cellOf(list[i]);
    }
  });
}

/** 捲動、視窗高度變了：下一格畫面換那一段。 */
function watchScroll() {
  const soon = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      layoutWindow();
    });
  };
  addEventListener("scroll", soon, { passive: true });
  // 只有高度變（手機網址列收起來）才在這裡接；寬度變了交給 sizeCells（要先重量格高），
  // 不然這裡先用舊的格高算一次，記下的頂端那張就錯了。
  let w = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth !== w) return void (w = innerWidth);
    soon();
  }, { passive: true });
}

/** 畫面上的格子重上一次（日期到了、次數變了）。 */
function repaintLive() {
  live.forEach((n, k) => {
    if (!n._skel && n._card) paintCell(n, n._card, rankAt(n._card, winStart + k));
  });
}

/**
 * 依目前的篩選與排序畫牌。
 *   animate：還在畫面上的牌從舊位置滑過去（FLIP），新來的錯開浮上來。
 *   shuffle：換排序的那一下，連移動也錯開一點點，看得出「重新洗過」。
 *   deal：第一次畫（開頁）：交給開版動畫，不另外動。
 */
function render({ animate = true, shuffle = false, deal = false } = {}) {
  const grid = $("book-grid");
  const motion = animate && !reducedMotion();
  // 改之前：畫面上（含上下各一點）的牌在哪。
  const before = new Map();
  if (motion) {
    for (const cell of grid.querySelectorAll(".book-cell:not(.is-skel)")) {
      const r = cell.getBoundingClientRect();
      if (r.bottom > -80 && r.top < innerHeight + 80) before.set(cell.dataset.tag, r);
    }
  }
  list = listNow();
  searchNote($("book-grid"), lastFound, ui.query);
  padTop ||= el("div", { class: "book-pad", "aria-hidden": "true" });
  padBottom ||= el("div", { class: "book-pad", "aria-hidden": "true" });
  tail = list.length ? null : emptyNote();
  layoutWindow(true);
  // 有沒有任何使用紀錄：有的話沒用過的牌才褪色；一筆都沒有就在上面放一行引導。
  const any = Object.values(usage.counts).some((n) => n > 0);
  grid.dataset.any = any ? "true" : "false";
  // 戰績排序看的是日誌，不是使用次數：「還沒有使用紀錄」的引導不出現（沒資料時格子裡自己會說）。
  $("book-hint").hidden = any || isWar();
  if (!motion) return;
  if (deal) return;
  let entering = 0;
  let moving = 0;
  for (const cell of grid.querySelectorAll(".book-cell:not(.is-skel)")) {
    const r = cell.getBoundingClientRect();
    if (r.top > innerHeight + 40) break;
    if (r.bottom < -40) continue;
    const was = before.get(cell.dataset.tag);
    if (was) {
      const dx = was.left - r.left;
      const dy = was.top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      // 走得越遠走得越久一點，但不拖：420～600ms。
      const dist = Math.hypot(dx, dy);
      cell.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: Math.min(DUR.long + dist * 0.15, 600), delay: shuffle ? Math.min(moving++, 16) * 12 : 0, easing: css(CURVE.travel), fill: "backwards" }
      );
    } else {
      cell.animate(
        [{ opacity: 0, transform: "translateY(14px) scale(0.96)" }, { opacity: 1, transform: "none" }],
        { duration: DUR.medium, delay: Math.min(entering++, 18) * 18, easing: css(CURVE.out), fill: "backwards" }
      );
    }
  }
  // 名次章新蓋上去的那一下：跟池子裡蓋章同一個手感。
  for (const cell of grid.querySelectorAll(".book-cell")) {
    if (!cell._stampRank) continue;
    cell._stampRank = false;
    const seal = cell.querySelector(".book-rank");
    seal?.animate(
      [{ transform: "scale(1.8) rotate(-18deg)", opacity: 0 }, { transform: "scale(0.92) rotate(-8deg)", opacity: 1, offset: 0.7 }, { transform: "rotate(-8deg)", opacity: 1 }],
      { duration: DUR.medium, delay: DUR.short, easing: css(CURVE.out), fill: "backwards" }
    );
  }
  if (shuffle && moving + entering > 3) sfx.deal(Math.min(6, 2 + Math.round((moving + entering) / 10)));
}

/** 前三名蓋章：只在「多到少」、而且真的用過的時候。看全部花色時是總名次，選了花色是花色裡的名次。 */
function rankAt(card, i) {
  if (isWar()) return i < 3 && warScore(card.tag) > 0 ? i + 1 : 0;
  return ui.order === "desc" && i < 3 && countOf(card.tag) > 0 ? i + 1 : 0;
}

function emptyNote() {
  if (isWar()) {
    const total = war?.total || 0;
    return el(
      "div",
      { class: "book-empty" },
      el("b", {}, war?.failed ? "讀不到出圖日誌" : total ? "這一區還排不出來" : "出圖日誌還是空的"),
      el(
        "span",
        {},
        war?.failed
          ? "伺服器沒開、或還是舊版（重開一次伺服器）。"
          : total
            ? `一張牌要在 ${WAR_MIN} 張以上印好的圖裡出現過才排：換個花色、清掉搜尋，或多印幾張、收藏喜歡的、撤下不要的。`
            : "從現在起，墨池、疊印台印好的每一張都會記下來；收藏喜歡的、撤下不要的，這裡就排得出哪些牌常出好圖。"
      )
    );
  }
  const any = Object.keys(usage.counts).length;
  // 搜得到、只是被分級擋住：以前只說「沒有符合的牌」，看起來像詞庫裡沒有這張。
  const q = ui.query.toLowerCase();
  const hidden = q ? lib.cards.filter((c) => !c.banned && blocked(c, seeRating()) && cardMatches(c, q)) : [];
  const bannedHits = q && !ui.showBanned ? lib.cards.filter((c) => c.banned && cardMatches(c, q)) : [];
  if (!hidden.length && bannedHits.length) {
    const first = bannedHits[0];
    return el(
      "div",
      { class: "book-empty" },
      el("b", {}, bannedHits.length > 1 ? `一共 ${bannedHits.length} 張禁用角色被藏著` : `「${first.zh}」是禁用角色`),
      el("span", {}, "打開「含禁用」才看得到。"),
      el("div", { class: "book-empty-acts" }, el("button", { class: "btn btn-small", type: "button", onclick: () => $("book-banned")?.click() }, "含禁用"))
    );
  }
  if (hidden.length) {
    const need = hidden.some((c) => !ratingBlocked(c.item, "sensitive")) ? "sensitive" : "explicit";
    const first = hidden[0];
    return el(
      "div",
      { class: "book-empty" },
      el("b", {}, `「${first.zh || first.tag}」在${RATING_LABEL[rating]}看不到`),
      el(
        "span",
        {},
        hidden.length > 1
          ? `一共 ${hidden.length} 張搜得到的被擋住；${RATING_LABEL[need]}以上才有，或打開分級左邊的「不限制」。`
          : `${RATING_LABEL[need]}以上才有，或打開分級左邊的「不限制」。`
      ),
      el(
        "div",
        { class: "book-empty-acts" },
        el("button", { class: "btn btn-small", type: "button", onclick: () => $("rating")?.querySelector(`[data-v="${need}"]`)?.click() }, `切到${RATING_LABEL[need]}`),
        el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => $("rating-free")?.click() }, "打開不限制")
      )
    );
  }
  return el(
    "div",
    { class: "book-empty" },
    el("b", {}, ui.usedOnly && !any ? (usage.unreachable ? "讀不到使用紀錄" : "還沒有使用紀錄") : "沒有符合的牌"),
    el(
      "span",
      {},
      ui.usedOnly && !any
        ? usage.unreachable
          ? "伺服器沒開，或連不到主機。紀錄都還在伺服器上，連上之後就會出來。"
          : "去墨池抽幾張、或在疊印台付印一張，用到的牌就會記在這裡。"
        : "換個花色、清掉搜尋，或關掉「只看用過的」。"
    ),
    ui.usedOnly && !any ? el("a", { class: "btn btn-small", href: "./" }, "去墨池") : null
  );
}

/* ================= 回來時停在剛才看的地方 =================
 * 從墨池、疊印台切回卡冊以前一律回到第一張，捲很深的話得重新找。離開時記下畫面最上面那張牌
 * （不是捲軸位置：使用次數一變排序會挪，跟著牌走比較準）和它離頂端多遠；回來時篩選、排序都
 * 一樣、半小時內，就把牌畫到那一張、捲回去。分頁自己一份（sessionStorage）。 */
const SPOT_KEY = "mochi.book.spot.v1";
const SPOT_TTL = 30 * 60 * 1000;
const spotSig = () => JSON.stringify([ui.suit, ui.group, ui.order, ui.usedOnly, ui.showBanned, ui.query, seeRating()]);

function saveSpot() {
  // 手機的頂欄不黏，捲下去就離開畫面（底緣變負的）：最少從畫面頂端算。
  const mast = Math.max(0, document.querySelector(".mast")?.getBoundingClientRect().bottom || 0);
  const tools = $("book-tools");
  const under = getComputedStyle(tools).position === "sticky" ? tools.getBoundingClientRect().bottom : mast;
  // 最上面那張「看得到」的牌：底緣在頂欄（電腦是黏住的工具列）下面的第一張。
  const cell = [...$("book-grid").querySelectorAll(".book-cell:not(.is-skel)")].find((c) => c.getBoundingClientRect().bottom > under + 8);
  try {
    if (!cell || scrollY < 80) return sessionStorage.removeItem(SPOT_KEY);
    sessionStorage.setItem(SPOT_KEY, JSON.stringify({ tag: cell.dataset.tag, top: cell.getBoundingClientRect().top, sig: spotSig(), at: Date.now() }));
  } catch {
    /* 存不了就算了：回來從第一張看 */
  }
}

function restoreSpot() {
  let spot = null;
  try {
    spot = JSON.parse(sessionStorage.getItem(SPOT_KEY) || "null");
  } catch {
    return;
  }
  if (!spot || spot.sig !== spotSig() || Date.now() - spot.at > SPOT_TTL) return;
  const i = list.findIndex((c) => c.tag === spot.tag);
  if (i < 0 || !rowH) return;
  // 那張牌在第幾排就直接算得出來：捲過去，再接上那一段。
  scrollTo({ top: gridTopY() + Math.floor(i / cols) * rowH - spot.top, behavior: "instant" });
  layoutWindow();
}



function peekInfo(node) {
  const card = lib.byTag.get(node.dataset.tag);
  if (!card) return null;
  const c = countOf(card.tag);
  const facts = cardFacts(card, lexNow(), data).filter(([k]) => k !== "分級");
  facts.unshift(["加入", card.added || "沒有日期"]);
  if (card.banned) facts.unshift(["禁用", banReason(card)]);
  facts.unshift(["用過", c ? `${fmt(c)} 次・最近 ${ago(lastOf(card.tag))}` : "還沒用過"]);
  return {
    zh: card.zh,
    tag: card.tag,
    glyph: CARD_SUIT_INFO[card.suit].glyph,
    seal: card.seal,
    sealTitle: card.groupZh,
    suitColor: `var(--suit-${card.suit})`,
    art: assets.art(card.tag),
    rating: card.rating,
    facts: facts.slice(0, 5),
  };
}

/* ================= 單張牌的詳情 ================= */

function rankIn(card, cards) {
  const c = countOf(card.tag);
  if (!c) return 0;
  return cards.filter((x) => countOf(x.tag) > c).length + 1;
}

function ago(ms) {
  if (!ms) return "還沒用過";
  const d = Date.now() - ms;
  const m = Math.round(d / 60000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小時前`;
  const days = Math.round(h / 24);
  if (days < 31) return `${days} 天前`;
  return new Date(ms).toLocaleDateString(dateLocale);
}

function openCard(card, srcNode) {
  // 翻開一張牌：跟墨池開詳情同一個聲音。
  sfx.tap?.();
  const c = countOf(card.tag);
  const mine = usage.mine[card.tag] || 0;
  const pool = lib.cards.filter(drawable);
  const all = rankIn(card, pool);
  const inSuit = rankIn(card, pool.filter((x) => x.suit === card.suit));
  const art = card.banned ? null : assets.art(card.tag);
  const big = el("b", { class: "book-big-n" }, c ? "0" : "—");
  const stats = el(
    "dl",
    { class: "book-stats" },
    el("dt", {}, "名次"),
    el("dd", {}, c ? `全部第 ${all} 名・${CARD_SUIT_INFO[card.suit].zh}第 ${inSuit} 名` : "還沒上榜"),
    el("dt", {}, "你親手放"),
    el("dd", {}, `${mine} 次`),
    el("dt", {}, "引擎補的"),
    el("dd", {}, `${Math.max(0, c - mine)} 次`),
    el("dt", {}, "最近一次"),
    el("dd", {}, ago(usage.last[card.tag] || 0)),
    el("dt", {}, "加入"),
    el("dd", {}, card.added || "沒有日期"),
    card.banned ? el("dt", {}, "禁用") : null,
    card.banned ? el("dd", {}, banReason(card)) : null,
    el("dt", {}, "戰績"),
    el("dd", { class: "book-war" }, warText(card.tag))
  );
  const share = c && sumShown.total ? Math.min(1, c / Math.max(...pool.map((x) => countOf(x.tag)), 1)) : 0;
  const sheet = openSheet(
    card.zh,
    el(
      "div",
      { class: "detail book-detail" },
      art ? el("div", { class: "detail-art" }, el("img", { src: art, alt: card.zh })) : cardNode(card, assets, { tagName: "div" }),
      el(
        "div",
        {},
        // 英文版的標題就是 tag：不再印一次。
        english ? null : el("p", { class: "tag-en" }, card.tag),
        el(
          "div",
          { class: "book-big", style: `--share: ${share}` },
          big,
          el("span", {}, c ? "張圖用過它" : "還沒進過任何一張圖"),
          // 跟用最多的那張比的長條：一眼看出它算常用還是冷門。
          c ? el("i", { class: "book-bar-fill", "aria-hidden": "true" }) : null
        ),
        stats,
        el("dl", {}, cardFacts(card, lexNow(), data).map(([k, v]) => [el("dt", {}, k), el("dd", {}, v)])),
        card.banned ? el("p", { class: "book-ban-note" }, "這張是禁用角色，不能帶去墨池，也不能放進卡盒。") : null
      ),
      worksOf(card)
    ),
    {
      foot: card.banned ? [] : [
        el(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            onclick: (e) => {
              // 交接便條：墨池下次打開時把它放進合成池（30 分鐘內有效，見 store.js）。
              if (!S.handOffPool([card.tag], "book")) {
                refuse(e.currentTarget);
                return toast("無法交接選牌，請檢查瀏覽器儲存空間。");
              }
              sfx.tap?.();
              e.currentTarget.textContent = "帶過去了…";
              setTimeout(() => (location.href = "./"), reducedMotion() ? 0 : DUR.short);
            },
          },
          "帶去墨池合成池"
        ),
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: (e) => {
              toggleBox(card, srcNode);
              e.currentTarget.textContent = inBox(card.tag) ? "從卡盒拿出來" : "放進卡盒";
            },
          },
          inBox(card.tag) ? "從卡盒拿出來" : "放進卡盒"
        ),
      ],
    }
  );
  flyToDetail(srcNode, sheet.sheet || document.querySelector(".overlay:last-of-type .sheet"));
  if (c) countUp(big, c);
}

/* ---------- 成就牆（achievements.js） ---------- */

function achNow() {
  const f = measure({ cards: lib.cards.filter(drawable), usage, war });
  return [f, evaluate(f)];
}

function openAch() {
  sfx.open?.();
  const [f, list] = achNow();
  openWall(f, list);
}

/** 標題旁那顆鈕寫上解鎖幾項；announceNew：跟上次比，新解鎖的跳提示。 */
function renderAch({ announceNew = false } = {}) {
  const [, list] = achNow();
  const done = list.filter((a) => a.level > 0).length;
  const b = $("book-ach");
  b.textContent = `成就 ${done} / ${list.length}`;
  b.setAttribute("aria-label", `成就牆：解鎖 ${done} / ${list.length} 項，還有每個花色的收集進度`);
  if (announceNew) announce(list, openAch);
}

/** 詳情裡的戰績：出圖日誌裡用了這張牌的、印好的圖，收藏幾張、撤下幾張。 */
function warText(tag) {
  if (!war || war.failed) return "讀不到出圖日誌";
  const [n, fav, drop] = warOf(tag);
  if (!n) return "日誌裡還沒有用它印好的圖";
  return `印好 ${fmt(n)} 張・收藏 ${fav}（${pct(fav, n)}%）・撤下 ${drop}（${pct(drop, n)}%）${n < WAR_MIN ? "・張數還太少，不排名" : ""}`;
}

/* ---------- 用這張牌做過的圖 ----------
 * 從出圖日誌撈（server.py 的 /api/genlog/bytag）：這張牌出現過、印好的每一張都看得到，
 * 收藏過的排前面（用作品冊另存的那份圖，ComfyUI 那邊刪了也還在），撤下過的排最後。
 * 日誌以前印的：成品牆（墨池）、晾紙繩（疊印台）上還留著的照樣併進來。 */

const WORKS_PAGE = 48;
const ROOM_ZH = { mochi: "墨池", fuse: "疊印台" };

function readList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** 成品牆、晾紙繩上還留著、用到這張牌的（日誌以前的也在這裡）。 */
function localWorks(card) {
  const has = (x) => x.image && tagsOfPositive(x.positive).includes(card.tag);
  return [
    ...readList("mochi.shots.v1").filter(has).map((x) => ({ ...x, room: "墨池", at: Date.parse(x.at) || 0, fav: x.albumId || null })),
    ...readList("mochi.fuse.prints.v1").filter(has).map((x) => ({ ...x, room: "疊印台", at: Date.parse(x.at) || 0, fav: x.albumId || null })),
  ].sort((a, b) => b.at - a.at);
}

function workTile(x, i) {
  const src = x.albumThumb || viewSrc(x.image);
  const img = el("img", {
    src,
    alt: "",
    loading: "lazy",
    decoding: "async",
    onerror: (e) => {
      // ComfyUI 那邊把原圖刪了（又沒收藏）：留一格說明，不要破圖。
      const t = e.currentTarget.parentElement;
      t.classList.add("is-gone");
      e.currentTarget.replaceWith(el("span", { class: "book-work-gone" }, "原圖不在了"));
    },
  });
  return el(
    "button",
    {
      class: "book-work",
      type: "button",
      dataset: { fav: x.fav ? "true" : "false", discard: x.mark === "discard" ? "true" : "false" },
      style: `--i: ${Math.min(i, 12)}; aspect-ratio: ${x.width || 1} / ${x.height || 1}`,
      "aria-label": `${x.room}的成品${x.fav ? "（收藏過）" : x.mark === "discard" ? "（撤下過）" : ""}，${new Date(x.at).toLocaleString(dateLocale)}，點一下放大`,
      onclick: (e) => openWork(x, e.currentTarget),
    },
    img,
    el("span", { class: "book-work-room" }, x.room),
    x.fav ? el("span", { class: "book-work-badge is-fav", "aria-hidden": "true" }, "★") : x.mark === "discard" ? el("span", { class: "book-work-badge", "aria-hidden": "true" }, "撤下") : null
  );
}

function worksOf(card) {
  const local = localWorks(card);
  const count = el("span", {});
  const head = el("h3", { class: "book-works-head" }, "用它做過的圖", count);
  const grid = el("div", { class: "book-works-grid" });
  const more = el("button", { class: "btn btn-small book-works-more", type: "button", hidden: true }, "再多看一些");
  const note = el("p", { class: "book-works-empty" });
  const box = el("section", { class: "book-works" }, head, grid, note, more);
  let items = [];
  let total = 0;
  let fromLog = 0;

  const paint = () => {
    // 日誌那邊有的就不重複放（同一張圖的網址一樣）；日誌以前的接在後面。
    const seen = new Set(items.map((x) => x.image));
    const extra = local.filter((x) => !seen.has(x.image));
    const all = [...items, ...extra];
    count.textContent = all.length || total ? `${total + extra.length} 張圖${total > fromLog ? `・先看 ${all.length} 張` : ""}` : "";
    grid.replaceChildren(...all.map(workTile));
    grid.hidden = !all.length;
    note.hidden = !!all.length;
    note.textContent = "還沒有用到它的成品。從現在起印的每一張都會記下來，這裡就看得到。";
    more.hidden = fromLog >= total;
  };

  const load = async (offset) => {
    const r = await fetch(`/api/genlog/bytag?${new URLSearchParams({ tag: card.tag, limit: String(WORKS_PAGE), offset: String(offset) })}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    total = j.total || 0;
    const add = (j.items || []).map((x) => ({ ...x, room: ROOM_ZH[x.origin] || "成品" }));
    items = offset ? items.concat(add) : add;
    fromLog = items.length;
  };

  more.addEventListener("click", async () => {
    more.disabled = true;
    try {
      await load(fromLog);
      paint();
    } catch {
      refuse(more);
    } finally {
      more.disabled = false;
    }
  });
  paint();
  // 先畫本機還留著的，日誌回來再補齊（伺服器沒開就只有本機的）。
  load(0)
    .then(paint)
    .catch(() => {});
  return box;
}

/** 放大看一張成品：從縮圖的位置長出來（跟牌飛進詳情同一個手法）。可以看提示詞、把牌帶回墨池。 */
function openWork(x, thumb) {
  sfx.tap?.();
  const src = x.albumThumb && !x.image ? x.albumThumb : viewSrc(x.image);
  const cards = tagsOfPositive(x.positive).filter((t) => lib.byTag.has(t));
  // 原圖讀不到（ComfyUI 那邊刪了）：收藏過的換成作品冊那份。
  let fellBack = false;
  const big = el("img", {
    src,
    alt: "",
    decoding: "async",
    onerror: (e) => {
      if (fellBack || !x.albumThumb) return;
      fellBack = true;
      e.currentTarget.src = x.albumThumb;
    },
  });
  const sheet = openSheet(
    `${x.room}的成品`,
    el(
      "div",
      { class: "book-work-full" },
      big,
      el("p", { class: "tag-en" }, [x.width && x.height ? `${x.width}×${x.height}` : "", x.seed != null ? `seed ${x.seed}` : "", new Date(x.at).toLocaleString(dateLocale), x.fav ? "★ 收藏過" : x.mark === "discard" ? "撤下過" : ""].filter(Boolean).join("・")),
      // 牌名是籤：點了關掉這張、打開那張牌的詳情。
      cards.length
        ? el(
            "p",
            { class: "book-work-cards" },
            cards.map((t) =>
              el("button", { class: "book-work-chip pressable", type: "button", title: `${t}・看這張牌`, onclick: () => (sheet.close(), setTimeout(() => openCard(lib.byTag.get(t), $("book-grid").querySelector(`.card[data-tag="${CSS.escape(t)}"]`)), reducedMotion() ? 0 : DUR.short)) }, lib.byTag.get(t).zh)
            )
          )
        : null
    ),
    {
      wide: true,
      foot: [
        cards.length
          ? el(
              "button",
              {
                class: "btn btn-small btn-primary",
                type: "button",
                onclick: (e) => {
                  // 份量（weights.js）從提示詞讀回來：帶回去還是那個份量。
                  const all = weightsOfPositive(x.positive);
                  if (!S.handOffPool(cards, "book", Object.fromEntries(cards.filter((t) => all[t]).map((t) => [t, all[t]])))) {
                    refuse(e.currentTarget);
                    return toast("無法交接選牌，請檢查瀏覽器儲存空間。");
                  }
                  e.currentTarget.textContent = "帶過去了…";
                  setTimeout(() => (location.href = "./"), reducedMotion() ? 0 : DUR.short);
                },
              },
              `這張的 ${cards.length} 張牌帶回墨池`
            )
          : null,
        x.fav ? el("a", { class: "btn btn-small", href: `album.html#${encodeURIComponent(x.fav)}` }, "打開作品冊") : null,
        x.image ? el("a", { class: "btn btn-small", href: x.image, target: "_blank", rel: "noopener" }, "開原圖") : null,
      ],
    }
  );
  // 圖從那一格長大到彈窗中間、關掉時縮回去（zoom.js）。
  zoomFromThumb({ from: () => thumb.querySelector("img"), sheet: sheet.sheet, to: big, aspect: x.width && x.height ? x.width / x.height : 0 });
}

/** 大數字從 0 數上去（牌飛進來的同時）。 */
function countUp(node, to) {
  if (reducedMotion()) return void (node.textContent = fmt(to));
  const t0 = performance.now() + DUR.short;
  const dur = Math.min(DUR.story, 300 + to * 40);
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const tick = setInterval(() => {
    const k = Math.max(0, Math.min(1, (performance.now() - t0) / dur));
    node.textContent = fmt(Math.round(to * ease(k)));
    if (k >= 1) {
      clearInterval(tick);
      node.animate([{ transform: "scale(1.12)" }, { transform: "none" }], { duration: DUR.short, easing: css(CURVE.settle) });
    }
  }, 33);
}

/** 牌從格子飛進詳情的大圖（跟墨池的詳情同一個手法：落點放複製品，FLIP 縮放過去）。 */
function flyToDetail(src, sheetEl) {
  if (!src || !sheetEl || reducedMotion()) return;
  const dst = sheetEl.querySelector(".detail-art, .detail > .card");
  const from = (src.querySelector(".card-art") || src).getBoundingClientRect();
  if (!dst || !from.width || from.bottom < 0 || from.top > innerHeight) return;
  const anims = sheetEl.getAnimations();
  for (const a of anims) a.currentTime = a.effect.getComputedTiming().endTime;
  const to = dst.getBoundingClientRect();
  for (const a of anims) a.currentTime = 0;
  if (!to.width) return;
  const f = cloneCard(src.querySelector(".card-art") || src);
  Object.assign(f.style, { position: "fixed", left: to.left + "px", top: to.top + "px", width: to.width + "px", height: to.height + "px", margin: "0", zIndex: "200", pointerEvents: "none", overflow: "hidden", borderRadius: "6px", transformOrigin: "0 0", willChange: "transform" });
  document.body.append(f);
  dst.style.visibility = "hidden";
  const anim = f.animate(
    [
      { transform: `translate(${(from.left - to.left).toFixed(1)}px, ${(from.top - to.top).toFixed(1)}px) scale(${(from.width / to.width).toFixed(4)}, ${(from.height / to.height).toFixed(4)})` },
      { transform: "none" },
    ],
    { duration: DUR.long, easing: css(CURVE.out), fill: "forwards" }
  );
  const land = () => {
    f.remove();
    dst.style.visibility = "";
  };
  anim.onfinish = land;
  setTimeout(land, 700);
}

/* ================= 卡盒：從卡冊挑好幾張，一起放進墨池 =================
 * 右下角一個盒子。牌右下角的「＋」（或詳情裡的「放進卡盒」）把牌放進來：影子沿弧線飛進盒子、
 * 盒子彈一下、數字跳一下；牌上蓋「盒中」章，「＋」變成「✓」，再按一次拿出來。
 * 點開盒子：從右下角長出一塊面板，牌依序落下，× 拿掉時旁邊的牌滑過來補位。
 * 「全部放進墨池合成池」：牌依序往上飛走，交接便條（store.js）寫好就換版到墨池，牌已經在池子裡。
 * 存在這個瀏覽器（mochi.book.box.v1），最多 BOX_MAX 張。 */

const BOX_KEY = "mochi.book.box.v1";
const BOX_MAX = 24;
const BOX_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-5 9 5-9 5z"/><path d="M3 9v8l9 5 9-5V9"/><path d="M12 14v8"/></svg>';
let box = readBox();
let boxOpen = false;

function readBox() {
  try {
    const v = JSON.parse(localStorage.getItem(BOX_KEY) || "[]");
    return Array.isArray(v) ? v.filter((t) => typeof t === "string").slice(0, BOX_MAX) : [];
  } catch {
    return [];
  }
}
function saveBox() {
  try {
    localStorage.setItem(BOX_KEY, JSON.stringify(box));
  } catch {
    /* 存不了就算了 */
  }
}

const inBox = (tag) => box.includes(tag);

/* ---------- 偏好角色（fav-chars.js；墨池、疊印台同一份名單） ---------- */

let favDragging = null;
/** 卡冊只有角色牌能拖、只有一個落點（畫面右緣的愛心）。用到才建。 */
function favDrag() {
  return (favDragging ||= createDrag({
    zones: () => [favZone((t) => lib.byTag.get(t)?.suit === "chara")],
    onDrop: (p, zone) => (zone === "favchars" ? dropToFav(p.tag, lib.byTag.get(p.tag)?.zh || p.tag) : null),
  }));
}

function favAddButton(card) {
  const b = el("button", { class: "fav-add", type: "button" }, heartIcon());
  paintFavButton(b, card);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const added = favChars.toggle(card.tag);
    toast(added ? `「${card.zh}」加進偏好角色` : `「${card.zh}」拿出偏好角色`);
    if (added) flyToFav(cells.get(card.tag)?.querySelector(".card"));
  });
  return b;
}

function paintFavButton(b, card) {
  const on = favChars.has(card.tag);
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.setAttribute("aria-label", `${on ? "從偏好角色拿掉" : "加入偏好角色"}：${card.zh}`);
}

// 名單一變（這一頁點的、墨池那邊加的、另一個分頁改的）：牌上的愛心和按鈕跟著換。
favChars.onChange(() => {
  for (const [tag, cell] of cells) {
    const card = lib.byTag.get(tag);
    if (card?.suit !== "chara" || card.banned) continue;
    // 電腦上按鈕要滑鼠移過去才做：還沒做的照樣換牌上的愛心。
    const b = cell.querySelector(".fav-add");
    if (b) paintFavButton(b, card);
    paintFavChar(cell.querySelector(".card"), tag);
  }
});

function boxAddButton(card) {
  const b = el("button", { class: "box-add", type: "button", "aria-pressed": "false", "aria-label": `把「${card.zh}」放進卡盒` });
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleBox(card, cells.get(card.tag)?.querySelector(".card"));
  });
  return b;
}

/** 牌格上的狀態：「＋」或「✓」（book.css 用兩條線畫，aria-pressed 一換就變形過去）、牌上的「盒中」章。 */
function paintBoxMark(cell, tag) {
  const on = inBox(tag);
  const b = cell.querySelector(".box-add");
  if (b) {
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", `${on ? "把它拿出卡盒" : "放進卡盒"}：${lib.byTag.get(tag)?.zh || tag}`);
  }
  cell.dataset.boxed = on ? "true" : "false";
  setCardFlag(cell.querySelector(".card"), on ? { kind: "box", text: "盒中" } : null);
}

function toggleBox(card, fromNode) {
  if (card.banned) return;
  if (inBox(card.tag)) {
    box = box.filter((t) => t !== card.tag);
    saveBox();
    afterBoxChange({ removed: card.tag });
    return;
  }
  if (box.length >= BOX_MAX) {
    refuse($("box-pill"));
    toast(`卡盒最多 ${BOX_MAX} 張，先放進墨池或拿掉幾張`);
    return;
  }
  box.push(card.tag);
  saveBox();
  sfx.tap?.();
  flyIntoBox(fromNode);
  afterBoxChange({ added: card.tag });
}

function afterBoxChange({ added = null, removed = null } = {}) {
  const cell = cells.get(added || removed);
  if (cell) paintBoxMark(cell, added || removed);
  renderBoxPill({ bump: !!added && reducedMotion(), drop: !!removed });
  if (boxOpen) renderBoxPanel({ added, removed });
}

/** 牌的影子沿弧線飛進盒子（motion.js 的 flight：追著落點、途中微轉、落地縮小淡掉），落地時盒子彈一下。 */
function flyIntoBox(fromNode) {
  const pill = $("box-pill");
  if (!fromNode || reducedMotion()) return bumpPill();
  const r = fromNode.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight) return bumpPill();
  const ghost = cloneCard(fromNode);
  ghost.classList.add("box-ghost");
  ghost.querySelector(".book-rank")?.remove();
  document.body.append(ghost);
  flight(ghost, { left: r.left, top: r.top, width: r.width, height: r.height }, () => pill.querySelector(".box-stack") || pill, {
    endScale: 0.3,
    endOpacity: 0.35,
    arc: 70,
    tilt: -8,
    zIndex: 120,
    onLand: () => bumpPill(),
  });
}

function bumpPill() {
  const pill = $("box-pill");
  if (!pill || reducedMotion()) return;
  pill.animate(
    [{ transform: "none" }, { transform: "translateY(-5px) scale(1.08)" }, { transform: "none" }],
    { duration: DUR.medium, easing: css(CURVE.settle) }
  );
}

function renderBoxPill({ drop = false } = {}) {
  const pill = $("box-pill");
  const count = pill.querySelector(".box-count");
  const old = count.textContent;
  count.textContent = String(box.length);
  pill.dataset.empty = box.length ? "false" : "true";
  pill.setAttribute("aria-label", `卡盒：${box.length} 張，點開看`);
  // 最後放進去的三張疊成一小疊（只有插畫，沒有字）。
  const stack = pill.querySelector(".box-stack");
  stack.replaceChildren(
    ...box.slice(-3).map((t, i, a) => {
      // 26px 寬的小疊：借格子上已經載好的那張縮圖（currentSrc），不另外拉整張原圖。
      const shown = cells.get(t)?.querySelector(".card-art img");
      const art = (shown && shown.currentSrc) || assets.art(t);
      const card = lib.byTag.get(t);
      return el(
        "i",
        { style: `--k: ${a.length - 1 - i}; --suit: var(--suit-${card?.suit || "cast"})` },
        art ? el("img", { src: art, alt: "", decoding: "async" }) : el("b", {}, [...(card?.zh || "字")][0])
      );
    })
  );
  if (old !== count.textContent && !reducedMotion()) {
    count.animate(
      [{ transform: `translateY(${drop ? "-" : ""}6px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: DUR.short, easing: css(CURVE.out) }
    );
  }
  if (drop && !reducedMotion()) {
    pill.animate([{ transform: "none" }, { transform: "scale(0.95)" }, { transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
  }
}

function setBoxOpen(on) {
  if (boxOpen === on) return;
  boxOpen = on;
  const panel = $("box-panel");
  const pill = $("box-pill");
  pill.setAttribute("aria-expanded", on ? "true" : "false");
  if (on) {
    panel.hidden = false;
    renderBoxPanel({ deal: true });
    if (!reducedMotion()) {
      // 從盒子的位置長出來：右下角為原點，縮放加淡入，接著牌一張張落下。
      panel.animate(
        [{ opacity: 0, transform: "translateY(12px) scale(0.92)" }, { opacity: 1, transform: "none" }],
        { duration: DUR.medium, easing: css(CURVE.out) }
      );
    }
    panel.querySelector(".box-close")?.focus({ preventScroll: true });
  } else {
    // 鍵盤從盒內收起時回到開關；從盒外操作時保留原本的焦點。
    if (panel.contains(document.activeElement)) pill.focus({ preventScroll: true });
    const done = () => {
      if (!boxOpen) panel.hidden = true;
    };
    if (reducedMotion()) return done();
    const a = panel.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(0.95)" }],
      { duration: DUR.short, easing: css(CURVE.exit) }
    );
    a.onfinish = done;
    setTimeout(done, DUR.short + 60);
  }
}

function renderBoxPanel({ deal = false, added = null, removed = null } = {}) {
  const panel = $("box-panel");
  const grid = panel.querySelector(".box-grid");
  panel.querySelector(".box-title").textContent = `卡盒 ${box.length}/${BOX_MAX}`;
  const go = panel.querySelector(".box-go");
  go.disabled = !box.length;
  go.querySelector(".count").textContent = box.length ? `×${box.length}` : "";
  panel.querySelector(".box-clear").disabled = !box.length;
  panel.querySelector(".box-empty").hidden = box.length > 0;
  const make = (t) => {
    const card = lib.byTag.get(t);
    // 立刻載圖：字盒那套 lazy 在面板剛長出來時還沒輪到，牌面會空白一下。
    const node = eagerArt(cardNode(card, assets, { tagName: "div" }));
    const x = el("button", { class: "box-x", type: "button", "aria-label": `把「${card.zh}」拿出卡盒` }, "×");
    x.addEventListener("click", () => removeFromPanel(t));
    return el("div", { class: "box-slot", dataset: { tag: t } }, node, x);
  };
  if (removed) {
    const slot = grid.querySelector(`.box-slot[data-tag="${CSS.escape(removed)}"]`);
    if (slot) leaveAndFlip(grid, slot);
    return;
  }
  if (added && !deal) {
    const slot = make(added);
    grid.append(slot);
    if (!reducedMotion()) slot.animate([{ opacity: 0, transform: "translateY(-10px) scale(0.9)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.settle) });
    return;
  }
  grid.replaceChildren(...box.filter((t) => lib.byTag.has(t)).map(make));
  if (deal && !reducedMotion()) {
    [...grid.children].forEach((s, i) =>
      s.animate(
        [{ opacity: 0, transform: "translateY(14px) rotate(-3deg) scale(0.94)" }, { opacity: 1, transform: "none" }],
        { duration: DUR.medium, delay: DUR.micro + Math.min(i, 12) * 28, easing: css(CURVE.out), fill: "backwards" }
      )
    );
  }
}

function leaveAndFlip(grid, slot) {
  const rest = [...grid.children].filter((s) => s !== slot);
  const before = new Map(rest.map((s) => [s, s.getBoundingClientRect()]));
  const finish = () => {
    slot.remove();
    if (reducedMotion()) return;
    for (const s of rest) {
      const a = before.get(s);
      const b = s.getBoundingClientRect();
      if (Math.abs(a.left - b.left) + Math.abs(a.top - b.top) < 1) continue;
      s.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
    }
  };
  if (reducedMotion()) return finish();
  const a = slot.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.85)" }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" });
  a.onfinish = finish;
  setTimeout(() => slot.isConnected && finish(), DUR.short + 80);
}

function removeFromPanel(tag) {
  box = box.filter((t) => t !== tag);
  saveBox();
  afterBoxChange({ removed: tag });
  if (!box.length) $("box-panel").querySelector(".box-close")?.focus({ preventScroll: true });
}

/** 卡盒的牌組：盒子裡的牌存成一組，或把一組牌放進盒子（換掉盒子裡的，可以復原）。 */
function openBoxDecks() {
  const zh = (t) => lib.byTag.get(t)?.zh || t;
  openDecks({
    where: "卡盒",
    current: () => [...box],
    has: (t) => lib.byTag.has(t),
    zh,
    apply: deckToBox,
    // 貼上提示詞變成牌：換成或加進卡盒（卡盒不管互斥，照貼上的順序放）。
    paste: () =>
      openPaste({
        where: "卡盒",
        lexTags: data.tags.map((t) => t.tag),
        banned: data.characterBan || [],
        isCard: (t) => lib.byTag.has(t),
        zh,
        apply: (tags, { replace }) => deckToBox({ name: "貼上的提示詞", tags: replace ? tags : [...box, ...tags.filter((t) => !box.includes(t))] }),
      }),
  });
}

function deckToBox(deck) {
  const was = [...box];
  const put = (tags) => {
    const touched = new Set([...box, ...tags]);
    box = tags;
    saveBox();
    for (const t of touched) {
      const cell = cells.get(t);
      if (cell) paintBoxMark(cell, t);
    }
    renderBoxPill();
    bumpPill();
    if (!boxOpen) setBoxOpen(true);
    renderBoxPanel({ deal: true });
  };
  const tags = deck.tags.filter((t) => lib.byTag.has(t)).slice(0, BOX_MAX);
  put(tags);
  toast(`${deck.name === "貼上的提示詞" ? "貼上的提示詞" : `牌組「${deck.name}」`}放進卡盒了（${tags.length} 張）`, { action: { label: "復原", run: () => put(was) } });
}

function clearBox() {
  if (!box.length) return;
  const was = [...box];
  box = [];
  saveBox();
  for (const t of was) {
    const cell = cells.get(t);
    if (cell) paintBoxMark(cell, t);
  }
  renderBoxPill({ drop: true });
  const grid = $("box-panel").querySelector(".box-grid");
  const slots = [...grid.children];
  if (!reducedMotion()) {
    slots.forEach((s, i) =>
      s.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(0.9)" }], { duration: DUR.short, delay: i * 16, easing: css(CURVE.exit), fill: "forwards" })
    );
  }
  setTimeout(() => renderBoxPanel(), reducedMotion() ? 0 : DUR.short + slots.length * 16);
  toast(`卡盒清空了（${was.length} 張）`, {
    action: {
      label: "復原",
      run: () => {
        box = was;
        saveBox();
        for (const t of was) {
          const cell = cells.get(t);
          if (cell) paintBoxMark(cell, t);
        }
        renderBoxPill();
        bumpPill();
        if (boxOpen) renderBoxPanel({ deal: true });
      },
    },
  });
}

/** 全部放進墨池：牌依序往上飛走，交接便條寫好，換版過去（牌已經在合成池裡）。 */
function boxToMochi() {
  if (!box.length) return refuse($("box-panel").querySelector(".box-go"));
  if (!S.handOffPool(box, "book")) {
    refuse($("box-panel").querySelector(".box-go"));
    return toast("無法交接選牌，請檢查瀏覽器儲存空間。");
  }
  const n = box.length;
  box = [];
  saveBox();
  sfx.deal?.(Math.min(6, n + 1));
  const slots = [...$("box-panel").querySelectorAll(".box-slot")];
  if (reducedMotion() || !slots.length) return void (location.href = "./");
  slots.forEach((s, i) =>
    s.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-60px) rotate(4deg) scale(0.9)" }],
      { duration: DUR.long, delay: Math.min(i, 10) * 35, easing: css(CURVE.in), fill: "forwards" }
    )
  );
  setTimeout(() => (location.href = "./"), DUR.long + Math.min(slots.length, 10) * 35 - 120);
}

function buildBox() {
  const dock = el(
    "div",
    { class: "box-dock", id: "box-dock" },
    el(
      "section",
      { class: "box-panel", id: "box-panel", hidden: true, role: "dialog", "aria-label": "卡盒" },
      el(
        "div",
        { class: "box-panel-head" },
        el("b", { class: "box-title" }, "卡盒"),
        el("button", { class: "btn btn-small btn-ghost box-decks", type: "button", title: "把卡盒存成牌組，或把牌組放進卡盒", onclick: openBoxDecks }, "牌組"),
        el("button", { class: "btn btn-small btn-ghost box-clear", type: "button", onclick: clearBox }, "清空"),
        el("button", { class: "box-close", type: "button", "aria-label": "收起卡盒", onclick: () => setBoxOpen(false) }, "×")
      ),
      el("p", { class: "box-empty" }, "按牌右下角的「＋」，把想用的牌放進來，再一起放進墨池。"),
      el("p", { class: "workspace-purpose" }, "卡盒用來收集待用的牌，最多二十四張。想重複使用整組，請存成牌組。"),
      el("div", { class: "box-grid" }),
      el(
        "div",
        { class: "box-panel-foot" },
        el("button", { class: "btn btn-primary box-go", type: "button", onclick: boxToMochi }, "全部放進墨池合成池", el("span", { class: "count" }, ""))
      )
    ),
    el(
      "button",
      { class: "box-pill pressable", id: "box-pill", type: "button", "aria-expanded": "false", "aria-controls": "box-panel", "aria-keyshortcuts": "B", title: "卡盒（B）", onclick: () => setBoxOpen(!boxOpen) },
      el("span", { class: "box-stack", "aria-hidden": "true" }),
      el("span", { class: "box-icon", html: BOX_ICON }),
      el("span", { class: "box-label" }, "卡盒"),
      el("b", { class: "box-count" }, "0")
    )
  );
  document.body.append(dock);
  box = box.filter((t) => lib.byTag.has(t));
  renderBoxPill();
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && boxOpen && !document.querySelector(".overlay")) setBoxOpen(false);
    // B：開關卡盒（在找字的框裡打字時不算）。
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if ((e.key === "b" || e.key === "B") && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector(".overlay")) {
      e.preventDefault();
      setBoxOpen(!boxOpen);
    }
  });
  // 點盒子外面就收起來（點牌上的「＋」不算：邊挑邊看盒子是正常用法）。
  document.addEventListener("pointerdown", (e) => {
    if (boxOpen && !e.target.closest("#box-dock, .box-add, .overlay, .toast")) setBoxOpen(false);
  });
  // 別的分頁也開著卡冊：盒子內容跟著同步。
  addEventListener("storage", (e) => {
    if (e.key !== BOX_KEY) return;
    box = readBox().filter((t) => lib.byTag.has(t));
    for (const [t, cell] of cells) paintBoxMark(cell, t);
    renderBoxPill();
    if (boxOpen) renderBoxPanel();
  });
}

/* ================= 別的分頁、別的裝置抽完牌 ================= */

function watchServer() {
  // 別的裝置（手機、另一台電腦）抽的牌只有伺服器知道：頁面在前面時每 20 秒問一次。
  const tick = () => {
    if (document.hidden) return;
    fetchUsage().then((u) => applyUsage(u));
  };
  setInterval(tick, 20000);
  document.addEventListener("visibilitychange", tick);
}

function sameUsage(a, b) {
  const ka = Object.keys(a.counts);
  if (ka.length !== Object.keys(b.counts).length) return false;
  return ka.every((t) => a.counts[t] === b.counts[t]) && Object.keys(a.mine).every((t) => a.mine[t] === b.mine[t]);
}

/**
 * 換上新的紀錄。quiet：開頁時快取換成伺服器正本那一下 —— 有差就靜靜重排（牌照樣滑過去），不跳提示。
 * 平常：數字原地跳一下，排序不自己動，給一顆「重新排序」。
 */
function applyUsage(next, { quiet = false } = {}) {
  if (!next || sameUsage(usage, next)) {
    // 數字一樣、但連線狀態變了（讀不到 ⇄ 讀到）：摘要那行要換。
    const flip = next && !!next.unreachable !== !!usage?.unreachable;
    if (next) usage = next;
    if (flip) renderSummary();
    return;
  }
  if (quiet) {
    usage = next;
    renderSummary();
    renderSuits();
    render();
    renderAch({ announceNew: !!war });
    return;
  }
  bumpTo(next);
  renderAch({ announceNew: !!war });
}

function watchOtherTabs() {
  // 別的分頁每抽一張就寫一次次數：卡冊在背景時只記「有變」，回到這一頁再一次更新；在前景也併到下一格才更新。
  // 以前每一次都整格重算（每格 indexOf），墨池抽 30 張，開著的卡冊分頁耗掉 5.7 秒。
  let stale = false;
  let frame = 0;
  const refresh = () => {
    frame = 0;
    stale = false;
    applyUsage(loadUsage());
  };
  addEventListener("storage", (e) => {
    if (e.key !== USAGE_KEY) return;
    stale = true;
    if (!document.hidden && !frame) frame = requestAnimationFrame(refresh);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && stale && !frame) frame = requestAnimationFrame(refresh);
  });
}

function bumpTo(next) {
  {
    const before = usage;
    usage = next;
    // 數字原地跳一下；排序不自己動（牌在手底下跑掉很煩），給一顆「重新排序」。
    let changed = 0;
    for (const cell of $("book-grid").querySelectorAll(".book-cell:not(.is-skel)")) {
      const t = cell.dataset.tag;
      if ((before.counts[t] || 0) === countOf(t)) continue;
      changed += 1;
      const card = lib.byTag.get(t);
      paintCell(cell, card, rankAt(card, list.indexOf(card)));
      if (!reducedMotion()) {
        cell.querySelector(".book-meta").animate(
          [{ transform: "translateY(-6px) scale(1.25)", color: "var(--color-accent)" }, { transform: "none" }],
          { duration: DUR.long, easing: css(CURVE.settle) }
        );
      }
    }
    renderSummary();
    renderSuits();
    // 提示算的是全部變了的牌（不只畫面上那幾張）。
    const bumped = Object.keys(usage.counts).filter((t) => (before.counts[t] || 0) !== countOf(t)).length;
    if (bumped) {
      toast(`剛剛又記了 ${bumped} 張牌的使用次數`, { action: { label: "重新排序", run: () => render({ shuffle: true }) } });
    }
    void changed;
  }
}

// 開機到一半出錯（本機存檔讀不懂、連不到主機）：不要停在「正在讀詞庫…」，說清楚、給重試或重設（ui.js 的 bootFailed）。
boot().catch(bootFailed);
