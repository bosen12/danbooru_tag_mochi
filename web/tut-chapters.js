/**
 * 教學影片的章節表（小節）：章節記號、上面那排進度點、各幕的鏡頭都照這一張排。
 * part：墨池／疊印台（換部分時進度點中間空一格）。
 */
import { bar } from "./tutorial-score.js";

export const CHAPTERS = [
  { id: "screen", part: "墨池", zh: "認識畫面", en: "THE SCREEN", from: 6, to: 11 },
  { id: "place", zh: "放牌的三種方法", en: "THREE WAYS TO PLACE", from: 11, to: 23 },
  { id: "rels", zh: "牌跟牌的關係", en: "HOW CARDS INTERACT", from: 23, to: 31 },
  { id: "rules", zh: "規則", en: "RULES", from: 31, to: 37 },
  { id: "draw", zh: "抽牌與生圖", en: "DRAW & RENDER", from: 37, to: 48 },
  { id: "wall", zh: "成品牆", en: "THE WALL", from: 48, to: 57 },
  { id: "tray", zh: "偏好卡牌與廢字簍", en: "FAVORITES & TRASH", from: 57, to: 64 },
  { id: "layers", part: "疊印台", zh: "一張牌，一層墨", en: "ONE CARD, ONE LAYER", from: 66, to: 72 },
  { id: "fplace", zh: "放牌", en: "PLACING", from: 72, to: 80 },
  { id: "shadow", zh: "影子與關係", en: "SHADOWS & LINKS", from: 80, to: 89 },
  { id: "proof", zh: "四張試印", en: "FOUR PROOFS", from: 89, to: 97 },
  { id: "print", zh: "付印與晾紙", en: "PRINT & HANG", from: 97, to: 105 },
  { id: "more", zh: "撤回、清版、起手式", en: "UNDO, CLEAR, STARTERS", from: 105, to: 112 },
];

export const chapterAt = (t) => {
  let cur = -1;
  CHAPTERS.forEach((c, i) => {
    if (t >= bar(c.from) - 0.2) cur = i;
  });
  return cur;
};

export const CH = Object.fromEntries(CHAPTERS.map((c, i) => [c.id, { ...c, n: i + 1, t0: bar(c.from), t1: bar(c.to) }]));
