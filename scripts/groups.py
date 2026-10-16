"""Assign a display subgroup to each tag. One source of truth for merge + UI order."""

from __future__ import annotations

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


def assign_group(item: dict) -> str:
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
        if mx == "height" or tag in {"loli", "tall female", "petite"}:
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
        if mx in ("background", "bg_blur") or tag in ("crowd", "people"):
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
