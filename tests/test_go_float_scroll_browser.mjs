// 底部浮動列（抽並生圖）：捲走時浮出來，捲回來主按鈕整顆回到畫面裡就要收起（2026-11-19 專案主：「滾回去卻不會消失」）。
// 以前只靠 IntersectionObserver：整排一露全（比例到 1）就不再回報，那一刻主按鈕常常還在底邊那 8px 裡，算成看不到，
// 之後主按鈕明明回到畫面裡，浮動列卻一直留著。
//
//   node scripts/test_go_float_scroll_browser.mjs           # 現在的程式
//   BASELINE=HEAD node scripts/test_go_float_scroll_browser.mjs   # 拿某一版的 web6/app.js 對照（舊版應該紅）
//
// 假伺服器、不連 ComfyUI；/api/gen、/api/interrupt 一律擋。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
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
const baseline = process.env.BASELINE ? execFileSync("git", ["show", `${process.env.BASELINE}:web6/app.js`], { cwd: root, maxBuffer: 2 ** 24 }) : null;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (v) => (res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(v)));
  if (url.pathname.startsWith("/api/")) {
    const data = {
      "/api/ping": { ok: true },
      "/api/gen/active": { ok: true, jobs: [] },
      "/api/recipes": { ok: true, items: [] },
      "/api/decks": { ok: true, decks: [] },
      "/api/usage": { counts: {}, mine: {}, last: {} },
      "/api/lora-push": { version: 0 },
      "/api/discord/config": { ok: true, configured: false, enabled: false, mode: "webhook" },
      "/api/workflows": { ok: true, items: [] },
      "/api/checkpoints": { items: [] },
      "/api/loras": { items: [], categories: [] },
      "/api/card-groups": { ok: true, groups: [] },
      "/api/sampling": { ok: true, base: { steps: 28, cfg: 5, sampler_name: "euler", scheduler: "normal" }, hires: { fast: {}, deep: {} } },
    }[url.pathname] || { ok: true, items: [] };
    return json(data);
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  if (baseline && name === "app.js") return res.writeHead(200, { "Content-Type": "text/javascript" }), res.end(baseline);
  let file = resolve(root, "web6", name);
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
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 500)}`);
  if (!cond) failed++;
};
const errors = [];

try {
  for (const [label, viewport] of [["電腦", { width: 1440, height: 900 }], ["手機", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: label === "手機", hasTouch: label === "手機" });
    await context.route(/\/api\/(?:gen|interrupt)(?:\?|$)/, (r) => r.abort());
    await context.addInitScript(() => {
      localStorage.setItem("mochi.tour.declined.v1", "99");
      localStorage.setItem("mochi.language.v1", "zh-Hant");
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/index.html?debug");
    await page.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0 && window.mochi);
    // 池裡有牌，浮動列才會在電腦上出來；頁面底下墊一段，捲得夠遠。
    await page.evaluate(() => {
      window.mochi.pin(window.mochi.lib().cards.find((c) => c.suit !== "chara").tag);
      const pad = document.createElement("div");
      pad.style.height = "3000px";
      document.body.append(pad);
    });
    await page.waitForTimeout(500);
    const shown = () => page.evaluate(() => document.getElementById("go-float").dataset.show === "true");
    const mainRect = () => page.evaluate(() => document.querySelector("#go-bar .btn-primary").getBoundingClientRect().toJSON());

    // 主按鈕在畫面裡的捲動位置（頂欄底下一點）
    const home = await page.evaluate(() => {
      const r = document.querySelector("#go-bar .btn-primary").getBoundingClientRect();
      return Math.max(0, Math.round(scrollY + r.top - innerHeight / 2));
    });
    await page.evaluate((y) => scrollTo(0, y), home);
    await page.waitForTimeout(300);
    ok(`${label}：主按鈕在畫面裡，浮動列收著`, !(await shown()));

    // 往下捲到主按鈕不見：浮出來
    await page.evaluate((y) => scrollTo(0, y + 1600), home);
    await page.waitForTimeout(400);
    ok(`${label}：捲走看不到主按鈕，浮動列浮出來`, await shown());

    // 一點一點往回捲（像滑鼠滾輪）：每一步都看「主按鈕整顆看得到」和浮動列是不是對得上
    let mismatch = null;
    for (let y = home + 1600; y >= home; y -= 37) {
      await page.evaluate((v) => scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(400);
    const r = await mainRect();
    const vh = viewport.height;
    const inView = r.top >= 56 && r.bottom <= vh - 8;
    if (inView && (await shown())) mismatch = `主按鈕 top ${Math.round(r.top)} bottom ${Math.round(r.bottom)}（視窗 ${vh}）`;
    ok(`${label}：一點一點捲回來、主按鈕整顆在畫面裡：浮動列收起`, inView && !mismatch, mismatch || JSON.stringify(r));

    // 捲到主按鈕剛好在底邊那 8px 裡（還算看不到），再往上一點點：要收
    await page.evaluate((y) => scrollTo(0, y + 1600), home);
    await page.waitForTimeout(400);
    const edge = await page.evaluate(() => {
      const r = document.querySelector("#go-bar .btn-primary").getBoundingClientRect();
      return Math.round(scrollY + r.bottom - innerHeight + 4); // 主按鈕底邊在畫面底下 4px 以內
    });
    // 電腦上主按鈕在第一屏就看得到（捲不到讓它貼底邊的位置）：這一段只在手機上量。
    if (edge <= 0) {
      await context.close();
      continue;
    }
    await page.evaluate((y) => scrollTo(0, y), edge);
    await page.waitForTimeout(300);
    const atEdge = await shown();
    await page.evaluate((y) => scrollTo(0, y + 40), edge);
    await page.waitForTimeout(300);
    ok(`${label}：主按鈕貼著底邊時還浮著`, atEdge);
    ok(`${label}：再往下捲一點、主按鈕整顆進來：浮動列收起`, !(await shown()), JSON.stringify(await mainRect()));
    await context.close();
  }
  ok("沒有頁面錯誤", !errors.length, errors.join("\n"));
} catch (err) {
  ok("沒有例外", false, err.stack);
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
