"""自製牌（web6 卡冊的「自製」花色）：使用者把幾張現有的牌（帶權重）加上詞庫外的字，包成一張自己的牌。

引擎眼中自製牌就是好幾張牌：墨池放進合成池時逐張釘上成員，詞庫外的字接在提示詞裡。
這裡只管存讀、檢查，和卡面檔（正式的 art/、預覽的 drafts/）。烤圖本身在 server.py（要用它的 ComfyUI 連線）。

一張自製牌：
  {"id", "name", "rating", "members": [{"tag", "w"}], "extra": [{"text", "w"}],
   "face": {"positive", "manual", "seed", "art"}, "createdAt", "updatedAt"}

封鎖（未成年、禁用角色）由呼叫的人把 server.banned_in_prompt 傳進來（banned=），這裡不 import server。
"""

from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import threading
import time
from pathlib import Path

import card_usage
import file_lock

ROOT = Path(__file__).resolve().parent
CARDS_PATH = Path(os.environ.get("CUSTOM_CARDS_PATH") or ROOT / "data" / "custom_cards.json")
FILES_DIR = Path(os.environ.get("CUSTOM_CARDS_DIR") or ROOT / "data" / "custom_cards")
ART_DIR = FILES_DIR / "art"
DRAFT_DIR = FILES_DIR / "drafts"
MANIFEST = ROOT / "web" / "cards" / "manifest.json"

MAX_CARDS = 300
MAX_MEMBERS = 20
MAX_EXTRA = 12
MAX_EXTRA_TEXT = 300
MAX_NAME = 24
MAX_FACE = 1200
DRAFT_TTL = 24 * 3600
RATINGS = ("general", "sensitive", "explicit")
_ID_RE = re.compile(r"^c_[0-9a-f]{8}$")
DRAFT_RE = re.compile(r"^[0-9a-f]{16}$")
_ART_RE = re.compile(r"^c_[0-9a-f]{8}-[0-9a-f]{10}(?:\.thumb)?\.webp$")

_LOCK = threading.Lock()


class CustomError(ValueError):
    """訊息直接給畫面看。"""


def _weight(raw) -> float:
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return 1.0
    n = round(float(raw), 1)
    return n if 0.5 <= n <= 1.5 else 1.0


def _clean_text(raw) -> str:
    # 詞庫外的字：一段一個字，不能有逗號（逗號＝分隔），去掉控制字元、權重括號留給 w。
    s = " ".join(str(raw or "").replace(",", " ").split())
    return "".join(ch for ch in s if ch.isprintable())[:80]


def fill_text(card: dict) -> str:
    """送去生圖的那段（成員＋詞庫外，照順序、帶權重）。給封鎖檢查、分享、測試用。"""
    parts = []
    for m in card.get("members") or []:
        parts.append(m["tag"] if m.get("w", 1) == 1 else f"({m['tag']}:{m['w']})")
    for x in card.get("extra") or []:
        parts.append(x["text"] if x.get("w", 1) == 1 else f"({x['text']}:{x['w']})")
    return ", ".join(parts)


def _manifest_ratings() -> dict:
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {t: v.get("rating") for t, v in data.items() if isinstance(v, dict)} if isinstance(data, dict) else {}


def rating_floor(tags: list[str]) -> str:
    """分級下限：成員牌卡面分級最高的那張（全年齡 < 敏感 < 色情）。沒有卡面的牌不算。"""
    ratings = _manifest_ratings()
    best = 0
    for t in tags:
        r = ratings.get(t)
        if r in RATINGS:
            best = max(best, RATINGS.index(r))
    return RATINGS[best]


def _read() -> list[dict]:
    try:
        data = file_lock.read_json(CARDS_PATH, label="自製牌")
    except OSError:
        return []
    if data is None:
        return []
    out = []
    for c in (data.get("cards") if isinstance(data, dict) else None) or []:
        if isinstance(c, dict) and _ID_RE.match(str(c.get("id") or "")):
            for m in c.get("members") or []:
                m["tag"] = card_usage.rename(m["tag"])
            out.append(c)
    return out


def _write(cards: list[dict]) -> None:
    file_lock.write_text(CARDS_PATH, json.dumps({"v": 1, "cards": cards}, ensure_ascii=False, separators=(",", ":")))


def _sorted(cards: list[dict]) -> list[dict]:
    order = sorted(enumerate(cards), key=lambda p: (p[1].get("updatedAt", 0), p[0]), reverse=True)
    return [c for _, c in order]


def load() -> list[dict]:
    with _LOCK, file_lock.locked(CARDS_PATH):
        return _sorted(_read())


def _clean(payload: dict, banned) -> dict:
    """檢查、整理一張自製牌（不含 id、時間、卡面檔）。有問題丟 CustomError。"""
    if not isinstance(payload, dict):
        raise CustomError("要是物件")
    name = " ".join(str(payload.get("name") or "").split())[:MAX_NAME]
    if not name:
        raise CustomError("自製牌要有名字")
    known = card_usage._known_tags()
    members, seen = [], set()
    for m in payload.get("members") or []:
        if not isinstance(m, dict):
            continue
        tag = card_usage.rename(str(m.get("tag") or "").strip())
        if not tag or tag in seen or (known and tag not in known):
            continue
        seen.add(tag)
        members.append({"tag": tag, "w": _weight(m.get("w"))})
    if len(members) > MAX_MEMBERS:
        raise CustomError(f"一張自製牌最多 {MAX_MEMBERS} 張牌")
    extra, total = [], 0
    for x in payload.get("extra") or []:
        if not isinstance(x, dict):
            continue
        text = _clean_text(x.get("text"))
        if not text or text.lower() in seen:
            continue
        seen.add(text.lower())
        total += len(text)
        extra.append({"text": text, "w": _weight(x.get("w"))})
    if len(extra) > MAX_EXTRA or total > MAX_EXTRA_TEXT:
        raise CustomError(f"詞庫外的字太多了（最多 {MAX_EXTRA} 個、{MAX_EXTRA_TEXT} 字）")
    if not members and not extra:
        raise CustomError("至少要有一張牌或一個字")
    rating = str(payload.get("rating") or "")
    if rating not in RATINGS:
        raise CustomError("分級要是全年齡、敏感或色情")
    floor = rating_floor([m["tag"] for m in members])
    if RATINGS.index(rating) < RATINGS.index(floor):
        raise CustomError("分級不能低於裡面的牌（最低：" + {"general": "全年齡", "sensitive": "敏感", "explicit": "色情"}[floor] + "）")
    face_in = payload.get("face") if isinstance(payload.get("face"), dict) else {}
    face_pos = " ".join(str(face_in.get("positive") or "").split())[:MAX_FACE]
    seed = face_in.get("seed")
    seed = int(seed) & 0xFFFFFFFFFFFFFFFF if isinstance(seed, int) and not isinstance(seed, bool) and seed >= 0 else None
    card = {"name": name, "rating": rating, "members": members, "extra": extra,
            "face": {"positive": face_pos, "manual": bool(face_in.get("manual")), "seed": seed}}
    hit = banned(fill_text(card)) + banned(face_pos)
    if hit:
        raise CustomError("有不能用的字（未成年、禁用角色）：" + "、".join(dict.fromkeys(hit)))
    return card


def save(payload: dict, *, banned) -> dict:
    """新增或更新一張。帶 draft（預覽卡面的代號）就把那張預覽轉正成卡面；帶 face.art 而且檔還在就沿用（刪掉後復原）。"""
    card = _clean(payload, banned)
    rid = str(payload.get("id") or "")
    draft = str(payload.get("draft") or "")
    now = int(time.time() * 1000)
    with _LOCK, file_lock.locked(CARDS_PATH):
        cards = _read()
        hit = next((c for c in cards if c["id"] == rid), None) if _ID_RE.match(rid) else None
        if hit is None and len(cards) >= MAX_CARDS:
            raise CustomError(f"自製牌最多 {MAX_CARDS} 張，先刪掉一些")
        cid = hit["id"] if hit else (rid if _ID_RE.match(rid) else "c_" + secrets.token_hex(4))
        old_art = (hit or {}).get("face", {}).get("art") or ""
        art = old_art
        if not hit:
            # 復原：刪掉時卡面檔留著（prune 一天後才清），帶回原本的檔名就接得上。
            asked = str((payload.get("face") or {}).get("art") or "")
            if _ART_RE.match(asked) and asked.startswith(cid + "-") and (ART_DIR / asked).is_file():
                art = asked
        if draft:
            art = _promote(draft, cid) or art
        card["face"]["art"] = art
        if hit:
            hit.update(card, updatedAt=now)
            out = hit
        else:
            out = {"id": cid, **card, "createdAt": int(payload.get("createdAt") or 0) or now, "updatedAt": now}
            cards.append(out)
        _write(cards)
    if old_art and old_art != art:
        _remove_art(old_art)
    return {"card": out, "cards": _sorted(cards)}


def delete(rid: str) -> dict:
    """刪一張。卡面檔先留著（按復原會帶回來），prune 一天後清掉沒人用的。"""
    with _LOCK, file_lock.locked(CARDS_PATH):
        cards = _read()
        gone = next((c for c in cards if c["id"] == rid), None)
        if gone is None:
            raise CustomError("找不到這張自製牌")
        cards = [c for c in cards if c["id"] != rid]
        _write(cards)
        return {"card": gone, "cards": _sorted(cards)}


# ---------- 卡面檔 ----------

def new_draft() -> str:
    return secrets.token_hex(8)


def draft_paths(draft: str) -> tuple[Path, Path]:
    if not DRAFT_RE.match(draft):
        raise CustomError("預覽代號不對")
    return DRAFT_DIR / f"{draft}.webp", DRAFT_DIR / f"{draft}.thumb.webp"


def drop_draft(draft: str) -> bool:
    full, thumb = draft_paths(draft)
    found = False
    for p in (full, thumb):
        try:
            p.unlink()
            found = True
        except FileNotFoundError:
            pass
    return found


def _promote(draft: str, cid: str) -> str:
    """預覽搬成正式卡面，回檔名（c_xxxx-<內容雜湊>.webp）。預覽不在就回空字串。"""
    import hashlib

    full, thumb = draft_paths(draft)
    if not full.is_file():
        return ""
    data = full.read_bytes()
    name = f"{cid}-{hashlib.sha1(data).hexdigest()[:10]}.webp"
    ART_DIR.mkdir(parents=True, exist_ok=True)
    shutil.move(str(full), str(ART_DIR / name))
    if thumb.is_file():
        shutil.move(str(thumb), str(ART_DIR / name.replace(".webp", ".thumb.webp")))
    return name


def _remove_art(name: str) -> None:
    if not _ART_RE.match(name):
        return
    for p in (ART_DIR / name, ART_DIR / name.replace(".webp", ".thumb.webp")):
        try:
            p.unlink()
        except FileNotFoundError:
            pass


def art_path(name: str) -> Path | None:
    """正式卡面檔（給伺服器送檔用）。名字不對或檔不在回 None。"""
    if not _ART_RE.match(name):
        return None
    p = ART_DIR / name
    return p if p.is_file() else None


def prune(now: float | None = None) -> int:
    """清掉放超過一天的預覽，和沒有自製牌在用、超過一天的卡面檔（刪掉的牌復原期過了）。回清掉幾個檔。"""
    now = time.time() if now is None else now
    used = set()
    for c in load():
        art = (c.get("face") or {}).get("art")
        if art:
            used.add(art)
            used.add(art.replace(".webp", ".thumb.webp"))
    n = 0
    for folder, keep in ((DRAFT_DIR, set()), (ART_DIR, used)):
        if not folder.is_dir():
            continue
        for p in folder.iterdir():
            if p.name in keep or not p.is_file():
                continue
            try:
                if now - p.stat().st_mtime > DRAFT_TTL:
                    p.unlink()
                    n += 1
            except OSError:
                pass
    return n
