"""卡片群組（web6 墨池、卡冊）：長相、服裝、姿勢、場景各自可以有好幾組牌，抽牌時選要從哪幾組抽。

跟牌組（card_decks.py）不一樣：牌組是「這幾張全部帶上」，群組是「這一段從這裡面挑」——
群組只管它有放牌的那些格子，沒放的照常從整個詞庫補（見 docs/superpowers/specs/2026-11-16-card-groups-design.md）。

只存名字、哪一段、哪些牌；哪一段勾了哪幾組、用哪種抽法是抽牌設定（墨池的 settings），不在這裡。
所有裝置（手機、電腦）共用這一份。只收詞庫裡、而且屬於那一段的牌（自製牌是好幾張牌加詞庫外的字，
不是單一段落的一張牌，第一版不收）。

寫入的規矩（手機、電腦同時開著）：
- 改一組一定要帶它的 updatedAt（沒帶、或伺服器上的比較新＝別台改過，都回 409），網頁拿回最新的那份，不會把別台的改動蓋掉。
- 帶著 id、伺服器上卻沒有：預設當成「別台刪掉了」回 409，不會被舊畫面的存檔救活；
  只有「刪除後復原」帶 restore: true 才照原本的 id 放回去。
"""

from __future__ import annotations

import json
import os
import re
import shutil
import threading
import time
import uuid
from pathlib import Path

import card_usage
import file_lock

ROOT = Path(__file__).resolve().parent
GROUPS_PATH = Path(os.environ.get("CARD_GROUPS_PATH") or ROOT / "data" / "card_groups.json")

SECTIONS = ("feature", "clothing", "pose", "env")
MAX_GROUPS = 200
MAX_TAGS = 120
MAX_NAME = 40
_ID_RE = re.compile(r"^[a-z0-9-]{4,40}$")

_LOCK = threading.Lock()
_sections_cache: dict = {"mtime": None, "map": {}}


class GroupError(ValueError):
    def __init__(self, message: str, bad: list[str] | None = None):
        super().__init__(message)
        self.bad = bad or []


class GroupConflict(GroupError):
    """別台改過（stale）或刪掉了（gone）：回 409，附上伺服器上現在那一組（刪掉了是 None）。"""

    def __init__(self, message: str, code: str, current: dict | None):
        super().__init__(message)
        self.code = code
        self.current = current


def _int(v) -> int:
    try:
        return max(0, int(v))
    except (TypeError, ValueError):
        return 0


def _tag_sections() -> dict:
    """詞庫裡每張牌屬於哪一段（lexicon.json 改了就重讀）。讀不到回空的：那就不檢查段落。"""
    path = card_usage.LEXICON_PATH
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return _sections_cache["map"]
    if _sections_cache["mtime"] != mtime:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            _sections_cache["map"] = {str(t["tag"]): str(t.get("section") or "") for t in data.get("tags") or [] if isinstance(t, dict) and t.get("tag")}
            _sections_cache["mtime"] = mtime
        except (OSError, ValueError, KeyError):
            pass
    return _sections_cache["map"]


def _rename_all(raw) -> list[str]:
    # 詞庫換過名的字：舊名換成新名；重複的只留一個。
    return list(dict.fromkeys(card_usage.rename(t.strip()) for t in raw or [] if isinstance(t, str) and t.strip()))


def _shape_ok(data) -> bool:
    return isinstance(data, dict) and isinstance(data.get("groups"), list)


def _recover_shape():
    """JSON 讀得懂、樣子卻不對（例如 [] 或 {"groups": {}}）：跟讀不懂的檔一樣處理 ——
    壞的那份改名留著，試 .bak；備份也不行就丟 StoreCorrupt（這一次存不了，下一次從空的開始）。"""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    aside = GROUPS_PATH.with_name(f"{GROUPS_PATH.name}.corrupt-{stamp}")
    try:
        shutil.copyfile(GROUPS_PATH, aside)
    except OSError:
        pass
    bak = file_lock.backup_path(GROUPS_PATH)
    try:
        data = json.loads(bak.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError):
        data = None
    if _shape_ok(data):
        shutil.copyfile(bak, GROUPS_PATH)
        print(f"[存檔] {GROUPS_PATH.name} 樣子不對，已用 {bak.name} 換回（壞的留在 {aside.name}）", flush=True)
        return data
    try:
        GROUPS_PATH.unlink()
    except OSError:
        pass
    raise file_lock.StoreCorrupt(
        f"伺服器上的卡片群組存檔（{GROUPS_PATH.name}）樣子不對，也沒有能用的備份。"
        f"那份改名成 {aside.name} 留著；之後存的會從空的開始。"
    )


def _read() -> list[dict]:
    # 讀不懂的檔（含合法 JSON 但樣子不對）不能當成空的：下一次存會用空的那份把整份蓋掉。
    # file_lock 先試 .bak，再不行丟 StoreCorrupt（伺服器回 503）。檔案不存在才是第一次用。
    try:
        data = file_lock.read_json(GROUPS_PATH, label="卡片群組")
    except OSError as exc:
        raise file_lock.StoreCorrupt(f"伺服器讀不到卡片群組的存檔（{GROUPS_PATH.name}）：{exc}") from None
    if data is None:
        return []
    if not _shape_ok(data):
        data = _recover_shape()
    out = []
    sections = _tag_sections()
    for g in data["groups"]:
        if not isinstance(g, dict) or not _ID_RE.match(str(g.get("id") or "")) or g.get("section") not in SECTIONS:
            print(f"[卡片群組] 略過一筆讀不懂的群組：{str(g)[:120]}", flush=True)
            continue
        out.append({
            "id": g["id"],
            "name": str(g.get("name") or "")[:MAX_NAME] or "未命名",
            "section": g["section"],
            "tags": [t for t in _rename_all(g.get("tags") if isinstance(g.get("tags"), list) else []) if not sections or t in sections][:MAX_TAGS],
            "createdAt": _int(g.get("createdAt")),
            "updatedAt": _int(g.get("updatedAt")),
        })
    return out


def _write(groups: list[dict]) -> None:
    file_lock.write_text(GROUPS_PATH, json.dumps({"v": 1, "groups": groups}, ensure_ascii=False, separators=(",", ":")))


def _sorted(groups: list[dict]) -> list[dict]:
    # 照建立的順序（A、B、C 是使用者自己排的順序，不要因為改過一組就跳到最前面）。
    order = sorted(enumerate(groups), key=lambda p: (p[1]["createdAt"], p[0]))
    return [g for _, g in order]


def load() -> list[dict]:
    with _LOCK, file_lock.locked(GROUPS_PATH):
        return _sorted(_read())


def _clean_tags(raw, section: str) -> tuple[list[str], list[str]]:
    """詞庫外的牌略過並回報；別段的牌仍整筆拒絕。"""
    if not isinstance(raw, list):
        raise GroupError("tags 要是陣列")
    tags = _rename_all(raw)
    sections = _tag_sections()
    unknown = []
    if sections:
        unknown = [t for t in tags if t not in sections]
        tags = [t for t in tags if t in sections]
        wrong = [t for t in tags if sections[t] != section]
        if wrong:
            raise GroupError("這些牌不屬於這個類別", wrong[:20])
    if len(tags) > MAX_TAGS:
        raise GroupError(f"一個群組最多 {MAX_TAGS} 張牌")
    return tags, unknown


def save(payload: dict) -> dict:
    """新增或改一組：{"id"?, "name", "section", "tags", "updatedAt"?, "restore"?}。
    - 沒有 id：新增。
    - 有 id、伺服器上有：改名、換牌。帶了 updatedAt 而伺服器上的比較新 → 409 stale。類別不能改。
    - 有 id、伺服器上沒有：restore=true（刪除後復原）才照原 id 放回去，否則 409 gone。
    群組可以是空的（剛建立、還沒挑牌）；空的群組抽牌時等於沒勾。"""
    if not isinstance(payload, dict):
        raise GroupError("要是物件")
    name = " ".join(str(payload.get("name") or "").split())[:MAX_NAME]
    if not name:
        raise GroupError("群組要有名字")
    section = payload.get("section")
    if section not in SECTIONS:
        raise GroupError("不認得的類別")
    tags, dropped = _clean_tags(payload.get("tags"), section)
    rid = str(payload.get("id") or "")
    if rid and not _ID_RE.match(rid):
        raise GroupError("群組 id 不對")
    now = int(time.time() * 1000)
    with _LOCK, file_lock.locked(GROUPS_PATH):
        groups = _read()
        hit = next((g for g in groups if g["id"] == rid), None) if rid else None
        if hit:
            # 類別不能改：勾選存在 settings 裡是照類別放的，換類別會讓另一段的勾選指到它。
            if hit["section"] != section:
                raise GroupError("群組的類別不能改")
            seen = payload.get("updatedAt")
            # 改一組一定要帶「我看到的是哪一版」：沒帶就分不出是不是舊畫面，寧可退回也不要蓋掉別台。
            if seen is None:
                raise GroupConflict("改群組要先讀到最新的那份，請再試一次", "stale", dict(hit))
            if _int(seen) < hit["updatedAt"]:
                raise GroupConflict("這個群組剛在別的地方改過，已經換成最新的那份", "stale", dict(hit))
            hit.update(name=name, tags=tags, updatedAt=max(now, hit["updatedAt"] + 1))
            group = hit
        else:
            if rid and not payload.get("restore"):
                raise GroupConflict("這個群組已經在別的地方刪掉了", "gone", None)
            if len(groups) >= MAX_GROUPS:
                raise GroupError(f"群組最多 {MAX_GROUPS} 組，先刪掉一些")
            group = {
                "id": rid or "g-" + uuid.uuid4().hex[:12],
                "name": name,
                "section": section,
                "tags": tags,
                # 復原的照原本的建立時間排回原位；新建的由伺服器給。
                "createdAt": (_int(payload.get("createdAt")) if rid else 0) or now,
                "updatedAt": now,
            }
            groups.append(group)
        _write(groups)
        return {"group": dict(group), "groups": _sorted(groups), "dropped": dropped}


def delete(rid: str) -> dict:
    with _LOCK, file_lock.locked(GROUPS_PATH):
        groups = _read()
        gone = next((g for g in groups if g["id"] == rid), None)
        if gone is None:
            raise GroupError("找不到這個群組")
        groups = [g for g in groups if g["id"] != rid]
        _write(groups)
        return {"group": gone, "groups": _sorted(groups)}


# ---------- 勾選：每一段要從哪幾組抽（墨池規則的 settings.groups） ----------
# 2026-11-18 以前存在每台瀏覽器的設定裡（手機勾了、電腦看不到）。改成所有裝置共用一份：
# 最後存的那份算（勾選是一整組設定，不是名單，不必合併兩邊）。
PICKS_PATH = Path(os.environ.get("CARD_GROUP_PICKS_PATH") or ROOT / "data" / "group_picks.json")
PICK_SECTIONS = ("feature", "clothing", "pose", "env")
MAX_PICK_IDS = 50  # 跟 engine.js 的 sanitizeGroupPick 一樣


def _clean_picks(raw) -> dict:
    out = {}
    if not isinstance(raw, dict):
        return out
    for section in PICK_SECTIONS:
        v = raw.get(section)
        if not isinstance(v, dict):
            continue
        ids = []
        for gid in v.get("ids") if isinstance(v.get("ids"), list) else []:
            if isinstance(gid, str) and _ID_RE.match(gid) and gid not in ids:
                ids.append(gid)
        if not ids:
            continue
        out[section] = {"ids": ids[:MAX_PICK_IDS], "mode": "mix" if v.get("mode") == "mix" else "whole"}
    return out


def load_picks() -> dict:
    """{"picks": {...}, "saved": 存過沒有, "at": 毫秒}。沒存過：網頁把它自己的勾選搬上來。"""
    with file_lock.locked(PICKS_PATH):
        data = file_lock.read_json(PICKS_PATH, label="群組勾選")
        if data is None:
            try:
                PICKS_PATH.stat()
            except FileNotFoundError:
                return {"picks": {}, "saved": False, "at": 0}
    if not (isinstance(data, dict) and isinstance(data.get("picks"), dict)):
        raise file_lock.StoreCorrupt("伺服器上的群組勾選存檔格式不對。")
    return {"picks": _clean_picks(data["picks"]), "saved": True, "at": int(data.get("at") or 0)}


def save_picks(payload) -> dict:
    if not isinstance(payload, dict) or not isinstance(payload.get("picks"), dict):
        raise GroupError("picks 要是物件")
    picks = _clean_picks(payload["picks"])
    now = int(time.time() * 1000)
    with file_lock.locked(PICKS_PATH):
        file_lock.write_text(PICKS_PATH, json.dumps({"v": 1, "at": now, "picks": picks}, ensure_ascii=False, separators=(",", ":")))
    return {"picks": picks, "saved": True, "at": now}
