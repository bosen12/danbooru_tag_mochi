/**
 * 詞庫換過名字的字：這個瀏覽器存著的舊名，開頁時換成新名。
 *
 * 2026-10-14 用本機 ComfyUI 實測底模（WAI v17）：這幾組模型只認得新加的名字，原卡拿掉、
 * 只留新名（scripts/alt_names.json 的 keep: "alt"）。偏好卡牌、偏好角色、廢字簍、卡盒、
 * 使用次數、規則裡的必抽……存的都是字本身，不換的話那些牌會悄悄消失。
 *
 * 每個墨池房間的進入點**第一個 import** 這支：模組照 import 的順序執行，它跑完別的模組
 * （fav-chars.js 這類一載入就讀 localStorage 的）才讀得到換好的值。
 * 只換 mochi.* 底下 JSON 裡**整個字串剛好是舊名**的地方（"missing legwear"），
 * 提示詞那種逗號串起來的長字串不動（那是當時送出去的紀錄）。換過一次就記下來，不重複做。
 * 跟 lexicon.json 的 renamed 要一致（scripts/test_web6_jobs.mjs 守著）。
 */
export const TAG_RENAMES = {
  "aizawa shota": "eraser head (boku no hero academia)",
  "colonnade": "column",
  "marcille donato (lord)": "marcille donato (dungeon lord)",
  "missing legwear": "no legwear",
  "shion (tensura)": "shion (tensei shitara slime datta ken)",
  "taihou (forbidden fruit) (azur lane)": "taihou (forbidden feast) (azur lane)",
  "three-quarter sleeves": "sleeves past elbows",
};

const DONE_KEY = "mochi.renames.v1";

/** 把一段 JSON 文字裡剛好是舊名的字串換成新名（鍵和值都算）。沒變就原樣回傳。 */
export function renameInJson(raw, renames = TAG_RENAMES) {
  let out = raw;
  for (const [from, to] of Object.entries(renames)) {
    out = out.split(JSON.stringify(from)).join(JSON.stringify(to));
  }
  return out;
}

/** 換一次（storage 可以換成假的，測試用）。回傳換了幾個鍵。 */
export function migrateRenamedTags(storage = globalThis.localStorage, renames = TAG_RENAMES) {
  if (!storage) return 0;
  const sig = Object.keys(renames).sort().join("|");
  let changed = 0;
  try {
    if (storage.getItem(DONE_KEY) === sig) return 0;
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith("mochi.") && k !== DONE_KEY) keys.push(k);
    }
    for (const k of keys) {
      const raw = storage.getItem(k);
      if (!raw) continue;
      const next = renameInJson(raw, renames);
      if (next !== raw) {
        storage.setItem(k, next);
        changed += 1;
      }
    }
    storage.setItem(DONE_KEY, sig);
  } catch {
    /* 存不了（私密模式、額度滿）就算了：下次開頁再試 */
  }
  return changed;
}

migrateRenamedTags();
