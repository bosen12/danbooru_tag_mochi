/**
 * 偏好卡牌（手牌）：墨池、疊印台共用。每個房間自己一份（key 不同），最多十張。
 *
 * 樣子：視窗底部一條托盤，牌就是左邊字盒那一張 —— 同一個元件、量字盒上那張的寬度和字級，
 * 看起來一模一樣。整張攤開排成一道很淺的弧；指到的那張浮起來。擺不下才疊，疊的時候指到的
 * 那張兩旁讓開。托盤可以收起來，只剩一顆「偏好卡牌 7/10」的小標籤。
 * 已經在卡池裡的不擺：手牌十張、卡池已經有其中三張，托盤只擺七張；那張從卡池拿下來，
 * 它飛回托盤（不是回字盒）。托盤佔多高寫在 --fav-h，房間的捲動區底下墊這麼多，不會被蓋住。
 *
 * 用法（越少步驟越好）：
 *   加牌：把左邊的牌拖到托盤；或按托盤上的「＋ 挑牌」，再點左邊的牌（再點一次是拿掉）。
 *   出牌：點托盤上的牌，或拖進卡池。
 *   拿掉：指到牌，右上角的 ×（隨時都有）；或拖回字盒；鍵盤 Delete。
 *
 * 房間要給的：
 *   key            localStorage 的鑰匙（兩個房間分開）
 *   makeNode(t)    畫一張牌（cards.js 的 cardNode，跟字盒同一個）
 *   sample()       字盒上隨便一張牌（量它的寬度、字級；托盤的牌跟它一樣大）
 *   inPool(t)      這張現在在卡池裡嗎
 *   onPlay(t, r)   出牌（r：托盤上那張的位置，讓房間從這裡飛進卡池）
 *   onChange()     手牌變了（房間重畫字盒上的「手」記號、按鈕上的數字）
 *   known(t)       這張牌還在不在字盒（詞庫改了、被封鎖了就不要）
 *   blocked(t)     這張牌現在出不了的原因（例如「分級擋掉」），沒有就 null：托盤上那張蓋章、變淡
 *   onRemoved(t, undo)  用手拿掉了一張（×、Delete、選單）：房間跳一個帶「復原」的提示，undo() 放回原位
 *   decorate(n,t)  托盤上的牌做好之後給房間掛東西（拖曳）
 */
import { flight, CURVE, DUR, css } from "./motion.js";
import { setCardFlag } from "./cards.js";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="8" height="12" rx="1.5" transform="rotate(-14 7 13)"/><rect x="8" y="5" width="8" height="12" rx="1.5"/><rect x="13" y="7" width="8" height="12" rx="1.5" transform="rotate(14 17 13)"/></svg>';
const CHEVRON =
  '<svg class="fav-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const GAP = 10;
const noSample = () => null;

const TRAY_SCALE = 1.15;

// 視窗寬度：只在 resize 時讀一次。以前每次重擺托盤都讀 innerWidth —— 版面剛被改過時，
// 瀏覽器要先把整頁排版一次才答得出來（手機上疊印台放一張牌，光這一下 30ms）。
let vw = innerWidth;
addEventListener("resize", () => (vw = innerWidth), { passive: true });

export function createHand({
  key,
  max = 10,
  makeNode,
  sample = noSample,
  inPool,
  onPlay,
  onChange = () => {},
  known = () => true,
  onFull = () => {},
  onRemoved = () => {},
  blocked = () => null,
  decorate = () => {},
}) {
  let tags = read(key, []).filter(known).slice(0, max);
  // 第一次來、手牌是空的：托盤不出來，等按了「偏好卡牌」或加了第一張。
  let open = read(key + ".open", tags.length > 0) === true;
  let editing = false;
  let hot = -1;
  // 拖牌經過托盤：在要插進去的地方空出一格（at：第幾格；skip：拖的就是托盤上的這張，它先讓出位置）。
  let gap = null;
  // 托盤的牌多大：兩個房間都照墨池字盒那張（墨池量、存起來；疊印台只讀）。一開頁就用存著的，
  // 不先用預設大小畫一次、等字盒畫好量完再縮 —— 那樣一載入、一換房間托盤就跳一下。
  const SIZE_KEY = "mochi.fav.size";
  const storedSize = read(SIZE_KEY, null);
  const hadStored = !!(storedSize && storedSize.w > 30 && storedSize.w < 200 && storedSize.fs > 4);
  let size = hadStored ? { w: storedSize.w, fs: storedSize.fs } : { w: 83, fs: 10.5 };
  const slots = new Map();
  const pendingArrive = new Set();

  const el = document.createElement("section");
  el.className = "fav-hand";
  el.setAttribute("aria-label", "偏好卡牌");
  const head = document.createElement("div");
  head.className = "fav-head";
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "fav-tab";
  const hint = document.createElement("span");
  hint.className = "fav-hint";
  hint.setAttribute("aria-live", "polite");
  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "fav-pick";
  head.append(tab, hint, pick);
  const body = document.createElement("div");
  body.className = "fav-body";
  const fan = document.createElement("div");
  fan.className = "fav-fan";
  // 指到托盤的牌：放大卡開在上面（card-peek.js）。
  fan.dataset.peek = "above";
  const empty = document.createElement("p");
  empty.className = "fav-emptytext";
  body.append(fan);
  el.append(head, body);
  document.body.append(el);
  // The tray's owner publishes page state once; card mutations need no body :has lookup.
  document.body.dataset.favHand = "true";

  tab.addEventListener("click", () => setOpen(!open));
  pick.addEventListener("click", () => toggleEdit());
  fan.addEventListener("pointerleave", () => setHot(-1));
  fan.addEventListener("focusout", (e) => {
    if (!fan.contains(e.relatedTarget)) setHot(-1);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editing) {
      e.preventDefault();
      toggleEdit(false);
    }
  });

  // 托盤佔多高，房間的捲動區底下就墊多高（CSS 讀 --fav-h）。
  // 觀察回呼若當場量，會在載入那一輪逼整頁排版。跟 layout 一樣，下一格畫面再量。
  let spaceRaf = 0;
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    cancelAnimationFrame(spaceRaf);
    spaceRaf = requestAnimationFrame(syncSpace);
  }) : null;
  ro?.observe(el);
  // 量的是托盤頂端到視窗底邊（墨池的浮動按鈕列出來時托盤會墊高）：角落的按鈕要讓到這麼高。
  el.addEventListener("transitionend", (e) => {
    if (e.target === el && e.propertyName === "translate") syncSpace();
  });
  function syncSpace() {
    const cur = document.documentElement.style.getPropertyValue("--fav-h");
    // 托盤收著：高度就是 0，樣式表的後備值已經是 0。這時去量、再寫上 0px，
    // 會把整頁弄髒，同一格裡接著量滑塊又排一次。
    if (el.dataset.hidden === "true") {
      if (cur && cur !== "0px") document.documentElement.style.setProperty("--fav-h", "0px");
      return;
    }
    const r = el.getBoundingClientRect();
    const h = !r.height ? 0 : Math.ceil(innerHeight - r.top) + 12;
    const next = h + "px";
    if (cur === next || (h === 0 && !cur)) return;
    // 這格已經量過了。立刻寫 --fav-h 會弄髒 body 的底邊，同一格後面的讀尺寸再排整頁。
    requestAnimationFrame(() => {
      if (document.documentElement.style.getPropertyValue("--fav-h") !== next) {
        document.documentElement.style.setProperty("--fav-h", next);
      }
    });
  }

  function read(k, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (v === null || v === undefined) return fallback;
      if (Array.isArray(fallback)) return Array.isArray(v) ? v.filter((t) => typeof t === "string") : fallback;
      return v;
    } catch {
      return fallback;
    }
  }
  function write(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* 存不了就只活在這一頁 */
    }
  }

  const shownTags = () => tags.filter((t) => !inPool(t));

  /** 量字盒上那張牌：托盤的牌跟它一樣寬、一樣的字級。字盒還沒畫出來就沿用上一次。 */
  // 字盒變寬變窄（視窗拉動、捲軸出現、字型載完），它的牌跟著變：托盤重量一次。
  let watched = null;
  let measured = false;
  let retry = 0;
  let tries = 0;
  let reflow = 0;
  const gridRo =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          cancelAnimationFrame(reflow);
          reflow = requestAnimationFrame(() => {
            const w = size.w;
            measure(true);
            if (Math.abs(size.w - w) > 0.5) layout(false);
          });
        })
      : null;
  // 量過一次、字盒也在看著了：之後不再每次重擺都量（一量就逼整頁同步排版一次 —— 放一張牌
  // 會連帶重擺托盤，實測每次多一次全頁排版）。字盒真的變寬變窄時 gridRo 會叫 measure(true)。
  function measure(force = false) {
    if (measured && watched && !force) return size;
    const n = sample();
    if (!n && !measured && sample === noSample) return size; // 這個房間不量（疊印台）：用墨池存的
    const grid = n?.parentElement;
    if (gridRo && grid && grid !== watched) {
      if (watched) gridRo.unobserve(watched);
      gridRo.observe((watched = grid));
    }
    // 有存著的大小：開頁先用它，等字盒排好、ResizeObserver 回報時再量（那時排版已經做完，量不花錢）。
    // 開頁就量會在字盒、成品牆剛建好的時候逼整頁同步排版一次（牆上成品多時 25ms）。
    if (!force && !measured && hadStored && watched) return size;
    // 量 offsetWidth（沒轉過的寬度）；字盒還沒畫出來就等一下再量（最多十秒）。
    const w = n?.offsetWidth || 0;
    if (w > 30) {
      size = { ...size, w, fs: parseFloat(getComputedStyle(n).fontSize) || size.fs };
      measured = true;
      write(SIZE_KEY, { w: size.w, fs: size.fs });
    } else if (!measured && !retry && tries < 40) {
      tries += 1;
      retry = setTimeout(() => {
        retry = 0;
        layout(false);
      }, 250);
    }
    return size;
  }

  /** 擺得下就整齊排開（間距 GAP），擺不下就疊（step 變小）。 */
  function geometry(n, i, w, room) {
    const step = n > 1 ? Math.min(w + GAP, (room - w) / (n - 1)) : 0;
    const off = i - (n - 1) / 2;
    // 很淺的弧：兩端微微往下、往外轉。張數越多每張轉得越少，整排不會歪成扇子。
    const tilt = n > 1 ? Math.min(1.2, 6 / (n - 1)) : 0;
    return { x: off * step, y: off * off * 0.9, r: off * tilt, step };
  }

  function position(slot, i, n, w, room, animate, hot) {
    let { x, y, r, step } = geometry(n, i, w, room);
    let lift = 0;
    if (hot >= 0 && hot < n) {
      if (i === hot) {
        lift = -12;
        r = 0;
      } else if (step < w) {
        // 疊著的時候：指到的那張兩旁往外讓，露出整張。
        const d = i - hot;
        x += Math.sign(d) * Math.max(0, (w - step) * 0.55 - (Math.abs(d) - 1) * 5);
      }
    }
    // 剛做好的牌第一次擺：直接到位，不要從中間滑出來。
    slot.style.transition = animate && slot._placed && !reduced() ? "" : "none";
    slot._placed = true;
    slot.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), ${(y + lift).toFixed(1)}px) rotate(${r.toFixed(2)}deg)`;
    slot.style.zIndex = String(i === hot ? 50 : 10 + i);
    slot.classList.toggle("is-hot", i === hot);
  }

  function setHot(i) {
    if (i === hot) return;
    hot = i;
    placeAll(true);
  }

  function slotFor(tag) {
    let s = slots.get(tag);
    if (s) return s;
    s = document.createElement("div");
    s.className = "fav-slot";
    s.dataset.tag = tag;
    const node = makeNode(tag);
    node.classList.add("fav-card");
    node.tabIndex = -1;
    // 托盤一打開就要看得到圖：不等捲動才載。
    for (const img of node.querySelectorAll("img")) img.loading = "eager";
    node.title = "點一下放進卡池";
    decorate(node, tag);
    node.addEventListener("click", (e) => {
      e.preventDefault();
      play(tag);
    });
    node.setAttribute("aria-keyshortcuts", "Delete ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight");
    node.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const i = cardsNow().indexOf(node);
        remove(tag);
        refocus(i);
        return;
      }
      const cards = cardsNow();
      const i = cards.indexOf(node);
      const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: cards.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const j = Math.max(0, Math.min(cards.length - 1, to));
      // Shift＋方向鍵：這張往左／往右挪一格（排順序）。
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        if (j === i) return;
        insertAt(tag, j);
        write(key, tags);
        layout(true);
        onChange();
        focusCard(node);
        return;
      }
      focusCard(cards[j]);
    });
    const idx = () => [...fan.querySelectorAll(".fav-slot")].indexOf(s);
    node.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") setHot(idx());
    });
    node.addEventListener("focus", () => setHot(idx()));
    const x = document.createElement("button");
    x.type = "button";
    x.className = "fav-x";
    x.setAttribute("aria-label", "從偏好卡牌拿掉");
    x.title = "從偏好卡牌拿掉";
    // 鍵盤用 Delete 拿掉，Tab 不用一張一張停在 × 上。
    x.tabIndex = -1;
    x.innerHTML =
      '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      remove(tag);
    });
    x.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") setHot(idx());
    });
    s.append(node, x);
    slots.set(tag, s);
    return s;
  }

  function paintHead() {
    const placed = tags.length - shownTags().length;
    tab.innerHTML = `${ICON}<span class="fav-title">偏好卡牌</span><b class="fav-count">${tags.length}/${max}</b>${CHEVRON}`;
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    tab.title = open ? "收起偏好卡牌" : "打開偏好卡牌";
    pick.textContent = editing ? "完成" : "＋ 挑牌";
    pick.setAttribute("aria-pressed", editing ? "true" : "false");
    pick.title = editing ? "挑好了（Esc）" : "點字盒裡的牌加進來，再點一次拿掉";
    hint.textContent = editing ? "點字盒裡的牌加進來，再點一次拿掉" : placed ? `${placed} 張在卡池裡` : "";
  }

  /** 只重排位置（指到別張、視窗變寬窄），不動節點。 */
  function placeAll(animate) {
    const kids = [...fan.querySelectorAll(".fav-slot")];
    const w = size.shown || size.w;
    const list = gap ? kids.filter((k) => k.dataset.tag !== gap.skip) : kids;
    const m = gap ? list.length + 1 : list.length;
    const room = roomFor(m);
    setWant(m);
    for (const k of kids) k.classList.toggle("is-out", !!gap && k.dataset.tag === gap.skip);
    list.forEach((k, j) => position(k, gap && j >= gap.at ? j + 1 : j, m, w, room, animate, gap ? -1 : hot));
  }

  /** 托盤要多寬（照張數長，夾在視窗裡）；跟 CSS 的算法一樣，才不用等寬度轉場跑完才知道擺不擺得下。 */
  function trayWidth(m) {
    const w = size.shown || size.w;
    // 跟 CSS 一樣：手機兩邊各 8、寬螢幕兩邊各留 100 給角落的廢字簍。
    const edge = vw < 640 ? 16 : vw >= 1100 ? 200 : 20;
    return Math.min(vw - edge, Math.max(Math.max(m, 1) * (w + GAP) - GAP + 40, 360));
  }
  function roomFor(m) {
    const pad = vw < 640 ? 16 : 20;
    return Math.max(size.shown || size.w, trayWidth(m) - pad - 2 - 8);
  }
  function setWant(m) {
    const w = size.shown || size.w;
    el.style.setProperty("--fav-want", Math.max(m, 1) * (w + GAP) - GAP + 40 + "px");
  }

  /** 指標在 x：插進去會是第幾格（skip：托盤上被拖著的那張不算）。 */
  function gapIndex(x, skip) {
    const list = shownTags().filter((t) => t !== skip);
    const m = list.length + 1;
    if (m < 2) return 0;
    const w = size.shown || size.w;
    const room = roomFor(m);
    const step = Math.min(w + GAP, (room - w) / (m - 1));
    const r = fan.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    return Math.max(0, Math.min(m - 1, Math.round((x - cx) / step + (m - 1) / 2)));
  }

  /** 把 tag 放進 tags，讓它在托盤上排第 at 格（at 算的是擺出來的牌；卡池裡的不佔格）。 */
  function insertAt(tag, at) {
    const list = shownTags().filter((t) => t !== tag);
    const rest = tags.filter((t) => t !== tag);
    let i = rest.length;
    if (at != null && at < list.length) i = rest.indexOf(list[at]);
    else if (at != null && list.length) i = rest.indexOf(list[list.length - 1]) + 1;
    rest.splice(i, 0, tag);
    tags = rest;
  }

  /**
   * 拖著經過托盤（x：指標位置；null＝離開了）。插進去的那一格先空出來，兩旁的牌滑開。
   * 滿十張又不是托盤上的牌：不空格，標頭說滿了。
   */
  function hover(x, tag) {
    const full = !tags.includes(tag) && tags.length >= max;
    if (x == null || !open || full) {
      const was = gap || el.dataset.full === "true";
      gap = null;
      if (full && x != null) {
        el.dataset.full = "true";
        hint.textContent = `滿 ${max} 張了，先拿掉一張`;
        return;
      }
      delete el.dataset.full;
      if (was) {
        paintHead();
        placeAll(true);
      }
      return;
    }
    const skip = shownTags().includes(tag) ? tag : null;
    const at = gapIndex(x, skip);
    if (gap && gap.at === at && gap.skip === skip) return;
    gap = { at, skip };
    hot = -1;
    placeAll(true);
  }

  /**
   * 牌放在托盤上（拖曳）。已經在手牌裡：換到放下的位置；不在：插在放下的位置。
   * 回傳 false＝收不下（滿了），房間讓影子彈回原位。
   */
  function drop(tag, x) {
    const skip = shownTags().includes(tag) ? tag : null;
    const at = open && x != null ? gapIndex(x, skip) : null;
    gap = null;
    delete el.dataset.full;
    if (tags.includes(tag)) {
      if (at != null) insertAt(tag, at);
      write(key, tags);
      layout(true);
      snap(tag);
      onChange();
      return true;
    }
    return add(tag, null, { at, quiet: true });
  }

  /** 這張直接到位（不走轉場）：拖曳的影子要量它最後的位置落下去。 */
  function snap(tag) {
    const s = slots.get(tag);
    if (s) s.style.transition = "none";
  }

  /** 重擺托盤。animate：位置變化用轉場滑過去（加牌、出牌）。 */
  function layout(animate = true) {
    const m = measure();
    // 手機上字盒的牌很大（一排三張），托盤照原樣會吃掉半個螢幕：整張等比例縮到 76px，長相不變。
    // 桌機上比字盒的牌大 15%：托盤浮在畫面最下面、離眼睛最遠，跟字盒一樣大看起來反而偏小。
    const k = vw < 640 ? Math.min(1, 76 / m.w) : TRAY_SCALE;
    const w = Math.round(m.w * k * 10) / 10;
    const fs = Math.round(m.fs * k * 100) / 100;
    size.shown = w;
    const show = shownTags();
    const n = show.length;
    el.style.setProperty("--fav-card-w", w + "px");
    el.style.setProperty("--fav-card-fs", fs + "px");
    const kids = show.map(slotFor);
    const keep = new Set(kids);
    for (const c of [...fan.children]) if (!keep.has(c)) c.remove();
    kids.forEach((k, i) => {
      if (fan.children[i] !== k) fan.insertBefore(k, fan.children[i] || null);
    });
    if (!n) {
      empty.textContent = tags.length
        ? "偏好卡牌都在卡池裡了，從卡池拿下來就回到這裡。"
        : editing
          ? "點字盒裡的牌加進來，最多十張。"
          : "把字盒的牌拖到這裡，或按「＋ 挑牌」。";
      if (!empty.isConnected) fan.append(empty);
    } else empty.remove();
    if (hot >= n) hot = -1;
    // 只留一張在 Tab 順序裡：剛剛那張還在就是它，不然第一張。
    const cards = kids.map((k) => k.querySelector(".fav-card"));
    const keep0 = cards.find((c) => c.tabIndex === 0) || cards[0];
    for (const c of cards) c.tabIndex = c === keep0 ? 0 : -1;
    for (const t of show) {
      const s = slots.get(t);
      s.classList.toggle("is-arriving", pendingArrive.has(t));
      // 現在的分級（或別的規則）出不了這張：蓋章、變淡，說明寫在提示裡 —— 不然點下去牌上了版卻什麼都沒發生。
      const why = blocked(t);
      const card = s.querySelector(".fav-card");
      setCardFlag(card, why ? { kind: "ban", text: why } : null);
      s.classList.toggle("is-blocked", !!why);
      card.title = why ? `${why}：現在的設定抽不到它` : "點一下放進卡池";
    }
    el.dataset.open = open ? "true" : "false";
    el.dataset.editing = editing ? "true" : "false";
    el.dataset.count = String(n);
    el.dataset.hidden = !tags.length && !editing && !open ? "true" : "false";
    const visibleOpen = open && el.dataset.hidden !== "true" ? "true" : "false";
    if (document.body.dataset.favHandOpen !== visibleOpen) document.body.dataset.favHandOpen = visibleOpen;
    paintHead();
    placeAll(animate);
    // 托盤佔多高：下一格畫面開頭再量（那時本來就要排版），不在這裡逼一次同步排版。
    cancelAnimationFrame(spaceRaf);
    spaceRaf = requestAnimationFrame(syncSpace);
  }

  function setOpen(v) {
    const was = open;
    open = !!v;
    write(key + ".open", open);
    if (!open && editing) {
      editing = false;
      document.body.dataset.handEdit = "false";
    }
    morphTo(() => layout(false), was !== open);
    onChange();
  }

  /**
   * 托盤打開／收起的變形：量變之前、變之後的大小，外框從一個大小長（縮）到另一個，
   * 牌跟著浮上來（沉下去）。收起來的時候牌還要看得到一下，所以先留著 .is-collapsing。
   * 從完全藏著（沒有牌）變出來：整個托盤從底下浮上來。
   */
  // 生圖時會卡：以前動的是外框的 width／height／border-radius —— 每一格都要在主執行緒排版，
  // 托盤的 ResizeObserver 跟著每格量一次、寫 --fav-h 讓整頁再排；外框還帶毛玻璃，尺寸一變
  // 就得重算背後那塊模糊，跟 ComfyUI 搶顯示卡。主執行緒一被生圖的進度事件佔住，整段就掉格。
  // 現在盒子只在開頭變一次大小，動畫只改 clip-path 的裁切範圍（不排版、不觸發 ResizeObserver），
  // 變形那一下關掉毛玻璃。收起時先把盒子釘在原來的大小，裁完才放回去。
  let morphEnd = null;
  let morphBlurFrame = 0;
  function restoreMorphBlur() {
    cancelAnimationFrame(morphBlurFrame);
    morphBlurFrame = 0;
    el.classList.remove("is-morphing");
  }
  function settleMorphBlur() {
    if (document.hidden || reduced()) return restoreMorphBlur();
    // 尺寸／裁切先回到靜態並畫過一格，再恢復毛玻璃，讓 backdrop-filter
    // 用收尾後的盒子重建，降低 iPhone 沿用舊裁切圖層的風險。
    morphBlurFrame = requestAnimationFrame(() => {
      morphBlurFrame = requestAnimationFrame(restoreMorphBlur);
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && morphBlurFrame) restoreMorphBlur();
  });
  function morphTo(change, changed) {
    // 上一段還沒播完就又按：先收尾（放開釘住的大小），再量「變之前」。
    if (morphEnd) morphEnd();
    restoreMorphBlur();
    const wasHidden = el.dataset.hidden === "true";
    const before = !wasHidden ? el.getBoundingClientRect() : null;
    if (!changed || reduced()) {
      change();
      return;
    }
    const cs = before ? getComputedStyle(el) : null;
    const pinned = cs ? { padding: cs.padding, radius: cs.borderRadius } : null;
    el.classList.add("is-morphing");
    change();
    const after = el.dataset.hidden === "true" ? null : el.getBoundingClientRect();
    if (!after) {
      el.classList.remove("is-morphing");
      return;
    }
    if (!before) {
      const a = el.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out), id: "fav-morph" });
      const done = () => {
        if (morphEnd !== done) return;
        morphEnd = null;
        a.cancel();
        settleMorphBlur();
      };
      morphEnd = done;
      a.onfinish = done;
      a.oncancel = done;
      riseCards(80);
      return;
    }
    const closing = !open;
    // 裁切框用「大的那個盒子」當座標：打開時盒子已經是大的；收起時把盒子釘在原來的大小。
    const box = closing ? before : after;
    const small = closing ? after : before;
    const inset = `${(small.top - box.top).toFixed(1)}px ${(box.right - small.right).toFixed(1)}px ${(box.bottom - small.bottom).toFixed(1)}px ${(small.left - box.left).toFixed(1)}px`;
    // 圓角只到標籤自己的圓（高度的一半），不要用 999px：一路插值過去，托盤中途會變成膠囊把牌切成橢圓。
    const pill = `inset(${inset} round ${(small.height / 2).toFixed(1)}px)`;
    const full = "inset(0px 0px 0px 0px round 16px)";
    if (closing) {
      el.classList.add("is-collapsing");
      el.style.width = before.width + "px";
      el.style.height = before.height + "px";
      el.style.padding = pinned.padding;
      el.style.borderRadius = pinned.radius;
    }
    el.style.overflow = "hidden";
    const a = el.animate([{ clipPath: closing ? full : pill }, { clipPath: closing ? pill : full }], {
      duration: closing ? 300 : 360,
      easing: css(closing ? CURVE.inOut : CURVE.out),
      id: "fav-morph",
    });
    // 沉下去的牌停在看不見的地方，等外框縮完、托盤真的收起來才一起復原（不然會閃回來一下）。
    const sunk = [];
    const done = () => {
      if (morphEnd !== done) return;
      morphEnd = null;
      a.cancel();
      el.classList.remove("is-collapsing");
      el.style.overflow = "";
      el.style.width = "";
      el.style.height = "";
      el.style.padding = "";
      el.style.borderRadius = "";
      for (const s of sunk) s.cancel();
      settleMorphBlur();
    };
    morphEnd = done;
    a.onfinish = done;
    a.oncancel = done;
    if (closing) {
      // 由外往內一張一張沉下去（最外面的先走）。
      const cards = [...fan.querySelectorAll(".fav-card")];
      const mid = (cards.length - 1) / 2;
      cards.forEach((c, i) => {
        const d = Math.abs(i - mid);
        sunk.push(c.animate([{ translate: "0 0", opacity: 1 }, { translate: "0 22px", opacity: 0 }], { duration: DUR.micro, delay: Math.round((mid - d) * 18), easing: css(CURVE.exit), fill: "forwards" }));
      });
    } else riseCards(90);
  }

  /** 牌從底下一張一張浮上來（由中間往兩旁）。 */
  function riseCards(delay0) {
    const cards = [...fan.querySelectorAll(".fav-card")];
    const mid = (cards.length - 1) / 2;
    cards.forEach((c, i) => {
      c.animate([{ translate: "0 20px", opacity: 0 }, { translate: "0 0", opacity: 1 }], {
        duration: DUR.medium,
        delay: delay0 + Math.round(Math.abs(i - mid) * 26),
        easing: css(CURVE.out),
        fill: "backwards",
      });
    });
  }

  /** 工具列上的「偏好卡牌」：沒牌就直接進挑牌；有牌就打開／收起托盤。 */
  function fromButton() {
    if (open && el.dataset.hidden !== "true") return setOpen(false);
    if (!tags.length) return toggleEdit(true);
    setOpen(true);
  }

  function play(tag) {
    const node = slots.get(tag)?.querySelector(".fav-card");
    const r = node?.getBoundingClientRect();
    const i = node && node === document.activeElement ? cardsNow().indexOf(node) : -1;
    hot = -1;
    onPlay(tag, r || null);
    // 用鍵盤出牌：焦點留在托盤，落到旁邊那張（不要掉回頁面最上面）。
    if (i >= 0) refocus(i);
  }

  const cardsNow = () => [...fan.querySelectorAll(".fav-slot:not(.is-out) .fav-card")];

  /** 托盤只有一張牌在 Tab 順序裡（跟字盒一樣），方向鍵在牌之間移動。 */
  function focusCard(card) {
    if (!card) return;
    for (const c of fan.querySelectorAll(".fav-card")) c.tabIndex = c === card ? 0 : -1;
    card.focus({ preventScroll: true });
  }
  function refocus(i) {
    setTimeout(() => {
      const cards = cardsNow().filter((c) => c.isConnected && !c.closest(".fav-slot").style.pointerEvents);
      if (cards.length) focusCard(cards[Math.min(i, cards.length - 1)]);
      else tab.focus({ preventScroll: true });
    }, 0);
  }

  /** 加一張。from：來源的位置（字盒上那張），牌從那裡飛進托盤。 */
  function add(tag, from = null, { at = null, quiet = false } = {}) {
    if (!open) setOpen(true);
    if (tags.includes(tag)) {
      const c = slots.get(tag)?.querySelector(".fav-card");
      if (c?.isConnected && !reduced()) c.animate([{ translate: "0 0" }, { translate: "0 -8px" }, { translate: "0 0" }], { duration: DUR.medium, easing: css(CURVE.out) });
      return false;
    }
    if (tags.length >= max) {
      if (!reduced()) tab.animate([{ translate: "0 0" }, { translate: "-6px 0" }, { translate: "6px 0" }, { translate: "-3px 0" }, { translate: "0 0" }], { duration: DUR.medium, easing: css(CURVE.out) });
      onFull();
      return false;
    }
    insertAt(tag, at);
    write(key, tags);
    layout(true);
    if (quiet) snap(tag);
    onChange();
    const s = slots.get(tag);
    if (s?.isConnected && !reduced() && !quiet) {
      if (from) flyInto(s, from);
      else s.querySelector(".fav-card").animate([{ translate: "0 18px", opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
    }
    if (!reduced()) el.querySelector(".fav-count")?.animate([{ scale: "1" }, { scale: "1.35" }, { scale: "1" }], { duration: DUR.medium, easing: css(CURVE.out) });
    return true;
  }

  /** 挑牌模式：點一下加、再點一下拿掉。 */
  function toggle(tag, from = null) {
    if (tags.includes(tag)) remove(tag);
    else add(tag, from);
  }

  function flyInto(slot, from) {
    const card = slot.querySelector(".fav-card");
    const f = card.cloneNode(true);
    f.classList.remove("fav-card");
    // 起飛時跟字盒那張一樣大：字級照寬度比例放回去（手機上托盤的牌是縮過的）。
    f.style.fontSize = (parseFloat(getComputedStyle(card).fontSize) * from.width) / (card.offsetWidth || from.width) + "px";
    card.style.visibility = "hidden";
    // 追著落點飛：托盤正在變寬、整排往兩旁讓，落點一路在動，影子跟著它落下。
    flight(f, from, () => (card.isConnected ? card : null), {
      tilt: -4,
      onLand: () => {
        card.style.visibility = "";
        if (!reduced()) card.animate([{ translate: "0 3px", scale: "0.98" }, { translate: "0 -1px", scale: "1.01" }, { translate: "0 0", scale: "1" }], { duration: DUR.short, easing: css(CURVE.out) });
      },
    });
  }

  /** 從手牌拿掉（×、Delete、拖回字盒、被封鎖、挑牌時再點一次）。 */
  function remove(tag, { quiet = false } = {}) {
    if (!tags.includes(tag)) return;
    const s = slots.get(tag);
    const was = tags.indexOf(tag);
    // × 很小、就在要點的牌旁邊，手滑很常見：給一次反悔的機會（挑牌模式是故意點掉的，不問）。
    if (!quiet && !editing) onRemoved(tag, () => restore(tag, was));
    tags = tags.filter((t) => t !== tag);
    write(key, tags);
    slots.delete(tag);
    pendingArrive.delete(tag);
    hot = -1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      s?.remove();
      layout(true);
      onChange();
    };
    if (s?.isConnected && !quiet && !reduced()) {
      s.style.pointerEvents = "none";
      const a = s.querySelector(".fav-card").animate(
        [
          { opacity: 1, translate: "0 0", scale: "1" },
          { opacity: 0, translate: "0 22px", scale: "0.92" },
        ],
        { duration: DUR.micro, easing: css(CURVE.exit), fill: "forwards" }
      );
      a.onfinish = finish;
      setTimeout(finish, 320);
    } else finish();
  }

  /** 復原：放回原本的位置，從底下浮上來。 */
  function restore(tag, at) {
    if (tags.includes(tag) || tags.length >= max || !known(tag)) return;
    if (!open) setOpen(true);
    tags.splice(Math.min(at, tags.length), 0, tag);
    write(key, tags);
    layout(true);
    onChange();
    const c = slots.get(tag)?.querySelector(".fav-card");
    if (c?.isConnected && !reduced()) c.animate([{ translate: "0 22px", opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: DUR.medium, easing: css(CURVE.out) });
  }

  function toggleEdit(force) {
    editing = force === undefined ? !editing : !!force;
    const opening = editing && !open;
    if (opening) {
      open = true;
      write(key + ".open", true);
    }
    document.body.dataset.handEdit = editing ? "true" : "false";
    hot = -1;
    morphTo(() => layout(true), opening);
    onChange();
  }

  /**
   * 一張牌要從卡池回到托盤：先把位置擺好、藏著，影子落地（delay 毫秒後）才亮出來。
   * 房間的「飛回去」拿 nodeOf(tag) 的位置當落點。
   */
  function arriveAt(tag, delay = 480) {
    pendingArrive.add(tag);
    slots.get(tag)?.classList.add("is-arriving");
    // delay 是保險：影子落地時房間會先呼叫 reveal()；沒呼叫（影子沒飛）時間到也會亮。
    setTimeout(() => reveal(tag), delay);
  }

  /** 飛回來的影子落地了：那張亮出來，輕輕壓一下。 */
  function reveal(tag) {
    if (!pendingArrive.delete(tag)) return;
    const s = slots.get(tag);
    if (!s) return;
    s.classList.remove("is-arriving");
    if (!reduced()) s.querySelector(".fav-card").animate([{ translate: "0 3px", scale: "0.98" }, { translate: "0 -1px", scale: "1.01" }, { translate: "0 0", scale: "1" }], { duration: DUR.short, easing: css(CURVE.out) });
  }

  /**
   * 牌從卡池回到手上（清版、拿下來、被擠掉）：snaps 是那幾張離開前的樣子 [{ node, rect }]
   * （房間在重畫之前量好，重畫之後同一個 task 裡呼叫，中間不會有一格牌不見了的空白）。
   *   托盤開著：每張飛回它在托盤上的那一格（那格先留好、藏著，托盤變寬、整排讓位都跟得上），
   *             落地時轉到扇形上那一格的角度，落定才亮。
   *   托盤收著：飛向那顆標籤的圖示、縮小被收進去，最後一張進去時標籤脹一下 —— 不自己打開托盤。
   * delay：第一張什麼時候起飛；每張再錯開一點（像一張一張收回手裡）。回傳全部落地要多久。
   */
  function receive(snaps, { delay = 0, stagger = 45 } = {}) {
    const mine = snaps.filter((s) => s && s.rect && s.rect.width && tags.includes(s.node.dataset.tag));
    if (!mine.length) return 0;
    if (reduced()) {
      for (const s of mine) reveal(s.node.dataset.tag);
      return 0;
    }
    // 由左到右收（跟手牌的順序一樣），看起來是一張一張拿回手裡，不是同時亂飛。
    mine.sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
    let end = 0;
    let left = mine.length;
    mine.forEach((snap, i) => {
      const tag = snap.node.dataset.tag;
      const d = delay + i * stagger;
      // 托盤那一格先藏著；時間只是保險，正常是影子落地時 reveal。
      arriveAt(tag, d + 2400);
      const slotCard = open ? slots.get(tag)?.querySelector(".fav-card") : null;
      // 影子用托盤那張（同一張牌，沒有卡池上的墨點、附帶章）：離開卡池就是手上的那張了。
      const ghost = (slotCard || makeNode(tag)).cloneNode(true);
      ghost.classList.remove("fav-card", "is-related", "is-stamped", "is-popped");
      ghost.style.visibility = "";
      ghost.removeAttribute("tabindex");
      const landed = () => {
        reveal(tag);
        left -= 1;
        if (!left && !open) pulse();
      };
      let f;
      if (slotCard) {
        f = flight(ghost, snap.rect, () => (open && slots.get(tag)?.isConnected ? slots.get(tag).querySelector(".fav-card") : null), {
          delay: d,
          // 弧拱低一點：托盤在下面，拱太高會先往上飛、跟收成一疊的牌撞在一起。
          arc: 12,
          zIndex: 95,
          tilt: i % 2 ? 4 : -4,
          endRotate: angleOf(tag),
          onLand: landed,
        });
      } else {
        // 收著：落點是標籤上那個圖示，牌縮成兩成被收進去。
        const into = () => {
          const icon = tab.querySelector("svg") || tab;
          const r = icon.getBoundingClientRect();
          const w = snap.rect.width * 0.2;
          return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - (w * 1.4625) / 2, width: w };
        };
        f = flight(ghost, snap.rect, into, { delay: d, arc: 24, tilt: i % 2 ? 6 : -6, endOpacity: 0.15, scaleLate: 0.8, zIndex: 95, onLand: landed });
      }
      end = Math.max(end, d + f.duration);
    });
    return end;
  }

  /**
   * 牌從手上打出去（撤回清版、復原清空）時，影子從哪裡出發：
   * 托盤開著是它那一格（牌本身的大小和角度，不是轉過之後的外框）；收著是標籤的圖示
   * （scale 0.2，飛出來的路上才長成一張牌）；托盤完全藏著就 null（房間自己決定從哪裡來）。
   * 要在重畫之前量（重畫之後那一格就讓出去了）。node：影子要複製的那張。
   */
  function launchFrom(tag, cardW = 84) {
    const card = open ? slots.get(tag)?.querySelector(".fav-card") : null;
    if (card && card.isConnected) {
      const r = card.getBoundingClientRect();
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      return { rect: { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - h / 2, width: w, height: h }, node: card, rotate: angleOf(tag) };
    }
    if (el.dataset.hidden === "true") return null;
    // 收著：一張正常大小的牌，中心對著標籤的圖示，從兩成大開始長（startScale）。影子用乾淨的那張牌。
    const icon = tab.querySelector("svg") || tab;
    const r = icon.getBoundingClientRect();
    const h = cardW * 1.4625;
    return { rect: { left: r.left + r.width / 2 - cardW / 2, top: r.top + r.height / 2 - h / 2, width: cardW, height: h }, node: makeNode(tag), rotate: 0, scale: 0.2 };
  }

  /** 托盤上那一格現在的角度（扇形的那一點點斜）。 */
  function angleOf(tag) {
    const m = /rotate\((-?[\d.]+)deg\)/.exec(slots.get(tag)?.style.transform || "");
    return m ? parseFloat(m[1]) : 0;
  }

  /** 收著的標籤脹一下（牌被收進去了）。 */
  function pulse() {
    if (reduced()) return;
    el.animate([{ scale: "1" }, { scale: "1.08" }, { scale: "1" }], { duration: DUR.long, easing: css(CURVE.settle) });
    el.querySelector(".fav-count")?.animate([{ scale: "1" }, { scale: "1.3" }, { scale: "1" }], { duration: DUR.long, easing: css(CURVE.settle) });
  }

  /** 字盒上標出哪幾張在手牌裡（root 底下的 .card[data-tag]）。 */
  function mark(root) {
    if (!root) return;
    const set = new Set(tags);
    for (const n of root.querySelectorAll(".card[data-tag]")) {
      if (set.has(n.dataset.tag)) {
        // 剛加進手牌的那張：「手」像橡皮章壓下來（跟「在池」同一個手感）；本來就有的不重蓋。
        if (n.dataset.inHand !== "true" && !reduced()) {
          n.classList.remove("is-hand-stamp");
          void n.offsetWidth;
          n.classList.add("is-hand-stamp");
          setTimeout(() => n.classList.remove("is-hand-stamp"), DUR.long + 40);
        }
        n.dataset.inHand = "true";
      } else delete n.dataset.inHand;
    }
  }

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => layout(false));
  });
  layout(false);

  return {
    el,
    fan,
    get editing() {
      return editing;
    },
    get open() {
      return open && el.dataset.hidden !== "true";
    },
    get count() {
      return tags.length;
    },
    max,
    has: (t) => tags.includes(t),
    tags: () => [...tags],
    add,
    toggle,
    hover,
    drop,
    remove,
    toggleEdit,
    setOpen,
    toggleOpen: () => setOpen(!open),
    fromButton,
    update: () => layout(true),
    arriveAt,
    reveal,
    receive,
    launchFrom,
    mark,
    /** 托盤上那張牌（收起來、沒擺出來就 null）：房間拿它當飛回來的落點。 */
    nodeOf: (t) => (open && slots.get(t)?.isConnected ? slots.get(t).querySelector(".fav-card") : null),
  };
}
