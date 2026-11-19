// Hires 進行中的「停」（2026-11-20 專案主：圖上的停按不到，被擋住；要併進抽並生圖那排）。
//   - Hires 中，成品那列（#wall-busy）寫「Hires 中」、有「停」，按了停掉 Hires；Esc 也停。
//   - 滑鼠停在那張圖上時，圖上的「停」真的按得到（以前下緣那行浮出來壓在上面）。
//
//   node scripts/test_hires_stop_browser.mjs
//   BASELINE=HEAD node scripts/test_hires_stop_browser.mjs   # 拿舊版 web6/app.js、styles.css 對照（應該紅）
//
// 假伺服器：/api/gen 是這支自己的假的（第一張直接印好、Hires 一直停在進度上），不連 ComfyUI。
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
const old = (f) => (process.env.BASELINE ? execFileSync("git", ["show", `${process.env.BASELINE}:${front}/${f}`], { cwd: root, maxBuffer: 2 ** 24 }) : null);
const baseline = { "app.js": old("app.js"), "styles.css": old("styles.css") };

// 1×1 的圖（印好的那張）
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const held = new Set();
const cancels = [];
const bodies = [];
let failNext = false;
let jobSeq = 0;
const sse = (res, job) => res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Gen-Job": job });
const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (v) => (res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(v)));
  if (url.pathname === "/api/gen" && req.method === "POST") {
    let body = "";
    for await (const c of req) body += c;
    const p = JSON.parse(body || "{}");
    bodies.push(p);
    const job = `job${++jobSeq}`;
    sse(res, job);
    if (!p.hires && failNext) {
      failNext = false;
      send(res, "error", { error: "模型讀取失敗" });
      return res.end();
    }
    if (!p.hires) {
      send(res, "done", { image: PNG, seed: p.seed, width: 832, height: 1216 });
      return res.end();
    }
    // Hires：一直停在 5/20，等人按停
    send(res, "progress", { value: 5, max: 20, prompt_id: "p-" + job });
    res._job = job;
    held.add(res);
    const beat = setInterval(() => res.write(": beat\n\n"), 1000);
    res.on("close", () => (clearInterval(beat), held.delete(res)));
    return;
  }
  if (url.pathname === "/api/gen/cancel" || url.pathname === "/api/interrupt") {
    let body = "";
    for await (const c of req) body += c;
    cancels.push(url.pathname + " " + body);
    for (const r of held) {
      send(r, "error", { error: "已取消", code: "cancelled" });
      r.end();
    }
    return json({ ok: true });
  }
  if (url.pathname.startsWith("/api/")) {
    const data = {
      "/api/ping": { ok: true, comfy: true },
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
      "/api/face/status": { ready: true, why: "" },
      "/api/sampling": { ok: true, base: { steps: 28, cfg: 5, sampler_name: "euler", scheduler: "normal" }, hires: { fast: {}, deep: {} } },
    }[url.pathname] || { ok: true, items: [] };
    return json(data);
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  if (baseline[name]) return res.writeHead(200, { "Content-Type": name.endsWith(".css") ? "text/css" : "text/javascript" }), res.end(baseline[name]);
  let file = resolve(root, front, name);
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
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 500)}`);
  if (!cond) failed++;
};
const errors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.language.v1", "zh-Hant");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/index.html?debug");
  await page.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0 && window.mochi);
  await page.evaluate(() => window.mochi.pin(window.mochi.lib().cards.find((c) => c.suit !== "chara").tag));
  await page.click("#go-bar .btn-primary");
  const shot = page.locator('.shot[data-status="done"]').first();
  await shot.waitFor();

  const startHires = async () => {
    await shot.hover();
    await shot.locator(".shot-hires").click();
    await page.locator(".hires-pop .hp-go").click();
    await page.waitForFunction(() => document.querySelector(".hires-veil:not(.is-leaving)"));
    await page.waitForTimeout(400);
  };

  await startHires();
  const wall = await page.evaluate(() => ({ text: document.getElementById("wall-busy")?.textContent || "", stop: !!document.querySelector("#wall-busy .go-stop") }));
  ok("Hires 中：成品那列寫「Hires 中」", wall.text.includes("Hires 中"), wall.text);
  ok("Hires 中：成品那列有「停」", wall.stop);

  // 滑鼠停在圖上：圖上的「停」要是最上面那個元素（按得到）
  await shot.hover();
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => {
    const b = document.querySelector(".hires-veil .hv-act");
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { same: top === b || b.contains(top), top: top?.className || top?.tagName };
  });
  ok("滑鼠停在圖上：圖上的「停」按得到（沒被下緣那行蓋住）", hit.same, hit.top);

  // 按成品那列的「停」：Hires 停掉、伺服器收到取消、那列收起
  const before = cancels.length;
  await page.click("#wall-busy .go-stop");
  await page.waitForFunction(() => !document.querySelector(".hires-veil:not(.is-leaving)"), null, { timeout: 5000 }).catch(() => {});
  const after = await page.evaluate(() => ({ hi: !!document.querySelector(".hires-veil:not(.is-leaving)"), stop: !!document.querySelector("#wall-busy .go-stop") }));
  ok("按成品那列的「停」：Hires 停掉", !after.hi);
  ok("按成品那列的「停」：「停」收起", !after.stop);
  ok("按成品那列的「停」：伺服器收到取消", cancels.length > before, JSON.stringify(cancels));

  // Esc 也停
  await startHires();
  await page.mouse.move(5, 5);
  await page.evaluate(() => document.activeElement?.blur());
  const escState = await page.evaluate(() => ({ peek: document.getElementById("card-peek")?.dataset.show, active: document.activeElement?.className || document.activeElement?.tagName, overlay: [...document.querySelectorAll(".overlay, [role=dialog]")].map((n) => n.className + "|" + n.getAttribute("aria-modal") + "|" + (n.textContent || "").slice(0, 40)), pop: document.querySelector(".hires-pop")?.className }));
  await page.evaluate(() => {
    window.__esc = [];
    addEventListener("keydown", (e) => window.__esc.push("win-cap:" + e.defaultPrevented), true);
    document.addEventListener("keydown", (e) => window.__esc.push("doc-bubble:" + e.defaultPrevented));
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  escState.after = await page.evaluate(() => ({ esc: window.__esc, hi: window.mochi.shots.map((x) => x.hi && x.hi.status), veil: [...document.querySelectorAll(".hires-veil")].map((v) => v.className) }));
  await page.waitForFunction(() => !document.querySelector(".hires-veil:not(.is-leaving)"), null, { timeout: 5000 }).catch(() => {});
  ok("Esc：Hires 停掉", !(await page.evaluate(() => !!document.querySelector(".hires-veil:not(.is-leaving)"))), JSON.stringify(escState.after));
  ok("停掉後圖上沒有留下收不掉的進度層（剛停又開也一樣）", escState.after.veil.every((v) => v.includes("is-leaving")), JSON.stringify(escState.after.veil));

  // 圖上的「停」也照舊能停
  await startHires();
  await shot.hover();
  await page.waitForTimeout(300);
  await page.locator(".hires-veil .hv-act").click({ timeout: 3000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector(".hires-veil:not(.is-leaving)"), null, { timeout: 5000 }).catch(() => {});
  ok("圖上的「停」：Hires 停掉", !(await page.evaluate(() => !!document.querySelector(".hires-veil:not(.is-leaving)"))));

  // Hires「用目前模型」：開著時送出頂欄現在的底模、LoRA，原圖 LoRA 的觸發詞拿掉（2026-11-20 一起加的）
  await page.evaluate(() => {
    const s = window.mochi.shots.find((x) => x.status === "done");
    s.ckpt = "old_model.safetensors";
    s.loras = [{ folder: "", file: "old_style.safetensors", strength: 0.8, trigger: "oldtrig, inkstyle" }];
    s.positive = "1girl, oldtrig, inkstyle, red hair, smile";
  });
  await shot.hover();
  await shot.locator(".shot-hires").click();
  const box = page.locator(".hires-pop .hp-model");
  ok("Hires 面板有「用目前模型」", (await box.count()) === 1);
  const offLine = await box.textContent().catch(() => "");
  ok("關著：寫原圖那組", offLine.includes("old_model") && offLine.includes("照原圖"), offLine);
  await box.locator("input[role=switch]").check();
  const onLine = await box.textContent().catch(() => "");
  ok("開著：寫目前那組、會換觸發詞", !onLine.includes("old_model") && onLine.includes("觸發詞"), onLine);
  const sent = bodies.length;
  await page.locator(".hires-pop .hp-go").click();
  await page.waitForFunction(() => document.querySelector(".hires-veil:not(.is-leaving)"), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  if (errors.length) console.log("page errors:", errors.join(" | "));
  const hb = bodies.slice(sent).find((b) => b.hires) || {};
  ok("送出的是目前的底模和 LoRA", hb.ckpt !== "old_model.safetensors" && Array.isArray(hb.loras) && !hb.loras.some((l) => l.file === "old_style.safetensors"), JSON.stringify({ ckpt: hb.ckpt, loras: hb.loras }));
  ok("舊 LoRA 的觸發詞拿掉、牌照留", typeof hb.positive === "string" && !/oldtrig|inkstyle/.test(hb.positive) && /red hair/.test(hb.positive) && /smile/.test(hb.positive), hb.positive);
  await page.click("#wall-busy .go-stop");
  await page.waitForFunction(() => !document.querySelector(".hires-veil:not(.is-leaving)"), null, { timeout: 5000 }).catch(() => {});
  // 下一次打開還記得開著；關掉再送，用原圖那組
  await shot.hover();
  await shot.locator(".shot-hires").click();
  ok("開關記住", await page.locator(".hires-pop .hp-model input[role=switch]").isChecked());
  await page.locator(".hires-pop .hp-model input[role=switch]").uncheck();
  const sent2 = bodies.length;
  await page.locator(".hires-pop .hp-go").click();
  await page.waitForFunction(() => document.querySelector(".hires-veil:not(.is-leaving)"));
  await page.waitForTimeout(300);
  const hb2 = bodies.slice(sent2).find((b) => b.hires) || {};
  ok("關著：照原圖的底模、LoRA 和提示詞", hb2.ckpt === "old_model.safetensors" && hb2.loras?.[0]?.file === "old_style.safetensors" && /oldtrig/.test(hb2.positive || ""), JSON.stringify({ ckpt: hb2.ckpt, positive: hb2.positive }));
  await page.click("#wall-busy .go-stop");
  await page.waitForFunction(() => !document.querySelector(".hires-veil:not(.is-leaving)"), null, { timeout: 5000 }).catch(() => {});

  // 點開成品：寫出印這張時的底模、LoRA 和強度（2026-11-20 一起加的）
  await page.evaluate(() => {
    const s = window.mochi.shots.find((x) => x.status === "done");
    s.ckpt = "Illustrious\\waiIllustriousSDXL_v150.safetensors";
    s.loras = [{ folder: "", file: "style\\inkwash_style.safetensors", strength: 0.8 }, { folder: "", file: "detail_tweaker.safetensors", strength: 1 }];
  });
  await page.mouse.move(5, 5);
  await shot.locator(".shot-frame img").first().click();
  const model = await page.locator(".sd-model").textContent({ timeout: 5000 }).catch(() => "");
  ok("詳情：寫出底模名稱（不含資料夾、副檔名）", model.includes("waiIllustriousSDXL_v150") && !model.includes(".safetensors"), model);
  ok("詳情：寫出每個 LoRA 和強度", model.includes("inkwash_style") && model.includes("×0.80") && model.includes("detail_tweaker") && model.includes("×1.00"), model);
  if (process.env.SHOT) await page.locator(".shot-detail").screenshot({ path: process.env.SHOT });

  // 印壞的成品卡：原因只寫一次、只有「重試這張」（原位重印），按了在同一格印好（2026-11-20 一起加的）
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  failNext = true;
  const before2 = await page.locator(".shot").count();
  await page.click("#go-bar .btn-primary");
  const bad = page.locator('.shot[data-status="failed"]').first();
  await bad.waitFor({ timeout: 10000 }).catch(() => {});
  await bad.hover().catch(() => {});
  await page.waitForTimeout(300);
  const failed = await bad.evaluate((n) => {
    const shown = (q) => [...n.querySelectorAll(q)].filter((x) => x.getClientRects().length && getComputedStyle(x).display !== "none" && getComputedStyle(x).visibility !== "hidden");
    const text = n.innerText;
    return { reason: (text.match(/模型讀取失敗/g) || []).length, retry: shown(".shot-empty .btn").map((b) => b.textContent), reprint: shown(".shot-reprint").length };
  }).catch((e) => ({ err: String(e) }));
  ok("印壞的卡：原因只寫一次", failed.reason === 1, JSON.stringify(failed));
  ok("印壞的卡：只有「重試這張」，沒有並排的「同種子重印」", failed.retry?.join() === "重試這張" && failed.reprint === 0, JSON.stringify(failed));
  await bad.locator(".shot-empty .btn").click().catch(() => {});
  await page.waitForFunction((n) => document.querySelectorAll(".shot").length === n && !document.querySelector('.shot[data-status="failed"]'), before2 + 1, { timeout: 10000 }).catch(() => {});
  ok("按「重試這張」：在同一格印好，沒有多一張", (await page.locator(".shot").count()) === before2 + 1 && !(await page.locator('.shot[data-status="failed"]').count()));

  ok("沒有頁面錯誤", !errors.length, errors.join("\n"));
  await context.close();
} finally {
  for (const r of held) r.end();
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} 項沒過` : "\n全部通過");
process.exit(failed ? 1 : 0);
