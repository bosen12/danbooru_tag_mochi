/**
 * 把抽牌丟到背景執行緒（draw-worker.js）。開不了 worker、逾時、出錯都回 null：叫的人照舊在主執行緒抽。
 *
 *   warmDrawWorker(詞庫網址)：開頁一開始就叫，worker 先去載詞庫、建索引（跟主執行緒同時做）。
 *   drawInWorker({ settings, pins, banned, seeds })：回 Promise，抽出來的那幾張（跟 drawWithSeed 同樣的欄位）。
 */
let worker = null;
let lexUrl = "";
let seq = 0;
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
  worker.onmessage = (e) => {
    const { id, out, error } = e.data || {};
    const done = waiting.get(id);
    if (!done) return;
    waiting.delete(id);
    done(error ? null : out);
  };
  worker.onerror = fail;
  worker.postMessage({ warm: url });
}

export function drawInWorker({ settings, pins, banned, seeds, trace = false }, timeout = 5000) {
  if (!worker) return Promise.resolve(null);
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
