/**
 * 墨池的 localStorage：廢字簍、規則、成品、字盒的篩選。讀寫失敗就當沒有。
 * 合成池與疊印台的版不存：重新整理就是空的。明確按「帶牌」時才留下交接便條，
 * 目的頁下一次打開時拿走就刪掉，放太久（30 分鐘）也不算數。
 */
import { whenActive } from "./prerender.js";

const KEY = {
  pool: "mochi.pool.v1", // 舊版一直存著的合成池：讀到就刪
  handoff: "mochi.pool.handoff.v1",
  fuseHandoff: "mochi.fuse.handoff.v1",
  bans: "mochi.bans.v1",
  settings: "mochi.settings.v1",
  shots: "mochi.shots.v1",
  ui: "mochi.ui.v1",
};
// 成品牆畫面上留幾張、存幾張是同一個數字（以前牆留 80、只存 60，重新整理後尾端無聲消失）。
export const SHOT_MAX = 80;
// 還排著、沒送出去的那幾張（waiting）：離開這一頁（去翻卡冊、重新整理）多久之內回來還接著印。
// 隔太久（關掉分頁、明天再開）就不自己印了，照舊清掉。
export const WAIT_KEEP_MS = 20 * 60 * 1000;
/** 存檔用：還排著、伺服器那邊還沒有工作編號的那幾張。 */
export const isWaiting = (s) => !s.job && (s.status === "queued" || s.status === "running");
/** 讀檔用：存的時候還排著、而且是剛剛的事。 */
export const stillWaiting = (s, now = Date.now()) => !!s && s.waiting === true && !s.job && now - (Number(s.waitedAt) || 0) < WAIT_KEEP_MS;

/**
 * 讀回來的東西跟預設值是不是同一種形狀：預設是清單就要是清單、是物件就要是物件（null 的話物件也收）。
 * 合法的 JSON 不代表格式對：舊版存檔、改版沒換鑰匙、外掛亂寫，以前會一路傳到 .filter、new Set，
 * 整頁停在「正在讀詞庫…」。形狀不對就當成沒存過。
 */
export function sameShape(v, fallback) {
  if (Array.isArray(fallback)) return Array.isArray(v) ? v : fallback;
  if (fallback === null || typeof fallback === "object") return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
  return typeof v === typeof fallback ? v : fallback;
}

/**
 * 設定物件逐欄看：存回來的值跟預設值同一種型別才用（花色存成數字、每排張數存成物件，以前字盒整個篩不出牌）。
 * 預設裡沒有的欄位不收。
 */
export function typedLike(defaults, saved) {
  const out = { ...defaults };
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return out;
  for (const k of Object.keys(defaults)) {
    if (k in saved && typeof saved[k] === typeof defaults[k] && saved[k] !== null) out[k] = saved[k];
  }
  return out;
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? sameShape(JSON.parse(raw), fallback) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    /* 存不了就算了 */
    return false;
  }
}

const HANDOFF_MS = 30 * 60 * 1000;

/** Explicit, one-shot transfer; ordinary navigation still opens an empty bed. */
export const handOffFuse = (tags, weights = {}) => write(KEY.fuseHandoff, { tags: [...tags], weights, at: Date.now() });
export function takeFuse() {
  const note = read(KEY.fuseHandoff, null);
  // 背後預先開的頁（prerender.js）只讀不拿：沒點進去的話便條要留給真的打開的那一次。點進去才拿走。
  if (globalThis.document?.prerendering) {
    whenActive(() => {
      try { localStorage.removeItem(KEY.fuseHandoff); } catch { /* 下次再試 */ }
    });
  } else {
    try { localStorage.removeItem(KEY.fuseHandoff); } catch { return null; }
  }
  const age = Date.now() - Number(note?.at);
  if (!note || !Array.isArray(note.tags) || !(age >= 0 && age < HANDOFF_MS)) return null;
  return { tags: note.tags.filter(t => typeof t === "string"), weights: note.weights && typeof note.weights === "object" ? note.weights : {} };
}

/** 疊印台把一版牌交給墨池：寫一張便條，墨池下次打開時拿走。 */
/** from：從哪裡交過來（"fuse"、"book"），墨池接到時跟使用者說一聲。 */
export const handOffPool = (tags, from = "", weights = {}) => write(KEY.handoff, { tags: [...tags], at: Date.now(), from, weights });
/** 上一次 takePool() 拿到的便條是從哪裡來的（沒有便條就是空字串）。 */
export let handoffFrom = "";
/** 上一次 takePool() 拿到的便條裡各張牌的份量（作品冊、疊印台交過來的）。 */
export let handoffWeights = {};

/**
 * 合成池、卡池跟著這個分頁走（sessionStorage）：去卡冊查一張牌再回來，組到一半的牌還在。
 * 重新整理照舊是空的（2026-09-25 的決定：重新整理＝重來），所以重新整理開的頁不拿。
 * 開新分頁也是空的（sessionStorage 每個分頁一份）。
 */
export function reloaded() {
  try {
    return performance.getEntriesByType("navigation")[0]?.type === "reload";
  } catch {
    return false;
  }
}
export const TAB_POOL = "mochi.tab.pool.v1";
export const TAB_FUSE = "mochi.tab.fuse.v1";
export function saveTab(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存不了：回來就是空的，跟以前一樣 */
  }
}
export function loadTab(key) {
  if (reloaded()) return null;
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

/** 墨池開機時呼叫：拿走交接的牌（沒有就是空的池子），順手清掉舊版一直存著的合成池。 */
export function takePool() {
  const note = read(KEY.handoff, null);
  // 背後預先開的頁（prerender.js）只讀不拿：沒點進去的話便條要留給真的打開的那一次。點進去才拿走。
  const drop = () => {
    try {
      localStorage.removeItem(KEY.handoff);
      localStorage.removeItem(KEY.pool);
    } catch {
      /* 刪不了就算了：下一次還會再試 */
    }
  };
  if (globalThis.document?.prerendering) whenActive(drop);
  else drop();
  if (!note || !Array.isArray(note.tags) || !(Date.now() - note.at < HANDOFF_MS)) return [];
  handoffFrom = typeof note.from === "string" ? note.from : "";
  handoffWeights = note.weights && typeof note.weights === "object" ? note.weights : {};
  return note.tags.filter((t) => typeof t === "string");
}
export const loadBans = () => read(KEY.bans, []);
export const saveBans = (tags) => write(KEY.bans, [...tags]);
export const loadSettings = () => read(KEY.settings, null);
export const saveSettings = (s) => write(KEY.settings, s);
export const loadUi = () => read(KEY.ui, {});
export const saveUi = (u) => write(KEY.ui, u);

/** 成品只存得下的欄位：預覽幀（base64）很大，不存。 */
/** 做到一半的 Hires 要存的那一點（墨池、疊印台共用）。 */
export function hiresJobOf(t) {
  const hi = t && t.hi;
  return hi && hi.job && (hi.status === "queued" || hi.status === "running")
    ? { job: hi.job, mode: hi.mode, scale: hi.scale, sampling: hi.sampling || {}, ...(hi.mode === "face" ? { from: hi.from, stack: !!hi.stack } : {}) }
    : null;
}

// 這個分頁讀過、印過的成品編號。存檔時存檔裡多出來、這裡沒見過的，是另一個分頁新印的：一起留著。
// 以前整份覆寫：開兩個墨池分頁，後存的那邊把另一邊印的整面蓋掉（連收藏、Hires、修臉的紀錄）。
// 這個分頁自己撤下、裁掉的見過，不會被撿回來。
const shotIdsHere = new Set();

// 只抽牌、沒送去印的（status "drawn"）不存：重新整理就不見（專案主：只抽牌太佔牆面）。
// 也不再佔掉存檔的上限 —— 以前抽一輪 50 張只抽牌，就把前面印好的圖從存檔裡擠掉。按「印這張」之後才算數。
const keeps = (s) => s && typeof s === "object" && typeof s.id === "string" && s.status !== "drawn";

export function saveShots(shots) {
  for (const s of shots) shotIdsHere.add(s.id);
  const others = read(KEY.shots, []).filter((s) => keeps(s) && !shotIdsHere.has(s.id));
  const mine = shots.filter(keeps).slice(0, SHOT_MAX).map((s) => ({
      id: s.id,
      seed: s.seed,
      positive: s.positive,
      mine: s.mine,
      drawn: s.drawn,
      missing: s.missing,
      era: s.era,
      heat: s.heat,
      width: s.width,
      height: s.height,
      rating: s.rating,
      loras: s.loras,
      ckpt: s.ckpt,
      workflowId: s.workflowId,
      sampling: s.sampling || {},
      // 姿勢參考（pose.js）：這張用的那一份，重印照舊。
      pose: s.pose || null,
      image: s.image || null,
      // 收進作品冊的那一筆（album-save.js）：成品上顯示「已收藏」。
      albumId: s.albumId || null,
      weights: s.weights || null,
      // Hires 過的：image 是大圖，baseImage 是原圖（再 Hires 從原圖放大、也可以還原）。
      baseImage: s.baseImage || null,
      hires: s.hires || null,
      // 修過臉：from 是修之前那張（再修一次從它開始、拿掉修臉換回它）。
      face: s.face || null,
      // Hires 做到一半：伺服器那邊的工作編號，重新整理之後接回去。
      hiresJob: hiresJobOf(s),
      // 伺服器那邊的出圖工作。畫到一半就重新整理的話，下次打開用它接回去（gen.js 的 resume）。
      job: s.job || null,
      live: !!s.job && (s.status === "running" || s.status === "queued"),
      waiting: isWaiting(s),
      waitedAt: isWaiting(s) ? Date.now() : 0,
      status: s.status === "done" ? "done" : s.status === "drawn" ? "drawn" : s.status === "failed" ? "failed" : "stopped",
      note: s.status === "done" || s.status === "drawn" ? "" : s.note || "",
      at: s.at,
    }));
  // 照時間新到舊排回去（兩邊交錯印的），超過上限的裁掉。
  const when = (s) => Number(s.at) || Date.parse(s.at) || 0;
  const all = others.length ? [...mine, ...others].sort((a, b) => when(b) - when(a)) : mine;
  write(KEY.shots, all.slice(0, SHOT_MAX));
}

export function loadShots() {
  // 一筆一筆看：清單裡夾著 null、數字的話，後面 s.status 會整頁炸掉。
  // 舊版存下來的只抽牌也略過。
  const list = read(KEY.shots, []).filter(keeps);
  for (const s of list) shotIdsHere.add(s.id);
  return list;
}
