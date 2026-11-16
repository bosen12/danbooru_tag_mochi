/**
 * 成品牆的瀑布流（照 obscura 底片庫的做法）：每張照自己的長寬比、不留白，一張張疊進最矮的那一欄。
 *
 * DOM 順序就是時間順序（新的在前）：鍵盤 Tab、讀屏、flip 都照這個順序；畫面上用絕對定位排，不把成品拆進各欄。
 * 高度用量的（量一次整面牆只排一次版）：電腦上牌名、按鈕疊在圖上，一張的高度就是圖的高度；
 * 手機上圖底下那一行跟著算進去。只抽牌的那張是一手牌的高度。
 *
 *   const m = mountMasonry(wall, { cols: () => "auto" | "3"…, minCol, gap })
 *   m.now()              立刻排（flip 量完舊位置、改完 DOM 之後叫，讓 flip 量得到新位置）
 *   m.animate()          從現在的位置滑到新的位置（換每排張數、某張變高變矮）
 * 牆變寬變窄、某一張變高變矮、加進拿掉幾張：自己會重排（下一格畫面），不用叫。
 */
import { reducedMotion, DUR, CURVE, css } from "./motion.js";

export function mountMasonry(wall, { cols = () => "auto", minCol = 240, fixedMin = 140, gap = () => 12 } = {}) {
  let queued = 0;
  let animateNext = false;
  let lastWidth = -1;

  const items = () => [...wall.children].filter((n) => n.nodeType === 1 && !n.hidden);

  const colCount = (width, g) => {
    const want = cols();
    // 自動：一欄至少 minCol 寬（手機給小一點：兩欄並排，跟 obscura 一樣）。
    const min = typeof minCol === "function" ? minCol() : minCol;
    if (want === "auto") return Math.max(1, Math.floor((width + g) / (min + g)));
    return Math.max(1, Math.min(Number(want) || 3, Math.floor((width + g) / (fixedMin + g))));
  };

  /** 排一次。animate：每張從舊位置（含大小）滑到新位置，只演畫面上看得到的。 */
  function layout({ animate = false } = {}) {
    queued = 0;
    const list = items();
    const width = wall.clientWidth;
    if (!width) return;
    lastWidth = width;
    const g = gap();
    const n = colCount(width, g);
    const colW = (width - g * (n - 1)) / n;
    wall.dataset.masonry = String(n);
    wall.style.setProperty("--masonry-w", `${colW}px`);
    // 舊位置：只記畫面附近的（滿 80 張也只演看得到的那幾張）。
    const vh = innerHeight;
    const before = new Map();
    const motion = animate && !reducedMotion();
    if (motion) {
      for (const node of list) {
        const r = node.getBoundingClientRect();
        if (r.width && r.bottom > -vh * 0.5 && r.top < vh * 1.5) before.set(node, r);
      }
    }
    // 先寫寬度、再一起量高度：整面牆只排一次版。
    for (const node of list) {
      const w = `${colW}px`;
      if (node.style.width !== w) node.style.width = w;
    }
    const heights = list.map((node) => node.offsetHeight);
    const tops = new Array(n).fill(0);
    list.forEach((node, i) => {
      let col = 0;
      for (let c = 1; c < n; c++) if (tops[c] < tops[col] - 0.5) col = c;
      const left = `${(col * (colW + g)).toFixed(2)}px`;
      const top = `${tops[col].toFixed(2)}px`;
      if (node.style.left !== left) node.style.left = left;
      if (node.style.top !== top) node.style.top = top;
      tops[col] += heights[i] + g;
    });
    const total = Math.max(0, Math.max(...tops, g) - g);
    wall.style.height = `${total}px`;
    if (!motion) return;
    for (const [node, a] of before) {
      const b = node.getBoundingClientRect();
      if (!b.width) continue;
      const k = a.width / b.width;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(k - 1) < 0.01) continue;
      for (const old of node.getAnimations()) if (old.id === "masonry") old.cancel();
      node.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${k.toFixed(4)})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { id: "masonry", duration: DUR.long, easing: css(CURVE.out) }
      );
    }
  }

  const soon = (animate) => {
    animateNext ||= animate;
    if (queued) return;
    queued = requestAnimationFrame(() => {
      const a = animateNext;
      animateNext = false;
      layout({ animate: a });
    });
  };

  // 牆變寬變窄：重排（欄數可能變了）。某一張變高變矮（只抽牌送去印、狀態字換行）：滑過去。
  const sizes = new WeakMap();
  const ro = new ResizeObserver((entries) => {
    let moved = false;
    for (const e of entries) {
      if (e.target === wall) {
        if (wall.clientWidth !== lastWidth) soon(false);
        continue;
      }
      const h = e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height;
      if (sizes.get(e.target) !== h) {
        if (sizes.has(e.target)) moved = true;
        sizes.set(e.target, h);
      }
    }
    if (moved) soon(true);
  });
  ro.observe(wall);
  const watch = (node) => node.nodeType === 1 && ro.observe(node);
  for (const node of wall.children) watch(node);
  // 加進來、拿掉的（裁掉超過 80 張、收掉取消的）：有叫 now() 的已經排好，這裡只是保險。
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach(watch);
      r.removedNodes.forEach((node) => node.nodeType === 1 && ro.unobserve(node));
    }
    soon(false);
  }).observe(wall, { childList: true });

  return { now: () => layout(), animate: () => layout({ animate: true }) };
}
