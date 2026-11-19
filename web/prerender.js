/**
 * 預先開好的頁：Edge／Chrome 在背後把另一個房間整個開好（詞庫、牌、畫面），點下去直接換上，
 * 不用再等開頁（實測 150～260ms）。Safari 沒有這個功能，照舊一般開頁。
 *   - 左右相鄰的房間，加上墨池↔卡冊、解析池→墨池（ALSO）：這一頁開好、閒下來就先開（prerenderNeighbors）。
 *   - 其他房間：滑鼠停在頂欄的分頁上才開（每頁 <head> 的 speculationrules）。
 *
 * 背後開的時候跟點進去之間，別的頁可能改過那一頁開機時讀的東西（帶牌過來、廢字簍、規則、語言、剛存的合成池）：
 *   - 這一頁自己改到相鄰房間在意的存檔：馬上丟掉背後開好的那頁，安靜下來再照新的存檔重開。
 *   - 漏網的（別的分頁改的、來不及重開就點了）：點進去那一刻再比一次，有變就重新整理（guardPrerender）。
 * 「會留下東西」的事（接著印、接回 Hires）用 whenActive 等點進去才做：沒點進去的預先開好的頁會被丟掉，
 * 那時送出去的就白印了，之後真的打開又再送一次。
 */

// 每個房間開機時讀、讀了就決定畫面長相的存檔。語言每個房間都讀。
// 姿勢參考（mochi.pose.v1）：墨池、疊印台送印時帶的那張；預開之後在別頁換了，點進去要是新的。
const KEYS = {
  index: {
    local: ["mochi.pool.handoff.v1", "mochi.bans.v1", "mochi.settings.v1", "mochi.ui.v1", "mochi.hand.v1", "mochi.fav.chars.v1", "mochi.pose.v1"],
    session: ["mochi.tab.pool.v1"],
  },
  fuse: {
    local: ["mochi.fuse.handoff.v1", "mochi.bans.v1", "mochi.fuse.settings.v1", "mochi.settings.v1", "mochi.fuse.tab.v1", "mochi.hand.v1", "mochi.fav.chars.v1", "mochi.pose.v1"],
    session: ["mochi.tab.fuse.v1"],
  },
  book: { local: ["mochi.settings.v1", "mochi.bans.v1", "mochi.book.v1", "mochi.hand.v1", "mochi.pool.handoff.v1", "mochi.fav.chars.v1"], session: [] },
  album: { local: ["mochi.settings.v1", "mochi.album.group.v1"], session: [] },
  // 解析池：設定、分級；剛才解析的那一張存在這個分頁（sessionStorage）。
  parse: { local: ["mochi.settings.v1", "mochi.parse.v1"], session: ["mochi.parse.tab.v1"] },
};
for (const k of Object.values(KEYS)) {
  k.local.push("mochi.language.v1");
  k.session.push("mochi.language.state.v1");
}

// 由左到右的五個房間（頂欄分頁的順序）。
const ROOMS = [
  ["index", "./"],
  ["fuse", "fuse.html"],
  ["book", "book.html"],
  ["album", "album.html"],
  ["parse", "parse.html"],
];
// 除了左右相鄰，每間房另外預開的（prerenderNeighbors）。
const ALSO = { index: ["book"], book: ["index"], parse: ["index"] };
const roomHere = () => {
  const file = location.pathname.split("/").pop() || "index.html";
  return file === "index.html" ? 0 : ROOMS.findIndex(([, href]) => href === file);
};

export const prerendering = () => !!document.prerendering;

// 點進去那一刻發現存檔變了、要整頁重新整理（guardPrerender）：這一頁不再做任何「點進去才做」的事。
// 以前照樣做：墨池背後開好時讀到「沒有便條」，點進去前卡冊、解析池才寫了便條 —— 重新整理的同一刻，
// 「拿走便條」也照跑，把剛寫的便條撕掉，重新整理完合成池是空的（2026-11-16 專案主：卡冊、解析池都帶不進墨池）。
let reloading = false;

/** 現在就做；還在背後預先開著的話，等點進去才做（點進去時要重新整理就不做）。 */
export function whenActive(fn) {
  if (document.prerendering) document.addEventListener("prerenderingchange", () => reloading || fn(), { once: true });
  else fn();
}

/** 預先開好之後、點進去之前，這個房間在意的存檔變了就重新整理。要在讀存檔之前呼叫（各頁主程式的第一行）。 */
/** 程式自己重新整理（不是使用者按的）時留的記號：store.js 的 reloaded() 看到就不當成重來。 */
export const KEEP_TAB_KEY = "mochi.reload.keep.v1";

export function guardPrerender(room) {
  if (!document.prerendering || !KEYS[room]) return;
  const keys = KEYS[room];
  // 開始時每一把鑰匙的值。這一頁自己在背後開的時候寫的（開機整理設定、記住分頁狀態）只更新它寫的那一把：
  // 自己寫的不算「存檔變了」，別頁寫的（卡冊、解析池的便條）照樣算。
  // 以前（2026-11-16 早一版）自己一寫就把整份重拍一次：別頁剛寫的便條也被當成基準，點進去不重新整理，
  // 牌要切走再切回來才出現。
  const base = new Map();
  const read = (store, k) => {
    try {
      return store.getItem(k);
    } catch {
      return null;
    }
  };
  for (const k of keys.local) base.set("l:" + k, read(localStorage, k));
  for (const k of keys.session) base.set("s:" + k, read(sessionStorage, k));
  for (const name of ["setItem", "removeItem"]) {
    const original = Storage.prototype[name];
    Storage.prototype[name] = function (key, ...rest) {
      const out = original.call(this, key, ...rest);
      if (document.prerendering) {
        const id = (this === sessionStorage ? "s:" : "l:") + key;
        if (base.has(id)) base.set(id, read(this, key));
      }
      return out;
    };
  }
  document.addEventListener(
    "prerenderingchange",
    () => {
      const changed = [...base].some(([id, was]) => read(id[0] === "s" ? sessionStorage : localStorage, id.slice(2)) !== was);
      if (changed) {
        reloading = true;
        // 這次重新整理是程式自己做的，不是使用者按的：留一張記號給下一頁（store.js 的 reloaded），
        // 分頁裡組到一半的合成池、卡池照樣拿回來。2026-11-20 專案主：卡冊挑牌加入後切回墨池，原本的牌都不見了
        // （卡冊寫了交接便條 → 預開的墨池點進去發現便條變了就重新整理 → 被當成「重新整理＝重來」，整池清空）。
        try {
          sessionStorage.setItem(KEEP_TAB_KEY, "1");
        } catch {
          /* 記不了：照舊當成重新整理 */
        }
        location.reload();
      }
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
  // 左右相鄰，加上不相鄰卻常走的路：墨池↔卡冊（看牌、帶牌去墨池）、解析池→墨池。墨池、解析池在兩端，本來只預開一間。
  // 沒預開到的房間在手機上冷開要 1.5～2.4 秒（CPU 降速 4 倍）；預開好的點下去直接換上。
  const also = (ALSO[ROOMS[here][0]] || []).map((name) => ROOMS.find(([n]) => n === name)).filter(Boolean);
  const near = [...[here - 1, here + 1].filter((i) => ROOMS[i]).map((i) => ROOMS[i]), ...also];
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

