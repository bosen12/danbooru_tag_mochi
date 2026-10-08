/**
 * 生圖種子：隨機，或填一個固定的。所有會送 ComfyUI 的頁面共用這一份
 * （排字匣各版面、導影台、中控室、墨池、疊印台、字鋪、猜字棚）。
 *
 * 只管送給 ComfyUI 的那顆種子（KSampler 的雜訊）。抽牌用的種子照樣每張隨機，
 * 所以固定之後是「同一種雜訊、不同的 POS」，拿來比較內容差在哪。
 * 一次好幾張、無限抽，每張都用同一顆。
 *
 *   genSeed(fallback)  固定就回固定的那顆，隨機就回 fallback（呼叫端原本的隨機種子，可以是 undefined）
 *   mountSeedControl(host)  放一組「隨機／固定＋輸入框＋骰子」進 host，回傳那個節點（可以重複搬動）
 *   useSeed(n)  把某張成品的種子設成固定（成品上的「用這個種子」）
 *
 * 設定存在這個網頁自己的 localStorage（每個版面各自記）；同一個網站開好幾個分頁會互相同步。
 */

const KEY = "seedControl.v1";
const MAX = Number.MAX_SAFE_INTEGER;
const STYLE_ID = "seed-control-style";
const FIXED_NOTE = "每張都用這顆種子生圖；抽牌照樣每張隨機";
const RANDOM_NOTE = "每張隨機。填一個數字就固定下來";

let state = read();
const listeners = new Set();
const mounted = new Set();

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && (raw.mode === "fixed" || raw.mode === "random")) {
      return { mode: raw.mode, value: valid(raw.value) ? raw.value : null };
    }
  } catch {
    /* 讀不到就用隨機 */
  }
  return { mode: "random", value: null };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 存不了就只在這次有效 */
  }
}

function valid(n) {
  return Number.isSafeInteger(n) && n >= 0 && n <= MAX;
}

function parse(text) {
  const t = String(text).trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return valid(n) ? n : null;
}

/** 固定模式、而且有一顆合法的種子，才算固定。 */
export function isFixedSeed() {
  return state.mode === "fixed" && valid(state.value);
}

export function genSeed(fallback) {
  return isFixedSeed() ? state.value : fallback;
}

export function seedState() {
  return { ...state, fixed: isFixedSeed() };
}

export function onSeedChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set(next) {
  state = next;
  save();
  for (const node of mounted) paint(node);
  for (const fn of listeners) {
    try {
      fn(seedState());
    } catch {
      /* 一個聽眾壞了不影響其他 */
    }
  }
}

/** 撤回「回到舊版」用：把 seedState() 記下的那一份原樣放回去（隨機模式也放得回去）。 */
export function restoreSeed(saved) {
  if (!saved || (saved.mode !== "fixed" && saved.mode !== "random")) return;
  if (saved.mode === state.mode && saved.value === state.value) return;
  set({ mode: saved.mode, value: saved.value });
}

export function useSeed(n) {
  const v = typeof n === "string" ? parse(n) : n;
  if (!valid(v)) return false;
  set({ mode: "fixed", value: v });
  return true;
}

function randomValue() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/* ---------- 畫面 ---------- */

const CSS = `
.seed-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .5rem;font-size:.875rem;line-height:1.3;color:inherit}
.seed-ctl-label{white-space:nowrap;color:var(--color-muted,inherit)}
.seed-ctl-mode{display:inline-flex;padding:2px;border:1px solid var(--color-rule,color-mix(in srgb,currentColor 30%,transparent));border-radius:999px}
.seed-ctl-mode button{appearance:none;min-height:30px;padding:0 .75rem;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;cursor:pointer;
transition:background-color 120ms ease-out,color 120ms ease-out}
.seed-ctl-mode button[aria-checked="true"]{background:var(--color-ink,currentColor);color:var(--color-paper,Canvas)}
.seed-ctl-mode button:hover:not([aria-checked="true"]){background:color-mix(in srgb,currentColor 10%,transparent)}
.seed-ctl-field{display:inline-flex;align-items:center;gap:.3rem;min-width:0;max-width:100%}
.seed-ctl-input{flex:0 1 17.5ch;width:17.5ch;min-width:7ch;min-height:32px;padding:0 .55rem;border:1px solid var(--color-rule,color-mix(in srgb,currentColor 30%,transparent));border-radius:6px;
background:transparent;color:inherit;font-family:var(--font-mono,var(--font-outlier,ui-monospace,monospace));font-size:.85rem;font-variant-numeric:tabular-nums}
.seed-ctl-input::placeholder{color:var(--color-muted,inherit);opacity:.8}
.seed-ctl[data-mode="random"] .seed-ctl-input{color:var(--color-muted,inherit)}
.seed-ctl-input[aria-invalid="true"]{border-color:var(--color-danger,var(--color-accent,currentColor))}
.seed-ctl-dice{flex:none;appearance:none;display:inline-grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--color-rule,color-mix(in srgb,currentColor 30%,transparent));
border-radius:6px;background:transparent;color:inherit;cursor:pointer;transition:transform 180ms cubic-bezier(.16,1,.3,1)}
.seed-ctl-dice svg{width:16px;height:16px}
.seed-ctl-dice:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
.seed-ctl-dice:active{transform:rotate(-20deg) scale(.94)}
.seed-ctl :focus-visible{outline:2px solid var(--color-focus,Highlight);outline-offset:2px}
.seed-ctl-note{flex-basis:100%;margin:0;font-size:.75rem;color:var(--color-muted,inherit)}
.seed-ctl-note[data-kind="err"]{color:var(--color-danger,var(--color-accent,inherit))}
.seed-ctl[data-compact] .seed-ctl-note:not([data-kind="err"]){display:none}
.seed-use{appearance:none;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}
.seed-use:hover{text-decoration-style:solid}
@media (prefers-reduced-motion: reduce){.seed-ctl-mode button,.seed-ctl-dice{transition:none}}
`;

const DICE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/></svg>';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.append(s);
}

function h(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    n.setAttribute(k, v === true ? "" : String(v));
  }
  if (text !== undefined) n.textContent = text;
  return n;
}

let uid = 0;

/**
 * 一組種子控制。opts.compact：只留按鈕跟輸入框，說明文字收起來（窄的工具列用）。
 * opts.fixedNote／randomNote：說明文字（遊戲裡沒有「抽牌」，講題目或委託）。
 */
export function mountSeedControl(host, { label = "生圖種子", compact = false, fixedNote = FIXED_NOTE, randomNote = RANDOM_NOTE } = {}) {
  ensureStyle();
  const id = "seed-ctl-" + ++uid;
  const root = h("div", { class: "seed-ctl", role: "group", "aria-labelledby": id + "-label", "data-compact": compact || undefined });
  const lab = h("span", { class: "seed-ctl-label", id: id + "-label" }, label);
  const mode = h("div", { class: "seed-ctl-mode", role: "radiogroup", "aria-label": "種子模式" });
  const rnd = h("button", { type: "button", role: "radio", "data-v": "random" }, "隨機");
  const fix = h("button", { type: "button", role: "radio", "data-v": "fixed" }, "固定");
  mode.append(rnd, fix);
  const input = h("input", {
    class: "seed-ctl-input",
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "固定的生圖種子",
    "aria-describedby": id + "-note",
  });
  const dice = h("button", { class: "seed-ctl-dice", type: "button", title: "換一顆新的固定種子", "aria-label": "換一顆新的固定種子" });
  dice.innerHTML = DICE;
  const field = h("span", { class: "seed-ctl-field" });
  field.append(input, dice);
  const note = h("p", { class: "seed-ctl-note", id: id + "-note", "aria-live": "polite" });
  root.append(lab, mode, field, note);

  rnd.addEventListener("click", () => set({ ...state, mode: "random" }));
  fix.addEventListener("click", () => {
    if (valid(state.value)) set({ ...state, mode: "fixed" });
    else set({ mode: "fixed", value: randomValue() });
    input.focus({ preventScroll: true });
    input.select();
  });
  for (const b of [rnd, fix]) {
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const other = b === rnd ? fix : rnd;
      other.click();
      other.focus();
    });
  }
  dice.addEventListener("click", () => set({ mode: "fixed", value: randomValue() }));
  input.addEventListener("input", () => {
    const t = input.value.trim();
    root._draft = t;
    if (!t) {
      root._draft = null;
      set({ mode: "random", value: state.value });
      return;
    }
    const n = parse(t);
    if (n === null) {
      input.setAttribute("aria-invalid", "true");
      note.dataset.kind = "err";
      note.textContent = `只能填 0 到 ${MAX} 的整數`;
      return;
    }
    root._draft = null;
    // 打數字就是要固定：直接切過去，不用再按一次「固定」。
    set({ mode: "fixed", value: n });
  });
  input.addEventListener("blur", () => {
    if (root._draft != null) {
      root._draft = null;
      paint(root);
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) {
      e.stopPropagation();
      input.value = "";
      input.dispatchEvent(new Event("input"));
    }
  });

  root._parts = { rnd, fix, input, note };
  root._notes = { fixed: fixedNote, random: randomNote };
  mounted.add(root);
  paint(root);
  if (host) host.append(root);
  return root;
}

function paint(root) {
  const { rnd, fix, input, note } = root._parts;
  const fixed = isFixedSeed();
  root.dataset.mode = fixed ? "fixed" : "random";
  rnd.setAttribute("aria-checked", fixed ? "false" : "true");
  fix.setAttribute("aria-checked", fixed ? "true" : "false");
  rnd.tabIndex = fixed ? -1 : 0;
  fix.tabIndex = fixed ? 0 : -1;
  if (root._draft != null) return;
  input.removeAttribute("aria-invalid");
  input.placeholder = "每張隨機";
  if (document.activeElement !== input || fixed) input.value = fixed ? String(state.value) : "";
  delete note.dataset.kind;
  note.textContent = fixed ? root._notes.fixed : root._notes.random;
}

/**
 * 成品上的種子數字：點一下就把它設成固定種子。回傳一個按鈕（放在原本印 seed 的地方）。
 */
export function seedUseButton(seed, { prefix = "seed " } = {}) {
  ensureStyle();
  const b = h("button", { class: "seed-use", type: "button", title: "用這顆種子固定生圖" }, prefix + seed);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (useSeed(Number(seed))) {
      const old = b.textContent;
      b.textContent = "已固定成 " + seed;
      setTimeout(() => (b.textContent = old), 1400);
    }
  });
  return b;
}

// 同一個網站的另一個分頁改了，這裡跟著改（墨池和疊印台就是同一個網站）。
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  state = read();
  for (const node of mounted) paint(node);
  for (const fn of listeners) fn(seedState());
});
