"""Discord 分頻道送圖：一張圖照分級、角色、tag 該送去哪幾個頻道（server.py 的 dc_enqueue 用）。

只有純函式：拆提示詞、比對、檢查設定。存檔、送出、佇列都在 server.py。

一個頻道（route）長這樣（存在 .secrets/discord.json 的 routes）：
    {"id", "name", "webhook", "ratings": [...], "chars": [...], "series": [...], "charMode": "any"|"all",
     "tags": [...], "tagMode": "any"|"all", "compact": bool, "enabled": bool, "paused": bool}
三種條件之間是「都要符合」，沒設的那種不看；每個頻道至少要設一種（都不設＝收全部，那是「其他」的事）。
角色條件可以是單一角色（chars），也可以是整個系列（series：詞庫角色牌的 series，例如 "spy x family"）；
兩種合起來最多 MAX_CHARS 個。系列算「這張圖裡有這個系列的任何一位角色」（或提示詞裡直接有系列名）。
"""
from __future__ import annotations

import re
import secrets

RATINGS = ("general", "sensitive", "explicit")
MODES = ("any", "all")
MAX_ROUTES = 20
MAX_CHARS = 3
MAX_TAGS = 5
NAME_MAX = 40
# 連續送不出去幾次就自動暫停（網址被刪、打錯時不要一直佔住排隊）。
PAUSE_AFTER = 5
OTHER = "other"

_WEIGHT = re.compile(r"^\((.+):(\d+(?:\.\d+)?)\)$")


def norm_tag(text: str) -> str:
    """跟詞庫同一種寫法：小寫、底線換空白、連續空白收成一個。"""
    t = str(text or "").strip().lower().replace("_", " ")
    return re.sub(r"\s+", " ", t)


def tags_of(en: str) -> "set[str]":
    """英文提示詞 → 這張圖的 tag 集合。去掉 (tag:1.2) 權重、Comfy 的跳脫括號；LoRA 那段不算。"""
    out: "set[str]" = set()
    for part in str(en or "").split(","):
        t = part.strip()
        if not t or t.startswith("<"):
            continue
        m = _WEIGHT.match(t)
        if m:
            t = m.group(1).strip()
        t = t.replace("\\(", "(").replace("\\)", ")")
        t = norm_tag(t)
        if t:
            out.add(t)
    return out


def _hits(want: "list[str]", mode: str, have: "set[str]") -> bool:
    if not want:
        return True
    if mode == "all":
        return all(t in have for t in want)
    return any(t in have for t in want)


def series_in(tags: "set[str]", series_of: "dict[str, str] | None") -> "set[str]":
    """這張圖裡出現的系列：每個角色 tag 照 series_of（角色 → 系列）換過去，加上直接寫在提示詞裡的系列名。"""
    out = set(tags)
    for t in tags:
        s = (series_of or {}).get(t)
        if s:
            out.add(s)
    return out


def _cast_hits(route: dict, tags: "set[str]", series: "set[str]") -> bool:
    """角色條件：每一項是角色（看 tags）或系列（看 series）；任一個／全部都要照 charMode。"""
    items = [(t, tags) for t in route.get("chars") or []] + [(s, series) for s in route.get("series") or []]
    if not items:
        return True
    if (route.get("charMode") or "any") == "all":
        return all(x in pool for x, pool in items)
    return any(x in pool for x, pool in items)


def route_matches(route: dict, tags: "set[str]", rating: str, series: "set[str] | None" = None) -> bool:
    """這張圖（tags、rating、出現的系列）送不送這個頻道。停用、暫停的一律不送。"""
    if not route.get("enabled", True) or route.get("paused"):
        return False
    ratings = route.get("ratings") or []
    if ratings and (rating or "general") not in ratings:
        return False
    if not _cast_hits(route, tags, series if series is not None else tags):
        return False
    return _hits(route.get("tags") or [], route.get("tagMode") or "any", tags)


def targets_for(routes: "list[dict]", en: str, rating: str, other_ok: bool, series_of: "dict[str, str] | None" = None) -> "list[str]":
    """要送的目標：符合的頻道 id（照清單順序），一個都沒有而且「其他」設好了就是 ["other"]。"""
    tags = tags_of(en)
    series = series_in(tags, series_of)
    hit = [r["id"] for r in routes if route_matches(r, tags, rating, series)]
    if hit:
        return hit
    return [OTHER] if other_ok else []


def _tag_list(raw, limit: int, label: str) -> "list[str]":
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError(f"{label}要是清單")
    out: "list[str]" = []
    for x in raw:
        t = norm_tag(x)
        if t and t not in out:
            out.append(t)
    if len(out) > limit:
        raise ValueError(f"{label}最多 {limit} 個")
    return out


def clean_route(raw: dict, old: "dict | None", webhook_ok) -> dict:
    """面板送上來的一個頻道 → 可以存的樣子；不合格就丟 ValueError（訊息直接給使用者看）。

    old：編輯時那個頻道原本的樣子（webhook 留空＝沿用 old 的）。webhook_ok：server.dc_webhook_ok。
    """
    if not isinstance(raw, dict):
        raise ValueError("頻道設定看不懂")
    name = str(raw.get("name") or "").strip()
    if not name:
        raise ValueError("頻道要取個名字")
    if len(name) > NAME_MAX:
        raise ValueError(f"名字最多 {NAME_MAX} 個字")
    try:
        hook = webhook_ok(raw.get("webhook"))
    except Exception as exc:
        raise ValueError(str(exc)) from None
    if not hook:
        hook = (old or {}).get("webhook") or ""
    if not hook:
        raise ValueError("要貼上這個頻道的 webhook 網址")
    ratings_raw = raw.get("ratings") or []
    if not isinstance(ratings_raw, list):
        raise ValueError("分級要是清單")
    ratings = [r for r in RATINGS if r in ratings_raw]
    if len(ratings) != len(set(ratings_raw)):
        raise ValueError("分級只能是全年齡、敏感、色情")
    chars = _tag_list(raw.get("chars"), MAX_CHARS, "角色")
    series = _tag_list(raw.get("series"), MAX_CHARS, "系列")
    if len(chars) + len(series) > MAX_CHARS:
        raise ValueError(f"角色和系列合起來最多 {MAX_CHARS} 個")
    tags = _tag_list(raw.get("tags"), MAX_TAGS, "tag")
    if not (ratings or chars or series or tags):
        raise ValueError("至少設一種條件（分級、角色或 tag）")
    char_mode = raw.get("charMode") if raw.get("charMode") in MODES else "any"
    tag_mode = raw.get("tagMode") if raw.get("tagMode") in MODES else "any"
    out = {
        "id": (old or {}).get("id") or "r_" + secrets.token_hex(4),
        "name": name,
        "webhook": hook,
        "ratings": ratings,
        "chars": chars,
        "series": series,
        "charMode": char_mode,
        "tags": tags,
        "tagMode": tag_mode,
        "compact": bool(raw.get("compact")),
        "enabled": bool(raw.get("enabled", True)),
        # 改了網址或按存檔：當作重新開始，暫停解除。
        "paused": False,
    }
    return out


def load_routes(raw) -> "list[dict]":
    """設定檔裡的 routes → 清單。壞掉的那幾個略過（不讓一筆壞資料拖垮整個送圖）。"""
    if not isinstance(raw, list):
        return []
    out: "list[dict]" = []
    seen: "set[str]" = set()
    for r in raw[:MAX_ROUTES]:
        if not isinstance(r, dict):
            continue
        rid = str(r.get("id") or "")
        hook = str(r.get("webhook") or "")
        if not rid or rid in seen or not hook:
            continue
        seen.add(rid)
        out.append({
            "id": rid,
            "name": str(r.get("name") or "")[:NAME_MAX] or rid,
            "webhook": hook,
            "ratings": [x for x in RATINGS if x in (r.get("ratings") or [])],
            "chars": [norm_tag(x) for x in (r.get("chars") or [])][:MAX_CHARS],
            "series": [norm_tag(x) for x in (r.get("series") or [])][:MAX_CHARS],
            "charMode": r.get("charMode") if r.get("charMode") in MODES else "any",
            "tags": [norm_tag(x) for x in (r.get("tags") or [])][:MAX_TAGS],
            "tagMode": r.get("tagMode") if r.get("tagMode") in MODES else "any",
            "compact": bool(r.get("compact")),
            "enabled": bool(r.get("enabled", True)),
            "paused": bool(r.get("paused")),
        })
    return out
