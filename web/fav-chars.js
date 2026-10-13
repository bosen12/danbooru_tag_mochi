/**
 * 偏好角色：墨池、疊印台共用一份名單（localStorage mochi.fav.chars.v1），張數不限、新加的在前。
 * 規則的「只抽偏好角色」打開時，抽角色只從名單裡抽（engine.js 的 characterFavOnly／characterFavorites；
 * 名單不存在規則裡，抽牌那一刻由 withFavChars() 帶進去）。
 *
 * 管理的彈窗（openFavChars）：
 *   兩個頁籤「我的偏好」「加角色」、一個搜尋框（角色名、作品名都對得上），下面一頁一頁的牌。
 *   一頁幾張看寬度：每排擺得下幾張就幾張，固定四排。‹ › 換頁，鍵盤左右鍵、手機左右滑也行。
 *   點一張就加入／拿掉。「我的偏好」裡拿掉的那張先留在原位變淡，再點一下就回來 ——
 *   換頁、換頁籤、關掉之後才真的不見，所以不用另外跳「復原」。
 * 動態：換頁時舊的一頁往反方向淡出，新的一頁從翻頁的方向一張接一張滑進來；
 *   愛心按下去彈一下；規則上「♥ 偏好角色 N」的數字變了也彈一下。減少動態時都直接換。
 */
import { el, openSheet } from "./ui.js";
import { cardNode, cardMatches } from "./cards.js";
import { DUR, CURVE, css, reducedMotion } from "./motion.js";

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

export const favChars = {
  list: () => [...tags],
  has: (t) => tags.includes(t),
  get size() {
    return tags.length;
  },
  add(t) {
    if (!t || tags.includes(t)) return false;
    tags = [t, ...tags];
    write(tags);
    emit();
    return true;
  },
  remove(t) {
    if (!tags.includes(t)) return false;
    tags = tags.filter((x) => x !== t);
    write(tags);
    emit();
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
    const heart = el("span", { class: "card-heart", "aria-hidden": "true" }, "♥");
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

/** 規則上那顆「♥ 偏好角色 N」：數字變了彈一下。 */
export function favCharsButton(onClick) {
  const count = el("span", { class: "favc-count" }, String(favChars.size));
  const btn = el(
    "button",
    { class: "btn btn-small btn-ghost favc-open", type: "button", "aria-haspopup": "dialog", title: "偏好角色：挑幾個常用的角色，打開「只抽偏好角色」就只從這裡面抽" },
    el("span", { class: "favc-open-heart", "aria-hidden": "true" }, "♥"),
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
    const heart = el("span", { class: "favc-heart", "aria-hidden": "true" }, "♥");
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
