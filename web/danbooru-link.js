/**
 * 卡片詳情（字盒、卡冊）英文 tag 旁邊的兩顆連結：在 Danbooru 看這個 tag 的圖、看它的說明（wiki）。
 *
 * - 墨池的 tag 用空白，Danbooru 用底線；照模型收的舊名 Danbooru 自己會轉到現在的名字。
 * - 「看圖」照現在的分級篩：全年齡只看 rating:g，敏感看 g、s，色情不篩。全年齡查字不會跳出色情圖。
 * - 禁用的牌（未成年、學生、看起來像小孩、真人…）只看全年齡；永遠不抽的字（引擎的 NEVER_DRAW）不給「看圖」，只留說明。
 * - 新分頁開、不帶來源（no-referrer）：不讓對方知道是從本機的墨池點過去的。
 * 2026-11-27 專案主要的。
 */
import { el } from "./ui.js";
import { neverDraw } from "./engine.js";

const BASE = "https://danbooru.donmai.us";
// Danbooru 的分級：g 全年齡、s 敏感、q 可疑、e 露骨。墨池的敏感＝g、s；色情不篩。
const RATING_QUERY = { general: "rating:g", sensitive: "rating:g,s" };

export const danbooruTag = (tag) => String(tag || "").trim().replace(/\s+/g, "_");

/** 兩個網址。rating：現在的分級（ratingOf）；safe：這張牌只看全年齡（禁用的牌）。 */
export function danbooruUrls(tag, { rating = "explicit", safe = false } = {}) {
  const t = danbooruTag(tag);
  const filter = safe ? RATING_QUERY.general : RATING_QUERY[rating] || "";
  return {
    posts: neverDraw(tag) ? null : `${BASE}/posts?tags=${encodeURIComponent(filter ? `${t} ${filter}` : t)}`,
    wiki: `${BASE}/wiki_pages/${encodeURIComponent(t)}`,
  };
}

// 小紙箱（Danbooru 的名字就是「段ボール」）：墨池自己畫的線稿，跟字色走，深淺模式都看得清楚。
const BOX_SVG =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 1.6 14 4.6v6.8L8 14.4 2 11.4V4.6Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2 4.6 8 7.6l6-3M8 7.6v6.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5 3.1 11 6.1" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity=".55"/></svg>';

const link = (href, label, title) =>
  el("a", { class: "db-link", href, target: "_blank", rel: "noopener noreferrer", referrerpolicy: "no-referrer", title }, label, el("span", { class: "db-out", "aria-hidden": "true" }, "↗"));

/** 一排：紙箱＋Danbooru＋「看圖」「說明」。tag 沒有（自製牌）就不畫。 */
export function danbooruLinks(tag, opts = {}) {
  if (!tag) return null;
  const { posts, wiki } = danbooruUrls(tag, opts);
  const box = el("span", { class: "db-mark" }, "Danbooru");
  box.insertAdjacentHTML("afterbegin", BOX_SVG);
  return el(
    "span",
    { class: "db-links", role: "group", "aria-label": "在 Danbooru 查這個 tag" },
    box,
    posts ? link(posts, "看圖", opts.safe ? "在 Danbooru 看用這個 tag 的圖（這張牌只看全年齡）" : "在 Danbooru 看用這個 tag 的圖（照現在的分級篩選）") : null,
    link(wiki, "說明", "在 Danbooru 看這個 tag 的說明")
  );
}
