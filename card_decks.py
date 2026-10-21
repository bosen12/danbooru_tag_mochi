"""牌組（web6／web7）：把一組常用的牌取個名字存起來，墨池、疊印台一點就套用。

只存牌（詞庫裡的字）跟名字，不存規則：套用時尺度、時代、人物照當下的設定。
所有裝置（手機、電腦）共用這一份；一份 JSON，幾十組也只有幾 KB。

偏好角色（web6/fav-chars.js 的名單）也存在這裡（data/fav_chars.json）：以前只存在瀏覽器，
清掉瀏覽器資料、換台電腦就沒了。
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from pathlib import Path

import card_usage
import file_lock

ROOT = Path(__file__).resolve().parent
DECKS_PATH = Path(os.environ.get("CARD_DECKS_PATH") or ROOT / "data" / "card_decks.json")

FAV_CHARS_PATH = Path(os.environ.get("CARD_FAV_CHARS_PATH") or ROOT / "data" / "fav_chars.json")

MAX_DECKS = 200
MAX_FAV_CHARS = 3000
MAX_TAGS = 60
MAX_NAME = 40
_ID_RE = re.compile(r"^[a-z0-9-]{4,40}$")

_LOCK = threading.Lock()


class DeckError(ValueError):
    pass


def _read() -> list[dict]:
    # 讀不懂的檔不能當成空的：下一次存牌組會用空的那份把整份蓋掉。先試 .bak，再不行丟 StoreCorrupt（伺服器回 503）。
    try:
        data = file_lock.read_json(DECKS_PATH, label="牌組")
    except OSError:
        return []
    if data is None:
        return []
    out = []
    for d in (data.get("decks") if isinstance(data, dict) else None) or []:
        if not isinstance(d, dict) or not _ID_RE.match(str(d.get("id") or "")):
            continue
        # 詞庫換過名的字：舊名換成新名（card_usage.rename 讀 lexicon.json 的 renamed）。
        tags = list(dict.fromkeys(card_usage.rename(str(t)) for t in d.get("tags") or [] if isinstance(t, str)))[:MAX_TAGS]
        out.append({
            "id": d["id"],
            "name": str(d.get("name") or "")[:MAX_NAME] or "未命名",
            "tags": tags,
            "weights": _clean_weights(d.get("weights"), tags),
            "createdAt": int(d.get("createdAt") or 0),
            "updatedAt": int(d.get("updatedAt") or 0),
        })
    return out


def _clean_weights(raw, tags: list[str]) -> dict:
    """份量（weights.js）：只留牌組裡有的牌、0.5～1.5、一位小數、不是 1 的。"""
    out = {}
    if isinstance(raw, dict):
        keep = set(tags)
        for t, w in raw.items():
            t = card_usage.rename(str(t))
            if t not in keep or isinstance(w, bool) or not isinstance(w, (int, float)):
                continue
            n = round(float(w), 1)
            if 0.5 <= n <= 1.5 and n != 1:
                out[t] = n
    return out


def _write(decks: list[dict]) -> None:
    file_lock.write_text(DECKS_PATH, json.dumps({"v": 1, "decks": decks}, ensure_ascii=False, separators=(",", ":")))


def _sorted(decks: list[dict]) -> list[dict]:
    # 最近改過的在前；同一毫秒的（連按兩次）後存的在前。
    order = sorted(enumerate(decks), key=lambda p: (p[1]["updatedAt"], p[0]), reverse=True)
    return [d for _, d in order]


def load() -> list[dict]:
    with _LOCK, file_lock.locked(DECKS_PATH):
        return _sorted(_read())


def save(payload: dict) -> dict:
    """新增或改一組：{"id"?, "name", "tags"}。帶 id 而且已經有就覆寫（改名、換牌、刪掉後復原）。"""
    if not isinstance(payload, dict):
        raise DeckError("要是物件")
    name = " ".join(str(payload.get("name") or "").split())[:MAX_NAME]
    if not name:
        raise DeckError("牌組要有名字")
    raw = payload.get("tags")
    if not isinstance(raw, list):
        raise DeckError("tags 要是陣列")
    known = card_usage._known_tags()
    tags, seen = [], set()
    for t in raw:
        if isinstance(t, str) and t not in seen and (not known or t in known):
            seen.add(t)
            tags.append(t)
    if not tags:
        raise DeckError("牌組裡至少要有一張詞庫裡的牌")
    tags = tags[:MAX_TAGS]
    rid = str(payload.get("id") or "")
    now = int(time.time() * 1000)
    with _LOCK, file_lock.locked(DECKS_PATH):
        decks = _read()
        hit = next((d for d in decks if d["id"] == rid), None) if _ID_RE.match(rid) else None
        weights = _clean_weights(payload.get("weights"), tags)
        if hit:
            hit.update(name=name, tags=tags, weights=weights, updatedAt=now)
            deck = hit
        else:
            if len(decks) >= MAX_DECKS:
                raise DeckError(f"牌組最多 {MAX_DECKS} 組，先刪掉一些")
            deck = {
                "id": rid if _ID_RE.match(rid) else "d-" + uuid.uuid4().hex[:12],
                "name": name,
                "tags": tags,
                "weights": weights,
                "createdAt": int(payload.get("createdAt") or 0) or now,
                "updatedAt": now,
            }
            decks.append(deck)
        _write(decks)
        return {"deck": deck, "decks": _sorted(decks)}


# ---------- 偏好角色 ----------


def _clean_fav(raw) -> list[str]:
    out, seen = [], set()
    for t in raw if isinstance(raw, list) else []:
        if not isinstance(t, str):
            continue
        t = card_usage.rename(t.strip())
        if t and len(t) <= 200 and t not in seen:
            seen.add(t)
            out.append(t)
    return out[:MAX_FAV_CHARS]


def load_fav_chars() -> dict:
    """{"tags": [...新加的在前], "saved": 伺服器上有沒有存過, "at": 最後存的時間（毫秒）}。
    沒存過（或檔案壞了）saved 是 False：瀏覽器會把它自己那份搬上來。"""
    with _LOCK, file_lock.locked(FAV_CHARS_PATH):
        # 讀不懂：先試 .bak。也不行就當成沒存過（壞的那份 read_json 已經改名留著），瀏覽器那份會補上來。
        try:
            data = file_lock.read_json(FAV_CHARS_PATH, label="偏好角色")
        except (OSError, file_lock.StoreCorrupt):
            return {"tags": [], "saved": False, "at": 0}
        if not isinstance(data, dict):
            return {"tags": [], "saved": False, "at": 0}
        return {"tags": _clean_fav(data.get("tags")), "saved": True, "at": int(data.get("at") or 0)}


def save_fav_chars(payload: dict) -> dict:
    """兩種：
    - {"add": [...], "remove": [...]}：套在伺服器現在那份上（新加的放最前面）。手機、電腦同時改，兩邊的都留著；
      以前只有整份換掉，後送的那台把先送的那台加的蓋掉。
    - {"tags": [...]}：整份名單換掉（空陣列＝清空，也算存過）。舊版網頁、第一次把這台的搬上來用。
    """
    if not isinstance(payload, dict):
        raise DeckError("要是物件")
    ops = isinstance(payload.get("add"), list) or isinstance(payload.get("remove"), list)
    if not ops and not isinstance(payload.get("tags"), list):
        raise DeckError("tags 要是陣列")
    now = int(time.time() * 1000)
    fresh = False
    with _LOCK, file_lock.locked(FAV_CHARS_PATH):
        if ops:
            try:
                current = file_lock.read_json(FAV_CHARS_PATH, label="偏好角色")
            except (OSError, file_lock.StoreCorrupt):
                current = None
            # 原本沒有名單（換了一份資料夾、檔案被刪掉）卻只收到改動：回 fresh，網頁會把它那整份合起來再送一次。
            fresh = not isinstance(current, dict)
            have = _clean_fav(current.get("tags")) if isinstance(current, dict) else []
            gone = set(_clean_fav(payload.get("remove")))
            added = [t for t in _clean_fav(payload.get("add")) if t not in gone]
            tags = _clean_fav(added + [t for t in have if t not in gone])
        else:
            tags = _clean_fav(payload["tags"])
        file_lock.write_text(FAV_CHARS_PATH, json.dumps({"v": 1, "at": now, "tags": tags}, ensure_ascii=False, separators=(",", ":")))
    return {"tags": tags, "saved": True, "at": now, **({"fresh": True} if fresh else {})}


def delete(rid: str) -> dict:
    with _LOCK, file_lock.locked(DECKS_PATH):
        decks = _read()
        gone = next((d for d in decks if d["id"] == rid), None)
        if gone is None:
            raise DeckError("找不到這組牌")
        decks = [d for d in decks if d["id"] != rid]
        _write(decks)
        return {"deck": gone, "decks": _sorted(decks)}
