# -*- coding: utf-8 -*-
"""2026-10-12 general_tags_suggestions.csv。

CSV 的類別、gate、heat、mutex 是從同組抄來的，不能照用。
這裡逐項重設。Danbooru 皆為現役 category 0。中文撞名的已改掉。
"""

from __future__ import annotations


def _row(tag, zh, section, mutex=None, layer="normal", era=None, gate="any",
         implies=(), extra=(), needs=(), bind=()):
    out = {
        "tag": tag,
        "section": section,
        "gate": gate,
        "heat": ["tease", "flash", "sex"],
        "mutex": mutex,
        "bind": list(bind),
        "implies": list(implies),
        "layer": layer,
        "era": list(era or ["any"]),
        "needs": list(needs),
        "zh": zh,
    }
    if extra:
        out["mutexExtra"] = list(extra)
    return out


def build() -> list[dict]:
    c, f, p, e = "clothing", "feature", "pose", "env"
    g, acc = "garment", "accessory"
    modern, edo = ["modern"], ["edo"]
    solid = ("place", "in_out", "day_night", "bg_blur")
    rows = []
    A = rows.append

    # 帽子。顏色帽以「 hat」結尾，後綴會帶出 hat。不叫 hat 的要自己帶。
    # 摘下來的帽子不佔頭飾格，也不把帽子畫回頭上。
    for tag, zh in (
        ("black hat", "黑帽子"), ("white hat", "白帽子"), ("red hat", "紅帽子"),
        ("blue hat", "藍帽子"), ("brown hat", "棕帽子"), ("green hat", "綠帽子"),
        ("mini hat", "迷你帽"), ("tokin hat", "兜巾"),
    ):
        A(_row(tag, zh, c, mutex="headwear", layer=acc))
    cap_era = {"peaked cap": ["victorian", "modern"], "visor cap": modern, "beanie": modern}
    for tag, zh in (
        ("mob cap", "頭巾帽"), ("peaked cap", "大簷帽"), ("visor cap", "鴨舌帽"),
        ("beanie", "毛線帽"),
    ):
        A(_row(tag, zh, c, mutex="headwear", layer=acc, implies=("hat",), era=cap_era.get(tag)))
    A(_row("headdress", "頭飾", c, mutex="headwear", layer=acc))
    A(_row("missing headwear", "沒戴帽子", c, mutex="headwear", layer=acc))
    A(_row("unworn headwear", "摘下頭飾", c, layer=acc))
    A(_row("unworn hat", "摘下帽子", c, layer=acc))
    A(_row("hat ornament", "帽飾", c, layer=acc, implies=("hat",)))
    A(_row("hat flower", "帽上花", c, layer=acc, implies=("hat", "flower")))
    A(_row("x hair ornament", "叉形髮飾", c, layer=acc))
    A(_row("hair tubes", "包髮筒", c, layer=acc))
    A(_row("pom pom (clothes)", "毛球飾", c, layer=acc))
    A(_row("spikes", "尖刺飾", c, layer=acc))
    A(_row("jingle bell", "響鈴", c, layer=acc, implies=("bell",)))
    A(_row("fake tail", "假尾巴", c, layer=acc, implies=("tail",)))
    A(_row("ear covers", "耳罩", c, layer=acc))
    A(_row("headset", "耳麥", c, mutex="headwear", layer=acc, era=modern, implies=("headphones",)))
    A(_row("epaulettes", "肩章", c, layer=acc))
    A(_row("armlet", "臂環", c, mutex="jewelry", layer=acc))
    A(_row("bridal gauntlets", "新娘手套", c, mutex="hands", layer=acc, gate="female", implies=("gloves",)))

    # 布料細節。不佔上衣格。無袖外套、無袖毛衣、無袖和服不是布料。
    for tag, zh in (
        ("white sleeves", "白袖"), ("black sleeves", "黑袖"), ("blue sleeves", "藍袖"),
        ("red sleeves", "紅袖"), ("purple sleeves", "紫袖"), ("pink sleeves", "粉袖"),
        ("green sleeves", "綠袖"), ("grey sleeves", "灰袖"),
        ("ribbon-trimmed sleeves", "緞帶袖"), ("sleeve cuffs", "袖口"),
        ("fur-trimmed sleeves", "毛邊袖"), ("striped sleeves", "條紋袖"),
        ("torn sleeves", "破袖"), ("short over long sleeves", "短疊長袖"),
        ("single sleeve", "單邊袖"), ("single detached sleeve", "單分離袖"),
        ("sleeves pushed up", "捲袖"), ("gold trim", "金邊"), ("lapels", "翻領"),
    ):
        A(_row(tag, zh, c, layer=g))
    A(_row("legwear garter", "襪帶", c, layer=g, gate="female"))
    A(_row("three-quarter sleeves", "七分袖", c, layer=g, extra=("sleeve_len",)))
    A(_row("sleeves past fingers", "袖過指", c, layer=g, implies=("long sleeves",),
          extra=("sleeve_len", "bare_long")))
    A(_row("puffy detached sleeves", "蓬鬆離袖", c, layer=g,
          implies=("puffy sleeves", "detached sleeves")))

    # 下身。裙帶出 skirt（女性）。袴風短裙只是短裙，不帶出袴。
    for tag, zh in (
        ("hakama short skirt", "袴短裙"), ("shorts under skirt", "裙裡短褲"),
        ("bubble skirt", "泡泡裙"),
    ):
        A(_row(tag, zh, c, mutex="bottom", layer=g, gate="female"))
    A(_row("overskirt", "罩裙", c, mutex="bottom", layer=g, gate="female", implies=("skirt",)))
    A(_row("capri pants", "七分褲", c, mutex="bottom", layer=g, era=modern))

    # 腿襪。褲襪穿在短褲下只佔腿襪格；短褲由後綴帶出，不再帶褲襪。
    for tag, zh in (
        ("toeless legwear", "露趾襪"), ("mismatched legwear", "異色襪"),
        ("uneven legwear", "長短襪"), ("stirrup legwear", "踩腳襪"),
        ("bobby socks", "翻邊襪"), ("ankle socks", "踝襪"), ("bow legwear", "蝴蝶結襪"),
    ):
        modern_sock = tag in {"toeless legwear", "stirrup legwear", "bobby socks", "ankle socks"}
        A(_row(tag, zh, c, mutex="legs", layer=g, gate="female", era=modern if modern_sock else None))
    A(_row("pantyhose under shorts", "內搭褲襪", c, mutex="legs", layer=g, gate="female", era=modern))
    A(_row("missing legwear", "沒穿襪", c, mutex="legs", layer=g))

    # 鞋。靴子、鞋、涼鞋要自己帶出，後綴規則沒有它們。
    A(_row("platform sandals", "厚底涼鞋", c, mutex="feet", layer=g, era=modern, implies=("sandals",)))
    A(_row("platform shoes", "厚底鞋", c, mutex="feet", layer=g, era=modern, implies=("shoes",)))
    A(_row("platform boots", "厚底靴", c, mutex="feet", layer=g, era=modern, implies=("boots",)))
    A(_row("rubber boots", "雨靴", c, mutex="feet", layer=g, era=modern, implies=("boots",)))

    # 外套。單肩披風不帶 cape，否則時代會被收成中世紀。
    for tag, zh in (
        ("fur-trimmed coat", "毛邊大衣"), ("long coat", "長大衣"), ("winter coat", "冬大衣"),
        ("letterman jacket", "棒球外套"), ("sleeveless jacket", "無袖外套"),
        ("suit jacket", "西裝上衣"),
    ):
        A(_row(tag, zh, c, mutex="outer", layer=g, era=modern))
    # 單肩披風不是現代外套。不帶 cape，時代才不會被收成中世紀。
    A(_row("side cape", "單肩披風", c, mutex="outer", layer=g))
    A(_row("open robe", "敞開長袍", c, mutex="outer", layer=g, implies=("robe",)))

    # 整套。短和服、無袖和服走時代組，後綴會帶出和服與和風服裝。
    A(_row("short kimono", "短和服", c, mutex="onepiece", layer=g, era=edo))
    A(_row("sleeveless kimono", "無袖和服", c, mutex="onepiece", layer=g, era=edo))
    A(_row("armored dress", "鎧甲洋裝", c, mutex="onepiece", layer=g, gate="female"))
    A(_row("track suit", "運動套裝", c, mutex="onepiece", layer=g, era=modern, implies=("suit",)))
    A(_row("skirt suit", "裙套裝", c, mutex="onepiece", layer=g, era=modern, gate="female", implies=("suit",)))
    A(_row("plugsuit (evangelion)", "插栓服", c, mutex="onepiece", layer=g, era=modern, implies=("bodysuit",)))
    A(_row("dress flower", "裙花飾", c, layer=acc, implies=("flower",)))

    # 上衣。無袖高領佔袖長，並帶出高領。
    for tag, zh in (
        ("striped shirt", "條紋襯衫"), ("frilled shirt", "荷葉襯衫"),
        ("off-shoulder shirt", "露肩襯衫"),
    ):
        A(_row(tag, zh, c, mutex="top", layer=g, era=modern))
    A(_row("sleeveless turtleneck", "無袖高領", c, mutex="top", layer=g, era=modern,
          implies=("turtleneck",), extra=("sleeve_len",)))
    A(_row("aran sweater", "阿蘭毛衣", c, mutex="top", layer=g, era=modern))
    A(_row("sleeveless sweater", "無袖毛衣", c, mutex="top", layer=g, era=modern))

    # 背景。星空的星星不是色塊背景。
    for tag, zh in (
        ("transparent background", "透明背景"), ("brown background", "棕背景"),
        ("orange background", "橘背景"), ("aqua background", "水藍背景"),
        ("grid background", "格線背景"), ("dark background", "深色背景"),
        ("photo background", "照片背景"), ("checkered background", "棋盤背景"),
        ("greyscale with colored background", "灰彩背景"),
        ("star symbol background", "星形背景"), ("heart background", "愛心背景"),
        ("argyle background", "菱格背景"), ("patterned background", "圖案背景"),
    ):
        A(_row(tag, zh, e, mutex="background", implies=("simple background",), extra=solid,
               era=modern if tag == "photo background" else None))
    A(_row("star (sky)", "夜空星", e))
    # 火是畫面上著火，跟爆炸、燃燒同一格特效，不當光線（Opus 2026-10-12）。
    # 太陽、蔭影只在白天的室外，昏暗不在白天：engine.js 的 DAY_MARK／OUTDOOR_LEFTOVER／DARK_LIGHT。
    A(_row("fire", "火光", e, mutex="effect"))
    for tag, zh in (
        ("sun", "太陽"), ("shade", "蔭影"),
        ("dark", "昏暗"), ("stage lights", "舞台燈"),
    ):
        # 舞台燈照舊任何時代：環境補牌偏好「只屬於這個時代」的字，標成現代會讓它
        # 跟原本的手電筒一樣吃掉一成四的現代圖（Opus 2026-10-12 實測）。
        A(_row(tag, zh, e, mutex="lighting"))
    A(_row("nature", "大自然", e, mutex="place"))
    A(_row("house", "房屋", e, mutex="place"))

    # 眼睛。表情符號與三白眼名字裡沒有 eye，分組靠 EYE_MARK。
    for tag, zh in (
        ("^ ^", "瞇眼笑"), ("> <", "緊閉眼"), ("@ @", "暈眩眼"), ("+ +", "十字眼"),
        ("= =", "無言眼"), ("o o", "圓眼"), (";o", "單眨眼"),
        ("black sclera", "黑眼白"), ("yellow sclera", "黃眼白"),
        ("white eyes", "全白眼"), ("two-tone eyes", "雙色眼"), ("blank eyes", "空洞眼"),
        ("one-eyed", "獨眼"), ("extra eyes", "多眼"), ("no eyes", "無眼睛"),
        ("gradient eyes", "漸層眼"), ("third eye", "第三眼"),
        ("solid oval eyes", "橢圓眼"), ("eyeball", "眼球"),
        ("red pupils", "紅瞳孔"), ("pink pupils", "粉瞳孔"),
        ("no pupils", "無瞳孔"), ("constricted pupils", "縮瞳"),
        ("cross-shaped pupils", "十字瞳"), ("diamond-shaped pupils", "菱形瞳"),
        ("mismatched pupils", "異瞳"), ("sanpaku", "三白眼"),
        ("hair over eyes", "髮遮眼"),
    ):
        # 眼睛的表情符號一張只畫一種（以前瞇眼笑、緊閉眼、暈眩眼可以疊在同一張）。
        # 瞇眼笑、緊閉眼、無言眼是閉著的眼睛，engine.js 的 CLOSED_EYES 照閉眼擋視線（Opus 2026-10-12）。
        emote = tag in {"^ ^", "> <", "@ @", "+ +", "= =", "o o", ";o"}
        A(_row(tag, zh, f, extra=("eye_emote",) if emote else ()))
    A(_row("looking afar", "遠望", p, mutex="gaze"))
    A(_row("looking at object", "看物品", p, mutex="gaze"))

    # 髮色外觀，不佔髮色格，才能跟底色疊。
    for tag, zh in (
        ("colored tips", "挑染"), ("alternate hair color", "換髮色"), ("roots (hair)", "髮根色"),
    ):
        A(_row(tag, zh, f))

    # 主髮型佔 hair_style。瀏海與可疊的細節不佔。
    A(_row("short hair with long locks", "短髮長鬢", f, mutex="hair_style", implies=("short hair", "sidelocks")))
    A(_row("low-tied long hair", "低綁長髮", f, mutex="hair_style", implies=("long hair",)))
    A(_row("short ponytail", "短馬尾", f, mutex="hair_style", implies=("ponytail", "short hair")))
    A(_row("half up braid", "半綁編髮", f, mutex="hair_style", implies=("braid",)))
    A(_row("crown braid", "皇冠辮", f, mutex="hair_style", implies=("braid",)))
    A(_row("low twin braids", "低雙辮", f, mutex="hair_style", implies=("twin braids",)))
    A(_row("cone hair bun", "錐形髻", f, mutex="hair_style", implies=("hair bun",)))
    A(_row("braided bun", "編髮髻", f, mutex="hair_style", implies=("hair bun",)))
    A(_row("topknot", "頭頂髻", f, mutex="hair_style", implies=("hair bun",)))
    A(_row("multi-tied hair", "多段綁髮", f, mutex="hair_style"))
    for tag, zh, implies in (
        ("huge ahoge", "超大呆毛", ("ahoge",)),
        ("heart ahoge", "愛心呆毛", ("ahoge",)),
        ("single sidelock", "單側鬢髮", ("sidelocks",)),
        ("single hair intake", "單根翹髮", ("hair intakes",)),
    ):
        A(_row(tag, zh, f, implies=implies))
    for tag, zh in (
        ("alternate hairstyle", "換髮型"), ("blunt ends", "齊髮尾"),
        ("curtained hair", "簾式髮"),
        ("flipped hair", "外翹髮"), ("asymmetrical hair", "不對稱髮"),
        ("big hair", "大髮量"), ("convenient hair", "方便髮"),
        ("hair pulled back", "後梳髮"),
    ):
        A(_row(tag, zh, f))
    # 放下髮跟馬尾、包頭、辮子這些綁法是同一格（hair_style），也跟盤髮互斥。
    # 以前兩個都沒有格子，1500 張裡有「放下髮＋馬尾」「盤髮＋放下髮」（Opus 2026-10-12）。
    A(_row("hair down", "放下髮", f, mutex="hair_style", extra=("hair_loose",)))
    A(_row("hair up", "盤髮", f, extra=("hair_loose",)))
    # 編髮環跟既有的髮環（hair rings）一樣是綁起來的髮型，佔同一格。
    A(_row("braided hair rings", "編髮環", f, mutex="hair_style"))
    for tag, zh in (
        ("asymmetrical bangs", "不對稱瀏海"), ("long bangs", "長瀏海"),
        ("braided bangs", "編瀏海"), ("center-flap bangs", "中分翻瀏海"),
    ):
        A(_row(tag, zh, f, extra=("bangs",)))

    # 身體姿勢。坐在別人身上、手挽手要有兩人。
    # 手勢不佔站姿格：比 V、豎拇指本來就是誘惑段的動作，跟站、坐疊。
    for tag, zh in (
        ("outstretched arm", "伸單臂"), ("arm at side", "單臂垂"),
        ("knee up", "抬單膝"), ("arm behind back", "單手背後"),
        ("legs apart", "張腿"),
        ("knees together feet apart", "膝併腳開"), ("fighting stance", "戰鬥架式"),
        ("hugging object", "抱物品"),
        ("yokozuwari", "側坐"),
        ("split", "劈腿"), ("pigeon-toed", "內八"), ("midair", "騰空"),
        ("twisted torso", "扭上身"),
        ("crossed ankles", "交叉踝"),
        ("knees to chest", "抱膝"), ("toe scrunch", "蜷腳趾"),
        ("head back", "頭後仰"),
        ("flexing", "秀肌肉"), ("plantar flexion", "繃腳背"),
    ):
        A(_row(tag, zh, p, mutex="body_pose"))
    for tag, zh in (
        ("head rest", "托腮"), ("own hands clasped", "雙手交握"),
    ):
        A(_row(tag, zh, p, extra=("hand_g",)))
    for tag, zh in (
        ("claw pose", "爪手勢"), ("v over eye", "眼前比耶"),
        ("rabbit pose", "兔手勢"), ("watson cross", "華生交叉"),
    ):
        A(_row(tag, zh, p, extra=("hand_g",)))
    A(_row("sitting on person", "坐人身上", p, mutex="body_pose", needs=("pair",)))
    A(_row("locked arms", "手挽手", p, mutex="body_pose", needs=("pair",)))

    # 取景。身體部位焦點跟「畫面在講什麼」另有互斥格，不佔這一格。
    for tag, zh in (
        ("cropped torso", "裁軀幹"), ("cropped legs", "裁腿"),
        ("cropped shoulders", "裁肩膀"), ("out of frame", "出框"),
        ("foot out of frame", "腳出框"), ("eyes out of frame", "眼出框"),
        ("fake screenshot", "假截圖"), ("fake phone screenshot", "假手機圖"),
        ("viewfinder", "取景框"),
    ):
        ui = tag in {"fake screenshot", "fake phone screenshot", "viewfinder"}
        A(_row(tag, zh, p, mutex="camera", era=modern if ui else None))
    # 腳、腰臀是人物的取景，跟其他部位焦點互斥，可以跟近景、俯角疊。
    for tag, zh in (
        ("foot focus", "腳特寫"),
        ("hip focus", "腰臀特寫"),
    ):
        A(_row(tag, zh, p, mutex="part_focus"))
    # 動物、食物、載具是畫面主題，跟其他主題焦點互斥，不把鏡頭格佔走。
    A(_row("animal focus", "動物特寫", e, mutex="topic_focus"))
    A(_row("food focus", "食物特寫", e, mutex="topic_focus", implies=("food",)))
    A(_row("vehicle focus", "載具特寫", e, mutex="topic_focus"))

    # 表情佔表情格。鼻子、眉毛、滿臉紅、驚嚇線跟笑容疊，不佔。
    for tag, zh in (
        (":d", "開心張嘴"), (":o", "驚訝嘴"), (":3", "貓嘴"), (";d", "眨眼笑"),
        (":p", "吐舌笑"), (":<", "不滿嘴"), (":q", "舔嘴"), (":t", "氣嘟嘴"),
        (";)", "單眼眨"), (":>", "得意嘴"), (":/", "不屑嘴"), (">:)", "奸笑"),
        ("d:", "驚恐嘴"), ("split mouth", "分裂嘴"), ("triangle mouth", "三角嘴"),
        ("chestnut mouth", "栗子嘴"), ("sideways mouth", "歪嘴"), ("no mouth", "無嘴"),
        ("wince", "瑟縮"), ("glaring", "怒視"), ("faceless", "空白臉"),
    ):
        A(_row(tag, zh, p, mutex="expression"))
    for tag, zh, implies in (
        ("dot nose", "點鼻", ()), ("nose", "鼻子", ()), ("no nose", "無鼻", ()),
        ("raised eyebrows", "揚眉", ()), ("raised inner eyebrows", "憂眉", ()),
        ("eyebrows hidden by hair", "眉被髮遮", ()),
        ("^^^", "驚嚇線", ()), ("full-face blush", "滿臉紅", ("blush",)),
        ("multiple expressions", "多表情", ()), ("mouth drool", "嘴角涎", ("drooling",)),
    ):
        A(_row(tag, zh, p, implies=implies))

    return rows


if __name__ == "__main__":
    got = build()
    print(len(got), len({r["tag"] for r in got}), len({r["zh"] for r in got}))
