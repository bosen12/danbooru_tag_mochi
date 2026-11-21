/**
 * 暫時讀不到的圖（ComfyUI 沒開、重開中：伺服器的 /api/image 回 502／503）：等它回來再一起重載。
 * 作品冊的日誌、卡冊牌詳情的「用它做過的圖」共用。2026-11-21 起。
 *
 * 以前：日誌縮圖露出瀏覽器的破圖小圖示；卡冊詳情是一整排空灰格，也不說為什麼，ComfyUI 開好了也不會自己出現。
 *
 * 不是每張各自重試：幾百張縮圖每一輪各打一次，每次都要等伺服器連 ComfyUI 逾時。
 * 回到這個分頁、網路回來、或每 20 秒，先拿第一張試；試到了才全部重載。
 *
 * waitImage({ node, src, reload }) 排進等候；reload(n) 換成帶 retry=n 的網址重讀（同一個網址讀壞過，瀏覽器可能不再要）。
 * 讀到了由呼叫端 unwaitImage 拿掉。node 不在頁面上了就自己丟掉。
 */
const waiting = new Set();
let timer = 0;
let trying = false;

async function tryAgain() {
  for (const w of [...waiting]) if (!w.node.isConnected) waiting.delete(w);
  const first = [...waiting][0];
  if (!first || trying) return;
  trying = true;
  try {
    const ok = await fetch(first.src, { cache: "no-store" })
      .then(async (r) => {
        try {
          await r.body?.cancel();
        } catch {
          /* 只要狀態碼 */
        }
        return r.ok;
      })
      .catch(() => false);
    if (!ok) return;
    for (const w of [...waiting]) {
      waiting.delete(w);
      if (!w.node.isConnected) continue;
      w.tries = (w.tries || 0) + 1;
      w.reload(w.tries);
    }
  } finally {
    trying = false;
  }
}

if (typeof addEventListener === "function") addEventListener("online", tryAgain);
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && waiting.size) tryAgain();
  });

export function waitImage(w) {
  waiting.add(w);
  if (timer) return;
  timer = setInterval(() => {
    if (!waiting.size) {
      clearInterval(timer);
      timer = 0;
      return;
    }
    if (!document.hidden) tryAgain();
  }, 20000);
}

export function unwaitImage(w) {
  waiting.delete(w);
}

/** 重讀用的網址：帶上第幾次，瀏覽器才會真的再要一次。 */
export const retrySrc = (src, n) => `${src}${src.includes("?") ? "&" : "?"}retry=${n}`;
