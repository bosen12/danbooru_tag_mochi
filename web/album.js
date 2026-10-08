import { dateLocale, english } from "./i18n.js";
/**
 * 作品冊：收藏的成品（album-save.js 從墨池、疊印台收進來；存在伺服器 recipes.py，圖另存一份）。
 *   - 大圖牆：照每張的長寬比排（album.css 的 columns），新的在前；超出頂端分級的先收起來。
 *   - 找作品：作品名、牌的中文名、提示詞。
 *   - 點一張：大圖、你選的牌、全部的牌、尺寸／種子／底模；把牌帶回墨池、複製 POS、開原圖、從作品冊拿掉。
 *   - 網址帶 #作品編號（收藏完按「打開作品冊」過來）：直接打開那一張。
 *   - 「日誌」分頁：印過的每一張，不只收藏的（album-log.js）。網址帶 ?tab=log 直接開在日誌。
 *   - 「模型」分頁：每個底模、LoRA 的成績單（album-models.js）；點一張跳到日誌只看它印的。
 *   - 分輯：依時代、髮色、服裝、場景把作品分段（album-groups.js）；詳情裡列出相似的作品。
 */
import { RATING_LABEL, ratingBlocked } from "./rules/rating.js";
import { buildLibrary, ERA_ZH } from "./cards.js";
import { el, openSheet, toast } from "./ui.js";
import { mountKeysHelp } from "./keys-help.js";
import { mountTour } from "./tour.js";
import { mountGenStatus } from "./gen-status.js";
import { initMotion, settleMotion, seat, refuse, enter, leave, reducedMotion, CURVE, DUR, css } from "./motion.js";
import { watchLink, LINK_LABEL } from "./gen.js";
import { getSfx } from "./sfx.js";
import * as S from "./store.js";
import { tagsOfPositive } from "./usage.js";
import { removeFromAlbum } from "./album-save.js";
import { weightsOfPositive } from "./weights.js";
import { createLog, LOG_FILTERS } from "./album-log.js";
import { createModels } from "./album-models.js";
import { GROUPINGS, groupWorks, similarWorks } from "./album-groups.js";

const sfx = getSfx();
const $ = (id) => document.getElementById(id);
const RANK = { general: 0, sensitive: 1, explicit: 2 };

let lib = null;
let works = [];
let rating = "general";
let query = "";
// 分頁：works（收藏的）／log（印過的每一張）。
const TABS = [
  ["works", "作品"],
  ["log", "日誌"],
  ["models", "模型"],
];
let tab = TABS.some(([v]) => v === new URLSearchParams(location.search).get("tab")) ? new URLSearchParams(location.search).get("tab") : "works";
let logFilter = "all";
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
const cardsOf = (w) => tagsOfPositive(w.positive || "").filter((t) => lib.byTag.has(t));
const mineOf = (w) => (Array.isArray(w.pinned) ? w.pinned : []).filter((t) => lib.byTag.has(t));
// 找相似用：去掉每張都有的人數牌（1個女性、單人），留下看得出差別的。
const tellingOf = (w) => (w._telling ??= cardsOf(w).filter((t) => lib.byTag.get(t)?.item?.section !== "subject"));

function dateText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(dateLocale, { year: "numeric", month: "numeric", day: "numeric" });
}

/* ================= 開機 ================= */

async function boot() {
  initMotion();
  // 快捷鍵說明（電腦）：頂欄的「?」、按 ? 打開（keys-help.js）。
  mountKeysHelp("album");
  // 新手導覽（頂欄「教學」右邊的「導覽」；第一次來會問要不要走一遍）：tour.js。
  mountTour("album");
  // 墨池、疊印台正在印的：頂欄看得到，點了回去（gen-status.js）。
  mountGenStatus("album");
  try {
    const data = await fetch(document.querySelector('link[rel="preload"][href^="lexicon.json"]')?.href || "lexicon.json").then((r) => r.json());
    lib = buildLibrary(data, { ratingBlocked });
  } catch (err) {
    $("album").replaceChildren(el("p", { class: "album-hint" }, "讀不到詞庫。請用 start.bat 開，而不是直接點 HTML。", el("br"), String(err)));
    return;
  }
  rating = (S.loadSettings() || {}).rating || "general";
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
  });
  models = createModels({
    zh,
    isCard: (t) => lib.byTag.has(t),
    sectionOf: (t) => lib.byTag.get(t)?.item?.section,
    // 點一張成績單：換到日誌、找字框填上它的名字。
    openLogFor: (name) => {
      $("album-q").value = name;
      query = name.toLowerCase();
      pickTab("log");
    },
  });
  renderRating();
  renderTabs();
  wireSearch();
  wireSound();
  pingLoop();
  await load();
  if (tab === "log") await log.load();
  if (tab === "models") await models.load();
  render({ deal: true });
  settleMotion();
  openFromHash();
  addEventListener("hashchange", openFromHash);
  // 別的分頁收了新的作品：回到這一頁時重新讀一次。
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) return;
    const before = works.map((w) => w.id).join();
    await load();
    // 日誌開著：回來時也重讀（剛才在墨池又印了幾張）。
    if (tab === "log") {
      await log.load();
      return render();
    }
    if (tab === "models") {
      await models.load();
      return render();
    }
    if (works.map((w) => w.id).join() !== before) render();
  });
}

async function load() {
  try {
    const r = await fetch("/api/recipes", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    works = (j.items || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    for (const w of works) {
      const cards = cardsOf(w);
      w._text = [w.name, w.positive, ...cards.map(zh)].join(" ").toLowerCase();
    }
  } catch {
    works = [];
    toast("讀不到作品冊：伺服器沒開，或連不到主機");
  }
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
}

function pingLoop() {
  watchLink((st) => {
    const p = $("ping");
    const changed = p.dataset.ok !== (st === "ok" ? "1" : "0") || p.dataset.link !== st;
    p.dataset.ok = st === "ok" ? "1" : "0";
    p.dataset.link = st;
    if (changed) p.querySelector("span").textContent = LINK_LABEL[st];
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

function wireSearch() {
  const q = $("album-q");
  let timer = 0;
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      query = q.value.trim().toLowerCase();
      render();
    }, 140);
  });
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && q.value) {
      q.value = "";
      query = "";
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
  box.replaceChildren(
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
    )
  );
  const filters = $("log-filters");
  filters.hidden = tab !== "log";
  filters.replaceChildren(
    ...LOG_FILTERS.map(([v, label]) =>
      el(
        "button",
        {
          class: "group-chip pressable",
          type: "button",
          "aria-pressed": logFilter === v ? "true" : "false",
          onclick: () => {
            if (logFilter === v) return;
            logFilter = v;
            renderTabs();
            render();
          },
        },
        label
      )
    )
  );
  const groupBox = $("works-group");
  groupBox.hidden = tab !== "works";
  groupBox.replaceChildren(
    el("span", { class: "works-group-lead" }, "分輯"),
    ...GROUPINGS.map(([v, label]) =>
      el(
        "button",
        {
          class: "group-chip pressable",
          type: "button",
          "aria-pressed": grouping === v ? "true" : "false",
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
    )
  );
  $("album-q").placeholder = PLACEHOLDER[tab];
}

async function pickTab(v) {
  if (tab === v) return;
  tab = v;
  // 換分頁記在網址上：重新整理、上一頁回來還是這一頁（不推新的歷史，免得上一頁要按好幾次）。
  const u = new URL(location.href);
  if (tab === "works") u.searchParams.delete("tab");
  else u.searchParams.set("tab", tab);
  history.replaceState(null, "", u.pathname + u.search + u.hash);
  renderTabs();
  seat($("album-tabs").querySelector('[aria-checked="true"]'));
  if (tab === "log" && !log.loaded) {
    render();
    await log.load();
  }
  // 成績單每次換過來都重算（剛才可能又印了、又收藏了）。
  if (tab === "models") {
    if (!models.loaded) render();
    await models.load();
  }
  render({ deal: true });
}

/* ================= 大圖牆 ================= */

const visible = (w) => (RANK[w.rating] ?? 2) <= RANK[rating];

function render({ deal = false } = {}) {
  const grid = $("album-grid");
  const logBox = $("album-log");
  const modelBox = $("album-models");
  grid.hidden = tab !== "works";
  logBox.hidden = tab !== "log";
  modelBox.hidden = tab !== "models";
  if (tab === "models") {
    $("album-hint").hidden = true;
    const r = models.render(modelBox, { query, rating }, { deal });
    $("album-sum").textContent = r.total ? `從日誌裡印好的 ${r.total} 張算` : "";
    return;
  }
  if (tab === "log") {
    $("album-hint").hidden = true;
    const r = log.render(logBox, { query, filter: logFilter, rating }, { deal });
    $("album-sum").textContent = log.loaded && r.total
      ? `${r.shown}${english ? " images" : " 張"}${r.more ? "（還有更早的）" : ""}${r.hidden ? `・${r.hidden} 張在${RATING_LABEL[rating]}看不到` : ""}`
      : "";
    return;
  }
  const shown = works.filter((w) => visible(w) && (!query || w._text.includes(query)));
  const hidden = works.filter((w) => !visible(w)).length;
  $("album-hint").hidden = works.length > 0;
  $("album-sum").textContent = works.length
    ? `${shown.length} 件作品${hidden ? `・${hidden} 件在${RATING_LABEL[rating]}看不到` : ""}`
    : "";
  const groups = groupWorks(shown, shown.length ? grouping : "none", { lib, eraZh: ERA_ZH, cardsOf });
  const grouped = groups.length > 1 || (groups[0] && groups[0].label);
  grid.classList.toggle("is-grouped", !!grouped);
  const tiles = [];
  const parts = grouped
    ? groups.map((g) => {
        const ts = g.items.map(tile);
        tiles.push(...ts);
        return el(
          "section",
          { class: "album-group", dataset: { rest: g.rest ? "true" : "false" } },
          el("h3", { class: "log-day-head" }, g.label, el("small", {}, `${g.items.length} 件`)),
          el("div", { class: "album-grid-in", role: "list" }, ts)
        );
      })
    : (groups[0]?.items || []).map((w) => {
        const t = tile(w);
        tiles.push(t);
        return t;
      });
  grid.replaceChildren(...(tiles.length || !works.length ? parts : [el("p", { class: "album-empty" }, query ? `找不到「${query}」` : `這一級分級看不到任何作品`)]));
  if (deal && !reducedMotion()) {
    tiles.slice(0, 12).forEach((t, i) =>
      t.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
        duration: DUR.long,
        delay: DUR.micro + i * 40,
        easing: css(CURVE.out),
        fill: "backwards",
      })
    );
  }
}

function tile(w) {
  const src = fileUrl(w.thumbnail) || fileUrl(w.image);
  const ratio = w.width && w.height ? `${w.width} / ${w.height}` : "2 / 3";
  const born = performance.now();
  const img = src
    ? el("img", {
        src,
        alt: "",
        loading: "lazy",
        decoding: "async",
        onload: (e) => {
          // 晚到的圖淡進來；本來就在快取裡的直接出現（不閃一格空白）。
          if (performance.now() - born > 80 && !reducedMotion()) e.currentTarget.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
        },
      })
    : el("span", { class: "album-noimg" }, "沒有圖");
  const node = el(
    "button",
    { class: "album-tile pressable", type: "button", role: "listitem", dataset: { id: w.id }, "aria-label": `${w.name}，${dateText(w.createdAt)}` },
    el("span", { class: "album-frame", style: `aspect-ratio: ${ratio}` }, img),
    el("span", { class: "album-cap" }, el("b", { dataset: { noI18n: "" } }, w.name), el("small", {}, dateText(w.createdAt)))
  );
  node.addEventListener("click", () => openWork(w));
  return node;
}

/* ================= 一張作品 ================= */

/** 詳情底下「相似的作品」：用到的牌重疊多的幾件（這一級分級看得到的），點一下換過去看。 */
function similarBox(w, sheetOf) {
  const list = similarWorks(w, works.filter(visible), tellingOf);
  if (!list.length) return null;
  return el(
    "section",
    { class: "album-similar" },
    el("h3", {}, `相似的作品・${list.length}`),
    el(
      "div",
      { class: "album-similar-row" },
      list.map(({ work: x, both }) => {
        const src = fileUrl(x.thumbnail) || fileUrl(x.image);
        return el(
          "button",
          {
            class: "album-similar-item pressable",
            type: "button",
            title: `${x.name}：${both} 張牌一樣`,
            onclick: () => {
              sheetOf()?.close();
              setTimeout(() => openWork(x), reducedMotion() ? 0 : DUR.short);
            },
          },
          el("span", { class: "album-frame", style: x.width && x.height ? `aspect-ratio: ${x.width} / ${x.height}` : "" }, src ? el("img", { src, alt: "", loading: "lazy", decoding: "async" }) : el("span", { class: "album-noimg" }, "沒有圖")),
          el("small", {}, `${both} 張一樣`)
        );
      })
    )
  );
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const w = works.find((x) => x.id === id);
  if (!w) return toast("這件作品不在作品冊裡了");
  if (!visible(w)) {
    rating = w.rating;
    S.saveSettings({ ...(S.loadSettings() || {}), rating });
    renderRating();
    render();
  }
  $("album-grid").querySelector(`.album-tile[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" });
  openWork(w);
}

function chips(tags, kind, weights = {}) {
  // 調過份量的牌寫上數字（跟合成池牌角的數字一樣）。
  return el("div", { class: `album-chips is-${kind}` }, tags.map((t) => el("span", { class: "album-chip", title: t }, zh(t) + (weights[t] ? ` ${weights[t]}` : ""))));
}

function toMochi(tags, label, w) {
  // 份量（weights.js）從提示詞讀回來：收藏時調過的牌，帶回去還是那個份量。
  const all = weightsOfPositive(w?.positive);
  S.handOffPool(tags, "album", Object.fromEntries(tags.filter((t) => all[t]).map((t) => [t, all[t]])));
  toast(`${label}帶去墨池…`);
  setTimeout(() => (location.href = "./"), reducedMotion() ? 0 : DUR.short);
}

function openWork(w) {
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
    ["LoRA", (w.loras || []).filter(Boolean).map((x) => String(x).split(/[\\/]/).pop().replace(/\.safetensors$/i, "")).join("、") || "沒有"],
    ["收藏於", dateText(w.createdAt)],
  ];
  let sheet = null;
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
    try {
      await removeFromAlbum(w.id);
    } catch (err) {
      del.disabled = false;
      refuse(del);
      return toast(`拿不掉：${err.message}`);
    }
    sheet.close();
    works = works.filter((x) => x !== w);
    const node = $("album-grid").querySelector(`.album-tile[data-id="${CSS.escape(w.id)}"]`);
    leave(node, () => render());
    toast(`「${w.name}」拿出作品冊了`);
  });
  const body = el(
    "div",
    { class: "album-detail" },
    el(
      "a",
      { class: "album-big", href: full || "#", target: "_blank", rel: "noopener", style: w.width && w.height ? `aspect-ratio: ${w.width} / ${w.height}` : "" },
      full ? el("img", { src: full, alt: w.name }) : el("span", { class: "album-noimg" }, "沒有圖")
    ),
    el(
      "div",
      { class: "album-info" },
      el("dl", { class: "album-facts" }, facts.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)])),
      mine.length ? el("section", {}, el("h3", {}, `你選的牌・${mine.length}`), chips(mine, "mine", weightsOfPositive(w.positive))) : null,
      rest.length ? el("section", {}, el("h3", {}, `${mine.length ? "引擎補的" : "這張用到的牌"}・${rest.length}`), chips(rest, "drawn")) : null,
      el("details", { class: "album-pos" }, el("summary", {}, "提示詞"), el("pre", { class: "pos-text" }, w.positive || "")),
      similarBox(w, () => sheet)
    )
  );
  const s = openSheet(w.name, body, {
    translateTitle: false,
    wide: true,
    foot: [
      mine.length
        ? el("button", { class: "btn btn-small btn-primary", type: "button", onclick: () => toMochi(mine, `你選的 ${mine.length} 張`, w) }, "你選的牌帶回墨池")
        : null,
      all.length
        ? el("button", { class: `btn btn-small${mine.length ? "" : " btn-primary"}`, type: "button", onclick: () => toMochi(all, `全部 ${all.length} 張`, w) }, "全部的牌帶回墨池")
        : null,
      el(
        "button",
        {
          class: "btn btn-small",
          type: "button",
          onclick: async (e) => {
            const b = e.currentTarget;
            try {
              await navigator.clipboard.writeText(w.positive || "");
              b.textContent = "已複製";
              setTimeout(() => (b.textContent = "複製 POS"), 1400);
            } catch {
              refuse(b);
            }
          },
        },
        "複製 POS"
      ),
      del,
    ],
  });
  sheet = s;
  if (!reducedMotion()) {
    const img = body.querySelector(".album-big img");
    img?.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    [...body.querySelectorAll(".album-chip")].slice(0, 30).forEach((c, i) => enter(c, { delay: DUR.short + i * 14 }));
  }
  // 關掉時把 #編號 拿掉：重新整理不會又自己打開。
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

boot();
