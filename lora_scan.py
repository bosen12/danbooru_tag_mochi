#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LoRA 清單掃描。跟 flux2klein/lora_scan.py 同一套規則（四分類／副檔名／<lora:…> 剝除／SWR）。"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent / "scripts"))
from app_config import cfg  # noqa: E402
import workflows  # noqa: E402

# LoRA 收藏根目錄。原本寫死成某台機器的 E:\Comfyui\loras。
# 沒設定就是 None，不要退回 Path("")：那會變成專案根目錄，然後我們會安靜地
# 在自己的原始碼資料夾裡找 style/Character/… 並回報「資料夾不存在」，
# 使用者看不出真正的原因是根本沒設定。
_lora_root = cfg("paths.loraRoot", "LORA_ROOT", "")
LORA_ROOT = Path(str(_lora_root)) if _lora_root else None
# 留空＝掃 loraRoot 底下的每一個子資料夾（外加直接放在根目錄的鬆散檔案）。
# 原本的預設值 style/Character/HENTAI/illus 是某一台機器的個人分類習慣，
# 別人 clone 下來資料夾名字不一樣，就會拿到一個空面板卻找不出原因。
LORA_FOLDERS = list(cfg("paths.loraFolders", "", []) or [])
ROOT_CATEGORY = "（根目錄）"


def discover_categories() -> list:
    """實際要掃哪些分類。有設定就照設定，沒有就看資料夾長什麼樣。"""
    if LORA_FOLDERS:
        return list(LORA_FOLDERS)
    if LORA_ROOT is None or not LORA_ROOT.is_dir():
        return []
    try:
        subs = sorted(d.name for d in LORA_ROOT.iterdir() if d.is_dir())
    except OSError:
        return []
    loose = False
    try:
        loose = any(f.suffix == ".safetensors" for f in LORA_ROOT.iterdir() if f.is_file())
    except OSError:
        pass
    return ([ROOT_CATEGORY] if loose else []) + subs
LORA_PREVIEW_EXTS = (
    ".preview.png", ".preview.jpeg", ".preview.jpg", ".preview.webp",
    ".preview.mp4", ".preview.webm",
    ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm",
)
LORA_VIDEO_EXTS = (".mp4", ".webm")
TTL = 300.0

_ANGLE_TAG_RE = re.compile(r"<[^<>]*>")
_cache = {"data": None, "at": 0.0, "refreshing": False}
_lock = threading.Lock()


def reset_cache() -> None:
    with _lock:
        _cache["data"] = None
        _cache["at"] = 0.0
        _cache["refreshing"] = False


def is_video_preview(name: str) -> bool:
    n = (name or "").lower()
    return n.endswith(".mp4") or n.endswith(".webm")


def strip_angle_tags(word: str) -> str:
    cleaned = _ANGLE_TAG_RE.sub("", word or "")
    parts = [p.strip() for p in cleaned.split(",")]
    parts = [p for p in parts if p]
    return ", ".join(parts)


def preview_path(folder: str, fn: str) -> Path | None:
    if not fn or "/" in fn or "\\" in fn or fn in (".", ".."):
        return None
    parts = (folder or "").split("/")
    allowed = discover_categories()
    # folder 為空字串代表根目錄的鬆散檔案，那是合法的。
    if (any(part in (".", "..") for part in parts) or "\\" in folder
            or (folder and parts[0] not in allowed and parts[0] != "")):
        return None
    if LORA_ROOT is None:
        return None
    p = LORA_ROOT / folder / fn
    try:
        p.resolve().relative_to(LORA_ROOT.resolve())
    except ValueError:
        return None
    return p if p.is_file() else None


def comfy_base() -> str:
    """ComfyUI 位址：環境變數 > 畫面上存的 > config.json > 預設。"""
    env = os.environ.get("COMFY_API", "").strip()
    saved = workflows.saved_comfy_api()
    return (env or saved or str(cfg("comfy.api", "", workflows.DEFAULT_COMFY_API))).rstrip("/")


# ---------- ComfyUI 的 LoRA Manager（custom node：willmiao/ComfyUI-Lora-Manager） ----------
# 它住在 ComfyUI 裡，自己掃 ComfyUI 的每一個 loras 資料夾（含 extra_model_paths），
# 每個 LoRA 的名稱、預覽圖、Civitai 觸發詞、底模都整理好了。裝了就用它：不必填 loraRoot，
# 遠端的 ComfyUI 也拿得到預覽圖（圖由本伺服器轉送，見 server.py 的 /api/lora-preview?lm=）。
LM_PAGE_SIZE = 100  # LoRA Manager 一頁最多給 100 筆
LM_PREVIEW_PREFIX = "/api/lm/previews?"


def _get_json(url: str, timeout: float = 10):
    import urllib.request

    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def lora_manager_list(kind: str = "loras", base: str | None = None) -> list | None:
    """LoRA Manager 的整份清單（kind：loras／checkpoints）。沒裝、ComfyUI 沒開或中途失敗都回 None。"""
    base = (base or comfy_base()).rstrip("/")
    items, page, pages = [], 1, 1
    while page <= pages and page <= 500:
        try:
            data = _get_json(f"{base}/api/lm/{kind}/list?page={page}&page_size={LM_PAGE_SIZE}")
        except Exception:
            return None
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            return None
        items.extend(it for it in data["items"] if isinstance(it, dict))
        try:
            pages = int(data.get("total_pages") or 1)
        except (TypeError, ValueError):
            pages = 1
        page += 1
    return items


def lm_preview_src(preview_url: str) -> str:
    """LoRA Manager 的預覽圖網址 → 本伺服器轉送的網址（瀏覽器不必直接連得到 ComfyUI）。"""
    url = str(preview_url or "")
    if not url.startswith(LM_PREVIEW_PREFIX):
        return ""
    from urllib.parse import quote

    return "/api/lora-preview?lm=" + quote(url, safe="")


def lm_preview_name(preview_url: str) -> str | None:
    """預覽圖的檔名（xxx.preview.mp4）：前端靠副檔名決定放 <img> 還是 <video>。"""
    from urllib.parse import unquote

    url = unquote(str(preview_url or ""))
    return url.replace("\\", "/").rsplit("/", 1)[-1] or None if url else None


def lora_manager_count(base: str | None = None, timeout: float = 3) -> int | None:
    """ComfyUI 有 LoRA Manager 就回它管的 LoRA 數；沒裝或連不上回 None。開機訊息用，不等太久。"""
    base = (base or comfy_base()).rstrip("/")
    try:
        data = _get_json(f"{base}/api/lm/loras/list?page=1&page_size=1", timeout=timeout)
        return int(data.get("total") or 0) if isinstance(data, dict) and "items" in data else None
    except Exception:
        return None


def lm_manager_url(base: str | None = None) -> str:
    return (base or comfy_base()).rstrip("/") + "/loras"


def from_lora_manager(raw: list) -> dict:
    """LoRA Manager 的 items → 本專案 /api/loras 的格式（同 build_lora_list）。

    lora_name 是「folder/檔名」：LoRA Manager 的 folder 就是相對於那個 loras 根目錄的路徑，
    跟 ComfyUI LoraLoader 清單裡的名字一樣。被它標成 exclude 的不列。"""
    allowed = set(LORA_FOLDERS)
    items, counts = [], {}
    for it in raw:
        if it.get("exclude"):
            continue
        fn = str(it.get("file_path") or "").replace("\\", "/").rsplit("/", 1)[-1]
        if not fn:
            continue
        folder = str(it.get("folder") or "").replace("\\", "/").strip("/")
        category = folder.split("/")[0] if folder else ROOT_CATEGORY
        if allowed and category not in allowed:
            continue
        stem = fn.rsplit(".", 1)[0]
        civ = it.get("civitai") if isinstance(it.get("civitai"), dict) else {}
        words = [w for w in (strip_angle_tags(x) for x in (civ.get("trainedWords") or []) if isinstance(x, str)) if w]
        preview_url = str(it.get("preview_url") or "")
        entry = {
            "folder": folder,
            "category": category,
            "file": fn,
            "name": stem,
            "title": str(it.get("model_name") or stem),
            "trainedWords": words,
            "preview": lm_preview_name(preview_url),
            "previewUrl": lm_preview_src(preview_url) or None,
            "base_model": str(it.get("base_model") or ""),
        }
        if civ.get("modelId"):
            entry["civitai"] = {"modelId": civ.get("modelId"), "versionId": civ.get("id")}
        items.append(entry)
        counts[category] = counts.get(category, 0) + 1
    items.sort(key=lambda x: (x["folder"].lower(), x["file"].lower()))
    folders = sorted(counts, key=lambda c: (c != ROOT_CATEGORY, c.lower()))
    return {"items": items, "counts": counts, "folders": folders, "source": "lora-manager"}


def lora_names_from_comfy() -> list:
    r"""沒設定 loraRoot 時，直接問 ComfyUI 它認得哪些 LoRA。

    回來的是相對路徑（"Character\Foo.safetensors"），足夠選取和送進
    workflow。預覽圖和觸發詞讀不到 —— 那要有本機路徑才能翻 metadata。
    """
    import urllib.request

    base = comfy_base()
    req = urllib.request.Request(base + "/object_info/LoraLoader", method="GET")
    with urllib.request.urlopen(req, timeout=10) as r:
        info = json.loads(r.read().decode("utf-8"))
    names = workflows.combo_list(info, "LoraLoader", "lora_name")
    return [n for n in names if n.endswith(".safetensors")]


def build_from_comfy() -> dict:
    items, counts = [], {}
    for rel in lora_names_from_comfy():
        parts = rel.replace("\\", "/").split("/")
        fn = parts[-1]
        stem = fn[: -len(".safetensors")]
        folder = "/".join(parts[:-1])
        category = parts[0] if len(parts) > 1 else ROOT_CATEGORY
        counts[category] = counts.get(category, 0) + 1
        items.append({
            "folder": folder,
            "category": category,
            "file": fn,
            "name": stem,
            "title": stem,
            "trainedWords": [],
            "preview": None,
            "base_model": "",
        })
    return {
        "items": items,
        "counts": counts,
        "folders": sorted(counts),
        "source": "comfy",
    }


def build_lora_list() -> dict:
    # 第一選擇：ComfyUI 的 LoRA Manager（預覽圖、觸發詞都有，也不必填 loraRoot）。
    # 沒裝、ComfyUI 沒開、或它一個 LoRA 都沒有，才退回下面的本機掃描／問 ComfyUI。
    base = comfy_base()
    raw = lora_manager_list("loras", base)
    if raw:
        data = from_lora_manager(raw)
        if data["items"]:
            data["manager"] = lm_manager_url(base)
            with _lock:
                _cache["data"] = data
                _cache["at"] = time.time()
                _cache["refreshing"] = False
            return data
    items, counts, errs = [], {}, []
    if LORA_ROOT is None:
        # 沒設定路徑就問 ComfyUI。這樣新 clone 下來不用填任何東西就有 LoRA 可選，
        # 只是沒有預覽圖和觸發詞（那兩樣得讀本機檔案旁邊的 metadata）。
        try:
            data = build_from_comfy()
            if not data["items"]:
                data["error"] = "ComfyUI 沒有回報任何 LoRA"
            else:
                data["note"] = (
                    f"清單來自 ComfyUI（{len(data['items'])} 個）。"
                    "想要預覽圖和觸發詞：在 ComfyUI 裝 LoRA Manager（啟動檔會自動裝，裝完重開 ComfyUI），"
                    "或在 config.json 填 paths.loraRoot。"
                )
        except Exception as exc:
            data = {
                "items": [], "counts": {}, "folders": [],
                "error": f"沒設定 paths.loraRoot，改問 ComfyUI 也失敗了：{exc}",
            }
        with _lock:
            _cache["data"] = data
            _cache["at"] = time.time()
            _cache["refreshing"] = False
        return data
    categories = discover_categories()
    configured = bool(LORA_FOLDERS)
    for category in categories:
        root_level = category == ROOT_CATEGORY
        base = LORA_ROOT if root_level else LORA_ROOT / category
        if not base.is_dir():
            # 只有在使用者自己列了資料夾名字的時候才抱怨。自動探索出來的清單
            # 本來就是照現況產生的，不會有不存在的項目。
            if configured:
                errs.append(f"{category}: 資料夾不存在")
            counts[category] = 0
            continue
        try:
            paths = sorted(
                (base.glob("*.safetensors") if root_level else base.rglob("*.safetensors")),
                key=lambda p: (p.parent.as_posix(), p.name),
            )
        except OSError:
            counts[category] = 0
            continue
        n = 0
        for p in paths:
            fn = p.name
            d = p.parent
            folder = d.relative_to(LORA_ROOT).as_posix()
            stem = fn[: -len(".safetensors")]
            words, title, base_model = [], stem, ""
            meta = d / (stem + ".metadata.json")
            if meta.is_file():
                try:
                    md = json.loads(meta.read_text(encoding="utf-8"))
                    raw_words = (md.get("civitai") or {}).get("trainedWords") or []
                    words = [strip_angle_tags(w) for w in raw_words]
                    title = md.get("model_name") or stem
                    base_model = (md.get("base_model")
                                  or (md.get("civitai") or {}).get("baseModel")
                                  or "")
                except Exception:
                    pass
            preview = None
            for ext in LORA_PREVIEW_EXTS:
                if (d / (stem + ext)).is_file():
                    preview = stem + ext
                    break
            items.append({
                "folder": folder,
                "category": category,
                "file": fn,
                "name": stem,
                "title": title,
                "trainedWords": words,
                "preview": preview,
                "base_model": base_model,
            })
            n += 1
        counts[category] = n
    data = {"items": items, "counts": counts, "folders": list(categories)}
    if errs:
        data["error"] = "；".join(errs)
    elif not items:
        data["error"] = f"{LORA_ROOT} 底下找不到任何 .safetensors"
    with _lock:
        _cache["data"] = data
        _cache["at"] = time.time()
        _cache["refreshing"] = False
    return data


def list_loras() -> dict:
    with _lock:
        data = _cache["data"]
        stale = (time.time() - _cache["at"]) >= TTL
        need_bg = stale and data is not None and not _cache["refreshing"]
        if need_bg:
            _cache["refreshing"] = True
    if data is None:
        return build_lora_list()
    if need_bg:
        def work():
            try:
                build_lora_list()
            except Exception as e:
                with _lock:
                    _cache["refreshing"] = False
                print(f"[lora] 背景重掃失敗：{type(e).__name__}: {e}", flush=True)
        threading.Thread(target=work, daemon=True).start()
    return data
