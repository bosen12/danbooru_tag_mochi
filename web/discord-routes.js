/**
 * 墨池、疊印台的 Discord 分頻道：設定面板（web/discord.js）最上面那一塊。
 *
 * 每個頻道一個 webhook，照分級、角色（1～3 個）、tag（1～5 個）收圖；一張圖符合幾個頻道就送幾則，
 * 一個都沒對到的送面板下面那條（「其他」）。比對在伺服器做（server.py＋discord_routes.py），
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
const MAX = { chars: 3, tags: 5 };
const MAX_ROUTES = 20;

let getLib = () => null;
let zhOf = (t) => t;
let slot = null;
let status = null;
let editing = null;
let listSig = "";

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
    if (chars.length >= MAX.chars) break;
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

function blank() {
  return { id: "", name: "", webhookTail: "", ratings: new Set(), chars: [], charMode: "any", tags: [], tagMode: "any", compact: true, enabled: true };
}

function fromRoute(r) {
  return {
    id: r.id,
    name: r.name,
    webhookTail: r.webhookTail,
    ratings: new Set(r.ratings || []),
    chars: [...(r.chars || [])],
    charMode: r.charMode || "any",
    tags: [...(r.tags || [])],
    tagMode: r.tagMode || "any",
    compact: !!r.compact,
    enabled: r.enabled !== false,
  };
}

async function post(body) {
  const r = await fetch("/api/discord/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
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
  const sig = JSON.stringify(routes.map((r) => [r.id, r.name, r.ratings, r.chars, r.charMode, r.tags, r.tagMode, r.compact, r.enabled, r.paused]));
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
}

/** 條件摘要（「全年齡・約兒／胡蝶忍（任一）・精簡」）：一段段先翻好再接起來，整串不交給 i18n（接起來的整句它對不到）。 */
function summary(r) {
  const bits = [];
  bits.push(r.ratings?.length ? r.ratings.map((x) => t(RATINGS.find(([k]) => k === x)?.[1] || x)).join("／") : t("不限分級"));
  const names = (list, mode) => list.map(nameOf).join("／") + (list.length > 1 ? t(mode === "all" ? "（全部）" : "（任一）") : "");
  if (r.chars?.length) bits.push(names(r.chars, r.charMode));
  if (r.tags?.length) bits.push(names(r.tags, r.tagMode));
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
  const del = el(
    "button",
    {
      class: "ghost dcr-del",
      type: "button",
      onclick: async (e) => {
        const b = e.currentTarget;
        if (!armed) {
          b.textContent = "確定刪除？";
          b.dataset.armed = "true";
          armed = setTimeout(() => {
            armed = 0;
            b.textContent = "刪除";
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
  const toggle = el(
    "button",
    {
      class: "seg dcr-on",
      type: "button",
      role: "switch",
      "aria-checked": r.enabled ? "true" : "false",
      "aria-pressed": r.enabled ? "true" : "false",
      title: r.enabled ? "開著：照條件送" : "關著：這個頻道先不送",
      onclick: () => run(() => post({ route: { op: "save", ...payloadOf(fromRoute(r)), enabled: !r.enabled } })),
    },
    r.enabled ? "開" : "關"
  );
  return el(
    "li",
    { class: "dcr-row", dataset: { route: r.id, paused: r.paused ? "true" : "false", enabled: r.enabled ? "true" : "false" } },
    el(
      "div",
      { class: "dcr-main" },
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
      el(
        "button",
        {
          class: "ghost",
          type: "button",
          onclick: () => {
            editing = fromRoute(r);
            paint();
          },
        },
        "編輯"
      ),
      del
    )
  );
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

function payloadOf(e) {
  return {
    ...(e.id ? { id: e.id } : {}),
    name: e.name,
    ratings: [...e.ratings],
    chars: e.chars,
    charMode: e.charMode,
    tags: e.tags,
    tagMode: e.tagMode,
    compact: e.compact,
    enabled: e.enabled,
  };
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
            say("送出中…");
            try {
              const r = await fetch("/api/discord", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true, routeId: e.id }) });
              const j = await r.json();
              if (j && j.ok) say("送到了。去那個頻道看一下。", "ok");
              else say(String((j && j.error) || "Discord 沒收"), "err");
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

  const chars = picker({ key: "chars", label: "角色", modeKey: "charMode", only: (c) => c.suit === "chara", favs: true, onChange: () => sync() });
  // 角色有自己那一欄；tag 這欄不列角色牌（打「泳」先跳出一排泳裝角色，找不到泳裝本身）。
  const tags = picker({ key: "tags", label: "tag", modeKey: "tagMode", only: (c) => c.suit !== "chara", favs: false, onChange: () => sync() });

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
    const hasCond = e.ratings.size || e.chars.length || e.tags.length;
    const hasHook = e.id || hookIn.value.trim();
    const why = !e.name.trim() ? "要取個名字" : !hasHook ? "要貼上 webhook 網址" : !hasCond ? "至少設一種條件（分級、角色或 tag）" : "";
    save.disabled = !!why;
    need.textContent = why;
  }
  save.addEventListener("click", async () => {
    save.disabled = true;
    say("存檔中…");
    const done = await run(() => post({ route: { op: "save", ...payloadOf(e), webhook: hookIn.value.trim() } }));
    if (done) {
      editing = null;
      listSig = "";
      paint();
    } else {
      say(document.getElementById("dc-msg")?.textContent || "存不進去", "err");
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
    chars,
    tags,
    compact,
    el("div", { class: "tg-actions" }, save, cancel, need),
    msg
  );
}

/**
 * 角色／tag 的挑選：搜尋框（跟字盒同一套比對：中文、英文、作品名）、已選的小籤（點了拿掉）、
 * 「任一個／全部都要」（選兩個以上才出現）。角色另外列一排偏好角色。
 */
function picker({ key, label, modeKey, only, favs, onChange }) {
  const e = editing;
  const max = MAX[key];
  const chosen = el("div", { class: "dcr-chosen" });
  const results = el("ul", { class: "dcr-results", role: "listbox", "aria-label": `${label}搜尋結果` });
  const input = el("input", { type: "search", autocomplete: "off", placeholder: key === "chars" ? "找角色：芙莉蓮、frieren、作品名…" : "找 tag：泳裝、swimsuit…" });
  const full = el("em", { class: "dcr-full" });
  const modeAny = el("button", { class: "seg", type: "button" }, "任一個");
  const modeAll = el("button", { class: "seg", type: "button" }, "全部都要");
  const mode = el("div", { class: "row dcr-mode", role: "group", "aria-label": `${label}的比對方式` }, modeAny, modeAll);
  modeAny.addEventListener("click", () => ((e[modeKey] = "any"), paintMode()));
  modeAll.addEventListener("click", () => ((e[modeKey] = "all"), paintMode()));
  const favRow = favs ? el("div", { class: "dcr-favs" }) : null;

  const add = (tag) => {
    if (e[key].includes(tag) || e[key].length >= max) return;
    e[key].push(tag);
    input.value = "";
    paintAll();
    onChange();
    input.focus({ preventScroll: true });
  };
  const drop = (tag) => {
    e[key] = e[key].filter((t) => t !== tag);
    paintAll();
    onChange();
  };
  function paintMode() {
    mode.hidden = e[key].length < 2;
    modeAny.setAttribute("aria-pressed", e[modeKey] !== "all" ? "true" : "false");
    modeAll.setAttribute("aria-pressed", e[modeKey] === "all" ? "true" : "false");
  }
  function paintResults() {
    const q = input.value.trim().toLowerCase();
    const lib = getLib();
    results.replaceChildren();
    if (!q || !lib) return;
    // 一樣的排最前、開頭一樣的其次、包含的再其次（作品名對到的角色最後）；同一級照牌庫順序。
    const rank = (c) => {
      const zh = c.zh.toLowerCase();
      if (zh === q || c.tag === q) return 0;
      if (zh.startsWith(q) || c.tag.startsWith(q)) return 1;
      if (zh.includes(q) || c.tag.includes(q)) return 2;
      return 3;
    };
    const pool = [];
    for (const c of lib.cards) {
      if (!only(c) || e[key].includes(c.tag) || !cardMatches(c, q)) continue;
      pool.push([rank(c), pool.length, c]);
      if (pool.length >= 400) break;
    }
    const hits = pool.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 8).map((x) => x[2]);
    if (!hits.length) {
      results.append(el("li", { class: "dcr-none" }, "找不到"));
      return;
    }
    for (const c of hits) {
      results.append(
        el(
          "li",
          {},
          el(
            "button",
            { class: "dcr-hit", type: "button", role: "option", onclick: () => add(c.tag) },
            el("strong", { dataset: { noI18n: "" } }, nameOf(c.tag)),
            el("small", { dataset: { noI18n: "" } }, c.tag)
          )
        )
      );
    }
  }
  function paintAll() {
    chosen.replaceChildren(
      ...e[key].map((tag) =>
        el(
          "button",
          { class: "dcr-chip", type: "button", title: "拿掉", "aria-label": `拿掉 ${nameOf(tag)}`, onclick: () => drop(tag) },
          el("span", { dataset: { noI18n: "" } }, nameOf(tag)),
          el("b", { "aria-hidden": "true" }, "×")
        )
      )
    );
    const isFull = e[key].length >= max;
    input.disabled = isFull;
    full.textContent = isFull ? `最多 ${max} 個` : "";
    if (isFull) results.replaceChildren();
    else paintResults();
    if (favRow) {
      const lib = getLib();
      const list = favChars.list().filter((t) => lib?.byTag.has(t) && !e[key].includes(t)).slice(0, 12);
      favRow.hidden = !list.length || isFull;
      favRow.replaceChildren(
        el("span", { class: "dcr-favs-label" }, "偏好角色"),
        ...list.map((t) => el("button", { class: "dcr-chip is-fav", type: "button", onclick: () => add(t) }, el("span", { dataset: { noI18n: "" } }, nameOf(t)), el("b", { "aria-hidden": "true" }, "＋")))
      );
    }
    paintMode();
  }
  input.addEventListener("input", paintResults);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      results.querySelector(".dcr-hit")?.click();
    }
  });
  paintAll();
  return el("div", { class: "tg-field dcr-pick", dataset: { pick: key } }, el("span", {}, `${label}（最多 ${max} 個）`), chosen, input, full, results, favRow, mode);
}
