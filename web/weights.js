/**
 * 牌的份量（權重）：你放進合成池／卡池的牌可以調強調淡，送出去寫成 (black hair:1.2)。
 *
 * 五段：0.7・0.9・1.0・1.2・1.4。超過 1.4 Illustrious／SDXL 容易畫崩，低於 0.7 幾乎等於沒放。
 * 一位小數：送給 ComfyUI 前 engine.js 的 escapeForComfy 會把權重四捨五入到一位，
 * 0.85 實際送出的是 0.9 —— 畫面上的數字要跟實際送出的一樣。
 * 只改提示詞裡的份量，不碰抽牌：互斥、分級、禁用照舊。
 *
 * 顯示：牌面右下角一個小數字（1.0 不顯示），大於 1 暖色、小於 1 灰藍。
 */
import { parseWeighted, formatWeighted } from "./engine.js";
import { reducedMotion, DUR, CURVE, css } from "./motion.js";

export const WEIGHTS = [0.7, 0.9, 1, 1.2, 1.4];

/**
 * 最接近的那一檔（貼上的 1.15、舊資料的 0.85 都對到五段之一）。
 * 剛好在兩檔中間：不選 1.0（(tag) 是 1.1，本意是加強，不能被吃掉）；兩邊都不是 1.0 就選溫和的
 * （0.8 → 0.9、1.3 → 1.2）。
 */
export function snapWeight(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return 1;
  let best = 1;
  let bd = Math.abs(1 - n);
  for (const x of WEIGHTS) {
    if (x === 1) continue;
    const d = Math.abs(x - n);
    const tie = Math.abs(d - bd) < 1e-9;
    if (d < bd - 1e-9 || (tie && (best === 1 || Math.abs(x - 1) < Math.abs(best - 1)))) {
      best = x;
      bd = d;
    }
  }
  return best;
}

/** 往上（dir = 1）或往下（-1）一檔，到頂就停。 */
export function stepWeight(w, dir) {
  const i = WEIGHTS.indexOf(snapWeight(w));
  return WEIGHTS[Math.max(0, Math.min(WEIGHTS.length - 1, i + dir))];
}

export const weightText = (w) => (w === 1 ? "1.0" : String(w));

/** 提示詞裡有調過份量的牌寫成 (tag:w)；本來就帶權重的、沒調的照原樣。 */
export function weightPositive(positive, weights) {
  if (!weights || !Object.keys(weights).length) return positive;
  return String(positive || "")
    .split(",")
    .map((part) => {
      const { tag, weight } = parseWeighted(part);
      const w = weights[tag];
      return w && w !== 1 && weight === 1 ? formatWeighted(tag, w) : part.trim();
    })
    .filter(Boolean)
    .join(", ");
}

/** 從提示詞讀回每張牌的份量（作品冊帶回墨池、舊成品）：只留五段之一、不是 1 的。 */
export function weightsOfPositive(positive) {
  const out = {};
  for (const part of String(positive || "").split(",")) {
    const { tag, weight } = parseWeighted(part);
    if (tag && weight !== 1) out[tag] = snapWeight(weight);
  }
  for (const t of Object.keys(out)) if (out[t] === 1) delete out[t];
  return out;
}

/**
 * 牌面右下角的數字。pop：剛調過，數字跳一下。
 * 牌本身也帶 data-w：加強的邊框深一點、淡化的透明一點（card.css），眼角餘光分得出來。
 */
export function paintWeight(node, w, { pop = false } = {}) {
  if (!node) return;
  const art = node.querySelector(".card-art") || node;
  let badge = art.querySelector(":scope > .card-w");
  if (!w || w === 1) {
    delete node.dataset.w;
    badge?.remove();
    return;
  }
  node.dataset.w = w > 1 ? "up" : "down";
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "card-w";
    art.append(badge);
  }
  badge.textContent = weightText(w);
  badge.setAttribute("aria-label", `份量 ${weightText(w)}`);
  if (pop && !reducedMotion()) {
    badge.animate([{ transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: DUR.medium, easing: css(CURVE.settle) });
  }
}

/**
 * 電腦上滑鼠停在牌上滾滾輪：一格一檔。
 * 只是捲頁面時剛好經過不算：要停在牌上 250ms 以上、頁面 300ms 內沒在捲；
 * 觸控板一甩只動一檔（同一張牌 160ms 內只收一次）。
 */
let scrolledAt = 0;
addEventListener("scroll", () => (scrolledAt = performance.now()), { passive: true, capture: true });

export function wireWeightInput(node, { get, set }) {
  let hoverAt = 0;
  let wheelAt = 0;
  node.addEventListener("pointerenter", () => (hoverAt = performance.now()));
  node.addEventListener(
    "wheel",
    (e) => {
      const now = performance.now();
      if (now - hoverAt < 250 || now - scrolledAt < 300 || !e.deltaY) return;
      e.preventDefault();
      if (now - wheelAt < 160) return;
      wheelAt = now;
      set(stepWeight(get(), e.deltaY < 0 ? 1 : -1));
    },
    { passive: false }
  );
  node.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") set(stepWeight(get(), 1));
    else if (e.key === "-" || e.key === "_") set(stepWeight(get(), -1));
    else if (e.key === "0") set(1);
    else return;
    e.preventDefault();
  });
}

/** 詳情裡的「份量」一排：五個數字，按了就換。回傳那一排，onPick(w) 由呼叫的人處理。 */
export function weightRow(current, onPick, el) {
  const row = el(
    "div",
    { class: "weight-row" },
    el("span", { class: "weight-label", "aria-hidden": "true" }, "份量"),
    el(
      "div",
      { class: "segmented weight-seg", role: "radiogroup", "aria-label": "份量" },
      WEIGHTS.map((w) =>
        el(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": w === current ? "true" : "false",
            dataset: { v: String(w), dir: w > 1 ? "up" : w < 1 ? "down" : "" },
            onclick: (e) => {
              for (const b of row.querySelectorAll("button")) b.setAttribute("aria-checked", b === e.currentTarget ? "true" : "false");
              onPick(w);
            },
          },
          weightText(w)
        )
      )
    )
  );
  return row;
}
