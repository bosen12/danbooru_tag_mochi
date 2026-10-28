"""custom_cards.py：存讀、只收詞庫的牌、權重範圍、分級下限、封鎖、預覽轉正、刪掉後復原、清暫存。"""
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

tmp = Path(tempfile.mkdtemp())
os.environ["CUSTOM_CARDS_PATH"] = str(tmp / "custom_cards.json")
os.environ["CUSTOM_CARDS_DIR"] = str(tmp / "custom_cards")
lex = tmp / "lexicon.json"
lex.write_text(json.dumps({"tags": [{"tag": t} for t in ["1girl", "solo", "beach", "bikini", "bursting breasts", "nude"] + [f"m{i}" for i in range(21)]]}), encoding="utf-8")
os.environ["CARD_USAGE_LEXICON"] = str(lex)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import custom_cards  # noqa: E402

manifest = tmp / "manifest.json"
manifest.write_text(json.dumps({"bursting breasts": {"rating": "sensitive"}, "nude": {"rating": "explicit"}, "beach": {"rating": "general"}}), encoding="utf-8")
custom_cards.MANIFEST = manifest

failed = 0


def ok(name, cond):
    global failed
    print(("ok   " if cond else "FAIL ") + name)
    if not cond:
        failed += 1


def raises(name, fn, needle=""):
    try:
        fn()
        ok(name, False)
    except custom_cards.CustomError as exc:
        ok(name, needle in str(exc))


BANNED = {"loli", "child", "bad character (series)"}


def banned(text):
    out = []
    for part in str(text).split(","):
        # 跟 server.banned_in_prompt 一樣：只拿掉權重括號，角色名自己的括號要留。
        t = re.sub(r":\s*[\d.]+\)*$", "", re.sub(r"^\(+", "", part.strip())).strip().lower()
        if t in BANNED:
            out.append(t)
    return out


def save(**kw):
    payload = {"name": "海邊", "rating": "sensitive", "members": [{"tag": "1girl"}, {"tag": "beach", "w": 1.2}], "extra": [{"text": "sparkle eyelashes"}]}
    payload.update(kw)
    return custom_cards.save(payload, banned=banned)


r = save()
c = r["card"]
ok("新的一張有 c_ 開頭的 id", c["id"].startswith("c_") and len(c["id"]) == 10)
ok("成員照順序、權重留著", c["members"] == [{"tag": "1girl", "w": 1.0}, {"tag": "beach", "w": 1.2}])
ok("詞庫外的字留著", c["extra"] == [{"text": "sparkle eyelashes", "w": 1.0}])
ok("讀回來一樣", custom_cards.load() == [c])
ok("填入的字串帶權重", custom_cards.fill_text(c) == "1girl, (beach:1.2), sparkle eyelashes")

r = save(members=[{"tag": "1girl"}, {"tag": "1girl"}, {"tag": "not a tag"}, {"tag": "beach", "w": 9}, {"tag": "solo", "w": True}])
ok("只收詞庫的牌、去重、權重超出範圍變 1", r["card"]["members"] == [{"tag": "1girl", "w": 1.0}, {"tag": "beach", "w": 1.0}, {"tag": "solo", "w": 1.0}])

r = save(extra=[{"text": "a, b"}, {"text": "beach"}, {"text": "  wide   hat  ", "w": 0.7}])
ok("詞庫外：逗號拆掉、跟成員重複的不收、空白合併", r["card"]["extra"] == [{"text": "a b", "w": 1.0}, {"text": "wide hat", "w": 0.7}])

raises("要有名字", lambda: save(name="   "), "名字")
raises("至少一張牌或一個字", lambda: save(members=[], extra=[]), "至少")
raises("分級要是三種之一", lambda: save(rating="nsfw"), "分級")
raises("一張最多 20 張牌", lambda: save(members=[{"tag": f"m{i}"} for i in range(21)]), "最多 20")

ok("分級下限：裡面有敏感級的牌就是敏感", custom_cards.rating_floor(["1girl", "bursting breasts"]) == "sensitive")
ok("分級下限：有色情級就是色情", custom_cards.rating_floor(["nude", "bursting breasts"]) == "explicit")
ok("分級下限：沒有卡面的牌不算", custom_cards.rating_floor(["solo"]) == "general")
raises("分級不能低於裡面的牌", lambda: save(rating="general", members=[{"tag": "bursting breasts"}]), "敏感")
ok("往上調可以", save(rating="explicit", members=[{"tag": "bursting breasts"}])["card"]["rating"] == "explicit")

raises("詞庫外有未成年的字：擋", lambda: save(extra=[{"text": "loli"}]), "loli")
raises("權重括號包著也擋", lambda: save(extra=[{"text": "child", "w": 1.3}]), "child")
raises("卡面提示詞有禁用角色：擋", lambda: save(face={"positive": "1girl, bad character (series), beach"}), "bad character")

# ---------- 預覽轉正、改卡面、刪掉後復原 ----------
draft = custom_cards.new_draft()
full, thumb = custom_cards.draft_paths(draft)
full.parent.mkdir(parents=True, exist_ok=True)
full.write_bytes(b"RIFF-fake-webp-1")
thumb.write_bytes(b"RIFF-fake-thumb")
r = save(draft=draft, face={"positive": "1girl, beach", "seed": 1383})
art = r["card"]["face"]["art"]
ok("預覽轉正：卡面檔名是 id-雜湊.webp", art.startswith(r["card"]["id"] + "-") and art.endswith(".webp"))
ok("預覽檔搬走了", not full.exists() and not thumb.exists())
ok("正式卡面和縮圖都在", custom_cards.art_path(art) is not None and (custom_cards.ART_DIR / art.replace(".webp", ".thumb.webp")).is_file())
ok("種子存下來了", r["card"]["face"]["seed"] == 1383)
ok("種子超過 2^53（網頁存不準）就不收", save(face={"positive": "1girl", "seed": 2**60})["card"]["face"]["seed"] is None)
cid = r["card"]["id"]

draft2 = custom_cards.new_draft()
f2, _ = custom_cards.draft_paths(draft2)
f2.write_bytes(b"RIFF-fake-webp-2")
r2 = custom_cards.save({**r["card"], "draft": draft2}, banned=banned)
art2 = r2["card"]["face"]["art"]
ok("重烤後存檔：換成新卡面、舊檔刪掉", art2 != art and custom_cards.art_path(art2) is not None and custom_cards.art_path(art) is None)
ok("更新不會多一張", len([x for x in custom_cards.load() if x["id"] == cid]) == 1)

gone = custom_cards.delete(cid)["card"]
ok("刪掉了", all(x["id"] != cid for x in custom_cards.load()))
ok("刪掉後卡面檔先留著", custom_cards.art_path(art2) is not None)
back = custom_cards.save(gone, banned=banned)["card"]
ok("復原：同一個 id、接回原本的卡面", back["id"] == cid and back["face"]["art"] == art2)
raises("刪不存在的", lambda: custom_cards.delete("c_00000000"), "找不到")

try:
    custom_cards.draft_paths("../../etc")
    ok("預覽代號不能是路徑", False)
except custom_cards.CustomError:
    ok("預覽代號不能是路徑", True)
ok("卡面檔名不能是路徑", custom_cards.art_path("../custom_cards.json") is None)

# ---------- 清暫存 ----------
d3 = custom_cards.new_draft()
f3, _ = custom_cards.draft_paths(d3)
f3.write_bytes(b"old")
old = time.time() - 2 * 86400
os.utime(f3, (old, old))
d4 = custom_cards.new_draft()
f4, _ = custom_cards.draft_paths(d4)
f4.write_bytes(b"new")
orphan = custom_cards.ART_DIR / "c_deadbeef-0123456789.webp"
orphan.write_bytes(b"x")
os.utime(orphan, (old, old))
n = custom_cards.prune()
ok("超過一天的預覽清掉、新的留著", not f3.exists() and f4.exists())
ok("沒人用、超過一天的卡面檔清掉", not orphan.exists())
ok("在用的卡面檔不清", custom_cards.art_path(art2) is not None)
ok("回報清了幾個", n >= 2)
ok("drop_draft 刪預覽", custom_cards.drop_draft(d4) and not f4.exists())

print("passed" if not failed else f"{failed} failed")
sys.exit(1 if failed else 0)
