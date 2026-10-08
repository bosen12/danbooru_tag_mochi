/**
 * 墨池、疊印台接上排字匣的 Discord 送圖（web/discord.js，伺服器那頭的佇列、.secrets/discord.json 共用）。
 *
 * 排字匣把 Telegram／Discord 收在頂欄齒輪裡；這兩頁只接 Discord，所以頂欄直接放一顆 Discord 鈕，
 * 右上角的小點＝自動送開著。面板本身（Webhook／Bot token 兩種接法、測試、計數）完全是同一份。
 *
 * 送圖只在一張圖「剛印好」的那一刻送一次：用圖的網址記住送過哪一張，重新整理後牆上那些舊成品不會再送。
 * Hires 做完的放大圖另外再送一則（尺寸換成放大後的，說明最前面標出 Hires 的模式和倍率）；
 * 「換回原圖」不送，換回來之後再做一次 Hires 是新的圖，會再送。
 */
import { initDiscord, openDiscordSettings, dcHandleKeys, dcSendCard, onDcStatus } from "./discord.js";
import { parseWeighted } from "./engine.js";
import { HIRES_MODES } from "./hires.js";

const LOGO = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19.27 5.33A16.2 16.2 0 0 0 15.23 4c-.2.35-.42.82-.58 1.2a15 15 0 0 0-4.3 0A11 11 0 0 0 9.76 4a16.2 16.2 0 0 0-4.04 1.33C3.16 9.15 2.46 12.87 2.8 16.54a16.3 16.3 0 0 0 5 2.54c.4-.55.76-1.14 1.07-1.76-.59-.22-1.15-.49-1.68-.8.14-.11.28-.22.41-.34 3.24 1.5 6.75 1.5 9.95 0 .14.12.28.23.42.34-.53.31-1.1.58-1.69.8.31.62.67 1.21 1.07 1.76a16.2 16.2 0 0 0 5-2.54c.4-4.26-.71-7.95-2.99-11.21ZM9.35 14.3c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Zm5.3 0c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Z"/></svg>`;

/** 頂欄加一顆 Discord 鈕、掛好面板。zh(tag) 給送出去的中文說明用；source 是頁名，標在訊息最上面那行。 */
export function mountDiscord(zh, source) {
  initDiscord();
  const tools = document.getElementById("mast-tools");
  if (tools && !document.getElementById("dc-btn")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "dc-btn";
    btn.className = "ghost icon-btn dc-btn";
    btn.innerHTML = `${LOGO}<span class="dc-dot" aria-hidden="true"></span>`;
    btn.addEventListener("click", openDiscordSettings);
    // 放在聲音鈕前面：跟 LoRA、工作流那排「設定類」的鈕擺在一起，連線燈留在最右邊。
    const sound = document.getElementById("sound-btn");
    tools.insertBefore(btn, sound && sound.parentElement === tools ? sound : tools.firstChild);
    onDcStatus((on) => {
      btn.querySelector(".dc-dot").dataset.on = on ? "1" : "0";
      const label = `Discord 設定（自動傳送${on ? "開著" : "關著"}）`;
      btn.setAttribute("aria-label", label);
      btn.title = label;
    });
  }
  return {
    /** 生圖佇列的 update 每次都叫：只有剛印好、還沒送過的那張會送。 */
    shot(shot) {
      if (shot.status !== "done" || !shot.image || shot._dcSent === shot.image) return;
      shot._dcSent = shot.image;
      dcSendCard(null, shot, posZh(shot.positive, zh), { source });
    },
    /** Hires 的 done 叫：新圖已經換上 shot.image、尺寸在 shot.hires。seed 留原圖的，那才是重現構圖用的。 */
    hires(shot) {
      const h = shot.hires;
      if (!h || !shot.image || shot._dcSent === shot.image) return;
      shot._dcSent = shot.image;
      const scale = Number.isInteger(h.scale) ? String(h.scale) : Number(h.scale).toFixed(2).replace(/0$/, "");
      const head = `Hires ${HIRES_MODES[h.mode]?.zh || ""} ${scale}×`.replace(/\s+/g, " ");
      const job = { ...shot, width: h.width, height: h.height };
      dcSendCard(null, job, posZh(shot.positive, zh), { source, hires: head });
    },
    /** 面板開著時吞掉頁面的快捷鍵，Esc 關面板。 */
    keys: dcHandleKeys,
  };
}

function posZh(positive, zh) {
  const out = [];
  for (const part of String(positive || "").split(",")) {
    const { tag } = parseWeighted(part);
    if (tag) out.push(zh(tag));
  }
  return out.join("、");
}
