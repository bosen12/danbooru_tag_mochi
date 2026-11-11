/**
 * 每種底模自己的生圖參數（Steps、CFG、採樣器、排程）。
 *
 * Illustrious／NoobAI、Pony、Anima、Krea 2、Z-Image 的最佳參數差很多（Krea 2、Z-Image Turbo 是 8 步、CFG 1；
 * Anima 30 步 er_sde），以前只有一套「生圖」的 Steps／CFG 給所有底模用，換底模就要記得改回來。
 * 現在每家各存一套，底模視窗裡選了哪顆就顯示它那一家的（lora.js 畫）；生圖時把所有改過的都送給伺服器
 * （payload.familySampling），伺服器挑這次底模的家族那一份（server.py）。
 *
 * 只存「改過的」：沒改的不送，伺服器用自己的預設（config.json 的 models.<家族>.*），預設換了這裡跟著換。
 * 存在 localStorage：每台裝置自己一份，跟原本的取樣參數一樣。
 */

const STORE = "mochi.family-sampling.v1";
const LEGACY_STORE = "yz-sampling";

export const FAMILIES = ["illustrious", "pony", "anima", "krea2", "zimage"];
export const FAMILY_LABEL = {
  illustrious: "Illustrious／NoobAI",
  pony: "Pony",
  anima: "Anima",
  krea2: "Krea 2",
  zimage: "Z-Image",
};

/* 伺服器還沒回話（或是舊版伺服器沒有 families）時顯示用的預設；實際以 /api/sampling 為準。 */
const FALLBACK = {
  illustrious: { steps: 25, cfg: 6.5, sampler: "euler_ancestral", scheduler: "normal" },
  pony: { steps: 25, cfg: 6.5, sampler: "euler_ancestral", scheduler: "normal" },
  anima: { steps: 30, cfg: 4, sampler: "er_sde", scheduler: "simple" },
  krea2: { steps: 8, cfg: 1, sampler: "euler", scheduler: "simple" },
  zimage: { steps: 8, cfg: 1, sampler: "res_multistep", scheduler: "simple" },
};
const LIMITS = { steps: [1, 80], cfg: [1, 15] };
const NUM = {
  steps: { zh: "Steps", step: 1, digits: 0 },
  cfg: { zh: "CFG", step: 0.5, digits: 1 },
};

let changed = Object.fromEntries(FAMILIES.map((f) => [f, {}]));
let defaults = null;
let defaultsAsk = null;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (raw && typeof raw === "object") return raw;
    // 第一次：以前工作流面板「生圖」那一行改過的 Steps／CFG 搬到 Illustrious 和 Pony（以前就是套在它們身上）。
    const old = JSON.parse(localStorage.getItem(LEGACY_STORE) || "{}")?.base || {};
    const keep = {};
    for (const k of ["steps", "cfg"]) if (Number.isFinite(old[k])) keep[k] = old[k];
    return Object.keys(keep).length ? { illustrious: { ...keep }, pony: { ...keep } } : {};
  } catch {
    return {};
  }
}

(() => {
  const raw = read();
  for (const f of FAMILIES) {
    const src = raw[f] && typeof raw[f] === "object" ? raw[f] : {};
    for (const k of ["steps", "cfg"]) if (Number.isFinite(src[k])) changed[f][k] = src[k];
    for (const k of ["sampler", "scheduler"]) if (typeof src[k] === "string" && src[k]) changed[f][k] = src[k];
  }
})();

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(changed));
  } catch {
    /* 無痕模式：這次有效 */
  }
}

/**
 * LoRA Manager 的 base_model（Illustrious、NoobAI、Pony、Anima、Krea 2、ZImageTurbo…）→ 家族；不認得回 null。
 * 跟伺服器的 prompt_formats.family_of_base 同一套：Flux.1 Krea 不是 Krea 2，只認 krea2。
 */
export function familyOfBase(base) {
  const b = String(base || "").toLowerCase().replace(/[\s._-]+/g, "");
  if (!b) return null;
  if (b.includes("pony")) return "pony";
  if (b.includes("illustrious") || b.includes("noobai") || b.includes("sdxl")) return "illustrious";
  if (b.includes("anima")) return "anima";
  if (b.includes("krea2")) return "krea2";
  if (b.includes("zimage")) return "zimage";
  return null;
}

/** 底模的家族；不認得的當 Illustrious（伺服器也是這樣）。 */
export function familyOf(format) {
  return FAMILIES.includes(format) ? format : "illustrious";
}

/** 生圖時帶上：所有家族改過的（伺服器挑這次底模的那一份）。沒改過就是空物件，什麼都不送。 */
export function familySamplingPayload() {
  const out = {};
  for (const f of FAMILIES) if (Object.keys(changed[f]).length) out[f] = { ...changed[f] };
  return Object.keys(out).length ? { familySampling: out } : {};
}

/** 這一家有沒有改過（底模卡片上標一個小點用）。 */
export function familyChanged(family) {
  return Object.keys(changed[familyOf(family)] || {}).length > 0;
}

/** /api/sampling：各家預設、ComfyUI 的採樣器、排程清單。只問一次。 */
export function loadFamilyDefaults() {
  if (defaults) return Promise.resolve(defaults);
  if (!defaultsAsk) {
    defaultsAsk = fetch("/api/sampling", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => {
        defaults = {
          families: { ...FALLBACK, ...(j?.families || {}) },
          samplers: Array.isArray(j?.samplers) ? j.samplers : [],
          schedulers: Array.isArray(j?.schedulers) ? j.schedulers : [],
          live: !!j?.families,
        };
        return defaults;
      });
  }
  return defaultsAsk;
}

const defOf = (family, k) => (defaults?.families?.[family] || FALLBACK[family] || {})[k];

/**
 * 底模視窗裡的那一格：「生圖參數 · Krea 2」＋四個欄位＋恢復預設。
 * family 是底模的 format；onChange 在改了之後叫（讓外面重畫小點之類）。
 */
export function familySamplingBlock(format, { onChange } = {}) {
  const family = familyOf(format);
  const box = document.createElement("section");
  box.className = "fam-samp";
  box.dataset.family = family;
  box.setAttribute("aria-label", `${FAMILY_LABEL[family]} 的生圖參數`);

  const head = document.createElement("div");
  head.className = "fam-samp-head";
  const title = document.createElement("span");
  title.className = "fam-samp-title";
  const titleText = document.createElement("span");
  titleText.textContent = "生圖參數";
  title.append(titleText, " · ");
  const fam = document.createElement("b");
  fam.dataset.noI18n = "";
  fam.textContent = FAMILY_LABEL[family];
  title.append(fam);
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "fam-samp-reset";
  reset.textContent = "恢復預設";
  head.append(title, reset);

  const grid = document.createElement("div");
  grid.className = "fam-samp-grid";
  const note = document.createElement("p");
  note.className = "fam-samp-note";
  note.textContent = `${FAMILY_LABEL[family]} 的底模都用這一套；換成別家的底模會換成那一家的。改過的會描一道底線。`;
  box.append(head, grid, note);

  const syncReset = () => {
    reset.disabled = !Object.keys(changed[family]).length;
  };
  const commit = (k, v) => {
    const def = defOf(family, k);
    const same = typeof v === "number" ? def != null && Math.abs(v - def) < 1e-9 : v === def;
    if (v == null || v === "" || same) delete changed[family][k];
    else changed[family][k] = v;
    save();
    syncReset();
    onChange?.(family);
  };

  const field = (k, control) => {
    const wrap = document.createElement("label");
    wrap.className = "fam-samp-field";
    wrap.dataset.key = k;
    const name = document.createElement("span");
    name.textContent = k === "sampler" ? "採樣器" : k === "scheduler" ? "排程" : NUM[k].zh;
    wrap.append(name, control);
    const mark = () => {
      wrap.dataset.changed = changed[family][k] != null ? "true" : "false";
      const def = defOf(family, k);
      wrap.title = def != null ? `預設 ${typeof def === "number" ? Number(def).toFixed(NUM[k]?.digits ?? 0) : def}` : "";
    };
    mark();
    wrap._mark = mark;
    return wrap;
  };

  const fields = [];
  const paint = () => {
    grid.replaceChildren();
    fields.length = 0;
    for (const k of ["steps", "cfg"]) {
      const f = NUM[k];
      const [lo, hi] = LIMITS[k];
      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "decimal";
      input.min = String(lo);
      input.max = String(hi);
      input.step = String(f.step);
      input.setAttribute("aria-label", `${FAMILY_LABEL[family]} ${f.zh}`);
      const def = defOf(family, k);
      const shown = changed[family][k] ?? def;
      input.value = shown == null ? "" : Number(shown).toFixed(f.digits);
      if (def != null) input.placeholder = Number(def).toFixed(f.digits);
      const wrap = field(k, input);
      input.addEventListener("change", () => {
        const v = parseFloat(input.value);
        let val = null;
        if (Number.isFinite(v)) {
          const c = Math.min(hi, Math.max(lo, f.digits ? Math.round(v / f.step) * f.step : Math.round(v)));
          val = Number(c.toFixed(f.digits));
        }
        commit(k, val);
        const now = changed[family][k] ?? defOf(family, k);
        input.value = now == null ? "" : Number(now).toFixed(f.digits);
        wrap._mark();
      });
      fields.push(wrap);
      grid.append(wrap);
    }
    for (const k of ["sampler", "scheduler"]) {
      const sel = document.createElement("select");
      sel.className = "fam-samp-select";
      sel.setAttribute("aria-label", `${FAMILY_LABEL[family]} ${k === "sampler" ? "採樣器" : "排程"}`);
      const def = defOf(family, k);
      const cur = changed[family][k] ?? def;
      // ComfyUI 連不上時沒有清單：至少放預設和目前的那個，選單不會是空的。
      const list = [...new Set([...(k === "sampler" ? defaults?.samplers : defaults?.schedulers) || [], def, cur].filter(Boolean))];
      for (const name of list) {
        const o = document.createElement("option");
        o.value = name;
        // 名字本身（euler、karras…）不翻；「（預設）」英文版會換成 (default)（en.js 的 {0!}（預設））。
        o.textContent = name === def ? `${name}（預設）` : name;
        if (name !== def) o.dataset.noI18n = "";
        sel.append(o);
      }
      if (cur) sel.value = cur;
      const wrap = field(k, sel);
      sel.addEventListener("change", () => {
        commit(k, sel.value);
        wrap._mark();
      });
      fields.push(wrap);
      grid.append(wrap);
    }
    syncReset();
  };
  reset.addEventListener("click", () => {
    changed[family] = {};
    save();
    paint();
    onChange?.(family);
    (grid.querySelector("input, select") || reset).focus?.({ preventScroll: true });
  });
  paint();
  // 預設、ComfyUI 的採樣器清單晚一點才到：到了再畫一次（焦點不在裡面才重畫，打字打到一半不會被洗掉）。
  if (!defaults) {
    loadFamilyDefaults().then(() => {
      if (box.isConnected && !box.contains(document.activeElement)) paint();
    });
  }
  return box;
}
