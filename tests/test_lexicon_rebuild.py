#!/usr/bin/env python3
"""詞庫重做得出來：只拿 scripts/ 的詞庫腳本與原料（characters.json 等）和 web/lexicon_parts，
在暫存資料夾跑 merge_lexicon.py → add_zh.py，結果要跟 web/lexicon.json 內容一模一樣。

擋兩件事：改了 lexicon_parts／腳本卻忘了重產 lexicon.json；詞庫腳本多讀了一個檔，
開源版（sync_mochi.py 的 LEXICON_FILES）卻沒帶過去。不連網、不碰真的 web/。"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# 跟 sync_mochi.py 的 LEXICON_FILES 同一份：重做詞庫要的全部腳本與原料。
SOURCES = [
    "merge_lexicon.py", "groups.py", "subgroups.py", "suggestion_tags.py", "more_tags.py", "focus_tags.py", "add_zh.py",
    "characters.json", "character_series.json", "alt_names.json",
]

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


here = Path(__file__).resolve().parent
scripts = here if (here / "merge_lexicon.py").is_file() else ROOT / "scripts"
tmp = Path(tempfile.mkdtemp(prefix="lexicon-rebuild-"))
try:
    (tmp / "scripts").mkdir()
    for f in SOURCES:
        shutil.copy2(scripts / f, tmp / "scripts" / f)
    shutil.copytree(ROOT / "web" / "lexicon_parts", tmp / "web" / "lexicon_parts")
    env = {**os.environ, "PYTHONUTF8": "1"}
    for step in ("merge_lexicon.py", "add_zh.py"):
        r = subprocess.run([sys.executable, str(tmp / "scripts" / step)], cwd=tmp, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
        ok(f"{step} 只靠帶過去的檔就跑得完", r.returncode == 0, (r.stdout + r.stderr)[-1500:])
        if r.returncode:
            break
    out = tmp / "web" / "lexicon.json"
    if out.is_file():
        built = json.loads(out.read_text(encoding="utf-8"))
        have = json.loads((ROOT / "web" / "lexicon.json").read_text(encoding="utf-8"))
        diff = [k for k in sorted(set(built) | set(have)) if built.get(k) != have.get(k)]
        ok("重做出來的詞庫跟 web/lexicon.json 一樣（不一樣就是改了原料忘了重產）", not diff, "不一樣的欄位：" + ", ".join(diff))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

sys.exit(1 if failed else 0)
