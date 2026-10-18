/**
 * 預先開好的頁（每頁 <head> 的 speculationrules）：滑鼠停在頂欄的分頁上，Edge／Chrome 就在背後把那一頁
 * 整個開好（詞庫、牌、畫面），點下去直接換上，換版的動畫演的是畫好的一頁，不是空白再一塊塊冒出來。
 * Safari 沒有這個功能，照舊一般開頁。
 *
 * 背後開的時候跟點進去之間，別的頁可能改過這一頁開機時讀的東西（帶牌過來、廢字簍、規則、語言、剛存的合成池）：
 * 點進去那一刻比一次，有變就重新整理（還是比一般開頁快，檔案都在快取裡），沒變就直接用畫好的。
 * 「會留下東西」的事（接著印、接回 Hires）用 whenActive 等點進去才做：沒點進去的預先開好的頁會被丟掉，
 * 那時送出去的就白印了，之後真的打開又再送一次。
 *
 * 每頁開機讀的存檔不一樣，各自傳要比的那幾個鑰匙；要在讀存檔之前呼叫（各頁主程式的第一行）。
 */
export const prerendering = () => !!document.prerendering;

/** 現在就做；還在背後預先開著的話，等點進去才做。 */
export function whenActive(fn) {
  if (document.prerendering) document.addEventListener("prerenderingchange", () => fn(), { once: true });
  else fn();
}

function snapshot(local, session) {
  const read = (store, k) => {
    try {
      return store.getItem(k);
    } catch {
      return null;
    }
  };
  return JSON.stringify([local.map((k) => read(localStorage, k)), session.map((k) => read(sessionStorage, k))]);
}

/** 預先開好之後、點進去之前，這些存檔變了就重新整理。不是預先開的頁什麼都不做。 */
export function guardPrerender({ local = [], session = [] } = {}) {
  if (!document.prerendering) return;
  const all = { local: [...local, "mochi.language.v1"], session: [...session, "mochi.language.state.v1"] };
  const before = snapshot(all.local, all.session);
  document.addEventListener(
    "prerenderingchange",
    () => {
      if (snapshot(all.local, all.session) !== before) location.reload();
    },
    { once: true }
  );
}
