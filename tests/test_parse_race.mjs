/**
 * 解析池：連著丟圖只留最後一張、存檔用丟出去當下的快照、
 * 換語言的重載要把這一張還原、一般重新整理仍清掉、
 * 解析請求可中止、秒數每秒跳、讀螢幕的只聽到狀態變了。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// 開源版把 web6/ 合進 web/：兩邊都跑得動。
import { existsSync as hasPath } from "node:fs";
const W = hasPath(new URL("../web6", import.meta.url)) ? "web6" : "web";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, W + "/parse.js"), "utf8");
const html = readFileSync(join(root, W + "/parse.html"), "utf8");
const TAB_KEY = src.match(/const TAB_KEY = "([^"]+)"/)[1];
const SLOW_MS = Number(src.match(/const SLOW_MS = (\d+)/)[1]);
const SLOW_WHY = "ComfyUI 可能正在印別張（等那張印完就輪到），或第一次用這個模型、正在下載。";

function extractFunction(source, name) {
  const found = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  if (!found) return null;
  const start = found.index;
  let i = source.indexOf("{", start);
  if (i < 0) return null;
  let depth = 1;
  i += 1;
  const mode = ["code"];
  while (i < source.length && depth > 0) {
    const c = source[i];
    const top = mode[mode.length - 1];
    if (top === "line") {
      if (c === "\n") mode.pop();
      i += 1;
      continue;
    }
    if (top === "block") {
      if (c === "*" && source[i + 1] === "/") { mode.pop(); i += 2; continue; }
      i += 1;
      continue;
    }
    if (top === "sq" || top === "dq") {
      if (c === "\\") { i += 2; continue; }
      if (c === (top === "sq" ? "'" : '"')) mode.pop();
      i += 1;
      continue;
    }
    if (top === "bt") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { mode.pop(); i += 1; continue; }
      if (c === "$" && source[i + 1] === "{") { mode.push("expr"); i += 2; continue; }
      i += 1;
      continue;
    }
    if (top === "expr") {
      if (c === "'" || c === '"' || c === "`") {
        mode.push(c === "'" ? "sq" : c === '"' ? "dq" : "bt");
        i += 1;
        continue;
      }
      if (c === "{") { mode.push("expr"); i += 1; continue; }
      if (c === "}") { mode.pop(); i += 1; continue; }
      if (c === "/" && source[i + 1] === "/") { mode.push("line"); i += 2; continue; }
      if (c === "/" && source[i + 1] === "*") { mode.push("block"); i += 2; continue; }
      i += 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") { mode.push("line"); i += 2; continue; }
    if (c === "/" && source[i + 1] === "*") { mode.push("block"); i += 2; continue; }
    if (c === "'") { mode.push("sq"); i += 1; continue; }
    if (c === '"') { mode.push("dq"); i += 1; continue; }
    if (c === "`") { mode.push("bt"); i += 1; continue; }
    if (c === "{") { depth += 1; i += 1; continue; }
    if (c === "}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return source.slice(start, i);
      continue;
    }
    i += 1;
  }
  return null;
}

const runSrc = extractFunction(src, "run");
assert.ok(runSrc && runSrc.includes("fetch(") && runSrc.trimEnd().endsWith("}"), "抽不出 run()");

function load(names, extra = {}) {
  const clock = { t: 0 };
  const intervals = [];
  const fetches = [];
  const saves = [];
  const states = [];
  const shown = [];
  const liveNode = { textContent: "" };
  const counts = { status: 0, digest: 0, render: 0 };
  let languageState = extra.languageState ?? null;
  let reloaded = extra.reloaded ?? false;
  const tab = new Map();
  const ctx = {
    TAB_KEY,
    SLOW_MS,
    SEND_EDGE: 1024,
    KEEP_EDGE: 640,
    keep() {},
    shot: null,
    parsed: null,
    off: new Set(),
    trust: "all",
    busy: false,
    job: 0,
    pick: 0,
    tick: 0,
    parseAbort: null,
    savedGen: 0,
    liveText: "",
    AbortController,
    performance: { now: () => clock.t },
    setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval() {},
    toast() {},
    el(tag, attrs, ...kids) { return { tag, attrs, kids }; },
    status() { counts.status += 1; },
    setState(s) { states.push(s); },
    showShot() { shown.push(ctx.shot?.url || null); },
    digest() { counts.digest += 1; },
    paintStatus() {},
    render() { counts.render += 1; },
    // 換圖時收掉上一張的牌（第六輪：第二張解析失敗時，畫面還留著第一張的牌、點了整頁報錯）。
    clearResults() { counts.clear = (counts.clear || 0) + 1; ctx.cleared = ctx.parsed; },
    tagger: () => ({ model: "m" }),
    friendlyError: (e) => e?.message || "解析失敗",
    sfx: { fail() {} },
    $: (id) => (id === "parse-live" ? liveNode : { replaceChildren() {} }),
    takeLanguageState: () => languageState,
    sessionStorage: { removeItem: (k) => tab.delete(k) },
    S: {
      reloaded: () => reloaded,
      saveTab: (_k, v) => saves.push(v),
      loadTab: (k) => (reloaded ? null : tab.get(k) ?? null),
    },
    fetch(url, opts) {
      const slot = { url, opts };
      fetches.push(slot);
      slot.done = new Promise((resolve, reject) => {
        slot.resolve = resolve;
        slot.reject = reject;
      });
      opts?.signal?.addEventListener("abort", () => {
        slot.reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
      return slot.done;
    },
    shrink: async (_blob, edge) => ({ url: "data:small:" + edge, w: 4, h: 4 }),
    PARSE_TAB: "tab-test",
  };
  if (extra.shrink) ctx.shrink = extra.shrink;
  const parts = [];
  // abortParse／announce／rememberUnresolved 是後來才加的小幫手：有就一起載（run 會叫 rememberUnresolved）。
  const helpers = ["abortParse", "announce", "rememberUnresolved"];
  for (const name of [...helpers, ...names]) {
    if (names.includes(name) || helpers.includes(name)) {
      const body = extractFunction(src, name);
      if (body) parts.push(body);
      else if (names.includes(name)) throw new Error("找不到 " + name);
    }
  }
  // names 裡的函式一定要有；abortParse／announce 是後來才加的，沒有就先跳過。
  const wanted = names.filter((n) => !parts.some((p) => p.startsWith("function " + n) || p.startsWith("async function " + n) || p.includes("function " + n + "(")));
  for (const name of wanted) {
    const body = extractFunction(src, name);
    if (!body) throw new Error("找不到 " + name);
    if (!parts.includes(body)) parts.push(body);
  }
  vm.createContext(ctx);
  vm.runInContext(parts.join("\n") + `\nthis.api = { ${names.join(", ")} };`, ctx);
  return { ctx, clock, intervals, fetches, saves, states, shown, liveNode, counts, tab, setReloaded: (v) => { reloaded = v; }, setLanguage: (v) => { languageState = v; } };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const failures = [];
async function check(name, fn) {
  try { await fn(); }
  catch (err) { failures.push(name + "\n  " + (err && err.stack ? err.stack : err)); }
}

await check("慢的縮圖不能蓋掉後來那張", async () => {
  const pending = [];
  const h = load(["take", "run", "keep"], {
    shrink: (blob) => new Promise((resolve) => pending.push({ blob, resolve })),
  });
  const a = { type: "image/png", name: "a.png" };
  const b = { type: "image/png", name: "b.png" };
  const ta = h.ctx.api.take(a);
  const tb = h.ctx.api.take(b);
  assert.equal(pending.length, 2);
  pending[1].resolve({ url: "data:b.png", w: 2, h: 3 });
  await tb;
  pending[0].resolve({ url: "data:a.png", w: 9, h: 9 });
  await ta;
  assert.equal(h.ctx.shot.url, "data:b.png");
  assert.equal(h.ctx.shot.name, "b.png");
  assert.ok(h.counts.clear >= 1, "換了圖就收掉上一張的牌、張數、帶走列");
  assert.equal(h.ctx.cleared, null, "收的時候 parsed 已經清成 null（之後只會照新圖重畫）");
  assert.deepEqual(h.shown, ["data:b.png"]);
  assert.equal(h.fetches.length, 1);
  assert.equal(JSON.parse(h.fetches[0].opts.body).image, "data:b.png");
});

await check("解析結果只寫回還在畫面上的那張", async () => {
  const h = load(["take", "run", "keep"]);
  h.ctx.shot = { url: "data:a", w: 1, h: 1 };
  const p = h.ctx.api.run();
  await tick();
  const body = JSON.parse(h.fetches[0].opts.body);
  assert.equal(body.image, "data:a");
  h.ctx.shot = { url: "data:b", w: 2, h: 2 };
  h.fetches[0].resolve({
    ok: true,
    json: async () => ({ ok: true, tags: [{ tag: "from-a", sure: true }], settings: { model: "m" } }),
  });
  await p;
  assert.equal(h.ctx.shot.tags, undefined);
  assert.equal(h.counts.digest, 0);
});

await check("存檔用開始存的那一份，不讀之後才改的 shot", async () => {
  const h = load(["keep"]);
  h.ctx.shot = { url: "data:a", w: 11, h: 22, tags: ["a"], settings: { model: "m" }, secs: 1.5 };
  h.ctx.off = new Set(["x"]);
  h.ctx.trust = "all";
  const p = h.ctx.api.keep();
  await tick();
  h.ctx.shot.w = 99;
  h.ctx.shot.tags = ["mutated"];
  h.ctx.off = new Set(["y"]);
  h.fetches[0].resolve({ blob: async () => ({}) });
  await p;
  assert.equal(h.saves.length, 1);
  assert.equal(h.saves[0].w, 11);
  assert.deepEqual(h.saves[0].tags, ["a"]);
  // off 是函式裡複製的陣列，生在 vm 裡，跟測試這邊的 Array 不是同一個領域。
  assert.deepEqual([...h.saves[0].off], ["x"]);
  assert.equal(h.saves[0].url, "data:small:640");
  assert.equal(h.ctx.shot.small, "data:small:640");
});

await check("後一次存檔蓋過還在縮圖的前一次，換一張之後不寫到新的 shot", async () => {
  const h = load(["keep"]);
  h.ctx.shot = { url: "data:a", w: 1, h: 1, tags: ["a"], settings: {}, secs: 1 };
  h.ctx.off = new Set(["1"]);
  const p1 = h.ctx.api.keep();
  await tick();
  h.ctx.off = new Set(["2"]);
  const p2 = h.ctx.api.keep();
  await tick();
  h.fetches[0].resolve({ blob: async () => ({}) });
  await p1;
  assert.equal(h.ctx.shot.small, undefined);
  assert.equal(h.saves.length, 0);
  h.fetches[1].resolve({ blob: async () => ({}) });
  await p2;
  assert.equal(h.ctx.shot.small, "data:small:640");
  assert.equal(h.saves.length, 1);
  assert.deepEqual([...h.saves[0].off], ["2"]);

  const h2 = load(["keep"]);
  const old = { url: "data:a", w: 1, h: 1, tags: ["a"], settings: {}, secs: 1 };
  h2.ctx.shot = old;
  h2.ctx.off = new Set();
  const p = h2.ctx.api.keep();
  await tick();
  h2.ctx.shot = { url: "data:b", w: 2, h: 2, tags: ["b"], settings: {}, secs: 2 };
  h2.fetches[0].resolve({ blob: async () => ({}) });
  await p;
  assert.equal(h2.ctx.shot.small, undefined);
  assert.equal(old.small, undefined);
  assert.equal(h2.saves.length, 0);
});

// 2026-11-20 第五輪檢查：新圖要先確認解得開，才停掉上一張（以前一換就先中止，換到壞圖時請求沒了、畫面停在掃描）。
await check("換一張：新圖解出來才中止上一張的請求，不叫全域中斷", async () => {
  const pending = [];
  const h = load(["take", "run", "keep"], {
    shrink: (blob) => new Promise((resolve) => pending.push({ blob, resolve })),
  });
  h.ctx.shot = { url: "data:old", w: 1, h: 1 };
  const first = h.ctx.api.run();
  await tick();
  const signal = h.fetches[0].opts.signal;
  assert.ok(signal, "parse POST 要帶 AbortSignal");
  const second = h.ctx.api.take({ type: "image/png", name: "b.png" });
  await tick();
  assert.equal(signal.aborted, false, "新圖還沒解出來，上一張照跑");
  pending[0].resolve({ url: "data:b.png", w: 1, h: 1 });
  await second;
  assert.equal(signal.aborted, true, "新圖解出來了，上一張中止");
  assert.ok(!h.fetches.some((f) => String(f.url).includes("interrupt")));
  assert.ok(!/\/api\/interrupt/.test(src));
  await first;
  assert.ok(!h.states.includes("error"), "中止的那一輪不要顯示失敗");
  assert.equal(h.ctx.shot.url, "data:b.png");
});

await check("秒數每秒跳一次，讀螢幕的只在狀態變時出聲", async () => {
  const h = load(["run"]);
  h.ctx.shot = { url: "data:a", w: 1, h: 1 };
  const p = h.ctx.api.run();
  await tick();
  assert.equal(h.intervals.length, 1);
  assert.equal(h.intervals[0].ms, 1000);
  assert.equal(h.liveNode.textContent, "解析中…");
  const before = h.counts.status;
  h.intervals[0].fn();
  h.intervals[0].fn();
  assert.ok(h.counts.status > before, "畫面的秒數仍要更新");
  assert.equal(h.liveNode.textContent, "解析中…");
  h.clock.t = SLOW_MS;
  h.intervals[0].fn();
  assert.equal(h.liveNode.textContent, SLOW_WHY);
  h.fetches[0].resolve({
    ok: true,
    json: async () => ({ ok: true, tags: [{ tag: "red hair", sure: true }], settings: {} }),
  });
  await p;
  assert.equal(h.liveNode.textContent, "認出 1 個字");
});

await check("失敗會說一聲，成功的那張標籤寫得回去", async () => {
  const h = load(["run", "keep"]);
  h.ctx.shot = { url: "data:a", w: 1, h: 1 };
  const bad = h.ctx.api.run();
  await tick();
  h.fetches[0].resolve({ ok: false, json: async () => ({ ok: false, error: "解析失敗" }) });
  await bad;
  assert.ok(h.states.includes("error"));
  assert.equal(h.liveNode.textContent, "解析失敗");

  const h2 = load(["run", "keep"]);
  h2.ctx.shot = { url: "data:a", w: 1, h: 1 };
  const ok = h2.ctx.api.run();
  await tick();
  h2.fetches[0].resolve({
    ok: true,
    json: async () => ({ ok: true, tags: [{ tag: "red hair", sure: true }], settings: { model: "m" } }),
  });
  await ok;
  assert.equal(h2.ctx.shot.tags[0].tag, "red hair");
  assert.equal(h2.ctx.shot.settings.model, "m");
  assert.equal(h2.counts.digest, 1);
});

await check("換語言的重載還原解析池，一般重新整理仍清掉", async () => {
  assert.match(src, /mochi:before-language-change/);
  assert.match(src, /takeLanguageState\(/);
  const h = load(["restore", "languageSnapshot", "onLanguageChange", "keep", "run"]);
  h.ctx.shot = { url: "data:big", small: "data:small", w: 3, h: 4, tags: ["a"], settings: { model: "m" }, secs: 2 };
  h.ctx.off = new Set(["z"]);
  h.ctx.trust = "sure";
  const event = { detail: { state: null } };
  h.ctx.api.onLanguageChange(event);
  assert.equal(event.detail.state.url, "data:small");
  assert.deepEqual(event.detail.state.tags, ["a"]);
  assert.deepEqual([...event.detail.state.off], ["z"]);
  assert.equal(event.detail.state.trust, "sure");
  h.ctx.shot = null;
  const empty = { detail: { state: "stay" } };
  h.ctx.api.onLanguageChange(empty);
  assert.equal(empty.detail.state, null);

  h.setReloaded(true);
  h.tab.set(TAB_KEY, { url: "data:tab", tags: ["old"], at: Date.now(), w: 1, h: 1 });
  h.setLanguage(null);
  h.ctx.api.restore();
  assert.equal(h.ctx.shot, null);
  assert.equal(h.tab.has(TAB_KEY), false);
  assert.equal(h.states.at(-1), "empty");

  const h2 = load(["restore", "languageSnapshot", "onLanguageChange", "keep", "run"]);
  h2.setReloaded(true);
  h2.setLanguage({
    url: "data:img", w: 10, h: 20, tags: ["red hair"], off: ["blue eyes"], trust: "sure", settings: { model: "m" }, secs: 1.2,
  });
  h2.ctx.api.restore();
  assert.equal(h2.ctx.shot.url, "data:img");
  assert.deepEqual(h2.ctx.shot.tags, ["red hair"]);
  assert.ok(h2.ctx.off.has("blue eyes"));
  assert.equal(h2.ctx.trust, "sure");
  assert.equal(h2.counts.digest, 1);
  assert.ok(h2.saves.length >= 1, "還原之後要寫回這個分頁，換頁再回來還在");
  assert.equal(h2.saves.at(-1).url, "data:img");

  const h3 = load(["restore", "languageSnapshot", "onLanguageChange", "keep", "run"]);
  h3.setReloaded(false);
  h3.tab.set(TAB_KEY, { url: "data:tab", tags: ["a"], off: [], trust: "all", at: Date.now(), w: 8, h: 9, settings: {}, secs: 1 });
  h3.setLanguage(null);
  h3.ctx.api.restore();
  assert.equal(h3.ctx.shot.url, "data:tab");
  assert.equal(h3.counts.digest, 1);

  const h4 = load(["restore", "languageSnapshot", "onLanguageChange", "keep", "run"]);
  h4.setReloaded(false);
  h4.tab.set(TAB_KEY, { url: "data:old", tags: ["a"], at: Date.now() - 31 * 60 * 1000, w: 1, h: 1 });
  h4.setLanguage(null);
  h4.ctx.api.restore();
  assert.equal(h4.ctx.shot, null);
  assert.equal(h4.states.at(-1), "empty");

  const h5 = load(["restore", "languageSnapshot", "onLanguageChange", "keep", "run"]);
  h5.setReloaded(true);
  h5.setLanguage({ url: "data:half", tags: null, off: [], trust: "all", w: 1, h: 1 });
  const beforeFetch = h5.fetches.length;
  const pending = h5.ctx.api.restore();
  await tick();
  assert.equal(h5.ctx.shot.url, "data:half");
  assert.equal(h5.counts.digest, 0);
  assert.ok(h5.fetches.length > beforeFetch, "換語言時還沒解析完的圖要接著解析");
  h5.fetches.at(-1).resolve({ ok: false, json: async () => ({ ok: false, error: "停" }) });
  await pending;
});

await check("狀態區不再自己朗讀，另有一個只報狀態的區域", async () => {
  const tag = html.match(/<div class="parse-status"[^>]*>/)[0];
  assert.ok(!/aria-live|role=/.test(tag), tag);
  assert.match(html, /id="parse-live"[^>]*aria-live="polite"/);
});

if (failures.length) {
  console.error(failures.join("\n\n"));
  console.error("\n" + failures.length + " failed");
  process.exit(1);
}
console.log("parse race: ok");
