/**
 * 頂欄的生圖進度：墨池、疊印台送去印的，在每一頁的頂欄都看得到（印製中、畫到幾成、印好幾張），
 * 點一下回到送印的那一頁。
 *
 * 以前離開墨池去翻卡冊、作品冊，正在畫的那張 30 秒沒人接就被伺服器砍掉，排著的也清掉。現在：
 *   - 這裡每幾秒問一次 GET /api/gen/active?keep=1，等於替還開著的網站說「還有人要」——
 *     伺服器把沒人接的那張畫完（server.py 的 GEN_KEPT_SEC），回去時 gen.js 的 resume() 接回成品；
 *   - 還排著、沒送出去的那幾張存在那一頁的存檔裡（store.js 的 waiting），回去接著印。
 * 自己這一頁送的不顯示：成品牆、晾紙那條已經有了。
 * 手機頂欄那排已經滿了：不放徽章，改在上排換頁鈕（墨池、疊印台）的角落掛一個小圈（styles.css）。
 */
import { el, toast } from "./ui.js";
import { WAIT_KEEP_MS } from "./store.js";

const ROOM_ZH = { mochi: "墨池", fuse: "疊印台" };
const ROOM_HREF = { mochi: "./", fuse: "fuse.html" };
// 兩頁的存檔：數一數還排著的（gen-status 不載入那兩頁的程式，直接讀存檔）。
const SAVES = { mochi: "mochi.shots.v1", fuse: "mochi.fuse.prints.v1" };
// 看過的「印好了」：回到送印的那一頁、或點了徽章，就不再掛著。
const SEEN_KEY = "mochi.gen.seen.v1";
const SEEN_MAX = 120;

function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSeen(seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_MAX)));
  } catch {
    /* 存不了就算了：最多多掛一下「印好了」 */
  }
}

/** 那一頁還排著、等人回去接著印的張數。 */
function waitingIn(origin) {
  const list = readJSON(SAVES[origin], []);
  if (!Array.isArray(list)) return 0;
  const now = Date.now();
  return list.filter((s) => s && s.waiting === true && !s.job && now - (Number(s.waitedAt) || 0) < WAIT_KEEP_MS).length;
}

const isActive = (j) => j.state === "queued" || j.state === "running";
const isOver = (j) => j.state === "done" || j.state === "error";

/** 徽章上要說的話。回傳 null 就收起來。 */
export function genSummary(jobs, room, seen, waiting) {
  const mine = (j) => j.origin && j.origin !== room;
  const active = jobs.filter((j) => mine(j) && isActive(j));
  const done = jobs.filter((j) => mine(j) && j.state === "done" && !seen.has(j.id));
  const failed = jobs.filter((j) => mine(j) && j.state === "error" && !seen.has(j.id));
  const wait = Object.entries(waiting).filter(([o, n]) => o !== room && n > 0);
  const waitN = wait.reduce((a, [, n]) => a + n, 0);
  if (!active.length && !done.length && !failed.length && !waitN) return null;
  // 回哪一頁：有在印的跟著在印的，否則最近印好的，否則還排著的那一頁。
  const latest = (list, key) => list.reduce((a, j) => (!a || j[key] > a[key] ? j : a), null);
  const target = (latest(active, "createdAt") || latest([...done, ...failed], "finishedAt"))?.origin || wait[0]?.[0];
  const origins = new Set([...active, ...done, ...failed].map((j) => j.origin).concat(wait.map(([o]) => o)));
  const where = origins.size === 1 ? ROOM_ZH[target] : "";
  const running = active.find((j) => j.state === "running");
  const pct = running ? Math.round((running.progress || 0) * 100) : 0;
  let state, text;
  if (active.length) {
    state = "active";
    const what = active.every((j) => j.kind === "hires") ? "Hires 中" : "印製中";
    text = active.length > 1 ? `${what} ${active.length} 張` : running ? `${what} ${pct}%` : `${what}・排隊`;
  } else if (done.length) {
    state = "done";
    text = `印好 ${done.length} 張`;
  } else if (failed.length) {
    state = "failed";
    text = `${failed.length} 張沒印成`;
  } else {
    state = "waiting";
    text = `還有 ${waitN} 張待印`;
  }
  // 說明（滑鼠停留、讀屏）：講清楚現在怎樣、點了去哪。
  const parts = [];
  if (active.length) parts.push(active.length > 1 ? `正在印 ${active.length} 張` : running ? `正在印，畫到 ${pct}%` : "排隊等 ComfyUI");
  if (done.length) parts.push(`印好 ${done.length} 張`);
  if (failed.length) parts.push(`${failed.length} 張沒印成`);
  if (waitN) parts.push(`還有 ${waitN} 張排著，回去才接著印`);
  const label = `${where || "生圖"}：${parts.join("，")}。點一下回${ROOM_ZH[target]}`;
  return {
    state,
    text: where ? `${where} ${text}` : text,
    bare: text,
    label,
    href: ROOM_HREF[target],
    progress: running ? running.progress || 0 : 0,
    queued: active.length > 0 && !running,
    target,
    over: [...done, ...failed].filter((j) => j.origin === target).map((j) => j.id),
  };
}

/** 掛在頂欄（#help-btn／#ping 前面），整個網站每一頁都掛。 */
export function mountGenStatus(room) {
  const tools = document.getElementById("mast-tools");
  if (!tools || document.getElementById("gen-badge")) return;
  const ring = el("i", { class: "gen-badge-ring", "aria-hidden": "true" });
  const text = el("span", { class: "gen-badge-text" });
  const badge = el("a", { class: "ghost gen-badge", id: "gen-badge", hidden: true }, ring, text);
  const before = document.getElementById("help-btn") || document.getElementById("ping");
  if (before && before.parentElement === tools) tools.insertBefore(badge, before);
  else tools.append(badge);

  let jobs = [];
  let last = null;
  let timer = 0;
  let inflight = false;
  // 這一頁開著的時候看著它從印製中變成印好的：跳一則提示（打開頁面時早就印好的只掛徽章）。
  const watching = new Set();

  badge.addEventListener("click", () => {
    if (!last) return;
    const seen = new Set(readJSON(SEEN_KEY, []));
    for (const id of last.over) seen.add(id);
    writeSeen(seen);
  });

  // 換頁鈕上的小圈：每一頁各算各的（墨池在印、疊印台印好了，兩顆各掛各的）。
  function markTabs(seen, waiting) {
    for (const o of Object.keys(ROOM_HREF)) {
      const a = document.querySelector(`.page-switch a[href="${ROOM_HREF[o]}"]`);
      if (!a || o === room) continue;
      const sum = genSummary(
        jobs.filter((j) => j.origin === o),
        room,
        seen,
        { [o]: waiting[o] || 0 }
      );
      let dot = a.querySelector(".page-switch-gen");
      if (!sum) {
        if (a.dataset.gen) {
          delete a.dataset.gen;
          a.removeAttribute("aria-label");
        }
        continue;
      }
      if (!dot) a.append((dot = el("i", { class: "page-switch-gen", "aria-hidden": "true" })));
      a.dataset.gen = sum.state;
      a.dataset.genQueued = sum.queued ? "true" : "false";
      a.style.setProperty("--gp", String(sum.progress));
      a.setAttribute("aria-label", `${ROOM_ZH[o]}（${sum.bare}）`);
    }
  }

  function render() {
    const seen = new Set(readJSON(SEEN_KEY, []));
    // 自己這一頁送的、已經結束的：這一頁看得到，算看過了。
    let dirty = false;
    for (const j of jobs)
      if (j.origin === room && isOver(j) && !seen.has(j.id)) {
        seen.add(j.id);
        dirty = true;
      }
    if (dirty) writeSeen(seen);
    const waiting = Object.fromEntries(Object.keys(SAVES).map((o) => [o, o === room ? 0 : waitingIn(o)]));
    const sum = genSummary(jobs, room, seen, waiting);
    last = sum;
    markTabs(seen, waiting);
    if (!sum) {
      badge.hidden = true;
      return;
    }
    const grew = badge.dataset.state !== sum.state && sum.state === "done";
    badge.hidden = false;
    badge.dataset.state = sum.state;
    badge.href = sum.href;
    badge.title = sum.label;
    badge.setAttribute("aria-label", sum.label);
    badge.dataset.queued = sum.queued ? "true" : "false";
    badge.style.setProperty("--p", String(sum.progress));
    if (text.textContent !== sum.text) text.textContent = sum.text;
    if (grew) {
      badge.classList.remove("gen-badge-pop");
      void badge.offsetWidth;
      badge.classList.add("gen-badge-pop");
    }
  }

  async function poll() {
    clearTimeout(timer);
    if (inflight) return;
    inflight = true;
    let got = null;
    try {
      const r = await fetch("/api/gen/active?keep=1", { cache: "no-store" });
      if (r.ok) got = (await r.json()).jobs;
    } catch {
      /* 連不到：下一輪再問 */
    }
    inflight = false;
    if (Array.isArray(got)) {
      const seen = new Set(readJSON(SEEN_KEY, []));
      const fresh = got.filter((j) => j.origin && j.origin !== room && watching.has(j.id) && j.state === "done" && !seen.has(j.id));
      watching.clear();
      for (const j of got) if (isActive(j)) watching.add(j.id);
      jobs = got;
      render();
      if (fresh.length) {
        const o = fresh[fresh.length - 1].origin;
        toast(`${ROOM_ZH[o]}印好了 ${fresh.length} 張`, { action: { label: "去看", run: () => badge.click() } });
      }
    }
    const busy = jobs.some((j) => j.origin !== room && isActive(j));
    // 有別頁的在印：兩秒問一次（進度才跟得上）。沒有：十秒一次就好，也順便替沒人接的那張續命。
    timer = setTimeout(poll, document.hidden ? (busy ? 20000 : 60000) : busy ? 2000 : 10000);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) poll();
  });
  // 另一個分頁的墨池存檔變了（多排了幾張、印完了）：重算還排著的張數。
  addEventListener("storage", (e) => {
    if (e.key === SEEN_KEY || Object.values(SAVES).includes(e.key)) render();
  });
  poll();
}
