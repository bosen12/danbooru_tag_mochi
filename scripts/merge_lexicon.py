#!/usr/bin/env python3
"""Dedupe lexicon parts, keep first occurrence, write web/lexicon.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from groups import GROUP_ORDER, GROUP_ZH, assign_group
from clothing_tags import NARROW as CLOTHING_NARROW
from clothing_tags import UMBRELLA_EXTRA, extra_clothing_tags
from env_tags import NARROW as ENV_NARROW, extra_env_tags
from pose_tags import NARROW as POSE_NARROW, extra_pose_tags
from quality_tags import NARROW as QUALITY_NARROW, extra_quality_tags
from subgroups import CHARACTER_SUB_EN, SUB_ORDER, SUB_ZH, assign_sub, character_sub_id, check_subs

ROOT = Path(__file__).resolve().parents[1]
PARTS = ROOT / "web" / "lexicon_parts"
OUT = ROOT / "web" / "lexicon.json"
HEATS = ["tease", "flash", "sex"]
# Clothes are outfits, not a heat. You can have sex in a bikini.
# These are undress / toy states, not something you "wear to a scene".
CLOTHING_STATE = {
    "nude",
    "completely nude",
    "topless female",
    "topless male",
    "bottomless",
    "panties aside",
    "panties around one leg",
    "no bra",
    "no panties",
    "underwear only",
    "see-through clothes",
    "open clothes",
    # 這幾個是狀態或刑具，不是可以穿去任何場合的衣服。不進 CLOTHING_STATE 的話
    # widen_heat 會把它們攤成三檔。
    "crotchless",
    "chastity belt",
    "gag",
    "spreader bar",
    "nipple tassels",
    "public vibrator",
    # 刑具和搾乳不是日常能穿出門的衣服。不列進來會被 widen 成三檔。
    "pillory",
    "stocks",
    "restraints",
    "milking machine",
    "breast pump",
    # 乳頭吸盤是器具，跟吸乳器一樣。不列進來會被 widen 成三檔。
    "nipple suction cups",
    # 第二輪：刑具、口塞變體、跳蛋變體、束縛衣。不列進來會被 widen 成三檔。
    "rope",
    "cuffs",
    "shackles",
    "tape gag",
    "bit gag",
    "ring gag",
    "strap-on",
    "nose hook",
    "speculum",
    "vibrator cord",
    "vibrator in thighhighs",
    "vibrator on nipple",
    "chain leash",
    "nipple rings",
    "nipple bar",
    "cross pasties",
    "maebari",
    "heart maebari",
    "straitjacket",
    "bikini top only",
    "open shirt",
    "open kimono",
    # 拉開拉鍊、陰部貼OK繃不是能穿去任何場合的衣服。不列進來會被 widen 成三檔。
    "unzipped",
    "bandaid on pussy",
    "clothes between breasts",
    "naked sweater",
    "naked shirt",
    "naked apron",
    "naked towel",
    "sex toy",
    "vibrator",
    "egg vibrator",
}
# Faces that *are* a heat. Everyday faces / sitting / looking are not.
POSE_CLIMAX = {
    "ahegao",
    "fucked silly",
    "rolling eyes",
    "orgasm",
    "moaning",
    "torogao",
    # 表情互斥會被 widen 攤成三檔。猙獰淫笑只在性愛成立。
    "rape face",
}
SECTIONS = {"quality", "subject", "feature", "pose", "clothing", "env"}
GATES = {"any", "female", "male"}

# 這是目前專案採用的共同基礎負面；全年齡／敏感分級會在此之外追加自己的限制。
# 順序依使用者指定，避免生成檔與 ComfyUI 後備路徑各自漂移。
NEGATIVE = (
    "worst quality, bad quality, worst detail, sketch, bad hands, extra digits, "
    "censored, bar censor, mosaic censoring, watermark, signature, english text, "
    "speech bubble, 3d, photorealistic, inset, "
    "loli, child, aged down"
)

# 這張表有兩個用途：norm() 用它把字擋在詞庫外，rename_custom_tag.new_tag_ok()
# 用它擋改名。兩邊都是精確比對，所以**單數和複數要各寫一次** —— 原本只有
# "children" 而沒有 "child"，於是改名工具會放行 `child`，儘管它自己的 docstring
# 和 README 都寫著擋 loli／shota／teen／child。"teen" 則是整個漏掉。
#
# 加這兩個字不會動到詞庫：現在沒有任何一個 tag 的名字是 "child" 或 "teen"
# （整字或子字串都沒有），而 norm() 只在完全相等時才丟掉。
BANNED = {
    "toddler",
    "underage",
    "kid",
    "child",
    "children",
    "teen",
    "teenage",
    "teenager",
}

UMBRELLA = {
    "chinese clothes",
    "japanese clothes",
    "ancient greek clothes",
    "armor",
    "swimsuit",
    "one-piece swimsuit",
    "dress",
    "shirt",
    "skirt",
    "pants",
    "shorts",
    "bikini",
    "bra",
    "panties",
    "kimono",
    "yukata",
    "bodysuit",
    "sweater",
    "jacket",
    "coat",
    "school uniform",
    "necktie",
    "leotard",
    "tank top",
    "cardigan",
    "socks",
    "thighhighs",
    "hat",
    "gloves",
    "earrings",
    "necklace",
    "collar",
    "bowtie",
    "sex",
    "oral",
    "threesome",
    "monster boy",
    "monster girl",
    "fat",
    "otaku",
}

# 錨點可以有替代字：抽的時候在同一組裡挑一個。chinese clothes 是泛稱，
# hanfu 是具體的形制，兩個都對，一直只用前者會讓每張古中國圖長得一樣。
ERA_ANCHOR_ALTS = {
    "chinese clothes": ["chinese clothes", "hanfu"],
}

# 現代**沒有錨**：Danbooru 上的 modern 是 artist 分類、post_count 0 ——
# 那個字不是 tag，模型沒學過。而現代本來就不需要錨，因為 Danbooru 的預設
# 就是現代；實測 2800 張現代圖有 96.8% 另外帶著現代專屬的場地或服裝
# （jacket 714、city lights 307、sneakers 294…），只靠這個錨撐的只有 3.2%。
# 對照 test_engine.mjs 的時代訊號測試也**刻意排除現代**，註解寫著
#「現代不該被硬塞（它本來就有一堆專屬場地）」。2026-09-18 專案主裁決拿掉。
ERA_ANCHORS = {
    "ancient_china": ["chinese clothes", "east asian architecture"],
    "ancient_greece": ["ancient greek clothes"],
    "medieval": ["armor", "castle"],
    "edo": ["japanese clothes"],
    "victorian": ["victorian"],
}

# Structural western / modern clothes must not leak into historical eras.
_MV = ["modern", "victorian"]
_M = ["modern"]
ERA_OF = {
    "dress": _MV,
    "wedding dress": _MV,
    "short dress": _MV,
    "shirt": _MV,
    "blouse": _MV,
    "open shirt": _MV,
    "unbuttoned shirt": _MV,
    "off shoulder": _M,
    "jacket": _M,
    "open jacket": _M,
    # 泛用父標籤只會隨具體子標籤進場；時代需涵蓋 long skirt 的全部時代，否則
    # child -> parent implication 在古中國／中世紀會被 era gate 截斷。
    "skirt": ["modern", "victorian", "medieval", "ancient_china"],
    "miniskirt": _M,
    # 窄裙是 1950 年代的辦公室服裝，維多利亞穿不到它。移走之前 victorian
    # 的 bottom 池只有它一件真衣服，所以同一批補了長裙、襯裙、裙撐。
    "pencil skirt": _M,
    # 活動也會時代錯置，而且沒人查過。菸草到 1500 年代才進歐洲，吉他是 15 世紀
    # 以後的樂器，日光浴當成休閒是 20 世紀的事，瑜伽墊那種畫面也是現代的。
    # 這四個原本是「任何時代」，於是古希臘有 3% 的圖在抽菸、4% 在做瑜伽。
    # 江戶有煙管、維多利亞有菸，所以 smoking 留給這兩個時代。
    "smoking": ["modern", "edo", "victorian"],
    "yoga": _M,
    "playing guitar": _MV,
    "sunbathing": _M,
    "long skirt": ["modern", "victorian", "medieval", "ancient_china"],
    "pleated skirt": _M,
    "microskirt": _M,
    "shorts": _M,
    "short shorts": _M,
    # 同上，讓 Victorian 的 suit pants 能合法帶出 Danbooru 父標籤 pants。
    "pants": ["modern", "victorian"],
    "bra": _M,
    "panties": _M,
    "thong": _M,
    "underwear only": _M,
    "boxers": _M,
    "briefs": _M,
    "male underwear": _M,
    "thighhighs": _MV,
    "kneehighs": _MV,
    "glasses": _MV,
    "navel piercing": _M,
    "naked sweater": _M,
    "naked shirt": _MV,
    "naked apron": _M,
    # 毛巾不是現代才有的東西，而這個限制讓歷史時代的浴場沒有 flash 等級的衣物可穿，
    # 只剩浴袍／浴衣／褌那一類 —— 而 Danbooru 說那一類洗澡時只佔 0.0～0.4%。
    # 證據：naked_towel 全站 18,421 張，其中 **33.2%（6,117）在 onsen**，
    # 另有 japanese clothes 1.3%、bathhouse 0.9%、east asian architecture 0.4%。
    # 內部也對不起來：bath／bathing／shared bathing／towel 這四個本來就是 era any，
    # 只有 naked towel 被鎖在現代，而它跟 towel 是同一條毛巾。
    "naked towel": ["any"],
    # 浴袍（dressing/bathing gown）在維多利亞時期已有；擴到 victorian 也讓男性
    # 浴場不必因 chemise 是 female-only 而被迫 100% 裸體。
    "bathrobe": _MV,
    "elbow gloves": _MV,
    "qipao": _M,
    "tangzhuang": _M,
    "china dress": _M,
    "shower (place)": _M,
    "couch": _M,
    "bar (place)": _MV,
    # 三溫暖是芬蘭浴，對江戶是時代錯置。
    "sauna": _M,
    "spotlight": _M,
    "lamp": _MV,
    "armor": ["medieval", "edo"],
    "gaming chair": _M,
    "swivel chair": _M,
    "office chair": _M,
    "living room": _MV,
    "bathroom": _MV,
    "kitchen": _MV,
    "bathtub": _MV,
    "ceiling light": _M,
    "city lights": _M,
    "pool ladder": _M,
    "beach towel": _M,
    "restaurant": _MV,
    "watch": _M,
    "hard hat": _M,
    "police hat": _M,
    "police uniform": _M,
    "vibrator": _M,
    "egg vibrator": _M,
    "sex toy": _M,
    "handbag": _M,
    "beach umbrella": _M,
    "no bra": _M,
    "no panties": _M,
    "panties aside": _M,
    "white socks": _M,
    "bra pull": _M,
    "panty pull": _M,
    "hand in panties": _M,
    "sports bra lift": _M,
    "shirt lift": _M,
    "necktie": _MV,
    "bowtie": _MV,
    "leotard": _M,
    "bodysuit": _M,
    "power armor": _M,
    "detached collar": _MV,
    "showering": _M,
    "shower head": _M,
    "innertube": _M,
    # 江戶的專屬場地本來 16 個裡有 6 個是浴場（古中國 0 個），於是三分之一的
    # 江戶圖在泡澡。ofuro 跟 bath、bathhouse 跟 onsen 畫出來幾乎是同一種場景 ——
    # 五個日式浴場各自競爭，合計機率就是單一場地的五倍。留 onsen 撐江戶的
    # 沐浴文化，這兩個回歸現代。
    #（原本還留著 open-air bath，但它在 Danbooru 是 0 張、模型沒把它當 tag 學過，
    # 已移除；露天的語意由 onsen + outdoors 承接。）
    "bathhouse": _M,
    "ofuro": _M,
    "bubble bath": _M,
    "shopping": _M,
    "karaoke": _M,
    "playing video games": _M,
    "talking on phone": _M,
    "selfie": _M,
    "driving": _M,
    "riding bicycle": _M,
    "taking picture": _MV,
    "nurse": _M,
    "doctor": _M,
    "office lady": _M,
    "salaryman": _M,
    "policewoman": _M,
    "waitress": _M,
    "barista": _M,
    "flight attendant": _M,
    "idol": _M,
    "teacher": _M,
    "nurse cap": _M,
    "idol clothes": _M,
    "blazer": _M,
    "condom": _M,
    "used condom": _M,
    "holding condom": _M,
    "condom in mouth": _M,
    "condom wrapper": _M,
    "condom box": _M,
    "dildo": _M,
    "recording": _M,
    "chikan": _M,
    "fitness gym": _M,
    "school gym": _M,
    "locker room": _M,
    "locker": _M,
    "hospital": _M,
    "clinic": _M,
    "stethoscope": _M,
    "clipboard": _M,
    "microphone": _M,
    "sportswear": _M,
    "helmet": _M,
    "temple": ["ancient_china", "edo"],
    "pagoda": ["ancient_china", "edo"],
    "torii": ["edo"],
    "shrine": ["edo", "modern"],
    "east asian architecture": ["ancient_china"],
    "east asian architecture": ["ancient_china", "edo"],
}

# Variant → parent so they coexist (mutex siblings skip parent/child).
# 後綴規則（「X 什麼」就 implies「什麼」）對「顏色＋衣服」很準，Danbooru 也是這樣
# 定的：blue bra -> bra、white panties -> panties、track jacket -> jacket。
# 但複合名詞不一定是那個東西的一種，這裡放查證過的例外。
#
# sports bra：Danbooru 上 sports_bra 沒有任何 implication，顏色款也只 implies
# sports_bra —— 運動內衣在他們的分類裡不是 bra。我們自己補出來的 -> bra 會讓
# 「black sports bra, sports bra, bra」這種三連出現，而那個 bra 是訓練集裡沒有的。
SUFFIX_COMPOUND_EXCEPTIONS = {
    # 運動胸罩是另一種胸罩。發育期胸罩是封鎖字，不要帶出一般胸罩。
    "bra": ("sports bra", "training bra"),
    # 水手領是領口形狀，不是項圈。後綴規則會把它收成 collar。
    "collar": ("sailor collar", "frilled collar", "high collar", "fur collar"),
    # 大衣只有現代。毛皮大衣要在維多利亞也能抽，再帶出 coat 會整筆被拒。
    # 脫下來放在旁邊的大衣不是身上的大衣。
    "coat": ("fur coat", "unworn coat"),
    # 摘下來放在旁邊，不是身上正穿的那一件。後綴規則會把「未穿戴的洋裝」收成洋裝，
    # 連身格就被佔走，上衣加外套補不出下著。
    "hat": ("unworn hat",),
    "shirt": ("unworn shirt",),
    "dress": ("unworn dress",),
    "skirt": ("unworn skirt",),
    "jacket": ("unworn jacket", "jacket around waist"),
    "swimsuit": ("unworn swimsuit",),
    "socks": ("unworn socks",),
    "gloves": ("unworn gloves",),
    # 掛在腰上、褪到一隻腳，是那件衣服的狀態，不是再穿一件。
    "shorts": ("shorts around one leg",),
    "sweater": ("sweater around waist",),
    "cardigan": ("cardigan around waist",),
    # 褲型袴是江戶的袴，不是現代長褲。帶出 pants 會在江戶時代對不上。
    "pants": ("hakama pants",),
    # 小學、國中制服是封鎖字，後綴規則不要再帶出學生制服。
    "school uniform": (
        "tomoeda elementary school uniform",
        "tokyo-3 middle school uniform",
        "mitakihara school uniform",
        "tokiwadai school uniform",
        "nanamori school uniform",
        "sakugawa school uniform",
        "nanairogaoka middle school uniform",
    ),
}

SUFFIX_PARENT = (
    "shirt",
    "sweater",
    "tank top",
    "dress",
    "skirt",
    "pants",
    "shorts",
    "bikini",
    "bra",
    "panties",
    "jacket",
    "coat",
    "kimono",
    "yukata",
    "bodysuit",
    "necktie",
    "bowtie",
    "swimsuit",
    "leotard",
    "collar",
    "earrings",
    "necklace",
    "gloves",
    "socks",
    "thighhighs",
    "hat",
    "cardigan",
    "one-piece swimsuit",
    "sports bra",
    "school uniform",
)

IMPLIES = {
    "pencil skirt": ["skirt"],
    "pleated skirt": ["skirt"],
    # Danbooru 是 microskirt -> skirt，不經過 miniskirt（兩者是兄弟不是父子），
    # 而且兩個都是 mutex=bottom，硬串起來等於在同一格塞兩件下著。
    "microskirt": ["skirt"],
    "short shorts": ["shorts"],
    "jeans": ["pants"],
    "open shirt": ["shirt"],
    "unbuttoned shirt": ["shirt"],
    "collared shirt": ["shirt"],
    "wet shirt": ["shirt"],
    "shirt tucked in": ["shirt"],
    "dress shirt": ["shirt"],
    "see-through shirt": ["shirt"],
    "sleeveless shirt": ["shirt"],
    "string bikini": ["bikini"],
    "micro bikini": ["bikini"],
    "open kimono": ["kimono", "japanese clothes"],
    "bath yukata": ["yukata"],
    "open bodysuit": ["bodysuit"],
    "torn bodysuit": ["bodysuit"],
    "open coat": ["coat"],
    "open cardigan": ["cardigan"],
    "open jacket": ["jacket"],
    "competition swimsuit": ["one-piece swimsuit", "swimsuit"],
    "school swimsuit": ["one-piece swimsuit", "swimsuit"],
    "one-piece swimsuit": ["swimsuit"],
    # 女巫的圖有 84% 戴女巫帽。帽子跟女巫同一個時代，帶出來不會把現代帽子塞進中世紀。
    "witch": ["witch hat"],
    "casual one-piece swimsuit": ["one-piece swimsuit", "swimsuit"],
    "wedding ring": ["ring"],
    "pool": ["outdoors"],
    "underwater": ["outdoors"],
    "car": ["outdoors"],
    "restaurant": ["indoors"],
    "park bench": ["outdoors"],
    "bamboo forest": ["outdoors"],
    "cherry blossoms": ["outdoors"],
    "cowgirl position": ["sex"],
    "reverse cowgirl position": ["sex"],
    "doggystyle": ["sex"],
    "standing doggystyle": ["sex"],
    "missionary": ["sex"],
    "mating press": ["sex"],
    "standing sex": ["sex"],
    "sex from behind": ["sex"],
    "girl on top": ["sex"],
    "vaginal": ["sex"],
    "anal": ["sex"],
    "fellatio": ["oral", "sex"],
    "cunnilingus": ["oral", "sex"],
    "oral": ["sex"],
    "paizuri": ["sex"],
    "handjob": ["sex"],
    "clothed sex": ["sex"],
    "public indecency": ["sex"],
    "happy sex": ["sex"],
    "threesome": ["sex"],
    "group sex": ["sex"],
    "mmf threesome": ["threesome", "sex"],
    "ffm threesome": ["threesome", "sex"],
    # 結果標籤只掛「看得到的東西」（精液、陰莖、手交），不掛 vaginal／anal。
    # 那些是 sex_act，結果字再 implies 進去，格被別的體位佔走時整條 commit 會失敗。
    "double handjob": ["handjob"],
    "two-handed handjob": ["handjob"],
    "cooperative handjob": ["handjob"],
    "foursome": ["group sex", "sex"],
    "fivesome": ["group sex", "sex"],
    "after ejaculation": ["cum"],
    "cumdrip": ["cum"],
    "cumdrip from penis": ["cumdrip", "penis"],
    "cum on body": ["cum"],
    "cum on breasts": ["cum"],
    "cum overflow": ["cum"],
    "cum in mouth": ["cum"],
    "cum in pussy": ["cum"],
    "cum on ass": ["cum"],
    "cum on tongue": ["cum"],
    "facial": ["cum"],
    "cum pool": ["cum"],
    "female ejaculation": ["pussy juice"],
    "internal cumshot": ["cum"],
    "cum on hair": ["cum"],
    "cum in ass": ["cum"],
    "cum on clothes": ["cum"],
    "cum on stomach": ["cum"],
    "cum on legs": ["cum"],
    "cum string": ["cum"],
    "cum on feet": ["cum"],
    "cum on hands": ["cum"],
    "cum on penis": ["cum", "penis"],
    "excessive cum": ["cum"],
    "bukkake": ["cum"],
    "projectile cum": ["ejaculation", "cum"],
    "handsfree ejaculation": ["ejaculation"],
    "gokkun": ["cum in mouth"],
    "precum": ["penis"],
    "precum drip": ["precum"],
    "precum string": ["precum"],
    "penis over eyes": ["penis"],
    "penis on face": ["penis"],
    "penis peek": ["penis"],
    "flaccid": ["penis"],
    "half-erect": ["penis"],
    "phimosis": ["penis"],
    "foreskin": ["penis"],
    "twitching penis": ["penis"],
    "large testicles": ["testicles", "penis"],
    "huge testicles": ["testicles", "penis"],
    "small testicles": ["testicles", "penis"],
    # 吸、抓都只有 sex，帶出睪丸和陰莖不會把整張抽失敗。
    "testicle sucking": ["testicles", "penis", "sex"],
    "testicle grab": ["testicles", "penis"],
    # covered testicles 還要在 flash 抽得到，不能 implies 只有 sex 的 testicles／penis。
    "surrounded by penises": ["penis"],
    "penis awe": ["penis"],
    # 不 implies penis：penis 只有 sex，這個視線還要在 flash 抽得到。
    # 字本身就是 looking at penis。
    "condom on penis": ["condom"],
    "squatting cowgirl position": ["cowgirl position", "sex"],
    "upright straddle": ["sex"],
    "reverse upright straddle": ["sex"],
    "reverse suspended congress": ["sex"],
    "piledriver (sex)": ["sex"],
    "boy on top": ["sex"],
    "thigh sex": ["sex"],
    "frottage": ["sex"],
    "reverse spitroast": ["sex"],
    "fat man": ["fat"],
    "obese": ["fat"],
    "coke-bottle glasses": ["glasses"],
    "high ponytail": ["ponytail"],
    "side ponytail": ["ponytail"],
    "twin braids": ["braid"],
    "single braid": ["braid"],
    "single hair bun": ["hair bun"],
    "double bun": ["hair bun"],
    "loli": ["petite", "flat chest"],
    "shota": ["short male"],
    # 未成年防護。oppai loli 不帶 loli（平胸跟巨乳打架）。制服不帶 school uniform。
    "onee-shota": ["shota"],
    "carrying baby": ["baby"],
    "carrying person": ["carrying"],
    "child carry": ["carrying"],
    "pov": ["looking at viewer"],
    "pov crotch": ["looking at viewer"],
    "showering": ["shower (place)", "indoors"],
    "washing hair": ["wet hair"],
    "shared bathing": ["bathing"],
    "mixed-sex bathing": ["bathing"],
    "ofuro": ["bath", "indoors"],
    "bathhouse": ["bath", "indoors"],
    "bubble bath": ["bath", "indoors"],
    "shower head": ["shower (place)"],
    "karaoke": ["singing"],
    "playing video games": ["playing games"],
    "picnic": ["outdoors", "eating"],
    "fishing": ["outdoors"],
    "camping": ["outdoors"],
    "hiking": ["outdoors"],
    "sunbathing": ["outdoors"],
    "office lady": ["pantyhose", "pencil skirt"],
    # 六件運動制服要一致：足球／棒球／網球／排球服本來就 imply sportswear，
    # 籃球服和田徑服是從 harvest 進來的，漏了這條。
    "basketball uniform": ["sportswear"],
    "track uniform": ["sportswear"],
    "basketball court": ["outdoors"],
    "tennis court": ["outdoors"],
    "soccer field": ["outdoors"],
    "baseball stadium": ["outdoors"],
    "bowling alley": ["indoors"],
    "rape": ["sex"],
    "orgy": ["group sex", "sex"],
    "nurse": ["nurse cap"],
    "doctor": ["lab coat", "stethoscope"],
    "salaryman": ["suit", "necktie"],
    "policewoman": ["police uniform"],
    "waitress": ["apron"],
    "idol": ["idol clothes"],
    "teacher": ["blazer"],
    "gangbang": ["group sex", "sex"],
    "dildo": ["sex toy"],
    "breastfeeding": ["lactation"],
    "full-length mirror": ["mirror"],
    "used condom": ["condom"],
    # Danbooru 仍有效的父子：拿著／含著／包裝都是 condom。盒子沒有這條，不要補。
    # condom on penis 已經在詞庫，只暗示 condom（見上面）。penis 只有 sex，
    # 而這個字還有走光，再暗示 penis 會讓走光整張失敗。holding、mouth_hold 不在詞庫。
    "holding condom": ["condom"],
    "condom in mouth": ["condom"],
    "condom wrapper": ["condom"],
    # 2026-05、2025-11 仍有效。跟 from above／from below 同一格，父子可並存。
    "bird's eye view": ["from above"],
    "worm's eye view": ["from below"],
    "object insertion": ["sex"],
    "locker room": ["indoors"],
    "fitness gym": ["indoors"],
    "school gym": ["indoors"],
    "hospital": ["indoors"],
    "clinic": ["indoors"],
    "straddling": ["sitting"],
    "sitting on lap": ["sitting"],
    "jack-o' challenge": ["all fours"],
    "standing on one leg": ["standing"],
}

# Sex act → canonical body pose. Not the same mutex: doggystyle + all fours is valid.
SEX_POSE_BODY = {
    "doggystyle": "all fours",
    "standing doggystyle": "standing",
    "standing sex": "standing",
    "full nelson": "standing",
    "suspended congress": "standing",
    "reverse suspended congress": "standing",
    "missionary": "on back",
    "mating press": "on back",
    "piledriver (sex)": "on back",
    "prone bone": "on stomach",
    "spooning": "on side",
    "cowgirl position": "sitting",
    "reverse cowgirl position": "sitting",
    "girl on top": "sitting",
    "upright straddle": "sitting",
    "reverse upright straddle": "sitting",
    "squatting cowgirl position": "squatting",
    "69": "lying",
    "sitting on face": "sitting",
}
for _act, _pose in SEX_POSE_BODY.items():
    _im = list(IMPLIES.get(_act) or ["sex"])
    if "sex" not in _im:
        _im.append("sex")
    if _pose not in _im:
        _im.append(_pose)
    IMPLIES[_act] = _im

RECLASS = {
    # 這是畫面裡的場景道具，不是穿在人物身上的配件。採集把它放進
    # clothing/accessory/mutex=None，normal/diverse 的服裝白名單因此永遠不會抽到。
    # 放在覆寫表而不是改 05-harvest.json，因為 harvest 會被重新產生。
    "beach umbrella": {"section": "env", "mutex": None, "layer": "normal"},
    "dress shirt": {"mutex": "top", "gate": "any", "section": "clothing", "layer": "garment"},
    "dress pull": {"section": "pose", "mutex": "clothes_action", "layer": "normal", "heat": ["flash", "sex"], "era": ["modern"]},
    "shirt pull": {"section": "pose", "mutex": "clothes_action", "layer": "normal", "heat": ["flash", "sex"], "era": ["modern"]},
    "sweater pull": {"section": "pose", "mutex": "clothes_action", "layer": "normal", "heat": ["flash", "sex"], "era": ["modern"]},
    "swimsuit aside": {"section": "pose", "mutex": "clothes_action", "layer": "normal", "heat": ["flash", "sex"], "era": ["modern"]},
    "bikini bottom aside": {"section": "pose", "mutex": "clothes_action", "layer": "normal", "heat": ["flash", "sex"], "era": ["modern"]},
    "leotard aside": {"section": "pose", "mutex": "clothes_action", "layer": "normal", "heat": ["flash", "sex"], "era": ["modern"]},
    "one-piece swimsuit pull": {"section": "pose", "mutex": "clothes_action", "layer": "normal", "heat": ["flash", "sex"], "era": ["modern"]},
    "hetero": {"needs": ["pair", "female", "male"]},
    "penis on ass": {"needs": ["pair", "female", "male"], "gate": "any"},
    "looking at another": {"needs": ["pair"]},
    "clothed male nude female": {"needs": ["pair", "female", "male"]},
    "clothed female nude male": {"needs": ["pair", "female", "male"]},
    "office lady": {"mutex": "job"},
    "on bed": {"section": "env", "mutex": "furniture"},
    "on chair": {"section": "env", "mutex": "furniture"},
    "on floor": {"section": "env", "mutex": "furniture"},
    "on sofa": {"section": "env", "mutex": "furniture"},
    "plump": {"mutex": "male_build"},
    "skinny": {"mutex": "male_build"},
    "muscular": {"mutex": "male_build"},
    "muscular male": {"mutex": "male_build", "gate": "male"},
    "toned male": {"mutex": "male_build"},
    "bara": {"mutex": "male_build"},
    "bald": {"mutex": "hair_length"},
    "tall female": {"mutex": "height", "gate": "female"},
    # 配件掉了互斥格就等於被判死刑 —— normal 模式（預設）的 fill("clothing") 只放行
    # outfit 白名單裡的互斥格（feet/legs/jewelry/eyewear/neckwear/underwear_*/outer/
    # hands/headwear），mutex 是空的配件一律回 false。實測：79 個配件裡 47 個 mutex
    # 是空的，其中 **34 個在預設模式下完全抽不到**；有互斥格的 32 個只有 1 個抽不到。
    #
    # 下面這些不是設計，是漏掉：同一類的手足都有格子，就它們沒有。
    #   neckwear：black collar／red collar／detached collar／choker 都有，領帶領結沒有
    #   jewelry ：ring／wedding ring／stud earrings／hoop earrings／bracelet 都有，項鍊沒有
    #   headwear：hard hat／police hat／baseball cap／circlet／hood 都有，top hat 沒有
    #
    # 父標籤（necktie／bowtie／necklace／hat／gloves）維持 mutex=None 是對的 ——
    # 那是 UMBRELLA 的設計，它們靠子標籤 implies 進場。問題是子標籤自己也沒有格子，
    # 於是整個家族一起死：bowtie 和 necklace 在預設模式下是 0。
    #
    # 補完之後（6000 張，全時代）：necklace 0 -> 440、gloves 48 -> 286、bowtie 0 -> 38，
    # 而既有手足幾乎沒被排擠（ring 441 -> 392、stud earrings 199 -> 201、choker 162 -> 151）。
    # 腰上的東西本來全是 mutex 空的配件 —— 那在 normal 模式（預設）抽不到，
    # 因為 fill("clothing") 只放行 outfit 白名單裡的互斥格。實測 obi 和 sash
    # 在江戶 3000 張裡是 **0**（weird 模式才有 82 / 69）。
    # 腰帶本來就是一次只繫一條，給它一個 waist 格既能抽得到也不會疊三條。
    # 江戶尤其吃虧：obi 是那個時代最具代表性的配件，卻完全抽不到。
    # naked coat／naked jacket 的意思是「除了這件什麼都沒穿」，也就是整套造型本身，
    # 但它們的格子是 outer —— 外套永遠排在主衣之後才被考慮，於是「身上已經有主衣
    # 就拒絕」那條規則會把它們一律擋掉（實測直接變成抽不到）。放進主衣格，
    # 它們才會在決定主要穿著的那一步就被選中。隱含的 coat／jacket 照樣佔 outer。
    "naked coat": {"mutex": "onepiece"},
    "naked jacket": {"mutex": "onepiece"},
    "obi": {"mutex": "waist"},
    "sash": {"mutex": "waist"},
    "belt": {"mutex": "waist"},
    "black belt": {"mutex": "waist"},
    "brown belt": {"mutex": "waist"},
    "blue necktie": {"mutex": "neckwear"},
    "black necktie": {"mutex": "neckwear"},
    "black bowtie": {"mutex": "neckwear"},
    "cross necklace": {"mutex": "jewelry"},
    "bead necklace": {"mutex": "jewelry"},
    "tooth necklace": {"mutex": "jewelry"},
    "watch": {"mutex": "jewelry"},
    "top hat": {"mutex": "headwear"},
    "laurel crown": {"mutex": "headwear"},
    "black gloves": {"mutex": "hands"},
    "cherry blossoms": {"mutex": "weather", "era": ["any"]},
    # 舔陰莖是動作，不是身體特徵。採集進來時被歸成 feature/body_m，於是它沒有
    # sex_act 互斥格 —— 實測 8000 張裡它出現 58 次，其中 23 次同時還有別的性行為，
    # 包括「licking penis + cowgirl position」（一邊騎乘一邊舔，畫不出來）。
    # 它的兩個同類 cunnilingus（舔陰）和 anilingus（舔肛）本來就在 pose/sex_act。
    # Danbooru 佐證：licking_penis 18150 篇，其中 100.0% 同時有 fellatio、100.0%
    # 有 penis，而 cowgirl_position 只有 1.4%。needs 照最近的同類 fellatio。
    # 放在覆寫表而不是改 05-harvest.json，因為那個檔案重跑採集會被整個重產。
    # layer 和 gate 也要一起搬：採集給的 layer="skin" 不是中性的 —— engine 的
    # wearsBodyClothes() 和「有沒有露出來」那兩個判斷都看 layer==="skin"。
    # 整組對齊最近的同類 fellatio（layer normal、gate any、needs male+pair）。
    "licking penis": {
        "section": "pose", "mutex": "sex_act", "heat": ["sex"],
        "needs": ["male", "pair"], "layer": "normal", "gate": "any",
    },
    # 採集放進 feature，三檔都進，群組被改成 other（名字有 hair，不能佔髮型格）。
    # 兩個女生在誘惑裡也抓得到頭髮。這次收成姿勢、只有性愛、要一男一女。
    # 不佔 sex_act，才能跟按住頭、跟性交同時在。不另加同名的第二筆。
    "grabbing another's hair": {
        "section": "pose", "mutex": None, "heat": ["sex"],
        "needs": ["pair", "male", "female"], "layer": "normal", "gate": "any",
    },
    # 採集把它放進 feature/body_m、layer skin。它是視線，不是身體。
    # heat 停在走光與性愛：widen_heat 會把 gaze 攤成三檔，NARROW_HEAT 把它拉回來。
    "looking at penis": {
        "section": "pose", "mutex": "gaze", "heat": ["flash", "sex"],
        "needs": ["male"], "layer": "normal", "gate": "any",
    },
    # 原本 flash+sex。implies cum 之後，flash 會讓 commit 失敗（cum 只有 sex）。
    # 收成 sex，這個字才真的進得了畫面。
    "cum on ass": {"heat": ["sex"]},
    # 採集把它放進 env/place。精液灘不是場地，佔住 place 就會把臥室擠掉，
    # 牌面也會變成 no humans 的空景。它是射完以後的結果。
    "cum pool": {
        "section": "pose", "mutex": None, "heat": ["sex"],
        "layer": "normal", "gate": "any", "needs": ["male", "female"],
    },
    "tall male": {"mutex": "height_m", "gate": "male"},
    "short male": {"mutex": "height_m", "gate": "male"},
    "male pubic hair": {"gate": "male", "heat": ["flash", "sex"]},
    "female pubic hair": {"gate": "female", "heat": ["flash", "sex"]},
    "arm hair": {"gate": "male"},
    "leg hair": {"gate": "male"},
    "side-tie bikini bottom": {"mutex": "bottom", "section": "clothing", "layer": "garment"},
    "shoulder armor": {"mutex": None, "layer": "accessory", "section": "clothing"},
    "holding sex toy": {"mutex": None, "needs": []},
    "after paizuri": {"mutex": None},
    "after fellatio": {"mutex": None},
    "implied sex": {"mutex": None},
    "stealth sex": {"mutex": None},
    "mixed-sex bathing": {"mutex": None},
    "threesome": {"mutex": None},
    "mmf threesome": {"mutex": None},
    "ffm threesome": {"mutex": None},
    "group sex": {"mutex": None},
}


EXPRESSION = {
    "smile",
    "seductive smile",
    "smirk",
    "grin",
    "light smile",
    "happy",
    "frown",
    "angry",
    "sad",
    "crying",
    "expressionless",
    "pout",
    "surprised",
    "scared",
    "sleepy",
    "serious",
    "smug",
    "nervous",
    "ahegao",
    "torogao",
    "naughty face",
    "crying with eyes open",
    "embarrassed",
    "shy",
    "come hither",
    "furrowed brow",
    "dazed",
    "bored",
    "confident",
    "wide-eyed",
    "laughing",
    "yawning",
    "raised eyebrow",
}

HAIR_STYLE_MUTEX = {
    "ponytail",
    "high ponytail",
    "side ponytail",
    "twintails",
    "braid",
    "twin braids",
    "single braid",
    "hime cut",
    "hair bun",
    "double bun",
    "single hair bun",
    "drill hair",
    # 第三輪：這四個是主髮型。天線髮、髮束、側剃不在這裡，它們跟馬尾疊。
    "hair slicked back",
    "mohawk",
    "dreadlocks",
    "afro",
    "cornrows",
}

# Engine reads stamped needs / mutex. Add new sex acts here, not in engine.js.
SEX_ACT = {
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
    "double handjob",
    "two-handed handjob",
    "cooperative handjob",
    "footjob",
    "sitting on face",
    "tribadism",
    "girl on top",
    "oral",
    "squatting cowgirl position",
    "perpendicular paizuri",
    "vaginal object insertion",
    "imminent fellatio",
    "upright straddle",
    "reverse upright straddle",
    "reverse suspended congress",
    "piledriver (sex)",
    "boy on top",
    "thigh sex",
    "frottage",
    "reverse spitroast",
    "object insertion",
    "nursing handjob",
    "straddling paizuri",
    "mutual masturbation",
    "tentacle sex",
    "sex machine",
    "large insertion",
    "triple penetration",
    "urethral insertion",
    "armpit sex",
    "egg laying",
    "cervical penetration",
    "nipple penetration",
    "fisting",
    "vore",
    "double anal",
    "double vaginal",
    "anal fisting",
    "urethral fingering",
    "enema",
    "egg implantation",
    "buttjob",
    "hairjob",
    "pegging",
    "naizuri",
    "kneepit sex",
    "dildo riding",
    "prostate milking",
    "reverse fellatio",
    # 胸部互動這批裡，本身就是一輪主行為的。普通摸、吸、綁不進這裡。
    "assisted paizuri",
    "nursing paizuri",
    "paizuri while penetrated",
    "folding paizuri",
    "pecjob",
    "nursing fingering",
    "reverse nursing fingering",
    "reverse nursing handjob",
}

SOLO_SEX_ACT = {
    "object insertion",
    # 觸手不是第二個人。佔住 sex_act，但不要求 pair，也不把男生拉進來。
    "tentacle sex",
    # 機器、道具、自己的身體。不把第二個人拉進來。
    "sex machine",
    "large insertion",
    "urethral insertion",
    "egg laying",
    "nipple penetration",
    "fisting",
    # 單人可以自己做。肛門拳交和尿道指交在沒有第二人、又四肢截斷時由引擎擋下。
    "anal fisting",
    "urethral fingering",
    "enema",
    "egg implantation",
    # 騎的是道具，不是第二個人。
    "dildo riding",
}

NEEDS_MALE = {
    "fellatio",
    "reverse fellatio",
    "throat bulge",
    "deepthroat",
    "irrumatio",
    "handjob",
    "paizuri",
    "paizuri under clothes",
    "ejaculation",
    "erection",
    "penis",
    "large penis",
    "huge penis",
    "veiny penis",
    "testicles",
    "large testicles",
    "huge testicles",
    "small testicles",
    "covered testicles",
    "testicle sucking",
    "testicle grab",
    "cum in pussy",
    "cum in mouth",
    "facial",
    "guided penetration",
    "imminent penetration",
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
    "prone bone",
    "spitroast",
    "double penetration",
    "arm hair",
    "leg hair",
    "upright straddle",
    "reverse upright straddle",
    "reverse suspended congress",
    "piledriver (sex)",
    "boy on top",
    "thigh sex",
    "reverse spitroast",
    "mmf threesome",
    "ffm threesome",
    "salaryman",
    "cum",
    "cum on body",
    "cum on breasts",
    "cum overflow",
    "cumdrip",
    "cum on ass",
    "cum on tongue",
    "internal cumshot",
    "after ejaculation",
    "after anal",
    "cumdrip from penis",
    "penis over eyes",
    "penis on face",
    "penis peek",
    "flaccid",
    "half-erect",
    "phimosis",
    "foreskin",
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
    "double handjob",
    "two-handed handjob",
    "cooperative handjob",
    "surrounded by penises",
    "bukkake",
    "projectile cum",
    "handsfree ejaculation",
    "gokkun",
    "condom on penis",
    "twitching penis",
    "penis awe",
    "looking at penis",
    "cum pool",
    "stomach bulge",
    "cum on pussy",
    "nursing handjob",
    "straddling paizuri",
    "mutual masturbation",
    "licking nipple",
    "leg lock",
    "grabbing from behind",
    "kissing neck",
    "head between breasts",
    "breast smother",
    "spanking",
    # 對象是女生的粗暴。卡面與抽牌都要一男一女，不能落在兩個女生或單人男生。
    "rape",
    "after rape",
    "rough sex",
    "strangling",
    "neck grab",
    "headlock",
    "rear naked choke",
    "asphyxiation",
    "slap mark",
    # 內射受孕、抓手腕是一男一女。pair 只代表兩人，不擋兩個女生。
    # 按住頭、抓頭髮也是男生對女生。pair 不夠，兩個女生會漏過去。
    "impregnation",
    "holding another's wrist",
    "hand on another's head",
    "grabbing another's hair",
    "triple penetration",
    "armpit sex",
    "cervical penetration",
    "cum inflation",
    "double anal",
    "double vaginal",
    "penis size difference",
    "cum in nose",
    "cum through clothes",
    "cum bubble",
    "cumdump",
}

NEEDS_FEMALE = {
    "vaginal",
    "paizuri",
    "paizuri under clothes",
    "cunnilingus",
    "upskirt",
    "pussy",
    "pussy focus",
    "pussy juice",
    "spread pussy",
    "cowgirl position",
    "reverse cowgirl position",
    "missionary",
    "mating press",
    "after vaginal",
    "cum in pussy",
    "female ejaculation",
    "tribadism",
    "huge breasts",
    "large breasts",
    "gigantic breasts",
    "medium breasts",
    "small breasts",
    "flat chest",
    "sagging breasts",
    "nipples",
    "mature female",
    "female pubic hair",
    "upright straddle",
    "reverse upright straddle",
    "piledriver (sex)",
    "thigh sex",
    "mmf threesome",
    "ffm threesome",
    "lactation",
    "breastfeeding",
    "nurse",
    "waitress",
    "policewoman",
    "flight attendant",
    "idol",
    "cum on breasts",
    # 精液落在對方身上，或陰莖貼在對方臉上。只有 male 時，單人男生會變成被射的那一個。
    "cum in mouth",
    "facial",
    "gokkun",
    "cum on tongue",
    "cum on hair",
    "cum on body",
    "cum on stomach",
    "cum on legs",
    "cum on feet",
    "cum on hands",
    "cum on clothes",
    "cum in ass",
    "cum overflow",
    "internal cumshot",
    "excessive cum",
    "after anal",
    "penis over eyes",
    "penis on face",
    "looking at penis",
    "cum pool",
    "stomach bulge",
    "cum on pussy",
    "nursing handjob",
    "straddling paizuri",
    "mutual masturbation",
    "licking nipple",
    "leg lock",
    "grabbing from behind",
    "kissing neck",
    "head between breasts",
    "breast smother",
    "spanking",
    "pussy juice trail",
    "pussy juice puddle",
    "anal fingering",
    "tentacle sex",
    "tentacles",
    "folded",
    "spread ass",
    "sideboob",
    "underboob",
    "backboob",
    "bodystocking",
    "pasties",
    "torn thighhighs",
    "butt plug",
    "anal beads",
    "hickey",
    "crotch rope",
    "rape",
    "after rape",
    "rough sex",
    "strangling",
    "neck grab",
    "headlock",
    "rear naked choke",
    "asphyxiation",
    "slap mark",
    # 內射受孕要有被內射的女生。抓手腕是男生抓住女生的手腕。
    # 按住頭、抓頭髮的對象是女生。
    "impregnation",
    "holding another's wrist",
    "hand on another's head",
    "grabbing another's hair",
    "sex machine",
    "large insertion",
    "triple penetration",
    "urethral insertion",
    "armpit sex",
    "egg laying",
    "cervical penetration",
    "nipple penetration",
    "fisting",
    "inflation",
    "cum inflation",
    "prolapse",
    "anal prolapse",
    "breast expansion",
    "pubic tattoo",
    "tally",
    "quadruple amputee",
    "crotchless",
    "chastity belt",
    "nipple tassels",
    "public vibrator",
    "long nipples",
    "minigirl",
    "giantess",
    "pussy peek",
    "excessive pussy juice",
    "lactation through clothes",
    "milking machine",
    "breast pump",
    "nipple pull",
    "double anal",
    "double vaginal",
    "anal fisting",
    "urethral fingering",
    "enema",
    "egg implantation",
    "navel penetration",
    "penis size difference",
    "cum in nose",
    "cum through clothes",
    "cum bubble",
    "cumdump",
}

NEEDS_PAIR = {
    "sex",
    "kiss",
    "french kiss",
    "looking at another",
    "eye contact",
    "hug",
    "cuddling",
    "straddling",
    "hug from behind",
    "sitting on lap",
    "lifting person",
    "happy sex",
    "ass grab",
    "breast sucking",
    "guided penetration",
    "imminent penetration",
    "grabbing another's breast",
    "grabbing another's ass",
    "grabbing another's hair",
    "guided breast grab",
    "threesome",
    "group sex",
    "mmf threesome",
    "ffm threesome",
    "spitroast",
    "double penetration",
    "69",
    "clothed sex",
    "public indecency",
    "cowgirl position",
    "reverse cowgirl position",
    "doggystyle",
    "missionary",
    "mating press",
    "standing sex",
    "fellatio",
    "cunnilingus",
    "paizuri",
    "handjob",
    "testicle sucking",
    "testicle grab",
    "sitting on face",
    "tribadism",
    "upright straddle",
    "reverse upright straddle",
    "reverse suspended congress",
    "piledriver (sex)",
    "boy on top",
    "thigh sex",
    "frottage",
    "reverse spitroast",
    "washing back",
    "shared bathing",
    "netorare",
    "cheating (relationship)",
    "groping",
    "chikan",
    "breastfeeding",
    "carrying",
    "size difference",
    "gangbang",
    "afterglow",
    "foursome",
    "fivesome",
    "penis awe",
    "rape",
    "after rape",
    "rough sex",
    "strangling",
    "neck grab",
    "headlock",
    "rear naked choke",
    "asphyxiation",
    "slap mark",
    "impregnation",
    "holding another's wrist",
    "hand on another's head",
    "double anal",
    "double vaginal",
    "penis size difference",
}

NEEDS_GROUP = {
    "threesome",
    "group sex",
    "mmf threesome",
    "ffm threesome",
    "spitroast",
    "reverse spitroast",
    "double penetration",
    "gangbang",
    "foursome",
    "fivesome",
    "surrounded by penises",
    "triple penetration",
    "double anal",
    "double vaginal",
}

NEEDS_CROWD = {
    "gangbang",
    "foursome",
    "fivesome",
}

NEEDS_2MALE = {
    "mmf threesome",
    "spitroast",
    "reverse spitroast",
    "double penetration",
    "double handjob",
    "surrounded by penises",
    "bukkake",
    "triple penetration",
    "double anal",
    "double vaginal",
}

NEEDS_2FEMALE = {
    "ffm threesome",
    "cooperative handjob",
}

# 5 人。不進 castWeights，只給釘選與性愛時的低機率升級用。
NEEDS_FIVE = {
    "fivesome",
}

NEED_KEYS = {"female", "male", "pair", "yuri", "yaoi", "group", "crowd", "2male", "2female", "five"}

YURI_ONLY = {
    "tribadism",
}


def apply_relations(tag: str, implies: list[str], bind: list[str], mutex, section, gate, layer, heat, era, needs):
    if tag in RECLASS:
        rc = RECLASS[tag]
        if "mutex" in rc:
            mutex = rc["mutex"]
        if "section" in rc:
            section = rc["section"]
        if "gate" in rc:
            gate = rc["gate"]
        if "layer" in rc:
            layer = rc["layer"]
        if "heat" in rc:
            heat = list(rc["heat"])
        if "era" in rc:
            era = list(rc["era"])
        if "needs" in rc:
            needs = list(rc["needs"])
    im = list(implies)
    if tag in IMPLIES:
        for x in IMPLIES[tag]:
            if x not in im and x != tag:
                im.append(x)
    for suf in SUFFIX_PARENT:
        if tag != suf and tag.endswith(" " + suf):
            if tag.startswith("no "):
                continue
            if section != "clothing":
                continue
            skip = SUFFIX_COMPOUND_EXCEPTIONS.get(suf) or ()
            if any(tag == c or tag.endswith(" " + c) for c in skip):
                continue
            if suf not in im:
                im.append(suf)
    if tag.endswith(" kimono") and tag != "kimono":
        if "kimono" not in im:
            im.append("kimono")
        if "japanese clothes" not in bind:
            bind = list(bind) + ["japanese clothes"]
    if tag.endswith(" yukata") and tag != "yukata":
        if "yukata" not in im:
            im.append("yukata")
        if "japanese clothes" not in bind:
            bind = list(bind) + ["japanese clothes"]
    # 具體民族服裝把類別帶出來。旗袍、唐裝是現代單品，不帶只有古代的中式服裝。
    culture_parent = {
        "hanbok": "korean clothes",
        "ao dai": "vietnamese clothes",
        "dirndl": "german clothes",
        "toga": "roman clothes",
        "peplos": "ancient greek clothes",
        "hanfu": "chinese clothes",
    }.get(tag)
    if culture_parent and culture_parent not in im:
        im.append(culture_parent)
    # 彈吉他是演奏的一種。不改舊的那一列，只在這裡補上。
    if tag == "playing guitar" and "playing instrument" not in im:
        im.append("playing instrument")
    if section == "clothing" and "one-piece swimsuit" in tag and tag != "one-piece swimsuit":
        if "one-piece swimsuit" not in im:
            im.append("one-piece swimsuit")
        if "swimsuit" not in im:
            im.append("swimsuit")
    # 運動內衣在 Danbooru 的分類裡不是 bra：sports_bra 沒有任何 implication，
    # 顏色款只 implies sports_bra。我們自己補的 -> bra 是訓練集裡沒有的組合，
    # 也是「black sports bra, sports bra, bra」這種三連的來源。
    if tag.endswith(" sports bra") and "sports bra" not in im:
        im.append("sports bra")
    if section == "env" and mutex == "day_night":
        im = [x for x in im if x not in ("indoors", "outdoors")]
    elif section == "env" and mutex not in ("place", "in_out"):
        im = [x for x in im if x not in ("indoors", "outdoors", "day", "night")]
    if tag in EXPRESSION:
        mutex = "expression"
    if tag in HAIR_STYLE_MUTEX:
        mutex = "hair_style"
    return im, bind, mutex, section, gate, layer, heat, era, needs


# gaze／expression 會被 widen_heat 攤成三檔。這兩個只能停在走光或性愛，
# 否則「看著陰莖」會進誘惑。
NARROW_HEAT = {
    "sleeping upright": ["tease", "flash"],
    # 2026-10-24 第四輪：這些是脫衣／裸身狀態，不能由服裝通則攤到誘惑。
    "naked cape": ["flash", "sex"],
    "naked sheet": ["flash", "sex"],
    "nude cover": ["flash", "sex"],
    "partially undressed": ["flash", "sex"],
    "no shirt": ["flash", "sex"],
    "no pants": ["flash", "sex"],
    "looking at penis": ["flash", "sex"],
    "penis awe": ["sex"],
    # expression 會把熱度攤成三檔。驚嘆胸是看見胸部的反應，不停在誘惑。
    "breast awe": ["flash", "sex"],
    # 衣物不在 CLOTHING_STATE 會被 widen_heat 攤成三檔。這些是性愛當下或事後的物件，
    # 不該在誘惑裡當配件。一般的 condom 維持三檔，那是已經出貨的行為。
    "used condom": ["sex"],
    "holding condom": ["sex"],
    "condom in mouth": ["sex"],
    "condom wrapper": ["sex"],
    "condom box": ["sex"],
    # 場地跟傢俱本來會被 widen 成三檔。這兩個只在性愛成立。
    "glory hole": ["sex"],
    "wooden horse": ["sex"],
    # 場地和傢俱會被 widen 成三檔。這兩個只在性愛成立。
    "tentacle pit": ["sex"],
    "vacuum bed": ["sex"],
    # 2026-10-24 建議池：走光／露點，不能被服裝或姿勢通則攤進誘惑。
    'wide spread legs': ['flash', 'sex'],
    'spread pussy under clothes': ['flash', 'sex'],
    'covering nipples': ['flash', 'sex'],
    'clothed female nude female': ['flash', 'sex'],
    'open fly': ['flash', 'sex'],
    'sideless shirt': ['flash', 'sex'],
    # 沒有罩杯，乳頭露出。服裝通則會攤成三檔。
    'cupless bra': ['flash', 'sex'],
}
# 2026-10-26 衣服一批裡，熱度不能被服裝通則攤開的字。
NARROW_HEAT.update(CLOTHING_NARROW)
NARROW_HEAT.update(ENV_NARROW)
NARROW_HEAT.update(POSE_NARROW)
NARROW_HEAT.update(QUALITY_NARROW)
UMBRELLA.update(UMBRELLA_EXTRA)


def widen_heat(tag: str, section: str, mutex, layer: str, heat: list[str]) -> list[str]:
    """Outfits, places, sitting, looking, and clothes-moves are not a heat."""
    heat = [h for h in heat if h in HEATS] or list(HEATS)
    if tag in NARROW_HEAT:
        return [h for h in NARROW_HEAT[tag] if h in HEATS]
    if tag in {"nude", "completely nude"}:
        return list(HEATS)
    if section == "clothing" and layer != "skin" and tag not in CLOTHING_STATE:
        return list(HEATS)
    if section == "env":
        return list(HEATS)
    if section == "feature" and tag in {"wet hair", "wet"}:
        return list(HEATS)
    if section != "pose":
        return heat
    if mutex == "sex_act" or tag in SEX_ACT or tag in POSE_CLIMAX:
        return heat
    if mutex in {"body_pose", "camera", "gaze", "expression", "activity"}:
        if tag in {"sleeping", "dancing"}:
            return [h for h in HEATS if h != "sex"]
        return list(HEATS)
    if mutex == "clothes_action":
        keep = set(heat) | {"flash", "sex"}
        return [h for h in HEATS if h in keep]
    if "sex" not in heat:
        keep = set(heat) | {"sex"}
        if "tease" in heat:
            keep.add("flash")
        return [h for h in HEATS if h in keep]
    if set(heat) == {"tease", "sex"}:
        return list(HEATS)
    return heat


def inherit_eras(tags: list[dict]) -> None:
    """A colour variant must not be wider than its parent (blue necktie ≠ 中世紀)."""
    by = {t["tag"]: t for t in tags}
    order = [
        "modern",
        "victorian",
        "edo",
        "medieval",
        "ancient_china",
        "ancient_greece",
    ]

    def restricted(tag: str) -> list[str] | None:
        item = by.get(tag)
        if not item:
            return None
        e = item.get("era") or ["any"]
        if not e or "any" in e:
            return None
        return e

    for item in tags:
        e = item.get("era") or ["any"]
        if e and "any" not in e:
            continue
        parents: list[list[str]] = []
        for p in list(item.get("implies") or []) + list(item.get("bind") or []):
            pe = restricted(p)
            if pe:
                parents.append(pe)
        tag = item["tag"]
        for suf in SUFFIX_PARENT:
            if tag != suf and tag.endswith(" " + suf):
                pe = restricted(suf)
                if pe:
                    parents.append(pe)
        if not parents:
            continue
        acc = set(parents[0])
        for pe in parents[1:]:
            hit = acc & set(pe)
            acc = hit if hit else acc | set(pe)
        item["era"] = [x for x in order if x in acc] or sorted(acc)
        item["group"] = assign_group(item)


# ---- 第六輪（2026-10-06）：動物種類、補互斥格、補帶出 ----------------------------------
#
# 動物種類（kind）：同一種的耳朵、尾巴、角、種族可以一起出現，不同種不行 ——
# 貓耳配狐娘、兔尾配狐尾、龍角配惡魔角都是兩個角色的零件湊在一個人身上。
# 這件事不是互斥格表達得了的（同種的耳朵和尾巴要能並存），所以另外一欄，
# 由 engine.js 的 allow() 檢查：圖上已經有某一種，就不再補別種的零件。
# 沒有種類的字（獸耳、尾巴、精靈、吸血鬼……）跟誰都能放。
KIND = {
    "cat": ["cat girl", "cat boy", "cat ears", "cat tail", "nekomata"],
    "fox": ["fox girl", "fox boy", "kitsune", "fox ears", "fox tail", "kyuubi"],
    "rabbit": ["rabbit girl", "rabbit boy", "rabbit ears", "rabbit tail"],
    "horse": ["horse girl", "horse boy", "horse ears", "horse tail", "centaur", "centauroid"],
    "wolf": ["wolf girl", "wolf boy", "werewolf", "wolf ears"],
    "dog": ["dog girl", "dog boy", "dog ears", "dog tail"],
    "dragon": ["dragon girl", "dragon boy", "dragon horns", "dragon", "eastern dragon", "western dragon", "dragon wings"],
    "demon": ["demon", "demon girl", "demon boy", "demon horns", "demon tail", "demon wings"],
    "cow": ["cow girl", "cow ears", "cow tail"],
    "tiger": ["tiger boy", "tiger ears", "tiger tail"],
    "lion": ["lion boy", "lion ears", "lion tail"],
    "bear": ["bear boy", "bear ears"],
    "mouse": ["mouse ears", "mouse tail"],
    "raccoon": ["raccoon ears", "raccoon tail"],
    "deer": ["deer ears"],
    "sheep": ["sheep ears"],
    "goat": ["goat ears"],
    "squirrel": ["squirrel ears", "squirrel tail"],
    "bat": ["bat ears"],
    "panda": ["panda ears"],
    "shark": ["shark boy", "shark tail"],
    "tanuki": ["tanuki"],
    "fairy": ["fairy", "fairy wings"],
    "monkey": ["monkey tail"],
    "bird": ["bird tail"],
    "snake": ["snake tail"],
}
KIND_OF = {t: k for k, tags in KIND.items() for t in tags}

# 既有的字補上額外互斥格（新字自己在 row 裡寫）。
#   bangs：瀏海只會有一種（齊瀏海、側撥、中分、交叉）。
#   sleeve_len：袖長只會有一種（無袖、短袖、長袖、袖過手腕）。父子（泡泡短袖 → 短袖）不算兩種。
#   bare_long／bare_elbow／bare_det：手臂露出來（bare arms）分別跟長袖、過肘手套、分離袖不並存，
#     但後三者之間照舊可以疊（長袖配分離袖是常見的穿法），所以是三格不是一格。
#   nail_color：指甲只塗一種顏色。
#   wing_type：翅膀只有一種（天使翼是羽毛翼的一種，父子不算兩種）。
#   hood_up／hood_on：兜帽放下分別跟「戴上兜帽」「兜帽」不並存（後兩者是同一個狀態，不互斥）。
#   strap：無肩帶跟繞頸不並存。
#   season：夏天跟冬天不並存。
MUTEX_EXTRA_PATCH = {
    "blunt bangs": ["bangs"],
    "swept bangs": ["bangs"],
    "parted bangs": ["bangs"],
    "bangs pinned back": ["bangs"],
    "long sleeves": ["sleeve_len", "bare_long"],
    "short sleeves": ["sleeve_len"],
    "elbow gloves": ["bare_elbow"],
    "detached sleeves": ["bare_det"],
    "red nails": ["nail_color"],
    "pink nails": ["nail_color"],
    "angel wings": ["wing_type"],
    "demon wings": ["wing_type"],
    "hood up": ["hood_up"],
    "hood": ["hood_on"],
    "halterneck": ["strap"],
    "winter": ["season"],
    # 白皙、深膚、極深、黑膚的膚色格在 engine.js 已經補上。晒黑沒有，會跟白皙疊。
    "tan": ["skin_tone"],
    "red lips": ["lip_color"],
    "headphones": ["ear_audio"],
    "earbuds": ["ear_audio"],
    "headset": ["ear_audio"],
}

# 既有的字補上 Danbooru 的父子關係，讓新加的父標籤跟著出現、也不跟子標籤互斥。
IMPLIES.update({
    "hair ribbon": ["ribbon"],
    "neck ribbon": ["ribbon"],
    "highleg panties": ["panties", "highleg"],
    "highleg leotard": ["leotard", "highleg"],
    "cleavage cutout": ["clothing cutout"],
    "strapless dress": ["dress", "strapless"],
    "plaid skirt": ["skirt", "plaid clothes"],
    "floral print kimono": ["print kimono", "floral print"],
    "angel wings": ["wings", "feathered wings"],
    "green skin": ["colored skin"],
    # 新的「騎乘」跟既有的騎馬、騎車、講電話佔同一格，要接成父子才不會互相趕出去。
    "horseback riding": ["riding"],
    "riding bicycle": ["riding"],
    "talking on phone": ["talking"],
})

def norm(item: dict) -> dict | None:
    tag = str(item.get("tag") or "").strip().lower().replace("_", " ")
    if not tag or (tag in BANNED and not item.get("listed_block")):
        return None
    section = item.get("section") or "feature"
    if section not in SECTIONS:
        return None
    gate = item.get("gate") or "any"
    if gate not in GATES:
        gate = "any"
    heat = item.get("heat") or list(HEATS)
    heat = [h for h in heat if h in HEATS] or list(HEATS)
    era = item.get("era") or ["any"]
    if not isinstance(era, list):
        era = ["any"]
    mutex = item.get("mutex") or None
    if mutex in ("", "null"):
        mutex = None
    bind = [str(x).replace("_", " ") for x in (item.get("bind") or [])]
    implies = [str(x).replace("_", " ") for x in (item.get("implies") or [])]
    layer = item.get("layer") or "normal"
    needs = [str(x) for x in (item.get("needs") or []) if x in NEED_KEYS]
    implies, bind, mutex, section, gate, layer, heat, era, needs = apply_relations(
        tag, implies, bind, mutex, section, gate, layer, heat, era, needs
    )
    seen_needs = set(needs)
    needs = list(needs)
    if tag in NEEDS_MALE and "male" not in seen_needs:
        needs.append("male")
        seen_needs.add("male")
    if tag in NEEDS_FEMALE and "female" not in seen_needs:
        needs.append("female")
        seen_needs.add("female")
    if tag in NEEDS_PAIR and "pair" not in seen_needs:
        needs.append("pair")
        seen_needs.add("pair")
    if tag in SEX_ACT and tag not in SOLO_SEX_ACT and "pair" not in seen_needs:
        needs.append("pair")
        seen_needs.add("pair")
    if tag in NEEDS_GROUP and "group" not in seen_needs:
        needs.append("group")
        seen_needs.add("group")
    if tag in NEEDS_CROWD and "crowd" not in seen_needs:
        needs.append("crowd")
        seen_needs.add("crowd")
    if tag in NEEDS_2MALE and "2male" not in seen_needs:
        needs.append("2male")
        seen_needs.add("2male")
    if tag in NEEDS_2FEMALE and "2female" not in seen_needs:
        needs.append("2female")
        seen_needs.add("2female")
    if tag in NEEDS_FIVE and "five" not in seen_needs:
        needs.append("five")
        seen_needs.add("five")
    if tag in YURI_ONLY and "yuri" not in seen_needs:
        needs.append("yuri")
        seen_needs.add("yuri")
    mutex_extra: list[str] = [str(g) for g in (item.get("mutexExtra") or []) if g]
    for g in MUTEX_EXTRA_PATCH.get(tag, ()):
        if g not in mutex_extra:
            mutex_extra.append(g)
    if tag in SEX_ACT:
        if mutex and mutex != "sex_act":
            mutex_extra.append("sex_act")
        elif mutex != "sex_act":
            mutex = "sex_act"
    if tag in UMBRELLA:
        if mutex == "sex_act" or tag in SEX_ACT:
            if "sex_act" not in mutex_extra:
                mutex_extra.append("sex_act")
        # 服裝的傘狀父項**保留**互斥格。
        #
        # 原本一律清成 None，理由是「父項靠子項的 implies 進場，父子不該搶同一格」。
        # 那對「子項被抽到、父項跟著進來」是對的，但漏掉了另一半：**父項自己被抽到
        # 或被釘選**的時候，那一格就沒有人佔，引擎會以為主衣還空著。
        #
        # 實測（釘選，800 張）：
        #   white dress / micro bikini（有 onepiece 格）→ 不會再有上衣下身
        #   dress / bikini（被清成 None）→ shirt 261、skirt 258、pants 142、sweater 111
        # 也就是說釘「比基尼」會得到比基尼配襯衫加裙子。
        #
        # 父子不會互相驅逐：occupy() 和 implies 那條路徑都有 parentChild() 保護，
        # 所以子項照樣進得來；改變的只是「父項先佔住之後，子項不再另外加一件」——
        # 而那本來就是多餘的（子項的 implies 一定會把父項帶進來）。
        # 但時代服飾那一家例外，它們本來就是可以分層穿的：和服配袴、鎧甲配零件。
        # 讓 kimono／japanese clothes 佔住主衣格，袴就永遠配不上和服了
        # （實測 hakama 與 pelvic curtain 會直接變成抽不到）。
        # 只留真的有「佔下身格的分層夥伴」的那兩家：
        #   edo           -> hakama（mutex=bottom）
        #   ancient_china -> pelvic curtain（mutex=bottom）
        # 中世紀與古希臘查過沒有這種夥伴（armor 的同伴 tabard／cape／cloak 全是
        # outer，不衝突），所以它們照樣佔主衣格 —— 不然穿著鎧甲還會再加一件裙子，
        # 實測中世紀 skirt 因此衝到 61%，越過「沒有哪一件衣服佔掉一個時代過半」那條線。
        LAYERED_FAMILY = {
            "kimono", "yukata", "japanese clothes", "chinese clothes",
        }
        if section != "clothing" or tag in LAYERED_FAMILY:
            mutex = None
    if tag in ERA_OF:
        era = list(ERA_OF[tag])
    needs = [x for x in needs if x in NEED_KEYS]
    heat = widen_heat(tag, section, mutex, layer, heat)
    group_input = {
        "tag": tag,
        "section": section,
        "gate": gate,
        "heat": heat,
        "mutex": mutex,
        "layer": layer,
        "era": era,
    }
    # 角色不靠 mutex 分類。extra_character_tags() 帶 group=character 進來。
    if item.get("group") == "character":
        group_input["group"] = "character"
    out = {
        "tag": tag,
        "section": section,
        "gate": gate,
        "heat": heat,
        "mutex": mutex,
        "bind": bind,
        "implies": implies,
        "layer": layer,
        "era": era,
        "group": assign_group(group_input),
    }
    # 卡面與作品。只有角色條目帶這兩欄，Opus 的卡面與「加入系列名」會讀。
    series = str(item.get("series") or "").strip()
    card_positive = str(item.get("cardPositive") or "").strip()
    if series:
        out["series"] = series
    if card_positive:
        out["cardPositive"] = card_positive
    # 細分類。assign_sub 只在拆開的小分類（角色）採用已登記的 id。
    hinted_sub = item.get("sub")
    if isinstance(hinted_sub, str) and hinted_sub:
        out["sub"] = hinted_sub
    if needs:
        out["needs"] = needs
    if mutex_extra:
        out["mutexExtra"] = mutex_extra
    if tag in KIND_OF:
        out["kind"] = KIND_OF[tag]
    return out


def extra_style_tags() -> list[dict]:
    """Optional look. Pin to add; never auto-drawn.

    coloring：上色／媒材互斥。line_weight：線條粗細。era_style：年代畫風。
    drop shadow 可跟平塗／賽璐璐疊，不加 mutex。"""
    rows = [
        # cel shading 拿掉（2026-09-28）：Danbooru 2024-08 以「意思含糊」停用，貼文改標成
        # anime coloring（2D 賽璐璐）或 cel rendering（3D 卡通渲染）。模型學到的是兩種混在一起，
        # 釘了會不知道畫哪一種；2D 那個意思就是下面的 anime coloring。
        ("anime coloring", "動畫上色", "coloring"),
        ("flat color", "平塗", "coloring"),
        ("watercolor (medium)", "水彩", "coloring"),
        ("screentones", "網點", "coloring"),
        ("lineart", "線稿", "coloring"),
        ("monochrome", "單色", "coloring"),
        ("thick outlines", "粗線", "line_weight"),
        ("1990s (style)", "1990s 畫風", "era_style"),
        ("2000s (style)", "2000s 畫風", "era_style"),
        ("retro artstyle", "復古畫風", "era_style"),
        ("drop shadow", "平塗陰影", None),
    ]
    return [
        {
            "tag": tag,
            "section": "quality",
            "gate": "any",
            "heat": list(HEATS),
            "mutex": mutex,
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": [],
            "zh": zh,
        }
        for tag, zh, mutex in rows
    ]


def extra_look_tags() -> list[dict]:
    """背景、用色／媒材、打光、畫面特效、構圖（2026-09-26）。

    每個字都先用 verify_danbooru_tags.mjs 查過：category 0、post_count > 0、沒有 deprecated。
    查掉的：multicolored background、starry background（deprecated）；oil painting (medium)、
    traditional media、anime screencap、official art、game cg（category 5，不是一般 tag）；
    muted color、vibrant colors、cinematic lighting、dramatic lighting、dynamic angle（0 張）；
    rim lighting（不存在）。sketch 仍在共同負面，不收。multiple views 已改成可抽的鏡頭。

    背景：純色／圖樣背景就是「沒有場景」，所以它除了自己的 background 格，還佔住
    place、in_out、day_night —— 有白背景就不會再抽出臥室、室內或夜晚，反過來也一樣。
    顏色背景 implies simple background（Danbooru 上兩者幾乎總是一起標），父子不互相驅逐。
    blurry background 是景深，跟任何場地都合得來，只佔自己的 bg_blur。
    """
    all_h = list(HEATS)
    any_era = ["any"]
    # bg_blur：純色背景上沒有東西可以模糊，跟 blurry background 二選一。
    solid = ["place", "in_out", "day_night", "bg_blur"]

    def row(tag, section, mutex, zh, implies=None, extra=None):
        out = {
            "tag": tag,
            "section": section,
            "gate": "any",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": any_era,
            "needs": [],
            "zh": zh,
        }
        if extra:
            out["mutexExtra"] = list(extra)
        return out

    simple = ["simple background"]
    bg = [
        row("simple background", "env", "background", "素色背景", extra=solid),
        row("white background", "env", "background", "白背景", simple, solid),
        row("black background", "env", "background", "黑背景", simple, solid),
        row("grey background", "env", "background", "灰背景", simple, solid),
        row("blue background", "env", "background", "藍背景", simple, solid),
        row("pink background", "env", "background", "粉紅背景", simple, solid),
        row("yellow background", "env", "background", "黃背景", simple, solid),
        row("red background", "env", "background", "紅背景", simple, solid),
        row("gradient background", "env", "background", "漸層背景", simple, solid),
        row("two-tone background", "env", "background", "雙色背景", simple, solid),
        row("polka dot background", "env", "background", "圓點背景", extra=solid),
        row("striped background", "env", "background", "條紋背景", extra=solid),
        row("floral background", "env", "background", "花紋背景", extra=solid),
        row("halftone background", "env", "background", "網點背景", extra=solid),
        row("sparkle background", "env", "background", "閃光背景", extra=solid),
        row("abstract background", "env", "background", "抽象背景", extra=solid),
        row("blurry background", "env", "bg_blur", "背景模糊"),
    ]
    style = [
        row("pixel art", "quality", "medium", "像素畫"),
        row("ukiyo-e", "quality", "medium", "浮世繪"),
        row("chibi", "quality", None, "Q 版"),
        row("greyscale", "quality", "coloring", "灰階", ["monochrome"]),
        row("spot color", "quality", "palette", "局部上色", ["monochrome"]),
        row("partially colored", "quality", "palette", "部分上色"),
        row("pastel colors", "quality", "palette", "粉彩色"),
        row("muted colors", "quality", "palette", "低彩度"),
        row("limited palette", "quality", "palette", "限色"),
        row("colorful", "quality", "palette", "繽紛"),
        row("high contrast", "quality", "palette", "高對比"),
        row("sepia", "quality", "palette", "復古棕"),
    ]
    light = [
        row("light rays", "env", "lighting", "光束"),
        row("sunbeam", "env", "lighting", "陽光光柱"),
        row("dappled sunlight", "env", "lighting", "樹影斑駁"),
        row("silhouette", "env", "silhouette", "剪影"),
    ]
    effect = [
        row("light particles", "env", "effect", "光粒子"),
        row("sparkle", "env", "effect", "閃光"),
        row("petals", "env", "effect", "花瓣"),
        row("falling petals", "env", "effect", "飄落花瓣", ["petals"]),
        # 落葉要有樹：帶 outdoors，室內場地和純色背景自然就排掉了。
        row("falling leaves", "env", "effect", "落葉", ["outdoors"]),
        row("bubble", "env", "effect", "泡泡"),
        row("confetti", "env", "effect", "彩紙"),
        row("lens flare", "env", "effect", "鏡頭光暈"),
        row("bloom", "env", "effect", "柔光溢出"),
        row("motion blur", "env", "effect", "動態模糊"),
        row("speed lines", "env", "effect", "速度線"),
        row("emphasis lines", "env", "effect", "集中線"),
    ]
    camera = [
        row("very wide shot", "pose", "camera", "大遠景"),
        row("foreshortening", "pose", "perspective", "透視前縮"),
        # Danbooru：bird's eye view → from_above，worm's eye view → from_below。
        row("bird's eye view", "pose", "camera", "鳥瞰", ["from above"]),
        row("worm's eye view", "pose", "camera", "貼地仰視", ["from below"]),
    ]
    # 沒有人物（2026-09-26）：no humans 237k、scenery 75k、solo focus 507k。三個都只能釘，
    # 引擎不會隨機抽（engine allow() 擋著）。no humans 釘上之後那一張只畫場景（engine drawNoHumans）。
    # solo focus 不給人釘也行：畫面有人群（crowd）又只有一個主角時，引擎把 solo 換成它。
    people = [
        row("no humans", "subject", None, "沒有人物"),
        row("scenery", "env", None, "風景"),
        row("solo focus", "subject", None, "單人焦點"),
        # people 9.7k：跟 crowd 一樣是主角以外的人，歸背景，只能釘。
        row("people", "env", None, "路人"),
    ]
    return bg + style + light + effect + camera + people


def extra_quality_boost_tags() -> list[dict]:
    """Optional. WAI does not need these on every card."""
    rows = [
        ("absurdres", "超高解析", None),
        ("highres", "高解析", None),
        ("very aesthetic", "非常有美感", "aesthetic"),
        ("highly aesthetic", "極有美感", "aesthetic"),
        ("newest", "最新風", None),
    ]
    return [
        {
            "tag": tag,
            "section": "quality",
            "gate": "any",
            "heat": list(HEATS),
            "mutex": mutex,
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": [],
            "zh": zh,
        }
        for tag, zh, mutex in rows
    ]


def extra_loli_tags() -> list[dict]:
    """Adult petite, small bust."""
    return [
        {
            "tag": "petite",
            "section": "feature",
            "gate": "female",
            "heat": list(HEATS),
            "mutex": "height",
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": ["female"],
            "zh": "嬌小",
        },
        {
            "tag": "flat chest",
            "section": "feature",
            "gate": "female",
            "heat": list(HEATS),
            "mutex": "breast_size",
            "bind": [],
            # Danbooru 上 flat_chest 沒有任何 implication —— 平胸和小胸是同一把尺上
            # 的兩個點，不是父子。而且兩個都是 mutex=breast_size，串起來等於在同一格
            # 塞兩個互斥的值：實測 17% 的圖同時寫著「平胸」和「小胸」。
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": ["female"],
            "zh": "平胸",
        },
        {
            "tag": "loli",
            "section": "feature",
            "gate": "female",
            "heat": list(HEATS),
            "mutex": "height",
            "bind": [],
            "implies": ["petite", "flat chest"],
            "layer": "normal",
            "era": ["any"],
            "needs": ["female"],
            "zh": "蘿莉",
        },
    ]


def extra_shota_tags() -> list[dict]:
    """Adult short male. Not a child tag."""
    return [
        {
            "tag": "short male",
            "section": "feature",
            "gate": "male",
            "heat": list(HEATS),
            "mutex": "height_m",
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": ["male"],
            "zh": "矮個男性",
        },
        {
            "tag": "tall male",
            "section": "feature",
            "gate": "male",
            "heat": list(HEATS),
            "mutex": "height_m",
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": ["male"],
            "zh": "高個男性",
        },
        {
            "tag": "shota",
            "section": "feature",
            "gate": "male",
            "heat": list(HEATS),
            "mutex": "height_m",
            "bind": [],
            "implies": ["short male"],
            "layer": "normal",
            "era": ["any"],
            "needs": ["male"],
            "zh": "正太",
        },
    ]


def extra_minor_block_tags() -> list[dict]:
    """看起來未成年的字。詞庫有一筆，但是底線封鎖：不是牌、抽不到、釘不住。

    children 不在這裡。它在 BANNED，norm() 會整筆丟掉；HARD_BANNED 另外擋貼上與送出。
    child 也在 BANNED，但專案主要它進詞庫（2026-10-25）：標 listed_block，norm() 才不丟。
    BANNED 照留，改名工具、harvest 仍靠它擋含 child 的新名字。
    oppai loli 不 implies loli（loli 會帶出平胸）。兩件制服不 implies school uniform。
    child carry 照 Danbooru implies carrying（封鎖字不會被抽，帶的字不影響）。
    """

    def one(tag, zh, section, gate="any", needs=(), mutex=None, implies=(), era=None, layer="normal"):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(HEATS),
            "mutex": mutex,
            "bind": [],
            "implies": list(implies),
            "layer": layer,
            "era": list(era or ["any"]),
            "needs": list(needs),
            "zh": zh,
        }

    return [
        one("aged down", "年下", "feature"),
        one("onee-shota", "姊姊×正太", "subject", needs=("male", "female", "pair"), implies=("shota",)),
        one("oppai loli", "巨乳蘿莉", "feature", gate="female", needs=("female",), mutex="height"),
        one("baby", "嬰兒", "feature"),
        one("kodomo doushi", "孩童之間", "pose", needs=("pair",)),
        one("toddlercon", "幼童性相關", "pose"),
        one("toddlersex", "幼童性交", "pose", needs=("pair",)),
        one("mother and child", "母與幼子", "subject", gate="female", needs=("female", "pair")),
        one("father and child", "父與幼子", "subject", gate="male", needs=("male", "pair")),
        one("carrying baby", "抱嬰兒", "pose", implies=("baby",)),
        one(
            "kindergarten uniform", "幼稚園制服", "clothing",
            mutex="onepiece", era=("modern",), layer="garment",
        ),
        one(
            "tomoeda elementary school uniform", "友枝小學制服", "clothing",
            gate="female", needs=("female",), mutex="onepiece", era=("modern",), layer="garment",
        ),
        one("child carry", "抱孩童", "pose", needs=("pair",), implies=("carrying",)),
        {**one("child", "孩童", "feature"), "listed_block": True},
    ]


def extra_sex_position_tags() -> list[dict]:
    """Verified Danbooru sex positions missing from harvest parts."""
    sex = ["sex"]

    def P(tag, needs, gate="any", zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": gate,
            "heat": sex,
            "mutex": "sex_act",
            "bind": [],
            "implies": ["sex"],
            "layer": "normal",
            "era": ["any"],
            "needs": list(needs),
            "zh": zh,
        }

    return [
        P("upright straddle", ["pair", "male", "female"], zh="對面坐位"),
        P("reverse upright straddle", ["pair", "male", "female"], zh="背面坐位"),
        P("reverse suspended congress", ["pair", "male"], zh="背面懸空"),
        P("piledriver (sex)", ["pair", "male", "female"], zh="打樁機體位"),
        P("boy on top", ["pair", "male"], gate="male", zh="男上"),
        P("thigh sex", ["pair", "male", "female"], zh="股交"),
        P("frottage", ["pair"], zh="互相摩擦"),
        P("reverse spitroast", ["pair", "male"], zh="反向兩端夾擊"),
    ]


def extra_bath_tags() -> list[dict]:
    """Bathing, showering, swimming, onsen-side activities and places."""
    all_h = list(HEATS)
    edo_mod = ["edo", "modern"]

    def pose(tag, mutex="activity", implies=None, needs=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": "any",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    def env(tag, mutex="place", implies=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "env",
            "gate": "any",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or ["any"],
            "zh": zh,
        }

    def cloth(tag, era=None, zh=""):
        return {
            "tag": tag,
            "section": "clothing",
            "gate": "any",
            "heat": all_h,
            "mutex": None,
            "bind": [],
            "implies": [],
            "layer": "accessory",
            "era": era or ["any"],
            "zh": zh,
        }

    return [
        pose("bathing", zh="泡澡"),
        pose("showering", implies=["shower (place)", "indoors"], era=["modern"], zh="淋浴"),
        pose("swimming", zh="游泳"),
        pose("wading", zh="涉水"),
        pose("floating", zh="漂浮"),
        pose("partially submerged", mutex=None, zh="半沒入水中"),
        pose("washing hair", mutex=None, implies=["wet hair"], zh="洗頭"),
        pose("washing back", mutex=None, needs=["pair"], zh="洗別人的背"),
        pose("splashing", mutex=None, zh="潑水"),
        pose("after bathing", mutex=None, zh="浴後"),
        pose("shared bathing", needs=["pair"], implies=["bathing"], zh="共浴"),
        env("bathhouse", implies=["bath", "indoors"], era=edo_mod, zh="錢湯"),
        env("ofuro", implies=["bath", "indoors"], era=edo_mod, zh="日式浴桶"),
        env("bubble bath", implies=["bath", "indoors"], era=["modern"], zh="泡泡浴"),
        env("shower head", mutex=None, implies=["shower (place)"], era=["modern"], zh="蓮蓬頭"),
        env("soap bubbles", mutex=None, zh="肥皂泡"),
        cloth("towel", zh="毛巾"),
        # 泳圈是水域場景道具，不是穿戴物；context 由 engine.NEEDS_CONTEXT 守。
        env("innertube", mutex=None, era=["modern"], zh="泳圈"),
    ]


def extra_activity_tags() -> list[dict]:
    """Daily Danbooru activities. Same mutex as bathing so a scene has one main act."""
    all_h = list(HEATS)
    modern = ["modern"]

    def A(tag, implies=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": "any",
            "heat": all_h,
            "mutex": "activity",
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or ["any"],
            "needs": [],
            "zh": zh,
        }

    return [
        A("eating", zh="吃東西"),
        A("drinking", zh="喝東西"),
        A("reading", zh="閱讀"),
        A("cooking", zh="料理"),
        A("shopping", era=modern, zh="購物"),
        A("singing", zh="唱歌"),
        A("karaoke", implies=["singing"], era=modern, zh="卡拉OK"),
        A("playing guitar", zh="彈吉他"),
        A("playing games", zh="玩遊戲"),
        A("playing video games", implies=["playing games"], era=modern, zh="打電動"),
        A("playing sports", zh="做運動"),
        A("studying", zh="讀書"),
        A("writing", zh="寫字"),
        A("drawing (action)", zh="畫畫"),
        A("painting (action)", zh="繪畫"),
        A("stretching", zh="伸展"),
        A("yoga", zh="瑜伽"),
        A("exercising", zh="鍛鍊"),
        A("training", zh="訓練"),
        A("fishing", implies=["outdoors"], zh="釣魚"),
        A("camping", implies=["outdoors"], zh="露營"),
        A("picnic", implies=["outdoors", "eating"], zh="野餐"),
        A("hiking", implies=["outdoors"], zh="健行"),
        A("sunbathing", implies=["outdoors"], zh="日光浴"),
        A("smoking", zh="吸菸"),
        A("cleaning", zh="打掃"),
        A("talking on phone", era=modern, zh="講電話"),
        A("selfie", era=modern, zh="自拍"),
        A("taking picture", era=["modern", "victorian"], zh="拍照"),
        A("driving", era=modern, zh="開車"),
        A("horseback riding", zh="騎馬"),
        A("riding bicycle", era=modern, zh="騎腳踏車"),
        # 有自己 activity tag 的運動。同一張圖只能有一個 activity（mutex），
        # 所以這些不要再疊 playing sports。全部經 Danbooru API 核實。
        A("tennis", era=modern, zh="打網球"),
        A("soccer", era=modern, zh="踢足球"),
        A("badminton", era=modern, zh="打羽球"),
        A("table tennis", era=modern, zh="打桌球"),
        A("boxing", era=modern, zh="拳擊"),
        A("track and field", era=modern, zh="田徑"),
        A("golf", era=modern, zh="打高爾夫"),
        A("archery", zh="射箭"),
    ]


def extra_job_scene_tags() -> list[dict]:
    """Jobs with signature clothes, plus remaining high-value Danbooru scene tags."""
    all_h = list(HEATS)
    modern = ["modern"]
    sex = ["sex"]

    def job(tag, implies=None, needs=None, gate="any", zh=""):
        return {
            "tag": tag,
            "section": "feature",
            "gate": gate,
            "heat": all_h,
            "mutex": "job",
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": modern,
            "needs": needs or [],
            "zh": zh,
        }

    def pose(tag, mutex=None, implies=None, needs=None, heat=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": "any",
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    def feat(tag, mutex=None, needs=None, heat=None, zh=""):
        return {
            "tag": tag,
            "section": "feature",
            "gate": "female" if needs and "female" in needs else "any",
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    def env(tag, mutex="place", implies=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "env",
            "gate": "any",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or modern,
            "zh": zh,
        }

    def cloth(tag, mutex=None, layer="accessory", implies=None, gate="any", heat=None, zh=""):
        return {
            "tag": tag,
            "section": "clothing",
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": layer,
            "era": modern,
            "zh": zh,
        }

    return [
        job("nurse", implies=["nurse cap"], needs=["female"], gate="female", zh="護士"),
        job("doctor", implies=["lab coat", "stethoscope"], zh="醫生"),
        job("teacher", implies=["blazer"], zh="老師"),
        job("waitress", implies=["apron"], needs=["female"], gate="female", zh="女侍"),
        job("barista", zh="咖啡師"),
        job("salaryman", implies=["suit", "necktie"], needs=["male"], gate="male", zh="上班族"),
        job("policewoman", implies=["police uniform"], needs=["female"], gate="female", zh="女警"),
        job("flight attendant", needs=["female"], gate="female", zh="空服員"),
        job("idol", implies=["idol clothes"], needs=["female"], gate="female", zh="偶像"),
        cloth("nurse cap", layer="accessory", gate="female", zh="護士帽"),
        cloth("idol clothes", mutex="onepiece", layer="garment", gate="female", zh="偶像服"),
        cloth("blazer", mutex="outer", layer="garment", zh="西裝外套"),
        cloth("sportswear", layer="garment", zh="運動服"),
        cloth("helmet", zh="頭盔"),
        cloth("microphone", zh="麥克風"),
        cloth("stethoscope", zh="聽診器"),
        cloth("clipboard", zh="寫字夾板"),
        cloth("condom", heat=sex, zh="保險套"),
        cloth("used condom", implies=["condom"], heat=sex, zh="用過的保險套"),
        cloth("holding condom", implies=["condom"], heat=sex, zh="拿著保險套"),
        cloth("condom in mouth", implies=["condom"], heat=sex, zh="口含保險套"),
        cloth("condom wrapper", implies=["condom"], heat=sex, zh="保險套包裝"),
        # 盒子在 Danbooru 沒有 implication，不暗示 condom。
        cloth("condom box", heat=sex, zh="保險套盒"),
        cloth("dildo", implies=["sex toy"], heat=sex, zh="假陽具"),
        pose("gangbang", implies=["group sex", "sex"], needs=["pair"], heat=sex, zh="輪姦"),
        pose("netorare", needs=["pair"], zh="NTR"),
        pose("cheating (relationship)", needs=["pair"], zh="外遇"),
        pose("groping", needs=["pair"], zh="亂摸"),
        pose("chikan", needs=["pair"], heat=["flash", "sex"], era=modern, zh="癡漢"),
        pose("voyeurism", zh="偷窺"),
        pose("recording", era=modern, zh="錄影"),
        pose("object insertion", mutex="sex_act", implies=["sex"], needs=["female"], heat=sex, zh="異物插入"),
        pose("breastfeeding", needs=["pair", "female"], implies=["lactation"], zh="哺乳"),
        pose("afterglow", needs=["pair"], heat=sex, zh="餘韻"),
        pose("carrying", mutex="activity", needs=["pair"], zh="抱著"),
        pose("against window", zh="靠窗"),
        pose("trembling", zh="發抖"),
        pose("looking around", mutex="gaze", zh="東張西望"),
        pose("furrowed brow", mutex="expression", zh="皺眉"),
        pose("dazed", mutex="expression", zh="恍神"),
        feat("lactation", needs=["female"], heat=["flash", "sex"], zh="泌乳"),
        feat("size difference", needs=["pair"], zh="體格差"),
        env("fitness gym", implies=["indoors"], zh="健身房"),
        env("school gym", implies=["indoors"], zh="學校體育館"),
        env("hospital", implies=["indoors"], zh="醫院"),
        env("clinic", implies=["indoors"], zh="診所"),
        env("locker", mutex=None, zh="置物櫃"),
        env("mirror", mutex=None, era=["any"], zh="鏡子"),
        env("full-length mirror", mutex=None, implies=["mirror"], era=["any"], zh="全身鏡"),
        env("tissue box", mutex=None, zh="面紙盒"),
    ]


def extra_shot_face_tags() -> list[dict]:
    """More camera framings, gaze, and expressions. Camera/gaze still one each."""
    all_h = list(HEATS)

    def P(tag, mutex=None, implies=None, heat=None, needs=None, gate="any"):
        return {
            "tag": tag,
            "section": "pose",
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": ["any"],
            "needs": needs or [],
        }

    return [
        P("dutch angle", mutex="camera"),
        P("fisheye", mutex="camera"),
        P("wide shot", mutex="camera"),
        P("over shoulder", mutex="camera"),
        P("from outside", mutex="camera"),
        P("lower body", mutex="camera"),
        P("straight-on", mutex="camera"),
        P("head out of frame", mutex="camera"),
        P("feet out of frame", mutex="camera"),
        P("looking ahead", mutex="gaze"),
        P("sideways glance", mutex="gaze"),
        P("looking at breasts", mutex="gaze", heat=["tease", "flash", "sex"], needs=["female"]),
        P("frown"),
        P("light smile", implies=["smile"]),
        P("expressionless"),
        P("pout"),
        P("angry"),
        P("sad"),
        P("crying", implies=["tears"]),
        P("drooling", heat=["flash", "sex"]),
        P("moaning", heat=["sex"]),
        P("clenched teeth"),
        P("sparkling eyes"),
        P("empty eyes"),
        P("sleepy"),
        P("serious"),
        P("happy", implies=["smile"]),
        P("surprised"),
        P("scared"),
        P("smug"),
        P("nervous"),
    ]


def extra_male_look_tags() -> list[dict]:
    """Ugly / fat / otaku male looks. Physique mutexes muscle; otaku and ugly can stack with fat."""
    def F(tag, mutex=None, implies=None, bind=None, era=None, section="feature", layer="normal"):
        return {
            "tag": tag,
            "section": section,
            "gate": "male",
            "heat": list(HEATS),
            "mutex": mutex,
            "bind": bind or [],
            "implies": implies or [],
            "layer": layer,
            "era": era or ["any"],
            "needs": ["male"],
        }

    return [
        F("ugly bastard"),
        F("fat"),
        F("fat man", mutex="male_build", implies=["fat"]),
        F("obese", mutex="male_build", implies=["fat"]),
        F("manboobs"),
        F("old man"),
        F("bald", mutex="hair_length"),
        F("otaku"),
        F(
            "coke-bottle glasses",
            implies=["glasses"],
            era=["modern"],
            section="clothing",
            layer="accessory",
        ),
    ]


def extra_race_tags() -> list[dict]:
    """Male-only species. One race mutex; monster boy is the umbrella parent."""
    monsters = [
        "goblin",
        "orc",
        "oni",
        "ogre",
        "troll",
        "kobold",
        "lizardman",
        "minotaur",
        "centaur",
        "satyr",
        "demon boy",
        "demon",
        "werewolf",
        "lamia",
        "slime boy",
        "zombie",
        "skeleton",
        "alien",
    ]
    others = [
        "elf",
        "dark elf",
        "dwarf",
        "vampire",
        "merman",
        "wolf boy",
        "cat boy",
        "dog boy",
        "fox boy",
        "rabbit boy",
        "horse boy",
        "bear boy",
        "tiger boy",
        "lion boy",
        "dragon boy",
        "shark boy",
        "tanuki",
    ]
    out = []
    for tag in monsters + others:
        out.append(
            {
                "tag": tag,
                "section": "feature",
                "gate": "male",
                "heat": list(HEATS),
                "mutex": "race",
                "bind": [],
                "implies": ["monster boy"] if tag in monsters else [],
                "layer": "normal",
                "era": ["any"],
                "needs": ["male"],
            }
        )
    out.append(
        {
            "tag": "monster boy",
            "section": "feature",
            "gate": "male",
            "heat": list(HEATS),
            "mutex": None,
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": ["male"],
        }
    )
    return out


def extra_era_tags() -> list[dict]:
    def C(tag, section, era, mutex=None, gate="any", heat=None, layer="garment", bind=None, implies=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": heat or list(HEATS),
            "mutex": mutex,
            "bind": bind or [],
            "implies": implies or [],
            "layer": layer,
            "era": era,
        }

    ac, ag, md, edo, vic, mod = (
        ["ancient_china"],
        ["ancient_greece"],
        ["medieval"],
        ["edo"],
        ["victorian"],
        ["modern"],
    )
    return [
        C("dudou", "clothing", ac, mutex="onepiece", gate="female", heat=["tease", "flash"]),
        C("sash", "clothing", ac + edo, mutex=None, layer="accessory"),
        C("hair stick", "clothing", ac + edo, mutex="headwear", layer="accessory", gate="female"),
        C("hairpin", "clothing", ac + edo, mutex="headwear", layer="accessory", gate="female"),
        C("pelvic curtain", "clothing", ac, mutex="bottom", gate="female", heat=["flash", "sex"]),
        C("chiton", "clothing", ag, mutex="onepiece", bind=["ancient greek clothes"], heat=["tease", "flash", "sex"]),
        C("peplos", "clothing", ag, mutex="onepiece", gate="female", bind=["ancient greek clothes"], heat=["tease", "flash"]),
        C("himation", "clothing", ag, mutex="outer"),
        C("tunic", "clothing", md, mutex="onepiece", heat=["tease", "flash"]),
        C("cloak", "clothing", md + vic, mutex="outer"),
        C("hood", "clothing", md, mutex="headwear", layer="accessory"),
        C("circlet", "clothing", md + ag, mutex="headwear", layer="accessory"),
        C("leather armor", "clothing", md, mutex="onepiece", bind=["armor"], heat=["tease"]),
        C("haori", "clothing", edo, mutex="outer", bind=["japanese clothes"]),
        C("kanzashi", "clothing", edo, mutex="headwear", layer="accessory", gate="female"),
        C("zouri", "clothing", edo, mutex="feet"),
        C("bonnet", "clothing", vic, mutex="headwear", layer="accessory", gate="female"),
        C("parasol", "clothing", vic + edo + ac, mutex=None, layer="accessory"),
        C("ascot", "clothing", vic, mutex="neckwear", layer="accessory"),
        C("courtyard", "env", ac + ["ancient_greece", "medieval"], mutex="place", layer="normal", implies=["outdoors"]),
        C("pavilion", "env", ac + edo, mutex="place", layer="normal", implies=["outdoors"]),
        C("colonnade", "env", ag, mutex="place", layer="normal", implies=["outdoors"]),
    ]


def extra_corpus_tags() -> list[dict]:
    """special_prompts 語料稽核挖出來的字（見 語料新詞候選.md）。

    來源是 30792 個 Grok 寫的情境檔，解析出 91926 個不重複字串，扣掉我們已有的、
    只留用過 >=5 個檔的 8746 個，再**全部打 Danbooru API 查證**。結果只有 833 個
    是真的 tag 且有圖 —— 其餘七成以上是 Grok 自己發明的攝影指導與散文
    （eye-level framing、soft daylight、close intimate framing 這類），模型沒學過。

    這裡收的是「語料常用 + Danbooru 有量 + 我們沒有」的那批，刻意不收三種東西：
      1. 非合意主題（sexual harassment、forced、molestation…）—— 要專案主自己決定。
      2. 會跟引擎打架的（solo focus 撞 solo 與卡司、4boys 要改 castWeights、
         faceless male 撞「男性要交代身體」）—— 那些不是加個詞條就好。
      3. 太籠統的（floor、wall、dynamic pose、milk）—— 加了只會稀釋。

    另外語料裡的 `cowgirl` 是陷阱：Danbooru 會把它導到 cow girl（牛娘），
    不是騎乘位。騎乘位叫 cowgirl position，而那個我們本來就有。
    """
    all_h = list(HEATS)
    hot = ["tease", "flash", "sex"]
    sex_only = ["sex"]
    modern = ["modern"]
    any_era = ["any"]

    def env(tag, mutex=None, implies=None, era=None, zh=""):
        return {
            "tag": tag, "section": "env", "gate": "any", "heat": all_h,
            "mutex": mutex, "bind": [], "implies": implies or [],
            "layer": "normal", "era": era or any_era, "zh": zh,
        }

    def pose(tag, mutex=None, implies=None, needs=None, heat=None, gate="any", era=None, zh=""):
        return {
            "tag": tag, "section": "pose", "gate": gate, "heat": list(heat or all_h),
            "mutex": mutex, "bind": [], "implies": implies or [],
            "layer": "normal", "era": era or any_era, "needs": needs or [], "zh": zh,
        }

    def feat(tag, mutex=None, gate="any", era=None, zh=""):
        return {
            "tag": tag, "section": "feature", "gate": gate, "heat": all_h,
            "mutex": mutex, "bind": [], "implies": [],
            "layer": "normal", "era": era or any_era, "zh": zh,
        }

    def cloth(tag, mutex=None, layer="accessory", heat=None, gate="any", era=None, zh=""):
        return {
            "tag": tag, "section": "clothing", "gate": gate, "heat": list(heat or all_h),
            "mutex": mutex, "bind": [], "implies": [],
            "layer": layer, "era": era or any_era, "zh": zh,
        }

    return [
        # ---- 場地 ----------------------------------------------------------
        # 新場地在寫實模式下有個限制：畫面上只要有 ACT_PLACE 列過的活動，
        # 場地就必須在那個活動的清單裡，否則會被擋掉。所以這幾個目前主要是
        # 「沒有活動時」的背景，要讓它們配得上活動得另外補 ACT_PLACE。
        env("cave", mutex="place", era=any_era, zh="洞穴"),
        env("jungle", mutex="place", implies=["outdoors"], era=any_era, zh="叢林"),
        env("rural", mutex="place", implies=["outdoors"], era=any_era, zh="鄉間"),
        env("village", mutex="place", implies=["outdoors"], era=any_era, zh="村莊"),
        env("toilet stall", mutex="place", implies=["indoors"], era=modern, zh="廁所隔間"),
        env("canopy bed", mutex="place", implies=["indoors"],
            era=["victorian", "ancient_china", "medieval"], zh="四柱床"),

        # ---- 傢俱 ----------------------------------------------------------
        # on couch 補的是一個真的洞：我們有 on bed、on chair，卻沒有沙發版，
        # 而 engine 的 SPORT_BAD_FURNITURE 一直寫著詞庫裡不存在的 "on sofa"
        # （Danbooru 的正規名是 on couch），那條防護對沙發從來沒有生效過。
        env("on couch", mutex="furniture", implies=["indoors"], era=modern, zh="在沙發上"),
        env("on desk", mutex="furniture", implies=["indoors"], era=["modern", "victorian"], zh="在桌上"),
        env("under table", mutex="furniture", implies=["indoors"], era=any_era, zh="桌子底下"),

        # ---- 光源 ----------------------------------------------------------
        env("desk lamp", mutex="lighting", era=["modern", "victorian"], zh="檯燈"),

        # ---- 手持道具 ------------------------------------------------------
        # held_prop 是互斥的（一次拿一樣），而且**只靠 ACT_PROP 被活動拉出來** ——
        # 詞庫裡 18 個 held_prop，抽得到的 11 個全部有活動對應，沒有的一個都抽不到。
        # 所以這裡只收找得到活動鉤子的兩個，並在 engine 的 ACT_PROP 補上對應。
        # katana／tarot／thermometer／remote control／whistle 都是真的 Danbooru 字，
        # 但我們沒有「拔刀」「占卜」「量體溫」「看電視」「吹哨」這些活動，
        # 硬塞進別的活動只會畫出不合理的圖，所以這一輪不收。
        # camera 抽得到是因為 cellphone 只有現代，維多利亞那一格輪到它 ——
        # 早期攝影正好也說得通。mop 沒收：cleaning 的第一順位 broom 是通用時代，
        # 永遠輪不到第二個。要讓替代道具真的輪得到，得把 stampActProps 從
        # 「取第一個可用的」改成「在可用的裡面隨機挑」，那是另一件事。
        env("camera", mutex="held_prop", era=["modern", "victorian"], zh="相機"),

        # ---- 布景道具（不互斥，可以同時出現）------------------------------
        env("desk", era=["modern", "victorian"], zh="書桌"),
        env("bench", era=any_era, zh="長椅"),
        env("wooden bench", era=any_era, zh="木長椅"),
        env("nightstand", era=["modern", "victorian"], zh="床頭櫃"),
        env("counter", era=["modern", "victorian"], zh="檯面"),
        env("sink", era=["modern", "victorian"], zh="洗手台"),
        env("whiteboard", era=modern, zh="白板"),
        env("shopping cart", era=modern, zh="購物車"),
        env("steering wheel", era=modern, zh="方向盤"),
        env("microphone stand", era=modern, zh="麥克風架"),
        env("poker table", era=["modern", "victorian"], zh="牌桌"),
        env("tea set", era=any_era, zh="茶具"),
        env("crystal ball", era=any_era, zh="水晶球"),
        env("christmas tree", era=["modern", "victorian"], zh="聖誕樹"),
        env("ofuda", era=["edo", "ancient_china", "modern"], zh="符咒"),
        env("stained glass", era=["medieval", "victorian", "modern"], zh="彩繪玻璃"),
        env("iron bars", era=any_era, zh="鐵欄杆"),
        env("railing", era=any_era, zh="欄杆"),
        env("tiles", era=any_era, zh="磁磚"),
        env("rubble", era=any_era, zh="瓦礫"),
        env("crowd", era=any_era, zh="人群"),
        env("mecha", era=modern, zh="機甲"),

        # ---- 自然與環境 ----------------------------------------------------
        # wind 刻意不給 weather 互斥格：風和雨、雪本來就會同時出現，
        # 佔了那一格反而會互相擠掉。
        env("wind", era=any_era, zh="風"),
        env("grass", implies=["outdoors"], era=any_era, zh="草地"),
        env("sand", implies=["outdoors"], era=any_era, zh="沙"),
        env("moss", era=any_era, zh="青苔"),
        env("dust", era=any_era, zh="塵埃"),
        env("smoke", era=any_era, zh="煙"),
        env("full moon", implies=["outdoors"], era=any_era, zh="滿月"),
        env("reflection", era=any_era, zh="倒影"),
        env("condensation", era=any_era, zh="水氣凝結"),

        # ---- 時節與場合 ----------------------------------------------------
        env("christmas", era=["modern", "victorian"], zh="聖誕節"),
        env("chinese new year", era=["ancient_china", "modern"], zh="過年"),
        env("winter", era=any_era, zh="冬天"),
        env("wedding", era=any_era, zh="婚禮"),
        env("fantasy", era=any_era, zh="奇幻"),
        env("surreal", era=any_era, zh="超現實"),
        env("magic", era=any_era, zh="魔法"),
        env("tribal", era=any_era, zh="部落風"),
        env("medieval", era=["medieval"], zh="中世紀風"),

        # ---- 職業 ----------------------------------------------------------
        feat("military", mutex="job", era=modern, zh="軍人"),
        feat("police", mutex="job", era=modern, zh="警察"),
        feat("pilot", mutex="job", era=modern, zh="飛行員"),
        feat("delinquent", mutex="job", era=modern, zh="不良"),

        # ---- 種族與體型 ----------------------------------------------------
        # android 和 ghost 給 race 互斥格：你不會同時是哥布林又是機器人。
        # pointy ears 刻意**不**給 race —— 精靈已經是 race 了，而尖耳朵要能單獨
        # 出現在別的角色身上，佔了那一格反而會把 elf 擠掉。
        feat("android", mutex="race", era=modern, zh="機器人"),
        feat("ghost", mutex="race", era=any_era, zh="幽靈"),
        feat("pointy ears", era=any_era, zh="尖耳朵"),
        feat("tusks", era=any_era, zh="獠牙"),
        feat("green skin", era=any_era, zh="綠皮膚"),
        feat("giant male", gate="male", era=any_era, zh="巨大男性"),

        # ---- 身體 ----------------------------------------------------------
        feat("large areolae", gate="female", era=any_era, zh="大乳暈"),
        feat("belly", era=any_era, zh="肚子"),
        feat("bruise", era=any_era, zh="瘀青"),
        feat("bruise on face", era=any_era, zh="臉上瘀青"),
        feat("heart-shaped pupils", era=any_era, zh="愛心瞳"),
        feat("saliva trail", era=any_era, zh="唾液絲"),

        # ---- 服裝 ----------------------------------------------------------
        # 每一件都必須落在 normal 模式 fill("clothing") 的 outfit 白名單格子裡
        # （feet/waist/legs/jewelry/eyewear/neckwear/underwear_top/underwear_bottom/
        # outer/hands/headwear），不然就是加一個永遠抽不到的字 —— obi 和 sash
        # 當初就是這樣躺在詞庫裡沒人發現的。
        cloth("mask", mutex="headwear", era=any_era, zh="面具"),
        cloth("veil", mutex="headwear", era=any_era, zh="面紗"),
        cloth("prayer beads", mutex="neckwear", era=["ancient_china", "edo", "medieval"], zh="念珠"),
        cloth("gold chain", mutex="jewelry", era=any_era, zh="金鏈"),
        cloth("superhero costume", mutex="onepiece", layer="garment", era=modern, zh="超級英雄裝"),
        cloth("racing suit", mutex="onepiece", layer="garment", era=modern, zh="賽車服"),
        cloth("wetsuit", mutex="onepiece", layer="garment", era=modern, zh="潛水衣"),
        cloth("jersey", mutex="top", layer="garment", era=modern, zh="球衣"),
        cloth("lace bra", mutex="underwear_top", layer="underwear", gate="female", heat=hot,
              era=modern, zh="蕾絲胸罩"),
        cloth("crotchless panties", mutex="underwear_bottom", layer="underwear", gate="female",
              heat=hot, era=modern, zh="開襠內褲"),

        # ---- 綁縛 ----------------------------------------------------------
        # mutex 刻意留空，跟詞庫裡既有的 handcuffs／leash／o-ring 一致。
        # 它們不靠 outfit 白名單被抽出來，靠的是 engine 的 NEEDS_CONTEXT（沒有
        # bondage／bdsm／restrained 的場合就刪掉）加上 CTX_PULLS_ACC（有場合就
        # 機率拉進來）。負向擋、正向拉，兩半都要有，只擋不拉的話出現率會是 0。
        # blindfold 是例外：它就是戴在眼睛上，放進既有的 eyewear 格比較誠實，
        # 而且蒙眼本來就不限於綁縛場合。
        cloth("blindfold", mutex="eyewear", heat=hot, era=any_era, zh="眼罩"),
        cloth("shibari", heat=hot, era=any_era, zh="繩縛"),
        cloth("bound wrists", heat=hot, era=any_era, zh="綁手腕"),
        cloth("ball gag", heat=hot, era=modern, zh="口球"),
        cloth("nipple clamps", heat=hot, gate="female", era=modern, zh="乳夾"),
        cloth("remote control vibrator", heat=hot, gate="female", era=modern, zh="遙控跳蛋"),

        # ---- 表情 ----------------------------------------------------------
        pose("drunk", mutex="expression", era=any_era, zh="醉"),
        pose("flustered", mutex="expression", era=any_era, zh="慌張"),
        pose("nervous smile", mutex="expression", era=any_era, zh="緊張的笑"),
        pose("exhausted", mutex="expression", era=any_era, zh="精疲力盡"),
        pose("forced smile", mutex="expression", era=any_era, zh="強顏歡笑"),

        # ---- 視線與動作 ----------------------------------------------------
        pose("looking outside", mutex="gaze", era=any_era, zh="看向外面"),
        pose("arms around neck", needs=["pair"], era=any_era, zh="環抱脖子"),
        pose("kabedon", needs=["pair"], era=any_era, zh="壁咚"),
        pose("sandwiched", needs=["group"], heat=hot, era=any_era, zh="被夾在中間"),
        pose("struggling", era=any_era, zh="掙扎"),
        pose("bouncing", heat=hot, era=any_era, zh="彈動"),
        pose("hiding", mutex="activity", era=any_era, zh="躲藏"),
        pose("fighting", mutex="activity", era=any_era, zh="打鬥"),
        pose("livestream", mutex="activity", era=modern, zh="直播"),
        pose("mirror selfie", mutex="activity", implies=["mirror"], era=modern, zh="鏡子自拍"),

        # ---- 暴露 ----------------------------------------------------------
        # **不要**給它 clothes_action 互斥格。那一格是給「針對特定衣服的動作」用的
        # （shirt pull 要有襯衫、dress pull 要有洋裝），engine 在 flash 尺度會先
        # fillSlot 那一格，成功了就不再走多樣的 flash 群。而撩衣服對任何衣服都成立，
        # 於是它每次都贏在最高層 —— 實測佔掉 flash 圖的 88.1%，種類從 52 掉到 40。
        # 放回一般的 flash 動作，跟其他五十幾個平起平坐。
        pose("lifting own clothes", heat=hot, era=any_era, zh="撩起衣服"),
        pose("wardrobe malfunction", heat=hot, era=any_era, zh="走光"),
        pose("accidental exposure", heat=hot, era=any_era, zh="不慎走光"),

        # ---- 性（只在色情尺度出現）-----------------------------------------
        pose("internal cumshot", heat=sex_only, era=any_era, zh="中出"),
        pose("cum overflow", heat=sex_only, era=any_era, zh="精液滿溢"),
        pose("deep penetration", heat=sex_only, era=any_era, zh="深插"),
        pose("cum on tongue", heat=sex_only, era=any_era, zh="舌上精液"),
    ]


def extra_expand_tags() -> list[dict]:
    """Places, jobs, sports courts/balls/uniforms, and sex-heat tags from special_prompts."""
    all_h = list(HEATS)
    modern = ["modern"]
    sex = ["sex"]

    def job(tag, implies=None, needs=None, gate="any", zh=""):
        return {
            "tag": tag,
            "section": "feature",
            "gate": gate,
            "heat": all_h,
            "mutex": "job",
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": modern,
            "needs": needs or [],
            "zh": zh,
        }

    def pose(tag, mutex=None, implies=None, needs=None, heat=None, era=None, zh="", gate="any"):
        return {
            "tag": tag,
            "section": "pose",
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    def env(tag, mutex="place", implies=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "env",
            "gate": "any",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or modern,
            "zh": zh,
        }

    def cloth(tag, mutex=None, layer="accessory", implies=None, gate="any", heat=None, zh="", era=None):
        return {
            "tag": tag,
            "section": "clothing",
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": layer,
            "era": era or modern,
            "zh": zh,
        }

    def feat(tag, mutex=None, needs=None, heat=None, gate="any", zh="", implies=None):
        return {
            "tag": tag,
            "section": "feature",
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    out = [
        env("airplane interior", implies=["indoors"], zh="機艙"),
        env("airport", implies=["outdoors"], zh="機場"),
        env("cockpit", implies=["indoors"], zh="駕駛艙"),
        env("bus interior", implies=["indoors"], zh="公車內"),
        env("movie theater", implies=["indoors"], zh="電影院"),
        env("amusement park", implies=["outdoors"], zh="遊樂園"),
        env("ferris wheel", implies=["outdoors"], zh="摩天輪"),
        env("zoo", implies=["outdoors"], zh="動物園"),
        env("convenience store", implies=["indoors"], zh="便利商店"),
        env("supermarket", implies=["indoors"], zh="超市"),
        env("internet cafe", implies=["indoors"], zh="網咖"),
        env("prison", implies=["indoors"], zh="監獄"),
        env("construction site", implies=["outdoors"], zh="工地"),
        env("casino", implies=["indoors"], zh="賭場"),
        env("nightclub", implies=["indoors"], zh="夜店"),
        env("laboratory", implies=["indoors"], zh="實驗室"),
        env("church", implies=["indoors"], zh="教堂"),
        env("dojo", implies=["indoors"], zh="道場"),
        env("farm", implies=["outdoors"], zh="農場"),
        env("barn", implies=["indoors"], zh="穀倉"),
        env("rice paddy", implies=["outdoors"], zh="稻田"),
        env("parking lot", implies=["outdoors"], zh="停車場"),
        env("mountain", implies=["outdoors"], era=["any"], zh="山"),
        env("waterfall", implies=["outdoors"], era=["any"], zh="瀑布"),
        env("stadium", implies=["outdoors"], zh="體育場"),
        env("golf course", implies=["outdoors"], zh="高爾夫球場"),
        env("izakaya", implies=["indoors"], zh="居酒屋"),
        env("tavern", implies=["indoors"], era=["any"], zh="酒館"),
        env("ryokan", implies=["indoors"], era=["edo", "modern"], zh="旅館"),
        env("tent", implies=["outdoors"], era=["modern", "ancient_china", "medieval", "ancient_greece", "edo"], zh="帳篷"),
        env("campfire", mutex=None, implies=["outdoors"], zh="營火"),
        env("karaoke box", implies=["indoors"], zh="KTV包廂"),
        env("market stall", implies=["outdoors"], zh="夜市"),
        env("apartment", implies=["indoors"], zh="公寓"),
        env("basketball court", implies=["outdoors"], zh="籃球場"),
        env("tennis court", implies=["outdoors"], zh="網球場"),
        env("soccer field", implies=["outdoors"], zh="足球場"),
        env("baseball stadium", implies=["outdoors"], zh="棒球場"),
        env("bowling alley", implies=["indoors"], zh="保齡球館"),
        env("boxing ring", implies=["indoors"], zh="拳擊台"),
        env("running track", implies=["outdoors"], zh="跑道"),
        # 綜合球場可能在室內或室外，不能單向暗示 outdoors。
        env("sports court", zh="綜合球場"),
        env("bunk bed", mutex="furniture", implies=["indoors"], zh="雙層床"),
        env("basketball (object)", mutex="sport_ball", zh="籃球"),
        env("soccer ball", mutex="sport_ball", zh="足球"),
        env("tennis ball", mutex="sport_ball", zh="網球"),
        env("volleyball (object)", mutex="sport_ball", zh="排球"),
        env("baseball (object)", mutex="sport_ball", zh="棒球"),
        env("bowling ball", mutex="sport_ball", zh="保齡球"),
        env("golf ball", mutex="sport_ball", zh="高爾夫球"),
        env("tennis racket", mutex="sport_prop", zh="網球拍"),
        env("baseball bat", mutex="sport_prop", zh="球棒"),
        env("golf club", mutex="sport_prop", zh="高爾夫球桿"),
        env("badminton racket", mutex="sport_prop", zh="羽球拍"),
        env("table tennis paddle", mutex="sport_prop", zh="桌球拍"),
        env("baseball mitt", mutex="sport_prop", zh="棒球手套"),
        env("bow (weapon)", mutex="sport_prop", era=["any"], zh="弓"),
        env("shuttlecock", mutex="sport_ball", zh="羽球"),
        env("table tennis ball", mutex="sport_ball", zh="桌球"),
        # 箭不佔「手上拿的東西」那一格，才能跟弓共存。
        env("arrow (projectile)", mutex=None, era=["any"], zh="箭"),
        env("bicycle", mutex=None, zh="腳踏車"),
        env("guitar", mutex="held_prop", era=["any"], zh="吉他"),
        env("book", mutex="held_prop", era=["any"], zh="書"),
        env("pen", mutex="held_prop", era=["modern", "victorian"], zh="筆"),
        env("cellphone", mutex="held_prop", zh="手機"),
        env("cigarette", mutex="held_prop", era=["modern", "victorian"], zh="菸"),
        env("frying pan", mutex="held_prop", era=["any"], zh="平底鍋"),
        env("shopping bag", mutex="held_prop", zh="購物袋"),
        env("broom", mutex="held_prop", era=["any"], zh="掃把"),
        env("fishing rod", mutex="held_prop", era=["any"], zh="釣竿"),
        env("game controller", mutex="held_prop", zh="手把"),
        env("paintbrush", mutex="held_prop", era=["any"], zh="畫筆"),
        # 時代對得上的道具。ACT_PROP 會在活動定下來之後蓋一個道具上去，而
        # stampActProps() 本來就會用 eraOk 過濾，所以這裡的 era 欄就等於
        # 「哪個時代拿得到這個東西」—— 江戶抽菸拿的是煙管不是香菸。
        #
        # 修之前實測（每格 700 張）：江戶抽菸 22/22 都是香菸、維多利亞 62/62 也是；
        # 古中國、古希臘、中世紀、江戶寫字 50/50 都是原子筆（維多利亞 40/40、
        # 現代 30/30）—— 每一個時代都是 100%，差別只在那個時代抽到寫字幾次。
        # 香菸與原子筆原本掛 era=["any"]，所以它們贏遍所有時代。
        #
        # Danbooru 共現數佐證這幾個配對是模型學過的：
        #   kiseru+smoking 1019、cigar+smoking 2733、smoking pipe+smoking 2163
        #   bucket+cleaning 354（跟 broom+cleaning 346 同級）、mop+cleaning 243
        #   newspaper+reading 824、ladle+cooking 1619
        #
        # **刻意不收 kitchen knife**：3059 張裡 513 張同時標 blood（16.8%）、
        # 162 張標 yandere。拿它當煮飯道具，等於有六分之一的機會畫出帶血的刀。
        # 這跟負面詞那次加 cross-section 是同一套判準 —— 看共現率，不看語意上
        # 「它應該是廚具」。
        #
        # 古希臘寫字**刻意留空**。stylus 在 Danbooru 上主要是數位繪圖筆
        # （6268 張），用在古希臘會畫出現代觸控筆，比沒有道具更糟；
        # writing brush 查無（0 張）。沒有道具是既有且誠實的行為 ——
        # 麥克風在非現代時代也是這樣（實測 singing 在五個古代時代都是 0%）。
        # book 則刻意留著 era=["any"]：各時代都有某種形式的書，
        # 古希臘的卷軸換成書遠不如原子筆那麼刺眼。
        env("kiseru", mutex="held_prop", era=["edo"], zh="煙管"),
        env("smoking pipe", mutex="held_prop", era=["victorian"], zh="菸斗"),
        env("cigar", mutex="held_prop", era=["victorian"], zh="雪茄"),
        env("calligraphy brush", mutex="held_prop", era=["ancient_china", "edo"], zh="毛筆"),
        env("quill", mutex="held_prop", era=["medieval", "victorian"], zh="羽毛筆"),
        env("pencil", mutex="held_prop", era=["modern"], zh="鉛筆"),
        env("newspaper", mutex="held_prop", era=["modern", "victorian"], zh="報紙"),
        env("mop", mutex="held_prop", era=["modern"], zh="拖把"),
        env("bucket", mutex="held_prop", era=["any"], zh="水桶"),
        env("ladle", mutex="held_prop", era=["any"], zh="湯杓"),
        job("firefighter", zh="消防員"),
        job("scientist", implies=["lab coat"], zh="科學家"),
        job("farmer", zh="農夫"),
        job("construction worker", implies=["hard hat"], zh="工人"),
        job("janitor", zh="清潔工"),
        job("race queen", needs=["female"], gate="female", zh="賽車女郎"),
        job("soldier", implies=["military uniform"], zh="士兵"),
        pose("jogging", mutex="activity", implies=["outdoors"], era=modern, zh="慢跑"),
        pose("skiing", mutex="activity", implies=["outdoors", "snow"], era=modern, zh="滑雪"),
        pose("diving", mutex="activity", zh="潛水"),
        pose("weightlifting", mutex="activity", era=modern, zh="重訓"),
        pose("rape", needs=["pair"], heat=sex, zh="強姦"),
        # 不放進 SEX_ACT：rough sex 跟一個體位同時成立。勒頸四個在引擎裡互斥，不佔 sex_act。
        # Danbooru 上 strangling 不暗示 asphyxiation，這裡也不補。
        pose("after rape", needs=["pair"], heat=sex, zh="強暴事後"),
        pose("rough sex", needs=["pair"], heat=sex, zh="粗暴性愛"),
        pose("strangling", needs=["pair"], heat=sex, zh="勒頸"),
        pose("neck grab", needs=["pair"], heat=sex, zh="抓脖子"),
        pose("headlock", needs=["pair"], heat=sex, zh="鎖頭"),
        pose("rear naked choke", needs=["pair"], heat=sex, zh="裸絞"),
        pose("asphyxiation", needs=["pair"], heat=sex, zh="窒息"),
        pose("slap mark", needs=["pair"], heat=sex, zh="掌痕"),
        pose("orgy", needs=["pair"], heat=sex, implies=["group sex", "sex"], zh="狂歡雜交"),
        pose("bondage", heat=sex, zh="束縛"),
        pose("bdsm", heat=sex, zh="BDSM"),
        pose("restrained", heat=sex, zh="被拘束"),
        pose("prostitution", needs=["pair"], heat=sex, zh="賣淫"),
        pose("pet play", heat=sex, zh="寵物扮演"),
        cloth("soccer uniform", mutex="onepiece", layer="garment", implies=["sportswear"], zh="足球服"),
        cloth("baseball uniform", mutex="onepiece", layer="garment", implies=["sportswear"], zh="棒球服"),
        cloth("tennis uniform", mutex="onepiece", layer="garment", implies=["sportswear"], zh="網球服"),
        cloth("volleyball uniform", mutex="onepiece", layer="garment", implies=["sportswear"], zh="排球服"),
        cloth("buruma", mutex="bottom", layer="garment", zh="體操褲"),
        # 運動裝備。全部經 Danbooru API 核實（category 0、post_count > 0、非 deprecated）。
        cloth("cleats", mutex="feet", layer="garment", zh="釘鞋"),
        cloth("boxing shorts", mutex="bottom", layer="garment", implies=["shorts"], zh="拳擊短褲"),
        cloth("boxing gloves", mutex="hands", layer="accessory", implies=["gloves"], zh="拳擊手套"),
        cloth("baseball cap", mutex="headwear", layer="accessory", implies=["hat"], zh="棒球帽"),
        cloth("bicycle helmet", mutex="headwear", layer="accessory", implies=["helmet"], zh="自行車安全帽"),
        cloth("swim cap", mutex="headwear", layer="accessory", zh="泳帽"),
        cloth("goggles", mutex="eyewear", layer="accessory", zh="蛙鏡"),
        # 護膝不佔襪類那一格，它可以跟長襪同時出現。
        cloth("knee pads", layer="accessory", zh="護膝"),
        cloth("santa costume", mutex="onepiece", layer="garment", zh="聖誕裝"),
        cloth("handcuffs", layer="accessory", heat=sex, zh="手銬"),
        cloth("leash", layer="accessory", zh="牽繩"),
        cloth("bodypaint", layer="skin", zh="人體彩繪"),
        # 職業與服裝。髮帶、髮箍共用 hair_acc，不佔頭飾格，同一張只留一種。
        # 背包用 bag，毛邊不佔外套格。女巫帽由女巫帶出，其餘只進池。
        cloth("fingerless gloves", mutex="hands", zh="露指手套", era=["any"]),
        cloth("thigh boots", mutex="feet", layer="garment", zh="過膝靴", era=["any"]),
        cloth("sunglasses", mutex="eyewear", zh="太陽眼鏡"),
        cloth("scarf", mutex="neckwear", zh="圍巾", era=["any"]),
        cloth("hair ribbon", mutex="hair_acc", gate="female", zh="髮帶", era=["any"]),
        cloth("hairband", mutex="hair_acc", gate="female", zh="髮箍", era=["any"]),
        cloth("fur trim", layer="garment", zh="毛邊", era=["any"]),
        cloth("witch hat", mutex="headwear", zh="女巫帽", era=["medieval", "victorian"]),
        cloth("maid headdress", mutex="headwear", gate="female", zh="女僕頭飾", era=["victorian", "modern"]),
        cloth("loafers", mutex="feet", layer="garment", zh="樂福鞋"),
        cloth("magical girl", mutex="onepiece", layer="garment", gate="female", zh="魔法少女"),
        cloth("garter straps", mutex="legs", layer="garment", gate="female", zh="吊襪吊帶", era=["modern", "victorian"]),
        cloth("backpack", mutex="bag", zh="背包"),
        cloth("beret", mutex="headwear", zh="貝雷帽"),
        cloth("tiara", mutex="headwear", gate="female", zh="頭冠", era=["any"]),
        cloth("chef hat", mutex="headwear", zh="廚師帽"),
        job("chef", zh="廚師"),
        # 半扎、內彎鬢髮不佔髮型格：半扎的上半通常就是馬尾或雙馬尾，硬互斥會拆掉最常見的畫法。
        # 單辮、低雙馬尾跟馬尾一樣佔髮型格，並帶出父標。
        pose("arms up", zh="舉手"),
        pose("walking", mutex="body_pose", zh="走路"),
        pose("running", mutex="body_pose", zh="跑步"),
        pose("jumping", mutex="body_pose", zh="跳躍"),
        pose("impregnation", needs=["pair"], heat=sex, zh="內射受孕"),
        # 加字之前先對 danbooru.donmai.us/tags.json：要現役、post_count > 0、
        # 不是停用的別名。2026-09-28 拿掉 cumdrip from pussy（沒有這個 tag）
        # 和 erect nipples（已停用、0 張）。wrist grab 自 2021-10-15 起的正式名是下面這個。
        pose("holding another's wrist", needs=["pair"], heat=sex, zh="抓手腕"),
        feat("single braid", mutex="hair_style", implies=["braid"], zh="單辮"),
        feat("low twintails", mutex="hair_style", implies=["twintails"], zh="低雙馬尾"),
        feat("half updo", zh="半扎"),
        feat("hair intakes", zh="內彎鬢髮"),
        cloth("panties around one leg", mutex="underwear_bottom", layer="garment", gate="female", heat=sex, zh="內褲掛一腿"),
        cloth("mary janes", mutex="feet", layer="garment", gate="female", zh="瑪麗珍鞋"),
        cloth("knee boots", mutex="feet", layer="garment", zh="及膝靴", era=["any"]),
        cloth("plaid skirt", mutex="bottom", layer="garment", implies=["skirt"], gate="female", zh="格裙"),
        # 第三輪。三種馬尾只帶出 ponytail。braid 也在髮型格，一起帶會互斥失敗。
        feat("low ponytail", mutex="hair_style", implies=["ponytail"], zh="低馬尾"),
        feat("braided ponytail", mutex="hair_style", implies=["ponytail"], zh="辮子馬尾"),
        feat("folded ponytail", mutex="hair_style", implies=["ponytail"], zh="折疊馬尾"),
        pose("grin", mutex="expression", zh="咧嘴笑"),
        pose("tearing up", mutex="expression", implies=["tears"], zh="含淚"),
        pose("standing split", mutex="body_pose", zh="站立劈腿"),
        pose("tiptoes", mutex="body_pose", implies=["standing"], zh="踮腳"),
        pose("leg up", zh="單腿抬起"),
        pose("covering privates", gate="female", heat=["flash", "sex"], zh="掩私處"),
        pose("hand on another's head", needs=["pair"], zh="按住頭"),
        # grabbing another's hair 已在採集詞裡。同名再加一筆會變成兩個字
        # （去重鍵是 tag+section）。改走 RECLASS，不要在這裡再寫一筆。
        feat("nose blush", zh="鼻頭紅"),
        feat("sweatdrop", zh="汗滴"),
        feat("fang", zh="虎牙"),
        feat("mole under mouth", zh="嘴下痣"),
        feat("skindentation", zh="襪勒肉"),
        feat("cleft of venus", gate="female", heat=["flash", "sex"], zh="股縫"),
        feat("hood up", zh="戴上兜帽"),
        cloth("turtleneck", mutex="top", layer="garment", zh="高領衫"),
        cloth("hairclip", mutex="hair_acc", gate="female", zh="髮夾", era=["any"]),
        cloth("headphones", mutex="headwear", zh="頭戴耳機"),
        cloth("wrist cuffs", mutex="jewelry", zh="腕環", era=["any"]),
        cloth("sun hat", mutex="headwear", implies=["hat"], zh="遮陽帽"),
        feat("bride", needs=["female"], gate="female", zh="新娘"),
        feat("gyaru", needs=["female"], gate="female", zh="辣妹"),
        feat("small penis", needs=["male"], gate="male", heat=sex, zh="小陰莖"),
    ]
    return out


def extra_fluid_tags() -> list[dict]:
    """精液、陰莖狀態、人數與手交。已在詞庫的字只走 IMPLIES／NEEDS／RECLASS。"""
    sex = ["sex"]
    any_era = ["any"]

    def pose(tag, implies=None, needs=None, zh="", mutex=None):
        return {
            "tag": tag,
            "section": "pose",
            "gate": "any",
            "heat": sex,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": any_era,
            "needs": needs or [],
            "zh": zh,
        }

    def feat(tag, implies=None, zh=""):
        return {
            "tag": tag,
            "section": "feature",
            "gate": "male",
            "heat": sex,
            "mutex": None,
            "bind": [],
            "implies": implies or [],
            "layer": "skin",
            "era": any_era,
            "needs": ["male"],
            "zh": zh,
        }

    return [
        pose("after ejaculation", implies=["cum"], needs=["male"], zh="射精後"),
        pose("cumdrip from penis", implies=["cumdrip", "penis"], needs=["male"], zh="陰莖滴精"),
        pose("penis over eyes", implies=["penis"], needs=["male"], zh="陰莖擋眼"),
        pose("penis on face", implies=["penis"], needs=["male"], zh="陰莖貼臉"),
        feat("penis peek", implies=["penis"], zh="陰莖探出"),
        feat("flaccid", implies=["penis"], zh="疲軟"),
        feat("half-erect", implies=["penis"], zh="半勃起"),
        feat("phimosis", implies=["penis"], zh="包莖"),
        feat("foreskin", implies=["penis"], zh="包皮"),
        feat("twitching penis", implies=["penis"], zh="陰莖抽動"),
        feat("large testicles", implies=["testicles", "penis"], zh="大睪丸"),
        feat("huge testicles", implies=["testicles", "penis"], zh="巨大睪丸"),
        feat("small testicles", implies=["testicles", "penis"], zh="小睪丸"),
        {
            "tag": "covered testicles",
            "section": "feature",
            "gate": "male",
            "heat": ["flash", "sex"],
            "mutex": None,
            "bind": [],
            "implies": [],
            "layer": "skin",
            "era": any_era,
            "needs": ["male"],
            "zh": "睪丸被遮住",
        },
        pose("testicle sucking", implies=["testicles", "penis", "sex"], needs=["male", "pair"], zh="吸睪丸"),
        pose("testicle grab", implies=["testicles", "penis"], needs=["male", "pair"], zh="抓睪丸"),
        pose("precum", implies=["penis"], needs=["male"], zh="先走汁"),
        pose("precum drip", implies=["precum"], needs=["male"], zh="先走汁滴落"),
        pose("precum string", implies=["precum"], needs=["male"], zh="先走汁拉絲"),
        pose("cum on hair", implies=["cum"], needs=["male"], zh="射在頭髮"),
        pose("cum in ass", implies=["cum"], needs=["male"], zh="肛內射精"),
        pose("cum on clothes", implies=["cum"], needs=["male"], zh="射在衣服上"),
        pose("cum on stomach", implies=["cum"], needs=["male"], zh="射在肚子"),
        pose("cum on legs", implies=["cum"], needs=["male"], zh="射在腿上"),
        pose("cum string", implies=["cum"], needs=["male"], zh="精液拉絲"),
        pose("cum on feet", implies=["cum"], needs=["male"], zh="射在腳上"),
        pose("cum on hands", implies=["cum"], needs=["male"], zh="射在手上"),
        pose("cum on penis", implies=["cum", "penis"], needs=["male"], zh="射在陰莖"),
        pose("excessive cum", implies=["cum"], needs=["male"], zh="大量精液"),
        pose("fivesome", implies=["group sex", "sex"], needs=["five", "pair", "group", "crowd"], zh="5P"),
        pose("foursome", implies=["group sex", "sex"], needs=["pair", "group", "crowd"], zh="4P"),
        pose("double handjob", implies=["handjob"], needs=["male", "2male"], zh="雙陰莖手交"),
        pose("two-handed handjob", implies=["handjob"], needs=["male"], zh="雙手手交"),
        pose("cooperative handjob", implies=["handjob"], needs=["male", "2female"], zh="協力手交"),
        pose("surrounded by penises", implies=["penis"], needs=["male", "group", "2male"], zh="被陰莖包圍"),
        pose("bukkake", implies=["cum"], needs=["male", "2male"], zh="集團顏射"),
        pose("after anal", needs=["male"], zh="肛交事後"),
        pose("penis awe", implies=["penis"], needs=["male", "pair"], mutex="expression", zh="陰莖震撼"),
        pose("projectile cum", implies=["ejaculation", "cum"], needs=["male"], zh="噴射精液"),
        pose("handsfree ejaculation", implies=["ejaculation"], needs=["male"], zh="無手射精"),
        pose("gokkun", implies=["cum in mouth"], needs=["male"], zh="吞精"),
    ]


def extra_erotic_tags() -> list[dict]:
    """上一輪沒有的色情字。全部先對過 Danbooru（category 0、有圖、未棄用）。

    已經在詞庫的不重灌：潮吹、發抖、身體冒熱氣、愛心瞳、綁手腕、兔女郎。
    射在她身上或要她當對象的，needs 同時要男和女，卡面才不會變成單人男生。
    結果字不 implies vaginal／anal／sex_act，體位格才留得下來。
    觸手性交只 implies tentacles，不 implies sex（sex 要 pair，會把第二個人拉進來）。
    """
    sex = ["sex"]
    flash = ["flash", "sex"]
    all_h = list(HEATS)
    modern = ["modern"]
    any_era = ["any"]
    both = ["male", "female"]

    def pose(tag, implies=None, needs=None, heat=None, gate="any", era=None, zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": gate,
            "heat": list(heat or sex),
            "mutex": None,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or any_era,
            "needs": needs or [],
            "zh": zh,
        }

    def feat(tag, gate="female", heat=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "feature",
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": None,
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": era or any_era,
            "needs": ["female"] if gate == "female" else [],
            "zh": zh,
        }

    def cloth(tag, mutex=None, layer="garment", implies=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "clothing",
            "gate": "female",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": layer,
            "era": era or modern,
            "needs": ["female"],
            "zh": zh,
        }

    return [
        # 看得到的結果。sex 的 mutex 是空的，體位還能再抽；不要掛 vaginal。
        pose("stomach bulge", implies=["sex"], needs=both, zh="腹部隆起"),
        pose("cum on pussy", implies=["cum"], needs=both, zh="射在陰部"),
        pose("pussy juice trail", implies=["pussy juice"], needs=["female"], gate="female", zh="愛液拉絲"),
        pose("pussy juice puddle", implies=["pussy juice"], needs=["female"], gate="female", zh="愛液灘"),
        # 這三個才是行為本身，所以進 SEX_ACT，可以 implies 同一個行為。
        pose("nursing handjob", implies=["handjob"], needs=both, zh="乳交手交"),
        pose("straddling paizuri", implies=["paizuri", "straddling"], needs=both, zh="跨坐乳交"),
        pose("mutual masturbation", needs=both, zh="互相手淫"),
        pose("anal fingering", needs=["female"], gate="female", zh="肛門指交"),
        pose("licking nipple", needs=both, zh="舔乳頭"),
        # 觸手不是男生。solo sex act，卡面維持 1girl。
        pose("tentacle sex", implies=["tentacles"], needs=["female"], gate="female", zh="觸手性交"),
        pose("tentacles", needs=["female"], gate="female", zh="觸手"),
        pose("leg lock", needs=both, zh="鎖腿"),
        pose("folded", needs=["female"], gate="female", zh="折疊體位"),
        pose("spread ass", needs=["female"], gate="female", heat=flash, zh="掰開臀部"),
        pose("grabbing from behind", needs=both, heat=flash, zh="從背後抓住"),
        pose("kissing neck", needs=both, heat=flash, zh="親脖子"),
        pose("head between breasts", needs=both, zh="頭埋在乳溝"),
        pose("breast smother", needs=both, zh="乳壓臉"),
        pose("spanking", needs=both, heat=flash, zh="打屁股"),
        pose("hickey", needs=["female"], gate="female", heat=flash, zh="吻痕"),
        pose("torogao", needs=["female"], gate="female", zh="蕩漾臉"),
        # 塞在身上的東西走 pose，不走 clothing，才不會被服裝加寬推進誘惑。
        pose("butt plug", implies=["sex toy"], needs=["female"], gate="female", era=modern, zh="肛塞"),
        pose("anal beads", implies=["sex toy"], needs=["female"], gate="female", era=modern, zh="肛珠"),
        pose("crotch rope", needs=["female"], gate="female", era=modern, zh="胯下繩"),
        feat("sideboob", zh="側乳"),
        feat("underboob", zh="下乳"),
        feat("backboob", zh="背乳"),
        cloth("bodystocking", mutex="onepiece", zh="連身襪"),
        cloth("pasties", zh="乳貼"),
        cloth("torn thighhighs", mutex="legs", implies=["thighhighs"], era=["modern", "victorian"], zh="破損過膝襪"),
    ]


def extra_kink_tags() -> list[dict]:
    """使用者點名的 56 個現役 Danbooru 字（2026-10-05 對過 category 0、有圖、未棄用）。

    尺度：日常構圖與種族走三檔；破損、挖洞、露背停在敏感；插入、刑具、獵奇只進性愛，
    分級再由 rating.js 收成 explicit。
    互斥：不開新格。鏡頭共用 camera，種族共用 race，衣服佔既有主衣格或布料層。
    洗腦、催眠、羞辱、奴隸、獵奇、膨脹、脫垂不進 sex_act，才不會把體位擠掉。
    口塞與分腿棍不 implies bondage：bondage 要 pair，單人戴口塞就會整筆失敗。
    扶他只標身體，不暗示 penis。penis 在這套引擎是「有男生」，兩套意思疊在一起會把男孩拉進來。
    """
    all_h = list(HEATS)
    sex = ["sex"]
    flash = ["flash", "sex"]
    modern = ["modern"]
    any_era = ["any"]

    def row(tag, section, zh, mutex=None, heat=None, gate="any", layer="normal",
            implies=None, needs=None, era=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": layer,
            "era": era or any_era,
            "needs": needs or [],
            "zh": zh,
        }

    return [
        # ---- 鏡頭。multiple views / 剖面 / 透視已從共同負面移出，否則正片會被負片抵銷。
        row("multiple views", "pose", "多視角", mutex="camera"),
        row("split screen", "pose", "分割畫面", mutex="camera"),
        row("pov hands", "pose", "第一人稱手", mutex="camera", implies=["pov"]),
        # 剖面跟透視是性愛圖解，不是鏡頭格，所以可以跟「從側面」共存。
        row("cross-section", "pose", "剖面圖", heat=sex),
        row("x-ray", "pose", "透視圖", heat=sex),

        # ---- 表情
        row("crying with eyes open", "pose", "睜眼流淚", mutex="expression", implies=["crying"]),

        # ---- 種族。正常模式不自動抽，跟怪物男同一條；多元模式女角也擲得到。
        # 魔物娘是傘，mutex 清空，由具體種族 implies 進來。乳牛娘是獸耳，不掛這把傘。
        row("monster girl", "feature", "魔物娘", gate="female", needs=["female"]),
        row("demon girl", "feature", "惡魔娘", mutex="race", gate="female",
            implies=["monster girl"], needs=["female"]),
        row("slime girl", "feature", "史萊姆娘", mutex="race", gate="female",
            implies=["monster girl"], needs=["female"]),
        row("cow girl", "feature", "乳牛娘", mutex="race", gate="female", needs=["female"]),

        # ---- 身體。扶他是女體，不佔種族格，也不要求男生。
        row("futanari", "feature", "扶他", gate="female", needs=["female"]),
        row("faceless male", "feature", "無臉男", gate="male", needs=["male"]),
        row("quadruple amputee", "feature", "四肢截斷", gate="female", heat=sex, needs=["female"]),
        row("breast expansion", "feature", "乳房膨脹", gate="female", heat=sex,
            implies=["large breasts"], needs=["female"]),

        # ---- 皮膚。淫紋含 pubic，分組要在 groups.py 先認 SKIN，才不會被收成身材。
        row("pubic tattoo", "feature", "淫紋", gate="female", heat=sex, needs=["female"]),
        row("heart tattoo", "feature", "愛心刺青"),
        row("body writing", "feature", "身體塗鴉"),
        row("tally", "feature", "正字記號", gate="female", heat=sex, needs=["female"]),

        # ---- 衣服。破衣是疊在衣服上的布料狀態，不佔布料互斥格。
        row("torn clothes", "clothing", "破衣", layer="garment"),
        row("cleavage cutout", "clothing", "胸口挖洞", mutex="top", gate="female",
            layer="garment", era=modern, needs=["female"]),
        row("virgin killer sweater", "clothing", "處男殺手毛衣", mutex="top", gate="female",
            layer="garment", implies=["sweater"], era=modern, needs=["female"]),
        row("backless outfit", "clothing", "露背裝", mutex="onepiece", gate="female",
            layer="garment", era=modern, needs=["female"]),
        row("o-ring bikini", "clothing", "O環比基尼", mutex="onepiece", gate="female",
            layer="garment", implies=["bikini"], era=modern, needs=["female"]),
        row("reverse bunnysuit", "clothing", "逆兔女郎", mutex="onepiece", gate="female",
            layer="garment", era=modern, needs=["female"]),
        row("harem outfit", "clothing", "後宮舞孃裝", mutex="onepiece", gate="female",
            layer="garment", needs=["female"]),
        # 跟既有的開襠內褲搶同一格內衣。
        row("crotchless", "clothing", "開襠", mutex="underwear_bottom", gate="female",
            layer="garment", heat=flash, era=modern, needs=["female"]),
        row("chastity belt", "clothing", "貞操帶", mutex="underwear_bottom", gate="female",
            layer="garment", heat=sex, era=modern, needs=["female"]),
        row("gag", "clothing", "口塞", layer="accessory", heat=sex),
        row("spreader bar", "clothing", "分腿棍", layer="accessory", heat=sex),
        row("nipple tassels", "clothing", "乳貼流蘇", layer="accessory", gate="female",
            heat=flash, era=modern, needs=["female"]),
        row("public vibrator", "clothing", "公共跳蛋", layer="accessory", gate="female",
            heat=sex, implies=["vibrator"], era=modern, needs=["female"]),

        # ---- 走光
        row("public nudity", "pose", "公開裸體", heat=flash, implies=["nude"]),

        # ---- 性愛主題（不佔體位格）
        row("mind control", "pose", "洗腦", heat=sex),
        row("hypnosis", "pose", "催眠", heat=sex, implies=["mind control"]),
        row("corruption", "pose", "惡墮", heat=sex),
        row("humiliation", "pose", "羞辱", heat=sex),
        row("slave", "pose", "奴隸", heat=sex),
        row("guro", "pose", "獵奇", heat=sex),
        row("inflation", "pose", "肚子膨脹", gate="female", heat=sex, needs=["female"]),
        row("cum inflation", "pose", "灌精鼓肚", gate="female", heat=sex,
            implies=["cum", "inflation"], needs=["female", "male"]),
        row("prolapse", "pose", "脫垂", gate="female", heat=sex, needs=["female"]),
        row("anal prolapse", "pose", "肛門脫垂", gate="female", heat=sex,
            implies=["prolapse"], needs=["female"]),

        # ---- 性行為本身（sex_act）。單人的進 SOLO_SEX_ACT。
        row("sex machine", "pose", "性愛機器", gate="female", heat=sex, era=modern, needs=["female"]),
        row("large insertion", "pose", "巨大插入", gate="female", heat=sex,
            implies=["object insertion"], needs=["female"]),
        row("urethral insertion", "pose", "尿道插入", gate="female", heat=sex, needs=["female"]),
        row("egg laying", "pose", "產卵", gate="female", heat=sex, needs=["female"]),
        row("nipple penetration", "pose", "乳頭插入", gate="female", heat=sex, needs=["female"]),
        row("fisting", "pose", "拳交", gate="female", heat=sex, needs=["female"]),
        row("vore", "pose", "吞食", heat=sex),
        row("armpit sex", "pose", "腋交", gate="female", heat=sex, needs=["female", "male", "pair"]),
        row("cervical penetration", "pose", "子宮姦", gate="female", heat=sex,
            implies=["vaginal"], needs=["female", "male", "pair"]),
        row("triple penetration", "pose", "三穴同插", gate="female", heat=sex,
            needs=["female", "male", "pair", "group", "2male"]),

        # ---- 場地與傢俱
        row("dungeon", "env", "地牢", mutex="place", implies=["indoors"]),
        row("prison cell", "env", "牢房", mutex="place", implies=["indoors"],
            era=["modern", "medieval", "victorian"]),
        row("glory hole", "env", "牆洞", mutex="place", implies=["indoors"], heat=sex, era=modern),
        row("wooden horse", "env", "木馬刑具", mutex="furniture", implies=["indoors"], heat=sex),
    ]


def extra_csv_tags() -> list[dict]:
    """danbooru_missing_tags.csv 裡還沒進詞庫的 150 個字。

    不開新互斥格。獸莖不暗示人類 penis，避免把男孩拉進來。
    水手領是領口，不佔上衣格，也不暗示項圈。
    雙插佔體位格並且要兩男；其餘性愛主題不佔體位格。
    手機的中文用「電話」，因為 cellphone 已經是「手機」。
    黃昏的中文讓給既有的 dusk，twilight 用「暮色」。
    丁字褲讓給既有的 thong，g-string 用「細繩丁字褲」。
    """
    all_h = list(HEATS)
    sex = ["sex"]
    flash = ["flash", "sex"]
    modern = ["modern"]
    any_era = ["any"]
    vic = ["victorian", "modern"]

    def row(tag, section, zh, mutex=None, heat=None, gate="any", layer="normal",
            implies=None, needs=None, era=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": layer,
            "era": era or any_era,
            "needs": needs or [],
            "zh": zh,
        }

    pair = ["female", "male", "pair"]
    two_male = ["female", "male", "pair", "group", "2male"]
    girl = ["female"]
    hetero = ["female", "male"]
    return [
        # ---- 配件。空互斥，正常模式靠釘選或奇葩模式進場，跟口塞同一條。
        row("halo", "clothing", "光環", layer="accessory"),
        row("piercing", "clothing", "穿洞", layer="accessory"),
        row("ear piercing", "clothing", "耳洞", layer="accessory", implies=["piercing"]),
        row("tongue piercing", "clothing", "舌環", layer="accessory", implies=["piercing"]),
        row("bandaid", "clothing", "OK繃", layer="accessory"),
        row("armband", "clothing", "臂章", layer="accessory"),
        row("needle", "clothing", "針", layer="accessory"),
        row("milking machine", "clothing", "擠乳機", layer="accessory", gate="female",
            heat=sex, implies=["lactation"], needs=girl),
        row("breast pump", "clothing", "吸乳器", layer="accessory", gate="female",
            heat=sex, implies=["lactation"], needs=girl),
        row("pillory", "clothing", "頸手枷", layer="accessory", heat=sex),
        row("stocks", "clothing", "枷鎖", layer="accessory", heat=sex),
        row("restraints", "clothing", "束具", layer="accessory", heat=sex),
        # cellphone 已是「手機」。這個字跟它搶手上道具那一格。
        row("phone", "env", "電話", mutex="held_prop", era=modern),

        # ---- 姿勢。屈膝不佔坐姿格，才不會把坐著擠掉。
        row("knees up", "pose", "屈膝抬腿"),
        row("v arms", "pose", "雙臂夾胸"),
        row("hands on own thighs", "pose", "手放大腿"),
        row("upside-down", "pose", "倒過來", mutex="camera"),
        row("sideways", "pose", "橫躺構圖", mutex="camera"),
        row("vanishing point", "pose", "消失點透視", mutex="camera"),
        # looking away 在 2023-06 停用，模型學的是 averting eyes。不收回詞庫。
        row("smirk", "pose", "壞笑", mutex="expression"),
        row("evil smile", "pose", "邪笑", mutex="expression"),
        row("crazy smile", "pose", "瘋狂笑", mutex="expression"),
        row("annoyed", "pose", "不耐煩", mutex="expression"),
        row("jitome", "pose", "半眼鄙視", mutex="expression"),
        # 病嬌是角色氣質，可以跟笑容共存，不佔表情格。
        row("yandere", "feature", "病嬌"),

        # ---- 身體與瞳孔。迷你娘不是蘿莉，也不跟身高格（petite）搶。
        row("minigirl", "feature", "迷你娘", gate="female", needs=girl),
        row("giantess", "feature", "女巨人", gate="female", needs=girl),
        row("long nipples", "feature", "長乳頭", gate="female", heat=sex, needs=girl),
        row("symbol-shaped pupils", "feature", "符號瞳孔"),
        row("slit pupils", "feature", "豎瞳"),
        row("ringed eyes", "feature", "環狀瞳"),
        row("split-color hair", "feature", "左右雙色髮"),
        row("robot joints", "feature", "機械關節"),
        row("injury", "feature", "受傷"),
        row("whip marks", "feature", "鞭痕", heat=sex),
        row("eyeliner", "feature", "眼線", gate="female", needs=girl),
        row("mascara", "feature", "睫毛膏", gate="female", needs=girl),
        row("red lips", "feature", "紅唇", gate="female", implies=["lipstick"], needs=girl),

        # ---- 種族零件可以疊。完整種族才佔種族格，正常模式不自動抽。
        row("animal ears", "feature", "獸耳"),
        row("tail", "feature", "尾巴"),
        row("horns", "feature", "角"),
        row("wings", "feature", "翅膀"),
        row("demon horns", "feature", "惡魔角", implies=["horns"]),
        row("demon wings", "feature", "惡魔翅膀", implies=["wings"]),
        row("angel wings", "feature", "天使翅膀", implies=["wings"]),
        row("cat girl", "feature", "貓娘", mutex="race", gate="female",
            implies=["animal ears"], needs=girl),
        row("fox girl", "feature", "狐娘", mutex="race", gate="female",
            implies=["animal ears"], needs=girl),
        row("dragon girl", "feature", "龍娘", mutex="race", gate="female",
            implies=["horns"], needs=girl),
        row("rabbit girl", "feature", "兔娘", mutex="race", gate="female",
            implies=["animal ears"], needs=girl),
        row("wolf girl", "feature", "狼娘", mutex="race", gate="female",
            implies=["animal ears"], needs=girl),
        row("dog girl", "feature", "犬娘", mutex="race", gate="female",
            implies=["animal ears"], needs=girl),
        row("kitsune", "feature", "妖狐", mutex="race", gate="female",
            implies=["animal ears"], needs=girl),
        row("mermaid", "feature", "人魚", mutex="race", gate="female", needs=girl),
        row("harpy", "feature", "鳥身女妖", mutex="race", gate="female",
            implies=["wings"], needs=girl),

        # ---- 衣服。丹寧短褲會再帶上丹寧；水手領只是領口。
        row("denim", "clothing", "丹寧", layer="garment", era=modern),
        row("shiny clothes", "clothing", "亮面衣料", layer="garment", era=modern),
        row("leather", "clothing", "皮革", layer="garment", era=vic),
        row("satin", "clothing", "緞面", layer="garment", era=vic),
        row("sailor collar", "clothing", "水手領", layer="garment", era=modern),
        row("halterneck", "clothing", "繞頸", layer="garment", era=modern),
        row("tube top", "clothing", "平口抹胸", mutex="top", gate="female",
            layer="garment", era=modern, needs=girl),
        row("living clothes", "clothing", "活體衣服", mutex="onepiece", layer="garment"),
        row("bike shorts", "clothing", "自行車短褲", mutex="bottom", layer="garment"),
        row("denim shorts", "clothing", "牛仔短褲", mutex="bottom", layer="garment",
            implies=["denim"]),
        row("dolphin shorts", "clothing", "海豚褲", mutex="bottom", layer="garment"),
        row("hakama skirt", "clothing", "袴裙", mutex="bottom", gate="female",
            layer="garment", needs=girl),
        row("leather jacket", "clothing", "皮外套", mutex="outer", layer="garment",
            implies=["leather"], era=modern),
        row("trench coat", "clothing", "風衣", mutex="outer", layer="garment"),
        row("fur coat", "clothing", "毛皮大衣", mutex="outer", layer="garment", era=vic),
        row("white thighhighs", "clothing", "白過膝襪", mutex="legs", gate="female",
            layer="garment", needs=girl),
        row("zettai ryouiki", "clothing", "絕對領域", mutex="legs", gate="female",
            layer="garment", implies=["thighhighs"], needs=girl),
        row("torn pantyhose", "clothing", "破褲襪", mutex="legs", gate="female",
            layer="garment", implies=["pantyhose"], needs=girl),
        row("fishnet pantyhose", "clothing", "網襪褲襪", mutex="legs", gate="female",
            layer="garment", implies=["pantyhose"], needs=girl),
        row("loose socks", "clothing", "泡泡襪", mutex="feet", layer="garment"),
        row("over-kneehighs", "clothing", "過膝長襪", mutex="legs", gate="female",
            layer="garment", implies=["kneehighs"], needs=girl),
        row("soles", "clothing", "腳底", mutex="feet", layer="accessory"),
        row("no shoes", "clothing", "沒穿鞋", mutex="feet", layer="accessory"),
        row("slippers", "clothing", "拖鞋", mutex="feet", layer="accessory"),
        row("stiletto heels", "clothing", "細跟高跟鞋", mutex="feet", gate="female",
            layer="accessory", implies=["high heels"], needs=girl),
        row("striped panties", "clothing", "條紋內褲", mutex="underwear_bottom", gate="female",
            layer="garment", needs=girl),
        row("side-tie panties", "clothing", "綁帶內褲", mutex="underwear_bottom", gate="female",
            layer="garment", needs=girl),
        row("highleg panties", "clothing", "高衩內褲", mutex="underwear_bottom", gate="female",
            layer="garment", needs=girl),
        row("string panties", "clothing", "細帶內褲", mutex="underwear_bottom", gate="female",
            layer="garment", needs=girl),
        row("lace-trimmed panties", "clothing", "蕾絲邊內褲", mutex="underwear_bottom",
            gate="female", layer="garment", needs=girl),
        row("g-string", "clothing", "細繩丁字褲", mutex="underwear_bottom", gate="female",
            layer="garment", implies=["thong"], needs=girl),
        row("strapless bra", "clothing", "無肩帶胸罩", mutex="underwear_top", gate="female",
            layer="garment", needs=girl),
        row("negligee", "clothing", "薄紗睡衣", mutex="onepiece", gate="female",
            layer="garment", era=modern, needs=girl),

        # ---- 畫面。愛心跟動態線搶特效格。黏液不是史萊姆娘。雲可以跟藍天一起。
        row("heart", "env", "愛心", mutex="effect"),
        row("motion lines", "env", "動態線", mutex="effect"),
        row("spoken heart", "env", "對話愛心", mutex="effect"),
        row("slime (substance)", "env", "黏液"),
        row("cloud", "env", "雲"),
        row("aurora", "env", "極光"),
        row("twilight", "env", "暮色", mutex="day_night"),
        row("floor", "env", "地板"),
        row("space", "env", "太空", mutex="place", era=modern),
        row("stage", "env", "舞台", mutex="place", implies=["indoors"]),
        row("school", "env", "學校", mutex="place", era=modern),
        row("train station", "env", "車站", mutex="place", era=modern),
        row("tentacle pit", "env", "觸手坑", mutex="place", implies=["indoors"], heat=sex),
        row("vacuum bed", "env", "真空床", mutex="furniture", heat=sex, era=modern),

        # ---- 畫風。只在釘選時出現，跟 1990s 畫風同一條。
        row("realistic", "quality", "寫實"),
        row("1980s (style)", "quality", "1980s 畫風", mutex="era_style"),

        # ---- 走光
        row("pussy peek", "pose", "露出一點陰部", gate="female", heat=flash, needs=girl),

        # ---- 性愛主題。不佔體位格，所以還能同時有一個體位。
        row("peeing", "pose", "尿尿", heat=sex),
        row("bestiality", "pose", "獸姦", heat=sex),
        row("animal penis", "feature", "獸莖", heat=sex),
        row("horse penis", "feature", "馬屌", heat=sex, implies=["animal penis"]),
        row("transformation", "pose", "變身", heat=sex),
        row("suspension", "pose", "吊縛", heat=sex),
        row("ovum", "pose", "卵子", heat=sex),
        row("fertilization", "pose", "受精", heat=sex),
        row("sperm cell", "pose", "精子", heat=sex),
        row("penis size difference", "pose", "尺寸差", gate="female", heat=sex, needs=pair),
        row("slapping", "pose", "打耳光", heat=sex),
        row("nipple pull", "pose", "拉乳頭", gate="female", heat=sex, needs=girl),
        row("stomach punch", "pose", "揍肚子", heat=sex),
        row("whipping", "pose", "鞭打", heat=sex, implies=["whip marks"]),
        row("lactation through clothes", "pose", "乳汁滲出衣服", gate="female", heat=sex,
            implies=["lactation"], needs=girl),
        row("objectification", "pose", "物化", heat=sex),
        row("human furniture", "pose", "人體家具", heat=sex),
        row("forniphilia", "pose", "人體家具癖", heat=sex, implies=["human furniture"]),
        row("sex doll", "pose", "性愛娃娃", heat=sex),
        row("cum in nose", "pose", "精液進鼻", gate="female", heat=sex, needs=hetero),
        row("cum through clothes", "pose", "精液滲出衣服", gate="female", heat=sex, needs=hetero),
        row("cum bubble", "pose", "精液泡泡", gate="female", heat=sex, needs=hetero),
        row("cumdump", "pose", "精液便器", gate="female", heat=sex, needs=hetero),
        row("excessive pussy juice", "pose", "愛液過多", gate="female", heat=sex, needs=girl),
        row("crucifixion", "pose", "釘十字架", heat=sex),
        row("petrification", "pose", "石化", heat=sex),
        row("scat", "pose", "排泄物", heat=sex),
        row("orgasm denial", "pose", "禁止高潮", heat=sex),
        row("parasite", "pose", "寄生", heat=sex),
        row("knotting", "pose", "成結", heat=sex, implies=["animal penis"]),
        row("penetration through clothes", "pose", "隔著衣服插入", gate="female", heat=sex, needs=girl),
        row("necrophilia", "pose", "姦屍", heat=sex),
        row("electrostimulation", "pose", "電擊刺激", heat=sex),
        row("encasement", "pose", "封入", heat=sex),
        row("wax play", "pose", "滴蠟", heat=sex),
        row("stomach (organ)", "pose", "胃（器官）", heat=sex),
        row("unbirthing", "pose", "逆生產", heat=sex),
        row("digestion", "pose", "消化", heat=sex),
        row("navel penetration", "pose", "肚臍插入", gate="female", heat=sex, needs=girl),

        # ---- 性行為本身。單人的進 SOLO_SEX_ACT。雙插要兩男，不進單人池。
        row("double anal", "pose", "雙插肛", gate="female", heat=sex,
            implies=["anal"], needs=two_male),
        row("double vaginal", "pose", "雙插穴", gate="female", heat=sex,
            implies=["vaginal"], needs=two_male),
        row("anal fisting", "pose", "肛門拳交", gate="female", heat=sex,
            implies=["fisting"], needs=girl),
        row("urethral fingering", "pose", "手指插尿道", gate="female", heat=sex,
            implies=["urethral insertion"], needs=girl),
        row("enema", "pose", "灌腸", gate="female", heat=sex, needs=girl),
        row("egg implantation", "pose", "植卵", gate="female", heat=sex,
            implies=["egg laying"], needs=girl),
    ]


def extra_csv_round2() -> list[dict]:
    """danbooru_missing_tags_round2.csv。不開新互斥格。

    角色扮演、便服、蘿莉塔服飾是疊在衣服上的說法，不佔整套那一格。
    蘿莉塔服飾不是 loli。西部牛仔女不是騎乘位。
    穿戴式假陽具暗示假陽具，不暗示人類陰莖。
    比基尼鎧甲不是泳裝，也不是鎧甲。衣服底下的泳裝不佔泳裝那一格。
    繩、銬、鐐不暗示束縛；膠帶封口和咬棒擋住張嘴，開口器則要張嘴。
    無碼是分級說明，只給釘選，不自動蓋上去。
    """
    all_h = list(HEATS)
    sex = ["sex"]
    flash = ["flash", "sex"]
    modern = ["modern"]
    vic = ["modern", "victorian"]
    edo_m = ["modern", "edo"]
    any_era = ["any"]

    def row(tag, section, zh, mutex=None, heat=None, gate="any", layer="normal",
            implies=None, needs=None, era=None, bind=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": bind or [],
            "implies": implies or [],
            "layer": layer,
            "era": era or any_era,
            "needs": needs or [],
            "zh": zh,
        }

    pair = ["pair"]
    girl = ["female"]
    hetero = ["female", "male", "pair"]
    cloth = "clothing"
    g = "garment"
    acc = "accessory"
    return [
        # ---- 配件。有格子的走那一格；沒格子的高頻字走布料層或側骰，不另開永遠補的格。
        row("fake animal ears", cloth, "假獸耳（髮箍）", layer=acc),
        row("neck ribbon", cloth, "領口蝴蝶結", mutex="neckwear", layer=acc),
        row("rope", cloth, "繩子", layer=acc, heat=sex),
        row("cuffs", cloth, "銬", mutex="hands", layer=acc, heat=sex),
        row("shackles", cloth, "鐐銬", layer=acc, heat=sex),
        row("cowboy hat", cloth, "牛仔帽", mutex="headwear", layer=acc, implies=["hat"], era=modern),
        row("nipple rings", cloth, "乳環", layer=acc, gate="female", heat=sex, implies=["piercing"], needs=girl),
        row("chain leash", cloth, "鐵鍊牽繩", layer=acc, heat=sex, implies=["leash"]),
        row("nipple bar", cloth, "乳頭橫棒穿環", layer=acc, gate="female", heat=sex,
            implies=["nipple rings"], needs=girl),
        row("belly chain", cloth, "腰鍊", layer=acc, gate="female", needs=girl),
        row("tape gag", cloth, "膠帶封口", layer=acc, heat=sex, implies=["gag"]),
        row("bit gag", cloth, "咬棒口枷", layer=acc, heat=sex, implies=["gag"]),
        row("latex gloves", cloth, "乳膠手套", mutex="hands", layer=acc, era=modern),
        row("strap-on", cloth, "穿戴式假陽具", layer=acc, gate="female", heat=sex,
            implies=["dildo"], needs=girl),
        row("multiple condoms", cloth, "多個保險套", layer=acc, implies=["condom"]),
        row("vibrator cord", cloth, "跳蛋線", layer=acc, gate="female", heat=sex,
            implies=["vibrator"], needs=girl),
        row("cross pasties", cloth, "十字乳貼", layer=acc, gate="female", heat=flash,
            implies=["pasties"], needs=girl),
        row("nose ring", cloth, "鼻環", layer=acc, implies=["piercing"]),
        row("vibrator in thighhighs", cloth, "跳蛋塞襪口", layer=acc, gate="female", heat=sex,
            implies=["vibrator", "thighhighs"], needs=girl),
        row("vibrator on nipple", cloth, "乳頭跳蛋", layer=acc, gate="female", heat=sex,
            implies=["vibrator"], needs=girl),
        row("ring gag", cloth, "開口器", layer=acc, heat=sex, implies=["gag", "open mouth"]),
        row("nose hook", cloth, "鼻勾", layer=acc, heat=sex),
        row("speculum", cloth, "窺陰器", layer=acc, gate="female", heat=sex, needs=girl),

        # ---- 身體。子宮不是體位。身高差不是身高格，至少要兩個人。
        row("dark nipples", "feature", "深色乳頭", gate="female", heat=flash, needs=girl),
        row("pussy piercing", "feature", "陰部穿環", gate="female", heat=sex,
            implies=["piercing"], needs=girl),
        row("genderswap", "feature", "性轉"),
        row("height difference", "feature", "身高差", needs=pair),
        row("uterus", "feature", "子宮", gate="female", heat=sex, needs=girl),
        row("cervix", "feature", "子宮頸", gate="female", heat=sex, needs=girl),
        row("sun tattoo", "feature", "曬痕圖案"),
        row("ass tattoo", "feature", "屁股刺青", gate="female", heat=flash, needs=girl),
        row("branded", "feature", "烙印", heat=sex),
        row("tramp stamp", "feature", "下背刺青", gate="female", heat=flash, needs=girl),

        # ---- 下身與腿。吊帶是疊在衣服上的，不佔下身格。
        row("suspenders", cloth, "吊帶", layer=g, era=vic),
        row("overalls", cloth, "吊帶褲", mutex="onepiece", layer=g, era=modern),
        row("micro shorts", cloth, "超短熱褲", mutex="bottom", layer=g, gate="female",
            era=modern, needs=girl),
        row("sweatpants", cloth, "運動褲", mutex="bottom", layer=g, era=modern),
        row("leggings", cloth, "內搭褲", mutex="legs", layer=g, era=modern),
        row("latex legwear", cloth, "乳膠腿襪", mutex="legs", layer=g, gate="female",
            era=modern, needs=girl),

        # ---- 鏡頭與特效。前景模糊不佔鏡頭格。
        row("blurry foreground", "pose", "前景模糊"),
        row("afterimage", "env", "殘影", mutex="effect"),
        row("time stop", "env", "時間停止", mutex="effect"),

        # ---- 時代衣服。振袖帶出和服。德國裙含現代，大衣只有現代所以雨衣才帶大衣。
        row("furisode", cloth, "振袖", mutex="onepiece", layer=g, gate="female",
            era=["edo"], implies=["kimono"], bind=["japanese clothes"], needs=girl),
        row("happi", cloth, "法被", mutex="outer", layer=g, era=edo_m),
        row("hanbok", cloth, "韓服", mutex="onepiece", layer=g, gate="female", era=modern, needs=girl),
        row("dirndl", cloth, "德國傳統裙", mutex="onepiece", layer=g, gate="female", era=vic, needs=girl),
        row("ao dai", cloth, "越南奧黛", mutex="onepiece", layer=g, gate="female", era=modern, needs=girl),
        row("skin tight", cloth, "緊身貼膚", layer=g),

        # ---- 表情。啜泣是哭的一種。猙獰淫笑只在性愛。
        row("sobbing", "pose", "啜泣", mutex="expression", implies=["crying"]),
        row("rape face", "pose", "猙獰淫笑", mutex="expression", heat=sex),
        row("kimono lift", "pose", "掀起和服", mutex="clothes_action", heat=flash,
            era=["edo"], implies=["kimono"], bind=["japanese clothes"]),

        # ---- 職業。只在有開職業時進池。鋼管舞是活動，不是職業。
        row("ballerina", "feature", "芭蕾舞者", mutex="job", gate="female", needs=girl),
        row("pole dancing", "pose", "鋼管舞", mutex="activity", era=modern),
        row("dominatrix", "feature", "女王", mutex="job", gate="female", heat=sex, needs=girl),
        row("astronaut", "feature", "太空人", mutex="job", era=modern),
        row("bartender", "feature", "調酒師", mutex="job", era=vic),
        row("wizard", "feature", "巫師", mutex="job"),
        row("lifeguard", "feature", "救生員", mutex="job", era=modern),
        row("cowgirl (western)", "feature", "西部牛仔女", mutex="job", gate="female",
            era=modern, needs=girl),
        row("stripper", "feature", "脫衣舞孃", mutex="job", gate="female", heat=flash, needs=girl),
        row("mechanic", "feature", "技師", mutex="job", era=modern),
        row("queen", "feature", "女王（王室）", mutex="job", gate="female",
            era=["medieval", "ancient_china"], needs=girl),
        row("cashier", "feature", "收銀員", mutex="job", era=modern),
        row("coach", "feature", "教練", mutex="job", era=modern),
        row("model", "feature", "模特兒", mutex="job", era=modern),

        # ---- 裸身但仍有一層東西。跟 naked apron 一樣，身上不能再有主衣。
        row("naked ribbon", cloth, "裸身綁緞帶", mutex="nudity", layer="skin", gate="female",
            heat=flash, implies=["nude"], needs=girl),
        row("naked bandage", cloth, "裸身纏繃帶", mutex="nudity", layer="skin",
            heat=flash, implies=["nude"]),
        row("painted clothes", cloth, "彩繪衣服", mutex="nudity", layer="skin",
            heat=flash, implies=["nude"]),

        # ---- 整套。後綴會帶出洋裝、緊身衣、連身衣的才佔同一格。
        row("cosplay", cloth, "角色扮演", layer=g),
        row("highleg leotard", cloth, "高衩緊身衣", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("strapless dress", cloth, "無肩帶洋裝", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("casual", cloth, "便服", layer=g),
        row("lolita fashion", cloth, "蘿莉塔服飾", layer=g, gate="female", era=modern, needs=girl),
        row("pinafore dress", cloth, "背心裙", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("halloween costume", cloth, "萬聖節服裝", layer=g, era=modern),
        row("bikini armor", cloth, "比基尼鎧甲", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("gothic lolita", cloth, "哥德蘿莉塔", layer=g, gate="female", era=modern,
            implies=["lolita fashion"], needs=girl),
        row("animal costume", cloth, "動物裝", layer=g, era=modern),
        row("backless dress", cloth, "露背洋裝", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("swimsuit under clothes", cloth, "衣服底下穿泳裝", layer=g, era=modern),
        row("jumpsuit", cloth, "連身褲", mutex="onepiece", layer=g, era=modern),
        row("costume switch", cloth, "換穿別人的衣服", layer=g),
        row("reverse outfit", cloth, "逆衣", layer=g),
        row("latex bodysuit", cloth, "乳膠連身衣", mutex="onepiece", layer=g, era=modern),
        row("thong leotard", cloth, "丁字緊身衣", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("pencil dress", cloth, "窄裙洋裝", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("pant suit", cloth, "褲裝套裝", mutex="onepiece", layer=g, era=modern),
        row("sports bikini", cloth, "運動比基尼", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("cocktail dress", cloth, "短晚禮服", mutex="onepiece", layer=g, gate="female", needs=girl),
        row("hospital gown", cloth, "病人服", mutex="onepiece", layer=g, era=modern),
        row("straitjacket", cloth, "束縛衣", mutex="onepiece", layer=g, heat=sex),
        row("catsuit", cloth, "貓裝", mutex="onepiece", layer=g, era=modern),
        # pilot suit 在 2024-10 被 Danbooru 停用，沒有單一後繼。
        # wiki 拆成三個不同的衣服：機甲駕駛服、飛行服、民航制服。
        # 這格原本是現代連身衣，動畫裡對上的是機甲駕駛服（2.7 萬張）。
        # 飛行服、民航制服是另一種衣服，不在這裡補。
        row("mecha pilot suit", cloth, "機甲駕駛服", mutex="onepiece", layer=g, era=modern),

        # ---- 不是畫面內容。品質段不會被自動補。
        row("uncensored", "quality", "無碼"),

        # ---- 外層。女僕圍裙不暗示圍裙，圍裙佔的是整套那一格。
        row("maid apron", cloth, "女僕圍裙", layer=g, gate="female", era=vic, needs=girl),
        row("cropped jacket", cloth, "短版外套", mutex="outer", layer=g, era=modern),
        row("waist apron", cloth, "腰圍裙", layer=g, era=vic),
        row("frilled apron", cloth, "荷葉邊圍裙", layer=g, gate="female", era=vic, needs=girl),
        row("shrug (clothing)", cloth, "短版披肩外套", mutex="outer", layer=g, era=modern),
        row("raincoat", cloth, "雨衣", mutex="outer", layer=g, era=modern, implies=["coat"]),
        row("bomber jacket", cloth, "飛行外套", mutex="outer", layer=g, era=modern),

        # ---- 性愛主題。不佔體位格的才能跟一個體位同時在。
        # 異種不暗示獸姦。綁腳踝不暗示束縛，束縛會把雙手算成忙。
        # 睡姦不暗示睡著：睡著這個字沒有性愛檔，帶進去整筆會失敗。
        row("interspecies", "pose", "異種姦", heat=sex),
        row("femdom", "pose", "女性支配", gate="female", heat=sex, needs=girl),
        row("spread anus", "pose", "掰開肛門", gate="female", heat=flash, needs=girl),
        row("food on body", "pose", "身上放食物", heat=sex),
        row("gaping", "pose", "撐開的洞", gate="female", heat=sex, needs=girl),
        row("bound ankles", "pose", "綁腳踝", heat=sex),
        row("frogtie", "pose", "青蛙縛", heat=sex, implies=["bondage"]),
        row("whipped cream", "pose", "鮮奶油", heat=sex),
        row("sleep molestation", "pose", "睡姦猥褻", gate="female", heat=sex, needs=["female", "pair"]),
        row("molestation", "pose", "猥褻", gate="female", heat=sex, needs=["female", "pair"]),
        row("chocolate on body", "pose", "身上淋巧克力", heat=sex),
        row("leash pull", "pose", "拉牽繩", heat=sex, implies=["leash"], needs=pair),
        row("legs over head", "pose", "腿過頭", heat=flash),
        row("cum in container", "pose", "精液裝容器", heat=sex, implies=["cum"], needs=["male"]),
        row("public use", "pose", "公共便器", gate="female", heat=sex, needs=hetero),
        row("hogtie", "pose", "駟馬縛", heat=sex, implies=["bondage"]),
        row("tape bondage", "pose", "膠帶綑綁", heat=sex, implies=["bondage"]),
        row("crotch grab", "pose", "抓胯下", heat=sex, needs=pair),
        row("foot worship", "pose", "舔腳崇拜", heat=sex, needs=pair),
        row("trampling", "pose", "踩踏", heat=sex, needs=pair),
        row("mounting", "pose", "騎上", heat=sex, needs=pair),
        row("netorase", "pose", "讓妻", heat=sex, needs=hetero),
        row("hidden camera", "pose", "偷拍鏡頭", heat=flash),
        row("crotch kick", "pose", "踢胯下", gate="female", heat=sex, needs=["female", "pair"]),
        row("cum on food", "pose", "精液淋食物", heat=sex, implies=["cum"], needs=["male"]),
        row("nyotaimori", "pose", "女體盛", gate="female", heat=sex, implies=["food on body"], needs=girl),
        row("underwater sex", "pose", "水中性愛", gate="female", heat=sex,
            implies=["underwater"], needs=["female", "pair"]),

        # ---- 體位。雙人的會再被補上 pair。騎假陽具是單人。
        row("buttjob", "pose", "臀交", gate="female", heat=sex, needs=hetero),
        row("dildo riding", "pose", "騎假陽具", gate="female", heat=sex,
            implies=["dildo"], needs=girl),
        row("hairjob", "pose", "髮交", gate="female", heat=sex, needs=hetero),
        row("naizuri", "pose", "平胸摩擦", gate="female", heat=sex, needs=hetero),
        row("pegging", "pose", "女攻男肛", gate="female", heat=sex, implies=["strap-on"], needs=hetero),
        row("prostate milking", "pose", "前列腺按摩", gate="female", heat=sex, needs=hetero),
        row("kneepit sex", "pose", "膝窩交", gate="female", heat=sex, needs=hetero),

        # ---- 上衣與內衣。毛衣背心是背心，不是毛衣。纏胸布佔上衣，江戶才抽得到。
        row("sweater vest", cloth, "毛衣背心", mutex="top", layer=g, era=modern, implies=["vest"]),
        row("bikini top only", cloth, "只穿比基尼上衣", mutex="top", layer=g, gate="female",
            heat=flash, era=modern, implies=["bottomless"], needs=girl),
        row("breastplate", cloth, "胸甲", mutex="top", layer=g, era=["modern", "medieval"]),
        row("sailor shirt", cloth, "水手服上衣", mutex="top", layer=g, era=modern),
        row("underbust", cloth, "托胸馬甲", mutex="top", layer=g, gate="female", era=vic, needs=girl),
        row("gym shirt", cloth, "體育服上衣", mutex="top", layer=g, era=modern),
        row("oversized clothes", cloth, "過大的衣服", layer=g, era=modern),
        row("oversized shirt", cloth, "過大的襯衫", mutex="top", layer=g, era=modern),
        row("rash guard", cloth, "防曬衣", mutex="top", layer=g, era=modern),
        row("sarashi", cloth, "纏胸布", mutex="top", layer=g, gate="female", era=edo_m, needs=girl),
        row("maebari", cloth, "前貼", mutex="underwear_bottom", layer=g, gate="female",
            heat=flash, needs=girl),
        row("bustier", cloth, "馬甲胸衣", mutex="underwear_top", layer=g, gate="female", era=vic, needs=girl),
        row("heart maebari", cloth, "愛心前貼", mutex="underwear_bottom", layer=g, gate="female",
            heat=flash, implies=["maebari"], needs=girl),
        row("bridal lingerie", cloth, "新娘內衣", mutex="onepiece", layer=g, gate="female",
            era=vic, implies=["lingerie"], needs=girl),
    ]


def extra_csv_round3() -> list[dict]:
    """danbooru_missing_tags_round3.csv。不開新互斥格，也不另開永遠補的格。

    天線髮、髮束、側剃、別瀏海、發光的頭髮跟馬尾疊，不佔髮型格。
    往後梳、莫霍克、臟辮、爆炸頭才佔那一格。
    智慧型手機、布偶、泰迪熊、自拍棒跟電話一樣豁免手持閘，仍佔手持格。
    智慧型手機帶出手機。手機自己仍要對上拍照或講電話。
    公主抱、揹人、扛肩不佔活動格，也不暗示抱著，否則室內傢俱會整筆拒掉。
    花田、麥田、草原不暗示田野：田野只有古中國、江戶、中世紀。
    大教堂不暗示教堂：教堂只有現代。
    電扶梯和佈告欄不是場地。室內外暗示會被拿掉，跟白板一樣。
    耳機掛脖子不是戴在頭上。單眼眼罩跟蒙眼的眼罩不是同一個字。
    倒過來口交和喉嚨鼓起要直接帶出口部愛撫。父子同格不是傳遞的，中間那層會把口部愛撫擠掉。
    臉埋枕頭要直接帶出趴著，不然中間的臉朝下會把趴著擠掉。
    """
    all_h = list(HEATS)
    sex = ["sex"]
    flash = ["flash", "sex"]
    modern = ["modern"]
    cathedral_era = ["modern", "victorian", "medieval"]

    def row(tag, section, zh, mutex=None, heat=None, gate="any", layer="normal",
            implies=None, needs=None, era=None, bind=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": bind or [],
            "implies": implies or [],
            "layer": layer,
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    pair = ["pair"]
    girl = ["female"]
    male_pair = ["male", "pair"]
    cloth = "clothing"
    feat = "feature"
    pose = "pose"
    env = "env"
    g = "garment"
    acc = "accessory"
    return [
        # ---- 配件。眼罩跟眼鏡同一格。掛脖子的耳機不佔頭上那一格。
        row("stuffed toy", env, "布偶玩具", mutex="held_prop", era=modern),
        row("teddy bear", env, "泰迪熊", mutex="held_prop", era=modern, implies=["stuffed toy"]),
        row("selfie stick", env, "自拍棒", mutex="held_prop", era=modern),
        row("eyepatch", cloth, "單眼眼罩", mutex="eyewear", layer=acc),
        row("medical eyepatch", cloth, "醫療眼罩", mutex="eyewear", layer=acc, implies=["eyepatch"]),
        row("bandage over one eye", cloth, "單眼包紮", mutex="eyewear", layer=acc),
        row("eyewear on head", cloth, "眼鏡推上額頭", mutex="eyewear", layer=acc, implies=["glasses"]),
        row("headphones around neck", cloth, "耳機掛脖子", layer=acc, era=modern),
        row("earbuds", cloth, "耳機", layer=acc, era=modern),
        row("bandaged arm", cloth, "手臂纏繃帶", layer=acc),
        row("bandaged leg", cloth, "腿上纏繃帶", layer=acc),
        row("bandaged head", cloth, "頭部包紮", layer=acc),
        row("bandaid on face", cloth, "臉上貼OK繃", layer=acc, implies=["bandaid"]),
        row("bandaid on nose", cloth, "鼻子貼OK繃", layer=acc, implies=["bandaid"]),
        row("bandaid on knee", cloth, "膝蓋貼OK繃", layer=acc, implies=["bandaid"]),
        row("bandaid on cheek", cloth, "臉頰貼OK繃", layer=acc, implies=["bandaid"]),
        row("bandaid on pussy", cloth, "陰部貼OK繃", layer=acc, gate="female", heat=sex,
            implies=["bandaid"], needs=girl),
        row("zipper pull tab", cloth, "拉鍊頭", layer=g, era=modern),

        # ---- 手持跟姿勢。智慧型手機帶出手機，不帶出電話。
        row("smartphone", env, "智慧型手機", mutex="held_prop", era=modern, implies=["cellphone"]),
        row("salute", pose, "敬禮"),
        row("princess carry", pose, "公主抱", needs=pair),
        # 抱著另一個人（Danbooru implies carrying，17562 張）。2026-10-25 專案主拿出封鎖，當一般牌。
        row("carrying person", pose, "抱人", needs=pair),
        row("pillow hug", pose, "抱枕頭", implies=["pillow"]),
        row("smelling", pose, "聞氣味"),
        row("piggyback", pose, "揹在背上", needs=pair),
        row("shoulder carry", pose, "扛在肩上", needs=pair),
        row("bowing", pose, "鞠躬", mutex="body_pose", implies=["standing"]),
        row("curtsey", pose, "屈膝禮", mutex="body_pose", gate="female", implies=["standing"], needs=girl),

        # ---- 身體姿勢。抱自己的腿、蜷縮要有腿。鞠躬不用。
        row("between legs", pose, "從腿間穿過"),
        row("outstretched hand", pose, "伸出的手"),
        row("hugging own legs", pose, "抱自己的腿", implies=["sitting"]),
        row("head on pillow", pose, "頭枕枕頭", implies=["pillow"]),
        row("lap pillow", pose, "膝枕", needs=pair),
        row("w arms", pose, "雙手叉腰上舉成W"),
        row("fetal position", pose, "胎兒蜷縮姿勢", mutex="body_pose", implies=["lying"]),
        row("curled up", pose, "蜷成一團", mutex="body_pose"),
        row("face down", pose, "臉朝下", mutex="body_pose", implies=["on stomach"]),
        row("face in pillow", pose, "臉埋枕頭", implies=["pillow", "face down", "on stomach"]),
        row("clinging", pose, "緊緊抓住", needs=pair),
        row("sitting between legs", pose, "坐在別人腿間", implies=["sitting"], needs=pair),

        # ---- 破衣。後綴會帶出襯衫和裙子，這裡不手寫。
        row("torn shirt", cloth, "破襯衫", mutex="top", layer=g),
        row("torn skirt", cloth, "破裙子", mutex="bottom", layer=g, gate="female", needs=girl),
        row("unzipped", cloth, "拉開拉鍊", layer=g, heat=flash, era=modern),

        # ---- 效果。兩個都佔效果格，所以跟火花二選一，彼此當父子留著。
        row("water drop", env, "水珠", mutex="effect"),
        row("dripping", env, "滴落", mutex="effect", implies=["water drop"]),

        # ---- 眼睛跟臉。發光的眼睛不佔眼睛顏色。瘋狂的眼睛是表情。
        row("glowing eye", feat, "發光的眼睛"),
        row("crazy eyes", pose, "瘋狂的眼睛"),
        row("dilated pupils", feat, "放大的瞳孔"),
        row("forehead", feat, "額頭"),
        row("double v", pose, "雙手比耶", implies=["v"]),
        row("hand on own cheek", pose, "手托臉頰"),
        row("hand on own chin", pose, "手托下巴"),
        row("thumbs up", pose, "豎拇指"),
        row("blood from mouth", feat, "嘴角流血", implies=["open mouth"]),
        row("finger gun", pose, "手指槍"),
        row("ok sign", pose, "OK手勢"),
        row("blowing kiss", pose, "飛吻"),
        row("covering own eyes", pose, "遮住自己的眼睛"),
        row("finger heart", pose, "手指比愛心"),
        row("cheek squash", pose, "捏臉頰", needs=pair),

        # ---- 道具。不是場地，也不是傢俱格，站著的人仍站得住。
        row("computer", env, "電腦", era=modern),
        row("monitor", env, "螢幕", era=modern, implies=["computer"]),
        row("laptop", env, "筆電", era=modern, implies=["computer"]),
        row("bulletin board", env, "佈告欄", era=modern),
        row("escalator", env, "電扶梯", era=modern),

        # ---- 視線。探頭是偷看的一種。
        row("peeking", pose, "偷看", mutex="gaze"),
        row("peeking out", pose, "探頭偷看", mutex="gaze", implies=["peeking"]),

        # ---- 頭髮。
        row("antenna hair", feat, "天線髮"),
        row("hair flaps", feat, "飄動的髮束"),
        row("bangs pinned back", feat, "瀏海別起來"),
        row("undercut", feat, "側剃髮型"),
        row("glowing hair", feat, "發光的頭髮"),
        row("hair slicked back", feat, "梳到後面的頭髮", mutex="hair_style"),
        row("mohawk", feat, "莫霍克髮型", mutex="hair_style"),
        row("dreadlocks", feat, "臟辮", mutex="hair_style"),
        row("afro", feat, "爆炸頭", mutex="hair_style"),

        # ---- 場地。
        row("flower field", env, "花田", mutex="place", implies=["outdoors"]),
        row("wheat field", env, "麥田", mutex="place", implies=["outdoors"]),
        row("meadow", env, "草原", mutex="place", implies=["outdoors"]),
        row("cliff", env, "懸崖", mutex="place", implies=["outdoors"]),
        row("graveyard", env, "墓地", mutex="place", implies=["outdoors"]),
        row("pier", env, "碼頭", mutex="place", implies=["outdoors"]),
        row("harbor", env, "港口", mutex="place", implies=["outdoors"]),
        row("bus stop", env, "公車站", mutex="place", era=modern, implies=["outdoors"]),
        row("playground", env, "遊樂場", mutex="place", era=modern, implies=["outdoors"]),
        row("highway", env, "高速公路", mutex="place", era=modern, implies=["outdoors"]),
        row("taxi", env, "計程車", mutex="place", era=modern, implies=["car"]),
        row("aquarium", env, "水族館", mutex="place", era=modern, implies=["indoors"]),
        row("arcade", env, "街機店", mutex="place", era=modern, implies=["indoors"]),
        row("factory", env, "工廠", mutex="place", era=modern, implies=["indoors"]),
        row("cathedral", env, "大教堂", mutex="place", era=cathedral_era, implies=["indoors"]),
        row("cave interior", env, "洞穴內部", mutex="place", implies=["cave"]),
        row("space station", env, "太空站", mutex="place", era=modern, implies=["space"]),

        # ---- 性愛。抓住頭兩個人就夠，不強制男生。舔耳朵不是口交。
        row("head grab", pose, "抓住頭", heat=sex, needs=pair),
        row("reverse fellatio", pose, "倒過來口交", mutex="sex_act", heat=sex,
            implies=["fellatio", "oral"], needs=male_pair),
        row("throat bulge", pose, "喉嚨鼓起", heat=sex, implies=["fellatio", "oral"], needs=male_pair),
        row("licking ear", pose, "舔耳朵", heat=sex, needs=pair),
        row("clothes grab", pose, "抓住衣服", needs=pair),
        row("hand under clothes", pose, "手伸進衣服裡", heat=flash),
        row("undressing another", pose, "幫別人脫衣", heat=flash, needs=pair),

        # ---- 痕跡。口紅印不是她正在擦口紅。咬痕不是吻痕。
        row("blood on face", feat, "臉上有血"),
        row("blood on clothes", cloth, "衣服上有血", layer=g),
        row("bite mark", feat, "咬痕"),
        row("lipstick mark", feat, "口紅印"),
        row("lipstick mark on neck", feat, "脖子上的口紅印", implies=["lipstick mark"]),
    ]


def extra_csv_round4() -> list[dict]:
    """多元文化與姿勢／風格／場景兩份 CSV。不開新互斥格，也不另開永遠補的格。

    素描、寫實照片風留在共同負面，不收。收進來會跟每一張的負面詞打架。
    6人以上、4個男生只給釘選，不進人數權重。男生自動補人仍停在 3boys。
    民族類別跟具體衣服疊，不佔同一格。花田、向日葵田不暗示田野。
    電扶梯那種不是場地的字，室內外暗示會被拿掉。
    關係詞不帶 loli、shota、child。母女是兩個成年女性。
    """
    all_h = list(HEATS)
    modern = ["modern"]
    edo = ["edo"]
    vic = ["modern", "victorian"]
    china = ["ancient_china"]
    china_m = ["ancient_china", "modern"]
    edo_m = ["edo", "modern"]
    greece = ["ancient_greece"]
    cosplay_era = ["modern", "victorian"]
    arch_era = ["modern", "victorian", "medieval"]
    wine_era = ["modern", "victorian", "medieval", "ancient_greece"]
    cloth = "clothing"
    feat = "feature"
    pose = "pose"
    env = "env"
    qual = "quality"
    g = "garment"
    acc = "accessory"
    pair = ["pair"]
    girl = ["female"]
    boy = ["male"]
    two_f = ["female", "2female", "pair"]
    two_m = ["male", "2male", "pair"]
    yaoi_needs = ["yaoi", "male", "2male", "pair"]
    hetero = ["female", "male", "pair"]
    group = ["group"]

    def row(tag, section, zh, mutex=None, heat=None, gate="any", layer="normal",
            implies=None, needs=None, era=None, bind=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": bind or [],
            "implies": implies or [],
            "layer": layer,
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    return [
        # ---- 配件與手持物。不佔電話那一格。油紙傘帶出雨傘，沒下雨時雨傘會被收掉。
        row("chopsticks", env, "筷子", era=china_m + ["edo"]),
        row("oil-paper umbrella", cloth, "油紙傘", layer=acc, era=china + edo, implies=["umbrella"]),
        row("chinese knot", cloth, "中國結", layer=acc, era=china_m),
        row("uchiwa", env, "團扇", era=edo),
        row("turban", cloth, "頭巾", mutex="headwear", layer=acc),
        row("sparkler", env, "仙女棒", mutex="effect", era=modern, implies=["fireworks"]),
        row("flower necklace", cloth, "花項鍊", mutex="jewelry", layer=acc, implies=["necklace"]),
        row("bindi", feat, "眉心點", gate="female", implies=["forehead mark"], needs=girl),
        row("masquerade mask", cloth, "假面舞會面具", mutex="headwear", layer=acc, era=vic, implies=["mask"]),
        row("lei", cloth, "花環", layer=acc),
        row("hijab", cloth, "伊斯蘭頭巾", mutex="headwear", layer=acc, gate="female", era=modern, needs=girl),
        row("sombrero", cloth, "寬邊帽", mutex="headwear", layer=acc, era=modern, implies=["hat"]),
        row("celtic knot", cloth, "凱爾特結", layer=acc, era=["medieval", "modern"]),
        row("kokoshnik", cloth, "俄羅斯頭冠", mutex="headwear", layer=acc, gate="female", era=vic, needs=girl),
        # ---- 食物是場景裡的東西，不佔活動格，也不暗示吃或喝。
        row("wine", env, "葡萄酒", era=wine_era),
        row("sake", env, "清酒", era=edo_m),
        row("pizza", env, "披薩", era=modern),
        row("sushi", env, "壽司", era=edo_m),
        row("ramen", env, "拉麵", era=edo_m),
        row("curry", env, "咖哩", era=modern),
        row("pasta", env, "義大利麵", era=modern),
        row("champagne", env, "香檳", era=modern),
        row("mooncake", env, "月餅", era=china_m),
        row("lion dance", pose, "舞獅", mutex="activity", era=china_m),
        row("taco", env, "塔克", era=modern),
        row("goldfish scooping", pose, "撈金魚", mutex="activity", era=edo_m),
        row("sunflower", env, "向日葵"),
        row("autumn leaves", env, "秋葉", mutex="weather"),
        row("fireworks", env, "煙火", mutex="effect", era=modern),
        row("maple leaf", env, "楓葉", mutex="weather", implies=["autumn leaves"]),
        row("plum blossoms", env, "梅花", mutex="weather"),
        # ---- 衣服。印花和服走和服後綴，帶出和服與日式服裝。花紋款再直接帶出印花款。
        row("print kimono", cloth, "印花和服", layer=g, era=edo),
        row("floral print kimono", cloth, "花紋和服", layer=g, era=edo, implies=["print kimono"]),
        row("ancient egyptian clothes", cloth, "古埃及服裝", mutex="onepiece", layer=g, era=cosplay_era),
        row("korean clothes", cloth, "韓式服裝", layer=g, era=modern),
        row("german clothes", cloth, "德式服裝", layer=g, era=vic),
        row("vietnamese clothes", cloth, "越南服裝", layer=g, era=modern),
        row("roman clothes", cloth, "古羅馬服裝", mutex="onepiece", layer=g, era=greece),
        row("mexican clothes", cloth, "墨西哥服裝", mutex="onepiece", layer=g, era=modern),
        row("russian clothes", cloth, "俄式服裝", mutex="onepiece", layer=g, era=vic),
        row("flamenco dress", cloth, "佛朗明哥裙", mutex="onepiece", layer=g, gate="female", era=modern, needs=girl),
        row("sari", cloth, "莎麗", mutex="onepiece", layer=g, gate="female", era=modern, needs=girl),
        row("hawaiian clothes", cloth, "夏威夷服裝", mutex="onepiece", layer=g, era=modern),
        row("tabi", cloth, "足袋", mutex="feet", layer=g, era=edo),
        row("okobo", cloth, "女用木屐", mutex="feet", layer=g, gate="female", era=edo, implies=["geta"], needs=girl),
        row("cornrows", feat, "玉米辮", mutex="hair_style"),
        row("facial mark", feat, "臉部標記"),
        row("forehead mark", feat, "額頭印記", implies=["facial mark"]),
        row("american flag", env, "美國國旗", era=modern),
        row("rice bowl", env, "飯碗", era=china_m + ["edo"]),
        row("japanese flag", env, "日本國旗", era=edo_m),
        row("brazilian flag", env, "巴西國旗", era=modern),
        row("german flag", env, "德國國旗", era=modern),
        row("tribal tattoo", feat, "部落刺青", implies=["tattoo"]),
        row("french flag", env, "法國國旗", era=modern),
        row("russian flag", env, "俄國國旗", era=modern),
        row("subway", env, "地鐵", mutex="place", era=modern, implies=["indoors"]),
        row("native american clothes", cloth, "美洲原住民服裝", mutex="onepiece", layer=g, era=modern),
        row("gondola", env, "貢多拉", era=vic),
        row("mexican flag", env, "墨西哥國旗", era=modern),
        row("rickshaw", env, "人力車", era=edo_m),
        row("poncho", cloth, "墨西哥披肩", mutex="outer", layer=g, era=modern),
        # ---- 節日跟氣候不是場地。向日葵田、稀樹草原不帶出只有古代的田野。
        row("halloween", env, "萬聖節", era=modern),
        row("new year", env, "新年", era=modern),
        row("desert", env, "沙漠", mutex="place", implies=["outdoors"]),
        row("skyline", env, "天際線", mutex="place", era=modern, implies=["outdoors"]),
        row("sunflower field", env, "向日葵田", mutex="place", implies=["outdoors", "sunflower"]),
        row("summer festival", env, "夏日祭典", era=edo_m),
        row("easter", env, "復活節", era=modern),
        row("european architecture", env, "歐式建築", era=arch_era),
        row("canal", env, "運河", mutex="place", era=vic, implies=["outdoors"]),
        row("tropical", env, "熱帶"),
        row("lantern festival", env, "元宵節", era=china_m),
        row("eiffel tower", env, "艾菲爾鐵塔", mutex="place", era=modern, implies=["outdoors"]),
        row("sphinx", env, "獅身人面", mutex="place", implies=["outdoors"]),
        row("savannah", env, "稀樹草原", mutex="place", implies=["outdoors"]),
        row("mid-autumn festival", env, "中秋節", era=china_m),
        row("oktoberfest", env, "啤酒節", era=modern),
        row("colosseum", env, "競技場", mutex="place", era=["modern", "ancient_greece"], implies=["outdoors"]),
        row("statue of liberty", env, "自由女神", mutex="place", era=modern, implies=["outdoors"]),
        row("igloo", env, "冰屋", mutex="place", implies=["outdoors", "snow"]),
        row("oasis", env, "綠洲", mutex="place", implies=["outdoors", "desert"]),
        row("black skin", feat, "黑膚", implies=["dark skin"]),
        # patterned clothing 在 2026-08 被停用，別名 patterned_clothes 沒過，
        # patterned 同一天也停了。沒有可以一對一換的字。
        # 花紋已經有碎花、圓點、格紋、條紋，傘標拿掉。
        row("ink wash painting", qual, "水墨畫", mutex="coloring"),
        # ---- 姿勢。單手跟雙手不佔同一格。背對走遠就是走路的一種。
        row("flying", pose, "飛行", mutex="activity"),
        row("adjusting eyewear", pose, "調整眼鏡"),
        row("praying", pose, "祈禱", mutex="activity"),
        row("adjusting gloves", pose, "調整手套"),
        row("spinning", pose, "旋轉"),
        row("walking away", pose, "背對走遠", mutex="body_pose", implies=["walking"]),
        row("horizon", env, "地平線"),
        row("landscape", env, "地景"),
        row("colorful background", env, "色彩繽紛背景", mutex="background"),
        row("arm up", pose, "單手上舉"),
        row("arm support", pose, "手臂撐著"),
        row("hand on own face", pose, "手摸自己臉"),
        row("hand in own hair", pose, "手插自己頭髮"),
        row("arms at sides", pose, "雙手垂在身側"),
        row("hands in pockets", pose, "雙手插口袋"),
        row("back-to-back", pose, "背靠背", needs=pair),
        row("hand on own thigh", pose, "單手摸大腿"),
        row("hand on own knee", pose, "手放膝蓋"),
        row("leaning to the side", pose, "向旁傾"),
        row("leaning on object", pose, "靠在物體上"),
        row("sitting on stairs", pose, "坐在階梯上", mutex="body_pose", implies=["sitting"]),
        row("hand on own neck", pose, "手摸自己脖子"),
        row("sitting on object", pose, "坐在物體上", mutex="body_pose", implies=["sitting"]),
        row("balancing", pose, "保持平衡"),
        row("handstand", pose, "倒立", mutex="body_pose"),
        row("holding own wrist", pose, "握住自己手腕"),
        row("androgynous", feat, "中性長相"),
        row("old woman", feat, "老婦人", gate="female", needs=girl),
        row("trap", feat, "男扮女相", gate="male", needs=boy),
        row("isometric", pose, "等角視圖", mutex="camera"),
        row("6+girls", "subject", "6人以上女性", mutex="female_count", gate="female"),
        row("4boys", "subject", "4個男性", mutex="male_count", gate="male"),
        row("6+boys", "subject", "6人以上男性", mutex="male_count", gate="male"),
        row("siblings", feat, "兄弟姊妹", needs=pair),
        row("sisters", feat, "姊妹", needs=two_f),
        row("yaoi", feat, "男同性戀題材", gate="male", needs=yaoi_needs),
        row("couple", feat, "情侶", needs=pair),
        row("age difference", feat, "年齡差", needs=pair),
        row("twins", feat, "雙胞胎", needs=pair),
        row("mother and daughter", feat, "母女", needs=two_f),
        row("brothers", feat, "兄弟", gate="male", needs=two_m),
        row("husband and wife", feat, "夫妻", needs=hetero),
        row("father and daughter", feat, "父女", needs=hetero),
        row("family", feat, "家人", needs=group),
        row("mother and son", feat, "母子", needs=hetero),
        row("group picture", feat, "團體照", needs=group),
        row("paw pose", pose, "貓爪手勢"),
        row("shushing", pose, "食指噓聲", implies=["finger to mouth"]),
        row("bored", pose, "無聊", mutex="expression"),
        row("confident", pose, "自信", mutex="expression"),
        row("facing viewer", pose, "面向觀眾"),
        row("tomboy", feat, "假小子", gate="female", needs=girl),
        row("planet", env, "行星", mutex="place", era=modern, implies=["space"]),
        row("lake", env, "湖", mutex="place", implies=["outdoors"]),
        row("earth (planet)", env, "地球", mutex="place", era=modern, implies=["planet", "space"]),
        row("lava", env, "熔岩", mutex="place", implies=["outdoors"]),
        row("island", env, "島", mutex="place", implies=["outdoors"]),
        row("carousel", env, "旋轉木馬", mutex="place", era=modern, implies=["outdoors"]),
        row("abandoned", env, "廢棄"),
        row("dock", env, "船塢", mutex="place", implies=["outdoors"]),
        row("volcano", env, "火山", mutex="place", implies=["outdoors"]),
        row("asteroid", env, "小行星", mutex="place", era=modern, implies=["space"]),
        row("scar on face", feat, "臉上疤痕", implies=["scar"]),
        row("mole on cheek", feat, "臉頰痣", implies=["mole"]),
        row("cloudy sky", env, "多雲天空"),
        row("starry sky background", env, "星空背景", implies=["starry sky"]),
        row("comic", qual, "漫畫分格"),
        row("painterly", qual, "油畫感", mutex="coloring"),
        row("cyberpunk", qual, "賽博龐克", era=modern),
        row("steampunk", qual, "蒸汽龐克", era=vic),
        row("art nouveau", qual, "新藝術風格", era=vic),
        row("neon palette", qual, "霓虹色調", era=modern),
    ]


def extra_csv_round5() -> list[dict]:
    """地點與第五輪缺字。不開新互斥格，也不另開永遠補的格。

    房間、店、地標、船和車站佔場地格。樓梯、圍欄、月亮、道路、科幻是疊加，
    不跟街道搶唯一的場地。食物和武器不佔手持格，也不帶出吃或喝。
    持劍才把劍和持武器帶出來。親子同格要直接寫上，中間那層不會代傳。
    太空船內部不寫室內：太空和室內外互斥，寫了兩邊會一起被拒。
    """
    modern = ["modern"]
    vic = ["modern", "victorian"]
    edo_m = ["edo", "modern"]
    pirate = ["modern", "victorian", "medieval"]
    throne_era = ["victorian", "medieval", "ancient_china"]
    cloth = "clothing"
    feat = "feature"
    pose = "pose"
    env = "env"
    g = "garment"
    acc = "accessory"
    pair = ["pair"]
    girl = ["female"]

    def row(tag, section, zh, mutex=None, heat=None, gate="any", layer="normal",
            implies=None, needs=None, era=None, bind=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heat or HEATS),
            "mutex": mutex,
            "bind": bind or [],
            "implies": implies or [],
            "layer": layer,
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    return [
        # 室內場地。衣櫥、凌亂房間是一間房，不是傢俱。
        row("messy room", env, "凌亂房間", mutex="place", era=modern, implies=["indoors"]),
        row("infirmary", env, "保健室", mutex="place", era=modern, implies=["indoors"]),
        row("public restroom", env, "公共廁所", mutex="place", era=modern, implies=["indoors"]),
        row("vehicle interior", env, "載具內部", mutex="place", era=modern, implies=["indoors"]),
        row("closet", env, "衣櫥", mutex="place", era=modern, implies=["indoors"]),
        row("spacecraft interior", env, "太空船內部", mutex="place", era=modern, implies=["spacecraft", "space"]),
        row("washitsu", env, "和室", mutex="place", era=edo_m, implies=["indoors"]),
        row("otaku room", env, "宅宅房間", mutex="place", era=modern, implies=["indoors"]),
        row("clubroom", env, "社團教室", mutex="place", era=modern, implies=["indoors"]),
        row("garage", env, "車庫", mutex="place", era=modern, implies=["indoors"]),
        row("dressing room", env, "後台化妝室", mutex="place", era=modern, implies=["indoors"]),
        row("genkan", env, "玄關", mutex="place", era=edo_m, implies=["indoors"]),
        row("dining room", env, "家中飯廳", mutex="place", era=modern, implies=["indoors"]),
        row("warehouse", env, "倉庫", mutex="place", era=modern, implies=["indoors"]),
        row("backstage", env, "後台", mutex="place", era=modern, implies=["indoors"]),
        row("cafeteria", env, "學生餐廳", mutex="place", era=modern, implies=["indoors"]),
        row("throne room", env, "王座廳", mutex="place", era=throne_era, implies=["indoors", "throne"]),
        row("concert", env, "演唱會", mutex="place", era=modern, implies=["indoors", "stage"]),
        row("theater", env, "劇院", mutex="place", era=modern, implies=["indoors"]),
        row("museum", env, "博物館", mutex="place", era=modern, implies=["indoors"]),
        row("planetarium", env, "天象儀館", mutex="place", era=modern, implies=["indoors"]),
        row("shop", env, "商店", mutex="place", era=modern, implies=["indoors"]),
        row("bakery", env, "麵包店", mutex="place", era=modern, implies=["indoors", "shop"]),
        row("laundromat", env, "自助洗衣店", mutex="place", era=modern, implies=["indoors"]),
        row("maid cafe", env, "女僕咖啡廳", mutex="place", era=modern, implies=["indoors", "cafe"]),
        row("clothes shop", env, "服飾店", mutex="place", era=modern, implies=["indoors", "shop"]),
        row("flower shop", env, "花店", mutex="place", era=modern, implies=["indoors", "shop"]),
        row("bookstore", env, "書店", mutex="place", era=modern, implies=["indoors", "shop"]),
        row("conveyor belt sushi", env, "迴轉壽司", mutex="place", era=modern, implies=["indoors"]),
        row("skating rink", env, "溜冰場", mutex="place", era=modern, implies=["indoors"]),
        row("sewer", env, "下水道", mutex="place", era=modern, implies=["indoors"]),
        # 室外場地、交通工具、地標。行人天橋不帶出古代的橋。屋台不帶出市集。
        row("water slide", env, "滑水道", mutex="place", era=modern, implies=["outdoors", "pool"]),
        row("roller coaster", env, "雲霄飛車", mutex="place", era=modern, implies=["outdoors", "amusement park"]),
        row("empty pool", env, "空泳池", mutex="place", era=modern, implies=["outdoors", "pool"]),
        row("yatai", env, "屋台", mutex="place", era=edo_m, implies=["outdoors"]),
        row("gas station", env, "加油站", mutex="place", era=modern, implies=["outdoors"]),
        row("porch", env, "門廊", mutex="place", era=vic, implies=["outdoors"]),
        row("railroad tracks", env, "鐵軌", mutex="place", era=modern, implies=["outdoors"]),
        row("railroad crossing", env, "平交道", mutex="place", era=modern, implies=["outdoors", "railroad tracks"]),
        row("tunnel", env, "隧道", mutex="place"),
        row("industrial", env, "工業區", mutex="place", era=modern, implies=["outdoors"]),
        row("gazebo", env, "涼亭", mutex="place", era=vic, implies=["outdoors"]),
        row("pedestrian bridge", env, "行人天橋", mutex="place", era=modern, implies=["outdoors"]),
        row("clock tower", env, "鐘樓", mutex="place", era=vic, implies=["outdoors"]),
        row("lighthouse", env, "燈塔", mutex="place", era=vic, implies=["outdoors"]),
        row("treehouse", env, "樹屋", mutex="place", era=modern, implies=["outdoors"]),
        row("shore", env, "海岸", mutex="place", implies=["outdoors"]),
        row("hill", env, "山丘", mutex="place", implies=["outdoors"]),
        row("stream", env, "小溪", mutex="place", implies=["outdoors"]),
        row("floating island", env, "浮空島", mutex="place", implies=["outdoors", "island"]),
        row("riverbank", env, "河岸", mutex="place", implies=["outdoors"]),
        row("wetland", env, "濕地", mutex="place", implies=["outdoors"]),
        row("coral reef", env, "珊瑚礁", mutex="place", implies=["underwater"]),
        row("canyon", env, "峽谷", mutex="place", implies=["outdoors"]),
        row("valley", env, "山谷", mutex="place", implies=["outdoors"]),
        row("seafloor", env, "海底", mutex="place", implies=["underwater"]),
        row("glacier", env, "冰河", mutex="place", implies=["outdoors"]),
        row("sand dune", env, "沙丘", mutex="place", implies=["outdoors"]),
        row("boat", env, "小船", mutex="place", implies=["outdoors"]),
        row("ship", env, "船", mutex="place", implies=["outdoors"]),
        row("spacecraft", env, "太空船", mutex="place", era=modern, implies=["space"]),
        row("bus", env, "公車", mutex="place", era=modern, implies=["outdoors"]),
        row("airship", env, "飛行船", mutex="place", era=vic, implies=["outdoors"]),
        row("train station platform", env, "車站月台", mutex="place", era=modern, implies=["outdoors", "train station"]),
        row("steam locomotive", env, "蒸汽火車", mutex="place", era=vic, implies=["outdoors"]),
        row("rowboat", env, "划艇", mutex="place", implies=["outdoors", "boat"]),
        row("submarine", env, "潛水艇", mutex="place", era=modern, implies=["underwater"]),
        row("pirate ship", env, "海盜船", mutex="place", era=pirate, implies=["outdoors", "ship"]),
        row("streetcar", env, "路面電車", mutex="place", era=vic, implies=["outdoors"]),
        row("shipwreck", env, "沉船", mutex="place", implies=["outdoors", "ship"]),
        row("subway station", env, "地鐵站", mutex="place", era=modern, implies=["indoors", "subway"]),
        row("hell", env, "地獄", mutex="place"),
        row("floating city", env, "浮空城市", mutex="place", implies=["outdoors"]),
        row("heaven", env, "天堂", mutex="place"),
        row("underwater city", env, "海底城市", mutex="place", implies=["underwater"]),
        row("tokyo", env, "東京", mutex="place", era=modern, implies=["outdoors", "city"]),
        row("mount fuji", env, "富士山", mutex="place", era=edo_m, implies=["outdoors", "mountain"]),
        row("pyramid (structure)", env, "金字塔", mutex="place", implies=["outdoors"]),
        row("tokyo tower", env, "東京鐵塔", mutex="place", era=modern, implies=["outdoors", "tokyo"]),
        row("shibuya (tokyo)", env, "澀谷", mutex="place", era=modern, implies=["outdoors", "tokyo"]),
        row("kyoto (city)", env, "京都", mutex="place", era=edo_m, implies=["outdoors"]),
        row("elizabeth tower", env, "大笨鐘", mutex="place", era=vic, implies=["outdoors"]),
        row("new york city", env, "紐約", mutex="place", era=modern, implies=["outdoors", "city"]),
        row("tokyo skytree", env, "東京晴空塔", mutex="place", era=modern, implies=["outdoors", "tokyo"]),
        row("taipei 101", env, "台北101", mutex="place", era=modern, implies=["outdoors"]),
        # 不是場地。跟已經抽到的街道、房間疊在一起。
        row("bookshelf", env, "書架"),
        row("kotatsu", env, "暖桌", era=edo_m),
        row("spiral staircase", env, "螺旋樓梯", implies=["stairs"]),
        row("crane game", env, "夾娃娃機", era=modern),
        row("arcade cabinet", env, "大型電玩機台", era=modern),
        row("purikura", env, "拍貼機", era=modern),
        row("road", env, "道路"),
        row("path", env, "小徑"),
        row("town", env, "城鎮"),
        row("crosswalk", env, "斑馬線", era=modern),
        row("sidewalk", env, "人行道", era=modern),
        row("urban", env, "都市感", era=modern),
        row("dirt road", env, "泥土路", implies=["road"]),
        row("hedge", env, "樹籬"),
        row("fence", env, "圍欄"),
        row("brick wall", env, "磚牆"),
        row("power lines", env, "電線", era=modern),
        row("utility pole", env, "電線桿", era=modern),
        row("chain-link fence", env, "鐵絲網圍欄", era=modern, implies=["fence"]),
        row("graffiti", env, "塗鴉", era=modern),
        row("vending machine", env, "自動販賣機", era=modern),
        row("traffic light", env, "紅綠燈", era=modern),
        row("billboard", env, "廣告看板", era=modern),
        row("phone booth", env, "電話亭", era=modern),
        row("building", env, "建築物"),
        row("stairs", env, "樓梯"),
        row("architecture", env, "建築"),
        row("stone stairs", env, "石階", implies=["stairs"]),
        row("komainu", env, "狛犬", era=edo_m, implies=["shrine"]),
        row("jizou", env, "地藏", era=edo_m),
        row("rock", env, "岩石"),
        row("palm tree", env, "棕櫚樹"),
        row("mountainous horizon", env, "山巒地平線"),
        row("puddle", env, "水窪"),
        row("overgrown", env, "雜草叢生"),
        row("stalactite", env, "鐘乳石"),
        row("moon", env, "月亮"),
        row("milky way", env, "銀河", implies=["starry sky"]),
        row("science fiction", env, "科幻", era=modern),
        row("post-apocalypse", env, "末日廢土", era=modern),
        # 手。雙手合十可以是自己的手，不要求兩人。手搭在對方身上才要。
        row("holding weapon", pose, "持武器"),
        row("holding sword", pose, "持劍", implies=["sword", "holding weapon"]),
        row("holding gun", pose, "持槍", era=modern, implies=["gun", "holding weapon"]),
        row("holding knife", pose, "持刀", implies=["knife", "holding weapon"]),
        row("holding staff", pose, "持杖", implies=["staff", "holding weapon"]),
        row("pointing", pose, "指向"),
        row("index finger raised", pose, "豎食指"),
        row("reaching", pose, "伸手"),
        row("waving", pose, "揮手"),
        row("punching", pose, "出拳"),
        row("hand on another's shoulder", pose, "手搭對方肩", needs=pair),
        row("hand on another's face", pose, "手撫對方臉", needs=pair),
        row("hand on another's cheek", pose, "手撫對方頰", needs=pair),
        row("feeding", pose, "餵食", needs=pair),
        row("between fingers", pose, "指縫之間"),
        row("own hands together", pose, "雙手合十"),
        row("interlocked fingers", pose, "十指交扣"),
        row("dual wielding", pose, "雙持", implies=["holding weapon"]),
        row("aiming", pose, "瞄準"),
        row("tying hair", pose, "綁頭髮"),
        row("licking", pose, "舔"),
        row("kicking", pose, "踢", mutex="body_pose"),
        row("falling", pose, "跌倒", mutex="body_pose"),
        row("playing instrument", pose, "演奏樂器", mutex="activity"),
        row("wide-eyed", pose, "睜大眼", mutex="expression"),
        row("laughing", pose, "大笑", mutex="expression"),
        row("yawning", pose, "打哈欠", mutex="expression"),
        row("raised eyebrow", pose, "挑眉", mutex="expression"),
        row("letterboxed", pose, "上下黑邊"),
        row("perspective", pose, "透視"),
        row("symmetry", pose, "對稱構圖"),
        # 臉和身體。緊張冒汗要能跟「緊張」疊，不佔表情格。眯眼也不佔。
        row("blush stickers", feat, "腮紅貼"),
        row("veins", feat, "血管"),
        row("arm tattoo", feat, "手臂刺青", implies=["tattoo"]),
        row("leg tattoo", feat, "腿部刺青", implies=["tattoo"]),
        row("neck tattoo", feat, "頸部刺青", implies=["tattoo"]),
        row("scar on cheek", feat, "頰疤", implies=["scar"]),
        row("nervous sweating", feat, "緊張冒汗", implies=["sweat"]),
        row("nosebleed", feat, "流鼻血"),
        row("eyes visible through hair", feat, "髮間露眼"),
        row("colored eyelashes", feat, "彩色睫毛", implies=["eyelashes"]),
        row("star-shaped pupils", feat, "星形瞳"),
        row("narrowed eyes", feat, "眯眼"),
        row("biceps", feat, "二頭肌"),
        row("ribs", feat, "肋骨"),
        row("shoulder blades", feat, "肩胛骨"),
        # 衣服。皇冠不帶出帽子。腳鍊佔飾品格，不佔鞋子。拉鍊不帶出拉開。
        row("buttons", cloth, "鈕扣", layer=g),
        row("animal print", cloth, "動物紋", layer=g, era=modern),
        row("polka dot", cloth, "圓點", layer=g, era=vic),
        row("pocket", cloth, "口袋", layer=g),
        row("zipper", cloth, "拉鍊", layer=g, era=modern),
        row("breast pocket", cloth, "胸袋", layer=g, implies=["pocket"]),
        row("cow print", cloth, "乳牛紋", layer=g, era=modern),
        row("bandages", cloth, "繃帶", layer=acc),
        row("crown", cloth, "皇冠", mutex="headwear", layer=acc),
        row("brooch", cloth, "胸針", mutex="jewelry", layer=acc),
        row("anklet", cloth, "腳鍊", mutex="jewelry", layer=acc),
        row("pendant", cloth, "墜飾", mutex="jewelry", layer=acc, implies=["necklace"]),
        row("gem", cloth, "寶石", layer=acc),
        row("buckle", cloth, "帶扣", layer=acc),
        row("belt buckle", cloth, "皮帶扣", layer=acc, implies=["belt"]),
        row("name tag", cloth, "名牌", layer=acc, era=modern),
        row("lace-up boots", cloth, "綁帶靴", mutex="feet", layer=g, era=modern, implies=["boots"]),
        row("suspender skirt", cloth, "吊帶裙", mutex="bottom", layer=g, gate="female", needs=girl, era=modern, implies=["skirt", "suspenders"]),
        row("shoulder bag", cloth, "肩背包", layer=acc, implies=["bag"]),
        row("pouch", cloth, "小袋", layer=acc, implies=["bag"]),
        row("suitcase", cloth, "行李箱", layer=acc, era=modern),
        # 武器和食物是場景裡的東西。吃和喝另算，這裡不帶出來。
        row("sword", env, "劍"),
        row("katana", env, "日本刀", era=edo_m, implies=["sword"]),
        row("knife", env, "刀"),
        row("staff", env, "杖"),
        row("gun", env, "槍", era=modern),
        row("rifle", env, "步槍", era=modern, implies=["gun"]),
        row("handgun", env, "手槍", era=modern, implies=["gun"]),
        row("cup", env, "杯子"),
        row("mug", env, "馬克杯"),
        row("bottle", env, "瓶子"),
        row("bell", env, "鈴鐺"),
        row("candy", env, "糖果", era=modern),
        row("cake", env, "蛋糕", era=modern),
        row("lollipop", env, "棒棒糖", era=modern),
        row("popsicle", env, "冰棒", era=modern),
        row("strawberry", env, "草莓", era=modern),
        row("ice cream", env, "冰淇淋", era=modern),
        row("chocolate", env, "巧克力", era=modern),
        row("apple", env, "蘋果", era=modern),
        row("bread", env, "麵包", era=modern),
        row("donut", env, "甜甜圈", era=modern),
        row("cookie", env, "餅乾", era=modern),
        row("coffee", env, "咖啡", era=modern),
        row("beer", env, "啤酒", era=vic),
        row("onigiri", env, "飯糰", era=edo_m),
        row("bubble tea", env, "珍珠奶茶", era=modern),
        row("balloon", env, "氣球"),
        row("basket", env, "籃子"),
        row("key", env, "鑰匙"),
        row("playing card", env, "撲克牌"),
        row("scissors", env, "剪刀"),
        row("surfboard", env, "衝浪板", era=modern),
        row("skateboard", env, "滑板", era=modern),
        row("dumbbell", env, "啞鈴", era=modern),
        row("blanket", env, "毯子"),
        # 效果佔同一個效果格，只有直接的親子（閃電和電光）可以疊。
        row("glowing", env, "發光", mutex="effect"),
        row("electricity", env, "電光", mutex="effect"),
        row("lightning", env, "閃電", mutex="effect", implies=["electricity"]),
        row("aura", env, "氣場", mutex="effect"),
        row("snowflakes", env, "雪花", mutex="effect", implies=["snow"]),
        row("ripples", env, "波紋", mutex="effect"),
        row("rainbow", env, "彩虹", mutex="effect"),
        row("magic circle", env, "魔法陣", mutex="effect"),
        row("sparks", env, "火花", mutex="effect"),
        row("embers", env, "餘燼", mutex="effect"),
        row("blue fire", env, "藍火", mutex="effect"),
        row("glitch", env, "故障藝術", mutex="effect", era=modern),
        row("shooting star", env, "流星", mutex="effect", implies=["starry sky"]),
        row("glowstick", env, "螢光棒", mutex="effect", era=modern),
        row("diffraction spikes", env, "星芒", mutex="effect"),
        row("caustics", env, "水面光斑", mutex="effect"),
        row("floating clothes", env, "衣袂飄揚", mutex="effect"),
        row("anger vein", env, "怒筋", mutex="effect"),
        row("clear sky", env, "晴空", implies=["blue sky"]),
        row("underlighting", env, "底光", mutex="lighting"),
    ]



def extra_csv_round6() -> list[dict]:
    """danbooru_worth_adding.csv（2026-10-06，Opus）。119 個，全部向 Danbooru 核過現役。

    原則：
    - 零件跟種族用 kind（見 KIND）：貓耳只配貓娘，兔尾不配狐尾。同種可以疊。
    - 獸耳只會有一種（animal_ear 格），父標籤 animal ears 跟著出現；尾巴、角、翅膀同理帶出父標籤。
    - 袖長、瀏海、指甲顏色、翅膀種類、兜帽狀態各自一格（mutexExtra，見 MUTEX_EXTRA_PATCH）。
    - 基底字（蝴蝶結、緞帶、花）照 Danbooru 當父標籤：髮上蝴蝶結帶出蝴蝶結，既有的髮帶、領口緞帶帶出緞帶。
    - 手上拿東西佔手勢那一格（hand_g，engine.js 的 HAND_GESTURE），並帶出那樣東西；
      嘴叼物算嘴裡的一樣東西（GAG_KIND），跟口塞、口交、接吻不並存。
    - 內褲走光只在走光以上，帶出內褲；風掀起衣服帶出風。
    - 時代跟著被帶出的字走（拿扇子跟團扇一樣只在古中國、江戶），不然整筆會被拒。
    """
    all_h = list(HEATS)
    hot = ["tease", "flash", "sex"]
    flash = ["flash", "sex"]
    modern = ["modern"]
    medieval = ["medieval"]
    fantasy = ["medieval", "modern"]
    cloth = "clothing"
    feat = "feature"
    pose = "pose"
    env = "env"
    g = "garment"
    acc = "accessory"
    girl = ["female"]
    solid = ["place", "in_out", "day_night", "bg_blur"]

    def row(tag, section, zh, mutex=None, heat=None, gate="any", layer="normal",
            implies=None, needs=None, era=None, bind=None, extra=None):
        out = {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": bind or [],
            "implies": implies or [],
            "layer": layer,
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }
        if extra:
            out["mutexExtra"] = list(extra)
        return out

    return [
        # ---- 髮型。上紮、單側上紮、髮環是主髮型（佔 hair_style 格）；短雙馬尾、側辮、雙鑽捲是既有髮型的細分，
        # 帶出父髮型（父子不互斥）。兩種新瀏海跟既有瀏海同一格。刺刺髮是髮質，跟直、捲、波浪同一格。
        row("two side up", feat, "雙側上紮", mutex="hair_style"),
        row("one side up", feat, "單側上紮", mutex="hair_style"),
        row("double-parted bangs", feat, "中分瀏海", extra=["bangs"]),
        row("crossed bangs", feat, "交叉瀏海", extra=["bangs"]),
        row("spiked hair", feat, "刺刺髮", extra=["hair_texture"]),
        row("short twintails", feat, "短雙馬尾", mutex="hair_style", implies=["twintails"]),
        row("side braid", feat, "側辮", mutex="hair_style", implies=["braid"]),
        row("twin drills", feat, "雙鑽捲髮", mutex="hair_style", implies=["drill hair"]),
        row("hair rings", feat, "髮環", mutex="hair_style"),
        row("hair behind ear", feat, "頭髮別到耳後"),
        # ---- 眼睛。黑眼睛補進瞳色格。亮瞳、白瞳孔是瞳孔的明暗，只會有一種。
        row("black eyes", feat, "黑眼睛", mutex="eye_color"),
        row("bright pupils", feat, "亮瞳", extra=["pupil_tone"]),
        row("white pupils", feat, "白瞳孔", extra=["pupil_tone"]),
        row("multicolored eyes", feat, "多色瞳"),
        row("one eye covered", feat, "遮住一眼"),
        row("v-shaped eyebrows", feat, "八字眉"),
        # ---- 臉。只露上排牙、波浪嘴、陰影臉是表情的附帶，不佔表情格。淡紅暈是臉紅的一種，帶出臉紅。
        row("upper teeth only", pose, "只露上排牙", implies=["teeth"]),
        row("wavy mouth", pose, "波浪嘴"),
        row("shaded face", pose, "陰影臉"),
        row("flying sweatdrops", feat, "飛散汗滴"),
        row("light blush", feat, "淡紅暈", implies=["blush"]),
        row("skin fang", feat, "微露尖牙", implies=["fang"]),
        # ---- 指甲。黑、藍跟既有紅、粉同一格，都帶出指甲油。
        row("fingernails", feat, "指甲"),
        # 指甲油限女性，帶出它的字也要限女性，不然男生抽到會整筆被拒。
        row("black nails", feat, "黑指甲", gate="female", implies=["nail polish"], extra=["nail_color"], needs=girl),
        row("blue nails", feat, "藍指甲", gate="female", implies=["nail polish"], extra=["nail_color"], needs=girl),
        # ---- 身體。腹部跟肚臍、腰腹一樣是身體部位。有色皮膚（藍、綠皮膚）跟白皙、深膚色同一格。
        row("stomach", feat, "腹部"),
        row("colored skin", feat, "有色皮膚", extra=["skin_tone"]),
        # ---- 手臂。舉手、雙臂伸展、手枕腦後進手臂那一格（engine.js 的 ARM_POSE／BOTH_ARMS）。
        row("hand up", pose, "單手舉起"),
        row("hands up", pose, "雙手舉起"),
        row("outstretched arms", pose, "雙臂伸展"),
        row("arm behind head", pose, "手枕腦後"),
        row("clenched hand", pose, "握拳"),
        row("mouth hold", pose, "嘴叼物"),
        # ---- 露出的手腳。不是裸體（不進 nude 那一層）。裸腿佔腿襪格；裸臂跟長袖、過肘手套不並存。
        row("bare arms", cloth, "裸臂", extra=["bare_long", "bare_elbow", "bare_det"]),
        row("bare legs", cloth, "裸腿", mutex="legs"),
        # ---- 種族零件。獸耳只會有一種，帶出 animal ears；尾巴、角、翅膀帶出父標籤。種類見 KIND。
        row("cat ears", feat, "貓耳", mutex="animal_ear", implies=["animal ears"]),
        row("rabbit ears", feat, "兔耳", mutex="animal_ear", implies=["animal ears"]),
        row("horse ears", feat, "馬耳", mutex="animal_ear", implies=["animal ears"]),
        row("fox ears", feat, "狐耳", mutex="animal_ear", implies=["animal ears"]),
        row("wolf ears", feat, "狼耳", mutex="animal_ear", implies=["animal ears"]),
        row("dog ears", feat, "狗耳", mutex="animal_ear", implies=["animal ears"]),
        row("animal ear fluff", feat, "獸耳絨毛", implies=["animal ears"]),
        row("cat tail", feat, "貓尾", implies=["tail"]),
        row("fox tail", feat, "狐尾", implies=["tail"]),
        row("horse tail", feat, "馬尾（尾巴）", implies=["tail"]),
        row("demon tail", feat, "惡魔尾", implies=["tail"]),
        row("rabbit tail", feat, "兔尾", implies=["tail"]),
        row("multiple tails", feat, "多尾", implies=["tail"]),
        row("feathered wings", feat, "羽毛翅膀", implies=["wings"], extra=["wing_type"]),
        row("bat wings", feat, "蝙蝠翅膀", implies=["wings"], extra=["wing_type"]),
        row("fairy wings", feat, "妖精翅膀", implies=["wings"], extra=["wing_type"]),
        row("head wings", feat, "頭翅膀"),
        row("dragon horns", feat, "龍角", implies=["horns"]),
        row("claws", feat, "爪"),
        row("mechanical arms", feat, "機械臂", era=fantasy),
        # 完整種族佔種族格；正常模式不自動抽（engine.js 擋 group=race）。馬娘就是馬耳加馬尾。
        row("horse girl", feat, "馬娘", mutex="race", gate="female",
            implies=["horse ears", "horse tail"], needs=girl),
        row("fairy", feat, "妖精", mutex="race"),
        row("cyborg", feat, "改造人", mutex="race", era=modern),
        # ---- 衣料。袖長一格（父子不互斥：泡泡短袖帶出泡泡袖和短袖）。花紋、滾邊疊在衣服上。
        row("sleeveless", cloth, "無袖", layer=g, extra=["sleeve_len"]),
        row("striped clothes", cloth, "條紋衣服", layer=g),
        row("clothing cutout", cloth, "衣物挖空", layer=g),
        row("puffy short sleeves", cloth, "泡泡短袖", layer=g,
            implies=["puffy sleeves", "short sleeves"], extra=["sleeve_len"]),
        row("puffy long sleeves", cloth, "泡泡長袖", layer=g,
            implies=["puffy sleeves", "long sleeves"], extra=["sleeve_len", "bare_long"]),
        row("sleeves past wrists", cloth, "袖過手腕", layer=g,
            implies=["long sleeves"], extra=["sleeve_len", "bare_long"]),
        row("juliet sleeves", cloth, "朱麗葉袖", layer=g, era=["victorian", "medieval", "modern"],
            implies=["long sleeves", "puffy sleeves"], extra=["sleeve_len", "bare_long"]),
        row("strapless", cloth, "無肩帶", layer=g, extra=["strap"]),
        row("plaid clothes", cloth, "格紋衣服", layer=g, era=modern),
        row("floral print", cloth, "碎花圖案", layer=g),
        # 荷葉邊類不帶出 frills：詞庫的 frills 只標維多利亞，帶出它會把現代的荷葉邊袖、裙、領一起收窄掉。
        row("frilled sleeves", cloth, "荷葉邊袖", layer=g),
        row("ribbon trim", cloth, "緞帶滾邊", layer=g),
        row("lace trim", cloth, "蕾絲滾邊", layer=g),
        row("high collar", cloth, "高領", layer=g),
        row("layered sleeves", cloth, "層次袖", layer=g),
        row("formal clothes", cloth, "正裝", layer=g, era=["modern", "victorian"]),
        row("fur collar", cloth, "毛皮領", layer=g, implies=["fur trim"]),
        row("highleg", cloth, "高衩", layer=g, heat=hot),
        # ---- 衣服本體。字尾規則會再帶出 dress／skirt／jacket／thighhighs。
        row("frilled dress", cloth, "荷葉邊洋裝", mutex="onepiece", layer=g, gate="female",
            era=["modern", "victorian"], implies=["dress"], needs=girl),
        row("frilled skirt", cloth, "荷葉邊裙", mutex="bottom", layer=g, gate="female",
            era=["modern", "victorian"], implies=["skirt"], needs=girl),
        row("hooded jacket", cloth, "連帽外套", mutex="outer", layer=g, era=modern, implies=["jacket"]),
        row("robe", cloth, "長袍", mutex="outer", layer=g),
        row("hood down", cloth, "兜帽放下", layer=acc, extra=["hood_up", "hood_on"]),
        row("single thighhigh", cloth, "單邊過膝襪", mutex="legs", layer=g, gate="female",
            era=["modern", "victorian"], implies=["thighhighs"], needs=girl),
        row("high heel boots", cloth, "高跟靴", mutex="feet", layer=g, gate="female",
            era=["modern", "victorian"], implies=["boots", "high heels"], needs=girl),
        row("ankle boots", cloth, "短靴", mutex="feet", layer=g, implies=["boots"]),
        row("armored boots", cloth, "裝甲靴", mutex="feet", layer=g, era=medieval, implies=["boots"]),
        # ---- 飾品。蝴蝶結、緞帶是基底；髮飾類跟既有髮帶同一格（hair_acc），帽子類佔頭飾格。
        row("bow", cloth, "蝴蝶結", layer=acc),
        row("ribbon", cloth, "緞帶", layer=acc),
        row("hair bow", cloth, "髮上蝴蝶結", mutex="hair_acc", layer=acc, implies=["bow"]),
        row("hat bow", cloth, "帽上蝴蝶結", layer=acc, implies=["bow"]),
        row("hat ribbon", cloth, "帽上緞帶", layer=acc, implies=["ribbon"]),
        row("neckerchief", cloth, "頸巾", mutex="neckwear", layer=acc),
        row("headband", cloth, "頭帶", mutex="hair_acc", layer=acc),
        row("scrunchie", cloth, "大腸圈", layer=acc),
        row("hair bobbles", cloth, "髮球飾", mutex="hair_acc", layer=acc),
        row("tassel", cloth, "流蘇", layer=acc),
        row("wristband", cloth, "腕帶", layer=acc, era=modern),
        row("gauntlets", cloth, "臂鎧", mutex="hands", layer=acc, era=medieval),
        row("pauldrons", cloth, "肩鎧", layer=acc, era=medieval, implies=["shoulder armor"]),
        row("star hair ornament", cloth, "星星髮飾", mutex="headwear", layer=acc, gate="female",
            implies=["hair ornament"], needs=girl),
        row("feather hair ornament", cloth, "羽毛髮飾", mutex="headwear", layer=acc, gate="female",
            implies=["hair ornament"], needs=girl),
        row("hair bell", cloth, "頭髮鈴鐺", mutex="headwear", layer=acc, gate="female",
            implies=["hair ornament"], needs=girl),
        row("santa hat", cloth, "聖誕帽", mutex="headwear", layer=acc, era=modern),
        row("mask on head", cloth, "面具戴在頭上", mutex="headwear", layer=acc, implies=["mask"]),
        row("fox mask", cloth, "狐狸面具", mutex="headwear", layer=acc, era=["edo", "modern"], implies=["mask"]),
        row("frilled collar", cloth, "荷葉邊領", mutex="neckwear", layer=acc),
        # ---- 手上拿著。佔手勢格，帶出那樣東西；時代跟那樣東西走。
        row("holding cup", pose, "拿著杯子", implies=["cup"]),
        row("holding phone", pose, "拿著手機", era=modern, implies=["phone"]),
        row("holding umbrella", pose, "拿著傘", implies=["umbrella"]),
        row("holding fan", pose, "拿著扇子", era=["ancient_china", "edo"], implies=["hand fan"]),
        # ---- 走光。內褲走光帶出內褲，只在走光以上；風掀起衣服帶出風。
        row("pantyshot", pose, "內褲走光", heat=flash, gate="female", era=modern, implies=["panties"], needs=girl),
        row("wind lift", pose, "風掀起衣服", heat=flash, implies=["wind"]),
        # ---- 場景。綠、紫背景跟既有色背景一樣：素色背景、不跟場地／室內外／日夜並存。
        row("green background", env, "綠背景", mutex="background", implies=["simple background"], extra=solid),
        row("purple background", env, "紫背景", mutex="background", implies=["simple background"], extra=solid),
        row("star (symbol)", env, "星星符號", mutex="effect"),
        row("summer", env, "夏天", extra=["season"]),
        row("flower", env, "花"),
        row("leaf", env, "葉子"),
        row("feathers", env, "羽毛"),
        row("chain", env, "鎖鏈"),
    ]


def extra_breast_grab() -> list[dict]:
    """兩份胸部互動 CSV（2026-10-09）。118 個 in_lexicon=no，都向 Danbooru 核過現役。

    熱度、父子、人手跟任務單不完全一樣的地方記在討論區。這裡只留會讓字抽不到的幾條：
    - 單人對自己的嘴（自吸、舔自己乳頭）不帶出需要 pair 的父標籤。
    - 隔衣玩乳不帶出 nipple stimulation。那個父標籤是露點，隔衣不該把它寫進來。
    - 臉埋進胸不帶出 head between breasts。那個父標籤要男生，女女就整筆被拒。
    - 乳頭吸盤是器具，跟吸乳器一樣放衣服。CLOTHING_STATE 另有一行，不然熱度會被攤成三檔。
    - 雙手按胸口只靠 mutexExtra 佔既有的 both_arms、hand_g。引擎裡的手勢名單不能改。
    """
    heats = {
        "all": list(HEATS),
        "hot": ["tease", "flash", "sex"],
        "flash": ["flash", "sex"],
        "sex": ["sex"],
    }
    girl = ("female",)
    boy = ("male",)
    pair_f = ("female", "pair")
    pair_m = ("male", "pair")
    two_f = ("female", "2female")
    two_m = ("male", "2male")
    hetero = ("female", "male", "pair")
    grp = ("group",)
    grp_f = ("female", "group")
    grp_ff = ("female", "group", "2female")
    grp_ffm = ("female", "male", "group", "2female")
    hands = ("both_arms", "hand_g")

    def row(tag, section, zh, heat, gate="any", needs=(), implies=(), layer="normal", extra=()):
        out = {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heats[heat]),
            "mutex": None,
            "bind": [],
            "implies": list(implies),
            "layer": layer,
            "era": ["any"],
            "needs": list(needs),
            "zh": zh,
        }
        if extra:
            out["mutexExtra"] = list(extra)
        return out

    rows = [
        # ---- 自己的胸。特徵，不是兩人動作。
        row("presenting own breasts", "feature", "捧胸獻上", "hot", "female", girl),
        row("handsfree breast squeeze", "feature", "無手擠胸", "hot", "female", girl),
        row("poking own breast", "feature", "戳自己胸", "hot", "female", girl),
        row("sucking own breasts", "feature", "自吸乳房", "sex", "female", girl, layer="skin"),
        row("spread nipple", "feature", "撥開乳頭", "flash", "female", girl, layer="skin"),
        row("licking own nipple", "feature", "舔自己乳頭", "sex", "female", girl, layer="skin"),
        row("self milking", "feature", "自己擠奶", "flash", "female", girl, ("lactation",)),
        row("lactating into container", "feature", "擠進容器", "flash", "female", girl, ("lactation",)),
        row("excessive lactation", "feature", "大量泌乳", "flash", "female", girl, ("lactation",)),
        row("projectile lactation", "feature", "噴乳", "flash", "female", girl, ("lactation",)),
        row("grabbing own pectoral", "feature", "抓自己胸肌", "hot", "male", boy),
        row("pectoral squeeze", "feature", "擠胸肌", "hot", "male", boy),
        row("pectoral lift", "feature", "托起胸肌", "hot", "male", boy),
        row("pectoral press", "feature", "胸肌貼壓", "hot", "male", boy),
        # ---- 手放在胸口。跟「手按胸口」「雙手捧胸」同一格，佔住那兩隻手。
        row("hands on own chest", "pose", "按胸口", "all", extra=hands),
        row("groping motion", "pose", "揉胸手勢", "hot", extra=hands),
        row("hand on another's chest", "pose", "按對方胸", "hot", needs=("pair",)),
        row("hands on another's chest", "pose", "雙手按胸", "hot", needs=("pair",), extra=("both_arms",)),
        row("guiding hand", "pose", "拉手引導", "hot", needs=("pair",)),
        # ---- 隔著衣服、沒有露點。手伸進某件衣服跟「手伸進衣服裡」一樣，只在走光以上。
        row("hand under shirt", "pose", "手探上衣", "flash", implies=("shirt", "hand under clothes")),
        row("hand in bra", "pose", "手探胸罩", "flash", "female", girl, ("bra",)),
        row("hand in own bra", "pose", "手探自己胸罩", "flash", "female", girl, ("bra",)),
        row("hand in another's bra", "pose", "手探她胸罩", "flash", "female", pair_f, ("bra",)),
        row("hand in bikini", "pose", "手探泳裝", "flash", "female", girl),
        row("hand in another's shirt", "pose", "手探她衫", "flash", needs=("pair",)),
        row("hand in another's clothes", "pose", "手探她衣", "flash", needs=("pair",)),
        row("imminent grope", "pose", "快摸", "flash", needs=("pair",)),
        row("surrounded by hands", "pose", "被手包圍", "flash", needs=grp),
        row("nipple guessing game (meme)", "pose", "猜乳頭", "flash", "female", girl),
        row("pectoral docking", "pose", "胸肌相抵", "flash", "male", two_m, ("pectoral press",)),
        # ---- 貼著、量、搔。名字裡有 breasts 的全年齡本來就會被擋；沒有的維持誘惑。
        row("face to breasts", "pose", "臉貼乳", "hot", "female", pair_f),
        row("breasts on head", "pose", "胸當枕", "hot", "female", pair_f, ("breast rest",)),
        row("breasts on another's back", "pose", "胸壓背", "hot", "female", pair_f, ("breast press",)),
        row("breast pillow", "pose", "胸枕", "hot", "female", pair_f),
        row("cheek-to-breast", "pose", "臉頰貼胸", "hot", "female", pair_f),
        row("imminent breast grab", "pose", "快抓胸", "hot", "female", pair_f),
        row("covering another's breasts", "pose", "遮她的胸", "hot", "female", pair_f),
        row("tickling breasts", "pose", "搔乳房", "hot", "female", pair_f),
        row("torso grab", "pose", "抓軀幹", "hot", needs=("pair",)),
        row("weighing breasts", "pose", "掂胸", "hot", "female", girl),
        row("finger between breasts", "pose", "指插乳溝", "hot", "female", girl),
        row("bust measuring", "pose", "量胸圍", "hot", "female", girl),
        row("breasts on shoulders", "pose", "胸擱肩", "hot", "female", pair_f),
        row("breast shake", "pose", "搖乳房", "hot", "female", girl),
        row("fanning breasts", "pose", "搧胸", "hot", "female", girl),
        row("wiping breasts", "pose", "擦乳房", "hot", "female", girl),
        # ---- 胸貼胸。露點的接觸只在性愛。不帶出要男生的乳壓臉、頭埋乳溝。
        row("symmetrical docking", "pose", "胸貼胸", "sex", "female", two_f, ("breast press",)),
        row("asymmetrical docking", "pose", "錯胸", "sex", "female", two_f, ("breast press",)),
        row("breast on breast", "pose", "胸疊胸", "sex", "female", two_f),
        row("nipple-to-nipple", "pose", "乳頭相抵", "sex", "female", two_f, layer="skin"),
        row("nipples pressed together", "pose", "乳頭互抵", "sex", "female", two_f, layer="skin"),
        row("breast-to-pectoral docking", "pose", "胸壓胸肌", "sex", needs=hetero),
        row("grabbed breast over shoulder", "pose", "肩後抓胸", "sex", "female", pair_f, ("grabbing another's breast",)),
        # ---- 摸到乳頭或明確的性接觸。flash+sex 的這幾個同時在 groups.SEX，不然會掉進走光。
        row("nipple rub", "pose", "搓乳頭", "flash", "female", girl, ("nipple stimulation",), "skin"),
        row("nipple rub through clothes", "pose", "隔衣搓乳", "flash", "female", girl, ("nipple rub",)),
        row("nipple tweak through clothes", "pose", "隔衣捏乳", "flash", "female", girl, ("nipple tweak",)),
        row("nipple stimulation through clothes", "pose", "隔衣玩乳", "flash", "female", girl),
        row("nipple flick", "pose", "彈乳頭", "flash", "female", girl, ("nipple stimulation",), "skin"),
        row("nipple press", "pose", "按乳頭", "flash", "female", girl, ("nipple stimulation",), "skin"),
        row("nipple push", "pose", "推乳頭", "flash", "female", girl, ("nipple stimulation",), "skin"),
        row("finger on nipple", "pose", "指按乳頭", "flash", "female", girl, layer="skin"),
        row("tickling nipples", "pose", "搔乳頭", "flash", "female", pair_f, layer="skin"),
        row("poking another's breast", "pose", "戳她的胸", "flash", "female", pair_f),
        row("pectoral grab", "pose", "抓胸肌", "flash", "male", pair_m),
        row("breast massage", "pose", "按摩乳房", "flash", "female", pair_f),
        row("breast pull", "pose", "拉乳房", "sex", "female", girl),
        row("hand grabbing both breasts", "pose", "單手抓雙乳", "flash", "female", girl),
        row("areola measuring", "pose", "量乳暈", "flash", "female", girl, layer="skin"),
        row("nipple stimulation (female on male)", "pose", "女玩男乳", "flash", needs=("male", "female"), layer="skin"),
        row("hand milking", "pose", "手擠奶", "flash", "female", pair_f, ("lactation",)),
        row("forced lactation", "pose", "強迫泌乳", "flash", "female", pair_f, ("lactation",)),
        row("slapping with breasts", "pose", "用胸甩人", "sex", "female", pair_f),
        row("breast crush", "pose", "胸壓碎", "sex", "female", pair_f),
        # ---- 嘴。隔衣吸乳只在性愛，因為它帶出的吸吮乳房本身只在性愛。
        row("face between breasts", "pose", "埋胸", "sex", "female", pair_f),
        row("licking breast", "pose", "舔乳房", "sex", "female", pair_f, ("licking",)),
        row("biting nipple", "pose", "咬乳頭", "sex", "female", pair_f, ("nipple stimulation",), "skin"),
        row("biting breast", "pose", "咬乳房", "sex", "female", pair_f),
        row("kissing breast", "pose", "親乳房", "sex", "female", pair_f),
        row("sucking both nipples", "pose", "同時吸雙乳", "sex", "female", pair_f, layer="skin"),
        row("mutual breast sucking", "pose", "互吸乳房", "sex", "female", two_f, ("breast sucking",)),
        row("breast sucking through clothes", "pose", "隔衣吸乳", "sex", "female", pair_f, ("breast sucking",)),
        row("sucking male nipple", "pose", "吸男乳頭", "sex", "male", pair_m, layer="skin"),
        row("penis to breast", "pose", "陰莖蹭胸", "sex", "female", hetero),
        row("penis under breasts", "pose", "陰莖從下", "sex", "female", hetero),
        row("penis over breasts", "pose", "陰莖擱胸", "sex", "female", hetero),
        row("twisted breasts", "pose", "扭轉雙乳", "sex", "female", hetero),
        row("folding paizuri", "pose", "對折乳交", "sex", "female", hetero, ("paizuri",)),
        row("nursing paizuri", "pose", "哺乳乳交", "sex", "female", hetero, ("paizuri",)),
        row("assisted paizuri", "pose", "幫忙乳交", "sex", "female", ("female", "male", "pair", "group", "2female"), ("paizuri",)),
        row("paizuri while penetrated", "pose", "插入中乳交", "sex", "female", ("female", "male", "pair", "group", "2male"), ("paizuri",)),
        row("nursing fingering", "pose", "哺乳指交", "sex", "female", pair_f, ("fingering",)),
        row("reverse nursing fingering", "pose", "反哺乳指交", "sex", "female", pair_f, ("fingering",)),
        row("reverse nursing handjob", "pose", "反哺乳手交", "sex", needs=hetero, implies=("handjob",)),
        row("pecjob", "pose", "胸肌夾莖", "sex", "male", ("male", "2male", "pair")),
        # ---- 三個人以上。group 只保證三人。多個女生做同一件事的加 2female，卡片才不會畫成多個男生。
        row("grabbing multiple others' breasts", "pose", "抓多人胸", "sex", "female", grp_ffm),
        row("cooperative breast sucking", "pose", "合力吸乳", "sex", "female", grp_ff),
        row("cooperative nipple licking", "pose", "合力舔乳", "sex", "female", grp_ffm, layer="skin"),
        row("sucking on multiple breasts", "pose", "吸多人胸", "sex", "female", grp_ffm),
        row("cooperative breast smother", "pose", "合力悶胸", "sex", "female", grp_ff, ("teamwork (sexual)",)),
        row("teamwork (sexual)", "pose", "協力性事", "sex", needs=("group", "2female")),
        row("take your pick", "pose", "任君挑選", "sex", needs=("group", "2female")),
        row("breast pile", "pose", "乳堆", "sex", "female", grp_ff),
        row("surrounded by breasts", "pose", "被胸包圍", "sex", "female", ("female", "2female", "crowd")),
        # ---- 拘束、踩、打。只在性愛。
        row("bound breasts", "pose", "綁胸", "sex", "female", girl),
        row("tied breast", "pose", "綁住乳房", "sex", "female", girl),
        row("slapping breasts", "pose", "拍打乳房", "sex", "female", pair_f),
        row("breast punch", "pose", "揍乳房", "sex", "female", pair_f),
        row("foot on another's breast", "pose", "腳踩乳房", "sex", "female", pair_f),
        row("nipple torture", "pose", "虐乳頭", "sex", "female", girl, ("nipple stimulation",), "skin"),
        row("tied nipples", "pose", "綁乳頭", "sex", "female", girl, layer="skin"),
        row("nipple weights", "pose", "乳頭吊重", "sex", "female", girl, layer="skin"),
        row("nipple leash", "pose", "乳頭牽繩", "sex", "female", girl, layer="skin"),
        row("nipple injection", "pose", "乳頭注射", "sex", "female", girl, ("nipple stimulation",), "skin"),
        # ---- 觸手。父標籤 tentacles 要女生，所以這幾個也要。
        row("tentacle between breasts", "pose", "觸手夾乳", "sex", "female", girl, ("tentacles",)),
        row("grabbed by tentacles", "pose", "觸手抓住", "sex", "female", girl, ("tentacles",)),
        row("tentacles under clothes", "pose", "觸手入衣", "sex", "female", girl, ("tentacles",)),
        row("suction tentacles", "pose", "吸盤觸手", "sex", "female", girl, ("tentacles",)),
        # ---- 器具。不是動作。
        row("nipple suction cups", "clothing", "乳頭吸盤", "sex", "female", girl, ("lactation",), "accessory"),
    ]
    tags = [r["tag"] for r in rows]
    labels = [r["zh"] for r in rows]
    if len(tags) != 118 or len(set(tags)) != 118:
        raise SystemExit(f"extra_breast_grab count {len(tags)} unique {len(set(tags))}")
    if len(set(labels)) != 118:
        raise SystemExit("extra_breast_grab zh collide")
    for r in rows:
        if not 2 <= len(r["zh"]) <= 6:
            raise SystemExit(f"zh length {r['tag']} {r['zh']}")
    return rows


def extra_pair_contact() -> list[dict]:
    """兩人以上的站位與小接觸（2026-10-10）。24 個都向 Danbooru 核過現役（category 0、千張以上）。

    角色類別實測時，兩個角色並排要靠 side-by-side 才站得開；詞庫原本只有擁抱、牽手這種大動作，
    缺「並肩、面對面、靠肩、貼臉、擊掌」這種穿著衣服、三檔都成立的日常互動。
    """
    pair = ("pair",)
    group = ("group",)
    modern = ["modern"]

    def row(tag, section, zh, needs=pair, implies=(), era=None):
        return {
            "tag": tag,
            "section": section,
            "gate": "any",
            "heat": list(HEATS),
            "mutex": None,
            "bind": [],
            "implies": list(implies),
            "layer": "normal",
            "era": list(era) if era else ["any"],
            "needs": list(needs),
            "zh": zh,
        }

    return [
        # ---- 站位：兩個人在畫面裡怎麼擺。
        row("side-by-side", "pose", "並肩"),
        row("face-to-face", "pose", "面對面", implies=("facing another",)),
        row("facing another", "pose", "面向對方"),
        row("symmetrical pose", "pose", "對稱姿勢"),
        row("lineup", "pose", "排排站", needs=group),
        # ---- 靠在一起。
        row("head on another's shoulder", "pose", "靠肩"),
        row("cheek-to-cheek", "pose", "貼臉"),
        row("heads together", "pose", "頭靠頭"),
        row("forehead-to-forehead", "pose", "碰額頭"),
        row("leaning on person", "pose", "倚靠對方"),
        row("group hug", "pose", "團抱", needs=group),
        # ---- 手：搭、摟、拉、摸。
        row("arm around shoulder", "pose", "摟肩"),
        row("hand on another's waist", "pose", "摟腰"),
        row("hands on another's shoulders", "pose", "雙手搭肩"),
        row("holding another's arm", "pose", "拉手臂"),
        row("headpat", "pose", "摸頭"),
        row("cheek poking", "pose", "戳臉頰"),
        row("pointing at another", "pose", "指著對方"),
        row("high five", "pose", "擊掌"),
        row("fist bump", "pose", "碰拳"),
        row("whispering", "pose", "耳語"),
        # ---- 共用一樣東西。
        row("shared umbrella", "pose", "同撐傘", implies=("umbrella",)),
        row("shared scarf", "pose", "共圍巾", implies=("scarf",)),
        row("shared earphones", "pose", "共聽耳機", implies=("earbuds",), era=modern),
        # ---- 關係。
        row("matching outfits", "feature", "同款穿搭"),
    ]

def extra_breast_grab_r3() -> list[dict]:
    """第三、四輪 CSV（2026-10-09）。38 個都向 Danbooru 核過現役，沒有一個已在詞庫。

    會讓整筆抽不到的，這裡不帶：
    - 掀胸罩不帶 clothes lift。父標籤要外衣，身上只有胸罩時會整筆被拒。
    - 拉運動內衣、拉吊帶背心不帶 clothes pull。運動內衣不算外衣；背心跟外衣搶同一格，
      而且父標籤驗的時候背心還沒寫進去。
    - 頭夾胸肌不帶 head between breasts，也不帶詞庫裡沒有的 between pectorals。
    - 拉穿洞不帶 nipple rings。那個父標籤是性愛、女生、配件，耳洞一拉就被拒。
    """
    heats = {
        "all": list(HEATS),
        "flash": ["flash", "sex"],
        "sex": ["sex"],
    }
    girl = ("female",)
    pair = ("pair",)
    pair_f = ("female", "pair")
    pair_m = ("male", "pair")
    two_f = ("female", "2female")
    modern = ["modern"]
    fantasy = ["medieval", "modern"]

    def row(tag, section, zh, heat, gate="any", needs=(), implies=(), era=None, mutex=None):
        return {
            "tag": tag,
            "section": section,
            "gate": gate,
            "heat": list(heats[heat]),
            "mutex": mutex,
            "bind": [],
            "implies": list(implies),
            "layer": "normal",
            "era": list(era) if era else ["any"],
            "needs": list(needs),
            "zh": zh,
        }

    rows = [
        # ---- 角色自己的手。不是畫面外伸進來的那隻，也不是性愛動作。
        row("animal hands", "feature", "獸掌", "all"),
        row("extra arms", "feature", "多手臂", "all"),
        row("extra hands", "feature", "多手", "all"),
        row("clawed hands", "feature", "爪手", "all"),
        row("mechanical hands", "feature", "機械手", "all", era=fantasy),
        # ---- 自己的姿勢。
        row("against mirror", "pose", "貼鏡子", "all", implies=("mirror",)),
        row("arm across chest", "pose", "橫擋胸", "all"),
        row("self hug", "pose", "抱自己", "all"),
        # ---- 兩人以上的身體接觸。沒有露點，跟擁抱同一檔。
        row("arm hug", "pose", "抱手臂", "all", needs=pair),
        row("head hug", "pose", "抱住頭", "all", needs=pair),
        row("double arm hug", "pose", "雙抱手臂", "all", needs=("group", "2female")),
        row("caress", "pose", "撫摸", "all", needs=pair),
        row("girl sandwich", "pose", "兩女夾中", "all", "female", ("female", "group", "2female"), ("sandwiched",)),
        row("head on chest", "pose", "頭靠胸", "all", needs=pair),
        row("breast envy", "pose", "羨慕胸", "all", "female", pair_f),
        row("breast contest", "pose", "比胸圍", "all", "female", two_f),
        row("face to pecs", "pose", "臉貼胸肌", "all", "male", pair_m),
        # ---- 畫面裡的手。不是這個人的身體。wiki 沒有寫成抓胸，所以三檔都進。
        row("disembodied hand", "pose", "浮空手", "all"),
        row("shadow hands", "pose", "影子手", "all"),
        row("giant hand", "pose", "巨手", "all"),
        row("too many hands", "pose", "一堆手", "all"),
        # ---- 名字裡沒有 breast。放進走光，全年齡牌包才不會收到比胸、胸上放東西。
        row("bust chart", "pose", "排比胸", "flash", "female", ("female", "2female", "crowd")),
        row("tawawa challenge", "pose", "胸上平衡", "flash", "female", girl, era=modern),
        # ---- 掀、拉、滑。跟拉下胸罩一樣不佔衣服動作格。衣服本身靠衣服鍵或父標籤。
        row("bra lift", "pose", "掀胸罩", "flash", "female", girl, ("bra",), modern),
        row("bra slip", "pose", "胸罩滑落", "flash", "female", girl, ("bra",), modern),
        row("sports bra pull", "pose", "拉運動內衣", "flash", "female", girl, ("sports bra",), modern),
        row("leotard pull", "pose", "拉緊身衣", "flash", "female", girl, ("leotard",), modern),
        row("bikini top pull", "pose", "拉比基尼上衣", "flash", "female", girl, ("bikini", "clothes pull"), modern),
        row("camisole pull", "pose", "拉吊帶背心", "flash", "female", girl, ("camisole",), modern),
        row("strap pull", "pose", "拉衣帶", "flash", "female", girl, era=modern),
        row("double strap slip", "pose", "雙帶滑落", "flash", "female", girl, ("strap slip",)),
        row("piercing pull", "pose", "拉穿洞", "flash", implies=("piercing",)),
        row("oppai challenge", "pose", "露胸挑戰", "flash", "female", girl, ("flashing",), modern),
        row("arm between breasts", "pose", "手臂夾胸", "flash", "female", girl, ("between breasts",)),
        row("covering one breast", "pose", "遮一邊胸", "flash", "female", girl, ("covering privates",)),
        # ---- 表情。mutex 讓它跟其他臉互斥；熱度由 NARROW_HEAT 釘住。
        row("breast awe", "pose", "驚嘆胸", "flash", needs=pair_f, mutex="expression"),
        # ---- 胸是男生的。頭埋進去跟頭埋乳溝同一檔，但不要求女生。
        row("head between pecs", "pose", "頭夾胸肌", "sex", "male", pair_m),
        # ---- wiki：性場面裡把男方畫成看不見，好露出伴侶。不是一種種族。
        row("invisible man", "pose", "隱形人", "sex", "male", pair_m),
    ]
    tags = [r["tag"] for r in rows]
    labels = [r["zh"] for r in rows]
    if len(tags) != 38 or len(set(tags)) != 38:
        raise SystemExit(f"extra_breast_grab_r3 count {len(tags)} unique {len(set(tags))}")
    if len(set(labels)) != 38:
        raise SystemExit("extra_breast_grab_r3 zh collide")
    for r in rows:
        if not 2 <= len(r["zh"]) <= 6:
            raise SystemExit(f"zh length {r['tag']} {r['zh']}")
    return rows


def load_characters() -> list[dict]:
    path = Path(__file__).with_name("characters.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("scripts/characters.json 必須是陣列")
    return data


def extra_wrestle_tags() -> list[dict]:
    """摔角、觀眾、公開場合。2026-10-23 用 WAI v17 測過，只收 D≥3/5 的字。

    觀眾和擁擠照 crowd：mutex 空、由 groups.py 歸背景，不用 needs crowd。
    招式跟 fighting 一樣佔 activity，needs pair，不限性別。catfight 是女生打架，needs 2female。
    熊抱鎖測出來是相擁，放兩人互動，不佔活動格。勝利姿勢照 fighting stance 的 body_pose。
    摔角服是運動連身衣，三檔都進；不照 leotard 的女性和 tease/flash，那兩格對不上測到的圖。
    彩球佔手持格。沒有活動鉤子之前抽不到，鉤子在 engine 的 ACT_PROP，這裡不動。
    腰帶用 waist，跟 belt 同一格，正常模式才抽得到。
    2026-10-23 第二輪：專案主要把上一輪 D 不到 3/5 的 12 個也加進來。
    招式仍佔 activity、needs pair。鎖喉不讓裸絞 implies。
    頭夾腿間兩張算過的都是穿衣服、臉夾在大腿間，不是性交，所以三檔都進、歸誘惑。
    摔角緊身衣照摔角服，implies 運動服。裁判照摔角手放連身衣，模型畫成西裝也不改成西裝。
    """
    all_h = list(HEATS)
    modern = ["modern"]
    sex = ["sex"]
    edo_mod = ["edo", "modern"]

    def pose(tag, mutex=None, implies=None, needs=None, heat=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": "any",
            "heat": list(heat or all_h),
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    def env(tag, mutex=None, implies=None, era=None, zh=""):
        return {
            "tag": tag,
            "section": "env",
            "gate": "any",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or modern,
            "zh": zh,
        }

    def cloth(tag, mutex=None, layer="accessory", implies=None, zh=""):
        return {
            "tag": tag,
            "section": "clothing",
            "gate": "any",
            "heat": all_h,
            "mutex": mutex,
            "bind": [],
            "implies": implies or [],
            "layer": layer,
            "era": modern,
            "zh": zh,
        }

    return [
        env("audience", era=["any"], zh="觀眾"),
        env("crowded", era=["any"], zh="擁擠"),
        env("wrestling ring", mutex="place", implies=["indoors"], zh="摔角擂台"),
        # 圓頂看台可室內可室外，不單向暗示。照 sports court。
        # 「競技場」已經是 colosseum（古羅馬那種）。arena 是現代有看台的比賽場館。
        env("arena", mutex="place", zh="競技館"),
        env("pom pom (cheerleading)", mutex="held_prop", zh="彩球"),
        pose("wrestling", mutex="activity", era=modern, zh="摔角"),
        pose("suplex", mutex="activity", needs=["pair"], zh="背摔"),
        pose("german suplex", mutex="activity", needs=["pair"], zh="德式背摔"),
        pose("submission hold", mutex="activity", needs=["pair"], zh="關節技"),
        pose("armlock", mutex="activity", needs=["pair"], zh="鎖臂"),
        pose("scissorhold", mutex="activity", needs=["pair"], zh="剪刀腳"),
        pose("choke hold", mutex="activity", needs=["pair"], zh="鎖喉"),
        pose("triangle choke", mutex="activity", needs=["pair"], zh="三角絞"),
        pose("piledriver (wrestling)", mutex="activity", needs=["pair"], zh="倒插"),
        pose("pinned", mutex="activity", needs=["pair"], zh="壓制"),
        pose("catfight", mutex="activity", needs=["2female"], zh="女生打架"),
        pose("arm wrestling", mutex="activity", needs=["pair"], zh="比腕力"),
        pose("sumo", mutex="activity", era=edo_mod, zh="相撲"),
        pose("mixed martial arts", mutex="activity", era=modern, zh="綜合格鬥"),
        pose("martial arts", mutex="activity", zh="武術"),
        pose("cheering", mutex="activity", zh="加油歡呼"),
        pose("victory pose", mutex="body_pose", zh="勝利姿勢"),
        pose("bearhug", needs=["pair"], zh="熊抱鎖"),
        pose("head between thighs", needs=["pair"], zh="頭夾腿間"),
        pose("sexual harassment", needs=["pair"], zh="性騷擾"),
        pose("pulling another's clothes", needs=["pair"], zh="扯別人衣服"),
        pose("defeat", zh="落敗"),
        pose("public masturbation", implies=["masturbation"], heat=sex, zh="公開自慰"),
        pose("masturbating while watching", implies=["masturbation"], heat=sex, zh="邊看邊自慰"),
        pose("public bondage", implies=["restrained"], heat=sex, zh="公開綁縛"),
        cloth("wrestling outfit", mutex="onepiece", layer="garment", implies=["sportswear"], zh="摔角服"),
        cloth("singlet", mutex="onepiece", layer="garment", implies=["sportswear"], zh="摔角緊身衣"),
        # Danbooru 的 wrestler 是「練摔角的人」。詞庫裡 cheerleader 是那套衣服，
        # 職業預設不抽，所以摔角手跟啦啦隊服一樣放連身衣，不放 job。
        cloth("wrestler", mutex="onepiece", layer="garment", zh="摔角手"),
        cloth("referee", mutex="onepiece", layer="garment", zh="裁判"),
        cloth("wrestling mask", mutex="headwear", implies=["mask"], zh="摔角面具"),
        cloth("championship belt", mutex="waist", zh="冠軍腰帶"),
        cloth("elbow pads", zh="護肘"),
        cloth("wrestling boots", mutex="feet", layer="garment", implies=["boots"], zh="摔角靴"),
        cloth("boxing headgear", mutex="headwear", implies=["helmet"], zh="拳擊頭盔"),
        cloth("martial arts belt", mutex="waist", zh="武術腰帶"),
    ]


def extra_ethnic_tags() -> list[dict]:
    """族裔與周邊。2026-10-23 用 WAI v17 測過，只收 D≥3/5。

    族裔 mutex 是 ethnicity，groups.py 把它歸皮膚那組，不放 race（正常模式會擋種族）。
    不 implies 膚色或衣服。東亞、南亞的舊名由 alt_names.json 並排。
    印度服飾只認舊名 indian clothes，不暗示莎麗或眉心點。
    中東建築照東亞建築佔地點、暗示室外，但時代用 any：東亞建築鎖古中國加江戶，
    預設現代會抽不到。
    男女對打照女生打架佔 activity，needs 男和女，不佔兩人。
    """
    all_h = list(HEATS)

    def feat(tag, zh):
        return {
            "tag": tag,
            "section": "feature",
            "gate": "any",
            "heat": all_h,
            "mutex": "ethnicity",
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": [],
            "zh": zh,
        }

    def cloth(tag, zh):
        return {
            "tag": tag,
            "section": "clothing",
            "gate": "any",
            "heat": all_h,
            "mutex": None,
            "bind": [],
            "implies": [],
            "layer": "garment",
            "era": ["any"],
            "needs": [],
            "mutexExtra": ["print_style"],
            "zh": zh,
        }

    def env(tag, zh):
        return {
            "tag": tag,
            "section": "env",
            "gate": "any",
            "heat": all_h,
            "mutex": "place",
            "bind": [],
            "implies": ["outdoors"],
            "layer": "normal",
            "era": ["any"],
            "zh": zh,
        }

    def pose(tag, zh):
        return {
            "tag": tag,
            "section": "pose",
            "gate": "any",
            "heat": all_h,
            "mutex": "activity",
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": ["male", "female"],
            "zh": zh,
        }

    return [
        feat("east asian", "東亞人"),
        feat("desi", "南亞人"),
        cloth("indian clothes", "印度服飾"),
        env("middle eastern architecture", "中東建築"),
        pose("mixed-sex combat", "男女對打"),
    ]


def extra_gag_tags() -> list[dict]:
    """口塞、繩縛、俘虜、羞辱。2026-10-24 用 WAI v17 測過，只收 D≥3/5。

    口塞照 bit gag 放飾品，但圖是穿衣服的肖像，所以三檔都開、時代 any
    （不要用摔角那支會鎖現代的 cloth）。種類都 implies gag；被塞口是狀態，也 implies gag。
    衣外繩縛、綁手臂、綁腿、綁軀幹照 shibari、bound wrists，三檔都開。
    俘虜和綁在椅子上照 restrained，只有 sex。綁在椅子上 implies chair。
    被俘不 implies restrained。小陰莖羞辱 implies small penis，要男和女。
    貞操鎖是男用器具，gate male、needs male、時代 modern。
    籠子是鐵條物件，跟鳥籠同格，不佔地點。口塞頭套的舊名由 alt_names 並排。
    秒墮、被迫觀看是主人看過圖後留下的。秒墮照交配壓制只開 sex、要一男一女，
    但不佔性愛動作格，也不 implies 交配壓制（圖常是兩格，體位不固定）。
    被迫觀看只要三人，needs group。兩個都進 sex_bdsm。
    """
    all_h = list(HEATS)
    sex = ["sex"]

    def cloth(tag, implies=None, zh=""):
        return {
            "tag": tag,
            "section": "clothing",
            "gate": "any",
            "heat": all_h,
            "mutex": None,
            "bind": [],
            "implies": implies or [],
            "layer": "accessory",
            "era": ["any"],
            "needs": [],
            "zh": zh,
        }

    def pose(tag, implies=None, needs=None, gate="any", era=None, zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": gate,
            "heat": sex,
            "mutex": None,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": era or ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    return [
        cloth("gagged", ["gag"], "被塞口"),
        cloth("improvised gag", ["gag"], "臨時口塞"),
        cloth("cleave gag", ["gag"], "勒口布"),
        cloth("gag harness", ["gag"], "口塞頭套"),
        cloth("shibari over clothes", ["shibari"], "衣外繩縛"),
        cloth("bound arms", zh="綁手臂"),
        cloth("bound legs", zh="綁腿"),
        cloth("bound torso", zh="綁軀幹"),
        pose("captured", zh="被俘"),
        pose("tied to chair", ["chair"], zh="綁在椅子上"),
        pose("chained", zh="被鎖鏈拴住"),
        pose("prisoner", zh="囚犯"),
        pose("small penis humiliation", ["small penis"], ["male", "female"], zh="小陰莖羞辱"),
        pose("chastity cage", gate="male", needs=["male"], era=["modern"], zh="貞操鎖"),
        pose("instant loss", needs=["male", "female", "pair"], zh="秒墮"),
        pose("forced to watch", needs=["group"], zh="被迫觀看"),
        {
            "tag": "cage",
            "section": "env",
            "gate": "any",
            "heat": all_h,
            "mutex": None,
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": [],
            "zh": "籠子",
        },
    ]


def extra_measuring_tags() -> list[dict]:
    """量東西、量陰莖（2026-10-25 專案主指定）。

    Danbooru 都是一般標籤、沒有停用（measuring 1359 張、penis_measuring 1160 張），也都沒有 implications。
    measuring 跟閱讀、料理一樣是日常活動，佔活動格。penis measuring 只開 sex，寫法照陰莖貼臉：
    implies penis、要一男一女。
    """
    return [
        {
            "tag": "measuring",
            "section": "pose",
            "gate": "any",
            "heat": ["tease", "flash", "sex"],
            "mutex": "activity",
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "needs": [],
            "zh": "測量",
        },
        {
            "tag": "penis measuring",
            "section": "pose",
            "gate": "any",
            "heat": ["sex"],
            "mutex": None,
            "bind": [],
            "implies": ["penis"],
            "layer": "normal",
            "era": ["any"],
            "needs": ["male", "female"],
            "zh": "量陰莖",
        },
    ]


def extra_object_tags() -> list[dict]:
    """日常物品（2026-10-26）：尺、捲尺，加上文具、工具、針線、梳妝、電器、飲食這些常見的小東西。

    全部是 Danbooru 現役一般標籤（大多上千張）。拿在手上的佔 held_prop（一次只拿一樣），
    擺著、貼著、戴著的不佔。電器、文具只在現代；梳子、鏟子、斧頭這類古今都有的不限時代。
    implies 只接詞庫已有的字（禮物盒 → 禮物、毛線球 → 毛線、香水瓶／水壺 → 瓶子）。
    卡面照筆、書的畫法走靜物（card-art.js 的 STILL_LIFE）。
    """

    def obj(tag, section, zh, mutex=None, era=None, implies=None):
        return {
            "tag": tag,
            "section": section,
            "gate": "any",
            "heat": list(HEATS),
            "mutex": mutex,
            "bind": [],
            "implies": list(implies or []),
            "layer": "normal",
            "era": list(era or ["any"]),
            "needs": [],
            "zh": zh,
        }

    return [
        obj("ruler", "env", "尺", mutex="held_prop"),
        obj("tape measure", "env", "捲尺", mutex="held_prop", era=["modern", "victorian"]),
        obj("notebook", "env", "筆記本", mutex="held_prop", era=["modern"]),
        obj("sketchbook", "env", "素描本", mutex="held_prop", era=["modern", "victorian"]),
        obj("eraser", "env", "橡皮擦", mutex="held_prop", era=["modern"]),
        obj("notepad", "env", "便條本", mutex="held_prop", era=["modern"]),
        obj("sticky note", "env", "便利貼", era=["modern"]),
        obj("envelope", "env", "信封", mutex="held_prop", era=["modern", "victorian"]),
        obj("letter", "env", "信", mutex="held_prop"),
        obj("love letter", "env", "情書", mutex="held_prop", era=["modern", "victorian"]),
        obj("map", "env", "地圖", mutex="held_prop"),
        obj("origami", "env", "摺紙", era=["modern", "edo"]),
        obj("paper airplane", "env", "紙飛機", mutex="held_prop", era=["modern"]),
        obj("wallet", "env", "錢包", mutex="held_prop", era=["modern"]),
        obj("coin", "env", "硬幣"),
        obj("money", "env", "鈔票", mutex="held_prop", era=["modern"]),
        obj("dice", "env", "骰子"),
        obj("chess piece", "env", "西洋棋子", era=["modern", "victorian", "medieval"]),
        obj("gift box", "env", "禮物盒", mutex="held_prop", era=["modern", "victorian"], implies=["gift"]),
        obj("trophy", "env", "獎盃", mutex="held_prop", era=["modern", "victorian"]),
        obj("padlock", "env", "掛鎖", era=["modern", "victorian"]),
        obj("wand", "env", "魔杖", mutex="held_prop"),
        obj("hourglass", "env", "沙漏", era=["modern", "victorian", "medieval"]),
        obj("magnifying glass", "env", "放大鏡", mutex="held_prop", era=["modern", "victorian"]),
        obj("binoculars", "env", "雙筒望遠鏡", mutex="held_prop", era=["modern", "victorian"]),
        obj("telescope", "env", "望遠鏡", era=["modern", "victorian", "edo"]),
        obj("megaphone", "env", "大聲公", mutex="held_prop", era=["modern"]),
        obj("briefcase", "env", "公事包", mutex="held_prop", era=["modern"]),
        obj("calendar (object)", "env", "月曆", era=["modern"]),
        obj("watering can", "env", "澆水壺", mutex="held_prop", era=["modern", "victorian"]),
        obj("shovel", "env", "鏟子", mutex="held_prop"),
        obj("hammer", "env", "鐵鎚", mutex="held_prop"),
        obj("wrench", "env", "扳手", mutex="held_prop", era=["modern"]),
        obj("screwdriver", "env", "螺絲起子", mutex="held_prop", era=["modern"]),
        obj("saw", "env", "鋸子", mutex="held_prop"),
        obj("axe", "env", "斧頭", mutex="held_prop"),
        obj("sewing needle", "env", "縫衣針", mutex="held_prop"),
        obj("thread", "env", "線"),
        obj("yarn", "env", "毛線"),
        obj("yarn ball", "env", "毛線球", implies=["yarn"]),
        obj("comb", "env", "梳子", mutex="held_prop"),
        obj("hair brush", "env", "髮梳", mutex="held_prop", era=["modern", "victorian"]),
        obj("hair dryer", "env", "吹風機", mutex="held_prop", era=["modern"]),
        obj("toothbrush", "env", "牙刷", mutex="held_prop", era=["modern"]),
        obj("makeup brush", "env", "化妝刷", mutex="held_prop", era=["modern"]),
        obj("perfume bottle", "env", "香水瓶", era=["modern", "victorian"], implies=["bottle"]),
        obj("tissue", "env", "面紙", mutex="held_prop", era=["modern"]),
        obj("thermometer", "env", "溫度計", mutex="held_prop", era=["modern"]),
        obj("first aid kit", "env", "急救箱", era=["modern"]),
        obj("test tube", "env", "試管", mutex="held_prop", era=["modern"]),
        obj("remote control", "env", "遙控器", mutex="held_prop", era=["modern"]),
        obj("tablet pc", "env", "平板電腦", mutex="held_prop", era=["modern"]),
        obj("computer keyboard", "env", "電腦鍵盤", era=["modern"]),
        obj("computer mouse", "env", "滑鼠", era=["modern"]),
        obj("bento", "env", "便當", era=["modern"]),
        obj("water bottle", "env", "隨身水瓶", era=["modern"], implies=["bottle"]),
        obj("thermos", "env", "保溫瓶", era=["modern"]),
    ]


def extra_family_sex_tags() -> list[dict]:
    """姊妹丼、親子丼、家族群交、性愛指導（2026-10-25 專案主指定，專案主自己測過圖）。

    Danbooru 都是一般標籤、沒有停用（389～3382 張）。只開 sex（色情分級才有），
    而且進 engine.js 的 ODD_MOTIF：只在釘了才出現，引擎不會隨機抽到家族性愛的設定。
    姊妹丼、親子丼是兩女一男：implies 姊妹／母女和 ffm threesome，needs 一男兩女、三人。
    家族群交 implies group sex，needs 三人。性愛指導只要兩人。卡面照多人規則帶 adult、mature。
    """
    def pose(tag, implies=None, needs=None, zh=""):
        return {
            "tag": tag,
            "section": "pose",
            "gate": "any",
            "heat": ["sex"],
            "mutex": None,
            "bind": [],
            "implies": implies or [],
            "layer": "normal",
            "era": ["any"],
            "needs": needs or [],
            "zh": zh,
        }

    trio = ["male", "female", "2female", "pair", "group"]
    return [
        pose("shimaidon", ["sisters", "ffm threesome"], trio, "姊妹丼"),
        pose("oyakodon (sex)", ["mother and daughter", "ffm threesome"], trio, "親子丼"),
        pose("group incest", ["group sex"], ["pair", "group"], "家族群交"),
        pose("sexual coaching", needs=["pair"], zh="性愛指導"),
    ]


# 色彩玫瑰照自然花卉，帶 flower（any），不帶僅中世紀／維多利亞的裝飾 rose。
# 2026-10-24：帶 rose 會被 inherit_eras 收窄，錯把現代花卉當古代錨，並連吐兩個時代詞。
def extra_round4_scenes() -> list[dict]:
    """2026-10-24 第四輪第1批。API 核實；只有疑義詞做模型 D/C，見討論區。"""
    def row(tag, zh, section="env", mutex=None, era=None, implies=None, needs=None,
            gate="any", heat=None, layer="normal", mxextra=None):
        out = {"tag": tag, "zh": zh, "section": section, "gate": gate,
               "heat": heat or list(HEATS), "mutex": mutex, "bind": [],
               "implies": implies or [], "layer": layer, "era": era or ["any"],
               "needs": needs or []}
        if mxextra:
            out["mutexExtra"] = mxextra
        return out

    return [
        row("black flower", "黑花", implies=['flower']),
        row("black rose", "黑玫瑰", implies=['flower']),
        row("blue flower", "藍花", implies=['flower']),
        row("blue rose", "藍玫瑰", implies=['flower']),
        row("orange flower", "橙花", implies=['flower']),
        row("pink flower", "粉紅花", implies=['flower']),
        row("pink rose", "粉紅玫瑰", implies=['flower']),
        row("purple flower", "紫花", implies=['flower']),
        row("purple rose", "紫玫瑰", implies=['flower']),
        row("red flower", "紅花", implies=['flower']),
        row("red rose", "紅玫瑰", implies=['flower']),
        row("white flower", "白花", implies=['flower']),
        row("white rose", "白玫瑰", implies=['flower']),
        row("yellow flower", "黃花", implies=['flower']),
        row("yellow rose", "黃玫瑰", implies=['flower']),
        row("green flower", "綠花", implies=['flower']),
        row("camellia", "山茶花", implies=['flower']),
        row("daisy (flower)", "雛菊", implies=['flower']),
        row("tulip", "鬱金香", implies=['flower']),
        row("white lily", "白百合", implies=['flower']),
        row("wisteria", "紫藤", implies=['flower']),
        row("bare tree", "枯樹／光禿的樹"),
        row("branch", "樹枝"),
        row("lily pad", "蓮葉／睡蓮葉"),
        row("palm leaf", "棕櫚葉"),
        row("tree stump", "樹墩"),
        row("vines", "藤蔓"),
        row("bird", "鳥"),
        row("butterfly", "蝴蝶"),
        row("cat", "貓"),
        row("dog", "狗"),
        row("fish", "魚"),
        row("school desk", "學校課桌", era=['modern']),
        row("school chair", "學校椅子", era=['modern'], implies=['chair']),
        row("chalkboard", "黑板", era=['modern']),
        row("book stack", "書堆"),
        row("cabinet", "櫃子"),
        row("drawer", "抽屜"),
        row("flower pot", "花盆"),
        row("picture frame", "相框"),
        row("potted plant", "盆栽"),
        row("rug", "小地毯"),
        row("shelf", "架子"),
        row("tablecloth", "桌巾"),
        row("wooden table", "木製桌子"),
        row("window blinds", "百葉窗簾"),
        row("barrel", "木酒桶"),
        row("candlestand", "單燭燭台"),
        row("gohei", "御幣", era=['edo', 'modern']),
        row("shimenawa", "注連繩"),
        row("vase", "花瓶"),
        row("wind chime", "風鈴"),
        row("wooden bucket", "木水桶"),
        row("treasure chest", "寶箱"),
        row("cardboard box", "紙箱"),
        row("doll", "人偶"),
        row("gift", "禮物"),
        row("ceiling", "天花板"),
        row("checkered floor", "棋盤格地板"),
        row("door", "門"),
        row("doorway", "門口"),
        row("gate", "大門／閘門"),
        row("ladder", "梯子"),
        row("open door", "開著的門"),
        row("open window", "開著的窗"),
        row("pole", "柱子／桿子"),
        row("reflective floor", "反光地板"),
        row("sliding doors", "拉門"),
        row("tile floor", "磁磚地板"),
        row("tile wall", "磁磚牆"),
        row("tombstone", "墓碑"),
        row("wooden fence", "木柵欄"),
        row("wooden wall", "木板牆"),
        row("spider web", "蜘蛛網"),
        row("pavement", "鋪面路", era=['modern']),
        row("road sign", "道路標誌", era=['modern']),
        row("poster (object)", "海報（物件）", era=['modern']),
        row("trash can", "垃圾桶", era=['modern']),
        row("air conditioner", "冷氣機", era=['modern']),
        row("alarm clock", "鬧鐘", era=['modern']),
        row("electric fan", "電風扇", era=['modern']),
        row("light bulb", "燈泡", era=['modern']),
        row("refrigerator", "冰箱", era=['modern']),
        row("television", "電視", era=['modern']),
        row("faucet", "水龍頭", era=['modern']),
        row("toilet", "馬桶", era=['modern']),
        row("cooking pot", "烹飪鍋具"),
        row("drinking glass", "玻璃杯"),
        row("kettle", "水壺"),
        row("crystal", "水晶"),
        row("seashell", "貝殼"),
        row("shallow water", "淺水"),
        row("starfish", "海星"),
        row("waves", "海浪"),
        row("rubber duck", "橡皮鴨", era=['modern']),
        row("aircraft", "航空器", era=['modern']),
        row("fighter jet", "戰鬥機", era=['modern']),
        row("flight deck", "飛行甲板", era=['modern']),
        row("military vehicle", "軍用車輛", era=['modern']),
        row("motor vehicle", "機動車輛", era=['modern']),
        row("motorcycle", "摩托車", era=['modern']),
        row("sports car", "跑車", era=['modern']),
        row("truck", "卡車", era=['modern']),
        row("smokestack", "煙囪（船/火車/工廠）", era=['modern']),
        row("watercraft", "水上載具"),
        row("warship", "軍艦", era=['modern']),
        row("glowing sword", "發光的劍"),
        row("glowing weapon", "發光武器"),
        row("happy halloween", "萬聖節快樂（文字）", era=['modern']),
        row("happy valentine", "情人節快樂（文字）", era=['modern']),
        row("nengajou", "賀年卡", era=['modern']),
        row("year of the rabbit", "兔年", era=['modern']),
        row("year of the tiger", "虎年", era=['modern']),
        row("wreath", "花圈／花環", era=['modern']),
        row("setsubun", "節分", era=['edo', 'modern']),
        row("tanabata", "七夕", era=['edo', 'modern']),
        row("spring (season)", "春天", mxextra=['season']),
        row("autumn", "秋天", mxextra=['season']),
        row("snowman", "雪人"),
        row("folding chair", "折疊椅", implies=['chair']),
        row("lounge chair", "躺椅", implies=['chair']),
        row("on bench", "在長椅上", mutex='furniture'),
        row("on floor", "在地板上", mutex='furniture'),
        row("on ground", "在地面上", mutex='furniture'),
        row("on swing", "在鞦韆上", mutex='furniture'),
        row("on table", "在桌面上", mutex='furniture'),
        row("gym storeroom", "體育器材室", mutex='place', era=['modern'], implies=['indoors']),
        row("morning", "早晨", mutex='day_night'),
        row("grey sky", "灰天空"),
        row("cumulonimbus cloud", "積雨雲"),
        row("constellation", "星座"),
        row("contrail", "飛機雲"),
        row("red moon", "紅月"),
        row("snowing", "下雪", mutex='weather', implies=['snow']),
        row("breath", "呼出白氣", mutex='effect'),
        row("falling feathers", "飄落羽毛", mutex='effect'),
        row("glint", "閃亮光點", mutex='effect'),
        row("light trail", "光軌", mutex='effect'),
        row("sunburst", "日芒／放射光芒", mutex='effect'),
        row("musical note", "音符", mutex='effect'),
        row("notice lines", "察覺線（驚覺線）", mutex='effect'),
        row("puff of air", "噴氣符號", mutex='effect'),
        row("spoken musical note", "說話音符", mutex='effect'),
        row("squiggle", "螺旋塗鴉", mutex='effect'),
        row("zzz", "呼呼（睡眠音效）", mutex='effect'),
        row("diagonal-striped background", "斜條紋背景", mutex='background'),
        row("plaid background", "格紋背景", mutex='background'),
        row("sunburst background", "放射光芒背景", mutex='background'),
        row("vertical-striped background", "直條紋背景", mutex='background'),
        row("3d background", "3D背景", section='pose'),
        row("black border", "黑色邊框", section='pose'),
        row("outside border", "出框（超出邊框）", section='pose'),
        row("white border", "白色邊框", section='pose'),
        row("against railing", "靠著欄杆", section='pose'),
        row("against tree", "靠著樹", section='pose'),
        row("in tree", "在樹上", section='pose'),
        row("sitting in tree", "坐在樹上", section='pose'),
        row("standing on liquid", "站在水面上", section='pose'),
        row("opening door", "正在開門", section='pose', mutex='activity'),
        row("holding lantern", "提燈籠", section='pose'),
        row("cold", "寒冷", section='feature'),
        row("hot", "炎熱", section='feature'),
        row("headlamp", "頭燈", section='clothing', era=['modern'], layer='accessory'),
        row("cloud print", "雲朵印花", section='clothing', mutex='fabric', layer='garment'),
        row("starry sky print", "星空印花", section='clothing', mutex='fabric', layer='garment'),
        row("neon trim", "霓虹滾邊", section='clothing', mutex='fabric', layer='garment'),
    ]


def extra_round4_clothes() -> list[dict]:
    """2026-10-24 第四輪第2批。API 核實；只有疑義詞做模型 D/C，見討論區。"""
    def row(tag, zh, section="env", mutex=None, era=None, implies=None, needs=None,
            gate="any", heat=None, layer="normal", mxextra=None):
        out = {"tag": tag, "zh": zh, "section": section, "gate": gate,
               "heat": heat or list(HEATS), "mutex": mutex, "bind": [],
               "implies": implies or [], "layer": layer, "era": era or ["any"],
               "needs": needs or []}
        if mxextra:
            out["mutexExtra"] = mxextra
        return out

    return [
        row("red skirt", "紅色裙子", section='clothing', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row("green skirt", "綠色裙子", section='clothing', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row("grey skirt", "灰色裙子", section='clothing', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row("pink skirt", "粉紅色裙子", section='clothing', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row("purple skirt", "紫色裙子", section='clothing', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row("layered skirt", "多層裙", section='clothing', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row("denim skirt", "牛仔裙", section='clothing', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row("white pants", "白色長褲", section='clothing', mutex='bottom', era=['modern', 'victorian'], implies=['pants'], layer='garment'),
        row("grey pants", "灰色長褲", section='clothing', mutex='bottom', era=['modern', 'victorian'], implies=['pants'], layer='garment'),
        row("white shorts", "白色短褲", section='clothing', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row("black kimono", "黑色和服", section='clothing', era=['edo'], implies=['kimono'], layer='garment'),
        row("red kimono", "紅色和服", section='clothing', era=['edo'], implies=['kimono'], layer='garment'),
        row("pink kimono", "粉紅色和服", section='clothing', era=['edo'], implies=['kimono'], layer='garment'),
        row("red hakama", "紅色袴", section='clothing', mutex='bottom', era=['edo'], implies=['hakama'], layer='garment'),
        row("obijime", "帶締", section='clothing', era=['edo', 'modern'], layer='accessory'),
        row("tasuki", "襷（束袖帶）", section='clothing', era=['edo', 'modern'], layer='accessory'),
        row("kariginu", "狩衣", section='clothing', mutex='onepiece', era=['edo'], implies=['japanese clothes'], layer='garment'),
        row("full armor", "全身鎧甲", section='clothing', mutex='onepiece', era=['medieval', 'edo'], implies=['armor'], layer='garment'),
        row("greaves", "脛甲", section='clothing', mutex='feet', era=['medieval'], layer='accessory'),
        row("vambraces", "護臂甲", section='clothing', mutex='hands', era=['medieval'], layer='accessory'),
        row("vertical-striped clothes", "直條紋衣物", section='clothing', layer='garment'),
        row("checkered clothes", "格子衣物", section='clothing', layer='garment'),
        row("argyle clothes", "菱格紋衣物", section='clothing', layer='garment'),
        row("cross-laced clothes", "交叉綁帶衣物", section='clothing', layer='garment'),
        row("asymmetrical clothes", "不對稱衣物", section='clothing', layer='garment'),
        row("taut clothes", "繃緊的衣物", section='clothing', layer='garment'),
        row("unbuttoned", "解開釦子", section='clothing', layer='garment'),
        row("raglan sleeves", "插肩袖", section='clothing', era=['modern', 'victorian'], layer='garment'),
        row("wing collar", "翼領（折角領）", section='clothing', era=['modern', 'victorian'], layer='garment'),
        row("double-breasted", "雙排扣", section='clothing', era=['modern', 'victorian'], layer='garment'),
        # 2026-10-24 第四輪驗收：有顏色的皮鞋、靴子、涼鞋原本是 any，江戶的鞋子木屐／草履從 66% 掉到 50%（黑皮鞋、白靴子進了江戶）。
        # 皮鞋只給維多利亞、現代；靴子多給中世紀；黑涼鞋給古希臘、現代。
        row("black shoes", "黑色鞋子", section='clothing', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row("white shoes", "白色鞋子", section='clothing', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row("brown shoes", "棕色鞋子", section='clothing', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row("red shoes", "紅色鞋子", section='clothing', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row("black boots", "黑色靴子", section='clothing', mutex='feet', era=['medieval', 'victorian', 'modern'], implies=['boots'], layer='garment'),
        row("white boots", "白色靴子", section='clothing', mutex='feet', era=['medieval', 'victorian', 'modern'], implies=['boots'], layer='garment'),
        row("brown boots", "棕色靴子", section='clothing', mutex='feet', era=['medieval', 'victorian', 'modern'], implies=['boots'], layer='garment'),
        row("black sandals", "黑色涼鞋", section='clothing', mutex='feet', era=['ancient_greece', 'modern'], implies=['sandals'], layer='garment'),
        row("flip-flops", "夾腳拖", section='clothing', mutex='feet', era=['modern'], implies=['sandals'], layer='garment'),
        row("pumps", "淑女高跟鞋（pumps）", section='clothing', mutex='feet', era=['victorian', 'modern'], implies=['high heels'], gate='female', layer='accessory'),
        row("black pantyhose", "黑色褲襪", section='clothing', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row("white pantyhose", "白色褲襪", section='clothing', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row("brown pantyhose", "棕色褲襪", section='clothing', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row("thighband pantyhose", "大腿加深帶褲襪", section='clothing', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row("black socks", "黑色襪子", section='clothing', mutex='feet', implies=['socks'], layer='garment'),
        row("striped thighhighs", "條紋過膝襪", section='clothing', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row("brown thighhighs", "棕色過膝襪", section='clothing', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row("red thighhighs", "紅色過膝襪", section='clothing', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row("asymmetrical legwear", "不對稱腿部襪類", section='clothing', era=['modern'], layer='garment'),
        row("leg warmers", "暖腿套", section='clothing', mutex='legs', era=['modern'], layer='garment'),
        row("naked cape", "只披披風", section='clothing', mutex='onepiece', heat=['flash', 'sex'], layer='garment'),
        row("naked sheet", "只裹床單", section='clothing', mutex='onepiece', heat=['flash', 'sex'], layer='garment'),
        row("nude cover", "裸體遮蔽", section='clothing', mutex='nudity', implies=['nude'], heat=['flash', 'sex'], layer='skin'),
        row("partially undressed", "半脫衣", section='clothing', heat=['flash', 'sex'], layer='garment'),
        row("bare hips", "露出腰臀兩側", section='feature'),
        row("no shirt", "未穿上衣", section='clothing', mutex='top', heat=['flash', 'sex'], layer='garment'),
        row("no pants", "未穿下著（有內褲）", section='clothing', mutex='bottom', era=['modern'], heat=['flash', 'sex'], layer='garment'),
        row("unworn panties", "未穿著的內褲", era=['modern']),
        row("unworn bra", "未穿著的胸罩", era=['modern']),
        row("heart pasties", "愛心乳貼", section='clothing', era=['modern'], implies=['pasties'], needs=['female'], gate='female', layer='garment'),
        row("collared dress", "有領洋裝", section='clothing', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row("long dress", "長洋裝", section='clothing', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row("pleated dress", "百褶洋裝", section='clothing', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row("halter dress", "掛脖洋裝", section='clothing', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row("layered dress", "多層洋裝", section='clothing', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row("strapless leotard", "無肩帶緊身衣", section='clothing', mutex='onepiece', era=['modern'], implies=['leotard'], gate='female', layer='garment'),
        row("white leotard", "白色緊身衣", section='clothing', mutex='onepiece', era=['modern'], implies=['leotard'], gate='female', layer='garment'),
        row("black one-piece swimsuit", "黑色連身泳衣", section='clothing', mutex='onepiece', era=['modern'], implies=['one-piece swimsuit'], gate='female', layer='garment'),
        row("highleg one-piece swimsuit", "高衩連身泳衣", section='clothing', mutex='onepiece', era=['modern'], implies=['one-piece swimsuit'], gate='female', layer='garment'),
        row("naval uniform", "海軍制服", section='clothing', mutex='onepiece', era=['modern'], layer='garment'),
        row("white jacket", "白色夾克", section='clothing', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row("red jacket", "紅色夾克", section='clothing', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row("brown jacket", "棕色夾克", section='clothing', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row("fur-trimmed jacket", "毛邊夾克", section='clothing', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row("grey jacket", "灰色夾克", section='clothing', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row("black coat", "黑色大衣", section='clothing', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row("hooded coat", "連帽大衣", section='clothing', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row("black vest", "黑色背心", section='clothing', mutex='top', era=['modern'], implies=['vest'], layer='garment'),
        row("jacket on shoulders", "外套披肩", section='clothing', era=['modern'], layer='garment'),
        row("red cape", "紅色披風", section='clothing', mutex='outer', era=['medieval', 'victorian', 'ancient_greece'], implies=['cape'], layer='garment'),
        row("grey shirt", "灰色襯衫／上衣", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("yellow shirt", "黃色襯衫／上衣", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("purple shirt", "紫色襯衫／上衣", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("brown shirt", "棕色襯衫／上衣", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("cropped shirt", "短版襯衫", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("polo shirt", "Polo衫", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("undershirt", "內搭衫", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("tied shirt", "打結上衣", section='clothing', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row("black sweater", "黑色毛衣", section='clothing', mutex='top', era=['modern'], implies=['sweater'], layer='garment'),
        row("black camisole", "黑色細肩帶背心", section='clothing', mutex='top', era=['modern'], implies=['camisole'], gate='female', layer='garment'),
        row("pink panties", "粉紅色內褲", section='clothing', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row("purple panties", "紫色內褲", section='clothing', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row("frilled panties", "荷葉邊內褲", section='clothing', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row("polka dot panties", "圓點內褲", section='clothing', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row("lace panties", "蕾絲內褲", section='clothing', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row("thong panties", "丁字褲（T 字內褲）", section='clothing', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row("bow bra", "蝴蝶結胸罩", section='clothing', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row("lace-trimmed bra", "蕾絲滾邊胸罩", section='clothing', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row("red bra", "紅色胸罩", section='clothing', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row("striped bra", "條紋胸罩", section='clothing', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row("single earring", "單邊耳環", section='clothing', layer='accessory'),
        row("bangle", "手環（硬式）", section='clothing', layer='accessory'),
        row("goggles on head", "護目鏡戴頭上", section='clothing', era=['modern'], layer='accessory'),
        row("straw hat", "草帽", section='clothing', mutex='headwear', layer='accessory'),
        row("mini crown", "迷你王冠", section='clothing', mutex='headwear', layer='accessory'),
        row("headpiece", "裝飾頭具", section='clothing', mutex='headwear', layer='accessory'),
        row("bandana", "頭巾／領巾（bandana）", section='clothing', layer='accessory'),
        row("wristwatch", "腕錶", section='clothing', era=['modern'], layer='accessory'),
        row("hair tie", "綁髮圈", section='clothing', layer='accessory'),
        row("earmuffs", "耳罩（保暖）", section='clothing', era=['modern'], layer='accessory'),
    ]


def extra_round4_other() -> list[dict]:
    """2026-10-24 第四輪第3批。API 核實；只有疑義詞做模型 D/C，見討論區。"""
    def row(tag, zh, section="env", mutex=None, era=None, implies=None, needs=None,
            gate="any", heat=None, layer="normal", mxextra=None):
        out = {"tag": tag, "zh": zh, "section": section, "gate": gate,
               "heat": heat or list(HEATS), "mutex": mutex, "bind": [],
               "implies": implies or [], "layer": layer, "era": era or ["any"],
               "needs": needs or []}
        if mxextra:
            out["mutexExtra"] = mxextra
        return out

    return [
        row("faceless female", "無臉女性", section='feature', needs=['female'], gate='female'),
        row("buzz cut", "平頭／極短推剪頭", section='feature', mutex='hair_style'),
        row("bowl cut", "碗公頭", section='feature', mutex='hair_style'),
        row("inverted bob", "前長後短鮑伯", section='feature', mutex='hair_style'),
        row("front ponytail", "前綁馬尾（垂在胸前）", section='feature', mutex='hair_style', implies=['ponytail']),
        row("high side ponytail", "高位側馬尾", section='feature', mutex='hair_style', implies=['ponytail']),
        row("wide ponytail", "寬幅馬尾", section='feature', mutex='hair_style', implies=['ponytail']),
        row("side braids", "兩側辮子", section='feature', mutex='hair_style', implies=['braid']),
        row("nape braid", "後頸盤辮", section='feature', mutex='hair_style', implies=['braid']),
        row("low-braided long hair", "低位長辮", section='feature', mutex='hair_style', implies=['braid']),
        row("single side bun", "單側丸子頭", section='feature', mutex='hair_style', implies=['hair bun']),
        row("side up bun", "側邊盤髻", section='feature', mutex='hair_style', implies=['hair bun']),
        row("long sidelocks", "長鬢髮", section='feature', implies=['sidelocks']),
        row("drill sidelocks", "螺旋捲鬢髮", section='feature', implies=['sidelocks']),
        row("red streaks", "紅色挑染", section='feature', implies=['streaked hair'], mxextra=['streak_color']),
        row("blue streaks", "藍色挑染", section='feature', implies=['streaked hair'], mxextra=['streak_color']),
        row("black streaks", "黑色挑染", section='feature', implies=['streaked hair'], mxextra=['streak_color']),
        row("pink streaks", "粉紅色挑染", section='feature', implies=['streaked hair'], mxextra=['streak_color']),
        row("fiery hair", "火焰頭髮", section='feature'),
        row("colored sclera", "有色鞏膜", section='feature'),
        row("symbol in eye", "眼中符號", section='feature'),
        row("solid circle eyes", "實心圓眼", section='feature'),
        row("thick eyelashes", "濃密粗睫毛", section='feature'),
        row("horizontal pupils", "橫向瞳孔", section='feature'),
        row("star in eye", "眼中星星", section='feature'),
        row("red sclera", "紅色眼白", section='feature'),
        row("yellow pupils", "黃色瞳孔", section='feature'),
        row("x-shaped pupils", "X 形瞳孔", section='feature'),
        row("whisker markings", "貓鬚紋", section='feature'),
        row("body markings", "身體紋路", section='feature'),
        row("star facial mark", "星形臉部標記", section='feature'),
        row("birthmark", "胎記", section='feature'),
        row("scar on stomach", "腹部疤痕", section='feature'),
        row("scar on chest", "胸口疤痕", section='feature'),
        row("scar on arm", "手臂疤痕", section='feature'),
        row("flower tattoo", "花朵刺青", section='feature', implies=['tattoo']),
        row("shoulder tattoo", "肩膀刺青", section='feature', implies=['tattoo']),
        row("chest tattoo", "胸口刺青", section='feature', implies=['tattoo']),
        row("one-piece tan", "連身泳裝曬痕", section='feature', implies=['tanlines']),
        row("bikini tan", "比基尼曬痕", section='feature', implies=['tanlines']),
        row("cracked skin", "龜裂皮膚", section='feature'),
        row("wrinkled skin", "皺紋皮膚", section='feature'),
        row("very sweaty", "大量流汗", section='feature', implies=['sweat']),
        row("turn pale", "臉色發白", section='feature'),
        row("dirty", "髒污", section='feature'),
        row("dirty face", "臉上髒污", section='feature'),
        row("ear blush", "耳朵泛紅", section='feature'),
        row("purple nails", "紫色指甲", section='feature', gate='female', mxextra=['nail_color']),
        row("green nails", "綠色指甲", section='feature', gate='female', mxextra=['nail_color']),
        row("aqua nails", "水藍色指甲", section='feature', gate='female', mxextra=['nail_color']),
        row("yellow nails", "黃色指甲", section='feature', gate='female', mxextra=['nail_color']),
        row("orange nails", "橘色指甲", section='feature', gate='female', mxextra=['nail_color']),
        row("white nails", "白色指甲", section='feature', gate='female', mxextra=['nail_color']),
        row("multicolored nails", "多色指甲", section='feature', gate='female', mxextra=['nail_color']),
        row("nail art", "美甲彩繪", section='feature', gate='female'),
        row("red eyeliner", "紅色眼線", section='feature', gate='female'),
        row("sharp fingernails", "尖指甲", section='feature', gate='female'),
        row("toned female", "健美女性", section='feature', implies=['toned'], gate='female'),
        row("hip bones", "髖骨突出", section='feature'),
        row("armpit crease", "腋下摺痕", section='feature'),
        row("armpit peek", "腋下一瞥", section='feature'),
        row("perky breasts", "上翹胸型", section='feature', gate='female'),
        row("full cleavage", "完整乳溝", section='feature', gate='female'),
        row("framed breasts", "被衣料框住的胸部", section='feature', gate='female'),
        row("bursting breasts", "爆乳（衣服撐裂）", section='pose', gate='female', heat=['flash', 'sex']),
        row("butt crack", "臀溝外露", section='pose', heat=['flash', 'sex']),
        row("hair over breasts", "長髮覆胸", section='feature', gate='female'),
        row("large pectorals", "大胸肌", section='feature', needs=['male'], gate='male'),
        row("bare pectorals", "裸露胸肌", section='feature', needs=['male'], gate='male'),
        row("muscular arms", "肌肉手臂", section='feature'),
        row("veiny arms", "手臂青筋", section='feature'),
        row("linea alba", "腹白線", section='feature'),
        row("body hair", "體毛", section='feature', needs=['male'], gate='male'),
        row("armpit hair", "腋毛", section='feature', needs=['male'], gate='male'),
        row("sideburns", "鬢角", section='feature', needs=['male'], gate='male'),
        row("full beard", "滿臉鬍子", section='feature', needs=['male'], gate='male'),
        row("beard stubble", "短鬍渣", section='feature', needs=['male'], gate='male'),
        row("disembodied penis", "飄浮陰莖", section='feature', implies=['penis'], needs=['male'], gate='male', heat=['sex']),
        row("girthy penis", "粗陰莖", section='feature', implies=['penis'], needs=['male'], gate='male', heat=['sex']),
        row("clitoral hood", "陰核包皮", section='feature', needs=['female'], gate='female', heat=['sex']),
        row("no pussy", "未畫外陰", section='feature', needs=['female'], gate='female', heat=['sex']),
        row("partially visible vulva", "外陰部分露出", section='feature', needs=['female'], gate='female', heat=['sex']),
        row("fat mons", "豐厚恥丘", section='feature', needs=['female'], gate='female', heat=['sex']),
        row("anus peek", "肛門微露", section='feature', heat=['sex']),
        row("urethra", "尿道口", section='feature', heat=['sex']),
        row("pubic hair peek", "陰毛露出", section='feature', heat=['sex']),
        row("colored pubic hair", "彩色陰毛", section='feature', heat=['sex']),
        row("sailor", "水手", section='feature', mutex='job', era=['modern']),
        row("shinsengumi", "新選組", section='feature', mutex='job', era=['edo']),
        row("nontraditional miko", "改良式巫女服", section='clothing', mutex='onepiece', era=['edo', 'modern'], implies=['miko'], gate='female', layer='garment'),
        row("nontraditional playboy bunny", "非傳統兔女郎", section='clothing', mutex='onepiece', era=['modern'], implies=['playboy bunny'], gate='female', layer='garment'),
        row("wa maid", "和風女僕", section='clothing', mutex='onepiece', era=['edo', 'modern'], gate='female', layer='garment'),
        row("male maid", "男性女僕", section='clothing', mutex='onepiece', era=['victorian', 'modern'], needs=['male'], gate='male', layer='garment'),
        row("unconventional maid", "非典型女僕", section='clothing', mutex='onepiece', era=['victorian', 'modern'], implies=['maid'], gate='female', layer='garment'),
        row("roswaal mansion maid uniform", "羅茲瓦爾宅女僕服", section='clothing', mutex='onepiece', era=['victorian', 'modern'], implies=['maid'], gate='female', layer='garment'),
        row("employee uniform", "店員制服", section='clothing', mutex='onepiece', era=['modern'], layer='garment'),
        row("enmaided", "女僕裝扮（原作非女僕）", section='clothing', era=['modern'], layer='garment'),
        row("viera", "維耶拉族", section='feature', mutex='race', gate='female'),
        row("plant girl", "植物娘", section='feature', mutex='race', gate='female'),
        row("fish girl", "魚娘", section='feature', mutex='race', gate='female'),
        row("shark girl", "鯊魚娘", section='feature', mutex='race', gate='female'),
        row("miqo'te", "貓魅族", section='feature', mutex='race', gate='female'),
        row("tiger girl", "虎娘", section='feature', mutex='race', gate='female'),
        row("lion girl", "獅娘", section='feature', mutex='race', gate='female'),
        row("merfolk", "人魚族", section='feature', mutex='race'),
        row("fins", "鰭", section='feature'),
        row("antennae", "觸角", section='feature'),
        row("waking up", "睡醒", section='pose', mutex='activity'),
        row("dressing", "穿衣服", section='pose', mutex='activity'),
        row("playing with own hair", "玩弄自己的頭髮", section='pose', mutex='activity'),
        row("unsheathing", "拔刀（出鞘）", section='pose', mutex='activity'),
        row("drawing bow", "拉弓", section='pose', mutex='activity', implies=['bow (weapon)']),
        row("petting", "撫摸（動物）", section='pose'),
        row("soaking feet", "泡腳", section='pose', mutex='activity'),
        row("sleeping upright", "坐/站著睡", section='pose', mutex='body_pose', implies=['sleeping'], heat=['tease', 'flash']),
        row("adjusting swimsuit", "整理泳衣", section='pose'),
        row("carrying over shoulder", "扛著他人", section='pose', needs=['pair']),
        row("spread arms", "雙臂張開", section='pose', mutex='body_pose'),
        row("legs together", "雙腿併攏", section='pose', mutex='body_pose'),
        row("feet up", "雙腳抬起", section='pose', mutex='body_pose'),
        row("hands on own face", "雙手摸自己的臉", section='pose'),
        row("hand on own head", "單手放自己頭上", section='pose'),
        row("hand to own mouth", "手靠近嘴邊", section='pose'),
        row("hands on own cheeks", "雙手捧自己臉頰", section='pose'),
        row("hands on own head", "雙手抱頭", section='pose'),
        row("open hands", "雙手張開", section='pose'),
        row("hand over own mouth", "用手摀嘴", section='pose'),
        row("partially underwater shot", "半水下視角", section='pose', mutex='camera'),
        row("pov across table", "隔桌視角", section='pose', mutex='camera'),
        row("aiming at viewer", "瞄準觀者", section='pose', mutex='camera'),
        row("female pov", "女性第一人稱視角", section='pose', mutex='camera'),
        row("facing to the side", "臉朝側邊", section='pose', mutex='camera'),
        row("other focus", "以性別不明角色為主", section='pose', mutex='camera'),
        row("zoom layer", "放大圖層", section='pose'),
        row("pillarboxed", "左右色條（柱狀框）", section='pose'),
        row("chibi inset", "Q 版插入小圖", section='pose'),
        row("reference inset", "參考圖插入", section='pose'),
        row("light frown", "淡淡皺眉", section='pose', mutex='expression'),
        row("scowl", "怒瞪皺眉", section='pose', mutex='expression'),
        row("disgust", "厭惡", section='pose', mutex='expression'),
        row("unamused", "無言（不為所動）", section='pose', mutex='expression'),
        row("confused", "困惑", section='pose', mutex='expression'),
        row("grimace", "扭曲臉（齜牙苦臉）", section='pose', mutex='expression'),
        row("evil grin", "邪惡獰笑", section='pose', mutex='expression'),
        row("wiping tears", "擦眼淚", section='pose', implies=['tears']),
        row("streaming tears", "兩行淚（瀑布淚）", section='pose', implies=['tears']),
        row("puckered lips", "嘟嘴（索吻）", section='pose', mutex='expression'),
        row("looking at animal", "看著動物", section='pose', mutex='gaze'),
        row("looking over eyewear", "從鏡框上方看", section='pose', mutex='gaze'),
        row("staring", "凝視", section='pose', mutex='gaze'),
        row("upturned eyes", "上目使い（眼睛向上看）", section='pose', mutex='gaze'),
        row("midriff peek", "腰腹微露", section='pose'),
        row("bra peek", "胸罩微露", section='pose'),
        row("panty peek", "內褲邊露出", section='pose'),
        row("strap gap", "肩帶空隙", section='pose'),
        row("button gap", "鈕釦縫隙", section='pose'),
        row("crop top overhang", "短上衣下擺外懸", section='pose'),
        row("pantylines", "內褲痕", section='pose'),
        row("plunging neckline", "深V領口", section='pose'),
        row("necktie between breasts", "領帶夾在乳溝", section='pose', gate='female'),
        row("breast curtains", "胸簾", section='clothing', mutex='top', gate='female', layer='garment'),
        row("breast slip", "胸部滑出", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("bikini top lift", "掀起比基尼上衣", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("untied bikini top", "比基尼上衣鬆開", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("untied bikini bottom", "比基尼下身鬆開", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("bikini bottom pull", "拉下比基尼下身", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("skirt pull", "拉下裙子", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("shorts pull", "拉下短褲", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("pantyhose pull", "拉下褲襪", section='pose', mutex='clothes_action', heat=['flash', 'sex']),
        row("partially unzipped", "拉鍊半開", section='clothing', era=['modern'], layer='garment'),
        row("open hoodie", "敞開連帽衫", section='clothing', mutex='top', era=['modern'], implies=['hoodie'], layer='garment'),
        row("caressing testicles", "撫摸睪丸", section='pose', needs=['male', 'pair'], heat=['sex']),
        row("gloved handjob", "戴手套手交", section='pose', mutex='sex_act', implies=['handjob'], needs=['male', 'pair'], heat=['sex']),
        row("two-footed footjob", "雙足足交", section='pose', mutex='sex_act', implies=['footjob'], needs=['male', 'pair'], heat=['sex']),
        row("cooperative fellatio", "合作口交", section='pose', mutex='sex_act', implies=['fellatio'], needs=['male', 'group'], heat=['sex']),
        row("clitoral stimulation", "刺激陰核", section='pose', needs=['female'], gate='female', heat=['sex']),
        row("female orgasm", "女性高潮", section='pose', needs=['female'], gate='female', heat=['sex']),
        row("fellatio gesture", "口交手勢", section='pose', heat=['sex']),
        row("hitachi magic wand", "日立魔杖按摩棒", section='pose', era=['modern'], heat=['sex']),
        row("vibrator under clothes", "衣內跳蛋", section='pose', era=['modern'], needs=['female'], gate='female', heat=['sex']),
        row("toon (style)", "卡通風格", section='quality'),
        row("faux traditional media", "仿傳統媒材", section='quality'),
        row("outline", "外框描邊", section='quality'),
        row("white outline", "白色描邊", section='quality'),
        row("hatching (texture)", "排線陰影", section='quality'),
        row("no lineart", "無線稿", section='quality'),
        row("official alternate hair color", "官方替代髮色", section='feature'),
        row("alternate eye color", "替代眼色", section='feature'),
        row("alternate skin color", "替代膚色", section='feature'),
    ]


def extra_character_tags() -> list[dict]:
    """characters.json 裡 character_ban 為 false 的角色。被 ban 的不進詞庫。

    角色之間不互斥：一張圖可以釘好幾個。髮色髮型瞳色的互斥由 Opus 在引擎做，
    這裡不寫 mutexExtra，不然兩個角色會搶同一格。
    """
    rows = []
    for c in load_characters():
        if c.get("character_ban") is not False:
            continue
        gender = c.get("gender")
        if gender not in ("female", "male"):
            raise SystemExit(f"角色性別必須是 female 或 male：{c.get('tag')}")
        tag = str(c.get("tag") or "").strip()
        series = str(c.get("series") or "").strip()
        # 細分類照作品分（專案主 2026-10-10：要能照動畫、遊戲名稱找）。
        sub = character_sub_id(series)
        card_positive = str(c.get("cardPositive") or "").strip()
        if not tag or not series or not card_positive:
            raise SystemExit(f"角色缺 tag／series／cardPositive：{tag}")
        rows.append({
            "tag": tag,
            "zh": c.get("zh") or "",
            "section": "subject",
            "group": "character",
            "sub": sub,
            "gate": gender,
            "needs": [gender],
            "heat": ["tease", "flash", "sex"],
            "mutex": None,
            "bind": [],
            "implies": [],
            "layer": "normal",
            "era": ["any"],
            "series": series,
            "cardPositive": card_positive,
        })
    return rows


def character_ban_tags() -> list[str]:
    """被 ban 的角色 tag。排序、去重，寫進 lexicon 頂層 characterBan。"""
    tags = []
    for c in load_characters():
        if c.get("character_ban") is not True:
            continue
        tag = str(c.get("tag") or "").strip().lower().replace("_", " ")
        if tag:
            tags.append(tag)
    return sorted(set(tags))


def extra_suggestion_tags() -> list[dict]:
    """general_tags_suggestions.csv（2026-10-12）。

    欄位是從同組抄來的，不照 CSV 的類別。逐項重看過 gate、mutex、implies、時代。
    """
    from suggestion_tags import build
    return build()


def extra_more_tags() -> list[dict]:
    """more_general_tags.csv（2026-10-12）。不讀 CSV，不照它的類別。"""
    from more_tags import build
    return build()


def extra_focus_tags() -> list[dict]:
    """focus_tags.csv（2026-10-12）。部位焦點與主題焦點各一格，不佔鏡頭。"""
    from focus_tags import build
    return build()


ALT_NAMES = Path(__file__).with_name("alt_names.json")


def add_alt_names(unique: list[dict]) -> list[dict]:
    """同一個概念的另一個名字（scripts/alt_names.json）：照原卡複製一份、只換字，擺在原卡後面。

    2026-10-14 專案主決定：底模（WAI v17）實測畫不出來的字不刪，改成把 Danbooru 併掉的舊名
    （模型訓練時多半看到的是舊名）和實測畫得出來的替代字一起加進來。中文名跟原卡一樣，
    字盒裡兩張並排；兩張都抽得到（mutex 照抄：同一格的字一張圖只會有一個）。
    角色卡的 cardPositive 跟著換成新的名字。
    """
    pairs = json.loads(ALT_NAMES.read_text(encoding="utf-8")).get("pairs") or []
    index = {t["tag"]: i for i, t in enumerate(unique)}
    after: dict[int, list[dict]] = {}
    seen_alt: set[str] = set()
    # keep: "alt"（Grok 實測只認新名的那幾組）：只留新名字那張，原卡拿掉；舊存檔裡的原名由
    # lexicon.json 的 renamed 換成新名（web6/tag-renames.js、card_usage.py）。
    replaced: set[int] = set()
    for p in pairs:
        src, alt = p["tag"], p["alt"]
        if src not in index:
            raise SystemExit(f"alt_names.json：「{src}」不在詞庫，不能加它的另一個名字「{alt}」")
        if alt in index or alt in seen_alt:
            raise SystemExit(f"alt_names.json：「{alt}」已經在詞庫了")
        seen_alt.add(alt)
        base = unique[index[src]]
        clone = json.loads(json.dumps(base, ensure_ascii=False))
        clone["tag"] = alt
        if p.get("keep") == "alt":
            clone["replaces"] = src
            replaced.add(index[src])
        else:
            clone["altOf"] = src
        if clone.get("cardPositive"):
            clone["cardPositive"] = ", ".join(alt if x.strip() == src else x.strip() for x in clone["cardPositive"].split(","))
        after.setdefault(index[src], []).append(clone)
    out: list[dict] = []
    for i, t in enumerate(unique):
        if i not in replaced:
            out.append(t)
        out.extend(after.get(i, []))
    return out


def renamed_by_alt_names() -> dict[str, str]:
    """keep: "alt" 的那幾組：原名 -> 留下來的新名。"""
    pairs = json.loads(ALT_NAMES.read_text(encoding="utf-8")).get("pairs") or []
    return {p["tag"]: p["alt"] for p in pairs if p.get("keep") == "alt"}




def extra_suggestion_1500() -> list[dict]:
    """2026-10-24 more_suggestions_1500 與 extra_pool_zh。

    Danbooru 一般標籤、未停用、有貼文。空列、style parody、hugging doll 不收。
    會改版面或可能畫成未成年人的字先不進這一批，等模型 D/C。
    圖測通過的 12 個字補在這份清單最後。
    """
    def row(tag, zh, section, group, sub, mutex=None, era=None, implies=None, needs=None,
            gate="any", heat=None, layer="normal", mxextra=None):
        out = {"tag": tag, "zh": zh, "section": section, "group": group, "sub": sub,
               "gate": gate, "heat": heat or list(HEATS), "mutex": mutex, "bind": [],
               "implies": implies or [], "layer": layer, "era": era or ["any"],
               "needs": needs or []}
        if mxextra:
            out["mutexExtra"] = mxextra
        return out

    return [
        row('genderswap (mtf)', '男變女（性轉）', 'feature', 'other', 'persona', implies=['genderswap']),
        row('genderswap (ftm)', '女變男（性轉）', 'feature', 'other', 'persona', implies=['genderswap']),
        row('crossdressing', '異性裝扮（女裝/男裝）', 'feature', 'other', 'persona'),
        row('furry female', '獸人（女性）', 'feature', 'race', 'race_kemono', mutex='race', gate='female'),
        row('furry male', '獸人（男性）', 'feature', 'race', 'race_kemono', mutex='race', gate='male'),
        row('long hair between eyes', '雙眼間長瀏海', 'feature', 'hair_style', 'hair_detail', implies=['hair between eyes']),
        row('hairpods', '金屬髮包', 'feature', 'hair_style', 'hair_shape'),
        row('bun cover', '包子頭髮罩', 'feature', 'hair_style', 'wear_bits'),
        row('quad tails', '四條馬尾', 'feature', 'hair_style', 'hair_shape', mutex='hair_style'),
        row('tri tails', '三條馬尾', 'feature', 'hair_style', 'hair_shape', mutex='hair_style'),
        row('ringlets', '螺旋捲髮', 'feature', 'hair_style', 'hair_shape', mutex='hair_style'),
        row('pointy hair', '尖刺髮', 'feature', 'hair_style', 'hair_shape', mutex='hair_style'),
        row('cowlick', '翹毛／亂翹髮', 'feature', 'hair_style', 'hair_detail'),
        row('diagonal bangs', '斜切瀏海', 'feature', 'hair_style', 'hair_detail'),
        row('arched bangs', '拱形瀏海', 'feature', 'hair_style', 'hair_detail'),
        row('short bangs', '短瀏海', 'feature', 'hair_style', 'hair_detail'),
        row('blue pupils', '藍色瞳孔', 'feature', 'eyes', 'eye_shape'),
        row('uneven eyes', '大小眼', 'feature', 'eyes', 'eye_shape'),
        row('forked eyebrows', '分岔眉', 'feature', 'eyes', 'eye_shape'),
        row('curly eyebrows', '捲眉', 'feature', 'eyes', 'eye_shape'),
        row('huge eyebrows', '超粗眉', 'feature', 'eyes', 'eye_shape'),
        row('eyebrow cut', '眉毛刮痕（剃眉紋）', 'feature', 'eyes', 'eye_shape'),
        row('mismatched eyebrows', '眉色與髮色不同', 'feature', 'eyes', 'eye_shape'),
        row('drop-shaped pupils', '水滴形瞳孔', 'feature', 'eyes', 'eye_shape'),
        row('rabbit-shaped pupils', '兔子形瞳孔', 'feature', 'eyes', 'eye_shape'),
        row('power symbol-shaped pupils', '電源符號形瞳孔', 'feature', 'eyes', 'eye_shape'),
        row('single horn', '獨角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('curled horns', '捲角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('black horns', '黑色角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('red horns', '紅色角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('multiple horns', '多角（三根以上）', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('antlers', '鹿角', 'feature', 'other', 'nonhuman'),
        row('fiery horns', '火焰角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('cone horns', '圓錐角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('asymmetrical horns', '不對稱角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('uneven horns', '長短角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('cross scar', '十字疤痕', 'feature', 'skin', 'skin_mark'),
        row('scar on forehead', '額頭疤痕', 'feature', 'skin', 'skin_mark'),
        row('scar on neck', '頸部疤痕', 'feature', 'skin', 'skin_mark'),
        row('scar on mouth', '嘴部疤痕', 'feature', 'skin', 'skin_mark'),
        row('burn scar', '燒傷疤痕', 'feature', 'skin', 'skin_mark'),
        row('scar across eye', '橫過眼睛的疤痕', 'feature', 'skin', 'skin_mark'),
        row('stitches', '縫線', 'feature', 'skin', 'skin_mark'),
        row('scratches', '擦傷／抓痕', 'feature', 'skin', 'skin_mark'),
        row('bandaid on leg', '腿上貼OK繃', 'feature', 'skin', 'skin_mark', implies=['bandaid']),
        row('bandaid on arm', '手臂貼OK繃', 'feature', 'skin', 'skin_mark', implies=['bandaid']),
        row('heart facial mark', '愛心臉部印記', 'feature', 'skin', 'tattoo'),
        row('crescent facial mark', '月牙臉部印記', 'feature', 'skin', 'tattoo'),
        row('teardrop facial mark', '淚滴臉部印記', 'feature', 'skin', 'tattoo'),
        row('grey nails', '灰色指甲', 'feature', 'makeup', 'makeup', gate='female', mxextra=['nail_color']),
        row('very long fingernails', '超長指甲', 'feature', 'makeup', 'makeup', gate='female'),
        row('lipstick tube', '口紅管', 'env', 'other', 'obj_hand', era=['modern']),
        row('legs', '腿部特寫', 'feature', 'body_f', 'body_part'),
        row('feet', '腳部特寫', 'feature', 'body_f', 'body_part'),
        row('toes', '腳趾', 'feature', 'body_f', 'body_part'),
        row('back', '背部', 'feature', 'body_f', 'body_part'),
        row('knees', '膝蓋', 'feature', 'body_f', 'body_part'),
        row('toenails', '腳趾甲', 'feature', 'body_f', 'body_part'),
        row('kneepits', '膝窩', 'feature', 'body_f', 'body_part'),
        row('nape', '後頸', 'feature', 'body_f', 'body_part'),
        row('obliques', '腹斜肌', 'feature', 'body_f', 'body_part'),
        row('dimples of venus', '維納斯腰窩', 'feature', 'body_f', 'body_part'),
        row('long beard', '長鬍子', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('thick beard', '濃密鬍鬚', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('thick mustache', '濃密八字鬍', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('sideburns stubble', '鬢角鬍渣', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('mustache stubble', '上唇鬍渣', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('goatee stubble', '山羊鬍鬍渣', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('strongman waist', '力士腰（粗壯腰身）', 'feature', 'body_m', 'bm_build', gate='male'),
        row('sidepec', '側胸肌', 'feature', 'body_m', 'bm_build', gate='male'),
        row('manly', '男子氣概', 'feature', 'body_m', 'bm_build', gate='male'),
        row('hairy', '多毛（體毛）', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('futa with female', '扶她×女性', 'pose', 'sex', 'sex_group', implies=['futanari'], needs=['2female'], gate='female', heat=['sex']),
        row('futa with male', '扶她×男性', 'pose', 'sex', 'sex_group', implies=['futanari'], needs=['male', 'female', 'pair'], gate='female', heat=['sex']),
        row('futa with futa', '扶她×扶她', 'pose', 'sex', 'sex_group', implies=['futanari'], needs=['2female'], gate='female', heat=['sex']),
        row('full-package futanari', '全套扶她（陰道+陰莖+睪丸）', 'feature', 'body_f', 'bf_intimate', implies=['futanari'], gate='female', heat=['sex']),
        row('puckered anus', '肛門皺褶', 'feature', 'body_f', 'bf_intimate', heat=['sex']),
        row('dark anus', '深色肛門', 'feature', 'body_f', 'bf_intimate', heat=['sex']),
        row('utaite', '歌い手（網路翻唱歌手）', 'feature', 'job', 'job_modern', mutex='job', era=['modern']),
        row('draph', '德拉夫（碧藍幻想種族）', 'feature', 'race', 'race_fantasy', mutex='race'),
        row('erune', '愛爾恩（碧藍幻想種族）', 'feature', 'race', 'race_fantasy', mutex='race'),
        row('hyur', '人族（FF14）', 'feature', 'race', 'race_fantasy', mutex='race'),
        row('au ra', '奧拉族（FF14）', 'feature', 'race', 'race_fantasy', mutex='race'),
        row('mithra (ff11)', '密斯拉（FF11）', 'feature', 'race', 'race_fantasy', mutex='race'),
        row('taur', '半人馬型（taur）', 'feature', 'race', 'race_fantasy', mutex='race'),
        row('drying', '擦乾', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('wiping face', '擦臉', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('wiping sweat', '擦汗', 'pose', 'activity', 'act_daily', mutex='activity'),
        row("brushing another's hair", '幫別人梳頭', 'pose', 'activity', 'act_daily', mutex='activity', needs=['pair']),
        row('sleeping on person', '靠著別人睡', 'pose', 'activity', 'act_daily', mutex='activity', needs=['pair']),
        row('shared food', '共吃同一條食物', 'pose', 'activity', 'act_daily', mutex='activity', implies=['food'], needs=['pair']),
        row('chewing', '咀嚼', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('tickling', '搔癢', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('chasing', '追逐', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('fleeing', '逃跑', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('hands on own knees', '雙手放膝蓋', 'pose', 'tease', 'pose_hand'),
        row('hands on lap', '手放腿上', 'pose', 'tease', 'pose_hand'),
        row('hand on own stomach', '單手放肚子', 'pose', 'tease', 'pose_hand'),
        row('hands on feet', '手放腳上', 'pose', 'tease', 'pose_hand'),
        row('sidesaddle', '側坐（側鞍）', 'pose', 'body', 'body', mutex='body_pose'),
        row('legs folded', '腿折疊', 'pose', 'body', 'body', mutex='body_pose'),
        row('leg between thighs', '腿夾在對方大腿間', 'pose', 'tease', 'pose_two', needs=['pair']),
        row('head down', '低頭', 'pose', 'body', 'body'),
        row('on lap', '（動物）在腿上', 'pose', 'other', 'pose_stance'),
        row('lying on person', '躺在別人身上', 'pose', 'tease', 'pose_two', needs=['pair']),
        row('doyagao', '得意臉（ドヤ顏）', 'pose', 'face', 'face_mood', mutex='expression'),
        row('gloom (expression)', '陰沉消沉表情', 'pose', 'face', 'face_mood', mutex='expression'),
        row('false smile', '假笑', 'pose', 'face', 'face_mood', mutex='expression'),
        row('completely unamused', '完全無言／不為所動', 'pose', 'face', 'face_mood', mutex='expression'),
        row('screaming', '尖叫', 'pose', 'face', 'face_mood', mutex='expression'),
        row('happy tears', '開心的淚水', 'pose', 'face', 'face_mood', mutex='expression', implies=['tears']),
        row('jealous', '吃醋', 'pose', 'face', 'face_mood', mutex='expression'),
        row('worried', '擔心', 'pose', 'face', 'face_mood', mutex='expression'),
        row('sigh', '嘆氣', 'pose', 'face', 'face_mood', mutex='expression'),
        row('dot mouth', '點狀嘴', 'pose', 'face', 'face_mouth', mutex='expression'),
        row('blank stare', '呆滯眼神', 'pose', 'gaze', 'gaze', mutex='gaze'),
        row('rubbing eyes', '揉眼睛', 'pose', 'tease', 'pose_act'),
        row('covered eyes', '眼睛被遮住', 'pose', 'gaze', 'gaze'),
        row('pulling own clothes', '拉自己的衣服', 'pose', 'tease', 'pose_hand'),
        row('convenient leg', '腿部遮擋（方便腿）', 'pose', 'tease', 'pose_situ'),
        row('convenient arm', '手臂遮擋（方便手）', 'pose', 'tease', 'pose_situ'),
        row('shoe dangle', '腳尖掛鞋晃', 'pose', 'tease', 'pose_hand'),
        row('grabbing own ass', '抓自己的屁股', 'pose', 'tease', 'pose_hand'),
        row('hands on own ass', '雙手放自己屁股上', 'pose', 'tease', 'pose_hand'),
        row('tucking hair', '把頭髮撥開／別到耳後', 'pose', 'tease', 'pose_hand'),
        row('hair lift', '撩起頭髮', 'pose', 'tease', 'pose_hand'),
        row('brushing hair', '梳頭髮', 'pose', 'tease', 'pose_hand'),
        row('hands in own hair', '雙手插進自己頭髮', 'pose', 'tease', 'pose_hand'),
        row('wide spread legs', '大開雙腿', 'pose', 'flash', 'flash_pose', heat=['flash', 'sex']),
        row('spread pussy under clothes', '隔著衣物掰開私處', 'pose', 'flash', 'flash_expose', gate='female', heat=['flash', 'sex']),
        row('covering nipples', '手遮乳頭', 'pose', 'flash', 'flash_expose', gate='female', heat=['flash', 'sex'], mxextra=['nipple_show', 'hand_g']),
        row('clothes down', '衣服拉到手肘', 'pose', 'flash', 'flash_lift', mutex='clothes_action', heat=['flash', 'sex']),
        row('spread toes', '腳趾張開', 'pose', 'tease', 'pose_act'),
        row('crotch rub', '磨蹭下體', 'pose', 'sex', 'sex_touch', mutex='sex_act', needs=['pair'], heat=['sex']),
        row('reach-around', '從背後環抱撫弄', 'pose', 'sex', 'sex_touch', needs=['pair'], heat=['sex']),
        row('ejaculating while penetrated', '被插入時射精', 'pose', 'sex', 'sex_pos', needs=['male', 'pair'], heat=['sex']),
        row('cum on male', '男性身上的精液', 'pose', 'sex', 'sex_pos', implies=['cum'], needs=['male'], heat=['sex']),
        row('male penetrated', '男性被插入', 'pose', 'sex', 'sex_pos', mutex='sex_act', needs=['pair', 'male'], heat=['sex']),
        row('vibrator under panties', '內褲內的跳蛋', 'pose', 'sex', 'sex_touch', era=['modern'], implies=['panties'], gate='female', heat=['sex']),
        row("hand in another's panties", '手伸進他人內褲', 'pose', 'sex', 'sex_touch', era=['modern'], needs=['pair'], gate='female', heat=['flash', 'sex']),
        row('anal object insertion', '肛門異物插入', 'pose', 'sex', 'sex_pos', mutex='sex_act', heat=['sex']),
        row('cum on self', '射在自己身上', 'pose', 'sex', 'sex_pos', implies=['cum'], heat=['sex']),
        row('red bow', '紅色蝴蝶結', 'clothing', 'acc', 'acc_bow', implies=['bow'], layer='accessory'),
        row('red ribbon', '紅色緞帶', 'clothing', 'acc', 'acc_bow', implies=['ribbon'], layer='accessory'),
        row('black bow', '黑色蝴蝶結', 'clothing', 'acc', 'acc_bow', implies=['bow'], layer='accessory'),
        row('black ribbon', '黑色緞帶', 'clothing', 'acc', 'acc_bow', implies=['ribbon'], layer='accessory'),
        row('blue bow', '藍色蝴蝶結', 'clothing', 'acc', 'acc_bow', implies=['bow'], layer='accessory'),
        row('white bow', '白色蝴蝶結', 'clothing', 'acc', 'acc_bow', implies=['bow'], layer='accessory'),
        row('pink bow', '粉紅色蝴蝶結', 'clothing', 'acc', 'acc_bow', implies=['bow'], layer='accessory'),
        row('black hairband', '黑色髮箍', 'clothing', 'acc', 'acc_head', implies=['hairband'], layer='accessory'),
        row('white hairband', '白色髮箍', 'clothing', 'acc', 'acc_head', implies=['hairband'], layer='accessory'),
        row('red hairband', '紅色髮箍', 'clothing', 'acc', 'acc_head', implies=['hairband'], layer='accessory'),
        row('red shorts', '紅色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('grey shorts', '灰色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('brown shorts', '棕色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('green shorts', '綠色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('purple shorts', '紫色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('pink shorts', '粉紅色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('yellow shorts', '黃色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('orange shorts', '橘色短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('striped shorts', '條紋短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('suspender shorts', '吊帶短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('tate eboshi', '立烏帽子', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['edo'], implies=['hat'], layer='accessory'),
        row('kote', '籠手（日式臂甲）', 'clothing', 'era', 'era_jp', era=['edo'], layer='accessory'),
        row('yugake', '弓道手套（弽）', 'clothing', 'era', 'era_jp', era=['edo'], layer='accessory'),
        row('kesa', '袈裟', 'clothing', 'era', 'era_jp', era=['edo', 'modern'], layer='garment'),
        row('kusazuri', '草摺（日式裙甲）', 'clothing', 'era', 'era_jp', era=['edo'], layer='garment'),
        row('sode', '袖（武士肩甲）', 'clothing', 'era', 'era_jp', era=['edo'], layer='accessory'),
        row('faulds', '腰甲', 'clothing', 'era', 'era_west', era=['medieval'], layer='garment'),
        row('muneate', '胸當（弓道護胸）', 'clothing', 'era', 'era_jp', era=['edo'], layer='garment'),
        row('hachimaki', '頭巾／鉢卷', 'clothing', 'era', 'era_jp', mutex='headwear', era=['edo', 'modern'], layer='accessory'),
        row('ajirogasa', '網代笠', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['edo'], implies=['hat'], layer='accessory'),
        row('gradient clothes', '漸層服飾', 'clothing', 'fabric', 'fab_material', layer='garment'),
        row('two-sided fabric', '雙面布料', 'clothing', 'fabric', 'fab_material', layer='garment'),
        row('diagonal-striped clothes', '斜條紋服飾', 'clothing', 'fabric', 'fab_material', layer='garment'),
        row('fur-trimmed cape', '毛皮滾邊披風', 'clothing', 'fabric', 'fab_material', implies=['cape'], layer='garment'),
        row('fur-trimmed dress', '毛皮滾邊洋裝', 'clothing', 'fabric', 'fab_material', implies=['dress'], layer='garment'),
        row('fur-trimmed boots', '毛皮滾邊靴', 'clothing', 'feet', 'feet', mutex='feet', era=['medieval', 'victorian', 'modern'], implies=['boots'], layer='garment'),
        row('fur-trimmed capelet', '毛皮滾邊小披肩', 'clothing', 'fabric', 'fab_material', layer='garment'),
        row('cable knit', '麻花針織', 'clothing', 'fabric', 'fab_material', era=['modern'], layer='garment'),
        row('feather trim', '羽毛滾邊', 'clothing', 'fabric', 'fab_material', layer='garment'),
        row('fringe trim', '流蘇邊飾', 'clothing', 'fabric', 'fab_material', layer='garment'),
        row('blue shoes', '藍色鞋子', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('pink shoes', '粉紅色鞋子', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('yellow shoes', '黃色鞋子', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('green shoes', '綠色鞋子', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('orange shoes', '橘色鞋子', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('purple shoes', '紫色鞋子', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('grey shoes', '灰色鞋子', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('red boots', '紅色靴子', 'clothing', 'feet', 'feet', mutex='feet', era=['medieval', 'victorian', 'modern'], implies=['boots'], layer='garment'),
        row('blue boots', '藍色靴子', 'clothing', 'feet', 'feet', mutex='feet', era=['medieval', 'victorian', 'modern'], implies=['boots'], layer='garment'),
        row('pink boots', '粉紅色靴子', 'clothing', 'feet', 'feet', mutex='feet', era=['medieval', 'victorian', 'modern'], implies=['boots'], layer='garment'),
        row('purple thighhighs', '紫色過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('blue thighhighs', '藍色過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('pink thighhighs', '粉紅色過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('yellow thighhighs', '黃色過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('green thighhighs', '綠色過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('orange thighhighs', '橘色過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('striped pantyhose', '條紋褲襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row('purple pantyhose', '紫色褲襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row('pink pantyhose', '粉紅色褲襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row('blue pantyhose', '藍色褲襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row('clothed female nude female', '著衣女×裸體女', 'pose', 'flash', 'flash_pose', needs=['2female'], heat=['flash', 'sex']),
        row('brown dress', '棕色洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('grey dress', '灰色洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('yellow dress', '黃色洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('striped dress', '條紋洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('two-tone dress', '雙色洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('orange dress', '橘色洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('aqua dress', '水藍色洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('plaid dress', '格紋洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('polka dot dress', '圓點洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('print dress', '印花洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('pink jacket', '粉紅色外套（夾克）', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row('yellow jacket', '黃色外套（夾克）', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row('purple jacket', '紫色外套（夾克）', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row('orange jacket', '橘色外套（夾克）', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row('red coat', '紅色大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('blue coat', '藍色大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('pink coat', '粉紅色大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('grey coat', '灰色大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('green coat', '綠色大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('yellow coat', '黃色大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('bare back', '裸背', 'clothing', 'top', 'top_tank', layer='garment'),
        row('single bare shoulder', '單肩露出', 'clothing', 'top', 'top_tank', layer='garment'),
        row('taut shirt', '繃緊的上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('tight shirt', '緊身上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('plaid shirt', '格紋襯衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('pinstripe shirt', '細條紋襯衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('orange shirt', '橘色上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('long shirt', '長版上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('ribbed shirt', '羅紋上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('impossible shirt', '貼胸（不可能）襯衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('green panties', '綠色內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('aqua panties', '水藍色內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('yellow panties', '黃色內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('orange panties', '橘色內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('grey panties', '灰色內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('print panties', '印花內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('bow panties', '蝴蝶結內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('purple bra', '紫色胸罩', 'clothing', 'underwear', 'uw_top', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row('green bra', '綠色胸罩', 'clothing', 'underwear', 'uw_top', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row('grey bra', '灰色胸罩', 'clothing', 'underwear', 'uw_top', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row('spill', '灑出的液體', 'env', 'effect', 'fx_fall'),
        row('spilling', '潑灑／灑出', 'env', 'effect', 'fx_fall'),
        row('melting', '融化', 'env', 'effect', 'fx_fall'),
        row('shards', '碎片', 'env', 'effect', 'fx_fall'),
        row('debris', '碎屑', 'env', 'effect', 'fx_fall'),
        row('energy ball', '能量球', 'env', 'effect', 'fx_glow'),
        row('dark aura', '黑暗氣場', 'env', 'effect', 'fx_glow'),
        row('destruction', '破壞', 'env', 'effect', 'fx_fall'),
        row('laser', '雷射／光束', 'env', 'effect', 'fx_glow'),
        row('paint splatter', '顏料飛濺', 'env', 'effect', 'fx_fall'),
        row('round table', '圓桌', 'env', 'other', 'obj_furn'),
        row('chest of drawers', '抽屜櫃', 'env', 'other', 'obj_furn'),
        row('hospital bed', '病床', 'env', 'other', 'obj_furn', era=['modern'], implies=['bed']),
        row('bar stool', '吧台高腳椅', 'env', 'other', 'obj_furn', era=['modern'], implies=['chair']),
        row('stove', '爐子', 'env', 'other', 'obj_furn', era=['modern']),
        row('under covers', '在被子底下', 'env', 'furniture', 'furniture', mutex='furniture', implies=['bed']),
        row('tanzaku', '七夕短冊', 'env', 'other', 'obj_fest', era=['edo', 'modern']),
        row('ema', '繪馬', 'env', 'other', 'obj_fest', era=['edo', 'modern']),
        row('bamboo broom', '竹掃帚', 'env', 'other', 'obj_hand'),
        row('ginkgo leaf', '銀杏葉', 'env', 'other', 'obj_plant', implies=['leaf']),
        row('petals on liquid', '花瓣浮在水面', 'env', 'other', 'obj_plant'),
        row('log', '原木', 'env', 'other', 'obj_plant'),
        row('crate', '板條箱', 'env', 'other', 'obj_furn'),
        row('analog clock', '指針時鐘', 'env', 'other', 'obj_furn', implies=['clock']),
        row('dandelion', '蒲公英', 'env', 'other', 'obj_plant', implies=['flower']),
        row('lily of the valley', '鈴蘭', 'env', 'other', 'obj_plant', implies=['flower']),
        row('food stand', '小吃攤', 'env', 'other', 'obj_street', era=['modern']),
        row('chimney', '煙囪', 'env', 'other', 'obj_build'),
        row('round window', '圓窗', 'env', 'other', 'obj_build'),
        row('traffic cone', '三角錐（交通錐）', 'env', 'other', 'obj_street', era=['modern']),
        row('oekaki', '塗鴉（お絵描き）', 'quality', 'style', 'style_tech'),
        row('blue theme', '藍色主題', 'quality', 'style', 'style_palette'),
        row('pink theme', '粉紅色主題', 'quality', 'style', 'style_palette'),
        row('red theme', '紅色主題', 'quality', 'style', 'style_palette'),
        row('green theme', '綠色主題', 'quality', 'style', 'style_palette'),
        row('purple theme', '紫色主題', 'quality', 'style', 'style_palette'),
        row('blue hairband', '藍色髮箍', 'clothing', 'acc', 'acc_head', implies=['hairband'], layer='accessory'),
        row('blue halo', '藍色光環', 'clothing', 'acc', 'acc_head', implies=['halo'], layer='accessory'),
        row('pink halo', '粉色光環', 'clothing', 'acc', 'acc_head', implies=['halo'], layer='accessory'),
        row('military hat', '軍帽', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['modern'], implies=['hat'], layer='accessory'),
        row('sailor hat', '水手帽', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['modern'], implies=['hat'], layer='accessory'),
        row('garrison cap', '船形帽', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['modern'], implies=['hat'], layer='accessory'),
        row('flat cap', '鴨舌帽（平頂帽）', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['victorian', 'modern'], implies=['hat'], layer='accessory'),
        row('fedora', '紳士帽（費多拉帽）', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['victorian', 'modern'], implies=['hat'], layer='accessory'),
        row('bucket hat', '漁夫帽', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['modern'], implies=['hat'], layer='accessory'),
        row('jester cap', '小丑帽', 'clothing', 'acc', 'acc_head', mutex='headwear', implies=['hat'], layer='accessory'),
        row('arm warmers', '臂套', 'clothing', 'acc', 'acc_hand', layer='accessory'),
        row('bracer', '護腕', 'clothing', 'acc', 'acc_hand', era=['medieval'], layer='accessory'),
        row('wrist scrunchie', '手腕髮圈', 'clothing', 'acc', 'acc_hand', implies=['scrunchie'], layer='accessory'),
        row('red scrunchie', '紅色髮圈', 'clothing', 'acc', 'acc_hand', implies=['scrunchie'], layer='accessory'),
        row('blue scrunchie', '藍色髮圈', 'clothing', 'acc', 'acc_hand', implies=['scrunchie'], layer='accessory'),
        row('black scrunchie', '黑色髮圈', 'clothing', 'acc', 'acc_hand', implies=['scrunchie'], layer='accessory'),
        row('tinted eyewear', '有色鏡片眼鏡', 'clothing', 'acc', 'acc_face', era=['modern'], layer='accessory'),
        row('heart earrings', '愛心耳環', 'clothing', 'acc', 'acc_jewel', implies=['earrings'], layer='accessory'),
        row('star earrings', '星星耳環', 'clothing', 'acc', 'acc_jewel', implies=['earrings'], layer='accessory'),
        row('puffy shorts', '蓬蓬短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('high-waist shorts', '高腰短褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern'], implies=['shorts'], layer='garment'),
        row('yellow skirt', '黃色裙子', 'clothing', 'bottom', 'bot_skirt', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row('orange skirt', '橙色裙子', 'clothing', 'bottom', 'bot_skirt', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row('aqua skirt', '水藍色裙子', 'clothing', 'bottom', 'bot_skirt', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row('striped skirt', '條紋裙', 'clothing', 'bottom', 'bot_skirt', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row('print skirt', '印花裙', 'clothing', 'bottom', 'bot_skirt', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row('medium skirt', '及膝裙', 'clothing', 'bottom', 'bot_skirt', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row('circle skirt', '圓裙', 'clothing', 'bottom', 'bot_skirt', mutex='bottom', era=['modern', 'victorian', 'medieval', 'ancient_china'], implies=['skirt'], gate='female', layer='garment'),
        row('pink pants', '粉色長褲', 'clothing', 'bottom', 'bot_pants', mutex='bottom', era=['modern', 'victorian'], implies=['pants'], layer='garment'),
        row('jingasa', '陣笠', 'clothing', 'acc', 'acc_head', mutex='headwear', era=['edo'], implies=['hat'], layer='accessory'),
        row('kappougi', '割烹著', 'clothing', 'era', 'era_jp', era=['edo', 'modern'], layer='garment'),
        row('greco-roman clothes', '希臘羅馬服飾', 'clothing', 'era', 'era_west', mutex='onepiece', era=['ancient_greece'], implies=['ancient greek clothes'], layer='garment'),
        row('dougi', '道服', 'clothing', 'era', 'era_jp', mutex='onepiece', era=['edo', 'modern'], layer='garment'),
        row('black hakama', '黑色袴', 'clothing', 'era', 'era_jp', mutex='bottom', era=['edo'], implies=['hakama'], layer='garment'),
        row('blue hakama', '藍色袴', 'clothing', 'era', 'era_jp', mutex='bottom', era=['edo'], implies=['hakama'], layer='garment'),
        row('obiage', '帶揚', 'clothing', 'era', 'era_jp', era=['edo'], implies=['obi'], layer='accessory'),
        row('hakama pants', '褲型袴', 'clothing', 'era', 'era_jp', mutex='bottom', era=['edo'], implies=['hakama'], layer='garment'),
        row('ribbon-trimmed skirt', '緞帶邊裙', 'clothing', 'fabric', 'fab_material', implies=['skirt'], layer='garment'),
        row('lace-trimmed dress', '蕾絲邊洋裝', 'clothing', 'fabric', 'fab_material', implies=['dress'], layer='garment'),
        row('frilled shirt collar', '荷葉邊襯衫領', 'clothing', 'fabric', 'fab_sleeve', layer='garment'),
        row('blue sailor collar', '藍色水手領', 'clothing', 'fabric', 'fab_sleeve', era=['modern'], implies=['sailor collar'], layer='garment'),
        row('white sailor collar', '白色水手領', 'clothing', 'fabric', 'fab_sleeve', era=['modern'], implies=['sailor collar'], layer='garment'),
        row('black sailor collar', '黑色水手領', 'clothing', 'fabric', 'fab_sleeve', era=['modern'], implies=['sailor collar'], layer='garment'),
        row('shoulder cutout', '露肩剪裁', 'clothing', 'fabric', 'fab_state', layer='garment'),
        row('navel cutout', '露肚臍剪裁', 'clothing', 'fabric', 'fab_state', layer='garment'),
        row('back cutout', '露背剪裁', 'clothing', 'fabric', 'fab_state', layer='garment'),
        row('side cutout', '側邊剪裁', 'clothing', 'fabric', 'fab_state', layer='garment'),
        row('partially unbuttoned', '半解鈕釦', 'clothing', 'fabric', 'fab_state', layer='garment'),
        row('open fly', '褲子拉鍊/鈕釦打開', 'clothing', 'fabric', 'fab_state', era=['modern'], heat=['flash', 'sex'], layer='garment'),
        row('open collar', '開領', 'clothing', 'fabric', 'fab_sleeve', layer='garment'),
        row('buttoned cuffs', '袖口鈕釦', 'clothing', 'fabric', 'fab_sleeve', layer='garment'),
        row('popped collar', '豎起的領子', 'clothing', 'fabric', 'fab_sleeve', layer='garment'),
        row('brown sandals', '棕色涼鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['ancient_greece', 'modern'], implies=['sandals'], layer='garment'),
        row('white sandals', '白色涼鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['ancient_greece', 'modern'], implies=['sandals'], layer='garment'),
        row('high heel sandals', '高跟涼鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['high heels', 'sandals'], gate='female', layer='garment'),
        row('strappy heels', '繞踝高跟鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['high heels'], gate='female', layer='garment'),
        row('platform heels', '厚底高跟鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['high heels'], gate='female', layer='garment'),
        row('flats', '平底鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('ballet slippers', '芭蕾舞鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['modern'], layer='garment'),
        row('roller skates', '四輪溜冰鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['modern'], layer='garment'),
        row('inline skates', '直排輪鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['modern'], layer='garment'),
        row('skates', '溜冰鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['modern'], layer='garment'),
        row('paw shoes', '獸掌鞋', 'clothing', 'feet', 'feet', mutex='feet', era=['modern'], implies=['shoes'], layer='garment'),
        row('single shoe', '只穿一隻鞋', 'clothing', 'feet', 'feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('mismatched footwear', '左右不同的鞋', 'clothing', 'feet', 'feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('asymmetrical footwear', '不對稱鞋款', 'clothing', 'feet', 'feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('shoe soles', '鞋底可見', 'clothing', 'feet', 'feet', era=['victorian', 'modern'], implies=['shoes'], layer='garment'),
        row('shoelaces', '鞋帶', 'clothing', 'feet', 'feet', era=['victorian', 'modern'], layer='garment'),
        row('red pantyhose', '紅色褲襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row('frilled thighhighs', '荷葉邊過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('lace-trimmed thighhighs', '蕾絲邊過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('print thighhighs', '印花過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('ribbed thighhighs', '羅紋過膝襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('seamed legwear', '有縫線的襪類', 'clothing', 'legs', 'legs', era=['modern', 'victorian'], layer='garment'),
        row('back-seamed legwear', '後縫襪', 'clothing', 'legs', 'legs', era=['modern', 'victorian'], layer='garment'),
        row('thighhighs under boots', '靴內過膝襪', 'clothing', 'legs', 'legs', era=['modern', 'victorian'], implies=['thighhighs'], gate='female', layer='garment'),
        row('argyle pantyhose', '菱格紋褲襪', 'clothing', 'legs', 'legs', mutex='legs', era=['modern'], implies=['pantyhose'], gate='female', layer='garment'),
        row('taut dress', '緊繃洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('medium dress', '及膝洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('microdress', '超短洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('tube dress', '管狀洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('turtleneck dress', '高領洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern', 'victorian'], implies=['dress'], gate='female', layer='garment'),
        row('santa dress', '聖誕洋裝', 'clothing', 'onepiece', 'op_dress', mutex='onepiece', era=['modern'], implies=['dress'], gate='female', layer='garment'),
        row('black bikini', '黑色比基尼', 'clothing', 'onepiece', 'op_swim', mutex='onepiece', era=['modern'], implies=['bikini'], gate='female', layer='garment'),
        row('white bikini', '白色比基尼', 'clothing', 'onepiece', 'op_swim', mutex='onepiece', era=['modern'], implies=['bikini'], gate='female', layer='garment'),
        row('red bikini', '紅色比基尼', 'clothing', 'onepiece', 'op_swim', mutex='onepiece', era=['modern'], implies=['bikini'], gate='female', layer='garment'),
        row('frilled bikini', '荷葉邊比基尼', 'clothing', 'onepiece', 'op_swim', mutex='onepiece', era=['modern'], implies=['bikini'], gate='female', layer='garment'),
        row('striped bikini', '條紋比基尼', 'clothing', 'onepiece', 'op_swim', mutex='onepiece', era=['modern'], implies=['bikini'], gate='female', layer='garment'),
        row('purple bikini', '紫色比基尼', 'clothing', 'onepiece', 'op_swim', mutex='onepiece', era=['modern'], implies=['bikini'], gate='female', layer='garment'),
        row('blue leotard', '藍色緊身連體衣', 'clothing', 'onepiece', 'op_body', mutex='onepiece', era=['modern'], implies=['leotard'], gate='female', layer='garment'),
        row('red leotard', '紅色緊身連體衣', 'clothing', 'onepiece', 'op_body', mutex='onepiece', era=['modern'], implies=['leotard'], gate='female', layer='garment'),
        row('short jumpsuit', '短版連身褲', 'clothing', 'onepiece', 'op_body', mutex='onepiece', era=['modern'], layer='garment'),
        row('unitard', '連身緊身衣', 'clothing', 'onepiece', 'op_body', mutex='onepiece', era=['modern'], layer='garment'),
        row('purple coat', '紫色大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('duffel coat', '粗呢大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('military jacket', '軍裝外套', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row('camouflage jacket', '迷彩外套', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['jacket'], layer='garment'),
        row('collared coat', '翻領大衣', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['coat'], layer='garment'),
        row('brown cardigan', '棕色開襟衫', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['cardigan'], layer='garment'),
        row('pink cardigan', '粉色開襟衫', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['cardigan'], layer='garment'),
        row('grey cardigan', '灰色開襟衫', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['cardigan'], layer='garment'),
        row('black cardigan', '黑色開襟衫', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['cardigan'], layer='garment'),
        row('blue cardigan', '藍色開襟衫', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['cardigan'], layer='garment'),
        row('white cardigan', '白色開襟衫', 'clothing', 'outer', 'outer', mutex='outer', era=['modern'], implies=['cardigan'], layer='garment'),
        row('vertical-striped shirt', '直條紋襯衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('two-tone shirt', '雙色上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('strapless shirt', '無肩帶上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('halter shirt', '掛脖上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('sideless shirt', '露側身上衣', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], heat=['flash', 'sex'], layer='garment'),
        row('sleeveless hoodie', '無袖連帽衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern'], implies=['hoodie'], layer='garment'),
        row('white camisole', '白色細肩帶背心', 'clothing', 'top', 'top_tank', mutex='top', era=['modern'], implies=['camisole'], gate='female', layer='garment'),
        row('pink camisole', '粉色細肩帶背心', 'clothing', 'top', 'top_tank', mutex='top', era=['modern'], implies=['camisole'], gate='female', layer='garment'),
        row('turtleneck shirt', '高領襯衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('untucked shirt', '襯衫沒紮進去', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern', 'victorian'], implies=['shirt'], layer='garment'),
        row('black hoodie', '黑色連帽衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern'], implies=['hoodie'], layer='garment'),
        row('white hoodie', '白色連帽衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern'], implies=['hoodie'], layer='garment'),
        row('blue hoodie', '藍色連帽衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern'], implies=['hoodie'], layer='garment'),
        row('pink hoodie', '粉色連帽衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern'], implies=['hoodie'], layer='garment'),
        row('grey hoodie', '灰色連帽衫', 'clothing', 'top', 'top_shirt', mutex='top', era=['modern'], implies=['hoodie'], layer='garment'),
        row('brown sweater', '棕色毛衣', 'clothing', 'top', 'top_knit', mutex='top', era=['modern'], implies=['sweater'], layer='garment'),
        row('grey sweater', '灰色毛衣', 'clothing', 'top', 'top_knit', mutex='top', era=['modern'], implies=['sweater'], layer='garment'),
        row('pink sweater', '粉色毛衣', 'clothing', 'top', 'top_knit', mutex='top', era=['modern'], implies=['sweater'], layer='garment'),
        row('frilled bra', '荷葉邊內衣', 'clothing', 'underwear', 'uw_top', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row('polka dot bra', '圓點內衣', 'clothing', 'underwear', 'uw_top', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row('print bra', '印花內衣', 'clothing', 'underwear', 'uw_top', mutex='underwear_top', era=['modern'], implies=['bra'], gate='female', layer='garment'),
        row('white male underwear', '白色男用內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], gate='male', layer='garment'),
        row('black male underwear', '黑色男用內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], gate='male', layer='garment'),
        row('micro panties', '超小內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('cat ear panties', '貓耳內褲', 'clothing', 'underwear', 'uw_bottom', mutex='underwear_bottom', era=['modern'], implies=['panties'], gate='female', layer='garment'),
        row('panty straps', '內褲細帶外露', 'clothing', 'underwear', 'uw_bottom', era=['modern'], gate='female', layer='accessory'),
        row('bra strap', '內衣肩帶', 'clothing', 'underwear', 'uw_top', era=['modern'], gate='female', layer='accessory'),
        row('electrokinesis', '操縱電力', 'env', 'effect', 'fx_glow'),
        row('telekinesis', '念力', 'env', 'effect', 'fx_glow'),
        row('morning glory', '牽牛花', 'env', 'other', 'obj_plant', implies=['flower']),
        row('orange rose', '橙色玫瑰', 'env', 'other', 'obj_plant', implies=['flower']),
        row('chalk', '粉筆', 'env', 'other', 'obj_hand', era=['modern']),
        row('globe', '地球儀', 'env', 'other', 'obj_hand', era=['modern']),
        row('helicopter', '直升機', 'env', 'other', 'obj_tech', era=['modern']),
        row('scooter', '速克達（機車）', 'env', 'other', 'obj_tech', era=['modern']),
        row('race vehicle', '賽車/競速載具', 'env', 'other', 'obj_tech', era=['modern']),
        row('hagoita', '羽子板', 'env', 'other', 'obj_fest', era=['edo', 'modern']),
        row('daruma doll', '達摩不倒翁', 'env', 'other', 'obj_fest', era=['edo', 'modern']),
        row('hamaya', '破魔矢', 'env', 'other', 'obj_fest', era=['edo', 'modern']),
        row('kouhaku nawa', '紅白繩', 'env', 'other', 'obj_fest', era=['edo', 'modern']),
        row('mahjong tile', '麻將牌', 'env', 'other', 'obj_hand'),
        row('median furrow', '背部中線溝', 'feature', 'body_f', 'body_part'),
        row('spine', '脊椎', 'feature', 'body_f', 'body_part'),
        row('palms', '手掌', 'feature', 'body_f', 'body_part'),
        row('navel hair', '肚臍毛', 'feature', 'body_m', 'bm_hair', gate='male'),
        row('fake mustache', '假鬍子', 'feature', 'body_m', 'bm_hair'),
        row('pectoral cleavage', '胸肌乳溝', 'feature', 'body_m', 'bm_build', gate='male'),
        row('blue sclera', '藍色鞏膜', 'feature', 'eyes', 'eye_shape'),
        row('flaming eye', '火焰眼', 'feature', 'eyes', 'eye_shape'),
        row('unusually open eyes', '罕見睜眼', 'feature', 'eyes', 'eye_shape'),
        row('short eyebrows', '短眉毛', 'feature', 'eyes', 'eye_shape'),
        row('heart in eye', '眼中愛心', 'feature', 'eyes', 'eye_shape'),
        row('no eyebrows', '無眉毛', 'feature', 'eyes', 'eye_shape'),
        row('blunt tresses', '齊切垂髮束', 'feature', 'hair_style', 'hair_detail'),
        row('long sideburns', '長鬢角', 'feature', 'hair_style', 'hair_detail'),
        row('split ponytail', '分岔馬尾', 'feature', 'hair_style', 'hair_shape', mutex='hair_style', implies=['ponytail']),
        row('prehensile hair', '可操控的頭髮', 'feature', 'hair_style', 'hair_detail'),
        row('hair spread out', '頭髮散開', 'feature', 'hair_style', 'hair_detail'),
        row('multiple braids', '多條辮子', 'feature', 'hair_style', 'hair_shape', mutex='hair_style', implies=['braid']),
        row('updo', '盤起的髮髻', 'feature', 'hair_style', 'hair_shape', mutex='hair_style'),
        row('loose hair strand', '散落髮絲', 'feature', 'hair_style', 'hair_detail'),
        row('low-tied sidelocks', '低綁鬢髮', 'feature', 'hair_style', 'hair_detail', implies=['sidelocks']),
        row('hair flowing over', '頭髮垂覆物體', 'feature', 'hair_style', 'hair_detail'),
        row('broken horn', '斷角', 'feature', 'other', 'nonhuman', implies=['horns']),
        row('dog tail', '狗尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('mouse tail', '老鼠尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('raccoon tail', '浣熊尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('tiger tail', '老虎尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('shark tail', '鯊魚尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('squirrel tail', '松鼠尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('lion tail', '獅子尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('monkey tail', '猴子尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('bird tail', '鳥尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('ghost tail', '幽靈尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('snake tail', '蛇尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('spiked tail', '尖刺尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('heart tail', '愛心尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('cow tail', '牛尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('blue wings', '藍色翅膀', 'feature', 'other', 'nonhuman', implies=['wings']),
        row('mini wings', '迷你翅膀', 'feature', 'other', 'nonhuman', implies=['wings']),
        row('multicolored wings', '多色翅膀', 'feature', 'other', 'nonhuman', implies=['wings']),
        row('purple wings', '紫色翅膀', 'feature', 'other', 'nonhuman', implies=['wings']),
        row('spread wings', '展開的翅膀', 'feature', 'other', 'nonhuman', implies=['wings']),
        row('sharp teeth', '尖牙（全口）', 'feature', 'other', 'mouth_bits'),
        row('fangs', '尖銳犬齒', 'feature', 'other', 'mouth_bits'),
        row('fang out', '露出一顆虎牙', 'feature', 'other', 'mouth_bits', implies=['fang']),
        row('round teeth', '圓形牙齒', 'feature', 'other', 'mouth_bits'),
        row('buck teeth', '暴牙', 'feature', 'other', 'mouth_bits'),
        row('lower teeth only', '只露下排牙齒', 'feature', 'other', 'mouth_bits'),
        row('long tongue', '長舌頭', 'feature', 'other', 'mouth_bits', implies=['tongue']),
        row('forked tongue', '分岔舌頭', 'feature', 'other', 'mouth_bits', implies=['tongue']),
        row('colored tongue', '有色舌頭', 'feature', 'other', 'mouth_bits', implies=['tongue']),
        row('blue tongue', '藍色舌頭', 'feature', 'other', 'mouth_bits', implies=['tongue', 'colored tongue']),
        row('tail raised', '尾巴翹起', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('prehensile tail', '可抓握的尾巴', 'feature', 'other', 'nonhuman', implies=['tail']),
        row('bandaid on hand', '手上的OK繃', 'feature', 'skin', 'skin_mark', implies=['bandaid']),
        row('facial tattoo', '臉部刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('back tattoo', '背部刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('breast tattoo', '胸部刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('stomach tattoo', '腹部刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('star tattoo', '星星刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('number tattoo', '數字刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('hand tattoo', '手部刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('barcode tattoo', '條碼刺青', 'feature', 'skin', 'tattoo', implies=['tattoo']),
        row('mole on thigh', '大腿上的痣', 'feature', 'skin', 'skin_mark', implies=['mole']),
        row('mole on neck', '頸部的痣', 'feature', 'skin', 'skin_mark', implies=['mole']),
        row('mole above mouth', '嘴上方的痣', 'feature', 'skin', 'skin_mark', implies=['mole']),
        row('mole on ass', '臀部的痣', 'feature', 'skin', 'skin_mark', implies=['mole']),
        row('scar on nose', '鼻上疤痕', 'feature', 'skin', 'skin_mark'),
        row('throwing', '投擲', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('riding pokemon', '騎乘寶可夢', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('imminent kiss', '即將接吻', 'pose', 'activity', 'act_daily', mutex='activity', needs=['pair']),
        row('after kiss', '親吻之後', 'pose', 'activity', 'act_daily', mutex='activity', needs=['pair']),
        row('surprise kiss', '突襲親吻', 'pose', 'activity', 'act_daily', mutex='activity', needs=['pair']),
        row('pocky kiss', 'Pocky接吻', 'pose', 'activity', 'act_daily', mutex='activity', implies=['pocky'], needs=['pair']),
        row('untying', '解開綁帶', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('poking', '戳', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('confession', '告白', 'pose', 'activity', 'act_daily', mutex='activity'),
        row('comforting', '安慰', 'pose', 'activity', 'act_daily', mutex='activity', needs=['pair']),
        row('knees apart feet together', '膝蓋分開腳掌併攏', 'pose', 'body', 'body', mutex='body_pose'),
        row('hand on own leg', '手放在自己腿上', 'pose', 'tease', 'pose_hand'),
        row('elbow rest', '手肘撐著', 'pose', 'tease', 'pose_hand'),
        row('pinky out', '翹小指', 'pose', 'tease', 'pose_hand'),
        row('spread fingers', '張開手指', 'pose', 'tease', 'pose_hand'),
        row('bowlegged pose', 'O型腿站姿', 'pose', 'body', 'body', mutex='body_pose'),
        row('heel up', '腳跟抬起', 'pose', 'body', 'body'),
        row('on shoulder', '站在肩上', 'pose', 'other', 'pose_stance', needs=['pair']),
        row('cheek bulge', '臉頰鼓起', 'pose', 'face', 'face_mouth'),
        row('uvula', '懸雍垂（小舌頭）', 'pose', 'face', 'face_mouth'),
        row('spitting', '吐口水', 'pose', 'face', 'face_part'),
        row('sick', '生病', 'pose', 'face', 'face_mood', mutex='expression'),
        row('pain', '疼痛', 'pose', 'face', 'face_mood', mutex='expression'),
        row('xd', 'XD表情', 'pose', 'face', 'face_mouth', mutex='expression'),
        row('o3o', 'o3o 表情', 'pose', 'face', 'face_mouth', mutex='expression'),
        row('u u', 'u_u 表情', 'pose', 'face', 'face_mouth', mutex='expression'),
        row('weapon over shoulder', '武器扛肩', 'pose', 'tease', 'pose_hold'),
        row('weapon on back', '武器背在背上', 'pose', 'tease', 'pose_hold'),
        row('sword over shoulder', '劍扛肩', 'pose', 'tease', 'pose_hold'),
        row('sword on back', '劍背在背上', 'pose', 'tease', 'pose_hold'),
        row('reverse grip', '反握', 'pose', 'tease', 'pose_hold'),
        row('hand on hilt', '手放劍柄', 'pose', 'tease', 'pose_hold'),
        row('finger on trigger', '手指扣扳機', 'pose', 'tease', 'pose_hold'),
        row('drawing sword', '拔劍', 'pose', 'tease', 'pose_hold'),
        row('holstered', '槍入套', 'pose', 'tease', 'pose_hold'),
        row('holding behind back', '背後拿著東西', 'pose', 'tease', 'pose_hold'),
        row("hand on another's ass", '手放在對方臀部', 'pose', 'sex', 'sex_touch', needs=['pair'], heat=['sex']),
        row('twirling hair', '捲玩頭髮', 'pose', 'tease', 'pose_hand'),
        row('finger to cheek', '手指點臉頰', 'pose', 'tease', 'pose_hand'),
        row('finger to own chin', '手指抵下巴', 'pose', 'tease', 'pose_hand'),
        row('licking finger', '舔手指', 'pose', 'tease', 'pose_hand'),
        row('pocky in mouth', '嘴叼Pocky', 'pose', 'tease', 'pose_situ', implies=['pocky']),
        row('teasing', '戲弄', 'pose', 'tease', 'pose_situ'),
        row("arm around another's waist", '手臂環著對方腰', 'pose', 'tease', 'pose_two', needs=['pair']),
        row("hand on another's hip", '手放在對方臀側', 'pose', 'tease', 'pose_two', needs=['pair']),
        row('kissing forehead', '親額頭', 'pose', 'tease', 'pose_two', needs=['pair']),
        row('sexually suggestive', '性暗示', 'pose', 'tease', 'pose_situ'),
        row('yellow theme', '黃色主題', 'quality', 'style', 'style_palette'),
        row('horror (theme)', '恐怖主題', 'quality', 'style', 'style_tech'),
        row('orange theme', '橙色主題', 'quality', 'style', 'style_palette'),
        row('black theme', '黑色主題', 'quality', 'style', 'style_palette'),
        row('white theme', '白色主題', 'quality', 'style', 'style_palette'),
        row('brown theme', '棕色主題', 'quality', 'style', 'style_palette'),
        row('multiple moles', '多顆痣', 'feature', 'skin', 'skin_mark', implies=['mole']),
        # 2026-10-24 圖測通過。版面四張與複製人、動物化進 ODD_MOTIF，正常模式只在釘了才出現。
        row('reference sheet', '角色設定圖', 'pose', 'camera', 'cam_fx'),
        row('turnaround', '角色轉面圖', 'pose', 'camera', 'cam_fx'),
        row('column lineup', '直欄並排', 'pose', 'camera', 'cam_fx'),
        row('collage', '拼貼圖', 'pose', 'camera', 'cam_fx'),
        row('clone', '複製人', 'feature', 'other', 'relation'),
        row('animalization', '動物化', 'feature', 'other', 'persona'),
        row('romper', '連身短褲裝', 'clothing', 'onepiece', 'op_body', mutex='onepiece',
            era=['modern'], gate='female', layer='garment'),
        row('cupless bra', '無罩杯內衣', 'clothing', 'underwear', 'uw_top', mutex='underwear_top',
            era=['modern'], implies=['bra'], gate='female', heat=['flash', 'sex'], layer='garment',
            mxextra=['chest_cover']),
        row('cheek pinching', '掐臉頰', 'pose', 'face', 'face_part', mxextra=['hand_g']),
        row('covered penis', '衣下陰莖輪廓', 'pose', 'flash', 'flash_expose', gate='male', heat=['flash', 'sex']),
        row('oral invitation', '張嘴邀請顏射', 'pose', 'sex', 'sex_oral', heat=['sex'], implies=['open mouth']),
        row('futa on male', '扶她攻男性', 'pose', 'sex', 'sex_pos', mutex='sex_act',
            implies=['futanari'], needs=['male', 'female', 'pair'], gate='female', heat=['sex']),
    ]

def main() -> None:
    rows: list[dict] = []
    for path in sorted(PARTS.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(raw, dict) and "tags" in raw:
            raw = raw["tags"]
        if not isinstance(raw, list):
            continue
        rows.extend(raw)
    rows.extend(extra_era_tags())
    rows.extend(extra_race_tags())
    rows.extend(extra_male_look_tags())
    rows.extend(extra_shot_face_tags())
    rows.extend(extra_sex_position_tags())
    rows.extend(extra_bath_tags())
    rows.extend(extra_activity_tags())
    rows.extend(extra_job_scene_tags())
    rows.extend(extra_expand_tags())
    rows.extend(extra_corpus_tags())
    rows.extend(extra_fluid_tags())
    rows.extend(extra_erotic_tags())
    rows.extend(extra_kink_tags())
    rows.extend(extra_csv_tags())
    rows.extend(extra_csv_round2())
    rows.extend(extra_csv_round3())
    rows.extend(extra_csv_round4())
    rows.extend(extra_csv_round5())
    rows.extend(extra_csv_round6())
    rows.extend(extra_suggestion_tags())
    rows.extend(extra_more_tags())
    rows.extend(extra_focus_tags())
    rows.extend(extra_breast_grab())
    rows.extend(extra_breast_grab_r3())
    rows.extend(extra_pair_contact())
    rows.extend(extra_loli_tags())
    rows.extend(extra_shota_tags())
    rows.extend(extra_minor_block_tags())
    rows.extend(extra_style_tags())
    rows.extend(extra_quality_boost_tags())
    rows.extend(extra_look_tags())
    rows.extend(extra_wrestle_tags())
    rows.extend(extra_ethnic_tags())
    rows.extend(extra_gag_tags())
    rows.extend(extra_family_sex_tags())
    rows.extend(extra_measuring_tags())
    rows.extend(extra_object_tags())
    rows.extend(extra_round4_scenes())
    rows.extend(extra_round4_clothes())
    rows.extend(extra_round4_other())
    rows.extend(extra_suggestion_1500())
    rows.extend(extra_character_tags())
    rows.extend(extra_clothing_tags())
    rows.extend(extra_env_tags())
    rows.extend(extra_pose_tags())
    rows.extend(extra_quality_tags())

    old_zh: dict[str, str] = {}
    if OUT.exists():
        try:
            prev = json.loads(OUT.read_text(encoding="utf-8"))
            old_zh.update(prev.get("zh") or {})
            for t in prev.get("tags") or []:
                if t.get("zh"):
                    old_zh[t["tag"]] = t["zh"]
        except Exception:
            pass

    seen: set[tuple[str, str]] = set()
    unique: list[dict] = []
    dropped = 0
    for item in rows:
        n = norm(item)
        if not n:
            dropped += 1
            continue
        key = (n["tag"], n["section"])
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        if item.get("zh"):
            n["zh"] = item["zh"]
        elif n["tag"] in old_zh:
            n["zh"] = old_zh[n["tag"]]
        unique.append(n)

    inherit_eras(unique)

    # 細分類（給人找字用，見 subgroups.py）。拆開的小分類裡有字沒位置就停，不留「其他」。
    problems = check_subs(unique)
    if problems:
        raise SystemExit("細分類有問題：\n  " + "\n  ".join(problems))
    for i, t in enumerate(unique):
        sub = assign_sub(t)
        out: dict = {}
        for k, v in t.items():
            if k == "sub":
                continue
            out[k] = v
            if k == "group":
                out["sub"] = sub
        unique[i] = out

    unique = add_alt_names(unique)

    by_sec: dict[str, int] = {}
    for t in unique:
        by_sec[t["section"]] = by_sec.get(t["section"], 0) + 1

    # 五個品質加分的中文以產生腳本為準。頂層 zh 若只從舊 lexicon 複製，重產會洗掉。
    boost_zh = {row["tag"]: row["zh"] for row in extra_quality_boost_tags()}
    top_zh: dict[str, str] = {}
    for t in (
        "masterpiece", "best quality", "amazing quality",
        "absurdres", "highres", "very aesthetic", "highly aesthetic", "newest",
        "nsfw", "explicit",
    ):
        label = boost_zh.get(t) or old_zh.get(t)
        if label:
            top_zh[t] = label

    data = {
        "quality": [
            "masterpiece",
            "best quality",
            "amazing quality",
        ],
        "nsfwTail": ["nsfw", "explicit"],
        "sfwTail": ["sfw", "general"],
        "sensitiveTail": ["sensitive"],
        # areolae 拿掉了：Danbooru 上它是 deprecated（17671 篇但已停用），
        # 而同一份清單裡的 nipples 有 1142587 篇，本來就把它蓋住了。
        # 想保留同樣意思又要現役的話是 large areolae(48770)，但在 nipples 旁邊是多餘的。
        "sensitiveNegative": [
            "explicit", "nude", "nipples", "pussy", "penis", "sex", "cum",
            "topless female", "bottomless", "pubic hair",
        ],
        "sfwNegative": [
            "nsfw", "explicit", "questionable", "nude", "nipples", "pussy",
            "penis", "sex", "cum", "topless female", "bottomless",
            "panties", "underwear", "cameltoe", "pubic hair",
        ],
        # 清空：soft lighting 在 Danbooru 是 0 篇、也不在 Illustrious 的訓練字彙裡，
        # 兩本字典都查不到卻每張圖硬掛。打光交給 light 群組隨機抽，那裡有 22 個
        # 有真實訊號的 tag（shadow 164778、sunlight 102678、backlighting 45718…）。
        "alwaysEnv": [],
        "negative": NEGATIVE,
        "defaults": {
            "n": 1,
            "width": 1024,
            "height": 1024,
            "counts": {
                "subject": 2,
                "feature": 8,
                "pose": 6,
                "clothing": 5,
                # 4 -> 6。這個 4 從初始 commit 就沒動過，但 drawOne() 明確填的 env
                # 格子一路加到四個（place / in_out / day_night / lighting），而
                # countSection() 連 implies 帶進來的字一起算 —— 光是 indoors／
                # outdoors 就佔掉每張圖 1.01 格（99% 的圖都有，而且幾乎都是場地
                # 免費帶進來的，不是抽的）。結果通用的 fill("env") 預算永遠是 0。
                #
                # 實測（8000 張、預設設定）：配額給 4 和給 5 完全一樣（env 每張都是
                # 5.57），要給到 6 才真的多撈得到東西（6.11）。所以「補回 lighting
                # 吃掉的那一格」不是 +1 而是 +2 —— 我原本以為 +1 就夠，量過才發現不是。
                #
                # 換來 40 個字從「永遠抽不到」變成抽得到，代價是每張圖多 0.54 個
                # env 字、6 個字元（約 2 個 token）：星空、藍天、景深、膠片顆粒、
                # 床、窗簾、鏡子、樹、營火，以及**全部的運動器材**（網球拍、高爾夫球桿、
                # 棒球手套、弓箭）—— 運動預設那一整套的道具以前在預設設定下全都抽不到。
                "env": 6,
            },
            "girl": True,
            "boy": False,
            "heats": ["tease", "flash", "sex"],
            "heatPreset": "mixed",
            "eras": ["modern"],
        },
        "heatWeights": {
            "mixed": {"tease": 0.3, "flash": 0.3, "sex": 0.4},
            "tease": {"tease": 1.0, "flash": 0.0, "sex": 0.0},
            "flash": {"tease": 0.0, "flash": 1.0, "sex": 0.0},
            "sex": {"tease": 0.0, "flash": 0.0, "sex": 1.0},
        },
        # 補三個缺口，權重照 Danbooru 的真實比例推出來，其餘等比例縮放。
        #
        # 原本 mixed 有「兩女一男」卻**沒有「一女兩男」** —— 而 Danbooru 上
        # 1girl 2boys 有 96,530 篇，是 2girls 1boy（124,384）的 78%。同一個量級
        # 卻一邊有一邊沒有，那是漏不是取捨。代價是四個姿勢直接死掉：spitroast、
        # double penetration、mmf threesome、reverse spitroast 都要 group(3人)+2male，
        # 而當時**沒有任何組合同時滿足這兩個條件**。
        #
        # 4girls（145,822）和 3boys（105,997）同理，都是有量卻不在表裡。
        #
        #   mixed  1girl,2boys = 0.08 x 96530/124384 = 0.062 -> 0.06
        #   girl   4girls      = 0.06 x 145822/328428 = 0.027 -> 0.03
        #   boy    3boys       = 0.22 x 105997/469237 = 0.050 -> 0.05
        #
        # gangbang 仍然抽不到：它要 crowd(4人)，而四人組合（2girls 2boys 只有
        # 37,463 篇）是另一件事，這次不加，維持釘選限定。
        "castWeights": {
            "girl_only": {"1girl": 0.70, "2girls": 0.21, "3girls": 0.06, "4girls": 0.03},
            "boy_only": {"1boy": 0.74, "2boys": 0.21, "3boys": 0.05},
            "mixed": {
                "1girl": 0.39,
                "1boy": 0.11,
                "1girl,1boy": 0.27,
                "2girls": 0.09,
                "2girls,1boy": 0.08,
                "1girl,2boys": 0.06,
            },
            # 只勾「性愛」時用這張，比 mixed 更偏向成對。原本這張表是**寫死在**
            # engine.js 的 chooseCast() 裡，於是同一份分佈有兩個來源 —— 補了詞庫
            # 這邊的「一女兩男」，寫死那邊照樣沒有，而那張才是勾性愛時真正在用的。
            # 搬過來只留一個來源，才不會再各改各的。
            # 權重同樣照 Danbooru 比例：0.16 x 96530/124384 = 0.124 -> 0.12。
            "sex": {
                "1girl,1boy": 0.56,
                "2girls,1boy": 0.14,
                "2girls": 0.11,
                "1girl": 0.07,
                "1girl,2boys": 0.12,
            },
        },
        "groupOrder": GROUP_ORDER,
        "groupZh": {**GROUP_ZH, **SUB_ZH},
        # 角色作品格的英文（web6/i18n.js 用；其他分類的英文在 web6/locales/groups.js）。
        "groupEn": CHARACTER_SUB_EN,
        # 字盒、左欄、必抽照這個順序列細分類；引擎的骨架格仍看 groupOrder。
        "subOrder": SUB_ORDER,
        "eraAnchors": ERA_ANCHORS,
        "eraAnchorAlts": ERA_ANCHOR_ALTS,
        "zh": top_zh,
        # 第一關擋下的角色。不進 tags，貼上提示詞與手打也由引擎擋（Opus）。
        "characterBan": character_ban_tags(),
        # 換過名的字（原名 -> 現在用的；alt_names.json 的 keep: "alt"）：存著的舊名讀到就換。
        # 網頁那份在 web6/tag-renames.js，伺服器在 card_usage.py；兩邊要一致（測試守著）。
        "renamed": dict(sorted(renamed_by_alt_names().items())),
        "tags": unique,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} tags={len(unique)} dropped={dropped} {by_sec}")


if __name__ == "__main__":
    main()
