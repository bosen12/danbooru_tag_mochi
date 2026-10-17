/**
 * 頂欄的連線燈號（「Comfy 已連／未連／連不到主機」）：墨池、疊印台、卡冊、作品冊共用。
 * 以前四頁各寫一份，斷線時有的播「落定」、有的播「拒絕」、有的不播。
 * 第一次畫不演；之後連上播 seat，斷掉播 refuse。onChange(st, ok) 只在狀態真的變了才叫。
 */
import { watchLink, LINK_LABEL } from "./gen.js";
import { seat, refuse } from "./motion.js";

export function pingLoop(onChange) {
  let prev = null;
  watchLink((st) => {
    const p = document.getElementById("ping");
    if (!p || st === prev) return;
    const ok = st === "ok";
    const wasOk = prev === "ok";
    p.dataset.ok = ok ? "1" : "0";
    p.dataset.link = st;
    p.querySelector("span").textContent = LINK_LABEL[st];
    if (prev !== null && ok !== wasOk) (ok ? seat : refuse)(p);
    prev = st;
    onChange?.(st, ok);
  });
}
