// 第六輪作品冊與日誌（第 4、10、11、12、15 項）。
// 跟 test_web6_ux_browser.mjs 一樣：自己開一個只回假資料的網頁伺服器，不碰 data/、不連 ComfyUI、不打 /api/gen。
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
    try { return require(p); } catch { /* 下一個 */ }
  }
  throw new Error("Install Playwright or set PLAYWRIGHT_MODULE");
})();

const root = resolve(import.meta.dirname, "..");
const frontend = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="#789"/></svg>';

const state = {
  works: [],
  entries: [],
  recipes: [],
  posts: [],
  deletes: [],
  genlogHits: 0,
  genlogStatus: 200,
  pageSize: 300,
  forbidden: [],
};

function reset() {
  state.works = [];
  state.entries = [];
  state.recipes = [];
  state.posts = [];
  state.deletes = [];
  state.genlogHits = 0;
  state.genlogStatus = 200;
  state.pageSize = 300;
}

function work(id, name, rating, extra = {}) {
  return {
    id, name, rating,
    positive: "red hair",
    pinned: ["red hair"],
    width: 832,
    height: 1216,
    createdAt: new Date().toISOString(),
    image: { file: `${id}.png` },
    ...extra,
  };
}

function entry(id, at, extra = {}) {
  return {
    id,
    at,
    ok: true,
    image: `/api/image?filename=${encodeURIComponent(id)}.png&type=output`,
    positive: "red hair",
    seed: 11,
    width: 832,
    height: 1216,
    rating: "general",
    era: "",
    origin: "mochi",
    ckpt: "illustrious.safetensors",
    loras: [],
    ms: 4000,
    ...extra,
  };
}

// 本機時區的某一天某一點。測試和瀏覽器同一個行程，日期標題才對得起來。
function stamp(y, m, d, h) {
  return new Date(y, m - 1, d, h, 0, 0).toISOString();
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolveBody(null);
      try { resolveBody(JSON.parse(raw)); } catch { resolveBody(null); }
    });
    req.on("error", reject);
  });
}

function send(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function logPage(url) {
  const before = url.searchParams.get("before");
  const beforeId = url.searchParams.get("beforeId") || "";
  let start = 0;
  if (before) {
    const idx = state.entries.findIndex((e) => String(e.at) === before && String(e.id) === beforeId);
    if (idx >= 0) start = idx + 1;
    else {
      start = state.entries.findIndex((e) => String(e.at) < before);
      if (start < 0) start = state.entries.length;
    }
  }
  const size = Math.min(Number(url.searchParams.get("limit") || 300), state.pageSize);
  const items = state.entries.slice(start, start + size);
  return { ok: true, items, more: start + size < state.entries.length };
}

const fileCache = new Map();
async function staticFile(res, name) {
  let file = resolve(root, frontend, name);
  if (!existsSync(file)) file = resolve(root, "web", name);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    let buf = fileCache.get(file);
    if (!buf) {
      buf = await readFile(file);
      fileCache.set(file, buf);
    }
    res.writeHead(200, {
      "Content-Type": ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" })[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(buf);
  } catch {
    res.writeHead(404).end();
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/api/gen" || url.pathname === "/api/interrupt") {
    state.forbidden.push(`${req.method} ${url.pathname}`);
    return send(res, { ok: false, error: "forbidden" }, 410);
  }
  if (url.pathname.startsWith("/api/image") || url.pathname.startsWith("/api/recipes/files/")) {
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
    return res.end(SVG);
  }
  if (url.pathname === "/api/genlog") {
    state.genlogHits += 1;
    if (state.genlogStatus !== 200) return send(res, { ok: false, error: "down" }, state.genlogStatus);
    return send(res, logPage(url));
  }
  if (url.pathname === "/api/recipes" && req.method === "POST") {
    const body = await readBody(req);
    state.posts.push(body);
    const recipe = {
      id: body?.id || "w-new",
      name: body?.name || "",
      rating: body?.rating || "general",
      positive: body?.positive || "",
      seed: body?.seed,
      era: body?.era || "",
      width: body?.width,
      height: body?.height,
      createdAt: new Date().toISOString(),
      image: null,
    };
    state.recipes.push(recipe);
    return send(res, { ok: true, recipe });
  }
  const imagePost = url.pathname.match(/^\/api\/recipes\/([^/]+)\/image$/);
  if (imagePost && req.method === "POST") {
    await readBody(req);
    const recipe = state.recipes.find((r) => r.id === decodeURIComponent(imagePost[1]));
    if (recipe) recipe.image = { file: "edo.png", src: "/edo.png" };
    return send(res, { ok: true, recipe: recipe || { id: decodeURIComponent(imagePost[1]) } });
  }
  const recipeOne = url.pathname.match(/^\/api\/recipes\/([^/]+)$/);
  if (recipeOne && req.method === "DELETE") {
    state.deletes.push(decodeURIComponent(recipeOne[1]));
    state.recipes = state.recipes.filter((r) => r.id !== decodeURIComponent(recipeOne[1]));
    state.works = state.works.filter((w) => w.id !== decodeURIComponent(recipeOne[1]));
    return send(res, { ok: true });
  }
  if (url.pathname === "/api/recipes") {
    // 剛從日誌收進去的那一件在 recipes，不在一開始的 works。重新讀作品冊要看得到，星號才留得住。
    const byId = new Map(state.works.map((w) => [w.id, w]));
    for (const rec of state.recipes) if (rec.image?.file) byId.set(rec.id, rec);
    return send(res, { ok: true, items: [...byId.values()] });
  }
  if (url.pathname.startsWith("/api/")) {
    const data = {
      "/api/ping": { ok: true },
      "/api/gen/active": { ok: true, jobs: [] },
      "/api/decks": { ok: true, decks: [] },
      "/api/usage": { counts: {}, mine: {}, last: {} },
      "/api/lora-push": { version: 0 },
      "/api/discord/config": { ok: true, configured: false, enabled: false, mode: "webhook" },
      "/api/workflows": { ok: true, items: [] },
      "/api/checkpoints": { items: [] },
      "/api/loras": { items: [], categories: [] },
      "/api/sampling": { ok: true, base: { steps: 28, cfg: 5, sampler_name: "euler", scheduler: "normal" }, hires: { fast: {}, deep: {} } },
    }[url.pathname] || { ok: true, items: [] };
    return send(res, data);
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  return staticFile(res, name);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  args: ["--disable-features=LocalNetworkAccessChecks"],
});

async function newPage({ motion = "reduce", width = 1280, height = 800 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion });
  await context.addInitScript(() => {
    localStorage.setItem("mochi.tour.seen.v1", "true");
    localStorage.setItem("mochi.settings.v1", JSON.stringify({ rating: "general", ratingFree: false }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, errors };
}

// 詞庫檔不小。偶發「連不到主機」時重開一次，不把網路閃斷算成這幾項回歸失敗。
async function gotoAlbum(page, path) {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const failed = [];
    const onFail = (req) => failed.push(`${req.failure()?.errorText || "fail"} ${req.url()}`);
    page.on("requestfailed", onFail);
    try {
      try {
        await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      } catch (err) {
        // 開了跨頁轉場時，同網址的第二次導向會把這次 goto 打斷。那次導向還在走，等它開好就好，不要再 goto 把它也打斷。
        if (!/interrupted by another navigation/.test(String(err))) throw err;
      }
      const kind = await page.waitForFunction(() => {
        if (document.querySelector("#album h2")?.textContent?.includes("連不到主機")) return "net";
        if (document.querySelector(".album-tile, .log-row, .log-retry, .album-empty-rating, .sheet, #album-tabs button")) return "ready";
        return "";
      }, null, { timeout: 20000 }).then((h) => h.jsonValue());
      if (kind === "ready") return;
      last = `連不到主機\n${failed.slice(0, 12).join("\n")}`;
    } catch (err) {
      last = `${err}\n${failed.slice(0, 12).join("\n")}`;
    } finally {
      page.off("requestfailed", onFail);
    }
  }
  throw new Error(last || "album page did not boot");
}

async function ratingOf(page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("mochi.settings.v1") || "{}");
    return { rating: s.rating || "general", ratingFree: s.ratingFree === true };
  });
}

const tests = [];
function test(name, fn, opts) {
  tests.push({ name, fn, opts });
}

test("4 深連結看不到的作品先問，按了才改分級", async (page) => {
  state.works = [
    work("w-ok", "Visible Piece", "general"),
    work("w-se", "Sensitive Piece", "sensitive"),
    work("w-ex", "Explicit Piece", "explicit"),
  ];
  await gotoAlbum(page, "/album.html#w-ex");
  await page.locator(".album-empty-rating").waitFor();
  assert.equal(await page.locator(".sheet").count(), 0, "還沒按切換，不開詳情");
  assert.deepEqual(await ratingOf(page), { rating: "general", ratingFree: false }, "分級還停在全年齡，沒寫進共用設定");
  assert.equal(await page.locator(".album-tile").count(), 1, "全年齡看得到的那一件還在");
  // 旁邊還有一件敏感。要開的是這件色情，提示得是切到色情，不能只提到最低那一檔。
  assert.match(await page.locator(".album-empty-acts .btn").first().innerText(), /切到色情/);
  await page.locator(".album-empty-acts .btn").first().click();
  await page.locator(".sheet h2").waitFor();
  assert.equal((await page.locator(".sheet h2").innerText()).trim(), "Explicit Piece");
  assert.deepEqual(await ratingOf(page), { rating: "explicit", ratingFree: false });
  assert.equal(await page.locator(".album-tile").count(), 3);
});

test("4 看得到的深連結直接開，不改分級", async (page) => {
  state.works = [
    work("w-ok", "Visible Piece", "general"),
    work("w-se", "Sensitive Piece", "sensitive"),
    work("w-ex", "Explicit Piece", "explicit"),
  ];
  await gotoAlbum(page, "/album.html#w-ok");
  await page.locator(".sheet h2").waitFor();
  assert.equal((await page.locator(".sheet h2").innerText()).trim(), "Visible Piece");
  assert.deepEqual(await ratingOf(page), { rating: "general", ratingFree: false });
  assert.equal(await page.locator(".album-tile").count(), 1);
  assert.equal(await page.locator(".album-empty-rating").count(), 0);
});

test("11 重新讀完 id 沒變：詳情用新資料，刪除照 id 拿掉", async (page) => {
  state.works = [work("w-1", "Old Name", "general"), work("w-2", "Other", "general")];
  await gotoAlbum(page, "/album.html");
  const tile = page.locator('.album-tile[data-id="w-1"]');
  await tile.waitFor();
  await tile.evaluate((n) => { n.dataset.mark = "same"; });
  state.works = [work("w-1", "New Name", "general", { positive: "red hair, blue eyes" }), work("w-2", "Other", "general")];
  const pending = page.waitForResponse((r) => r.url().includes("/api/recipes") && r.request().method() === "GET" && !r.url().includes("/files/"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const resp = await pending;
  await resp.finished();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
  assert.equal(await page.locator('.album-tile[data-mark="same"] .album-cap b').innerText(), "Old Name", "id 沒變就不重畫格子");
  await page.locator('.album-tile[data-mark="same"]').click();
  await page.locator(".sheet h2").waitFor();
  assert.equal((await page.locator(".sheet h2").innerText()).trim(), "New Name", "點下去拿的是這個 id 現在的那一筆");
  await page.locator(".album-del").click();
  await page.locator(".album-del").click();
  await page.locator('.album-tile[data-id="w-1"]').waitFor({ state: "detached" });
  assert.deepEqual(state.deletes, ["w-1"]);
  assert.equal(await page.locator('.album-tile[data-id="w-2"]').count(), 1);
});

test("10 從日誌補收藏帶時代，關掉詳情那一列立刻有星號", async (page) => {
  state.entries = [entry("g1", new Date().toISOString(), { era: "edo", image: "/api/image?filename=edo.png&type=output" })];
  await gotoAlbum(page, "/album.html?tab=log");
  await page.locator('.log-row[data-id="g1"]').waitFor();
  await page.locator('.log-row[data-id="g1"]').click();
  await page.locator(".fav-btn").click();
  await page.locator('.log-row[data-id="g1"] .log-state.is-fav').waitFor();
  const created = state.posts.find((p) => p && Object.prototype.hasOwnProperty.call(p, "positive"));
  assert.equal(created?.era, "edo");
  await page.keyboard.press("Escape");
  await page.locator(".overlay").waitFor({ state: "detached" });
  assert.equal(await page.locator('.log-row[data-id="g1"] .log-state.is-fav').count(), 1);
  assert.match(await page.locator('.log-row[data-id="g1"] .log-state.is-fav').innerText(), /收藏/);
});

test("12 日誌第一次讀失敗：切回日誌會再試，失敗畫面有重試", async (page) => {
  state.genlogStatus = 503;
  state.entries = [entry("g-ok", new Date().toISOString())];
  await gotoAlbum(page, "/album.html?tab=log");
  await page.locator(".log-retry").waitFor();
  assert.match(await page.locator("#album-log").innerText(), /讀不到日誌/);
  assert.equal(state.genlogHits, 1);
  await page.locator('#album-tabs button[data-v="works"]').click();
  // 沒有作品時格子是空的、高度 0，Playwright 會把它當成看不見。改等這一頁自己的提示。
  await page.locator("#album-hint").waitFor({ state: "visible" });
  await page.locator('#album-tabs button[data-v="log"]').click();
  await page.locator(".log-retry").waitFor();
  assert.equal(state.genlogHits, 2, "切回日誌要再讀一次，不能沿用第一次的失敗");
  assert.match(await page.locator("#album-log").innerText(), /讀不到日誌/);
  state.genlogStatus = 200;
  await page.locator(".log-retry").click();
  await page.locator('.log-row[data-id="g-ok"]').waitFor();
  assert.equal(state.genlogHits, 3);
  assert.equal(await page.locator(".log-retry").count(), 0);
});

test("12、15 往前翻只追加；失敗不清頁；刷新合併並留在原位；摘要與縮圖", async (page) => {
  state.pageSize = 6;
  state.entries = [
    entry("a1", stamp(2024, 3, 2, 18)),
    entry("a2", stamp(2024, 3, 2, 17)),
    entry("a3", stamp(2024, 3, 2, 16)),
    entry("a4", stamp(2024, 3, 2, 15)),
    entry("b1", stamp(2024, 3, 1, 18)),
    entry("b2", stamp(2024, 3, 1, 12)),
    entry("b3", stamp(2024, 3, 1, 9)),
    entry("b4", stamp(2024, 3, 1, 8)),
    entry("c1", stamp(2024, 2, 28, 18)),
    entry("c2", stamp(2024, 2, 28, 10)),
  ];
  await gotoAlbum(page, "/album.html?tab=log");
  await page.locator(".log-row").first().waitFor();
  assert.equal(await page.locator(".log-row").count(), 6);
  const sum1 = await page.locator("#album-sum").innerText();
  assert.match(sum1, /6/);
  assert.match(sum1, /張/);
  assert.match(sum1, /還有更早的/);
  const src = await page.locator(".log-row img").first().getAttribute("src");
  assert.match(src, /[?&]w=480/);
  assert.match(src, /[?&]fmt=webp/);
  const first = page.locator(".log-row").first();
  await first.evaluate((n) => { n.dataset.mark = "keep"; });
  await page.locator(".log-more").click();
  await page.waitForFunction(() => document.querySelectorAll(".log-row").length === 10);
  assert.equal(await page.locator('.log-row[data-mark="keep"]').count(), 1, "再往前翻不能把前面的列拆掉重做");
  assert.equal(await page.locator(".log-row").first().getAttribute("data-mark"), "keep");
  const day = page.locator(".log-day-head", { hasText: "3 月 1 日" });
  assert.equal(await day.count(), 1, "同一天跨頁只留一個日期標題");
  assert.match(await day.innerText(), /4 張圖/);
  const sum2 = await page.locator("#album-sum").innerText();
  assert.match(sum2, /10/);
  assert.match(sum2, /張/);
  assert.doesNotMatch(sum2, /還有更早的/);
  assert.equal(await page.locator(".log-more").count(), 0);
  await page.locator('.log-row[data-mark="keep"]').click();
  const big = await page.locator(".album-big img").getAttribute("src");
  assert.match(big, /fmt=webp/);
  assert.doesNotMatch(big, /[?&]w=/);
  await page.keyboard.press("Escape");
  await page.locator(".overlay").waitFor({ state: "detached" });

  const anchor = page.locator(".log-row").nth(8);
  await anchor.evaluate((n) => {
    n.dataset.mark = "scrolled";
    n.scrollIntoView({ block: "center" });
  });
  const scrollTop = await page.evaluate(() => document.scrollingElement.scrollTop);
  assert.ok(scrollTop > 40, `要先捲離頂端才看得出位置有沒有被拉回去（scrollTop=${scrollTop}）`);
  const y1 = (await page.locator('.log-row[data-mark="scrolled"]').boundingBox()).y;

  state.genlogStatus = 503;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForFunction(() => (document.getElementById("toast")?.textContent || "").includes("讀不到日誌"));
  assert.equal(await page.locator(".log-row").count(), 10, "背景刷新失敗不能把已翻到的頁清掉");
  assert.equal(await page.locator('.log-row[data-mark="keep"]').count(), 1);
  assert.equal(await page.locator('.log-row[data-mark="scrolled"]').count(), 1);

  state.genlogStatus = 200;
  state.entries.unshift(entry("new1", stamp(2024, 3, 2, 19)));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator('.log-row[data-id="new1"]').waitFor();
  assert.equal(await page.locator(".log-row").count(), 11);
  assert.equal(await page.locator('.log-row[data-mark="keep"]').count(), 1);
  assert.equal(await page.locator('.log-row[data-mark="scrolled"]').count(), 1);
  const y2 = (await page.locator('.log-row[data-mark="scrolled"]').boundingBox()).y;
  assert.ok(Math.abs(y2 - y1) < 12, `刷新後捲動位置跳了 ${Math.round(y2 - y1)}px`);
  const sum3 = await page.locator("#album-sum").innerText();
  assert.match(sum3, /11/);
  assert.doesNotMatch(sum3, /還有更早的/, "已經翻完的，刷新最新一頁不能把「還有更早的」又叫回來");
}, { width: 900, height: 480 });

test("15 再往前翻只讓新的列進場", async (page) => {
  state.pageSize = 2;
  state.entries = [
    entry("m1", stamp(2024, 3, 2, 18)),
    entry("m2", stamp(2024, 3, 2, 12)),
    entry("m3", stamp(2024, 3, 1, 18)),
    entry("m4", stamp(2024, 3, 1, 12)),
  ];
  await gotoAlbum(page, "/album.html?tab=log");
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll(".log-row")];
    return rows.length === 2 && rows.every((n) => ![...n.getAnimations()].some((a) => a.playState === "running" || a.playState === "pending"));
  });
  const before = await page.locator(".log-row").evaluateAll((nodes) => nodes.map((n) => n.dataset.id));
  const seen = page.evaluate((ids) => new Promise((resolveSeen) => {
    const look = () => {
      const rows = [...document.querySelectorAll(".log-row")];
      if (rows.length <= ids.length) return requestAnimationFrame(look);
      resolveSeen(rows.map((el) => ({
        id: el.dataset.id,
        running: [...el.getAnimations()].some((a) => a.playState === "running" || a.playState === "pending"),
      })));
    };
    look();
  }), before);
  await page.locator(".log-more").click();
  const snap = await seen;
  const oldIds = new Set(before);
  const oldRunning = snap.filter((r) => oldIds.has(r.id) && r.running);
  const newRunning = snap.filter((r) => !oldIds.has(r.id) && r.running);
  assert.equal(oldRunning.length, 0, "本來就在的列不要重播進場");
  assert.ok(newRunning.length > 0, "新追加的列要有進場");
}, { motion: "no-preference", width: 900, height: 700 });

const transient = /NETWORK_ACCESS_DENIED|ERR_CONNECTION|連不到主機|interrupted by another navigation/;
let failed = 0;
try {
  for (const { name, fn, opts } of tests) {
    let passed = false;
    let lastErr = null;
    for (let attempt = 0; attempt < 3 && !passed; attempt++) {
      reset();
      const { context, page, errors } = await newPage(opts);
      try {
        await fn(page, errors);
        assert.deepEqual(errors, [], errors.join("\n"));
        console.log("ok", name);
        passed = true;
      } catch (err) {
        lastErr = err;
        try {
          lastErr.pageText = String(await page.locator("body").innerText()).slice(0, 1200);
        } catch { /* 頁面已經關了 */ }
        if (!transient.test(String(err)) || attempt === 2) break;
        await new Promise((r) => setTimeout(r, 400));
      } finally {
        await context.close();
      }
    }
    if (!passed) {
      failed += 1;
      console.error("FAIL", name);
      console.error(lastErr);
      if (lastErr?.pageText) console.error(lastErr.pageText);
    }
  }
  assert.deepEqual(state.forbidden, [], "不准打到生圖");
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log(`round6 album: ${tests.length} passed`);
