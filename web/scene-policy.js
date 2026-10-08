/**
 * Single source for sceneMode → { lockScene, realistic } and rating × heat blocks.
 * Engine gates and UI (boot) must read this — no scattered ifs, no silent diverse.
 */

export const SCENE_MODES = ["normal", "diverse", "weird"];
export const SCENE_MODE_LABELS = { normal: "正常", diverse: "多元", weird: "奇葩" };

/** Contract table — diverse MUST keep lockScene (G2 / R2). */
export const SCENE_POLICY = Object.freeze({
  normal: Object.freeze({ lockScene: true, realistic: true }),
  diverse: Object.freeze({ lockScene: true, realistic: false }),
  weird: Object.freeze({ lockScene: false, realistic: false }),
});

/**
 * Resolve sceneMode. Missing sceneMode: lockScene===false → weird, else normal.
 * Never invents "diverse" from booleans alone.
 */
export function sceneModeOf(settings) {
  const m = settings && settings.sceneMode;
  if (SCENE_MODES.includes(m)) return m;
  if (settings && settings.lockScene === false) return "weird";
  return "normal";
}

export function scenePolicyOf(settings) {
  const mode = sceneModeOf(settings);
  return { mode, ...SCENE_POLICY[mode] };
}

export function lockSceneOn(settings) {
  return scenePolicyOf(settings).lockScene;
}

export function realisticOn(settings) {
  return scenePolicyOf(settings).realistic;
}

/** Rating × heat — UI grey-out and allow must share this (Y1). */
export const RATING_BLOCKS_HEAT = Object.freeze({
  general: Object.freeze(["flash", "sex"]),
  sensitive: Object.freeze([]),
  explicit: Object.freeze([]),
});

export function heatsBlockedByRating(rating) {
  return RATING_BLOCKS_HEAT[rating] || [];
}

export function heatBlockedByRating(heat, rating) {
  return heatsBlockedByRating(rating).includes(heat);
}

/** Heats still allowed after the rating wall. */
export function heatsAllowedByRating(heats, rating) {
  const blocked = heatsBlockedByRating(rating);
  if (!blocked.length) return heats || [];
  return (heats || []).filter((h) => !blocked.includes(h));
}
