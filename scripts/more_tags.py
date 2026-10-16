# -*- coding: utf-8 -*-
"""2026-10-12 more_general_tags.csv。

CSV 的類別、gate、heat、mutex 是從同組抄來的，不能照用。這裡逐項重設。
Danbooru 皆為現役 category 0、有圖、沒有別名。

不收這五個（沒有畫面，或會把所有「拿著」都吸進去）：
作品內地點、真實地點、拿著、時尚、聲優。
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
    c, f, p, e, q = "clothing", "feature", "pose", "env", "quality"
    g, acc = "garment", "accessory"
    modern = ["modern"]
    rows = []
    A = rows.append

    # 食物、植物、飲料當父項，跟既有的花一樣，自己也能被抽到。
    # 時代（Opus 2026-10-12 驗收）：百奇、漢堡、罐子、吸管、聖代只有現代；
    # 馬卡龍、三明治從維多利亞起。其餘照舊任何時代。
    food_era = {
        "pocky": modern, "burger": modern, "can": modern, "drinking straw": modern,
        "parfait": modern, "macaron": ["victorian", "modern"], "sandwich": ["victorian", "modern"],
    }
    for tag, zh, implies in (
        ("food", "食物", ()), ("fruit", "水果", ("food",)), ("plant", "植物", ()),
        ("drink", "飲料", ()), ("alcohol", "酒類", ("drink",)),
        ("plate", "盤子", ()), ("tray", "托盤", ()), ("bowl", "碗具", ()),
        ("spoon", "湯匙", ()), ("fork", "叉子", ()), ("can", "罐子", ()),
        ("drinking straw", "吸管", ()), ("ice", "冰塊", ()),
        ("pocky", "百奇", ("food",)), ("carrot", "紅蘿蔔", ("food",)),
        ("pumpkin", "南瓜", ("food",)), ("tea", "茶飲", ("drink",)),
        ("burger", "漢堡", ("food",)), ("mushroom", "蘑菇", ("food",)),
        ("cherry", "櫻桃", ("fruit",)), ("watermelon", "西瓜", ("fruit",)),
        ("peach", "桃子", ("fruit",)), ("noodles", "麵條", ("food",)),
        ("dango", "糰子", ("food",)), ("orange (fruit)", "柳橙", ("fruit",)),
        ("heart-shaped chocolate", "愛心巧克力", ("chocolate",)),
        ("macaron", "馬卡龍", ("food",)), ("parfait", "聖代", ("food",)),
        ("sandwich", "三明治", ("food",)), ("pancake", "鬆餅", ("food",)),
        ("cupcake", "杯子蛋糕", ("cake",)), ("wagashi", "和菓子", ("food",)),
        ("rice", "米飯", ("food",)), ("ice cream cone", "甜筒", ("ice cream",)),
        ("coffee mug", "咖啡杯", ("coffee", "mug")),
        ("beer mug", "啤酒杯", ("beer", "mug")),
        ("birthday cake", "生日蛋糕", ("cake",)),
    ):
        A(_row(tag, zh, e, implies=implies, era=food_era.get(tag)))
    for tag, zh, implies in (
        ("bouquet", "花束", ("flower",)), ("hibiscus", "扶桑花", ("flower",)),
        ("lily (flower)", "百合花", ("flower",)), ("spider lily", "彼岸花", ("flower",)),
        ("hydrangea", "繡球花", ("flower",)),
        # 玫瑰的時代是維多利亞跟中世紀。花瓣不帶玫瑰，才不會被收成那個時代。
        ("rose petals", "玫瑰花瓣", ("flower",)),
    ):
        A(_row(tag, zh, e, implies=implies))

    # 節慶字會在畫面上加字。新年快樂、聖誕快樂帶出既有的節日。
    for tag, zh, implies in (
        ("happy birthday", "生日快樂", ()), ("birthday", "生日", ()),
        ("anniversary", "週年紀念", ()), ("valentine", "情人節", ()),
        ("happy new year", "新年快樂", ("new year",)),
        ("merry christmas", "聖誕快樂", ("christmas",)),
        ("jack-o'-lantern", "南瓜燈", ("pumpkin", "halloween")),
    ):
        A(_row(tag, zh, e, era=modern, implies=implies))

    A(_row("airplane", "飛機", e, mutex="place", era=modern, implies=("outdoors",)))
    A(_row("scarlet devil mansion", "紅魔館", e, mutex="place", implies=("indoors",)))
    A(_row("cable", "纜線", e, era=modern))
    for tag, zh in (("stool", "凳子"), ("cushion", "坐墊"), ("armchair", "扶手椅")):
        A(_row(tag, zh, e))
    A(_row("ball", "球類", e))
    A(_row("beachball", "海灘球", e, era=modern))
    A(_row("cosmetics", "化妝品", e))
    A(_row("hand mirror", "手鏡", e, implies=("mirror",)))
    # 二戰是題材，不是一套衣服。
    A(_row("world war ii", "二戰", e, era=modern))

    # 特效佔特效格。彩色的火是火的一種；爆炸、螢火蟲、人魂不是。
    for tag, zh, implies in (
        ("explosion", "爆炸", ()),
        ("burning", "燃燒", ("fire",)),
        ("pyrokinesis", "操火", ("fire",)),
        ("purple fire", "紫色火焰", ("fire",)),
        ("breathing fire", "噴火", ("fire",)),
        ("fireflies", "螢火蟲", ()),
        ("aerial fireworks", "空中煙火", ("fireworks",)),
        ("hitodama", "人魂", ()),
    ):
        A(_row(tag, zh, e, mutex="effect", implies=implies, era=modern if tag == "aerial fireworks" else None))
    # 黑暗、樹蔭佔光線格。窗影和彩色陰影是畫上去的，跟光源疊。
    A(_row("darkness", "黑暗", e, mutex="lighting", implies=("dark",)))
    A(_row("tree shade", "樹蔭", e, mutex="lighting", implies=("shade",)))
    # 手電筒是拿在手上的東西，跟手機同一格（held_prop），不當光線。
    # 放在光線格時它是現代唯一的「本時代」光源，佔了一成一的圖（Opus 2026-10-12）。
    A(_row("flashlight", "手電筒", e, mutex="held_prop", era=modern))
    A(_row("window shadow", "窗影", e))
    A(_row("colored shadow", "彩色陰影", e))
    for tag, zh, implies in (
        ("crescent moon", "新月", ("moon",)),
        ("gradient sky", "漸層天空", ()),
        ("purple sky", "紫天空", ()),
        ("red sky", "紅天空", ()),
    ):
        A(_row(tag, zh, e, implies=implies))

    # 膚色跟有色皮膚同一格。白皮膚是純白，不是白皙。花紋膚色跟底色疊。
    for tag, zh in (
        ("white skin", "白皮膚"), ("blue skin", "藍皮膚"), ("grey skin", "灰皮膚"),
        ("red skin", "紅皮膚"), ("purple skin", "紫皮膚"), ("pink skin", "粉紅皮膚"),
        ("yellow skin", "黃皮膚"), ("orange skin", "橘皮膚"), ("aqua skin", "水藍皮膚"),
        ("metal skin", "金屬皮膚"),
    ):
        A(_row(tag, zh, f, implies=("colored skin",), extra=("skin_tone",)))
    for tag, zh in (
        ("multicolored skin", "多色皮膚"), ("two-tone skin", "雙色皮膚"),
        ("colored extremities", "四肢末端異色"), ("patchwork skin", "拼接皮膚"),
        ("albino", "白化"),
    ):
        A(_row(tag, zh, f))
    A(_row("body fur", "獸體毛", f))
    A(_row("scales", "鱗片", f))
    A(_row("sticker on face", "臉上貼紙", f, era=modern))
    A(_row("lipstick mark on face", "臉上唇印", f, implies=("lipstick mark",)))

    # 獸耳佔耳朵格。垂耳、多耳、獸耳化跟某一種耳朵疊。
    for tag, zh in (
        ("mouse ears", "鼠耳"), ("cow ears", "牛耳"), ("tiger ears", "虎耳"),
        ("raccoon ears", "狸耳"), ("bear ears", "熊耳"), ("lion ears", "獅耳"),
        ("deer ears", "鹿耳"), ("sheep ears", "羊耳"), ("goat ears", "山羊耳"),
        ("squirrel ears", "松鼠耳"), ("bat ears", "蝙蝠耳"), ("panda ears", "熊貓耳"),
    ):
        A(_row(tag, zh, f, mutex="animal_ear", implies=("animal ears",)))
    A(_row("extra ears", "多對耳朵", f))
    A(_row("floppy ears", "垂耳", f, implies=("animal ears",)))
    A(_row("kemonomimi mode", "獸耳化", f, implies=("animal ears",)))
    A(_row("long pointy ears", "長尖耳", f, implies=("pointy ears",)))
    A(_row("tail wagging", "搖尾巴", f))

    # 翅膀種類跟顏色分開，才可以是「白色的羽毛翅膀」。
    for tag, zh in (("white wings", "白色翅膀"), ("black wings", "黑色翅膀"), ("red wings", "紅色翅膀")):
        A(_row(tag, zh, f, implies=("wings",), extra=("wing_color",)))
    for tag, zh in (
        ("ice wings", "冰翼"), ("insect wings", "昆蟲翅膀"), ("mechanical wings", "機械翅膀"),
        ("energy wings", "能量翅膀"), ("crystal wings", "水晶翅膀"), ("dragon wings", "龍翼"),
    ):
        A(_row(tag, zh, f, implies=("wings",), extra=("wing_type",)))
    A(_row("bird wings", "鳥翼", f, implies=("feathered wings",), extra=("wing_type",)))
    for tag, zh in (
        ("low wings", "低位翅膀"), ("detached wings", "分離翅膀"),
        ("asymmetrical wings", "不對稱翅"), ("transparent wings", "透明翅膀"),
    ):
        A(_row(tag, zh, f, implies=("wings",)))
    A(_row("single wing", "單翼", f, implies=("wings",), extra=("wing_number",)))
    A(_row("multiple wings", "多重翅膀", f, implies=("wings",), extra=("wing_number",)))

    # 整隻生物會換成非人。史萊姆本體不帶史萊姆娘。龍族不帶龍娘。
    for tag, zh, implies, extra in (
        ("monster", "怪物", (), ()),
        ("dragon", "龍族", (), ()),
        ("eastern dragon", "東方龍", ("dragon",), ()),
        ("western dragon", "西方龍", ("dragon",), ()),
        ("angel", "天使", ("angel wings",), ()),
        ("giant", "巨人族", (), ()),
        ("jiangshi", "中式殭屍", (), ()),
        ("slime (creature)", "史萊姆體", (), ()),
        ("unicorn", "獨角獸體", (), ()),
        ("tengu", "天狗", (), ()),
        # 詞庫裡的半人馬是男性、會帶出 monster boy。半人馬型不帶它。
        ("centauroid", "半人馬型", (), ()),
        ("robot", "機械體", (), ()),
        ("nekomata", "妖貓又", ("cat ears",), ("animal_ear",)),
        ("kyuubi", "九尾狐", ("fox ears",), ("animal_ear",)),
    ):
        A(_row(tag, zh, f, mutex="race", implies=implies, extra=extra,
              era=modern if tag == "robot" else None))

    # 嘴唇是部位。口紅色、眼影色各佔一格。腳甲油不跟手指甲搶顏色。
    A(_row("lips", "嘴唇", f))
    A(_row("long fingernails", "長指甲", f, implies=("fingernails",)))
    A(_row("toenail polish", "腳甲油", f, gate="female", implies=("nail polish",)))
    for tag, zh in (
        ("pink lips", "粉紅唇"), ("purple lips", "紫唇"), ("black lips", "黑唇"),
        ("blue lips", "藍唇"), ("green lips", "綠唇"),
    ):
        A(_row(tag, zh, f, gate="female", implies=("lipstick",), extra=("lip_color",)))
    for tag, zh in (
        ("red eyeshadow", "紅眼影"), ("pink eyeshadow", "粉眼影"),
        ("blue eyeshadow", "藍眼影"), ("purple eyeshadow", "紫眼影"),
        ("black eyeshadow", "黑眼影"),
    ):
        A(_row(tag, zh, f, gate="female", implies=("eyeshadow",), extra=("eyeshadow_color",)))
    A(_row("facepaint", "臉部彩繪", f))
    A(_row("hikimayu", "引眉", f))
    A(_row("runny makeup", "暈妝", f, implies=("makeup",)))
    A(_row("aegyo sal", "臥蠶", f))
    A(_row("blinking", "眨眼睛", f))

    # 傳統修女是那套衣服，不是職業。西部牛仔不帶女牛仔。
    A(_row("traditional nun", "傳統修女", c, mutex="onepiece", layer=g, gate="female", implies=("nun",)))
    A(_row("cowboy western", "西部牛仔", f, mutex="job"))
    A(_row("spacesuit", "太空服", c, mutex="onepiece", layer=g, era=modern, implies=("bodysuit",)))

    # 手套。顏色跟款式以後綴帶出手套。單手、連指要自己帶。
    for tag, zh in (
        ("white gloves", "白手套"), ("red gloves", "紅手套"), ("brown gloves", "棕手套"),
        ("blue gloves", "藍手套"), ("purple gloves", "紫手套"), ("pink gloves", "粉手套"),
        ("half gloves", "半掌手套"), ("paw gloves", "肉球手套"),
        ("fur-trimmed gloves", "毛邊手套"),
    ):
        A(_row(tag, zh, c, mutex="hands", layer=acc))
    A(_row("single glove", "單手手套", c, mutex="hands", layer=acc, implies=("gloves",)))
    A(_row("mittens", "連指手套", c, mutex="hands", layer=acc, implies=("gloves",)))
    A(_row("partially fingerless gloves", "半露指手套", c, mutex="hands", layer=acc,
          implies=("fingerless gloves",)))

    # 頸飾。頸環只有女性。領巾、領結、領帶的時代跟父項走。
    for tag, zh in (
        ("black choker", "黑頸環"), ("white choker", "白頸環"), ("red choker", "紅頸環"),
        ("frilled choker", "荷葉頸環"), ("ribbon choker", "緞帶頸環"),
    ):
        A(_row(tag, zh, c, mutex="neckwear", layer=acc, gate="female", implies=("choker",)))
    for tag, zh in (
        ("red necktie", "紅領帶"), ("green necktie", "綠領帶"), ("yellow necktie", "黃領帶"),
        ("red bowtie", "紅領結"), ("blue bowtie", "藍領結"),
        ("pink bowtie", "粉領結"), ("white bowtie", "白領結"),
    ):
        A(_row(tag, zh, c, mutex="neckwear", layer=acc))
    for tag, zh in (
        ("red neckerchief", "紅頸巾"), ("yellow neckerchief", "黃頸巾"),
        ("blue neckerchief", "藍頸巾"), ("black neckerchief", "黑頸巾"),
    ):
        A(_row(tag, zh, c, mutex="neckwear", layer=acc, implies=("neckerchief",)))
    for tag, zh in (("yellow ascot", "黃領巾"), ("white ascot", "白領巾"), ("red ascot", "紅領巾")):
        A(_row(tag, zh, c, mutex="neckwear", layer=acc, implies=("ascot",)))
    for tag, zh in (
        ("red scarf", "紅圍巾"), ("white scarf", "白圍巾"),
        ("blue scarf", "藍圍巾"), ("black scarf", "黑圍巾"),
    ):
        A(_row(tag, zh, c, mutex="neckwear", layer=acc, implies=("scarf",)))
    A(_row("neck bell", "頸鈴", c, mutex="neckwear", layer=acc, implies=("bell",)))
    A(_row("lanyard", "掛繩", c, mutex="neckwear", layer=acc, era=modern))
    A(_row("pearl necklace", "珍珠項鍊", c, mutex="jewelry", layer=acc))
    A(_row("chain necklace", "鍊條項鍊", c, mutex="jewelry", layer=acc))
    A(_row("magatama", "勾玉", c, mutex="jewelry", layer=acc))

    for tag, zh in (
        ("round eyewear", "圓框眼鏡"), ("semi-rimless eyewear", "半框眼鏡"),
        ("black-framed eyewear", "黑框眼鏡"), ("red-framed eyewear", "紅框眼鏡"),
        ("under-rim eyewear", "下框眼鏡"), ("rimless eyewear", "無框眼鏡"),
    ):
        A(_row(tag, zh, c, mutex="eyewear", layer=acc, implies=("glasses",)))
    A(_row("monocle", "單片眼鏡", c, mutex="eyewear", layer=acc, era=["modern", "victorian"]))
    A(_row("bespectacled", "戴眼鏡", c, mutex="eyewear", layer=acc, implies=("glasses",)))
    A(_row("earphones", "入耳塞", c, mutex="headwear", layer=acc, era=modern, extra=("ear_audio",)))
    A(_row("head wreath", "花冠", c, mutex="headwear", layer=acc, implies=("flower",)))

    # 印花襯衫佔上衣。其餘花紋跟穿搭疊在衣服上，不佔上衣、也不當時代套裝。
    A(_row("print shirt", "印花襯衫", c, mutex="top", layer=g, era=modern))
    A(_row("print bow", "印花結", c, layer=acc, implies=("bow",)))
    # 花紋、印花、穿搭風格一張圖只取一種（print_style）。它們沒有互斥格又會被當成
    # 「這個時代的衣服」優先挑，以前江戶七成的圖印著和風花紋，羽織、袴、木屐和腰帶
    # 被擠掉一半（腰帶 3000 張剩 9，Opus 2026-10-12）。
    ps = ("print_style",)
    # 和風花紋現代衣服也印，不鎖在江戶。但也不是中世紀、古希臘的衣服：
    # 任何時代會讓它們佔掉江戶的衣服額度（江戶每張的時代服從 2.6 掉到 2.26），
    # 又跑進歐洲場景。江戶＋現代（Opus 2026-10-12）。回紋同理是古希臘＋現代。
    for tag, zh in (
        ("egasumi", "霞紋"), ("seigaiha", "青海波"), ("yagasuri", "矢絣"),
        ("sakuramon", "櫻紋"), ("kikkoumon", "龜甲紋"), ("asa no ha (pattern)", "麻葉紋"),
    ):
        A(_row(tag, zh, c, layer=g, era=["edo", "modern"], extra=ps))
    A(_row("meandros", "回紋", c, layer=g, era=["ancient_greece", "modern"], extra=ps))
    print_era = {"camouflage": modern, "flag print": modern, "pinstripe pattern": ["victorian", "modern"]}
    for tag, zh in (
        ("pinstripe pattern", "細條紋"), ("camouflage", "迷彩"), ("tiger print", "虎紋"),
        ("flag print", "國旗印花"), ("food print", "食物印花"), ("leopard print", "豹紋"),
        ("leaf print", "葉子印花"), ("bat print", "蝙蝠印花"), ("tiger stripes", "虎斑紋"),
        ("cross print", "十字印花"), ("cherry blossom print", "櫻花印花"),
        ("crescent print", "新月印花"), ("bear print", "熊印花"),
        ("honeycomb (pattern)", "蜂巢紋"), ("musical note print", "音符印花"),
        ("bird print", "鳥印花"),
    ):
        A(_row(tag, zh, c, layer=g, era=print_era.get(tag), extra=ps))
    for tag, zh, era in (
        ("winter clothes", "冬裝", None), ("arabian clothes", "阿拉伯服", None),
        ("ainu clothes", "愛努服", ["edo", "modern"]),
        ("goth fashion", "哥德風", modern), ("jirai kei", "地雷系", modern),
        ("yume kawaii", "夢幻可愛風", modern), ("ouji fashion", "王子風", modern),
        ("biker clothes", "機車服", modern), ("y2k fashion", "千禧風", modern),
        ("cyber fashion", "賽博風", modern), ("streetwear", "街頭風", modern),
        ("punk", "龐克", modern),
    ):
        A(_row(tag, zh, c, layer=g, era=era, extra=ps))

    A(_row("abstract", "抽象", q))
    A(_row("faux retro artstyle", "仿復古畫風", q, implies=("retro artstyle",)))
    A(_row("retrofuturism", "復古未來", q))

    # 手勢跟「拿著」不佔站姿，跟比 V 一樣放在誘惑段，並佔住手。
    for tag, zh, implies in (
        ("clenched hands", "雙手握拳", ("clenched hand",)),
        ("open hand", "張開手掌", ()),
        ("fox shadow puppet", "狐狸手影", ()),
        ("steepled fingers", "指尖相抵", ()),
        ("pointing at self", "指著自己", ("pointing",)),
        ("pointing up", "指向上方", ("pointing",)),
        ("hand on own arm", "手扶手臂", ()),
    ):
        A(_row(tag, zh, p, implies=implies, extra=("hand_g",)))
    A(_row("shouting", "大喊", p, mutex="expression"))
    # 看手機要有手機在畫面上（Opus 2026-10-12：以前 84 張裡 81 張沒有手機）。
    A(_row("looking at phone", "看手機", p, mutex="gaze", era=modern, implies=("cellphone",)))
    A(_row("looking through own legs", "胯下回看", p, mutex="body_pose"))
    for tag, zh in (("talking", "說話"), ("pouring", "倒水"), ("thinking", "思考"), ("battle", "戰鬥"), ("riding", "騎乘")):
        A(_row(tag, zh, p, mutex="activity"))
    A(_row("broom riding", "騎掃帚", p, mutex="activity", implies=("riding", "broom", "holding broom")))
    A(_row("applying makeup", "化妝中", p, mutex="activity", gate="female"))

    hold = (
        ("holding own hair", "抓自己頭髮", ()),
        ("holding food", "拿著食物", ("food",)),
        ("holding book", "拿著書", ("book",)),
        ("holding flower", "拿著花", ("flower",)),
        ("holding bag", "拿著包包", ("bag",)),
        # 長柄武器和盾的時代不含現代。只留動作，不把時代鎖死。
        ("holding polearm", "拿著長柄", ()),
        ("holding bottle", "拿著瓶子", ("bottle",)),
        ("holding microphone", "拿著麥克風", ("microphone",)),
        ("holding tray", "端著托盤", ("tray",)),
        ("holding instrument", "拿著樂器", ()),
        ("holding bouquet", "捧著花束", ("bouquet",)),
        ("holding animal", "抱著動物", ()),
        ("holding stuffed toy", "抱著布偶", ("stuffed toy",)),
        ("holding plate", "端著盤子", ("plate",)),
        ("holding fruit", "拿著水果", ("fruit",)),
        ("holding fork", "拿著叉子", ("fork",)),
        ("holding spoon", "拿著湯匙", ("spoon",)),
        ("holding chopsticks", "拿著筷子", ("chopsticks",)),
        ("holding candy", "拿著糖果", ("candy",)),
        ("holding bow (weapon)", "拿著弓", ("bow (weapon)",)),
        ("holding paper", "拿著紙", ()),
        ("holding card", "拿著卡片", ()),
        ("holding camera", "拿著相機", ("camera",)),
        ("holding pen", "拿著筆", ("pen",)),
        ("holding broom", "拿著掃帚", ("broom",)),
        ("holding box", "拿著盒子", ()),
        ("holding popsicle", "拿著冰棒", ("popsicle",)),
        ("holding controller", "拿著手把", ("game controller",)),
        ("holding drink", "拿著飲料", ("drink",)),
        ("holding mask", "拿著面具", ("mask",)),
        ("holding towel", "拿著毛巾", ("towel",)),
        ("holding paintbrush", "拿著畫筆", ("paintbrush",)),
        ("holding basket", "提著籃子", ("basket",)),
        ("holding cat", "抱著貓", ()),
        ("holding ball", "拿著球", ("ball",)),
        ("holding shield", "拿著盾", ()),
    )
    for tag, zh, implies in hold:
        A(_row(tag, zh, p, implies=implies, extra=("hand_g",)))

    return rows


if __name__ == "__main__":
    got = build()
    print(len(got), len({r["tag"] for r in got}), len({r["zh"] for r in got}))
