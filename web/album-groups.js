/**
 * 作品冊的自動分輯與找相似（album.js 用）。都從每件作品用到的牌算，不另外存。
 *   分輯：依時代、髮色、服裝、場景把作品分段，件數多的在前；沒有那一類牌的收在最後一段。
 *     一件作品只進一段：服裝先看時代服裝、連身，再看上衣、下身；場景用地點的細分類（學校職場、海邊水邊…）。
 *   找相似：兩件作品用到的牌重疊多少（Jaccard），跳過每張都有的人數牌。
 */
export const GROUPINGS = [
  ["none", "不分"],
  ["era", "時代"],
  ["hair", "髮色"],
  ["outfit", "服裝"],
  ["place", "場景"],
];

const OUTFIT_ORDER = ["era", "onepiece", "top", "bottom"];

function labelOf(w, mode, ctx) {
  if (mode === "era") return w.era ? ctx.eraZh[w.era] || w.era : null;
  const cards = ctx.cardsOf(w).map((t) => ctx.lib.byTag.get(t)).filter(Boolean);
  if (mode === "hair") return cards.find((c) => c.item.group === "hair_color")?.zh || null;
  if (mode === "outfit") {
    for (const g of OUTFIT_ORDER) {
      const c = cards.find((x) => x.item.group === g);
      if (c) return c.zh;
    }
    return null;
  }
  if (mode === "place") {
    const c = cards.find((x) => x.item.group === "place");
    // 細分類名「地點・學校職場」：段名只留後半。
    return c ? String(c.groupZh || c.zh).split("・").pop() : null;
  }
  return null;
}

/** works → [{ key, label, items }]，件數多的在前，沒有那一類牌的最後。 */
export function groupWorks(works, mode, ctx) {
  if (mode === "none") return [{ key: "all", label: "", items: works }];
  const map = new Map();
  const rest = [];
  for (const w of works) {
    const label = labelOf(w, mode, ctx);
    if (!label) {
      rest.push(w);
      continue;
    }
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(w);
  }
  const out = [...map.entries()].map(([label, items]) => ({ key: label, label, items })).sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, "zh-Hant"));
  const name = GROUPINGS.find(([v]) => v === mode)?.[1] || "";
  if (rest.length) out.push({ key: "_rest", label: mode === "era" ? "沒標時代" : `沒有${name}的牌`, items: rest, rest: true });
  return out;
}

/** 跟 w 最像的幾件：用到的牌重疊多的在前（至少要有兩成重疊）。telling(w)：w 用到、去掉人數牌的牌。 */
export function similarWorks(w, works, telling, n = 6) {
  const mine = new Set(telling(w));
  if (!mine.size) return [];
  const out = [];
  for (const x of works) {
    if (x === w || x.id === w.id) continue;
    const other = telling(x);
    if (!other.length) continue;
    let both = 0;
    for (const t of other) if (mine.has(t)) both += 1;
    const score = both / (mine.size + other.length - both);
    if (score >= 0.2) out.push({ work: x, score, both });
  }
  return out.sort((a, b) => b.score - a.score || b.both - a.both).slice(0, n);
}
