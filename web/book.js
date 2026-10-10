import { dateLocale, english } from "./i18n.js";
/**
 * 卡冊：每張牌進過幾張圖。
 *
 * 次數由墨池、疊印台記（usage.js）：墨池每抽出一張、疊印台每付印一張，用到的牌各加一。
 * 這一頁只讀、排、看：
 *   - 多到少／少到多，花色、細分類、找字、只看用過的。
 *   - 換排序、換花色時，還在畫面上的牌從舊位置滑到新位置（FLIP），新來的錯開浮上來。
 *   - 點一張牌：牌飛進詳情，大數字從 0 數上來，看你親手放幾次、引擎補幾次、最近一次。
 *     「帶去墨池」把它放進墨池的合成池（store.js 的交接便條）再換版過去。
 *   - 別的分頁抽完牌：這裡的數字跟著跳一下（storage 事件），排序不自己亂動，給一顆「重新排序」。
 */
import { indexLexicon } from "./engine.js";
import { ratingBlocked, RATING_LABEL } from "./rules/rating.js";
import { buildLibrary, groupChips, createAssets, cardNode, cardFacts, setCardFlag, eagerArt, cardMatches, CARD_SUIT_INFO, CARD_SUITS } from "./cards.js";
import { el, openSheet, toast } from "./ui.js";
import { mountKeysHelp } from "./keys-help.js";
import { mountTour } from "./tour.js";
import { mountGenStatus } from "./gen-status.js";
import { openDecks } from "./decks.js";
import { openPaste } from "./paste-prompt.js";
import { measure, evaluate, announce, openWall } from "./achievements.js";
import { initMotion, settleMotion, seat, refuse, flight, reducedMotion, CURVE, DUR, css } from "./motion.js";
import { watchLink, LINK_LABEL, viewSrc } from "./gen.js";
import { getSfx } from "./sfx.js";
import { attachPeek } from "./card-peek.js";
import * as S from "./store.js";
import { USAGE_KEY, loadUsage, seedUsage, fetchUsage, tagsOfPositive } from "./usage.js";
import { weightsOfPositive } from "./weights.js";

const sfx = getSfx();
const $ = (id) => document.getElementById(id);
const UI_KEY = "mochi.book.v1";
// 一次畫幾張：上千張一次畫完會卡；捲到底附近再接著畫（跟字盒同一套）。
const CHUNK = 72;
const ORDER_ZH = { desc: "多到少", asc: "少到多", good: "出好圖", bad: "常撤下" };
const ORDER_MARK = { desc: "↓", asc: "↑", good: "★", bad: "✕" };
// 牌的戰績（出好圖／常撤下）：印好的圖裡，用了這張牌的有幾成被收藏、幾成被單張撤下。
// 從出圖日誌算（server.py 的 /api/genlog/stats），所以只算有日誌之後印的。
// 少於 WAR_MIN 張的不排（印 1 張收 1 張就 100%，沒意義）；排的時候用信賴下界，
// 印得多又穩定的排在「偶爾一次」前面。
const WAR_MIN = 3;
let war = null;
const warOf = (tag) => (war && war.cards[tag]) || [0, 0, 0];
const isWar = () => ui.order === "good" || ui.order === "bad";
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
let lib = null;
let assets = null;
let usage = null;
let rating = "general";
let list = [];
let shown = 0;
// 牌的節點留著重用：換排序時同一張牌是同一個節點，才滑得過去，圖也不必重載。
const cells = new Map();
const ui = { suit: "all", group: "", query: "", order: "desc", usedOnly: false, ...readUi() };

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
    localStorage.setItem(UI_KEY, JSON.stringify({ suit: ui.suit, group: ui.group, order: ui.order, usedOnly: ui.usedOnly }));
  } catch {
    /* 存不了就算了 */
  }
}

const countOf = (tag) => usage.counts[tag] || 0;
const lastOf = (tag) => usage.last[tag] || 0;
const fmt = (n) => n.toLocaleString(dateLocale);

/* ================= 開機 ================= */

async function boot() {
  initMotion();
  // 快捷鍵說明（電腦）：頂欄的「?」、按 ? 打開（keys-help.js）。
  mountKeysHelp("book");
  // 新手導覽（頂欄「教學」右邊的「導覽」；第一次來會問要不要走一遍）：tour.js。
  mountTour("book");
  // 墨池、疊印台正在印的：頂欄看得到，點了回去（gen-status.js）。
  mountGenStatus("book");
  try {
    const [lexicon, manifest] = await Promise.all([
      fetch(document.querySelector('link[rel="preload"][href^="lexicon.json"]')?.href || "lexicon.json").then((r) => r.json()),
      fetch(document.querySelector('link[rel="preload"][href^="cards/manifest.json"]')?.href || "cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    data = lexicon;
    lex = indexLexicon(data);
    lib = buildLibrary(data, { ratingBlocked });
    assets = createAssets(manifest);
  } catch (err) {
    $("book").replaceChildren(el("p", { class: "book-empty" }, "讀不到詞庫。請用 start.bat 開，而不是直接點 HTML。", el("br"), String(err)));
    return;
  }
  rating = (S.loadSettings() || {}).rating || "general";
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
  renderSort();
  renderUsedToggle();
  renderSuits();
  wireSearch();
  render({ animate: false, deal: true });
  restoreSpot();
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
  settleMotion();
}

/* ================= 頂欄 ================= */

function renderRating() {
  const box = $("rating");
  box.replaceChildren(
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
}

function pingLoop() {
  watchLink((st) => {
    const p = $("ping");
    const changed = p.dataset.ok !== (st === "ok" ? "1" : "0") || p.dataset.link !== st;
    p.dataset.ok = st === "ok" ? "1" : "0";
    p.dataset.link = st;
    if (changed) p.querySelector("span").textContent = LINK_LABEL[st];
    if (changed) seat(p);
  });
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
  const pool = lib.cards.filter(visibleCard);
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
  const paint = (u, t) => {
    box.replaceChildren(
      el("b", { class: "book-sum-n" }, fmt(u)),
      el("span", {}, ` ／ ${fmt(pool.length)} 張用過`),
      el("span", { class: "book-sum-dot", "aria-hidden": "true" }, "・"),
      el("span", {}, "共 "),
      el("b", { class: "book-sum-n" }, fmt(t)),
      el("span", {}, " 次")
    );
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

function renderGroups() {
  const box = $("book-groups");
  if (ui.suit === "all") {
    box.hidden = true;
    return box.replaceChildren();
  }
  const runs = groupChips(lib.cards.filter((c) => c.suit === ui.suit && visibleCard(c)));
  if (ui.group && !runs.some((r) => r.items.some((i) => i.g === ui.group))) ui.group = "";
  box.hidden = runs.reduce((n, r) => n + r.items.length, 0) < 2;
  const chip = (i, inRun) =>
    el(
      "button",
      { class: "group-chip pressable", type: "button", "aria-pressed": ui.group === i.g ? "true" : "false", "aria-label": i.short === i.zh ? null : i.zh, onclick: (e) => pickGroup(i.g, e.currentTarget) },
      i.seal && !inRun ? el("b", { class: "chip-seal", "aria-hidden": "true" }, i.seal) : null,
      i.short
    );
  box.replaceChildren(
    el("button", { class: "group-chip pressable", type: "button", "aria-pressed": ui.group === "" ? "true" : "false", onclick: (e) => pickGroup("", e.currentTarget) }, "全部"),
    ...runs.map((r) =>
      r.fam
        ? el(
            "span",
            { class: "chip-run" },
            el("span", { class: "chip-fam", "aria-hidden": "true" }, r.seal ? el("b", { class: "chip-seal" }, r.seal) : null, r.fam),
            ...r.items.map((i) => chip(i, true))
          )
        : chip(r.items[0], false)
    )
  );
}

function pickGroup(g, from) {
  if (ui.group === g) return;
  ui.group = g;
  saveUi();
  renderGroups();
  const selected = [...$("book-groups").querySelectorAll(".group-chip")].find((b) => b.getAttribute("aria-pressed") === "true");
  if (from && document.activeElement === from) selected?.focus({ preventScroll: true });
  seat(selected);
  backToTop();
  render();
}

function renderSort() {
  const box = $("book-sort");
  box.replaceChildren(
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

/* ================= 牌格 ================= */

function visibleCard(card) {
  return !ratingBlocked(card.item, rating);
}

function listNow() {
  const q = ui.query.toLowerCase();
  const order = new Map(lib.cards.map((c, i) => [c.tag, i]));
  const out = lib.cards.filter(
    (c) =>
      visibleCard(c) &&
      (ui.suit === "all" || c.suit === ui.suit) &&
      (!ui.group || c.group === ui.group) &&
      (!ui.usedOnly || countOf(c.tag) > 0) &&
      (!isWar() || warOf(c.tag)[0] >= WAR_MIN) &&
      cardMatches(c, q)
  );
  if (isWar()) return out.sort((a, b) => warScore(b.tag) - warScore(a.tag) || warOf(b.tag)[0] - warOf(a.tag)[0] || order.get(a.tag) - order.get(b.tag));
  // 次數一樣時：多到少看誰最近用過，少到多照字盒的順序（花色 → 細分類）。
  if (ui.order === "desc") out.sort((a, b) => countOf(b.tag) - countOf(a.tag) || lastOf(b.tag) - lastOf(a.tag) || order.get(a.tag) - order.get(b.tag));
  else out.sort((a, b) => countOf(a.tag) - countOf(b.tag) || order.get(a.tag) - order.get(b.tag));
  return out;
}

/** 一張牌的格子：牌＋底下的次數。名次（前三）、沒用過的樣子每次排完重上。 */
function cellOf(card) {
  let cell = cells.get(card.tag);
  if (!cell) {
    const node = cardNode(card, assets);
    node.addEventListener("click", () => openCard(card, node));
    const n = el("b", { class: "book-n" });
    const meta = el("span", { class: "book-meta" }, n, el("span", { class: "book-unit" }));
    cell = el("div", { class: "book-cell", role: "listitem", dataset: { tag: card.tag } }, node, meta, boxAddButton(card));
    cells.set(card.tag, cell);
  }
  return cell;
}

function paintCell(cell, card, rank) {
  const c = countOf(card.tag);
  cell.dataset.unused = c ? "false" : "true";
  const n = cell.querySelector(".book-n");
  const unit = cell.querySelector(".book-unit");
  if (isWar()) {
    // 戰績：大字是幾成，小字是「收藏（撤下）・印過幾張」。
    const [w, fav, drop] = warOf(card.tag);
    const k = ui.order === "good" ? fav : drop;
    cell.dataset.war = ui.order;
    cell.dataset.warZero = k ? "false" : "true";
    n.textContent = `${pct(k, w)}%`;
    unit.textContent = `${ui.order === "good" ? "收藏" : "撤下"}・${fmt(w)} 張`;
  } else {
    delete cell.dataset.war;
    delete cell.dataset.warZero;
    n.textContent = c ? fmt(c) : "—";
    unit.textContent = c ? "次" : "未使用";
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
  paintBoxMark(cell, card.tag);
  const [w, fav, drop] = warOf(card.tag);
  cell
    .querySelector(".card")
    .setAttribute(
      "aria-description",
      isWar()
        ? `印過 ${w} 張，收藏 ${fav} 張、撤下 ${drop} 張${rank ? `，第 ${rank} 名` : ""}`
        : c
          ? `用過 ${c} 次${rank ? `，第 ${rank} 名` : ""}`
          : "還沒用過"
    );
}

let more = null;
let observer = null;

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
    for (const cell of grid.querySelectorAll(".book-cell")) {
      const r = cell.getBoundingClientRect();
      if (r.bottom > -80 && r.top < innerHeight + 80) before.set(cell.dataset.tag, r);
    }
  }
  list = listNow();
  shown = Math.min(list.length, CHUNK);
  const frag = document.createDocumentFragment();
  list.slice(0, shown).forEach((card, i) => {
    const cell = cellOf(card);
    paintCell(cell, card, rankAt(card, i));
    frag.append(cell);
  });
  if (!list.length) frag.append(emptyNote());
  more = el("span", { class: "book-more", "aria-hidden": "true" });
  frag.append(more);
  grid.replaceChildren(frag);
  // 有沒有任何使用紀錄：有的話沒用過的牌才褪色；一筆都沒有就在上面放一行引導。
  const any = Object.values(usage.counts).some((n) => n > 0);
  grid.dataset.any = any ? "true" : "false";
  // 戰績排序看的是日誌，不是使用次數：「還沒有使用紀錄」的引導不出現（沒資料時格子裡自己會說）。
  $("book-hint").hidden = any || isWar();
  watchMore();
  if (!motion) return;
  if (deal) return;
  let entering = 0;
  let moving = 0;
  for (const cell of grid.querySelectorAll(".book-cell")) {
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
  return el(
    "div",
    { class: "book-empty" },
    el("b", {}, ui.usedOnly && !any ? "還沒有使用紀錄" : "沒有符合的牌"),
    el(
      "span",
      {},
      ui.usedOnly && !any
        ? "去墨池抽幾張、或在疊印台付印一張，用到的牌就會記在這裡。"
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
const spotSig = () => JSON.stringify([ui.suit, ui.group, ui.order, ui.usedOnly, ui.query, rating]);

function saveSpot() {
  // 手機的頂欄不黏，捲下去就離開畫面（底緣變負的）：最少從畫面頂端算。
  const mast = Math.max(0, document.querySelector(".mast")?.getBoundingClientRect().bottom || 0);
  const tools = $("book-tools");
  const under = getComputedStyle(tools).position === "sticky" ? tools.getBoundingClientRect().bottom : mast;
  // 最上面那張「看得到」的牌：底緣在頂欄（電腦是黏住的工具列）下面的第一張。
  const cell = [...$("book-grid").querySelectorAll(".book-cell")].find((c) => c.getBoundingClientRect().bottom > under + 8);
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
  if (i < 0) return;
  while (shown <= i && shown < list.length) moreCells();
  const cell = cells.get(spot.tag);
  if (!cell) return;
  scrollTo({ top: cell.getBoundingClientRect().top + scrollY - spot.top, behavior: "instant" });
}

function watchMore() {
  if (typeof IntersectionObserver !== "function") return;
  if (!observer) {
    // 提前兩屏多補下一批（格子現在不在畫面就不排版，多補不花力氣），抓圖才有時間跑在前面。
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) moreCells();
    }, { rootMargin: "1800px" });
  }
  observer.disconnect();
  if (shown < list.length && more) observer.observe(more);
  queuePrefetch();
}

/* 遠端（手機走 Tailscale）時，懶載入的牌圖要捲到附近才開始抓，每張一趟來回：捲得快就一格一格等。
 * 畫面下方 PREFETCH_SCREENS 屏內的牌先改成立刻載入，往下捲時這條線跟著往前推。
 * 圖的網址在格子排好時就照實際大小挑好了（card-images.js），這裡只是提早開始抓同一張。 */
const PREFETCH_SCREENS = 3;
let prefetchFrame = 0;
function queuePrefetch() {
  if (!prefetchFrame) prefetchFrame = requestAnimationFrame(prefetchAhead);
}
function prefetchAhead() {
  prefetchFrame = 0;
  const limit = innerHeight * (1 + PREFETCH_SCREENS);
  for (const img of $("book-grid").querySelectorAll('.book-cell img[loading="lazy"]')) {
    const top = img.closest(".book-cell").getBoundingClientRect().top;
    if (top > limit) break;
    if (top > -innerHeight) img.loading = "eager";
  }
}
addEventListener("scroll", queuePrefetch, { passive: true });

function moreCells() {
  if (shown >= list.length) return;
  const grid = $("book-grid");
  const next = list.slice(shown, shown + CHUNK);
  const frag = document.createDocumentFragment();
  next.forEach((card, k) => {
    const cell = cellOf(card);
    paintCell(cell, card, rankAt(card, shown + k));
    frag.append(cell);
  });
  shown += next.length;
  grid.insertBefore(frag, more);
  watchMore();
}

function peekInfo(node) {
  const card = lib.byTag.get(node.dataset.tag);
  if (!card) return null;
  const c = countOf(card.tag);
  const facts = cardFacts(card, lex, data).filter(([k]) => k !== "分級");
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
  const pool = lib.cards.filter(visibleCard);
  const all = rankIn(card, pool);
  const inSuit = rankIn(card, pool.filter((x) => x.suit === card.suit));
  const art = assets.art(card.tag);
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
        el("dl", {}, cardFacts(card, lex, data).map(([k, v]) => [el("dt", {}, k), el("dd", {}, v)]))
      ),
      worksOf(card)
    ),
    {
      foot: [
        el(
          "button",
          {
            class: "btn btn-primary",
            type: "button",
            onclick: (e) => {
              // 交接便條：墨池下次打開時把它放進合成池（30 分鐘內有效，見 store.js）。
              S.handOffPool([card.tag], "book");
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
  const f = measure({ cards: lib.cards.filter(visibleCard), usage, war });
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
    count.textContent = all.length || total ? `${total + extra.length} 張${total > fromLog ? `・先看 ${all.length} 張` : ""}` : "";
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
      cards.length ? el("p", { class: "book-work-cards" }, cards.map((t) => lib.byTag.get(t).zh).join("・")) : null
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
                  S.handOffPool(cards, "book", Object.fromEntries(cards.filter((t) => all[t]).map((t) => [t, all[t]])));
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
  const s2 = sheet.sheet || document.querySelector(".overlay:last-of-type .sheet");
  const dst = s2 && s2.querySelector(".book-work-full img");
  if (!dst || reducedMotion()) return;
  const go = () => {
    const from = thumb.getBoundingClientRect();
    const to = dst.getBoundingClientRect();
    if (!from.width || !to.width) return;
    dst.animate(
      [
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`, transformOrigin: "0 0", opacity: 0.6 },
        { transform: "none", transformOrigin: "0 0", opacity: 1 },
      ],
      { duration: DUR.long, easing: css(CURVE.out) }
    );
  };
  if (dst.complete && dst.naturalWidth) go();
  else dst.addEventListener("load", go, { once: true });
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
  const f = (src.querySelector(".card-art") || src).cloneNode(true);
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
  const ghost = fromNode.cloneNode(true);
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
  S.handOffPool(box, "book");
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
    if (next) usage = next;
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
  addEventListener("storage", (e) => {
    if (e.key !== USAGE_KEY) return;
    applyUsage(loadUsage());
  });
}

function bumpTo(next) {
  {
    const before = usage;
    usage = next;
    // 數字原地跳一下；排序不自己動（牌在手底下跑掉很煩），給一顆「重新排序」。
    let changed = 0;
    for (const cell of $("book-grid").querySelectorAll(".book-cell")) {
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

boot();
