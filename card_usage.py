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

ROOT = Path(__file__).resolve().parent
USAGE_PATH = Path(os.environ.get("CARD_USAGE_PATH") or ROOT / "data" / "card_usage.json")
LEXICON_PATH = Path(os.environ.get("CARD_USAGE_LEXICON") or ROOT / "web" / "lexicon.json")

# 一次請求最多幾筆成品、一筆最多幾個字（無限抽一輪也遠低於這個）。
MAX_ENTRIES = 500
MAX_TAGS = 200

_LOCK = threading.Lock()
_lex_cache: dict = {"mtime": None, "tags": frozenset()}


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
            _lex_cache["mtime"] = mtime
        except (OSError, ValueError):
            pass
    return _lex_cache["tags"]


def _blank() -> dict:
    return {"v": 1, "counts": {}, "mine": {}, "last": {}, "updated": 0}


def _read() -> dict:
    try:
        data = json.loads(USAGE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return _blank()
    if not isinstance(data, dict):
        return _blank()
    out = _blank()
    for key in ("counts", "mine", "last"):
        val = data.get(key)
        if isinstance(val, dict):
            out[key] = {str(k): int(v) for k, v in val.items() if isinstance(v, (int, float)) and v > 0}
    out["updated"] = int(data.get("updated") or 0)
    return out


def _write(state: dict) -> None:
    USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = USAGE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, USAGE_PATH)


def load() -> dict:
    with _LOCK:
        return _read()


def add(payload: dict) -> dict:
    """payload：{"entries": [{"tags": [...], "mine": [...], "at": 毫秒}], "merge": {...}}。

    entries 每筆＝一張成品。merge 是某個瀏覽器在有伺服器紀錄之前、自己記在本機的累計
    （{"counts", "mine", "last"}），只在它第一次連上時送一次，加進總數。"""
    entries = payload.get("entries", []) if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        raise UsageError("entries 要是陣列")
    merge = payload.get("merge") if isinstance(payload.get("merge"), dict) else None
    if len(entries) > MAX_ENTRIES:
        raise UsageError(f"一次最多 {MAX_ENTRIES} 筆")
    known = _known_tags()
    now = int(time.time() * 1000)
    with _LOCK:
        state = _read()
        for e in entries:
            if not isinstance(e, dict):
                continue
            tags = e.get("tags")
            if not isinstance(tags, list):
                continue
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
        _write(state)
        return state
