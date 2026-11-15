/**
 * 觸控時輕震一下（放牌、抽牌、拖牌落點）。
 *   - Android 等有 navigator.vibrate 的：照 ms 震。
 *   - iPhone：Safari 沒有 vibrate，但 iOS 18 起點一下「開關」樣式的勾選框（<input type=checkbox switch>），
 *     系統會給一下觸覺回饋。在使用者的手勢裡替他點一個看不見的開關，借它來震；ms 沒有作用（只有一種輕震）。
 *     只在觸控螢幕上做（Mac 的 Safari 也有 switch，但沒有震動可言）。
 * 呼叫的人自己判斷「這一下是不是手指點的」；不在手勢裡，iPhone 本來就不會震。
 */
let iosLabel = null;

function iosSwitch() {
  if (iosLabel !== null) return iosLabel;
  iosLabel = false;
  try {
    if (!("switch" in HTMLInputElement.prototype) || !matchMedia("(pointer: coarse)").matches) return iosLabel;
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.append(input);
    // 這一下點擊、勾選變化只是借來震的：不讓它往上傳，頁面上其他「點了就做事」的不會被叫到。
    for (const type of ["click", "input", "change"]) label.addEventListener(type, (e) => e.stopPropagation());
    document.head.append(label);
    iosLabel = label;
  } catch {
    iosLabel = false;
  }
  return iosLabel;
}

export function vibrate(ms) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
      return;
    }
    const label = iosSwitch();
    if (label) label.click();
  } catch {
    /* 不支援就算了 */
  }
}
