/**
 * 頂欄分級（全年齡／敏感／色情）左邊的「不限制」開關，四頁共用。
 *
 * 開著：所有牌都不受分級限制（全年齡也抽得到敏感、色情的牌，字盒全部看得到），引擎挑牌時照色情處理
 * （rules/rating.js 的 ratingOf）。分級鈕照樣能選：選的那一級是這張圖標的分級（提示詞尾巴、
 * 送 ComfyUI 的負面提示詞、Discord 分頻道、成品上的分級都看它）。
 *
 * 開關本身在 HTML 裡（頂欄一畫出來就在，不會晚一步把分級鈕往右推）；這裡只接狀態。
 */
import { toast, el } from "./ui.js";
import { heatBlockedByRating } from "./scene-policy.js";
import { RATING_LABEL } from "./rules/rating.js";
const TITLE_ON = "不限制開著：所有牌都不受全年齡／敏感／色情限制，右邊選的分級是圖本身標的分級";
const TITLE_OFF = "不限制：打開後所有牌都不受全年齡／敏感／色情限制";
// 按下去說一句：筆電、手機上開關旁邊常常沒有字，也沒有滑鼠提示，不說的話看不出它做了什麼。
const SAID_ON = "不限制開著：所有牌都抽得到；右邊選的分級是圖本身標的分級";
const SAID_OFF = "不限制關了：牌照右邊選的分級篩選";

const HEAT_LABEL = { activity: "活動", tease: "誘惑", flash: "走光", sex: "性愛" };

/**
 * 不限制開著、勾的尺度超過右邊選的分級（全年齡配走光、性愛）：這張圖會標成右邊那一級，內容卻可能更露骨，
 * Discord 也照那一級分頻道送。抽、印之前說一聲。回 { heats, need }（need：改成哪一級才相符）；沒有超過回 null。
 */
export function overreach(settings, heats) {
  if (!settings || !settings.ratingFree) return null;
  const over = (heats || []).filter((h) => heatBlockedByRating(h, settings.rating));
  if (!over.length) return null;
  return { heats: over, need: over.some((h) => heatBlockedByRating(h, "sensitive")) ? "explicit" : "sensitive" };
}

/** 那一行提醒（沒有超過回 null）：字＋一顆「分級改成 X」。按了點右邊那一級的分級鈕。 */
export function overreachLine(settings, heats, className = "rating-overreach") {
  const o = overreach(settings, heats);
  if (!o) return null;
  return el(
    "p",
    { class: className, role: "note" },
    el("span", {}, `這張會標成「${RATING_LABEL[settings.rating]}」，但尺度勾了${o.heats.map((h) => HEAT_LABEL[h] || h).join("、")}：內容可能比標的分級露骨`),
    " ",
    el("button", { class: "link-btn", type: "button", onclick: () => document.getElementById("rating")?.querySelector(`[data-v="${o.need}"]`)?.click() }, `分級改成${RATING_LABEL[o.need]}`)
  );
}

/** get()：現在開著沒；set(on)：存起來並重畫該重畫的。回傳 paint()，設定從別處改了（別的分頁）時叫。 */
export function mountRatingFree({ get, set }) {
  const btn = document.getElementById("rating-free");
  const box = document.getElementById("rating");
  if (!btn || !box) return () => {};
  const paint = () => {
    const on = !!get();
    btn.setAttribute("aria-checked", on ? "true" : "false");
    btn.title = on ? TITLE_ON : TITLE_OFF;
    box.dataset.free = on ? "true" : "false";
  };
  btn.addEventListener("click", () => {
    set(!get());
    paint();
    toast(get() ? SAID_ON : SAID_OFF);
  });
  paint();
  return paint;
}
