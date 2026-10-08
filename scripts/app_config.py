#!/usr/bin/env python3
"""共用的 config.json 讀取器。

機器專屬的路徑（ComfyUI 裝在哪、checkpoint 資料夾、prompt pack 目錄）本來寫死在
各支程式裡，別人要跑就得改原始碼。全部集中到專案根目錄的 config.json。

優先序：環境變數 > config.json > 呼叫端給的預設值。
環境變數放第一是為了不打斷既有的啟動腳本。
"""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = Path(os.environ.get("APP_CONFIG", ROOT / "config.json"))


def load() -> dict:
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, ValueError) as exc:
        print(f"[config] 讀不到 {CONFIG_PATH}：{exc}", flush=True)
        return {}
    return raw if isinstance(raw, dict) else {}


CONFIG = load()


def cfg(path: str, env: str = "", default=None):
    """依序看環境變數、config.json 的 "a.b.c" 路徑、預設值。"""
    if env:
        got = os.environ.get(env, "").strip()
        if got:
            return got
    node = CONFIG
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return default if node is None or node == "" else node
