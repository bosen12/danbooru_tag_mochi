/** Shared same-seed draw hook. No DOM. web4 must not invent its own state machine.
 * Caller supplies the Intent snapshot (settings + pin/ban sets) and a fixed seed.
 * Uses the same drawOne shell + mulberry32 as boot batch path.
 */
import { drawOne, mulberry32 } from "./engine.js";

/**
 * @param {object} lex
 * @param {object} settings — live or frozen settings object
 * @param {Set<string>} pinned
 * @param {Set<string>} banned
 * @param {number} seedNum
 * @param {object} [opts] — drawOne opts (onStage, signal, trace, presetOwned, …)
 */
export function drawWithSeed(lex, settings, pinned, banned, seedNum, opts = {}) {
  const seed = Number(seedNum) >>> 0;
  const rng = mulberry32(seed);
  return drawOne(
    lex,
    settings,
    pinned instanceof Set ? pinned : new Set(pinned || []),
    banned instanceof Set ? banned : new Set(banned || []),
    rng,
    seed,
    opts
  );
}
