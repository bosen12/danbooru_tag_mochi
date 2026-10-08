/**
 * 新手導覽的步驟（tour.js 跑）：每個房間一串。
 *   title、text：小視窗裡的字。target({ phone })：要亮出來的那一塊（找不到、看不到就略過這一步）。
 *   when({ phone })：只在手機／電腦出現的步驟。wait({ phone })：要真的做到才往下（todo 是提示）。
 *   enter()：進這一步時記下現在的狀態（例如池子裡幾張），wait 拿來比。
 *   dim: false：不要整片變暗（彈窗開著的那一步）。
 */
import { anyOverlay } from "./ui.js";

export const ROOM_ZH = { mochi: "墨池", fuse: "疊印台", book: "卡冊", album: "作品冊" };

const $ = (sel) => document.querySelector(sel);
const count = (sel) => document.querySelectorAll(sel).length;
const pickerOpen = () => document.body.dataset.picker === "open";
const desktop = ({ phone }) => !phone;
const mobile = ({ phone }) => phone;

// 合成池（墨池）／卡池（疊印台）裡有幾張牌：「放一張進去」那一步拿來比。
const base = { pool: 0, plate: 0, trial: "" };
const poolCards = () => count("#pool-well .card");
const plateCards = () => count("#registers .plate-card");
const pickedTrial = () => $('#trials [aria-checked="true"]')?.textContent || "";

const MOCHI = [
  {
    title: "歡迎來到墨池",
    text: "墨池是「抽牌生圖」的地方：你挑幾張想要的牌，其他的交給引擎補，按一下就送去 ComfyUI 畫。跟著做一次就會了。",
  },
  {
    when: desktop,
    target: () => $("#library"),
    title: "字盒：所有的牌",
    text: "每張牌是一個元素：髮色、服裝、姿勢、場景…。上面可以打字找（中文、英文都可以），或按花色篩選。",
  },
  {
    when: desktop,
    target: () => $("#lib-grid"),
    enter: () => (base.pool = poolCards()),
    wait: () => poolCards() > base.pool,
    title: "放一張牌進合成池",
    text: "點字盒裡的牌，它就會飛進右邊的合成池。",
    todo: "點任何一張牌（例如「長髮」）。",
  },
  {
    when: mobile,
    target: () => $("#lib-toggle"),
    wait: pickerOpen,
    title: "打開字盒",
    text: "手機上字盒收在這顆「挑牌」裡：所有的牌（髮色、服裝、姿勢、場景…）都在裡面。",
    todo: "按「挑牌」。",
  },
  {
    when: mobile,
    target: () => $("#lib-grid"),
    enter: () => (base.pool = poolCards()),
    wait: () => poolCards() > base.pool,
    title: "挑一張牌",
    text: "點一張牌，它就收進下面的合成池。上面可以打字找，或按花色篩選。",
    todo: "點任何一張牌（例如「長髮」）。",
  },
  {
    when: mobile,
    target: () => $(".picker-done"),
    wait: () => !pickerOpen(),
    title: "挑好了",
    text: "可以一次挑好幾張。挑完按「完成」收起字盒。",
    todo: "按「完成」。",
  },
  {
    target: () => $("#pool-well"),
    title: "合成池",
    text: "放進來的牌，每一張圖都一定會有。點牌看詳情；滑鼠停在牌上滾輪（或按 ＋／−）調份量，數字在牌的右下角。不要了再點一次字盒裡那張。",
  },
  {
    target: () => $("#rules"),
    title: "規則",
    text: "尺度、時代、畫面裡有誰、姿勢參考。按「更多規則」還有尺寸、每段抽幾張。不確定就先用預設。",
  },
  {
    target: () => $("#ckpt-pick-btn") || $("#lora-pick-btn"),
    title: "底模與 LoRA",
    text: "頂欄右邊可以換底模（畫風的基礎）、加 LoRA。不確定就先用預設的。",
  },
  {
    target: () => $("#go-bar .btn-primary"),
    title: "抽並生圖",
    text: "按下去：引擎照規則補齊其他牌，送 ComfyUI 畫。「一次」可以一次印好幾張；「只抽牌」只看抽到什麼、不畫。",
  },
  {
    target: () => $("#wall-head"),
    title: "成品",
    text: "畫好的會出現在這下面：點開看大圖、☆ 收藏進作品冊、Hires 放大、不要的撤下。印的時候頂欄也看得到進度。",
  },
  {
    target: () => $(".page-switch"),
    title: "其他房間",
    text: "疊印台：一層層疊牌，先看四張試印再付印。卡冊：每張牌用過幾次、成就。作品冊：收藏的、印過的每一張。每個房間都有自己的導覽。",
  },
  {
    title: "準備好了",
    text: "挑幾張牌、按「抽並生圖」試試看吧！之後想再看一次，按頂欄的「導覽」。",
  },
];

const FUSE = [
  {
    title: "歡迎來到疊印台",
    text: "疊印台是「先看再印」：你一張張把牌疊上卡池，引擎同時補出四種組合（試印 A～D），挑你喜歡的那個再付印。",
  },
  {
    when: desktop,
    target: () => $("#case"),
    title: "字盒",
    text: "所有的牌都在這。點一下放上卡池，再點一下拿下來；上面可以打字找。",
  },
  {
    when: desktop,
    target: () => $("#case-grid"),
    enter: () => (base.plate = plateCards()),
    wait: () => plateCards() > base.plate,
    title: "疊一張牌上去",
    text: "點字盒裡的牌，它就疊上中間的卡池。",
    todo: "點任何一張牌。",
  },
  {
    when: mobile,
    target: () => $("#case-open"),
    wait: pickerOpen,
    title: "打開字盒",
    text: "手機上字盒收在「挑牌」裡。",
    todo: "按「挑牌」。",
  },
  {
    when: mobile,
    target: () => $("#case-grid"),
    enter: () => (base.plate = plateCards()),
    wait: () => plateCards() > base.plate,
    title: "挑一張牌",
    text: "點一張牌，它就疊上卡池。",
    todo: "點任何一張牌。",
  },
  {
    when: mobile,
    target: () => $("#case .picker-done"),
    wait: () => !pickerOpen(),
    title: "挑好了",
    text: "挑完按「完成」收起字盒。",
    todo: "按「完成」。",
  },
  {
    target: () => $("#plate"),
    title: "卡池",
    text: "你疊上的牌照花色排好，每一張都會進付印的圖。還空著時，可以點起手式或你的牌組直接套用；右上有撤回、清版。",
  },
  {
    target: () => $("#trials"),
    enter: () => (base.trial = pickedTrial()),
    wait: () => pickedTrial() !== base.trial,
    title: "試印 A～D",
    text: "引擎用你的牌補出四種組合，圓圈是它補進來的牌。點一格看它的組合；「換一批」整批重抽。",
    todo: "點另一個試印（例如 B）。",
  },
  {
    target: () => $("#print-bar"),
    title: "付印",
    text: "選好了按「付印」，送 ComfyUI 畫。畫的時候可以接著疊下一版。",
  },
  {
    target: () => $("#line"),
    title: "晾紙繩",
    text: "印好的作品夾在這條繩上；點一張回到它當時的版，也可以收藏、Hires 放大。",
  },
  {
    target: () => $("#rules-btn"),
    title: "規則",
    text: "尺寸、畫面裡有誰、時代、尺度、姿勢參考都在這顆鈕裡。",
  },
  {
    title: "準備好了",
    text: "疊幾張牌、挑一個試印、按「付印」試試看吧！之後想再看一次，按頂欄的「導覽」。",
  },
];

const BOOK = [
  {
    title: "歡迎來到卡冊",
    text: "卡冊是你的牌的紀錄：每張牌用過幾次、印出來好不好、收集了多少。",
  },
  {
    target: () => $("#book-suits"),
    title: "花色",
    text: "按花色篩選。花色圖章外圈那一圈，是這個花色點亮（用過）了幾成。",
  },
  {
    target: () => $("#book-sort"),
    title: "排序",
    text: "多到少、少到多；「出好圖」「常撤下」看哪些牌常出好圖、哪些常被你撤下（要先印一陣子才排得出來）。",
  },
  {
    target: () => $("#book-grid"),
    wait: () => anyOverlay(),
    title: "看一張牌",
    text: "點一張牌，打開它的詳情。",
    todo: "點任何一張牌。",
  },
  {
    dim: false,
    wait: () => !anyOverlay(),
    title: "牌的詳情",
    text: "用過幾次、戰績、用它做過的圖都在這裡；可以帶去墨池，或放進卡盒。",
    todo: "看完按右上的 ✕ 關掉。",
  },
  {
    target: () => $("#box-pill"),
    title: "卡盒",
    text: "邊逛邊把牌收進卡盒（牌上的 ＋），收好一次帶去墨池，或存成牌組。",
  },
  {
    target: () => $("#book-ach"),
    title: "成就牆",
    text: "每個花色的收集進度和成就。只看不擋：沒解鎖的牌照樣能用。",
  },
  {
    title: "就是這樣",
    text: "之後想再看一次，按頂欄的「導覽」。",
  },
];

const ALBUM = [
  {
    title: "歡迎來到作品冊",
    text: "收藏的作品、印過的每一張、每個模型的成績都在這裡。",
  },
  {
    target: () => $("#album-tabs"),
    title: "三個分頁",
    text: "作品＝你收藏的；日誌＝印過的每一張（沒收藏的也查得到）；模型＝每個底模、LoRA 的成績。",
  },
  {
    target: () => $("#works-group"),
    title: "分輯",
    text: "依時代、髮色、服裝、場景把作品分段。點一件作品看大圖、用了哪些牌、相似的作品，也能把牌帶回墨池。",
  },
  {
    target: () => $("#album-q"),
    title: "找",
    text: "打牌名、提示詞、底模都找得到。",
  },
  {
    target: () => $('#album-tabs [data-v="log"]'),
    wait: () => !$("#album-log")?.hidden,
    title: "看日誌",
    text: "日誌記著印過的每一張：時間、從哪一頁送的、花多久、有沒有收藏。",
    todo: "點「日誌」。",
  },
  {
    target: () => $("#log-filters"),
    title: "篩選",
    text: "只看收藏的、撤下的、印壞的、Hires。點一列看配方，可以補收藏、把牌帶回墨池。",
  },
  {
    title: "就是這樣",
    text: "之後想再看一次，按頂欄的「導覽」。",
  },
];

export const STEPS = { mochi: MOCHI, fuse: FUSE, book: BOOK, album: ALBUM };
