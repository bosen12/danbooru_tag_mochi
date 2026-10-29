"""出圖日誌（web6／web7 作品冊的「日誌」；牌的戰績、模型成績單也從這裡算）。

JSON Lines（data/gen_log.jsonl），只往後加、不改舊行——壞了一行不會連累整份：
  {"t": "gen", ...}   每次付印做完記一行：印好的、印壞的都記（按停的不記），配方、耗時、哪一頁送的。
  {"t": "mark", ...}  之後的註記：從成品牆單張拿掉（"discard"），按復原就再補一行 null 蓋掉。
讀的時候把 mark 併回那一張，新的在前。

成品牆只留 80 張、沒收藏的過一陣子就找不到了；這份讓「印過什麼」一直查得到。圖不另存
（ComfyUI 的 output 裡本來就有），這裡只記網址。
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG_PATH = Path(os.environ.get("GEN_LOG_PATH") or ROOT / "data" / "gen_log.jsonl")

MAX_POSITIVE = 12000
MARKS = ("discard",)
PAGE_MAX = 2000
# 最多留幾張（最新的那幾張）。以前沒有上限：兩萬筆時檔案 16 MB，每印一張重算統計要 0.7 秒，一直變慢。
# 超過上限一成才整理一次（不是每寫一筆就重寫整份），最舊的直接丟掉、不另外封存。GEN_LOG_MAX 可以改。
MAX_ENTRIES = max(200, int(os.environ.get("GEN_LOG_MAX") or 5000))

_LOCK = threading.Lock()
# 整段是 (tag:1.2) 才是權重（跟 engine.js 的 parseWeighted 一樣）；字本身的括號（star (sky)）留著。
_WEIGHTED = re.compile(r"^\((.+):(\d+(?:\.\d+)?)\)$")
_cache: dict = {"key": None, "items": []}
# 檔案現在大概有幾行（第一次寫的時候數一次，之後每寫一行加一）：超過上限一成就整理。
_lines: dict = {"path": None, "n": -1}


def _path() -> Path:
    # 測試會換掉 LOG_PATH（模組屬性），每次用的時候才讀。
    return Path(LOG_PATH)


def _unescape(positive: str) -> str:
    """送進 Comfy 的提示詞把字裡的括號跳脫過（engine.js 的 escapeForComfy）；記下來的還原成牌的寫法。"""
    return str(positive or "").replace("\\(", "(").replace("\\)", ")")[:MAX_POSITIVE]


def _num(v, cast=float):
    try:
        x = cast(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None  # NaN


def _loras(raw) -> list[dict]:
    out = []
    for x in raw if isinstance(raw, list) else []:
        # 跟收藏（recipes.py）同一個形狀：從日誌補收藏時直接送過去。
        if isinstance(x, dict):
            file = str(x.get("file") or x.get("name") or "")[:300]
            if file:
                out.append({"folder": str(x.get("folder") or "")[:300], "file": file, "strength": _num(x.get("strength")) or 0})
        elif isinstance(x, str) and x:
            out.append({"folder": "", "file": x[:300], "strength": 1})
    return out[:12]


def entry_of(job_id: str, payload: dict, ok: bool, data: dict, *, origin: str, kind: str, created_at: float, started_at: float | None, finished_at: float) -> dict:
    """一張做完的工作 → 日誌的一行。payload 是 /api/gen 收到的那份，data 是最後那一則（done／error）。"""
    p = payload if isinstance(payload, dict) else {}
    d = data if isinstance(data, dict) else {}
    hires = p.get("hires") if isinstance(p.get("hires"), dict) else None
    e = {
        "t": "gen",
        "id": str(job_id),
        "at": int(finished_at * 1000),
        "ms": max(0, int((finished_at - created_at) * 1000)),
        # 真的在畫的時間（第一格進度到做完）；Comfy 前面排著別人的，ms 會比這個長很多。
        "drawMs": max(0, int((finished_at - started_at) * 1000)) if started_at else None,
        "origin": origin or "",
        "kind": kind,
        "ok": bool(ok),
        "positive": _unescape(p.get("positive")),
        "seed": _num(d.get("seed") if ok and d.get("seed") is not None else p.get("seed"), int),
        "width": _num(d.get("width") or p.get("width"), int),
        "height": _num(d.get("height") or p.get("height"), int),
        # 印好的那則帶著真的用了哪個底模（沒選＝設定檔的預設）。
        "ckpt": str((d.get("ckpt") if ok else None) or p.get("ckpt") or "")[:300],
        "loras": _loras(p.get("loras")),
        "workflowId": str(p.get("workflowId") or "")[:120],
        "rating": str(p.get("rating") or "")[:20],
        # 抽到的時代（"mixed"＝混合）：作品冊日誌的「照這張再印」把它帶回墨池。
        "era": str(p.get("era") or "")[:40],
        "steps": _num(p.get("steps"), int),
        "cfg": _num(p.get("cfg")),
    }
    if ok:
        e["image"] = str(d.get("image") or "")[:2000]
    else:
        e["error"] = str(d.get("error") or "")[:500]
    pose = p.get("pose") if isinstance(p.get("pose"), dict) else None
    if pose and pose.get("name"):
        e["pose"] = {"name": str(pose["name"])[:200], "strength": _num(pose.get("strength"))}
    if hires:
        e["hires"] = {"mode": str(hires.get("mode") or "")[:20], "scale": _num(hires.get("scale")), "from": str(hires.get("image") or "")[:2000]}
    return e


def _append(row: dict) -> None:
    path = _path()
    line = json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
    with _LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        # 上次寫到一半斷電、當機，檔尾會是沒換行的半行：新的一筆接在它後面會變成同一行壞資料，
        # 兩筆一起丟。先補一個換行，殘行自己當一行壞行（讀的時候跳過）。
        try:
            with path.open("rb") as tail:
                tail.seek(-1, os.SEEK_END)
                if tail.read(1) != b"\n":
                    line = "\n" + line
        except OSError:
            pass
        with path.open("a", encoding="utf-8") as f:
            f.write(line)
        if _lines["path"] != str(path) or _lines["n"] < 0:
            _lines["path"] = str(path)
            _lines["n"] = _count_lines(path)
        else:
            _lines["n"] += 1
        if _lines["n"] > MAX_ENTRIES + max(50, MAX_ENTRIES // 10):
            _lines["n"] = _trim(path)


def _count_lines(path: Path) -> int:
    try:
        with path.open("rb") as f:
            return sum(1 for _ in f)
    except OSError:
        return 0


def _trim(path: Path) -> int:
    """只留最新的 MAX_ENTRIES 張（照時間）和它們的註記，其他丟掉。先寫暫存檔再換上：寫到一半斷電，原本那份還在。
    換不上（Windows 上別人正開著讀）就這次先不整理，回原本的行數，下一次再試。呼叫的人拿著 _LOCK。"""
    gens: list[tuple] = []
    marks: dict[str, str] = {}
    total = 0
    try:
        with path.open(encoding="utf-8", errors="replace") as f:
            for raw in f:
                total += 1
                try:
                    row = json.loads(raw)
                except ValueError:
                    continue
                if not isinstance(row, dict) or not row.get("id"):
                    continue
                if row.get("t") == "gen":
                    gens.append((row.get("at") or 0, str(row["id"]), raw if raw.endswith("\n") else raw + "\n"))
                elif row.get("t") == "mark":
                    marks[str(row["id"])] = raw if raw.endswith("\n") else raw + "\n"
    except OSError:
        return total
    if len(gens) <= MAX_ENTRIES:
        return total
    gens.sort(key=lambda g: (g[0], g[1]))
    keep = gens[-MAX_ENTRIES:]
    ids = {g[1] for g in keep}
    lines = [g[2] for g in keep] + [m for jid, m in marks.items() if jid in ids]
    tmp = path.with_name(f"{path.name}.{os.getpid()}.trim")
    try:
        with tmp.open("w", encoding="utf-8", newline="") as f:
            f.writelines(lines)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except OSError:
        try:
            tmp.unlink()
        except OSError:
            pass
        return total
    return len(lines)


def record(entry: dict) -> None:
    """記一張。寫不進去（磁碟滿、權限）不能讓出圖跟著壞：吞掉。"""
    try:
        _append(entry)
    except OSError:
        pass


def mark(job_id: str, value: str | None) -> None:
    if value is not None and value not in MARKS:
        raise ValueError("不認得的註記")
    jid = str(job_id or "").strip()
    if not jid or len(jid) > 64:
        raise ValueError("缺工作編號")
    _append({"t": "mark", "id": jid, "mark": value, "at": int(time.time() * 1000)})


def _load() -> list[dict]:
    path = _path()
    try:
        st = path.stat()
    except OSError:
        return []
    key = (str(path), st.st_mtime_ns, st.st_size)
    with _LOCK:
        if _cache["key"] == key:
            return _cache["items"]
    items: dict[str, dict] = {}
    marks: dict[str, str | None] = {}
    try:
        with path.open(encoding="utf-8", errors="replace") as f:
            for line in f:
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(row, dict) or not row.get("id"):
                    continue
                if row.get("t") == "gen":
                    items[str(row["id"])] = row
                elif row.get("t") == "mark":
                    marks[str(row["id"])] = row.get("mark")
    except OSError:
        return []
    out = []
    for jid, row in items.items():
        m = marks.get(jid)
        out.append({**row, "mark": m} if m else row)
    # 時間一樣的照編號排：翻頁的游標是 (at, id)，排序要跟它一致。
    out.sort(key=lambda r: (r.get("at") or 0, str(r.get("id") or "")), reverse=True)
    with _LOCK:
        _cache["key"] = key
        _cache["items"] = out
    return out


def page(limit: int = 200, before: int | None = None, before_id: str | None = None) -> dict:
    """新的在前；before（毫秒）給了就從那之前接著翻。

    游標是上一頁最後一筆的 (at, id)：只用時間的話，好幾筆同一毫秒剛好跨在頁界上，
    第二頁問「比這個時間早的」就把同一毫秒的其他幾筆永遠跳過（Codex 2026-10-13）。
    舊網頁只帶 before：照舊只比時間。"""
    items = _load()
    limit = max(1, min(PAGE_MAX, int(limit or 200)))
    if before and before_id:
        cursor = (before, str(before_id))
        items = [r for r in items if ((r.get("at") or 0), str(r.get("id") or "")) < cursor]
    elif before:
        items = [r for r in items if (r.get("at") or 0) < before]
    return {"items": items[:limit], "more": len(items) > limit, "total": len(_load())}


def all_items() -> list[dict]:
    return _load()


# ---- 統計（卡冊的「牌的戰績」、作品冊的「模型」）-------------------------------------------


def tags_of(positive: str) -> list[str]:
    """提示詞拆回一個個字，跟 usage.js 的 tagsOfPositive 同一個規則：去掉權重括號、去重。"""
    out: list[str] = []
    seen = set()
    for raw in str(positive or "").split(","):
        t = raw.strip().replace("\\(", "(").replace("\\)", ")")
        m = _WEIGHTED.match(t)
        if m:
            t = m.group(1).strip()
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def fav_key(seed, tags) -> str:
    """作品冊那一筆跟日誌那一張是不是同一張：種子一樣、用到的牌一樣（作品冊沒記工作編號）。"""
    return f"{seed}|{','.join(sorted(tags))}"


def _recipe_image(rec) -> str:
    """作品冊那一筆的圖（data/recipes 裡複製的那份）。"""
    img = rec.get("image") if isinstance(rec, dict) else None
    f = img.get("file") if isinstance(img, dict) else None
    return "/api/recipes/files/" + urllib.parse.quote(str(f)) if f else ""


def _model_name(path: str) -> str:
    name = str(path or "").replace("\\", "/").rsplit("/", 1)[-1]
    return name[:-12] if name.lower().endswith(".safetensors") else name


def stats(known, favorites) -> dict:
    """known：詞庫裡的牌；favorites：作品冊的每一筆（要 seed、positive、id）。

    只算一般付印（Hires 是同一張圖再放大，不重複算）。印壞的不算進牌的戰績（不是牌的錯），
    但算進模型的「印壞」。
    """
    known = known or frozenset()
    favs = {}
    for r in favorites or []:
        cards = [t for t in tags_of(r.get("positive")) if t in known]
        favs[fav_key(r.get("seed"), cards)] = r
    cards: dict[str, list[int]] = {}
    models: dict[str, dict] = {}
    total = 0
    fav_n = 0
    drop_n = 0
    first = None
    # 成就用（卡冊的成就牆）：每天印好幾張（本機時間的日期）、幾點印的。
    days: dict[str, int] = {}
    hours = [0] * 24

    def model(kind: str, name: str) -> dict:
        key = f"{kind}:{name}"
        m = models.get(key)
        if m is None:
            m = models[key] = {"kind": kind, "name": name, "n": 0, "fav": 0, "discard": 0, "failed": 0, "drawMs": 0, "drawN": 0, "cards": {}, "best": None, "last": 0}
        return m

    for e in _load():
        if e.get("kind") == "hires":
            continue
        at = e.get("at") or 0
        first = at if first is None else min(first, at)
        tags = [t for t in tags_of(e.get("positive")) if t in known]
        ok = bool(e.get("ok"))
        fav_rec = favs.get(fav_key(e.get("seed"), tags)) if ok else None
        fav = fav_rec is not None
        drop = ok and e.get("mark") == "discard"
        ms = [model("ckpt", _model_name(e.get("ckpt")) or "預設")] + [model("lora", _model_name(l.get("file"))) for l in e.get("loras") or [] if l.get("file")]
        for m in ms:
            if not ok:
                m["failed"] += 1
                continue
            m["n"] += 1
            m["fav"] += fav
            m["discard"] += drop
            if e.get("drawMs"):
                m["drawMs"] += e["drawMs"]
                m["drawN"] += 1
            for t in tags:
                m["cards"][t] = m["cards"].get(t, 0) + 1
            # 代表作：收藏過的優先，再來是最新的一張。
            rank = (1 if fav else 0, at)
            if e.get("image") and (m["best"] is None or rank > m["best"][0]):
                # 收藏過的用作品冊那一份：ComfyUI 的 output 只留最近幾張，原本那張可能已經清掉了。
                image = _recipe_image(fav_rec) or e["image"]
                m["best"] = (rank, {"image": image, "width": e.get("width"), "height": e.get("height"), "id": e.get("id"), "rating": e.get("rating") or ""})
            m["last"] = max(m["last"], at)
        if not ok:
            continue
        total += 1
        fav_n += fav
        drop_n += drop
        lt = time.localtime(at / 1000)
        day = time.strftime("%Y-%m-%d", lt)
        days[day] = days.get(day, 0) + 1
        hours[lt.tm_hour] += 1
        for t in tags:
            c = cards.get(t)
            if c is None:
                c = cards[t] = [0, 0, 0]
            c[0] += 1
            c[1] += fav
            c[2] += drop
    out_models = []
    for m in models.values():
        top = sorted(m["cards"].items(), key=lambda kv: -kv[1])[:14]
        out_models.append({
            "kind": m["kind"],
            "name": m["name"],
            "n": m["n"],
            "fav": m["fav"],
            "discard": m["discard"],
            "failed": m["failed"],
            "drawMs": int(m["drawMs"] / m["drawN"]) if m["drawN"] else None,
            "cards": [t for t, _ in top],
            "best": m["best"][1] if m["best"] else None,
            "last": m["last"],
        })
    out_models.sort(key=lambda m: (-m["n"], m["name"]))
    return {
        "cards": cards,
        "models": out_models,
        "total": total,
        "fav": fav_n,
        "discard": drop_n,
        "since": first,
        "days": days,
        "hours": hours,
        "works": len(favorites or []),
    }


def by_tag(tag: str, favorites: dict, limit: int = 48, offset: int = 0, alive=None) -> dict:
    """卡冊「用它做過的圖」：日誌裡用到這張牌、印好的每一張（Hires 不重複算）。

    favorites：fav_key → 作品冊那一筆（{"id", "thumb"}）。收藏過的排前面，再來一般的，撤下過的最後；同一類新的在前。
    alive：image → 原圖還在不在（伺服器查得到 ComfyUI 的 output 時才給）。不在的不列、不算張數；
    收藏過的照列（作品冊自己存了一份）。以前全部列出來、卡冊讀圖 404 才一格格拿掉，面板一縮再縮、底下的按鈕跟著跳。
    """
    tag = str(tag or "").strip()
    if not tag:
        return {"items": [], "total": 0}
    rows = []
    for e in _load():
        if e.get("kind") == "hires" or not e.get("ok") or not e.get("image"):
            continue
        tags = tags_of(e.get("positive"))
        if tag not in tags:
            continue
        rows.append((e, tags))
    out = []
    for e, tags in rows:
        known = favorites.get("_known", ())
        fav = favorites.get(fav_key(e.get("seed"), [t for t in tags if t in known]))
        if alive is not None and not fav and not alive(e.get("image")):
            continue
        out.append({
            "id": e.get("id"),
            "at": e.get("at") or 0,
            "image": e.get("image"),
            "width": e.get("width"),
            "height": e.get("height"),
            "seed": e.get("seed"),
            "origin": e.get("origin") or "",
            "positive": e.get("positive") or "",
            "mark": e.get("mark"),
            "fav": fav["id"] if fav else None,
            "albumThumb": fav.get("thumb") if fav else None,
        })
    rank = lambda r: (0 if r["fav"] else 2 if r["mark"] == "discard" else 1, -r["at"])  # noqa: E731
    out.sort(key=rank)
    limit = max(1, min(200, int(limit or 48)))
    offset = max(0, int(offset or 0))
    return {"items": out[offset:offset + limit], "total": len(out)}
