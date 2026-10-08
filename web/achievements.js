import { dateLocale } from "./i18n.js";
/**
 * 卡冊的成就牆：收集進度（每個花色點亮幾張）＋成就（分銅、銀、金、白金幾級）。
 * 只看不擋：沒解鎖的牌照樣能用，成就不鎖任何東西。
 *
 * 資料都是現成的：卡冊的使用次數（usage.js）、出圖日誌的統計（/api/genlog/stats：印好幾張、
 * 收藏、每天張數、幾點印的、作品冊幾件）。收集以「目前分級看得到的牌」算，跟卡冊摘要一致。
 * 解鎖到第幾級記在這個瀏覽器（ACH_KEY），新解鎖的跳一則提示；第一次打開不洗版，只說一句總數。
 */
import { el, openSheet, toast } from "./ui.js";
import { enter, reducedMotion, DUR, CURVE, css } from "./motion.js";
import { CARD_SUITS, CARD_SUIT_INFO } from "./cards.js";

const ACH_KEY = "mochi.achieve.v1";
const TIER = ["銅", "銀", "金", "白金"];

/**
 * 每一項：goals 是每一級的門檻（一級的就是「達成」），value(f) 算現在到哪。
 * unit 寫在進度後面；needsLog：要有出圖日誌才算得出來。
 */
export const ACHIEVEMENTS = [
  { id: "kinds", name: "牌友", glyph: "牌", goals: [50, 200, 500, 1000], unit: "種", desc: (g) => `用過 ${g} 種不同的牌`, value: (f) => f.kinds },
  { id: "group", name: "一門到底", glyph: "門", goals: [1, 10, 30], unit: "個", desc: (g) => `集滿 ${g} 個細分類（裡面每張都用過）`, value: (f) => f.groupsFull },
  { id: "suit", name: "花色大全", glyph: "花", goals: [1, 3, CARD_SUITS.length], unit: "個", desc: (g) => (g === CARD_SUITS.length ? `${g} 個花色全部集滿` : `集滿 ${g} 個花色`), value: (f) => f.suitsFull },
  { id: "loyal", name: "老朋友", glyph: "友", goals: [25, 100, 500], unit: "次", desc: (g) => `同一張牌用過 ${g} 次`, value: (f) => f.maxCard },
  { id: "hands", name: "親手挑", glyph: "手", goals: [50, 300, 1000], unit: "次", desc: (g) => `親手放進池子的牌累計 ${g} 次`, value: (f) => f.mine },
  { id: "prints", name: "印刷工", glyph: "印", goals: [10, 100, 500, 2000], unit: "張", desc: (g) => `印好 ${g} 張`, value: (f) => f.prints, needsLog: true },
  { id: "works", name: "收藏家", glyph: "藏", goals: [1, 10, 50, 200], unit: "件", desc: (g) => `作品冊收了 ${g} 件`, value: (f) => f.works, needsLog: true },
  { id: "eye", name: "好眼光", glyph: "眼", goals: [25], unit: "%", desc: () => "印好 40 張以上，收藏率到兩成五", value: (f) => (f.prints >= 40 ? Math.round((f.fav / f.prints) * 100) : 0), needsLog: true },
  { id: "streak", name: "天天印", glyph: "日", goals: [3, 7, 30], unit: "天", desc: (g) => `連續 ${g} 天都有印`, value: (f) => f.streak, needsLog: true },
  { id: "marathon", name: "一日百張", glyph: "百", goals: [30, 100], unit: "張", desc: (g) => `同一天印好 ${g} 張`, value: (f) => f.maxDay, needsLog: true },
  { id: "night", name: "夜貓", glyph: "夜", goals: [10, 100], unit: "張", desc: (g) => `半夜十二點到五點印好 ${g} 張`, value: (f) => f.night, needsLog: true },
];

/** 卡冊的資料 → 算成就要的數字。cards：目前分級看得到的牌。 */
export function measure({ cards, usage, war }) {
  const count = (t) => usage.counts[t] || 0;
  const suits = CARD_SUITS.map((s) => {
    const list = cards.filter((c) => c.suit === s);
    return { suit: s, total: list.length, used: list.filter((c) => count(c.tag) > 0).length };
  });
  const groups = new Map();
  for (const c of cards) {
    const g = groups.get(c.group) || { total: 0, used: 0 };
    g.total += 1;
    g.used += count(c.tag) > 0 ? 1 : 0;
    groups.set(c.group, g);
  }
  const days = Object.keys(war?.days || {}).sort();
  let streak = 0;
  let run = 0;
  let prev = 0;
  for (const d of days) {
    const t = Date.parse(d + "T12:00:00");
    run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    streak = Math.max(streak, run);
    prev = t;
  }
  const hours = war?.hours || [];
  return {
    suits,
    kinds: cards.filter((c) => count(c.tag) > 0).length,
    groupsFull: [...groups.values()].filter((g) => g.total > 0 && g.used === g.total).length,
    groupsTotal: groups.size,
    suitsFull: suits.filter((s) => s.total > 0 && s.used === s.total).length,
    maxCard: Math.max(0, ...cards.map((c) => count(c.tag))),
    mine: Object.values(usage.mine || {}).reduce((a, n) => a + n, 0),
    prints: war?.total || 0,
    fav: war?.fav || 0,
    works: war?.works || 0,
    streak,
    maxDay: Math.max(0, ...Object.values(war?.days || {})),
    night: [0, 1, 2, 3, 4].reduce((a, h) => a + (hours[h] || 0), 0),
    hasLog: !!war && !war.failed,
  };
}

/** 每一項現在第幾級（0＝還沒）、下一級的門檻。 */
export function evaluate(f) {
  return ACHIEVEMENTS.map((a) => {
    const value = a.value(f);
    const level = a.goals.filter((g) => value >= g).length;
    const next = a.goals[level] ?? null;
    return { ...a, value, level, next, max: a.goals.length, known: !a.needsLog || f.hasLog };
  });
}

export const tierName = (a, level) => (a.goals.length === 1 ? "達成" : TIER[level - 1] || "");

function readSeen() {
  try {
    const v = JSON.parse(localStorage.getItem(ACH_KEY) || "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

function writeSeen(v) {
  try {
    localStorage.setItem(ACH_KEY, JSON.stringify(v));
  } catch {
    /* 存不了：下次再提示一次而已 */
  }
}

/**
 * 跟上次比：新解鎖（或升級）的跳提示。第一次（這個瀏覽器沒記錄）只記下來、說一句總數。
 * 統計還沒到（日誌那幾項 known=false）的先不比，免得日誌一到又全部重跳。
 */
export function announce(list, open) {
  const seen = readSeen();
  const now = Date.now();
  const next = { ...(seen || {}) };
  const fresh = [];
  for (const a of list) {
    if (!a.known) continue;
    const was = seen?.[a.id]?.[0] || 0;
    if (a.level > was) {
      next[a.id] = [a.level, now];
      if (seen) fresh.push(a);
    }
  }
  writeSeen(next);
  const action = { label: "看成就", run: open };
  if (!seen) {
    const n = list.filter((a) => a.level > 0).length;
    if (n) toast(`成就牆開張：已經解鎖 ${n} 項`, { action });
    return;
  }
  if (fresh.length === 1) toast(`解鎖成就：${fresh[0].name}（${tierName(fresh[0], fresh[0].level)}）`, { action });
  else if (fresh.length > 1) toast(`解鎖了 ${fresh.length} 項成就`, { action });
}

export function unlockedAt(id) {
  return readSeen()?.[id]?.[1] || 0;
}

const pctOf = (v, g) => Math.max(0, Math.min(1, g ? v / g : 1));

/** 成就牆。f：measure() 的結果；list：evaluate() 的結果。 */
export function openWall(f, list) {
  const done = list.filter((a) => a.level > 0).length;
  const suitRows = f.suits.map((s) =>
    el(
      "div",
      { class: "ach-suit", style: `--suit: var(--suit-${s.suit}); --lit: ${pctOf(s.used, s.total)}` },
      el("b", { class: "ach-suit-glyph", "aria-hidden": "true" }, CARD_SUIT_INFO[s.suit].glyph),
      el("span", { class: "ach-suit-name" }, CARD_SUIT_INFO[s.suit].zh),
      el("span", { class: "ach-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(s.total), "aria-valuenow": String(s.used), "aria-label": `${CARD_SUIT_INFO[s.suit].zh}點亮 ${s.used} / ${s.total}` }, el("i")),
      el("span", { class: "ach-suit-n" }, `${s.used} / ${s.total}`)
    )
  );
  const badges = list.map((a) => {
    const top = a.level >= a.max;
    const goal = a.next ?? a.goals[a.goals.length - 1];
    const at = a.level ? unlockedAt(a.id) : 0;
    return el(
      "div",
      { class: "ach", role: "listitem", dataset: { level: String(a.level), tier: a.level ? String(Math.min(a.level, 4)) : "0", top: top ? "true" : "false" } },
      el("span", { class: "ach-medal", "aria-hidden": "true" }, a.glyph),
      el(
        "span",
        { class: "ach-body" },
        el("b", {}, a.name, a.level ? el("small", { class: "ach-tier" }, tierName(a, a.level)) : null),
        el("span", { class: "ach-desc" }, a.known ? (top ? `${a.desc(a.goals[a.goals.length - 1])}・全部達成` : a.desc(goal)) : "要出圖日誌（重開一次伺服器）"),
        a.known && !top
          ? el(
              "span",
              { class: "ach-progress" },
              el("span", { class: "ach-bar", style: `--lit: ${pctOf(a.value, goal)}` }, el("i")),
              el("small", {}, `${a.value.toLocaleString(dateLocale)} / ${goal.toLocaleString(dateLocale)}${a.unit === "%" ? "" : " "}${a.unit}`)
            )
          : null,
        at ? el("small", { class: "ach-at" }, `解鎖於 ${new Date(at).toLocaleDateString(dateLocale)}`) : null
      )
    );
  });
  const body = el(
    "div",
    { class: "ach-wall" },
    el(
      "section",
      {},
      el("h3", {}, "收集進度", el("small", {}, `點亮 ${f.kinds} 種・集滿 ${f.groupsFull} / ${f.groupsTotal} 個細分類・以目前分級看得到的牌算`)),
      el("div", { class: "ach-suits" }, suitRows)
    ),
    el("section", {}, el("h3", {}, "成就", el("small", {}, `${done} / ${list.length} 項・只看不擋，沒解鎖的牌照樣能用`)), el("div", { class: "ach-grid", role: "list" }, badges))
  );
  openSheet("成就牆", body, { wide: true });
  if (!reducedMotion()) {
    [...body.querySelectorAll(".ach-bar i")].forEach((bar) => bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: DUR.long, easing: css(CURVE.out), fill: "backwards", delay: DUR.short }));
    [...body.querySelectorAll(".ach")].forEach((n, i) => enter(n, { delay: DUR.micro + i * 30 }));
  }
}
