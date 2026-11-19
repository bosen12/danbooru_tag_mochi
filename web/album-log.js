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
import { refuse, enter, leave, reducedMotion, DUR, CURVE, css, swapIn, heightChange } from "./motion.js";
import { viewSrc } from "./gen.js";
import { tagsOfPositive } from "./usage.js";
import { favButton } from "./album-save.js";
import { weightsOfPositive } from "./weights.js";
import { RATING_LABEL } from "./rules/rating.js";
import { footMore } from "./foot-more.js";
import { transferLabel } from "./transfer.js";
import { recipeOf } from "./store.js";

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

  const cards =(e) => tagsOfPositive(e.positive).filter(ctx.isCard);

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
      if (!e._text) e._text = [e.positive, ...cards(e).map(ctx.zh), shortName(e.ckpt), ...(e.loras || []).map((l) => shortName(l.file)), ORIGIN_ZH[e.origin] || ""].join(" ").toLowerCase();
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
      if (refresh && items.length) absorb(page, !!j.more);
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
      if (seq !== loadSeq) return false;
      failed = true;
    }
    index();
    return ok;
  }

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last || !more) return;
    const j = await fetchPage(last);
    const seen = new Set(items.map((e) => e.id));
    const extra = (j.items || []).filter((e) => e && !seen.has(e.id));
    items = items.concat(extra);
    more = !!j.more;
    paged = true;
    index();
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

  function thumb(e) {
    if (!e.ok || !e.image) return el("span", { class: "log-thumb is-empty", "aria-hidden": "true" }, "✕");
    const box = el("span", { class: "log-thumb", style: e.width && e.height ? `aspect-ratio: ${e.width} / ${e.height}` : "" });
    const favSrc = () => listSrc(e._favImg);
    box.append(
      el("img", {
        src: listSrc(viewSrc(e.image)),
        alt: "",
        loading: "lazy",
        decoding: "async",
        onerror: (ev) => {
          // output 裡的原圖清掉了：收藏過的換成作品冊那一份，沒收藏的才說不在了。
          const fav = favSrc();
          if (fav && ev.currentTarget.getAttribute("src") !== fav) {
            // 記著：點開詳情、「開原圖」也用這一份（以前縮圖換過來了，詳情還連到不在的原圖）。
            e._useFav = true;
            ev.currentTarget.src = fav;
            return;
          }
          e._gone = true;
          box.classList.add("is-gone");
          box.replaceChildren(el("span", {}, "原圖不在了"));
        },
      })
    );
    return box;
  }

  // 列表上的名字：跳過每張都有的人數牌（1個女性、單人），先寫看得出差別的。
  function title(e) {
    const c = cards(e);
    if (!c.length) return `seed ${e.seed ?? "—"}`;
    const telling = c.filter((t) => ctx.lib.byTag.get(t)?.item?.section !== "subject");
    const pick = (telling.length ? telling : c).slice(0, 4);
    return pick.map(ctx.zh).join("・") + (c.length > pick.length ? `…（共 ${c.length} 張牌）` : "");
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
      { class: "log-row pressable", type: "button", role: "listitem", dataset: { id: e.id, ok: e.ok ? "true" : "false" } },
      thumb(e),
      el("span", { class: "log-main" }, el("b", {}, title(e)), el("small", {}, meta.join("・")), !e.ok && e.error ? el("small", { class: "log-error" }, e.error) : null),
      stateChip(e)
    );
    node.addEventListener("click", () => openEntry(e, () => node.querySelector(".log-thumb img")));
    return node;
  }

  const viewKey = (v) => `${v.query}\0${v.filter}\0${v.rating}`;

  function collect(view) {
    const query = view.query || "";
    const filter = view.filter || "all";
    const rate = view.rating || "general";
    const shownList = [];
    let inRating = 0;
    for (const e of items) {
      if (!visible(e, rate)) continue;
      inRating += 1;
      if (pass(e, filter) && (!query || (e._text || "").includes(query))) shownList.push(e);
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

  async function onMore(b) {
    if (b.disabled) return;
    b.disabled = true;
    b.dataset.busy = "1";
    b.textContent = "讀取中…";
    try {
      await loadMore();
      const v = lastView?.view;
      const box = lastView?.container;
      if (box && v) render(box, v, { append: true });
    } catch {
      if (b.isConnected) {
        b.disabled = false;
        delete b.dataset.busy;
        b.textContent = "再往前翻";
        refuse(b);
      }
    }
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

  function updateChips(container) {
    for (const e of items) {
      const rowNode = container.querySelector(`.log-row[data-id="${CSS.escape(String(e.id))}"]`);
      if (!rowNode) continue;
      const next = stateChip(e);
      const old = rowNode.querySelector(":scope > .log-state");
      const nextKey = next ? next.className : "";
      const oldKey = old ? old.className : "";
      if (nextKey === oldKey) continue;
      if (old && next) {
        old.replaceWith(next);
        enter(next);
      } else if (next) {
        rowNode.append(next);
        enter(next);
      } else if (old) leave(old, () => old.remove());
    }
  }

  // 收藏完：列還在就補上星號。篩選把這張排除或納入時，只動那一列，不整表重播。
  function syncFavs() {
    const container = lastView?.container;
    if (!container?.isConnected || !lastView.view) return;
    if (!container.querySelector(".log-row")) return;
    const st = collect(lastView.view);
    const dom = [...container.querySelectorAll(".log-row")];
    const shownIds = new Set(st.shownList.map((e) => String(e.id)));
    const domIds = new Set(dom.map((n) => n.dataset.id));
    let changed = shownIds.size !== domIds.size;
    if (!changed) for (const id of shownIds) if (!domIds.has(id)) changed = true;
    if (changed) {
      patch(container, lastView.view, { scroll: false });
      return;
    }
    updateChips(container);
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
      leave(node, () => {
        const section = node.closest(".log-day");
        node.remove();
        if (section && !section.querySelector(".log-row")) leave(section, () => section.remove());
      });
    }
    paintDayCounts(container, st.shownList);
    paintMore(container);
    updateChips(container);
    const out = statsOf(st);
    ctx.onStats?.(out);
    return out;
  }

  function paintList(container, view, { deal = false } = {}) {
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
    if (more && st.shownList.length) out.push(moreButton());
    const oldEmpty = container.querySelector(":scope > .album-empty, :scope > .album-hint");
    const apply = () => {
      container.replaceChildren(...out);
      paintedKey = viewKey(view);
      if (deal && !reducedMotion()) [...container.querySelectorAll(".log-row")].slice(0, 14).forEach((n, i) => enter(n, { delay: DUR.micro + i * 24 }));
      else if (!deal) {
        const born = container.querySelector(":scope > .album-empty, :scope > .log-more");
        if (born) enter(born);
      }
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
    const v = { query: view.query || "", filter: view.filter || "all", rating: view.rating || "general" };
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
      syncFavs();
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
    // 圖從那一列的小縮圖長大到彈窗、關掉時縮回去（zoom.js）；沒有縮圖可以接的照舊淡進來。
    const big = body.querySelector(".album-big img");
    const t = from?.();
    if (big && t && t.naturalWidth) zoomFromThumb({ from, sheet: sheet.sheet, to: big, aspect: e.width && e.height ? e.width / e.height : 0 });
    else if (!reducedMotion()) big?.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
  }

  return {
    load,
    render,
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

