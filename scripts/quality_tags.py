# -*- coding: utf-8 -*-
"""2026-10-26 大批新字・第四批品質與 54.csv。

品質表 58 張、54.csv 54 張。不收 noose、self-harm。
九個未成年相關的字先進詞庫再封鎖。其餘家族、強迫、獸交、梗圖只在釘了才出現。
畫風技法留在品質池（隨機抽籤本來就不抽品質段）。身高、角色年齡、迷你人進特徵池。
"""
from __future__ import annotations

HEAT_ALL = ["tease", "flash", "sex"]
HEAT_SEX = ["sex"]

# (tag, zh, section, group, sub, heat, mutex, needs, implies, gate, era, layer)
def _r(tag, zh, section, group, sub, heat=None, mutex=None, needs=(), implies=(), gate="any", era=None, layer="normal"):
    return {
        "tag": tag,
        "zh": zh,
        "section": section,
        "group": group,
        "sub": sub,
        "gate": gate,
        "heat": list(heat or HEAT_ALL),
        "mutex": mutex,
        "bind": [],
        "implies": list(implies),
        "layer": layer,
        "era": list(era or ["any"]),
        "needs": list(needs),
    }


# 版面、梗、作品、泛用標籤：鏡頭的畫面處理，三檔都有，正常模式不自己補。
_LAYOUT = [
    ("official alternate costume", "官方替換服裝"),
    ("adapted costume", "改編服裝"),
    ("official alternate hairstyle", "官方替換髮型"),
    ("contemporary", "現代風（現代服裝）"),
    ("alternate color", "替換配色"),
    ("fashion", "時尚"),
    ("multiple crossover", "多重跨作品合作"),
    ("evolutionary line", "進化系譜"),
    ("cellphone photo", "手機拍攝照片"),
    ("rei no himo", "那條緞帶（梗）"),
    ("left-to-right manga", "由左至右閱讀漫畫"),
    ("circle name", "社團名稱"),
    ("rotational symmetry", "旋轉對稱"),
    ("circle cut", "社團展示卡"),
    ("art tools in frame", "畫面內的繪圖工具"),
    ("pokedex number", "寶可夢圖鑑編號"),
    ("circled 9", "圈圈 9"),
    ("furigana", "注音假名"),
    ("group name", "團體名稱"),
    ("cursive", "草寫體"),
    ("comparison", "對照比較"),
    ("sailor moon redraw challenge (meme)", "美少女戰士重繪挑戰（梗）"),
    ("multiple monochrome", "多個單色"),
    ("twitter strip game", "Twitter 脫衣遊戲"),
    ("easter egg", "復活節彩蛋"),
    ("official alternate color", "官方替換配色"),
    ("good end", "好結局"),
    ("player 2", "二號玩家"),
    ("before and after", "前後對照"),
    ("art program in frame", "畫面內的繪圖軟體"),
    ("segmented comic", "分段漫畫"),
    ("bubble tea challenge", "珍珠奶茶挑戰"),
    ("rounded corners", "圓角"),
    ("height chart", "身高表"),
    ("in memoriam", "紀念"),
    ("troll face", "Troll Face"),
    ("like and retweet", "按讚並轉推"),
    ("artist name", "繪師名稱"),
    ("twitter username", "Twitter 帳號"),
    ("alternate costume", "替換服裝"),
    ("you gonna get raped", "「你要被強暴了」（梗）"),
    ("they had lots of sex afterwards (meme)", "「之後他們做了很多愛」（梗）"),
    ("do not want", "「我不要」（抗拒）"),
    ("just the tip", "「只進去一點點」（梗）"),
    ("age progression", "年齡成長變化"),
    ("age comparison", "年齡對照圖"),
]

# 真的在畫的技法。品質段沒有隨機配額，釘了才進正常模式。
_TECH = [
    ("halftone", "半色調網點（halftone）", "style_tech", (), ()),
    ("pale colors", "淡色調", "style_palette", (), ()),
    ("aqua theme", "水藍色主題", "style_palette", (), ()),
    ("rainbow gradient", "彩虹漸層", "style_palette", (), ()),
    ("linear hatching", "平行線排線", "style_tech", ("hatching (texture)",), ()),
    ("child's drawing", "兒童塗鴉風格", "style_tech", (), ()),
    ("blending", "融合畫面", "style_tech", (), ()),
    ("grey theme", "灰色主題", "style_palette", (), ()),
    ("split theme", "分割主題", "style_palette", (), ()),
    ("vignetting", "暗角", "style_tech", (), ()),
    ("photorealistic", "寫實風格", "style_tech", ("realistic",), ()),
]

ROWS = []
for tag, zh in _LAYOUT:
    ROWS.append(_r(tag, zh, "pose", "camera", "cam_fx", mutex="camera"))
ROWS.append(_r("walk-in", "被人闖入", "pose", "tease", "pose_situ"))
ROWS.append(_r("role reversal", "角色互換", "feature", "other", "persona"))
ROWS.append(_r("bad end", "壞結局", "quality", "style", "style_tech", heat=HEAT_SEX))
ROWS.append(_r("chibi only", "僅 Q 版", "quality", "style", "style_tech"))
ROWS.append(_r("still life", "靜物畫", "quality", "style", "style_tech"))
for tag, zh, sub, implies, _extra in _TECH:
    ROWS.append(_r(tag, zh, "quality", "style", sub, implies=implies))

# 進池的身體與人設。身高不佔 tall female／petite 的 height 互斥格。
ROWS.append(_r("height", "身高", "feature", "body_f", "bf_shape"))
ROWS.append(_r("character age", "角色年齡", "feature", "other", "persona"))
ROWS.append(_r("mini person", "迷你人（縮小的人）", "feature", "body_f", "bf_shape"))
ROWS.append(_r("miniboy", "迷你男孩", "feature", "body_m", "bm_build", gate="male", needs=("male",)))

# 家族與師生：性愛熱度，正常模式不自己補。師生不封鎖（任務沒有把它列進去）。
_FAMILY = [
    ("brother and sister", "兄妹/姊弟", ("pair",), ("siblings",)),
    ("incest", "亂倫", ("pair",), ()),
    ("cousins", "表/堂兄弟姊妹", ("pair",), ()),
    ("half-siblings", "同父異母/同母異父手足", ("pair",), ("siblings",)),
    ("family bonding", "家人情感", ("pair",), ()),
    ("twincest", "雙胞胎亂倫", ("pair",), ("twins", "incest")),
    ("selfcest", "自我亂倫（同一角色）", (), ("incest",)),
    ("triplets", "三胞胎", (), ()),
    ("teacher and student", "師生", ("pair",), ()),
    ("parent and child", "親子", (), ()),
    ("father and son", "父子", (), ()),
]
for tag, zh, needs, implies in _FAMILY:
    ROWS.append(_r(tag, zh, "feature", "other", "relation", heat=HEAT_SEX, needs=needs, implies=implies))

_PERSONA = [
    ("pervert", "變態（色狼）", "any", (), ()),
    ("female pervert", "女色狼", "female", ("female",), ("pervert",)),
    ("masochism", "受虐癖", "any", (), ()),
    ("sadism", "施虐癖", "any", (), ()),
]
for tag, zh, gate, needs, implies in _PERSONA:
    ROWS.append(_r(tag, zh, "feature", "other", "persona", heat=HEAT_SEX, gate=gate, needs=needs, implies=implies))

_SEX = [
    ("assisted exposure", "被協助露出", "sex_fetish", ("pair",), ()),
    ("stationary restraints", "固定式拘束具", "sex_bdsm", (), ()),
    ("unconscious", "失去意識", "sex_fetish", (), ()),
    ("covering another's mouth", "摀住別人的嘴", "sex_bdsm", ("pair",), ()),
    ("lifting another's clothes", "掀別人的衣服", "sex_fetish", ("pair",), ()),
    ("stuck", "被卡住", "sex_fetish", (), ()),
    ("through wall", "穿牆（卡在牆中）", "sex_pos", (), ()),
    ("zoophilia", "獸交", "sex_alien", (), ("bestiality",)),
    ("imminent rape", "即將被強暴", "sex_bdsm", (), ()),
    ("defloration", "破處", "sex_fetish", (), ()),
    ("pokephilia", "寶可夢獸交", "sex_alien", (), ("zoophilia",)),
    ("spanked", "被打屁股", "sex_bdsm", (), ("spanking",)),
    ("have to pee", "憋尿", "sex_fetish", (), ()),
    ("stepped on", "被踩踏", "sex_bdsm", (), ("trampling",)),
    ("ryona", "被虐（ryona）", "sex_bdsm", (), ()),
    ("uncommon stimulation", "非常規刺激", "sex_fetish", (), ()),
    ("consensual tentacles", "合意的觸手", "sex_alien", (), ("tentacles",)),
    ("toilet use", "上廁所", "sex_fetish", (), ()),
    ("tentacle in mouth", "觸手入口", "sex_oral", (), ("tentacles",)),
    ("forced orgasm", "強制高潮", "sex_fetish", (), ()),
    ("tentacles on male", "觸手纏男性", "sex_alien", ("male",), ("tentacles",)),
    ("abuse", "虐待", "sex_bdsm", (), ()),
    ("mouth insertion", "口中插入", "sex_oral", (), ()),
]
for tag, zh, sub, needs, implies in _SEX:
    gate = "male" if tag == "tentacles on male" else "any"
    ROWS.append(_r(tag, zh, "pose", "sex", sub, heat=HEAT_SEX, gate=gate, needs=needs, implies=implies))
ROWS.append(_r("rectum", "直腸", "feature", "body_f", "bf_intimate", heat=HEAT_SEX))

# 嬰兒與年齡對照：先進詞庫，七份封鎖名單再擋掉。不帶出胸罩或制服。
_CLOTHES = [
    ("pacifier", "奶嘴", "acc", "acc_face", None, "accessory", "any"),
    ("diaper", "尿布", "underwear", "uw_bottom", "underwear_bottom", "underwear", "any"),
    ("bib", "圍兜", "acc", "acc_neck", None, "accessory", "any"),
    ("onesie", "連身嬰兒裝", "onepiece", "op_night", "onepiece", "garment", "any"),
    ("training bra", "少女初階內衣", "underwear", "uw_top", "underwear_top", "underwear", "female"),
]
for tag, zh, group, sub, mutex, layer, gate in _CLOTHES:
    ROWS.append(_r(
        tag, zh, "clothing", group, sub, mutex=mutex, gate=gate,
        era=["modern"], layer=layer,
    ))

# 正常模式不自己補。封鎖字也放進來，少列一份名單時仍不會進普通抽籤。
ODD = [
    r["tag"] for r in ROWS
    if r["tag"] not in {
        "halftone", "pale colors", "aqua theme", "rainbow gradient", "linear hatching",
        "child's drawing", "blending", "grey theme", "split theme", "vignetting",
        "photorealistic", "height", "character age", "mini person", "miniboy",
    }
]
BANNED = [
    "pacifier", "diaper", "bib", "onesie", "training bra",
    "age progression", "age comparison", "parent and child", "father and son",
]
REJECTED = ["noose", "self-harm"]
NARROW = {}
ZH_QUALITY = {r["tag"]: r["zh"] for r in ROWS}
GROUP_OF = {r["tag"]: r["group"] for r in ROWS}


def extra_quality_tags():
    return ROWS


def _check():
    tags = [r["tag"] for r in ROWS]
    if len(tags) != len(set(tags)):
        raise SystemExit("duplicate tag")
    if len(ROWS) != 110:
        raise SystemExit(f"rows {len(ROWS)}")
    if set(BANNED) - set(tags):
        raise SystemExit("ban missing from rows")
    if set(REJECTED) & set(tags):
        raise SystemExit("rejected tag was added")
    if set(BANNED) - set(ODD):
        raise SystemExit("banned tag not odd")
    if len(ODD) != 95:
        raise SystemExit(f"odd {len(ODD)}")
    zhs = {}
    for r in ROWS:
        zhs.setdefault(r["zh"], []).append(r["tag"])
    collided = {k: v for k, v in zhs.items() if len(v) > 1}
    if collided:
        raise SystemExit(f"zh collide inside batch {collided}")


_check()
