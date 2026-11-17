// 成品牆滿了裁哪幾張（web6/wall-trim.js）。
// node scripts/test_wall_trim.mjs
// 開源版把 web6/ 合進 web/：兩邊都跑得動。
import { existsSync as hasPath } from "node:fs";
const W = hasPath(new URL("../web6", import.meta.url)) ? "web6" : "web";
const { pickTrim } = await import("../" + W + "/wall-trim.js");

let failed = 0;
const check = (name, ok, got) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)}`}`);
  if (!ok) failed++;
};
const mk = (status, id, extra = {}) => ({ id, status, ...extra });
// 牆的順序：新的在前面。
const wall = (...groups) => groups.flat();
const many = (n, status, p) => Array.from({ length: n }, (_, i) => mk(status, `${p}${i}`));

{
  // 先印 3 張，再只抽牌 80 張：印好的 3 張不能被擠掉。
  const shots = wall(many(80, "drawn", "d"), many(3, "done", "p"));
  const drop = pickTrim(shots, 80);
  check("只抽牌 80 張不擠掉印好的", drop.length === 0, drop.map((s) => s.id));
}
{
  // 只抽牌超過 80 張：裁最舊的只抽牌。
  const shots = wall(many(85, "drawn", "d"), many(3, "done", "p"));
  const drop = pickTrim(shots, 80);
  check("只抽牌超過 80 張裁最舊的只抽牌", drop.length === 5 && drop.every((s) => s.status === "drawn") && drop.some((s) => s.id === "d84"), drop.map((s) => s.id));
}
{
  // 印過的超過：先裁失敗的，再裁最舊的印好的。
  const shots = wall(many(79, "done", "n"), [mk("failed", "f0")], many(3, "done", "o"));
  const drop = pickTrim(shots, 80);
  check("先裁印壞的、再裁最舊的", drop.length === 3 && drop[0].id === "f0" && drop[1].id === "o2" && drop[2].id === "o1", drop.map((s) => s.id));
}
{
  // 在跑的不裁：排著、在印、Hires 在做。
  const shots = wall(many(78, "done", "n"), [mk("queued", "q0"), mk("running", "r0"), mk("done", "h0", { hi: { status: "running" } })]);
  const drop = pickTrim(shots, 80);
  check("在跑的不裁（排著、在印、Hires）", drop.length === 1 && !["q0", "r0", "h0"].includes(drop[0].id), drop.map((s) => s.id));
}
{
  // 全都在跑：暫時超過上限，不裁。
  const shots = many(82, "queued", "q");
  check("全都在跑就暫時超過", pickTrim(shots, 80).length === 0, null);
}
{
  check("沒超過不裁", pickTrim(many(10, "done", "x"), 80).length === 0, null);
}

if (failed) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("wall trim: passed");
