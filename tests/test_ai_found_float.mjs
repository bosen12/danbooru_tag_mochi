// 墨池助手找牌浮窗的瀏覽器回歸測試。真前端、真詞庫、假的模型 SSE。
// node scripts/test_ai_found_float.mjs
// BASELINE=<commit> 時只用該版本的 assistant.js，其餘資源照工作樹。
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
const frontendName = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";
const frontend = resolve(root, frontendName);
const shared = resolve(root, "web");
const assetDirs = new Set([frontend, shared]);
const prompt = "找溫泉的牌";
const args = { query: "溫泉", also: ["洗浴", "浴場", "bath", "shower", "towel"], limit: 5 };
const toolId = "find-bath-cards";
const connection = { kind: "cli", provider: "codex" };
const chats = [];

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

function scriptedReply(messages) {
  chats.push(messages);
  const userAt = messages.findLastIndex((m) => m.role === "user");
  const said = messages[userAt]?.content.split("\n").at(-1);
  assert.equal(said, prompt, "mock 應收到找溫泉的牌");
  if (messages.slice(userAt + 1).some((m) => m.role === "tool")) {
    return sse([["text", { delta: "找到不少。" }], ["done", { reason: "end" }]]);
  }
  return sse([
    ["tool_calls", { calls: [{ id: toolId, name: "find_cards", args }] }],
    ["done", { reason: "tool_calls" }],
  ]);
}

const blockedApi = (pathname) => /^\/api\/(?:gen|interrupt)\/?$/.test(pathname);
const apiFixtures = {
  "/api/assistant/status": { ok: true, configured: true, connection, local: true, allowRemote: false },
  "/api/assistant/config": { ok: true, connection, allowRemote: false },
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
    try {
      if (blockedApi(pathname)) return res.writeHead(403).end();
      if (pathname === "/api/assistant/chat" && req.method === "POST") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const reply = scriptedReply(JSON.parse(Buffer.concat(chunks).toString("utf8")).messages);
        return res.writeHead(200, { "Content-Type": "text/event-stream" }).end(reply);
      }
      if (pathname.startsWith("/api/")) {
        return res.writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify(apiFixtures[pathname] || { ok: true, items: [] }));
      }
      const name = decodeURIComponent(pathname.slice(1)) || "index.html";
      if (baseline && name === "assistant.js") return res.writeHead(200, { "Content-Type": mime[".js"] }).end(baseline);
      for (const dir of assetDirs) {
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

const textOf = async (locator) => (await locator.textContent()).trim();
const poolCard = (page, tag) => page.locator(`#pool-well [data-tag=${JSON.stringify(tag)}]`);
const foundCards = (dialog, selector = "") => dialog.locator(`.ai-found-grid .ai-found-card${selector}`);
const tagsOf = (locator) => locator.evaluateAll((nodes) => nodes.map((node) => node.dataset.tag).sort());

let failed = 0;
let browser;
let server;
let origin;

async function search(page) {
  const input = page.locator(".ai-panel .ai-input");
  await input.fill(prompt);
  await input.press("Enter");
  await page.locator('.ai-send[data-running="false"]:not([data-pending])').waitFor();

  assert.equal(chats.length, 2, "應有一次工具呼叫、一次帶結果的模型請求");
  const tools = chats[1].slice(chats[1].findLastIndex((m) => m.role === "user") + 1).filter((m) => m.role === "tool");
  assert.equal(tools.length, 1, "第二次請求應送回一筆工具結果");
  const result = JSON.parse(tools[0].content);
  assert.equal(result.ok, true, "find_cards 應成功");
  assert.equal(result.count, args.limit, "模型應只收到 limit 張牌");
  assert.equal(result.cards.length, result.count);
  assert.ok(Number.isInteger(result.total) && result.total >= 30, `詞庫應有至少 30 個結果，實際為 ${result.total}`);

  const button = page.locator('.ai-msg.ai-bot li.ai-step[data-status="done"] button.ai-step-found');
  assert.equal(await button.count(), 1, "完成的找牌步驟應有一個「看這 N 張」按鈕");
  return { ...result, button, dialog: page.locator("#ai-found") };
}

async function open({ button, dialog }) {
  await button.click();
  await dialog.waitFor({ state: "visible" });
}

async function assertFiltered(dialog, selector) {
  const expected = await tagsOf(foundCards(dialog, selector));
  const others = await tagsOf(foundCards(dialog, `:not(${selector})`));
  assert.ok(expected.length && others.length, "篩選前應同時有符合和不符合的牌");
  assert.deepEqual(await tagsOf(foundCards(dialog).filter({ visible: true })), expected, "可見牌應剛好符合篩選條件");
  assert.deepEqual(await tagsOf(foundCards(dialog, "[hidden]")), others, "不符合的牌應設為 hidden");
  return expected.length;
}

function fail(name, err) {
  failed++;
  console.error(`FAIL ${name}\n${err.stack || err}`);
}

async function scenario(name, check, language = "zh-Hant") {
  let context;
  const pageErrors = [];
  chats.length = 0;
  try {
    context = await browser.newContext({ viewport: { width: 1500, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === origin && !blockedApi(url.pathname) ? route.continue() : route.abort();
    });
    await context.addInitScript((language) => {
      localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled: true, open: true }));
      localStorage.setItem("mochi.tour.declined.v1", "99");
      localStorage.setItem("mochi.language.v1", language);
    }, language);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on("pageerror", (err) => pageErrors.push(err.message));
    await page.goto(`${origin}/index.html?debug`);
    await page.locator("#lib-grid .card").first().waitFor();
    await page.locator(".ai-panel .ai-input").waitFor();
    const result = await search(page);
    await check(page, result);
    console.log(`ok   ${name} (total=${result.total}, count=${result.count})`);
  } catch (err) {
    fail(name, err);
  } finally {
    await context?.close();
    if (pageErrors.length) fail(`${name} 的頁面錯誤`, new Error(pageErrors.join("\n")));
  }
}

try {
  const baseline = process.env.BASELINE
    ? execFileSync("git", ["show", `${process.env.BASELINE}:${frontendName}/assistant.js`], { cwd: root, maxBuffer: 2 ** 24 })
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

  await scenario("找牌步驟、浮窗、完整牌面和花色張數", async (_page, result) => {
    const { total, button, dialog, cards } = result;
    assert.equal(await textOf(button), `看這 ${total} 張`);
    await open(result);
    assert.ok(await dialog.evaluate((node) => node.classList.contains("ai-found") && !node.hidden));
    assert.equal(await dialog.getAttribute("role"), "dialog");
    assert.equal(await dialog.getAttribute("aria-modal"), "false");
    assert.match(await textOf(dialog.locator(".ai-found-title")), new RegExp(`\\b${total}\\b`));

    const rendered = await foundCards(dialog).evaluateAll((nodes) => nodes.map((node) => ({
      tag: node.dataset.tag,
      suit: node.dataset.suit,
      hasFace: node.matches("button") && !!node.querySelector(".card"),
    })));
    assert.equal(rendered.length, total, "牌格應有全部結果");
    assert.equal(await foundCards(dialog).filter({ visible: true }).count(), total);
    assert.equal(new Set(rendered.map((card) => card.tag)).size, total, "每張牌只能出現一次");
    assert.ok(rendered.every((card) => card.tag && card.suit && card.hasFace), "每筆結果都應是帶 tag、花色和卡面的按鈕");
    for (const { tag, suit } of cards) {
      assert.ok(rendered.some((card) => card.tag === tag && card.suit === suit), `模型收到的 ${tag} 應出現在完整結果中`);
    }

    const suits = dialog.locator(".ai-found-suits button");
    assert.equal(await suits.first().getAttribute("data-suit"), "");
    assert.equal(await suits.first().getAttribute("aria-pressed"), "true");
    assert.equal(await suits.locator(".ai-found-n").first().textContent(), String(total));
    const tally = new Map();
    for (const { suit } of rendered) tally.set(suit, (tally.get(suit) || 0) + 1);
    assert.ok(tally.size > 1, "測試詞應命中不同花色");
    assert.equal(await suits.count(), tally.size + 1, "命中的每個花色只能有一鈕");
    for (const [suit, count] of tally) {
      const tab = suits.and(dialog.locator(`[data-suit=${JSON.stringify(suit)}]`));
      assert.equal(await textOf(tab.locator(".ai-found-n")), String(count));
      assert.equal(await tab.getAttribute("aria-pressed"), "false");
    }
  });

  await scenario("花色和小分類篩選，以及回到全部", async (_page, result) => {
    const { dialog, total } = result;
    await open(result);
    const cards = foundCards(dialog);
    const all = dialog.locator('.ai-found-suits button[data-suit=""]');
    const suits = dialog.locator('.ai-found-suits button[data-suit]:not([data-suit=""])');
    const tabs = await suits.evaluateAll((nodes) => nodes.map((node) => ({
      suit: node.dataset.suit,
      count: Number(node.querySelector(".ai-found-n")?.textContent),
    })));
    assert.ok(tabs.length > 1 && tabs.every(({ count }) => Number.isInteger(count) && count > 0));
    const largest = tabs.sort((a, b) => b.count - a.count)[0];
    const suitSelector = `[data-suit=${JSON.stringify(largest.suit)}]`;
    const tab = dialog.locator(`.ai-found-suits button${suitSelector}`);
    await tab.click();
    assert.equal(await all.getAttribute("aria-pressed"), "false", `首次點 ${largest.suit} 後，「全部」應取消選中`);
    assert.equal(await tab.getAttribute("aria-pressed"), "true", `首次點 ${largest.suit} 後，該花色應選中`);
    assert.equal(await assertFiltered(dialog, suitSelector), largest.count);

    // 另選確實有多個小分類的花色，避免把最大花色的分類數量寫死。
    const groupsBySuit = await cards.evaluateAll((nodes) => {
      const groups = {};
      for (const { dataset: { suit, group } } of nodes) {
        if (group) (groups[suit] ??= new Set()).add(group);
      }
      return Object.fromEntries(Object.entries(groups).map(([suit, groups]) => [suit, [...groups]]));
    });
    const groupedSuit = tabs.find(({ suit }) => groupsBySuit[suit]?.length > 1);
    assert.ok(groupedSuit, "測試詞應命中同一花色中的多個小分類");
    const groupSuitSelector = `[data-suit=${JSON.stringify(groupedSuit.suit)}]`;
    await dialog.locator(`.ai-found-suits button${groupSuitSelector}`).click();
    const groups = dialog.locator(".ai-found-groups");
    await groups.waitFor({ state: "visible" });
    const groupTabs = groups.locator("button[data-group]");
    assert.equal(await groupTabs.first().getAttribute("data-group"), "");
    assert.equal(await groupTabs.first().getAttribute("aria-pressed"), "true");
    assert.deepEqual(await groupTabs.evaluateAll((nodes) => nodes.slice(1).map((node) => node.dataset.group).sort()),
      groupsBySuit[groupedSuit.suit].sort());
    const groupSelector = `[data-group=${JSON.stringify(await groupTabs.nth(1).getAttribute("data-group"))}]`;
    const group = groups.locator(`button${groupSelector}`);
    await group.click();
    assert.equal(await group.getAttribute("aria-pressed"), "true");
    assert.equal(await groupTabs.first().getAttribute("aria-pressed"), "false");
    await assertFiltered(dialog, `${groupSuitSelector}${groupSelector}`);

    await all.click();
    assert.equal(await all.getAttribute("aria-pressed"), "true");
    assert.equal(await cards.filter({ visible: true }).count(), total);
    assert.equal(await foundCards(dialog, "[hidden]").count(), 0);
  });

  await scenario("浮窗卡牌加入與移出合成池", async (page, result) => {
    await open(result);
    const candidate = result.cards.find((card) => !card.blocked && !card.inPool);
    assert.ok(candidate, "模型列出的牌應有一張能加入、且尚未在合成池");
    const card = result.dialog.locator(`.ai-found-card[data-tag=${JSON.stringify(candidate.tag)}]`);
    const inPool = poolCard(page, candidate.tag);
    assert.equal(await inPool.count(), 0);
    assert.equal(await card.getAttribute("aria-pressed"), "false");
    await card.click();
    await inPool.waitFor({ state: "attached" });
    assert.equal(await card.getAttribute("aria-pressed"), "true");
    await card.click();
    await inPool.waitFor({ state: "detached" });
    assert.equal(await card.getAttribute("aria-pressed"), "false");
  });

  // 小字盒浮在字盒那一側（合成池整塊露出來，點牌飛進去看得到落地）：不擋的是合成池和規則。
  await scenario("浮窗開著時合成池和規則照常能用", async (page, result) => {
    await open(result);
    const plus = page.locator("#go-bar").getByRole("button", { name: "一次多一個" });
    const count = page.locator("#go-bar .btn-primary .count");
    const before = (await count.textContent()) || "";
    await plus.click();
    await page.waitForFunction((was) => (document.querySelector("#go-bar .btn-primary .count")?.textContent || "") !== was, before);
    assert.ok(await result.dialog.isVisible(), "改了一次的張數後浮窗應仍然開著");
    await page.locator("#go-bar").getByRole("button", { name: "一次少一個" }).click();
  });

  await scenario("關閉鈕和 Esc 都能收起並重開", async (page, result) => {
    await open(result);
    await result.dialog.locator(".ai-found-close").click();
    await result.dialog.waitFor({ state: "hidden" });
    await open(result);
    await page.keyboard.press("Escape");
    await result.dialog.waitFor({ state: "hidden" });
    await open(result);
  });

  await scenario("開始新對話時收起浮窗", async (page, result) => {
    await open(result);
    await page.locator('.ai-panel button[aria-label="新對話"]').click();
    await result.dialog.waitFor({ state: "hidden" });
    await result.button.waitFor({ state: "detached" });
  });

  await scenario("英文版顯示 Show all N，浮窗標題也翻譯", async (page, result) => {
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await textOf(result.button), `Show all ${result.total}`);
    await open(result);
    const title = await textOf(result.dialog.locator(".ai-found-title"));
    assert.match(title, new RegExp(`\\b${result.total}\\b`));
    assert.doesNotMatch(title, /\p{Script=Han}/u);
  }, "en");
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
