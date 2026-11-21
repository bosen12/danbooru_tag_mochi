"""card_groups.py：名字與類別必填、只收詞庫裡屬於那一段的牌、可以是空的、上限、
別台改過回 409（不蓋掉）、別台刪掉的不會被舊畫面救活（只有 restore 才放回去）、類別不能改、
改名的字換新名、刪除、壞檔（語法壞、樣子不對）不當成空的。"""
import json
import os
import sys
import tempfile
from pathlib import Path

tmp = Path(tempfile.mkdtemp())
os.environ["CARD_GROUPS_PATH"] = str(tmp / "groups.json")
os.environ["CARD_GROUP_PICKS_PATH"] = str(tmp / "group_picks.json")
lex = tmp / "lexicon.json"
lex.write_text(
    json.dumps({
        "tags": [
            {"tag": "blonde hair", "section": "feature"}, {"tag": "twintails", "section": "feature"},
            {"tag": "blue eyes", "section": "feature"}, {"tag": "beach", "section": "env"},
            # 比一組的上限（card_groups.MAX_TAGS，5000）多一些：測「超過上限明講」要送得出上限＋1 張認得的牌。
            *[{"tag": f"acc {i}", "section": "clothing"} for i in range(5100)],
        ],
        "renamed": {"old blonde": "blonde hair"},
    }),
    encoding="utf-8",
)
os.environ["CARD_USAGE_LEXICON"] = str(lex)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import card_groups  # noqa: E402
import file_lock  # noqa: E402

failed = 0
PATH = Path(os.environ["CARD_GROUPS_PATH"])


def ok(name, cond, got=None):
    global failed
    print(("ok   " if cond else "FAIL ") + name + ("" if cond or got is None else f"  got={got!r}"))
    if not cond:
        failed += 1


def raises(name, fn, kind=card_groups.GroupError, check=None):
    try:
        fn()
        ok(name, False, "沒有丟錯")
    except kind as exc:
        ok(name, check(exc) if check else True, getattr(exc, "bad", None) or str(exc))


ok("沒有檔案時是空的", card_groups.load() == [])
r = card_groups.save({"name": "  金髮   雙馬尾 ", "section": "feature", "tags": ["blonde hair", "twintails", "twintails"], "createdAt": "x"})
a = r["group"]
ok("新的一組有 id、名字收空白、記得類別、建立時間由伺服器給", a["id"].startswith("g-") and a["name"] == "金髮 雙馬尾" and a["section"] == "feature" and a["createdAt"] > 0)
ok("去重、照原本順序", a["tags"] == ["blonde hair", "twintails"], a["tags"])
ok("讀回來一樣", card_groups.load() == [a])

empty = card_groups.save({"name": "B", "section": "feature", "tags": []})["group"]
ok("可以先建空的群組", empty["tags"] == [])

raises("沒名字不收", lambda: card_groups.save({"name": "  ", "section": "feature", "tags": []}))
raises("不認得的類別不收", lambda: card_groups.save({"name": "x", "section": "quality", "tags": []}))
raises("tags 不是陣列不收", lambda: card_groups.save({"name": "x", "section": "env", "tags": "beach"}))
raises("不是物件不收", lambda: card_groups.save(["x"]))
raises("別段的牌整筆拒絕、列出是哪幾張", lambda: card_groups.save({"name": "x", "section": "feature", "tags": ["blonde hair", "beach"]}), check=lambda e: e.bad == ["beach"])
dropped = card_groups.save({**empty, "tags": ["custom:abc", "nope", "blue eyes"]})
ok("詞庫外的牌略過並回報", dropped["dropped"] == ["custom:abc", "nope"] and dropped["group"]["tags"] == ["blue eyes"])
empty = dropped["group"]
raises("超過上限明講，不偷偷截掉", lambda: card_groups.save({"name": "x", "section": "clothing", "tags": [f"acc {i}" for i in range(card_groups.MAX_TAGS + 1)]}))
raises("壞 id 不收", lambda: card_groups.save({"id": "BAD ID", "name": "x", "section": "feature", "tags": []}))

again = card_groups.save({"id": a["id"], "name": "金髮", "section": "feature", "tags": ["blue eyes", "old blonde"], "updatedAt": a["updatedAt"]})["group"]
ok("帶 id＋看到的 updatedAt：改名、換牌，id 與建立時間不變", again["id"] == a["id"] and again["name"] == "金髮" and again["createdAt"] == a["createdAt"])
ok("改過名的字存成新名", again["tags"] == ["blue eyes", "blonde hair"], again["tags"])
ok("每次改 updatedAt 都會變大", again["updatedAt"] > a["updatedAt"])
raises("拿舊的 updatedAt 來存：409 stale，附上現在那份", lambda: card_groups.save({"id": a["id"], "name": "舊畫面", "section": "feature", "tags": [], "updatedAt": a["updatedAt"]}),
       kind=card_groups.GroupConflict, check=lambda e: e.code == "stale" and e.current["name"] == "金髮")
ok("409 之後伺服器上的沒被蓋掉", card_groups.load()[0]["name"] == "金髮")
raises("類別不能改", lambda: card_groups.save({"id": a["id"], "name": "金髮", "section": "env", "tags": []}))
raises("改一組沒帶 updatedAt：409，不蓋掉", lambda: card_groups.save({"id": a["id"], "name": "沒帶版本", "section": "feature", "tags": []}), kind=card_groups.GroupConflict)

order = [g["id"] for g in card_groups.load()]
ok("照建立順序排（改過的不跳到最前面）", order == [a["id"], empty["id"]], order)

gone = card_groups.delete(empty["id"])
ok("刪除回傳刪掉的那組、剩下的清單", gone["group"]["id"] == empty["id"] and [g["id"] for g in gone["groups"]] == [a["id"]])
raises("刪不存在的", lambda: card_groups.delete("g-nothere"))
raises("別台刪掉的，舊畫面存檔不會救活（409 gone）", lambda: card_groups.save({**gone["group"]}), kind=card_groups.GroupConflict, check=lambda e: e.code == "gone")
back = card_groups.save({**gone["group"], "restore": True})["group"]
ok("刪掉後帶 restore 存回來（復原）：原 id、原建立時間", back["id"] == empty["id"] and back["createdAt"] == empty["createdAt"])

# 群組數量上限
for g in card_groups.load():
    card_groups.delete(g["id"])
for i in range(card_groups.MAX_GROUPS):
    card_groups.save({"name": f"g{i}", "section": "env", "tags": []})
raises("群組數量到上限就不收", lambda: card_groups.save({"name": "多的", "section": "env", "tags": []}))
for g in card_groups.load():
    card_groups.delete(g["id"])
a = card_groups.save({"name": "A", "section": "feature", "tags": ["twintails"]})["group"]

# 舊名寫在檔案裡：讀出來就換新名；讀不懂的那幾筆略過
raw = json.loads(PATH.read_text(encoding="utf-8"))
raw["groups"][0]["tags"] = ["old blonde", "twintails", "removed tag"]
raw["groups"].append({"id": "bad id!", "name": "x", "section": "feature", "tags": []})
raw["groups"].append({"id": "g-weird", "name": "x", "section": "nope", "tags": []})
raw["groups"].append({"id": "g-ok2", "name": "x", "section": "env", "tags": "beach", "createdAt": "壞"})
PATH.write_text(json.dumps(raw), encoding="utf-8")
before_read = PATH.read_bytes()
loaded = card_groups.load()
ok("讀取不重寫存檔", PATH.read_bytes() == before_read)
original_sections = card_groups._tag_sections
card_groups._tag_sections = lambda: {}
ok("詞庫不可用時不刪牌", "removed tag" in next(g for g in card_groups.load() if g["id"] == a["id"])["tags"])
card_groups._tag_sections = original_sections
byid = {g["id"]: g for g in loaded}
ok("檔案裡的舊名讀出來換新名", byid[a["id"]]["tags"] == ["blonde hair", "twintails"], byid[a["id"]]["tags"])
ok("壞 id、壞類別的略過；壞的 tags、時間不讓整份讀不了", set(byid) == {a["id"], "g-ok2"} and byid["g-ok2"]["tags"] == [] and byid["g-ok2"]["createdAt"] == 0, loaded)


def clear_backups():
    for f in tmp.glob("groups.json*"):
        if f.name != "groups.json":
            f.unlink()


# 讀不懂的檔不能當成空的（不然下一次存會把整份蓋掉）
for broken, label in [("{not json", "語法壞"), ("[]", "樣子不對：陣列"), ('{"groups": {}}', "樣子不對：groups 不是陣列")]:
    clear_backups()
    PATH.write_text(broken, encoding="utf-8")
    try:
        card_groups.load()
        ok(f"壞檔（{label}）丟 StoreCorrupt", False)
    except file_lock.StoreCorrupt:
        ok(f"壞檔（{label}）丟 StoreCorrupt、壞的那份改名留著", any(".corrupt-" in f.name for f in tmp.glob("groups.json*")))

# 有備份：樣子不對時用備份換回
clear_backups()
card_groups.save({"name": "留著", "section": "env", "tags": ["beach"]})
card_groups.save({"name": "第二筆", "section": "env", "tags": []})  # 這一次寫入時把上一份留成 .bak
PATH.write_text("[]", encoding="utf-8")
names = [g["name"] for g in card_groups.load()]
ok("樣子不對、有備份：用備份換回", "留著" in names, names)

# 勾選（2026-11-18 改成所有裝置共用）。
ok("勾選：沒存過", card_groups.load_picks() == {"picks": {}, "saved": False, "at": 0})
_p = card_groups.save_picks({"picks": {"feature": {"ids": ["g-abcd", "g-abcd", "bad id!"], "mode": "mix"}, "clothing": {"ids": []}, "nope": {"ids": ["g-x123"]}}})
ok("勾選：去重、壞 id 丟掉、空的段落和不認得的段落丟掉", _p["picks"] == {"feature": {"ids": ["g-abcd"], "mode": "mix"}}, _p)
ok("勾選：讀回一樣、記得存過", card_groups.load_picks()["picks"] == _p["picks"] and card_groups.load_picks()["saved"] is True)
card_groups.save_picks({"picks": {}})
ok("勾選：全部取消也算存過（別台打開是全沒勾）", card_groups.load_picks() == {"picks": {}, "saved": True, "at": card_groups.load_picks()["at"]})
try:
    card_groups.save_picks({"picks": "x"})
    ok("勾選：不是物件不收", False)
except card_groups.GroupError:
    ok("勾選：不是物件不收", True)

print("all ok" if not failed else f"{failed} failed")
sys.exit(1 if failed else 0)
