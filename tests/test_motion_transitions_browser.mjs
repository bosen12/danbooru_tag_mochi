// 切換的過渡（2026-11-21 專案主：切換不能生硬、要有過渡）。逐格看過，這裡守住幾個代表：
//   A. 字盒換花色：舊牌淡出（motion.js ghostOut 殘影），殘影不帶 id／data-tag／data-id，播完拿掉
//   B. 字盒搜尋說明：出現時長高淡入，收起時淡出
//   C. 規則的尺度籤：整排重畫後，狀態換了的那一顆播一下
//   D. 無限抽的「印幾張停」選單淡進來，旁邊的滑過去
//   E. 作品冊：日誌篩選，舊列淡出、新列進場；換分頁時舊的那一頁淡出
//   F. 卡冊：不看群組了，標頭淡出
//   G. 手機挑牌抽屜：打開時底下浮著的那幾樣淡出，收起時淡進來
//   H. 卡冊群組加牌：只有剛加的那張蓋章，已在組裡的章不重蓋（以前每挑一張整組的章都閃一下）
//
//   node scripts/test_motion_transitions_browser.mjs
//   BASELINE=HEAD node scripts/test_motion_transitions_browser.mjs   # 拿舊版對照（應該紅）
//   ONLY=E node scripts/test_motion_transitions_browser.mjs
//
// 假伺服器：不連 ComfyUI、不寫 data/。
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
  for (const f of ["app.js", "album.js", "album-log.js", "book.js", "book-groups.js", "cards.js", "motion.js", "styles.css", "groups.css"]) baseline[f] = execFileSync("git", ["show", `${process.env.BASELINE}:${front}/${f}`], { cwd: root, maxBuffer: 2 ** 25 });
}

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (r, v, code = 200) => {
  r.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(v));
  return true;
};
const work = (i, extra = {}) => ({ id: "work" + i, name: "Work " + i, rating: "general", positive: "red hair, standing, kimono", pinned: ["red hair"], createdAt: new Date(1700000000000 + i * 1000).toISOString(), image: { file: "fixture.png" }, width: 832, height: 1216, seed: i, ...extra });
const state = { works: [work(1)], calls: [], controllers: {}, slowStatic: {} };

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
    if (state.slowStatic[name]) await sleep(state.slowStatic[name]);
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

// 每頁都裝：記下殘影層（.ghost-layer）有沒有出現、裡面有沒有還帶 id／data-tag／data-id 的節點，以及某些節點一插進來有沒有動畫。
const watch = () => {
  if (location.protocol !== "http:") return;
  window.__seen = { ghost: 0, tagged: 0, floaters: 0 };
  new MutationObserver((list) => {
    for (const m of list)
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.classList.contains("ghost-layer")) {
          window.__seen.ghost++;
          if (n.querySelector("[id], [data-tag], [data-id]")) window.__seen.tagged++;
        }
        if (n.classList.contains("ghost-item") && n.parentElement === document.documentElement) window.__seen.floaters++;
      }
  }).observe(document, { childList: true, subtree: true });
};
const seen = (page) => page.evaluate(() => ({ ...window.__seen, left: document.querySelectorAll(".ghost-layer, html > .ghost-item").length }));
const reset = (page) => page.evaluate(() => Object.assign(window.__seen, { ghost: 0, tagged: 0, floaters: 0 }));
// 一個選擇器在接下來 ms 內有沒有任何一個節點帶著跑動的動畫（getAnimations）。
// scriptOnly：只算程式加的（element.animate），不算 CSS 的 transition／animation（按下去時的縮放那種本來就有）。
const animatesSoon = (page, sel, ms = 600, scriptOnly = false) =>
  page.evaluate(
    ([sel, ms, scriptOnly]) =>
      new Promise((done) => {
        const end = performance.now() + ms;
        const mine = (a) => !scriptOnly || (!(a instanceof CSSTransition) && !(a instanceof CSSAnimation));
        const look = () => {
          if ([...document.querySelectorAll(sel)].some((n) => n.getAnimations().some((a) => a.playState === "running" && mine(a)))) return done(true);
          if (performance.now() > end) return done(false);
          requestAnimationFrame(look);
        };
        look();
      }),
    [sel, ms, scriptOnly]
  );

try {
  await step("A. 字盒換花色：舊牌淡出（殘影），殘影不帶 id／data-tag，播完拿掉", async () => {
    const c = await context({ init: watch });
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator("#lib-grid .card").first().waitFor();
    await sleep(800);
    await reset(p);
    await p.locator("#suit-tabs .suit-tab").nth(3).click();
    await sleep(80);
    const mid = await seen(p);
    await sleep(700);
    const after = await seen(p);
    ok("A. 換花色時有殘影", mid.ghost >= 1, JSON.stringify(mid));
    ok("A. 殘影不帶 id、data-tag、data-id", mid.tagged === 0, JSON.stringify(mid));
    ok("A. 播完殘影拿掉", after.left === 0, JSON.stringify(after));
    await c.close();
  });

  await step("B. 字盒搜尋說明：出現時有動畫，收起時淡出", async () => {
    const c = await context({ init: watch });
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator("#lib-grid .card").first().waitFor();
    await sleep(600);
    const appear = animatesSoon(p, ".search-note", 1500);
    await p.locator("#lib-q").fill("kimono");
    ok("B. 說明行出現時有動畫", await appear);
    await sleep(800);
    await reset(p);
    await p.locator("#lib-q").fill("");
    await sleep(500);
    const s = await seen(p);
    ok("B. 說明行收起時淡出（殘影）", s.ghost >= 1, JSON.stringify(s));
    await c.close();
  });

  await step("C. 尺度籤：按下後那一顆有過渡", async () => {
    const c = await context();
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator('#rules [data-heat="tease"]').waitFor();
    await sleep(500);
    const moving = animatesSoon(p, '#rules [data-heat="tease"]', 500, true);
    await p.locator('#rules [data-heat="tease"]').click();
    ok("C. 誘惑那一顆有動畫", await moving);
    await c.close();
  });

  await step("D. 無限抽：「印幾張停」選單淡進來", async () => {
    const c = await context();
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator("#go-bar input[role=switch]").first().waitFor({ state: "attached" });
    await sleep(500);
    const moving = animatesSoon(p, "#go-bar .loop-max", 500);
    await p.locator("#go-bar input[role=switch]").first().evaluate((n) => n.click());
    ok("D. 選單有動畫", await moving);
    await c.close();
  });

  await step("E. 作品冊換分頁、日誌篩選：舊的淡出、新的列進場", async () => {
    const c = await context({ init: watch });
    const now = Date.now();
    state.controllers["/api/genlog"] = (q, r) =>
      json(r, { ok: true, more: false, total: 3, items: [
        { id: "e1", at: now, ok: true, image: "", positive: "red hair", seed: 1, rating: "general", origin: "mochi" },
        { id: "e2", at: now - 1000, ok: false, error: "壞了", positive: "kimono", seed: 2, rating: "general", origin: "mochi" },
        { id: "e3", at: now - 2000, ok: true, image: "", positive: "smile", seed: 3, rating: "general", origin: "mochi" },
      ] });
    const p = await c.newPage();
    await go(p, origin + "/album.html?tab=log");
    await p.locator(".log-row").first().waitFor();
    await sleep(800);
    await reset(p);
    const entering = animatesSoon(p, ".log-row", 800);
    await p.locator('#log-filters [data-v="failed"]').click();
    await sleep(60);
    await p.locator('#log-filters [data-v="all"]').click();
    ok("E. 篩選換回全部：新冒出來的列有進場動畫", await entering);
    const s1 = await seen(p);
    ok("E. 篩選掉的列淡出（殘影）", s1.ghost >= 1, JSON.stringify(s1));
    await sleep(800);
    await reset(p);
    await p.locator('#album-tabs [data-v="models"]').click();
    await sleep(120);
    const s2 = await seen(p);
    ok("E. 換到模型：日誌那一頁淡出（殘影）", s2.ghost >= 1, JSON.stringify(s2));
    delete state.controllers["/api/genlog"];
    await c.close();
  });

  await step("F. 卡冊：取消看群組時標頭淡出", async () => {
    const c = await context({ init: watch });
    state.controllers["/api/card-groups"] = (q, r) => json(r, { ok: true, groups: [{ id: "g-a", name: "長相 A", section: "feature", tags: ["red hair", "long hair"], at: 1 }] });
    const p = await c.newPage();
    await go(p, origin + "/book.html");
    await p.locator(".bs-tile, .bs-chip").first().waitFor();
    await p.locator(".bs-tile, .bs-chip").first().click();
    await p.locator("#book-shelf-head:not([hidden])").waitFor();
    await sleep(900);
    await reset(p);
    await p.locator(".bs-tile, .bs-chip").first().click();
    await sleep(120);
    const s = await seen(p);
    ok("F. 標頭淡出（殘影）", s.ghost >= 1, JSON.stringify(s));
    delete state.controllers["/api/card-groups"];
    await c.close();
  });

  await step("G. 手機挑牌：抽屜打開時底下浮著的淡出，收起時淡進來", async () => {
    const c = await context({ width: 390, height: 844, init: watch });
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator("#lib-toggle").waitFor();
    await sleep(900);
    await reset(p);
    await p.locator("#lib-toggle").tap();
    await sleep(80);
    const s = await seen(p);
    ok("G. 打開時浮著的那幾樣有淡出的複本", s.floaters >= 1, JSON.stringify(s));
    await sleep(700);
    ok("G. 複本播完拿掉", (await seen(p)).left === 0);
    const back = animatesSoon(p, ".go-float, .trash, .fav-hand", 1200);
    await p.locator(".picker-done").tap();
    ok("G. 收起時浮著的那幾樣淡進來", await back);
    await c.close();
  });

  await step("H. 群組加牌：只有剛加的那張蓋章，已在組裡的不重蓋", async () => {
    const group = { id: "g-a", name: "長相 A", section: "feature", tags: ["red hair", "long hair", "blue eyes"], createdAt: 1, updatedAt: 1 };
    state.controllers["/api/card-groups"] = (q, r, b) => {
      if (q.method === "POST") {
        const body = JSON.parse(b);
        Object.assign(group, { tags: body.tags, name: body.name, updatedAt: group.updatedAt + 1 });
        return json(r, { ok: true, group, groups: [group] });
      }
      return json(r, { ok: true, groups: [group] });
    };
    const c = await context();
    const p = await c.newPage();
    await go(p, origin + "/book.html");
    await p.locator(".bs-tile, .bs-chip").first().waitFor();
    await p.locator(".bs-tile, .bs-chip").first().click();
    await p.locator(".bsh-edit").waitFor();
    await sleep(600);
    await p.locator(".bsh-edit").click();
    await sleep(1500);
    const stamped = [];
    for (let round = 0; round < 2; round++) {
      await p.evaluate(() => document.querySelector('#book-grid .book-cell[data-ingroup="false"]')?.scrollIntoView({ block: "center" }));
      await sleep(500);
      const r = await p.evaluate(async () => {
        const cell = [...document.querySelectorAll("#book-grid .book-cell")].find((c) => c.dataset.ingroup === "false" && c.getBoundingClientRect().top > 60 && c.getBoundingClientRect().bottom < innerHeight);
        if (!cell) return { picked: "", stamps: [] };
        const picked = cell.dataset.tag;
        (cell.querySelector(".card") || cell).click();
        const seenTags = new Set();
        const end = performance.now() + 600;
        await new Promise((done) => {
          const look = () => {
            for (const a of document.getAnimations()) if (a.animationName === "bs-stamp") seenTags.add(a.effect?.target?.dataset?.tag || "?");
            if (performance.now() > end) return done();
            requestAnimationFrame(look);
          };
          look();
        });
        return { picked, stamps: [...seenTags] };
      });
      stamped.push(r);
      await sleep(500);
    }
    ok("H. 每挑一張只有那張蓋章", stamped.every((r) => r.picked && r.stamps.length === 1 && r.stamps[0] === r.picked), JSON.stringify(stamped));
    delete state.controllers["/api/card-groups"];
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
