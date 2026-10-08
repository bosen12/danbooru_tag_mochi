/**
 * 浮空放大卡：滑鼠停在一張牌上，旁邊浮出一張放大的牌（插畫、字名、英文 tag、說明）。
 * 手感照 LoRA 面板的預覽：一移上去就出現，右邊放不下就放左邊，淡入加一點點放大。
 *
 * 墨池、字鋪、排字匣（卡牌模式）共用。用事件委派掛在容器上，所以容器裡的牌
 * 被重畫、被換掉都不用重新綁。只在有滑鼠的裝置上出現；鍵盤聚焦也會出現。
 *
 *   attachPeek(root, ".card", (el) => ({ zh, tag, glyph, suit, art, rating, seal, sealTitle, facts: [[k, v]…] }))
 *   seal：小分類的一字章（鏡、表、上…），蓋在書脊最底下，跟牌面上的一樣。
 */

// 時間、曲線用頁面的動態詞彙（web6/tokens.css）；別的房間沒定義就用括號裡的預設值。
const STYLE_ID = "card-peek-style";
const CSS = `
.card-peek{position:fixed;z-index:180;width:248px;pointer-events:none;opacity:0;transform:translateY(6px) scale(.96);
transition:opacity var(--dur-micro,120ms) var(--ease-out,cubic-bezier(.16,1,.3,1)),transform var(--dur-short,220ms) var(--ease-out,cubic-bezier(.16,1,.3,1));
border-radius:14px;background:var(--peek-panel,oklch(21% .016 250));border:1px solid var(--peek-line,oklch(34% .016 250));
box-shadow:0 22px 50px oklch(6% .01 250/.6);padding:10px;color:var(--peek-ink,oklch(94% .012 90));
font-family:var(--peek-body,"Noto Sans TC","Microsoft JhengHei",sans-serif)}
.card-peek[data-show="true"]{opacity:1;transform:none}
.card-peek[data-side="right"]{transform-origin:left center;transform:translateX(-10px) scale(.92)}
.card-peek[data-side="left"]{transform-origin:right center;transform:translateX(10px) scale(.92)}
.card-peek[data-side="above"]{transform-origin:center bottom;transform:translateY(10px) scale(.92)}
.card-peek[data-side="right"][data-show="true"],.card-peek[data-side="left"][data-show="true"],.card-peek[data-side="above"][data-show="true"]{transform:none}
.card-peek.is-gliding{transition:opacity var(--dur-micro,120ms) var(--ease-out,cubic-bezier(.16,1,.3,1)),transform var(--dur-short,220ms) var(--ease-out,cubic-bezier(.16,1,.3,1)),left var(--dur-short,220ms) var(--ease-out,cubic-bezier(.16,1,.3,1)),top var(--dur-short,220ms) var(--ease-out,cubic-bezier(.16,1,.3,1))}
@media (prefers-reduced-motion:reduce){.card-peek,.card-peek.is-gliding{transition:none}}
.card-peek-face{position:relative;display:grid;grid-template-columns:22% minmax(0,1fr);aspect-ratio:480/702;border-radius:10px;overflow:hidden;
background:oklch(93.5% .024 86);color:oklch(24% .02 50);box-shadow:0 1px 0 oklch(99% .012 85/.35) inset}
.card-peek-spine{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0;border-right:1px solid oklch(82% .03 80)}
.card-peek-suit{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--peek-suit,oklch(72% .07 250));
font-weight:800;font-size:16px;line-height:1;font-family:var(--peek-display,"Chiron Hei HK","Noto Serif TC",sans-serif)}
.card-peek-name{writing-mode:vertical-rl;text-orientation:upright;font-weight:800;font-size:22px;line-height:1;letter-spacing:.04em;
font-family:var(--peek-display,"Chiron Hei HK","Noto Serif TC",sans-serif);overflow:hidden;white-space:nowrap;min-height:0;flex:1}
.card-peek-name[data-len="5"],.card-peek-name[data-len="6"]{font-size:17px}.card-peek-name[data-len="7"],.card-peek-name[data-len="8"]{font-size:14px}
.card-peek-seal{margin-top:auto;display:grid;place-items:center;width:26px;height:26px;border:1.5px solid var(--peek-suit,oklch(72% .07 250));
border-radius:3px;background:color-mix(in oklch,var(--peek-suit,oklch(72% .07 250)) 22%,oklch(93.5% .024 86));font-weight:800;font-size:15px;line-height:1;
font-family:var(--peek-display,"Chiron Hei HK","Noto Serif TC",sans-serif)}
.card-peek-rate{font-size:11px;font-weight:800;padding:2px 4px;border-radius:3px;line-height:1}
.card-peek-rate[data-r="sensitive"]{background:oklch(80% .13 80)}.card-peek-rate[data-r="explicit"]{background:oklch(46% .16 31);color:oklch(97% .012 80)}
.card-peek-art{position:relative;overflow:hidden;background:oklch(88.5% .028 84)}
.card-peek-art img{width:100%;height:100%;object-fit:cover;object-position:50% 22%;display:block}
.card-peek-glyph{position:absolute;inset:0;display:grid;place-items:center;font-size:84px;font-weight:800;color:oklch(46% .022 60);
font-family:var(--peek-display,"Chiron Hei HK","Noto Serif TC",sans-serif)}
.card-peek-en{margin:8px 2px 0;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:var(--peek-muted,oklch(72% .014 240));
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-peek-facts{margin:4px 2px 0;font-size:12px;line-height:1.55;color:var(--peek-ink2,oklch(83% .012 240))}
.card-peek-facts b{font-weight:500;color:var(--peek-muted,oklch(66% .014 240));margin-right:6px}
@media (prefers-reduced-motion: reduce){.card-peek{transform:none;transition:opacity 120ms linear}}
`;

let peek = null;
let current = null;
const FINE = typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;

function ensure() {
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.append(s);
  }
  if (!peek) {
    peek = document.createElement("div");
    peek.className = "card-peek";
    peek.id = "card-peek";
    peek.setAttribute("role", "tooltip");
    peek.setAttribute("aria-hidden", "true");
    document.body.append(peek);
  }
  return peek;
}

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function render(info) {
  const p = ensure();
  const face = h("div", "card-peek-face");
  const spine = h("div", "card-peek-spine");
  const suit = h("span", "card-peek-suit", info.glyph || "");
  if (info.suitColor) suit.style.setProperty("--peek-suit", info.suitColor);
  const name = h("span", "card-peek-name", info.zh);
  name.dataset.len = String(Math.min([...(info.zh || "")].length, 8));
  spine.append(suit, name);
  if (info.rating && info.rating !== "general") {
    const r = h("span", "card-peek-rate", info.rating === "explicit" ? "色" : "敏");
    r.dataset.r = info.rating;
    spine.append(r);
  }
  if (info.seal) {
    const seal = h("span", "card-peek-seal", info.seal);
    if (info.suitColor) seal.style.setProperty("--peek-suit", info.suitColor);
    if (info.sealTitle) seal.title = info.sealTitle;
    spine.append(seal);
  }
  const art = h("div", "card-peek-art");
  if (info.art) {
    const img = h("img");
    img.alt = "";
    img.decoding = "async";
    img.src = info.art;
    img.addEventListener("error", () => img.remove(), { once: true });
    art.append(img);
  } else {
    art.append(h("span", "card-peek-glyph", [...(info.zh || "字")][0]));
  }
  face.append(spine, art);
  const nodes = [face, h("p", "card-peek-en", info.tag)];
  if (info.facts && info.facts.length) {
    const facts = h("div", "card-peek-facts");
    for (const [k, v] of info.facts) {
      const line = h("div");
      line.append(h("b", "", k), document.createTextNode(v));
      facts.append(line);
    }
    nodes.push(facts);
  }
  p.replaceChildren(...nodes);
}

function place(anchor) {
  const p = ensure();
  const r = anchor.getBoundingClientRect();
  const w = p.offsetWidth || 248;
  const hgt = p.offsetHeight || 420;
  // 視窗底部一整排的牌（偏好卡牌托盤）：放大卡開在牌的正上方，不要蓋住隔壁幾張。
  if (anchor.closest("[data-peek='above']") && r.top - hgt - 14 >= 8) {
    p.dataset.side = "above";
    p.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))) + "px";
    p.style.top = Math.round(r.top - hgt - 14) + "px";
    return;
  }
  let left = r.right + 12;
  let side = "right";
  if (left + w > window.innerWidth - 8) {
    left = r.left - w - 12;
    side = "left";
  }
  if (left < 8) {
    left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    side = "";
  }
  // 放大卡從它指著的那張牌那一側長出來（在牌右邊就從左緣長出來），不是一律從下面浮上來。
  if (side) p.dataset.side = side;
  else delete p.dataset.side;
  let top = r.top + r.height / 2 - hgt / 2;
  top = Math.max(8, Math.min(window.innerHeight - hgt - 8, top));
  p.style.left = Math.round(left) + "px";
  p.style.top = Math.round(top) + "px";
}

export function showPeek(anchor, info) {
  if (!anchor || !info || document.body.dataset.dragging === "true") return;
  clearTimeout(intentTimer);
  clearTimeout(hideTimer);
  const wasShown = !!peek && peek.dataset.show === "true";
  if (current && current !== anchor && current.getAttribute("aria-describedby") === "card-peek") current.removeAttribute("aria-describedby");
  current = anchor;
  render(info);
  // 畫面上浮出的附帶規則、分級這些，螢幕閱讀器也要讀得到：開著時掛成那張牌的描述。
  peek.setAttribute("aria-hidden", "false");
  if (!anchor.hasAttribute("aria-describedby")) anchor.setAttribute("aria-describedby", "card-peek");
  // 已經開著、換到隔壁那張：放大卡滑過去，不是瞬間跳到新位置。
  peek.classList.toggle("is-gliding", wasShown);
  place(anchor);
  peek.dataset.show = "true";
  pendingEl = null;
  shownAt = anchor.getBoundingClientRect();
  // 觸控（長按放開叫出來的）：沒有滑鼠移開這回事，下一次點到任何地方就收。
  // 晚一格才掛，不然叫出它的那次放開／點擊會馬上把它收掉。
  if (!FINE) {
    clearTimeout(touchArm);
    document.removeEventListener("pointerdown", touchDismiss, true);
    touchArm = setTimeout(() => document.addEventListener("pointerdown", touchDismiss, true), 0);
  }
}

let touchArm = 0;
function touchDismiss() {
  document.removeEventListener("pointerdown", touchDismiss, true);
  hidePeek();
}

// 滑鼠停一下（120ms）才浮出放大卡：只是掃過字盒不要一路閃。已經開著的換牌不等。
let intentTimer = 0;
const INTENT_MS = 120;
// 離開一張牌不馬上收：牌跟牌之間有縫，滑到隔壁那張的路上會先「離開」—— 等 80ms，
// 到了隔壁就接著滑過去，真的離開了才收。
let hideTimer = 0;
const LEAVE_MS = 80;
// 正在等 INTENT_MS 的那張：在同一張牌上移來移去（插畫、書脊、字名是不同的子元素）不重新計時 ——
// 以前每跨過一個子元素就重數 120ms，慢慢移的時候放大卡一直出不來。
let pendingEl = null;
// 按過的那張：按下去收起放大卡，滑鼠沒離開那張之前不再自己冒出來。
let pressedEl = null;
// 放大卡開出來時那張牌在哪：頁面上任何一塊捲動都會收到 scroll，只有那張牌真的被捲走了才收。
let shownAt = null;
let lastX = -1;
let lastY = -1;

export function hidePeek(anchor) {
  if (anchor && current && anchor !== current) return;
  clearTimeout(intentTimer);
  pendingEl = null;
  shownAt = null;
  if (current?.getAttribute("aria-describedby") === "card-peek") current.removeAttribute("aria-describedby");
  current = null;
  if (peek) {
    peek.dataset.show = "false";
    peek.setAttribute("aria-hidden", "true");
  }
}

/** 事件委派：root 底下符合 selector 的元素，滑鼠一移上去就浮出放大卡。 */
export function attachPeek(root, selector, getInfo) {
  if (!root) return;
  if (FINE) {
    // 用 pointermove，不只 pointerover：牌在滑鼠底下被重畫（換成新的節點）、放大卡被捲動或按下收掉之後，
    // 滑鼠只要動一下就接得回來，不必先移出去再移進來。
    const track = (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      lastX = e.clientX;
      lastY = e.clientY;
      const el = e.target.closest(selector);
      if (!el || !root.contains(el)) return;
      if (el === pressedEl) return;
      if (el === current) {
        clearTimeout(hideTimer);
        return;
      }
      if (peek && peek.dataset.show === "true") {
        clearTimeout(hideTimer);
        showPeek(el, getInfo(el));
        return;
      }
      if (el === pendingEl) return;
      pendingEl = el;
      clearTimeout(intentTimer);
      intentTimer = setTimeout(() => {
        pendingEl = null;
        // 看滑鼠「現在」指著哪一張：等的這 120ms 裡牌可能被重畫過，原本那個節點已經不在了。
        const hit = document.elementFromPoint(lastX, lastY)?.closest(selector);
        if (hit && root.contains(hit) && hit !== pressedEl) showPeek(hit, getInfo(hit));
      }, INTENT_MS);
    };
    root.addEventListener("pointerover", track);
    root.addEventListener("pointermove", track, { passive: true });
    root.addEventListener("pointerout", (e) => {
      const el = e.target.closest(selector);
      if (!el) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      if (el === pressedEl) pressedEl = null;
      if (el === pendingEl) {
        pendingEl = null;
        clearTimeout(intentTimer);
      }
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hidePeek(el), LEAVE_MS);
    });
    root.addEventListener("pointerdown", (e) => {
      pressedEl = e.target.closest?.(selector) || null;
      hidePeek();
    });
  }
  root.addEventListener("focusin", (e) => {
    const el = e.target.closest(selector);
    if (el && el.matches(":focus-visible")) showPeek(el, getInfo(el));
  });
  root.addEventListener("focusout", (e) => {
    const el = e.target.closest(selector);
    if (el) hidePeek(el);
  });
  if (!scrollWired) {
    scrollWired = true;
    window.addEventListener(
      "scroll",
      () => {
        // 還沒開出來的不管：等到時間到，看的是那時滑鼠底下是哪一張。
        if (!current) return;
        if (!shownAt) return hidePeek();
        const r = current.getBoundingClientRect();
        if (!current.isConnected || Math.abs(r.top - shownAt.top) > 2 || Math.abs(r.left - shownAt.left) > 2) hidePeek();
      },
      { passive: true, capture: true }
    );
  }
}

let scrollWired = false;
