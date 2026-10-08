import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { focusEntry } from "./focus-entry.js";

const $ = (id) => document.getElementById(id);
const REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

const LORA_MGR_LOGO_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAA/lJREFUWEeVV0trFEEQ/ubiRRQPInoTDwo+jhpRRAUR4wNFkywBEdw1ia+LBxUVRUHwIir4QPABIngTPHry5i/IWcFHdteYRCKJm5np7ZLu6Z7p6emenexhd7anp+urqq++qgnGv7cIAAIQCIG4lP8AuZz/iCW9xbuTAArUPvO6eJy0lADQxrRhy4oTkgON20bpqgEgMZr5rnDJZRNQb68Sh4pOmEhSV3UK5E35nOthY41InZ03kAIvnOEDkzgSjH9rEoIgB9rNgOpe9Y5AdpZKgfBeeyYcFJQs+/QAk95WFyXbg/HvTWXZJKI23tvrDGbJ3hygPKcMACkJHK6bHDDqzxUkGUmLgC5uKX+zFOQO0xWgDiLgwqX7aH/5AeIhunGEE7V+nGoM9GR7cmzigMmt5JqEDugUON1JJIoIpy89QOvrT+DvHMAXMDh8EGfODaeHV6g8J6kcEdDhzn5FVOuXH6P5ow3MzAJxiKHh/WiMDZUw1dILOzUyBSIC3xIpznRDM1f9igolQv3KU0y0p0CMIZifR+3wLjRGj7sBuIx5dCmJgElgB4kEgMbV55hoT4I4R9DpoHZgJ+pnjmbSKQQs7QHVNdlNQquiBICRay8w0ZoCUQyKGWr7tqHeOKI4ZjDfrkajAnIyL0IuHstJsY9JBIxcfyUBcGIgYhjq34nG8D43scxeKiIqKkCJrV1smRTbd6xmMnrjDX42pwAw8C7D4KE+NGoKwGL0yrRTjIBHjAgYvfkWrfY0OGcgzjBwsA/1ob1WBOwK6i3nnjLUZZEcKL7Hbr1Dsz2NgHNwFmHg0DacHtxdsQoc6qh89Sih7Rhh7O57tFrT4HEEdBm2blmL3X3rZRMj4jIqq1auwOaN6/xSbqSqOA842KurSvDo7L0PaP36A4oiUBwi4F10WQxiMTgLwaMQS8I5PHx0Ges3rPXEvtjoEyFyiYRkr8hAIsXnH35EszkjhYjCBZCIBGMyIpwtAFEEPjOFNauX48nL21i2bKmzB6TIdHXky1DdLugAcOHZJ0zO/pOeR9Oz4J0OKFoAOCkQISjsgDpz2L5jE+7cGlVNsWQ0k1WgJyJn0LKB4uLrz/g9O48AHOHkH/BOCEQhKBLp4LJD8lgAYujyGCMn92Pg2B6llHpKLhrxp8ASJS4Ika5Z7cOX8fK5NMmwMwW2InqHDCtluZ7iaHAZAdKb/nnAp26VVM/oqPZ0JEFkgiUjIINrHex5N6re5hw79RSU2FfvIXkSqtIz22olj7W1jLSpfWnHGvGM7X4lzBnu0etLWnDpO0JShmoi0vLvack6Tc62uojE2Kmt1gs0cYzcLcJm6dYCgAL5CqVVgRTOLVoUFM8UrP/DbkWRXoaOTQAAAABJRU5ErkJggg==";

// ComfyUI 的 LoRA Manager（custom node）：/api/loras、/api/checkpoints 有它就給它的網址。
// 伺服器看到的是 127.0.0.1:8188；手機走 Tailscale 開網頁時，換成這一頁的主機名才連得到。
let LORA_MGR_URL = "";
let CKPT_MGR_URL = "";
function reachable(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const loop = (h) => ["127.0.0.1", "localhost", "[::1]", "::1"].includes(h);
    if (loop(u.hostname) && !loop(location.hostname)) u.hostname = location.hostname;
    return u.href;
  } catch {
    return "";
  }
}
function syncManagerLinks() {
  for (const [id, url] of [["lm-manager-link", LORA_MGR_URL], ["ckpt-manager-link", CKPT_MGR_URL]]) {
    const a = $(id);
    if (!a) continue;
    a.hidden = !url;
    if (url) a.href = url;
  }
}
const GEN_LORA_PAGE_SIZE = 80;

let GEN_LORAS = null;
const GEN_LORA_SLOTS = [
  { lora: null, strength: 0.8, twPicks: new Set() },
  { lora: null, strength: 0.8, twPicks: new Set() },
];
let GEN_ACTIVE_SLOT = 0;
let GEN_LORA_PAGE = 0;
const GEN_LORA_SLOT_SCOPE = [
  { cat: "all", subfolder: "" },
  { cat: "all", subfolder: "" },
];

const CKPT_STORE = "yz-ckpt";
let GEN_CKPTS = null;
let GEN_CKPT_SOURCE = "";
let GEN_CKPT = "";
try {
  GEN_CKPT = localStorage.getItem(CKPT_STORE) || "";
} catch {
  GEN_CKPT = "";
}

export function currentCkpt() {
  return GEN_CKPT || "";
}

export function invalidateModelLists() {
  GEN_LORAS = null;
  GEN_CKPTS = null;
}

function curSlot() {
  return GEN_LORA_SLOTS[GEN_ACTIVE_SLOT];
}
function otherSlotIndex() {
  return GEN_ACTIVE_SLOT === 0 ? 1 : 0;
}
function curScope() {
  return GEN_LORA_SLOT_SCOPE[GEN_ACTIVE_SLOT];
}
function setActiveSlot(i) {
  GEN_ACTIVE_SLOT = i;
  renderLmCats();
  renderLmSubcats();
}

// 這裡的彈窗以前不鎖背景捲動，可是 boot.js / telegram.js / discord.js 的解鎖
// 條件裡都寫著「.lora-modal.open 還開著就別解」—— 也就是本來就假設它會鎖。
// 少的那一個正是這種不一致的來源，補上。
function overlayOpen(el) {
  if (!el) return;
  el._closeGen = (el._closeGen || 0) + 1;
  delete el.dataset.closing;
  el.classList.remove("is-closing");
  el.inert = false;
  // 記住是誰打開的：關掉時焦點要回到那裡，不能留在已經藏起來的搜尋框上。
  // 已經開著再開一次（焦點在裡面）不覆寫。
  const from = document.activeElement;
  if (from && from !== document.body && !el.contains(from)) el._returnFocus = from;
  el.classList.add("open");
  markPress(el);
  lockScroll(el.id || "lora-overlay");
}

function markPress(root) {
  if (typeof root?.querySelectorAll !== "function") return;
  for (const button of root.querySelectorAll("button")) button.classList.add("pressable");
}
function fadeCloseOverlay(el, _inner, onDone, msOverride) {
  if (!el || !el.classList.contains("open") || el.dataset.closing === "1") return;
  const gen = (el._closeGen = (el._closeGen || 0) + 1);
  el.dataset.closing = "1";
  el.classList.add("is-closing");
  el.inert = true;
  const ms = REDUCE_MOTION ? 0 : msOverride != null ? msOverride : 180;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (el._closeGen !== gen) return;
    delete el.dataset.closing;
    el.classList.remove("open", "is-closing");
    unlockScroll(el.id || "lora-overlay");
    // 焦點回到打開它的地方。要在 unlockScroll 之後：開著時背景（頂欄）是 inert 的，
    // 對裡面的鈕 focus() 會靜靜失敗。只在焦點還在浮層裡（或已經掉到 body）時才還 ——
    // 使用者自己點到別處的話不搶。
    const back = el._returnFocus;
    el._returnFocus = null;
    const at = document.activeElement;
    if (back && back.isConnected && (el.contains(at) || !at || at === document.body)) back.focus({ preventScroll: true });
    if (onDone) onDone();
  };
  setTimeout(finish, ms);
}

let _toastT = null;
function toast(msg, isError) {
  const t = $("lora-toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  t.classList.toggle("error", !!isError);
  t.setAttribute("role", isError ? "alert" : "status");
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove("show"), 2600);
}

async function fetchGenLoras() {
  if (GEN_LORAS) return GEN_LORAS;
  try {
    const got = await fetch("/api/loras").then((r) => r.json());
    if (!got.error) GEN_LORAS = got.items || [];
    LORA_MGR_URL = reachable(got.manager);
    syncManagerLinks();
    // 伺服器會講為什麼是空的（沒設定 paths.loraRoot、資料夾不存在、改問 ComfyUI
    // 也失敗…）。不轉述的話使用者只看到一個空面板，沒有線索。
    if (got.error) toast("LoRA：" + got.error, true);
    else if (got.note) toast("LoRA：" + got.note);
  } catch (e) {
    toast("LoRA 清單載入失敗：" + e.message, true);
  }
  return GEN_LORAS || [];
}

function loraPreviewUrl(l) {
  if (l.previewUrl) return l.previewUrl;
  return `/api/lora-preview?folder=${encodeURIComponent(l.folder)}&file=${encodeURIComponent(l.preview)}`;
}
function isLoraPreviewVideo(l) {
  const n = (l.preview || "").toLowerCase();
  return n.endsWith(".mp4") || n.endsWith(".webm");
}

const _PREVIEW_MAX_CONCURRENT = 4;
let _previewActive = 0;
const _previewQueue = [];
function _previewRunNext() {
  if (_previewActive >= _PREVIEW_MAX_CONCURRENT) return;
  const job = _previewQueue.shift();
  if (!job) return;
  _previewActive++;
  job(() => {
    _previewActive--;
    _previewRunNext();
  });
}
function _previewEnqueue(job) {
  _previewQueue.push(job);
  _previewRunNext();
}
const _PREVIEW_RETRY_DELAYS_MS = [600, 1800, 4500];
function _previewStart(el, done) {
  const src = el.dataset.src;
  delete el.dataset.src;
  if (!src) {
    done();
    return;
  }
  let settled = false;
  const settleOnce = () => {
    if (!settled) {
      settled = true;
      done();
    }
  };
  const attemptLoad = (attempt) => {
    const onSettled = () => {
      el.removeEventListener("load", onSettled);
      el.removeEventListener("loadeddata", onSettled);
      el.removeEventListener("error", onError);
      settleOnce();
    };
    const onError = () => {
      el.removeEventListener("load", onSettled);
      el.removeEventListener("loadeddata", onSettled);
      el.removeEventListener("error", onError);
      settleOnce();
      if (attempt < _PREVIEW_RETRY_DELAYS_MS.length) {
        setTimeout(() => attemptLoad(attempt + 1), _PREVIEW_RETRY_DELAYS_MS[attempt]);
      }
    };
    el.addEventListener("load", onSettled);
    el.addEventListener("loadeddata", onSettled);
    el.addEventListener("error", onError);
    el.src = attempt === 0 ? src : src + (src.includes("?") ? "&" : "?") + "_retry=" + attempt;
    if (el.tagName === "VIDEO") el.play().catch(() => {});
  };
  attemptLoad(0);
}
const _loraPreviewIO = new IntersectionObserver(
  (entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      obs.unobserve(entry.target);
      _previewEnqueue((done) => _previewStart(entry.target, done));
    }
  },
  { rootMargin: "300px" }
);

function makeLoraPreviewEl(l) {
  let el;
  if (isLoraPreviewVideo(l)) {
    el = document.createElement("video");
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.preload = "none";
  } else {
    el = document.createElement("img");
    el.alt = "";
    el.decoding = "async";
  }
  el.dataset.src = loraPreviewUrl(l);
  _loraPreviewIO.observe(el);
  return el;
}

function renderLmCats() {
  const box = $("lm-cats");
  if (!box) return;
  const items = GEN_LORAS || [];
  const counts = {};
  for (const l of items) counts[l.category] = (counts[l.category] || 0) + 1;
  const folders = Object.keys(counts).sort();
  box.replaceChildren();
  const mk = (key, label, n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lm-cat" + (curScope().cat === key ? " on" : "");
    b.setAttribute("aria-pressed", curScope().cat === key ? "true" : "false");
    const lb = document.createElement("span");
    lb.textContent = label;
    const nb = document.createElement("span");
    nb.className = "lm-cat-n";
    nb.textContent = n;
    b.append(lb, nb);
    b.addEventListener("click", () => {
      const focused = document.activeElement === b;
      curScope().cat = key;
      curScope().subfolder = "";
      renderLmCats();
      renderLmSubcats();
      renderLmList($("lm-search").value, true);
      if (focused) $("lm-cats")?.querySelector?.('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    box.appendChild(b);
  };
  mk("all", "全部", items.length);
  folders.forEach((f) => mk(f, f, counts[f]));
  markPress(box);
}

function renderLmSubcats() {
  const box = $("lm-subcats");
  if (!box) return;
  box.replaceChildren();
  if (curScope().cat === "all") return;
  const items = (GEN_LORAS || []).filter((l) => l.category === curScope().cat);
  const counts = {};
  for (const l of items) counts[l.folder] = (counts[l.folder] || 0) + 1;
  const subfolders = Object.keys(counts).sort();
  if (subfolders.length <= 1) return;
  const mk = (key, label, n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lm-subcat" + (curScope().subfolder === key ? " on" : "");
    b.setAttribute("aria-pressed", curScope().subfolder === key ? "true" : "false");
    const lb = document.createElement("span");
    lb.textContent = label;
    const nb = document.createElement("span");
    nb.className = "lm-subcat-n";
    nb.textContent = n;
    b.append(lb, nb);
    b.addEventListener("click", () => {
      const focused = document.activeElement === b;
      curScope().subfolder = key;
      renderLmSubcats();
      renderLmList($("lm-search").value, true);
      if (focused) $("lm-subcats")?.querySelector?.('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    box.appendChild(b);
  };
  mk("", "全部", items.length);
  subfolders.forEach((f) => {
    const label = f === curScope().cat ? "(根目錄)" : f.slice(curScope().cat.length + 1);
    mk(f, label, counts[f]);
  });
  markPress(box);
}

function loraCatPool() {
  return (GEN_LORAS || []).filter(
    (l) =>
      (curScope().cat === "all" || l.category === curScope().cat) &&
      (!curScope().subfolder || l.folder === curScope().subfolder)
  );
}
function loraCatLabel() {
  if (curScope().subfolder) {
    return curScope().subfolder === curScope().cat ? curScope().cat : curScope().subfolder;
  }
  return curScope().cat === "all" ? null : curScope().cat;
}

function renderLmList(filter, resetPage) {
  const box = $("lm-list");
  if (!box) return;
  if (resetPage) GEN_LORA_PAGE = 0;
  const q = (filter || "").toLowerCase().trim();
  let items = loraCatPool();
  if (q) {
    items = items
      .map((l) => {
        const nameHit = l.name.toLowerCase().includes(q) || (l.title || "").toLowerCase().includes(q);
        const twHit = (l.trainedWords || []).join(" ").toLowerCase().includes(q);
        return { l, tier: nameHit ? 0 : twHit ? 1 : -1 };
      })
      .filter((x) => x.tier >= 0)
      .sort((a, b) => a.tier - b.tier)
      .map((x) => x.l);
  }
  box.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "lora-empty";
    empty.textContent = "找不到 LoRA";
    box.appendChild(empty);
    box.dataset.result = "empty";
    return;
  }
  box.dataset.result = "found";
  const pages = Math.ceil(items.length / GEN_LORA_PAGE_SIZE);
  if (GEN_LORA_PAGE >= pages) GEN_LORA_PAGE = pages - 1;
  if (GEN_LORA_PAGE < 0) GEN_LORA_PAGE = 0;
  const page = GEN_LORA_PAGE;
  const shown = items.slice(page * GEN_LORA_PAGE_SIZE, page * GEN_LORA_PAGE_SIZE + GEN_LORA_PAGE_SIZE);
  let curFolder = "";
  for (const l of shown) {
    if (!q && l.folder !== curFolder) {
      curFolder = l.folder;
      const h = document.createElement("div");
      h.className = "lora-cat-head";
      h.textContent = curFolder;
      box.appendChild(h);
    }
    const slotIdx = GEN_LORA_SLOTS.findIndex(
      (s) => s.lora && s.lora.folder === l.folder && s.lora.file === l.file
    );
    const row = document.createElement("button");
    row.type = "button";
    row.className = "lora-row" + (slotIdx === GEN_ACTIVE_SLOT ? " on" : "");
    if (slotIdx === GEN_ACTIVE_SLOT) row.setAttribute("aria-current", "true");
    if (l.preview) row.appendChild(makeLoraPreviewEl(l));
    else {
      const ph = document.createElement("span");
      ph.className = "ph";
      row.appendChild(ph);
    }
    const rn = document.createElement("span");
    rn.className = "rn";
    if (slotIdx !== -1) {
      const badge = document.createElement("span");
      badge.className = "lora-slot-badge";
      badge.textContent = slotIdx === 0 ? "①" : "②";
      rn.appendChild(badge);
    }
    const rt = document.createElement("span");
    rt.className = "rt";
    rt.textContent = l.title || l.name;
    const rf = document.createElement("span");
    rf.className = "rf";
    rf.textContent = l.folder;
    rn.append(rt, rf);
    row.appendChild(rn);
    row.addEventListener("click", () => {
      hideLoraPreviewTip();
      selectGenLora(l);
    });
    row.addEventListener("mouseenter", () => showSingleLoraPreviewTip(row, l));
    row.addEventListener("mouseleave", hideLoraPreviewTip);
    box.appendChild(row);
  }
  if (pages > 1) {
    const nav = document.createElement("div");
    nav.className = "lora-pager";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "lora-page-btn";
    prev.textContent = "‹ 上一頁";
    prev.disabled = page === 0;
    const info = document.createElement("span");
    info.className = "lora-page-info";
    info.textContent = `第 ${page + 1} / ${pages} 頁 · 共 ${items.length} 個`;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "lora-page-btn";
    next.textContent = "下一頁 ›";
    next.disabled = page >= pages - 1;
    prev.addEventListener("click", (e) => {
      e.stopPropagation();
      GEN_LORA_PAGE = page - 1;
      renderLmList(filter);
      box.scrollTop = 0;
    });
    next.addEventListener("click", (e) => {
      e.stopPropagation();
      GEN_LORA_PAGE = page + 1;
      renderLmList(filter);
      box.scrollTop = 0;
    });
    nav.append(prev, info, next);
    box.appendChild(nav);
  }
  markPress(box);
}

function selectGenLora(l) {
  const focused = document.activeElement?.closest?.(".lora-row");
  const otherIdx = otherSlotIndex();
  const other = GEN_LORA_SLOTS[otherIdx];
  if (other.lora && other.lora.folder === l.folder && other.lora.file === l.file) {
    const tmp = GEN_LORA_SLOTS[GEN_ACTIVE_SLOT];
    GEN_LORA_SLOTS[GEN_ACTIVE_SLOT] = other;
    GEN_LORA_SLOTS[otherIdx] = tmp;
  } else {
    const tw = l.trainedWords || [];
    const twPicks = new Set();
    if (tw.length) twPicks.add(0);
    GEN_LORA_SLOTS[GEN_ACTIVE_SLOT] = { lora: l, strength: curSlot().strength, twPicks };
  }
  renderGenCurrent();
  renderLmCurrent();
  renderLmList($("lm-search").value);
  const selected = $("lm-list")?.querySelector?.(".lora-row.on");
  selected?.classList.add("is-seated");
  if (focused) selected?.focus({ preventScroll: true });
}

function renderGenCurrent() {
  const btn = $("lora-pick-btn");
  if (!btn) return;
  if (!btn.querySelector("img")) {
    btn.innerHTML = `<img src="data:image/png;base64,${LORA_MGR_LOGO_B64}" alt="" class="lora-logo" width="15" height="15"><span class="gen-pick-label"></span>`;
  }
  const [s0, s1] = GEN_LORA_SLOTS;
  let label;
  if (s0.lora && s1.lora) label = `${s0.lora.title || s0.lora.name} +1`;
  else if (s0.lora || s1.lora) label = (s0.lora || s1.lora).title || (s0.lora || s1.lora).name;
  else label = "選 LoRA";
  btn.querySelector(".gen-pick-label").textContent = label;
  btn.classList.toggle("has", !!(s0.lora || s1.lora));
}

function renderLmSlotTabs() {
  const wrap = document.createElement("div");
  wrap.className = "lm-slot-tabs";
  GEN_LORA_SLOTS.forEach((slot, i) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "lm-slot-tab" + (GEN_ACTIVE_SLOT === i ? " on" : "");
    tab.setAttribute("aria-pressed", GEN_ACTIVE_SLOT === i ? "true" : "false");
    if (slot.lora && slot.lora.preview) tab.appendChild(makeLoraPreviewEl(slot.lora));
    else {
      const ph = document.createElement("span");
      ph.className = "ph";
      tab.appendChild(ph);
    }
    const meta = document.createElement("span");
    meta.className = "lm-slot-tab-meta";
    const lb = document.createElement("span");
    lb.className = "lm-slot-tab-label";
    lb.textContent = `LoRA ${i + 1}`;
    const ti = document.createElement("span");
    ti.className = "lm-slot-tab-title" + (slot.lora ? "" : " empty");
    ti.textContent = slot.lora ? slot.lora.title || slot.lora.name : "未選擇";
    meta.append(lb, ti);
    tab.appendChild(meta);
    tab.addEventListener("click", () => {
      const focused = document.activeElement === tab;
      hideLoraPreviewTip();
      setActiveSlot(i);
      renderLmCurrent();
      renderLmList($("lm-search").value);
      if (focused) $("lm-current")?.querySelector?.('.lm-slot-tab[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    if (slot.lora) {
      tab.addEventListener("mouseenter", () => showSingleLoraPreviewTip(tab, slot.lora));
      tab.addEventListener("mouseleave", hideLoraPreviewTip);
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "lm-slot-clear";
      clear.title = `清空 LoRA ${i + 1}`;
      clear.setAttribute("aria-label", `清空 LoRA ${i + 1}`);
      clear.innerHTML = ICON_CLOSE;
      clear.addEventListener("click", (e) => {
        e.stopPropagation();
        hideLoraPreviewTip();
        GEN_LORA_SLOTS[i] = { lora: null, strength: slot.strength, twPicks: new Set() };
        setActiveSlot(i);
        renderGenCurrent();
        renderLmCurrent();
        renderLmList($("lm-search").value);
      });
      tab.appendChild(clear);
    }
    wrap.appendChild(tab);
  });
  markPress(wrap);
  return wrap;
}

function renderLmCurrent() {
  const box = $("lm-current");
  if (!box) return;
  box.replaceChildren();
  box.appendChild(renderLmSlotTabs());
  const slot = curSlot();
  const lora = slot.lora;
  if (!lora) {
    const none = document.createElement("div");
    none.className = "lm-none";
    none.textContent = `LoRA ${GEN_ACTIVE_SLOT + 1} 尚未選擇——從左邊清單點一個`;
    box.appendChild(none);
    return;
  }
  const head = document.createElement("div");
  head.className = "lm-cur-head";
  if (lora.preview) head.appendChild(makeLoraPreviewEl(lora));
  else {
    const ph = document.createElement("span");
    ph.className = "ph";
    head.appendChild(ph);
  }
  const meta = document.createElement("div");
  const t = document.createElement("div");
  t.className = "lm-cur-title";
  t.textContent = lora.title || lora.name;
  const f = document.createElement("div");
  f.className = "lm-cur-folder";
  f.textContent = lora.folder || "(根目錄)";
  meta.append(t, f);
  const detailLink = document.createElement("a");
  detailLink.className = "lm-detail-link";
  detailLink.target = "_blank";
  detailLink.rel = "noopener";
  // 有 Civitai 資料就開它的模型頁（說明、範例圖、建議強度都在那）；沒有就開 LoRA Manager。
  const civ = lora.civitai && lora.civitai.modelId;
  detailLink.title = civ ? "在 Civitai 開這個 LoRA 的頁面（新分頁）" : "在 LoRA Manager 開（新分頁）";
  const detailHref = civ
    ? `https://civitai.com/models/${encodeURIComponent(lora.civitai.modelId)}${lora.civitai.versionId ? `?modelVersionId=${encodeURIComponent(lora.civitai.versionId)}` : ""}`
    : LORA_MGR_URL;
  detailLink.hidden = !detailHref;
  if (detailHref) detailLink.href = detailHref;
  detailLink.innerHTML = `<img src="data:image/png;base64,${LORA_MGR_LOGO_B64}" alt="" width="13" height="13"><span>詳情</span>`;
  const actionsRow = document.createElement("div");
  actionsRow.className = "lm-actions-row";
  if (lora.base_model) {
    const bm = document.createElement("span");
    bm.className = "lm-base-model";
    bm.textContent = lora.base_model;
    bm.title = "基礎模型（來自 metadata.json）";
    actionsRow.appendChild(bm);
  }
  actionsRow.appendChild(detailLink);
  meta.appendChild(actionsRow);
  head.appendChild(meta);
  box.appendChild(head);

  const tw = lora.trainedWords || [];
  if (tw.length) {
    const label = document.createElement("div");
    label.className = "lm-tw-label";
    label.textContent = tw.length > 1 ? `觸發詞（共 ${tw.length} 段，勾選要用哪幾段）` : "觸發詞";
    box.appendChild(label);
    const list = document.createElement("div");
    list.className = "lm-tw-list";
    tw.forEach((w, i) => {
      const item = document.createElement("label");
      item.className = "lm-tw-item" + (slot.twPicks.has(i) ? " on" : "");
      item.style.setProperty("--i", i);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = slot.twPicks.has(i);
      cb.dataset.i = String(i);
      const idx = document.createElement("span");
      idx.className = "lm-tw-idx";
      idx.textContent = i + 1 + ".";
      const txt = document.createElement("span");
      txt.className = "lm-tw-text";
      txt.textContent = w;
      item.append(cb, idx, txt);
      item.addEventListener("mouseenter", () => showTwTip(item, w));
      item.addEventListener("mouseleave", () => hideTwTip(item));
      list.appendChild(item);
    });
    box.appendChild(list);
  }

  const tailDelay = 90 + tw.length * 45 + 70;
  const strengthRow = document.createElement("div");
  strengthRow.className = "lm-strength";
  strengthRow.style.animationDelay = tailDelay + "ms";
  const sLabel = document.createElement("span");
  sLabel.textContent = "強度";
  const sInput = document.createElement("input");
  sInput.type = "range";
  sInput.id = "lm-strength";
  sInput.min = "0";
  sInput.max = "1";
  sInput.step = "0.05";
  sInput.value = String(slot.strength);
  sInput.setAttribute("aria-label", "LoRA 強度");
  const sOut = document.createElement("output");
  sOut.id = "lm-strength-out";
  sOut.textContent = slot.strength.toFixed(2);
  strengthRow.append(sLabel, sInput, sOut);
  box.appendChild(strengthRow);

  if (lora.preview) {
    const pv = document.createElement("div");
    pv.className = "lm-preview";
    pv.style.animationDelay = tailDelay + 60 + "ms";
    const pvEl = makeLoraPreviewEl(lora);
    if (isLoraPreviewVideo(lora)) pvEl.controls = true;
    pv.appendChild(pvEl);
    box.appendChild(pv);
  }
}

export function joinTriggerParts(parts) {
  parts = parts.filter(Boolean).map((p) => p.trim()).filter(Boolean);
  let out = "";
  for (const p of parts) {
    if (!out) {
      out = p;
      continue;
    }
    out = out.endsWith(",") ? `${out} ${p}` : `${out}, ${p}`;
  }
  return out;
}
// export 出來只為了讓測試搆得到：觸發詞組錯了，掛上去的 LoRA 等於沒生效，
// 而這是整個檔案裡最容易默默壞掉又最難用眼睛發現的一段。
export function slotTriggerText(slot) {
  if (!slot.lora) return "";
  const tw = slot.lora.trainedWords || [];
  if (tw.length <= 1) return tw[0] || "";
  return joinTriggerParts([...slot.twPicks].sort((a, b) => a - b).map((i) => tw[i]));
}
export function currentTriggerText() {
  return joinTriggerParts(GEN_LORA_SLOTS.map((slot) => (slot.strength > 0 ? slotTriggerText(slot) : "")));
}
export function loraStrengthFromSpec(spec) {
  const n = Number(spec?.strength);
  if (!Number.isFinite(n)) return 0.8;
  return Math.max(0, Math.min(2, n));
}
function twPicksFromTrigger(lora, trigger) {
  const tw = lora?.trainedWords || [];
  if (!tw.length) return new Set();
  if (tw.length <= 1) return new Set([0]);
  const parts = new Set(
    String(trigger || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const picks = new Set();
  tw.forEach((word, i) => {
    if (parts.has(word)) picks.add(i);
  });
  return picks.size ? picks : new Set([0]);
}
export async function applyRecipeModels({ checkpoint, loras } = {}) {
  if (GEN_CKPTS === null) await fetchCkpts();
  if (GEN_LORAS === null) await fetchGenLoras();
  const missing = [];
  if (checkpoint) {
    const hit = (GEN_CKPTS || []).find(
      (c) => c.ckpt_name === checkpoint || c.file === checkpoint || String(c.ckpt_name).endsWith(checkpoint),
    );
    if (hit) selectCkpt(hit);
    else missing.push(checkpoint);
  }
  for (const slot of GEN_LORA_SLOTS) {
    slot.lora = null;
    slot.twPicks = new Set();
  }
  for (let i = 0; i < 2; i += 1) {
    const spec = (loras || [])[i];
    if (!spec) continue;
    const hit = (GEN_LORAS || []).find(
      (l) => l.file === spec.file || l.name === spec.name || l.name === spec.file,
    );
    if (hit) {
      GEN_LORA_SLOTS[i].lora = hit;
      GEN_LORA_SLOTS[i].strength = loraStrengthFromSpec(spec);
      GEN_LORA_SLOTS[i].twPicks = twPicksFromTrigger(hit, spec.trigger);
    } else missing.push(spec.file || spec.name);
  }
  return missing;
}

export function currentLorasPayload() {
  return GEN_LORA_SLOTS.filter((s) => s.lora && s.strength > 0).map((s, i) => ({
    folder: s.lora.folder,
    file: s.lora.file,
    strength: s.strength,
    trigger: slotTriggerText(s),
    order: i,
  }));
}

const TW_CACHE_KEY = "yz-tw-translate";
const TW_CACHE_MAX = 3000;
let TW_CACHE = null;
function loadTwCache() {
  if (TW_CACHE) return TW_CACHE;
  try {
    TW_CACHE = JSON.parse(localStorage.getItem(TW_CACHE_KEY) || "{}");
  } catch {
    TW_CACHE = {};
  }
  return TW_CACHE;
}
function saveTwCache() {
  const keys = Object.keys(TW_CACHE);
  if (keys.length > TW_CACHE_MAX) {
    for (const k of keys.slice(0, keys.length - TW_CACHE_MAX)) delete TW_CACHE[k];
  }
  try {
    localStorage.setItem(TW_CACHE_KEY, JSON.stringify(TW_CACHE));
  } catch {
    /* ignore quota */
  }
}
const TW_PENDING = new Map();
function translateTriggerWord(text) {
  const cache = loadTwCache();
  if (Object.prototype.hasOwnProperty.call(cache, text)) return Promise.resolve(cache[text]);
  if (TW_PENDING.has(text)) return TW_PENDING.get(text);
  const p = (async () => {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=" +
      encodeURIComponent(text);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`翻譯服務 ${res.status}`);
    const data = await res.json();
    const zh = (data[0] || []).map((seg) => seg[0]).join("").trim();
    cache[text] = zh;
    saveTwCache();
    return zh;
  })();
  TW_PENDING.set(text, p);
  p.finally(() => TW_PENDING.delete(text));
  return p;
}

let TW_TIP_EL = null;
let TW_TIP_FOR = null;
function ensureTwTip() {
  if (TW_TIP_EL) return TW_TIP_EL;
  TW_TIP_EL = document.createElement("div");
  TW_TIP_EL.className = "tw-tip";
  document.body.appendChild(TW_TIP_EL);
  return TW_TIP_EL;
}
function showTwTip(anchor, text) {
  TW_TIP_FOR = anchor;
  const tip = ensureTwTip();
  tip.textContent = "翻譯中…";
  const r = anchor.getBoundingClientRect();
  tip.style.left = r.left + "px";
  tip.style.top = r.bottom + 6 + "px";
  tip.classList.add("show");
  translateTriggerWord(text)
    .then((zh) => {
      if (TW_TIP_FOR !== anchor) return;
      tip.textContent = zh || text;
    })
    .catch(() => {
      if (TW_TIP_FOR !== anchor) return;
      tip.textContent = text;
    });
}
function hideTwTip(anchor) {
  if (anchor && TW_TIP_FOR !== anchor) return;
  TW_TIP_FOR = null;
  if (TW_TIP_EL) TW_TIP_EL.classList.remove("show");
}

let LORA_PREVIEW_TIP_EL = null;
function ensureLoraPreviewTip() {
  if (LORA_PREVIEW_TIP_EL) return LORA_PREVIEW_TIP_EL;
  LORA_PREVIEW_TIP_EL = document.createElement("div");
  LORA_PREVIEW_TIP_EL.className = "lora-preview-tip";
  document.body.appendChild(LORA_PREVIEW_TIP_EL);
  return LORA_PREVIEW_TIP_EL;
}
function positionLoraPreviewTip(anchor) {
  const tip = ensureLoraPreviewTip();
  const r = anchor.getBoundingClientRect();
  tip.style.left = r.left + "px";
  tip.style.top = "auto";
  tip.style.bottom = window.innerHeight - r.top + 8 + "px";
}
function showLoraPreviewTip(anchor) {
  if (!(GEN_LORA_SLOTS[0].lora || GEN_LORA_SLOTS[1].lora)) return;
  const tip = ensureLoraPreviewTip();
  tip.replaceChildren();
  GEN_LORA_SLOTS.forEach((slot, i) => {
    if (!slot.lora) return;
    const item = document.createElement("div");
    item.className = "lpt-item";
    if (slot.lora.preview) item.appendChild(makeLoraPreviewEl(slot.lora));
    else {
      const ph = document.createElement("span");
      ph.className = "ph";
      item.appendChild(ph);
    }
    const label = document.createElement("span");
    label.className = "lpt-label";
    label.textContent = `LoRA${i + 1}：${slot.lora.title || slot.lora.name}`;
    item.appendChild(label);
    tip.appendChild(item);
  });
  positionLoraPreviewTip(anchor);
  tip.classList.add("show");
}
function hideLoraPreviewTip() {
  if (LORA_PREVIEW_TIP_EL) LORA_PREVIEW_TIP_EL.classList.remove("show");
}
function showSingleLoraPreviewTip(anchor, lora) {
  if (!lora || !lora.preview) return;
  const tip = ensureLoraPreviewTip();
  tip.replaceChildren();
  const item = document.createElement("div");
  item.className = "lpt-item";
  item.appendChild(makeLoraPreviewEl(lora));
  const label = document.createElement("span");
  label.className = "lpt-label";
  label.textContent = lora.title || lora.name;
  item.appendChild(label);
  tip.appendChild(item);
  const r = anchor.getBoundingClientRect();
  const w = 220;
  let left = r.right + 10;
  if (left + w > window.innerWidth) left = r.left - w - 10;
  tip.style.left = left + "px";
  tip.style.bottom = "auto";
  tip.style.top = Math.max(8, Math.min(window.innerHeight - 240, r.top + r.height / 2 - 120)) + "px";
  tip.classList.add("show");
}

async function openLoraModal() {
  overlayOpen($("lora-modal"));
  if (!GEN_LORAS) $("lm-list").innerHTML = '<div class="lora-empty">載入中…</div>';
  renderLmCurrent();
  await fetchGenLoras();
  renderLmCats();
  renderLmSubcats();
  renderLmList($("lm-search").value, true);
  focusEntry($("lm-search"), $("lora-modal-close"));
}
function closeLoraModal() {
  const modal = $("lora-modal");
  hideLoraPreviewTip();
  fadeCloseOverlay(modal);
}

function sampleN(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function drawLoraTarot(pool, label) {
  pool = pool || GEN_LORAS || [];
  if (!pool.length) {
    toast(label ? `「${label}」底下沒有 LoRA` : "LoRA 清單還沒載入或是空的", true);
    return;
  }
  const ov = $("lora-tarot");
  const want = matchMedia("(max-width: 760px)").matches ? 1 : 8;
  const picks = sampleN(pool, Math.min(want, pool.length));
  $("lora-tarot-title").textContent = label
    ? `${label} 隨機 ${picks.length} 個 LoRA`
    : `隨機瀏覽 ${picks.length} 個 LoRA`;
  const wrap = $("lora-tarot-cards");
  wrap.replaceChildren();
  picks.forEach((l, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "lora-tarot-card";
    card.style.setProperty("--i", i);
    const face = document.createElement("div");
    face.className = "lora-tarot-face";
    if (l.preview) face.appendChild(makeLoraPreviewEl(l));
    else {
      const ph = document.createElement("span");
      ph.className = "ph";
      face.appendChild(ph);
    }
    const nm = document.createElement("div");
    nm.className = "lora-tarot-name";
    nm.textContent = l.title || l.name;
    const fd = document.createElement("div");
    fd.className = "lora-tarot-folder";
    fd.textContent = l.folder || "(根目錄)";
    face.append(nm, fd);
    card.appendChild(face);
    card.addEventListener("click", () => {
      selectGenLora(l);
      closeLoraTarot();
    });
    wrap.appendChild(card);
  });
  overlayOpen(ov);
  markPress(wrap);
}
function closeLoraTarot() {
  fadeCloseOverlay($("lora-tarot"));
}

let LORA_PUSH_EPOCH = localStorage.getItem("yz-lora-push-epoch") || "";
let LORA_PUSH_VER = +(localStorage.getItem("yz-lora-push-ver") || 0);
let LORA_POLL_MS = 2500;
let LORA_POLL_TIMER = 0;
export function loraPollDelay(hidden, prev) {
  if (!hidden) return 2500;
  return Math.min(30000, Math.round((prev || 2500) * 1.6));
}
// 前景用長輪詢：伺服器等到有新推送（最多 25 秒）才回。回得太快又沒東西，代表是還不會
// 長輪詢的舊伺服器 —— 退回原本每 2.5 秒問一次，不要變成連續狂打。
let LORA_LONG_POLL = true;
async function pollLoraPush() {
  const long = LORA_LONG_POLL && !document.hidden;
  const t0 = performance.now();
  let changed = false;
  let failed = false;
  try {
    const url = "/api/lora-push?since=" + LORA_PUSH_VER + (long ? "&wait=25" : "");
    const st = await fetch(url, { signal: AbortSignal.timeout(long ? 35000 : 10000) }).then((r) => r.json());
    changed = !!(st.epoch && st.epoch !== LORA_PUSH_EPOCH) || st.ver > LORA_PUSH_VER;
    if (st.epoch && st.epoch !== LORA_PUSH_EPOCH) {
      // 第一次連上（或伺服器重開過）：從「現在」開始聽。以前設成 0，下一輪就把分頁打開之前
      // 別人送過的推送當成新的套上來 —— 開頁就自己跳出 LoRA 選單、選進一個舊的 LoRA。
      LORA_PUSH_EPOCH = st.epoch;
      LORA_PUSH_VER = Number(st.ver) || 0;
      localStorage.setItem("yz-lora-push-epoch", LORA_PUSH_EPOCH);
      localStorage.setItem("yz-lora-push-ver", String(LORA_PUSH_VER));
    } else if (st.ver > LORA_PUSH_VER) {
      LORA_PUSH_VER = st.ver;
      localStorage.setItem("yz-lora-push-ver", String(LORA_PUSH_VER));
      if (st.data) await applyLoraPush(st.data);
    }
  } catch {
    /* 下一輪再試 */
    failed = true;
  }
  if (long && !failed && !changed && performance.now() - t0 < 1000) LORA_LONG_POLL = false;
  LORA_POLL_MS = loraPollDelay(document.hidden, LORA_POLL_MS);
  // 長輪詢本身就在伺服器那邊等過了，回來就接著問；斷線時照舊隔一段再試。
  const next = long && LORA_LONG_POLL && !failed ? 0 : LORA_POLL_MS;
  clearTimeout(LORA_POLL_TIMER);
  LORA_POLL_TIMER = setTimeout(pollLoraPush, next);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    LORA_POLL_MS = 2500;
    clearTimeout(LORA_POLL_TIMER);
    LORA_POLL_TIMER = setTimeout(pollLoraPush, 0);
  }
});
async function applyLoraPush(d) {
  await openLoraModal();
  const match = (GEN_LORAS || []).find((l) => l.name === d.name && (!d.folder || l.folder === d.folder));
  if (!match) {
    toast(`LoRA Manager 送來的「${d.name}」在這裡的清單找不到`, true);
    return;
  }
  const emptyIdx = GEN_LORA_SLOTS.findIndex((s) => !s.lora);
  if (emptyIdx !== -1) setActiveSlot(emptyIdx);
  selectGenLora(match);
  toast(`已從 LoRA Manager 選入 LoRA ${GEN_ACTIVE_SLOT + 1}：「${match.title || match.name}」`);
}

function ensureMastTools() {
  let tools = $("mast-tools");
  const ping = $("ping");
  if (!tools && ping && ping.parentNode) {
    tools = document.createElement("div");
    tools.id = "mast-tools";
    tools.className = "mast-tools";
    ping.parentNode.insertBefore(tools, ping);
    tools.appendChild(ping);
  }
  return tools;
}

function ensureDom() {
  const tools = ensureMastTools();
  if (!$("lora-pick-btn") && tools) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.id = "lora-pick-btn";
    btn.title = "選 LoRA（L）";
    btn.innerHTML = `<span class="gen-pick-label">選 LoRA</span>`;
    tools.insertBefore(btn, tools.firstChild);
  }
  if (!$("ckpt-pick-btn") && tools) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.id = "ckpt-pick-btn";
    btn.title = "設定：底模";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-label", "設定底模");
    btn.innerHTML = `<span class="ckpt-layers" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></svg></span><span class="gen-pick-label">設定</span>`;
    const loraBtn = $("lora-pick-btn");
    if (loraBtn && loraBtn.nextSibling) tools.insertBefore(btn, loraBtn.nextSibling);
    else if (loraBtn) loraBtn.after(btn);
    else tools.insertBefore(btn, tools.firstChild);
  }
  if (!$("keys-btn") && tools) {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "ghost keys-btn";
    k.id = "keys-btn";
    k.title = "快捷鍵";
    k.setAttribute("aria-label", "快捷鍵介紹");
    k.setAttribute("aria-haspopup", "dialog");
    k.textContent = "?";
    const ping = $("ping");
    if (ping && ping.parentNode === tools) tools.insertBefore(k, ping);
    else tools.appendChild(k);
  }
  if (!$("lora-modal")) {
    const modal = document.createElement("div");
    modal.id = "lora-modal";
    modal.className = "lora-modal";
    modal.inert = true;
    modal.innerHTML = `
      <div class="lora-modal-inner">
        <button class="lora-modal-close" id="lora-modal-close" aria-label="關閉 (Esc)" title="關閉 (Esc)">${ICON_CLOSE}</button>
        <div class="lm-left">
          <div id="lm-cats" class="lm-cats"></div>
          <div id="lm-subcats" class="lm-subcats"></div>
          <button class="ghost lm-random-btn" id="lm-random-btn" title="隨機瀏覽 LoRA（點一張直接選中）">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.3" cy="8.3" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.7" cy="8.3" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.3" cy="15.7" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.7" cy="15.7" r="1.2" fill="currentColor" stroke="none"/></svg>
            隨機瀏覽
          </button>
          <div class="lm-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="lm-search" placeholder="搜尋 LoRA…" autocomplete="off" spellcheck="false">
          </div>
          <div id="lm-list" class="lm-list"></div>
          <a class="lm-manager-link" id="lm-manager-link" href="#" target="_blank" rel="noopener">
            <img src="data:image/png;base64,${LORA_MGR_LOGO_B64}" alt="" width="16" height="16">用 LoRA Manager 管理（新分頁）
          </a>
        </div>
        <div class="lm-right">
          <div class="lm-right-head">目前選擇</div>
          <div id="lm-current" class="lm-current"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  if (!$("ckpt-modal")) {
    const modal = document.createElement("div");
    modal.id = "ckpt-modal";
    modal.className = "lora-modal ckpt-modal";
    modal.inert = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "ckpt-head-title");
    modal.innerHTML = `
      <div class="lora-modal-inner">
        <button class="lora-modal-close" id="ckpt-modal-close" aria-label="關閉 (Esc)" title="關閉 (Esc)">${ICON_CLOSE}</button>
        <div class="lm-left ckpt-pane">
          <div class="ckpt-head">
            <div class="ckpt-head-title" id="ckpt-head-title">底模</div>
            <p class="ckpt-head-hint">只掃 illurtrious 資料夾。點左邊換一顆，生圖用目前這顆。</p>
          </div>
          <div class="lm-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="ckpt-search" placeholder="搜尋底模…" autocomplete="off" spellcheck="false">
          </div>
          <div id="ckpt-list" class="lm-list"></div>
          <a class="lm-manager-link" id="ckpt-manager-link" href="#" target="_blank" rel="noopener">
            <img src="data:image/png;base64,${LORA_MGR_LOGO_B64}" alt="" width="16" height="16">用 LoRA Manager 管理（新分頁）
          </a>
        </div>
        <div class="lm-right">
          <div class="lm-right-head">目前選擇</div>
          <div id="ckpt-current" class="lm-current"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  if (!$("lora-tarot")) {
    const ov = document.createElement("div");
    ov.id = "lora-tarot";
    ov.className = "lora-tarot";
    ov.inert = true;
    ov.innerHTML = `
      <h2 class="lora-tarot-title" id="lora-tarot-title">隨機瀏覽 LoRA</h2>
      <p class="lora-tarot-hint">點任一張直接選中並返回；Esc 關閉</p>
      <div class="lora-tarot-cards" id="lora-tarot-cards"></div>
      <button type="button" class="lora-tarot-close" id="lora-tarot-close">關閉</button>`;
    document.body.appendChild(ov);
  }
  if (!$("lora-toast")) {
    const t = document.createElement("div");
    t.id = "lora-toast";
    t.className = "lora-toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  if (!$("shortcuts-overlay")) {
    const ov = document.createElement("div");
    ov.id = "shortcuts-overlay";
    ov.className = "shortcuts-overlay";
    ov.inert = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-labelledby", "shortcuts-title");
    ov.innerHTML = `
      <div class="shortcuts-panel" id="shortcuts-panel">
        <button class="shortcuts-close" id="shortcuts-close" aria-label="關閉 (Esc)" title="關閉 (Esc)">${ICON_CLOSE}</button>
        <div class="shortcuts-head">
          <h2 id="shortcuts-title">快捷鍵</h2>
          <p>焦點在輸入框時不會觸發。Esc 只關最上面那層。</p>
        </div>
        <div class="shortcut-group">
          <h3>LoRA／底模</h3>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">L</span></div><div class="shortcut-desc">開選 LoRA 大面板</div></div>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">M</span></div><div class="shortcut-desc">開設定（底模）</div></div>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">1</span><span class="kbd">2</span></div><div class="shortcut-desc">面板開著時切 LoRA 1／LoRA 2</div></div>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">/</span></div><div class="shortcut-desc">面板開著搜 LoRA，否則搜詞庫</div></div>
        </div>
        <div class="shortcut-group">
          <h3>詞庫</h3>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">W</span></div><div class="shortcut-desc">焦點在字牌上時開權重（再按一次關）</div></div>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">↑</span><span class="kbd">↓</span></div><div class="shortcut-desc">權重開著時加減 0.1</div></div>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">I</span></div><div class="shortcut-desc">無限抽：開始／停下</div></div>
        </div>
        <div class="shortcut-group">
          <h3>生圖／大圖</h3>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">Enter</span></div><div class="shortcut-desc">沒開疊層時曝光生圖；疊層開著時關閉</div></div>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">Esc</span></div><div class="shortcut-desc">關閉最上層（說明／大圖／LoRA）</div></div>
          <div class="shortcut-row"><div class="shortcut-keys"><span class="kbd">←</span><span class="kbd">→</span></div><div class="shortcut-desc">大圖切上一張／下一張</div></div>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
}

function isTypingTarget(el) {
  return !!el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable);
}

function overlayIsOpen(id) {
  const el = $(id);
  return !!(el && el.classList.contains("open") && el.dataset.closing !== "1");
}

export function openHelp() {
  overlayOpen($("shortcuts-overlay"));
  const close = $("shortcuts-close");
  if (close) close.focus();
}
export function closeHelp() {
  fadeCloseOverlay($("shortcuts-overlay"));
}

export function isLoraUiOpen() {
  return (
    overlayIsOpen("lora-tarot") ||
    overlayIsOpen("lora-modal") ||
    overlayIsOpen("ckpt-modal") ||
    overlayIsOpen("shortcuts-overlay")
  );
}

export function handleLoraKeys(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const typing = isTypingTarget(e.target);

  if (overlayIsOpen("shortcuts-overlay")) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      closeHelp();
    }
    return true;
  }
  if (overlayIsOpen("lora-tarot")) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      closeLoraTarot();
    }
    return true;
  }
  if (overlayIsOpen("ckpt-modal")) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCkptModal();
      return true;
    }
    if (typing) return true;
    if (e.key === "/") {
      e.preventDefault();
      $("ckpt-search")?.focus();
      return true;
    }
    return true;
  }
  if (overlayIsOpen("lora-modal")) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeLoraModal();
      return true;
    }
    if (typing) {
      if (e.key === "Enter") e.preventDefault();
      return true;
    }
    if (e.key === "1" || e.key === "2") {
      e.preventDefault();
      setActiveSlot(e.key === "1" ? 0 : 1);
      renderLmCurrent();
      renderLmList($("lm-search").value);
      return true;
    }
    if (e.key === "/") {
      e.preventDefault();
      $("lm-search").focus();
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      closeLoraModal();
      return true;
    }
    if (e.key === "l" || e.key === "L") {
      e.preventDefault();
      $("lm-search").focus();
      return true;
    }
    return true;
  }
  if ((e.key === "l" || e.key === "L") && !typing) {
    e.preventDefault();
    openLoraModal();
    return true;
  }
  if ((e.key === "m" || e.key === "M") && !typing) {
    e.preventDefault();
    openCkptModal();
    return true;
  }
  return false;
}

function ckptPreviewUrl(c) {
  if (c.previewUrl) return c.previewUrl;
  return `/api/ckpt-preview?file=${encodeURIComponent(c.preview)}`;
}

function renderCkptBtn() {
  const btn = $("ckpt-pick-btn");
  if (!btn) return;
  const lab = btn.querySelector(".gen-pick-label");
  if (!lab) return;
  const cur = (GEN_CKPTS || []).find((c) => c.ckpt_name === GEN_CKPT);
  lab.textContent = cur ? cur.title : GEN_CKPT ? GEN_CKPT.split("\\").pop().replace(/\.safetensors$/i, "") : "設定";
  btn.classList.toggle("has", !!GEN_CKPT);
  btn.title = cur ? `設定 · 底模 ${cur.title}` : "設定：底模";
  btn.setAttribute("aria-expanded", overlayIsOpen("ckpt-modal") ? "true" : "false");
}

// 底模視窗關著時什麼都不畫：openCkptModal() 打開後本來就會重畫。
// 開機的 fetchCkpts() 和套用配方的 selectCkpt() 以前會把預覽塞進關著的視窗 ——
// 預設底模那張是 5.9 MB、2048×2688，佔每次開頁傳輸的 95%，只為了一個看不見的 55px 頭像。
function ckptModalShown() {
  return overlayIsOpen("ckpt-modal");
}

function renderCkptCurrent() {
  const box = $("ckpt-current");
  if (!box || !ckptModalShown()) return;
  box.replaceChildren();
  const cur = (GEN_CKPTS || []).find((c) => c.ckpt_name === GEN_CKPT);
  if (!cur) {
    const none = document.createElement("div");
    none.className = "lm-none";
    none.textContent = (GEN_CKPTS || []).length ? "還沒選底模——從左邊清單點一個" : "這個資料夾沒有 checkpoint";
    box.appendChild(none);
    return;
  }
  const head = document.createElement("div");
  head.className = "lm-cur-head";
  if (cur.preview) {
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.src = ckptPreviewUrl(cur);
    head.appendChild(img);
  } else {
    const ph = document.createElement("span");
    ph.className = "ph";
    head.appendChild(ph);
  }
  const meta = document.createElement("div");
  const t = document.createElement("div");
  t.className = "lm-cur-title";
  t.textContent = cur.title || cur.file;
  const f = document.createElement("div");
  f.className = "lm-cur-folder";
  f.textContent = cur.ckpt_name;
  meta.append(t, f);
  head.appendChild(meta);
  box.appendChild(head);
  const hint = document.createElement("p");
  hint.className = "ckpt-cur-hint";
  hint.textContent = "生圖會用這顆底模。";
  box.appendChild(hint);
  if (cur.preview) {
    const pv = document.createElement("div");
    pv.className = "lm-preview";
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.src = ckptPreviewUrl(cur);
    pv.appendChild(img);
    box.appendChild(pv);
  }
  const mgr = document.createElement("a");
  mgr.className = "lm-manager-link ckpt-mgr-inline";
  mgr.target = "_blank";
  mgr.rel = "noopener";
  mgr.href = CKPT_MGR_URL;
  mgr.hidden = !CKPT_MGR_URL;
  mgr.innerHTML = `<img src="data:image/png;base64,${LORA_MGR_LOGO_B64}" alt="" width="16" height="16">在 LoRA Manager 開（新分頁）`;
  box.appendChild(mgr);
}

async function fetchCkpts() {
  if (GEN_CKPTS !== null) return GEN_CKPTS;
  try {
    const data = await fetch("/api/checkpoints").then((r) => r.json());
    GEN_CKPTS = data.items || [];
    GEN_CKPT_SOURCE = data.source || "";
    CKPT_MGR_URL = reachable(data.manager);
    syncManagerLinks();
    const names = new Set(GEN_CKPTS.map((c) => c.ckpt_name));
    if (GEN_CKPT && !names.has(GEN_CKPT)) GEN_CKPT = "";
    if (!GEN_CKPT && data.current && names.has(data.current)) GEN_CKPT = data.current;
    if (!GEN_CKPT && GEN_CKPTS.length) {
      const wai = GEN_CKPTS.find((c) => /waiIllustriousSDXL_v170/i.test(c.file));
      GEN_CKPT = (wai || GEN_CKPTS[0]).ckpt_name;
    }
    try {
      if (GEN_CKPT) localStorage.setItem(CKPT_STORE, GEN_CKPT);
    } catch {
      /* ignore */
    }
  } catch (e) {
    GEN_CKPTS = null;
    toast("底模清單載入失敗：" + e.message, true);
    renderCkptBtn();
    return [];
  }
  renderCkptBtn();
  renderCkptCurrent();
  return GEN_CKPTS;
}

function selectCkpt(c) {
  const focused = document.activeElement?.closest?.("#ckpt-list .lora-row");
  GEN_CKPT = c.ckpt_name;
  try {
    localStorage.setItem(CKPT_STORE, GEN_CKPT);
  } catch {
    /* ignore */
  }
  renderCkptBtn();
  renderCkptCurrent();
  renderCkptList($("ckpt-search")?.value);
  const selected = $("ckpt-list")?.querySelector?.(".lora-row.on");
  selected?.classList.add("is-seated");
  if (focused) selected?.focus({ preventScroll: true });
  toast(`底模已換成「${c.title || c.file}」`);
}

function renderCkptList(filter) {
  const box = $("ckpt-list");
  if (!box || !ckptModalShown()) return;
  const q = (filter || "").toLowerCase().trim();
  let items = GEN_CKPTS || [];
  if (q) items = items.filter((c) => (c.title || "").toLowerCase().includes(q) || c.file.toLowerCase().includes(q));
  box.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "lora-empty";
    empty.textContent =
      GEN_CKPTS && GEN_CKPTS.length
        ? "找不到底模"
        : GEN_CKPT_SOURCE === "comfy"
          ? "ComfyUI 沒有回報 checkpoint"
          : "這個資料夾沒有 checkpoint。連上 ComfyUI 後會改問它要清單。";
    box.appendChild(empty);
    box.dataset.result = "empty";
    return;
  }
  box.dataset.result = "found";
  for (const c of items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "lora-row" + (c.ckpt_name === GEN_CKPT ? " on" : "");
    if (c.ckpt_name === GEN_CKPT) row.setAttribute("aria-current", "true");
    if (c.preview) {
      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.loading = "lazy";
      img.src = ckptPreviewUrl(c);
      row.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "ph";
      row.appendChild(ph);
    }
    const rn = document.createElement("span");
    rn.className = "rn";
    const rt = document.createElement("span");
    rt.className = "rt";
    rt.textContent = c.title || c.file;
    const rf = document.createElement("span");
    rf.className = "rf";
    rf.textContent = c.file;
    rn.append(rt, rf);
    row.appendChild(rn);
    row.addEventListener("click", () => selectCkpt(c));
    box.appendChild(row);
  }
  markPress(box);
}

async function openCkptModal() {
  overlayOpen($("ckpt-modal"));
  renderCkptBtn();
  const list = $("ckpt-list");
  if (list && GEN_CKPTS === null) list.innerHTML = '<div class="lora-empty">載入中…</div>';
  await fetchCkpts();
  renderCkptList($("ckpt-search")?.value);
  renderCkptCurrent();
  focusEntry($("ckpt-search"), $("ckpt-modal-close"));
}
function closeCkptModal() {
  fadeCloseOverlay($("ckpt-modal"), null, () => renderCkptBtn());
}

export function initLoraPicker() {
  ensureDom();
  syncManagerLinks();
  renderGenCurrent();
  renderCkptBtn();
  fetchCkpts();

  $("lora-pick-btn").addEventListener("click", () => {
    hideLoraPreviewTip();
    openLoraModal();
  });
  $("ckpt-pick-btn")?.addEventListener("click", () => openCkptModal());
  $("ckpt-modal-close")?.addEventListener("click", closeCkptModal);
  $("ckpt-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "ckpt-modal") closeCkptModal();
  });
  $("ckpt-search")?.addEventListener("input", () => renderCkptList($("ckpt-search").value));
  $("lora-pick-btn").addEventListener("mouseenter", () => showLoraPreviewTip($("lora-pick-btn")));
  $("lora-pick-btn").addEventListener("mouseleave", hideLoraPreviewTip);
  $("lora-modal-close").addEventListener("click", closeLoraModal);
  $("lora-modal").addEventListener("click", (e) => {
    if (e.target.id === "lora-modal") closeLoraModal();
  });
  $("lm-search").addEventListener("input", () => renderLmList($("lm-search").value, true));
  $("lm-random-btn").addEventListener("click", () => {
    fetchGenLoras().then(() => drawLoraTarot(loraCatPool(), loraCatLabel()));
  });
  $("lora-tarot-close").addEventListener("click", closeLoraTarot);
  $("lora-tarot").addEventListener("click", (e) => {
    if (e.target.id === "lora-tarot") closeLoraTarot();
  });
  $("lm-current").addEventListener("input", (e) => {
    if (e.target.id !== "lm-strength") return;
    const slot = curSlot();
    slot.strength = parseFloat(e.target.value);
    const out = $("lm-strength-out");
    if (out) out.textContent = slot.strength.toFixed(2);
  });
  $("lm-current").addEventListener("change", (e) => {
    if (!e.target.matches("input[type=checkbox]")) return;
    const i = +e.target.dataset.i;
    const twPicks = curSlot().twPicks;
    if (e.target.checked) twPicks.add(i);
    else twPicks.delete(i);
    const item = e.target.closest(".lm-tw-item");
    if (item) item.classList.toggle("on", e.target.checked);
  });
  $("keys-btn").addEventListener("click", openHelp);
  $("shortcuts-close").addEventListener("click", closeHelp);
  $("shortcuts-overlay").addEventListener("click", (e) => {
    if (e.target.id === "shortcuts-overlay") closeHelp();
  });
  pollLoraPush();
}
