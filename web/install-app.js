/**
 * 「安裝成 App」（PWA）：Chrome、Edge 認定這個網站可以安裝時（beforeinstallprompt），頂欄「社群」旁邊
 * 多一個「安裝成 App」（跟社群同一種字連結，前面一個小圖示），按下去叫出瀏覽器自己的安裝視窗。
 *
 *   提醒只一次：第一次遇到可以安裝時，左下角浮一張小卡（跟導覽邀請同一張樣子）問要不要裝；等社群詢問、
 *     導覽邀請、導覽本身都收掉了才出來，不跟它們搶。不管按什麼都不再問（mochi.install.asked.v1）。
 *   裝好之後：瀏覽器不再發 beforeinstallprompt，這個連結就不出現；導覽「安裝成 App」那一步以它為目標，
 *     找不到目標的步驟導覽會自己略過（tour.js），所以也不教了。用 App 視窗開的一樣都不出現。
 *
 * 各頁自己載入（<script type="module" src="install-app.js">），不經過 tour.js（那支 web6、web7 要一模一樣）。
 */
import { el, toast, anyOverlay } from "./ui.js";
import { enter, reducedMotion, DUR, CURVE, css } from "./motion.js";

const ASKED_KEY = "mochi.install.asked.v1";
const ICON = `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.8 8 10.3l3.5-3.5M3 13.5h10"/></svg>`;

const standalone = () => matchMedia("(display-mode: standalone), (display-mode: window-controls-overlay)").matches || navigator.standalone === true;

let deferred = null;
let link = null;

addEventListener("beforeinstallprompt", (e) => {
  // 瀏覽器預設只在網址列放一顆小圖示，多半沒人看到：自己放一個連結，時機由使用者決定。
  e.preventDefault();
  deferred = e;
  if (standalone()) return;
  mount();
  remindOnce();
});

addEventListener("appinstalled", () => {
  deferred = null;
  remember();
  link?.remove();
  link = null;
  document.getElementById("install-offer")?.remove();
  toast("裝好了：以後從桌面或開始選單的「墨池」打開，有自己的視窗。");
});

/** 頂欄那一排（tour.js 建的 .mast-links）可能還沒出來：等一下再掛。 */
function mount() {
  if (link?.isConnected) return;
  const place = () => {
    const row = document.querySelector(".mast-links") || document.querySelector(".ab-nav");
    if (!row) return false;
    link = el("button", { class: "install-app-btn", id: "install-app-btn", type: "button", title: "裝成一個應用程式：有自己的視窗、桌面圖示，不用每次開瀏覽器" });
    link.innerHTML = ICON;
    link.append(el("span", {}, "安裝成 App"));
    link.addEventListener("click", install);
    row.append(link);
    if (!reducedMotion()) enter(link);
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
  remember();
  document.getElementById("install-offer")?.remove();
  prompt.prompt();
  const { outcome } = await prompt.userChoice.catch(() => ({ outcome: "dismissed" }));
  if (outcome === "accepted") {
    link?.remove();
    link = null;
  }
  // 按了「取消」：瀏覽器之後會再發一次 beforeinstallprompt，連結留著（但不再提醒）。
}

function asked() {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

function remember() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {}
}

/** 只提醒一次。自動測試（webdriver）不跳，免得蓋住別的東西。 */
function remindOnce() {
  if (asked() || navigator.webdriver) return;
  const busy = () =>
    anyOverlay() ||
    document.querySelector("#tour-offer, .tour-card, .tour-ring") ||
    // 第一次來先問社群（community.js）：問過了才輪到這張。
    (() => {
      try {
        return localStorage.getItem("mochi.community.asked.v1") !== "1";
      } catch {
        return false;
      }
    })();
  let tries = 0;
  const wait = () => {
    if (asked() || !deferred || !link?.isConnected) return;
    if (busy()) {
      // 第一次來這一趟都在忙（問社群、導覽）：這次不問，下次再來。
      if (++tries < 40) setTimeout(wait, 1500);
      return;
    }
    show();
  };
  setTimeout(wait, 2500);
}

function show() {
  remember();
  const close = () => {
    if (reducedMotion()) return offer.remove();
    offer.style.pointerEvents = "none";
    offer
      .animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px)" }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" })
      .finished.then(() => offer.remove(), () => offer.remove());
  };
  const offer = el(
    "div",
    { class: "tour-offer install-offer", id: "install-offer", role: "dialog", "aria-label": "安裝成 App" },
    el("p", {}, el("b", {}, "把墨池裝成 App？"), el("span", {}, "有自己的視窗和桌面圖示，不用每次開瀏覽器。之後也可以按頂欄的「安裝成 App」。")),
    el(
      "div",
      { class: "tour-offer-foot" },
      el("button", { class: "btn btn-small btn-primary", type: "button", onclick: () => (close(), install()) }, "安裝"),
      el("button", { class: "btn btn-small", type: "button", onclick: close }, "不用了")
    )
  );
  document.body.append(offer);
}
