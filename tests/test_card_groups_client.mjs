import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
// 開源版把 web6/ 合進 web/：兩邊都跑得動。
import { existsSync as hasPath } from "node:fs";
const W = hasPath(new URL("../web6", import.meta.url)) ? "web6" : "web";
const { resolveGroupPools, withGroupPools, loadGroups, freshGroups, saveGroup, cachedGroups, pickOf } = await import("../" + W + "/card-groups.js");
const groups = [
  { id: "a", section: "feature", name: "A", tags: ["a"] },
  { id: "b", section: "feature", name: "B", tags: ["b"] },
  { id: "c", section: "clothing", name: "C", tags: ["c"] },
];
const settings = { groups: { feature: { ids: ["a", "b"], mode: "whole" }, clothing: { ids: ["c"] } } };
for (let seed = 0; seed < 100; seed++) {
  const opts = { usable: t => t === "b" };
  assert.deepEqual(resolveGroupPools(settings, groups, seed, opts).groupIds.feature, ["b"]);
  assert.deepEqual(resolveGroupPools(settings, groups, seed, opts), resolveGroupPools(settings, groups, seed, opts));
}
assert.deepEqual(resolveGroupPools(settings, groups, 1, { usable: () => false }).groupPools, {});
assert.deepEqual(withGroupPools({ groups: { feature: { ids: ["b"] } } }, groups, 1, { only: { feature: ["a"] } }).groupIds, { feature: ["a"] });
assert.deepEqual(withGroupPools({}, groups, 1, { only: { feature: ["a", "b"] } }).groupIds, { feature: ["a", "b"] });
assert.deepEqual(resolveGroupPools(settings, groups, 1, { feature: ["a"] }).groupIds.feature, ["a"]);
assert.deepEqual(resolveGroupPools({ groups: { feature: { ids: ["b"] } } }, groups, 1, { keep: { feature: ["a"] } }).groupIds.feature, ["b"]);
assert.deepEqual(resolveGroupPools(settings, groups, 1, { only: { feature: ["a", "gone"] } }).groupIds, { feature: ["a"] });
assert.deepEqual(resolveGroupPools({ groups: { feature: { ids: ["a", "b"], mode: "mix" } } }, groups, 1, { usable: () => false }).groupPools.feature, ["a", "b"]);
assert.deepEqual(withGroupPools({ ...settings, groupPools: { feature: ["old"] } }, groups, 1, { only: {} }).groupPools, {});
let calls = 0, release;
globalThis.fetch = () => { calls++; return new Promise(r => release = () => r({ ok: true, json: async () => ({ groups }) })); };
const one = loadGroups(); const two = loadGroups();
assert.equal(calls, 1); release(); await Promise.all([one, two]);
await freshGroups(10000); assert.equal(calls, 1);
globalThis.fetch = async () => { throw new Error("offline"); };
assert.equal(await freshGroups(-1), cachedGroups());
for (const status of [404, 409]) {
  let reads = 0;
  globalThis.fetch = async (url, opts) => opts?.method ? { ok: false, status, json: async () => ({ error: "bad", code: "stale", bad: ["a"] }) } : (reads++, { ok: true, json: async () => ({ groups: [] }) });
  await assert.rejects(saveGroup(groups[0]), e => e.status === status && e.code === "stale" && e.bad[0] === "a");
  assert.equal(reads, 1); assert.deepEqual(cachedGroups(), []);
}
console.log("all ok: group selection, cache, write errors");

// 書架以最小畫面替身測真正事件與延遲回應，不依賴瀏覽器。
// 只認得「.class」和「.class[data-id="x"]」；夠書架、標頭用（patchShelf／patchHead 換掉其中幾塊）。
const matches = (node, selector) => {
  const [, name, id] = /^\.([\w-]+)(?:\[data-id="([^"]*)"\])?/.exec(selector.trim()) || [];
  return !!name && !!node.class?.split(" ").includes(name) && (id === undefined || node.dataset.id === id);
};
class Node {
  constructor(tag, attrs = {}, children = []) {
    Object.assign(this, attrs);
    this.tag = tag;
    this.dataset ||= {};
    this.replaceChildren(children);
  }
  replaceChildren(...children) {
    this.children = children.flat(Infinity).filter(x => x != null);
    for (const c of this.children) if (c instanceof Node) c.parent = this;
  }
  append(node) { this.children.push(node); if (node instanceof Node) node.parent = this; }
  addEventListener(type, fn) { this[`on${type}`] = fn; }
  setAttribute(key, value) { this[key] = value; }
  getAttribute(key) { return this[key]; }
  click() { return this.onclick?.({ currentTarget: this }); }
  removeAttribute(key) { delete this[key]; }
  get className() { return this.class || ""; }
  get classList() { return { contains: (c) => this.className.split(" ").includes(c) }; }
  get childElementCount() { return this.children.filter(c => c instanceof Node).length; }
  // 內容一樣就一樣（事件處理器不算）：標頭拿它判斷哪一塊要換。
  get outerHTML() {
    const attrs = Object.entries(this).filter(([k, v]) => !["children", "parent", "tag"].includes(k) && typeof v !== "function").map(([k, v]) => `${k}=${JSON.stringify(v)}`);
    return `<${this.tag} ${attrs.join(" ")}>${this.children.map(c => c instanceof Node ? c.outerHTML : String(c)).join("")}</${this.tag}>`;
  }
  before(node) { const a = this.parent.children; a.splice(a.indexOf(this), 0, node); node.parent = this.parent; }
  remove() { const a = this.parent?.children; if (a) a.splice(a.indexOf(this), 1); this.parent = null; }
  replaceWith(node) { const a = this.parent.children; a[a.indexOf(this)] = node; node.parent = this.parent; this.parent = null; }
  querySelector(selector) {
    for (const node of this.children) {
      if (!(node instanceof Node)) continue;
      if (selector.split(",").some(s => matches(node, s))) return node;
      const found = node.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (!(c instanceof Node)) continue;
        if (selector.split(",").some(s => matches(c, s))) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  focus() {}
  select() {}
  scrollIntoView() {}
}
const head = new Node("div"), shelf = new Node("div"), body = new Node("body");
let store = [{ id: "g-a", name: "長相 A", section: "feature", tags: [], updatedAt: 1 }];
const subscribers = [], writes = [], messages = [];
let navigations = 0;
const cards = ["a", "b"].map(tag => ({ tag, zh: tag, item: { section: "feature" } }));
const context = {
  document: { body, documentElement: new Node("html"), getElementById: id => id === "book-shelf" ? shelf : head },
  localStorage: { getItem: () => "0" }, CSS: { escape: x => x },
  el: (tag, attrs, ...children) => new Node(tag, attrs, children),
  cachedGroups: () => store, loadGroups: async () => store,
  onGroupsChange: fn => subscribers.push(fn),
  saveGroup: group => new Promise((resolve, reject) => writes.push({ group, reject, finish() {
    store = store.map(g => g.id === group.id ? { ...group, updatedAt: g.updatedAt + 1 } : g);
    subscribers.forEach(fn => fn()); resolve(store.find(g => g.id === group.id));
  } })),
  deleteGroup: async () => {}, GROUP_SECTIONS: ["feature"],
  SECTION_ZH: { feature: "長相" }, SECTION_SUIT: { feature: "look" },
  english: false, tr: x => x, toast: x => messages.push(x), friendlyError: e => e.message,
  reducedMotion: () => true, swapIn() {}, seat() {}, enter() {}, refuse() {}, setTimeout, clearTimeout,
  groupChips: () => [], groupSlotKey: () => "slot", history: { replaceState() {} }, location: {},
};
const source = readFileSync(new URL("../" + W + "/book-groups.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?$/gm, "").replace("export function mountBookGroups", "function mountBookGroups");
vm.runInNewContext(source + "\nglobalThis.mount = mountBookGroups;", context);
let gridRenders = 0;
const book = context.mount({ lib: { cards, byTag: new Map(cards.map(c => [c.tag, c])) }, assets: { art: () => null }, visible: () => true, onChange() { gridRenders++; }, toMochi: () => navigations++ });
await book.openFromHash("#groups=g-a");
await head.querySelector(".bsh-edit").onclick();
const tick = async () => { for (let n = 0; n < 15; n++) await Promise.resolve(); };
const gridBefore = gridRenders;
const nameBefore = head.querySelector(".bsh-name");
book.toggle(cards[0]); await tick();
book.toggle(cards[1]); await tick();
assert.equal(writes.length, 1);
assert.equal(book.has("b"), true);
assert.equal(head.querySelector(".bsh-save").children[0], "已儲存", "存得快：不跳「儲存中…」（存超過 400ms 才寫）");
const done = head.querySelector(".bsh-edit").onclick();
await tick(); assert.equal(book.editing(), true);
writes[0].finish(); await tick();
assert.equal(book.has("b"), true, "舊回應不能抹掉新蓋的章");
assert.equal(gridRenders, gridBefore, "加牌模式裡存好：牌格不重畫（章已經蓋好）");
assert.equal(head.querySelector(".bsh-name"), nameBefore, "標頭沒有整個重做（名字欄還是同一個）");
assert.equal(head.querySelector(".bsh-count").children[0], "長相 · 2 張", "張數跟著換");
assert.equal(writes.length, 2);
writes[1].finish(); await done;
assert.equal(book.editing(), false);
await head.querySelector(".bsh-edit").onclick();
book.toggle(cards[0]); await tick();
writes[2].reject(Object.assign(new Error("wrong section"), { bad: ["a", "b", "c", "d"] }));
await tick();
await head.querySelector(".bsh-edit").onclick();
assert.equal(book.editing(), true, "失敗時完成不能離開編輯");
assert.equal(head.querySelector(".bsh-save").children[0], "存檔失敗 · 重試");
assert.match(messages.at(-1), /a、b、c.*等 4 張/);
const use = head.querySelector(".bsh-acts").children[1];
await use.onclick({ currentTarget: use });
assert.equal(navigations, 0);
head.querySelector(".bsh-save").onclick(); await tick();
assert.equal(writes.length, 4);
writes[3].finish(); await tick();
await head.querySelector(".bsh-edit").onclick();
assert.equal(book.editing(), false);
store.push({ id: "g-c", section: "feature", name: "長相 C", tags: [] });
const row = book.detailRow(cards[0]);
row.querySelector(".bs-chip-new").onclick({ currentTarget: new Node("button") });
await tick(); assert.equal(writes.at(-1).group.name, "長相 B");
store = Array.from({ length: 26 }, (_, i) => ({ id: `g-${i}`, section: "feature", name: `長相 ${String.fromCharCode(65 + i)}`, tags: [] }));
book.detailRow(cards[0]).querySelector(".bs-chip-new").onclick({ currentTarget: new Node("button") });
await tick(); assert.equal(writes.at(-1).group.name, "長相 A2");
console.log("all ok: optimistic stamps, save barriers, retry, error cards, unused names");

// 面板的英文預覽、警告與鍵盤選項使用實際事件處理器驗證。
let sheet, current = { groups: { feature: { ids: ["g-a", "g-e"], mode: "whole" } } };
const panelGroups = [
  { id: "g-a", section: "feature", name: "原樣組名", tags: ["blue_eyes", "missing"] },
  { id: "g-e", section: "feature", name: "空組", tags: [] },
];
const panelContext = {
  ...context, english: true, cachedGroups: () => panelGroups, pickOf,
  onGroupsChange() {}, openSheet: (title, node) => { sheet = node; },
  requestAnimationFrame: fn => fn(),
};
const panelSource = readFileSync(new URL("../" + W + "/group-picks.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?$/gm, "").replaceAll("export const", "const").replace("export function", "function");
vm.runInNewContext(panelSource + "\nglobalThis.mount = mountGroupPicks;", panelContext);
const panel = panelContext.mount({ settings: () => current, setSettings: patch => { current = { ...current, ...patch }; }, cardOf: t => t === "blue_eyes" ? { zh: "藍眼", item: { section: "feature" } } : null, poolTags: () => [], blocked: () => "blocked" });
const pill = panel.pill("feature"); pill.click();
assert.equal(sheet.querySelector(".gp-row-name").children[0], "原樣組名");
assert.equal(sheet.querySelector(".gp-row-tags").children[0], "blue eyes, missing");
assert.equal(sheet.querySelector(".gp-row-tags").dataset.noI18n, undefined);
const texts = node => node instanceof Node ? node.children.flatMap(texts) : [String(node)];
assert.ok(texts(sheet).includes("1 張已不在詞庫中，存檔時會移除"));
assert.ok(texts(sheet).includes("1 張在現在的設定下抽不到（分級、性別、時代）"));
const seg = sheet.querySelector(".gp-seg");
const radios = seg.children.filter(x => x.role === "radio");
assert.deepEqual(radios.map(x => x.tabIndex), [0, -1]);
for (const [key, expected] of [["ArrowRight", "mix"], ["Home", "whole"], ["End", "mix"], ["ArrowDown", "whole"], ["ArrowLeft", "mix"], ["ArrowUp", "whole"]]) {
  seg.onkeydown({ key, target: radios.find(x => x.tabIndex === 0), preventDefault() {} });
  assert.equal(current.groups.feature.mode, expected);
  assert.equal(radios.filter(x => x.tabIndex === 0).length, 1);
}
current = { groups: { feature: { ids: ["g-e"] } } };
panel.paint("feature");
assert.equal(pill.querySelector(".gp-pill-more").textContent, "空");
console.log("all ok: English previews, separate warnings, empty pills, radio keys");

const events = new Map();
globalThis.document = { visibilityState: "hidden", addEventListener: (name, fn) => events.set(name, fn) };
globalThis.addEventListener = (name, fn) => events.set(name, fn);
const lifecycle = await import("../" + W + "/card-groups.js?lifecycle-test");
let refreshes = 0;
globalThis.fetch = async () => { refreshes++; return { ok: true, json: async () => ({ groups }) }; };
events.get("prerenderingchange")(); await tick(); assert.equal(refreshes, 0);
await lifecycle.loadGroups(); assert.equal(refreshes, 1);
events.get("visibilitychange")(); await tick(); assert.equal(refreshes, 1);
document.visibilityState = "visible";
events.get("visibilitychange")(); await tick(); assert.equal(refreshes, 2);
events.get("pageshow")({ persisted: false }); await tick(); assert.equal(refreshes, 2);
events.get("pageshow")({ persisted: true }); await tick(); assert.equal(refreshes, 3);
events.get("prerenderingchange")(); await tick(); assert.equal(refreshes, 4);
globalThis.fetch = async () => { throw new Error("offline"); };
await assert.rejects(lifecycle.loadGroups({ strict: true }), /offline/);
delete globalThis.document;
delete globalThis.addEventListener;
console.log("all ok: visibility, BFCache, prerender activation, strict loads");
