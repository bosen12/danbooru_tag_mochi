import { dateLocale } from "./i18n.js";
/**
 * 作品冊的「日誌」：印過的每一張（伺服器的 gen_log.py，/api/genlog），不只收藏的。
 * 成品牆只留 80 張、沒收藏的過一陣子就找不到了；這裡一直查得到，還能補收藏、把牌帶回墨池。
 *   - 依日期分段，新的在前；一次讀 300 張，底下「再往前翻」。
 *   - 每一列：縮圖、牌名、時間、哪一頁送的、耗時、狀態（★ 收藏、撤下、印壞、Hires）。
 *   - 收藏的認法：作品冊那一筆的種子＋用到的牌一樣（作品冊沒記工作編號）。
 *   - ComfyUI 那邊的原圖刪掉了：縮圖換成「原圖不在了」，也就收藏不了。
 */
import { el, openSheet } from "./ui.js";
import { refuse, enter, reducedMotion, DUR, CURVE, css } from "./motion.js";
import { viewSrc } from "./gen.js";
import { tagsOfPositive } from "./usage.js";
import { favButton } from "./album-save.js";
import { weightsOfPositive } from "./weights.js";
import { RATING_LABEL } from "./rules/rating.js";

const PAGE = 300;
const ORIGIN_ZH = { mochi: "墨池", fuse: "疊印台" };
const RANK = { general: 0, sensitive: 1, explicit: 2 };
export const LOG_FILTERS = [
  ["all", "全部"],
  ["fav", "★ 收藏的"],
  ["discard", "撤下的"],
  ["failed", "印壞的"],
  ["hires", "Hires"],
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
  if (dateLocale === "en-US") return d.toLocaleDateString(dateLocale, { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
  return `${d.getFullYear() === today.getFullYear() ? "" : d.getFullYear() + " 年 "}${d.getMonth() + 1} 月 ${d.getDate()} 日（${wd}）`;
}

const clock = (at) => new Date(at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false });

/** 作品冊那一筆跟日誌那一張是不是同一張：種子一樣、用到的牌一樣。 */
export const favKey = (seed, positive, isCard) => `${seed}|${tagsOfPositive(positive).filter(isCard).sort().join(",")}`;

/**
 * ctx：{ lib, zh, isCard, getWorks(), toMochi(tags, label, entry), reloadWorks() }
 * 回傳 { load(), render(container, { query, filter, rating }), count }。
 */
export function createLog(ctx) {
  let items = [];
  let more = false;
  let loaded = false;
  let failed = false;
  let favs = new Map();

  const cards = (e) => tagsOfPositive(e.positive).filter(ctx.isCard);

  function index() {
    favs = new Map(ctx.getWorks().map((w) => [favKey(w.seed, w.positive, ctx.isCard), w.id]));
    for (const e of items) {
      e._fav = e.ok ? favs.get(favKey(e.seed, e.positive, ctx.isCard)) || null : null;
      if (!e._text) e._text = [e.positive, ...cards(e).map(ctx.zh), shortName(e.ckpt), ...(e.loras || []).map((l) => shortName(l.file)), ORIGIN_ZH[e.origin] || ""].join(" ").toLowerCase();
    }
  }

  async function fetchPage(before) {
    const r = await fetch(`/api/genlog?limit=${PAGE}${before ? `&before=${before}` : ""}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  async function load() {
    try {
      const j = await fetchPage(0);
      items = j.items || [];
      more = !!j.more;
      failed = false;
    } catch {
      items = [];
      more = false;
      failed = true;
    }
    loaded = true;
    index();
  }

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    const j = await fetchPage(last.at);
    const seen = new Set(items.map((e) => e.id));
    items = items.concat((j.items || []).filter((e) => !seen.has(e.id)));
    more = !!j.more;
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

  function thumb(e) {
    if (!e.ok || !e.image) return el("span", { class: "log-thumb is-empty", "aria-hidden": "true" }, "✕");
    const box = el("span", { class: "log-thumb", style: e.width && e.height ? `aspect-ratio: ${e.width} / ${e.height}` : "" });
    box.append(
      el("img", {
        src: viewSrc(e.image),
        alt: "",
        loading: "lazy",
        decoding: "async",
        onerror: () => {
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
    return pick.map(ctx.zh).join("・") + (c.length > pick.length ? `…（${c.length} 張）` : "");
  }

  function row(e) {
    const meta = [
      clock(e.at),
      ORIGIN_ZH[e.origin] || "",
      e.kind === "hires" ? `Hires ${e.hires?.scale ? "×" + e.hires.scale : ""}` : "",
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
    node.addEventListener("click", () => openEntry(e));
    return node;
  }

  function render(container, { query = "", filter = "all", rating = "general" } = {}, { deal = false } = {}) {
    if (!loaded) {
      container.replaceChildren(el("p", { class: "album-empty" }, "讀取日誌…"));
      return { shown: 0, hidden: 0 };
    }
    if (failed) {
      container.replaceChildren(el("p", { class: "album-empty" }, "讀不到日誌：伺服器沒開、或還是舊版（重開一次伺服器）。"));
      return { shown: 0, hidden: 0 };
    }
    if (!items.length) {
      container.replaceChildren(
        el("p", { class: "album-hint" }, el("b", {}, "日誌還是空的。"), el("span", {}, "從現在起，墨池、疊印台每印好（或印壞）一張都會記在這裡，沒收藏的也查得到。"), el("a", { class: "btn btn-small", href: "./" }, "去墨池"))
      );
      return { shown: 0, hidden: 0 };
    }
    const inRating = items.filter((e) => visible(e, rating));
    const shown = inRating.filter((e) => pass(e, filter) && (!query || e._text.includes(query)));
    const out = [];
    let day = "";
    let list = null;
    for (const e of shown) {
      const k = dayKey(e.at);
      if (k !== day) {
        day = k;
        const n = shown.filter((x) => dayKey(x.at) === k).length;
        list = el("div", { class: "log-list", role: "list" });
        out.push(el("section", { class: "log-day" }, el("h3", { class: "log-day-head" }, dayLabel(e.at), el("small", {}, `${n} 張`)), list));
      }
      list.append(row(e));
    }
    if (!shown.length) out.push(el("p", { class: "album-empty" }, query ? `找不到「${query}」` : "沒有符合的"));
    if (more) {
      const b = el("button", { class: "btn btn-small log-more", type: "button" }, "再往前翻");
      b.addEventListener("click", async () => {
        b.disabled = true;
        b.textContent = "讀取中…";
        try {
          await loadMore();
          render(container, { query, filter, rating });
        } catch {
          b.disabled = false;
          b.textContent = "再往前翻";
          refuse(b);
        }
      });
      out.push(b);
    }
    container.replaceChildren(...out);
    if (deal && !reducedMotion()) [...container.querySelectorAll(".log-row")].slice(0, 14).forEach((n, i) => enter(n, { delay: DUR.micro + i * 24 }));
    return { shown: shown.length, hidden: items.length - inRating.length, total: items.length, more };
  }

  function openEntry(e) {
    const c = cards(e);
    const full = e.ok && e.image && !e._gone ? viewSrc(e.image) : null;
    const loras = (e.loras || []).map((l) => `${shortName(l.file)}${l.strength !== 1 ? ` ${l.strength}` : ""}`).join("、");
    const facts = [
      ["時間", `${dayLabel(e.at)} ${clock(e.at)}`],
      ["從", ORIGIN_ZH[e.origin] || "—"],
      ["結果", e.ok ? (e._fav ? "★ 收進作品冊了" : e.mark === "discard" ? "印好了，後來撤下" : "印好了") : `印壞：${e.error || "沒說原因"}`],
      ["耗時", e.drawMs != null && e.ms - e.drawMs > 1500 ? `${secs(e.ms)}（畫 ${secs(e.drawMs)}，前面排隊 ${secs(e.ms - e.drawMs)}）` : secs(e.ms)],
      e.kind === "hires" ? ["Hires", `${e.hires?.mode || ""} ×${e.hires?.scale ?? "—"}`] : null,
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
      mine: [],
      drawn: c.map((tag) => ({ tag })),
      albumId: e._fav,
    };
    const fav = e.ok ? favButton(item, { zh: ctx.zh, persist: () => ((e._fav = item.albumId), ctx.reloadWorks()), className: "btn btn-small" }) : null;
    const body = el(
      "div",
      { class: "album-detail" },
      full
        ? el("a", { class: "album-big", href: e.image, target: "_blank", rel: "noopener", style: e.width && e.height ? `aspect-ratio: ${e.width} / ${e.height}` : "" }, el("img", { src: full, alt: "" }))
        : el("span", { class: "album-big album-noimg" }, e.ok ? "原圖不在了（ComfyUI 那邊刪掉了）" : "這張沒印成"),
      el(
        "div",
        { class: "album-info" },
        el("dl", { class: "album-facts" }, facts.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)])),
        c.length ? el("section", {}, el("h3", {}, `用到的牌・${c.length}`), el("div", { class: "album-chips is-drawn" }, c.map((t) => el("span", { class: "album-chip", title: t }, ctx.zh(t) + (weights[t] ? ` ${weights[t]}` : ""))))) : null,
        el("details", { class: "album-pos" }, el("summary", {}, "提示詞"), el("pre", { class: "pos-text" }, e.positive || ""))
      )
    );
    openSheet(title(e), body, {
      wide: true,
      foot: [
        c.length ? el("button", { class: "btn btn-small btn-primary", type: "button", onclick: () => ctx.toMochi(c, `這張的 ${c.length} 張牌`, e) }, "牌帶回墨池") : null,
        fav,
        el(
          "button",
          {
            class: "btn btn-small",
            type: "button",
            onclick: async (ev) => {
              const b = ev.currentTarget;
              try {
                await navigator.clipboard.writeText(e.positive || "");
                b.textContent = "已複製";
                setTimeout(() => (b.textContent = "複製 POS"), 1400);
              } catch {
                refuse(b);
              }
            },
          },
          "複製 POS"
        ),
        full ? el("a", { class: "btn btn-small", href: e.image, target: "_blank", rel: "noopener" }, "開原圖") : null,
      ],
    });
    if (!reducedMotion()) body.querySelector(".album-big img")?.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
  }

  return {
    load,
    render,
    reindex: index,
    get loaded() {
      return loaded;
    },
    get items() {
      return items;
    },
  };
}

