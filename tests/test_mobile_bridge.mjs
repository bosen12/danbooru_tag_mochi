// 墨池 iPhone App 的抽牌橋（web6/mobile-bridge.js）：App 不自己寫規則，全部經過這支呼叫墨池網頁同一套模組。
// 這裡守住：同一顆種子抽出來跟網頁的路（drawWithSeed ＋ withEffectiveHeats）一模一樣、沒存設定時是全年齡、
// 禁用角色和分級用不了的牌放不進去、份量寫回提示詞、送 ComfyUI 前跳脫括號、英文版的字照 locales/en.js。
// node scripts/test_mobile_bridge.mjs（英文那段由自己再開一個 node 跑：語言在載入 i18n.js 時就決定了）。
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(spec, ctx, next) {
  if (ctx.parentURL && ctx.parentURL.includes("/web6/") && (spec.startsWith("./") || spec.startsWith("../"))) {
    const u = new URL(spec, ctx.parentURL);
    if (u.protocol === "file:" && !existsSync(fileURLToPath(u))) return next(u.href.replace("/web6/", "/web/"), ctx);
  }
  return next(spec, ctx);
}`)
);
const EN = process.env.MOBILE_BRIDGE_EN === "1";
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.addEventListener ??= () => {};
globalThis.MochiLanguage = { resolve: () => (EN ? "en" : "zh-Hant") };
// boot() 用 fetch 讀詞庫、卡面清單：這裡直接讀檔（App 那邊是 WKWebView 的 mochi-engine://）。
const WEB = new URL("../web/", import.meta.url);
globalThis.fetch = async (url) => {
  const path = fileURLToPath(new URL(String(url), WEB));
  if (!existsSync(path)) return { ok: false, status: 404, json: async () => ({}) };
  const body = readFileSync(path, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const dir = existsSync(new URL("../web6/mobile-bridge.js", import.meta.url)) ? "../web6/" : "../web/";
const B = await import(new URL(dir + "mobile-bridge.js", import.meta.url));
const E = await import(new URL("../web/engine.js", import.meta.url));
const { drawWithSeed, withEffectiveHeats } = await import(new URL("../web/draw-with-seed.js", import.meta.url));
const { HARD_BANNED } = await import(new URL("../web/card-art.js", import.meta.url));

let failed = 0;
const ok = (name, cond, detail = "") => {
  if (cond) console.log("ok   " + name);
  else {
    failed++;
    console.log("FAIL " + name + (detail ? "\n     " + detail : ""));
  }
};

const meta = await B.boot({ base: "./" });
const data = JSON.parse(readFileSync(new URL("lexicon.json", WEB), "utf8"));
const lex = E.indexLexicon(data);

if (EN) {
  ok("英文：尺度、分級照 locales/en.js", meta.english && meta.heats[0].label === "Activity" && meta.ratings[0].label === "General", JSON.stringify(meta.heats));
  const r = B.draw({ settings: null, pins: [], bans: [], weights: {} }, { n: 1, seeds: [7] });
  ok("英文：成品小牌的來源寫英文", r.shots[0].cards.every((c) => !/[㐀-鿿]/.test(c.label)), JSON.stringify(r.shots[0].cards.map((c) => c.label)));
  process.exit(failed ? 1 : 0);
}

const empty = { settings: null, pins: [], bans: [], weights: {} };
ok("沒存過設定：全年齡（general），尺度實際用 activity", meta.defaults.rating === "general" && withEffectiveHeats(meta.defaults).heats.join() === "activity", JSON.stringify(meta.defaults.heats));

// 同一顆種子：橋抽出來的跟網頁那條路（drawWithSeed、withEffectiveHeats）一字不差。
{
  const seeds = [1, 42, 9001, 123456789];
  const r = B.draw(empty, { n: seeds.length, seeds });
  const s = withEffectiveHeats(E.sanitizeSettings({ rating: "general" }, data));
  const same = seeds.every((seed, i) => r.shots[i] && r.shots[i].positive === drawWithSeed(lex, s, new Set(), new Set(HARD_BANNED), seed).positive);
  ok("同一顆種子跟網頁抽出來一樣", same, r.shots.map((x) => x.positive).join("\n     "));
}

// 放牌：附帶、互斥照 applyPin；成品上那張標「釘選」，份量寫回 (tag:1.2)。
{
  const tag = lex.byTag.has("smile") ? "smile" : data.tags.find((x) => x.section === "feature").tag;
  let st = B.pin(empty, tag).state;
  ok("放牌：進了合成池", st.pins.includes(tag));
  st = B.weigh(st, tag, 1).state;
  ok("份量往上一檔：1.2", st.weights[tag] === 1.2, JSON.stringify(st.weights));
  const shot = B.draw(st, { n: 1, seeds: [5] }).shots[0];
  ok("成品：釘的牌來源是釘選、寫成 (tag:1.2)", shot.cards.some((c) => c.tag === tag && c.from === "pin" && c.label === "釘選") && shot.positive.includes(`(${tag}:1.2)`), shot.positive);
  st = B.clear(st, tag).state;
  ok("拿掉：合成池和份量都清掉", !st.pins.includes(tag) && !(tag in st.weights));
}

// 互斥：同一格的第二張換掉第一張，回報換下來的。
{
  const pair = data.tags.filter((x) => x.mutex === "hair_length").map((x) => x.tag).slice(0, 2);
  if (pair.length === 2) {
    const a = B.pin(empty, pair[0]).state;
    const r = B.pin(a, pair[1]);
    ok("互斥：後放的換掉先放的，說得出原因", r.state.pins.includes(pair[1]) && !r.state.pins.includes(pair[0]) && r.gone.includes(pair[0]) && r.note.length > 0, JSON.stringify(r));
  }
}

// 禁用角色：放不進去、抽不出來、blocked() 抓得到。
{
  const ban = (data.characterBan || [])[0];
  if (ban) {
    const r = B.pin(empty, ban);
    ok("禁用角色放不進合成池", r.refused && !r.state.pins.includes(ban), JSON.stringify(r));
    ok("blocked() 抓到禁用角色（底線、份量寫法也算）", B.blocked(`1girl, (${ban.replace(/ /g, "_")}:1.2)`).length === 1);
    const s = B.draw(empty, { n: 1, seeds: [3], extras: [{ text: ban, w: 1 }] }).shots[0];
    ok("自製牌的詞庫外字是禁用角色：不進提示詞", !s.positive.toLowerCase().includes(ban.toLowerCase()), s.positive);
  }
}

// 分級：全年齡用不了的牌放不進去，字盒也看不到。
{
  const adult = data.tags.find((x) => lex.byTag.has(x.tag) && E.ratingBlocked(x, "general") && !E.ratingBlocked(x, "explicit") && x.section === "pose");
  ok("找得到全年齡用不了的牌（測試樣本）", !!adult);
  if (adult) {
    const r = B.pin(empty, adult.tag);
    ok("全年齡：色情的牌放不進去，提示換分級", !!r.refused && !r.state.pins.includes(adult.tag), JSON.stringify(r.refused));
    const lib = B.library(empty, { query: adult.tag, limit: 500 });
    ok("全年齡：字盒看不到色情的牌", !lib.cards.some((c) => c.tag === adult.tag));
  }
}

// 字盒搜尋：中文、英文都找得到（cards.js 的 searchCards）。
{
  const zh = B.library(empty, { query: "微笑" });
  const en = B.library(empty, { query: "smile" });
  ok("字盒：中文、英文都搜得到", zh.total > 0 && en.total > 0 && en.cards[0].tag === "smile", `${zh.total} ${en.total} ${en.cards[0]?.tag}`);
}

// 每段張數：照 stepSkeleton，骨架格跟著熄。
{
  const r = B.configure(empty, { count: ["feature", 1] }).state.settings;
  ok("每段張數：長相 1，其他骨架格熄掉", r.counts.feature === 1 && r.offGroups.some((k) => k.startsWith("feature:")), JSON.stringify(r.offGroups));
  const g = B.rules(empty);
  ok("全年齡：只有活動亮著，走光、性愛被分級擋掉", g.heats.filter((h) => h.on).map((h) => h.id).join() === "activity" && g.heats.find((h) => h.id === "sex").blocked && g.heats.find((h) => h.id === "sex").why.length > 0, JSON.stringify(g.heats));
  const x = B.configure(empty, { heat: "sex" });
  ok("全年齡：按性愛被擋下", !!x.refused);
  const m = B.configure(empty, { era: "mix" }).state;
  ok("時代：混合＝全部時代＋eraMix", B.rules(m).era === "mix" && m.settings.eraMix === true);
  const one = B.configure(empty, { era: "edo" }).state;
  ok("時代：指定江戶", B.rules(one).era === "edo" && one.settings.eras.join() === "edo");
  const boy = B.configure(empty, { who: "boy" }).state;
  ok("畫面裡有誰：男", B.rules(boy).who === "boy" && boy.settings.girl === false);
  const s = B.configure(empty, { size: "portrait" }).state.settings;
  ok("尺寸：直 832×1216", s.width === 832 && s.height === 1216);
}

// 送 ComfyUI：消歧義括號跳脫、份量照留。
ok("toComfy：bow (weapon) 跳脫，(smile:1.2) 不動", B.toComfy("bow (weapon), (smile:1.2)") === "bow \\(weapon\\), (smile:1.2)", B.toComfy("bow (weapon), (smile:1.2)"));

// 英文版：另開一個 node（i18n.js 載入時就決定語言）。
{
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, MOBILE_BRIDGE_EN: "1" }, encoding: "utf8" });
  process.stdout.write(r.stdout);
  if (r.status !== 0) {
    failed++;
    console.log("FAIL 英文版\n" + r.stderr);
  }
}

console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
