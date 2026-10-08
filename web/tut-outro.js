/**
 * 結尾（bar 114–126）：鍵盤快捷鍵一鍵一鍵按過、三個動詞回顧、「現在，換你了」。
 */
import { EZ, seg, lerp, spring, mk, put, V, makeScene } from "./tut-kit.js";
import { track } from "./film-kit.js";
import { b } from "./tut-mochi.js";

const KEYS = [
  ["/", "找牌"],
  ["Enter", "放進池"],
  ["Esc", "取消／停"],
  ["G", "抽並生圖"],
  ["P", "只抽牌／付印"],
  ["Z", "撤回／復原"],
  ["1–4", "選試印"],
  ["R", "換一批"],
];

export function buildOutro(ctx) {
  const { world, hud, text, SCENES } = ctx;
  const S = makeScene("outro", { world, hud, tint: [0.62, 0.11, 25] });
  SCENES.outro = S;
  const T0 = b(114);
  const els = KEYS.map(([k, label], i) => {
    const el = mk("div", "w tkbd", S.root, `<b>${k}</b><small>${label}</small>`);
    el.style.minWidth = "190px";
    const col = i % 4;
    const row = Math.floor(i / 4);
    const t = T0 + 0.6 + i * 0.5;
    S.cue({ t, kind: "key", gain: 0.16 }, { t: t + 0.02, kind: "pop", gain: 0.06, f: 380 + i * 60 });
    return { el, x: (col - 1.5) * 250, y: (row - 0.5) * 210 - 40, t };
  });
  S.act([T0 - 0.2, b(120, 1)], (t) => {
    els.forEach((e, i) => {
      const p = EZ.out(seg(t, e.t - 0.3, e.t + 0.3));
      const q = EZ.exit(seg(t, b(119, 2) + i * 0.05, b(120, 1)));
      const hot = t >= e.t && t < e.t + 0.28;
      e.el.classList.toggle("hot", hot);
      put(e.el, { x: e.x, y: e.y + (1 - p) * 60 + (hot ? 6 : 0), z: 60 * (1 - q) - (1 - p) * 200, rx: (1 - p) * 40, s: lerp(0.8, 1, p), o: p * (1 - q) });
    });
  });
  text.chapter("★", "鍵盤，比滑鼠快", "KEYBOARD SHORTCUTS", T0 + 0.1, b(117, 0));
  text.say("熟了以後，*手不用離開鍵盤*", "Once you know them, your hands never leave the keys", b(116, 0), b(119, 2));
  // 回顧：三個動詞
  text.slam({ zh: "挑牌", en: "PICK", y: 380, inAt: b(120, 0.5), outAt: b(121, 2), x: 560 });
  text.slam({ zh: "疊層", en: "STACK", y: 380, inAt: b(120, 2), outAt: b(121, 2), x: 960 });
  text.slam({ zh: "付印", en: "PRINT", y: 380, inAt: b(121, 0), outAt: b(121, 2), x: 1360 });
  S.cue({ t: b(120, 0.5), kind: "stamp", gain: 0.24 }, { t: b(120, 2), kind: "stamp", gain: 0.26 }, { t: b(121, 0), kind: "stamp", gain: 0.3 });
  text.slam({ zh: "現在，換你了", en: "YOUR TURN", sub: "*墨池* · *疊印台*　放一張牌試試", y: 470, inAt: b(122, 0.5), outAt: b(125, 3) });
  S.cue({ t: b(122, 0.5), kind: "stamp", gain: 0.36 }, { t: b(122, 0.6), kind: "sparkle", gain: 0.12 });
  // 收尾淡出
  const fade = mk("div", "fade-black", S.hud);
  S.act([b(125, 0), 1e9], (t) => {
    fade.style.opacity = EZ.inOut(seg(t, b(125, 1), b(125, 3.9))).toFixed(3);
  });
  ctx.cut(T0, "flash");
  S.cam = track(
    [
      [T0, V(0, 0, -300, 8, -14, 0)],
      [b(117, 0), V(0, 0, 100, 2, 4, 0), EZ.inOut],
      [b(120, 0), V(0, 0, 250, 0, 0, 0), EZ.inOut],
      [b(126, 0), V(0, 0, 500, 0, 0, 0), EZ.in],
    ],
    EZ.inOut
  );
}
