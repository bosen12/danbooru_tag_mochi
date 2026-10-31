"""Assign a display subgroup to each tag. One source of truth for merge + UI order."""

from __future__ import annotations

from clothing_tags import GROUP_OF as CLOTHING_GROUPS
from env_tags import GROUP_OF as ENV_GROUPS
from pose_tags import GROUP_OF as POSE_GROUPS
from quality_tags import GROUP_OF as QUALITY_GROUPS

GROUP_ORDER = {
    "quality": ["fixed", "style", "boost"],
    "subject": ["count_f", "count_m", "character", "extra"],
    "feature": [
        "hair_len",
        "hair_color",
        "hair_style",
        "eyes",
        "body_f",
        "body_m",
        "race",
        "skin",
        "makeup",
        "job",
        "other",
    ],
    "pose": ["body", "camera", "gaze", "face", "tease", "flash", "sex", "activity", "other"],
    "clothing": [
        "nude",
        "era",
        "onepiece",
        "top",
        "bottom",
        "underwear",
        "legs",
        "feet",
        "outer",
        "fabric",
        "acc",
    ],
    "env": ["inout", "place", "background", "furniture", "time", "weather", "sky", "light", "effect", "other"],
}

GROUP_ZH = {
    "fixed": "固定",
    "style": "風格",
    "boost": "解析／美感",
    "count_f": "人數・女",
    "count_m": "人數・男",
    "character": "角色",
    "extra": "其他",
    "hair_len": "髮長",
    "hair_color": "髮色",
    "hair_style": "髮型",
    "eyes": "眼睛",
    "body_f": "體型・女",
    "body_m": "體型・男",
    "race": "種族・男",
    "skin": "膚質／標記",
    "body": "身體姿勢",
    "camera": "鏡頭",
    "gaze": "視線",
    "face": "表情",
    "tease": "誘惑",
    "flash": "走光",
    "sex": "性愛",
    "activity": "活動",
    "makeup": "妝容",
    "job": "職業",
    "nude": "裸身",
    "era": "時代服裝",
    "onepiece": "連身／套裝",
    "top": "上衣",
    "bottom": "下身",
    "underwear": "內衣",
    "legs": "腿襪",
    "feet": "鞋履",
    "outer": "外套",
    "fabric": "袖口／材質",
    "acc": "飾品",
    "inout": "室內外",
    "place": "地點",
    "furniture": "坐臥面",
    "time": "晝夜",
    "weather": "天氣",
    "sky": "天空",
    "light": "光線",
    "background": "背景",
    "effect": "畫面特效",
    "other": "其他",
}

# Parent garments whose mutex is cleared (umbrella). Keep them next to children.
UMBRELLA_GROUP = {
    "dress": "onepiece",
    "school uniform": "onepiece",
    "leotard": "onepiece",
    "bodysuit": "onepiece",
    "swimsuit": "onepiece",
    "bikini": "onepiece",
    "one-piece swimsuit": "onepiece",
    "kimono": "era",
    "yukata": "era",
    "chinese clothes": "era",
    "japanese clothes": "era",
    "ancient greek clothes": "era",
    "armor": "era",
    "chainmail": "era",
    "shirt": "top",
    "tank top": "top",
    "sweater": "top",
    "skirt": "bottom",
    "shorts": "bottom",
    "pants": "bottom",
    "bra": "underwear",
    "panties": "underwear",
    "underwear": "underwear",
    "jacket": "outer",
    "coat": "outer",
    "cardigan": "outer",
    "thighhighs": "legs",
    "socks": "legs",
}

FABRIC = {
    "wide sleeves",
    # 古中國本來只有 wide sleeves 一個時代專屬布料細節，於是 clothingPrefer
    # 的時代層每次都只有它一個候選，七成六的畫面都是寬袖。
    "mandarin collar",
    "side slit",
    "layered clothes",
    "frills",
    "long sleeves",
    "short sleeves",
    "sleeves rolled up",
    "detached sleeves",
    "puffy sleeves",
    # 毛邊疊在衣服上，不跟「透視／乳膠」搶布料那一格。
    "fur trim",
    # 破衣疊在任何衣服上，不跟乳膠／網襪搶布料那一格。
    "torn clothes",
    # 布料與領口細節。不佔上衣格，才不會把襯衫擠掉。
    "denim",
    "shiny clothes",
    "leather",
    "satin",
    "sailor collar",
    "halterneck",
    # 疊在衣服上的說法或配件，不佔上衣／整套。沒有這組的話正常模式抽不到。
    "skin tight",
    "suspenders",
    "maid apron",
    "waist apron",
    "frilled apron",
    "oversized clothes",
    "cosplay",
    "casual",
    "lolita fashion",
    "gothic lolita",
    "halloween costume",
    "animal costume",
    "costume switch",
    "reverse outfit",
    "swimsuit under clothes",
    # 拉鍊和衣服上的血疊在衣服上。破襯衫、破裙子自己佔上衣和下身，不進這組。
    "unzipped",
    "zipper pull tab",
    "blood on clothes",
    # 鈕扣、口袋、花紋疊在衣服上，不佔上衣或下身。
    # patterned clothing 已停用且沒有後繼，不留在這組。
    "buttons",
    "animal print",
    "polka dot",
    "pocket",
    "zipper",
    "breast pocket",
    "cow print",
    # 第六輪：袖長、花紋、滾邊、領口、正裝、裸臂都疊在衣服上，不佔上衣格。
    "sleeveless",
    "striped clothes",
    "clothing cutout",
    "puffy short sleeves",
    "puffy long sleeves",
    "sleeves past wrists",
    "juliet sleeves",
    "strapless",
    "plaid clothes",
    "floral print",
    "frilled sleeves",
    "ribbon trim",
    "lace trim",
    "high collar",
    "layered sleeves",
    "formal clothes",
    "fur collar",
    "highleg",
    "bare arms",
    # 2026-10-12：袖子的顏色與裁法疊在衣服上，不佔上衣。無袖外套／毛衣／和服不在這裡。
    "white sleeves",
    "black sleeves",
    "blue sleeves",
    "red sleeves",
    "purple sleeves",
    "pink sleeves",
    "green sleeves",
    "grey sleeves",
    "ribbon-trimmed sleeves",
    "sleeve cuffs",
    "fur-trimmed sleeves",
    "striped sleeves",
    "torn sleeves",
    "short over long sleeves",
    "single sleeve",
    "single detached sleeve",
    "sleeves pushed up",
    "three-quarter sleeves",
    "sleeves past fingers",
    "puffy detached sleeves",
    "gold trim",
    "lapels",
    "legwear garter",
    # 2026-10-12：花紋和穿搭風格疊在衣服上。印花襯衫是上衣，印花結是蝴蝶結，不在這裡。
    "pinstripe pattern",
    "camouflage",
    "tiger print",
    "flag print",
    "food print",
    "leopard print",
    "leaf print",
    "egasumi",
    "bat print",
    "tiger stripes",
    "cross print",
    "cherry blossom print",
    "crescent print",
    "seigaiha",
    "yagasuri",
    "meandros",
    "bear print",
    "honeycomb (pattern)",
    "sakuramon",
    "musical note print",
    "asa no ha (pattern)",
    "bird print",
    "kikkoumon",
    "winter clothes",
    "goth fashion",
    "jirai kei",
    "yume kawaii",
    "arabian clothes",
    "indian clothes",
    "ouji fashion",
    "biker clothes",
    "ainu clothes",
    "y2k fashion",
    "cyber fashion",
    "streetwear",
    "punk",
}

MAKEUP = {
    "makeup",
    "lipstick",
    "nail polish",
    "red nails",
    "pink nails",
    "eyeliner",
    "mascara",
    "red lips",
    "fingernails",
    "black nails",
    "blue nails",
    # 2026-10-12：帶 eye 的眼影會先被眼睛規則收走，不必列在這裡。
    "long fingernails",
    "toenail polish",
    "facepaint",
    "hikimayu",
    "runny makeup",
    "pink lips",
    "purple lips",
    "black lips",
    "blue lips",
    "green lips",
}

BODY_ANY = {
    "collarbone",
    "navel",
    "armpits",
    "midriff",
    "toned",
    "plump",
    "skinny",
    "long legs",
    # boob 不含 breast，子字串規則不會把它們收進 body_f。
    "sideboob",
    "underboob",
    "backboob",
    "cleft of venus",
    "stomach",
    # 名字裡沒有 breast／nipple，子字串規則收不進 body_f。
    "self milking",
    "lactating into container",
}

SKY = {
    "sky",
    "blue sky",
    "orange sky",
    "starry sky",
    "cloudy sky",
    "starry sky background",
    "cloud",
    "aurora",
    "moon",
    "milky way",
    "clear sky",
    "star (sky)",
    "crescent moon",
    "gradient sky",
    "purple sky",
    "red sky",
    "sky focus",
}

HAIR_STYLE = {
    "ponytail",
    "high ponytail",
    "side ponytail",
    "twintails",
    "braid",
    "twin braids",
    "single braid",
    "low ponytail",
    "braided ponytail",
    "folded ponytail",
    "low twintails",
    "half updo",
    "hair intakes",
    "messy hair",
    "ahoge",
    "blunt bangs",
    "swept bangs",
    "sidelocks",
    "hime cut",
    "hair bun",
    "double bun",
    "single hair bun",
    "drill hair",
    "wavy hair",
    "straight hair",
    "curly hair",
    "parted hair",
    "hair over one eye",
    "hair between eyes",
    "hair over shoulder",
    # 細節跟主髮型疊。往後梳、莫霍克、臟辮、爆炸頭另外佔 hair_style 格。
    "antenna hair",
    "hair flaps",
    "bangs pinned back",
    "undercut",
    "glowing hair",
    "hair slicked back",
    "mohawk",
    "dreadlocks",
    "afro",
    "cornrows",
    "spiked hair",
    "hair behind ear",
    # 2026-10-12：跟主髮型疊的細節。主髮型自己佔 hair_style 格，不進這組。
    "alternate hairstyle",
    "blunt ends",
    "curtained hair",
    "hair down",
    "flipped hair",
    "asymmetrical hair",
    "hair up",
    "braided hair rings",
    "big hair",
    "convenient hair",
    "hair pulled back",
    "huge ahoge",
    "heart ahoge",
    "single sidelock",
    "single hair intake",
}

HAIR_COLOR_LOOK = {
    "gradient hair",
    "streaked hair",
    "two-tone hair",
    "colored inner hair",
    "split-color hair",
    "colored tips",
    "alternate hair color",
    "roots (hair)",
}

BODY_HAIR = {
    "pubic hair": "body_f",
    "female pubic hair": "body_f",
    "male pubic hair": "body_m",
    "leg hair": "body_m",
    "arm hair": "body_m",
    "chest hair": "body_m",
    "facial hair": "body_m",
}

FACE = {
    "smile",
    "seductive smile",
    "smirk",
    "grin",
    "open mouth",
    "parted lips",
    "tongue out",
    "biting own lip",
    "naughty face",
    "half-closed eyes",
    "embarrassed",
    "shy",
    "aroused",
    "ahegao",
    "torogao",
    "rolling eyes",
    "orgasm",
    "one eye closed",
    "heavy breathing",
    "fucked silly",
    "come hither",
    "licking lips",
    "frown",
    "light smile",
    "expressionless",
    "pout",
    "angry",
    "sad",
    "crying",
    "tearing up",
    "drooling",
    "moaning",
    "clenched teeth",
    "sparkling eyes",
    "empty eyes",
    "sleepy",
    "serious",
    "happy",
    "surprised",
    "scared",
    "smug",
    "nervous",
    "evil smile",
    "crazy smile",
    "annoyed",
    "jitome",
    "crazy eyes",
    "bored",
    "confident",
    "wide-eyed",
    "laughing",
    "yawning",
    "raised eyebrow",
    "upper teeth only",
    "wavy mouth",
    "shaded face",
    # 2026-10-12：跟笑容疊，不佔表情格。
    "dot nose",
    "nose",
    "no nose",
    "raised eyebrows",
    "raised inner eyebrows",
    "eyebrows hidden by hair",
    "^^^",
    "full-face blush",
    "multiple expressions",
    "mouth drool",
}

SKIN = {
    "blush",
    "body blush",
    "sweat",
    "shiny skin",
    "wet",
    "tan",
    "tanlines",
    "dark skin",
    "very dark skin",
    "pale skin",
    # 綠皮膚跟上面幾個是同一類東西（膚色），不是雜項。沒列進來的話
    # assign_group 會讓它掉進 feature/other，跟其他膚色分家。
    "green skin",
    "mole",
    "mole under eye",
    "mole under mouth",
    "nose blush",
    "freckles",
    "body freckles",
    "scar",
    "tattoo",
    "pubic tattoo",
    "heart tattoo",
    "body writing",
    "tally",
    "steaming body",
    "wet hair",
    "injury",
    "whip marks",
    "sun tattoo",
    "ass tattoo",
    "tramp stamp",
    "branded",
    "blood on face",
    "blood from mouth",
    "bite mark",
    "lipstick mark",
    "lipstick mark on neck",
    "black skin",
    "facial mark",
    "forehead mark",
    "bindi",
    "tribal tattoo",
    "scar on face",
    "mole on cheek",
    "blush stickers",
    "veins",
    "arm tattoo",
    "leg tattoo",
    "neck tattoo",
    "scar on cheek",
    "nervous sweating",
    "nosebleed",
    "colored skin",
    "light blush",
    # 2026-10-12：膚色。獸毛和鱗片是非人特徵，不進這裡。
    "white skin",
    "blue skin",
    "grey skin",
    "red skin",
    "purple skin",
    "pink skin",
    "yellow skin",
    "orange skin",
    "aqua skin",
    "metal skin",
    "multicolored skin",
    "two-tone skin",
    "colored extremities",
    "patchwork skin",
    "albino",
    "sticker on face",
    "lipstick mark on face",
}

SEX = {
    # 2026-09-15：這幾個本來被歸進「走光」，但它們不是走光。
    #
    # 原因是 assign_group() 底下那條 `"flash" in heat and "tease" not in heat`——
    # 那是拿 heat（什麼時候抽得到）去決定 group（這是什麼東西）。癡漢的 heat 是
    # ["flash","sex"]，於是就被歸成走光了，沒有人判斷過它的意思。
    #
    # 走光＝衣服意外露出來；這幾個是性接觸或自慰，跟露不露沒有關係。
    # 分級結果本來就是「只有色情」（靠 FLASH_UNDRESS_RE 裡硬塞的 chikan|grab|tweak
    # 這些字），所以這次改的是「用對的理由得到同樣的結果」——
    # 例外是 self fondling，它哪一條特例都沒對到，本來錯在敏感層
    #（該字後來查出 Danbooru 0 張、模型沒學過，已整個移除，同義的
    # grabbing own breast 留著）。
    # 2026-09-16：同一類錯的第二次。上面那次是拿 heat（什麼時候抽得到）決定
    # group（這是什麼東西）；這次是拿**名字裡有沒有 breast** 決定 —— 下面
    # assign_group() 有一條「gate=female 且 tag 含 breast → body_f」的子字串規則，
    # 於是這兩個被歸成身體特徵，而它們是性接觸與拘束。
    #
    # 後果不在分級（尾巴已經改成跟滑桿走），在「只勾活動」那一檔：日常模式借
    # tease 的池子時靠 hasExplicitContent() 扣掉情色內容，而那個函式只認 group
    # 與幾條正則，body_f 整批看不見。實測只勾活動抽 1500 張，
    # breast bondage 漏進去 58 次、grabbing another's breast 14 次，
    # 而同義的 breast grab（本來就在這個集合裡）與 groping 都是 0 次。
    #
    # 為什麼只收這兩個：拿 Danbooru 的 q+e 比例對過（倍率 = 該字比例 ÷ 全站 20.2%）
    #   grabbing another's breast 99%(4.90)、breast bondage 96.8%(4.79)
    #     —— 跟已經擋住的 breast grab 99%(4.90)、groping 97.4%(4.82) 同一級
    #   breasts on glass 73.1%(3.62)、breast lift 70.5%(3.49) —— 誘惑級，
    #     借 tease 池子本來就該進得來
    #   breast rest 39.5%(1.96)、breasts on table 22.9%(1.13) —— 普通
    "breast bondage",
    "grabbing another's breast",
    "chikan",
    "ass grab",
    "nipple tweak",
    "grinding",
    "spread pussy",
    "hand in panties",
    "masturbation through clothes",
    "sex",
    "vaginal",
    "anal",
    "cowgirl position",
    "reverse cowgirl position",
    "doggystyle",
    "standing doggystyle",
    "missionary",
    "mating press",
    "standing sex",
    "sex from behind",
    "full nelson",
    "amazon position",
    "prone bone",
    "spooning",
    "suspended congress",
    "spitroast",
    "double penetration",
    "69",
    "paizuri",
    "paizuri under clothes",
    "fellatio",
    "deepthroat",
    "irrumatio",
    "cunnilingus",
    "anilingus",
    "handjob",
    "testicle sucking",
    "testicle grab",
    "footjob",
    "sitting on face",
    "tribadism",
    "clothed sex",
    "public indecency",
    "happy sex",
    "cum",
    "facial",
    "ejaculation",
    "after sex",
    "after vaginal",
    "upright straddle",
    "reverse upright straddle",
    "reverse suspended congress",
    "piledriver (sex)",
    "boy on top",
    "thigh sex",
    "frottage",
    "reverse spitroast",
    "rape",
    "after rape",
    "rough sex",
    "strangling",
    "neck grab",
    "headlock",
    "rear naked choke",
    "asphyxiation",
    "slap mark",
    "orgy",
    "bondage",
    "bdsm",
    "restrained",
    "prostitution",
    "pet play",
    "after ejaculation",
    "after anal",
    "cumdrip from penis",
    "impregnation",
    "holding another's wrist",
    "arm held back",
    "penis over eyes",
    "penis on face",
    "precum",
    "precum drip",
    "precum string",
    "cum on hair",
    "cum in ass",
    "cum on clothes",
    "cum on stomach",
    "cum on legs",
    "cum string",
    "cum on feet",
    "cum on hands",
    "cum on penis",
    "excessive cum",
    "fivesome",
    "foursome",
    "double handjob",
    "two-handed handjob",
    "cooperative handjob",
    "surrounded by penises",
    "bukkake",
    "projectile cum",
    "handsfree ejaculation",
    "gokkun",
    "cumdrip",
    "cum overflow",
    "cum on body",
    "cum on breasts",
    "cum in mouth",
    "cum in pussy",
    "internal cumshot",
    "cum on tongue",
    # flash+sex 的性接觸。不進這個集合會被 heat 收成走光。
    "spread ass",
    "grabbing from behind",
    "hickey",
    "spanking",
    # 性愛主題與結果。heat 是 ["sex"] 時本來就會進 sex，寫在這裡是怕以後被攤寬。
    "cross-section",
    "x-ray",
    "mind control",
    "hypnosis",
    "corruption",
    "humiliation",
    "slave",
    "guro",
    "inflation",
    "cum inflation",
    "prolapse",
    "anal prolapse",
    "sex machine",
    "large insertion",
    "urethral insertion",
    "egg laying",
    "nipple penetration",
    "fisting",
    "vore",
    "armpit sex",
    "cervical penetration",
    "triple penetration",
    # 主題與結果。不進 sex_act，heat 是 ["sex"] 時本來會進 sex；寫在這裡避免以後被攤成走光。
    "peeing",
    "bestiality",
    "transformation",
    "suspension",
    "ovum",
    "fertilization",
    "penis size difference",
    "penis measuring",
    "sperm cell",
    "slapping",
    "lactation through clothes",
    "objectification",
    "cum in nose",
    "nipple pull",
    "human furniture",
    "cumdump",
    "cum through clothes",
    "excessive pussy juice",
    "cum bubble",
    "crucifixion",
    "enema",
    "petrification",
    "scat",
    "double anal",
    "orgasm denial",
    "stomach punch",
    "parasite",
    "knotting",
    "penetration through clothes",
    "necrophilia",
    "double vaginal",
    "whipping",
    "electrostimulation",
    "anal fisting",
    "encasement",
    "wax play",
    "egg implantation",
    "sex doll",
    "stomach (organ)",
    "unbirthing",
    "urethral fingering",
    "forniphilia",
    "navel penetration",
    "digestion",
    "animal penis",
    "horse penis",
    "pussy peek",
    "interspecies",
    "femdom",
    "spread anus",
    "food on body",
    "gaping",
    "bound ankles",
    "frogtie",
    "whipped cream",
    "sleep molestation",
    "molestation",
    "chocolate on body",
    "buttjob",
    "dildo riding",
    "leash pull",
    "cum in container",
    "hairjob",
    "public use",
    "hogtie",
    "tape bondage",
    "crotch grab",
    "foot worship",
    "naizuri",
    "trampling",
    "pegging",
    "prostate milking",
    "mounting",
    "netorase",
    "crotch kick",
    "kneepit sex",
    "cum on food",
    "nyotaimori",
    "underwater sex",
    # 胸部互動：heat 是 flash+sex 的性接觸。不進這個集合會被收成走光。
    "nipple rub",
    "nipple rub through clothes",
    "nipple tweak through clothes",
    "nipple stimulation through clothes",
    "nipple flick",
    "nipple press",
    "nipple push",
    "finger on nipple",
    "tickling nipples",
    "poking another's breast",
    "pectoral grab",
    "breast massage",
    "hand grabbing both breasts",
    "areola measuring",
    "hand milking",
    "forced lactation",
    "nipple stimulation (female on male)",
}


# 第四輪第1批：依語意歸類，避免靠字名片段誤判（例如冷氣不是光線）。
ROUND4_BATCH1_GROUPS = {
    **dict.fromkeys('headlamp'.split("|"), 'acc'),
    **dict.fromkeys('opening door'.split("|"), 'activity'),
    **dict.fromkeys('diagonal-striped background|plaid background|sunburst background|vertical-striped background'.split("|"), 'background'),
    **dict.fromkeys('3d background|black border|outside border|white border'.split("|"), 'camera'),
    **dict.fromkeys('breath|falling feathers|glint|light trail|sunburst|musical note|notice lines|puff of air|spoken musical note|squiggle|zzz'.split("|"), 'effect'),
    **dict.fromkeys('cloud print|starry sky print|neon trim'.split("|"), 'fabric'),
    **dict.fromkeys('on bench|on floor|on ground|on swing|on table'.split("|"), 'furniture'),
    **dict.fromkeys('black flower|black rose|blue flower|blue rose|orange flower|pink flower|pink rose|purple flower|purple rose|red flower|red rose|white flower|white rose|yellow flower|yellow rose|green flower|camellia|daisy (flower)|tulip|white lily|wisteria|bare tree|branch|lily pad|palm leaf|tree stump|vines|bird|butterfly|cat|dog|fish|school desk|school chair|chalkboard|book stack|cabinet|drawer|flower pot|picture frame|potted plant|rug|shelf|tablecloth|wooden table|window blinds|barrel|candlestand|gohei|shimenawa|vase|wind chime|wooden bucket|treasure chest|cardboard box|doll|gift|ceiling|checkered floor|door|doorway|gate|ladder|open door|open window|pole|reflective floor|sliding doors|tile floor|tile wall|tombstone|wooden fence|wooden wall|spider web|pavement|road sign|poster (object)|trash can|air conditioner|alarm clock|electric fan|light bulb|refrigerator|television|faucet|toilet|cooking pot|drinking glass|kettle|crystal|seashell|shallow water|starfish|waves|rubber duck|aircraft|fighter jet|flight deck|military vehicle|motor vehicle|motorcycle|sports car|truck|smokestack|watercraft|warship|glowing sword|glowing weapon|happy halloween|happy valentine|nengajou|year of the rabbit|year of the tiger|wreath|setsubun|tanabata|spring (season)|autumn|snowman|folding chair|lounge chair'.split("|"), 'other'),
    **dict.fromkeys('gym storeroom'.split("|"), 'place'),
    **dict.fromkeys('cold|hot'.split("|"), 'skin'),
    **dict.fromkeys('grey sky|cumulonimbus cloud|constellation|contrail|red moon'.split("|"), 'sky'),
    **dict.fromkeys('against railing|against tree|in tree|sitting in tree|standing on liquid|holding lantern'.split("|"), 'tease'),
    **dict.fromkeys('morning'.split("|"), 'time'),
    **dict.fromkeys('snowing'.split("|"), 'weather'),
}


# 第四輪第2批：依語意歸類，避免靠字名片段誤判（例如冷氣不是光線）。
ROUND4_BATCH2_GROUPS = {
    **dict.fromkeys('obijime|tasuki|vambraces|heart pasties|single earring|bangle|goggles on head|straw hat|mini crown|headpiece|bandana|wristwatch|hair tie|earmuffs'.split("|"), 'acc'),
    **dict.fromkeys('bare hips'.split("|"), 'body_f'),
    **dict.fromkeys('red skirt|green skirt|grey skirt|pink skirt|purple skirt|layered skirt|denim skirt|white pants|grey pants|white shorts|no pants'.split("|"), 'bottom'),
    **dict.fromkeys('black kimono|red kimono|pink kimono|red hakama|kariginu|full armor|red cape'.split("|"), 'era'),
    **dict.fromkeys('vertical-striped clothes|checkered clothes|argyle clothes|cross-laced clothes|asymmetrical clothes|taut clothes|unbuttoned|raglan sleeves|wing collar|double-breasted|asymmetrical legwear|partially undressed|jacket on shoulders'.split("|"), 'fabric'),
    **dict.fromkeys('greaves|black shoes|white shoes|brown shoes|red shoes|black boots|white boots|brown boots|black sandals|flip-flops|pumps'.split("|"), 'feet'),
    **dict.fromkeys('black pantyhose|white pantyhose|brown pantyhose|thighband pantyhose|black socks|striped thighhighs|brown thighhighs|red thighhighs|leg warmers'.split("|"), 'legs'),
    **dict.fromkeys('nude cover'.split("|"), 'nude'),
    **dict.fromkeys('naked cape|naked sheet|collared dress|long dress|pleated dress|halter dress|layered dress|strapless leotard|white leotard|black one-piece swimsuit|highleg one-piece swimsuit|naval uniform'.split("|"), 'onepiece'),
    **dict.fromkeys('unworn panties|unworn bra'.split("|"), 'other'),
    **dict.fromkeys('white jacket|red jacket|brown jacket|fur-trimmed jacket|grey jacket|black coat|hooded coat'.split("|"), 'outer'),
    **dict.fromkeys('no shirt|black vest|grey shirt|yellow shirt|purple shirt|brown shirt|cropped shirt|polo shirt|undershirt|tied shirt|black sweater|black camisole'.split("|"), 'top'),
    **dict.fromkeys('pink panties|purple panties|frilled panties|polka dot panties|lace panties|thong panties|bow bra|lace-trimmed bra|red bra|striped bra'.split("|"), 'underwear'),
}


# 第四輪第3批：依語意歸類，避免靠字名片段誤判（例如冷氣不是光線）。
ROUND4_BATCH3_GROUPS = {
    **dict.fromkeys('waking up|dressing|playing with own hair|unsheathing|drawing bow|soaking feet'.split("|"), 'activity'),
    **dict.fromkeys('sleeping upright|spread arms|legs together|feet up'.split("|"), 'body'),
    **dict.fromkeys('faceless female|toned female|hip bones|armpit crease|armpit peek|perky breasts|full cleavage|framed breasts'.split("|"), 'body_f'),
    **dict.fromkeys('large pectorals|bare pectorals|muscular arms|veiny arms|linea alba|body hair|armpit hair|sideburns|full beard|beard stubble'.split("|"), 'body_m'),
    **dict.fromkeys('partially underwater shot|pov across table|aiming at viewer|female pov|facing to the side|other focus|zoom layer|pillarboxed|chibi inset|reference inset'.split("|"), 'camera'),
    **dict.fromkeys('colored sclera|symbol in eye|solid circle eyes|thick eyelashes|horizontal pupils|star in eye|red sclera|yellow pupils|x-shaped pupils|alternate eye color'.split("|"), 'eyes'),
    **dict.fromkeys('enmaided|partially unzipped'.split("|"), 'fabric'),
    **dict.fromkeys('light frown|scowl|disgust|unamused|confused|grimace|evil grin|wiping tears|streaming tears|puckered lips'.split("|"), 'face'),
    **dict.fromkeys('bursting breasts|butt crack|breast slip|bikini top lift|untied bikini top|untied bikini bottom|bikini bottom pull|skirt pull|shorts pull|pantyhose pull'.split("|"), 'flash'),
    **dict.fromkeys('looking at animal|looking over eyewear|staring|upturned eyes'.split("|"), 'gaze'),
    **dict.fromkeys('red streaks|blue streaks|black streaks|pink streaks|official alternate hair color'.split("|"), 'hair_color'),
    **dict.fromkeys('buzz cut|bowl cut|inverted bob|front ponytail|high side ponytail|wide ponytail|side braids|nape braid|low-braided long hair|single side bun|side up bun|long sidelocks|drill sidelocks|fiery hair|hair over breasts'.split("|"), 'hair_style'),
    **dict.fromkeys('sailor|shinsengumi'.split("|"), 'job'),
    **dict.fromkeys('purple nails|green nails|aqua nails|yellow nails|orange nails|white nails|multicolored nails|nail art|red eyeliner|sharp fingernails'.split("|"), 'makeup'),
    **dict.fromkeys('nontraditional miko|nontraditional playboy bunny|wa maid|male maid|unconventional maid|roswaal mansion maid uniform|employee uniform'.split("|"), 'onepiece'),
    **dict.fromkeys("viera|plant girl|fish girl|shark girl|miqo'te|tiger girl|lion girl|merfolk|fins|antennae".split("|"), 'race'),
    **dict.fromkeys('disembodied penis|girthy penis|clitoral hood|no pussy|partially visible vulva|fat mons|anus peek|urethra|pubic hair peek|colored pubic hair|caressing testicles|gloved handjob|two-footed footjob|cooperative fellatio|clitoral stimulation|female orgasm|fellatio gesture|hitachi magic wand|vibrator under clothes'.split("|"), 'sex'),
    **dict.fromkeys('whisker markings|body markings|star facial mark|birthmark|scar on stomach|scar on chest|scar on arm|flower tattoo|shoulder tattoo|chest tattoo|one-piece tan|bikini tan|cracked skin|wrinkled skin|very sweaty|turn pale|dirty|dirty face|ear blush|alternate skin color'.split("|"), 'skin'),
    **dict.fromkeys('toon (style)|faux traditional media|outline|white outline|hatching (texture)|no lineart'.split("|"), 'style'),
    **dict.fromkeys('petting|adjusting swimsuit|carrying over shoulder|hands on own face|hand on own head|hand to own mouth|hands on own cheeks|hands on own head|open hands|hand over own mouth|midriff peek|bra peek|panty peek|strap gap|button gap|crop top overhang|pantylines|plunging neckline|necktie between breasts'.split("|"), 'tease'),
    **dict.fromkeys('breast curtains|open hoodie'.split("|"), 'top'),
}




# 2026-10-24 建議池。inherit_eras 會再叫一次 assign_group，字名片段會把角、翅膀、景物分錯。
ROUND_1500_GROUPS = {
    **dict.fromkeys('red bow|red ribbon|black bow|black ribbon|blue bow|white bow|pink bow|black hairband|white hairband|red hairband|tate eboshi|ajirogasa|blue hairband|blue halo|pink halo|military hat|sailor hat|garrison cap|flat cap|fedora|bucket hat|jester cap|arm warmers|bracer|wrist scrunchie|red scrunchie|blue scrunchie|black scrunchie|tinted eyewear|heart earrings|star earrings|jingasa'.split("|"), 'acc'),
    **dict.fromkeys("drying|wiping face|wiping sweat|brushing another's hair|sleeping on person|shared food|chewing|tickling|chasing|fleeing|throwing|riding pokemon|imminent kiss|after kiss|surprise kiss|pocky kiss|untying|poking|confession|comforting".split("|"), 'activity'),
    **dict.fromkeys('sidesaddle|legs folded|head down|knees apart feet together|bowlegged pose|heel up'.split("|"), 'body'),
    **dict.fromkeys('legs|feet|toes|toenails|back|knees|kneepits|nape|obliques|dimples of venus|full-package futanari|puckered anus|dark anus|median furrow|spine|palms'.split("|"), 'body_f'),
    **dict.fromkeys('long beard|thick beard|thick mustache|sideburns stubble|mustache stubble|goatee stubble|strongman waist|sidepec|manly|hairy|navel hair|fake mustache|pectoral cleavage'.split("|"), 'body_m'),
    **dict.fromkeys('red shorts|grey shorts|brown shorts|green shorts|purple shorts|pink shorts|yellow shorts|orange shorts|striped shorts|suspender shorts|puffy shorts|high-waist shorts|yellow skirt|orange skirt|aqua skirt|striped skirt|print skirt|medium skirt|circle skirt|pink pants'.split("|"), 'bottom'),
    **dict.fromkeys('spill|spilling|melting|shards|debris|energy ball|dark aura|destruction|laser|paint splatter|electrokinesis|telekinesis'.split("|"), 'effect'),
    **dict.fromkeys('kote|yugake|kesa|kusazuri|sode|faulds|muneate|hachimaki|kappougi|greco-roman clothes|dougi|black hakama|blue hakama|obiage|hakama pants'.split("|"), 'era'),
    **dict.fromkeys('blue pupils|uneven eyes|forked eyebrows|curly eyebrows|huge eyebrows|eyebrow cut|mismatched eyebrows|drop-shaped pupils|rabbit-shaped pupils|power symbol-shaped pupils|blue sclera|flaming eye|unusually open eyes|short eyebrows|heart in eye|no eyebrows'.split("|"), 'eyes'),
    **dict.fromkeys('gradient clothes|two-sided fabric|diagonal-striped clothes|fur-trimmed cape|fur-trimmed dress|fur-trimmed capelet|cable knit|feather trim|fringe trim|ribbon-trimmed skirt|lace-trimmed dress|frilled shirt collar|blue sailor collar|white sailor collar|black sailor collar|shoulder cutout|navel cutout|back cutout|side cutout|partially unbuttoned|open fly|open collar|buttoned cuffs|popped collar'.split("|"), 'fabric'),
    **dict.fromkeys('doyagao|gloom (expression)|false smile|completely unamused|screaming|happy tears|jealous|worried|sigh|dot mouth|cheek bulge|uvula|spitting|sick|pain|xd|o3o|u u|cheek pinching'.split("|"), 'face'),
    **dict.fromkeys('fur-trimmed boots|blue shoes|pink shoes|yellow shoes|green shoes|orange shoes|purple shoes|grey shoes|red boots|blue boots|pink boots|brown sandals|white sandals|high heel sandals|strappy heels|platform heels|flats|ballet slippers|roller skates|inline skates|skates|paw shoes|single shoe|mismatched footwear|asymmetrical footwear|shoe soles|shoelaces'.split("|"), 'feet'),
    **dict.fromkeys('wide spread legs|spread pussy under clothes|covering nipples|clothes down|clothed female nude female|covered penis'.split("|"), 'flash'),
    **dict.fromkeys('under covers'.split("|"), 'furniture'),
    **dict.fromkeys('blank stare|covered eyes'.split("|"), 'gaze'),
    **dict.fromkeys('long hair between eyes|hairpods|bun cover|quad tails|tri tails|ringlets|pointy hair|cowlick|diagonal bangs|arched bangs|short bangs|blunt tresses|long sideburns|split ponytail|prehensile hair|hair spread out|multiple braids|updo|loose hair strand|low-tied sidelocks|hair flowing over'.split("|"), 'hair_style'),
    **dict.fromkeys('utaite'.split("|"), 'job'),
    **dict.fromkeys('purple thighhighs|blue thighhighs|pink thighhighs|yellow thighhighs|green thighhighs|orange thighhighs|striped pantyhose|purple pantyhose|pink pantyhose|blue pantyhose|red pantyhose|frilled thighhighs|lace-trimmed thighhighs|print thighhighs|ribbed thighhighs|seamed legwear|back-seamed legwear|thighhighs under boots|argyle pantyhose'.split("|"), 'legs'),
    **dict.fromkeys('grey nails|very long fingernails'.split("|"), 'makeup'),
    **dict.fromkeys('brown dress|grey dress|yellow dress|striped dress|two-tone dress|orange dress|aqua dress|plaid dress|polka dot dress|print dress|taut dress|medium dress|microdress|tube dress|turtleneck dress|santa dress|black bikini|white bikini|red bikini|frilled bikini|striped bikini|purple bikini|blue leotard|red leotard|short jumpsuit|unitard|romper'.split("|"), 'onepiece'),
    **dict.fromkeys('genderswap (mtf)|genderswap (ftm)|crossdressing|clone|animalization|single horn|curled horns|black horns|red horns|multiple horns|antlers|fiery horns|cone horns|asymmetrical horns|uneven horns|lipstick tube|on lap|round table|chest of drawers|hospital bed|bar stool|stove|tanzaku|ema|bamboo broom|ginkgo leaf|petals on liquid|log|crate|analog clock|dandelion|lily of the valley|food stand|chimney|round window|traffic cone|morning glory|orange rose|chalk|globe|helicopter|scooter|race vehicle|hagoita|daruma doll|hamaya|kouhaku nawa|mahjong tile|broken horn|dog tail|mouse tail|raccoon tail|tiger tail|shark tail|squirrel tail|lion tail|monkey tail|bird tail|ghost tail|snake tail|spiked tail|heart tail|cow tail|blue wings|mini wings|multicolored wings|purple wings|spread wings|sharp teeth|fangs|fang out|round teeth|buck teeth|lower teeth only|long tongue|forked tongue|colored tongue|blue tongue|tail raised|prehensile tail|on shoulder'.split("|"), 'other'),
    **dict.fromkeys('pink jacket|yellow jacket|purple jacket|orange jacket|red coat|blue coat|pink coat|grey coat|green coat|yellow coat|purple coat|duffel coat|military jacket|camouflage jacket|collared coat|brown cardigan|pink cardigan|grey cardigan|black cardigan|blue cardigan|white cardigan'.split("|"), 'outer'),
    **dict.fromkeys('furry female|furry male|draph|erune|hyur|au ra|mithra (ff11)|taur'.split("|"), 'race'),
    **dict.fromkeys("futa with female|futa with male|futa with futa|crotch rub|reach-around|ejaculating while penetrated|cum on male|male penetrated|vibrator under panties|hand in another's panties|anal object insertion|cum on self|hand on another's ass|oral invitation|futa on male".split("|"), 'sex'),
    **dict.fromkeys('cross scar|scar on forehead|scar on neck|scar on mouth|burn scar|scar across eye|stitches|scratches|bandaid on leg|bandaid on arm|heart facial mark|crescent facial mark|teardrop facial mark|bandaid on hand|facial tattoo|back tattoo|breast tattoo|stomach tattoo|star tattoo|number tattoo|hand tattoo|barcode tattoo|mole on thigh|mole on neck|mole above mouth|mole on ass|scar on nose|multiple moles'.split("|"), 'skin'),
    **dict.fromkeys('oekaki|blue theme|pink theme|red theme|green theme|purple theme|yellow theme|horror (theme)|orange theme|black theme|white theme|brown theme'.split("|"), 'style'),
    **dict.fromkeys("hands on own knees|hands on lap|hand on own stomach|hands on feet|leg between thighs|lying on person|rubbing eyes|pulling own clothes|convenient leg|convenient arm|shoe dangle|grabbing own ass|hands on own ass|tucking hair|hair lift|brushing hair|hands in own hair|spread toes|hand on own leg|elbow rest|pinky out|spread fingers|weapon over shoulder|weapon on back|sword over shoulder|sword on back|reverse grip|hand on hilt|finger on trigger|drawing sword|holstered|holding behind back|twirling hair|finger to cheek|finger to own chin|licking finger|pocky in mouth|teasing|arm around another's waist|hand on another's hip|kissing forehead|sexually suggestive".split("|"), 'tease'),
    **dict.fromkeys('bare back|single bare shoulder|taut shirt|tight shirt|plaid shirt|pinstripe shirt|orange shirt|long shirt|ribbed shirt|impossible shirt|vertical-striped shirt|two-tone shirt|strapless shirt|halter shirt|sideless shirt|sleeveless hoodie|white camisole|pink camisole|turtleneck shirt|untucked shirt|black hoodie|white hoodie|blue hoodie|pink hoodie|grey hoodie|brown sweater|grey sweater|pink sweater'.split("|"), 'top'),
    **dict.fromkeys('green panties|aqua panties|yellow panties|orange panties|grey panties|print panties|bow panties|purple bra|green bra|grey bra|frilled bra|polka dot bra|print bra|white male underwear|black male underwear|micro panties|cat ear panties|panty straps|bra strap|cupless bra'.split("|"), 'underwear'),
    **dict.fromkeys('reference sheet|turnaround|column lineup|collage'.split("|"), 'camera'),
}

def assign_group(item: dict) -> str:
    # 2026-10-26 衣服一批。名字裡的「armor」「kimono」會被時代規則改組，這裡以分類結果為準。
    if item.get("tag") in CLOTHING_GROUPS:
        return CLOTHING_GROUPS[item["tag"]]
    if item.get("tag") in ENV_GROUPS:
        return ENV_GROUPS[item["tag"]]
    if item.get("tag") in POSE_GROUPS:
        return POSE_GROUPS[item["tag"]]
    if item.get("tag") in QUALITY_GROUPS:
        return QUALITY_GROUPS[item["tag"]]
    if item.get("tag") in ROUND_1500_GROUPS:
        return ROUND_1500_GROUPS[item["tag"]]
    if item.get("tag") in ROUND4_BATCH1_GROUPS:
        return ROUND4_BATCH1_GROUPS[item["tag"]]
    if item.get("tag") in ROUND4_BATCH2_GROUPS:
        return ROUND4_BATCH2_GROUPS[item["tag"]]
    if item.get("tag") in ROUND4_BATCH3_GROUPS:
        return ROUND4_BATCH3_GROUPS[item["tag"]]
    sec = item.get("section") or ""
    mx = item.get("mutex") or ""
    layer = item.get("layer") or ""
    tag = item.get("tag") or ""
    heat = item.get("heat") or []
    gate = item.get("gate") or "any"

    if sec == "quality":
        if tag in {"absurdres", "highres", "very aesthetic", "highly aesthetic", "newest"}:
            return "boost"
        return "style"

    if sec == "subject":
        # 角色卡自己一格。人數與「其他」仍走 mutex；沒標 character 的維持原樣。
        if item.get("group") == "character":
            return "character"
        if mx == "female_count":
            return "count_f"
        if mx == "male_count":
            return "count_m"
        return "extra"

    if sec == "feature":
        # 這條要排在最前面。下面有一條「gate=female 且 tag 含 breast → body_f」的
        # 子字串規則，而 breast bondage 與 grabbing another's breast 的名字裡都有
        # breast —— 它們會在走到 `tag in SEX` 之前就被那條吃掉，變成身體特徵。
        # 同義的 breast grab 之所以沒事，只是因為它在 pose 段、順序不一樣。
        #
        # 一個字「是什麼」由人工清單說了算，名字裡剛好有什麼字不算。
        # 目前 feature 段裡在 SEX 的就是那兩個，所以搬到前面不會波及別的字。
        if tag in SEX:
            return "sex"
        if mx == "job":
            return "job"
        # 族裔不是精靈獸人。race 在正常模式會被擋掉，放進去就抽不到。
        if mx == "ethnicity":
            return "skin"
        if mx == "race" or tag in {"monster boy", "monster girl"}:
            return "race"
        if mx == "male_build" or tag in {
            "ugly bastard",
            "fat",
            "fat man",
            "obese",
            "manboobs",
            "old man",
            "otaku",
        }:
            return "body_m"
        if mx == "hair_length":
            return "hair_len"
        if mx == "hair_color" or tag in HAIR_COLOR_LOOK:
            return "hair_color"
        if mx == "eye_color" or "eye" in tag or tag in {
            "eyelashes", "eyeshadow", "heterochromia", "tareme", "tsurime",
            "symbol-shaped pupils", "slit pupils", "dilated pupils",
            "star-shaped pupils", "bright pupils", "white pupils",
            # 名字裡沒有 eye。不要用「pupil」子字串，否則愛心瞳會從 other 被改走。
            "^ ^", "> <", "@ @", "+ +", "= =", "o o", ";o", "sanpaku",
            "black sclera", "yellow sclera",
            "red pupils", "pink pupils", "no pupils", "constricted pupils",
            "cross-shaped pupils", "diamond-shaped pupils", "mismatched pupils",
            "blinking", "aegyo sal",
        }:
            return "eyes"
        if tag in BODY_HAIR:
            return BODY_HAIR[tag]
        if mx == "hair_style" or tag in HAIR_STYLE or tag.endswith(" bangs") or tag.endswith(" ponytail"):
            return "hair_style"
        if tag in MAKEUP:
            return "makeup"
        # 要在「名字裡有 pubic／breast 就當身材」之前。淫紋是標記，不是體型。
        if tag in SKIN:
            return "skin"
        if mx == "height" or tag in {"loli", "tall female", "petite", "aged down", "oppai loli", "baby", "child"}:
            return "body_f"
        if mx == "height_m" or tag in {"shota", "tall male", "short male"}:
            return "body_m"
        if mx == "breast_size" or gate == "female" and any(
            k in tag
            for k in (
                "breast",
                "hip",
                "thigh",
                "waist",
                "mature female",
                "nipple",
                "areola",
                "pussy",
                "ass",
                "cleavage",
                "curvy",
                "pregnant",
                "clitoris",
            )
        ):
            return "body_f"
        if tag in BODY_ANY:
            return "body_f" if gate != "male" else "body_m"
        # 關係詞不是體型。男同性戀題材和兄弟的 gate 是男生，不能掉進體型。
        if tag in {
            "yaoi",
            "brothers",
            "siblings",
            "sisters",
            "couple",
            "age difference",
            "twins",
            "mother and daughter",
            "husband and wife",
            "father and daughter",
            "family",
            "mother and son",
            "group picture",
        }:
            return "other"
        if gate == "male" or tag in {
            "muscular",
            "abs",
            "pectorals",
            "bara",
            "facial hair",
            "stubble",
            "beard",
            "penis",
            "erection",
            "testicles",
        }:
            return "body_m"
        if tag in {"futanari", "quadruple amputee", "minigirl", "giantess", "uterus", "cervix", "old woman", "tomboy"}:
            return "body_f"
        return "other"

    if sec == "pose":
        # 未成年防護：人數的放性愛，抱嬰兒放日常活動，不要掉進其他。
        if tag in {"kodomo doushi", "toddlersex", "toddlercon"}:
            return "sex"
        if tag in {"carrying baby", "child carry", "measuring"}:
            return "activity"
        # 前景模糊、黑邊、透視、對稱是畫面處理，不佔鏡頭格，也不能掉進誘惑。
        # foreshortening 的互斥名也叫 perspective，那是另一個字，不要混在一起。
        # 畫面處理跟倒影焦點要能在鏡頭架上找到，但不佔鏡頭那一格。
        if tag in {"blurry foreground", "letterboxed", "perspective", "symmetry", "reflection focus"}:
            return "camera"
        if mx == "body_pose":
            return "body"
        if mx in ("camera", "perspective"):
            return "camera"
        if mx == "gaze":
            return "gaze"
        if mx == "expression" or tag in FACE:
            return "face"
        if mx == "clothes_action":
            return "flash"
        if mx == "activity":
            return "activity"
        if mx == "sex_act" or tag in SEX or heat == ["sex"]:
            return "sex"
        if "flash" in heat and "tease" not in heat:
            return "flash"
        if tag in {
            "flashing",
            "upskirt",
            "downblouse",
            "one breast out",
            "undressing",
            "skirt lift",
            "clothes lift",
            "exhibitionism",
        }:
            return "flash"
        if "tease" in heat:
            return "tease"
        return "other"

    if sec == "clothing":
        eras = item.get("era") or []
        era_only = bool(eras) and "any" not in eras and "modern" not in eras
        if mx == "nudity" or layer == "skin":
            return "nude"
        if tag in FABRIC or mx == "fabric":
            return "fabric"
        if era_only and layer == "garment":
            return "era"
        if tag in UMBRELLA_GROUP:
            return UMBRELLA_GROUP[tag]
        if mx == "onepiece":
            return "onepiece"
        if mx == "top":
            return "top"
        if mx == "bottom":
            return "bottom"
        if mx in {"underwear_top", "underwear_bottom"}:
            return "underwear"
        if mx == "legs":
            return "legs"
        if mx == "feet":
            return "feet"
        if mx == "outer":
            return "outer"
        # 韓服、奧黛、傳統裙的類別。時代含現代，不能靠「沒有現代」掉進時代組。
        if tag in {"korean clothes", "vietnamese clothes", "german clothes"}:
            return "era"
        if layer == "accessory" or mx in {
            "jewelry",
            "neckwear",
            "headwear",
            "eyewear",
            "hands",
        }:
            return "acc"
        return "acc"

    if sec == "env":
        # crowd：背景裡一群不具名的人，不算角色（人數算的是主角），所以歸背景。
        # audience、crowded 跟 crowd 一樣是背景裡的人，不是角色人數。
        if mx in ("background", "bg_blur") or tag in ("crowd", "people", "audience", "crowded"):
            return "background"
        if mx == "effect":
            return "effect"
        if mx == "in_out":
            return "inout"
        if mx == "place":
            return "place"
        if mx == "furniture":
            return "furniture"
        if mx == "day_night":
            return "time"
        if mx == "weather" or tag in {"cherry blossoms"}:
            return "weather"
        if tag in SKY:
            return "sky"
        # 手電筒名字裡有 light，但它是拿在手上的道具（held_prop），不是光線。
        if mx in ("lighting", "silhouette") or ("light" in tag and mx != "held_prop"):
            return "light"
        return "other"

    return "other"
