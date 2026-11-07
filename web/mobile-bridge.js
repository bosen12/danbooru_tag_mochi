/**
 * 墨池 iPhone App 的抽牌橋（App 用一個看不見的 WKWebView 載入這支，透過 window.MochiBridge 呼叫）。
 *
 * 規則只有一份：這裡不寫新規則，全部照墨池網頁（app.js）的做法呼叫引擎和網頁自己的模組——
 *   放牌 applyPin、丟廢字簍 applyBan、拿掉 applyClear、份量 weights.js、每段張數 stepSkeleton、
 *   抽牌 drawWithSeed（withEffectiveHeats）、份量寫回 weightPositive、LoRA 觸發字 insertTriggerAfterCast、
 *   字盒搜尋 cards.js 的 searchCards、牌的說明 cardFacts、被拿掉的原因 trace-copy.js、英文 i18n.js 的 t()。
 * 墨池更新後，App 下次連線載入的就是新版（離線時 App 用上一次整份載入成功的快取）。
 *
 * 進出都是 JSON。App 那邊存的狀態：
 *   state = { settings, pins: [tag…], bans: [tag…], weights: { tag: 份量 } }
 * settings 原樣交給 sanitizeSettings；沒存過時跟網頁一樣用 { rating: "general" }（全年齡）。
 *
 * 語言在載入前決定：App 先設 globalThis.MochiLanguage = { resolve: () => "en" | "zh-Hant" }，i18n.js 照它。
 */
import {
  indexLexicon,
  sanitizeSettings,
  applyPin,
  applyBan,
  applyClear,
  autoBannedFromPins,
  identityPins,
  identityBans,
  insertTriggerAfterCast,
  escapeForComfy,
  parseWeighted,
  randomSeed,
  stepSkeleton,
  skeletonCap,
  SKELETON,
  ERAS,
  ERA_LABELS,
  HEATS,
  RATINGS,
  RATING_LABEL,
  SCENE_MODES,
  SCENE_MODE_LABELS,
} from "./engine.js";
import { drawWithSeed, withEffectiveHeats, effectiveHeats } from "./draw-with-seed.js";
import { toggleHeat } from "./heats.js";
import { heatBlockedByRating } from "./scene-policy.js";
import { weightPositive, stepWeight, WEIGHTS } from "./weights.js";
import { formatTraceReason, sourceLabel } from "./trace-copy.js";
import { HARD_BANNED, artSources, CARD_SUITS, CARD_SUIT_INFO } from "./card-art.js";
import { buildLibrary, searchCards, cardFacts } from "./cards.js";
import { ratingBlocked, ratingOf } from "./rules/rating.js";
import { english, t, GLYPHS } from "./i18n.js";

// 跟 app.js 同一份（成品上小牌的來源、尺寸、尺度的字）。
const SRC_ZH = { implies: "附帶", bind: "附帶", era_anchor: "時代", repair: "補位", must_draw: "必抽", preset: "組合", fixed: "固定" };
const SECTION_ORDER = ["subject", "feature", "clothing", "pose", "env", "style", "quality"];
const SIZES = [
  { id: "square", zh: "方 1024²", w: 1024, h: 1024 },
  { id: "portrait", zh: "直 832×1216", w: 832, h: 1216 },
  { id: "landscape", zh: "橫 1216×832", w: 1216, h: 832 },
];
const HEAT_ZH = { activity: "活動", tease: "誘惑", flash: "走光", sex: "性愛" };
const COUNT_SECTIONS = [
  ["feature", "長相"],
  ["clothing", "服裝"],
  ["pose", "姿勢"],
  ["env", "場景"],
];
const BATCH_MAX = 8;
// 時代的選單（app.js 的 eraSel）：隨機＝每張一個時代；混合＝不同時代一起出現；或指定一個。
const ERA_CHOICES = [
  ["random", "隨機（每張一個時代）"],
  ["mix", "混合（不同時代一起出現）"],
];
// 畫面裡有誰（app.js 的 whoRow）。
const WHO = [
  ["girl", "女"],
  ["boy", "男"],
  ["any", "不限"],
];

let data = null;
let lex = null;
let lib = null;
let manifest = {};
let banned = new Set();

const glyphOf = (g) => (english ? GLYPHS[g] || g : g);
const zh = (tag) => lex.byTag.get(tag)?.zh || tag;
const bare = (tag) => parseWeighted(String(tag ?? "")).tag.toLowerCase().replace(/_/g, " ").trim();

/** 抽牌的設定：跟網頁一樣，沒存過就是全年齡。 */
function settingsOf(state) {
  return sanitizeSettings((state && state.settings) || { rating: "general" }, data);
}

function stateOut(settings, pins, bans, weights) {
  return { settings, pins: [...pins], bans: [...bans], weights: { ...weights } };
}

/** 放牌的選項（app.js 的 pinOpts）：時代混不混、互斥開關。 */
const pinOpts = (settings, extra = {}) => ({ eraMix: settings.eraMix, keepMutex: settings.pinMutex === false, ...extra });

/** 牌在 App 上要用的樣子：名字、花色、分級、時代、卡面（原圖、縮圖；相對墨池根目錄）。 */
function cardOut(card) {
  const art = artSources(manifest[card.tag]);
  const thumb = art && art.srcset ? art.srcset.split(",")[0].trim().split(" ")[0] : null;
  return {
    tag: card.tag,
    zh: t(card.zh),
    spine: t(card.spine || card.zh),
    suit: card.suit,
    suitZh: t(CARD_SUIT_INFO[card.suit]?.zh || card.suit),
    // 牌面左上那顆花色章：中文一個字；英文版照 i18n.js 換成字母（不是那個字的英文）。
    glyph: glyphOf(CARD_SUIT_INFO[card.suit]?.glyph || ""),
    group: card.group,
    groupZh: t(card.groupZh),
    seal: card.seal,
    rating: card.rating,
    eras: card.eras,
    gate: card.gate || "any",
    section: card.item.section,
    art: art ? { full: art.src, thumb: thumb || art.src } : null,
  };
}

/** 詞庫、卡面清單載入。base 是墨池根目錄（App 的 mochi-engine:// 網址）。 */
export async function boot({ base = "./" } = {}) {
  const [lexRes, manRes] = await Promise.all([fetch(base + "lexicon.json"), fetch(base + "cards/manifest.json").catch(() => null)]);
  if (!lexRes.ok) throw new Error("讀不到詞庫（lexicon.json）：" + lexRes.status);
  data = await lexRes.json();
  manifest = manRes && manRes.ok ? await manRes.json().catch(() => ({})) : {};
  lex = indexLexicon(data);
  lib = buildLibrary(data, { ratingBlocked });
  banned = new Set([...HARD_BANNED, ...(data.characterBan || [])].map(bare));
  return meta();
}

/** 規則面板要的選項和字（英文版已經翻好）。 */
export function meta() {
  return {
    english,
    cards: lib.cards.length,
    eras: ERAS.map((id) => ({ id, label: t(ERA_LABELS[id] || id) })),
    heats: HEATS.map((id) => ({ id, label: t(HEAT_ZH[id] || id) })),
    ratings: RATINGS.map((id) => ({ id, label: t(RATING_LABEL[id] || id) })),
    sceneModes: SCENE_MODES.map((id) => ({ id, label: t(SCENE_MODE_LABELS[id] || id) })),
    eraChoices: [...ERA_CHOICES, ...ERAS.map((e) => [e, ERA_LABELS[e]])].map(([id, label]) => ({ id, label: t(label) })),
    who: WHO.map(([id, label]) => ({ id, label: t(label) })),
    sizes: SIZES.map((s) => ({ id: s.id, label: t(s.zh), width: s.w, height: s.h })),
    counts: COUNT_SECTIONS.map(([id, label]) => ({ id, label: t(label), max: 10, skeleton: skeletonCap(id) })),
    suits: CARD_SUITS.map((id) => ({ id, label: t(CARD_SUIT_INFO[id]?.zh || id), glyph: glyphOf(CARD_SUIT_INFO[id]?.glyph || "") })),
    weights: WEIGHTS,
    skeleton: Object.fromEntries(Object.entries(SKELETON).map(([s, list]) => [s, list.map(([g, label]) => ({ id: g, label: t(label) }))])),
    defaults: settingsOf(null),
  };
}

/**
 * 字盒：搜尋（中文、英文、同義詞，cards.js 的 searchCards）＋花色篩選。
 * 現在的分級用不了的牌跟網頁一樣收起來（rating 不限制時全部看得到）。
 */
export function library(state, { query = "", suit = "", offset = 0, limit = 120 } = {}) {
  const settings = settingsOf(state);
  const r = ratingOf(settings);
  const pool = lib.cards.filter((c) => (!suit || c.suit === suit) && !ratingBlocked(c.item, r) && !banned.has(bare(c.tag)));
  const res = searchCards(pool, query);
  const list = res.list.slice(offset, offset + limit);
  return { total: res.list.length, mode: res.mode, cards: list.map(cardOut) };
}

/** 一張牌的說明（網頁卡冊、字盒的詳情那幾行）。 */
export function card(tag) {
  const c = lib.byTag.get(tag);
  if (!c) return null;
  return { ...cardOut(c), facts: cardFacts(c, lex, data).map(([k, v]) => ({ label: t(k), value: t(v) })) };
}

/** 很多張牌一次查（合成池、牌組要畫名字和卡面）。詞庫沒有的回 null。 */
export function cards(tags) {
  return (tags || []).map((tag) => (lib.byTag.has(tag) ? cardOut(lib.byTag.get(tag)) : null));
}

/**
 * 放一張牌（app.js 的 pin）：互斥的被換下來、附帶的跟著進來。gone、carried 給 App 演動畫、寫說明。
 * 分級用不了、禁用的牌不放。
 */
export function pin(state, tag) {
  const settings = settingsOf(state);
  const c = lib.byTag.get(tag);
  if (!c || banned.has(bare(tag))) return { refused: t("這張牌不能用"), state: stateOut(settings, state.pins || [], state.bans || [], state.weights || {}) };
  if (ratingBlocked(c.item, ratingOf(settings))) {
    return { refused: t(`${c.zh}：${RATING_LABEL[settings.rating]}用不了，到頂欄換分級`), state: stateOut(settings, state.pins || [], state.bans || [], state.weights || {}) };
  }
  const before = new Set(state.pins || []);
  const next = applyPin(lex, new Set(before), new Set(state.bans || []), tag, pinOpts(settings));
  const gone = [...before].filter((x) => !next.pinned.has(x));
  const carried = [...next.pinned].filter((x) => x !== tag && !before.has(x));
  const weights = Object.fromEntries(Object.entries(state.weights || {}).filter(([x]) => next.pinned.has(x)));
  return { state: stateOut(settings, next.pinned, next.userBanned, weights), gone, carried, note: gone.length ? t(replaceNote(tag, gone)) : "" };
}

/** 丟進廢字簍（app.js 的 applyBan）。 */
export function ban(state, tag) {
  const settings = settingsOf(state);
  const next = applyBan(lex, new Set(state.pins || []), new Set(state.bans || []), tag);
  const weights = Object.fromEntries(Object.entries(state.weights || {}).filter(([x]) => next.pinned.has(x)));
  return { state: stateOut(settings, next.pinned, next.userBanned, weights) };
}

/** 從合成池或廢字簍拿掉（applyClear）。 */
export function clear(state, tag) {
  const settings = settingsOf(state);
  const next = applyClear(new Set(state.pins || []), new Set(state.bans || []), tag);
  const weights = { ...(state.weights || {}) };
  delete weights[tag];
  return { state: stateOut(settings, next.pinned, next.userBanned, weights) };
}

/** 份量往上（dir 1）或往下（-1）一檔（weights.js 的五檔）。 */
export function weigh(state, tag, dir) {
  const settings = settingsOf(state);
  const weights = { ...(state.weights || {}) };
  const w = stepWeight(weights[tag] ?? 1, dir);
  if (w === 1) delete weights[tag];
  else weights[tag] = w;
  return { state: stateOut(settings, state.pins || [], state.bans || [], weights), weight: w };
}

/**
 * 改規則。patch 跟 settings 同樣的欄位；每段張數用 { count: [section, n] }（照網頁 stepSkeleton，骨架的格子跟著熄、亮），
 * 尺寸用 { size: id }。改尺度時清掉舊的尺度權重（跟 app.js 的 setSettings 一樣）。
 */
export function configure(state, patch = {}) {
  let settings = settingsOf(state);
  const { count, size, heat, era, who, ...rest } = patch || {};
  if (Array.isArray(count) && count.length === 2) settings = { ...settings, ...stepSkeleton(settings, count[0], count[1]) };
  // 尺度一顆一顆按（app.js：分級擋掉的不能按；從實際抽的那幾顆開始切換）。
  if (heat) {
    if (heatBlockedByRating(heat, ratingOf(settings))) return { state: stateOut(settings, state.pins || [], state.bans || [], state.weights || {}), refused: t(`${RATING_LABEL[settings.rating]}不會出現${HEAT_ZH[heat]}`) };
    rest.heats = toggleHeat(effectiveHeats(settings), heat);
  }
  if (era === "mix") Object.assign(rest, { eras: [...ERAS], eraMix: true });
  else if (era === "random") Object.assign(rest, { eras: [...ERAS], eraMix: false });
  else if (ERAS.includes(era)) Object.assign(rest, { eras: [era], eraMix: false });
  if (who) Object.assign(rest, { girl: who !== "boy", boy: who !== "girl" });
  const s = SIZES.find((x) => x.id === size);
  if (s) settings = { ...settings, width: s.w, height: s.h };
  settings = sanitizeSettings({ ...settings, ...(rest.heats ? { weights: undefined } : {}), ...rest }, data);
  return { state: stateOut(settings, state.pins || [], state.bans || [], state.weights || {}) };
}

/**
 * 規則面板現在的樣子（app.js 的 renderRules）：尺度按鈕亮哪幾顆（照實際抽的 effectiveHeats）、
 * 哪幾顆被分級擋掉和原因、時代選單、畫面裡有誰。
 */
export function rules(state) {
  const settings = settingsOf(state);
  const r = ratingOf(settings);
  const on = effectiveHeats(settings);
  return {
    heats: HEATS.map((id) => {
      const blocked = heatBlockedByRating(id, r);
      return { id, label: t(HEAT_ZH[id]), on: on.includes(id) && !blocked, blocked, why: blocked ? t(`${RATING_LABEL[settings.rating]}不會出現${HEAT_ZH[id]}`) : "" };
    }),
    era: settings.eraMix ? "mix" : settings.eras.length === 1 ? settings.eras[0] : "random",
    who: settings.girl && settings.boy ? "any" : settings.boy ? "boy" : "girl",
    rating: settings.rating,
    sceneMode: settings.sceneMode,
    width: settings.width,
    height: settings.height,
    counts: settings.counts,
  };
}

/** 引擎因為合成池自動擋掉的牌（字盒上標「相剋」用）。 */
export function autoBanned(state) {
  return [...autoBannedFromPins(lex, new Set(state.pins || []))];
}

/**
 * 套牌組：整組的牌照順序一張一張放（後放的跟先放的互斥時換掉先放的，跟網頁一樣），份量一起帶上。
 */
export function applyDeck(state, deck) {
  let cur = { ...state, pins: [], weights: {} };
  const gone = [];
  for (const tag of deck.tags || []) {
    const r = pin(cur, tag);
    if (r.refused) gone.push(tag);
    cur = r.state;
  }
  const weights = Object.fromEntries(Object.entries(deck.weights || {}).filter(([x]) => cur.pins.includes(x)));
  return { state: { ...cur, weights }, skipped: gone };
}

/**
 * 抽牌（app.js 的 drawBatchNow ＋ makeShot）。
 * opts：n 幾張（最多 8）、favorites 偏好角色名單（設定開了「只抽偏好角色」才用）、trigger LoRA 觸發字、
 * extras 自製牌拆出來的詞庫外字 [{text, w}]（伺服器存的時候已經擋過，這裡再擋一次）、seeds 指定抽牌種子。
 */
export function draw(state, opts = {}) {
  const settings = settingsOf(state);
  const pool = new Set(state.pins || []);
  const bans = new Set([...(state.bans || []), ...HARD_BANNED]);
  const weights = state.weights || {};
  const n = Math.max(1, Math.min(BATCH_MAX, Math.floor(Number(opts.n) || settings.n || 1)));
  const extras = (opts.extras || []).filter((x) => x && x.text && !banned.has(bare(x.text)));
  const drawSettings = withEffectiveHeats(
    settings.characterFavOnly ? { ...settings, characterFavorites: (opts.favorites || []).filter((x) => !banned.has(bare(x))) } : settings
  );
  const out = [];
  let first = null;
  for (let i = 0; i < n; i++) {
    const pins = new Set(pool);
    const bansNow = new Set(bans);
    if (settings.samePerson && first) {
      for (const x of identityPins(lex, first)) pins.add(x);
      for (const x of identityBans(lex, first)) if (!pins.has(x)) bansNow.add(x);
    }
    const seed = opts.seeds && opts.seeds[i] != null ? Number(opts.seeds[i]) >>> 0 : randomSeed();
    const drawn = drawWithSeed(lex, drawSettings, pins, bansNow, seed, { trace: true });
    if (!drawn.positive || !String(drawn.positive).trim()) continue;
    if (!first) first = drawn.positive;
    out.push(shotOf(drawn, seed, pool, weights, extras, opts.trigger, settings));
  }
  return { shots: out, settings };
}

function shotOf(drawn, seed, pool, weights, extras, trigger, settings) {
  const kept = (drawn.trace && drawn.trace.kept) || [];
  const source = new Map(kept.map((k) => [k.tag, k]));
  const inPos = new Set(String(drawn.positive).split(",").map((s) => s.trim()));
  const cardsOut = [];
  for (const sec of SECTION_ORDER) {
    for (const tag of drawn.sections[sec] || []) {
      const k = source.get(tag);
      const from = pool.has(tag) ? "pin" : (k && k.source) || "random";
      const label = from === "pin" ? "釘選" : from === "random" ? "隨機" : SRC_ZH[from] || sourceLabel(from);
      const parent = k && k.parent ? zh(k.parent) : "";
      cardsOut.push({ tag, zh: t(zh(tag)), section: sec, from, label: t(label), parent: t(parent), weight: pool.has(tag) ? weights[tag] || 1 : 1, isCard: lib.byTag.has(tag) });
    }
  }
  // 自製牌的詞庫外字：放在分級、品質字前面（跟 MCP、網頁的自製牌一樣）。
  let positive = weightPositive(drawn.positive, Object.fromEntries(Object.entries(weights).filter(([x]) => pool.has(x))));
  if (extras.length) {
    const tags = positive.split(",").map((s) => s.trim()).filter(Boolean);
    const tail = new Set([...(data.quality || []), ...(data.nsfwTail || []), ...(data.sfwTail || []), ...(data.sensitiveTail || [])]);
    let at = tags.findIndex((x) => tail.has(parseWeighted(x).tag));
    if (at < 0) at = tags.length;
    const add = extras.filter((x) => !tags.some((y) => parseWeighted(y).tag === x.text)).map((x) => (x.w && x.w !== 1 ? `(${x.text}:${x.w})` : x.text));
    tags.splice(at, 0, ...add);
    positive = tags.join(", ");
  }
  positive = insertTriggerAfterCast(positive, trigger);
  const blockedTags = blocked(positive);
  if (blockedTags.length) throw new Error(t("抽出來的結果含禁用的字，已停止") + "：" + blockedTags.join(", "));
  const removed = ((drawn.trace && drawn.trace.rejected) || []).map((e) => t(formatTraceReason(e, { labelOf: zh, mode: settings.sceneMode })));
  return {
    seed,
    positive,
    comfy: escapeForComfy(positive),
    era: drawn.era,
    eraLabel: t(ERA_LABELS[drawn.era] || drawn.era || ""),
    heat: drawn.heat,
    rating: settings.rating,
    width: settings.width,
    height: settings.height,
    cards: cardsOut,
    missing: [...pool].filter((x) => !inPos.has(x)).map((x) => ({ tag: x, zh: t(zh(x)) })),
    removed,
  };
}

/** 提示詞裡有沒有不能用的字（硬封鎖、詞庫的禁用角色）。回傳擋下的字。伺服器生圖時另外會擋一次。 */
export function blocked(positive) {
  return String(positive || "")
    .split(",")
    .map((p) => bare(p))
    .filter((x) => x && banned.has(x));
}

/** 送 ComfyUI 前跳脫消歧義括號（engine 的 escapeForComfy，跟網頁 gen.js 一樣）。 */
export const toComfy = (positive) => escapeForComfy(positive);

/** 一批中文介面字換成目前的語言（英文以 locales/en.js 為準）。 */
export const translate = (list) => (list || []).map((s) => t(s));

/** 換牌時的說明（app.js 的 replaceNote，只留文字）。 */
function replaceNote(tag, gone) {
  const item = lex.byTag.get(tag);
  const eraOf = (it) => (it?.era || []).filter((e) => e !== "any");
  const clash = (o) => {
    const a = eraOf(item);
    const b = eraOf(lex.byTag.get(o));
    return a.length && b.length && !a.some((e) => b.includes(e));
  };
  const people = gone.filter((o) => tag === "no humans" || o === "no humans");
  const era = gone.filter((o) => !people.includes(o) && clash(o));
  const slot = gone.filter((o) => !people.includes(o) && !clash(o));
  const bits = [];
  if (people.length) bits.push(tag === "no humans" ? `畫面沒有人物：${people.map((x) => `「${zh(x)}」`).join("")}拿下來了` : "放了人物的牌：「沒有人物」拿下來了");
  if (slot.length) bits.push(`同一格只留一張：${slot.map((x) => `「${zh(x)}」`).join("")}換成「${zh(tag)}」`);
  if (era.length) bits.push(`${era.map((x) => `「${zh(x)}」`).join("")}跟「${zh(tag)}」不是同一個時代，先拿下來了`);
  return bits.join("；");
}

globalThis.MochiBridge = { boot, meta, rules, library, card, cards, pin, ban, clear, weigh, configure, autoBanned, applyDeck, draw, blocked, toComfy, translate };
