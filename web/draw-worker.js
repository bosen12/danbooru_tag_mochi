/**
 * 背景執行緒抽牌（draw-pool.js 叫它）。跟主執行緒同一支引擎、同一份詞庫、同一顆種子：抽出來一模一樣。
 * 疊印台開頁的四張試印在這裡抽，主執行緒同時排字盒、畫畫面（手機上四張要 0.6 秒）。
 *
 * 訊息：{ warm: 詞庫網址 } 先載詞庫；{ id, lexUrl, settings, pins, banned, seeds, trace } 抽 seeds 那幾張，
 * 回 { id, out: [{ positive, era, heat, sections, eraClash, trace? }] }，出錯回 { id, error }。
 * 墨池的「只抽牌／抽並生圖」也在這裡抽：抽一張在慢手機上要 150～300ms，以前整段卡在主執行緒。
 */
import { indexLexicon } from "./engine.js";
import { drawWithSeed } from "./draw-with-seed.js";

let lexUrl = "";
let lexP = null;
const lexOf = (url) => {
  if (!lexP || url !== lexUrl) {
    lexUrl = url;
    lexP = fetch(url)
      .then((r) => r.json())
      .then(indexLexicon);
  }
  return lexP;
};

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.warm) {
    lexOf(m.warm).catch(() => {});
    return;
  }
  try {
    const lex = await lexOf(m.lexUrl);
    const pins = new Set(m.pins || []);
    const banned = new Set(m.banned || []);
    const out = (m.seeds || []).map((seed) => {
      const d = drawWithSeed(lex, m.settings, pins, banned, seed, m.trace ? { trace: true } : {});
      const r = { positive: d.positive, era: d.era, heat: d.heat, sections: d.sections, eraClash: d.eraClash || [] };
      // 墨池的成品要知道每張牌是誰補進來的（trace.kept 的 source）。
      if (m.trace) r.trace = { kept: ((d.trace && d.trace.kept) || []).map((k) => ({ tag: k.tag, source: k.source })) };
      return r;
    });
    self.postMessage({ id: m.id, out });
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err && err.message ? err.message : err) });
  }
};
