/**
 * 墨池 AI 助手（實驗功能）：聊天室、設定、操作明細、工作台高亮。設計稿：MOCHI_AI_ASSISTANT_DISCUSSION.md。
 *
 * 三塊分工（.council/assistant/CONTRACT.md）：
 *   - 伺服器（assistant.py、/api/assistant/*）：偵測 CLI、存連線設定、代送模型請求（SSE）。
 *   - 工具層（assistant-tools.js、assistant-prompt.js）：工具定義、驗證、守門、執行（透過 ctx）。
 *   - 這裡：頂欄三個入口、設定視窗、聊天面板、對話迴圈（模型 → 工具 → 結果接回去 → 模型）、
 *     每一步的狀態與明細、需要確認的卡片、工作台上跟著操作走的光暈。
 *
 * 開關在設定視窗裡（lab.js：「？」快捷鍵說明、月亮螢幕保護設定），預設關，存在這台（mochi.assistant.v1）。
 * 關著：頂欄、合成池、字盒一顆鈕都不多，不連任何 /api/assistant 網址 —— 跟沒有這個功能時一模一樣。
 * 打開：頂欄多一顆朱色小印章（聊天室；跟其他工具一樣 36px，1280 寬以上頂欄照樣一行），字盒、合成池標題多一顆「問助理」。
 *   設定收在聊天室面板右上角的齒輪；還沒選連線就送訊息，會直接帶去設定。
 *   聊天室收起時，助手的進度畫在印章上的小光點：做事時呼吸、等你確認時亮黃、完成閃綠、失敗朱紅；字放在滑鼠提示和讀屏。
 * 關掉：這些拿掉、聊天室收起、正在跑的請求停掉、還沒執行的操作取消（已經抽出來的成品、已經加進池子的牌照留）。
 *
 * 對話只存在這個分頁（sessionStorage）：重新整理接得回來，關掉分頁就沒了（設計稿 §5）。
 * 模型的回覆、牌名一律不翻譯（data-no-i18n）；介面上的字照 i18n.js 畫完再翻。
 */
import { el, openSheet, toast, friendlyError } from "./ui.js";
import { reducedMotion, DUR, CURVE, css, travelTime } from "./motion.js";
import { english, t } from "./i18n.js";
import { registerLab } from "./lab.js";

// 畫面上的句子模板：i18n 畫完整句比對，數字和使用者內容用 {0}。
const fill = (tpl, ...args) => String(tpl).replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
import { openSettings as openSettingsSheet, swapText, labelOf } from "./assistant-settings.js";
import { openFound, closeFound } from "./assistant-found.js";
import {
  bindReferenceDrop, findReferences, referenceFromAlbum, referenceInfo, referenceSourceLabel,
  REFERENCE_PREFIX, traceReference, watchShotReferences,
} from "./assistant-reference.js";

const STORE_KEY = "mochi.assistant.v1";
const CHAT_KEY = "mochi.assistant.chat.v1";
const MAX_HOPS = 12; // 一輪最多幾次工具往返：模型繞圈時停下來，不要一直燒額度
// 模型（推理強度低的 CLI 最常見）偶爾回「目前沒有可呼叫的墨池工具」就停下，其實工具一直都在。
// 這種回覆又沒叫任何工具時：收回那句、提醒一次再問（一輪最多一次）。2026-11-20 專案主貼的對話：「你直接去服裝找」→「目前沒有可呼叫的墨池工具」。
export const NO_TOOLS_RE = /(沒有|無)[^。\n]{0,10}工具|工具[^。\n]{0,8}(不能用|無法使用|不可用|用不了)|no (available )?(mochi )?tools|(can'?t|cannot) (call|use) (any )?(the )?tools/i;
const TOOL_NUDGE = "［提醒］墨池的工具一直都能用（就是這次給你的工具清單）。請直接呼叫工具完成我上一個要求，不要說沒有工具。";
const SECTION_ZH = { subject: "人數", feature: "長相", clothing: "服裝", pose: "姿勢", env: "場景" };

const ICON = {
  gear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  fresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  seal: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M7 8.5c1.6-2 3.4-3 5-3s3.4 1 5 3M6 13c2 2.6 4 4 6 4s4-1.4 6-4"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
};

/* ================= 存在這台的開關 ================= */

function readPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return { enabled: v.enabled === true, open: v.open === true };
  } catch {
    return { enabled: false, open: false };
  }
}
function writePrefs(p) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* 無痕、空間滿：這一頁照樣用 */
  }
}

/* ================= 伺服器 ================= */

async function api(path, body) {
  const r = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 404 && !j.code) throw Object.assign(new Error("墨池伺服器還沒有 AI 助手：請把墨池伺服器的視窗關掉再重開"), { code: "missing" });
  if (!r.ok || j.ok === false) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { code: j.code || "http", status: r.status });
  return j;
}

/** 讀 /api/assistant/chat 的串流：每收到一個事件叫 on(event, data)。 */
async function streamChat(body, signal, on) {
  const r = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && !j.code) throw Object.assign(new Error("墨池伺服器還沒有 AI 助手：請把墨池伺服器的視窗關掉再重開"), { code: "missing" });
    throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { code: j.code || "http" });
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let ended = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      // 伺服器每一次都以 done 或 error 收尾：沒收到就是連線中途斷了，半截的回覆不能當完整的、工具也不能照做。
      if (!ended) throw Object.assign(new Error("跟墨池伺服器的連線中途斷了，這一段可能不完整。請再送一次。"), { code: "eof" });
      break;
    }
    buf += dec.decode(value, { stream: true });
    let cut;
    while ((cut = buf.search(/\r?\n\r?\n/)) >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      let data = "";
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      let parsed = null;
      try {
        parsed = data ? JSON.parse(data) : null;
      } catch {
        continue;
      }
      if (event === "done" || event === "error") ended = true;
      on(event, parsed || {});
    }
  }
}


/* ================= 工作台光暈 ================= */

/**
 * 跟著真正在動的地方走的光暈（設計稿 §11）：讀的時候淡淡一圈，寫的時候亮一圈＋一行字，好了打勾淡出。
 * 一個浮在最上層、不擋滑鼠的框，量目標的位置疊上去；捲動、縮放時跟著。減少動態：只有靜態描邊。
 */
function createHalo() {
  // 第一次要亮才放進頁面：實驗功能關著時頁面上一個多的節點都沒有。
  let ring = null;
  const make = () => {
    if (ring) return ring;
    ring = el("div", { class: "ai-halo", "aria-hidden": "true", hidden: true }, el("span", { class: "ai-halo-label" }));
    document.body.append(ring);
    addEventListener("scroll", place, { passive: true, capture: true });
    addEventListener("resize", place, { passive: true });
    return ring;
  };
  let target = null;
  let fadeT = 0;
  const place = () => {
    if (!ring || !target || !target.isConnected) return;
    const r = target.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const pad = 6;
    ring.style.left = `${r.left - pad}px`;
    ring.style.top = `${r.top - pad}px`;
    ring.style.width = `${r.width + pad * 2}px`;
    ring.style.height = `${r.height + pad * 2}px`;
    ring.dataset.below = r.top < 64 ? "true" : "false";
  };
  return {
    show(node, phase, label) {
      clearTimeout(fadeT);
      if (!node) return this.clear();
      make();
      target = node;
      ring.hidden = false;
      ring.dataset.phase = phase;
      ring.querySelector(".ai-halo-label").textContent = label || "";
      ring.querySelector(".ai-halo-label").hidden = !label;
      place();
      if (phase === "done") fadeT = setTimeout(() => this.clear(), reducedMotion() ? 1000 : 1200);
    },
    clear() {
      clearTimeout(fadeT);
      if (!ring) return;
      ring.dataset.phase = "out";
      fadeT = setTimeout(() => {
        ring.hidden = true;
        target = null;
      }, reducedMotion() ? 0 : DUR.medium);
    },
  };
}

const GONE = Symbol("gone"); // 那張成品已經從牆上拿掉了

/** 工具回的 target（area＋key）→ 畫面上的那一塊。找不到回 null（不亮，不報錯）；指名的成品不在了回 GONE。 */
function nodeFor(target) {
  if (!target) return null;
  const { area, key } = target;
  const q = (s) => document.querySelector(s);
  const visibleNode = (n) => (n && n.getClientRects().length ? n : null);
  if (area === "lib") return visibleNode(q("#library")) || visibleNode(q("#lib-grid"));
  if (area === "pool") return visibleNode(q("#pool-well"));
  // 成品：照這一步自己的那張（target.key 是 shot id）找。以前一律找牆上第一張，舊一輪的「看變更」會指到最新那輪。
  if (area === "wall") {
    if (key) {
      const shot = q(`#wall .shot[data-id="${CSS.escape(String(key))}"]`);
      return shot ? visibleNode(shot) || shot : GONE;
    }
    return visibleNode(q("#wall .shot")) || visibleNode(q("#wall-head"));
  }
  if (area === "groups") {
    const pill = key ? q(`.skel-row[data-section="${key}"] .gp-pill`) : q(".gp-pill");
    return visibleNode(pill) || visibleNode(q(".more-rules")) || visibleNode(q("#rules"));
  }
  if (area === "rules") {
    if (key === "n") return visibleNode(q("#go-bar .stepper")) || visibleNode(q("#go-bar"));
    if (key && SECTION_ZH[key]) {
      const row = q(`.skel-row[data-section="${key}"]`);
      return visibleNode(row?.querySelector(".stepper")) || visibleNode(row) || visibleNode(q(".more-rules"));
    }
    return visibleNode(q("#rules"));
  }
  return null;
}

/* ================= 文字小工具 ================= */

/** 模型的回覆：段落、清單、粗體（**…**）。不吃 HTML：全部當文字建節點。 */
function richText(text) {
  const box = el("div", { class: "ai-rich", dataset: { noI18n: "" } });
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  let list = null;
  const inline = (s) => {
    const out = [];
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    for (const p of parts) {
      if (!p) continue;
      if (/^\*\*[^*]+\*\*$/.test(p)) out.push(el("b", {}, p.slice(2, -2)));
      else if (/^`[^`]+`$/.test(p)) out.push(el("code", {}, p.slice(1, -1)));
      else out.push(p);
    }
    return out;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const item = line.match(/^\s*(?:[-*•]|\d+[.)、])\s+(.*)$/);
    if (item) {
      if (!list) box.append((list = el(/^\s*\d/.test(line) ? "ol" : "ul", {})));
      list.append(el("li", {}, ...inline(item[1])));
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    box.append(el("p", {}, ...inline(line)));
  }
  return box;
}

const STATUS_ZH = {
  thinking: "理解中",
  reading: "查詢中",
  working: "操作中",
  confirm: "等待確認",
  done: "操作完成",
  answered: "已回覆",
  partial: "部分完成",
  failed: "操作失敗",
  cancelled: "已取消",
  undone: "已復原",
  replied: "有新回覆",
};

/**
 * 一則助手回覆的整體結果：狀態列、收起時印章上的光點都看這一個（以前各算各的：步驟部分成功、頂部寫完成）。
 * 開著的確認卡 > 失敗／部分 > 全部復原了 > 有寫入 > 純回答。
 */
function outcomeOf(item) {
  if ((item.confirms || []).some((c) => c.state === "open" || c.state === "busy")) return { kind: "confirm", text: "" };
  const writes = (item.steps || []).filter((s) => s.kind !== "read");
  const st = (item.steps || []).map((s) => s.status);
  const bad = st.some((s) => s === "failed" || s === "stale");
  const good = st.includes("done") || st.includes("undone");
  const lastDone = writes.filter((s) => s.status === "done").at(-1);
  if (st.includes("partial") || (bad && good)) return { kind: "partial", text: lastDone?.summary || "" };
  if (bad) return { kind: "failed", text: "" };
  if (writes.length && writes.every((s) => s.status === "undone" || s.status === "skipped") && writes.some((s) => s.status === "undone")) return { kind: "undone", text: writes.filter((s) => s.status === "undone").at(-1)?.summary || "" };
  if (lastDone) return { kind: "done", text: lastDone.summary || "" };
  return { kind: "answered", text: "" };
}

/* ================= 主體 ================= */

export function mountAssistant({ ctx }) {
  const tools = document.getElementById("mast-tools");
  if (!tools || !ctx) return;
  let prefs = readPrefs();
  let status = null; // /api/assistant/status
  let panel = null;
  let running = null; // { ctrl, turn }
  // 送出鎖：收下文字那一刻就拿（第一個 await 之前）。初開聊天室時要先等 /status，那段空檔再按一次 Enter 不能又送一次。
  let sending = false;
  let toolMod = null;
  let promptMod = null;
  const halo = createHalo();
  let unwatchShots = null;

  // 對話：送給模型的完整歷史（messages）＋畫面上的每一則（log）。只存在這個分頁。
  let chat = loadChat();

  /* ---------- 頂欄（只在開著時放上去）：一顆印章 ---------- */
  const CHAT_TITLE = "墨池助手（Ctrl+/）";
  const chatBtn = el(
    "button",
    { class: "ghost icon-btn ai-chat-btn", id: "ai-chat-btn", type: "button", title: CHAT_TITLE, "aria-label": "墨池助手", "aria-expanded": "false" },
    el("span", { class: "ai-chat-seal", html: ICON.seal }),
    el("i", { class: "ai-chat-dot", "aria-hidden": "true" })
  );
  const group = chatBtn;
  registerLab({ enabled: () => prefs.enabled, set: (on) => setEnabled(on) });

  chatBtn.addEventListener("click", () => (panel?.isOpen() ? panel.close() : openPanel()));

  /** 開著：頂欄放上兩顆、字盒和合成池放「問助理」。關著：全部拿掉（不是藏起來：DOM 跟原本一樣）。 */
  function paintEntry({ motion = false } = {}) {
    if (prefs.enabled) {
      if (!group.isConnected) {
        const sound = document.getElementById("sound-btn");
        tools.insertBefore(group, sound && sound.parentElement === tools ? sound : tools.firstChild);
        // 像蓋一枚印：從大一點、斜一點壓下來，落定時略過頭再回來。
        if (motion && !reducedMotion())
          group.animate(
            [
              { opacity: 0, transform: "scale(1.9) rotate(-18deg)" },
              { opacity: 1, transform: "scale(0.9) rotate(3deg)", offset: 0.7 },
              { opacity: 1, transform: "none" },
            ],
            { duration: DUR.xl, easing: css(CURVE.out) }
          );
      }
      document.documentElement.dataset.ai = "on";
    } else {
      delete document.documentElement.dataset.ai;
      if (!group.isConnected) return;
      if (!motion || reducedMotion()) return void group.remove();
      const a = group.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.4) rotate(14deg)" }], { duration: DUR.short, easing: css(CURVE.exit) });
      a.onfinish = () => {
        if (!prefs.enabled) group.remove();
      };
    }
  }

  function setEnabled(on) {
    prefs = { ...prefs, enabled: on, open: on ? prefs.open : false };
    writePrefs(prefs);
    if (!on) {
      stopTurn("cancelled");
      // 還沒按的確認卡一起作廢：工具層的計畫丟掉（之後按了也不會換牌），卡片收成「已失效」。
      voidConfirms(t("實驗功能關掉了，這項確認已經失效"));
      panel?.dropRefs();
      panel?.close();
      halo.clear();
      toast("實驗功能關了：聊天室收起，還沒執行的助手操作都取消");
    } else {
      toast("實驗功能開了：頂欄多了一顆朱色印章（墨池助手），字盒、合成池多了「問助理」");
      refreshStatus();
    }
    paintEntry({ motion: true });
    paintAskButtons({ motion: true });
    syncShotReferences();
  }

  function acceptWork(work) {
    if (!prefs.enabled) return;
    if (!work) return toast(t("找不到這件引用作品"));
    openPanel({ ref: { kind: "work", label: work.name, work } });
  }

  function syncShotReferences() {
    if (prefs.enabled && !unwatchShots) {
      unwatchShots = watchShotReferences({ ctx, isOpen: () => panel?.isOpen(), accept: acceptWork });
    } else if (!prefs.enabled && unwatchShots) {
      unwatchShots();
      unwatchShots = null;
    }
  }

  /** 收起時，印章上的光點說目前一步（設計稿 §12）：顏色看狀態，字在滑鼠提示和讀屏（不佔頂欄的寬）。 */
  function paintChatState(text, kind = "") {
    chatBtn.dataset.state = text ? kind : "";
    chatBtn.title = text ? `${t(CHAT_TITLE)}・${text}` : t(CHAT_TITLE);
    chatBtn.setAttribute("aria-label", text ? `${t("墨池助手")}：${text}` : t("墨池助手"));
  }

  async function refreshStatus() {
    try {
      status = await api("/api/assistant/status");
    } catch (err) {
      status = { ok: false, error: err.message, code: err.code };
    }
    panel?.paintHead();
    return status;
  }

  /* ---------- 「問助理」入口（字盒、合成池）：帶上引用打開聊天室 ---------- */
  const ASKS = [
    [() => document.querySelector("#pool-title")?.parentElement?.querySelector("p:last-of-type"), () => ({ kind: "pool", label: "合成池" })],
    [
      () => document.querySelector("#library .panel-head"),
      () => {
        const q = document.getElementById("lib-q")?.value.trim();
        // 標籤照模板翻（英文：Library search “…”）；搜尋字是使用者的，{0!} 原樣插入，不翻。
        return q ? { kind: "search", label: `字盒搜尋「${q}」`, query: q } : { kind: "lib", label: "字盒" };
      },
    ],
  ];
  let askBtns = [];
  function paintAskButtons({ motion = false } = {}) {
    if (!prefs.enabled) {
      for (const b of askBtns) {
        if (!motion || reducedMotion()) b.remove();
        else b.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.6)" }], { duration: DUR.short, easing: css(CURVE.exit) }).onfinish = () => b.remove();
      }
      askBtns = [];
      return;
    }
    if (askBtns.length) return;
    for (const [hostOf, ref] of ASKS) {
      const host = hostOf();
      if (!host) continue;
      const label = "問助理";
      const b = el("button", { class: "btn btn-small btn-ghost ai-ask", type: "button", title: `${label}：打開 AI 聊天室，帶上這一塊`, "aria-label": label, html: ICON.seal });
      b.addEventListener("click", () => openPanel({ ref: ref() }));
      host.append(b);
      if (motion && !reducedMotion())
        b.animate([{ opacity: 0, transform: "scale(0.5) rotate(-12deg)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, delay: 120 + askBtns.length * 90, easing: css(CURVE.out), fill: "backwards" });
      askBtns.push(b);
    }
  }

  /* ---------- 設定 ---------- */
  // 設定視窗在 assistant-settings.js；這裡把聊天室的狀態借給它。
  function openSettings(opts = {}) {
    return openSettingsSheet(opts, { api, getStatus: () => status, refreshStatus, getPrefs: () => prefs, openPanel });
  }

  /* ---------- 聊天面板 ---------- */
  function openPanel({ ref } = {}) {
    if (!prefs.enabled) setEnabled(true);
    if (!panel) panel = buildPanel();
    panel.open();
    if (ref) panel.addRef(ref);
    prefs = { ...prefs, open: true };
    writePrefs(prefs);
  }

  function buildPanel() {
    const conn = el("span", { class: "ai-conn", dataset: { noI18n: "" } });
    const stateText = el("span", { class: "ai-state-text" });
    const stepText = el("span", { class: "ai-step-text" });
    const stateBar = el("div", { class: "ai-state", role: "status", "aria-live": "polite", dataset: { kind: "idle" } }, el("i", { class: "ai-state-dot", "aria-hidden": "true" }), stateText, stepText);
    const newBtn = el("button", { class: "ghost icon-btn", type: "button", title: "新對話", "aria-label": "新對話", html: ICON.fresh });
    const gearBtn = el("button", { class: "ghost icon-btn", type: "button", title: "AI 助手設定", "aria-label": "AI 助手設定", html: ICON.gear });
    const closeBtn = el("button", { class: "ghost icon-btn", type: "button", title: "收起聊天室（Esc）", "aria-label": "收起聊天室", html: ICON.close });
    const head = el(
      "header",
      { class: "ai-head" },
      el("div", { class: "ai-title" }, el("span", { class: "ai-seal", html: ICON.seal }), el("h2", {}, "墨池助手"), el("span", { class: "ai-beta" }, "實驗")),
      el("div", { class: "ai-head-tools" }, newBtn, gearBtn, closeBtn),
      conn,
      stateBar
    );
    const log = el("div", { class: "ai-log", role: "log", "aria-label": "對話", tabindex: "0" });
    const refs = el("div", { class: "ai-refs", hidden: true });
    const input = el("textarea", { class: "ai-input", rows: "1", placeholder: "交代墨池助手…（Enter 送出，Shift+Enter 換行）", "aria-label": "給助手的訊息" });
    // 「送出」在英文字典裡是完成式（Sent，別處用）：這顆用自己的字。
    const SEND = "送出訊息";
    const sendBtn = el("button", { class: "ai-send", type: "button", title: SEND, "aria-label": SEND, html: ICON.send });
    const foot = el("div", { class: "ai-foot" }, refs, el("div", { class: "ai-compose" }, input, sendBtn), el("p", { class: "ai-hint" }, "問意見只回答；說「幫我加入」「改成」「建立」「抽」才會動工作台。"));
    const grip = el("div", { class: "ai-grip", "aria-hidden": "true" });
    const root = el("aside", { class: "ai-panel", id: "ai-panel", "aria-label": "墨池助手", hidden: true, tabindex: "-1" }, grip, head, log, foot);
    document.body.append(root);
    let pendingRefs = [];
    let dropEvents = null;

    newBtn.addEventListener("click", async () => {
      // 點下去的當下就是新的一輪：舊的那輪停掉、它的確認計畫作廢、借走的字盒收回，
      // 狀態列、印章、送出鈕、待用的引用和草稿全部歸零（不然空的對話配著「理解中」和停止鈕，草稿一送還帶著舊引用）。
      if (running) stopTurn("cancelled");
      running = null;
      voidConfirms("");
      lookTok++;
      if (peeking) {
        peeking = false;
        try { ctx.libRestore?.(); } catch { /* 收不回就留著 */ }
      }
      halo.clear();
      closeFound();
      chat = { messages: [], log: [] };
      saveChat();
      dropRefs();
      input.value = "";
      grow();
      setState("idle");
      if (!reducedMotion() && log.firstElementChild && !log.querySelector(".ai-empty")) {
        await log.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-14px)" }], { duration: DUR.short, easing: css(CURVE.exit) }).finished.catch(() => {});
      }
      renderLog();
      rise(log.querySelector(".ai-empty"));
      input.focus();
    });
    gearBtn.addEventListener("click", () => openSettings());
    closeBtn.addEventListener("click", () => api_.close());
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.querySelector(".overlay")) {
        e.stopPropagation();
        api_.close();
      }
    });
    input.addEventListener("input", grow);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });
    sendBtn.addEventListener("click", () => (running ? stopTurn("cancelled") : send()));
    // 手機：握把往下拉收起（跟其他彈窗一樣的手感，但面板不擋工作台）。
    let drag = null;
    grip.addEventListener("pointerdown", (e) => {
      drag = { y: e.clientY };
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dy = Math.max(0, e.clientY - drag.y);
      root.style.transform = `translateY(${dy}px)`;
    });
    grip.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      drag = null;
      root.style.transform = "";
      if (dy > 90) api_.close();
    });

    // 電腦上面板從頂欄底下開始（不蓋住頂欄的按鈕，包括開關聊天室的那顆）；捲下去頂欄走了就貼齊上緣。
    function placeTop() {
      const mast = document.querySelector(".mast");
      const bottom = mast ? mast.getBoundingClientRect().bottom : 0;
      root.style.setProperty("--ai-top", `${Math.max(8, Math.round(bottom) + 8)}px`);
    }
    addEventListener("scroll", () => !root.hidden && placeTop(), { passive: true });
    addEventListener("resize", () => !root.hidden && placeTop(), { passive: true });

    function grow() {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    }

    function paintHead() {
      const c = status?.connection;
      // 遠端、主機沒開放：連線列不能寫「已選 Codex」讓人以為能用，送了才收到拒絕。
      const blocked = status?.local === false && !status?.allowRemote;
      conn.textContent = status?.ok === false ? status.error || "" : blocked ? t("主機尚未允許這台裝置聊天") : c ? labelOf(c) : t("還沒選連線");
      conn.dataset.kind = status?.ok === false ? "err" : blocked ? "warn" : c ? "ok" : "warn";
      // 正常時頂端只留名稱、設定、收起：模型名稱放在設定鈕的提示（和設定視窗）裡，有問題才在頂端寫出來。
      conn.hidden = conn.dataset.kind === "ok";
      gearBtn.title = c && conn.hidden ? `${t("AI 助手設定")}・${labelOf(c)}` : t("AI 助手設定");
    }

    function setState(kind, text = "", step = "") {
      stateBar.dataset.kind = kind;
      swapText(stateText, text || STATUS_ZH[kind] || "");
      swapText(stepText, step ? `· ${step}` : "");
      const was = sendBtn.dataset.running;
      sendBtn.innerHTML = running ? ICON.stop : ICON.send;
      sendBtn.title = running ? t("停止") : t(SEND);
      sendBtn.setAttribute("aria-label", sendBtn.title);
      sendBtn.dataset.running = running ? "true" : "false";
      // 箭頭 ↔ 停止：圖示轉一下換過去，不是一格跳。
      if (was !== undefined && was !== sendBtn.dataset.running && !reducedMotion())
        sendBtn.firstElementChild?.animate([{ opacity: 0, transform: "rotate(-90deg) scale(0.6)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
      paintBusy();
      // 收起時的狀態：開啟鍵旁邊寫目前這一步
      if (!api_.isOpen()) paintChatState(step || (kind !== "idle" ? STATUS_ZH[kind] : ""), kind);
      else paintChatState("");
    }

    function addRef(ref) {
      const work = referenceInfo(ref);
      if (!ref || pendingRefs.some((r) => work
        ? r.work?.id === work.id && r.work?.kind === work.kind
        : r.kind === ref.kind && r.label === ref.label)) return;
      if (work && pendingRefs.filter(referenceInfo).length >= 2) return toast(t("一次最多引用兩件作品"));
      pendingRefs.push(ref);
      const wasHidden = refs.hidden;
      paintRefs();
      if (!reducedMotion()) {
        refs.lastElementChild?.animate([{ opacity: 0, transform: "translateY(6px) scale(0.9)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
        if (wasHidden) refs.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
      }
      input.focus();
    }
    // 新對話：待用的引用一起清掉（淡出），不然下一句送出去還帶著上一段的「使用者指著…」。
    function dropRefs() {
      if (!pendingRefs.length) return;
      pendingRefs = [];
      if (reducedMotion() || refs.hidden) return paintRefs();
      refs.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(4px)" }], { duration: DUR.short, easing: css(CURVE.exit) }).onfinish = () => {
        if (!pendingRefs.length) paintRefs();
      };
    }
    function paintRefs() {
      refs.hidden = !pendingRefs.length;
      queueMicrotask(refreshEmpty);
      refs.replaceChildren(
        ...pendingRefs.map((r) =>
          el(
            "span",
            { class: "ai-ref", dataset: r.work ? { workId: r.work.id } : {} },
            // 搜尋的引用不再整段標成不翻：交給 i18n 照模板「字盒搜尋「{0}」」翻，只有搜尋字（{0!}）原樣。
            referenceName(r),
            el("button", {
              type: "button",
              class: "ai-ref-x",
              "aria-label": t(`拿掉「${r.label}」`),
              html: ICON.close,
              onclick: (e) => {
                const chip = e.currentTarget.closest(".ai-ref");
                const drop = () => {
                  pendingRefs = pendingRefs.filter((ref) => ref !== r);
                  paintRefs();
                  if (api_.isOpen()) input.focus();
                };
                if (!chip || reducedMotion()) return drop();
                chip.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.85)" }], { duration: DUR.short, easing: css(CURVE.exit) }).onfinish = drop;
              },
            })
          )
        )
      );
    }

    function referenceName(ref) {
      const work = referenceInfo(ref);
      return work
        ? [
            work.thumbnail ? el("img", { class: "ai-ref-thumb", src: work.thumbnail, alt: "", decoding: "async" }) : null,
            el("span", { dataset: { noI18n: "" }, title: work.name }, work.name),
          ]
        : el("span", {}, ref.label);
    }

    /* ----- 對話畫面 ----- */
    function renderLog() {
      log.replaceChildren();
      if (!chat.log.length) log.append(emptyState());
      for (const item of chat.log) log.append(renderItem(item));
      scrollDown(true);
    }
    function emptyState() {
      const sample = (text) => el("button", { class: "ai-sample", type: "button", onclick: () => ((input.value = t(text)), grow(), input.focus()) }, text);
      if (pendingRefs.some(referenceInfo)) return el(
        "div",
        { class: "ai-empty", dataset: { ctx: "work" } },
        el("div", { class: "ai-empty-mark", html: ICON.seal }),
        el("div", { class: "ai-samples" },
          sample("用這張，保留長相和服裝，背景換成雨夜車站。"),
          sample("這張作品的場景牌是怎麼來的？"))
      );
      const ref = pendingRefs[0];
      const here = ref && contextOf(ref);
      if (here)
        return el(
          "div",
          { class: "ai-empty", dataset: { ctx: ref.kind } },
          el("div", { class: "ai-empty-mark", html: ICON.seal }),
          el("p", { class: "ai-empty-ctx" }, here.line),
          el("div", { class: "ai-samples" }, ...here.samples.map(sample))
        );
      return el(
        "div",
        { class: "ai-empty" },
        el("div", { class: "ai-empty-mark", html: ICON.seal }),
        el("p", { class: "ai-empty-title" }, "交代一件事，或問一個問題"),
        el("p", { class: "ai-muted" }, "助手讀的是你現在的合成池和規則，動手前會照你的話做，做了什麼都會列出來。"),
        el("div", { class: "ai-samples" }, sample("我現在有哪些牌？會抽幾張？"), sample("你覺得還可以加入哪些牌？"), sample("幫我把適合海邊的服裝建立一個群組"), sample("長相改成 3 張，這次只抽牌"))
      );
    }
    // 從哪一塊按「問助理」：那一塊現在的樣子一行字，加兩句跟它有關的例句（通用的四句收起來）。
    function contextOf(ref) {
      try {
        const st = ctx.state();
        if (ref.kind === "pool") return { line: fill("合成池 · 目前 {0} 張", st.poolCount ?? 0), samples: ["你覺得還可以加入哪些牌？", "這些牌有沒有互斥或重複的？"] };
        if (ref.kind === "search") {
          const n = (ctx.search(ref.query || "", { limit: 40 }) || []).length;
          return { line: fill("字盒搜尋「{0}」· 找到 {1} 張", ref.query || "", n >= 40 ? "40+" : n), samples: ["這裡面哪幾張適合現在的合成池？", "推薦幾張跟這次搜尋有關的牌"] };
        }
        if (ref.kind === "lib") return { line: fill("字盒 · 合成池目前 {0} 張", st.poolCount ?? 0), samples: ["推薦幾張適合現在合成池的牌", "幫我找適合海邊的服裝"] };
      } catch { /* 讀不到就用通用的 */ }
      return null;
    }
    // 引用換了（加上、拿掉）而對話還是空的：空白畫面跟著換，淡出淡入。
    function refreshEmpty() {
      const old = log.querySelector(".ai-empty");
      if (!old || chat.log.length) return;
      const next = emptyState();
      if ((old.dataset.ctx || "") === (next.dataset.ctx || "") && old.textContent === next.textContent) return;
      old.replaceWith(next);
      if (!reducedMotion()) next.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
    }
    function renderItem(item) {
      if (item.role === "user")
        return el(
          "div",
          { class: "ai-msg ai-user" },
          item.refs?.length ? el("div", { class: "ai-msg-refs" }, ...item.refs.map((r) =>
            el("span", { class: "ai-ref is-static", dataset: r.work ? { workId: r.work.id } : {} }, referenceName(r)))) : null,
          el("div", { class: "ai-bubble", dataset: { noI18n: "" } }, item.text)
        );
      if (item.role === "note") {
        const n = el("div", { class: "ai-note", dataset: { kind: item.kind || "" } }, el("span", {}, item.text));
        if (item.action === "recheck") n.append(el("button", { class: "link-btn ai-note-act", type: "button", onclick: (e) => recheck(item, e.currentTarget) }, "重新檢查"));
        return n;
      }
      // 助手的一則：文字（串流進來）＋這一輪的步驟
      const node = el("div", { class: "ai-msg ai-bot", dataset: { id: item.id } });
      node.append(el("div", { class: "ai-avatar", html: ICON.seal }));
      const col = el("div", { class: "ai-col" });
      node.append(col);
      for (const seg of item.segs || []) {
        const steps = (item.steps || []).filter((st) => st.seg === seg.n);
        // 這一段有叫工具：模型那句話說的是做完的結果，排在步驟後面、等工具做完才出現（不然話說完了牌還沒進來）。
        if (seg.calls) {
          if (steps.length) col.append(stepsNode(item, steps));
          if (seg.text && !seg.held) col.append(segNode(seg));
        } else {
          if (seg.text) col.append(segNode(seg));
          if (steps.length) col.append(stepsNode(item, steps));
        }
      }
      if (item.error) col.append(el("p", { class: "ai-error" }, item.error));
      for (const c of item.confirms || []) col.append(confirmNode(item, c));
      if (item.pending) col.append(el("div", { class: "ai-typing", "aria-hidden": "true" }, el("i"), el("i"), el("i")));
      return node;
    }
    // 一批工具還在跑時，「復原」和舊的確認卡先鎖著（位置不動、淡一點）：中途插進一則「使用者按了…」，
    // 送給模型的歷史就變成「呼叫兩個工具 → 一個結果 → 使用者 → 另一個結果」，伺服器整段退件，之後連問一句都失敗。
    const LOCKED = "這一批做完就能按";
    function lockBtn(b, on) {
      if (on) {
        b.setAttribute("aria-disabled", "true");
        b.title = t(LOCKED);
      } else if (b.getAttribute("aria-disabled") === "true" && !b.dataset.busy) {
        b.removeAttribute("aria-disabled");
        b.removeAttribute("title");
      }
    }
    function paintBusy() {
      const busy = !!running;
      if ((log.dataset.busy === "true") === busy) return;
      log.dataset.busy = busy ? "true" : "false";
      for (const b of log.querySelectorAll(".ai-step-undo, .ai-confirm-actions .btn, .ai-sugg-add:not([disabled])")) lockBtn(b, busy);
    }
    // 連續好幾步都是成功的查詢：這一輪做完後收成一行「已查詢 N 步」，按了才展開（不然手機上只看得到一長串查詢，最後那句回答埋在下面）。
    // 失敗、確認、寫入、復原的步驟一律看得到。
    const FOLD_MIN = 3;
    const openFolds = new Set();
    function stepsNode(item, steps) {
      const ol = el("ol", { class: "ai-steps" });
      const quiet = (s) => s.kind === "read" && s.status === "done" && !s.cards?.length && !s.works?.length && !s.trace;
      for (let k = 0; k < steps.length; ) {
        let end = k;
        while (!item.pending && end < steps.length && quiet(steps[end])) end++;
        if (end - k >= FOLD_MIN) {
          const run = steps.slice(k, end);
          const key = `${item.id}:${run[0].id}`;
          const inner = el("ol", { class: "ai-steps ai-fold-list" });
          for (const s of run) inner.append(stepNode(item, s));
          const det = el("details", { class: "ai-fold", ...(openFolds.has(key) ? { open: "" } : {}) }, el("summary", {}, el("i", { class: "ai-step-dot", "aria-hidden": "true" }), el("b", {}, t(`已查詢 ${run.length} 步`))), inner);
          det.addEventListener("toggle", () => {
            if (det.open) openFolds.add(key);
            else openFolds.delete(key);
            if (det.open && !reducedMotion())
              [...inner.children].forEach((li, j) => li.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: Math.min(j, 10) * 30, easing: css(CURVE.out), fill: "backwards" }));
          });
          ol.append(el("li", { class: "ai-step ai-step-fold", dataset: { status: "done", fold: key } }, det));
          k = end;
          continue;
        }
        ol.append(stepNode(item, steps[k]));
        k++;
      }
      return ol;
    }
    function stepNode(item, s) {
      {
        // 做完的寫入排成墨池自己的操作紀錄：左邊動詞、右邊牌名或數字（「加入　日落、走路」「長相　2 → 3」）。
        // 紀錄已經寫了的明細不再列；只留紀錄之外的提醒（notes）。進行中、失敗、復原了的照舊一行字。
        const asOps = s.ops?.length && (s.status === "done" || s.status === "partial");
        const li = el(
          "li",
          { class: "ai-step", dataset: { status: s.status, id: s.id || "" } },
          el("i", { class: "ai-step-dot", "aria-hidden": "true" }),
          // 進行中寫「正在…」；做完了直接寫結果（摘要），明細裡跟摘要一樣的那行不重複
          el(
            "div",
            {},
            asOps ? opsNode(s.ops) : el("b", {}, s.status === "running" || !s.summary ? s.label : s.summary),
            // 排字盤緊接在標題底下：做完之後明細行加在它下面，字不會被往下推。
            s.sorts?.length ? sortsNode(s) : null,
            // 標題已經寫了的（「加入海邊；附帶戶外」底下又一行「加入海邊」）不再列一次。
            ...(asOps || s.cards?.length ? s.notes || [] : (s.lines || []).filter((l) => l && !(s.summary || "").includes(l))).map((l) => el("span", { class: "ai-step-line" }, l)),
            s.cards?.length && s.status === "done" ? suggNode(item, s) : null,
            s.works?.length && s.status === "done" ? worksNode(item, s) : null,
            s.trace && s.status === "done" ? traceNode(s.trace) : null,
            // 找到很多張、聊天室只列前幾張：一顆鈕打開浮空小字盒，看全部（照花色分）、點牌放進合成池。
            s.found?.length && s.status === "done"
              ? el("button", { class: "btn btn-small ai-step-found", type: "button", onclick: (e) => openFound({ ctx, tags: s.found, anchor: e.currentTarget }) }, fill("看這 {0} 張", s.found.length))
              : null
          )
        );
        // 真的改了東西才叫「看變更」；查詢、失敗、沒寫入的只是帶你去那一塊（查看位置）。
        if (s.target && s.status !== "running") {
          const changed = s.kind !== "read" && s.status === "done";
          const detail = changed && s.changes ? changesNode(s.changes, s.id) : null;
          li.append(el("button", {
            class: "link-btn ai-step-look", type: "button",
            ...(detail ? { "aria-controls": detail.id, "aria-expanded": "false" } : {}),
            onclick: (e) => {
              if (detail) {
                detail.hidden = !detail.hidden;
                e.currentTarget.setAttribute("aria-expanded", String(!detail.hidden));
                if (!detail.hidden && !reducedMotion()) detail.animate(
                  [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }],
                  { duration: DUR.short, easing: css(CURVE.out) }
                );
              }
              // 手機會先收聊天室；有清單時留在原地就能看。
              if (!detail || !matchMedia("(max-width: 40rem)").matches) look(s.target, s.summary || s.label, s.id);
            },
          }, changed ? "看變更" : "查看位置"));
          if (detail) li.append(detail);
        }
        if (s.undoable && s.status === "done") {
          const b = el("button", { class: "link-btn ai-step-undo", type: "button", onclick: () => undoStep(item, s) }, "復原");
          lockBtn(b, !!running);
          li.append(b);
        }
        return li;
      }
    }
    const cardName = (tag) => ctx.cardInfo?.(tag)?.zh || tag;

    function changesNode(changes, id) {
      const ops = [];
      if (changes.added.length) ops.push({ k: "加入", v: changes.added.map(cardName).join("、"), raw: true });
      if (changes.removed.length) ops.push({ k: "移掉", v: changes.removed.map(cardName).join("、"), raw: true });
      for (const { tag, from, to } of changes.weights) ops.push({ k: "份量", v: `${cardName(tag)} ${from} → ${to}`, raw: true });
      if (!ops.length) return null;
      return el("div", { class: "ai-step-changes", id: `ai-changes-${id}`, hidden: true }, opsNode(ops, "ai-change-list"));
    }

    function worksNode(item, step) {
      return el("ul", { class: "ai-work-results" }, step.works.map((work) =>
        el("li", { class: "ai-work-result" },
          work.thumbnail ? el("img", { class: "ai-work-thumb", src: work.thumbnail, alt: "", loading: "lazy" }) : null,
          el("span", { class: "ai-work-title", dataset: { noI18n: "" } }, work.name),
          el("button", {
            class: "btn btn-small btn-ghost", type: "button",
            onclick: async (event) => {
              const button = event.currentTarget;
              const signal = dropEvents?.signal;
              if (!signal || button.disabled) return;
              button.disabled = true;
              try {
                const snapshot = await loadWorkResult(item, work.id, signal);
                if (!signal.aborted && chat.log.includes(item)) acceptWork(snapshot);
              } finally {
                button.disabled = false;
              }
            },
          }, "引用這件作品")
        )
      ));
    }

    function traceNode(trace) {
      const face = (tag) => {
        const node = ctx.cardFace?.(tag);
        if (!node) return el("div", { class: "ai-sugg-blank", dataset: { noI18n: "" } }, cardName(tag));
        node.setAttribute("tabindex", "-1");
        return node;
      };
      const paths = trace.paths.length ? trace.paths : [[{ tag: trace.tag }]];
      return el(
        "div",
        { class: "ai-trace" },
        el("p", { class: "ai-step-line" }, trace.present ? referenceSourceLabel(trace.source) : "這裡沒有這張牌", trace.inferred ? el("span", { class: "ai-trace-note" }, "依規則推斷") : null),
        paths.map((path) => el("div", { class: "ai-trace-path" },
          path.map(({ tag, via }) => [
            via ? el("span", { class: "ai-trace-via" }, el("span", { "aria-hidden": "true" }, "→ "), referenceSourceLabel(via), el("span", { "aria-hidden": "true" }, " →")) : null,
            face(tag),
          ])
        )),
        trace.groups.length || trace.customOwner
          ? el("p", { class: "ai-step-line" }, "群組", " · ", el("span", { dataset: { noI18n: "" } }, [...trace.groups, trace.customOwner].filter(Boolean).join("、")))
          : null,
        trace.mutex.length ? el("p", { class: "ai-step-line" }, "互斥", " · ", el("span", { dataset: { noI18n: "" } }, trace.mutex.map(cardName).join("、"))) : null,
        trace.present ? el("p", { class: "ai-step-line" }, trace.wouldReturn ? "重新套用相關牌的規則時會帶回這張" : "目前未找到會帶回這張的牌") : null
      );
    }
    function opsNode(ops, className = "ai-ops") {
      return el(
        "dl",
        { class: className },
        ...ops.map((o) => el("div", { class: "ai-op" }, el("dt", { class: "ai-op-k" }, o.k), el("dd", { class: "ai-op-v", ...(o.raw ? { dataset: { noI18n: "" } } : {}) }, o.v)))
      );
    }
    // 推薦卡：字盒同一個卡面＋一句理由＋「加入」。加過的那張標成已加入（按鈕鎖住），復原了又能再按。
    function suggNode(item, s) {
      return el(
        "div",
        { class: "ai-sugg" },
        ...s.cards.map((c) => {
          const face = ctx.cardFace?.(c.tag) || el("div", { class: "ai-sugg-blank", dataset: { noI18n: "" } }, c.zh || c.tag);
          const added = c.state === "added";
          const btn = el("button", { class: "btn btn-small ai-sugg-add", type: "button", ...(added || c.state === "busy" ? { disabled: "" } : {}) }, added ? "已加入" : "加入這張");
          if (!added) {
            btn.addEventListener("click", () => addSuggested(item, s, c));
            lockBtn(btn, !!running);
          }
          return el(
            "div",
            { class: "ai-sugg-item", dataset: { tag: c.tag, n: String(c.n), state: c.state || "" } },
            el("span", { class: "ai-sugg-n", "aria-hidden": "true" }, String(c.n)),
            face,
            el("p", { class: "ai-sugg-why", dataset: { noI18n: "" } }, c.why || ""),
            btn
          );
        })
      );
    }
    // 排字盤：助手寫的提示詞一顆一顆排出來。認得的字是牌名（剛排出來那一下先是原文，再墨成牌名），
    // 詞庫沒有的是虛線框（去字盒找），引擎自己處理的淡掉。
    function segNode(seg) {
      const n = richText(seg.text);
      n.dataset.seg = String(seg.n);
      return n;
    }
    // 一個影格最多補畫一次；聊天室收起時不畫（打開時 renderLog 整串畫）。這一段還沒出現過就整則重畫一次。
    // 排程用獨立的旗標：以前看 streaming.size > 1，同一則一直進字時 size 永遠是 1，每個字都排一次 rAF。
    const streaming = new Map();
    let streamRaf = 0;
    function streamText(item, seg) {
      if (!api_.isOpen()) return;
      streaming.set(item.id, [item, seg]);
      if (streamRaf) return;
      streamRaf = requestAnimationFrame(() => {
        streamRaf = 0;
        for (const [it, sg] of streaming.values()) {
          if (sg.held) continue;
          const host = log.querySelector(`.ai-msg[data-id="${it.id}"]`);
          const old = host?.querySelector(`.ai-rich[data-seg="${sg.n}"]`);
          if (!host || !old) repaint(it);
          else {
            old.replaceWith(segNode(sg));
            scrollDown();
          }
        }
        streaming.clear();
      });
    }
    function sortsNode(s) {
      return el(
        "div",
        { class: "ai-sorts", dataset: { noI18n: "" } },
        ...s.sorts.map((x) =>
          el(
            "span",
            {
              class: "ai-sort",
              dataset: { kind: x.kind, state: x.state || "", i: String(x.i), ...(!s.sortsFresh && (x.kind === "card" || x.kind === "muted") ? { inked: "true" } : {}) },
              title: x.kind === "card" ? `${x.raw} → ${sortName(x)}` : x.raw,
            },
            s.sortsFresh || x.kind !== "card" ? x.raw : sortName(x)
          )
        )
      );
    }
    // 確認卡：待確認（兩顆鈕）→ 處理中（按下去那一刻兩顆都鎖住）→ 已套用／已保留／已失效／沒做成（收成一行結果）。
    const CONFIRM_END = { applied: "已套用", kept: "保留原狀", stale: "這項確認已經失效", failed: "沒做成" };
    function confirmNode(item, c) {
      const state = c.state || "open";
      const box = el("div", { class: "ai-confirm", dataset: { state } }, el("p", {}, c.prompt));
      if (c.lines?.length) box.append(el("ul", {}, ...c.lines.map((l) => el("li", {}, l))));
      if (state === "open" || state === "busy") {
        const yes = el("button", { class: "btn btn-small btn-primary", type: "button" }, c.choices?.[0] || "套用");
        const no = el("button", { class: "btn btn-small btn-ghost", type: "button" }, c.choices?.[1] || "保留原狀");
        yes.addEventListener("click", () => decide(item, c, true));
        no.addEventListener("click", () => decide(item, c, false));
        if (state === "busy") {
          for (const b of [yes, no]) Object.assign(b.dataset, { busy: "true" }), b.setAttribute("aria-disabled", "true");
          (c.choice === "apply" ? yes : no).dataset.chosen = "true";
        } else for (const b of [yes, no]) lockBtn(b, !!running);
        box.append(el("div", { class: "ai-confirm-actions" }, yes, no));
      } else {
        const why = state === "applied" ? c.result || CONFIRM_END.applied : state === "kept" ? CONFIRM_END.kept : c.result || CONFIRM_END[state] || "";
        box.append(el("p", { class: state === "stale" || state === "failed" ? "ai-confirm-why" : "ai-muted" }, why));
      }
      return box;
    }
    // 貼著最新那則：送出時貼上；使用者自己往上捲（離底部超過一點）就放開，捲回底部再貼上。
    // 以前只看「現在離底部近不近」：回覆一長（步驟明細展開）就超過門檻，之後的內容都在畫面下面，看起來像沒反應。
    let stick = true;
    let autoScrolling = false;
    log.addEventListener("scroll", () => {
      if (autoScrolling) return;
      stick = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
    }, { passive: true });
    function scrollDown(force = false) {
      if (force) stick = true;
      if (!stick) return;
      autoScrolling = true;
      log.scrollTop = log.scrollHeight;
      requestAnimationFrame(() => (autoScrolling = false));
    }
    function repaint(item) {
      const old = log.querySelector(`.ai-msg[data-id="${item.id}"]`);
      const before = old ? snapshot(old) : null;
      const fresh = renderItem(item);
      if (old) old.replaceWith(fresh);
      else {
        log.querySelector(".ai-empty")?.remove();
        log.append(fresh);
        rise(fresh);
      }
      if (before) morph(before, fresh);
      scrollDown();
    }
    // 整則重畫（串流、步驟換狀態）之前的樣子：哪幾步、各在什麼狀態、排字盤每顆的下場、確認框。
    function snapshot(node) {
      const steps = new Map();
      for (const li of node.querySelectorAll(".ai-step[data-id]")) {
        steps.set(li.dataset.id, { status: li.dataset.status, sorts: [...li.querySelectorAll(".ai-sort")].map((x) => x.dataset.state) });
      }
      return {
        steps,
        confirms: [...node.querySelectorAll(".ai-confirm")].map((c) => c.dataset.state),
        error: !!node.querySelector(".ai-error"),
      };
    }
    // 重畫完只演變了的：新的一步滑進來、換狀態的那一步圓點彈一下＋字淡進、確認框長出來或收起。
    function morph(before, node) {
      if (reducedMotion()) return;
      const ease = css(CURVE.out);
      for (const li of node.querySelectorAll(".ai-step[data-id]")) {
        const was = before.steps.get(li.dataset.id);
        if (!was) {
          li.animate([{ opacity: 0, transform: "translateX(-8px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: ease });
          continue;
        }
        if (was.status !== li.dataset.status) {
          li.querySelector(".ai-step-dot")?.animate([{ transform: "scale(0.5)" }, { transform: "scale(1.22)", offset: 0.55 }, { transform: "none" }], { duration: DUR.medium, easing: ease });
          li.querySelector("b")?.animate([{ opacity: 0, transform: "translateY(4px)", filter: "blur(2px)" }, { opacity: 1, transform: "none", filter: "none" }], { duration: DUR.medium, easing: ease });
          li.querySelectorAll(".ai-step-line, .ai-step-look, .ai-step-undo").forEach((n, k) =>
            n.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: 90 + k * 40, easing: ease, fill: "backwards" })
          );
        }
        li.querySelectorAll(".ai-sort").forEach((x, k) => {
          if (was.sorts[k] !== undefined && was.sorts[k] !== x.dataset.state) x.animate([{ transform: "scale(0.9)" }, { transform: "scale(1.06)", offset: 0.6 }, { transform: "none" }], { duration: DUR.medium, delay: Math.min(k, 12) * 18, easing: ease });
        });
      }
      node.querySelectorAll(".ai-confirm").forEach((c, k) => {
        const was = before.confirms[k];
        if (was === undefined) c.animate([{ opacity: 0, transform: "translateY(8px) scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: ease });
        else if (was !== c.dataset.state) c.animate([{ opacity: 0.4, filter: "saturate(0.4)" }, { opacity: 1, filter: "none" }], { duration: DUR.medium, easing: ease });
      });
      const err = node.querySelector(".ai-error");
      if (err && !before.error) err.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: ease });
    }
    // 收著的那句話放出來：淡進、往上浮一點（話在步驟後面，像是做完才說）。
    function riseText(item, seg) {
      const n = log.querySelector(`.ai-msg[data-id="${item.id}"] .ai-rich[data-seg="${seg.n}"]`);
      if (n && !reducedMotion()) n.animate([{ opacity: 0, transform: "translateY(6px)", filter: "blur(2px)" }, { opacity: 1, transform: "none", filter: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    }
    function rise(node) {
      if (reducedMotion() || !node) return;
      node.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    }
    // 新的一輪：使用者那則和助手的那則浮上來（renderLog 是整串重畫，不會自己演）。
    function riseLast(n) {
      [...log.querySelectorAll(".ai-msg")].slice(-n).forEach((m, k) => {
        if (!reducedMotion()) m.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, delay: k * 70, easing: css(CURVE.out), fill: "backwards" });
      });
    }
    // 對話尾巴多了 n 則：只把這幾則接上去（以前整串重畫，長對話送一句就拆掉、重建幾百個節點）。
    function appendLast(n) {
      if (log.querySelector(".ai-empty") || log.childElementCount < chat.log.length - n) return renderLog();
      for (const item of chat.log.slice(-n)) log.append(renderItem(item));
      scrollDown(true);
    }
    // 聊天室裡的提示（還沒選連線、主機沒開放…）：同一句已經是最後一則就不再疊一則，原地亮一下。
    function addNote(note) {
      const last = chat.log.at(-1);
      if (last?.role === "note" && last.text === note.text) {
        const n = log.lastElementChild;
        if (n && !reducedMotion()) n.animate([{ transform: "scale(1.04)", filter: "brightness(1.15)" }, { transform: "none", filter: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
        return;
      }
      chat.log.push(note);
      appendLast(1);
      rise(log.lastElementChild);
    }

    // 遠端（手機、別台電腦）連進來、主機還沒開放：送之前就說，草稿留著，附「重新檢查」。
    const remoteBlocked = () => status?.local === false && !status?.allowRemote;
    const REMOTE_NOTE = "主機還沒允許這台裝置用聊天室：到主機的「AI 助手設定 → 讓手機、別台裝置也能用聊天室」打開，再按重新檢查。";

    async function recheck(item, btn) {
      if (btn.dataset.busy) return;
      btn.dataset.busy = "true";
      btn.setAttribute("aria-busy", "true");
      swapText(btn, t("檢查中…"));
      await refreshStatus();
      const node = btn.closest(".ai-note");
      if (remoteBlocked()) {
        delete btn.dataset.busy;
        btn.removeAttribute("aria-busy");
        swapText(btn, t("重新檢查"));
        if (node && !reducedMotion()) node.animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
        return;
      }
      Object.assign(item, { kind: "ok", text: t("可以了：這台裝置能用聊天室了，再送一次。"), action: null });
      saveChat();
      if (!node) return;
      const fresh = renderItem(item);
      node.replaceWith(fresh);
      if (!reducedMotion()) fresh.animate([{ opacity: 0, transform: "translateY(4px)", filter: "blur(2px)" }, { opacity: 1, transform: "none", filter: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
      input.focus();
    }

    async function send() {
      const text = input.value.trim();
      if (!text || running || sending) return;
      // 同步拿鎖、引用跟著這一則固定下來；按鈕當場淡成等待（第二次 Enter 直接忽略）。
      sending = true;
      const usedRefs = pendingRefs.slice();
      sendBtn.dataset.pending = "true";
      sendBtn.setAttribute("aria-busy", "true");
      try {
        if (!status) await refreshStatus();
        if (remoteBlocked()) return addNote({ role: "note", kind: "warn", text: t(REMOTE_NOTE), action: "recheck" });
        if (status?.ok === false || !status?.connection) {
          addNote({ role: "note", kind: "warn", text: status?.ok === false ? status.error : t("還沒選連線：先到「AI 助手設定」選一條。") });
          if (status?.ok !== false) openSettings({ thenChat: true });
          return;
        }
        input.value = "";
        grow();
        pendingRefs = pendingRefs.filter((r) => !usedRefs.includes(r));
        paintRefs();
        delete sendBtn.dataset.pending;
        sendBtn.removeAttribute("aria-busy");
        await runTurn(text, usedRefs);
      } finally {
        sending = false;
        delete sendBtn.dataset.pending;
        sendBtn.removeAttribute("aria-busy");
      }
    }

    const api_ = {
      isOpen: () => !root.hidden && root.dataset.state !== "closing",
      open() {
        if (api_.isOpen()) return input.focus();
        placeTop();
        root.hidden = false;
        root.dataset.state = "open";
        dropEvents = new AbortController();
        bindReferenceDrop(input, { ctx, isOpen: api_.isOpen, accept: acceptWork, signal: dropEvents.signal });
        document.documentElement.dataset.aiPanel = "open";
        chatBtn.setAttribute("aria-expanded", "true");
        renderLog();
        paintHead();
        refreshStatus();
        paintChatState("");
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
        // 手機上按「看變更」會先收起聊天室；回來時那一步重新入鏡、亮一下（不然又捲回最底下，找不到剛才看的是哪一步）。
        const back = lookFrom && log.querySelector(`.ai-step[data-id="${CSS.escape(lookFrom)}"]`);
        lookFrom = null;
        if (back) {
          back.closest("details")?.setAttribute("open", "");
          stick = false;
          back.scrollIntoView({ block: "center" });
          if (!reducedMotion()) back.animate([{ backgroundColor: "color-mix(in oklch, var(--ai-glow) 30%, transparent)" }, { backgroundColor: "transparent" }], { duration: DUR.xl, easing: css(CURVE.out) });
        }
      },
      close() {
        if (root.hidden) return;
        dropEvents?.abort();
        dropEvents = null;
        root.dataset.state = "closing";
        chatBtn.setAttribute("aria-expanded", "false");
        delete document.documentElement.dataset.aiPanel;
        prefs = { ...prefs, open: false };
        writePrefs(prefs);
        setTimeout(() => {
          if (root.dataset.state === "closing") root.hidden = true;
        }, reducedMotion() ? 0 : DUR.medium);
        // 收起時印章接著說目前的狀態：在跑、等你確認（黃點）、部分完成、失敗都留著；純回答、做完的不留（已經看過了）。
        const k = stateBar.dataset.kind;
        if (running || ["confirm", "partial", "failed"].includes(k)) paintChatState(stepText.textContent.replace(/^· /, "") || t(STATUS_ZH[k] || ""), k);
        chatBtn.focus({ preventScroll: true });
      },
      addRef,
      dropRefs,
      appendLast,
      addNote,
      paintHead,
      setState,
      repaint,
      streamText,
      riseText,
      renderLog,
      riseLast,
      log,
    };
    renderLog();
    return api_;
  }

  /* ================= 對話迴圈 ================= */

  async function loadTools() {
    if (toolMod && promptMod) return true;
    try {
      [toolMod, promptMod] = await Promise.all([import("./assistant-tools.js"), import("./assistant-prompt.js")]);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  let runner = null;

  /** 本地時間到分鐘（寫進使用者訊息，不寫進系統說明：系統說明要每次一樣才吃得到快取）。 */
  function clockNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** 工作台摘要：每則使用者訊息前面附一份（模型不必先查就知道現在的池子和規則；細節再用工具查）。 */
  function workspaceNote() {
    try {
      const s = ctx.state();
      const pool = s.pool.map((p) => `${p.zh}（${p.tag}${p.weight !== 1 ? ` ×${p.weight}` : ""}）`).join("、") || "空的";
      const counts = Object.entries(s.settings.counts || {})
        .map(([k, v]) => `${SECTION_ZH[k] || k} ${v}`)
        .join("、");
      const groups = Object.entries(s.settings.groups || {})
        .map(([k, v]) => `${SECTION_ZH[k] || k}：${(v.ids || []).length} 組（${v.mode === "mix" ? "混著抽" : "整組一起"}）`)
        .join("；");
      return `［目前工作台］現在 ${clockNow()}｜合成池 ${s.poolCount} 張：${pool}｜一次 ${s.settings.n}｜每段補牌：${counts}｜分級 ${s.settings.rating}${s.settings.ratingFree ? "（不限制開著）" : ""}｜尺度 ${(s.settings.heats || []).join("、") || "—"}｜群組勾選 ${groups || "沒有"}`;
    } catch {
      return "";
    }
  }

  function stopTurn(why) {
    if (!running) return;
    running.ctrl.abort();
    running.cancelled = why;
  }

  async function loadWorkResult(item, id, signal) {
    const saved = item.workSnapshots?.find((work) => work.id === id);
    if (saved) return saved;
    try {
      const work = await referenceFromAlbum(ctx, id, signal);
      if (!work || signal?.aborted || !chat.log.includes(item)) return null;
      const alreadyLoaded = item.workSnapshots?.find((snapshot) => snapshot.id === id);
      if (alreadyLoaded) return alreadyLoaded;
      (item.workSnapshots ||= []).push(work);
      saveChat();
      return work;
    } catch {
      return null;
    }
  }

  function turnContext(conv, version = ctx.version()) {
    return {
      version,
      async referenceOf(id, signal) {
        for (let i = conv.log.length - 1; i >= 0; i--) {
          const item = conv.log[i];
          const attached = item.refs?.map(referenceInfo).find((work) => work?.id === id);
          if (attached) return attached;
          if (item.steps?.some((step) => step.works?.some((work) => work.id === id))) return loadWorkResult(item, id, signal);
        }
        return null;
      },
    };
  }

  async function runTurn(text, refs) {
    const conv = chat;
    const turn = turnContext(conv);
    if (!(await loadTools())) {
      panel.addNote({ role: "note", kind: "err", text: t("助手的工具層還沒準備好（assistant-tools.js 讀不到）。") });
      return;
    }
    if (!prefs.enabled || conv !== chat) return;
    runner ||= toolMod.createToolRunner({
      ...ctx,
      sectionName: (section) => t(SECTION_ZH[section] || section),
      findWorks: (args, signal) => findReferences(ctx, args, signal),
      traceReference: (tag, reference) => traceReference(ctx, tag, reference),
      highlight: (target, phase, label) => highlight(target, phase, label),
      typeset: (id, sorts) => typeset(id, sorts),
      typesetDone: (id, sorts) => typesetDone(id, sorts),
      lookup: (id, list) => lookup(id, list),
    });
    // 上一則還停在確認卡：新的話送出去，那一則就不會在按了之後自己接著做（模型會看到新的這句）。
    for (const i of chat.log) if (i.paused) i.paused = null;
    const places = refs.filter((r) => !referenceInfo(r));
    const refText = places.length ? `［使用者指著］${places.map((r) => r.label).join("、")}\n` : "";
    const works = refs.map(referenceInfo).filter(Boolean).map(({ thumbnail, ...work }) => work);
    const workText = works.length ? `${REFERENCE_PREFIX}${JSON.stringify(works)}\n` : "";
    const contextText = `${workspaceNote()}\n${refText}`;
    conv.messages.push({
      role: "user",
      content: `${contextText}${workText}${text}`,
      ...(works.length ? { workLine: contextText.split("\n").length - 1 } : {}),
    });
    conv.log.push({ role: "user", text, refs });
    const item = { role: "bot", id: `t${Date.now().toString(36)}`, segs: [], steps: [], confirms: [], pending: true };
    conv.log.push(item);
    // 檢查點：收下這句話就存（工具改了工作台之後重新整理，這一輪至少還在，知道停在哪）。
    saveChat();
    panel.appendLast(2);
    panel.riseLast(2);
    lookTok++;
    // 這則訊息送出那一刻的工作台版本：整輪的工具共用同一個物件。之後使用者自己動了合成池、規則，
    // 依賴舊狀態的寫入會回 stale（assistant-tools.js），模型先重讀再做。
    await hops(conv, item, turn);
  }

  /**
   * 模型和工具來回（最多 MAX_HOPS 次）。conv 是這一輪所屬的對話：中途按「新對話」，舊的這一輪不准再寫進新的。
   * 遇到要確認的步驟就停：同一批後面的工具不做（回模型「等確認、沒做」），也不再問模型；
   * 使用者按了套用／保留之後（decide）才從這裡接著跑。
   */
  async function hops(conv, item, turn) {
    const live = () => chat === conv;
    const ctrl = new AbortController();
    running = { ctrl, item };
    item.pending = true;
    item.paused = null;
    panel.setState("thinking", "", t("讀你的訊息"));
    const system = promptMod.buildSystemPrompt({ lang: english ? "en" : "zh", room: "mochi" });
    const toolsForModel = toolMod.toolSchemas();
    let finalKind = "answered";
    let nudged = false;
    try {
      for (let hop = 0; hop < MAX_HOPS; hop++) {
        const seg = { text: "", n: item.segs.length };
        item.segs.push(seg);
        let calls = [];
        await streamChat({ system, tools: toolsForModel, messages: fitHistory(system, toolsForModel, conv.messages) }, ctrl.signal, (event, data) => {
          if (!live()) return;
          if (event === "status") panel.setState("thinking", "", data.stage === "connecting" ? t("連線中") : t("想一想"));
          else if (event === "text") {
            seg.text += data.delta || "";
            panel.streamText(item, seg);
          } else if (event === "tool_calls") {
            calls = Array.isArray(data.calls) ? data.calls : [];
            if (calls.length) Object.assign(seg, { calls: true, held: true });
          }
          else if (event === "error") throw Object.assign(new Error(data.error || "模型出錯"), { code: data.code });
        });
        if (!live()) throw Object.assign(new Error("aborted"), { name: "AbortError" });
        conv.messages.push({ role: "assistant", content: seg.text, ...(calls.length ? { toolCalls: calls } : {}) });
        if (!calls.length && !nudged && NO_TOOLS_RE.test(seg.text)) {
          nudged = true;
          conv.messages.push({ role: "user", content: TOOL_NUDGE });
          seg.text = "";
          panel.streamText(item, seg);
          continue;
        }
        if (!calls.length) break;
        // 這一批工具在畫面上的編號：模型（尤其相容 OpenAI 的服務）每一批都可能從 call_0 數起，
        // 同一個 id 不能撞到前面的步驟、復原、或工具層「同一個 id 不做第二次」的快取。
        const batch = `${item.id}:${item.segs.length}`;
        let waiting = null;
        const results = [];
        for (const call of calls) {
          if (ctrl.signal.aborted || !live()) throw Object.assign(new Error("aborted"), { name: "AbortError" });
          if (waiting) {
            conv.messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: JSON.stringify({ ok: false, status: "skipped", code: "waiting_confirm", note: `前一步「${waiting}」在等使用者確認，這一步沒做。使用者決定之後再做。` }) });
            continue;
          }
          const lab = safeLabel(call);
          const uid = `${batch}:${call.id}`;
          const step = { id: uid, label: lab.zh, status: "running", seg: seg.n, kind: lab.kind };
          item.steps.push(step);
          panel.setState(lab.kind === "read" ? "reading" : "working", "", lab.zh);
          panel.repaint(item);
          let res;
          try {
            res = await runner.run({ ...call, id: uid }, { signal: ctrl.signal, turn });
          } catch (err) {
            res = { ok: false, status: "failed", summary: friendlyError(err), forModel: { ok: false, error: String(err?.message || err) } };
          }
          if (!live()) throw Object.assign(new Error("aborted"), { name: "AbortError" });
          Object.assign(step, { status: res.status || (res.ok ? "done" : "failed"), summary: res.summary || "", lines: res.lines || [], target: res.target || null, undoable: !!res.undo });
          // 操作紀錄（「加入　日落、走路」）、紀錄之外的提醒、推薦卡：畫面照這幾樣排，沒有就照舊寫摘要。
          if (res.ops?.length) step.ops = res.ops;
          if (res.notes?.length) step.notes = res.notes;
          if (res.cards?.length) step.cards = res.cards.map((c) => ({ ...c }));
          if (res.found?.length) step.found = res.found;
          if (res.works?.length) step.works = res.works;
          if (res.trace) step.trace = res.trace;
          if (res.changes) step.changes = res.changes;
          if (res.sorts) step.sorts = res.sorts.map((x) => ({ ...x }));
          if (res.undo) undos.set(`${item.id}:${uid}`, res.undo);
          if (res.status === "needs_confirm" && res.confirm) {
            item.confirms.push({ ...res.confirm, callId: uid, state: "open" });
            waiting = lab.zh;
          }
          results.push({ write: lab.kind !== "read", res });
          // 重讀了工作台：之後的寫入照這一版判斷 stale（不然重讀完還是一直說「工作台已經變了」）。
          if (call.name === "get_workspace" && res.ok && Number.isFinite(res.forModel?.version)) turn.version = res.forModel.version;
          conv.messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: JSON.stringify(res.forModel ?? { ok: !!res.ok, status: res.status }) });
          // 檢查點：寫入落地、或停在確認卡，都存一次（重新整理後看得到這一步做了沒）。
          if (lab.kind !== "read" || waiting) saveChat();
          panel.repaint(item);
        }
        // 模型事先寫好的那句話（「已換黑髮」）只有在結果撐得住時才放出來：等確認、失敗、略過、部分完成時先只看步驟實績，
        // 要說明的話下一輪模型看了工具結果再說（以前一律放出來：確認卡上方已經寫「已換黑髮」，池子其實還是紅髮）。
        const backed = results.every((r) => r.res.ok && (r.res.status || "done") === "done");
        if (backed) {
          seg.held = false;
          panel.repaint(item);
          panel.riseText(item, seg);
        } else {
          seg.text = "";
          seg.held = false;
          panel.repaint(item);
        }
        if (waiting) {
          item.paused = true;
          break;
        }
        // 做完就收：這一批全是寫入、都成功，沒有字盒候選要挑、沒有被互斥擠掉的，而且模型已經寫好結果的那句話 ——
        // 再問一輪只會換來一句重複的總結（CLI 每輪 3～8 秒）。查詢類（要看結果再決定）照舊接著問。
        if (seg.text.trim() && results.length && results.every((r) => r.write && r.res.status === "done" && !r.res.forModel?.pasted?.unknown?.length && !r.res.forModel?.pasted?.dropped?.length)) break;
        if (hop === MAX_HOPS - 1) item.error = t("這一輪的步驟太多，先停在這裡；要繼續就再交代一次。");
      }
      finalKind = outcomeOf(item).kind;
    } catch (err) {
      item.paused = null;
      for (const s of item.segs) if (s.held) s.text = "";
      if (err?.name === "AbortError" || ctrl.signal.aborted) {
        finalKind = "cancelled";
        item.error = t("已停止。") + (item.steps.some((s) => s.status === "done") ? t("上面打勾的步驟已經做了。") : "");
        for (const s of item.steps) if (s.status === "running") s.status = "cancelled";
      } else {
        finalKind = "failed";
        item.error = err?.message || String(err);
      }
    } finally {
      item.pending = false;
      if (running?.item === item) running = null;
      // 舊對話的這一輪（中途按了新對話）：不存、不畫、不動狀態列，新對話自己的那一份不能被它蓋掉。
      if (live()) {
        halo.clear();
        // 字盒被助手借去找字：這一輪結束、讓人看一眼候選之後，收回原本的搜尋（使用者自己動過就不收）。
        // 停在確認卡時先不收：按了套用之後還會接著做。
        if (!item.paused) {
          const tok = lookTok;
          setTimeout(() => {
            if (running || tok !== lookTok) return;
            lookTok++;
            peeking = false;
            try { ctx.libRestore?.(); } catch { /* 收不回就留著，使用者自己清 */ }
          }, peeking ? 2600 : 0);
        }
        saveChat();
        panel.repaint(item);
        paintOutcome(item, finalKind);
      }
    }
  }

  /** 狀態列和收起時的印章說同一件事（outcomeOf）。收著時純回答也亮一下綠點（有新回覆），打開就淡掉。 */
  function paintOutcome(item, kind = outcomeOf(item).kind) {
    if (!panel) return;
    const text = kind === "cancelled" ? "" : outcomeOf(item).text;
    panel.setState(kind === "answered" ? "idle" : kind, kind === "answered" ? "" : STATUS_ZH[kind], kind === "done" || kind === "partial" || kind === "undone" ? text : "");
    if (panel.isOpen()) return;
    if (kind === "answered") paintChatState(t(STATUS_ZH.replied), "done");
    else paintChatState(text && kind !== "failed" ? text : t(STATUS_ZH[kind] || ""), kind === "undone" ? "done" : kind);
  }

  /**
   * 舊回合精簡：最近兩則使用者訊息起照原樣送，更早的工具結果縮成骨架（長字串截短、長清單留前幾項），
   * 工作台摘要只留一句。每一步都整串重送，舊回合的找牌候選、整個工作台不必每次再讀一遍。
   * 同一則訊息每次縮出來都一樣：供應商的提示詞快取照樣接得上。存起來的對話不動，只動送出去的。
   */
  const KEEP_TURNS = 2;
  const TRIM_OVER = 400; // 位元組；短的結果原樣留
  function shrink(v, depth = 0) {
    if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
    if (Array.isArray(v)) {
      const head = v.slice(0, 6).map((x) => shrink(x, depth + 1));
      return v.length > 6 ? [...head, `…另 ${v.length - 6} 項`] : head;
    }
    if (v && typeof v === "object") {
      if (depth >= 3) return "…";
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shrink(x, depth + 1)]));
    }
    return v;
  }
  function compactOld(messages) {
    const users = [];
    messages.forEach((x, k) => x.role === "user" && users.push(k));
    const keepFrom = users.length > KEEP_TURNS ? users[users.length - KEEP_TURNS] : 0;
    const isRequest = (x) => x.role === "user" && (x.workLine !== undefined || x.content?.startsWith("［目前工作台］"));
    const latestRequest = messages.findLastIndex(isRequest);
    return messages.map((x, k) => {
      if (k < keepFrom && x.role === "tool" && String(x.content || "").length > TRIM_OVER) {
        let body;
        try {
          const v = JSON.parse(x.content);
          body = v && typeof v === "object" && !Array.isArray(v) ? { ...shrink(v), trimmed: true } : { value: shrink(v), trimmed: true };
        } catch {
          body = { text: String(x.content).slice(0, 200) + "…", trimmed: true };
        }
        return { ...x, content: JSON.stringify(body) };
      }
      if (isRequest(x)) {
        const lines = x.content.split("\n");
        if (k < keepFrom) lines[0] = "［當時的工作台摘要已省略（trimmed）］";
        const { workLine, ...message } = x;
        if (k < latestRequest && lines[workLine]?.startsWith(REFERENCE_PREFIX)) {
          try {
            const works = JSON.parse(lines[workLine].slice(REFERENCE_PREFIX.length));
            lines[workLine] = `${REFERENCE_PREFIX}${JSON.stringify(works.map(({ id, name }) => ({ id, name })))}`;
          } catch { /* 配方行遺失時保留歷史原文 */ }
        }
        return { ...message, content: lines.join("\n") };
      }
      return x;
    });
  }

  /**
   * 送出前把歷史剪到伺服器收得下（最多 200 則、整個請求 400 KiB；這裡各留一點餘裕）。
   * 只從前面整段剪：剪到下一則使用者的話為止，助手的工具呼叫和它的結果一定一起留或一起走。
   */
  function fitHistory(system, tools, messages) {
    const enc = new TextEncoder();
    const size = (m) => enc.encode(JSON.stringify({ system, tools, messages: m })).length;
    let m = compactOld(messages);
    while (m.length > 1 && (m.length > 190 || size(m) > 360 * 1024)) {
      const next = m.findIndex((x, k) => k > 0 && x.role === "user");
      if (next <= 0) break;
      m = m.slice(next);
    }
    return m;
  }

  /* ---------- 排字盤（paste_prompt）：字排出來 → 認得的墨成牌名、飛進合成池 → 沒有的飛去字盒找 ---------- */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sortName = (x) => (english ? String(x.tag || x.raw).replace(/_/g, " ") : x.zh || x.raw);
  let lookTok = 0;
  let peeking = false;

  function sortAt(id, i) {
    return panel?.log.querySelector(`.ai-step[data-id="${CSS.escape(String(id))}"] .ai-sort[data-i="${i}"]`) || null;
  }
  // 那顆字現在的位置：聊天室開著、而且那顆在對話框看得到的範圍裡才算（不然牌就在池裡冒出來）。
  function sortRect(id, i) {
    const n = sortAt(id, i);
    if (!n || !panel?.isOpen()) return null;
    const r = n.getBoundingClientRect();
    const box = panel.log.getBoundingClientRect();
    if (!r.width || r.bottom < box.top || r.top > box.bottom) return null;
    return r;
  }

  async function typeset(id, sorts) {
    const item = running?.item;
    const step = item?.steps.find((s) => s.id === id);
    if (!step || !panel) return null;
    step.sorts = sorts.map((x) => ({ ...x }));
    step.sortsFresh = true;
    panel.repaint(item);
    step.sortsFresh = false;
    const row = panel.log.querySelector(`.ai-step[data-id="${CSS.escape(String(id))}"] .ai-sorts`);
    const handle = { rect: (i) => sortRect(id, i) };
    if (!row) return handle;
    const chips = [...row.children];
    const ink = (c) => {
      const x = step.sorts[Number(c.dataset.i)];
      if (x?.kind === "card") c.textContent = sortName(x);
    };
    if (reducedMotion() || !panel.isOpen()) {
      chips.forEach(ink);
      return handle;
    }
    // 一顆一顆排上去（像撿字排進排字盒），整排不超過半秒多；認得的字隨後墨成牌名。
    const gap = Math.max(8, Math.min(24, 300 / Math.max(1, chips.length)));
    chips.forEach((c, k) => {
      c.animate(
        [
          { opacity: 0, transform: "translateY(7px) scale(0.82)", filter: "blur(3px)" },
          { opacity: 1, transform: "translateY(-1px) scale(1.04)", filter: "none", offset: 0.7 },
          { opacity: 1, transform: "none" },
        ],
        { duration: DUR.medium, delay: k * gap, easing: css(CURVE.out), fill: "backwards" }
      );
      if (c.dataset.kind === "card") {
        setTimeout(() => {
          ink(c);
          c.dataset.inked = "true";
          c.animate([{ filter: "blur(1.5px)", opacity: 0.4 }, { filter: "none", opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
        }, k * gap + 160);
      } else if (c.dataset.kind === "muted") {
        setTimeout(() => (c.dataset.inked = "true"), k * gap + 160);
      }
    });
    // 等字排好就放牌（約半秒）：牌從字裡飛出去時，後面幾顆還在墨成牌名，兩件事疊著演，不另外等。
    await sleep(Math.min(520, chips.length * gap + 200));
    return handle;
  }

  function typesetDone(id, sorts) {
    const item = running?.item;
    const step = item?.steps.find((s) => s.id === id);
    if (!step) return;
    step.sorts = sorts.map((x) => ({ ...x }));
    // 就地換狀態（不整則重畫）：牌剛從這幾顆字飛出去，字留下一個空的框。
    for (const x of step.sorts) {
      const n = sortAt(id, x.i);
      if (!n || n.dataset.state === (x.state || "")) continue;
      n.dataset.state = x.state || "";
      if (!reducedMotion()) n.animate([{ transform: "scale(1.08)" }, { transform: "scale(0.94)", offset: 0.5 }, { transform: "none" }], { duration: DUR.medium, delay: Math.min(x.i, 16) * 22, easing: css(CURVE.out) });
    }
  }

  // 一顆字飛到字盒的搜尋框（弧線、途中微微放大），落地時散開。
  function hop(chip, to) {
    const from = chip.getBoundingClientRect();
    const ghost = chip.cloneNode(true);
    ghost.classList.add("ai-sort-ghost");
    // 字離開排字盤：原地留一個空的框（影子帶著字飛走）。
    chip.dataset.state = "away";
    Object.assign(ghost.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, margin: "0", zIndex: "95", pointerEvents: "none" });
    document.body.append(ghost);
    const dx = to.left + 14 - from.left;
    const dy = to.top + to.height / 2 - from.top - from.height / 2;
    const dur = travelTime(Math.hypot(dx, dy)) + 80;
    const lift = Math.min(80, 30 + Math.abs(dx) * 0.06);
    const a = ghost.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(1.18) rotate(-4deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.9)`, opacity: 0.9, offset: 0.92 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0 },
      ],
      { duration: dur, easing: css(CURVE.travel) }
    );
    return a.finished.catch(() => {}).then(() => ghost.remove());
  }

  // 搜尋框裡一個字一個字打出來（不觸發搜尋，打完才一次搜：中途不重畫字盒）。
  async function typeInto(input, text, tok) {
    const s = String(text);
    const step = Math.max(10, Math.min(28, 280 / Math.max(1, s.length)));
    input.value = "";
    for (let k = 1; k <= s.length; k++) {
      if (tok !== lookTok || ctx.libFree?.() === false) return false;
      input.value = s.slice(0, k);
      await sleep(step);
    }
    return true;
  }

  async function lookup(id, list) {
    const tok = ++lookTok;
    const input = document.getElementById("lib-q");
    if (!input || typeof ctx.libPeek !== "function") return;
    for (let k = 0; k < list.length; k++) {
      const l = list[k];
      if (tok !== lookTok) return;
      const chip = sortAt(id, l.i);
      const to = input.getBoundingClientRect();
      const grid = document.getElementById("lib-grid")?.getBoundingClientRect();
      // 字盒看不到（手機收著、捲走了）就不借字盒：結果照樣寫在步驟裡。
      if (!to.width || to.bottom < 0 || to.top > innerHeight || !grid?.width || grid.bottom < 0 || grid.top > innerHeight) return;
      // 你自己在搜尋框打過字了：不再借（不然會把你剛打的蓋掉）。
      if (ctx.libFree?.() === false) return;
      const typedBefore = input.value;
      peeking = true;
      if (!reducedMotion()) {
        if (chip && sortRect(id, l.i)) await hop(chip, to);
        if (tok !== lookTok) return;
        input.closest(".lib-search")?.animate([{ boxShadow: "0 0 0 0 var(--ai-glow)" }, { boxShadow: "0 0 0 6px transparent" }], { duration: DUR.long, easing: css(CURVE.out) });
        if (ctx.libFree?.() === false) return;
        if (!(await typeInto(input, l.query, tok))) {
          if (input.value !== typedBefore && l.query.startsWith(input.value)) input.value = typedBefore;
          return;
        }
      }
      if (!ctx.libPeek(l.query, l.tags)) {
        input.value = typedBefore;
        return;
      }
      if (chip) chip.dataset.state = "look";
      // 好幾個字要找：每個停一下讓人看到候選，再換下一個（助手這時候正在想下一步，不耽誤時間）。
      if (k < list.length - 1) await sleep(1500);
    }
  }

  function safeLabel(call) {
    try {
      const l = runner.label(call) || {};
      const def = (toolMod.TOOL_DEFS || []).find((d) => d.name === call.name);
      return { zh: l.zh || call.name, area: l.area, kind: def?.kind || "write" };
    } catch {
      return { zh: call.name, kind: "write" };
    }
  }

  const undos = new Map();
  /** 作廢所有還沒按的確認：工具層的計畫丟掉（之後按也不會動工作台），畫面上的卡收成「已失效」、排字盤上等確認的劃掉。 */
  function voidConfirms(reason) {
    try {
      runner?.cancelPlans?.();
    } catch {
      /* 工具層還沒載入：本來就沒有計畫 */
    }
    let changed = false;
    for (const i of chat.log) {
      let mine = false;
      i.paused = null;
      for (const c of i.confirms || []) {
        if (c.state !== "open" && c.state !== "busy") continue;
        Object.assign(c, { state: "stale", result: reason || t("這項確認已經失效") });
        const step = (i.steps || []).find((s) => s.id === c.callId);
        if (step) {
          Object.assign(step, { status: "skipped", summary: c.result });
          for (const x of step.sorts || []) if (x.state === "wait") x.state = "miss";
        }
        mine = changed = true;
      }
      if (mine) panel?.repaint(i);
    }
    if (!changed) return;
    saveChat();
    // 狀態列、印章不能還寫「等待確認」。
    if (!running) panel?.setState("idle");
  }

  // 這個按鈕還算數嗎：所屬的那則還在目前的對話裡（按了新對話，舊的節點可能還在淡出）、而且沒有一批工具正在跑。
  function canAct(item) {
    if (!chat.log.includes(item)) return false;
    if (running) {
      toast(t("助手還在做事：這一批做完就能按"));
      return false;
    }
    return true;
  }

  async function addSuggested(item, step, card) {
    if (!runner || card.state === "added" || card.state === "busy" || !canAct(item)) return;
    card.state = "busy";
    panel.repaint(item);
    const uid = `${step.id}:add:${card.tag}:${Date.now().toString(36)}`;
    const lab = safeLabel({ name: "change_pool", args: { add: [card.tag] } });
    const added = { id: uid, label: lab.zh, status: "running", seg: step.seg, kind: "write", by: "user" };
    item.steps.splice(item.steps.indexOf(step) + 1, 0, added);
    panel.repaint(item);
    let res;
    try {
      res = await runner.run({ id: uid, name: "change_pool", args: { add: [card.tag] } }, { turn: { version: ctx.version() } });
    } catch (err) {
      res = { ok: false, status: "failed", summary: friendlyError(err) };
    }
    if (!chat.log.includes(item)) return;
    Object.assign(added, { status: res.status || (res.ok ? "done" : "failed"), summary: res.summary || "", lines: res.lines || [], target: res.target || null, undoable: !!res.undo });
    if (res.ops?.length) added.ops = res.ops;
    if (res.notes?.length) added.notes = res.notes;
    if (res.undo) undos.set(`${item.id}:${uid}`, res.undo);
    if (res.status === "needs_confirm" && res.confirm) item.confirms.push({ ...res.confirm, callId: uid, state: "open" });
    const done = res.ok && (res.status || "done") === "done";
    card.state = done || res.status === "needs_confirm" ? "added" : "";
    if (done && res.target) look(res.target, res.summary);
    chat.messages.push({ role: "user", content: `［使用者按了「加入」］推薦的第 ${card.n} 張「${card.zh}」（${card.tag}）→ ${res.summary || (done ? "完成" : "沒做成")}` });
    saveChat();
    panel.repaint(item);
    paintOutcome(item);
  }

  async function undoStep(item, step) {
    const fn = undos.get(`${item.id}:${step.id}`);
    if (!fn || step.undoing || !canAct(item)) return;
    step.undoing = true;
    try {
      const r = await fn();
      if (r?.ok === false) {
        toast(t(r.reason || r.summary || "這一步現在不能復原"));
        return;
      }
      undos.delete(`${item.id}:${step.id}`);
      step.undoable = false;
      step.status = "undone";
      step.summary = (r && r.summary) || t("已復原");
      chat.messages.push({ role: "user", content: `［使用者按了「復原」］${step.label}：${step.summary}` });
      if (step.by === "user") for (const st of item.steps) for (const c of st.cards || []) if (step.id.startsWith(`${st.id}:add:${c.tag}:`)) c.state = "";
    } catch (err) {
      toast(friendlyError(err));
      return;
    } finally {
      step.undoing = false;
    }
    saveChat();
    panel.repaint(item);
    // 整輪的摘要跟著換（以前復原了，頂部還寫「一次 1 → 3」）；明細裡原本的變更照留。
    paintOutcome(item);
  }

  /**
   * 確認卡按下去：當下鎖住兩顆（處理中），工具層照選擇套用或保留，回來的 status 決定怎麼結案：
   * applied → 那一步打勾；kept → 略過；stale／failed → 寫出失效或失敗的原因。重按沿用第一次的結果（工具層保證）。
   */
  async function decide(item, c, yes) {
    if (c.state !== "open" || !canAct(item)) return;
    c.state = "busy";
    c.choice = yes ? "apply" : "keep";
    panel.repaint(item);
    let res;
    try {
      res = runner ? await runner.confirm(c.token, c.choice) : { ok: false, status: "stale", summary: t("這項確認已經失效") };
    } catch (err) {
      res = { ok: false, status: "failed", summary: friendlyError(err) };
    }
    // 等的時候按了新對話、或關掉實驗功能：這張卡已經不在了，結果不寫回去。
    if (!chat.log.includes(item) || c.state !== "busy") return;
    const status = ["applied", "kept", "stale", "failed"].includes(res.status) ? res.status : res.ok ? (yes ? "applied" : "kept") : "failed";
    c.state = status;
    c.result = res.summary || "";
    const step = item.steps.find((s) => s.id === c.callId);
    if (step) {
      const stepStatus = status === "applied" ? "done" : status === "kept" ? "skipped" : "failed";
      Object.assign(step, { status: stepStatus, summary: res.summary || step.summary, lines: res.lines || step.lines, target: res.target || step.target, undoable: status === "applied" && !!res.undo });
      if (status === "applied" && res.ops?.length) Object.assign(step, { ops: res.ops, notes: res.notes || [] });
      if (status === "applied" && res.changes) step.changes = res.changes;
      // 排字盤上「等確認」的那幾顆：套用了照真的池子打勾或劃掉；保留、失效、失敗就是略過（劃掉）。
      if (step.sorts) {
        const inPool = new Set((ctx.state().pool || []).map((p) => p.tag));
        for (const x of step.sorts) if (x.kind === "card" && x.state === "wait") x.state = status === "applied" && inPool.has(x.tag) ? "set" : "miss";
      }
    }
    if (status === "applied" && res.undo) undos.set(`${item.id}:${c.callId}`, res.undo);
    if (status === "applied" && res.target) look(res.target, res.summary);
    const said = {
      applied: `［使用者按了「套用」］${c.prompt} → ${res.summary || "完成"}`,
      kept: `［使用者選了「保留原狀」］${c.prompt}`,
      stale: `［使用者按了「${yes ? "套用" : "保留原狀"}」，但這項確認已經失效］${c.prompt} → ${res.summary || ""}`,
      failed: `［使用者按了「套用」，但沒做成］${c.prompt} → ${res.summary || ""}`,
    }[status];
    chat.messages.push({ role: "user", content: said });
    saveChat();
    panel.repaint(item);
    paintOutcome(item);
    // 這一輪是停在確認卡上的：決定好了（而且沒有別張卡還開著），接著讓模型做剩下的。
    if (item.paused && !running && !item.confirms.some((x) => x.state === "open") && chat.log.includes(item)) {
      item.paused = null;
      hops(chat, item, turnContext(chat));
    }
  }

  /** 「看變更」：捲到那一塊、亮一下。手機上先收起聊天室再定位（不然面板蓋住）。 */
  let lookFrom = null;
  function look(target, label, stepId = null) {
    const node = nodeFor(target);
    if (node === GONE) return toast(t("這張成品已移除"));
    if (!node) return toast(t("那一塊現在不在畫面上"));
    if (matchMedia("(max-width: 40rem)").matches) {
      lookFrom = stepId;
      panel?.close();
    }
    node.scrollIntoView({ block: "center", behavior: reducedMotion() ? "instant" : "smooth" });
    setTimeout(() => halo.show(node, "done", label || ""), reducedMotion() ? 0 : 320);
  }

  function highlight(target, phase, label) {
    if (phase === "clear") return halo.clear();
    const node = nodeFor(target);
    if (!node || node === GONE) return;
    halo.show(node, phase, label ? t(label) : "");
  }

  /* ---------- 對話存在這個分頁 ---------- */
  function loadChat() {
    try {
      const v = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "null");
      if (v && Array.isArray(v.messages) && Array.isArray(v.log)) {
        // 重新整理時還在跑的那一輪：當成停了（請求已經斷了）
        // 檢查點存的是做到一半的樣子：沒做完的步驟收成「已取消」，做完的照留，並說清楚哪些已經生效。
        for (const i of v.log) {
          if (!i.pending) continue;
          const done = (i.steps || []).filter((s) => s.status === "done");
          for (const s of i.steps || []) if (s.status === "running") s.status = "cancelled";
          for (const s of i.segs || []) if (s.held) Object.assign(s, { text: "", held: false });
          Object.assign(i, { pending: false, error: done.length ? `重新整理時這一輪停了。已經生效的：${done.map((s) => s.summary || s.label).join("、")}` : "重新整理時這一輪停了。" });
        }
        // 確認計畫在這一頁的記憶體裡：重新整理之後就沒了，卡片收成「已失效」（不是假裝「保留原狀」）。
        for (const i of v.log)
          for (const c of i.confirms || [])
            if (c.state === "open" || c.state === "busy") {
              Object.assign(c, { state: "stale", result: "重新整理之後這項確認已經失效" });
              const step = (i.steps || []).find((s) => s.id === c.callId);
              if (step) step.status = "skipped";
            }
        // 復原靠的是這一頁記憶體裡的函式：重新整理之後沒有了，按鈕不能留著按了沒反應。
        for (const i of v.log) {
          i.paused = null;
          for (const s of i.steps || []) s.undoable = false;
        }
        return v;
      }
    } catch {
      /* 讀不懂就重新開始 */
    }
    return { messages: [], log: [] };
  }
  function saveChat() {
    try {
      // 太長就留最近的：sessionStorage 有上限（約 5MB），一輪工具結果可能很長
      while (JSON.stringify(chat).length > 1_500_000 && chat.messages.length > 20) {
        chat.messages.splice(0, 10);
        while (chat.messages.length && chat.messages[0].role !== "user") chat.messages.shift();
        chat.log.splice(0, Math.min(10, chat.log.length - 2));
      }
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(chat));
    } catch {
      /* 存不了：這一頁照樣用 */
    }
  }

  /* ---------- 開頁 ---------- */
  paintEntry();
  paintAskButtons();
  syncShotReferences();
  if (prefs.enabled) {
    refreshStatus();
    if (prefs.open && !matchMedia("(max-width: 40rem)").matches) openPanel();
  }
  // Ctrl+/（Mac ⌘/）：打開或收起聊天室（實驗功能開著時）
  addEventListener("keydown", (e) => {
    if (!prefs.enabled || e.key !== "/" || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    panel?.isOpen() ? panel.close() : openPanel();
  });
}
