/**
 * 墨池 AI 助手的設定視窗（從 assistant.js 拆出來：聊天流程和設定可以分開改）。
 * 選連線（本機 CLI 或自己的 API）、模型、推理強度、測試連線、讓手機也能用。
 * 金鑰只送到墨池伺服器、不會回到網頁。
 *
 * openSettings({ thenChat }, { api, getStatus, refreshStatus, getPrefs, openPanel })
 *   api(path, body)：assistant.js 的 /api/assistant/* 呼叫
 *   getStatus()／refreshStatus()：目前的 /api/assistant/status
 *   getPrefs()：聊天室的偏好（open）
 *   openPanel()：存好之後打開聊天室（thenChat 或原本開著）
 */
import { el, openSheet, toast } from "./ui.js";
import { reducedMotion, DUR, CURVE, css } from "./motion.js";
import { t } from "./i18n.js";

/** 字換掉時淡進來（狀態列、測試結果那行）；字一樣就不動，免得每次重畫都閃一下。比對用譯文：英文畫面上不是中文。 */
export function swapText(node, text) {
  const s = t(String(text ?? ""));
  if (!node || node.textContent === s) return;
  node.textContent = s;
  if (s && !reducedMotion()) node.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
}

// 推理強度：各家接受的值不一樣，跟 assistant.py 的 EFFORTS 同一份（測試會比對）
export const EFFORTS = {
  claude: ["low", "medium", "high", "xhigh", "max"],
  grok: ["low", "medium", "high", "xhigh"],
  codex: ["low", "medium", "high", "xhigh"],
  openai: ["low", "medium", "high", "xhigh"],
  anthropic: ["low", "medium", "high", "xhigh", "max"],
  xai: ["low", "high"],
  custom: ["low", "medium", "high"],
};
// 選單：第一項「預設」＝不帶參數，用 CLI／模型自己的預設
export function effortSelect(provider, value, label) {
  const sel = el("select", { class: "select ai-effort", "aria-label": label, title: "推理強度：越高想得越久、越慢、用量越多" });
  fillEffort(sel, provider, value);
  return sel;
}
export function fillEffort(sel, provider, value) {
  const list = EFFORTS[provider] || [];
  sel.replaceChildren(el("option", { value: "" }, "推理：預設"), ...list.map((e) => el("option", { value: e, dataset: { noI18n: "" } }, e)));
  sel.value = list.includes(value) ? value : "";
  sel.disabled = !list.length;
}

export function labelOf(c) {
  if (!c) return "";
  const names = { claude: "Claude Code", grok: "Grok Build", codex: "Codex", openai: "OpenAI API", anthropic: "Anthropic API", xai: "xAI API", custom: "自訂 API" };
  return `${names[c.provider] || c.provider}${c.kind === "cli" ? " CLI" : ""} · ${c.model || t("預設模型")}${c.effort ? ` · ${c.effort}` : ""}`;
}

// 登入短句照代碼取，不跟隔離說明黏在同一段（黏在一起英文對不到字典）。
const LOGIN_SENTENCE = {
  ok: "已登入",
  no: "沒登入",
  missing: "尚未安裝或找不到執行檔。",
  unconfirmed: "這版 CLI 未能確認登入狀態。",
  catalog: "已查詢模型目錄，登入狀態仍待確認。",
  timeout: "CLI 偵測逾時，請稍後再試。",
  read_failed: "CLI 的狀態讀取失敗。",
};
// 伺服器的 code → 固定的一句。上游原文可能夾路徑，不直接畫出來。
const ERROR_BY_CODE = {
  login: "這套 CLI 尚未登入。請在主機登入後再試。",
  model: "這個模型目前無法使用。請確認模型名稱與帳號權限。",
  key: "API 金鑰缺少、無效或權限不足。請檢查助理設定。",
  timeout: "等待模型回應逾時。請稍後再試。",
  rate: "模型服務暫時限制請求或額度用完了。請稍後再試，或查看帳號額度。",
  format: "模型回應的格式不完整或無法辨識。請重試或換一個模型。",
  unavailable: "目前連不上模型服務。請檢查連線設定後再試。",
  aborted: "已停止等待模型回應。",
  local_only: "這項操作只開放給執行墨池的電腦。",
  too_large: "聊天內容太多了。每次最多 400 KB、200 則訊息，請先清除部分對話。",
  missing: "墨池伺服器還沒有 AI 助手：請把墨池伺服器的視窗關掉再重開",
  eof: "跟墨池伺服器的連線中途斷了，這一段可能不完整。請再送一次。",
  http: "跟墨池伺服器連不上。請確認墨池開著再試。",
};

function loginSentence(c) {
  if (c.loginCode && LOGIN_SENTENCE[c.loginCode]) return LOGIN_SENTENCE[c.loginCode];
  if (c.login === "ok") return LOGIN_SENTENCE.ok;
  if (c.login === "no") return LOGIN_SENTENCE.no;
  return c.loginNote || "";
}
function errorSentence(err) {
  const code = err?.code;
  // format 會帶這一次哪裡不對（網址、強度）；其餘代碼用固定的一句，蓋過上游原文。
  if (code === "format" && err?.message) return err.message;
  if (code && ERROR_BY_CODE[code]) return ERROR_BY_CODE[code];
  return err?.message || ERROR_BY_CODE.unavailable;
}
function apiIdentOf(conn) {
  if (!conn || conn.kind !== "api") return "";
  return `${conn.provider}\n${conn.provider === "custom" ? conn.baseUrl || "" : ""}`;
}

export async function openSettings({ thenChat = false } = {}, deps) {
  let st = deps.getStatus?.() || null;
  if (!st || st.local === undefined) {
    try { st = await deps.refreshStatus(); } catch (err) { st = { ok: false, local: true, code: err.code, error: err.message }; }
  }
  // 這台不是主機：設定端點不對遠端開，齒輪只說明要回主機開哪個開關。
  if (st?.local === false) return openRemote(st, deps);
  return openLocal(thenChat, deps);
}

function rise(node) {
  if (!node || reducedMotion()) return;
  node.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
}

function openRemote(st, deps) {
  const body = el("div", { class: "ai-remote-help" });
  const again = el("button", { class: "btn btn-primary", type: "button" }, "重新檢查");
  const s = openSheet("AI 助手設定", body, { foot: [again] });
  const paint = (state, { replay = true } = {}) => {
    const blocked = state?.local === false && !state.allowRemote;
    again.hidden = !blocked;
    if (blocked) {
      body.replaceChildren(
        el("p", {}, "這台不是主機，主機還沒開放聊天室。"),
        el("p", {}, "請回到主機，打開「AI 助手設定 → 讓手機、別台裝置也能用聊天室」。"),
        el("p", { class: "ai-remote-status", role: "status" })
      );
    } else {
      const conn = state?.connection;
      body.replaceChildren(
        conn
          ? el("p", {}, "這台用主機的連線：", el("span", { dataset: { noI18n: "" } }, conn.label || ""))
          : el("p", {}, "主機已開放聊天室，但還沒選連線。"),
        el("p", { class: "ai-muted" }, "連線和金鑰要在主機上改。")
      );
    }
    if (replay) rise(body);
  };
  paint(st);
  again.addEventListener("click", async () => {
    again.disabled = true;
    let next;
    try { next = await deps.refreshStatus(); } catch (err) { next = { ok: false, local: false, allowRemote: false, code: err.code, error: err.message }; }
    again.disabled = false;
    if (next?.local === false && !next.allowRemote) {
      const line = body.querySelector(".ai-remote-status") || body.appendChild(el("p", { class: "ai-remote-status", role: "status" }));
      if (next?.code && next.code !== "local_only") swapText(line, errorSentence(next));
      else swapText(line, "主機還沒開放。打開之後再查一次。");
      return;
    }
    paint(next);
  });
  return s;
}

async function openLocal(thenChat, deps) {
  const { api, refreshStatus, getPrefs, openPanel } = deps;
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
  let busy = false;
  let lineLocked = false; // 測試結果還在：慢到的偵測不能把它清成「選了」
  const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, "儲存");
  const testBtn = el("button", { class: "btn btn-ghost", type: "button" }, "儲存並測試");
  const s = openSheet("AI 助手設定", body, { wide: true, foot: [testBtn, saveBtn] });

  function showLine(text, kind, code) {
    testLine.dataset.kind = kind || "";
    if (code) testLine.dataset.code = code;
    else delete testLine.dataset.code;
    swapText(testLine, text);
  }
  function showError(err) {
    lineLocked = true;
    showLine(errorSentence(err), "err", err?.code || "");
  }
  function showProblem(message, field) {
    lineLocked = true;
    showLine(message, "err", "");
    if (!field) return;
    field.setAttribute("aria-invalid", "true");
    field.focus();
    // 原因在狀態列淡入；欄位自己閃一下，才知道要改哪裡。
    if (!reducedMotion()) field.animate([{ boxShadow: "0 0 0 3px var(--color-accent)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: DUR.medium, easing: css(CURVE.out) });
  }

  try {
    cfg = await api("/api/assistant/config");
    pick = cfg.connection ? { ...cfg.connection } : null;
  } catch (err) {
    const msg = el("p", { class: "ai-error" });
    cliBox.replaceChildren(msg);
    showError(err);
    swapText(msg, errorSentence(err));
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
  const apiMark = el("span", { class: "ai-picked-mark", hidden: true }, "已選");
  apiBox.append(
    el("div", { class: "ai-api-head" }, apiMark),
    el("div", { class: "ai-api-row" }, el("label", {}, el("span", {}, "供應商"), provSel), el("label", { class: "ai-grow" }, el("span", {}, "模型"), modelIn, modelList), el("label", {}, el("span", {}, "推理強度"), apiEffort)),
    el("div", { class: "ai-api-row" }, el("label", { class: "ai-grow" }, el("span", {}, "API Key"), keyIn, keyState)),
    baseIn,
    el("div", { class: "ai-api-row ai-api-actions" }, listBtn, useApi)
  );

  // 供應商＋自訂端點才是同一條連線。切走就清掉還沒送出的金鑰、舊清單、上一條的模型。
  let listGen = 0;
  let identNow = "";
  let keyFor = null;
  const formIdentity = () => `${provSel.value}\n${provSel.value === "custom" ? baseIn.value.trim() : ""}`;
  function paintApi() {
    baseIn.hidden = provSel.value !== "custom";
    const saved = cfg.connection?.kind === "api" && apiIdentOf(cfg.connection) === formIdentity() && cfg.connection.hasKey;
    swapText(keyState, saved ? "已存一把金鑰（留空就沿用）" : "");
  }
  function fadeModelTo(value) {
    if (modelIn.value === value) return;
    // 值先換掉：淡出還沒播完就按儲存，也不能把上一條的模型跟新供應商一起送出。
    modelIn.value = value;
    modelIn.removeAttribute("aria-invalid");
    if (reducedMotion()) return;
    modelIn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.micro, easing: css(CURVE.exit) });
    modelIn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.short, delay: DUR.micro, easing: css(CURVE.out) });
  }
  function retarget(next) {
    if (next === identNow) return;
    identNow = next;
    listGen += 1;
    if (keyFor !== next) keyIn.value = "";
    modelList.replaceChildren();
    listBtn.disabled = false;
    listBtn.textContent = t("讀模型清單");
    const saved = cfg.connection?.kind === "api" ? apiIdentOf(cfg.connection) : "";
    if (saved === next) fillEffort(apiEffort, provSel.value, cfg.connection.effort || "");
    fadeModelTo(saved === next ? cfg.connection.model || "" : "");
    paintApi();
  }
  function currentApi() {
    return {
      kind: "api",
      provider: provSel.value,
      model: modelIn.value.trim() || null,
      effort: apiEffort.value || null,
      baseUrl: provSel.value === "custom" ? baseIn.value.trim() || undefined : undefined,
    };
  }
  function chooseApi() {
    pick = currentApi();
    paintPick({ fromUser: true });
  }
  if (cfg.connection?.kind === "api") {
    provSel.value = cfg.connection.provider;
    modelIn.value = cfg.connection.model || "";
    baseIn.value = cfg.connection.baseUrl || "";
  }
  paintApi();
  identNow = formIdentity();
  provSel.addEventListener("change", () => {
    fillEffort(apiEffort, provSel.value, "");
    retarget(formIdentity());
    chooseApi();
  });
  apiEffort.addEventListener("change", chooseApi);
  modelIn.addEventListener("input", chooseApi);
  keyIn.addEventListener("input", () => {
    keyFor = formIdentity();
    chooseApi();
  });
  baseIn.addEventListener("input", chooseApi);
  baseIn.addEventListener("change", () => {
    retarget(formIdentity());
    chooseApi();
  });
  listBtn.addEventListener("click", async () => {
    retarget(formIdentity());
    chooseApi();
    const gen = ++listGen;
    const ident = formIdentity();
    const provider = provSel.value;
    listBtn.disabled = true;
    listBtn.textContent = t("讀取中…");
    try {
      const j = await api("/api/assistant/models", { kind: "api", provider, apiKey: keyIn.value.trim() || undefined, baseUrl: baseIn.value.trim() || undefined });
      // 這段等待裡換成另一家（或另一個自訂端點）的話，這份清單作廢。
      if (gen !== listGen || ident !== formIdentity() || (j.provider && j.provider !== provSel.value)) return;
      modelList.replaceChildren(...(j.models || []).map((m) => el("option", { value: m.id, dataset: { noI18n: "" } }, m.label || m.id)));
      showLine(`讀到 ${(j.models || []).length} 個模型`, "ok", "");
      lineLocked = true;
      if (!modelIn.value && j.models?.[0]) fadeModelTo(j.models[0].id);
    } catch (err) {
      if (gen !== listGen || ident !== formIdentity()) return;
      showError(err);
    } finally {
      if (gen === listGen) {
        listBtn.disabled = false;
        listBtn.textContent = t("讀模型清單");
      }
    }
  });
  useApi.addEventListener("click", chooseApi);

  const remote = el("input", { type: "checkbox", role: "switch" });
  remote.checked = !!cfg.allowRemote;
  remoteBox.append(
    el(
      "label",
      { class: "switch ai-remote-switch" },
      remote,
      el("span", { class: "ai-remote-label" }, "讓手機、別台裝置也能用聊天室"),
      el("small", { class: "ai-muted ai-remote-note" }, "（用這台設定的帳號和額度。設定只有在這台電腦上能改）")
    )
  );

  let detectGen = 0;
  async function detect() {
    const gen = ++detectGen;
    cliBox.replaceChildren(el("p", { class: "ai-muted ai-detecting" }, el("span", { class: "ai-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")), "正在偵測這台電腦上的 CLI…"));
    try {
      const j = await api("/api/assistant/detect", {});
      if (gen !== detectGen) return;
      const rows = (j.clis || []).map(cliRow);
      const again = el("button", { class: "link-btn ai-redetect", type: "button" }, "重新偵測");
      again.addEventListener("click", detect);
      cliBox.replaceChildren(...rows, again);
      // 只有新出現的卡上浮一次；重畫選取狀態不再播。
      for (const n of rows) n.dataset.rise = "1";
      if (!reducedMotion()) {
        rows.forEach((n, k) => n.animate(
          [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: DUR.short, delay: k * 50, easing: css(CURVE.out), fill: "backwards" }
        ));
      }
      paintPick();
    } catch (err) {
      if (gen !== detectGen) return;
      const msg = el("p", { class: "ai-error" });
      const again = el("button", { class: "link-btn", type: "button" }, "再試一次");
      again.addEventListener("click", detect);
      cliBox.replaceChildren(msg, again);
      showError(err);
      swapText(msg, errorSentence(err));
    }
  }
  function cliRow(c) {
    const chip = (txt, kind) => el("span", { class: "ai-chip", dataset: { kind } }, txt);
    const loginChip = c.login === "ok" ? chip("已登入", "ok") : c.login === "no" ? chip("沒登入", "err") : chip("登入待確認", "warn");
    const modelSel = el(
      "select",
      { class: "select ai-cli-model", "aria-label": `${c.name} 的模型`, disabled: !c.usable },
      el("option", { value: "" }, "CLI 預設模型"),
      ...(c.models || []).map((m) => el("option", { value: m.id, dataset: { noI18n: "" } }, m.label || m.id))
    );
    const isPicked = () => pick?.kind === "cli" && pick.provider === c.id;
    const effortSel = effortSelect(c.id, isPicked() ? pick.effort : null, `${c.name} 的推理強度`);
    if (!c.usable) effortSel.disabled = true;
    if (isPicked()) modelSel.value = pick.model || "";
    const chooseCli = () => {
      if (!c.usable) return;
      pick = { kind: "cli", provider: c.id, model: modelSel.value || null, effort: effortSel.value || null };
      paintPick({ fromUser: true });
    };
    const use = el("button", { class: "btn btn-small ai-cli-use", type: "button", disabled: !c.usable }, "用這個");
    use.addEventListener("click", chooseCli);
    modelSel.addEventListener("change", chooseCli);
    effortSel.addEventListener("change", chooseCli);
    const loginText = loginSentence(c);
    const notes = [
      c.isolation?.note ? el("p", { class: "ai-cli-note", dataset: { part: "isolation" } }, c.isolation.note) : null,
      c.note ? el("p", { class: "ai-cli-note", dataset: { part: "note" } }, c.note) : null,
      loginText ? el("p", { class: "ai-cli-note", dataset: { part: "login" } }, loginText) : null,
    ];
    return el(
      "div",
      { class: "ai-cli", role: "listitem", dataset: { id: c.id, usable: c.usable ? "true" : "false" } },
      el("div", { class: "ai-cli-name" }, el("span", { class: "ai-picked-mark", hidden: true }, "已選"), el("b", { dataset: { noI18n: "" } }, c.name), c.version ? el("small", { dataset: { noI18n: "" } }, c.version) : null),
      el(
        "div",
        { class: "ai-cli-chips" },
        c.installed ? chip("已安裝", "ok") : chip("沒找到", "err"),
        c.installed ? loginChip : null,
        c.usable ? (c.isolation?.level === "readonly" ? chip("可讀檔、不能改", "warn") : c.isolation ? chip("隔離：不能動電腦", "ok") : null) : chip("不能用來聊天", "err")
      ),
      ...notes,
      el("div", { class: "ai-cli-actions" }, modelSel, effortSel, use)
    );
  }
  function setPicked(node, on) {
    const was = node.dataset.picked === "true";
    node.dataset.picked = on ? "true" : "false";
    const mark = node.querySelector(".ai-picked-mark");
    if (!mark || was === on) return;
    if (on) {
      mark.hidden = false;
      if (!reducedMotion()) mark.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
      return;
    }
    if (reducedMotion()) {
      mark.hidden = true;
      return;
    }
    const anim = mark.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.micro, easing: css(CURVE.exit) });
    anim.onfinish = () => { if (node.dataset.picked !== "true") mark.hidden = true; };
  }
  function paintPick({ fromUser = false } = {}) {
    for (const row of cliBox.querySelectorAll(".ai-cli")) setPicked(row, !!(pick?.kind === "cli" && pick.provider === row.dataset.id));
    setPicked(apiBox, pick?.kind === "api");
    if (busy) return;
    if (lineLocked && !fromUser) return;
    if (fromUser) lineLocked = false;
    showLine(pick ? `選了：${labelOf(pick)}（按「儲存」才生效）` : "", "", "");
  }
  detect();
  paintPick();

  function problem() {
    if (pick?.kind === "api") pick = currentApi();
    if (!pick) return { message: "請先選一條連線。", field: cliBox.querySelector(".ai-cli[data-usable='true'] .ai-cli-model") || modelIn };
    if (pick.kind === "api" && !pick.model) return { message: "請填這組 API 的模型。", field: modelIn };
    return null;
  }
  async function save() {
    retarget(formIdentity());
    if (pick?.kind === "api") pick = currentApi();
    const payload = { allowRemote: remote.checked };
    if (pick) {
      payload.connection = { ...pick };
      if (pick.kind === "api" && keyIn.value.trim()) payload.connection.apiKey = keyIn.value.trim();
    }
    cfg = await api("/api/assistant/config", payload);
    keyIn.value = "";
    keyFor = null;
    identNow = formIdentity();
    paintApi();
    await refreshStatus();
  }
  saveBtn.addEventListener("click", async () => {
    retarget(formIdentity());
    const bad = problem();
    if (bad) {
      showProblem(bad.message, bad.field);
      return;
    }
    saveBtn.disabled = true;
    try {
      await save();
      toast(t(`AI 助手用：${labelOf(deps.getStatus()?.connection || pick)}`));
      s.close();
      if (thenChat || getPrefs().open) openPanel();
    } catch (err) {
      showError(err);
    } finally {
      saveBtn.disabled = false;
    }
  });
  testBtn.addEventListener("click", async () => {
    retarget(formIdentity());
    const bad = problem();
    if (bad) {
      showProblem(bad.message, bad.field);
      return;
    }
    busy = true;
    lineLocked = true;
    saveBtn.disabled = testBtn.disabled = true;
    testLine.dataset.kind = "";
    delete testLine.dataset.code;
    testLine.replaceChildren(el("span", { class: "ai-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")), t("先存下這組設定，再送一則固定的小測試（可能用到一點額度）…"));
    try {
      await save();
      const j = await api("/api/assistant/test", {});
      showLine(`測試成功（${Math.round((j.ms || 0) / 100) / 10} 秒）`, "ok", "");
    } catch (err) {
      showError(err);
    } finally {
      busy = false;
      saveBtn.disabled = testBtn.disabled = false;
    }
  });
}
