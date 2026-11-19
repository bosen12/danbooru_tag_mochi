"""牌組（web6／web7）：把一組常用的牌取個名字存起來，墨池、疊印台一點就套用。

只存牌（詞庫裡的字）跟名字，不存規則：套用時尺度、時代、人物照當下的設定。
所有裝置（手機、電腦）共用這一份；一份 JSON，幾十組也只有幾 KB。

偏好角色（web6/fav-chars.js 的名單）也存在這裡（data/fav_chars.json）：以前只存在瀏覽器，
清掉瀏覽器資料、換台電腦就沒了。
偏好卡牌（web6/hand.js 的托盤，data/fav_hand.json）也一樣：所有裝置、墨池／卡冊／疊印台共用一份
（2026-11-18 以前只存在瀏覽器，而且疊印台自己一份）。跟偏好角色同一套存法（_load_list／_save_list），
多記一個順序（托盤可以排順序）。
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
FAV_HAND_PATH = Path(os.environ.get("CARD_FAV_HAND_PATH") or ROOT / "data" / "fav_hand.json")

MAX_DECKS = 200
MAX_FAV_CHARS = 3000
MAX_TAGS = 60
MAX_NAME = 40
_ID_RE = re.compile(r"^[a-z0-9-]{4,40}$")

_LOCK = threading.Lock()


class DeckError(ValueError):
    def __init__(self, message: str, bad: list | None = None):
        super().__init__(message)
        self.bad = bad or []


class DeckConflict(DeckError):
    def __init__(self, message: str, code: str, current: dict | None):
        super().__init__(message)
        self.code = code
        self.current = current


def _read() -> list[dict]:
    # 讀不懂的檔不能當成空的：下一次存牌組會用空的那份把整份蓋掉。先試 .bak，再不行丟 StoreCorrupt（伺服器回 503）。
    data = file_lock.read_json(DECKS_PATH, label="牌組")
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
    """新建不帶 id；更新要帶讀到的 updatedAt；刪除後復原才帶 restore: true。"""
    if not isinstance(payload, dict):
        raise DeckError("要是物件")
    name = " ".join(str(payload.get("name") or "").split())[:MAX_NAME]
    if not name:
        raise DeckError("牌組要有名字")
    raw = payload.get("tags")
    if not isinstance(raw, list):
        raise DeckError("tags 要是陣列")
    known = card_usage._known_tags()
    tags, seen, bad = [], set(), []
    for t in raw:
        tag = card_usage.rename(t) if isinstance(t, str) else ""
        if not tag.strip() or tag.startswith("custom:") or (known and tag not in known):
            bad.append(t)
        elif tag not in seen:
            seen.add(tag)
            tags.append(tag)
    if bad:
        raise DeckError("牌組只能存詞庫裡的牌", bad)
    if not tags:
        raise DeckError("牌組裡至少要有一張詞庫裡的牌")
    if len(tags) > MAX_TAGS:
        raise DeckError(f"牌組最多 {MAX_TAGS} 張", tags[MAX_TAGS:])
    rid = str(payload.get("id") or "")
    if rid and not _ID_RE.fullmatch(rid):
        raise DeckError("牌組 id 不對")
    seen_at = payload.get("updatedAt")
    restore = bool(rid) and payload.get("restore") is True
    # 舊版面（web7 的牌組面板）不帶 updatedAt、也不帶 restore：照以前的規矩（有就覆寫、沒有就照 id 建回來），
    # 不然那邊改名、刪掉後按「復原」全部變成 409。帶了 updatedAt 的（web6）才嚴格核對版本。
    legacy = "updatedAt" not in payload and "restore" not in payload
    with _LOCK, file_lock.locked(DECKS_PATH):
        decks = _read()
        hit = next((d for d in decks if d["id"] == rid), None) if rid else None
        now = int(time.time() * 1000)
        weights = _clean_weights(payload.get("weights"), tags)
        if hit:
            # 復原只准補回已刪項目；重送復原也不能覆蓋目前這一組。
            if not legacy and (restore or type(seen_at) is not int or seen_at != hit["updatedAt"]):
                raise DeckConflict("這組牌已在別處變更。草稿還在，請重新載入或另存一組。", "stale", hit)
            hit.update(name=name, tags=tags, weights=weights, updatedAt=max(now, hit["updatedAt"] + 1))
            deck = hit
        else:
            if rid and not restore and not legacy:
                raise DeckConflict("這組牌已在別處刪除。草稿還在，請重新載入或另存一組。", "gone", None)
            if len(decks) >= MAX_DECKS:
                raise DeckError(f"牌組最多 {MAX_DECKS} 組，先刪掉一些")
            deck = {
                "id": rid or "d-" + uuid.uuid4().hex[:12],
                "name": name,
                "tags": tags,
                "weights": weights,
                "createdAt": int(payload.get("createdAt") or 0) or now,
                "updatedAt": max(now, seen_at + 1) if restore and type(seen_at) is int else now,
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


def _read_list(path: Path, label: str) -> dict | None:
    # 只在缺檔時開放第一次搬移；讀不了時不能請瀏覽器拿舊快取補上來。
    data = file_lock.read_json(path, label=label)
    if data is None:
        # read_json 也會把 JSON 的 null 讀成 None；只有確定檔案不存在才算沒存過。
        try:
            path.stat()
        except FileNotFoundError:
            return None
    if not (isinstance(data, dict) and isinstance(data.get("tags"), list)):
        raise file_lock.StoreCorrupt(f"伺服器上的{label}存檔格式不對。")
    return data


def _load_list(path: Path, label: str) -> dict:
    with _LOCK, file_lock.locked(path):
        data = _read_list(path, label)
        if data is None:
            return {"tags": [], "saved": False, "at": 0}
        return {"tags": _clean_fav(data["tags"]), "saved": True, "at": int(data.get("at") or 0)}


def _save_list(path: Path, label: str, payload: dict) -> dict:
    """兩種：
    - {"add": [...], "remove": [...], "order": [...]?}：套在伺服器現在那份上（新加的放最前面）。手機、電腦同時改，
      兩邊的都留著；以前只有整份換掉，後送的那台把先送的那台加的蓋掉。
      order（偏好卡牌：托盤排過順序）：照它排，它裡面沒有的（別台剛加的）留在最前面。
    - {"tags": [...]}：整份名單換掉（空陣列＝清空，也算存過）。舊版網頁、第一次把這台的搬上來用。
    """
    if not isinstance(payload, dict):
        raise DeckError("要是物件")
    ops = isinstance(payload.get("add"), list) or isinstance(payload.get("remove"), list) or isinstance(payload.get("order"), list)
    if not ops and not isinstance(payload.get("tags"), list):
        raise DeckError("tags 要是陣列")
    now = int(time.time() * 1000)
    fresh = False
    with _LOCK, file_lock.locked(path):
        if ops:
            current = _read_list(path, label)
            # 原本沒有名單（換了一份資料夾、檔案被刪掉）卻只收到改動：回 fresh，網頁會把它那整份合起來再送一次。
            fresh = current is None
            have = [] if fresh else _clean_fav(current["tags"])
            gone = set(_clean_fav(payload.get("remove")))
            added = [t for t in _clean_fav(payload.get("add")) if t not in gone]
            tags = _clean_fav(added + [t for t in have if t not in gone])
            order = _clean_fav(payload.get("order")) if isinstance(payload.get("order"), list) else None
            if order:
                rank = {t: i for i, t in enumerate(order)}
                tags = [t for t in tags if t not in rank] + sorted((t for t in tags if t in rank), key=rank.get)
        else:
            tags = _clean_fav(payload["tags"])
        file_lock.write_text(path, json.dumps({"v": 1, "at": now, "tags": tags}, ensure_ascii=False, separators=(",", ":")))
    return {"tags": tags, "saved": True, "at": now, **({"fresh": True} if fresh else {})}


def load_fav_chars() -> dict:
    """{"tags": [...新加的在前], "saved": 伺服器上有沒有存過, "at": 最後存的時間（毫秒）}。
    沒存過才回 saved=False：瀏覽器會把它自己那份搬上來。"""
    return _load_list(FAV_CHARS_PATH, "偏好角色")


def load_fav_hand() -> dict:
    """偏好卡牌（托盤上的牌，照托盤的順序）。樣子跟 load_fav_chars 一樣。"""
    return _load_list(FAV_HAND_PATH, "偏好卡牌")


def save_fav_hand(payload: dict) -> dict:
    return _save_list(FAV_HAND_PATH, "偏好卡牌", payload)


def save_fav_chars(payload: dict) -> dict:
    """偏好角色：照增減套上去，或整份換掉（_save_list）。"""
    return _save_list(FAV_CHARS_PATH, "偏好角色", payload)


def delete(rid: str) -> dict:
    with _LOCK, file_lock.locked(DECKS_PATH):
        decks = _read()
        gone = next((d for d in decks if d["id"] == rid), None)
        if gone is None:
            raise DeckError("找不到這組牌")
        decks = [d for d in decks if d["id"] != rid]
        _write(decks)
        return {"deck": gone, "decks": _sorted(decks)}
