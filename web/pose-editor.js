/**
 * 姿勢編輯器（姿勢參考面板裡的「自己擺」）：直接拖骨架擺姿勢，畫出來就是標準 OpenPose 骨架圖，
 * 送印時不必再抓一次骨架（server.py 的 pose.skeleton）。
 *   - 18 個點（OpenPose COCO-18），顏色、粗細照 comfyui_controlnet_aux 畫骨架的方式。
 *   - 拖一個點：它繞著上一節轉，底下的部位整段跟著轉，骨頭長度不變（拖手肘，上臂繞肩膀轉、
 *     前臂和手跟著轉；拖脖子，整個人移動）。「長度不變」關掉或按住 Shift：整段平移，可以拉長縮短。
 *     「連動」關掉就只動那一點；拖空白處、身體旁邊：整個人移動。
 *   - 起手式一鍵套用，再微調；鏡像、轉 ±15°、放大縮小、藏起看不到的點、復原。
 *   - 最多 3 個人（畫 2girls 用）；點誰就選誰。
 *   - 畫布比例跟著現在的尺寸（規則裡的尺寸）。畫布外圍多留一圈深灰的邊：點可以拖出畫面（不會被壓扁在邊上），
 *     跑出去一點的看得到、拖得回來；送出去的骨架只取中間那塊。人整個不見了：「拉回中間」。
 *   - 從參考圖開始：伺服器抓好的骨架（/api/pose/keypoints）直接放進來，原圖淡淡墊在底下對照（「底圖」可關）。
 * 人物的「右」在畫面左邊（面向你）：OpenPose 的慣例。
 */
import { el, openSheet } from "./ui.js";
import { refuse } from "./motion.js";

export const JOINT_ZH = ["鼻子", "脖子", "右肩", "右手肘", "右手腕", "左肩", "左手肘", "左手腕", "右髖", "右膝", "右腳踝", "左髖", "左膝", "左腳踝", "右眼", "左眼", "右耳", "左耳"];
// comfyui_controlnet_aux 的 limbSeq（改成從 0 數）與顏色：線用 0.6 倍的顏色，點用原色。
const LIMBS = [[1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17]];
const COLORS = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255], [255, 0, 170], [255, 0, 85]];
// 拖一個點時跟著走的部位。
const CHILDREN = { 1: [0, 2, 5, 8, 11], 0: [14, 15], 14: [16], 15: [17], 2: [3], 3: [4], 5: [6], 6: [7], 8: [9], 9: [10], 11: [12], 12: [13] };
// 上一節（轉動的軸）：脖子沒有，拖脖子就是整個人移動。
const PARENT = Object.fromEntries(Object.entries(CHILDREN).flatMap(([p, cs]) => cs.map((c) => [c, Number(p)])));
// 鏡像時左右對調的點。
const PAIRS = [[2, 5], [3, 6], [4, 7], [8, 11], [9, 12], [10, 13], [14, 15], [16, 17]];
const MAX_PEOPLE = 3;

// 站姿（面向你）：x 以身體中線為 0、y 從頭頂往下，單位是身高。
const STAND = [
  [0, 0.07], [0, 0.16], [-0.09, 0.17], [-0.12, 0.31], [-0.13, 0.44], [0.09, 0.17], [0.12, 0.31], [0.13, 0.44],
  [-0.055, 0.47], [-0.06, 0.7], [-0.06, 0.93], [0.055, 0.47], [0.06, 0.7], [0.06, 0.93],
  [-0.02, 0.055], [0.02, 0.055], [-0.045, 0.065], [0.045, 0.065],
];
const UPPER = [0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17];
const lower = (dy) => Object.fromEntries(UPPER.map((i) => [i, [STAND[i][0], STAND[i][1] + dy]]));
export const PRESETS = [
  ["站", {}],
  ["叉腰", { 3: [-0.17, 0.3], 4: [-0.07, 0.45], 6: [0.17, 0.3], 7: [0.07, 0.45] }],
  ["舉雙手", { 3: [-0.13, 0.06], 4: [-0.11, -0.06], 6: [0.13, 0.06], 7: [0.11, -0.06] }],
  ["揮手", { 3: [-0.19, 0.13], 4: [-0.2, 0.01] }],
  ["抱胸", { 3: [-0.12, 0.3], 4: [0.06, 0.26], 6: [0.12, 0.3], 7: [-0.06, 0.26] }],
  ["手托臉", { 3: [-0.14, 0.24], 4: [-0.05, 0.1] }],
  ["雙手背後", { 3: [-0.11, 0.31], 4: [-0.04, 0.43], 6: [0.11, 0.31], 7: [0.04, 0.43] }],
  ["走", { 3: [-0.11, 0.31], 4: [-0.08, 0.43], 6: [0.13, 0.3], 7: [0.16, 0.42], 9: [-0.08, 0.69], 10: [-0.1, 0.92], 12: [0.08, 0.71], 13: [0.11, 0.9] }],
  ["跑", { 3: [-0.17, 0.27], 4: [-0.12, 0.18], 6: [0.16, 0.31], 7: [0.14, 0.42], 9: [-0.1, 0.58], 10: [-0.07, 0.76], 12: [0.08, 0.71], 13: [0.14, 0.9] }],
  ["坐", { 3: [-0.12, 0.32], 4: [-0.06, 0.5], 6: [0.12, 0.32], 7: [0.06, 0.5], 9: [-0.09, 0.58], 10: [-0.08, 0.8], 12: [0.09, 0.58], 13: [0.08, 0.8] }],
  ["跪坐", { ...lower(0.12), 3: [-0.12, 0.43], 4: [-0.06, 0.6], 6: [0.12, 0.43], 7: [0.06, 0.6], 8: [-0.055, 0.59], 11: [0.055, 0.59], 9: [-0.08, 0.72], 12: [0.08, 0.72], 10: [-0.05, 0.76], 13: [0.05, 0.76] }],
  ["蹲", { ...lower(0.1), 3: [-0.14, 0.4], 4: [-0.1, 0.52], 6: [0.14, 0.4], 7: [0.1, 0.52], 8: [-0.06, 0.57], 11: [0.06, 0.57], 9: [-0.14, 0.66], 12: [0.14, 0.66], 10: [-0.07, 0.83], 13: [0.07, 0.83] }],
  ["躺", { rotate: -90 }],
];

const clone = (v) => JSON.parse(JSON.stringify(v));

/** 起手式 → 18 個點（畫布座標），放在 (cx, cy)、身高 size。 */
function presetPoints(name, cx, cy, size) {
  const def = (PRESETS.find(([n]) => n === name) || PRESETS[0])[1];
  let pts = STAND.map((p, i) => (def[i] ? [...def[i]] : [...p]));
  if (def.rotate) {
    const a = (def.rotate * Math.PI) / 180;
    pts = pts.map(([x, y]) => [x * Math.cos(a) - (y - 0.5) * Math.sin(a), x * Math.sin(a) + (y - 0.5) * Math.cos(a) + 0.5]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const my = (Math.max(...ys) + Math.min(...ys)) / 2;
  return pts.map(([x, y]) => ({ x: cx + ((x - mx) / span) * size, y: cy + ((y - my) / span) * size, on: true }));
}

function bbox(pts) {
  const on = pts.filter((p) => p.on);
  const use = on.length ? on : pts;
  const xs = use.map((p) => p.x);
  const ys = use.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * 畫骨架（黑底）。scale：畫布像素 / 輸出像素；editor：編輯中（藏起的點畫成空心、選到的點加白圈）；
 * editor.pad：外圍多畫幾個像素的邊（深灰，出去的點畫在上面），中間黑色那塊才是送出去的圖。
 */
export function drawSkeleton(ctx, people, W, H, { scale = 1, editor = null } = {}) {
  ctx.save();
  const pad = editor?.pad || 0;
  if (pad) {
    ctx.fillStyle = "#1b1e24";
    ctx.fillRect(0, 0, (W + 2 * pad) * scale, (H + 2 * pad) * scale);
    ctx.translate(pad * scale, pad * scale);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W * scale, H * scale);
  // 底圖（只在編輯器裡）：照伺服器裁參考圖的方式（等比例放大、置中裁掉多的）淡淡墊著。
  const under = editor?.underlay;
  if (under && under.complete && under.naturalWidth) {
    const k = Math.max(W / under.naturalWidth, H / under.naturalHeight);
    const dw = under.naturalWidth * k;
    const dh = under.naturalHeight * k;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W * scale, H * scale);
    ctx.clip();
    ctx.globalAlpha = 0.38;
    ctx.drawImage(under, ((W - dw) / 2) * scale, ((H - dh) / 2) * scale, dw * scale, dh * scale);
    ctx.restore();
  }
  // controlnet_aux 在 512 的短邊上畫 4px 的線：放到這張的大小。
  const stick = Math.max(2, (4 * Math.min(W, H)) / 512) * scale;
  const dot = Math.max(2, (4 * Math.min(W, H)) / 512) * scale;
  for (const person of people) {
    const p = person.pts;
    LIMBS.forEach(([a, b], i) => {
      if (!p[a].on || !p[b].on) return;
      const x0 = p[a].x * scale;
      const y0 = p[a].y * scale;
      const x1 = p[b].x * scale;
      const y1 = p[b].y * scale;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const c = COLORS[i];
      ctx.fillStyle = `rgb(${Math.floor(c[0] * 0.6)},${Math.floor(c[1] * 0.6)},${Math.floor(c[2] * 0.6)})`;
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, len / 2, stick, Math.atan2(y1 - y0, x1 - x0), 0, Math.PI * 2);
      ctx.fill();
    });
    p.forEach((pt, i) => {
      const c = COLORS[i];
      if (!pt.on) {
        if (!editor) return;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.55)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x * scale, pt.y * scale, editor.handle, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath();
      ctx.arc(pt.x * scale, pt.y * scale, editor ? Math.max(dot, editor.handle * 0.55) : dot, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (editor && editor.sel) {
    const pt = people[editor.sel.person]?.pts[editor.sel.joint];
    if (pt) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x * scale, pt.y * scale, editor.handle + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (editor && people.length > 1) {
    // 好幾個人：選到的那個人框一個淡淡的框，知道工具列會動到誰。
    const b = bbox(people[editor.person].pts);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x0 * scale - 12, b.y0 * scale - 12, (b.x1 - b.x0) * scale + 24, (b.y1 - b.y0) * scale + 24);
    ctx.setLineDash([]);
  }
  if (pad) {
    // 送出去的範圍：框一條細線，外面那圈只是讓點有地方去。
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W * scale - 1, H * scale - 1);
  }
  ctx.restore();
}

/** 把骨架畫成一張圖（dataURL）。 */
export function renderSkeleton(people, W, H, { maxSide = 0, type = "image/png", quality } = {}) {
  const k = maxSide ? Math.min(1, maxSide / Math.max(W, H)) : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(W * k);
  c.height = Math.round(H * k);
  drawSkeleton(c.getContext("2d"), people, W, H, { scale: k });
  return c.toDataURL(type, quality);
}

/**
 * 打開編輯器。size：{ w, h } 現在的尺寸；draft：上次擺的（{ w, h, people, underlay }）；
 * initial：從參考圖抓到的骨架（[[ [x, y, on] × 18 ], …]，這張畫布的像素）；underlay：底圖網址。
 * onDone({ image, thumb, draft })：按「用這個姿勢」。
 */
export function openPoseEditor({ size, draft = null, initial = null, underlay = null, onDone }) {
  const W = size.w;
  const H = size.h;
  let people;
  const underSrc = underlay || draft?.underlay || null;
  if (Array.isArray(initial) && initial.length) {
    people = initial.slice(0, MAX_PEOPLE).map((pts) => ({ pts: pts.map(([x, y, on]) => ({ x, y, on: on !== false })) }));
  } else if (draft && Array.isArray(draft.people) && draft.people.length) {
    // 上次是別的尺寸：等比例縮放、置中，不拉變形。
    const k = Math.min(W / draft.w, H / draft.h);
    const ox = (W - draft.w * k) / 2;
    const oy = (H - draft.h * k) / 2;
    people = draft.people.map((p) => ({ pts: p.pts.map((pt) => ({ x: pt.x * k + ox, y: pt.y * k + oy, on: pt.on !== false })) }));
  } else {
    people = [{ pts: presetPoints("站", W / 2, H / 2, Math.min(H, W * 1.6) * 0.86) }];
  }
  let person = 0;
  let sel = null; // { person, joint }
  let showUnder = !!underSrc;
  const under = underSrc ? new Image() : null;
  if (under) {
    under.onload = () => draw();
    under.src = underSrc;
  }
  let linked = true;
  let rigid = true; // 骨頭長度不變：拖的點繞著上一節轉
  const history = [];
  const remember = () => {
    history.push(clone(people));
    if (history.length > 60) history.shift();
    undoBtn.disabled = false;
  };

  const canvas = el("canvas", { class: "pe-canvas", "aria-label": "姿勢：拖骨架上的點來擺" });
  // --pe-ratio：直的圖不要高過螢幕（寬度跟著高度上限縮），橫的照寬度放。
  // 外圍那圈邊（輸出像素）：短邊的一成。
  const PAD = Math.round(Math.min(W, H) * 0.1);
  const VW = W + 2 * PAD;
  const VH = H + 2 * PAD;
  const wrap = el("div", { class: "pe-stage", style: `aspect-ratio: ${VW} / ${VH}; --pe-ratio: ${(VW / VH).toFixed(4)}` }, canvas);
  const info = el("p", { class: "pe-info", "aria-live": "polite" });
  // 測試用：讀目前的點（畫布上看不出座標）。
  canvas._people = () => people;
  canvas._view = () => ({ W, H, pad: PAD });
  let scale = 1;
  let handle = 9;

  function fit() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = (r.width / VW) * dpr;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    // 點的大小以螢幕上的手指為準：觸控大一點。
    handle = (matchMedia("(pointer: coarse)").matches ? 11 : 7) * dpr;
    draw();
  }

  function draw() {
    drawSkeleton(canvas.getContext("2d"), people, W, H, { scale, editor: { sel, handle, person, pad: PAD, underlay: showUnder ? under : null } });
    const s = sel && people[sel.person] ? `${people.length > 1 ? `第 ${sel.person + 1} 個人的` : ""}${JOINT_ZH[sel.joint]}${people[sel.person].pts[sel.joint].on ? "" : "（藏起來了）"}` : "";
    info.textContent = s ? `選到：${s}` : "拖骨架上的點來擺（繞著上一節轉，長度不變；按住 Shift 可以拉長縮短）；拖空白處移動整個人。紅橘那側是人物的右手（畫面左邊）。";
    hideBtn.disabled = !sel;
    hideBtn.textContent = sel && !people[sel.person].pts[sel.joint].on ? "顯示這一點" : "藏起這一點";
    delBtn.disabled = people.length <= 1;
    addBtn.disabled = people.length >= MAX_PEOPLE;
  }

  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VW - PAD, y: ((e.clientY - r.top) / r.height) * VH - PAD };
  };

  function hit(pt) {
    const reach = ((handle + 6) / scale) * 1;
    let best = null;
    people.forEach((p, pi) =>
      p.pts.forEach((q, j) => {
        const d = Math.hypot(q.x - pt.x, q.y - pt.y);
        if (d <= reach && (!best || d < best.d)) best = { person: pi, joint: j, d };
      })
    );
    return best;
  }

  const subtree = (j) => {
    const out = [j];
    for (let i = 0; i < out.length; i++) out.push(...(CHILDREN[out[i]] || []));
    return out;
  };

  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const pt = toLocal(e);
    const h = hit(pt);
    if (h) {
      person = h.person;
      sel = { person: h.person, joint: h.joint };
      const pts = people[h.person].pts;
      const joints = linked ? subtree(h.joint) : [h.joint];
      const parent = PARENT[h.joint];
      // 轉動：記下開始時的位置，每一下都從原位算（不會越轉越歪）。手指跟點之間的距離也記著，點不會跳到指尖下。
      const turn = linked && rigid && !e.shiftKey && parent !== undefined;
      drag = {
        id: e.pointerId,
        last: pt,
        moved: false,
        joints,
        person: h.person,
        turn,
        pivot: turn ? { x: pts[parent].x, y: pts[parent].y } : null,
        grab: { x: pts[h.joint].x - pt.x, y: pts[h.joint].y - pt.y },
        from: joints.map((j) => ({ x: pts[j].x, y: pts[j].y })),
        joint: h.joint,
      };
    } else {
      // 空白處：點到哪個人的範圍裡（放寬一點）就整個人移動。
      const pi = people.findIndex((p) => {
        const b = bbox(p.pts);
        const pad = (b.y1 - b.y0) * 0.15 + 20;
        return pt.x > b.x0 - pad && pt.x < b.x1 + pad && pt.y > b.y0 - pad && pt.y < b.y1 + pad;
      });
      sel = null;
      if (pi >= 0) {
        person = pi;
        drag = { id: e.pointerId, last: pt, moved: false, joints: STAND.map((_, i) => i), person: pi };
      }
    }
    if (drag) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* 照樣拖 */
      }
    }
    draw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const pt = toLocal(e);
    const dx = pt.x - drag.last.x;
    const dy = pt.y - drag.last.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 1) return;
      remember();
      drag.moved = true;
    }
    const pts = people[drag.person].pts;
    if (drag.turn) {
      // 拖的點原本在 pivot 的哪個方向 → 現在指向手指的方向：整段轉這麼多度。
      const o = drag.from[0];
      const tx = pt.x + drag.grab.x - drag.pivot.x;
      const ty = pt.y + drag.grab.y - drag.pivot.y;
      const a = Math.atan2(ty, tx) - Math.atan2(o.y - drag.pivot.y, o.x - drag.pivot.x);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      drag.joints.forEach((j, i) => {
        const f = drag.from[i];
        const x = f.x - drag.pivot.x;
        const y = f.y - drag.pivot.y;
        // 轉出畫面就讓它出去（外圍那圈看得到、拖得回來），不壓在邊上。
        pts[j].x = drag.pivot.x + x * cos - y * sin;
        pts[j].y = drag.pivot.y + x * sin + y * cos;
      });
    } else {
      for (const j of drag.joints) {
        const q = pts[j];
        q.x += dx;
        q.y += dy;
      }
    }
    drag.last = pt;
    draw();
  });
  const end = (e) => {
    if (drag && e.pointerId === drag.id) drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // ---- 工具列 ----
  const transform = (fn) => {
    remember();
    const pts = people[person].pts;
    const b = bbox(pts);
    for (const q of pts) {
      const [x, y] = fn(q.x - b.cx, q.y - b.cy);
      q.x = b.cx + x;
      q.y = b.cy + y;
    }
    draw();
  };
  const rotate = (deg) => {
    const a = (deg * Math.PI) / 180;
    transform((x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  };
  const tool = (label, title, fn) => el("button", { class: "btn btn-small pressable", type: "button", title, onclick: fn }, label);

  const presets = el(
    "div",
    { class: "pe-presets", role: "group", "aria-label": "起手式" },
    PRESETS.map(([name]) =>
      el(
        "button",
        {
          class: "group-chip pressable",
          type: "button",
          onclick: () => {
            remember();
            const b = bbox(people[person].pts);
            const solo = people.length === 1;
            const sizeNow = Math.max(b.x1 - b.x0, b.y1 - b.y0);
            // 只有一個人：放回正中間、照畫布大小；好幾個人：留在原地、原本的大小。
            people[person] = { pts: presetPoints(name, solo ? W / 2 : b.cx, solo ? H / 2 : b.cy, solo ? Math.min(H, W * 1.6) * 0.86 : sizeNow) };
            sel = null;
            draw();
          },
        },
        name
      )
    )
  );
  const undoBtn = tool("復原", "回到上一步（Ctrl Z）", () => {
    if (!history.length) return;
    people = history.pop();
    person = Math.min(person, people.length - 1);
    sel = null;
    undoBtn.disabled = !history.length;
    draw();
  });
  undoBtn.disabled = true;
  const hideBtn = tool("藏起這一點", "側身、背面看不到的點（耳朵、眼睛、被擋住的手）藏起來，畫出來就沒有它", () => {
    if (!sel) return refuse(hideBtn);
    remember();
    const q = people[sel.person].pts[sel.joint];
    q.on = !q.on;
    draw();
  });
  const addBtn = tool("＋加一個人", `最多 ${MAX_PEOPLE} 個人`, () => {
    if (people.length >= MAX_PEOPLE) return refuse(addBtn);
    remember();
    const size = Math.min(H, W * 1.6) * 0.7;
    const slot = people.length;
    const cx = W * (slot === 1 ? 0.72 : 0.28);
    people.push({ pts: presetPoints("站", cx, H / 2, size) });
    if (slot === 1) {
      // 第二個人：原本那個往左挪、縮成一樣大，兩個人並排。
      const b = bbox(people[0].pts);
      const k = size / Math.max(1, Math.max(b.x1 - b.x0, b.y1 - b.y0));
      people[0].pts = people[0].pts.map((q) => ({ ...q, x: W * 0.28 + (q.x - b.cx) * k, y: H / 2 + (q.y - b.cy) * k }));
    }
    person = slot;
    sel = null;
    draw();
  });
  const delBtn = tool("刪掉這個人", "刪掉選到的人", () => {
    if (people.length <= 1) return refuse(delBtn);
    remember();
    people.splice(person, 1);
    person = 0;
    sel = null;
    draw();
  });
  const rigidBtn = el("button", { class: "chip-toggle pressable", type: "button", "aria-pressed": "true", title: "開：拖的點繞著上一節轉，手腳不會被拉長縮短。關（或拖的時候按住 Shift）：整段平移，可以拉長縮短" }, "長度不變");
  rigidBtn.addEventListener("click", () => {
    rigid = !rigid;
    rigidBtn.setAttribute("aria-pressed", rigid ? "true" : "false");
  });
  const linkBtn = el("button", { class: "chip-toggle pressable", type: "button", "aria-pressed": "true", title: "開：拖手肘時前臂和手跟著動。關：只動那一點" }, "連動");
  linkBtn.addEventListener("click", () => {
    linked = !linked;
    linkBtn.setAttribute("aria-pressed", linked ? "true" : "false");
  });
  const underBtn = under ? el("button", { class: "chip-toggle pressable", type: "button", "aria-pressed": "true", title: "參考圖淡淡墊在底下對照（送出去的骨架不會有它）" }, "底圖") : null;
  underBtn?.addEventListener("click", () => {
    showUnder = !showUnder;
    underBtn.setAttribute("aria-pressed", showUnder ? "true" : "false");
    draw();
  });
  const tools = el(
    "div",
    { class: "pe-tools" },
    tool("鏡像", "左右翻過來", () => {
      remember();
      const pts = people[person].pts;
      const b = bbox(pts);
      const flipped = pts.map((q) => ({ ...q, x: 2 * b.cx - q.x }));
      for (const [a, c] of PAIRS) [flipped[a], flipped[c]] = [flipped[c], flipped[a]];
      people[person].pts = flipped;
      sel = null;
      draw();
    }),
    tool("↺ 15°", "往左轉", () => rotate(-15)),
    tool("↻ 15°", "往右轉", () => rotate(15)),
    tool("縮小", "整個人縮小", () => transform((x, y) => [x * 0.9, y * 0.9])),
    tool("放大", "整個人放大", () => transform((x, y) => [x * 1.1, y * 1.1])),
    tool("拉回中間", "選到的人放回畫面中間（太大就縮到放得下）", () => {
      remember();
      const pts = people[person].pts;
      const b = bbox(pts);
      const k = Math.min(1, (W * 0.9) / Math.max(1, b.x1 - b.x0), (H * 0.9) / Math.max(1, b.y1 - b.y0));
      for (const q of pts) {
        q.x = W / 2 + (q.x - b.cx) * k;
        q.y = H / 2 + (q.y - b.cy) * k;
      }
      sel = null;
      draw();
    }),
    hideBtn,
    rigidBtn,
    linkBtn,
    underBtn,
    addBtn,
    delBtn,
    undoBtn
  );

  const body = el(
    "div",
    { class: "pe" },
    el("div", { class: "pe-side" }, el("h3", {}, "起手式"), presets, el("h3", {}, "調整"), tools, info),
    wrap
  );
  let sheet = null;
  const done = el(
    "button",
    {
      class: "btn btn-small btn-primary pressable",
      type: "button",
      onclick: () => {
        const draftOut = { w: W, h: H, people: clone(people), underlay: underSrc };
        sheet.close();
        onDone?.({ image: renderSkeleton(people, W, H), thumb: renderSkeleton(people, W, H, { maxSide: 160, type: "image/jpeg", quality: 0.85 }), draft: draftOut });
      },
    },
    "用這個姿勢"
  );
  sheet = openSheet(`自己擺姿勢・${W}×${H}`, body, { wide: true, foot: [done] });
  const onKey = (e) => {
    if (!body.isConnected) return removeEventListener("keydown", onKey);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undoBtn.click();
    } else if ((e.key === "Delete" || e.key === "h") && sel) {
      e.preventDefault();
      hideBtn.click();
    }
  };
  addEventListener("keydown", onKey);
  const ro = new ResizeObserver(() => {
    if (!body.isConnected) return ro.disconnect();
    fit();
  });
  ro.observe(wrap);
  fit();
  return sheet;
}
