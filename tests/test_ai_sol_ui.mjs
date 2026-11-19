// 墨池助手側欄回歸測試。使用實際 web6 和工具層，模型由本機 SSE 劇本代替。
//   node scripts/test_ai_sol_ui.mjs
//   BASELINE=<commit> node scripts/test_ai_sol_ui.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { extname, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
// 開源版沒有 web6/：前端和共用檔合成一個 web/。
const frontend = existsSync(resolve(root, "web6/index.html")) ? resolve(root, "web6") : resolve(root, "web");
const shared = resolve(root, "web");
const recommendations = [
  { tag: "beach", why: "跟夏天的感覺合" },
  { tag: "sunset", why: "光線好看" },
];
const recommend = "請推薦兩張牌";
const drawCount = "一次改成三張";
const addBeach = "把海邊加入合成池";
const checkHistory = "收到推薦後再問一句";
const checkHalo = "改張數並檢查光暈";
const chats = [];
const heldReplies = new Map();
let local = true;

function loadPlaywright() {
  for (const path of [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    resolve(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"),
  ].filter(Boolean)) {
    try {
      return require(path);
    } catch (err) {
      if (err.code !== "MODULE_NOT_FOUND") throw err;
    }
  }
  throw new Error("Install Playwright or set PLAYWRIGHT_MODULE");
}

const sse = (events) => events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
const end = (delta) => sse([["text", { delta }], ["done", { reason: "end" }]]);
const call = (...calls) => sse([["tool_calls", { calls }], ["done", { reason: "tool_calls" }]]);

async function script(body) {
  const { messages } = body;
  const user = messages.findLastIndex((m) => m.role === "user");
  const said = (messages[user]?.content || "").split("\n").at(-1);
  const results = messages.slice(user + 1).filter((m) => m.role === "tool");
  chats.push({ said, messages, results });
  if (said.startsWith("［使用者")) return end("好。");
  if (results.length) {
    await heldReplies.get(said);
    return end(said === recommend ? "這兩張可以試試。" : "好了。");
  }
  if (said === recommend) {
    // 先放三次查詢，確保同一批真的形成「已查詢 3 步」折疊。
    const reads = [1, 2, 3].map((n) => ({ id: `read-${n}`, name: "get_workspace", args: {} }));
    return call(...reads, { id: "suggest", name: "suggest_cards", args: { cards: recommendations } });
  }
  if (said === drawCount || said === checkHalo) return call({ id: "count", name: "set_draw_count", args: { n: 3 } });
  if (said === addBeach) return call({ id: "pool", name: "change_pool", args: { add: ["beach"] } });
  return end("好。");
}

const blockedApi = (pathname) => pathname === "/api/gen" || pathname === "/api/interrupt";
const connection = { kind: "cli", provider: "codex" };
const apiFixtures = {
  "/api/gen/active": { ok: true, jobs: [] },
  "/api/usage": { counts: {}, mine: {}, last: {} },
  "/api/lora-push": { version: 0 },
  "/api/decks": { ok: true, decks: [] },
  "/api/loras": { items: [], categories: [] },
  "/api/card-groups": { ok: true, groups: [] },
};
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function mockServer(baseline) {
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const json = (value) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(value));
    try {
      if (blockedApi(pathname)) return res.writeHead(403).end();
      if (pathname === "/api/assistant/status") return json({ ok: true, configured: true, connection, local, allowRemote: false });
      if (pathname === "/api/assistant/config") return json({ ok: true, connection, allowRemote: false });
      if (pathname === "/api/assistant/chat" && req.method === "POST") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const reply = await script(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        return res.writeHead(200, { "Content-Type": "text/event-stream" }).end(reply);
      }
      if (pathname.startsWith("/api/")) return json(apiFixtures[pathname] || { ok: true, items: [] });
      const name = decodeURIComponent(pathname.slice(1)) || "index.html";
      if (baseline && name === "assistant.js") return res.writeHead(200, { "Content-Type": mime[".js"] }).end(baseline);
      for (const dir of [frontend, shared]) {
        const file = resolve(dir, name);
        if (!file.startsWith(dir + sep)) return res.writeHead(403).end();
        try {
          const content = await readFile(file);
          return res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" }).end(content);
        } catch (err) {
          if (err.code !== "ENOENT" && err.code !== "EISDIR") throw err;
        }
      }
      res.writeHead(404).end();
    } catch (err) {
      console.error("Mock HTTP:", err);
      res.writeHead(500).end();
    }
  });
}

let failed = 0;
let browser;
let server;
let origin;
const pageErrors = [];
const textOf = async (locator) => (await locator.textContent()).trim();
const drawValue = async (page) => (await textOf(page.locator("#go-bar .btn-primary .count"))).replace(/^×\s*/, "");
const poolCard = (page, tag) => page.locator(`#pool-well [data-tag="${tag}"]`);
const lastReply = (page) => page.locator(".ai-msg.ai-bot").last();
const idle = (page) => page.locator('.ai-send[data-running="false"]:not([data-pending])').waitFor();
const running = (page) => page.locator('.ai-send[data-running="true"]').waitFor();

function fail(name, err) {
  failed++;
  console.error(`FAIL ${name}\n${err.stack || err}`);
}

async function scenario(name, check, { reducedMotion = "reduce", isLocal = true } = {}) {
  let context;
  local = isLocal;
  chats.length = 0;
  try {
    context = await browser.newContext({ viewport: { width: 1500, height: 900 }, reducedMotion, serviceWorkers: "block" });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === origin && !blockedApi(url.pathname) ? route.continue() : route.abort();
    });
    await context.addInitScript(() => {
      localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled: true, open: true }));
      localStorage.setItem("mochi.tour.declined.v1", "99");
      localStorage.setItem("mochi.language.v1", "zh-Hant");
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on("pageerror", (err) => pageErrors.push(`${name}: ${err.message}`));
    await page.goto(`${origin}/index.html?debug`);
    await page.locator("#lib-grid .card").first().waitFor();
    await page.locator(".ai-panel .ai-input").waitFor();
    await check(page);
    console.log(`ok   ${name}`);
  } catch (err) {
    fail(name, err);
  } finally {
    await context?.close();
  }
}

async function send(page, text) {
  const input = page.locator(".ai-input");
  await input.fill(text);
  await Promise.all([
    page.waitForResponse((res) => new URL(res.url()).pathname === "/api/assistant/chat" && res.ok()),
    input.press("Enter"),
  ]);
}

async function whileReplyHeld(text, check) {
  const { promise, resolve: release } = Promise.withResolvers();
  heldReplies.set(text, promise);
  try {
    await check();
  } finally {
    release();
    heldReplies.delete(text);
  }
}

try {
  const lexicon = JSON.parse(await readFile(resolve(shared, "lexicon.json"), "utf8"));
  const cards = new Map(lexicon.tags.map((card) => [card.tag, card]));
  for (const { tag } of recommendations) {
    assert.equal(cards.get(tag)?.gate, "any", `測試用牌 ${tag} 必須存在且不受尺度限制`);
  }
  const baseline = process.env.BASELINE
    ? execFileSync("git", ["show", `${process.env.BASELINE}:web6/assistant.js`], { cwd: root, maxBuffer: 2 ** 24 })
    : null;
  const { chromium } = loadPlaywright();
  server = mockServer(baseline);
  await new Promise((ready, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", ready);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });

  await scenario("推薦卡：顯示、摺疊、進行中鎖定、加入、復原與模型歷史", async (page) => {
    const reply = page.locator(".ai-msg.ai-bot").first();
    const items = reply.locator("li.ai-step .ai-sugg .ai-sugg-item");
    const first = reply.locator('li.ai-step .ai-sugg .ai-sugg-item[data-tag="beach"][data-n="1"]');
    const button = first.locator("button.ai-sugg-add");
    const beach = poolCard(page, "beach");
    await whileReplyHeld(recommend, async () => {
      await send(page, recommend);
      await running(page);
      await button.waitFor();
      assert.ok(await button.isDisabled(), "進行中，「加入」應鎖定");
      assert.equal(await beach.count(), 0, "推薦工具只展示牌");
      // 略過 Playwright 的 enabled 檢查，直接讓點擊抵達仍在處理中的按鈕。
      await button.click({ force: true });
      assert.equal(await beach.count(), 0, "進行中強制點擊也不應加入牌");
    });
    await idle(page);
    const fold = reply.locator(".ai-fold:not([open])");
    assert.match(await textOf(fold.locator("summary")), /已查詢\s*3\s*步/);
    assert.equal(await fold.locator(".ai-sugg").count(), 0, "推薦卡不可被摺入查詢紀錄");
    assert.deepEqual(await items.evaluateAll((nodes) => nodes.map((n) => [n.dataset.tag, n.dataset.n])),
      recommendations.map(({ tag }, i) => [tag, String(i + 1)]));
    const addLabels = [];
    for (const { tag, why } of recommendations) {
      const card = reply.locator(`.ai-sugg-item[data-tag="${tag}"]`);
      assert.ok(await card.locator(`.card[data-tag="${tag}"]`).isVisible(), `${tag} 應使用字盒卡面`);
      assert.equal(await textOf(card.locator(".ai-sugg-why")), why);
      const add = card.locator("button.ai-sugg-add");
      addLabels.push(await textOf(add));
      assert.ok(await add.isEnabled(), `${tag} 完成後應可加入`);
    }
    assert.equal(await beach.count(), 0, "進行中按下的加入不可延後執行");
    const steps = reply.locator("li.ai-step:not(.ai-step-fold)");
    const before = await steps.count();
    await button.click();
    await beach.waitFor();
    const added = reply.locator('.ai-sugg-item[data-tag="beach"][data-state="added"]');
    await added.locator("button.ai-sugg-add:disabled").waitFor();
    const addedStep = steps.filter({ has: page.locator(".ai-ops") });
    const undo = addedStep.locator("button.ai-step-undo", { hasText: "復原" });
    assert.equal(await steps.count(), before + 1, "加入應在同一則回覆新增一步");
    await undo.click();
    await beach.waitFor({ state: "detached" });
    await send(page, checkHistory);
    await idle(page);
    const nextRequest = chats.find(({ said }) => said === checkHistory);
    assert.ok(nextRequest?.messages.some((m) => m.role === "user" && m.content.startsWith("［使用者按了「加入」］")),
      "下一次請求的 user 歷史應包含加入紀錄");
    // 「加入」在英文字典已經是 Added（操作紀錄的動詞），按鈕用自己的字「加入這張」（Add）。
    assert.deepEqual(addLabels, ["加入這張", "加入這張"], "兩張推薦卡的按鈕文案應為「加入這張」");
  });

  await scenario("操作紀錄：一次 1 → 3、看變更、復原", async (page) => {
    assert.equal(await drawValue(page), "1");
    await send(page, drawCount);
    await idle(page);
    assert.equal(await drawValue(page), "3");
    const step = lastReply(page).locator('li.ai-step[data-status="done"]');
    const row = step.locator(".ai-ops .ai-op").filter({ has: page.locator(".ai-op-k", { hasText: /^一次$/ }) });
    assert.equal(await textOf(row.locator(".ai-op-v")), "1 → 3");
    assert.equal(await textOf(step.locator(".ai-step-look")), "看變更");
    assert.equal(await textOf(step.locator(".ai-step-undo")), "復原");
  });

  await scenario("操作紀錄：加入顯示中文牌名", async (page) => {
    await send(page, addBeach);
    await idle(page);
    await poolCard(page, "beach").waitFor();
    const row = lastReply(page).locator('li.ai-step[data-status="done"] .ai-ops .ai-op')
      .filter({ has: page.locator(".ai-op-k", { hasText: /^加入$/ }) });
    assert.equal(await textOf(row.locator(".ai-op-v")), cards.get("beach").zh);
  });

  await scenario("頂端：正常連線隱藏提示", async (page) => {
    const connectionOk = page.locator('.ai-conn[data-kind="ok"]');
    await connectionOk.waitFor({ state: "attached" });
    assert.ok(await connectionOk.isHidden(), "正常連線時不可顯示模型名稱");
    assert.equal(await connectionOk.getAttribute("hidden"), "", "正常連線提示應有 hidden 屬性");
  });

  await scenario("頂端：未開放的遠端連線顯示警告", async (page) => {
    const warning = page.locator('.ai-conn[data-kind="warn"]', { hasText: /主機.*允許/ });
    await warning.waitFor();
    assert.match(await textOf(warning), /主機(?:尚未|還沒|不)允許/);
  }, { isLocal: false });

  await scenario("空白畫面：通用例句、合成池引用、清除與搜尋引用", async (page) => {
    const empty = page.locator(".ai-empty");
    assert.equal(await empty.locator(".ai-sample").count(), 4);
    const pool = page.locator('[aria-labelledby="pool-title"]');
    const poolCount = await pool.locator("#pool-well .card[data-tag]").count();
    await pool.locator(".ai-ask").click();
    const forPool = page.locator('.ai-empty[data-ctx="pool"]');
    const summary = await textOf(forPool.locator(".ai-empty-ctx"));
    assert.match(summary, /合成池/);
    assert.match(summary, new RegExp(`(?:^|\\D)${poolCount}\\s*張`));
    assert.equal(await forPool.locator(".ai-sample").count(), 2);
    await page.locator(".ai-ref-x").click();
    const generic = page.locator(".ai-empty:not([data-ctx])");
    await generic.waitFor();
    assert.equal(await generic.locator(".ai-sample").count(), 4);
    await page.locator("#lib-q").fill("sunset");
    await page.locator("#library .ai-ask").click();
    await page.locator('.ai-empty[data-ctx="search"]').waitFor();
  });

  await scenario("光暈：寫入完成後兩秒內隱藏", async (page) => {
    await page.evaluate(() => {
      let doneAt;
      window.solHaloHiddenAfter = new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          const halo = document.querySelector(".ai-halo");
          if (!halo) return;
          if (halo.dataset.phase === "done" && !halo.hidden) doneAt ??= performance.now();
          if (doneAt === undefined || !halo.hidden) return;
          observer.disconnect();
          resolve(performance.now() - doneAt);
        });
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-phase", "hidden"] });
      });
    });
    await whileReplyHeld(checkHalo, async () => {
      await send(page, checkHalo);
      await lastReply(page).locator('li.ai-step[data-status="done"]').waitFor();
      assert.equal(await drawValue(page), "3");
      const elapsed = await page.evaluate(() => Promise.race([
        window.solHaloHiddenAfter,
        new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
      ]));
      assert.ok(elapsed !== null && elapsed <= 2000,
        elapsed === null ? "沒有觀察到完成光暈和隱藏屬性" : `光暈在 ${Math.round(elapsed)} ms 後才隱藏`);
      await running(page);
    });
    await idle(page);
  }, { reducedMotion: "no-preference" });

  assert.deepEqual(pageErrors, [], "頁面錯誤");
} catch (err) {
  fail("測試環境", err);
} finally {
  await browser?.close();
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((ready) => server.close(ready));
  }
}

console.log(failed ? `${failed} failed` : "all ok");
process.exitCode = failed ? 1 : 0;
