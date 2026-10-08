/** Shared heat constants. Imported by engine and rating rules. */

export const HEATS = ["activity", "tease", "flash", "sex"];
export const MIXED_HEATS = ["tease", "flash", "sex"];

export function toggleHeat(heats, heat) {
  const on = new Set((heats || []).filter((h) => HEATS.includes(h)));
  if (heat === "mixed") return MIXED_HEATS.slice();
  if (!HEATS.includes(heat)) return HEATS.filter((h) => on.has(h));
  if (on.has(heat)) {
    if (on.size <= 1) return HEATS.filter((h) => on.has(h));
    on.delete(heat);
  } else {
    on.add(heat);
  }
  return HEATS.filter((h) => on.has(h));
}

export function heatPresetOf(heats) {
  const h = HEATS.filter((x) => (heats || []).includes(x));
  if (h.length === 3 && MIXED_HEATS.every((x) => h.includes(x))) return "mixed";
  if (h.length === 1) return h[0];
  return "custom";
}

export function weightsForHeats(heats, heatWeights) {
  const h = HEATS.filter((x) => (heats || []).includes(x));
  if (!h.length) return { activity: 0, tease: 1, flash: 0, sex: 0 };
  if (h.length === 3 && MIXED_HEATS.every((x) => h.includes(x)) && heatWeights && heatWeights.mixed) {
    return { activity: 0, tease: 0, flash: 0, sex: 0, ...heatWeights.mixed };
  }
  const w = { activity: 0, tease: 0, flash: 0, sex: 0 };
  const share = 1 / h.length;
  for (const x of h) w[x] = share;
  return w;
}
