/**
 * 複製在非安全來源（手機走 Tailscale 的 http）也要成功。
 * navigator.clipboard 不存在、或 writeText 被拒，都改走暫時文字框 + execCommand("copy")。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// 開源版把 web6/ 合進 web/：兩邊都跑得動。
import { existsSync as hasPath } from "node:fs";
const W = hasPath(new URL("../web6", import.meta.url)) ? "web6" : "web";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, W + "/copy-text.js");
assert.ok(existsSync(file), "缺 web6/copy-text.js");

const source = readFileSync(file, "utf8").replace(/^export\s+/m, "");

function load(doc, nav) {
  const ctx = vm.createContext({ navigator: nav, document: doc });
  vm.runInContext(source + "\nthis.copyText = copyText;", ctx);
  return ctx.copyText;
}

function fakeDoc(execResult, execThrow = false) {
  const log = { appended: [], removed: 0, selected: 0, cmd: null };
  const doc = {
    body: { append(el) { log.appended.push(el); } },
    createElement() {
      return {
        className: "",
        value: "",
        readOnly: false,
        select() { log.selected += 1; },
        remove() { log.removed += 1; },
      };
    },
    execCommand(cmd) {
      log.cmd = cmd;
      if (execThrow) throw new Error("exec");
      return execResult;
    },
  };
  return { doc, log };
}

{
  let got = "";
  const { doc, log } = fakeDoc(true);
  const copyText = load(doc, { clipboard: { writeText: async (t) => { got = t; } } });
  assert.equal(await copyText("1girl, solo"), true);
  assert.equal(got, "1girl, solo");
  assert.equal(log.cmd, null, "原生成功時不走 execCommand");
  assert.equal(log.appended.length, 0);
}

{
  const { doc, log } = fakeDoc(true);
  const copyText = load(doc, {});
  assert.equal(await copyText("red hair"), true);
  assert.equal(log.cmd, "copy");
  assert.equal(log.selected, 1);
  assert.equal(log.appended.length, 1);
  assert.equal(log.appended[0].value, "red hair");
  assert.equal(log.removed, 1, "暫用的文字框要拿掉");
}

{
  const { doc, log } = fakeDoc(true);
  const copyText = load(doc, { clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } } });
  assert.equal(await copyText("x"), true);
  assert.equal(log.cmd, "copy", "writeText 被拒時改走 execCommand");
  assert.equal(log.removed, 1);
}

{
  const { doc } = fakeDoc(false);
  const copyText = load(doc, {});
  assert.equal(await copyText("x"), false, "execCommand 失敗要回 false，不假裝成功");
}

{
  const { doc, log } = fakeDoc(true, true);
  const copyText = load(doc, {});
  assert.equal(await copyText("x"), false);
  assert.equal(log.removed, 1, "execCommand 丟例外也要把文字框拿掉");
}

const callers = [
  W + "/album.js",
  W + "/album-log.js",
  W + "/fuse.js",
  W + "/custom-editor.js",
  W + "/book.js",
  W + "/paste-prompt.js",
  W + "/parse.js",
  W + "/community.js",
];
for (const rel of callers) {
  const src = readFileSync(join(root, rel), "utf8");
  assert.match(src, /from\s+["']\.\/copy-text\.js["']/, rel + " 要改用 copy-text.js");
  assert.equal(src.includes("navigator.clipboard.writeText"), false, rel + " 還在直接 writeText");
}
const book = readFileSync(join(root, W + "/book.js"), "utf8");
assert.ok(book.includes("navigator.clipboard.readText"), "貼上分享碼仍讀剪貼簿");
const community = readFileSync(join(root, W + "/community.js"), "utf8");
assert.equal(community.includes("execCommand"), false, "備援只留在 copy-text.js");

console.log("copy-text: ok");
