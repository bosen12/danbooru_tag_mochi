/** Draw trace: stable reason codes, no UI copy. */

export const TRACE_SCHEMA = 1;

export const SOURCES = Object.freeze({
  pin: "pin",
  preset: "preset",
  must_draw: "must_draw",
  random: "random",
  implies: "implies",
  bind: "bind",
  era_anchor: "era_anchor",
  repair: "repair",
  fixed: "fixed",
  lora_trigger: "lora_trigger",
});

export const REASONS = Object.freeze({
  mutex: "mutex",
  extra_mutex: "extra_mutex",
  user_ban: "user_ban",
  heat_mismatch: "heat_mismatch",
  rating_mismatch: "rating_mismatch",
  era_mismatch: "era_mismatch",
  cast_mismatch: "cast_mismatch",
  pose_activity_conflict: "pose_activity_conflict",
  scene_activity_conflict: "scene_activity_conflict",
  sport_place_mismatch: "sport_place_mismatch",
  clothing_layer: "clothing_layer",
  underwear_hidden: "underwear_hidden",
  missing_dependency: "missing_dependency",
  reconcile: "reconcile",
  repair_remove: "repair_remove",
  replaced: "replaced",
});

export const STAGES = Object.freeze({
  pin: "pin",
  commit: "commit",
  fill: "fill",
  scene_guard: "scene_guard",
  must_draw: "must_draw",
  repair: "repair",
  reconcile: "reconcile",
  tail: "tail",
});

export const TRACE_SECTIONS = Object.freeze(["subject", "feature", "clothing", "pose", "env", "quality"]);

const SOURCE_SET = new Set(Object.values(SOURCES));
const REASON_SET = new Set(Object.values(REASONS));

export function isSource(value) {
  return SOURCE_SET.has(value);
}

export function isReason(value) {
  return REASON_SET.has(value);
}

function freezeEvent(raw) {
  const related = Array.isArray(raw.related) ? raw.related.filter(Boolean).map(String) : [];
  const event = {
    tag: String(raw.tag || ""),
    status: raw.status === "rejected" ? "rejected" : "kept",
    source: SOURCE_SET.has(raw.source) ? raw.source : SOURCES.random,
    stage: String(raw.stage || STAGES.commit),
  };
  if (raw.parent) event.parent = String(raw.parent);
  if (event.status === "rejected") event.reason = REASON_SET.has(raw.reason) ? raw.reason : REASONS.mutex;
  if (related.length) event.related = related;
  if (raw.detail && typeof raw.detail === "object") event.detail = raw.detail;
  return event;
}

export function createTracer({ enabled = false, debug = false } = {}) {
  const events = [];
  const seenReject = new Set();
  const on = !!enabled;
  const debugOn = !!debug;
  return {
    enabled: on,
    debug: debugOn,
    keep(raw) {
      if (!on) return;
      const event = freezeEvent({ ...raw, status: "kept" });
      if (!event.tag) return;
      events.push(event);
    },
    reject(raw) {
      if (!on) return;
      const event = freezeEvent({ ...raw, status: "rejected" });
      if (!event.tag) return;
      const key = event.tag + "\0" + event.reason + "\0" + (event.related || []).join(",");
      if (seenReject.has(key)) return;
      seenReject.add(key);
      events.push(event);
    },
    events() {
      return events.slice();
    },
  };
}

export function summarizeTrace(events, { finalTags, pinned, presetOwned, mustTags, debug = false } = {}) {
  const final = new Set(finalTags || []);
  const pin = pinned instanceof Set ? pinned : new Set(Array.isArray(pinned) ? pinned : []);
  const preset =
    presetOwned instanceof Set
      ? presetOwned
      : new Set(Array.isArray(presetOwned) ? presetOwned : Array.isArray(presetOwned?.tags) ? presetOwned.tags : []);
  const must = mustTags instanceof Set ? mustTags : new Set(mustTags || []);
  const kept = [];
  const seenKeep = new Set();
  const rejected = [];
  const seenReject = new Set();
  for (const event of events || []) {
    if (!event || !event.tag) continue;
    if (event.status === "kept") {
      if (!final.has(event.tag) || seenKeep.has(event.tag)) continue;
      seenKeep.add(event.tag);
      kept.push(event);
      continue;
    }
    if (event.status !== "rejected") continue;
    const important =
      debug ||
      pin.has(event.tag) ||
      preset.has(event.tag) ||
      must.has(event.tag) ||
      event.reason === REASONS.replaced ||
      event.reason === REASONS.reconcile ||
      event.reason === REASONS.repair_remove ||
      event.reason === REASONS.rating_mismatch ||
      event.reason === REASONS.user_ban;
    if (!important) continue;
    if (final.has(event.tag)) continue;
    const key = event.tag + "\0" + event.reason;
    if (seenReject.has(key)) continue;
    seenReject.add(key);
    rejected.push(event);
  }
  for (const tag of pin) {
    if (final.has(tag) || seenReject.has(tag + "\0")) continue;
    if (kept.some((e) => e.tag === tag)) continue;
    if ([...seenReject].some((k) => k.startsWith(tag + "\0"))) continue;
    rejected.push({
      tag,
      status: "rejected",
      source: preset.has(tag) ? SOURCES.preset : SOURCES.pin,
      stage: STAGES.pin,
      reason: REASONS.reconcile,
    });
  }
  return {
    schema: TRACE_SCHEMA,
    kept,
    rejected,
  };
}

export function traceSummaryForRecipe(summary) {
  const cut = (list, n) => (list || []).slice(0, n).map((e) => ({
    tag: e.tag,
    status: e.status,
    source: e.source,
    stage: e.stage,
    reason: e.reason,
    parent: e.parent,
    related: e.related,
  }));
  return {
    schema: TRACE_SCHEMA,
    kept: cut(summary && summary.kept, 80),
    rejected: cut(summary && summary.rejected, 40),
  };
}
