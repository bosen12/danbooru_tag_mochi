/**
 * 頂欄的連線燈號（「Comfy 已連／未連／連不到主機」）：墨池、疊印台、卡冊、作品冊共用。
 * 以前四頁各寫一份，斷線時有的播「落定」、有的播「拒絕」、有的不播。
 * 第一次畫不演；之後連上播 seat，斷掉播 refuse。onChange(st, ok) 只在狀態真的變了才叫。
 */
import { watchLink, LINK_LABEL } from "./gen.js";
import { seat, refuse } from "./motion.js";
import { el } from "./ui.js";

/**
 * 樣子（2026-11-18）：一律寫「Comfy」，旁邊連上是綠點、沒連上是紅叉；完整的狀態（已連、未連、連不到主機）
 * 放在滑鼠提示和讀屏。以前窄一點的螢幕只剩一顆小點，看不出那是 ComfyUI 的燈。
 */
function dress(p) {
  if (p.querySelector(".ping-name")) return;
  p.prepend(el("b", { class: "ping-name", "aria-hidden": "true" }, "Comfy"));
}

export function pingLoop(onChange) {
  let prev = null;
  watchLink((st) => {
    const p = document.getElementById("ping");
    if (!p || st === prev) return;
    dress(p);
    const ok = st === "ok";
    const wasOk = prev === "ok";
    p.dataset.ok = ok ? "1" : "0";
    p.dataset.link = st;
    p.querySelector("span").textContent = LINK_LABEL[st];
    p.title = LINK_LABEL[st];
    if (prev !== null && ok !== wasOk) (ok ? seat : refuse)(p);
    prev = st;
    onChange?.(st, ok);
  });
}
