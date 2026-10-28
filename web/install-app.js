/**
 * 「安裝成 App」（PWA）：Chrome、Edge 認定這個網站可以安裝時（beforeinstallprompt），頂欄「社群」旁邊
 * 多一顆鈕，按下去叫出瀏覽器自己的安裝視窗。裝好之後墨池有自己的視窗、桌面圖示，沒有網址列。
 * 已經是用 App 視窗開的、或瀏覽器不支援（Safari 走「分享 → 加入主畫面」），這顆鈕就不出現。
 *
 * 各頁自己載入（<script type="module" src="install-app.js">），不經過 tour.js（那支 web6、web7 要一模一樣）。
 */
import { el, toast } from "./ui.js";
import { enter, reducedMotion } from "./motion.js";

const standalone = () => matchMedia("(display-mode: standalone), (display-mode: window-controls-overlay)").matches || navigator.standalone === true;

let deferred = null;
let btn = null;

addEventListener("beforeinstallprompt", (e) => {
  // 瀏覽器預設只在網址列放一顆小圖示，多半沒人看到：自己放一顆，時機由使用者決定。
  e.preventDefault();
  deferred = e;
  if (!standalone()) mount();
});

addEventListener("appinstalled", () => {
  deferred = null;
  btn?.remove();
  btn = null;
  toast("裝好了：以後從桌面或開始選單的「墨池」打開，有自己的視窗。");
});

/** 頂欄那一排（tour.js 建的 .mast-links）可能還沒出來：等一下再掛。 */
function mount() {
  if (btn?.isConnected) return;
  const place = () => {
    const row = document.querySelector(".mast-links") || document.querySelector(".ab-nav");
    if (!row) return false;
    btn = el("button", { class: "mast-extra install-app-btn", type: "button", title: "裝成一個應用程式：有自己的視窗、桌面圖示，不用每次開瀏覽器" }, "安裝成 App");
    btn.addEventListener("click", install);
    row.append(btn);
    if (!reducedMotion()) enter(btn);
    return true;
  };
  if (place()) return;
  const mo = new MutationObserver(() => place() && mo.disconnect());
  mo.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 15000);
}

async function install() {
  if (!deferred) return;
  const prompt = deferred;
  deferred = null;
  prompt.prompt();
  const { outcome } = await prompt.userChoice.catch(() => ({ outcome: "dismissed" }));
  if (outcome === "accepted") {
    btn?.remove();
    btn = null;
  }
  // 按了「取消」：瀏覽器之後會再發一次 beforeinstallprompt，鈕留著。
}
