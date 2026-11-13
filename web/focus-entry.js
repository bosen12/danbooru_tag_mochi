// 打開一個有搜尋框的面板時，焦點該給誰。
//
// 桌機：直接給搜尋框，打開就能打字。
// 觸控：給關閉鈕（或面板本身）。焦點一進文字框，手機就彈出螢幕鍵盤，蓋掉半個底部抽屜 ——
// 而打開詞庫／作品冊的人多半只是想看看。焦點仍然進了面板，鍵盤使用者和螢幕閱讀器不受影響；
// 想搜尋的人點一下搜尋框就好。
//
// 用 pointer: coarse 判斷，不是看寬度：平板橫放很寬，照樣是觸控、照樣會彈鍵盤。

function isTouch() {
  try {
    return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * @param input 搜尋框 @param fallback 觸控時（或沒有搜尋框時）要給焦點的元素
 *
 * 焦點等面板畫出來的下一格才移進去（跟 web6 ui.js 的 openSheet 同一招）：剛畫好幾十張卡就 focus()，
 * 瀏覽器要當場把整個面板排版好才能判斷焦點能不能進去——手機（CPU 降速 4 倍）打開 LoRA 視窗光這一下
 * 113～147ms，接著那一格又要再排一次。等畫完版面已經排好，移過去不花錢。
 * 這兩格裡使用者已經點進面板（例如直接點搜尋框）就不搶。沒有畫面的環境（測試）照舊當下給。
 */
export function focusEntry(input, fallback) {
  const target = isTouch() ? fallback || input : input || fallback;
  if (!target) return;
  const go = () => {
    if (target.isConnected === false) return;
    const box = target.closest?.('[role="dialog"], .lora-modal, .overlay');
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (box && active && active !== document.body && box.contains(active)) return;
    target.focus({ preventScroll: true });
  };
  if (typeof requestAnimationFrame !== "function") return go();
  requestAnimationFrame(() => requestAnimationFrame(go));
}
