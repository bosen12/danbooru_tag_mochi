import { dateLocale, english } from "./i18n.js";
/**
 * 作品冊的「模型」：每個底模、每個 LoRA 一張成績單（伺服器 /api/genlog/stats 從出圖日誌算）。
 *   代表作（收藏過的優先）、印好幾張、收藏幾成、撤下幾成、印壞幾張、平均畫多久、常配的牌、最近一次。
 *   點一張：跳到「日誌」，只看用它印的。
 * 只算有日誌之後印的；Hires 是同一張再放大，不重複算。
 */
import { el } from "./ui.js";
import { enter, reducedMotion, DUR } from "./motion.js";
import { viewSrc } from "./gen.js";
import { secs } from "./album-log.js";

const RANK = { general: 0, sensitive: 1, explicit: 2 };
const pct = (k, n) => (n ? Math.round((k / n) * 100) : 0);

function ago(at) {
  if (!at) return "—";
  const d = Math.floor((Date.now() - at) / 86400000);
  return d <= 0 ? "今天" : d === 1 ? "昨天" : d < 30 ? `${d} 天前` : new Date(at).toLocaleDateString(dateLocale, { month: "numeric", day: "numeric" });
}

/** ctx：{ zh, isCard, sectionOf(tag), openLogFor(name) } */
export function createModels(ctx) {
  let stats = null;
  let failed = false;

  async function load() {
    try {
      const r = await fetch("/api/genlog/stats", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      stats = await r.json();
      failed = false;
    } catch {
      stats = null;
      failed = true;
    }
  }

  function card(m, rating) {
    const best = m.best && m.best.image && (RANK[m.best.rating] ?? 0) <= RANK[rating] ? m.best : null;
    const art = best
      ? el("span", { class: "model-art", style: best.width && best.height ? `aspect-ratio: ${best.width} / ${best.height}` : "" }, el("img", { src: viewSrc(best.image), alt: "", loading: "lazy", decoding: "async", onerror: (e) => e.currentTarget.parentElement.replaceChildren(el("small", {}, "原圖不在了")) }))
      : el("span", { class: "model-art is-empty" }, el("small", {}, m.best ? "代表作在這一級分級看不到" : "還沒有印好的"));
    const facts = [
      ["印好", english ? `${m.n} images` : `${m.n} 張`],
      ["收藏", `${pct(m.fav, m.n)}%`, m.fav ? "good" : ""],
      ["撤下", `${pct(m.discard, m.n)}%`, m.discard ? "bad" : ""],
      ["印壞", english ? `${m.failed} images` : `${m.failed} 張`, m.failed ? "bad" : ""],
      ["平均畫", m.drawMs ? secs(m.drawMs) : "—"],
      ["最近", ago(m.last)],
    ];
    // 常配的牌：跳過每張都有的人數牌（1個女性、單人），看得出這個模型常拿來畫什麼。
    const known = (m.cards || []).filter(ctx.isCard);
    const telling = known.filter((t) => ctx.sectionOf(t) !== "subject");
    const cards = (telling.length ? telling : known).slice(0, 6);
    const node = el(
      "button",
      { class: "model-card pressable", type: "button", role: "listitem", dataset: { kind: m.kind }, title: `看用「${m.name}」印的（日誌）` },
      art,
      el(
        "span",
        { class: "model-body" },
        el("b", { class: "model-name", dataset: { noI18n: "" } }, m.name),
        el("span", { class: "model-facts" }, facts.map(([k, v, tone]) => el("span", { class: "model-fact", dataset: tone ? { tone } : {} }, el("small", {}, k), el("b", {}, v)))),
        cards.length ? el("span", { class: "model-cards" }, el("small", {}, "常配的牌"), el("span", { class: "album-chips" }, cards.map((t) => el("span", { class: "album-chip", title: t }, ctx.zh(t))))) : null
      )
    );
    node.addEventListener("click", () => ctx.openLogFor(m.name));
    return node;
  }

  function section(title, note, list, rating) {
    return el(
      "section",
      { class: "model-section" },
      el("h3", { class: "log-day-head" }, title, el("small", {}, note)),
      el("div", { class: "model-grid", role: "list" }, list.map((m) => card(m, rating)))
    );
  }

  function render(container, { query = "", rating = "general" } = {}, { deal = false } = {}) {
    if (failed) {
      container.replaceChildren(el("p", { class: "album-empty" }, "讀不到統計：伺服器沒開、或還是舊版（重開一次伺服器）。"));
      return { shown: 0 };
    }
    if (!stats) {
      container.replaceChildren(el("p", { class: "album-empty" }, "讀取統計…"));
      return { shown: 0 };
    }
    const all = (stats.models || []).filter((m) => m.n + m.failed > 0 && (!query || m.name.toLowerCase().includes(query)));
    const ckpts = all.filter((m) => m.kind === "ckpt");
    const loras = all.filter((m) => m.kind === "lora");
    if (!stats.models?.length) {
      container.replaceChildren(
        el("p", { class: "album-hint" }, el("b", {}, "還沒有成績。"), el("span", {}, "從現在起印的每一張都會記下用了哪個底模、哪些 LoRA；收藏喜歡的、撤下不要的，這裡就看得出哪個模型最合你。"), el("a", { class: "btn btn-small", href: "./" }, "去墨池"))
      );
      return { shown: 0 };
    }
    const out = [];
    if (ckpts.length) out.push(section("底模", `${ckpts.length} 個`, ckpts, rating));
    if (loras.length) out.push(section("LoRA", `${loras.length} 個・一張圖掛幾個就各算一次`, loras, rating));
    if (!out.length) out.push(el("p", { class: "album-empty" }, `找不到「${query}」`));
    container.replaceChildren(...out);
    if (deal && !reducedMotion()) [...container.querySelectorAll(".model-card")].slice(0, 12).forEach((n, i) => enter(n, { delay: DUR.micro + i * 30 }));
    return { shown: all.length, total: stats.total || 0 };
  }

  return {
    load,
    render,
    get loaded() {
      return !!stats || failed;
    },
  };
}
