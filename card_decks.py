"""牌組（web6／web7）：把一組常用的牌取個名字存起來，墨池、疊印台一點就套用。

只存牌（詞庫裡的字）跟名字，不存規則：套用時尺度、時代、人物照當下的設定。
所有裝置（手機、電腦）共用這一份；一份 JSON，幾十組也只有幾 KB。
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

ROOT = Path(__file__).resolve().parent
DECKS_PATH = Path(os.environ.get("CARD_DECKS_PATH") or ROOT / "data" / "card_decks.json")

MAX_DECKS = 200
MAX_TAGS = 60
MAX_NAME = 40
_ID_RE = re.compile(r"^[a-z0-9-]{4,40}$")

_LOCK = threading.Lock()


class DeckError(ValueError):
    pass


def _read() -> list[dict]:
    try:
        data = json.loads(DECKS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    out = []
    for d in (data.get("decks") if isinstance(data, dict) else None) or []:
        if not isinstance(d, dict) or not _ID_RE.match(str(d.get("id") or "")):
            continue
        tags = [str(t) for t in d.get("tags") or [] if isinstance(t, str)][:MAX_TAGS]
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
            if t not in keep or isinstance(w, bool) or not isinstance(w, (int, float)):
                continue
            n = round(float(w), 1)
            if 0.5 <= n <= 1.5 and n != 1:
                out[t] = n
    return out


def _write(decks: list[dict]) -> None:
    DECKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = DECKS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps({"v": 1, "decks": decks}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, DECKS_PATH)


def _sorted(decks: list[dict]) -> list[dict]:
    # 最近改過的在前；同一毫秒的（連按兩次）後存的在前。
    order = sorted(enumerate(decks), key=lambda p: (p[1]["updatedAt"], p[0]), reverse=True)
    return [d for _, d in order]


def load() -> list[dict]:
    with _LOCK:
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
    with _LOCK:
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


def delete(rid: str) -> dict:
    with _LOCK:
        decks = _read()
        gone = next((d for d in decks if d["id"] == rid), None)
        if gone is None:
            raise DeckError("找不到這組牌")
        decks = [d for d in decks if d["id"] != rid]
        _write(decks)
        return {"deck": gone, "decks": _sorted(decks)}
