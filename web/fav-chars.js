/**
 * 偏好角色：墨池、疊印台、卡冊共用一份名單，張數不限、新加的在前。
 * 名單存在伺服器（data/fav_chars.json，/api/fav-chars），所有裝置共用；localStorage mochi.fav.chars.v1
 * 是這台的快取：開頁先用它畫（不用等網路），伺服器那份回來再換上。以前只存在瀏覽器，清掉資料、換台電腦就沒了；
 * 第一次連上伺服器時，這台的名單會併進伺服器那份（兩台電腦各自有的都留著）。
 * 規則的「只抽偏好角色」打開時，抽角色只從名單裡抽（engine.js 的 characterFavOnly／characterFavorites；
 * 名單不存在規則裡，抽牌那一刻由 withFavChars() 帶進去）。
 *
 * 管理的彈窗（openFavChars）：
 *   兩個頁籤「我的偏好」「加角色」、一個搜尋框（角色名、作品名都對得上），下面一頁一頁的牌。
 *   一頁幾張看寬度：每排擺得下幾張就幾張，固定四排。‹ › 換頁，鍵盤左右鍵、手機左右滑也行。
 *   點一張就加入／拿掉。「我的偏好」裡拿掉的那張先留在原位變淡，再點一下就回來 ——
 *   換頁、換頁籤、關掉之後才真的不見，所以不用另外跳「復原」。
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
import { cardNode, cardMatches } from "./cards.js";
import { cloneCard } from "./card-images.js";
import { DUR, CURVE, css, reducedMotion, flight } from "./motion.js";

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

const KEY = "mochi.fav.chars.v1";
const listeners = new Set();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x))] : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 無痕模式、空間滿了：這一頁照樣用，下次開就沒有 */
  }
}

let tags = read();
const emit = () => listeners.forEach((f) => f(tags));
// 另一個分頁（墨池、疊印台同時開著）改了名單：這一頁跟著換。
addEventListener("storage", (e) => {
  if (e.key === KEY) {
    tags = read();
    emit();
  }
});

/* ---------- 伺服器那份（所有裝置共用） ---------- */

// 這台有沒有跟伺服器對過一次：還沒的話，這台的名單要先併進伺服器那份，不能被蓋掉。
const SYNCED_KEY = "mochi.fav.chars.synced";
let server = false; // 伺服器有這個功能（舊伺服器、測試的假伺服器沒有：只用這台的）
let dirty = false; // 伺服器那份還沒回來之前，這頁就改過了：以這頁的為準
let pushT = 0;
let pulling = null;

function synced() {
  try {
    return localStorage.getItem(SYNCED_KEY) === "1";
  } catch {
    return false;
  }
}
function markSynced() {
  try {
    localStorage.setItem(SYNCED_KEY, "1");
  } catch {
    /* 存不了：下次開還會再併一次，結果一樣 */
  }
}

// 還沒送到伺服器的改動（加了誰、拿掉誰）：存在這台，送成功才清掉。
// 以前斷網時加的、送失敗就算了，網路回來切回分頁時被伺服器那份蓋回去，那一筆沒有任何提示就不見了。
// 送的是改動、不是整份名單：手機和電腦同時改，伺服器把兩邊的都套上（以前後送的整份蓋掉先送的）。
const OPS_KEY = "mochi.fav.chars.ops";
function readOps() {
  try {
    const v = JSON.parse(localStorage.getItem(OPS_KEY) || "null");
    const list = (x) => (Array.isArray(x) ? x.filter((t) => typeof t === "string" && t) : []);
    return { add: list(v?.add), remove: list(v?.remove) };
  } catch {
    return { add: [], remove: [] };
  }
}
function writeOps(ops) {
  try {
    if (ops.add.length || ops.remove.length) localStorage.setItem(OPS_KEY, JSON.stringify(ops));
    else localStorage.removeItem(OPS_KEY);
  } catch {
    /* 存不了：這一頁照樣送，送不出去下次開就沒有 */
  }
}
function noteOp(kind, t) {
  const ops = readOps();
  ops.add = ops.add.filter((x) => x !== t);
  ops.remove = ops.remove.filter((x) => x !== t);
  ops[kind].push(t);
  writeOps(ops);
}

function push() {
  if (!server) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => {
    pushT = 0;
    const sent = readOps();
    // 第一次跟伺服器對（或這台在伺服器那份回來之前就改過）：整份搬上去；之後只送改動。
    const body = dirty || !synced() ? { tags } : sent;
    if (!dirty && synced() && !sent.add.length && !sent.remove.length) return;
    fetch("/api/fav-chars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !Array.isArray(j.tags)) return;
        // 只送了改動、伺服器那邊卻是剛建的（原本沒有檔案）：它不知道這台原本的名單。
        // 兩邊合起來整份再送一次，不要拿只有新加那幾位的名單蓋掉這台。
        if (j.fresh && !body.tags) {
          adopt([...new Set([...j.tags, ...tags])]);
          dirty = true;
          return push();
        }
        dirty = false;
        markSynced();
        // 送出去的這批清掉；送的途中又改的留著，下一次再送。
        const now = readOps();
        writeOps({ add: now.add.filter((t) => !sent.add.includes(t)), remove: now.remove.filter((t) => !sent.remove.includes(t)) });
        const left = readOps();
        adopt([...left.add, ...j.tags.filter((t) => !left.remove.includes(t) && !left.add.includes(t))]);
        if (left.add.length || left.remove.length) push();
      })
      .catch(() => {});
  }, 250);
}

function adopt(list) {
  const next = [...new Set(list.filter((x) => typeof x === "string" && x))];
  if (next.length === tags.length && next.every((t, i) => t === tags[i])) return;
  tags = next;
  write(tags);
  emit();
}

/** 跟伺服器對一次：開頁、切回這個分頁、網路回來時（別台裝置可能改過）。 */
function pull() {
  if (pulling || pushT) return pulling;
  pulling = fetch("/api/fav-chars", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || !Array.isArray(j.tags)) return;
      server = true;
      if (dirty) return push();
      // 伺服器說沒存過（換了一份資料夾跑、檔案被刪掉）：這台的整份搬上去，不管以前對過沒有。
      // 以前這台已經對過一次（synced）就只送改動：伺服器建了一份只有新加那幾位的名單，回來把這台整份蓋掉（2026-10-21）。
      if (!j.saved) {
        if (!tags.length) return markSynced();
        dirty = true;
        return push();
      }
      if (!synced()) {
        // 第一次：伺服器的在前，這台多出來的接在後面（兩邊都不丟）。
        const merged = [...new Set([...j.tags, ...tags])];
        adopt(merged);
        return merged.length !== j.tags.length ? push() : markSynced();
      }
      // 這台還有沒送出去的：先送（伺服器套上去之後回完整名單），不要被伺服器那份蓋掉。
      const ops = readOps();
      if (ops.add.length || ops.remove.length) return push();
      adopt(j.tags);
    })
    .catch(() => {})
    .finally(() => {
      pulling = null;
    });
  return pulling;
}
// 在瀏覽器裡才連伺服器（引擎測試在 Node 裡載這個檔，那邊只用名單本身）。
if (typeof document !== "undefined") {
  pull();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pull();
  });
  addEventListener("online", () => pull());
}

function changed() {
  write(tags);
  if (!server) dirty = true;
  push();
  emit();
}

export const favChars = {
  list: () => [...tags],
  has: (t) => tags.includes(t),
  get size() {
    return tags.length;
  },
  add(t) {
    if (!t || tags.includes(t)) return false;
    tags = [t, ...tags];
    noteOp("add", t);
    changed();
    return true;
  },
  remove(t) {
    if (!tags.includes(t)) return false;
    tags = tags.filter((x) => x !== t);
    noteOp("remove", t);
    changed();
    return true;
  },
  /** 回傳換完之後是不是偏好。 */
  toggle(t) {
    if (tags.includes(t)) {
      this.remove(t);
      return false;
    }
    this.add(t);
    return true;
  },
  /** 名單變了就叫 f；回傳取消訂閱的函式。 */
  onChange(f) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
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

const ROWS = 4;
const CELL = { desktop: 104, phone: 92 };

/**
 * 管理偏好角色的彈窗。cards：字盒的所有牌（只拿角色）；assets：牌面圖；zh：tag → 中文名。
 * tab：一開始在哪一頁籤（"mine"／"add"）。
 */
export function openFavChars({ cards, assets, tab: firstTab, onClose } = {}) {
  const all = (cards || []).filter((c) => c.suit === "chara");
  const byTag = new Map(all.map((c) => [c.tag, c]));
  let tab = firstTab || (favChars.size ? "mine" : "add");
  let query = "";
  let page = 0;
  // 「我的偏好」這一頁的順序：進來、換頁、換頁籤、搜尋時才重排，頁面上拿掉的先留著變淡。
  let mineOrder = [];
  let token = 0;

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
  const grid = el("div", { class: "favc-grid", role: "list" });
  const empty = el("p", { class: "favc-empty" });
  const prev = el("button", { class: "btn btn-small btn-ghost favc-prev", type: "button", "aria-label": "上一頁" }, "‹");
  const next = el("button", { class: "btn btn-small btn-ghost favc-next", type: "button", "aria-label": "下一頁" }, "›");
  const where = el("span", { class: "favc-page", "aria-live": "polite" });
  const pager = el("div", { class: "favc-pager" }, prev, where, next);
  const count = el("span", { class: "favc-total" });
  const body = el(
    "div",
    { class: "favc" },
    el("div", { class: "favc-head" }, el("div", { class: "favc-tabs", role: "tablist", "aria-label": "偏好角色" }, mineTab, addTab), count),
    search,
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

  const perPage = () => {
    const w = grid.clientWidth || sheet.sheet.clientWidth - 48;
    const cell = matchMedia("(max-width: 40rem)").matches ? CELL.phone : CELL.desktop;
    return Math.max(2, Math.floor((w + 10) / (cell + 10))) * ROWS;
  };
  const items = () => {
    const q = query.trim().toLowerCase();
    const pool = tab === "mine" ? mineOrder.map((t) => byTag.get(t)).filter(Boolean) : all;
    return q ? pool.filter((c) => cardMatches(c, q)) : pool;
  };

  function cell(card) {
    const on = favChars.has(card.tag);
    const heart = heartIcon("favc-heart");
    const btn = el(
      "button",
      {
        class: "favc-cell",
        type: "button",
        role: "listitem",
        dataset: { tag: card.tag, on: on ? "true" : "false" },
        "aria-pressed": on ? "true" : "false",
        title: card.groupZh || "",
      },
      cardNode(card, assets, { tagName: "div" }),
      heart,
      el("span", { class: "favc-series" }, card.groupZh || "")
    );
    btn.addEventListener("click", () => {
      const now = favChars.toggle(card.tag);
      btn.dataset.on = now ? "true" : "false";
      btn.setAttribute("aria-pressed", now ? "true" : "false");
      if (!reducedMotion()) pop(heart);
      paintCount();
    });
    return btn;
  }

  function paintCount() {
    count.textContent = `${favChars.size} 位`;
  }

  function render() {
    const list = items();
    const per = perPage();
    const pages = Math.max(1, Math.ceil(list.length / per));
    page = Math.min(Math.max(0, page), pages - 1);
    grid.replaceChildren(...list.slice(page * per, page * per + per).map(cell));
    for (const b of [mineTab, addTab]) b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
    body.dataset.tab = tab;
    where.textContent = `${page + 1} / ${pages}`;
    prev.disabled = page === 0;
    next.disabled = page >= pages - 1;
    pager.hidden = pages <= 1;
    body.dataset.paged = pages > 1 ? "true" : "false";
    paintCount();
    if (list.length) {
      empty.hidden = true;
    } else {
      empty.hidden = false;
      empty.replaceChildren(
        ...(query.trim()
          ? [`找不到「${query.trim()}」。`]
          : tab === "mine"
            ? ["還沒有偏好角色。", el("button", { class: "btn btn-small", type: "button", onclick: () => switchTab("add") }, "去挑角色")]
            : ["字盒裡沒有角色牌。"])
      );
    }
  }

  /** 換一頁內容：舊的往反方向淡出，新的從 dir 那一邊一張接一張滑進來。dir：+1 下一頁、-1 上一頁、0 換頁籤或搜尋。 */
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
      if (my !== token) return;
      change();
      render();
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
    const list = items();
    const pages = Math.max(1, Math.ceil(list.length / perPage()));
    const to = page + dir;
    if (to < 0 || to >= pages) return;
    swap(() => {
      page = to;
      if (tab === "mine") mineOrder = favChars.list();
    }, dir);
  }

  function switchTab(id) {
    if (id === tab) return;
    swap(() => {
      tab = id;
      page = 0;
      mineOrder = favChars.list();
    }, 0);
  }

  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  let typing = 0;
  search.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      swap(() => {
        query = search.value;
        page = 0;
        if (tab === "mine") mineOrder = favChars.list();
      }, 0);
    }, 140);
  });
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
  // 寬度變了（轉手機、拉視窗）：一頁的張數跟著變，回到第一頁重排。
  let lastPer = 0;
  const onResize = () => {
    const per = perPage();
    if (per !== lastPer) {
      lastPer = per;
      render();
    }
  };
  addEventListener("resize", onResize);
  // 別的分頁改了名單：計數跟著變；「我的偏好」在下一次換頁時重排。
  const offChange = favChars.onChange(() => {
    if (!sheet.sheet.isConnected) return offChange();
    paintCount();
  });
  mineOrder = favChars.list();
  // 彈窗的進場動畫結束才量得到寬度：先畫一次，下一格再照真正的寬度排一次。
  render();
  requestAnimationFrame(() => {
    lastPer = perPage();
    render();
    enter(0);
  });
  if (tab === "add") search.focus({ preventScroll: true });
  return sheet;
}
