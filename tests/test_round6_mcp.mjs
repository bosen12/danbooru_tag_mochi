/** 第六輪：走 MCP stdio，伺服器只提供隔離的收藏讀取回應。 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

let status = 200, body = { ok: true, cards: [] };
const server = createServer((req, res) => {
  if (req.method !== "GET" || req.url !== "/api/custom-cards") {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const mcp = spawn(process.execPath, [fileURLToPath(new URL("../mcp/mochi-mcp.mjs", import.meta.url))], {
  env: { ...process.env, MOCHI_URL: `http://127.0.0.1:${server.address().port}` },
  stdio: ["pipe", "pipe", "inherit"],
});
const lines = createInterface({ input: mcp.stdout });
let id = 0;
async function rpc(method, params) {
  const reply = once(lines, "line", { signal: AbortSignal.timeout(10000) });
  mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) + "\n");
  const response = JSON.parse((await reply)[0]);
  assert.equal(response.id, id);
  return response.result;
}

try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "round6", version: "1" } });
  const mine = () => rpc("tools/call", { name: "my_cards", arguments: { kind: "custom" } });
  const empty = await mine();
  assert.ok(!empty.isError);
  assert.deepEqual(JSON.parse(empty.content[0].text).customCards, []);

  status = 503;
  body = { ok: false, error: "暫時讀不到自製牌" };
  const unavailable = await mine();
  assert.equal(unavailable.isError, true);
  assert.match(unavailable.content[0].text, /503|暫時讀不到自製牌/);

  status = 200;
  body = { ok: true, cards: {} };
  const malformed = await mine();
  assert.equal(malformed.isError, true);
  assert.match(malformed.content[0].text, /格式/);
  console.log("ok 自製牌：空清單是成功、503 和壞格式都是錯誤");
} finally {
  lines.close();
  mcp.stdin.end();
  mcp.kill();
  await new Promise((resolve) => server.close(resolve));
}
