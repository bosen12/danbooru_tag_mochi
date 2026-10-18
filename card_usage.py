"""卡冊的使用次數（web6／web7 的 book.html）。

一份 JSON：每張牌一個數字（用過幾次）、親手放幾次、最近一次的時間（毫秒）。
不記每一次的流水帳、不存圖：詞庫有幾張牌，這份檔案就最多幾筆，用多久都一樣大（幾十 KB）。
只收詞庫裡真的有的字，亂送的字串不會讓它長大。

所有裝置（手機、電腦、不同瀏覽器）共用這一份；瀏覽器那邊只是快取與離線時的暫存。
"""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path

import file_lock

ROOT = Path(__file__).resolve().parent
USAGE_PATH = Path(os.environ.get("CARD_USAGE_PATH") or ROOT / "data" / "card_usage.json")
LEXICON_PATH = Path(os.environ.get("CARD_USAGE_LEXICON") or ROOT / "web" / "lexicon.json")

# 一次請求最多幾筆成品、一筆最多幾個字（無限抽一輪也遠低於這個）。
MAX_ENTRIES = 500
MAX_TAGS = 200

_LOCK = threading.Lock()
# 收過的事件編號（每筆成品、第一次的 merge 各一個）：同一筆送兩次只算一次。
# 回應在路上掉了、瀏覽器重送，或墨池、疊印台兩個分頁同時送同一筆，都會送到第二次。
# 只要記得住「還可能重送」的那段時間：瀏覽器最多排 300 筆待送，留 5000 個很夠。
SEEN_MAX = 5000
_lex_cache: dict = {"mtime": None, "tags": frozenset(), "renamed": {}}


class UsageError(ValueError):
    pass


def _known_tags() -> frozenset:
    """詞庫裡的字（lexicon.json 改了就重讀）。"""
    try:
        mtime = LEXICON_PATH.stat().st_mtime
    except OSError:
        return _lex_cache["tags"]
    if _lex_cache["mtime"] != mtime:
        try:
            data = json.loads(LEXICON_PATH.read_text(encoding="utf-8"))
            _lex_cache["tags"] = frozenset(str(t.get("tag")) for t in data.get("tags") or [] if t.get("tag"))
            renamed = data.get("renamed")
            _lex_cache["renamed"] = {str(k): str(v) for k, v in renamed.items()} if isinstance(renamed, dict) else {}
            _lex_cache["mtime"] = mtime
        except (OSError, ValueError):
            pass
    return _lex_cache["tags"]


def renamed_tags() -> dict:
    """詞庫換過名的字（舊名 -> 新名，lexicon.json 的 renamed）。存著的舊名讀出來時換成新名。"""
    _known_tags()
    return _lex_cache["renamed"]


def rename(tag: str) -> str:
    return renamed_tags().get(tag, tag)


def _blank() -> dict:
    return {"v": 1, "counts": {}, "mine": {}, "last": {}, "updated": 0, "seen": []}


def _read() -> dict:
    # 讀不懂的檔不能當成空的：整晚無限抽每一輪都在寫，空的那份會把幾千次的紀錄一次蓋掉。
    # 先試 .bak；再不行丟 StoreCorrupt（伺服器回 503，壞的那份改名留著）。
    try:
        data = file_lock.read_json(USAGE_PATH, label="牌的使用次數")
    except OSError:
        return _blank()
    if data is None:
        return _blank()
    if not isinstance(data, dict):
        return _blank()
    out = _blank()
    for key in ("counts", "mine", "last"):
        val = data.get(key)
        if isinstance(val, dict):
            got: dict = {}
            for k, v in val.items():
                if not isinstance(v, (int, float)) or v <= 0:
                    continue
                # 換過名的字：舊名的次數併進新名（次數相加；最近一次取較晚的）。
                name = rename(str(k))
                got[name] = max(got.get(name, 0), int(v)) if key == "last" else got.get(name, 0) + int(v)
            out[key] = got
    out["updated"] = int(data.get("updated") or 0)
    seen = data.get("seen")
    if isinstance(seen, list):
        out["seen"] = [str(x) for x in seen if isinstance(x, str)][-SEEN_MAX:]
    return out


def _public(state: dict) -> dict:
    """給網頁的：收過的編號只有伺服器自己要用，不跟著每次回應送出去。"""
    return {k: v for k, v in state.items() if k != "seen"}


def _event_id(raw) -> str:
    return raw[:64] if isinstance(raw, str) and raw.strip() else ""


def _write(state: dict) -> None:
    file_lock.write_text(USAGE_PATH, json.dumps(state, ensure_ascii=False, separators=(",", ":")))


def load() -> dict:
    with _LOCK, file_lock.locked(USAGE_PATH):
        return _public(_read())


def add(payload: dict) -> dict:
    """payload：{"entries": [{"id", "tags": [...], "mine": [...], "at": 毫秒}], "merge": {...}, "mergeId"}。

    entries 每筆＝一張成品。merge 是某個瀏覽器在有伺服器紀錄之前、自己記在本機的累計
    （{"counts", "mine", "last"}），只在它第一次連上時送一次，加進總數。
    帶 id／mergeId 的收過就不再算（重送、兩個分頁同時送）；沒帶的（舊版網頁）照舊每次都算。"""
    entries = payload.get("entries", []) if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        raise UsageError("entries 要是陣列")
    merge = payload.get("merge") if isinstance(payload.get("merge"), dict) else None
    if len(entries) > MAX_ENTRIES:
        raise UsageError(f"一次最多 {MAX_ENTRIES} 筆")
    known = _known_tags()
    now = int(time.time() * 1000)
    with _LOCK, file_lock.locked(USAGE_PATH):
        state = _read()
        seen_ids = state["seen"]
        seen_set = set(seen_ids)
        for e in entries:
            if not isinstance(e, dict):
                continue
            tags = e.get("tags")
            if not isinstance(tags, list):
                continue
            eid = _event_id(e.get("id"))
            if eid:
                if eid in seen_set:
                    continue
                seen_ids.append(eid)
                seen_set.add(eid)
            mine = {str(t) for t in (e.get("mine") or []) if isinstance(t, str)}
            at = e.get("at")
            at = int(at) if isinstance(at, (int, float)) and 0 < at <= now + 60_000 else now
            seen = set()
            for t in tags[:MAX_TAGS]:
                if not isinstance(t, str) or t in seen or (known and t not in known):
                    continue
                seen.add(t)
                state["counts"][t] = state["counts"].get(t, 0) + 1
                if t in mine:
                    state["mine"][t] = state["mine"].get(t, 0) + 1
                if state["last"].get(t, 0) < at:
                    state["last"][t] = at
        mid = _event_id(payload.get("mergeId")) if merge else ""
        if mid and mid in seen_set:
            merge = None
        elif mid:
            seen_ids.append(mid)
        if merge:
            for key in ("counts", "mine"):
                src = merge.get(key)
                if not isinstance(src, dict):
                    continue
                for t, n in list(src.items())[: len(known) or 5000]:
                    if isinstance(t, str) and isinstance(n, (int, float)) and 0 < n < 1_000_000 and (not known or t in known):
                        state[key][t] = state[key].get(t, 0) + int(n)
            last = merge.get("last")
            if isinstance(last, dict):
                for t, at in last.items():
                    if isinstance(t, str) and isinstance(at, (int, float)) and 0 < at <= now + 60_000 and (not known or t in known):
                        if state["last"].get(t, 0) < at:
                            state["last"][t] = int(at)
        state["updated"] = now
        state["seen"] = seen_ids[-SEEN_MAX:]
        _write(state)
        return _public(state)
