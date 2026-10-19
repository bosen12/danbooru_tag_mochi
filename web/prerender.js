/**
 * 預先開好的頁：Edge／Chrome 在背後把另一個房間整個開好（詞庫、牌、畫面），點下去直接換上，
 * 不用再等開頁（實測 150～260ms）。Safari 沒有這個功能，照舊一般開頁。
 *   - 左右相鄰的房間：這一頁開好、閒下來就先開（prerenderNeighbors）。
 *   - 其他房間：滑鼠停在頂欄的分頁上才開（每頁 <head> 的 speculationrules）。
 *
 * 背後開的時候跟點進去之間，別的頁可能改過那一頁開機時讀的東西（帶牌過來、廢字簍、規則、語言、剛存的合成池）：
 *   - 這一頁自己改到相鄰房間在意的存檔：馬上丟掉背後開好的那頁，安靜下來再照新的存檔重開。
 *   - 漏網的（別的分頁改的、來不及重開就點了）：點進去那一刻再比一次，有變就重新整理（guardPrerender）。
 * 「會留下東西」的事（接著印、接回 Hires）用 whenActive 等點進去才做：沒點進去的預先開好的頁會被丟掉，
 * 那時送出去的就白印了，之後真的打開又再送一次。
 */

// 每個房間開機時讀、讀了就決定畫面長相的存檔。語言每個房間都讀。
const KEYS = {
  index: {
    local: ["mochi.pool.handoff.v1", "mochi.bans.v1", "mochi.settings.v1", "mochi.ui.v1", "mochi.hand.v1", "mochi.fav.chars.v1"],
    session: ["mochi.tab.pool.v1"],
  },
  fuse: {
    local: ["mochi.fuse.handoff.v1", "mochi.bans.v1", "mochi.fuse.settings.v1", "mochi.settings.v1", "mochi.fuse.tab.v1", "mochi.fuse.hand.v1", "mochi.fav.chars.v1"],
    session: ["mochi.tab.fuse.v1"],
  },
  book: { local: ["mochi.settings.v1", "mochi.bans.v1", "mochi.book.v1", "mochi.book.box.v1", "mochi.fav.chars.v1"], session: [] },
  album: { local: ["mochi.settings.v1", "mochi.album.group.v1"], session: [] },
};
for (const k of Object.values(KEYS)) {
  k.local.push("mochi.language.v1");
  k.session.push("mochi.language.state.v1");
}

// 由左到右的四個房間（頂欄分頁的順序）。
const ROOMS = [
  ["index", "./"],
  ["fuse", "fuse.html"],
  ["book", "book.html"],
  ["album", "album.html"],
];
const roomHere = () => {
  const file = location.pathname.split("/").pop() || "index.html";
  return file === "index.html" ? 0 : ROOMS.findIndex(([, href]) => href === file);
};

export const prerendering = () => !!document.prerendering;

/** 現在就做；還在背後預先開著的話，等點進去才做。 */
export function whenActive(fn) {
  if (document.prerendering) document.addEventListener("prerenderingchange", () => fn(), { once: true });
  else fn();
}

function snapshot({ local, session }) {
  const read = (store, k) => {
    try {
      return store.getItem(k);
    } catch {
      return null;
    }
  };
  return JSON.stringify([local.map((k) => read(localStorage, k)), session.map((k) => read(sessionStorage, k))]);
}

/** 預先開好之後、點進去之前，這個房間在意的存檔變了就重新整理。要在讀存檔之前呼叫（各頁主程式的第一行）。 */
export function guardPrerender(room) {
  if (!document.prerendering || !KEYS[room]) return;
  const before = snapshot(KEYS[room]);
  document.addEventListener(
    "prerenderingchange",
    () => {
      if (snapshot(KEYS[room]) !== before) location.reload();
    },
    { once: true }
  );
}

/**
 * 這一頁開好、閒下來之後，在背後先開好左右相鄰的房間（墨池↔疊印台↔卡冊↔作品冊）。
 * 這一頁改到它們在意的存檔：馬上丟掉（拿掉規則），1.5 秒沒再改才照新的存檔重開 ——
 * 不然點進去會先看到舊的、再整頁重新整理一次。
 */
let started = false;
export function prerenderNeighbors() {
  if (started || document.prerendering || !HTMLScriptElement.supports?.("speculationrules")) return;
  started = true;
  if (navigator.connection?.saveData) return;
  const here = roomHere();
  if (here < 0) return;
  const near = [here - 1, here + 1].filter((i) => ROOMS[i]).map((i) => ROOMS[i]);
  const urls = near.map(([, href]) => new URL(href, location.href).href);
  const watched = { local: new Set(), session: new Set() };
  for (const [name] of near) {
    for (const k of KEYS[name].local) watched.local.add(k);
    for (const k of KEYS[name].session) watched.session.add(k);
  }

  let rules = null;
  let again = 0;
  const arm = () => {
    clearTimeout(again);
    rules?.remove();
    rules = document.createElement("script");
    rules.type = "speculationrules";
    rules.textContent = JSON.stringify({ prerender: [{ urls, eagerness: "immediate" }] });
    document.head.append(rules);
  };
  const stale = () => {
    rules?.remove();
    rules = null;
    clearTimeout(again);
    again = setTimeout(arm, 1500);
  };

  // 這一頁自己寫的不會觸發 storage 事件：包一層 setItem／removeItem，寫到相鄰房間在意的才算。
  const touches = (store, key) =>
    (store === localStorage && watched.local.has(key)) || (store === sessionStorage && watched.session.has(key));
  for (const name of ["setItem", "removeItem"]) {
    const original = Storage.prototype[name];
    Storage.prototype[name] = function (key, ...rest) {
      // 只有相鄰房間在意的才讀舊值來比（成品牆那種大存檔不要多讀一次）。
      let watch = false;
      let was = null;
      try {
        watch = touches(this, key);
        if (watch) was = this.getItem(key);
      } catch {
        watch = false;
      }
      const out = original.call(this, key, ...rest);
      try {
        if (watch && this.getItem(key) !== was) stale();
      } catch {
        /* 比不了就算了：點進去那一刻 guardPrerender 還會再比一次 */
      }
      return out;
    };
  }
  // 別的分頁改的。
  addEventListener("storage", (e) => {
    if (e.key == null || touches(e.storageArea, e.key)) stale();
  });

  // 開頁的工作做完、閒下來再開，不跟這一頁搶。
  if (typeof requestIdleCallback === "function") requestIdleCallback(arm, { timeout: 2500 });
  else setTimeout(arm, 1200);
}

