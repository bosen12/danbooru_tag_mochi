// 墨池助手：聊天流程的回歸測試（.council/ai-polish/astra-report.md 甲那幾項）。
// 真的 web6 頁面、真的工具層；模型換成照劇本回的假伺服器。絕不連 ComfyUI、不叫真的 CLI 或 API，/api/gen、/api/interrupt 一律擋。
//
//   node scripts/test_ai_polish_chat.mjs
//   BASELINE=<commit> node scripts/test_ai_polish_chat.mjs   # 拿那一版的 web6/assistant.js 對照（修之前應該紅）
//
// 驗的事：
//   3  初開聊天室、/status 還沒回來時連按兩次 Enter：只送一次。
//   1  一批工具還在跑時按「復原」：不准插進去（送給模型的歷史裡工具結果不能被使用者訊息打斷）；跑完才能復原。
//   6  工具改了工作台之後重新整理：這一輪還在，寫出停在哪、哪些已經生效。
//   7  模型事先寫好「已換黑髮」，結果是等確認：那句話不先放出來。
//   8  確認卡按「保留原狀」：步驟結案（略過）、排字不再等；關掉實驗功能再打開，舊卡失效、按了也不換牌。
//   12 回覆到一半按新對話：狀態列、送出鈕、引用、草稿都歸零。
//   14 遠端、主機沒開放：送出前就說，草稿留著，「重新檢查」通了就改口。
//   15 收起時：等確認是黃點、純回答到了亮「有新回覆」。
//   16 舊一輪抽牌的「看變更」指到自己那一輪的成品。
//   18 長對話送一句不重建舊訊息；串流一批字不會每個字排一次影格；連續查詢收成一行。
//   20 英文：搜尋引用照模板翻、送出鈕讀屏是 Send。
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
const frontend = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";
const baseline = process.env.BASELINE ? execFileSync("git", ["show", `${process.env.BASELINE}:web6/assistant.js`], { cwd: root, maxBuffer: 2 ** 24 }) : null;

// ---------- 假模型 ----------
const sse = (events) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
const chats = [];
function script(body) {
  chats.push(body);
  const msgs = body.messages || [];
  const lastUserIdx = msgs.map((m) => m.role).lastIndexOf("user");
  const said = String(msgs[lastUserIdx]?.content || "").split("\n").pop();
  const tools = msgs.slice(lastUserIdx).filter((m) => m.role === "tool").length;
  const end = (text) => sse([["text", { delta: text }], ["done", { reason: "end" }]]);
  const call = (...calls) => sse([["tool_calls", { calls }], ["done", { reason: "tool_calls" }]]);
  if (/^［使用者/.test(said)) return end("好。");
  if (/重送測試/.test(said)) return end("收到。");
  if (/改張數再存群組/.test(said))
    return tools === 0 ? call({ id: "a1", name: "set_draw_count", args: { n: 3 } }, { id: "a2", name: "save_card_group", args: { name: `海邊測試${chats.length}`, section: "env", tags: ["beach"] } }) : end("好了。");
  if (/先放紅髮/.test(said)) return tools === 0 ? call({ id: "r1", name: "change_pool", args: { add: ["red hair"] } }) : end("放了。");
  if (/直接換黑髮/.test(said))
    return tools === 0 ? sse([["text", { delta: "已換成黑髮。" }], ["tool_calls", { calls: [{ id: "b1", name: "change_pool", args: { add: ["black hair"] } }] }], ["done", { reason: "tool_calls" }]]) : end("等你確認。");
  if (/慢一點/.test(said)) return new Promise((r) => setTimeout(() => r(end("慢慢回來了")), 1500));
  if (/抽兩張/.test(said)) return tools === 0 ? call({ id: "d1", name: "draw_cards", args: { n: 2 } }) : end("抽好了。");
  if (/找很多牌/.test(said)) return tools === 0 ? call(...Array.from({ length: 3 }, (_, k) => ({ id: `f${k}`, name: "find_cards", args: { query: "hair", limit: 20 } }))) : end("找到了。");
  if (/查很多次/.test(said)) return tools === 0 ? call(...Array.from({ length: 6 }, (_, k) => ({ id: `q${k}`, name: "get_workspace", args: {} }))) : end("查完了。");
  if (/長回答/.test(said)) return sse([...Array.from({ length: 120 }, (_, k) => ["text", { delta: k % 10 === 9 ? "。\n" : "字" }]), ["done", { reason: "end" }]]);
  return end("好。");
}

let remote = false; // 模擬遠端、主機沒開放
let slowStatus = 0;
let groupDelay = 0;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (v, status = 200) => (res.writeHead(status, { "Content-Type": "application/json" }), res.end(JSON.stringify(v)));
  if (url.pathname.startsWith("/api/assistant/")) {
    const a = url.pathname.slice("/api/assistant/".length);
    if (a === "status") {
      if (slowStatus) await new Promise((r) => setTimeout(r, slowStatus));
      return json({ ok: true, configured: true, connection: { kind: "cli", provider: "codex", model: null }, allowRemote: false, local: !remote });
    }
    if (a === "config") return json({ ok: true, connection: { kind: "cli", provider: "codex", model: null, hasKey: false }, allowRemote: false });
    if (a === "detect") return json({ ok: true, clis: [{ id: "codex", name: "Codex", installed: true, version: "0.1", login: "ok", models: [], usable: true, isolation: { level: "readonly", note: "唯讀" } }] });
    if (a === "chat") {
      let raw = "";
      for await (const c of req) raw += c;
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      return res.end(await script(JSON.parse(raw || "{}")));
    }
    return json({ ok: true });
  }
  if (url.pathname === "/api/card-groups" && req.method === "POST") {
    let raw = "";
    for await (const c of req) raw += c;
    const g = JSON.parse(raw || "{}");
    if (groupDelay) await new Promise((r) => setTimeout(r, groupDelay));
    const group = { id: `g${Date.now()}`, name: g.name, section: g.section, tags: g.tags || [] };
    return json({ ok: true, group, groups: [group] });
  }
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
  if (baseline && name === "assistant.js") return res.writeHead(200, { "Content-Type": "text/javascript" }), res.end(baseline);
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
const errors = [];
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 500)}`);
  if (!cond) failed++;
};

async function newPage({ viewport = { width: 1440, height: 900 }, lang = "zh-Hant", open = true } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.route(/\/api\/(?:gen|interrupt)(?:\?|$)/, (r) => r.abort());
  await context.addInitScript(
    ({ lang, open }) => {
      localStorage.setItem("mochi.tour.declined.v1", "99");
      localStorage.setItem("mochi.language.v1", lang);
      if (!localStorage.getItem("mochi.assistant.v1")) localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled: true, open }));
    },
    { lang, open }
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/index.html?debug");
  await page.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0 && window.mochi);
  if (open) await page.locator(".ai-panel .ai-input").waitFor();
  return { context, page };
}
const poolTags = (page) => page.evaluate(() => [...document.querySelectorAll("#pool-well [data-tag]")].map((n) => n.dataset.tag));
const count = (page) => page.locator("#go-bar .btn-primary .count").textContent();
const idle = (page) => page.waitForFunction(() => document.querySelector(".ai-send")?.dataset.running !== "true");
// SHOTS=資料夾：沿路把聊天室截下來（看畫面用，不影響判定）
const shot = async (page, name) => process.env.SHOTS && page.locator(".ai-panel").screenshot({ path: resolve(process.env.SHOTS, `${name}.png`) }).catch(() => {});
async function send(page, text) {
  await page.locator(".ai-input").fill(text);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".ai-send")?.dataset.running === "true", null, { timeout: 5000 }).catch(() => {});
  await idle(page);
  await page.waitForTimeout(200);
}
/** 送給模型的歷史：每個帶工具呼叫的助手訊息，後面緊接著的就是它全部的工具結果（不能被使用者訊息插進來）。 */
function orderOk(messages) {
  for (let i = 0; i < messages.length; i++) {
    const calls = messages[i].toolCalls || [];
    if (!calls.length) continue;
    const next = messages.slice(i + 1, i + 1 + calls.length);
    // 最後一批可能還沒結果（下一輪才補）：有幾則看幾則，但中間不能是 user
    const firstUser = next.findIndex((m) => m.role !== "tool");
    if (firstUser >= 0 && next.slice(firstUser + 1).some((m) => m.role === "tool")) return false;
    if (firstUser >= 0 && messages.slice(i + 1 + firstUser).some((m) => m.role === "tool" && calls.some((c) => c.id === m.toolCallId))) return false;
  }
  return true;
}

try {
  // ---------- 3. 初開聊天室、/status 還沒回來時連按兩次 Enter ----------
  try {
    slowStatus = 900;
    const { context, page } = await newPage({ open: false });
    await page.locator("#ai-chat-btn").click();
    await page.locator(".ai-panel .ai-input").waitFor();
    // 打開時 open() 已經發了一次 /status：等它回來前就送，send() 自己會再等一次
    await page.evaluate(() => sessionStorage.clear());
    await page.locator(".ai-input").fill("重送測試");
    const before = chats.length;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    await page.locator(".ai-input").fill("重送測試");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
    await idle(page);
    slowStatus = 0;
    const users = await page.locator(".ai-msg.ai-user").count();
    ok("3 連按兩次 Enter：只送出一則", chats.length - before === 1 && users === 1, `模型請求 ${chats.length - before} 次、畫面上 ${users} 則`);
    await context.close();
  } catch (err) {
    ok("沒有例外", false, err.stack);
  }

  // ---------- 1. 一批工具還在跑時按復原 ----------
  try {
    const { context, page } = await newPage();
    groupDelay = 2500;
    const n0 = await count(page);
    const startAt = chats.length;
    await page.locator(".ai-input").fill("改張數再存群組");
    await page.keyboard.press("Enter");
    // 第一步（改張數）打勾、第二步（存群組）還在等
    await page.locator(".ai-step[data-status='done'] .ai-step-undo").first().waitFor({ timeout: 8000 });
    // force：鎖著的鈕 Playwright 會等它解鎖才點；這裡要模擬的是使用者當下就點下去。
    await page.locator(".ai-step[data-status='done'] .ai-step-undo").first().click({ force: true });
    await page.waitForTimeout(200);
    const mid = await count(page);
    ok("1 跑到一半按復原：先不復原（張數還是 3）", mid.includes("3"), `${n0} → ${mid}`);
    const locked = await page.locator(".ai-step-undo").first().getAttribute("aria-disabled", { timeout: 1000 }).catch(() => "沒有復原鈕");
    ok("1 跑到一半：復原鈕鎖著（aria-disabled）", locked === "true", String(locked));
    await idle(page);
    groupDelay = 0;
    const sent = chats.slice(startAt);
    ok("1 送給模型的歷史：工具結果沒有被使用者訊息打斷", sent.every((b) => orderOk(b.messages || [])), JSON.stringify(sent.map((b) => (b.messages || []).map((m) => m.role[0]).join(""))));
    await page.locator(".ai-step[data-status='done'] .ai-step-undo").first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    ok("1 這一批跑完：復原就按得動", !(await count(page)).includes("3"), await count(page));

    // ---------- 6. 工具改了工作台之後重新整理 ----------
    groupDelay = 4000;
    await page.locator(".ai-input").fill("改張數再存群組");
    await page.keyboard.press("Enter");
    await page.locator(".ai-msg.ai-bot").last().locator(".ai-step[data-status='done']").first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(150);
    await page.reload();
    await page.waitForFunction(() => window.mochi && document.querySelector(".ai-panel .ai-input"));
    groupDelay = 0;
    await page.waitForTimeout(300);
    const lastBot = page.locator(".ai-msg.ai-bot").last();
    const text = (await lastBot.textContent().catch(() => "")) || "";
    ok("6 重新整理後：這一輪還在、寫出停在哪", /重新整理時這一輪停了/.test(text), text.slice(0, 200));
    ok("6 重新整理後：做完的那一步還在（打勾）", (await lastBot.locator(".ai-step[data-status='done']").count()) >= 1);
    await context.close();
  } catch (err) {
    ok("沒有例外", false, err.stack);
  }

  // ---------- 7、8、15. 確認卡 ----------
  try {
    const { context, page } = await newPage();
    await send(page, "先放紅髮");
    await page.locator(".ai-input").fill("直接換黑髮");
    await page.keyboard.press("Enter");
    await page.locator(".ai-confirm[data-state='open']").waitFor({ timeout: 8000 });
    await idle(page);
    const said = (await page.locator(".ai-msg.ai-bot").last().textContent()) || "";
    ok("7 等確認時：模型事先寫的「已換成黑髮」不放出來", !said.includes("已換成黑髮"), said.slice(0, 200));
    await shot(page, "confirm-open");
    // 15. 收起時黃點
    await page.locator(".ai-panel button[aria-label='收起聊天室']").click();
    await page.waitForTimeout(300);
    ok("15 等確認時收起：印章亮黃點（confirm）", (await page.locator("#ai-chat-btn").getAttribute("data-state")) === "confirm", await page.locator("#ai-chat-btn").getAttribute("data-state"));
    await page.locator("#ai-chat-btn").click();
    await page.locator(".ai-confirm[data-state='open'] .btn-ghost").click();
    await page.waitForTimeout(400);
    await idle(page);
    const st = await page.locator(".ai-msg.ai-bot").nth(1).locator(".ai-step").last().getAttribute("data-status");
    ok("8 保留原狀：那一步結案成略過（不再是等確認）", st === "skipped", st);
    ok("8 保留原狀：排字盤上沒有還在等的", (await page.locator(".ai-sort[data-state='wait']").count()) === 0);
    ok("8 保留原狀：紅髮還在", (await poolTags(page)).includes("red hair"));
    await shot(page, "confirm-kept");

    // 8b. 關掉實驗功能再打開：舊卡失效，按了也不換牌
    await page.locator(".ai-input").fill("直接換黑髮");
    await page.keyboard.press("Enter");
    await page.locator(".ai-confirm[data-state='open']").waitFor({ timeout: 8000 });
    await idle(page);
    await page.locator("#settings-btn").click();
    await page.locator(".lab-section input").click();
    await page.waitForTimeout(200);
    await page.locator(".lab-section input").click();
    await page.keyboard.press("Escape");
    await page.locator("#ai-chat-btn").waitFor();
    await page.locator("#ai-chat-btn").click();
    await page.locator(".ai-panel .ai-input").waitFor();
    await page.waitForTimeout(300);
    const open = page.locator(".ai-confirm[data-state='open'] .btn-primary");
    if (await open.count()) {
      await open.first().click();
      await page.waitForTimeout(500);
    }
    const pool = await poolTags(page);
    ok("8 關掉再打開：舊確認卡失效、沒有換成黑髮", pool.includes("red hair") && !pool.includes("black hair") && (await page.locator(".ai-confirm[data-state='open']").count()) === 0, pool.join(","));
    await shot(page, "confirm-stale");
    const kind = await page.locator(".ai-state").getAttribute("data-kind");
    ok("8 關掉再打開：狀態列不再寫等待確認", kind !== "confirm", kind);

    // 15. 純回答在收起時到了：亮「有新回覆」
    await page.locator(".ai-input").fill("慢一點");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.locator(".ai-panel button[aria-label='收起聊天室']").click();
    await page.waitForTimeout(2200);
    const seal = await page.locator("#ai-chat-btn").evaluate((b) => `${b.dataset.state}|${b.getAttribute("aria-label")}`);
    ok("15 收起時回答到了：印章亮綠點、讀屏說有新回覆", /^done\|.*有新回覆/.test(seal), seal);
    await page.locator("#ai-chat-btn").click();
    await page.waitForTimeout(200);
    ok("15 打開就淡掉", !(await page.locator("#ai-chat-btn").getAttribute("data-state")));
    await context.close();
  } catch (err) {
    ok("沒有例外", false, err.stack);
  }

  // ---------- 12. 回覆到一半按新對話 ----------
  try {
    const { context, page } = await newPage();
    await page.locator(".ai-input").fill("慢一點");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    await page.locator(".ai-ask").first().click();
    await page.locator(".ai-input").fill("還沒送的草稿");
    await page.locator(".ai-panel button[aria-label='新對話']").click();
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => ({
      running: document.querySelector(".ai-send").dataset.running,
      kind: document.querySelector(".ai-state").dataset.kind,
      refs: document.querySelectorAll(".ai-refs .ai-ref").length,
      draft: document.querySelector(".ai-input").value,
    }));
    ok("12 新對話：送出鈕回到箭頭、狀態列歸零", s.running === "false" && s.kind === "idle", JSON.stringify(s));
    ok("12 新對話：引用、草稿清掉", s.refs === 0 && s.draft === "", JSON.stringify(s));
    await page.waitForTimeout(1600);
    await context.close();
  } catch (err) {
    ok("沒有例外", false, err.stack);
  }

  // ---------- 14. 遠端、主機沒開放 ----------
  try {
    remote = true;
    const { context, page } = await newPage();
    await page.waitForTimeout(300);
    const before = chats.length;
    await page.locator(".ai-input").fill("你好");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    ok("14 遠端沒開放：不送出、草稿留著", chats.length === before && (await page.locator(".ai-input").inputValue()) === "你好");
    const note = (await page.locator(".ai-note").last().textContent().catch(() => "")) || "";
    ok("14 遠端沒開放：說要到主機哪裡打開", /讓手機、別台裝置也能用聊天室/.test(note), note);
    ok("14 遠端沒開放：連線列不寫已選的 CLI", /主機尚未允許/.test((await page.locator(".ai-conn").textContent()) || ""), await page.locator(".ai-conn").textContent());
    await shot(page, "remote-note");
    remote = false;
    await page.locator(".ai-note-act").click().catch(() => {});
    await page.waitForTimeout(500);
    ok("14 重新檢查：通了就改口", /可以了/.test((await page.locator(".ai-note").last().textContent().catch(() => "")) || ""));
    await context.close();
    remote = false;
  } catch (err) {
    ok("沒有例外", false, err.stack);
  }

  // ---------- 16、18. 看變更指到自己那一輪；長對話不重建；連續查詢收起來；串流排程 ----------
  try {
    const { context, page } = await newPage();
    const ids = () => page.evaluate(() => [...document.querySelectorAll("#wall .shot")].map((n) => n.dataset.id));
    const before = await ids();
    await send(page, "這次抽兩張");
    const first = (await ids()).filter((x) => !before.includes(x));
    await send(page, "這次抽兩張");
    await page.locator(".ai-msg.ai-bot").first().locator(".ai-step-look").first().click();
    await page.waitForTimeout(600);
    const hit = await page.evaluate((first) => {
      const h = document.querySelector(".ai-halo");
      if (!h || h.hidden) return "沒有光框";
      const r = h.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const under = [...document.querySelectorAll("#wall .shot")].find((s) => {
        const b = s.getBoundingClientRect();
        return Math.abs(b.left + b.width / 2 - cx) < 4 && Math.abs(b.top + b.height / 2 - cy) < 4;
      });
      return under ? under.dataset.id : "光框底下沒有成品";
    }, first);
    ok("16 第一輪的看變更：光框落在第一輪自己的成品", first.includes(hit), `${hit} / 第一輪 ${first.join(",")}`);

    // 18. 送一句：舊訊息不被拆掉重建
    await page.evaluate(() => {
      window.__removed = 0;
      window.__obs = new MutationObserver((ms) => {
        for (const m of ms) for (const n of m.removedNodes) if (n.classList?.contains("ai-msg")) window.__removed++;
      });
      window.__obs.observe(document.querySelector(".ai-log"), { childList: true });
    });
    await send(page, "你好");
    const removed = await page.evaluate(() => (window.__obs.disconnect(), window.__removed));
    // 正在回的那一則會整則換掉幾次（步驟換狀態），舊的四則不該被拆
    ok("18 送一句：舊訊息沒被整串重建", removed <= 3, `拆掉 ${removed} 則`);

    await send(page, "查很多次");
    const fold = (await page.locator(".ai-msg.ai-bot").last().locator(".ai-fold summary").textContent().catch(() => "")) || "";
    ok("18 連續六次成功查詢：收成一行「已查詢 6 步」", /已查詢 6 步/.test(fold), fold);
    await shot(page, "fold-closed");
    await page.locator(".ai-msg.ai-bot").last().locator(".ai-fold summary").click().catch(() => {});
    await shot(page, "fold-open");

    await page.evaluate(() => {
      window.__raf = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (fn) => (window.__raf++, raf(fn));
    });
    await send(page, "長回答");
    const raf = await page.evaluate(() => window.__raf);
    ok("18 串流 120 個字（一次到）：不會每個字排一次影格", raf < 40, `排了 ${raf} 次`);
    await context.close();
  } catch (err) {
    ok("沒有例外", false, err.stack);
  }

  // ---------- 21. 回得快：系統說明每次一樣、舊回合的工具結果精簡 ----------
  try {
    const { context, page } = await newPage();
    const from = chats.length;
    await send(page, "找很多牌");
    await send(page, "找很多牌");
    await send(page, "找很多牌");
    const sent = chats.slice(from);
    ok("21 系統說明每一步都一樣（沒有時間戳，快取接得上）", sent.length >= 6 && sent.every((b) => b.system === sent[0].system) && !/現在：/.test(sent[0].system), `${sent.length} 次請求`);
    const last = sent[sent.length - 1].messages;
    const users = last.map((m, k) => (m.role === "user" ? k : -1)).filter((k) => k >= 0);
    const head = last[users[users.length - 1]].content;
    ok("21 時間寫在這一則的［目前工作台］", /^［目前工作台］現在 \d{4}-\d\d-\d\d \d\d:\d\d｜/.test(head), head.slice(0, 60));
    const old = last.slice(0, users[users.length - 2]).filter((m) => m.role === "tool");
    const recent = last.slice(users[users.length - 2]).filter((m) => m.role === "tool");
    ok(
      "21 最早那一輪的工具結果精簡過，最近兩輪原樣",
      old.length === 3 && old.every((m) => JSON.parse(m.content).trimmed === true) && recent.length >= 6 && recent.every((m) => !JSON.parse(m.content).trimmed),
      `舊 ${old.length} 則、近 ${recent.length} 則；長 ${old[0]?.content.length}：${old[0]?.content.slice(0, 300)}`
    );
    ok("21 舊的工作台摘要只留一句", /^［當時的工作台摘要已省略/.test(last[users[0]].content), last[users[0]].content.slice(0, 40));
    // 同一則舊訊息每次縮出來都一樣：第三輪最後一次請求的開頭，要等於下一句話送出時的開頭（快取前綴不變）
    await send(page, "找很多牌");
    const next = chats[chats.length - 1].messages;
    const prefix = next.slice(0, users[users.length - 2]);
    ok("21 精簡結果穩定（下一句話時前面那段一字不差）", JSON.stringify(prefix) === JSON.stringify(last.slice(0, users[users.length - 2])));
    const full = await page.evaluate(() => JSON.parse(localStorage.getItem("mochi.assistant.chat.v1") || sessionStorage.getItem("mochi.assistant.chat.v1") || "null"));
    // 看精簡的記號（"trimmed":true、「當時的工作台摘要已省略」），不是字串 trimmed：找到的牌裡有 fur-trimmed 這種 tag。
    ok("21 存起來的對話不動（只動送出去的）", !full || !["trimmed\\\":true", "trimmed\":true", "當時的工作台摘要已省略"].some((x) => JSON.stringify(full.messages || []).includes(x)));
    await context.close();
  } catch (err) {
    ok("沒有例外", false, err.stack);
  }

  // ---------- 20. 英文 ----------
  try {
    const { context, page } = await newPage({ lang: "en" });
    await page.locator("#lib-q").fill("sunset");
    await page.waitForTimeout(300);
    await page.locator("#library .ai-ask").click();
    await page.waitForTimeout(400);
    const chip = ((await page.locator(".ai-refs .ai-ref span").first().textContent()) || "").trim();
    ok("20 英文：搜尋引用照模板翻、搜尋字原樣", chip === "Library search “sunset”", chip);
    const label = await page.locator(".ai-send").getAttribute("aria-label");
    ok("20 英文：送出鈕讀屏是 Send", label === "Send", label);
    await context.close();
  } catch (err) {
    ok("沒有例外", false, err.stack);
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
