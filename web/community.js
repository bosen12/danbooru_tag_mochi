/**
 * 社群：Discord 伺服器、GitHub。
 *   - 頂欄「社群」（tour.js 掛在介紹影片、教學、導覽、原理那一組）：打開「加入 Discord」的小視窗。
 *   - 第一次來墨池（任何一個房間、整個瀏覽器只問一次）：先問要不要加入伺服器，關掉之後才冒出導覽的邀請卡。
 *     自動化測試（navigator.webdriver）不問，免得擋到別的測試。
 *   - 宣傳頁（about.html）也用這裡的連結。
 */
import { el, openSheet, toast } from "./ui.js";

export const DISCORD_URL = "https://discord.gg/UtDK9w3Hw";
export const GITHUB_URL = "https://github.com/bosen12/danbooru_tag_mochi";
// 宣傳頁：web7 沒有這一頁（null 就不放連結）。
export const ABOUT_PAGE = "about.html";
export const DISCORD_SHORT = DISCORD_URL.replace(/^https:\/\//, "");
export const GITHUB_SHORT = GITHUB_URL.replace(/^https:\/\/github\.com\//, "");

const ASKED_KEY = "mochi.community.asked.v1";

// Discord 的標誌（官方的 Clyde 輪廓，加入伺服器的按鈕上用）。
const DISCORD_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.27 18.27 0 0 0-5.49 0 12.64 12.64 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.07 0a.07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.1c.36.7.77 1.37 1.23 2a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z"/></svg>';
const GITHUB_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>';

export const discordIcon = () => el("span", { class: "community-icon", html: DISCORD_SVG });
export const githubIcon = () => el("span", { class: "community-icon", html: GITHUB_SVG });

function asked() {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true; // 存不了：不要每換一頁就問一次
  }
}

function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* 存不了就算了 */
  }
}

/** 複製文字：http（例如手機走 Tailscale 連回來）沒有 navigator.clipboard，退回選取再複製。 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el("textarea", { class: "sr-only", readonly: "" });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** 邀請連結那一行：網址＋「複製」。 */
export function inviteRow() {
  const copy = el("button", { class: "btn btn-small community-copy", type: "button" }, "複製連結");
  copy.addEventListener("click", async () => {
    const ok = await copyText(DISCORD_URL);
    toast(ok ? "邀請連結複製好了" : "複製不了：請手動選取網址");
  });
  return el(
    "div",
    { class: "community-invite" },
    el("a", { class: "community-url", href: DISCORD_URL, target: "_blank", rel: "noopener", dataset: { noI18n: "" } }, DISCORD_SHORT),
    copy
  );
}

/**
 * 「加入 Discord」的小視窗。first：第一次來時主動問的（字不一樣，結尾提醒之後去哪裡找）。
 * 回傳一個 Promise：視窗關掉時完成。
 */
export function openCommunity({ first = false } = {}) {
  return new Promise((resolve) => {
    const body = el(
      "div",
      { class: "community" },
      el(
        "div",
        { class: "community-badge", "aria-hidden": "true" },
        el("i"),
        el("i"),
        el("i"),
        el("span", { class: "community-badge-mark", html: DISCORD_SVG })
      ),
      el("p", { class: "community-lead" }, first ? "墨池有一個 Discord 伺服器，要不要一起來？" : "墨池的 Discord 伺服器，歡迎加入。"),
      el(
        "ul",
        { class: "community-perks" },
        el("li", {}, "分享你印的圖、看別人怎麼配牌"),
        el("li", {}, "問用法、回報問題，有人會回"),
        el("li", {}, "許願想要的牌、規則、功能"),
        el("li", {}, "新版、新卡面第一時間公告")
      ),
      inviteRow(),
      el(
        "p",
        { class: "community-gh" },
        githubIcon(),
        el("span", {}, "原始碼在 GitHub："),
        el("a", { href: GITHUB_URL, target: "_blank", rel: "noopener", dataset: { noI18n: "" } }, GITHUB_SHORT)
      ),
      first ? el("p", { class: "community-later" }, "之後想加入：按頂欄的「社群」。") : null,
      ABOUT_PAGE ? el("a", { class: "community-about", href: ABOUT_PAGE }, "看看墨池的介紹頁 →") : null
    );
    const later = el("button", { class: "btn", type: "button" }, first ? "之後再說" : "關閉");
    const join = el("a", { class: "btn btn-primary community-join", href: DISCORD_URL, target: "_blank", rel: "noopener" }, discordIcon(), el("span", {}, "加入 Discord"));
    const sheet = openSheet(first ? "加入墨池的 Discord？" : "社群", body, { foot: [later, join], onClose: resolve });
    sheet.sheet.classList.add("community-sheet");
    later.addEventListener("click", sheet.close);
    // 連結在新分頁開：這一頁的視窗順手收掉。
    join.addEventListener("click", () => setTimeout(sheet.close, 0));
  });
}

/** 第一次來：問一次要不要加入伺服器（關掉、加入都算問過）。不用問就馬上完成。 */
export function askCommunityOnce() {
  if (asked() || navigator.webdriver) return Promise.resolve(false);
  markAsked();
  return openCommunity({ first: true }).then(() => true);
}

/** 頂欄「社群」鈕：放在 after 後面。 */
export function communityButton() {
  const b = el("button", { class: "mast-extra community-btn", id: "community-btn", type: "button", title: "加入墨池的 Discord 伺服器、GitHub" }, "社群");
  b.addEventListener("click", () => openCommunity());
  return b;
}
