/**
 * 墨池：排字匣的卡牌版。
 *
 * 字盒裡每個字是一張牌。拖進合成池 = 釘選；拖進廢字簍 = 封鎖。
 * 按「抽並生圖」，引擎用同一套抽牌邏輯（engine.js 的 drawOne，跟原版、暗房、中控室共用）
 * 把合成池以外的格子補齊，送 ComfyUI。每張成品底下攤開這張用了哪些牌：
 * 你放進池子的、引擎抽到的（附帶、時代錨、補位也標出來），都可以再拖回池子或丟進簍子。
 *
 * 這裡不寫任何抽牌規則。釘選、封鎖、互斥換位全部呼叫 engine 的 applyPin / applyBan。
 */
import {
  indexLexicon,
  sanitizeSettings,
  applyPin,
  applyBan,
  identityPins,
  identityBans,
  insertTriggerAfterCast,
  randomSeed,
  ERAS,
  ERA_LABELS,
  contradictions,
  ACT_PLACE,
  SKELETON,
  skeletonCap,
  stepSkeleton,
} from "./engine.js";
import { skeletonPicker } from "./skeleton-picker.js";
import { compareThumb } from "./compare.js";
import { watchGone, sweepGone } from "./gone.js";
import { relationsOf } from "./fuse-bed.js";
import { drawWithSeed } from "./draw-with-seed.js";
import { ratingBlocked, RATING_LABEL } from "./rules/rating.js";
import { searchMiss } from "./lib-hint.js";
import { HEATS, toggleHeat } from "./heats.js";
import { SCENE_MODES, SCENE_MODE_LABELS, heatBlockedByRating } from "./scene-policy.js";
import { initLoraPicker, currentLorasPayload, currentTriggerText, currentCkpt, handleLoraKeys } from "./lora.js";
import { initWorkflow, currentWorkflowId, currentSampling, wfHandleKeys } from "./workflow.js";
import { HARD_BANNED } from "./card-art.js";
import { buildLibrary, groupChips, genderChips, createAssets, cardNode, setCardFlag, setEnterTarget, eagerArt, cardFacts, cardMatches, CARD_SUIT_INFO, CARD_SUITS, RATING_ZH } from "./cards.js";
import { bindArt, artFallback } from "./card-images.js";
import { el, openSheet, anyOverlay, toast, runToastAction, ICONS } from "./ui.js";
import { mountKeysHelp } from "./keys-help.js";
import { mountTour } from "./tour.js";
import { mountGenStatus } from "./gen-status.js";
import { currentPose, poseButton } from "./pose.js";
import { openDecks } from "./decks.js";
import { openPaste, listenPaste } from "./paste-prompt.js";
import { paintWeight, wireWeightInput, weightRow, weightPositive } from "./weights.js";
import { favButton } from "./album-save.js";
import { createDrag, inkRing } from "./drag.js";
import { initMotion, settleMotion, replayDeal, flip, flipBy, leave, enter, confirmButton, gatherHome, flight, seat, refuse, reducedMotion, CURVE, DUR, css } from "./motion.js";
import { createHand } from "./hand.js";
import { createTrashPanel } from "./trash-panel.js";
import { createGenerator, comfyOnline, viewSrc, tabTitle, watchLink, LINK_LABEL, markGenLog } from "./gen.js";
import { genSeed, mountSeedControl, seedUseButton } from "./seed-control.js";
import { attachPeek } from "./card-peek.js";
import { createHires, openHiresPicker, paintHiresVeil, hiresBusy, HIRES_MODES } from "./hires.js";
import * as S from "./store.js";
import { recordUses } from "./usage.js";
import { getSfx } from "./sfx.js";
import { mountDiscord } from "./discord-link.js";
import { english, t, takeLanguageState } from "./i18n.js";

const sfx = getSfx();
// 聲音引擎第一次建立要幾十毫秒：第一個手勢時先在下一輪建好，等真的要出聲時已經在了。
for (const type of ["pointerdown", "keydown"]) {
  addEventListener(type, () => setTimeout(() => sfx.warm(), 0), { once: true, capture: true, passive: true });
}
// 放牌的聲音等牌落定才響（點字盒的牌會先飛一段、拖曳放開也要落一下）。
const LAND_SFX_MS = DUR.long;

const HEAT_ZH = { activity: "活動", tease: "誘惑", flash: "走光", sex: "性愛" };
const SIZES = [
  { id: "square", zh: "方 1024²", w: 1024, h: 1024 },
  { id: "portrait", zh: "直 832×1216", w: 832, h: 1216 },
  { id: "landscape", zh: "橫 1216×832", w: 1216, h: 832 },
];
const SRC_ZH = { implies: "附帶", bind: "附帶", era_anchor: "時代", repair: "補位", must_draw: "必抽", preset: "組合", fixed: "固定" };
const SECTION_ORDER = ["subject", "feature", "clothing", "pose", "env", "style", "quality"];

let data = null;
let lex = null;
let lib = null;
let assets = null;
let settings = null;
let pool = new Set();
// 合成池裡每張牌的份量（weights.js）：只記調過的（不是 1.0 的）。
let weights = new Map();
// 被同一格擠掉的牌原本的份量：按「換回」時一起回來。
const parkedWeights = new Map();
let bans = new Set();
let shots = [];
let infinite = false;
let stopAsked = false;
// 無限抽印完一輪、還沒排下一輪的那一小段空檔：照樣算「在忙」，「停」不能在這時候閃掉。
let looping = false;
const ui = { suit: "all", group: "", query: "", eraOnly: true, charGender: "", collapsed: matchMedia("(max-width: 63.99rem)").matches, ...S.loadUi() };
const $ = (id) => document.getElementById(id);

// 數字換版時只讓字面輕輕落定，讀屏仍直接讀到最後的數值。
function settleText(node, text) {
  text = t(text);
  if (!node || node.textContent === text) return;
  node.textContent = text;
  if (!reducedMotion()) node.animate(
    [{ opacity: 0.45, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
    { duration: DUR.short, easing: css(CURVE.out) }
  );
}

/* ================= 開機 ================= */

async function boot() {
  initMotion();
  // 快捷鍵說明（電腦）：頂欄的「?」、按 ? 打開（keys-help.js）。
  mountKeysHelp("mochi");
  // 新手導覽（頂欄「教學」右邊的「導覽」；第一次來會問要不要走一遍）：tour.js。
  mountTour("mochi");
  mountGenStatus("mochi");
  try {
    const [lexicon, manifest] = await Promise.all([
      fetch(document.querySelector('link[rel="preload"][href^="lexicon.json"]')?.href || "lexicon.json").then((r) => r.json()),
      fetch(document.querySelector('link[rel="preload"][href^="cards/manifest.json"]')?.href || "cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    data = lexicon;
    lex = indexLexicon(data);
    lib = buildLibrary(data, { ratingBlocked });
    assets = createAssets(manifest);
  } catch (err) {
    $("work").replaceChildren(el("p", { class: "pool-empty" }, "讀不到詞庫。請用 start.bat 開，而不是直接點 HTML。", el("br"), String(err)));
    return;
  }

  const stored = S.loadSettings();
  settings = sanitizeSettings(stored || { rating: "general" }, data);
  // 池子不存：重新整理就是空的；只收疊印台剛交過來的那一版。
  pool = new Set(S.takePool().filter((t) => lib.byTag.has(t)));
  weights = new Map(Object.entries(S.handoffWeights).filter(([t, w]) => pool.has(t) && w !== 1));
  const languageState = takeLanguageState();
  if (languageState) {
    pool = new Set((languageState.pool || []).filter((tag) => lib.byTag.has(tag)));
    weights = new Map(Object.entries(languageState.weights || {}).filter(([tag]) => pool.has(tag)));
  }
  bans = new Set(S.loadBans().filter((t) => lib.byTag.has(t)));
  // 重新整理就把沒印出來的清掉（失敗、取消、停掉的）：以前它們一直留在牆上掛著「再試一次」。
  // 留下的：印好的、只抽牌的（本來就沒要印）、畫到一半還接得回去的、剛剛還排著的（去別頁晃一下回來）。
  const saved = S.loadShots();
  shots = saved.filter((s) => s.status === "done" || s.status === "drawn" || (s.live && s.job) || S.stillWaiting(s));
  // 上次畫到一半就重新整理（或關掉分頁）的那張：伺服器還留著一陣子，接回去。
  const resumable = shots.filter((s) => s.live && s.job);
  for (const s of resumable) s.status = "queued";
  // 還排著沒送出去的：接在後面照原本的順序印（牆上新的在前面，所以倒過來）。
  const waiting = shots.filter((s) => S.stillWaiting(s)).reverse();
  for (const s of waiting) s.status = "queued";
  if (shots.length !== saved.length) S.saveShots(shots);

  buildHand();
  buildTrashPanel();
  buildPicker();
  initLoraPicker();
  initWorkflow({ sampling: true });
  discord = mountDiscord(zh, "墨池");
  pingLoop();

  renderRating();
  renderLibraryChrome();
  renderLibrary();
  renderPool();
  greetHandoff();
  renderRules();
  renderGoBar();
  renderWall();
  setTimeout(sweepShots, 1500);
  $("wall-start").addEventListener("click", () => $("go-bar").querySelector(".btn-primary")?.click());
  renderTrash();
  for (const s of resumable) generator.resume(s);
  for (const s of waiting) generator.enqueue(s);
  if (waiting.length) toast(`接著印剛才排著的 ${waiting.length} 張`);
  // Hires 做到一半就重新整理的：接回去。
  for (const s of shots) if (s.status === "done" && s.hiresJob) hiresRun.resume(s, s.hiresJob);
  for (const root of [$("lib-grid"), $("pool-well"), $("wall"), hand?.fan]) attachPeek(root, ".card[data-tag]", peekInfo);
  // 觸控裝置沒有實體鍵盤：搜尋框不提「按 /」（手機上只會把提示擠到看不完）。
  if (matchMedia("(hover: none)").matches) $("lib-q").placeholder = $("lib-q").placeholder.replace(/（按[^）]*）/, "");
  document.addEventListener("keydown", onKey);
  settleMotion();
  addEventListener("mochi:before-language-change", (event) => {
    event.detail.state = { pool: [...pool], weights: Object.fromEntries(weights) };
    S.saveShots(shots);
  });
}

function saveSettings() {
  S.saveSettings(settings);
}

function setSettings(patch) {
  // Heat selection has automatic weights; inherited weights belong to the old selection.
  settings = sanitizeSettings({ ...settings, ...(patch.heats ? { weights: undefined } : {}), ...patch }, data);
  saveSettings();
  // 規則換了（分級…）：托盤上出不了的牌要重新蓋章／拿掉章。
  hand?.update();
}

function saveUi() {
  S.saveUi({ suit: ui.suit, group: ui.group, eraOnly: ui.eraOnly, collapsed: ui.collapsed, charGender: ui.charGender });
}

/* ================= 分級與 Comfy ================= */

function renderRating() {
  const box = $("rating");
  box.replaceChildren(
    ...["general", "sensitive", "explicit"].map((r) =>
      el(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": settings.rating === r ? "true" : "false",
          dataset: { v: r },
          onclick: (e) => {
            const focused = document.activeElement === e.currentTarget;
            setSettings({ rating: r });
            renderRating();
            const selected = box.querySelector('[aria-checked="true"]');
            if (focused) selected?.focus({ preventScroll: true });
            seat(selected);
            renderLibrary();
            renderPool();
            renderRules();
          },
        },
        RATING_LABEL[r]
      )
    )
  );
}

function pingLoop() {
  watchLink((st) => {
    const p = $("ping");
    const changed = p.dataset.ok !== (st === "ok" ? "1" : "0") || p.dataset.link !== st;
    p.dataset.ok = st === "ok" ? "1" : "0";
    p.dataset.link = st;
    if (changed) p.querySelector("span").textContent = LINK_LABEL[st];
    if (changed) seat(p);
  });
}

/* ================= 字盒 ================= */

function renderLibraryChrome() {
  const tabs = $("suit-tabs");
  tabs.replaceChildren(
    el("button", { class: "suit-tab pressable", type: "button", "aria-pressed": ui.suit === "all" ? "true" : "false", onclick: (e) => pickSuit("all", e.currentTarget) }, "全部"),
    ...CARD_SUITS.map((s) =>
      el(
        "button",
        { class: "suit-tab pressable", type: "button", style: `--suit: var(--suit-${s})`, "aria-pressed": ui.suit === s ? "true" : "false", onclick: (e) => pickSuit(s, e.currentTarget) },
        el("b", { class: "suit-glyph", "aria-hidden": "true" }, CARD_SUIT_INFO[s].glyph),
        CARD_SUIT_INFO[s].zh
      )
    )
  );
  const q = $("lib-q");
  q.value = ui.query;
  q.oninput = () => {
    ui.query = q.value.trim();
    // 手機上字盒收著只露一排：開始找字就展開，找到的牌才看得到。
    if (ui.query) expandLibrary();
    q.closest(".lib-search").dataset.typing = ui.query ? "true" : "false";
    libBackToTop();
    renderLibrary();
  };
  q.onkeydown = libSearchKeys;
  q.onfocus = markEnterTarget;
  q.onblur = markEnterTarget;
  q.title = "Enter 放進第一張，↓ 走進字盒";
  $("lib-grid").onkeydown = libKeys;
  $("lib-toggle").onclick = () => {
    // 手機：字盒是抽屜，按鈕是「挑牌」。
    if (pickerMode()) return pickerOpen ? closePicker() : openPicker();
    ui.collapsed = !ui.collapsed;
    saveUi();
    syncCollapse();
  };
  syncCollapse();
}

/** 手機上字盒收著時展開（點花色、開始找字）。寬螢幕沒有收合，什麼都不做。 */
function expandLibrary() {
  if (pickerMode()) return;
  if (!ui.collapsed || !matchMedia("(max-width: 63.99rem)").matches) return;
  ui.collapsed = false;
  saveUi();
  syncCollapse();
}

function syncCollapse() {
  if (pickerMode()) {
    // 抽屜模式不用「收起／展開」：牌格永遠完整，收著時整個字盒只剩標題列。
    $("library").dataset.collapsed = "false";
    $("lib-toggle").textContent = "挑牌";
    $("lib-toggle").setAttribute("aria-expanded", pickerOpen ? "true" : "false");
    return;
  }
  $("library").dataset.collapsed = ui.collapsed ? "true" : "false";
  $("lib-toggle").textContent = ui.collapsed ? "展開全部" : "收起字盒";
  $("lib-toggle").setAttribute("aria-expanded", ui.collapsed ? "false" : "true");
}

/* ================= 手機：字盒變成挑牌抽屜 =================
 * 手機上字盒收著只露一排半、展開又是頁面裡再捲一層，兩層捲動很容易滑錯。
 * 改成：收著只剩標題列和一顆「挑牌」；按下去字盒本身從底部滑上來（幾乎全螢幕、背後一層暗幕），
 * 搜尋、花色、細分類、點牌、長按看詳情、拖曳都是原本那一套。底部一條「合成池 N 張・完成」，
 * 點牌時牌飛進這個數字。握把往下拉、iPhone 從左邊緣滑的「返回」、Esc、點暗幕都會收起來。
 * 只在手機寬度（≤ 40rem）；平板、桌面照舊。 */

const pickerMQ = matchMedia("(max-width: 40rem)");
let pickerOpen = false;
// 打開抽屜那一刻合成池裡有哪些牌：收起來時比一比，新放進去的那幾張要落定給人看（greetPicked）。
let pickerFrom = null;
let pickerHold = null;
const pickerMode = () => pickerMQ.matches;

function buildPicker() {
  const lib = $("library");
  const grip = el("div", { class: "picker-grip", "aria-hidden": "true" });
  lib.prepend(grip);
  const foot = el(
    "div",
    { class: "picker-foot" },
    el("span", { class: "picker-count", id: "picker-count" }),
    el("button", { class: "btn btn-primary picker-done", type: "button", onclick: () => closePicker() }, "完成")
  );
  lib.append(foot);
  const scrim = el("div", { class: "picker-scrim", id: "picker-scrim", hidden: true, onclick: () => closePicker() });
  lib.after(scrim);
  pickerHold = el("div", { class: "picker-hold", "aria-hidden": "true", hidden: true });
  lib.before(pickerHold);
  swipeDown(grip, lib);
  addEventListener("popstate", () => {
    if (pickerOpen) closePicker({ fromHistory: true });
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pickerOpen && !document.querySelector(".overlay")) closePicker();
  });
  pickerMQ.addEventListener?.("change", () => {
    if (!pickerMode() && pickerOpen) closePicker();
    syncCollapse();
  });
  updatePickerFoot();
}

function openPicker() {
  if (pickerOpen || !pickerMode()) return;
  pickerOpen = true;
  pickerFrom = new Set(pool);
  const lib = $("library");
  // 字盒離開版面（變成固定在底部的抽屜）時，原位墊一塊一樣高的空白：背後的頁面不會跳。
  pickerHold.style.height = lib.getBoundingClientRect().height + "px";
  pickerHold.hidden = false;
  document.body.dataset.picker = "open";
  document.documentElement.style.overflow = "hidden";
  lib.setAttribute("role", "dialog");
  lib.setAttribute("aria-modal", "true");
  $("picker-scrim").hidden = false;
  $("lib-toggle").setAttribute("aria-expanded", "true");
  try {
    history.pushState({ mochiPicker: true }, "");
  } catch {
    /* 不能動歷史紀錄就算了：照樣用按鈕收 */
  }
  updatePickerFoot();
  renderLibrary();
  if (!reducedMotion()) {
    lib.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: DUR.long, easing: css(CURVE.out) });
    $("picker-scrim").animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
  }
  lib.querySelector(".picker-done")?.focus({ preventScroll: true });
}

function closePicker({ fromHistory = false } = {}) {
  if (!pickerOpen) return;
  pickerOpen = false;
  const lib = $("library");
  const done = () => {
    if (pickerOpen) return;
    delete document.body.dataset.picker;
    document.documentElement.style.overflow = "";
    lib.removeAttribute("role");
    lib.removeAttribute("aria-modal");
    lib.style.transform = "";
    $("picker-scrim").hidden = true;
    pickerHold.hidden = true;
    $("lib-toggle").setAttribute("aria-expanded", "false");
    $("lib-toggle").focus({ preventScroll: true });
    greetPicked();
  };
  if (!fromHistory && history.state && history.state.mochiPicker) {
    try {
      history.back();
    } catch {
      /* 沒關係 */
    }
  }
  if (reducedMotion()) return done();
  const from = lib.style.transform || "none";
  const a = lib.animate([{ transform: from }, { transform: "translateY(100%)" }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" });
  $("picker-scrim").animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.short, easing: css(CURVE.exit), fill: "forwards" });
  const finish = () => {
    a.cancel();
    for (const x of $("picker-scrim").getAnimations()) x.cancel();
    done();
  };
  a.onfinish = finish;
  setTimeout(() => !pickerOpen && document.body.dataset.picker && finish(), DUR.short + 80);
}

/**
 * 抽屜收起來之後：這次挑進合成池的牌一張張微微浮起、落定（跟從卡冊帶來的同一種，幅度小一點）。
 * 以前抽屜一收，合成池就已經是新的樣子，看不出剛才放了哪幾張。畫面外的不動。
 */
function greetPicked() {
  const from = pickerFrom;
  pickerFrom = null;
  if (!from || reducedMotion()) return;
  const added = [...pool].filter((t) => !from.has(t)).map(poolNode).filter(Boolean);
  const seen = added.filter((n) => {
    const r = n.getBoundingClientRect();
    return r.width && r.bottom > 0 && r.top < innerHeight;
  });
  seen.slice(0, 12).forEach((n, i) =>
    n.animate(
      [{ transform: "translateY(-14px) scale(1.06)", filter: "brightness(1.12)" }, { transform: "none", filter: "none" }],
      { duration: DUR.long, delay: DUR.micro + i * 50, easing: css(CURVE.settle), fill: "backwards" }
    )
  );
}

/** 握把往下拉：超過 90px 或甩一下就收起，不到就彈回。 */
function swipeDown(grip, sheet) {
  let drag = null;
  const startOn = (node) => {
    node.addEventListener("pointerdown", (e) => {
      if (!pickerOpen || e.pointerType === "mouse") return;
      drag = { id: e.pointerId, y: e.clientY, t: performance.now(), dy: 0 };
      try {
        node.setPointerCapture(e.pointerId);
      } catch {
        /* 照樣處理 */
      }
    });
    node.addEventListener("pointermove", (e) => {
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
      if (dy > 90 || (dy > 24 && speed > 0.6)) return closePicker();
      if (dy && !reducedMotion()) sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.settle) });
      sheet.style.transform = "";
    };
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
  };
  startOn(grip);
  startOn(sheet.querySelector(".panel-head"));
}

function updatePickerFoot() {
  const n = $("picker-count");
  if (!n) return;
  const count = [...pool].filter((t) => lib.byTag.has(t)).length;
  const text = count ? `合成池 ${count} 張` : "合成池還是空的";
  if (n.textContent !== t(text)) {
    n.textContent = text;
    if (pickerOpen && !reducedMotion()) n.animate([{ transform: "translateY(5px)", opacity: 0.4 }, { transform: "none", opacity: 1 }], { duration: DUR.short, easing: css(CURVE.out) });
  }
}

/** 抽屜開著時放牌：牌的影子飛進底下那個「合成池 N 張」，數字彈一下（不跳「看合成池」提示）。 */
function tuckIntoPicker(tag, from) {
  const card = lib.byTag.get(tag);
  const target = $("picker-count");
  if (!card || !from || !from.width || !target || reducedMotion()) return;
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


function pickSuit(s, from) {
  const focused = document.activeElement === from;
  ui.suit = s;
  ui.group = "";
  if (s !== "all") expandLibrary();
  saveUi();
  libBackToTop(true);
  renderLibraryChrome();
  const selected = $("suit-tabs").querySelector('[aria-pressed="true"]');
  if (focused) selected?.focus({ preventScroll: true });
  seat(selected);
  dealLibrary = true;
  renderLibrary();
}

// 下一次畫字盒時，第一批牌要不要依序發進來（換花色、換小分類才要）。
let dealLibrary = false;

/** 字盒裡看不看得到：分級擋掉的、性別不合的、（只看這時代時）時代不合的收起來。釘選的字永遠看得到。 */
function visible(card) {
  if (pool.has(card.tag)) return true;
  if (ratingBlocked(card.item, settings.rating)) return false;
  if (card.gate === "male" && !settings.boy) return false;
  if (card.gate === "female" && !settings.girl) return false;
  if (ui.eraOnly && settings.eras.length === 1) {
    const e = settings.eras[0];
    if (!card.eras.includes("any") && !card.eras.includes(e)) return false;
  }
  return true;
}

// 「1328 / 1504」單看數字不知道在數什麼：字面寫「張」，滑過去說清楚少掉的去哪了。
function countLine(shown) {
  const total = lib.cards.length;
  const hid = { rating: 0, gender: 0, era: 0 };
  for (const c of lib.cards) {
    if (pool.has(c.tag)) continue;
    if (ratingBlocked(c.item, settings.rating)) hid.rating += 1;
    else if ((c.gate === "male" && !settings.boy) || (c.gate === "female" && !settings.girl)) hid.gender += 1;
    else if (!visible(c)) hid.era += 1;
  }
  const why = [
    hid.rating && `${hid.rating} 張被分級收起來`,
    hid.gender && `${hid.gender} 張是${settings.boy ? "女生" : "男生"}專用（${settings.boy ? "女生" : "男生"}沒開）`,
    hid.era && `${hid.era} 張不屬於這個時代`,
  ].filter(Boolean);
  const box = $("lib-count");
  settleText(box, `${shown} / ${total} 張`);
  box.title = `字盒共 ${total} 張，這裡顯示 ${shown} 張` + (why.length ? `。${why.join("、")}` : "") + (shown < total - hid.rating - hid.gender - hid.era ? "。其餘被花色、分類或搜尋篩掉" : "");
}

function renderLibrary() {
  const q = ui.query.toLowerCase();
  const inSuit = lib.cards.filter((c) => (ui.suit === "all" || c.suit === ui.suit) && visible(c) && genderOk(c));
  // 小分類晶片：只在選了某一種花色時出現
  const chips = $("group-chips");
  if (ui.suit === "all") {
    chips.hidden = true;
  } else {
    const runs = groupChips(inSuit);
    const count = runs.reduce((n, r) => n + r.items.length, 0);
    // 存檔裡的分類籤可能是改版前的小分類（例如 other），對不上就回到「全部」，不然整盒是空的。
    if (ui.group && !runs.some((r) => r.items.some((i) => i.g === ui.group))) ui.group = "";
    chips.hidden = count < 2;
    const chip = (i, inRun) =>
      el(
        "button",
        { class: "group-chip pressable", type: "button", "aria-pressed": ui.group === i.g ? "true" : "false", "aria-label": i.short === i.zh ? null : i.zh, onclick: (e) => pickGroup(i.g, e.currentTarget) },
        i.seal && !inRun ? el("b", { class: "chip-seal", "aria-hidden": "true" }, i.seal) : null,
        i.short
      );
    chips.replaceChildren(
      ...(ui.suit === "chara" ? [genderChips(ui.charGender, pickGender)] : []),
      el("button", { class: "group-chip pressable", type: "button", "aria-pressed": ui.group === "" ? "true" : "false", onclick: (e) => pickGroup("", e.currentTarget) }, "全部"),
      ...runs.map((r) =>
        r.fam
          ? el(
              "span",
              { class: "chip-run" },
              el("span", { class: "chip-fam", "aria-hidden": "true" }, r.seal ? el("b", { class: "chip-seal" }, r.seal) : null, r.fam),
              ...r.items.map((i) => chip(i, true))
            )
          : chip(r.items[0], false)
      )
    );
  }
  const list = inSuit.filter((c) => (!ui.group || c.group === ui.group) && cardMatches(c, q));
  countLine(list.length);
  const grid = $("lib-grid");
  const was = $("library").dataset.search;
  $("library").dataset.search = q ? (list.length ? "found" : "empty") : "idle";
  // 打到沒有符合的那一下，搜尋框輕輕搖頭（跟疊印台的找牌框一樣）。之後繼續打、仍然沒有，不再搖。
  if (q && !list.length && was !== "empty") refuse($("lib-q"));
  if (!list.length) {
    // 角色頁選了「男」，規則的「人物」卻沒開男生：男角色全被收起來了，說清楚，不要只寫「沒有字」。
    const offSide = ui.suit === "chara" && ((ui.charGender === "male" && !settings.boy) || (ui.charGender === "female" && !settings.girl));
    grid.replaceChildren(
      q ? libraryMiss(q)
        : offSide ? el("p", { class: "lib-empty" }, ui.charGender === "male" ? "規則的「人物」沒開男生，男角色都收起來了。" : "規則的「人物」沒開女生，女角色都收起來了。")
        : el("p", { class: "lib-empty" }, "這一格沒有字。")
    );
    markEnterTarget();
    return;
  }
  libList = list;
  libShown = 0;
  grid.replaceChildren();
  moreLibrary(LIB_FIRST);
  if (dealLibrary && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    [...grid.querySelectorAll(".card")].slice(0, 20).forEach((c, i) => {
      c.style.setProperty("--i", String(i));
      c.classList.add("dealt");
      setTimeout(() => c.classList.remove("dealt"), 900);
    });
  }
  dealLibrary = false;
  markEnterTarget();
}

/** 搜不到：說是被花色、分級、性別還是時代收起來的，並給一顆按鈕解開（lib-hint.js）。 */
function libraryMiss(q) {
  const shownBy = (c) => visible(c) && (ui.suit === "all" || c.suit === ui.suit) && (!ui.group || c.group === ui.group);
  const unlockRating = (c) => ["general", "sensitive", "explicit"].find((r) => !ratingBlocked(c.item, r)) || "explicit";
  const radio = (label, i) => $("rules").querySelectorAll(`[aria-label="${t(label)}"] [role="radio"]`)[i];
  return searchMiss({
    cards: lib.cards,
    q,
    query: ui.query,
    className: "lib-empty",
    reasons: [
      {
        hides: (c) => visible(c) && !shownBy(c),
        text: (c) => `「${c.zh}」在「${CARD_SUIT_INFO[c.suit]?.zh || c.suit}」裡`,
        label: () => "看全部",
        run: () => pickSuit("all"),
      },
      {
        hides: (c) => ratingBlocked(c.item, settings.rating),
        text: (c) => `「${c.zh}」要在「${RATING_LABEL[unlockRating(c)]}」才看得到`,
        label: (c) => `切到${RATING_LABEL[unlockRating(c)]}`,
        run: (c) => $("rating").querySelector(`[data-v="${unlockRating(c)}"]`)?.click(),
      },
      {
        hides: (c) => (c.gate === "male" && !settings.boy) || (c.gate === "female" && !settings.girl),
        text: (c) => `「${c.zh}」是${c.gate === "male" ? "男生" : "女生"}的牌`,
        label: () => "人物改成不限",
        run: () => radio("畫面裡有誰", 2)?.click(),
      },
      {
        hides: (c) => !visible(c),
        text: (c) => `「${c.zh}」不屬於現在的時代`,
        label: () => "顯示所有時代",
        run: () => {
          ui.eraOnly = false;
          saveUi();
          renderRules();
          renderLibrary();
        },
      },
    ],
  });
}

/** 搜尋框裡打了字：Enter 會放進合成池的那一張（第一張）描一圈。 */
function markEnterTarget() {
  const q = $("lib-q");
  setEnterTarget($("lib-grid"), document.activeElement === q && !!q.value.trim());
}

/**
 * 搜尋框：Enter 把第一張放進合成池（字全選著、接著打下一張）；↓ 走進字盒。
 * 已經在池裡的不拿出來，跳一下說它在了。
 */
function libSearchKeys(e) {
  if (e.key !== "Enter" && e.key !== "ArrowDown") return;
  if (e.isComposing || e.keyCode === 229) return; // 注音、倉頡選字的 Enter 不算
  e.preventDefault();
  const q = e.currentTarget;
  const grid = $("lib-grid");
  const first = grid.querySelector(".card[data-tag]");
  if (!first) return;
  if (e.key === "ArrowDown") return void focusLibCard(first);
  if (!q.value.trim()) return;
  const tag = first.dataset.tag;
  if (pool.has(tag)) {
    const n = poolNode(tag) || first;
    n.animate([{ translate: "0 0" }, { translate: "0 -6px" }, { translate: "0 0" }], { duration: DUR.medium, easing: css(CURVE.out) });
    toast(`「${lib.byTag.get(tag).zh}」已經在合成池裡`);
  } else if (bans.has(tag)) showCard(tag, "library");
  else {
    const from = first.getBoundingClientRect();
    pin(tag);
    flyInto(tag, from);
  }
  q.select();
}

/** 字盒只有一張牌在 Tab 順序裡（跟疊印台一樣），方向鍵在牌之間走。 */
function focusLibCard(card) {
  for (const c of $("lib-grid").querySelectorAll(".card[tabindex='0']")) c.tabIndex = -1;
  card.tabIndex = 0;
  card.focus();
}

function libKeys(e) {
  const grid = $("lib-grid");
  const cards = [...grid.querySelectorAll(".card")];
  const i = cards.indexOf(document.activeElement);
  if (i < 0) return;
  let cols = 1;
  const top = cards[0].offsetTop;
  while (cols < cards.length && cards[cols].offsetTop === top) cols++;
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: cards.length - 1 - i }[e.key];
  if (step === undefined) return;
  e.preventDefault();
  // 第一排再往上：回到搜尋框（跟搜尋框按 ↓ 走進字盒是一對）。
  if (e.key === "ArrowUp" && i < cols) return void $("lib-q").focus();
  const j = Math.max(0, Math.min(cards.length - 1, i + step));
  focusLibCard(cards[j]);
  if (j >= cards.length - 3 && libShown < libList.length) moreLibrary();
}

// 字盒一次畫 821 張牌（每張六七個節點＋一張圖）載入時會卡住主執行緒約 270ms，
// 而一開始看得到的只有二三十張。先畫一個畫面的份量，捲到快見底再接下一批。
const LIB_FIRST = 48;
const LIB_PAGE = 96;
let libList = [];
let libShown = 0;
let libObserver = null;

function moreLibrary(n = LIB_PAGE) {
  const grid = $("lib-grid");
  grid.querySelector(".lib-more")?.remove();
  const slice = libList.slice(libShown, libShown + n);
  libShown += slice.length;
  const nodes = slice.map((c) => libCard(c));
  for (const n of nodes) n.tabIndex = -1;
  grid.append(...nodes);
  if (!grid.querySelector(".card[tabindex='0']")) {
    const f = grid.querySelector(".card");
    if (f) f.tabIndex = 0;
  }
  if (libShown >= libList.length) return;
  const more = el("span", { class: "lib-more", "aria-hidden": "true" });
  grid.append(more);
  if (!libObserver) {
    libObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) moreLibrary();
    }, { rootMargin: "600px 0px" });
  }
  libObserver.disconnect();
  libObserver.observe(more);
}

/**
 * 換了花色、小分類、搜尋：字盒捲過頭就捲回來（細分類籤跟牌一起捲，見 styles.css 的 .lib-scroll）。
 *   all：換花色，連新的細分類籤一起看到（捲到最上面）。
 *   不然：牌格頂端露出來就好，籤捲走沒關係。
 * 那一層沒有在捲（display: contents 的寬度）就什麼都不做。
 */
function libBackToTop(all = false) {
  const box = $("lib-scroll");
  if (!box || box.scrollHeight <= box.clientHeight + 1) return;
  const top = all ? 0 : $("lib-grid").getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  if (box.scrollTop > top) box.scrollTop = top;
}

function pickGroup(g, from) {
  const focused = document.activeElement === from;
  ui.group = g;
  saveUi();
  libBackToTop();
  dealLibrary = true;
  renderLibrary();
  const selected = $("group-chips").querySelector('[aria-pressed="true"]:not([data-gender])');
  if (focused) selected?.focus({ preventScroll: true });
  seat(selected);
}

/** 角色頁的「性別：全部／女／男」。只是瀏覽篩選；畫面裡要不要有男生、女生是規則的「人物」開關。 */
const genderOk = (c) => ui.suit !== "chara" || !ui.charGender || c.gate === ui.charGender;

function pickGender(g, from) {
  if (ui.charGender === g) return;
  const focused = document.activeElement === from;
  ui.charGender = g;
  saveUi();
  libBackToTop();
  dealLibrary = true;
  renderLibrary();
  const selected = $("group-chips").querySelector(`[data-gender="${g}"]`);
  if (focused) selected?.focus({ preventScroll: true });
}

let hand = null;

/** 偏好卡牌（hand.js）：墨池自己一份，跟疊印台分開。 */
function buildHand() {
  hand = createHand({
    key: "mochi.hand.v1",
    makeNode: (t) => cardNode(lib.byTag.get(t), assets),
    blocked: (t) => (lib.byTag.get(t) && ratingBlocked(lib.byTag.get(t).item, settings.rating) ? "分級擋掉" : null),
    // 托盤的牌跟字盒的一樣大：量字盒上的一張。
    sample: () => $("lib-grid")?.querySelector(".card"),
    inPool: (t) => pool.has(t),
    known: (t) => lib.byTag.has(t) && !bans.has(t),
    // 出牌：從托盤上那張的位置飛進合成池。
    onPlay: (t, r) => {
      pin(t);
      if (r) flyInto(t, r);
    },
    onChange: () => {
      // 挑偏好卡牌跟丟廢字簍都是「點字盒的牌」：同時只能開一個。
      if (hand.editing && trashPanel?.isOpen) trashPanel.close();
      renderGoBar();
      hand.mark($("lib-grid"));
    },
    onFull: () => toast(`偏好卡牌最多 ${hand.max} 張，先拿掉一張再加`),
    onRemoved: (t, undo) => toast(`「${lib.byTag.get(t)?.zh || t}」拿出偏好卡牌`, { action: { label: "復原", key: "Z", run: undo } }),
    decorate: (node, t) => drag.attach(node, { tag: t, from: "hand" }),
  });
}

function libCard(card) {
  const node = cardNode(card, assets);
  paintState(node, card.tag);
  if (hand?.has(card.tag)) node.dataset.inHand = "true";
  node.addEventListener("click", () => {
    if (hand?.editing) return void hand.toggle(card.tag, node.getBoundingClientRect());
    // 廢字簍開著：點一下丟進去，再點一次撿回來（可以一直點，不用開關）。
    if (trashPanel?.isOpen) {
      if (bans.has(card.tag)) unban(card.tag);
      else ban(card.tag);
      return;
    }
    if (pool.has(card.tag)) unpin(card.tag);
    else if (bans.has(card.tag)) showCard(card.tag, "library");
    else {
      const from = node.getBoundingClientRect();
      pin(card.tag);
      flyInto(card.tag, from);
    }
  });
  node.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showCard(card.tag, "library");
  });
  node.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      ban(card.tag);
    }
  });
  drag.attach(node, () => ({ tag: card.tag, from: pool.has(card.tag) ? "pool" : "library" }));
  return node;
}

/** 字盒裡點一下：那張牌從原地飛進合成池。 */
/**
 * 牌飛進合成池。delay：晚一點才起飛；src：影子要複製的那張（從托盤出發時是托盤那張）；
 * startRotate：出發時的角度。from 是 null（看不到從哪裡來）：輪到它時原地冒出來。
 */
function flyInto(tag, from, { delay = 0, src = null, startRotate = 0, startScale = 1 } = {}) {
  const target = poolNode(tag);
  const slot0 = target?.closest(".pool-slot");
  const show = () => {
    poolInbound.delete(tag);
    const n = poolNode(tag);
    n?.closest(".pool-slot")?.style.setProperty("visibility", "");
    return n;
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !target) return void show();
  target.classList.remove("dropped");
  const to = target.getBoundingClientRect();
  // 合成池捲出畫面了（手機上從字盒底下、托盤出牌）：飛過去看起來像牌飛出螢幕。
  // 改成原地往合成池那個方向收進去，再說一聲、給一顆「看合成池」。
  if (pickerOpen) {
    show();
    return from ? tuckIntoPicker(tag, from) : undefined;
  }
  if (to.bottom < 0 || to.top > window.innerHeight || !to.width) {
    show();
    return from ? tuckAway(tag, from, to.top < 0 ? -1 : 1) : undefined;
  }
  if (!from) {
    // 沒有出發點：那一格藏到輪到它，再從底下冒出來。
    const tok = claimPoolInbound(tag);
    slot0?.style.setProperty("visibility", "hidden");
    setTimeout(() => {
      if (poolInbound.get(tag) !== tok) return;
      if (show()) popCarried(tag, 0);
    }, delay);
    return;
  }
  // 飛的是一張影子；池裡那一格（牌＋×）先藏著，影子落地才一起出現。路上池子重畫（又放了一張、
  // 帶進來的牌擠開位置）也一樣：renderPool 看 poolInbound 把新那格藏著，影子追的是新位置。
  const ghost = (src || target).cloneNode(true);
  ghost.classList.remove("dropped", "is-related", "is-clashing", "fav-card");
  ghost.style.visibility = "";
  const tok = claimPoolInbound(tag);
  slot0?.style.setProperty("visibility", "hidden");
  flight(ghost, from, () => poolNode(tag), {
    delay,
    startRotate,
    startScale,
    onLand: () => {
      // 飛的路上被拿走又放進來一次：舊影子落地時不能把新那趟還藏著的那一格亮出來。
      if (poolInbound.get(tag) !== tok) return;
      poolInbound.delete(tag);
      const n = poolNode(tag);
      const slot = n?.closest(".pool-slot");
      if (!n || !slot) return;
      slot.style.visibility = "";
      n.animate([{ scale: "1.04" }, { scale: "0.99" }, { scale: "1" }], { duration: DUR.short, easing: css(CURVE.out) });
      slot.querySelector(".pool-x")?.animate([{ opacity: 0, scale: "0.6" }, { opacity: 1, scale: "1" }], { duration: DUR.short, delay: 60, easing: css(CURVE.out), fill: "backwards" });
      // 落定的那一刻散一圈墨（跟拖曳放下同一個效果）。
      inkRing(n);
    },
  });
}

// 正在飛進合成池的牌（影子還沒落地）：這段時間重畫出來的那一格先藏著。值是這一趟的號碼。
const poolInbound = new Map();
let poolInboundSeq = 0;
function claimPoolInbound(tag) {
  const tok = ++poolInboundSeq;
  poolInbound.set(tag, tok);
  return tok;
}

/** 牌往合成池的方向（dir：-1 上、1 下）收進去：浮起一點、縮小、淡掉。 */
function tuckAway(tag, from, dir) {
  const card = lib.byTag.get(tag);
  if (!card || !from || !from.width) return;
  const f = cardNode(card, assets, { tagName: "div" });
  f.classList.add("flying");
  f.setAttribute("aria-hidden", "true");
  Object.assign(f.style, { position: "fixed", left: from.left + "px", top: from.top + "px", width: from.width + "px", margin: "0", zIndex: "90", pointerEvents: "none" });
  f.style.setProperty("--card-w", from.width + "px");
  document.body.append(f);
  f.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: `translateY(${dir * -10}px) scale(1.05)`, opacity: 1, offset: 0.25 },
      { transform: `translateY(${dir * 90}px) scale(0.5)`, opacity: 0 },
    ],
    { duration: DUR.long, easing: css(CURVE.in), fill: "forwards" }
  );
  setTimeout(() => f.remove(), 460);
  toast(`「${card.zh}」放進合成池`, {
    action: { label: "看合成池", run: () => $("pool-well").scrollIntoView({ behavior: "smooth", block: "center" }) },
  });
}

/** 浮空放大卡要的資料。 */
function peekInfo(node) {
  const card = lib.byTag.get(node.dataset.tag);
  if (!card) return null;
  const facts = cardFacts(card, lex, data).filter(([k]) => k !== "分級");
  if (pool.has(card.tag)) facts.unshift(["狀態", "在合成池裡：每張圖都會有"]);
  else if (bans.has(card.tag)) facts.unshift(["狀態", "在廢字簍裡：不會抽到"]);
  return {
    zh: card.zh,
    tag: card.tag,
    glyph: CARD_SUIT_INFO[card.suit].glyph,
    seal: card.seal,
    sealTitle: card.groupZh,
    suitColor: `var(--suit-${card.suit})`,
    art: assets.art(card.tag),
    rating: card.rating,
    facts: facts.slice(0, 5),
  };
}

function paintState(node, tag) {
  if (pool.has(tag)) {
    node.dataset.state = "pinned";
    setCardFlag(node, { kind: "pool", text: "池中" });
  } else if (bans.has(tag)) {
    node.dataset.state = "banned";
    setCardFlag(node, { kind: "ban", text: "封鎖" });
  } else {
    node.dataset.state = "";
    setCardFlag(node, null);
  }
}

function repaintLibrary() {
  for (const node of $("lib-grid").querySelectorAll(".card")) paintState(node, node.dataset.tag);
  hand?.mark($("lib-grid"));
}


/* ================= 釘選與封鎖（全部走 engine） ================= */

// 觸控時輕震一下（跟疊印台一樣）：放牌、抽牌。滑鼠不震；不支援的（iPhone）什麼都不做。
// 只在手指剛按下去的那一刻震（userActivation.isActive）：無限抽自己接著抽的那幾輪不震。
let lastPointer = "mouse";
document.addEventListener("pointerdown", (e) => (lastPointer = e.pointerType || "mouse"), true);
function haptic(ms) {
  if (lastPointer !== "touch" || !navigator.vibrate) return;
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  navigator.vibrate(ms);
}

function pin(tag) {
  if (HARD_BANNED.includes(tag)) return;
  haptic(8);
  const before = new Set(pool);
  const next = applyPin(lex, pool, bans, tag);
  pool = next.pinned;
  bans = next.userBanned;
  const gone = [...before].filter((t) => !pool.has(t));
  for (const t of gone) if (weights.has(t)) parkedWeights.set(t, weights.get(t));
  if (parkedWeights.has(tag)) {
    weights.set(tag, parkedWeights.get(tag));
    parkedWeights.delete(tag);
  }
  // 被擠掉的牌要看得到它離開：先記下它在池裡的位置，重畫之後在原地讓它掀起來飄走。
  const leaving = gone.map(poolNode).filter(Boolean).map((n) => ({ node: n, rect: n.getBoundingClientRect() }));
  // 後果寫在池子底下，不是右下角的提示：發生在哪裡就說在哪裡，旁邊給「換回」。
  poolNote = gone.length ? replaceNote(tag, gone) : null;
  const carriedIn = [...pool].filter((t) => t !== tag && !before.has(t));
  setTimeout(() => sfx.stamp(), LAND_SFX_MS);
  // 附帶的牌 200ms 起一張張跳出來（見下面 popCarried）：一張一個音，照音階往上。
  carriedIn.forEach((_, i) => setTimeout(() => sfx.carry(0), 200 + i * 90));
  if (gone.length) setTimeout(() => sfx.lift(), 90);
  commitPins(tag);
  leaving.forEach((l, i) => liftOut(l, i * 60));
  // 跟著進來的牌（implies）不是憑空出現：放的那張落定之後，一張接一張從底下彈上來。
  const carried = [...pool].filter((t) => t !== tag && !before.has(t));
  carried.forEach((t, i) => popCarried(t, 200 + i * 90));
  if (gone.length) announce(poolNote.text);
}

function popCarried(tag, delay) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const node = poolNode(tag);
  if (!node) return;
  node.animate(
    [
      { transform: "translateY(14px) scale(0.7)", opacity: 0 },
      { transform: "translateY(-3px) scale(1.04)", opacity: 1, offset: 0.7 },
      { transform: "none", opacity: 1 },
    ],
    { duration: DUR.medium, delay, easing: css(CURVE.out), fill: "backwards" }
  );
}

/** 換下來的原因：同一格（互斥）還是時代對不上。 */
function replaceNote(tag, gone) {
  const item = lex.byTag.get(tag);
  const eraOf = (it) => (it?.era || []).filter((e) => e !== "any");
  const clash = (o) => {
    const a = eraOf(item);
    const b = eraOf(lex.byTag.get(o));
    return a.length && b.length && !a.some((e) => b.includes(e));
  };
  // 沒有人物跟人物的牌互斥，不是「同一格」：分開講。
  const people = gone.filter((o) => tag === "no humans" || o === "no humans");
  const era = gone.filter((o) => !people.includes(o) && clash(o));
  const slot = gone.filter((o) => !people.includes(o) && !clash(o));
  const bits = [];
  if (people.length) bits.push(tag === "no humans" ? `畫面沒有人物：${people.map((t) => `「${zh(t)}」`).join("")}拿下來了` : "放了人物的牌：「沒有人物」拿下來了");
  if (slot.length) bits.push(`同一格只留一張：${slot.map((t) => `「${zh(t)}」`).join("")}換成「${zh(tag)}」`);
  if (era.length) bits.push(`${era.map((t) => `「${zh(t)}」`).join("")}跟「${zh(tag)}」不是同一個時代，先拿下來了`);
  return { text: bits.join("；"), back: gone[0] };
}

let poolNote = null;
// 上一次畫池子時相剋的牌：只有「剛變成相剋」的那幾張要抖。
let lastClash = new Set();

function renderPoolNote() {
  let box = $("pool-note");
  if (!box) {
    box = el("p", { class: "pool-note", id: "pool-note" });
    $("pool-well").after(box);
  }
  box.hidden = !poolNote;
  if (!poolNote) return box.replaceChildren();
  const back = poolNote.back;
  box.replaceChildren(
    el("span", {}, poolNote.text),
    back && lib.byTag.has(back)
      ? el("button", { class: "link-btn", type: "button", onclick: () => { poolNote = null; pin(back); } }, "換回")
      : null
  );
}

const poolNode = (tag) => [...$("pool-well").querySelectorAll(".card")].find((n) => n.dataset.tag === tag);

/**
 * 被擠出池子的牌：回到字盒裡它的位置（跟疊印台一樣）。字盒裡看不到它就飛向字盒那一欄；
 * 字盒整個不在畫面上才原地掀開飄走。以前一律往下飄走，看不出牌去了哪裡。
 */
function liftOut({ node, rect }, delay = 0) {
  const tag = node.dataset.tag;
  // 偏好卡牌：回到手上（托盤開著回那一格，收著收進標籤），由托盤自己演。
  if (hand?.has(tag)) return void hand.receive([{ node, rect }], { delay });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !rect.width) return;
  const inView = (r) => r && r.width > 0 && r.bottom > 0 && r.top < innerHeight;
  const homeNow = () => (hand?.has(tag) && hand.nodeOf(tag)) || libCardNode(tag);
  const home = homeNow();
  let to = home && home.getBoundingClientRect();
  const goingHome = inView(to);
  if (!goingHome) {
    const g = $("lib-grid").getBoundingClientRect();
    to = inView(g) ? { left: g.left + g.width / 2 - 20, top: Math.max(g.top, 0) + 20, width: 40 } : null;
  }
  if (to) {
    // 偏好卡牌的牌回托盤：托盤那一格先藏著，影子落地才亮（hand.reveal）。
    if (hand?.has(tag)) hand.arriveAt(tag, 1400);
    const ghost = node.cloneNode(true);
    ghost.classList.remove("is-related", "is-clash", "is-clashing", "dropped");
    // 追著落點飛：字盒捲動、托盤變寬都跟得上，落在那張牌上、壓一下。
    flight(ghost, rect, goingHome ? () => (inView(homeNow()?.getBoundingClientRect()) ? homeNow() : to) : to, {
      delay,
      tilt: 5,
      zIndex: 80,
      endOpacity: goingHome ? 1 : 0,
      onLand: () => {
        if (hand?.has(tag)) hand.reveal(tag);
        const h = goingHome && homeNow();
        if (h?.isConnected && !h.closest(".fav-hand")) h.animate([{ transform: "none" }, { transform: "translateY(3px) scale(0.96)" }, { transform: "translateY(-1px) scale(1.01)" }, { transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
      },
    });
    return;
  }
  const ghost = node.cloneNode(true);
  Object.assign(ghost.style, { position: "fixed", left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", margin: "0", zIndex: "80", pointerEvents: "none" });
  ghost.style.setProperty("--card-w", rect.width + "px");
  document.body.append(ghost);
  ghost.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: "translate(-18px, 26px) rotate(-10deg)", opacity: 0 },
    ],
    { duration: DUR.long, easing: css(CURVE.in), fill: "forwards" }
  );
  setTimeout(() => ghost.remove(), DUR.long + 20);
}

/** 給螢幕閱讀器的一句話（畫面上的回饋已經在發生的地方了）。 */
function announce(text) {
  const t = $("toast");
  if (!t) return;
  t.dataset.show = "false";
  t.textContent = "";
  setTimeout(() => (t.textContent = text), 30);
}

/** 拿出合成池。viaDrag：拖回字盒的那張由 drag.js 飛回去，這裡只讓它連帶的牌飛。 */
function unpin(tag, { viaDrag = false } = {}) {
  const before = new Set(pool);
  pool.delete(tag);
  for (const b of lex.byTag.get(tag)?.bind || []) pool.delete(b);
  const gone = [...before].filter((t) => !pool.has(t) && !(viaDrag && t === tag));
  // 拖回托盤的那張 drag.js 自己落下去，托盤那格立刻亮；其他的由 liftOut 的影子落地才亮。
  if (viaDrag && hand?.has(tag)) hand.arriveAt(tag, 0);
  // 以前按 × 牌就不見了：現在先記下位置，重畫之後從原地飛回字盒。
  // 影子跟重畫在同一個 task 裡做好（不用 setTimeout）：中間不會有一格牌不見了的空白。
  const leaving = gone.map(poolNode).filter(Boolean).map((n) => ({ node: n, rect: n.getBoundingClientRect() }));
  if (before.size !== pool.size) sfx.lift();
  commitPins();
  leaving.forEach((l, i) => liftOut(l, i * 60));
}

/** 丟進廢字簍。viaDrag：拖進去的那張 drag.js 已經演過被吸進去，這裡不重演。 */
function ban(tag, { viaDrag = false, from = null } = {}) {
  if (!lib.byTag.has(tag)) return;
  // 用按鈕或 Delete 封鎖的：牌從它現在的位置（池裡或字盒裡；從詳情按的就從那張大圖）轉著縮進廢字簍。
  const src = viaDrag ? null : from || ((n) => n && { node: n, rect: n.getBoundingClientRect() })(poolNode(tag) || libCardNode(tag));
  // 面板開著：牌飛進面板裡（落在它的位置、原尺寸），不是縮進右下角的簍子。
  const intoPanel = !!(trashPanel?.isOpen && src && src.rect.width && !reducedMotion());
  if (src && !intoPanel) flyToTrash(src);
  // 影子在蓋章之前複製（彩色的那張），路上才慢慢褪成灰。
  const ghost = intoPanel ? src.node.cloneNode(true) : null;
  if (hand?.has(tag)) hand.remove(tag, { quiet: true });
  // 揉紙聲在牌被吸進簍子的那一刻（拖的在放開後落進去，按的要先飛過去）。
  setTimeout(() => sfx.trash(), viaDrag ? DUR.short : DUR.long);
  const next = applyBan(lex, pool, bans, tag);
  pool = next.pinned;
  bans = next.userBanned;
  commitPins();
  renderTrash(true, { arriving: intoPanel ? tag : null });
  if (intoPanel) {
    ghost.classList.remove("dropped", "is-related", "is-clashing", "fav-card");
    ghost.style.visibility = "";
    const { duration } = flight(ghost, src.rect, () => trashPanel.nodeOf(tag), { arc: 70, tilt: -8, onLand: () => trashPanel.land(tag) });
    trashPanel.fade(ghost, duration);
  }
}

/** 牌轉著縮進右下角的廢字簍（跟拖進去的吸入同一個樣子）。 */
function flyToTrash({ node, rect }) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !rect.width) return;
  const bin = $("trash")?.getBoundingClientRect();
  if (!bin || !bin.width) return;
  const ghost = node.cloneNode(true);
  Object.assign(ghost.style, { position: "fixed", left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", margin: "0", zIndex: "80", pointerEvents: "none" });
  ghost.style.setProperty("--card-w", rect.width + "px");
  document.body.append(ghost);
  const dx = bin.left + bin.width / 2 - (rect.left + rect.width / 2);
  const dy = bin.top + bin.height / 2 - (rect.top + rect.height / 2);
  ghost.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(0.7) rotate(-14deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(-200deg)`, opacity: 0.2 },
    ],
    { duration: DUR.xl, easing: css(CURVE.travel), fill: "forwards" }
  );
  setTimeout(() => ghost.remove(), DUR.xl + 20);
}

function unban(tag) {
  if (!bans.delete(tag)) return;
  commitPins();
  renderTrash();
  sfx.lift();
  // 字盒那張撿回來的輕輕跳一下（看得出是哪張回來了）。面板開著的話由面板演：牌從面板飛回這一格。
  const n = libCardNode(tag);
  if (n && !trashPanel?.isOpen && !reducedMotion()) n.animate([{ scale: "1.08" }, { scale: "1" }], { duration: DUR.medium, easing: css(CURVE.settle) });
  announce(`「${zh(tag)}」撿回來了，之後又可能抽到`);
}

function commitPins(fresh) {
  // 不在合成池裡的牌不留份量（拿出去、被擠掉的；擠掉的另外記在 parkedWeights）。
  for (const t of [...weights.keys()]) if (!pool.has(t)) weights.delete(t);
  S.saveBans(bans);
  hand?.update();
  // 說明只講「剛剛那一步」：再動一次池子，舊的換下說明就收掉。
  if (!fresh) poolNote = null;
  // 池子整塊重畫：同一張牌從舊位置滑到新位置，不是一格一格跳（拿出一張、擠掉一張時最明顯）。
  flipBy($("pool-well"), ".pool-slot", (n) => n.querySelector(".card")?.dataset.tag, () => renderPool(fresh));
  renderPoolNote();
  repaintLibrary();
  renderTrash();
  renderGoFloat();
}

/** 調一張合成池裡的牌的份量：右下角的數字跳一下、蓋章聲。 */
function setWeight(tag, w) {
  if (!pool.has(tag)) return;
  if ((weights.get(tag) || 1) === w) return;
  if (w === 1) weights.delete(tag);
  else weights.set(tag, w);
  paintWeight(poolNode(tag), w, { pop: true });
  sfx.stamp?.();
}

function zh(tag) {
  return lib.byTag.get(tag)?.zh || lex.byTag.get(tag)?.zh || tag;
}

/* ================= 合成池 ================= */

/**
 * 從卡冊、疊印台帶牌過來：牌依序落進合成池（換版的錯開動畫之後接著落），並跳一行說從哪裡來的。
 * 以前是靜靜地出現在池子裡，看不出是剛帶過來的。
 */
function greetHandoff() {
  const from = { book: "卡冊", fuse: "疊印台", album: "作品冊" }[S.handoffFrom];
  if (!from || !pool.size) return;
  const cards = [...$("pool-well").querySelectorAll(".card")];
  if (!reducedMotion()) {
    cards.forEach((c, i) =>
      c.animate(
        [{ opacity: 0, transform: "translateY(-28px) rotate(-4deg) scale(0.92)" }, { opacity: 1, transform: "none" }],
        { duration: DUR.long, delay: DUR.short + Math.min(i, 10) * 45, easing: css(CURVE.settle), fill: "backwards" }
      )
    );
    setTimeout(() => sfx.deal?.(Math.min(6, cards.length + 1)), DUR.short);
  }
  setTimeout(() => toast(`從${from}帶來 ${pool.size} 張牌，已經放進合成池`), DUR.long);
}

function renderPool(fresh) {
  updatePickerFoot();
  const well = $("pool-well");
  const tags = [...pool].filter((t) => lib.byTag.has(t));
  settleText($("pool-count"), tags.length ? `${tags.length} 張會一定進圖` : "");
  $("pool-clear").hidden = !tags.length;
  if (!tags.length) {
    lastClash = new Set();
    renderPoolClash([]);
    well.replaceChildren(
      el(
        "div",
        { class: "pool-empty" },
        // 觸控裝置沒有「拖」這個第一直覺：寫點一下就放（拖也還是可以）。
        el("b", {}, pickerMode() ? "按上面的「挑牌」選牌放進來" : matchMedia("(hover: none)").matches ? "點字盒的牌放進來" : "把字拖進來"),
        // 一行就好：兩句操作說明（點字盒也能放、點 × 拿出來）做了就會發現，寫在這裡只是把合成池撐高。
        el("span", {}, "放進來的字，每一張圖都一定有；其他格子引擎補。"),
        // 手機上看詳情只有長按（沒有右鍵、沒有懸停），寫在第一次要放牌的這裡。
        matchMedia("(hover: none)").matches ? el("span", {}, "長按一張牌放開，可以看它的詳情。") : null
      )
    );
    return;
  }
  // 牌跟牌的關係（跟疊印台同一套 relationsOf）：誰帶誰進來、哪兩張放不到一起、活動配場地。
  // 以前池子是一排互不相干的牌：白背景帶進來的素色背景看不出是跟著來的；白背景配星空這種
  // 成立不了的組合也不吭聲，引擎悄悄摘掉一張，人只會覺得「我明明放了」。
  const inPool = new Set(tags);
  const carriedBy = {};
  for (const t of tags) {
    const it = lex.byTag.get(t);
    for (const d of [...(it?.implies || []), ...(it?.bind || [])]) {
      if (d !== t && inPool.has(d) && !carriedBy[d]) carriedBy[d] = t;
    }
  }
  const rels = relationsOf({ pins: tags, carried: carriedBy }, { lex, contradictions, actPlace: ACT_PLACE });
  const related = new Map();
  const clashing = new Set();
  const clashPairs = [];
  for (const r of rels) {
    for (const [x, y] of [[r.a, r.b], [r.b, r.a]]) {
      if (!related.has(x)) related.set(x, new Set());
      related.get(x).add(y);
    }
    if (r.kind === "clash") {
      clashing.add(r.a);
      clashing.add(r.b);
      clashPairs.push([r.a, r.b]);
    }
  }
  const newlyClashing = [...clashing].filter((t) => !lastClash.has(t));
  lastClash = clashing;
  well.replaceChildren(
    ...tags.map((t) => {
      const card = lib.byTag.get(t);
      const blocked = ratingBlocked(card.item, settings.rating);
      const node = eagerArt(cardNode(card, assets, { flag: blocked ? { kind: "ban", text: "分級擋掉" } : null, src: carriedBy[t] ? "附帶" : null }));
      if (t === fresh) node.classList.add("dropped");
      if (carriedBy[t]) node.title = `跟著「${zh(carriedBy[t])}」進來的`;
      if (clashing.has(t)) {
        node.classList.add("is-clash");
        // 剛變成相剋的那一刻抖一下；之後重畫池子（加別的牌）不再抖。
        if (newlyClashing.includes(t) && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          node.classList.add("is-clashing");
          setTimeout(() => node.classList.remove("is-clashing"), 460);
        }
      }
      // 指到一張牌：跟它有關係的牌（帶它進來的、它帶進來的、跟它相剋的、活動配的場地）一起亮。
      const mates = related.get(t);
      if (mates) {
        node.addEventListener("pointerenter", () => mates.forEach((m) => poolNode(m)?.classList.add("is-related")));
        node.addEventListener("pointerleave", () => mates.forEach((m) => poolNode(m)?.classList.remove("is-related")));
      }
      node.addEventListener("click", () => showCard(t, "pool"));
      drag.attach(node, { tag: t, from: "pool" });
      // 份量：右下角的數字；電腦上滑鼠停著滾滾輪、或 +／− 調（weights.js）。
      paintWeight(node, weights.get(t));
      wireWeightInput(node, { get: () => weights.get(t) || 1, set: (w) => setWeight(t, w) });
      node.title = node.title ? `${node.title}（滾輪或 +／− 調份量）` : "點開看詳情；滾輪或 +／− 調份量";
      return el(
        "div",
        { class: "pool-slot", style: poolInbound.has(t) ? "visibility: hidden" : undefined },
        node,
        el("button", { class: "pool-x pressable", type: "button", "aria-label": `把「${card.zh}」拿出合成池`, onclick: () => unpin(t) }, "×")
      );
    })
  );
  renderPoolClash(clashPairs);
}

/** 池子底下一行：哪兩張放不到一起（跟疊印台卡池上面那句同一個講法）。 */
function renderPoolClash(pairs) {
  let box = $("pool-clash");
  if (!box) {
    box = el("p", { class: "pool-clash", id: "pool-clash", role: "status" });
    $("pool-well").after(box);
  }
  box.hidden = !pairs.length;
  if (!pairs.length) return box.replaceChildren();
  const [a, b] = pairs[0];
  const more = pairs.length > 1 ? `（還有 ${pairs.length - 1} 組）` : "";
  box.replaceChildren(el("b", {}, "相剋"), `「${zh(a)}」跟「${zh(b)}」同時成立不了，引擎會摘掉其中一個${more}`);
}

/* ================= 規則 ================= */

function renderRules() {
  const box = $("rules");
  // 第一次畫：改過骨架格或服裝種類的話直接展開，不然設定藏在收起來的摺疊裡，
  // 看起來像不見了（專案主在手機上就找不到）。之後照使用者自己開關的狀態。
  const prev = box.querySelector(".more-rules");
  const customised =
    (settings.offGroups || []).length > 0 ||
    Object.keys(SKELETON).some((k) => Number(settings.counts?.[k]) > 0 && Number(settings.counts[k]) < skeletonCap(k));
  const moreOpen = prev ? prev.open : customised;
  const heatRow = el(
    "div",
    { class: "rule-field", role: "group", "aria-label": "尺度" },
    HEATS.map((h) =>
      el(
        "button",
        {
          class: "chip-toggle pressable",
          type: "button",
          dataset: { heat: h },
          "aria-pressed": settings.heats.includes(h) && !heatBlockedByRating(h, settings.rating) ? "true" : "false",
          // 分級擋掉的尺度跟主工具一樣變灰：這一級根本抽不到那種畫面。
          // 不用 disabled：手機沒有滑鼠停留的說明，點下去要有反應、說得出為什麼（explainBlockedHeat）。
          "aria-disabled": heatBlockedByRating(h, settings.rating) ? "true" : undefined,
          title: heatBlockedByRating(h, settings.rating) ? `${RATING_LABEL[settings.rating]}不會出現${HEAT_ZH[h]}` : undefined,
          onclick: (e) => {
            if (heatBlockedByRating(h, settings.rating)) return explainBlockedHeat(h, e.currentTarget, settings.rating);
            const focused = document.activeElement === e.currentTarget;
            setSettings({ heats: toggleHeat(settings.heats, h) });
            renderRules();
            const selected = $("rules").querySelector(`.chip-toggle[data-heat="${h}"]`);
            if (focused) selected?.focus({ preventScroll: true });
            seat(selected);
          },
        },
        HEAT_ZH[h]
      )
    )
  );
  const eraSel = el(
    "select",
    { class: "select", "aria-label": "時代" },
    el("option", { value: "mixed" }, "混合（每張隨機）"),
    ERAS.map((e) => el("option", { value: e }, ERA_LABELS[e]))
  );
  eraSel.value = settings.eras.length === 1 ? settings.eras[0] : "mixed";
  eraSel.onchange = () => {
    setSettings({ eras: eraSel.value === "mixed" ? [...ERAS] : [eraSel.value] });
    seat(eraSel);
    renderLibrary();
  };
  const who = settings.girl && settings.boy ? "any" : settings.boy ? "boy" : "girl";
  const whoRow = el(
    "div",
    { class: "segmented", role: "radiogroup", "aria-label": "畫面裡有誰" },
    [
      ["girl", "女"],
      ["boy", "男"],
      ["any", "不限"],
    ].map(([k, label]) =>
      el(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": who === k ? "true" : "false",
          onclick: (e) => {
            const focused = document.activeElement === e.currentTarget;
            setSettings({ girl: k !== "boy", boy: k !== "girl" });
            renderRules();
            const selected = $("rules").querySelector(`[aria-label="${t("畫面裡有誰")}"] [aria-checked="true"]`);
            if (focused) selected?.focus({ preventScroll: true });
            seat(selected);
            renderLibrary();
          },
        },
        label
      )
    )
  );
  const counts = el(
    "div",
    { class: "rule-field", role: "group", "aria-label": "每段抽幾個" },
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
  );
  // 數字比骨架少時，那一段在這裡展開選格（skeleton-picker.js）。
  const picker = skeletonPicker({ settings: () => settings, save: (patch) => setSettings(patch) });
  const sizeSel = el("select", { class: "select", "aria-label": "尺寸" }, SIZES.map((s) => el("option", { value: s.id }, s.zh)));
  sizeSel.value = (SIZES.find((s) => s.w === settings.width && s.h === settings.height) || SIZES[0]).id;
  sizeSel.onchange = () => {
    const s = SIZES.find((x) => x.id === sizeSel.value);
    setSettings({ width: s.w, height: s.h });
    seat(sizeSel);
  };
  const sceneSel = el("select", { class: "select", "aria-label": "場景合理度" }, SCENE_MODES.map((m) => el("option", { value: m }, SCENE_MODE_LABELS[m])));
  sceneSel.value = settings.sceneMode;
  sceneSel.onchange = () => { setSettings({ sceneMode: sceneSel.value }); seat(sceneSel); };
  const job = switchBox("抽職業", settings.drawJob, (v) => setSettings({ drawJob: v }));
  // 抽角色：照畫面上的人數、性別替每個人抽一張角色卡（一張最多三個）。加入系列名：角色後面接作品名，釘的角色也照這個。
  const chara = switchBox("抽角色", settings.drawCharacter, (v) => setSettings({ drawCharacter: v }), "照人數、性別替每個人抽一個角色，一張最多三個");
  const sameSeries = switchBox("只抽同系列", settings.characterSameSeries, (v) => setSettings({ characterSameSeries: v }), "抽的角色都跟釘的角色同一部作品；沒釘就先挑一部人數、性別湊得齊的");
  const series = switchBox("加入系列名", settings.characterSeries, (v) => setSettings({ characterSeries: v }), "角色後面接作品名（例：yor briar, spy x family）；釘的角色也一樣");
  const eraOnly = switchBox("字盒只看這個時代", ui.eraOnly, (v) => {
    ui.eraOnly = v;
    saveUi();
    renderLibrary();
  });

  box.replaceChildren(
    // 標籤跟它的控制項包成一組：窄畫面換行時整組一起走，不會出現「時代」掛在上一行尾、選單在下一行。
    el(
      "div",
      { class: "rule-row" },
      rulePair("尺度", heatRow),
      rulePair("時代", eraSel),
      rulePair("人物", whoRow),
      // 姿勢參考：人物照一張圖的姿勢擺（pose.js）。
      rulePair("姿勢", poseButton({ recent: poseRecent, wf: currentWorkflowId, rating: () => settings.rating, size: () => ({ w: settings.width, h: settings.height }) }))
    ),
    el(
      "details",
      { class: "more-rules", open: moreOpen },
      el("summary", { class: "pressable" }, "更多規則：每段張數與選格、尺寸、場景、職業、角色"),
      el(
        "div",
        {},
        el("div", { class: "rule-row" }, el("span", { class: "rule-label" }, "每段抽幾個"), counts),
        picker.node,
        el("div", { class: "rule-row" }, rulePair("尺寸", sizeSel), rulePair("場景", sceneSel), job, eraOnly),
        el("div", { class: "rule-row" }, rulePair("角色", el("span", { class: "rule-pair" }, chara, sameSeries, series)))
      )
    )
  );
}

/** 姿勢參考的「最近印的」：成品牆上印好的。 */
function poseRecent() {
  return shots.filter((s) => s.status === "done" && s.image && !s._gone).map((s) => ({ src: viewSrc(s.image), full: s.image }));
}

function rulePair(label, control) {
  return el("span", { class: "rule-pair" }, el("span", { class: "rule-label" }, label), control);
}

function stepper(label, value, min, max, onChange) {
  let v = value;
  const out = el("output", {}, v);
  const minus = el("button", { class: "pressable", type: "button", "aria-label": `${label}少一個` }, "−");
  const plus = el("button", { class: "pressable", type: "button", "aria-label": `${label}多一個` }, "＋");
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

function switchBox(label, on, onChange, hint) {
  const input = el("input", { type: "checkbox", role: "switch" });
  input.checked = !!on;
  input.onchange = () => onChange(input.checked);
  return el("label", { class: "switch", title: hint }, input, label);
}

/**
 * 分級擋掉的尺度被點了：牌搖一下、說為什麼，頂欄的分級亮一下指出要去哪裡換。
 * 墨池、疊印台共用（疊印台在規則面板裡）。
 */
function explainBlockedHeat(h, btn, rating) {
  refuse(btn);
  toast(`${RATING_LABEL[rating]}不會出現${HEAT_ZH[h]}：要用的話，先把頂端的分級換成「敏感」或「色情」`);
  const bar = $("rating");
  if (!bar || reducedMotion()) return;
  bar.classList.remove("is-hint");
  void bar.offsetWidth;
  bar.classList.add("is-hint");
  bar.addEventListener("animationend", () => bar.classList.remove("is-hint"), { once: true });
}

/* ================= 抽牌與生圖 ================= */

const tabNote = tabTitle();
// 頂欄的 Discord 鈕和送圖（init 裡掛上）。
let discord = null;

const generator = createGenerator({
  origin: "mochi",
  payload: (shot) => ({
    width: shot.width,
    height: shot.height,
    loras: shot.loras,
    ckpt: shot.ckpt,
    rating: shot.rating,
    workflowId: shot.workflowId,
    // 工作流面板裡改過的 steps／CFG（沒改就不送，伺服器用預設）。
    ...(shot.sampling || {}),
    // 姿勢參考（pose.js）：這張抽的時候選的那一份。
    ...(shot.pose ? { pose: shot.pose } : {}),
  }),
  update: (shot) => {
    tabNote.shot(shot, generator.pending);
    if (shot._heard !== shot.status) {
      if (shot.status === "done" && shot._heard) sfx.done();
      else if (shot.status === "failed") sfx.fail();
      shot._heard = shot.status;
    }
    updateShot(shot);
    discord?.shot(shot);
    // 拿到伺服器的工作編號就先存一次：畫到一半重新整理也接得回來。
    const newJob = shot.job && shot._savedJob !== shot.job;
    if (newJob) shot._savedJob = shot.job;
    if (newJob || shot.status === "done" || shot.status === "failed" || shot.status === "cancelled") S.saveShots(shots);
    renderGoBar();
  },
  idle: () => {
    looping = infinite && !stopAsked;
    renderGoBar();
    if (!looping) return;
    setTimeout(() => {
      looping = false;
      if (infinite && !stopAsked) drawBatch(true);
      else renderGoBar();
    }, 60);
  },
  stopped: (why) => {
    infinite = false;
    toast(why);
    renderGoBar();
  },
  // 網路斷了：佇列停在原地等，回來就接著印（見 gen.js waitOnline）。
  waiting: (on) => toast(on ? "連不到主機，網路回來就接著印…" : "網路回來了，接著印"),
});

// Hires：印好的那張放大、重畫細節，做好直接換掉牆上那張（見 hires.js）。
const hiresRun = createHires({
  origin: "mochi",
  update: (shot) => {
    updateShot(shot);
    // 做完、停掉、做壞了都存一次（做壞的那筆工作編號要從存檔拿掉，不然每次重新整理都再接一次）。
    if (!shot.hi || shot.hi.status === "failed") S.saveShots(shots);
  },
  save: () => S.saveShots(shots),
  done: (shot) => {
    discord?.hires(shot);
    sfx.hiresDone();
    toast(`Hires 好了：${shot.hires.width}×${shot.hires.height}`);
  },
});

function openHires(shot, btn) {
  if (!shot.image || shot.status !== "done") return refuse(btn);
  if (hiresBusy(shot)) {
    toast("這張正在 Hires，圖上可以停");
    return refuse(btn);
  }
  openHiresPicker(btn, shot, {
    onStart: (mode, scale) => {
      if (!hiresRun.start(shot, mode, scale)) return refuse(btn);
      sfx.hiresStart();
    },
    onRestore: () => {
      if (hiresRun.restore(shot)) {
        shot._hiresFresh = true;
        updateShot(shot);
        toast("換回原圖了");
      }
    },
  });
}

// 生圖種子那一組只建一次，每次重畫合成池底下那排時把同一個節點搬回去（輸入到一半不會被洗掉）。
let seedNode = null;

/** 抽牌那一列的狀態字：忙的時候講進度；閒著但「同一個人」開著卻沒作用時說一聲。 */
function goStatusText(busy = generator.busy || looping || drawingRounds > 0) {
  if (busy) return `${generator.pending ? `印製中，還有 ${generator.pending} 張` : "下一輪…"}${infinite ? "・無限抽開著" : ""}`;
  // 同一個人是「同一輪裡」第 2 張起才鎖長相：一次 1 張的時候開著也沒有作用。
  return settings.samePerson && settings.n < 2 ? "同一個人：一次 2 張以上才有作用" : "";
}

/** 只換狀態字，不整列重畫（改張數、開關的時候：重畫會把鍵盤焦點弄丟）。 */
function renderGoStatus() {
  const s = $("go-bar")?.querySelector(".go-status");
  if (s) s.textContent = goStatusText();
}

function renderGoBar() {
  const bar = $("go-bar");
  const busy = generator.busy || looping || drawingRounds > 0;
  const n = settings.n;
  // 狀態沒變就不重畫。生圖時每個進度事件都會叫到這裡，以前整排按鈕一秒換好幾次新的：
  // 滑鼠停在「停」上看起來在閃，按下去的那一瞬間按鈕剛好被換掉，按下跟放開落在兩個不同的
  // 元素上，瀏覽器不算一次點擊 —— 要按好幾次才停得下來。
  const key = [busy, generator.pending, infinite, n, settings.samePerson, hand ? hand.count : 0, hand?.open].join("|");
  if (bar.dataset.key === key && bar.childElementCount) return renderGoFloat();
  bar.dataset.key = key;
  bar.replaceChildren(
    ...[
    stepper("一次", n, 1, 50, (v) => {
      setSettings({ n: v });
      renderGoStatus();
    }),
    switchBox("無限抽", infinite, (v) => {
      infinite = v;
      if (!v) stopAsked = true;
    }, "抽完一輪自動接著抽下一輪，一直到按「停」"),
    switchBox("同一個人", settings.samePerson, (v) => {
      setSettings({ samePerson: v });
      renderGoStatus();
    }, "一次抽好幾張時，第 2 張起沿用第 1 張的長相：同一個角色換姿勢、換衣服"),
    el("span", { class: "go-status", "aria-live": "polite" }, goStatusText(busy)),
    el("span", { class: "spacer" }),
    busy ? el("button", { class: "btn", type: "button", onclick: stopAll }, "停") : null,
    el(
      "button",
      {
        class: "btn btn-ghost hand-btn",
        id: "hand-btn",
        type: "button",
        "aria-pressed": hand?.open ? "true" : "false",
        title: "偏好卡牌：挑最多十張常用的牌，攤在視窗底部，點一下就放進合成池",
        onclick: () => hand?.fromButton(),
        html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="8" height="12" rx="1.5" transform="rotate(-14 7 13)"/><rect x="8" y="5" width="8" height="12" rx="1.5"/><rect x="13" y="7" width="8" height="12" rx="1.5" transform="rotate(14 17 13)"/></svg><span>偏好卡牌</span><b>${hand ? hand.count : 0}/${hand ? hand.max : 10}</b>`,
      }
    ),
    el("button", { class: "btn btn-ghost", type: "button", onclick: () => drawBatch(false), title: "只抽牌，不送 Comfy（P）" }, "只抽牌"),
    el("button", { class: "btn btn-primary", type: "button", onclick: () => drawBatch(true), title: "抽並生圖（G）" }, "抽並生圖", el("span", { class: "count" }, `×${n}`)),
    // 自己一行，放在按鈕底下：不要把「抽並生圖」擠到下一行去。
    seedNode || (seedNode = mountSeedControl(null, { compact: true })),
    ].filter(Boolean)
  );
  renderGoFloat();
}

/* 捲到成品牆看圖時，合成池那排按鈕早就捲出畫面了。這條浮在底部，跟上面那排是同一組動作。 */
let goBarVisible = true;

function renderGoFloat() {
  const float = $("go-float");
  // IntersectionObserver 第一次回報可能比 boot() 讀完設定還早。
  if (!float || !settings) return;
  const busy = generator.busy || looping || drawingRounds > 0;
  // 手機：抽並生圖不在畫面上就浮出來，合成池空的也一樣（空的照樣能抽，浮動列寫「全靠抽」）。
  // Safari 的網址列、工具列吃掉一段高度，一打開主按鈕常常就在畫面外。
  const show = !goBarVisible && (shots.length > 0 || pool.size > 0 || pickerMQ.matches);
  float.dataset.show = show ? "true" : "false";
  float.inert = !show;
  // 同上：狀態沒變就不換掉底下那排按鈕（不然「停」會閃、按不到）。
  const key = [busy, generator.pending, pool.size, settings.n].join("|");
  if (float.dataset.key === key && float.childElementCount) return;
  float.dataset.key = key;
  float.replaceChildren(
    ...[
      el("span", { class: "go-float-state" }, busy ? (generator.pending ? `印製中・還有 ${generator.pending} 張` : "無限抽・下一輪…") : pool.size ? `池裡 ${pool.size} 張` : "池子是空的，全靠抽"),
      busy ? el("button", { class: "btn btn-small", type: "button", onclick: stopAll }, "停") : null,
      el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => drawBatch(false), title: "只抽牌（P）" }, "只抽牌"),
      el("button", { class: "btn btn-small btn-primary", type: "button", onclick: () => drawBatch(true), title: "抽並生圖（G）" }, "抽並生圖", el("span", { class: "count" }, `×${settings.n}`)),
    ].filter(Boolean)
  );
}

function watchGoBar() {
  const bar = $("go-bar");
  if (!bar || typeof IntersectionObserver !== "function") return;
  // 「看得到」看的是抽並生圖那顆主按鈕整顆在畫面裡，不是整排露一角就算：
  // 抽牌那排很高（張數、開關、按鈕、種子），以前露出最上面 4px 浮動列就收起來，主按鈕卻還在畫面外。
  // 牌排會整排重畫（主按鈕換新的），所以觀察整排、每 10% 回報一次，回報時再量主按鈕。
  const update = () => {
    const main = bar.querySelector(".btn-primary");
    const r = main && main.getBoundingClientRect();
    goBarVisible = !!(r && r.width && r.top >= 56 && r.bottom <= innerHeight - 8);
    renderGoFloat();
  };
  new IntersectionObserver(update, { threshold: Array.from({ length: 11 }, (_, i) => i / 10) }).observe(bar);
  addEventListener("resize", update, { passive: true });
}

function stopAll() {
  drawEpoch++;
  infinite = false;
  stopAsked = true;
  looping = false;
  generator.stop();
  renderGoBar();
}

let shotSeq = Date.now();
let drawQueue = Promise.resolve();
let drawEpoch = 0;
let drawingRounds = 0;

/** 抽一輪。合成池的字一定進；同一個人時，第二張起鎖住第一張的長相。 */
function drawBatch(gen) {
  // 原本整輪同步完成，途中設定不會被改。讓出畫面後仍用點下去那刻的同一份意圖。
  const intent = {
    settings: structuredClone(settings),
    pool: new Set(pool),
    bans: new Set([...bans, ...HARD_BANNED]),
    imageSeed: genSeed(null),
    shot: {
      width: settings.width, height: settings.height, rating: settings.rating,
      loras: structuredClone(currentLorasPayload()), ckpt: currentCkpt(), workflowId: currentWorkflowId(),
      sampling: currentSampling(), pose: currentPose(), trigger: currentTriggerText(),
      // 按下去那一刻合成池的份量：這一輪的每一張都用這一份。
      weights: Object.fromEntries(weights),
    },
  };
  const epoch = drawEpoch;
  // 連按仍各抽一輪，依序做；不能讓兩輪的同一個人、亂數與成品順序交錯。
  drawingRounds++;
  renderGoBar();
  const pending = drawQueue
    .then(() => epoch === drawEpoch ? drawBatchNow(gen, intent, epoch) : undefined)
    .finally(() => {
      drawingRounds--;
      renderGoBar();
    });
  drawQueue = pending.catch((err) => {
    console.error(err);
    toast("這一輪抽牌失敗，請再試一次");
  });
  return pending;
}

async function drawBatchNow(gen, intent, epoch) {
  stopAsked = false;
  haptic(gen ? 18 : 12);
  const n = intent.settings.n;
  let first = null;
  const made = [];
  let workStart = performance.now();
  for (let i = 0; i < n; i++) {
    if (epoch !== drawEpoch) break;
    const pins = new Set(intent.pool);
    const banned = new Set(intent.bans);
    if (intent.settings.samePerson && first) {
      for (const t of identityPins(lex, first)) pins.add(t);
      for (const t of identityBans(lex, first)) if (!pins.has(t)) banned.add(t);
    }
    const seed = randomSeed();
    const drawn = drawWithSeed(lex, intent.settings, pins, banned, seed, { trace: true });
    if (drawn.positive && String(drawn.positive).trim()) {
      if (!first) first = drawn.positive;
      // 抽牌種子每張隨機；固定的生圖種子跟這輪其他設定一起保存。
      made.push(makeShot(drawn, intent.imageSeed ?? seed, intent.pool, intent.shot));
    }
    if (i + 1 < n && performance.now() - workStart >= 8) {
      // 前景等一格，背景用 task；等的途中切到背景也有保底，不掛在 rAF 上。
      await new Promise((resolve) => {
        if (document.hidden) return setTimeout(resolve, 0);
        let finished = false, frame = 0, fallback = 0;
        const done = () => {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(frame);
          clearTimeout(fallback);
          resolve();
        };
        frame = requestAnimationFrame(done);
        fallback = setTimeout(done, 50);
      });
      workStart = performance.now();
    }
  }
  shots.unshift(...made.slice().reverse());
  // 卡冊的使用次數：每張新成品用了哪些牌。要在存成品之前記 —— 第一次會從存檔補算舊的，
  // 先存的話剛抽的這批會被算兩次。
  noteUses(made);
  if (!made.length) {
    if (epoch !== drawEpoch) return;
    refuse(document.activeElement?.closest?.("button") || $("go-bar"));
    toast("這一輪抽不出東西：合成池的字可能互相卡住，換一兩張試試");
    return;
  }
  sfx.deal(made.length > 1 ? made.length + 3 : 5);
  if (gen && epoch === drawEpoch) setTimeout(() => sfx.roll(), 160);
  const wall = $("wall");
  for (const shot of made.slice().reverse()) {
    const node = shotNode(shot, true);
    wall.prepend(node);
    // 一次抽很多張：由上往下一張接一張落下（像一疊印好的紙依序攤開），不要全部同一瞬間冒出來。
    // 前八張錯開，後面的跟第八張一起，整段不會拖太久。
    const v = made.indexOf(shot);
    enter(node, { delay: Math.min(v, 8) * (DUR.micro / 3) });
  }
  syncWallEmpty(true);
  trimWall();
  S.saveShots(shots);
  // 一次抽超過 80 張時，最舊的幾張剛做好就被 trimWall 裁掉了：只送還在牆上的。
  if (gen && epoch === drawEpoch) {
    for (const shot of made) if (shots.includes(shot)) generator.enqueue(shot);
    // 排進佇列之後再存一次：存檔才知道它們還排著（去別頁晃一下回來接著印）。
    S.saveShots(shots);
  }
  renderGoBar();
  document.getElementById("wall-head").scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "instant" : "smooth" });
}

/** 卡冊（book.html）的使用次數：一張新成品＝它用到的每張牌各一次。 */
function noteUses(list) {
  if (!list.length) return;
  recordUses(
    list.map((s) => ({ tags: [...s.mine, ...s.drawn.map((d) => d.tag)], mine: s.mine })),
    (t) => lib.byTag.has(t)
  );
}

function makeShot(drawn, seed, poolAtDraw, snapshot = null) {
  const source = new Map(((drawn.trace && drawn.trace.kept) || []).map((k) => [k.tag, k.source]));
  const inPos = new Set(String(drawn.positive).split(",").map((s) => s.trim()));
  const mine = [];
  const got = [];
  for (const sec of SECTION_ORDER) {
    for (const t of drawn.sections[sec] || []) {
      if (!lib.byTag.has(t)) continue;
      if (poolAtDraw.has(t)) mine.push(t);
      else got.push({ tag: t, src: source.get(t) || "random" });
    }
  }
  const missing = [...poolAtDraw].filter((t) => !inPos.has(t));
  const trigger = snapshot?.trigger ?? currentTriggerText();
  return {
    id: "s" + shotSeq++,
    seed,
    positive: insertTriggerAfterCast(weightPositive(drawn.positive, snapshot?.weights), trigger),
    mine,
    // 這張圖裡你選的牌調過的份量（成品上的小牌也標數字）。
    weights: Object.fromEntries(Object.entries(snapshot?.weights || {}).filter(([t]) => mine.includes(t))),
    drawn: got,
    missing,
    era: drawn.era,
    heat: drawn.heat,
    width: snapshot?.width ?? settings.width,
    height: snapshot?.height ?? settings.height,
    rating: snapshot?.rating ?? settings.rating,
    loras: snapshot?.loras ?? currentLorasPayload(),
    ckpt: snapshot?.ckpt ?? currentCkpt(),
    workflowId: snapshot?.workflowId ?? currentWorkflowId(),
    sampling: snapshot?.sampling ?? currentSampling(),
    pose: snapshot ? snapshot.pose ?? null : currentPose(),
    status: "drawn",
    note: "",
    image: null,
    at: new Date().toISOString(),
  };
}

function trimWall() {
  if (shots.length <= S.SHOT_MAX) return;
  const drop = shots.splice(S.SHOT_MAX);
  for (const s of drop) hiresRun.cancel(s);
  for (const s of drop) document.querySelector(`.shot[data-id="${s.id}"]`)?.remove();
  generator.drop(new Set(drop.map((s) => s.id)));
}

/* ================= 成品牆 ================= */

function setAllOpen(open) {
  for (const node of $("wall").children) node._setOpen && node._setOpen(open);
}

function syncWallEmpty(hasShots) {
  $("wall-empty").hidden = hasShots;
  const state = hasShots ? "true" : "false";
  const head = $("wall-head");
  if (head.dataset.hasShots !== state) head.dataset.hasShots = state;
}

function renderWall() {
  const tools = $("wall-tools");
  tools.replaceChildren(
    el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => setAllOpen(true) }, "全部展開"),
    el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => setAllOpen(false) }, "全部收起")
  );
  const wall = $("wall");
  wall.replaceChildren(...shots.map((s) => shotNode(s, false)));
  syncWallEmpty(shots.length > 0);
}

/**
 * 一張成品。有圖看圖、沒圖看字（跟導影台的成片卡同一個道理）：
 * 要送去印的，牌先收在「牌 · N」後面；只抽牌的沒有圖，牌就是成果，直接攤開。
 */
function shotNode(shot, deal) {
  const frame = el("div", { class: "shot-frame", style: `aspect-ratio: ${shot.width} / ${shot.height}` });
  // 點圖就放大（跟疊印台點成品一樣）。只點圖本身才算：只抽牌的那張沒有圖，點到牌扇不會誤開。
  frame.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("img")) showShot(shot);
  });
  const status = el("span", { class: "status" });
  // 沒有圖可看的（只抽牌、印壞、被停掉）直接攤開；有圖的牌收著，要看再點。
  const open = !shot.image && REPRINTABLE.has(shot.status);
  // 收著的那疊牌第一次打開才建：一張成品底下三十張牌、兩百個節點，
  // 牆上四十張就是七千多個看不到的節點，載入時白白排版一次（實測 50＋126ms 的長任務）。
  // 攤開的（只抽牌的）也一樣：剛抽的當場建；重新整理時整面牆一起畫的，捲到快看得到才建。
  let cards = open && deal ? shotCards(shot, false) : el("div", { class: "shot-cards" });
  let built = open && deal;
  cards.id = "cards-" + shot.id;
  let userToggled = false;
  cards.hidden = !open;
  const ensureCards = () => {
    if (built) return;
    built = true;
    const full = shotCards(shot, false);
    full.id = cards.id;
    full.hidden = cards.hidden;
    cards.replaceWith(full);
    cards = full;
  };
  let dealtOnce = !deal && open;
  const total = shot.mine.length + shot.drawn.length;
  const suits = CARD_SUITS.filter((s) => shot.drawn.some((d) => lib.byTag.get(d.tag)?.suit === s) || shot.mine.some((t) => lib.byTag.get(t)?.suit === s));
  const toggle = el(
    "button",
    { class: "shot-toggle pressable", type: "button", "aria-expanded": open ? "true" : "false", "aria-controls": cards.id, title: "展開／收起這張用到的牌" },
    el("span", { class: "mini", "aria-hidden": "true" }, suits.map((s) => el("i", { style: `--suit: var(--suit-${s})` }))),
    `牌 · ${total}`,
    el("span", { class: "chev", "aria-hidden": "true" })
  );
  const setOpen = (now) => {
    if (now) ensureCards();
    if (!now && !cards.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // 收起：牌往上收、淡掉，收完才藏 —— 以前是一瞬間消失，跟攤開時一張張發下來不對稱。
      toggle.setAttribute("aria-expanded", "false");
      const box = cards;
      box.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(-8px)" },
        ],
        { duration: DUR.micro, easing: css(CURVE.exit) }
      ).onfinish = () => {
        if (toggle.getAttribute("aria-expanded") === "false") box.hidden = true;
      };
      return;
    }
    cards.hidden = !now;
    toggle.setAttribute("aria-expanded", now ? "true" : "false");
    if (now) {
      if (!dealtOnce) {
        dealtOnce = true;
        replayDeal(cards);
      }
    }
  };
  toggle.addEventListener("click", () => {
    userToggled = true;
    // 看按鈕說的狀態，不看 hidden：收起的動畫還在跑時 hidden 仍是 false，連按第二下要能把它叫回來。
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  const node = el(
    "article",
    { class: "shot", dataset: { id: shot.id, status: shot.status } },
    frame,
    el(
      "div",
      { class: "shot-meta" },
      status,
      el("code", {}, seedUseButton(shot.seed)),
      el("span", {}, [ERA_LABELS[shot.era] || "", heatBlockedByRating(shot.heat, shot.rating) ? "" : HEAT_ZH[shot.heat] || ""].filter(Boolean).join("・"))
    ),
    cards,
    el(
      "div",
      { class: "shot-actions" },
      toggle,
      el(
        "button",
        {
          class: "btn btn-small btn-ghost shot-hires",
          type: "button",
          "aria-haspopup": "dialog",
          "aria-expanded": "false",
          title: "放大並重畫細節（快速／深度）",
          onclick: (e) => openHires(shot, e.currentTarget),
        },
        "Hires"
      ),
      // 收進作品冊（album.html）：印好了才出現。
      favButton(shot, { zh, persist: () => S.saveShots(shots) }),
      el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: (e) => copyPos(shot, e.currentTarget) }, "複製 POS"),
      el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => reprint(shot), title: "同樣的 POS、同一顆種子再送一次" }, "同種子重印"),
      el("button", { class: "btn btn-small btn-ghost shot-remove", type: "button", onclick: () => removeShot(shot) }, "撤下")
    )
  );
  node._setOpen = setOpen;
  // 就地送去印的那張，圖一出來就把自動攤開的牌收起來（使用者自己點開的不動）。
  node._imageArrived = () => {
    if (!userToggled && !cards.hidden) setOpen(false);
  };
  if (open && deal) setOpen(true);
  else if (open) whenNear(node, () => !cards.hidden && ensureCards());
  paintShot(node, shot);
  return node;
}

// 快捲到才做的事（一個 IntersectionObserver 顧整面牆）：提早一個半畫面開始。
const nearJobs = new WeakMap();
let nearObserver = null;
function whenNear(node, job) {
  if (typeof IntersectionObserver !== "function") return job();
  nearObserver ||= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        nearObserver.unobserve(e.target);
        const run = nearJobs.get(e.target);
        nearJobs.delete(e.target);
        run?.();
      }
    },
    { rootMargin: "150% 0px" }
  );
  nearJobs.set(node, job);
  nearObserver.observe(node);
}

function shotCards(shot, deal) {
  let i = 0;
  const dealt = (n) => {
    if (deal) {
      n.classList.add("dealt");
      n.style.setProperty("--i", String(i++));
    }
    return n;
  };
  const mineCards = shot.mine.map((t) => {
    const n = resultCard(t, null);
    paintWeight(n, shot.weights?.[t]);
    return dealt(n);
  });
  const missCards = (shot.missing || []).filter((t) => lib.byTag.has(t)).map((t) => {
    const n = resultCard(t, null, { kind: "ban", text: "沒進圖" });
    n.dataset.state = "gone";
    return dealt(n);
  });
  const bySuit = new Map();
  for (const d of shot.drawn) {
    const card = lib.byTag.get(d.tag);
    if (!card) continue;
    if (!bySuit.has(card.suit)) bySuit.set(card.suit, []);
    bySuit.get(card.suit).push(d);
  }
  // --n：這把扇子幾張（疊多緊由 CSS 照寬度算，見 styles.css 的 .fan）。
  const fans = CARD_SUITS.filter((s) => bySuit.has(s)).map((s) =>
    el("div", { class: "fan", dataset: { suit: s }, style: `--n: ${bySuit.get(s).length}`, "aria-label": CARD_SUIT_INFO[s].zh }, bySuit.get(s).map((d) => dealt(resultCard(d.tag, SRC_ZH[d.src] || null))))
  );
  return el(
    "div",
    { class: "shot-cards" },
    el("p", { class: "deal-label", dataset: { kind: "mine" } }, el("b", {}, "你選的"), shot.mine.length ? `${shot.mine.length} 張` : "這張沒有放字，全部是抽的"),
    mineCards.length || missCards.length ? el("div", { class: "deal-row" }, mineCards, missCards) : null,
    el("p", { class: "deal-label" }, el("b", {}, "抽到的"), `${shot.drawn.length} 張・拖進合成池就釘住，丟進廢字簍就封鎖`),
    el("div", { class: "fans" }, fans)
  );
}

function resultCard(tag, src, flag) {
  const card = lib.byTag.get(tag);
  const node = cardNode(card, assets, { src, flag });
  node.addEventListener("click", () => showCard(tag, "shot"));
  drag.attach(node, { tag, from: "shot" });
  return node;
}

function paintShot(node, shot) {
  const previousStatus = node.dataset.status;
  node.dataset.status = shot.status;
  if (previousStatus && previousStatus !== shot.status && (shot.status === "done" || shot.status === "failed")) seat(node);
  const frame = node.querySelector(".shot-frame");
  const src = viewSrc(shot.image) || shot.preview;
  if (shot._goneSrc && shot._goneSrc !== viewSrc(shot.image)) clearShotGone(shot, node);
  let img = frame.querySelector("img");
  if (src) {
    if (!img) {
      img = el("img", { alt: "成品", decoding: "async" });
      frame.prepend(img);
    }
    watchGone(img, (s) => {
      if (s === viewSrc(shot.image)) markShotGone(shot, node);
    });
    // 開頁面的檢查比這張畫框早問完（牆上的畫框捲到附近才建）：建出來時補上。
    if (shot._goneSrc && !node.dataset.gone) markShotGone(shot, node);
    if (img.getAttribute("src") !== src) {
      // 剛印好（上一幀還是預覽或空的）：像相紙泡進顯影液，由上往下浮出來。
      // Hires 換上來的大圖也一樣顯影：跟圖上那條由上往下掃的進度線接起來。
      const developing = shot.status === "done" && ((node.dataset.shown !== "done" && node.dataset.shown !== undefined) || shot._hiresFresh);
      shot._hiresFresh = false;
      const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      const prevSrc = img.getAttribute("src");
      // 上一幀墊在底下（.shot-under，排在主圖後面，querySelector("img") 拿到的還是主圖）。
      // 以前直接換 src：預覽之間新的一幀解碼時那格是空的；成品則是動畫先播、圖後到 ——
      // 遠端時成品還在路上，顯影播完了才硬跳出來。現在都等新的圖載好才開始。
      let under = frame.querySelector(".shot-under");
      if (prevSrc && motion) {
        if (!under) {
          under = el("img", { class: "shot-under", alt: "", "aria-hidden": "true" });
          frame.append(under);
        }
        under.src = shot._hiresUnder || prevSrc;
      }
      shot._hiresUnder = null;
      img.src = src;
      const start = () => {
        if (img.getAttribute("src") !== src) return; // 已經又換了下一幀
        if (developing && motion) {
          frame.classList.remove("is-developing");
          void frame.offsetWidth;
          frame.classList.add("is-developing");
          setTimeout(() => {
            frame.classList.remove("is-developing");
            if (img.getAttribute("src") === src) frame.querySelector(".shot-under")?.remove();
          }, 1300);
        } else if (motion && prevSrc) {
          img.classList.remove("is-pv-in");
          void img.offsetWidth;
          img.classList.add("is-pv-in");
        }
      };
      if (img.complete && img.naturalWidth) start();
      else img.addEventListener("load", start, { once: true });
    }
  } else if (img) img.remove();
  node.dataset.shown = shot.status;
  let empty = frame.querySelector(".shot-empty");
  const words = {
    drawn: "只抽了牌，還沒送去印",
    queued: shot.note || "排隊等印",
    running: shot.note || "印製中",
    failed: shot.note || "印壞了",
    cancelled: shot.note || "取消了",
    stopped: shot.note || "上次中斷了",
  };
  if (!src) {
    if (!empty) {
      empty = el("div", { class: "shot-empty" });
      frame.append(empty);
    }
    // paintShot 每一格進度都會呼叫；狀態和字沒變就不要重建那一手牌。
    const key = shot.status + "|" + (words[shot.status] || "");
    if (empty.dataset.key !== key) {
      empty.dataset.key = key;
      empty.replaceChildren(...draftFace(shot, words[shot.status] || ""));
    }
  } else if (empty) empty.remove();
  paintHiresVeil(frame, shot, { onCancel: () => hiresRun.cancel(shot), onDismiss: () => hiresRun.dismiss(shot) });
  node.querySelector(".fav-btn")?._paint?.();
  const hiBtn = node.querySelector(".shot-hires");
  if (hiBtn) {
    hiBtn.hidden = !(shot.status === "done" && shot.image);
    hiBtn.dataset.busy = hiresBusy(shot) ? "true" : "false";
  }
  let bar = frame.querySelector(".shot-progress");
  if (shot.status === "running") {
    if (!bar) {
      bar = el("div", { class: "shot-progress" }, el("i"));
      frame.append(bar);
    }
    bar.style.setProperty("--p", String(shot.progress || 0));
  } else if (bar) bar.remove();
  const status = node.querySelector(".shot-meta .status");
  status.dataset.kind = shot.status === "failed" ? "err" : "";
  settleText(status,
    shot.status === "done" ? (shot.hires ? `Hires ${HIRES_MODES[shot.hires.mode]?.zh || ""} ${shot.hires.width}×${shot.hires.height}` : "印好了") : shot.status === "running" ? shot.note || "印製中" : shot.status === "drawn" ? "只抽牌" : words[shot.status] || "");
}

const REPRINTABLE = new Set(["drawn", "failed", "cancelled", "stopped"]);

/** 沒有圖的畫框：只抽牌的攤一手牌，印壞的給一顆再印。 */
function draftFace(shot, text) {
  const out = [];
  if (shot.status === "drawn") out.push(draftHand(shot));
  out.push(el("p", {}, text));
  if (REPRINTABLE.has(shot.status)) {
    out.push(
      el(
        "button",
        { class: "btn btn-small " + (shot.status === "drawn" ? "btn-primary" : "btn-pool"), type: "button", onclick: () => printInPlace(shot) },
        shot.status === "drawn" ? "送去印這張" : "再印一次"
      )
    );
  }
  return out;
}

/** 一手牌：你放的先，再每種花色挑一張抽到的，最多七張，像握在手上那樣扇開。 */
function draftHand(shot) {
  const pick = [];
  const seen = new Set();
  const add = (t) => {
    if (pick.length >= 7 || seen.has(t) || !lib.byTag.has(t)) return;
    seen.add(t);
    pick.push(t);
  };
  for (const t of shot.mine.slice(0, 3)) add(t);
  for (const suit of CARD_SUITS) {
    const d = shot.drawn.find((x) => lib.byTag.get(x.tag)?.suit === suit && !seen.has(x.tag));
    if (d) add(d.tag);
  }
  for (const d of shot.drawn) add(d.tag);
  const n = pick.length;
  return el(
    "div",
    { class: "hand", "aria-hidden": "true" },
    pick.map((t, i) => {
      const card = lib.byTag.get(t);
      const art = assets.art(t);
      const off = i - (n - 1) / 2;
      return el(
        "span",
        { class: "hand-card", style: `--o:${off};--y:${off * off};--suit:var(--suit-${card.suit})` },
        art ? handArt(t) : el("b", {}, [...card.zh][0]),
        el("i", {}, card.zh)
      );
    })
  );
}

/** 手牌的插畫：跟牌面一樣照實際大小挑細縮圖（card-images.js），沒有就照舊用縮圖／原圖。 */
function handArt(tag) {
  const i = bindArt(el("img", { alt: "", decoding: "async", draggable: "false" }), assets.mini(tag), assets.sources(tag), "hand");
  i.addEventListener("error", () => artFallback(i));
  return i;
}

/* ================= 原檔不在了（gone.js） ================= */
// 專案主會手動刪 ComfyUI 輸出資料夾裡的圖。刪掉的那張不再是破圖：畫框換成一張說明，
// 給「照原樣再印」（同一格、同樣的牌與種子重新送印）跟「撤下」。暫時連不上 ComfyUI 不算。

function goneNote() {
  return el(
    "div",
    { class: "gone-note" },
    el("b", {}, "原檔不在了"),
    el("p", {}, "ComfyUI 的輸出資料夾裡找不到這張，可能被刪掉了。")
  );
}

function detailImg(shot, src) {
  const img = el("img", { src, alt: "成品" });
  watchGone(img, (s) => {
    if (s !== viewSrc(shot.image)) return;
    img.replaceWith(goneNote());
    const node = document.querySelector(`.shot[data-id="${shot.id}"]`);
    if (node) markShotGone(shot, node);
  });
  return img;
}

function markShotGone(shot, node) {
  if (shot.status !== "done" || !shot.image) return;
  shot._goneSrc = viewSrc(shot.image);
  node.dataset.gone = "true";
  const frame = node.querySelector(".shot-frame");
  if (!frame.querySelector(".shot-gone")) {
    const box = el(
      "div",
      { class: "shot-gone" },
      goneNote(),
      el(
        "div",
        { class: "shot-gone-acts" },
        el("button", { class: "btn btn-small btn-primary", type: "button", onclick: () => printAgain(shot) }, "照原樣再印"),
        el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => removeShot(shot) }, "撤下")
      )
    );
    frame.append(box);
    enter(box);
  }
  noteGone();
}

function clearShotGone(shot, node) {
  shot._goneSrc = null;
  delete node.dataset.gone;
  node.querySelector(".shot-gone")?.remove();
}

/** 原檔不在的那張：同一格、同樣的牌與種子重新送印（Hires 的結果不跟著）。 */
function printAgain(shot) {
  const node = document.querySelector(`.shot[data-id="${shot.id}"]`);
  if (node) clearShotGone(shot, node);
  Object.assign(shot, { status: "drawn", image: null, preview: null, note: "", hi: null, hires: null, baseImage: null });
  printInPlace(shot);
}

// 一次刪了好幾張：不要每張各跳一次提示，攢半秒說一次總數，給「全部撤下」。
let goneToast = 0;
function noteGone() {
  clearTimeout(goneToast);
  goneToast = setTimeout(() => {
    const gone = shots.filter((s) => s._goneSrc);
    if (!gone.length) return;
    toast(`有 ${gone.length} 張成品的原檔被刪了`, {
      action: {
        label: "全部撤下",
        run: () => {
          for (const s of shots.filter((x) => x._goneSrc)) removeShot(s);
        },
      },
    });
  }, 500);
}

/** 開頁面時把牆上印好的每一張問一遍：有快取的圖畫面看起來正常，但原檔可能早就刪了。 */
function sweepShots() {
  sweepGone(
    shots.filter((s) => s.status === "done" && s.image).map((s) => viewSrc(s.image)),
    (src) => {
      for (const s of shots) {
        if (s.status !== "done" || viewSrc(s.image) !== src) continue;
        const node = document.querySelector(`.shot[data-id="${s.id}"]`);
        if (node) markShotGone(s, node);
        else s._goneSrc = src;
      }
    }
  );
}

/** 同一張就地送去印（只抽牌的、印壞的、被停掉的），不另開一張新的。 */
function printInPlace(shot) {
  if (!REPRINTABLE.has(shot.status)) return;
  shot.note = "";
  shot.preview = null;
  generator.enqueue(shot);
  updateShot(shot);
  S.saveShots(shots);
  renderGoBar();
}

function updateShot(shot) {
  const node = document.querySelector(`.shot[data-id="${shot.id}"]`);
  if (node) paintShot(node, shot);
  if (node && shot.status === "done" && shot.image) node._imageArrived && node._imageArrived();
}

async function copyPos(shot, btn) {
  try {
    await navigator.clipboard.writeText(shot.positive);
    // 按鈕自己說「已複製」—— 眼睛本來就在按鈕上，右下角的提示常常沒被看到。
    if (btn) confirmButton(btn);
    else toast("POS 複製好了");
  } catch {
    refuse(btn);
    toast("複製不了，請點圖打開後手動選取");
  }
}

function reprint(shot) {
  // 重印的是原本的尺寸、原本的圖；Hires 的結果不跟著過去。
  const copy = { ...shot, id: "s" + shotSeq++, status: "drawn", image: null, preview: null, note: "", hi: null, hires: null, baseImage: null, at: new Date().toISOString() };
  shots.unshift(copy);
  noteUses([copy]);
  const node = shotNode(copy, true);
  flip($("wall"), () => $("wall").prepend(node));
  enter(node);
  const r = node.getBoundingClientRect();
  if (r.top < 0 || r.top > innerHeight - 80) node.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  trimWall();
  generator.enqueue(copy);
  S.saveShots(shots);
  renderGoBar();
}

function removeShot(shot) {
  if (shot.status === "running" || shot.status === "queued") {
    toast("這張還在印，先按「停」");
    return;
  }
  if (hiresBusy(shot)) {
    toast("這張正在 Hires，先在圖上按「停」");
    return;
  }
  const at = shots.findIndex((s) => s.id === shot.id);
  shots = shots.filter((s) => s.id !== shot.id);
  const node = document.querySelector(`.shot[data-id="${shot.id}"]`);
  // 縮掉、旁邊的滑過來補位（以前是整排一格一格跳過去），而且可以反悔：五秒內按「復原」放回原位。
  leave(node, () => flip($("wall"), () => node?.remove()));
  syncWallEmpty(shots.length > 0);
  S.saveShots(shots);
  renderGoFloat();
  // 印好的那張單獨撤下：出圖日誌記一筆「不要」（牌的戰績用）。
  if (shot.status === "done") markGenLog(shot.job, "discard");
  toast("撤下了一張", { action: { label: "復原", key: "Z", run: () => restoreShot(shot, at) } });
}

function restoreShot(shot, at) {
  if (shots.some((s) => s.id === shot.id)) return;
  if (shot.status === "done") markGenLog(shot.job, null);
  const i = Math.max(0, Math.min(at, shots.length));
  shots.splice(i, 0, shot);
  const node = shotNode(shot, false);
  const wall = $("wall");
  const next = shots[i + 1] && wall.querySelector(`.shot[data-id="${shots[i + 1].id}"]`);
  flip(wall, () => (next ? next.before(node) : wall.append(node)));
  enter(node);
  syncWallEmpty(true);
  S.saveShots(shots);
  renderGoFloat();
}

function showShot(shot) {
  sfx.open();
  const src = viewSrc(shot.image) || shot.preview;
  openSheet(
    `seed ${shot.seed}`,
    el(
      "div",
      { class: "lightbox" },
      shot._goneSrc ? goneNote() : src ? detailImg(shot, src) : el("p", { class: "pool-empty" }, "這張還沒有圖。"),
      el(
        "div",
        {},
        el("p", { class: "tag-en" }, [shot.hires ? `Hires ${shot.hires.width}×${shot.hires.height}（原圖 ${shot.width}×${shot.height}）` : shot.width + "×" + shot.height, RATING_ZH[shot.rating], ERA_LABELS[shot.era]].filter(Boolean).join("・")),
        el("pre", { class: "pos-text" }, shot.positive),
        // 做過 Hires：提示詞底下一張示意圖，點開左右拉動比較（compare.js）。
        compareThumb(shot)
      )
    ),
    {
      wide: true,
      foot: [
        favButton(shot, { zh, persist: () => (S.saveShots(shots), $("wall").querySelector(`.shot[data-id="${shot.id}"] .fav-btn`)?._paint?.()), className: "btn btn-small" }),
        el("button", { class: "btn btn-small", type: "button", onclick: (e) => copyPos(shot, e.currentTarget) }, "複製 POS"),
        shot.image ? el("a", { class: "btn btn-small", href: shot.image, target: "_blank", rel: "noopener" }, "開原圖") : null,
      ],
    }
  );
}

/* ================= 單張牌的詳情 ================= */

function showCard(tag, from) {
  const card = lib.byTag.get(tag);
  if (!card) return;
  const srcNode = from === "pool" ? poolNode(tag) : from === "library" ? libCardNode(tag) : null;
  // 詳情裡那張大圖目前的位置（按鈕要讓牌從這裡飛去合成池／廢字簍）。
  const artNow = () => {
    const n = sheet.sheet.querySelector(".detail-art, .detail > .card");
    return n ? { node: n, rect: n.getBoundingClientRect() } : null;
  };
  const art = assets.art(tag);
  const facts = cardFacts(card, lex, data);
  const inPool = pool.has(tag);
  const banned = bans.has(tag);
  const sheet = openSheet(
    card.zh,
    el(
      "div",
      { class: "detail" },
      // 合成池裡的牌：最上面一排份量，橫跨整個寬度（手機調份量的地方；電腦也可以在牌上滾滾輪）。
      // 以前擠在右欄：手機上右欄只剩約 250px，五顆數字放不下、1.4 超出彈窗被切掉。
      inPool ? weightRow(weights.get(tag) || 1, (w) => setWeight(tag, w), el) : null,
      art ? el("div", { class: "detail-art" }, el("img", { src: art, alt: card.zh })) : cardNode(card, assets, { tagName: "div" }),
      el(
        "div",
        {},
        // 英文版的標題就是 tag：不再印一次。
        english ? null : el("p", { class: "tag-en" }, card.tag),
        el("dl", {}, facts.map(([k, v]) => [el("dt", {}, k), el("dd", {}, v)]))
      )
    ),
    {
      foot: [
        hand && !banned
          ? el(
              "button",
              {
                class: "btn btn-ghost",
                type: "button",
                onclick: () => {
                  sheet.close();
                  if (hand.has(tag)) hand.remove(tag);
                  else if (hand.add(tag)) toast(`「${card.zh}」加進偏好卡牌`);
                },
              },
              hand.has(tag) ? "從偏好卡牌拿掉" : "加入偏好卡牌"
            )
          : null,
        banned
          ? el("button", { class: "btn", type: "button", onclick: () => { unban(tag); sheet.close(); } }, "從廢字簍撿回來")
          : el("button", { class: "btn", type: "button", onclick: () => { const a = artNow(); sheet.close(); ban(tag, { from: a }); } }, "丟進廢字簍（不再抽到）"),
        inPool
          ? el("button", { class: "btn btn-pool", type: "button", onclick: () => { unpin(tag); sheet.close(); } }, "拿出合成池")
          : el("button", { class: "btn btn-primary", type: "button", onclick: () => { const a = artNow(); sheet.close(); pin(tag); if (a) flyInto(tag, a.rect); } }, "放進合成池"),
      ],
    }
  );
  flyToDetail(srcNode, sheet.sheet);
}

/** 打開詳情：圖從點的那張牌飛進彈窗裡的大圖（落點量的是彈窗進場動畫結束後的位置）。 */
function flyToDetail(src, sheetEl) {
  if (!src || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dst = sheetEl.querySelector(".detail-art, .detail > .card");
  const from = (src.querySelector(".card-art") || src).getBoundingClientRect();
  if (!dst || !from.width || from.bottom < 0 || from.top > innerHeight) return;
  const anims = sheetEl.getAnimations();
  for (const a of anims) a.currentTime = a.effect.getComputedTiming().endTime;
  const to = dst.getBoundingClientRect();
  for (const a of anims) a.currentTime = 0;
  if (!to.width) return;
  const f = (src.querySelector(".card-art") || src).cloneNode(true);
  // 複製品直接放在落點、用落點的大小，從起點「縮放＋位移」過去（FLIP）。以前動的是
  // left／top／width／height，每一格都要排版，生圖時主執行緒一忙就掉格；transform 交給合成器。
  // 用大的尺寸往小的縮，圖不會在放大途中糊掉。
  Object.assign(f.style, { position: "fixed", left: to.left + "px", top: to.top + "px", width: to.width + "px", height: to.height + "px", margin: "0", zIndex: "200", pointerEvents: "none", overflow: "hidden", borderRadius: "6px", transformOrigin: "0 0", willChange: "transform" });
  document.body.append(f);
  dst.style.visibility = "hidden";
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  const anim = f.animate(
    [
      { transform: `translate(${(from.left - to.left).toFixed(1)}px, ${(from.top - to.top).toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})` },
      { transform: "none" },
    ],
    { duration: DUR.long, easing: css(CURVE.out), fill: "forwards" }
  );
  const land = () => {
    f.remove();
    dst.style.visibility = "";
  };
  anim.onfinish = land;
  setTimeout(land, 700);
}

/* ================= 廢字簍 ================= */

function renderTrash(bump, { arriving = null } = {}) {
  const t = $("trash");
  t.querySelector("b").textContent = bans.size;
  t.setAttribute("aria-label", `廢字簍：封鎖了 ${bans.size} 個字，點開可以一直點字盒的牌丟進來`);
  trashPanel?.sync([...bans].filter((x) => lib.byTag.has(x)), { arriving });
  if (bump && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    t.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: DUR.short, easing: css(CURVE.out) });
  }
}

let trashPanel = null;

/** 廢字簍的面板（trash-panel.js）：不擋畫面，開著的時候點字盒的牌就丟進來。 */
function buildTrashPanel() {
  trashPanel = createTrashPanel({
    anchor: $("trash"),
    makeNode: (t) => cardNode(lib.byTag.get(t), assets),
    onRescue: (t) => unban(t),
    homeOf: (t) => libCardNode(t),
    onRescueAll: () => {
      if (!bans.size) return;
      const was = [...bans];
      bans = new Set();
      commitPins();
      renderTrash();
      sfx.lift();
      toast(`${was.length} 個字都撿回來了`, {
        action: {
          label: "復原",
          key: "Z",
          run: () => {
            bans = new Set([...was.filter((x) => lib.byTag.has(x)), ...bans]);
            commitPins();
            renderTrash(true);
          },
        },
      });
    },
    onToggle: (open) => {
      if (open && hand?.editing) hand.toggleEdit(false);
      if (open) sfx.lift();
    },
    decorate: (node, t) => drag.attach(node, { tag: t, from: "trash" }),
  });
}

/* ================= 拖曳 ================= */

const libCardNode = (tag) => [...$("lib-grid").querySelectorAll(".card")].find((n) => n.dataset.tag === tag) || null;

const drag = createDrag({
  zones: () => [
    // 偏好卡牌：字盒、合成池的牌都可以拖進來（托盤浮在卡池上面，所以排第一個先認；池裡的等於收回手牌）。
    // 托盤上的牌拖一拖又放回托盤：當作沒拖（不能穿過托盤掉到底下的卡池）。
    { id: "hand", el: hand?.el, accepts: (p) => !!hand && p.from !== "trash" },
    // 面板開著：拖進面板也是丟進廢字簍（落在面板裡那一格）。
    { id: "trash-panel", el: trashPanel?.el, accepts: (p) => !!trashPanel?.isOpen && p.from !== "trash" },
    { id: "pool", el: $("pool-well"), accepts: (p) => p.from !== "pool" },
    // 丟進廢字簍：影子縮小、轉著被吸進去（drag.js 的 sink）。
    { id: "trash", el: $("trash"), accepts: (p) => p.from !== "trash", sink: true },
    { id: "library", el: $("library"), accepts: (p) => p.from === "pool" || p.from === "hand" || p.from === "trash" },
  ],
  // 拖著經過托盤：要插進去的那一格先空出來。
  onMove: (zone, p, x) => hand?.hover(zone === "hand" ? x : null, p.tag),
  // 回傳落點：影子飛到那張牌的位置落下（drag.js）。
  onHold: (p) => showCard(p.tag, p.from === "pool" || p.from === "library" ? p.from : null),
  onDrop: (p, zone, at) => {
    if (zone === "hand") {
      // 放在哪就插在哪（托盤上的牌＝換位置）；滿了收不下，影子彈回原位。
      if (!hand.drop(p.tag, at?.x)) return false;
      if (p.from === "pool") {
        hand.arriveAt(p.tag, 0);
        unpin(p.tag, { viaDrag: true });
      }
      return hand.nodeOf(p.tag);
    }
    if (zone === "library" && p.from === "hand") {
      hand.remove(p.tag, { quiet: true });
      return libCardNode(p.tag);
    }
    if (zone === "pool") {
      if (bans.has(p.tag)) bans.delete(p.tag);
      pin(p.tag);
      return poolNode(p.tag);
    }
    if (zone === "trash-panel") {
      ban(p.tag, { viaDrag: true });
      announce(`「${zh(p.tag)}」丟進廢字簍了，之後不會抽到`);
      return trashPanel.nodeOf(p.tag);
    }
    if (zone === "library" && p.from === "trash") {
      unban(p.tag);
      return libCardNode(p.tag);
    }
    if (zone === "trash") {
      // 廢字簍自己會跳一下、數字加一；畫面上不用再多一個提示。
      ban(p.tag, { viaDrag: true });
      announce(`「${zh(p.tag)}」丟進廢字簍了，之後不會抽到`);
      return null;
    }
    if (zone === "library") {
      unpin(p.tag, { viaDrag: true });
      return libCardNode(p.tag);
    }
    return null;
  },
});

/* ================= 鍵盤 ================= */

function onKey(e) {
  if (handleLoraKeys(e) || wfHandleKeys(e) || discord?.keys(e)) return;
  if (anyOverlay() || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  if (e.key === "g" || e.key === "G") {
    e.preventDefault();
    drawBatch(true);
  } else if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    drawBatch(false);
  } else if (e.key === "Escape" && trashPanel?.isOpen) {
    trashPanel.close();
    $("trash").focus({ preventScroll: true });
  } else if (e.key === "Escape" && (generator.busy || looping || drawingRounds > 0)) {
    stopAll();
  } else if ((e.key === "z" || e.key === "Z") && runToastAction("Z")) {
    // 提示上有「復原」（清空合成池、撤下成品、拿出偏好卡牌）：Z 就是按它。
    e.preventDefault();
  } else if (e.key === "/") {
    e.preventDefault();
    $("lib-q").focus();
  }
}

watchGoBar();
// 聲音開關（跟疊印台同一個設定）。
{
  const snd = $("sound-btn");
  const syncSound = () => {
    snd.setAttribute("aria-pressed", sfx.on ? "true" : "false");
    const label = sfx.on ? "聲音：開（點一下關掉）" : "聲音：關（點一下打開）";
    snd.setAttribute("aria-label", label);
    snd.title = label;
    snd.innerHTML = sfx.on
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>`;
  };
  syncSound();
  snd.addEventListener("click", () => {
    sfx.on = !sfx.on;
    syncSound();
    if (sfx.on) sfx.deal(3);
  });
}
$("trash").addEventListener("click", () => trashPanel?.toggle());
$("trash").setAttribute("aria-controls", "trash-panel");
$("trash").setAttribute("aria-expanded", "false");
$("trash").innerHTML = ICONS.trash + "<b>0</b><span>廢字簍</span>";
// 牌組：合成池存成一組、或套用存過的（decks.js；伺服器上一份，手機電腦共用）。
$("pool-decks").addEventListener("click", () =>
  openDecks({ where: "合成池", current: () => [...pool], weightsNow: () => Object.fromEntries(weights), has: (t) => lib.byTag.has(t), zh, apply: applyDeck, paste: () => openPastePool() })
);

// 貼上提示詞變成牌（paste-prompt.js）：合成池旁的「貼上」、牌組面板裡、電腦上在空白處按 Ctrl+V。
function openPastePool(text = "") {
  if (!data || !lib) return;
  openPaste({
    where: "合成池",
    text,
    lexTags: data.tags.map((t) => t.tag),
    banned: data.characterBan || [],
    isCard: (t) => lib.byTag.has(t),
    zh,
    apply: (tags, { replace, weights: w }) => applyCards(tags, { replace, label: "貼上的提示詞", weights: w }),
    // 合成池照樣收（牌上蓋「分級擋掉」、抽的時候不用），預覽先說。
    off: (t) => (ratingBlocked(lib.byTag.get(t).item, settings.rating) ? `${RATING_LABEL[settings.rating]}用不了` : bans.has(t) ? "在廢字簍" : null),
  });
}
$("pool-paste").addEventListener("click", () => openPastePool());
listenPaste((text) => {
  if (!pickerOpen) openPastePool(text);
});

const applyDeck = (deck) => applyCards(deck.tags, { replace: true, label: `牌組「${deck.name}」`, weights: deck.weights || {} });

/**
 * 放一組牌進合成池：replace 是換成這一組（牌組、貼上的「換成」），不然加在現在的後面。
 * 照放牌的規矩一張張釘上去（同一格、時代不合的互相讓，帶上該帶的），跟手放的結果一樣；
 * 新來的牌從上面輕輕落定。五秒內可以復原成原本的合成池。
 */
function applyCards(tags, { replace = true, label = "", weights: w = {} } = {}) {
  const before = { pool: [...pool], bans: [...bans], weights: new Map(weights) };
  let pinned = replace ? new Set() : new Set(pool);
  let banned = new Set(bans);
  for (const t of tags) {
    if (HARD_BANNED.includes(t) || !lib.byTag.has(t)) continue;
    const r = applyPin(lex, pinned, banned, t);
    pinned = r.pinned;
    banned = r.userBanned;
  }
  pool = pinned;
  bans = banned;
  if (replace) weights = new Map();
  for (const [t, v] of Object.entries(w)) if (pool.has(t) && v !== 1) weights.set(t, v);
  poolNote = null;
  const fresh = new Set([...pool].filter((t) => replace || !before.pool.includes(t)));
  commitPins();
  if (!reducedMotion()) {
    [...$("pool-well").querySelectorAll(".card")].filter((c) => fresh.has(c.dataset.tag)).forEach((c, i) =>
      c.animate(
        [{ opacity: 0, transform: "translateY(-22px) rotate(-3deg) scale(0.94)" }, { opacity: 1, transform: "none" }],
        { duration: DUR.long, delay: Math.min(i, 10) * 45, easing: css(CURVE.settle), fill: "backwards" }
      )
    );
    sfx.deal?.(Math.min(6, pool.size + 1));
  }
  const pw = $("pool-well");
  const r = pw.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) pw.scrollIntoView({ behavior: reducedMotion() ? "instant" : "smooth", block: "center" });
  toast(`${label}：${replace ? "換成" : "加進"} ${fresh.size} 張，合成池共 ${pool.size} 張`, {
    action: {
      label: "復原",
      run: () => {
        pool = new Set(before.pool.filter((t) => lib.byTag.has(t)));
        bans = new Set(before.bans);
        weights = before.weights;
        commitPins();
      },
    },
  });
}

$("pool-clear").addEventListener("click", () => {
  const before = [...pool];
  const beforeWeights = new Map(weights);
  if (!before.length) return;
  // 一張接一張收回字盒（從最後放的那張開始），五秒內可以反悔。
  const leaving = before.map(poolNode).filter(Boolean).map((n) => ({ node: n, rect: n.getBoundingClientRect() })).reverse();
  // 分兩路：偏好卡牌回到手上，其他的掃成一疊收回字盒。托盤那幾格在重畫的同一刻先藏著。
  const toHand = leaving.filter((l) => hand?.has(l.node.dataset.tag));
  const toLib = leaving.filter((l) => !hand?.has(l.node.dataset.tag));
  for (const l of toHand) hand.arriveAt(l.node.dataset.tag, 2400);
  pool = new Set();
  commitPins();
  // 先在合成池中間掃成一疊，整疊一起收回字盒（一張張各飛各的會交叉亂飛）；偏好卡牌同時一張一張回到手上。
  const well = $("pool-well").getBoundingClientRect();
  const grid = $("lib-grid").getBoundingClientRect();
  const home = grid.width && grid.bottom > 0 && grid.top < innerHeight ? { x: grid.left + grid.width / 2, y: Math.max(grid.top, 0) + 60 } : null;
  // 偏好卡牌先動身回到手上，其他的晚一拍才收成一疊（兩件事分得開）。
  hand?.receive(toHand);
  gatherHome(toLib, { x: well.left + well.width / 2, y: well.top + well.height / 2 }, home, { start: toHand.length ? 110 : 0 });
  toast(`清空了合成池（${before.length} 張）`, {
    action: {
      label: "復原",
      key: "Z",
      run: () => {
        // 清空的反過來：偏好卡牌從手上打出去（托盤那一格／標籤），其他的從字盒那張飛回來；
        // 出發點在重畫之前量，回來的那幾格重畫出來時就藏著，影子都在這一刻做好、用 delay 錯開。
        const restore = before.filter((t) => lib.byTag.has(t) && !bans.has(t));
        const cardW = $("lib-grid").querySelector(".card")?.offsetWidth || 84;
        const launch = restore.map((t) => {
          const h = hand?.has(t) ? hand.launchFrom(t, cardW) : null;
          if (h) return { t, ...h, fromHand: true };
          const c = libCardNode(t);
          const r = c && c.getBoundingClientRect();
          return { t, rect: r && r.width && r.bottom > 0 && r.top < innerHeight ? r : null, node: null, rotate: 0 };
        });
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) for (const l of launch) claimPoolInbound(l.t);
        pool = new Set(restore);
        weights = new Map([...beforeWeights].filter(([t]) => pool.has(t)));
        commitPins();
        // 從手上打出去的先走（托盤正在收攏，等久了會蓋住留下來的牌），字盒的跟著一張一張來。
        const first = launch.filter((l) => l.fromHand);
        const rest = launch.filter((l) => !l.fromHand);
        first.forEach((l, i) => flyInto(l.t, l.rect, { delay: i * 45, src: l.node, startRotate: l.rotate, startScale: l.scale || 1 }));
        rest.forEach((l, i) => flyInto(l.t, l.rect, { delay: 60 + first.length * 45 + i * 60 }));
      },
    },
  });
});

// ?debug：給測試腳本用的把手
if (new URLSearchParams(location.search).has("debug")) {
  window.mochi = { get pool() { return pool; }, get bans() { return bans; }, get shots() { return shots; }, get settings() { return settings; }, pin, ban, drawBatch, lib: () => lib };
}

boot();
