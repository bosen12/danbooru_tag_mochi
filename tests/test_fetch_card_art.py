#!/usr/bin/env python3
"""fetch_card_art.py：什麼時候要下載（缺圖、舊版的圖）、解包只換上一版公開包放的圖。不連網。"""
from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_card_art as fc  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


tmp = Path(tempfile.mkdtemp())
cards = tmp / "cards"
cards.mkdir()
fc.CARDS = cards
fc.JOBS = tmp / "card_jobs.json"
fc.MARKER = cards / ".card-art-test"

OLD = "1girl, solo, adult, ponytail, upper body"
NEW = "1girl, solo, adult, ponytail, portrait"
jobs = [
    {"tag": "ponytail", "file": "ponytail.webp", "positive": NEW, "rating": "general"},
    {"tag": "red hair", "file": "red_hair.webp", "positive": "red hair, portrait", "rating": "general"},
    {"tag": "nsfw thing", "file": "x.webp", "positive": "x", "rating": "explicit"},
]
fc.JOBS.write_text(json.dumps(jobs), encoding="utf-8")


def manifest(m):
    (cards / "manifest.json").write_text(json.dumps(m), encoding="utf-8")


ok("缺圖：要下載", fc.have_enough() is False)
(cards / "ponytail.webp").write_bytes(b"old")
(cards / "red_hair.webp").write_bytes(b"mine")
manifest({"ponytail": {"file": "ponytail.webp", "positive": NEW}, "red hair": {"file": "red_hair.webp", "positive": "red hair, portrait"}})
ok("圖都在、提示詞都對得上：不用下載（色情分級的不算）", fc.have_enough() is True)
manifest({"ponytail": {"file": "ponytail.webp", "positive": OLD}, "red hair": {"file": "red_hair.webp", "positive": "my own red hair"}})
ok("圖都在但有舊版的（提示詞跟卡面清單不一樣）：要下載一次", fc.have_enough() is False)
fc.MARKER.write_text("x", encoding="utf-8")
ok("下載過這一版（有標記）：不再抓，不會每次啟動都重抓", fc.have_enough() is True)
fc.MARKER.unlink()

# 解包：只換上一版公開包放的（本機提示詞 = previous.json 記的），自己烘的（red hair）不碰
pack = tmp / "pack.zip"
with zipfile.ZipFile(pack, "w") as z:
    z.writestr("cards/ponytail.webp", b"new")
    z.writestr("cards/red_hair.webp", b"public red")
    z.writestr("cards/manifest.json", json.dumps({"ponytail": {"file": "ponytail.webp", "positive": NEW}, "red hair": {"file": "red_hair.webp", "positive": "red hair, portrait"}}))
    z.writestr("cards/previous.json", json.dumps({"ponytail": OLD, "red hair": "red hair, upper body"}))
fc.unpack(pack)
m = json.loads((cards / "manifest.json").read_text(encoding="utf-8"))
ok("上一版公開包放的舊圖換成新的", (cards / "ponytail.webp").read_bytes() == b"new" and m["ponytail"]["positive"] == NEW)
ok("自己烘的不被蓋（圖和 manifest 都留著）", (cards / "red_hair.webp").read_bytes() == b"mine" and m["red hair"]["positive"] == "my own red hair")

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
