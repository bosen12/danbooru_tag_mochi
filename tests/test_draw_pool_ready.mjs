/**
 * 第一次抽牌不等尚未建好索引的 worker。
 * worker 索引好了回 { ready: true }；還沒好時 drawInWorker 立刻回 null，暖機照樣送。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// 開源版把 web6/ 合進 web/：兩邊都跑得動。
import { existsSync as hasPath } from "node:fs";
const W = hasPath(new URL("../web6", import.meta.url)) ? "web6" : "web";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerSrc = readFileSync(join(root, W + "/draw-worker.js"), "utf8").replace(/^import .*$/gm, "");

function loadWorker({ fetch, indexLexicon = (x) => x, drawWithSeed }) {
  const posts = [];
  const self = { postMessage(m) { posts.push(m); } };
  const onmessage = new Function(
    "indexLexicon",
    "drawWithSeed",
    "fetch",
    "self",
    workerSrc + "\nreturn self.onmessage;"
  )(indexLexicon, drawWithSeed || (() => ({ positive: "1girl", era: "modern", heat: "", sections: {}, eraClash: [] })), fetch, self);
  return { onmessage, posts };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

{
  let release;
  const gate = new Promise((r) => { release = r; });
  const { onmessage, posts } = loadWorker({
    fetch: () => Promise.resolve({ json: () => gate }),
  });
  const job = onmessage({ data: { id: 7, lexUrl: "http://lex", settings: {}, pins: [], banned: [], seeds: [3] } });
  await flush();
  assert.equal(posts.length, 0, "索引還沒好不能先回 ready");
  release({ tags: [] });
  await job;
  assert.equal(posts.filter((p) => p.ready).length, 1);
  assert.equal(posts.find((p) => p.id === 7)?.out?.[0]?.positive, "1girl");
}

{
  let release;
  const gate = new Promise((r) => { release = r; });
  const { onmessage, posts } = loadWorker({
    fetch: () => Promise.resolve({ json: () => gate }),
  });
  onmessage({ data: { warm: "http://lex" } });
  const job = onmessage({ data: { id: 1, lexUrl: "http://lex", settings: {}, pins: ["red hair"], banned: [], seeds: [1] } });
  await flush();
  assert.equal(posts.length, 0);
  release({ tags: [] });
  await job;
  await flush();
  assert.equal(posts.filter((p) => p.ready).length, 1, "暖機和第一張工作只回一次 ready");
  assert.ok(posts.some((p) => p.id === 1 && p.out));
}

{
  const { onmessage, posts } = loadWorker({
    fetch: () => Promise.reject(new Error("net")),
  });
  await onmessage({ data: { warm: "http://lex" } });
  await flush();
  assert.equal(posts.some((p) => p.ready), false, "索引失敗不要說 ready");
}

const pool = await import("../" + W + "/draw-pool.js");
assert.equal(typeof pool.drawWorkerReady, "function", "draw-pool 要匯出 drawWorkerReady");

const workers = [];
globalThis.Worker = class FakeWorker {
  constructor(url, opts) {
    this.url = String(url);
    this.opts = opts;
    this.sent = [];
    this.terminated = false;
    workers.push(this);
  }
  postMessage(m) { this.sent.push(m); }
  terminate() { this.terminated = true; }
};

assert.equal(pool.drawWorkerReady(), false);
pool.warmDrawWorker("http://lex/lexicon.json");
const worker = workers.at(-1);
assert.ok(worker, "warmDrawWorker 要開 worker");
assert.equal(worker.opts?.type, "module");
assert.ok(worker.sent.some((m) => m.warm === "http://lex/lexicon.json"));
assert.equal(pool.hasDrawWorker(), true);
assert.equal(pool.drawWorkerReady(), false);

{
  let timer;
  const slow = new Promise((r) => { timer = setTimeout(() => r("slow"), 200); });
  const raced = await Promise.race([
    pool.drawInWorker({ settings: {}, pins: [], banned: [], seeds: [1], ifReady: true }),
    slow,
  ]);
  clearTimeout(timer);
  assert.equal(raced, null, "索引還沒好要立刻回 null，不要等逾時");
  assert.equal(worker.sent.some((m) => m.id != null), false, "還沒好不要把這一張抽牌丟進 worker");
  assert.ok(worker.sent.some((m) => m.warm), "暖機照樣送，下一張才走 worker");
}

{
  // 不帶 ifReady（疊印台開頁的試印）：索引還沒好也照舊丟進 worker 等。
  const before = worker.sent.length;
  const pending = pool.drawInWorker({ settings: {}, pins: [], banned: [], seeds: [2] }, 20);
  assert.ok(worker.sent.slice(before).some((m) => m.id != null), "沒帶 ifReady 要照舊送進 worker");
  assert.equal(await pending, null);
}

worker.onmessage({ data: { ready: true } });
assert.equal(pool.drawWorkerReady(), true);

{
  const pending = pool.drawInWorker({ settings: { n: 1 }, pins: ["red hair"], banned: ["blue eyes"], seeds: [9], trace: true }, 40);
  const msg = worker.sent.at(-1);
  assert.equal(msg.seeds[0], 9);
  assert.deepEqual(msg.pins, ["red hair"]);
  assert.equal(msg.trace, true);
  const out = await pending;
  assert.equal(out, null, "ready 之後仍受 timeout 限制");
}

{
  const pending = pool.drawInWorker({ settings: {}, pins: [], banned: [], seeds: [4] });
  const msg = worker.sent.at(-1);
  worker.onmessage({ data: { id: msg.id, out: [{ positive: "solo" }] } });
  assert.deepEqual(await pending, [{ positive: "solo" }]);
}

worker.onerror();
assert.equal(pool.drawWorkerReady(), false, "worker 掛了就要當還沒好");
assert.equal(pool.hasDrawWorker(), false);
assert.equal(await pool.drawInWorker({ settings: {}, pins: [], banned: [], seeds: [1] }), null);

console.log("draw-pool ready: ok");
