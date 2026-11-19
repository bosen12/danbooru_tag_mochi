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

/** 字換掉時淡進來（狀態列、測試結果那行）；字一樣就不動，免得每次重畫都閃一下。 */
export function swapText(node, text) {
  const s = String(text ?? "");
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

export async function openSettings({ thenChat = false } = {}, deps) {
  const { api, getStatus, refreshStatus, getPrefs, openPanel } = deps;
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
      swapText(testLine, t(`讀到 ${(j.models || []).length} 個模型`));
      testLine.dataset.kind = "ok";
      if (!modelIn.value && j.models?.[0]) modelIn.value = j.models[0].id;
    } catch (err) {
      swapText(testLine, err.message);
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
  remote.disabled = getStatus()?.local === false;

  // CLI 偵測（第一次開才偵測；之後按「重新偵測」）
  async function detect() {
    cliBox.replaceChildren(el("p", { class: "ai-muted ai-detecting" }, el("span", { class: "ai-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")), "正在偵測這台電腦上的 CLI…"));
    try {
      const j = await api("/api/assistant/detect", {});
      cliBox.replaceChildren(...(j.clis || []).map(cliRow), el("button", { class: "link-btn ai-redetect", type: "button", onclick: detect }, "重新偵測"));
      if (!reducedMotion())
        [...cliBox.children].forEach((n, k) =>
          n.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: k * 70, easing: css(CURVE.out), fill: "backwards" })
        );
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
    swapText(testLine, pick ? t(`選了：${labelOf(pick)}（按「儲存」才生效）`) : "");
    testLine.dataset.kind = "";
  }
  detect().then(paintPick);
  paintPick();

  async function save() {
    const body = { allowRemote: remote.checked };
    // 選的是 API：照表單現在寫的供應商、網址、模型存（金鑰欄的那把一定跟它一起）。以前沿用按「用這組 API」那時的 pick，
    // 改了網址沒再按一次就測試，新網址的金鑰會被存到舊網址上、送給舊端點。
    if (pick?.kind === "api") {
      pick = { kind: "api", provider: provSel.value, model: modelIn.value.trim() || null, effort: apiEffort.value || null, baseUrl: provSel.value === "custom" ? baseIn.value.trim() || undefined : undefined };
    }
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
      toast(t(`AI 助手用：${labelOf(getStatus()?.connection || pick)}`));
      s.close();
      if (thenChat || getPrefs().open) openPanel();
    } catch (err) {
      swapText(testLine, err.message);
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
      swapText(testLine, t(`測試成功（${Math.round((j.ms || 0) / 100) / 10} 秒）`));
      testLine.dataset.kind = "ok";
    } catch (err) {
      swapText(testLine, err.message);
      testLine.dataset.kind = "err";
    } finally {
      testBtn.disabled = false;
    }
  });
}
