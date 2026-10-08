/**
 * 墨池、疊印台的聲音：全部用 WebAudio 現場合成，不載音檔。
 * 每個聲音對應一個實體動作 —— 蓋印的悶響、紙被掀起的沙沙聲、印壓滾筒、揉掉一張紙。
 *
 * 多元：同一個動作每次都不完全一樣（音高、音色、長短各自抖一點，有的有兩三種版本輪著出），
 * 連續放十張牌不會像同一段錄音重播十次；一次帶上來好幾張的附帶牌照五聲音階往上走。
 * 音量：總線放大一些，後面接一個壓縮器，幾個聲音疊在一起也不會破音。
 * 可以關（設定記在這台瀏覽器，兩頁共用）。AudioContext 等第一次手勢才建立。
 */

const KEY = "mochi.fuse.sound.v1";
// 總音量。以前每個聲音直接接到喇叭，整體偏小；1.6 倍大約 +4 dB。
const MASTER = 1.6;
// 五聲音階（C 大調 宮商角徵羽，兩個八度）：連續的附帶牌、發牌照這個往上走，聽起來是一串，不是亂響。
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

let shared = null;

/** 一頁一個聲音引擎（墨池、疊印台、drag.js、motion.js 共用同一個）。 */
export function getSfx() {
  if (!shared) shared = build();
  return shared;
}

/** 舊名字：疊印台原本用 createSfx()。 */
export const createSfx = getSfx;

const rand = (a, b) => a + Math.random() * (b - a);
/** 在 x 上下抖 pct（0.06 = ±6%）。 */
const vary = (x, pct) => x * rand(1 - pct, 1 + pct);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function build() {
  let ctx = null;
  let bus = null;
  let on = true;
  try {
    on = localStorage.getItem(KEY) !== "off";
  } catch {
    /* 讀不到就開著 */
  }
  // 同一種聲音一瞬間被叫很多次（一次放十張牌、按住鍵盤）：太密的就跳過，免得糊成一團又太大聲。
  const last = new Map();
  let carryStep = 0;
  let carryAt = 0;
  const tooSoon = (name, gap) => {
    const now = performance.now();
    if (now - (last.get(name) || 0) < gap) return true;
    last.set(name, now);
    return false;
  };

  function ac() {
    if (!on) return null;
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      bus = ctx.createGain();
      bus.gain.value = MASTER;
      bus.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  // 第一次點下去才建音效引擎要 10～50ms，剛好卡在「點牌 → 畫面動」中間。手指一按下就在背景先建好：
  // 觸控的 pointerdown 還不算使用者手勢，這時建出來的是暫停的，真正要響的那一下 ac() 會叫 resume()，幾乎不花時間。
  addEventListener(
    "pointerdown",
    () =>
      setTimeout(() => {
        if (on) ac();
      }, 0),
    { once: true, capture: true, passive: true }
  );

  let noiseBuf = null;
  function noise(a, dur) {
    // 一段兩秒的白噪音重複用，每次從隨機位置開始播：不用每一聲都重新產生一大段亂數。
    if (!noiseBuf) {
      const len = a.sampleRate * 2;
      noiseBuf = a.createBuffer(1, len, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    src._offset = Math.random() * Math.max(0, 2 - dur - 0.05);
    return src;
  }

  function env(a, gain, t0, attack, decay, pan = 0) {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    if (pan && a.createStereoPanner) {
      const p = a.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(bus);
    } else g.connect(bus);
    return g;
  }

  function tone(a, { freq, to, type = "sine", gain = 0.1, at = 0, attack = 0.004, decay = 0.12, pan = 0, detune = 0 }) {
    const t0 = a.currentTime + at;
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (detune) o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + attack + decay);
    o.connect(env(a, gain, t0, attack, decay, pan));
    o.start(t0);
    o.stop(t0 + attack + decay + 0.02);
  }

  function hiss(a, { f = 1200, q = 0.8, type = "bandpass", gain = 0.05, at = 0, attack = 0.01, decay = 0.14, sweep, pan = 0 }) {
    const t0 = a.currentTime + at;
    const dur = attack + decay + 0.05;
    const src = noise(a, dur);
    const filt = a.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f, t0);
    if (sweep) filt.frequency.exponentialRampToValueAtTime(sweep, t0 + attack + decay);
    filt.Q.value = q;
    src.connect(filt).connect(env(a, gain, t0, attack, decay, pan));
    src.start(t0, src._offset, dur);
  }

  const sounds = {
    /* ---------- 疊印台原有的，現在每次都有點不一樣 ---------- */

    // 牌壓上版：低沉的一下，帶一點紙面的擦聲。三種：乾脆、厚一點、帶一下回彈。
    stamp() {
      const a = ac();
      if (!a || tooSoon("stamp", 30)) return;
      const v = Math.floor(Math.random() * 3);
      const f = vary(150, 0.08);
      tone(a, { freq: f, to: vary(58, 0.08), gain: vary(0.17, 0.1), decay: vary(0.11, 0.15) });
      hiss(a, { f: vary(700, 0.2), type: "lowpass", gain: vary(0.055, 0.15), decay: vary(0.05, 0.2) });
      if (v === 1) tone(a, { freq: f * 0.5, gain: 0.07, decay: 0.16 });
      if (v === 2) tone(a, { freq: f * 1.2, to: f * 0.7, gain: 0.04, at: 0.055, decay: 0.06 });
    },
    // 被帶上來的牌：很輕的一聲。i 是第幾張，一串往上走。
    carry(i = 0) {
      const a = ac();
      if (!a) return;
      // 一張接一張叫進來的（間隔很短）：音高自己往上走一格，一串聽起來是一段音階。
      const now = performance.now();
      carryStep = now - carryAt < 250 ? carryStep + 1 : 0;
      carryAt = now;
      const n = PENTA[(Math.max(0, i) + carryStep + 2) % PENTA.length];
      tone(a, { freq: n, gain: 0.03, at: 0.05 + i * 0.045, decay: vary(0.07, 0.2), pan: rand(-0.25, 0.25) });
    },
    // 掀起、拿掉、被擠下去：紙沙一聲往下滑。
    lift() {
      const a = ac();
      if (!a || tooSoon("lift", 30)) return;
      hiss(a, { f: vary(2600, 0.15), sweep: vary(900, 0.2), q: vary(0.9, 0.2), gain: vary(0.05, 0.12), decay: vary(0.16, 0.2) });
    },
    // 相剋：兩個略為走音的鈍響（走音的幅度每次不同）。
    clash() {
      const a = ac();
      if (!a) return;
      const f = vary(176, 0.05);
      tone(a, { freq: f, type: "triangle", gain: 0.07, decay: 0.12 });
      tone(a, { freq: f * rand(1.05, 1.08), type: "triangle", gain: 0.06, at: 0.07, decay: 0.12 });
    },
    // 換一批：像翻過一疊樣張，張數、間隔每次不同。
    shuffle() {
      const a = ac();
      if (!a) return;
      const n = 3 + Math.floor(Math.random() * 3);
      let t = 0;
      for (let i = 0; i < n; i++) {
        hiss(a, { f: vary(1800 + i * 300, 0.12), q: 1.2, gain: vary(0.026, 0.2), at: t, decay: vary(0.05, 0.2), pan: rand(-0.3, 0.3) });
        t += rand(0.035, 0.06);
      }
    },
    // 付印：滾筒壓過去。
    roll() {
      const a = ac();
      if (!a) return;
      hiss(a, { f: vary(380, 0.1), type: "lowpass", gain: 0.07, attack: 0.08, decay: vary(0.5, 0.1) });
      tone(a, { freq: vary(72, 0.06), gain: 0.06, attack: 0.06, decay: 0.45 });
    },
    // 印好了：三種和弦輪著出，都在同一個音階裡。
    done() {
      const a = ac();
      if (!a) return;
      const chords = [
        [659.25, 987.77],
        [587.33, 880, 1174.66],
        [523.25, 783.99, 1046.5],
      ];
      pick(chords).forEach((f, i) => tone(a, { freq: f, gain: 0.05 - i * 0.008, at: i * 0.1, decay: 0.3 + i * 0.05, pan: (i - 1) * 0.2 }));
    },
    // 印壞了：往下掉的一聲。
    fail() {
      const a = ac();
      if (!a) return;
      tone(a, { freq: vary(300, 0.05), to: 140, type: "triangle", gain: 0.06, decay: 0.3 });
    },

    /* ---------- 新的 ---------- */

    // 按鈕：很短的一下木頭敲擊，音高每次稍微不同（按鈕本身就有墨暈，聲音只是補一點手感）。
    tap() {
      const a = ac();
      if (!a || tooSoon("tap", 45)) return;
      tone(a, { freq: vary(1900, 0.1), to: vary(900, 0.1), type: "triangle", gain: 0.022, attack: 0.002, decay: 0.035 });
      hiss(a, { f: vary(3500, 0.15), q: 2, gain: 0.012, attack: 0.002, decay: 0.02 });
    },
    // 拿起一張牌：輕輕往上刷。
    pick() {
      const a = ac();
      if (!a || tooSoon("pick", 40)) return;
      hiss(a, { f: vary(900, 0.15), sweep: vary(2400, 0.15), q: 1.1, gain: 0.032, attack: 0.02, decay: 0.08 });
    },
    // 丟進廢字簍：揉紙，幾下不規則的沙沙。
    trash() {
      const a = ac();
      if (!a) return;
      let t = 0;
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        hiss(a, { f: rand(1400, 4200), q: rand(0.8, 2.5), gain: rand(0.02, 0.045), at: t, attack: 0.004, decay: rand(0.02, 0.06) });
        t += rand(0.02, 0.05);
      }
      tone(a, { freq: vary(110, 0.1), to: 70, gain: 0.05, at: t, decay: 0.08 });
    },
    // 撤銷：紙沙一聲往上（跟掀起反方向）。
    undo() {
      const a = ac();
      if (!a) return;
      hiss(a, { f: vary(900, 0.15), sweep: vary(2800, 0.1), q: 0.9, gain: 0.045, decay: 0.14 });
    },
    // 發牌：一張一聲，n 張照音階輕輕走上去（最多響八下）。
    deal(n = 5) {
      const a = ac();
      if (!a) return;
      const k = Math.min(8, Math.max(1, n));
      const start = Math.floor(Math.random() * 3);
      for (let i = 0; i < k; i++) {
        hiss(a, { f: vary(2200, 0.15), q: 1.4, gain: 0.018, at: i * 0.04, attack: 0.003, decay: 0.03, pan: rand(-0.3, 0.3) });
        tone(a, { freq: PENTA[(start + i) % PENTA.length], gain: 0.016, at: i * 0.04 + 0.005, decay: 0.05 });
      }
    },
    // Hires 開始：一段往上爬的細顫音。
    hiresStart() {
      const a = ac();
      if (!a) return;
      const base = Math.floor(Math.random() * 2);
      for (let i = 0; i < 4; i++) tone(a, { freq: PENTA[base + i * 2], gain: 0.028, at: i * 0.06, decay: 0.12, pan: (i - 1.5) * 0.15 });
    },
    // Hires 好了：一聲亮的鐘，帶一點泛音。
    hiresDone() {
      const a = ac();
      if (!a) return;
      const f = pick([1046.5, 1174.66, 1318.51]);
      tone(a, { freq: f, gain: 0.06, attack: 0.003, decay: 0.7 });
      tone(a, { freq: f * 2.01, gain: 0.018, attack: 0.003, decay: 0.4 });
      tone(a, { freq: f * 1.5, gain: 0.02, at: 0.12, decay: 0.5 });
    },
    // 打開大圖、選單：一張紙攤開。
    open() {
      const a = ac();
      if (!a || tooSoon("open", 80)) return;
      hiss(a, { f: vary(1600, 0.15), type: "bandpass", q: 0.7, gain: 0.03, attack: 0.03, decay: 0.12, sweep: vary(700, 0.15) });
    },
  };

  return {
    ...sounds,
    /** 在手勢裡先把 AudioContext 建好（聲音關著就不建）。 */
    warm() {
      ac();
    },
    get on() {
      return on;
    },
    set on(v) {
      on = !!v;
      try {
        localStorage.setItem(KEY, on ? "on" : "off");
      } catch {
        /* 存不了就這次有效 */
      }
    },
  };
}
