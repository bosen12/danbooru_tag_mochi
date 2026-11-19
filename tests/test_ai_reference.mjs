import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { extname, resolve, sep } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..");
const frontend = existsSync(resolve(root, "web6/index.html")) ? "web6" : "web";
const require = createRequire(import.meta.url);
const playwright = [
  process.env.PLAYWRIGHT_MODULE,
  "playwright",
  resolve(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"),
].filter(Boolean).map((name) => {
  try { return require(name); } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;
    return null;
  }
}).find(Boolean);
if (!playwright) throw new Error("Install Playwright or set PLAYWRIGHT_MODULE");

const baseline = process.env.BASELINE;
const before = (file) => execFileSync("git", ["show", `${baseline || "HEAD"}:${file}`], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNCcAAAAASUVORK5CYII=", "base64");
const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const shot = {
  id: "s-reference", seed: 17, width: 832, height: 1216, status: "done", rating: "general", era: "modern",
  at: "2026-11-01T12:00:00Z", image: "/api/image?filename=example.png", ckpt: "test.safetensors",
  loras: [{ file: "detail.safetensors", strength: 0.75 }],
  mine: ["blue eyes", "shirt"], weights: { "blue eyes": 1.2 },
  drawn: [{ tag: "street", src: "random" }, { tag: "outdoors", src: "implies" }, { tag: "sunset", src: "group" }],
  positive: "(blue eyes:1.2), shirt, street, outdoors, sunset",
  groups: { env: ["晚景"] }, groupIds: { env: ["evening"] },
};
const work = {
  id: "album-1", name: "夜街", createdAt: "2026-11-02T00:00:00Z", rating: "general",
  seed: 18, width: 832, height: 1216, image: { file: "example.png" }, thumbnail: { file: "example.png" },
  pinned: ["blue eyes"], positive: "(blue eyes:1.3), street, outdoors",
};
const connection = { kind: "cli", provider: "codex" };
const chats = [];
const requests = [];
function script(body) {
  chats.push(body);
  const messages = body.messages;
  const latest = messages.findLastIndex((m) => m.role === "user");
  const said = messages[latest].content.split("\n").at(-1);
  const results = messages.slice(latest + 1).filter((m) => m.role === "tool");
  const findArgs = { name: "find_works", args: { from: "2026-11-01", favorite: true, tags: ["street"] } };
  const albumArgs = { name: "use_reference", args: { id: work.id, include: ["feature"] } };
  const args = {
    borrow: { name: "use_reference", args: { id: shot.id, include: ["feature", "clothing"] } },
    "borrow scene": { name: "use_reference", args: { id: shot.id, include: ["env"] } },
    trace: { name: "trace_card", args: { tag: "outdoors", id: shot.id } },
    group: { name: "trace_card", args: { tag: "sunset", id: shot.id } },
    "pool trace": { name: "trace_card", args: { tag: "outdoors" } },
    find: findArgs,
    album: albumArgs,
    pick: results.length ? albumArgs : findArgs,
  }[said];
  const frames = args && results.length < (said === "pick" ? 2 : 1)
    ? [["tool_calls", { calls: [{ ...args, id: `call-${chats.length}` }] }], ["done", { reason: "tool_calls" }]]
    : [["text", { delta: "完成" }], ["done", { reason: "end" }]];
  return frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const send = (body, type = "application/json") => res.writeHead(200, { "Content-Type": type }).end(body);
  const json = (body) => send(JSON.stringify(body));
  try {
    if (pathname.startsWith("/api/")) requests.push(pathname);
    if (["/api/gen", "/api/interrupt"].includes(pathname)) return res.writeHead(403).end();
    if (pathname === "/api/assistant/status") return json({ ok: true, configured: true, connection, local: true });
    if (pathname === "/api/assistant/chat" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      return send(script(JSON.parse(Buffer.concat(chunks).toString("utf8"))), "text/event-stream");
    }
    if (pathname === "/api/recipes") return json({
      ok: true,
      items: [
        work,
        { ...work, id: "old", createdAt: "2026-10-01" },
        { ...work, id: "only-pinned", pinned: ["street"], positive: "shirt" },
        { ...work, id: "higher-rating", rating: "explicit" },
      ],
    });
    if (pathname === `/api/recipes/${work.id}`) return json({ ok: true, recipe: work });
    if (pathname === "/api/image" || pathname.startsWith("/api/recipes/files/")) return send(image, "image/png");
    if (pathname.startsWith("/api/")) return json({ ok: true, items: [], jobs: [], groups: [], decks: [], counts: {} });
    const name = decodeURIComponent(pathname.slice(1)) || "index.html";
    if (baseline && ["app.js", "assistant.js", "assistant-tools.js", "assistant-prompt.js"].includes(name)) {
      return send(before(`${frontend}/${name}`), "text/javascript");
    }
    for (const dir of [frontend, "web"]) {
      const base = resolve(root, dir);
      const file = resolve(base, name);
      if (!file.startsWith(base + sep)) return res.writeHead(403).end();
      if (existsSync(file) && extname(file)) return send(readFileSync(file), mime[extname(file)] || "application/octet-stream");
    }
    res.writeHead(404).end();
  } catch (err) {
    console.error(err);
    res.writeHead(500).end();
  }
});

await new Promise((ready, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", ready);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const channel = process.env.PLAYWRIGHT_CHANNEL;
let browser;
try {
  browser = await playwright.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
} catch (err) {
  server.close();
  throw err;
}
test.after(async () => {
  await browser.close();
  server.close();
});

async function openPage(t, enabled) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
  t.after(() => context.close());
  const blocked = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || ["/api/gen", "/api/interrupt"].includes(url.pathname)) {
      if (url.origin === origin) blocked.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(({ enabled, shot }) => {
    localStorage.setItem("mochi.assistant.v1", JSON.stringify({ enabled, open: enabled }));
    localStorage.setItem("mochi.tour.declined.v1", "99");
    localStorage.setItem("mochi.language.v1", "zh-Hant");
    if (!localStorage.getItem("mochi.shots.v1")) {
      const second = { ...shot, id: "s-other", seed: 42, at: "2026-10-31T12:00:00Z" };
      localStorage.setItem("mochi.shots.v1", JSON.stringify([shot, second]));
    }
  }, { enabled, shot });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  t.after(() => {
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
  });
  page.setDefaultTimeout(4000);
  await page.goto(`${origin}/index.html?debug`);
  await page.locator("#lib-grid .card").first().waitFor();
  return page;
}

const inputOf = (page) => page.locator(".ai-input");
const card = (page, tag) => page.locator(`#pool-well [data-tag=${JSON.stringify(tag)}]`);
const sent = (said) => chats.findLast((body) => body.messages.findLast((m) => m.role === "user").content.endsWith(`\n${said}`));
const toolResult = (said, name) => JSON.parse(sent(said).messages.findLast((m) => m.role === "tool" && m.name === name).content);
async function say(page, text) {
  const input = inputOf(page);
  await input.fill(text);
  await input.press("Enter");
  await page.locator('.ai-send[data-running="false"]:not([data-pending])').waitFor();
}
test("關掉助手時，成品牆沒有引用節點、拖放效果或助手請求", async (t) => {
  const start = requests.length;
  const page = await openPage(t, false);
  const img = page.locator("#wall .shot-frame > img").first();
  await img.waitFor();
  assert.equal(await page.locator(".ai-shot-ref, .ai-ref, #ai-panel").count(), 0);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await img.dispatchEvent("dragstart", { dataTransfer: transfer });
  assert.deepEqual(await transfer.evaluate((data) => [...data.types]), []);
  assert.deepEqual(requests.slice(start).filter((p) => p.startsWith("/api/assistant") || p.startsWith("/api/recipes")), []);
});

test("拖成品、牆重排、分段帶入、復原和卡面來歷", async (t) => {
  const page = await openPage(t, true);
  await inputOf(page).waitFor();
  await page.locator('#wall .shot[data-id="s-reference"] .shot-frame > img').dragTo(inputOf(page));
  const ref = page.locator(".ai-refs .ai-ref[data-work-id='s-reference']");
  await ref.locator("img").waitFor();
  await page.locator("#go-bar").getByRole("button", { name: "只抽牌", exact: true }).click();
  await page.locator('#wall .shot[data-status="drawn"]').first().waitFor();
  assert.equal(await page.locator("#wall .shot").first().getAttribute("data-status"), "drawn");
  const second = page.locator('#wall .shot[data-id="s-other"] .ai-shot-ref');
  await second.focus();
  await second.press("Enter");
  await page.locator(".ai-refs .ai-ref[data-work-id='s-other']").waitFor();
  await page.locator(".ai-refs .ai-ref[data-work-id='s-other'] button").click();
  assert.equal(await page.locator(".ai-refs .ai-ref").count(), 1);
  await say(page, "borrow");
  const message = sent("borrow").messages.findLast((m) => m.role === "user").content;
  const prefix = "［引用作品］";
  const [snapshot] = JSON.parse(message.split("\n").find((row) => row.startsWith(prefix)).slice(prefix.length));
  assert.equal(snapshot.id, shot.id);
  assert.equal(snapshot.seed, 17);
  assert.deepEqual(snapshot.loras, shot.loras);
  assert.equal(snapshot.checkpoint, shot.ckpt);
  assert.deepEqual([snapshot.width, snapshot.height, snapshot.era], [832, 1216, "modern"]);
  assert.equal(snapshot.cards.find((c) => c.tag === "blue eyes")?.weight, 1.2);
  await card(page, "blue eyes").waitFor();
  await card(page, "shirt").waitFor();
  assert.equal(await card(page, "street").count(), 0);
  const step = page.locator(".ai-step").filter({ hasText: "照作品 #s-reference 帶入" });
  await step.getByRole("button", { name: "看變更" }).click();
  const changes = step.locator(".ai-step-changes");
  await changes.waitFor();
  assert.match(await changes.textContent(), /藍眼/);
  await step.getByRole("button", { name: "復原" }).click();
  assert.equal(await card(page, "blue eyes").count(), 0);
  assert.equal(await card(page, "shirt").count(), 0);
  await say(page, "trace");
  const previous = sent("trace").messages.find((m) => m.role === "user" && m.content.endsWith("\nborrow"));
  assert.deepEqual(JSON.parse(previous.content.split("\n").find((row) => row.startsWith(prefix)).slice(prefix.length)), [{ id: shot.id, name: snapshot.name }]);
  const trace = toolResult("trace", "trace_card");
  assert.equal(trace.source, "implies");
  assert.deepEqual(trace.paths[0].map((node) => node.tag), ["street", "outdoors"]);
  assert.equal(trace.wouldReturn, true);
  const chain = page.locator(".ai-trace");
  await chain.locator('.card[data-tag="street"]').waitFor();
  assert.equal(await chain.locator('.card[data-tag="outdoors"]').count(), 1);
  await say(page, "group");
  assert.equal(toolResult("group", "trace_card").source, "group");
  assert.deepEqual(toolResult("group", "trace_card").groups, ["晚景"]);
  await page.evaluate(() => window.mochi.ban("outdoors"));
  await say(page, "borrow scene");
  const confirm = page.locator(".ai-confirm").last();
  assert.equal(await page.evaluate(() => window.mochi.bans.has("outdoors")), true);
  await confirm.getByRole("button", { name: "套用", exact: true }).click();
  await card(page, "outdoors").waitFor();
  const scene = page.locator('.ai-msg.ai-bot').last().locator(".ai-step").filter({ hasText: "照作品 #s-reference 帶入" });
  await scene.getByRole("button", { name: "復原" }).click();
  await card(page, "outdoors").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => window.mochi.bans.has("outdoors")), true);
  await page.evaluate(() => window.mochi.pin("street"));
  await say(page, "pool trace");
  assert.equal(toolResult("pool trace", "trace_card").inferred, true);
  assert.deepEqual(toolResult("pool trace", "trace_card").returnFrom, ["street"]);

  for (const id of [shot.id, "s-other"]) await page.locator(`#wall .shot[data-id="${id}"] .ai-shot-ref`).press("Enter");
  await say(page, "both");
  const both = sent("both").messages.findLast((m) => m.role === "user").content;
  assert.deepEqual(JSON.parse(both.split("\n").find((row) => row.startsWith(prefix)).slice(prefix.length)).map((work) => work.id), [shot.id, "s-other"]);
});

test("作品冊日期與牌名搜尋，點選結果後帶入完整作品的份量", async (t) => {
  const page = await openPage(t, true);
  await say(page, "find");
  assert.deepEqual(toolResult("find", "find_works").works.map((w) => w.id), [work.id]);
  const result = page.locator(".ai-work-result").filter({ hasText: work.name });
  await result.locator("img").waitFor();
  await result.getByRole("button", { name: "引用這件作品" }).click();
  await page.locator(".ai-refs .ai-ref[data-work-id='album-1']").waitFor();
  await say(page, "album");
  await card(page, "blue eyes").waitFor();
  assert.match(await card(page, "blue eyes").textContent(), /1\.3/);
  assert.equal(await card(page, "street").count(), 0);
});

test("模型可在同一輪選定搜尋結果，借牌時只讀一次完整配方", async (t) => {
  const page = await openPage(t, true);
  const start = requests.length;
  await say(page, "pick");
  assert.deepEqual(toolResult("pick", "use_reference").reference, { id: work.id, sections: ["feature"], count: 1 });
  assert.equal(requests.slice(start).filter((path) => path === `/api/recipes/${work.id}`).length, 1);
  await card(page, "blue eyes").waitFor();
  assert.equal(await card(page, "street").count(), 0);
});
