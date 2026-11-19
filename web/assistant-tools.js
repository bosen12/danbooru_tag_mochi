/**
 * 墨池助手的頁面工具層：工具定義、參數驗證、守門、執行。
 * 不碰 DOM，也不自己改工作台——寫入都交給 ctx（assistant-bridge.js）。
 *
 * 瀏覽器從 web6 載這支時，./engine.js 會由伺服器退回 web/engine.js；
 * node 測試直接載 web6/*.js，旁邊沒有 engine.js，所以這裡不 import 引擎。
 * 份量只在 0.6–1.5 內四捨五入到 0.1（跟 clampTagWeight 同一式）；超出範圍要拒絕，不夾限。
 * 未成年的字引擎沒有出口（NEVER_DRAW 未 export），跟卡面的 HARD_BANNED、MCP 的句子是同一份底線。
 *
 * label() 是同步的：步驟名稱在 await 之前就要畫出來。
 * 因此 label 用到的 ctx.cardInfo／state 必須同步回傳，不能是 Promise。
 *
 * turn 要是 { version: number }，數字是模型看到的那一版工作台。
 * 同一輪裡助手自己的寫入也會把版本往上推，不能把那種推進當成使用者改過。
 * 沒帶 version 就無法判斷，寫入照做（呼叫端要在使用者送出那一刻把版本放進 turn）。
 */

const { HARD_BANNED } = await import(
  typeof process !== "undefined" && process.versions?.node ? "../web/card-art.js" : "./card-art.js"
);

// mcp/mochi-mcp.mjs 的 MINOR_RE。詞庫沒有的說法（「幼女」）也要在這裡擋下來，
// 不然模型會把它當成詞庫外的自由字塞進提示詞。
const MINOR_RE =
  /\b(loli|lolicon|shota|shotacon|child|children|kid|kids|toddler|baby|infant|underage|minor|preteen|young(?:er)?\s+(?:girl|boy)|little\s+(?:girl|boy|sister|brother)|elementary\s+school|middle\s+school|kindergarten|aged\s+down|age\s+regression)\b|蘿莉|萝莉|正太|幼女|幼童|兒童|儿童|小孩|孩童|未成年|小學生|小学生|國中生|初中生/i;

const HARD = new Set(HARD_BANNED.map((t) => String(t).toLowerCase().replace(/_/g, " ").trim()));

// 跟 card-groups.js 的 GROUP_SECTIONS／GROUP_MODES 同一份。不 import 那支，避免把它的讀取狀態拉進來。
const SECTIONS = ["feature", "clothing", "pose", "env"];
const SEARCH_SECTIONS = [...SECTIONS, "subject"];
const MODES = ["whole", "mix"];
const SECTION_ZH = { feature: "長相", clothing: "服裝", pose: "姿勢", env: "場景", subject: "人物" };
const GATE_ZH = { rating: "分級", banned: "廢字簍", trash: "廢字簍", gender: "性別", era: "時代", heat: "尺度" };

// card_groups.py：名字、張數、勾選上限。這裡先擋，免得送去伺服器才被截斷，模型還以為全部存進去了。
const POOL_CAP = 40;
const MAX_NAME = 40;
const MAX_TAGS = 120;
const MAX_PICKS = 50;
const MAX_GROUPS = 200;
const WEIGHT_MIN = 0.6;
const WEIGHT_MAX = 1.5;
const LINE_CAP = 8;

const WHY = { minor: "未成年，墨池不畫", banned: "禁用角色，墨池不畫" };

// 給使用者看的句子。i18n 在畫完之後整句比對，所以值必須是固定模板，數字和牌名用 {0}。
// 工具描述跟回給模型的 note 不放這裡：那些維持中文，不進英文字典。
export const TEXT = {
  labWorkspace: "正在查看合成池和目前規則",
  labSearch: "正在搜尋「{0}」",
  labCard: "正在看「{0}」",
  labCheck: "正在試算這幾張牌",
  labAdd: "正在加入「{0}」",
  labRemove: "正在移掉「{0}」",
  labWeight: "正在調整「{0}」的份量",
  labPool: "正在調整合成池",
  labN: "正在把一次改成 {0}",
  labCount: "正在把{0}補牌數改成 {1}",
  labCounts: "正在調整各段補牌數",
  labGroups: "正在查看群組",
  labPicks: "正在套用{0}的群組",
  labSave: "正在建立群組「{0}」",
  labDrawN: "正在抽 {0} 張",
  labDraw: "正在抽這一輪",
  labGeneric: "正在處理",
  labPaste: "正在排 {0} 個字",
  pasteSum: "排進 {0} 張牌",
  pasteWeights: "調整 {0} 張牌的份量",
  pasteRemoves: "移除 {0} 張牌",
  pasteChanges: "排進 {0} 張牌，調整 {1} 張牌的份量，移除 {2} 張牌",
  pasteUnsearched: "另 {0} 個尚未查找",
  pasteNone: "一張牌都對不上",
  pasteHave: "這些牌都已經在合成池",
  pasteCands: "「{0}」可能是：{1}",
  pasteNoCand: "「{0}」字盒裡也沒有相近的",
  pasteIgnored: "引擎自己處理：{0}",
  pasteDropped: "沒放進：{0}（跟同一串裡的牌互斥，留了後面那張）",
  promptEmpty: "提示詞不能是空的",
  promptLong: "提示詞太長（最多 2000 字）",
  poolSum: "合成池 {0} 張，一次 {1}",
  poolEmpty: "合成池是空的，一次 {0}",
  notReady: "墨池還沒準備好",
  countsLine: "長相 {0}、服裝 {1}、姿勢 {2}、場景 {3}",
  foundN: "找到 {0} 張",
  foundNone: "沒有找到",
  foundNear: "照「{0}」找到 {1} 張",
  foundTotal: "找到 {0} 張，列出 {1} 張",
  labSuggest: "正在挑推薦的牌",
  suggestN: "推薦 {0} 張牌",
  suggestNone: "沒有可以推薦的牌",
  suggestSkip: "沒排出來：{0}",
  // 操作紀錄（結果排成「加入　日落、走路」「長相　2 → 3」）：左邊的動詞照字典翻，右邊是牌名、數字，原樣顯示。
  opAdd: "加入",
  opCompanion: "附帶",
  opRemove: "移掉",
  opWeight: "份量",
  opUnban: "撿回",
  opN: "一次",
  opPicks: "{0}群組",
  opPicksClear: "全部取消",
  opSaved: "建立群組",
  checkCounts: "可用 {0} 張，已在池中 {1} 張，找不到 {2} 張，受限制 {3} 張",
  noCard: "詞庫沒有「{0}」",
  blockedBy: "「{0}」被{1}擋著",
  emptyQuery: "搜尋字不能是空的",
  badLimit: "搜尋筆數要介於 1 到 20",
  badSection: "類別不對",
  nChange: "一次 {0} → {1}",
  nSame: "一次已經是 {0}",
  nRange: "一次要介於 1 到 50",
  countChange: "{0}補牌數 {1} → {2}",
  countSame: "補牌數沒有要改的",
  countRange: "補牌數要介於 0 到 10",
  weightRange: "份量要介於 0.6 到 1.5",
  weightType: "份量要是數字",
  weightChange: "「{0}」的份量 {1} → {2}",
  added: "加入「{0}」",
  withCompanion: "加入「{0}」；附帶「{1}」",
  companion: "附帶「{0}」",
  removed: "移掉「{0}」",
  wouldRemove: "會拿掉已釘的「{0}」",
  confirmDisplace: "加入「{0}」會拿掉已釘的「{1}」。要套用嗎？",
  confirmUnban: "「{0}」在廢字簍裡，加入會把它撿回來。要套用嗎？",
  confirmBoth: "會拿掉已釘的「{0}」，並從廢字簍撿回「{1}」。要套用嗎？",
  confirmGeneric: "這幾張會動到已經釘上的牌。要套用嗎？",
  over40: "合成池會有 {0} 張，超過 40 張上限",
  swap: "可換掉：{0}",
  moreCards: "還有 {0} 張可換",
  moreItems: "還有 {0} 項",
  keep: "保留原狀",
  noBanUndo: "廢字簍裡的牌不能自動復原",
  notInPool: "合成池裡沒有「{0}」",
  overlap: "加入和移掉不能是同一張",
  overlapW: "移掉和調份量不能是同一張",
  nothing: "沒有要改的項目",
  notInLex: "「{0}」不在詞庫",
  cannotUse: "「{0}」不能用（{1}）",
  whyMinor: WHY.minor,
  whyBanned: WHY.banned,
  poolSame: "合成池沒有要改的",
  poolAdjusted: "調整了合成池",
  companionBack: "「{0}」是附帶的，移掉還是會跟著回來",
  confirmGone: "這項確認已經失效",
  stale: "工作台已經變了，請先重新查看",
  notReadyWrite: "墨池還沒準備好，這步先不做",
  aborted: "已取消",
  unknownTool: "不認識這個工具",
  badArgs: "參數不對",
  failed: "這一步沒有完成",
  drew: "這輪抽到 {0}／{1} 組",
  drewNone: "這輪沒有抽到牌",
  noGen: "沒有生圖",
  nameLong: "群組名稱最長 40 字",
  nameEmpty: "請寫群組名稱",
  needTag: "請至少放一張牌",
  tooManyTags: "一組最多 {0} 張牌",
  tooManyPicks: "一次最多勾 {0} 組",
  tooManyGroups: "群組最多 {0} 組，先刪掉一些",
  badMode: "抽法不對",
  picksNeedIds: "請傳這個類別要保留的完整 ID 清單",
  groupsNotLoaded: "群組清單還沒讀到，請再試一次",
  groupsReadFailed: "讀取群組清單失敗，請再試一次",
  groupMissing: "這個類別沒有這組",
  nameTaken: "已有同名群組「{0}」",
  wrongSection: "「{0}」不屬於這個類別",
  allWrong: "這些牌都不屬於這個類別",
  saved: "已建立「{0}」",
  picksSet: "{0}改成抽「{1}」",
  picksClear: "{0}不再用群組",
  picksSame: "群組勾選沒有要改的",
  groupCount: "{0}有 {1} 組",
  groupCountAll: "群組共 {0} 組",
  undoN: "一次已經被改過，沒有復原",
  undoTag: "「{0}」已經被改過，沒有復原",
  restored: "已復原",
  undoClash: "復原會擠掉後來放的「{0}」，先保留現況",
  undoOver: "復原後會超過 40 張，先保留現況",
  cardIs: "「{0}」是{1}",
};

// 函式替換：牌名裡的 $& 不會被 String.replace 當成插入符號。
export function fill(tpl, ...args) {
  return String(tpl).replace(/\{(\d+)(!)?\}/g, (_, i) => {
    const v = args[Number(i)];
    return v == null ? "" : String(v);
  });
}

function norm(tag) {
  return String(tag ?? "").toLowerCase().replace(/[_\s]+/g, " ").trim();
}

function snapWeight(weight) {
  if (typeof weight !== "number" || !Number.isFinite(weight)) return { ok: false, type: true };
  if (weight < WEIGHT_MIN || weight > WEIGHT_MAX) return { ok: false, type: false };
  return { ok: true, value: Math.round(weight * 10) / 10 };
}

function isInt(n) {
  return typeof n === "number" && Number.isInteger(n);
}

function sameList(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameW(a, b) {
  return Math.round(Number(a) * 10) === Math.round(Number(b) * 10);
}

function collapseName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function capLines(lines) {
  const clean = (lines || []).filter(Boolean);
  if (clean.length <= LINE_CAP) return clean;
  return [...clean.slice(0, LINE_CAP - 1), fill(TEXT.moreItems, clean.length - (LINE_CAP - 1))];
}

function tagList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const out = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") return null;
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function weightMap(value) {
  if (value == null) return { map: Object.create(null) };
  if (typeof value !== "object" || Array.isArray(value)) return { error: "type" };
  const map = Object.create(null);
  for (const key of Object.keys(value)) {
    // 模型偶而會把 __proto__ 當 tag 傳進來，不能讓它變成原型。
    if (key === "__proto__" || key === "constructor" || key === "prototype") return { error: "type" };
    const name = key.trim();
    if (!name) return { error: "type" };
    map[name] = value[key];
  }
  return { map };
}

function onlyKeys(args, keys) {
  if (args == null) return {};
  if (typeof args !== "object" || Array.isArray(args)) return null;
  for (const k of Object.keys(args)) if (!keys.includes(k)) return null;
  return args;
}

const str = { type: "string" };
const strList = { type: "array", items: { type: "string" } };
const sectionList = { type: "array", items: { type: "string", enum: SECTIONS } };

const WORK_TEXT = {
  labReference: "正在帶入引用作品的牌",
  labFindWorks: "正在找作品",
  labTrace: "正在查看牌的來歷",
  referenceMissing: "找不到這件引用作品",
  referenceEmpty: "這件作品在指定的段落沒有可帶入的牌",
  referenceOp: "照作品 #{0} 帶入",
  referenceSections: "{0}（{1} 張）",
  referenceOmitted: "未留在合成池的引用牌：{0}",
  worksFound: "找到 {0} 件作品",
  worksFailed: "讀不到作品冊",
  traceTitle: "牌的來歷",
};

export const TOOL_DEFS = [
  {
    name: "use_reference",
    kind: "write",
    description: "把一件使用者引用、或 find_works 找到的作品裡的牌按原份量加到合成池。id 用作品編號，不要加 #。include 只帶指定段落；exclude 略過指定段落。兩者最多用一個，皆省略則帶長相、服裝、姿勢、場景。保留池裡其它牌，互斥會先等確認。不會套用原作的種子、底模、LoRA、分級或尺寸。",
    input_schema: { type: "object", properties: { id: str, include: sectionList, exclude: sectionList }, required: ["id"], additionalProperties: false },
  },
  {
    name: "find_works",
    kind: "read",
    description: "從作品冊查作品，回傳作品編號、縮圖、名稱。from、to 是包含當天的 YYYY-MM-DD，favorite 可篩收藏圖，tags 要全部在作品裡。使用者要看選項時，先展示結果，不要替他選；已指定要借的作品才用 use_reference 帶入。",
    input_schema: { type: "object", properties: { from: str, to: str, favorite: { type: "boolean" }, tags: strList, limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false },
  },
  {
    name: "trace_card",
    kind: "read",
    description: "查目前合成池或引用作品裡一張牌的來源、依附鏈、群組、互斥。id 可填引用作品編號，省略查目前的池。inferred 為真表示從現行規則推斷。wouldReturn 指重新套用相關牌的規則時會補回，手動拿掉後不會當場重釘，不要把它說成每次抽牌必定會回來。",
    input_schema: { type: "object", properties: { tag: str, id: str }, required: ["tag"], additionalProperties: false },
  },
  {
    name: "get_workspace",
    kind: "read",
    description: "查看這一頁現在的合成池、一次抽幾張、各段補牌數、分級、尺度、廢字簍和已勾的群組，以及工作台版本。不知道現況、或剛被告知工作台已經變了（stale）時，先呼叫這支再決定。不要用它修改任何牌或設定，也不要連猜 tag。",
    input_schema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "paste_prompt",
    kind: "write",
    description: "使用者描述想要的畫面、要你配牌、加一組東西時，優先用這支：直接寫出完整的 Danbooru 提示詞（英文 tag，逗號分隔，可寫 (tag:1.2) 權重），一次排進合成池，跟使用者按「貼上」一樣。不要先用 find_cards 一張張找。詞庫有的字變成牌放進去（附帶、互斥照規則）；詞庫沒有的字，頁面會到字盒找相近的牌放在 unknown[].candidates —— 重要的再挑一張用 change_pool 加入，不重要或沒有合適的就略過，不要再搜一次。互斥的（同一格只能一張，例如 beach 和 ocean、兩種髮色）只寫一個，寫兩個會留後面那張，回在 pasted.dropped。畫質詞、LoRA、評分詞不用寫。replace=true 會先拿掉合成池原本的牌（使用者說換成、重配、整組換掉時）；不傳就是加進去。會擠掉已釘的牌時一樣先停下來等確認。使用者只是問「你覺得」時不要呼叫。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["prompt"],
      properties: {
        prompt: { ...str, description: "Danbooru 提示詞，英文 tag 逗號分隔，最多 2000 字" },
        replace: { type: "boolean", description: "true 先清掉合成池原本的牌再放；預設 false 加進去" },
      },
    },
  },
  {
    name: "find_cards",
    kind: "read",
    description: "用中文或英文在詞庫找牌。只有使用者要你列出、比較有哪些牌，或點名一張不確定怎麼寫的牌時才用；要配一組牌用 paste_prompt。回傳裡被擋著的牌不要接著加入。不要把搜尋結果當成已經放進合成池。limit 預設 8、最多 20，不要為了湊數重複搜同一句。回傳的 total 是總共幾張，count 只是列出來的張數，回答「有幾張」看 total；畫面上這一步有「看這 N 張」可以打開全部，回覆不用把牌名一張張列出來。使用者問某一類、某個主題的牌（溫泉、洗澡系列、海邊相關）：query 放主要說法，also 像寫提示詞一樣，憑感覺一次寫出 8～15 個 Danbooru 上真的有的英文 tag（溫泉：onsen, bath, bathing, bathtub, bubble bath, shower, towel, steam, bathhouse），不要只查一個字就說沒有；說法對到詞庫的小分類名（例如「活動・玩水洗浴」「地點・浴場泳池」）時整類都會算進來。整句沒有完全相符時字盒會照較短的片段找（回傳帶 near）；還是沒有，就換英文 Danbooru tag 或別的說法再找一次，不要直接說詞庫沒有。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { ...str, description: "使用者的說法或 tag，空白分開表示都要符合" },
        also: { type: "array", maxItems: 15, items: { ...str }, description: "像寫提示詞一樣，憑感覺寫出這個主題 Danbooru 上真的有的英文 tag（8～15 個），加上一兩個中文說法；一起對詞庫、結果合併去重。例如溫泉：onsen, bath, bathing, bathtub, bubble bath, shower, showering, towel, steam, bathhouse, 洗浴" },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "預設 8，最多 20" },
        section: { type: "string", enum: SEARCH_SECTIONS, description: "feature 長相、clothing 服裝、pose 姿勢、env 場景、subject 人物。不確定就不要傳" },
      },
    },
  },
  {
    name: "suggest_cards",
    kind: "read",
    description: "使用者問「還可以加什麼」「推薦幾張」「你覺得呢」這類意見時用：從詞庫挑 1～6 張值得加的牌，各寫一句為什麼適合（短、具體、跟現在的合成池有關）。牌會用墨池的卡面排在聊天室，使用者可以直接按「加入」；這一步不會加入任何牌。使用者之後說「第一張和第三張加進去」，照這一步回傳的 n 對應，用 change_pool 加。已經在合成池、被擋著或詞庫沒有的不會排出來（回傳的 skipped 寫原因）。排出來之後回覆一兩句就好，不要把每張牌再寫一遍。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["cards"],
      properties: {
        cards: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["tag", "why"],
            properties: {
              tag: { ...str, description: "詞庫的正式 tag 或能唯一對應的牌名" },
              why: { ...str, description: "一句為什麼適合，20 字以內" },
            },
          },
        },
      },
    },
  },
  {
    name: "card_info",
    kind: "read",
    description: "看單張牌的類別、互斥、附帶、分級，以及它是不是未成年或禁用角色。已經知道 tag、要確認會不會互斥或附帶時用。不要用它加入、移掉或調份量。詞庫沒有時不要改用自由字硬塞。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["tag"],
      properties: { tag: { ...str, description: "詞庫正式 tag，或可唯一對應的牌名" } },
    },
  },
  {
    name: "suggest_check",
    kind: "read",
    description: "給準備加入的 tag，分成可用、已在池中、找不到和受限制，只用可用的牌試算附帶、互斥和 40 張上限。完全不寫入。一次加很多張、或池子接近 40 張時，先呼叫這支再決定要不要 change_pool。不要把它當成已經寫入，試算完使用者沒交代就不要接著改池子。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["tags"],
      properties: { tags: { ...strList, description: "準備加入的 tag，還不會寫入" } },
    },
  },
  {
    name: "change_pool",
    kind: "write",
    description: "使用者這一句明確交代要加入、移掉或調份量時才呼叫。add 會把附帶牌一起算進 40 張上限；會擠掉已釘的牌、或把廢字簍裡的牌撿回來時，會先停下來等使用者確認，不要自己再送一次。remove 是使用者點名要拿掉的，不會再問。不要用它改一次抽幾張、分級、尺度或群組。不要加使用者沒點名的牌，不要把互斥或同義的牌一起塞進去。使用者只是問「你覺得」時不要呼叫。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        add: { ...strList, description: "要釘上的 tag。附帶牌不用自己列" },
        remove: { ...strList, description: "使用者點名要移出合成池的 tag" },
        weights: {
          type: "object",
          description: "tag 對份量。份量是 0.6 到 1.5 的數字，步進 0.1。牌要已經在池子裡，或同一呼叫的 add 裡",
          additionalProperties: { type: "number" },
        },
      },
    },
  },
  {
    name: "set_draw_count",
    kind: "write",
    description: "使用者明確要改「一次抽幾張」（之後每一輪的張數，1 到 50）時才呼叫。不要把「抽三張」「這一輪抽三張」當成改一次，那是 draw_cards，只影響這一輪。不要順便改各段補牌數、分級或尺度。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["n"],
      properties: { n: { type: "integer", minimum: 1, maximum: 50, description: "之後每一輪抽幾張" } },
    },
  },
  {
    name: "set_section_counts",
    kind: "write",
    description: "使用者明確要改長相、服裝、姿勢或場景的補牌數（每段 0 到 10）時才呼叫。只傳要改的段，沒提到的段不要傳、也不要重設成 0。不要用它改「一次抽幾張」。不要在使用者沒講補牌時呼叫。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        feature: { type: "integer", minimum: 0, maximum: 10 },
        clothing: { type: "integer", minimum: 0, maximum: 10 },
        pose: { type: "integer", minimum: 0, maximum: 10 },
        env: { type: "integer", minimum: 0, maximum: 10 },
      },
    },
  },
  {
    name: "list_groups",
    kind: "read",
    description: "查看已存的群組，以及每個類別現在勾了哪些、是整組一起還是混著抽。預設只列 ID、名稱、類別、張數、勾選和抽法，需要成員時帶單一 id。要勾選或建立之前、還不知道組名對應的 id 時先呼叫。不要用它勾選、取消或存檔。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        section: { type: "string", enum: SECTIONS, description: "不傳就列出全部類別" },
        id: { ...str, description: "傳一組的完整 ID 才會附上這組的成員" },
      },
    },
  },
  {
    name: "set_group_picks",
    kind: "write",
    description: "使用者明確要勾選、取消或改成整組一起／混著抽時才呼叫。ids 是這個類別要留下的完整清單：只用 A 就只傳 A 的 id；再加 A 時要把原本已勾的 id 一起傳，沒傳的會被取消。空陣列表示這個類別全部不勾。mode 不傳就維持現在的抽法。不要用它建立新群組，也不要只傳新加的那一個 id。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["section", "ids"],
      properties: {
        section: { type: "string", enum: SECTIONS },
        ids: { ...strList, description: "這個類別要留下的全部群組 id，最多 50 個。空陣列表示不勾" },
        mode: { type: "string", enum: MODES, description: "whole 整組一起，mix 混著抽。不傳則維持現狀" },
      },
    },
  },
  {
    name: "save_card_group",
    kind: "write",
    description: "使用者明確說建立、存成群組時才呼叫。同一個類別裡已有同名群組就不要覆寫，換一個新名字；這一版不能更新舊組。牌必須屬於該類別，不屬於的會被跳過。建完不會自動勾上，要套用再另外呼叫 set_group_picks。使用者說「先幫我想」時不要呼叫。不要把未成年或禁用角色放進群組。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "section", "tags"],
      properties: {
        name: { ...str, description: "新名字，最多 40 字。不要用這個類別裡已經有的名字" },
        section: { type: "string", enum: SECTIONS },
        tags: { ...strList, description: "要放進這組的 tag，最多 120 張，而且都要屬於這個類別" },
      },
    },
  },
  {
    name: "draw_cards",
    kind: "write",
    description: "使用者明確要抽這一輪、抽牌、或「抽三張」（沒有說要改以後每一次）時才呼叫。n 省略就用畫面現在的一次，只影響這一輪，不會把「一次」的設定改掉。不要生圖。不要在使用者只是問會抽到什麼時真的抽。抽完若要改池子，等使用者下一句交代。",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { n: { type: "integer", minimum: 1, maximum: 50, description: "這一輪抽幾張。不傳就用目前的一次，而且不寫回設定" } },
    },
  },
];

const byName = new Map(TOOL_DEFS.map((t) => [t.name, t]));

export function toolSchemas() {
  return TOOL_DEFS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
}

function baselineOf(turn) {
  if (typeof turn === "number" && Number.isFinite(turn)) return turn;
  if (turn && typeof turn === "object" && typeof turn.version === "number" && Number.isFinite(turn.version)) return turn.version;
  return null;
}

export function createToolRunner(ctx) {
  // 同一個 call.id 重送不能再做一次：模型超时重試時池子會被加兩遍。
  const settled = new Map();
  const inflight = new Map();
  // 助手自己寫入造成的版本推進。鍵是這一輪模型看到的版本，值是我們最後寫到的版本。
  const progressed = new Map();
  const plans = new Map();
  const staleWrite = Symbol();
  let planGeneration = 0;
  let seq = 0;

  function isStale(base) {
    if (base == null) return false;
    let cur;
    try { cur = ctx.version(); } catch { return true; }
    if (cur === base) return false;
    // 這一輪前面的工具已經把版本推進到 cur：那是我們自己寫的，不是使用者。
    if (progressed.get(base) === cur) return false;
    return true;
  }

  function note(base, result) {
    if (base != null && Number.isFinite(result?.version)) progressed.set(base, result.version);
  }

  function staleResult(target) {
    return fail(target, "stale", TEXT.stale, { model: { message: "工作台已經變了，請先 get_workspace 再寫入。" } });
  }

  function resolvedTag(tag) {
    // 原字若在封鎖表，不能被另一張同名的牌洗掉封鎖理由。
    const key = norm(tag);
    return HARD.has(key) || MINOR_RE.test(key) ? tag : ctx.resolveTag?.(tag) ?? tag;
  }

  function resolvedTags(tags) {
    return [...new Set(tags.map(resolvedTag))];
  }

  function zhOf(tag) {
    try {
      const info = ctx.cardInfo(tag);
      if (info && typeof info === "object" && typeof info.then !== "function" && info.zh) return info.zh;
    } catch { /* 名稱只是顯示 */ }
    try {
      const st = ctx.state();
      if (st && typeof st === "object" && typeof st.then !== "function") {
        const hit = (st.pool || []).find((p) => p.tag === tag);
        if (hit?.zh) return hit.zh;
      }
    } catch { /* 同上 */ }
    return String(tag ?? "");
  }

  // 英文介面用逗號分隔（「、」在英文裡是怪字）。
  function sep() {
    try {
      const st = ctx.state();
      return st && typeof st.then !== "function" && /^en/.test(String(st.lang || "")) ? ", " : "、";
    } catch {
      return "、";
    }
  }

  function joinZh(tags) {
    return (tags || []).map((t) => zhOf(t)).join(sep());
  }

  function targetFor(name, args = {}) {
    switch (name) {
      case "get_workspace":
      case "change_pool":
      case "paste_prompt":
      case "use_reference":
        return { area: "pool" };
      case "find_cards":
      case "suggest_cards":
      case "suggest_check":
        return { area: "lib" };
      case "card_info":
        return args.tag ? { area: "lib", key: args.tag } : { area: "lib" };
      case "set_draw_count":
        return { area: "rules", key: "n" };
      case "set_section_counts": {
        const keys = SECTIONS.filter((k) => Object.prototype.hasOwnProperty.call(args, k));
        return { area: "rules", key: keys.length === 1 ? keys[0] : "counts" };
      }
      case "list_groups":
      case "set_group_picks":
      case "save_card_group":
        return args.section && SECTIONS.includes(args.section) ? { area: "groups", key: args.section } : { area: "groups" };
      case "draw_cards":
      case "find_works":
        return { area: "wall" };
      default:
        return { area: "pool" };
    }
  }

  function pack(spec) {
    const out = {
      ok: spec.ok,
      status: spec.status,
      summary: spec.summary || "",
      lines: capLines(spec.lines || []),
      target: spec.target || { area: "pool" },
      forModel: spec.forModel || { ok: spec.ok },
    };
    if (spec.undo) out.undo = spec.undo;
    if (spec.confirm) out.confirm = spec.confirm;
    // 給畫面的：操作紀錄（每列一個動詞＋值）、操作紀錄之外還要說的話（notes）、推薦的牌（cards）。
    if (spec.ops?.length) out.ops = spec.ops;
    if (spec.notes?.length) out.notes = capLines(spec.notes);
    if (spec.cards?.length) out.cards = spec.cards;
    if (spec.found?.length) out.found = spec.found;
    if (spec.works?.length) out.works = spec.works;
    if (spec.trace) out.trace = spec.trace;
    if (spec.changes) out.changes = spec.changes;
    return out;
  }

  function fail(target, code, summary, extra = {}) {
    return pack({
      ok: false,
      status: "failed",
      summary,
      lines: extra.lines,
      target,
      forModel: { ok: false, code, ...(extra.model || {}) },
    });
  }

  function skip(target, summary, extra = {}) {
    const ok = extra.ok !== false;
    return pack({
      ok,
      status: "skipped",
      summary,
      lines: extra.lines,
      target,
      forModel: { ok, status: "skipped", ...(extra.code ? { code: extra.code } : {}), ...(extra.model || {}) },
    });
  }

  async function hi(target, phase, text) {
    try {
      if (typeof ctx.highlight === "function") await ctx.highlight(target, phase, text);
    } catch { /* 高亮壞了不能讓這一步失敗 */ }
  }

  async function blockReason(tag, depth = 0) {
    const n = norm(tag);
    if (!n) return null;
    // 安全理由優先於「詞庫沒有」：先看禁用表和句子，再看 ctx 標的 minor／禁用角色。
    // cardInfo 即使回 minor:false（橋接目前固定這樣）也不能把 loli 放行。
    if (HARD.has(n) || MINOR_RE.test(n)) return "minor";
    let info = null;
    try { info = await ctx.cardInfo(tag); } catch { info = null; }
    if (info?.minor) return "minor";
    if (info?.bannedChar) return "banned";
    if (depth === 0 && Array.isArray(info?.members)) {
      for (const m of info.members) {
        const sub = typeof m === "string" ? m : m?.tag;
        if (!sub) continue;
        const r = await blockReason(sub, 1);
        if (r) return r;
      }
    }
    return null;
  }

  function whyText(reason) {
    return reason === "banned" ? TEXT.whyBanned : TEXT.whyMinor;
  }

  function cannot(tag, reason) {
    return fill(TEXT.cannotUse, zhOf(tag), whyText(reason));
  }

  async function knownInfo(tag, state) {
    const info = await ctx.cardInfo(tag);
    if (info) return info;
    const hit = (state?.pool || []).find((p) => p.tag === tag && p.custom);
    if (hit) return { tag, zh: hit.zh, custom: true, members: hit.members, section: hit.section || null };
    return null;
  }

  function label(call) {
    const name = call?.name;
    const args = call?.args && typeof call.args === "object" ? call.args : {};
    try {
      if (name === "get_workspace") return { zh: TEXT.labWorkspace, area: "pool" };
      if (name === "use_reference") return { zh: WORK_TEXT.labReference, area: "pool" };
      if (name === "find_works") return { zh: WORK_TEXT.labFindWorks, area: "wall" };
      if (name === "trace_card") return { zh: WORK_TEXT.labTrace, area: "pool" };
      if (name === "find_cards") return { zh: fill(TEXT.labSearch, typeof args.query === "string" ? args.query.trim() : ""), area: "lib" };
      if (name === "card_info") return { zh: fill(TEXT.labCard, zhOf(typeof args.tag === "string" ? resolvedTag(args.tag.trim()) : args.tag)), area: "lib" };
      if (name === "suggest_check") return { zh: TEXT.labCheck, area: "lib" };
      if (name === "suggest_cards") return { zh: TEXT.labSuggest, area: "lib" };
      if (name === "set_draw_count") return { zh: fill(TEXT.labN, args.n), area: "rules" };
      if (name === "set_section_counts") {
        const keys = SECTIONS.filter((k) => Object.prototype.hasOwnProperty.call(args, k));
        if (keys.length === 1) return { zh: fill(TEXT.labCount, SECTION_ZH[keys[0]], args[keys[0]]), area: "rules" };
        return { zh: TEXT.labCounts, area: "rules" };
      }
      if (name === "list_groups") return { zh: TEXT.labGroups, area: "groups" };
      if (name === "set_group_picks") return { zh: fill(TEXT.labPicks, SECTION_ZH[args.section] || ""), area: "groups" };
      if (name === "save_card_group") return { zh: fill(TEXT.labSave, typeof args.name === "string" ? args.name.trim() : ""), area: "groups" };
      if (name === "draw_cards") {
        if (isInt(args.n)) return { zh: fill(TEXT.labDrawN, args.n), area: "wall" };
        try {
          const st = ctx.state();
          if (st && typeof st.then !== "function" && isInt(st.settings?.n)) return { zh: fill(TEXT.labDrawN, st.settings.n), area: "wall" };
        } catch { /* 沒讀到就用籠統的那句 */ }
        return { zh: TEXT.labDraw, area: "wall" };
      }
      if (name === "paste_prompt") {
        const n = typeof args.prompt === "string" ? args.prompt.split(/[,，、\n]+/).filter((s) => s.trim()).length : 0;
        return { zh: fill(TEXT.labPaste, n), area: "pool" };
      }
      if (name === "change_pool") {
        const add = Array.isArray(args.add) ? args.add.filter((t) => typeof t === "string" && t.trim()) : [];
        const remove = Array.isArray(args.remove) ? args.remove.filter((t) => typeof t === "string" && t.trim()) : [];
        const wkeys = args.weights && typeof args.weights === "object" && !Array.isArray(args.weights) ? Object.keys(args.weights) : [];
        if (add.length === 1 && !remove.length && !wkeys.length) return { zh: fill(TEXT.labAdd, zhOf(resolvedTag(add[0].trim()))), area: "pool" };
        if (!add.length && remove.length === 1 && !wkeys.length) return { zh: fill(TEXT.labRemove, zhOf(resolvedTag(remove[0].trim()))), area: "pool" };
        if (!add.length && !remove.length && wkeys.length === 1) return { zh: fill(TEXT.labWeight, zhOf(resolvedTag(wkeys[0].trim()))), area: "pool" };
        return { zh: TEXT.labPool, area: "pool" };
      }
    } catch { /* 名稱失敗仍要回一個區域，畫面才知道亮哪裡 */ }
    return { zh: TEXT.labGeneric, area: targetFor(name, args).area };
  }

  function undoWrap(fn) {
    return async () => {
      try {
        return await fn();
      } catch {
        return { ok: false, reason: TEXT.failed, summary: TEXT.failed };
      }
    };
  }

  function undoN(from, to) {
    return undoWrap(async () => {
      const st = await ctx.state();
      if (st.settings?.n !== to) return { ok: false, reason: TEXT.undoN, summary: TEXT.undoN };
      await ctx.setN(from);
      return { ok: true, restored: true, summary: TEXT.restored };
    });
  }

  function undoCounts(changes) {
    return undoWrap(async () => {
      const st = await ctx.state();
      const patch = {};
      const off = {};
      for (const ch of changes) {
        const current = (st.settings?.offGroups || []).filter((key) => key.startsWith(`${ch.section}:`)).sort();
        if (st.settings?.counts?.[ch.section] !== ch.to || !sameList(current, [...ch.toOffGroups].sort())) {
          const reason = fill(TEXT.undoTag, SECTION_ZH[ch.section] || ch.section);
          return { ok: false, reason, summary: reason };
        }
        patch[ch.section] = ch.from;
        off[ch.section] = ch.fromOffGroups;
      }
      await ctx.setSectionCounts(patch, off);
      return { ok: true, restored: true, summary: TEXT.restored };
    });
  }

  function undoPicks(section, to, from) {
    return undoWrap(async () => {
      const st = await ctx.state();
      const cur = st.settings?.groups?.[section];
      const ids = cur?.ids || [];
      const mode = cur?.mode || "whole";
      if (!sameList(ids, to.ids || []) || mode !== (to.mode || "whole")) {
        const reason = fill(TEXT.undoTag, SECTION_ZH[section] || section);
        return { ok: false, reason, summary: reason };
      }
      await ctx.setGroupPicks(section, from.ids || [], from.mode || "whole");
      return { ok: true, restored: true, summary: TEXT.restored };
    });
  }

  // 只盯這一筆動過的牌。旁邊多出來的牌不擋復原；被改過份量或被人移走的就不蓋回去。
  function undoPool(expect, restore) {
    return undoWrap(async () => {
      const st = await ctx.state();
      const now = new Map((st.pool || []).map((p) => [p.tag, p]));
      const reban = restore.reban;
      const changedBan = reban?.find((tag) => st.bans?.includes(tag));
      if (changedBan) {
        const reason = fill(TEXT.undoTag, zhOf(changedBan));
        return { ok: false, reason, summary: reason };
      }
      for (const [tag, exp] of expect) {
        const cur = now.get(tag);
        if (exp.present) {
          if (!cur || (exp.weight != null && !sameW(cur.weight, exp.weight))) {
            const reason = fill(TEXT.undoTag, zhOf(tag));
            return { ok: false, reason, summary: reason };
          }
        } else if (cur) {
          const reason = fill(TEXT.undoTag, zhOf(tag));
          return { ok: false, reason, summary: reason };
        }
      }
      // 釘回去會擠掉這一步以外的牌（後來才放的黑髮），或超過 40 張：保留現況，說清楚為什麼。
      if (restore.repin.length) {
        const pv = await ctx.previewPins(restore.repin.map((x) => x.tag), restore.unpin);
        const clash = (pv?.displaced || []).filter((t) => !restore.unpin.includes(t));
        if (clash.length) {
          const reason = fill(TEXT.undoClash, joinZh(clash));
          return { ok: false, reason, summary: reason };
        }
        if (reban && pv?.unbanned?.length) {
          const reason = fill(TEXT.undoTag, zhOf(pv.unbanned[0]));
          return { ok: false, reason, summary: reason };
        }
        if (pv?.final && Number(pv.total) > POOL_CAP) return { ok: false, reason: TEXT.undoOver, summary: TEXT.undoOver };
      }
      if (restore.unpin.length) await ctx.unpin(restore.unpin);
      if (restore.repin.length) await ctx.pin(restore.repin.map((x) => x.tag));
      if (reban?.length) await ctx.restoreReferenceBans(reban);
      for (const item of [...restore.repin, ...restore.reweight]) {
        const st2 = await ctx.state();
        const cur = (st2.pool || []).find((p) => p.tag === item.tag);
        if (cur && !sameW(cur.weight, item.weight)) await ctx.setWeight(item.tag, item.weight);
      }
      return { ok: true, restored: true, summary: TEXT.restored };
    });
  }

  async function readWorkspace() {
    const st = await ctx.state();
    let version = null;
    try { version = ctx.version(); } catch { version = null; }
    const counts = st.settings?.counts || {};
    const settings = {
      ...(st.settings || {}),
      counts: { ...counts },
      groups: st.settings?.groups ? structuredClone(st.settings.groups) : {},
      heats: [...(st.settings?.heats || [])],
      eras: [...(st.settings?.eras || [])],
    };
    const summary = !st.ready
      ? TEXT.notReady
      : !st.poolCount
        ? fill(TEXT.poolEmpty, settings.n)
        : fill(TEXT.poolSum, st.poolCount, settings.n);
    return {
      summary,
      lines: [fill(TEXT.countsLine, counts.feature ?? 0, counts.clothing ?? 0, counts.pose ?? 0, counts.env ?? 0)],
      forModel: {
        room: st.room,
        ready: !!st.ready,
        lang: st.lang,
        pool: (st.pool || []).map((p) => ({
          tag: p.tag,
          zh: p.zh,
          weight: p.weight,
          ...(p.custom ? { custom: true } : {}),
          ...(p.members ? { members: [...p.members] } : {}),
        })),
        poolCount: st.poolCount,
        bans: [...(st.bans || [])],
        settings,
        infinite: !!st.infinite,
        lastBatch: st.lastBatch || null,
        version,
      },
    };
  }

  // 預覽的 total 已含加入和被擠掉的結果。再扣掉這次點名移走、而且沒有被附帶加回來的牌。
  // 自製牌的外殼本身不算張數，移走時改扣它的成員。
  function projectTotal(state, preview, removes) {
    // 頁面的預覽已經照真的順序（先拿掉、再釘）算好最後張數。
    if (preview?.final && Number.isFinite(Number(preview.total))) return Number(preview.total);
    const counted = new Set((state.pool || []).filter((p) => !p.custom).map((p) => p.tag));
    const dropping = [];
    for (const tag of removes) {
      const p = (state.pool || []).find((x) => x.tag === tag);
      if (!p) continue;
      if (p.custom) {
        for (const m of p.members || []) dropping.push(typeof m === "string" ? m : m?.tag);
      } else dropping.push(tag);
    }
    const coming = new Set([...(preview?.added || []), ...(preview?.companions || [])]);
    const gone = new Set(preview?.displaced || []);
    let total = preview ? Number(preview.total) : Number(state.poolCount);
    if (!Number.isFinite(total)) total = counted.size;
    for (const tag of dropping) {
      if (!tag || !counted.has(tag)) continue;
      if (preview && (coming.has(tag) || gone.has(tag))) continue;
      counted.delete(tag);
      total -= 1;
    }
    return total;
  }

  function replaceableOf(state) {
    return (state.pool || [])
      .filter((p) => !p.custom)
      .map((p) => ({ tag: p.tag, zh: p.zh || zhOf(p.tag), weight: p.weight }))
      .sort((a, b) => (a.weight - b.weight) || String(a.tag).localeCompare(String(b.tag)));
  }

  function limitLines(total, state) {
    const list = replaceableOf(state);
    const shown = list.slice(0, LINE_CAP).map((p) => p.zh || p.tag);
    const lines = [fill(TEXT.over40, total)];
    if (shown.length) lines.push(fill(TEXT.swap, shown.join("、")));
    if (list.length > shown.length) lines.push(fill(TEXT.moreCards, list.length - shown.length));
    return { lines, replaceable: list };
  }

  function confirmPrompt(preview) {
    const disp = preview.displaced || [];
    const unb = preview.unbanned || [];
    const added = preview.added || [];
    if (disp.length && unb.length) return fill(TEXT.confirmBoth, joinZh(disp), joinZh(unb));
    if (disp.length) return fill(TEXT.confirmDisplace, added.length ? zhOf(added[0]) : joinZh(disp), disp.length === 1 ? zhOf(disp[0]) : joinZh(disp));
    if (unb.length) return fill(TEXT.confirmUnban, unb.length === 1 ? zhOf(unb[0]) : joinZh(unb));
    return TEXT.confirmGeneric;
  }

  async function mutatePool(state, add, removes, weights, from, write, canWrite) {
    const before = new Map((state.pool || []).map((p) => [p.tag, p]));
    const toUnpin = removes.filter((t) => before.has(t));
    let removedNow = [];
    let pinned = { added: [], companions: [], displaced: [], unbanned: [] };
    try {
      if (toUnpin.length) {
        const r = await write(() => ctx.unpin(toUnpin));
        removedNow = r?.removed || [...toUnpin];
      }
      if (add.length) pinned = (await write(() => ctx.pin(add, from ? { from } : undefined))) || pinned;
      const weightResult = [];
      const afterPin = await ctx.state();
      const have = new Map((afterPin.pool || []).map((p) => [p.tag, p]));
      for (const [tag, w] of weights) {
        const cur = have.get(tag);
        if (!cur) continue;
        if (sameW(cur.weight, w)) continue;
        const wr = await write(() => ctx.setWeight(tag, w));
        weightResult.push({ tag, from: wr?.from ?? cur.weight, to: wr?.to ?? w });
        cur.weight = wr?.to ?? w;
      }
      const after = await ctx.state();
      return { pinned, removedNow, weightResult, before, after };
    } catch (err) {
      // 先移掉再釘上時，釘上失敗要把剛剛移掉的補回去，避免池子停在半套。
      if (removedNow.length && err !== staleWrite && canWrite()) {
        try { await ctx.pin(removedNow); } catch { /* 補不回就失敗，模型重讀 */ }
      }
      throw err;
    }
  }

  function poolStory(mut, pasted = false, restoreBans = false) {
    const added = mut.pinned?.added || [];
    const companions = mut.pinned?.companions || [];
    const displaced = mut.pinned?.displaced || [];
    const unbanned = mut.pinned?.unbanned || [];
    const reban = restoreBans && typeof ctx.restoreReferenceBans === "function" ? unbanned : null;
    const lines = [];
    if (!pasted) for (const tag of added) lines.push(fill(TEXT.added, zhOf(tag)));
    if (companions.length) lines.push(fill(TEXT.companion, joinZh(companions)));
    for (const tag of mut.removedNow || []) {
      if (!displaced.includes(tag)) lines.push(fill(TEXT.removed, zhOf(tag)));
    }
    for (const tag of displaced) lines.push(fill(TEXT.wouldRemove, zhOf(tag)));
    for (const w of mut.weightResult || []) lines.push(fill(TEXT.weightChange, zhOf(w.tag), w.from, w.to));
    for (const tag of unbanned) lines.push(cannot(tag, "banned") && fill(TEXT.confirmUnban, zhOf(tag)));
    const back = (mut.removedNow || []).filter((t) => companions.includes(t) || added.includes(t));
    for (const tag of back) lines.push(fill(TEXT.companionBack, zhOf(tag)));
    if (unbanned.length && !reban) lines.push(TEXT.noBanUndo);
    // 操作紀錄：加入／附帶／移掉／份量／撿回各一列；其他要提醒的（附帶的會跟回來、廢字簍不能復原）放 notes。
    const ops = [];
    if (added.length) ops.push({ k: TEXT.opAdd, v: joinZh(added), raw: true });
    if (companions.length) ops.push({ k: TEXT.opCompanion, v: joinZh(companions), raw: true });
    const gone = [...new Set([...(mut.removedNow || []), ...displaced])];
    if (gone.length) ops.push({ k: TEXT.opRemove, v: joinZh(gone), raw: true });
    for (const w of (mut.weightResult || []).slice(0, 4)) ops.push({ k: TEXT.opWeight, v: `${zhOf(w.tag)} ${w.from} → ${w.to}`, raw: true });
    if ((mut.weightResult || []).length > 4) ops.push({ k: TEXT.opWeight, v: fill(TEXT.moreItems, mut.weightResult.length - 4) });
    if (unbanned.length) ops.push({ k: TEXT.opUnban, v: joinZh(unbanned), raw: true });
    const notes = back.map((tag) => fill(TEXT.companionBack, zhOf(tag)));
    if (unbanned.length && !reban) notes.push(TEXT.noBanUndo);
    let summary;
    if (added.length === 1 && companions.length && !(mut.weightResult || []).length && !(mut.removedNow || []).length) {
      summary = fill(TEXT.withCompanion, zhOf(added[0]), joinZh(companions));
    } else if (added.length === 1 && !companions.length && !(mut.weightResult || []).length && !(mut.removedNow || []).length && !displaced.length) {
      summary = fill(TEXT.added, zhOf(added[0]));
    } else if (!added.length && (mut.removedNow || []).length === 1 && !(mut.weightResult || []).length && !displaced.length) {
      summary = fill(TEXT.removed, zhOf(mut.removedNow[0]));
    } else if (!added.length && (mut.weightResult || []).length === 1 && !(mut.removedNow || []).length) {
      const w = mut.weightResult[0];
      summary = fill(TEXT.weightChange, zhOf(w.tag), w.from, w.to);
    } else summary = TEXT.poolAdjusted;
    const expect = new Map();
    const afterMap = new Map((mut.after.pool || []).map((p) => [p.tag, p]));
    const newly = [...added, ...companions];
    for (const tag of newly) {
      const p = afterMap.get(tag);
      expect.set(tag, { present: true, weight: p ? p.weight : 1 });
    }
    for (const tag of mut.removedNow || []) if (!newly.includes(tag)) expect.set(tag, { present: false });
    for (const tag of displaced) if (!newly.includes(tag)) expect.set(tag, { present: false });
    for (const w of mut.weightResult || []) {
      if (!expect.has(w.tag)) expect.set(w.tag, { present: true, weight: w.to });
    }
    const repin = [];
    for (const tag of new Set([...(mut.removedNow || []), ...displaced])) {
      if (newly.includes(tag)) continue;
      const prev = mut.before.get(tag);
      if (prev) repin.push({ tag, weight: prev.weight ?? 1 });
    }
    const reweight = (mut.weightResult || [])
      .filter((w) => mut.before.has(w.tag) && !newly.includes(w.tag))
      .map((w) => ({ tag: w.tag, weight: mut.before.get(w.tag).weight ?? 1 }));
    const undo = unbanned.length && !reban || !expect.size && !reban?.length
      ? undefined
      : undoPool(expect, { unpin: newly.filter((t) => !mut.before.has(t)), repin, reweight, reban });
    return { summary, lines, undo, added, companions, displaced, unbanned, ops, notes };
  }

  function pasteChanges(mut) {
    const after = new Set((mut.after.pool || []).map((p) => p.tag));
    const added = [...after].filter((t) => !mut.before.has(t)).length;
    const removed = [...mut.before.keys()].filter((t) => !after.has(t)).length;
    const weights = mut.weightResult.filter((w) => mut.before.has(w.tag) && after.has(w.tag));
    const n = weights.length;
    const counts = { added, weights: n, removed };
    if ([added, n, removed].filter(Boolean).length > 1) return { summary: fill(TEXT.pasteChanges, added, n, removed), counts };
    if (added) return { summary: fill(TEXT.pasteSum, added), counts };
    if (removed) return { summary: fill(TEXT.pasteRemoves, removed), counts };
    if (n === 1) {
      const { tag, from, to } = weights[0];
      return { summary: fill(TEXT.weightChange, zhOf(tag), from, to), counts };
    }
    return { summary: n ? fill(TEXT.pasteWeights, n) : TEXT.poolSame, counts };
  }

  async function commitPool(planLike, base, target, labelText) {
    const state = await ctx.state();
    await hi(target, "write", labelText);
    let expected = planLike.seen;
    const canWrite = () => expected == null ? !isStale(base) : ctx.version() === expected;
    const write = async (fn) => {
      if (!canWrite()) throw staleWrite;
      const r = await fn();
      if (Number.isFinite(r?.version)) expected = r.version;
      note(base, r);
      return r;
    };
    try {
      const mut = await mutatePool(state, planLike.add, planLike.remove, planLike.weights, planLike.from, write, canWrite);
      await hi(target, "done", labelText);
      const story = poolStory(mut, planLike.paste, !!planLike.reference);
      const paste = planLike.paste ? pasteChanges(mut) : null;
      const finalTags = new Set((mut.after.pool || []).map((p) => p.tag));
      const weights = (mut.weightResult || []).map((w) => ({ tag: w.tag, from: w.from, to: w.to }));
      const changes = {
        added: [...finalTags].filter((tag) => !mut.before.has(tag)),
        removed: [...mut.before.keys()].filter((tag) => !finalTags.has(tag)),
        weights,
      };
      const requested = planLike.reference;
      const kept = requested?.cards.filter((card) => finalTags.has(card.tag));
      const omitted = requested?.cards.filter((card) => !finalTags.has(card.tag)).map((card) => card.tag);
      const reference = requested && {
        id: requested.id,
        sections: SECTIONS.filter((section) => kept.some((card) => card.section === section)),
        count: kept.length,
        ...(omitted.length ? { omitted } : {}),
      };
      const referenceOp = reference?.count && {
        k: fill(WORK_TEXT.referenceOp, reference.id),
        v: fill(WORK_TEXT.referenceSections, reference.sections.map((section) => ctx.sectionName?.(section) || SECTION_ZH[section]).join(sep()), reference.count),
      };
      const total = mut.after.poolCount;
      return pack({
        ok: true,
        status: "done",
        summary: paste?.summary || story.summary,
        lines: story.lines,
        ops: referenceOp ? [referenceOp, ...story.ops] : story.ops,
        notes: omitted?.length ? [...story.notes, fill(WORK_TEXT.referenceOmitted, joinZh(omitted))] : story.notes,
        changes,
        target,
        undo: story.undo,
        forModel: {
          ok: true,
          added: story.added,
          companions: story.companions,
          displaced: story.displaced,
          unbanned: story.unbanned,
          removed: mut.removedNow,
          weights,
          total,
          ...(paste ? { pasted: { changes: paste.counts } } : {}),
          ...(reference ? { reference } : {}),
          undoable: !!story.undo,
        },
      });
    } catch (err) {
      await hi(target, "clear", labelText);
      if (err === staleWrite) return staleResult(target);
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function getWorkspace() {
    const target = { area: "pool" };
    await hi(target, "read", TEXT.labWorkspace);
    try {
      const data = await readWorkspace();
      await hi(target, "clear", TEXT.labWorkspace);
      return pack({ ok: true, status: "done", summary: data.summary, lines: data.lines, target, forModel: { ok: true, ...data.forModel } });
    } catch (err) {
      await hi(target, "clear", TEXT.labWorkspace);
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function findCards(args) {
    const target = { area: "lib" };
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) return fail(target, "bad_args", TEXT.emptyQuery);
    if (Object.prototype.hasOwnProperty.call(args, "limit") && (!isInt(args.limit) || args.limit < 1 || args.limit > 20)) {
      return fail(target, "bad_args", TEXT.badLimit);
    }
    if (Object.prototype.hasOwnProperty.call(args, "section") && !SEARCH_SECTIONS.includes(args.section)) {
      return fail(target, "bad_args", TEXT.badSection);
    }
    const limit = Object.prototype.hasOwnProperty.call(args, "limit") ? args.limit : 8;
    if (Object.prototype.hasOwnProperty.call(args, "also") && (!Array.isArray(args.also) || args.also.length > 15 || args.also.some((x) => typeof x !== "string"))) {
      return fail(target, "bad_args", TEXT.badArgs);
    }
    const also = [...new Set((args.also || []).map((x) => x.trim()).filter((x) => x && x !== query))];
    const opt = { limit };
    if (args.section) opt.section = args.section;
    await hi(target, "read", fill(TEXT.labSearch, [query, ...also].join("、")));
    try {
      // 好幾個說法：每個都查（各取最多 40 張好算總數），照順序合併、同一張只留一次。
      let cards;
      let total;
      let atLeast = false;
      // 全部找到的 tag（不受 limit）：給畫面的「看這 N 張」，不送給模型。
      let found = [];
      const groups = new Set();
      if (!also.length) {
        cards = (await ctx.search(resolvedTag(query), { ...opt, raw: query })) || [];
        total = Number.isFinite(cards.total) ? cards.total : cards.length;
        found = Array.isArray(cards.allTags) ? cards.allTags : cards.map((c) => c?.tag).filter(Boolean);
        for (const g of cards.groups || []) groups.add(g);
      } else {
        const merged = new Map();
        const every = new Set();
        let capped = false;
        for (const q of [query, ...also]) {
          const got = (await ctx.search(resolvedTag(q), { ...opt, limit: 40, raw: q })) || [];
          if ((got.total ?? got.length) > got.length) capped = true;
          for (const g of got.groups || []) groups.add(g);
          for (const c of got) if (c?.tag && !merged.has(c.tag)) merged.set(c.tag, c);
          for (const t of Array.isArray(got.allTags) ? got.allTags : got.map((c) => c?.tag)) if (t) every.add(t);
        }
        const all = [...merged.values()];
        found = [...every];
        // 每個說法的全部結果都拿得到（allTags）就是精確總數；拿不到才退回只算列出來的。
        total = Math.max(all.length, found.length);
        if (found.length >= all.length && capped && found.length > 0) capped = false;
        // 有一個說法就超過 40 張：總數是「至少」，不是精確值。
        if (capped) (total = Math.max(total, 40)), (atLeast = true);
        cards = all.slice(0, limit);
      }
      // 使用者的說法常比牌名長一點（「脫衣服」→ 牌叫「正在脫衣」）：字盒的搜尋整句沒有就照較短的片段找，
      // 找到的牌帶 via（用到的那段）。要明白告訴模型，推理開得低時它找不到常常不會自己換說法。
      const near = cards.find((c) => c?.via)?.via || null;
      await hi(target, "clear");
      const lines = [];
      for (const card of cards) {
        if (!card?.blocked) continue;
        lines.push(fill(TEXT.blockedBy, card.zh || zhOf(card.tag), GATE_ZH[card.blocked] || card.blocked));
      }
      return pack({
        ok: true,
        status: "done",
        summary: near ? fill(TEXT.foundNear, near, total) : total > cards.length ? fill(TEXT.foundTotal, total, cards.length) : cards.length ? fill(TEXT.foundN, cards.length) : TEXT.foundNone,
        lines,
        target,
        found: found.slice(0, 400),
        forModel: {
          ok: true,
          cards,
          count: cards.length,
          total,
          ...(atLeast ? { atLeast: true } : {}),
          ...(groups.size ? { groups: [...groups], groupNote: "這些小分類整類都算進來了（牌上 match 為 group）。要列出全部，提高 limit 或分類別查。" } : {}),
          ...(near ? { near, note: `「${query}」沒有完全相符的牌；這些是照「${near}」找到的，挑意思對的用。` } : {}),
        },
      });
    } catch (err) {
      await hi(target, "clear");
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function cardInfo(args) {
    const tag = typeof args.tag === "string" ? resolvedTag(args.tag.trim()) : "";
    const target = tag ? { area: "lib", key: tag } : { area: "lib" };
    if (!tag) return fail(target, "bad_args", TEXT.badArgs);
    const reason = await blockReason(tag);
    await hi(target, "read", fill(TEXT.labCard, zhOf(tag)));
    try {
      const info = await knownInfo(tag, await ctx.state());
      await hi(target, "clear");
      if (!info) {
        if (reason) {
          return pack({
            ok: true,
            status: "done",
            summary: cannot(tag, reason),
            lines: [cannot(tag, reason)],
            target,
            forModel: { ok: true, found: false, tag, blocked: true, reason },
          });
        }
        return pack({
          ok: true,
          status: "done",
          summary: fill(TEXT.noCard, tag),
          lines: [],
          target,
          forModel: { ok: true, found: false, tag },
        });
      }
      const lines = [];
      if (reason) lines.push(cannot(tag, reason));
      const sectionZh = SECTION_ZH[info.section] || "";
      return pack({
        ok: true,
        status: "done",
        summary: sectionZh ? fill(TEXT.cardIs, info.zh || tag, sectionZh) : fill(TEXT.labCard, info.zh || tag),
        lines,
        target,
        forModel: {
          ok: true,
          found: true,
          tag: info.tag,
          zh: info.zh,
          section: info.section,
          suit: info.suit,
          sub: info.sub,
          rating: info.rating,
          companions: info.companions || [],
          mutex: info.mutex || [],
          minor: !!info.minor,
          bannedChar: !!info.bannedChar,
          blocked: reason || info.blocked || null,
          inPool: info.inPool,
          weight: info.weight,
        },
      });
    } catch (err) {
      await hi(target, "clear");
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  /**
   * 推薦卡：模型挑的牌照詞庫認一次，排得出來的才給畫面（卡面＋一句理由＋「加入」）。
   * 不加入任何牌。已經在合成池、被擋著、詞庫沒有的略過，原因回給模型。
   */
  async function suggestCards(args) {
    const target = { area: "lib" };
    const raw = Array.isArray(args.cards) ? args.cards : null;
    if (!raw || !raw.length || raw.length > 6) return fail(target, "bad_args", TEXT.badArgs);
    await hi(target, "read", TEXT.labSuggest);
    try {
      const state = await ctx.state();
      const poolTags = new Set((state.pool || []).map((p) => p.tag));
      const cards = [];
      const skipped = [];
      const seen = new Set();
      for (const entry of raw) {
        const asked = typeof entry?.tag === "string" ? entry.tag.trim() : "";
        const why = typeof entry?.why === "string" ? entry.why.trim().slice(0, 60) : "";
        // 格式不對的那一項也要告訴模型（不然它以為都排出來了）。
        if (!asked) {
          skipped.push({ tag: null, reason: "bad_item" });
          continue;
        }
        const tag = resolvedTag(asked);
        // 去重照比對用的寫法：被擋的字 resolvedTag 回原字，Loli／loli 要算同一張。
        const key = norm(tag);
        if (seen.has(key)) continue;
        seen.add(key);
        const reason = await blockReason(tag);
        if (reason) {
          skipped.push({ tag, reason });
          continue;
        }
        const info = await knownInfo(tag, state);
        if (!info) skipped.push({ tag: asked, reason: "missing" });
        else if (poolTags.has(info.tag || tag)) skipped.push({ tag: info.tag || tag, reason: "in_pool" });
        else if (info.blocked) skipped.push({ tag: info.tag || tag, reason: info.blocked });
        else cards.push({ n: cards.length + 1, tag: info.tag || tag, zh: info.zh || zhOf(tag), why });
      }
      await hi(target, "clear");
      const named = skipped.filter((x) => x.tag);
      const notes = named.length ? [fill(TEXT.suggestSkip, named.map((x) => (x.reason === "missing" ? x.tag : zhOf(x.tag))).join(sep()))] : [];
      return pack({
        ok: true,
        status: "done",
        summary: cards.length ? fill(TEXT.suggestN, cards.length) : TEXT.suggestNone,
        lines: notes,
        notes,
        cards,
        target,
        forModel: { ok: true, shown: cards.map(({ n, tag, zh }) => ({ n, tag, zh })), skipped },
      });
    } catch (err) {
      await hi(target, "clear");
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function suggestCheck(args) {
    const target = { area: "lib" };
    const tags = tagList(args.tags);
    if (!tags || !tags.length) return fail(target, "bad_args", tags ? TEXT.needTag : TEXT.badArgs);
    await hi(target, "read", TEXT.labCheck);
    try {
      const state = await ctx.state();
      const poolTags = new Set((state.pool || []).map((p) => p.tag));
      const blocked = [];
      const usable = [];
      const inPool = [];
      const missing = [];
      for (const tag of resolvedTags(tags)) {
        const reason = await blockReason(tag);
        const info = await knownInfo(tag, state);
        if (reason) blocked.push({ tag, reason });
        else if (poolTags.has(tag)) inPool.push(tag);
        else if (!info) missing.push(tag);
        else if (info.blocked) blocked.push({ tag, reason: info.blocked });
        else usable.push(tag);
      }
      const preview = usable.length ? await ctx.previewPins(usable) : { added: [], companions: [], displaced: [], unbanned: [], total: state.poolCount };
      await hi(target, "clear");
      const total = projectTotal(state, usable.length ? preview : null, []);
      const lines = [];
      for (const b of blocked) {
        lines.push(WHY[b.reason] ? cannot(b.tag, b.reason) : fill(TEXT.blockedBy, zhOf(b.tag), GATE_ZH[b.reason] || b.reason));
      }
      for (const tag of missing) lines.push(fill(TEXT.noCard, tag));
      for (const tag of preview.displaced || []) lines.push(fill(TEXT.wouldRemove, zhOf(tag)));
      for (const tag of preview.unbanned || []) lines.push(fill(TEXT.confirmUnban, zhOf(tag)));
      if (preview.companions?.length) lines.push(fill(TEXT.companion, joinZh(preview.companions)));
      const over = total > POOL_CAP;
      if (over) lines.push(fill(TEXT.over40, total));
      const counts = fill(TEXT.checkCounts, usable.length, inPool.length, missing.length, blocked.length);
      const summary = over ? `${counts}・${fill(TEXT.over40, total)}` : counts;
      return pack({
        ok: true,
        status: "done",
        summary,
        lines,
        target,
        forModel: {
          ok: true,
          usable,
          inPool,
          missing,
          blocked,
          added: preview.added || [],
          companions: preview.companions || [],
          displaced: preview.displaced || [],
          unbanned: preview.unbanned || [],
          total,
          overLimit: over,
        },
      });
    } catch (err) {
      await hi(target, "clear");
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  function parsePool(args, target) {
    const addInput = tagList(args.add);
    const removeInput = tagList(args.remove);
    const weights = weightMap(args.weights);
    if (!addInput || !removeInput || weights.error) return { error: fail(target, "bad_args", TEXT.badArgs) };
    const add = resolvedTags(addInput);
    const remove = resolvedTags(removeInput);
    const removeSet = new Set(remove);
    for (const tag of add) if (removeSet.has(tag)) return { error: fail(target, "bad_args", TEXT.overlap) };
    const snapped = new Map();
    for (const [key, raw] of Object.entries(weights.map)) {
      const tag = resolvedTag(key);
      if (removeSet.has(tag)) return { error: fail(target, "bad_args", TEXT.overlapW) };
      const s = snapWeight(raw);
      if (!s.ok) return { error: fail(target, "bad_args", s.type ? TEXT.weightType : TEXT.weightRange) };
      if (snapped.has(tag) && snapped.get(tag) !== s.value) return { error: fail(target, "bad_args", TEXT.badArgs) };
      snapped.set(tag, s.value);
    }
    if (!add.length && !remove.length && !snapped.size) return { error: fail(target, "bad_args", TEXT.nothing) };
    return { add, remove, removeSet, weights: [...snapped] };
  }

  async function changePool(args, opts, base) {
    const target = { area: "pool" };
    const parsed = parsePool(args, target);
    if (parsed.error) return parsed.error;
    const { add, remove, removeSet, weights } = parsed;
    const state = await ctx.state();
    const poolTags = new Set((state.pool || []).map((p) => p.tag));
    const blocked = [];
    for (const tag of add) {
      const reason = await blockReason(tag);
      if (reason) blocked.push({ tag, reason });
    }
    for (const [tag] of weights) {
      const reason = await blockReason(tag);
      if (reason && !poolTags.has(tag)) blocked.push({ tag, reason });
    }
    if (blocked.length) {
      return fail(target, "blocked", cannot(blocked[0].tag, blocked[0].reason), {
        lines: blocked.map((b) => cannot(b.tag, b.reason)),
        model: { blocked },
      });
    }
    const missing = [];
    for (const tag of add) {
      if (await knownInfo(tag, state)) continue;
      missing.push(tag);
    }
    if (missing.length) {
      return fail(target, "missing", fill(TEXT.notInLex, zhOf(missing[0])), {
        lines: missing.map((t) => fill(TEXT.notInLex, t)),
        model: { missing },
      });
    }
    for (const [tag] of weights) {
      if (!poolTags.has(tag) && !add.includes(tag)) {
        return fail(target, "missing", fill(TEXT.notInPool, zhOf(tag)), { model: { tag } });
      }
    }
    const preview = add.length || remove.length ? await ctx.previewPins(add, remove) : null;
    if (opts.signal?.aborted) return skip(target, TEXT.aborted, { ok: false, code: "aborted" });
    if (isStale(base)) return staleResult(target);
    const total = projectTotal(state, preview, remove);
    if (total > POOL_CAP) {
      const lim = limitLines(total, state);
      await hi(target, "write", TEXT.labPool);
      await hi(target, "clear", TEXT.labPool);
      return fail(target, "pool_limit", fill(TEXT.over40, total), {
        lines: lim.lines,
        model: {
          total,
          limit: POOL_CAP,
          replaceable: lim.replaceable,
          added: preview?.added || [],
          companions: preview?.companions || [],
          displaced: preview?.displaced || [],
        },
      });
    }
    const surpriseD = (preview?.displaced || []).filter((t) => !removeSet.has(t));
    const surpriseU = (preview?.unbanned || []).filter((t) => !removeSet.has(t));
    const weightChanges = weights.filter(([tag, w]) => {
      const cur = (state.pool || []).find((p) => p.tag === tag);
      return !cur || !sameW(cur.weight, w);
    });
    const realRemove = remove.filter((t) => poolTags.has(t));
    const previewMoves = preview && ((preview.added || []).length || (preview.companions || []).length || (preview.displaced || []).length || (preview.unbanned || []).length);
    if (!previewMoves && !realRemove.length && !weightChanges.length) {
      const idle = remove.find((t) => !poolTags.has(t));
      return skip(target, idle && !add.length ? fill(TEXT.notInPool, zhOf(idle)) : TEXT.poolSame);
    }
    if (surpriseD.length || surpriseU.length) {
      if (opts.planGeneration !== planGeneration) return fail(target, "confirm_unknown", TEXT.confirmGone);
      const prompt = confirmPrompt({ ...preview, displaced: surpriseD, unbanned: surpriseU });
      const token = `cf${++seq}`;
      const plan = {
        token,
        callId: opts.callId || null,
        baseline: base,
        seen: ctx.version(),
        signal: opts.signal,
        target,
        add,
        remove,
        weights,
        paste: opts.paste,
        reference: opts.reference,
        from: opts.from || null,
        pending: null,
      };
      plans.set(token, plan);
      const lines = [
        ...surpriseD.map((t) => fill(TEXT.wouldRemove, zhOf(t))),
        ...surpriseU.map((t) => fill(TEXT.confirmUnban, zhOf(t))),
      ];
      if (preview?.companions?.length) lines.push(fill(TEXT.companion, joinZh(preview.companions)));
      await hi(target, "write", TEXT.labPool);
      return pack({
        ok: false,
        status: "needs_confirm",
        summary: prompt,
        lines,
        target,
        confirm: { token, prompt, choices: ["套用", TEXT.keep] },
        forModel: {
          ok: false,
          code: "needs_confirm",
          waiting: true,
          note: "還沒套用。等使用者選套用或保留原狀，不要再送一次同樣的寫入。",
          added: preview?.added || [],
          companions: preview?.companions || [],
          displaced: surpriseD,
          unbanned: surpriseU,
          total,
        },
      });
    }
    const name = opts.reference ? "use_reference" : "change_pool";
    return commitPool({ add, remove, weights, from: opts.from, paste: opts.paste, reference: opts.reference }, base, target, label({ name, args }).zh);
  }

  const workId = (id) => typeof id === "string" && id.trim().length <= 200 ? id.trim().replace(/^#/, "") : "";
  const validSections = (list) => Array.isArray(list) && list.length > 0 && list.every((key) => SECTIONS.includes(key));
  function dateArg(day) {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const time = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day;
  }

  async function useReference(args, opts, base) {
    const target = { area: "pool" };
    const id = workId(args.id);
    const { include, exclude } = args;
    if (!id || include !== undefined && !validSections(include) || exclude !== undefined && !validSections(exclude) || include && exclude) {
      return fail(target, "bad_args", TEXT.badArgs);
    }
    const work = await opts.referenceOf?.(id, opts.signal);
    if (!work) return fail(target, "reference_missing", WORK_TEXT.referenceMissing);
    const wanted = SECTIONS.filter((section) => (include ? include.includes(section) : !exclude?.includes(section)));
    const cards = work.cards.filter((card) => wanted.includes(card.section));
    if (!cards.length) return fail(target, "reference_empty", WORK_TEXT.referenceEmpty);
    const reference = { id, cards };
    return changePool({
      add: cards.map((card) => card.tag),
      weights: Object.fromEntries(cards.map(({ tag, weight }) => {
        const n = Number(weight);
        return [tag, Number.isFinite(n) ? Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, n)) : 1];
      })),
    }, { ...opts, reference }, base);
  }

  async function findWorks(args, { signal }) {
    const target = { area: "wall" };
    const { from, to, favorite, limit = 8 } = args;
    const tags = tagList(args.tags);
    if (!tags || tags.length > 24 || from !== undefined && !dateArg(from) || to !== undefined && !dateArg(to) ||
        from && to && from > to || favorite !== undefined && typeof favorite !== "boolean" || !isInt(limit) || limit < 1 || limit > 20) {
      return fail(target, "bad_args", TEXT.badArgs);
    }
    try {
      const { works, total } = await ctx.findWorks({ from, to, favorite, tags: resolvedTags(tags), limit }, signal);
      return pack({ ok: true, status: "done", summary: fill(WORK_TEXT.worksFound, total), target, works, forModel: { ok: true, total, works } });
    } catch {
      if (signal?.aborted) return skip(target, TEXT.aborted, { ok: false, code: "aborted" });
      return fail(target, "works_unavailable", WORK_TEXT.worksFailed);
    }
  }

  async function traceCard(args, opts) {
    const target = { area: "pool" };
    const tag = typeof args.tag === "string" && resolvedTag(args.tag.trim());
    const id = args.id === undefined ? null : workId(args.id);
    if (!tag || id === "") return fail(target, "bad_args", TEXT.badArgs);
    const reason = await blockReason(tag);
    if (reason) return fail(target, "blocked", cannot(tag, reason), { model: { reason } });
    const reference = id ? await opts.referenceOf?.(id, opts.signal) : null;
    if (id && !reference) return fail(target, "reference_missing", WORK_TEXT.referenceMissing);
    const trace = await ctx.traceReference(tag, reference);
    if (!trace) return fail(target, "missing", fill(TEXT.notInLex, zhOf(tag)), { model: { tag } });
    return pack({ ok: true, status: "done", summary: WORK_TEXT.traceTitle, target, trace, forModel: { ok: true, ...trace } });
  }

  /* ---------- 貼上提示詞（助手直接寫好一整串） ---------- */

  // 一段的原樣去掉權重、括號、底線：拿去字盒搜。
  function plainWord(raw) {
    let s = String(raw || "").trim();
    for (let i = 0; i < 4; i++) {
      const next = s.replace(/^[([{]+/, "").replace(/:\s*-?[\d.]+\s*[)\]}]*$/, "").replace(/(?<!\\)[)\]}]+$/, "").trim();
      if (next === s) break;
      s = next;
    }
    return s.replace(/\\([()[\]{}])/g, "$1").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  }

  // 照提示詞原本的順序排出每一顆字（排字盤）：哪顆變成牌、哪顆詞庫沒有、哪顆引擎自己處理。
  function sortsOf(text, parsed) {
    const cardByRaw = new Map(parsed.cards.map((c) => [c.raw, c]));
    const sets = {
      unknown: new Set(parsed.unknown),
      muted: new Set([...(parsed.quality || []), ...(parsed.engine || [])]),
      blocked: new Set(parsed.blocked || []),
    };
    const out = [];
    const pieces = String(text).split(/(<\s*lora\s*:[^>]*>)|[,，、\n]+|\bBREAK\b/i);
    for (const piece of pieces) {
      const raw = (piece || "").trim();
      if (!raw) continue;
      if (/^<\s*lora\s*:/i.test(raw)) {
        out.push({ raw, kind: "muted" });
        continue;
      }
      const card = cardByRaw.get(raw);
      if (card) {
        cardByRaw.delete(raw);
        out.push({ raw, kind: "card", tag: card.tag, zh: card.zh || zhOf(card.tag), w: card.w });
      } else if (sets.unknown.has(raw)) {
        sets.unknown.delete(raw);
        out.push({ raw, kind: "unknown" });
      } else if (sets.blocked.has(raw)) {
        sets.blocked.delete(raw);
        out.push({ raw, kind: "blocked" });
      } else if (sets.muted.has(raw)) {
        sets.muted.delete(raw);
        out.push({ raw, kind: "muted" });
      }
      // 其餘是重複的字（拆的時候已經算過一次）：不再排一顆。
      if (out.length >= 48) break;
    }
    return out.map((s, i) => ({ ...s, i, state: "" }));
  }

  // 詞庫沒有的字：到字盒找相近的（同一個搜尋），整串找不到就拿最長的那個詞再找一次。
  async function lookupWord(raw) {
    const q = plainWord(raw);
    let searched = false;
    const search = async (query) => {
      try {
        const result = await ctx.search(query, { limit: 8 });
        searched = true;
        return result || [];
      } catch { return []; }
    };
    let list = q ? await search(q) : [];
    let used = q;
    if (!list.length && q.includes(" ")) {
      for (const w of q.split(" ").filter((x) => x.length >= 3).sort((a, b) => b.length - a.length)) {
        list = await search(w);
        if (list.length) {
          used = w;
          break;
        }
      }
    }
    const candidates = [];
    for (const c of list) {
      if (!c?.tag || c.blocked === "banned" || c.inPool) continue;
      if (await blockReason(c.tag)) continue;
      candidates.push({ tag: c.tag, zh: c.zh || zhOf(c.tag), section: c.section || null, ...(c.blocked ? { blocked: c.blocked } : {}) });
      if (candidates.length >= 4) break;
    }
    return { raw, query: used, candidates, searched };
  }

  async function stage(fn, ...a) {
    try {
      if (typeof ctx[fn] === "function") return await ctx[fn](...a);
    } catch { /* 畫面演不了不能讓這一步失敗 */ }
    return null;
  }

  async function pastePrompt(args, opts, base) {
    const target = { area: "pool" };
    const text = typeof args.prompt === "string" ? args.prompt.trim() : "";
    if (!text) return fail(target, "bad_args", TEXT.promptEmpty);
    if (text.length > 2000) return fail(target, "bad_args", TEXT.promptLong);
    if (Object.prototype.hasOwnProperty.call(args, "replace") && typeof args.replace !== "boolean") return fail(target, "bad_args", TEXT.badArgs);
    // 底線：整串裡有未成年的說法就整串不收（不是只略過那一個字）。
    if (MINOR_RE.test(text.replace(/_/g, " "))) {
      return fail(target, "blocked", fill(TEXT.cannotUse, text.length > 24 ? text.slice(0, 24) + "…" : text, TEXT.whyMinor), { model: { blocked: [{ reason: "minor" }] } });
    }
    if (typeof ctx.parse !== "function") return fail(target, "failed", TEXT.failed, { model: { error: "parse unavailable" } });
    const parsed = await ctx.parse(text);
    const blocked = [];
    const cards = [];
    for (const c of parsed.cards || []) {
      const reason = await blockReason(c.tag);
      if (reason) blocked.push({ tag: c.tag, reason });
      else cards.push(c);
    }
    const sorts = sortsOf(text, { ...parsed, cards, blocked: [...(parsed.blocked || []), ...blocked.map((x) => (parsed.cards.find((c) => c.tag === x.tag) || {}).raw)] });
    // 排字盤先排出來（聊天室裡那一步）：等字排好、看得到每一顆的位置，牌才從字裡飛出去。
    const tray = await stage("typeset", opts.callId || null, sorts);
    const rectOf = (tag) => {
      const s = sorts.find((x) => x.kind === "card" && x.tag === tag);
      return s && tray?.rect ? tray.rect(s.i) : null;
    };
    const unknown = parsed.unknown || [];
    const unknownSorts = new Map(sorts.filter((s) => s.kind === "unknown").map((s) => [s.raw, s]));
    const lookups = [];
    for (const raw of unknown.slice(0, 6)) {
      if (opts.signal?.aborted) break;
      const result = await lookupWord(raw);
      if (result.searched) lookups.push({ i: unknownSorts.get(raw)?.i, ...result });
    }
    // 排字動畫最長一秒多：這段時間按了停止、或自己動了合成池，就不能照舊的狀態寫（replace 會把你剛放的牌當成舊的拿掉）。
    if (opts.signal?.aborted) return skip(target, TEXT.aborted, { ok: false, code: "aborted" });
    if (isStale(base)) return fail(target, "stale", TEXT.stale, { model: { message: "排字時工作台被改過，請先 get_workspace 再寫入。" } });
    const st = await ctx.state();
    const add = [...new Set(cards.map((c) => c.tag))];
    // 整組換掉：跟「貼上」的「換成這些牌」一樣，份量照這串寫的（沒寫就是 1，舊的 1.4 不留）；加進去的才保留原本的份量。
    const weightsObj = Object.fromEntries(cards.filter((c) => (args.replace ? true : c.w && c.w !== 1)).map((c) => [c.tag, c.w || 1]));
    // 一張都對不上時不能照樣清池子（手動貼上這時「換成」是按不下去的）。
    const remove = args.replace && add.length ? (st.pool || []).map((p) => p.tag).filter((t) => !add.includes(t)) : [];
    const ignored = sorts.filter((x) => x.kind === "muted").map((x) => x.raw);
    const byWord = new Map(lookups.map((l) => [l.raw, l]));
    const unknownForModel = unknown.map((word) => ({ word, searched: byWord.has(word), candidates: byWord.get(word)?.candidates || [] }));
    const lookLines = lookups.map((l) => (l.candidates.length ? fill(TEXT.pasteCands, l.raw, l.candidates.map((c) => c.zh).join(sep())) : fill(TEXT.pasteNoCand, l.raw)));
    const extra = {
      pasted: { cards: add.length, unknown: unknownForModel, ignored, blocked },
    };
    let res;
    const already = new Set((st.pool || []).map((p) => p.tag));
    if (!add.length && !remove.length) {
      res = skip(target, parsed.cards?.length ? TEXT.pasteHave : TEXT.pasteNone, { model: { code: "nothing_to_add" } });
    } else if (!remove.length && add.every((t) => already.has(t)) && Object.entries(weightsObj).every(([t, w]) => sameW((st.pool || []).find((p) => p.tag === t)?.weight ?? 1, w))) {
      res = skip(target, TEXT.pasteHave, { model: { code: "already_in_pool" } });
    } else {
      res = await changePool({ add, ...(remove.length ? { remove } : {}), ...(Object.keys(weightsObj).length ? { weights: weightsObj } : {}) }, { ...opts, from: rectOf, paste: true }, base);
    }
    // 排字盤上每一顆的下場照放完之後真的池子：同一串裡互斥的（beach 跟 ocean），後面那張會把前面那張擠掉。
    let inPool = already;
    try { inPool = new Set(((await ctx.state()).pool || []).map((p) => p.tag)); } catch { /* 讀不到就照原本的 */ }
    const dropped = res.status === "done" ? add.filter((t) => !inPool.has(t)) : [];
    for (const s of sorts) {
      if (s.kind === "card") s.state = res.status === "needs_confirm" ? "wait" : inPool.has(s.tag) ? "set" : "miss";
      else if (s.kind === "unknown" && byWord.has(s.raw)) s.state = "look";
    }
    if (dropped.length) extra.pasted.dropped = dropped.map((t) => ({ tag: t, why: "mutex_in_prompt" }));
    await stage("typesetDone", opts.callId || null, sorts);
    const animated = lookups.filter((l) => l.i != null);
    if (animated.length) stage("lookup", opts.callId || null, animated.map((l) => ({ i: l.i, raw: l.raw, query: l.query, tags: l.candidates.map((c) => c.tag) })));
    const unsearched = unknown.length - lookups.length;
    const own = [...(res.lines || []), ...(dropped.length ? [fill(TEXT.pasteDropped, joinZh(dropped))] : [])];
    const tail = [
      ...(unsearched ? [fill(TEXT.pasteUnsearched, unsearched)] : []),
      ...lookLines,
      ...(ignored.length ? [fill(TEXT.pasteIgnored, ignored.slice(0, 6).join(sep()))] : []),
    ];
    res.lines = [...own.slice(0, Math.max(1, LINE_CAP - tail.length)), ...tail].slice(0, LINE_CAP);
    res.forModel = { ...res.forModel, pasted: { ...res.forModel.pasted, ...extra.pasted } };
    res.sorts = sorts;
    return res;
  }

  async function applyConfirmed(plan) {
    if (plan.signal?.aborted) return skip(plan.target, TEXT.aborted, { ok: false, code: "aborted" });
    let cur;
    try { cur = ctx.version(); } catch { cur = null; }
    // 確認當下對的是預覽那一版。中間任何人改過，預覽就作廢，不能按下去仍套用。
    if (cur !== plan.seen) {
      return fail(plan.target, "stale", TEXT.stale, { model: { message: "工作台在等待確認時被改過，請先 get_workspace 再寫入。" } });
    }
    const blocked = [];
    for (const tag of plan.add) {
      const reason = await blockReason(tag);
      if (reason) blocked.push({ tag, reason });
    }
    if (blocked.length) return fail(plan.target, "blocked", cannot(blocked[0].tag, blocked[0].reason), { model: { blocked } });
    const state = await ctx.state();
    const preview = plan.add.length || plan.remove.length ? await ctx.previewPins(plan.add, plan.remove) : null;
    const total = projectTotal(state, preview, plan.remove);
    if (total > POOL_CAP) {
      const lim = limitLines(total, state);
      await hi(plan.target, "clear");
      return fail(plan.target, "pool_limit", fill(TEXT.over40, total), {
        lines: lim.lines,
        model: { total, limit: POOL_CAP, replaceable: lim.replaceable },
      });
    }
    return commitPool(plan, plan.baseline, plan.target, TEXT.labPool);
  }

  async function setDrawCount(args, _opts, base) {
    const target = { area: "rules", key: "n" };
    if (!Object.prototype.hasOwnProperty.call(args, "n") || !isInt(args.n) || args.n < 1 || args.n > 50) {
      return fail(target, "bad_args", TEXT.nRange);
    }
    const st = await ctx.state();
    if (st.settings?.n === args.n) return skip(target, fill(TEXT.nSame, args.n));
    const text = fill(TEXT.labN, args.n);
    await hi(target, "write", text);
    try {
      if (isStale(base)) throw staleWrite;
      const r = await ctx.setN(args.n);
      note(base, r);
      await hi(target, "done", text);
      const from = r?.from ?? st.settings?.n;
      const to = r?.to ?? args.n;
      return pack({
        ok: true,
        status: "done",
        summary: fill(TEXT.nChange, from, to),
        lines: [],
        ops: [{ k: TEXT.opN, v: `${from} → ${to}`, raw: true }],
        target,
        undo: undoN(from, to),
        forModel: { ok: true, from, to, undoable: true },
      });
    } catch (err) {
      await hi(target, "clear", text);
      if (err === staleWrite) return staleResult(target);
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function setSectionCounts(args, _opts, base) {
    const keys = SECTIONS.filter((k) => Object.prototype.hasOwnProperty.call(args, k));
    const target = { area: "rules", key: keys.length === 1 ? keys[0] : "counts" };
    if (!keys.length) return fail(target, "bad_args", TEXT.badArgs);
    for (const key of keys) {
      if (!isInt(args[key]) || args[key] < 0 || args[key] > 10) return fail(target, "bad_args", TEXT.countRange);
    }
    const st = await ctx.state();
    const patch = {};
    for (const key of keys) if (st.settings?.counts?.[key] !== args[key]) patch[key] = args[key];
    if (!Object.keys(patch).length) return skip(target, TEXT.countSame);
    const text = keys.length === 1 ? fill(TEXT.labCount, SECTION_ZH[keys[0]], args[keys[0]]) : TEXT.labCounts;
    await hi(target, "write", text);
    try {
      if (isStale(base)) throw staleWrite;
      const r = await ctx.setSectionCounts(patch);
      note(base, r);
      await hi(target, "done", text);
      const changes = r.changes;
      const lines = changes.map((ch) => fill(TEXT.countChange, SECTION_ZH[ch.section] || ch.section, ch.from, ch.to));
      return pack({
        ok: true,
        status: "done",
        summary: lines[0] || TEXT.labCounts,
        lines,
        ops: changes.map((ch) => ({ k: SECTION_ZH[ch.section] || ch.section, v: `${ch.from} → ${ch.to}`, raw: true })),
        target,
        undo: changes.length ? undoCounts(changes) : undefined,
        forModel: { ok: true, changes, undoable: !!changes.length },
      });
    } catch (err) {
      await hi(target, "clear", text);
      if (err === staleWrite) return staleResult(target);
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function readGroups(target, refresh = false) {
    try {
      const groups = await ctx.groups({ refresh });
      return groups == null ? { error: fail(target, "groups_not_loaded", TEXT.groupsNotLoaded) } : { groups };
    } catch (err) {
      return { error: fail(target, "groups_read_failed", TEXT.groupsReadFailed, { model: { error: err?.message || String(err) } }) };
    }
  }

  async function listGroups(args) {
    const { section, id } = args;
    const target = section ? { area: "groups", key: section } : { area: "groups" };
    if (section != null && !SECTIONS.includes(section)) return fail(target, "bad_args", TEXT.badSection);
    if (Object.hasOwn(args, "id") && (typeof id !== "string" || !id.trim())) return fail(target, "bad_args", TEXT.badArgs);
    await hi(target, "read", TEXT.labGroups);
    const { error, groups } = await readGroups(target);
    await hi(target, "clear");
    if (error) return error;
    const view = groups.filter((g) => (!section || g.section === section) && (!id || g.id === id)).map((g) => ({
      id: g.id,
      name: g.name,
      section: g.section,
      count: (g.tags || []).length,
      picked: !!g.picked,
      mode: g.mode || "whole",
      ...(id ? { tags: [...(g.tags || [])] } : {}),
    }));
    if (id && !view.length) return fail(target, "group_missing", TEXT.groupMissing, { model: { missing: [id] } });
    const summary = section
      ? fill(TEXT.groupCount, SECTION_ZH[section], view.length)
      : fill(TEXT.groupCountAll, view.length);
    return pack({ ok: true, status: "done", summary, lines: [], target, forModel: { ok: true, groups: view } });
  }

  async function setGroupPicks(args, _opts, base) {
    const section = args.section;
    const target = SECTIONS.includes(section) ? { area: "groups", key: section } : { area: "groups" };
    if (!SECTIONS.includes(section)) return fail(target, "bad_args", TEXT.badSection);
    if (!Array.isArray(args.ids) || args.ids.some((id) => typeof id !== "string" || !id.trim())) {
      const cur = (await ctx.state()).settings?.groups?.[section];
      return fail(target, "bad_args", TEXT.picksNeedIds, {
        model: { message: `${TEXT.picksNeedIds}；只有明確傳 [] 才會全部取消。`, current: { ids: cur?.ids || [], mode: cur?.mode || "whole" } },
      });
    }
    const ids = [...new Set(args.ids)];
    if (args.ids.length > MAX_PICKS) return fail(target, "bad_args", fill(TEXT.tooManyPicks, MAX_PICKS));
    if (Object.prototype.hasOwnProperty.call(args, "mode") && !MODES.includes(args.mode)) return fail(target, "bad_args", TEXT.badMode);
    let groups = [];
    if (ids.length) {
      const missingOf = () => ids.filter((id) => !groups.some((g) => g.id === id));
      const loaded = await readGroups(target);
      if (loaded.error) return loaded.error;
      groups = loaded.groups.filter((g) => g.section === section);
      if (missingOf().length) {
        const refreshed = await readGroups(target, true);
        if (refreshed.error) return refreshed.error;
        groups = refreshed.groups.filter((g) => g.section === section);
      }
      const missing = missingOf();
      if (missing.length) {
        return fail(target, "group_missing", TEXT.groupMissing, {
          model: { missing, candidates: groups.map((g) => ({ id: g.id, name: g.name, section: g.section })) },
        });
      }
    }
    const st = await ctx.state();
    const cur = st.settings?.groups?.[section];
    const curIds = cur?.ids || [];
    const curMode = cur?.mode || "whole";
    const mode = args.mode || curMode;
    if (!ids.length && !curIds.length) return skip(target, TEXT.picksSame);
    if (sameList(ids, curIds) && mode === curMode) return skip(target, TEXT.picksSame);
    const text = fill(TEXT.labPicks, SECTION_ZH[section]);
    await hi(target, "write", text);
    try {
      if (isStale(base)) throw staleWrite;
      const r = await ctx.setGroupPicks(section, ids, mode);
      note(base, r);
      await hi(target, "done", text);
      const from = r?.from || { ids: curIds, mode: curMode };
      const to = r?.to || { ids, mode };
      const names = ids.map((id) => groups.find((g) => g.id === id)?.name || id);
      const summary = ids.length ? fill(TEXT.picksSet, SECTION_ZH[section], names.join("、")) : fill(TEXT.picksClear, SECTION_ZH[section]);
      return pack({
        ok: true,
        status: "done",
        summary,
        lines: [],
        ops: [ids.length ? { k: fill(TEXT.opPicks, SECTION_ZH[section]), v: names.join(sep()), raw: true } : { k: fill(TEXT.opPicks, SECTION_ZH[section]), v: TEXT.opPicksClear }],
        target,
        undo: undoPicks(section, to, from),
        forModel: { ok: true, section, from, to, undoable: true },
      });
    } catch (err) {
      await hi(target, "clear", text);
      if (err === staleWrite) return staleResult(target);
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function saveCardGroup(args, _opts, base) {
    const section = args.section;
    const target = SECTIONS.includes(section) ? { area: "groups", key: section } : { area: "groups" };
    if (!SECTIONS.includes(section)) return fail(target, "bad_args", TEXT.badSection);
    if (typeof args.name !== "string") return fail(target, "bad_args", TEXT.badArgs);
    const name = collapseName(args.name);
    if (!name) return fail(target, "bad_args", TEXT.nameEmpty);
    if ([...name].length > MAX_NAME) return fail(target, "bad_args", TEXT.nameLong);
    const tagsInput = tagList(args.tags);
    if (!tagsInput) return fail(target, "bad_args", TEXT.badArgs);
    const tags = resolvedTags(tagsInput);
    if (!tags.length) return fail(target, "bad_args", TEXT.needTag);
    if (tags.length > MAX_TAGS) return fail(target, "bad_args", fill(TEXT.tooManyTags, MAX_TAGS));
    const state = await ctx.state();
    const blocked = [];
    for (const tag of tags) {
      const reason = await blockReason(tag);
      if (reason) blocked.push({ tag, reason });
    }
    if (blocked.length) {
      return fail(target, "blocked", cannot(blocked[0].tag, blocked[0].reason), {
        lines: blocked.map((b) => cannot(b.tag, b.reason)),
        model: { blocked },
      });
    }
    const missing = [];
    const wrong = [];
    const keep = [];
    for (const tag of tags) {
      const info = await knownInfo(tag, state);
      if (!info) { missing.push(tag); continue; }
      if (info.section && info.section !== section) { wrong.push(tag); continue; }
      if (!info.section) { wrong.push(tag); continue; }
      keep.push(tag);
    }
    if (missing.length) {
      return fail(target, "missing", fill(TEXT.notInLex, missing[0]), {
        lines: missing.map((t) => fill(TEXT.notInLex, t)),
        model: { missing },
      });
    }
    if (!keep.length) {
      return fail(target, "bad_args", TEXT.allWrong, { lines: wrong.map((t) => fill(TEXT.wrongSection, zhOf(t))) });
    }
    const { error, groups } = await readGroups(target);
    if (error) return error;
    if (groups.length >= MAX_GROUPS) return fail(target, "failed", fill(TEXT.tooManyGroups, MAX_GROUPS), { model: { limit: MAX_GROUPS } });
    if (groups.some((g) => g.section === section && collapseName(g.name) === name)) {
      return fail(target, "name_taken", fill(TEXT.nameTaken, name), { model: { name, section } });
    }
    const text = fill(TEXT.labSave, name);
    await hi(target, "write", text);
    try {
      if (isStale(base)) throw staleWrite;
      const saved = await ctx.saveGroup({ name, section, tags: keep });
      const group = saved.group;
      if (!group?.id) throw new Error("伺服器沒有回傳新群組 ID");
      await hi(target, "done", text);
      const lines = wrong.map((t) => fill(TEXT.wrongSection, zhOf(t)));
      for (const s of saved.skipped || []) lines.push(fill(TEXT.wrongSection, zhOf(s.tag || s)));
      const skipped = [...wrong.map((tag) => ({ tag, why: "section" })), ...(saved.skipped || [])];
      return pack({
        ok: true,
        status: skipped.length ? "partial" : "done",
        summary: fill(TEXT.saved, group.name),
        lines,
        ops: [{ k: TEXT.opSaved, v: group.name, raw: true }],
        target,
        forModel: { ok: true, group, skipped, undoable: false },
      });
    } catch (err) {
      await hi(target, "clear", text);
      if (err === staleWrite) return staleResult(target);
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  async function drawCards(args, _opts, base) {
    const target = { area: "wall" };
    if (Object.prototype.hasOwnProperty.call(args, "n") && (!isInt(args.n) || args.n < 1 || args.n > 50)) {
      return fail(target, "bad_args", TEXT.nRange);
    }
    const st = await ctx.state();
    // 不呼叫 setN：這一輪的張數不能寫回「一次」。
    const n = Object.prototype.hasOwnProperty.call(args, "n") ? args.n : st.settings?.n;
    const text = fill(TEXT.labDrawN, n);
    await hi(target, "write", text);
    try {
      if (isStale(base)) throw staleWrite;
      const r = await ctx.draw({ n });
      const requested = r?.requested ?? n;
      const made = r?.made ?? 0;
      const shotIds = r?.shotIds || [];
      const warnings = r?.warnings || [];
      const wall = shotIds[0] ? { area: "wall", key: shotIds[0] } : { area: "wall" };
      if (!made) {
        await hi(target, "clear", text);
        return fail(wall, "draw_empty", TEXT.drewNone, {
          lines: [TEXT.noGen],
          model: { requested, made, shotIds, warnings },
        });
      }
      await hi(target, "done", text);
      const partial = made < requested;
      return pack({
        ok: true,
        status: partial ? "partial" : "done",
        summary: fill(TEXT.drew, made, requested),
        lines: [TEXT.noGen],
        target: wall,
        forModel: { ok: true, requested, made, shotIds, warnings, persisted: false, undoable: false },
      });
    } catch (err) {
      await hi(target, "clear", text);
      if (err === staleWrite) return staleResult(target);
      return fail(target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
    }
  }

  const handlers = {
    use_reference: useReference,
    find_works: findWorks,
    trace_card: traceCard,
    get_workspace: (args) => getWorkspace(args),
    find_cards: (args) => findCards(args),
    card_info: (args) => cardInfo(args),
    suggest_check: (args) => suggestCheck(args),
    suggest_cards: (args) => suggestCards(args),
    change_pool: (args, opts, base) => changePool(args, opts, base),
    paste_prompt: (args, opts, base) => pastePrompt(args, opts, base),
    set_draw_count: (args, opts, base) => setDrawCount(args, opts, base),
    set_section_counts: (args, opts, base) => setSectionCounts(args, opts, base),
    list_groups: (args) => listGroups(args),
    set_group_picks: (args, opts, base) => setGroupPicks(args, opts, base),
    save_card_group: (args, opts, base) => saveCardGroup(args, opts, base),
    draw_cards: (args, opts, base) => drawCards(args, opts, base),
  };

  async function execute(call, opts) {
    if (opts.signal?.aborted) {
      return skip(targetFor(call?.name, call?.args || {}), TEXT.aborted, { ok: false, code: "aborted" });
    }
    const name = call?.name;
    const def = byName.get(name);
    if (!def) return fail({ area: "pool" }, "unknown_tool", TEXT.unknownTool, { model: { name: name || null } });
    const args = onlyKeys(call?.args, Object.keys(def.input_schema.properties || {}));
    if (!args) return fail(targetFor(name, {}), "bad_args", TEXT.badArgs);
    const base = baselineOf(opts.turn);
    if (def.kind === "write" && isStale(base)) {
      return fail(targetFor(name, args), "stale", TEXT.stale, {
        model: { message: "工作台在思考時被改過，請先 get_workspace 再寫入。" },
      });
    }
    if (def.kind === "write") {
      let st;
      try { st = await ctx.state(); } catch (err) {
        return fail(targetFor(name, args), "failed", TEXT.failed, { model: { error: err?.message || String(err) } });
      }
      if (!st?.ready) return fail(targetFor(name, args), "not_ready", TEXT.notReadyWrite);
    }
    return handlers[name](args, { signal: opts.signal, callId: call?.id || null, planGeneration: opts.planGeneration, referenceOf: opts.turn?.referenceOf }, base);
  }

  async function run(call, opts = {}) {
    const id = call && typeof call.id === "string" && call.id ? call.id : null;
    if (id && settled.has(id)) return settled.get(id);
    if (id && inflight.has(id)) return inflight.get(id);
    const generation = planGeneration;
    const job = Promise.resolve()
      .then(() => execute(call || {}, { ...opts, planGeneration: generation }))
      .then((res) => res.confirm && !plans.has(res.confirm.token) ? fail(res.target, "confirm_unknown", TEXT.confirmGone) : res)
      .catch((err) => fail(targetFor(call?.name, call?.args || {}), "failed", TEXT.failed, { model: { error: err?.message || String(err) } }));
    if (!id) return job;
    inflight.set(id, job);
    try {
      const res = await job;
      settled.set(id, res);
      return res;
    } finally {
      inflight.delete(id);
    }
  }

  function cancelPlans() {
    planGeneration++;
    for (const [token, plan] of plans) {
      if (plan.pending) continue;
      plans.delete(token);
      if (plan.callId && settled.has(plan.callId)) settled.set(plan.callId, fail(plan.target, "confirm_unknown", TEXT.confirmGone));
    }
  }

  function confirm(token, choice = "apply") {
    const plan = plans.get(token);
    if (!plan) return Promise.resolve({ ...fail({ area: "pool" }, "confirm_unknown", TEXT.confirmGone), status: "stale" });
    if (plan.pending) return plan.pending;
    if (choice !== "apply" && choice !== "keep") return Promise.resolve(fail(plan.target, "bad_args", TEXT.badArgs));
    plan.pending = Promise.resolve()
      .then(() => choice === "keep" ? skip(plan.target, TEXT.keep) : applyConfirmed(plan))
      .catch((err) => fail(plan.target, "failed", TEXT.failed, { model: { error: err?.message || String(err) } }))
      .then(async (res) => {
        const status = !res.ok ? (res.forModel.code === "stale" ? "stale" : "failed") : choice === "keep" ? "kept" : "applied";
        if (status !== "applied") await hi(plan.target, "clear");
        if (plan.callId) settled.set(plan.callId, res);
        return { ...res, status };
      });
    return plan.pending;
  }

  return { run, label, confirm, cancelPlans };
}
