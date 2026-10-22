#!/usr/bin/env python3
"""出圖日誌的上限（gen_log.MAX_ENTRIES）：超過上限一成才整理，只留最新的那幾張和它們的註記，最舊的直接丟。"""
from __future__ import annotations

import os
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["GEN_LOG_PATH"] = str(Path(tempfile.mkdtemp()) / "gen_log.jsonl")
os.environ["GEN_LOG_MAX"] = "200"
import gen_log  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    print(("ok   " if cond else "FAIL ") + name + (f"  {detail}" if detail and not cond else ""))
    if not cond:
        failed += 1


def entry(i: int) -> dict:
    t = 1_700_000_000 + i
    return gen_log.entry_of(f"job{i:04d}", {"positive": f"1girl, test {i}", "seed": i, "width": 832, "height": 1216}, True, {"image": f"/api/image?filename={i}.png", "seed": i}, origin="mochi", kind="gen", created_at=t, started_at=t, finished_at=t + 1)


ok("上限讀得到環境變數", gen_log.MAX_ENTRIES == 200)
for i in range(240):
    gen_log.record(entry(i))
gen_log.mark("job0005", "discard")
gen_log.mark("job0230", "discard")
ok("還沒超過上限一成：一張都不丟", len(gen_log.all_items()) == 240)
for i in range(240, 300):
    gen_log.record(entry(i))
items = gen_log.all_items()
ids = {r["id"] for r in items}
lines = Path(os.environ["GEN_LOG_PATH"]).read_text(encoding="utf-8").splitlines()
ok("超過之後整理過：不到上限加一成", len(items) <= 250, str(len(items)))
ok("留下最新的", "job0299" in ids and "job0250" in ids)
ok("最舊的丟掉了", "job0000" not in ids and "job0005" not in ids)
ok("留下來那張的註記還在", next(r for r in items if r["id"] == "job0230").get("mark") == "discard")
ok("丟掉那張的註記也一起清掉", not any('"job0005"' in line for line in lines))
ok("整理後每一行都讀得懂（沒有半行）", all(line.startswith("{") and line.endswith("}") for line in lines))
ok("沒有留下暫存檔", not list(Path(os.environ["GEN_LOG_PATH"]).parent.glob("*.trim")))

# 上限 5000 時讀一次統計的時間（以前沒有上限，兩萬筆要 0.7 秒左右）。
gen_log.MAX_ENTRIES = 5000
os.environ["GEN_LOG_PATH"] = str(Path(tempfile.mkdtemp()) / "gen_log.jsonl")
gen_log.LOG_PATH = Path(os.environ["GEN_LOG_PATH"])
with open(gen_log.LOG_PATH, "w", encoding="utf-8") as f:
    import json

    for i in range(20000):
        f.write(json.dumps(entry(i), ensure_ascii=False, separators=(",", ":")) + "\n")
t0 = time.perf_counter()
n_before = len(gen_log.all_items())
t_before = time.perf_counter() - t0
gen_log.record(entry(20000))  # 這一筆寫進去就超過上限：整理
gen_log._cache["key"] = None
t0 = time.perf_counter()
n_after = len(gen_log.all_items())
t_after = time.perf_counter() - t0
print(f"     讀整份：{n_before} 筆 {t_before * 1000:.0f}ms → {n_after} 筆 {t_after * 1000:.0f}ms")
ok("兩萬筆的舊日誌寫下一筆時就收成上限", n_after == 5000)
ok("最新那筆留著", gen_log.all_items()[0]["id"] == "job20000")

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
