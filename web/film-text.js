/**
 * 介紹影片、教學影片共用的字幕動畫（不跟鏡頭轉，畫在 hud 那一層）：
 *   kinetic  中文一個字一個字從下面翻上來（帶一點模糊），英文從左邊拉開；離場往上、淡掉
 *   say      一句話（下方正中）
 *   slam     砸下來的大字：從很大、很糊一下子落定，帶一點回彈
 *   chapter  章節記號：左上角一個很大的空心數字＋名稱，出來一下就走
 * zh 裡用 *…* 包起來的字是重點色。跟其他東西一樣只看時間 t：on(win, update, el) 由呼叫的人提供。
 */
import { EZ, seg, lerp, spring, esc, mk } from "./film-kit.js";
import { english, t } from "./i18n.js";

const ANCHOR = { center: "translate(-50%, -50%)", right: "translate(-100%, -50%)", left: "translate(0, -50%)" };

/** hud：字幕放進哪一層；on：登記「這段時間要更新」的函式（影片時間）。回傳的四個函式都可以用 { on, parent } 蓋掉預設。 */
export function makeText({ hud, on: defaultOn }) {
  function kinetic({ cls, zh, en = "", x, y, align = "left", inAt, outAt, st = 0.03, rule = false, drift = 0, on = defaultOn, parent = hud }) {
    if (english) { zh = (en || t(zh.replace(/\*/g, ""))).replace(/\bMochi\b/g, "Ink Pool"); en = ""; st = Math.min(st, 0.045); }
    const box = mk("div", "k " + cls, parent);
    box.style.left = x + "px";
    box.style.top = y + "px";
    const ruleEl = rule ? mk("span", "rule", box) : null;
    const zhEl = mk("span", "zh", box);
    const chars = [];
    let hl = false;
    for (const c of english ? zh.split(/(\s+)/) : [...zh]) {
      if (english && /^\s+$/.test(c)) { zhEl.append(document.createTextNode(c)); continue; }
      if (c === "*") {
        hl = !hl;
        continue;
      }
      chars.push(mk("span", "ch" + (hl ? " hl" : ""), zhEl, c === " " ? "&nbsp;" : esc(c)));
    }
    const enEl = en ? mk("span", "en", box, esc(en)) : null;
    const anchor = ANCHOR[align] || ANCHOR.left;
    const n = chars.length;
    const end = outAt + n * st * 0.5 + 0.5;
    on([inAt - 0.1, end], (t) => {
      box.style.transform = `${anchor} translateX(${((t - inAt) * drift).toFixed(1)}px)`;
      chars.forEach((c, i) => {
        const pin = EZ.out(seg(t, inAt + i * st, inAt + i * st + 0.5));
        const pout = EZ.exit(seg(t, outAt + i * st * 0.5, outAt + i * st * 0.5 + 0.32));
        const o = pin * (1 - pout);
        c.style.opacity = o.toFixed(3);
        c.style.transform = `translateY(${((1 - pin) * 52 - pout * 34).toFixed(1)}px) rotateX(${((1 - pin) * -55).toFixed(1)}deg)`;
        const b = (1 - pin) * 12 + pout * 10;
        c.style.filter = b > 0.1 ? `blur(${b.toFixed(1)}px)` : "";
      });
      if (enEl) {
        const p = EZ.out(seg(t, inAt + 0.18, inAt + 0.9));
        const q = EZ.exit(seg(t, outAt, outAt + 0.3));
        enEl.style.opacity = (p * (1 - q)).toFixed(3);
        enEl.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`;
        enEl.style.transform = `translateX(${((1 - p) * -24).toFixed(1)}px)`;
      }
      if (ruleEl) {
        const p = EZ.out(seg(t, inAt, inAt + 0.6));
        const q = EZ.exit(seg(t, outAt, outAt + 0.3));
        ruleEl.style.transform = `scaleX(${(p * (1 - q)).toFixed(3)})`;
      }
    }, box);
    return box;
  }

  /** 一句話（重點用 *…*）：預設在畫面下方正中。 */
  const say = (zh, en, inAt, outAt, o = {}) => kinetic({ cls: "k-say", zh, en, x: 960, y: 952, align: "center", inAt, outAt, st: 0.022, ...o });

  function slam({ zh, en = "", sub = "", x = 960, y = 500, inAt, outAt, align = "center", cls = "", on = defaultOn, parent = hud }) {
    if (english) { zh = en || t(zh.replace(/\*/g, "")); en = ""; sub = t(sub.replace(/\*/g, "")); }
    const box = mk("div", "k k-slam " + cls, parent);
    box.style.left = x + "px";
    box.style.top = y + "px";
    const zhEl = mk("span", "zh", box, esc(zh));
    const enEl = en ? mk("span", "en", box, esc(en)) : null;
    const subEl = sub ? mk("span", "sub", box) : null;
    if (subEl) {
      let hl = false;
      subEl.innerHTML = [...sub].map((c) => (c === "*" ? ((hl = !hl), hl ? "<b>" : "</b>") : esc(c))).join("");
    }
    const anchor = ANCHOR[align] || ANCHOR.center;
    on([inAt - 0.05, outAt + 0.5], (t) => {
      const p = seg(t, inAt, inAt + 0.26);
      const e = EZ.out(p);
      const q = EZ.in(seg(t, outAt, outAt + 0.32));
      const s = lerp(2.4, 1, e) * (1 + q * 0.35) + spring(t - inAt - 0.26, 0.025, 8, 24);
      box.style.opacity = (Math.min(1, p * 4) * (1 - q)).toFixed(3);
      box.style.transform = `${anchor} scale(${s.toFixed(4)})`;
      const b = (1 - e) * 16 + q * 14;
      zhEl.style.filter = b > 0.1 ? `blur(${b.toFixed(1)}px)` : "";
      if (enEl) {
        const pe = EZ.out(seg(t, inAt + 0.15, inAt + 0.8));
        enEl.style.opacity = pe.toFixed(3);
        enEl.style.letterSpacing = `${lerp(1.1, 0.5, pe).toFixed(3)}em`;
      }
      if (subEl) {
        const ps = EZ.out(seg(t, inAt + 0.35, inAt + 0.95));
        subEl.style.opacity = ps.toFixed(3);
        subEl.style.transform = `translateY(${((1 - ps) * 16).toFixed(1)}px)`;
      }
    }, box);
    return box;
  }

  function chapter(num, zh, en, inAt, outAt, { on = defaultOn, parent = hud } = {}) {
    if (english) { zh = en || t(zh); en = ""; }
    const box = mk("div", "k k-chap", parent, `<b>${esc(num)}</b><span>${esc(zh)}<small>${esc(en)}</small></span>`);
    box.style.left = "96px";
    box.style.top = "118px";
    on([inAt - 0.1, outAt + 0.5], (t) => {
      const p = EZ.out(seg(t, inAt, inAt + 0.6));
      const q = EZ.exit(seg(t, outAt, outAt + 0.35));
      box.style.opacity = (p * (1 - q)).toFixed(3);
      box.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`;
      box.style.transform = `translate(0, -50%) translateX(${((1 - p) * -40 - q * 30).toFixed(1)}px)`;
    }, box);
    return box;
  }

  return { kinetic, say, slam, chapter };
}
