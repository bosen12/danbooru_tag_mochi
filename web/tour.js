/**
 * 新手導覽（頂欄「教學」右邊的「導覽」）：一步一步帶你用這一頁。
 *   - 畫面變暗、只亮出這一步要看的那一塊，旁邊一個文字小視窗（第幾步、說明、上一步／下一步／結束）。
 *   - 有的步驟要你真的動手（點一張牌、打開字盒…）：做到了打勾、自動到下一步；也可以「跳過這步」。
 *   - 每個房間自己的步驟（tour-steps.js）；手機和電腦指的地方不一樣，找不到目標的步驟自動略過。
 *   - 第一次來這個房間：角落冒出一張小卡「第一次來？一步一步帶你走一遍」，關掉或走完就不再出現。
 *     自動化測試（navigator.webdriver）不出現，免得擋到別的測試。
 *   - 鍵盤：→／Enter 下一步、← 上一步、Esc 結束（彈窗開著時 Esc 讓給彈窗）。
 * 導覽層的 id 是 "tour"：web/scroll-lock.js 的 NEVER_INERT 有它，彈窗開著時小視窗照樣按得到。
 */
import { el, anyOverlay } from "./ui.js";
import { STEPS, ROOM_ZH } from "./tour-steps.js";

const SEEN_KEY = (room) => `mochi.tour.${room}.v1`;
const PAD = 8;
const phoneMQ = matchMedia("(max-width: 40rem)");

function seen(room) {
  try {
    return localStorage.getItem(SEEN_KEY(room)) === "1";
  } catch {
    return true;
  }
}

function markSeen(room) {
  try {
    localStorage.setItem(SEEN_KEY(room), "1");
  } catch {
    /* 存不了：下次再問一次而已 */
  }
}

const visible = (n) => {
  if (!n || !n.isConnected) return false;
  const r = n.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(n);
  return s.visibility !== "hidden" && s.display !== "none";
};

let active = null;

/** 開始這一頁的導覽。from：第幾步開始。 */
export function startTour(room, from = 0) {
  if (active) active.end(false);
  const phone = phoneMQ.matches;
  const steps = (STEPS[room] || []).filter((s) => !s.when || s.when({ phone }));
  if (!steps.length) return;
  markSeen(room);
  document.getElementById("tour-offer")?.remove();

  const ring = el("div", { class: "tour-ring", "aria-hidden": "true" });
  const dim = el("div", { class: "tour-dim", "aria-hidden": "true" });
  const count = el("span", { class: "tour-count" });
  const title = el("h2", { class: "tour-title", id: "tour-title" });
  const text = el("p", { class: "tour-text" });
  const todo = el("p", { class: "tour-todo" });
  const prev = el("button", { class: "btn btn-small tour-prev", type: "button" }, "上一步");
  const next = el("button", { class: "btn btn-small btn-primary tour-next", type: "button" }, "下一步");
  const skip = el("button", { class: "btn btn-small tour-skip", type: "button" }, "跳過這步");
  const quit = el("button", { class: "tour-quit", type: "button", "aria-label": "結束導覽", title: "結束導覽（Esc）" }, "✕");
  const card = el(
    "div",
    { class: "tour-card", role: "dialog", "aria-modal": "false", "aria-labelledby": "tour-title" },
    el("div", { class: "tour-head" }, count, quit),
    title,
    text,
    todo,
    el("div", { class: "tour-foot" }, prev, skip, next)
  );
  const layer = el("div", { class: "tour", id: "tour" }, dim, ring, card);
  document.body.append(layer);

  let i = -1;
  let timer = 0;
  let doneAt = 0;
  let target = null;

  function place() {
    const step = steps[i];
    target = step?.target ? step.target({ phone }) : null;
    const show = target && visible(target);
    const vw = innerWidth;
    const vh = innerHeight;
    if (show && step.spot !== false) {
      const r = target.getBoundingClientRect();
      const x = Math.max(4, r.left - PAD);
      const y = Math.max(4, r.top - PAD);
      ring.style.cssText = `left:${x}px;top:${y}px;width:${Math.min(vw - x - 4, r.width + PAD * 2)}px;height:${Math.min(vh - y - 4, r.height + PAD * 2)}px`;
      ring.hidden = false;
      dim.hidden = true;
    } else {
      ring.hidden = true;
      // 沒有要亮的東西（開場、結尾）：整片變暗；步驟說「不要暗」（彈窗開著時）就不蓋。
      dim.hidden = step?.dim === false;
    }
    // 小視窗：手機貼在上或下（避開亮的那塊）；電腦放在目標下面，放不下就上面，再不行就旁邊，都夾在畫面裡。
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let left;
    let top;
    if (!show || step.spot === false) {
      left = (vw - cw) / 2;
      top = phone ? vh - ch - 12 : (vh - ch) / 2;
    } else {
      const r = target.getBoundingClientRect();
      if (phone) {
        left = (vw - cw) / 2;
        top = r.top + r.height / 2 > vh / 2 ? 12 : vh - ch - 12;
      } else if (r.bottom + PAD + 12 + ch < vh) {
        left = r.left + r.width / 2 - cw / 2;
        top = r.bottom + PAD + 12;
      } else if (r.top - PAD - 12 - ch > 0) {
        left = r.left + r.width / 2 - cw / 2;
        top = r.top - PAD - 12 - ch;
      } else if (r.right + PAD + 16 + cw < vw) {
        left = r.right + PAD + 16;
        top = r.top + r.height / 2 - ch / 2;
      } else {
        left = r.left - PAD - 16 - cw;
        top = r.top + r.height / 2 - ch / 2;
      }
    }
    card.style.left = `${Math.round(Math.max(8, Math.min(vw - cw - 8, left)))}px`;
    card.style.top = `${Math.round(Math.max(8, Math.min(vh - ch - 8, top)))}px`;
  }

  function go(n) {
    if (n < 0) n = 0;
    if (n >= steps.length) return end(true);
    // 找不到目標的步驟（這個畫面沒有那個東西）往同一個方向略過。
    const dir = n >= i ? 1 : -1;
    const shows = (s) => !s.target || visible(s.target({ phone }));
    while (n >= 0 && n < steps.length && !shows(steps[n])) n += dir;
    if (n >= steps.length) return end(true);
    if (n < 0) n = 0;
    i = n;
    doneAt = 0;
    const step = steps[i];
    step.enter?.({ phone });
    count.textContent = `${ROOM_ZH[room]}導覽・${i + 1} / ${steps.length}`;
    title.textContent = step.title;
    text.textContent = step.text;
    todo.textContent = step.wait ? `👉 ${step.todo || "做做看，做到了會自動到下一步。"}` : "";
    todo.hidden = !step.wait;
    card.dataset.wait = step.wait ? "true" : "false";
    card.dataset.done = "false";
    prev.disabled = i === 0;
    skip.hidden = !step.wait;
    next.hidden = !!step.wait;
    next.textContent = i === steps.length - 1 ? "完成" : "下一步";
    const t = step.target ? step.target({ phone }) : null;
    if (t && visible(t)) {
      const r = t.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight - 40) t.scrollIntoView({ block: "center", behavior: "instant" });
    }
    place();
    (step.wait ? skip : next).focus({ preventScroll: true });
  }

  function tick() {
    if (i < 0) return;
    const step = steps[i];
    place();
    if (step.wait && !doneAt && step.wait({ phone })) {
      doneAt = performance.now();
      card.dataset.done = "true";
      todo.textContent = "✓ 做到了！";
    }
    if (doneAt && performance.now() - doneAt > 650) go(i + 1);
  }

  function end(done) {
    clearInterval(timer);
    removeEventListener("keydown", onKey, true);
    removeEventListener("resize", place);
    removeEventListener("scroll", onScroll, true);
    layer.remove();
    active = null;
    if (done) markSeen(room);
  }

  const onScroll = () => place();
  const onKey = (e) => {
    if (anyOverlay() && !e.target?.closest?.("#tour")) return; // 彈窗開著：鍵盤讓給彈窗
    if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      end(false);
    } else if (e.key === "ArrowRight" && !steps[i]?.wait) {
      e.preventDefault();
      e.stopPropagation();
      go(i + 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      e.stopPropagation();
      go(i - 1);
    }
  };
  prev.addEventListener("click", () => go(i - 1));
  next.addEventListener("click", () => go(i + 1));
  skip.addEventListener("click", () => go(i + 1));
  quit.addEventListener("click", () => end(false));
  addEventListener("keydown", onKey, true);
  addEventListener("resize", place);
  addEventListener("scroll", onScroll, true);
  // 用計時器（不靠 rAF）：分頁在背景、版面在動（抽屜滑出、牌飛進池子）時照樣跟得上。
  timer = setInterval(tick, 250);
  active = { end };
  go(from);
  return active;
}

/** 頂欄「教學」右邊的「導覽」，加上第一次來的邀請卡。 */
export function mountTour(room) {
  const learn = document.querySelector('.mast-extra[href="tutorial.html"]');
  if (learn && !document.getElementById("tour-btn")) {
    const b = el("button", { class: "mast-extra tour-btn", id: "tour-btn", type: "button", title: `一步一步帶你用${ROOM_ZH[room]}（文字導覽，配合畫面操作）` }, "導覽");
    b.addEventListener("click", () => startTour(room));
    learn.after(b);
    // 介紹影片、教學、導覽包成一組：窄螢幕放不下時整組一起換行，不會只有「導覽」自己掉到下一行。
    const links = el("span", { class: "mast-links" });
    const intro = document.querySelector('.mast-extra[href="intro.html"]');
    (intro && intro.parentElement === learn.parentElement ? intro : learn).before(links);
    links.append(...[intro, learn, b].filter((n) => n && n.parentElement === links.parentElement));
  }
  if (seen(room) || navigator.webdriver) return;
  // 第一次來：等頁面安定一下再冒出來，不跟開場動畫搶。
  setTimeout(() => {
    if (seen(room) || active || document.getElementById("tour-offer")) return;
    const close = () => {
      markSeen(room);
      offer.remove();
    };
    const offer = el(
      "div",
      { class: "tour-offer", id: "tour-offer", role: "dialog", "aria-label": "新手導覽" },
      el("p", {}, el("b", {}, `第一次來${ROOM_ZH[room]}？`), el("span", {}, "一步一步帶你走一遍，邊看邊操作，大約一分鐘。")),
      el(
        "div",
        { class: "tour-offer-foot" },
        el("button", { class: "btn btn-small btn-primary", type: "button", onclick: () => startTour(room) }, "開始導覽"),
        el("button", { class: "btn btn-small", type: "button", onclick: close }, "不用了")
      )
    );
    document.body.append(offer);
  }, 1400);
}
