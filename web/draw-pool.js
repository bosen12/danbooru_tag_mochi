/**
 * 把抽牌丟到背景執行緒（draw-worker.js）。開不了 worker、逾時、出錯都回 null：叫的人照舊在主執行緒抽。
 * 帶 ifReady 時，索引還沒建好（drawWorkerReady() 為 false）就立刻回 null，不等那 5 秒；暖機照樣送，下一張才走 worker。
 *
 *   warmDrawWorker(詞庫網址)：開頁一開始就叫，worker 先去載詞庫、建索引（跟主執行緒同時做）。
 *   drawInWorker({ settings, pins, banned, seeds })：回 Promise，抽出來的那幾張（跟 drawWithSeed 同樣的欄位）。
 *   drawWorkerReady()：詞庫索引建好了沒有。
 */
let worker = null;
let lexUrl = "";
let seq = 0;
let ready = false;
const waiting = new Map();

function fail() {
  for (const done of waiting.values()) done(null);
  waiting.clear();
  try {
    worker?.terminate();
  } catch {
    /* 已經掛了 */
  }
  worker = null;
  ready = false;
}

export function warmDrawWorker(url) {
  lexUrl = url;
  if (worker || typeof Worker !== "function") return;
  try {
    worker = new Worker(new URL("./draw-worker.js", import.meta.url), { type: "module" });
  } catch {
    worker = null;
    return;
  }
  ready = false;
  worker.onmessage = (e) => {
    const data = e.data || {};
    // { ready: true } 不是某一張的結果：索引好了，下一張才丟進來抽。
    if (data.ready) {
      ready = true;
      return;
    }
    const { id, out, error } = data;
    const done = waiting.get(id);
    if (!done) return;
    waiting.delete(id);
    done(error ? null : out);
  };
  worker.onerror = fail;
  worker.postMessage({ warm: url });
}

/** 有沒有背景執行緒可用：沒有的話叫的人直接在這邊抽，不必多等一拍。 */
export const hasDrawWorker = () => !!worker;

/** 詞庫索引建好了沒有。還沒好時 drawInWorker 立刻回 null，叫的人在主執行緒抽。 */
export function drawWorkerReady() {
  return ready;
}

export function drawInWorker({ settings, pins, banned, seeds, trace = false, ifReady = false }, timeout = 5000) {
  if (!worker) return Promise.resolve(null);
  // ifReady（墨池按一下抽一張）：索引還在建就不要乾等，回 null 讓叫的人在主執行緒抽；暖機再送一次。
  // 疊印台開頁那四張試印不帶 ifReady：照舊等 worker（主執行緒正忙著排字盒、畫畫面，搬回來反而卡）。
  if (!ready && ifReady) {
    try {
      if (lexUrl) worker.postMessage({ warm: lexUrl });
    } catch {
      /* 暖機送不出去：這一張仍回主執行緒 */
    }
    return Promise.resolve(null);
  }
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(null);
    }, timeout);
    waiting.set(id, (out) => {
      clearTimeout(timer);
      resolve(out);
    });
    try {
      worker.postMessage({ id, lexUrl, settings, pins: [...pins], banned: [...banned], seeds: [...seeds], trace });
    } catch {
      waiting.delete(id);
      clearTimeout(timer);
      resolve(null);
    }
  });
}
