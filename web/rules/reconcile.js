/** Reconcile / tail-repair diff. The reconcile algorithm stays in engine (order-dependent). */
import { REASONS, STAGES } from "../trace.js";

export function diffKept(before, after) {
  const prev = before instanceof Set ? before : new Set(before || []);
  const next = after instanceof Set ? after : new Set(after || []);
  const removed = [];
  for (const tag of prev) if (!next.has(tag)) removed.push(tag);
  const added = [];
  for (const tag of next) if (!prev.has(tag)) added.push(tag);
  return { removed, added };
}

export function rejectRemoved(tracer, removed, { sourceOf, reason = REASONS.reconcile, stage = STAGES.reconcile } = {}) {
  if (!tracer || !tracer.enabled) return;
  for (const tag of removed || []) {
    const src = typeof sourceOf === "function" ? sourceOf(tag) : "random";
    tracer.reject({ tag, source: src, stage, reason });
  }
}
