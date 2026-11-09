#!/usr/bin/env python3
"""底模的提示詞格式：Illustrious／NoobAI（預設）、Pony、Anima。

墨池、疊印台、MCP、iPhone 抽出來的都是 Illustrious 的格式（尾巴是品質字和分級字）。
伺服器送 ComfyUI 之前照選的底模換成那一家的格式（server.py 的 prepare_workflow），
所以每個前端都不用各改一次。

轉換是「重複做也一樣」：先拿掉所有格式的品質字、分級字、score／source 字，再加上目標格式的。
作品冊拿一張 Pony 印的圖重印到 Illustrious 底模，會自動換回 Illustrious 的頭尾。

格式（照各模型的說明）：
  Illustrious：… , 分級字, masterpiece, best quality, amazing quality（現在的樣子，照舊）
  Pony（V6 XL）：score_9, score_8_up, score_7_up, score_6_up, source_anime, rating_safe|rating_questionable|rating_explicit, …
  Anima：masterpiece, best quality, safe|sensitive|explicit, …（[品質／分級] [人數] [角色] [作品] [畫師] [一般 tag]）
底模怎麼對到格式：Anima 是 ComfyUI diffusion_models 裡的 anima*（名字前面加 unet:）；
底模檔名有 pony 的是 Pony；其他是 Illustrious。config.json 的 models.formats 可以指定（檔名片段 → 格式）。
"""
from __future__ import annotations

import re

ILLUSTRIOUS = "illustrious"
PONY = "pony"
ANIMA = "anima"
FORMATS = (ILLUSTRIOUS, PONY, ANIMA)
LABELS = {ILLUSTRIOUS: "Illustrious", PONY: "Pony", ANIMA: "Anima"}

# Anima 是 diffusion model（UNETLoader），不是 checkpoint：清單和工作流裡用這個前綴分開。
UNET_PREFIX = "unet:"

# Illustrious 的頭尾（跟 web/lexicon.json 的 quality、sfwTail、sensitiveTail、nsfwTail 一樣）。
ILLUSTRIOUS_QUALITY = ["masterpiece", "best quality", "amazing quality"]
ILLUSTRIOUS_RATING = {"general": ["sfw", "general"], "sensitive": ["sensitive"], "explicit": ["nsfw", "explicit"]}

PONY_PREFIX = ["score_9", "score_8_up", "score_7_up", "score_6_up", "source_anime"]
PONY_RATING = {"general": "rating_safe", "sensitive": "rating_questionable", "explicit": "rating_explicit"}
# Pony 常見的負面：低分、其他畫風來源（這裡只畫動漫）。
PONY_NEGATIVE = ["score_6", "score_5", "score_4", "source_pony", "source_furry", "source_cartoon"]

ANIMA_QUALITY = ["masterpiece", "best quality"]
ANIMA_RATING = {"general": "safe", "sensitive": "sensitive", "explicit": "explicit"}
# Anima 模型頁建議的負面（score_1～3 是它少數用得到的 score 字）。
ANIMA_NEGATIVE = ["worst quality", "low quality", "score_1", "score_2", "score_3", "artist name", "blurry", "jpeg artifacts", "chromatic aberration", "sepia"]

# 各家的分級字裡，比這一級高的那些放進負面（Illustrious 不加：它的負面本來就有 nsfw、explicit 那一串）。
_HIGHER = {"general": ["sensitive", "explicit"], "sensitive": ["explicit"], "explicit": []}

# 轉換前先拿掉的字：所有格式的品質字、分級字、score／source 字。
_META = {
    "masterpiece", "best quality", "amazing quality", "high quality", "good quality", "normal quality",
    "sfw", "general", "sensitive", "questionable", "nsfw", "explicit", "safe",
    "rating_safe", "rating_questionable", "rating_explicit",
    "source_anime", "source_pony", "source_furry", "source_cartoon",
}
_SCORE = re.compile(r"^score_\d(_up)?$")
_WEIGHTED = re.compile(r"^\((.+?)(?::[\d.]+)?\)$")


def _bare(tag: str) -> str:
    """(masterpiece:1.2) → masterpiece；大小寫、底線不分（score 字保留底線）。"""
    t = tag.strip()
    m = _WEIGHTED.match(t)
    if m:
        t = m.group(1)
    t = t.strip().lower()
    return t if _SCORE.match(t) or t.startswith(("rating_", "source_")) else t.replace("_", " ")


def is_meta(tag: str) -> bool:
    b = _bare(tag)
    return b in _META or bool(_SCORE.match(b))


def split_tags(positive: str) -> list[str]:
    return [t.strip() for t in str(positive or "").split(",") if t.strip()]


def rating_key(rating) -> str:
    """分級：general／sensitive／explicit（舊的 True／False 當全年齡／色情）。"""
    if rating is True:
        return "general"
    if rating in ("general", "sensitive", "explicit"):
        return rating
    return "explicit"


def format_of(model: str | None, overrides: dict | None = None) -> str:
    """底模名字 → 格式。overrides：{檔名片段: 格式}（config.json 的 models.formats），比自動判斷優先。"""
    name = str(model or "").replace("/", "\\")
    low = name.lower()
    for part, fmt in (overrides or {}).items():
        if part and str(part).lower() in low and fmt in FORMATS:
            return fmt
    if low.startswith(UNET_PREFIX):
        return ANIMA
    base = low.split("\\")[-1]
    if "pony" in base:
        return PONY
    return ILLUSTRIOUS


def convert_positive(positive: str, fmt: str, rating) -> str:
    """換成這個格式的頭尾。其他字的順序、份量都不動。"""
    r = rating_key(rating)
    body = [t for t in split_tags(positive) if not is_meta(t)]
    if fmt == PONY:
        return ", ".join(PONY_PREFIX + [PONY_RATING[r]] + body)
    if fmt == ANIMA:
        return ", ".join(ANIMA_QUALITY + [ANIMA_RATING[r]] + body)
    return ", ".join(body + ILLUSTRIOUS_RATING[r] + ILLUSTRIOUS_QUALITY)


def negative_for(fmt: str, rating, base: str) -> str:
    """這個格式的負面詞：base 是伺服器照分級組好的那串（Illustrious 用的），其他格式在前面加自己的。"""
    r = rating_key(rating)
    if fmt == PONY:
        extra = PONY_NEGATIVE + [PONY_RATING[x] for x in _HIGHER[r]]
    elif fmt == ANIMA:
        extra = ANIMA_NEGATIVE + [ANIMA_RATING[x] for x in _HIGHER[r]]
    else:
        return base
    have = {_bare(t) for t in split_tags(base)}
    head = [t for t in extra if _bare(t) not in have]
    return ", ".join(head + split_tags(base))
