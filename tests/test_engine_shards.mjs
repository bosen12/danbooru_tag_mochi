#!/usr/bin/env node
/**
 * test_engine.mjs 分成幾份同時跑。單獨跑一支要十幾分鐘，整套測試都在等它。
 *
 * 不改 test_engine.mjs：讀進來，把頂層的 `{ … }` 區塊（每個都是一組獨立的測試，變數都關在裡面）
 * 改成 `if (第幾份) { … }`，寫成暫存檔，開 N 個 node 各跑一份。所以 test_engine.mjs 照舊可以單獨跑，
 * 新加的區塊也自動分進來。只認寫在第 0 欄的 `{`／`}`（現在每個區塊都這樣寫）；寫成別的樣子的
 * 區塊每一份都會跑到，結果一樣對，只是多花時間。
 *
 * 區塊有輕有重（最重的一個就要幾分鐘），照區塊順序輪流分會不平均：COST 記著重的那幾個
 * （用區塊裡第一個測試名稱認，行號會變），先排重的、每次放進目前最輕的那一份。
 *
 *   node scripts/test_engine_shards.mjs          # 預設 6 份（核心不夠就少幾份）
 *   node scripts/test_engine_shards.mjs -j 6
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, availableParallelism } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, "test_engine.mjs");
const jArg = process.argv.indexOf("-j");
const N = Math.max(1, Number(jArg > 0 ? process.argv[jArg + 1] : 0) || Math.min(6, availableParallelism()));

// 重的區塊（秒，單獨跑量的）：鍵是區塊裡第一個 ok(...)／eq(...) 的名稱。沒列到的當 1 秒。
// 2026-10-17 量的：148 個區塊單獨跑共 1657 秒，這 45 個佔 1548 秒。
const COST = {
  "性愛模式下每個時代都抽得到至少 6 種場地": 130,
  "gear/place ${mode}：釘「${place}」不該抽到「${gear}」": 104,
  "配件沒有場合就不該出現（${n} 張）": 101,
  "lexicon excludes the nonexistent ski slope tag": 94,
  "浴場的取樣夠多，這條測試不是空轉": 89,
  "pinned swimming never leftover armor/suit/cheerleader": 85,
  "builtin presets exist": 62,
  "鏡頭可達 對照組：「${cam}」抽得到": 60,
  "取代舊名的正規名抽得到：「${t}」": 58,
  "in/out：釘「${t}」不該再抽到 indoors": 54,
  "上衣的取樣夠多，這條測試不是空轉": 51,
  "游泳的取樣夠多，這條測試不是空轉": 51,
  "父子相依：無關的忙手活動仍然互斥": 45,
  "twilight control: starry sky 抽得到": 42,
  "取樣夠多：真的有找到會擋性愛的字": 34,
  "lex has ${t}": 32,
  "取樣夠多：真的抽到一男一女的性愛圖": 29,
  "色彩變體：現代至少抽得到 20 種": 29,
  "5girls is a female count": 29,
  "每張圖都有講光源（靠真的抽，不是靠一句固定尾巴）": 29,
  "env: 正常模式高 env 不製造矛盾": 29,
  "swimming never auto standing/squatting/kneeling": 27,
  "沒有哪一件衣服佔掉一個時代過半的畫面": 25,
  "穿好了又沒脫衣動作就不該標內衣（${n} 張）": 22,
  "男女性愛抽得到性玩具": 21,
  "先釘室外再釘溫泉，室外留著": 20,
  "時代訊號：不會塞一整排時代字": 19,
  "SFW 的取樣夠多，這條測試不是空轉": 19,
  "分級 ${rating}：沒有該級不該有的字漏出來": 19,
  "活動尺度的取樣夠多，這條測試不是空轉": 16,
  "性愛時序：不會同時「即將」和「已經結束」": 14,
  "正常模式抽得到乳貼": 11,
  "角色：抽角色關著（預設）不會隨機抽到角色": 10,
  "正常模式一個男人人種都不抽（含傘狀的 monster boy）": 10,
  "sex 姿勢字種數不該塌到硬桶的水準（至少 200 種）": 10,
  "${tag} implies ponytail and not braid": 9,
  "整套制服不會再疊一件外套": 8,
  "現代煮飯仍是廚房": 8,
  "品質規則九格各 40 張加釘選，怪組合是 0（${n} 張隨機）": 7,
  "男性維多利亞上衣樣本足夠": 6,
  "bird's eye view implies from above": 6,
  "shota is in the lexicon": 6,
  "day never auto starry sky or moonlight": 6,
  "pose10 never two leftover eye extras": 5,
  "no mustDraw means empty report": 5,
};

const lines = readFileSync(SOURCE, "utf8").split("\n");
const blocks = []; // [開始行, 結束行]
for (let i = 0, open = -1; i < lines.length; i++) {
  const s = lines[i].trimEnd();
  if (open < 0 && s === "{") open = i;
  else if (open >= 0 && s === "}") {
    blocks.push([open, i]);
    open = -1;
  }
}
const nameOf = ([a, b]) => {
  for (let i = a; i <= b; i++) {
    const m = lines[i].match(/\b(?:ok|eq)\(\s*(["'`])((?:\\.|(?!\1).)*)\1/);
    if (m) return m[2];
  }
  return "";
};
// 先排重的，每次放進目前最輕的那一份。
const order = blocks.map((b, i) => ({ i, cost: COST[nameOf(b)] ?? 1 })).sort((x, y) => y.cost - x.cost || x.i - y.i);
const load = Array(N).fill(0);
const shardOf = [];
for (const { i, cost } of order) {
  const k = load.indexOf(Math.min(...load));
  shardOf[i] = k;
  load[k] += cost;
}

// 暫存檔放在系統暫存資料夾：相對路徑的 import、import.meta.url 換成原檔的位置。
const srcUrl = pathToFileURL(SOURCE).href;
const webUrl = new URL("../web/", srcUrl).href;
const out = lines.slice();
blocks.forEach(([a], i) => (out[a] = `if (__SHARD === ${shardOf[i]}) {`));
let text = out
  .join("\n")
  .replace(/^#!.*\n/, "")
  .replace(/(from\s+["'])\.\.\/web\//g, `$1${webUrl}`)
  .replaceAll("import.meta.url", JSON.stringify(srcUrl));
text = `const __SHARD = Number(process.env.ENGINE_SHARD);\n` + text;
const dir = mkdtempSync(join(tmpdir(), "engine-shards-"));
const file = join(dir, "test_engine.shard.mjs");
writeFileSync(file, text);

console.log(`test_engine：${blocks.length} 個區塊分成 ${N} 份同時跑`);
const t0 = Date.now();
const runs = Array.from({ length: N }, (_, k) =>
  new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [file], { env: { ...process.env, ENGINE_SHARD: String(k) }, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("close", (code) => resolve({ k, code, log, secs: (Date.now() - started) / 1000 }));
  })
);
const results = await Promise.all(runs);
rmSync(dir, { recursive: true, force: true });

let failed = 0;
let passed = 0;
for (const r of results) {
  passed += (r.log.match(/^ok {3}/gm) || []).length;
  const fails = r.log.split("\n").filter((l, i, all) => l.startsWith("FAIL") || (l.startsWith("  ") && all[i - 1]?.startsWith("FAIL")));
  console.log(`第 ${r.k + 1} 份：${r.code === 0 ? "通過" : "失敗"}，${r.secs.toFixed(0)} 秒`);
  if (r.code !== 0) {
    failed += 1;
    // 斷言失敗印 FAIL 那幾行；整支炸掉（例外）就把最後一段印出來。
    console.error(fails.length ? fails.join("\n") : r.log.split("\n").slice(-30).join("\n"));
  }
}
console.log(`\n${passed} 項通過，共 ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
if (failed) process.exit(1);
console.log("ok");
