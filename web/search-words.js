/**
 * 字盒搜尋的同義詞（cards.js 的 searchCards）：牌名裡沒有、但大家會這樣打的說法 → 對到的牌（詞庫的 tag）。
 *
 * 2026-11-02 走查：搜「胖」只出現胖製作（豐滿、肚子肥肉、過胖都沒有），「開槍」只猜到槍（開火射擊沒有），
 * 「黑絲」「墨鏡」「夕陽」「帽T」「比讚」一張都沒有。量了 360 個日常說法，0 張或只猜到一張的補在這裡。
 *
 * - 鍵照打的字寫（繁簡都行，比對前一樣換成簡體）；整段打的字、或空白分開的某一段等於鍵，才帶出後面的牌。
 * - 值寫 tag 不寫中文名：中文名一改，這裡不會悄悄失效（scripts/test_card_search.mjs 檢查每個 tag 都在詞庫）。
 * - 越像的寫越前面：同義詞找到的排在牌名直接對到的後面，彼此照這裡的順序。
 * - 只放對得很準的。「性感」「可愛」這種一詞多義的不放，放了反而一大串不相干的。
 */
export const SEARCH_WORDS = {
  // 身材
  胖: ["plump", "fat rolls", "fat", "obese", "curvy", "thick thighs", "wide hips"],
  肥: ["fat", "obese", "fat rolls", "plump"],
  微胖: ["plump", "curvy", "thick thighs"],
  肉感: ["plump", "curvy", "thick thighs", "wide hips"],
  豐腴: ["plump", "curvy", "wide hips"],
  瘦: ["skinny", "narrow waist", "petite"],
  苗條: ["skinny", "narrow waist"],
  纖細: ["skinny", "narrow waist"],
  壯: ["muscular", "muscular female", "abs", "toned"],
  強壯: ["muscular", "muscular female", "abs", "toned"],
  肌肉: ["muscular", "muscular female", "abs", "toned"],
  大奶: ["large breasts", "huge breasts"],
  大胸: ["large breasts", "huge breasts"],
  爆乳: ["huge breasts", "large breasts"],
  小胸: ["small breasts", "flat chest"],
  洗衣板: ["flat chest", "small breasts"],
  屁股: ["ass", "huge ass", "wide hips"],
  大屁股: ["huge ass", "wide hips", "ass"],
  翹臀: ["ass", "huge ass"],
  美腿: ["long legs", "thighs", "legs"],
  紋身: ["tattoo", "facial tattoo"],
  傷疤: ["scar", "scar on face"],
  疤: ["scar", "scar on face"],

  // 頭髮
  黃頭髮: ["blonde hair"],
  黃髮: ["blonde hair"],
  銀髮: ["white hair", "grey hair"],
  白頭髮: ["white hair", "grey hair"],
  粉紅頭髮: ["pink hair"],
  粉紅髮: ["pink hair"],
  麻花辮: ["braid", "single braid", "twin braids"],
  光頭: ["bald", "buzz cut", "very short hair"],
  平頭: ["buzz cut", "very short hair"],

  // 表情
  冷漠: ["expressionless", "blank stare", "jitome"],
  面癱: ["expressionless", "blank stare"],
  無表情: ["expressionless", "blank stare"],

  // 衣服
  胖次: ["panties"],
  空姐: ["flight attendant"],
  帽t: ["hoodie", "hooded jacket"],
  帽踢: ["hoodie", "hooded jacket"],
  衛衣: ["hoodie", "hooded jacket"],
  絲襪: ["pantyhose", "thighhighs", "black pantyhose", "white pantyhose", "black thighhighs", "white thighhighs", "fishnet pantyhose"],
  黑絲: ["black pantyhose", "black thighhighs"],
  白絲: ["white pantyhose", "white thighhighs"],
  吊帶襪: ["garter straps"],
  光腳: ["barefoot"],
  墨鏡: ["sunglasses"],

  // 動作
  睡覺: ["sleeping", "sleepy"],
  喝酒: ["alcohol", "beer", "wine", "sake", "beer mug", "drunk"],
  抽菸: ["smoking", "cigarette"],
  抽煙: ["smoking", "cigarette"],
  看書: ["reading", "holding book"],
  打電話: ["talking on phone", "holding phone"],
  講手機: ["talking on phone", "holding phone"],
  玩手機: ["holding phone", "cellphone"],
  滑手機: ["holding phone", "cellphone"],
  打鼓: ["drum set", "drum", "drumsticks"],
  騎車: ["riding bicycle", "bicycle", "motorcycle"],
  騎機車: ["motorcycle"],
  騎摩托車: ["motorcycle"],
  拿劍: ["holding sword", "sword"],
  揮劍: ["holding sword", "unsheathing", "sword"],
  開槍: ["firing", "holding gun", "aiming", "muzzle flash", "handgun", "rifle"],
  射擊: ["firing", "aiming", "holding gun", "muzzle flash"],
  回頭: ["looking back"],
  背影: ["from behind"],
  比讚: ["thumbs up"],
  剪刀手: ["v", "double v", "v over eye"],
  比耶: ["v", "double v", "v over eye"],
  抱胸: ["crossed arms"],
  伸懶腰: ["stretching", "arms up", "yawning"],

  // 場景
  游泳池: ["pool", "poolside"],
  夜景: ["city lights", "cityscape", "night"],
  夕陽: ["sunset", "dusk", "evening"],
  落日: ["sunset", "dusk"],
  晚上: ["night", "evening"],
  宇宙: ["space", "planet", "starry sky"],
  外太空: ["space", "planet"],
  地下城: ["dungeon", "cave"],
  廢墟: ["ruins", "abandoned", "post-apocalypse"],
  簡單背景: ["simple background", "white background", "grey background"],
  純色背景: ["simple background", "white background", "grey background"],

  // 畫風
  黑白: ["monochrome", "greyscale"],
  q版: ["chibi"],
  帥: ["bishounen"],
};
