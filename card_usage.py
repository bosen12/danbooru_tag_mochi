"""卡冊的使用次數（web6／web7 的 book.html）。

一份 JSON：每張牌一個數字（用過幾次）、親手放幾次、最近一次的時間（毫秒）。
不記每一次的流水帳、不存圖：詞庫有幾張牌，這份檔案就最多幾筆，用多久都一樣大（幾十 KB）。
只收詞庫裡真的有的字，亂送的字串不會讓它長大。

所有裝置（手機、電腦、不同瀏覽器）共用這一份；瀏覽器那邊只是快取與離線時的暫存。
"""

from __future__ import annotations

import json
import os
import shutil
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


_USAGE_KEYS = {"v", "counts", "mine", "last", "updated", "seen"}


def _coerce_usage(data):
    """舊格式：整份就是 {牌: 次數}，沒有 counts。認得出來就轉，不要當成空的蓋掉。"""
    if not isinstance(data, dict) or not data or (set(data) & _USAGE_KEYS):
        return data
    if all(isinstance(k, str) and isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0 for k, v in data.items()):
        return {"v": 1, "counts": {k: int(v) for k, v in data.items()}, "mine": {}, "last": {}, "updated": 0, "seen": []}
    return data


def _usage_ok(data) -> bool:
    data = _coerce_usage(data)
    if not isinstance(data, dict):
        return False
    for key in ("counts", "mine", "last"):
        if key in data and not isinstance(data[key], dict):
            return False
    if "seen" in data and not isinstance(data["seen"], list):
        return False
    return True


def _recover_shape():
    """JSON 讀得懂、樣子卻不對（例如 [] 或 null）：跟讀不懂的檔一樣，這一次不存。
    壞的改名留著，試 .bak；備份的樣子對就換回來。"""
    path = USAGE_PATH
    stamp = time.strftime("%Y%m%d-%H%M%S")
    aside = path.with_name(f"{path.name}.corrupt-{stamp}")
    n = 2
    while aside.exists():
        aside = path.with_name(f"{path.name}.corrupt-{stamp}-{n}")
        n += 1
    try:
        shutil.copyfile(path, aside)
    except OSError:
        pass
    bak = file_lock.backup_path(path)
    try:
        data = json.loads(bak.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError):
        data = None
    if _usage_ok(data):
        # 換回備份失敗（檔案被占用）：跟讀不到一樣回 503，這次不存；不要變成 500。
        try:
            shutil.copyfile(bak, path)
        except OSError as exc:
            raise file_lock.StoreCorrupt(f"伺服器換不回牌的使用次數的備份（{path.name}）：{exc}") from None
        print(f"[存檔] {path.name} 樣子不對，已用 {bak.name} 換回（壞的留在 {aside.name}）", flush=True)
        return _coerce_usage(data)
    try:
        path.unlink()
    except OSError:
        pass
    raise file_lock.StoreCorrupt(
        f"伺服器上的牌的使用次數存檔（{path.name}）樣子不對，也沒有能用的備份。"
        f"那份改名成 {aside.name} 留著；之後存的會從空的開始。"
    )


def _read() -> dict:
    # 讀不懂、讀不到、樣子不對，都不能當成空的：整晚無限抽每一輪都在寫，空的那份會把幾千次的紀錄跟 .bak 一次蓋掉。
    # 檔案不存在才是第一次用。讀不到（檔案被占用）這一次不存，正本和 .bak 都不動。
    try:
        data = file_lock.read_json(USAGE_PATH, label="牌的使用次數")
    except OSError as exc:
        raise file_lock.StoreCorrupt(f"伺服器讀不到牌的使用次數存檔（{USAGE_PATH.name}）：{exc}") from None
    if data is None:
        try:
            USAGE_PATH.stat()
        except FileNotFoundError:
            return _blank()
        except OSError as exc:
            raise file_lock.StoreCorrupt(f"伺服器讀不到牌的使用次數存檔（{USAGE_PATH.name}）：{exc}") from None
    if not _usage_ok(data):
        data = _recover_shape()
    else:
        data = _coerce_usage(data)
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


# 檔案沒變就不重讀：卡冊每次開、定時問一次，以前每次都在鎖底下重讀、重解析整個檔（單次 31ms，同時好幾個就排隊）。
_LOAD_CACHE: dict = {"key": None, "value": None}


def load() -> dict:
    with _LOCK, file_lock.locked(USAGE_PATH):
        try:
            st = USAGE_PATH.stat()
            key = (str(USAGE_PATH), st.st_mtime_ns, st.st_size)
        except OSError:
            key = None
        if key and _LOAD_CACHE["key"] == key:
            return _LOAD_CACHE["value"]
        value = _public(_read())
        _LOAD_CACHE.update(key=key, value=value)
        return value


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
