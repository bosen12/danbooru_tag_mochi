/**
 * 字盒搜不到時說清楚為什麼，並給一顆按鈕直接解開（墨池的字盒、疊印台的找牌框共用）。
 *
 * 以前只寫「可能被分級、性別或時代收起來了」：使用者看不出是哪一個，也不知道去哪裡改。
 * 新字（例如只在色情分級才看得到的乳堆）最常卡在這裡。
 *
 * reasons 依序檢查，第一個藏住某張符合的牌的原因就是答案：
 *   { hides(card) → bool, text(card) → 句子, label(card) → 按鈕字, run(card) → 解開（沒有 run 就只說明） }
 */
import { el } from "./ui.js";
import { cardMatches, matchRank } from "./cards.js";

export function searchMiss({ cards, q, query, reasons, className }) {
  // 最像搜尋字的牌先講：搜 kimono 要講「和服」，不是先講「和服敞開」被分級收起來
  // （解開了分級，和服本身還是被時代藏著）。比法跟字盒同一套（cards.js 的 cardMatches、matchRank：
  // 簡體、底線、空白分開每段都要有）。
  const matches = cards.filter((c) => cardMatches(c, q)).sort((a, b) => matchRank(a, q) - matchRank(b, q));
  for (const card of matches) {
    const reason = reasons.find((r) => r.hides(card));
    if (!reason) continue;
    return el(
      "p",
      { class: `${className} lib-hint` },
      el("span", {}, reason.text(card)),
      reason.run ? el("button", { class: "btn btn-small", type: "button", onclick: () => reason.run(card) }, reason.label(card)) : null
    );
  }
  return el("p", { class: className }, `字盒裡沒有「${query}」。`);
}

/**
 * 搜得到、但還有符合的牌被分級、性別、時代…收起來（現代搜「吊燈」，維多利亞的吊燈被時代藏著；
 * 沒開男生搜「胖」，肥胖是男生的牌）：以前完全不說，看起來像詞庫只有這幾張。
 * 回「另有 N 張沒列出：原因［解開］」給 searchNote 放在牌格上面一行；沒有就回 null。
 * cards 只放解開之後會出現在這一格的牌（同一個花色、細分類）；reasons 跟 searchMiss 同一套，
 * 但不放「在別的花色裡」那條：花色、分類是自己點的，不是被藏起來。
 */
export function searchAlso({ cards, shown, q, reasons }) {
  if (!q) return null;
  const have = new Set(shown);
  let n = 0;
  let best = null;
  for (const card of cards) {
    if (have.has(card) || !cardMatches(card, q)) continue;
    const reason = reasons.find((r) => r.hides(card));
    if (!reason) continue;
    n += 1;
    const rank = matchRank(card, q);
    if (!best || rank < best.rank) best = { card, reason, rank };
  }
  if (!best) return null;
  const { card, reason } = best;
  return el(
    "span",
    { class: "search-also", dataset: { key: `${n}|${card.tag}|${reasons.indexOf(reason)}` } },
    el("span", {}, n > 1 ? `另有 ${n} 張沒列出，例如` : "另有 1 張沒列出："),
    el("span", {}, reason.text(card)),
    reason.run ? el("button", { class: "btn btn-small", type: "button", onclick: () => reason.run(card) }, reason.label(card)) : null
  );
}
