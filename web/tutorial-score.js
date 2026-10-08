/**
 * 教學影片（tutorial.js）的配樂：Web Audio 現場合成，沒有借來的音樂檔；引擎在 synth-engine.js。
 *
 * 112 BPM、4/4，一小節 2.143 秒，126 小節＝4 分 30 秒。C 大調，和弦 C – G – Am – F（add9）一小節一個；
 * 講解比較多的「mid」段換成 Am – F – C – G 和另一句旋律，最後一段（114 起）整首升一個全音到 D 大調。
 * 比介紹影片（D 小調、128 BPM）輕快、明亮：要人一路跟得上操作，不是要人被撞擊聲推著走。
 * 為了四分半鐘聽不膩：主歌用電鋼琴（keys）切分的和弦、副歌才上十六分撥弦，鼓每四小節加一個小過門。
 * 畫面上每一次點擊、按鍵、牌落地都排在拍子上（tutorial.js 用 bar(小節, 拍) 排時間），所以拍子就是節奏。
 *
 * 段落（小節）：
 *   0–3    intro    撥弦琶音、鋪底慢慢打開，第 2 小節軍鼓滾奏＋上升
 *   3–6    title    標題撞擊、四拍大鼓進來，鐘聲彈一次主旋律
 *   6–14   verseA   墨池開始：大鼓、低音、撥弦，8 起拍手
 *   14–31  verseB   十六分撥弦、鋪底更亮
 *   31–48  chorus   柔和的主旋律（規則、抽牌）
 *   48–64  mid      大鼓退一點，主旋律隔一句彈一句
 *   64–66  break    鼓退掉，只剩鋪底＋上升（換到疊印台）
 *   66–74  verseA2  疊印台開始
 *   74–97  chorus2  supersaw 主旋律
 *   97–105 peak     付印那一段：主旋律疊八度、十六分 hi-hat
 *   105–112 mid2    撤回、清版、起手式
 *   112–114 break2  鼓退掉
 *   114–122 final   收尾的最後一段：主旋律疊八度、鐘聲
 *   122–126 end     鼓退掉，鐘聲、最後的和弦，淡出
 */
import { createEngine, hz, hzOf, up, transpose } from "./synth-engine.js";

export const BPM = 112;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const BARS = 126;
export const LENGTH = BAR * BARS;
export const bar = (n, beat = 0) => n * BAR + beat * BEAT;

const CHORDS = [
  { root: "C", notes: [["C", 3], ["E", 3], ["G", 3], ["D", 4]] }, // C(add9)
  { root: "G", notes: [["G", 2], ["B", 2], ["D", 3], ["A", 3]] }, // G(add9)
  { root: "A", notes: [["A", 2], ["C", 3], ["E", 3], ["B", 3]] }, // Am(add9)
  { root: "F", notes: [["F", 2], ["A", 2], ["C", 3], ["G", 3]] }, // F(add9)
];

export const PLAN = [
  { from: 0, to: 3, kind: "intro" },
  { from: 3, to: 6, kind: "title" },
  { from: 6, to: 14, kind: "verseA" },
  { from: 14, to: 31, kind: "verseB" },
  { from: 31, to: 48, kind: "chorus" },
  { from: 48, to: 64, kind: "mid" },
  { from: 64, to: 66, kind: "break" },
  { from: 66, to: 74, kind: "verseA" },
  { from: 74, to: 97, kind: "chorus" },
  { from: 97, to: 105, kind: "peak" },
  { from: 105, to: 112, kind: "mid" },
  { from: 112, to: 114, kind: "break" },
  { from: 114, to: 122, kind: "final" },
  { from: 122, to: 126, kind: "end" },
];
const LEVEL = { intro: 0.62, title: 0.85, verseA: 0.68, verseB: 0.78, chorus: 0.95, mid: 0.66, break: 0.72, peak: 1.1, final: 1.12, end: 0.95 };
const ROLLS = [13, 30, 47, 63, 73, 96, 104, 121];
export const secAt = (b) => PLAN.find((p) => b >= p.from && b < p.to) || PLAN[PLAN.length - 1];
// mid 段：Am – F – C – G（從段落開頭數）。
const MID = [2, 3, 0, 1];
const chordAt = (b) => {
  const s = secAt(b);
  return s.kind === "mid" ? CHORDS[MID[(b - s.from) % 4]] : CHORDS[b % 4];
};
const DRUMS = new Set(["title", "verseA", "verseB", "chorus", "mid", "peak", "final"]);
const FULL = new Set(["chorus", "peak", "final"]);

/**
 * 主旋律（四小節一句，跟著 C – G – Am – F）：[拍, 長度（拍）, 音]。
 * 附點的切分（3＋3＋2 十六分）是鉤子；每四小節最後一句落在 E5 或 G5 上。
 */
const HOOK = [
  [[0, 0.75, "E5"], [0.75, 0.75, "G5"], [1.5, 0.5, "A5"], [2, 1, "G5"], [3, 1, "E5"]],
  [[0, 0.75, "D5"], [0.75, 0.75, "G5"], [1.5, 0.5, "B5"], [2, 1.5, "A5"], [3.5, 0.5, "G5"]],
  [[0, 0.75, "C5"], [0.75, 0.75, "E5"], [1.5, 0.5, "A5"], [2, 1, "G5"], [3, 0.5, "E5"], [3.5, 0.5, "D5"]],
  [[0, 1.5, "C5"], [1.5, 0.5, "D5"], [2, 2, "E5"]],
];
const HOOK_END = [[0, 1.5, "C5"], [1.5, 0.5, "D5"], [2, 2, "G5"]];
/** mid 段的旋律（Am – F – C – G）：比較長的音，留空間給講解。 */
const TUNE_B = [
  [[0, 1.5, "E5"], [1.5, 0.5, "D5"], [2, 1, "C5"], [3, 1, "E5"]],
  [[0, 1.5, "F5"], [1.5, 0.5, "E5"], [2, 2, "C5"]],
  [[0, 1, "G5"], [1, 1, "E5"], [2, 1, "D5"], [3, 1, "C5"]],
  [[0, 3, "D5"], [3, 1, "B4"]],
];

/** 整首歌的事件表（{ t, dur, kind, ...參數 }），照時間排好。純資料，跟播放無關。 */
export function buildEvents(extraCues = []) {
  const ev = [];
  const add = (t, dur, kind, o = {}) => ev.push({ t, dur, kind, ...o });
  const last = 122; // 之後只剩鐘聲和最後的和弦

  // ---- 和聲：鋪底、低音、琶音（一小節一個和弦） ----
  for (let b = 0; b < last; b++) {
    const s = secAt(b);
    const ch = chordAt(b);
    const k = s.kind;
    const bright = { intro: 0.2 + (b / 3) * 0.3, title: 0.7, verseA: 0.5, verseB: 0.65, chorus: 0.8, mid: 0.6, break: 0.4, peak: 1, final: 0.95 }[k] ?? 0.5;
    add(bar(b), BAR + 0.3, "pad", { notes: ch.notes, bright, wide: true, gain: k === "intro" ? 0.06 + b * 0.02 : k === "break" ? 0.12 : k === "mid" ? 0.1 : 0.08, duck: DRUMS.has(k) });
    // 電鋼琴：主歌切分的和弦（3＋3＋2），mid 段兩拍一下的長和弦，標題和 break 整小節。
    const upper = ch.notes.map(([n, o]) => [n, o + 1]);
    if (k === "verseA" || k === "verseB") {
      const hits = k === "verseB" ? [0, 0.75, 1.5, 2.5, 3.25] : [0.5, 1.5, 2.5, 3.5];
      hits.forEach((q, i) => add(bar(b, q), BEAT * 0.4, "keys", { notes: upper, gain: (k === "verseB" ? 0.05 : 0.04) * (i === 0 ? 1.15 : 1), rel: 0.18, duck: true, pan: i % 2 ? 0.15 : -0.15 }));
    } else if (k === "mid") {
      for (const q of [0, 2]) add(bar(b, q), BEAT * 1.6, "keys", { notes: upper, gain: 0.045, rel: 0.5, duck: true, delay: 0.25 });
    } else if (k === "title" || k === "break") {
      add(bar(b), BAR * 0.9, "keys", { notes: upper, gain: 0.05, rel: 0.9 });
    }
    // 低音
    const next = chordAt(b + 1);
    if (k === "verseA" || k === "verseB" || k === "mid") {
      add(bar(b), BAR, "sub", { f: hz(ch.root, 1), gain: 0.18 });
      for (let q = 0; q < 8; q++) add(bar(b) + (q * BEAT) / 2, BEAT * 0.4, "bassPluck", { f: hz(ch.root, q % 4 === 3 ? 3 : 2), gain: q % 2 ? 0.08 : 0.11, cut: 0.9 });
    } else if (FULL.has(k)) {
      add(bar(b), BAR, "sub", { f: hz(ch.root, 1), gain: 0.22 });
      for (let q = 0; q < 8; q++) {
        const off = q % 2 === 1;
        // 最後一個八分先走到下一個和弦的根音（低音會動，不是一直敲同一個音）。
        const root = q === 7 && next.root !== ch.root ? next.root : ch.root;
        add(bar(b) + (q * BEAT) / 2, BEAT * 0.45, "bassPluck", { f: hz(root, off ? 3 : 2), gain: off ? 0.13 : 0.07, cut: 1.2 });
      }
    } else if (k === "title") {
      add(bar(b), BAR, "sub", { f: hz(ch.root, 1), gain: 0.2 });
    } else if (k === "break") {
      add(bar(b), BAR, "sub", { f: hz(ch.root, 1), gain: 0.14 });
    }
    // 撥弦琶音
    if (b >= 1 && k !== "break") {
      const seq = [0, 1, 2, 3, 2, 1, 2, 3];
      const hot = k === "peak" || k === "final";
      const fine = k === "chorus" || hot; // 十六分（主歌八分，讓電鋼琴出來）
      const step = fine ? 1 : 2;
      for (let i = 0; i < 16; i += step) {
        const n = ch.notes[seq[i % 8]];
        const oct = n[1] + 1 + (hot && i % 8 >= 4 ? 1 : 0);
        const cut = k === "intro" ? 1.2 + (b / 3) * 3 : hot ? 7 : 5;
        const quiet = k === "mid" || k === "verseB" ? 0.75 : 1;
        add(bar(b) + (i * BEAT) / 4, BEAT * 0.5, "pluck", { f: hz(n[0], oct), gain: (hot ? 0.04 : 0.046) * quiet * (i % 4 === 0 ? 1.3 : 1), cut, pan: i % 2 ? 0.35 : -0.35, duck: DRUMS.has(k) });
      }
    }
  }

  // ---- 主旋律 ----
  const phrase = (b0, bars, voice, o = {}) => {
    for (let k = 0; k < bars; k++) {
      const idx = k % 4;
      const closing = idx === 3 && Math.floor(k / 4) % 2 === 1;
      const line = o.tune ? o.tune[idx] : closing ? HOOK_END : HOOK[idx];
      for (const [beat, len, note] of line) {
        add(bar(b0 + k, beat), len * BEAT, voice, { f: hzOf(note), gain: o.gain ?? 0.09, duck: o.duck });
        if (o.double) add(bar(b0 + k, beat), len * BEAT, voice, { f: hzOf(up(note, 1)), gain: (o.gain ?? 0.09) * 0.4, duck: o.duck });
      }
    }
  };
  // 標題：鐘聲彈一次開頭。
  for (const [beat, len, note] of [...HOOK[0], ...HOOK[1].map(([b, l, n]) => [b + 4, l, n])]) add(bar(4, beat), len * BEAT * 1.6, "bell", { f: hzOf(up(note, 1)), gain: 0.06 });
  phrase(31, 16, "soft", { gain: 0.075, duck: true });
  // mid 段：另一句旋律，隔一句彈一句（把空間留給講解）
  phrase(48, 4, "soft", { gain: 0.06, duck: true, tune: TUNE_B });
  phrase(56, 4, "soft", { gain: 0.06, duck: true, tune: TUNE_B });
  phrase(105, 4, "soft", { gain: 0.055, duck: true, tune: TUNE_B });
  phrase(74, 23, "lead", { gain: 0.078, duck: true });
  phrase(97, 8, "lead", { gain: 0.085, duck: true, double: true });
  phrase(114, 8, "lead", { gain: 0.085, duck: true, double: true });
  for (let k = 0; k < 8; k++) {
    const [beat, , note] = HOOK[k % 4][0];
    add(bar(114 + k, beat), BAR, "bell", { f: hzOf(up(note, 1)), gain: 0.045 });
  }
  // 收尾：鐘聲慢慢彈主旋律的骨架，最後的和弦。
  for (const [n, b] of [["G5", 122], ["E5", 123], ["D5", 124], ["C5", 125]]) add(bar(b), BAR * 2, "bell", { f: hzOf(n), gain: 0.08 });
  add(bar(122), BAR * 4, "pad", { notes: [["C", 3], ["G", 3], ["C", 4], ["D", 4], ["E", 4]], bright: 0.85, gain: 0.13 });
  add(bar(122), BAR * 4, "bell", { f: hz("C", 5), gain: 0.14 });
  add(bar(122, 2), BAR * 3.4, "bell", { f: hz("G", 5), gain: 0.08 });
  add(bar(122), BAR * 3, "sub", { f: hz("C", 1), gain: 0.2 });

  // ---- 鼓 ----
  for (let b = 3; b < last; b++) {
    const s = secAt(b);
    if (!DRUMS.has(s.kind)) continue;
    const i = b - s.from;
    const full = FULL.has(s.kind);
    const soft = s.kind === "mid";
    for (let q = 0; q < 4; q++) {
      const t = bar(b, q);
      add(t, 0.4, "kick", { gain: soft ? 0.55 : full ? 0.7 : 0.62, duck: full ? 0.45 : soft ? 0.25 : 0.32 });
      if ((q === 1 || q === 3) && (s.kind !== "title" || i >= 1) && (s.kind !== "verseA" || i >= 2 || b >= 64)) add(t, 0.2, "clap", { gain: full ? 0.14 : soft ? 0.08 : 0.11 });
      // hi-hat 輕重不一（像人打的），十六分的稍微往後拖一點（swing）。
      const hum = 0.8 + 0.4 * (((b * 4 + q) * 37) % 11) / 10;
      add(t + BEAT / 2, 0.06, full ? "ohat" : "hat", { gain: (full ? 0.043 : 0.045) * hum, pan: 0.2 });
      if (full || s.kind === "verseB") for (const k of [1, 3]) add(t + (k * BEAT) / 4 + BEAT * 0.03, 0.04, "hat", { gain: 0.02 * (k === 3 ? 1.15 : 0.85), pan: -0.25 });
    }
    // 每四小節最後一拍一個小過門（下一小節是滾奏的就不加）。
    if (i % 4 === 3 && !ROLLS.includes(b)) for (const [q, g] of [[3.5, 0.07], [3.75, 0.1]]) add(bar(b, q), 0.12, "snare", { gain: g });
  }

  // ---- 轉場：軍鼓滾奏、上升、撞擊 ----
  const roll = (b0, bars) => {
    const T0 = bar(b0);
    const T1 = bar(b0 + bars);
    let t = T0;
    while (t < T1 - 0.01) {
      const p = (t - T0) / (T1 - T0);
      add(t, 0.15, "snare", { gain: 0.05 + p * 0.15 });
      t += p < 0.5 ? BEAT / 2 : p < 0.8 ? BEAT / 4 : BEAT / 8;
    }
  };
  roll(2, 1);
  for (const b of ROLLS) roll(b, 1);
  add(bar(64), BAR * 2, "riser", { gain: 0.1 });
  add(bar(2), BAR, "riser", { gain: 0.11 });
  add(bar(111), BAR * 3, "riser", { gain: 0.09 });
  for (const [b, g] of [[3, 0.5], [31, 0.3], [66, 0.4], [74, 0.3], [97, 0.35], [114, 0.4]]) {
    add(bar(b), 1.6, "impact", { gain: g });
    add(bar(b), 2.2, "crash", { gain: 0.07 });
  }
  for (const b of [3, 66, 114]) {
    add(bar(b), 1.6, "subdrop", { gain: 0.45 });
    add(bar(b) - BEAT * 2, BEAT * 2, "swell", { gain: 0.13 });
  }
  // 每一章開頭：一小聲鈸＋一聲下行的噪音（章節換場）。
  for (const b of [11, 23, 31, 37, 48, 57, 72, 80, 89, 105]) add(bar(b), 1.6, "crash", { gain: 0.045 });
  for (const b of [48, 105]) add(bar(b - 1, 3), BEAT, "down", { gain: 0.06 });

  // 最後一段升一個全音（C → D）：上升＋撞擊之後整首亮起來。
  transpose(ev, bar(114) - 0.01, 2);
  // 段落的音量：講解多的地方收一點，付印、收尾那幾段放開（整首才有起伏，不是從頭到尾一樣大聲）。
  for (const e of ev) if (e.gain != null) e.gain *= LEVEL[secAt(Math.floor(e.t / BAR + 1e-6)).kind] ?? 1;

  // 畫面給的音效（點擊、按鍵、牌落地、提示…）。
  for (const c of extraCues) add(c.t, c.dur || 0.2, c.kind, c);
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

export function createScore(extraCues = []) {
  return createEngine({ events: buildEvents(extraCues), length: LENGTH, beat: BEAT });
}
