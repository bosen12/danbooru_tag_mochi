#!/usr/bin/env python3
"""底模的提示詞格式：Illustrious／NoobAI（預設）、Pony、Anima、Krea 2、Z-Image、MOSS-Image。

墨池、疊印台、MCP、iPhone 抽出來的都是 Illustrious 的格式（尾巴是品質字和分級字）。
伺服器送 ComfyUI 之前照選的底模換成那一家的格式（server.py 的 prepare_workflow），
所以每個前端都不用各改一次。

轉換是「重複做也一樣」：先拿掉所有格式的品質字、分級字、score／source 字，再加上目標格式的。
作品冊拿一張 Pony 印的圖重印到 Illustrious 底模，會自動換回 Illustrious 的頭尾。
Krea 2、Z-Image、MOSS-Image 是自然語言（Qwen 文字編碼器）：拿掉那些字之後不再加頭尾。

格式（照各模型的說明）：
  Illustrious：… , 分級字, masterpiece, best quality, amazing quality（現在的樣子，照舊）
  Pony（V6 XL）：score_9, score_8_up, score_7_up, score_6_up, source_anime, rating_safe|rating_questionable|rating_explicit, …
  Anima：masterpiece, best quality, safe|sensitive|explicit, …（[品質／分級] [人數] [角色] [作品] [畫師] [一般 tag]）
  Krea 2、Z-Image：只留內容 tag，不加品質字、分級字
底模怎麼對到格式：config.json 的 models.formats（檔名片段）最優先；其次是 LoRA Manager／
metadata 的 base_model（family_of_base）；對不上再看檔名。unet: 開頭且含 krea2 是 Krea 2，
含 zimage／z_image／z-image 是 Z-Image，其他 unet: 是 Anima；檔名有 pony 是 Pony；其餘是 Illustrious。
"""
from __future__ import annotations

import re

ILLUSTRIOUS = "illustrious"
PONY = "pony"
ANIMA = "anima"
KREA2 = "krea2"
ZIMAGE = "zimage"
MOSS = "moss"
FORMATS = (ILLUSTRIOUS, PONY, ANIMA, KREA2, ZIMAGE, MOSS)
LABELS = {
    ILLUSTRIOUS: "Illustrious",
    PONY: "Pony",
    ANIMA: "Anima",
    KREA2: "Krea 2",
    ZIMAGE: "Z-Image",
    MOSS: "MOSS-Image",
}

# Anima、Krea 2、Z-Image 是 diffusion model（UNETLoader），不是 checkpoint：清單和工作流裡用這個前綴分開。
UNET_PREFIX = "unet:"
# 會出現在底模清單裡的 diffusion model。Flux、SD 1.5 之類不在這裡。
UNET_FAMILIES = (ANIMA, KREA2, ZIMAGE, MOSS)

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

# Krea 2、Z-Image 預設 CFG 1，負面用不到；使用者把 CFG 調高時接在原本那串前面。
NATURAL_NEGATIVE = ["worst quality", "low quality", "blurry", "jpeg artifacts", "watermark", "text"]
# 伺服器的負面詞是給動漫底模的（不要 3D、不要寫實）。這幾家多半拿來畫寫實照片：畫風類的字拿掉，防兒童、分級的字照留。
_ANIME_STYLE_NEGATIVE = {"3d", "photorealistic", "realistic", "photo", "real life", "sketch"}

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
_BASE_KEY = re.compile(r"[\s\-_.]")


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


def family_of_base(base_model: str | None) -> str | None:
    """LoRA Manager／metadata 的 base_model → 家族。對不上（Flux、SD 1.5、Wan、Other、Unknown、空的）回 None。

    正規化：小寫、去掉空白、-、_、.。Flux.1 Krea（flux1krea）不是 Krea 2，只認 krea2。
    """
    key = _BASE_KEY.sub("", str(base_model or "").lower())
    if not key:
        return None
    if "moss" in key:
        return MOSS
    if "pony" in key:
        return PONY
    if "illustrious" in key or "noobai" in key or "sdxl" in key:
        return ILLUSTRIOUS
    if "anima" in key:
        return ANIMA
    if "krea2" in key:
        return KREA2
    if "zimage" in key:
        return ZIMAGE
    return None


def format_of(model: str | None, overrides: dict | None = None, base_model: str | None = None) -> str:
    """底模名字 → 格式。overrides：{檔名片段: 格式}（config.json 的 models.formats），比自動判斷優先。

    其次用 base_model（family_of_base 有結果就用）。再來才是檔名：unet: 且含 krea2 → krea2；
    含 zimage／z_image／z-image → zimage；其他 unet: → anima；檔名有 pony → pony；其餘 illustrious。
    """
    name = str(model or "").replace("/", "\\")
    low = name.lower()
    for part, fmt in (overrides or {}).items():
        if part and str(part).lower() in low and fmt in FORMATS:
            return fmt
    fam = family_of_base(base_model)
    if fam:
        return fam
    if low.startswith(UNET_PREFIX):
        if "moss" in low:
            return MOSS
        if "krea2" in low:
            return KREA2
        if "zimage" in low or "z_image" in low or "z-image" in low:
            return ZIMAGE
        return ANIMA
    base = low.split("\\")[-1]
    if "pony" in base:
        return PONY
    return ILLUSTRIOUS


def listed_unet_family(name: str | None, base_model: str | None = None) -> str | None:
    """diffusion model 要不要出現在底模清單。只有 anima、krea2、zimage。

    base_model 認得出家族就用它（Illustrious、Pony 不列）。認不出來（沒有 metadata、Other、Unknown、Flux）
    才看檔名：含 anima、krea2，或 zimage／z_image／z-image。
    """
    fam = family_of_base(base_model)
    if fam in UNET_FAMILIES:
        return fam
    if fam in (ILLUSTRIOUS, PONY):
        return None
    low = str(name or "").lower()
    if low.startswith(UNET_PREFIX):
        low = low[len(UNET_PREFIX):]
    if "moss" in low:
        return MOSS
    if "anima" in low:
        return ANIMA
    if "krea2" in low:
        return KREA2
    if "zimage" in low or "z_image" in low or "z-image" in low:
        return ZIMAGE
    return None


def convert_positive(positive: str, fmt: str, rating) -> str:
    """換成這個格式的頭尾。其他字的順序、份量都不動。"""
    r = rating_key(rating)
    body = [t for t in split_tags(positive) if not is_meta(t)]
    if fmt == PONY:
        return ", ".join(PONY_PREFIX + [PONY_RATING[r]] + body)
    if fmt == ANIMA:
        return ", ".join(ANIMA_QUALITY + [ANIMA_RATING[r]] + body)
    if fmt in (KREA2, ZIMAGE, MOSS):
        return ", ".join(body)
    return ", ".join(body + ILLUSTRIOUS_RATING[r] + ILLUSTRIOUS_QUALITY)


def negative_for(fmt: str, rating, base: str) -> str:
    """這個格式的負面詞：base 是伺服器照分級組好的那串（Illustrious 用的），其他格式在前面加自己的。"""
    r = rating_key(rating)
    if fmt == PONY:
        extra = PONY_NEGATIVE + [PONY_RATING[x] for x in _HIGHER[r]]
    elif fmt == ANIMA:
        extra = ANIMA_NEGATIVE + [ANIMA_RATING[x] for x in _HIGHER[r]]
    elif fmt in (KREA2, ZIMAGE, MOSS):
        extra = list(NATURAL_NEGATIVE)
        base = ", ".join(t for t in split_tags(base) if _bare(t) not in _ANIME_STYLE_NEGATIVE)
    else:
        return base
    have = {_bare(t) for t in split_tags(base)}
    head = [t for t in extra if _bare(t) not in have]
    return ", ".join(head + split_tags(base))
