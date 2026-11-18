/**
 * 存在伺服器、所有裝置共用的一份名單（偏好角色 fav-chars.js、偏好卡牌 hand-store.js 都用這套）。
 *
 * localStorage[key] 是這台的快取：開頁先用它畫（不用等網路），伺服器那份回來再換上。
 * 送的是改動、不是整份：加了誰、拿掉誰（ops），手機和電腦同時改，伺服器把兩邊的都套上。
 * order：名單有順序（偏好卡牌的托盤可以排）：排過就把這台的順序一起送，伺服器照它排、別台剛加的留在最前面。
 *
 * 規則（原本寫在 fav-chars.js，2026-11-18 搬出來共用）：
 *   - 還沒跟伺服器對過（syncedKey 沒記）：這台的名單併進伺服器那份（兩邊都不丟）。
 *   - 伺服器說沒存過（換了資料夾、檔案被刪）：這台的整份搬上去。
 *   - 伺服器那份回來之前就改過：改動已經記在 ops 裡；伺服器有存過就照 ops 送，不拿整份去蓋（第五輪 Astra）。
 *   - 只送了改動、伺服器卻是剛建的（fresh）：兩邊合起來整份再送一次。
 *   - 送不出去（斷網）：ops 留在這台，下次開、切回分頁、網路回來再送。
 *
 * createSyncedList({ key, syncedKey, opsKey, url, order }) → {
 *   list(), has(t), size, set(next)（整份換：算出加了誰、拿掉誰、順序換了沒）, add(t, at), remove(t),
 *   onChange(f)（名單變了，含別的分頁、別的裝置），pull()（再跟伺服器對一次）
 * }
 */
export function createSyncedList({ key, syncedKey, opsKey, url, order: ordered = false, prepend = true }) {
  const listeners = new Set();
  const clean = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x))] : []);

  function read() {
    try {
      return clean(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return [];
    }
  }
  function write(list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* 無痕模式、空間滿了：這一頁照樣用，下次開就沒有 */
    }
  }

  let tags = read();
  const emit = () => listeners.forEach((f) => f(tags));
  // 另一個分頁改了名單：這一頁跟著換。
  addEventListener("storage", (e) => {
    if (e.key === key) {
      tags = read();
      emit();
    }
  });

  /* ---------- 伺服器那份 ---------- */
  let server = false; // 伺服器有這個功能（舊伺服器、測試的假伺服器沒有：只用這台的）
  let dirty = false; // 伺服器那份還沒回來之前，這頁就改過了
  let pushT = 0;
  let pulling = null;

  function synced() {
    try {
      return localStorage.getItem(syncedKey) === "1";
    } catch {
      return false;
    }
  }
  function markSynced() {
    try {
      localStorage.setItem(syncedKey, "1");
    } catch {
      /* 存不了：下次開還會再併一次，結果一樣 */
    }
  }

  // 還沒送到伺服器的改動：存在這台，送成功才清掉。order：這台改過幾次順序（>0 就把整份順序一起送）；
  // 用次數不用 true：送的途中又改了，回來時次數比送出去那時大，就知道還要再送一次。
  function readOps() {
    try {
      const v = JSON.parse(localStorage.getItem(opsKey) || "null");
      return { add: clean(v?.add), remove: clean(v?.remove), order: Number.isInteger(v?.order) && v.order > 0 ? v.order : 0 };
    } catch {
      return { add: [], remove: [], order: 0 };
    }
  }
  function writeOps(ops) {
    try {
      if (ops.add.length || ops.remove.length || ops.order) localStorage.setItem(opsKey, JSON.stringify(ops));
      else localStorage.removeItem(opsKey);
    } catch {
      /* 存不了：這一頁照樣送，送不出去下次開就沒有 */
    }
  }
  function noteOp(kind, t) {
    const ops = readOps();
    ops.add = ops.add.filter((x) => x !== t);
    ops.remove = ops.remove.filter((x) => x !== t);
    ops[kind].push(t);
    writeOps(ops);
  }
  const pending = (ops) => ops.add.length || ops.remove.length || ops.order;

  function push() {
    if (!server) return;
    clearTimeout(pushT);
    pushT = setTimeout(() => {
      pushT = 0;
      const sent = readOps();
      // 第一次跟伺服器對（或伺服器沒存過）：整份搬上去；之後只送改動。
      const whole = dirty || !synced();
      if (!whole && !pending(sent)) return;
      const body = whole ? { tags } : { add: sent.add, remove: sent.remove, ...(ordered && sent.order ? { order: tags } : {}) };
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || !Array.isArray(j.tags)) return;
          // 只送了改動、伺服器那邊卻是剛建的（原本沒有檔案）：兩邊合起來整份再送一次。
          if (j.fresh && !body.tags) {
            adopt([...new Set([...j.tags, ...tags])]);
            dirty = true;
            return push();
          }
          dirty = false;
          markSynced();
          // 送出去的這批清掉；送的途中又改的留著，下一次再送。
          const now = readOps();
          writeOps({
            add: now.add.filter((t) => !sent.add.includes(t)),
            remove: now.remove.filter((t) => !sent.remove.includes(t)),
            // 送的途中又改過：這台的順序（tags）比伺服器回來的新，照這台的、下一次再送。
            order: now.order > sent.order ? now.order : 0,
          });
          const left = readOps();
          if (ordered && left.order) {
            adopt([...tags.filter((t) => !left.remove.includes(t)), ...j.tags.filter((t) => !tags.includes(t) && !left.remove.includes(t))]);
          } else {
            const added = left.add.filter((t) => !j.tags.includes(t));
            const rest = j.tags.filter((t) => !left.remove.includes(t));
            adopt(prepend ? [...added, ...rest] : [...rest, ...added]);
          }
          if (pending(left)) push();
        })
        .catch(() => {});
    }, 250);
  }

  function adopt(list) {
    const next = clean(list);
    if (next.length === tags.length && next.every((t, i) => t === tags[i])) return;
    tags = next;
    write(tags);
    emit();
  }

  /** 跟伺服器對一次：開頁、切回這個分頁、網路回來時（別台裝置可能改過）。 */
  function pull() {
    if (pulling || pushT) return pulling;
    pulling = fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !Array.isArray(j.tags)) return;
        server = true;
        if (dirty && j.saved) dirty = false;
        if (dirty) return push();
        if (!j.saved) {
          if (!tags.length) return markSynced();
          dirty = true;
          return push();
        }
        if (!synced()) {
          // 第一次：伺服器的在前，這台多出來的接在後面（兩邊都不丟）。
          const merged = [...new Set([...j.tags, ...tags])];
          adopt(merged);
          return merged.length !== j.tags.length ? push() : markSynced();
        }
        // 這台還有沒送出去的：先送（伺服器套上去之後回完整名單），不要被伺服器那份蓋掉。
        if (pending(readOps())) return push();
        adopt(j.tags);
      })
      .catch(() => {})
      .finally(() => {
        pulling = null;
      });
    return pulling;
  }
  // 在瀏覽器裡才連伺服器（引擎測試在 Node 裡載這些檔，那邊只用名單本身）。
  if (typeof document !== "undefined") {
    pull();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pull();
    });
    addEventListener("online", () => pull());
  }

  function changed() {
    write(tags);
    if (!server) dirty = true;
    push();
    emit();
  }

  const api = {
    list: () => [...tags],
    has: (t) => tags.includes(t),
    get size() {
      return tags.length;
    },
    /** 整份換成 next：加了誰、拿掉誰、順序換了沒，各自記成改動再送。回傳有沒有變。 */
    set(next) {
      next = clean(next);
      const before = tags;
      if (next.length === before.length && next.every((t, i) => t === before[i])) return false;
      for (const t of next) if (!before.includes(t)) noteOp("add", t);
      for (const t of before) if (!next.includes(t)) noteOp("remove", t);
      // 有順序的名單：每一次改動都帶上這台的整份順序（新加的插在哪一格、排過的都照這台的）。
      if (ordered) {
        const ops = readOps();
        ops.order += 1;
        writeOps(ops);
      }
      tags = next;
      changed();
      return true;
    },
    add(t, at = prepend ? 0 : Infinity) {
      if (!t || tags.includes(t)) return false;
      const next = [...tags];
      next.splice(Math.min(at, next.length), 0, t);
      return api.set(next);
    },
    remove(t) {
      if (!tags.includes(t)) return false;
      return api.set(tags.filter((x) => x !== t));
    },
    /** 名單變了就叫 f；回傳取消訂閱的函式。 */
    onChange(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    pull,
  };
  return api;
}
