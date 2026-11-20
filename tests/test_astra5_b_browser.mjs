// 墨池第五輪 B 組（作品冊、卡冊、解析池、收藏）。
//   node scripts/test_astra5_b_browser.mjs
//   BASELINE=HEAD node scripts/test_astra5_b_browser.mjs
//
// 假伺服器只回這支自己的 JSON 和圖，不連 ComfyUI，不打 /api/gen、/api/interrupt，不寫專案的 data/。
// BASELINE 拿 git 上的舊版 album.js、album-save.js、album-log.js、book.js、parse.js。
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
  "album-save.js": old("album-save.js"),
  "album-log.js": old("album-log.js"),
  "book.js": old("book.js"),
  "parse.js": old("parse.js"),
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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PNG_WIDE = png(32, 24, 40, 90, 160);

const state = {
  recipes: [],
  bytag: [],
  recipeGet: {},
  heldRecipes: [],
  posts: [],
  images: [],
  imageDelay: {},
  holdGenlog: false,
  heldGenlog: [],
  holdParse: false,
  parse503: false,
  heldParse: [],
  bytagUrls: [],
};

function resetNet() {
  state.recipes = [];
  state.bytag = [];
  state.recipeGet = {};
  state.heldRecipes = [];
  state.posts = [];
  state.images = [];
  state.imageDelay = {};
  state.holdGenlog = false;
  state.heldGenlog = [];
  state.holdParse = false;
  state.parse503 = false;
  state.heldParse = [];
  state.bytagUrls = [];
}

const FAV_FIXTURE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="toast" hidden></div><div id="host"></div>
<script type="module">
import { favButton } from "./album-save.js";
const item = { albumId: "old-1", status: "done", image: "/api/image?filename=a.png", positive: "1girl", ok: true, seed: 1, width: 832, height: 1216 };
window.__item = item;
window.__posts = 0;
const b = favButton(item, { zh: (t) => t, persist: () => { window.__item = item; } });
document.getElementById("host").append(b);
</script></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const json = (v, code = 200) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(v));
  };
  if (url.pathname === "/api/gen" || url.pathname === "/api/interrupt") {
    res.writeHead(500).end("test refused real gen");
    return;
  }
  if (url.pathname === "/fav-fixture.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(FAV_FIXTURE);
    return;
  }
  if (url.pathname === "/blank.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><title>blank</title>");
    return;
  }
  if (url.pathname === "/api/recipes" && req.method === "GET") return json({ ok: true, items: state.recipes });
  if (url.pathname === "/api/recipes" && req.method === "POST") {
    let body = "";
    for await (const c of req) body += c;
    state.posts.push(body);
    const id = JSON.parse(body || "{}").id || "new-1";
    return json({ ok: true, recipe: { id, name: "new" } });
  }
  if (url.pathname.startsWith("/api/recipes/") && req.method === "GET") {
    const id = decodeURIComponent(url.pathname.slice("/api/recipes/".length).split("/")[0]);
    const how = state.recipeGet[id];
    if (how === "hold") {
      state.heldRecipes.push(res);
      return;
    }
    if (how === "drop") {
      res.destroy();
      return;
    }
    if (typeof how === "number") return json({ ok: false, error: "no" }, how);
    return json({ ok: true, recipe: { id, loras: [{ file: "ink.safetensors", folder: "s", strength: 0.5 }] } });
  }
  if (url.pathname.startsWith("/api/recipes/") && url.pathname.endsWith("/image") && req.method === "POST") {
    let body = "";
    for await (const c of req) body += c;
    state.posts.push("image " + body);
    return json({ ok: true, recipe: { id: "new-1", image: { file: "a.webp" } } });
  }
  if (url.pathname === "/api/genlog/bytag") {
    state.bytagUrls.push(url.search);
    return json({ ok: true, items: state.bytag, total: state.bytag.length });
  }
  if (url.pathname === "/api/genlog") {
    if (state.holdGenlog) {
      state.heldGenlog.push(res);
      return;
    }
    return json({ ok: true, items: [], total: 0, more: false });
  }
  if (url.pathname === "/api/parse" && req.method === "POST") {
    const entry = { res, aborted: false };
    req.on("aborted", () => (entry.aborted = true));
    if (state.holdParse) {
      state.heldParse.push(entry);
      return;
    }
    if (state.parse503) return json({ ok: false, error: "解析失敗" }, 503);
    return json({ ok: true, tags: [{ tag: "red hair", sure: true }], settings: { model: "wd-v1" } });
  }
  if (url.pathname === "/api/image" || url.pathname.startsWith("/api/recipes/files/")) {
    state.images.push(url.pathname + url.search);
    const filename = url.searchParams.get("filename") || "";
    const ms = state.imageDelay[filename] || 0;
    if (ms) await new Promise((r) => setTimeout(r, ms));
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
    res.end(PNG);
    return;
  }
  if (url.pathname.startsWith("/api/")) return json({ ok: true, items: [], counts: {}, mine: {}, last: {} });

  const name = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  if (baseline[name]) {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
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
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 400)}`);
  if (!cond) failed++;
};

function work(id, rating, extra = {}) {
  return {
    id,
    name: id,
    positive: "red hair, 1girl",
    rating,
    createdAt: "2026-11-20T00:00:00.000Z",
    width: 832,
    height: 1216,
    seed: 1,
    image: { file: id + ".webp" },
    thumbnail: { file: id + ".webp" },
    pinned: ["red hair"],
    ...extra,
  };
}

const browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference", locale: "zh-TW" });
await browserContext.addInitScript(() => {
  const orig = Element.prototype.animate;
  window.__tileDeals = 0;
  Element.prototype.animate = function (kf) {
    try {
      if (this.classList?.contains("album-tile") && JSON.stringify(kf).includes("14px")) window.__tileDeals++;
    } catch {}
    return orig.apply(this, arguments);
  };
});

async function prep(page, { settings, shots, pool } = {}) {
  await page.goto(origin + "/blank.html", { timeout: 20000 });
  await page.evaluate(({ settings, shots, pool }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.tour.album.v1", "1");
    localStorage.setItem("mochi.tour.book.v1", "1");
    localStorage.setItem("mochi.tour.parse.v1", "1");
    localStorage.setItem("mochi.language.v1", "zh-Hant");
    if (settings) localStorage.setItem("mochi.settings.v1", JSON.stringify(settings));
    if (shots) localStorage.setItem("mochi.shots.v1", JSON.stringify(shots));
    if (pool) sessionStorage.setItem("mochi.tab.pool.v1", JSON.stringify(pool));
  }, { settings: settings || null, shots: shots || null, pool: pool || null });
}

async function waitNode(fn, ms = 8000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("timeout");
}

async function scenario(name, fn) {
  if (process.env.ONLY && !name.startsWith(process.env.ONLY)) return;
  resetNet();
  const page = await browserContext.newPage();
  page.setDefaultTimeout(20000);
  const rawGoto = page.goto.bind(page);
  page.goto = async (url, opts) => {
    let last;
    for (let i = 0; i < 3; i++) {
      try {
        return await rawGoto(url, opts);
      } catch (err) {
        last = err;
        if (i === 2 || !/ERR_NETWORK|ERR_CONNECTION|ERR_ABORTED/.test(String(err && err.message))) throw err;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    throw last;
  };
  page.on("pageerror", (err) => console.log("pageerror", name, err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("console", name, msg.text());
  });
  try {
    await fn(page);
  } catch (err) {
    ok(name + " 沒有丟例外", false, err && (err.stack || err.message || err));
  } finally {
    await page.close().catch(() => {});
  }
}

try {
  await scenario("2 快速切回全年齡", async (page) => {
    state.recipes = [work("only-x", "explicit")];
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html");
    await page.waitForFunction(() => (document.querySelector("#album-sum")?.textContent || "").includes("0 件作品"));
    const trace = await page.evaluate(() => {
      // 滑塊（.seg-thumb）也帶 data-v，而且排在按鈕前面。要點按鈕，不然第二下點到滑塊、分級停在色情。
      const checked = () => document.querySelector('#rating button[aria-checked="true"]')?.dataset.v || "";
      const log = ["before " + checked()];
      document.querySelector('#rating button[data-v="explicit"]')?.click();
      log.push("mid " + checked());
      document.querySelector('#rating button[data-v="general"]')?.click();
      log.push("after " + checked());
      return log.join(" | ");
    });
    await page.waitForTimeout(800);
    const snap = await page.evaluate(() => ({
      sum: document.querySelector("#album-sum")?.textContent || "",
      checked: document.querySelector('#rating button[aria-checked="true"]')?.dataset.v || "",
      open: [...document.querySelectorAll(".album-tile")].filter((n) => !n.hidden && !n.disabled).length,
    }));
    ok("2 頂欄回到全年齡、摘要是 0 件", snap.checked === "general" && snap.sum.includes("0 件作品"), trace + " " + JSON.stringify(snap));
    ok("2 受限作品格沒有留在牆上", snap.open === 0, JSON.stringify(snap));
    const opened = await page.evaluate(() => {
      const tile = document.querySelector(".album-tile");
      if (tile) tile.click();
      return !!document.querySelector(".overlay .sheet");
    });
    ok("2 點格子開不了受限作品", opened === false);
  });

  await scenario("8 關掉 A 之後遲到的配方", async (page) => {
    state.recipes = [work("work-a", "general", { name: "作品A", loras: [{ file: "ink.safetensors", folder: "s", strength: 0.8 }] }), work("work-b", "general", { name: "作品B", loras: [] })];
    state.recipeGet["work-a"] = "hold";
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html");
    await page.waitForSelector(".album-tile");
    await page.locator(".album-tile", { hasText: "作品A" }).click();
    await page.getByRole("button", { name: /照這張再印/ }).click();
    await page.waitForFunction(() => document.body.innerText.includes("讀取作品配方"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.locator(".album-tile", { hasText: "作品B" }).click();
    await page.waitForFunction(() => [...document.querySelectorAll(".sheet h2")].some((n) => n.textContent.includes("作品B")));
    for (const r of state.heldRecipes) {
      try {
        r.writeHead(200, { "Content-Type": "application/json" });
        r.end(JSON.stringify({ ok: true, recipe: { id: "work-a", loras: [{ file: "ink.safetensors", folder: "s", strength: 0.4 }] } }));
      } catch {}
    }
    await page.waitForTimeout(800);
    const note = await page.evaluate(() => (localStorage.getItem("mochi.pool.handoff.v1." + sessionStorage.getItem("mochi.tab.id.v1")) ?? localStorage.getItem("mochi.pool.handoff.v1")));
    ok("8 人還在作品冊", page.url().includes("album.html"), page.url());
    ok("8 A 的遲到回應沒有寫交接便條", !note, note || "");
  });

  await scenario("9 別的分頁調低分級", async (page) => {
    state.recipes = [work("plain", "general", { name: "普通" }), work("hot", "explicit", { name: "受限" })];
    await prep(page, { settings: { rating: "explicit" } });
    await page.goto(origin + "/album.html");
    await page.waitForSelector(".album-tile");
    await page.locator(".album-tile", { hasText: "受限" }).click();
    await page.waitForFunction(() => [...document.querySelectorAll(".sheet h2")].some((n) => n.textContent.includes("受限")));
    const other = await browserContext.newPage();
    await other.goto(origin + "/blank.html");
    await other.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("mochi.settings.v1") || "{}");
      s.rating = "general";
      delete s.ratingFree;
      localStorage.setItem("mochi.settings.v1", JSON.stringify(s));
    });
    await page.waitForFunction(() => document.querySelector('#rating [aria-checked="true"]')?.dataset.v === "general");
    await page.waitForTimeout(400);
    const snap = await page.evaluate(() => ({
      checked: document.querySelector('#rating [aria-checked="true"]')?.dataset.v,
      names: [...document.querySelectorAll(".album-tile")].filter((n) => !n.hidden && !n.disabled).map((n) => n.innerText),
      sheet: [...document.querySelectorAll(".overlay")].some((n) => n.isConnected && n.dataset.closing !== "true"),
    }));
    ok("9 頂欄改成全年齡", snap.checked === "general", JSON.stringify(snap));
    ok("9 牆上不再有受限作品", !snap.names.some((t) => t.includes("受限")) && snap.names.some((t) => t.includes("普通")), JSON.stringify(snap));
    ok("9 開著的受限詳情關掉了", snap.sheet === false, JSON.stringify(snap));
    await other.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("mochi.settings.v1") || "{}");
      s.ratingFree = true;
      localStorage.setItem("mochi.settings.v1", JSON.stringify(s));
    });
    await page.waitForFunction(() => [...document.querySelectorAll(".album-tile")].some((n) => !n.hidden && n.innerText.includes("受限")));
    ok("9 不限制打開後受限作品回來", true);
    await other.close();
  });

  await scenario("9 回到前景補讀分級", async (page) => {
    state.recipes = [work("plain", "general", { name: "普通" }), work("hot", "explicit", { name: "受限" })];
    await prep(page, { settings: { rating: "explicit" } });
    await page.goto(origin + "/album.html");
    await page.waitForSelector(".album-tile");
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("mochi.settings.v1") || "{}");
      s.rating = "general";
      s.ratingFree = false;
      localStorage.setItem("mochi.settings.v1", JSON.stringify(s));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await page.waitForFunction(() => document.querySelector('#rating [aria-checked="true"]')?.dataset.v === "general");
    const names = await page.evaluate(() => [...document.querySelectorAll(".album-tile")].filter((n) => !n.hidden && !n.disabled).map((n) => n.innerText).join("|"));
    ok("9 bfcache 回來也把牆改到全年齡", !names.includes("受限") && names.includes("普通"), names);
  });

  await scenario("14 慢日誌回來不再發牌", async (page) => {
    state.recipes = [work("plain", "general", { name: "普通" })];
    state.holdGenlog = true;
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/album.html");
    await page.waitForSelector(".album-tile");
    await page.evaluate(() => (window.__tileDeals = 0));
    const pending = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/genlog");
    await page.getByRole("radio", { name: "日誌" }).click();
    await pending;
    await page.getByRole("radio", { name: "作品" }).click();
    await page.waitForTimeout(200);
    const n1 = await page.evaluate(() => window.__tileDeals);
    for (const r of state.heldGenlog) {
      try {
        r.writeHead(200, { "Content-Type": "application/json" });
        r.end(JSON.stringify({ ok: true, items: [], total: 0, more: false }));
      } catch {}
    }
    await page.waitForTimeout(1600);
    const n2 = await page.evaluate(() => window.__tileDeals);
    ok("14 切回作品之後日誌回應不再讓作品進場", n2 === n1, `${n1} → ${n2}`);
  });

  const shot = (file, rating, positive) => ({
    image: `/api/image?filename=${file}`,
    positive,
    rating,
    at: "2026-11-20T00:00:00.000Z",
    width: 832,
    height: 1216,
  });

  await scenario("4 本機成品照分級", async (page) => {
    state.bytag = [];
    await prep(page, {
      settings: { rating: "general" },
      shots: [shot("explicit.png", "explicit", "red hair, 1girl"), shot("general.png", "general", "red hair, 1girl")],
    });
    await page.goto(origin + "/book.html#card=red%20hair", { timeout: 60000 });
    await page.waitForSelector(".book-work", { timeout: 60000 });
    const srcs = await page.locator(".book-work img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src") || ""));
    ok("4 本機高分級成品不在全年齡", srcs.every((s) => !s.includes("explicit.png")), srcs.join(" "));
    ok("4 本機全年齡成品還在", srcs.some((s) => s.includes("general.png")), srcs.join(" "));
  });

  await scenario("4 日誌成品照分級", async (page) => {
    state.bytag = [
      { id: "g", at: 2, image: "/api/image?filename=log-general.png", width: 832, height: 1216, positive: "red hair", rating: "general", origin: "mochi" },
      { id: "x", at: 1, image: "/api/image?filename=log-explicit.png", width: 832, height: 1216, positive: "red hair", rating: "explicit", origin: "mochi" },
    ];
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/book.html#card=red%20hair", { timeout: 60000 });
    await page.waitForSelector(".book-work", { timeout: 60000 });
    await page.waitForTimeout(300);
    const srcs = await page.locator(".book-work img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src") || ""));
    ok("4 查詢帶目前分級", state.bytagUrls.some((q) => q.includes("rating=general")), state.bytagUrls.join(" "));
    ok("4 日誌裡的高分級成品不顯示", srcs.every((s) => !s.includes("log-explicit")) && srcs.some((s) => s.includes("log-general")), srcs.join(" "));
  });

  await scenario("6 同一張牌份量有變要確認", async (page) => {
    await prep(page, {
      settings: { rating: "general" },
      shots: [shot("weighted.png", "general", "(red hair:1.2), 1girl")],
      pool: { tags: ["1girl", "red hair"], weights: { "1girl": 1.3 } },
    });
    await page.goto(origin + "/book.html#card=red%20hair", { timeout: 60000 });
    await page.waitForSelector(".book-work", { timeout: 60000 });
    const poolNow = await page.evaluate(() => sessionStorage.getItem("mochi.tab.pool.v1"));
    await page.locator(".book-work").first().click();
    await page.getByRole("button", { name: "加入合成池 · 2 張牌" }).waitFor();
    await page.evaluate((pool) => sessionStorage.setItem("mochi.tab.pool.v1", JSON.stringify(pool)), { tags: ["1girl", "red hair"], weights: { "1girl": 1.3 } });
    await page.getByRole("button", { name: "加入合成池 · 2 張牌" }).click();
    const body = await page.locator(".sheet").last().innerText();
    ok("6 確認窗列出紅髮份量變更", body.includes("份量變更") && body.includes("紅髮") && body.includes("1.2"), (poolNow || "pool-empty") + " " + body.slice(0, 300));
    await page.getByRole("button", { name: "確認加入" }).click({ noWaitAfter: true });
    const note = await page.evaluate(() => JSON.parse((localStorage.getItem("mochi.pool.handoff.v1." + sessionStorage.getItem("mochi.tab.id.v1")) ?? localStorage.getItem("mochi.pool.handoff.v1")) || "null"));
    ok("6 確定之後便條帶著成品份量", note && note.weights && note.weights["red hair"] === 1.2 && (note.tags || []).includes("red hair"), JSON.stringify(note));
  });

  await scenario("6 池裡只有別張牌仍帶成品份量", async (page) => {
    await prep(page, {
      settings: { rating: "general" },
      shots: [shot("weighted.png", "general", "(red hair:1.2), 1girl")],
      pool: { tags: ["1girl"], weights: { "1girl": 1.3 } },
    });
    await page.goto(origin + "/book.html#card=red%20hair", { timeout: 60000 });
    await page.waitForSelector(".book-work", { timeout: 60000 });
    await page.locator(".book-work").first().click();
    await page.getByRole("button", { name: "加入合成池 · 2 張牌" }).click({ noWaitAfter: true });
    const note = await page.evaluate(() => JSON.parse((localStorage.getItem("mochi.pool.handoff.v1." + sessionStorage.getItem("mochi.tab.id.v1")) ?? localStorage.getItem("mochi.pool.handoff.v1")) || "null"));
    ok("6 無關的既有牌不會把成品份量弄丟", !!(note && note.weights && note.weights["red hair"] === 1.2), JSON.stringify(note));
  });

  await scenario("16 縮圖先佔位、不全尺寸", async (page) => {
    state.bytag = Array.from({ length: 12 }, (_, i) => ({
      id: "w" + i,
      at: 100 - i,
      image: `/api/image?filename=${i === 0 ? "slow.png" : "n" + i + ".png"}`,
      width: 832,
      height: 1216,
      positive: "red hair",
      rating: "general",
      origin: "mochi",
    }));
    state.imageDelay["slow.png"] = 2000;
    await prep(page, { settings: { rating: "general" } });
    const pending = page.waitForRequest((r) => r.url().includes("/api/genlog/bytag"), { timeout: 60000 });
    await page.goto(origin + "/book.html#card=red%20hair", { timeout: 60000 });
    await pending;
    const t0 = Date.now();
    await page.waitForSelector(".book-work", { timeout: 5000 });
    const waited = Date.now() - t0;
    const early = await page.evaluate(() => ({
      n: document.querySelectorAll(".book-work").length,
      ratio: document.querySelector(".book-work")?.style.aspectRatio || document.querySelector(".book-work")?.getAttribute("style") || "",
    }));
    ok("16 慢圖回來之前格子已經在", waited < 800 && early.n >= 12, `${waited}ms n=${early.n}`);
    ok("16 格位先留長寬比", String(early.ratio).includes("832"), early.ratio);
    const gridReqs = state.images.filter((u) => u.includes("/api/image?"));
    ok("16 牆上的圖都是 480 縮圖", gridReqs.length > 0 && gridReqs.every((u) => /[?&]w=480/.test(u)), gridReqs.slice(0, 4).join(" "));
    const before = state.images.length;
    await page.locator(".book-work").nth(1).click();
    await page.waitForFunction(() => document.querySelector(".book-work-full img"));
    await page.waitForTimeout(400);
    const opened = state.images.slice(before).filter((u) => u.includes("/api/image?"));
    ok("16 點開大圖才拿沒帶寬度的圖", opened.some((u) => !/[?&]w=/.test(u)), opened.join(" "));
  });

  async function setFile(page, name, buffer) {
    await page.locator("#parse-file").setInputFiles({ name, mimeType: "image/png", buffer });
  }

  await scenario("10 損壞圖不取消進行中的解析", async (page) => {
    state.holdParse = true;
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/parse.html", { timeout: 60000 });
    await page.waitForSelector("#parse-file", { timeout: 60000 });
    await setFile(page, "ok.png", PNG);
    await page.waitForFunction(() => document.querySelector("#parse-plate")?.dataset.state === "loading");
    await waitNode(() => state.heldParse.length === 1);
    await page.waitForFunction(() => (document.querySelector("#parse-status")?.textContent || "").includes("解析中"));
    await setFile(page, "bad.png", Buffer.from("not-a-png"));
    await page.waitForTimeout(500);
    const snap = await page.evaluate(() => ({
      state: document.querySelector("#parse-plate")?.dataset.state || "",
      status: document.querySelector("#parse-status")?.textContent || "",
    }));
    ok("10 壞圖之後仍停在解析中、字還在", snap.state === "loading" && snap.status.includes("解析中"), JSON.stringify(snap));
    ok("10 進行中的請求沒有被中止", state.heldParse.length === 1 && state.heldParse[0].aborted === false, "n=" + state.heldParse.length + " aborted=" + state.heldParse[0]?.aborted);
    const entry = state.heldParse[0];
    entry.res.writeHead(200, { "Content-Type": "application/json" });
    entry.res.end(JSON.stringify({ ok: true, tags: [{ tag: "red hair", sure: true }], settings: { model: "wd-v1" } }));
    await page.waitForFunction(() => document.querySelector("#parse-plate")?.dataset.state === "done");
    ok("10 原本那張仍能解析完成", true);
  });

  await scenario("10 只有壞圖時回到可再選", async (page) => {
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/parse.html", { timeout: 60000 });
    await page.waitForSelector("#parse-file", { timeout: 60000 });
    await setFile(page, "bad.png", Buffer.from("not-a-png"));
    await page.waitForTimeout(400);
    const snap = await page.evaluate(() => ({
      state: document.querySelector("#parse-plate")?.dataset.state || "",
      status: document.querySelector("#parse-status")?.textContent || "",
    }));
    ok("10 第一張就壞不會停在載入", snap.state !== "loading" && !snap.status.includes("解析中"), JSON.stringify(snap));
  });

  await scenario("11 失敗的新圖不會還原成舊的成功", async (page) => {
    await prep(page, { settings: { rating: "general" } });
    await page.goto(origin + "/parse.html", { timeout: 60000 });
    await page.waitForSelector("#parse-file", { timeout: 60000 });
    await setFile(page, "a.png", PNG);
    await page.waitForFunction(() => document.querySelector("#parse-plate")?.dataset.state === "done");
    state.parse503 = true;
    await setFile(page, "b.png", PNG_WIDE);
    await page.waitForFunction(() => document.querySelector("#parse-plate")?.dataset.state === "error");
    const mid = await page.evaluate(() => ({
      ratio: getComputedStyle(document.querySelector("#parse-frame")).getPropertyValue("--ratio"),
      state: document.querySelector("#parse-plate")?.dataset.state,
    }));
    ok("11 當下是新圖的錯誤、不是 1×1", mid.state === "error" && mid.ratio.includes("32"), JSON.stringify(mid));
    await page.goto(origin + "/book.html", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.goto(origin + "/parse.html", { timeout: 60000 });
    await page.waitForSelector("#parse-plate[data-state]", { timeout: 60000 });
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({
      ratio: getComputedStyle(document.querySelector("#parse-frame")).getPropertyValue("--ratio"),
      state: document.querySelector("#parse-plate")?.dataset.state || "",
      status: document.querySelector("#parse-status")?.textContent || "",
      groups: document.querySelector("#parse-groups")?.innerText || "",
    }));
    ok("11 回來仍是新圖、可再試，不是舊的成功", back.state === "error" && back.ratio.includes("32") && back.status.includes("再試一次") && !back.groups.includes("紅髮"), JSON.stringify(back));
  });

  await scenario("7 暫時錯誤不另建作品", async (page) => {
    state.recipeGet["old-1"] = 502;
    await page.goto(origin + "/fav-fixture.html");
    await page.waitForSelector(".fav-btn");
    await page.click(".fav-btn");
    await page.waitForFunction(() => (document.querySelector("#toast")?.textContent || "").includes("暫時無法確認收藏"));
    const snap = await page.evaluate(() => ({
      id: window.__item.albumId,
      text: document.querySelector(".fav-btn").textContent,
      disabled: document.querySelector(".fav-btn").disabled,
      toast: document.querySelector("#toast").textContent,
    }));
    ok("7 502 留著收藏編號和星號", snap.id === "old-1" && snap.text.includes("已收藏") && snap.disabled === false, JSON.stringify(snap));
    ok("7 502 沒有新建作品", state.posts.length === 0, String(state.posts.length));
    ok("7 提示暫時無法確認", snap.toast.includes("暫時無法確認收藏，請再試一次"), snap.toast);
  });

  await scenario("7 斷線也不另建", async (page) => {
    state.recipeGet["old-1"] = "drop";
    await page.goto(origin + "/fav-fixture.html");
    await page.waitForSelector(".fav-btn");
    await page.click(".fav-btn");
    await page.waitForFunction(() => (document.querySelector("#toast")?.textContent || "").includes("暫時無法確認收藏"));
    const id = await page.evaluate(() => window.__item.albumId);
    ok("7 斷線留著 albumId、沒有 POST", id === "old-1" && state.posts.length === 0, id);
  });

  await scenario("7 只有 404 才重新收藏", async (page) => {
    state.recipeGet["old-1"] = 404;
    await page.goto(origin + "/fav-fixture.html");
    await page.waitForSelector(".fav-btn");
    await page.click(".fav-btn");
    await waitNode(() => state.posts.length > 0);
    const id = await page.evaluate(() => window.__item.albumId);
    ok("7 404 會清掉舊編號並建立新的", id !== "old-1" && state.posts.length > 0, id + " posts=" + state.posts.length);
  });

  await scenario("7 查詢期間鎖住按鈕", async (page) => {
    state.recipeGet["old-1"] = "hold";
    await page.goto(origin + "/fav-fixture.html");
    await page.waitForSelector(".fav-btn");
    await page.click(".fav-btn");
    await page.waitForFunction(() => document.querySelector(".fav-btn").disabled === true);
    await page.evaluate(() => document.querySelector(".fav-btn").click());
    ok("7 查詢沒回來之前沒有 POST", state.posts.length === 0 && state.heldRecipes.length === 1);
    const held = state.heldRecipes[0];
    held.writeHead(502, { "Content-Type": "application/json" });
    held.end("{}");
    await page.waitForFunction(() => document.querySelector(".fav-btn").disabled === false);
    const text = await page.locator(".fav-btn").innerText();
    ok("7 查完解鎖，星號還在", text.includes("已收藏") && state.posts.length === 0, text);
  });
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nok");
