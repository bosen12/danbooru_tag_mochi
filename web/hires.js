/**
 * Hires：把印好的一張放大、重畫細節，做好的大圖直接換掉原本那張（墨池成品牆、疊印台晾紙繩共用）。
 *
 *   快速 —— 圖在 latent 裡放大，再用 0.5 的重繪強度畫一次細節。快，構圖不動。
 *   深度 —— 先用放大模型（RealESRGAN anime）補細節，再用 0.4 輕輕重畫。慢一些，線條最乾淨。
 *
 * 後端走同一條 /api/gen（payload 多一個 hires），所以斷線重接、停、心跳都跟付印一樣。
 * 原圖留在 target.baseImage：再做一次 Hires 永遠從原圖放大（不會越放越大、越放越糊），也可以還原。
 *
 * target 是墨池的 shot 或疊印台的 print，要有 image、positive、loras、ckpt、rating、width、height。
 * 進行中的狀態掛在 target.hi（不存檔）；做好的結果是 target.hires（存檔）。
 *
 * 修臉（FaceDetailer）走同一條佇列，mode 是 "face"：在「現在這張」上找到臉、只重畫臉，尺寸不變，
 * 所以 Hires 過的就修大圖。修過幾層記在 target.face = { from, history }：history 是每一層修之前的那張
 * （第一格是完全沒修過的），from 是最上面那層修之前的。「從原圖重修」從 history[0] 重來（換一個版本，
 * 不會越修越歪）；「在這張上再修」在現在這張上再疊一層；「拿掉修臉」一次退一層。
 * 之後再做 Hires 是從原圖放大，修臉就整個拿掉。舊存檔只有 { from }：當成修過一層。
 */
import { el } from "./ui.js";
import { t as translate } from "./i18n.js";
import { createGenerator } from "./gen.js";
import { currentHiresSampling } from "./workflow.js";
import { seat, refuse, reducedMotion, DUR, CURVE, css } from "./motion.js";
import { insertTriggerAfterCast } from "./engine.js";

/*
 * 「用目前模型」（2026-11-20 專案主要的）：Hires 改用頂欄現在選的底模和 LoRA 重畫，
 * 例如先用快的模型抽、滿意了再用好的模型 Hires。原圖 LoRA 的觸發詞拿掉、換上新 LoRA 的觸發詞。
 * 關著跟以前一樣：照原圖的底模和 LoRA。
 */
const fileStem = (f) => String(f || "").split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|pt|gguf)$/i, "");
const splitTags = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const normTag = (s) => s.trim().toLowerCase().replace(/_/g, " ");

/**
 * 換 LoRA 的觸發詞：原圖 LoRA 的觸發詞拿掉（新的那組也有的、或本來就是這張用的牌的留著），
 * 新的觸發詞照墨池平常的位置（人數那幾個字後面）插進去。
 */
export function swapLoraTriggers(positive, oldLoras, newTrigger, keepTags = []) {
  const fresh = splitTags(newTrigger);
  // keepTags：這張用的牌（字串或 { tag }）。
  const keep = new Set([...fresh, ...keepTags.map((x) => (typeof x === "string" ? x : x?.tag || ""))].filter(Boolean).map(normTag));
  const drop = new Set(
    (oldLoras || [])
      .flatMap((l) => (l && Number(l.strength) > 0 ? splitTags(l.trigger) : []))
      .map(normTag)
      .filter((x) => !keep.has(x))
  );
  const rest = splitTags(positive).filter((x) => !drop.has(normTag(x)));
  const have = new Set(rest.map(normTag));
  return insertTriggerAfterCast(rest.join(", "), fresh.filter((x) => !have.has(normTag(x))).join(", "));
}

/** 一行字說這組模型：底模名稱 · LoRA 幾個（沒記到底模的寫「預設底模」）。 */
export function modelLine(m) {
  const loras = (m?.loras || []).filter((l) => l && (l.file || l.name) && Number(l.strength ?? 1) > 0);
  return `${fileStem(m?.ckpt) || "預設底模"} · ${loras.length ? `LoRA ${loras.length} 個` : "沒有 LoRA"}`;
}

const sameModel = (a, b) =>
  String(a?.ckpt || "") === String(b?.ckpt || "") &&
  JSON.stringify((a?.loras || []).map((l) => [l.file, Number(l.strength)])) === JSON.stringify((b?.loras || []).map((l) => [l.file, Number(l.strength)]));

export const HIRES_MODES = {
  quick: { zh: "快速", def: 1.5, note: "在原圖上放大，再重畫一次細節。快，構圖不動。" },
  deep: { zh: "深度", def: 2, note: "先用放大模型補細節，再輕輕重畫。慢一些，線條最乾淨。" },
};
const MIN = 1.25;
const MAX = 3;
const STEP = 0.25;
// 跟伺服器同一套上限：每邊 4096、總像素 4096² 的一半。超過的倍率在選單裡就按不下去。
const SIDE_MAX = 4096;
const PIXELS_MAX = (4096 * 4096) / 2;
const PREF_KEY = "web6.hires";

const round8 = (n) => Math.round(n / 8) * 8;
export const hiresSize = (w, h, scale) => [round8(w * scale), round8(h * scale)];
const fits = (w, h, s) => {
  const [W, H] = hiresSize(w, h, s);
  return W <= SIDE_MAX && H <= SIDE_MAX && W * H <= PIXELS_MAX;
};
/** 這張最多能放大幾倍（照 STEP 一格一格往上試）。 */
export function maxScale(w, h) {
  let best = 0;
  for (let s = MIN; s <= MAX + 1e-9; s += STEP) if (fits(w, h, s)) best = s;
  return best;
}
const fmt = (s) => (Number.isInteger(s) ? String(s) : s.toFixed(2).replace(/0$/, "")) + "×";

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    return {
      mode: p.mode === "deep" ? "deep" : "quick",
      quick: Number(p.quick) >= MIN && Number(p.quick) <= MAX ? Number(p.quick) : HIRES_MODES.quick.def,
      deep: Number(p.deep) >= MIN && Number(p.deep) <= MAX ? Number(p.deep) : HIRES_MODES.deep.def,
      useCurrent: p.useCurrent === true,
    };
  } catch {
    return { mode: "quick", quick: HIRES_MODES.quick.def, deep: HIRES_MODES.deep.def };
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* 無痕模式：這次記不住就算了 */
  }
}

/** 原圖的尺寸（Hires 過的，width/height 仍是原圖的：同種子重印、回到這一版都要用原本的尺寸）。 */
const baseSize = (t) => [t.width || 1024, t.height || 1024];

/** 狀態一句話：「Hires 快速 1.5×・繪製 8/20」。 */
export function hiresLabel(t) {
  const hi = t.hi;
  if (!hi) return "";
  const head = hi.mode === "face" ? "修臉" : `Hires ${HIRES_MODES[hi.mode].zh} ${fmt(hi.scale)}`;
  return hi.status === "queued" ? `${head}・排隊中` : hi.status === "running" ? `${head}・${hi.note || "重畫中"}` : hi.status === "failed" ? `${head}沒做成：${hi.note}` : head;
}

export const hiresBusy = (t) => !!t.hi && (t.hi.status === "queued" || t.hi.status === "running");

/** 每一層修之前的那張（第一格是沒修過的原圖）；沒修過是空的。 */
export const faceHistory = (f) => (!f ? [] : Array.isArray(f.history) && f.history.length ? [...f.history] : f.from ? [f.from] : []);

/** 修過幾層臉。 */
export const faceDepth = (t) => faceHistory(t && t.face).length;

/** 現在在修臉（或排隊等修）：按鈕上的進度、要不要讓「停」出現。 */
export const faceBusy = (t) => hiresBusy(t) && t.hi.mode === "face";

/* ---------- 修臉做不做得了（ComfyUI 有沒有 FaceDetailer 和臉部偵測模型）---------- */

let faceCheck = null;
let faceCheckedAt = 0;
/** 問伺服器一次，20 秒內重複問用同一個答案；沒裝好的每次打開選單都重問（剛裝完、剛重開 ComfyUI）。 */
export function faceStatus({ fresh = false } = {}) {
  const now = Date.now();
  if (faceCheck && !fresh && now - faceCheckedAt < 20000) return faceCheck;
  faceCheckedAt = now;
  faceCheck = fetch("/api/face/status", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => ({ ready: !!j.ready, why: String(j.why || "") }))
    .catch(() => ({ ready: false, why: "連不到伺服器" }));
  return faceCheck;
}

/**
 * 跑 Hires 的佇列（自己一條，跟付印分開：按「停」停付印，不會連 Hires 一起砍）。
 * hooks.update(target)：target.hi 或 target.image 變了。
 * hooks.done(target)：新圖換上去了（呼叫端存檔、播顯影）。
 */
export function createHires(hooks) {
  const tasks = new Map(); // task.id → task
  const gen = createGenerator({
    origin: hooks.origin,
    payload: (task) => {
      const t = task.target;
      return {
        width: t.width,
        height: t.height,
        // 「用目前模型」：這一次的底模、LoRA 記在 task.model（不改成品本身的紀錄）。
        loras: task.model ? task.model.loras : t.loras,
        ckpt: task.model ? task.model.ckpt : t.ckpt,
        rating: t.rating,
        // 工作流面板裡這一種 Hires 改過的 steps／CFG／denoise。修臉從 task.from（修之前那張）開始。
        hires: task.mode === "face"
          ? { mode: "face", image: task.from, ...(task.sampling || {}) }
          : { mode: task.mode, scale: task.scale, image: t.baseImage || t.image, ...(task.sampling || {}) },
      };
    },
    update: (task) => {
      const t = task.target;
      if (t.hi?.task !== task.id) return; // 已經被取消或換成新的一次
      // 拿到伺服器的工作編號就先存一次：做到一半重新整理頁面，用它接回去（跟付印一樣）。
      if (task.job && t.hi.job !== task.job) {
        t.hi = { ...t.hi, job: task.job };
        hooks.save && hooks.save(t);
      }
      // ComfyUI 的編號晚一點才到：也存起來，伺服器重開過還能拿它去問這張做完了沒（gen.js 的 recover）。
      if (task.promptId && t.hi.promptId !== task.promptId) {
        t.hi = { ...t.hi, promptId: task.promptId };
        hooks.save && hooks.save(t);
      }
      if (task.status === "done" && task.mode === "face") {
        tasks.delete(task.id);
        // 原圖只記第一次：Hires 過的，baseImage 早就是原圖了。
        if (!t.baseImage) t.baseImage = task.from;
        t._hiresUnder = t.hi?.preview || null;
        t.image = task.image;
        // 疊上去的：前面幾層留著；從原圖重修的：從頭算一層。
        const history = [...(task.stack ? faceHistory(t.face) : []), task.from];
        t.face = { from: task.from, seed: task.seed, history };
        t.hi = null;
        hooks.update(t);
        hooks.done && hooks.done(t, "face");
        return;
      }
      if (task.status === "done") {
        tasks.delete(task.id);
        if (!t.baseImage) t.baseImage = t.image;
        const [W, H] = hiresSize(...baseSize(t), task.scale);
        const r = task.result || {};
        // 最後一幀預覽墊在底下，新圖從它上面由上往下顯影（不會先跳回舊圖再顯影）。
        t._hiresUnder = t.hi?.preview || null;
        t.image = task.image;
        t.hires = { mode: task.mode, scale: task.scale, width: r.width || W, height: r.height || H, seed: task.seed, sampling: task.sampling || {}, ...(task.model ? { model: { ckpt: task.model.ckpt, loras: task.model.loras } } : {}) };
        // 新的大圖是從原圖放大的，之前修的臉不在上面了。
        t.face = null;
        t.hi = null;
        hooks.update(t);
        hooks.done && hooks.done(t);
        return;
      }
      if (task.status === "failed" || task.status === "cancelled") {
        tasks.delete(task.id);
        t.hi = task.status === "failed" ? { ...t.hi, status: "failed", note: task.note || "Comfy 報錯" } : null;
        hooks.update(t);
        return;
      }
      t.hi = {
        ...t.hi,
        status: task.status === "running" && task.note !== "排隊中" ? "running" : "queued",
        progress: task.progress || 0,
        note: task.note,
        // Comfy 一路送來的預覽幀（跟付印一樣看得到它一步步重畫）。
        preview: task.preview || t.hi?.preview || null,
      };
      hooks.update(t);
    },
    stopped: () => {},
  });

  // 排進印表機，順手記下這次的編號和種子：前面還有一張在做、還沒輪到就重新整理，也存得到、接得回來
  // （store.js 的 hiresJobOf）。以前要等送出去拿到工作編號才存，排著的那張重新整理就不見了。
  const queueTask = (t, task, reserved = null) => {
    gen.enqueue(task, { reserved });
    if (t.hi?.task !== task.id) return;
    t.hi = { ...t.hi, reserved: task._reserved, seed: task.seed };
    hooks.save && hooks.save(t);
  };

  return {
    /** model：{ ckpt, loras, trigger }（「用目前模型」）；沒給就照原圖的。 */
    start(t, mode, scale, model = null) {
      if (hiresBusy(t) || !(t.baseImage || t.image)) return false;
      const use = model
        ? {
            ckpt: model.ckpt || null,
            loras: model.loras || [],
            positive: swapLoraTriggers(t.positive, t.loras, model.trigger, [...(t.mine || []), ...(t.drawn || [])]),
          }
        : null;
      const task = {
        id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        target: t,
        mode,
        scale,
        sampling: currentHiresSampling(mode),
        positive: use ? use.positive : t.positive,
        model: use,
        seed: Math.floor(Math.random() * 2 ** 32),
      };
      tasks.set(task.id, task);
      t.hi = { task: task.id, mode, scale, sampling: task.sampling, status: "queued", progress: 0, note: "", ...(use ? { model: use } : {}) };
      hooks.update(t);
      queueTask(t, task);
      return true;
    },
    /** 修臉，尺寸不變。stack：在現在這張（修過的）上再疊一層；不然從沒修過的原圖重修。 */
    startFace(t, { stack = false } = {}) {
      const from = stack ? t.image : faceHistory(t.face)[0] || t.image;
      if (hiresBusy(t) || !from) return false;
      const task = {
        id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        target: t,
        mode: "face",
        scale: 1,
        from,
        stack: !!(stack && t.face),
        sampling: currentHiresSampling("face"),
        positive: t.positive,
        seed: Math.floor(Math.random() * 2 ** 32),
      };
      tasks.set(task.id, task);
      t.hi = { task: task.id, mode: "face", scale: 1, from, stack: task.stack, sampling: task.sampling, status: "queued", progress: 0, note: "" };
      hooks.update(t);
      queueTask(t, task);
      return true;
    },
    /** 拿掉一層修臉：換回這一層修之前那張；拿到沒有了就回到沒修過的（Hires 過的就是 Hires 的大圖）。 */
    undoFace(t) {
      const history = faceHistory(t.face);
      if (!history.length) return false;
      t.image = history.pop();
      t.face = history.length ? { ...t.face, from: history[history.length - 1], history } : null;
      if (!t.face && !t.hires && t.image === t.baseImage) t.baseImage = null;
      hooks.update(t);
      return true;
    },
    /** 重新整理之前做到一半的那張（存檔裡有 hiresJob）：用工作編號接回去，從頭重播進度。 */
    resume(t, saved) {
      const face = saved?.mode === "face";
      if (!saved || !(saved.job || saved.reserved) || !(HIRES_MODES[saved.mode] || (face && saved.from)) || hiresBusy(t)) return false;
      // 還排著、沒送出去的（前面有一張在做）：用同一個編號重新排進來。
      if (!saved.job) {
        const task = {
          id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          target: t,
          mode: saved.mode,
          scale: face ? 1 : saved.scale,
          from: face ? saved.from : undefined,
          stack: face && !!saved.stack,
          sampling: saved.sampling || {},
          positive: saved.model?.positive || t.positive,
          model: saved.model || null,
          seed: Number.isFinite(saved.seed) ? saved.seed : Math.floor(Math.random() * 2 ** 32),
        };
        tasks.set(task.id, task);
        t.hi = { task: task.id, mode: saved.mode, scale: task.scale, from: task.from, stack: task.stack, sampling: task.sampling, status: "queued", progress: 0, note: "", ...(saved.model ? { model: saved.model } : {}) };
        hooks.update(t);
        queueTask(t, task, saved.reserved);
        return true;
      }
      const task = {
        id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        target: t,
        mode: saved.mode,
        scale: face ? 1 : saved.scale,
        from: face ? saved.from : undefined,
        stack: face && !!saved.stack,
        sampling: saved.sampling || {},
        positive: saved.model?.positive || t.positive,
        model: saved.model || null,
        seed: 0,
        job: saved.job,
        promptId: saved.promptId || null,
      };
      tasks.set(task.id, task);
      t.hi = { task: task.id, mode: saved.mode, scale: task.scale, from: task.from, stack: task.stack, sampling: task.sampling, status: "queued", progress: 0, note: "接回剛才那張…", job: saved.job, ...(saved.model ? { model: saved.model } : {}) };
      hooks.update(t);
      gen.resume(task);
      return true;
    },
    /** 停這一張的 Hires。 */
    cancel(t) {
      if (!t.hi) return;
      const { task: id, job, promptId } = t.hi;
      t.hi = null;
      hooks.update(t);
      const task = tasks.get(id);
      // 別的分頁開的 Hires（跨分頁同步過來，這頁手上沒有那個工作）：照伺服器的工作編號停掉。
      // 以前只清掉這邊的狀態，GPU 照畫，開它的那頁又收不到結果（第五輪 Astra 找到）。
      if (!task) return void gen.cancelRemote(job, promptId);
      tasks.delete(id);
      gen.cancelOne(task);
    },
    /** 換回原圖（Hires 和修臉一起拿掉）。 */
    restore(t) {
      if (!t.baseImage) return false;
      t.image = t.baseImage;
      t.baseImage = null;
      t.hires = null;
      t.face = null;
      hooks.update(t);
      return true;
    },
    /** 失敗的那一行按掉。 */
    dismiss(t) {
      if (t.hi && t.hi.status === "failed") {
        t.hi = null;
        hooks.update(t);
      }
    },
    get busy() {
      return gen.busy;
    },
  };
}

/* ================= 選單 ================= */

let openPicker = null;

export function closeHiresPicker({ focus = false } = {}) {
  const p = openPicker;
  if (!p) return;
  openPicker = null;
  p.cleanup();
  const node = p.node;
  if (focus) p.anchor.focus({ preventScroll: true });
  p.anchor.setAttribute("aria-expanded", "false");
  if (reducedMotion()) return node.remove();
  node.animate(
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: `translateY(${p.below ? -4 : 4}px)` },
    ],
    { duration: DUR.micro, easing: css(CURVE.exit), fill: "forwards" }
  ).onfinish = () => node.remove();
}

/**
 * 從 anchor 那顆鈕彈出 Hires 選單。
 * opts.onStart(mode, scale, model)；opts.onRestore()（有 Hires 過才出現「還原原圖」）。
 * opts.current()：頂欄現在的 { ckpt, loras, trigger }；有給才出現「用目前模型」（疊印台沒給，照舊）。
 */
export function openHiresPicker(anchor, t, { onStart, onRestore, current }) {
  if (openPicker && openPicker.anchor === anchor) return closeHiresPicker({ focus: true });
  closeHiresPicker();
  const prefs = loadPrefs();
  const [w, h] = baseSize(t);
  const top = maxScale(w, h);
  let mode = prefs.mode;
  const scaleOf = (m) => Math.min(prefs[m], top);
  let scale = scaleOf(mode);

  const out = el("output", {}, fmt(scale));
  const size = el("span", { class: "hp-size" });
  const note = el("p", { class: "hp-note" });
  const minus = el("button", { class: "pressable", type: "button", "aria-label": "倍率少一格" }, "−");
  const plus = el("button", { class: "pressable", type: "button", "aria-label": "倍率多一格" }, "＋");
  const go = el("button", { class: "btn btn-small btn-primary hp-go", type: "button" }, "開始 Hires");
  const sync = () => {
    out.textContent = fmt(scale);
    const [W, H] = hiresSize(w, h, scale);
    size.textContent = `${w}×${h} → ${W}×${H}`;
    note.textContent = HIRES_MODES[mode].note;
    minus.disabled = scale <= MIN + 1e-9;
    plus.disabled = scale + STEP > top + 1e-9;
    plus.title = plus.disabled && scale < MAX ? `這張最多放大到 ${fmt(top)}` : "";
  };
  const bump = (d) => {
    const next = Math.round((scale + d * STEP) / STEP) * STEP;
    if (next < MIN - 1e-9 || next > top + 1e-9) return refuse(d > 0 ? plus : minus);
    scale = next;
    prefs[mode] = scale;
    savePrefs(prefs);
    sync();
  };
  minus.onclick = () => bump(-1);
  plus.onclick = () => bump(1);

  const modes = el(
    "div",
    { class: "segmented hp-modes", role: "radiogroup", "aria-label": "Hires 方式" },
    Object.entries(HIRES_MODES).map(([m, info]) =>
      el(
        "button",
        {
          class: "pressable",
          type: "button",
          role: "radio",
          dataset: { v: m },
          "aria-checked": m === mode ? "true" : "false",
          onclick: (e) => {
            if (mode === m) return;
            mode = m;
            prefs.mode = m;
            savePrefs(prefs);
            // 每種各記各的倍率：快速停在 1.5、深度停在 2，切過去就是那一種上次用的。
            scale = scaleOf(m);
            for (const b of modes.children) b.setAttribute("aria-checked", b === e.currentTarget ? "true" : "false");
            seat(e.currentTarget);
            sync();
          },
        },
        info.zh
      )
    )
  );

  // 「用目前模型」：開關＋一行寫會用哪組（關著寫原圖那組），跟原圖一樣時直接說。
  const cur = current ? current() : null;
  let useCurrent = !!(cur && prefs.useCurrent);
  let modelBox = null;
  if (cur) {
    const input = el("input", { type: "checkbox", role: "switch" });
    input.checked = useCurrent;
    const line = el("span", { class: "hp-model-line" });
    const why = el("span", { class: "hp-model-why" });
    const paint = () => {
      line.textContent = modelLine(useCurrent ? cur : t);
      line.title = useCurrent ? String(cur.ckpt || "") : String(t.ckpt || "");
      why.textContent = !useCurrent ? "照原圖的底模和 LoRA" : sameModel(cur, t) ? "跟原圖一樣" : "換掉原圖 LoRA 的觸發詞";
      modelBox.dataset.on = useCurrent ? "true" : "false";
    };
    input.onchange = () => {
      useCurrent = input.checked;
      prefs.useCurrent = useCurrent;
      savePrefs(prefs);
      paint();
      if (!reducedMotion()) line.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
    };
    modelBox = el("div", { class: "hp-model" }, el("label", { class: "switch" }, input, "用目前模型"), el("p", { class: "hp-model-note" }, line, why));
    paint();
  }

  const done = t.hires;
  const node = el(
    "div",
    { class: "hires-pop", role: "dialog", "aria-label": "Hires：放大並重畫細節" },
    el("div", { class: "hp-head" }, el("b", {}, "Hires"), size),
    modes,
    el("div", { class: "hp-row" }, el("span", { class: "stepper hp-scale" }, el("span", { class: "stepper-label" }, "倍率"), minus, out, plus)),
    note,
    modelBox,
    top < MIN ? el("p", { class: "hp-note", dataset: { kind: "err" } }, "這張已經太大，不能再放大。") : null,
    done
      ? el(
          "p",
          { class: "hp-was" },
          `現在是 ${HIRES_MODES[done.mode]?.zh || ""} ${fmt(done.scale)}（${done.width}×${done.height}）`,
          el(
            "button",
            {
              class: "hp-restore",
              type: "button",
              onclick: () => {
                closeHiresPicker({ focus: true });
                onRestore && onRestore();
              },
            },
            "還原原圖"
          )
        )
      : null,
    el("div", { class: "hp-acts" }, go)
  );
  go.disabled = top < MIN;
  go.onclick = () => {
    closeHiresPicker({ focus: true });
    onStart(mode, scale, useCurrent && cur ? cur : null);
  };
  sync();
  mountPop(anchor, node, {
    focus: () => modes.querySelector('[aria-checked="true"]'),
    onKey: (e) => {
      if (e.key === "Enter" && e.target === node.querySelector('[aria-checked="true"]')) {
        e.preventDefault();
        go.click();
        return true;
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.target.closest(".hp-modes")) {
        e.preventDefault();
        const other = modes.querySelector('[aria-checked="false"]');
        other.click();
        other.focus();
        return true;
      }
      return false;
    },
  });
}

/**
 * 從 anchor 那顆鈕彈出修臉的小選單：一句說明、現在的狀態、開始（或再修一次／拿掉修臉）。
 * ComfyUI 還沒裝 FaceDetailer 的，按鈕停用、寫清楚缺什麼、去哪裡裝。
 */
export function openFacePicker(anchor, t, { onStart, onUndo }) {
  if (openPicker && openPicker.anchor === anchor) return closeHiresPicker({ focus: true });
  closeHiresPicker();
  const depth = faceDepth(t);
  // 沒修過：一顆「開始修臉」。修過了：「從原圖重修」（換一個版本）、「在這張上再修」（再加強一點）。
  const go = el("button", { class: "btn btn-small btn-primary hp-go", type: "button", disabled: true }, depth ? "從原圖重修" : "開始修臉");
  const more = depth ? el("button", { class: "btn btn-small hp-go hp-stack", type: "button", disabled: true }, "在這張上再修") : null;
  const state = el("p", { class: "hp-note", role: "status" }, "正在問 ComfyUI 有沒有 FaceDetailer…");
  const undo = depth
    ? el("button", { class: "hp-restore", type: "button", onclick: () => { closeHiresPicker({ focus: true }); onUndo && onUndo(); } }, depth > 1 ? "退回上一層" : "拿掉修臉")
    : null;
  const node = el(
    "div",
    { class: "hires-pop face-pop", role: "dialog", "aria-label": "修臉：只重畫臉" },
    el("div", { class: "hp-head" }, el("b", {}, "修臉"), el("span", { class: "hp-size" }, `${t.hires?.width || t.width}×${t.hires?.height || t.height}`)),
    el("p", { class: "hp-note" }, "找到臉，只把臉放大重畫再貼回去，其他地方不動。全身、多人、臉小的圖最有感。"),
    t.hires ? el("p", { class: "hp-note" }, "會在 Hires 之後的大圖上修。") : null,
    state,
    depth ? el("p", { class: "hp-was" }, `這張修過 ${depth} 層臉。`, undo) : null,
    depth ? el("p", { class: "hp-note" }, depth > 1 ? "疊越多層，臉越容易糊、越不像原本的人。" : "從原圖重修：換一個版本；在這張上再修：這次的方向對、只是不夠。") : null,
    el("div", { class: "hp-acts" }, more, go)
  );
  go.onclick = () => {
    closeHiresPicker({ focus: true });
    onStart({ stack: false });
  };
  if (more)
    more.onclick = () => {
      closeHiresPicker({ focus: true });
      onStart({ stack: true });
    };
  mountPop(anchor, node, { focus: () => go });
  faceStatus({ fresh: true }).then((st) => {
    if (!node.isConnected) return;
    // 說明換了行數、選單變高：重新擺，擺在上方的才不會往下長、蓋住按鈕。
    const settle = () => openPicker?.node === node && openPicker.place();
    go.disabled = !st.ready;
    if (more) more.disabled = !st.ready;
    if (st.ready) {
      state.remove();
      if (document.activeElement === document.body || !node.contains(document.activeElement)) go.focus({ preventScroll: true });
    } else {
      state.dataset.kind = "err";
      state.textContent = st.why || "ComfyUI 現在做不了修臉";
    }
    // 英文版換字是 MutationObserver（microtask）：排在它後面量。
    queueMicrotask(settle);
  });
}

/** 把選單掛在 anchor 旁邊：放得下就在下方，否則上方；Esc、點外面、頁面捲動就收。onKey 回 true 表示處理掉了。 */
function mountPop(anchor, node, { focus, onKey: extraKey } = {}) {
  document.body.append(node);

  // 擺在按鈕下方，放不下就放上方；左右不超出畫面。
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const pw = node.offsetWidth;
    const ph = node.offsetHeight;
    const below = r.bottom + 8 + ph <= innerHeight - 8 || r.top - 8 - ph < 8;
    node.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + "px";
    node.style.top = (below ? Math.min(r.bottom + 8, innerHeight - ph - 8) : r.top - 8 - ph) + "px";
    node.style.transformOrigin = `${Math.max(12, Math.min(pw - 12, r.left + r.width / 2 - parseFloat(node.style.left)))}px ${below ? "0" : "100%"}`;
    return below;
  };
  const below = place();
  anchor.setAttribute("aria-expanded", "true");
  if (!reducedMotion()) {
    node.animate(
      [
        { opacity: 0, transform: `translateY(${below ? -6 : 6}px) scale(0.97)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: DUR.short, easing: css(CURVE.out) }
    );
  }
  focus?.()?.focus({ preventScroll: true });

  const y0 = scrollY;
  const onDown = (e) => {
    if (!node.contains(e.target) && !anchor.contains(e.target)) closeHiresPicker();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeHiresPicker({ focus: true });
    } else if (extraKey) extraKey(e);
  };
  // 頁面捲了一段（手機上手指一滑）：選單不跟著跑，直接收掉。
  const onScroll = () => Math.abs(scrollY - y0) > 8 && closeHiresPicker();
  const onResize = () => place();
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey, true);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onResize);
  openPicker = {
    anchor,
    node,
    below,
    place,
    cleanup() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
    },
  };
}

/* ================= 圖上的進度 ================= */

/**
 * 在畫框（frame）上畫 Hires 進行中的樣子：一條套準線照進度由上往下掃，線下的圖稍微壓暗
 * （「這一段還沒重畫」），左下角一行狀態和一顆停。沒在做就拿掉。
 */
export function paintHiresVeil(frame, t, { onCancel, onDismiss }) {
  // 只找還沒在收的那層：剛停又馬上開（收的動畫還沒播完），以前找到的是正在收的舊層，
  // 每畫一次就再疊一層新的，停掉時又只收舊的那層，圖上留著好幾層收不掉的進度。
  let veil = frame.querySelector(":scope > .hires-veil:not(.is-leaving)");
  const hi = t.hi;
  if (!hi) {
    if (veil && !veil.classList.contains("is-leaving")) {
      veil.classList.add("is-leaving");
      const v = veil;
      if (reducedMotion()) v.remove();
      else
        v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" }).onfinish = () => v.remove();
    }
    return;
  }
  if (!veil || veil.classList.contains("is-leaving")) {
    veil = el(
      "div",
      { class: "hires-veil" },
      el("img", { class: "hv-preview", alt: "", "aria-hidden": "true", decoding: "async", hidden: true }),
      el("div", { class: "hv-dim" }),
      el("div", { class: "hv-rule" }),
      el("div", { class: "hv-bar" }, el("span", { class: "hv-text", role: "status" }), el("button", { class: "hv-act pressable", type: "button" }))
    );
    frame.append(veil);
  }
  veil.dataset.status = hi.status;
  const pv = veil.querySelector(".hv-preview");
  if (hi.preview && pv.getAttribute("src") !== hi.preview) {
    // 新的一幀解碼好才換上：上一幀留著，不會閃一下空白。
    const next = new Image();
    next.onload = () => {
      if (!veil.isConnected || t.hi?.preview !== hi.preview) return;
      const first = pv.hidden;
      pv.src = hi.preview;
      pv.hidden = false;
      veil.dataset.preview = "true";
      if (first && !reducedMotion()) pv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
    };
    next.src = hi.preview;
  }
  veil.style.setProperty("--p", String(hi.status === "running" ? hi.progress || 0 : 0));
  const text = veil.querySelector(".hv-text");
  const label = hiresLabel(t);
  if (text.textContent !== translate(label)) text.textContent = label;
  const act = veil.querySelector(".hv-act");
  const failed = hi.status === "failed";
  act.textContent = failed ? "知道了" : "停";
  act.onclick = (e) => {
    e.stopPropagation();
    failed ? onDismiss() : onCancel();
  };
}
