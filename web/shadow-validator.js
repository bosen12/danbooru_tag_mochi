/** Pure, side-effect-free semantic validators used for shadow diagnostics. */

const SUPPORT_RULES = [
  {
    rule_id: "support:eating-prone",
    actors: new Set(["eating"]),
    forbidden: new Set(["on stomach"]),
    modes: ["normal", "diverse"],
    scope: "same_actor",
  },
  {
    rule_id: "support:cooking-supine",
    actors: new Set(["cooking"]),
    forbidden: new Set(["on back", "lying"]),
    modes: ["normal", "diverse"],
    scope: "same_actor",
  },
  {
    rule_id: "support:cooking-prone-normal",
    actors: new Set(["cooking"]),
    forbidden: new Set(["on stomach"]),
    modes: ["normal"],
    scope: "same_actor",
  },
  {
    rule_id: "support:wading-planted",
    actors: new Set(["wading"]),
    forbidden: new Set(["crawling", "on back"]),
    modes: ["normal", "diverse", "weird"],
    scope: "same_actor",
  },
];

function asSet(values) {
  if (values instanceof Set) return values;
  return new Set(Array.isArray(values) ? values : []);
}

function resolvedPeople(tags, people) {
  if (Number.isFinite(people)) return people;
  if (tags.has("solo")) return 1;
  return undefined;
}

export function validateSupportShadow({ tags, pinned = [], mode = "normal", people } = {}) {
  const present = asSet(tags);
  const pinnedTags = asSet(pinned);
  const castSize = resolvedPeople(present, people);
  const violations = [];

  for (const rule of SUPPORT_RULES) {
    if (!rule.modes.includes(mode)) continue;
    if (rule.scope === "same_actor" && castSize > 1) continue;

    const actors = [...rule.actors].filter((tag) => present.has(tag));
    const forbidden = [...rule.forbidden].filter((tag) => present.has(tag));
    if (!actors.length || !forbidden.length) continue;

    const evidence = [...actors, ...forbidden];
    const fullyPinned = evidence.every((tag) => pinnedTags.has(tag));
    violations.push({
      rule_id: rule.rule_id,
      dimension: "support",
      severity: fullyPinned ? "warning" : "hard",
      declared_severity: "hard",
      modes: [...rule.modes],
      scope: rule.scope,
      tags: evidence,
      origin: fullyPinned ? "pinned-conflict" : "auto-conflict",
    });
  }

  return violations;
}

const SUPPORT_CANDIDATE_TAGS = new Set();
for (const rule of SUPPORT_RULES) {
  for (const tag of rule.actors) SUPPORT_CANDIDATE_TAGS.add(tag);
  for (const tag of rule.forbidden) SUPPORT_CANDIDATE_TAGS.add(tag);
}

export { SUPPORT_CANDIDATE_TAGS };

// 舊寫法對每個候選複製整份 used，再跑兩次 shadow。四條規則的簽名只會因為
// 「候選字自己就是規則的一端」而變成新的 hard：字不在這張表裡、或已經在場上，
// 簽名不會變。新的 hard 一定含這個候選字，所以不可能早已出現在 before。
// 證據全部被釘選時仍是 warning，放行。
export function supportCandidateAllowed({ used, candidate, pinned = [], mode = "normal", people } = {}) {
  const tags = asSet(used);
  if (!candidate || !SUPPORT_CANDIDATE_TAGS.has(candidate) || tags.has(candidate)) return true;
  const pinnedTags = asSet(pinned);
  const castSize = resolvedPeople(tags, people);
  if (castSize > 1) return true;
  for (const rule of SUPPORT_RULES) {
    if (!rule.modes.includes(mode)) continue;
    const candActor = rule.actors.has(candidate);
    const candForbidden = rule.forbidden.has(candidate);
    if (!candActor && !candForbidden) continue;
    let partner = false;
    if (candActor) {
      for (const tag of rule.forbidden) {
        if (tags.has(tag)) {
          partner = true;
          break;
        }
      }
    }
    if (!partner && candForbidden) {
      for (const tag of rule.actors) {
        if (tags.has(tag)) {
          partner = true;
          break;
        }
      }
    }
    if (!partner) continue;
    const evidence = [];
    for (const tag of rule.actors) if (tag === candidate || tags.has(tag)) evidence.push(tag);
    for (const tag of rule.forbidden) if (tag === candidate || tags.has(tag)) evidence.push(tag);
    if (!evidence.every((tag) => pinnedTags.has(tag))) return false;
  }
  return true;
}
