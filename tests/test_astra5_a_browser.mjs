// 第五輪檢查（2026-11-20，GPT 6.2 Astra 找、Claude 修）A 組：
//   1. 一個墨池分頁還原了原圖、關掉它，接手的分頁不能拿舊的 Hires 工作編號把 Hires 圖寫回去
//   5. 照這張再印：同名、不同資料夾的底模要看得出不一樣、能換
//   6. 卡冊帶成品回已有牌的合成池：成品的份量要帶上（不是回到 1.0）
//  12. 手機詳情的「⋯」選單開著按 Esc：只收選單、焦點回「⋯」，詳情還在
//  13. 手機英文版的種子框不裁字
//  15. 疊印台印製中：狀態字不是每一步都重播淡入
// （3. 交接便條只給寫的那個分頁：在 test_prerender_handoff.mjs）
//
//   node scripts/test_astra5_a_browser.mjs
//   BASELINE=HEAD node scripts/test_astra5_a_browser.mjs   # 拿舊版 app.js、store.js、fuse.js、foot-more.js、styles.css 對照（應該紅）
//
// 假伺服器：/api/gen 是自己的假 SSE，不連 ComfyUI；不寫 data/。
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
const front = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";
const baseline = {};
if (process.env.BASELINE) {
  for (const f of ["app.js", "store.js", "fuse.js", "foot-more.js", "styles.css"]) baseline[f] = execFileSync("git", ["show", `${process.env.BASELINE}:${front}/${f}`], { cwd: root, maxBuffer: 2 ** 25 });
}

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = (i, extra = {}) => ({ id: "work" + i, name: "Work " + i, rating: "general", positive: "red hair, standing, kimono", pinned: ["red hair"], createdAt: new Date(1700000000000 + i * 1000).toISOString(), image: { file: "fixture.png" }, width: 832, height: 1216, seed: i, ...extra });
const state = { works: [work(1)], calls: [], controllers: {} };

const server = createServer(async (req, res) => {
  try {
    const p = new URL(req.url, "http://localhost").pathname;
    if (p.startsWith("/api/")) {
      let body = "";
      for await (const part of req) body += part;
      state.calls.push({ p, method: req.method, body: body ? JSON.parse(body) : null });
      const custom = state.controllers[p];
      if (custom && (await custom(req, res, body))) return;
      if (p === "/api/gen" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "X-Gen-Job": "fixture" });
        res.write('event: progress\ndata: {"value":1,"max":2}\n\n');
        setTimeout(() => res.end("event: done\ndata: " + JSON.stringify({ image: "data:image/png;base64," + PNG, seed: 1, width: 832, height: 1216 }) + "\n\n"), 150);
        return;
      }
      if (p === "/api/image" || p.startsWith("/api/recipes/files/")) {
        res.setHeader("Content-Type", "image/png");
        return res.end(Buffer.from(PNG, "base64"));
      }
      const data = {
        "/api/ping": { ok: true, comfy: true },
        "/api/gen/active": { ok: true, jobs: [] },
        "/api/recipes": { ok: true, items: state.works },
        "/api/usage": { counts: {}, mine: {}, last: {} },
        "/api/decks": { ok: true, decks: [] },
        "/api/lora-push": { version: 0 },
        "/api/discord/config": { ok: true, configured: false, enabled: false, mode: "webhook" },
        "/api/card-groups": { ok: true, groups: [] },
        "/api/face/status": { ready: true },
        "/api/loras": { items: [], categories: [] },
        "/api/sampling": { ok: true, base: { steps: 28, cfg: 5, sampler_name: "euler", scheduler: "normal" }, hires: { fast: {}, deep: {} } },
        "/api/genlog": { ok: true, items: [] },
      }[p] || { ok: true, items: [] };
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(data));
    }
    const name = decodeURIComponent(p.slice(1)) || "index.html";
    if (baseline[name]) return res.writeHead(200, { "Content-Type": name.endsWith(".css") ? "text/css" : "text/javascript" }), res.end(baseline[name]);
    let file = resolve(root, front, name);
    if (!existsSync(file)) file = resolve(root, "web", name);
    if (!file.startsWith(root + sep) || !existsSync(file)) return res.writeHead(404).end();
    res.setHeader("Content-Type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" }[extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
// 關掉瀏覽器的預開頁：墨池會在背後預開相鄰房間，兩個分頁、來回換頁時會互相干擾測試（預開的行為另外在 test_prerender_handoff.mjs 測）。
const browser = await chromium.launch({ headless: true, args: ["--disable-features=Prerender2,SpeculationRulesPrefetchProxy"], ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 500)}`);
  if (!cond) failed++;
};
const errors = [];
async function context({ width = 1440, height = 900, lang = "zh-Hant", init } = {}) {
  const phone = width < 500;
  const c = await browser.newContext({ viewport: { width, height }, hasTouch: phone, isMobile: phone, serviceWorkers: "block" });
  await c.route(/\/api\/interrupt(?:\?|$)/, (r) => r.abort());
  await c.addInitScript((lang) => {
    if (location.protocol !== "http:") return; // about:blank 讀不了 localStorage
    if (!localStorage.getItem("mochi.language.v1")) localStorage.setItem("mochi.language.v1", lang);
    localStorage.setItem("mochi.tour.declined.v1", "99");
  }, lang);
  if (init) await c.addInitScript(init);
  c.on("page", (p) => {
    p.setDefaultTimeout(20000); // 詞庫 850KB 讀進來要一點時間，忙的時候 8 秒不夠
    p.on("pageerror", (e) => errors.push(e.message));
  });
  return c;
}
// 本機的連接埠一陣一陣被系統擋（WinNAT，ERR_NETWORK_ACCESS_DENIED），不是程式壞了：換頁被擋就等一下再試。
async function go(page, url) {
  for (let i = 0; ; i++) {
    try {
      return await page.goto(url);
    } catch (e) {
      if (i >= 4 || !/ERR_NETWORK_ACCESS_DENIED|ERR_CONNECTION_REFUSED/.test(String(e))) throw e;
      await sleep(1500);
    }
  }
}
// ONLY=6 只跑名字以 6 開頭的那一步。
const step = async (name, fn) => {
  if (process.env.ONLY && !name.startsWith(process.env.ONLY)) return;
  try {
    await fn();
  } catch (e) {
    ok(name, false, String(e).split("\n")[0]);
  }
};

try {
  // 1. 雙分頁接手 Hires
  await step("1. 接手不覆寫已還原的原圖", async () => {
    const c = await context({
      init: () => {
        if (location.protocol !== "http:" || localStorage.getItem("mochi.shots.v1")) return;
        localStorage.setItem("mochi.shots.v1", JSON.stringify([{ id: "s37", status: "done", image: "/api/image?filename=base.png", positive: "red hair", mine: ["red hair"], drawn: [], width: 832, height: 1216, seed: 1, rating: "general", at: new Date().toISOString(), hiresJob: { job: "fixture-hi", mode: "quick", scale: 1.5 } }]));
      },
    });
    let attaches = 0;
    let release;
    const gate = new Promise((r) => (release = r));
    state.controllers["/api/gen/attach"] = async (q, res) => {
      const n = ++attaches;
      if (n === 1) await Promise.race([gate, sleep(11000)]);
      res.writeHead(200, { "Content-Type": "text/event-stream", "X-Gen-Job": "fixture-hi" });
      res.end("event: done\ndata: " + JSON.stringify({ image: "/api/image?filename=hi.png", width: 1248, height: 1824, seed: 1 }) + "\n\n");
      return true;
    };
    const a = await c.newPage();
    const b = await c.newPage();
    await go(a, origin + "/index.html?debug");
    await a.locator("#wall .shot").first().waitFor();
    for (let i = 0; i < 40 && !attaches; i++) await sleep(80);
    await go(b, origin + "/index.html?debug");
    await b.locator("#wall .shot").first().waitFor();
    release();
    await a.waitForFunction(() => window.mochi?.shots[0]?.image?.includes("hi.png"), null, { timeout: 8000 });
    await a.locator("#wall .shot").hover();
    await a.locator(".shot-hires").first().click();
    await a.getByText("還原原圖", { exact: true }).click();
    await a.waitForFunction(() => window.mochi?.shots[0]?.image?.includes("base.png"));
    await sleep(500);
    await a.close();
    await sleep(1800);
    const after = await b.evaluate(() => ({ image: window.mochi.shots[0].image, stored: JSON.parse(localStorage.getItem("mochi.shots.v1"))[0].image }));
    ok("1. 另一頁還原原圖後關掉：接手的那頁不再接舊的 Hires", attaches === 1, `attach ${attaches} 次`);
    ok("1. 畫面和存檔都留在原圖", after.image.includes("base.png") && after.stored.includes("base.png"), JSON.stringify(after));
    delete state.controllers["/api/gen/attach"];
    await c.close();
  });

  // 5. 同名、不同資料夾的底模
  await step("5. 同名底模", async () => {
    state.works = [work(1, { checkpoint: "A/same.safetensors" })];
    state.controllers["/api/checkpoints"] = async (q, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ items: ["A/same.safetensors", "B/same.safetensors"].map((ckpt_name) => ({ ckpt_name })), current: "B/same.safetensors" }));
      return true;
    };
    const c = await context({ init: () => location.protocol === "http:" && localStorage.setItem("yz-ckpt", "B/same.safetensors") });
    const p = await c.newPage();
    await go(p, origin + "/album.html");
    await p.locator('[data-id="work1"]').click();
    await p.locator(".reprint-btn").click();
    await p.locator("#recipe-note").waitFor();
    await sleep(400);
    const note = await p.locator("#recipe-note").innerText();
    ok("5. 同名不同資料夾：便條說不一樣、給「換成這組模型」", !note.includes("跟現在選的一樣") && note.includes("換成這組模型"), note);
    ok("5. 便條寫出資料夾（A/same）", note.includes("A/same"), note);
    delete state.controllers["/api/checkpoints"];
    state.works = [work(1)];
    await c.close();
  });

  // 6. 卡冊帶成品回已有牌的合成池：份量
  await step("6. 卡冊帶來的份量", async () => {
    const c = await context();
    const p = await c.newPage();
    await go(p, origin + "/index.html?debug");
    await p.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0 && window.mochi);
    // 池裡先有一張無關的牌，再像卡冊那樣在同一分頁寫便條（成品「加入合成池」帶 1.2）
    const other = await p.evaluate(() => {
      const t = window.mochi.lib().cards.find((c) => c.suit !== "chara" && c.tag !== "red hair").tag;
      window.mochi.pin(t);
      return t;
    });
    await sleep(500);
    await p.evaluate(async () => {
      const S = await import("./store.js");
      S.handOffPool(["red hair"], "book", { "red hair": 1.2 });
    });
    await go(p, origin + "/book.html");
    await go(p, origin + "/index.html?debug");
    await p.waitForFunction(() => window.mochi?.pool?.has("red hair"));
    await sleep(300);
    const got = await p.evaluate((other) => ({ red: document.querySelector('#pool-well .card[data-tag="red hair"] .card-w')?.textContent || "1.0", other: window.mochi.pool.has(other) }), other);
    ok("6. 已有牌的池子：卡冊帶來的紅髮保留 1.2", got.red === "1.2", JSON.stringify(got));
    ok("6. 原本那張還在", got.other, JSON.stringify(got));
    await c.close();
  });

  // 12. 手機詳情的「⋯」Esc
  await step("12. ⋯ 的 Esc", async () => {
    const c = await context({ width: 390, height: 844 });
    const p = await c.newPage();
    await go(p, origin + "/album.html");
    await p.locator('[data-id="work1"]').click();
    await p.locator(".foot-more-btn").click();
    await p.locator(".foot-more-menu:not([hidden])").waitFor();
    await p.keyboard.press("Escape");
    await sleep(400);
    const s = await p.evaluate(() => ({
      menu: document.querySelector(".foot-more-menu")?.hidden,
      sheet: !!document.querySelector(".overlay .sheet"),
      focus: document.activeElement?.classList.contains("foot-more-btn"),
    }));
    ok("12. 一次 Esc 只收選單，詳情還在、焦點回「⋯」", s.menu === true && s.sheet && s.focus, JSON.stringify(s));
    await c.close();
  });

  // 13. 手機英文的種子框
  await step("13. 英文種子框", async () => {
    const c = await context({ width: 390, height: 844, lang: "en" });
    const p = await c.newPage();
    await go(p, origin + "/index.html?debug");
    // 種子框在抽牌那排：池裡有牌才一定畫出來（照檢查報告的步驟：先放一組牌）。
    // 手機的字盒是收著的抽屜，頁面上不先畫牌：等詞庫讀好就好。
    await p.waitForFunction(() => window.mochi?.lib()?.cards?.length > 0);
    await p.evaluate(() => window.mochi.pin(window.mochi.lib().cards.find((c) => c.suit !== "chara").tag));
    await p.waitForFunction(() => document.querySelector(".seed-ctl .seed-ctl-input"), null, { timeout: 15000 });
    await sleep(500);
    const m = await p.evaluate(() => {
      const i = document.querySelector(".seed-ctl .seed-ctl-input");
      const cs = getComputedStyle(i);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      return { text: ctx.measureText(i.placeholder || i.value).width, room: i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), placeholder: i.placeholder };
    });
    ok("13. 手機英文：種子框的提示字放得下", m.text <= m.room + 0.5, JSON.stringify(m));
    await c.close();
  });

  // 15. 疊印台印製中的狀態字
  await step("15. 疊印台淡入", async () => {
    state.controllers["/api/gen"] = async (req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream", "X-Gen-Job": "proof" });
      for (let i = 1; i <= 12; i++) {
        res.write("event: progress\ndata: " + JSON.stringify({ value: i, max: 12 }) + "\n\n");
        await sleep(95);
      }
      res.end("event: done\ndata: " + JSON.stringify({ image: "data:image/png;base64," + PNG, width: 832, height: 1216, seed: 9 }) + "\n\n");
      return true;
    };
    const c = await context({ width: 1366, height: 768 });
    const p = await c.newPage();
    await go(p, origin + "/fuse.html");
    await p.locator("#trials button").nth(1).click();
    await p.evaluate(() => {
      const original = Element.prototype.animate;
      window.repeats = [];
      Element.prototype.animate = function (f, o) {
        if (this.querySelector(".pv-state") && this.dataset.swapKey) window.repeats.push(this.dataset.swapKey);
        return original.call(this, f, o);
      };
    });
    await p.locator(".pb-go").click();
    await p.waitForFunction(() => document.querySelector(".pv-cap-state")?.dataset.state === "done", null, { timeout: 10000 });
    const repeats = await p.evaluate(() => window.repeats);
    ok("15. 12 步進度：狀態字最多在換狀態時淡入（不是每一步）", repeats.length <= 3, JSON.stringify(repeats));
    delete state.controllers["/api/gen"];
    await c.close();
  });

  ok("沒有頁面錯誤", !errors.length, errors.join("\n"));
} finally {
  await browser.close();
  server.closeAllConnections?.();
  server.close();
}
console.log(failed ? `\n${failed} 項沒過` : "\n全部通過");
process.exit(failed ? 1 : 0);
