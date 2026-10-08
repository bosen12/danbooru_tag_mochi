/**
 * 原檔被刪了沒有（墨池成品、疊印台晾紙共用）。
 *
 * 成品的圖是 ComfyUI 輸出資料夾裡的檔案，專案主會手動去刪。刪掉之後網址還記在存檔裡，
 * 以前頁面就是一張破圖。這裡分兩種載不到：
 *   - 原檔不在了：伺服器問 ComfyUI 拿不到，回 404（或 410：同檔名已經被別張圖用掉）。
 *   - 暫時拿不到：ComfyUI 沒開、網路斷了（5xx、連不上）。這種不算刪掉，之後照樣會載回來。
 * 只有第一種才叫 onGone。
 *
 * 問法是 cache: "no-cache"：瀏覽器帶著 ETag 去問，檔案還在只回 304（幾乎沒有流量），
 * 不在就是 404。所以就算圖本身有快取、畫面看起來正常，也問得出原檔還在不在。
 */

const verdicts = new Map();

const own = (src) => typeof src === "string" && src.includes("/api/image?");

/** 這個網址的原檔是不是不在了。同一個網址只問一次（結果是「不在」才記住，其他的下次再問）。 */
export function checkGone(src) {
  if (!own(src)) return Promise.resolve(false);
  if (verdicts.has(src)) return verdicts.get(src);
  const ask = fetch(src, { cache: "no-cache" })
    .then((r) => {
      // 只看狀態碼，內容不要（原檔還在時是 304 重新驗證，fetch 裡看到的是 200）。
      r.body?.cancel?.().catch(() => {});
      return r.status === 404 || r.status === 410;
    })
    .catch(() => false);
  verdicts.set(src, ask);
  ask.then((gone) => {
    if (!gone) verdicts.delete(src);
  });
  return ask;
}

/** 圖載不出來時問一次；確定原檔不在了才叫 onGone(src)。同一張 img 換了網址也照樣看。 */
export function watchGone(img, onGone) {
  if (!img || img._watchGone) return;
  img._watchGone = true;
  img.addEventListener("error", () => {
    const src = img.getAttribute("src");
    if (!own(src)) return;
    checkGone(src).then((gone) => {
      if (gone && img.getAttribute("src") === src) onGone(src);
    });
  });
}

/** 一張一張、在閒下來的時候問（不跟畫面搶）。每問完一張回報一次。 */
export function sweepGone(srcs, onGone) {
  const list = [...new Set(srcs.filter(own))];
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  const next = () => {
    const src = list.shift();
    if (!src) return;
    idle(() =>
      checkGone(src).then((gone) => {
        if (gone) onGone(src);
        next();
      })
    );
  };
  next();
}
