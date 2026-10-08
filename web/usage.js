/**
 * 卡牌的使用次數（卡冊用）。一次＝這張牌進了一張圖：
 *   墨池每抽出一張（只抽牌、抽並生圖、同種子重印都算），疊印台每付印一張。
 *   疊印台的試印、照原樣再印不算（那是候選或同一張重畫，不是新的成品）。
 * 另外記「你親手放的」次數和最後一次的時間，詳情頁用。
 *
 * 正本在伺服器（server.py 的 /api/usage → data/card_usage.json），手機、電腦、不同瀏覽器共用一份。
 * 伺服器只存每張牌一個數字，不記流水帳、不存圖，用多久都一樣大。
 * 這裡（localStorage）只是：
 *   - 快取：卡冊一打開就有數字可以畫，伺服器回來再換成正本。
 *   - 暫存：送不出去（伺服器沒開、網路斷）的成品先排著，下次一起送。最多排 PENDING_MAX 筆，
 *     再多就丟最舊的 —— 不會越積越多。
 * 卡冊聽 storage 事件（同一個瀏覽器的別的分頁）並定時問伺服器（別的裝置）。
 *
 * 第一次（這個瀏覽器還沒有紀錄時）從現有的成品牆、晾紙繩補算；第一次連上伺服器時，
 * 把這個瀏覽器自己記的累計併進去一次（merge），之後就只送新的成品。
 */

export const USAGE_KEY = "mochi.usage.v1";
const PENDING_KEY = "mochi.usage.pending.v1";
const SHOTS_KEY = "mochi.shots.v1";
const PRINTS_KEY = "mochi.fuse.prints.v1";
const PENDING_MAX = 300;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存不了就算了：下一次再記 */
  }
}

function blank() {
  return { v: 1, counts: {}, mine: {}, last: {}, seeded: false, synced: false, updated: 0 };
}

/** 讀出目前的紀錄（快取；壞掉或沒有就是空的）。 */
export function loadUsage() {
  const u = read(USAGE_KEY, null);
  if (!u || typeof u !== "object" || !u.counts) return blank();
  return { v: 1, counts: u.counts || {}, mine: u.mine || {}, last: u.last || {}, seeded: !!u.seeded, synced: !!u.synced, updated: u.updated || 0 };
}

const save = (u) => write(USAGE_KEY, u);

/** 成品的提示詞拆回一個個字：去掉權重括號 (tag:1.2)、去重。 */
export function tagsOfPositive(positive) {
  const out = new Set();
  for (const raw of String(positive || "").split(",")) {
    const t = raw.trim().replace(/^\(+/, "").replace(/(:[\d.]+)?\)+$/, "").trim();
    if (t) out.add(t);
  }
  return [...out];
}

function bump(u, tags, mine, at) {
  for (const t of new Set(tags)) {
    u.counts[t] = (u.counts[t] || 0) + 1;
    if (mine && mine.has(t)) u.mine[t] = (u.mine[t] || 0) + 1;
    if (!u.last[t] || u.last[t] < at) u.last[t] = at;
  }
}

/**
 * 記下一批成品用了哪些牌。entries：[{ tags, mine, at }]，tags 只放卡牌（呼叫端用字盒過濾過）。
 * 先補算舊紀錄（第一次才會做事），本機快取立刻加上，再排進待送、送去伺服器。
 */
export function recordUses(entries, isCard) {
  const u = seedUsage(isCard);
  const now = Date.now();
  const clean = entries
    .filter((e) => e && e.tags && e.tags.length)
    .map((e) => ({ tags: [...new Set(e.tags)], mine: [...(e.mine || [])], at: e.at || now }));
  for (const e of clean) bump(u, e.tags, new Set(e.mine), e.at);
  save(u);
  const pending = read(PENDING_KEY, []);
  write(PENDING_KEY, [...(Array.isArray(pending) ? pending : []), ...clean].slice(-PENDING_MAX));
  scheduleFlush();
  return u;
}

/**
 * 第一次（這個瀏覽器的紀錄還沒補算過）：把成品牆、晾紙繩上還留著的成品算進來。只做一次。
 * isCard(tag)：這個字是不是一張牌（提示詞裡還有畫質詞、尾巴、LoRA 觸發詞）。
 */
export function seedUsage(isCard) {
  const u = loadUsage();
  if (u.seeded) return u;
  const ok = (t) => !isCard || isCard(t);
  const when = (s) => {
    const t = Date.parse(s && s.at);
    return Number.isFinite(t) ? t : 0;
  };
  const shots = read(SHOTS_KEY, []);
  for (const s of Array.isArray(shots) ? shots : []) {
    const tags = tagsOfPositive(s.positive).filter(ok);
    if (tags.length) bump(u, tags, new Set(s.mine || []), when(s));
  }
  const prints = read(PRINTS_KEY, []);
  for (const p of Array.isArray(prints) ? prints : []) {
    const tags = tagsOfPositive(p.positive).filter(ok);
    if (tags.length) bump(u, tags, new Set(p.mine || (p.bed && p.bed.pins) || []), when(p));
  }
  u.seeded = true;
  save(u);
  return u;
}

/* ---------- 跟伺服器同步 ---------- */

let flushTimer = 0;
let flushing = null;

function scheduleFlush() {
  clearTimeout(flushTimer);
  // 無限抽一輪接一輪：攢一下下再一起送。
  flushTimer = setTimeout(() => void flushUsage(), 400);
}

/** 伺服器的正本換進快取（保留本機的旗標）。 */
function adopt(server) {
  const u = loadUsage();
  const next = {
    v: 1,
    counts: server.counts || {},
    mine: server.mine || {},
    last: server.last || {},
    seeded: true,
    synced: true,
    updated: server.updated || Date.now(),
  };
  // 送出之後才記的（還在待送裡的）：快取上照樣要看得到。
  for (const e of read(PENDING_KEY, []) || []) bump(next, e.tags || [], new Set(e.mine || []), e.at || 0);
  void u;
  save(next);
  return next;
}

/**
 * 把待送的成品（第一次再加上這個瀏覽器自己的累計）送去伺服器，換回正本。
 * 送不出去就留著，下次再送；回傳目前的紀錄（成功是正本，失敗是快取）。
 */
export function flushUsage() {
  if (flushing) return flushing;
  flushing = (async () => {
    const u = loadUsage();
    const pending = read(PENDING_KEY, []) || [];
    const body = { entries: pending.slice(0, 500) };
    if (!u.synced) {
      // 第一次連上：這個瀏覽器記的累計（扣掉還在待送裡、等一下會一筆筆加的）一次併進去。
      const base = { counts: { ...u.counts }, mine: { ...u.mine }, last: { ...u.last } };
      for (const e of pending) {
        for (const t of new Set(e.tags || [])) {
          base.counts[t] = (base.counts[t] || 0) - 1;
          if ((e.mine || []).includes(t)) base.mine[t] = (base.mine[t] || 0) - 1;
        }
      }
      body.merge = base;
    }
    if (!body.entries.length && !body.merge) return fetchUsage();
    try {
      const r = await fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) return u;
      const server = await r.json();
      // 送出去的那幾筆拿掉（送的途中又記的新成品留著）。
      const now = read(PENDING_KEY, []) || [];
      write(PENDING_KEY, now.slice(body.entries.length));
      return adopt(server);
    } catch {
      return u;
    }
  })().finally(() => (flushing = null));
  return flushing;
}

/** 問伺服器目前的正本（卡冊開頁、定時更新用）。伺服器沒開就回快取。 */
export async function fetchUsage() {
  const u = loadUsage();
  if (!u.synced || (read(PENDING_KEY, []) || []).length) return flushUsage();
  try {
    const r = await fetch("/api/usage", { cache: "no-store" });
    if (!r.ok) return u;
    return adopt(await r.json());
  } catch {
    return u;
  }
}
