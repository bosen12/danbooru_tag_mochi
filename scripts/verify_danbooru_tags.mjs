#!/usr/bin/env node
/**
 * 向 Danbooru 官方 API 核實運動 tag。只接受 category=0、post_count>0、is_deprecated=false。
 *
 *   node scripts/verify_danbooru_tags.mjs                     # 驗整個詞庫（預設）
 *   node scripts/verify_danbooru_tags.mjs --sports-only        # 只驗 allSportTags() 的清單
 *   node scripts/verify_danbooru_tags.mjs --retry 40          # API 掛掉時重試幾輪（每輪間隔 30 秒）
 *   node scripts/verify_danbooru_tags.mjs --max-created 2025  # 另外標出建立年份晚於 2025 的
 *   node scripts/verify_danbooru_tags.mjs --category 4 a b    # 改收這個分類（4 角色、3 版權）
 *   node scripts/verify_danbooru_tags.mjs a b c               # 只驗指定 tag（空格格式）
 *
 * 專案內是空格格式，API 是底線格式，這裡自動轉換。
 * 結果寫到 scripts/.cache_danbooru_sport_tags.json（已在 .gitignore 的 .cache_* 規則裡）。
 *
 * --max-created 的語意（重要）
 *   這是**模型詞彙相容性的警告**，不是 tag 有效性的判斷。晚於門檻的 tag 仍然算通過、
 *   仍然留在 ok 裡，只是另外列進 newerThanCutoff，而且不會讓 exit code 變成 1。
 *   這個年份**不代表** WAI Illustrious 或任何模型的訓練資料截止日 —— 那件事無法從
 *   Danbooru API 查證，所以門檻做成參數，由呼叫者自己決定。
 *
 * 這支檔案可以被安全 import：只有直接從 CLI 執行時才會連網、寫 cache、印報告、
 * 動 process.exitCode。純函式（parseArgs／verdict／createdYear／buildReport）可以單獨
 * 測試，見 scripts/test_verify_danbooru_tags.mjs。
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const API = "https://danbooru.donmai.us/tags.json";
const UA = "paizi-case-tag-check/1.0 (local tooling)";
const OUT = join(here, ".cache_danbooru_sport_tags.json");
const RETRY_WAIT_MS = 30000;

/** CLI 參數錯誤。main 會把它印成一行並以 exit code 2 結束，不留堆疊。 */
export class CliError extends Error {}

/**
 * 模型字彙白名單：Danbooru 查無（或 post_count 0、deprecated），但 Illustrious／WAI
 * 訓練時學過的 token。這些**不是** Danbooru tag，拿 Danbooru 當唯一標準去判它們
 * 無效是錯的 —— 刪掉 bad quality 或 worst quality 會讓畫質直接變差。
 *
 * 來源（2026-09-16 查證）：
 *   品質階梯  としあきdiffusion Wiki 記載 Illustrious XL 的排序是
 *             masterpiece > best quality > good quality > average quality >
 *             bad quality > worst quality，「正向取最上面 1-3 個，負向取最下面 2 個」
 *   WAI 官方  模型卡建議 正向 "masterpiece, best quality, amazing quality"、
 *             負向 "bad quality, worst quality, worst detail, sketch, censor"，
 *             並要使用者自行把 nsfw 加進負向
 *   美學階梯  very aesthetic / aesthetic / displeasing / very displeasing
 *   年代分桶  newest / recent / mid / early / oldest
 *   分級      Danbooru 的四個 rating 值，Illustrious 系當 token 用
 *
 * 注意：這裡放的是「模型認得但 Danbooru 沒有」的。像 censored（662845）、
 * lowres、jpeg artifacts 那種真的 Danbooru tag 不要放進來，它們要照常驗。
 */
export const MODEL_VOCAB = new Set([
  // 品質階梯
  "masterpiece", "best quality", "high quality", "good quality",
  "average quality", "normal quality", "low quality", "bad quality", "worst quality",
  // WAI 模型卡點名
  "amazing quality", "worst detail", "censor",
  // 美學階梯
  "very aesthetic", "highly aesthetic", "aesthetic", "displeasing", "very displeasing",
  // 年代分桶
  "newest", "recent", "mid", "early", "oldest",
  // 分級
  "safe", "sfw", "nsfw", "general", "sensitive", "questionable", "explicit",

  // --- 以下兩類是 2026-09-18 跑完 `--all` 之後裁決的（詳見討論區）------------
  //
  // hairpin：它的 alias（hairpin -> hairclip）建立於 2026-05-30，**晚於**模型訓練，
  // 所以舊名要留著。test_lexicon_integrity.mjs 已經有一條專門守這件事，
  // 這裡跟著放行，免得 `--all` 每次都把它報成 BAD。
  "hairpin",

  // --- deprecated 但模型仍然學過的（2026-09-18 裁決，見討論區）---------------
  //
  // 這幾個跟上面那些不一樣：它們**曾經是真的 tag**，有過大量圖，後來才被
  // Danbooru 停用並改標。所以判準不是「現在幾張」，而是**停用時間 vs 訓練截止**：
  // 停用晚於 2024 的，模型訓練時它們還活著，那個 token 學過，留著有效。
  //
  //   presenting             停用 2026-07   -> presenting own body（Danbooru 建議）
  //   hand in panties        停用 2025-12   -> hand in own panties
  //   hands on own breasts   停用 2025-04   -> grabbing own breast
  //   inset                  停用 2025-12   還有 2,718 張；它正是負面詞要擋的
  //                                          「畫中畫小框」，wiki 的定義就是這個
  //
  // 2024 當年停用的三個落在邊界上，證據不足以判它在訓練資料的哪一邊，
  // 所以照「不確定就不動」處理：
  //
  //   ass grab      停用 2024-07   -> grabbing own/another's ass
  //   breast hold   停用 2024-07   -> arm under breasts
  //   cel shading   停用 2024-08   -> cel rendering（而且它是風格，要釘才進）
  //
  // 對照組：2022～23 就停用的六個（bangs、amber eyes、silver hair、looking away、
  // creampie、areolae）已經移除 —— 2024 的快照裡它們早就被改標完，
  // 模型學到的是替代字，而替代字全部已經在詞庫裡跟舊名搶同一格。
  "presenting", "hand in panties", "hands on own breasts", "inset",
  "ass grab", "breast hold", "cel shading",

  // --- 2026-10-14：WAI v17 實測之後的決定（scripts/alt_names.json、model_vocab_audit_v17.json）----
  //
  // 專案主決定不刪字，而是把 Danbooru 併掉的舊名（現在 0 張）加成同中文名的卡，
  // 放在原卡旁邊：模型訓練時看到的多半是舊名。Grok 逐組實測後，模型認不得的那個名字拿掉
  // （只認新名的刪原名、只認原名或兩個都不認得的不加新名），留下來的都是實測認得的。
  // cum pool：2026-10 併進 cum puddle（兩個名字實測都 5/5），現名照留。
  "cum pool",
  "kyoto",
  "double breast sucking",
  "no legwear",
  "nipple biting",
  "gothic",
  "goth girl",
  "looking through legs",
  "lifted by self",
  "clothes only",
  "sleeves past elbows",
  "presenting breasts",
  "plugsuit",
  "eraser head (boku no hero academia)",
  "marcille",
  "falin thorden (tallman)",
  "laios thorden",
  "marcille donato (dungeon lord)",
  "t-head trainer",
  "taihou (forbidden feast) (azur lane)",
  "shion (tensei shitara slime datta ken)",

  // --- 2026-10-23 族裔：停用晚於訓練、WAI v17 仍畫得出來（討論區第二輪）---------
  //
  // asian：2026-03 以前是 east asian 的別名。現名 D 3/5、舊名 D 3/5，並排同名卡。
  // indian：2026-02 以前是 desi 的名字。現名 D 3/5、舊名 D 5/5，並排同名卡。
  // indian clothes：2026-03 以前是 asian indian clothes 的名字。新名 D 0/5（畫成中國衣），
  //   只留這個舊名當卡，不是缺席新名的別名。
  "asian",
  "indian",
  "indian clothes",

  // --- 2026-10-24 口塞：0 張的舊名，WAI v17 仍畫得出頭套（討論區第三輪）-----
  //
  // harness gag：2013 起的空殼，沒標停用。現名 gag harness D 5/5、舊名 D 5/5，並排同名卡。
  "harness gag",
]);

// 使用者點名必須擋掉的：deprecated、post_count 0、或 alias 舊名。
export const FORBIDDEN = [
  "basketball",
  "baseball",
  "volleyball",
  "volleyball court",
  "baseball glove",
  "cycling",
  "golf uniform",
  "tennis shoes",
  "archery range",
  "ice rink",
  "arrow",
  "yumi",
];

const toApi = (t) => t.replace(/ /g, "_");
const toPos = (t) => t.replace(/_/g, " ");

/**
 * 解析 CLI 參數。
 *
 * @returns {{ retries: number, maxCreatedYear: number|null, category: number, tags: string[] }}
 *   retries        --retry 的輪數，預設 0（維持既有的寬鬆解析）
 *   maxCreatedYear --max-created 的年份，沒給就是 null
 *   category       --category 要收的 Danbooru 分類，預設 0（一般 tag）
 *   tags           位置參數；空陣列代表「用 allSportTags() 的完整清單」
 * @throws {CliError} 參數不合法時，訊息可直接印給使用者看
 */
export function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  let retries = 0;
  let maxCreatedYear = null;
  let category = 0;
  let all = true;
  const tags = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--retry") {
      // 既有行為：寬鬆解析，給不出數字就當 0。不改，免得動到現有用法。
      retries = Number(args[++i]) || 0;
      continue;
    }
    if (a === "--max-created") {
      maxCreatedYear = parseYear(args[++i]);
      continue;
    }
    if (a === "--category") {
      category = parseCategory(args[++i]);
      continue;
    }
    if (a === "--all") {
      // 保留相容：--all 現在是預設，給它一個 no-op 以免舊指令壞掉。
      all = true;
      continue;
    }
    if (a === "--sports-only") {
      all = false;
      continue;
    }
    if (a === "--help" || a === "-h") {
      throw new CliError(
        "用法：node scripts/verify_danbooru_tags.mjs [--retry N] [--max-created YYYY] [--category N] [--sports-only] [tag ...]"
      );
    }
    if (typeof a === "string" && a.startsWith("--")) {
      throw new CliError(`不認得的參數：${a}`);
    }
    tags.push(a);
  }

  return { retries, maxCreatedYear, category, all, tags };
}

/** --category 的值：Danbooru 分類 0～5。沒給時呼叫端維持 0。 */
function parseCategory(raw) {
  if (raw === undefined || raw === null || raw === "") {
    throw new CliError("--category 需要一個分類編號，例如 --category 4");
  }
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) {
    throw new CliError(`--category 需要整數，收到「${raw}」`);
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 5) {
    throw new CliError(`--category 必須是 0 到 5，收到「${raw}」`);
  }
  return n;
}

/** --max-created 的值：必須是四位數整數。不合法就丟 CliError。 */
function parseYear(raw) {
  if (raw === undefined || raw === null || raw === "") {
    throw new CliError("--max-created 需要一個四位數年份，例如 --max-created 2025");
  }
  const s = String(raw).trim();
  if (!/^\d{4}$/.test(s)) {
    throw new CliError(`--max-created 需要四位數年份，收到「${raw}」`);
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1000 || n > 9999) {
    throw new CliError(`--max-created 的年份不合理：「${raw}」`);
  }
  return n;
}

/**
 * API 回來的一筆紀錄是否可用。回 "ok" 或不可用的原因。
 * expectedCategory 預設 0（一般 tag）。--category 4／3 用來驗角色和版權，
 * 沒傳的時候訊息與判斷跟以前一樣。
 */
export function verdict(row, expectedCategory = 0) {
  if (!row) return "不存在";
  const expect = Number.isInteger(expectedCategory) ? expectedCategory : 0;
  if (row.category !== expect) {
    if (expect === 0) return `category ${row.category}（不是一般 tag）`;
    return `category ${row.category}（不是 category ${expect}）`;
  }
  if (row.is_deprecated) return "deprecated";
  if (!(row.post_count > 0)) return `post_count ${row.post_count}`;
  return "ok";
}

/** 從 created_at 取年份。取不到就回 null（不存在、格式壞掉都算）。 */
export function createdYear(createdAt) {
  if (!createdAt) return null;
  const m = /^(\d{4})/.exec(String(createdAt));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) ? n : null;
}

/**
 * category 的規則分兩種：
 *   運動 tag 必須是 category 0（一般 tag）—— 這是專案主定的。
 *   負向與正向尾巴可以是 category 5（meta）—— lowres、jpeg artifacts 這種
 *   本來就是 meta，拿「必須 category 0」去判它們無效是套錯規則。
 */
function toRecord(tag, row, metaOk, expectedCategory = 0) {
  const v = verdict(row, expectedCategory);
  const metaFine = metaOk && metaOk.has(tag) && row && row.category === 5
    && !row.is_deprecated && row.post_count > 0;
  return {
    tag,
    verdict: metaFine ? "ok" : v,
    post_count: row ? row.post_count : 0,
    category: row ? row.category : null,
    created_at: row && row.created_at ? row.created_at : null,
  };
}

/**
 * 純函式：把查詢結果組成報告。不連網、不寫檔、不印東西、不動 exitCode。
 *
 * @param wanted    要驗的 tag（空格格式）
 * @param forbidden 禁用清單
 * @param found     Map<tag, row>，row 是 Danbooru API 的一筆紀錄
 * @param options   { maxCreatedYear?: number|null, category?: number }
 *
 * newerThanCutoff 只收「已經通過（ok）但建立年份晚於門檻」的 tag：
 *   - 等於門檻年份不算晚
 *   - created_at 是 null 不算晚（查不到年份就不猜）
 *   - 沒通過的 tag 不會進來：它們的問題是有效性，不是詞彙新舊
 */
export function buildReport(wanted, forbidden, found, options = {}) {
  const maxCreatedYear =
    options.maxCreatedYear === undefined || options.maxCreatedYear === null
      ? null
      : options.maxCreatedYear;
  const get = (t) => (found && typeof found.get === "function" ? found.get(t) : undefined);
  const metaOk = options.metaOk instanceof Set ? options.metaOk : null;
  const expectedCategory = Number.isInteger(options.category) ? options.category : 0;

  const report = {
    checkedAt: new Date().toISOString(),
    maxCreatedYear,
    ok: [],
    bad: [],
    newerThanCutoff: [],
    forbiddenStillBad: [],
    forbiddenNowFine: [],
  };

  for (const t of wanted || []) {
    const rec = toRecord(t, get(t), metaOk, expectedCategory);
    // 模型字彙不受 Danbooru 有效性約束，也沒有 created_at 可以比年份。
    if (MODEL_VOCAB.has(t)) {
      rec.modelVocab = true;
      if (rec.verdict !== "ok") {
        rec.verdict = "模型字彙（Danbooru 查無，但 Illustrious 認得）";
      }
      report.ok.push(rec);
      continue;
    }
    if (rec.verdict === "ok") {
      report.ok.push(rec);
      if (maxCreatedYear !== null) {
        const y = createdYear(rec.created_at);
        if (y !== null && y > maxCreatedYear) report.newerThanCutoff.push(rec);
      }
    } else {
      report.bad.push(rec);
    }
  }

  for (const t of forbidden || []) {
    const rec = toRecord(t, get(t), metaOk, expectedCategory);
    if (rec.verdict === "ok") report.forbiddenNowFine.push(rec);
    else report.forbiddenStillBad.push(rec);
  }

  return report;
}

// --- 以下只有 CLI 會用到 ---------------------------------------------------

function chunk(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

async function fetchBatch(names) {
  const url = `${API}?search%5Bname_comma%5D=${encodeURIComponent(names.map(toApi).join(","))}&limit=1000`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const body = await res.json();
  if (!Array.isArray(body)) {
    const why =
      body && (body.message || body.error)
        ? `${body.error || ""} ${body.message || ""}`.trim()
        : `HTTP ${res.status}`;
    throw new Error(why);
  }
  return body;
}

async function lookup(names, retries, waitMs) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const found = new Map();
      for (const part of chunk(names, 90)) {
        for (const row of await fetchBatch(part)) found.set(toPos(row.name), row);
        await new Promise((r) => setTimeout(r, 600)); // 對 Danbooru 客氣一點
      }
      return found;
    } catch (err) {
      if (attempt === retries) throw err;
      process.stderr.write(
        `Danbooru 沒回（${err.message}），${waitMs / 1000} 秒後重試 ${attempt + 1}/${retries}\n`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  return new Map();
}

/**
 * 完整清單只有一個來源：web/sports.js 的 allSportTags()。
 *
 * 這裡刻意不自己走訪 SPORT_PRESETS —— 上一次就是因為驗證器自己拼清單，
 * sportPresetTags() 把 activity 移出去之後，覆蓋率無聲縮水了 26 個 tag 都沒人發現。
 */
/**
 * 每張圖都會用到的固定字彙：負向、分級負向、正向尾巴。
 *
 * 這些以前完全沒被驗過，結果 lexicon.json 裡一度躺著 fused fingers、extra limbs
 * 這種 post_count 0 的詞，還有 text、ugly 這種 deprecated 的，沒人發現。
 * 直接讀產物 lexicon.json，因為 server.py 實際餵給 Comfy 的就是它。
 */
function promptVocab() {
  const lex = JSON.parse(readFileSync(join(here, "..", "web", "lexicon.json"), "utf8"));
  const out = new Set();
  const eat = (v) => {
    if (typeof v === "string") for (const t of v.split(",")) { const x = t.trim(); if (x) out.add(x); }
    else if (Array.isArray(v)) for (const t of v) { const x = String(t).trim(); if (x) out.add(x); }
  };
  for (const key of [
    "negative", "sfwNegative", "sensitiveNegative",
    "quality", "nsfwTail", "sfwTail", "sensitiveTail", "alwaysEnv",
  ]) eat(lex[key]);
  // quality 這一段（畫質加成與畫風）也是提示詞骨架，不是畫面內容 —— 跟上面那幾個
  // 清單同一種東西，只是它們住在 tags 陣列裡而不是頂層清單裡。
  //
  // 少了這一行，`--all` 會把 highres（818 萬張）、absurdres（300 萬張）、
  // watercolor (medium)（2.2 萬張）判成 BAD，理由是「category 5（不是一般 tag）」。
  // 那三個在 Danbooru 上活得好好的，只是 meta 分類。用「必須 category 0」去判
  // 畫質字彙，就是上面 toRecord() 註解在講的套錯規則。
  //
  // metaOk 只放行「健康的 meta」（見 toRecord）：deprecated 或 post_count 0
  // 的畫質字照樣會被擋下來 —— cel shading、clean lines、webtoon 就還是 BAD。
  for (const t of lex.tags || []) {
    if (t && t.section === "quality" && t.tag) out.add(t.tag);
  }
  return out;
}

/**
 * 整個詞庫都驗，這是預設。
 *
 * 舊版預設只驗運動 tag ＋ 固定字彙約 122 個，其餘一千多個從來沒被查證過 ——
 * 實際後果就是 lotus pond、great hall 那五個自創字活了很久，還有十幾個早就被
 * alias 併走的舊名（wink、sento、cravat…）一直在用。
 *
 * 舊註解寫著「那批 post_count 0 的字裁決完之後應該改成預設」。2026-09-18 裁決完了：
 *   - 移除 21 個（14 個從來沒有圖的，6 個 2022～23 就停用改標的，加上 adult）
 *   - 保留 hairpin 與七個 deprecated 舊名；它們的 alias／停用日期晚於模型訓練
 *   - 拿掉現代的時代錨（modern 在 Danbooru 是 artist 分類、0 張）
 *   - adult 也是 0 張，而它唯一的作用是「跟 shota 互斥」，也就是靠一個死字
 *     繞一圈讓 shota 抽不到。那條規則已改寫成直接的「shota 不進自動抽牌」，
 *     行為一格未動（實測同一批 seed：loli 23→23、shota 0→0、petite 164→164）。
 * 之後 `--all` 是 0 BAD，所以這裡翻成預設。要回舊行為用 `--sports-only`。
 */
function lexiconTags() {
  const raw = readFileSync(join(here, "..", "web", "lexicon.json"), "utf8");
  const data = JSON.parse(raw);
  return (data.tags || []).map((t) => t.tag).filter(Boolean);
}

async function loadInventory(all) {
  const mod = await import("../web/sports.js");
  if (typeof mod.allSportTags !== "function") {
    throw new CliError(
      "web/sports.js 沒有匯出 allSportTags()。驗證器不自己拼清單，請先補上這個函式。"
    );
  }
  const tags = mod.allSportTags();
  if (!Array.isArray(tags) || !tags.length) {
    throw new CliError("allSportTags() 沒有回傳任何 tag。");
  }
  // 運動 tag ＋ 每張圖都會用到的固定字彙，一次驗完。--all 再加上整個詞庫。
  const base = [...tags, ...promptVocab()];
  if (all) base.push(...lexiconTags());
  return [...new Set(base)].sort();
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    if (err instanceof CliError) {
      console.error(err.message);
      process.exitCode = 2;
      return;
    }
    throw err;
  }

  const prompts = opts.tags.length ? null : promptVocab();
  const wanted = opts.tags.length ? opts.tags : await loadInventory(opts.all);
  const all = [...new Set([...wanted, ...FORBIDDEN])];
  const found = await lookup(all, opts.retries, RETRY_WAIT_MS);
  const report = buildReport(wanted, FORBIDDEN, found, {
    maxCreatedYear: opts.maxCreatedYear,
    metaOk: prompts,
    category: opts.category,
  });

  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(
    `核實 ${wanted.length} 個 tag，${report.ok.length} 通過、${report.bad.length} 不通過`
  );
  for (const r of report.bad) console.log(`  BAD  ${r.tag} — ${r.verdict}`);

  if (report.maxCreatedYear !== null) {
    console.log(
      `建立年份晚於 ${report.maxCreatedYear} 的有 ${report.newerThanCutoff.length} 個` +
        "（只是模型詞彙相容性的警告，不代表 tag 無效，也不影響 exit code）"
    );
    for (const r of report.newerThanCutoff) {
      console.log(
        `  NEW  ${r.tag} — 建立於 ${String(r.created_at).slice(0, 10)}，post_count ${r.post_count}`
      );
    }
  }

  console.log(
    `禁用清單 ${FORBIDDEN.length} 個，${report.forbiddenStillBad.length} 確認仍不可用`
  );
  for (const r of report.forbiddenNowFine) {
    console.log(`  NOTE ${r.tag} — 現在是有效 tag（仍照使用者指示不採用）`);
  }
  console.log(`報告寫到 ${OUT}`);

  if (report.bad.length) process.exitCode = 1;
}

// 只有直接跑這支檔案才執行 main。用 pathToFileURL 比較，Windows 的磁碟機代號和
// 反斜線才會被正規化成同一種 file:// 形式；在 Windows 上直接比字串會對不起來。
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main(process.argv.slice(2)).catch((err) => {
    if (err instanceof CliError) {
      console.error(err.message);
      process.exitCode = 2;
      return;
    }
    console.error("核實失敗：" + err.message);
    process.exitCode = 2;
  });
}
