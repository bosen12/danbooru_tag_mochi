/** Small, readable views of a recipe. Generation rules stay in the engine. */
/** Pick actual tags from the candidate, using the same categories for all four. */
export function candidateSummary(trial, byTag) {
  const items = [...new Set([...(trial.mine || []), ...(trial.extra || [])])].map(tag => byTag.get(tag)).filter(Boolean);
  const categories = [
    ["髮色", x => x.group === "hair_color"],
    ["服裝", x => x.section === "clothing" && ["onepiece", "era", "top", "outer", "nude"].includes(x.group)],
    ["姿勢", x => x.section === "pose" && ["body", "activity"].includes(x.group)],
    ["場景", x => x.section === "env" && x.group === "place"],
  ];
  const out = categories.flatMap(([kind, matches]) => {
    const x = items.find(matches);
    return x ? [{ kind, tag: x.tag, label: x.zh || x.tag }] : [];
  });
  if (!out.length) {
    const x = items.find(x => x.section !== "quality");
    if (x) out.push({ kind: "特色", tag: x.tag, label: x.zh || x.tag });
  }
  return out;
}
