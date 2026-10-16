# -*- coding: utf-8 -*-
"""2026-10-12 focus_tags.csv。

CSV 的「構圖／主體／身體部位」只當提示，互斥按畫面怎麼打架重設。

部位焦點（part_focus）：一張圖只聚焦一個身體部位。不佔鏡頭格，
所以可以跟近景、俯角、cowboy shot 疊。臀部、陰部、胯部、陰莖只走進光和性愛。
陰部跟上半身的互斥在引擎裡，這裡不再加第二套。

主題焦點（topic_focus）：畫面在講食物、天空、動物、衣服……彼此互斥，
也不佔鏡頭格。食物、花、植物、天空、機甲帶出那個東西本身。
怪物不帶怪物種族（那會把人換成種族格）。

人數：單人焦點本來就在，引擎收尾才補，不進隨機池。
男性焦點放在人數段，釘了會要求畫面有男生；人數段沒有隨機補牌。
其他性別焦點不收：沒有可畫的內容，又會落在有性別的人身上。
"""

from __future__ import annotations


def _row(tag, zh, section, mutex=None, layer="normal", era=None, gate="any",
         implies=(), extra=(), needs=(), heat=None):
    out = {
        "tag": tag,
        "section": section,
        "gate": gate,
        "heat": list(heat or ["tease", "flash", "sex"]),
        "mutex": mutex,
        "bind": [],
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
    p, e, s = "pose", "env", "subject"
    part = "part_focus"
    topic = "topic_focus"
    exposed = ["flash", "sex"]
    rows = []
    A = rows.append

    # 構圖。男性焦點是人數，不是鏡頭。
    A(_row("male focus", "男性焦點", s, gate="male"))
    A(_row("reflection focus", "倒影焦點", p))
    A(_row("steppee focus", "被踩者焦點", p, needs=("pair",)))

    # 主題。機甲的時代是現代，帶出之後時代會跟著收。
    for tag, zh, implies in (
        ("pokemon focus", "寶可夢焦點", ()),
        ("text focus", "文字焦點", ()),
        ("mecha focus", "機甲焦點", ("mecha",)),
        ("object focus", "物品焦點", ()),
        ("creature focus", "生物焦點", ()),
        ("monster focus", "怪物焦點", ()),
        ("weapon focus", "武器焦點", ()),
        ("sky focus", "天空焦點", ("sky",)),
        ("footwear focus", "鞋類焦點", ()),
        ("flower focus", "花卉焦點", ("flower",)),
        ("plant focus", "植物焦點", ("plant",)),
        ("clothes focus", "服裝焦點", ()),
    ):
        A(_row(tag, zh, e, mutex=topic, implies=implies))

    # 身體部位。日常看得到的走三檔；胯部與陰莖跟臀部、陰部一樣停在走光。
    for tag, zh, implies, gate in (
        ("armpit focus", "腋下焦點", (), "any"),
        ("eye focus", "眼睛焦點", (), "any"),
        ("back focus", "背部焦點", (), "any"),
        ("hand focus", "手部焦點", (), "any"),
        ("thigh focus", "大腿焦點", (), "any"),
        ("hair focus", "頭髮焦點", (), "any"),
        ("leg focus", "腿部焦點", (), "any"),
        ("navel focus", "肚臍焦點", ("navel",), "any"),
        ("pectoral focus", "胸肌焦點", ("pectorals",), "male"),
    ):
        A(_row(tag, zh, p, mutex=part, implies=implies, gate=gate))
    A(_row("crotch focus", "胯部焦點", p, mutex=part, heat=exposed))
    A(_row("penis focus", "陰莖焦點", p, mutex=part, gate="male",
          needs=("male",), heat=exposed))
    return rows


if __name__ == "__main__":
    got = build()
    print(len(got), len({r["tag"] for r in got}), len({r["zh"] for r in got}))
