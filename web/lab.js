/**
 * 實驗功能的開關（現在只有一項：AI 助手）。
 *
 * 關著的時候墨池要跟原本一模一樣：頂欄不多一顆鈕、合成池和字盒不多「問助理」、不連任何 AI 相關的網址。
 * 所以開關不放在頂欄，放在頂欄齒輪「設定」裡（screensaver.js 的設定視窗，手機、電腦都有）。
 * 墨池主頁掛上 AI 助手時叫 registerLab()；其他房間沒有登記，這兩個視窗就不出現這一區。
 */
import { el } from "./ui.js";

let host = null;

/** assistant.js 登記：enabled() 現在開著沒；set(on) 打開／關掉。 */
export function registerLab(api) {
  host = api;
}

/** 設定視窗裡的「實驗功能」一區；這一頁沒有實驗功能就回 null。 */
export function labSection() {
  if (!host) return null;
  const input = el("input", { type: "checkbox", role: "switch" });
  input.checked = !!host.enabled();
  input.addEventListener("change", () => host.set(input.checked));
  return el(
    "section",
    { class: "lab-section" },
    el("h3", {}, "實驗功能"),
    el("label", { class: "switch lab-switch" }, input, "AI 助手（聊天室）"),
    el("p", { class: "lab-help" }, "打開後頂欄多一顆朱色印章（墨池助手），可以用一句話交代助手查牌、配牌、改規則、抽一輪。關掉就跟原本一模一樣，還沒執行的助手操作都會取消。")
  );
}
