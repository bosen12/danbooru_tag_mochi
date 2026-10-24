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
    if (!opts.method) return { ok: true, json: async () => (server.file ? { tags: server.file, saved: true, at: 1 } : { tags: [], saved: false, at: 0 }) };
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

test("normal sync still sends only the change and adopts the server list", async () => {
  const w = world({ local: ["yor briar"], synced: true, file: ["yor briar", "frieren"] });
  const fav = await load();
  await settle();
  assert.deepEqual(w.local(), ["yor briar", "frieren"], "another device added frieren");
  fav.add("tatsumaki");
  await settle();
  assert.deepEqual(w.server.file, ["tatsumaki", "yor briar", "frieren"]);
});
