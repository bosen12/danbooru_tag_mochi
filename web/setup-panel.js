/**
 * 第一次使用的準備面板：伺服器在背景做的事（setup_tasks.py → /api/setup）攤在畫面左下角。
 *   卡面下載、LoRA Manager、放大模型、姿勢參考、烘焙卡面：進度一行一行跟著更新；
 *   要問的（姿勢參考、成人卡面、角色卡面）在這裡按；要重開 ComfyUI 也是這裡一顆鈕（透過 ComfyUI-Manager）。
 * 什麼都不用做的人（第二次以後）完全看不到它。四個房間共用，頁面載入就自己掛上。
 * 伺服器端的 setup_tasks 只在這個檔存在的版面才會開（server.py main）。
 */
import { el } from "./ui.js";
import { DUR, CURVE, css, reducedMotion } from "./motion.js";

const POLL_MS = 2500;
const ICON = { wait: "…", run: "", ask: "?", restart: "↻", done: "✓", skip: "–", error: "!" };
// 答案按鈕的字（中文是原文，英文版由 i18n 換）。
const ANSWER = {
  lora: [["yes", "允許", true], ["no", "這次不要"], ["never", "不要再問"]],
  pose: [["yes", "安裝", true], ["no", "這次不要"], ["never", "不要再問"]],
  face: [["yes", "安裝", true], ["no", "這次不要"], ["never", "不要再問"]],
  tagger: [["yes", "安裝", true], ["no", "這次不要"], ["never", "不要再問"]],
  bake: [["yes", "烘", true], ["no", "這次不要"]],
  bake_adult: [["yes", "烘", true], ["no", "這次不要"]],
  bake_chars: [["yes", "烘", true], ["no", "這次不要"], ["never", "不要再問"]],
};

let box = null;
let list = null;
let foot = null;
let note = null;
let quiet = null; // 第一次拿到時就已經好了（或不用做）的項目：不列出來
let timer = 0;
// 收合記在這個分頁：墨池、疊印台、卡冊、作品冊是四個頁面，不記的話每換一頁又展開
//（手機上它在最上面，會蓋住頁籤和分級）。
const COLLAPSED_KEY = "mochi.setup.collapsed";
// 收著的時候冒出新的問題（要不要烘、要不要裝）就打開：記下這個分頁看過哪些問題。
const ASKED_KEY = "mochi.setup.asked";
const stored = (key) => {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
};
const store = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* 存不了就只記這一頁。 */
  }
};
let collapsed = stored(COLLAPSED_KEY) === "1";
let finishedAt = 0;

function render(snap) {
  if (!snap || !snap.started) return hide();
  // 這一頁打開時就已經好了的不列：連「下載好了，重新整理就有圖」也不列 —— 這一頁本來就載到新圖了。
  if (!quiet) quiet = new Set(snap.items.filter((it) => it.state === "done" || it.state === "skip").map((it) => it.id));
  const shown = snap.items.filter((it) => !quiet.has(it.id) && it.state !== "idle");
  const reload = shown.some((it) => it.reload);
  if (!snap.active && !reload) {
    if (!shown.length) return hide();
    // 都好了：說一聲再收起來。
    finishedAt ||= Date.now();
    if (Date.now() - finishedAt > 6000) return hide();
  }
  if (!box) mount();
  document.documentElement.dataset.setup = "";
  // 內容沒變就不重畫：按鈕被換掉的話，滑鼠正要按、鍵盤焦點都會落空。
  const sig = JSON.stringify([snap.active, snap.restart, shown]);
  if (sig === box.dataset.sig) return;
  box.dataset.sig = sig;
  const done = shown.filter((it) => it.state === "done" || it.state === "skip").length;
  // 伺服器剛開、每一步都還沒動（全是 idle）：不寫「0/0」。
  box.querySelector(".setup-title").textContent = !snap.active ? "準備好了" : shown.length ? `第一次使用：準備中 ${done}/${shown.length}` : "第一次使用：準備中…";
  box.dataset.collapsed = collapsed ? "true" : "false";
  list.replaceChildren(...shown.map(row));
  const acts = [];
  if (snap.restart) acts.push(el("button", { class: "btn btn-small btn-primary", type: "button", onclick: restart }, "重開 ComfyUI"));
  if (reload) acts.push(el("button", { class: "btn btn-small", type: "button", onclick: () => location.reload() }, "重新整理看新圖"));
  foot.replaceChildren(...acts);
  foot.hidden = !acts.length;
  // 內容換好才量：展開的過場要長到新內容的大小。
  const asking = shown.filter((it) => it.state === "ask").map((it) => it.id).join();
  if (asking && asking !== stored(ASKED_KEY)) setCollapsed(false);
  store(ASKED_KEY, asking);
}

/**
 * 收合／展開。面板大小直接跳的話（手機上寬度 359 → 202px）很突兀：從舊的大小長到新的，
 * 展開時清單跟著淡進來。量大小用 FLIP：先量、切狀態、再量，從舊的動到新的。
 */
function setCollapsed(v) {
  const was = box.getBoundingClientRect();
  collapsed = v;
  store(COLLAPSED_KEY, v ? "1" : "0");
  box.querySelector(".setup-head").setAttribute("aria-expanded", v ? "false" : "true");
  box.dataset.collapsed = v ? "true" : "false";
  if (reducedMotion() || !was.width) return;
  const now = box.getBoundingClientRect();
  if (Math.abs(now.width - was.width) < 1 && Math.abs(now.height - was.height) < 1) return;
  box._size?.cancel();
  box.style.overflow = "hidden";
  box._size = box.animate([{ width: `${was.width}px`, height: `${was.height}px` }, { width: `${now.width}px`, height: `${now.height}px` }], { duration: DUR.short, easing: css(CURVE.out) });
  box._size.onfinish = () => (box.style.overflow = "");
  if (!v) for (const n of [list, note]) n.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, delay: 60, easing: css(CURVE.out), fill: "backwards" });
}

// 跑很久的（烘幾百張卡面、下載 2.5 GB）可以停；已經做好的留著，下次啟動接著做或再問。
const STOPPABLE = new Set(["bake", "bake_adult", "bake_chars", "pose", "face", "tagger"]);
// 上面沒列到的新步驟（setup_tasks.py 加了、這裡忘了補）：照伺服器給的 answers 顯示，不能一顆鈕都沒有、答不了。
const ANSWER_FALLBACK = { yes: ["yes", "安裝", true], no: ["no", "這次不要"], never: ["never", "不要再問"] };
const answersOf = (it) => ANSWER[it.id] || (it.answers || []).map((a) => ANSWER_FALLBACK[a]).filter(Boolean);

function row(it) {
  const answers = it.state === "ask" ? answersOf(it) : it.state === "run" && STOPPABLE.has(it.id) ? [["stop", "停止"]] : [];
  return el(
    "li",
    { class: "setup-item", dataset: { state: it.state } },
    el("span", { class: "setup-icon", "aria-hidden": "true" }, ICON[it.state] ?? ""),
    el(
      "span",
      { class: "setup-body" },
      el("b", {}, it.title),
      it.text ? el("small", {}, it.text) : null,
      answers.length
        ? el(
            "span",
            { class: "setup-answers" },
            answers.map(([value, label, primary]) =>
              el("button", { class: "btn btn-small" + (primary ? " btn-primary" : ""), type: "button", onclick: () => send(it.id, value) }, label)
            )
          )
        : null
    )
  );
}

function mount() {
  list = el("ul", { class: "setup-list" });
  foot = el("div", { class: "setup-foot" });
  note = el("p", { class: "setup-note", role: "status", "aria-live": "polite" });
  const head = el(
    "button",
    { class: "setup-head", type: "button", "aria-expanded": collapsed ? "false" : "true", onclick: () => {
      setCollapsed(!collapsed);
    } },
    el("b", { class: "setup-title" }),
    el("span", { class: "setup-chev", "aria-hidden": "true" }, "▾")
  );
  box = el("section", { class: "setup-panel", id: "setup-panel", "aria-label": "第一次使用的準備" }, head, list, note, foot);
  document.body.append(box);
}

function hide() {
  clearTimeout(timer);
  timer = 0;
  box?.remove();
  box = null;
  delete document.documentElement.dataset.setup;
}

async function send(id, answer) {
  note.textContent = "";
  try {
    const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, answer }) });
    const data = await r.json();
    if (!data.ok && data.error) note.textContent = data.error;
    render(data);
  } catch (e) {
    note.textContent = String(e.message || e);
  }
  schedule();
}

function restart() {
  send("restart", "");
  note.textContent = "ComfyUI 重開中，大約半分鐘";
}

async function poll() {
  timer = 0;
  let snap = null;
  try {
    snap = await fetch("/api/setup", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
  } catch {
    /* 伺服器一下子沒回應：下一輪再問 */
  }
  render(snap);
  if (snap && snap.started && (snap.active || box)) schedule();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(poll, POLL_MS);
}

if (typeof document !== "undefined" && !navigator.webdriver) poll();
