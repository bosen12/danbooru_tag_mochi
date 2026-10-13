/** Shared same-seed draw hook. No DOM. web4 must not invent its own state machine.
 * Caller supplies the Intent snapshot (settings + pin/ban sets) and a fixed seed.
 * Uses the same drawOne shell + mulberry32 as boot batch path.
 */
import { drawOne, mulberry32 } from "./engine.js";
import { heatPresetOf, weightsForHeats } from "./heats.js";

/**
 * 這一張實際用的尺度。全年齡、尺度還是預設的「混合」（誘惑＋走光＋性愛，沒自己點過）時，
 * 走光、性愛本來就被分級擋掉，只剩誘惑 —— 第一次用的人第一張圖就偏誘惑。改成「活動」
 * （專案主 2026-10-14）。自己點過尺度的照自己選的；切到敏感、色情照舊是混合。
 * 墨池、疊印台的抽牌和尺度按鈕都用這個，畫面上亮的就是實際抽的。
 */
export function effectiveHeats(settings) {
  if (settings && settings.rating === "general" && heatPresetOf(settings.heats) === "mixed") return ["activity"];
  return settings ? settings.heats : [];
}

/** settings 換成實際的尺度（權重跟著換）；沒變就原樣回傳。 */
export function withEffectiveHeats(settings) {
  const heats = effectiveHeats(settings);
  if (!settings || heats === settings.heats) return settings;
  return { ...settings, heats, heatPreset: heatPresetOf(heats), weights: weightsForHeats(heats) };
}

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
