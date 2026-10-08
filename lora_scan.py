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


def lora_names_from_comfy() -> list:
    r"""沒設定 loraRoot 時，直接問 ComfyUI 它認得哪些 LoRA。

    回來的是相對路徑（"Character\Foo.safetensors"），足夠選取和送進
    workflow。預覽圖和觸發詞讀不到 —— 那要有本機路徑才能翻 metadata。
    """
    import urllib.request

    env = os.environ.get("COMFY_API", "").strip()
    saved = workflows.saved_comfy_api()
    base = (env or saved or str(cfg("comfy.api", "", workflows.DEFAULT_COMFY_API))).rstrip("/")
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
                    "想要預覽圖和觸發詞，請在 config.json 填 paths.loraRoot。"
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
