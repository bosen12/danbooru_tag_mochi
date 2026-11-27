/**
 * 永遠不抽的字（hardban）：看起來未成年的字。不做成卡、不畫插畫、抽牌一律封鎖（隨機、釘選、預設組都一樣），
 * 貼上提示詞會被拿掉，伺服器回傳相關的牌、wiki 說明、送去生圖前也擋。不是設定，是底線。
 *
 * 唯一的一份（2026-11-28 專案主：合併 hardban）。以後要禁止或開放一個字，只改這裡：
 *   - web/engine.js 的 NEVER_DRAW、web/card-art.js 的 HARD_BANNED 都從這裡來（網頁、背景執行緒、MCP）；
 *   - server.py、scripts/*（相關的牌、打包卡面）、card_tool/merge_cards.py 用根目錄的 hardban.py 讀這個檔，
 *     讀不到或數量不對就不啟動、不產檔（寧可不跑，也不要沒有封鎖地跑）。
 * 以前抄了三份，伺服器那份少了 10 個字。
 *
 * 禁用角色不在這裡：在 scripts/characters.json（產進 lexicon.json 的 characterBan）。
 * children 不在詞庫（merge 的 BANNED 會丟掉），貼上與送出仍靠這張表擋。child 在詞庫（listed_block）。
 *
 * 格式要維持「一行一個雙引號字串」：Python 那邊用文字比對讀（hardban.py 的 parse_hard_ban）。
 */
export const HARD_BAN = Object.freeze([
  "loli",
  "shota",
  "aged down",
  "onee-shota",
  "oppai loli",
  // 2026-11-26：alltags 跟未成年有關的字，專案主說照 loli、onee-shota 處理。
  "if they mated",
  "kono lolicon domome",
  "age regression",
  "lolidom",
  "mesugaki",
  "onee-loli",
  "onii-shota",
  "child on child",
  "baby",
  "kodomo doushi",
  "toddlercon",
  "toddlersex",
  "mother and child",
  "father and child",
  "carrying baby",
  "kindergarten uniform",
  "tomoeda elementary school uniform",
  "tokyo-3 middle school uniform",
  "mitakihara school uniform",
  "tokiwadai school uniform",
  "nanamori school uniform",
  "sakugawa school uniform",
  "nanairogaoka middle school uniform",
  // 2026-11-26：alltags 的小學、國中制服，照上面幾件一樣收進詞庫但不抽、不烤。
  "seishou elementary school uniform",
  "nami junior high school uniform",
  "raimon",
  "pacifier",
  "diaper",
  "bib",
  "onesie",
  "training bra",
  "age progression",
  "age comparison",
  "parent and child",
  "father and son",
  "children",
  "child carry",
  "child",
  // 2026-11-27 tagcomplete 那批：國中、小學、幼兒相關和專案主要禁的抱著嬰兒（sync_20261127_tags.py 的 NEVER）。
  "tokiwadai school gym uniform",
  "kamihama university affiliated school uniform",
  "raimon soccer uniform",
  "blueberry academy school uniform",
  "randoseru",
  "problem solver 68 (blue archive)",
  "holding baby",
]);
