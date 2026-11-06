// 墨池 MCP（mcp/mochi-mcp.mjs）：用 stdio 跟它講 MCP，查牌、解釋、檢查、抽牌照引擎走；生圖接一個假的墨池伺服器
// （本機隨機埠，回 SSE），絕對不會真的送 ComfyUI。
//
//   node scripts/test_mochi_mcp.mjs
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : "\n     " + String(detail).slice(0, 600)}`);
  if (!cond) failed++;
};

// ---- 假的墨池：/api/gen 回 SSE（排隊 → 兩格進度 → 印好），其餘回固定資料 ----
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const got = [];
let slow = false;
const fake = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/api/gen") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const p = JSON.parse(body);
      got.push({ body: p, headers: req.headers });
      if (p.positive.includes("explode")) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "ComfyUI 連不上 http://127.0.0.1:8188：先開 ComfyUI" }));
      }
      res.writeHead(200, { "Content-Type": "text/event-stream", "X-Gen-Job": p.job });
      const ev = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      ev("queued", { prompt_id: "pid-12345678" });
      ev("progress", { value: 10, max: 20 });
      setTimeout(() => {
        ev("done", { ok: true, image: "/api/image?filename=mcp_00001_.png&subfolder=&type=output", seed: 4242 });
        res.end();
      }, slow ? 1500 : 30);
    });
    return;
  }
  if (url.pathname === "/api/image") {
    got.push({ image: url.search });
    res.writeHead(200, { "Content-Type": "image/png" });
    return res.end(PNG);
  }
  const json = (v) => (res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(v)));
  // 跟真的墨池一樣的形狀（/api/checkpoints 的 ckpt_name 含子資料夾；/api/loras 是 LoRA Manager 的清單）。
  if (url.pathname === "/api/checkpoints") return json({ ok: true, current: "il\waiIllustriousSDXL_v170.safetensors", items: [{ file: "waiIllustriousSDXL_v170.safetensors", ckpt_name: "il\waiIllustriousSDXL_v170.safetensors" }] });
  if (url.pathname === "/api/loras") return json({ items: [{ folder: "style", category: "style", file: "detail.safetensors", name: "detail", title: "Detail Tweaker", trainedWords: ["detailed"] }, { folder: "Character", category: "Character", file: "x.safetensors", name: "x", title: "X" }], counts: { style: 1, Character: 1 } });
  if (url.pathname === "/api/genlog") return json({ ok: true, items: [{ ok: true, origin: "mcp", positive: "1girl, solo", seed: 1, image: "/api/image?filename=a.png&type=output" }] });
  if (url.pathname === "/api/gen/recover") return json({ ok: true, state: "gone" });
  res.writeHead(404);
  res.end();
});
await new Promise((r) => fake.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${fake.address().port}`;

// ---- MCP 程式 ----
const mcp = spawn(process.execPath, [join(ROOT, "mcp", "mochi-mcp.mjs")], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, MOCHI_URL: BASE } });
let stderr = "";
mcp.stderr.on("data", (d) => (stderr += d));
let buf = "";
let nextId = 0;
const waiting = new Map();
const stray = [];
mcp.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      stray.push(line);
      continue;
    }
    waiting.get(m.id)?.(m);
  }
});
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    const t = setTimeout(() => reject(new Error(`${method} 沒有回應`)), 20000);
    waiting.set(id, (m) => (clearTimeout(t), resolve(m)));
    mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
const tool = async (name, args) => {
  const r = (await rpc("tools/call", { name, arguments: args })).result;
  const text = r.content.find((c) => c.type === "text")?.text || "";
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { error: !!r.isError, text, data, image: r.content.find((c) => c.type === "image") };
};

try {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  ok("initialize：回協定版本、伺服器名稱、說明", init.result?.protocolVersion === "2025-06-18" && init.result.serverInfo.name === "mochi" && /未成年/.test(init.result.instructions));
  mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const list = (await rpc("tools/list")).result.tools;
  const names = list.map((t) => t.name);
  ok("九個工具都在、每個都有說明和輸入格式", ["mochi_guide", "search_cards", "explain_card", "check_cards", "draw_prompt", "generate_image", "image_status", "list_models", "recent_images"].every((n) => names.includes(n)) && list.every((t) => t.description && t.inputSchema?.type === "object"), names.join(" "));
  ok("只有 generate_image 不是唯讀", list.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name).join() === "generate_image");
  ok("不認得的方法回 -32601", (await rpc("resources/list")).error?.code === -32601);

  const guide = await tool("mochi_guide", {});
  ok("guide：講五段、尺度、分級、互斥、建議流程", !guide.error && ["feature", "activity", "general", "互斥", "draw_prompt", "未成年"].every((w) => guide.text.includes(w)));

  const s = await tool("search_cards", { queries: ["公園", "人妻", "棒球", "zzzz不存在"] });
  const r = s.data.results;
  ok("查牌：中文對到 park（全年齡、活動尺度也有）", r["公園"]?.[0]?.startsWith("park ｜ 公園") && /尺度:activity/.test(r["公園"][0]) && /分級:general/.test(r["公園"][0]), JSON.stringify(r["公園"]));
  ok("查牌：人妻走同義詞 → 成熟女性、婚戒", Array.isArray(r["人妻"]) && r["人妻"].some((l) => l.startsWith("mature female")) && r["人妻"].some((l) => l.startsWith("wedding ring")), JSON.stringify(r["人妻"]));
  ok("查牌：查不到的說清楚下一步", typeof r["zzzz不存在"] === "string" && r["zzzz不存在"].includes("extra"));
  const minorSearch = await tool("search_cards", { queries: ["loli"] });
  ok("查牌：未成年的字不查", minorSearch.data.results.loli?.blocked === "不能畫未成年角色");

  const e = await tool("explain_card", { tag: "park" });
  ok("解釋：公園跟臥室互斥、帶出室外", e.data.mutexGroup === "place" && e.data.mutexWith.examples.some((x) => x.includes("bedroom")) && e.data.implies.some((x) => x.includes("outdoors")), e.text);
  const e2 = await tool("explain_card", { tag: "不存在的牌" });
  ok("解釋：詞庫沒有的回 found:false", e2.data.found === false);

  const c = await tool("check_cards", { tags: ["park", "bedroom", "holding baseball bat", "nude"], heats: ["activity"], rating: "general" });
  ok("檢查：後釘的臥室把公園換掉（說是互斥）", c.data.allFit === false && c.data.displacedWhilePinning.some((d) => d.tag === "park" && d.by === "bedroom" && /互斥/.test(d.why)), c.text);
  ok("檢查：全年齡把裸體擋掉、附原因", c.data.removedByRules.some((x) => x.includes("nude") && /分級/.test(x)), c.text);
  ok("檢查：球棒配臥室有運動場地的提醒", c.data.warnings.some((w) => w.tags.includes("bedroom")), c.text);
  ok("檢查：自動帶出的寫來源（附帶、預設一人）", c.data.addedAutomatically.some((x) => x.includes("baseball bat") && x.includes("暗示")) && c.data.addedAutomatically.some((x) => x.includes("1girl") && x.includes("預設一人")), c.text);
  const fit = await tool("check_cards", { tags: ["park", "holding baseball bat", "baseball uniform"], heats: ["activity"], rating: "general" });
  ok("檢查：放得在一起的回 allFit", fit.data.allFit === true && fit.data.kept.length === 3, fit.text);

  const spec = { pins: ["mature female", "wedding ring", "park", "holding baseball bat", "baseball uniform", "playing sports"], counts: { feature: 2, pose: 2, clothing: 1, env: 2 }, heats: ["activity"], rating: "general", seed: 7 };
  const d1 = await tool("draw_prompt", spec);
  const d2 = await tool("draw_prompt", spec);
  const res = d1.data.results?.[0];
  const tags = res?.positive.split(", ") || [];
  ok("抽牌：同設定同種子抽出一樣的", res && res.positive === d2.data.results[0].positive);
  ok("抽牌：釘的都在、沒說幾個人預設 1girl、有 adult、全年齡尾巴", spec.pins.every((t) => tags.includes(t)) && tags[0] === "1girl" && tags.includes("adult") && tags.includes("general") && d1.data.defaultedPeople === "1girl", res?.positive);
  ok("抽牌：每張牌依來源分組（釘選、暗示帶入、隨機、預設一人）", ["釘選", "暗示帶入", "預設一人"].every((k) => Array.isArray(res.cards[k])) && res.cards["暗示帶入"].some((x) => x.includes("baseball bat") && x.includes("←")), JSON.stringify(res?.cards));
  ok("抽牌：張數少，提示詞短（25 個以內）", tags.length <= 25, tags.length);
  const two = await tool("draw_prompt", { pins: ["2girls"], seed: 3, heats: ["activity"], rating: "general" });
  ok("抽牌：釘了人數就不再補 1girl", two.data.defaultedPeople === null && two.data.results[0].positive.startsWith("2girls"), two.data.results?.[0]?.positive);
  const extra = await tool("draw_prompt", { pins: ["park"], extra: ["made-up tag"], seed: 1, heats: ["activity"], rating: "general" });
  ok("抽牌：extra 接在分級字前面", /made-up tag, sfw|made-up tag, general/.test(extra.data.results[0].positive), extra.data.results?.[0]?.positive);
  const minor = await tool("draw_prompt", { pins: ["loli"] });
  ok("抽牌：未成年擋下（isError）", minor.error && /未成年/.test(minor.text));
  const minorExtra = await tool("draw_prompt", { extra: ["child"] });
  ok("抽牌：extra 的未成年字也擋", minorExtra.error);

  const g = await tool("generate_image", { positive: res.positive.replace("park", "baseball (object), park"), rating: "general", width: 832, height: 1216, seed: 99, era: "modern" });
  const sent = got.find((x) => x.body)?.body;
  const headers = got.find((x) => x.body)?.headers;
  ok("生圖：經墨池 /api/gen（SSE、可接回、來源寫 mcp）", sent && sent.origin === "mcp" && headers.accept === "text/event-stream" && headers["x-gen-resume"] === "1" && /^mcp-[0-9a-f]{16}$/.test(sent.job), JSON.stringify(sent));
  ok("生圖：括號照墨池的規矩跳脫、尺寸分級種子帶上", sent.positive.includes("baseball \\(object\\)") && sent.width === 832 && sent.height === 1216 && sent.rating === "general" && sent.seed === 99 && sent.era === "modern", JSON.stringify(sent));
  ok("生圖：等到印好，回網址、種子、縮圖（?w=480）", g.data.state === "done" && g.data.seed === 4242 && g.data.imageUrl === BASE + "/api/image?filename=mcp_00001_.png&subfolder=&type=output" && g.image?.mimeType === "image/png" && got.some((x) => x.image?.includes("w=480")), g.text);

  slow = true;
  const g2 = await tool("generate_image", { positive: "1girl, solo", wait_seconds: 0 });
  ok("生圖：不等的話先回 job、說用 image_status", g2.data.state !== "done" && g2.data.job && /image_status/.test(g2.data.next), g2.text);
  const st = await tool("image_status", { job: g2.data.job, wait_seconds: 10 });
  ok("image_status：接著等到印好", st.data.state === "done" && st.image, st.text);
  slow = false;
  const gone = await tool("image_status", { job: "mcp-unknown-job" });
  ok("image_status：不是這次送的，問墨池", gone.data.state === "gone");

  const blocked = await tool("generate_image", { positive: "1girl, loli, solo" });
  ok("生圖：未成年字擋下、沒送出去", blocked.error && !got.some((x) => x.body?.positive.includes("loli")));
  const down = await tool("generate_image", { positive: "explode" });
  ok("生圖：墨池回錯誤就照實轉告", down.error && /ComfyUI 連不上/.test(down.text), down.text);
  const bad = await tool("generate_image", { positive: "1girl", width: 99999 });
  ok("生圖：尺寸超出範圍擋下", bad.error && /width/.test(bad.text));

  const m = await tool("list_models", {});
  ok("list_models：底模用 ckpt_name、LoRA 不全列只給數量", m.data.checkpoints[0] === "il\waiIllustriousSDXL_v170.safetensors" && m.data.currentCheckpoint && m.data.loraCount === 2 && !m.data.loras && m.data.loraHint, m.text);
  const lq = await tool("list_models", { lora_query: "detail" });
  ok("list_models：lora_query 找標題，附資料夾和觸發詞", lq.data.loras.length === 1 && lq.data.loras[0].file === "detail.safetensors" && lq.data.loras[0].folder === "style" && lq.data.loras[0].triggers[0] === "detailed", lq.text);
  const recent = await tool("recent_images", { limit: 3 });
  ok("recent_images：來源 mcp 寫成 AI、網址補完整", recent.data.images[0].from === "AI" && recent.data.images[0].imageUrl === BASE + "/api/image?filename=a.png&type=output", recent.text);

  const none = await tool("沒有這個", {});
  ok("不認得的工具回 isError", none.error);
  ok("stdout 只有協定訊息（紀錄都在 stderr）", !stray.length && /mochi-mcp/.test(stderr), stray.join("\n"));
} catch (err) {
  ok("沒有例外", false, err.stack);
} finally {
  mcp.stdin.end();
  fake.close();
}

// 墨池那邊：送 origin mcp 的工作，伺服器要認（頂欄、日誌寫「AI」）。
const { readFileSync, existsSync } = await import("node:fs");
// 這邊的墨池在 web6/，開源版在 web/。
const FRONT = existsSync(join(ROOT, "web6", "gen-status.js")) ? "web6" : "web";
const server = readFileSync(join(ROOT, "server.py"), "utf8");
const status = readFileSync(join(ROOT, FRONT, "gen-status.js"), "utf8");
ok("伺服器認 origin mcp；頂欄、日誌寫 AI、點了看作品冊日誌", server.includes('in ("mochi", "fuse", "mcp")') && status.includes('mcp: "album.html?tab=log"') && readFileSync(join(ROOT, FRONT, "album-log.js"), "utf8").includes('mcp: "AI"'));

console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
