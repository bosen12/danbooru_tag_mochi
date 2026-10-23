/**
 * 生圖佇列：一次送一張到 /api/gen（SSE），把進度、預覽、成品回報給畫面。
 *
 * 跟主工具同一套規矩：
 *   - 伺服器每 5 秒有一則心跳；靜默超過 IDLE_MS 就當那條連線死了，這張放棄（算失敗）。
 *   - 中斷一定帶 prompt_id，只砍自己那張；不帶 prompt_id 的中斷會砍掉 Comfy 當下在跑的任何東西。
 *
 * 可以接回去（X-Gen-Resume）：從 Mac 走 Tailscale、手機付印時網路斷一下，伺服器不會馬上砍掉這張，
 * 會留著等一陣子（server.py 的 GEN_REATTACH_SEC）。這裡斷線就用 /api/gen/attach 重接，從頭重播；
 * 頁面重新整理之後，畫到一半的那張也用 resume() 接回來。明確按停走 /api/gen/cancel。
 */
import { tabProgress } from "./tab-progress.js";
import { escapeForComfy } from "./engine.js";

// config.json 的 client.streamIdleMs（/api/ping 帶下來，見 linkState）；沒設就 90 秒。
// 以前寫死 90000：照 README 調大也沒用（Codex 2026-10-13）。夾在 30 秒～30 分之間。
let IDLE_MS = 90000;
const IDLE_MIN = 30000;
const IDLE_MAX = 30 * 60000;
// 斷線之後重接的間隔。加起來約 23 秒，比伺服器留著等的 30 秒短。
const REATTACH_WAITS = [800, 1500, 2500, 4000, 6000, 8000];
// 主機探得到、送出去卻一直連不上（沒等到網路斷的那種）：隔一下再試，連續這麼多次就停。
const NET_RETRY_GAP = 1500;
const NET_RETRY_MAX = 6;

// 正在離開這一頁（換頁、重新整理）：連線是瀏覽器自己砍的，不是這張壞了。別把它記成「連不到主機」
// 存起來——回來還要接著印（送出去的用 job 接回去，還沒拿到 job 的照排著的算，見 store.js 的 waiting）。
let leaving = false;
globalThis.addEventListener?.("pagehide", () => (leaving = true));
globalThis.addEventListener?.("pageshow", () => (leaving = false));

/** 伺服器（或 Comfy）說這張壞了：不是連線問題，重接也沒用。 */
class GenError extends Error {}

// 送印時網頁自己取的工作編號（伺服器照用）：還沒收到回應就按停，停也找得到這張。
const newJobId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  } catch {
    /* 舊瀏覽器：下面那一招 */
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
};
// 伺服器重開過之後，接不回的那張最多再等多久（ComfyUI 那邊可能還在畫）。
const RECOVER_MS = 15 * 60 * 1000;

async function errorOf(res) {
  let msg = "伺服器回了 " + res.status;
  let code = "";
  try {
    const j = await res.json();
    if (j.error) msg = j.error;
    if (j.code) code = String(j.code);
  } catch {
    /* 不是 JSON */
  }
  const err = new GenError(msg);
  err.status = res.status;
  err.code = code;
  return err;
}

async function* sseEvents(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let at;
    while ((at = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, at);
      buf = buf.slice(at + 2);
      let event = "message";
      const data = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (!data.length) continue;
      try {
        yield { event, data: JSON.parse(data.join("\n")) };
      } catch {
        /* 壞的一格跳過 */
      }
    }
  }
}

/**
 * hooks:
 *   payload(shot) → /api/gen 的 body（positive 以外的：loras、ckpt、rating、workflowId、width、height）
 *   update(shot)  shot 的狀態變了
 *   idle()        佇列清空了（無限抽用它接下一輪）
 *   origin        "mochi"／"fuse"：哪一頁送的（頂欄的生圖進度用，見 gen-status.js）
 */
export function createGenerator(hooks) {
  const queue = [];
  let current = null;
  let running = false;
  // 按了停：等網路回來的那張也不等了（pump 的 waitOnline）。
  let halted = false;

  async function runOne(shot) {
    // 每接一次一個新的 AbortController：看門狗、斷線砍掉的是那一條連線，接回去要用新的。
    // 按停（cancelOne／stop）砍的是 current.ctrl，也就是當下那一條。
    let ctrl = new AbortController();
    // reserved：這次送印自己取的編號（同一張重送沿用，伺服器認得就接回同一個工作，不會畫兩次）。
    if (!shot.job && !shot._reserved) shot._reserved = newJobId();
    current = { shot, ctrl, promptId: shot.promptId || null, job: shot.job || null, reserved: shot._reserved || null };
    shot.status = "running";
    shot.progress = shot.progress || 0;
    shot.note = shot.job ? "接回剛才那張…" : "排隊中";
    hooks.update(shot);
    let watchdog = 0;
    let stalled = false;
    const kick = () => {
      clearTimeout(watchdog);
      const mine = ctrl;
      watchdog = setTimeout(() => {
        stalled = true;
        mine.abort();
      }, IDLE_MS);
    };
    const wait = (ms) =>
      new Promise((resolve) => {
        const t = setTimeout(resolve, ms);
        ctrl.signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
      });
    const finish = (data) => {
      shot.status = "done";
      shot.image = data.image;
      shot.preview = null;
      shot.progress = 1;
      shot.note = "";
      shot.result = data;
      if (data.seed !== undefined && data.seed !== null) shot.seed = data.seed;
      hooks.update(shot);
    };
    // 伺服器重開過：先問出圖日誌，再問 ComfyUI 本身（/api/gen/recover）。還在畫就隔幾秒再問，畫完就拿成品。
    // 以前直接報「找不到這張」記成失敗，ComfyUI 照樣畫完，成品就丟了。
    const recover = async () => {
      clearTimeout(watchdog);
      const until = Date.now() + RECOVER_MS;
      while (Date.now() < until && shot.status !== "cancelled" && !ctrl.signal.aborted) {
        let r = null;
        try {
          const q = `job=${encodeURIComponent(current.job || "")}&prompt_id=${encodeURIComponent(current.promptId || "")}`;
          r = await fetch(`/api/gen/recover?${q}`, { signal: ctrl.signal }).then((x) => (x.ok ? x.json() : null));
        } catch {
          r = null;
        }
        const st = r && r.state;
        if (st === "done" && r.image) {
          finish(r);
          return true;
        }
        if (st === "failed") throw new GenError(r.error || "Comfy 報錯");
        if (st !== "pending" && st !== "unknown") return false;
        shot.note = st === "pending" ? "伺服器重開過：ComfyUI 還在畫這張，等它畫完…" : "伺服器重開過，問 ComfyUI 這張怎麼了…";
        hooks.update(shot);
        await wait(3000);
      }
      return false;
    };
    // 收過幾則（預覽不算，伺服器那邊也不記）：接回去時只補後面的，進度條不會先跳回 0 再衝回來。
    // 重新整理之後接回來的從 0 開始，整段重播才拿得回進度和說明。
    let seen = 0;
    const open = () =>
      current.job
        ? fetch(`/api/gen/attach?job=${encodeURIComponent(current.job)}&since=${seen}`, { headers: { Accept: "text/event-stream" }, signal: ctrl.signal })
        : fetch("/api/gen", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-Gen-Resume": "1" },
            body: JSON.stringify({ ...hooks.payload(shot), origin: hooks.origin, positive: escapeForComfy(shot.positive), seed: shot.seed, job: current.reserved }),
            signal: ctrl.signal,
          });
    try {
      for (let attempt = 0; ; attempt++) {
        if (ctrl.signal.aborted) {
          ctrl = new AbortController();
          current.ctrl = ctrl;
        }
        stalled = false;
        kick();
        try {
          const res = await open();
          if (!res.ok) {
            // 接回時伺服器說找不到：多半是伺服器重開過（工作只存在記憶體裡）。問一下這張後來怎麼了。
            if (res.status === 404 && current.job) {
              const got = await recover();
              if (got) return true;
            }
            throw await errorOf(res);
          }
          const job = res.headers.get("X-Gen-Job");
          if (job && job !== shot.job) {
            shot.job = job;
            current.job = job;
            hooks.update(shot);
          }
          for await (const { event, data } of sseEvents(res)) {
            kick();
            if (event !== "preview") seen++;
            if (data && data.prompt_id && data.prompt_id !== shot.promptId) {
              current.promptId = data.prompt_id;
              // 存起來（store.js、fuse.js 的存檔）：伺服器重開之後還能拿它去問 ComfyUI 這張畫完了沒。
              shot.promptId = data.prompt_id;
            }
            if (event === "queued") {
              shot.note = "排隊中";
            } else if (event === "progress") {
              const max = data.max || 25;
              shot.progress = Math.min(1, (data.value || 0) / max);
              shot.note = `繪製 ${data.value || 0}/${max}`;
            } else if (event === "preview" && data.image) {
              shot.preview = data.image;
              shot.note = shot.note || "預覽中";
            } else if (event === "done") {
              finish(data);
              return true;
            } else if (event === "error") {
              throw new GenError(data.error || "Comfy 報錯");
            }
            hooks.update(shot);
          }
          throw new Error("連線中途斷了");
        } catch (err) {
          // 連線斷了，或連線沒有回應（伺服器每 5 秒有心跳，收不到東西是這條連線卡住了，不是 Comfy 沒在畫）：
          // 伺服器那邊還留著這張，換一條連線接回去。畫好了的話，接回去就拿到成品。
          if (err instanceof GenError || shot.status === "cancelled" || !current.job || attempt >= REATTACH_WAITS.length) throw err;
          shot.note = stalled ? "連線沒有回應，重新接上…" : "連線斷了，重新接上…";
          hooks.update(shot);
          await wait(REATTACH_WAITS[attempt]);
          if (shot.status === "cancelled") throw err;
        }
      }
    } catch (err) {
      shot.preview = null;
      if (shot.status === "cancelled") {
        hooks.update(shot);
        return false;
      }
      if (leaving && !(err instanceof GenError)) return false;
      // 伺服器說這張已經被取消（別的分頁、別的裝置按了停，或從 ComfyUI 那邊刪掉）：跟自己按停一樣算取消，
      // 不算印壞（以前會變成「印壞了：已取消」留在牆上，也算進連續失敗三張）。
      if (err instanceof GenError && (err.message === "已取消" || err.code === "cancelled")) {
        shot.status = "cancelled";
        shot.note = "取消了";
        hooks.update(shot);
        return false;
      }
      // 伺服器說 ComfyUI 連不上（503、沒有別的代號）：這張還沒送出去，不算壞。排回去等 ComfyUI 開好（pump 的 "comfy"）。
      // 以前算一張失敗：ComfyUI 重開那 30～60 秒連續失敗三張，無限抽就停了。
      if (err instanceof GenError && err.status === 503 && !err.code && !current.job) {
        shot.status = "queued";
        shot.note = "ComfyUI 連不上，等它開好就接著印";
        hooks.update(shot);
        return "comfy";
      }
      // 不是伺服器報錯：是連線的問題（斷了、卡住、連不到主機），重接也接不回。
      // 不送取消：伺服器那邊的那張可能好好的、甚至已經畫好；沒人接的工作伺服器過一陣子自己會收。
      shot.netFail = !(err instanceof GenError);
      if (shot.netFail && !current.job) {
        // 還沒送到伺服器（連不到主機）：這張不算壞，排回去等網路回來（pump 的 "net"）。
        shot.status = "queued";
        shot.note = "連不到主機，網路回來就接著印";
        hooks.update(shot);
        return "net";
      }
      shot.status = "failed";
      shot.note = err instanceof GenError
        ? netFailText(err)
        : stalled
          ? `連線超過 ${IDLE_MS / 1000} 秒沒有回應，接不回這張`
          : "連線斷了，重試幾次都接不回去";
      hooks.update(shot);
      return false;
    } finally {
      clearTimeout(watchdog);
      current = null;
    }
  }

  async function pump() {
    if (running) return;
    running = true;
    halted = false;
    let fails = 0;
    let quickNet = 0;
    while (queue.length) {
      const shot = queue.shift();
      if (shot.status === "cancelled") continue;
      const ok = await runOne(shot);
      if (ok === "net") {
        // 連不到主機：這張排回最前面，等網路回來再送（從 Mac 走 Tailscale 斷一下、伺服器重開）。
        // 以前只有「後面還排著」才等：一次 1 張、無限抽時佇列是空的，直接進下一輪，
        // 斷網幾秒就刷出幾十張「連不到主機」，把印好的成品擠出牆外。
        queue.unshift(shot);
        const waited = await waitOnline(() => !halted && queue[0] === shot, hooks.waiting);
        if (waited) quickNet = 0;
        else if (++quickNet >= NET_RETRY_MAX) {
          // 主機看起來是通的，送出去卻一直失敗：不要空轉，停下來說清楚。
          for (const s of queue.splice(0)) {
            s.status = s === shot ? "failed" : "cancelled";
            s.note = s === shot ? netFailText(new TypeError("Failed to fetch")) : "連不到主機，停下來了";
            hooks.update(s);
          }
          hooks.stopped && hooks.stopped("一直送不出去，停下來了：" + netFailText(new TypeError("Failed to fetch")));
          break;
        } else await new Promise((r) => setTimeout(r, NET_RETRY_GAP));
        continue;
      }
      if (ok === "comfy") {
        // ComfyUI 沒開、重開到一半：這張排回最前面，等燈號回綠（/api/ping 說 ComfyUI 好了）再送。按停就不等了。
        queue.unshift(shot);
        await waitComfy(() => !halted && queue[0] === shot, hooks.comfyWaiting);
        continue;
      }
      quickNet = 0;
      fails = ok ? 0 : shot.status === "failed" ? fails + 1 : fails;
      if (fails >= 3) {
        for (const s of queue.splice(0)) {
          s.status = "cancelled";
          s.note = "連續失敗三張，停下來了";
          hooks.update(s);
        }
        hooks.stopped && hooks.stopped("連續失敗三張，停下來了：" + (shot.note || ""));
        break;
      }
    }
    running = false;
    hooks.idle && hooks.idle();
  }

  function interrupt(promptId) {
    // 沒有 prompt_id 就不送：空的 {} 在伺服器那邊是 ComfyUI 的全域中斷，會把別的分頁、別人正在畫的圖一起砍掉。
    // 還沒拿到編號就按停的那張，本地 abort 就夠了：斷線後伺服器那邊的工作過了寬限自己會收。
    if (!promptId) return;
    fetch("/api/interrupt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_id: promptId }),
    }).catch(() => {});
  }

  /** 明確的停：伺服器那邊的工作一起收掉（排隊中的從 Comfy 佇列刪掉）。找不到工作就退回只砍 prompt。 */
  function cancelJob(job, promptId) {
    if (!job) return interrupt(promptId);
    fetch("/api/gen/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job }),
    })
      .then(async (r) => {
        if (!r.ok) return interrupt(promptId);
        // 伺服器那邊沒有這個工作（還沒建起來，或伺服器重開過）：它記下編號擋掉晚到的送印；
        // 手上有 prompt_id 的話 ComfyUI 那邊可能還在畫，一起砍。
        const j = await r.json().catch(() => ({}));
        if (j.early) interrupt(promptId);
      })
      .catch(() => interrupt(promptId));
  }

  return {
    enqueue(shot) {
      // Fresh retry/reprint creates a server job; only resume() retains one.
      Object.assign(shot, { job: null, live: false, _savedJob: null, _reserved: null, promptId: null, progress: 0, preview: null, result: null, netFail: false });
      shot.status = "queued";
      shot.note = "等前面的印完";
      queue.push(shot);
      hooks.update(shot);
      pump();
    },
    /** 重新整理之前畫到一半的那張（shot.job 還在）：排到最前面，用 attach 接回去。 */
    resume(shot) {
      if (!shot.job) return;
      shot.status = "queued";
      shot.note = "接回剛才那張…";
      queue.unshift(shot);
      hooks.update(shot);
      pump();
    },
    /** 成品牆裁掉的：還在排隊的就拿出來，不要替看不到的牌耗 ComfyUI。正在畫的那張照畫完。 */
    drop(ids) {
      for (let i = queue.length - 1; i >= 0; i--) if (ids.has(queue[i].id)) queue.splice(i, 1);
    },
    /** 只停這一張：還在排隊就拿出來，正在畫就砍（帶 prompt_id）。 */
    cancelOne(shot) {
      const at = queue.indexOf(shot);
      if (at >= 0) queue.splice(at, 1);
      shot.status = "cancelled";
      shot.note = "取消了";
      if (current && current.shot === shot) {
        cancelJob(current.job || current.reserved, current.promptId);
        current.ctrl.abort();
      } else hooks.update(shot);
    },
    /** 停：正在畫的那張也一起砍（帶 prompt_id），排隊的全部取消。 */
    stop() {
      halted = true;
      for (const s of queue.splice(0)) {
        s.status = "cancelled";
        s.note = "取消了";
        hooks.update(s);
      }
      if (current) {
        current.shot.status = "cancelled";
        current.shot.note = "取消了";
        cancelJob(current.job || current.reserved, current.promptId);
        current.ctrl.abort();
      }
    },
    get busy() {
      return running || queue.length > 0;
    },
    get pending() {
      return queue.length + (current ? 1 : 0);
    },
  };
}

/**
 * 出圖日誌的註記（server.py 的 /api/genlog/mark）：成品牆、晾紙繩上單張撤下的記成 "discard"，
 * 按復原送 null 蓋掉。牌的戰績、模型成績單拿它當「這張不要」。整面清空不算（那是整理，不是嫌棄）。
 * 送不出去就算了：只是統計少一筆。
 */
export function markGenLog(job, mark) {
  if (!job) return;
  fetch("/api/genlog/mark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: job, mark }) }).catch(() => {});
}

/**
 * 成品在畫面上顯示用的網址：跟伺服器要 webp 小檔（約原圖的 1/12，走 Tailscale 時差很多）。
 * 「開原圖」照舊用原本的網址拿 PNG；印製中的預覽幀（data: URL）不動。
 */
export function viewSrc(src) {
  if (!src || !src.startsWith("/api/image?") || /[?&]fmt=/.test(src)) return src;
  return src + "&fmt=webp";
}

/**
 * 分頁不在前面的時候，標題列顯示出圖進度（「40% · 疊印台」），印好或印壞也在標題上說一聲；
 * 切回這個分頁就恢復原本的標題。生圖一張十幾秒，人通常會先去別的分頁。
 */
export function tabTitle(base = document.title) {
  // 標題＋小圖示的進度環都交給 web/tab-progress.js（排字匣同一份）。
  const tab = tabProgress({ base });
  return {
    shot(shot, pending = 0) {
      if (shot.status === "running") tab.run(shot.progress || 0, pending > 1 ? `（還有 ${pending - 1} 張）` : "");
      else if (shot.status === "done") {
        if (pending <= 1) tab.done("印好了");
      } else if (shot.status === "failed") tab.fail("印壞了");
      else if (shot.status === "cancelled") tab.clear();
    },
  };
}

/**
 * 連線狀態："ok" 可以出圖；"comfy" 伺服器在但 ComfyUI 沒開；"net" 連這台伺服器都到不了
 * （Mac 走 Tailscale 斷線、手機換網路）。後兩種要做的事完全不同，畫面上要分開講。
 */
export async function linkState() {
  let r;
  try {
    r = await fetch("/api/ping", { cache: "no-store", signal: AbortSignal.timeout(10000) });
  } catch {
    return "net";
  }
  try {
    if (!r.ok) return "comfy";
    const j = await r.json();
    const idle = Number(j.streamIdleMs);
    if (Number.isFinite(idle) && idle > 0) IDLE_MS = Math.min(IDLE_MAX, Math.max(IDLE_MIN, idle));
    return j.ok ? "ok" : "comfy";
  } catch {
    return "comfy";
  }
}

/**
 * 送出去就失敗的那種（還沒拿到工作編號）：瀏覽器給的是英文的「Failed to fetch」
 * （iPhone 是「Load failed」），使用者看不懂。連線層的錯誤換成白話；伺服器自己講的錯照原樣。
 */
function netFailText(err) {
  const msg = String(err && err.message ? err.message : err);
  // 只認瀏覽器的連線錯誤字樣：程式自己的 TypeError（bug）照原樣，才查得到。
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(msg)) return "連不到主機：網路斷了，或伺服器沒開";
  return msg;
}

export const LINK_LABEL = { ok: "Comfy 已連", comfy: "Comfy 未連", net: "連不到主機" };

/** 連不到主機時等網路回來（每 4 秒或 online 事件再探）；still() 回 false 就不等了。回傳有沒有真的等過。 */
async function waitOnline(still, onWait) {
  let said = false;
  while (still()) {
    const st = await linkState();
    if (st !== "net") break;
    if (!said && onWait) onWait(true);
    said = true;
    await new Promise((resolve) => {
      const t = setTimeout(done, 4000);
      function done() {
        clearTimeout(t);
        window.removeEventListener("online", done);
        resolve();
      }
      window.addEventListener("online", done);
    });
  }
  if (said && onWait) onWait(false);
  return said;
}

/** 等 ComfyUI 開好（/api/ping 回 ok）。still() 不成立（按了停、這張被拿掉）就不等了。onWait(true／false)：開始等、等到了。 */
async function waitComfy(still, onWait) {
  let said = false;
  while (still()) {
    const st = await linkState();
    if (st === "ok") break;
    if (!said && onWait) onWait(true);
    said = true;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  if (said && onWait) onWait(false);
  return said;
}

export async function comfyOnline() {
  return (await linkState()) === "ok";
}

/**
 * 狀態燈的輪詢：正常 15 秒一次、斷著 6 秒一次；網路回來、分頁回到前面時馬上再探。
 * onState(state) 每次探完都會叫。
 */
export function watchLink(onState) {
  let timer = 0;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    const st = await linkState();
    busy = false;
    onState(st);
    timer = setTimeout(run, st === "ok" ? 15000 : 6000);
  };
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) run();
  });
  run();
}
