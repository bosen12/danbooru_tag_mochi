/**
 * 介紹影片的 WebGL 層（three.js）：整本詞庫的牌組成一片星河。
 *
 * 每一張都是墨池那張牌（花色書脊＋ComfyUI 烘的插畫縮圖），先畫進一張大圖集（atlas），
 * 再用一個 InstancedMesh 一次畫幾百張。六種花色是星河的六條旋臂。
 *
 *   開場（1–10 小節）：墨滴落下 → 牌從中心炸開成星河 → 鏡頭穿過旋臂 → 全部吸回一點 → 標題
 *   結尾（78–92 小節）：牌炸成一顆球 → 攤成一整面牌牆（照花色排成六條色帶）→ 捲成漩渦收掉 → 標題後面一圈
 *
 * 跟畫面的其他部分一樣只看時間：render(t) 永遠畫出同一格。沒有 WebGL 時 createGL 回傳 null，影片照常播。
 */
import * as THREE from "./vendor/three/build/three.module.min.js";
import { EZ, seg, lerp, track, rng, life } from "./film-kit.js";
import { bar } from "./film-score.js";
import { english } from "./i18n.js";

const CW = 128;
const CH = 187;
const COLS = 32;
const MAX = 640;
/** 哪幾段要畫（其他時候整張畫布藏起來、不算）。 */
export const GL_WINDOWS = [
  [bar(1) - 0.2, bar(10) + 0.1],
  [bar(78) - 0.2, bar(92) + 0.2],
];
const OPEN = bar(1);
const FIN = bar(78);

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 一張牌畫進圖集的第 i 格：左邊花色書脊（花色字、中文名直排），右邊插畫。 */
function drawCard(g, i, card, img) {
  const x0 = (i % COLS) * CW;
  const y0 = Math.floor(i / COLS) * CH;
  g.save();
  g.translate(x0, y0);
  roundRect(g, 2, 2, CW - 4, CH - 4, 10);
  g.save();
  g.clip();
  g.fillStyle = "#1c2029";
  g.fillRect(0, 0, CW, CH);
  const ax = english ? 2 : 32;
  if (img) {
    const w = CW - ax - 2;
    const h = CH - (english ? 56 : 4);
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    g.save();
    g.beginPath();
    g.rect(ax, 2, w, h);
    g.clip();
    g.drawImage(img, ax + (w - dw) / 2, 2 + (h - dh) / 2, dw, dh);
    g.restore();
  } else {
    g.fillStyle = card.color;
    g.globalAlpha = 0.25;
    g.fillRect(ax, 2, CW - ax, CH);
    g.globalAlpha = 1;
    g.fillStyle = "#e9e6dc";
    g.font = '800 54px "Chiron Hei HK", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText([...card.zh][0], ax + (CW - ax) / 2, CH / 2);
  }
  if (english) {
    const y = CH - 54;
    g.fillStyle = "#e9e1cd";
    g.fillRect(0, y, CW, 54);
    g.fillStyle = card.color;
    g.fillRect(0, y, CW, 3);
    g.fillStyle = "#24252a";
    g.textAlign = "left";
    g.textBaseline = "top";
    g.font = '700 12px "Segoe UI", sans-serif';
    g.fillText(card.glyph, 7, y + 9);
    const lines = [""];
    for (const word of card.zh.split(" ")) {
      const line = lines.length - 1, candidate = lines[line] ? lines[line] + " " + word : word;
      if (g.measureText(candidate).width > 92 && lines[line]) lines.push(word);
      else lines[line] = candidate;
    }
    lines.slice(0, 3).forEach((line, i) => g.fillText(line, 24, y + 8 + i * 13, 98));
  } else {
    g.fillStyle = card.color;
    g.fillRect(0, 0, 30, CH);
    g.fillStyle = "#12151b";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '800 17px "Chiron Hei HK", sans-serif';
    g.fillText(card.glyph, 16, 20);
    g.font = '700 14px "Chiron Hei HK", sans-serif';
    [...card.zh].slice(0, 7).forEach((ch, k) => g.fillText(ch, 16, 44 + k * 17));
  }
  g.restore();
  roundRect(g, 2, 2, CW - 4, CH - 4, 10);
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

/**
 * cards：[{ zh, glyph, color, suitIndex, src }]（照花色排好）。onProgress(done, total)。
 * 回傳 { render(t, pulse), count } 或 null（沒有 WebGL）。
 */
export async function createGL(canvas, cards, { onProgress } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(1920, 1080, false);
  renderer.setClearColor(0x000000, 0);

  const list = cards.slice(0, MAX);
  const N = list.length;
  const rows = Math.ceil(N / COLS);
  const atlas = document.createElement("canvas");
  atlas.width = COLS * CW;
  atlas.height = Math.max(CH, rows * CH);
  const g = atlas.getContext("2d");

  // ---- 插畫縮圖畫進圖集（同時開 12 張） ----
  let done = 0;
  const loadOne = (card, i) =>
    new Promise((res) => {
      const img = new Image();
      let fin = false;
      const end = () => {
        if (fin) return;
        fin = true;
        drawCard(g, i, card, img.naturalWidth ? img : null);
        onProgress?.(++done, N);
        res();
      };
      img.onload = end;
      img.onerror = end;
      setTimeout(end, 10000);
      if (card.src) img.src = card.src;
      else end();
    });
  let next = 0;
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (next < N) {
        const i = next++;
        await loadOne(list[i], i);
      }
    })
  );

  const tex = new THREE.CanvasTexture(atlas);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;

  // ---- 牌：一個 InstancedMesh ----
  const geo = new THREE.PlaneGeometry(64, (64 * CH) / CW);
  const uvs = new Float32Array(N * 4);
  const alphas = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    uvs[i * 4] = ((i % COLS) * CW) / atlas.width;
    uvs[i * 4 + 1] = 1 - ((Math.floor(i / COLS) + 1) * CH) / atlas.height;
    uvs[i * 4 + 2] = CW / atlas.width;
    uvs[i * 4 + 3] = CH / atlas.height;
  }
  geo.setAttribute("aUv", new THREE.InstancedBufferAttribute(uvs, 4));
  const alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aAlpha", alphaAttr);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, fogNear: { value: 1400 }, fogFar: { value: 6000 }, uGain: { value: 1 } },
    vertexShader: `
      attribute vec4 aUv;
      attribute float aAlpha;
      uniform float fogNear;
      uniform float fogFar;
      varying vec2 vUv;
      varying float vA;
      varying float vFog;
      void main() {
        vUv = aUv.xy + uv * aUv.zw;
        vA = aAlpha;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vFog = smoothstep(fogNear, fogFar, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform float uGain;
      varying vec2 vUv;
      varying float vA;
      varying float vFog;
      void main() {
        vec4 c = texture2D(map, vUv);
        float a = c.a * vA;
        if (a < 0.04) discard;
        vec3 col = mix(c.rgb * uGain, vec3(0.03, 0.035, 0.05), vFog * 0.88);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  // ---- 墨塵：遠遠近近的小點 ----
  const DUST = 1600;
  const dpos = new Float32Array(DUST * 3);
  const R0 = rng(5);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3] = (R0() - 0.5) * 7000;
    dpos[i * 3 + 1] = (R0() - 0.5) * 3600;
    dpos[i * 3 + 2] = (R0() - 0.5) * 7000;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  const dmat = new THREE.PointsMaterial({ color: 0xd6cfc0, size: 4, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dgeo, dmat);

  const scene = new THREE.Scene();
  scene.add(mesh, dust);
  const camera = new THREE.PerspectiveCamera(58, 1920 / 1080, 5, 12000);

  // ---- 每張牌的四個隊形：星河、球、牌牆、圈 ----
  const R = rng(77);
  const ARMS = 6;
  const wallRows = Math.ceil(N / COLS);
  const inst = list.map((c, i) => {
    const r = [R(), R(), R(), R(), R()];
    const rad = 140 + Math.pow(r[0], 0.8) * 1700;
    const ang = (c.suitIndex % ARMS) * ((Math.PI * 2) / ARMS) + rad * 0.0024 + (r[1] - 0.5) * 0.55;
    const thick = (r[2] - 0.5) * (70 + 300 * (1 - rad / 1850));
    const y = 1 - (2 * (i + 0.5)) / N;
    const rr = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      r,
      gal: { rad, ang, y: thick },
      sph: { x: Math.cos(phi) * rr, y, z: Math.sin(phi) * rr },
      wall: { x: (col - (COLS - 1) / 2) * 74, y: -(row - (wallRows - 1) / 2) * 106, col },
      spin: [(r[3] - 0.5) * 2.2, (r[4] - 0.5) * 2.2, (r[1] - 0.5) * 1.4],
    };
  });

  // 鏡頭：{ x, y, z 位置, lx, ly, lz 看哪裡, roll, fov }
  const C = (x, y, z, lx = 0, ly = 0, lz = 0, roll = 0, fov = 58) => ({ x, y, z, lx, ly, lz, roll, fov });
  const cam = track([
    [OPEN, C(0, 60, 520, 0, 0, 0, 0, 64)],
    [OPEN + 2.4, C(0, 950, 2350, 0, -120, 0, -6, 56), EZ.out],
    [OPEN + 5.6, C(1750, 260, 1050, 0, 0, 0, 7, 54)],
    [OPEN + 8.4, C(420, 40, -280, -700, -20, -1300, -5, 64)],
    [OPEN + 10.4, C(-520, 130, 620, 0, 0, 0, 0, 58)],
    [bar(8) - 0.05, C(0, 0, 1500, 0, 0, 0, 0, 48), EZ.in],
    // 標題：鏡頭抬高一點，後面那一圈牌看起來是一個斜的環。
    [bar(8), C(0, 420, 1500, 0, -120, -700, 0, 48)],
    [bar(10), C(0, 360, 1750, 0, -120, -700, 0, 48)],
    [FIN - 0.2, C(0, 0, 900, 0, 0, 0, 0, 60)],
    [FIN + 1.2, C(0, 300, 2300, 0, 0, 0, -4, 55), EZ.out],
    [bar(80), C(-1900, 200, 1300, 0, 0, 0, 5, 55)],
    [bar(82), C(-300, -200, 2000, 0, 0, 0, -3, 55)],
    [bar(82) + 1.6, C(-620, 380, 520, -620, 380, 0, 0, 50), EZ.inOut],
    [bar(85), C(0, 0, 2650, 0, 0, 0, 0, 50), EZ.inOut],
    [bar(86), C(0, 0, 2700, 0, 0, 0, 0, 50)],
    [bar(87) + 1, C(0, 420, 1500, 0, -120, -700, 0, 48), EZ.inOut],
    [bar(92), C(0, 340, 1800, 0, -120, -700, 0, 48)],
  ]);

  const dummy = new THREE.Object3D();
  const out = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, a: 0 };

  /** 第 i 張在時間 t 的位置、角度、大小、透明度（寫進 out）。 */
  function place(i, t) {
    const it = inst[i];
    const [r0] = it.r;
    out.x = out.y = out.z = 0;
    out.rx = it.spin[0] * t * 0.3 + r0 * 6;
    out.ry = it.spin[1] * t * 0.3 + it.r[2] * 6;
    out.rz = it.spin[2] * t * 0.2;
    out.s = 1;
    out.a = 0;
    if (t < bar(10) + 0.2) {
      // 開場：炸開 → 星河（整片慢慢轉）→ 旋進中心 → 標題時從中心炸成一圈。
      const burst = EZ.out(seg(t, OPEN + r0 * 0.3, OPEN + r0 * 0.3 + 2.3));
      const conv = EZ.in(seg(t, bar(7) + (1 - r0) * 0.7, bar(8) - 0.05));
      const g = it.gal;
      const a = g.ang + t * 0.07 + conv * 2.6;
      const rad = g.rad * (1 - conv);
      out.x = Math.cos(a) * rad * burst;
      out.y = g.y * burst * (1 - conv);
      out.z = Math.sin(a) * rad * burst;
      out.s = lerp(0.2, 1, burst) * lerp(1, 0.15, conv);
      out.a = Math.min(1, burst * 3) * (1 - conv * conv * conv);
      if (t >= bar(8) - 0.05 && i % 3 === 0) {
        const k = i / 3;
        const n = Math.ceil(N / 3);
        const e = EZ.out(seg(t, bar(8), bar(8) + 1.3));
        const aa = (k / n) * Math.PI * 2 + t * 0.22;
        out.x = Math.sin(aa) * 1350 * e;
        out.y = Math.cos(aa * 3) * 50 * e;
        out.z = Math.cos(aa) * 1350 * e - 1500 * e;
        out.rx = 0;
        out.ry = aa;
        out.rz = 0;
        out.s = 1.2;
        out.a = life(t, bar(8), bar(10) - 0.6, 0.4, 0.5) * 0.6;
      }
      return;
    }
    // 結尾：球 → 牌牆 → 漩渦 → 圈。
    const sp = EZ.out(seg(t, FIN + r0 * 0.35, FIN + r0 * 0.35 + 1.7));
    const rot = (t - FIN) * 0.35;
    const s = it.sph;
    const R1 = 820;
    let x = (s.x * Math.cos(rot) - s.z * Math.sin(rot)) * R1;
    let z = (s.x * Math.sin(rot) + s.z * Math.cos(rot)) * R1;
    let y = s.y * R1;
    // 臉朝外。
    let ry = Math.atan2(x, z);
    let rx = -Math.asin(s.y);
    out.x = x * sp;
    out.y = y * sp;
    out.z = z * sp;
    out.rx = lerp(out.rx, rx, sp);
    out.ry = lerp(out.ry, ry, sp);
    out.rz = lerp(out.rz, 0, sp);
    out.s = lerp(0.2, 1, sp);
    out.a = Math.min(1, sp * 3);
    // 攤成牌牆：一欄一欄從左到右翻過來。
    const w = it.wall;
    const wp = EZ.inOut(seg(t, bar(82) + (w.col / COLS) * 0.8, bar(82) + (w.col / COLS) * 0.8 + 1.5));
    if (wp > 0) {
      const ripple = Math.sin(Math.hypot(w.x, w.y) * 0.008 - t * 5) * 45 * life(t, bar(83), bar(86), 1, 0.8);
      out.x = lerp(out.x, w.x, wp);
      out.y = lerp(out.y, w.y, wp);
      out.z = lerp(out.z, ripple, wp);
      out.rx = lerp(out.rx, 0, wp);
      out.ry = lerp(out.ry, Math.round(out.ry / (Math.PI * 2)) * Math.PI * 2, wp) + Math.sin(Math.PI * wp) * 1.2;
      out.rz = lerp(out.rz, 0, wp);
      out.s = lerp(out.s, 1, wp);
    }
    // 漩渦：捲進中心。
    const v = EZ.in(seg(t, bar(86) + r0 * 0.9, bar(87) + 0.3));
    if (v > 0) {
      const a0 = Math.atan2(out.y, out.x);
      const d = Math.hypot(out.x, out.y) * (1 - v);
      const a = a0 + v * 3.4;
      out.x = Math.cos(a) * d;
      out.y = Math.sin(a) * d;
      out.z = out.z - v * 900;
      out.s *= 1 - v * 0.8;
      out.a *= 1 - v * v * v;
    }
    if (t >= bar(87) + 0.2 && i % 3 === 0) {
      const k = i / 3;
      const n = Math.ceil(N / 3);
      const e = EZ.out(seg(t, bar(87) + 0.2, bar(87) + 1.8));
      const aa = (k / n) * Math.PI * 2 + t * 0.18;
      out.x = Math.sin(aa) * 1400 * e;
      out.y = Math.cos(aa * 3) * 50 * e;
      out.z = Math.cos(aa) * 1400 * e - 1700 * e;
      out.rx = 0;
      out.ry = aa;
      out.rz = 0;
      out.s = 1.2;
      out.a = life(t, bar(87) + 0.2, bar(91) + 1, 0.5, 1.2) * 0.5;
    }
  }

  let shown = null;
  return {
    count: N,
    /** 畫出第 t 秒；pulse（0–1）＝大鼓那一下讓牌亮一點。不在 GL 段落就藏起畫布。 */
    render(t, pulse = 0) {
      const on = GL_WINDOWS.some(([a, b]) => t >= a && t <= b);
      if (on !== shown) {
        canvas.style.visibility = on ? "visible" : "hidden";
        shown = on;
      }
      if (!on) return false;
      for (let i = 0; i < N; i++) {
        place(i, t);
        dummy.position.set(out.x, out.y, out.z);
        dummy.rotation.set(out.rx, out.ry, out.rz);
        dummy.scale.setScalar(Math.max(0.001, out.s));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        alphas[i] = out.a;
      }
      mesh.instanceMatrix.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      mat.uniforms.uGain.value = 1 + pulse * 0.25;
      const c = cam(t);
      camera.position.set(c.x, c.y, c.z);
      camera.fov = c.fov;
      camera.updateProjectionMatrix();
      camera.up.set(Math.sin((c.roll * Math.PI) / 180), Math.cos((c.roll * Math.PI) / 180), 0);
      camera.lookAt(c.lx, c.ly, c.lz);
      dust.rotation.y = t * 0.02;
      dmat.opacity = 0.45 * Math.min(1, seg(t, OPEN - 0.2, OPEN + 1) + (t > FIN - 1 ? 1 : 0)) * (1 - seg(t, bar(91), bar(92)));
      renderer.render(scene, camera);
      return true;
    },
  };
}
