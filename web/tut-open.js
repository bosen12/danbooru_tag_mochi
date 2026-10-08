/**
 * 開場（bar 0–6）：牌在景深裡緩緩漂、鏡頭往前推；一句話、標題砸下來、兩塊內容提要。
 * 之後接墨池的螢幕（tut-mochi-a.js 的開機）。
 */
import { EZ, seg, lerp, spring, mk, put, V, env, makeScene, cardEl, esc } from "./tut-kit.js";
import { track } from "./film-kit.js";
import { b } from "./tut-mochi.js";
import { english } from "./i18n.js";

export function buildOpen(ctx) {
  const { world, hud, text, SCENES } = ctx;
  const S = makeScene("open", { world, hud, tint: [0.62, 0.12, 40] });
  SCENES.open = S;
  // 漂在後面的牌：每個花色幾張，大小、深度、方向各不同（越遠越糊、越慢）
  const tags = ["1girl", "red hair", "sundress", "standing", "beach", "sunset", "cherry blossoms", "long hair", "smile", "school uniform", "night", "kimono", "rain", "umbrella"].filter((t) => env.lib.byTag.has(t));
  const cards = tags.map((tag, i) => {
    const el = cardEl(tag, 200, S.root, { cls: "tdrift" });
    const a = i * 2.399;
    const r = 380 + (i % 4) * 190;
    return { el, x: Math.cos(a) * r * 1.5, y: Math.sin(a) * r * 0.62, z: -700 + (i % 5) * 260, ph: i * 0.9, rz: (i % 2 ? 1 : -1) * (6 + (i % 3) * 5) };
  });
  S.act([0, b(6, 1)], (t) => {
    cards.forEach((c, i) => {
      const p = EZ.out(seg(t, 0.05 + i * 0.07, 0.9 + i * 0.07));
      const y = c.y + Math.sin(t * 0.5 + c.ph) * 26 + (1 - p) * 220;
      put(c.el, { x: c.x + Math.cos(t * 0.35 + c.ph) * 30, y, z: c.z, rx: Math.sin(t * 0.3 + c.ph) * 8, ry: Math.cos(t * 0.27 + c.ph) * 12, rz: c.rz * (0.6 + 0.4 * Math.sin(t * 0.2 + c.ph)), s: 1, o: p * 0.9 * (1 - EZ.in(seg(t, b(5, 3), b(6, 1)))) });
    });
  });
  // 提要：兩條
  const pill = (html, y, t0) => {
    const el = mk("div", "w toc", S.root, html);
    S.act([t0 - 0.1, b(6, 1)], (t) => {
      const p = EZ.out(seg(t, t0, t0 + 0.6));
      const q = EZ.exit(seg(t, b(5, 3), b(6, 1)));
      put(el, { x: 0, y: y + (1 - p) * 40, z: 120, s: lerp(0.85, 1, p) + spring(t - t0 - 0.6, 0.03, 7, 22), o: p * (1 - q) });
    }, el);
    S.cue({ t: t0, kind: "pop", gain: 0.12, f: 440 });
  };
  pill(`<b style="--suit:var(--suit-look)">${english ? "I" : "墨"}</b>墨池　放牌 · 規則 · 抽圖 · 成品牆`, 250, b(4, 0.5));
  pill(`<b style="--suit:var(--suit-scene)">${english ? "F" : "印"}</b>疊印台　疊層 · 影子 · 試印 · 付印`, 335, b(4, 2));
  text.say("*第一次*用這個網頁？", "First time here?", b(0, 1), b(1, 3));
  text.say("看完這支，*每個功能*你都會用", "Watch this — you'll know every feature", b(1, 3.3), b(3, 0));
  text.slam({ zh: "使用教學", en: "A HANDS-ON GUIDE", sub: "*墨池* 與 *疊印台*", y: 430, inAt: b(3, 0), outAt: b(5, 2.5) });
  S.cue({ t: b(3, 0), kind: "stamp", gain: 0.34 }, { t: b(3, 0.1), kind: "sparkle", gain: 0.1 }, { t: b(0, 0), kind: "whoosh", gain: 0.12, dur: 1.6 });
  ctx.cut(b(6), "whip");
  S.cam = track(
    [
      [0, V(0, 0, -500, 6, 12, 0)],
      [b(3, 0), V(0, 0, 100, 2, 4, 0), EZ.inOut],
      [b(6, 1), V(0, 0, 600, 0, 0, 0), EZ.in],
    ],
    EZ.inOut
  );
  void esc;
  void lerp;
}
