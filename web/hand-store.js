/**
 * 偏好卡牌（托盤上的牌）：存在伺服器（data/fav_hand.json，/api/fav-hand），所有裝置、墨池／卡冊／疊印台共用一份。
 * 2026-11-18 以前只存在瀏覽器（手機、電腦各一份），而且疊印台自己一份（mochi.fuse.hand.v1）。
 *
 * 跟偏好角色同一套同步（synced-list.js）；多記順序（托盤可以排），新加的接在後面。
 * localStorage mochi.hand.v1 照舊是這台的快取（舊資料直接沿用，第一次連上伺服器時併進伺服器那份）。
 */
import { createSyncedList } from "./synced-list.js";

export const handStore = createSyncedList({
  key: "mochi.hand.v1",
  syncedKey: "mochi.hand.synced",
  opsKey: "mochi.hand.ops",
  url: "/api/fav-hand",
  order: true,
  prepend: false,
});

/** 舊的另一份（疊印台以前自己的 mochi.fuse.hand.v1）：接在後面併進共用那份，舊的那份拿掉。只做一次。 */
export function mergeLegacyHand(key) {
  let old = [];
  try {
    old = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    old = [];
  }
  const add = (Array.isArray(old) ? old : []).filter((t) => typeof t === "string" && t && !handStore.has(t));
  if (add.length) handStore.set([...handStore.list(), ...add]);
  try {
    localStorage.removeItem(key);
  } catch {
    /* 拿不掉：下次再併一次，已經有的不會重複 */
  }
  return add.length;
}
