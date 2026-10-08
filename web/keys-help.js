/**
 * 快捷鍵說明（電腦用）：頂欄一顆「?」、或在頁面上按 ? 打開，照現在在哪個房間列出能用的鍵。
 * 以前快捷鍵只寫在各個按鈕滑鼠停留的說明裡（抽並生圖（G）…），新加的份量 ＋／−、Ctrl+V 貼上更是
 * 沒地方看。舊版共用的那份（web/lora.js 的 shortcuts-overlay）寫的是排字匣的鍵，web6 一直藏著不用。
 * 手機沒有鍵盤：那顆「?」不出現（styles.css）。
 */
import { el, openSheet, anyOverlay } from "./ui.js";

const COMMON = [
  ["/", "游標跳到找牌（找作品）的框"],
  ["Esc", "關掉最上面那一層（彈窗、選單）"],
  ["?", "打開這份說明"],
];
const MODELS = [
  ["L", "選 LoRA"],
  ["M", "選底模"],
];
const WEIGHT = [
  ["滾輪", "滑鼠停在牌上一下再滾：調份量（一格一檔）"],
  ["+ −", "焦點在牌上：加重、減輕"],
  ["0", "焦點在牌上：份量回到 1.0"],
];

const ROOMS = {
  mochi: [
    ["抽牌", [
      ["G", "抽並生圖"],
      ["P", "只抽牌"],
      ["Esc", "抽牌、生圖進行中：停下來"],
      ["Z", "提示上有「復原」時：復原（清空合成池、撤下成品…）"],
      ["Ctrl V", "在頁面空白處：把剪貼簿的提示詞貼成牌"],
    ]],
    ["字盒", [
      ["Enter", "在找牌的框：把第一張放進合成池"],
      ["↓", "在找牌的框：走進字盒"],
      ["← → ↑ ↓", "在字盒裡移動；最上面一排按 ↑ 回到找牌的框"],
    ]],
    ["合成池的牌", WEIGHT],
    ["模型", MODELS],
  ],
  fuse: [
    ["試印與付印", [
      ["1 ～ 4", "選試印 A～D"],
      ["R", "換一批試印"],
      ["P", "付印"],
      ["Z", "撤回（Ctrl Z 也可以）"],
      ["Ctrl V", "在頁面空白處：把剪貼簿的提示詞貼成牌"],
    ]],
    ["卡池的牌", [["Delete", "拿下來"], ...WEIGHT]],
    ["字盒", [["← → ↑ ↓", "在字盒裡移動；最上面一排按 ↑ 回到找牌的框"]]],
    ["模型", MODELS],
  ],
  book: [
    ["卡冊", [
      ["B", "打開、收起卡盒"],
      ["Enter", "在找牌的框：打開第一張"],
      ["Esc", "在找牌的框：清空"],
    ]],
  ],
  album: [
    ["作品冊", [["Esc", "在找作品的框：清空"]]],
  ],
};

const ROOM_ZH = { mochi: "墨池", fuse: "疊印台", book: "卡冊", album: "作品冊" };

function keys(text) {
  return el("span", { class: "keys-help-keys" }, text.split(" ").map((k) => (k === "～" ? el("span", { class: "keys-help-to" }, "～") : el("kbd", {}, k))));
}

function group(title, rows) {
  return el(
    "section",
    { class: "keys-help-group" },
    el("h3", {}, title),
    el("dl", {}, rows.flatMap(([k, d]) => [el("dt", {}, keys(k)), el("dd", {}, d)]))
  );
}

export function openKeysHelp(room) {
  const groups = [...(ROOMS[room] || []), ["每一頁", COMMON]];
  openSheet(
    `快捷鍵・${ROOM_ZH[room] || ""}`,
    el(
      "div",
      { class: "keys-help" },
      el("p", { class: "keys-help-note" }, "在輸入框裡打字時不會觸發。"),
      groups.map(([t, rows]) => group(t, rows))
    ),
    { wide: true }
  );
}

/** 頂欄放一顆「?」（電腦才看得到），頁面上按 ? 也打開。 */
export function mountKeysHelp(room) {
  const tools = document.getElementById("mast-tools");
  if (tools && !document.getElementById("help-btn")) {
    const b = el("button", { class: "ghost icon-btn help-btn pressable", id: "help-btn", type: "button", "aria-label": "快捷鍵（?）", title: "快捷鍵（?）", "aria-haspopup": "dialog" }, "?");
    b.addEventListener("click", () => openKeysHelp(room));
    const ping = document.getElementById("ping");
    if (ping && ping.parentElement === tools) tools.insertBefore(b, ping);
    else tools.append(b);
  }
  addEventListener("keydown", (e) => {
    if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.closest?.("input, textarea, select, [contenteditable]") || anyOverlay())) return;
    e.preventDefault();
    openKeysHelp(room);
  });
}
