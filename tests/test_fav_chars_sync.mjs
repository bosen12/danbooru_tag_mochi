// 偏好角色跟伺服器同步（web6/fav-chars.js、card_decks.save_fav_chars）。
// 2026-10-21：換了一份資料夾跑伺服器（那份沒有 fav_chars.json），這台瀏覽器以前已經對過一次，
// 就只送了新加的兩位；伺服器建了一份只有那兩位的名單，回來把這台整份名單蓋掉。這裡用假的伺服器重演那幾種情況。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(spec, ctx, next) {
  if (ctx.parentURL && ctx.parentURL.includes("/web6/") && (spec.startsWith("./") || spec.startsWith("../"))) {
    const u = new URL(spec, ctx.parentURL);
    if (u.protocol === "file:" && !existsSync(fileURLToPath(u))) return next(u.href.replace("/web6/", "/web/"), ctx);
  }
  return next(spec, ctx);
}`)
);

const dir = existsSync(new URL("../web6/fav-chars.js", import.meta.url)) ? "../web6/" : "../web/";
// 等到「一段時間沒有請求」才算安靜：push 等 250ms 才送，伺服器回 fresh 時還會再送一次（再等 250ms）。
// 以前固定等 300ms，CI 的機器慢一點，第二次送就跑到下一個測試裡去了（2026-10-24：GitHub Actions 每次都紅）。
let inflight = 0;
let lastActivity = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => {
  const start = Date.now();
  lastActivity = Date.now();
  while (Date.now() - start < 8000) {
    await sleep(50);
    if (inflight === 0 && Date.now() - lastActivity > 700) return;
  }
};

/** 一台瀏覽器（localStorage）＋一個伺服器（file＝null 表示沒有檔案），照 card_decks.save_fav_chars 的規則回。 */
function world({ local, synced, file }) {
  const store = new Map();
  store.set("mochi.fav.chars.v1", JSON.stringify(local));
  if (synced) store.set("mochi.fav.chars.synced", "1");
  const server = { file };
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  globalThis.addEventListener = () => {};
  // readyState loading：i18n.js 等 DOMContentLoaded 才開始翻譯（這裡不會來），不去碰不存在的畫面。
  globalThis.document = { hidden: false, readyState: "loading", addEventListener() {}, querySelector: () => null, getElementById: () => null };
  globalThis.fetch = async (url, opts = {}) => {
    lastActivity = Date.now();
    inflight++;
    try {
      return await answer(url, opts);
    } finally {
      inflight--;
      lastActivity = Date.now();
    }
  };
  const answer = async (url, opts) => {
    if (!String(url).startsWith("/api/fav-chars")) return { ok: false, json: async () => ({}) };
    if (!opts.method) {
      if (server.gate) await server.gate;
      return { ok: true, json: async () => (server.file ? { tags: server.file, saved: true, at: 1 } : { tags: [], saved: false, at: 0 }) };
    }
    const p = JSON.parse(opts.body);
    let fresh = false;
    if (Array.isArray(p.add) || Array.isArray(p.remove)) {
      fresh = !server.file;
      const have = server.file || [];
      const gone = new Set(p.remove || []);
      const added = (p.add || []).filter((t) => !gone.has(t));
      server.file = [...new Set([...added, ...have.filter((t) => !gone.has(t))])];
    } else server.file = [...new Set(p.tags)];
    return { ok: true, json: async () => ({ tags: server.file, saved: true, at: 2, ...(fresh ? { fresh: true } : {}) }) };
  };
  return { store, server, local: () => JSON.parse(store.get("mochi.fav.chars.v1") || "[]") };
}

let n = 0;
const load = async () => (await import(new URL(dir + "fav-chars.js?case=" + ++n, import.meta.url))).favChars;

test("server never saved, this browser already synced once: the whole list goes up first", async () => {
  const w = world({ local: ["yor briar", "tatsumaki", "mount lady"], synced: true, file: null });
  const fav = await load();
  await settle();
  assert.deepEqual(w.server.file, ["yor briar", "tatsumaki", "mount lady"]);
  fav.add("android 18");
  await settle();
  assert.deepEqual(new Set(w.server.file), new Set(["android 18", "yor briar", "tatsumaki", "mount lady"]));
  assert.deepEqual(new Set(w.local()), new Set(w.server.file), "nothing was lost in the browser");
});

test("server file disappears while the page is open: adding still keeps the whole list (fresh)", async () => {
  const w = world({ local: ["yor briar", "tatsumaki"], synced: true, file: ["yor briar", "tatsumaki"] });
  const fav = await load();
  await settle();
  w.server.file = null; // 換了資料夾、檔案被刪
  fav.add("hado nejire");
  await settle();
  assert.deepEqual(new Set(w.server.file), new Set(["hado nejire", "yor briar", "tatsumaki"]));
  assert.deepEqual(new Set(w.local()), new Set(w.server.file));
});

test("tapping a heart before the first pull returns does not wipe what another device added", async () => {
  // 手機上次只對到 A；電腦後來加了 B。手機重開卡冊、名單還在路上就替 C 按愛心（第五輪 Astra 找到：以前整份 [C, A] 蓋掉 B）。
  const w = world({ local: ["yor briar"], synced: true, file: ["yor briar", "frieren"] });
  let open;
  w.server.gate = new Promise((r) => (open = r));
  const fav = await load();
  fav.add("tatsumaki");
  await sleep(50);
  open();
  w.server.gate = null;
  await settle();
  assert.deepEqual(new Set(w.server.file), new Set(["tatsumaki", "yor briar", "frieren"]));
  assert.deepEqual(new Set(w.local()), new Set(w.server.file));
});

test("normal sync still sends only the change and adopts the server list", async () => {
  const w = world({ local: ["yor briar"], synced: true, file: ["yor briar", "frieren"] });
  const fav = await load();
  await settle();
  assert.deepEqual(w.local(), ["yor briar", "frieren"], "another device added frieren");
  fav.add("tatsumaki");
  await settle();
  assert.deepEqual(w.server.file, ["tatsumaki", "yor briar", "frieren"]);
});

// ---------- 偏好卡牌（hand-store.js，2026-11-18 改成伺服器共用）：同一套同步，多一個順序 ----------
/** 跟 card_decks._save_list 一樣的規則（add／remove／order，或整份 tags）。 */
function handWorld({ local, synced, file, fuse }) {
  const w = world({ local: [], synced: false, file: null });
  w.store.delete("mochi.fav.chars.v1");
  w.store.set("mochi.hand.v1", JSON.stringify(local));
  if (synced) w.store.set("mochi.hand.synced", "1");
  if (fuse) w.store.set("mochi.fuse.hand.v1", JSON.stringify(fuse));
  const server = { file, posts: [] };
  const plain = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith("/api/fav-hand")) return plain(url, opts);
    lastActivity = Date.now();
    inflight++;
    try {
      if (!opts.method) return { ok: true, json: async () => (server.file ? { tags: server.file, saved: true, at: 1 } : { tags: [], saved: false, at: 0 }) };
      const p = JSON.parse(opts.body);
      server.posts.push(p);
      let fresh = false;
      if (Array.isArray(p.add) || Array.isArray(p.remove) || Array.isArray(p.order)) {
        fresh = !server.file;
        const have = server.file || [];
        const gone = new Set(p.remove || []);
        const added = (p.add || []).filter((t) => !gone.has(t));
        let tags = [...new Set([...added, ...have.filter((t) => !gone.has(t))])];
        if (Array.isArray(p.order) && p.order.length) {
          const rank = new Map(p.order.map((t, i) => [t, i]));
          tags = [...tags.filter((t) => !rank.has(t)), ...tags.filter((t) => rank.has(t)).sort((a, b) => rank.get(a) - rank.get(b))];
        }
        server.file = tags;
      } else server.file = [...new Set(p.tags)];
      return { ok: true, json: async () => ({ tags: server.file, saved: true, at: 2, ...(fresh ? { fresh: true } : {}) }) };
    } finally {
      inflight--;
      lastActivity = Date.now();
    }
  };
  return { ...w, server, hand: () => JSON.parse(w.store.get("mochi.hand.v1") || "[]") };
}
const loadHand = async () => await import(new URL(dir + "hand-store.js?case=" + ++n, import.meta.url));

test("hand: the first sync merges this browser's cards into the server list (both kept)", async () => {
  const w = handWorld({ local: ["red hair", "kimono"], synced: false, file: ["smile"] });
  await loadHand();
  await settle();
  assert.deepEqual(w.server.file, ["smile", "red hair", "kimono"]);
  assert.deepEqual(w.hand(), ["smile", "red hair", "kimono"]);
});

test("hand: reordering sends the order; a card another device just added stays (first)", async () => {
  const w = handWorld({ local: ["a1", "b1", "c1"], synced: true, file: ["a1", "b1", "c1"] });
  const { handStore } = await loadHand();
  await settle();
  w.server.file = ["d1", "a1", "b1", "c1"]; // 手機剛加了 d1，這台還不知道
  handStore.set(["c1", "a1", "b1"]);
  await settle();
  assert.deepEqual(w.server.file, ["d1", "c1", "a1", "b1"]);
  assert.deepEqual(w.hand(), ["d1", "c1", "a1", "b1"], "this browser picks up d1 too");
});

test("hand: a new card goes to the end, the same on the server", async () => {
  const w = handWorld({ local: ["a1", "b1"], synced: true, file: ["a1", "b1"] });
  const { handStore } = await loadHand();
  await settle();
  handStore.add("e1");
  await settle();
  assert.deepEqual(w.hand(), ["a1", "b1", "e1"]);
  assert.deepEqual(w.server.file, ["a1", "b1", "e1"]);
});

test("hand: the Fuse Bed's old separate list is merged in once and its key removed", async () => {
  const w = handWorld({ local: ["a1"], synced: true, file: ["a1"], fuse: ["a1", "z1"] });
  const { handStore, mergeLegacyHand } = await loadHand();
  await settle();
  assert.equal(mergeLegacyHand("mochi.fuse.hand.v1"), 1);
  await settle();
  assert.deepEqual(handStore.list(), ["a1", "z1"]);
  assert.deepEqual(w.server.file, ["a1", "z1"]);
  assert.equal(w.store.has("mochi.fuse.hand.v1"), false);
});

// ---------- 群組勾選（group-picks-sync.js）：所有裝置共用一份，最後存的算 ----------
function picksWorld({ file, saved = !!file }) {
  world({ local: [], synced: false, file: null });
  const server = { file, saved, posts: [] };
  globalThis.fetch = async (url, opts = {}) => {
    lastActivity = Date.now();
    inflight++;
    try {
      if (!String(url).startsWith("/api/group-picks")) return { ok: false, json: async () => ({}) };
      if (!opts.method) return { ok: true, json: async () => ({ picks: server.file || {}, saved: server.saved, at: 1 }) };
      const p = JSON.parse(opts.body);
      server.posts.push(p);
      server.file = p.picks;
      server.saved = true;
      return { ok: true, json: async () => ({ picks: server.file, saved: true, at: 2 }) };
    } finally {
      inflight--;
      lastActivity = Date.now();
    }
  };
  return server;
}
const loadPicks = async () => await import(new URL(dir + "group-picks-sync.js?case=" + ++n, import.meta.url));

test("group picks: another device's ticks replace this browser's", async () => {
  const server = picksWorld({ file: { feature: { ids: ["g-aaaa"], mode: "whole" } } });
  const { syncGroupPicks } = await loadPicks();
  let local;
  syncGroupPicks({ get: () => local, apply: (p) => (local = p) });
  await settle();
  assert.deepEqual(local, { feature: { ids: ["g-aaaa"], mode: "whole" } });
  assert.equal(server.posts.length, 0, "nothing sent back");
});

test("group picks: the server never saved any: this browser's ticks go up", async () => {
  const server = picksWorld({ file: null });
  const { syncGroupPicks } = await loadPicks();
  const local = { clothing: { ids: ["g-bbbb", "g-cccc"], mode: "mix" } };
  syncGroupPicks({ get: () => local, apply: () => assert.fail("must not replace") });
  await settle();
  assert.deepEqual(server.file, local);
});

test("group picks: ticking here sends the whole set; ticking before the server answered wins", async () => {
  const server = picksWorld({ file: { env: { ids: ["g-old1"], mode: "whole" } } });
  const { syncGroupPicks } = await loadPicks();
  let local = { pose: { ids: ["g-new1"], mode: "whole" } };
  const sync = syncGroupPicks({ get: () => local, apply: (p) => (local = p) });
  sync.push(); // 伺服器那份還沒回來就勾了
  await settle();
  assert.deepEqual(server.file, { pose: { ids: ["g-new1"], mode: "whole" } });
  assert.deepEqual(local, { pose: { ids: ["g-new1"], mode: "whole" } }, "not flipped back to the old server copy");
  local = {};
  sync.push();
  await settle();
  assert.deepEqual(server.file, {}, "unticking everything is saved too");
});
