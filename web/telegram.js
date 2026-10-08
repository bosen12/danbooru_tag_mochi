// 送到 Telegram 頻道。齒輪按鈕在桅杆列（跟「選 LoRA」同一排），面板填 token 與 chat id。
//
// token 只走伺服器：POST 上去存進 .secrets/telegram.json，GET 回來只有末四碼。
// 送圖是 fire-and-forget —— 伺服器收下就回，實際上傳在它的背景執行緒，抽圖不等它。

import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { setServiceStatus } from "./service-settings.js";

const $ = (id) => document.getElementById(id);

let status = { configured: false, enabled: false, chatId: "", tokenTail: "" };
let poll = 0;

function reduceMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function getJson(url, init) {
  const r = await fetch(url, init);
  return r.json();
}

function ensureDom() {
  if ($("tg-modal")) return;
  const wrap = document.createElement("div");
  wrap.className = "tg-modal";
  wrap.id = "tg-modal";
  wrap.innerHTML = `
    <div class="tg-inner" role="dialog" aria-modal="true" aria-labelledby="tg-title">
      <header class="tg-head">
        <div>
          <h2 id="tg-title">送到 Telegram</h2>
          <p class="tg-state" id="tg-state">讀取中…</p>
        </div>
        <button type="button" class="ghost tg-close" id="tg-close" aria-label="關閉">✕</button>
      </header>
      <div class="tg-body">
        <label class="tg-field">
          <span>Bot token</span>
          <input id="tg-token" type="password" autocomplete="off" spellcheck="false" placeholder="123456789:AAE…" />
          <em>存在伺服器的 <code>.secrets/telegram.json</code>，不進 git、不會回傳瀏覽器。留空＝沿用已存的。</em>
        </label>
        <label class="tg-field">
          <span>Chat ID</span>
          <input id="tg-chat" type="text" autocomplete="off" spellcheck="false" placeholder="@my_channel 或 -1001234567890" />
          <em>公開頻道填 <code>@帳號</code>；私人頻道填 <code>-100</code> 開頭的數字。bot 要先加進該頻道並給發文權限。</em>
        </label>
        <button type="button" class="same-switch tg-switch" id="tg-enabled" role="switch" aria-checked="false" aria-describedby="tg-enabled-hint">
          <span class="same-knob" aria-hidden="true"><i></i></span>
          <span class="same-copy">
            <strong>每張成圖自動送</strong>
            <em id="tg-enabled-hint">一般抽、無限抽都送。送失敗不會中斷抽圖</em>
          </span>
        </button>
        <div class="tg-actions">
          <button type="button" class="primary" id="tg-save"><span>存設定</span></button>
          <button type="button" class="ghost" id="tg-test">送一則測試</button>
        </div>
        <p class="tg-msg" id="tg-msg" role="status"></p>
        <dl class="tg-stats" id="tg-stats"></dl>
      </div>
    </div>`;
  document.body.append(wrap);
}

function paint() {
  const st = $("tg-state");
  if (st) {
    st.dataset.ok = status.configured ? "1" : "0";
    st.textContent = status.configured
      ? `已設定 · token ${status.tokenTail} · ${status.chatId || "沒填 chat id"}`
      : "尚未設定。填好下面兩格再按存設定。";
  }
  setServiceStatus("telegram", status.configured && status.enabled);
  const sw = $("tg-enabled");
  if (sw) {
    sw.classList.toggle("is-on", !!status.enabled);
    sw.setAttribute("aria-checked", status.enabled ? "true" : "false");
  }
  const stats = $("tg-stats");
  if (stats) {
    const bits = [
      ["送出", String(status.sent || 0)],
      ["失敗", String(status.failed || 0)],
      ["排隊中", String(status.queued || 0)],
    ];
    stats.replaceChildren();
    for (const [k, v] of bits) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      stats.append(dt, dd);
    }
    if (status.lastError) {
      const dt = document.createElement("dt");
      dt.textContent = "最後錯誤";
      const dd = document.createElement("dd");
      dd.className = "tg-err";
      dd.textContent = status.lastError;
      stats.append(dt, dd);
    }
  }
}

async function refresh() {
  try {
    const j = await getJson("/api/telegram/config");
    if (j && j.ok) status = j;
  } catch {
    /* 伺服器沒回就維持上一次的狀態，不吵 */
  }
  paint();
}

function say(text, kind) {
  const el = $("tg-msg");
  if (!el) return;
  el.textContent = text || "";
  el.dataset.kind = kind || "";
}

function isOpen() {
  const el = $("tg-modal");
  return !!(el && el.classList.contains("open") && el.dataset.closing !== "1");
}

function open() {
  const el = $("tg-modal");
  if (!el) return;
  delete el.dataset.closing;
  el.classList.remove("is-closing");
  el.classList.add("open");
  el.inert = false;
  lockScroll("tg-modal");
  say("");
  const chat = $("tg-chat");
  refresh().then(() => {
    if (chat) chat.value = status.chatId || "";
    const token = $("tg-token");
    if (token) {
      token.value = "";
      token.placeholder = status.configured ? `已存 · ${status.tokenTail}` : "123456789:AAE…";
    }
    (status.configured ? chat : $("tg-token"))?.focus();
  });
  window.clearInterval(poll);
  poll = window.setInterval(() => {
    if (isOpen()) refresh();
  }, 3000);
}

function close() {
  const el = $("tg-modal");
  if (!el || !isOpen()) return;
  window.clearInterval(poll);
  poll = 0;
  el.dataset.closing = "1";
  el.classList.add("is-closing");
  el.inert = true;
  const ms = reduceMotion() ? 0 : 180;
  window.setTimeout(() => {
    delete el.dataset.closing;
    el.classList.remove("open", "is-closing");
    unlockScroll("tg-modal");
    $("service-settings-btn")?.focus();
  }, ms);
}

async function save() {
  const btn = $("tg-save");
  if (btn) btn.disabled = true;
  say("存檔中…");
  try {
    const j = await getJson("/api/telegram/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: $("tg-token")?.value || "",
        chatId: $("tg-chat")?.value || "",
        enabled: !!status.enabled,
      }),
    });
    if (j && j.ok) {
      status = j;
      const token = $("tg-token");
      if (token) {
        token.value = "";
        token.placeholder = status.configured ? `已存 · ${status.tokenTail}` : "123456789:AAE…";
      }
      say("已存。", "ok");
    } else {
      say(String((j && j.error) || "存不進去"), "err");
    }
  } catch (err) {
    say(String(err.message || err), "err");
  }
  paint();
  if (btn) btn.disabled = false;
}

async function test() {
  const btn = $("tg-test");
  if (btn) btn.disabled = true;
  say("送出中…");
  try {
    const j = await getJson("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });
    if (j && j.ok) say("送到了。去頻道看一下。", "ok");
    else say(String((j && j.error) || "Telegram 沒收"), "err");
  } catch (err) {
    say(String(err.message || err), "err");
  }
  await refresh();
  if (btn) btn.disabled = false;
}

export function tgReady() {
  return !!(status.configured && status.enabled);
}

// 把一張成品排進伺服器的送圖佇列。不 await，送圖再慢也不拖抽圖。
export function tgSendCard(card, job, zh) {
  if (!tgReady() || !job || !job.image) return;
  let q;
  try {
    q = new URL(job.image, location.href).searchParams;
  } catch {
    return;
  }
  const filename = q.get("filename");
  if (!filename) return;
  fetch("/api/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      subfolder: q.get("subfolder") || "",
      type: q.get("type") || "output",
      seed: job.seed,
      width: job.width,
      height: job.height,
      zh: zh || "",
      en: job.positive || "",
    }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j && j.ok) markCard(card);
    })
    .catch(() => {
      /* 送圖失敗不吵抽圖，面板的失敗計數會記 */
    });
}

function markCard(card) {
  if (!card || card.querySelector(".tg-mark")) return;
  const shot = card.querySelector(".shot");
  if (!shot) return;
  const mark = document.createElement("span");
  mark.className = "tg-mark";
  mark.title = "已排進 Telegram 佇列";
  mark.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 2.9 11.1c-.9.3-.9 1.6 0 1.9l4.8 1.6 1.8 5.6c.3.8 1.3 1 1.8.3l2.6-3.1 4.9 3.6c.6.4 1.5.1 1.7-.7l3-14.2c.2-.9-.7-1.6-1.6-1.3ZM9.6 14.3l-.3 3.3-1.2-3.8 9-5.6-7.5 6.1Z"/></svg>`;
  shot.append(mark);
}

export function initTelegram() {
  ensureDom();
  $("tg-close")?.addEventListener("click", close);
  $("tg-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "tg-modal") close();
  });
  $("tg-save")?.addEventListener("click", save);
  $("tg-test")?.addEventListener("click", test);
  $("tg-enabled")?.addEventListener("click", () => {
    status.enabled = !status.enabled;
    paint();
    save();
  });
  for (const id of ["tg-token", "tg-chat"]) {
    $(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
    });
  }
  refresh();
}

export function openTelegramSettings() {
  if (!isOpen()) open();
}

export function tgHandleKeys(e) {
  if (!isOpen()) return false;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
    return true;
  }
  return true;
}

export function tgUiOpen() {
  return isOpen();
}
