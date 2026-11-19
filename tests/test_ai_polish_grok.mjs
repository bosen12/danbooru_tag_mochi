// 丙（設定、手機、英文）的回歸：第 4、13、14、19、20 項。
// 真的設定模組（assistant-settings.js）＋假的 /api/assistant，不讀 data/、不叫真 CLI 或 API。
//
//   node scripts/test_ai_polish_grok.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const p of [process.env.PLAYWRIGHT_MODULE, "playwright", resolve(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")].filter(Boolean)) {
    try { return require(p); } catch { /* 下一個路徑 */ }
  }
  throw new Error("Install Playwright or set PLAYWRIGHT_MODULE");
})();

const root = resolve(import.meta.dirname, "..");
const ISO = {
  claude: "模型的本機工具、MCP 和斜線指令都已關閉。",
  grok: "模型的本機工具、MCP 和網頁搜尋都已關閉（實測沒有任何工具）。",
  codex: "已停用 shell 工具並使用唯讀沙箱。這條連線的模型理論上能讀這台電腦的檔案（不能改）。",
};
const state = {
  status: { ok: true, local: true, allowRemote: false, configured: false, connection: null },
  config: { ok: true, connection: null, allowRemote: false },
  clis: [],
  models: {},
  modelStatus: 200,
  modelBody: null,
  testBody: { ok: true, ms: 800 },
  hold: {},
  entered: {},
  release: {},
  hits: [],
};

function reset(patch = {}) {
  state.status = { ok: true, local: true, allowRemote: false, configured: false, connection: null };
  state.config = { ok: true, connection: null, allowRemote: false };
  state.clis = patch.clis || [cli("codex")];
  state.models = patch.models || { openai: [{ id: "gpt-from-a", label: "From A" }], anthropic: [{ id: "claude-b", label: "From B" }] };
  state.modelStatus = patch.modelStatus || 200;
  state.modelBody = patch.modelBody || null;
  state.testBody = { ok: true, ms: 800 };
  state.hold = {};
  state.entered = {};
  state.release = {};
  state.hits = [];
  if (patch.status) state.status = patch.status;
  if (patch.config) state.config = patch.config;
}

function cli(id, extra = {}) {
  const names = { claude: "Claude Code", grok: "Grok Build", codex: "Codex" };
  return {
    id, name: names[id] || id, installed: true, version: "9.8.7", login: "ok", loginCode: "ok", loginNote: "已登入。",
    usable: true, models: [{ id: "fake-model", label: "Fake model with a long readable name" }],
    isolation: { level: id === "codex" ? "readonly" : "strict", note: ISO[id] || ISO.codex },
    ...extra,
  };
}

function waitHold(key) {
  if (!state.hold[key]) return Promise.resolve();
  state.entered[key] = true;
  return new Promise((resolveHold) => { state.release[key] = resolveHold; });
}

const HARNESS = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="/language.js"></script>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/assistant.css">
</head>
<body>
<script type="module">
import { openSettings } from "/assistant-settings.js";
const api = async (path, body) => {
  const r = await fetch(path, body === undefined
    ? { cache: "no-store" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw Object.assign(new Error(j.error || ("HTTP " + r.status)), { code: j.code || "http", status: r.status });
  return j;
};
window.openAiSettings = async () => {
  try {
    await openSettings({}, {
      api,
      getStatus: () => window.__status,
      refreshStatus: async () => { window.__status = await api("/api/assistant/status"); return window.__status; },
      getPrefs: () => ({ open: false }),
      openPanel: () => { window.__panel = true; },
    });
    window.__openedSettings = true;
  } catch (err) {
    window.__openError = String(err && err.stack || err);
  }
};
window.__ready = true;
</script>
</body>
</html>`;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const send = (v, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(v)); };
  if (url.pathname === "/ai-polish-harness.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HARNESS);
    return;
  }
  if (url.pathname.startsWith("/api/assistant/")) {
    const action = url.pathname.slice("/api/assistant/".length);
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : null;
    state.hits.push({ action, method: req.method, body });
    if (req.method === "GET" && action === "status") return send(state.status);
    if (req.method === "GET" && action === "config") return send(state.config);
    if (action === "config" && req.method === "POST") {
      state.config = { ok: true, connection: body.connection || null, allowRemote: !!body.allowRemote };
      return send(state.config);
    }
    if (action === "detect") {
      await waitHold("detect");
      return send({ ok: true, clis: state.clis });
    }
    if (action === "models") {
      await waitHold("models");
      if (state.modelStatus !== 200) return send(state.modelBody || { ok: false, code: "key", error: "sk-secret leaked in error" }, state.modelStatus);
      const list = state.models[body?.provider] || [];
      const out = { ok: true, models: list, source: "list", provider: body?.provider };
      if (body?.baseUrl) out.baseUrl = body.baseUrl;
      return send(out);
    }
    if (action === "test") {
      await waitHold("test");
      return send(state.testBody);
    }
    return send({ ok: false, code: "unavailable", error: "no" }, 404);
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, "");
  let file = resolve(root, "web6", name);
  if (!existsSync(file)) file = resolve(root, "web", name);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});

async function listen() {
  for (let i = 0; i < 5; i++) {
    try {
      await new Promise((resolveListen, reject) => {
        const onErr = (err) => { server.off("listening", onOk); reject(err); };
        const onOk = () => { server.off("error", onErr); resolveListen(); };
        server.once("error", onErr);
        server.listen(0, "127.0.0.1", onOk);
      });
      return;
    } catch (err) {
      if (i === 4 || !/EACCES|EADDRINUSE|10013|ERR_NETWORK/.test(String(err && err.code || err))) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}
await listen();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 400)}`);
  if (!cond) failed++;
};
async function until(fn, ms = 4000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}
// 某一項失敗就記下來，繼續看後面的項（waitFor 逾時不要把整份結果打斷）。
async function seen(page, fn, ms = 4000) {
  try {
    await page.waitForFunction(fn, null, { timeout: ms });
    return true;
  } catch {
    return false;
  }
}
async function readText(locator) {
  try { return await locator.innerText({ timeout: 800 }); } catch { return ""; }
}

async function openSettings({ lang = "zh-Hant", viewport = { width: 1280, height: 800 }, motion = "no-preference", status } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: motion, locale: lang === "en" ? "en-US" : "zh-TW" });
  await context.addInitScript(({ lang, status }) => {
    try { localStorage.setItem("mochi.language.v1", lang); } catch { /* 測試環境有 storage */ }
    window.__status = status;
    const orig = Element.prototype.animate;
    window.__animLog = [];
    Element.prototype.animate = function (kf, opt) {
      window.__animLog.push({ cls: String(this.className || ""), kf });
      return orig.call(this, kf, opt);
    };
  }, { lang, status: status || state.status });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(origin + "/ai-polish-harness.html");
  await page.waitForFunction(() => window.__ready);
  await page.evaluate(() => window.openAiSettings());
  await page.locator(".sheet").waitFor();
  return { context, page, errors };
}

try {
  // ---------- 4. 切換供應商清掉草稿，慢回來的清單不能套到下一家 ----------
  reset();
  state.hold.models = true;
  {
    const { context, page } = await openSettings();
    await page.locator(".ai-api").waitFor();
    await page.locator("input[aria-label='API Key']").fill("draft-secret");
    await page.locator("input[aria-label='模型']").fill("typed-old");
    await page.locator("select[aria-label='供應商']").selectOption("anthropic");
    const cleared = await page.evaluate(() => ({
      key: document.querySelector("input[aria-label='API Key']").value,
      anims: window.__animLog.filter((a) => String(a.cls).includes("ai-field")).length,
    }));
    ok("4 切換供應商立刻清掉密碼欄", cleared.key === "", cleared.key);
    ok("4 模型欄有淡出再進來", cleared.anims > 0, String(cleared.anims));
    ok("4 換供應商清掉舊模型", await seen(page, () => document.querySelector("input[aria-label='模型']").value === ""));

    await page.locator("select[aria-label='供應商']").selectOption("openai");
    await page.locator("input[aria-label='API Key']").fill("draft-secret");
    await page.getByRole("button", { name: "讀模型清單" }).click();
    ok("4 清單請求停在舊連線", await until(() => state.entered.models));
    await page.locator("select[aria-label='供應商']").selectOption("xai");
    state.release.models();
    await page.waitForResponse((r) => r.url().endsWith("/api/assistant/models"));
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({
      model: document.querySelector("input[aria-label='模型']").value,
      opts: [...document.querySelectorAll("#ai-model-list option")].map((n) => n.value),
      key: document.querySelector("input[aria-label='API Key']").value,
    }));
    ok("4 慢清單不寫進新供應商的模型欄", after.model !== "gpt-from-a", after.model);
    ok("4 慢清單不留在新供應商的選項", !after.opts.includes("gpt-from-a"), after.opts.join(","));
    ok("4 切走之後密碼仍是空的", after.key === "", after.key);

    await page.locator("select[aria-label='供應商']").selectOption("custom");
    await page.locator("input[aria-label='Base URL']").fill("http://127.0.0.1:9/v1");
    await page.locator("input[aria-label='API Key']").fill("secret-a");
    await page.locator("input[aria-label='Base URL']").fill("http://127.0.0.1:8/v1");
    await page.locator("input[aria-label='Base URL']").blur();
    ok("4 換自訂端點清掉密碼", (await page.locator("input[aria-label='API Key']").inputValue()) === "");
    await context.close();
  }

  // ---------- 13. 連線列、沒選不關窗、儲存並測試會鎖兩個鈕 ----------
  reset({ clis: [cli("claude"), cli("grok"), cli("codex")] });
  {
    const { context, page } = await openSettings();
    await page.locator(".ai-cli").first().waitFor();
    const before = state.hits.filter((h) => h.action === "config" && h.method === "POST").length;
    await page.getByRole("button", { name: "儲存", exact: true }).click();
    const stayed = await page.locator(".overlay").count();
    const line = await page.locator(".ai-test-line").innerText();
    const active = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.className || "");
    ok("13 沒選連線不關窗", stayed === 1);
    ok("13 沒選連線會說原因", /請先選一條連線/.test(line), line);
    ok("13 沒選連線定位到欄位", /模型/.test(active), active);
    ok("13 沒選連線不會送出", state.hits.filter((h) => h.action === "config" && h.method === "POST").length === before);

    await page.locator(".ai-cli[data-id='grok'] .ai-cli-model").selectOption("fake-model");
    const picked = await page.locator(".ai-cli[data-id='grok']").getAttribute("data-picked").catch(() => null);
    const mark = await readText(page.locator(".ai-cli[data-id='grok'] .ai-picked-mark"));
    ok("13 動到模型就選該列", picked === "true");
    ok("13 已選標記看得到", mark === "已選", mark);

    const modelField = page.locator("input[aria-label='模型']");
    if (await modelField.count()) {
      await modelField.fill("api-model");
      ok("13 編輯 API 表單改選 API", (await page.locator(".ai-api").getAttribute("data-picked")) === "true");
      ok("13 CLI 列不再是已選", (await page.locator(".ai-cli[data-id='grok']").getAttribute("data-picked")) === "false");
      await modelField.fill("");
      await page.getByRole("button", { name: "儲存", exact: true }).click();
      ok("13 API 缺模型不關窗", (await page.locator(".overlay").count()) === 1);
      ok("13 API 缺模型定位到模型欄", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "模型"));
      ok("13 API 缺模型淡入原因", /請填這組 API 的模型/.test(await readText(page.locator(".ai-test-line"))));
      await modelField.fill("api-model");
    } else {
      ok("13 編輯 API 表單改選 API", false, "沒有模型欄");
      ok("13 CLI 列不再是已選", false, "沒有模型欄");
      ok("13 API 缺模型不關窗", false, "沒有模型欄");
      ok("13 API 缺模型定位到模型欄", false, "沒有模型欄");
      ok("13 API 缺模型淡入原因", false, "沒有模型欄");
    }

    const testBtn = page.getByRole("button", { name: "儲存並測試", exact: true });
    ok("13 測試鈕寫儲存並測試", (await testBtn.count()) === 1);
    if (await testBtn.count()) {
      state.hold.test = true;
      await testBtn.click();
      const locked = await page.evaluate(() => [...document.querySelectorAll(".sheet-foot .btn")].every((b) => b.disabled));
      ok("13 測試中兩個提交鈕都鎖住", locked);
      ok("13 測試請求已送到", await until(() => state.entered.test));
      state.release.test?.();
      ok("13 測試結果有寫出來", await seen(page, () => /測試成功/.test(document.querySelector(".ai-test-line")?.textContent || "")));
      const posted = state.hits.filter((h) => h.method === "POST" && (h.action === "config" || h.action === "test")).map((h) => h.action);
      ok("13 測試會先存再測", posted.join(",") === "config,test" || posted.join(",").includes("config,test"), posted.join(","));
      ok("13 測的是後來選的 API", state.hits.find((h) => h.action === "config" && h.method === "POST")?.body?.connection?.kind === "api");
    } else {
      ok("13 測試中兩個提交鈕都鎖住", false, "沒有「儲存並測試」");
      ok("13 測試請求已送到", false, "沒有「儲存並測試」");
      ok("13 測試結果有寫出來", false, "沒有「儲存並測試」");
      ok("13 測試會先存再測", false, "沒有「儲存並測試」");
      ok("13 測的是後來選的 API", false, "沒有「儲存並測試」");
    }
    await context.close();
  }

  // 慢偵測不能蓋掉測試結果
  reset({
    config: { ok: true, allowRemote: false, connection: { kind: "cli", provider: "codex", model: "fake-model", effort: null } },
    status: { ok: true, local: true, allowRemote: false, configured: true, connection: { kind: "cli", provider: "codex", model: "fake-model", label: "Codex · fake-model" } },
  });
  state.hold.detect = true;
  state.hold.test = true;
  {
    const { context, page } = await openSettings();
    await page.locator(".ai-setup").waitFor();
    const testBtn = page.getByRole("button", { name: "儲存並測試", exact: true });
    if (await testBtn.count()) {
      await testBtn.click();
      ok("13 偵測還沒回來就能開始測", await until(() => state.entered.test));
      state.release.test?.();
      ok("13 慢偵測期間測得到", await seen(page, () => /測試成功/.test(document.querySelector(".ai-test-line")?.textContent || "")));
      state.release.detect?.();
      await page.locator(".ai-cli").first().waitFor({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(50);
      ok("13 慢偵測不蓋掉測試結果", /測試成功/.test(await readText(page.locator(".ai-test-line"))));
    } else {
      state.release.detect?.();
      ok("13 偵測還沒回來就能開始測", false, "沒有「儲存並測試」");
      ok("13 慢偵測期間測得到", false, "沒有「儲存並測試」");
      ok("13 慢偵測不蓋掉測試結果", false, "沒有「儲存並測試」");
    }
    await context.close();
  }

  // ---------- 14. 遠端、主機沒開放：簡短說明 ----------
  reset({
    status: { ok: true, local: false, allowRemote: false, configured: true, connection: { kind: "cli", provider: "codex", model: null, label: "Codex · 預設模型" } },
  });
  {
    const { context, page } = await openSettings({
      viewport: { width: 390, height: 844 },
      status: state.status,
    });
    const text = await page.locator(".sheet").innerText();
    ok("14 遠端說明指出主機上的那個開關", /AI 助手設定 → 讓手機、別台裝置也能用聊天室/.test(text), text.slice(0, 300));
    const again = page.getByRole("button", { name: "重新檢查" });
    ok("14 有重新檢查", (await again.count()) === 1);
    ok("14 不打開金鑰和 CLI 表單", (await page.locator("input[aria-label='API Key'], .ai-cli").count()) === 0);
    ok("14 遠端不向主機要設定", !state.hits.some((h) => h.action === "config" || h.action === "detect"));
    if (await again.count()) {
      state.status = { ...state.status, allowRemote: false };
      await again.click();
      ok("14 還沒開放會再說明一次", await seen(page, () => /主機還沒開放/.test(document.body.innerText)));
      state.status = { ok: true, local: false, allowRemote: true, configured: true, connection: { kind: "cli", provider: "codex", model: null, label: "Codex · 預設模型" } };
      await again.click();
      const opened = await seen(page, () => /Codex · 預設模型/.test(document.body.innerText));
      ok("14 開放後只顯示連線", opened && (await page.locator("input[aria-label='API Key']").count()) === 0);
    } else {
      ok("14 還沒開放會再說明一次", false, "沒有重新檢查");
      ok("14 開放後只顯示連線", false, "沒有重新檢查");
    }
    await context.close();
  }

  // ---------- 19 + 20. 390 英文不溢出；隔離和登入分開、錯誤依 code ----------
  reset({ clis: [cli("claude"), cli("grok"), cli("codex")] });
  state.modelStatus = 401;
  state.modelBody = { ok: false, code: "key", error: "sk-secret leaked in error" };
  {
    const { context, page, errors } = await openSettings({
      lang: "en",
      viewport: { width: 390, height: 844 },
      motion: "no-preference",
    });
    ok("19 CLI 卡標了上浮", await seen(page, () => document.querySelectorAll(".ai-cli[data-rise='1']").length === 3));
    const rise = await page.evaluate(() => window.__animLog.filter((a) => String(a.cls).includes("ai-cli") && !String(a.cls).includes("ai-cli-")).length);
    ok("19 偵測完成每張 CLI 卡上浮", rise >= 3, String(rise));
    const layout = await page.evaluate(() => {
      const sheet = document.querySelector(".sheet");
      const row = document.querySelector(".ai-cli");
      const box = (n) => {
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, right: r.right };
      };
      const name = box(row?.querySelector(".ai-cli-name"));
      const chips = box(row?.querySelector(".ai-cli-chips"));
      const model = box(row?.querySelector(".ai-cli-model"));
      const effort = box(row?.querySelector(".ai-effort"));
      const use = box(row?.querySelector(".ai-cli-use"));
      const note = box(document.querySelector(".ai-remote-note"));
      const label = box(document.querySelector(".ai-remote-label"));
      if (!sheet || !name || !chips || !model || !effort || !use || !note || !label) return { missing: true };
      return {
        overflow: sheet.scrollWidth - sheet.clientWidth,
        nameTop: name.top, chipsTop: chips.top, modelTop: model.top, modelW: model.width,
        effortTop: effort.top, useTop: use.top, effortLeft: effort.left, useLeft: use.left,
        noteTop: note.top, labelBottom: label.bottom, noteRight: note.right, edge: sheet.getBoundingClientRect().right,
      };
    });
    ok("19 390 英文設定沒有橫向溢出", layout.overflow <= 1, JSON.stringify(layout));
    ok("19 名稱在登入標記上面", layout.chipsTop >= layout.nameTop + 8, JSON.stringify(layout));
    ok("19 模型選單獨一行而且讀得到", layout.modelTop >= layout.chipsTop + 4 && layout.modelW > 160, JSON.stringify(layout));
    ok("19 強度和使用並排", Math.abs(layout.effortTop - layout.useTop) < 12 && layout.useLeft > layout.effortLeft, JSON.stringify(layout));
    ok("19 遠端說明另起一行且不伸出", layout.noteTop >= layout.labelBottom - 1 && layout.noteRight <= layout.edge + 1, JSON.stringify(layout));

    const parts = await page.locator(".ai-cli[data-id='codex']").evaluate((row) => ({
      login: row.querySelector("[data-part='login']")?.textContent || "",
      isolation: row.querySelector("[data-part='isolation']")?.textContent || "",
      joined: [...row.querySelectorAll(".ai-cli-note")].some((n) => /已停用 shell/.test(n.textContent) && /已登入|Signed in/.test(n.textContent)),
    }));
    ok("20 登入短句自己一節、英文翻得出來", parts.login === "Signed in", parts.login);
    ok("20 隔離說明自己一節、英文整句翻得出來", parts.isolation === "Shell tools are off and the sandbox is read-only. This connection's model can read files on this computer, but it cannot change them.", parts.isolation);
    ok("20 隔離和登入不再接成同一句", parts.joined === false);
    ok("20 儲存鈕是獨立的字（Save）", (await page.getByRole("button", { name: "Save", exact: true }).count()) === 1);
    ok("20 測試鈕是獨立的「儲存並測試」（Save and test）", (await page.getByRole("button", { name: "Save and test", exact: true }).count()) === 1);
    await page.locator("input[aria-label='API key (sent only to the Ink Pool server)'], input[aria-label='API Key']").first().fill("x");
    await page.getByRole("button", { name: /Load models|讀模型清單/ }).click();
    ok("20 錯誤列帶 code", await seen(page, () => document.querySelector(".ai-test-line")?.dataset.code === "key"));
    const errText = await page.locator(".ai-test-line").innerText();
    // 整句已進 en.js：畫面是那句的英文，不是上游的 sk-secret。
    ok("20 錯誤依 code，不顯示上游原文", errText === "The API key is missing, invalid, or not permitted. Check the assistant settings." && !/sk-secret/.test(errText), errText);
    ok("20 這頁沒有腳本錯誤", errors.length === 0, errors.join(" | "));
    await context.close();
  }

  // 減少動態：卡還是標好，但不播上浮
  reset({ clis: [cli("codex")] });
  {
    const { context, page } = await openSettings({ motion: "reduce" });
    ok("19 減少動態仍標上浮已處理", await seen(page, () => document.querySelector(".ai-cli")?.dataset.rise === "1"));
    const rise = await page.evaluate(() => window.__animLog.filter((a) => /(^| )ai-cli( |$)/.test(String(a.cls))).length);
    ok("19 減少動態時 CLI 卡不上浮", rise === 0, String(rise));
    await context.close();
  }
} catch (err) {
  failed++;
  console.log("FAIL 測試本身中斷\n     " + (err && err.stack || err));
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `${failed} failed` : "all ok");
process.exit(failed ? 1 : 0);
