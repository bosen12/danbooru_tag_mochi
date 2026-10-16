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
// 畫廊版（墨池 web6 打開）：清單改成大圖網格、捲到底自動多載一批（不分頁）；選中的那張飛進右邊的槽。
// 其他版面不傳 gallery，照舊是左邊一條清單、右邊目前選擇。
let GALLERY = false;
let MOTION = null;
let GEN_LORA_SHOWN = GEN_LORA_PAGE_SIZE;
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
/**
 * 預覽圖的縮圖網址：伺服器把原圖（常是 832×1216 的 PNG，1～6 MB）縮成 w 寬的 webp。
 * 卡片、小圖用 480，大圖用 960；伺服器沒有 Pillow 就照舊回原圖。影片不縮。
 */
function sizedUrl(url, w) {
  return w ? url + (url.includes("?") ? "&" : "?") + "w=" + w : url;
}
/** 先顯示小的（通常剛在卡上載過、快取裡就有），大的在背景載好再換上去：不會先空一下。 */
function upgradeSrc(img, src) {
  const big = new Image();
  big.decoding = "async";
  big.onload = () => {
    if (img.isConnected) img.src = src;
  };
  big.src = src;
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
  if (!el.isConnected) {
    done();
    return;
  }
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

function makeLoraPreviewEl(l, w = 480) {
  let el;
  const video = isLoraPreviewVideo(l);
  if (video) {
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
  el.dataset.src = video ? loraPreviewUrl(l) : sizedUrl(loraPreviewUrl(l), w);
  _loraPreviewIO.observe(el);
  return el;
}

function renderLmCats() {
  const box = $("lm-cats");
  if (!box) return;
  const was = GALLERY ? catInkAt(box) : null;
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
  if (GALLERY) {
    // 第一次有資料時一格格浮上來；之後重畫（換分類、換槽）不再播。
    box.classList.toggle("is-first", !box.dataset.filled && items.length > 0);
    if (items.length) box.dataset.filled = "1";
    placeCatInk(box, was);
  }
}

/** 畫廊版的分類：選中那一格底下墊一塊墨（.lm-cat-ink），換分類時從舊的那格滑到新的那格。 */
function catInkAt(box) {
  const on = box.querySelector(".lm-cat.on");
  return on && on.offsetWidth ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null;
}
function placeCatInk(box, was) {
  const to = catInkAt(box);
  if (!to) return;
  const ink = box._ink || (box._ink = document.createElement("span"));
  ink.className = "lm-cat-ink";
  ink.setAttribute("aria-hidden", "true");
  box.prepend(ink);
  const at = (r) => ({ transform: `translate(${r.x}px, ${r.y}px)`, width: r.w + "px", height: r.h + "px" });
  Object.assign(ink.style, at(to));
  if (!was || !MOTION || REDUCE_MOTION || (was.x === to.x && was.y === to.y && was.w === to.w)) return;
  ink.animate([at(was), at(to)], { duration: MOTION.DUR.medium, easing: MOTION.css(MOTION.CURVE.out) });
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

function renderLmList(filter, resetPage, deal = resetPage) {
  const box = $("lm-list");
  if (!box) return;
  if (resetPage) {
    GEN_LORA_PAGE = 0;
    GEN_LORA_SHOWN = GEN_LORA_PAGE_SIZE;
  }
  const q = (filter || "").toLowerCase().trim();
  // 畫廊版：清單沒換（只是選了、清了、調了槽）就原地改記號，不整片重畫（重畫會讓每張圖重載一次、閃一下）。
  if (GALLERY && !resetPage && box._gallery?.key === loraGalleryKey(q) && box.dataset.result === "found") return refreshGalleryMarks(box);
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
  syncCount("lm-count", items.length);
  for (const n of box.querySelectorAll("[data-src]")) _loraPreviewIO.unobserve(n);
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
  if (GALLERY) return renderLoraGallery(box, items, q, deal);
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

/* ---------- 畫廊版的清單：一張張大圖，捲到底自動多載一批 ---------- */

function syncCount(id, n) {
  const el = $(id);
  if (el) el.textContent = `共 ${n} 個`;
}

function sameLora(a, b) {
  return !!(a && b && a.folder === b.folder && a.file === b.file);
}

/** 一張畫廊卡：圖在上、名字在下；在槽裡的蓋一顆 ①／②。deal：剛換清單時一張張發出來。 */
function galleryCard({ preview, title, sub, seat, on, deal, i }) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "lora-row lg-card" + (on ? " on" : "") + (seat && !on ? " in-other" : "");
  if (on) card.setAttribute("aria-current", "true");
  // deal：換清單時一張張發出來；"quick"：打字搜尋時只輕輕換過去（每打一個字都整片發牌太吵）。
  if (deal && i < 30) {
    card.classList.add(deal === "quick" ? "is-swapped" : "is-dealt");
    card.style.setProperty("--i", i);
  }
  card.title = title;
  const art = document.createElement("span");
  art.className = "lg-art";
  if (preview) {
    // 圖還沒到：框裡一道光來回掃；到了淡進來（不是一格就跳出來）。
    art.classList.add("is-wait");
    const ready = () => art.classList.remove("is-wait");
    preview.addEventListener("load", ready, { once: true });
    preview.addEventListener("loadeddata", ready, { once: true });
    art.appendChild(preview);
  }
  else {
    const ph = document.createElement("span");
    ph.className = "ph";
    art.appendChild(ph);
  }
  if (seat) {
    const badge = document.createElement("span");
    badge.className = "lora-slot-badge";
    badge.textContent = seat;
    art.appendChild(badge);
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
  card.append(art, rn);
  return card;
}

function loraCard(l, i, deal) {
  const card = galleryCard({
    preview: l.preview ? makeLoraPreviewEl(l) : null,
    title: l.title || l.name,
    sub: l.folder || "(根目錄)",
    ...loraSeat(l),
    deal,
    i,
  });
  card._mark = () => loraSeat(l);
  card.addEventListener("click", () => selectGenLora(l, card));
  return card;
}

function appendLoraCards(box, from, to, deal) {
  const { items, q } = box._gallery;
  const frag = document.createDocumentFragment();
  for (let i = from; i < to; i++) {
    const l = items[i];
    if (!q && l.folder !== box._gallery.folder) {
      box._gallery.folder = l.folder;
      const h = document.createElement("div");
      h.className = "lora-cat-head";
      h.textContent = l.folder || "(根目錄)";
      frag.appendChild(h);
    }
    frag.appendChild(loraCard(l, i - from, deal));
  }
  box.appendChild(frag);
  markPress(box);
}

function loraGalleryKey(q) {
  return [q, curScope().cat, curScope().subfolder].join("\n");
}

function loraSeat(l) {
  const idx = GEN_LORA_SLOTS.findIndex((s) => sameLora(s.lora, l));
  return { seat: idx === -1 ? "" : String(idx + 1), on: idx !== -1 && idx === GEN_ACTIVE_SLOT };
}

/** 卡上的記號跟著現在的槽走：在用的描邊、①② 章（新蓋上去的章會重新壓一次）。 */
function refreshGalleryMarks(box) {
  for (const card of box.querySelectorAll(".lg-card")) {
    if (!card._mark) continue;
    const { seat, on } = card._mark();
    card.classList.toggle("on", on);
    card.classList.toggle("in-other", !!seat && !on);
    if (on) card.setAttribute("aria-current", "true");
    else card.removeAttribute("aria-current");
    let badge = card.querySelector(".lora-slot-badge:not(.is-leaving)");
    if (!seat) liftBadge(badge);
    else if (!badge || badge.textContent !== seat) {
      liftBadge(badge);
      badge = document.createElement("span");
      badge.className = "lora-slot-badge";
      badge.textContent = seat;
      card.querySelector(".lg-art")?.appendChild(badge);
    }
  }
}

function liftBadge(badge) {
  if (!badge) return;
  badge.classList.add("is-leaving");
  if (!MOTION || REDUCE_MOTION) return badge.remove();
  const gone = () => badge.remove();
  badge.animate([{ opacity: 1, scale: "1" }, { opacity: 0, scale: "0.6" }], { duration: MOTION.DUR.short, easing: MOTION.css(MOTION.CURVE.exit), fill: "forwards" }).finished.then(gone, gone);
}

function renderLoraGallery(box, items, q, deal) {
  box._io?.disconnect();
  box._gallery = { items, q, folder: "", key: loraGalleryKey(q) };
  if (deal) box.scrollTop = 0;
  const shown = Math.min(GEN_LORA_SHOWN, items.length);
  appendLoraCards(box, 0, shown, deal);
  if (shown < items.length) addLoraMore(box);
}

/** 清單尾巴：捲到附近自動再載一批（也可以直接按）。 */
function addLoraMore(box) {
  const { items } = box._gallery;
  const more = document.createElement("div");
  more.className = "lora-more";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ghost lora-more-btn";
  btn.textContent = `再顯示 ${Math.min(GEN_LORA_PAGE_SIZE, items.length - GEN_LORA_SHOWN)} 個`;
  more.appendChild(btn);
  box.appendChild(more);
  const load = () => {
    box._io?.disconnect();
    if (!more.isConnected) return;
    const from = GEN_LORA_SHOWN;
    GEN_LORA_SHOWN = Math.min(items.length, GEN_LORA_SHOWN + GEN_LORA_PAGE_SIZE);
    more.remove();
    appendLoraCards(box, from, GEN_LORA_SHOWN, true);
    if (GEN_LORA_SHOWN < items.length) addLoraMore(box);
  };
  btn.addEventListener("click", load);
  box._io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && load(), { root: box, rootMargin: "600px 0px" });
  box._io.observe(more);
}

/**
 * 畫廊的方向鍵（跟字盒一樣）：← → 上一張、下一張，↑ ↓ 上一排、下一排（照畫面上的位置找最近的那張）；
 * 最上面一排再按 ↑ 回到搜尋框。搜尋框按 ↓ 走進網格。Enter／空白鍵就是按那張卡（選中）。
 */
function gridKeys(list, search) {
  const cards = () => [...list.querySelectorAll(".lg-card")];
  const focusCard = (card) => {
    if (!card) return;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: "nearest", behavior: REDUCE_MOTION ? "auto" : "smooth" });
  };
  search?.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" || e.isComposing) return;
    const first = list.querySelector(".lg-card.on") || list.querySelector(".lg-card");
    if (!first) return;
    e.preventDefault();
    focusCard(first);
  });
  list.addEventListener("keydown", (e) => {
    const card = e.target.closest?.(".lg-card");
    if (!card || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const all = cards();
    const i = all.indexOf(card);
    if (e.key === "ArrowLeft") return focusCard(all[i - 1]);
    if (e.key === "ArrowRight") return focusCard(all[i + 1]);
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const down = e.key === "ArrowDown";
    // 同一欄最近的那張：往下找第一個「頂端比這張底下還低」的那排，往上反過來。
    let best = null;
    let bestScore = Infinity;
    for (const c of all) {
      const b = c.getBoundingClientRect();
      if (down ? b.top < r.bottom - 1 : b.bottom > r.top + 1) continue;
      const score = Math.abs(down ? b.top - r.bottom : r.top - b.bottom) * 4 + Math.abs(b.left + b.width / 2 - cx);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best && !down) return search?.focus();
    focusCard(best);
  });
}

/**
 * 選中的那張從網格飛進右邊的大圖（畫廊版）。from：點的那張卡的圖；to：右邊剛畫好的大圖。
 * 飛的是一張影子：起點是卡上裁成直幅的樣子，終點是大圖完整的比例；落地前大圖先藏著。
 */
function flyToSeat(from, to) {
  if (!GALLERY || !MOTION || REDUCE_MOTION || !from || !to) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!a.width || !b.width || !from.currentSrc) return;
  const ghost = document.createElement("img");
  ghost.className = "lg-fly";
  ghost.src = from.currentSrc;
  ghost.alt = "";
  Object.assign(ghost.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
  document.body.appendChild(ghost);
  to.style.visibility = "hidden";
  const { DUR, CURVE, css } = MOTION;
  const lift = Math.min(60, Math.abs(b.left - a.left) * 0.12);
  const run = ghost.animate(
    [
      { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", borderRadius: "10px", boxShadow: "0 0 0 transparent" },
      { offset: 0.45, top: Math.min(a.top, b.top) - lift + "px", boxShadow: "0 30px 60px oklch(0% 0 0 / 0.55)" },
      { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px", borderRadius: "14px", boxShadow: "0 0 0 transparent" },
    ],
    { duration: DUR.xl, easing: css(CURVE.travel), fill: "forwards" }
  );
  const land = () => {
    to.style.visibility = "";
    ghost.remove();
  };
  run.finished.then(land, land);
}

function selectGenLora(l, fromCard) {
  if (sameLora(curSlot().lora, l)) return;
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
  const fromArt = fromCard?.querySelector?.(".lg-art img");
  renderGenCurrent();
  renderLmCurrent();
  renderLmList($("lm-search").value);
  const selected = $("lm-list")?.querySelector?.(".lora-row.on");
  selected?.classList.add("is-seated");
  if (focused) selected?.focus({ preventScroll: true });
  flyToSeat(fromArt, $("lm-current")?.querySelector?.(".lm-preview img"));
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

// 每個槽上次畫的是哪一個 LoRA：換了的那一格才播「放進去」（null＝還沒畫過，第一次不播）。
const SEAT_SEEN = [null, null];

function renderLmSlotTabs() {
  const wrap = document.createElement("div");
  wrap.className = "lm-slot-tabs";
  GEN_LORA_SLOTS.forEach((slot, i) => {
    const seatKey = slot.lora ? `${slot.lora.folder}/${slot.lora.file}` : "";
    const changed = SEAT_SEEN[i] !== null && SEAT_SEEN[i] !== seatKey;
    SEAT_SEEN[i] = seatKey;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "lm-slot-tab" + (GEN_ACTIVE_SLOT === i ? " on" : "") + (GALLERY && changed ? " is-new" : "");
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
    if (GALLERY && slot.lora) {
      const w = document.createElement("span");
      w.className = "lm-slot-tab-w";
      w.textContent = "×" + slot.strength.toFixed(2);
      meta.appendChild(w);
    }
    tab.appendChild(meta);
    tab.addEventListener("click", () => {
      const focused = document.activeElement === tab;
      hideLoraPreviewTip();
      setActiveSlot(i);
      renderLmCurrent();
      renderLmList($("lm-search").value);
      if (focused) $("lm-current")?.querySelector?.('.lm-slot-tab[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    if (slot.lora && !GALLERY) {
      tab.addEventListener("mouseenter", () => showSingleLoraPreviewTip(tab, slot.lora));
      tab.addEventListener("mouseleave", hideLoraPreviewTip);
    }
    if (slot.lora) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "lm-slot-clear";
      clear.title = `清空 LoRA ${i + 1}`;
      clear.setAttribute("aria-label", `清空 LoRA ${i + 1}`);
      clear.innerHTML = ICON_CLOSE;
      clear.addEventListener("click", (e) => {
        e.stopPropagation();
        hideLoraPreviewTip();
        const empty = () => {
          GEN_LORA_SLOTS[i] = { lora: null, strength: slot.strength, twPicks: new Set() };
          setActiveSlot(i);
          renderGenCurrent();
          renderLmCurrent();
          renderLmList($("lm-search").value);
        };
        // 畫廊版清的是正在看的那一槽：大圖、觸發詞、強度先往下沉著淡掉，再換成空的框。
        const parts = GALLERY && MOTION && !REDUCE_MOTION && GEN_ACTIVE_SLOT === i ? [...$("lm-current").children].slice(1) : [];
        if (!parts.length) return empty();
        clear.disabled = true;
        const { DUR, CURVE, css } = MOTION;
        const outs = parts.map((p, k) => p.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(0.98)" }], { duration: DUR.short, delay: k * 25, easing: css(CURVE.exit), fill: "forwards" }));
        Promise.all(outs.map((a) => a.finished)).then(empty, empty);
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
    none.className = GALLERY ? "lm-none lg-slot-empty" : "lm-none";
    none.textContent = GALLERY ? `LoRA ${GEN_ACTIVE_SLOT + 1} 空著——從中間挑一張` : `LoRA ${GEN_ACTIVE_SLOT + 1} 尚未選擇——從左邊清單點一個`;
    box.appendChild(none);
    return;
  }
  if (GALLERY && lora.preview) box.appendChild(seatPreview(lora));
  const head = document.createElement("div");
  head.className = "lm-cur-head";
  if (GALLERY) head.classList.add("is-plain");
  else if (lora.preview) head.appendChild(makeLoraPreviewEl(lora));
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
  // 詳情：在 ComfyUI 的 LoRA Manager 直接打開這一個 LoRA（?open=<folder>/<file>，
  // scripts/fetch_lora_manager.py 幫它補上的）。沒有 LoRA Manager、但有 Civitai 資料：開 Civitai 的模型頁。
  const civ = lora.civitai && lora.civitai.modelId;
  detailLink.title = LORA_MGR_URL ? "在 LoRA Manager 開這個 LoRA 的完整詳情（新分頁）" : "在 Civitai 開這個 LoRA 的頁面（新分頁）";
  const detailHref =
    (LORA_MGR_URL && `${LORA_MGR_URL}?open=${encodeURIComponent((lora.folder ? lora.folder + "/" : "") + (lora.file || ""))}`) ||
    (civ ? `https://civitai.com/models/${encodeURIComponent(lora.civitai.modelId)}${lora.civitai.versionId ? `?modelVersionId=${encodeURIComponent(lora.civitai.versionId)}` : ""}` : "");
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

  if (lora.preview && !GALLERY) {
    const pv = document.createElement("div");
    pv.className = "lm-preview";
    pv.style.animationDelay = tailDelay + 60 + "ms";
    const pvEl = makeLoraPreviewEl(lora, 960);
    if (isLoraPreviewVideo(lora)) pvEl.controls = true;
    pv.appendChild(pvEl);
    box.appendChild(pv);
  }
}

/** 畫廊版右邊最上面的大圖：直接載（不等捲到），卡上剛載過，快取裡就有，飛過來落地時已經畫好。 */
function seatPreview(lora) {
  const pv = document.createElement("div");
  pv.className = "lm-preview lg-seat";
  const el = makeLoraPreviewEl(lora);
  _loraPreviewIO.unobserve(el);
  el.src = el.dataset.src;
  delete el.dataset.src;
  if (el.tagName === "VIDEO") {
    el.controls = true;
    el.play().catch(() => {});
  } else upgradeSrc(el, sizedUrl(loraPreviewUrl(lora), 960));
  pv.appendChild(el);
  return pv;
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
  // 觸發詞本來就是英文：英文版翻成中文沒有用，也不必把詞送去 Google 翻譯。
  if (/^en\b/i.test(document.documentElement.lang || "")) return;
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
  if (GALLERY && anchor.closest?.(".lora-modal")) return;
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


// ---------- 偏好路徑：只看某個資料夾底下的 LoRA／底模（存在伺服器的 data/settings.json，不必碰 config.json） ----------
const ICON_FOLDER = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>`;
let PATHS = null;
async function fetchPaths(force = false) {
  if (PATHS && !force) return PATHS;
  try {
    PATHS = await fetch("/api/paths", { cache: "no-store" }).then((r) => r.json());
  } catch {
    PATHS = null;
  }
  return PATHS;
}
function shortPath(p) {
  const parts = String(p || "").replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length > 2 ? "…/" + parts.slice(-2).join("/") : String(p || "");
}
function renderPathBar(kind) {
  const host = $(kind === "lora" ? "lm-path" : "ckpt-path");
  if (!host) return;
  const info = (PATHS && PATHS[kind]) || { path: "", suggestions: [] };
  const open = host.dataset.open === "true";
  host.replaceChildren();
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ghost lm-path-btn";
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.title = info.path || (kind === "lora" ? "沒設定：列出 ComfyUI 的全部 LoRA" : "沒設定：列出 ComfyUI 的全部底模");
  btn.innerHTML = `${ICON_FOLDER}<span class="lm-path-label">偏好路徑</span><span class="lm-path-cur"></span>`;
  btn.querySelector(".lm-path-cur").textContent = info.path ? shortPath(info.path) : "全部";
  btn.addEventListener("click", () => {
    const panel = host.querySelector(".lm-path-panel");
    const live = GALLERY && MOTION && !REDUCE_MOTION;
    if (open && panel && live) {
      const a = panel.animate([{ height: panel.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: MOTION.DUR.short, easing: MOTION.css(MOTION.CURVE.exit), fill: "forwards" });
      a.finished.then(() => {
        host.dataset.open = "false";
        renderPathBar(kind);
      }, () => {});
      return;
    }
    host.dataset.open = open ? "false" : "true";
    renderPathBar(kind);
    if (!open) host.querySelector(".lm-path-input")?.focus();
    const grown = !open && live && host.querySelector(".lm-path-panel");
    if (grown) grown.animate([{ height: "0px", opacity: 0 }, { height: grown.offsetHeight + "px", opacity: 1 }], { duration: MOTION.DUR.medium, easing: MOTION.css(MOTION.CURVE.out) });
  });
  host.append(btn);
  if (!open) return;
  const panel = document.createElement("div");
  panel.className = "lm-path-panel";
  const hint = document.createElement("p");
  hint.className = "lm-path-hint";
  hint.textContent = kind === "lora" ? "只看這個資料夾底下的 LoRA。點下面的資料夾，或貼上路徑。" : "只看這個資料夾底下的底模。點下面的資料夾，或貼上路徑。";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "lm-path-input";
  input.value = info.path || "";
  input.placeholder = kind === "lora" ? "例如 D:\\ComfyUI\\models\\loras" : "例如 D:\\ComfyUI\\models\\checkpoints";
  input.spellcheck = false;
  input.setAttribute("aria-label", kind === "lora" ? "LoRA 資料夾路徑" : "底模資料夾路徑");
  const status = document.createElement("p");
  status.className = "lm-path-status";
  status.setAttribute("role", "status");
  const acts = document.createElement("div");
  acts.className = "lm-path-acts";
  const mk = (label, cls, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", fn);
    acts.append(b);
    return b;
  };
  if (PATHS && PATHS.pick) mk("選資料夾…", "ghost", () => pickFolder(kind, input, status));
  mk("套用", "lm-path-apply", () => applyPath(kind, input.value, status));
  if (info.path) mk("全部", "ghost", () => applyPath(kind, "", status));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyPath(kind, input.value, status);
    }
  });
  const list = document.createElement("ul");
  list.className = "lm-path-list";
  for (const sgt of info.suggestions || []) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lm-path-sgt";
    b.dataset.depth = String(sgt.depth || 0);
    b.setAttribute("aria-pressed", sgt.path === info.path ? "true" : "false");
    b.title = sgt.path;
    const name = document.createElement("span");
    name.textContent = sgt.depth ? shortPath(sgt.path).split("/").pop() : shortPath(sgt.path);
    const n = document.createElement("small");
    n.textContent = String(sgt.count);
    b.append(name, n);
    b.addEventListener("click", () => applyPath(kind, sgt.path, status));
    li.append(b);
    list.append(li);
  }
  panel.append(hint, input, acts, status, list);
  host.append(panel);
}
async function applyPath(kind, path, status) {
  if (status) status.textContent = "套用中…";
  let data = null;
  try {
    const r = await fetch("/api/paths", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, path }) });
    data = await r.json();
  } catch (e) {
    data = { ok: false, error: e.message };
  }
  if (!data || !data.ok) {
    if (status) status.textContent = (data && data.error) || "存不起來";
    return;
  }
  await fetchPaths(true);
  if (kind === "lora") {
    GEN_LORAS = null;
    await fetchGenLoras();
    renderLmCats();
    renderLmSubcats();
    renderLmList($("lm-search").value, true);
  } else {
    GEN_CKPTS = null;
    await fetchCkpts();
    renderCkptList($("ckpt-search")?.value, true);
    renderCkptCurrent();
    renderCkptBtn();
  }
  renderPathBar(kind);
  const st = $(kind === "lora" ? "lm-path" : "ckpt-path")?.querySelector(".lm-path-status");
  if (st) st.textContent = data.path ? `找到 ${data.count} 個${kind === "lora" ? " LoRA" : "底模"}` : "改回 ComfyUI 的全部";
}
async function pickFolder(kind, input, status) {
  status.textContent = "電腦上跳出了資料夾視窗，選好再按確定…";
  try {
    const r = await fetch("/api/paths/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, initial: input.value }) });
    const data = await r.json();
    if (!data.ok) {
      status.textContent = data.error || "開不了資料夾視窗";
      return;
    }
    if (!data.path) {
      status.textContent = "沒有選資料夾";
      return;
    }
    input.value = data.path;
    await applyPath(kind, data.path, status);
  } catch (e) {
    status.textContent = e.message;
  }
}

async function openLoraModal() {
  overlayOpen($("lora-modal"));
  // 畫廊版先排一排空的卡框（光掃過去），清單到了直接換上，版面不會跳。
  if (!GEN_LORAS) $("lm-list").innerHTML = '<div class="lora-empty">載入中…</div>' + (GALLERY ? '<span class="lg-skel" aria-hidden="true"></span>'.repeat(12) : "");
  renderLmCurrent();
  await fetchGenLoras();
  renderLmCats();
  renderLmSubcats();
  renderLmList($("lm-search").value, true);
  focusEntry($("lm-search"), $("lora-modal-close"));
  fetchPaths().then(() => renderPathBar("lora"));
}
function closeLoraModal() {
  const modal = $("lora-modal");
  hideLoraPreviewTip();
  for (const g of document.querySelectorAll(".lg-fly")) for (const a of g.getAnimations()) a.finish();
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
  if (!$("lora-modal") && GALLERY) {
    // 畫廊版：左邊找（搜尋、分類、隨機、偏好路徑）、中間挑（大圖網格）、右邊用（兩個槽、觸發詞、強度）。
    const modal = document.createElement("div");
    modal.id = "lora-modal";
    modal.className = "lora-modal lg-modal";
    modal.inert = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "lm-title");
    modal.innerHTML = `
      <div class="lora-modal-inner lg">
        <button class="lora-modal-close" id="lora-modal-close" aria-label="關閉 (Esc)" title="關閉 (Esc)">${ICON_CLOSE}</button>
        <aside class="lg-rail">
          <h2 class="lg-title" id="lm-title">LoRA</h2>
          <div class="lm-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="lm-search" placeholder="搜尋 LoRA…" autocomplete="off" spellcheck="false">
          </div>
          <div id="lm-cats" class="lm-cats"></div>
          <div id="lm-subcats" class="lm-subcats"></div>
          <button class="ghost lm-random-btn" id="lm-random-btn" title="隨機抽幾個 LoRA 攤開來看（點一張直接選中）">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.3" cy="8.3" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.7" cy="8.3" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.3" cy="15.7" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.7" cy="15.7" r="1.2" fill="currentColor" stroke="none"/></svg>
            隨機瀏覽
          </button>
          <div class="lg-rail-foot">
            <div class="lm-path" id="lm-path"></div>
            <a class="lm-manager-link" id="lm-manager-link" href="#" target="_blank" rel="noopener">
              <img src="data:image/png;base64,${LORA_MGR_LOGO_B64}" alt="" width="16" height="16">用 LoRA Manager 管理（新分頁）
            </a>
          </div>
        </aside>
        <section class="lg-main" aria-labelledby="lm-title">
          <p class="lg-count" id="lm-count" aria-live="polite"></p>
          <div id="lm-list" class="lm-list lg-grid"></div>
        </section>
        <aside class="lm-right lg-side">
          <div class="lm-right-head">目前選擇</div>
          <div id="lm-current" class="lm-current"></div>
        </aside>
      </div>`;
    document.body.appendChild(modal);
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
          <div class="lm-path" id="lm-path"></div>
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
  if (!$("ckpt-modal") && GALLERY) {
    const modal = document.createElement("div");
    modal.id = "ckpt-modal";
    modal.className = "lora-modal ckpt-modal lg-modal";
    modal.inert = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "ckpt-head-title");
    modal.innerHTML = `
      <div class="lora-modal-inner lg">
        <button class="lora-modal-close" id="ckpt-modal-close" aria-label="關閉 (Esc)" title="關閉 (Esc)">${ICON_CLOSE}</button>
        <aside class="lg-rail">
          <h2 class="lg-title" id="ckpt-head-title">底模</h2>
          <p class="lg-hint">清單來自 ComfyUI。點一張換過去，之後生圖都用它。</p>
          <div class="lm-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="ckpt-search" placeholder="搜尋底模…" autocomplete="off" spellcheck="false">
          </div>
          <div class="lg-rail-foot">
            <div class="lm-path" id="ckpt-path"></div>
            <a class="lm-manager-link" id="ckpt-manager-link" href="#" target="_blank" rel="noopener">
              <img src="data:image/png;base64,${LORA_MGR_LOGO_B64}" alt="" width="16" height="16">用 LoRA Manager 管理（新分頁）
            </a>
          </div>
        </aside>
        <section class="lg-main" aria-labelledby="ckpt-head-title">
          <p class="lg-count" id="ckpt-count" aria-live="polite"></p>
          <div id="ckpt-list" class="lm-list lg-grid"></div>
        </section>
        <aside class="lm-right lg-side">
          <div class="lm-right-head">目前選擇</div>
          <div id="ckpt-current" class="lm-current"></div>
        </aside>
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
            <p class="ckpt-head-hint">清單來自 ComfyUI。點左邊換一顆，生圖用目前這顆。</p>
          </div>
          <div class="lm-path" id="ckpt-path"></div>
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
      // 焦點在按鈕上（畫廊的卡、槽、分類）：Enter 是按那顆鈕，不是關面板。
      if (e.target?.closest?.("button, a")) return true;
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

function ckptPreviewUrl(c, w = 480) {
  return sizedUrl(c.previewUrl || `/api/ckpt-preview?file=${encodeURIComponent(c.preview)}`, w);
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
    none.className = GALLERY ? "lm-none lg-slot-empty" : "lm-none";
    none.textContent = !(GEN_CKPTS || []).length ? "這個資料夾沒有 checkpoint" : GALLERY ? "還沒選底模——從中間挑一張" : "還沒選底模——從左邊清單點一個";
    box.appendChild(none);
    return;
  }
  if (GALLERY && cur.preview) {
    const pv = document.createElement("div");
    pv.className = "lm-preview lg-seat";
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.src = ckptPreviewUrl(cur);
    upgradeSrc(img, ckptPreviewUrl(cur, 960));
    pv.appendChild(img);
    box.appendChild(pv);
  }
  const head = document.createElement("div");
  head.className = "lm-cur-head";
  if (GALLERY) head.classList.add("is-plain");
  else if (cur.preview) {
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
  if (GALLERY) return;
  if (cur.preview) {
    const pv = document.createElement("div");
    pv.className = "lm-preview";
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.src = ckptPreviewUrl(cur, 960);
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

function selectCkpt(c, fromCard) {
  const focused = document.activeElement?.closest?.("#ckpt-list .lora-row");
  const fromArt = fromCard?.querySelector?.(".lg-art img");
  const prevCkpt = GEN_CKPT;
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
  if (GALLERY && GEN_CKPT !== prevCkpt) flyToSeat(fromArt, $("ckpt-current")?.querySelector?.(".lm-preview img"));
  toast(`底模已換成「${c.title || c.file}」`);
}

function renderCkptList(filter, deal = false) {
  const box = $("ckpt-list");
  if (!box || !ckptModalShown()) return;
  const q = (filter || "").toLowerCase().trim();
  if (GALLERY && !deal && box._gallery?.key === q && box.dataset.result === "found") return refreshGalleryMarks(box);
  let items = GEN_CKPTS || [];
  if (q) items = items.filter((c) => (c.title || "").toLowerCase().includes(q) || c.file.toLowerCase().includes(q));
  syncCount("ckpt-count", items.length);
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
  if (GALLERY) {
    items.forEach((c, i) => {
      let preview = null;
      if (c.preview) {
        preview = document.createElement("img");
        preview.alt = "";
        preview.decoding = "async";
        preview.loading = "lazy";
        preview.src = ckptPreviewUrl(c);
      }
      const card = galleryCard({ preview, title: c.title || c.file, sub: c.file, seat: "", on: c.ckpt_name === GEN_CKPT, deal, i });
      card._mark = () => ({ seat: "", on: c.ckpt_name === GEN_CKPT });
      card.addEventListener("click", () => selectCkpt(c, card));
      box.appendChild(card);
    });
    box._gallery = { key: q };
    markPress(box);
    return;
  }
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
  renderCkptList($("ckpt-search")?.value, true);
  renderCkptCurrent();
  focusEntry($("ckpt-search"), $("ckpt-modal-close"));
  fetchPaths().then(() => renderPathBar("ckpt"));
}
function closeCkptModal() {
  for (const g of document.querySelectorAll(".lg-fly")) for (const a of g.getAnimations()) a.finish();
  fadeCloseOverlay($("ckpt-modal"), null, () => renderCkptBtn());
}

/**
 * gallery：畫廊版（墨池 web6）。motion：{ DUR, CURVE, css }（web6/motion.js），選中時飛進槽用。
 */
export function initLoraPicker({ gallery = false, motion = null } = {}) {
  GALLERY = !!gallery;
  MOTION = motion;
  ensureDom();
  if (GALLERY) {
    gridKeys($("lm-list"), $("lm-search"));
    gridKeys($("ckpt-list"), $("ckpt-search"));
  }
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
  let ckptSearchT = 0;
  $("ckpt-search")?.addEventListener("input", () => {
    if (!GALLERY) return renderCkptList($("ckpt-search").value);
    clearTimeout(ckptSearchT);
    ckptSearchT = setTimeout(() => renderCkptList($("ckpt-search").value, "quick"), 120);
  });
  $("lora-pick-btn").addEventListener("mouseenter", () => showLoraPreviewTip($("lora-pick-btn")));
  $("lora-pick-btn").addEventListener("mouseleave", hideLoraPreviewTip);
  $("lora-modal-close").addEventListener("click", closeLoraModal);
  $("lora-modal").addEventListener("click", (e) => {
    if (e.target.id === "lora-modal") closeLoraModal();
  });
  let loraSearchT = 0;
  $("lm-search").addEventListener("input", () => {
    if (!GALLERY) return renderLmList($("lm-search").value, true);
    clearTimeout(loraSearchT);
    loraSearchT = setTimeout(() => renderLmList($("lm-search").value, true, "quick"), 120);
  });
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
    const w = $("lm-current").querySelector(".lm-slot-tab.on .lm-slot-tab-w");
    if (w) w.textContent = "×" + slot.strength.toFixed(2);
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
  // 等頁面載完再開始聽：長輪詢一開就佔住一條連線 25 秒，瀏覽器對同一台最多只開 6 條，
  // 手機走 Tailscale 開頁時正在抓幾十張卡圖、模組，少一條就慢一截。
  if (document.readyState === "complete") setTimeout(pollLoraPush, 1500);
  else addEventListener("load", () => setTimeout(pollLoraPush, 1500), { once: true });
}
