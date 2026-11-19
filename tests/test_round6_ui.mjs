// 第六輪（Astra）畫面上的修正：真的 web6 頁面、假的 API，不連 ComfyUI、不生圖。
//
//   node scripts/test_web6_round6_ui.mjs
//
// LoRA 面板（web/lora.js、lora_scan.py 的 catFolder）：
//   1. 偏好路徑選在 loras 底下的子資料夾（loras/Illustrious），子分類被切成「s/Character」——
//      folder 從 loras 根算、分類從偏好路徑算。伺服器多給 catFolder，前端照它切。
//   2. 選了分類後換底模篩選，那一類篩到 0 張：分類鈕整顆消失（整排沒有一顆亮）、子分類和數字照舊、
//      空的提示還說是底模的問題。改成留一顆「Style 0」、子分類跟著篩、提示說「這一類沒有」、給「看全部分類」。
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { createRequire } from "node:module";
import { homedir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const p of [process.env.PLAYWRIGHT_MODULE, "playwright", resolve(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")].filter(Boolean)) {
    try {
      return require(p);
    } catch {}
  }
  throw new Error("Install Playwright or set PLAYWRIGHT_MODULE");
})();
const root = resolve(import.meta.dirname, "..");
const frontend = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";

const lora = (folder, cat, catFolder, file, base) => ({ folder, category: cat, catFolder, file, name: file.replace(/\.safetensors$/, ""), title: file.replace(/\.safetensors$/, ""), trainedWords: [], base_model: base });
const loras = [
  lora("Illustrious/Character", "Character", "Illustrious/Character", "alice.safetensors", "Illustrious"),
  lora("Illustrious/Character/Genshin", "Character", "Illustrious/Character", "ganyu.safetensors", "Illustrious"),
  lora("Illustrious/Style", "Style", "Illustrious/Style", "ponystyle.safetensors", "Pony"),
];
const models = [{ file: "illustrious.safetensors", ckpt_name: "illustrious.safetensors", title: "Illustrious", format: "illustrious", base_model: "Illustrious" }];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const data = {
      "/api/ping": { ok: true },
      "/api/loras": { items: loras, categories: ["Character", "Style"] },
      "/api/checkpoints": { items: models, current: models[0].ckpt_name },
      "/api/lora-push": { version: 0 },
      // AI（MCP）送的一張畫到一半：手機的換頁鈕「作品冊」要掛進度圈
      "/api/gen/active": { ok: true, jobs: [{ id: "m1", origin: "mcp", state: "running", progress: 0.5 }] },
      "/api/recipes": { ok: true, items: [] },
      "/api/decks": { ok: true, decks: [] },
      "/api/usage": { counts: {}, mine: {}, last: {} },
      "/api/discord/config": { ok: true, configured: false, enabled: false, mode: "webhook" },
      "/api/workflows": { ok: true, items: [] },
      "/api/card-groups": { ok: true, groups: [] },
      "/api/sampling": { ok: true, base: { steps: 28, cfg: 5, sampler_name: "euler", scheduler: "normal" }, hires: { fast: {}, deep: {} } },
    }[url.pathname] || { ok: true, items: [] };
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(data));
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  let file = resolve(root, frontend, name);
  if (!existsSync(file)) file = resolve(root, "web", name);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.setHeader("Content-Type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 400)}`);
  if (!cond) failed++;
};
const labels = (page, sel) => page.locator(sel).evaluateAll((ns) => ns.map((n) => n.textContent.trim()));

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route(/\/api\/(?:gen|interrupt)(?:\?|$)/, (r) => r.abort());
  await context.addInitScript(() => {
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.language.v1", "zh-Hant");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/index.html");
  await page.waitForFunction(() => !("booting" in document.documentElement.dataset));
  await page.locator("#lora-pick-btn").click();
  await page.locator("#lm-tools [data-base='all']").waitFor();
  await page.locator("#lm-tools [data-base='all']").click();

  // 1. 子分類照 catFolder 切
  await page.locator("#lm-cats .lm-cat", { hasText: "Character" }).click();
  const subs = await labels(page, "#lm-subcats .lm-subcat > span:first-child");
  ok("子分類：偏好路徑在子資料夾時照分類的根資料夾切（不是「s/Character」）", JSON.stringify(subs) === JSON.stringify(["全部", "(根目錄)", "Genshin"]), JSON.stringify(subs));

  // 2. 選了 Style，再換成「配合底模」（Illustrious）：Style 篩到 0 張
  await page.locator("#lm-cats .lm-cat", { hasText: "Style" }).click();
  await page.locator("#lm-tools [data-base='match']").click();
  const pressed = await labels(page, "#lm-cats .lm-cat[aria-pressed='true']");
  ok("篩到 0 張：選中的那一類照樣留一顆亮著", pressed.length === 1 && pressed[0].replace(/\s+/g, "") === "Style0", JSON.stringify(pressed));
  ok("篩到 0 張：子分類列跟著篩（沒有東西就不顯示）", (await page.locator("#lm-subcats .lm-subcat").count()) === 0);
  const empty = (await page.locator("#lm-list .lora-empty").textContent()) || "";
  ok("篩到 0 張：說是這一類沒有，不是底模整個沒有", /「Style」裡沒有/.test(empty) && /看全部分類/.test(empty), empty);
  await page.locator("#lm-list .lora-empty button").click();
  const now = await labels(page, "#lm-cats .lm-cat[aria-pressed='true']");
  ok("看全部分類：回到全部、清單有東西", now.length === 1 && now[0].startsWith("全部") && (await page.locator("#lm-list .lora-empty").count()) === 0, JSON.stringify(now));

  // 貼上面板：剛貼上馬上按「換成」，照框裡現在的字（以前預覽晚 120ms，放進去的是上一段）
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.locator("#pool-paste").click();
  const area = page.locator(".paste-text");
  await area.fill("red hair");
  await page.waitForTimeout(300);
  await area.fill("kimono");
  await page.locator(".overlay .btn-primary, .sheet .btn-primary").filter({ hasText: "張牌" }).first().click();
  await page.waitForTimeout(800);
  const pool = await page.locator("#pool-well [data-tag]").evaluateAll((ns) => ns.map((n) => n.dataset.tag));
  ok("貼上：剛改完字馬上按換成，放進去的是現在的字（和服），不是上一段（紅髮）", pool.includes("kimono") && !pool.includes("red hair"), pool.join(","));

  // 手機：AI（MCP）送的進度掛在換頁鈕「作品冊」上
  await page.waitForFunction(() => document.querySelector('.page-switch a[href="album.html"]')?.dataset.gen, null, { timeout: 8000 }).catch(() => {});
  ok("手機：AI 送的畫到一半，作品冊那顆換頁鈕掛進度圈", (await page.locator('.page-switch a[href="album.html"]').getAttribute("data-gen")) === "active");
  ok("沒有頁面錯誤", !errors.length, errors.join("\n"));
  await context.close();
} catch (err) {
  ok("沒有例外", false, err.stack);
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
