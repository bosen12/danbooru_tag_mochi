#!/usr/bin/env python3
"""Saved generation recipes. JSON is the source of truth; images live beside it."""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import time
import unicodedata
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("RECIPE_DATA_DIR") or ROOT / "data" / "recipes")
FILES_DIR = DATA_DIR / "files"
SETTINGS_PATH = Path(os.environ.get("APP_SETTINGS") or ROOT / "data" / "settings.json")
SCHEMA_VERSION = 1
MAX_RECIPE_BYTES = 256 * 1024
MAX_IMPORT_BYTES = 2 * 1024 * 1024
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_BATCH = 80
_ID_RE = re.compile(r"[^a-z0-9]+")
_STORE_LOCK = threading.RLock()

KNOWN_FIELDS = {
    "schemaVersion",
    "id",
    "name",
    "createdAt",
    "updatedAt",
    "image",
    "thumbnail",
    "positive",
    "positiveWeighted",
    "negative",
    "seed",
    "width",
    "height",
    "checkpoint",
    "loras",
    "workflowId",
    "mappingVersion",
    "sampler",
    "scheduler",
    "steps",
    "cfg",
    "rating",
    "heats",
    "era",
    "sceneMode",
    "counts",
    "mustDraw",
    "pinned",
    "userBanned",
    "presetOwned",
    "traceSummary",
}


class RecipeError(ValueError):
    def __init__(self, message: str, code: str = "invalid"):
        super().__init__(message)
        self.code = code


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        try:
            temp_path.unlink()
        except FileNotFoundError:
            pass


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _slug(text: str) -> str:
    folded = unicodedata.normalize("NFKD", str(text or ""))
    ascii_part = "".join(ch for ch in folded if ord(ch) < 128)
    ascii_part = _ID_RE.sub("-", ascii_part.lower()).strip("-")
    if ascii_part:
        return ascii_part[:48]
    digest = uuid.uuid4().hex[:12]
    return f"recipe-{digest}"


def _unique_id(name: str) -> str:
    base = _slug(name) or "recipe"
    cand = base
    n = 2
    while (DATA_DIR / f"{cand}.json").is_file():
        cand = f"{base}-{n}"
        n += 1
        if n > 999:
            cand = f"{base}-{uuid.uuid4().hex[:10]}"
            break
    return cand


def _safe_id(raw: str) -> str:
    text = str(raw or "").strip()
    if not text or text in {".", ".."} or "/" in text or "\\" in text:
        raise RecipeError("配方 ID 不合法。", "invalid_id")
    if any(part in {".", ".."} for part in text.split("-") if part == ".."):
        raise RecipeError("配方 ID 不合法。", "invalid_id")
    if ".." in text:
        raise RecipeError("配方 ID 不合法。", "invalid_id")
    return text


def _recipe_path(rid: str) -> Path:
    return DATA_DIR / f"{_safe_id(rid)}.json"


def _safe_file_name(name: str) -> str | None:
    text = str(name or "").strip()
    if not text or "/" in text or "\\" in text or text in {".", ".."} or ".." in text:
        return None
    if text.startswith("."):
        return None
    return text


def files_dir() -> Path:
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    return FILES_DIR.resolve()


def resolve_stored_file(name: str) -> Path | None:
    safe = _safe_file_name(name)
    if not safe:
        return None
    folder = files_dir()
    path = (folder / safe).resolve()
    try:
        path.relative_to(folder)
    except ValueError:
        return None
    return path if path.is_file() else None


def _clean_loras(raw) -> list:
    if not isinstance(raw, list):
        return []
    out = []
    for i, item in enumerate(raw[:2]):
        if not isinstance(item, dict):
            continue
        file = str(item.get("file") or item.get("name") or "").strip()
        if not file or ".." in file:
            continue
        folder = str(item.get("folder") or "").strip()
        if ".." in folder:
            continue
        try:
            strength = float(item.get("strength") if item.get("strength") is not None else 1)
        except (TypeError, ValueError):
            strength = 1.0
        trigger = str(item.get("trigger") or item.get("trainedWords") or "").strip()
        out.append(
            {
                "name": str(item.get("name") or Path(file).stem),
                "folder": folder,
                "file": file.replace("/", "\\"),
                "strength": max(0.0, min(2.0, strength)),
                "trigger": trigger,
                "order": i,
            }
        )
    return out


def _clean_preset_owned(raw):
    if isinstance(raw, dict):
        ident = str(raw.get("id") or "").strip()[:80]
        tags = _clean_str_list(raw.get("tags"))
        if not tags:
            return None
        return {"id": ident or "imported", "tags": tags}
    if isinstance(raw, list):
        tags = _clean_str_list(raw)
        if tags:
            return {"id": "imported", "tags": tags}
        return None
    return None


def _clean_str_list(raw, limit=200) -> list[str]:
    if not isinstance(raw, list):
        return []
    out = []
    seen = set()
    for item in raw[:limit]:
        text = str(item or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _clean_counts(raw) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key, val in raw.items():
        if not isinstance(key, str):
            continue
        try:
            n = int(val)
        except (TypeError, ValueError):
            continue
        out[key] = max(0, min(10, n))
    return out


def _clean_must(raw) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key, val in raw.items():
        if not isinstance(key, str) or ":" not in key:
            continue
        try:
            n = int(val)
        except (TypeError, ValueError):
            continue
        if n <= 0:
            continue
        out[key] = min(20, n)
    return out


def _clean_trace(raw) -> dict:
    if not isinstance(raw, dict):
        return {"schema": SCHEMA_VERSION, "kept": [], "rejected": []}
    def _events(items, n):
        out = []
        if not isinstance(items, list):
            return out
        for ev in items[:n]:
            if not isinstance(ev, dict) or not ev.get("tag"):
                continue
            row = {
                "tag": str(ev.get("tag")),
                "status": "rejected" if ev.get("status") == "rejected" else "kept",
                "source": str(ev.get("source") or "random"),
                "stage": str(ev.get("stage") or "commit"),
            }
            if ev.get("reason"):
                row["reason"] = str(ev.get("reason"))
            if ev.get("parent"):
                row["parent"] = str(ev.get("parent"))
            if isinstance(ev.get("related"), list):
                row["related"] = [str(x) for x in ev.get("related")[:8]]
            out.append(row)
        return out
    return {
        "schema": SCHEMA_VERSION,
        "kept": _events(raw.get("kept"), 80),
        "rejected": _events(raw.get("rejected"), 40),
    }


def _clean_image_ref(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    file = _safe_file_name(str(raw.get("file") or ""))
    if not file:
        return None
    return {"file": file, "copied": bool(raw.get("copied"))}


def migrate_recipe(raw) -> dict:
    if not isinstance(raw, dict):
        raise RecipeError("不是有效的配方 JSON。", "invalid")
    try:
        version = int(raw.get("schemaVersion") or 1)
    except (TypeError, ValueError) as exc:
        raise RecipeError("配方版本無法辨識。", "schema") from exc
    if version > SCHEMA_VERSION:
        raise RecipeError("配方版本太新，這個程式讀不了。", "schema")
    body = {k: raw.get(k) for k in KNOWN_FIELDS if k in raw}
    body["schemaVersion"] = SCHEMA_VERSION
    return body


def normalize_recipe(raw, *, rid: str | None = None, existing: dict | None = None) -> dict:
    src = migrate_recipe(raw)
    now = _now()
    ident = rid or str(src.get("id") or "").strip() or _unique_id(str(src.get("name") or "recipe"))
    ident = _safe_id(ident)
    name = str(src.get("name") or (existing or {}).get("name") or "未命名配方").strip() or "未命名配方"
    name = name[:80]
    try:
        seed = int(src.get("seed") if src.get("seed") is not None else (existing or {}).get("seed") or 0)
    except (TypeError, ValueError):
        seed = 0
    def num(key, lo, hi, default):
        try:
            n = int(src.get(key) if src.get(key) is not None else (existing or {}).get(key) or default)
        except (TypeError, ValueError):
            n = default
        return max(lo, min(hi, n))
    def flt(key, lo, hi, default):
        try:
            n = float(src.get(key) if src.get(key) is not None else (existing or {}).get(key) or default)
        except (TypeError, ValueError):
            n = default
        return max(lo, min(hi, n))
    heats = src.get("heats")
    if not isinstance(heats, list):
        heats = (existing or {}).get("heats") or []
    heats = [h for h in heats if h in ("activity", "tease", "flash", "sex")]
    rating = str(src.get("rating") or (existing or {}).get("rating") or "explicit")
    if rating not in ("general", "sensitive", "explicit"):
        rating = "explicit"
    scene = str(src.get("sceneMode") or (existing or {}).get("sceneMode") or "normal")
    if scene not in ("normal", "diverse", "weird"):
        scene = "normal"
    out = {
        "schemaVersion": SCHEMA_VERSION,
        "id": ident,
        "name": name,
        "createdAt": str(src.get("createdAt") or (existing or {}).get("createdAt") or now),
        "updatedAt": now if existing else str(src.get("updatedAt") or now),
        "image": _clean_image_ref(src.get("image") or (existing or {}).get("image")),
        "thumbnail": _clean_image_ref(src.get("thumbnail") or (existing or {}).get("thumbnail")),
        "positive": str(src.get("positive") or (existing or {}).get("positive") or ""),
        "positiveWeighted": str(src.get("positiveWeighted") or (existing or {}).get("positiveWeighted") or ""),
        "negative": str(src.get("negative") or (existing or {}).get("negative") or ""),
        "seed": seed,
        "width": num("width", 256, 2048, 1024),
        "height": num("height", 256, 2048, 1024),
        "checkpoint": str(src.get("checkpoint") or (existing or {}).get("checkpoint") or "").replace("/", "\\"),
        "loras": _clean_loras(src.get("loras") if src.get("loras") is not None else (existing or {}).get("loras")),
        "workflowId": str(src.get("workflowId") if src.get("workflowId") is not None else (existing or {}).get("workflowId") or ""),
        "mappingVersion": src.get("mappingVersion") if src.get("mappingVersion") is not None else (existing or {}).get("mappingVersion"),
        "sampler": str(src.get("sampler") or (existing or {}).get("sampler") or ""),
        "scheduler": str(src.get("scheduler") or (existing or {}).get("scheduler") or ""),
        "steps": num("steps", 1, 150, 25),
        "cfg": flt("cfg", 1.0, 30.0, 6.5),
        "rating": rating,
        "heats": heats,
        "era": str(src.get("era") or (existing or {}).get("era") or ""),
        "sceneMode": scene,
        "counts": _clean_counts(src.get("counts") if src.get("counts") is not None else (existing or {}).get("counts")),
        "mustDraw": _clean_must(src.get("mustDraw") if src.get("mustDraw") is not None else (existing or {}).get("mustDraw")),
        "pinned": _clean_str_list(src.get("pinned") if src.get("pinned") is not None else (existing or {}).get("pinned")),
        "userBanned": _clean_str_list(src.get("userBanned") if src.get("userBanned") is not None else (existing or {}).get("userBanned")),
        "presetOwned": _clean_preset_owned(
            src.get("presetOwned") if src.get("presetOwned") is not None else (existing or {}).get("presetOwned")
        ),
        "traceSummary": _clean_trace(src.get("traceSummary") if src.get("traceSummary") is not None else (existing or {}).get("traceSummary")),
    }
    if ".." in out["checkpoint"]:
        raise RecipeError("checkpoint 路徑不合法。", "path")
    return out


def list_recipes() -> list[dict]:
    with _STORE_LOCK:
        if not DATA_DIR.is_dir():
            return []
        out = []
        for path in sorted(DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                raw = _read_json(path)
                rec = normalize_recipe(raw, rid=path.stem, existing=raw if isinstance(raw, dict) else None)
            except (OSError, ValueError, RecipeError):
                continue
            out.append(_summary(rec))
        return out


def _summary(rec: dict) -> dict:
    return {
        "id": rec["id"],
        "name": rec["name"],
        "createdAt": rec["createdAt"],
        "updatedAt": rec["updatedAt"],
        "seed": rec["seed"],
        "checkpoint": rec["checkpoint"],
        "workflowId": rec["workflowId"],
        "era": rec["era"],
        "rating": rec["rating"],
        "loras": [x.get("file") or x.get("name") for x in rec.get("loras") or []],
        "image": rec.get("image"),
        "thumbnail": rec.get("thumbnail"),
        # 作品冊的大圖牆：先排好每格的長寬比（不必等圖載完才知道多高）、知道是哪幾張牌。
        "width": rec.get("width"),
        "height": rec.get("height"),
        "pinned": rec.get("pinned") if isinstance(rec.get("pinned"), list) else [],
        "positive": rec.get("positive") or "",
    }


def get_recipe(rid: str) -> dict | None:
    with _STORE_LOCK:
        path = _recipe_path(rid)
        if not path.is_file():
            return None
        try:
            raw = _read_json(path)
        except (OSError, ValueError):
            raise RecipeError("配方檔損壞。", "corrupt")
        return normalize_recipe(raw, rid=rid, existing=raw if isinstance(raw, dict) else None)


def save_recipe(payload: dict, *, rid: str | None = None) -> dict:
    blob = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
    if len(blob) > MAX_RECIPE_BYTES:
        raise RecipeError("配方 JSON 太大。", "too_large")
    with _STORE_LOCK:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        existing = None
        if rid:
            path = _recipe_path(rid)
            if path.is_file():
                try:
                    existing = _read_json(path)
                except (OSError, ValueError):
                    existing = None
            rec = normalize_recipe(payload, rid=rid, existing=existing)
        else:
            rec = normalize_recipe(payload)
            if (_recipe_path(rec["id"])).is_file():
                rec["id"] = _unique_id(rec["name"])
        rec["updatedAt"] = _now()
        if not rec.get("createdAt"):
            rec["createdAt"] = rec["updatedAt"]
        _write_json(_recipe_path(rec["id"]), rec)
        return rec


def delete_recipe(rid: str) -> dict | None:
    with _STORE_LOCK:
        rec = get_recipe(rid)
        if rec is None:
            return None
        path = _recipe_path(rid)
        try:
            path.unlink()
        except FileNotFoundError:
            return None
        for key in ("image", "thumbnail"):
            ref = rec.get(key) or {}
            stored = resolve_stored_file(str(ref.get("file") or ""))
            if stored:
                try:
                    stored.unlink()
                except OSError:
                    pass
        return rec


def save_image_bytes(rid: str, data: bytes, *, suffix: str = ".png") -> dict:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise RecipeError("圖片太大或是空的。", "too_large")
    ext = suffix if suffix in {".png", ".jpg", ".jpeg", ".webp"} else ".png"
    rec = get_recipe(rid)
    if rec is None:
        raise RecipeError("找不到這個配方。", "missing")
    name = f"{rec['id']}{ext}"
    dest = files_dir() / name
    fd, temp_name = tempfile.mkstemp(prefix=f".{name}.", suffix=".tmp", dir=files_dir())
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, dest)
    finally:
        try:
            temp_path.unlink()
        except FileNotFoundError:
            pass
    rec["image"] = {"file": name, "copied": True}
    rec["updatedAt"] = _now()
    _write_json(_recipe_path(rec["id"]), rec)
    return rec


def save_thumbnail(rid: str, data: bytes) -> dict:
    """作品冊牆上用的小檔（webp，ComfyUI 轉的）：原圖動輒 1～2 MB，一面牆幾十張太重。"""
    if not data or len(data) > MAX_IMAGE_BYTES or data[:4] != b"RIFF":
        raise RecipeError("縮圖不是 webp。", "bad_thumb")
    rec = get_recipe(rid)
    if rec is None:
        raise RecipeError("找不到這個配方。", "missing")
    name = f"{rec['id']}.thumb.webp"
    dest = files_dir() / name
    fd, temp_name = tempfile.mkstemp(prefix=f".{name}.", suffix=".tmp", dir=files_dir())
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.replace(temp_path, dest)
    finally:
        try:
            temp_path.unlink()
        except FileNotFoundError:
            pass
    rec["thumbnail"] = {"file": name, "copied": True}
    rec["updatedAt"] = _now()
    _write_json(_recipe_path(rec["id"]), rec)
    return rec


def export_payload(ids: list[str] | None = None) -> dict:
    items = []
    if ids:
        for rid in ids:
            rec = get_recipe(rid)
            if rec:
                items.append(rec)
    else:
        for row in list_recipes():
            rec = get_recipe(row["id"])
            if rec:
                items.append(rec)
    return {"schemaVersion": SCHEMA_VERSION, "recipes": items}


def import_payload(raw) -> list[dict]:
    if isinstance(raw, (bytes, bytearray)):
        if len(raw) > MAX_IMPORT_BYTES:
            raise RecipeError("匯入檔太大。", "too_large")
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RecipeError("不是有效的 JSON。", "invalid") from exc
    elif isinstance(raw, str):
        if len(raw) > MAX_IMPORT_BYTES:
            raise RecipeError("匯入檔太大。", "too_large")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RecipeError("不是有效的 JSON。", "invalid") from exc
    elif isinstance(raw, dict):
        data = raw
    elif isinstance(raw, list):
        data = raw
    else:
        raise RecipeError("不是有效的 JSON。", "invalid")
    recipes = []
    if isinstance(data, dict) and isinstance(data.get("recipes"), list):
        recipes = data.get("recipes")
    elif isinstance(data, dict) and data.get("positive"):
        recipes = [data]
    elif isinstance(data, list):
        recipes = data
    else:
        raise RecipeError("匯入檔沒有配方。", "invalid")
    if len(recipes) > MAX_BATCH:
        raise RecipeError("一次匯入太多份。", "too_large")
    saved = []
    for item in recipes:
        if not isinstance(item, dict):
            continue
        incoming = dict(item)
        incoming.pop("id", None)
        saved.append(save_recipe(incoming))
    return saved


def reproduce_payload(rec: dict) -> dict:
    """Fields required to regenerate from the saved recipe, never from live UI."""
    return {
        "positive": rec.get("positiveWeighted") or rec.get("positive") or "",
        "barePositive": rec.get("positive") or "",
        "negative": rec.get("negative") or "",
        "seed": rec.get("seed"),
        "width": rec.get("width"),
        "height": rec.get("height"),
        "ckpt": rec.get("checkpoint") or "",
        "loras": rec.get("loras") or [],
        "workflowId": rec.get("workflowId") if rec.get("workflowId") is not None else "",
        "rating": rec.get("rating") or "explicit",
        "sampler": rec.get("sampler") or "",
        "scheduler": rec.get("scheduler") or "",
        "steps": rec.get("steps"),
        "cfg": rec.get("cfg"),
        "era": rec.get("era") or "",
        "heats": rec.get("heats") or [],
        "sceneMode": rec.get("sceneMode") or "normal",
        "counts": rec.get("counts") or {},
        "mustDraw": rec.get("mustDraw") or {},
        "pinned": rec.get("pinned") or [],
        "userBanned": rec.get("userBanned") or [],
        "presetOwned": rec.get("presetOwned") or None,
    }
