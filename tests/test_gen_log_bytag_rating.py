#!/usr/bin/env python3
"""卡冊按牌查成品：分級在分頁之前篩掉，total 是篩過的張數，每一筆帶 rating。

不寫專案的 data/。GEN_LOG_PATH 指到暫存檔之後才 import。
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
_tmp = Path(tempfile.mkdtemp())
os.environ["GEN_LOG_PATH"] = str(_tmp / "gen_log.jsonl")
os.environ["RECIPE_DATA_DIR"] = str(_tmp / "recipes")
os.environ["WORKFLOW_DATA_DIR"] = str(_tmp / "workflows")
import gen_log  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    print(("ok   " if cond else "FAIL ") + name + (f"  {detail}" if detail and not cond else ""))
    if not cond:
        failed += 1


T0 = 1_700_000_000.0


def put(i: int, rating: str, *, tag: str = "red hair", mark: str | None = None) -> None:
    payload = {"positive": f"1girl, {tag}", "seed": i, "width": 832, "height": 1216, "rating": rating}
    data = {"image": f"/api/image?filename={i}.png", "seed": i}
    gen_log.record(
        gen_log.entry_of(
            f"j{i}",
            payload,
            True,
            data,
            origin="mochi",
            kind="gen",
            created_at=T0,
            started_at=T0,
            finished_at=T0 + i,
        )
    )
    if mark:
        gen_log.mark(f"j{i}", mark)


# 最新的一筆是 explicit。若先切頁再篩，第一頁會是它，total 也會把它算進去。
for i, rating in enumerate(["" , "general", "general", "sensitive", "explicit"], start=1):
    put(i, rating)
FAV: dict = {}

bare = gen_log.by_tag("red hair", FAV)
ok("不帶分級：五張都在，而且每筆有 rating", bare["total"] == 5 and {r["rating"] for r in bare["items"]} == {"", "general", "sensitive", "explicit"})
ok("不帶分級時最新的排前面（explicit）", bare["items"][0]["id"] == "j5")

gen = gen_log.by_tag("red hair", FAV, rating="general")
ids = [r["id"] for r in gen["items"]]
ok("全年齡：explicit、sensitive 不在，沒寫分級的留著", gen["total"] == 3 and set(ids) == {"j1", "j2", "j3"}, str(ids))
ok("全年齡的 total 是篩過的，不是全部再減", gen["total"] == 3)

page = gen_log.by_tag("red hair", FAV, limit=1, offset=0, rating="general")
rest = gen_log.by_tag("red hair", FAV, limit=10, offset=1, rating="general")
seen = [r["id"] for r in page["items"] + rest["items"]]
ok("分頁之前就篩：每一頁都沒有 explicit，頁數加總等於 total", "j5" not in seen and "j4" not in seen and page["total"] == 3 and seen == ["j3", "j2", "j1"], str(seen))

sens = gen_log.by_tag("red hair", FAV, rating="sensitive")
ok("敏感：看得到敏感和全年齡，看不到色情", sens["total"] == 4 and all(r["rating"] != "explicit" for r in sens["items"]))
exp = gen_log.by_tag("red hair", FAV, rating="explicit")
ok("色情：五張都在", exp["total"] == 5)
ok("空字串、不認得的值不篩（伺服器會先擋不認得的）", gen_log.by_tag("red hair", FAV, rating="")["total"] == 5 and gen_log.by_tag("red hair", FAV, rating="nope")["total"] == 5)
ok("舊的位置參數還能用", gen_log.by_tag("red hair", FAV, 1, 0)["total"] == 5)


def test_route() -> None:
    import server

    server.favorite_index = lambda: {"_known": frozenset()}
    server.output_alive = lambda: None

    def call(path: str) -> tuple[int, dict]:
        handler = server.Handler.__new__(server.Handler)
        handler.client_address = ("127.0.0.1", 9)
        handler.path = path
        handler.headers = {}
        handler.close_connection = False
        handler.wfile = io.BytesIO()
        got: dict = {}

        def _json(code, obj, *args, **kwargs):
            got["code"] = code
            got["obj"] = obj

        handler._json = _json
        handler._do_get()
        return got["code"], got["obj"]

    code, body = call("/api/genlog/bytag?tag=red%20hair&rating=general&limit=2&offset=0")
    ok("路由：全年齡 200，total 是篩過的", code == 200 and body.get("ok") is True and body.get("total") == 3 and all(r.get("rating") != "explicit" for r in body.get("items") or []), str(body)[:300])
    code, body = call("/api/genlog/bytag?tag=red%20hair")
    ok("路由：沒帶分級不篩", code == 200 and body.get("total") == 5)
    code, body = call("/api/genlog/bytag?tag=red%20hair&rating=")
    ok("路由：空的分級不篩", code == 200 and body.get("total") == 5)
    code, body = call("/api/genlog/bytag?tag=red%20hair&rating=nope")
    ok("路由：不認得的分級 400", code == 400 and body.get("ok") is False and "分級" in (body.get("error") or ""), str(body))


test_route()

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
