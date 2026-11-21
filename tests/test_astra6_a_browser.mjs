// 第六輪檢查（2026-11-20，GPT 6.2 Astra 找；Sol 的那份分給 Claude 和 Grok）Claude 這一份裡畫面看得到的幾項：
//   S. AI 助手的推薦卡按「加入」→ 確認選「保留原狀」：卡片回到可以按（以前停在「已加入」按不了）
//   T. 兩個分頁：一頁在設定裡關掉助手，另一頁的印章、「問助理」也拿掉（關著時頁面跟原本一樣）
//   U. 生圖接回時碰到一次 503：再接一次，不算印壞
//   V. 撤下一張、馬上按復原：伺服器照順序收到「撤下」「復原」，日誌最後不是撤下
// 2026-11-21 走查補的（ComfyUI 沒開時）：
//   W. 成品牆的圖暫時讀不到：不露破圖和替代文字，ComfyUI 回來自己讀到
//   X. 作品冊日誌的縮圖：寫「暫時讀不到」，回來自己讀到
//   Y. 卡冊牌詳情：用它做過的圖整區說一次「暫時讀不到」、回來自己讀到；加入日、戰績晚到也補上
// （兩個卡冊分頁的交接便條：test_prerender_handoff.mjs；偏好卡牌兩台同時第一次同步：test_fav_chars_sync.mjs；
//   Anthropic 空白回覆：test_assistant.py；MCP：test_mochi_mcp.mjs）
//
//   node scripts/test_astra6_a_browser.mjs
//   BASELINE=HEAD node scripts/test_astra6_a_browser.mjs   # 拿舊版 assistant.js、gen.js、synced-list.js、album-log.js、book.js、gone.js 對照（應該紅）
//   ONLY=S node scripts/test_astra6_a_browser.mjs          # 只跑 S
//
// 假伺服器：/api/gen 是自己的假 SSE，不連 ComfyUI；不寫 data/；不叫真的模型。
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
  for (const f of ["assistant.js", "gen.js", "synced-list.js", "album-log.js", "book.js", "gone.js"]) baseline[f] = execFileSync("git", ["show", `${process.env.BASELINE}:${front}/${f}`], { cwd: root, maxBuffer: 2 ** 25 });
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

try {
  // S. 推薦卡按「加入」→ 確認選「保留原狀」：按鈕回到可以按
  await step("S. 保留原狀之後推薦卡可以再按", async () => {
    const c = await context({
      init: () => {
        if (location.protocol !== "http:") return;
        localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled: true, open: true }));
        sessionStorage.setItem("mochi.tab.pool.v1", JSON.stringify({ tags: ["red hair"], weights: {} }));
      },
    });
    state.controllers["/api/assistant/status"] = (q, r) => json(r, { ok: true, configured: true, connection: { kind: "cli", provider: "codex" }, local: true, allowRemote: false });
    let calls = 0;
    state.controllers["/api/assistant/chat"] = (q, r) => {
      calls++;
      const data = calls === 1
        ? [["tool_calls", { calls: [{ id: "s1", name: "suggest_cards", args: { cards: [{ tag: "blue hair", why: "換髮色" }] } }] }], ["done", { reason: "tool_calls" }]]
        : [["text", { delta: "好了。" }], ["done", { reason: "end" }]];
      r.writeHead(200, { "Content-Type": "text/event-stream" }).end(data.map(([e, x]) => "event: " + e + "\ndata: " + JSON.stringify(x) + "\n\n").join(""));
      return true;
    };
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator('#pool-well [data-tag="red hair"]').waitFor();
    await p.locator(".ai-input").fill("推薦髮色");
    await p.locator(".ai-input").press("Enter");
    await p.locator(".ai-sugg-add").click();
    await p.locator(".ai-confirm-actions").getByRole("button", { name: "保留原狀" }).click();
    await sleep(600);
    const after = { label: await p.locator(".ai-sugg-add").innerText(), disabled: await p.locator(".ai-sugg-add").isDisabled(), state: await p.locator(".ai-confirm").getAttribute("data-state") };
    ok("S. 保留原狀：推薦卡不是「已加入」、可以再按", after.state === "kept" && !after.disabled && !/已加入/.test(after.label), JSON.stringify(after));
    // 重新整理：已經結案的卡維持可以按（存檔裡沒有留下「已加入」）
    await p.reload();
    await p.locator(".ai-sugg-add").waitFor();
    ok("S. 重新整理之後也可以按", !(await p.locator(".ai-sugg-add").isDisabled()), await p.locator(".ai-sugg-add").innerText());
    delete state.controllers["/api/assistant/status"];
    delete state.controllers["/api/assistant/chat"];
    await c.close();
  });

  // T. 兩個分頁：一頁在設定裡關掉助手，另一頁的印章、「問助理」也拿掉
  await step("T. 別的分頁關掉助手，這一頁跟著收", async () => {
    const c = await context({
      init: () => {
        if (location.protocol === "http:" && !localStorage.getItem("mochi.assistant.v1")) localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled: true, open: false }));
      },
    });
    const pages = [await c.newPage(), await c.newPage()];
    for (const p of pages) {
      await go(p, origin + "/");
      await p.locator("#ai-chat-btn").waitFor();
    }
    await pages[0].locator("#settings-btn").click();
    await pages[0].locator(".lab-switch input").uncheck();
    await sleep(900);
    const second = await pages[1].evaluate(() => ({ btn: !!document.getElementById("ai-chat-btn"), ask: document.querySelectorAll(".ai-ask").length, flag: document.documentElement.dataset.ai || "" }));
    ok("T. 另一頁的印章、問助理都拿掉了", !second.btn && !second.ask && !second.flag, JSON.stringify(second));
    // 再打開：另一頁也放回來
    await pages[0].locator(".lab-switch input").check();
    await sleep(900);
    ok("T. 再打開時另一頁也放回印章", await pages[1].locator("#ai-chat-btn").count() === 1);
    await c.close();
  });

  // U. 接回時碰到一次 503：再接一次，不算印壞
  await step("U. 接回碰到 503 會再接", async () => {
    const c = await context();
    let asks = 0;
    state.controllers["/api/gen"] = (q, r) => {
      r.writeHead(200, { "Content-Type": "text/event-stream", "X-Gen-Job": "knownjob" }).end('event: progress\ndata: {"value":1,"max":2}\n\n');
      return true;
    };
    state.controllers["/api/gen/attach"] = (q, r) => {
      asks++;
      if (asks === 1) return json(r, { error: "暫時無法連線" }, 503);
      r.writeHead(200, { "Content-Type": "text/event-stream" }).end("event: done\ndata: " + JSON.stringify({ image: "data:image/png;base64," + PNG, seed: 1, width: 832, height: 1216 }) + "\n\n");
      return true;
    };
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator(".quick-starters [data-starter]").first().click();
    await p.locator("#go-bar .btn-primary").click();
    const status = await p
      .waitForFunction(() => ["done", "failed"].includes(document.querySelector(".shot")?.dataset.status) && document.querySelector(".shot").dataset.status, null, { timeout: 12000 })
      .then((h) => h.jsonValue())
      .catch(() => "timeout");
    ok("U. 503 之後接回、印好", status === "done" && asks === 2, `${status}，接了 ${asks} 次`);
    delete state.controllers["/api/gen"];
    delete state.controllers["/api/gen/attach"];
    await c.close();
  });

  // V. 撤下一張、馬上按復原：日誌最後不是「撤下」
  await step("V. 撤下後馬上復原，日誌照順序", async () => {
    const c = await context();
    const commits = [];
    state.controllers["/api/genlog/mark"] = async (q, r, b) => {
      const obj = JSON.parse(b);
      if (obj.mark) await sleep(1200);
      commits.push(obj.mark);
      return json(r, { ok: true });
    };
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator(".quick-starters [data-starter]").first().click();
    await p.locator("#go-bar .btn-primary").click();
    const n = p.locator(".shot[data-status=done]").first();
    await n.waitFor();
    await n.hover();
    await n.locator(".shot-remove").click();
    await p.locator("#toast").getByRole("button", { name: /復原/ }).click();
    await sleep(2200);
    ok("V. 伺服器最後收到的是復原（null）", commits.length === 2 && commits[0] === "discard" && commits[1] === null, JSON.stringify(commits));
    ok("V. 那張還在牆上", (await p.locator(".shot[data-status=done]").count()) === 1);
    delete state.controllers["/api/genlog/mark"];
    await c.close();
  });

  // ComfyUI 沒開：/api/image 回 502，back 打開之後才給圖。回到分頁（visibilitychange）時 img-wait.js 先拿一張試。
  let comfyBack = false;
  const imageGate = (q, r) => {
    if (!comfyBack) return json(r, { ok: false, error: "ComfyUI 連不上" }, 502);
    r.writeHead(200, { "Content-Type": "image/png" }).end(Buffer.from(PNG, "base64"));
    return true;
  };
  const comfyReturns = async (page) => {
    comfyBack = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  };

  await step("W. 成品牆暫時讀不到：不露破圖，回來自己讀", async () => {
    comfyBack = false;
    const c = await context({
      init: () => {
        if (location.protocol !== "http:" || localStorage.getItem("mochi.shots.v1")) return;
        localStorage.setItem("mochi.shots.v1", JSON.stringify([{ id: "w1", status: "done", image: "/api/image?filename=w1.png&type=output", positive: "red hair", mine: ["red hair"], drawn: [], width: 832, height: 1216, seed: 1, rating: "general", at: new Date().toISOString() }]));
      },
    });
    state.controllers["/api/image"] = imageGate;
    const p = await c.newPage();
    await go(p, origin + "/");
    await p.locator("#wall .shot").first().scrollIntoViewIfNeeded();
    await p.waitForFunction(() => document.querySelector("#wall .shot img.img-wait"), null, { timeout: 10000 }).catch(() => {});
    const waiting = await p.evaluate(() => {
      const i = document.querySelector("#wall .shot img:not(.shot-under)");
      return { wait: !!i?.classList.contains("img-wait"), vis: i ? getComputedStyle(i).visibility : "" };
    });
    ok("W. 讀不到時圖藏起來，不露破圖和替代文字", waiting.wait && waiting.vis === "hidden", JSON.stringify(waiting));
    await comfyReturns(p);
    const loaded = await p
      .waitForFunction(() => {
        const i = document.querySelector("#wall .shot img:not(.shot-under)");
        return i && i.naturalWidth > 0 && !i.classList.contains("img-wait");
      }, null, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    ok("W. ComfyUI 回來就自己讀到", loaded);
    delete state.controllers["/api/image"];
    await c.close();
  });

  await step("X. 日誌縮圖暫時讀不到：寫出來，回來自己讀", async () => {
    comfyBack = false;
    const c = await context();
    state.controllers["/api/image"] = imageGate;
    state.controllers["/api/genlog"] = (q, r) =>
      json(r, { ok: true, more: false, total: 1, items: [{ id: "g1", at: Date.now(), ok: true, image: "/api/image?filename=g1.png&type=output", positive: "red hair", seed: 1, width: 832, height: 1216, rating: "general", origin: "mochi", ckpt: "a.safetensors" }] });
    const p = await c.newPage();
    await go(p, origin + "/album.html?tab=log");
    const shown = await p.locator(".log-thumb.is-wait").first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    const text = shown ? await p.locator(".log-thumb.is-wait").first().innerText() : "";
    ok("X. 縮圖寫「暫時讀不到」、不露破圖", shown && text.includes("暫時讀不到"), text);
    await comfyReturns(p);
    const loaded = await p
      .waitForFunction(() => {
        const box = document.querySelector(".log-thumb");
        const i = box?.querySelector("img");
        return i && i.naturalWidth > 0 && !box.classList.contains("is-wait");
      }, null, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    ok("X. ComfyUI 回來縮圖自己出現", loaded);
    delete state.controllers["/api/image"];
    delete state.controllers["/api/genlog"];
    await c.close();
  });

  await step("Y. 卡冊牌詳情：圖、加入日、戰績晚到都補上", async () => {
    comfyBack = false;
    const c = await context();
    state.controllers["/api/image"] = imageGate;
    state.slowStatic["tag_dates.json"] = 2500;
    let statsAsked = 0;
    state.controllers["/api/genlog/stats"] = (q, r) => {
      statsAsked++;
      if (statsAsked === 1) return json(r, { ok: false, error: "忙" }, 503);
      return json(r, { ok: true, cards: { "red hair": [5, 1, 0] }, total: 5, fav: 1, discard: 0, since: 1 });
    };
    state.controllers["/api/genlog/bytag"] = (q, r) =>
      json(r, { ok: true, total: 1, items: [{ id: "b1", at: Date.now(), ok: true, image: "/api/image?filename=b1.png&type=output", width: 832, height: 1216, rating: "general", origin: "mochi" }] });
    const p = await c.newPage();
    await go(p, origin + "/book.html#card=red%20hair");
    await p.locator(".book-stats").waitFor({ timeout: 20000 });
    const dated = await p
      .waitForFunction(() => /\d{4}-\d{2}-\d{2}/.test(document.querySelector("dd[data-added-of], .book-stats dd:nth-of-type(5)")?.textContent || ""), null, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    ok("Y. 加入日晚到：詳情裡那一行補上日期", dated, await p.evaluate(() => [...document.querySelectorAll(".book-stats dd")].map((d) => d.textContent).join(" | ")));
    const war = await p
      .waitForFunction(() => {
        const t = [...document.querySelectorAll(".book-stats dd")].map((d) => d.textContent).join(" ");
        return /印好 5/.test(t) && !/讀不到出圖日誌/.test(t);
      }, null, { timeout: 9000 })
      .then(() => true)
      .catch(() => false);
    ok("Y. 戰績第一次讀不到：過幾秒再問、補上", war, `問了 ${statsAsked} 次`);
    const waitNote = await p.locator(".book-works-wait").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    ok("Y. 圖讀不到時整區說一次、格子標成等候", waitNote && (await p.locator(".book-work.is-wait").count()) === 1);
    await comfyReturns(p);
    const back = await p
      .waitForFunction(() => {
        const i = document.querySelector(".book-work img");
        return i && i.naturalWidth > 0 && !document.querySelector(".book-work.is-wait") && !document.querySelector(".book-works-wait:not([hidden])");
      }, null, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    ok("Y. ComfyUI 回來圖自己出現、說明收起", back);
    delete state.controllers["/api/image"];
    delete state.controllers["/api/genlog/stats"];
    delete state.controllers["/api/genlog/bytag"];
    delete state.slowStatic["tag_dates.json"];
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
