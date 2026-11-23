/**
 * 偏好角色：墨池、疊印台、卡冊共用一份名單，張數不限、新加的在前。
 * 名單存在伺服器（data/fav_chars.json，/api/fav-chars），所有裝置共用；localStorage mochi.fav.chars.v1
 * 是這台的快取：開頁先用它畫（不用等網路），伺服器那份回來再換上。以前只存在瀏覽器，清掉資料、換台電腦就沒了；
 * 第一次連上伺服器時，這台的名單會併進伺服器那份（兩台電腦各自有的都留著）。
 * 規則的「只抽偏好角色」打開時，抽角色只從名單裡抽（engine.js 的 characterFavOnly／characterFavorites；
 * 名單不存在規則裡，抽牌那一刻由 withFavChars() 帶進去）。
 *
 * 管理的彈窗（openFavChars）：
 *   兩個頁籤「我的偏好」「加角色」、一個搜尋框（角色名、作品名都對得上，排序跟字盒一樣），
 *   子分類（性別、系列：跟字盒角色頁同一套籤，「動漫 65 ▸」點開是各部作品），下面一頁一頁的牌。
 *   一頁幾張照彈窗擺得下多少：欄看寬度、排看高度，翻頁鈕一直看得到。‹ › 換頁，鍵盤左右鍵、手機左右滑也行。
 *   點一張就加入／拿掉。「我的偏好」裡拿掉的那張先留在原位變淡，再點一下就回來（回到名單裡原本的位置）——
 *   換頁、換頁籤、換子分類、關掉之後才真的不見，所以不用另外跳「復原」。
 * 動態：換頁時舊的一頁往反方向淡出，新的一頁從翻頁的方向一張接一張滑進來；
 *   愛心按下去彈一下；規則上「偏好角色 N」的數字變了也彈一下。減少動態時都直接換。
 *
 * 愛心停靠點（favDock）：畫面右緣一顆直立的膠囊，平常收著。
 *   拖一張角色牌：它滑出來當落點，牌拖到上面時放大；放開，牌縮進愛心、數字彈一下。
 *   點愛心加入（卡冊的牌、詳情）：它也滑出來一下，讓那張牌飛進去，再收回去。
 *   墨池、疊印台、卡冊三個房間都是同一顆。
 * 愛心一律用 SVG 畫：畫面上不用表情符號、愛心這類符號字當標記（字型不同長得不一樣）。
 */
import { el, openSheet, toast } from "./ui.js";
import { cardNode, cardMatches, searchCards, groupChips, genderChips, chipRun, seriesRun, sizeCards } from "./cards.js";
import { cloneCard } from "./card-images.js";
import { DUR, CURVE, css, reducedMotion, flight, heightChange } from "./motion.js";
import { createSyncedList } from "./synced-list.js";
import { english } from "./i18n.js";

const HEART =
  '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 20.6 10.6 19.3C5.5 14.7 2.2 11.7 2.2 8 2.2 5 4.6 2.6 7.6 2.6c1.7 0 3.3.8 4.4 2.1 1.1-1.3 2.7-2.1 4.4-2.1 3 0 5.4 2.4 5.4 5.4 0 3.7-3.3 6.7-8.4 11.3L12 20.6z"/></svg>';

// 解析一次就好，之後每顆都複製：卡冊往下補格時，每張角色牌各解析一次 SVG 佔了補格時間的三到六成。
let heartSvg = null;
/** 一顆 SVG 愛心（字的大小、顏色跟著外面）。 */
export function heartIcon(cls = "") {
  if (!heartSvg) heartSvg = el("span", { html: HEART }).firstElementChild;
  const box = el("span", { class: ("heart-icon " + cls).trim(), "aria-hidden": "true" });
  box.append(heartSvg.cloneNode(true));
  return box;
}

// 名單本身、跟伺服器同步：synced-list.js（偏好卡牌也用同一套）。新加的在前。
// 有順序（order）：按錯拿掉、再按回來的放回原位，伺服器那份也照這台的順序排（不然伺服器把它當新加的、排到最前面）。
const store = createSyncedList({
  key: "mochi.fav.chars.v1",
  syncedKey: "mochi.fav.chars.synced",
  opsKey: "mochi.fav.chars.ops",
  url: "/api/fav-chars",
  order: true,
});

// 剛拿掉的記住它原本夾在誰中間：十分鐘內再加回來，放回原位，不是跑到第一位（2026-11-23 量：第 169 位按錯再按回來變第 1 位）。
const RESTORE_MS = 10 * 60 * 1000;
const gone = new Map();
function remember(t) {
  const list = store.list();
  const i = list.indexOf(t);
  if (i >= 0) gone.set(t, { prev: list[i - 1] ?? null, next: list[i + 1] ?? null, i, at: Date.now() });
}
function slotOf(t) {
  const g = gone.get(t);
  gone.delete(t);
  if (!g || Date.now() - g.at > RESTORE_MS) return 0;
  const list = store.list();
  if (g.next && list.includes(g.next)) return list.indexOf(g.next);
  if (g.prev && list.includes(g.prev)) return list.indexOf(g.prev) + 1;
  return Math.min(g.i, list.length);
}

export const favChars = {
  list: () => store.list(),
  has: (t) => store.has(t),
  get size() {
    return store.size;
  },
  add: (t) => !store.has(t) && store.add(t, slotOf(t)),
  remove(t) {
    remember(t);
    return store.remove(t);
  },
  /** 回傳換完之後是不是偏好。 */
  toggle(t) {
    if (store.has(t)) {
      favChars.remove(t);
      return false;
    }
    favChars.add(t);
    return true;
  },
  /** 名單變了就叫 f；回傳取消訂閱的函式。 */
  onChange: (f) => store.onChange(f),
};

/** 抽牌用的規則：「只抽偏好角色」開著才把名單帶進去（引擎看 characterFavorites）。 */
export function withFavChars(settings) {
  if (!settings || !settings.characterFavOnly) return settings;
  return { ...settings, characterFavorites: favChars.list() };
}

/** 一張角色牌：是偏好的就在圖的右下角掛一顆小愛心。 */
export function paintFavChar(node, tag) {
  const on = favChars.has(tag);
  const h = node.querySelector(".card-heart");
  if (on && !h) {
    const heart = heartIcon("card-heart");
    (node.querySelector(".card-art") || node).append(heart);
    if (node.isConnected && !reducedMotion()) pop(heart);
  } else if (!on && h) {
    h.remove();
  }
}

/** 字盒、卡盒裡所有的角色牌重新掛一次愛心。 */
export function paintFavChars(container) {
  if (!container) return;
  for (const n of container.querySelectorAll('.card[data-suit="chara"]')) paintFavChar(n, n.dataset.tag);
}

/** 規則上那顆「偏好角色 N」：數字變了彈一下。 */
export function favCharsButton(onClick) {
  const count = el("span", { class: "favc-count" }, String(favChars.size));
  const btn = el(
    "button",
    { class: "btn btn-small btn-ghost favc-open", type: "button", "aria-haspopup": "dialog", title: "偏好角色：挑幾個常用的角色，打開「只抽偏好角色」就只從這裡面抽" },
    heartIcon("favc-open-heart"),
    "偏好角色",
    count
  );
  btn.addEventListener("click", () => onClick(btn));
  const off = favChars.onChange((list) => {
    if (!btn.isConnected) return off();
    if (count.textContent === String(list.length)) return;
    count.textContent = String(list.length);
    if (!reducedMotion()) pop(count);
  });
  return btn;
}

/* ---------- 愛心停靠點 ---------- */

let dock = null;

/** 畫面右緣的愛心膠囊（只建一次）。 */
export function favDock() {
  if (dock && dock.el.isConnected) return dock;
  const heart = heartIcon("favc-dock-heart");
  const count = el("b", { class: "favc-dock-count" }, String(favChars.size));
  const node = el("div", { class: "favc-dock", "aria-hidden": "true" }, heart, el("span", { class: "favc-dock-label" }, "偏好角色"), count);
  document.body.append(node);
  favChars.onChange((list) => (count.textContent = String(list.length)));
  dock = { el: node, heart, count };
  return dock;
}

function bumpDock(d) {
  if (reducedMotion()) return;
  pop(d.heart);
  d.count.animate([{ transform: "none" }, { transform: "translateY(-4px) scale(1.25)" }, { transform: "none" }], {
    duration: DUR.medium,
    easing: css(CURVE.settle),
  });
}

/** 拖曳的落點（drag.js 的 zone）：只收角色牌。isChara(tag)：這張是不是角色牌。 */
export function favZone(isChara) {
  return { id: "favchars", el: favDock().el, accepts: (p) => !!p && isChara(p.tag) };
}

/** 拖到愛心上放開：加進名單，牌縮進愛心（drag.js 的 { el, landed }）。 */
export function dropToFav(tag, name) {
  const d = favDock();
  const added = favChars.add(tag);
  toast(added ? `「${name}」加進偏好角色` : `「${name}」已經是偏好角色`);
  return { el: d.heart, landed: () => bumpDock(d) };
}

let hideTimer = 0;
/** 點愛心加入：停靠點滑出來，那張牌（fromNode）飛進愛心，再收回去。 */
export function flyToFav(fromNode) {
  const d = favDock();
  clearTimeout(hideTimer);
  const hide = () => (hideTimer = setTimeout(() => (d.el.dataset.show = "false"), 900));
  d.el.dataset.show = "true";
  const r = fromNode && fromNode.getBoundingClientRect();
  if (reducedMotion() || !r || !r.width || r.bottom < 0 || r.top > innerHeight) {
    bumpDock(d);
    return hide();
  }
  const ghost = cloneCard(fromNode);
  ghost.classList.add("favc-ghost");
  document.body.append(ghost);
  flight(ghost, { left: r.left, top: r.top, width: r.width, height: r.height }, () => d.heart, {
    endScale: 0.22,
    endOpacity: 0.3,
    arc: 64,
    tilt: -6,
    zIndex: 380,
    onLand: () => {
      bumpDock(d);
      hide();
    },
  });
}

function pop(node) {
  node.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.45)" }, { transform: "scale(1)" }],
    { duration: DUR.medium, easing: css(CURVE.settle) }
  );
}

const GAP = 10;
// 一格最窄多寬：電腦跟字盒一樣 96px；手機四欄（跟手機字盒一樣），一頁才排得下三排。
const CELL = { desktop: 96, phone: 80 };
const narrow = () => matchMedia("(max-width: 40rem)").matches;
const seriesName = (card) => {
  const zh = card.groupZh || "";
  const cut = zh.indexOf("・");
  return cut > 0 ? zh.slice(cut + 1) : zh;
};

// 禁用角色（未成年、真人…）不在詞庫裡：搜不到時才去讀卡冊那份名單（tag_dates.json 的 banned，有中文名），
// 跟使用者說「這是禁用角色」，不要只寫「找不到」（看起來像詞庫沒有這個人）。
let bannedRows = null;
function bannedMatches(q) {
  bannedRows ||= fetch("tag_dates.json")
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) =>
      (Array.isArray(d?.banned) ? d.banned : [])
        .filter((r) => r && r.tag)
        .map((r) => ({ tag: r.tag, zh: r.zh || r.tag, suit: "chara", groupZh: r.groupZh || "", item: { series: r.series || "" } }))
    )
    .catch(() => {
      bannedRows = null;
      return [];
    });
  return bannedRows.then((rows) => rows.filter((c) => cardMatches(c, q)));
}

/**
 * 管理偏好角色的彈窗。cards：字盒的所有牌（只拿角色）；assets：牌面圖。
 * tab：一開始在哪一頁籤（"mine"／"add"）。
 *
 * 版面：頁籤、搜尋、子分類（性別、系列：跟字盒角色頁同一套籤）、牌、翻頁。
 * 一頁幾張照彈窗擺得下多少算（欄看寬度、排看高度）：翻頁鈕一直在畫面上，不用往下捲才找得到
 * （2026-11-23 量：1440×900 固定四排，第四排切一半、翻頁鈕在彈窗外面）。有好幾頁時彈窗固定高度、翻頁鈕貼底，
 * 換頁、展開系列時翻頁鈕不會上下跑。
 */
export function openFavChars({ cards, assets, tab: firstTab, onClose } = {}) {
  const all = (cards || []).filter((c) => c.suit === "chara");
  const byTag = new Map(all.map((c) => [c.tag, c]));
  let tab = firstTab || (favChars.size ? "mine" : "add");
  let query = "";
  let page = 0;
  // 子分類：換頁籤也留著（在「我的偏好」看《咒術迴戰》收了誰，切到「加角色」接著挑同一部）。
  let gender = "";
  let group = "";
  // 「我的偏好」這一頁的順序：進來、換頁、換頁籤、換子分類、搜尋時才重排，頁面上拿掉的先留著變淡。
  let mineOrder = [];
  let mineVer = 0;
  let token = 0;
  let per = 0;
  // 格子沿用（同一位角色同一個節點）：翻回看過的頁、換頁籤、搜尋，牌不重做、圖不重新解碼。
  const cellOf = new Map();

  const tabBtn = (id, label) =>
    el("button", { class: "favc-tab", type: "button", role: "tab", dataset: { tab: id }, "aria-selected": "false", onclick: () => switchTab(id) }, label);
  const mineTab = tabBtn("mine", "我的偏好");
  const addTab = tabBtn("add", "加角色");
  const search = el("input", {
    class: "favc-search",
    type: "search",
    placeholder: "找角色或作品（例：芙莉蓮、one piece）",
    "aria-label": "找角色或作品",
    autocomplete: "off",
  });
  const count = el("span", { class: "favc-total" });
  const genderBox = genderChips(gender, (g) => pickGender(g));
  const chips = el("div", { class: "group-chips favc-chips", role: "group", "aria-label": "子分類" });
  // id：sizeCards 照它記上次量到的牌寬。
  const grid = el("div", { class: "favc-grid", id: "favc-grid", role: "list" });
  const empty = el("p", { class: "favc-empty" });
  const prev = el("button", { class: "btn btn-small btn-ghost favc-prev", type: "button", "aria-label": "上一頁" }, "‹");
  const next = el("button", { class: "btn btn-small btn-ghost favc-next", type: "button", "aria-label": "下一頁" }, "›");
  const where = el("span", { class: "favc-page", "aria-live": "polite" });
  const pager = el("div", { class: "favc-pager" }, prev, where, next);
  const body = el(
    "div",
    { class: "favc" },
    el("div", { class: "favc-head" }, el("div", { class: "favc-tabs", role: "tablist", "aria-label": "偏好角色" }, mineTab, addTab), search, count),
    chips,
    grid,
    empty,
    pager
  );
  const sheet = openSheet("偏好角色", body, {
    wide: true,
    onClose: () => {
      offChange();
      removeEventListener("resize", onResize);
      onClose && onClose();
    },
  });
  sheet.sheet.classList.add("favc-sheet");
  // 整格的牌一樣寬：量一次寫在格子上，牌不必各自當容器。以前每張牌各自量寬度排字，
  // 開窗、進場動畫的每一格都要把三十幾張牌的字重排一次（2026-11-23 量：開窗 184～288ms，別的彈窗 24ms；進場有四格各卡 60～100ms）。
  sizeCards(grid);

  const base = () => (tab === "mine" ? mineOrder.map((t) => byTag.get(t)).filter(Boolean) : all);
  const genderOk = (c) => !gender || c.gate === gender;
  function items() {
    const pool = base().filter((c) => genderOk(c) && (!group || c.group === group));
    const q = query.trim();
    if (!q) return pool;
    // 跟字盒同一套搜尋：完全相符、開頭對到的排前面（搜「rem」不會先出 jeremiah）、簡體也找得到。
    const res = searchCards(pool, q);
    return res.mode === "all" ? res.list : [];
  }
  function refreshMine() {
    if (tab !== "mine") return;
    const now = favChars.list();
    if (now.join("\n") === mineOrder.join("\n")) return;
    mineOrder = now;
    mineVer++;
  }

  /* ---------- 子分類 ---------- */
  let chipKey = "";
  const chipId = (b) => (b._g !== undefined ? "g:" + b._g : b.classList.contains("chip-fold") ? "f:" + b.firstChild?.textContent : null);
  function paintChips() {
    const pool = base().filter(genderOk);
    const runs = groupChips(pool);
    if (group && !runs.some((r) => r.items.some((i) => i.g === group))) group = "";
    const key = `${tab}|${gender}|${mineVer}`;
    if (key !== chipKey) {
      chipKey = key;
      // 重做這一排時焦點留在同一顆（鍵盤操作不要被踢回頁首）。
      const had = chips.contains(document.activeElement) && !genderBox.contains(document.activeElement) ? chipId(document.activeElement) : null;
      const chip = (i, inRun) => {
        const b = el(
          "button",
          { class: "group-chip pressable", type: "button", "aria-label": i.short === i.zh ? null : i.zh, onclick: () => pickGroup(i.g) },
          i.seal && !inRun ? el("b", { class: "chip-seal", "aria-hidden": "true" }, i.seal) : null,
          i.short
        );
        b._g = i.g;
        return b;
      };
      const allBtn = el("button", { class: "group-chip pressable", type: "button", onclick: () => pickGroup("") }, "全部");
      allBtn._g = "";
      // 性別那一串一直是同一個節點（拔下來再接回去，按著的那顆會失去焦點），只換系列那一串。
      const run = seriesRun([allBtn, ...runs.map((r) => (r.fam ? chipRun(r, r.items.map((i) => chip(i, true)), { fold: true, picked: group }) : chip(r.items[0], false)))]);
      if (genderBox.parentNode !== chips) chips.prepend(genderBox);
      if (genderBox.nextElementSibling) genderBox.nextElementSibling.replaceWith(run);
      else chips.append(run);
      // 一位偏好都沒有：籤也不用出來（性別篩到空的要留著，才切得回來）。
      chips.hidden = !pool.length && !gender;
      if (had) [...chips.querySelectorAll("button")].find((b) => chipId(b) === had)?.focus({ preventScroll: true });
    }
    for (const b of genderBox.querySelectorAll("[data-gender]")) b.setAttribute("aria-pressed", b.dataset.gender === gender ? "true" : "false");
    for (const b of chips.querySelectorAll(".chip-series .group-chip")) b.setAttribute("aria-pressed", b._g === group ? "true" : "false");
    for (const run of chips.querySelectorAll(".chip-run[data-fold]")) {
      if (group && [...run.querySelectorAll(":scope > .group-chip")].some((b) => b._g === group)) run.dataset.picked = "true";
      else delete run.dataset.picked;
    }
  }
  function pickGroup(g) {
    if (g === group) return;
    group = g;
    paintChips();
    swap(() => {
      page = 0;
      refreshMine();
    }, 0);
  }
  function pickGender(g) {
    if (g === gender) return;
    gender = g;
    paintChips();
    swap(() => {
      page = 0;
      refreshMine();
    }, 0);
  }
  // 展開、收起一串作品：籤列長高、變矮（cards.js 的 foldMotion 慢慢變），變完再照新的高度重排一頁幾張。
  chips.addEventListener("chipfold", () =>
    requestAnimationFrame(() => {
      const g = chips._grow;
      if (g && g.playState === "running") g.finished.then(refit, refit);
      else refit();
    })
  );

  /* ---------- 一頁幾張 ---------- */
  let pagerH = 48;
  let labelH = 0;
  function fit() {
    const s = sheet.sheet;
    const w = grid.clientWidth || s.clientWidth - 48;
    const cols = Math.max(2, Math.floor((w + GAP) / ((narrow() ? CELL.phone : CELL.desktop) + GAP)));
    const cardW = Math.min(120, (w - GAP * (cols - 1)) / cols);
    if (!labelH) {
      const c = grid.querySelector(".favc-cell");
      const card = c?.querySelector(".card");
      if (c && card?.offsetHeight) labelH = c.offsetHeight - card.offsetHeight;
    }
    const rowH = (cardW * 702) / 480 + (labelH || 22) + GAP;
    // 彈窗最多能多高：電腦是 max-height；手機是整片遮罩扣掉上緣（max-height: 100%）。
    const ov = s.parentElement;
    const ocs = getComputedStyle(ov);
    const room = ov.clientHeight - parseFloat(ocs.paddingTop) - parseFloat(ocs.paddingBottom);
    const mh = getComputedStyle(s).maxHeight;
    const maxH = Math.min(room, mh.endsWith("px") ? parseFloat(mh) : Infinity);
    if (!pager.hidden && pager.offsetHeight) pagerH = pager.offsetHeight + (parseFloat(getComputedStyle(body).rowGap) || 0);
    // 牌以外的東西佔多高（翻頁鈕這次藏著也算進去：有好幾頁時它會出來）。
    const other = s.scrollHeight - grid.offsetHeight + (pager.hidden ? pagerH : 0);
    const rows = Math.max(1, Math.min(8, Math.floor((maxH - other + GAP) / rowH)));
    return { cols, rows };
  }

  function cell(card) {
    let btn = cellOf.get(card.tag);
    if (!btn) {
      const heart = heartIcon("favc-heart");
      btn = el(
        "button",
        { class: "favc-cell", type: "button", role: "listitem", dataset: { tag: card.tag }, title: card.groupZh || "" },
        cardNode(card, assets, { tagName: "div" }),
        heart,
        // 底下只寫作品名（「動漫・咒術迴戰」的後半）：家族在子分類籤上看得到，窄的格子不必被「動漫・」吃掉一半。
        el("span", { class: "favc-series" }, seriesName(card))
      );
      const b = btn;
      b.addEventListener("click", () => {
        paintCell(b, favChars.toggle(card.tag));
        if (!reducedMotion()) pop(heart);
        paintCount();
      });
      cellOf.set(card.tag, btn);
    } else {
      // 上次換頁淡出時留下的（fill: forwards）：沿用之前先清掉，不然牌一直是透明的。
      for (const a of btn.getAnimations()) a.cancel();
    }
    paintCell(btn, favChars.has(card.tag));
    return btn;
  }
  function paintCell(btn, on) {
    btn.dataset.on = on ? "true" : "false";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function paintCount() {
    count.textContent = `${favChars.size} 位`;
  }

  let missToken = 0;
  function paintEmpty(list) {
    const my = ++missToken;
    if (list.length) {
      empty.hidden = true;
      return;
    }
    empty.hidden = false;
    const q = query.trim();
    if (q) {
      // 「我的偏好」裡沒有、加角色找得到：給一顆直接過去找（子分類清掉，不然可能又被篩掉）。
      if (tab === "mine" && all.some((c) => cardMatches(c, q))) {
        empty.replaceChildren(
          `我的偏好裡沒有「${q}」。`,
          el("button", { class: "btn btn-small", type: "button", onclick: () => ((gender = ""), (group = ""), switchTab("add")) }, "到加角色找")
        );
        return;
      }
      empty.replaceChildren(`找不到「${q}」。`);
      bannedMatches(q).then((hits) => {
        if (my !== missToken || !hits.length || !empty.isConnected) return;
        empty.replaceChildren(hits.length === 1 ? `「${english ? hits[0].tag : hits[0].zh}」是禁用角色，不能加進偏好角色。` : `「${q}」對到的 ${hits.length} 位都是禁用角色，不能加進偏好角色。`);
      });
      return;
    }
    const filtered = !!(gender || group);
    if (tab === "mine") {
      empty.replaceChildren(filtered ? "這一格還沒有偏好角色。" : "還沒有偏好角色。", el("button", { class: "btn btn-small", type: "button", onclick: () => switchTab("add") }, "去挑角色"));
      return;
    }
    empty.replaceChildren(filtered ? "這一格沒有角色。" : "字盒裡沒有角色牌。");
  }

  // 開窗那一次不演高度（彈窗自己有進場）；之後換頁籤、子分類、搜尋，彈窗從原本的高度慢慢變到新的高度。
  // 以前從「好幾頁、固定高度」切到「一頁、照內容高」，整個彈窗一格就縮小（2026-11-23 專案主回報）。
  let opened = false;
  function render() {
    const grow = opened ? heightChange(sheet.sheet) : null;
    // 上一段高度還在變：先停掉再量（量到的才是這次真正的版面）；heightChange 從剛才看到的高度接著變
    // （_grow 先清掉：停掉的動畫 currentTime 是 null，留著的話它會從上一段的起點重來）。
    const was = sheet.sheet._grow;
    if (was) {
      sheet.sheet._grow = null;
      was.cancel();
    }
    paintChips();
    const list = items();
    paintEmpty(list);
    const f = fit();
    per = f.cols * f.rows;
    const pages = Math.max(1, Math.ceil(list.length / per));
    page = Math.min(Math.max(0, page), pages - 1);
    grid.replaceChildren(...list.slice(page * per, page * per + per).map(cell));
    for (const b of [mineTab, addTab]) b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
    body.dataset.tab = tab;
    where.textContent = `${page + 1} / ${pages}`;
    prev.disabled = page === 0;
    next.disabled = page >= pages - 1;
    pager.hidden = pages <= 1;
    // 好幾頁：彈窗固定高度、翻頁鈕貼底（styles.css 的 .favc-sheet[data-paged]）。
    sheet.sheet.dataset.paged = pages > 1 ? "true" : "false";
    paintCount();
    grow?.done();
  }

  /** 寬度、高度變了（轉手機、拉視窗、展開系列）：一頁的張數跟著變，留在差不多同一段；多出來的那排淡進來。 */
  function refit() {
    if (!sheet.sheet.isConnected) return;
    const f = fit();
    const n = f.cols * f.rows;
    if (n === per) return;
    page = Math.floor((page * per) / n);
    const had = new Set(grid.children);
    render();
    if (reducedMotion()) return;
    [...grid.children]
      .filter((c) => !had.has(c))
      .forEach((c, i) =>
        c.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, delay: Math.min(i * 14, 200), easing: css(CURVE.out), fill: "backwards" })
      );
  }

  /** 換一頁內容：舊的往反方向淡出，新的從 dir 那一邊一張接一張滑進來。dir：+1 下一頁、-1 上一頁、0 換頁籤、子分類或搜尋。 */
  function swap(change, dir) {
    const my = ++token;
    const old = [...grid.children];
    if (reducedMotion() || !old.length) {
      change();
      render();
      enter(dir);
      return;
    }
    const shift = dir ? -dir * 18 : 0;
    const outs = old.map((n) =>
      n.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${shift}px) scale(${dir ? 1 : 0.97})` }], {
        duration: DUR.micro,
        easing: css(CURVE.exit),
        fill: "forwards",
      })
    );
    Promise.all(outs.map((a) => a.finished.catch(() => {}))).then(() => {
      if (my !== token) {
        // 被下一次換頁接手了：自己的淡出收掉（格子會沿用，留著 fill 會一直透明）。
        for (const a of outs) a.cancel();
        return;
      }
      change();
      render();
      for (const a of outs) a.cancel();
      enter(dir);
    });
  }

  function enter(dir) {
    if (reducedMotion()) return;
    [...grid.children].forEach((n, i) =>
      n.animate([{ opacity: 0, transform: `translateX(${dir * 26}px) translateY(${dir ? 0 : 6}px)` }, { opacity: 1, transform: "none" }], {
        duration: DUR.short,
        delay: Math.min(i * 14, 260),
        easing: css(CURVE.out),
        fill: "backwards",
      })
    );
  }

  function go(dir) {
    const pages = Math.max(1, Math.ceil(items().length / (per || 1)));
    const to = page + dir;
    if (to < 0 || to >= pages) return;
    swap(() => {
      page = to;
      refreshMine();
    }, dir);
  }

  function switchTab(id) {
    if (id === tab) return;
    swap(() => {
      tab = id;
      page = 0;
      if (tab === "mine") {
        mineOrder = favChars.list();
        mineVer++;
      }
    }, 0);
  }

  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  let typing = 0;
  const applySearch = () => {
    clearTimeout(typing);
    if (query === search.value) return;
    swap(() => {
      query = search.value;
      page = 0;
      refreshMine();
    }, 0);
  };
  // 注音、倉頡組字中不排（選字停一下就先用半個字去找、閃「找不到」）；選完字立刻排。
  search.addEventListener("input", (e) => {
    clearTimeout(typing);
    if (e.isComposing) return;
    typing = setTimeout(applySearch, 140);
  });
  search.addEventListener("compositionend", applySearch);
  // 鍵盤：左右鍵換頁（打字的時候不搶）。
  sheet.sheet.addEventListener("keydown", (e) => {
    if (e.target === search) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  });
  // 手機：左右滑換頁（上下捲不算）。
  let touch = null;
  grid.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") touch = { x: e.clientX, y: e.clientY };
  });
  grid.addEventListener("pointerup", (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 56 && Math.abs(dy) < 40) go(dx < 0 ? 1 : -1);
  });
  const onResize = () => refit();
  addEventListener("resize", onResize);
  // 別的分頁改了名單：計數跟著變；「我的偏好」在下一次換頁時重排。
  const offChange = favChars.onChange(() => {
    if (!sheet.sheet.isConnected) return offChange();
    paintCount();
  });
  mineOrder = favChars.list();
  // 先排一次，再照第一排牌真正的高度（底下那行作品名）校一次：都在這一格裡做完，畫出來就是對的張數。
  render();
  const f = fit();
  if (f.cols * f.rows !== per) render();
  opened = true;
  enter(0);
  if (tab === "add") search.focus({ preventScroll: true });
  return sheet;
}
