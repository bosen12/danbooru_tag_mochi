// 兩個分頁一起開時的存檔合併（web6/tab-sync.js 的 makeShelf、settingsToWrite）。
// 以前每個分頁把記憶體裡那份整個寫回去：A 收藏、做完 Hires，B 一存就蓋回舊版；在卡冊換的分級被墨池寫回去。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
// 這邊在 web6/，開源版（tests/ 是從這裡複製過去的）在 web/。
const here = new URL("../web6/tab-sync.js", import.meta.url);
const { makeShelf, settingsToWrite } = await import(existsSync(here) ? here : new URL("../web/tab-sync.js", import.meta.url));

function storage() {
  let data = [];
  return { read: () => JSON.parse(JSON.stringify(data)), write: (v) => (data = JSON.parse(JSON.stringify(v))), get: () => data };
}
const shelfOn = (box) => makeShelf({ read: box.read, write: box.write, max: 5, when: (s) => s.at });

test("B saving its untouched copy keeps A's newer collect", () => {
  const box = storage();
  box.write([{ id: "x", at: 1, albumId: null }, { id: "y", at: 2, albumId: null }]);
  const a = shelfOn(box);
  const b = shelfOn(box);
  const aMem = a.load(box.read());
  const bMem = b.load(box.read());
  aMem[0].albumId = "r1";
  a.save(aMem);
  // B prints a new one; its copy of x is the old one it never touched.
  const adopted = b.save([{ id: "z", at: 3, albumId: null }, ...bMem]);
  assert.equal(box.get().find((s) => s.id === "x").albumId, "r1");
  assert.deepEqual(adopted.map((s) => s.id), ["x"]);
  assert.deepEqual(box.get().map((s) => s.id).sort(), ["x", "y", "z"]);
});

test("what this tab changed itself still wins", () => {
  const box = storage();
  box.write([{ id: "x", at: 1, albumId: null }]);
  const a = shelfOn(box);
  const mem = a.load(box.read());
  mem[0].albumId = "mine";
  a.save(mem);
  assert.equal(box.get()[0].albumId, "mine");
});

test("another tab's new item is kept, and an item this tab removed stays removed", () => {
  const box = storage();
  box.write([{ id: "x", at: 1 }, { id: "gone", at: 0 }]);
  const a = shelfOn(box);
  const mem = a.load(box.read()).filter((s) => s.id !== "gone");
  box.write([{ id: "new", at: 5 }, ...box.read()]);
  a.save(mem);
  assert.deepEqual(box.get().map((s) => s.id), ["new", "x"]);
});

test("waitedAt alone does not count as a change", () => {
  const box = storage();
  box.write([{ id: "x", at: 1, waiting: true, waitedAt: 100, job: null }]);
  const a = shelfOn(box);
  const b = shelfOn(box);
  a.load(box.read());
  const bMem = b.load(box.read());
  // A gets a job id for x; B saves the same waiting copy with a fresh waitedAt.
  a.save([{ id: "x", at: 1, waiting: false, waitedAt: 0, job: "j1", live: true }]);
  b.save([{ ...bMem[0], waitedAt: 999 }]);
  assert.equal(box.get()[0].job, "j1", "B must not clobber the job A started");
});

test("storage events adopt only what this tab has not touched", () => {
  const box = storage();
  box.write([{ id: "x", at: 1, image: null }, { id: "y", at: 2, image: null }]);
  const b = shelfOn(box);
  const mem = new Map(b.load(box.read()).map((s) => [s.id, s]));
  mem.get("y").image = "local-edit.png";
  const theirs = [{ id: "x", at: 1, image: "a.png" }, { id: "y", at: 2, image: "a2.png" }];
  const got = b.changed(theirs, (id) => mem.get(id) || null);
  assert.deepEqual(got.map((s) => s.id), ["x"]);
});

test("settingsToWrite only writes the fields this tab changed", () => {
  const stored = { rating: "sensitive", count: 1, ratingFree: true };
  const prev = { rating: "general", count: 1, ratingFree: false };
  const next = { rating: "general", count: 2, ratingFree: false };
  assert.deepEqual(settingsToWrite(stored, prev, next), { rating: "sensitive", count: 2, ratingFree: true });
  assert.deepEqual(settingsToWrite(null, prev, next), next, "nothing stored yet: write everything");
});
