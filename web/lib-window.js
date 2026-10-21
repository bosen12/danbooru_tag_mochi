/**
 * 手機挑牌抽屜的字盒：只留畫面上下附近的牌（虛擬捲動）。
 *
 * 以前一路往下補牌、補過的永遠留著：捲到兩千張時 DOM 兩萬個節點、renderer 380MB，
 * 每一格畫面都要整片重排（7～8 千個物件，34～47ms），捲到底長任務合計 11 秒。
 * 現在牌格前後各一個墊高的空白（佔掉沒畫的那幾排的高度），捲動條的長度一開始就是整盒的長度；
 * 捲到哪就畫哪幾排，前後各多留 overscan 個畫面。牌照 tag 留著重用（最多 keep 張），
 * 捲回來不必重建；重新插進來時叫 refresh(node, card) 補上這段時間改過的狀態（池中、封鎖、偏好…）。
 *
 * grid：牌格（CSS grid，auto-fill 欄）；scroller：真的在捲的那一層；make(card) 做一張牌。
 */
export function createLibWindow({ grid, scroller, make, refresh, first = 24, overscan = 1, keep = 360 }) {
  let list = [];
  let cols = 0;
  let rowH = 0;
  let gap = 0;
  let shown = [-1, -1];
  let frame = 0;
  let active = false;
  const cache = new Map();
  const spacer = (end) => {
    const s = document.createElement("span");
    s.className = "lib-spacer";
    s.setAttribute("aria-hidden", "true");
    s.dataset.end = end;
    s.style.gridColumn = "1 / -1";
    return s;
  };
  const top = spacer("top");
  const bottom = spacer("bottom");

  const nodeOf = (card) => {
    let node = cache.get(card.tag);
    if (node) {
      cache.delete(card.tag);
      cache.set(card.tag, node);
      refresh?.(node, card);
      return node;
    }
    node = make(card);
    cache.set(card.tag, node);
    if (cache.size > keep) cache.delete(cache.keys().next().value);
    return node;
  };

  // 量一排多高、一排幾張：拿畫出來的前兩排牌量（牌寬由 sizeCards 決定，換寬度就重量）。
  const measure = () => {
    const cards = grid.querySelectorAll(":scope > .card");
    if (!cards.length) return false;
    const y0 = cards[0].offsetTop;
    let c = 1;
    while (c < cards.length && cards[c].offsetTop === y0) c++;
    const h = cards[0].offsetHeight;
    if (!h) return false;
    gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
    cols = c;
    rowH = h + gap;
    return true;
  };

  const height = (rows) => (rows > 0 ? `${rows * rowH - gap}px` : "0px");

  function update(force = false) {
    frame = 0;
    if (!active) return;
    if (!rowH || force) {
      if (!measure()) return;
    }
    const rows = Math.ceil(list.length / cols);
    // 牌格頂端在捲動層裡的位置（上面還有細分類籤，一起捲）。
    const gridTop = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop + (parseFloat(getComputedStyle(grid).paddingTop) || 0);
    const view = scroller.clientHeight || innerHeight;
    const pad = Math.ceil((view / rowH) * overscan);
    const v0 = Math.max(0, Math.floor((scroller.scrollTop - gridTop) / rowH));
    const v1 = Math.min(rows, Math.ceil((scroller.scrollTop - gridTop + view) / rowH));
    // 畫好的那一段離看得到的地方還有半個 overscan 以上：不動。只有快捲到邊了才往前後補、把遠的拿掉。
    if (!force && shown[0] >= 0) {
      const s0 = shown[0] / cols;
      const s1 = Math.ceil(shown[1] / cols);
      const margin = Math.ceil(pad / 2);
      if ((s0 === 0 || v0 - s0 >= margin) && (s1 >= rows || s1 - v1 >= margin)) return;
    }
    const r0 = Math.max(0, v0 - pad);
    const r1 = Math.min(rows, v1 + pad);
    const start = r0 * cols;
    const end = Math.min(list.length, Math.max(r1, r0 + 1) * cols);
    if (!force && start === shown[0] && end === shown[1]) return;
    place(start, end, force);
    shown = [start, end];
    top.style.height = height(r0);
    top.hidden = r0 === 0;
    const after = rows - Math.ceil(end / cols);
    bottom.style.height = height(after);
    bottom.hidden = after <= 0;
  }

  // 只動頭尾：跟上一段重疊的牌留在原地（整批拆掉重插，每一張都要重算樣式，捲動時一格畫面要 100ms 以上）。
  function place(start, end, all) {
    const [a, b] = shown;
    if (all || a < 0 || end <= a || start >= b || top.parentNode !== grid) {
      grid.replaceChildren(top, ...list.slice(start, end).map(nodeOf), bottom);
      return;
    }
    const cards = [...grid.children].filter((n) => n !== top && n !== bottom);
    // 前面拿掉／補上
    if (start > a) for (const n of cards.slice(0, start - a)) n.remove();
    else if (start < a) top.after(...list.slice(start, a).map(nodeOf));
    // 後面拿掉／補上
    if (end < b) for (const n of cards.slice(cards.length - (b - end))) n.remove();
    else if (end > b) bottom.before(...list.slice(b, end).map(nodeOf));
  }

  const schedule = () => {
    if (frame || !active) return;
    frame = requestAnimationFrame(() => update());
  };
  scroller.addEventListener("scroll", schedule, { passive: true });
  if (typeof ResizeObserver === "function") {
    let lastW = 0;
    new ResizeObserver(() => {
      if (!active || grid.clientWidth === lastW) return;
      lastW = grid.clientWidth;
      rowH = 0;
      schedule();
    }).observe(grid);
  }

  return {
    /** 換了一批牌（花色、搜尋…）：先畫前 first 張，下一格畫面量好一排多高再照捲到的地方畫。 */
    set(next) {
      active = true;
      list = next;
      shown = [-1, -1];
      grid.replaceChildren(...list.slice(0, first).map(nodeOf));
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update(true));
    },
    /** 抽屜打開、版面變了：重量重畫。 */
    update: () => update(true),
    /** 回到一般字盒（電腦、平板）：不再管這一層。 */
    stop() {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
    get active() {
      return active;
    },
    /** 第幾張在不在畫面上的那一段（鍵盤、找牌用）。 */
    range: () => shown.slice(),
  };
}
