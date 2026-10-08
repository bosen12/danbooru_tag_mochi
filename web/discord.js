// 送到 Discord 頻道。和 telegram.js 同一套形狀：桅杆列一顆按鈕、一個面板、
// 填 bot token 與頻道 ID，成圖排進伺服器的背景佇列。
//
// token 只走伺服器：POST 上去存進 .secrets/discord.json，GET 回來只有末四碼。
// 送圖是 fire-and-forget —— 伺服器收下就回，實際上傳在它的背景執行緒，抽圖不等它。
//
// 樣式沿用 telegram.js 那一套 tg-* class（同樣的面板、同樣的開關），只有 id 是 dc-*，
// 這樣不用再寫一份 CSS，兩邊的外觀也一定一致。

import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { setServiceStatus } from "./service-settings.js";

const $ = (id) => document.getElementById(id);

let status = { configured: false, enabled: false, compact: false, channelId: "", tokenTail: "", mode: "bot", webhookTail: "" };
let poll = 0;
// 面板上「現在選著哪一個」。status.mode 是伺服器上**存著**的那個，兩者可以不同：
// 使用者點了 Webhook 但還沒按存設定的那段時間就是。分開才有辦法一邊照選擇切欄位、
// 一邊讓狀態列照實描述伺服器的狀態。
let uiMode = "bot";
// 誰打開面板的。排字匣走頂欄齒輪（關掉時焦點回齒輪）；墨池、疊印台沒有齒輪，
// 是頂欄自己的一顆 Discord 鈕 —— 關掉要回到那顆鈕，不然焦點會掉到 body。
let opener = null;
const listeners = new Set();

function reduceMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function getJson(url, init) {
  const r = await fetch(url, init);
  return r.json();
}

const LOGO = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.27 5.33A16.2 16.2 0 0 0 15.23 4c-.2.35-.42.82-.58 1.2a15 15 0 0 0-4.3 0A11 11 0 0 0 9.76 4a16.2 16.2 0 0 0-4.04 1.33C3.16 9.15 2.46 12.87 2.8 16.54a16.3 16.3 0 0 0 5 2.54c.4-.55.76-1.14 1.07-1.76-.59-.22-1.15-.49-1.68-.8.14-.11.28-.22.41-.34 3.24 1.5 6.75 1.5 9.95 0 .14.12.28.23.42.34-.53.31-1.1.58-1.69.8.31.62.67 1.21 1.07 1.76a16.2 16.2 0 0 0 5-2.54c.4-4.26-.71-7.95-2.99-11.21ZM9.35 14.3c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Zm5.3 0c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Z"/></svg>`;

function ensureDom() {
  if ($("dc-modal")) return;
  const wrap = document.createElement("div");
  wrap.className = "tg-modal";
  wrap.id = "dc-modal";
  wrap.innerHTML = `
    <div class="tg-inner" role="dialog" aria-modal="true" aria-labelledby="dc-title">
      <header class="tg-head">
        <div>
          <h2 id="dc-title">送到 Discord</h2>
          <p class="tg-state" id="dc-state">讀取中…</p>
        </div>
        <button type="button" class="ghost tg-close" id="dc-close" aria-label="關閉">✕</button>
      </header>
      <div class="tg-body">
        <div class="tg-field">
          <span>連接方式</span>
          <div class="row" id="dc-modes" role="radiogroup" aria-label="連接方式">
            <button type="button" class="seg" id="dc-mode-hook" role="radio" aria-checked="false" aria-pressed="false">Webhook</button>
            <button type="button" class="seg" id="dc-mode-bot" role="radio" aria-checked="true" aria-pressed="true">Bot token</button>
          </div>
          <em id="dc-mode-hint"></em>
        </div>
        <div id="dc-bot-fields">
        <label class="tg-field">
          <span>Bot token</span>
          <input id="dc-token" type="password" autocomplete="off" spellcheck="false" placeholder="MTA1…" />
          <em>Discord Developer Portal → 你的 application → Bot → Reset Token。存在伺服器的 <code>.secrets/discord.json</code>，不進 git、不會回傳瀏覽器。留空＝沿用已存的 token。</em>
        </label>
        <label class="tg-field">
          <span>頻道 ID</span>
          <input id="dc-channel" type="text" autocomplete="off" spellcheck="false" placeholder="1234567890123456789" />
          <em>在 Discord 開「開發者模式」後右鍵頻道 →「複製頻道 ID」。bot 要先邀進該伺服器，並且在那個頻道有 <strong>發送訊息</strong> 和 <strong>附加檔案</strong> 權限。</em>
        </label>
        </div>
        <div id="dc-hook-fields" style="display:none">
        <label class="tg-field">
          <span>Webhook 網址</span>
          <input id="dc-webhook" type="password" autocomplete="off" spellcheck="false" placeholder="https://discord.com/api/webhooks/…" />
          <em>頻道設定 → 整合 → 建立 Webhook → 複製 Webhook 網址。<strong>不必建 bot、不必邀請、不必抓頻道 ID</strong> —— 網址本身就含頻道和憑證。也因為如此它就是密碼：存在伺服器的 <code>.secrets/discord.json</code>，不進 git、不會回傳瀏覽器。留空＝沿用已存的。</em>
        </label>
        </div>
        <button type="button" class="same-switch tg-switch" id="dc-enabled" role="switch" aria-checked="false" aria-describedby="dc-enabled-hint">
          <span class="same-knob" aria-hidden="true"><i></i></span>
          <span class="same-copy">
            <strong>每張成圖自動送</strong>
            <em id="dc-enabled-hint">一般抽、無限抽都送。送失敗不會中斷抽圖</em>
          </span>
        </button>
        <button type="button" class="same-switch tg-switch" id="dc-compact" role="switch" aria-checked="false">
          <span class="same-knob" aria-hidden="true"><i></i></span>
          <span class="same-copy">
            <strong>精簡</strong>
            <em>只送圖和底下一行小字（seed、尺寸、模型、LoRA），不送分類標籤和英文提示詞。無限抽時頻道比較不會被洗版</em>
          </span>
        </button>
        <div class="tg-actions">
          <button type="button" class="primary" id="dc-save"><span>存設定</span></button>
          <button type="button" class="ghost" id="dc-test">送一則測試</button>
        </div>
        <p class="tg-msg" id="dc-msg" role="status"></p>
        <dl class="tg-stats" id="dc-stats"></dl>
      </div>
    </div>`;
  document.body.append(wrap);
}

function paint() {
  const hook = uiMode === "webhook";
  const savedHook = status.mode === "webhook";
  const pending = uiMode !== status.mode;
  const st = $("dc-state");
  if (st) {
    // 這一行永遠描述伺服器上存著的狀態，不跟著面板上的選擇跑。
    st.dataset.ok = status.configured ? "1" : "0";
    if (status.configured) {
      st.textContent = savedHook
        ? `目前走 webhook · ${status.webhookTail}`
        : `目前走 bot · token ${status.tokenTail} · ${status.channelId || "沒填頻道 ID"}`;
    } else {
      st.textContent = savedHook ? "尚未設定。貼上 webhook 網址再按存設定。" : "尚未設定。填好下面兩格再按存設定。";
    }
  }
  const botFields = $("dc-bot-fields");
  const hookFields = $("dc-hook-fields");
  if (botFields) botFields.style.display = hook ? "none" : "";
  if (hookFields) hookFields.style.display = hook ? "" : "none";
  const mBot = $("dc-mode-bot");
  const mHook = $("dc-mode-hook");
  if (mBot && mHook) {
    for (const [el, on] of [[mBot, !hook], [mHook, hook]]) {
      el.setAttribute("aria-pressed", on ? "true" : "false");
      el.setAttribute("aria-checked", on ? "true" : "false");
      // radiogroup：Tab 只停在選著的那一個，組內靠方向鍵。
      el.tabIndex = on ? 0 : -1;
    }
  }
  // 提示就放在按鈕正下方 —— 在最上面點的東西，回饋不該跑到面板最底下。
  const hint = $("dc-mode-hint");
  if (hint) {
    const what = hook
      ? "Webhook 不必建機器人，在頻道設定裡建一個就好；萬一外洩，它也只能往那一個頻道貼文。"
      : "Bot 要自己建 application、邀進伺服器、再抓頻道 ID，但日後可以擴充成互動功能。";
    hint.textContent = pending ? `還沒套用 —— 按下面的「存設定」才會換成${hook ? " Webhook" : " Bot token"}。${what}` : what;
    hint.dataset.pending = pending ? "1" : "";
  }
  // 有沒存的改動時，把「存設定」點出來，不然使用者不知道還缺一步。
  const saveLabel = document.querySelector("#dc-save span");
  if (saveLabel) saveLabel.textContent = pending ? "存設定 · 尚未套用" : "存設定";
  setServiceStatus("discord", status.configured && status.enabled);
  for (const fn of listeners) fn(dcReady());
  const sw = $("dc-enabled");
  if (sw) {
    sw.classList.toggle("is-on", !!status.enabled);
    sw.setAttribute("aria-checked", status.enabled ? "true" : "false");
  }
  const cp = $("dc-compact");
  if (cp) {
    cp.classList.toggle("is-on", !!status.compact);
    cp.setAttribute("aria-checked", status.compact ? "true" : "false");
  }
  const stats = $("dc-stats");
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
    const j = await getJson("/api/discord/config");
    if (j && j.ok) {
      const first = !status.mode || uiMode === status.mode;
      status = j;
      // 使用者正在挑的選擇不要被輪詢蓋掉，只有還沒動過時才跟著伺服器走。
      if (first) uiMode = status.mode === "webhook" ? "webhook" : "bot";
    }
  } catch {
    /* 伺服器沒回就維持上一次的狀態，不吵 */
  }
  paint();
}

function say(text, kind) {
  const el = $("dc-msg");
  if (!el) return;
  el.textContent = text || "";
  el.dataset.kind = kind || "";
}

function isOpen() {
  const el = $("dc-modal");
  return !!(el && el.classList.contains("open") && el.dataset.closing !== "1");
}

function open() {
  const el = $("dc-modal");
  if (!el) return;
  opener = document.activeElement;
  delete el.dataset.closing;
  el.classList.remove("is-closing");
  el.classList.add("open");
  el.inert = false;
  lockScroll("dc-modal");
  say("");
  const chan = $("dc-channel");
  refresh().then(() => {
    if (chan) chan.value = status.channelId || "";
    const token = $("dc-token");
    if (token) {
      token.value = "";
      token.placeholder = status.configured ? `已存 · ${status.tokenTail}` : "MTA1…";
    }
    const hookInput = $("dc-webhook");
    if (hookInput) {
      hookInput.value = "";
      hookInput.placeholder = status.webhookTail
        ? `已存 · ${status.webhookTail}`
        : "https://discord.com/api/webhooks/…";
    }
    if (uiMode === "webhook") $("dc-webhook")?.focus();
    else (status.configured ? chan : $("dc-token"))?.focus();
  });
  window.clearInterval(poll);
  poll = window.setInterval(() => {
    if (isOpen()) refresh();
  }, 3000);
}

function close() {
  const el = $("dc-modal");
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
    unlockScroll("dc-modal");
    // 齒輪選單裡的那一項在面板打開前就收起來了，回不去，所以排字匣照舊回齒輪。
    const back = $("service-settings-btn") || (opener && opener.isConnected ? opener : null);
    opener = null;
    back?.focus();
  }, ms);
}

async function save() {
  const btn = $("dc-save");
  if (btn) btn.disabled = true;
  say("存檔中…");
  try {
    const j = await getJson("/api/discord/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: uiMode === "webhook" ? "webhook" : "bot",
        token: $("dc-token")?.value || "",
        channelId: $("dc-channel")?.value || "",
        webhook: $("dc-webhook")?.value || "",
        enabled: !!status.enabled,
        compact: !!status.compact,
      }),
    });
    if (j && j.ok) {
      status = j;
      uiMode = status.mode === "webhook" ? "webhook" : "bot";
      const token = $("dc-token");
      if (token) {
        token.value = "";
        token.placeholder = status.configured ? `已存 · ${status.tokenTail}` : "MTA1…";
      }
      const hookInput = $("dc-webhook");
      if (hookInput) {
        hookInput.value = "";
        hookInput.placeholder = status.webhookTail
          ? `已存 · ${status.webhookTail}`
          : "https://discord.com/api/webhooks/…";
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
  const btn = $("dc-test");
  if (btn) btn.disabled = true;
  say("送出中…");
  try {
    const j = await getJson("/api/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });
    if (j && j.ok) say("送到了。去頻道看一下。", "ok");
    else say(String((j && j.error) || "Discord 沒收"), "err");
  } catch (err) {
    say(String(err.message || err), "err");
  }
  await refresh();
  if (btn) btn.disabled = false;
}

export function dcReady() {
  return !!(status.configured && status.enabled);
}

// 自動送開關或設定變了就通知（帶 dcReady()）。墨池、疊印台用它點亮頂欄那顆鈕的小點。
export function onDcStatus(fn) {
  listeners.add(fn);
  fn(dcReady());
  return () => listeners.delete(fn);
}

// 把一張成品排進伺服器的送圖佇列。不 await，送圖再慢也不拖抽圖。
// card 可以是 null（墨池、疊印台不在圖上蓋章，面板的計數就是回饋）。
// meta：{ source 哪一頁, rating, ckpt, loras, hires 放大的標示 } —— 伺服器拿去排來源行、頁尾和色條。
export function dcSendCard(card, job, zh, meta = {}) {
  if (!dcReady() || !job || !job.image) return;
  let q;
  try {
    q = new URL(job.image, location.href).searchParams;
  } catch {
    return;
  }
  const filename = q.get("filename");
  if (!filename) return;
  fetch("/api/discord", {
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
      source: meta.source || "",
      rating: meta.rating || job.rating || "",
      ckpt: meta.ckpt ?? job.ckpt ?? "",
      loras: meta.loras ?? job.loras ?? [],
      hires: meta.hires || "",
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
  if (!card || card.querySelector(".dc-mark")) return;
  const shot = card.querySelector(".shot");
  if (!shot) return;
  const mark = document.createElement("span");
  mark.className = "tg-mark dc-mark";
  mark.title = "已排進 Discord 佇列";
  mark.innerHTML = LOGO;
  shot.append(mark);
}

export function initDiscord() {
  ensureDom();
  $("dc-close")?.addEventListener("click", close);
  $("dc-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "dc-modal") close();
  });
  $("dc-save")?.addEventListener("click", save);
  $("dc-test")?.addEventListener("click", test);
  $("dc-enabled")?.addEventListener("click", () => {
    status.enabled = !status.enabled;
    paint();
    save();
  });
  $("dc-compact")?.addEventListener("click", () => {
    status.compact = !status.compact;
    paint();
    save();
  });
  const pickMode = (m) => {
    if (uiMode === m) return;
    uiMode = m;
    say("");
    paint();
  };
  $("dc-mode-bot")?.addEventListener("click", () => pickMode("bot"));
  $("dc-mode-hook")?.addEventListener("click", () => pickMode("webhook"));
  // 只有兩個選項：任何方向鍵都是「換到另一個」，焦點跟著走（APG radio group）。
  $("dc-modes")?.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = uiMode === "webhook" ? "bot" : "webhook";
    pickMode(next);
    $(next === "webhook" ? "dc-mode-hook" : "dc-mode-bot")?.focus();
  });
  for (const id of ["dc-token", "dc-channel", "dc-webhook"]) {
    $(id)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
    });
  }
  refresh();
}

export function openDiscordSettings() {
  if (!isOpen()) open();
}

export function dcHandleKeys(e) {
  if (!isOpen()) return false;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
    return true;
  }
  return true;
}

export function dcUiOpen() {
  return isOpen();
}
