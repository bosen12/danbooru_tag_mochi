// 工作流彈窗：跟選 LoRA / 底模同一套置中 overlay。

import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { invalidateModelLists } from "./lora.js";

const $ = (id) => document.getElementById(id);
const REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;
const STORE = "yz-workflow";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_WORKFLOW_BYTES = 5 * 1024 * 1024;
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

let WORKFLOW_ID = "";
// 畫廊版（墨池 web6）：跟 LoRA／底模同一種左右兩欄；ComfyUI 網址不放在這裡，改成點頂欄燈號跳出的小窗。
let GALLERY = false;
let MOTION = null;
try {
  WORKFLOW_ID = localStorage.getItem(STORE) || "";
} catch {
  WORKFLOW_ID = "";
}

/* ---------- 取樣參數：生圖的 steps／CFG，兩種 Hires 和修臉的 steps／CFG／denoise ----------
 * 只存「改過的」：沒改的不送，伺服器用它自己的預設（config.json），預設換了這裡跟著換。
 * 只有呼叫 initWorkflow({ sampling: true }) 的頁面（墨池、疊印台）才顯示、才送。 */
const SAMPLING_STORE = "yz-sampling";
const SAMPLING_ROWS = [
  { id: "base", zh: "生圖", keys: ["steps", "cfg"] },
  { id: "quick", zh: "快速 Hires", keys: ["steps", "cfg", "denoise"] },
  { id: "deep", zh: "深度 Hires", keys: ["steps", "cfg", "denoise"] },
  // 修臉只有墨池（web6）有：initWorkflow({ faceFix: true }) 才顯示這一行。
  // detail 那幾個存在同一份（sampling.face）、跟著修臉一起送，畫面上另外排成「修臉細節」一格一格寫說明。
  { id: "face", zh: "修臉", keys: ["steps", "cfg", "denoise"], faceFix: true, detail: ["bbox_threshold", "bbox_dilation", "bbox_crop_factor", "drop_size", "sam_dilation", "sam_threshold"] },
];
/* 修臉細節（FaceDetailer 的偵測框、SAM 遮罩）。預設和範圍以伺服器 /api/sampling 的 faceDetail 為準，這裡的 lo／hi 只是拿不到時的備用。 */
const FACE_DETAIL_FIELDS = {
  bbox_threshold: {
    zh: "偵測門檻",
    step: 0.05,
    digits: 2,
    lo: 0.05,
    hi: 0.95,
    desc: "臉部偵測的信心分數要超過多少才算臉。調低：小臉、側臉、半遮的臉比較抓得到，但也比較容易把不是臉的地方當成臉；調高相反。",
  },
  bbox_dilation: {
    zh: "偵測框外擴",
    step: 1,
    digits: 0,
    lo: 0,
    hi: 64,
    desc: "偵測到的臉框往外擴幾個像素再處理。太小可能切到下巴、髮際；太大會連周圍一起算進去。",
  },
  bbox_crop_factor: {
    zh: "裁切倍數",
    step: 0.1,
    digits: 1,
    lo: 1,
    hi: 5,
    desc: "拿臉框幾倍大的範圍去重畫。倍數越小，臉放得越大、細節越多（裁切最大 1024 像素：3 倍時臉只放到約 340 像素，1.6 倍約 640）；太小則周圍參考少，膚色、光線可能接不上。",
  },
  drop_size: {
    zh: "忽略小臉",
    step: 1,
    digits: 0,
    lo: 1,
    hi: 128,
    desc: "比這個還小（像素）的臉不修，多半是背景人物或圖案。",
  },
  sam_dilation: {
    zh: "臉形遮罩外擴",
    step: 1,
    digits: 0,
    lo: 0,
    hi: 64,
    desc: "SAM 切出臉的形狀之後再往外擴幾個像素。太小眼角、臉的邊緣可能漏修；太大會連瀏海、髮飾一起重畫。ComfyUI 沒有 SAM 模型時用不到。",
  },
  sam_threshold: {
    zh: "臉形遮罩門檻",
    step: 0.01,
    digits: 2,
    lo: 0.5,
    hi: 0.99,
    desc: "SAM 判斷「這塊算臉」的信心門檻。調低遮罩比較大、比較寬鬆；調高只留最確定的部分。ComfyUI 沒有 SAM 模型時用不到。",
  },
};
const SAMPLING_FIELD = {
  steps: { zh: "Steps", step: 1, digits: 0 },
  cfg: { zh: "CFG", step: 0.5, digits: 1 },
  denoise: { zh: "Denoise", step: 0.05, digits: 2 },
};
const SAMPLING_LIMITS = { steps: [1, 80], cfg: [1, 15], denoise: [0.05, 1] };
let samplingOn = false;
let faceFixOn = false;
/** 這一頁看得到的那幾行。 */
const samplingRows = () => SAMPLING_ROWS.filter((r) => !r.faceFix || faceFixOn);
let samplingDefaults = null;
const emptySampling = () => Object.fromEntries(SAMPLING_ROWS.map((r) => [r.id, {}]));
let sampling = emptySampling();
try {
  const raw = JSON.parse(localStorage.getItem(SAMPLING_STORE) || "{}");
  for (const r of SAMPLING_ROWS) {
    const src = raw && typeof raw[r.id] === "object" ? raw[r.id] : {};
    for (const k of [...r.keys, ...(r.detail || [])]) if (Number.isFinite(src[k])) sampling[r.id][k] = src[k];
  }
} catch {
  /* 讀不到就全部用預設 */
}

function saveSampling() {
  try {
    localStorage.setItem(SAMPLING_STORE, JSON.stringify(sampling));
  } catch {
    /* 無痕模式：這次有效 */
  }
}

/** 付印時帶上：{ steps, cfg } 裡改過的那幾個（沒改就是空物件）。 */
export function currentSampling() {
  return samplingOn ? { ...sampling.base } : {};
}

/** Hires 帶上：{ steps, cfg, denoise } 裡改過的那幾個。 */
export function currentHiresSampling(mode) {
  return samplingOn && sampling[mode] ? { ...sampling[mode] } : {};
}

let profiles = [];
let current = null;
let lastFocus = null;
let workflowRequestGeneration = 0;
let mappingWrite = Promise.resolve();

export function currentWorkflowId() {
  return WORKFLOW_ID || "";
}

export function applyWorkflowId(id) {
  WORKFLOW_ID = id == null ? "" : String(id);
  saveId();
  renderPickBtn();
}

export function workflowUiOpen() {
  return $("wf-modal")?.classList.contains("open") && $("wf-modal")?.dataset.closing !== "1";
}

function saveId() {
  try {
    localStorage.setItem(STORE, WORKFLOW_ID || "");
  } catch {
    /* ignore */
  }
}

async function getJson(url, init = {}) {
  let r;
  try {
    r = await fetch(url, {
      ...init,
      signal: init.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    return { ok: false, error: timedOut ? "連線逾時，請確認伺服器或 ComfyUI 是否仍有回應。" : String(e?.message || e) };
  }
  let j = {};
  try {
    j = await r.json();
  } catch {
    j = {};
  }
  if (typeof j.ok !== "boolean") j.ok = r.ok;
  if (!j.ok && !j.error) j.error = r.statusText || "request failed";
  return j;
}

function say(text, kind) {
  const el = $("wf-msg");
  if (!el) return;
  el.textContent = text || "";
  el.dataset.kind = kind || "";
}

function previewLine(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "（空）";
  return t.length > 96 ? t.slice(0, 95) + "…" : t;
}

function ensureDom() {
  const tools = $("mast-tools");
  if (tools && !$("wf-pick-btn")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.id = "wf-pick-btn";
    btn.title = "工作流";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-label", "工作流：內建");
    btn.innerHTML = `<svg class="wf-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="15" width="6" height="6" rx="1.2"/><rect x="15" y="3" width="6" height="6" rx="1.2"/><path d="M9 6h6M18 9v6M9 6c3 0 3 12 6 12"/></svg><span class="gen-pick-label">工作流</span>`;
    const ckpt = $("ckpt-pick-btn");
    if (ckpt) ckpt.after(btn);
    else {
      const ping = $("ping");
      if (ping && ping.parentNode === tools) tools.insertBefore(btn, ping);
      else tools.appendChild(btn);
    }
  }
  if ($("wf-modal")) return;
  const modal = document.createElement("div");
  modal.id = "wf-modal";
  modal.className = "lora-modal wf-modal";
  modal.inert = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "wf-head-title");
  if (GALLERY) {
    modal.classList.add("lg-modal");
    modal.innerHTML = `
    <div class="lora-modal-inner lg lg-wf">
      <button class="lora-modal-close" id="wf-close" aria-label="關閉 (Esc)" title="關閉 (Esc)">${ICON_CLOSE}</button>
      <aside class="lg-rail">
        <h2 class="lg-title" id="wf-head-title">工作流</h2>
        <p class="lg-hint">沒選就是內建。要用自己的工作流：把 ComfyUI 用它畫的任何一張 PNG 拖進來，或匯入「匯出工作流 (API)」的 JSON。</p>
        <div id="wf-list" class="lm-list wf-list"></div>
        <button type="button" class="wf-drop" id="wf-drop">匯入工作流…<br>ComfyUI 畫的 PNG 或 API JSON，拖進來或點這裡選檔</button>
        <input id="wf-file" type="file" accept="application/json,.json,image/png,.png" hidden />
      </aside>
      <section class="lg-main wf-main" aria-labelledby="wf-head-title">
        <div id="wf-current" class="lm-current"></div>
        <div id="wf-sampling" class="wf-sampling" hidden></div>
        <p class="wf-msg" id="wf-msg" role="status"></p>
      </section>
    </div>`;
    document.body.appendChild(modal);
    ensureComfyPop();
    return;
  }
  modal.innerHTML = `
    <div class="lora-modal-inner">
      <button class="lora-modal-close" id="wf-close" aria-label="關閉 (Esc)" title="關閉 (Esc)">${ICON_CLOSE}</button>
      <div class="lm-left">
        <div class="ckpt-head">
          <div class="ckpt-head-title" id="wf-head-title">工作流</div>
          <p class="ckpt-head-hint">沒選就是內建。要用自己的工作流：把 ComfyUI 用它畫的任何一張 PNG 拖進來，或匯入「匯出工作流 (API)」的 JSON。</p>
        </div>
        <div id="wf-list" class="lm-list"></div>
        <button type="button" class="wf-drop" id="wf-drop">匯入工作流…<br>ComfyUI 畫的 PNG 或 API JSON，拖進來或點這裡選檔</button>
        <input id="wf-file" type="file" accept="application/json,.json,image/png,.png" hidden />
      </div>
      <div class="lm-right">
        <div class="lm-right-head">目前選擇</div>
        <div class="wf-url-row">
          <input id="wf-url" type="url" autocomplete="off" spellcheck="false" aria-label="ComfyUI 網址" placeholder="http://127.0.0.1:8188" />
          <button type="button" class="ghost" id="wf-url-save">存位址</button>
        </div>
        <div id="wf-sampling" class="wf-sampling" hidden></div>
        <div id="wf-current" class="lm-current"></div>
        <p class="wf-msg" id="wf-msg" role="status"></p>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

/* ---------- ComfyUI 網址的小窗（畫廊版）：點頂欄的 Comfy 燈號打開 ---------- */

function ensureComfyPop() {
  if ($("comfy-pop")) return;
  const pop = document.createElement("div");
  pop.id = "comfy-pop";
  pop.className = "comfy-pop";
  pop.hidden = true;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-labelledby", "comfy-pop-title");
  pop.innerHTML = `
    <h2 class="comfy-pop-title" id="comfy-pop-title">ComfyUI 連線</h2>
    <p class="comfy-pop-state" id="comfy-pop-state"></p>
    <div class="wf-url-row">
      <input id="wf-url" type="url" autocomplete="off" spellcheck="false" aria-label="ComfyUI 網址" placeholder="http://127.0.0.1:8188" />
      <button type="button" class="ghost" id="wf-url-save">存位址</button>
    </div>
    <p class="comfy-pop-hint">ComfyUI 在別台電腦、或改過埠號才要填。按「自動找」回到自動偵測（8188、ComfyUI Desktop 的 8000）。</p>
    <div class="comfy-pop-acts"><button type="button" class="ghost" id="comfy-pop-auto">自動找</button></div>
    <p class="wf-msg" id="comfy-msg" role="status"></p>`;
  document.body.appendChild(pop);
  $("comfy-pop-auto").addEventListener("click", () => saveComfy({ auto: true }));
}

function comfyPopOpen() {
  const pop = $("comfy-pop");
  return !!pop && !pop.hidden && !pop.classList.contains("is-closing");
}

function placeComfyPop() {
  const pop = $("comfy-pop");
  const ping = $("ping");
  if (!pop || !ping) return;
  const r = ping.getBoundingClientRect();
  const w = pop.offsetWidth || 368;
  // 右邊對齊燈號；手機上燈號在中間偏右，小窗會超出左邊，夾回畫面裡。
  const left = Math.min(Math.max(12, r.right - w), innerWidth - w - 12);
  pop.style.top = Math.round(r.bottom + 10) + "px";
  pop.style.left = Math.round(Math.max(12, left)) + "px";
}

let comfyApi = "";
let comfyWatch = null;

function syncComfyState(api = comfyApi) {
  comfyApi = api || comfyApi;
  api = comfyApi;
  const box = $("comfy-pop-state");
  const ping = $("ping");
  if (!box) return;
  const ok = ping?.dataset.ok === "1";
  box.dataset.ok = ok ? "1" : "0";
  box.textContent = api ? (ok ? `已連上 ${api}` : `連不到 ${api}`) : ok ? "已連上" : "連不到";
}

function onComfyOutside(e) {
  if (e.target.closest?.("#comfy-pop, #ping")) return;
  closeComfyPop(false);
}

function openComfyPop() {
  const pop = $("comfy-pop");
  if (!pop) return;
  pop.classList.remove("is-closing");
  pop.hidden = false;
  placeComfyPop();
  syncComfyState();
  $("ping")?.setAttribute("aria-expanded", "true");
  sayComfy("");
  refreshComfy();
  window.setTimeout(() => $("wf-url")?.focus(), 0);
  document.addEventListener("pointerdown", onComfyOutside, true);
  addEventListener("resize", placeComfyPop);
  addEventListener("scroll", onComfyScroll, { passive: true });
  comfyWatch?.disconnect();
  comfyWatch = new MutationObserver(() => syncComfyState());
  if ($("ping")) comfyWatch.observe($("ping"), { attributes: true, attributeFilter: ["data-ok"] });
}

// 捲動：跟著燈號移（手機上頂欄不固定）；燈號捲出畫面才收起來。不直接收：手機鍵盤跳出來也會捲一下。
function onComfyScroll() {
  const r = $("ping")?.getBoundingClientRect();
  if (!r || r.bottom < 0) closeComfyPop(false);
  else placeComfyPop();
}

function closeComfyPop(returnFocus = true) {
  const pop = $("comfy-pop");
  if (!comfyPopOpen()) return;
  pop.classList.add("is-closing");
  $("ping")?.setAttribute("aria-expanded", "false");
  document.removeEventListener("pointerdown", onComfyOutside, true);
  removeEventListener("resize", placeComfyPop);
  removeEventListener("scroll", onComfyScroll);
  comfyWatch?.disconnect();
  comfyWatch = null;
  window.setTimeout(
    () => {
      if (!pop.classList.contains("is-closing")) return;
      pop.classList.remove("is-closing");
      pop.hidden = true;
    },
    REDUCE_MOTION ? 0 : 160
  );
  if (returnFocus && pop.contains(document.activeElement)) $("ping")?.focus();
}

function sayComfy(text, kind) {
  const el = $("comfy-msg");
  if (!el) return say(text, kind);
  el.textContent = text || "";
  el.dataset.kind = kind || "";
}

function renderPickBtn() {
  const btn = $("wf-pick-btn");
  if (!btn) return;
  const lab = btn.querySelector(".gen-pick-label");
  const p = profiles.find((x) => x.id === WORKFLOW_ID);
  if (lab) lab.textContent = p ? p.name : "工作流";
  btn.classList.toggle("has", !!WORKFLOW_ID);
  btn.title = p ? `工作流：${p.name}` : "工作流：內建";
  btn.setAttribute("aria-label", btn.title);
  // 用了自己的工作流：圖示模式下看不到名字，右上角點一顆小點提醒。
  btn.classList.toggle("is-custom", !!p);
  btn.setAttribute("aria-expanded", workflowUiOpen() ? "true" : "false");
}

function renderList() {
  const box = $("wf-list");
  if (!box) return;
  if (GALLERY && (!WORKFLOW_ID || profiles.some((p) => p.id === WORKFLOW_ID))) {
    const want = [["", "內建"], ...profiles.map((p) => [p.id, p.name || p.id])];
    const rows = [...box.querySelectorAll(":scope > .lora-row")];
    if (rows.length === want.length && rows.every((r, k) => r.dataset.id === want[k][0] && r.dataset.title === want[k][1])) {
      for (const r of rows) {
        const on = r.dataset.id === (WORKFLOW_ID || "");
        r.classList.toggle("on", on);
        if (on) r.setAttribute("aria-current", "true");
        else r.removeAttribute("aria-current");
      }
      renderPickBtn();
      return;
    }
  }
  box.replaceChildren();
  const add = (id, title, sub) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "lora-row" + ((id || "") === (WORKFLOW_ID || "") ? " on" : "");
    if ((id || "") === (WORKFLOW_ID || "")) row.setAttribute("aria-current", "true");
    const ph = document.createElement("span");
    ph.className = "ph";
    if (GALLERY) {
      // 畫廊版：一顆字當標記（內建是「內」，匯入的取名字的第一個字），不是空白的圖片框。
      ph.className = "lg-glyph";
      ph.textContent = id ? Array.from(String(title).trim())[0] || "?" : document.documentElement.lang === "en" ? "B" : "內";
      ph.setAttribute("aria-hidden", "true");
    }
    const rn = document.createElement("span");
    rn.className = "rn";
    const rt = document.createElement("span");
    rt.className = "rt";
    rt.textContent = title;
    const rf = document.createElement("span");
    rf.className = "rf";
    rf.textContent = sub;
    rn.append(rt, rf);
    row.append(ph, rn);
    row.dataset.id = id || "";
    row.dataset.title = title;
    row.addEventListener("click", () => selectWorkflow(id));
    box.append(row);
  };
  add("", "內建", "內建的 Illustrious 流程");
  for (const p of profiles) add(p.id, p.name || p.id, "匯入的 API workflow");
  if (WORKFLOW_ID && !profiles.some((p) => p.id === WORKFLOW_ID)) {
    WORKFLOW_ID = "";
    saveId();
  }
  renderPickBtn();
}

async function selectWorkflow(id) {
  if ((id || "") === (WORKFLOW_ID || "")) return;
  WORKFLOW_ID = id || "";
  saveId();
  renderList();
  // 畫廊版：右邊先淡掉，讀好之後新的內容從下面浮上來（不是一格就整片換掉、取樣那塊突然消失）。
  const nodes = [$("wf-current"), $("wf-sampling")].filter(Boolean);
  const live = GALLERY && MOTION && !REDUCE_MOTION;
  const outs = live ? nodes.map((n) => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.DUR.micro, easing: MOTION.css(MOTION.CURVE.exit), fill: "forwards" })) : [];
  await Promise.all([loadCurrent(), ...outs.map((a) => a.finished.catch(() => {}))]);
  outs.forEach((a) => a.cancel());
  if (!live) return;
  nodes
    .filter((n) => !n.hidden)
    .forEach((n, k) =>
      n.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: MOTION.DUR.medium, delay: k * 50, easing: MOTION.css(MOTION.CURVE.out), fill: "backwards" })
    );
}

/** 畫廊版的 <details>：打開時往下長、收起時縮回去再關（瀏覽器預設是一格就跳）。 */
function toggleDetails(d) {
  const { DUR, CURVE, css } = MOTION;
  const from = d.getBoundingClientRect().height;
  d._grow?.cancel();
  const opening = !d.open || d.dataset.closing === "1";
  delete d.dataset.closing;
  d.open = false;
  const shut = d.getBoundingClientRect().height;
  d.open = true;
  const full = d.getBoundingClientRect().height;
  const to = opening ? full : shut;
  // 收起來那段要停在最後一格（fill），等 open 拿掉之後才放掉：不然動畫結束到關掉之間會閃回全開一格。
  const a = d.animate([{ height: from + "px", overflow: "hidden" }, { height: to + "px", overflow: "hidden" }], {
    duration: opening ? DUR.medium : DUR.short,
    easing: css(opening ? CURVE.out : CURVE.exit),
    fill: opening ? "none" : "forwards",
  });
  d._grow = a;
  if (!opening) {
    d.dataset.closing = "1";
    a.onfinish = () => {
      if (d._grow !== a) return;
      delete d.dataset.closing;
      d.open = false;
      a.cancel();
    };
  }
}

function pickedNode(field) {
  const mapped = current?.mapping?.[field] || {};
  if (mapped.mode === "keep") return "";
  if (mapped.node) return String(mapped.node);
  const sug = current?.suggested?.[field] || {};
  if (sug.mode === "keep") return "";
  return String(sug.node || "");
}

function pickedLoraIds() {
  const specs = Array.isArray(current?.mapping?.loras) ? current.mapping.loras : current?.suggested?.loras;
  if (!Array.isArray(specs)) return [];
  return specs.filter((s) => s && s.mode === "control" && s.node).map((s) => String(s.node));
}

function heading(text) {
  const el = document.createElement("div");
  el.className = "wf-sec";
  el.textContent = text;
  return el;
}

function nodeButton(item, on, onClick, badge) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "wf-prompt" + (on ? " on" : "");
  const wrap = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = `${item.title || item.class_type || "節點"} · #${item.id}${badge ? " · " + badge : ""}`;
  const em = document.createElement("em");
  em.textContent = previewLine(item.preview);
  wrap.append(strong, em);
  b.append(wrap);
  b.addEventListener("click", onClick);
  return b;
}

function keepButton(on, label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "wf-prompt" + (on ? " on" : "");
  const strong = document.createElement("strong");
  strong.textContent = label;
  b.append(strong);
  b.addEventListener("click", onClick);
  return b;
}

async function loadSamplingDefaults() {
  if (samplingDefaults) return samplingDefaults;
  const j = await getJson("/api/sampling");
  if (j.ok) samplingDefaults = j;
  return samplingDefaults;
}

const defaultOf = (row, k) => (row === "base" ? samplingDefaults?.base?.[k] : samplingDefaults?.hires?.[row]?.[k]);

function renderSampling() {
  const box = $("wf-sampling");
  if (!box || !samplingOn) return;
  box.hidden = false;
  box.replaceChildren();
  const head = document.createElement("div");
  head.className = "wf-samp-head";
  const title = document.createElement("span");
  title.className = "lm-right-head";
  title.textContent = "取樣參數";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "wf-samp-reset";
  reset.textContent = "全部恢復預設";
  reset.disabled = !samplingRows().some((r) => Object.keys(sampling[r.id]).length);
  reset.addEventListener("click", () => {
    // 只清這一頁看得到的那幾行：web7 沒有修臉，不能順手把墨池那邊改過的修臉清掉（同一份存檔）。
    for (const r of samplingRows()) sampling[r.id] = {};
    saveSampling();
    renderSampling();
    say("取樣參數都回到預設了。");
  });
  head.append(title, reset);
  box.append(head);
  for (const r of samplingRows()) {
    const row = document.createElement("div");
    row.className = "wf-samp-row";
    row.dataset.row = r.id;
    const lab = document.createElement("span");
    lab.className = "wf-samp-label";
    lab.textContent = r.zh;
    row.append(lab);
    for (const k of r.keys) {
      const f = SAMPLING_FIELD[k];
      const [lo, hi] = SAMPLING_LIMITS[k];
      const def = defaultOf(r.id, k);
      const wrap = document.createElement("label");
      wrap.className = "wf-samp-field";
      const name = document.createElement("span");
      name.textContent = f.zh;
      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "decimal";
      input.min = String(lo);
      input.max = String(hi);
      input.step = String(f.step);
      input.setAttribute("aria-label", `${r.zh} ${f.zh}`);
      const shown = sampling[r.id][k] ?? def;
      input.value = shown == null ? "" : Number(shown).toFixed(f.digits);
      if (def != null) input.placeholder = Number(def).toFixed(f.digits);
      const mark = () => {
        wrap.dataset.changed = sampling[r.id][k] != null ? "true" : "false";
        wrap.title = def != null ? `預設 ${Number(def).toFixed(f.digits)}` : "";
      };
      mark();
      input.addEventListener("change", () => {
        const v = parseFloat(input.value);
        if (!Number.isFinite(v)) delete sampling[r.id][k];
        else {
          const c = Math.min(hi, Math.max(lo, f.digits ? Math.round(v / f.step) * f.step : Math.round(v)));
          const val = Number(c.toFixed(f.digits));
          // 改回跟預設一樣：當作沒改（預設以後換了會跟著換）。
          if (def != null && Math.abs(val - def) < 1e-9) delete sampling[r.id][k];
          else sampling[r.id][k] = val;
        }
        const now = sampling[r.id][k] ?? def;
        input.value = now == null ? "" : Number(now).toFixed(f.digits);
        saveSampling();
        mark();
        reset.disabled = !samplingRows().some((x) => Object.keys(sampling[x.id]).length);
      });
      wrap.append(name, input);
      row.append(wrap);
    }
    box.append(row);
  }
  if (faceFixOn) box.append(faceDetailBlock(reset));
  const note = document.createElement("p");
  note.className = "ckpt-cur-hint wf-samp-note";
  box.append(note);
  syncSamplingNote();
}

/** 修臉細節：一個參數一列，名字、原本的參數名、數字框、一句說明。收在可以展開的一格裡，平常不佔位置。 */
let faceDetailOpen = false;
function faceDetailBlock(reset) {
  const wrap = document.createElement("details");
  wrap.className = "wf-face-detail";
  wrap.open = faceDetailOpen;
  wrap.addEventListener("toggle", () => (faceDetailOpen = wrap.open));
  const sum = document.createElement("summary");
  sum.textContent = "修臉細節（偵測框、臉形遮罩）";
  if (GALLERY && MOTION && !REDUCE_MOTION) {
    sum.addEventListener("click", (e) => {
      e.preventDefault();
      toggleDetails(wrap);
    });
  }
  wrap.append(sum);
  const lead = document.createElement("p");
  lead.className = "wf-face-lead";
  lead.textContent = "成品上按「修臉」時用。沒把握就用預設；有臉沒被修到，先試著調低偵測門檻；臉修得糊，試著調低裁切倍數。";
  wrap.append(lead);
  const face = SAMPLING_ROWS.find((r) => r.id === "face");
  for (const k of face.detail) {
    const f = FACE_DETAIL_FIELDS[k];
    const [lo, hi] = samplingDefaults?.faceDetailLimits?.[k] || [f.lo, f.hi];
    const def = samplingDefaults?.faceDetail?.[k];
    const row = document.createElement("div");
    row.className = "wf-face-row";
    row.dataset.key = k;
    const field = document.createElement("label");
    field.className = "wf-samp-field";
    const name = document.createElement("span");
    name.className = "wf-face-name";
    const zh = document.createElement("b");
    zh.textContent = f.zh;
    const code = document.createElement("code");
    code.textContent = k;
    code.dataset.noI18n = "";
    name.append(zh, code);
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.min = String(lo);
    input.max = String(hi);
    input.step = String(f.step);
    input.setAttribute("aria-label", `修臉 ${f.zh}`);
    const shown = sampling.face[k] ?? def;
    input.value = shown == null ? "" : Number(shown).toFixed(f.digits);
    if (def != null) input.placeholder = Number(def).toFixed(f.digits);
    const desc = document.createElement("p");
    desc.className = "wf-face-desc";
    desc.textContent = f.desc;
    const mark = () => {
      field.dataset.changed = sampling.face[k] != null ? "true" : "false";
      field.title = def != null ? `預設 ${Number(def).toFixed(f.digits)}` : "";
    };
    mark();
    input.addEventListener("change", () => {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v)) delete sampling.face[k];
      else {
        const c = Math.min(hi, Math.max(lo, Math.round(v / f.step) * f.step));
        const val = Number(c.toFixed(f.digits));
        if (def != null && Math.abs(val - def) < 1e-9) delete sampling.face[k];
        else sampling.face[k] = val;
      }
      const now = sampling.face[k] ?? def;
      input.value = now == null ? "" : Number(now).toFixed(f.digits);
      saveSampling();
      mark();
      reset.disabled = !samplingRows().some((x) => Object.keys(sampling[x.id]).length);
    });
    field.append(name, input);
    row.append(field, desc);
    wrap.append(row);
  }
  return wrap;
}

/** 換了工作流：說明跟著換（不重建欄位，打到一半的數字不會被洗掉）。 */
function syncSamplingNote() {
  const note = $("wf-sampling")?.querySelector(".wf-samp-note");
  if (!note) return;
  const custom = !!WORKFLOW_ID;
  note.textContent = custom
    ? `目前用的是自己的工作流：生圖照它圖裡的 steps／CFG，這裡的「生圖」那一行不套用。${faceFixOn ? "Hires、修臉" : "Hires"}一律用這裡的。`
    : "改過的會描一道底線；清空欄位或改回預設值就回到預設。";
  $("wf-sampling").dataset.custom = custom ? "true" : "false";
}

/** 自訂工作流保留它自己的底模時，頂欄的底模不會生效：劃掉變淡，滑上去說明。 */
function markCkptOwner() {
  const btn = $("ckpt-pick-btn");
  if (!btn) return;
  const spec = current && (current.mapping?.checkpoint || current.suggested?.checkpoint);
  const owned = !!(WORKFLOW_ID && current && (!spec || (spec.mode || "keep") !== "control"));
  if (owned) {
    btn.dataset.wfOwned = "1";
    btn.title = `工作流「${current.name || WORKFLOW_ID}」用它自己的底模（在工作流面板可以改成用這裡選的）`;
  } else if (btn.dataset.wfOwned) {
    delete btn.dataset.wfOwned;
    btn.title = "設定：底模";
  }
}

function renderCurrent() {
  syncSamplingNote();
  markCkptOwner();
  const box = $("wf-current");
  if (!box) return;
  box.replaceChildren();
  if (!WORKFLOW_ID) {
    const t = document.createElement("div");
    t.className = "lm-cur-title";
    t.textContent = "內建";
    const h = document.createElement("p");
    h.className = "ckpt-cur-hint";
    h.textContent = "正向、負向、LoRA 都照這裡選的組裝。";
    box.append(t, h);
    return;
  }
  if (!current) {
    const h = document.createElement("p");
    h.className = "ckpt-cur-hint";
    h.textContent = "讀取中…";
    box.append(h);
    return;
  }
  const t = document.createElement("div");
  t.className = "lm-cur-title";
  t.textContent = current.name || WORKFLOW_ID;
  const h = document.createElement("p");
  h.className = "ckpt-cur-hint";
  h.textContent = current.ready ? "下面決定要改這套工作流的哪些地方，沒選的保留它的原值。" : "至少選一個正向節點才能生圖。";
  box.append(t, h);

  const prompts = current.prompts || [];
  const sugPos = String(current.suggested?.positive?.node || "");
  const sugNeg = String(current.suggested?.negative?.node || "");
  const posId = pickedNode("positive");
  box.append(heading("正向"));
  for (const item of prompts) {
    box.append(nodeButton(item, item.id === posId, () => savePrompt("positive", item), item.id === sugPos ? "建議" : ""));
  }

  const negId = pickedNode("negative");
  box.append(heading("負向"));
  box.append(keepButton(!negId, "不改，保留 workflow 原值", () => savePrompt("negative", null)));
  for (const item of prompts) {
    box.append(nodeButton(item, item.id === negId, () => savePrompt("negative", item), item.id === sugNeg ? "建議" : ""));
  }

  const loras = current.loraNodes || [];
  const loraOn = new Set(pickedLoraIds());
  box.append(heading("LoRA"));
  if (!loras.length) {
    const none = document.createElement("p");
    none.className = "ckpt-cur-hint";
    none.textContent = "這套工作流沒有 LoRA 節點：LoRA 面板選的會自動接在底模後面。";
    box.append(none);
  } else {
    box.append(keepButton(loraOn.size === 0, "不指定：LoRA 面板選的接在底模後面，工作流自己的 LoRA 照留", () => saveLoras([])));
    for (const item of loras) {
      box.append(
        nodeButton(item, loraOn.has(item.id), () => {
          const next = new Set(loraOn);
          if (next.has(item.id)) next.delete(item.id);
          else if (next.size >= 2) {
            say("最多對兩個 LoRA 節點（LoRA 面板只有兩格）。", "err");
            return;
          } else next.add(item.id);
          saveLoras([...next], loras);
        })
      );
    }
  }

  // 種子、尺寸、底模：以前看不到排字匣會不會改它們。種子抓不到時每張都是同一顆，底模保留時頂欄選的不會生效。
  const eff = (field) => current.mapping?.[field] || current.suggested?.[field] || null;
  const line = (text) => {
    const p = document.createElement("p");
    p.className = "ckpt-cur-hint";
    p.textContent = text;
    return p;
  };
  box.append(heading("種子、尺寸、底模"));
  const seed = eff("seed");
  const seedN = seed && (seed.mode || "keep") === "control" ? 1 + (seed.also || []).length : 0;
  box.append(line(seedN ? `種子：每張換新的（${seedN} 個取樣器跟著換）` : "種子：這套工作流找不到種子欄位，每張會用它自己寫死的那顆。"));
  const w = eff("width");
  box.append(line(w && (w.mode || "keep") === "control" ? "尺寸：照規則裡選的尺寸" : "尺寸：保留工作流自己的"));
  const ck = eff("checkpoint");
  if (ck) {
    const control = (ck.mode || "keep") === "control";
    const setCkpt = (mode) => {
      const mapping = baseMapping();
      mapping.checkpoint = { ...ck, mode };
      putMapping(mapping);
    };
    box.append(keepButton(control, "底模：用頂欄選的", () => setCkpt("control")));
    box.append(keepButton(!control, "底模：保留工作流自己的", () => setCkpt("keep")));
  } else {
    box.append(line("底模：這套工作流沒有底模節點，頂欄選的不會套用。"));
  }

  const del = document.createElement("button");
  del.type = "button";
  del.className = "ghost wf-del";
  del.textContent = "刪掉這套";
  del.addEventListener("click", deleteCurrent);
  box.append(del);
}

function baseMapping() {
  return { ...(current?.suggested || {}), ...(current?.mapping || {}) };
}

async function putMapping(mapping, note) {
  if (!WORKFLOW_ID) return;
  const requestedId = WORKFLOW_ID;
  current = { ...(current || {}), mapping };
  renderCurrent();
  mappingWrite = mappingWrite.then(async () => {
    if (requestedId !== WORKFLOW_ID) return;
    const j = await getJson("/api/workflows/" + encodeURIComponent(requestedId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping }),
    });
    if (requestedId !== WORKFLOW_ID) return;
    if (!j.ok) {
      say(j.error || "存不起來", "err");
      await loadCurrent();
      return;
    }
    current = j;
    renderCurrent();
    if (note) say(note, "err");
    else say(j.ready ? "已存。" : "還要選正向節點。", j.ready ? "" : "err");
  });
  return mappingWrite;
}

async function savePrompt(field, item) {
  const mapping = baseMapping();
  let note = "";
  if (!item) {
    if (mapping[field]) mapping[field] = { ...mapping[field], mode: "keep" };
    else delete mapping[field];
  } else {
    mapping[field] = { node: item.id, input: item.input || "text", mode: "control" };
    const other = field === "positive" ? "negative" : "positive";
    if (mapping[other] && String(mapping[other].node) === String(item.id) && mapping[other].mode === "control") {
      mapping[other] = { ...mapping[other], mode: "keep" };
      note = "正向／負向不能是同一個節點，另一邊改成不改。";
    }
  }
  await putMapping(mapping, note);
}

async function saveLoras(ids, nodes) {
  const mapping = baseMapping();
  const byId = Object.fromEntries((nodes || current?.loraNodes || []).map((n) => [n.id, n]));
  mapping.loras = ids.map((id) => {
    const n = byId[id] || {};
    return {
      node: id,
      input: n.input || "lora_name",
      strengthInput: n.strengthInput || "strength_model",
      mode: "control",
    };
  });
  await putMapping(mapping);
}

async function loadCurrent() {
  const requestedId = WORKFLOW_ID;
  const generation = ++workflowRequestGeneration;
  current = null;
  if (!requestedId) {
    renderCurrent();
    return;
  }
  const j = await getJson("/api/workflows/" + encodeURIComponent(requestedId));
  if (generation !== workflowRequestGeneration || requestedId !== WORKFLOW_ID) return;
  if (!j.ok) {
    WORKFLOW_ID = "";
    saveId();
    current = null;
    renderList();
    renderCurrent();
    say(j.error || "讀不到，已改回內建。", "err");
    return;
  }
  current = j;
  renderCurrent();
  if (!j.ready) say("選右邊一個 CLIP 節點。", "err");
  else say("");
}

async function refreshList() {
  const j = await getJson("/api/workflows");
  profiles = j.items || [];
  renderList();
  await loadCurrent();
}

async function refreshComfy() {
  const j = await getJson("/api/comfy");
  if (!j.ok) {
    say(j.error || "讀不到 ComfyUI 設定", "err");
    return;
  }
  const input = $("wf-url");
  // 有焦點時不蓋掉正在打的字；但空的就填（從頂欄燈號點進來時游標已經先放進來了）。
  if (input && (document.activeElement !== input || !input.value)) input.value = j.saved || j.api || "";
  syncComfyState(j.api);
  if (j.note) sayComfy(j.note, "err");
}

async function saveComfy({ auto = false } = {}) {
  if (GALLERY && !String($("wf-url")?.value || "").trim()) auto = true;
  const j = await getJson("/api/comfy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(auto ? { api: "", auto: true } : { api: $("wf-url")?.value || "" }),
  });
  if (!j.ok) {
    sayComfy(j.error || "ComfyUI 網址存不起來", "err");
    return;
  }
  invalidateModelLists();
  if ($("wf-url")) $("wf-url").value = j.saved || j.api || "";
  syncComfyState(j.api);
  sayComfy(j.note || (auto ? "改回自動找：找到哪個就連哪個。" : "ComfyUI 網址已儲存。"), j.note ? "err" : "");
}

async function importWorkflow(data, name) {
  say("匯入中…");
  const j = await getJson("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name || "Workflow", workflow: data }),
  });
  if (!j.ok) {
    say(j.error || "匯入失敗", "err");
    return;
  }
  WORKFLOW_ID = j.id;
  workflowRequestGeneration += 1;
  saveId();
  profiles = (await getJson("/api/workflows")).items || profiles;
  current = j;
  renderList();
  renderCurrent();
  say(j.ready ? `已匯入「${j.name}」。` : "已匯入。選 tags 要寫進哪個節點。", j.ready ? "" : "err");
}

/**
 * ComfyUI 存的 PNG 裡有兩段文字：prompt 是 API 格式（排字匣要的），workflow 是編輯器格式。
 * 讀 tEXt／iTXt（iTXt 只收沒壓縮的，ComfyUI 存的就是這種）。找不到回 { prompt: null, workflow }。
 */
export function pngWorkflowText(buffer) {
  const bytes = new Uint8Array(buffer);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || sig.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(buffer);
  const latin = new TextDecoder("latin1");
  const utf8 = new TextDecoder("utf-8");
  const found = {};
  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const len = view.getUint32(pos);
    const type = latin.decode(bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === "tEXt" || type === "iTXt") {
      const zero = body.indexOf(0);
      const key = latin.decode(body.subarray(0, zero));
      let text = "";
      if (type === "tEXt") text = utf8.decode(body.subarray(zero + 1));
      else if (body[zero + 1] === 0) {
        // iTXt：keyword\0 壓縮旗標 壓縮法 語言\0 翻譯後的 keyword\0 文字
        let at = zero + 3;
        at = body.indexOf(0, at) + 1;
        at = body.indexOf(0, at) + 1;
        text = utf8.decode(body.subarray(at));
      }
      if (key === "prompt" || key === "workflow") found[key] = text;
    }
    if (type === "IEND") break;
    pos += 12 + len;
  }
  return { prompt: found.prompt || null, workflow: found.workflow || null };
}

async function importFile(file) {
  if (/\.png$/i.test(file.name || "") || file.type === "image/png") {
    let meta;
    try {
      meta = pngWorkflowText(await file.arrayBuffer());
    } catch (e) {
      say("讀不到這張圖：" + e.message, "err");
      return;
    }
    if (!meta) {
      say("這不是 PNG 檔。", "err");
      return;
    }
    if (!meta.prompt) {
      say(meta.workflow ? "這張圖只存了編輯器格式的工作流：在 ComfyUI 打開它，再用「匯出工作流 (API)」存 JSON 匯入。" : "這張圖裡沒有 ComfyUI 的工作流（存圖時可能拿掉了）。", "err");
      return;
    }
    let data;
    try {
      data = JSON.parse(meta.prompt);
    } catch {
      say("這張圖裡的工作流讀不懂。", "err");
      return;
    }
    await importWorkflow(data, String(file.name || "").replace(/\.png$/i, "") || "Workflow");
    return;
  }
  if (file.size > MAX_WORKFLOW_BYTES) {
    say("JSON 太大（上限 5 MB）。", "err");
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch (e) {
    say("讀不到檔案：" + e.message, "err");
    return;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    say("不是有效的 JSON。", "err");
    return;
  }
  await importWorkflow(data, String(file.name || "").replace(/\.json$/i, "") || "Workflow");
}

async function deleteCurrent() {
  if (!WORKFLOW_ID) return;
  if (!window.confirm("刪掉這套自己匯入的 workflow？內建還在。")) return;
  const r = await fetch("/api/workflows/" + encodeURIComponent(WORKFLOW_ID), { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !j.ok) {
    say(j.error || "刪除失敗", "err");
    return;
  }
  WORKFLOW_ID = "";
  workflowRequestGeneration += 1;
  current = null;
  saveId();
  await refreshList();
  say("已刪除，改回內建。");
}

function openModal() {
  ensureDom();
  lastFocus = document.activeElement;
  const el = $("wf-modal");
  el._closeGen = (el._closeGen || 0) + 1;
  delete el.dataset.closing;
  el.classList.remove("is-closing");
  el.inert = false;
  el.classList.add("open");
  lockScroll("wf-modal");
  renderPickBtn();
  $("wf-close")?.focus();
  say("");
  Promise.all([refreshList(), refreshComfy()]).catch((e) => say(String(e.message || e), "err"));
  if (samplingOn) loadSamplingDefaults().then(renderSampling);
}

function closeModal() {
  const el = $("wf-modal");
  if (!el || !el.classList.contains("open") || el.dataset.closing === "1") return;
  const gen = (el._closeGen = (el._closeGen || 0) + 1);
  el.dataset.closing = "1";
  el.classList.add("is-closing");
  el.inert = true;
  window.setTimeout(
    () => {
      if (el._closeGen !== gen) return;
      el.classList.remove("open", "is-closing");
      delete el.dataset.closing;
      unlockScroll("wf-modal");
      renderPickBtn();
      (lastFocus || $("wf-pick-btn"))?.focus?.();
    },
    REDUCE_MOTION ? 0 : 180
  );
}

/**
 * 頂欄的「Comfy 未連」一點就打開這裡、游標放在 ComfyUI 網址：連不上時最直覺的下一步，
 * 也是 README 跟出圖失敗訊息叫人去點的地方。
 */
function linkPing() {
  const ping = $("ping");
  if (!ping || ping.dataset.wfLink) return;
  ping.dataset.wfLink = "1";
  ping.tabIndex = 0;
  ping.setAttribute("role", "button");
  ping.title = "ComfyUI 網址（點一下修改）";
  if (GALLERY) ping.setAttribute("aria-haspopup", "dialog");
  const go = () => {
    if (GALLERY) return comfyPopOpen() ? closeComfyPop() : openComfyPop();
    openModal();
    window.setTimeout(() => $("wf-url")?.focus(), 0);
  };
  ping.addEventListener("click", go);
  ping.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    go();
  });
}

export function initWorkflow({ sampling: withSampling = false, faceFix = false, gallery = false, motion = null } = {}) {
  samplingOn = withSampling;
  faceFixOn = faceFix;
  GALLERY = !!gallery;
  MOTION = motion;
  ensureDom();
  renderPickBtn();
  // 開頁就知道目前的自訂工作流會不會用頂欄的底模（不必先打開工作流面板）。
  if (WORKFLOW_ID) loadCurrent().catch(() => {});
  $("wf-pick-btn")?.addEventListener("click", openModal);
  linkPing();
  $("wf-close")?.addEventListener("click", closeModal);
  $("wf-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "wf-modal") closeModal();
  });
  $("wf-drop")?.addEventListener("click", () => $("wf-file")?.click());
  $("wf-url-save")?.addEventListener("click", saveComfy);
  $("wf-url")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveComfy();
    }
  });
  $("wf-file")?.addEventListener("change", () => {
    const file = $("wf-file").files?.[0];
    $("wf-file").value = "";
    if (file) importFile(file);
  });
  const drop = $("wf-drop");
  drop?.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.dataset.over = "1";
  });
  drop?.addEventListener("dragleave", () => {
    delete drop.dataset.over;
  });
  drop?.addEventListener("drop", (e) => {
    e.preventDefault();
    delete drop.dataset.over;
    const file = [...(e.dataTransfer?.files || [])].find((f) => /\.(json|png)$/i.test(f.name) || f.type.includes("json") || f.type === "image/png");
    if (!file) say("請拖入 ComfyUI 畫的 PNG，或工作流的 .json 檔。", "err");
    else importFile(file);
  });
  refreshList().catch(() => {});
}

export function wfHandleKeys(e) {
  if (comfyPopOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeComfyPop();
      return true;
    }
    // 在小窗裡打字（網址）時，墨池的快捷鍵（G、P…）不要跟著動。
    return !!e.target?.closest?.("#comfy-pop");
  }
  if (!workflowUiOpen()) return false;
  if (e.key === "Escape") {
    e.preventDefault();
    closeModal();
    return true;
  }
  if (e.key === "Tab") {
    const modal = $("wf-modal");
    const focusable = [...(modal?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
      .filter((el) => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) return true;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  return true;
}
