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
import { reducedMotion, DUR, CURVE, css } from "./motion.js";
import { english, t } from "./i18n.js";
import { registerLab } from "./lab.js";

const STORE_KEY = "mochi.assistant.v1";
const CHAT_KEY = "mochi.assistant.chat.v1";
const MAX_HOPS = 12; // 一輪最多幾次工具往返：模型繞圈時停下來，不要一直燒額度
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
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
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
      if (phase === "done") fadeT = setTimeout(() => this.clear(), reducedMotion() ? 1400 : 1800);
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

/** 工具回的 target（area＋key）→ 畫面上的那一塊。找不到回 null（不亮，不報錯）。 */
function nodeFor(target) {
  if (!target) return null;
  const { area, key } = target;
  const q = (s) => document.querySelector(s);
  const visibleNode = (n) => (n && n.getClientRects().length ? n : null);
  if (area === "lib") return visibleNode(q("#library")) || visibleNode(q("#lib-grid"));
  if (area === "pool") return visibleNode(q("#pool-well"));
  if (area === "wall") return visibleNode(q("#wall .shot")) || visibleNode(q("#wall-head"));
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
};

/* ================= 主體 ================= */

export function mountAssistant({ ctx }) {
  const tools = document.getElementById("mast-tools");
  if (!tools || !ctx) return;
  let prefs = readPrefs();
  let status = null; // /api/assistant/status
  let panel = null;
  let running = null; // { ctrl, turn }
  let toolMod = null;
  let promptMod = null;
  const halo = createHalo();

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
  function paintEntry() {
    if (prefs.enabled) {
      if (!group.isConnected) {
        const sound = document.getElementById("sound-btn");
        tools.insertBefore(group, sound && sound.parentElement === tools ? sound : tools.firstChild);
      }
      document.documentElement.dataset.ai = "on";
    } else {
      group.remove();
      delete document.documentElement.dataset.ai;
    }
  }

  function setEnabled(on) {
    prefs = { ...prefs, enabled: on, open: on ? prefs.open : false };
    writePrefs(prefs);
    if (!on) {
      stopTurn("cancelled");
      panel?.close();
      halo.clear();
      toast("實驗功能關了：聊天室收起，還沒執行的助手操作都取消");
    } else {
      toast("實驗功能開了：頂欄多了一顆朱色印章（墨池助手），字盒、合成池多了「問助理」");
      refreshStatus();
    }
    paintEntry();
    paintAskButtons();
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
        return q ? { kind: "search", label: `字盒搜尋「${q}」`, query: q } : { kind: "lib", label: "字盒" };
      },
    ],
  ];
  let askBtns = [];
  function paintAskButtons() {
    if (!prefs.enabled) {
      for (const b of askBtns) b.remove();
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
      askBtns.push(b);
    }
  }

  /* ---------- 設定 ---------- */
  async function openSettings({ thenChat = false } = {}) {
    const body = el("div", { class: "ai-setup" });
    const intro = el(
      "p",
      { class: "ai-setup-intro" },
      "選一條連線讓助手用：這台電腦上的 Claude Code、Grok Build、Codex，或自己的 API 金鑰。",
      el("br"),
      el("small", {}, "就算是本機的 CLI，對話內容也會送到該家公司的雲端處理。金鑰只放在墨池伺服器上，網頁看不到。")
    );
    const cliBox = el("div", { class: "ai-clis", role: "list" }, el("p", { class: "ai-muted" }, "正在偵測這台電腦上的 CLI…"));
    const apiBox = el("div", { class: "ai-api" });
    const remoteBox = el("div", { class: "ai-remote" });
    const testLine = el("p", { class: "ai-test-line", role: "status", "aria-live": "polite" });
    body.append(intro, el("h3", { class: "ai-h3" }, "本機 CLI"), cliBox, el("h3", { class: "ai-h3" }, "自己的 API"), apiBox, remoteBox, testLine);

    let cfg = null;
    let pick = null; // { kind, provider, model, effort, baseUrl }
    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, "儲存");
    const testBtn = el("button", { class: "btn btn-ghost", type: "button" }, "測試連線");
    const s = openSheet("AI 助手設定", body, { wide: true, foot: [testBtn, saveBtn] });

    try {
      cfg = await api("/api/assistant/config");
      pick = cfg.connection ? { ...cfg.connection } : null;
    } catch (err) {
      cliBox.replaceChildren(el("p", { class: "ai-error" }, err.message));
      apiBox.replaceChildren();
      saveBtn.disabled = testBtn.disabled = true;
      return;
    }

    // API 表單
    const PROVIDERS = [
      ["openai", "OpenAI"],
      ["anthropic", "Anthropic"],
      ["xai", "xAI"],
      ["custom", "相容 OpenAI 的自訂端點"],
    ];
    const provSel = el("select", { class: "select", "aria-label": "供應商" }, PROVIDERS.map(([v, l]) => el("option", { value: v }, l)));
    const modelList = el("datalist", { id: "ai-model-list" });
    const modelIn = el("input", { class: "ai-field", type: "text", list: "ai-model-list", placeholder: "模型 ID（例如 gpt-5、claude-opus-5-5）", "aria-label": "模型", autocomplete: "off", spellcheck: "false" });
    const apiEffort = effortSelect(cfg.connection?.kind === "api" ? cfg.connection.provider : "openai", cfg.connection?.kind === "api" ? cfg.connection.effort : null, "API 的推理強度");
    const keyIn = el("input", { class: "ai-field", type: "password", placeholder: "API Key（只送到墨池伺服器）", "aria-label": "API Key", autocomplete: "off" });
    const keyState = el("small", { class: "ai-muted" });
    const baseIn = el("input", { class: "ai-field", type: "url", placeholder: "Base URL（例如 https://example.com/v1）", "aria-label": "Base URL", autocomplete: "off", hidden: true });
    const listBtn = el("button", { class: "btn btn-small btn-ghost", type: "button" }, "讀模型清單");
    const useApi = el("button", { class: "btn btn-small", type: "button" }, "用這組 API");
    apiBox.append(
      el("div", { class: "ai-api-row" }, el("label", {}, el("span", {}, "供應商"), provSel), el("label", { class: "ai-grow" }, el("span", {}, "模型"), modelIn, modelList), el("label", {}, el("span", {}, "推理強度"), apiEffort)),
      el("div", { class: "ai-api-row" }, el("label", { class: "ai-grow" }, el("span", {}, "API Key"), keyIn, keyState)),
      baseIn,
      el("div", { class: "ai-api-row ai-api-actions" }, listBtn, useApi)
    );
    const paintApi = () => {
      baseIn.hidden = provSel.value !== "custom";
      const saved = cfg.connection?.kind === "api" && cfg.connection.provider === provSel.value;
      keyState.textContent = saved && cfg.connection.hasKey ? "已存一把金鑰（留空就沿用）" : "";
    };
    if (cfg.connection?.kind === "api") {
      provSel.value = cfg.connection.provider;
      modelIn.value = cfg.connection.model || "";
      baseIn.value = cfg.connection.baseUrl || "";
    }
    paintApi();
    provSel.addEventListener("change", () => {
      paintApi();
      fillEffort(apiEffort, provSel.value, apiEffort.value);
      if (pick?.kind === "api") pick = { ...pick, provider: provSel.value, effort: apiEffort.value || null };
    });
    apiEffort.addEventListener("change", () => {
      if (pick?.kind === "api") {
        pick = { ...pick, effort: apiEffort.value || null };
        paintPick();
      }
    });
    listBtn.addEventListener("click", async () => {
      listBtn.disabled = true;
      listBtn.textContent = "讀取中…";
      try {
        const j = await api("/api/assistant/models", { kind: "api", provider: provSel.value, apiKey: keyIn.value.trim() || undefined, baseUrl: baseIn.value.trim() || undefined });
        modelList.replaceChildren(...(j.models || []).map((m) => el("option", { value: m.id }, m.label || m.id)));
        testLine.textContent = t(`讀到 ${(j.models || []).length} 個模型`);
        testLine.dataset.kind = "ok";
        if (!modelIn.value && j.models?.[0]) modelIn.value = j.models[0].id;
      } catch (err) {
        testLine.textContent = err.message;
        testLine.dataset.kind = "err";
      } finally {
        listBtn.disabled = false;
        listBtn.textContent = t("讀模型清單");
      }
    });
    useApi.addEventListener("click", () => {
      pick = { kind: "api", provider: provSel.value, model: modelIn.value.trim() || null, effort: apiEffort.value || null, baseUrl: baseIn.value.trim() || undefined };
      paintPick();
    });

    // 只限這台電腦：手機要用得先在這台打開
    const remote = el("input", { type: "checkbox", role: "switch" });
    remote.checked = !!cfg.allowRemote;
    remoteBox.append(
      el(
        "label",
        { class: "switch ai-remote-switch" },
        remote,
        "讓手機、別台裝置也能用聊天室",
        el("small", { class: "ai-muted" }, "（用這台設定的帳號和額度。設定只有在這台電腦上能改）")
      )
    );
    remote.disabled = status?.local === false;

    // CLI 偵測（第一次開才偵測；之後按「重新偵測」）
    async function detect() {
      cliBox.replaceChildren(el("p", { class: "ai-muted ai-detecting" }, el("span", { class: "ai-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")), "正在偵測這台電腦上的 CLI…"));
      try {
        const j = await api("/api/assistant/detect", {});
        cliBox.replaceChildren(...(j.clis || []).map(cliRow), el("button", { class: "link-btn ai-redetect", type: "button", onclick: detect }, "重新偵測"));
      } catch (err) {
        cliBox.replaceChildren(el("p", { class: "ai-error" }, err.message), el("button", { class: "link-btn", type: "button", onclick: detect }, "再試一次"));
      }
    }
    function cliRow(c) {
      const chip = (txt, kind) => el("span", { class: "ai-chip", dataset: { kind } }, txt);
      const loginChip = c.login === "ok" ? chip("已登入", "ok") : c.login === "no" ? chip("沒登入", "err") : chip("登入待確認", "warn");
      const modelSel = el(
        "select",
        { class: "select ai-cli-model", "aria-label": `${c.name} 的模型`, disabled: !c.usable },
        el("option", { value: "" }, "CLI 預設模型"),
        ...(c.models || []).map((m) => el("option", { value: m.id }, m.label || m.id))
      );
      const isPicked = () => pick?.kind === "cli" && pick.provider === c.id;
      const effortSel = effortSelect(c.id, isPicked() ? pick.effort : null, `${c.name} 的推理強度`);
      if (!c.usable) effortSel.disabled = true;
      if (isPicked()) modelSel.value = pick.model || "";
      const use = el("button", { class: "btn btn-small", type: "button", disabled: !c.usable }, "用這個");
      use.addEventListener("click", () => {
        pick = { kind: "cli", provider: c.id, model: modelSel.value || null, effort: effortSel.value || null };
        paintPick();
      });
      modelSel.addEventListener("change", () => {
        if (isPicked()) {
          pick = { ...pick, model: modelSel.value || null };
          paintPick();
        }
      });
      effortSel.addEventListener("change", () => {
        if (isPicked()) {
          pick = { ...pick, effort: effortSel.value || null };
          paintPick();
        }
      });
      return el(
        "div",
        { class: "ai-cli", role: "listitem", dataset: { id: c.id, usable: c.usable ? "true" : "false" } },
        el("div", { class: "ai-cli-name" }, el("b", { dataset: { noI18n: "" } }, c.name), c.version ? el("small", { dataset: { noI18n: "" } }, c.version) : null),
        el(
          "div",
          { class: "ai-cli-chips" },
          c.installed ? chip("已安裝", "ok") : chip("沒找到", "err"),
          c.installed ? loginChip : null,
          c.usable ? (c.isolation?.level === "readonly" ? chip("可讀檔、不能改", "warn") : c.isolation ? chip("隔離：不能動電腦", "ok") : null) : chip("不能用來聊天", "err")
        ),
        // 這條連線的模型能碰到什麼（伺服器照實回報）：使用者選之前要看得到
        c.isolation?.note || c.note || c.loginNote ? el("p", { class: "ai-cli-note" }, [c.isolation?.note, c.note, c.loginNote].filter(Boolean).join("　")) : null,
        el("div", { class: "ai-cli-actions" }, modelSel, effortSel, use)
      );
    }
    function paintPick() {
      for (const row of cliBox.querySelectorAll(".ai-cli")) row.dataset.picked = pick?.kind === "cli" && pick.provider === row.dataset.id ? "true" : "false";
      apiBox.dataset.picked = pick?.kind === "api" ? "true" : "false";
      testLine.textContent = pick ? t(`選了：${labelOf(pick)}（按「儲存」才生效）`) : "";
      testLine.dataset.kind = "";
    }
    detect().then(paintPick);
    paintPick();

    async function save() {
      const body = { allowRemote: remote.checked };
      if (pick) {
        body.connection = { ...pick };
        if (pick.kind === "api" && keyIn.value.trim()) body.connection.apiKey = keyIn.value.trim();
      }
      cfg = await api("/api/assistant/config", body);
      keyIn.value = "";
      paintApi();
      await refreshStatus();
    }
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await save();
        toast(t(`AI 助手用：${labelOf(status?.connection || pick)}`));
        s.close();
        if (thenChat || prefs.open) openPanel();
      } catch (err) {
        testLine.textContent = err.message;
        testLine.dataset.kind = "err";
      } finally {
        saveBtn.disabled = false;
      }
    });
    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      testLine.dataset.kind = "";
      testLine.replaceChildren(el("span", { class: "ai-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")), t("先存下這組設定，再送一則固定的小測試（可能用到一點額度）…"));
      try {
        await save();
        const j = await api("/api/assistant/test", {});
        testLine.textContent = t(`測試成功（${Math.round((j.ms || 0) / 100) / 10} 秒）`);
        testLine.dataset.kind = "ok";
      } catch (err) {
        testLine.textContent = err.message;
        testLine.dataset.kind = "err";
      } finally {
        testBtn.disabled = false;
      }
    });
  }

  // 推理強度：各家接受的值不一樣，跟 assistant.py 的 EFFORTS 同一份（測試會比對）
  const EFFORTS = {
    claude: ["low", "medium", "high", "xhigh", "max"],
    grok: ["low", "medium", "high", "xhigh"],
    codex: ["low", "medium", "high", "xhigh"],
    openai: ["low", "medium", "high", "xhigh"],
    anthropic: ["low", "medium", "high", "xhigh", "max"],
    xai: ["low", "high"],
    custom: ["low", "medium", "high"],
  };
  // 選單：第一項「預設」＝不帶參數，用 CLI／模型自己的預設
  function effortSelect(provider, value, label) {
    const sel = el("select", { class: "select ai-effort", "aria-label": label, title: "推理強度：越高想得越久、越慢、用量越多" });
    fillEffort(sel, provider, value);
    return sel;
  }
  function fillEffort(sel, provider, value) {
    const list = EFFORTS[provider] || [];
    sel.replaceChildren(el("option", { value: "" }, "推理：預設"), ...list.map((e) => el("option", { value: e, dataset: { noI18n: "" } }, e)));
    sel.value = list.includes(value) ? value : "";
    sel.disabled = !list.length;
  }

  function labelOf(c) {
    if (!c) return "";
    const names = { claude: "Claude Code", grok: "Grok Build", codex: "Codex", openai: "OpenAI API", anthropic: "Anthropic API", xai: "xAI API", custom: "自訂 API" };
    return `${names[c.provider] || c.provider}${c.kind === "cli" ? " CLI" : ""} · ${c.model || t("預設模型")}${c.effort ? ` · ${c.effort}` : ""}`;
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
    const sendBtn = el("button", { class: "ai-send", type: "button", title: "送出", "aria-label": "送出", html: ICON.send });
    const foot = el("div", { class: "ai-foot" }, refs, el("div", { class: "ai-compose" }, input, sendBtn), el("p", { class: "ai-hint" }, "問意見只回答；說「幫我加入」「改成」「建立」「抽」才會動工作台。"));
    const grip = el("div", { class: "ai-grip", "aria-hidden": "true" });
    const root = el("aside", { class: "ai-panel", id: "ai-panel", "aria-label": "墨池助手", hidden: true, tabindex: "-1" }, grip, head, log, foot);
    document.body.append(root);
    let pendingRefs = [];

    newBtn.addEventListener("click", () => {
      if (running) stopTurn("cancelled");
      chat = { messages: [], log: [] };
      saveChat();
      renderLog();
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
      conn.textContent = status?.ok === false ? status.error || "" : c ? labelOf(c) : t("還沒選連線");
      conn.dataset.kind = status?.ok === false ? "err" : c ? "ok" : "warn";
    }

    function setState(kind, text = "", step = "") {
      stateBar.dataset.kind = kind;
      stateText.textContent = text || STATUS_ZH[kind] || "";
      stepText.textContent = step ? `· ${step}` : "";
      sendBtn.innerHTML = running ? ICON.stop : ICON.send;
      sendBtn.title = running ? t("停止") : t("送出");
      sendBtn.setAttribute("aria-label", sendBtn.title);
      sendBtn.dataset.running = running ? "true" : "false";
      // 收起時的狀態：開啟鍵旁邊寫目前這一步
      if (!api_.isOpen()) paintChatState(step || (kind !== "idle" ? STATUS_ZH[kind] : ""), kind);
      else paintChatState("");
    }

    function addRef(ref) {
      if (!ref || pendingRefs.some((r) => r.kind === ref.kind && r.label === ref.label)) return;
      pendingRefs.push(ref);
      paintRefs();
      input.focus();
    }
    function paintRefs() {
      refs.hidden = !pendingRefs.length;
      refs.replaceChildren(
        ...pendingRefs.map((r, i) =>
          el(
            "span",
            { class: "ai-ref" },
            el("span", r.kind === "search" ? { dataset: { noI18n: "" } } : {}, r.label),
            el("button", { type: "button", class: "ai-ref-x", "aria-label": t(`拿掉「${r.label}」`), html: ICON.close, onclick: () => (pendingRefs.splice(i, 1), paintRefs()) })
          )
        )
      );
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
      return el(
        "div",
        { class: "ai-empty" },
        el("div", { class: "ai-empty-mark", html: ICON.seal }),
        el("p", { class: "ai-empty-title" }, "交代一件事，或問一個問題"),
        el("p", { class: "ai-muted" }, "助手讀的是你現在的合成池和規則，動手前會照你的話做，做了什麼都會列出來。"),
        el("div", { class: "ai-samples" }, sample("我現在有哪些牌？會抽幾張？"), sample("你覺得還可以加入哪些牌？"), sample("幫我把適合海邊的服裝建立一個群組"), sample("長相改成 3 張，這次只抽牌"))
      );
    }
    function renderItem(item) {
      if (item.role === "user")
        return el(
          "div",
          { class: "ai-msg ai-user" },
          item.refs?.length ? el("div", { class: "ai-msg-refs" }, ...item.refs.map((r) => el("span", { class: "ai-ref is-static" }, r.label))) : null,
          el("div", { class: "ai-bubble", dataset: { noI18n: "" } }, item.text)
        );
      if (item.role === "note") return el("div", { class: "ai-note", dataset: { kind: item.kind || "" } }, item.text);
      // 助手的一則：文字（串流進來）＋這一輪的步驟
      const node = el("div", { class: "ai-msg ai-bot", dataset: { id: item.id } });
      node.append(el("div", { class: "ai-avatar", html: ICON.seal }));
      const col = el("div", { class: "ai-col" });
      node.append(col);
      for (const seg of item.segs || []) {
        if (seg.text) col.append(richText(seg.text));
        const steps = (item.steps || []).filter((st) => st.seg === seg.n);
        if (steps.length) col.append(stepsNode(item, steps));
      }
      if (item.error) col.append(el("p", { class: "ai-error" }, item.error));
      for (const c of item.confirms || []) col.append(confirmNode(item, c));
      if (item.pending) col.append(el("div", { class: "ai-typing", "aria-hidden": "true" }, el("i"), el("i"), el("i")));
      return node;
    }
    function stepsNode(item, steps) {
      const ol = el("ol", { class: "ai-steps" });
      for (const s of steps) {
        const li = el(
          "li",
          { class: "ai-step", dataset: { status: s.status } },
          el("i", { class: "ai-step-dot", "aria-hidden": "true" }),
          // 進行中寫「正在…」；做完了直接寫結果（摘要），明細裡跟摘要一樣的那行不重複
          el(
            "div",
            {},
            el("b", {}, s.status === "running" || !s.summary ? s.label : s.summary),
            ...(s.lines || []).filter((l) => l && l !== s.summary).map((l) => el("span", { class: "ai-step-line" }, l))
          )
        );
        if (s.target && s.status !== "running") {
          li.append(el("button", { class: "link-btn ai-step-look", type: "button", onclick: () => look(s.target, s.summary || s.label) }, "看變更"));
        }
        if (s.undoable && s.status === "done") {
          li.append(el("button", { class: "link-btn ai-step-undo", type: "button", onclick: () => undoStep(item, s) }, "復原"));
        }
        ol.append(li);
      }
      return ol;
    }
    function confirmNode(item, c) {
      const box = el("div", { class: "ai-confirm", dataset: { state: c.state || "open" } }, el("p", {}, c.prompt));
      if (c.lines?.length) box.append(el("ul", {}, ...c.lines.map((l) => el("li", {}, l))));
      if (!c.state || c.state === "open") {
        const yes = el("button", { class: "btn btn-small btn-primary", type: "button" }, c.choices?.[0] || "套用");
        const no = el("button", { class: "btn btn-small btn-ghost", type: "button" }, c.choices?.[1] || "保留原狀");
        yes.addEventListener("click", () => decide(item, c, true));
        no.addEventListener("click", () => decide(item, c, false));
        box.append(el("div", { class: "ai-confirm-actions" }, yes, no));
      } else box.append(el("p", { class: "ai-muted" }, c.state === "applied" ? c.result || "已套用" : "保留原狀"));
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
      const fresh = renderItem(item);
      if (old) old.replaceWith(fresh);
      else {
        log.querySelector(".ai-empty")?.remove();
        log.append(fresh);
      }
      scrollDown();
    }

    async function send() {
      const text = input.value.trim();
      if (!text || running) return;
      if (!status) await refreshStatus();
      if (status?.ok === false || !status?.connection) {
        chat.log.push({ role: "note", kind: "warn", text: status?.ok === false ? status.error : t("還沒選連線：先到「AI 助手設定」選一條。") });
        renderLog();
        if (status?.ok !== false) openSettings({ thenChat: true });
        return;
      }
      input.value = "";
      grow();
      const usedRefs = pendingRefs;
      pendingRefs = [];
      paintRefs();
      await runTurn(text, usedRefs);
    }

    const api_ = {
      isOpen: () => !root.hidden && root.dataset.state !== "closing",
      open() {
        if (api_.isOpen()) return input.focus();
        placeTop();
        root.hidden = false;
        root.dataset.state = "open";
        document.documentElement.dataset.aiPanel = "open";
        chatBtn.setAttribute("aria-expanded", "true");
        renderLog();
        paintHead();
        refreshStatus();
        paintChatState("");
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
      },
      close() {
        if (root.hidden) return;
        root.dataset.state = "closing";
        chatBtn.setAttribute("aria-expanded", "false");
        delete document.documentElement.dataset.aiPanel;
        prefs = { ...prefs, open: false };
        writePrefs(prefs);
        setTimeout(() => {
          if (root.dataset.state === "closing") root.hidden = true;
        }, reducedMotion() ? 0 : DUR.medium);
        if (running) paintChatState(stepText.textContent.replace(/^· /, "") || STATUS_ZH[stateBar.dataset.kind], stateBar.dataset.kind);
        chatBtn.focus({ preventScroll: true });
      },
      addRef,
      paintHead,
      setState,
      repaint,
      renderLog,
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
      return `［目前工作台］合成池 ${s.poolCount} 張：${pool}｜一次 ${s.settings.n}｜每段補牌：${counts}｜分級 ${s.settings.rating}${s.settings.ratingFree ? "（不限制開著）" : ""}｜尺度 ${(s.settings.heats || []).join("、") || "—"}｜群組勾選 ${groups || "沒有"}`;
    } catch {
      return "";
    }
  }

  function stopTurn(why) {
    if (!running) return;
    running.ctrl.abort();
    running.cancelled = why;
  }

  async function runTurn(text, refs) {
    if (!(await loadTools())) {
      chat.log.push({ role: "note", kind: "err", text: t("助手的工具層還沒準備好（assistant-tools.js 讀不到）。") });
      panel.renderLog();
      return;
    }
    runner ||= toolMod.createToolRunner({ ...ctx, highlight: (target, phase, label) => highlight(target, phase, label) });
    const refText = refs.length ? `［使用者指著］${refs.map((r) => r.label).join("、")}\n` : "";
    chat.messages.push({ role: "user", content: `${workspaceNote()}\n${refText}${text}` });
    chat.log.push({ role: "user", text, refs });
    const item = { role: "bot", id: `t${Date.now().toString(36)}`, segs: [], steps: [], confirms: [], pending: true };
    chat.log.push(item);
    panel.renderLog();
    const ctrl = new AbortController();
    running = { ctrl, item };
    // 這則訊息送出那一刻的工作台版本：整輪的工具共用同一個物件。之後使用者自己動了合成池、規則，
    // 依賴舊狀態的寫入會回 stale（assistant-tools.js），模型先重讀再做。
    const turn = { version: ctx.version() };
    panel.setState("thinking", "", t("讀你的訊息"));
    const system = promptMod.buildSystemPrompt({ lang: english ? "en" : "zh", room: "mochi", now: new Date().toISOString() });
    const toolsForModel = toolMod.toolSchemas();
    let wrote = false;
    let finalKind = "answered";
    try {
      for (let hop = 0; hop < MAX_HOPS; hop++) {
        const seg = { text: "", n: hop };
        item.segs.push(seg);
        let calls = [];
        await streamChat({ system, tools: toolsForModel, messages: chat.messages }, ctrl.signal, (event, data) => {
          if (event === "status") panel.setState("thinking", "", data.stage === "connecting" ? t("連線中") : t("想一想"));
          else if (event === "text") {
            seg.text += data.delta || "";
            panel.repaint(item);
          } else if (event === "tool_calls") calls = Array.isArray(data.calls) ? data.calls : [];
          else if (event === "error") throw Object.assign(new Error(data.error || "模型出錯"), { code: data.code });
        });
        chat.messages.push({ role: "assistant", content: seg.text, ...(calls.length ? { toolCalls: calls } : {}) });
        if (!calls.length) break;
        for (const call of calls) {
          if (ctrl.signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
          const lab = safeLabel(call);
          const step = { id: call.id, label: lab.zh, status: "running", seg: hop };
          item.steps.push(step);
          panel.setState(lab.kind === "read" ? "reading" : "working", "", lab.zh);
          panel.repaint(item);
          let res;
          try {
            res = await runner.run(call, { signal: ctrl.signal, turn });
          } catch (err) {
            res = { ok: false, status: "failed", summary: friendlyError(err), forModel: { ok: false, error: String(err?.message || err) } };
          }
          Object.assign(step, { status: res.status || (res.ok ? "done" : "failed"), summary: res.summary || "", lines: res.lines || [], target: res.target || null, undoable: !!res.undo });
          if (res.undo) undos.set(`${item.id}:${call.id}`, res.undo);
          if (res.status === "needs_confirm" && res.confirm) item.confirms.push({ ...res.confirm, callId: call.id, state: "open" });
          if (lab.kind !== "read" && res.ok) wrote = true;
          chat.messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: JSON.stringify(res.forModel ?? { ok: !!res.ok, status: res.status }) });
          panel.repaint(item);
        }
        if (hop === MAX_HOPS - 1) item.error = t("這一輪的步驟太多，先停在這裡；要繼續就再交代一次。");
      }
      const st = item.steps.map((s) => s.status);
      finalKind = item.confirms.some((c) => c.state === "open") ? "confirm" : st.includes("failed") ? (st.includes("done") ? "partial" : "failed") : wrote ? "done" : "answered";
    } catch (err) {
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
      running = null;
      halo.clear();
      saveChat();
      panel.repaint(item);
      const last = item.steps.filter((s) => s.status === "done").at(-1);
      panel.setState(finalKind === "answered" ? "idle" : finalKind, finalKind === "answered" ? "" : STATUS_ZH[finalKind], finalKind === "done" ? last?.summary || "" : "");
      if (!panel.isOpen() && finalKind !== "answered") paintChatState(finalKind === "done" ? last?.summary || STATUS_ZH.done : STATUS_ZH[finalKind], finalKind);
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
  async function undoStep(item, step) {
    const fn = undos.get(`${item.id}:${step.id}`);
    if (!fn) return;
    try {
      const r = await fn();
      undos.delete(`${item.id}:${step.id}`);
      step.undoable = false;
      step.status = "undone";
      step.summary = (r && r.summary) || t("已復原");
      chat.messages.push({ role: "user", content: `［使用者按了「復原」］${step.label}：${step.summary}` });
    } catch (err) {
      toast(friendlyError(err));
    }
    saveChat();
    panel.repaint(item);
  }

  async function decide(item, c, yes) {
    if (!yes) {
      c.state = "kept";
      chat.messages.push({ role: "user", content: `［使用者選了「保留原狀」］${c.prompt}` });
    } else {
      try {
        const res = await runner.confirm(c.token);
        c.state = res.ok ? "applied" : "kept";
        c.result = res.summary || "";
        const step = item.steps.find((s) => s.id === c.callId);
        if (step) Object.assign(step, { status: res.status || (res.ok ? "done" : "failed"), summary: res.summary || step.summary, lines: res.lines || step.lines, target: res.target || step.target, undoable: !!res.undo });
        if (res.undo) undos.set(`${item.id}:${c.callId}`, res.undo);
        if (res.target) look(res.target, res.summary);
        chat.messages.push({ role: "user", content: `［使用者按了「套用」］${c.prompt} → ${res.summary || (res.ok ? "完成" : "沒做成")}` });
      } catch (err) {
        toast(friendlyError(err));
        return;
      }
    }
    saveChat();
    panel.repaint(item);
    panel.setState(c.state === "applied" ? "done" : "idle", c.state === "applied" ? STATUS_ZH.done : "", c.result || "");
  }

  /** 「看變更」：捲到那一塊、亮一下。手機上先收起聊天室再定位（不然面板蓋住）。 */
  function look(target, label) {
    const node = nodeFor(target);
    if (!node) return toast(t("那一塊現在不在畫面上"));
    if (matchMedia("(max-width: 40rem)").matches) panel?.close();
    node.scrollIntoView({ block: "center", behavior: reducedMotion() ? "instant" : "smooth" });
    setTimeout(() => halo.show(node, "done", label || ""), reducedMotion() ? 0 : 320);
  }

  function highlight(target, phase, label) {
    if (phase === "clear") return halo.clear();
    const node = nodeFor(target);
    if (!node) return;
    halo.show(node, phase, label ? t(label) : "");
  }

  /* ---------- 對話存在這個分頁 ---------- */
  function loadChat() {
    try {
      const v = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "null");
      if (v && Array.isArray(v.messages) && Array.isArray(v.log)) {
        // 重新整理時還在跑的那一輪：當成停了（請求已經斷了）
        for (const i of v.log) if (i.pending) Object.assign(i, { pending: false, error: "重新整理時這一輪停了。" });
        for (const i of v.log) for (const c of i.confirms || []) if (c.state === "open") c.state = "kept";
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
