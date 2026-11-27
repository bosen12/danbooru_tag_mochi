/**
 * 成品牆滿了要裁哪幾張（app.js 的 trimWall 用）。shots 是牆上的順序：新的在前面。
 *
 * - 只抽牌的（status "drawn"，不存檔）和印過的各算各的 max 張：以前一起算，一口氣只抽幾十張，
 *   就把前面印好的圖擠出牆、也擠出存檔。
 * - 印過的那一堆先裁沒印出來的（失敗、取消、停掉的），還超過才裁印好的；收藏過的（albumId）最後才裁。都從最舊的開始。
 * - 還在跑的（排著、在印、Hires／修臉排著或在做）一張都不裁：裁掉的話後端照畫，畫好卻沒地方放。
 *   全都在跑的時候就暫時超過上限。
 */
export const shotBusy = (s) => s.status === "queued" || s.status === "running" || (!!s.hi && (s.hi.status === "queued" || s.hi.status === "running"));
const shotWaste = (s) => s.status === "failed" || s.status === "cancelled" || s.status === "stopped";

export function pickTrim(shots, max) {
  if (shots.length <= max) return [];
  const age = new Map(shots.map((s, i) => [s, i]));
  const drop = [];
  const cut = (pile, rank) => {
    const over = pile.length - max;
    if (over <= 0) return;
    const order = pile.filter((s) => !shotBusy(s)).sort((a, b) => rank(a) - rank(b) || age.get(b) - age.get(a));
    drop.push(...order.slice(0, over));
  };
  cut(shots.filter((s) => s.status === "drawn"), () => 0);
  cut(shots.filter((s) => s.status !== "drawn"), (s) => (shotWaste(s) ? 0 : s.albumId ? 2 : 1));
  return drop;
}
