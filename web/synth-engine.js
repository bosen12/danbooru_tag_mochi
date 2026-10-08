/**
 * 介紹影片、教學影片共用的合成器：一份事件表（{ t, dur, kind, ...參數 }）→ Web Audio 現場合成的配樂。
 * 沒有借來的音樂檔；事件表怎麼排（哪一小節放什麼）由各自的 *-score.js 決定。
 *
 *   const a = createEngine({ events, length, beat });   // beat：一拍幾秒（回音的長度、跟著拍子）
 *   a.play(秒) / a.pause() / a.now() / await a.render()  // render：離線算好整首（輸出影片檔用）
 *
 * 排程器只往前看 1 秒才真的建聲音節點：拖時間軸、暫停都準，也不會一次建幾千個節點。
 * 兩種鼓的「壓」：大鼓帶 duck 時，那條 bus（鋪底、低音、琶音、主旋律）先壓下去再放回來（sidechain）。
 */

const NOTE = { C: -9, "C#": -8, D: -7, Eb: -6, E: -5, F: -4, "F#": -3, G: -2, Ab: -1, A: 0, Bb: 1, B: 2 };
export const hz = (name, oct) => 440 * Math.pow(2, (NOTE[name] + (oct - 4) * 12) / 12);
/** "A4"、"Bb3" → 頻率。 */
export const hzOf = (s) => hz(s.slice(0, -1), +s.slice(-1));
/** 音名往上（或下）幾個八度："A4" + 1 → "A5"。 */
export const up = (s, n) => s.slice(0, -1) + (+s.slice(-1) + n);

/** 從 from 秒起整段移調 semis 個半音（有音高的事件：f 乘上去、和弦記在 tr）。在加畫面音效之前呼叫。 */
export function transpose(events, from, semis) {
  const r = Math.pow(2, semis / 12);
  for (const e of events) {
    if (e.t < from) continue;
    if (e.f) e.f *= r;
    if (e.notes) e.tr = (e.tr || 0) + semis;
  }
}

export function createEngine({ events, length, beat, vol: VOL = 0.85 }) {
  const kicks = events.filter((e) => e.kind === "kick").map((e) => e.t);
  let ctx = null;
  let master = null;
  let bus = null; // 會被大鼓壓的那一條（鋪底、低音、琶音、主旋律）
  let wet = null;
  let echo = null;
  let noise = null;
  let startCtx = 0;
  let startT = 0;
  let playing = false;
  let muted = false;
  let cursor = 0;
  let timer = 0;
  const live = new Set();

  function setup(given = null) {
    if (ctx && !given) return;
    ctx = given || new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.22;
    // 第二段當限幅器：最響的撞擊不要破。
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.002;
    lim.release.value = 0.1;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOL;
    master.connect(comp).connect(lim).connect(ctx.destination);
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(master);
    // 殘響：自己產生一段衰減的噪音當 impulse response。
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    conv.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.3;
    wet.connect(conv).connect(master);
    // 附點八分的回音（主旋律用）。
    echo = ctx.createGain();
    const dl = ctx.createDelay(2);
    dl.delayTime.value = beat * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    echo.connect(dl).connect(tone).connect(fb).connect(dl);
    const eo = ctx.createGain();
    eo.gain.value = 0.35;
    tone.connect(eo).connect(bus);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  const track = (node, until) => {
    live.add(node);
    node.onended = () => live.delete(node);
    node.stop(until);
  };
  /** 接到輸出：duck＝走會被大鼓壓的那條；send＝殘響；pan＝左右；delay＝回音。 */
  const out = (g, { send = 0, duck = false, pan = 0, delay = 0 } = {}) => {
    let node = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = g.connect(p);
    }
    node.connect(duck ? bus : master);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      node.connect(s).connect(wet);
    }
    if (delay) {
      const s = ctx.createGain();
      s.gain.value = delay;
      node.connect(s).connect(echo);
    }
    return g;
  };
  const env = (g, at, a, peak, hold, r) => {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a);
    g.gain.setValueAtTime(Math.max(0.0002, peak), at + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + r);
  };
  const noiseSrc = (at) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.start(at, Math.random() * 1.5);
    return s;
  };
  const osc = (type, f, at) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    o.start(at);
    return o;
  };
  const filter = (type, f, q = 1) => {
    const n = ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    return n;
  };

  const voices = {
    pad(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.3) return;
      const f = filter("lowpass", 300 + 900 * e.bright, 0.7);
      f.frequency.setValueAtTime(300 + 900 * e.bright, at);
      f.frequency.linearRampToValueAtTime(500 + 2200 * e.bright, at + dur * 0.55);
      f.frequency.linearRampToValueAtTime(300 + 1000 * e.bright, at + dur);
      const g = ctx.createGain();
      env(g, at, Math.min(0.6, dur * 0.25), e.gain, Math.max(0, dur - 1.1), 0.5);
      f.connect(g);
      out(g, { send: 0.8, duck: e.duck });
      // wide：兩把走音的鋸齒波一左一右（寬一點）；預設疊在中間。
      const sides = e.wide ? [-0.5, 0.5].map((pv) => {
        const pn = ctx.createStereoPanner();
        pn.pan.value = pv;
        pn.connect(f);
        return pn;
      }) : [f, f];
      for (const [n, o] of e.notes) {
        [-9, 8].forEach((det, k) => {
          const v = osc("sawtooth", hz(n, o), at);
          v.detune.value = det + (e.tr || 0) * 100;
          const og = ctx.createGain();
          og.gain.value = 0.16;
          v.connect(og).connect(sides[k]);
          track(v, at + dur + 0.1);
        });
      }
    },
    /** 電鋼琴：正弦波＋同頻率的 FM，敲下去亮、很快變圓（和弦的切分、斷奏）。notes 跟 pad 一樣。 */
    keys(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.05) return;
      const g = ctx.createGain();
      const rel = e.rel ?? 0.35;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(e.gain, at + 0.006);
      g.gain.exponentialRampToValueAtTime(e.gain * 0.45, at + 0.25);
      g.gain.setValueAtTime(e.gain * 0.45, at + Math.max(0.26, dur));
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.26, dur) + rel);
      const lp = filter("lowpass", 3200, 0.5);
      lp.connect(g);
      out(g, { send: 0.45, duck: e.duck, pan: e.pan || 0, delay: e.delay || 0 });
      const end = at + Math.max(0.26, dur) + rel + 0.05;
      for (const [n, o] of e.notes) {
        const fr = hz(n, o) * Math.pow(2, (e.tr || 0) / 12);
        const c = osc("sine", fr, at);
        const m = osc("sine", fr, at);
        const mi = ctx.createGain();
        mi.gain.setValueAtTime(fr * 1.6, at);
        mi.gain.exponentialRampToValueAtTime(fr * 0.15, at + 0.3);
        m.connect(mi).connect(c.frequency);
        const cg = ctx.createGain();
        cg.gain.value = 0.28;
        c.connect(cg).connect(lp);
        track(c, end);
        track(m, end);
      }
    },
    sub(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.15) return;
      const v = osc("sine", e.f, at);
      const g = ctx.createGain();
      env(g, at, 0.03, e.gain, Math.max(0, dur - 0.25), 0.2);
      v.connect(g);
      out(g, { duck: true });
      track(v, at + dur + 0.05);
    },
    bassPluck(e, at) {
      const v = osc("sawtooth", e.f, at);
      const f = filter("lowpass", e.f * 6 * (e.cut || 1), 4);
      f.frequency.setValueAtTime(e.f * 6 * (e.cut || 1), at);
      f.frequency.exponentialRampToValueAtTime(e.f * 1.4, at + 0.16);
      const g = ctx.createGain();
      env(g, at, 0.004, e.gain, 0.04, 0.14);
      v.connect(f).connect(g);
      out(g, { duck: true, send: 0.05 });
      track(v, at + 0.25);
    },
    pluck(e, at) {
      const v = osc("triangle", e.f, at);
      const v2 = osc("square", e.f * 2, at);
      const m2 = ctx.createGain();
      m2.gain.value = 0.18;
      const f = filter("lowpass", e.f * (e.cut || 5));
      f.frequency.setValueAtTime(e.f * (e.cut || 5), at);
      f.frequency.exponentialRampToValueAtTime(e.f * 1.3, at + 0.22);
      const g = ctx.createGain();
      env(g, at, 0.003, e.gain, 0, 0.26);
      v.connect(f);
      v2.connect(m2).connect(f);
      f.connect(g);
      out(g, { send: 0.45, duck: e.duck, pan: e.pan || 0 });
      track(v, at + 0.32);
      track(v2, at + 0.32);
    },
    /** supersaw：三把鋸齒波互相走音＋低八度的方波，濾波一開一收，長音加顫音。 */
    lead(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.05) return;
      const f = filter("lowpass", 900, 1.2);
      f.frequency.setValueAtTime(900, at);
      f.frequency.exponentialRampToValueAtTime(5200, at + 0.03);
      f.frequency.exponentialRampToValueAtTime(2400, at + 0.25);
      const g = ctx.createGain();
      const rel = 0.16;
      const hold = at + Math.max(0.12, dur - 0.02);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(e.gain, at + 0.008);
      g.gain.exponentialRampToValueAtTime(e.gain * 0.72, at + 0.12);
      g.gain.setValueAtTime(e.gain * 0.72, hold);
      g.gain.exponentialRampToValueAtTime(0.0001, hold + rel);
      f.connect(g);
      out(g, { send: 0.35, duck: e.duck, delay: 0.5 });
      const end = hold + rel + 0.05;
      let lg = null;
      if (dur > 0.4) {
        const lfo = osc("sine", 5.5, at);
        lg = ctx.createGain();
        lg.gain.setValueAtTime(0, at);
        lg.gain.linearRampToValueAtTime(9, at + 0.35);
        lfo.connect(lg);
        track(lfo, end);
      }
      for (const [type, mul, det, gm] of [["sawtooth", 1, -13, 0.33], ["sawtooth", 1, 0, 0.33], ["sawtooth", 1, 12, 0.33], ["square", 0.5, 0, 0.18]]) {
        const v = osc(type, e.f * mul, at);
        v.detune.value = det;
        if (lg) lg.connect(v.detune);
        const vg = ctx.createGain();
        vg.gain.value = gm;
        v.connect(vg).connect(f);
        track(v, end);
      }
    },
    /** 柔和的主旋律：方波＋三角波、濾得比較暗。 */
    soft(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.05) return;
      const f = filter("lowpass", 2200);
      f.frequency.setValueAtTime(2200, at);
      f.frequency.exponentialRampToValueAtTime(1300, at + 0.3);
      const g = ctx.createGain();
      env(g, at, 0.01, e.gain, Math.max(0, dur - 0.06), 0.18);
      f.connect(g);
      out(g, { send: 0.4, duck: e.duck, delay: 0.45 });
      for (const [type, gm, det] of [["square", 0.35, -6], ["triangle", 0.8, 5]]) {
        const v = osc(type, e.f, at);
        v.detune.value = det;
        const vg = ctx.createGain();
        vg.gain.value = gm;
        v.connect(vg).connect(f);
        track(v, at + dur + 0.25);
      }
    },
    bell(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.2) return;
      for (const [mul, gm] of [[1, 1], [2.76, 0.32], [5.4, 0.15]]) {
        const v = osc("sine", e.f * mul, at);
        const g = ctx.createGain();
        env(g, at, 0.004, e.gain * gm, 0, dur);
        v.connect(g);
        out(g, { send: 0.8 });
        track(v, at + dur + 0.1);
      }
    },
    kick(e, at) {
      const v = osc("sine", 165, at);
      v.frequency.exponentialRampToValueAtTime(47, at + 0.11);
      const g = ctx.createGain();
      env(g, at, 0.002, e.gain, 0.03, 0.3);
      v.connect(g);
      out(g);
      track(v, at + 0.42);
      const s = noiseSrc(at);
      const ng = ctx.createGain();
      env(ng, at, 0.001, e.gain * 0.12, 0, 0.012);
      s.connect(filter("highpass", 2500)).connect(ng);
      out(ng);
      track(s, at + 0.03);
      // sidechain：大鼓一下，那條 bus 先壓下去再慢慢放回來。
      if (e.duck) {
        const b = bus.gain;
        b.setValueAtTime(1, at);
        b.linearRampToValueAtTime(1 - e.duck, at + 0.012);
        b.linearRampToValueAtTime(1, at + 0.3);
      }
    },
    hat(e, at) {
      const s = noiseSrc(at);
      const g = ctx.createGain();
      env(g, at, 0.001, e.gain, 0, 0.035);
      s.connect(filter("highpass", 8000)).connect(g);
      out(g, { send: 0.1, pan: e.pan || 0 });
      track(s, at + 0.06);
    },
    ohat(e, at) {
      const s = noiseSrc(at);
      const g = ctx.createGain();
      env(g, at, 0.002, e.gain, 0.02, 0.2);
      s.connect(filter("highpass", 6500)).connect(g);
      out(g, { send: 0.15, pan: e.pan || 0 });
      track(s, at + 0.3);
    },
    clap(e, at) {
      const s = noiseSrc(at);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      for (const k of [0, 0.011, 0.022]) {
        g.gain.setValueAtTime(e.gain, at + k);
        g.gain.exponentialRampToValueAtTime(e.gain * 0.2, at + k + 0.009);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
      s.connect(filter("bandpass", 1500, 0.9)).connect(g);
      out(g, { send: 0.4 });
      track(s, at + 0.2);
      voices.snare({ gain: e.gain * 0.5 }, at);
    },
    snare(e, at) {
      const s = noiseSrc(at);
      const g = ctx.createGain();
      env(g, at, 0.001, e.gain, 0, 0.11);
      s.connect(filter("bandpass", 2000, 0.7)).connect(g);
      out(g, { send: 0.25 });
      track(s, at + 0.14);
      const v = osc("triangle", 230, at);
      v.frequency.exponentialRampToValueAtTime(170, at + 0.06);
      const vg = ctx.createGain();
      env(vg, at, 0.001, e.gain * 0.6, 0, 0.07);
      v.connect(vg);
      out(vg);
      track(v, at + 0.1);
    },
    crash(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.2) return;
      const s = noiseSrc(at);
      const g = ctx.createGain();
      env(g, at, 0.002, e.gain, 0, dur);
      s.connect(filter("highpass", 4500)).connect(g);
      out(g, { send: 0.5 });
      track(s, at + dur + 0.05);
    },
    tick(e, at) {
      const s = noiseSrc(at);
      const g = ctx.createGain();
      env(g, at, 0.001, e.gain || 0.07, 0, 0.03);
      s.connect(filter("bandpass", 3200 + Math.random() * 900, 4)).connect(g);
      out(g, { send: 0.15 });
      track(s, at + 0.05);
    },
    stamp(e, at) {
      const v = osc("sine", 190, at);
      v.frequency.exponentialRampToValueAtTime(70, at + 0.09);
      const g = ctx.createGain();
      env(g, at, 0.002, (e.gain || 0.3) * 0.85, 0, 0.16);
      v.connect(g);
      out(g, { send: 0.3 });
      track(v, at + 0.2);
      voices.tick({ gain: 0.05 }, at);
    },
    impact(e, at) {
      const v = osc("sine", 70, at);
      v.frequency.exponentialRampToValueAtTime(28, at + 1.2);
      const g = ctx.createGain();
      env(g, at, 0.005, e.gain, 0.05, 1.3);
      v.connect(g);
      out(g, { send: 0.6 });
      track(v, at + 1.6);
      const s = noiseSrc(at);
      const f = filter("lowpass", 3000);
      f.frequency.setValueAtTime(3000, at);
      f.frequency.exponentialRampToValueAtTime(200, at + 0.6);
      const ng = ctx.createGain();
      env(ng, at, 0.002, e.gain * 0.4, 0, 0.7);
      s.connect(f).connect(ng);
      out(ng, { send: 0.8 });
      track(s, at + 0.8);
    },
    subdrop(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.25) return;
      const v = osc("sine", 62, at);
      v.frequency.exponentialRampToValueAtTime(26, at + dur);
      const g = ctx.createGain();
      env(g, at, 0.01, e.gain, 0.2, dur - 0.2);
      v.connect(g);
      out(g);
      track(v, at + dur + 0.05);
    },
    riser(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.2) return;
      const p0 = off / e.dur;
      const s = noiseSrc(at);
      const f = filter("bandpass", 300, 3);
      f.frequency.setValueAtTime(300 * Math.pow(20, p0), at);
      f.frequency.exponentialRampToValueAtTime(6000, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, e.gain * p0 * p0), at);
      g.gain.exponentialRampToValueAtTime(e.gain, at + dur * 0.96);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(f).connect(g);
      out(g, { send: 0.6 });
      track(s, at + dur + 0.05);
      // 一條往上滑的鋸齒波，讓上升有音高。
      const v = osc("sawtooth", 180 * Math.pow(8, p0), at);
      v.frequency.exponentialRampToValueAtTime(1440, at + dur);
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(Math.max(0.0001, e.gain * 0.18 * p0), at);
      vg.gain.exponentialRampToValueAtTime(e.gain * 0.18, at + dur * 0.96);
      vg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      v.connect(filter("lowpass", 2400)).connect(vg);
      out(vg, { send: 0.5 });
      track(v, at + dur + 0.05);
    },
    /** 反向的鈸：吸進去，吸到最大就切掉（接在撞擊前面）。 */
    swell(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.1) return;
      const s = noiseSrc(at);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(e.gain, at + dur - 0.005);
      g.gain.linearRampToValueAtTime(0.0001, at + dur);
      s.connect(filter("highpass", 3000)).connect(g);
      out(g, { send: 0.3 });
      track(s, at + dur + 0.02);
    },
    /** 往下掉的噪音（段落退場）。 */
    down(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.2) return;
      const s = noiseSrc(at);
      const f = filter("bandpass", 5000, 2);
      f.frequency.setValueAtTime(5000, at);
      f.frequency.exponentialRampToValueAtTime(180, at + dur);
      const g = ctx.createGain();
      env(g, at, 0.01, e.gain, 0, dur);
      s.connect(f).connect(g);
      out(g, { send: 0.6 });
      track(s, at + dur + 0.05);
    },
    whoosh(e, at) {
      const s = noiseSrc(at);
      const f = filter("bandpass", 400, 1.2);
      f.frequency.setValueAtTime(400, at);
      f.frequency.exponentialRampToValueAtTime(2400, at + e.dur * 0.5);
      f.frequency.exponentialRampToValueAtTime(300, at + e.dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(e.gain, at + e.dur * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur);
      s.connect(f).connect(g);
      out(g, { send: 0.5 });
      track(s, at + e.dur + 0.05);
    },
    clash(e, at) {
      voices.impact({ gain: 0.25 }, at);
      const v = osc("square", 220, at);
      v.frequency.exponentialRampToValueAtTime(110, at + 0.2);
      const g = ctx.createGain();
      env(g, at, 0.002, 0.08, 0, 0.25);
      v.connect(filter("lowpass", 1200)).connect(g);
      out(g, { send: 0.3 });
      track(v, at + 0.3);
    },
    chime(e, at) {
      voices.bell({ f: e.f || hz("A", 5), gain: e.gain || 0.08, dur: 1.2 }, at, 0);
    },
    /** 數位雜訊（斷線那一下）。 */
    glitch(e, at) {
      for (let k = 0; k < 5; k++) {
        const t = at + k * 0.045;
        const v = osc("square", 180 + ((k * 397) % 900), t);
        const g = ctx.createGain();
        env(g, t, 0.001, (e.gain || 0.06) * (1 - k * 0.12), 0.02, 0.01);
        v.connect(g);
        out(g, { send: 0.1 });
        track(v, t + 0.05);
      }
    },
    /* ---- 操作的音效（教學影片：滑鼠點、鍵盤按、牌彈出來） ---- */
    /** 滑鼠按下去：一小聲悶的「答」。 */
    click(e, at) {
      const v = osc("sine", 320, at);
      v.frequency.exponentialRampToValueAtTime(120, at + 0.05);
      const g = ctx.createGain();
      env(g, at, 0.001, (e.gain || 0.16) * 0.9, 0, 0.07);
      v.connect(g);
      out(g, { send: 0.12 });
      track(v, at + 0.1);
      voices.tick({ gain: (e.gain || 0.16) * 0.35 }, at);
    },
    /** 鍵盤按下：機械鍵盤的「喀」（軸體一下、底座一下）。 */
    key(e, at) {
      const s = noiseSrc(at);
      const g = ctx.createGain();
      env(g, at, 0.0008, e.gain || 0.16, 0, 0.022);
      s.connect(filter("bandpass", 2400 + Math.random() * 500, 2.2)).connect(g);
      out(g, { send: 0.1 });
      track(s, at + 0.04);
      const v = osc("triangle", 520, at + 0.012);
      v.frequency.exponentialRampToValueAtTime(190, at + 0.06);
      const vg = ctx.createGain();
      env(vg, at + 0.012, 0.001, (e.gain || 0.16) * 0.55, 0, 0.05);
      v.connect(vg);
      out(vg, { send: 0.08 });
      track(v, at + 0.09);
    },
    /** 牌彈出來、按鈕亮起來：氣泡「啵」。 */
    pop(e, at) {
      const f0 = e.f || 380;
      const v = osc("sine", f0, at);
      v.frequency.exponentialRampToValueAtTime(f0 * 2.1, at + 0.07);
      const g = ctx.createGain();
      env(g, at, 0.003, e.gain || 0.12, 0, 0.09);
      v.connect(g);
      out(g, { send: 0.3, pan: e.pan || 0 });
      track(v, at + 0.14);
    },
    /** 滑鼠指到東西：極輕的一下。 */
    hover(e, at) {
      const v = osc("sine", 1400, at);
      const g = ctx.createGain();
      env(g, at, 0.002, e.gain || 0.035, 0, 0.05);
      v.connect(g);
      out(g, { send: 0.2 });
      track(v, at + 0.08);
    },
    /** 成功：兩三個高音的閃光。 */
    sparkle(e, at) {
      const base = e.f || hz("E", 6);
      [1, 1.5, 2, 2.5].forEach((m, k) => {
        const t = at + k * 0.055;
        const v = osc("sine", base * m, t);
        const g = ctx.createGain();
        env(g, t, 0.003, (e.gain || 0.07) * (1 - k * 0.15), 0, 0.5);
        v.connect(g);
        out(g, { send: 0.7, pan: (k % 2 ? 0.3 : -0.3) });
        track(v, t + 0.6);
      });
    },
    /** 撤回：反著吸回去。 */
    unwind(e, at, off) {
      const dur = e.dur - off;
      if (dur < 0.1) return;
      const s = noiseSrc(at);
      const f = filter("bandpass", 300, 2);
      f.frequency.setValueAtTime(300, at);
      f.frequency.exponentialRampToValueAtTime(3800, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(e.gain || 0.1, at + dur * 0.9);
      g.gain.linearRampToValueAtTime(0.0001, at + dur);
      s.connect(f).connect(g);
      out(g, { send: 0.3 });
      track(s, at + dur + 0.02);
    },
    /** 兩個音的提示（提示條出現）。 */
    toast(e, at) {
      [hz("E", 5), hz("A", 5)].forEach((f, k) => {
        const t = at + k * 0.09;
        const v = osc("triangle", f, t);
        const g = ctx.createGain();
        env(g, t, 0.004, (e.gain || 0.07) * (k ? 1 : 0.8), 0, 0.22);
        v.connect(g);
        out(g, { send: 0.4 });
        track(v, t + 0.3);
      });
    },
  };

  const LONG = new Set(["pad", "keys", "sub", "bell", "riser", "lead", "soft", "crash", "subdrop", "down", "swell", "unwind"]);

  function pump() {
    if (!playing) return;
    const now = ctx.currentTime;
    const horizon = now - startCtx + startT + 1.0;
    while (cursor < events.length && events[cursor].t < horizon) {
      const e = events[cursor++];
      const at = startCtx + (e.t - startT);
      // 拖到一半的長音：從中間接上；短的錯過就算了。
      if (at < now - 0.02) {
        const off = now - at;
        if (LONG.has(e.kind) && off < e.dur) voices[e.kind](e, now + 0.02, off);
        continue;
      }
      voices[e.kind]?.(e, at, 0);
    }
  }

  function stopAll() {
    for (const n of live) {
      try {
        n.stop();
      } catch {
        /* 已經停了 */
      }
    }
    live.clear();
    if (bus) {
      bus.gain.cancelScheduledValues(0);
      bus.gain.setValueAtTime(1, ctx.currentTime);
    }
  }

  return {
    /** 大鼓的時間（畫面跟著大鼓輕輕震一下）。 */
    kicks,
    /** 整首歌離線算好（輸出影片檔用），回傳 AudioBuffer。算完原本的即時播放照常能用。 */
    async render(sampleRate = 48000) {
      const live0 = ctx;
      const off = new OfflineAudioContext(2, Math.ceil((length + 2) * sampleRate), sampleRate);
      const wasMuted = muted;
      muted = false;
      setup(off);
      // 不要一開始就把上萬個聲音節點全建好（還沒響的節點每一格也要算，會慢到十幾分鐘）：
      // 每兩秒停一下，只建接下來兩秒要響的，建好再繼續。
      const STEP = 2;
      let i = 0;
      for (let s = 0; s < length + 2; s += STEP) {
        off.suspend(s).then(() => {
          while (i < events.length && events[i].t < s + STEP) {
            const e = events[i++];
            voices[e.kind]?.(e, Math.max(s, e.t) + 0.001, 0);
          }
          off.resume();
        });
      }
      const buf = await off.startRendering();
      muted = wasMuted;
      ctx = live0;
      master = bus = wet = echo = noise = null;
      if (live0) {
        const c = live0;
        ctx = null;
        setup(c);
      }
      live.clear();
      return buf;
    },
    get ready() {
      return !!ctx;
    },
    /** 從 t 秒開始播（第一次要在使用者點擊裡呼叫，瀏覽器才准出聲）。 */
    play(t = 0) {
      setup();
      ctx.resume();
      stopAll();
      startT = t;
      startCtx = ctx.currentTime + 0.08;
      cursor = events.findIndex((e) => e.t + e.dur >= t);
      if (cursor < 0) cursor = events.length;
      playing = true;
      clearInterval(timer);
      timer = setInterval(pump, 80);
      pump();
    },
    pause() {
      if (!ctx) return;
      startT = this.now();
      playing = false;
      clearInterval(timer);
      stopAll();
    },
    now() {
      if (!ctx || !playing) return startT;
      return Math.max(0, ctx.currentTime - startCtx + startT);
    },
    get playing() {
      return playing;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : VOL, ctx.currentTime, 0.05);
    },
    get muted() {
      return muted;
    },
  };
}
