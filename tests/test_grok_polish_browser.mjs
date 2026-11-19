// 墨池五項打磨（作品冊再印鎖、份量角標、付印字母、解析池動詞、空群組一行）。
//
//   node scripts/test_grok_polish_browser.mjs
//   BASELINE=HEAD node scripts/test_grok_polish_browser.mjs   # 拿舊版那幾個檔對照（舊版應該紅在對應的項目）
//
// 假伺服器、不連 ComfyUI；/api/gen、/api/interrupt 一律擋。不寫 data/。
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
    } catch {
      /* 下一個路徑 */
    }
  }
  throw new Error("Install Playwright or set PLAYWRIGHT_MODULE");
})();

const root = resolve(import.meta.dirname, "..");
const BASE_FILES = [
  "web6/album.js",
  "web6/transfer.js",
  "web6/weights.js",
  "web6/fuse.js",
  "web6/fuse.html",
  "web6/fuse.css",
  "web6/parse.js",
  "web6/parse.html",
  "web6/book-groups.js",
  "web6/book.css",
  "web6/styles.css",
];
const baseline = process.env.BASELINE
  ? new Map(BASE_FILES.map((f) => [f.slice(5), execFileSync("git", ["show", `${process.env.BASELINE}:${f}`], { cwd: root, maxBuffer: 2 ** 26 })]))
  : null;

const WORK = {
  id: "w-reprint",
  name: "再印測試",
  createdAt: "2026-11-20T00:00:00.000Z",
  positive: "red hair, kimono",
  pinned: ["red hair"],
  loras: ["demo.safetensors"],
  rating: "general",
  era: "modern",
  seed: 1,
  width: 832,
  height: 1216,
};

const state = { recipeDelay: 0, recipeStatus: 200, recipeHits: 0, groups: [] };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (v) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(v));
  };
  if (url.pathname === "/api/parse" && req.method === "POST") return json({ ok: true, tags: [], settings: { model: "wd-vit" } });
  if (url.pathname === "/api/recipes") return json({ ok: true, items: [WORK] });
  if (url.pathname.startsWith("/api/recipes/") && !url.pathname.includes("/files/")) {
    state.recipeHits += 1;
    if (state.recipeDelay) await new Promise((r) => setTimeout(r, state.recipeDelay));
    if (state.recipeStatus !== 200) return res.writeHead(state.recipeStatus).end("no");
    return json({ ok: true, recipe: { loras: [{ file: "demo.safetensors", strength: 0.65, trigger: "demo" }] } });
  }
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/card-groups") return json({ ok: true, groups: state.groups });
    const data = {
      "/api/ping": { ok: true },
      "/api/gen/active": { ok: true, jobs: [] },
      "/api/decks": { ok: true, decks: [] },
      "/api/usage": { counts: {}, mine: {}, last: {} },
      "/api/lora-push": { version: 0 },
      "/api/discord/config": { ok: true, configured: false, enabled: false, mode: "webhook" },
      "/api/workflows": { ok: true, items: [] },
      "/api/checkpoints": { items: [] },
      "/api/loras": { items: [], categories: [] },
      "/api/sampling": { ok: true, base: { steps: 28, cfg: 5, sampler_name: "euler", scheduler: "normal" }, hires: { fast: {}, deep: {} } },
    }[url.pathname] || { ok: true, items: [] };
    return json(data);
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
  const type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[extname(name)] || "application/octet-stream";
  if (baseline?.has(name)) return res.writeHead(200, { "Content-Type": type }).end(baseline.get(name));
  let file = resolve(root, "web6", name);
  if (!existsSync(file)) file = resolve(root, "web", name);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { "Content-Type": type });
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
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 700)}`);
  if (!cond) failed += 1;
};

async function openPage(url, { viewport = { width: 1440, height: 900 }, mobile = false, reduced = false, pointer = null, init = null } = {}) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: "zh-TW" });
  await context.addInitScript(() => {
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.language.v1", "zh-Hant");
  });
  if (init) await context.addInitScript(init);
  await context.route(/\/api\/(?:gen|interrupt)(?:\?|$)/, (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(25000);
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  if (pointer) {
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setEmulatedMedia", { features: pointer });
  }
  await page.goto(origin + url, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

const shown = (page, sel) => page.locator(sel).evaluate((el) => {
  const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && el.getClientRects().length > 0;
});

async function scenario(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  try {
    await fn();
  } catch (err) {
    ok(`${name}（沒跑完）`, false, err?.stack || err);
  }
}

try {
  await scenario("作品冊再印", async () => {
    state.recipeDelay = 1200;
    state.recipeStatus = 200;
    state.recipeHits = 0;
    const { context, page, errors } = await openPage("/album.html", {
      init: () => sessionStorage.setItem("mochi.tab.pool.v1", JSON.stringify({ tags: ["blue hair"], weights: {} })),
    });
    try {
      await page.waitForSelector(".album-tile");
      await page.locator(".album-tile").first().click();
      const btn = page.locator(".reprint-btn");
      await btn.waitFor();
      const w0 = await btn.evaluate((el) => el.offsetWidth);
      ok("再印鈕有寬度", w0 > 40, String(w0));
      await btn.focus();
      await page.keyboard.press("Enter");
      await page.evaluate(() => document.querySelector(".reprint-btn")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector(".reprint-btn")?.getAttribute("aria-busy") === "true");
      const mid = await page.evaluate(() => {
        const b = document.querySelector(".reprint-btn");
        return { text: b.textContent, w: b.offsetWidth, widthStyle: b.style.width };
      });
      ok("讀取中寫讀取作品配方", mid.text.includes("讀取作品配方…"), mid.text);
      ok("讀取中寬度不變", Math.abs(mid.w - w0) < 1, `${w0} → ${mid.w}`);
      ok("讀取中有釘住寬度", !!mid.widthStyle, mid.widthStyle);
      await page.waitForTimeout(150);
      ok("等待時只讀一次配方", state.recipeHits === 1, String(state.recipeHits));
      await page.waitForSelector("[data-transfer-review='pool']");
      const sheetText = await page.locator("[data-transfer-review]").innerText();
      ok("只開一層確認窗", (await page.locator("[data-transfer-review]").count()) === 1);
      ok("保留會拿下的牌", sheetText.includes("會拿下的牌") && sheetText.includes("藍髮"), sheetText.slice(0, 200));
      const hitsOpen = state.recipeHits;
      await page.evaluate(() => document.querySelector(".reprint-btn")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      await page.waitForTimeout(200);
      ok("窗還開著不再讀", state.recipeHits === hitsOpen, String(state.recipeHits));
      ok("窗還開著仍是一層", (await page.locator("[data-transfer-review]").count()) === 1);
      await page.locator("[data-transfer-review]").getByRole("button", { name: "取消" }).click();
      await page.waitForFunction(() => !document.querySelector("[data-transfer-review]"));
      const before = state.recipeHits;
      await page.locator(".reprint-btn").click();
      await page.waitForSelector("[data-transfer-review='pool']");
      ok("取消後可以重按", state.recipeHits === before + 1, `${before} → ${state.recipeHits}`);
      await page.locator("[data-transfer-review]").getByRole("button", { name: "取消" }).click();
      await page.waitForFunction(() => !document.querySelector("[data-transfer-review]"));
      state.recipeStatus = 500;
      state.recipeDelay = 0;
      state.recipeHits = 0;
      await page.evaluate(() => document.querySelector(".reprint-btn").click());
      await page.waitForFunction(() => {
        const b = document.querySelector(".reprint-btn");
        return b && b.getAttribute("aria-busy") !== "true" && b.textContent.includes("照這張再印");
      });
      ok("讀取失敗後鈕回到原字", true);
      await page.evaluate(() => document.querySelector(".reprint-btn").click());
      await page.waitForTimeout(400);
      ok("失敗後可以再讀", state.recipeHits >= 2, String(state.recipeHits));
      ok("失敗也不疊第二層確認窗", (await page.locator("[data-transfer-review]").count()) <= 1);
      ok("作品冊沒有頁面錯誤", !errors.length, errors.join("\n"));
    } finally {
      await context.close();
    }
  });

  await scenario("份量角標", async () => {
    const { context, page, errors } = await openPage("/index.html?debug");
    try {
      await page.waitForFunction(() => document.querySelectorAll("#lib-grid .card").length > 0 && window.mochi);
      await page.evaluate(() => {
        const tag = window.mochi.lib().cards.find((c) => c.suit !== "chara").tag;
        window.mochi.pin(tag);
        const pad = document.createElement("div");
        pad.style.height = "4000px";
        document.body.append(pad);
      });
      const card = page.locator("#pool-well .card").first();
      await card.waitFor();
      const box = await card.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.42);
      await page.waitForTimeout(1000);
      await page.waitForSelector("#pool-well .card-w-rest");
      const rested = await page.evaluate(() => document.querySelector("#pool-well .card-w")?.textContent || "");
      ok("滑鼠在牌上時淡入 1.0", rested.trim() === "1.0", rested);
      const beforeY = await page.evaluate(() => scrollY);
      for (let i = 0; i < 3; i += 1) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(200);
      const mid = await page.evaluate(() => ({
        y: scrollY,
        w: document.querySelector("#pool-well .card")?.dataset.w || "",
        t: document.querySelector("#pool-well .card-w")?.textContent || "",
      }));
      ok("牌上停一秒再滾三格：份量不變", !mid.w, JSON.stringify(mid));
      ok("牌上停一秒再滾三格：頁面有捲", mid.y > beforeY, `${beforeY} → ${mid.y}`);
      await page.evaluate(() => scrollTo(0, 0));
      const back = await card.boundingBox();
      await page.mouse.move(back.x + back.width / 2, back.y + back.height * 0.42);
      await page.waitForSelector("#pool-well .card-w-rest");
      const badge = await page.locator("#pool-well .card-w").boundingBox();
      ok("角標至少 28×28", badge.width >= 28 && badge.height >= 28, JSON.stringify(badge));
      await page.mouse.move(badge.x + badge.width / 2, badge.y + badge.height / 2);
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(250);
      const stepped = await page.evaluate(() => ({
        w: document.querySelector("#pool-well .card")?.dataset.w || "",
        t: document.querySelector("#pool-well .card-w")?.textContent || "",
      }));
      ok("指著角標滾一格只改一檔", stepped.w === "down" && stepped.t.trim() === "0.9", JSON.stringify(stepped));
      await card.focus();
      await page.keyboard.press("+");
      await page.keyboard.press("+");
      await page.waitForTimeout(150);
      const keyed = await page.evaluate(() => ({
        w: document.querySelector("#pool-well .card")?.dataset.w || "",
        t: document.querySelector("#pool-well .card-w")?.textContent || "",
      }));
      ok("鍵盤仍可調份量", keyed.w === "up" && keyed.t.trim() === "1.2", JSON.stringify(keyed));
      ok("合成池沒有頁面錯誤", !errors.length, errors.join("\n"));
    } finally {
      await context.close();
    }
  });

  await scenario("疊印台付印", async () => {
    const { context, page, errors } = await openPage("/fuse.html?debug");
    try {
      await page.waitForFunction(() => {
        const go = document.querySelector(".pb-go");
        return go && go.textContent.includes("付印") && go.querySelector(".pb-go-letter")?.textContent === "A";
      });
      const body = await page.locator("body").innerText();
      ok("主鈕寫付印 A", (await page.locator(".pb-go").innerText()).includes("付印") && (await page.locator(".pb-go-letter").innerText()).trim() === "A");
      ok("拿掉卡池與預覽的重複說明", !body.includes("比較四組候選提示詞") && !body.includes("這是候選提示詞") && !body.includes("四組候選提示詞"), body.slice(0, 300));
      ok("試印區留一句選一組牌再付印", body.includes("選一組牌，再付印"));
      await page.evaluate(() => window.fuse.place("red hair"));
      await page.waitForFunction(() => window.fuse.bed.pins.includes("red hair"));
      await page.locator("#trials .trial").nth(1).hover();
      await page.waitForTimeout(400);
      ok("滑鼠暫看不改付印鈕", (await page.locator(".pb-go-letter").innerText()).trim() === "A");
      const rolled = await page.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
        const bs = [...document.querySelectorAll(".pb-go .pb-go-letter b")];
        return { text: document.querySelector(".pb-go")?.textContent || "", letters: bs.map((b) => b.textContent), anim: bs.some((b) => b.getAnimations().length > 0) };
      });
      ok("按 2 變成付印 B", rolled.text.includes("付印") && rolled.letters.includes("B"), JSON.stringify(rolled));
      ok("換字母有滾動", rolled.anim || rolled.letters.length > 1, JSON.stringify(rolled));
      await page.locator("#trials .trial").nth(2).hover();
      await page.waitForTimeout(400);
      ok("暫看時按鈕仍是選取的那組", (await page.locator(".pb-go-letter").innerText()).trim() === "B");
      const printed = await page.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
        return window.fuse.prints[0]?.letter || "";
      });
      ok("G 跟按鈕同一個選取", printed === "B", printed);
      ok("疊印台沒有頁面錯誤", !errors.length, errors.join("\n"));
    } finally {
      await context.close();
    }
  });

  await scenario("解析池動詞", async () => {
    const fine = [{ name: "pointer", value: "fine" }, { name: "hover", value: "hover" }];
    const coarse = [{ name: "pointer", value: "coarse" }, { name: "hover", value: "none" }];
    const desk = await openPage("/parse.html", { pointer: fine });
    try {
      await desk.page.waitForSelector(".parse-drop-title");
      ok("電腦主字是拖入圖片", (await shown(desk.page, ".parse-drop-title.parse-drop-mouse")) && (await desk.page.locator(".parse-drop-title.parse-drop-mouse").innerText()) === "拖入圖片");
      ok("電腦旁邊是或選擇檔案", (await shown(desk.page, ".parse-drop-sub.parse-drop-mouse")) && (await desk.page.locator(".parse-drop-sub.parse-drop-mouse").innerText()) === "或選擇檔案");
      ok("電腦不把選圖當主字", !(await shown(desk.page, ".parse-drop-title.parse-drop-touch")));
    } finally {
      await desk.context.close();
    }
    const touch = await openPage("/parse.html", { viewport: { width: 390, height: 844 }, mobile: true, pointer: coarse });
    try {
      await touch.page.waitForSelector(".parse-drop-title.parse-drop-touch", { state: "visible" });
      ok("觸控主字是選一張圖片", (await shown(touch.page, ".parse-drop-title.parse-drop-touch")) && (await touch.page.locator(".parse-drop-title.parse-drop-touch").innerText()) === "選一張圖片");
      ok("觸控副標是從相簿或檔案選取", (await shown(touch.page, ".parse-drop-sub.parse-drop-touch")) && (await touch.page.locator(".parse-drop-sub.parse-drop-touch").innerText()) === "從相簿或檔案選取");
      ok("觸控不寫拖入", !(await shown(touch.page, ".parse-drop-title.parse-drop-mouse")));
      await touch.page.waitForFunction(() => !("booting" in document.documentElement.dataset));
      await touch.page.locator("#parse-file").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
      await touch.page.waitForFunction(() => document.body.innerText.includes("換一張輪廓清楚的圖"));
      const text = await touch.page.locator("body").innerText();
      ok("零個標籤補一句換圖", text.includes("換一張輪廓清楚的圖"));
      ok("零個標籤不是失敗重試", !text.includes("再試一次") && !text.includes("一張牌都對不上"));
      ok("解析池沒有頁面錯誤", !touch.errors.length, touch.errors.join("\n"));
    } finally {
      await touch.context.close();
    }
  });

  await scenario("卡冊空群組", async () => {
    state.groups = [];
    const { context, page, errors } = await openPage("/book.html");
    try {
      await page.waitForFunction(() => {
        const s = document.getElementById("book-shelf");
        return s && !s.hidden && s.querySelector(".bs-empty") && !s.querySelector(".bs-lane");
      });
      const line = (await page.locator(".bs-empty").innerText()).replace(/\s+/g, "");
      ok("沒有群組時收成一行", line.includes("群組") && line.includes("建立第一組"), line);
      const grew = await page.evaluate(() => {
        const shelf = document.getElementById("book-shelf");
        const before = shelf.getBoundingClientRect().height;
        let err = "";
        window.addEventListener("error", (e) => {
          err = `${e.message}\n${e.error?.stack || ""}`;
        });
        shelf.querySelector(".bs-empty").click();
        return {
          anim: shelf.getAnimations().length > 0,
          lanes: shelf.querySelectorAll(".bs-lane").length,
          intro: !!shelf.querySelector(".bs-intro"),
          before,
          after: shelf.getBoundingClientRect().height,
          err,
          html: shelf.innerHTML.slice(0, 300),
        };
      });
      ok("點了一行展開成書架", grew.lanes === 4 && grew.intro, JSON.stringify(grew));
      // 高度動畫一開始就把架子按在舊高度上，同一拍量到的還是一行那麼高；有動畫就代表正在長。
      ok("展開有高度動畫", grew.anim, JSON.stringify(grew));
      ok("記住展開", (await page.evaluate(() => localStorage.getItem("mochi.book.shelf.v1"))) === "0");
      await page.locator(".bs-fold").click();
      await page.waitForSelector("#book-shelf .bs-empty");
      ok("收起回到一行", (await page.locator("#book-shelf .bs-lane").count()) === 0);
      ok("記住收起", (await page.evaluate(() => localStorage.getItem("mochi.book.shelf.v1"))) === "1");
      ok("卡冊沒有頁面錯誤", !errors.length, errors.join("\n"));
    } finally {
      await context.close();
    }

    const reduced = await openPage("/book.html", { reduced: true });
    try {
      await reduced.page.waitForFunction(() => document.querySelector("#book-shelf .bs-empty") && !document.querySelector("#book-shelf .bs-lane"));
      await reduced.page.locator(".bs-empty").click();
      await reduced.page.waitForFunction(() => document.querySelectorAll("#book-shelf .bs-lane").length === 4);
      const clear = await reduced.page.evaluate(() => {
        const shelf = document.getElementById("book-shelf");
        const h = shelf.getBoundingClientRect().height;
        return h > 40 && !!shelf.querySelector(".bs-intro");
      });
      ok("減少動態時展開仍然看得清楚", clear);
    } finally {
      await reduced.context.close();
    }

    state.groups = [{ id: "g1", name: "紅髮組", section: "feature", tags: ["red hair"] }];
    const desk = await openPage("/book.html");
    try {
      await desk.page.waitForSelector("#book-shelf .bs-lane");
      ok("已有群組的電腦版照舊攤開", (await desk.page.locator("#book-shelf .bs-empty").count()) === 0 && (await desk.page.locator("#book-shelf .bs-lane").count()) === 4);
      ok("已有群組看得到組名", (await desk.page.locator("#book-shelf").innerText()).includes("紅髮組"));
    } finally {
      await desk.context.close();
    }
    const phone = await openPage("/book.html", { viewport: { width: 390, height: 844 }, mobile: true });
    try {
      await phone.page.waitForFunction(() => {
        const s = document.getElementById("book-shelf");
        return s && !s.hidden && s.dataset.folded === "true";
      });
      ok("手機有群組時維持收起、不是建立第一組", (await phone.page.locator("#book-shelf .bs-empty").count()) === 0 && (await phone.page.locator("#book-shelf").innerText()).includes("紅髮組"));
    } finally {
      await phone.context.close();
      state.groups = [];
    }
  });
} finally {
  await browser.close();
  server.close();
}

console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
