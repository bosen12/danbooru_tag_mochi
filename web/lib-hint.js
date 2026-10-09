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

export function searchMiss({ cards, q, query, reasons, className }) {
  // 最像搜尋字的牌先講：搜 kimono 要講「和服」，不是先講「和服敞開」被分級收起來
  // （解開了分級，和服本身還是被時代藏著）。完全相同 → 開頭相同 → 包含。
  const score = (c) => {
    const zh = c.zh.toLowerCase();
    if (c.tag === q || zh === q) return 0;
    if (c.tag.startsWith(q) || zh.startsWith(q)) return 1;
    return 2;
  };
  const matches = cards
    .filter((c) => c.zh.toLowerCase().includes(q) || c.tag.includes(q))
    .sort((a, b) => score(a) - score(b));
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
