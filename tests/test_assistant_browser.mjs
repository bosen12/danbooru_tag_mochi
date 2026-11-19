// 墨池 AI 助手（實驗功能）的瀏覽器測試：真的 web6 頁面、真的工具層（assistant-tools.js），
// 模型換成照劇本回工具呼叫的假伺服器。絕不連 ComfyUI、不叫真的 CLI 或 API。
//
//   node scripts/test_web6_assistant_browser.mjs
//
// 驗的事：
//   1. 實驗功能關著：頁面上沒有任何助手的鈕、不打 /api/assistant（跟原本一樣）。
//   2. 從頂欄「設定」打開實驗功能：多一顆印章、字盒和合成池多「問助理」。
//   3. 交代一句話：找牌、放牌、改「一次」都真的生效，步驟明細照順序、有「看變更」。
//   4. 會擠掉已釘的牌：先問，按「套用」才換。
//   5. 「這次抽兩張」：成品牆多兩組，畫面上的「一次」不動。
//   6. 再關掉：鈕、問助理、聊天室都拿掉。
//   7. 設定裡的聲音開關、頂欄的 Comfy 燈號。
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

// ---------- 假模型的劇本：看這一輪最後那句使用者的話、這輪已經收到幾個工具結果 ----------
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
  const convo = msgs.map((m) => (m.role === "user" ? String(m.content) : "")).join("\n");
  // 按了確認卡之後接著做（decide → hops）：最後一句是「［使用者按了…］」，不是新的交代
  if (/^［使用者/.test(said) && !/換紅髮再抽一張/.test(convo)) return end("好。");
  if (/海邊/.test(said)) {
    if (tools === 0) return call({ id: "c1", name: "get_workspace", args: {} }, { id: "c2", name: "find_cards", args: { query: "海邊" } });
    if (tools === 2) return call({ id: "c3", name: "change_pool", args: { add: ["beach", "sunset"] } }, { id: "c4", name: "set_draw_count", args: { n: 4 } });
    return end("加入海邊、日落；一次 1 → 4。");
  }
  // 排一組：助手直接寫好提示詞貼進來（paste_prompt）；詞庫沒有的字，下一步從字盒找到的候選挑一張
  if (/排一組/.test(said)) {
    if (tools === 0) return call({ id: "p1", name: "paste_prompt", args: { prompt: "masterpiece, (smile:1.2), straw_hat, glowing_sea" } });
    if (tools === 1) {
      const r = JSON.parse(msgs.at(-1).content);
      const pick = r.pasted?.unknown?.[0]?.candidates?.[0]?.tag;
      if (pick) return call({ id: "p2", name: "change_pool", args: { add: [pick] } });
    }
    return end("排進微笑、草帽；字盒找到相近的，加進去了。");
  }
  // 停在確認卡：同一批後面的抽牌不能先做；按了套用之後才接著抽
  if (/換紅髮再抽一張/.test(said)) {
    if (tools === 0) return call({ id: "c1", name: "paste_prompt", args: { prompt: "red hair" } }, { id: "c2", name: "draw_cards", args: { n: 1 } });
    return end("要換紅髮會擠掉黑髮，等你確認。");
  }
  if (/按了「套用」/.test(said) && /換紅髮再抽一張/.test(convo)) return tools === 0 ? call({ id: "c2", name: "draw_cards", args: { n: 1 } }) : end("換好紅髮，抽了一張。");
  // 連線中途斷了（沒有 done）
  // 40 張上限：拿掉帽子、加草帽（草帽會帶回帽子）
  if (/拿掉帽子加草帽/.test(said)) return tools === 0 ? call({ id: "x1", name: "change_pool", args: { remove: ["hat"], add: ["straw hat"] } }) : end("好。");
  // 話＋寫入一起回、寫入成功：不再多問一輪
  if (/一次改成三張/.test(said)) return sse([["text", { delta: "一次 → 3。" }], ["tool_calls", { calls: [{ id: "n1", name: "set_draw_count", args: { n: 3 } }] }], ["done", { reason: "tool_calls" }]]);
  if (/斷線測試/.test(said)) return sse([["text", { delta: "這是半截" }]]);
  // 長回答：一個字一個字串流
  if (/長回答/.test(said)) return sse([...Array.from({ length: 120 }, (_, k) => ["text", { delta: k % 10 === 9 ? "。\n" : "字" }]), ["done", { reason: "end" }]]);
  // 慢的回答：中途按新對話
  if (/慢一點/.test(said)) return new Promise((r) => setTimeout(() => r(end("慢慢回來了")), 1500));
  if (/抽兩張/.test(said)) return tools === 0 ? call({ id: "d1", name: "draw_cards", args: { n: 2 } }) : end("這輪抽到 2 組。");
  if (/黑髮/.test(said)) {
    if (tools === 0) return call({ id: "m1", name: "change_pool", args: { add: ["red hair"] } });
    if (tools === 1) return call({ id: "m2", name: "change_pool", args: { add: ["black hair"] } });
    return end("放黑髮會擠掉紅髮，要換嗎？");
  }
  return end("合成池是空的。");
}

const assistantHits = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (v, status = 200) => (res.writeHead(status, { "Content-Type": "application/json" }), res.end(JSON.stringify(v)));
  if (url.pathname.startsWith("/api/assistant/")) {
    assistantHits.push(url.pathname);
    const a = url.pathname.slice("/api/assistant/".length);
    if (a === "status") return json({ ok: true, configured: true, connection: { kind: "cli", provider: "codex", model: null }, allowRemote: false, local: true });
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

async function newPage(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  await context.route(/\/api\/(?:gen|interrupt)(?:\?|$)/, (r) => r.abort());
  await context.addInitScript(() => {
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.language.v1", "zh-Hant");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
const poolTags = (page) => page.evaluate(() => [...document.querySelectorAll("#pool-well [data-tag]")].map((n) => n.dataset.tag));
async function send(page, text) {
  await page.locator(".ai-input").fill(text);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".ai-send")?.dataset.running === "true", null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector(".ai-send")?.dataset.running !== "true");
  await page.waitForTimeout(200);
}

try {
  const { context, page } = await newPage({ width: 1440, height: 900 });
  await page.goto(origin + "/index.html");
  await page.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0);
  await page.waitForTimeout(800);

  // 1. 關著：跟原本一樣
  ok("關著：頂欄沒有助手的鈕", (await page.locator("#ai-chat-btn").count()) === 0);
  ok("關著：字盒、合成池沒有「問助理」", (await page.locator(".ai-ask").count()) === 0);
  ok("關著：頁面上沒有聊天室、光暈", (await page.locator(".ai-panel, .ai-halo").count()) === 0);
  ok("關著：不打 /api/assistant", assistantHits.length === 0, assistantHits.join(" "));
  ok("關著：<html> 沒有 data-ai", !(await page.evaluate(() => "ai" in document.documentElement.dataset)));

  // 7. 頂欄：齒輪「設定」取代月亮和喇叭；Comfy 燈號寫字＋綠點
  ok("頂欄：有「設定」齒輪、沒有月亮那顆", (await page.locator("#settings-btn").count()) === 1 && (await page.locator("#saver-btn").count()) === 0);
  ok("頂欄：喇叭收起來（節點留著給開關程式用）", await page.locator("#sound-btn").evaluate((n) => n.hidden && !n.getClientRects().length));
  ok("頂欄：Comfy 燈號寫「Comfy」、連上是綠點", await page.locator("#ping").evaluate((n) => n.querySelector(".ping-name")?.textContent === "Comfy" && n.dataset.ok === "1"));

  // 設定：聲音開關按的是原本那顆
  await page.locator("#settings-btn").click();
  await page.locator(".settings-sheet").waitFor();
  const before = await page.locator("#sound-btn").getAttribute("aria-pressed");
  await page.locator(".settings-section input").click();
  ok("設定：聲音開關切得動（跟原本的開關同一份）", (await page.locator("#sound-btn").getAttribute("aria-pressed")) !== before);
  await page.locator(".settings-section input").click();

  // 2. 打開實驗功能
  ok("設定：有「實驗功能」一區", (await page.locator(".lab-section").count()) === 1);
  await page.locator(".lab-section input").click();
  await page.keyboard.press("Escape");
  await page.locator("#ai-chat-btn").waitFor();
  ok("打開：頂欄多一顆印章", (await page.locator("#ai-chat-btn").count()) === 1);
  ok("打開：字盒、合成池各一顆「問助理」", (await page.locator(".ai-ask").count()) === 2);
  ok("打開：頂欄照樣一行", await page.evaluate(() => Math.abs(document.querySelector(".mast-primary").getBoundingClientRect().top - document.querySelector(".mast-controls").getBoundingClientRect().top) < 10));

  // 3. 交代一句話
  await page.locator("#ai-chat-btn").click();
  await page.locator(".ai-panel .ai-input").waitFor();
  await send(page, "幫我找海邊的牌放進去，一次改成 4");
  const tags = await poolTags(page);
  ok("放牌：海邊、日落進了合成池（附帶的也跟著）", tags.includes("beach") && tags.includes("sunset"), tags.join(","));
  ok("改一次：主按鈕 ×4", (await page.locator("#go-bar .btn-primary .count").textContent()).includes("4"));
  const steps = await page.locator(".ai-step").evaluateAll((ns) => ns.map((n) => n.dataset.status));
  ok("明細：四步都做完", steps.length === 4 && steps.every((s) => s === "done"), steps.join(","));
  ok("明細：寫入的步驟有「看變更」和「復原」", (await page.locator(".ai-step-look").count()) >= 2 && (await page.locator(".ai-step-undo").count()) >= 2);
  const sent = chats.at(-1);
  ok("送給模型：系統提示詞、工具清單、工作台摘要都在", !!sent.system && sent.tools.some((t) => t.name === "change_pool") && /［目前工作台］/.test(sent.messages.find((m) => m.role === "user").content));

  // 4. 會擠掉已釘的牌：先問
  await send(page, "放紅髮，然後改成黑髮");
  ok("擠牌：先停下來問", (await page.locator(".ai-confirm[data-state='open']").count()) === 1);
  ok("擠牌：還沒按之前紅髮還在", (await poolTags(page)).includes("red hair"));
  await page.locator(".ai-confirm .btn-primary").click();
  await page.waitForTimeout(400);
  const after = await poolTags(page);
  ok("擠牌：按「套用」才換成黑髮", after.includes("black hair") && !after.includes("red hair"), after.join(","));

  // 5. 這次抽兩張
  const shotsBefore = await page.locator("#wall .shot").count();
  await send(page, "這次抽兩張");
  ok("抽一輪：成品牆多兩組", (await page.locator("#wall .shot").count()) === shotsBefore + 2);
  ok("抽一輪：畫面上的「一次」還是 4", (await page.locator("#go-bar .btn-primary .count").textContent()).includes("4"));

  // 5b. 助手設定：每個 CLI 有推理強度選單，選了會一起存
  await page.locator(".ai-panel button[aria-label='AI 助手設定']").click();
  await page.locator(".ai-cli .ai-effort").waitFor();
  const opts = await page.locator(".ai-cli .ai-effort option").evaluateAll((ns) => ns.map((n) => n.value));
  ok("設定：Codex 的推理強度選單（預設＋四級）", opts.join(",") === ",low,medium,high,xhigh", opts.join(","));
  await page.locator(".ai-cli .btn-small").click();
  await page.locator(".ai-cli .ai-effort").selectOption("high");
  ok("設定：選了強度，「選了」那行寫出來", /Codex CLI · .+ · high/.test(await page.locator(".ai-test-line").textContent()));
  const saveReq = page.waitForRequest((r) => r.url().endsWith("/api/assistant/config") && r.method() === "POST");
  await page.getByRole("button", { name: "儲存", exact: true }).click();
  const saved = JSON.parse((await saveReq).postData() || "{}");
  ok("設定：存檔帶 effort", saved.connection?.effort === "high", JSON.stringify(saved));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 5c. 排一組：一次排進去，沒有的字到字盒找、挑一張；字盒的搜尋最後收回原樣
  await page.locator(".ai-input").waitFor();
  await page.evaluate(() => document.querySelector(".ai-panel").hidden || 0);
  if (!(await page.locator(".ai-panel").isVisible())) await page.locator("#ai-chat-btn").click();
  const pBefore = await poolTags(page);
  await send(page, "排一組微笑戴草帽的");
  const pTags = await poolTags(page);
  ok("排一組：認得的字一次排進合成池（微笑、草帽）", pTags.includes("smile") && pTags.includes("straw hat") && pBefore.every((t) => pTags.includes(t)), pTags.join(","));
  const sorts = await page.locator(".ai-sort").evaluateAll((ns) => ns.map((n) => `${n.dataset.kind}/${n.dataset.state}`));
  ok("排一組：排字盤照順序、畫質詞淡掉、牌打勾、沒有的去字盒", sorts.join(" ") === "muted/ card/set card/set unknown/look", sorts.join(" "));
  const pSteps = await page.locator(".ai-step").evaluateAll((ns) => ns.slice(-2).map((n) => n.dataset.status));
  ok("排一組：兩步（排字、從候選挑一張）都做完", pSteps.join(",") === "done,done", pSteps.join(","));
  const picked = chats.flatMap((c) => c.messages || []).filter((m) => m.role === "assistant").flatMap((m) => m.toolCalls || []).find((c) => c.id === "p2")?.args?.add?.[0];
  ok("排一組：從字盒候選挑的那張也進了合成池", !!picked && pTags.includes(picked), `${picked} / ${pTags.join(",")}`);
  await page.waitForFunction(() => document.getElementById("lib-q").value === "", null, { timeout: 8000 }).catch(() => {});
  ok("排一組：字盒的搜尋收回原樣", (await page.locator("#lib-q").inputValue()) === "");
  const pSent = chats.at(-1);
  ok("送給模型：paste_prompt 在工具清單、系統提示詞叫它先用這支", pSent.tools.some((t) => t.name === "paste_prompt") && /paste_prompt/.test(pSent.system));

  // 5d. 停在確認卡：後面的抽牌先不做，按套用之後才接著抽
  {
    const shots0 = await page.locator("#wall .shot").count();
    await send(page, "換紅髮再抽一張");
    ok("確認：先停下來問", (await page.locator(".ai-confirm[data-state='open']").count()) === 1, await page.locator(".ai-confirm").evaluateAll((ns) => ns.map((n) => n.closest(".ai-msg")?.dataset.id + "/" + n.dataset.state + ":" + n.textContent.slice(0, 30)).join(" | ")));
    ok("確認：同一批後面的抽牌沒有先做", (await page.locator("#wall .shot").count()) === shots0);
    await page.locator(".ai-confirm[data-state='open'] .btn-primary").click();
    await page.waitForFunction((n) => document.querySelectorAll("#wall .shot").length > n, shots0, { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector(".ai-send")?.dataset.running !== "true");
    ok("確認：按套用之後換成紅髮、接著抽了一張", (await poolTags(page)).includes("red hair") && (await page.locator("#wall .shot").count()) === shots0 + 1);
    const resumed = chats.find((c) => (c.messages || []).some((m) => m.role === "tool" && m.name === "draw_cards" && /waiting_confirm/.test(m.content)));
    ok("確認：模型看到的是「等確認、這一步沒做」，接著看到你按了套用", !!resumed && /按了「套用」/.test(resumed.messages.at(-1).content));
  }

  // 5d2. 話跟寫入一起回來：話等做完才出現、排在步驟後面；寫入成功就收，不再多問模型一輪
  {
    const before = chats.length;
    await send(page, "一次改成三張");
    ok("做完就收：只問了模型一次", chats.length === before + 1, `${chats.length - before} 次`);
    const order = await page.locator(".ai-msg.ai-bot").last().evaluate((m) => [...m.querySelectorAll(".ai-steps, .ai-rich")].map((n) => (n.classList.contains("ai-steps") ? "steps" : "text")).join(","));
    ok("做完就收：話排在步驟後面", order === "steps,text", order);
    ok("做完就收：一次真的改成 3", (await page.locator("#go-bar .btn-primary .count").textContent()).includes("3"));
  }

  // 5e. 連線中途斷了：半截的不能當成完整回覆
  await send(page, "斷線測試");
  ok("斷線：寫出「中途斷了」", /中途斷了/.test((await page.locator(".ai-msg.ai-bot").last().locator(".ai-error").textContent().catch(() => "")) || ""));

  // 5f. 串流：只更新正在寫的那一段，不是每個字整則重畫
  {
    await page.evaluate(() => {
      window.__swaps = [];
      window.__obs = new MutationObserver((ms) => {
        for (const m of ms) for (const n of m.removedNodes) if (n.classList?.contains("ai-bot")) window.__swaps.push(n.dataset.id);
      });
      window.__obs.observe(document.querySelector(".ai-log"), { childList: true });
    });
    await send(page, "長回答");
    // 只算正在串流的這一則被整則換掉幾次（開新一輪時整串重畫、換掉舊的那幾則不算）
    const swaps = await page.evaluate(() => {
      window.__obs.disconnect();
      const id = [...document.querySelectorAll(".ai-msg.ai-bot")].at(-1).dataset.id;
      return window.__swaps.filter((x) => x === id).length;
    });
    ok("串流：120 個字只整則重畫幾次", swaps <= 6, `整則換了 ${swaps} 次`);
    ok("串流：字全部到了", ((await page.locator(".ai-msg.ai-bot").last().textContent()) || "").split("字").length - 1 === 108);
  }

  // 5g. 回答到一半按「新對話」：舊的那一輪不能寫進新的對話
  {
    await page.locator(".ai-input").fill("慢一點");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.locator(".ai-panel button[aria-label='新對話']").click();
    await page.waitForTimeout(2200);
    ok("新對話：舊的那一輪沒寫回來", (await page.locator(".ai-msg").count()) === 0 && (await page.locator(".ai-empty").count()) === 1);
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("mochi.assistant.chat.v1") || "{}"));
    ok("新對話：存下來的也是空的", (stored.messages || []).length === 0, JSON.stringify(stored).slice(0, 200));
    await send(page, "我現在有哪些牌");
    const first = chats.at(-1).messages;
    ok("新對話：下一句送出去只有自己一則", first.length === 1 && first[0].role === "user", JSON.stringify(first.map((m) => m.role)));
  }

  // 5h. 助手借著字盒搜尋框找字時，你自己打字：框就是你的，這一輪結束也不收回
  {
    await send(page, "排一組微笑戴草帽的");
    await page.locator("#lib-q").fill("smile");
    await page.waitForTimeout(3200);
    ok("借字盒：你打的字留著", (await page.locator("#lib-q").inputValue()) === "smile");
    await page.locator("#lib-q").fill("");
  }

  // 6. 再關掉
  await page.locator("#settings-btn").click();
  await page.locator(".lab-section input").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  ok("關掉：印章、問助理拿掉", (await page.locator("#ai-chat-btn").count()) === 0 && (await page.locator(".ai-ask").count()) === 0);
  ok("關掉：聊天室收起", await page.evaluate(() => !document.querySelector(".ai-panel") || document.querySelector(".ai-panel").hidden));
  ok("關掉：<html> 沒有 data-ai", !(await page.evaluate(() => "ai" in document.documentElement.dataset)));
  await context.close();

  // 預覽跟真的做同一套順序（先拿掉、再釘，附帶的照算）：滿 40 張時「拿掉帽子、加草帽」會變 41 張，要擋下來
  {
    const { context, page } = await newPage({ width: 1440, height: 900 });
    await page.addInitScript(() => localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled: true, open: true })));
    await page.goto(origin + "/index.html?debug");
    await page.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0 && window.mochi);
    const filled = await page.evaluate(() => {
      const m = window.mochi;
      m.pin("hat");
      const count = () => [...m.pool].filter((t) => !t.startsWith("custom:")).length;
      for (const c of m.lib().cards) {
        if (count() >= 40) break;
        if (c.suit === "chara" || c.tag.startsWith("custom:") || /hat|headwear/.test(c.tag)) continue;
        const before = new Set(m.pool);
        m.pin(c.tag);
        if ([...before].some((t) => !m.pool.has(t)) || count() > 40) {
          for (const t of [...m.pool]) if (!before.has(t)) m.pool.delete(t);
          for (const t of before) m.pool.add(t);
        }
      }
      m.pin("hat");
      return count();
    });
    await page.locator(".ai-input").waitFor();
    await send(page, "拿掉帽子加草帽");
    const after = await page.evaluate(() => ({ n: [...window.mochi.pool].filter((t) => !t.startsWith("custom:")).length, straw: window.mochi.pool.has("straw hat") }));
    ok("40 張上限：拿掉帽子、加草帽（會帶回帽子）擋下來，不會變 41 張", filled === 40 && after.n === 40 && !after.straw, `${filled} → ${JSON.stringify(after)}`);
    await context.close();
  }

  // 手機：聊天室是底部拉上來的面板
  {
    const { context, page } = await newPage({ width: 390, height: 844 }, true);
    await page.addInitScript(() => localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled: true })));
    await page.goto(origin + "/index.html");
    await page.locator("#ai-chat-btn").waitFor();
    await page.locator("#ai-chat-btn").click();
    await page.locator(".ai-panel .ai-input").waitFor();
    const box = await page.locator(".ai-panel").boundingBox();
    ok("手機：面板從底部拉上來、整寬", box && Math.round(box.width) === 390 && Math.round(box.y + box.height) === 844, JSON.stringify(box));
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
