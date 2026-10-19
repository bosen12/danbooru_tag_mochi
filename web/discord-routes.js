/**
 * 墨池、疊印台的 Discord 分頻道：設定面板（web/discord.js）最上面那一塊。
 *
 * 每個頻道一個 webhook，照分級、角色或整個系列（合起來 1～3 個）、tag（1～5 個）收圖；一張圖符合幾個頻道
 * 就送幾則，一個都沒對到的送面板下面那條（「其他」）。比對在伺服器做（server.py＋discord_routes.py），
 * 這裡只管清單和編輯畫面。網址是憑證：存檔後伺服器只回末四碼，這裡也不留。
 *
 * 清單每 3 秒跟著面板重畫一次（計數會變）：設定沒變就只換計數，不整塊重建 —— 不然焦點、
 * 滑鼠停著的按鈕每 3 秒被換掉一次。編輯中不動編輯畫面。
 */
import { el } from "./ui.js";
import { cardMatches } from "./cards.js";
import { favChars } from "./fav-chars.js";
import { english, t } from "./i18n.js";
import { parseWeighted } from "./engine.js";
import { onDcPanel, dcRefresh, openDiscordSettings } from "./discord.js";

const RATINGS = [
  ["general", "全年齡"],
  ["sensitive", "敏感"],
  ["explicit", "色情"],
];
// 角色那欄：單一角色和整個系列合起來最多 3 個（伺服器 discord_routes.MAX_CHARS）。
const MAX = { cast: 3, tags: 5 };
const MAX_ROUTES = 20;

let getLib = () => null;
let zhOf = (t) => t;
let slot = null;
let status = null;
let editing = null;
let listSig = "";
// 存好的那一列：清單畫好後捲過去、亮一下。
let justSaved = "";

/** 掛進 Discord 面板。lib：() => 這一頁的牌庫（buildLibrary 的結果）；zh：tag → 中文名。 */
export function mountDiscordRoutes({ lib, zh }) {
  getLib = lib;
  if (zh) zhOf = zh;
  onDcPanel((node, st) => {
    slot = node;
    status = st;
    paint();
  });
}

/** 成品詳情「用這張開 Discord 頻道」：打開面板、編輯畫面帶入這張的角色（照提示詞順序，最多 3 個）和分級。 */
export function openRouteFromShot(shot) {
  const lib = getLib();
  const chars = [];
  for (const part of String(shot?.positive || "").split(",")) {
    const tag = cleanTag(part);
    const card = lib?.byTag.get(tag);
    if (card && card.suit === "chara" && !chars.includes(tag)) chars.push(tag);
    if (chars.length >= MAX.cast) break;
  }
  editing = blank();
  editing.chars = chars;
  if (RATINGS.some(([r]) => r === shot?.rating)) editing.ratings = new Set([shot.rating]);
  editing.name = chars.length ? nameOf(chars[0]) : "";
  openDiscordSettings();
  paint();
}

function cleanTag(part) {
  return parseWeighted(part).tag.replace(/\\([()])/g, "$1").toLowerCase().replace(/_/g, " ").trim();
}

const nameOf = (tag) => (english ? tag : zhOf(tag));

/* ---------------- 系列 ----------------
 * 詞庫的角色牌都有 series（"spy x family"）和中文的分類名（groupZh「動漫・間諜家家酒」）。
 * 系列名取「・」後面那段；英文版直接用 series。 */
let seriesCache = null;
function seriesList() {
  const lib = getLib();
  if (!lib) return [];
  if (seriesCache && seriesCache.lib === lib) return seriesCache.list;
  const by = new Map();
  for (const c of lib.cards) {
    const key = c.suit === "chara" && c.item?.series ? String(c.item.series).toLowerCase() : "";
    if (!key) continue;
    const s = by.get(key) || { key, zh: String(c.groupZh || key).split("・").pop(), kind: String(c.groupZh || "").includes("・") ? String(c.groupZh).split("・")[0] : "", chars: [] };
    s.chars.push(c.tag);
    by.set(key, s);
  }
  seriesCache = { lib, list: [...by.values()] };
  return seriesCache.list;
}
const seriesOf = (key) => seriesList().find((s) => s.key === key);
const seriesName = (key) => (english ? key : seriesOf(key)?.zh || key);
/** 一張角色牌屬於哪個系列（key）。 */
const seriesOfChar = (tag) => {
  const c = getLib()?.byTag.get(tag);
  return c?.item?.series ? String(c.item.series).toLowerCase() : "";
};

/* ---------------- 資料 ---------------- */

function blank() {
  return { id: "", name: "", webhookTail: "", ratings: new Set(), chars: [], series: [], charMode: "any", tags: [], tagMode: "any", compact: true, enabled: true };
}

function fromRoute(r) {
  return {
    id: r.id,
    name: r.name,
    webhookTail: r.webhookTail,
    ratings: new Set(r.ratings || []),
    chars: [...(r.chars || [])],
    series: [...(r.series || [])],
    charMode: r.charMode || "any",
    tags: [...(r.tags || [])],
    tagMode: r.tagMode || "any",
    compact: !!r.compact,
    enabled: r.enabled !== false,
  };
}

function payloadOf(e) {
  return {
    ...(e.id ? { id: e.id } : {}),
    name: e.name,
    ratings: [...e.ratings],
    chars: e.chars,
    series: e.series,
    charMode: e.charMode,
    tags: e.tags,
    tagMode: e.tagMode,
    compact: e.compact,
    enabled: e.enabled,
  };
}

async function post(body) {
  const r = await fetch("/api/discord/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

/** 存一下、刷新面板；錯誤顯示在面板底下那行（tg-msg）。 */
async function run(fn) {
  try {
    const j = await fn();
    if (!j || !j.ok) throw new Error((j && j.error) || "存不進去");
    await dcRefresh();
    return true;
  } catch (err) {
    const msg = document.getElementById("dc-msg");
    if (msg) {
      msg.textContent = String(err.message || err);
      msg.dataset.kind = "err";
    }
    return false;
  }
}

/* ---------------- 清單 ---------------- */

function paint() {
  if (!slot) return;
  slot.hidden = false;
  slot.classList.add("dcr");
  if (editing) {
    if (!slot.querySelector(".dcr-editor")) {
      slot.replaceChildren(editor());
      listSig = "";
      slot.querySelector(".dcr-editor input")?.focus({ preventScroll: true });
    }
    return;
  }
  const routes = status?.routes || [];
  const sig = JSON.stringify(routes.map((r) => [r.id, r.name, r.ratings, r.chars, r.series, r.charMode, r.tags, r.tagMode, r.compact, r.enabled, r.paused]));
  if (sig !== listSig || !slot.querySelector(".dcr-list")) {
    slot.replaceChildren(list(routes));
    listSig = sig;
  }
  for (const r of routes) {
    const n = slot.querySelector(`[data-route="${CSS.escape(r.id)}"] .dcr-count`);
    if (!n) continue;
    // 每 3 秒直接換字：要自己先翻（el() 建的時候會翻，之後改 textContent 不會）。
    n.textContent = t(`已送 ${r.sent || 0}・失敗 ${r.failed || 0}`);
    n.title = r.lastError || "";
  }
  if (justSaved) {
    const row = slot.querySelector(`[data-route="${CSS.escape(justSaved)}"]`);
    justSaved = "";
    if (row) {
      row.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      row.classList.add("is-saved");
      setTimeout(() => row.classList.remove("is-saved"), 1400);
    }
  }
}

/** 條件摘要（「全年齡・約兒／《間諜家家酒》（任一）・精簡」）：一段段先翻好再接起來，整串不交給 i18n（接起來的整句它對不到）。 */
function summary(r) {
  const bits = [];
  bits.push(r.ratings?.length ? r.ratings.map((x) => t(RATINGS.find(([k]) => k === x)?.[1] || x)).join("／") : t("不限分級"));
  const join = (names, mode) => names.join("／") + (names.length > 1 ? t(mode === "all" ? "（全部）" : "（任一）") : "");
  const cast = [...(r.chars || []).map(nameOf), ...(r.series || []).map((s) => `《${seriesName(s)}》`)];
  if (cast.length) bits.push(join(cast, r.charMode));
  if (r.tags?.length) bits.push(join(r.tags.map(nameOf), r.tagMode));
  bits.push(t(r.compact ? "精簡" : "完整"));
  return bits.join(english ? " · " : "・");
}

function list(routes) {
  const add = el(
    "button",
    {
      class: "ghost dcr-add",
      type: "button",
      disabled: routes.length >= MAX_ROUTES,
      title: routes.length >= MAX_ROUTES ? `頻道最多 ${MAX_ROUTES} 個` : undefined,
      onclick: () => {
        editing = blank();
        paint();
      },
    },
    "＋ 新增頻道"
  );
  return el(
    "section",
    { class: "dcr-list", "aria-labelledby": "dcr-title" },
    el("div", { class: "dcr-head" }, el("h3", { id: "dcr-title" }, "分頻道"), add),
    el("p", { class: "dcr-note" }, "照分級、角色、tag 把圖分到不同頻道，一張圖符合幾個就送幾個。一個都沒對到的，送下面「其他」那條（可以不設）。"),
    routes.length ? el("ul", { class: "dcr-rows" }, routes.map(row)) : el("p", { class: "dcr-empty" }, "還沒有頻道。"),
    el("h3", { class: "dcr-other" }, "其他：沒對到任何頻道的圖")
  );
}

function row(r) {
  let armed = 0;
  const edit = () => {
    editing = fromRoute(r);
    paint();
  };
  const del = el(
    "button",
    {
      class: "ghost dcr-del",
      type: "button",
      onclick: async (e) => {
        const b = e.currentTarget;
        if (!armed) {
          b.textContent = t("確定刪除？");
          b.dataset.armed = "true";
          armed = setTimeout(() => {
            armed = 0;
            b.textContent = t("刪除");
            delete b.dataset.armed;
          }, 3000);
          return;
        }
        clearTimeout(armed);
        await run(() => post({ route: { op: "delete", id: r.id } }));
      },
    },
    "刪除"
  );
  // 開關：一眼看得出開著還是關著（以前是一顆寫著「開」的按鈕，看不出是狀態還是動作）。
  const toggle = el(
    "button",
    {
      class: "dcr-switch",
      type: "button",
      role: "switch",
      "aria-checked": r.enabled ? "true" : "false",
      "aria-label": `${r.name}：${r.enabled ? "開著" : "關著"}`,
      title: r.enabled ? "開著：照條件送" : "關著：這個頻道先不送",
      onclick: () => run(() => post({ route: { op: "save", ...payloadOf(fromRoute(r)), enabled: !r.enabled } })),
    },
    el("span", { class: "dcr-knob", "aria-hidden": "true" }),
    el("span", { class: "dcr-switch-text" }, r.enabled ? "開著" : "關著")
  );
  return el(
    "li",
    { class: "dcr-row", dataset: { route: r.id, paused: r.paused ? "true" : "false", enabled: r.enabled ? "true" : "false" } },
    // 名稱和摘要整塊都可以點：點了就編輯（比找那顆小小的「編輯」好按）。
    el(
      "button",
      { class: "dcr-main", type: "button", title: "編輯", onclick: edit },
      el("strong", { class: "dcr-name", dataset: { noI18n: "" } }, r.name),
      el("span", { class: "dcr-sum", dataset: { noI18n: "" } }, summary(r)),
      el("span", { class: "dcr-count", title: r.lastError || undefined }, `已送 ${r.sent || 0}・失敗 ${r.failed || 0}`),
      r.paused ? el("span", { class: "dcr-paused" }, "暫停：連續送不出去") : null
    ),
    el(
      "div",
      { class: "dcr-acts" },
      r.paused ? el("button", { class: "ghost", type: "button", onclick: () => run(() => post({ route: { op: "resume", id: r.id } })) }, "恢復") : null,
      toggle,
      el("button", { class: "ghost", type: "button", onclick: edit }, "編輯"),
      del
    )
  );
}

/* ---------------- 編輯 ---------------- */

function editor() {
  const e = editing;
  const msg = el("p", { class: "tg-msg dcr-msg", role: "status" });
  const say = (text, kind = "") => {
    msg.textContent = text;
    msg.dataset.kind = kind;
  };
  const nameIn = el("input", { type: "text", maxlength: "40", autocomplete: "off", placeholder: "例如：芙莉蓮、全年齡收藏" });
  nameIn.value = e.name;
  nameIn.addEventListener("input", () => {
    e.name = nameIn.value;
    sync();
  });
  const hookIn = el("input", {
    type: "password",
    autocomplete: "off",
    spellcheck: "false",
    placeholder: e.webhookTail ? `已存 · ${e.webhookTail}` : "https://discord.com/api/webhooks/…",
  });
  hookIn.addEventListener("input", sync);
  const testBtn = e.id
    ? el(
        "button",
        {
          class: "ghost",
          type: "button",
          onclick: async () => {
            say(t("送出中…"));
            try {
              const r = await fetch("/api/discord", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true, routeId: e.id }) });
              const j = await r.json();
              if (j && j.ok) say(t("送到了。去那個頻道看一下。"), "ok");
              else say(String((j && j.error) || t("Discord 沒收")), "err");
            } catch (err) {
              say(String(err.message || err), "err");
            }
          },
        },
        "送一則測試"
      )
    : null;

  const ratingBtns = RATINGS.map(([key, label]) => {
    const b = el("button", { class: "seg", type: "button", "aria-pressed": e.ratings.has(key) ? "true" : "false" }, label);
    b.addEventListener("click", () => {
      if (e.ratings.has(key)) e.ratings.delete(key);
      else e.ratings.add(key);
      b.setAttribute("aria-pressed", e.ratings.has(key) ? "true" : "false");
      sync();
    });
    return b;
  });

  const cast = castPicker(() => sync());
  const tags = tagPicker(() => sync());

  const compact = el(
    "button",
    { class: "same-switch tg-switch", type: "button", role: "switch", "aria-checked": e.compact ? "true" : "false" },
    el("span", { class: "same-knob", "aria-hidden": "true" }, el("i")),
    el("span", { class: "same-copy" }, el("strong", {}, "精簡"), el("em", {}, "只送圖和一行小字；關掉會多送中文標籤分欄和英文提示詞（方便重現）"))
  );
  compact.classList.toggle("is-on", e.compact);
  compact.addEventListener("click", () => {
    e.compact = !e.compact;
    compact.classList.toggle("is-on", e.compact);
    compact.setAttribute("aria-checked", e.compact ? "true" : "false");
  });

  const save = el("button", { class: "primary", type: "button" }, el("span", {}, e.id ? "存頻道" : "新增頻道"));
  const need = el("em", { class: "dcr-need" });
  function sync() {
    const hasCond = e.ratings.size || e.chars.length || e.series.length || e.tags.length;
    const hasHook = e.id || hookIn.value.trim();
    const why = !e.name.trim() ? "要取個名字" : !hasHook ? "要貼上 webhook 網址" : !hasCond ? "至少設一種條件（分級、角色或 tag）" : "";
    save.disabled = !!why;
    need.textContent = t(why);
  }
  save.addEventListener("click", async () => {
    save.disabled = true;
    say(t("存檔中…"));
    const before = new Set((status?.routes || []).map((r) => r.id));
    const done = await run(() => post({ route: { op: "save", ...payloadOf(e), webhook: hookIn.value.trim() } }));
    if (done) {
      justSaved = e.id || (status?.routes || []).find((r) => !before.has(r.id))?.id || "";
      editing = null;
      listSig = "";
      paint();
    } else {
      say(document.getElementById("dc-msg")?.textContent || t("存不進去"), "err");
      sync();
    }
  });
  const cancel = el(
    "button",
    {
      class: "ghost",
      type: "button",
      onclick: () => {
        editing = null;
        listSig = "";
        paint();
      },
    },
    "取消"
  );
  sync();

  return el(
    "section",
    { class: "dcr-editor", "aria-labelledby": "dcr-edit-title" },
    el("h3", { id: "dcr-edit-title" }, e.id ? "編輯頻道" : "新增頻道"),
    el("label", { class: "tg-field" }, el("span", {}, "名稱"), nameIn),
    el(
      "label",
      { class: "tg-field" },
      el("span", {}, "Webhook 網址"),
      hookIn,
      el("em", {}, "Discord 頻道設定 → 整合 → 建立 Webhook → 複製網址。存在伺服器、不進 git、不會回傳瀏覽器。", e.id ? "留空＝沿用已存的。" : "")
    ),
    testBtn ? el("div", { class: "dcr-test" }, testBtn) : null,
    el("div", { class: "tg-field" }, el("span", {}, "分級（不勾＝不限）"), el("div", { class: "row", role: "group", "aria-label": "分級" }, ratingBtns)),
    cast,
    tags,
    compact,
    // 存檔那排黏在面板底下：條件一多編輯畫面很長，不必捲到最底才找得到。
    el("div", { class: "tg-actions dcr-bar" }, save, cancel, need),
    msg
  );
}

/* ---------------- 挑角色／系列、挑 tag ---------------- */

/**
 * 搜尋框＋結果清單＋已選的小籤＋「任一個／全部都要」（選兩個以上才出現）。
 * items() 是已選的、hits(q) 是搜尋結果（[{key, label, sub, kind}]）、add／drop 改資料。
 * 結果可以用 ↑↓ 選、Enter 加入、Esc 清掉搜尋（再按一次才關面板）。
 */
function searchBox({ label, max, placeholder, items, hits, add, drop, modeKey, extra, onChange }) {
  const e = editing;
  const chosen = el("div", { class: "dcr-chosen" });
  const results = el("ul", { class: "dcr-results", role: "listbox", "aria-label": `${label}搜尋結果` });
  const input = el("input", { type: "search", autocomplete: "off", placeholder, role: "combobox", "aria-expanded": "false", "aria-autocomplete": "list" });
  const full = el("em", { class: "dcr-full" });
  const modeAny = el("button", { class: "seg", type: "button" }, "任一個");
  const modeAll = el("button", { class: "seg", type: "button" }, "全部都要");
  const mode = el("div", { class: "row dcr-mode", role: "group", "aria-label": `${label}的比對方式` }, modeAny, modeAll);
  modeAny.addEventListener("click", () => ((e[modeKey] = "any"), paintMode()));
  modeAll.addEventListener("click", () => ((e[modeKey] = "all"), paintMode()));
  const extraRow = el("div", { class: "dcr-favs" });
  let found = [];
  let active = 0;

  function paintMode() {
    mode.hidden = items().length < 2;
    modeAny.setAttribute("aria-pressed", e[modeKey] !== "all" ? "true" : "false");
    modeAll.setAttribute("aria-pressed", e[modeKey] === "all" ? "true" : "false");
  }
  function paintActive() {
    [...results.querySelectorAll(".dcr-hit")].forEach((b, i) => {
      b.classList.toggle("is-active", i === active);
      b.setAttribute("aria-selected", i === active ? "true" : "false");
    });
  }
  function paintResults() {
    const q = input.value.trim().toLowerCase();
    results.replaceChildren();
    found = q ? hits(q) : [];
    active = 0;
    input.setAttribute("aria-expanded", q ? "true" : "false");
    if (!q) return;
    if (!found.length) {
      results.append(el("li", { class: "dcr-none" }, "找不到"));
      return;
    }
    found.forEach((h, i) => {
      const b = el(
        "button",
        { class: "dcr-hit", type: "button", role: "option", tabindex: "-1", dataset: { kind: h.kind }, onclick: () => pick(h) },
        el("strong", { dataset: { noI18n: "" } }, h.label),
        el("small", { dataset: { noI18n: "" } }, h.sub)
      );
      // 只有滑鼠真的動了才換選中的那一筆：結果清單剛冒出來正好在停著的游標底下時，瀏覽器也會發 pointerenter，
      // 選中的那筆被換掉、按 Enter 加到的就不是剛才打的那個（實際碰到過：打「間諜」加成了洛伊德）。
      b.addEventListener("pointermove", () => {
        if (active === i) return;
        active = i;
        paintActive();
      });
      results.append(el("li", {}, b));
    });
    paintActive();
  }
  function pick(h) {
    add(h);
    input.value = "";
    paintAll();
    onChange();
    if (!input.disabled) input.focus({ preventScroll: true });
  }
  function paintAll() {
    chosen.replaceChildren(
      ...items().map((it) =>
        el(
          "button",
          { class: "dcr-chip" + (it.kind === "series" ? " is-series" : ""), type: "button", title: "拿掉", "aria-label": `拿掉 ${it.label}`, onclick: () => (drop(it), paintAll(), onChange()) },
          el("span", { dataset: { noI18n: "" } }, it.label),
          el("b", { "aria-hidden": "true" }, "×")
        )
      )
    );
    const isFull = items().length >= max;
    input.disabled = isFull;
    full.textContent = isFull ? t(`最多 ${max} 個`) : "";
    if (isFull) results.replaceChildren();
    else paintResults();
    const more = isFull ? [] : extra?.() || [];
    extraRow.hidden = !more.length;
    extraRow.replaceChildren(...more.map((x) => (x.label ? el("button", { class: "dcr-chip is-fav" + (x.kind === "series" ? " is-series" : ""), type: "button", onclick: () => pick(x) }, el("span", { dataset: { noI18n: "" } }, x.label), el("b", { "aria-hidden": "true" }, "＋")) : el("span", { class: "dcr-favs-label" }, x.title))));
    paintMode();
  }
  input.addEventListener("input", paintResults);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!found.length) return;
      ev.preventDefault();
      active = (active + (ev.key === "ArrowDown" ? 1 : found.length - 1)) % found.length;
      paintActive();
      results.querySelectorAll(".dcr-hit")[active]?.scrollIntoView({ block: "nearest" });
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (found[active]) pick(found[active]);
    } else if (ev.key === "Escape" && input.value) {
      // 有字時 Esc 只清掉搜尋；沒字才讓它往上傳、關面板。
      ev.preventDefault();
      ev.stopPropagation();
      input.value = "";
      paintResults();
    }
  });
  paintAll();
  return { node: [chosen, input, full, results, extraRow, mode], repaint: paintAll };
}

/** 角色或整個系列（合起來最多 3 個）：搜尋先列對到的系列，再列角色；偏好角色、已選角色的系列列在下面一點就加。 */
function castPicker(onChange) {
  const e = editing;
  const items = () => [
    ...e.chars.map((tag) => ({ kind: "char", key: tag, label: nameOf(tag) })),
    ...e.series.map((key) => ({ kind: "series", key, label: `《${seriesName(key)}》` })),
  ];
  const hits = (q) => {
    const lib = getLib();
    if (!lib) return [];
    const out = [];
    for (const s of seriesList()) {
      if (e.series.includes(s.key)) continue;
      if (s.zh.toLowerCase().includes(q) || s.key.includes(q)) out.push({ kind: "series", key: s.key, label: `《${seriesName(s.key)}》`, sub: t(`整個系列・${s.chars.length} 位角色`), rank: s.zh.toLowerCase().startsWith(q) || s.key.startsWith(q) ? 0 : 1 });
    }
    out.sort((a, b) => a.rank - b.rank);
    const series = out.slice(0, 3);
    const chars = rankCards(lib, q, (c) => c.suit === "chara" && !e.chars.includes(c.tag), 8 - series.length).map((c) => ({ kind: "char", key: c.tag, label: nameOf(c.tag), sub: c.item?.series ? `《${seriesName(String(c.item.series).toLowerCase())}》` : c.tag }));
    return [...series, ...chars];
  };
  const add = (h) => {
    if (items().length >= MAX.cast) return;
    if (h.kind === "series") !e.series.includes(h.key) && e.series.push(h.key);
    else !e.chars.includes(h.key) && e.chars.push(h.key);
  };
  const drop = (it) => {
    if (it.kind === "series") e.series = e.series.filter((x) => x !== it.key);
    else e.chars = e.chars.filter((x) => x !== it.key);
  };
  // 下面一排：已選角色的系列（「＋《間諜家家酒》」直接改收整個系列），再來是偏好角色。
  const extra = () => {
    const lib = getLib();
    const out = [];
    const suggest = [...new Set(e.chars.map(seriesOfChar).filter((s) => s && !e.series.includes(s)))];
    if (suggest.length) {
      out.push({ title: t("也收整個系列") });
      for (const key of suggest) out.push({ kind: "series", key, label: `《${seriesName(key)}》` });
    }
    const favs = favChars.list().filter((tag) => lib?.byTag.has(tag) && !e.chars.includes(tag)).slice(0, 10);
    if (favs.length) {
      out.push({ title: t("偏好角色") });
      for (const tag of favs) out.push({ kind: "char", key: tag, label: nameOf(tag) });
    }
    return out;
  };
  const box = searchBox({ label: "角色", max: MAX.cast, placeholder: "找角色或系列：約兒、yor、間諜家家酒…", items, hits, add, drop, modeKey: "charMode", extra, onChange });
  return el("div", { class: "tg-field dcr-pick", dataset: { pick: "chars" } }, el("span", {}, "角色或系列（合起來最多 3 個）"), box.node);
}

/** tag（最多 5 個）：不列角色牌（角色有自己那一欄；打「泳」先跳出一排泳裝角色，找不到泳裝本身）。 */
function tagPicker(onChange) {
  const e = editing;
  const items = () => e.tags.map((tag) => ({ kind: "tag", key: tag, label: nameOf(tag) }));
  const hits = (q) => {
    const lib = getLib();
    if (!lib) return [];
    return rankCards(lib, q, (c) => c.suit !== "chara" && !e.tags.includes(c.tag), 8).map((c) => ({ kind: "tag", key: c.tag, label: nameOf(c.tag), sub: english ? c.tag : `${c.groupZh || ""}・${c.tag}` }));
  };
  const add = (h) => e.tags.length < MAX.tags && !e.tags.includes(h.key) && e.tags.push(h.key);
  const drop = (it) => (e.tags = e.tags.filter((x) => x !== it.key));
  const box = searchBox({ label: "tag", max: MAX.tags, placeholder: "找 tag：泳裝、swimsuit…", items, hits, add, drop, modeKey: "tagMode", onChange });
  return el("div", { class: "tg-field dcr-pick", dataset: { pick: "tags" } }, el("span", {}, "tag（最多 5 個）"), box.node);
}

/** 對得上的牌，一樣的排最前、開頭一樣的其次、包含的再其次（作品名對到的角色最後）；同一級照牌庫順序。 */
function rankCards(lib, q, only, n) {
  const rank = (c) => {
    const zh = c.zh.toLowerCase();
    if (zh === q || c.tag === q) return 0;
    if (zh.startsWith(q) || c.tag.startsWith(q)) return 1;
    if (zh.includes(q) || c.tag.includes(q)) return 2;
    return 3;
  };
  const pool = [];
  for (const c of lib.cards) {
    if (!only(c) || !cardMatches(c, q)) continue;
    pool.push([rank(c), pool.length, c]);
    if (pool.length >= 400) break;
  }
  return pool.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, Math.max(0, n)).map((x) => x[2]);
}
