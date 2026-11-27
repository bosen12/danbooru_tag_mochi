import { dateLocale } from "./i18n.js";
/**
 * 作品冊的「日誌」：印過的每一張（伺服器的 gen_log.py，/api/genlog），不只收藏的。
 * 成品牆只留 80 張、沒收藏的過一陣子就找不到了；這裡一直查得到，還能補收藏、把牌帶回墨池。
 *   - 依日期分段，新的在前；一次讀 300 張，底下「再往前翻」（只追加新列，不把前面整頁拆掉重做）。
 *   - 每一列：縮圖、牌名、時間、哪一頁送的、耗時、狀態（★ 收藏、撤下、印壞、Hires）。
 *   - 收藏的認法：新收的作品記著原圖是哪個檔（image.src），比檔；舊的沒記，比種子＋用到的牌。
 *   - ComfyUI 那邊的原圖刪掉了：縮圖換成「原圖不在了」，也就收藏不了。
 *   - 詳情的主鈕「照這張再印」：牌、份量、時代、種子、底模、LoRA 一起帶回墨池；其他動作手機上收進「⋯」。
 */
import { el, openSheet } from "./ui.js";
import { copyText } from "./copy-text.js";
import { zoomFromThumb } from "./zoom.js";
import { refuse, enter, leave, reducedMotion, DUR, CURVE, css, swapIn, heightChange, ghostOut } from "./motion.js";
import { viewSrc } from "./gen.js";
import { tagsOfPositive } from "./usage.js";
import { hasTerms, searchKey } from "./card-search.js";
import { favButton } from "./album-save.js";
import { weightsOfPositive } from "./weights.js";
import { RATING_LABEL } from "./rules/rating.js";
import { footMore } from "./foot-more.js";
import { transferLabel } from "./transfer.js";
import { recipeOf } from "./store.js";
import { waitImage, unwaitImage, retrySrc } from "./img-wait.js";

/** 一張牌的籤：點了打開卡冊那張牌的詳情（book.html 開頁時看 #card=）。作品冊也用這個。 */
export const cardHref = (tag) => `book.html#card=${encodeURIComponent(tag)}`;

const PAGE = 300;
const ORIGIN_ZH = { mochi: "墨池", fuse: "疊印台", mcp: "AI", ios: "iPhone" };
const RANK = { general: 0, sensitive: 1, explicit: 2 };
export const LOG_FILTERS = [
  ["all", "全部"],
  ["fav", "★ 收藏的"],
  ["discard", "撤下的"],
  ["failed", "印壞的"],
  ["hires", "Hires・修臉"],
];

const shortName = (p) => String(p || "").split(/[\\/]/).pop().replace(/\.safetensors$/i, "");

export function secs(ms) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}

function dayKey(at) {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayLabel(at) {
  const d = new Date(at);
  const today = new Date();
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dayKey(at) === dayKey(today)) return "今天";
  if (dayKey(at) === dayKey(y)) return "昨天";
  const wd = "日一二三四五六"[d.getDay()];
  if (dateLocale === "en-US") return dayTextEn(d, d.getFullYear() !== today.getFullYear());
  return `${d.getFullYear() === today.getFullYear() ? "" : d.getFullYear() + " 年 "}${d.getMonth() + 1} 月 ${d.getDate()} 日（${wd}）`;
}

// 每列各做一個格式器，翻到上千列時光建格式器就很貴。語言沒換就一直用同一個。
let timeFmt = null;
let timeFmtKey = "";
let dayFmt = null;
let dayFmtKey = "";
function clock(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const key = String(dateLocale);
  if (!timeFmt || timeFmtKey !== key) {
    timeFmt = new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false });
    timeFmtKey = key;
  }
  return timeFmt.format(d);
}
function dayTextEn(d, withYear) {
  const key = `${dateLocale}:${withYear ? "y" : "n"}`;
  if (!dayFmt || dayFmtKey !== key) {
    dayFmt = new Intl.DateTimeFormat(dateLocale, { weekday: "short", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
    dayFmtKey = key;
  }
  return dayFmt.format(d);
}

/** 作品冊那一筆跟日誌那一張是不是同一張（舊的作品沒記原圖檔）：種子一樣、用到的牌一樣。 */
export const favKey = (seed, positive, isCard) => `${seed}|${tagsOfPositive(positive).filter(isCard).sort().join(",")}`;

/** 成品網址 → ["子資料夾/檔名", 指紋]（跟伺服器 gen_log.src_of 同一個算法）。 */
export function srcOf(url) {
  try {
    const q = new URL(url, location.href).searchParams;
    const name = q.get("filename");
    return name ? [`${q.get("subfolder") || ""}/${name}`, q.get("h") || ""] : null;
  } catch {
    return null;
  }
}

/**
 * ctx：{ lib, zh, isCard, getWorks(), toMochi(tags, label, entry), reloadWorks() }
 * 回傳 { load(), render(container, { query, filter, rating }), count }。
 */
export function createLog(ctx) {
  let items = [];
  let more = false;
  // 成功讀過才算 loaded。失敗也設成 true 的話，切回「日誌」會以為讀過了、不再重試。
  let loaded = false;
  let failed = false;
  // 使用者按過「再往前翻」：背景刷新只換最新一頁，更早的那幾頁留著。
  let paged = false;
  let loadSeq = 0;
  let favs = new Map();
  // 最近一次畫的條件（搜尋字、篩選、分級）：「再往前翻」讀回來時照現在的條件重畫，
  // 不照按下去那一刻的（等的時候換了全年齡，舊條件會把露骨的又畫出來）。
  let lastView = null;
  // 上一次整頁畫的條件。沒變的「再往前翻」只追加，不把前面的列拆掉重做。
  let paintedKey = "";
  // 翻頁進行中的次數。這時背景刷新先擱著：寫進 items 會把游標前面那一筆擠掉，遲到的下一頁就接不上。
  let paging = 0;
  let heldRefresh = null;
  // id → 那一列。標記只改那一格，不要對每筆再 querySelector 一次（兩千筆會卡半秒）。
  const rowById = new Map();
  // 搜尋在最近一頁找不到：自動再往前翻幾頁，翻太久可以按正在讀的那顆停。
  let seekBudget = 0;
  let seeking = false;
  let seekStop = false;
  // 開著的日誌詳情。別的房間把分級調低、這一件已經看不到時要把窗關掉。
  let openEntrySheet = null;

  const cards =(e) => tagsOfPositive(e.positive).filter(ctx.isCard);
  // 搜尋用的第二份字：跟卡冊同一套（簡體、底線、空白分開每段都要有），角色牌另外對作品名。第一次搜才算、算過留著。
  const keyOf = (e) =>
    (e._key ??= searchKey([e._text || "", ...cards(e).flatMap((t) => { const c = ctx.lib.byTag.get(t); return c?.suit === "chara" ? [c.groupZh, c.item?.series] : []; })].join(" ")));

  function index() {
    // 記著原圖檔的作品只認那個檔：同種子重印、只換 LoRA 的第二張不會被當成已收藏（以前日誌上補收藏不了）。
    favs = new Map();
    const bySrc = new Map();
    for (const w of ctx.getWorks()) {
      const src = w.image?.src;
      if (!src) {
        favs.set(favKey(w.seed, w.positive, ctx.isCard), w);
        continue;
      }
      const [path, h = ""] = String(src).split("#");
      if (!bySrc.has(path)) bySrc.set(path, []);
      bySrc.get(path).push({ h, w });
    }
    const find = (e) => {
      const s = srcOf(e.image);
      // 檔名會被重用（ComfyUI 的 output 清掉後從頭數）：兩邊都有指紋時要一樣。
      const hit = s && (bySrc.get(s[0]) || []).find((x) => !x.h || !s[1] || x.h === s[1]);
      return hit ? hit.w : favs.get(favKey(e.seed, e.positive, ctx.isCard));
    };
    for (const e of items) {
      const w = e.ok ? find(e) : null;
      e._fav = w ? w.id : null;
      // 收藏過的作品冊另有一份：ComfyUI 的 output 清掉了（只留最近幾張）也看得到圖。
      e._favImg = w && w.image && w.image.file ? `/api/recipes/files/${encodeURIComponent(w.image.file)}` : null;
      // 完整路徑也放進去（斜線統一）：成績單上同名、不同資料夾的底模點進來，用路徑才只找到那一個資料夾的。
      const fullPath = (p) => String(p || "").replace(/\\/g, "/");
      if (!e._text) e._text = [e.positive, ...cards(e).map(ctx.zh), shortName(e.ckpt), fullPath(e.ckpt), ...(e.loras || []).flatMap((l) => [shortName(l.file), fullPath(l.file)]), ORIGIN_ZH[e.origin] || ""].join(" ").toLowerCase();
    }
  }

  // 游標是上一頁最後一筆的時間＋編號：同一毫秒好幾筆剛好跨頁時才不會漏（見 gen_log.page）。
  async function fetchPage(last) {
    const q = last ? `&before=${last.at}&beforeId=${encodeURIComponent(last.id || "")}` : "";
    const r = await fetch(`/api/genlog?limit=${PAGE}${q}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  // 最新一頁按 id 併進已讀的：新的排前面，原本那筆物件留著（列上的閉包還指著它）。
  // 已經往前翻過的，不在這一頁裡的留在後面，捲到的位置才不會被刷回第一頁。
  function absorb(page, pageMore) {
    const oldById = new Map(items.map((e) => [e.id, e]));
    const seen = new Set();
    const next = [];
    for (const e of page) {
      seen.add(e.id);
      const old = oldById.get(e.id);
      if (!old) {
        next.push(e);
        continue;
      }
      const keepText = old._text;
      const useFav = old._useFav;
      const gone = old._gone;
      Object.assign(old, e);
      if (keepText) old._text = keepText;
      old._useFav = useFav;
      old._gone = gone;
      next.push(old);
    }
    if (paged) for (const e of items) if (!seen.has(e.id)) next.push(e);
    items = next;
    if (!paged) more = pageMore;
  }

  async function load({ refresh = false } = {}) {
    const seq = ++loadSeq;
    let ok = false;
    try {
      const j = await fetchPage(null);
      if (seq !== loadSeq) return false;
      const page = j.items || [];
      // 翻頁的回應還在路上：現在改寫 items，游標就不再是送出去的那一筆，下一頁會接到錯誤的地方、中間漏一筆。
      if (paging) heldRefresh = { page, more: !!j.more };
      else if (refresh && items.length) absorb(page, !!j.more);
      else {
        items = page;
        more = !!j.more;
        paged = false;
      }
      failed = false;
      loaded = true;
      ok = true;
    } catch {
      // 讀過的頁留著。第一次就失敗才是空的，畫面給重試，不把「沒讀到」說成「日誌是空的」。
      // 翻頁進行中的刷新失敗也不把已經翻到的頁說成讀不到。
      if (seq !== loadSeq) return false;
      if (!paging) failed = true;
    }
    if (!paging) index();
    return ok;
  }

  function takePage(j) {
    const seen = new Set(items.map((e) => e.id));
    const extra = (j.items || []).filter((e) => e && !seen.has(e.id));
    items = items.concat(extra);
    more = !!j.more;
    paged = true;
    index();
  }

  // 翻頁結束才把擱著的最新一頁併進去。這時 paged 已經是 true，不在新頁裡的舊列留著，游標那一筆才不會不見。
  function flushHeld() {
    const held = heldRefresh;
    heldRefresh = null;
    if (!held) return;
    absorb(held.page, held.more);
    index();
    const box = lastView?.container;
    if (!box?.isConnected || !lastView?.view) return;
    if (box.querySelector(".log-row")) patch(box, lastView.view, { scroll: true });
    else render(box, lastView.view);
  }

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last || !more) return;
    paging++;
    try {
      // 送出時的序號和游標。回來時序號變了（中間有人刷新）或游標已經不是最後一筆，這包不能接在現在的清單後面。
      let seq = loadSeq;
      let cursor = last;
      let j = await fetchPage(cursor);
      let tail = items[items.length - 1];
      if (seq !== loadSeq || !tail || tail.id !== cursor.id) {
        tail = items[items.length - 1];
        if (!tail) return;
        seq = loadSeq;
        cursor = tail;
        j = await fetchPage(cursor);
        const again = items[items.length - 1];
        if (seq !== loadSeq || !again || again.id !== cursor.id) return;
      }
      takePage(j);
    } finally {
      paging = Math.max(0, paging - 1);
      if (paging === 0 && heldRefresh) flushHeld();
    }
  }

  const pass = (e, filter) =>
    filter === "fav" ? !!e._fav : filter === "discard" ? e.mark === "discard" : filter === "failed" ? !e.ok : filter === "hires" ? e.kind === "hires" : true;
  const visible = (e, rating) => (RANK[e.rating] ?? 0) <= RANK[rating];

  function stateChip(e) {
    if (!e.ok) return el("span", { class: "log-state is-failed" }, "印壞");
    if (e._fav) return el("span", { class: "log-state is-fav" }, "★ 收藏");
    if (e.mark === "discard") return el("span", { class: "log-state is-discard" }, "撤下");
    return null;
  }

  // 列表只要 480 寬（伺服器 THUMB_WIDTHS）。詳情另載沒帶 w 的 webp，不拿這張小的放大。
  function listSrc(src) {
    if (!src || /[?&]w=/.test(src)) return src;
    if (src.startsWith("/api/image?") || src.startsWith("/api/recipes/files/")) return `${src}${src.includes("?") ? "&" : "?"}w=480`;
    return src;
  }

  // 暫時讀不到的縮圖（ComfyUI 沒開：伺服器回 502／503）：不露瀏覽器的破圖小圖示，換成安靜的「暫時讀不到」，
  // ComfyUI 回來就自己重載（img-wait.js）。2026-11-21。
  function thumb(e) {
    if (!e.ok || !e.image) return el("span", { class: "log-thumb is-empty", "aria-hidden": "true" }, "✕");
    const box = el("span", { class: "log-thumb", style: e.width && e.height ? `aspect-ratio: ${e.width} / ${e.height}` : "" });
    const favSrc = () => listSrc(e._favImg);
    const base = listSrc(viewSrc(e.image));
    // 這張縮圖自己的探針序號：圖後來載入了，早先那次 5xx 的回應就不能再把旗標寫回去。
    let probe = 0;
    const waiter = { node: box, src: base, reload: (n) => (img.src = retrySrc(base, n)) };
    const showWait = () => {
      if (box.classList.contains("is-gone")) return;
      if (!box.classList.contains("is-wait")) {
        box.classList.add("is-wait");
        const label = el("span", { class: "log-thumb-wait" }, "暫時讀不到");
        box.append(label);
        // 字淡進來，不是一格冒出來。
        if (!reducedMotion()) label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
      }
      waitImage(waiter);
    };
    const img = el("img", {
        src: base,
        alt: "",
        loading: "lazy",
        decoding: "async",
        onload: () => {
          // 縮圖又讀到了：先前的 5xx 不能一直當成「原圖不在了」（詳情和收藏鈕都看這個旗標）。
          probe++;
          e._gone = false;
          unwaitImage(waiter);
          if (box.classList.contains("is-wait")) {
            box.classList.remove("is-wait");
            box.querySelector(".log-thumb-wait")?.remove();
            if (!reducedMotion()) img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
          }
        },
        onerror: (ev) => {
          // output 裡的原圖清掉了：收藏過的換成作品冊那一份，沒收藏的才說不在了。
          const fav = favSrc();
          if (fav && ev.currentTarget.getAttribute("src") !== fav) {
            // 記著：點開詳情、「開原圖」也用這一份（以前縮圖換過來了，詳情還連到不在的原圖）。
            e._useFav = true;
            ev.currentTarget.src = fav;
            return;
          }
          // 5xx、斷線是暫時的。只有伺服器明說沒有這張（404／410）才記成永久不在；
          // 記錯的話，圖恢復了詳情仍寫「原圖不在了」、收藏鈕也收起來。
          const mine = ++probe;
          const src = ev.currentTarget.getAttribute("src");
          if (!src) return;
          fetch(src, { cache: "no-store" })
            .then(async (r) => {
              try {
                await r.body?.cancel();
              } catch {
                /* 只要狀態碼 */
              }
              return r.status;
            })
            .then((status) => {
              if (mine !== probe || !box.isConnected) return;
              if (status !== 404 && status !== 410) {
                e._gone = false;
                showWait();
                return;
              }
              e._gone = true;
              unwaitImage(waiter);
              box.classList.remove("is-wait");
              box.classList.add("is-gone");
              box.replaceChildren(el("span", {}, "原圖不在了"));
            })
            .catch(() => {
              if (mine !== probe || !box.isConnected) return;
              e._gone = false;
              showWait();
            });
        },
      });
    box.append(img);
    return box;
  }

  // 列表上的名字：跳過每張都有的人數牌（1個女性、單人），先寫看得出差別的；畫的是哪個角色寫在最前面。
  function title(e) {
    const c = cards(e);
    if (!c.length) return `seed ${e.seed ?? "—"}`;
    const item = (t) => ctx.lib.byTag.get(t)?.item;
    const chars = c.filter((t) => item(t)?.group === "character");
    const telling = [...chars, ...c.filter((t) => item(t)?.section !== "subject")];
    const pick = (telling.length ? telling : c).slice(0, 4);
    return pick.map(ctx.zh).join("・") + (c.length > pick.length ? `…（共 ${c.length} 張牌）` : "");
  }

  function chipKey(e) {
    if (!e.ok) return "failed";
    if (e._fav) return "fav";
    if (e.mark === "discard") return "discard";
    return "";
  }

  function row(e) {
    const meta = [
      clock(e.at),
      ORIGIN_ZH[e.origin] || "",
      e.kind === "hires" ? (e.hires?.mode === "face" ? "修臉" : `Hires ${e.hires?.scale ? "×" + e.hires.scale : ""}`) : "",
      secs(e.ms),
      e.width && e.height ? `${e.width}×${e.height}` : "",
      // 底模名常常很長：放最後，手機上被截掉的是它。
      shortName(e.ckpt),
    ].filter(Boolean);
    const node = el(
      "button",
      { class: "log-row pressable", type: "button", role: "listitem", dataset: { id: e.id, ok: e.ok ? "true" : "false", chip: chipKey(e) } },
      thumb(e),
      el("span", { class: "log-main" }, el("b", {}, title(e)), el("small", {}, meta.join("・")), !e.ok && e.error ? el("small", { class: "log-error" }, e.error) : null),
      stateChip(e)
    );
    node.addEventListener("click", () => openEntry(e, () => node.querySelector(".log-thumb img")));
    rowById.set(String(e.id), node);
    return node;
  }

  const viewKey = (v) => `${v.query}\0${v.filter}\0${v.rating}\0${v.emptyCkpt ? 1 : 0}`;

  function collect(view) {
    const query = view.query || "";
    const filter = view.filter || "all";
    const rate = view.rating || "general";
    const shownList = [];
    let inRating = 0;
    for (const e of items) {
      if (!visible(e, rate)) continue;
      inRating += 1;
      // 成績單的空底模：名字是「預設」，日誌這欄是空的，不能拿「預設」去比對文字。
      if (view.emptyCkpt && shortName(e.ckpt)) continue;
      if (pass(e, filter) && (!query || (e._text || "").includes(query) || hasTerms(keyOf(e), query))) shownList.push(e);
    }
    return { shownList, shown: shownList.length, hidden: items.length - inRating, total: items.length };
  }

  function statsOf(st) {
    return { shown: st.shown, hidden: st.hidden, total: st.total, more, failed: false };
  }

  function daySection(k, at) {
    // 張數先空著，列放完再寫：新建那一格不要先寫 0 再跳成真正的數字。
    return el(
      "section",
      { class: "log-day", dataset: { day: k } },
      el("h3", { class: "log-day-head" }, dayLabel(at), el("small", { dataset: { src: "" } }, "")),
      el("div", { class: "log-list", role: "list" })
    );
  }

  function paintDayCounts(container, shownList) {
    const perDay = new Map();
    for (const e of shownList) {
      const k = dayKey(e.at);
      perDay.set(k, (perDay.get(k) || 0) + 1);
    }
    for (const section of container.querySelectorAll(":scope > .log-day")) {
      const text = `${perDay.get(section.dataset.day) || 0} 張圖`;
      const small = section.querySelector(".log-day-head small");
      if (!small || small.dataset.src === text) continue;
      const had = !!small.dataset.src;
      small.dataset.src = text;
      small.textContent = text;
      if (had) swapIn(small, text, { firstToo: true });
    }
  }

  function moreButton() {
    const b = el("button", { class: "btn btn-small log-more", type: "button" }, "再往前翻");
    b.addEventListener("click", () => onMore(b));
    return b;
  }

  function queueSeek() {
    if (seeking || seekStop || seekBudget <= 0) return;
    const v = lastView?.view;
    const box = lastView?.container;
    if (!v?.query || !box?.isConnected || !more) return;
    if (collect(v).shownList.length) return;
    const b = box.querySelector(":scope > .log-more");
    if (!b || b.dataset.busy) return;
    // 搜尋時自己再翻，不必等人發現「更早的還沒翻到」卻沒有按鈕。一次最多四頁，再多就停下來給人按。
    seekBudget -= 1;
    onMore(b);
  }

  async function onMore(b) {
    // 正在讀的那一顆再按：停掉後面的自動翻頁。這一頁還是把它讀完（disabled 的按鈕按不到，所以不設 disabled）。
    if (b.dataset.busy) {
      seekStop = true;
      seekBudget = 0;
      return;
    }
    b.dataset.busy = "1";
    b.setAttribute("aria-busy", "true");
    b.textContent = "讀取中…";
    seeking = true;
    try {
      await loadMore();
      const v = lastView?.view;
      const box = lastView?.container;
      if (box && v) render(box, v, { append: true });
    } catch {
      seekStop = true;
      if (b.isConnected) {
        delete b.dataset.busy;
        b.removeAttribute("aria-busy");
        b.textContent = "再往前翻";
        refuse(b);
      }
    } finally {
      seeking = false;
    }
    if (!seekStop) queueSeek();
  }

  function paintMore(container) {
    const b = container.querySelector(":scope > .log-more");
    if (!more) {
      if (b) leave(b, () => b.remove());
      return;
    }
    if (!b) {
      const n = moreButton();
      container.append(n);
      enter(n);
      return;
    }
    b.disabled = false;
    if (b.dataset.busy) {
      delete b.dataset.busy;
      b.textContent = "再往前翻";
    }
  }

  // 新的一列插進既有的日期段。往前翻的接在段尾；刷新冒出來的較新的插在段首。
  // 同一天跨頁只留一個日期標題。回傳這一段要不要做高度過渡（新段用進場，不再量一次）。
  function placeRow(container, e, edge, grown) {
    const k = dayKey(e.at);
    let section = [...container.querySelectorAll(":scope > .log-day")].find((s) => s.dataset.day === k);
    let created = false;
    if (!section) {
      section = daySection(k, e.at);
      created = true;
      const moreBtn = container.querySelector(":scope > .log-more");
      const first = container.querySelector(":scope > .log-day");
      if (edge === "newer" && first) first.before(section);
      else if (moreBtn) moreBtn.before(section);
      else container.append(section);
      enter(section);
    }
    const list = section.querySelector(".log-list");
    if (!created && edge === "older" && grown && !grown.has(section)) grown.set(section, heightChange(section));
    const node = row(e);
    if (edge === "newer") list.prepend(node);
    else list.append(node);
    enter(node);
  }

  function paintChip(rowNode, e) {
    const nextKey = chipKey(e);
    if (rowNode.dataset.chip === nextKey) return;
    rowNode.dataset.chip = nextKey;
    const next = stateChip(e);
    const old = rowNode.querySelector(":scope > .log-state");
    if (old && next) {
      old.replaceWith(next);
      enter(next);
    } else if (next) {
      rowNode.append(next);
      enter(next);
    } else if (old) leave(old, () => old.remove());
  }

  function updateChips() {
    for (const e of items) {
      const rowNode = rowById.get(String(e.id));
      if (!rowNode?.isConnected) continue;
      paintChip(rowNode, e);
    }
  }

  // 收藏完：列還在就補上星號。篩選把這張排除或納入時，只動那一列，不整表重播。
  // only：標記的就是這一筆，成員沒變就只改那一格，不要把整份清單再掃一次。
  function syncFavs(only) {
    const container = lastView?.container;
    if (!container?.isConnected || !lastView.view) return;
    if (!container.querySelector(".log-row")) return;
    const st = collect(lastView.view);
    if (only) {
      const want = st.shownList.some((e) => e.id === only.id);
      const node = rowById.get(String(only.id));
      const have = !!(node && node.isConnected);
      if (want !== have) {
        patch(container, lastView.view, { scroll: false });
        return;
      }
      if (node) paintChip(node, only);
      ctx.onStats?.(statsOf(st));
      return;
    }
    const dom = [...container.querySelectorAll(".log-row")];
    const shownIds = new Set(st.shownList.map((e) => String(e.id)));
    const domIds = new Set(dom.map((n) => n.dataset.id));
    let changed = shownIds.size !== domIds.size;
    if (!changed) for (const id of shownIds) if (!domIds.has(id)) changed = true;
    if (changed) {
      patch(container, lastView.view, { scroll: false });
      return;
    }
    updateChips();
    const out = statsOf(st);
    ctx.onStats?.(out);
  }

  // 條件沒變：只補上新列、拿掉不該留的，舊列的 DOM 留著（圖不重抓、進場不重播）。
  function patch(container, view, { scroll = false } = {}) {
    const st = collect(view);
    const rows = [...container.querySelectorAll(".log-row")];
    if (!rows.length) return paintList(container, view, { deal: false });
    const firstIdx = st.shownList.findIndex((e) => String(e.id) === rows[0].dataset.id);
    const lastIdx = st.shownList.findIndex((e) => String(e.id) === rows[rows.length - 1].dataset.id);
    if (firstIdx < 0 || lastIdx < 0) {
      const top = scroll ? document.scrollingElement?.scrollTop || 0 : 0;
      const out = paintList(container, view, { deal: false });
      if (scroll && document.scrollingElement) document.scrollingElement.scrollTop = top;
      return out;
    }
    const have = new Set(rows.map((n) => n.dataset.id));
    const newer = st.shownList.slice(0, firstIdx).filter((e) => !have.has(String(e.id)));
    const older = st.shownList.slice(lastIdx + 1).filter((e) => !have.has(String(e.id)));
    const covered = new Set([...newer, ...older].map((e) => String(e.id)));
    if (st.shownList.some((e) => !have.has(String(e.id)) && !covered.has(String(e.id)))) {
      const top = scroll ? document.scrollingElement?.scrollTop || 0 : 0;
      const out = paintList(container, view, { deal: false });
      if (scroll && document.scrollingElement) document.scrollingElement.scrollTop = top;
      return out;
    }
    const scroller = document.scrollingElement;
    const top = scroller ? scroller.scrollTop : 0;
    const height = scroller ? scroller.scrollHeight : 0;
    const grown = new Map();
    // 較舊的先插，段首才不會被倒過來。
    for (const e of newer.slice().reverse()) placeRow(container, e, "newer", grown);
    if (scroll && scroller && top > 0) {
      const delta = scroller.scrollHeight - height;
      if (delta > 0) scroller.scrollTop = top + delta;
    }
    for (const e of older) placeRow(container, e, "older", grown);
    for (const g of grown.values()) g.done();
    const shownIds = new Set(st.shownList.map((e) => String(e.id)));
    for (const node of rows) {
      if (shownIds.has(node.dataset.id)) continue;
      rowById.delete(node.dataset.id);
      leave(node, () => {
        const section = node.closest(".log-day");
        node.remove();
        if (section && !section.querySelector(".log-row")) leave(section, () => section.remove());
      });
    }
    paintDayCounts(container, st.shownList);
    paintMore(container);
    updateChips();
    const out = statsOf(st);
    ctx.onStats?.(out);
    queueSeek();
    return out;
  }

  let paintedRating = null;
  function paintList(container, view, { deal = false } = {}) {
    rowById.clear();
    const st = collect(view);
    const out = [];
    if (!st.shownList.length) {
      const query = view.query || "";
      out.push(
        el(
          "p",
          { class: "album-empty" },
          more ? (query ? `最近 ${items.length} 張裡找不到「${query}」，更早的還沒翻到` : `最近 ${items.length} 張裡沒有符合的，更早的還沒翻到`) : query ? `找不到「${query}」` : "沒有符合的"
        )
      );
    } else {
      const perDay = new Map();
      for (const e of st.shownList) {
        const k = dayKey(e.at);
        perDay.set(k, (perDay.get(k) || 0) + 1);
      }
      let day = "";
      let list = null;
      for (const e of st.shownList) {
        const k = dayKey(e.at);
        if (k !== day) {
          day = k;
          const text = `${perDay.get(k)} 張圖`;
          const section = el(
            "section",
            { class: "log-day", dataset: { day: k } },
            el("h3", { class: "log-day-head" }, dayLabel(e.at), el("small", { dataset: { src: text } }, text)),
            el("div", { class: "log-list", role: "list" })
          );
          list = section.querySelector(".log-list");
          out.push(section);
        }
        list.append(row(e));
      }
    }
    // 這一頁沒有符合的、後面還有：按鈕也要在。以前只在有列的時候放，搜尋就停在「更早的還沒翻到」。
    if (more) out.push(moreButton());
    const oldEmpty = container.querySelector(":scope > .album-empty, :scope > .album-hint");
    const apply = () => {
      // 換篩選、找字（同一頁換一批列）：舊的列淡出（殘影），新出現的列一列一列浮進來。
      // 以前兩邊都是一格換掉（2026-11-21 專案主：切換不能生硬）。同一列還在原位的不動。
      // 分級往下調的那一次不做殘影：受限的列要立刻看不到，不能再淡出一下。
      const lowered = paintedRating != null && (RANK[view.rating] ?? 2) < paintedRating;
      paintedRating = RANK[view.rating] ?? 2;
      const changed = !deal && !lowered && paintedKey !== viewKey(view);
      const keyOf = (n) => (n.classList.contains("log-row") ? n.dataset.id : n.classList.contains("log-day-head") ? "day:" + n.parentElement?.dataset.day : "more");
      const ghost = changed ? ghostOut(container, ".log-row, .log-day-head, .log-more", { key: keyOf }) : null;
      const had = changed ? new Set([...container.querySelectorAll(".log-row, .log-day-head")].map(keyOf)) : null;
      container.replaceChildren(...out);
      paintedKey = viewKey(view);
      if (deal && !reducedMotion()) {
        [...container.querySelectorAll(".log-row")].slice(0, 14).forEach((n, i) => enter(n, { delay: DUR.micro + i * 24 }));
        // 日期標題也跟著淡進來：以前列一列一列浮進來，標題卻是一格就在。
        [...container.querySelectorAll(".log-day-head")].slice(0, 4).forEach((n, i) => enter(n, { delay: i * 40 }));
      }
      else if (!deal) {
        for (const born of container.querySelectorAll(":scope > .album-empty, :scope > .log-more")) enter(born);
        if (had) {
          const born = [...container.querySelectorAll(".log-row, .log-day-head")].filter((n) => !had.has(keyOf(n)) && n.getBoundingClientRect().top < innerHeight);
          born.slice(0, 16).forEach((n, i) => enter(n, { delay: DUR.micro + i * 18 }));
        }
      }
      ghost?.done();
      // 空狀態的離場會把換內容延後。按鈕進了文件之後才自動往前翻，不然找不到那顆。
      queueSeek();
    };
    if (oldEmpty && oldEmpty.classList.contains("album-empty")) leave(oldEmpty, apply);
    else apply();
    const stats = statsOf(st);
    ctx.onStats?.(stats);
    return stats;
  }

  function showFailure(container) {
    const btn = container.querySelector(".log-retry");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "重試";
      return { shown: 0, hidden: 0, total: 0, more: false, failed: true };
    }
    const p = el(
      "p",
      { class: "album-empty" },
      "讀不到日誌：伺服器沒開、或還是舊版（重開一次伺服器）。",
      " ",
      el("button", { class: "btn btn-small log-retry", type: "button", onclick: () => retry() }, "重試")
    );
    const old = [...container.children];
    const apply = () => {
      container.replaceChildren(p);
      enter(p);
    };
    if (old.length === 1) leave(old[0], apply);
    else apply();
    return { shown: 0, hidden: 0, total: 0, more: false, failed: true };
  }

  async function retry() {
    const box = lastView?.container;
    const btn = box?.querySelector(".log-retry");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "讀取中…";
    }
    const had = loaded && items.length > 0;
    await load({ refresh: had });
    if (!lastView?.container) return;
    if (had && items.length && lastView.container.querySelector(".log-row")) patch(lastView.container, lastView.view, { scroll: true });
    else render(lastView.container, lastView.view, { deal: !had && loaded });
  }

  function render(container, view = {}, { deal = false, append = false } = {}) {
    const v = { query: view.query || "", filter: view.filter || "all", rating: view.rating || "general", emptyCkpt: !!view.emptyCkpt };
    if (!append && viewKey(v) !== paintedKey) {
      seekStop = false;
      seekBudget = v.query ? 4 : 0;
    }
    lastView = { container, view: v };
    if (!loaded && !failed) {
      if (!container.querySelector(".log-loading")) {
        const p = el("p", { class: "album-empty log-loading" }, "讀取日誌…");
        container.replaceChildren(p);
        enter(p);
      }
      const waiting = { shown: 0, hidden: 0, total: 0, more: false };
      ctx.onStats?.(waiting);
      return waiting;
    }
    if (failed && !items.length) {
      const stats = showFailure(container);
      ctx.onStats?.(stats);
      return stats;
    }
    if (!items.length) {
      if (!container.querySelector(".album-hint")) {
        const p = el("p", { class: "album-hint" }, el("b", {}, "日誌還是空的。"), el("span", {}, "從現在起，墨池、疊印台每印好（或印壞）一張都會記在這裡，沒收藏的也查得到。"), el("a", { class: "btn btn-small", href: "./" }, "去墨池"));
        const apply = () => {
          container.replaceChildren(p);
          enter(p);
          paintedKey = viewKey(v);
        };
        const old = container.querySelector(":scope > .album-empty");
        if (old) leave(old, apply);
        else apply();
      }
      const stats = { shown: 0, hidden: 0, total: 0, more: false };
      ctx.onStats?.(stats);
      return stats;
    }
    if (append && paintedKey === viewKey(v) && container.querySelector(".log-row")) return patch(container, v, { scroll: false });
    return paintList(container, v, { deal });
  }

  function openEntry(e, from) {
    const c = cards(e);
    // 原圖不在了（縮圖已經換成作品冊那份、或確定不在）：大圖和「開原圖」都用作品冊另存的那份（第五輪 Astra 找到）。
    const useFav = !!e._favImg && (e._useFav || e._gone);
    const full = useFav ? e._favImg : e.ok && e.image && !e._gone ? viewSrc(e.image) : e._favImg || null;
    const href = useFav || !e.image ? e._favImg : e.image;
    // 縮圖還沒載完就點開：大圖自己載不到時也換成作品冊那份，連結跟著換。
    const swapToFav = (ev) => {
      const img = ev.currentTarget;
      if (!e._favImg || img.getAttribute("src") === e._favImg) return;
      e._useFav = true;
      img.src = e._favImg;
      for (const a of img.closest(".sheet")?.querySelectorAll("a[data-orig]") || []) a.href = e._favImg;
    };
    const loras = (e.loras || []).map((l) => `${shortName(l.file)}${l.strength !== 1 ? ` ${l.strength}` : ""}`).join("、");
    const facts = [
      ["時間", `${dayLabel(e.at)} ${clock(e.at)}`],
      ["從", ORIGIN_ZH[e.origin] || "—"],
      ["結果", e.ok ? (e._fav ? "★ 收進作品冊了" : e.mark === "discard" ? "印好了，後來撤下" : "印好了") : `印壞：${e.error || "沒說原因"}`],
      ["耗時", e.drawMs != null && e.ms - e.drawMs > 1500 ? `${secs(e.ms)}（畫 ${secs(e.drawMs)}，前面排隊 ${secs(e.ms - e.drawMs)}）` : secs(e.ms)],
      e.kind === "hires" ? (e.hires?.mode === "face" ? ["修臉", "FaceDetailer"] : ["Hires", `${e.hires?.mode || ""} ×${e.hires?.scale ?? "—"}`]) : null,
      ["尺寸", e.width && e.height ? `${e.width}×${e.height}` : "—"],
      ["種子", String(e.seed ?? "—")],
      ["分級", RATING_LABEL[e.rating] || e.rating || "—"],
      ["底模", shortName(e.ckpt) || "預設"],
      ["LoRA", loras || "沒有"],
      e.steps || e.cfg ? ["取樣", [e.steps ? `${e.steps} 步` : "", e.cfg ? `CFG ${e.cfg}` : ""].filter(Boolean).join("・")] : null,
    ].filter(Boolean);
    const weights = weightsOfPositive(e.positive);
    // 補收藏：照收藏的那份形狀（album-save.js 的 saveToAlbum）。日誌沒記哪幾張是親手放的，名字就用前幾張牌。
    const item = {
      status: e.ok && !e._gone ? "done" : "failed",
      image: e.image,
      positive: e.positive,
      seed: e.seed,
      width: e.width,
      height: e.height,
      ckpt: e.ckpt,
      loras: e.loras || [],
      workflowId: e.workflowId,
      sampling: { ...(e.steps ? { steps: e.steps } : {}), ...(e.cfg ? { cfg: e.cfg } : {}) },
      rating: e.rating,
      // 日誌有記抽到的時代。漏了的話作品冊會收成沒標時代，從這件再印也帶不回。
      era: e.era || "",
      mine: [],
      drawn: c.map((tag) => ({ tag })),
      albumId: e._fav,
    };
    const fav = e.ok ? favButton(item, { zh: ctx.zh, persist: () => {
      e._fav = item.albumId;
      syncFavs(e);
      return ctx.reloadWorks();
    }, className: "btn btn-small" }) : null;
    const body = el(
      "div",
      { class: "album-detail" },
      full
        ? el("a", { class: "album-big", href, target: "_blank", rel: "noopener", dataset: { orig: "" }, style: e.width && e.height ? `aspect-ratio: ${e.width} / ${e.height}` : "" }, el("img", { src: full, alt: "", onerror: swapToFav }))
        : el("span", { class: "album-big album-noimg" }, e.ok ? "原圖不在了（ComfyUI 那邊刪掉了）" : "這張沒印成"),
      el(
        "div",
        { class: "album-info" },
        el("dl", { class: "album-facts" }, facts.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)])),
        c.length ? el("section", {}, el("h3", {}, `用到的牌・${c.length}`), el("div", { class: "album-chips is-drawn" }, c.map((t) => el("a", { class: "album-chip pressable", href: cardHref(t), title: `${t}・在卡冊看這張牌` }, ctx.zh(t) + (weights[t] ? ` ${weights[t]}` : ""))))) : null,
        el("details", { class: "album-pos" }, el("summary", {}, "提示詞"), el("pre", { class: "pos-text" }, e.positive || ""))
      )
    );
    // 主鈕：照這張再印（牌、份量、時代、種子、底模、LoRA）；只帶牌、收藏、複製、開原圖是次要的，手機上收進「⋯」。
    const again = c.length
      ? el("button", { class: "btn btn-small btn-primary reprint-btn", type: "button", title: "牌、份量、時代、種子、底模、LoRA 一起帶去墨池", onclick: (ev) => ctx.toMochi(c, `這張的 ${c.length} 張牌`, e, ev.currentTarget, { recipe: recipeOf(e) }) }, transferLabel("pool", "照這張再印"))
      : null;
    const sheet = openSheet(title(e), body, {
      wide: true,
      foot: footMore(again, [
        c.length ? el("button", { class: "btn btn-small", type: "button", onclick: (ev) => ctx.toMochi(c, `這張的 ${c.length} 張牌`, e, ev.currentTarget) }, transferLabel("pool", "只帶牌")) : null,
        fav,
        el(
          "button",
          {
            class: "btn btn-small",
            type: "button",
            onclick: async (ev) => {
              const b = ev.currentTarget;
              const ok = await copyText(e.positive || "");
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
        full ? el("a", { class: "btn btn-small", href, target: "_blank", rel: "noopener", dataset: { orig: "" } }, "開原圖") : null,
      ]),
    });
    // 先記下這扇窗，再播放大：放大若中途出錯，分級調低時仍要關得掉。
    openEntrySheet = { entry: e, close: () => sheet.close() };
    sheet.sheet.addEventListener("sheet-close", () => {
      if (openEntrySheet?.entry === e) openEntrySheet = null;
    }, { once: true });
    // 圖從那一列的小縮圖長大到彈窗、關掉時縮回去（zoom.js）；沒有縮圖可以接的照舊淡進來。
    const big = body.querySelector(".album-big img");
    const t = from?.();
    if (big && t && t.naturalWidth) zoomFromThumb({ from, sheet: sheet.sheet, to: big, aspect: e.width && e.height ? e.width / e.height : 0 });
    else if (!reducedMotion()) big?.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
  }

  function guardRating(rating) {
    const cur = openEntrySheet;
    if (!cur) return;
    if (!visible(cur.entry, rating)) cur.close();
  }

  return {
    load,
    render,
    guardRating,
    reindex() {
      index();
      syncFavs();
    },
    // 背景刷新之後：有舊列就只補新的、留著捲動位置。沒畫過就交回 false，讓外層整頁畫。
    keepView({ scroll = false } = {}) {
      const box = lastView?.container;
      if (!box?.querySelector(".log-row") || failed && !items.length) return false;
      patch(box, lastView.view, { scroll });
      return true;
    },
    get loaded() {
      return loaded;
    },
    get failed() {
      return failed;
    },
    get items() {
      return items;
    },
  };
}

