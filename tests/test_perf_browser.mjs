// 墨池掉幀的回歸測試（2026-11-19 專案主：「網頁有時候似乎會掉幀」）。真的 web6 頁面、假伺服器，不連 ComfyUI；/api/gen、/api/interrupt 一律擋。
//
//   node scripts/test_web6_perf_browser.mjs
//   BASE_ROOT=<舊版的資料夾（git worktree）> node scripts/test_web6_perf_browser.mjs   # 拿舊版對照（修之前應該紅）
//
// 驗的事：
//   1. 字盒搜尋框連續打字：不是每個字都整盒重畫（打「hair」只畫第一個字和最後一次）；停下來的第一個字當場畫。
//   2. 打完馬上按 Enter：放進合成池的是這次搜尋的第一張（還沒畫的先畫完）。
//   3. 抽一輪：抽牌那排的按鈕不被整排換掉（只換狀態字）。
//   4. 捲動中 <html data-scrolling>，偏好卡牌托盤不用毛玻璃；停下來拿掉。
//   5. 滑鼠移進一張牌、隨即開始捲：放大卡不在捲動途中彈出來。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
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
const here = resolve(import.meta.dirname, "..");
const root = process.env.BASE_ROOT ? resolve(process.env.BASE_ROOT) : here;
const frontend = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (v) => (res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(v)));
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
  if (name.includes("..")) return res.writeHead(403).end();
  // 舊版資料夾沒有的（卡面這類不進 git 的）照這一份的。
  let file = [resolve(root, frontend, name), resolve(root, "web", name), resolve(here, frontend, name), resolve(here, "web", name)].find((f) => existsSync(f));
  if (!file) return res.writeHead(404).end();
  res.setHeader("Content-Type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" }[extname(file)] || "application/octet-stream");
  res.end(await readFile(file));
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

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route(/\/api\/(?:gen|interrupt)(?:\?|$)/, (r) => r.abort());
  await context.addInitScript(() => {
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.language.v1", "zh-Hant");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/index.html?debug");
  await page.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0 && window.mochi);
  await page.waitForTimeout(800);
  return { context, page };
}

try {
  const { context, page } = await newPage();

  // ---------- 1、2. 搜尋框 ----------
  try {
    // 數字盒整盒重畫幾次：每次重畫都換掉牌格裡的節點（第一張換成新的）。
    await page.evaluate(() => {
      window.__renders = 0;
      new MutationObserver((ms) => {
        if (ms.some((m) => [...m.removedNodes].some((n) => n.classList?.contains("card")))) window.__renders++;
      }).observe(document.getElementById("lib-grid"), { childList: true });
    });
    await page.locator("#lib-q").click();
    await page.keyboard.type("hair", { delay: 60 });
    await page.waitForTimeout(500);
    const renders = await page.evaluate(() => window.__renders);
    ok("1 連續打「hair」：字盒最多畫兩次（第一個字、停下來那次）", renders <= 2, `畫了 ${renders} 次`);
    const shown = await page.evaluate(() => [...document.querySelectorAll("#lib-grid .card[data-tag]")].slice(0, 3).map((n) => n.dataset.tag));
    ok("1 停下來之後：牌格是「hair」的結果", shown.length > 0 && shown.every((t) => /hair/.test(t)), shown.join(","));

    // 停一下再打一個字：當場畫（不等）
    await page.locator("#lib-q").fill("");
    await page.waitForTimeout(500);
    const now = await page.evaluate(() => {
      const q = document.getElementById("lib-q");
      q.value = "smile";
      q.dispatchEvent(new Event("input", { bubbles: true }));
      return document.querySelector("#lib-grid .card[data-tag]")?.dataset.tag || "";
    });
    ok("1 停過之後打字：當場就畫（不延遲）", /smile/.test(now), now);

    // 2. 連續打完立刻 Enter：放的是這次搜尋的第一張
    await page.locator("#lib-q").fill("");
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => [...window.mochi.pool]);
    await page.locator("#lib-q").click();
    await page.keyboard.type("red hai", { delay: 30 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const added = await page.evaluate((before) => [...window.mochi.pool].filter((t) => !before.includes(t)), before);
    ok("2 打完馬上 Enter：放進去的是這次搜尋的第一張", added.length >= 1 && /red/.test(added[0]) && /hair/.test(added[0]), added.join(","));
    await page.locator("#lib-q").fill("");
    await page.waitForTimeout(400);
  } catch (err) {
    ok("沒有例外（搜尋）", false, err.stack);
  }

  // ---------- 3. 抽一輪：抽牌那排的按鈕不被換掉 ----------
  try {
    await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(() => (window.__drawBtn = document.querySelector("#go-bar .go-actions .btn-ghost")));
    await page.keyboard.press("Escape");
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press("p");
    await page.waitForTimeout(1500);
    const same = await page.evaluate(() => window.__drawBtn?.isConnected && document.querySelector("#go-bar .go-actions .btn-ghost") === window.__drawBtn);
    const shots = await page.locator("#wall .shot").count();
    ok("3 抽一輪：真的抽了", shots >= 1, `${shots}`);
    ok("3 抽一輪：抽牌那排的按鈕還是原本那顆（沒有整排重建）", same);
  } catch (err) {
    ok("沒有例外（抽牌）", false, err.stack);
  }

  // ---------- 6、7. 發牌、送去印：動畫只動顯示卡能直接合成的東西 ----------
  try {
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    // 7. 抽一輪時飛過去的牌：途中陰影不變（只動 transform、opacity），不然每一格整張牌重畫。
    await page.evaluate(() => {
      window.__shadows = new Set();
      window.__ghosts = 0;
      window.__stopGhost = false;
      const loop = () => {
        for (const g of document.querySelectorAll(".deal-ghost")) {
          window.__ghosts++;
          window.__shadows.add(g.style.boxShadow);
        }
        if (!window.__stopGhost) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await page.keyboard.press("p");
    await page.waitForTimeout(1600);
    const g = await page.evaluate(() => ((window.__stopGhost = true), { n: window.__ghosts, shadows: [...window.__shadows] }));
    ok("7 抽一輪：有牌飛過去", g.n > 0, JSON.stringify(g));
    ok("7 飛過去的牌：途中陰影不變（不每一格重畫）", g.shadows.length === 1, JSON.stringify(g.shadows.slice(0, 4)));
    // 6. 送到 ComfyUI、還沒開始畫（running）：攤開的那手牌的呼吸只動透明度。
    const anim = await page.evaluate(async () => {
      const shot = [...document.querySelectorAll("#wall .shot")].find((s) => s.querySelector(".hand-card"));
      if (!shot) return null;
      shot.dataset.status = "running";
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const list = document.getAnimations().filter((a) => a.animationName === "hand-ready");
      const props = new Set();
      for (const a of list) for (const k of a.effect.getKeyframes()) for (const key of Object.keys(k)) if (!["offset", "easing", "composite", "computedOffset"].includes(key)) props.add(key);
      shot.dataset.status = "drawn";
      return { n: list.length, props: [...props], onPseudo: list.every((a) => a.effect.pseudoElement === "::after") };
    });
    ok("6 送去印、等開始畫：攤開的牌在呼吸", !!anim && anim.n > 0, JSON.stringify(anim));
    ok("6 呼吸只動透明度（不動 box-shadow，不必每一格重畫牌）", !!anim && anim.props.length === 1 && anim.props[0] === "opacity", JSON.stringify(anim));
  } catch (err) {
    ok("沒有例外（發牌、送去印）", false, err.stack);
  }

  // ---------- 4. 捲動中不用毛玻璃 ----------
  try {
    // 托盤沒有牌時是收著的（display: none），算出來的樣式照樣看得到規則有沒有套上。
    if (!(await page.locator(".fav-hand").count())) ok("4 頁面上有偏好卡牌托盤", false, "找不到 .fav-hand");
    else {
      await page.evaluate(() => {
        const pad = document.createElement("div");
        pad.style.height = "3000px";
        document.body.append(pad);
      });
      await page.mouse.move(700, 400);
      const during = [];
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(40);
        during.push(await page.evaluate(() => ({ s: "scrolling" in document.documentElement.dataset, f: getComputedStyle(document.querySelector(".fav-hand")).backdropFilter })));
      }
      ok("4 捲動中：<html> 標 data-scrolling", during.slice(1).every((d) => d.s), JSON.stringify(during));
      ok("4 捲動中：托盤不用毛玻璃", during.slice(1).every((d) => d.f === "none"), JSON.stringify(during));
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => ({ s: "scrolling" in document.documentElement.dataset, f: getComputedStyle(document.querySelector(".fav-hand")).backdropFilter }));
      ok("4 停下來：拿掉標記、毛玻璃回來", !after.s && /blur/.test(after.f), JSON.stringify(after));
      await page.evaluate(() => scrollTo(0, 0));
    }
  } catch (err) {
    ok("沒有例外（捲動）", false, err.stack);
  }

  // ---------- 5. 移進牌、隨即捲：放大卡不彈出來 ----------
  // 捲動用 scroll 事件模擬（真的滾輪在無頭瀏覽器裡要看頁面捲不捲得動，結果不穩）：放大卡等 120ms 才浮，這段時間一直有 scroll。
  try {
    await page.evaluate(() => {
      scrollTo(0, 0);
      const s = document.getElementById("lib-scroll");
      if (s) s.scrollTop = 0;
    });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    const card = async (i) => {
      const b = await page.locator("#lib-grid .card").nth(i).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, edge: { x: b.x + 4, y: b.y + 4 } };
    };
    const a = await card(0);
    await page.mouse.move(a.edge.x, a.edge.y);
    await page.evaluate(() => {
      window.__peeked = false;
      window.__stopPeek = false;
      const loop = () => {
        if (document.getElementById("card-peek")?.dataset.show === "true") window.__peeked = true;
        if (!window.__stopPeek) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      let n = 0;
      const tick = setInterval(() => {
        window.dispatchEvent(new Event("scroll"));
        if (++n > 12) clearInterval(tick);
      }, 20);
    });
    await page.mouse.move(a.x, a.y, { steps: 2 });
    await page.waitForTimeout(450);
    const peeked = await page.evaluate(() => ((window.__stopPeek = true), window.__peeked));
    ok("5 移進牌、等的途中在捲：放大卡沒有彈出來", !peeked);
    // 不捲、停在牌上：照樣浮出來
    await page.mouse.move(5, 5, { steps: 3 });
    await page.waitForTimeout(300);
    const b = await card(1);
    await page.mouse.move(b.edge.x, b.edge.y);
    await page.mouse.move(b.x, b.y, { steps: 4 });
    const shown = await page.waitForFunction(() => document.getElementById("card-peek")?.dataset.show === "true", null, { timeout: 3000 }).then(() => true, () => false);
    ok("5 停在牌上不捲：放大卡照樣浮出來", shown);
  } catch (err) {
    ok("沒有例外（放大卡）", false, err.stack);
  }

  await context.close();
  ok("沒有頁面錯誤", !errors.length, errors.join("\n"));
} catch (err) {
  ok("沒有例外", false, err.stack);
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
