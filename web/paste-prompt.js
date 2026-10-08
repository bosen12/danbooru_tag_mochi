/**
 * 貼上提示詞變成牌：把別處看到的一段提示詞（Civitai 的範例、別人的 POS）拆開，
 * 詞庫有的變成牌，放進合成池／卡池／卡盒。詞庫沒有的只列出來（可以複製），不另外記。
 *
 * 每一段照這個順序判斷：
 *   - 寫法不同但其實有：底線換空格、大小寫、權重括號 (tag:1.2)、((tag))、[tag]、跳脫的 \( \)、
 *     單複數、直接寫中文名（藍眼睛、黑色頭髮也對得到）—— 對到哪張就寫「原文 → 中文」。
 *   - 禁用的字（未成年相關，card-art.js 的 HARD_BANNED）：不收，跟抽牌的防護一致。
 *   - 詞庫有、但不是牌的字：引擎自己處理。
 *   - 畫質、評分詞（masterpiece、score_9…）：引擎會自己加，略過。
 *   - <lora:…>：不是牌，請到「選 LoRA」選。
 *   - 其他：詞庫沒有。
 */
import { el, openSheet, toast } from "./ui.js";
import { HARD_BANNED } from "./card-art.js";
import { enter, refuse, reducedMotion, DUR } from "./motion.js";
import { snapWeight } from "./weights.js";

/**
 * 這一段原本的份量：(tag:1.2) 照寫的；((tag)) 每層 ×1.1、[tag] 每層 ×0.9（SD 的寫法）。
 * 都對到五段之一（weights.js）。
 */
function weightOf(raw) {
  const s = raw.trim();
  const m = s.match(/:\s*(-?\d+(?:\.\d+)?)\s*[)\]}]*\s*$/);
  if (m && /^[([{]/.test(s)) return snapWeight(Number(m[1]));
  const up = (s.match(/^\(+/) || [""])[0].length;
  if (up) return snapWeight(1.1 ** up);
  const down = (s.match(/^\[+/) || [""])[0].length;
  if (down) return snapWeight(0.9 ** down);
  return 1;
}

const QUALITY = /^(score_\d+(_up)?|masterpiece|(best|amazing|high|good|normal|low|worst) quality|very aesthetic|aesthetic|absurdres|highres|lowres|newest|recent|year \d{4}|rating[ :_].*|nsfw|sfw|safe|general|sensitive|questionable|explicit|source_\w+|very awa|best aesthetic)$/;
const LORA = /<\s*lora\s*:\s*([^:>]+)[^>]*>/gi;

/** 一段字串的幾種寫法（最原本的先試）。 */
function variants(piece) {
  const base = piece
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  const unescaped = base.replace(/\\([()[\]{}])/g, "$1");
  // 拿掉外面一層層的權重括號跟 :1.2（跳脫過的括號是字的一部分，例如 yae miko \(fox\)）。
  let stripped = base;
  for (let i = 0; i < 6; i++) {
    const next = stripped
      .replace(/^[([{]+/, "")
      .replace(/:\s*-?[\d.]+\s*[)\]}]*$/, "")
      .replace(/(?<!\\)[)\]}]+$/, "")
      .trim();
    if (next === stripped) break;
    stripped = next;
  }
  stripped = stripped.replace(/\\([()[\]{}])/g, "$1");
  const out = [];
  for (const v of [unescaped, stripped]) {
    const spaced = v.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    for (const c of [v, spaced]) if (c && !out.includes(c)) out.push(c);
  }
  // 單複數：hands ↔ hand、glasses 不動（字典有就先對到原樣）。
  for (const c of [...out]) {
    if (c.endsWith("s")) out.push(c.slice(0, -1));
    else out.push(c + "s");
  }
  return out;
}

/**
 * 拆一段提示詞。
 *   lexTags：詞庫的每一個字（含不是牌的）；isCard(tag)：它是不是一張牌；zh(tag)：中文名。
 * 回傳 { cards: [{ tag, raw }], quality, loras, engine, blocked, unknown }（字串陣列；cards 照出現順序、不重複）。
 */
export function parsePrompt(text, { lexTags, isCard, zh }) {
  const byLower = new Map(lexTags.map((t) => [t.toLowerCase(), t]));
  const byZh = new Map(lexTags.filter(isCard).map((t) => [zh(t), t]));
  const hard = new Set(HARD_BANNED.map((t) => t.toLowerCase()));
  const res = { cards: [], quality: [], loras: [], engine: [], blocked: [], unknown: [] };
  const seen = new Set();
  const src = String(text || "").replace(LORA, (_, name) => {
    res.loras.push(name.trim());
    return ",";
  });
  // BREAK 是 SD 提示詞的分段語法，不是字：跟逗號一樣當分隔。
  for (const raw0 of src.split(/[,，、\n]+|\bBREAK\b/)) {
    const raw = raw0.trim();
    if (!raw) continue;
    const tries = variants(raw);
    let tag = null;
    for (const v of tries) {
      tag = byLower.get(v) || null;
      if (tag) break;
    }
    // 中文名：詞庫寫得短（藍眼、黑髮），口語常寫「藍眼睛」「藍色眼睛」「黑色頭髮」。
    if (!tag) {
      const z = raw.trim();
      const short = z.replace(/眼睛$/, "眼").replace(/頭髮$/, "髮").replace(/色(?=[髮眼])/, "");
      tag = byZh.get(z) || byZh.get(short) || null;
    }
    const key = (tag || tries[1] || raw).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (tag && (hard.has(tag.toLowerCase()) || HARD_BANNED.includes(tag))) res.blocked.push(raw);
    else if (tag && isCard(tag)) res.cards.push({ tag, raw, w: weightOf(raw) });
    else if (tag) res.engine.push(raw);
    else if (tries.some((v) => hard.has(v))) res.blocked.push(raw);
    else if (tries.some((v) => QUALITY.test(v))) res.quality.push(raw);
    else res.unknown.push(raw);
  }
  return res;
}

/**
 * 打開「貼上提示詞」面板。
 *   where：「合成池」「卡池」「卡盒」；text：先填好的內容（Ctrl+V 帶進來的）。
 *   lexTags、isCard、zh：同 parsePrompt。
 *   apply(tags, { replace, weights })：換成這些牌（replace）或加進去；weights 是貼上的份量 { tag: w }。
 *     面板先收起來再呼叫。
 *   off(tag)：這張牌現在用不了的原因（分級擋掉、在廢字簍…），沒有就回 null。
 *     預覽上先標出來，不要放進去才發現；照樣算「會變成牌」，放不放由各頁照原本的規矩。
 */
export function openPaste({ where, text = "", lexTags, isCard, zh, apply, off = () => null }) {
  const area = el("textarea", {
    class: "paste-text",
    rows: "5",
    placeholder: "貼上一段提示詞：1girl, (black_hair:1.2), school uniform, classroom…",
    "aria-label": "提示詞",
  });
  area.value = text;
  const result = el("div", { class: "paste-result", "aria-live": "polite" });
  const replaceBtn = el("button", { class: "btn btn-primary", type: "button" }, "換成這些牌");
  const addBtn = el("button", { class: "btn", type: "button" }, `加進${where}`);
  let parsed = null;

  const group = (title, items, kind, extra = null) =>
    items.length
      ? el(
          "section",
          { class: `paste-group is-${kind}` },
          el("h3", {}, `${title}・${items.length}`, extra),
          el("div", { class: "paste-chips" }, items)
        )
      : null;
  const chip = (text, title) => el("span", { class: "paste-chip", title: title || null }, text);

  const paint = () => {
    parsed = parsePrompt(area.value, { lexTags, isCard, zh });
    const n = parsed.cards.length;
    replaceBtn.disabled = !n;
    addBtn.disabled = !n;
    replaceBtn.textContent = n ? `換成這 ${n} 張牌` : "換成這些牌";
    if (!area.value.trim()) {
      result.replaceChildren(el("p", { class: "paste-note" }, `貼上之後，詞庫有的會變成牌放進${where}；畫質詞、LoRA、詞庫沒有的會分開列出來。`));
      return;
    }
    const copyBtn = parsed.unknown.length
      ? el(
          "button",
          {
            class: "link-btn pressable",
            type: "button",
            onclick: async (e) => {
              try {
                await navigator.clipboard.writeText(parsed.unknown.join(", "));
                e.currentTarget.textContent = "複製了";
              } catch {
                refuse(e.currentTarget);
              }
            },
          },
          "複製"
        )
      : null;
    result.replaceChildren(
      ...[
        group(
          "會變成牌",
          parsed.cards.map(({ tag, raw, w }) => {
            const name = zh(tag);
            const same = raw.toLowerCase() === tag.toLowerCase() || raw === name;
            const why = off(tag);
            // 帶份量的寫上數字（放進去之後牌的右下角也是這個數字）。
            const c = chip(`${same ? name : `${raw} → ${name}`}${w !== 1 ? ` ${w}` : ""}${why ? `（${why}）` : ""}`, tag);
            if (why) c.classList.add("is-off");
            return c;
          }),
          "cards"
        ),
        group("詞庫沒有（略過）", parsed.unknown.map((t) => chip(t)), "unknown", copyBtn),
        group("畫質、評分詞（引擎自己會加）", parsed.quality.map((t) => chip(t)), "muted"),
        group("LoRA（不是牌，請到「選 LoRA」選）", parsed.loras.map((t) => chip(t)), "muted"),
        group("不是牌（引擎自己處理）", parsed.engine.map((t) => chip(t)), "muted"),
        group("不收（禁用的字）", parsed.blocked.map((t) => chip(t)), "blocked"),
      ].filter(Boolean)
    );
    if (!parsed.cards.length) result.prepend(el("p", { class: "paste-note" }, "一張牌都對不上。"));
  };

  let timer = 0;
  area.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(paint, 120);
  });
  const { close } = openSheet("貼上提示詞變成牌", el("div", { class: "paste" }, area, result), { wide: true, foot: [replaceBtn, addBtn] });
  const go = (replace) => {
    const tags = parsed.cards.map((c) => c.tag);
    const weights = Object.fromEntries(parsed.cards.filter((c) => c.w !== 1).map((c) => [c.tag, c.w]));
    if (!tags.length) return refuse(replace ? replaceBtn : addBtn);
    close();
    setTimeout(() => apply(tags, { replace, weights }), DUR.short);
  };
  replaceBtn.addEventListener("click", () => go(true));
  addBtn.addEventListener("click", () => go(false));
  paint();
  if (!reducedMotion()) result.querySelectorAll(".paste-group").forEach((g, i) => enter(g, { delay: i * 40 }));
  requestAnimationFrame(() => {
    area.focus({ preventScroll: true });
    if (!text) area.select();
  });
}

/**
 * 電腦上在頁面空白處按 Ctrl+V（不是在輸入框裡）：剪貼簿像一段提示詞（有逗號），就打開面板帶進去。
 * open(text)：打開面板。
 */
export function listenPaste(open) {
  document.addEventListener("paste", (e) => {
    const t = e.target;
    if (t && (t.closest?.("input, textarea, select, [contenteditable]") || document.querySelector(".overlay"))) return;
    const text = e.clipboardData?.getData("text") || "";
    if (!text.includes(",") || text.length > 6000) return;
    e.preventDefault();
    open(text);
  });
}
