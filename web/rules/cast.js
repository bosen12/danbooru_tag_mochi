/** Cast / gender / person-count rules. No UI copy. */
import { REASONS } from "../trace.js";

export const FEMALE_COUNT = new Set(["1girl", "2girls", "3girls", "4girls", "5girls", "6+girls", "multiple girls"]);
export const MALE_COUNT = new Set(["1boy", "2boys", "3boys", "4boys", "6+boys", "multiple boys"]);
export const COUNT_NUM = {
  "1girl": 1,
  "2girls": 2,
  "3girls": 3,
  "4girls": 4,
  "5girls": 5,
  "6+girls": 6,
  "multiple girls": 2,
  "1boy": 1,
  "2boys": 2,
  "3boys": 3,
  "4boys": 4,
  "6+boys": 6,
  "multiple boys": 2,
};

export function hasFemale(cast) {
  return cast.some((t) => FEMALE_COUNT.has(t));
}
export function hasMale(cast) {
  return cast.some((t) => MALE_COUNT.has(t));
}
export function personCount(cast) {
  let n = 0;
  for (const t of cast) {
    const add = COUNT_NUM[t];
    if (add) n += add;
  }
  return n;
}

export function genderCount(cast, female) {
  const keys = female ? FEMALE_COUNT : MALE_COUNT;
  let n = 0;
  for (const t of cast) {
    if (keys.has(t)) n += COUNT_NUM[t] || 0;
  }
  return n;
}

export function gateOk(item, female, male) {
  if (item.gate === "female") return female;
  if (item.gate === "male") return male;
  return true;
}

export function castOk(item, female, male, people, girls = 0, boys = 0) {
  const needs = item.needs || [];
  if (needs.includes("pair") && people < 2) return false;
  if (needs.includes("group") && people < 3) return false;
  if (needs.includes("crowd") && people < 4) return false;
  if (needs.includes("five") && people < 5) return false;
  if (needs.includes("male") && !male) return false;
  if (needs.includes("female") && !female) return false;
  if (needs.includes("2male") && boys < 2) return false;
  if (needs.includes("2female") && girls < 2) return false;
  // 磨鏡的 needs 寫了 yuri。百合這個字本身的 needs 只有 pair、female，
  // 以前 1girl+1boy 也算過關。兩個都是不要男生。
  if ((needs.includes("yuri") || item.tag === "yuri") && male) return false;
  // 男同性戀題材對照百合：有女生就不成立。兄弟不是這一條。
  if ((needs.includes("yaoi") || item.tag === "yaoi") && female) return false;
  return true;
}


export function evaluateCast(item, female, male, people, girls = 0, boys = 0) {
  if (!item) return { ok: false, reason: REASONS.cast_mismatch };
  if (!gateOk(item, female, male) || !castOk(item, female, male, people, girls, boys)) {
    return { ok: false, reason: REASONS.cast_mismatch };
  }
  return { ok: true };
}
