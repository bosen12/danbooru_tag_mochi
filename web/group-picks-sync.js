/**
 * 群組勾選（墨池規則每一段勾了哪幾組、整組一起／混著抽 —— settings.groups）跟伺服器同步，所有裝置共用一份。
 * 2026-11-18 以前只存在每台瀏覽器的設定裡：手機勾了「長相 A」，電腦打開還是沒勾。
 *
 * 勾選是一整組設定、不是名單：最後存的那份算（不必像偏好角色那樣合併兩邊）。
 *   - 開頁、切回分頁、網路回來：問伺服器；跟這台的不一樣就換成伺服器的（apply）。
 *   - 這台改了：送整份上去（push）。伺服器那份還沒回來前就改了：回來之後以這台的為準、送上去。
 *   - 伺服器沒存過：這台有勾的話搬上去（第一次升級時，手機或電腦誰先開就用誰的）。
 *   - 送的途中不拿伺服器的蓋回來（不然剛勾的那一下會閃回去）。
 *   - 問的途中這台又改了：回來的那份是舊的，不套用（以前會先套回舊的，300ms 後又把舊的當新的送上去）。
 *   - 送出去回 503 也算沒送成（fetch 不會因為 503 進 catch），記著下次再送；一次只送一份，照順序。
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
  let queued = false;
  let pulling = null;
  // 這台改了幾次：問伺服器的途中改過，回來的那份就是舊的。
  let localVer = 0;

  function send() {
    clearTimeout(pushT);
    pushT = setTimeout(flush, 300);
  }

  function flush() {
    pushT = 0;
    // 一次只送一份：前一份還在路上就等它回來再送（兩份同時送，晚到的舊值會蓋掉新的）。
    if (sending) {
      queued = true;
      return;
    }
    sending++;
    const ver = localVer;
    fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picks: get() || {} }) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        // 送到了、而且送的就是現在這份：不用再補送。
        if (ver === localVer) dirty = false;
      })
      .catch(() => {
        // 送不出去（斷網、伺服器回錯）：記著，網路回來、切回分頁時再送。
        dirty = true;
      })
      .finally(() => {
        sending--;
        if (queued) {
          queued = false;
          flush();
        }
      });
  }

  /** 這台改了勾選。 */
  function push() {
    localVer++;
    if (!server) {
      dirty = true;
      return;
    }
    send();
  }

  function pull() {
    if (pulling || pushT || sending) return pulling;
    const ver = localVer;
    pulling = fetch(URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.picks || typeof j.picks !== "object") return;
        server = true;
        // 這頁在伺服器那份回來之前改過、或上次沒送出去：以這台的為準。
        if (dirty || ver !== localVer) {
          return send();
        }
        // 問的途中開始送了：等它，回來的這份可能比送出去的舊。
        if (pushT || sending) return;
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
