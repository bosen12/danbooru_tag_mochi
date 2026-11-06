import { applyPin, indexLexicon, sanitizeSettings } from "./engine.js";
import { HARD_BANNED } from "./card-art.js";
import { ratingBlocked, ratingOf } from "./rules/rating.js";
import { emptyBed, placeCard, sanitizeBed } from "./fuse-bed.js";
import { loadBans, loadFuseSettings, loadSettings, peekTab, TAB_FUSE } from "./store.js";
import { reviewTransfer } from "./transfer.js";

// 預告及真正收牌都跑同一套規則，互斥、附帶及目的地的分級都會影響結果。
export function transferredBed(tags, weights, lib, lex, settings, bans) {
  let bed = emptyBed();
  const deps = { lex, applyPin: (l, p, b, t) => applyPin(l, p, b, t, { eraMix: settings.eraMix }) };
  for (const tag of tags) {
    const item = lib.byTag.get(tag);
    if (item && !bans.has(tag) && !ratingBlocked(item.item, ratingOf(settings)) && !HARD_BANNED.includes(tag)) {
      bed = placeCard(bed, tag, deps).bed;
    }
  }
  return sanitizeBed({ ...bed, weights }, tag => lib.byTag.has(tag));
}

export function reviewFuseTransfer(tags, weights, lib, data, lex, zh, proceed) {
  if (!peekTab(TAB_FUSE)?.bed?.pins?.length) return proceed();
  const settings = sanitizeSettings(loadFuseSettings() || loadSettings() || { rating: "general" }, data);
  const next = transferredBed(tags, weights, lib, lex || indexLexicon(data), settings, new Set(loadBans()));
  return reviewTransfer("fuse", next.pins, next.weights || {}, zh, proceed);
}
