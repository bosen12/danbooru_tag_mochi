/**
 * 拖曳：卡牌拖進合成池、拖進廢字簍、從池裡拖回字盒。
 *
 * 用 pointer events 自己做，不用 HTML5 drag-and-drop —— 後者在手機上不能用，
 * 拖著走的那張也沒辦法自己畫。規則：
 *   滑鼠：按下後移動超過 5px 才算拖，沒移動就是點一下。
 *   觸控：長按 280ms 才開始拖；在那之前手指一動就讓給捲動（字盒要能滑）。
 *         長按的那段時間牌會慢慢往下壓，看得出「再按一下就拿起來了」。
 *         長按到拿起來之後原地放開（沒拖走）＝看這張牌的詳情（onHold）。手機上沒有滑鼠懸停、
 *         iPhone 長按也不送 contextmenu，這是觸控唯一看得到詳情的地方。
 *   拖曳中按 Esc 取消。拖完之後緊接著的那個 click 會被吃掉，不會又當成點一下。
 *
 * 手感：
 *   拿起 —— 牌從原位浮起、放大一點、陰影變深；原位留一個虛線的空位。
 *   拖著 —— 牌照左右甩的速度傾斜，停下來就回正；移到收得下的地方會再放大一點、描一圈亮邊，
 *           移到「吞掉」的地方（廢字簍）會縮小、褪色。
 *   放下 —— 影子飛到目的地那張牌的位置落下去（頁面在 onDrop 回傳落點），落地壓一下、
 *           從落點散開一圈花色的墨；丟進廢字簍的縮小轉進去。
 *   放錯地方或按 Esc —— 牌彈回原位，不是憑空消失。
 * 流程從不等動畫：清掉影子、還原原位都用 setTimeout 排，分頁在背景時 animation.finished
 * 可能永遠不 resolve。減量動態時全部直接到位。
 */

import { getSfx } from "./sfx.js";
import { CURVE, DUR, css } from "./motion.js";

const MOUSE_SLOP = 5;
const TOUCH_HOLD = 280;
const TOUCH_SLOP = 8;
// 落下、彈回、被吸進廢字簍：用兩個房間共用的動態詞彙（motion.js）。長按 TOUCH_HOLD 跟 CSS 的壓下綁在一起，不動。
// 親手拖過來放下的那一下要看得到它「落進去」：short（220ms）像瞬移，medium（320ms）專案主試過還是偏快。
// 專案主定在 480ms：long（420）和 xl（540）的正中間，看得到弧線、放大、落定三段，又不會讓人等。
const LAND_MS = (DUR.long + DUR.xl) / 2;
const HOME_MS = DUR.medium;
const SINK_MS = DUR.short;
const BASE_TILT = -2;

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const buzz = (ms) => {
  try {
    // 頁面還沒被點過（長按的第一下還算不上），Chrome 會擋掉震動並在主控台報錯：那時候就不震。
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* 不支援就算了 */
  }
};

/**
 * zones: () => [{ id, el, accepts(payload), sink? }]   sink：丟進去就「吞掉」（廢字簍），影子縮小轉進去
 * onDrop(payload, zoneId, { x, y }) → 落點（x, y：放開那一刻的指標位置）：
 *   Element                 影子飛到這張牌的位置落下（頁面已經把它畫好了）
 *   { el, landed() }        同上，落地那一刻再呼叫 landed()（放聲音、震動）
 *   false                   這個區域這次收不下（例如手牌滿了）：影子彈回原位，跟放錯地方一樣
 *   null／undefined          沒有落點：影子原地淡出（sink 的區域照樣轉進去）
 * onOver(zoneId|null, payload)  拖著經過的區域換了（離開所有區域時給 null）
 * onMove(zoneId|null, payload, x, y)  拖著每動一下（托盤拿來即時空出插入的位置）
 * onHold(payload, node)  觸控長按拿起來、手指沒離開原地就放開：牌彈回原位，頁面開詳情
 */
/** 牌落定的地方散開一圈墨（顏色是那張牌的花色）。點一下放牌、拖曳放下都用這個。 */
export function inkRing(target) {
  if (reduced() || !target || !target.isConnected) return;
  const r = target.getBoundingClientRect();
  if (!r.width) return;
  const ring = document.createElement("span");
  ring.className = "land-ring";
  ring.setAttribute("aria-hidden", "true");
  const suit = getComputedStyle(target).getPropertyValue("--suit").trim();
  if (suit) ring.style.setProperty("--ring", suit);
  const d = Math.max(r.width, r.height) * 1.1;
  Object.assign(ring.style, { left: `${r.left + r.width / 2 - d / 2}px`, top: `${r.top + r.height / 2 - d / 2}px`, width: `${d}px`, height: `${d}px` });
  document.body.append(ring);
  setTimeout(() => ring.remove(), 560);
}

export function createDrag({ zones, onDrop, onOver, onMove, onHold }) {
  let active = null;

  // 長按開始拖之後，手指一動瀏覽器就會想捲動頁面（然後送 pointercancel 把拖曳砍掉）。
  // 拖曳中攔下 touchmove，捲動就不會開始。
  document.addEventListener(
    "touchmove",
    (e) => {
      if (active && active.dragging) e.preventDefault();
    },
    { passive: false }
  );

  function zoneAt(x, y, payload) {
    for (const z of zones()) {
      if (!z.el || !z.el.isConnected || !z.accepts(payload)) continue;
      const r = z.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
    }
    return null;
  }

  function markZones(payload, over) {
    for (const z of zones()) {
      if (!z.el) continue;
      const ok = z.accepts(payload);
      z.el.dataset.droppable = ok ? "true" : "false";
      z.el.dataset.over = over && over.id === z.id ? "true" : "false";
      if (z.id === "trash") z.el.dataset.armed = ok ? "true" : "false";
    }
  }

  function clearZones() {
    for (const z of zones()) {
      if (!z.el) continue;
      delete z.el.dataset.droppable;
      delete z.el.dataset.over;
      delete z.el.dataset.armed;
    }
  }

  function begin(state, x, y) {
    state.node.classList.remove("is-pressing");
    const r = state.node.getBoundingClientRect();
    const card = state.node.cloneNode(true);
    card.removeAttribute("id");
    card.classList.remove("is-pressing", "is-stamped", "is-carried", "is-clashing", "is-landed", "dropped");
    card.style.width = r.width + "px";
    card.style.setProperty("--card-w", r.width + "px");
    card.style.fontSize = getComputedStyle(state.node).fontSize;
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.append(card);
    document.body.append(ghost);
    state.ghost = ghost;
    state.card = card;
    state.w = r.width;
    state.home = r;
    state.dx = x - r.left;
    state.dy = y - r.top;
    state.lx = x;
    state.lt = performance.now();
    state.vx = 0;
    state.dragging = true;
    state.node.dataset.dragging = "true";
    document.body.dataset.dragging = "true";
    getSfx().pick();
    move(state, x, y);
    // 下一個 task 再加上「浮起」：先讓影子在原位畫出來，放大、陰影才有過渡。
    if (!reduced()) setTimeout(() => ghost.classList.add("is-lifted"), 0);
    else ghost.classList.add("is-lifted");
  }

  function move(state, x, y) {
    state.px = x;
    state.py = y;
    if (!reduced()) {
      // 左右甩的速度 → 傾斜。平滑一下，停下來 90ms 就回正。
      const now = performance.now();
      const dt = Math.max(8, now - state.lt);
      state.vx = state.vx * 0.6 + ((x - state.lx) / dt) * 0.4;
      state.lx = x;
      state.lt = now;
      const tilt = Math.max(-14, Math.min(14, BASE_TILT + state.vx * 18));
      state.paintTilt = `${tilt.toFixed(1)}deg`;
      clearTimeout(state.settle);
      state.settle = setTimeout(() => {
        state.paintTilt = `${BASE_TILT}deg`;
        if (state.card) state.card.style.setProperty("--g-tilt", state.paintTilt);
      }, 90);
    }
    const over = zoneAt(x, y, state.payload);
    // 區域的標記只在換區域時寫（以前每動一下就把每個區域的 data-* 重寫一次，每一格都要重算樣式）。
    if ((over && over.id) !== (state.over && state.over.id) || !state.marked) {
      state.over = over;
      state.marked = true;
      state.ghost.dataset.over = over ? (over.sink ? "sink" : "valid") : "";
      if (over && state.touch) buzz(6);
      if (onOver) onOver(over ? over.id : null, state.payload);
      markZones(state.payload, state.over);
    }
    if (onMove) onMove(state.over ? state.over.id : null, state.payload, x, y);
    // 速度與區域回報仍逐次處理；同一格只把最新的位置、傾斜畫一次。
    // 先讀投放區再寫影子，避免 pointermove 裡重複寫樣式後立刻量版面。
    if (!state.moveRaf) state.moveRaf = requestAnimationFrame(() => {
      state.moveRaf = 0;
      if (active === state && state.dragging) paintMove(state);
    });
    edgeScroll(state);
  }

  function paintMove(state) {
    cancelAnimationFrame(state.moveRaf);
    state.moveRaf = 0;
    const transform = `translate3d(${state.px - state.dx}px, ${state.py - state.dy}px, 0)`;
    if (state.ghost.style.transform !== transform) state.ghost.style.transform = transform;
    if (state.paintTilt !== undefined) state.card.style.setProperty("--g-tilt", state.paintTilt);
  }

  /*
   * 拖到邊緣自己捲：字盒捲下去之後，牌要拖回上面的合成池／卡池，不用放手、捲上去、再拖一次。
   * 先看指標底下有沒有自己會捲的框（字盒、卡池），靠近它的上下緣就捲它；不然靠近視窗上下緣就捲整頁。
   * 越靠邊捲越快（平方，剛碰到邊緣時很慢，不會一拖過去就飛走）。
   */
  const EDGE = 64;
  const EDGE_MAX = 22;
  function scrollerAt(x, y) {
    for (const e of document.elementsFromPoint(x, y)) {
      if (e.closest(".drag-ghost")) continue;
      for (let n = e; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n;
      }
      return null;
    }
    return null;
  }
  function edgeSpeed(depth) {
    const k = Math.max(0, Math.min(1, depth / EDGE));
    return k ? Math.max(1, Math.round(k * k * EDGE_MAX)) : 0;
  }
  function edgeStep(state) {
    const { px: x, py: y } = state;
    const now = performance.now();
    // 找框要量樣式：同一個位置附近 150ms 內沿用上一次找到的。
    if (!state.scrollerAt || now - state.scrollerAt > 150) {
      state.scroller = scrollerAt(x, y);
      state.scrollerAt = now;
    }
    const s = state.scroller;
    if (s) {
      const r = s.getBoundingClientRect();
      const up = y < r.top + EDGE && s.scrollTop > 0 ? -edgeSpeed(r.top + EDGE - y) : 0;
      const down = y > r.bottom - EDGE && s.scrollTop + s.clientHeight < s.scrollHeight - 1 ? edgeSpeed(y - (r.bottom - EDGE)) : 0;
      if (up || down) {
        s.scrollTop += up || down;
        return true;
      }
    }
    const doc = document.scrollingElement || document.documentElement;
    const up = y < EDGE && doc.scrollTop > 0 ? -edgeSpeed(EDGE - y) : 0;
    const down = y > innerHeight - EDGE && doc.scrollTop + innerHeight < doc.scrollHeight - 1 ? edgeSpeed(y - (innerHeight - EDGE)) : 0;
    if (up || down) {
      window.scrollBy(0, up || down);
      return true;
    }
    return false;
  }
  function edgeScroll(state) {
    if (state.edgeRaf) return;
    state.edgeRaf = requestAnimationFrame(() => {
      state.edgeRaf = 0;
      if (!state.dragging || active !== state) return;
      if (!edgeStep(state)) return;
      // 捲動之後指標底下換了東西：重新認一次區域（位置沒變，不算甩動）。move 會排下一格。
      state.lx = state.px;
      move(state, state.px, state.py);
      // 自動捲動已在 rAF 裡：沿用原本這一格的回正時機，不多延後一格。
      paintMove(state);
    });
  }

  /** 影子現在畫在哪（含放大、傾斜之前的那張牌的位置）。 */
  function ghostRect(state) {
    const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(state.ghost.style.transform || "");
    const x = m ? parseFloat(m[1]) : state.home.left;
    const y = m ? parseFloat(m[2]) : state.home.top;
    return { x, y };
  }

  function flyGhost(state, keyframes, ms, easing, after) {
    const g = state.ghost;
    g.classList.remove("is-lifted");
    g.classList.add("is-leaving");
    g.dataset.over = "";
    state.card.style.setProperty("--g-tilt", "0deg");
    g.animate(keyframes, { duration: ms, easing, fill: "forwards" });
    setTimeout(() => {
      g.remove();
      after && after();
    }, ms + 20);
  }

  /** 放下：飛到落點、落地壓一下、散一圈墨。 */
  function land(state, zone, result) {
    const target = result && (result.nodeType === 1 ? result : result.el);
    const landed = result && result.nodeType !== 1 && typeof result.landed === "function" ? result.landed : null;
    const from = ghostRect(state);
    const quick = reduced();
    if (zone.sink) {
      const r = zone.el.getBoundingClientRect();
      if (quick || !r.width) {
        state.ghost.remove();
      } else {
        const tx = r.left + r.width / 2 - state.w / 2;
        const ty = r.top + r.height / 2 - (state.w * 1.4625) / 2;
        flyGhost(
          state,
          [
            { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(1) rotate(0deg)`, opacity: 1 },
            { transform: `translate3d(${tx}px, ${ty}px, 0) scale(0.18) rotate(160deg)`, opacity: 0.2 },
          ],
          SINK_MS,
          css(CURVE.exit),
          () => landed && landed()
        );
        return;
      }
      landed && landed();
      return;
    }
    if (!target || !target.isConnected) {
      if (quick) state.ghost.remove();
      else
        flyGhost(
          state,
          [
            { transform: `translate3d(${from.x}px, ${from.y}px, 0)`, opacity: 1 },
            { transform: `translate3d(${from.x}px, ${from.y - 10}px, 0) scale(0.92)`, opacity: 0 },
          ],
          180,
          "ease-out"
        );
      landed && landed();
      return;
    }
    // 目的地可能正在讓位滑動（卡池整塊重畫的 FLIP）：先讓它到位再量，不然影子會落在它滑動的起點。
    // 它接著就會被藏起來等影子落下，跳到終點看不出來。
    // 它所在的那一列也可能正在進場（空白的版第一次放牌，列從下面浮上來）：一路到落點區為止都先到位。
    for (let e = target; e && e !== zone.el.parentElement; e = e.parentElement) for (const a of e.getAnimations()) a.finish();
    const to = target.getBoundingClientRect();
    if (quick || !to.width) {
      state.ghost.remove();
      landed && landed();
      stampLanded(target, quick);
      return;
    }
    // 目的地那張先藏起來，影子落到它身上再換回來 —— 不然會看到兩張。
    target.style.visibility = "hidden";
    const s = to.width / state.w;
    flyGhost(
      state,
      [
        { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(1)` },
        {
          transform: `translate3d(${(from.x + to.left) / 2}px, ${Math.min(from.y, to.top) - 18}px, 0) scale(${(1 + s) / 2 + 0.06})`,
          offset: 0.55,
        },
        { transform: `translate3d(${to.left}px, ${to.top}px, 0) scale(${s})` },
      ],
      LAND_MS,
      css(CURVE.out),
      () => {
        target.style.visibility = "";
        stampLanded(target, false);
        if (state.touch) buzz(10);
        landed && landed();
      }
    );
  }

  /** 牌落定：壓一下、散一圈牌自己花色的墨。 */
  function stampLanded(target, quick) {
    target.classList.remove("dropped", "is-landed");
    if (quick) return;
    void target.offsetWidth;
    target.classList.add("is-landed");
    setTimeout(() => target.classList.remove("is-landed"), 420);
    inkRing(target);
  }

  /** 放錯地方、按 Esc：彈回原位，原位那張再亮回來。 */
  function goHome(state) {
    const node = state.node;
    const done = () => {
      delete node.dataset.dragging;
      if (!reduced()) {
        node.classList.remove("is-home");
        void node.offsetWidth;
        node.classList.add("is-home");
        setTimeout(() => node.classList.remove("is-home"), 320);
      }
    };
    const home = node.isConnected ? node.getBoundingClientRect() : null;
    if (reduced() || !home || !home.width) {
      state.ghost.remove();
      done();
      return;
    }
    const from = ghostRect(state);
    flyGhost(
      state,
      [
        { transform: `translate3d(${from.x}px, ${from.y}px, 0)` },
        { transform: `translate3d(${home.left}px, ${home.top}px, 0) scale(${home.width / state.w})` },
      ],
      HOME_MS,
      css(CURVE.settle),
      done
    );
  }

  function end(state, cancelled) {
    clearTimeout(state.hold);
    clearTimeout(state.settle);
    cancelAnimationFrame(state.edgeRaf);
    cancelAnimationFrame(state.moveRaf);
    state.moveRaf = 0;
    state.node.classList.remove("is-pressing");
    window.removeEventListener("pointermove", state.onMove);
    window.removeEventListener("pointerup", state.onUp);
    window.removeEventListener("pointercancel", state.onCancel);
    window.removeEventListener("keydown", state.onKey, true);
    if (state.dragging) {
      // 放開／Esc 可能早於下一格：落地與回彈從最後收到的位置開始。
      paintMove(state);
      document.body.dataset.dragging = "false";
      clearZones();
      if (onOver && state.over) onOver(null, state.payload);
      if (onMove) onMove(null, state.payload, state.px, state.py);
      // 吃掉緊接著的 click
      const eat = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      state.node.addEventListener("click", eat, { capture: true, once: true });
      setTimeout(() => state.node.removeEventListener("click", eat, { capture: true }), 60);
      // 觸控長按拿起來、沒拖走就放開：不是拖曳，是「看這張」。牌彈回原位，頁面開詳情。
      const held = !cancelled && state.touch && onHold && (state.far || 0) < TOUCH_SLOP * 2;
      const zone = !cancelled && !held && state.over ? state.over : null;
      if (held) {
        goHome(state);
        onHold(state.payload, state.node);
      } else if (zone) {
        delete state.node.dataset.dragging;
        let result = null;
        try {
          result = onDrop(state.payload, zone.id, { x: state.px, y: state.py });
        } catch (err) {
          state.ghost.remove();
          throw err;
        }
        if (result === false) goHome(state);
        else land(state, zone, result);
      } else {
        goHome(state);
      }
    }
    active = null;
  }

  function attach(node, payload) {
    node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || active) return;
      const touch = e.pointerType === "touch";
      const state = { node, payload: typeof payload === "function" ? payload() : payload, x0: e.clientX, y0: e.clientY, dragging: false, touch, pointer: e.pointerId };
      active = state;
      // 多點觸控：只認拿起這張牌的那根手指。另一根手指的移動、放開不能拖走或放下這張。
      const mine = (ev) => ev.pointerId === state.pointer;
      state.onMove = (ev) => {
        if (!mine(ev)) return;
        if (state.dragging) {
          ev.preventDefault();
          // 拿起來之後離開原地多遠：沒拖走就放開＝長按看詳情（見 end）。
          if (state.touch) state.far = Math.max(state.far || 0, Math.hypot(ev.clientX - state.x0, ev.clientY - state.y0));
          move(state, ev.clientX, ev.clientY);
          return;
        }
        const dist = Math.hypot(ev.clientX - state.x0, ev.clientY - state.y0);
        if (touch) {
          if (dist > TOUCH_SLOP) end(state, true); // 手指先動了：是捲動，不是拖
        } else if (dist > MOUSE_SLOP) {
          begin(state, ev.clientX, ev.clientY);
        }
      };
      state.onUp = (ev) => mine(ev) && end(state, false);
      state.onCancel = (ev) => mine(ev) && end(state, true);
      state.onKey = (ev) => {
        if (ev.key === "Escape" && state.dragging) {
          ev.stopPropagation();
          end(state, true);
        }
      };
      window.addEventListener("pointermove", state.onMove, { passive: false });
      window.addEventListener("pointerup", state.onUp);
      window.addEventListener("pointercancel", state.onCancel);
      window.addEventListener("keydown", state.onKey, true);
      if (touch) {
        // 長按的這 280ms 牌慢慢往下壓（CSS 的過渡），看得出再按一下就拿起來了。
        if (!reduced()) node.classList.add("is-pressing");
        state.hold = setTimeout(() => {
          if (active !== state) return;
          buzz(12);
          begin(state, state.x0, state.y0);
        }, TOUCH_HOLD);
      }
    });
    // 觸控長按時不要跳出系統選單
    node.addEventListener("contextmenu", (e) => {
      if (active && active.node === node) e.preventDefault();
    });
  }

  return {
    attach,
    get dragging() {
      return !!(active && active.dragging);
    },
  };
}
