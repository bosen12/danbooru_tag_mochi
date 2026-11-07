#!/usr/bin/env node
/**
 * 墨池的 MCP 伺服器：讓 Claude（Claude Code、Claude Desktop）、Codex、Grok Build 這類 AI 用墨池的詞庫和抽牌規則。
 *
 *   查牌、解釋一張牌（互斥、附帶、尺度、時代）、檢查一串牌放在一起會怎樣、照墨池的規則抽提示詞——
 *   這些直接載入 web/engine.js（跟網頁同一份），不用開墨池也能用。
 *   生圖走墨池伺服器的生圖排程（POST /api/gen）：要開著墨池和 ComfyUI；印好的圖記進出圖日誌（作品冊「日誌」），
 *   來源寫「AI」，頂欄的生圖進度也看得到。
 *
 * 用法（stdio）：node mcp/mochi-mcp.mjs
 *   墨池不在 http://127.0.0.1:8796 的話，設環境變數 MOCHI_URL。
 *   各家 AI 的設定方法見 mcp/README.md。
 *
 * 不用任何套件：MCP 的 stdio 傳輸就是一行一則 JSON-RPC，這裡自己讀寫。stdout 只能放協定訊息，紀錄一律寫 stderr。
 * 只給「查、抽、生圖」：不刪東西、不改設定、不送 Discord。未成年的字（跟 danbooru-draw skill 同一份）一律擋。
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.MOCHI_URL || "http://127.0.0.1:8796").replace(/\/+$/, "");
const VERSION = "1.0.0";

// 這邊的 repo 墨池在 web6/，開源版在 web/；共用的引擎、詞庫兩邊都在 web/。
const front = (name) => [join(ROOT, "web6", name), join(ROOT, "web", name)].find((p) => existsSync(p));
const load = (p) => import(pathToFileURL(p).href);

const E = await load(join(ROOT, "web", "engine.js"));
const { formatTraceReason, sourceLabel } = await load(join(ROOT, "web", "trace-copy.js"));
const { toSimplified } = await load(front("t2s.js"));
const { SEARCH_WORDS } = await load(front("search-words.js"));
const data = JSON.parse(readFileSync(join(ROOT, "web", "lexicon.json"), "utf8"));
const lex = E.indexLexicon(data);

// 未成年一律不出（跟 danbooru-draw skill 的 draw.mjs 同一條）：查牌結果、釘選、自由字、抽出來的結果都擋。
// 伺服器生圖時另外會擋一次（server.py 的 PromptBlocked）。
const MINOR_RE =
  /\b(loli|lolicon|shota|shotacon|child|children|kid|kids|toddler|baby|infant|underage|minor|preteen|young(?:er)?\s+(?:girl|boy)|little\s+(?:girl|boy|sister|brother)|elementary\s+school|middle\s+school|kindergarten|aged\s+down|age\s+regression)\b|蘿莉|萝莉|正太|幼女|幼童|兒童|儿童|小孩|孩童|未成年|小學生|小学生|國中生|初中生/i;
const isMinor = (t) => MINOR_RE.test(String(t));

// 禁用角色（詞庫的 characterBan，2000 多個，多半是年齡不明）：墨池網頁貼上、存檔、烤卡面都擋，這裡也擋——
// 以前詞庫找不到的字會當「詞庫外」接進提示詞，禁用角色就從這裡溜進去（2026-11-06 釘 hatsune miku 實測）。
// 角色的中文名在 scripts/characters.json（開源版也有）：查「初音未來」要能說出它是禁用的，AI 才不會改用英文硬塞。
const BANNED = new Set((data.characterBan || []).map((t) => String(t).toLowerCase().trim()));
const CHARACTERS = (() => {
  try {
    const raw = JSON.parse(readFileSync(join(ROOT, "scripts", "characters.json"), "utf8"));
    return Array.isArray(raw) ? raw : raw.characters || [];
  } catch {
    return [];
  }
})();
const bareTag = (t) => E.parseWeighted(String(t ?? "")).tag.toLowerCase().replace(/_/g, " ").trim();
const isBanned = (t) => BANNED.has(bareTag(t));
const BANNED_TEXT = "禁用角色（年齡不明或看起來未成年），墨池不畫";

const HEAT_ZH = { activity: "活動（全年齡的日常動作）", tease: "誘惑", flash: "走光", sex: "性愛" };
const GATE_ZH = { any: "不限", female: "女性才有", male: "男性才有" };
const SECTION_ZH = { subject: "人數／角色", feature: "長相", pose: "姿勢", clothing: "服裝", env: "場景" };
// 四段合計 16 左右，加上人數、附帶、分級與品質字，成品大約 25 個 tag（墨池網頁預設更多，約 30 多個）。
const DEFAULT_COUNTS = { subject: 2, feature: 5, pose: 4, clothing: 3, env: 4 };
const TAIL = new Set([...(data.quality || []), ...(data.nsfwTail || []), ...(data.sfwTail || []), ...(data.sensitiveTail || [])]);

const items = (lex.data?.tags || data.tags).filter((it) => !isMinor(it.tag));
const zhOf = (tag) => lex.byTag.get(tag)?.zh || data.zh?.[tag] || "";
const groupZh = (g) => data.groupZh?.[g] || g || "";
const label = (tag) => (zhOf(tag) ? `${zhOf(tag)}（${tag}）` : tag);
const key = (s) => toSimplified(String(s ?? "").toLowerCase().replace(/_/g, " ")).replace(/\s+/g, " ").trim();
const WORDS = new Map(Object.entries(SEARCH_WORDS).map(([k, tags]) => [key(k), tags]));

// 牌的 heat 欄位不等於「哪些尺度會出現」（全年齡的 activity 另有判斷）：一律問引擎。分級也是：取不會被擋的最低一級。
const heatsOf = (it) => E.HEATS.filter((h) => E.itemFitsHeats(it, [h]));
const minRating = (it) => E.RATINGS.find((r) => !E.ratingBlocked(it, r)) || "explicit";

function brief(it) {
  return {
    tag: it.tag,
    zh: it.zh || zhOf(it.tag),
    section: it.section,
    group: it.group,
    groupZh: groupZh(it.group),
    heats: heatsOf(it),
    minRating: minRating(it),
    era: it.era || [],
    gate: it.gate || "any",
  };
}

/** 查牌結果一張一行（AI 讀起來省字）：tag｜中文｜段/子分類｜尺度｜最低分級｜時代｜性別。 */
const line = (b) =>
  [b.tag, b.zh, `${b.section}/${b.group} ${b.groupZh}`, "尺度:" + b.heats.join(","), "分級:" + b.minRating, "時代:" + b.era.join(","), b.gate === "any" ? "" : GATE_ZH[b.gate] || b.gate, b.via || ""]
    .filter(Boolean)
    .join(" ｜ ");

/* ================= 工具 ================= */

function guide() {
  const skeleton = Object.entries(E.SKELETON)
    .map(([s, list]) => `- ${s}（${SECTION_ZH[s]}）：${list.map(([g, zh]) => `${g} ${zh}`).join("、")}`)
    .join("\n");
  return `# 墨池（Mochi）怎麼組提示詞

墨池把 Danbooru tag 做成一張一張的「牌」，引擎照規則把牌組成給 Illustrious 系底模的正向提示詞。

## 五段
提示詞依序是：人數／角色（subject）→ 長相（feature）→ 服裝（clothing）→ 姿勢（pose）→ 場景（env）→ 分級與品質字。
每段底下有子分類（每格最多一張，同格的牌互斥）：
${skeleton}
- subject（人數／角色）：1girl、2girls、1boy、no humans、角色名…

## 牌的來源
- 釘選（pins）：你指定的牌，每張圖一定有（除非跟規則衝突被拿掉，會回報原因）。
- 附帶（implies）：釘了「拿著球棒」會自動帶出「球棒」，釘「公園」帶出「戶外」。
- 隨機：其餘格子引擎依各段張數補。張數越少，畫面越集中在你指定的內容。
- 固定：分級字（sfw／general…）與品質字（masterpiece、best quality…）。

## 規則（被拿掉的牌都會說原因）
- 互斥：同一格只能一張（例如地點只能一個、髮長只能一種）。
- 尺度（heats）：${E.HEATS.map((h) => `${h}＝${HEAT_ZH[h]}`).join("、")}。每張牌標了在哪些尺度會出現；只選 activity 就是全年齡的日常畫面。
- 分級（rating）：${E.RATINGS.map((r) => `${r}＝${E.RATING_LABEL[r]}`).join("、")}。牌的分級高於設定的會被擋。
- 時代（eras）：${E.ERAS.map((e) => `${e}＝${E.ERA_LABELS[e]}`).join("、")}。不合時代的牌（例如古中國配手機）會被擋。
- 性別：有些牌只對女性或男性（gate），人物性別不合就不出。
- 情境：運動器材要配得上場地、手被占住就不能再拿東西、全套衣服跟裸體不能並存…
- 場景模式（sceneMode）：${E.SCENE_MODES.map((m) => `${m}＝${E.SCENE_MODE_LABELS[m]}`).join("、")}。
- 沒指定尺度和分級時一律全年齡；使用者要求性感、走光、色情才指定。
- 禁用角色（${BANNED.size} 個，多半年齡不明）查不到也抽不出來，不要改用英文或 extra 硬塞。

## 份量與你存的牌
- 份量：pins 寫 (smile:1.3)，或 weights {"smile": 1.3}，範圍 0.6～1.5。成品寫成 (smile:1.3)。
- my_cards 看使用者在墨池存的牌組、自製牌、偏好角色（要開著墨池）。draw_prompt 用 deck 套牌組、pins 放 custom:… 用自製牌、favoriteCharacter: true 挑偏好角色。

## 建議流程
1. search_cards 把使用者的話拆成關鍵字一次查完（中文、英文都行；「胖」「黑絲」這類說法有同義詞）。查不到的元素，自己換成相近的牌，或放進 extra（詞庫外的英文 tag）。
2. 不確定能不能放在一起，用 check_cards；想知道一張牌的細節，用 explain_card。
3. draw_prompt 抽提示詞。題目明確時每段只補 1～2 張（例如 feature 2、pose 2、clothing 1、env 2），題目模糊用預設（${Object.entries(DEFAULT_COUNTS).map(([s, n]) => `${s} ${n}`).join("、")}）。看回傳每張牌的來源，有不合題意的隨機牌就調整（加 bans、降張數、補釘選）再抽。
4. generate_image 用抽好的 positive 生圖（要開著墨池和 ComfyUI）。自己改寫的提示詞也行：墨池會補分級字、品質字。沒等到就用 image_status 接著等。
5. 臉崩了用 fix_image 的 face 修臉；要大圖用 quick／deep 放大。帶上 generate_image 回的 job 就好。
6. 沒說幾個人時預設一個女生（1girl）。不畫未成年。
`;
}

function searchCards({ queries, section, limit }) {
  const words = (Array.isArray(queries) ? queries : [queries]).map((q) => String(q ?? "").trim()).filter(Boolean).slice(0, 20);
  if (!words.length) throw new Error("queries 至少要一個關鍵字");
  const max = Math.max(1, Math.min(20, Number(limit) || 8));
  const pool = section ? items.filter((it) => it.section === section) : items;
  const results = {};
  for (const w of words) {
    if (isMinor(w)) {
      results[w] = { blocked: "不能畫未成年角色" };
      continue;
    }
    const q = key(w);
    const bannedHit = CHARACTERS.find((c) => c.character_ban && (key(c.tag) === q || key(c.zh) === q));
    if (bannedHit || isBanned(w)) {
      results[w] = { blocked: `${bannedHit ? `${bannedHit.zh || ""}（${bannedHit.tag}）` : w}是${BANNED_TEXT}。不要改用英文或放進 extra。` };
      continue;
    }
    // 中文名只寫一部分的（characters.json 寫「初音」，人家打「初音未來」）：照樣列相關的牌（例如角色扮演的衣服），最前面先提醒。
    const bannedNear = CHARACTERS.find((c) => c.character_ban && key(c.zh).length >= 2 && q.startsWith(key(c.zh)));
    const scored = [];
    for (const it of pool) {
      const tag = key(it.tag);
      const zh = key(it.zh || zhOf(it.tag));
      let s = -1;
      if (tag === q || zh === q) s = 0;
      else if (tag.startsWith(q) || zh.startsWith(q)) s = 1;
      else if (tag.split(/[\s()]+/).includes(q)) s = 2;
      else if (zh.includes(q)) s = 3;
      else if (tag.includes(q)) s = 4;
      if (s >= 0) scored.push([s, tag.length, it]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const hits = scored.slice(0, max).map(([, , it]) => brief(it));
    // 同義詞（墨池字盒用的同一份 search-words.js）：牌名裡沒有、但大家會這樣說的。
    const seen = new Set(hits.map((h) => h.tag));
    for (const tag of WORDS.get(q) || []) {
      const it = lex.byTag.get(tag);
      if (!it || seen.has(tag) || (section && it.section !== section) || isMinor(tag)) continue;
      seen.add(tag);
      hits.push({ ...brief(it), via: "同義詞" });
    }
    const warn = bannedNear ? [`注意：角色本人${bannedNear.zh}（${bannedNear.tag}）是${BANNED_TEXT}，不要改用英文或放進 extra。下面是其他相關的牌。`] : [];
    results[w] = hits.length ? [...warn, ...hits.map(line)] : bannedNear ? { blocked: warn[0] } : "詞庫沒有。換個說法再查，或寫成英文 Danbooru tag 放進 draw_prompt 的 extra。";
  }
  return { format: "tag ｜ 中文 ｜ 段/子分類 ｜ 會出現的尺度 ｜ 最低分級 ｜ 時代 ｜ 性別限制", results };
}

function explainCard({ tag }) {
  const t = String(tag ?? "").trim();
  const it = lex.byTag.get(t);
  if (!it) {
    const near = searchCards({ queries: [t], limit: 5 }).results[t];
    return { found: false, tag: t, note: "詞庫沒有這張牌", near: Array.isArray(near) ? near : [] };
  }
  if (isMinor(t)) throw new Error("不能畫未成年角色");
  const sib = E.mutexSiblings(lex, t).filter((x) => !isMinor(x));
  const implied = (it.implies || []).map(label);
  const impliedBy = items.filter((x) => (x.implies || []).includes(t)).slice(0, 12).map((x) => label(x.tag));
  return {
    found: true,
    ...brief(it),
    gateZh: GATE_ZH[it.gate || "any"] || it.gate,
    heatZh: heatsOf(it).map((h) => HEAT_ZH[h] || h),
    minRatingZh: E.RATING_LABEL[minRating(it)],
    eraZh: (it.era || []).map((e) => (e === "any" ? "不限" : E.ERA_LABELS[e] || e)),
    mutexGroup: it.mutex || null,
    mutexWith: { count: sib.length, examples: sib.slice(0, 24).map(label), note: sib.length ? "同一格只能一張：釘了這張，這些就不會同時出現" : "沒有互斥對象" },
    implies: implied,
    impliedBy,
    binds: (it.bind || []).map(label),
    needs: it.needs || [],
    needsContext: Object.prototype.hasOwnProperty.call(E.NEEDS_CONTEXT, t) ? "這張要有合適的情境（地點、動作）才會被抽到" : null,
  };
}

const people = (tags) => tags.some((t) => lex.byTag.get(t)?.section === "subject");

const RANK = { general: 0, sensitive: 1, explicit: 2 };

/**
 * 沒講尺度、分級：全年齡（以前照墨池網頁預設成色情，AI 沒寫就抽出緊身衣加 nsfw）。
 * 只講尺度：有性愛、走光是色情，只有誘惑是敏感，其餘全年齡。只講分級：尺度照引擎預設。
 */
function contentLevel(spec) {
  const heats = Array.isArray(spec.heats) && spec.heats.length ? spec.heats : null;
  const rating = E.RATINGS.includes(spec.rating) ? spec.rating : null;
  if (!heats && !rating) return { heats: ["activity"], rating: "general", note: "沒指定尺度和分級：用全年齡（activity、general）。要更露骨得明確指定。" };
  if (rating) return { heats, rating, note: null };
  const r = heats.some((h) => h === "sex" || h === "flash") ? "explicit" : heats.includes("tease") ? "sensitive" : "general";
  return { heats, rating: r, note: `沒指定分級：照尺度用 ${r}。` };
}

/** 份量：pins 裡的 (tag:1.2) 和 weights 物件合在一起，夾在墨池的 0.6～1.5。 */
function splitWeights(list, weightsIn) {
  const tags = [];
  const weights = {};
  for (const raw of list) {
    const { tag, weight } = E.parseWeighted(raw);
    if (!tag) continue;
    tags.push(tag);
    if (weight !== 1) weights[tag] = E.clampTagWeight(weight);
  }
  for (const [tag, w] of Object.entries(weightsIn && typeof weightsIn === "object" ? weightsIn : {})) {
    const n = E.clampTagWeight(w);
    if (n !== 1) weights[tag] = n;
    else delete weights[tag];
  }
  return { tags, weights };
}

/**
 * 你在墨池存的東西（要開著墨池）：牌組、自製牌、偏好角色。一次要求只抓一次。
 * 讀不到（墨池沒開）時，用到它們的要求會說清楚，其他照常。
 */
async function mine(kind) {
  const path = { decks: "/api/decks", custom: "/api/custom-cards", chars: "/api/fav-chars" }[kind];
  const r = await mochi(path);
  const d = await r.json().catch(() => ({}));
  if (kind === "decks") return Array.isArray(d.decks) ? d.decks : [];
  if (kind === "custom") return Array.isArray(d.cards) ? d.cards : [];
  return Array.isArray(d.tags) ? d.tags : [];
}

const findByName = (list, name) => {
  const k = key(name);
  return list.find((x) => x.id === name || key(x.name) === k) || list.find((x) => key(x.name).includes(k)) || null;
};

/** 把要求轉成引擎的設定、釘選、禁用。drawOne 和 check_cards 共用。 */
async function prepare(spec) {
  const raw = (spec.pins || []).map((t) => String(t).trim()).filter(Boolean);
  const notes = [];
  const extraW = {};
  const extraIn = [];
  for (const t of (spec.extra || []).map((x) => String(x).trim()).filter(Boolean)) {
    const { tag, weight } = E.parseWeighted(t);
    extraIn.push(tag);
    if (weight !== 1) extraW[tag] = E.clampTagWeight(weight);
  }
  // 牌組：整組的牌和份量先放進來，pins、weights 再蓋上去。
  let deckW = {};
  if (spec.deck) {
    const deck = findByName(await mine("decks"), String(spec.deck));
    if (!deck) throw new Error(`找不到牌組「${spec.deck}」：先用 my_cards 看有哪些`);
    raw.unshift(...(deck.tags || []));
    deckW = deck.weights || {};
    notes.push(`套用牌組「${deck.name}」：${(deck.tags || []).length} 張牌`);
  }
  const { tags: pinsAll, weights } = splitWeights(raw, { ...deckW, ...(spec.weights || {}) });
  // 自製牌（custom:<id> 或自製牌的名字）：拆成裡面的牌（帶份量）＋詞庫外的字，跟墨池網頁一樣。
  const level = contentLevel(spec);
  if (level.note) notes.push(level.note);
  const pinsIn = [];
  let customs = null;
  for (const t of pinsAll) {
    if (lex.byTag.has(t) && !t.startsWith("custom:")) {
      pinsIn.push(t);
      continue;
    }
    // custom:<id> 一定要讀得到（墨池沒開就照實說）；一般的詞庫外字順便看是不是自製牌的名字，讀不到就當詞庫外。
    if (t.startsWith("custom:")) customs = customs?.length ? customs : await mine("custom");
    else customs ??= await mine("custom").catch(() => []);
    const c = t.startsWith("custom:") ? customs.find((x) => x.id === t.slice(7)) : customs.find((x) => key(x.name) === key(t));
    if (!c) {
      if (t.startsWith("custom:")) throw new Error(`找不到自製牌 ${t}：先用 my_cards 看有哪些`);
      pinsIn.push(t);
      continue;
    }
    if (RANK[c.rating] > RANK[level.rating]) throw new Error(`自製牌「${c.name}」是${E.RATING_LABEL[c.rating]}，比這次的分級（${E.RATING_LABEL[level.rating]}）高`);
    for (const m of c.members || []) {
      pinsIn.push(m.tag);
      if (m.w && m.w !== 1 && !(m.tag in weights)) weights[m.tag] = E.clampTagWeight(m.w);
    }
    for (const x of c.extra || []) {
      extraIn.push(x.text);
      if (x.w && x.w !== 1) extraW[x.text] = E.clampTagWeight(x.w);
    }
    notes.push(`自製牌「${c.name}」拆成 ${(c.members || []).length} 張牌${(c.extra || []).length ? `＋詞庫外 ${(c.extra || []).length} 個字` : ""}`);
  }
  // 偏好角色：從你在墨池標的角色裡挑一個（跳過禁用的、詞庫沒有的），用抽牌的種子挑，同設定同結果。
  if (spec.favoriteCharacter) {
    const pool = (await mine("chars")).filter((t) => lex.byTag.has(t) && !isBanned(t));
    if (!pool.length) throw new Error("你還沒有標偏好角色（卡冊的角色牌上按愛心），或都不在詞庫裡");
    const pick = pool[E.mulberry32(Number(spec.seed) >>> 0 || 1)() * pool.length | 0];
    pinsIn.push(pick);
    notes.push(`從 ${pool.length} 個偏好角色挑了${label(pick)}`);
  }
  const bansIn = (spec.bans || []).map((t) => bareTag(t)).filter(Boolean);
  const all = [...pinsIn, ...extraIn];
  const minor = all.filter(isMinor);
  if (minor.length) throw new Error("不能畫未成年角色，這些字被擋下：" + minor.join(", "));
  const bannedChars = all.filter(isBanned);
  if (bannedChars.length) throw new Error(`${bannedChars.join(", ")}：${BANNED_TEXT}。`);
  const notInLexicon = pinsIn.filter((t) => !lex.byTag.has(t));
  for (const t of notInLexicon) if (weights[t]) extraW[t] = weights[t];
  const girl = spec.girl ?? true;
  const boy = spec.boy ?? false;
  const pins = [...new Set(pinsIn.filter((t) => lex.byTag.has(t)))];
  // 沒說幾個人：預設一個人（女生優先）。引擎自己抽的話常抽成兩三個人。
  const defaulted = !people(pins) && spec.people !== false ? (girl ? "1girl" : boy ? "1boy" : null) : null;
  if (defaulted) pins.unshift(defaulted);
  let settings = E.sanitizeSettings(
    {
      counts: { ...DEFAULT_COUNTS, ...(spec.counts || {}) },
      heats: level.heats || undefined,
      rating: level.rating,
      eras: spec.eras,
      girl,
      boy,
      sceneMode: spec.sceneMode,
      width: spec.width,
      height: spec.height,
    },
    data
  );
  // focus：某段張數比格子少時，指定要補哪幾格（{"pose":["face","camera"]}）。沒指定照引擎的優先序。
  const focus = spec.focus && typeof spec.focus === "object" ? spec.focus : {};
  const off = [];
  for (const [section, list] of Object.entries(E.SKELETON)) {
    const n = Number(settings.counts[section]);
    if (!(n > 0 && n < E.skeletonCap(section))) continue;
    const want = (focus[section] || []).map(String);
    if (!want.length) {
      off.push(...E.stepSkeleton(settings, section, n).offGroups.filter((k) => k.startsWith(section + ":")));
      continue;
    }
    const keys = list.map(([g]) => g);
    const lit = [...want.filter((g) => keys.includes(g)), ...keys.filter((g) => !want.includes(g))].slice(0, n);
    off.push(...keys.filter((g) => !lit.includes(g)).map((g) => section + ":" + g));
  }
  settings = { ...settings, offGroups: E.sanitizeOffGroups(off) };
  // 一張一張釘：後釘的跟先釘的互斥時，先釘的會被換掉（跟墨池網頁一樣）。記下來告訴 AI。
  let pinned = new Set();
  let banned = new Set();
  const displaced = [];
  for (const t of pins) {
    const before = new Set(pinned);
    ({ pinned, userBanned: banned } = E.applyPin(lex, pinned, banned, t));
    for (const x of before) if (!pinned.has(x)) displaced.push({ tag: x, by: t, why: `${label(x)}被拿掉：跟後來釘的${label(t)}互斥（同一格只能一張）` });
  }
  for (const t of bansIn) ({ pinned, userBanned: banned } = E.applyBan(lex, pinned, banned, t));
  return { pinsIn, bansIn, extras: [...new Set([...extraIn, ...notInLexicon])], notInLexicon, defaulted, settings, pinned, banned, displaced, weights: { ...weights, ...extraW }, notes };
}

function warningsOf(p) {
  const out = [];
  const say = (w, text) => out.push({ kind: w.kind, tags: w.tags || [], note: text });
  for (const w of E.sportHeatWarnings(lex, p.pinned, p.settings.heats)) say(w, "性愛尺度下，運動類的動作會被拿掉");
  for (const w of E.sportPinWarnings(lex, p.pinned)) say(w, "這幾張運動牌不是同一項運動");
  for (const w of E.sportPlacePinWarnings(lex, p.pinned, p.settings)) say(w, "運動器材跟釘的場地配不起來");
  for (const w of E.handUsageWarnings(p.pinned)) say(w, "手已經拿著東西，又釘了要空手做的動作");
  return out;
}

/**
 * 引擎的 trace（每張牌怎麼來的、被拿掉的為什麼）→ 依來源分組的一行一張：
 * { 釘選: ["公園（park）"], 暗示帶入: ["室外（outdoors）← 公園"], 隨機抽取: […], 固定品質: […] }。沒釘人數時自動補的寫「預設一人」。
 */
function traceOf(r, p) {
  const kept = {};
  const tags = [];
  for (const e of r.trace?.kept || []) {
    const from = e.tag === p.defaulted ? "預設一人" : sourceLabel(e.source);
    (kept[from] ||= []).push(e.parent ? `${label(e.tag)} ← ${zhOf(e.parent) || e.parent}` : label(e.tag));
    tags.push({ tag: e.tag, from });
  }
  const removed = (r.trace?.rejected || []).map((e) => formatTraceReason(e, { labelOf: label }));
  return { kept, removed, tags };
}

/** extra 放在分級與品質字前面；調過份量的寫成 (tag:1.2)。不補 adult：墨池網頁抽出來的也沒有（未成年另外擋）。 */
function finishTags(r, extras, weights = {}) {
  const tags = r.positive.split(",").map((t) => t.trim()).filter(Boolean);
  const add = extras.filter((t) => !tags.includes(t));
  let tail = tags.findIndex((t) => TAIL.has(t));
  if (tail < 0) tail = tags.length;
  tags.splice(tail, 0, ...add);
  const bad = tags.filter((t) => isMinor(t) || isBanned(t));
  if (bad.length) throw new Error("抽出來的結果含未成年字或禁用角色，已停止：" + bad.join(", "));
  return tags.map((t) => (weights[t] && weights[t] !== 1 ? E.formatWeighted(t, weights[t]) : t));
}

async function checkCards(spec) {
  const tags = (spec.tags || []).map(String);
  if (!tags.length && !spec.deck) throw new Error("tags 至少要一張牌（或給 deck）");
  const p = await prepare({ ...spec, pins: tags, counts: { subject: 0, feature: 0, pose: 0, clothing: 0, env: 0 } });
  const r = E.drawOne(lex, p.settings, p.pinned, p.banned, E.mulberry32(1), 1, { trace: true });
  const { removed, tags: traced } = traceOf(r, p);
  const out = new Set(r.positive.split(",").map((t) => t.trim()));
  const ok = p.pinsIn.filter((t) => out.has(t));
  return {
    allFit: !p.displaced.length && ok.length === p.pinsIn.length,
    kept: ok.map(label),
    displacedWhilePinning: p.displaced,
    removedByRules: removed,
    warnings: warningsOf(p),
    notInLexicon: p.notInLexicon,
    addedAutomatically: traced.filter((k) => !p.pinsIn.includes(k.tag) && k.from !== sourceLabel("fixed")).map((k) => `${label(k.tag)}：${k.from}`),
    settings: { heats: p.settings.heats, rating: p.settings.rating, eras: p.settings.eras },
    ...(p.notes.length ? { notes: p.notes } : {}),
  };
}

async function drawPrompt(spec) {
  const p = await prepare(spec);
  const n = Math.max(1, Math.min(4, Math.floor(Number(spec.n) || 1)));
  const base = spec.seed !== undefined && spec.seed !== null && spec.seed !== "" ? Number(spec.seed) >>> 0 : null;
  const results = [];
  for (let i = 0; i < n; i++) {
    const seed = base === null ? E.randomSeed() : (base + i) >>> 0;
    const r = E.drawOne(lex, p.settings, p.pinned, p.banned, E.mulberry32(seed), seed, { trace: true });
    const tags = finishTags(r, p.extras, p.weights);
    const { kept, removed } = traceOf(r, p);
    results.push({
      positive: tags.join(", "),
      tagCount: tags.length,
      drawSeed: seed,
      cards: kept,
      removed,
      droppedPins: p.pinsIn.filter((t) => lex.byTag.has(t) && !tags.some((x) => bareTag(x) === t)),
    });
  }
  return {
    results,
    displacedWhilePinning: p.displaced,
    warnings: warningsOf(p),
    notInLexicon: p.notInLexicon,
    defaultedPeople: p.defaulted,
    ...(Object.keys(p.weights).length ? { weights: p.weights } : {}),
    ...(p.notes.length ? { notes: p.notes } : {}),
    settings: {
      counts: p.settings.counts,
      heats: p.settings.heats,
      rating: p.settings.rating,
      eras: p.settings.eras,
      girl: p.settings.girl,
      boy: p.settings.boy,
      sceneMode: p.settings.sceneMode,
      width: p.settings.width,
      height: p.settings.height,
    },
    next: "滿意就把 positive 和 settings 的 rating、width、height 交給 generate_image；不滿意調整後再抽。",
  };
}

/* ================= 生圖（經墨池伺服器） ================= */

const jobs = new Map();

async function mochi(path, init = {}) {
  try {
    return await fetch(BASE + path, init);
  } catch {
    throw new Error(`連不上墨池（${BASE}）。先開墨池（start-web6.bat 或 start.bat）；位址不同就設環境變數 MOCHI_URL。`);
  }
}

async function* sse(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    let cut;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      let event = "message";
      let dataText = "";
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataText += line.slice(5).trim();
      }
      let parsed = null;
      try {
        parsed = dataText ? JSON.parse(dataText) : null;
      } catch {
        parsed = null;
      }
      yield { event, data: parsed };
    }
  }
}

function checkSize(v, name) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Math.round(Number(v));
  if (!(n >= 256 && n <= 2048)) throw new Error(`${name} 要在 256～2048 之間`);
  return n;
}

/** 提示詞裡的字（去掉份量）。檢查未成年、禁用角色、判斷分級用。 */
const partsOf = (positive) => String(positive ?? "").split(",").map((t) => bareTag(t)).filter(Boolean);

function guard(positive) {
  const parts = partsOf(positive);
  const minor = parts.filter(isMinor);
  if (minor.length) throw new Error("不能畫未成年角色，這些字被擋下：" + minor.join(", "));
  const banned = parts.filter((t) => BANNED.has(t));
  if (banned.length) throw new Error(`${banned.join(", ")}：${BANNED_TEXT}。`);
}

/**
 * 沒給分級：看提示詞尾巴（墨池抽出來的一定有 general／sensitive／explicit）。以前一律當色情送，
 * 全年齡的提示詞會配上色情的負向提示詞。什麼都看不出來就當全年齡。
 */
function ratingOf(args, positive) {
  if (E.RATINGS.includes(args.rating)) return args.rating;
  const parts = new Set(partsOf(positive));
  if (parts.has("explicit") || parts.has("nsfw")) return "explicit";
  if (parts.has("sensitive")) return "sensitive";
  return "general";
}

const RATING_TAIL = { general: data.sfwTail || [], sensitive: data.sensitiveTail || [], explicit: data.nsfwTail || [] };
const RATING_WORDS = new Set(Object.values(RATING_TAIL).flat());
const QUALITY = data.quality || [];

/**
 * 經墨池處理：AI 自己寫的提示詞常常沒有分級字、品質字（墨池抽出來的一定有）。
 * 照引擎的結尾補齊：分級字換成這個分級的（別的分級的拿掉）；品質字補在最後。
 * draw_prompt 抽出來的本來就齊，原樣不動。調過份量的 (masterpiece:1.2) 照留。
 */
function mochiTail(positive, rating) {
  const want = RATING_TAIL[rating] || [];
  const dropped = [];
  const tokens = String(positive).split(",").map((t) => t.trim()).filter(Boolean).filter((t) => {
    const b = bareTag(t);
    if (RATING_WORDS.has(b) && !want.includes(b)) return dropped.push(t), false;
    return true;
  });
  const has = new Set(tokens.map(bareTag));
  const added = [];
  const missRating = want.filter((t) => !has.has(t));
  if (missRating.length) {
    // 插在結尾那串品質字前面（引擎的順序：…場景, 分級字, 品質字）
    let q = tokens.length;
    while (q > 0 && QUALITY.includes(bareTag(tokens[q - 1]))) q--;
    tokens.splice(q, 0, ...missRating);
    added.push(...missRating);
  }
  const missQuality = QUALITY.filter((t) => !has.has(t));
  tokens.push(...missQuality);
  added.push(...missQuality);
  return { positive: tokens.join(", "), added, dropped };
}

const tidyNote = (added, dropped) =>
  [added.length ? "墨池補上：" + added.join(", ") : "", dropped.length ? "拿掉（跟分級不合）：" + dropped.join(", ") : ""].filter(Boolean).join("；") || undefined;

/** 送一張去墨池的生圖排程（生圖、修臉、Hires 都是 POST /api/gen），讀 SSE 直到畫完。 */
async function startJob(body, meta) {
  const id = "mcp-" + randomBytes(8).toString("hex");
  const res = await mochi("/api/gen", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-Gen-Resume": "1" },
    body: JSON.stringify({ ...body, origin: "mcp", job: id }),
  });
  if (!res.ok) {
    let msg = `墨池回 ${res.status}`;
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* 不是 JSON 就用狀態碼 */
    }
    throw new Error(msg);
  }
  const job = { id: res.headers.get("X-Gen-Job") || id, state: "queued", progress: 0, ...meta, waiters: [] };
  jobs.set(job.id, job);
  const settle = () => job.waiters.splice(0).forEach((f) => f());
  // 一直讀到畫完：墨池的工作有人接著才會畫完（沒人接的兩分鐘會被收掉），所以這條連線要留著，工具先回也一樣。
  (async () => {
    try {
      for await (const { event, data: d } of sse(res)) {
        if (event === "queued") job.state = "queued";
        else if (event === "progress") {
          job.state = "running";
          job.progress = Math.min(1, (d?.value || 0) / (d?.max || 25));
        } else if (event === "done") {
          Object.assign(job, { state: "done", progress: 1, image: d?.image, seed: d?.seed, ...(d?.width ? { width: d.width, height: d.height } : {}) });
          return;
        } else if (event === "error") {
          Object.assign(job, { state: "error", error: d?.error || "ComfyUI 報錯" });
          return;
        }
      }
      if (job.state !== "done") Object.assign(job, { state: "error", error: "跟墨池的連線中途斷了（墨池或 ComfyUI 關掉了？）" });
    } catch (err) {
      Object.assign(job, { state: "error", error: String(err?.message || err) });
    } finally {
      settle();
    }
  })();
  return job;
}

async function generateImage(args) {
  const raw = String(args.positive ?? "").trim();
  if (!raw) throw new Error("positive 是空的：先用 draw_prompt 抽一組");
  guard(raw);
  const rating = ratingOf(args, raw);
  const { positive, added, dropped } = mochiTail(raw, rating);
  const body = {
    positive: E.escapeForComfy(positive),
    rating,
    width: checkSize(args.width, "width") ?? 1024,
    height: checkSize(args.height, "height") ?? 1024,
    ...(args.seed !== undefined && args.seed !== null && args.seed !== "" ? { seed: Number(args.seed) >>> 0 } : {}),
    ...(args.ckpt ? { ckpt: String(args.ckpt) } : {}),
    ...(Array.isArray(args.loras) ? { loras: args.loras } : {}),
    ...(args.era ? { era: String(args.era) } : {}),
  };
  const job = await startJob(body, { positive, rating, width: body.width, height: body.height, ckpt: body.ckpt, loras: body.loras, era: body.era, tidied: tidyNote(added, dropped) });
  return waitJob(job, args.wait_seconds);
}

const HIRES_SCALE = { quick: 1.5, deep: 2 };

/**
 * 修臉、Hires：對已經印好的一張再跑一次（墨池成品牆的「修臉」「Hires」同一條路，payload 多一個 hires）。
 * 給 job（這次 MCP 送的那張）就沿用它的提示詞、分級、底模、LoRA；不然要給 image（/api/image?… 或完整網址）和 positive。
 */
async function fixImage(args) {
  const mode = String(args.mode || "");
  if (!["face", "quick", "deep"].includes(mode)) throw new Error("mode 只收 face（修臉）、quick（快速放大）、deep（深度放大）");
  const from = args.job ? jobs.get(String(args.job)) : null;
  if (args.job && !from) throw new Error("找不到這個 job（MCP 重開過？）：改給 image 和 positive");
  if (from && from.state !== "done") throw new Error("那張還沒畫完：先用 image_status 等它");
  let image = String(args.image || from?.image || "");
  if (image.startsWith(BASE)) image = image.slice(BASE.length);
  if (!image.startsWith("/api/image?")) throw new Error("image 要是墨池的圖片網址（/api/image?… 開頭，或 generate_image 回的 imageUrl）");
  const raw = String(args.positive || from?.positive || "").trim();
  if (!raw) throw new Error("要給 positive（那張圖的提示詞）");
  guard(raw);
  const scale = mode === "face" ? 1 : Math.max(1.25, Math.min(3, Number(args.scale) || HIRES_SCALE[mode]));
  const rating = E.RATINGS.includes(args.rating) ? args.rating : from?.rating || ratingOf(args, raw);
  const { positive, added, dropped } = mochiTail(raw, rating);
  const body = {
    positive: E.escapeForComfy(positive),
    rating,
    ...(from?.width ? { width: from.width, height: from.height } : {}),
    ...(args.seed !== undefined && args.seed !== null && args.seed !== "" ? { seed: Number(args.seed) >>> 0 } : {}),
    ...((args.ckpt || from?.ckpt) ? { ckpt: String(args.ckpt || from.ckpt) } : {}),
    ...((args.loras || from?.loras) ? { loras: args.loras || from.loras } : {}),
    hires: mode === "face" ? { mode, image } : { mode, scale, image },
  };
  const job = await startJob(body, { positive, rating, ckpt: body.ckpt, loras: body.loras, fixed: mode, tidied: tidyNote(added, dropped) });
  return waitJob(job, args.wait_seconds);
}

/** 你在墨池存的：牌組、自製牌、偏好角色（要開著墨池）。 */
async function myCards({ kind } = {}) {
  const want = kind && kind !== "all" ? [kind] : ["decks", "custom", "characters"];
  const out = {};
  const zhList = (tags, weights = {}) => tags.map((t) => (weights[t] && weights[t] !== 1 ? `${label(t)}×${weights[t]}` : label(t)));
  if (want.includes("decks")) {
    out.decks = (await mine("decks")).map((d) => ({ name: d.name, cards: zhList(d.tags || [], d.weights || {}) }));
  }
  if (want.includes("custom")) {
    out.customCards = (await mine("custom")).map((c) => ({
      tag: "custom:" + c.id,
      name: c.name,
      rating: c.rating,
      cards: (c.members || []).map((m) => (m.w && m.w !== 1 ? `${label(m.tag)}×${m.w}` : label(m.tag))),
      extra: (c.extra || []).map((x) => x.text),
    }));
  }
  if (want.includes("characters")) {
    const all = await mine("chars");
    out.favoriteCharacters = all.filter((t) => lex.byTag.has(t) && !isBanned(t)).map(label);
    const skipped = all.length - out.favoriteCharacters.length;
    if (skipped) out.favoriteCharactersSkipped = `${skipped} 個不在詞庫或是禁用角色，不能用`;
  }
  out.howTo = "draw_prompt／check_cards：deck 填牌組名稱；pins 放 custom:… 或自製牌名稱；favoriteCharacter: true 從偏好角色挑一個。";
  return out;
}

function waitJob(job, seconds) {
  const ms = Math.max(0, Math.min(110, Number(seconds ?? 50))) * 1000;
  if (job.state === "done" || job.state === "error" || !ms) return report(job);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(report(job)), ms);
    job.waiters.push(() => {
      clearTimeout(t);
      resolve(report(job));
    });
  });
}

async function report(job) {
  const out = { job: job.id, state: job.state, progress: Math.round(job.progress * 100) + "%", ...(job.tidied ? { tidied: job.tidied } : {}) };
  if (job.state === "error") return { ...out, error: job.error };
  if (job.state !== "done") return { ...out, next: "還沒畫完：用 image_status 帶這個 job 接著等。" };
  const url = BASE + job.image;
  const result = { ...out, seed: job.seed, imageUrl: url, positive: job.positive, note: "已記進墨池的出圖日誌（作品冊「日誌」，來源寫 AI）。" };
  // 附一張 480 寬的縮圖（墨池的 ?w=480），對話裡直接看得到。原圖看 imageUrl。
  try {
    const r = await fetch(url + (url.includes("?") ? "&" : "?") + "w=480");
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 4_000_000) result._image = { data: buf.toString("base64"), mimeType: (r.headers.get("content-type") || "image/png").split(";")[0] };
    }
  } catch {
    /* 縮圖拿不到就只給網址 */
  }
  return result;
}

async function imageStatus({ job, wait_seconds }) {
  const j = jobs.get(String(job ?? ""));
  if (!j) {
    // 這個 MCP 程式重開過：問墨池（出圖日誌、ComfyUI）這張後來怎樣。
    const r = await mochi(`/api/gen/recover?job=${encodeURIComponent(String(job ?? ""))}`);
    const d = await r.json().catch(() => ({}));
    if (d.state === "done" && d.image) return report({ id: job, state: "done", progress: 1, image: d.image, seed: d.seed, positive: "" });
    return { job, state: d.state || "unknown", note: "這張不是這次開的 MCP 送的；墨池那邊的狀態如上。" };
  }
  return waitJob(j, wait_seconds);
}

/**
 * 底模全列（十幾個）；LoRA 常有上千個，不全列：給 lora_query 才找（檔名、標題、分類），最多 30 個，附觸發詞。
 * 底模填 ckpt_name（含子資料夾，墨池生圖認這個）；LoRA 照墨池 LoRA 面板送的格式 {file, folder, strength}。
 */
async function listModels({ lora_query } = {}) {
  const [c, l] = await Promise.all([mochi("/api/checkpoints"), mochi("/api/loras")]);
  const cj = await c.json().catch(() => ({}));
  const lj = await l.json().catch(() => ({}));
  const ckpts = (cj.items || []).map((x) => (typeof x === "string" ? x : x.ckpt_name || x.file)).filter(Boolean);
  const all = Array.isArray(lj.items) ? lj.items : [];
  const q = String(lora_query ?? "").trim().toLowerCase();
  const loras = q
    ? all
        .filter((x) => [x.file, x.name, x.title, x.category, x.folder].some((v) => String(v || "").toLowerCase().includes(q)))
        .slice(0, 30)
        .map((x) => ({ file: x.file, folder: x.folder || "", title: x.title || x.name || "", category: x.category || "", triggers: (x.trainedWords || []).slice(0, 2) }))
    : undefined;
  return {
    checkpoints: ckpts,
    currentCheckpoint: cj.current || null,
    loraCount: all.length,
    ...(lj.counts ? { loraCategories: lj.counts } : {}),
    ...(loras ? { loras } : { loraHint: "LoRA 太多不全列：給 lora_query（檔名、標題或分類的一部分）再查。" }),
    note: "generate_image 的 ckpt 填 checkpoints 裡的字串，不給就用墨池目前的底模。loras 填 [{\"file\": …, \"folder\": …, \"strength\": 0.8}]，觸發詞要自己加進 positive。",
  };
}

async function recentImages({ limit }) {
  const n = Math.max(1, Math.min(30, Number(limit) || 10));
  const r = await mochi(`/api/genlog?limit=${n}`);
  const d = await r.json().catch(() => ({}));
  const list = d.items || d.entries || d.log || [];
  return {
    images: list.slice(0, n).map((e) => ({
      ok: e.ok !== false,
      from: { mochi: "墨池", fuse: "疊印台", mcp: "AI" }[e.origin] || e.origin || "",
      positive: e.positive,
      seed: e.seed,
      rating: e.rating,
      imageUrl: e.image ? BASE + e.image : null,
      at: e.finishedAt || e.at || e.t,
    })),
  };
}

/* ================= MCP 協定 ================= */

const SECTIONS = ["subject", "feature", "pose", "clothing", "env"];
const strList = { type: "array", items: { type: "string" } };
const drawSchema = {
  pins: { ...strList, description: "一定要有的牌（詞庫 tag，用 search_cards 查到的那一欄原樣填）。可以寫份量 (tag:1.2)；也可以放自製牌（custom:… 或它的名字）" },
  weights: { type: "object", description: "份量 {tag: 0.6～1.5}，例如 {\"smile\": 1.3}；1 是不調" },
  deck: { type: "string", description: "套用你在墨池存的牌組（名稱，見 my_cards）：整組的牌和份量先放進來，pins 再加上去" },
  favoriteCharacter: { type: "boolean", description: "從你在卡冊標的偏好角色挑一個釘上（用 seed 挑，同設定同結果）" },
  bans: { ...strList, description: "不要出現的牌" },
  extra: { ...strList, description: "詞庫沒有、自己寫的英文 Danbooru tag（不經規則檢查，越少越好）" },
  counts: {
    type: "object",
    description: "各段隨機補幾張（不含釘選）。題目明確給 1～2，模糊用預設 feature 5、pose 4、clothing 3、env 4。",
    properties: Object.fromEntries(["feature", "pose", "clothing", "env"].map((s) => [s, { type: "integer", minimum: 0, maximum: 10 }])),
  },
  focus: { type: "object", description: "張數比格子少時優先補哪幾格，例如 {\"pose\":[\"face\",\"camera\"]}。格子名見 mochi_guide。" },
  heats: { type: "array", items: { type: "string", enum: E.HEATS }, description: "尺度：activity 全年齡日常、tease 誘惑、flash 走光、sex 性愛。尺度、分級都沒給就是全年齡" },
  rating: { type: "string", enum: E.RATINGS, description: "分級：general 全年齡、sensitive 敏感、explicit 色情。只給尺度時照尺度推（有性愛、走光就是色情）" },
  eras: { type: "array", items: { type: "string", enum: E.ERAS } },
  girl: { type: "boolean", description: "有女性（預設 true）" },
  boy: { type: "boolean", description: "有男性（預設 false）" },
  people: { type: "boolean", description: "設 false：沒釘人數時不自動補 1girl" },
  sceneMode: { type: "string", enum: E.SCENE_MODES },
  width: { type: "integer" },
  height: { type: "integer" },
};

const TOOLS = [
  {
    name: "mochi_guide",
    description: "墨池的架構說明：五段、子分類、尺度、分級、時代、互斥與附帶規則、建議流程。第一次用先讀這個。",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: () => ({ text: guide() }),
  },
  {
    name: "search_cards",
    description: "用中文或英文查墨池詞庫的牌（一次可以查好幾個關鍵字）。回 tag、中文、段與子分類、尺度、時代、性別限制。",
    inputSchema: {
      type: "object",
      properties: {
        queries: { ...strList, description: "關鍵字，例如 [\"公園\",\"棒球\",\"成熟女性\"]" },
        section: { type: "string", enum: SECTIONS, description: "只找這一段（選填）" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: ["queries"],
    },
    annotations: { readOnlyHint: true },
    run: searchCards,
  },
  {
    name: "explain_card",
    description: "解釋一張牌：跟哪些牌互斥、會附帶什麼、誰會帶出它、在哪些尺度／時代／性別才會出現。",
    inputSchema: { type: "object", properties: { tag: { type: "string" } }, required: ["tag"] },
    annotations: { readOnlyHint: true },
    run: explainCard,
  },
  {
    name: "check_cards",
    description: "檢查一組牌放在一起會怎樣：哪些互斥被換掉、哪些被尺度／分級／時代／情境擋掉（附原因）、會自動帶出哪些牌。",
    inputSchema: {
      type: "object",
      properties: { tags: { ...strList, description: "要放在一起的牌（可以寫份量、放自製牌）" }, deck: drawSchema.deck, heats: drawSchema.heats, rating: drawSchema.rating, eras: drawSchema.eras, girl: drawSchema.girl, boy: drawSchema.boy },
    },
    annotations: { readOnlyHint: true },
    run: checkCards,
  },
  {
    name: "draw_prompt",
    description: "照墨池的規則抽正向提示詞（跟網頁同一套引擎）。回 positive，以及每張牌的來源（釘選、附帶、隨機）和被拿掉的原因。不會生圖。",
    inputSchema: {
      type: "object",
      properties: { ...drawSchema, seed: { type: "integer", description: "抽牌用的種子（同一組設定＋種子抽出一樣的結果）" }, n: { type: "integer", minimum: 1, maximum: 4, description: "抽幾組" } },
    },
    annotations: { readOnlyHint: true },
    run: drawPrompt,
  },
  {
    name: "generate_image",
    description: "把正向提示詞送去墨池生圖（經墨池的生圖排程到 ComfyUI，跟網頁排同一個隊，記進作品冊的日誌）。送出前照墨池的結尾補齊：這個分級的分級字、品質字（masterpiece…）；補了什麼寫在 tidied。要開著墨池和 ComfyUI。最多等 wait_seconds 秒，畫完回縮圖和網址；沒畫完回 job，用 image_status 接著等。",
    inputSchema: {
      type: "object",
      properties: {
        positive: { type: "string", description: "draw_prompt 回的 positive（或改過的）。墨池會補齊分級字、品質字，不用自己寫" },
        rating: { type: "string", enum: E.RATINGS, description: "分級（決定負向提示詞）。不給就看 positive 尾巴的 general／sensitive／explicit" },
        width: { type: "integer", description: "直圖 832×1216、橫圖 1216×832、方圖 1024×1024" },
        height: { type: "integer" },
        seed: { type: "integer", description: "生圖種子（同提示詞＋同種子＝同構圖）；不給就隨機" },
        ckpt: { type: "string", description: "底模檔名（list_models 查）；不給用墨池預設" },
        loras: { type: "array", description: "list_models 查到的 LoRA；觸發詞自己加進 positive", items: { type: "object", properties: { file: { type: "string" }, folder: { type: "string" }, strength: { type: "number" } }, required: ["file"] } },
        era: { type: "string", enum: E.ERAS, description: "記進日誌用（作品冊照這張再印時帶回時代）" },
        wait_seconds: { type: "integer", minimum: 0, maximum: 110, description: "最多等幾秒（預設 50）" },
      },
      required: ["positive"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    run: generateImage,
  },
  {
    name: "fix_image",
    description: "對印好的圖再跑一次：face 修臉（原尺寸）、quick 快速放大（預設 1.5 倍，構圖不動）、deep 深度放大（放大模型＋輕重畫，預設 2 倍）。跟墨池成品牆的修臉、Hires 同一條路，結果也記進日誌。",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["face", "quick", "deep"] },
        job: { type: "string", description: "generate_image 回的 job：沿用那張的提示詞、分級、底模、LoRA" },
        image: { type: "string", description: "沒有 job 時：墨池的圖片網址（imageUrl 或 /api/image?…）" },
        positive: { type: "string", description: "沒有 job 時要給：那張圖的提示詞" },
        scale: { type: "number", minimum: 1.25, maximum: 3, description: "放大倍數（face 不用）" },
        rating: drawSchema.rating,
        seed: { type: "integer" },
        wait_seconds: { type: "integer", minimum: 0, maximum: 110, description: "最多等幾秒（預設 50）" },
      },
      required: ["mode"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    run: fixImage,
  },
  {
    name: "my_cards",
    description: "你在墨池存的：牌組、自製牌、卡冊標的偏好角色（要開著墨池）。抽牌時可以用 deck、custom:…、favoriteCharacter 套用。",
    inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["all", "decks", "custom", "characters"] } } },
    annotations: { readOnlyHint: true },
    run: myCards,
  },
  {
    name: "image_status",
    description: "接著等 generate_image 還沒畫完的那張。",
    inputSchema: { type: "object", properties: { job: { type: "string" }, wait_seconds: { type: "integer", minimum: 0, maximum: 110 } }, required: ["job"] },
    annotations: { readOnlyHint: true },
    run: imageStatus,
  },
  {
    name: "list_models",
    description: "列出墨池看得到的底模（checkpoint）；LoRA 給 lora_query 才找（附觸發詞）。",
    inputSchema: { type: "object", properties: { lora_query: { type: "string", description: "LoRA 的檔名、標題或分類的一部分" } } },
    annotations: { readOnlyHint: true },
    run: listModels,
  },
  {
    name: "recent_images",
    description: "墨池最近印的圖（出圖日誌）：提示詞、種子、網址、從哪裡送的。",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 30 } } },
    annotations: { readOnlyHint: true },
    run: recentImages,
  },
];

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

async function callTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { content: [{ type: "text", text: `沒有這個工具：${name}` }], isError: true };
  try {
    const out = await tool.run(args || {});
    if (typeof out?.text === "string" && Object.keys(out).length === 1) return { content: [{ type: "text", text: out.text }] };
    const { _image, ...rest } = out || {};
    // 不加縮排：AI 讀得懂，字數少一半。
    const content = [{ type: "text", text: JSON.stringify(rest) }];
    if (_image) content.push({ type: "image", data: _image.data, mimeType: _image.mimeType });
    return { content };
  } catch (err) {
    return { content: [{ type: "text", text: String(err?.message || err) }], isError: true };
  }
}

async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => id !== undefined && send({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => id !== undefined && send({ jsonrpc: "2.0", id, error: { code, message } });
  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "mochi", title: "墨池 Mochi", version: VERSION },
        instructions: "墨池的詞庫與抽牌規則（Danbooru tag → Illustrious 提示詞），可以經墨池生圖。先讀 mochi_guide。不畫未成年。",
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS.map(({ run, ...t }) => t) });
    case "tools/call":
      return reply(await callTool(params?.name, params?.arguments));
    default:
      if (method?.startsWith("notifications/")) return;
      return fail(-32601, `不支援 ${method}`);
  }
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "不是 JSON" } });
      continue;
    }
    handle(msg).catch((err) => {
      log("mochi-mcp:", err?.stack || err);
      if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(err?.message || err) } });
    });
  }
});
process.stdin.on("end", () => process.exit(0));
log(`mochi-mcp ${VERSION}：詞庫 ${items.length} 張牌，墨池 ${BASE}`);
