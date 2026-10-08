/**
 * 三分鐘版介紹影片（film.js）的配樂：全部用 Web Audio 現場合成，沒有借來的音樂檔。
 *
 * 128 BPM、4/4，一小節 1.875 秒，96 小節＝剛好三分鐘。D 小調，和弦 Dm – B♭ – F – C（add9）。
 * 舊的兩分鐘版是 96 BPM：舊的一小節 2.5 秒，快 4/3 倍正好是這裡的一小節 ——
 * film.js 把舊版的場景加速 4/3 倍接進來，原本對在拍子上的東西，在這裡也對在拍子上。
 *
 * 段落（小節）：
 *   0–8    intro   鋪底、心跳一樣的大鼓，濾波慢慢打開，第 7 小節軍鼓滾奏
 *   8–10   title   標題：撞擊、低音下沉，鐘聲彈一次主旋律的開頭
 *   10–25  verse   四拍大鼓、低音八分、撥弦琶音；12 起拍手、16 起十六分 hi-hat
 *   25–46  chorus  和弦一小節換一個；29 起柔和的主旋律
 *   46–51  break   大鼓抽掉、半速拍手，最後兩小節滾奏、上升
 *   51–66  drop    全部樂器、supersaw 主旋律、sidechain 抽吸
 *   66–72  half    半速鼓組（快剪的段落）
 *   72–78  drop2   再回到四拍
 *   78–86  final   最大的一段：主旋律疊八度、鐘聲
 *   86–92  outro   鼓退掉，鐘聲、琶音收尾
 *   92–96  end     最後的和弦，淡出
 *
 * 用法：createScore(畫面的音效) → play(秒)／pause()／now()／render()（引擎在 synth-engine.js，教學影片共用）。
 */

export const BPM = 128;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const BARS = 96;
export const LENGTH = BAR * BARS;
export const bar = (n, beat = 0) => n * BAR + beat * BEAT;

import { createEngine, hz, hzOf, up } from "./synth-engine.js";

const CHORDS = [
  { root: "D", notes: [["D", 3], ["F", 3], ["A", 3], ["E", 4]] }, // Dm(add9)
  { root: "Bb", notes: [["Bb", 2], ["D", 3], ["F", 3], ["C", 4]] }, // B♭(add9)
  { root: "F", notes: [["F", 3], ["A", 3], ["C", 4], ["G", 4]] }, // F(add9)
  { root: "C", notes: [["C", 3], ["E", 3], ["G", 3], ["D", 4]] }, // C(add9)
];

export const PLAN = [
  { from: 0, to: 8, kind: "intro" },
  { from: 8, to: 10, kind: "title" },
  { from: 10, to: 25, kind: "verse" },
  { from: 25, to: 46, kind: "chorus" },
  { from: 46, to: 51, kind: "break" },
  { from: 51, to: 66, kind: "drop" },
  { from: 66, to: 72, kind: "half" },
  { from: 72, to: 78, kind: "drop2" },
  { from: 78, to: 86, kind: "final" },
  { from: 86, to: 92, kind: "outro" },
  { from: 92, to: 96, kind: "end" },
];
export const secAt = (b) => PLAN.find((p) => b >= p.from && b < p.to) || PLAN[PLAN.length - 1];
// 和弦一小節換一個的段落（其他兩小節一個）。
const FAST = new Set(["chorus", "drop", "half", "drop2", "final"]);
const DRUMS = new Set(["verse", "chorus", "drop", "half", "drop2", "final"]);
const chordAt = (b) => {
  const s = secAt(b);
  const i = b - s.from;
  return CHORDS[(FAST.has(s.kind) ? i : Math.floor(i / 2)) % 4];
};

/**
 * 主旋律（四小節一句，跟著 Dm – B♭ – F – C）：[拍, 長度（拍）, 音]。
 * 3＋3＋2 的十六分切分，是這首的鉤子。第二句最後一小節換個收尾。
 */
const HOOK = [
  [[0, 0.75, "A4"], [0.75, 0.75, "A4"], [1.5, 0.5, "C5"], [2, 1, "D5"], [3, 0.5, "C5"], [3.5, 0.5, "A4"]],
  [[0, 0.75, "F4"], [0.75, 0.75, "F4"], [1.5, 0.5, "G4"], [2, 1.5, "A4"], [3.5, 0.5, "G4"]],
  [[0, 0.75, "A4"], [0.75, 0.75, "C5"], [1.5, 0.5, "D5"], [2, 1, "E5"], [3, 0.5, "D5"], [3.5, 0.5, "C5"]],
  [[0, 1.5, "E5"], [1.5, 0.5, "D5"], [2, 1, "C5"], [3, 1, "G4"]],
];
const HOOK_END = [[0, 0.75, "E5"], [0.75, 0.75, "F5"], [1.5, 0.5, "E5"], [2, 2, "D5"]];

/** 整首歌的事件表（{ t, dur, kind, ...參數 }），照時間排好。純資料，跟播放無關。 */
export function buildEvents(extraCues = []) {
  const ev = [];
  const add = (t, dur, kind, o = {}) => ev.push({ t, dur, kind, ...o });

  // ---- 和聲：鋪底、低音、琶音 ----
  for (let b = 0; b < 92; b++) {
    const s = secAt(b);
    const ch = chordAt(b);
    const fast = FAST.has(s.kind);
    const head = fast || (b - s.from) % 2 === 0;
    const bright = { intro: 0.15 + (b / 8) * 0.45, title: 0.7, verse: 0.55, chorus: 0.75, break: 0.4, drop: 0.95, half: 0.8, drop2: 0.95, final: 1, outro: 0.5 }[s.kind] ?? 0.5;
    if (head) {
      const span = fast ? 1 : Math.min(2, s.to - b);
      add(bar(b), BAR * span + 0.3, "pad", { notes: ch.notes, bright, gain: s.kind === "intro" ? 0.07 + b * 0.006 : s.kind === "break" || s.kind === "outro" ? 0.12 : 0.1, duck: DRUMS.has(s.kind) });
    }
    // 低音
    if (s.kind === "verse") {
      add(bar(b), BAR, "sub", { f: hz(ch.root, 1), gain: 0.2 });
      for (let q = 0; q < 8; q++) add(bar(b) + (q * BEAT) / 2, BEAT * 0.4, "bassPluck", { f: hz(ch.root, q % 4 === 3 ? 3 : 2), gain: q % 2 ? 0.09 : 0.12 });
    } else if (s.kind === "chorus" || s.kind === "drop" || s.kind === "drop2" || s.kind === "final" || s.kind === "half") {
      add(bar(b), BAR, "sub", { f: hz(ch.root, 1), gain: 0.24 });
      for (let q = 0; q < 8; q++) {
        const off = q % 2 === 1;
        add(bar(b) + (q * BEAT) / 2, BEAT * 0.45, "bassPluck", { f: hz(ch.root, off ? 3 : 2), gain: off ? 0.14 : 0.07, cut: s.kind === "chorus" ? 0.8 : 1.2 });
      }
    } else if (s.kind === "break" || s.kind === "title" || s.kind === "outro") {
      if (head) add(bar(b), BAR * 2, "sub", { f: hz(ch.root, 1), gain: 0.16 });
    } else if (s.kind === "intro" && b >= 4 && head) {
      add(bar(b), BAR * 2, "sub", { f: hz(ch.root, 1), gain: 0.1 + (b - 4) * 0.02 });
    }
    // 撥弦琶音：十六分，上行再下行。
    if (s.kind !== "title" && !(s.kind === "intro" && b < 2)) {
      const seq = [0, 1, 2, 3, 2, 1, 2, 3];
      const hot = s.kind === "drop" || s.kind === "drop2" || s.kind === "final";
      const step = s.kind === "outro" || s.kind === "break" ? 2 : 1;
      for (let i = 0; i < 16; i += step) {
        const n = ch.notes[seq[i % 8]];
        const oct = n[1] + 1 + (hot && i % 8 >= 4 ? 1 : 0);
        const cut = s.kind === "intro" ? 1.2 + ((b - 2) / 6) * 4 : s.kind === "outro" ? 4 - ((b - 86) / 6) * 2.5 : hot ? 7 : 5;
        add(bar(b) + (i * BEAT) / 4, BEAT * 0.5, "pluck", { f: hz(n[0], oct), gain: (hot ? 0.045 : 0.05) * (i % 4 === 0 ? 1.3 : 1), cut, pan: i % 2 ? 0.35 : -0.35, duck: DRUMS.has(s.kind) });
      }
    }
  }

  // ---- 主旋律 ----
  const phrase = (b0, bars, voice, o = {}) => {
    for (let k = 0; k < bars; k++) {
      const idx = k % 4;
      const second = Math.floor(k / 4) % 2 === 1;
      const line = idx === 3 && second ? HOOK_END : HOOK[idx];
      for (const [beat, len, note] of line) {
        add(bar(b0 + k, beat), len * BEAT, voice, { f: hzOf(note), gain: o.gain ?? 0.1, duck: o.duck });
        if (o.double) add(bar(b0 + k, beat), len * BEAT, voice, { f: hzOf(up(note, 1)), gain: (o.gain ?? 0.1) * 0.45, duck: o.duck });
      }
    }
  };
  // 標題：鐘聲彈一次開頭。
  for (const [beat, len, note] of [...HOOK[0], ...HOOK[1].map(([b, l, n]) => [b + 4, l, n])]) add(bar(8, beat), len * BEAT * 1.6, "bell", { f: hzOf(up(note, 1)), gain: 0.07 });
  phrase(29, 16, "soft", { gain: 0.07, duck: true });
  phrase(51, 15, "lead", { gain: 0.085, duck: true });
  phrase(72, 6, "lead", { gain: 0.085, duck: true });
  phrase(78, 8, "lead", { gain: 0.09, duck: true, double: true });
  for (let k = 0; k < 8; k++) {
    const [beat, , note] = HOOK[k % 4][0];
    add(bar(78 + k, beat), BAR, "bell", { f: hzOf(up(note, 1)), gain: 0.05 });
  }
  // 收尾：鐘聲慢慢彈主旋律的骨架。
  const tail = [["D5", 86], ["A4", 87], ["F5", 88], ["E5", 89], ["C5", 90], ["D5", 91]];
  for (const [n, b] of tail) add(bar(b), BAR * 2, "bell", { f: hzOf(n), gain: 0.08 });
  add(bar(92), BAR * 4, "pad", { notes: [["D", 3], ["A", 3], ["D", 4], ["E", 4], ["F", 4]], bright: 0.8, gain: 0.13 });
  add(bar(92), BAR * 4, "bell", { f: hz("D", 5), gain: 0.14 });
  add(bar(92, 2), BAR * 3.4, "bell", { f: hz("A", 5), gain: 0.08 });
  add(bar(92), BAR * 3, "sub", { f: hz("D", 1), gain: 0.2 });

  // ---- 鼓 ----
  for (let b = 0; b < 92; b++) {
    const s = secAt(b);
    const i = b - s.from;
    if (s.kind === "intro") {
      // 心跳：先一小節一下，再兩下，最後四拍。
      if (b >= 1 && b < 4) add(bar(b), 0.4, "kick", { gain: 0.5 });
      else if (b >= 4 && b < 6) for (const q of [0, 2]) add(bar(b, q), 0.4, "kick", { gain: 0.55 });
      else if (b === 6) for (let q = 0; q < 4; q++) add(bar(b, q), 0.4, "kick", { gain: 0.6, duck: 0.3 });
      continue;
    }
    if (!DRUMS.has(s.kind)) continue;
    const full = s.kind !== "verse";
    for (let q = 0; q < 4; q++) {
      const t = bar(b, q);
      if (s.kind === "half") {
        if (q === 0) add(t, 0.4, "kick", { gain: 0.72, duck: 0.6 });
        if (q === 2) add(t + BEAT / 2, 0.4, "kick", { gain: 0.6, duck: 0.5 });
        if (q === 2) add(t, 0.25, "snare", { gain: 0.2 });
      } else {
        add(t, 0.4, "kick", { gain: full ? 0.74 : 0.66, duck: s.kind === "chorus" ? 0.45 : full ? 0.65 : 0.35 });
        if ((q === 1 || q === 3) && (full || i >= 2)) add(t, 0.2, "clap", { gain: full ? 0.15 : 0.12 });
      }
      // hi-hat：反拍一下；十六分的從 verse 第 6 小節、其他段一開始就有。
      add(t + BEAT / 2, 0.06, full ? "ohat" : "hat", { gain: full ? 0.045 : 0.05, pan: 0.2 });
      if (full || i >= 6) for (const k of [1, 3]) add(t + (k * BEAT) / 4, 0.04, "hat", { gain: 0.022, pan: -0.25 });
    }
  }
  // 軍鼓滾奏（進大段落前一或兩小節）：八分 → 十六分 → 三十二分，越來越大聲。
  const roll = (b0, bars) => {
    const T0 = bar(b0);
    const T1 = bar(b0 + bars);
    let t = T0;
    while (t < T1 - 0.01) {
      const p = (t - T0) / (T1 - T0);
      add(t, 0.15, "snare", { gain: 0.05 + p * 0.16 });
      t += p < 0.5 ? BEAT / 2 : p < 0.8 ? BEAT / 4 : BEAT / 8;
    }
  };
  roll(7, 1);
  roll(24, 1);
  roll(45, 1);
  roll(49, 2);
  roll(77, 1);
  // 半速段的拍手（break）。
  for (let b = 46; b < 49; b++) add(bar(b, 2), 0.2, "clap", { gain: 0.12 });

  // ---- 轉場的聲音 ----
  const riser = (b0, bars, gain = 0.12) => add(bar(b0), BAR * bars, "riser", { gain });
  riser(6, 2, 0.13);
  riser(23, 2, 0.1);
  riser(44, 2, 0.1);
  riser(48, 3, 0.15);
  riser(64, 2, 0.1);
  riser(76, 2, 0.14);
  for (const [b, g] of [[8, 0.55], [10, 0.3], [25, 0.4], [51, 0.55], [66, 0.35], [72, 0.3], [78, 0.55], [86, 0.3]]) add(bar(b), 1.6, "impact", { gain: g });
  for (const b of [8, 51, 78]) {
    add(bar(b), 1.8, "subdrop", { gain: 0.5 });
    add(bar(b) - BEAT * 2, BEAT * 2, "swell", { gain: 0.14 });
  }
  for (const b of [10, 25, 51, 55, 59, 63, 72, 78, 82]) add(bar(b), 2.2, "crash", { gain: b === 51 || b === 78 ? 0.09 : 0.06 });
  for (const b of [46, 86]) add(bar(b), BAR * 2, "down", { gain: 0.1 });

  // 畫面給的音效（打字的喀、牌落地、碰撞…）。
  for (const c of extraCues) add(c.t, c.dur || 0.2, c.kind, c);
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

export function createScore(extraCues = []) {
  return createEngine({ events: buildEvents(extraCues), length: LENGTH, beat: BEAT });
}
