/**
 * 群組勾選（墨池規則每一段勾了哪幾組、整組一起／混著抽 —— settings.groups）跟伺服器同步，所有裝置共用一份。
 * 2026-11-18 以前只存在每台瀏覽器的設定裡：手機勾了「長相 A」，電腦打開還是沒勾。
 *
 * 勾選是一整組設定、不是名單：最後存的那份算（不必像偏好角色那樣合併兩邊）。
 *   - 開頁、切回分頁、網路回來：問伺服器；跟這台的不一樣就換成伺服器的（apply）。
 *   - 這台改了：送整份上去（push）。伺服器那份還沒回來前就改了：回來之後以這台的為準、送上去。
 *   - 伺服器沒存過：這台有勾的話搬上去（第一次升級時，手機或電腦誰先開就用誰的）。
 *   - 送的途中不拿伺服器的蓋回來（不然剛勾的那一下會閃回去）。
 *
 * syncGroupPicks({ get, apply }) → { push, pull }
 *   get()：這台現在的勾選（settings.groups，沒勾是 undefined）
 *   apply(picks)：換成伺服器那份（房間自己存設定、重畫）
 */
const URL = "/api/group-picks";

/** 比較用：段落照名字排、只看 ids 和 mode（兩邊的物件鍵順序可能不一樣）。 */
export function picksKey(p) {
  const o = p && typeof p === "object" ? p : {};
  return JSON.stringify(
    Object.keys(o)
      .filter((k) => Array.isArray(o[k]?.ids) && o[k].ids.length)
      .sort()
      .map((k) => [k, o[k].ids, o[k].mode === "mix" ? "mix" : "whole"])
  );
}

export function syncGroupPicks({ get, apply }) {
  let server = false;
  let dirty = false;
  let pushT = 0;
  let sending = 0;
  let pulling = null;

  function send() {
    clearTimeout(pushT);
    pushT = setTimeout(() => {
      pushT = 0;
      sending++;
      fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picks: get() || {} }) })
        .catch(() => {
          // 送不出去（斷網）：記著，網路回來、切回分頁時再送。
          dirty = true;
        })
        .finally(() => sending--);
    }, 300);
  }

  /** 這台改了勾選。 */
  function push() {
    if (!server) {
      dirty = true;
      return;
    }
    send();
  }

  function pull() {
    if (pulling || pushT || sending) return pulling;
    pulling = fetch(URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.picks || typeof j.picks !== "object") return;
        server = true;
        // 這頁在伺服器那份回來之前改過、或上次沒送出去：以這台的為準。
        if (dirty) {
          dirty = false;
          return send();
        }
        if (!j.saved) {
          if (picksKey(get()) !== picksKey({})) send();
          return;
        }
        if (picksKey(j.picks) !== picksKey(get())) apply(j.picks);
      })
      .catch(() => {})
      .finally(() => {
        pulling = null;
      });
    return pulling;
  }

  if (typeof document !== "undefined") {
    pull();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pull();
    });
    addEventListener("online", () => pull());
  }
  return { push, pull };
}
