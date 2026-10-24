"""細分類：給人找字用的小分類（字盒、左欄、必抽）。

`group`（groups.py）是引擎在用的：骨架格、時代道具、場地判斷、卡面提示詞都看它，
動了就會改到抽取結果和卡面。這一層只管「放在哪一格讓人找得到」：
- 不拆的小分類，細分類就是它自己（sub == group）。
- 拆開的小分類（SPLIT），每個字都要在下面的清單裡有位置，沒有的話 merge 直接報錯 ——
  不留「其他」這種找不到東西的格子。
- 清單可以跨小分類收字，只要在同一段（例如誘惑裡的 closed mouth 放進「表情・嘴」）。

改這裡不會改到抽取：引擎只在必抽時看細分類（必抽「地點・住家」就從住家抽）。
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

_HERE = Path(__file__).resolve().parent


def character_sub_id(series: str) -> str:
    """角色的細分類 id：一部作品一格（char_arknights、char_fate_series…）。"""
    return "char_" + re.sub(r"[^a-z0-9]+", "_", str(series).lower()).strip("_")


def _character_rows() -> tuple[list, dict]:
    """角色依作品分格（scripts/characters.json 能用的角色），角色多的作品排前面。
    中文、英文短名在 scripts/character_series.json。回傳 (SUBS 的列, {id: 英文})。"""
    try:
        chars = json.loads((_HERE / "characters.json").read_text(encoding="utf-8"))
        names = json.loads((_HERE / "character_series.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return [], {}
    # 每一部作品都要有中文短名，連目前只有禁用角色、畫面上看不到的也要：以後放行一個角色，
    # 那部作品的籤才不會掉回英文（2026-10-12 專案主：「全部系列都要做」）。中文名不能是純英文。
    missing = sorted({c.get("series") for c in chars if c.get("series") and c.get("series") not in names})
    english = sorted(k for k, v in names.items() if not re.search(r"[^\x00-\x7f！：〈〉]", str(v[0])))
    if missing or english:
        raise SystemExit(
            "scripts/character_series.json 要補中文短名："
            + "、".join(missing + english)
        )
    first = {}
    medium = {}
    for i, c in enumerate(chars):
        first.setdefault(c.get("series"), i)
        medium.setdefault(c.get("series"), Counter())[c.get("sub") or "char_other"] += 1
    count = Counter(c.get("series") for c in chars if c.get("character_ban") is False and c.get("series"))
    # 動漫在前、遊戲、其他（VOCALOID）；同一類裡角色多的作品排前面。
    # 字盒把同一個「・」前綴連成一串：「動漫：鬼滅之刃 航海王…」「遊戲：原神 明日方舟…」。
    kinds = {"char_anime": (0, "動漫", "Anime"), "char_game": (1, "遊戲", "Games"), "char_other": (2, "其他", "Other")}
    kind = lambda x: kinds.get(medium[x].most_common(1)[0][0], kinds["char_other"])  # noqa: E731
    rows, en = [], {}
    for series in sorted(count, key=lambda x: (kind(x)[0], -count[x], first.get(x, 0))):
        zh, english = (names.get(series) or [series, series])[:2]
        _, fam_zh, fam_en = kind(series)
        sid = character_sub_id(series)
        rows.append((sid, f"{fam_zh}・{zh}", []))
        en[sid] = f"{fam_en} · {english}"
    return rows, en


_CHAR_ROWS, CHARACTER_SUB_EN = _character_rows()

# 拆開的小分類。這些 group 的字都要被下面的 SUBS 收走。
SPLIT = {
    ("quality", "style"),
    ("subject", "extra"),
    ("subject", "character"),
    ("feature", "hair_style"),
    ("feature", "eyes"),
    ("feature", "body_f"),
    ("feature", "body_m"),
    ("feature", "race"),
    ("feature", "skin"),
    ("feature", "job"),
    ("feature", "sex"),
    ("feature", "other"),
    ("pose", "camera"),
    ("pose", "face"),
    ("pose", "tease"),
    ("pose", "flash"),
    ("pose", "sex"),
    ("pose", "activity"),
    ("pose", "other"),
    ("clothing", "era"),
    ("clothing", "onepiece"),
    ("clothing", "top"),
    ("clothing", "bottom"),
    ("clothing", "underwear"),
    ("clothing", "fabric"),
    ("clothing", "acc"),
    ("env", "place"),
    ("env", "effect"),
    ("env", "other"),
}

# 每段的細分類，依顯示順序。(id, 中文, [字…])。
# id 跟某個沒拆的小分類同名時，那個小分類的字全部預設放這裡，清單裡的是另外收進來的字；
# 清單是 None 就是原樣。
# 拆開的小分類不能沿用原本的 id（例如 eyes 拆成 eye_color／eye_shape），
# 這樣舊存檔裡的必抽「feature:eyes」還是照整個小分類抽，不會默默變成只抽一半。
SUBS = {
    "quality": [
        ("fixed", "固定", None),
        ("style_tech", "畫風・技法", [
            "realistic", "anime coloring", "flat color", "drop shadow", "thick outlines",
            "lineart", "screentones", "comic", "chibi", "painterly", "watercolor (medium)",
            "ink wash painting", "ukiyo-e", "pixel art", "uncensored",
            "abstract",

            "toon (style)", "faux traditional media", "outline", "white outline", "hatching (texture)",

            "no lineart",
        ]),
        ("style_palette", "畫風・色調", [
            "monochrome", "greyscale", "sepia", "spot color", "partially colored",
            "pastel colors", "muted colors", "limited palette", "colorful", "high contrast",
            "neon palette",
        ]),
        ("style_era", "畫風・年代題材", [
            "1980s (style)", "1990s (style)", "2000s (style)", "retro artstyle",
            "art nouveau", "steampunk", "cyberpunk",
            "faux retro artstyle", "retrofuturism",
        ]),
        ("boost", "解析／美感", None),
    ],
    "subject": [
        ("count_f", "人數・女", None),
        ("count_m", "人數・男", None),
        ("cast_mix", "人數・組成", [
            "solo", "solo focus", "male focus", "multiple girls", "multiple boys", "no humans",




        ]),
        ("pairing", "配對", ["hetero", "yuri"]),
        # 角色一部作品一格（_character_rows，從 scripts/characters.json 算）：不逐條抄名字，
        # merge 帶 sub（character_sub_id）進來。空清單代表「不靠這張表點名」。
        *_CHAR_ROWS,
    ],
    "feature": [
        ("hair_len", "髮長", None),
        ("hair_color", "髮色", None),
        ("hair_shape", "髮型・綁法造型", [
            "ponytail", "high ponytail", "low ponytail", "side ponytail", "braided ponytail",
            "folded ponytail", "twintails", "low twintails", "braid", "twin braids",
            "single braid", "hair bun", "double bun", "single hair bun", "half updo",
            "drill hair", "hime cut", "undercut", "hair slicked back", "mohawk",
            "dreadlocks", "afro", "cornrows",
            "two side up", "one side up", "short twintails", "side braid", "twin drills", "hair rings",
            "short hair with long locks", "low-tied long hair", "short ponytail", "half up braid",
            "crown braid", "low twin braids", "cone hair bun", "braided bun", "topknot", "multi-tied hair",

            "buzz cut", "bowl cut", "inverted bob", "front ponytail", "high side ponytail", "wide ponytail", "side braids", "nape braid", "low-braided long hair", "single side bun", "side up bun",
        ]),
        ("hair_detail", "髮型・瀏海髮質", [
            "blunt bangs", "swept bangs", "parted bangs", "bangs pinned back", "sidelocks",
            "hair intakes", "ahoge", "antenna hair", "hair flaps", "parted hair",
            "hair over shoulder", "hair over one eye", "hair between eyes",
            "eyes visible through hair", "straight hair", "wavy hair", "curly hair",
            "messy hair", "floating hair", "glowing hair",
            "double-parted bangs", "crossed bangs", "spiked hair", "hair behind ear",
            "huge ahoge", "heart ahoge", "single sidelock", "single hair intake",
            "alternate hairstyle", "blunt ends", "curtained hair", "hair down", "flipped hair",
            "asymmetrical hair", "hair up", "braided hair rings", "big hair", "convenient hair",
            "hair pulled back", "asymmetrical bangs", "long bangs", "braided bangs", "center-flap bangs",

            "long sidelocks", "drill sidelocks", "fiery hair", "hair over breasts",
        ]),
        ("wear_bits", "髮飾兜帽", ["hair scrunchie", "hair flower", "hood up"]),
        ("eye_color", "眼睛・瞳色", [
            "brown eyes", "blue eyes", "green eyes", "red eyes", "grey eyes", "yellow eyes",
            "pink eyes", "purple eyes", "orange eyes", "aqua eyes", "heterochromia",
            "glowing eyes", "glowing eye",
            "black eyes", "multicolored eyes",
        ]),
        ("eye_shape", "眼睛・眼型瞳孔", [
            "tsurime", "tareme", "narrowed eyes", "closed eyes", "eyelashes",
            "long eyelashes", "colored eyelashes", "thick eyebrows", "bags under eyes",
            "slit pupils", "ringed eyes", "dilated pupils", "symbol-shaped pupils",
            "star-shaped pupils", "heart-shaped pupils", "tears",
            "bright pupils", "white pupils", "one eye covered", "v-shaped eyebrows",
            "^ ^", "> <", "@ @", "+ +", "= =", "o o", ";o", "sanpaku",
            "black sclera", "yellow sclera", "white eyes", "two-tone eyes", "blank eyes",
            "one-eyed", "extra eyes", "no eyes", "gradient eyes", "third eye", "solid oval eyes",
            "eyeball", "red pupils", "pink pupils", "no pupils", "constricted pupils",
            "cross-shaped pupils", "diamond-shaped pupils", "mismatched pupils", "hair over eyes",
            "blinking", "aegyo sal",

            "colored sclera", "symbol in eye", "solid circle eyes", "thick eyelashes", "horizontal pupils", "star in eye", "red sclera", "yellow pupils", "x-shaped pupils",

            "alternate eye color",
        ]),
        ("mouth_bits", "嘴牙舌", ["tongue", "teeth", "fang", "saliva", "saliva trail", "skin fang", "lips"]),
        ("makeup", "妝容", [
            "eyeshadow", "eyeliner",
            "red eyeshadow", "pink eyeshadow", "blue eyeshadow", "purple eyeshadow", "black eyeshadow",

            "purple nails", "green nails", "aqua nails", "yellow nails", "orange nails", "white nails", "multicolored nails", "nail art", "red eyeliner", "sharp fingernails",
        ]),
        ("skin_tone", "皮膚・膚色", [
            "pale skin", "tan", "tanlines", "sun tattoo", "dark skin", "very dark skin",
            "black skin", "green skin", "dark-skinned female", "dark-skinned male", "shiny skin",
            "colored skin",
            "white skin", "blue skin", "grey skin", "red skin", "purple skin", "pink skin",
            "yellow skin", "orange skin", "aqua skin", "metal skin",
            "multicolored skin", "two-tone skin", "colored extremities", "patchwork skin", "albino",

            "alternate skin color",
        ]),
        # 族裔不放種族（精靈獸人）。中文不用「皮膚・」開頭，免得把膚色那格的翻譯拆開。
        ("ethnicity", "族裔", [
            "east asian", "desi",
        ]),
        ("skin_flush", "皮膚・臉紅汗濕", [
            "blush", "nose blush", "body blush", "blush stickers", "sweat", "nervous sweating",
            "sweatdrop", "wet", "wet hair", "steaming body",
            "flying sweatdrops", "light blush",

            "cold", "hot",

            "very sweaty", "turn pale", "dirty", "dirty face", "ear blush",
        ]),
        ("skin_mark", "皮膚・痣疤傷", [
            "mole", "mole under eye", "mole under mouth", "mole on cheek", "mole on breast",
            "freckles", "body freckles", "scar", "scar on face", "scar on cheek", "injury",
            "bruise", "bruise on face", "whip marks", "bite mark", "lipstick mark",
            "lipstick mark on neck", "blood on face", "blood from mouth", "nosebleed", "veins",
            "sticker on face", "lipstick mark on face",

            "birthmark", "scar on stomach", "scar on chest", "scar on arm", "one-piece tan", "bikini tan", "cracked skin", "wrinkled skin",
        ]),
        ("tattoo", "皮膚・刺青印記", [
            "tattoo", "arm tattoo", "leg tattoo", "neck tattoo", "ass tattoo", "tramp stamp",
            "heart tattoo", "tribal tattoo", "pubic tattoo", "branded", "body writing", "tally",
            "facial mark", "forehead mark", "bindi",

            "whisker markings", "body markings", "star facial mark", "flower tattoo", "shoulder tattoo", "chest tattoo",
        ]),
        ("bf_shape", "身體・女性身材", [
            "petite", "tall female", "loli", "toned", "muscular female", "curvy", "narrow waist",
            "wide hips", "thick thighs", "thigh gap", "long legs", "huge ass", "mature female",
            "old woman", "pregnant", "minigirl", "giantess", "quadruple amputee",

            "toned female",
        ]),
        ("bf_breast", "身體・胸部", [
            "flat chest", "small breasts", "medium breasts", "large breasts", "huge breasts",
            "gigantic breasts", "breasts", "cleavage", "sideboob", "underboob", "backboob",
            "hanging breasts", "sagging breasts", "unaligned breasts", "breasts apart",
            "breasts squeezed together", "bouncing breasts", "breasts out", "breast expansion",

            "perky breasts", "full cleavage", "framed breasts",
        ]),
        ("bf_intimate", "身體・乳頭私處", [
            "nipples", "puffy nipples", "inverted nipples", "huge nipples", "long nipples",
            "dark nipples", "large areolae", "covered nipples", "nipple piercing", "lactation",
            "excessive lactation", "projectile lactation",
            "pussy", "clitoris", "cleft of venus", "pubic hair", "female pubic hair",
            "pussy piercing", "uterus", "cervix",
            "cum on ass", "futanari",

            "clitoral hood", "no pussy", "partially visible vulva", "fat mons", "anus peek", "urethra", "pubic hair peek", "colored pubic hair",
        ]),
        ("bf_touch", "身體・托胸觸碰", [
            "grabbing own breast", "arm under breasts", "arms under breasts", "breast lift",
            "breast press", "breast suppress", "breast rest", "breasts on table",
            "breasts on glass", "nipple stimulation", "tweaking own nipple",
            "guided breast grab", "grabbing another's breast", "grabbing another's ass",
            "breast bondage",
            "presenting own breasts", "handsfree breast squeeze", "poking own breast",
            "sucking own breasts", "spread nipple", "licking own nipple",
            "self milking", "lactating into container", ]),
        ("body_part", "身體・部位", [
            "forehead", "collarbone", "shoulder blades", "armpits", "biceps", "ribs", "midriff",
            "belly", "navel", "covered navel", "ass", "ass ripple", "thighs", "skindentation",
            "thigh strap",
            "stomach",

            "bare hips",

            "hip bones", "armpit crease", "armpit peek",
        ]),
        ("bm_build", "身體・男性身材", [
            "short male", "tall male", "shota", "skinny", "toned male", "muscular",
            "muscular male", "bara", "abs", "pectorals", "broad shoulders", "adam's apple",
            "plump", "fat", "fat man", "obese", "manboobs", "mature male", "old man",
            "giant male",
            "grabbing own pectoral", "pectoral squeeze", "pectoral lift", "pectoral press",
            "large pectorals", "bare pectorals", "muscular arms", "veiny arms", "linea alba",
        ]),
        ("bm_hair", "身體・鬍子體毛", [
            "facial hair", "stubble", "beard", "goatee", "mustache", "chest hair", "arm hair",
            "leg hair", "male pubic hair",

            "body hair", "armpit hair", "sideburns", "full beard", "beard stubble",
        ]),
        ("bm_penis", "身體・陰莖睪丸", [
            "penis", "small penis", "large penis", "huge penis", "veiny penis", "erection",
            "half-erect", "flaccid", "twitching penis", "penis out", "penis peek", "phimosis",
            "foreskin", "condom on penis", "penis on ass", "testicles", "small testicles",
            "large testicles", "huge testicles", "covered testicles", "animal penis",
            "horse penis",

            "disembodied penis", "girthy penis",
        ]),
        ("race_fantasy", "種族・奇幻", [
            "elf", "dark elf", "dwarf", "vampire", "demon", "demon girl", "demon boy", "oni",
            "ghost", "zombie", "skeleton", "android", "alien", "slime girl", "slime boy",
            "mermaid", "merman", "lamia", "harpy", "centaur", "satyr", "minotaur", "goblin",
            "orc", "ogre", "troll", "kobold", "lizardman", "monster girl", "monster boy",
            "fairy", "cyborg",
            "monster", "dragon", "angel", "giant", "jiangshi", "eastern dragon",
            "slime (creature)", "centauroid", "unicorn", "western dragon", "tengu", "robot",

            "viera", "plant girl", "fish girl", "shark girl", "merfolk",
        ]),
        ("race_kemono", "種族・獸耳獸人", [
            "cat girl", "fox girl", "kitsune", "wolf girl", "dog girl", "rabbit girl",
            "cow girl", "dragon girl", "cat boy", "fox boy", "wolf boy", "dog boy",
            "rabbit boy", "horse boy", "bear boy", "tiger boy", "lion boy", "dragon boy",
            "shark boy", "tanuki", "werewolf",
            "horse girl",
            "nekomata", "kyuubi",

            "miqo'te", "tiger girl", "lion girl",
        ]),
        ("nonhuman", "種族・非人特徵", [
            "animal ears", "pointy ears", "tail", "horns", "demon horns", "wings",
            "demon wings", "angel wings", "tusks", "robot joints",
            "cat ears", "rabbit ears", "horse ears", "fox ears", "wolf ears", "dog ears", "animal ear fluff", "cat tail", "fox tail", "horse tail", "demon tail", "rabbit tail", "multiple tails", "feathered wings", "bat wings", "fairy wings", "head wings", "dragon horns", "claws", "mechanical arms",
            "animal hands", "extra arms", "extra hands", "clawed hands", "mechanical hands",
            "mouse ears", "cow ears", "tiger ears", "raccoon ears", "bear ears", "lion ears",
            "deer ears", "sheep ears", "goat ears", "squirrel ears", "bat ears", "panda ears",
            "extra ears", "long pointy ears", "floppy ears", "kemonomimi mode",
            "white wings", "black wings", "red wings", "low wings", "bird wings", "ice wings",
            "detached wings", "insect wings", "asymmetrical wings", "single wing", "dragon wings",
            "multiple wings", "crystal wings", "mechanical wings", "energy wings", "transparent wings",
            "body fur", "scales", "tail wagging",

            "fins", "antennae",
        ]),
        ("job_classic", "職業・古風奇幻", [
            "knight", "samurai", "ninja", "oiran", "onmyouji", "viking", "gladiator", "witch",
            "wizard", "monk", "priest", "priestess", "blacksmith", "princess", "queen",
            "butler", "barmaid", "cowgirl (western)", "cowboy western",

            "shinsengumi",
        ]),
        ("job_modern", "職業・現代", [
            "office lady", "salaryman", "teacher", "nurse", "doctor", "scientist",
            "policewoman", "police", "soldier", "military", "firefighter", "pilot",
            "flight attendant", "astronaut", "lifeguard", "coach", "chef", "waitress",
            "barista", "bartender", "cashier", "farmer", "construction worker", "mechanic",
            "janitor", "idol", "model", "dancer", "ballerina", "race queen", "stripper",
            "dominatrix", "detective",
            "sailor",
        ]),
        ("persona", "人設", [
            "bride", "gyaru", "yandere", "tomboy", "otaku", "androgynous", "trap", "genderswap",
            "faceless male", "ugly bastard", "delinquent",

            "faceless female",
        ]),
        ("relation", "關係", [
            "couple", "husband and wife", "family", "siblings", "sisters", "brothers", "twins",
            "mother and daughter", "mother and son", "father and daughter", "yaoi",
            "age difference", "height difference", "size difference", "group picture",
            "matching outfits",
        ]),
    ],
    "pose": [
        ("body", "身體姿勢", None),
        ("cam_frame", "鏡頭・取景", [
            "portrait", "close-up", "upper body", "cowboy shot", "lower body", "full body",
            "wide shot", "very wide shot", "head out of frame", "feet out of frame",
            "cropped torso", "cropped legs", "cropped shoulders", "out of frame",
            "foot out of frame", "eyes out of frame",
            "fake screenshot", "fake phone screenshot", "viewfinder",

            "other focus",
        ]),
        ("cam_angle", "鏡頭・角度", [
            "straight-on", "from above", "from below", "from side", "from behind", "profile",
            "facing away", "over shoulder", "from outside", "bird's eye view",
            "worm's eye view", "dutch angle", "upside-down", "sideways", "pov", "pov hands",
            "pov crotch",

            "partially underwater shot", "pov across table", "aiming at viewer", "female pov", "facing to the side",
        ]),
        ("cam_fx", "鏡頭・畫面處理", [
            "fisheye", "foreshortening", "perspective", "vanishing point", "isometric",
            "symmetry", "blurry foreground", "letterboxed", "multiple views", "split screen",
            "reflection focus",

            "3d background", "black border", "outside border", "white border",

            "zoom layer", "pillarboxed", "chibi inset", "reference inset",
        ]),
        ("gaze", "視線", None),
        ("face_mood", "表情・情緒", [
            "smile", "light smile", "grin", "happy", "laughing", "smug", "smirk", "confident",
            "evil smile", "crazy smile", "forced smile", "nervous smile", "embarrassed", "shy",
            "flustered", "nervous", "surprised", "scared", "sad", "crying", "sobbing",
            "crying with eyes open", "tearing up", "angry", "annoyed", "frown", "pout",
            "serious", "expressionless", "bored", "sleepy", "yawning", "exhausted", "dazed",
            "drunk",
            "shaded face",
            "wince", "glaring", "faceless", "^^^", "full-face blush", "multiple expressions",
            "shouting",

            "light frown", "scowl", "disgust", "unamused", "confused", "grimace", "evil grin",
        ]),
        ("face_eyes", "表情・眼神", [
            "half-closed eyes", "one eye closed", "wide-eyed", "sparkling eyes", "empty eyes",
            "crazy eyes", "jitome", "rolling eyes", "raised eyebrow", "furrowed brow",
            ";d", ";)",
        ]),
        ("face_part", "表情・五官", [
            "dot nose", "nose", "no nose", "raised eyebrows", "raised inner eyebrows",
            "eyebrows hidden by hair",

            "wiping tears", "streaming tears",
        ]),
        ("face_mouth", "表情・嘴", [
            "closed mouth", "open mouth", "parted lips", "tongue out", "licking lips",
            "biting own lip", "clenched teeth", "drooling",
            "upper teeth only", "wavy mouth",
            ":d", ":o", ":3", ":p", ":<", ":q", ":t", ":>", ":/", ">:)", "d:",
            "split mouth", "triangle mouth", "chestnut mouth", "sideways mouth", "no mouth",
            "mouth drool",

            "puckered lips",
        ]),
        ("face_lewd", "表情・情色", [
            "come hither", "seductive smile", "naughty face", "aroused", "heavy breathing",
            "moaning", "orgasm", "ahegao", "torogao", "fucked silly", "penis awe", "breast awe", "rape face",
        ]),
        ("pose_stance", "動作・姿態", [
            "contrapposto", "standing on one leg", "ojou-sama pose", "head tilt", "arched back",
            "leaning forward", "leaning back", "leaning to the side", "leaning on object",
            "against wall", "against glass", "against window", "against mirror", "crossed legs", "knees up",
            "leg up", "legs up", "hugging own legs", "arm support", "facing viewer",
            "balancing", "spinning", "bouncing", "trembling",
            "against railing", "against tree", "in tree", "sitting in tree", "standing on liquid",
        ]),
        ("pose_hand", "動作・手的位置", [
            "arms at sides", "arms behind back", "arms behind head", "arms up", "arm up",
            "crossed arms", "hand on own hip", "hands on own hips", "w arms", "v arms",
            "hand on own chest", "hands on own breasts", "hands on own chest", "groping motion",
            "breast hold", "paizuri gesture", "hand on own cheek",
            "hand on own chin", "hand on own face", "hand on own neck", "hand in own hair",
            "hand on own thigh", "hands on own thighs", "hand on own knee", "hand in pocket",
            "hands in pockets", "holding own wrist", "own hands together", "covering own mouth",
            "covering own eyes", "finger to mouth", "cheek squash",
            "hand up", "hands up", "outstretched arms", "arm behind head",
            "arm across chest",
            "head rest", "own hands clasped", "hand on own arm",

            "hands on own face", "hand on own head", "hand to own mouth", "hands on own cheeks", "hands on own head", "open hands", "hand over own mouth",
        ]),
        ("pose_sign", "動作・比手勢", [
            "shushing", "v", "double v",
            "heart hands", "finger heart", "index fingers together", "thumbs up", "ok sign",
            "finger gun", "paw pose", "salute", "index finger raised", "pointing",
            "pointing at viewer", "reaching", "reaching towards viewer", "outstretched hand",
            "beckoning", "waving", "blowing kiss", "between fingers",
            "clenched hand",
            "claw pose", "v over eye", "rabbit pose", "watson cross",
            "clenched hands", "open hand", "fox shadow puppet", "steepled fingers",
            "pointing at self", "pointing up",

            "fellatio gesture",
        ]),
        ("pose_two", "動作・兩人互動", [
            "hug", "bearhug", "head between thighs", "hug from behind", "cuddling", "clinging", "kiss", "holding hands",
            "interlocked fingers", "arms around neck", "hand on another's head",
            "hand on another's shoulder", "hand on another's face", "hand on another's cheek",
            "kabedon", "sitting on lap", "sitting between legs", "lap pillow", "princess carry",
            "piggyback", "shoulder carry", "back-to-back", "sandwiched", "feeding",
            "washing back",
            "lifting person", "kissing neck",
            "hand on another's chest", "hands on another's chest", "guiding hand",
            "arm hug", "head hug", "double arm hug", "caress", "girl sandwich", "head on chest",
            "side-by-side", "face-to-face", "facing another", "symmetrical pose", "lineup",
            "head on another's shoulder", "cheek-to-cheek", "heads together", "forehead-to-forehead",
            "leaning on person", "group hug", "arm around shoulder", "hand on another's waist",
            "hands on another's shoulders", "holding another's arm", "headpat", "cheek poking",
            "pointing at another", "high five", "fist bump", "whispering",
            "steppee focus",
            "shared umbrella", "shared scarf", "shared earphones",

            "carrying over shoulder",
        ]),
        ("pose_act", "動作・小動作", [
            "adjusting hair", "tying hair", "adjusting clothes", "adjusting eyewear",
            "adjusting gloves", "clothes tug", "clothes grab", "lifting own clothes",
            "washing hair", "after bathing", "splashing", "pillow hug", "self hug", "head on pillow",
            "face in pillow", "smelling", "licking", "punching", "struggling", "defeat", "between legs",
            "breast shake", "fanning breasts", "wiping breasts",

            "petting", "adjusting swimsuit",
        ]),
        ("pose_hold", "動作・手持物", [
            "holding weapon", "holding sword", "holding knife", "holding gun", "holding staff",
            "dual wielding", "aiming",
            "mouth hold",
            "holding cup", "holding phone", "holding umbrella", "holding fan",
            "holding own hair", "holding food", "holding book", "holding flower", "holding bag", "holding polearm",
            "holding bottle", "holding microphone", "holding tray", "holding instrument",
            "holding bouquet", "holding animal", "holding stuffed toy", "holding plate",
            "holding fruit", "holding fork", "holding spoon", "holding chopsticks",
            "holding candy", "holding bow (weapon)", "holding paper", "holding card",
            "holding camera", "holding pen", "holding broom", "holding box", "holding popsicle",
            "holding controller", "holding drink", "holding mask", "holding towel",
            "holding paintbrush", "holding basket", "holding cat", "holding ball", "holding shield",

            "holding lantern",
        ]),
        ("pose_situ", "曖昧情境", [
            "breast focus", "foot focus", "hip focus", "armpit focus", "eye focus",
            "back focus", "hand focus", "thigh focus", "pectoral focus", "hair focus",
            "navel focus", "leg focus",
            "spread cleavage", "wardrobe malfunction", "accidental exposure",
            "groping", "sexual harassment", "pulling another's clothes", "voyeurism", "breastfeeding", "netorare", "cheating (relationship)",
            "face to breasts", "breasts on head", "breast pillow", "breasts on another's back",
            "covering another's breasts", "imminent breast grab", "cheek-to-breast",
            "tickling breasts", "torso grab", "pectoral docking", "surrounded by hands",
            "weighing breasts", "finger between breasts", "bust measuring",
            "nipple guessing game (meme)", "imminent grope", "breasts on shoulders",
            "breast envy", "breast contest", "bust chart", "tawawa challenge",
            "disembodied hand", "shadow hands", "giant hand", "too many hands",
            "face to pecs",

            "midriff peek", "bra peek", "panty peek", "strap gap", "button gap", "crop top overhang", "pantylines", "plunging neckline", "necktie between breasts",
        ]),
        ("flash_lift", "走光・掀拉脫", [
            "skirt lift", "dress lift", "kimono lift", "clothes lift", "shirt lift",
            "sweater lift", "sports bra lift", "clothes pull", "shirt pull", "sweater pull",
            "dress pull", "one-piece swimsuit pull", "pants pull", "panty pull", "bra pull",
            "strap slip", "clothing aside", "swimsuit aside", "bikini bottom aside",
            "leotard aside", "wedgie", "undressing", "undressing another", "hand under clothes",
            "wind lift",
            "hand under shirt", "hand in bra", "hand in own bra", "hand in another's bra",
            "hand in bikini", "hand in another's shirt", "hand in another's clothes",
            "bra lift", "bra slip", "sports bra pull", "leotard pull", "bikini top pull",
            "camisole pull", "strap pull", "double strap slip", "piercing pull",

            "breast slip", "bikini top lift", "untied bikini top", "untied bikini bottom", "bikini bottom pull", "skirt pull", "shorts pull", "pantyhose pull",
        ]),
        ("flash_expose", "走光・露出", [
            "upskirt", "downblouse", "one breast out", "nipple slip", "areola slip", "cameltoe",
            "oppai challenge",
            "ass visible through thighs", "bulge", "erection under clothes", "flashing",
            "exhibitionism", "public nudity", "caught", "hidden camera",
            "clothed female nude male", "clothed male nude female",
            "pantyshot",

            "bursting breasts", "butt crack",
        ]),
        ("flash_pose", "走光・姿勢", [
            "bent over", "presenting", "jack-o' challenge", "m legs", "spread legs", "leg lift",
            "legs over head", "straddling", "ass focus", "pussy focus",
            "crotch focus", "penis focus",
            "between breasts", "arm between breasts", "between thighs", "hand on own ass", "hand on own crotch",
            "covering breasts", "covering one breast", "covering crotch", "covering privates", ]),
        ("sex_pos", "性愛・體位與情境", [
            "sex", "vaginal", "anal", "missionary", "mating press", "piledriver (sex)", "folded",
            "leg lock", "boy on top", "girl on top", "cowgirl position",
            "reverse cowgirl position", "squatting cowgirl position", "amazon position",
            "upright straddle", "reverse upright straddle", "doggystyle", "standing doggystyle",
            "prone bone", "sex from behind", "spooning", "standing sex", "full nelson",
            "suspended congress", "reverse suspended congress", "mounting",
            "guided penetration", "imminent penetration", "deep penetration", "stomach bulge",
            "clothed sex", "penetration through clothes", "happy sex", "rough sex",
            "stealth sex", "implied sex", "invisible man", "public indecency", "underwater sex",
        ]),
        ("sex_oral", "性愛・口手足與磨擦", [
            "french kiss", "fellatio", "imminent fellatio", "licking penis", "deepthroat",
            "irrumatio", "reverse fellatio", "throat bulge", "testicle sucking", "penis on face", "penis over eyes", "oral",
            "cunnilingus", "anilingus", "sitting on face", "69", "breast sucking",
            "licking nipple", "licking ear", "head between breasts", "head between pecs", "breast smother",
            "handjob", "two-handed handjob", "double handjob", "cooperative handjob",
            "nursing handjob", "footjob", "paizuri", "paizuri under clothes",
            "perpendicular paizuri", "straddling paizuri", "naizuri", "thigh sex", "buttjob",
            "hairjob", "armpit sex", "kneepit sex", "frottage", "grinding", "tribadism",
            "face between breasts", "licking breast", "biting nipple", "biting breast",
            "kissing breast", "sucking both nipples", "mutual breast sucking",
            "breast sucking through clothes", "sucking male nipple",
            "penis to breast", "penis under breasts", "penis over breasts", "twisted breasts",
            "folding paizuri", "assisted paizuri", "nursing paizuri", "paizuri while penetrated",
            "nursing fingering", "reverse nursing fingering", "reverse nursing handjob", "pecjob",

            "caressing testicles", "gloved handjob", "two-footed footjob", "cooperative fellatio",
        ]),
        ("sex_touch", "性愛・自慰愛撫", [
            "masturbation", "public masturbation", "masturbating while watching", "female masturbation", "male masturbation",
            "masturbation through clothes", "mutual masturbation", "hand in panties",
            "fingering", "anal fingering", "spread pussy", "spread ass", "spread anus",
            "pussy peek", "nipple tweak", "nipple pull", "ass grab", "crotch grab",
            "testicle grab", "grabbing from behind", "hickey", "chikan", "molestation",
            "sleep molestation", "holding sex toy", "dildo riding",
            "nipple rub", "nipple rub through clothes", "nipple tweak through clothes",
            "nipple stimulation through clothes", "nipple flick", "nipple press", "nipple push",
            "finger on nipple", "tickling nipples", "poking another's breast", "pectoral grab",
            "breast massage", "breast pull", "hand grabbing both breasts", "areola measuring",
            "nipple stimulation (female on male)", "grabbed breast over shoulder",
            "symmetrical docking", "asymmetrical docking", "breast on breast",
            "nipple-to-nipple", "nipples pressed together", "breast-to-pectoral docking",
            "hand milking", "forced lactation", "slapping with breasts", "breast crush",

            "clitoral stimulation",
        ]),
        ("sex_group", "性愛・多人", [
            "threesome", "mmf threesome", "ffm threesome", "foursome", "fivesome",
            "group sex", "orgy", "gangbang", "spitroast", "reverse spitroast",
            "double penetration", "triple penetration", "double vaginal", "double anal",
            "surrounded by penises", "public use", "netorase",
            "grabbing multiple others' breasts", "cooperative breast sucking",
            "cooperative nipple licking", "sucking on multiple breasts",
            "teamwork (sexual)", "take your pick", "breast pile", "surrounded by breasts",
            "cooperative breast smother",
        ]),
        ("sex_cum", "性愛・射精", [
            "cum", "ejaculation", "projectile cum", "handsfree ejaculation", "facial",
            "bukkake", "cum in mouth", "cum on tongue", "gokkun", "cum in pussy",
            "internal cumshot", "cum in ass", "cum overflow", "cumdrip", "cumdrip from penis",
            "excessive cum", "cum pool", "cum string", "cum bubble", "cum on body",
            "cum on breasts", "cum on stomach", "cum on legs", "cum on feet", "cum on hands",
            "cum on hair", "cum on penis", "cum on pussy", "cum on clothes",
            "cum through clothes", "cum in nose", "cum in container", "cumdump",
        ]),
        ("sex_after", "性愛・體液事後", [
            "precum", "precum drip", "precum string", "pussy juice", "pussy juice trail",
            "pussy juice puddle", "excessive pussy juice", "female ejaculation",
            "lactation through clothes", "impregnation", "after sex", "after vaginal",
            "after anal", "after fellatio", "after paizuri", "after ejaculation", "afterglow",

            "female orgasm",
        ]),
        ("sex_bdsm", "性愛・拘束支配", [
            "bondage", "bdsm", "restrained", "public bondage", "bound ankles", "frogtie", "hogtie",
            "captured", "tied to chair", "chained", "prisoner",
            "small penis humiliation", "chastity cage",
            "instant loss", "forced to watch",
            "tape bondage", "suspension", "crucifixion", "crotch rope", "butt plug",
            "anal beads", "leash pull", "pet play", "slave", "femdom", "pegging",
            "prostate milking", "humiliation", "objectification", "human furniture",
            "forniphilia", "spanking", "slapping", "slap mark", "whipping", "wax play",
            "electrostimulation", "orgasm denial", "foot worship", "trampling", "crotch kick",
            "stomach punch", "head grab", "grabbing another's hair", "holding another's wrist",
            "neck grab", "strangling", "headlock", "rear naked choke", "asphyxiation",
            "rape", "after rape", "prostitution",
            "bound breasts", "tied breast", "slapping breasts", "breast punch",
            "nipple torture", "tied nipples", "nipple weights", "nipple leash",
            "nipple injection", "foot on another's breast",

            "hitachi magic wand", "vibrator under clothes",
        ]),
        ("sex_inside", "性愛・內部視圖", [
            "x-ray", "cross-section", "stomach (organ)", "ovum", "sperm cell", "fertilization",
        ]),
        ("sex_alien", "性愛・觸手異種", [
            "tentacles", "tentacle sex", "interspecies", "bestiality", "knotting",
            "parasite", "egg laying", "egg implantation",
            "tentacle between breasts", "grabbed by tentacles", "tentacles under clothes",
            "suction tentacles", ]),
        ("sex_insert", "性愛・插入擴張", [
            "object insertion", "vaginal object insertion", "large insertion",
            "penis size difference", "sex machine", "fisting", "anal fisting",
            "urethral insertion", "urethral fingering", "nipple penetration",
            "navel penetration", "cervical penetration", "gaping", "prolapse",
            "anal prolapse", "inflation", "cum inflation", "enema",
        ]),
        ("sex_fetish", "性愛・特殊癖好", [
            "mind control", "hypnosis", "corruption", "transformation", "petrification",
            "encasement", "food on body", "whipped cream", "chocolate on body",
            "cum on food", "nyotaimori", "peeing", "scat", "vore", "unbirthing", "digestion",
            "guro", "necrophilia",
            "sex doll",
        ]),
        ("act_daily", "活動・日常", [
            "eating", "drinking", "cooking", "cleaning", "shopping", "reading", "studying",
            "writing", "talking on phone", "selfie", "mirror selfie", "taking picture",
            "smoking", "carrying", "driving", "praying", "hiding",
            "recording",
            "talking", "pouring", "thinking", "applying makeup",

            "opening door",

            "waking up", "dressing", "playing with own hair", "unsheathing",
        ]),
        ("act_fun", "活動・娛樂表演", [
            "singing", "karaoke", "playing instrument", "playing guitar", "drawing (action)",
            "painting (action)", "playing games", "playing video games", "livestream",
            "pole dancing", "lion dance", "goldfish scooping", "picnic", "camping", "fishing",
            "flying",
        ]),
        ("act_sport", "活動・運動", [
            "playing sports", "exercising", "training", "stretching", "yoga", "jogging",
            "hiking", "weightlifting", "track and field", "tennis", "badminton",
            "table tennis", "soccer", "golf", "archery", "boxing", "skiing",
            "horseback riding", "riding bicycle",
            "fighting",
            "wrestling", "suplex", "german suplex", "submission hold", "armlock", "scissorhold",
            "choke hold", "triangle choke", "piledriver (wrestling)", "pinned", "catfight",
            "mixed-sex combat",
            "arm wrestling", "sumo", "mixed martial arts", "martial arts", "cheering",
            "battle", "riding", "broom riding",

            "drawing bow",
        ]),
        ("act_water", "活動・玩水洗浴", [
            "bathing", "showering", "shared bathing", "swimming", "wading", "floating",
            "diving", "sunbathing",
            "partially submerged", "mixed-sex bathing",

            "soaking feet",
        ]),
    ],
    "clothing": [
        ("nude", "裸身", ["topless female", "topless male", "bottomless", "bare shoulders", "bare arms",
            "nude cover", "no shirt", "no pants",
        ]),
        ("era_jp", "時代・和風", [
            "japanese clothes", "kimono", "white kimono", "blue kimono", "purple kimono",
            "print kimono", "floral print kimono", "furisode", "open kimono", "yukata",
            "bath yukata", "uchikake", "haori", "hakama", "fundoshi", "tabi", "geta", "zouri",
            "okobo", "japanese armor",
            "short kimono", "sleeveless kimono",

            "black kimono", "red kimono", "pink kimono", "red hakama", "kariginu",
        ]),
        ("era_cn", "時代・中華", [
            "chinese clothes", "hanfu", "ruqun", "dudou", "chinese armor", "qipao",
            "tangzhuang",
        ]),
        ("era_west", "時代・西洋古典", [
            "ancient greek clothes", "chiton", "peplos", "himation", "toga", "roman clothes",
            "loincloth", "pelvic curtain", "tunic", "armor", "plate armor", "chainmail",
            "leather armor", "cloak", "hooded cloak", "cape", "capelet", "tabard", "shawl",
            "gown", "chemise", "corset", "waistcoat", "petticoat", "hoop skirt", "tailcoat",
            "breastplate",

            "full armor", "red cape",
        ]),
        ("era_folk", "民族服裝", [
            "korean clothes", "hanbok", "vietnamese clothes", "ao dai", "german clothes",
            "dirndl", "russian clothes", "sari", "harem outfit", "flamenco dress",
            "mexican clothes", "hawaiian clothes", "native american clothes",
            "ancient egyptian clothes",
        ]),
        ("op_dress", "連身・洋裝禮服", [
            "dress", "short dress", "sundress", "sleeveless dress", "strapless dress",
            "off-shoulder dress", "backless dress", "backless outfit", "sweater dress",
            "pinafore dress", "pencil dress", "sailor dress", "white dress", "black dress",
            "red dress", "pink dress", "blue dress", "green dress", "purple dress",
            "evening gown", "cocktail dress", "wedding dress",
            "frilled dress",
            "armored dress",

            "collared dress", "long dress", "pleated dress", "halter dress", "layered dress",
        ]),
        ("op_uniform", "連身・制服套裝", [
            "school uniform", "serafuku", "gakuran", "gym uniform", "track uniform",
            "sportswear", "basketball uniform", "soccer uniform", "baseball uniform",
            "tennis uniform", "volleyball uniform", "cheerleader", "wrestler", "referee", "maid", "apron", "miko",
            "nun", "police uniform", "military uniform", "suit", "business suit", "pant suit",
            "tuxedo", "hospital gown", "racing suit", "mecha pilot suit", "overalls", "jumpsuit",
            "idol clothes", "magical girl", "superhero costume", "santa costume",
            "track suit", "skirt suit",
            "traditional nun",

            "naval uniform",

            "nontraditional miko", "wa maid", "male maid", "unconventional maid", "roswaal mansion maid uniform", "employee uniform",
        ]),
        ("op_swim", "連身・泳裝", [
            "swimsuit", "one-piece swimsuit", "school swimsuit", "competition swimsuit",
            "casual one-piece swimsuit", "blue one-piece swimsuit", "red one-piece swimsuit",
            "white one-piece swimsuit", "bikini", "string bikini", "micro bikini",
            "o-ring bikini", "sports bikini", "blue bikini", "pink bikini", "slingshot swimsuit",
            "swim briefs", "wetsuit",
            "side-tie bikini bottom",

            "black one-piece swimsuit", "highleg one-piece swimsuit",
        ]),
        ("op_body", "連身・緊身特裝", [
            "leotard", "wrestling outfit", "singlet", "black leotard", "highleg leotard", "thong leotard", "playboy bunny",
            "reverse bunnysuit", "bodysuit", "black bodysuit", "blue bodysuit", "red bodysuit",
            "open bodysuit", "torn bodysuit", "latex bodysuit", "catsuit", "bodystocking",
            "living clothes", "straitjacket", "bikini armor", "power armor",
            "plugsuit (evangelion)",
            "spacesuit",

            "strapless leotard", "white leotard",

            "nontraditional playboy bunny",
        ]),
        ("op_night", "連身・睡衣情趣", [
            "pajamas", "nightgown", "negligee", "babydoll", "bathrobe", "lingerie",
            "bridal lingerie",
        ]),
        ("op_only", "只穿一件", [
            "underwear only", "naked shirt", "naked sweater", "naked apron", "naked towel",
            "naked coat", "naked jacket", "bikini top only",

            "naked cape", "naked sheet",
        ]),
        ("top_shirt", "上衣・襯衫T恤", [
            "shirt", "blouse", "collared shirt", "dress shirt", "sleeveless shirt", "t-shirt",
            "white shirt", "black shirt", "red shirt", "pink shirt", "blue shirt",
            "aqua shirt", "green shirt", "open shirt", "unbuttoned shirt", "shirt tucked in",
            "oversized shirt", "wet shirt", "see-through shirt", "torn shirt", "sailor shirt",
            "gym shirt", "jersey", "rash guard", "hoodie",
            "striped shirt", "frilled shirt", "off-shoulder shirt",
            "print shirt",

            "grey shirt", "yellow shirt", "purple shirt", "brown shirt", "cropped shirt", "polo shirt", "undershirt", "tied shirt",

            "open hoodie",
        ]),
        ("top_knit", "上衣・毛衣", [
            "sweater", "white sweater", "red sweater", "blue sweater", "green sweater",
            "ribbed sweater", "turtleneck", "turtleneck sweater", "off-shoulder sweater",
            "virgin killer sweater", "sweater vest",
            "sleeveless turtleneck", "aran sweater", "sleeveless sweater",

            "black sweater",
        ]),
        ("top_tank", "上衣・背心與上身", [
            "tank top", "white tank top", "black tank top", "red tank top", "camisole",
            "crop top", "tube top", "off shoulder", "cleavage cutout", "vest", "underbust",
            "sarashi",
            "black vest", "black camisole",

            "breast curtains",
        ]),
        ("bot_skirt", "下身・裙", [
            "skirt", "miniskirt", "microskirt", "pleated skirt", "plaid skirt", "pencil skirt",
            "long skirt", "high-waist skirt", "suspender skirt", "hakama skirt", "torn skirt",
            "black skirt", "white skirt", "blue skirt", "brown skirt",
            "frilled skirt",
            "hakama short skirt", "shorts under skirt", "bubble skirt", "overskirt",

            "red skirt", "green skirt", "grey skirt", "pink skirt", "purple skirt", "layered skirt", "denim skirt",
        ]),
        ("bot_pants", "下身・褲", [
            "pants", "jeans", "suit pants", "sweatpants", "yoga pants", "high-waist pants",
            "black pants", "blue pants", "brown pants", "shorts", "short shorts",
            "micro shorts", "denim shorts", "dolphin shorts", "bike shorts", "boxing shorts",
            "black shorts", "blue shorts", "buruma",
            "capri pants",
            "white pants", "grey pants", "white shorts",
        ]),
        ("uw_top", "內衣・胸罩", [
            "bra", "no bra", "white bra", "black bra", "pink bra", "blue bra", "lace bra",
            "strapless bra", "bustier", "sports bra", "black sports bra", "blue sports bra",
            "pink sports bra", "bra visible through clothes",

            "bow bra", "lace-trimmed bra", "red bra", "striped bra",
        ]),
        ("uw_bottom", "內衣・內褲", [
            "panties", "no panties", "white panties", "black panties", "red panties",
            "blue panties", "striped panties", "lace-trimmed panties", "side-tie panties",
            "highleg panties", "string panties", "thong", "g-string", "crotchless panties",
            "crotchless", "panties aside", "panties around one leg", "boxers", "briefs",
            "male underwear", "chastity belt", "maebari", "heart maebari",

            "pink panties", "purple panties", "frilled panties", "polka dot panties", "lace panties", "thong panties",
        ]),
        ("legs", "腿襪", ["loose socks",
            "black pantyhose", "white pantyhose", "brown pantyhose", "thighband pantyhose", "black socks", "striped thighhighs", "brown thighhighs", "red thighhighs", "leg warmers",
        ]),
        ("feet", "鞋履", ["armored boots",
            "greaves", "black shoes", "white shoes", "brown shoes", "red shoes", "black boots", "white boots", "brown boots", "black sandals", "flip-flops", "pumps",
        ]),
        ("outer", "外套", None),
        ("fab_sleeve", "衣料・袖子領口", [
            "long sleeves", "short sleeves", "wide sleeves", "puffy sleeves",
            "detached sleeves", "sleeves rolled up", "sailor collar", "mandarin collar",
            "halterneck", "side slit",
            "sleeveless", "puffy short sleeves", "puffy long sleeves", "sleeves past wrists", "juliet sleeves", "frilled sleeves", "layered sleeves", "high collar",
            "white sleeves", "black sleeves", "blue sleeves", "red sleeves", "purple sleeves",
            "pink sleeves", "green sleeves", "grey sleeves", "ribbon-trimmed sleeves", "sleeve cuffs",
            "fur-trimmed sleeves", "striped sleeves", "torn sleeves", "short over long sleeves",
            "single sleeve", "single detached sleeve", "sleeves pushed up", "three-quarter sleeves",
            "sleeves past fingers", "puffy detached sleeves",

            "raglan sleeves", "wing collar",
        ]),
        ("fab_material", "衣料・材質花紋", [
            "see-through clothes", "latex", "leather", "denim", "satin", "shiny clothes",
            "fishnets", "fur trim", "frills", "polka dot",
            "animal print", "cow print",
            "striped clothes", "plaid clothes", "floral print", "ribbon trim", "lace trim", "fur collar",
            "gold trim",
            "pinstripe pattern", "camouflage", "tiger print", "flag print", "food print",
            "leopard print", "leaf print", "egasumi", "bat print", "tiger stripes",
            "cross print", "cherry blossom print", "crescent print", "seigaiha", "yagasuri",
            "meandros", "bear print", "honeycomb (pattern)", "sakuramon", "musical note print",
            "asa no ha (pattern)", "bird print", "kikkoumon",

            "cloud print", "starry sky print", "neon trim",

            "vertical-striped clothes", "checkered clothes", "argyle clothes", "cross-laced clothes", "asymmetrical clothes",
        ]),
        ("fab_state", "衣料・穿著狀態", [
            "tight clothes", "skin tight", "oversized clothes", "revealing clothes",
            "open clothes", "unzipped", "clothes between breasts", "layered clothes",
            "swimsuit under clothes", "wet clothes", "torn clothes", "blood on clothes",
            "costume switch", "reverse outfit",
            "clothing cutout", "strapless", "highleg",

            "taut clothes", "unbuttoned", "asymmetrical legwear", "partially undressed", "jacket on shoulders",

            "partially unzipped",
        ]),
        ("fab_style", "衣料・穿搭風格", [
            "casual", "cosplay", "lolita fashion", "gothic lolita", "halloween costume",
            "animal costume",
            "formal clothes",
            "winter clothes", "goth fashion", "jirai kei", "yume kawaii", "arabian clothes",
            "indian clothes",
            "ouji fashion", "biker clothes", "ainu clothes", "y2k fashion", "cyber fashion",
            "streetwear", "punk",

            "enmaided",
        ]),
        ("fab_detail", "衣料・圍裙扣件", [
            "maid apron", "waist apron", "frilled apron", "suspenders", "buttons", "zipper",
            "zipper pull tab", "pocket", "breast pocket",
            "lapels", "legwear garter",
            "fake tail", "dress flower",

            "double-breasted",
        ]),
        ("acc_head", "飾品・帽子頭飾", [
            "hat", "top hat", "sun hat", "witch hat", "cowboy hat", "sombrero", "beret",
            "baseball cap", "police hat", "nurse cap", "chef hat", "hard hat", "helmet", "boxing headgear",
            "bicycle helmet", "swim cap", "bonnet", "hood", "turban", "hijab", "veil",
            "crown", "tiara", "circlet", "kokoshnik", "laurel crown", "halo",
            "maid headdress", "fake animal ears", "hair ornament", "hair ribbon", "hairband",
            "hairclip", "hairpin", "hair stick", "kanzashi",
            "hood down", "hair bow", "headband", "scrunchie", "hair bobbles", "star hair ornament", "feather hair ornament", "hair bell", "santa hat",
            "black hat", "white hat", "red hat", "blue hat", "brown hat", "green hat", "mini hat", "tokin hat",
            "mob cap", "peaked cap", "visor cap", "beanie", "headdress", "missing headwear",
            "unworn headwear", "unworn hat", "hat ornament", "hat flower", "x hair ornament", "hair tubes",
            "pom pom (clothes)",
            "head wreath",

            "headlamp",

            "straw hat", "mini crown", "headpiece",
        ]),
        ("acc_bow", "飾品・蝴蝶結緞帶", [
            "bow", "ribbon", "hat bow", "hat ribbon", "tassel",
            "print bow",

            "hair tie",
        ]),
        ("acc_face", "飾品・眼鏡面具耳機", [
            "glasses", "coke-bottle glasses", "sunglasses", "goggles", "eyewear on head",
            "eyepatch", "medical eyepatch", "mask", "wrestling mask", "masquerade mask", "headphones",
            "headphones around neck", "earbuds",
            "mask on head", "fox mask",
            "ear covers", "headset",
            "round eyewear", "semi-rimless eyewear", "black-framed eyewear", "red-framed eyewear",
            "under-rim eyewear", "rimless eyewear", "monocle", "bespectacled", "earphones",

            "goggles on head", "earmuffs",
        ]),
        ("acc_neck", "飾品・領帶頸飾", [
            "necktie", "black necktie", "blue necktie", "bowtie", "black bowtie", "ascot",
            "neck ribbon", "detached collar", "scarf", "choker", "collar", "black collar",
            "red collar", "animal collar",
            "neckerchief", "frilled collar",
            "black choker", "white choker", "red choker", "frilled choker", "ribbon choker",
            "red necktie", "green necktie", "yellow necktie",
            "red bowtie", "blue bowtie", "pink bowtie", "white bowtie",
            "red neckerchief", "yellow neckerchief", "blue neckerchief", "black neckerchief",
            "yellow ascot", "white ascot", "red ascot",
            "red scarf", "white scarf", "blue scarf", "black scarf",
            "neck bell", "lanyard",

            "bandana",
        ]),
        ("acc_jewel", "飾品・首飾穿環", [
            "jewelry", "necklace", "bead necklace", "cross necklace", "tooth necklace",
            "flower necklace", "pendant", "gold chain", "prayer beads", "lei", "gem", "brooch",
            "earrings", "stud earrings", "hoop earrings", "tassel earrings", "ring",
            "wedding ring", "bracelet", "wrist cuffs", "watch", "anklet", "belly chain",
            "piercing", "ear piercing", "nose ring", "tongue piercing", "navel piercing",
            "chinese knot", "celtic knot",
            "armlet", "spikes",
            "jingle bell", "pearl necklace", "chain necklace", "magatama",

            "single earring", "bangle",
        ]),
        ("acc_hand", "飾品・手套腰帶護具", [
            "gloves", "black gloves", "elbow gloves", "fingerless gloves", "latex gloves",
            "boxing gloves", "belt", "black belt", "brown belt", "belt buckle", "buckle",
            "obi", "sash", "o-ring", "armband", "shoulder armor", "knee pads",
            "elbow pads", "championship belt", "martial arts belt",
            "wristband", "gauntlets", "pauldrons",
            "bridal gauntlets", "epaulettes",
            "white gloves", "red gloves", "brown gloves", "blue gloves", "purple gloves", "pink gloves",
            "single glove", "partially fingerless gloves", "half gloves", "paw gloves", "mittens",
            "fur-trimmed gloves",

            "obijime", "tasuki", "vambraces", "wristwatch",
        ]),
        ("acc_carry", "飾品・隨身物品", [
            "bag", "handbag", "shoulder bag", "backpack", "pouch", "suitcase", "umbrella",
            "parasol", "oil-paper umbrella", "towel", "name tag", "clipboard", "stethoscope",
            "microphone", ]),
        ("acc_bandage", "飾品・繃帶OK繃", [
            "bandages", "bandaged arm", "bandaged leg", "bandaged head",
            "bandage over one eye", "bandaid", "bandaid on face", "bandaid on cheek",
            "bandaid on nose", "bandaid on knee", "bandaid on pussy",
            "needle",
        ]),
        ("acc_toy", "飾品・情趣用品", [
            "sex toy", "vibrator", "egg vibrator", "remote control vibrator",
            "public vibrator", "vibrator cord", "vibrator in thighhighs", "vibrator on nipple",
            "dildo", "strap-on", "condom", "multiple condoms", "used condom",
            "holding condom", "condom in mouth", "condom wrapper", "condom box", "pasties",
            "cross pasties", "nipple tassels", "nipple clamps", "nipple rings", "nipple bar",
            "breast pump", "milking machine", "nipple suction cups", "speculum",
            "heart pasties",
        ]),
        ("acc_bind", "飾品・拘束具", [
            "blindfold", "gag", "ball gag", "bit gag", "ring gag", "tape gag", "nose hook",
            "gagged", "improvised gag", "cleave gag", "gag harness",
            "leash", "chain leash", "handcuffs", "cuffs", "shackles", "restraints",
            "bound wrists", "bound arms", "bound legs", "bound torso",
            "rope", "shibari", "shibari over clothes", "spreader bar", "pillory", "stocks",
        ]),
    ],
    "env": [
        ("inout", "室內外", None),
        ("pl_home", "地點・住家", [
            "bedroom", "bed", "canopy bed", "futon", "living room", "kitchen",
            "dining room", "bathroom", "bathtub", "shower (place)", "closet", "messy room",
            "otaku room", "washitsu", "genkan", "apartment", "balcony", "porch", "rooftop",
            "garage", "window", "couch",
            "house",
        ]),
        ("pl_bath", "地點・浴場泳池", [
            "onsen", "bath", "bathhouse", "ofuro", "bubble bath", "sauna", "pool",
            "poolside", "pool ladder", "empty pool", "water slide",
        ]),
        ("pl_school", "地點・學校職場", [
            "school", "classroom", "clubroom", "library", "infirmary", "cafeteria",
            "school gym", "locker room", "changing room", "office", "laboratory",

            "gym storeroom",
        ]),
        ("pl_passage", "地點・通道廠房", [
            "hallway", "elevator", "warehouse", "factory", "construction site",
        ]),
        ("pl_shop", "地點・店家餐飲", [
            "cafe", "maid cafe", "restaurant", "izakaya", "bar (place)", "tavern",
            "conveyor belt sushi", "yatai", "market", "market stall", "convenience store",
            "supermarket", "shop", "bakery", "clothes shop", "fitting room", "flower shop",
            "bookstore", "laundromat", ]),
        ("pl_fun", "地點・娛樂住宿", [
            "hotel room", "love hotel", "ryokan", "karaoke box", "internet cafe", "arcade",
            "casino", "nightclub", "ballroom", "movie theater", "theater", "stage",
            "backstage", "dressing room", "concert", "museum", "planetarium", "aquarium", "zoo",
            "amusement park", "ferris wheel", "carousel", "roller coaster", "skating rink",
            "festival",
        ]),
        ("pl_sport", "地點・運動場", [
            "fitness gym", "dojo", "stadium", "sports court", "basketball court",
            "tennis court", "soccer field", "baseball stadium", "golf course", "running track",
            "boxing ring", "wrestling ring", "arena", "bowling alley", ]),
        ("pl_public", "地點・公共設施", [
            "hospital", "clinic", "prison", "prison cell", "dungeon",
            "public restroom", "toilet stall", "glory hole", "sewer", "parking lot",
            "airport", "train station", "train station platform", "subway station",
            "bus stop",
        ]),
        ("pl_ride", "地點・交通工具", [
            "car", "car interior", "taxi", "bus", "bus interior", "train", "train interior",
            "subway", "streetcar", "steam locomotive", "vehicle interior", "airplane interior",
            "cockpit", "airship", "boat", "rowboat", "ship", "pirate ship", "submarine",
            "carriage", "spacecraft", "spacecraft interior", "gondola",
            "rickshaw", "bicycle",
            "airplane",
        ]),
        ("pl_street", "地點・街道城市", [
            "street", "alley", "city", "cityscape", "skyline", "skyscraper", "park",
            "park bench", "fountain", "gazebo", "bridge", "pedestrian bridge", "highway",
            "tunnel", "railroad tracks", "railroad crossing", "industrial", "clock tower", "gas station", "playground",
        ]),
        ("pl_water", "地點・海邊水邊", [
            "beach", "shore", "ocean", "island", "coral reef", "underwater", "seafloor",
            "shipwreck", "river", "riverbank", "stream", "lake", "pond", "waterfall",
            "wetland",
            "canal", "pier", "harbor", "dock", "lighthouse",
        ]),
        ("pl_nature", "地點・山野田園", [
            "forest", "bamboo forest", "jungle", "mountain", "hill", "cliff",
            "valley", "canyon", "cave", "cave interior", "volcano", "lava", "glacier",
            "desert", "sand dune", "oasis", "savannah", "meadow", "field", "flower field",
            "sunflower field", "wheat field", "rice paddy", "farm", "barn", "greenhouse",
            "garden", "courtyard", "treehouse", "tent", "igloo",
            "village", "rural",
            "nature",
        ]),
        ("pl_history", "地點・古蹟宗教", [
            "shrine", "torii", "temple", "pagoda", "east asian architecture",
            "middle eastern architecture", "pavilion",
            "palace", "castle", "throne", "throne room", "mansion", "gothic architecture",
            "colonnade", "colosseum", "ruins", "altar", "graveyard", "battlefield",
            "church", "cathedral",
        ]),
        ("pl_landmark", "地點・名勝奇幻", [
            "tokyo", "shibuya (tokyo)", "kyoto (city)", "mount fuji", "tokyo tower",
            "tokyo skytree", "new york city", "statue of liberty", "elizabeth tower",
            "eiffel tower", "taipei 101", "pyramid (structure)", "sphinx", "space", "space station", "planet",
            "earth (planet)", "asteroid", "floating island", "floating city",
            "underwater city", "heaven", "hell", "tentacle pit",
            "scarlet devil mansion",
        ]),
        ("background", "背景", None),
        ("furniture", "坐臥面", None),
        ("time", "晝夜", None),
        ("weather", "天氣", ["wind", "smoke", "dust",
            "snowing",
        ]),
        ("sky", "天空", ["full moon", "sky focus",
            "grey sky", "cumulonimbus cloud", "constellation", "contrail", "red moon",
        ]),
        ("light", "光線", ["campfire"]),
        ("fx_comic", "特效・漫畫符號", [
            "heart", "spoken heart", "anger vein", "motion lines", "speed lines",
            "emphasis lines", "afterimage", "time stop", "glitch",
            "star (symbol)",

            "musical note", "notice lines", "puff of air", "spoken musical note", "squiggle", "zzz",
        ]),
        ("fx_glow", "特效・光", [
            "glowing", "aura", "light particles", "sparkle", "sparks", "embers", "blue fire",
            "electricity", "lightning", "magic circle", "fireworks", "sparkler", "glowstick",
            "shooting star", "rainbow", "caustics",
            "fire", "explosion", "burning", "pyrokinesis", "purple fire", "breathing fire", "fireflies",
            "aerial fireworks", "hitodama", "window shadow", "colored shadow",

            "glint", "light trail", "sunburst",
        ]),
        ("fx_fall", "特效・飄落", [
            "water drop", "dripping", "ripples", "bubble", "soap bubbles", "snowflakes", "petals", "falling petals", "falling leaves", "confetti", "floating clothes",

            "breath", "falling feathers",
        ]),
        ("fx_lens", "特效・鏡頭", [
            "depth of field", "bokeh", "lens flare", "bloom", "diffraction spikes",
            "motion blur", "chromatic aberration", "film grain",
        ]),
        ("obj_build", "景物・建築地面", [
            "architecture", "building", "european architecture", "greco-roman architecture",
            "tower", "windmill", "arch", "pillar", "stone wall", "brick wall",
            "stained glass", "iron bars", "railing", "fence", "chain-link fence", "hedge",
            "stairs", "stone stairs", "spiral staircase", "escalator", "floor",
            "wooden floor", "stone floor", "tiles", "tatami", "shouji", "fusuma", "noren",
            "veranda",
            "chain",

            "ceiling", "checkered floor", "door", "doorway", "gate", "ladder", "open door", "open window", "pole", "reflective floor", "sliding doors", "tile floor", "tile wall", "tombstone", "wooden fence", "wooden wall", "spider web",
        ]),
        ("obj_street", "景物・街景", [
            "town", "urban", "road", "dirt road", "path", "sidewalk", "crosswalk",
            "power lines", "utility pole", "billboard", "graffiti", "bulletin board",
            "vending machine", "phone booth", "abandoned", "rubble",
            "shopping cart",

            "pavement", "road sign", "poster (object)", "trash can",
        ]),
        ("obj_furn", "景物・家具寢具", [
            "table", "desk", "counter", "chair", "office chair", "swivel chair",
            "gaming chair", "bench", "wooden bench", "nightstand", "bookshelf", "locker",
            "kotatsu", "poker table", "pillow", "blanket", "bed sheet", "carpet", "curtains", "mirror",
            "full-length mirror", "clock", "sink", "shower head", "tissue box", "whiteboard",
            "stool", "cushion", "armchair",

            "school desk", "school chair", "chalkboard", "book stack", "cabinet", "drawer", "flower pot", "picture frame", "potted plant", "rug", "shelf", "tablecloth", "wooden table", "window blinds", "faucet", "toilet", "folding chair", "lounge chair",
        ]),
        ("obj_classic", "景物・古風擺設", [
            "folding screen", "stone lantern", "paper lantern", "rock garden", "incense",
            "incense burner", "scroll", "calligraphy", "ofuda", "komainu", "jizou",
            "teapot", "teacup", "tea set", "silk", "beads", "amphora", "birdcage", "cage",
            "crystal ball", "pocket watch", "cane", "statue", "lace",

            "barrel", "candlestand", "gohei", "shimenawa", "vase", "wind chime", "wooden bucket", "treasure chest",
        ]),
        ("obj_plant", "景物・植物動物", [
            "tree", "pine tree", "willow", "palm tree", "bamboo", "bush", "grass", "moss",
            "overgrown", "rose", "lotus", "chrysanthemum", "sunflower", "koi", "horse",
            "cherry blossoms", "autumn leaves", "maple leaf", "plum blossoms",
            "flower", "leaf", "feathers",
            "plant", "bouquet", "hibiscus", "lily (flower)", "spider lily", "hydrangea", "rose petals",
            "animal focus", "flower focus", "plant focus", "creature focus", "pokemon focus",

            "black flower", "black rose", "blue flower", "blue rose", "orange flower", "pink flower", "pink rose", "purple flower", "purple rose", "red flower", "red rose", "white flower", "white rose", "yellow flower", "yellow rose", "green flower", "camellia", "daisy (flower)", "tulip", "white lily", "wisteria", "bare tree", "branch", "lily pad", "palm leaf", "tree stump", "vines", "bird", "butterfly", "cat", "dog", "fish",
        ]),
        ("obj_land", "景物・地景水土", [
            "scenery", "landscape", "horizon", "mountainous horizon", "rock", "stalactite",
            "sand", "water", "puddle", "reflection", "condensation", "slime (substance)",

            "crystal", "seashell", "shallow water", "starfish", "waves",
        ]),
        ("obj_food", "物品・飲食", [
            "cup", "mug", "bottle", "wine glass", "coffee", "bubble tea", "beer",
            "wine", "sake", "champagne", "rice bowl", "chopsticks", "onigiri", "sushi",
            "ramen", "curry", "pasta", "pizza", "taco", "bread", "mooncake", "cake",
            "cookie", "donut", "chocolate", "candy", "lollipop", "ice cream", "popsicle",
            "strawberry", "apple", "grapes", "olive",
            "food", "fruit", "drink", "alcohol", "plate", "tray", "bowl", "spoon", "fork", "can",
            "drinking straw", "ice", "pocky", "carrot", "pumpkin", "tea", "burger", "mushroom",
            "cherry", "watermelon", "peach", "noodles", "dango", "orange (fruit)",
            "heart-shaped chocolate", "macaron", "parfait", "sandwich", "pancake", "cupcake",
            "wagashi", "rice", "ice cream cone", "coffee mug", "beer mug", "birthday cake",
            "food focus",

            "cooking pot", "drinking glass", "kettle",
        ]),
        ("obj_hand", "物品・手持小物", [
            "book", "newspaper", "pen", "pencil", "quill", "calligraphy brush", "paintbrush",
            "phone", "cellphone", "smartphone", "selfie stick", "camera", "cigarette",
            "cigar", "smoking pipe", "kiseru", "folding fan", "hand fan", "uchiwa",
            "shopping bag", "basket", "broom", "mop", "bucket", "ladle",
            "frying pan", "scissors", "key", "bell", "playing card", "balloon",
            "stuffed toy", "teddy bear",
            "cosmetics", "hand mirror", "flashlight",
            "object focus",

            "cardboard box", "doll", "gift",

            "unworn panties", "unworn bra",
        ]),
        ("obj_tech", "物品・電器機台", [
            "computer", "laptop", "monitor", "game controller", "arcade cabinet",
            "crane game", "purikura", "steering wheel", "microphone stand",
            "cable",

            "air conditioner", "alarm clock", "electric fan", "light bulb", "refrigerator", "television", "aircraft", "fighter jet", "flight deck", "military vehicle", "motor vehicle", "motorcycle", "sports car", "truck", "smokestack", "watercraft", "warship",
        ]),
        ("obj_music", "物品・樂器", ["guitar", "piano", "violin", "drum", "lyre", "guqin", "erhu"]),
        ("obj_weapon", "物品・武器", [
            "sword", "katana", "knife", "spear", "polearm", "trident", "staff", "shield",
            "gun", "handgun", "rifle", "arrow (projectile)",
            "bow (weapon)",
            "weapon focus",

            "glowing sword", "glowing weapon",
        ]),
        ("obj_sport", "物品・運動海灘", [
            "basketball (object)", "soccer ball", "volleyball (object)", "baseball (object)",
            "tennis ball", "golf ball", "bowling ball", "table tennis ball", "shuttlecock",
            "baseball bat", "baseball mitt", "tennis racket", "badminton racket",
            "table tennis paddle", "golf club", "dumbbell", "skateboard",
            "surfboard", "innertube", "beach umbrella", "beach towel", "fishing rod",
            "pom pom (cheerleading)",
            "ball", "beachball",

            "rubber duck",
        ]),
        ("obj_flag", "物品・旗幟", [
            "banner", "japanese flag", "american flag", "french flag", "german flag",
            "russian flag", "mexican flag", "brazilian flag",
        ]),
        ("obj_fest", "節慶", [
            "christmas", "christmas tree", "new year", "chinese new year", "lantern festival", "mid-autumn festival", "summer festival", "halloween", "easter", "oktoberfest", "wedding",
            "happy birthday", "happy new year", "merry christmas", "valentine", "birthday",
            "anniversary", "jack-o'-lantern",

            "happy halloween", "happy valentine", "nengajou", "year of the rabbit", "year of the tiger", "wreath", "setsubun", "tanabata",
        ]),
        ("obj_theme", "題材", [
            "winter", "tropical", "fantasy", "magic", "medieval", "victorian", "tribal",
            "science fiction", "post-apocalypse", "surreal",
            "mecha",
            "summer",
            "world war ii",
            "vehicle focus", "mecha focus", "monster focus", "text focus",
            "clothes focus", "footwear focus",

            "spring (season)", "autumn", "snowman",
        ]),
    ],
}


SUB_ORDER = {sec: [sid for sid, _, _ in rows] for sec, rows in SUBS.items()}
SUB_ZH = {sid: zh for rows in SUBS.values() for sid, zh, _ in rows}

_EXPLICIT = {}
for _sec, _rows in SUBS.items():
    for _sid, _zh, _tags in _rows:
        for _t in _tags or ():
            if (_sec, _t) in _EXPLICIT:
                raise ValueError(f"subgroups.py：{_sec}/{_t} 同時在 {_EXPLICIT[(_sec, _t)]} 和 {_sid}")
            _EXPLICIT[(_sec, _t)] = _sid


def assign_sub(item: dict) -> str | None:
    """這個字放在哪個細分類。拆開的小分類裡沒被收走的字回 None（merge 會報錯）。"""
    sec, tag, grp = item.get("section"), item.get("tag"), item.get("group")
    hit = _EXPLICIT.get((sec, tag))
    if hit:
        return hit
    # 角色的細分類是作品（character_sub_id），merge 帶進來，
    # 不把幾百個名字抄進上面的清單。只接受這個段已經登記的 id。
    hinted = item.get("sub")
    if hinted and hinted in SUB_ORDER.get(sec, []) and (sec, grp) in SPLIT:
        return hinted
    if (sec, grp) in SPLIT:
        return None
    return grp


def check_subs(items: list[dict]) -> list[str]:
    """回傳問題清單：沒有位置的字、清單裡寫了但詞庫沒有的字、空的細分類、撞名。"""
    problems = []
    groups_by_sec = {}
    for it in items:
        groups_by_sec.setdefault(it["section"], set()).add(it["group"])
    for sec, rows in SUBS.items():
        for sid, _, tags in rows:
            if tags is None and (sec, sid) in SPLIT:
                problems.append(f"{sec}/{sid}：拆開的小分類不能原樣保留")
            if sid in groups_by_sec.get(sec, set()) and (sec, sid) in SPLIT:
                problems.append(f"{sec}/{sid}：拆開的小分類不能沿用原本的 id")
    have = {(it["section"], it["tag"]) for it in items}
    for (sec, tag), sid in _EXPLICIT.items():
        if (sec, tag) not in have:
            problems.append(f"{sec}/{sid}：詞庫裡沒有 {tag!r}")
    used = {}
    for it in items:
        sub = assign_sub(it)
        if sub is None:
            problems.append(f"{it['section']}/{it['group']}：{it['tag']!r} 沒有細分類，請在 scripts/subgroups.py 的 SUBS 裡放進一格")
            continue
        if sub not in SUB_ORDER.get(it["section"], []):
            problems.append(f"{it['section']}/{sub}：不在 SUBS 的順序裡（{it['tag']!r}）")
        used.setdefault(it["section"], set()).add(sub)
    for sec, order in SUB_ORDER.items():
        for sid in order:
            if sid not in used.get(sec, set()) and sid != "fixed":
                problems.append(f"{sec}/{sid}：沒有任何字")
    return problems
