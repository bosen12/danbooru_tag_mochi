// 墨池第六輪 B 組（作品冊相似列、日誌、群組、分享碼、自製牌貼上、疊印台 Hires）。
//   node scripts/test_astra6_b_browser.mjs
//   BASELINE=HEAD node scripts/test_astra6_b_browser.mjs
//   ONLY=similar,gap node scripts/test_astra6_b_browser.mjs
//
// 假伺服器只回這支自己的 JSON 和圖，不連 ComfyUI，不打真的 /api/gen、/api/interrupt，不寫專案的 data/。
// BASELINE 拿 git 上的舊版：album.js、album-log.js、album-models.js、book.js、book-groups.js、custom-editor.js、fuse.js。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";

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
const front = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";
const old = (f) => (process.env.BASELINE ? execFileSync("git", ["show", `${process.env.BASELINE}:${front}/${f}`], { cwd: root, maxBuffer: 2 ** 26 }) : null);
const baseline = {
  "album.js": old("album.js"),
  "album-log.js": old("album-log.js"),
  "album-models.js": old("album-models.js"),
  "book.js": old("book.js"),
  "book-groups.js": old("book-groups.js"),
  "custom-editor.js": old("custom-editor.js"),
  "fuse.js": old("fuse.js"),
};

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, sum]);
}
function png(w, h, r, g, b) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      raw[o + 1 + x * 3] = r;
      raw[o + 2 + x * 3] = g;
      raw[o + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}
const PNG = png(8, 8, 40, 90, 160);

function shareCode(name, tags) {
  const body = { v: 1, n: name, r: "general", m: tags, x: [] };
  return "mochi-card:" + Buffer.from(JSON.stringify(body)).toString("base64url");
}

const state = {
  recipes: [],
  genRows: [],
  holdBeforeCount: 0,
  beforeSeen: 0,
  heldBefore: [],
  genlogNoBefore: 0,
  genlogBefore: 0,
  imageStatus: 200,
  imageHits: 0,
  groups: [],
  groupWrites: [],
  groupDelay: 0,
  customPosts: [],
  gens: [],
  interrupts: 0,
  stats: { ok: true, models: [], total: 0 },
};

function resetNet() {
  for (const h of state.heldBefore) {
    try {
      h.res.writeHead(500).end();
    } catch {}
  }
  state.recipes = [];
  state.genRows = [];
  state.holdBeforeCount = 0;
  state.beforeSeen = 0;
  state.heldBefore = [];
  state.genlogNoBefore = 0;
  state.genlogBefore = 0;
  state.imageStatus = 200;
  state.imageHits = 0;
  state.groups = [];
  state.groupWrites = [];
  state.groupDelay = 0;
  state.customPosts = [];
  state.gens = [];
  state.interrupts = 0;
  state.stats = { ok: true, models: [], total: 0 };
}

function pageOf(beforeId) {
  let start = 0;
  if (beforeId) {
    const ix = state.genRows.findIndex((row) => row.id === beforeId);
    start = ix < 0 ? state.genRows.length : ix + 1;
  }
  const items = state.genRows.slice(start, start + 300);
  return { ok: true, items, more: start + 300 < state.genRows.length, total: state.genRows.length };
}

function releaseBefore() {
  const h = state.heldBefore.shift();
  if (!h) return;
  const body = pageOf(h.beforeId);
  try {
    h.res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    h.res.end(JSON.stringify(body));
  } catch {}
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const json = (v, code = 200) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(v));
  };
  if (url.pathname === "/blank.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><title>blank</title>");
    return;
  }
  if (url.pathname === "/api/gen" && req.method === "POST") {
    let body = {};
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch {}
    state.gens.push(body);
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "X-Gen-Job": "job-test" });
    res.write('event: progress\ndata: {"value":1,"max":2}\n\n');
    res.write('event: done\ndata: {"image":"/api/image?filename=fuse.png","width":832,"height":1216}\n\n');
    res.end();
    return;
  }
  if (url.pathname === "/api/interrupt" || url.pathname === "/api/gen/cancel" || url.pathname === "/api/gen/attach") {
    state.interrupts++;
    if (req.method !== "GET" && req.method !== "HEAD") await readBody(req);
    return json({ ok: true });
  }
  if (url.pathname === "/api/ping") return json({ ok: true });
  if (url.pathname === "/api/recipes" && req.method === "GET") return json({ ok: true, items: state.recipes });
  if (url.pathname === "/api/genlog/stats") return json(state.stats);
  if (url.pathname === "/api/genlog") {
    const beforeId = url.searchParams.get("beforeId") || "";
    if (beforeId) {
      state.genlogBefore++;
      if (state.beforeSeen < state.holdBeforeCount) {
        state.beforeSeen++;
        state.heldBefore.push({ res, beforeId });
        return;
      }
      return json(pageOf(beforeId));
    }
    state.genlogNoBefore++;
    return json(pageOf(""));
  }
  if (url.pathname === "/api/card-groups" && req.method === "POST") {
    let body = {};
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch {}
    state.groupWrites.push([].concat(body.tags || []));
    if (state.groupDelay) await new Promise((r) => setTimeout(r, state.groupDelay));
    const group = { ...(state.groups.find((g) => g.id === body.id) || {}), ...body };
    state.groups = state.groups.some((g) => g.id === group.id) ? state.groups.map((g) => (g.id === group.id ? group : g)) : state.groups.concat(group);
    return json({ ok: true, group, groups: state.groups });
  }
  if (url.pathname === "/api/card-groups") return json({ ok: true, groups: state.groups });
  if (url.pathname === "/api/custom-cards" && req.method === "POST") {
    let body = {};
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch {}
    state.customPosts.push(body);
    const card = { ...body, id: body.id || "c-12345" };
    return json({ ok: true, card, cards: [card] });
  }
  if (url.pathname === "/api/custom-cards") return json({ ok: true, cards: [] });
  if (url.pathname === "/api/image" || url.pathname.startsWith("/api/recipes/files/")) {
    if (url.pathname === "/api/image") state.imageHits++;
    const code = url.pathname === "/api/image" ? state.imageStatus : 200;
    if (code !== 200) {
      res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end("{}");
      return;
    }
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
    res.end(PNG);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD") await readBody(req);
    return json({ ok: true, items: [], counts: {}, mine: {}, last: {}, groups: [], models: [], workflows: [], loras: [] });
  }

  const name = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  if (baseline[name]) {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    res.end(baseline[name]);
    return;
  }
  let file = resolve(root, front, name);
  if (!existsSync(file)) file = resolve(root, "web", name);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.setHeader("Content-Type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--disable-features=Prerender2,SpeculationRulesPrefetchProxy"], ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 500)}`);
  if (!cond) failed++;
};

function logItem(id, extra = {}) {
  const n = Number(String(id).replace(/\D/g, "")) || 0;
  return {
    t: "gen",
    id,
    ok: true,
    at: 1700000000000 + n,
    rating: "general",
    positive: "red hair",
    ckpt: "",
    image: `/api/image?filename=${encodeURIComponent(id)}.png`,
    ms: 1200,
    seed: n,
    kind: "gen",
    origin: "mochi",
    width: 832,
    height: 1216,
    ...extra,
  };
}

function work(id, rating, extra = {}) {
  return {
    id,
    name: extra.name || id,
    positive: "red hair, kimono, 1girl",
    rating,
    createdAt: "2026-11-20T00:00:00.000Z",
    width: 832,
    height: 1216,
    seed: 1,
    pinned: ["red hair", "kimono"],
    ...extra,
  };
}

const browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference", locale: "zh-TW" });
await browserContext.addInitScript(() => {
  window.__prompts = [];
  window.prompt = (msg) => {
    window.__prompts.push(String(msg ?? ""));
    return null;
  };
});

async function prep(page, { settings, local, session, language } = {}) {
  await page.goto(origin + "/blank.html", { timeout: 20000 });
  await page.evaluate(({ settings, local, session, language }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.tour.album.v1", "1");
    localStorage.setItem("mochi.tour.book.v1", "1");
    localStorage.setItem("mochi.tour.fuse.v1", "1");
    localStorage.setItem("mochi.tour.parse.v1", "1");
    localStorage.setItem("mochi.language.v1", language || "zh-Hant");
    if (settings) localStorage.setItem("mochi.settings.v1", JSON.stringify(settings));
    if (local) for (const [k, v] of Object.entries(local)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    if (session) for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, { settings: settings || null, local: local || null, session: session || null, language: language || null });
}

async function waitNode(fn, ms = 8000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

function wanted(name) {
  const only = process.env.ONLY;
  if (!only) return true;
  return only.split(",").some((part) => name.startsWith(part.trim()));
}

async function scenario(name, fn) {
  if (!wanted(name)) return;
  resetNet();
  const page = await browserContext.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (err) => console.log("pageerror", name, err.message));
  try {
    await fn(page);
  } catch (err) {
    ok(name + " 沒有丟例外", false, err && (err.stack || err.message || err));
  } finally {
    await page.close().catch(() => {});
  }
}

try {
  await scenario("similar 調低分級後相似列打不開受限作品", async (page) => {
    state.recipes = [work("work1", "general", { name: "作品甲" }), work("work2", "explicit", { name: "作品乙" })];
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html");
    await page.locator("#rating button[data-v=explicit]").click();
    await page.locator(".album-tile[data-id=work1]").click();
    await page.waitForFunction(() => document.querySelectorAll(".album-similar-item").length >= 1);
    const other = await browserContext.newPage();
    await other.goto(origin + "/blank.html");
    await other.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("mochi.settings.v1") || "{}");
      s.rating = "general";
      s.ratingFree = false;
      localStorage.setItem("mochi.settings.v1", JSON.stringify(s));
    });
    await page.waitForFunction(() => document.querySelector('#rating [aria-checked="true"]')?.dataset.v === "general");
    let cleared = false;
    try {
      await page.waitForFunction(() => document.querySelectorAll(".album-similar-item").length === 0, null, { timeout: 4000 });
      cleared = true;
    } catch {}
    const snap = await page.evaluate(() => ({
      similar: document.querySelectorAll(".album-similar-item").length,
      titles: [...document.querySelectorAll(".sheet h2")].map((n) => n.textContent),
      sheet: [...document.querySelectorAll(".overlay")].some((n) => n.isConnected && n.dataset.closing !== "true"),
    }));
    ok("similar 相似列收起", cleared && snap.similar === 0, JSON.stringify(snap));
    ok("similar 還停在看得到的那一件", snap.sheet && snap.titles.some((t) => t.includes("作品甲")) && !snap.titles.some((t) => t.includes("作品乙")), JSON.stringify(snap));
    await other.close();
  });

  await scenario("logRating 別的房間調低分級就關掉日誌詳情", async (page) => {
    state.genRows = [logItem("hot", { rating: "explicit", positive: "red hair" })];
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html?tab=log");
    await page.locator("#rating button[data-v=explicit]").click();
    await page.locator(".log-row").first().click();
    await page.waitForSelector(".sheet .album-facts");
    const other = await browserContext.newPage();
    await other.goto(origin + "/blank.html");
    await other.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("mochi.settings.v1") || "{}");
      s.rating = "general";
      s.ratingFree = false;
      localStorage.setItem("mochi.settings.v1", JSON.stringify(s));
    });
    await page.waitForFunction(() => document.querySelector('#rating [aria-checked="true"]')?.dataset.v === "general");
    // 這一頁在背後時，關掉詳情的計時器會被瀏覽器延後。拉回前景，離場才會把視窗拿掉。
    await page.bringToFront();
    let closed = false;
    try {
      await page.waitForFunction(() => ![...document.querySelectorAll(".overlay")].some((n) => n.querySelector(".album-facts")), null, { timeout: 4000 });
      closed = true;
    } catch {}
    const snap = await page.evaluate(() => ({
      rows: document.querySelectorAll(".log-row").length,
      facts: [...document.querySelectorAll(".sheet .album-facts")].map((n) => n.innerText).join(" "),
    }));
    ok("logRating 受限的日誌詳情關掉了", closed && !snap.facts.includes("色情"), JSON.stringify(snap));
    ok("logRating 牆上也不留那一列", snap.rows === 0, JSON.stringify(snap));
    await other.close();
  });

  await scenario("gap 翻頁途中刷新不漏掉中間那一筆", async (page) => {
    state.genRows = Array.from({ length: 600 }, (_, i) => logItem("g" + (600 - i), { ok: false, image: "" }));
    state.holdBeforeCount = 1;
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html?tab=log");
    await page.locator(".log-row").first().waitFor();
    await page.locator(".log-more").click();
    const held = await waitNode(() => state.heldBefore.length === 1);
    ok("gap 第二頁先停在路上", held, `held ${state.heldBefore.length}`);
    state.genRows.unshift(logItem("g601", { ok: false, image: "" }));
    const seen = state.genlogNoBefore;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const refreshed = await waitNode(() => state.genlogNoBefore > seen, 8000);
    ok("gap 刷新先回到客戶端", refreshed, `noBefore ${state.genlogNoBefore}`);
    await new Promise((r) => setTimeout(r, 250));
    releaseBefore();
    let all = false;
    try {
      await page.waitForFunction(() => document.querySelector('.log-row[data-id="g601"]') && document.querySelector('.log-row[data-id="g301"]') && document.querySelector('.log-row[data-id="g1"]'), null, { timeout: 8000 });
      all = true;
    } catch {}
    const snap = await page.evaluate(() => ({
      newest: document.querySelectorAll('.log-row[data-id="g601"]').length,
      gap301: document.querySelectorAll('.log-row[data-id="g301"]').length,
      oldest: document.querySelectorAll('.log-row[data-id="g1"]').length,
      count: document.querySelectorAll(".log-row").length,
    }));
    ok("gap 新的、游標、更早的同時在", all && snap.newest === 1 && snap.gap301 === 1 && snap.oldest === 1, JSON.stringify(snap));
  });

  await scenario("logSearch 最近三百張沒有時還找得到更早的", async (page) => {
    const first = Array.from({ length: 300 }, (_, i) => logItem("s" + (300 - i), { positive: "red hair", ok: false, image: "" }));
    const older = Array.from({ length: 20 }, (_, i) => logItem("k" + (20 - i), { positive: "kimono", ok: false, image: "" }));
    state.genRows = first.concat(older);
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html?tab=log");
    await page.locator(".log-row").first().waitFor();
    await page.locator("#album-q").fill("kimono");
    let found = false;
    try {
      await page.waitForFunction(() => [...document.querySelectorAll(".log-row")].some((n) => String(n.dataset.id || "").startsWith("k")), null, { timeout: 8000 });
      found = true;
    } catch {}
    const snap = await page.evaluate(() => ({
      more: document.querySelectorAll("#album-log .log-more").length,
      text: document.querySelector("#album-log")?.innerText?.slice(0, 180) || "",
      ids: [...document.querySelectorAll(".log-row")].slice(0, 3).map((n) => n.dataset.id),
    }));
    ok("logSearch 會自己往前翻到和服", found && state.genlogBefore > 0, JSON.stringify({ before: state.genlogBefore, ...snap }));
  });

  await scenario("modelLog 成績單的預設底模進日誌會把篩選歸零", async (page) => {
    state.genRows = [logItem("e-empty", { positive: "red hair", ckpt: "" }), logItem("e-ink", { positive: "kimono", ckpt: "ink.safetensors" })];
    state.stats = {
      ok: true,
      total: 2,
      models: [
        { kind: "ckpt", name: "預設", n: 1, fav: 0, discard: 0, failed: 0, last: 1700000001000, cards: ["red hair"], drawMs: 1000 },
        { kind: "ckpt", name: "ink", n: 1, fav: 0, discard: 0, failed: 0, last: 1700000002000, cards: ["kimono"], drawMs: 1000 },
      ],
    };
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html?tab=log");
    await page.locator(".log-row").first().waitFor();
    await page.locator('#log-filters [data-v="fav"]').click();
    await page.locator('#album-tabs [data-v="models"]').click();
    await page.locator(".model-card").first().waitFor();
    const meta = await page.evaluate(() => {
      const name = [...document.querySelectorAll(".model-name")].find((n) => n.textContent === "預設");
      return { noI18n: !!name?.hasAttribute("data-no-i18n"), title: name?.closest(".model-card")?.getAttribute("title") || "" };
    });
    ok("modelLog 預設兩個字沒有鎖住不翻譯", meta.noI18n === false, JSON.stringify(meta));
    await page.locator(".model-card", { hasText: "預設" }).click();
    // 分頁籤先亮、日誌列晚一拍才重畫。只等分頁會讀到空清單。
    await page.locator('.log-row[data-id="e-empty"]').waitFor();
    const first = await page.evaluate(() => ({
      filter: document.querySelector("#log-filters [aria-pressed=true]")?.dataset.v || "",
      q: document.querySelector("#album-q")?.value || "",
      ids: [...document.querySelectorAll(".log-row")].map((n) => n.dataset.id),
    }));
    ok("modelLog 篩選回到全部、搜尋是空的、只留空底模", first.filter === "all" && first.q === "" && first.ids.includes("e-empty") && !first.ids.includes("e-ink"), JSON.stringify(first));
    await page.locator('#log-filters [data-v="fav"]').click();
    await page.evaluate(() => {
      const card = [...document.querySelectorAll(".model-card")].find((n) => n.querySelector(".model-name")?.textContent === "預設");
      card?.click();
    });
    // 跟上面同一個原因：篩選先跳回全部、日誌列晚一拍才重畫。固定等 250ms 在較慢的 CI 上會讀到空清單（2026-11-26、27 兩次）。
    await page.locator('.log-row[data-id="e-empty"]').waitFor({ timeout: 5000 }).catch(() => {});
    const again = await page.evaluate(() => ({
      filter: document.querySelector("#log-filters [aria-pressed=true]")?.dataset.v || "",
      q: document.querySelector("#album-q")?.value || "",
      ids: [...document.querySelectorAll(".log-row")].map((n) => n.dataset.id),
    }));
    ok("modelLog 已經在日誌時再點一次也歸零", again.filter === "all" && again.q === "" && again.ids.includes("e-empty") && !again.ids.includes("e-ink"), JSON.stringify(again));
    await page.evaluate(() => localStorage.setItem("mochi.language.v1", "en"));
    await page.goto(origin + "/album.html?tab=models");
    let title = "";
    try {
      await page.waitForFunction(() => [...document.querySelectorAll(".model-name")].some((n) => n.textContent === "Default"), null, { timeout: 15000 });
      title = await page.evaluate(() => [...document.querySelectorAll(".model-card")].find((n) => n.querySelector(".model-name")?.textContent === "Default")?.getAttribute("title") || "");
    } catch {}
    ok("modelLog 英文把預設顯示成 Default", title.includes("Default") && !title.includes("預設"), title);
  });

  // 伺服器把同名、不同資料夾的底模分開算（gen_log.stats 的 path／folder／label）：畫面上要分得出來，
  // 點進日誌只找那個資料夾的（只用檔名會兩邊都找出來）。Claude 收尾時補的。
  await scenario("modelFolder 同名不同資料夾的底模分得開", async (page) => {
    state.genRows = [logItem("e-a", { positive: "red hair", ckpt: "A\\same.safetensors" }), logItem("e-b", { positive: "kimono", ckpt: "B/same.safetensors" })];
    state.stats = {
      ok: true,
      total: 2,
      models: [
        { kind: "ckpt", name: "same", path: "A/same.safetensors", folder: "A", label: "A/same", n: 1, fav: 0, discard: 0, failed: 0, last: 1700000001000, cards: ["red hair"], drawMs: 1000 },
        { kind: "ckpt", name: "same", path: "B/same.safetensors", folder: "B", label: "B/same", n: 1, fav: 0, discard: 0, failed: 0, last: 1700000002000, cards: ["kimono"], drawMs: 1000 },
      ],
    };
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html?tab=models");
    await page.locator(".model-card").first().waitFor();
    const names = await page.locator(".model-name").allTextContents();
    ok("modelFolder 成績單上寫出資料夾", names.includes("A/same") && names.includes("B/same"), JSON.stringify(names));
    await page.locator(".model-card", { hasText: "A/same" }).click();
    await page.locator('.log-row[data-id="e-a"]').waitFor();
    await page.waitForTimeout(250);
    const ids = await page.locator(".log-row").evaluateAll((ns) => ns.map((n) => n.dataset.id));
    ok("modelFolder 點進日誌只有那個資料夾的", ids.includes("e-a") && !ids.includes("e-b"), JSON.stringify(ids));
  });

  await scenario("logMarkPerf 很多筆時標記不要整表重查", async (page) => {
    state.genRows = Array.from({ length: 600 }, (_, i) => logItem("p" + (600 - i), { ok: false, image: "" }));
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html?tab=log");
    await page.locator(".log-row").first().waitFor();
    await page.locator(".log-more").click();
    await page.waitForFunction(() => document.querySelectorAll(".log-row").length >= 600);
    const calls = await page.evaluate(async () => {
      const target = document.querySelector("#album-log");
      const orig = target.querySelector;
      let n = 0;
      target.querySelector = function (sel) {
        if (String(sel).startsWith(".log-row[data-id")) n++;
        return orig.call(this, sel);
      };
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 900));
      target.querySelector = orig;
      return n;
    });
    ok("logMarkPerf 不用逐列 querySelector", calls < 30, String(calls));
  });

  await scenario("thumbRecover 暫時讀不到不要記成原圖不在了", async (page) => {
    state.imageStatus = 503;
    state.genRows = [logItem("pic", { positive: "red hair" })];
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html?tab=log");
    await page.locator(".log-thumb img").first().waitFor();
    const settled = await waitNode(() => state.imageHits >= 2, 5000);
    const goneEarly = await page.evaluate(() => !!document.querySelector(".log-thumb.is-gone"));
    await page.locator(".log-row").first().click();
    await page.waitForSelector(".sheet .album-big");
    const snap = await page.evaluate(() => {
      const fav = document.querySelector(".sheet .fav-btn");
      return {
        text: document.querySelector(".sheet .album-big")?.innerText || "",
        gone: !!document.querySelector(".log-thumb.is-gone"),
        favHidden: !fav || fav.hidden,
      };
    });
    ok("thumbRecover 5xx 不寫原圖不在了、收藏鈕還在", settled && !goneEarly && !snap.gone && !snap.text.includes("原圖不在了") && !snap.favHidden, JSON.stringify({ hits: state.imageHits, goneEarly, ...snap }));
  });

  await scenario("groupChip 詳情膠囊連點不會加兩次", async (page) => {
    state.groupDelay = 500;
    state.groups = [{ id: "g-evening", name: "Evening", section: "feature", tags: [], updatedAt: 100 }];
    await prep(page, { settings: { rating: "explicit" } });
    // 群組是開頁後才讀回來的。詳情在那之前打開，膠囊不會事後補上。等書架有了再進這張牌。
    await page.goto(origin + "/book.html");
    await page.locator(".bs-name", { hasText: "Evening" }).waitFor();
    await page.evaluate(() => { location.hash = "#card=" + encodeURIComponent("red hair"); });
    await page.locator(".sheet .bs-chip", { hasText: "Evening" }).waitFor();
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll(".sheet .bs-chip")].find((n) => n.textContent.includes("Evening"));
      btn?.click();
      btn?.click();
    });
    const got = await waitNode(() => state.groupWrites.length >= 2, 6000);
    await page.waitForTimeout(200);
    const pressed = await page.locator(".sheet .bs-chip", { hasText: "Evening" }).getAttribute("aria-pressed");
    const writes = state.groupWrites.map((tags) => tags.join(","));
    ok("groupChip 第二次是拿掉", got && writes[0] === "red hair" && writes[1] === "" && pressed === "false", JSON.stringify({ writes, pressed }));
  });

  await scenario("groupReload 別的裝置改了群組就重畫牌格", async (page) => {
    state.groups = [{ id: "g-hair", name: "Hair", section: "feature", tags: ["red hair"], updatedAt: 100 }];
    await prep(page, { settings: { rating: "explicit" } });
    await page.goto(origin + "/book.html#group=g-hair");
    await page.waitForFunction(() => (document.querySelector(".bsh-count")?.textContent || "").includes("1 張"));
    await page.locator('.book-cell[data-tag="red hair"]').waitFor();
    state.groups = [{ id: "g-hair", name: "Hair", section: "feature", tags: ["red hair", "blue hair"], updatedAt: 200 }];
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    let summary = false;
    try {
      await page.waitForFunction(() => (document.querySelector(".bsh-count")?.textContent || "").includes("2 張"), null, { timeout: 8000 });
      summary = true;
    } catch {}
    const cells = await page.evaluate(() => [...document.querySelectorAll(".book-cell[data-tag]")].map((n) => n.dataset.tag));
    ok("groupReload 摘要變了牌格也有新的那張", summary && cells.includes("red hair") && cells.includes("blue hair"), JSON.stringify({ summary, cells }));
  });

  await scenario("pasteShare 剪貼簿沒有碼也打開輸入框", async (page) => {
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/book.html");
    const tab = page.locator("#book-suits .suit-tab", { hasText: "自製" });
    await tab.waitFor();
    // 花色籤按下去會往下挪 1px（styles.css 的 .suit-tab:active）。滑鼠座標那一下放開時常落在按鈕外，click 不會發生。
    await tab.evaluate((el) => el.click());
    await page.locator("button", { hasText: "貼上分享碼" }).first().click();
    // 先等剪貼簿一下（最多 300ms，讀到碼就直接開編輯器）；讀不到才開框。
    await page.locator(".sheet textarea.cce-paste").waitFor({ timeout: 3000 }).catch(() => {});
    const opened = await page.evaluate(() => ({
      prompts: window.__prompts.length,
      box: !!document.querySelector(".sheet textarea.cce-paste"),
      label: document.querySelector(".sheet textarea")?.getAttribute("aria-label") || "",
    }));
    ok("pasteShare 用頁面上的框、不叫 prompt", opened.box && opened.prompts === 0 && opened.label.includes("mochi-card:"), JSON.stringify(opened));
    if (!opened.box) return;
    const code = shareCode("海風", ["red hair"]);
    await page.locator(".sheet textarea.cce-paste").fill(code);
    await page.locator(".sheet .sheet-foot .btn-primary", { hasText: "貼上" }).click();
    await page.locator(".cce-name").waitFor();
    const name = await page.locator(".cce-name").inputValue();
    const chip = await page.evaluate(() => [...document.querySelectorAll(".cce-chip")].some((n) => (n.dataset.tag || n.textContent || "").includes("red hair") || n.textContent.includes("紅髮")));
    ok("pasteShare 確認後打開編輯器", name.includes("海風") && chip, name);
  });

  // 電腦上剪貼簿已經有碼：跟以前一樣按一下就打開編輯器，不多跳一個輸入框（Claude 收尾時補的）。
  await scenario("pasteShareClip 剪貼簿有碼就直接打開編輯器", async (page) => {
    await browserContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    try {
      await prep(page, { settings: { rating: "general" } });
      await page.goto(origin + "/book.html");
      const tab = page.locator("#book-suits .suit-tab", { hasText: "自製" });
      await tab.waitFor();
      await tab.evaluate((el) => el.click());
      await page.evaluate((c) => navigator.clipboard.writeText(c), shareCode("潮汐", ["kimono"]));
      await page.locator("button", { hasText: "貼上分享碼" }).first().click();
      await page.locator(".cce-name").waitFor({ timeout: 8000 });
      const name = await page.locator(".cce-name").inputValue();
      const box = await page.evaluate(() => !!document.querySelector('.sheet textarea[aria-label*="mochi-card"]'));
      ok("pasteShareClip 不多跳輸入框、直接開編輯器", name.includes("潮汐") && !box, JSON.stringify({ name, box }));
    } finally {
      await browserContext.clearPermissions();
    }
  });

  await scenario("pasteSave 改完字立刻存的是最新的", async (page) => {
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/book.html#custom-new");
    await page.locator(".cce-mode [data-v=paste]").click();
    await page.locator(".cce-paste").fill("red hair");
    await page.waitForTimeout(450);
    await page.waitForFunction(() => {
      const btn = document.querySelector(".cce-sheet .sheet-foot .btn-primary");
      return btn && !btn.disabled;
    });
    await page.evaluate(() => {
      const ta = document.querySelector(".cce-paste");
      ta.value = "kimono";
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector(".cce-sheet .sheet-foot .btn-primary")?.click();
    });
    const posted = await waitNode(() => state.customPosts.length > 0, 6000);
    const tags = (state.customPosts[0]?.members || []).map((m) => m.tag);
    ok("pasteSave 存到的是剛貼的和服", posted && tags.includes("kimono") && !tags.includes("red hair"), JSON.stringify(tags));
  });

  await scenario("fuseHires 調了份量之後主鈕不對上一張成品做", async (page) => {
    await prep(page, {
      settings: { rating: "general" },
      local: { "seedControl.v1": { mode: "fixed", value: 123 } },
      session: { "mochi.tab.fuse.v1": { bed: { pins: ["red hair"], carried: {} }, picked: 0, seeds: [1, 2, 3, 4] } },
    });
    await page.goto(origin + "/fuse.html");
    const card = page.locator('.plate-card[data-tag="red hair"]');
    await card.waitFor({ timeout: 45000 });
    await page.evaluate(() => {
      const node = document.querySelector('.plate-card[data-tag="red hair"]');
      for (const key of ["=", "="]) node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
    await page.waitForFunction(() => (document.querySelector('.plate-card[data-tag="red hair"]')?.innerText || "").includes("1.4"));
    await page.locator(".pb-go").click();
    await page.waitForFunction(() => (document.querySelector(".pb-go")?.innerText || "").includes("Hires"), null, { timeout: 15000 });
    const sent = state.gens.at(-1)?.positive || "";
    ok("fuseHires 付印送出的是 1.4", sent.includes("(red hair:1.4)"), sent.slice(0, 180));
    await page.evaluate(() => {
      const node = document.querySelector('.plate-card[data-tag="red hair"]');
      node.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true }));
    });
    let relabeled = false;
    try {
      await page.waitForFunction(() => {
        const text = document.querySelector(".pb-go")?.innerText || "";
        return text.includes("付印") && !text.includes("Hires");
      }, null, { timeout: 4000 });
      relabeled = true;
    } catch {}
    const snap = await page.evaluate(() => {
      const img = document.querySelector("#preview img:not(.pv-under)");
      return {
        go: document.querySelector(".pb-go")?.innerText || "",
        weight: document.querySelector('.plate-card[data-tag="red hair"]')?.innerText || "",
        empty: document.querySelector("#preview")?.dataset.empty || "",
        fading: img?.dataset.fading || "",
        hasImg: !!img,
        line: document.querySelectorAll("#line-list .print").length,
      };
    });
    ok("fuseHires 主鈕回到付印、預覽不再當成這一張", relabeled && snap.weight.includes("1.2") && (snap.empty === "true" || snap.fading === "1" || !snap.hasImg) && snap.line >= 1, JSON.stringify(snap));
  });
} finally {
  await browser.close().catch(() => {});
  await new Promise((r) => server.close(r));
}

if (failed) {
  console.log(`FAILED ${failed}`);
  process.exit(1);
}
console.log("all ok");
