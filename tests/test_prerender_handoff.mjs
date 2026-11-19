// 背後預開的墨池（prerender.js）＋交接便條（store.js 的 takePool）：
// 1. 這一頁自己在背後開時寫的存檔不算「變了」：點進去不重新整理。
// 2. 別頁改了它在意的存檔：點進去重新整理，而且那一刻「點進去才做」的事一件都不做（不會撕掉剛寫的便條）。
// 3. 便條只撕讀到的那一張：讀完之後別頁又寫了新的，新的留著。
// （2026-11-16 專案主：卡冊、解析池幾乎都帶不進墨池 —— 預開的墨池自己存了設定，點進去一定重新整理，同一刻把便條撕掉。）
// 用假的 document／Storage 在 node 裡跑，不必開瀏覽器（Playwright 的瀏覽器不會用預開的頁）。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const web = existsSync(resolve(import.meta.dirname, "../web6/prerender.js")) ? "../web6/" : "../web/";
let failed = 0;
const ok = (name, cond) => {
  console.log((cond ? "ok   " : "FAIL ") + name);
  if (!cond) failed++;
};

class Storage {
  constructor() {
    this.m = new Map();
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}

function fakePage() {
  const listeners = [];
  globalThis.Storage = Storage;
  globalThis.localStorage = new Storage();
  globalThis.sessionStorage = new Storage();
  let reloads = 0;
  globalThis.location = { reload: () => reloads++, href: "http://x/", pathname: "/" };
  globalThis.document = {
    prerendering: true,
    addEventListener: (type, fn) => listeners.push([type, fn]),
  };
  return {
    activate() {
      document.prerendering = false;
      for (const [type, fn] of listeners.splice(0)) if (type === "prerenderingchange") fn();
    },
    reloads: () => reloads,
    // 別的分頁寫的：繞過 Storage.prototype（不經過這一頁）。
    external: (k, v) => localStorage.m.set(k, v),
  };
}

// 每個情境重新載一份模組（模組裡有狀態）。
let n = 0;
const load = async () => {
  n++;
  const prerender = await import(pathToFileURL(resolve(import.meta.dirname, web + "prerender.js")).href + `?v=${n}`);
  return prerender;
};
const NOTE = "mochi.pool.handoff.v1";
const note = (tags, at) => JSON.stringify({ tags, at, from: "book", weights: {} });

// 1. 自己寫的不算
{
  const page = fakePage();
  const { guardPrerender, whenActive } = await load();
  guardPrerender("index");
  localStorage.setItem("mochi.settings.v1", JSON.stringify({ rating: "general" }));
  localStorage.setItem("mochi.ui.v1", "{}");
  let ran = 0;
  whenActive(() => ran++);
  page.activate();
  ok("背後開時自己寫的存檔：點進去不重新整理", page.reloads() === 0);
  ok("沒重新整理：點進去才做的事照做", ran === 1);
}

// 2. 別頁改了：重新整理，而且點進去才做的事不做
{
  const page = fakePage();
  const { guardPrerender, whenActive } = await load();
  guardPrerender("index");
  localStorage.setItem("mochi.settings.v1", "{}");
  let ran = 0;
  whenActive(() => ran++);
  page.external(NOTE, note(["smile"], Date.now()));
  page.activate();
  ok("別頁寫了便條：點進去重新整理", page.reloads() === 1);
  ok("要重新整理的那一刻：點進去才做的事不做", ran === 0);
}

// 2b. 別頁先寫了便條，這一頁之後又自己寫了別的（記分頁狀態）：照樣要重新整理（專案主：牌要切走再切回來才出現）
{
  const page = fakePage();
  const { guardPrerender } = await load();
  guardPrerender("index");
  page.external(NOTE, note(["smile"], Date.now()));
  localStorage.setItem("mochi.ui.v1", "{}");
  page.activate();
  ok("別頁的便條之後自己又寫了別的：點進去照樣重新整理", page.reloads() === 1);
}

// 3. takePool：預開時讀到沒有便條，點進去前別頁寫了一張 → 那張留著給重新整理後拿
{
  const page = fakePage();
  const { guardPrerender } = await load();
  guardPrerender("index");
  const S = await import(pathToFileURL(resolve(import.meta.dirname, web + "store.js")).href + `?v=${n}`);
  const got = S.takePool();
  ok("預開時沒有便條", got.length === 0);
  page.external(NOTE, note(["smile"], Date.now()));
  page.activate();
  ok("點進去：剛寫的便條還在", localStorage.getItem(NOTE) !== null);
}

// 4. takePool：預開時讀到便條、沒別人動 → 點進去才撕
{
  const page = fakePage();
  localStorage.setItem(NOTE, note(["smile"], Date.now()));
  const { guardPrerender } = await load();
  guardPrerender("index");
  const S = await import(pathToFileURL(resolve(import.meta.dirname, web + "store.js")).href + `?v=${n}x`);
  const got = S.takePool();
  ok("預開時讀到便條的牌", got.join() === "smile");
  ok("還沒點進去：便條留著", localStorage.getItem(NOTE) !== null);
  page.activate();
  ok("點進去：便條撕掉", localStorage.getItem(NOTE) === null && page.reloads() === 0);
}

// 5. 預開的墨池因為別頁寫了便條而自己重新整理：不算使用者按的重新整理，分頁裡組到一半的池子要拿得回來
//    （2026-11-20 專案主：卡冊挑牌加入後切回墨池，原本的牌都不見了）。使用者真的按重新整理照舊清空。
{
  const page = fakePage();
  const TAB = "mochi.tab.pool.v1";
  sessionStorage.setItem(TAB, JSON.stringify({ tags: ["red hair", "smile"], weights: {} }));
  const { guardPrerender } = await load();
  guardPrerender("index");
  page.external(NOTE, note(["blue eyes"], Date.now()));
  page.activate();
  ok("別頁寫了便條：點進去重新整理", page.reloads() === 1);
  ok("重新整理前留了記號", sessionStorage.getItem("mochi.reload.keep.v1") === "1");
  // 重新整理之後的那一頁：navigation 是 reload，但有記號
  const nav = performance.getEntriesByType;
  performance.getEntriesByType = () => [{ type: "reload" }];
  try {
    const S = await import(pathToFileURL(resolve(import.meta.dirname, web + "store.js")).href + `?v=${n}r1`);
    ok("程式自己重新整理：不算重來", S.reloaded() === false);
    ok("程式自己重新整理：分頁裡的池子拿得回來", S.loadTab(TAB)?.tags?.join() === "red hair,smile");
    ok("記號用過就撕掉", sessionStorage.getItem("mochi.reload.keep.v1") === null);
    const S2 = await import(pathToFileURL(resolve(import.meta.dirname, web + "store.js")).href + `?v=${n}r2`);
    ok("之後使用者真的按重新整理：照舊清空", S2.reloaded() === true && S2.loadTab(TAB) === null);
  } finally {
    performance.getEntriesByType = nav;
  }
}

console.log(failed ? `${failed} failed` : "all ok");
process.exit(failed ? 1 : 0);
