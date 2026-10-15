/**
 * 螢幕保護的 3D 場景（three.js）：幾百張牌演一部不會結束的短片。
 *
 * 四幕輪流（每幕 22 秒），換幕時每張牌各自沿著一條弧線飛到下一個隊形（錯開出發、邊飛邊翻）：
 *   一、牌河：鏡頭在三條螺旋臂繞成的隧道裡，牌從遠處的墨裡流過來。
 *   二、星河：牌聚成三條旋臂的銀河，鏡頭從上面繞著轉；你最近生成的圖像行星一樣繞著發光的核心。
 *   三、牌浪：牌排成一面弧形的巨牆，一波翻牌從左掃到右，翻回來時已經換成別張。
 *   四、墨雨：牌像花瓣一樣旋轉著落下。
 * 你最近生成的圖每一幕都在（晾在隧道中間、繞著星河、嵌在牆上、跟著落下）；
 * 剛印好的那張：整個場景放慢，它飛到正前方由上往下顯影，一道光掃過去，再退回去。
 *
 * 畫面：背景是慢慢流動的水墨（全畫面 shader）；牌轉動時表面有一道反光；亮的地方暈開（自己做的 bloom：
 * 亮部取出來、縮小、模糊兩層再疊回去）；四角暗一點、有一點點底片顆粒。
 * 牌面跟介紹影片同一種畫法（花色書脊＋插畫縮圖），先畫進一張圖集；最後一格是牌背（墨色紙、金色的「墨」印）。
 * 沒有 WebGL 2 時 createSaverGL 回傳 null，螢幕保護就不出來。
 */
import * as THREE from "./vendor/three/build/three.module.min.js";

const CW = 128;
const CH = 187;
const COLS = 16;
const ACT = 22; // 每幕幾秒（含開頭換幕）
const MORPH = 3.6; // 換幕飛多久
const SPAN = 6400; // 牌河的深度
const SPEED = 260; // 牌河往鏡頭流的速度
const ACTS = ["river", "galaxy", "wave", "rain"];

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 一張牌畫進圖集的第 i 格：左邊花色書脊（花色字、名字直排），右邊插畫；沒有插畫就寫大字。 */
function drawCard(g, i, card, img, english) {
  const x0 = (i % COLS) * CW;
  const y0 = Math.floor(i / COLS) * CH;
  g.save();
  g.translate(x0, y0);
  roundRect(g, 2, 2, CW - 4, CH - 4, 10);
  g.save();
  g.clip();
  g.fillStyle = "#f1ead9";
  g.fillRect(0, 0, CW, CH);
  const ax = english ? 2 : 30;
  const bottom = english ? 50 : 2;
  if (img) {
    const w = CW - ax - 2;
    const h = CH - bottom - 2;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const grow = card.blur ? 12 : 0;
    g.save();
    g.beginPath();
    g.rect(ax, 2, w, h);
    g.clip();
    // 設定成要模糊的分級：插畫糊掉，只留顏色（書脊上的名字照樣看得到）。
    if (card.blur) g.filter = "blur(9px) saturate(1.2)";
    g.drawImage(img, ax + (w - dw) / 2 - grow, 2 + (h - dh) / 2 - grow, dw + grow * 2, dh + grow * 2);
    g.filter = "none";
    g.restore();
  } else {
    // 沒有插畫的牌：花色底上寫大字。
    g.fillStyle = card.color;
    g.globalAlpha = 0.22;
    g.fillRect(ax, 0, CW - ax, CH);
    g.globalAlpha = 1;
    g.fillStyle = "#1b1d22";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${english ? 22 : 52}px "Chiron Hei HK", "IBM Plex Sans", sans-serif`;
    g.fillText(english ? card.name.slice(0, 9) : [...card.name][0], ax + (CW - ax) / 2, (CH - bottom) / 2);
  }
  if (english) {
    const y = CH - bottom;
    g.fillStyle = "#e9e1cd";
    g.fillRect(0, y, CW, bottom);
    g.fillStyle = card.color;
    g.fillRect(0, y, CW, 3);
    g.fillStyle = "#24252a";
    g.textAlign = "left";
    g.textBaseline = "top";
    g.font = '700 12px "IBM Plex Sans", "Segoe UI", sans-serif';
    g.fillText(card.glyph, 7, y + 9);
    const lines = [""];
    for (const word of card.name.split(" ")) {
      const line = lines.length - 1;
      const next = lines[line] ? lines[line] + " " + word : word;
      if (g.measureText(next).width > 92 && lines[line]) lines.push(word);
      else lines[line] = next;
    }
    lines.slice(0, 3).forEach((line, k) => g.fillText(line, 24, y + 8 + k * 13, 98));
  } else {
    g.fillStyle = card.color;
    g.fillRect(0, 0, 28, CH);
    g.fillStyle = "#12151b";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '800 16px "Chiron Hei HK", sans-serif';
    g.fillText(card.glyph, 15, 19);
    g.font = '700 13px "Chiron Hei HK", sans-serif';
    [...card.name].slice(0, 8).forEach((ch, k) => g.fillText(ch, 15, 42 + k * 16));
  }
  g.restore();
  roundRect(g, 2, 2, CW - 4, CH - 4, 10);
  g.strokeStyle = "rgba(255,255,255,0.4)";
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

/** 牌背：墨色的紙、細金框、中間一顆金色的「墨」印。 */
function drawBack(g, i, english) {
  const x0 = (i % COLS) * CW;
  const y0 = Math.floor(i / COLS) * CH;
  g.save();
  g.translate(x0, y0);
  roundRect(g, 2, 2, CW - 4, CH - 4, 10);
  g.save();
  g.clip();
  const bg = g.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, "#1a1d24");
  bg.addColorStop(1, "#0c0e12");
  g.fillStyle = bg;
  g.fillRect(0, 0, CW, CH);
  g.strokeStyle = "rgba(201,164,94,0.18)";
  g.lineWidth = 1;
  for (let k = -CH; k < CW + CH; k += 9) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k - CH * 0.6, CH);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "#c9a45e";
  g.lineWidth = 2;
  roundRect(g, 9, 9, CW - 18, CH - 18, 6);
  g.stroke();
  g.beginPath();
  g.arc(CW / 2, CH / 2, 30, 0, Math.PI * 2);
  g.fillStyle = "#c9a45e";
  g.fill();
  g.fillStyle = "#14161b";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = english ? '800 30px "IBM Plex Sans", sans-serif' : '900 34px "Chiron Sung HK", "Chiron Hei HK", serif';
  g.fillText(english ? "M" : "墨", CW / 2, CH / 2 + 1);
  roundRect(g, 2, 2, CW - 4, CH - 4, 10);
  g.strokeStyle = "rgba(201,164,94,0.6)";
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

const loadImage = (src, timeout = 12000) =>
  new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    let fin = false;
    const end = (ok) => {
      if (fin) return;
      fin = true;
      res(ok && img.naturalWidth ? img : null);
    };
    img.decoding = "async";
    img.onload = () => end(true);
    img.onerror = () => end(false);
    setTimeout(() => end(false), timeout);
    img.src = src;
  });

/** 一張成品畫成晾著的紙：米白紙邊＋圖；要模糊的先糊掉再畫上去。回傳 { canvas, aspect }。 */
function printCanvas(img, blur) {
  const H = 640;
  const pad = 18;
  const ih = H - pad * 2;
  const iw = Math.round((img.naturalWidth / img.naturalHeight) * ih);
  const c = document.createElement("canvas");
  c.width = iw + pad * 2;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#f3eee2";
  g.fillRect(0, 0, c.width, c.height);
  g.save();
  g.beginPath();
  g.rect(pad, pad, iw, ih);
  g.clip();
  if (blur) {
    g.filter = "blur(26px) saturate(1.2)";
    g.drawImage(img, pad - 40, pad - 40, iw + 80, ih + 80);
    g.filter = "none";
    g.fillStyle = "rgba(10,12,16,0.25)";
    g.fillRect(pad, pad, iw, ih);
  } else {
    g.drawImage(img, pad, pad, iw, ih);
  }
  g.restore();
  return { canvas: c, aspect: c.width / c.height };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const mod = (a, n) => ((a % n) + n) % n;

/* ---------- 後製：水墨背景、bloom、暗角、顆粒 ---------- */

const QUAD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BRIGHT_FS = `
  uniform sampler2D tex; uniform float threshold; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tex, vUv);
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor = vec4(c.rgb * smoothstep(threshold, threshold + 0.18, l), 1.0);
  }`;
const BLUR_FS = `
  uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tex, vUv).rgb * 0.227;
    c += texture2D(tex, vUv + dir * 1.385).rgb * 0.316;
    c += texture2D(tex, vUv - dir * 1.385).rgb * 0.316;
    c += texture2D(tex, vUv + dir * 3.231).rgb * 0.070;
    c += texture2D(tex, vUv - dir * 3.231).rgb * 0.070;
    gl_FragColor = vec4(c, 1.0);
  }`;
const FINAL_FS = `
  uniform sampler2D scene; uniform sampler2D bloomA; uniform sampler2D bloomB;
  uniform float time; uniform float aspect; uniform float strength; uniform float flash;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    // 水墨：兩層 fbm 互相扭，慢慢流；中間一點暖光。
    float t = time * 0.025;
    vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.0));
    float ink = fbm(p * 2.2 + q * 1.8 + vec2(t * 0.6, -t * 0.4));
    vec3 bg = mix(vec3(0.02, 0.025, 0.035), vec3(0.11, 0.135, 0.16), smoothstep(0.3, 0.9, ink));
    // 墨跡的邊：一道一道細細亮一點，看得出墨在流。
    bg += vec3(0.05, 0.065, 0.08) * smoothstep(0.02, 0.0, abs(ink - 0.55));
    bg += vec3(0.2, 0.13, 0.06) * smoothstep(0.8, 0.0, length(p)) * (0.4 + 0.3 * ink);
    // 鏡頭邊緣一點點色散（紅藍往外、往內各偏一點），像真的鏡頭。
    vec2 ca = (vUv - 0.5) * 0.0045 * length(p);
    vec4 s = texture2D(scene, vUv);
    vec3 sc = vec3(texture2D(scene, vUv + ca).r, s.g, texture2D(scene, vUv - ca).b);
    vec3 col = bg * (1.0 - s.a) + sc;
    col += (texture2D(bloomA, vUv).rgb * 0.6 + texture2D(bloomB, vUv).rgb) * strength;
    col += vec3(1.0, 0.86, 0.6) * flash * smoothstep(0.9, 0.0, length(p));
    // 調色：暗部偏青、亮部偏暖；再用一條柔的曲線收高光（bloom 疊上去也不會死白）。
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col *= mix(vec3(0.9, 1.0, 1.08), vec3(1.07, 1.0, 0.9), smoothstep(0.05, 0.7, lum));
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    // 暗角＋顆粒
    col *= mix(1.0, smoothstep(1.25, 0.25, length(p)), 0.75);
    col += (hash(vUv * 1000.0 + time) - 0.5) * 0.025;
    gl_FragColor = vec4(col, 1.0);
  }`;

/**
 * canvas：要畫的 <canvas>（滿版）。cards：[{ name, glyph, color, src, blur }]。
 * prints：[{ src, blur }]（新到舊）。回傳 { start(), pause(on), seek(sec), stop(), addFresh(print) }，或 null。
 */
export async function createSaverGL(canvas, cards, prints, { english = false, calm = false, onFresh, onAct } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);

  // ---- 圖集：牌面先畫好（同時開 10 張），最後一格是牌背 ----
  const N = Math.min(cards.length, 239);
  const rows = Math.ceil((N + 1) / COLS);
  const atlas = document.createElement("canvas");
  atlas.width = COLS * CW;
  atlas.height = rows * CH;
  const g = atlas.getContext("2d");
  let next = 0;
  await Promise.all(
    Array.from({ length: 10 }, async () => {
      while (next < N) {
        const i = next++;
        drawCard(g, i, cards[i], await loadImage(cards[i].src), english);
      }
    })
  );
  drawBack(g, N, english);
  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  atlasTex.needsUpdate = true;
  const slotUv = (slot) => [((slot % COLS) * CW) / atlas.width, 1 - ((Math.floor(slot / COLS) + 1) * CH) / atlas.height, CW / atlas.width, CH / atlas.height];

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 5, 14000);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);

  // ---- 牌：一個 InstancedMesh ----
  const COUNT = 360;
  const geo = new THREE.PlaneGeometry(64, (64 * CH) / CW);
  const uvs = new Float32Array(COUNT * 4);
  const alphas = new Float32Array(COUNT);
  const uvAttr = new THREE.InstancedBufferAttribute(uvs, 4);
  uvAttr.setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
  // 亮度：牌浪那一波翻過去時，翻起來的牌亮起來（bloom 會把它暈開，看起來是一道光掃過整面牆）。
  const glows = new Float32Array(COUNT);
  const glowAttr = new THREE.InstancedBufferAttribute(glows, 1);
  glowAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aUv", uvAttr);
  geo.setAttribute("aAlpha", alphaAttr);
  geo.setAttribute("aGlow", glowAttr);
  const setSlot = (k, slot) => {
    uvs.set(slotUv(slot), k * 4);
    uvAttr.needsUpdate = true;
  };
  // 預乘 alpha 疊上去：場景畫在透明的底上，最後才跟水墨背景合成。
  const premult = {
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  };
  const cardMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: atlasTex },
      backUv: { value: new THREE.Vector4(...slotUv(N)) },
      lightDir: { value: new THREE.Vector3(0.4, 0.7, 0.6).normalize() },
      fogFar: { value: 9000 },
    },
    vertexShader: `
      attribute vec4 aUv;
      attribute float aAlpha;
      attribute float aGlow;
      varying float vG;
      uniform float fogFar;
      varying vec2 vUv;
      varying vec4 vSlot;
      varying float vA;
      varying vec3 vN;
      varying vec3 vV;
      varying float vFog;
      void main() {
        vUv = uv;
        vSlot = aUv;
        vA = aAlpha;
        vG = aGlow;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0));
        vV = normalize(cameraPosition - world.xyz);
        vec4 mv = viewMatrix * world;
        vFog = smoothstep(fogFar * 0.45, fogFar, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec4 backUv;
      uniform vec3 lightDir;
      varying vec2 vUv;
      varying vec4 vSlot;
      varying float vA;
      varying float vG;
      varying vec3 vN;
      varying vec3 vV;
      varying float vFog;
      void main() {
        vec4 slot = gl_FrontFacing ? vSlot : backUv;
        vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
        vec4 c = texture2D(map, slot.xy + uv * slot.zw);
        float a = c.a * vA * (1.0 - vFog);
        if (a < 0.02) discard;
        vec3 n = gl_FrontFacing ? vN : -vN;
        // 牌轉到某個角度時，表面掠過一道反光（像上了一層光油）。
        float sheen = pow(max(dot(reflect(-lightDir, n), vV), 0.0), 28.0);
        float lit = 0.72 + 0.28 * max(dot(n, vV), 0.0);
        vec3 col = c.rgb * lit + vec3(1.0, 0.93, 0.8) * sheen * 0.55;
        col = col * (1.0 + vG * 0.55) + vec3(1.0, 0.8, 0.5) * vG * 0.25;
        gl_FragColor = vec4(col * a, a);
      }`,
    ...premult,
  });
  const deck = new THREE.InstancedMesh(geo, cardMat, COUNT);
  deck.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  deck.frustumCulled = false;
  scene.add(deck);

  const R = Math.random;
  /*
   * 換幕時方向的轉法：同一個方向有 q、-q 兩種寫法，內建的 slerp 每一格都挑「轉得少」的那一邊，
   * 但兩幕的牌都在動，轉到一半「哪邊少」會突然換邊 —— 那張牌就在一格之內翻到別的角度（看起來整排擺法瞬間變了）。
   * 所以：兩邊的方向各自跟上一格對齊正負號（不讓寫法自己跳），換幕一開始決定從哪邊轉，中途不換邊。
   */
  const turnTrack = () => ({ qPrev: new THREE.Quaternion(), qNext: new THREE.Quaternion(), turning: false, fresh: true });
  const align = (q, ref) => {
    if (q.dot(ref) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    ref.copy(q);
  };
  const rotTo = (out, a, b, t) => {
    let c = a.dot(b);
    if (Math.abs(c) > 0.9995) {
      const sg = c < 0 ? -1 : 1;
      out.set(a.x + (b.x * sg - a.x) * t, a.y + (b.y * sg - a.y) * t, a.z + (b.z * sg - a.z) * t, a.w + (b.w * sg - a.w) * t).normalize();
      return out;
    }
    c = Math.min(1, Math.max(-1, c));
    const th = Math.acos(c);
    const sn = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / sn;
    const wb = Math.sin(t * th) / sn;
    return out.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb, a.w * wa + b.w * wb).normalize();
  };
  /** 這一格的方向：不在換幕時只記下來；換幕時從上一幕的方向照固定的那一邊轉到這一幕的。 */
  const blend = (tr, qa, qb, e, morphing) => {
    if (!morphing) {
      if (tr.turning) {
        tr.qPrev.copy(tr.qNext);
        tr.turning = false;
      }
      if (tr.fresh) {
        tr.qPrev.copy(qb);
        tr.fresh = false;
      } else align(qb, tr.qPrev);
      return qb;
    }
    if (tr.fresh) {
      tr.qPrev.copy(qa);
      tr.fresh = false;
    } else align(qa, tr.qPrev);
    if (!tr.turning) {
      tr.qNext.copy(qb);
      // 從轉得少的那一邊開始，之後就固定這一邊。
      if (qa.dot(qb) < 0) tr.qNext.set(-qb.x, -qb.y, -qb.z, -qb.w);
      tr.turning = true;
    }
    align(qb, tr.qNext);
    return rotTo(qb, qa, qb, e);
  };
  const inst = Array.from({ length: COUNT }, (_, k) => {
    const it = { r: [R(), R(), R(), R(), R(), R()], arm: k % 3, cyc: { river: null, wave: null, rain: null }, ...turnTrack() };
    setSlot(k, k % N);
    return it;
  });
  let deal = COUNT;
  const reslot = (k) => setSlot(k, deal++ % N);

  // ---- 墨塵 ----
  const DUST = 1400;
  const dpos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3] = (R() - 0.5) * 6000;
    dpos[i * 3 + 1] = (R() - 0.5) * 4000;
    dpos[i * 3 + 2] = -R() * SPAN + 800;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  // 每一粒大小不同、各自慢慢閃，邊緣是柔的（不是方塊點）。
  const dsize = new Float32Array(DUST);
  const dphase = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dsize[i] = 2 + Math.pow(R(), 3) * 14;
    dphase[i] = R() * 6.283;
  }
  dgeo.setAttribute("aSize", new THREE.BufferAttribute(dsize, 1));
  dgeo.setAttribute("aPhase", new THREE.BufferAttribute(dphase, 1));
  const dmat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0.6 }, scale: { value: innerHeight * dpr * 0.5 } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float time;
      uniform float scale;
      varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vTw = 0.45 + 0.55 * sin(time * (0.8 + fract(aPhase) * 1.6) + aPhase);
        gl_PointSize = aSize * scale / max(1.0, -mv.z) * 1.2;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float opacity;
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 2.2) * vTw * opacity;
        gl_FragColor = vec4(vec3(1.0, 0.88, 0.68) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dustA = new THREE.Points(dgeo, dmat);
  const dustB = new THREE.Points(dgeo, dmat);
  dustA.frustumCulled = dustB.frustumCulled = false;
  scene.add(dustA, dustB);

  // ---- 牌河的光痕：一道一道往鏡頭衝（只在牌河那一幕看得到） ----
  const STREAK = 420;
  const spos = new Float32Array(STREAK * 2 * 3);
  const send = new Float32Array(STREAK * 2);
  for (let i = 0; i < STREAK; i++) {
    const th = R() * Math.PI * 2;
    const rad = 180 + Math.pow(R(), 0.6) * 1600;
    const z = -R() * SPAN;
    for (let e = 0; e < 2; e++) {
      spos.set([Math.cos(th) * rad, Math.sin(th) * rad * 0.8, z], (i * 2 + e) * 3);
      send[i * 2 + e] = e;
    }
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
  sgeo.setAttribute("aEnd", new THREE.BufferAttribute(send, 1));
  const smat = new THREE.ShaderMaterial({
    uniforms: { run: { value: 0 }, len: { value: 0 }, span: { value: SPAN } },
    vertexShader: `
      attribute float aEnd;
      uniform float run;
      uniform float len;
      uniform float span;
      varying float vA;
      void main() {
        vec3 p = position;
        p.z = 600.0 - span + mod(p.z + span + run, span) - aEnd * len;
        vA = (1.0 - aEnd) * smoothstep(600.0 - span, 1600.0 - span, p.z) * smoothstep(700.0, 300.0, p.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float vA;
      void main() { gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * vA * 0.7, 0.0); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const streaks = new THREE.LineSegments(sgeo, smat);
  streaks.frustumCulled = false;
  scene.add(streaks);

  // ---- 星河的核心：一團暖光 ----
  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const gg = c.getContext("2d");
    const grad = gg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,236,200,1)");
    grad.addColorStop(0.18, "rgba(255,196,120,0.55)");
    grad.addColorStop(0.5, "rgba(190,120,60,0.12)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    gg.fillStyle = grad;
    gg.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  core.scale.set(1100, 1100, 1);
  scene.add(core);
  // 光芒：一圈細細的放射線，慢慢轉。
  const raysTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const gg = c.getContext("2d");
    gg.translate(256, 256);
    for (let i = 0; i < 48; i++) {
      gg.rotate((Math.PI * 2) / 48 + (Math.random() - 0.5) * 0.05);
      const len = 140 + Math.random() * 110;
      const grad = gg.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, "rgba(255,220,160,0.5)");
      grad.addColorStop(1, "rgba(255,200,120,0)");
      gg.fillStyle = grad;
      gg.beginPath();
      gg.moveTo(0, -1.2);
      gg.lineTo(len, -0.2);
      gg.lineTo(len, 0.2);
      gg.lineTo(0, 1.2);
      gg.fill();
    }
    return new THREE.CanvasTexture(c);
  })();
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  rays.scale.set(1500, 1500, 1);
  scene.add(rays);
  // 橫向光條：電影鏡頭那種（星河的核心、剛印好的那張顯影時）。
  const flareTex = (() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 32;
    const gg = c.getContext("2d");
    const h = gg.createLinearGradient(0, 0, 512, 0);
    h.addColorStop(0, "rgba(120,170,255,0)");
    h.addColorStop(0.5, "rgba(255,240,220,0.9)");
    h.addColorStop(1, "rgba(120,170,255,0)");
    gg.fillStyle = h;
    gg.fillRect(0, 0, 512, 32);
    gg.globalCompositeOperation = "destination-in";
    const v = gg.createLinearGradient(0, 0, 0, 32);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(0.5, "rgba(0,0,0,1)");
    v.addColorStop(1, "rgba(0,0,0,0)");
    gg.fillStyle = v;
    gg.fillRect(0, 0, 512, 32);
    return new THREE.CanvasTexture(c);
  })();
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  flare.scale.set(2600, 60, 1);
  flare.renderOrder = 4;
  scene.add(flare);

  // ---- 成品：晾著的紙 ----
  const printGeo = new THREE.PlaneGeometry(1, 1, 12, 12);
  const printMat = (tex) =>
    new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uDev: { value: 1 }, uAlpha: { value: 1 }, uSweep: { value: -1 }, uCurl: { value: 0.06 }, time: { value: 0 } },
      vertexShader: `
        uniform float uCurl;
        uniform float time;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          // 紙微微彎、輕輕飄。
          p.z += (p.x * p.x) * uCurl * 0.6 + sin(time * 1.3 + p.y * 3.0) * 0.012;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D map;
        uniform float uDev;
        uniform float uAlpha;
        uniform float uSweep;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(map, vUv);
          // 顯影：從上往下，紙先是空白的，圖一段一段浮出來。
          float edge = smoothstep(1.0 - uDev - 0.07, 1.0 - uDev + 0.07, vUv.y);
          vec3 col = mix(vec3(0.953, 0.933, 0.886), c.rgb, edge);
          // 顯影完，一道光從左上掃到右下。
          float band = 1.0 - smoothstep(0.0, 0.08, abs((vUv.x - vUv.y * 0.6) - uSweep));
          col += vec3(1.0, 0.92, 0.75) * band * 0.22;
          gl_FragColor = vec4(col * 0.9 * uAlpha, uAlpha);
        }`,
      ...premult,
    });
  const printTex = [];
  const makePrintTex = (p) => {
    const t = new THREE.CanvasTexture(p.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    printTex.push(t);
    return { tex: t, aspect: p.aspect };
  };
  const ready = [];
  for (const p of prints) {
    const img = await loadImage(p.src, 8000);
    if (img) ready.push(makePrintTex(printCanvas(img, p.blur)));
  }
  const P = Math.min(6, ready.length);
  let turn = 0;
  const hang = Array.from({ length: P }, (_, j) => {
    const pt = ready[turn++ % ready.length];
    const m = new THREE.Mesh(printGeo, printMat(pt.tex));
    m.userData = { aspect: pt.aspect, j, cyc: null, ...turnTrack() };
    m.renderOrder = 2;
    scene.add(m);
    return m;
  });
  const nextPrint = (m) => {
    if (!ready.length) return;
    const pt = ready[turn++ % ready.length];
    m.material.uniforms.map.value = pt.tex;
    m.userData.aspect = pt.aspect;
  };

  /* ---------- 隊形：每一幕，第 k 張牌在第 t 秒的位置、方向、大小、透明度 ---------- */
  const tmpO = new THREE.Object3D();
  const pose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, a: 1, g: 0 });
  const A = pose();
  const B = pose();
  const look = (o, x, y, z, tx, ty, tz) => {
    tmpO.position.set(x, y, z);
    tmpO.lookAt(tx, ty, tz);
    o.p.set(x, y, z);
    o.q.copy(tmpO.quaternion);
  };
  const euler = new THREE.Euler();
  const spinQ = new THREE.Quaternion();

  function form(act, k, t, o, live) {
    const it = inst[k];
    const r = it.r;
    o.s = 1;
    o.a = 1;
    o.g = 0;
    if (act === "river") {
      // 三條螺旋臂繞成的隧道，牌往鏡頭流過來；流過鏡頭的繞回最遠處、換一張。
      const run = r[0] * SPAN + t * SPEED;
      const z = 600 - SPAN + mod(run, SPAN);
      const cyc = Math.floor(run / SPAN);
      if (live && it.cyc.river !== null && it.cyc.river !== cyc) reslot(k);
      if (live) it.cyc.river = cyc;
      const rad = 300 + Math.pow(r[1], 0.7) * 700;
      const th = it.arm * ((Math.PI * 2) / 3) + (r[2] - 0.5) * 0.9 + z * 0.00045 + t * 0.07;
      look(o, Math.cos(th) * rad, Math.sin(th) * rad * 0.8, z, 0, 0, z + 1100);
      if (r[3] < 0.2) o.q.multiply(spinQ.setFromAxisAngle(Y, t * 0.9 + r[4] * 6));
      o.q.multiply(spinQ.setFromAxisAngle(Z, Math.sin(t * 0.5 + r[5] * 6) * 0.15));
      o.s = 0.9 + r[4] * 0.5;
      o.a = clamp01((z - (600 - SPAN)) / 1400) * clamp01((560 - z) / 260);
    } else if (act === "galaxy") {
      // 三條旋臂的銀河，內圈轉得快、外圈慢。
      const rad = 140 + Math.pow(r[1], 0.85) * 1650;
      const th = it.arm * ((Math.PI * 2) / 3) + rad * 0.0026 + (r[2] - 0.5) * 0.5 + (t * 0.18 * 300) / (rad + 300);
      const y = (r[3] - 0.5) * 220 * (1 - rad / 1900) + Math.sin(t * 0.8 + r[5] * 6) * 12;
      o.p.set(Math.cos(th) * rad, y, Math.sin(th) * rad);
      euler.set(-Math.PI / 2 + 0.35 + (r[4] - 0.5) * 0.5, 0, -th + Math.PI / 2, "XZY");
      o.q.setFromEuler(euler);
      o.s = 0.75 + r[4] * 0.6;
    } else if (act === "wave") {
      // 弧形巨牆：一波翻牌從左掃到右，翻到背面時換成別張。
      const C = 26;
      const RW = Math.ceil(COUNT / C);
      const col = k % C;
      const row = Math.floor(k / C);
      const ang = (col - (C - 1) / 2) * 0.064;
      const RAD = 2100;
      const phase = t / 6.5 - col * 0.028 - row * 0.016;
      const cyc = Math.floor(phase);
      const f = clamp01((phase - cyc) / 0.2);
      if (live && f > 0.5 && it.cyc.wave !== cyc) {
        if (it.cyc.wave !== null) reslot(k);
        it.cyc.wave = cyc;
      }
      const flip = easeInOut(f) * Math.PI * 2;
      const pop = Math.sin(Math.PI * f) * 140;
      o.p.set(Math.sin(ang) * (RAD - pop), (row - (RW - 1) / 2) * 140 + Math.sin(t * 0.7 + col * 0.3) * 10, -700 + (1 - Math.cos(ang)) * RAD + pop * Math.cos(ang));
      euler.set(0, -ang + flip, 0);
      o.q.setFromEuler(euler);
      o.s = 1.35;
      o.g = Math.sin(Math.PI * f);
    } else {
      // 墨雨：牌像花瓣一樣轉著落下，落到底下回到上面、換一張。
      const H = 3000;
      const fall = r[0] * H + t * (70 + r[1] * 80);
      const cyc = Math.floor(fall / H);
      if (live && it.cyc.rain !== null && it.cyc.rain !== cyc) reslot(k);
      if (live) it.cyc.rain = cyc;
      const y = H / 2 - mod(fall, H);
      const rad = 260 + Math.pow(r[2], 0.6) * 1400;
      const th = r[3] * Math.PI * 2 + t * 0.09 * (r[4] < 0.5 ? 1 : -1) + Math.sin(t * 0.3 + r[5] * 6) * 0.2;
      o.p.set(Math.cos(th) * rad, y, Math.sin(th) * rad - 200);
      euler.set(t * (0.4 + r[4]) + r[0] * 6, t * (0.3 + r[5]) + r[1] * 6, Math.sin(t * 0.6 + r[2] * 6) * 0.8);
      o.q.setFromEuler(euler);
      o.s = 0.8 + r[5] * 0.5;
      o.a = clamp01((H / 2 - Math.abs(y)) / 500);
    }
  }

  /** 成品在每一幕的位置。 */
  function printForm(act, j, t, o, live, m) {
    o.s = 1;
    o.a = 1;
    if (act === "river") {
      const run = (j / Math.max(1, P)) * SPAN + t * SPEED * 0.85;
      const z = 600 - SPAN + mod(run, SPAN);
      const cyc = Math.floor(run / SPAN);
      if (live && m.userData.cyc !== null && m.userData.cyc !== cyc) nextPrint(m);
      if (live) m.userData.cyc = cyc;
      look(o, Math.sin(j * 1.9 + 0.5) * 240, Math.cos(j * 1.3) * 140, z, camera.position.x * 0.3, camera.position.y * 0.3, 900);
      o.a = clamp01((z - (600 - SPAN)) / 1400) * clamp01((200 - z) / 350);
    } else if (act === "galaxy") {
      const th = (j / Math.max(1, P)) * Math.PI * 2 + t * 0.16;
      const rad = 520 + (j % 3) * 170;
      look(o, Math.cos(th) * rad, 160 + Math.sin(t * 0.7 + j) * 50, Math.sin(th) * rad, camera.position.x, camera.position.y, camera.position.z);
      o.s = 1.1;
    } else if (act === "wave") {
      const x = ((j + 0.5) / Math.max(1, P) - 0.5) * 2000;
      look(o, x, j % 2 ? 210 : -210, -560 + Math.abs(x) * 0.2, x * 0.4, 0, 1400);
      o.s = 1.25;
    } else {
      const y = 900 - mod(j * 520 + t * 55, 2400) + 300;
      const th = j * 2.1 + t * 0.07;
      look(o, Math.cos(th) * 380, y, Math.sin(th) * 380 - 150, camera.position.x, camera.position.y, camera.position.z);
      o.a = clamp01((1300 - Math.abs(y - 100)) / 400);
    }
    o.s *= 300;
  }

  /** 鏡頭在每一幕的位置（p）和看的點（l）。 */
  function camForm(act, t, p, l) {
    if (act === "river") {
      p.set(Math.sin(t * 0.13) * 90, Math.cos(t * 0.1) * 60, 900);
      l.set(Math.sin(t * 0.09) * 60, Math.cos(t * 0.07) * 40, -1000);
    } else if (act === "galaxy") {
      const a = 0.6 + t * 0.07;
      const d = 2300 - Math.min(t, ACT) * 22;
      p.set(Math.sin(a) * d, 1150 - t * 14, Math.cos(a) * d);
      l.set(0, -120, 0);
    } else if (act === "wave") {
      p.set(Math.sin(t * 0.08) * 420, Math.cos(t * 0.06) * 160, 1500 - t * 10);
      l.set(Math.sin(t * 0.08) * 120, 0, -700);
    } else {
      const a = t * 0.05;
      p.set(Math.sin(a) * 600, -150 + Math.sin(t * 0.2) * 60, 1900 + Math.cos(a) * 200);
      l.set(0, 150, -200);
    }
  }

  /* ---------- 後製用的畫布 ---------- */
  const W = () => Math.max(8, Math.round(innerWidth * dpr));
  const Hh = () => Math.max(8, Math.round(innerHeight * dpr));
  const rtScene = new THREE.WebGLRenderTarget(W(), Hh(), { samples: 4 });
  const rtHalf = new THREE.WebGLRenderTarget(W() >> 1, Hh() >> 1);
  const rtQ1 = new THREE.WebGLRenderTarget(W() >> 2, Hh() >> 2);
  const rtQ2 = new THREE.WebGLRenderTarget(W() >> 2, Hh() >> 2);
  const rtE1 = new THREE.WebGLRenderTarget(W() >> 3, Hh() >> 3);
  const rtE2 = new THREE.WebGLRenderTarget(W() >> 3, Hh() >> 3);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeo);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const brightMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, threshold: { value: 0.8 } }, vertexShader: QUAD_VS, fragmentShader: BRIGHT_FS, depthTest: false, depthWrite: false });
  const blurMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false });
  const finalMat = new THREE.ShaderMaterial({
    uniforms: { scene: { value: rtScene.texture }, bloomA: { value: rtQ2.texture }, bloomB: { value: rtE2.texture }, time: { value: 0 }, aspect: { value: innerWidth / innerHeight }, strength: { value: 0.55 }, flash: { value: 0 } },
    vertexShader: QUAD_VS,
    fragmentShader: FINAL_FS,
    depthTest: false,
    depthWrite: false,
  });
  const pass = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  };
  const blur = (src, tmp, dst) => {
    blurMat.uniforms.tex.value = src.texture;
    blurMat.uniforms.dir.value.set(1 / src.width, 0);
    pass(blurMat, tmp);
    blurMat.uniforms.tex.value = tmp.texture;
    blurMat.uniforms.dir.value.set(0, 1 / tmp.height);
    pass(blurMat, dst);
  };

  /* ---------- 剛印好的 ---------- */
  let hero = null;
  let disposed = false;
  let clock = 0;
  async function addFresh(p) {
    const img = await loadImage(p.src, 15000);
    if (!img || disposed) return;
    const pt = makePrintTex(printCanvas(img, p.blur));
    ready.unshift(pt);
    turn = 0;
    if (hero) hero.userData.leave = Math.min(hero.userData.leave, clock);
    const m = new THREE.Mesh(printGeo, printMat(pt.tex));
    m.material.uniforms.uDev.value = 0;
    m.material.uniforms.uAlpha.value = 0;
    m.userData = { born: clock, leave: clock + 7, aspect: pt.aspect, dir: R() < 0.5 ? -1 : 1, from: new THREE.Vector3() };
    m.renderOrder = 3;
    scene.add(m);
    hero = m;
    onFresh?.(p);
  }

  /* ---------- 每一格 ---------- */
  const tmpM = new THREE.Matrix4();
  const tmpS = new THREE.Vector3();
  const camP = new THREE.Vector3();
  const camL = new THREE.Vector3();
  const camP2 = new THREE.Vector3();
  const camL2 = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const arc = new THREE.Vector3();
  let story = 0; // 劇情時間（剛印好時放慢）
  let lastAct = -1;
  let warming = false;
  let slow = 1;
  let raf = 0;
  let last = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    step(dt);
  }

  function step(dt) {
    clock += dt;
    const holding = hero && clock < hero.userData.leave;
    slow += ((holding ? 0.12 : 1) - slow) * Math.min(1, dt * 2);
    story += dt * slow * (calm ? 0.4 : 1);

    const actN = Math.floor(story / ACT);
    const act = ACTS[actN % ACTS.length];
    const prev = ACTS[(actN + ACTS.length - 1) % ACTS.length];
    const tl = story - actN * ACT;
    const morphing = actN > 0 && tl < MORPH;
    // 換到新的一幕：上次演這一幕時記的「繞到第幾圈」都作廢，不然第一格每張牌都以為繞過一圈、同時換掉牌面。
    if (actN !== lastAct) {
      lastAct = actN;
      if (!warming) onAct?.(act, actN);
      for (const it of inst) it.cyc[act] = null;
      for (const m of hang) m.userData.cyc = null;
    }

    // 鏡頭：換幕時從上一幕的鏡頭滑到這一幕的。
    camForm(act, tl, camP, camL);
    if (morphing) {
      camForm(prev, tl + ACT, camP2, camL2);
      const e = easeInOut(clamp01(tl / MORPH));
      camP.lerpVectors(camP2, camP, e);
      camL.lerpVectors(camL2, camL, e);
    }
    camera.position.copy(camP);
    camera.lookAt(camL);
    // 換幕時視角先拉寬再收回：牌從四面八方衝過去的速度感。
    const fov = 58 + (morphing && !calm ? Math.sin(Math.PI * easeInOut(clamp01(tl / MORPH))) * 24 : 0);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // 牌
    for (let k = 0; k < COUNT; k++) {
      form(act, k, tl, B, true);
      let s = B.s;
      let a = B.a;
      let gl = B.g;
      if (!morphing) blend(inst[k], null, B.q, 1, false);
      if (morphing) {
        form(prev, k, tl + ACT, A, false);
        // 每張錯開出發，沿著一條往外鼓的弧線飛過去，邊飛邊翻。
        const r = inst[k].r;
        const start = r[0] * (MORPH - 2);
        const e = easeInOut(clamp01((tl - start) / 2));
        const mid = Math.sin(Math.PI * e);
        arc.set(r[1] - 0.5, r[2] - 0.3, r[3] - 0.5).multiplyScalar(900 * mid);
        B.p.lerpVectors(A.p, B.p, e).add(arc);
        blend(inst[k], A.q, B.q, e, true).multiply(spinQ.setFromAxisAngle(Y, mid * Math.PI * (r[4] < 0.5 ? 1 : -1)));
        s = A.s + (B.s - A.s) * e;
        a = Math.min(1, A.a + (B.a - A.a) * e + mid * 0.6);
        gl = A.g + (B.g - A.g) * e + mid * 0.25;
      }
      tmpM.compose(B.p, B.q, tmpS.setScalar(Math.max(0.001, s)));
      deck.setMatrixAt(k, tmpM);
      alphas[k] = a;
      glows[k] = gl;
    }
    deck.instanceMatrix.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    glowAttr.needsUpdate = true;

    // 成品
    for (const m of hang) {
      const j = m.userData.j;
      printForm(act, j, tl, B, true, m);
      let s = B.s;
      let a = B.a;
      if (!morphing) blend(m.userData, null, B.q, 1, false);
      if (morphing) {
        printForm(prev, j, tl + ACT, A, false, m);
        const e = easeInOut(clamp01(tl / MORPH));
        const mid = Math.sin(Math.PI * e);
        // 飛的時候往遠處繞一點、縮小一點：不要從鏡頭前擦過去、整張燒成白光。
        camera.getWorldDirection(ahead);
        B.p.lerpVectors(A.p, B.p, e).addScaledVector(ahead, 700 * mid);
        blend(m.userData, A.q, B.q, e, true);
        s = (A.s + (s - A.s) * e) * (1 - 0.35 * mid);
        a = A.a + (a - A.a) * e;
      }
      m.position.copy(B.p);
      m.quaternion.copy(B.q);
      m.scale.set(s * m.userData.aspect, s, 1);
      m.material.uniforms.uAlpha.value = a;
      m.material.uniforms.time.value = clock;
    }

    // 星河的核心：星河那一幕亮起來。
    const inGalaxy = act === "galaxy" ? (morphing ? easeInOut(tl / MORPH) : 1) : prev === "galaxy" && morphing ? 1 - easeInOut(tl / MORPH) : 0;
    core.material.opacity = inGalaxy * (0.75 + 0.15 * Math.sin(clock * 1.7));
    rays.material.opacity = inGalaxy * 0.55;
    rays.material.rotation = clock * 0.04;
    flare.position.set(0, 0, 0);
    flare.scale.set(2600, 60, 1);
    flare.material.opacity = inGalaxy * 0.5;

    // 墨塵：兩片接力往鏡頭流（牌河那一幕快，其他幕慢慢飄）。
    const base = mod(story * (act === "river" ? 300 : 60), SPAN);
    dustA.position.z = base;
    dustB.position.z = base - SPAN;
    dustA.rotation.y = dustB.rotation.y = clock * 0.01;
    dmat.uniforms.time.value = clock;
    // 牌河的光痕：牌河那一幕拉長，換幕時收短。
    const inRiver = act === "river" ? (morphing ? easeInOut(tl / MORPH) : 1) : prev === "river" && morphing ? 1 - easeInOut(tl / MORPH) : 0;
    smat.uniforms.run.value = story * SPEED * 1.8;
    smat.uniforms.len.value = inRiver * 380 * slow;

    // 剛印好的
    let flash = 0;
    if (hero) {
      const u = hero.userData;
      const age = clock - u.born;
      const uni = hero.material.uniforms;
      uni.time.value = clock;
      if (clock < u.leave) {
        // 永遠在鏡頭正前方；大小照畫面（最多佔高的 56%、寬的 74%，手機直立時寬度先頂到）。
        camera.getWorldDirection(ahead);
        const visH = 2 * 600 * Math.tan((camera.fov * Math.PI) / 360);
        const h = Math.min(400, visH * 0.56, (visH * camera.aspect * 0.74) / u.aspect);
        const appear = easeOut(clamp01(age / 1.2));
        hero.position.copy(camera.position).addScaledVector(ahead, 600 + (1 - appear) * 900);
        hero.quaternion.copy(camera.quaternion);
        hero.scale.set(h * u.aspect, h, 1);
        uni.uAlpha.value = appear;
        uni.uDev.value = clamp01((age - 0.6) / 2);
        uni.uSweep.value = -0.6 + clamp01((age - 2.8) / 1.4) * 2.2;
        // 顯影完那一下，圖的正中間拉出一道淡淡的橫向光條（不閃整個畫面：無限抽時每張都來一次，太刺眼）。
        const fl = Math.max(0, 1 - Math.abs(age - 2.9) / 0.9);
        if (fl > 0) {
          flare.position.copy(hero.position).addScaledVector(ahead, -40);
          flare.material.opacity = Math.max(flare.material.opacity, fl * 0.3);
          flare.scale.set(1800 * (0.6 + 0.4 * fl), 46, 1);
        }
        u.from.copy(hero.position);
      } else {
        // 放開：往旁邊、往後退，淡掉（它已經排進輪播）。
        const out = clamp01((clock - u.leave) / 1.8);
        const e = easeInOut(out);
        hero.position.copy(u.from).add(arc.set(u.dir * 900 * e, -200 * e, 0)).addScaledVector(ahead, 1400 * e);
        uni.uAlpha.value = 1 - e;
        if (out >= 1) {
          scene.remove(hero);
          hero.material.dispose();
          hero = null;
        }
      }
    }

    // 畫：場景 → 亮部 → 模糊兩層 → 合成（水墨背景、bloom、暗角、顆粒）
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);
    brightMat.uniforms.tex.value = rtScene.texture;
    pass(brightMat, rtHalf);
    blur(rtHalf, rtQ1, rtQ2);
    blur(rtQ2, rtE1, rtE2);
    finalMat.uniforms.time.value = clock;
    finalMat.uniforms.flash.value = flash;
    pass(finalMat, null);
  }

  const onResize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    rtScene.setSize(W(), Hh());
    rtHalf.setSize(W() >> 1, Hh() >> 1);
    rtQ1.setSize(W() >> 2, Hh() >> 2);
    rtQ2.setSize(W() >> 2, Hh() >> 2);
    rtE1.setSize(W() >> 3, Hh() >> 3);
    rtE2.setSize(W() >> 3, Hh() >> 3);
    finalMat.uniforms.aspect.value = innerWidth / innerHeight;
    dmat.uniforms.scale.value = innerHeight * dpr * 0.5;
  };

  // 預演：開始前先在背後把每一種換幕各算、畫一格。第一次換幕時要準備的東西（程式第一次跑那一段、
  // 顯卡第一次畫那種組合）都先做掉，不然第一次換幕會卡半秒。畫布這時還是透明的，看不到。
  warming = true;
  for (let n = 1; n <= ACTS.length; n++) {
    story = ACT * n + 1;
    step(0);
  }
  warming = false;
  story = 0;
  lastAct = -1;
  clock = 0;
  for (const it of inst) Object.assign(it, { cyc: { river: null, wave: null, rain: null } }, turnTrack());
  for (const m of hang) Object.assign(m.userData, { cyc: null }, turnTrack());

  return {
    start() {
      addEventListener("resize", onResize);
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    /** 分頁藏起來時停下（不吃 GPU），回來接著演。 */
    pause(on) {
      cancelAnimationFrame(raf);
      if (!on && !disposed) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    },
    /** 直接跳到第幾秒（測試用：看每一幕的樣子）。 */
    seek(sec) {
      story = sec;
    },
    addFresh,
    stop() {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
      for (const x of [sgeo, smat, raysTex, flareTex, rays.material, flare.material]) x.dispose();
      for (const x of [geo, printGeo, dgeo, quadGeo, cardMat, dmat, brightMat, blurMat, finalMat, atlasTex, glowTex, core.material, rtScene, rtHalf, rtQ1, rtQ2, rtE1, rtE2]) x.dispose();
      for (const m of hang) m.material.dispose();
      if (hero) hero.material.dispose();
      for (const t of printTex) t.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
