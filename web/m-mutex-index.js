/**
 * M-class mutex index (pool prefilter only).
 * Does not replace item._mx scans inside allow; does not encode S-class rules.
 */

const EMPTY = Object.freeze([]);
const EMPTY_SET = new Set();

function freezeIndex(tagToGroups, groupToTags, tagToSiblings, meta = {}) {
  return Object.freeze({
    kind: "M",
    generated: meta.generated || null,
    stats: meta.stats || null,
    tagToGroups,
    groupToTags,
    tagToSiblings,
    groupsOf(tag) {
      return tagToGroups.get(tag) || EMPTY;
    },
    siblingsOf(tag) {
      return tagToSiblings.get(tag) || EMPTY_SET;
    },
    isBusy(mutexTaken, tag) {
      const groups = tagToGroups.get(tag);
      if (!groups) return false;
      for (const g of groups) {
        const occ = mutexTaken.get(g);
        if (occ != null && occ !== tag) return true;
      }
      return false;
    },
    anyGroupTaken(mutexTaken, tag) {
      const groups = tagToGroups.get(tag);
      if (!groups) return false;
      for (const g of groups) {
        if (mutexTaken.has(g)) return true;
      }
      return false;
    },
  });
}

/**
 * @param {object} graph — parsed M conflict graph JSON (kind M)
 */
export function buildMutexIndex(graph) {
  if (!graph || graph.kind !== "M") {
    throw new Error("buildMutexIndex: expected kind M conflict graph");
  }
  const tagToGroups = new Map();
  for (const [tag, groups] of Object.entries(graph.tagToGroups || {})) {
    tagToGroups.set(tag, Object.freeze([...groups]));
  }
  const groupToTags = new Map();
  for (const [group, tags] of Object.entries(graph.groupToTags || {})) {
    groupToTags.set(group, Object.freeze([...tags]));
  }
  const tagToSiblings = new Map();
  for (const [tag, sibs] of Object.entries(graph.tagToSiblings || {})) {
    tagToSiblings.set(tag, new Set(sibs));
  }
  return freezeIndex(tagToGroups, groupToTags, tagToSiblings, {
    generated: graph.generated,
    stats: graph.stats,
  });
}

/**
 * Build the same M index from a live `indexLexicon()` result (browser-safe, no JSON).
 * @param {{ mutexOf: Map<string,string[]>, siblings: Map<string,string[]>, byTag: Map<string, any> }} lex
 */
export function buildMutexIndexFromLex(lex) {
  const groupToTags = new Map();
  for (const [g, tags] of lex.mutexOf || []) {
    groupToTags.set(g, Object.freeze([...tags]));
  }
  const tagToGroups = new Map();
  for (const [g, tags] of groupToTags) {
    for (const t of tags) {
      let arr = tagToGroups.get(t);
      if (!arr) {
        arr = [];
        tagToGroups.set(t, arr);
      }
      arr.push(g);
    }
  }
  for (const [t, arr] of tagToGroups) {
    tagToGroups.set(t, Object.freeze(arr));
  }
  const tagToSiblings = new Map();
  for (const [t, sibs] of lex.siblings || []) {
    tagToSiblings.set(t, new Set(sibs));
  }
  return freezeIndex(tagToGroups, groupToTags, tagToSiblings, {
    generated: "from-lex",
    stats: {
      tagsWithGroups: tagToGroups.size,
      groupCount: groupToTags.size,
    },
  });
}

/**
 * Pool prefilter via occupied-group → tag buckets (整桶跳過).
 * Dropped set ≡ tags for which anyGroupTaken(mutexTaken, tag) is true.
 *
 * @param {ReturnType<typeof buildMutexIndex>} idx
 * @param {Map<string,string>} mutexTaken
 * @param {Iterable<{tag:string}|string>} pool
 */
export function prefilterPoolByMutex(idx, mutexTaken, pool) {
  if (!mutexTaken || !mutexTaken.size) {
    const kept = Array.isArray(pool) ? pool.slice() : [...pool];
    return { kept, dropped: [], droppedTags: [] };
  }
  const blocked = new Set();
  for (const g of mutexTaken.keys()) {
    const tags = idx.groupToTags.get(g);
    if (!tags) continue;
    for (const t of tags) blocked.add(t);
  }
  const kept = [];
  const dropped = [];
  const droppedTags = [];
  for (const entry of pool) {
    const tag = typeof entry === "string" ? entry : entry.tag;
    if (blocked.has(tag)) {
      dropped.push(entry);
      droppedTags.push(tag);
    } else {
      kept.push(entry);
    }
  }
  return { kept, dropped, droppedTags };
}

export async function loadMutexIndexFromPath(path) {
  const { readFileSync } = await import("fs");
  const graph = JSON.parse(readFileSync(path, "utf8"));
  return buildMutexIndex(graph);
}
