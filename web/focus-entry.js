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

/** @param input 搜尋框 @param fallback 觸控時（或沒有搜尋框時）要給焦點的元素 */
export function focusEntry(input, fallback) {
  const target = isTouch() ? fallback || input : input || fallback;
  target?.focus({ preventScroll: true });
}
