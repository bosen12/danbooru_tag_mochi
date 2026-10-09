/**
 * 墨池 · 疊印台。
 *
 * 一張牌是一層墨。中間的「卡池」照花色分成六列套版（罩色、姿勢、服裝、長相、人物、底色），
 * 你放的牌是實牌；同一列後面排著灰色的影子，是選中那張試印裡引擎替你補的牌 ——
 * 整個卡池就是那一張圖的配方，每一張都能點、能拖、能收下或拿掉。
 *
 * 真正會送出去的 POS 由 engine 跑四張「試印」：同一批種子，每疊一張牌就重跑一次
 * （一次 ~25ms），所以看得到「加了這張，引擎補的牌怎麼變」；也看得到你的牌有沒有真的上墨
 * （牌角四個點，四張試印裡進了幾張）。挑一張試印按付印，才送 ComfyUI；成品出現在右欄上方，
 * 也夾一張到上面的晾紙繩，點它可以回到那一版。
 *
 * 抽牌規則一條都不在這裡：同格互斥、時代衝突、附帶是 engine 的 applyPin；
 * 相剋是 engine 的 contradictions；補字是 engine 的 drawWithSeed。規則、廢字簍跟墨池工作臺共用。
 */
import {
  indexLexicon,
  sanitizeSettings,
  applyPin,
  contradictions,
  heatMismatches,
  insertTriggerAfterCast,
  randomSeed,
  ACT_PLACE,
  ERAS,
  ERA_LABELS,
  stepSkeleton,
} from "./engine.js";
import { drawWithSeed } from "./draw-with-seed.js";
import { skeletonPicker } from "./skeleton-picker.js";
import { compareThumb } from "./compare.js";
import { ratingBlocked, RATING_LABEL } from "./rules/rating.js";
import { watchGone, sweepGone } from "./gone.js";
import { HEATS, toggleHeat } from "./heats.js";
import { heatBlockedByRating } from "./scene-policy.js";
import { initLoraPicker, currentLorasPayload, currentTriggerText, currentCkpt, handleLoraKeys } from "./lora.js";
import { initWorkflow, currentWorkflowId, currentSampling, wfHandleKeys } from "./workflow.js";
import { HARD_BANNED, applyArtSources } from "./card-art.js";
import { buildLibrary, groupChips, createAssets, cardNode, cardFacts, setEnterTarget, eagerArt, CARD_SUIT_INFO, CARD_SUITS, RATING_ZH, ERA_ZH } from "./cards.js";
import { el, openSheet, anyOverlay, toast } from "./ui.js";
import { mountKeysHelp } from "./keys-help.js";
import { mountTour } from "./tour.js";
import { mountGenStatus } from "./gen-status.js";
import { currentPose, poseButton, onPoseChange } from "./pose.js";
import { openDecks, loadDecks, cachedDecks } from "./decks.js";
import { openPaste, listenPaste } from "./paste-prompt.js";
import { paintWeight, wireWeightInput, weightRow, weightPositive } from "./weights.js";
import { favButton } from "./album-save.js";
import { initMotion, settleMotion, flip, flipBy, leave, gatherHome, flight, enter, seat, refuse, CURVE, DUR, css } from "./motion.js";
import { createHand } from "./hand.js";
import { createDrag, inkRing } from "./drag.js";
import { createGenerator, comfyOnline, viewSrc, tabTitle, watchLink, LINK_LABEL, markGenLog } from "./gen.js";
import { attachPeek, hidePeek, showPeek } from "./card-peek.js";
import { createHires, openHiresPicker, paintHiresVeil, hiresBusy } from "./hires.js";
import * as S from "./store.js";
import { recordUses, tagsOfPositive } from "./usage.js";
import { REGISTERS, REGISTER_ROLE, emptyBed, sanitizeBed, placeCard, removeCard, relationsOf } from "./fuse-bed.js";
import { createSfx } from "./fuse-sfx.js";
import { genSeed, isFixedSeed, mountSeedControl, onSeedChange, restoreSeed, seedState, seedUseButton, useSeed } from "./seed-control.js";
import { mountDiscord } from "./discord-link.js";
import { t as translate, takeLanguageState } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const LETTERS = ["A", "B", "C", "D"];
const TRIALS = 4;
// 字盒一次長出幾張：第一眼只看得到十幾張，捲到接近底部（IntersectionObserver，提早 400px）再補下一批。
const PAGE = 40;
const PRINT_MAX = 40;
const HISTORY_MAX = 60;
const RATING_RANK = { general: 0, sensitive: 1, explicit: 2 };
const HEAT_ZH = { activity: "活動", tease: "誘惑", flash: "走光", sex: "性愛" };
const SIZES = [
  { id: "square", zh: "方", w: 1024, h: 1024 },
  { id: "portrait", zh: "直", w: 832, h: 1216 },
  { id: "landscape", zh: "橫", w: 1216, h: 832 },
];
const SECTION_ORDER = ["subject", "feature", "clothing", "pose", "env", "style", "quality"];
// 卡池、試印的種子、挑哪一張都不存：重新整理就是空白的版和一批新種子。
// 晾紙繩（付印過的作品）留著，點「回到這一版」可以把當時的卡池叫回來。
const FK = { prints: "mochi.fuse.prints.v1", tab: "mochi.fuse.tab.v1", settings: "mochi.fuse.settings.v1" };
const FK_OLD = ["mochi.fuse.bed.v1", "mochi.fuse.seeds.v1", "mochi.fuse.picked.v1"];

// 第一次打開的起手式：三組一點就疊好的版。只收詞庫裡有、這個尺度看得到的。
const STARTERS = [
  // 現代
  { name: "雨夜街角", tags: ["umbrella", "rain", "night", "street"] },
  { name: "書房午後", tags: ["reading", "library", "glasses"] },
  { name: "海邊黃昏", tags: ["sundress", "beach", "sunset"] },
  { name: "咖啡店", tags: ["apron", "cafe", "smile"] },
  { name: "放學教室", tags: ["school uniform", "classroom", "sunset"] },
  { name: "屋頂星空", tags: ["rooftop", "starry sky", "night"] },
  { name: "白底立繪", tags: ["white background", "standing", "smile"] },
  { name: "閃亮舞台", tags: ["idol", "spotlight", "microphone", "sparkle"] },
  { name: "霓虹街頭", tags: ["jacket", "city lights", "neon lights", "night"] },
  { name: "櫻花校園", tags: ["school uniform", "falling petals", "cherry blossoms"] },
  { name: "雨後公園", tags: ["umbrella", "park", "rain"] },
  { name: "夏日泳池", tags: ["one-piece swimsuit", "pool", "splashing", "blue sky"] },
  { name: "單車兜風", tags: ["riding bicycle", "blue sky", "smile"] },
  { name: "早晨廚房", tags: ["apron", "kitchen", "cooking", "window light"] },
  { name: "賴床", tags: ["pajamas", "bedroom", "sleeping"] },
  { name: "樹影散步", tags: ["dress", "forest", "dappled sunlight"] },
  { name: "秋日落葉", tags: ["sweater", "park", "falling leaves"] },
  { name: "街頭帽T", tags: ["hoodie", "street", "day"] },
  { name: "溫泉", tags: ["onsen", "steam", "towel"] },
  { name: "電車窗邊", tags: ["train interior", "sitting", "window light"] },
  { name: "像素小品", tags: ["pixel art", "simple background", "smile"] },
  { name: "九〇年代", tags: ["1990s (style)", "anime coloring", "looking at viewer"] },
  { name: "魔法光點", tags: ["magic", "light particles", "fantasy"] },
  // 其他時代
  { name: "春日和服", tags: ["kimono", "cherry blossoms", "smile"] },
  { name: "夏祭浴衣", tags: ["yukata", "paper lantern", "festival", "night"] },
  { name: "道場", tags: ["hakama", "dojo"] },
  { name: "古風庭園", tags: ["hanfu", "east asian architecture", "bamboo forest"] },
  { name: "城堡騎士", tags: ["armor", "castle", "cape"] },
  { name: "維多利亞茶會", tags: ["victorian", "dress", "teacup"] },
  { name: "希臘神殿", tags: ["ancient greek clothes", "greco-roman architecture", "sunlight"] },
];
// 空白的版每次放三組上來：版變空的那一刻抽一次，之後重畫（滑鼠經過、換試印）不重抽，
// 按「換一組」才換。
let starterPick = null;

let data = null;
let lex = null;
let lib = null;
let assets = null;
let settings = null;
let bans = new Set();
let bed = emptyBed();
let seeds = [];
let picked = 0;
// 滑鼠停在另一張試印上：卡池的影子先換成那一張補的（只是看看，沒有換過去）。
let peekTrial = null;
let peekTimer = 0;
let trials = [];
let prints = [];
let history = [];
let expanded = new Set();
let comfyOk = null;
// 最近一次探到的連線狀態（見 gen.js linkState）：斷的是網路還是 ComfyUI，提示要分開講。
let linkNow = "ok";
let rowNotes = {};
let plateNotice = null;
let lastRelKeys = new Set();
let caseTab = "all";
let caseGroup = "";
let caseQuery = "";
let caseList = [];
let caseShown = 0;
let caseSearchTimer = 0;
// 下一次畫字盒要不要把牌依序發進來（換花色、換小分類才要）。
let dealCase = false;
let lastPointer = "mouse";
const sfx = createSfx();
// 聲音引擎第一次建立要 40ms 左右：以前落在第一次放牌那一下（整段 123ms 的長任務）。
// 第一個手勢（按下去、按鍵）時先在下一輪建好，等 click 真的要出聲時已經在了。
for (const type of ["pointerdown", "keydown"]) {
  addEventListener(type, () => setTimeout(() => sfx.warm(), 0), { once: true, capture: true, passive: true });
}
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// 數字換了才滾一下。節點常常整塊重畫，所以記的是字，不是那一個元素。
const tickSeen = new Map();
function tickIfChanged(node, key) {
  if (!node) return;
  const next = node.textContent;
  const prev = tickSeen.get(key);
  tickSeen.set(key, next);
  if (prev === undefined || prev === next || reduced()) return;
  // 下一格才加回去：同一格裡「拿掉、讀 offsetWidth、加回去」會逼整塊剛重畫的卡池當場排版，
  // 一次重畫有十來個數字要滾，第一次放牌光這裡 25ms。隔一格重開，動畫一樣、不強制排版。
  node.classList.remove("is-ticked");
  requestAnimationFrame(() => node.classList.add("is-ticked"));
}

/* ================= 小工具 ================= */

function readJ(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJ(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存不了就算了：版還在畫面上 */
  }
}

const cardOf = (tag) => lib.byTag.get(tag);
const suitOf = (tag) => cardOf(tag)?.suit || null;
const zh = (tag) => cardOf(tag)?.zh || lex.byTag.get(tag)?.zh || tag;
const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'));

/** 把一串子節點換上去，null／false 略過（replaceChildren 會把 null 印成字）。 */
function put(node, ...kids) {
  node.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}

function rankOk(card) {
  return (RATING_RANK[card.rating] ?? 2) <= (RATING_RANK[settings.rating] ?? 0);
}

function announce(text) {
  const live = $("live");
  live.textContent = "";
  setTimeout(() => (live.textContent = text), 30);
}

function haptic(ms) {
  if (lastPointer === "touch" && navigator.vibrate) navigator.vibrate(ms);
}

/* ================= 開機 ================= */

async function boot() {
  initMotion();
  // 快捷鍵說明（電腦）：頂欄的「?」、按 ? 打開（keys-help.js）。
  mountKeysHelp("fuse");
  // 新手導覽（頂欄「教學」右邊的「導覽」；第一次來會問要不要走一遍）：tour.js。
  mountTour("fuse");
  mountGenStatus("fuse");
  // 換了姿勢參考：付印鈕的「這張已經在印／印過」要重算（簽名裡有姿勢）。
  onPoseChange(() => {
    renderPreview();
    renderPrintBar();
  });
  try {
    const [lexicon, man] = await Promise.all([
      fetch(document.querySelector('link[rel="preload"][href^="lexicon.json"]')?.href || "lexicon.json").then((r) => r.json()),
      fetch(document.querySelector('link[rel="preload"][href^="cards/manifest.json"]')?.href || "cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    data = lexicon;
    lex = indexLexicon(data);
    lib = buildLibrary(data, { ratingBlocked });
    assets = createAssets(man || {});
  } catch (err) {
    $("registers").replaceChildren(el("p", { class: "boot-fail" }, "讀不到詞庫。請用 start.bat 開，而不是直接點 HTML。", el("br"), String(err)));
    return;
  }
  // 疊印台的規則自己一份，跟墨池分開。第一次打開（還沒有自己的）先沿用墨池那一份當起點。
  settings = sanitizeSettings(readJ(FK.settings, null) || S.loadSettings() || { rating: "general" }, data);
  bans = new Set(S.loadBans().filter((t) => lib.byTag.has(t)));
  bed = emptyBed();
  seeds = freshSeeds();
  picked = 0;
  const languageState = takeLanguageState();
  if (languageState) {
    bed = sanitizeBed(languageState.bed, (tag) => lib.byTag.has(tag));
    seeds = languageState.seeds || seeds;
    picked = languageState.picked || 0;
    history = languageState.history || [];
  }
  for (const k of FK_OLD) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* 舊版存下的版：刪不了也不會再讀 */
    }
  }
  caseTab = readJ(FK.tab, "all") || "all";
  prints = loadPrints();

  initLoraPicker();
  initWorkflow({ sampling: true });
  discord = mountDiscord(zh, "疊印台");
  pingLoop();
  wireChrome();

  buildHand();
  buildPreview();
  buildTrialShells();
  renderRating();
  renderCaseTabs();
  // 字盒先畫完。四次試印抽牌跟字盒排在同一個任務裡會超過 50ms。
  // 呼應分頁要等試印的「常補」出來才列得準，所以那種分頁留到抽完再畫。
  if (caseTab !== "match") renderCase();
  // 抽牌、把試印畫上去，各是一個任務：合在一起會超過 50ms。yield 的後續比繪製優先，第一格仍一起出來。
  const yoke = () => (typeof scheduler !== "undefined" && scheduler.yield ? scheduler.yield() : Promise.resolve());
  // 四次抽牌約 50ms 出頭。拆成兩半，每一半自己一個任務。
  await yoke();
  retrial(0, 2);
  await yoke();
  retrial(2, seeds.length);
  await yoke();
  renderAll();
  if (caseTab === "match") renderCase();
  renderLine();
  for (const p of prints) if (p.status === "queued" && p.live && p.job) generator.resume(p);
  // 還排著沒送出去的（去別頁晃一下回來）：照原本的順序接著印（繩上新的在左邊，所以倒過來）。
  const waiting = prints.filter((p) => p._waiting).reverse();
  for (const p of waiting) {
    delete p._waiting;
    generator.enqueue(p);
  }
  if (waiting.length) toast(`接著印剛才排著的 ${waiting.length} 張`);
  for (const p of prints) if (p.status === "done" && p.hiresJob) hiresRun.resume(p, p.hiresJob);
  attachPeek($("case-grid"), ".card[data-tag]", peekInfo);
  // 生圖種子一換，同一張試印對應的成品就不一樣了：成品、付印那條、試印上的小圖都要重畫。
  onSeedChange(() => {
    renderPreview();
    renderTrials();
    renderPrintBar();
  });
  attachPeek($("registers"), ".card[data-tag]", peekInfo);
  if (hand) attachPeek(hand.fan, ".card[data-tag]", peekInfo);
  // 觸控裝置沒有實體鍵盤：搜尋框不提「按 /」（手機上只會把提示擠到看不完）。
  if (matchMedia("(hover: none)").matches) $("case-q").placeholder = $("case-q").placeholder.replace(/（按[^）]*）/, "");
  watchPoolPill();
  watchPrintBar();
  setTimeout(sweepPrints, 1500);
  settleMotion();
  addEventListener("mochi:before-language-change", (event) => {
    event.detail.state = { bed, seeds, picked, history };
    savePrints();
  });

  if (new URLSearchParams(location.search).has("debug")) {
    window.fuse = { get bed() { return bed; }, get trials() { return trials; }, get prints() { return prints; }, place, remove, undo, pick, reroll, printNow };
  }
}

function freshSeeds() {
  return Array.from({ length: TRIALS }, () => randomSeed());
}

function setSettings(patch) {
  // Heat selection has automatic weights; inherited weights belong to the old selection.
  settings = sanitizeSettings({ ...settings, ...(patch.heats ? { weights: undefined } : {}), ...patch }, data);
  writeJ(FK.settings, settings);
  retrial();
  renderAll();
  renderCase();
}

/* ================= 試印：engine 真的會怎麼補 ================= */

function retrial(start = 0, end = seeds.length) {
  const pins = new Set(bed.pins);
  const banned = new Set([...bans, ...HARD_BANNED]);
  const batch = [];
  for (let i = start; i < end && i < seeds.length; i++) {
    const seed = seeds[i];
    const d = drawWithSeed(lex, settings, pins, banned, seed);
    const inPos = new Set(String(d.positive || "").split(",").map((x) => x.trim()));
    const extra = [];
    for (const sec of SECTION_ORDER) {
      for (const t of d.sections[sec] || []) if (lib.byTag.has(t) && !pins.has(t) && !extra.includes(t)) extra.push(t);
    }
    batch.push({
      letter: LETTERS[i],
      seed,
      positive: d.positive || "",
      era: d.era,
      heat: d.heat,
      mine: bed.pins.filter((t) => inPos.has(t)),
      missing: bed.pins.filter((t) => !inPos.has(t)),
      extra,
      eraClash: d.eraClash || [],
    });
  }
  // 整批重抽就整個換掉；只抽其中幾張就換掉那幾格（其他的留著）。
  const whole = start === 0 && end >= seeds.length;
  const next = whole ? [] : trials.slice();
  batch.forEach((b, k) => (next[start + k] = b));
  trials = next;
  if (whole) settleTrials();
  else if (trialsPending) for (let i = start; i < end; i++) trialsPending.delete(i);
}

/*
 * 放牌、拿牌、撤回：四張試印一次抽完要 25～40ms，加上重畫卡池，按下去到牌起飛常常超過 50ms。
 * 改成先抽選中的那一張（卡池的影子就是它補的）、當場畫、牌當場起飛；其他三張等這一格畫面出去了
 * 再抽，抽完只補牌角的四個小點和試印那一排。還沒抽的那幾張，小點先不亮（data-on="wait"），
 * 不會先亮錯的再跳成對的。
 */
let trialsPending = null;
let trialsTimer = 0;
let trialsFrame = 0;
let trialsWork = 0;

function retrialPicked() {
  retrial(picked, picked + 1);
  trialsPending = new Set(seeds.map((_, i) => i).filter((i) => i !== picked));
  deferTrials();
}

function deferTrials() {
  const work = ++trialsWork;
  clearTimeout(trialsTimer);
  cancelAnimationFrame(trialsFrame);
  const next = () => {
    // 放下一張、重抽或當場讀完四張之後，舊任務即使已排進佇列也不能再動新版。
    if (work !== trialsWork || !trialsPending) return;
    clearTimeout(trialsTimer);
    cancelAnimationFrame(trialsFrame);
    // 飛行中的影子已有標記，不讀尺寸：前景先讓牌落地，再做剩下的抽牌。
    // hand.receive 的影子由共用 flight 標 aria-hidden；拖放的影子用 drag-ghost。
    // 背景不等畫面，照保底任務抽完（flight 自己也有背景落地保底）。
    if (!document.hidden && document.querySelector('.flying, .drag-ghost, body > .card[aria-hidden="true"]')) {
      deferTrials();
      return;
    }
    const i = trialsPending.values().next().value;
    if (i !== undefined) retrial(i, i + 1);
    // 一個任務只抽一張，中間留畫面給正在飛的牌；小點仍整批抽完才補上。
    if (trialsPending.size) deferTrials();
    else finishTrials();
  };
  // 下一格畫面之後的第一個任務；分頁在背景（不畫畫面）時也保證會抽完。
  trialsFrame = requestAnimationFrame(() => {
    if (work !== trialsWork || !trialsPending) return;
    clearTimeout(trialsTimer);
    trialsTimer = setTimeout(next, 0);
  });
  trialsTimer = setTimeout(next, 250);
}

function settleTrials() {
  trialsWork++;
  trialsPending = null;
  clearTimeout(trialsTimer);
  cancelAnimationFrame(trialsFrame);
}

/** 還沒抽的試印現在抽完（要讀四張試印的地方先叫這個）；抽完補上小點、試印那一排。 */
function finishTrials() {
  if (!trialsPending) return;
  const todo = [...trialsPending];
  for (const i of todo) retrial(i, i + 1);
  settleTrials();
  refreshInk();
  renderTrials();
  if (caseTab === "match") renderCase();
}

const trialKnown = (i) => !trialsPending || !trialsPending.has(i);
const takeOf = (tag) => trials.filter((t, i) => trialKnown(i) && t.mine.includes(tag)).length;
const knownTrials = () => trials.filter((_, i) => trialKnown(i)).length;

function missReason(tag) {
  const item = lex.byTag.get(tag);
  if (item && ratingBlocked(item, settings.rating)) return `${RATING_LABEL[settings.rating]}抽不到它`;
  if (trials.some((t) => t.eraClash.includes(tag))) return "跟那一張的時代對不上";
  if (heatMismatches(lex, [tag], settings.heats).length) return "目前勾的情境不收它";
  return "被同一格或相剋的字擠掉";
}

// 試印的 seed 是抽牌用的；送 ComfyUI 的那顆看「生圖種子」（固定就換成固定的那顆）。
const printSeedOf = (t) => genSeed(t.seed);
// 分級（伺服器照它換負面詞）、模型、LoRA、workflow 也算進去：換了其中一個再按付印是另一張圖，不是「這一張已經在印了」。
const sigOf = (t) =>
  t ? `${printSeedOf(t)}|${settings.width}x${settings.height}|${settings.rating}|${t.positive}|${currentCkpt() || ""}|${JSON.stringify(currentLorasPayload() || [])}|${currentWorkflowId() || ""}${poseSig()}` : "";
// 換了姿勢參考，同一張試印要能再印一張；沒選姿勢時簽名跟以前一樣（舊的作品還對得上）。
const poseSig = () => {
  const p = currentPose();
  return p ? `|pose:${p.name}:${p.strength}` : "";
};

function printFor(sig) {
  return sig ? prints.find((p) => p.sig === sig) : null;
}

/* ================= 動作：放、拿、撤回 ================= */

const deps = () => ({ lex, applyPin });

function commit(next, label, events = []) {
  history.push({ bed, label });
  if (history.length > HISTORY_MAX) history.shift();
  bed = next;
  rowNotes = {};
  plateNotice = null;
  for (const e of events) {
    if (e.kind !== "replace") continue;
    const suit = suitOf(e.out);
    rowNotes[suit] = {
      text:
        e.why === "people"
          ? e.by === "no humans"
            ? `畫面沒有人物：「${zh(e.out)}」拿下來了`
            : `放了人物的牌：「沒有人物」拿下來了`
          : e.why === "era"
            ? `「${zh(e.out)}」跟「${zh(e.by)}」不是同一個時代，先拿下來了`
            : `同一格只留一張：「${zh(e.out)}」換成「${zh(e.by)}」`,
      back: e.out,
    };
  }
  retrialPicked();
  renderAll(events);
  syncCaseStates();
  updateCaseFoot();
  // 呼應分頁要看四張試印「常補」什麼：等其他三張抽完（finishTrials）才重畫。
}

/**
 * 放一張牌上版。viaDrag：是拖進來的 —— 飛過去、落地由 drag.js 演，這裡不另外飛；
 * 蓋章聲、那一列的墨、被帶上來的牌跳出來，都等影子落地才做（回傳 { landed }）。
 */
function place(tag, sourceEl, { viaDrag = false } = {}) {
  if (!lib.byTag.has(tag)) return;
  if (bed.pins.includes(tag)) return;
  const from = sourceEl && sourceEl.isConnected ? sourceEl.getBoundingClientRect() : null;
  const { bed: next, events } = placeCard(bed, tag, deps());
  if (!events.length) return;
  const leaving = events.filter((e) => e.kind === "replace").map((e) => plateNode(e.out)).filter(Boolean).map(snapshot);
  // 被擠掉的牌如果是偏好卡牌：托盤先藏著那一格，影子飛回去落地才亮。
  for (const e of events) if (e.kind === "replace" && hand?.has(e.out)) hand.arriveAt(e.out, 1200);
  commit(next, `放上「${zh(tag)}」`, events);
  const carried = events.filter((e) => e.kind === "carry").map((e) => e.tag);
  const popCarried = (lag) => carried.forEach((t, i) => popIn(t, lag + i * 90));
  const stampDown = () => {
    inkRow(suitOf(tag));
    sfx.stamp();
    carried.forEach((_, i) => sfx.carry(i));
    haptic(8);
  };
  const settle = (lag) => {
    popCarried(lag);
    stampDown();
  };
  // 被擠掉的牌現在就離開（新的那張正飛過來）。
  leaving.forEach((snap) => flyHome(snap));
  if (leaving.length) setTimeout(() => sfx.lift(), 90);
  let result;
  if (viaDrag) {
    // 被帶上來的牌跟點擊放牌同一個時間跳出來（放下後 140ms，主牌還在空中）：
    // 以前等主牌落地才亮，落地放慢到 480ms 之後，附帶的牌看起來慢半拍才來。
    // 蓋章聲、那一列的墨照舊等主牌落地。
    carried.forEach((t) => {
      const n = plateNode(t);
      if (n) n.style.visibility = "hidden";
    });
    const reveal = () =>
      carried.forEach((t) => {
        const n = plateNode(t);
        if (n) n.style.visibility = "";
      });
    const early = setTimeout(() => {
      reveal();
      popCarried(0);
    }, 140);
    result = {
      landed: () => {
        // 落得比 140ms 還快（減少動態、落點就在手邊）：現在就亮。
        if (reduced()) {
          clearTimeout(early);
          reveal();
          popCarried(0);
        }
        stampDown();
      },
    };
  } else {
    flyIn(tag, from);
    settle(140);
  }
  const bits = [`放上「${zh(tag)}」`];
  if (carried.length) bits.push(`帶上${carried.map((t) => `「${zh(t)}」`).join("")}`);
  for (const e of events) if (e.kind === "replace") bits.push(`「${zh(e.out)}」${e.why === "era" ? "時代不合拿下" : e.why === "people" ? "拿下（沒有人物）" : "被換下"}`);
  announce(bits.join("，"));
  replacedNote(tag, events);
  return result;
}

/**
 * 放一張牌把別的擠下來了：畫面上要說（以前只有讀螢幕聽得到，牌就這樣不見了）。
 * 跟墨池同一套說法；手機上卡池常不在畫面裡，所以用底下的提示，給「撤回」。
 */
function replacedNote(tag, events) {
  const gone = events.filter((e) => e.kind === "replace");
  if (!gone.length) return;
  const of = (why) => gone.filter((e) => (e.why === "era" || e.why === "people" ? e.why : "slot") === why).map((e) => `「${zh(e.out)}」`).join("");
  const parts = [];
  if (of("people")) parts.push(tag === "no humans" ? `畫面沒有人物：${of("people")}拿下來了` : "放了人物的牌：「沒有人物」拿下來了");
  if (of("slot")) parts.push(`同一格只留一張：${of("slot")}換成「${zh(tag)}」`);
  if (of("era")) parts.push(`${of("era")}跟「${zh(tag)}」不是同一個時代，先拿下來了`);
  toast(parts.join("；"), { action: { label: "撤回", run: undo } });
}

/** 分級擋掉的情境被點了：牌搖一下、說為什麼，頂欄的分級亮一下（跟墨池同一套）。 */
function explainBlockedHeat(h, btn, rating) {
  refuse(btn);
  toast(`${RATING_LABEL[rating]}不會出現${HEAT_ZH[h]}：要用的話，先把頂端的分級換成「敏感」或「色情」`);
  const bar = $("rating");
  if (!bar || reduced()) return;
  bar.classList.remove("is-hint");
  void bar.offsetWidth;
  bar.classList.add("is-hint");
  bar.addEventListener("animationend", () => bar.classList.remove("is-hint"), { once: true });
}

/** 拿下一張。viaDrag：拖回字盒的那張由 drag.js 飛回去，這裡只讓它帶上來的牌掀起來。 */
function remove(tag, { viaDrag = false } = {}) {
  if (!bed.pins.includes(tag)) return;
  const { bed: next, events } = removeCard(bed, tag);
  // 偏好卡牌裡的牌：托盤先留好位置藏著，影子落地（flyHome 的 onLand）才亮；拖回去的立刻亮。
  for (const t of events[0]?.tags || [tag]) if (hand?.has(t)) hand.arriveAt(t, viaDrag && t === tag ? 0 : 1200);
  const snaps = (events[0]?.tags || [tag]).filter((t) => !(viaDrag && t === tag)).map((t) => plateNode(t)).filter(Boolean).map(snapshot);
  commit(next, `拿下「${zh(tag)}」`, events);
  snaps.forEach((s, i) => flyHome(s, i * 60));
  sfx.lift();
  haptic(6);
  const also = (events[0]?.tags || []).filter((t) => t !== tag);
  announce(`拿下「${zh(tag)}」${also.length ? `，連同它帶上來的${also.map((t) => `「${zh(t)}」`).join("")}` : ""}`);
}

function toggle(tag, sourceEl) {
  if (bed.pins.includes(tag)) remove(tag);
  else if (caseOpen) {
    // 手機抽屜開著：卡池在抽屜後面看不到，牌飛進抽屜底下的「卡池 N 張」。
    const from = sourceEl && sourceEl.isConnected ? sourceEl.getBoundingClientRect() : null;
    place(tag, null);
    tuckIntoCaseFoot(tag, from);
  } else place(tag, sourceEl);
}

function startWith(starter, btn = null, { fresh = false, kind = "起手" } = {}) {
  // 起手鈕上那幾張小圖：記下位置，放上版之後牌就從小圖那裡飛進各自的列（不是憑空冒出來）。
  const withArt = starter.tags.slice(0, 3).filter((t) => assets.art(t));
  const thumbs = btn ? [...btn.querySelectorAll(".starter-arts img")] : [];
  const fromOf = new Map(withArt.map((t, i) => [t, thumbs[i]?.getBoundingClientRect()]).filter(([, r]) => r && r.width));
  // 牌組是「換成這一組」：從空白版開始放（撤回會回到原本的版）；起手是疊在現在的版上。
  let next = fresh ? emptyBed() : bed;
  const events = [];
  for (const t of starter.tags) {
    const r = placeCard(next, t, deps());
    next = r.bed;
    events.push(...r.events);
  }
  commit(next, `${kind}：${starter.name}`, events);
  starter.tags.forEach((t, i) => {
    const from = fromOf.get(t);
    if (from && !reduced()) flyIn(t, from, { delay: DUR.micro + i * (DUR.micro / 2) });
    else popIn(t, i * 120);
  });
  starter.tags.forEach((t, i) => setTimeout(() => (inkRow(suitOf(t)), sfx.stamp()), i * 120));
  announce(`${kind}：${starter.name}，疊上${starter.tags.map((t) => `「${zh(t)}」`).join("")}`);
}

function undo() {
  const h = history.pop();
  if (!h) return refuse($("undo"));
  // 撤掉的牌先記下位置（重畫之後原地掀起飄走），回來的牌重畫之後一張一張落回去。
  const back = new Set(h.bed.pins);
  const was = new Set(bed.pins);
  const leaving = bed.pins.filter((t) => !back.has(t)).map(plateNode).filter(Boolean).map(snapshot);
  const returning = h.bed.pins.filter((t) => !was.has(t));
  // 回來的牌從哪裡飛出來（重畫之前量，重畫之後托盤那一格就讓出去了）：
  // 偏好卡牌從手上打出去（托盤開著從那一格，收著從標籤長出來）；其他的從字盒那張；都看不到就原地落下。
  const cardW = $("case-grid").querySelector(".card")?.offsetWidth || 84;
  const launch = returning.map((t) => {
    const fromHand = hand?.has(t) ? hand.launchFrom(t, cardW) : null;
    if (fromHand) return { t, ...fromHand };
    const c = caseCard(t);
    const r = c && c.getBoundingClientRect();
    return { t, rect: r && r.width && r.bottom > 0 && r.top < innerHeight ? r : null, node: null, rotate: 0 };
  });
  // 回來的牌重畫出來時就藏著（不要先亮一下、再被藏起來、再飛進來）。
  if (!reduced()) for (const l of launch) claimInbound(l.t);
  // 撤掉的牌跟清版一樣分兩路：偏好卡牌回到手上，其他的回字盒。托盤那幾格在重畫的同一刻先藏著。
  const leaveHand = leaving.filter((s) => hand?.has(s.node.dataset.tag));
  const leaveCase = leaving.filter((s) => !hand?.has(s.node.dataset.tag));
  for (const s of leaveHand) hand.arriveAt(s.node.dataset.tag, 2400);
  bed = h.bed;
  if (h.restore) undoRestore(h.restore);
  rowNotes = {};
  plateNotice = null;
  retrialPicked();
  renderAll([]);
  syncCaseStates();
  // 撤回：上一步放上來的回去（字盒的四張以上先疊成一疊再一起走，不然路線交叉看起來在亂飛）；
  // 上一步拿走的從它們去的地方飛回原位 —— 清版的反過來。影子都在這一刻做好，用 delay 錯開。
  if (hand) hand.receive(leaveHand);
  if (leaveCase.length >= 4) sweepHome(leaveCase, leaveCase.map((s) => s.node.dataset.tag), { start: leaveHand.length ? 110 : 0 });
  else leaveCase.forEach((s, i) => flyHome(s, i * 50));
  // 從手上打出去的先走（它們站在托盤上，托盤正在收攏，等久了會蓋住留下來的牌），字盒的跟著一張一張來。
  const order = [...launch.filter((l) => l.node || (l.rect && hand?.has(l.t))), ...launch.filter((l) => !(l.node || (l.rect && hand?.has(l.t))))];
  const nHand = order.length - launch.filter((l) => !(l.node || (l.rect && hand?.has(l.t)))).length;
  order.forEach((l, i) => {
    const delay = i < nHand ? i * 45 : 60 + nHand * 45 + (i - nHand) * 60;
    flyIn(l.t, l.rect, { delay, src: l.node, startRotate: l.rotate, startScale: l.scale || 1 });
  });
  sfx.undo();
  if (returning.length) setTimeout(() => sfx.stamp(), 60);
  announce(`撤回：${h.label}`);
}

function undoRestore(r) {
  seeds = [...r.seeds];
  picked = r.picked;
  restoreSeed(r.seed);
  const ratingBack = r.rating !== settings.rating;
  if (ratingBack || r.width !== settings.width || r.height !== settings.height) {
    settings = sanitizeSettings({ ...settings, width: r.width, height: r.height, rating: r.rating }, data);
    writeJ(FK.settings, settings);
  }
  if (ratingBack) {
    renderRating();
    renderCase();
  }
}

function clearBed() {
  if (!bed.pins.length) return refuse($("clear"));
  const snaps = bed.pins.map((t) => plateNode(t)).filter(Boolean).map(snapshot);
  // 分兩路：偏好卡牌回到手上，其他的掃成一疊收回字盒。
  const toHand = snaps.filter((s) => hand?.has(s.node.dataset.tag));
  const toCase = snaps.filter((s) => !hand?.has(s.node.dataset.tag));
  // 托盤那幾格在重畫的同一刻就先藏著（等影子落地才亮）。
  for (const s of toHand) hand.arriveAt(s.node.dataset.tag, 2400);
  commit(emptyBed(), "清版", []);
  // 清版：其他的牌先掃成一疊（它們自己的中心），整疊一起收回字盒；字盒裡看得到的那幾張依序輕輕收下。
  // 偏好卡牌同時一張一張飛回手上（托盤開著回那一格，收著收進標籤）。
  // 偏好卡牌先動身（回到手上），其他的晚一拍才開始收成一疊：兩件事分得開，不會看起來像被吸進那疊又跳出來。
  const handMs = hand ? hand.receive(toHand) : 0;
  const ms = sweepHome(toCase, toCase.map((s) => s.node.dataset.tag), { start: toHand.length ? 110 : 0 });
  // 「空白的版」等牌離開卡池才浮上來：不要一按清版底下就瞬間換成起手組、牌還飄在上面。
  const away = Math.max(ms * 0.58, handMs * 0.45);
  if (away && !reduced()) {
    $("registers").animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], {
      duration: DUR.medium,
      delay: Math.round(away),
      easing: css(CURVE.out),
      fill: "backwards",
    });
  }
  sfx.lift();
  announce("清版了。按撤回可以拿回來");
}

function pick(i, { quiet = false } = {}) {
  finishTrials();
  if (i < 0 || i >= trials.length) return;
  if (i === picked) return seat(trialNodes[i]?.node);
  clearTimeout(peekTimer);
  peekTrial = null;
  trialNodes.forEach((n) => n.node.classList.remove("is-peek"));
  // 開著的選單描述的是上一張試印的影子，「收下這張」也還綁著舊的那張：換試印就收起來。
  closePop();
  picked = i;
  renderPlate([]);
  swapGhosts();
  renderPreview();
  renderTrials();
  renderPrintBar();
  seat(trialNodes[i]?.node);
  if (!quiet) sfx.carry();
  announce(`換到試印 ${LETTERS[i]}`);
}

function reroll() {
  seeds = freshSeeds();
  retrial();
  const box = $("trials");
  if (!reduced()) {
    box.classList.remove("is-shuffling");
    void box.offsetWidth;
    box.classList.add("is-shuffling");
    setTimeout(() => box.classList.remove("is-shuffling"), 520);
  }
  renderAll([]);
  if (caseTab === "match") renderCase();
  sfx.shuffle();
  announce("換了一批試印");
}

/* ================= 付印 ================= */

const tabNote = tabTitle();

// 頂欄的 Discord 鈕和送圖（init 裡掛上）。
let discord = null;

const generator = createGenerator({
  origin: "fuse",
  payload: (p) => ({ width: p.width, height: p.height, loras: p.loras, ckpt: p.ckpt, rating: p.rating, workflowId: p.workflowId, ...(p.sampling || {}) , ...(p.pose ? { pose: p.pose } : {}) }),
  update: (p) => {
    tabNote.shot(p, generator.pending);
    paintLineItem(p);
    // 拿到伺服器的工作編號就先存一次：畫到一半重新整理也接得回來。
    if (p.job && p._savedJob !== p.job) {
      p._savedJob = p.job;
      savePrints();
    }
    paintTrialFacesFor(p.sig);
    const t = trials[picked];
    if (t && p.sig === sigOf(t)) {
      renderPreview({ develop: p.status === "done" });
      renderPrintBar();
    } else if (p._shownStatus !== p.status) {
      // 別張開始印、印完了：成品區那行「晾紙繩上還有一張在印」要跟著出現或拿掉（進度每一格不必重畫）。
      renderPreview();
    }
    p._shownStatus = p.status;
    if (p.status === "done") {
      discord?.shot(p);
      sfx.done();
      haptic(14);
      savePrints();
    } else if (p.status === "failed") {
      sfx.fail();
      savePrints();
      if (trials[picked] && p.sig === sigOf(trials[picked])) refuse(pv?.sheet);
    } else if (p.status === "cancelled") dropCancelled(p);
  },
  stopped: (msg) => {
    plateNotice = { kind: "err", text: msg };
    renderPlateNotice();
  },
  // 網路斷了：佇列停在原地等，回來就接著印。提示只收自己放的那一則，別人的不動。
  waiting: (on) => {
    if (on) plateNotice = { kind: "err", text: NET_WAIT_TEXT };
    else if (plateNotice && plateNotice.text === NET_WAIT_TEXT) plateNotice = null;
    renderPlateNotice();
  },
});
const NET_WAIT_TEXT = "連不到主機（網路斷了？），網路回來就接著印";

// Hires：印好的那張放大、重畫細節，做好直接換掉（成品區、晾紙繩都是同一張，見 hires.js）。
const hiresRun = createHires({
  origin: "fuse",
  update: (p) => {
    const t = trials[picked];
    if (t && p.sig === sigOf(t)) {
      const fresh = !p.hi && p._hiresFresh;
      p._hiresFresh = false;
      renderPreview({ develop: fresh });
      renderPrintBar();
    }
    paintLineItem(p);
    // 做完、停掉、做壞了都存一次（做壞的那筆工作編號要從存檔拿掉，不然每次重新整理都再接一次）。
    if (!p.hi || p.hi.status === "failed") savePrints();
  },
  save: () => savePrints(),
  done: (p) => {
    discord?.hires(p);
    sfx.hiresDone();
    haptic(14);
    announce(`Hires 好了：${p.hires.width}×${p.hires.height}`);
  },
});

function openHires(p, btn) {
  if (!p || p.status !== "done" || !p.image) return refuse(btn);
  if (hiresBusy(p)) return refuse(btn);
  openHiresPicker(btn, p, {
    onStart: (mode, scale) => {
      p._hiresFresh = true;
      if (!hiresRun.start(p, mode, scale)) return refuse(btn);
      sfx.hiresStart();
    },
    onRestore: () => {
      p._hiresFresh = true;
      if (hiresRun.restore(p)) announce("換回原圖了");
    },
  });
}

function printNow() {
  const t = trials[picked];
  if (!t) return;
  const sig = sigOf(t);
  const same = printFor(sig);
  if (same && (same.status === "queued" || same.status === "running")) {
    announce("這一張已經在印了");
    return refuse($("print-bar").querySelector(".pb-go"));
  }
  if (comfyOk === false) {
    const bar = $("print-bar");
    bar.classList.remove("is-nudged");
    void bar.offsetWidth;
    bar.classList.add("is-nudged");
    refuse(bar.querySelector(".pb-go"));
    announce(linkNow === "net" ? "連不到主機（網路斷了？），接上再送" : "印刷機（ComfyUI）沒開，先不送");
    return;
  }
  const p = {
    id: "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    sig,
    seed: printSeedOf(t),
    fixedSeed: isFixedSeed(),
    positive: trialPositive(t),
    width: settings.width,
    height: settings.height,
    rating: settings.rating,
    loras: currentLorasPayload(),
    ckpt: currentCkpt(),
    workflowId: currentWorkflowId(),
    sampling: currentSampling(),
    // 姿勢參考（pose.js）：付印那一刻選的那一份，重印照舊。
    pose: currentPose(),
    bed: { pins: [...bed.pins], carried: { ...bed.carried } },
    seeds: [...seeds],
    picked,
    letter: t.letter,
    mine: [...t.mine],
    era: t.era,
    status: "drawn",
    image: null,
    note: "",
    at: new Date().toISOString(),
  };
  prints.unshift(p);
  // 卡冊的使用次數：付印的這張用到的每張牌各一次（試印不算）。要在存檔之前記，見 usage.js。
  recordUses([{ tags: tagsOfPositive(p.positive).filter((tg) => lib.byTag.has(tg)), mine: p.mine }], (tg) => lib.byTag.has(tg));
  // 超過上限從最舊的收掉，但還在排隊、還在畫的不收：收掉了 ComfyUI 照樣畫，畫好卻沒地方看。
  // 它們畫完之後，下一次付印就會照常被收掉。
  for (let i = prints.length - 1; i >= 0 && prints.length > PRINT_MAX; i--) {
    if (prints[i].status !== "queued" && prints[i].status !== "running" && !hiresBusy(prints[i])) prints.splice(i, 1);
  }
  // 先夾上繩子再交給佇列：enqueue 會馬上回報狀態，那時繩上要已經有這張，
  // 不然它會自己重畫一次繩子，這裡再畫一次就把「剛夾上去晃一晃」蓋掉了。
  renderLine();
  generator.enqueue(p);
  savePrints();
  // 新的一張夾在最左邊：繩子已經往右捲的話捲回去，才看得到它開始印。
  $("line-list").scrollTo({ left: 0, behavior: reduced() ? "auto" : "smooth" });
  renderPreview();
  renderTrials();
  renderPrintBar();
  rollPress();
  sfx.roll();
  haptic(18);
  announce(`付印試印 ${t.letter}`);
}

function reprint(p) {
  if (p.status === "queued" || p.status === "running") return refuse($("print-bar").querySelector(".pb-go"));
  if (p._gone) {
    // 原檔被刪的那張：照原樣重印，Hires 的結果不跟著。
    Object.assign(p, { _gone: false, image: null, hi: null, hires: null, baseImage: null });
  }
  p.note = "";
  p.preview = null;
  generator.enqueue(p);
  savePrints();
}

function stopPrinting() {
  generator.stop();
}

/** 取消的那張不掛在繩上：從繩上縮掉、旁邊的滑過來，版和試印跟著更新。 */
function dropCancelled(p) {
  if (!prints.includes(p)) return;
  prints = prints.filter((x) => x !== p);
  savePrints();
  const node = $("line-list").querySelector(`.print[data-id="${cssEsc(p.id)}"]`);
  const li = node?.closest("li");
  leave(node, () => {
    flip($("line-list"), () => li?.remove());
    syncLineEmpty();
    setTimeout(syncLineFade, 0);
    renderAll([]);
  });
}

function loadPrints() {
  const list = readJ(FK.prints, []);
  if (!Array.isArray(list)) return [];
  // 重新整理就把沒印出來的（失敗、取消、停掉的）拿下繩子；只留印好的和畫到一半還接得回去的。
  return list
    .filter((p) => p && p.id && p.positive)
    .filter((p) => p.status === "done" || (p.live && p.job) || S.stillWaiting(p))
    .map((p) => ({
      ...p,
      // 還排著沒送出去的：開機時接在後面排回佇列。
      _waiting: S.stillWaiting(p),
      // 畫到一半就重新整理的那張：標成排隊，開機時用 generator.resume() 接回去。
      status: p.status === "done" ? "done" : p.status === "failed" ? "failed" : (p.live && p.job) || S.stillWaiting(p) ? "queued" : "stopped",
      preview: null,
      progress: p.status === "done" ? 1 : 0,
    }));
}

function savePrints() {
  writeJ(
    FK.prints,
    prints.slice(0, PRINT_MAX).map((p) => ({
      id: p.id,
      albumId: p.albumId || null,
      sig: p.sig,
      seed: p.seed,
      positive: p.positive,
      width: p.width,
      height: p.height,
      rating: p.rating,
      loras: p.loras,
      ckpt: p.ckpt,
      workflowId: p.workflowId,
      sampling: p.sampling || {},
      pose: p.pose || null,
      bed: p.bed,
      fixedSeed: !!p.fixedSeed,
      seeds: p.seeds,
      picked: p.picked,
      letter: p.letter,
      mine: p.mine,
      era: p.era,
      status: p.status === "done" ? "done" : p.status === "failed" ? "failed" : "stopped",
      image: p.image || null,
      baseImage: p.baseImage || null,
      hires: p.hires || null,
      hiresJob: S.hiresJobOf(p),
      job: p.job || null,
      live: !!p.job && (p.status === "running" || p.status === "queued"),
      waiting: S.isWaiting(p),
      waitedAt: S.isWaiting(p) ? Date.now() : 0,
      note: p.status === "done" ? "" : p.note || "",
      at: p.at,
    }))
  );
}

function restorePrint(p) {
  // 回到舊版同時換了尺度、尺寸、試印種子、生圖種子：撤回要一起換回來，不然只有卡牌回去。
  history.push({
    bed,
    label: "回到舊版之前",
    restore: { seeds: [...seeds], picked, width: settings.width, height: settings.height, rating: settings.rating, seed: seedState() },
  });
  bed = sanitizeBed(p.bed, (t) => lib.byTag.has(t));
  if (Array.isArray(p.seeds) && p.seeds.length === TRIALS) seeds = [...p.seeds];
  // 當時是用固定種子印的：把那顆也帶回來，否則同一版會對不上那張成品。
  if (p.fixedSeed) useSeed(p.seed);
  picked = Number.isInteger(p.picked) ? p.picked : 0;
  // 尺寸、尺度一起回到印的那時候：色情尺度印的那一版，在全年齡底下根本抽不到當時的牌。
  const ratingBack = p.rating && p.rating !== settings.rating && RATING_RANK[p.rating] !== undefined;
  const sizeBack = p.width && p.height && (p.width !== settings.width || p.height !== settings.height);
  if (ratingBack || sizeBack) {
    settings = sanitizeSettings(
      { ...settings, ...(sizeBack ? { width: p.width, height: p.height } : {}), ...(ratingBack ? { rating: p.rating } : {}) },
      data
    );
    writeJ(FK.settings, settings);
  }
  rowNotes = {};
  retrial();
  const t = trials[picked];
  const same = t && sigOf(t) === p.sig;
  const bits = [ratingBack ? `尺度切回「${RATING_LABEL[p.rating]}」` : "", sizeBack ? "尺寸也換回當時的" : ""].filter(Boolean);
  // 看得見的說明：尺度換了、或是規則改過對不上當時那張，都寫在卡池上面。
  plateNotice =
    bits.length || !same
      ? { kind: same ? "info" : "err", text: `回到這一版${bits.length ? "：" + bits.join("，") : ""}${same ? "" : "。規則（時代、情境、人物…）改過，試印跟當時不一樣"}` }
      : null;
  if (ratingBack) {
    renderRating();
    renderCase();
  }
  renderAll([]);
  syncCaseStates();
  sfx.stamp();
  announce(plateNotice ? plateNotice.text : "回到這一版了");
}

/* ================= 畫面：全部 ================= */

function renderAll(events = []) {
  // 卡池先畫：它的 FLIP 要量「之前」的位置，這時版面還是上一格畫面排好的（不用重排）。
  // 托盤、試印這些之後才動 DOM，全部留給下一格畫面一起排。
  renderPlate(events);
  hand?.update();
  tickIfChanged($("hand-count"), "hand-count");
  renderPreview();
  renderTrials();
  renderPrintBar();
  renderUndo();
}

/* ================= 成品：選中的那張試印印出來的樣子 ================= */

let pv = null;

function buildPreview() {
  const sheet = el("button", {
    class: "pv-sheet pressable",
    type: "button",
    onclick: () => {
      const p = printFor(sigOf(trials[picked]));
      if (p && (p.image || p.preview)) openPrint(p);
    },
  });
  const blank = el("span", { class: "pv-blank" });
  const roller = el("span", { class: "pv-roller", "aria-hidden": "true" }, el("i"));
  sheet.append(blank, roller);
  const frame = el(
    "div",
    { class: "pv-frame" },
    ["tl", "tr", "bl", "br"].map((c) => el("span", { class: "crop " + c, "aria-hidden": "true" })),
    sheet
  );
  const cap = el("p", { class: "pv-cap" });
  $("preview").replaceChildren(frame, cap);
  pv = { frame, sheet, blank, roller, cap };
  swipeTrials(frame, sheet);
}

/*
 * 手機：預覽圖左右一滑就換試印（A ↔ B ↔ C ↔ D），不必往下捲到試印那一排點。
 * 圖跟著手指走；放開時滑得夠遠（1/4 寬）或夠快，舊的往那邊滑出、新的從另一邊滑進來、輕震一下；
 * 第一張再往右、最後一張再往左：橡皮筋拉不動、彈回來。只接左右 —— 上下照樣捲頁面（touch-action: pan-y）。
 * 滑過之後的那一下 click 不算「點開大圖」。
 */
function swipeTrials(frame, sheet) {
  let start = null;
  let dx = 0;
  let horizontal = null;
  let swallowClick = false;
  const width = () => sheet.getBoundingClientRect().width || 1;
  const move = (x) => {
    sheet.style.translate = `${x}px 0`;
    sheet.style.rotate = `${(x / width()) * 3}deg`;
  };
  const reset = () => {
    sheet.style.translate = "";
    sheet.style.rotate = "";
  };
  frame.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || trials.length < 2) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
    dx = 0;
    horizontal = null;
  });
  frame.addEventListener("pointermove", (e) => {
    if (!start) return;
    const mx = e.clientX - start.x;
    const my = e.clientY - start.y;
    if (horizontal === null && Math.hypot(mx, my) > 8) horizontal = Math.abs(mx) > Math.abs(my) * 1.2;
    if (!horizontal) return;
    const edge = (mx > 0 && picked === 0) || (mx < 0 && picked === trials.length - 1);
    dx = edge ? mx * 0.25 : mx;
    move(dx);
  });
  const end = (e) => {
    if (!start) return;
    const s0 = start;
    start = null;
    if (!horizontal) return reset();
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 400);
    const w = width();
    const speed = Math.abs(dx) / Math.max(1, performance.now() - s0.t);
    const dir = dx < 0 ? 1 : -1;
    const next = picked + dir;
    const go = e.type === "pointerup" && next >= 0 && next < trials.length && (Math.abs(dx) > w / 4 || speed > 0.5);
    if (!go || reduced()) {
      if (!go && !reduced()) {
        sheet.animate([{ translate: `${dx}px 0`, rotate: `${(dx / w) * 3}deg` }, { translate: "0 0", rotate: "0deg" }], { duration: DUR.medium, easing: css(CURVE.settle) });
      }
      reset();
      if (go) pick(next);
      return;
    }
    haptic(10);
    const out = sheet.animate([{ translate: `${dx}px 0`, rotate: `${(dx / w) * 3}deg`, opacity: 1 }, { translate: `${-dir * w * 0.9}px 0`, rotate: `${-dir * 4}deg`, opacity: 0 }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" });
    out.onfinish = () => {
      reset();
      out.cancel();
      pick(next);
      sheet.animate([{ translate: `${dir * w * 0.6}px 0`, rotate: `${dir * 3}deg`, opacity: 0 }, { translate: "0 0", rotate: "0deg", opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
    };
  };
  frame.addEventListener("pointerup", end);
  frame.addEventListener("pointercancel", end);
  // 滑動結束的那一下 click 不開大圖（捕獲階段先攔下來）。
  frame.addEventListener(
    "click",
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true
  );
}

/** 別張（不是選中這張試印的）還在印或排隊：改了卡池之後，成品區換成新的試印，但舊的那張還在跑。 */
function otherPrinting() {
  return prints.some((x) => x.status === "running" || x.status === "queued" || x.status === "drawn");
}

function previewState(p) {
  if (!p) return "還沒付印";
  if (p._gone) return "原檔不在了";
  if (p.status === "running") return `印製中 ${Math.round((p.progress || 0) * 100)}%`;
  if (p.status === "queued" || p.status === "drawn") return "排隊等印…";
  return STATUS_ZH[p.status] || "";
}

function renderPreview({ develop = false } = {}) {
  const t = trials[picked];
  if (!pv || !t) return;
  const p = printFor(sigOf(t));
  const w = p ? p.width : settings.width;
  const h = p ? p.height : settings.height;
  pv.frame.style.setProperty("--arn", String(w / h));
  pv.sheet.style.setProperty("--ar", `${w} / ${h}`);
  const state = p ? p.status : "none";
  $("preview").dataset.empty = p ? "false" : "true";
  pv.sheet.dataset.state = state;
  const src = printSrc(p);
  let img = pv.sheet.querySelector("img");
  if (src) {
    if (!img) {
      img = el("img", { alt: "", decoding: "async", draggable: "false" });
      pv.sheet.prepend(img);
      watchGone(img, goneAt);
    }
    if (img.getAttribute("src") !== src) {
      // 上一幀墊在底下（.pv-under），新的一幀載好了才淡進來／顯影 —— 解碼的那一下不會空掉。
      const prevSrc = img.getAttribute("src");
      if (prevSrc && !reduced()) {
        let under = pv.sheet.querySelector(".pv-under");
        if (!under) {
          under = el("img", { class: "pv-under", alt: "", "aria-hidden": "true", draggable: "false" });
          pv.sheet.append(under);
        }
        under.src = (p && p._hiresUnder) || prevSrc;
        if (p) p._hiresUnder = null;
        if (!develop) {
          const fade = () => {
            if (img.getAttribute("src") !== src) return;
            img.classList.remove("is-pv-in");
            void img.offsetWidth;
            img.classList.add("is-pv-in");
          };
          img.addEventListener("load", fade, { once: true });
        }
      }
      img.src = src;
    }
    img.alt = `試印 ${t.letter} 的成品`;
  } else {
    img?.remove();
    pv.sheet.querySelector(".pv-under")?.remove();
  }
  // 印製中的預覽幀越印越濃，印好才是全濃度。
  pv.sheet.style.setProperty("--print-o", state === "running" ? String(0.4 + 0.6 * (p.progress || 0)) : "1");
  if (develop && src && !reduced()) {
    // 成品剛好在眼前印好：像紙從滾筒下出來，由上往下顯影。等成品真的載好才開始 ——
    // 遠端時圖還在路上，先播的話動畫跑完了圖才到，最後還是硬跳出來。
    const sheet = pv.sheet;
    const go = () => {
      if (img.getAttribute("src") !== src) return;
      sheet.classList.remove("is-developing");
      void sheet.offsetWidth;
      sheet.classList.add("is-developing");
      setTimeout(() => {
        sheet.classList.remove("is-developing");
        if (img.getAttribute("src") === src) sheet.querySelector(".pv-under")?.remove();
      }, 1300);
    };
    if (img.complete && img.naturalWidth) go();
    else img.addEventListener("load", go, { once: true });
  }
  pv.sheet.disabled = !src;
  pv.sheet.setAttribute("aria-label", src ? `試印 ${t.letter} 的成品，點開看大圖` : p ? `試印 ${t.letter}：${previewState(p)}` : "預覽：選試印後付印");
  pv.blank.hidden = !!src;
  if (!src) {
    put(
      pv.blank,
      p ? el("b", { class: "pv-letter", "aria-hidden": "true" }, t.letter) : null,
      el("span", { class: "pv-state" }, p ? previewState(p) : "選試印後付印"),
      !p ? el("span", { class: "pv-hint" }, otherPrinting() ? "晾紙繩上還有一張在印；這一版也可以先付印。" : "從下方選一張試印，再付印成圖。") : null,
      p && p.status === "failed" && p.note ? el("span", { class: "pv-hint" }, p.note) : null,
      p && p._gone ? el("span", { class: "pv-hint" }, "ComfyUI 的輸出資料夾裡找不到這張，可能被刪掉了。按「再印一次」照原樣重印。") : null
    );
  }
  paintHiresVeil(pv.frame, p || {}, { onCancel: () => hiresRun.cancel(p), onDismiss: () => hiresRun.dismiss(p) });
  pv.roller.hidden = !(state === "running" || state === "queued" || state === "drawn");
  pv.roller.dataset.state = state;
  pv.roller.style.setProperty("--p", String(state === "running" ? p.progress || 0 : 0));
  put(
    pv.cap,
    el("b", { class: "pv-cap-letter" }, p ? `試印 ${t.letter}` : "預覽"),
    el("span", { class: "pv-cap-state", dataset: { state } }, previewState(p)),
    el("span", { class: "pv-cap-seed" }, `${isFixedSeed() ? "固定 seed" : "seed"} ${p ? p.seed : printSeedOf(t)}`)
  );
}

/** 付印：一條滾筒的陰影從成品那張紙上壓過去。 */
function rollPress() {
  if (reduced() || !pv) return;
  const r = el("span", { class: "press-roll", "aria-hidden": "true" });
  pv.sheet.append(r);
  setTimeout(() => r.remove(), 900);
}

/* ================= 試印 ================= */

let trialNodes = [];

function buildTrialShells() {
  const box = $("trials");
  trialNodes = LETTERS.map((letter, i) => {
    const face = el("span", { class: "trial-face", "aria-hidden": "true" }, el("b", { class: "trial-letter" }, letter));
    const meta = el("span", { class: "trial-meta" });
    const picks = el("span", { class: "trial-picks", "aria-hidden": "true" });
    const node = el(
      "button",
      { class: "trial pressable", type: "button", role: "radio", dataset: { i: String(i) }, onclick: () => pick(i) },
      face,
      el("span", { class: "trial-body" }, meta, picks)
    );
    // 滑鼠停一下（160ms，掃過去不算）就先預覽這張試印補的牌；移開就回到選中的那張。只看滑鼠 ——
    // 觸控沒有「停在上面」這回事，點下去就直接換過去了。
    node.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => peekAt(i), 160);
    });
    node.addEventListener("pointerleave", () => {
      clearTimeout(peekTimer);
      peekAt(null);
    });
    node.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const j = (i + d + TRIALS) % TRIALS;
      pick(j);
      trialNodes[j].node.focus();
    });
    return { node, face, meta, picks };
  });
  box.replaceChildren(...trialNodes.map((n) => n.node));
}

function peekAt(i) {
  if (i !== null) finishTrials();
  const next = i === null || i === picked || !trials[i] || !bed.pins.length ? null : i;
  if (next === peekTrial) return;
  peekTrial = next;
  trialNodes.forEach((n, j) => n.node.classList.toggle("is-peek", j === peekTrial));
  closePop();
  renderPlate([]);
  swapGhosts();
}

function renderTrials() {
  trials.forEach((t, i) => {
    const n = trialNodes[i];
    n.node.setAttribute("aria-checked", i === picked ? "true" : "false");
    n.node.tabIndex = i === picked ? 0 : -1;
    const p = printFor(sigOf(t));
    put(
      n.meta,
      el("span", {}, `補 ${t.extra.length}`),
      el("span", {}, ERA_ZH[t.era] || ""),
      t.missing.length ? el("span", { class: "trial-miss", title: `沒進這張：${t.missing.map(zh).join("、")}` }, `缺 ${t.missing.length}`) : null
    );
    // 牌沒變就不重建：換試印、印製進度都會叫到這裡，不要讓小圖一直重載。
    const show = trialHighlights(t);
    const key = show.join("|");
    if (n.picks.dataset.key !== key) {
      n.picks.dataset.key = key;
      put(
        n.picks,
        show.map((tag) =>
          el(
            "span",
            { class: "trial-pick", title: zh(tag), style: `--suit: var(--suit-${suitOf(tag)})` },
            assets.art(tag) ? applyArtSources(el("img", { alt: "", decoding: "async" }), assets.sources(tag)) : el("b", {}, [...zh(tag)][0])
          )
        )
      );
    }
    paintTrialFace(i, p);
    n.node.setAttribute(
      "aria-label",
      `試印 ${t.letter}：引擎補 ${t.extra.length} 張，${ERA_ZH[t.era] || ""}${t.missing.length ? `，有 ${t.missing.length} 張你的牌沒進去` : ""}${p ? `，${previewState(p)}` : ""}`
    );
  });
}

/** 試印左邊那一格：印過就放成品的小圖，沒印過就是字母。 */
function paintTrialFace(i, p = printFor(sigOf(trials[i]))) {
  const n = trialNodes[i];
  if (!n) return;
  const src = printSrc(p);
  n.node.dataset.printed = p ? p.status : "none";
  let img = n.face.querySelector("img");
  if (src) {
    if (!img) {
      n.face.prepend((img = el("img", { alt: "", decoding: "async", draggable: "false" })));
      watchGone(img, goneAt);
    }
    if (img.getAttribute("src") !== src) img.src = src;
  } else img?.remove();
  n.face.style.setProperty("--p", String(p && p.status === "running" ? p.progress || 0 : 0));
}

function paintTrialFacesFor(sig) {
  trials.forEach((t, i) => {
    if (sigOf(t) === sig) paintTrialFace(i);
  });
}

/** 一張試印裡引擎補的、最看得出差別的幾張：先挑你沒放的那幾套，每套一張。 */
function trialHighlights(t) {
  const filled = new Set(bed.pins.map(suitOf));
  const order = ["look", "wear", "pose", "scene", "cast", "style"].sort((a, b) => filled.has(a) - filled.has(b));
  const out = [];
  for (const suit of order) {
    const hit = t.extra.find((x) => suitOf(x) === suit && assets.art(x) && !out.includes(x));
    if (hit) out.push(hit);
    if (out.length >= 4) break;
  }
  return out;
}

/* ================= 卡池：六個套版 ================= */

const plateNode = (tag) => $("registers").querySelector(`.plate-card[data-tag="${cssEsc(tag)}"]`);

/* ---------- 卡池跟著視窗大小：牌多大、每列放幾張影子 ----------
 * 寬螢幕上卡池有固定的高度：挑一個最大的牌寬，讓六列剛好一次放進去不用捲；
 * 但不小於字盒牌寬的 1.1 倍（wideFloor），牌多到那樣也放不下就捲，不把牌縮到比字盒還小。
 * 每一列的影子排到那一排放滿就停，放不完的收成「+N」—— 視窗越寬，看得到的影子越多。
 * 窄螢幕整頁往下捲，牌寬只看寬度：一排大約四張。
 * 先用算的（牌的比例、間距都是 CSS 裡的固定值），畫上去之後再量一次，真的溢出就再縮一點。 */

const CARD_AR = 702 / 480;
const GHOST_SCALE = 0.76;
const GAP_X = 10;
const GAP_Y = 12;
const FIT_MIN = 56;
const FIT_MAX = 176;
// 寬螢幕卡池牌寬的下限（見 planPool）：比左邊字盒的牌大一點（1.1 倍）；字盒還沒有牌就照卡池寬估（一排約九張）。
const wideFloor = (cardsW) => {
  const caseW = $("case-grid")?.querySelector(".card")?.offsetWidth || cardsW / 9;
  return Math.min(FIT_MAX, Math.max(FIT_MIN, Math.round((caseW * 1.1) / 2) * 2));
};
const wideLayout = typeof matchMedia === "function" ? matchMedia("(min-width: 68.75rem)") : { matches: true };
let poolFit = { w: 0, planW: 0, caps: {}, cardsW: 0, headH: 0 };

function planPool(t, empty) {
  // 空白的版不用算（牌寬交回 CSS 的預設）。也別去量寬度：開機時卡池一定是空的，
  // 這時候一量就逼整頁提早排版一次（字盒幾十張牌還在往裡塞），白白多花一百多毫秒。
  if (empty) return { w: 0, caps: {}, cardsW: 0 };
  const box = $("registers");
  const cs = getComputedStyle(box);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const wide = wideLayout.matches;
  const cardsW =
    box.querySelector(".reg-cards")?.clientWidth ||
    Math.max(160, box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (wide ? 5 : 3.2) * rem);
  const rows = REGISTERS.map((suit) => ({
    suit,
    mine: bed.pins.filter((x) => suitOf(x) === suit).length,
    ghosts: t ? t.extra.filter((x) => suitOf(x) === suit).length : 0,
    note: !!rowNotes[suit],
  }));
  const headH = poolFit.headH || 2.2 * rem;
  const padY = 1.35 * rem;
  const noteH = 1.7 * rem;
  const moreW = 3 * rem;
  const splitW = 9;
  const tail = parseFloat(cs.paddingBottom) + (REGISTERS.length - 1);
  const sim = (w, withExpanded) => {
    const gw = w * GHOST_SCALE;
    const h = w * CARD_AR;
    const gh = gw * CARD_AR;
    const caps = {};
    let total = tail;
    for (const r of rows) {
      let x = 0;
      let lines = 0;
      let lineH = 0;
      let height = 0;
      const push = (iw, ih) => {
        if (!lines) {
          lines = 1;
          x = iw;
          lineH = ih;
        } else if (x + GAP_X + iw > cardsW + 0.5) {
          height += lineH + GAP_Y;
          lines++;
          x = iw;
          lineH = ih;
        } else {
          x += GAP_X + iw;
          lineH = Math.max(lineH, ih);
        }
      };
      const room = (iw) => !lines || x + GAP_X + iw <= cardsW + 0.5;
      for (let i = 0; i < r.mine; i++) push(w, h);
      if (r.ghosts) {
        if (r.mine) push(splitW, 0);
        // 至少給一張影子；之後排到這一排放滿為止，還要留位置給「+N」——
        // 硬塞第二張的話，手機上「+N」會自己掉到下一排，白白多佔一整排的高度。
        let cap = 0;
        while (cap < r.ghosts) {
          const more = r.ghosts - cap > 1;
          if (cap >= 1 && !room(gw + (more ? GAP_X + moreW : 0))) break;
          push(gw, gh);
          cap++;
        }
        caps[r.suit] = cap;
        if (cap < r.ghosts) {
          if (withExpanded && expanded.has(r.suit)) for (let i = cap; i < r.ghosts; i++) push(gw, gh);
          push(moreW, 32);
        }
      }
      const content = lines ? height + lineH : 1.3 * rem;
      total += padY + Math.max(headH, content, w * 0.5) + (r.note ? noteH : 0);
    }
    return { caps, total };
  };
  let w;
  if (wide) {
    // 展開的那一列不算進去：點開「+N」不該讓整池的牌一起縮小，那一列多出來的就捲。
    const H = $("plate-scroll").clientHeight;
    w = FIT_MIN;
    for (let c = FIT_MAX; c >= FIT_MIN; c -= 2) {
      if (sim(c, false).total <= H) {
        w = c;
        break;
      }
    }
    // 卡池本來就能捲：塞不下時不要一路縮小，牌寬最小到比字盒的牌大一點（1080p 約 96px），多的往下捲。
    w = Math.max(w, wideFloor(cardsW));
  } else {
    w = Math.round(Math.max(60, Math.min(96, (cardsW - 3 * GAP_X) / 4)));
  }
  return { w, caps: sim(w, false).caps, cardsW };
}

function applyFit(plan) {
  const box = $("registers");
  box.querySelector(".rel-layer")?.remove();
  poolFit.caps = plan.caps;
  poolFit.planW = plan.w;
  poolFit.cardsW = plan.cardsW;
  let w = plan.w;
  if (!w) {
    box.style.removeProperty("--pool-card");
    poolFit.w = 0;
    return;
  }
  box.style.setProperty("--pool-card", w + "px");
  if (!wideLayout.matches) {
    // 窄螢幕：卡池排在字盒上面、整頁一起捲，牌寬只看欄寬（planPool 的 else）。
    // 以前這裡當場讀列頭高度、欄寬 —— 手機上一讀就要把整頁（連底下一大片字盒）排一次，
    // 放一張牌光這裡 60ms（CPU 降速 4 倍時 240ms）。列頭高度窄螢幕用不到；
    // 欄寬等下一格畫面再讀，那時版面已經排好，讀起來不花錢。
    poolFit.w = w;
    requestAnimationFrame(() => {
      const real = box.querySelector(".reg-cards")?.clientWidth;
      if (real && Math.abs(real - poolFit.cardsW) > 2) scheduleFit();
    });
    return;
  }
  const head = box.querySelector(".reg-head");
  if (head && head.offsetHeight) poolFit.headH = head.offsetHeight;
  // 算的跟畫出來的對不上（第一次畫、欄寬剛變）：等一下照實際的寬再排一次。
  const real = box.querySelector(".reg-cards")?.clientWidth;
  if (real && Math.abs(real - plan.cardsW) > 2) scheduleFit();
  if (!expanded.size) {
    // 算的還是放不下（第一次放牌時列頭高度、欄寬都還是猜的）：找放得下的最大牌寬。
    // 用二分搜尋：每試一次都要整個卡池排版一次，以前一次縮 2px、最多試 16 次，第一次放牌光這裡 45ms。
    const sc = $("plate-scroll");
    const fits = (x) => {
      box.style.setProperty("--pool-card", x + "px");
      return sc.scrollHeight <= sc.clientHeight + 1;
    };
    // 縮也只縮到下限（planPool 的 wideFloor），再放不下就讓卡池捲。
    const floor = Math.min(w, wideFloor(plan.cardsW));
    if (w > floor && !fits(w)) {
      let lo = floor;
      let hi = w - 2;
      let best = floor;
      while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 4) * 2;
        if (fits(mid)) {
          best = mid;
          lo = mid + 2;
        } else hi = mid - 2;
      }
      w = best;
      box.style.setProperty("--pool-card", w + "px");
    }
  }
  poolFit.w = w;
}

const sameCaps = (a, b) => REGISTERS.every((s) => (a[s] ?? -1) === (b[s] ?? -1));

let fitTimer = 0;

function scheduleFit() {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(refitPool, 60);
}

/** 視窗（或卡池那一欄）大小變了：影子張數變了就重排，只是牌寬變了就只改寬度、重畫記號。 */
function refitPool() {
  if (!lib || !trials.length) return;
  const plan = planPool(trials[peekTrial ?? picked], !bed.pins.length);
  if (!sameCaps(plan.caps, poolFit.caps)) {
    closePop();
    renderPlate([]);
    return;
  }
  if (plan.w === poolFit.planW && Math.abs(plan.cardsW - poolFit.cardsW) <= 2) return;
  closePop();
  applyFit(plan);
  requestRelations([]);
}

function renderPlate(events = []) {
  const box = $("registers");
  // 預覽中（滑鼠停在別張試印上）影子畫那一張的；其他地方（付印、預覽圖）照舊跟著選中的那張。
  const peeking = peekTrial !== null && trials[peekTrial];
  const t = peeking ? trials[peekTrial] : trials[picked];
  const empty = !bed.pins.length;
  relFocus = null;
  renderPlateNotice();
  const plan = planPool(t, empty);
  const rows = REGISTERS.map((suit) => {
    const mine = bed.pins.filter((x) => suitOf(x) === suit);
    // 空白的版不列引擎的影子：還沒有東西可以對照，只會讓人以為版上已經有牌。
    const ghosts = !empty && t ? t.extra.filter((x) => suitOf(x) === suit) : [];
    const cap = plan.caps[suit] ?? ghosts.length;
    const open = expanded.has(suit);
    const shown = open ? ghosts : ghosts.slice(0, cap);
    const info = CARD_SUIT_INFO[suit];
    const cards = mine.map((tag) => plateCard(tag));
    // 你的牌跟引擎補的中間隔一條細線：左邊是版上的，右邊是這一張試印的影子。
    if (mine.length && shown.length) cards.push(el("span", { class: "reg-split", "aria-hidden": "true" }));
    cards.push(...shown.map((tag) => ghostCard(tag, t)));
    if (ghosts.length > cap) {
      cards.push(
        el(
          "button",
          {
            class: "ghost-more pressable",
            type: "button",
            "aria-expanded": open ? "true" : "false",
            title: open ? undefined : ghosts.slice(cap).map(zh).join("、"),
            "aria-label": open ? `收起${REGISTER_ROLE[suit]}的影子` : `再看 ${ghosts.length - cap} 張引擎補的${REGISTER_ROLE[suit]}`,
            onclick: () => {
              if (open) expanded.delete(suit);
              else expanded.add(suit);
              renderPlate([]);
              box.querySelector(`.register[data-suit="${suit}"] .ghost-more`)?.focus({ preventScroll: true });
            },
          },
          open ? "收起" : `+${ghosts.length - cap}`
        )
      );
    }
    const note = rowNotes[suit];
    return el(
      "section",
      {
        class: "register",
        dataset: { suit, filled: mine.length ? "true" : "false" },
        "aria-label": `${REGISTER_ROLE[suit]}（${info.zh}）：你的 ${mine.length} 張${ghosts.length ? `，引擎補 ${ghosts.length} 張` : ""}`,
      },
      el(
        "header",
        { class: "reg-head" },
        el("span", { class: "reg-glyph", "aria-hidden": "true" }, info.glyph),
        el("span", { class: "reg-role" }, REGISTER_ROLE[suit]),
        el("span", { class: "reg-count" }, mine.length ? String(mine.length) : "")
      ),
      el(
        "div",
        { class: "reg-cards" },
        cards.length ? cards : empty ? null : el("span", { class: "reg-empty" }, suit === "style" ? "不罩色" : "空著")
      ),
      note
        ? el(
            "p",
            { class: "reg-note" },
            note.text,
            " ",
            el("button", { class: "link-btn pressable", type: "button", onclick: () => place(note.back) }, "換回")
          )
        : null
    );
  });
  if (!empty) starterPick = null;
  // 整塊重畫時同一張牌從舊位置滑到新位置（拿下一張、放上一張時，同一列的其他牌讓位）；
  // 影子被收下變成正式的牌，從影子的位置滑進去。
  const cardKey = (n) => (n.classList.contains("ghost-card") ? "g:" : "p:") + n.dataset.tag;
  // 空白的版 ↔ 有牌：整面舊的像一張紙往上收走，新的一列一列從上往下浮上來（兩個方向一樣）。
  // 以前讓六個列名從緊湊格子各自滑到新位置，逐格看是斜著亂飛、跨半個畫面，太忙。
  const wasEmpty = box.dataset.empty === "true";
  const morph = box.dataset.empty !== undefined && wasEmpty !== empty && !reduced();
  let sheet = null;
  if (morph) {
    const r = box.getBoundingClientRect();
    const g = box.cloneNode(true);
    g.removeAttribute("id");
    g.querySelector(".rel-layer")?.remove();
    // 你的牌不跟著這張紙走：清版、撤回、拿下來各有自己的路線（掃回字盒、飛回托盤）。留著的話會同時看到兩份。
    for (const c of g.querySelectorAll(".plate-card")) c.style.visibility = "hidden";
    sheet = { node: g, rect: r };
  }
  // 卡池捲出畫面（手機上在底下的字盒挑牌）：看不到的滑動不必演，也就不用量每張牌的位置
  // （量一次要把整頁排版一次，CPU 慢的手機上 30ms 以上）。
  (plateSeen ? flipBy : (_box, _sel, _key, mutate) => mutate())(box, ".plate-card, .ghost-card", cardKey, () => {
    put(box, empty ? startBlock() : null, rows);
    box.dataset.empty = empty ? "true" : "false";
    if (plan.w) box.style.setProperty("--pool-card", plan.w + "px");
    else box.style.removeProperty("--pool-card");
  }, {
    alias: (k) => (k.startsWith("p:") ? "g:" + k.slice(2) : null),
  });
  if (morph) morphPlate(box, sheet);
  if (peeking) box.dataset.peek = t.letter;
  else delete box.dataset.peek;
  const sub = $("plate-sub");
  sub.classList.toggle("is-peek", !!peeking && !empty);
  sub.textContent = empty
    ? "還沒有牌"
    : peeking
      ? `預覽試印 ${t.letter}：引擎補 ${t.extra.length} 張・點一下換過去`
      : t
        ? `試印 ${t.letter}：你的 ${bed.pins.length} 張，引擎補 ${t.extra.length} 張`
        : `你的 ${bed.pins.length} 張`;
  tickIfChanged(sub, "plate-sub");
  for (const n of box.querySelectorAll(".reg-count")) tickIfChanged(n, "reg:" + (n.closest(".register")?.dataset.suit || ""));
  $("clear").disabled = empty;
  applyFit(plan);
  renderPill();
  requestRelations(events);
}

function morphPlate(box, sheet) {
  if (sheet) {
    const g = sheet.node;
    const r = sheet.rect;
    g.setAttribute("aria-hidden", "true");
    g.inert = true;
    Object.assign(g.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, margin: "0", zIndex: "5", pointerEvents: "none" });
    box.parentElement.append(g);
    g.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(-14px)" },
      ],
      // 要在新的列浮上來之前走掉大半，兩層字才不會疊在一起讀不清楚。
      // 用 out（一開始就走得快）不用 exit：exit 前段幾乎不動，舊的那張會整張停在原地、跟浮上來的新列疊在一起。
      { duration: DUR.short, easing: css(CURVE.out), fill: "forwards" }
    ).onfinish = () => g.remove();
  }
  const step = DUR.micro / 4;
  [...box.children].forEach((part, i) => {
    if (part.classList.contains("rel-layer")) return;
    part.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: DUR.medium, delay: DUR.micro + i * step, easing: css(CURVE.out), fill: "backwards" }
    );
  });
}

function pickStarters(avoid = []) {
  const ok = STARTERS.filter((s) => s.tags.every((t) => lib.byTag.has(t) && rankOk(cardOf(t)) && !bans.has(t)));
  // 換一組時盡量不要又出現剛剛那三組。
  const fresh = ok.filter((s) => !avoid.includes(s.name));
  const pool = fresh.length >= 3 ? fresh : ok;
  const out = [];
  const bag = [...pool];
  while (out.length < 3 && bag.length) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  return out;
}

function reshuffleStarters() {
  starterPick = pickStarters((starterPick || []).map((s) => s.name));
  const box = $("registers").querySelector(".starters");
  renderPlate([]);
  const again = $("registers").querySelector(".starters");
  if (again && !reduced()) {
    again.classList.remove("is-shuffled");
    void again.offsetWidth;
    again.classList.add("is-shuffled");
  }
  again?.querySelector(".starters-more")?.focus({ preventScroll: true });
  void box;
  sfx.shuffle();
}

/**
 * 套用一組牌：卡池換成這一組（從空白版照放牌的規矩一張張放，撤回會回到原本的版）。
 * 這一級分級出不了、或丟進廢字簍的牌先跳過，提示上說幾張。
 */
function applyDeck(deck, btn = null, { fresh = true, kind = "牌組", label = `牌組「${deck.name}」` } = {}) {
  const ok = deck.tags.filter((t) => lib.byTag.has(t) && rankOk(cardOf(t)) && !bans.has(t));
  const skipped = deck.tags.length - ok.length;
  if (!ok.length) {
    if (btn) refuse(btn);
    return toast(`${label}的牌在${RATING_LABEL[settings.rating]}都出不了`);
  }
  startWith({ name: deck.name, tags: ok }, btn, { fresh, kind });
  // 牌組、貼上的提示詞帶來的份量：放上去之後一起蓋上（撤回會連份量一起退回）。
  const dw = deck.weights || {};
  if (Object.keys(dw).length) {
    const merged = { ...(fresh ? {} : bed.weights || {}) };
    for (const t of bed.pins) if (dw[t] && dw[t] !== 1) merged[t] = dw[t];
    if (Object.keys(merged).length) bed = { ...bed, weights: merged };
    for (const t of Object.keys(merged)) paintWeight(plateNode(t), merged[t]);
  }
  toast(`${fresh ? "換成" : "疊上"}${label}${skipped ? `（${skipped} 張這一級出不了或在廢字簍，先跳過）` : ""}`, { action: { label: "撤回", run: undo } });
}

// 貼上提示詞變成牌（paste-prompt.js）：牌組面板裡、電腦上在空白處按 Ctrl+V。
function openPastePlate(text = "") {
  openPaste({
    where: "卡池",
    text,
    lexTags: data.tags.map((t) => t.tag),
    isCard: (t) => lib.byTag.has(t),
    zh,
    apply: (tags, { replace, weights: w }) => applyDeck({ name: "貼上的提示詞", tags, weights: w }, null, { fresh: replace, kind: "貼上", label: "貼上的提示詞" }),
    // 卡池放不上去的會跳過（applyDeck），預覽先說。
    off: (t) => (!rankOk(cardOf(t)) ? `${RATING_LABEL[settings.rating]}出不了，會跳過` : bans.has(t) ? "在廢字簍，會跳過" : null),
  });
}

const openDeckSheet = () =>
  openDecks({ where: "卡池", current: () => [...bed.pins], weightsNow: () => ({ ...(bed.weights || {}) }), has: (t) => lib.byTag.has(t), zh, apply: (d) => applyDeck(d), paste: () => openPastePlate() });

/** 空白版上「你的牌組」：最近的三組，跟起手式同一種按鈕。 */
function deckStarters() {
  const decks = (cachedDecks() || []).map((d) => ({ ...d, tags: d.tags.filter((t) => lib.byTag.has(t)) })).filter((d) => d.tags.length).slice(0, 3);
  if (!decks.length) return null;
  return el(
    "div",
    { class: "starters starters-decks" },
    el(
      "span",
      { class: "starters-label" },
      "你的牌組",
      el("button", { class: "starters-more link-btn pressable", type: "button", onclick: openDeckSheet }, "全部")
    ),
    decks.map((d) =>
      el(
        "button",
        { class: "starter pressable", type: "button", onclick: (e) => applyDeck(d, e.currentTarget) },
        el(
          "span",
          { class: "starter-arts", "aria-hidden": "true" },
          d.tags.filter((tg) => assets.art(tg)).slice(0, 3).map((tg) => applyArtSources(el("img", { alt: "" }), assets.sources(tg)))
        ),
        el("span", { class: "starter-name", dataset: { noI18n: "" } }, d.name),
        el("span", { class: "starter-tags" }, d.tags.map(zh).join("・"))
      )
    )
  );
}

function startBlock() {
  if (!starterPick) starterPick = pickStarters();
  const starters = starterPick.filter((s) => s.tags.every((t) => lib.byTag.has(t) && rankOk(cardOf(t)) && !bans.has(t)));
  return el(
    "div",
    { class: "pool-start" },
    el("p", { class: "pool-start-lead" }, "空白的版"),
    el(
      "p",
      { class: "pool-start-body" },
      "從字盒挑牌，或用下方起手式；留白的層由引擎補上。",
      // 手機沒有滑鼠懸停的放大卡：長按（放開）是唯一看得到牌面說明的地方，寫在第一次挑牌的這裡。
      // 自己一行：兩句黏在同一個文字節點裡，英文版會變成「layers.Long press」。
      matchMedia("(hover: none)").matches ? el("span", { class: "pool-start-hint" }, "長按一張牌放開，可以看它的說明。") : null
    ),
    deckStarters(),
    starters.length
      ? el(
          "div",
          { class: "starters" },
          el(
            "span",
            { class: "starters-label" },
            "或者從這裡起手",
            el("button", { class: "starters-more link-btn pressable", type: "button", onclick: reshuffleStarters }, "換一組")
          ),
          starters.map((s) =>
            el(
              "button",
              { class: "starter pressable", type: "button", onclick: (e) => startWith(s, e.currentTarget) },
              el(
                "span",
                { class: "starter-arts", "aria-hidden": "true" },
                s.tags.slice(0, 3).map((tg) => (assets.art(tg) ? applyArtSources(el("img", { alt: "" }), assets.sources(tg)) : null))
              ),
              el("span", { class: "starter-name" }, s.name),
              el("span", { class: "starter-tags" }, s.tags.map(zh).join("・"))
            )
          )
        )
      : null
  );
}

/** 牌落進哪一列，那一列就暈開一下它花色的墨。 */
function inkRow(suit) {
  if (!suit || reduced()) return;
  const row = $("registers").querySelector(`.register[data-suit="${suit}"]`);
  if (!row) return;
  // 重播動畫：拿掉、下一格畫面再加回去。以前用 void offsetWidth 逼一次同步排版，手機上要 20ms 以上。
  row.classList.remove("is-inked");
  requestAnimationFrame(() => {
    row.classList.add("is-inked");
    setTimeout(() => row.classList.remove("is-inked"), 900);
  });
}

/** 換一張試印：影子那幾張換成那一張補的，淡入一下讓人看得出換了。 */
function swapGhosts() {
  if (reduced()) return;
  const box = $("registers");
  box.classList.remove("ghosts-in");
  requestAnimationFrame(() => {
    box.classList.add("ghosts-in");
    setTimeout(() => box.classList.remove("ghosts-in"), 420);
  });
}

/** 牌底下四個小點：四張試印各一個，這張牌有進那一張就上墨。 */
const dotState = (tag, i) => (!trialKnown(i) ? "wait" : trials[i]?.mine.includes(tag) ? "1" : "0");

function inkDots(tag) {
  return el(
    "span",
    { class: "ink", "aria-hidden": "true" },
    trials.map((_, i) => el("i", { dataset: { on: dotState(tag, i), pick: i === picked ? "1" : "0" } }))
  );
}

/** 這張牌上墨的狀態：四張試印（還沒抽完的不算）裡進了幾張，寫在牌上和讀屏的說明裡。 */
function paintInk(node, tag) {
  const card = cardOf(tag);
  const take = takeOf(tag);
  const known = knownTrials();
  node.dataset.ink = take === known ? "full" : take === 0 ? "none" : "part";
  const why = take < known ? `，${take}/${trials.length} 張試印有它：${missReason(tag)}` : "";
  node.setAttribute("aria-label", `${card.zh}（${card.tag}）${bed.carried[tag] ? `・跟著「${zh(bed.carried[tag])}」上來` : ""}${why}。Enter 看選項，Delete 拿掉`);
}

/** 其他試印抽完：卡池裡每張牌的小點原地上墨（一個一個亮起來），牌不重畫。 */
function refreshInk() {
  for (const node of $("registers").querySelectorAll(".plate-card")) {
    const tag = node.dataset.tag;
    const dots = node.querySelectorAll(".ink i");
    dots.forEach((d, i) => {
      const on = dotState(tag, i);
      if (d.dataset.on === on) return;
      d.style.transitionDelay = reduced() ? "" : `${i * 45}ms`;
      d.dataset.on = on;
    });
    paintInk(node, tag);
  }
}

/** 試印送出去的提示詞：版上調過份量的牌寫成 (tag:1.2)，觸發詞照舊插在人物後面。付印、看 POS、複製都用這一個。 */
function trialPositive(t) {
  return insertTriggerAfterCast(weightPositive(t.positive, bed.weights), currentTriggerText());
}

/**
 * 調一張版上的牌的份量（weights.js）。只改份量，不重抽試印（份量不影響抽牌），也不進撤回的紀錄；
 * 撤回、清版會把整個版（連份量）一起退回去。
 */
function setPlateWeight(tag, w) {
  if (!bed.pins.includes(tag) || ((bed.weights || {})[tag] || 1) === w) return;
  const next = { ...(bed.weights || {}) };
  if (w === 1) delete next[tag];
  else next[tag] = w;
  const { weights: _old, ...rest } = bed;
  bed = Object.keys(next).length ? { ...rest, weights: next } : rest;
  paintWeight(plateNode(tag), w, { pop: true });
  sfx.stamp?.();
}

function plateCard(tag) {
  const card = cardOf(tag);
  const node = eagerArt(cardNode(card, assets, { src: bed.carried[tag] ? "附帶" : null }));
  node.classList.add("plate-card");
  if (inbound.has(tag)) node.style.visibility = "hidden";
  node.append(inkDots(tag));
  paintInk(node, tag);
  node.addEventListener("click", () => openPop(node, tag, "plate"));
  // 份量：右下角的數字；電腦上滑鼠停著滾滾輪、或 +／− 調（weights.js）。點開的選單裡也有一排。
  paintWeight(node, (bed.weights || {})[tag]);
  wireWeightInput(node, { get: () => (bed.weights || {})[tag] || 1, set: (w) => setPlateWeight(tag, w) });
  node.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      focusAfterRemoval(node);
      remove(tag);
    }
  });
  drag.attach(node, { tag, from: "plate" });
  return node;
}

function ghostCard(tag, t) {
  const card = cardOf(tag);
  const node = eagerArt(cardNode(card, assets, {}));
  node.classList.add("ghost-card");
  node.setAttribute("aria-label", `${card.zh}（${card.tag}）：引擎在試印 ${t.letter} 補的。Enter 看選項，可以收下`);
  node.addEventListener("click", () => openPop(node, tag, "ghost"));
  drag.attach(node, { tag, from: "ghost" });
  return node;
}

function focusAfterRemoval(node) {
  const all = [...$("registers").querySelectorAll(".plate-card")];
  const i = all.indexOf(node);
  const nextTag = (all[i + 1] || all[i - 1])?.dataset.tag;
  setTimeout(() => {
    const n = nextTag && plateNode(nextTag);
    (n || $("case-q")).focus({ preventScroll: true });
  }, 30);
}

/** 卡池裡用方向鍵走：左右是同一列的下一張，上下跳到隔壁那一列。 */
function poolKeys(e) {
  const box = $("registers");
  const cards = [...box.querySelectorAll(".card")];
  const i = cards.indexOf(document.activeElement);
  if (i < 0) return;
  let j = -1;
  if (e.key === "ArrowRight") j = i + 1;
  else if (e.key === "ArrowLeft") j = i - 1;
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const regs = [...box.querySelectorAll(".register")];
    const d = e.key === "ArrowDown" ? 1 : -1;
    for (let k = regs.indexOf(cards[i].closest(".register")) + d; k >= 0 && k < regs.length; k += d) {
      const c = regs[k].querySelector(".card");
      if (c) {
        j = cards.indexOf(c);
        break;
      }
    }
  } else return;
  e.preventDefault();
  if (j >= 0 && j < cards.length) cards[j].focus();
}

function renderPlateNotice() {
  const head = $("plate").querySelector(".plate-head");
  head.querySelector(".plate-notice")?.remove();
  if (!plateNotice) return;
  const node = el("p", { class: "plate-notice", dataset: { kind: plateNotice.kind } }, plateNotice.text);
  head.append(node);
  if (plateNotice.kind === "err" || plateNotice.kind === "clash") refuse(node);
}

function renderUndo() {
  const b = $("undo");
  const last = history.at(-1);
  b.disabled = !last;
  b.title = last ? `撤回：${last.label}（Z）` : "沒有可以撤回的";
  b.setAttribute("aria-label", last ? `撤回：${last.label}` : "撤回");
}

/* ---------- 關係：校對記號 ---------- */

let relTimer = 0;
let relFocus = null;

function requestRelations(events) {
  clearTimeout(relTimer);
  relTimer = setTimeout(() => drawRelations(events), 16);
}

const REL_ZH = { carry: "附帶", echo: "呼應", clash: "相剋" };

/**
 * 牌在卡池（box）裡「排好之後」的位置，不含動畫。
 * getBoundingClientRect 會把正在跑的 FLIP（讓位滑過去）、空白版的變形、落地那一下的縮放都算進去：
 * 重畫後 16ms 量的時候牌多半還在半路，線就接到半路上、動畫結束後整條跑掉。offsetLeft/Top 不管 transform。
 */
function layoutRect(node, box) {
  let x = 0;
  let y = 0;
  let e = node;
  while (e && e !== box) {
    x += e.offsetLeft;
    y += e.offsetTop;
    const parent = e.offsetParent;
    if (parent && parent !== box) {
      x -= parent.scrollLeft;
      y -= parent.scrollTop;
    }
    e = parent;
  }
  if (e !== box) {
    // 萬一牌不在 box 的 offsetParent 鏈上（版面結構改過）：退回舊的量法。
    const r = node.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { left: r.left - b.left, top: r.top - b.top, width: r.width, height: r.height };
  }
  return { left: x, top: y, width: node.offsetWidth, height: node.offsetHeight };
}

// 卡池大小變了但沒有重畫（托盤開合、右欄換寬、字型載入）：線要跟著重算，不然整批錯位。
let relResize = null;
function watchRelations() {
  if (relResize || typeof ResizeObserver !== "function") return;
  let last = "";
  relResize = new ResizeObserver(([entry]) => {
    const r = entry.contentRect;
    const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
    if (key === last) return;
    last = key;
    if ($("registers").querySelector(".rel-layer")) requestRelations([]);
  });
  relResize.observe($("registers"));
}

function drawRelations(events = []) {
  const box = $("registers");
  box.querySelector(".rel-layer")?.remove();
  relFocus = null;
  box.dataset.relFocus = "false";
  const rels = relationsOf(bed, { lex, contradictions, actPlace: ACT_PLACE });
  const keys = new Set(rels.map((r) => r.kind + "|" + r.a + "|" + r.b));
  const fresh = rels.filter((r) => !lastRelKeys.has(r.kind + "|" + r.a + "|" + r.b));
  lastRelKeys = keys;
  if (!rels.length) return;
  watchRelations();
  const layer = el("div", { class: "rel-layer", "aria-hidden": "true" });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(box.scrollWidth));
  svg.setAttribute("height", String(box.scrollHeight));
  layer.append(svg);
  const labels = [];
  const drawIn = [];
  // 跨列的線像校對稿上的引線：從牌的上緣出發，沿著牌上面那條空隙走到右邊的留白
  // （卡池右邊特意空了一條），沿留白下到另一列，再從那一列的空隙回到另一張牌。一張牌都不壓。
  const gutter = box.clientWidth - 26;
  const R = 6;
  rels.forEach((r, k) => {
    const na = plateNode(r.a);
    const nb = plateNode(r.b);
    if (!na || !nb) return;
    const ra = layoutRect(na, box);
    const rb = layoutRect(nb, box);
    const ax = ra.left + ra.width / 2;
    const bx = rb.left + rb.width / 2;
    const aTop = ra.top;
    const bTop = rb.top;
    let d;
    let mid;
    if (Math.abs(aTop - bTop) < 12) {
      // 同一列、同一排的兩張：在牌的上緣拱一道小弧。
      const y = aTop + 2;
      const cx = (ax + bx) / 2;
      d = `M${ax},${y} Q${cx},${y - 16} ${bx},${y}`;
      mid = { x: cx, y: y - 8 };
    } else {
      // 幾條線同時走時錯開一點，不要疊成一條。
      const off = (k % 3) * 3;
      const ay = aTop - 6 - off;
      const by = bTop - 6 - off;
      const gx = Math.max(gutter - (k % 4) * 5, ax + 2 * R, bx + 2 * R);
      const dir = by > ay ? 1 : -1;
      d =
        `M${ax},${aTop} L${ax},${ay + R} Q${ax},${ay} ${ax + R},${ay} L${gx - R},${ay} Q${gx},${ay} ${gx},${ay + dir * R} ` +
        `L${gx},${by - dir * R} Q${gx},${by} ${gx - R},${by} L${bx + R},${by} Q${bx},${by} ${bx},${by + R} L${bx},${bTop}`;
      mid = { x: gx, y: (ay + by) / 2 };
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "rel rel-" + r.kind);
    path.dataset.a = r.a;
    path.dataset.b = r.b;
    const isFresh = fresh.includes(r);
    if (isFresh && !reduced()) drawIn.push(path);
    svg.append(path);
    labels.push(el("span", { class: "rel-tag", dataset: { kind: r.kind, a: r.a, b: r.b }, style: `left:${mid.x}px;top:${mid.y}px` }, REL_ZH[r.kind]));
    if (isFresh && r.kind === "clash") {
      for (const n of [na, nb]) {
        n.classList.remove("is-clashing");
        void n.offsetWidth;
        n.classList.add("is-clashing");
      }
      if (events.length) setTimeout(() => sfx.clash(), 120);
      plateNotice = { kind: "clash", text: `相剋：「${zh(r.a)}」跟「${zh(r.b)}」同時成立不了，引擎會擠掉其中一個` };
      renderPlateNotice();
    }
    if (isFresh && r.kind === "echo" && events.length) {
      plateNotice = { kind: "echo", text: `呼應：「${zh(r.a)}」配「${zh(r.b)}」，這個地方做這件事剛好` };
      renderPlateNotice();
    }
  });
  layer.append(...labels);
  box.append(layer);
  // 新出現的線一筆畫出來；畫完把虛線樣式還給 CSS（附帶、相剋本來就是虛線）。
  for (const path of drawIn) {
    const len = Math.ceil(path.getTotalLength());
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: DUR.xl, easing: css(CURVE.out), fill: "forwards" });
    setTimeout(() => {
      path.getAnimations().forEach((a) => a.cancel());
      path.style.strokeDasharray = "";
      path.style.strokeDashoffset = "";
    }, 640);
  }
}

/** 指著（或 Tab 到）一張牌：它的關係線亮起來，其他的淡下去，另一端那張也描一圈。 */
function setRelFocus(tag) {
  if (tag === relFocus) return;
  relFocus = tag;
  const box = $("registers");
  const partners = new Set();
  for (const n of box.querySelectorAll(".rel-layer [data-a]")) {
    const on = !!tag && (n.dataset.a === tag || n.dataset.b === tag);
    n.classList.toggle("is-lit", on);
    if (on) partners.add(n.dataset.a === tag ? n.dataset.b : n.dataset.a);
  }
  box.dataset.relFocus = partners.size ? "true" : "false";
  for (const c of box.querySelectorAll(".plate-card")) c.classList.toggle("is-partner", partners.has(c.dataset.tag));
}

/* ---------- 牌的小選單 ---------- */

let pop = null;

function closePop({ focus = false } = {}) {
  if (!pop) return;
  const back = pop._anchorTag;
  const from = pop._from;
  const gone = pop;
  pop = null;
  gone._anchorNode?.classList.remove("is-popped");
  // 收回去：往那張牌的方向縮一下、淡掉（以前是一下子消失）。
  if (reduced()) gone.remove();
  else {
    gone.style.pointerEvents = "none";
    gone.classList.add("is-closing");
    setTimeout(() => gone.remove(), 130);
  }
  document.removeEventListener("pointerdown", onPopOutside, true);
  if (focus && back) (from === "plate" ? plateNode(back) : null)?.focus({ preventScroll: true });
}

function onPopOutside(e) {
  if (pop && !pop.contains(e.target)) closePop();
}

function openPop(anchor, tag, from) {
  finishTrials();
  closePop();
  hidePeek();
  const card = cardOf(tag);
  const t = trials[picked];
  const lines = [];
  if (from === "plate") {
    const take = takeOf(tag);
    lines.push(
      take === trials.length
        ? ["上墨", `四張試印都有它`]
        : take === 0
          ? ["沒上墨", missReason(tag)]
          : ["上墨", `${take}/${trials.length} 張試印有它；其他張${missReason(tag)}`]
    );
    if (bed.carried[tag]) lines.push(["附帶", `跟著「${zh(bed.carried[tag])}」上來的`]);
    for (const r of relationsOf(bed, { lex, contradictions, actPlace: ACT_PLACE })) {
      if (r.a !== tag && r.b !== tag) continue;
      const other = r.a === tag ? r.b : r.a;
      if (r.kind === "carry" && r.a === tag) lines.push(["附帶", `帶上了「${zh(other)}」`]);
      if (r.kind === "echo") lines.push(["呼應", `跟「${zh(other)}」`]);
      if (r.kind === "clash") lines.push(["相剋", `跟「${zh(other)}」同時成立不了`]);
    }
  } else {
    lines.push(["引擎", `試印 ${t.letter} 補的。收下就固定在版上，每張都會有`]);
  }
  const acts = [];
  if (from === "plate") {
    acts.push(
      el(
        "button",
        {
          class: "btn btn-small",
          type: "button",
          onclick: () => {
            // 焦點在選單的按鈕上，選單一收就沒了：跟牌上按 Delete 一樣，交給隔壁那張（或找牌框）。
            const node = plateNode(tag);
            closePop();
            if (node) focusAfterRemoval(node);
            remove(tag);
          },
        },
        "拿下來"
      )
    );
  } else {
    acts.push(
      el(
        "button",
        {
          class: "btn btn-small btn-primary",
          type: "button",
          onclick: () => {
            closePop();
            place(tag, anchor);
            // 收下之後焦點落在版上那張（它現在是卡池的牌了），不要掉回頁面最上面。
            setTimeout(() => plateNode(tag)?.focus({ preventScroll: true }), 30);
          },
        },
        "收下這張"
      )
    );
  }
  pop = el(
    "div",
    { class: "pop", role: "dialog", "aria-label": card.zh },
    el("p", { class: "pop-title" }, el("b", {}, card.zh), el("code", {}, card.tag)),
    // 版上的牌：份量一排（手機調份量的地方）。
    from === "plate" ? weightRow((bed.weights || {})[tag] || 1, (w) => setPlateWeight(tag, w), el) : null,
    el("dl", { class: "pop-lines" }, lines.map(([k, v]) => [el("dt", {}, k), el("dd", {}, v)])),
    // 主要的動作（拿下來／收下這張）排第一、拿到焦點：Enter 按下去是它，不是加進偏好卡牌。
    el("div", { class: "pop-acts" }, [...acts, handAct(tag, anchor)])
  );
  pop._anchorTag = tag;
  pop._scrollY = window.scrollY;
  pop._from = from;
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closePop({ focus: true });
    }
  });
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  // 卡池在中間：選單開在牌的右邊，右邊放不下才開左邊。
  // 兩邊都放不下（手機）：開在牌的下面（下面也放不下就上面），不要蓋住那張牌本身。
  const fitsRight = r.right + 10 + w <= window.innerWidth - 8;
  const fitsLeft = r.left - w - 10 >= 8;
  if (fitsRight || fitsLeft) {
    const left = fitsRight ? r.right + 10 : r.left - w - 10;
    const top = Math.max(8, Math.min(window.innerHeight - h - 8, r.top + r.height / 2 - h / 2));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    // 選單從它那張牌的方向長出來，邊上一個小尖角指著那張牌；開著的時候那張牌也亮著。
    pop.dataset.side = fitsRight ? "right" : "left";
    pop.style.setProperty("--tail-y", Math.max(16, Math.min(h - 16, r.top + r.height / 2 - top)) + "px");
  } else {
    const below = r.bottom + 10 + h <= window.innerHeight - 8 || r.top - h - 10 < 8;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = below ? Math.min(window.innerHeight - h - 8, r.bottom + 10) : r.top - h - 10;
    pop.style.left = left + "px";
    pop.style.top = Math.max(8, top) + "px";
    pop.dataset.side = below ? "below" : "above";
    pop.style.setProperty("--tail-x", Math.max(16, Math.min(w - 16, r.left + r.width / 2 - left)) + "px");
  }
  anchor.classList.add("is-popped");
  pop._anchorNode = anchor;
  setTimeout(() => document.addEventListener("pointerdown", onPopOutside, true), 0);
  pop.querySelector(".pop-acts button")?.focus({ preventScroll: true });
}

/* ---------- 動態：飛進版、掀起、壓印 ---------- */

function snapshot(node) {
  return { node, rect: node.getBoundingClientRect() };
}

/**
 * 牌飛上版。from：出發的位置。delay：晚一點才起飛（影子先停在出發點）；src：影子要複製的那張
 * （從托盤出發時是托盤那張，沒有版上的墨點）；startRotate：出發時的角度（托盤那把扇形的斜）。
 */
function flyIn(tag, from, { delay = 0, src = null, startRotate = 0, startScale = 1 } = {}) {
  const target = plateNode(tag);
  if (!target) {
    inbound.delete(tag);
    return;
  }
  const to = target.getBoundingClientRect();
  const visible = to.bottom > 0 && to.top < window.innerHeight && to.width > 0;
  if (!from || reduced() || !visible) {
    // 手機上卡池捲出畫面了：牌飛進角落那顆「卡池」，看得到它確實放進去了。
    const pill = $("pool-pill");
    if (delay && !reduced() && !(from && !visible && !pill.hidden)) {
      // 沒有出發點（字盒裡看不到它）：輪到它的時候才原地落下，不要一開始就亮在版上。
      const tok = claimInbound(tag);
      target.style.visibility = "hidden";
      setTimeout(() => {
        if (!releaseInbound(tag, tok)) return;
        const n = plateNode(tag);
        if (!n) return;
        n.style.visibility = "";
        stamp(n);
      }, delay);
      return;
    }
    inbound.delete(tag);
    target.style.visibility = "";
    if (from && !visible && !pill.hidden && !reduced()) flyToPill(target, from, pill);
    else stamp(target);
    return;
  }
  // 飛的是一張影子，版上那張先藏著，影子落地才亮出來。飛的路上版可能整塊重畫（卡池大小變了、
  // 影子張數重排）：重畫出來的新那張也要藏著（plateCard 看 inbound），影子追的也是新那張的位置。
  const ghost = (src || target).cloneNode(true);
  ghost.classList.add("flying");
  ghost.classList.remove("is-related", "is-stamped", "is-popped", "fav-card");
  ghost.style.visibility = "";
  const tok = claimInbound(tag);
  target.style.visibility = "hidden";
  flight(ghost, from, () => plateNode(tag), {
    delay,
    startRotate,
    startScale,
    onLand: () => {
      // 同一張牌在飛的路上被拿下、又放上一次：舊影子落地時不能把新那次還藏著的牌亮出來。
      if (!releaseInbound(tag, tok)) return;
      const n = plateNode(tag);
      if (n) {
        n.style.visibility = "";
        stamp(n);
        inkRing(n);
      }
    },
  });
}

// 正在飛上版的牌（影子還沒落地）：這段時間重畫出來的版上那張先藏著。
// 值是這一趟的號碼：只有最後一趟落地才揭牌，較早那趟的回呼晚到也不會提早亮。
const inbound = new Map();
let inboundSeq = 0;
function claimInbound(tag) {
  const tok = ++inboundSeq;
  inbound.set(tag, tok);
  return tok;
}
function releaseInbound(tag, tok) {
  if (inbound.get(tag) !== tok) return false;
  inbound.delete(tag);
  return true;
}

function flyToPill(target, from, pill) {
  const ghost = target.cloneNode(true);
  ghost.classList.add("flying");
  // 落點是那顆標籤的中心，牌縮成原本的兩成被吸進去。
  const into = () => {
    const r = pill.getBoundingClientRect();
    const w = from.width * 0.22;
    return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - (w * 1.4625) / 2, width: w };
  };
  flight(ghost, from, into, { endOpacity: 0.3, onLand: () => stamp(pill, "is-bumped") });
}

function popIn(tag, delay) {
  setTimeout(() => {
    const n = plateNode(tag);
    if (n) stamp(n, "is-carried");
  }, delay);
}

function stamp(node, cls = "is-stamped") {
  if (reduced()) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), 560);
}

/**
 * 牌從版上回到字盒：飛到字盒裡那張牌的位置、縮進去，字盒裡那張輕輕一跳收下。
 * 字盒裡看不到它（被篩掉、捲走了）就飛向字盒那一欄；字盒整個不在畫面上（手機）才原地掀開。
 * 以前一律原地往上飄走 —— 上面幾排的牌看起來像飛出畫面，也看不出牌去了哪裡。
 */
function flyHome(snap, delay = 0) {
  const tag = snap.node.dataset.tag;
  // 偏好卡牌：回到手上（托盤開著回那一格，收著收進標籤），由托盤自己演。
  if (tag && hand?.has(tag)) return void hand.receive([snap], { delay });
  if (reduced() || !snap.rect.width) return;
  // 偏好卡牌裡的牌從版上拿下來：回到底下的扇形，不回字盒。
  const home = tag && ((hand?.has(tag) && hand.nodeOf(tag)) || caseCard(tag));
  const inView = (r) => r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  let to = home && home.getBoundingClientRect();
  if (!inView(to)) {
    const grid = $("case-grid").getBoundingClientRect();
    to = inView(grid) ? { left: grid.left + grid.width / 2 - 20, top: Math.max(grid.top, 0) + 20, width: 40, height: 56 } : null;
  }
  if (!to) return liftAway(snap, "aside");
  const ghost = snap.node.cloneNode(true);
  ghost.classList.add("flying");
  ghost.classList.remove("is-related", "is-stamped", "is-popped");
  // 追著落點飛（字盒捲動、托盤變寬都跟得上）；落地那一刻托盤那張才亮、字盒那張壓一下。
  const homeNow = () => (tag && ((hand?.has(tag) && hand.nodeOf(tag)) || caseCard(tag))) || null;
  const goingHome = home && inView(to) && to.width === home.getBoundingClientRect().width;
  flight(ghost, snap.rect, goingHome ? () => (inView(homeNow()?.getBoundingClientRect()) ? homeNow() : to) : to, {
    delay,
    tilt: 5,
    endOpacity: goingHome ? 1 : 0,
    onLand: () => {
      if (tag && hand?.has(tag)) hand.reveal(tag);
      const n = goingHome && homeNow();
      if (n && n.isConnected) stamp(n, "is-returned");
    },
  });
}

/** 一疊牌收回字盒：疊在卡池中間，整疊飛到字盒那一欄（看不到字盒就原地淡掉）。 */
function sweepHome(snaps, tags, { start = 0 } = {}) {
  if (reduced() || !snaps.length) return 0;
  // 疊在這些牌的中心（不是整個卡池的中心）：牌各自往中間收一點點就疊好，不會橫越整個版、
  // 也不會疊在清版後才出現的「空白的版」上面。
  const cs = snaps.filter((s) => s.rect.width).map((s) => ({ x: s.rect.left + s.rect.width / 2, y: s.rect.top + s.rect.height / 2 }));
  const pile = {
    x: Math.max(80, Math.min(innerWidth - 80, cs.reduce((a, c) => a + c.x, 0) / (cs.length || 1))),
    y: Math.max(90, Math.min(innerHeight - 90, cs.reduce((a, c) => a + c.y, 0) / (cs.length || 1))),
  };
  const grid = $("case-grid").getBoundingClientRect();
  const home = grid.width && grid.bottom > 0 && grid.top < innerHeight ? { x: grid.left + grid.width / 2, y: Math.max(grid.top, 0) + 60 } : null;
  const ms = gatherHome(snaps, pile, home, { cls: "flying", start });
  if (!home) return ms;
  const seen = tags.map((t) => caseCard(t)).filter((n) => {
    const r = n && n.getBoundingClientRect();
    return r && r.width && r.bottom > 0 && r.top < innerHeight;
  });
  seen.forEach((n, i) => setTimeout(() => stamp(n, "is-returned"), ms - 60 + i * 40));
  return ms;
}

function liftAway(snap, dir) {
  if (reduced() || !snap.rect.width) return;
  const clone = snap.node.cloneNode(true);
  clone.classList.add("flying");
  Object.assign(clone.style, { left: snap.rect.left + "px", top: snap.rect.top + "px", width: snap.rect.width + "px" });
  clone.style.setProperty("--card-w", snap.rect.width + "px");
  document.body.append(clone);
  const to = dir === "aside" ? "translate(-34px, 18px) rotate(-9deg)" : "translate(0, -22px) rotate(4deg)";
  clone.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: to, opacity: 0 },
    ],
    { duration: DUR.medium, easing: css(CURVE.in), fill: "forwards" }
  );
  setTimeout(() => clone.remove(), DUR.medium + 20);
}

/* ================= 付印那一條 ================= */

let seedNode = null;

/* ================= 原檔不在了（gone.js） ================= */
// 專案主會手動刪 ComfyUI 輸出資料夾裡的圖。刪掉的那張當成「沒有圖」：繩上寫「原檔已刪」、
// 預覽說明原因、付印鈕變成「再印一次」。ComfyUI 暫時連不上不算（gone.js 只認 404／410）。

/** 這張要顯示的圖：原檔不在了就沒有。 */
function printSrc(p) {
  return p && !p._gone ? viewSrc(p.image) || p.preview : null;
}

function goneAt(src) {
  for (const p of prints) if (p.status === "done" && !p._gone && viewSrc(p.image) === src) markPrintGone(p);
}

function markPrintGone(p) {
  p._gone = true;
  if (lineThumbs[p.id]) {
    delete lineThumbs[p.id];
    writeJ(THUMB_KEY, lineThumbs);
  }
  paintLineItem(p);
  renderPreview();
  renderPrintBar();
  trials.forEach((t, i) => {
    if (printFor(sigOf(t)) === p) paintTrialFace(i);
  });
  noteGone();
}

// 一次刪了好幾張：攢半秒說一次總數，給「全部撤下」。
let goneToast = 0;
function noteGone() {
  clearTimeout(goneToast);
  goneToast = setTimeout(() => {
    const n = prints.filter((p) => p._gone).length;
    if (!n) return;
    toast(`晾紙繩上有 ${n} 張的原檔被刪了`, {
      action: {
        label: "全部撤下",
        run: () => {
          prints = prints.filter((p) => !p._gone);
          savePrints();
          renderLine();
          renderAll([]);
        },
      },
    });
  }, 500);
}

/** 開頁面時把繩上印好的每一張問一遍：繩上用的是存在本機的小縮圖，原檔刪了也看不出來。 */
function sweepPrints() {
  sweepGone(prints.filter((p) => p.status === "done" && p.image).map((p) => viewSrc(p.image)), goneAt);
}

/** 付印鈕的那個動作（付印／再印一次／Hires）。btn 是 Hires 選單要貼著彈出的那顆。 */
function printAction(btn) {
  const t = trials[picked];
  if (!t) return;
  const p = printFor(sigOf(t));
  if (p && p._gone) return reprint(p);
  if (p && p.status === "done") return openHires(p, btn);
  if (p && p.status === "failed") return reprint(p);
  return printNow();
}

// 手機：付印那一排捲出畫面時（人在下面的字盒挑牌），右下角留一顆一樣的付印鈕，
// 跟左下的「卡池」一左一右。字、能不能按、印製進度都照抄付印那一顆。
let printBarSeen = true;
const narrowFuse = matchMedia("(max-width: 68.74rem)");

function syncPrintFloat() {
  const float = $("print-float");
  if (!float) return;
  const go = $("print-bar").querySelector(".pb-go");
  const t = trials[picked];
  const show = narrowFuse.matches && !printBarSeen && !!go && !!t;
  float.hidden = !show;
  if (!show) return;
  float.querySelector(".pf-letter").textContent = t.letter;
  const label = float.querySelector(".pf-label");
  if (label.textContent !== go.textContent) label.textContent = go.textContent;
  float.disabled = go.disabled;
  float.dataset.busy = go.dataset.busy || "false";
  float.dataset.wide = go.dataset.wide || "false";
  const pct = go.style.getPropertyValue("--p");
  if (pct) float.style.setProperty("--p", pct);
  else float.style.removeProperty("--p");
  float.title = go.title;
  float.setAttribute("aria-label", `試印 ${t.letter}：${go.textContent}`);
}

function watchPrintBar() {
  const float = $("print-float");
  if (!float || typeof IntersectionObserver !== "function") return;
  new IntersectionObserver((entries) => {
    printBarSeen = entries.some((e) => e.isIntersecting);
    syncPrintFloat();
  }, { threshold: 0.5 }).observe($("print-bar"));
  narrowFuse.addEventListener("change", syncPrintFloat);
  float.addEventListener("click", (e) => printAction(e.currentTarget));
}

function renderPrintBar() {
  const bar = $("print-bar");
  const t = trials[picked];
  if (!t) {
    delete bar.dataset.key;
    bar.replaceChildren();
    return syncPrintFloat();
  }
  const p = printFor(sigOf(t));
  const busy = p && (p.status === "queued" || p.status === "running");
  const offline = comfyOk === false;
  let label = "付印";
  let disabled = false;
  if (busy) {
    label = p.status === "queued" ? "排隊等印…" : `印製中 ${Math.round((p.progress || 0) * 100)}%`;
    disabled = true;
  } else if (p && p._gone) label = "再印一次";
  else if (p && p.status === "done") {
    // 印好了：這顆鈕換成下一步 —— Hires。做的時候鈕上走進度，跟付印一樣。
    label = hiresBusy(p) ? (p.hi.status === "running" ? `Hires ${Math.round((p.hi.progress || 0) * 100)}%` : "Hires 排隊中…") : "Hires";
    disabled = hiresBusy(p);
  } else if (p && p.status === "failed") label = "再印一次";
  const summary = [
    `你的 ${bed.pins.length} 張`,
    `引擎補 ${t.extra.length} 張`,
  ];
  const detail = [
    ERA_ZH[t.era] || "",
    RATING_ZH[settings.rating],
    (SIZES.find((s) => s.w === settings.width && s.h === settings.height) || SIZES[0]).zh,
  ].filter(Boolean);
  // 印製中每一格進度都會叫到這裡。只有進度變了的話，只改付印鈕的字跟進度條，
  // 不整排重畫 —— 以前「停」一秒換好幾次新的，滑鼠停在上面會閃、按下去常常按不到。
  const wasOffline = bar.dataset.offline === "1";
  bar.dataset.offline = offline ? "1" : "0";
  const hiBusy = !!p && p.status === "done" && hiresBusy(p);
  const key = [t.letter, sigOf(t), p ? p.status : "", p?._gone ? "gone" : "", p?.hi?.status || "", p?.hires?.scale || "", summary.join("・"), detail.join("・"), t.missing.join(","), offline, linkNow, p && p.status === "failed" ? p.note : "", !!bed.pins.length].join("|");
  const go = bar.querySelector(".pb-go");
  // 放一張牌、換一張試印時，常常只有「試印 A／你的 N 張・引擎補 N 張／時代・分級・尺寸」幾個字變了：
  // 只改字，不把整排（連同收著的種子設定）拆掉重建 —— 手機上每放一張牌都在重建它。
  const shape = key.replace(summary.join("・"), "").replace(detail.join("・"), "").replace(t.letter + "|" + sigOf(t) + "|", "");
  if (bar.dataset.shape === shape && bar.dataset.key !== key && go && !busy && !hiBusy) {
    bar.dataset.key = key;
    const setText = (sel, text) => {
      const n = bar.querySelector(sel);
      if (n && n.textContent !== translate(text)) n.textContent = text;
    };
    setText(".pb-letter", t.letter);
    setText(".pb-title", `試印 ${t.letter}`);
    setText(".pb-sum", summary.join("・"));
    setText(".pb-detail", detail.join("・"));
    if (go.textContent !== translate(label)) go.textContent = label;
    return syncPrintFloat();
  }
  if (bar.dataset.key === key && go) {
    if (go.textContent !== translate(label)) go.textContent = label;
    if (busy) go.style.setProperty("--p", String(p.status === "running" ? p.progress || 0 : 0));
    if (hiBusy) go.style.setProperty("--p", String(p.hi.status === "running" ? p.hi.progress || 0 : 0));
    return syncPrintFloat();
  }
  const moreOpen = bar.querySelector(".pb-more")?.open;
  bar.dataset.key = key;
  bar.dataset.shape = shape;
  put(
    bar,
    el(
      "div",
      { class: "pb-top" },
      el("span", { class: "pb-letter", "aria-hidden": "true" }, t.letter),
      el(
        "div",
        { class: "pb-text" },
        el("p", { class: "pb-title" }, `試印 ${t.letter}`),
        el("p", { class: "pb-sum" }, summary.join("・")),
        el("p", { class: "pb-detail" }, detail.join("・"))
      )
    ),
    t.missing.length ? el("p", { class: "pb-warn" }, `這張沒收到：${t.missing.map(zh).join("、")}`) : null,
    el(
      "div",
      { class: "pb-acts" },
      el(
        "button",
        {
          class: "btn btn-primary pb-go",
          type: "button",
          disabled: disabled || undefined,
          dataset: { wide: [...label].length <= 2 ? "true" : "false", busy: busy || hiBusy ? "true" : "false" },
          style: busy ? `--p: ${p.status === "running" ? p.progress || 0 : 0}` : hiBusy ? `--p: ${p.hi.status === "running" ? p.hi.progress || 0 : 0}` : undefined,
          "aria-haspopup": p && p.status === "done" && !p._gone ? "dialog" : undefined,
          onclick: (e) => printAction(e.currentTarget),
          title: p && p.status === "done" && !p._gone ? "放大並重畫細節（快速／深度）" : "付印（P）",
        },
        label
      ),
      busy ? el("button", { class: "btn", type: "button", onclick: stopPrinting }, "停") : null,
      hiBusy ? el("button", { class: "btn", type: "button", onclick: () => hiresRun.cancel(p) }, "停") : null
    ),
    offline
      ? el("p", { class: "pb-hint", dataset: { fresh: wasOffline ? "0" : "1" } }, linkNow === "net" ? "連不到主機（網路斷了？）。可以繼續疊版、挑試印，接上了再付印。" : "印刷機（ComfyUI）沒開。可以繼續疊版、挑試印，開了再付印。")
      : null,
    p && p.status === "failed" ? el("p", { class: "pb-hint", dataset: { kind: "err" } }, p.note || "印壞了") : null,
    el(
      "details",
      { class: "pb-more" },
      el("summary", {}, "更多設定與操作"),
      seedNode || (seedNode = mountSeedControl(null, { compact: true })),
      el(
        "p",
        { class: "pb-links" },
        el("button", { class: "link-btn pressable", type: "button", onclick: showPos }, "看 POS"),
        el("button", { class: "link-btn pressable", type: "button", onclick: sendToPool, disabled: !bed.pins.length || undefined }, "把這一版放進墨池的合成池")
      )
    )
  );
  if (moreOpen) bar.querySelector(".pb-more").open = true;
  const hint = bar.querySelector('.pb-hint[data-fresh="1"]');
  if (hint) enter(hint);
  syncPrintFloat();
}

function showPos() {
  const t = trials[picked];
  if (!t) return;
  openSheet(
    `試印 ${t.letter} 的 POS`,
    el(
      "div",
      {},
      el("p", { class: "tag-en" }, `seed ${t.seed}・${ERA_ZH[t.era] || ""}・${settings.width}×${settings.height}`),
      el("pre", { class: "pos-text" }, trialPositive(t))
    ),
    {
      wide: true,
      foot: [
        el(
          "button",
          {
            class: "btn btn-small",
            type: "button",
            onclick: async (e) => {
              try {
                await navigator.clipboard.writeText(trialPositive(t));
                e.target.textContent = "複製好了";
              } catch {
                e.target.textContent = "複製不了，請手動選取";
              }
            },
          },
          "複製 POS"
        ),
      ],
    }
  );
}

function sendToPool() {
  if (!bed.pins.length) return;
  S.handOffPool(bed.pins, "fuse", bed.weights || {});
  const b = $("print-bar").querySelector(".pb-links button:last-child");
  if (b) b.textContent = "放好了：回墨池工作臺就看得到";
  announce("這一版的牌放進墨池的合成池了");
}

/* ================= 晾紙繩 ================= */

let lineSeen = null;

function syncLineEmpty() {
  $("line").dataset.empty = prints.length ? "false" : "true";
  $("line-count").textContent = `・${prints.length}`;
  $("line-empty").hidden = prints.length > 0;
}

function renderLine() {
  const list = $("line-list");
  const items = prints.map((p) => el("li", {}, lineItem(p)));
  list.replaceChildren(...items);
  // 新夾上去的那張：往下一落、左右晃幾下才停，像紙剛夾上繩子。開機那一次不晃。
  if (lineSeen && !reduced()) {
    items.forEach((li, i) => {
      if (!lineSeen.has(prints[i].id)) li.firstChild.classList.add("is-hung");
    });
  }
  lineSeen = new Set(prints.map((p) => p.id));
  syncLineEmpty();
  // 等這一輪的畫面都放好再量（量捲動寬度會逼瀏覽器當場排版；開機時字盒還在長）。
  clearTimeout(lineFadeTimer);
  lineFadeTimer = setTimeout(syncLineFade, 0);
}

let lineFadeTimer = 0;

/** 捲軸平常是隱形的：哪一邊還捲得過去，繩子那一頭就淡出，看得出後面還有作品。 */
function syncLineFade() {
  const list = $("line-list");
  const max = list.scrollWidth - list.clientWidth;
  const more = [];
  if (list.scrollLeft > 2) more.push("left");
  if (list.scrollLeft < max - 2) more.push("right");
  list.dataset.more = more.join(" ");
}

function lineItem(p) {
  const face = el("span", { class: "print-face", style: `aspect-ratio: ${p.width} / ${p.height}` });
  const node = el(
    "button",
    { class: "print pressable", type: "button", dataset: { id: p.id, status: p.status }, onclick: () => openPrint(p) },
    el("span", { class: "print-pin", "aria-hidden": "true" }),
    face,
    el("span", { class: "print-ring", "aria-hidden": "true" })
  );
  paintLineNode(node, p);
  return node;
}

const STATUS_ZH = { drawn: "排隊", queued: "排隊", running: "印製中", done: "印好了", failed: "印壞了", cancelled: "取消了", stopped: "停了" };

// 晾紙繩的小縮圖存在本機。繩上一張只有指甲大，拿的卻是整張成品的 webp（約 100KB）；
// 切頁面回來時要是快取不在（舊作品網址沒帶指紋、快取被清、遠端連線），十幾張就排在
// 字盒幾十張插圖後面慢慢下載 —— 專案主看到的「有些晾紙要等」。
// 第一次載好原圖就用 canvas 縮成 144px 高的 webp（幾 KB）存起來，之後繩子直接用它，
// 不發請求。記著是從哪個網址縮的：Hires 換了圖，網址變了，就重縮一次。
// 滑過浮出的大圖、點開的大圖照舊讀原圖。
const THUMB_KEY = "mochi.fuse.thumbs.v1";
const THUMB_H = 144;
let lineThumbs = readJ(THUMB_KEY, {});
if (!lineThumbs || typeof lineThumbs !== "object" || Array.isArray(lineThumbs)) lineThumbs = {};

function lineThumbOf(p, src) {
  const t = lineThumbs[p.id];
  return p.status === "done" && t && t.s === src && typeof t.d === "string" ? t.d : null;
}

function keepLineThumb(p, src, img) {
  if (p.status !== "done" || !img.naturalWidth || !img.naturalHeight || img.getAttribute("src") !== src) return;
  try {
    const h = Math.min(THUMB_H, img.naturalHeight);
    const w = Math.max(1, Math.round((img.naturalWidth * h) / img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const d = c.toDataURL("image/webp", 0.82);
    if (!d.startsWith("data:image/webp")) return;
    lineThumbs[p.id] = { s: src, d };
    // 只留繩上還在的。
    const live = new Set(prints.map((x) => x.id));
    for (const id of Object.keys(lineThumbs)) if (!live.has(id)) delete lineThumbs[id];
    writeJ(THUMB_KEY, lineThumbs);
  } catch {
    /* 縮不了（圖壞了、畫布被擋）就算了：下次照樣讀原圖 */
  }
}

function paintLineNode(node, p) {
  // 剛印好：紙抖一下（每張只抖一次）。
  if (p.status === "done" && node.dataset.status && node.dataset.status !== "done" && !reduced()) {
    node.classList.remove("is-hung", "is-dried");
    void node.offsetWidth;
    node.classList.add("is-dried");
  }
  node.dataset.status = p.status;
  const face = node.querySelector(".print-face");
  const src = printSrc(p);
  node.dataset.gone = p._gone ? "true" : "false";
  const img = face.querySelector("img");
  if (src) {
    const thumb = lineThumbOf(p, src);
    const use = thumb || src;
    let target = img;
    if (!img) {
      // loading 要排在 src 前面：先設 src 的話圖已經開始下載，lazy 就沒用了。
      // 繩子捲不到的作品等捲過去才下載。存好的小縮圖是本機的，不必 lazy。
      // 還沒有縮圖的那幾張在頁面最上面：優先序拉高，不要排在字盒幾十張插圖後面。
      target = el("img", thumb ? { src: use, alt: "", decoding: "async", draggable: "false" } : { loading: "lazy", fetchpriority: "high", src: use, alt: "", decoding: "async", draggable: "false" });
      face.replaceChildren(target);
      watchGone(target, goneAt);
    } else if (img.getAttribute("src") !== use) img.src = use;
    else target = null;
    if (target && !thumb && p.status === "done") target.addEventListener("load", () => keepLineThumb(p, src, target), { once: true });
  } else face.replaceChildren(el("span", { class: "print-state" }, p._gone ? "原檔已刪" : STATUS_ZH[p.status] || ""));
  node.style.setProperty("--p", String(p.status === "running" ? p.progress || 0 : p.status === "done" ? 1 : 0));
  node.setAttribute("aria-label", `試印 ${p.letter || ""}・${STATUS_ZH[p.status] || ""}・你的 ${p.mine?.length || 0} 張牌。點開看，或回到這一版`);
}

function paintLineItem(p) {
  const node = $("line-list").querySelector(`.print[data-id="${cssEsc(p.id)}"]`);
  if (node) paintLineNode(node, p);
  else renderLine();
}

/* 晾紙繩上的作品只有指甲大：滑鼠停在上面，底下浮出一張大一點的（點下去照舊打開大圖）。 */
let linePeek = null;
let linePeekTimer = 0;

function showLinePeek(node) {
  const p = prints.find((x) => x.id === node.dataset.id);
  const src = printSrc(p);
  if (!src || !node.isConnected) return hideLinePeek();
  if (!linePeek) {
    linePeek = el("div", { class: "print-peek", "aria-hidden": "true", hidden: true }, el("img", { alt: "", decoding: "async" }), el("p", { class: "print-peek-cap" }));
    document.body.append(linePeek);
    watchGone(linePeek.querySelector("img"), (src) => {
      hideLinePeek();
      goneAt(src);
    });
  }
  const img = linePeek.querySelector("img");
  if (img.getAttribute("src") !== src) img.src = src;
  img.style.aspectRatio = `${p.width} / ${p.height}`;
  linePeek.querySelector(".print-peek-cap").textContent = [`試印 ${p.letter || ""}`, STATUS_ZH[p.status] || "", `seed ${p.seed}`].filter(Boolean).join("・");
  const wasHidden = linePeek.hidden;
  linePeek.hidden = false;
  const r = node.getBoundingClientRect();
  const w = linePeek.offsetWidth;
  const h = linePeek.offsetHeight;
  linePeek.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  linePeek.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom + 10)) + "px";
  if (wasHidden && !reduced()) {
    linePeek.classList.remove("is-in");
    void linePeek.offsetWidth;
    linePeek.classList.add("is-in");
  }
}

function hideLinePeek() {
  clearTimeout(linePeekTimer);
  if (linePeek) linePeek.hidden = true;
}

function openPrint(p) {
  hideLinePeek();
  sfx.open();
  const src = printSrc(p);
  const mine = (p.mine && p.mine.length ? p.mine : p.bed?.pins || []).filter((t) => lib.byTag.has(t));
  let sheet = null;
  const foot = [
    el(
      "button",
      {
        class: "btn btn-small btn-primary",
        type: "button",
        onclick: () => {
          sheet.close();
          restorePrint(p);
        },
      },
      "回到這一版"
    ),
    p.status === "failed" || p.status === "stopped" || p.status === "cancelled"
      ? el("button", { class: "btn btn-small", type: "button", onclick: () => (sheet.close(), reprint(p)) }, "再印一次")
      : null,
    p._gone ? null : favButton(p, { zh, persist: savePrints, className: "btn btn-small" }),
    p.image && !p._gone ? el("a", { class: "btn btn-small", href: p.image, target: "_blank", rel: "noopener" }, "開原圖") : null,
    el(
      "button",
      {
        class: "btn btn-small",
        type: "button",
        onclick: (e) => {
          if (p.status === "queued" || p.status === "running" || hiresBusy(p)) return refuse(e.currentTarget);
          const at = prints.indexOf(p);
          prints = prints.filter((x) => x !== p);
          savePrints();
          sheet.close();
          // 印好的那張單獨撤下：出圖日誌記一筆「不要」（牌的戰績用）。
          if (p.status === "done") markGenLog(p.job, "discard");
          // 從繩上掉下來、旁邊的滑過來補位，再給五秒反悔（以前按了就沒了，印好的圖也跟著沒了）。
          const node = $("line-list").querySelector(`.print[data-id="${p.id}"]`);
          const li = node?.closest("li");
          leave(node, () => {
            // 只拿掉那一張，不整條重畫 —— 重畫會把正在滑的那幾張換成新的節點，讓位就看不到了。
            flip($("line-list"), () => li?.remove());
            syncLineEmpty();
            setTimeout(syncLineFade, 0);
            renderAll([]);
          });
          announce("撤下了這一張");
          toast("從繩上撤下了一張", {
            action: {
              label: "復原",
              run: () => {
                if (prints.includes(p)) return;
                if (p.status === "done") markGenLog(p.job, null);
                prints.splice(Math.max(0, Math.min(at, prints.length)), 0, p);
                savePrints();
                // 放回去的那張當成新夾上去的：往下一落、晃幾下（renderLine 看 lineSeen 決定誰要晃）。
                lineSeen?.delete(p.id);
                renderLine();
                renderAll([]);
                announce("放回繩上了");
              },
            },
          });
        },
      },
      "從繩上撤下"
    ),
  ];
  sheet = openSheet(
    `試印 ${p.letter || ""}・${STATUS_ZH[p.status] || ""}`,
    el(
      "div",
      { class: "print-view" },
      src ? el("img", { class: "print-view-img", src, alt: "成品" }) : el("p", { class: "print-view-empty" }, p.note || STATUS_ZH[p.status] || ""),
      el(
        "div",
        { class: "print-view-side" },
        el(
          "p",
          { class: "tag-en" },
          seedUseButton(p.seed),
          "・" + [ERA_ZH[p.era] || "", p.hires ? `Hires ${p.hires.width}×${p.hires.height}（原圖 ${p.width}×${p.height}）` : `${p.width}×${p.height}`, RATING_ZH[p.rating] || ""].filter(Boolean).join("・")
        ),
        el("p", { class: "print-view-label" }, `這一版的牌（${mine.length}）`),
        el("div", { class: "print-view-cards" }, mine.map((t) => cardNode(cardOf(t), assets, { tagName: "div" }))),
        el("details", { class: "print-view-pos" }, el("summary", {}, "POS"), el("pre", { class: "pos-text" }, p.positive)),
        // 做過 Hires：提示詞底下一張示意圖，點開左右拉動比較（compare.js）。
        compareThumb(p)
      )
    ),
    { wide: true, foot }
  );
}

/* ================= 字盒 ================= */

function renderCaseTabs() {
  const box = $("case-tabs");
  const tabs = [
    ["all", "全部", null],
    ["match", "相配", null],
    ...CARD_SUITS.map((s) => [s, CARD_SUIT_INFO[s].zh, s]),
  ];
  box.replaceChildren(
    ...tabs.map(([id, label, suit]) =>
      el(
        "button",
        {
          class: "case-tab pressable",
          type: "button",
          dataset: { tab: id, suit: suit || "" },
          title: suit ? `${label}（${CARD_SUIT_INFO[suit].glyph}）` : undefined,
          "aria-pressed": caseTab === id ? "true" : "false",
          onclick: () => {
            caseTab = id;
            caseGroup = "";
            writeJ(FK.tab, id);
            renderCaseTabs();
            caseBackToTop(true);
            dealCase = true;
            renderCase();
            seat($("case-tabs").querySelector('[aria-pressed="true"]'));
          },
        },
        suit ? el("i", { class: "tab-dot", "aria-hidden": "true" }, CARD_SUIT_INFO[suit].glyph) : label,
        suit ? el("span", { class: "sr-only" }, label) : null
      )
    )
  );
}

function visibleCard(card) {
  if (!rankOk(card) || bans.has(card.tag)) return false;
  if (card.gate === "male" && !settings.boy) return false;
  if (card.gate === "female" && !settings.girl) return false;
  return true;
}

function affinities() {
  const out = new Map();
  const has = new Set(bed.pins);
  for (const a of bed.pins) {
    const places = ACT_PLACE[a];
    if (!places) continue;
    for (const p of places) if (lib.byTag.has(p) && !has.has(p) && !out.has(p)) out.set(p, "呼應");
  }
  for (const [act, places] of Object.entries(ACT_PLACE)) {
    if (!lib.byTag.has(act) || has.has(act) || out.has(act)) continue;
    if (bed.pins.some((p) => places.has(p))) out.set(act, "呼應");
  }
  const freq = new Map();
  for (const t of trials) for (const x of t.extra) freq.set(x, (freq.get(x) || 0) + 1);
  [...freq]
    .filter(([x, c]) => c >= 2 && !out.has(x))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 36)
    .forEach(([x, c]) => out.set(x, `常補 ${c}/4`));
  return out;
}

/** 選了某一種花色時，下面多一排小分類（鏡頭、表情、視線…），前面是牌面上那個一字章。 */
function renderCaseGroups(inSuit) {
  const box = $("case-groups");
  const suitTab = CARD_SUITS.includes(caseTab);
  const runs = suitTab ? groupChips(inSuit) : [];
  if (caseGroup && !runs.some((r) => r.items.some((i) => i.g === caseGroup))) caseGroup = "";
  box.hidden = runs.reduce((n, r) => n + r.items.length, 0) < 2;
  if (box.hidden) return box.replaceChildren();
  const chip = (g, label, seal, full) =>
    el(
      "button",
      {
        class: "group-chip pressable",
        type: "button",
        "aria-pressed": caseGroup === g ? "true" : "false",
        "aria-label": full && full !== label ? full : null,
        onclick: () => {
          caseGroup = g;
          caseBackToTop();
          dealCase = true;
          renderCase();
          seat($("case-groups").querySelector('[aria-pressed="true"]'));
        },
      },
      seal ? el("b", { class: "chip-seal", "aria-hidden": "true" }, seal) : null,
      label
    );
  box.replaceChildren(
    chip("", "全部", null),
    ...runs.map((r) =>
      r.fam
        ? el(
            "span",
            { class: "chip-run" },
            el("span", { class: "chip-fam", "aria-hidden": "true" }, r.seal ? el("b", { class: "chip-seal" }, r.seal) : null, r.fam),
            ...r.items.map((i) => chip(i.g, i.short, null, i.zh))
          )
        : chip(r.items[0].g, r.items[0].short, r.items[0].seal, r.items[0].zh)
    )
  );
}

/**
 * 換了花色、小分類、搜尋：字盒捲過頭就捲回來（細分類籤跟牌一起捲，見 fuse.css 的 .case-scroll）。
 *   all：換花色，連新的細分類籤一起看到（捲到最上面）。不然牌格頂端露出來就好。
 * 窄螢幕那一層沒有在捲（display: contents），什麼都不做。
 */
function caseBackToTop(all = false) {
  const box = $("case-scroll");
  if (!box || box.scrollHeight <= box.clientHeight + 1) return;
  const top = all ? 0 : $("case-grid").getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  if (box.scrollTop > top) box.scrollTop = top;
}

function renderCase() {
  const deal = dealCase;
  dealCase = false;
  const q = caseQuery.trim().toLowerCase();
  let list;
  let reasons = null;
  if (caseTab === "match") {
    reasons = affinities();
    list = [...reasons.keys()].map(cardOf).filter(Boolean);
  } else {
    list = lib.cards.filter((c) => caseTab === "all" || c.suit === caseTab);
  }
  list = list.filter(visibleCard);
  renderCaseGroups(list);
  if (caseGroup) list = list.filter((c) => c.group === caseGroup);
  if (q) list = list.filter((c) => c.zh.toLowerCase().includes(q) || c.tag.includes(q) || (c.groupZh || "").includes(q));
  caseList = list;
  caseShown = 0;
  const grid = $("case-grid");
  grid.replaceChildren();
  grid._reasons = reasons;
  $("case-count").textContent = `${list.length} 張`;
  tickIfChanged($("case-count"), "case-count");
  const qEl = $("case-q");
  const miss = !!q && !list.length;
  if (miss && qEl.dataset.miss !== "1") {
    qEl.dataset.miss = "1";
    qEl.classList.remove("is-miss");
    void qEl.offsetWidth;
    qEl.classList.add("is-miss");
  } else if (!miss) {
    delete qEl.dataset.miss;
    qEl.classList.remove("is-miss");
  }
  if (!list.length) {
    const emptyKey = (q ? "q:" + q : "") + "|" + caseTab + "|" + caseGroup;
    const empty = el(
      "p",
      { class: "case-empty" },
      caseTab === "match" && !bed.pins.length ? "放一張牌上版，這裡會列出跟它呼應的牌，和引擎常常補進來的牌。" : "沒有符合的牌。"
    );
    grid.append(empty);
    if (emptyKey !== caseEmptyShown) {
      caseEmptyShown = emptyKey;
      enter(empty);
    }
    markEnterTarget();
    return;
  }
  caseEmptyShown = "";
  moreCase();
  markEnterTarget();
  // 換花色、換小分類：捲回最上面，前二十張依序發進來（跟墨池的字盒一樣）。放牌、打字重畫不發。
  if (deal) {
    grid.scrollTop = 0;
    if (!reduced()) {
      [...grid.querySelectorAll(".card")].slice(0, 20).forEach((c, i) => {
        c.style.setProperty("--i", String(i));
        c.classList.add("dealt");
        setTimeout(() => c.classList.remove("dealt"), 900);
      });
    }
  }
}

/** 找牌框裡打了字：Enter 會放上的那一張（第一張）描一圈，按之前就知道是哪張。 */
function markEnterTarget() {
  const q = $("case-q");
  setEnterTarget($("case-grid"), document.activeElement === q && !!q.value.trim());
}

let caseObserver = null;
let caseEmptyShown = "";

function moreCase() {
  const grid = $("case-grid");
  grid.querySelector(".case-more")?.remove();
  const slice = caseList.slice(caseShown, caseShown + PAGE);
  caseShown += slice.length;
  const reasons = grid._reasons;
  const has = new Set(bed.pins);
  for (const card of slice) {
    const node = cardNode(card, assets, { src: reasons ? reasons.get(card.tag) : null });
    node.tabIndex = grid.querySelector(".card") ? -1 : 0;
    if (has.has(card.tag)) node.dataset.state = "pinned";
    node.setAttribute("aria-pressed", has.has(card.tag) ? "true" : "false");
    node.addEventListener("click", () => {
      if (hand?.editing) hand.toggle(card.tag, node.getBoundingClientRect());
      else toggle(card.tag, node);
    });
    if (hand?.has(card.tag)) node.dataset.inHand = "true";
    drag.attach(node, { tag: card.tag, from: "case" });
    grid.append(node);
  }
  if (caseShown < caseList.length) {
    const more = el("span", { class: "case-more", "aria-hidden": "true" });
    grid.append(more);
    if (!caseObserver) {
      caseObserver = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) moreCase();
      }, { rootMargin: "400px" });
    }
    caseObserver.disconnect();
    caseObserver.observe(more);
  }
}

function syncCaseStates() {
  const has = new Set(bed.pins);
  for (const node of $("case-grid").querySelectorAll(".card[data-tag]")) {
    const on = has.has(node.dataset.tag);
    // 剛放上版的那張：「在池」章像橡皮章一樣壓下來（本來就在的不重蓋）。
    if (on && node.dataset.state !== "pinned" && !reduced()) {
      node.classList.add("is-flag-stamp");
      setTimeout(() => node.classList.remove("is-flag-stamp"), 420);
    }
    if (on) node.dataset.state = "pinned";
    else delete node.dataset.state;
    node.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

/** 字盒用方向鍵走：整片只佔一個 Tab 停點。 */
function caseKeys(e) {
  const grid = $("case-grid");
  const cards = [...grid.querySelectorAll(".card")];
  const i = cards.indexOf(document.activeElement);
  if (i < 0) return;
  let cols = 1;
  const top = cards[0].offsetTop;
  while (cols < cards.length && cards[cols].offsetTop === top) cols++;
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: cards.length - 1 - i }[e.key];
  if (step === undefined) return;
  e.preventDefault();
  // 第一排再往上：回到找牌框（跟找牌框按 ↓ 走進字盒是一對）。
  if (e.key === "ArrowUp" && i < cols) return void $("case-q").focus();
  const j = Math.max(0, Math.min(cards.length - 1, i + step));
  cards[i].tabIndex = -1;
  cards[j].tabIndex = 0;
  cards[j].focus();
  if (j >= cards.length - 3 && caseShown < caseList.length) moreCase();
}

/**
 * 找牌框：Enter 放上第一張（找到就放，不用再伸手去點），字全選著、接著打下一張；
 * ↓ 走進字盒。已經在版上的那張不拿下來，跳一下說它在了。
 */
function caseSearchKeys(e) {
  const q = e.currentTarget;
  if (e.key !== "Enter" && e.key !== "ArrowDown") return;
  if (e.isComposing || e.keyCode === 229) return; // 注音、倉頡選字的 Enter 不算
  e.preventDefault();
  if (caseQuery !== q.value) {
    clearTimeout(caseSearchTimer);
    caseQuery = q.value;
    renderCase();
  }
  const grid = $("case-grid");
  const first = grid.querySelector(".card[data-tag]");
  if (!first) return;
  if (e.key === "ArrowDown") {
    for (const c of grid.querySelectorAll(".card")) c.tabIndex = -1;
    first.tabIndex = 0;
    first.focus();
    return;
  }
  if (!q.value.trim()) return;
  const tag = first.dataset.tag;
  if (bed.pins.includes(tag)) {
    stamp(plateNode(tag) || first);
    announce(`「${zh(tag)}」已經在版上`);
  } else place(tag, first);
  q.select();
}

function peekInfo(node) {
  const card = cardOf(node.dataset.tag);
  if (!card || document.body.dataset.dragging === "true" || pop) return null;
  finishTrials();
  const facts = cardFacts(card, lex, data).filter(([k]) => k !== "分級").slice(0, 4);
  if (bed.pins.includes(card.tag)) {
    const take = takeOf(card.tag);
    facts.unshift(["上墨", take === trials.length ? "四張試印都有它" : `${take}/${trials.length} 張試印有它`]);
  }
  return {
    zh: card.zh,
    tag: card.tag,
    glyph: CARD_SUIT_INFO[card.suit].glyph,
    seal: card.seal,
    sealTitle: card.groupZh,
    suitColor: getComputedStyle(document.documentElement).getPropertyValue(`--suit-${card.suit}`).trim(),
    art: assets.art(card.tag),
    rating: card.rating,
    facts,
  };
}

/* ================= 拖曳 ================= */

const caseCard = (tag) => $("case-grid").querySelector(`.card[data-tag="${cssEsc(tag)}"]`);
let dropRow = null;

const drag = createDrag({
  zones: () => [
    // 偏好卡牌：字盒、版上的牌都可以拖進來（托盤浮在卡池上面，所以排第一個先認；版上的等於收回手牌）。
    // 托盤上的牌拖一拖又放回托盤：當作沒拖（不能穿過托盤掉到底下的卡池）。
    { id: "hand", el: hand?.el, accepts: () => !!hand },
    { id: "plate", el: $("plate"), accepts: (p) => p.from !== "plate" },
    // 手機上卡池捲走了，角落那顆「卡池」也收牌：影子縮小被吸進去。
    { id: "pill", el: $("pool-pill"), accepts: (p) => p.from === "case" && !$("pool-pill").hidden, sink: true },
    { id: "case", el: $("case"), accepts: (p) => p.from === "plate" || p.from === "hand" },
  ],
  // 拖著經過卡池：它會落到的那一列先亮起來。
  // 拖著經過托盤：要插進去的那一格先空出來。
  onMove: (zone, p, x) => hand?.hover(zone === "hand" ? x : null, p.tag),
  onOver: (zone, p) => {
    dropRow?.classList.remove("is-drop-target");
    dropRow = null;
    if (zone !== "plate") return;
    dropRow = $("registers").querySelector(`.register[data-suit="${suitOf(p.tag)}"]`);
    dropRow?.classList.add("is-drop-target");
  },
  // 手機長按原地放開：沒有滑鼠懸停，用同一張放大卡給它看（點任何地方收起）。
  onHold: (p, node) => {
    const info = peekInfo(node);
    if (info) showPeek(node, info);
  },
  onDrop: (p, zone, at) => {
    if (zone === "hand") {
      // 放在哪就插在哪（托盤上的牌＝換位置）；滿了收不下，影子彈回原位。
      if (!hand.drop(p.tag, at?.x)) return false;
      if (p.from === "plate") {
        hand.arriveAt(p.tag, 0);
        remove(p.tag, { viaDrag: true });
      }
      return hand.nodeOf(p.tag);
    }
    if (zone === "case") {
      if (p.from === "hand") {
        hand.remove(p.tag, { quiet: true });
        return caseCard(p.tag);
      }
      remove(p.tag, { viaDrag: true });
      return caseCard(p.tag);
    }
    const r = place(p.tag, null, { viaDrag: true });
    if (zone === "pill") {
      return {
        landed: () => {
          r?.landed();
          stamp($("pool-pill"), "is-bumped");
        },
      };
    }
    return { el: plateNode(p.tag), landed: r?.landed };
  },
});

/* ================= 桅杆、規則 ================= */

function renderRating() {
  $("rating").replaceChildren(
    ...["general", "sensitive", "explicit"].map((r) =>
      el(
        "button",
        {
          class: "pressable",
          type: "button",
          role: "radio",
          "aria-checked": settings.rating === r ? "true" : "false",
          dataset: { v: r },
          onclick: () => {
            setSettings({ rating: r });
            renderRating();
            seat($("rating").querySelector('[aria-checked="true"]'));
          },
        },
        RATING_LABEL[r]
      )
    )
  );
}

function pingLoop() {
  watchLink((st) => {
    const ok = st === "ok";
    const prev = comfyOk;
    const changed = ok !== prev;
    comfyOk = ok;
    linkNow = st;
    const p = $("ping");
    p.dataset.ok = ok ? "1" : "0";
    p.querySelector("span").textContent = LINK_LABEL[st];
    if (prev !== null && changed) {
      if (ok) seat(p);
      else refuse(p);
    }
    if (changed && trials.length) renderPrintBar();
  });
}

function segmented(label, options, current, onPick) {
  return el(
    "div",
    { class: "segmented", role: "radiogroup", "aria-label": label },
    options.map(([v, text]) =>
      el(
        "button",
        {
          class: "pressable",
          type: "button",
          role: "radio",
          "aria-checked": current === v ? "true" : "false",
          onclick: (e) => {
            onPick(v);
            for (const b of e.currentTarget.parentNode.children) b.setAttribute("aria-checked", b === e.currentTarget ? "true" : "false");
            seat(e.currentTarget);
          },
        },
        text
      )
    )
  );
}

/** 數字加減（跟墨池規則裡那個同一個樣子，motion.js 讓數字滾動）。 */
function stepper(label, value, min, max, onChange) {
  let v = value;
  const out = el("output", {}, v);
  const minus = el("button", { class: "pressable", type: "button", "aria-label": `${label}少一張` }, "−");
  const plus = el("button", { class: "pressable", type: "button", "aria-label": `${label}多一張` }, "＋");
  const sync = () => {
    out.textContent = v;
    minus.disabled = v <= min;
    plus.disabled = v >= max;
  };
  minus.onclick = () => {
    v = Math.max(min, v - 1);
    sync();
    onChange(v);
  };
  plus.onclick = () => {
    v = Math.min(max, v + 1);
    sync();
    onChange(v);
  };
  sync();
  return el("span", { class: "stepper" }, el("span", { class: "stepper-label" }, label), minus, out, plus);
}

function openRules() {
  const size = (SIZES.find((s) => s.w === settings.width && s.h === settings.height) || SIZES[0]).id;
  const who = settings.girl && settings.boy ? "any" : settings.boy ? "boy" : "girl";
  const eraSel = el(
    "select",
    { class: "select", "aria-label": "時代" },
    el("option", { value: "mixed" }, "混合（每張隨機）"),
    ERAS.map((e) => el("option", { value: e }, ERA_LABELS[e]))
  );
  eraSel.value = settings.eras.length === 1 ? settings.eras[0] : "mixed";
  eraSel.onchange = () => setSettings({ eras: eraSel.value === "mixed" ? [...ERAS] : [eraSel.value] });
  const heats = el(
    "div",
    { class: "rule-chips", role: "group", "aria-label": "情境" },
    HEATS.map((h) => {
      const blocked = heatBlockedByRating(h, settings.rating);
      return el(
        "button",
        {
          class: "chip-toggle pressable",
          type: "button",
          "aria-pressed": settings.heats.includes(h) && !blocked ? "true" : "false",
          // 不用 disabled：手機點下去要有反應、說得出為什麼（explainBlockedHeat）。
          "aria-disabled": blocked ? "true" : undefined,
          title: blocked ? `${RATING_LABEL[settings.rating]}不會出現${HEAT_ZH[h]}` : undefined,
          onclick: (e) => {
            if (heatBlockedByRating(h, settings.rating)) return explainBlockedHeat(h, e.currentTarget, settings.rating);
            setSettings({ heats: toggleHeat(settings.heats, h) });
            e.currentTarget.setAttribute("aria-pressed", settings.heats.includes(h) ? "true" : "false");
          },
        },
        HEAT_ZH[h]
      );
    })
  );
  const row = (label, control) => el("div", { class: "rule-row" }, el("span", { class: "rule-label" }, label), control);
  // 數字比骨架少時，那一段在步進器底下展開選格（skeleton-picker.js）。
  const picker = skeletonPicker({ settings: () => settings, save: (patch) => setSettings(patch) });
  let sheet = null;
  sheet = openSheet(
    "規則",
    el(
      "div",
      { class: "rules-sheet" },
      el("p", { class: "rules-note" }, "疊印台自己的規則，跟墨池分開。改了之後四張試印會立刻重抽。"),
      row(
        "尺寸",
        segmented(
          "尺寸",
          SIZES.map((s) => [s.id, `${s.zh} ${s.w}×${s.h}`]),
          size,
          (v) => {
            const s = SIZES.find((x) => x.id === v);
            setSettings({ width: s.w, height: s.h });
          }
        )
      ),
      row(
        "畫面裡有誰",
        segmented(
          "畫面裡有誰",
          [
            ["girl", "女"],
            ["boy", "男"],
            ["any", "不限"],
          ],
          who,
          (v) => setSettings({ girl: v !== "boy", boy: v !== "girl" })
        )
      ),
      row("時代", eraSel),
      // 姿勢參考：人物照一張圖的姿勢擺（pose.js）。
      row("姿勢參考", poseButton({ recent: () => prints.filter((p) => p.status === "done" && p.image && !p._gone).map((p) => ({ src: viewSrc(p.image), full: p.image })), wf: currentWorkflowId, rating: () => settings.rating, size: () => ({ w: settings.width, h: settings.height }) })),
      row("情境", heats),
      row(
        "每段補幾張",
        el(
          "div",
          { class: "rule-steppers", role: "group", "aria-label": "引擎每段補幾張" },
          [
            ["feature", "長相"],
            ["clothing", "服裝"],
            ["pose", "姿勢"],
            ["env", "場景"],
          ].map(([k, label]) =>
            stepper(label, settings.counts[k], 0, 10, (v) => {
              setSettings(stepSkeleton(settings, k, v));
              picker.update(k);
            })
          )
        )
      ),
      picker.node
    ),
    { foot: [el("button", { class: "btn btn-primary", type: "button", onclick: () => sheet && sheet.close() }, "好了")] }
  );
}

let hand = null;

/** 牌的選單上「加入偏好卡牌／從偏好卡牌拿掉」。 */
function handAct(tag, anchor) {
  if (!hand) return null;
  const has = hand.has(tag);
  return el(
    "button",
    {
      class: "btn btn-small btn-ghost",
      type: "button",
      onclick: () => {
        closePop();
        if (has) hand.remove(tag);
        else if (hand.add(tag, anchor?.getBoundingClientRect())) announce(`「${zh(tag)}」加進偏好卡牌`);
      },
    },
    has ? "從偏好卡牌拿掉" : "加入偏好卡牌"
  );
}

/** 偏好卡牌（hand.js）：疊印台自己一份，跟墨池分開。 */
function buildHand() {
  hand = createHand({
    key: "mochi.fuse.hand.v1",
    makeNode: (t) => cardNode(cardOf(t), assets),
    blocked: (t) => (cardOf(t) && !rankOk(cardOf(t)) ? "分級擋掉" : null),
    // 托盤的牌大小照墨池（hand.js 存的 mochi.fav.size），這裡不量自己的字盒：兩個房間切換時托盤不會跳。
    inPool: (t) => bed.pins.includes(t),
    known: (t) => lib.byTag.has(t) && !bans.has(t),
    // 出牌：從托盤上那張的位置飛上版。
    onPlay: (t) => place(t, hand.nodeOf(t)),
    onChange: syncHand,
    onFull: () => toast(`偏好卡牌最多 ${hand.max} 張，先拿掉一張再加`),
    onRemoved: (t, undo) => toast(`「${zh(t)}」拿出偏好卡牌`, { action: { label: "復原", run: undo } }),
    decorate: (node, t) => drag.attach(node, { tag: t, from: "hand" }),
  });
  syncHand();
}

function syncHand() {
  if (!hand) return;
  const btn = $("hand-btn");
  btn.setAttribute("aria-pressed", hand.open ? "true" : "false");
  $("hand-count").textContent = `${hand.count}/${hand.max}`;
  hand.mark($("case-grid"));
}

function wireChrome() {
  $("rules-btn").addEventListener("click", openRules);
  $("hand-btn").addEventListener("click", () => hand?.fromButton());
  const snd = $("sound-btn");
  const syncSound = () => {
    snd.setAttribute("aria-pressed", sfx.on ? "true" : "false");
    const label = sfx.on ? "聲音：開（點一下關掉）" : "聲音：關（點一下打開）";
    snd.setAttribute("aria-label", label);
    snd.title = label;
    snd.innerHTML = sfx.on ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>` : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>`;
  };
  syncSound();
  snd.addEventListener("click", () => {
    sfx.on = !sfx.on;
    syncSound();
    if (sfx.on) sfx.carry();
  });
  $("undo").addEventListener("click", undo);
  $("decks-btn").addEventListener("click", openDeckSheet);
  buildCasePicker();
  listenPaste((text) => openPastePlate(text));
  // 牌組讀到了：版還是空的就重畫，「你的牌組」才出現在起手式上面。
  loadDecks().then((d) => {
    if (d && d.length && !bed.pins.length) renderPlate([]);
  });
  $("clear").addEventListener("click", clearBed);
  $("reroll").addEventListener("click", reroll);
  const q = $("case-q");
  q.addEventListener("input", () => {
    clearTimeout(caseSearchTimer);
    caseSearchTimer = setTimeout(() => {
      caseQuery = q.value;
      caseBackToTop();
      renderCase();
    }, 120);
  });
  q.addEventListener("keydown", caseSearchKeys);
  q.addEventListener("focus", markEnterTarget);
  q.addEventListener("blur", markEnterTarget);
  q.title = "Enter 放上第一張，↓ 走進字盒";
  $("case-grid").addEventListener("keydown", caseKeys);
  // 晾紙繩只會橫著捲：滑鼠滾輪上下滾也讓它左右走（滑鼠大多只有直向滾輪）。捲到頭就把滾輪還給頁面。
  const line = $("line-list");
  line.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = line.scrollWidth - line.clientWidth;
      if (max <= 0) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const next = Math.max(0, Math.min(max, line.scrollLeft + dy));
      if (next === line.scrollLeft) return;
      e.preventDefault();
      line.scrollLeft = next;
    },
    { passive: false }
  );
  line.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const n = e.target.closest ? e.target.closest(".print") : null;
    if (!n) return;
    clearTimeout(linePeekTimer);
    // 第一張等一下再出來（滑鼠只是路過就不跳）；已經開著時換到隔壁那張就直接換。
    linePeekTimer = setTimeout(() => showLinePeek(n), linePeek && !linePeek.hidden ? 0 : 160);
  });
  line.addEventListener("pointerleave", hideLinePeek);
  line.addEventListener("pointerdown", hideLinePeek);
  line.addEventListener(
    "scroll",
    () => {
      hideLinePeek();
      syncLineFade();
    },
    { passive: true }
  );
  $("pool-pill").addEventListener("click", () => $("plate").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }));
  const regs = $("registers");
  const relTarget = (e) => (e.target.closest ? e.target.closest(".plate-card")?.dataset.tag || null : null);
  regs.addEventListener("pointerover", (e) => setRelFocus(relTarget(e)));
  regs.addEventListener("pointerleave", () => setRelFocus(null));
  regs.addEventListener("focusin", (e) => setRelFocus(relTarget(e)));
  regs.addEventListener("focusout", () => setRelFocus(null));
  regs.addEventListener("keydown", poolKeys);
  // 卡池那一欄大小一變（拉視窗、上面多一行提示、晾紙繩多了第一張），牌就重新配一次大小。
  if (typeof ResizeObserver === "function") new ResizeObserver(scheduleFit).observe($("plate-scroll"));
  wideLayout.addEventListener?.("change", scheduleFit);
  document.addEventListener("pointerdown", (e) => (lastPointer = e.pointerType || "mouse"), true);
  document.addEventListener("keydown", onKey);
  let rTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(() => {
      closePop();
      drawRelations([]);
      syncLineFade();
    }, 120);
  });
  $("plate-scroll").addEventListener("scroll", () => closePop(), { passive: true });
  // 窄螢幕是整頁捲動：選單是 fixed，頁面一捲它就停在舊位置、牌已經走了。捲超過一點點就收起來。
  window.addEventListener("scroll", () => {
    if (pop && Math.abs(window.scrollY - (pop._scrollY ?? window.scrollY)) > 8) closePop();
  }, { passive: true });
}

function onKey(e) {
  if (handleLoraKeys(e) || wfHandleKeys(e) || discord?.keys(e)) return;
  if (anyOverlay() || e.altKey) return;
  const t = e.target;
  const typing = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
  if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
    if (typing) return;
    e.preventDefault();
    undo();
    return;
  }
  if (e.ctrlKey || e.metaKey) return;
  if (e.key === "Escape") {
    if (pop) closePop({ focus: true });
    else if (typing && t.id === "case-q") t.blur();
    return;
  }
  if (typing) return;
  if (e.key === "/") {
    e.preventDefault();
    $("case-q").focus();
  } else if (e.key === "z" || e.key === "Z") {
    e.preventDefault();
    undo();
  } else if (e.key >= "1" && e.key <= "4") {
    e.preventDefault();
    pick(Number(e.key) - 1);
  } else if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    reroll();
  } else if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    printNow();
  }
}

/* ================= 手機：卡池捲出畫面時，角落留一顆「卡池」 ================= */

function renderPill() {
  const pill = $("pool-pill");
  put(
    pill,
    el(
      "span",
      { class: "pill-arts", "aria-hidden": "true" },
      bed.pins.slice(-3).map((tg) =>
        assets.art(tg)
          ? applyArtSources(el("img", { alt: "", decoding: "async" }), assets.sources(tg))
          : el("b", { style: `--suit: var(--suit-${suitOf(tg)})` }, [...zh(tg)][0])
      )
    ),
    el("span", { class: "pill-label" }, "卡池"),
    el("b", { class: "pill-count" }, String(bed.pins.length))
  );
  tickIfChanged(pill.querySelector(".pill-count"), "pill-count");
  pill.setAttribute("aria-label", `回到卡池（${bed.pins.length} 張）`);
}

// 另一個方向：人在上面看卡池、字盒還在很下面的時候，同一個角落換成「字盒 ↓」。
// 窄螢幕上字盒排在卡池、試印、付印之後，要加一張牌得捲過一整頁；兩顆輪流出現、不會同時在。
// 卡池（#plate）現在看不看得到。手機上字盒排在卡池底下，挑牌時卡池常常捲出畫面。
let plateSeen = true;

function watchPoolPill() {
  const pill = $("pool-pill");
  const jump = $("case-jump");
  if (typeof IntersectionObserver !== "function") return;
  const narrow = matchMedia("(max-width: 68.74rem)");
  let poolVisible = true;
  plateSeen = true;
  let caseVisible = false;
  const sync = () => {
    pill.hidden = !(narrow.matches && !poolVisible);
    jump.hidden = !(narrow.matches && poolVisible && !caseVisible);
  };
  new IntersectionObserver((entries) => {
    poolVisible = entries.some((e) => e.isIntersecting);
    plateSeen = poolVisible;
    sync();
  }, { threshold: 0.04 }).observe($("plate"));
  new IntersectionObserver((entries) => {
    caseVisible = entries.some((e) => e.isIntersecting);
    sync();
  }, { threshold: 0 }).observe($("case"));
  narrow.addEventListener("change", sync);
  // 手機：字盒是抽屜，「字盒」直接拉上來；平板照舊捲下去。
  jump.addEventListener("click", () => (caseMQ.matches ? openCasePicker() : $("case").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" })));
}

/* ================= 手機：字盒是挑牌抽屜（跟墨池同一套） =================
 * 窄螢幕上字盒排在卡池、試印、付印之後，加一張牌得捲過一整頁、看結果又要捲回來。
 * 手機上字盒平常只剩一行「字盒 ［挑牌］」，按了（或角落的「字盒」）從底部拉上來挑；
 * 抽屜開著時點牌，牌飛進底下「卡池 N 張」；按「完成」、點暗幕、握把往下拉、返回手勢、Esc 都會收。
 * 收起來時卡池不在畫面上就捲回去，新放上的牌一張張落定。
 * 握把、底部那條、暗幕跟墨池共用樣式（styles.css 的 body[data-picker="open"]）。 */
const caseMQ = matchMedia("(max-width: 40rem)");
let caseOpen = false;
let caseFrom = null;
let caseHold = null;

function buildCasePicker() {
  const box = $("case");
  box.querySelector(".case-head").append(
    el("button", { class: "btn btn-small case-open", id: "case-open", type: "button", "aria-controls": "case", onclick: () => openCasePicker() }, "挑牌")
  );
  const grip = el("div", { class: "picker-grip", "aria-hidden": "true" });
  box.prepend(grip);
  box.append(
    el(
      "div",
      { class: "picker-foot case-foot" },
      el("span", { class: "picker-count", id: "case-foot-count" }),
      el("button", { class: "btn btn-primary picker-done", type: "button", onclick: () => closeCasePicker() }, "完成")
    )
  );
  box.after(el("div", { class: "picker-scrim", id: "case-scrim", hidden: true, onclick: () => closeCasePicker() }));
  caseHold = el("div", { class: "picker-hold", "aria-hidden": "true", hidden: true });
  box.before(caseHold);
  swipeCaseDown(grip, box);
  swipeCaseDown(box.querySelector(".case-head"), box);
  addEventListener("popstate", () => {
    if (caseOpen) closeCasePicker({ fromHistory: true });
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && caseOpen && !pop && !document.querySelector(".overlay")) closeCasePicker();
  });
  caseMQ.addEventListener?.("change", () => {
    if (!caseMQ.matches && caseOpen) closeCasePicker();
  });
  updateCaseFoot();
}

function openCasePicker() {
  if (caseOpen || !caseMQ.matches) return;
  closePop();
  hidePeek();
  caseOpen = true;
  caseFrom = new Set(bed.pins);
  const box = $("case");
  // 字盒離開版面（變成固定在底部的抽屜）時，原位墊一塊一樣高的空白：背後的頁面不會跳。
  caseHold.style.height = box.getBoundingClientRect().height + "px";
  caseHold.hidden = false;
  document.body.dataset.picker = "open";
  document.documentElement.style.overflow = "hidden";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  $("case-scrim").hidden = false;
  // window.history：這個檔案的 history 是撤回的紀錄（commit 的 history.push），不是瀏覽器的。
  try {
    window.history.pushState({ casePicker: true }, "");
  } catch {
    /* 不能動歷史紀錄就算了：照樣用按鈕收 */
  }
  updateCaseFoot();
  if (!reduced()) {
    box.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    $("case-scrim").animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
  }
  box.querySelector(".picker-done")?.focus({ preventScroll: true });
}

function closeCasePicker({ fromHistory = false } = {}) {
  if (!caseOpen) return;
  caseOpen = false;
  const box = $("case");
  const done = () => {
    if (caseOpen) return;
    delete document.body.dataset.picker;
    document.documentElement.style.overflow = "";
    box.removeAttribute("role");
    box.removeAttribute("aria-modal");
    box.style.transform = "";
    $("case-scrim").hidden = true;
    caseHold.hidden = true;
    $("case-open")?.focus({ preventScroll: true });
    greetPlaced();
  };
  if (!fromHistory && window.history.state && window.history.state.casePicker) {
    try {
      window.history.back();
    } catch {
      /* 沒關係 */
    }
  }
  if (reduced()) return done();
  const from = box.style.transform || "none";
  const a = box.animate([{ transform: from }, { transform: "translateY(100%)" }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" });
  $("case-scrim").animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" });
  const finish = () => {
    a.cancel();
    for (const x of $("case-scrim").getAnimations()) x.cancel();
    done();
  };
  a.onfinish = finish;
  setTimeout(() => !caseOpen && document.body.dataset.picker && finish(), DUR.short + 80);
}

/** 握把（或標題列）往下拉：超過 90px 或甩一下就收起，不到就彈回。 */
function swipeCaseDown(handle, sheet) {
  if (!handle) return;
  let drag = null;
  handle.addEventListener("pointerdown", (e) => {
    if (!caseOpen || e.pointerType === "mouse" || e.target.closest("button")) return;
    drag = { id: e.pointerId, y: e.clientY, t: performance.now(), dy: 0 };
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* 照樣處理 */
    }
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const raw = e.clientY - drag.y;
    drag.dy = raw > 0 ? raw : raw / 6;
    sheet.style.transform = `translateY(${drag.dy.toFixed(1)}px)`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dy, t } = drag;
    drag = null;
    const speed = dy / Math.max(1, performance.now() - t);
    if (dy > 90 || (dy > 24 && speed > 0.6)) return closeCasePicker();
    if (dy && !reduced()) sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.settle) });
    sheet.style.transform = "";
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

function updateCaseFoot() {
  const n = $("case-foot-count");
  if (!n) return;
  const text = bed.pins.length ? `卡池 ${bed.pins.length} 張` : "卡池還是空的";
  if (n.textContent === translate(text)) return;
  n.textContent = text;
  if (caseOpen && !reduced()) n.animate([{ transform: "translateY(5px)", opacity: 0.4 }, { transform: "none", opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
}

/** 抽屜開著時放牌：牌的影子飛進底下那個「卡池 N 張」，數字彈一下（卡池在抽屜後面，看不到）。 */
function tuckIntoCaseFoot(tag, from) {
  const card = cardOf(tag);
  const target = $("case-foot-count");
  if (!card || !from || !from.width || !target || reduced()) return;
  const f = cardNode(card, assets, { tagName: "div" });
  f.classList.add("flying");
  document.body.append(f);
  flight(f, { left: from.left, top: from.top, width: from.width, height: from.height }, () => target, {
    endScale: 0.3,
    endOpacity: 0.3,
    arc: 50,
    zIndex: 120,
    onLand: () => target.animate([{ transform: "scale(1.15)" }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.settle) }),
  });
}

/** 抽屜收起來之後：卡池不在畫面上就捲回去，這次新放上的牌一張張浮起、落定。 */
function greetPlaced() {
  const from = caseFrom;
  caseFrom = null;
  if (!from) return;
  const added = bed.pins.filter((t) => !from.has(t));
  if (!added.length) return;
  // 看的是新放上的牌本身在不在畫面裡（卡池很高，露出下半截不代表看得到上面幾排的新牌）：
  // 一張都看不到就捲到第一張新牌那裡。
  const nodes = added.map(plateNode).filter(Boolean);
  const seen = nodes.some((n) => {
    const r = n.getBoundingClientRect();
    return r.bottom > 60 && r.top < innerHeight - 60;
  });
  const away = nodes.length && !seen;
  if (away) nodes[0].scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
  if (reduced()) return;
  setTimeout(() => {
    nodes.slice(0, 12).forEach((n, i) =>
      n.animate(
        [{ transform: "translateY(-14px) scale(1.06)", filter: "brightness(1.12)" }, { transform: "none", filter: "none" }],
        { duration: DUR.long, delay: i * 50, easing: css(CURVE.settle), fill: "backwards" }
      )
    );
  }, away ? DUR.long : DUR.micro);
}


boot();
