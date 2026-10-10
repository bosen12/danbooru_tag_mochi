import { messages, templates } from "./locales/en.js";
import { groups } from "./locales/groups.js";

export const language = globalThis.MochiLanguage?.resolve() || "zh-Hant";
export const english = language === "en";
export const dateLocale = english ? "en-US" : "zh-TW";
const stateKey = "mochi.language.state.v1";
export function takeLanguageState() {
  try {
    let snapshot;
    try { snapshot = JSON.parse(sessionStorage.getItem(stateKey) || "null"); sessionStorage.removeItem(stateKey); } catch { /* Fall back to the current history entry. */ }
    if (!snapshot) snapshot = history.state?.mochiLanguageState;
    if (history.state?.mochiLanguageState) {
      const state = { ...history.state };
      delete state.mochiLanguageState;
      history.replaceState(state, "");
    }
    return snapshot && snapshot.route === location.pathname && Date.now() - snapshot.at < 120000 ? snapshot.state : null;
  } catch { return null; }
}
const labels = new Map();
const han = /[\u3400-\u9fff]/;
const excluded = "script, style, code, pre, textarea, input, [contenteditable], [data-no-i18n]";
const attrs = ["title", "aria-label", "aria-description", "placeholder", "alt"];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compiled = [...templates].sort((a, b) => b[0].replace(/\{\d+\}/g, "").length - a[0].replace(/\{\d+\}/g, "").length).map(([source, target]) => {
  const parts = source.split(/\{\d+\}/);
  return { re: new RegExp("^" + parts.map(escape).join("([\\s\\S]*?)") + "$"), target };
});
// Chinese counters have no plural; English units after a lone 1 read singular.
const singular = { uses: "use", images: "image", cards: "card", items: "item", days: "day", times: "time", proofs: "proof", additions: "addition", achievements: "achievement", categories: "category", subcategories: "subcategory", steps: "step", slots: "slot", seconds: "second", models: "model", minutes: "minute", hours: "hour", groups: "group", generations: "generation", conflicts: "conflict", checkpoints: "checkpoint", LoRAs: "LoRA" };
const one = new RegExp(`(^|[^\\d.,/])1 ((?:[a-z]+ )?)(${Object.keys(singular).join("|")})\\b`, "g");
// 「紅髮（red hair）」 translates to "red hair (red hair)"; say the name once.
const echo = /(^|[·:\n]\s*)([^()·:\n]+?) \(\2\)/g;

export function registerLexicon(data) {
  for (const item of data.tags || []) if (item.zh && !labels.has(item.zh)) labels.set(item.zh, item.tag);
  for (const [id, zh] of Object.entries(data.groupZh || {})) {
    const en = groups[id] || id.replace(/_/g, " ").replace(/\b\w/, (c) => c.toUpperCase());
    if (!messages[zh]) labels.set(zh, en);
    const parts = zh.split("・"), names = en.split(" · ");
    if (parts.length === 2) {
      labels.set(parts[0], names[0]);
      labels.set(parts[1], names[1] || en);
    }
  }
}

/** Translate presentation text only; canonical tags and editable values stay untouched. */
export function t(value) {
  const source = String(value ?? "");
  if (!english || !han.test(source)) return source;
  return translate(source, 0).replace(one, (_, pre, adj, unit) => `${pre}1 ${adj}${singular[unit]}`).replace(echo, "$1$2");
}

function translate(source, depth) {
  if (!han.test(source)) return source;
  const trim = source.trim();
  // A function replacement: user content may contain "$&" and similar patterns.
  const keep = (text) => source.replace(trim, () => text);
  const exact = messages[trim] ?? labels.get(trim);
  if (exact !== undefined) return keep(exact);
  if (depth < 4) {
    for (const { re, target } of compiled) {
      const match = trim.match(re);
      if (match) return keep(target.replace(/\{(\d+)(!?)\}/g, (_, i, verbatim) => verbatim ? match[Number(i) + 1] : translate(match[Number(i) + 1], depth + 1)));
    }
    // UI summaries compose independently translated values with these separators.
    if (/[・·\n、]/.test(trim)) return source.split(/([・·\n、])/).map((part) => /[・·\n、]/.test(part) ? part.replace("・", " · ").replace("、", ", ") : translate(part, depth + 1)).join("");
    if (/^[（(].*[）)]$/.test(trim)) return "(" + translate(trim.slice(1, -1), depth + 1) + ")";
    if (trim.endsWith("…")) return translate(trim.slice(0, -1), depth + 1) + "…";
    const weighted = trim.match(/^(.+?)(\s+\d+(?:\.\d+)?)$/);
    if (weighted) return translate(weighted[1], depth + 1) + weighted[2];
    if (/^「.*」$/.test(trim)) return trim.replace(/「([^「」]+)」/g, (_, tag) => "“" + translate(tag, depth + 1) + "”");
  }
  return source;
}

// Suit and group seals show one Chinese character. In English they become letters, never the
// dictionary word for that character (風 is the Style seal, not "wind"). Applied to the element and
// again to its text node, because some rooms fill a seal's text after inserting it.
const GLYPH_SEL = ".card-suit, .tab-dot, .reg-glyph, .suit-seal, .suit-glyph, .suit-tab > b, .chip-seal, .card-peek-suit, .card-peek-seal, .ach-suit-glyph, .ach-medal, .tchip > b, .rk, .chip > b, .plate-head > b, b.tb.tl";
const GLYPHS = { 人: "C", 角: "R", 容: "A", 衣: "W", 姿: "P", 景: "S", 風: "F", 動: "A", 身: "B", 鏡: "C", 表: "E", 視: "G", 誘: "T", 走: "X", 性: "X", 上: "T", 下: "B", 外: "O", 連: "D", 內: "U", 襪: "L", 鞋: "F", 飾: "A", 材: "M", 時: "E", 裸: "N", 色: "C", 長: "L", 型: "H", 眼: "E", 膚: "S", 妝: "M", 體: "B", 職: "J", 族: "R", 地: "L", 光: "L", 背: "B", 效: "F", 晝: "T", 天: "S", 氣: "W", 室: "I", 坐: "F", 女: "F", 男: "M" };
const MEDALS = { 牌: "C", 門: "S", 花: "F", 友: "★", 手: "+", 印: "P", 藏: "★", 眼: "✓", 日: "D", 百: "100", 夜: "N" };
function glyph(node) {
  if (!node.matches(GLYPH_SEL)) return false;
  const map = node.matches(".ach-medal") ? MEDALS : GLYPHS;
  if (map[node.textContent]) node.textContent = map[node.textContent];
  return true;
}

export function translateTree(root) {
  if (!english || !root) return root;
  const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [];
  for (const node of elements) {
    if (node.closest("script, style, [data-no-i18n], [contenteditable]")) continue;
    if (node.matches(".card-rate, .card-peek-rate")) {
      const rates = { 色: "E", 敏: "S" };
      if (rates[node.textContent]) node.textContent = rates[node.textContent];
    }
    glyph(node);
    for (const attr of attrs) {
      if (!node.hasAttribute(attr)) continue;
      const source = node.getAttribute(attr), result = t(source);
      if (result !== source) node.setAttribute(attr, result);
    }
    if (node.matches("meta[name='description'], meta[name='apple-mobile-web-app-title']")) {
      const source = node.content, result = t(source);
      if (result !== source) node.content = result;
    }
  }
  const texts = root.nodeType === 3 ? [root] : (() => {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    while (walk.nextNode()) list.push(walk.currentNode);
    return list;
  })();
  for (const node of texts) {
    if (!node.parentElement || node.parentElement.closest(excluded)) continue;
    if (glyph(node.parentElement)) continue;
    // A lone character in an element that is not in the page yet may be a seal: ui.js el()
    // translates before the element has a parent, so it cannot tell yet. Wait for insertion;
    // the observer translates it then, with its context.
    if (!node.isConnected && /^[㐀-鿿]$/.test(node.data.trim())) continue;
    let result = t(node.data);
    // A counter in its own node (<b>1</b><span>次</span>) reads the number beside it.
    const unit = result.trim();
    if (singular[unit] && (node.previousSibling ?? node.parentElement.previousSibling)?.textContent.trim() === "1") result = result.replace(unit, singular[unit]);
    if (result !== node.data) node.data = result;
  }
  return root;
}

function mountLanguage() {
  if (document.querySelector("#language-select")) return;
  const host = document.querySelector(".mast-primary") || document.querySelector(".gate-inner");
  if (!host) return;
  const label = document.createElement("label");
  label.className = "language-picker";
  label.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>';
  const select = document.createElement("select");
  select.id = "language-select";
  select.setAttribute("aria-label", english ? "Interface language" : "介面語言");
  // This control is created before late stylesheets may finish loading. Keep
  // its bilingual option labels on system fonts from the first frame.
  select.style.fontFamily = '"Segoe UI", "Microsoft JhengHei", sans-serif';
  for (const [value, text] of [["auto", english ? "Auto" : "自動"], ["zh-Hant", "繁體中文"], ["en", "English"]]) {
    const option = document.createElement("option");
    option.value = value; option.textContent = text; select.append(option);
  }
  select.value = globalThis.MochiLanguage?.preference() || "auto";
  select.title = english ? "Auto follows your browser language. Changes apply to every page." : "自動依瀏覽器語言選擇；切換會套用到所有頁面。";
  label.dataset.noI18n = "";
  label.append(select); host.append(label);
  select.addEventListener("change", () => {
    const detail = { state: null };
    dispatchEvent(new CustomEvent("mochi:before-language-change", { detail }));
    const snapshot = { route: location.pathname, at: Date.now(), state: detail.state };
    try { sessionStorage.setItem(stateKey, JSON.stringify(snapshot)); }
    catch {
      try { history.replaceState({ ...history.state, mochiLanguageState: snapshot }, ""); } catch { /* Optional browser storage is unavailable. */ }
    }
    globalThis.MochiLanguage?.set(select.value);
    // Workbench listeners preserve otherwise transient pins and proof seeds.
    // Reload recreates every UI widget consistently, including animated film captions.
    location.reload();
  });
}

function start() {
  mountLanguage();
  if (english) {
    const wordmark = document.querySelector(".wordmark");
    if (wordmark) wordmark.textContent = "Danbooru Case";
    // Shared workflow dialogs call the native confirmation API.
    const confirm = globalThis.confirm?.bind(globalThis);
    if (confirm) globalThis.confirm = (text) => confirm(t(text));
  }
  translateTree(document.documentElement);
  delete document.documentElement.dataset.languagePending;
  if (!english) return;
  const observer = new MutationObserver((records) => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === "childList") for (const node of record.addedNodes) roots.add(node);
      else roots.add(record.target);
    }
    // Observe only presentation text and the five UI attributes, never animation styles.
    for (const node of roots) if (node.isConnected) translateTree(node);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attrs });
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
