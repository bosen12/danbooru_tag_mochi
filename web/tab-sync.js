/**
 * 同一個房間開兩個分頁（從卡冊中鍵點「墨池」、手機開兩頁）時，兩邊不要打架。
 *
 * makeShelf：成品、繩上的印樣存檔用三方比對合併。每個分頁記著「上次讀到、寫入時存檔裡那一份」的指紋（seen），
 *   存檔時一張一張比：這邊那份跟 seen 一樣（這邊沒動過）、存檔裡那份卻變了（別的分頁改過）→ 留存檔裡的；
 *   這邊動過 → 寫這邊的。以前每個分頁把記憶體裡那份整個寫回去：A 收藏、做完 Hires，B 隨便印一張就把它蓋回舊版，
 *   重新整理「已收藏」不見了，再按一次作品冊多一筆重複的。
 *
 * whenPrinter：「剛才排著的」「畫到一半的」只由一個分頁接著印。以前每個分頁開頁都把它們排進自己的佇列，
 *   開兩個墨池分頁，排著的四張有三張 ComfyUI 畫兩次、Discord 也送兩次。
 */

// waitedAt 每次存檔都更新成現在（store.js），不算「改過」。欄位順序、沒有跟 null 也不算
// （舊版存的少幾個新欄位，換新版之後第一次存檔前，不要整批被當成「這邊改過」）。
const canon = (_k, v) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== null && v[k] !== undefined).map((k) => [k, v[k]]))
    : v;
const fpOf = (o) => {
  try {
    return JSON.stringify({ ...o, waitedAt: 0 }, canon);
  } catch {
    return "";
  }
};

/**
 * read()：存檔裡的那份（陣列，每筆有 id）；write(list)：整份寫回；max：存幾筆；when(item)：排序用的時間。
 * gone(ids)：別的分頁撤下了、這邊沒動過的那幾張（這邊也從畫面拿掉）。
 */
export function makeShelf({ read, write, max, when, gone = () => {} }) {
  // 這個分頁讀過、存過的編號。存檔裡多出來、這裡沒見過的，是另一個分頁新印的：一起留著。
  // 這個分頁自己撤下、裁掉的見過，不會被撿回來。
  const here = new Set();
  const seen = new Map();
  // 這個分頁上一次讀到、寫入時，存檔裡有哪幾張。之後存檔裡少了的，是別的分頁撤下的：
  // 這邊沒動過就跟著拿掉，不要把它存回去（以前 B 撤下一張，A 隨便收藏一張就把它救回來）。
  // 這邊自己撤下又復原的不在這裡面（撤下那次寫入時已經不在了），照樣存。
  let lastIds = new Set();
  const remember = (list) => {
    for (const s of list) seen.set(s.id, fpOf(s));
    lastIds = new Set(list.map((s) => s.id));
  };
  const goneSince = (stored) => {
    const now = new Set(stored.map((s) => s.id));
    return new Set([...lastIds].filter((id) => !now.has(id)));
  };
  // 跟著別的分頁拿掉的：當作這邊沒見過。那邊又按了復原、放回存檔時，算「別的分頁的」留著，不會被這邊的存檔刪掉。
  const forget = (ids) => {
    for (const id of ids) {
      here.delete(id);
      seen.delete(id);
    }
    gone(ids);
  };
  return {
    /** 讀檔：list 是存檔裡的那份（開頁時讀一次）。 */
    load(list) {
      for (const s of list) here.add(s.id);
      remember(list);
      return list;
    },
    /** 存檔：mine 是這個分頁序列化好的那份。回傳改留存檔那份的幾筆（別的分頁改過、這邊沒動過），呼叫的人拿去更新畫面。 */
    save(mine) {
      const stored = read();
      const byId = new Map(stored.map((s) => [s.id, s]));
      const adopted = [];
      const away = goneSince(stored);
      const dropped = [];
      if (away.size)
        mine = mine.filter((m) => {
          if (!away.has(m.id) || seen.get(m.id) !== fpOf(m)) return true;
          dropped.push(m.id);
          return false;
        });
      const out = mine.map((m) => {
        here.add(m.id);
        const t = byId.get(m.id);
        const fm = fpOf(m);
        if (t && seen.get(m.id) === fm && fpOf(t) !== fm) {
          adopted.push(t);
          return t;
        }
        return m;
      });
      const others = stored.filter((s) => !here.has(s.id));
      const all = others.length ? [...out, ...others].sort((a, b) => when(b) - when(a)) : out;
      const kept = all.slice(0, max);
      write(kept);
      remember(kept);
      if (dropped.length) forget(dropped);
      return adopted;
    },
    /**
     * 別的分頁存檔了（storage 事件）：stored 是新的那份，serOf(id) 是這邊那張現在序列化的樣子（沒有就 null）。
     * 回傳可以直接換成存檔那份的（那邊改過、這邊沒動過）。這邊也改過的留到下次存檔再比。
     */
    changed(stored, serOf) {
      const out = [];
      const away = [...goneSince(stored)].filter((id) => {
        const mine = serOf(id);
        return mine && fpOf(mine) === seen.get(id);
      });
      lastIds = new Set(stored.map((s) => s.id));
      if (away.length) forget(away);
      for (const t of stored) {
        if (!t || !here.has(t.id)) continue;
        const was = seen.get(t.id);
        const ft = fpOf(t);
        if (ft === was) continue;
        const mine = serOf(t.id);
        if (!mine || fpOf(mine) !== was) continue;
        seen.set(t.id, ft);
        out.push(t);
      }
      return out;
    },
  };
}

/**
 * 拿到這個房間的「印圖分頁」身分才呼叫 fn（Web Locks）。first：一開頁就拿到（沒有別的分頁開著）；
 * false：等前一個分頁關掉才輪到，這時存檔可能已經變了，呼叫的人要重讀再決定接哪幾張。
 * 拿到就一直拿著，分頁關掉、換頁時瀏覽器自己放掉。沒有 Web Locks 的瀏覽器照舊（直接當第一個）。
 */
export function whenPrinter(room, fn) {
  const locks = globalThis.navigator?.locks;
  const run = (first) => {
    try {
      fn(first);
    } catch (err) {
      console.error(err);
    }
  };
  if (!locks?.request) return void run(true);
  const name = `mochi-printer-${room}`;
  const hold = () => new Promise(() => {});
  locks
    .request(name, { ifAvailable: true }, (lock) => {
      if (lock) {
        run(true);
        return hold();
      }
      locks.request(name, () => {
        run(false);
        return hold();
      });
      return null;
    })
    .catch(() => run(true));
}

/**
 * 設定存檔只寫這次真的變了的欄位，其他照存檔裡現在的：在卡冊把分級換成敏感，開著的墨池分頁之後按一下「一次」的加減，
 * 以前會把整份舊設定（全年齡）寫回去。stored：存檔裡現在那份；prev／next：這個分頁改之前、改之後。
 */
export function settingsToWrite(stored, prev, next) {
  if (!stored || typeof stored !== "object" || !prev) return next;
  const out = { ...stored };
  for (const k of Object.keys(next)) if (JSON.stringify(next[k]) !== JSON.stringify(prev[k])) out[k] = next[k];
  return out;
}

/** 別的分頁改了 key（storage 事件只在別的分頁寫入時才來）：fn(新的值)。讀不懂就略過。 */
export function onOtherTab(key, fn) {
  if (typeof addEventListener !== "function") return;
  addEventListener("storage", (e) => {
    if (e.key !== key || e.newValue == null) return;
    let v;
    try {
      v = JSON.parse(e.newValue);
    } catch {
      return;
    }
    fn(v);
  });
}
