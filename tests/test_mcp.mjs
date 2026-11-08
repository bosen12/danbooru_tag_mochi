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
  if (url.pathname === "/api/loras") return json({ items: [{ folder: "style", category: "style", file: "detail.safetensors", name: "detail", title: "Detail Tweaker", trainedWords: ["detailed"] }, { folder: "Character", category: "Character", file: "x.safetensors", name: "x", title: "X", trainedWords: ["alpha trigger", "beta trigger"] }], counts: { style: 1, Character: 1 } });
  if (url.pathname === "/api/genlog") return json({ ok: true, items: [{ ok: true, origin: "mcp", positive: "1girl, solo", seed: 1, image: "/api/image?filename=a.png&type=output" }] });
  if (url.pathname === "/api/gen/recover") return json({ ok: true, state: "gone" });
  if (url.pathname === "/api/decks") return json({ ok: true, decks: [{ id: "d-1", name: "書房午後", tags: ["library", "reading", "glasses"], weights: { glasses: 1.2 } }] });
  if (url.pathname === "/api/custom-cards") return json({ ok: true, cards: [{ id: "abc", name: "我的女僕", rating: "general", members: [{ tag: "maid", w: 1.2 }, { tag: "smile", w: 1 }], extra: [{ text: "made up thing", w: 1 }] }, { id: "hot", name: "辣的", rating: "explicit", members: [{ tag: "smile", w: 1 }], extra: [] }] });
  if (url.pathname === "/api/fav-chars") return json({ ok: true, tags: ["hatsune miku", "yor briar"] });
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
  ok("十一個工具都在、每個都有說明和輸入格式", ["mochi_guide", "search_cards", "explain_card", "check_cards", "draw_prompt", "generate_image", "fix_image", "my_cards", "image_status", "list_models", "recent_images"].every((n) => names.includes(n)) && list.every((t) => t.description && t.inputSchema?.type === "object"), names.join(" "));
  const genTool = list.find((t) => t.name === "generate_image");
  const fixTool = list.find((t) => t.name === "fix_image");
  const loraText = JSON.stringify(genTool?.inputSchema?.properties?.loras || {}) + JSON.stringify(fixTool?.inputSchema?.properties?.loras || {});
  ok("生圖、修圖的 loras 說明是自動插觸發詞", /自動插/.test(genTool?.inputSchema?.properties?.loras?.description || "") && /自動插/.test(fixTool?.inputSchema?.properties?.loras?.description || "") && /triggers/.test(loraText) && !/自己加/.test(loraText), loraText.slice(0, 400));
  ok("只有生圖、修圖不是唯讀", list.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name).join() === "generate_image,fix_image");
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
  ok("抽牌：釘的都在、沒說幾個人預設 1girl、跟墨池一樣不補 adult、全年齡尾巴", spec.pins.every((t) => tags.includes(t)) && tags[0] === "1girl" && !tags.includes("adult") && tags.includes("general") && d1.data.defaultedPeople === "1girl", res?.positive);
  ok("抽牌：每張牌依來源分組（釘選、暗示帶入、隨機、預設一人）", ["釘選", "暗示帶入", "預設一人"].every((k) => Array.isArray(res.cards[k])) && res.cards["暗示帶入"].some((x) => x.includes("baseball bat") && x.includes("←")), JSON.stringify(res?.cards));
  ok("抽牌：張數少，提示詞短（25 個以內）", tags.length <= 25, tags.length);
  const zero = await tool("draw_prompt", { pins: ["huge breasts", "mature female", "wedding ring", "swimming", "swimsuit", "pool"], counts: { feature: 0, pose: 0, clothing: 0, env: 0 }, seed: 5 });
  const zr = zero.data.results?.[0];
  const randomZero = (zr?.cards["隨機抽取"] || []).filter((x) => !x.includes("（solo）"));
  ok("不要抽（四段 0）：只有釘的牌和附帶的，不隨機補", zr && randomZero.length === 0 && zr.cards["暗示帶入"]?.some((x) => x.includes("（ring）")) && /sfw, general, masterpiece/.test(zr.positive), JSON.stringify(zr?.cards));
  ok("說明書教 AI：不要抽就 counts 全 0、照樣用 draw_prompt", /不要抽/.test(guide.text) && /counts 四段都給 0/.test(guide.text));
  const two = await tool("draw_prompt", { pins: ["2girls"], seed: 3, heats: ["activity"], rating: "general" });
  ok("抽牌：釘了人數就不再補 1girl", two.data.defaultedPeople === null && two.data.results[0].positive.startsWith("2girls"), two.data.results?.[0]?.positive);
  const extra = await tool("draw_prompt", { pins: ["park"], extra: ["made-up tag"], seed: 1, heats: ["activity"], rating: "general" });
  ok("抽牌：extra 接在分級字前面", /made-up tag, sfw|made-up tag, general/.test(extra.data.results[0].positive), extra.data.results?.[0]?.positive);
  const minor = await tool("draw_prompt", { pins: ["loli"] });
  ok("抽牌：未成年擋下（isError）", minor.error && /未成年/.test(minor.text));
  const minorExtra = await tool("draw_prompt", { extra: ["child"] });
  ok("抽牌：extra 的未成年字也擋", minorExtra.error);

  // ---- 禁用角色（2026-11-06：以前詞庫找不到就當詞庫外接進去）----
  const bs = await tool("search_cards", { queries: ["初音", "初音未來", "hatsune miku"] });
  const r0 = bs.data.results;
  ok("禁用角色：中文、英文查都說是禁用、別硬塞", ["初音", "hatsune miku"].every((q) => /禁用角色/.test(r0[q]?.blocked || "") && /extra/.test(r0[q].blocked)), bs.text);
  ok("禁用角色：全名查（初音未來）先提醒，角色扮演服照列", Array.isArray(r0["初音未來"]) && /禁用角色/.test(r0["初音未來"][0]) && r0["初音未來"].some((l) => l.startsWith("hatsune miku (cosplay)")), bs.text);
  const bp = await tool("draw_prompt", { pins: ["hatsune miku"] });
  const be = await tool("draw_prompt", { extra: ["(rem (re:zero):1.2)"] });
  const bc = await tool("check_cards", { tags: ["hatsune_miku"] });
  ok("禁用角色：釘選、extra（帶份量）、檢查都擋", bp.error && be.error && bc.error && [bp, be, bc].every((x) => /禁用角色/.test(x.text)), [bp.text, be.text, bc.text].join(" / "));
  const bg = await tool("generate_image", { positive: "1girl, (hatsune miku:1.1), smile" });
  ok("禁用角色：生圖擋下、沒送出去", bg.error && !got.some((x) => x.body?.positive.includes("miku")));

  // ---- 沒指定分級 → 全年齡 ----
  const plain = await tool("draw_prompt", { pins: ["park"], seed: 5 });
  const pt = plain.data.results[0].positive.split(", ");
  ok("沒給尺度、分級：全年齡（general、沒有 nsfw）、說明有寫", pt.includes("general") && !pt.includes("nsfw") && !pt.includes("explicit") && plain.data.settings.rating === "general" && plain.data.notes.some((n) => /全年齡/.test(n)), plain.text.slice(0, 400));
  const sexOnly = await tool("draw_prompt", { pins: ["park"], heats: ["sex"], seed: 5 });
  ok("只給性愛尺度：分級推成色情", sexOnly.data.settings.rating === "explicit" && sexOnly.data.results[0].positive.includes("explicit"), sexOnly.data.settings?.rating);

  // ---- 份量 ----
  const wt = await tool("draw_prompt", { pins: ["(park:1.3)", "smile"], weights: { smile: 2 }, seed: 5, heats: ["activity"], rating: "general" });
  const wp = wt.data.results[0].positive;
  ok("份量：pins 的 (park:1.3) 照釘、帶出室外；weights 夾到 1.5", wp.includes("(park:1.3)") && wp.includes("(smile:1.5)") && wp.split(", ").includes("outdoors") && !wt.data.notInLexicon.length && !wt.data.results[0].droppedPins.length, wp);

  // ---- 牌組、自製牌、偏好角色 ----
  const deck = await tool("draw_prompt", { deck: "書房午後", seed: 2, heats: ["activity"], rating: "general" });
  const dp = deck.data.results?.[0]?.positive || "";
  ok("牌組：整組的牌和份量放進來", ["library", "reading", "(glasses:1.2)"].every((t) => dp.split(", ").includes(t)) && deck.data.notes.some((n) => n.includes("書房午後")), deck.text.slice(0, 400));
  const noDeck = await tool("draw_prompt", { deck: "沒有這組" });
  ok("牌組：找不到說清楚", noDeck.error && /my_cards/.test(noDeck.text));
  const cc = await tool("draw_prompt", { pins: ["custom:abc"], seed: 2, heats: ["activity"], rating: "general" });
  const cp = cc.data.results?.[0]?.positive || "";
  ok("自製牌：拆成裡面的牌（帶份量）＋詞庫外的字", cp.includes("(maid:1.2)") && cp.split(", ").includes("smile") && cp.includes("made up thing"), cc.text.slice(0, 500));
  const ccName = await tool("draw_prompt", { pins: ["我的女僕"], seed: 2, heats: ["activity"], rating: "general" });
  ok("自製牌：用名字也找得到", ccName.data.results?.[0]?.positive.includes("(maid:1.2)"), ccName.text.slice(0, 300));
  const hot = await tool("draw_prompt", { pins: ["custom:hot"], heats: ["activity"], rating: "general" });
  ok("自製牌：分級比這次高的擋下", hot.error && /色情/.test(hot.text), hot.text);
  const fav = await tool("draw_prompt", { favoriteCharacter: true, seed: 9, heats: ["activity"], rating: "general" });
  ok("偏好角色：跳過禁用的，挑到能用的", fav.data.results?.[0]?.positive.split(", ").includes("yor briar") && !fav.data.results[0].positive.includes("miku"), fav.text.slice(0, 400));
  const mc = await tool("my_cards", {});
  ok("my_cards：牌組、自製牌（custom: 標籤）、偏好角色（禁用的不列、說跳過幾個）", mc.data.decks[0].name === "書房午後" && mc.data.decks[0].cards.some((c) => c.includes("glasses") && c.includes("×1.2")) && mc.data.customCards[0].tag === "custom:abc" && mc.data.favoriteCharacters.length === 1 && /1 個/.test(mc.data.favoriteCharactersSkipped), mc.text);

  const g = await tool("generate_image", { positive: res.positive.replace("park", "baseball (object), park"), rating: "general", width: 832, height: 1216, seed: 99, era: "modern" });
  const sent = got.find((x) => x.body)?.body;
  const headers = got.find((x) => x.body)?.headers;
  ok("生圖：經墨池 /api/gen（SSE、可接回、來源寫 mcp）", sent && sent.origin === "mcp" && headers.accept === "text/event-stream" && headers["x-gen-resume"] === "1" && /^mcp-[0-9a-f]{16}$/.test(sent.job), JSON.stringify(sent));
  ok("生圖：括號照墨池的規矩跳脫、尺寸分級種子帶上", sent.positive.includes("baseball \\(object\\)") && sent.width === 832 && sent.height === 1216 && sent.rating === "general" && sent.seed === 99 && sent.era === "modern", JSON.stringify(sent));
  ok("生圖：等到印好，回網址、種子、縮圖（?w=480）", g.data.state === "done" && g.data.seed === 4242 && g.data.imageUrl === BASE + "/api/image?filename=mcp_00001_.png&subfolder=&type=output" && g.image?.mimeType === "image/png" && got.some((x) => x.image?.includes("w=480")), g.text);

  const before = got.filter((x) => x.body).length;
  await tool("generate_image", { positive: "1girl, solo, smile, sfw, general, masterpiece" });
  await tool("generate_image", { positive: "1girl, solo, nude, nsfw, explicit" });
  await tool("generate_image", { positive: "1girl, solo" });
  const three = got.filter((x) => x.body).slice(before).map((x) => x.body);
  const rs = three.map((b) => b.rating);
  ok("生圖沒給分級：看提示詞尾巴（general／explicit），看不出來當全年齡", rs.join() === "general,explicit,general", rs.join());
  ok("生圖：AI 自己寫的提示詞經墨池補齊分級字、品質字（不補 adult）", three[2].positive === "1girl, solo, sfw, general, masterpiece, best quality, amazing quality" && three[0].positive === "1girl, solo, smile, sfw, general, masterpiece, best quality, amazing quality" && three[1].positive === "1girl, solo, nude, nsfw, explicit, masterpiece, best quality, amazing quality", three.map((b) => b.positive).join(" | "));
  ok("生圖：抽出來的提示詞原樣送（已經齊了）", sent.positive === res.positive.replace("park", "baseball \\(object\\), park"), sent.positive);
  const before2 = got.filter((x) => x.body).length;
  const tidy = await tool("generate_image", { positive: "1girl, (masterpiece:1.2), nsfw, explicit, beach", rating: "general" });
  const tb = got.filter((x) => x.body).at(-1).body;
  ok("生圖：分級字換成指定分級的、份量照留、回報補了什麼", got.filter((x) => x.body).length === before2 + 1 && tb.positive === "1girl, (masterpiece:1.2), beach, sfw, general, best quality, amazing quality" && /墨池補上/.test(tidy.data.tidied) && /explicit/.test(tidy.data.tidied), tb.positive + " / " + tidy.data?.tidied);

  const face = await tool("fix_image", { mode: "face", job: g.data.job });
  const fb = got.filter((x) => x.body).at(-1).body;
  ok("修臉：沿用那張的提示詞、分級，hires 指向原圖", face.data.state === "done" && fb.hires?.mode === "face" && fb.hires.image === "/api/image?filename=mcp_00001_.png&subfolder=&type=output" && fb.rating === "general" && fb.positive.includes("baseball \\(object\\)") && fb.origin === "mcp", JSON.stringify(fb));
  await tool("fix_image", { mode: "quick", image: BASE + "/api/image?filename=x.png&type=output", positive: "1girl, solo, sfw, general" });
  const qb = got.filter((x) => x.body).at(-1).body;
  ok("Hires：完整網址去掉前綴、預設 1.5 倍", qb.hires?.mode === "quick" && qb.hires.scale === 1.5 && qb.hires.image === "/api/image?filename=x.png&type=output" && qb.rating === "general", JSON.stringify(qb));
  const fbad = await tool("fix_image", { mode: "face" });
  const fmode = await tool("fix_image", { mode: "blur", job: g.data.job });
  ok("修圖：沒有 job 也沒有 image、mode 不對都說清楚", fbad.error && /image/.test(fbad.text) && fmode.error && /face/.test(fmode.text));

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

  // ---- 查牌跟字盒同一套：猜、連寫、複數、limit 含同義詞、女性時男角往後 ----
  const cardLines = (rows) => (Array.isArray(rows) ? rows.filter((l) => l.includes("｜")) : []);
  for (const [q, tag] of [["下雨", "rain"], ["雨天", "rain"], ["穿著和服", "kimono"]]) {
    const rows = (await tool("search_cards", { queries: [q] })).data.results[q];
    ok(`查牌 guess：${q} → ${tag}`, Array.isArray(rows) && /最接近/.test(rows[0]) && rows.some((l) => l.startsWith(tag + " ")), JSON.stringify(rows)?.slice(0, 500));
  }
  const sea = (await tool("search_cards", { queries: ["海邊夕陽"] })).data.results["海邊夕陽"];
  const seaBeach = sea?.findIndex?.((l) => l.startsWith("beach ")) ?? -1;
  const seaSun = sea?.findIndex?.((l) => l.startsWith("sunset ")) ?? -1;
  ok("查牌：海邊夕陽拆開，分別找到海邊和夕陽", Array.isArray(sea) && /沒有一張同時有「海邊」「夕陽」/.test(sea[0]) && seaBeach >= 0 && seaSun > seaBeach, JSON.stringify(sea)?.slice(0, 500));
  const bats = (await tool("search_cards", { queries: ["baseball bats"] })).data.results["baseball bats"];
  ok("查牌：baseball bats 猜到 baseball bat", Array.isArray(bats) && /最接近/.test(bats[0]) && bats.some((l) => l.startsWith("baseball bat ")), JSON.stringify(bats)?.slice(0, 400));
  const fatRows = (await tool("search_cards", { queries: ["胖"], limit: 5 })).data.results["胖"];
  const fatCards = cardLines(fatRows);
  ok("查牌：limit 5 含同義詞，最多 5 張", fatCards.length === 5 && fatRows.length === 5 && fatCards.some((l) => l.startsWith("plump ") || l.includes("同義詞")), JSON.stringify(fatRows));
  ok("查牌：女性時前幾筆沒有男性、沒有角色", fatCards.every((l) => !l.includes("男性才有") && !l.includes("/character")), JSON.stringify(fatRows));

  // ---- 沒給 eras：釘了別的時代就改；有給就不動，不合的寫進 warnings ----
  const edo = await tool("draw_prompt", { pins: ["kimono"], heats: ["activity"], rating: "general", seed: 11 });
  const edoRes = edo.data.results?.[0];
  ok("釘和服沒給 eras：時代改成江戶，結果帶 era，不配現代襪子", !edo.error && edo.data.settings?.eras?.join() === "edo" && edo.data.settings.eraMix === false && edoRes?.era === "edo" && (edo.data.notes || []).some((n) => /江戶/.test(n) && /和服/.test(n)) && edoRes.positive.includes("kimono") && !edoRes.positive.includes("black thighhighs") && !edoRes.positive.includes("two-tone legwear"), edo.text.slice(0, 700));
  const mix = await tool("draw_prompt", { pins: ["kimono", "cellphone"], heats: ["activity"], rating: "general", seed: 12 });
  const mixRes = mix.data.results?.[0];
  ok("釘了兩個時代：改成混合，兩張都留", !mix.error && mix.data.settings?.eraMix === true && mix.data.settings.eras?.length === 6 && mixRes?.era === "mixed" && (mix.data.notes || []).some((n) => /混合/.test(n)) && mixRes.positive.includes("kimono") && mixRes.positive.includes("cellphone"), mix.text.slice(0, 700));
  const badEra = await tool("draw_prompt", { pins: ["kimono"], eras: ["modern"], heats: ["activity"], rating: "general", seed: 13 });
  ok("有給 eras 就不改，不合的牌寫進 warnings", !badEra.error && badEra.data.settings?.eras?.join() === "modern" && badEra.data.settings.eraMix !== true && badEra.data.results?.[0]?.era === "modern" && (badEra.data.warnings || []).some((w) => (w.tags || []).includes("kimono") && /不合/.test(w.note || "")), badEra.text.slice(0, 700));
  const ckEra = await tool("check_cards", { tags: ["kimono"], heats: ["activity"], rating: "general" });
  ok("check_cards 釘和服也改成江戶", !ckEra.error && ckEra.data.settings?.eras?.join() === "edo" && ckEra.data.era === "edo" && (ckEra.data.notes || []).some((n) => /江戶/.test(n)), ckEra.text.slice(0, 500));
  const weighted = await tool("check_cards", { tags: ["(smile:1.3)"], heats: ["activity"], rating: "general" });
  ok("check_cards：kept 看得到份量", !weighted.error && (weighted.data.kept || []).some((s) => s.includes("smile") && s.includes("×1.3")), weighted.text.slice(0, 400));

  // ---- LoRA 觸發詞自動插在人物牌後面 ----
  const beforeLora = got.filter((x) => x.body).length;
  const gLora = await tool("generate_image", { positive: "1girl, solo, smile", loras: [{ file: "detail.safetensors", folder: "style", strength: 0.8 }] });
  const lb = got.filter((x) => x.body).at(-1)?.body;
  ok("生圖 LoRA：觸發詞插在人物牌後、tidied 寫了、送給墨池的沒有 triggers", got.filter((x) => x.body).length === beforeLora + 1 && lb?.positive.includes("1girl, solo, detailed, smile") && /補上觸發詞/.test(gLora.data.tidied || "") && /detailed/.test(gLora.data.tidied || "") && lb.loras?.length === 1 && lb.loras[0].file === "detail.safetensors" && !lb.loras.some((l) => Object.hasOwn(l, "triggers")), (lb?.positive || "") + " / " + (gLora.data?.tidied || "") + " / " + JSON.stringify(lb?.loras));
  const gDup = await tool("generate_image", { positive: "1girl, solo, detailed, smile", loras: [{ file: "detail.safetensors", folder: "style" }] });
  const db = got.filter((x) => x.body).at(-1)?.body;
  ok("生圖 LoRA：提示詞裡已經有的不重插", (db?.positive.match(/detailed/g) || []).length === 1 && !/補上觸發詞/.test(gDup.data.tidied || ""), (db?.positive || "") + " / " + (gDup.data?.tidied || ""));
  const gBeta = await tool("generate_image", { positive: "1girl, solo, smile", loras: [{ file: "x.safetensors", folder: "Character", triggers: ["beta trigger"] }] });
  const bb = got.filter((x) => x.body).at(-1)?.body;
  ok("生圖 LoRA：triggers 指定用哪一個", bb?.positive.includes("beta trigger") && !bb.positive.includes("alpha trigger") && !bb.loras.some((l) => Object.hasOwn(l, "triggers")), bb?.positive);
  const gOff = await tool("generate_image", { positive: "1girl, solo, smile", loras: [{ file: "detail.safetensors", folder: "style", strength: 0 }] });
  const ob = got.filter((x) => x.body).at(-1)?.body;
  ok("生圖 LoRA：強度 0 不插觸發詞", ob && !ob.positive.includes("detailed") && ob.loras?.[0]?.strength === 0 && !ob.loras.some((l) => Object.hasOwn(l, "triggers")), ob?.positive);
  const fx = await tool("fix_image", { mode: "face", job: gLora.data.job, positive: "1girl, solo, smile", loras: [{ file: "detail.safetensors", folder: "style" }] });
  const fxb = got.filter((x) => x.body).at(-1)?.body;
  ok("修圖 LoRA：一樣把觸發詞插在人物牌後", !fx.error && fxb?.positive.includes("1girl, solo, detailed, smile") && /補上觸發詞/.test(fx.data.tidied || "") && !fxb.loras.some((l) => Object.hasOwn(l, "triggers")), (fxb?.positive || "") + " / " + (fx.data?.tidied || ""));
  const fxKeep = await tool("fix_image", { mode: "face", job: gBeta.data.job });
  const kb = got.filter((x) => x.body).at(-1)?.body;
  ok("修圖沿用 LoRA：已指定的觸發詞不改插成預設的第一個", !fxKeep.error && kb?.positive.includes("beta trigger") && !kb.positive.includes("alpha trigger"), kb?.positive);

  ok("list_models：觸發詞自動插，不再叫人自己加", /自動/.test(m.data.note) && !/自己加/.test(m.data.note || ""), m.data.note);

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
ok("伺服器認 origin mcp；頂欄、日誌寫 AI、點了看作品冊日誌", server.includes('in ("mochi", "fuse", "mcp", "ios")') && status.includes('mcp: "album.html?tab=log"') && readFileSync(join(ROOT, FRONT, "album-log.js"), "utf8").includes('mcp: "AI"'));
// iPhone App（origin ios）也一樣：沒有自己的房間，頂欄、日誌寫 iPhone，點了看作品冊日誌。
ok("伺服器認 origin ios；頂欄、日誌寫 iPhone、點了看作品冊日誌", status.includes('ios: "iPhone"') && status.includes('ios: "album.html?tab=log"') && readFileSync(join(ROOT, FRONT, "album-log.js"), "utf8").includes('ios: "iPhone"'));
console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
