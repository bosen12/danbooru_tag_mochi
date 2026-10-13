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
fc.PACK_LIST = tmp / "no-pack-list.json"  # 前幾條測「沒有包內清單」的舊行為，不讀 repo 裡那份

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

# 包裡有哪些卡（card_art_pack.json）：缺的、舊的都不在包裡就不下載，交給烘焙。
fc.PACK_LIST = tmp / "card_art_pack.json"
fc.PACK_LIST.write_text(json.dumps({"ponytail": OLD, "red hair": "red hair, upper body"}), encoding="utf-8")
ok("舊版的那張包裡也是舊版：下載補不到，不抓", fc.have_enough() is True)
fc.PACK_LIST.write_text(json.dumps({"ponytail": NEW}), encoding="utf-8")
ok("包裡有新版：抓", fc.have_enough() is False)
(cards / "red_hair.webp").rename(cards / "red_hair.bak")
manifest({"ponytail": {"file": "ponytail.webp", "positive": NEW}})
fc.PACK_LIST.write_text(json.dumps({"ponytail": NEW}), encoding="utf-8")
ok("缺的卡不在包裡（詞庫比包新）：不抓", fc.have_enough() is True)
fc.PACK_LIST.write_text(json.dumps({"ponytail": NEW, "red hair": "red hair, portrait"}), encoding="utf-8")
ok("缺的卡在包裡：抓", fc.have_enough() is False)
fc.PACK_LIST = tmp / "missing.json"
ok("沒有包內清單：照舊有缺就抓", fc.have_enough() is False)
(cards / "red_hair.bak").rename(cards / "red_hair.webp")
manifest({"ponytail": {"file": "ponytail.webp", "positive": OLD}, "red hair": {"file": "red_hair.webp", "positive": "my own red hair"}})

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


# v7：縮圖包先、原圖包後（兩包都從本機 file:// 抓，不連網）。
import hashlib  # noqa: E402
import io  # noqa: E402
import contextlib  # noqa: E402

src = tmp / "release"
src.mkdir()
with zipfile.ZipFile(src / "card-art-thumbs.zip", "w") as z:
    z.writestr("cards/thumb/ponytail.webp", b"thumb new")
    z.writestr("cards/thumb/bob.webp", b"thumb bob")
    z.writestr("cards/manifest.json", json.dumps({"ponytail": {"file": "ponytail.webp", "positive": NEW, "thumb": True}, "bob": {"file": "bob.webp", "positive": "bob, portrait", "thumb": True}}))
    z.writestr("cards/previous.json", json.dumps({"ponytail": OLD}))
with zipfile.ZipFile(src / "card-art-full.zip", "w") as z:
    z.writestr("cards/ponytail.webp", b"full new")
    z.writestr("cards/bob.webp", b"full bob")


def packinfo(name):
    data = (src / name).read_bytes()
    return {"name": name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()}


cards2 = tmp / "cards2"
cards2.mkdir()
fc.CARDS = cards2
fc.MARKER = cards2 / ".card-art-v7"
fc.THUMB_MARKER = cards2 / ".card-art-v7-thumbs"
fc.UPGRADE = cards2 / ".card-art-upgrade.json"
fc.PARTS = cards2 / ".card-art-download"
fc.PACK_LIST = tmp / "missing.json"
fc.BASE = src.as_uri() + "/"
fc.THUMBS, fc.FULL = packinfo("card-art-thumbs.zip"), packinfo("card-art-full.zip")
fc.JOBS.write_text(json.dumps([{"tag": "ponytail", "file": "ponytail.webp", "positive": NEW, "rating": "general"}, {"tag": "bob", "file": "bob.webp", "positive": "bob, portrait", "rating": "general"}]), encoding="utf-8")
# 本機原本有上一版公開包放的 ponytail（舊提示詞）：兩包都要換成新的。
(cards2 / "ponytail.webp").write_bytes(b"full old")
(cards2 / "thumb").mkdir()
(cards2 / "thumb" / "ponytail.webp").write_bytes(b"thumb old")
(cards2 / "manifest.json").write_text(json.dumps({"ponytail": {"file": "ponytail.webp", "positive": OLD}}), encoding="utf-8")

# 原圖包抓壞（雜湊對不上）：縮圖已經解好、留著標記，下次只抓原圖包。
real_full = fc.FULL
fc.FULL = {**real_full, "sha256": "0" * 64}
sys.argv = ["fetch_card_art.py"]
out = io.StringIO()
with contextlib.redirect_stdout(out):
    rc = fc.main()
text = out.getvalue()
ok("原圖包對不上：回 2，不解", rc == 2 and not (cards2 / "bob.webp").exists(), text)
ok("縮圖包先好：縮圖、manifest 都在，印出讓面板叫人重新整理的那一行", (cards2 / "thumb" / "bob.webp").read_bytes() == b"thumb bob"
   and "Card thumbnails ready" in text and json.loads((cards2 / "manifest.json").read_text(encoding="utf-8"))["bob"]["file"] == "bob.webp", text)
ok("上一版公開包放的縮圖換新；要換的原圖記下來給原圖包", (cards2 / "thumb" / "ponytail.webp").read_bytes() == b"thumb new"
   and json.loads(fc.UPGRADE.read_text(encoding="utf-8")) == ["ponytail.webp"])
ok("縮圖好了留標記（下次不重抓縮圖）、這一版還沒完成", fc.THUMB_MARKER.exists() and not fc.MARKER.exists())

fc.FULL = real_full
(src / "card-art-thumbs.zip").rename(src / "gone.zip")  # 縮圖包不見了也沒關係：這次不該再抓它
out = io.StringIO()
with contextlib.redirect_stdout(out):
    rc = fc.main()
text = out.getvalue()
(src / "gone.zip").rename(src / "card-art-thumbs.zip")
ok("下次啟動：只接著抓原圖包", rc == 0 and "Card thumbnails ready" not in text, text)
ok("原圖都到了：上一版的舊原圖也換新", (cards2 / "bob.webp").read_bytes() == b"full bob" and (cards2 / "ponytail.webp").read_bytes() == b"full new")
ok("完成：這一版的標記、縮圖標記和要換的清單都收掉", fc.MARKER.exists() and not fc.THUMB_MARKER.exists() and not fc.UPGRADE.exists())
ok("裝好之後下次啟動不再下載", fc.have_enough() is True)

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
