/**
 * 第一次使用的準備面板：伺服器在背景做的事（setup_tasks.py → /api/setup）攤在畫面左下角。
 *   卡面下載、LoRA Manager、放大模型、姿勢參考、烘焙卡面：進度一行一行跟著更新；
 *   要問的（姿勢參考、成人卡面）在這裡按；要重開 ComfyUI 也是這裡一顆鈕（透過 ComfyUI-Manager）。
 * 什麼都不用做的人（第二次以後）完全看不到它。四個房間共用，頁面載入就自己掛上。
 * 伺服器端的 setup_tasks 只在這個檔存在的版面才會開（server.py main）。
 */
import { el } from "./ui.js";

const POLL_MS = 2500;
const ICON = { wait: "…", run: "", ask: "?", restart: "↻", done: "✓", skip: "–", error: "!" };
// 答案按鈕的字（中文是原文，英文版由 i18n 換）。
const ANSWER = {
  lora: [["yes", "允許", true], ["no", "這次不要"], ["never", "不要再問"]],
  pose: [["yes", "安裝", true], ["no", "這次不要"], ["never", "不要再問"]],
  bake_adult: [["yes", "烘", true], ["no", "這次不要"]],
};

let box = null;
let list = null;
let foot = null;
let note = null;
let quiet = null; // 第一次拿到時就已經好了（或不用做）的項目：不列出來
let timer = 0;
let collapsed = false;
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
  box.querySelector(".setup-title").textContent = snap.active ? `第一次使用：準備中 ${done}/${shown.length}` : "準備好了";
  box.dataset.collapsed = collapsed ? "true" : "false";
  list.replaceChildren(...shown.map(row));
  const acts = [];
  if (snap.restart) acts.push(el("button", { class: "btn btn-small btn-primary", type: "button", onclick: restart }, "重開 ComfyUI"));
  if (reload) acts.push(el("button", { class: "btn btn-small", type: "button", onclick: () => location.reload() }, "重新整理看新圖"));
  foot.replaceChildren(...acts);
  foot.hidden = !acts.length;
}

// 跑很久的（烘幾百張卡面、下載 2.5 GB）可以停；已經做好的留著，下次啟動接著做或再問。
const STOPPABLE = new Set(["bake", "bake_adult", "pose"]);

function row(it) {
  const answers = it.state === "ask" ? ANSWER[it.id] || [] : it.state === "run" && STOPPABLE.has(it.id) ? [["stop", "停止"]] : [];
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
    { class: "setup-head", type: "button", "aria-expanded": "true", onclick: () => {
      collapsed = !collapsed;
      head.setAttribute("aria-expanded", collapsed ? "false" : "true");
      box.dataset.collapsed = collapsed ? "true" : "false";
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
