// 頂欄的傳送服務入口。Telegram／Discord 各自仍管理自己的憑證與送圖佇列；
// 這裡只負責把兩個分散的按鈕收成一顆設定齒輪，避免小螢幕工具列被擠滿。

import { openTelegramSettings } from "./telegram.js";
import { openDiscordSettings } from "./discord.js";

const $ = (id) => document.getElementById(id);

const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const TELEGRAM_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 2.9 11.1c-.9.3-.9 1.6 0 1.9l4.8 1.6 1.8 5.6c.3.8 1.3 1 1.8.3l2.6-3.1 4.9 3.6c.6.4 1.5.1 1.7-.7l3-14.2c.2-.9-.7-1.6-1.6-1.3ZM9.6 14.3l-.3 3.3-1.2-3.8 9-5.6-7.5 6.1Z"/></svg>`;
const DISCORD_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.27 5.33A16.2 16.2 0 0 0 15.23 4c-.2.35-.42.82-.58 1.2a15 15 0 0 0-4.3 0A11 11 0 0 0 9.76 4a16.2 16.2 0 0 0-4.04 1.33C3.16 9.15 2.46 12.87 2.8 16.54a16.3 16.3 0 0 0 5 2.54c.4-.55.76-1.14 1.07-1.76-.59-.22-1.15-.49-1.68-.8.14-.11.28-.22.41-.34 3.24 1.5 6.75 1.5 9.95 0 .14.12.28.23.42.34-.53.31-1.1.58-1.69.8.31.62.67 1.21 1.07 1.76a16.2 16.2 0 0 0 5-2.54c.4-4.26-.71-7.95-2.99-11.21ZM9.35 14.3c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Zm5.3 0c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Z"/></svg>`;

function ensureDom() {
  const tools = $("mast-tools");
  if (!tools || $("service-settings-wrap")) return;
  const wrap = document.createElement("div");
  wrap.id = "service-settings-wrap";
  wrap.className = "service-settings-wrap";
  wrap.innerHTML = `
    <button type="button" class="ghost service-settings-btn" id="service-settings-btn" aria-label="通知設定" aria-haspopup="menu" aria-expanded="false" title="通知設定">${GEAR}</button>
    <div class="service-menu" id="service-menu" role="menu" aria-label="選擇通知服務">
      <p class="service-menu-title">通知傳送</p>
      <button type="button" class="service-choice" role="menuitem" tabindex="-1" data-service="telegram"><span class="service-icon">${TELEGRAM_ICON}</span><span class="service-copy"><strong>Telegram</strong><small>Bot 與頻道設定</small></span><span class="service-dot" aria-hidden="true"></span></button>
      <button type="button" class="service-choice" role="menuitem" tabindex="-1" data-service="discord"><span class="service-icon">${DISCORD_ICON}</span><span class="service-copy"><strong>Discord</strong><small>Webhook 或 Bot 設定</small></span><span class="service-dot" aria-hidden="true"></span></button>
    </div>`;
  tools.insertBefore(wrap, tools.firstChild);
}

function isOpen() {
  return $("service-settings-wrap")?.dataset.open === "1";
}

function setOpen(open) {
  const wrap = $("service-settings-wrap");
  const btn = $("service-settings-btn");
  if (!wrap || !btn) return;
  if (open) {
    // 選單寬 17rem、預設靠齒輪右緣往左長。手機上工具列換行後齒輪常在左半邊，
    // 往左長就整個跑出螢幕外（實測 x = -211）。齒輪在左半邊就改成往右長。
    const r = btn.getBoundingClientRect();
    wrap.dataset.side = r.left + r.width / 2 < window.innerWidth / 2 ? "left" : "right";
    wrap.dataset.open = "1";
  } else delete wrap.dataset.open;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

const menuItems = () => [...document.querySelectorAll("#service-menu [role=menuitem]")];

/** 焦點移到第 i 項，頭尾相接（-1 是最後一項）。 */
function focusItem(i) {
  const list = menuItems();
  if (list.length) list[((i % list.length) + list.length) % list.length].focus();
}

function openService(name) {
  setOpen(false);
  if (name === "telegram") openTelegramSettings();
  if (name === "discord") openDiscordSettings();
}

export function setServiceStatus(name, active) {
  const choice = document.querySelector(`#service-menu [data-service="${name}"]`);
  if (!choice) return;
  choice.dataset.active = active ? "1" : "0";
  choice.querySelector(".service-dot")?.setAttribute("data-on", active ? "1" : "0");
  // 那顆點只有顏色；螢幕閱讀器要從名字裡聽到開著還是關著。
  const title = choice.querySelector("strong")?.textContent || name;
  const sub = choice.querySelector("small")?.textContent || "";
  choice.setAttribute("aria-label", `${title}：${sub}（自動傳送${active ? "開著" : "關著"}）`);
}

export function initServiceSettings() {
  ensureDom();
  const btn = $("service-settings-btn");
  // role="menu" 等於告訴螢幕閱讀器「用方向鍵」，所以照 APG 的 menu button 做：
  // 鍵盤打開（Enter／空白鍵的 click 沒有 detail）焦點進第一項；滑鼠打開焦點留在齒輪上。
  btn?.addEventListener("click", (e) => {
    const next = !isOpen();
    setOpen(next);
    if (next && e.detail === 0) focusItem(0);
  });
  btn?.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    setOpen(true);
    focusItem(e.key === "ArrowDown" ? 0 : -1);
  });
  $("service-menu")?.addEventListener("keydown", (e) => {
    const list = menuItems();
    const at = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(at + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      focusItem(e.key === "Home" ? 0 : -1);
    } else if (e.key === "Tab") {
      // 項目不在 Tab 順序裡；Tab 就是離開選單，讓瀏覽器照常移到下一個，選單收起來。
      setOpen(false);
    }
  });
  $("service-menu")?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-service]");
    if (item) openService(item.dataset.service);
  });
  document.addEventListener("pointerdown", (e) => {
    const wrap = $("service-settings-wrap");
    if (isOpen() && wrap && !wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (!isOpen() || e.key !== "Escape") return;
    e.preventDefault();
    setOpen(false);
    btn?.focus();
  });
}
