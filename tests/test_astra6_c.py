#!/usr/bin/env python3
"""Astra 6：日誌壞列、成績單路徑、牌組／使用次數壞檔、卡面重烤、作品錯誤的 HTTP 狀態。

不連 ComfyUI、不打 /api/gen、不寫專案的 data/。暫存目錄＋環境變數，跟 .council/astra-6/stores_probe.py 一樣。
舊程式會紅的對照在報告裡（git show HEAD 的 gen_log.py／card_usage.py／card_decks.py／server.py）。
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

tmp = Path(tempfile.mkdtemp(prefix="astra6c-"))
lex = tmp / "lexicon.json"
lex.write_text(json.dumps({"tags": [{"tag": "red hair"}, {"tag": "1girl"}, {"tag": "solo"}]}), encoding="utf-8")
for key, dest in {
    "CARD_USAGE_LEXICON": lex,
    "CARD_USAGE_PATH": tmp / "usage.json",
    "CARD_DECKS_PATH": tmp / "decks.json",
    "CARD_FAV_CHARS_PATH": tmp / "chars.json",
    "CARD_FAV_HAND_PATH": tmp / "hand.json",
    "CARD_GROUPS_PATH": tmp / "groups.json",
    "GEN_LOG_PATH": tmp / "gen_log.jsonl",
    "RECIPE_DATA_DIR": tmp / "recipes",
    "APP_SETTINGS": tmp / "settings.json",
    "APP_CONFIG": tmp / "config.json",
    "WORKFLOW_DATA_DIR": tmp / "workflows",
}.items():
    os.environ[key] = str(dest)
os.environ["NO_SETUP"] = "1"
os.environ["NO_OUTPUT_PRUNE"] = "1"
os.environ.pop("NO_CARD_BAKE", None)

import card_decks  # noqa: E402
import card_usage  # noqa: E402
import file_lock  # noqa: E402
import gen_log  # noqa: E402
import recipes  # noqa: E402
import server  # noqa: E402

failed = 0


def ok(name, cond, detail="") -> None:
    global failed
    print(("ok   " if cond else "FAIL ") + name + (f"\n  {detail}" if detail and not cond else ""))
    if not cond:
        failed += 1


# ---- 4. 日誌一筆 at 是字串，不能拖垮整頁、成績單、按牌查圖 ----
gen_log.record({"t": "gen", "id": "a", "kind": "gen", "at": 1000, "ok": True, "ckpt": "A/same.safetensors", "loras": [], "positive": "1girl", "image": "/api/image?filename=a.png"})
gen_log.record({"t": "gen", "id": "b", "kind": "gen", "at": 2000, "ok": False, "ckpt": r"B\same.safetensors", "loras": []})
models = [m for m in gen_log.stats(set(), [])["models"] if m["kind"] == "ckpt" and m["name"] == "same"]
by_path = {m["path"]: m for m in models}
ok(
    "同名不同資料夾的底模分開算，name 仍是短名，path／label 帶資料夾",
    set(by_path) == {"A/same.safetensors", "B/same.safetensors"}
    and by_path["A/same.safetensors"]["n"] == 1
    and by_path["A/same.safetensors"]["failed"] == 0
    and by_path["B/same.safetensors"]["failed"] == 1
    and by_path["B/same.safetensors"]["folder"] == "B"
    and {m["label"] for m in models} == {"A/same", "B/same"},
    str(models),
)

with gen_log._path().open("a", encoding="utf-8") as fh:
    fh.write(json.dumps({"t": "gen", "at": "2026-11-20", "id": "bad-one", "ok": True, "positive": "1girl", "image": "/api/image?filename=bad.png", "kind": "gen"}, ensure_ascii=False) + "\n")
try:
    page = gen_log.page()
    st = gen_log.stats(set(), [])
    bt = gen_log.by_tag("1girl", {})
    trimmed = gen_log._trim(gen_log._path())
    ids = [row["id"] for row in page["items"]]
    ok(
        "一筆壞時間不會讓整頁、成績單、按牌查圖失敗，而且那筆被跳過",
        "bad-one" not in ids and "a" in ids and st["total"] == 1 and "bad-one" not in [row["id"] for row in bt["items"]] and isinstance(trimmed, int),
        str((ids, st["total"], bt)),
    )
except TypeError as exc:
    ok("一筆壞時間不會讓整頁、成績單、按牌查圖失敗，而且那筆被跳過", False, type(exc).__name__)

# 沒超過上限時 _trim 根本不排序。舊程式要等張數超過上限才會拿字串跟數字比，整段整理失敗。
cap = gen_log.MAX_ENTRIES
gen_log.MAX_ENTRIES = 1
try:
    trimmed_over = gen_log._trim(gen_log._path())
    ok("超過上限時壞時間也不讓整理失敗", isinstance(trimmed_over, int), str(trimmed_over))
except TypeError as exc:
    ok("超過上限時壞時間也不讓整理失敗", False, type(exc).__name__)
finally:
    gen_log.MAX_ENTRIES = cap


# ---- 6. 牌組、使用次數：讀不到或樣子不對不能當成空的 ----
def _use(path: Path):
    card_usage.USAGE_PATH = path
    card_usage._LOAD_CACHE.update(key=None, value=None)


def _deck(path: Path):
    card_decks.DECKS_PATH = path


_use(tmp / "usage-old.json")
card_usage.USAGE_PATH.write_text(json.dumps({"red hair": 4}), encoding="utf-8")
old_counts = card_usage.load()["counts"]
card_usage.add({"entries": [{"id": "e-old", "tags": ["solo"]}]})
after_add = card_usage.load()["counts"]
ok("使用次數舊格式 {牌: 次數} 轉得過來，下一筆不會把舊的清掉", old_counts.get("red hair") == 4 and after_add.get("red hair") == 4 and after_add.get("solo") == 1, str((old_counts, after_add)))

_use(tmp / "usage-busy.json")
card_usage.add({"entries": [{"id": "e-keep", "tags": ["1girl"]}]})
usage_path = card_usage.USAGE_PATH
usage_before = usage_path.read_bytes()
usage_bak = file_lock.backup_path(usage_path).read_bytes()
real_read = Path.read_text


def _busy_usage(self, *args, **kwargs):
    if Path(self) == usage_path:
        raise PermissionError("busy")
    return real_read(self, *args, **kwargs)


with patch.object(Path, "read_text", _busy_usage):
    try:
        card_usage.add({"entries": [{"id": "e-new", "tags": ["solo"]}]})
        ok("使用次數讀不到就拒絕寫入", False)
    except file_lock.StoreCorrupt:
        ok("使用次數讀不到就拒絕寫入", True)
ok("使用次數讀不到時正本和 .bak 都不動", usage_path.read_bytes() == usage_before and file_lock.backup_path(usage_path).read_bytes() == usage_bak)

_use(tmp / "usage-shape.json")
card_usage.USAGE_PATH.write_text("[]", encoding="utf-8")
try:
    card_usage.add({"entries": [{"id": "e-shape", "tags": ["solo"]}]})
    ok("使用次數樣子不對就拒絕寫入", False)
except file_lock.StoreCorrupt:
    ok("使用次數樣子不對就拒絕寫入", True)
shape_text = card_usage.USAGE_PATH.read_text(encoding="utf-8") if card_usage.USAGE_PATH.exists() else ""
shape_bak = file_lock.backup_path(card_usage.USAGE_PATH)
ok(
    "使用次數樣子不對時這次不存，壞檔改名留著",
    "e-shape" not in shape_text and (not shape_bak.exists() or "e-shape" not in shape_bak.read_text(encoding="utf-8"))
    and any(p.name.startswith("usage-shape.json.corrupt-") for p in tmp.iterdir()),
)

_deck(tmp / "decks-old-list.json")
card_decks.DECKS_PATH.write_text(json.dumps([{"id": "d-oldformat01", "name": "舊", "tags": ["red hair"], "createdAt": 1, "updatedAt": 1}]), encoding="utf-8")
old_decks = card_decks.load()
ok("牌組舊格式（最外層是陣列）轉得過來", len(old_decks) == 1 and old_decks[0]["id"] == "d-oldformat01" and old_decks[0]["tags"] == ["red hair"], str(old_decks))

_deck(tmp / "decks-old-map.json")
card_decks.DECKS_PATH.write_text(json.dumps({"decks": {"d-oldformat02": {"id": "d-oldformat02", "name": "舊", "tags": ["solo"], "createdAt": 1, "updatedAt": 1}}}), encoding="utf-8")
mapped = card_decks.load()
ok("牌組舊格式（id 對到牌組）轉得過來", len(mapped) == 1 and mapped[0]["id"] == "d-oldformat02" and mapped[0]["tags"] == ["solo"], str(mapped))

_deck(tmp / "decks-bad.json")
bad_deck = card_decks.DECKS_PATH
bad_deck.write_text(json.dumps({"decks": {"old": [{"id": "test-prior", "tags": ["red hair"]}]}}), encoding="utf-8")
try:
    card_decks.load()
    ok("牌組樣子不對不能讀成空的", False)
except file_lock.StoreCorrupt:
    ok("牌組樣子不對不能讀成空的", True)
ok("牌組樣子不對：壞的那份改名留著", any(p.name.startswith("decks-bad.json.corrupt-") for p in tmp.iterdir()))

_deck(tmp / "decks-save.json")
save_deck = card_decks.DECKS_PATH
save_deck.write_text(json.dumps({"decks": {"old": [{"id": "test-prior", "tags": ["red hair"]}]}}), encoding="utf-8")
try:
    card_decks.save({"name": "fresh", "tags": ["red hair"]})
    ok("牌組樣子不對時這次不存", False)
except file_lock.StoreCorrupt:
    ok("牌組樣子不對時這次不存", True)
left = save_deck.read_text(encoding="utf-8") if save_deck.exists() else ""
bak = file_lock.backup_path(save_deck)
ok(
    "這次存檔沒有把牌組蓋成只有新的那組",
    "fresh" not in left and (not bak.exists() or "fresh" not in bak.read_text(encoding="utf-8")),
    left[:200],
)

_deck(tmp / "decks-bak.json")
kept_deck = card_decks.save({"name": "留著的", "tags": ["solo"]})["deck"]
bak_main = card_decks.DECKS_PATH
bak_main.write_text(json.dumps({"decks": {"old": [{"id": "test-prior", "tags": ["red hair"]}]}}), encoding="utf-8")
restored_decks = card_decks.load()
ok("牌組樣子不對、備份還在：用備份換回，不會變成空的", any(d["id"] == kept_deck["id"] for d in restored_decks), str(restored_decks))

_deck(tmp / "decks-busy.json")
card_decks.save({"name": "留著", "tags": ["1girl"]})
busy = card_decks.DECKS_PATH
busy_before = busy.read_bytes()
busy_bak = file_lock.backup_path(busy).read_bytes()


def _busy_deck(self, *args, **kwargs):
    if Path(self) == busy:
        raise PermissionError("busy")
    return real_read(self, *args, **kwargs)


with patch.object(Path, "read_text", _busy_deck):
    try:
        card_decks.save({"name": "fresh", "tags": ["red hair"]})
        ok("牌組讀不到就拒絕寫入", False)
    except file_lock.StoreCorrupt:
        ok("牌組讀不到就拒絕寫入", True)
ok("牌組讀不到時正本和 .bak 都不動", busy.read_bytes() == busy_before and file_lock.backup_path(busy).read_bytes() == busy_bak)


# ---- 7. 卡面烤到一半又排了一次：第一次烤完不能寫成完成 ----
tag = "astra6-bake"
server._ART_BAKE["queue"].clear()
server._ART_BAKE["state"].pop(tag, None)
server._ART_BAKE["worker"] = None
phase = {"finish": False, "saw": None}
calls = []


class _Watch:
    def __init__(self):
        self._lock = threading.Lock()

    def __enter__(self):
        self._lock.acquire()

    def __exit__(self, *exc):
        try:
            if phase["finish"] and phase["saw"] is None and tag in server._ART_BAKE["queue"]:
                st = server._ART_BAKE["state"].get(tag) or {}
                phase["saw"] = st.get("state")
        finally:
            self._lock.release()


server._ART_BAKE["lock"] = _Watch()


def _fake_run(cmd, **kwargs):
    calls.append(list(cmd))
    if len(calls) == 1:
        server.queue_card_bake(tag)
        phase["finish"] = True
    return server.subprocess.CompletedProcess(cmd, 0, "", "")


with patch.object(server.subprocess, "run", _fake_run):
    server.queue_card_bake(tag)
    worker = server._ART_BAKE["worker"]
    joined = worker.join(5) if worker else None
ok(
    "烤完時這張牌還在佇列就保持排隊，第二次才寫成完成",
    worker is not None and not worker.is_alive() and len(calls) == 2 and phase["saw"] == "queued"
    and server._ART_BAKE["state"].get(tag, {}).get("state") == "done",
    str((len(calls), phase["saw"], server._ART_BAKE["state"].get(tag), worker.is_alive() if worker else None)),
)


# ---- 作品錯誤的 HTTP 狀態（收藏鈕只認 404，舊分頁要 409）----
class _Capture:
    def _json(self, status, body):
        self.status = status
        self.body = body


cap = _Capture()
server.Handler._recipe_error(cap, recipes.RecipeError("這件作品已在別處刪掉。", "gone"))
ok("舊分頁把已刪作品存回來是 409", cap.status == 409 and cap.body["code"] == "gone")
server.Handler._recipe_error(cap, recipes.RecipeError("這件作品的存檔壞了，已改名留著。可以再收藏一次。", "corrupt"))
ok("壞掉的單件查詢是 404，收藏鈕才會重收", cap.status == 404 and cap.body["code"] == "corrupt")
server.Handler._recipe_error(cap, recipes.RecipeError("讀不到這件作品的存檔：busy", "unavailable"))
ok("作品檔暫時讀不到是 503，不會被當成已刪", cap.status == 503 and cap.body["code"] == "unavailable")

print("all ok" if not failed else f"{failed} failed")
sys.exit(1 if failed else 0)
