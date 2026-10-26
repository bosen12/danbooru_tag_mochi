"""卡面的自訂提示詞（卡冊的「提示詞」視窗）：一張牌一筆，存在 data/card_art_custom.json。

烘卡（scripts/bake_card_art.py）跟第一次準備的卡面檢查（scripts/fetch_card_art.py）都用 apply()
把自訂的提示詞換進工作清單：
  - 改過的牌照自訂的提示詞烘；manifest 記下這段提示詞，之後不會被當成「舊版」再抓公開包蓋掉。
  - 刪掉自訂（恢復預設）就回到 card_jobs 的預設提示詞，下次檢查會照預設重烘。

擋未成年不能被自訂拿掉：負面詞一定接上 AGE_GUARD（跟 web/card-art.js 的同一串）。
正面詞裡的封鎖字由伺服器存檔前擋（server.banned_in_prompt）。
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from file_lock import locked

ROOT = Path(__file__).resolve().parent
PATH = Path(os.environ.get("CARD_ART_CUSTOM_PATH") or ROOT / "data" / "card_art_custom.json")
# web/card-art.js 的 AGE_GUARD：有人的卡面一律擋掉看起來未成年的畫法。自訂的負面詞也一樣接上。
AGE_GUARD = ["loli", "shota", "child", "aged down", "teenage", "kid", "toddler"]
MAX_LEN = 2000


class CustomError(ValueError):
    pass


def _split(text: str) -> list[str]:
    return [t.strip() for t in str(text or "").split(",") if t.strip()]


def clean(text: str) -> str:
    """逗號分開、去掉空白和重複的空項；保留順序與原本的寫法（權重括號照留）。"""
    return ", ".join(_split(text))


def guard_negative(negative: str) -> str:
    """負面詞補上擋未成年的那串（已經有的不重複）。"""
    have = {t.lower() for t in _split(negative)}
    extra = [t for t in AGE_GUARD if t not in have]
    return ", ".join(_split(negative) + extra)


def load() -> dict:
    try:
        data = json.loads(PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    out = {}
    for tag, v in data.items():
        if isinstance(tag, str) and isinstance(v, dict) and isinstance(v.get("positive"), str):
            out[tag] = {"positive": v["positive"], "negative": str(v.get("negative") or ""), "at": v.get("at")}
    return out


def _write(data: dict) -> None:
    PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    os.replace(tmp, PATH)


def save(tag: str, positive: str, negative: str) -> dict:
    tag = str(tag or "").strip()
    positive, negative = clean(positive), clean(negative)
    if not tag:
        raise CustomError("沒有指定是哪一張牌")
    if not positive:
        raise CustomError("正面提示詞不能是空的")
    if len(positive) > MAX_LEN or len(negative) > MAX_LEN:
        raise CustomError(f"提示詞太長（上限 {MAX_LEN} 字）")
    with locked(PATH):
        data = load()
        data[tag] = {"positive": positive, "negative": negative, "at": int(time.time() * 1000)}
        _write(data)
    return data[tag]


def remove(tag: str) -> bool:
    with locked(PATH):
        data = load()
        if tag not in data:
            return False
        del data[tag]
        _write(data)
    return True


def apply(jobs: list, key: str = "tag") -> list:
    """把自訂的提示詞換進烘卡工作（同一個 list，原地改並回傳）。負面詞補上 AGE_GUARD。"""
    custom = load()
    if not custom:
        return jobs
    for job in jobs:
        if not isinstance(job, dict):
            continue
        c = custom.get(job.get(key))
        if not c:
            continue
        job["positive"] = c["positive"]
        job["negative"] = guard_negative(c["negative"])
        job["custom"] = True
    return jobs
