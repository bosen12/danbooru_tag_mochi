/** Small, readable views of a recipe. Generation rules stay in the engine. */
const CATEGORIES = [
  ["髮色", x => x.group === "hair_color"],
  ["服裝", x => x.section === "clothing" && ["onepiece", "era", "top", "outer", "nude"].includes(x.group)],
  ["姿勢", x => x.section === "pose" && ["body", "activity"].includes(x.group)],
  ["場景", x => x.section === "env" && x.group === "place"],
];

/**
 * Pick actual tags from the candidate, using the same categories for all four.
 * pinned：版上釘住的牌。這一種由釘住的牌決定的（髮色釘了紅髮），四張一定一樣，摘要不再寫它。
 */
export function candidateSummary(trial, byTag, { pinned = null } = {}) {
  const items = [...new Set([...(trial.mine || []), ...(trial.extra || [])])].map(tag => byTag.get(tag)).filter(Boolean);
  const out = CATEGORIES.flatMap(([kind, matches]) => {
    if (pinned && items.some(y => pinned.has(y.tag) && matches(y))) return [];
    const x = items.find(matches);
    return x ? [{ kind, tag: x.tag, label: x.zh || x.tag }] : [];
  });
  if (!out.length) {
    const x = items.find(x => x.section !== "quality" && !(pinned && pinned.has(x.tag)));
    if (x) out.push({ kind: "特色", tag: x.tag, label: x.zh || x.tag });
  }
  return out;
}

/**
 * 四張試印的摘要一起看：釘住的牌決定的那一種跳過；剩下四張都一樣的（四張都是長髮）收成一行 same，
 * 每張自己只列跟別張不一樣的。rows[i] 是第 i 張的；四張完全一樣時 rows 都是空的、全部在 same。
 */
export function trialSummaries(trials, byTag, pinned = null) {
  const per = trials.map(t => (t ? candidateSummary(t, byTag, { pinned }) : []));
  if (per.length < 2) return { rows: per, same: [] };
  const first = per[0];
  const same = first.filter(x => per.every(list => list.some(y => y.kind === x.kind && y.tag === x.tag)));
  const kinds = new Set(same.map(x => x.kind));
  return { rows: per.map(list => list.filter(x => !kinds.has(x.kind))), same };
}
