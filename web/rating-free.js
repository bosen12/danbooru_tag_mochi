/**
 * 頂欄分級（全年齡／敏感／色情）左邊的「不限制」開關，四頁共用。
 *
 * 開著：所有牌都不受分級限制（全年齡也抽得到敏感、色情的牌，字盒全部看得到），引擎照色情處理
 * （rules/rating.js 的 ratingOf）；每張成品的分級改照抽到的牌自動判斷（engine 的 contentRating），
 * 送 ComfyUI 的負面提示詞、Discord 分頻道都看它。分級鈕變淡、按不了 —— 開著的時候它不決定什麼。
 *
 * 開關本身在 HTML 裡（頂欄一畫出來就在，不會晚一步把分級鈕往右推）；這裡只接狀態。
 */
const TITLE_ON = "不限制開著：所有牌都不受全年齡／敏感／色情限制，每張的分級照抽到的牌自動判斷";
const TITLE_OFF = "不限制：打開後所有牌都不受全年齡／敏感／色情限制";

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
    for (const b of box.querySelectorAll("button")) b.disabled = on;
  };
  btn.addEventListener("click", () => {
    set(!get());
    paint();
  });
  paint();
  return paint;
}
