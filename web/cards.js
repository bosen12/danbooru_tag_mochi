/**
 * 墨池的卡牌：整本詞庫 → 卡牌資料，以及卡面 DOM。
 * 花色、分級、插畫檔名都來自 web/card-art.js（字鋪、烘焙腳本共用同一份）。
 */
import { isCard, cardSuit, ratingTier, artFile, artSources, artUrl, groupSeal, CARD_SUIT_INFO, CARD_SUITS } from "./card-art.js";
import { el } from "./ui.js";
import { miniSet, bindArt, artFallback } from "./card-images.js";
import { DUR, CURVE, css, reducedMotion } from "./motion.js";
import { english, registerLexicon, t } from "./i18n.js";

export { CARD_SUIT_INFO, CARD_SUITS };

export const ERA_ZH = {
  any: "不限時代",
  modern: "現代",
  ancient_china: "古中國",
  ancient_greece: "古希臘",
  medieval: "中世紀",
  edo: "江戶",
  victorian: "維多利亞",
};

export const RATING_ZH = { general: "全年齡", sensitive: "敏感", explicit: "色情" };

/** 詞庫 → 卡牌。順序照詞庫，所以同一類的字會排在一起。 */
export function buildLibrary(data, { ratingBlocked }) {
  registerLexicon(data);
  const cards = [];
  const byTag = new Map();
  for (const item of data.tags) {
    if (!isCard(item)) continue;
    const card = {
      tag: item.tag,
      zh: item.zh || item.tag,
      suit: cardSuit(item),
      // 字盒的分類籤照細分類（scripts/subgroups.py）；花色章仍看引擎的小分類。
      group: item.sub || item.group,
      groupZh: (data.groupZh && data.groupZh[item.sub || item.group]) || item.sub || item.group,
      seal: groupSeal(item),
      rating: ratingTier(item, ratingBlocked),
      gate: item.gate,
      eras: item.era || ["any"],
      item,
    };
    cards.push(card);
    byTag.set(card.tag, card);
  }
  // 詞庫本身是各段交錯的（每輪新字接在後面），照詞庫排的話同一類散在各處。
  // 改成花色 → 細分類（subOrder 的順序）；同一格裡維持詞庫順序（sort 是穩定的）。
  const subRank = new Map();
  for (const sec of ["subject", "clothing", "feature", "pose", "env", "quality"]) {
    for (const id of (data.subOrder && data.subOrder[sec]) || []) subRank.set(sec + ":" + id, subRank.size);
  }
  if (subRank.size) {
    const rank = (c) =>
      CARD_SUITS.indexOf(c.suit) * 100000 + (subRank.get(c.item.section + ":" + c.group) ?? 99999);
    cards.sort((a, b) => rank(a) - rank(b));
  }
  return { cards, byTag };
}

/**
 * 字盒的分類籤（細分類，見 scripts/subgroups.py）。
 * 同一家族（「地點・住家」的「地點」）連在一起的收成一串：家族名寫一次，籤上只寫後半，
 * 一個花色三十幾格也只佔幾行。章只在整格的牌都是同一個章時才標（細分類可能跨小分類收字）。
 * 回傳 [{ fam, seal, items: [{ g, zh, short, seal }] }]；fam 是 null 的那串就是單獨的籤。
 */
export function groupChips(cards) {
  // 章取這一格多數牌的章（過半才算）：「天空」收了一張滿月（小分類是場景雜項、沒有章），
  // 其他都是「天」章，籤上就標「天」。
  const subs = new Map();
  for (const c of cards) {
    let s = subs.get(c.group);
    if (!s) subs.set(c.group, (s = { g: c.group, zh: c.groupZh || c.group, n: 0, seals: new Map() }));
    s.n += 1;
    if (c.seal) s.seals.set(c.seal, (s.seals.get(c.seal) || 0) + 1);
  }
  for (const s of subs.values()) {
    const [top, n] = [...s.seals].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    s.seal = n * 2 > s.n ? top : null;
  }
  const runs = [];
  for (const s of subs.values()) {
    const cut = s.zh.indexOf("・");
    const fam = cut > 0 ? s.zh.slice(0, cut) : null;
    const item = { g: s.g, zh: s.zh, short: fam ? s.zh.slice(cut + 1) : s.zh, seal: s.seal };
    const last = runs[runs.length - 1];
    if (fam && last && last.fam === fam) last.items.push(item);
    else runs.push({ fam, items: [item] });
  }
  for (const r of runs) {
    if (r.fam && r.items.length === 1) {
      r.items[0].short = r.items[0].zh;
      r.fam = null;
    }
    const seals = new Map();
    for (const i of r.items) if (i.seal) seals.set(i.seal, (seals.get(i.seal) || 0) + 1);
    const [top, n] = [...seals].sort((a, b) => b[1] - a[1])[0] || [null, 0];
    r.seal = r.fam && n * 2 > r.items.length ? top : null;
  }
  return runs;
}

export function createAssets(manifest) {
  const have = new Set(Object.keys(manifest || {}));
  return {
    /** 原圖：放大牌、校樣、詳情用。 */
    art(tag) {
      return have.has(tag) ? artUrl({ ...manifest[tag], file: artFile(tag) }) : null;
    },
    /** 格子用：有縮圖就給 srcset，讓瀏覽器照畫出來的大小挑。 */
    sources(tag) {
      return have.has(tag) ? artSources({ ...manifest[tag], file: artFile(tag) }) : null;
    },
    /** 牌面用的細縮圖（card-images.js 照牌實際大小 × DPR 挑）；沒有或過期回 null。 */
    mini(tag) {
      return have.has(tag) ? miniSet({ ...manifest[tag], file: artFile(tag) }) : null;
    },
    count() {
      return have.size;
    },
  };
}

/** 一張牌。左邊是直排書脊（花色、字名、分級），疊起來也讀得到。 */
export function cardNode(card, assets, { tagName = "button", flag, src } = {}) {
  const len = [...card.zh].length;
  const art = assets.art(card.tag);
  const suit = CARD_SUIT_INFO[card.suit];
  const node = el(
    tagName,
    {
      class: "card",
      type: tagName === "button" ? "button" : undefined,
      dataset: { suit: card.suit, tag: card.tag },
      "aria-label": `${card.zh}（${card.tag}）・${suit.zh}${card.seal ? "・" + card.groupZh : ""}${card.rating !== "general" ? "・" + RATING_ZH[card.rating] : ""}`,
      role: tagName === "button" ? undefined : "img",
    },
    el(
      "span",
      { class: "card-spine", "aria-hidden": "true" },
      el("span", { class: "card-suit" }, suit.glyph),
      el("span", { class: "card-name", dataset: { len: String(Math.min(len, 8)) } }, card.zh),
      card.rating !== "general" ? el("span", { class: "card-rate", dataset: { r: card.rating } }, card.rating === "explicit" ? "色" : "敏") : null,
      card.seal ? el("span", { class: "card-seal", title: card.groupZh }, card.seal) : null
    ),
    el(
      "span",
      { class: "card-art", "aria-hidden": "true" },
      art ? artImg(assets.sources ? assets.sources(card.tag) : { src: art }, assets.mini?.(card.tag)) : el("span", { class: "card-glyph" }, english ? card.tag.slice(0, 2).toUpperCase() : [...card.zh][0]),
      flag ? el("span", { class: "card-flag", dataset: { kind: flag.kind } }, flag.text) : null,
      src ? el("span", { class: "card-flag", dataset: { kind: "src" } }, src) : null
    )
  );
  return node;
}

function artImg(sources, mini) {
  const i = bindArt(el("img", { alt: "", decoding: "async", draggable: "false" }), mini, sources);
  // 挑的細縮圖不見了就退回原圖；原圖也沒有才拿掉，露出底下的字。
  i.addEventListener("error", () => artFallback(i) || i.remove());
  // 圖晚到的（新換上來的影子、捲進來的字盒、連線慢的時候）：像印上去一樣顯影——從稍大、透明沉到定位，
  // 不要啪一下蓋上去。等的時候牌面有一道掃光（card.css 的 .card-art:has(> img:not([data-ready]))）。
  // 本來就在快取裡的（60ms 內就到）直接出現 —— 不能一律先藏起來等 load，那會讓每次重畫都閃一格空白。
  const born = performance.now();
  i.addEventListener(
    "load",
    () => {
      i.dataset.ready = "1";
      if (performance.now() - born > 60 && !reducedMotion())
        i.animate(
          [
            { opacity: 0, transform: "scale(1.08)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: DUR.long, easing: css(CURVE.out) }
        );
    },
    { once: true }
  );
  return i;
}

/**
 * 會整塊重畫、又一直在畫面上的牌（卡池、合成池）：圖立刻載、同步解碼。
 * 預設的 lazy＋async 是給上千張的字盒用的；這些牌每放一張、換一張試印就重畫一次，
 * lazy 的新 <img> 要等版面排好才開始載，重畫後第一格畫面圖是空的 —— 整排牌閃一下。
 */
export function eagerArt(node) {
  for (const img of node.querySelectorAll("img")) {
    img.loading = "eager";
    img.decoding = "sync";
  }
  return node;
}

/**
 * 找牌框裡打了字：grid 裡第一張牌標成「按 Enter 就是它」—— 浮起一點、描一圈、右下角一顆 Enter 鍵。
 * on=false 把標記拿掉。兩個房間的字盒共用。
 */
export function setEnterTarget(grid, on) {
  if (!grid) return;
  for (const n of grid.querySelectorAll(".card.is-enter-target")) {
    n.classList.remove("is-enter-target");
    n.querySelector(".enter-chip")?.remove();
  }
  if (!on) return;
  const first = grid.querySelector(".card[data-tag]");
  if (!first) return;
  first.classList.add("is-enter-target");
  const chip = document.createElement("span");
  chip.className = "enter-chip";
  chip.setAttribute("aria-hidden", "true");
  chip.textContent = "Enter";
  first.append(chip);
}

export function setCardFlag(node, flag) {
  const old = node.querySelector(".card-flag:not([data-kind='src'])");
  // 沒變就不動：字盒每動一次整排重新上標，不這樣的話每個章都會重蓋一次。
  if (old && flag && old.dataset.kind === flag.kind && old.textContent === t(flag.text)) return;
  old?.remove();
  if (!flag) return;
  const stampNow = !!node.isConnected;
  const f = el("span", { class: "card-flag", dataset: { kind: flag.kind } }, flag.text);
  node.querySelector(".card-art").append(f);
  // 新蓋上去的章（放進池子、丟進廢字簍）：像橡皮章一樣從上面壓下來。第一次畫出來的不蓋。
  if (stampNow && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    f.classList.add("is-stamping");
    setTimeout(() => f.classList.remove("is-stamping"), 420);
  }
}

/** 卡牌的說明（提示框、詳情共用）。 */
export function cardFacts(card, lex, data) {
  const facts = [];
  // 細分類名常以花色開頭（人數・女）：不要疊成「人數・人數・女」。
  const suitZh = CARD_SUIT_INFO[card.suit].zh;
  facts.push(["花色", card.groupZh.startsWith(suitZh + "・") ? card.groupZh : `${suitZh}・${card.groupZh}`]);
  facts.push(["分級", RATING_ZH[card.rating]]);
  facts.push(["時代", card.eras.map((e) => ERA_ZH[e] || e).join("、")]);
  if (card.gate === "female") facts.push(["人物", "只在有女性時"]);
  if (card.gate === "male") facts.push(["人物", "只在有男性時"]);
  const item = card.item;
  if (item.mutex) {
    // mutex 是內部代號（hair_length、female_count…），大半沒有中文名；
    // 舉兩個同格的字當例子，比露出代號好懂。
    const sibs = (lex.siblings && lex.siblings.get(card.tag)) || [];
    const eg = sibs.slice(0, 2).map((t) => lex.byTag.get(t)?.zh || t).join("、");
    facts.push(["同一格", sibs.length ? `一張圖只留一個：跟${eg}${sibs.length > 2 ? ` 等 ${sibs.length} 個` : ""}互斥` : "一張圖只留一個"]);
  }
  const rel = [...(item.implies || []), ...(item.bind || [])];
  if (rel.length) facts.push(["附帶", rel.map((t) => lex.byTag.get(t)?.zh || t).join("、")]);
  void data;
  return facts;
}
