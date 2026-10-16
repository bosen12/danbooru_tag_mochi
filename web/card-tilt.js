/**
 * 牌拿在手上的手感（電腦）：滑鼠在牌上移動時，牌跟著微微傾斜（往游標那一側壓下去），
 * 牌面一道反光跟著游標走；離開時慢慢放平，按下去的那一下先放平再往紙裡壓（card.css 的 :active）。
 *
 * 事件委派：一個區塊掛一次（字盒、合成池、疊印台的卡盒和卡池、成品詳情裡的牌、卡冊）。
 * 只動滑鼠底下那一張：寫它的 CSS 變數（--rx、--ry 傾斜，--gx、--gy 反光的位置），每格畫面最多寫一次。
 * 觸控、開了減少動態都不掛；拖曳中（body[data-dragging]）、按住的時候不傾斜。
 */
const FINE = matchMedia("(hover: hover) and (pointer: fine)");
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
// 最大傾角：小牌（字盒 88px）7° 看得出立體、又不會晃到看不清字。
const MAX_DEG = 7;

export function attachTilt(root, selector = ".card[data-tag]") {
  if (!root || !FINE.matches || root.dataset.tilt === "on") return;
  root.dataset.tilt = "on";
  let cur = null;
  let frame = 0;
  let pressed = false;
  let px = 0;
  let py = 0;

  const flatten = (n) => {
    if (!n) return;
    delete n.dataset.tilt;
    for (const k of ["--rx", "--ry", "--gx", "--gy"]) n.style.removeProperty(k);
  };
  const paint = () => {
    frame = 0;
    if (!cur || !cur.isConnected || pressed) return;
    const r = cur.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = Math.min(1, Math.max(0, (px - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (py - r.top) / r.height));
    // 游標在上半部：上緣往後倒（rotateX 正）；在右半部：右緣往後倒（rotateY 正）。
    cur.style.setProperty("--rx", ((0.5 - y) * 2 * MAX_DEG).toFixed(2) + "deg");
    cur.style.setProperty("--ry", ((x - 0.5) * 2 * MAX_DEG).toFixed(2) + "deg");
    cur.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
    cur.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    cur.dataset.tilt = "on";
  };

  root.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse" || REDUCED.matches) return;
      const n = e.target.closest?.(selector);
      const next = n && root.contains(n) && document.body.dataset.dragging !== "true" ? n : null;
      if (next !== cur) {
        flatten(cur);
        cur = next;
      }
      if (!cur) return;
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    },
    { passive: true }
  );
  root.addEventListener("pointerleave", () => {
    flatten(cur);
    cur = null;
  });
  // 按下去：先放平（:active 的往下壓才看得清楚），放開之後滑鼠一動再跟著傾斜。
  root.addEventListener(
    "pointerdown",
    () => {
      pressed = true;
      flatten(cur);
    },
    { capture: true, passive: true }
  );
  addEventListener(
    "pointerup",
    () => {
      pressed = false;
    },
    { passive: true }
  );
}
