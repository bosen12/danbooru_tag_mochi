# -*- coding: utf-8 -*-
"""2026-10-26 大批新字・第一批衣服。

分類照詞庫裡最像的現有字（後綴父字、同父的顏色款）。
國中制服進詞庫再封鎖。作品專屬（含作品學園制服）與 meta 只在釘了才出現。
燈籠褲、白燈籠褲不收（2026-10-23 主人看過圖，人物幼態）。
"""
from __future__ import annotations

ROWS = [
  {
    "tag": "headgear",
    "zh": "頭戴裝備",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "blue ribbon",
    "zh": "藍色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "white ribbon",
    "zh": "白色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "yellow bow",
    "zh": "黃色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "green bow",
    "zh": "綠色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "pink ribbon",
    "zh": "粉紅色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "purple bow",
    "zh": "紫色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "swim ring",
    "zh": "游泳圈",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "yellow ribbon",
    "zh": "黃色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "school bag",
    "zh": "書包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "striped bow",
    "zh": "條紋蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "mouth mask",
    "zh": "口罩／口鼻面罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "animal hood",
    "zh": "動物兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "heart hair ornament",
    "zh": "愛心髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "tress ribbon",
    "zh": "髮束緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "green ribbon",
    "zh": "綠色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "fake horns",
    "zh": "假角",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "purple ribbon",
    "zh": "紫色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "butterfly hair ornament",
    "zh": "蝴蝶髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "spaghetti strap",
    "zh": "細肩帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "back bow",
    "zh": "背後蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "orange bow",
    "zh": "橘色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "animal ear hairband",
    "zh": "動物耳髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "tail ornament",
    "zh": "尾巴飾品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "emblem",
    "zh": "徽章／紋章",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "newsboy cap",
    "zh": "報童帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "food-themed hair ornament",
    "zh": "食物造型髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "frog hair ornament",
    "zh": "青蛙髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "triangular headpiece",
    "zh": "三角頭巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "headpiece"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pink hat",
    "zh": "粉紅色帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "rabbit ear hairband",
    "zh": "兔耳髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "horn ornament",
    "zh": "角飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "holster",
    "zh": "槍套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "red halo",
    "zh": "紅色光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "bridal veil",
    "zh": "新娘頭紗",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "veil"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "mechanical halo",
    "zh": "機械光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "forehead jewel",
    "zh": "額頭寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "arm strap",
    "zh": "臂帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "ear ornament",
    "zh": "耳飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "purple hat",
    "zh": "紫色帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "snake hair ornament",
    "zh": "蛇造型髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "blue gem",
    "zh": "藍色寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gem"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "animal hat",
    "zh": "動物帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "unworn eyewear",
    "zh": "未穿戴的眼鏡類",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "frilled bow",
    "zh": "荷葉邊蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "striped necktie",
    "zh": "條紋領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "nun headdress",
    "zh": "修女頭巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "headdress"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "sack",
    "zh": "麻袋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "harness",
    "zh": "馬具／束帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "white belt",
    "zh": "白色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "lolita hairband",
    "zh": "洛麗塔髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "hat feather",
    "zh": "帽上羽毛",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "asymmetrical gloves",
    "zh": "不對稱手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "tilted headwear",
    "zh": "歪戴的帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "headscarf",
    "zh": "頭巾（headscarf）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "leg ribbon",
    "zh": "腿上緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "crescent hair ornament",
    "zh": "月牙髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "rabbit hair ornament",
    "zh": "兔子髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "white collar",
    "zh": "白色項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "animal ear piercing",
    "zh": "動物耳穿孔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ear piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "yellow halo",
    "zh": "黃色光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "strap",
    "zh": "肩帶／綁帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "spiked collar",
    "zh": "尖刺項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "bow hairband",
    "zh": "蝴蝶結髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "leaf hair ornament",
    "zh": "葉子髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "belt pouch",
    "zh": "腰帶小包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pouch"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "crescent hat ornament",
    "zh": "月牙帽飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hat ornament",
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "neck ring",
    "zh": "頸環（硬式）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "spiked bracelet",
    "zh": "尖刺手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "bracelet"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "charm (object)",
    "zh": "吊飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "frilled hairband",
    "zh": "荷葉邊髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "purple bowtie",
    "zh": "紫色領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "bead bracelet",
    "zh": "珠串手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "bracelet"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "blue choker",
    "zh": "藍色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "cross hair ornament",
    "zh": "十字架髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "badge",
    "zh": "徽章",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "ears through headwear",
    "zh": "耳朵穿出帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "aqua necktie",
    "zh": "水藍色領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "polka dot bow",
    "zh": "圓點蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "yellow bowtie",
    "zh": "黃色領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "arm guards",
    "zh": "護臂",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "grey gloves",
    "zh": "灰色手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "yellow hairband",
    "zh": "黃色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "floating earrings",
    "zh": "飄浮耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "striped bowtie",
    "zh": "條紋領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "star hat ornament",
    "zh": "星星帽飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hat ornament",
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "chest jewel",
    "zh": "胸前寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "ear bow",
    "zh": "耳朵蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "shoulder pads",
    "zh": "墊肩／護肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "traditional bowtie",
    "zh": "傳統領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "mini top hat",
    "zh": "迷你禮帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "top hat"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "arm ribbon",
    "zh": "手臂緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "cube hair ornament",
    "zh": "方塊髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "arm garter",
    "zh": "臂環(袖箍)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "white neckerchief",
    "zh": "白色領巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "neckerchief"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "grey hat",
    "zh": "灰色帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pink hairband",
    "zh": "粉紅色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "green gloves",
    "zh": "綠色手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "heart brooch",
    "zh": "愛心胸針",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "brooch"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "print gloves",
    "zh": "印花手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "belt collar",
    "zh": "皮帶項圈",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "multiple rings",
    "zh": "多枚戒指",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "chest harness",
    "zh": "胸前束帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "aqua bow",
    "zh": "水藍色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "white necktie",
    "zh": "白色領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "eye mask",
    "zh": "眼罩面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "plaid bow",
    "zh": "格紋蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "pink choker",
    "zh": "粉紅色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "whistle",
    "zh": "哨子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "green bowtie",
    "zh": "綠色領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "multicolored gloves",
    "zh": "多色手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "anchor hair ornament",
    "zh": "船錨髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "short necktie",
    "zh": "短領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "purple necktie",
    "zh": "紫色領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "cross earrings",
    "zh": "十字耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "forehead protector",
    "zh": "護額",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "animal ear headphones",
    "zh": "動物耳耳機",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "headphones"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_face",
    "mutexExtra": [
      "ear_audio"
    ]
  },
  {
    "tag": "multiple hair bows",
    "zh": "多個髮蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "tail bow",
    "zh": "尾巴蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "yellow gloves",
    "zh": "黃色手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "barbell piercing",
    "zh": "槓鈴型穿環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "skull hair ornament",
    "zh": "骷髏髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "plaid scarf",
    "zh": "格紋圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "red gem",
    "zh": "紅色寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gem"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "dog tags",
    "zh": "軍籍牌",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "horn ribbon",
    "zh": "角上緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "brown bow",
    "zh": "棕色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "flower knot",
    "zh": "花結（中國結）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "pink necktie",
    "zh": "粉紅色領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "mismatched gloves",
    "zh": "左右不一致的手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "frilled hair tubes",
    "zh": "荷葉邊髮管",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair tubes"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "aiguillette",
    "zh": "飾繩(肩飾帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "white wrist cuffs",
    "zh": "白色腕套(袖口)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "wrist cuffs"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "traditional halo",
    "zh": "傳統光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "waist bow",
    "zh": "腰前蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "dress bow",
    "zh": "洋裝蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow",
      "dress"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "frilled hat",
    "zh": "荷葉邊帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "large bow",
    "zh": "大蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "studs",
    "zh": "鉚釘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "black ascot",
    "zh": "黑色領巾(ascot)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "ascot"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "fur hat",
    "zh": "毛皮帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "arm belt",
    "zh": "臂帶（皮帶）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "fur-trimmed headwear",
    "zh": "毛皮滾邊頭飾／頭戴物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "yellow hat",
    "zh": "黃色帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "striped scarf",
    "zh": "條紋圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "striped ribbon",
    "zh": "條紋緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "tail ribbon",
    "zh": "尾巴緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "pink neckerchief",
    "zh": "粉紅色領巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "neckerchief"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "footwear bow",
    "zh": "鞋上蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "brown bag",
    "zh": "棕色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "cat hair ornament",
    "zh": "貓咪髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "black bag",
    "zh": "黑色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "earclip",
    "zh": "耳夾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "blue ascot",
    "zh": "藍色領巾(ascot)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "ascot"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "closed umbrella",
    "zh": "收起的雨傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "ring piercing",
    "zh": "環形穿孔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "single elbow glove",
    "zh": "單邊長手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "quiver",
    "zh": "箭筒",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "loose necktie",
    "zh": "寬鬆領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "frilled gloves",
    "zh": "荷葉邊手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "green sailor collar",
    "zh": "綠色水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "metal collar",
    "zh": "金屬項圈",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "towel around neck",
    "zh": "脖子上掛毛巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "purple hairband",
    "zh": "紫色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "unworn mask",
    "zh": "未穿戴的面具／口罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "multiple belts",
    "zh": "多條腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "green gem",
    "zh": "綠色寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gem"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "blue belt",
    "zh": "藍色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "grey sailor collar",
    "zh": "灰色水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "red sailor collar",
    "zh": "紅色水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "red rope",
    "zh": "紅色繩子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "rope"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bind"
  },
  {
    "tag": "two-tone gloves",
    "zh": "雙色手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "super crown",
    "zh": "超級皇冠",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "crown"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "red headband",
    "zh": "紅色頭帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "headband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "red belt",
    "zh": "紅色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "heart choker",
    "zh": "愛心頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "surgical mask",
    "zh": "醫用口罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "musical note hair ornament",
    "zh": "音符髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "orange bowtie",
    "zh": "橘色領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "heart necklace",
    "zh": "愛心項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "wrist ribbon",
    "zh": "手腕緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "pink scarf",
    "zh": "粉紅色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "brown scarf",
    "zh": "棕色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "anal tail",
    "zh": "肛塞尾巴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_toy"
  },
  {
    "tag": "pirate hat",
    "zh": "海盜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "cat ear headphones",
    "zh": "貓耳耳機",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "headphones"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_face",
    "mutexExtra": [
      "ear_audio"
    ]
  },
  {
    "tag": "green halo",
    "zh": "綠色光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "red sash",
    "zh": "紅色腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "rectangular eyewear",
    "zh": "長方形眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "carrot hair ornament",
    "zh": "紅蘿蔔髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "backwards hat",
    "zh": "反戴帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "black mask",
    "zh": "黑色面具／口罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "orange ribbon",
    "zh": "橘色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "earpiece",
    "zh": "單邊耳機",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "heart-shaped eyewear",
    "zh": "愛心形眼鏡類",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "tassel hair ornament",
    "zh": "流蘇髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pince-nez",
    "zh": "夾鼻眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "crescent pin",
    "zh": "月牙胸針",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "orange necktie",
    "zh": "橘色領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "shark hair ornament",
    "zh": "鯊魚髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "yellow scarf",
    "zh": "黃色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "unworn helmet",
    "zh": "未穿戴的頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "wing hair ornament",
    "zh": "翅膀髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "diagonal-striped bow",
    "zh": "斜條紋蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "red armband",
    "zh": "紅色臂章／臂環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "rectangular halo",
    "zh": "長方形光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "opaque glasses",
    "zh": "不透明鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [
      "glasses"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "orange hat",
    "zh": "橘色帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "wiffle gag",
    "zh": "洞洞口球",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bind"
  },
  {
    "tag": "purple choker",
    "zh": "紫色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "cat hood",
    "zh": "貓耳兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "multiple earrings",
    "zh": "多個耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "paper bag",
    "zh": "紙袋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "green scarf",
    "zh": "綠色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "black veil",
    "zh": "黑色面紗",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "veil"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "bone hair ornament",
    "zh": "骨頭髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "cow print gloves",
    "zh": "乳牛紋手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "aqua bowtie",
    "zh": "水藍色領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "gold earrings",
    "zh": "金色耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "orange hairband",
    "zh": "橘色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "o-ring choker",
    "zh": "O環頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "wizard hat",
    "zh": "巫師帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "wing ornament",
    "zh": "翅膀飾品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "ear ribbon",
    "zh": "耳朵緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "goggles on headwear",
    "zh": "頭飾上的護目鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "tie clip",
    "zh": "領帶夾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "diagonal-striped necktie",
    "zh": "斜條紋領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "feather boa",
    "zh": "羽毛圍巾(boa)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "bat hair ornament",
    "zh": "蝙蝠髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "whistle around neck",
    "zh": "頸掛哨子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "green hairband",
    "zh": "綠色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "white headband",
    "zh": "白色頭帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "headband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "black headband",
    "zh": "黑色頭帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "headband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "flower earrings",
    "zh": "花朵耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "thigh belt",
    "zh": "大腿皮帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "button badge",
    "zh": "圓形別針徽章",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "goggles around neck",
    "zh": "脖子上掛護目鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "bag charm",
    "zh": "包包吊飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "o-ring bottom",
    "zh": "O環下身",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "two-tone bow",
    "zh": "雙色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "purple halo",
    "zh": "紫色光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "white scrunchie",
    "zh": "白色髮圈(scrunchie)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "scrunchie"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "fur-trimmed hood",
    "zh": "毛皮滾邊兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "checkered scarf",
    "zh": "棋盤格紋圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "horseshoe ornament",
    "zh": "馬蹄鐵飾品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "white veil",
    "zh": "白色面紗",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "veil"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "domino mask",
    "zh": "多米諾面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "pom pom hair ornament",
    "zh": "絨球髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "single ear cover",
    "zh": "單邊耳罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "horned headwear",
    "zh": "有角頭飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "orange gloves",
    "zh": "橘色手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "blue-framed eyewear",
    "zh": "藍框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "nightcap",
    "zh": "睡帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "sphere earrings",
    "zh": "球形耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "rabbit hood",
    "zh": "兔耳兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "crescent earrings",
    "zh": "月牙耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "gas mask",
    "zh": "防毒面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "strap between breasts",
    "zh": "肩帶夾在胸間",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "black sash",
    "zh": "黑色腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "medal",
    "zh": "獎牌／勳章",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "loose belt",
    "zh": "寬鬆腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "horn bow",
    "zh": "角上蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "chest belt",
    "zh": "胸前皮帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "print bowtie",
    "zh": "印花領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "plaid bowtie",
    "zh": "格紋領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "plastic bag",
    "zh": "塑膠袋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "qingdai guanmao",
    "zh": "清代官帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "ancient_china"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pink scrunchie",
    "zh": "粉紅色髮圈(scrunchie)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "scrunchie"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "horned helmet",
    "zh": "有角頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "shoulder spikes",
    "zh": "肩刺",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "spikes"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "shoulder boards",
    "zh": "肩章板",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "frilled ribbon",
    "zh": "荷葉邊緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "purple scarf",
    "zh": "紫色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "over-rim eyewear",
    "zh": "半框眼鏡（over-rim eyewear）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "brown ribbon",
    "zh": "棕色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "ankle ribbon",
    "zh": "腳踝緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "purple umbrella",
    "zh": "紫色傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "single pauldron",
    "zh": "單邊肩甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "yellow scrunchie",
    "zh": "黃色髮圈(scrunchie)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "scrunchie"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "red umbrella",
    "zh": "紅色傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "single hair ring",
    "zh": "單邊髮環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "clover hair ornament",
    "zh": "三葉草髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "porkpie hat",
    "zh": "豬肉派帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "neck ruff",
    "zh": "皺領(拉夫領)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "black halo",
    "zh": "黑色光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "snowflake hair ornament",
    "zh": "雪花髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "large hat",
    "zh": "大帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "grey halo",
    "zh": "灰色光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "thumb ring",
    "zh": "拇指戒指",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "gold bracelet",
    "zh": "金色手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "bracelet"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "plaid necktie",
    "zh": "格紋領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "pendant choker",
    "zh": "墜飾頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "talisman",
    "zh": "護符",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "duffel bag",
    "zh": "圓筒旅行包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "ear tag",
    "zh": "耳標",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "feather earrings",
    "zh": "羽毛耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "orange-tinted eyewear",
    "zh": "橘色鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "ankle lace-up",
    "zh": "腳踝綁帶鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "grey bow",
    "zh": "灰色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "red bag",
    "zh": "紅色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "pink-framed eyewear",
    "zh": "粉框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "fur scarf",
    "zh": "毛皮圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "grey neckerchief",
    "zh": "灰色領巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "neckerchief"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "uneven gloves",
    "zh": "長短不一的手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "safety pin",
    "zh": "別針",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "brown sailor collar",
    "zh": "棕色水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "diamond hairband",
    "zh": "菱形髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "aqua ribbon",
    "zh": "水藍色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "shako cap",
    "zh": "軍用高筒帽(shako)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "grey-framed eyewear",
    "zh": "灰框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "pink bag",
    "zh": "粉紅色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "green neckerchief",
    "zh": "綠色領巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "neckerchief"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "torpedo tubes",
    "zh": "魚雷發射管",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "star halo",
    "zh": "星星光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "blue sash",
    "zh": "藍色腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "no eyewear",
    "zh": "沒戴眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "o-ring thigh strap",
    "zh": "O環大腿帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "white sash",
    "zh": "白色腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "red bandana",
    "zh": "紅色頭巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bandana"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "character hair ornament",
    "zh": "角色造型髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "green choker",
    "zh": "綠色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "nose piercing",
    "zh": "鼻環（nose piercing）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "insignia",
    "zh": "徽記",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "animal ear headwear",
    "zh": "動物耳頭飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "yellow belt",
    "zh": "黃色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "cat hat",
    "zh": "貓耳帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "gold necklace",
    "zh": "金色項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "pith helmet",
    "zh": "殖民地盔(木髓盔)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "winged hat",
    "zh": "翼帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "fanny pack",
    "zh": "腰包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "yellow-framed eyewear",
    "zh": "黃框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "patch",
    "zh": "補丁／徽布",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "cloth gag",
    "zh": "布塞口",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bind"
  },
  {
    "tag": "white-framed eyewear",
    "zh": "白框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "transparent umbrella",
    "zh": "透明雨傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "purple sailor collar",
    "zh": "紫色水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "orange scrunchie",
    "zh": "橘色髮圈(scrunchie)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "scrunchie"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "ankle cuffs",
    "zh": "腳踝束環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "cuffs"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bind"
  },
  {
    "tag": "purple gem",
    "zh": "紫色寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gem"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "heart o-ring",
    "zh": "愛心O環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "o-ring"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "magatama necklace",
    "zh": "勾玉項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "blue bag",
    "zh": "藍色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "carrot necklace",
    "zh": "紅蘿蔔項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "star choker",
    "zh": "星星頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "studded belt",
    "zh": "鉚釘腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "red-tinted eyewear",
    "zh": "紅色鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "chest strap",
    "zh": "胸前綁帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "grey necktie",
    "zh": "灰色領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "orange choker",
    "zh": "橘色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "white bag",
    "zh": "白色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "d-pad hair ornament",
    "zh": "十字鍵髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "oni mask",
    "zh": "鬼面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "gorget",
    "zh": "護喉甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "thigh ribbon",
    "zh": "大腿緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "alternate headwear",
    "zh": "替換頭飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "sleeve garter",
    "zh": "袖箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "black garter straps",
    "zh": "黑色吊襪帶",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "garter straps"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "plaid hat",
    "zh": "格紋帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "satchel",
    "zh": "郵差包／書包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "multicolored hairband",
    "zh": "多色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "school emblem",
    "zh": "校徽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "helm",
    "zh": "全罩式中世紀頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "tam o' shanter",
    "zh": "蘇格蘭圓扁帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "diving mask",
    "zh": "潛水鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "pearl",
    "zh": "珍珠",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "orange neckerchief",
    "zh": "橘色領巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "neckerchief"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "brown necktie",
    "zh": "棕色領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "shark hood",
    "zh": "鯊魚兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "yellow choker",
    "zh": "黃色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "dynamax band",
    "zh": "極巨化手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "tail bell",
    "zh": "尾巴鈴鐺",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "single fingerless glove",
    "zh": "單邊無指手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "sweatband",
    "zh": "吸汗帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "see-through veil",
    "zh": "透視面紗",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "veil"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "fish hair ornament",
    "zh": "魚造型髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "orange scarf",
    "zh": "橘色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "purple belt",
    "zh": "紫色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "lip piercing",
    "zh": "唇環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "bear hair ornament",
    "zh": "熊髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "dalachi (headdress)",
    "zh": "大拉翅",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "condom packet strip",
    "zh": "保險套包裝條",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_toy"
  },
  {
    "tag": "winged helmet",
    "zh": "翼盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "brown hairband",
    "zh": "棕色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "party hat",
    "zh": "派對帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "black garter belt",
    "zh": "黑色吊襪帶腰帶",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "garter belt"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "mouth veil",
    "zh": "口罩面紗",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "veil"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "utility belt",
    "zh": "工具腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "leg belt",
    "zh": "腿部皮帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "grey scarf",
    "zh": "灰色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "eyebrow piercing",
    "zh": "眉環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "two-tone ribbon",
    "zh": "雙色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "gold hairband",
    "zh": "金色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "spiked armlet",
    "zh": "尖刺臂環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "armlet"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "space helmet",
    "zh": "太空頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "hair through headwear",
    "zh": "頭髮穿出帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "star necklace",
    "zh": "星星項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "fake wings",
    "zh": "假翅膀",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "heart button",
    "zh": "愛心鈕扣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "blue headband",
    "zh": "藍色頭帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "headband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "striped gloves",
    "zh": "條紋手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "multicolored bow",
    "zh": "多色蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "pink belt",
    "zh": "粉紅色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "two-tone bowtie",
    "zh": "雙色領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "single gauntlet",
    "zh": "單邊護手甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "flower ornament",
    "zh": "花朵飾品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "square-end necktie",
    "zh": "平頭領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "arm wrap",
    "zh": "手臂纏布",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "claw ring",
    "zh": "爪形戒指",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "checkered necktie",
    "zh": "棋盤格紋領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "leather belt",
    "zh": "皮革腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "skull earrings",
    "zh": "骷髏耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "tricorne",
    "zh": "三角帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "yellow sash",
    "zh": "黃色腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "animal bag",
    "zh": "動物包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "blue collar",
    "zh": "藍色項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "multiple piercings",
    "zh": "多重穿孔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "shoulder strap",
    "zh": "單肩背帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "yellow bag",
    "zh": "黃色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "red hood",
    "zh": "紅色兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "loose bowtie",
    "zh": "寬鬆領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "ribbon-trimmed collar",
    "zh": "緞帶滾邊項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "pillbox hat",
    "zh": "圓筒小帽(pillbox)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "frilled cuffs",
    "zh": "荷葉邊袖口",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "cuffs"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bind"
  },
  {
    "tag": "pink sailor collar",
    "zh": "粉紅色水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "unworn bag",
    "zh": "未穿戴的包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "fake antlers",
    "zh": "假鹿角",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "bowl hat",
    "zh": "碗帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "dixie cup hat",
    "zh": "海軍水兵帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "triangle earrings",
    "zh": "三角形耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "gold choker",
    "zh": "金色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "bow earrings",
    "zh": "蝴蝶結耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "blue-tinted eyewear",
    "zh": "藍色鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "horns through headwear",
    "zh": "角穿出帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "purple-tinted eyewear",
    "zh": "紫色鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "pink collar",
    "zh": "粉紅色項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "aqua neckerchief",
    "zh": "水藍色領巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "neckerchief"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "yellow armband",
    "zh": "黃色臂章／臂環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "eyewear on headwear",
    "zh": "眼鏡戴在帽子上",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "respirator",
    "zh": "呼吸防護面罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "fur-trimmed collar",
    "zh": "毛皮滾邊項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "combat helmet",
    "zh": "戰鬥頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "used tissue",
    "zh": "用過的衛生紙",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "ammunition pouch",
    "zh": "彈藥袋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pouch"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "bow choker",
    "zh": "蝴蝶結頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "grey belt",
    "zh": "灰色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "brown-framed eyewear",
    "zh": "棕框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "striped headwear",
    "zh": "條紋頭飾／頭戴物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "skull mask",
    "zh": "骷髏面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "ankle strap",
    "zh": "腳踝綁帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "wrist guards",
    "zh": "護腕（wrist guards）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "neck flower",
    "zh": "頸部花飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "green-framed eyewear",
    "zh": "綠框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "unworn gloves",
    "zh": "未穿戴的手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "linked piercing",
    "zh": "相連穿孔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "undone necktie",
    "zh": "鬆開的領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "brown bowtie",
    "zh": "棕色領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "sleep mask",
    "zh": "睡眠眼罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "gold crown",
    "zh": "金色皇冠",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "crown"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "triangle hair ornament",
    "zh": "三角形髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "industrial piercing",
    "zh": "工業型穿環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "open belt",
    "zh": "敞開的腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "pink-tinted eyewear",
    "zh": "粉色鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "sleeve bow",
    "zh": "袖子蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "bolo tie",
    "zh": "波羅領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "broken halo",
    "zh": "破損光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "single strap",
    "zh": "單邊肩帶／綁帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "moon (ornament)",
    "zh": "月亮飾品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "lube",
    "zh": "潤滑液",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_toy"
  },
  {
    "tag": "fishnet gloves",
    "zh": "網狀手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "rider belt",
    "zh": "騎士腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "eyewear strap",
    "zh": "眼鏡繩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "cross tie",
    "zh": "交叉領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "tube",
    "zh": "管狀物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "magatama earrings",
    "zh": "勾玉耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "white headdress",
    "zh": "白色頭飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "headdress"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "sunflower hair ornament",
    "zh": "向日葵髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "candy hair ornament",
    "zh": "糖果髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "mask around neck",
    "zh": "口罩掛脖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "grey ribbon",
    "zh": "灰色緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "white garter straps",
    "zh": "白色吊襪帶",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "garter straps"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "two-tone headwear",
    "zh": "雙色頭飾／頭戴物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "orange sailor collar",
    "zh": "橘色水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "pearl earrings",
    "zh": "珍珠耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "leather gloves",
    "zh": "皮革手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "green bag",
    "zh": "綠色包包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "spiked choker",
    "zh": "尖刺項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "deerstalker",
    "zh": "獵鹿帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "white mask",
    "zh": "白色面具／口罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "bandaid hair ornament",
    "zh": "OK繃髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "shin guards",
    "zh": "護脛",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "purple neckerchief",
    "zh": "紫色領巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "neckerchief"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "earth (ornament)",
    "zh": "地球飾品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "pearl bracelet",
    "zh": "珍珠手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "bracelet"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "white umbrella",
    "zh": "白色傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "spiked halo",
    "zh": "尖刺光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "tail piercing",
    "zh": "尾巴穿孔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "diagonal-striped bowtie",
    "zh": "斜條紋領結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "bowtie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "crime prevention buzzer",
    "zh": "防身警報器",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "orange headband",
    "zh": "橘色頭帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "headband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pink wrist cuffs",
    "zh": "粉紅色腕套(袖口)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "wrist cuffs"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "key necklace",
    "zh": "鑰匙項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "aqua hat",
    "zh": "水藍色帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "kepi",
    "zh": "平頂軍帽(kepi)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "huge bow",
    "zh": "超大蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "kurokote",
    "zh": "黑小手（護手）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "lace choker",
    "zh": "蕾絲頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "no gloves",
    "zh": "沒戴手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "star brooch",
    "zh": "星星胸針",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "brooch"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "snorkel",
    "zh": "呼吸管",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "purple sash",
    "zh": "紫色腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "white hood",
    "zh": "白色兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "noh mask",
    "zh": "能劇面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "food-themed earrings",
    "zh": "食物主題耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "tulip hat",
    "zh": "鬱金香帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "clitoral piercing",
    "zh": "陰蒂穿孔",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "piercing"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "lapel pin",
    "zh": "翻領別針",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "plume",
    "zh": "羽飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "ninja mask",
    "zh": "忍者面罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "orange ascot",
    "zh": "橘色領巾(ascot)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "ascot"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "hauchiwa",
    "zh": "羽團扇",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "condom belt",
    "zh": "保險套腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "coif",
    "zh": "頭巾帽(coif)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "frilled ascot",
    "zh": "荷葉邊領巾(ascot)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "ascot"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "torn scarf",
    "zh": "破損的圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "sleeve ribbon",
    "zh": "袖子緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "strawberry hair ornament",
    "zh": "草莓髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "blue helmet",
    "zh": "藍色頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "trash bag",
    "zh": "垃圾袋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "dice hair ornament",
    "zh": "骰子髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "purple scrunchie",
    "zh": "紫色髮圈(scrunchie)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "scrunchie"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "print headwear",
    "zh": "印花頭飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "two-tone hairband",
    "zh": "雙色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "red mask",
    "zh": "紅色面具／口罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "neck tassel",
    "zh": "頸部流蘇",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "tassel"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "motorcycle helmet",
    "zh": "機車安全帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "arched crown",
    "zh": "拱形王冠",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "crown"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "nejiri hachimaki",
    "zh": "扭轉頭巾(捻り鉢巻)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hachimaki"
    ],
    "layer": "accessory",
    "era": [
      "edo",
      "modern"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "pink ascot",
    "zh": "粉紅色領巾(ascot)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "ascot"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "diving mask on head",
    "zh": "潛水鏡推到頭上",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask on head"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "papakha",
    "zh": "高加索毛帽(papakha)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "grey hairband",
    "zh": "灰色髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "lace-trimmed gloves",
    "zh": "蕾絲滾邊手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "polka dot headwear",
    "zh": "圓點頭飾／頭戴物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "scarf over mouth",
    "zh": "圍巾遮嘴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "wig",
    "zh": "假髮",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "wrist bow",
    "zh": "手腕蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "cat ear hairband",
    "zh": "貓耳髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "black bridal gauntlets",
    "zh": "黑色新娘袖套",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "bridal gauntlets"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "torn gloves",
    "zh": "破損的手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "ammunition belt",
    "zh": "彈鏈",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "bird mask",
    "zh": "鳥面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "blue armband",
    "zh": "藍色臂章／臂環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "coin on string",
    "zh": "繩上硬幣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "single epaulette",
    "zh": "單邊肩章",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "pointed crown",
    "zh": "尖頂皇冠",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "crown"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "green belt",
    "zh": "綠色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "tail ring",
    "zh": "尾環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "bicorne",
    "zh": "雙角帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "lace gloves",
    "zh": "蕾絲手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "shoulder sash",
    "zh": "斜肩綬帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "boobplate",
    "zh": "胸型鎧甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "crystal earrings",
    "zh": "水晶耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "no mask",
    "zh": "沒戴面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "heart collar",
    "zh": "愛心項圈",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "purple ascot",
    "zh": "紫色領巾(ascot)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "ascot"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "anchor necklace",
    "zh": "船錨項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "black umbrella",
    "zh": "黑色傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "multicolored hat",
    "zh": "多色帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "head chain",
    "zh": "頭鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "green armband",
    "zh": "綠色臂章／臂環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "footwear ribbon",
    "zh": "鞋上緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "bandolier",
    "zh": "斜背彈帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "brown choker",
    "zh": "棕色項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "grocery bag",
    "zh": "購物袋（grocery bag）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "smokestack hair ornament",
    "zh": "煙囪髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "egg hair ornament",
    "zh": "蛋造型髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "aviator sunglasses",
    "zh": "飛行員太陽眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [
      "sunglasses"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "hexagon hair ornament",
    "zh": "六角形髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "chain headband",
    "zh": "鏈條頭帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "headband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "usekh collar",
    "zh": "古埃及寬項圈",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "flower choker",
    "zh": "花朵頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "chinese hairpin",
    "zh": "中式髮簪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hairpin"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "single wrist cuff",
    "zh": "單邊腕套(袖口)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "chinstrap",
    "zh": "下巴帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "anchor choker",
    "zh": "船錨頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "horn hairband",
    "zh": "角髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "single hair tube",
    "zh": "單邊髮管",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "floating scarf",
    "zh": "飄浮的圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "multiple bracelets",
    "zh": "多個手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "orange belt",
    "zh": "橘色腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "wrist wrap",
    "zh": "手腕纏布",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "studded bracelet",
    "zh": "鉚釘手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "bracelet"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "shoulder holster",
    "zh": "肩掛槍套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "couter",
    "zh": "肘甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "teardrop earrings",
    "zh": "水滴耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "flower brooch",
    "zh": "花朵胸針",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "brooch"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "cross choker",
    "zh": "十字架頸圈",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "star ornament",
    "zh": "星形裝飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "blue hood",
    "zh": "藍色兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "messenger bag",
    "zh": "郵差包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "frilled sailor collar",
    "zh": "荷葉邊水手領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "coin hair ornament",
    "zh": "硬幣髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pill earrings",
    "zh": "藥丸耳環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "earrings"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "striped hairband",
    "zh": "條紋髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "amulet",
    "zh": "護身符",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "ornate ring",
    "zh": "華麗戒指",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "brown collar",
    "zh": "棕色項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "white halo",
    "zh": "白色光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "toe ring",
    "zh": "趾環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "gift bag",
    "zh": "禮物袋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "horn ring",
    "zh": "角環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "fake claws",
    "zh": "假爪",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "red mittens",
    "zh": "紅色連指手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "mittens"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "lace-trimmed choker",
    "zh": "蕾絲滾邊項圈式頸飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "choker"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "aqua gloves",
    "zh": "水藍色手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "gloves"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "sideways hat",
    "zh": "側戴帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "ribbon-trimmed headwear",
    "zh": "緞帶滾邊頭飾／頭戴物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "yellow-tinted eyewear",
    "zh": "黃色鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "flower bracelet",
    "zh": "花朵手環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "bracelet"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "white mittens",
    "zh": "白色連指手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "mittens"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "black helmet",
    "zh": "黑色頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "shoulder cannon",
    "zh": "肩載砲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "purple-framed eyewear",
    "zh": "紫框眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "unworn backpack",
    "zh": "未穿戴的背包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "single garter strap",
    "zh": "單邊吊襪帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "white garter belt",
    "zh": "白色吊襪帶腰帶",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "garter belt"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "ear protection",
    "zh": "護耳罩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "halo behind head",
    "zh": "頭後光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pearl hair ornament",
    "zh": "珍珠髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "checkered sash",
    "zh": "棋盤格紋腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "cherry hair ornament",
    "zh": "櫻桃髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "rope belt",
    "zh": "繩腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "medallion",
    "zh": "大型獎章墜飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "blue bandana",
    "zh": "藍色頭巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bandana"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "green scrunchie",
    "zh": "綠色髮圈(scrunchie)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "scrunchie"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "lace-trimmed hairband",
    "zh": "蕾絲滾邊髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "four-leaf clover hair ornament",
    "zh": "四葉草髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "multicolored scarf",
    "zh": "多色圍巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "scarf"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "print necktie",
    "zh": "印花領帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "necktie"
    ],
    "layer": "accessory",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "multicolored hair bobbles",
    "zh": "多色小球髮飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "hair bobbles"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "half mask",
    "zh": "半臉面具",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "mask"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "shell necklace",
    "zh": "貝殼項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "heart pendant",
    "zh": "愛心墜飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "pendant"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "arm cuffs",
    "zh": "臂環（arm cuffs）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [
      "cuffs"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bind"
  },
  {
    "tag": "black armband",
    "zh": "黑色臂章／臂環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "heart-shaped buckle",
    "zh": "愛心扣環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "buckle"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "black hood",
    "zh": "黑色兜帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "o-ring belt",
    "zh": "O環腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "red helmet",
    "zh": "紅色頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "spiked hairband",
    "zh": "尖刺髮箍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hairband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "shoulder belt",
    "zh": "肩帶式皮帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "diamond hair ornament",
    "zh": "菱形髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "white helmet",
    "zh": "白色頭盔",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "helmet"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pink gem",
    "zh": "粉紅色寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gem"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "red crown",
    "zh": "紅色皇冠",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "crown"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "green-tinted eyewear",
    "zh": "綠色鏡片眼鏡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "eyewear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_face"
  },
  {
    "tag": "white bonnet",
    "zh": "白色軟帽(bonnet)",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "bonnet"
    ],
    "layer": "accessory",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "blue umbrella",
    "zh": "藍色傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "purple collar",
    "zh": "紫色項圈／衣領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "neckwear",
    "bind": [],
    "implies": [
      "collar"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_neck"
  },
  {
    "tag": "pink umbrella",
    "zh": "粉紅色傘",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "umbrella"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "shell hair ornament",
    "zh": "貝殼髮飾",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "hair ornament"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "hat with ears",
    "zh": "帶耳朵的帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "bowler hat",
    "zh": "圓頂硬禮帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "skull ornament",
    "zh": "骷髏飾品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "biting glove",
    "zh": "咬手套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hands",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "rabbit hat",
    "zh": "兔子帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hat"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "pink sash",
    "zh": "粉紅色腰帶(綢帶)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "sash"
    ],
    "layer": "accessory",
    "era": [
      "ancient_china",
      "edo"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "kabuto (helmet)",
    "zh": "兜(日本武士頭盔)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "melting halo",
    "zh": "融化的光環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "halo"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "skirt bow",
    "zh": "裙上蝴蝶結",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bow",
      "skirt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "eyelash ornament",
    "zh": "睫毛裝飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "mitre",
    "zh": "主教冠(米特拉)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "green headband",
    "zh": "綠色頭帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "hair_acc",
    "bind": [],
    "implies": [
      "headband"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "single arm warmer",
    "zh": "單邊袖套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "single knee pad",
    "zh": "單邊護膝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "penguin hood",
    "zh": "企鵝連帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "hood"
    ],
    "layer": "accessory",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "acc_head",
    "mutexExtra": [
      "hood_on"
    ]
  },
  {
    "tag": "sam browne belt",
    "zh": "山姆布朗腰帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "waist",
    "bind": [],
    "implies": [
      "belt"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "skull necklace",
    "zh": "骷髏項鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "necklace"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "dilation tape",
    "zh": "擴張膠帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "polka dot scrunchie",
    "zh": "圓點髮圈(scrunchie)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "scrunchie"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "wataboushi",
    "zh": "綿帽子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "wing brooch",
    "zh": "翅膀胸針",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "jewelry",
    "bind": [],
    "implies": [
      "brooch"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "plaid ribbon",
    "zh": "格紋緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "female service cap",
    "zh": "女性制服帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "cat bag",
    "zh": "貓咪包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "bag"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "yellow gem",
    "zh": "黃色寶石",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "gem"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_jewel"
  },
  {
    "tag": "pom pom beanie",
    "zh": "絨球毛帽",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [
      "beanie"
    ],
    "layer": "accessory",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "polka dot ribbon",
    "zh": "圓點緞帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "ribbon"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_bow"
  },
  {
    "tag": "frilled headwear",
    "zh": "荷葉邊頭飾／頭戴物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "headwear",
    "bind": [],
    "implies": [],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_head"
  },
  {
    "tag": "bikini skirt",
    "zh": "裙式比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt",
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "sarong",
    "zh": "紗龍裙",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "red pants",
    "zh": "紅色長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "cutoffs",
    "zh": "割邊牛仔短褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "showgirl skirt",
    "zh": "歌舞女郎裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "green pants",
    "zh": "綠色長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "torn pants",
    "zh": "破損的長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "blue buruma",
    "zh": "藍色燈籠運動褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "buruma"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "red buruma",
    "zh": "紅色燈籠運動褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "buruma"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "track pants",
    "zh": "運動長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "baggy pants",
    "zh": "寬鬆垮長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "bike shorts under skirt",
    "zh": "裙下穿單車短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts under skirt",
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "gym shorts",
    "zh": "運動短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "multicolored skirt",
    "zh": "多色裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "checkered skirt",
    "zh": "棋盤格紋裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "tight pants",
    "zh": "緊身長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "two-tone skirt",
    "zh": "雙色裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "purple pants",
    "zh": "紫色長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "striped pants",
    "zh": "條紋長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "open shorts",
    "zh": "敞開的短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "torn shorts",
    "zh": "破損的短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "vertical-striped skirt",
    "zh": "直條紋裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "see-through skirt",
    "zh": "透視裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "open skirt",
    "zh": "敞開的裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "plaid pants",
    "zh": "格紋長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "black buruma",
    "zh": "黑色燈籠運動褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "buruma"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "chaps",
    "zh": "皮護腿褲(chaps)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "open pants",
    "zh": "敞開的長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "puffy pants",
    "zh": "蓬蓬褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "fur-trimmed skirt",
    "zh": "毛皮滾邊裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "yellow pants",
    "zh": "黃色長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "frilled shorts",
    "zh": "荷葉邊短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "orange pants",
    "zh": "橘色長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "single pantsleg",
    "zh": "單邊褲管",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "harem pants",
    "zh": "阿拉丁褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "torn jeans",
    "zh": "破損的牛仔褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "jeans"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "lace-trimmed skirt",
    "zh": "蕾絲滾邊裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "overall shorts",
    "zh": "吊帶短褲（overall shorts）",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "fur-trimmed shorts",
    "zh": "毛皮滾邊短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "camouflage pants",
    "zh": "迷彩褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "kimono skirt",
    "zh": "和服裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "vertical-striped pants",
    "zh": "直條紋長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "lowleg pants",
    "zh": "低腰長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "side slit shorts",
    "zh": "側開衩短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "print shorts",
    "zh": "印花短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "leather pants",
    "zh": "皮革長褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "polka dot skirt",
    "zh": "圓點裙子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "cargo pants",
    "zh": "工作褲(口袋褲)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "bike shorts under shorts",
    "zh": "短褲下穿自行車褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "pants under skirt",
    "zh": "裙下穿褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "skirt",
      "pants"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_skirt"
  },
  {
    "tag": "white sarong",
    "zh": "白色紗龍裙",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "half-skirt",
    "zh": "半裙(單側開高衩裙)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "blue sarong",
    "zh": "藍色紗龍裙",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "green kimono",
    "zh": "綠色和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "black armor",
    "zh": "黑色盔甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "yellow kimono",
    "zh": "黃色和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "black corset",
    "zh": "黑色束腰",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "corset"
    ],
    "layer": "garment",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "frilled kimono",
    "zh": "荷葉邊和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "hagoromo",
    "zh": "羽衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "orange kimono",
    "zh": "橘色和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "red armor",
    "zh": "紅色盔甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "brown kimono",
    "zh": "棕色和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "grey kimono",
    "zh": "灰色和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "blue armor",
    "zh": "藍色盔甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "checkered kimono",
    "zh": "棋盤格紋和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "striped kimono",
    "zh": "條紋和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "white armor",
    "zh": "白色盔甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "gold armor",
    "zh": "金色盔甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "fur-trimmed kimono",
    "zh": "毛皮滾邊和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "sideless kimono",
    "zh": "側面鏤空和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "leg armor",
    "zh": "腿部護甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "brown corset",
    "zh": "棕色束腰",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "corset"
    ],
    "layer": "garment",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "arm armor",
    "zh": "手臂護甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "multicolored kimono",
    "zh": "多色和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "green hakama",
    "zh": "綠色袴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "hakama"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "hanten (clothes)",
    "zh": "半纏(日式短外褂)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "body armor",
    "zh": "防彈衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "pink hakama",
    "zh": "粉紅色袴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "hakama"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "purple hakama",
    "zh": "紫色袴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "hakama"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "vertical-striped kimono",
    "zh": "直條紋和服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "kimono"
    ],
    "layer": "garment",
    "era": [
      "edo"
    ],
    "needs": [],
    "sub": "era_jp"
  },
  {
    "tag": "clothes writing",
    "zh": "衣服上的文字",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "drawstring",
    "zh": "抽繩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "center frills",
    "zh": "中央荷葉邊",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "frills"
    ],
    "layer": "garment",
    "era": [
      "victorian"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "center opening",
    "zh": "中央開口",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "bikini under clothes",
    "zh": "衣服下穿比基尼",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "lowleg",
    "zh": "低腰設計",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "star print",
    "zh": "星星圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "paw print",
    "zh": "爪印圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "hip vent",
    "zh": "腰側開衩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "clothes around waist",
    "zh": "衣服綁在腰間",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "v-neck",
    "zh": "V領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "see-through sleeves",
    "zh": "透視袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "coat on shoulders",
    "zh": "外套披肩（coat on shoulders）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "coat"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "heart cutout",
    "zh": "愛心鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "unworn skirt",
    "zh": "未穿戴的裙子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "low neckline",
    "zh": "低領口",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "heart print",
    "zh": "愛心圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "leotard under clothes",
    "zh": "衣服下穿緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "jacket partially removed",
    "zh": "外套半脫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "asymmetrical sleeves",
    "zh": "不對稱袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "unworn clothes",
    "zh": "未穿戴的衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "unworn jacket",
    "zh": "未穿戴的夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "see-through cleavage",
    "zh": "透視乳溝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "covered collarbone",
    "zh": "被遮住的鎖骨",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "coattails",
    "zh": "燕尾（後擺）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "notched lapels",
    "zh": "平駁領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "lapels"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "rose print",
    "zh": "玫瑰圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "cat cutout",
    "zh": "貓形鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "underboob cutout",
    "zh": "下乳鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "see-through silhouette",
    "zh": "透視剪影",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "american flag print",
    "zh": "美國國旗圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "sideless outfit",
    "zh": "側面鏤空服裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "jacket around waist",
    "zh": "外套綁在腰間",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "fruit print",
    "zh": "水果圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "unworn shirt",
    "zh": "未穿戴的襯衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "dragon print",
    "zh": "龍圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "wet swimsuit",
    "zh": "濕透的泳衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "spider web print",
    "zh": "蜘蛛網圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "borrowed clothes",
    "zh": "借來的衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "undersized clothes",
    "zh": "過小的衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "rabbit print",
    "zh": "兔圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "bodysuit under clothes",
    "zh": "衣服下穿連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "character print",
    "zh": "角色圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "snowflake print",
    "zh": "雪花圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "enpera",
    "zh": "圍巾上蓬髮(enpera)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "shared clothes",
    "zh": "共穿衣物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "stomach cutout",
    "zh": "腹部鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "skull print",
    "zh": "骷髏圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "cat print",
    "zh": "貓圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "uneven sleeves",
    "zh": "長短不一的袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "butterfly print",
    "zh": "蝴蝶圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "dirty clothes",
    "zh": "髒衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "spandex",
    "zh": "萊卡彈性纖維",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "diamond cutout",
    "zh": "菱形鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "ofuda on clothes",
    "zh": "衣服上的符咒",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "feather-trimmed sleeves",
    "zh": "羽毛滾邊袖",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "constellation print",
    "zh": "星座圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "single vertical stripe",
    "zh": "單條直條紋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "sweater around waist",
    "zh": "毛衣綁在腰間",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "loose clothes",
    "zh": "寬鬆衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "fine fabric emphasis",
    "zh": "薄布料強調",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "front slit",
    "zh": "前開衩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "strawberry print",
    "zh": "草莓圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "thigh cutout",
    "zh": "大腿鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "clover print",
    "zh": "三葉草圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "flame print",
    "zh": "火焰圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "yellow trim",
    "zh": "黃色滾邊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "lace-trimmed sleeves",
    "zh": "蕾絲滾邊袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "unworn bikini top",
    "zh": "未穿戴的比基尼上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "cutout above navel",
    "zh": "肚臍上方鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "snap-fit buckle",
    "zh": "塑膠卡扣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "buckle"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_hand"
  },
  {
    "tag": "single off shoulder",
    "zh": "單邊露肩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "off shoulder"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "ribbed sleeves",
    "zh": "羅紋袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "yellow sleeves",
    "zh": "黃色袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "shorts under dress",
    "zh": "洋裝下穿短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress",
      "shorts"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "ass cutout",
    "zh": "臀部鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "full-length zipper",
    "zh": "全長拉鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "zipper"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "pants rolled up",
    "zh": "捲起褲管",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "mismatched sleeves",
    "zh": "左右不一致的袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "sweaty clothes",
    "zh": "汗濕的衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "single horizontal stripe",
    "zh": "單條橫條紋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "food-themed clothes",
    "zh": "食物主題衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "pinching sleeves",
    "zh": "捏著袖口",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "triangle print",
    "zh": "三角形圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "single stripe",
    "zh": "單條條紋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "fish print",
    "zh": "魚圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "pants tucked in",
    "zh": "褲腳塞進鞋裡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pants"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "red trim",
    "zh": "紅色滾邊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "brown sleeves",
    "zh": "棕色袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "burnt clothes",
    "zh": "燒焦的衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "unworn coat",
    "zh": "未穿戴的大衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "clothes between thighs",
    "zh": "衣物夾在大腿間",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "armpit cutout",
    "zh": "腋下鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "expressive clothes",
    "zh": "會表情的衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "anchor print",
    "zh": "船錨圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "frog print",
    "zh": "青蛙圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "cross-laced sleeves",
    "zh": "交叉綁帶袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "unworn dress",
    "zh": "未穿戴的洋裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "sparkle print",
    "zh": "閃亮圖樣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_material",
    "mutexExtra": [
      "print_style"
    ]
  },
  {
    "tag": "silver trim",
    "zh": "銀色滾邊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "baggy clothes",
    "zh": "寬鬆垮衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "white trim",
    "zh": "白色滾邊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "cardigan around waist",
    "zh": "開襟衫綁在腰間",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "orange sleeves",
    "zh": "橘色袖子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "unworn swimsuit",
    "zh": "未穿戴的泳衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "double vertical stripe",
    "zh": "雙直條紋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "unzipping",
    "zh": "拉下拉鍊",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "crotch cutout",
    "zh": "胯部鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "skirt cutout",
    "zh": "裙子鏤空",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "cross-laced slit",
    "zh": "交叉綁帶開衩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "wet dress",
    "zh": "濕透的洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "torn bodystocking",
    "zh": "破損的連身網襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodystocking"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "jacket over swimsuit",
    "zh": "泳衣外罩外套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit",
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "houndstooth",
    "zh": "千鳥格紋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "print sleeves",
    "zh": "印花袖套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "puff and slash sleeves",
    "zh": "切口澎澎袖",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "skirt under dress",
    "zh": "洋裝下穿裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress",
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "see-through body",
    "zh": "透視身體",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "patchwork clothes",
    "zh": "拼布衣物",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "embroidery",
    "zh": "刺繡",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "object in pocket",
    "zh": "口袋裡有物品",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pocket"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "wringing clothes",
    "zh": "擰衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "double horizontal stripe",
    "zh": "雙橫條紋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_material"
  },
  {
    "tag": "shorts around one leg",
    "zh": "短褲掛在單腳",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "sayagata",
    "zh": "紗綾形",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "square neckline",
    "zh": "方領",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_sleeve"
  },
  {
    "tag": "exposed pocket",
    "zh": "露出口袋布",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pocket"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "unworn shoes",
    "zh": "未穿戴的鞋子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "uwabaki",
    "zh": "室內鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "tengu-geta",
    "zh": "天狗木屐",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "grey boots",
    "zh": "灰色靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "purple boots",
    "zh": "紫色靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "rudder footwear",
    "zh": "舵型鞋（艦娘）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "green boots",
    "zh": "綠色靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "yellow boots",
    "zh": "黃色靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "multicolored shoes",
    "zh": "多色鞋子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "shoes"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "unworn boots",
    "zh": "未穿戴的靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "unworn sandals",
    "zh": "未穿戴的涼鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "fold-over boots",
    "zh": "折邊靴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "orange boots",
    "zh": "橘色靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "leather boots",
    "zh": "皮革靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "multicolored boots",
    "zh": "多色靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "gladiator sandals",
    "zh": "羅馬涼鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "sandals"
    ],
    "layer": "garment",
    "era": [
      "ancient_greece",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "combat boots",
    "zh": "軍靴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "two-tone shoes",
    "zh": "雙色鞋子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "shoes"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "belt boots",
    "zh": "皮帶靴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "cowboy boots",
    "zh": "牛仔靴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "single boot",
    "zh": "單邊單隻靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "cross-laced shoes",
    "zh": "交叉綁帶鞋子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "shoes"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "ice skates",
    "zh": "溜冰鞋（ice skates）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "skates"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "animal slippers",
    "zh": "動物拖鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "slippers"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "crocs",
    "zh": "洞洞鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "barefoot sandals (jewelry)",
    "zh": "赤足涼鞋(足飾)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "blue sandals",
    "zh": "藍色涼鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "sandals"
    ],
    "layer": "garment",
    "era": [
      "ancient_greece",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "high tops",
    "zh": "高筒運動鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "dress shoes",
    "zh": "皮鞋(正裝鞋)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "shoes",
      "dress"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "wedge heels",
    "zh": "楔型鞋跟",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "two-tone boots",
    "zh": "雙色靴子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "fur boots",
    "zh": "毛皮靴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "boots"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "open-toe shoes",
    "zh": "露趾鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "shoes"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "pink slippers",
    "zh": "粉紅色拖鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "slippers"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "winged shoes",
    "zh": "帶翅膀的鞋",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "shoes"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "aqua shoes",
    "zh": "水藍色鞋子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "feet",
    "bind": [],
    "implies": [
      "shoes"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "feet"
  },
  {
    "tag": "frilled thigh strap",
    "zh": "荷葉邊大腿綁帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "thighlet",
    "zh": "大腿金屬環",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "grey thighhighs",
    "zh": "灰色過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "vertical-striped thighhighs",
    "zh": "直條紋過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "grey pantyhose",
    "zh": "灰色連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "blue socks",
    "zh": "藍色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "single sock",
    "zh": "單邊單隻襪子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "striped socks",
    "zh": "條紋襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "thigh holster",
    "zh": "大腿槍套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "print pantyhose",
    "zh": "印花連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "single leg pantyhose",
    "zh": "單邊單腿連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "no socks",
    "zh": "不穿襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "cow print thighhighs",
    "zh": "乳牛紋過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "print thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "grey socks",
    "zh": "灰色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "red socks",
    "zh": "紅色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "ribbon-trimmed thighhighs",
    "zh": "緞帶滾邊過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "black leggings",
    "zh": "黑色緊身褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "leggings"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "single kneehigh",
    "zh": "單邊及膝襪",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "american flag legwear",
    "zh": "美國國旗圖案腿部穿著",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "frilled socks",
    "zh": "荷葉邊襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "pink socks",
    "zh": "粉紅色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "alternate legwear",
    "zh": "替換腿部穿著",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "thigh pouch",
    "zh": "大腿小包",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pouch"
    ],
    "layer": "accessory",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "acc_carry"
  },
  {
    "tag": "brown socks",
    "zh": "棕色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "see-through legwear",
    "zh": "透視腿部穿著",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "green socks",
    "zh": "綠色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "fur-trimmed legwear",
    "zh": "毛皮滾邊腿部穿著",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "multicolored thighhighs",
    "zh": "多色過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "vertical-striped pantyhose",
    "zh": "直條紋連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "argyle thighhighs",
    "zh": "菱格紋過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "ribbed socks",
    "zh": "羅紋襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "unworn socks",
    "zh": "未穿戴的襪子",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_state"
  },
  {
    "tag": "purple socks",
    "zh": "紫色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "orange pantyhose",
    "zh": "橘色連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "yellow socks",
    "zh": "黃色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "green pantyhose",
    "zh": "綠色連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "white leggings",
    "zh": "白色緊身褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "leggings"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "gradient legwear",
    "zh": "漸層腿部穿著",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "animal ear legwear",
    "zh": "動物耳造型襪",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "two-tone legwear",
    "zh": "雙色腿部穿著",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "shiny legwear",
    "zh": "光澤腿部服裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "thighhighs over pantyhose",
    "zh": "連褲襪外穿過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose",
      "thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "high-waist pantyhose",
    "zh": "高腰連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "single thigh boot",
    "zh": "單邊過膝靴",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "leg wrap",
    "zh": "腿部纏布",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "orange socks",
    "zh": "橘色襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "cat ear legwear",
    "zh": "貓耳襪",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "yellow pantyhose",
    "zh": "黃色連褲襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "pantyhose"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "white leg warmers",
    "zh": "白色腿套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "leg warmers"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "bridal legwear",
    "zh": "新娘襪",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "fur-trimmed thighhighs",
    "zh": "毛皮滾邊過膝襪",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "thighhighs"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "fishnet socks",
    "zh": "網狀襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "vertical-striped socks",
    "zh": "直條紋襪子",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "socks"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "detached leggings",
    "zh": "分離式緊身褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [
      "leggings"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "cross-laced legwear",
    "zh": "交叉綁帶腿部穿著",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "legs",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "legs"
  },
  {
    "tag": "white apron",
    "zh": "白色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "skirt set",
    "zh": "裙子套裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "skirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "winter uniform",
    "zh": "冬季制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "summer uniform",
    "zh": "夏季制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "black serafuku",
    "zh": "黑色水手服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "serafuku"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "impossible clothes",
    "zh": "極度緊繃的衣服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_detail"
  },
  {
    "tag": "print bikini",
    "zh": "印花比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "tracen school uniform",
    "zh": "特雷森學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "yellow bikini",
    "zh": "黃色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "highleg bikini",
    "zh": "高叉比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "green bikini",
    "zh": "綠色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "kita high school uniform",
    "zh": "北高制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "mitakihara school uniform",
    "zh": "見瀧原中學制服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "white bodysuit",
    "zh": "白色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "sakuragaoka high school uniform",
    "zh": "櫻丘高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "ooarai school uniform",
    "zh": "大洗女子學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "multicolored dress",
    "zh": "多色洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "black suit",
    "zh": "黑色西裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "male swimwear",
    "zh": "男用泳裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "bikini bottom only",
    "zh": "只穿比基尼下身",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [
      "female"
    ],
    "sub": "op_only"
  },
  {
    "tag": "multi-strapped bikini bottom",
    "zh": "多綁帶比基尼下身",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "sailor senshi uniform",
    "zh": "水手戰士制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "competition school swimsuit",
    "zh": "競速型學校泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "school swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "tokiwadai school uniform",
    "zh": "常盤台中學制服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "otonokizaka school uniform",
    "zh": "音乃木坂學院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "cow print bikini",
    "zh": "乳牛紋比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "old school swimsuit",
    "zh": "舊式學校泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "school swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "thong bikini",
    "zh": "丁字褲比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "purple leotard",
    "zh": "紫色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "vertical-striped dress",
    "zh": "直條紋洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "white robe",
    "zh": "白色長袍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "robe"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "multicolored bikini",
    "zh": "多色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "torn dress",
    "zh": "破損的洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "orange bikini",
    "zh": "橘色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "garreg mach monastery uniform",
    "zh": "加爾格．馬克修道院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "lowleg bikini",
    "zh": "低腰比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "strapless bikini",
    "zh": "無肩帶比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "tracen training uniform",
    "zh": "特雷森訓練服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "polka dot bikini",
    "zh": "圓點比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "pink leotard",
    "zh": "粉紅色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "black robe",
    "zh": "黑色長袍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "robe"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "demon slayer uniform",
    "zh": "鬼殺隊制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "blue serafuku",
    "zh": "藍色水手服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "serafuku"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "multicolored bodysuit",
    "zh": "多色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "ryouou school uniform",
    "zh": "陵桜學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "frilled one-piece swimsuit",
    "zh": "荷葉邊連身泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "one-piece swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "maid bikini",
    "zh": "女僕比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "green leotard",
    "zh": "綠色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "see-through dress",
    "zh": "透視洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "eyepatch bikini",
    "zh": "眼罩式比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "purple bodysuit",
    "zh": "紫色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "blue overalls",
    "zh": "藍色吊帶褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "overalls"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "swim trunks",
    "zh": "泳褲",
    "section": "clothing",
    "gate": "male",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "pink apron",
    "zh": "粉紅色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "two-tone swimsuit",
    "zh": "雙色泳衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "open dress",
    "zh": "敞開的洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "layered bikini",
    "zh": "層疊比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "tokyo-3 middle school uniform",
    "zh": "第3新東京市中學制服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "uranohoshi school uniform",
    "zh": "浦之星女學院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "gekkoukan high school uniform",
    "zh": "月光館學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "sleepwear",
    "zh": "睡衣類",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_night"
  },
  {
    "tag": "paradis military uniform",
    "zh": "帕拉迪島軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "nanamori school uniform",
    "zh": "七森中學制服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "american flag dress",
    "zh": "美國國旗圖案洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "black apron",
    "zh": "黑色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "ribbed dress",
    "zh": "羅紋洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "pirate costume",
    "zh": "海盜裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "two-tone bikini",
    "zh": "雙色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "multicolored swimsuit",
    "zh": "多色泳衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "orange bodysuit",
    "zh": "橘色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "sailor bikini",
    "zh": "水手比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "blue apron",
    "zh": "藍色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "asticassia school uniform",
    "zh": "阿斯提卡西亞學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "mismatched bikini",
    "zh": "左右不一致的比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "american flag bikini",
    "zh": "美國國旗圖案比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "meiji schoolgirl uniform",
    "zh": "明治女學生制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "bow bikini",
    "zh": "蝴蝶結比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "pink bodysuit",
    "zh": "粉紅色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "shimakaze (kancolle) (cosplay)",
    "zh": "島風（艦これ）角色扮演",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "white suit",
    "zh": "白色西裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "kuromorimine military uniform",
    "zh": "黑森峰軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "kitauji high school uniform",
    "zh": "北宇治高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "gem uniform (houseki no kuni)",
    "zh": "寶石制服（寶石之國）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "gold bikini",
    "zh": "金色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "impossible bodysuit",
    "zh": "極度緊繃的連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "ruffle bikini",
    "zh": "荷葉邊比基尼（ruffle bikini）",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "hasu no sora school uniform",
    "zh": "蓮之空女學院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "zero suit",
    "zh": "零式裝甲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "backless leotard",
    "zh": "露背緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "white romper",
    "zh": "白色連身短褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "romper"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "aqua bikini",
    "zh": "水藍色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "nijigasaki school uniform",
    "zh": "虹咲學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "santa bikini",
    "zh": "聖誕老人比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "naoetsu high school uniform",
    "zh": "直江津高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "plaid bikini",
    "zh": "格紋比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "purple serafuku",
    "zh": "紫色水手服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "serafuku"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "see-through leotard",
    "zh": "透視緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "st. gloriana's school uniform",
    "zh": "聖葛洛莉安娜女學院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "millennium cheerleader outfit (blue archive)",
    "zh": "千年啦啦隊服（蔚藍檔案）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "little busters! school uniform",
    "zh": "Little Busters! 學校制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "impossible leotard",
    "zh": "極度緊繃的緊身連衣褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "turtleneck leotard",
    "zh": "高領緊身衣(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "lycoris uniform",
    "zh": "莉可麗絲制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "impossible dress",
    "zh": "極度緊繃的洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "bondage outfit",
    "zh": "束縛風服裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "ooarai military uniform",
    "zh": "大洗軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "shuuchiin academy school uniform",
    "zh": "秀知院學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "champion's tunic (zelda)",
    "zh": "勇者之服（薩爾達）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "green apron",
    "zh": "綠色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "hikarizaka private high school uniform",
    "zh": "光坂高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "side-tie leotard",
    "zh": "側綁緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "pink pajamas",
    "zh": "粉紅色睡衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "pajamas"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_night"
  },
  {
    "tag": "tactical clothes",
    "zh": "戰術服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "impossible swimsuit",
    "zh": "極度緊繃的泳衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "multicolored leotard",
    "zh": "多色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "st. gloriana's military uniform",
    "zh": "聖葛洛莉安娜軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "anzio school uniform",
    "zh": "安齊奧高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "tankini",
    "zh": "背心式比基尼",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "hooded robe",
    "zh": "連帽長袍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "robe"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "yasogami school uniform",
    "zh": "八十神高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "male playboy bunny",
    "zh": "男性兔女郎",
    "section": "clothing",
    "gate": "male",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "playboy bunny"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "kibito high school uniform",
    "zh": "私立吉備人高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "two-tone bodysuit",
    "zh": "雙色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "green bodysuit",
    "zh": "綠色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "gradient dress",
    "zh": "漸層洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "vocaloid append",
    "zh": "Vocaloid Append",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "rabbit house uniform",
    "zh": "兔子屋制服（點兵點將）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "blue robe",
    "zh": "藍色長袍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "robe"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "reindeer costume",
    "zh": "馴鹿裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "diving suit",
    "zh": "潛水衣（diving suit）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "embellished costume",
    "zh": "華麗改造服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "grey bodysuit",
    "zh": "灰色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "red apron",
    "zh": "紅色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "yellow apron",
    "zh": "黃色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "off-shoulder bikini",
    "zh": "露肩比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "brown apron",
    "zh": "棕色圍裙",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "apron"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "pink one-piece swimsuit",
    "zh": "粉紅色連身泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "one-piece swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "team rocket uniform",
    "zh": "火箭隊制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "kuromorimine school uniform",
    "zh": "黑森峰女學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "grey bikini",
    "zh": "灰色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "kigurumi",
    "zh": "著ぐるみ(連身布偶裝)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "u.a. school uniform",
    "zh": "雄英高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "jujutsu tech uniform",
    "zh": "咒術高專制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "hatsune miku (cosplay)",
    "zh": "初音未來角色扮演",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "white serafuku",
    "zh": "白色水手服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "serafuku"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "frilled leotard",
    "zh": "荷葉邊緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "yurigaoka girls academy school uniform",
    "zh": "百合丘女子學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "hakurei reimu (cosplay)",
    "zh": "博麗靈夢角色扮演",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "haneoka school uniform",
    "zh": "羽丘女子學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "sakugawa school uniform",
    "zh": "佐久川中學制服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "brown bikini",
    "zh": "棕色比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "oohashi high school uniform",
    "zh": "大橋高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "two-tone leotard",
    "zh": "雙色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "cross-laced dress",
    "zh": "交叉綁帶洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "icho private high school uniform",
    "zh": "私立銀杏高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "ribbon-trimmed dress",
    "zh": "緞帶滾邊洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "a certain high school uniform",
    "zh": "某高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "yellow bodysuit",
    "zh": "黃色連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "purple one-piece swimsuit",
    "zh": "紫色連身泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "one-piece swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "ribbed bodysuit",
    "zh": "羅紋連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "sleeved leotard",
    "zh": "有袖緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "athletic leotard",
    "zh": "運動緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "hanasakigawa school uniform",
    "zh": "花咲川女子學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "sobu high school uniform",
    "zh": "總武高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "power suit (metroid)",
    "zh": "動力服（銀河戰士）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "eden academy school uniform",
    "zh": "伊甸學院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "torn leotard",
    "zh": "破損的緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "naranja academy school uniform",
    "zh": "橙子學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "ribbed leotard",
    "zh": "羅紋緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "new school swimsuit",
    "zh": "新式學校泳衣(新スク)",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "school swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "yellow leotard",
    "zh": "黃色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "shark costume",
    "zh": "鯊魚裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "fourth east high school uniform",
    "zh": "第四東高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "shinda sekai sensen uniform",
    "zh": "死後世界戰線制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "vampire costume",
    "zh": "吸血鬼裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "yuigaoka school uniform",
    "zh": "由比濱丘高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "kiyosumi school uniform",
    "zh": "清澄高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "mummy costume",
    "zh": "木乃伊裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "kirin (armor)",
    "zh": "麒麟（防具）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "polka dot swimsuit",
    "zh": "圓點泳衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "bikesuit",
    "zh": "機車騎士連身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "prison clothes",
    "zh": "囚服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "shell bikini",
    "zh": "貝殼比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "kourindou tengu costume",
    "zh": "香霖堂天狗服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "loungewear",
    "zh": "居家服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "ghost costume",
    "zh": "幽靈裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "tracen swimsuit",
    "zh": "特雷森泳裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "brown leotard",
    "zh": "棕色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "shuka high school uniform",
    "zh": "修學院高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "tutu",
    "zh": "芭蕾蓬裙(tutu)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "shuujin academy school uniform",
    "zh": "修央學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "wagnaria uniform",
    "zh": "華格納利亞制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "nanairogaoka middle school uniform",
    "zh": "七色之丘中學制服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "power suit",
    "zh": "動力裝甲（power suit）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "uva academy school uniform",
    "zh": "UVA 學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "aria company uniform",
    "zh": "ARIA Company 制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "tight dress",
    "zh": "緊身洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "kamiyama high school uniform (hyouka)",
    "zh": "神山高中制服（冰菓）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "two-sided dress",
    "zh": "雙面洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "vertical-striped bikini",
    "zh": "直條紋比基尼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "hooded bodysuit",
    "zh": "連帽連身緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "bodysuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "griffin & kryuger military uniform",
    "zh": "格里芬&克魯格軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "pravda school uniform",
    "zh": "真理女子學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "saiyan armor",
    "zh": "賽亞人戰鬥服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "armor"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "edo"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "swimsuit cover-up",
    "zh": "泳衣罩衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "keizoku military uniform",
    "zh": "繼續高中軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "duel academy uniform (yu-gi-oh! gx)",
    "zh": "決鬥學院制服（遊戲王GX）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "alice (alice in wonderland) (cosplay)",
    "zh": "愛麗絲（愛麗絲夢遊仙境）角色扮演",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "torn swimsuit",
    "zh": "破損的泳衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "sukajan",
    "zh": "橫須賀夾克(sukajan)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "mash kyrielight (dangerous beast) (cosplay)",
    "zh": "瑪修．基列萊特（危險野獸）角色扮演",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "blue pajamas",
    "zh": "藍色睡衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "pajamas"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_night"
  },
  {
    "tag": "saunders military uniform",
    "zh": "薩德斯軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "grey leotard",
    "zh": "灰色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "taimanin suit",
    "zh": "對魔忍緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "grey serafuku",
    "zh": "灰色水手服",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform",
      "serafuku"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "kamiyama high school uniform (project sekai)",
    "zh": "神山高中制服（世界計畫）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "coat dress",
    "zh": "大衣式洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress",
      "coat"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "bc freedom military uniform",
    "zh": "BC自由學園軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "bear costume",
    "zh": "熊裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "ashford academy school uniform",
    "zh": "阿什佛德學園制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "hooded dress",
    "zh": "連帽洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "luna nova school uniform",
    "zh": "露娜諾瓦魔法學院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "grey suit",
    "zh": "灰色西裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "miyamasuzaka girls' academy school uniform",
    "zh": "宮益坂女學院制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "fleur de lapin uniform",
    "zh": "Fleur de Lapin 制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "print leotard",
    "zh": "印花緊身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "strapless one-piece swimsuit",
    "zh": "無肩帶連身泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "one-piece swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "youtou high school uniform",
    "zh": "陽東高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "virgin destroyer sweater",
    "zh": "破處毛衣(梗服飾)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "off-shoulder one-piece swimsuit",
    "zh": "露肩連身泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "one-piece swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "hogwarts school uniform",
    "zh": "霍格華茲制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "self-cosplay",
    "zh": "自我角色扮演",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "red robe",
    "zh": "紅色長袍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "robe"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "wa lolita",
    "zh": "和風蘿莉塔服飾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "fab_style"
  },
  {
    "tag": "undersuit",
    "zh": "內層服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "amesuku gyaru",
    "zh": "美式休閒辣妹",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "fab_style"
  },
  {
    "tag": "checkered dress",
    "zh": "棋盤格紋洋裝",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "dress"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "tokisadame school uniform",
    "zh": "時定高中制服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "school uniform"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "anzio military uniform",
    "zh": "安齊奧軍服",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "military uniform"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "cat costume",
    "zh": "貓裝（cat costume）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "sophist's robe (ff14)",
    "zh": "詭辯者長袍（FF14）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "robe"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_night"
  },
  {
    "tag": "varia suit",
    "zh": "變異服（銀河戰士）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "any"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "orange leotard",
    "zh": "橘色緊身連衣褲(leotard)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "leotard"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "pinstripe suit",
    "zh": "細條紋西裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "suit"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "victorian"
    ],
    "needs": [],
    "sub": "op_uniform"
  },
  {
    "tag": "virgin killer outfit",
    "zh": "殺死處男的服裝(梗服飾)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_dress"
  },
  {
    "tag": "orange jumpsuit",
    "zh": "橘色連身衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "jumpsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_body"
  },
  {
    "tag": "black slingshot swimsuit",
    "zh": "黑色彈弓式泳衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "slingshot swimsuit"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "op_swim"
  },
  {
    "tag": "black cape",
    "zh": "黑色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "white capelet",
    "zh": "白色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "white cape",
    "zh": "白色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "blue cape",
    "zh": "藍色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "multicolored jacket",
    "zh": "多色夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "collared jacket",
    "zh": "有領夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "black capelet",
    "zh": "黑色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "red capelet",
    "zh": "紅色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "waist cape",
    "zh": "腰間披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "two-tone jacket",
    "zh": "雙色夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "black cloak",
    "zh": "黑色斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "blue capelet",
    "zh": "藍色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "striped jacket",
    "zh": "條紋夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "hooded capelet",
    "zh": "連帽短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "green cape",
    "zh": "綠色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "yellow cardigan",
    "zh": "黃色開襟針織衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cardigan"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "white cloak",
    "zh": "白色斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "purple cape",
    "zh": "紫色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "two-sided cape",
    "zh": "雙面披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "red cloak",
    "zh": "紅色斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "torn cape",
    "zh": "破損的披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "two-sided jacket",
    "zh": "雙面夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "brown capelet",
    "zh": "棕色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "red hoodie",
    "zh": "紅色連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "hooded cape",
    "zh": "連帽披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "green hoodie",
    "zh": "綠色連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "frilled capelet",
    "zh": "荷葉邊短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "brown cape",
    "zh": "棕色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "yellow hoodie",
    "zh": "黃色連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "collared cape",
    "zh": "有領披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "plaid jacket",
    "zh": "格紋夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "fur-trimmed cloak",
    "zh": "毛皮滾邊斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "cropped hoodie",
    "zh": "短版連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "blue cloak",
    "zh": "藍色斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "purple capelet",
    "zh": "紫色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "brown cloak",
    "zh": "棕色斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "multicolored coat",
    "zh": "多色大衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "coat"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "stole",
    "zh": "披肩長巾",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "purple hoodie",
    "zh": "紫色連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "print jacket",
    "zh": "印花外套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "green capelet",
    "zh": "綠色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "aqua jacket",
    "zh": "水藍色夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "brown hoodie",
    "zh": "棕色連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "orange hoodie",
    "zh": "橘色連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "no jacket",
    "zh": "沒穿外套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "pink capelet",
    "zh": "粉紅色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "sleeveless coat",
    "zh": "無袖大衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "coat"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "overcoat",
    "zh": "長大衣（overcoat）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "yellow cape",
    "zh": "黃色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "torn jacket",
    "zh": "破損的夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "off-shoulder jacket",
    "zh": "露肩夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "floating cape",
    "zh": "飄浮的披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "hooded cardigan",
    "zh": "連帽開襟針織衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cardigan"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "two-tone cape",
    "zh": "雙色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "blue tabard",
    "zh": "藍色無袖罩袍",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "tabard"
    ],
    "layer": "garment",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "fur cape",
    "zh": "毛皮披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "grey capelet",
    "zh": "灰色短披肩",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "capelet"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "pink cape",
    "zh": "粉紅色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "tied jacket",
    "zh": "外套打結穿法",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "vertical-striped jacket",
    "zh": "直條紋夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "two-tone hoodie",
    "zh": "雙色連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "grey cape",
    "zh": "灰色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "see-through jacket",
    "zh": "透視夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "striped hoodie",
    "zh": "條紋連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "two-sided coat",
    "zh": "雙面大衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "coat"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "green cloak",
    "zh": "綠色斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "purple cardigan",
    "zh": "紫色開襟針織衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cardigan"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "multicolored cape",
    "zh": "多色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "hooded track jacket",
    "zh": "連帽運動外套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "track jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "yellow raincoat",
    "zh": "黃色雨衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "raincoat"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "print hoodie",
    "zh": "印花連帽衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "hoodie"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "fur cloak",
    "zh": "毛皮斗篷",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cloak"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "two-tone coat",
    "zh": "雙色大衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "coat"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "blue shawl",
    "zh": "藍色披肩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "shawl"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "frilled jacket",
    "zh": "荷葉邊夾克",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "orange cape",
    "zh": "橘色披風",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cape"
    ],
    "layer": "garment",
    "era": [
      "medieval",
      "victorian",
      "ancient_greece"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "down jacket",
    "zh": "羽絨外套",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "jacket"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "parka",
    "zh": "派克大衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "surcoat",
    "zh": "罩袍（surcoat）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "red cardigan",
    "zh": "紅色開襟針織衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "outer",
    "bind": [],
    "implies": [
      "cardigan"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "outer"
  },
  {
    "tag": "front-tie top",
    "zh": "前綁上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "front-tie bikini top",
    "zh": "前綁比基尼上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "criss-cross halter",
    "zh": "交叉掛頸式",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "red vest",
    "zh": "紅色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "bandeau",
    "zh": "抹胸帶",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "blue vest",
    "zh": "藍色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "o-ring top",
    "zh": "O環上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "green vest",
    "zh": "綠色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "plaid vest",
    "zh": "格紋背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "brown vest",
    "zh": "棕色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "open vest",
    "zh": "敞開的背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "chest sarashi",
    "zh": "胸前白布(sarashi)",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sarashi"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "edo"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "yellow sweater",
    "zh": "黃色毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "grey vest",
    "zh": "灰色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "white vest",
    "zh": "白色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "purple vest",
    "zh": "紫色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "brown sweater vest",
    "zh": "棕色毛衣背心",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater vest",
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "purple sweater",
    "zh": "紫色毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "yellow vest",
    "zh": "黃色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "bulletproof vest",
    "zh": "防彈背心",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "open-chest sweater",
    "zh": "開胸毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "fishnet top",
    "zh": "網狀上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "pink vest",
    "zh": "粉紅色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "cropped vest",
    "zh": "短版背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "striped sweater",
    "zh": "條紋毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "multicolored shirt",
    "zh": "多色襯衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "shirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "budget sarashi",
    "zh": "迷你裹胸(budget_sarashi)",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sarashi"
    ],
    "layer": "garment",
    "era": [
      "modern",
      "edo"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "hooded sweater",
    "zh": "連帽毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "bodice",
    "zh": "緊身胸衣(bodice)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "yellow sweater vest",
    "zh": "黃色毛衣背心",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater vest",
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "cropped sweater",
    "zh": "短版毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "black sweater vest",
    "zh": "黑色毛衣背心",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater vest",
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "multi-strapped bikini top",
    "zh": "多肩帶比基尼上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "load-bearing vest",
    "zh": "戰術背心",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "collared vest",
    "zh": "有領背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "orange vest",
    "zh": "橘色背心(外搭)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "vest"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "orange sweater",
    "zh": "橘色毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "short-sleeved sweater",
    "zh": "短袖毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "blue tunic",
    "zh": "藍色長版上衣(tunic)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "tunic"
    ],
    "layer": "garment",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "blue tank top",
    "zh": "藍色背心(tank top)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "tank top"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "loose shirt",
    "zh": "寬鬆襯衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "shirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "grey tank top",
    "zh": "灰色背心(tank top)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "tank top"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "frilled camisole",
    "zh": "荷葉邊細肩帶背心",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "camisole"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "green tunic",
    "zh": "綠色長版上衣(tunic)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "tunic"
    ],
    "layer": "garment",
    "era": [
      "medieval"
    ],
    "needs": [],
    "sub": "era_west"
  },
  {
    "tag": "yellow tank top",
    "zh": "黃色背心(tank top)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "tank top"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "racerback",
    "zh": "工字背(競速背)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "green tank top",
    "zh": "綠色背心(tank top)",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "tank top"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "polka dot shirt",
    "zh": "圓點襯衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "shirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "black tube top",
    "zh": "黑色平口上衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "tube top"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "checkered shirt",
    "zh": "棋盤格紋襯衫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "shirt"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "cross-laced top",
    "zh": "交叉綁帶上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "black bandeau",
    "zh": "黑色抹胸",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "blue camisole",
    "zh": "藍色細肩帶背心",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "camisole"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "argyle sweater",
    "zh": "菱格紋毛衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "sweater"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_knit"
  },
  {
    "tag": "white tube top",
    "zh": "白色平口上衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "tube top"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_tank"
  },
  {
    "tag": "sling bikini top",
    "zh": "吊帶式比基尼上衣",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "top",
    "bind": [],
    "implies": [
      "bikini"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "top_shirt"
  },
  {
    "tag": "crotch seam",
    "zh": "胯部接縫",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "lowleg panties",
    "zh": "低腰內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "wet panties",
    "zh": "濕透的內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "cat lingerie",
    "zh": "貓咪內衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "onepiece",
    "bind": [],
    "implies": [
      "lingerie"
    ],
    "layer": "garment",
    "era": [
      "victorian",
      "modern"
    ],
    "needs": [],
    "sub": "op_night"
  },
  {
    "tag": "breastless clothes",
    "zh": "露胸服裝",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "trefoil",
    "zh": "三葉形（緊貼輪廓）",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "white sports bra",
    "zh": "白色運動內衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "sports bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "untied panties",
    "zh": "鬆開的內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "open bra",
    "zh": "敞開的胸罩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "yellow bra",
    "zh": "黃色胸罩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "belt bra",
    "zh": "皮帶胸衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "grey sports bra",
    "zh": "灰色運動內衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "sports bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "stained panties",
    "zh": "沾污漬的內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "two-tone sports bra",
    "zh": "雙色運動內衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "sports bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "brown panties",
    "zh": "棕色內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "torn panties",
    "zh": "破損的內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "plaid panties",
    "zh": "格紋內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "star pasties",
    "zh": "星形乳貼",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [
      "pasties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [
      "female"
    ],
    "sub": "acc_toy"
  },
  {
    "tag": "jockstrap",
    "zh": "運動護襠(男用)",
    "section": "clothing",
    "gate": "male",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "back-print panties",
    "zh": "後片印花內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "string bra",
    "zh": "細繩胸罩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "panties under buruma",
    "zh": "燈籠褲下穿內褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "bottom",
    "bind": [],
    "implies": [
      "buruma",
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "bot_pants"
  },
  {
    "tag": "multi-strapped panties",
    "zh": "多肩帶內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "brown bra",
    "zh": "棕色胸罩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "strawberry print panties",
    "zh": "草莓圖樣內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "print panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "aqua bra",
    "zh": "水藍色胸罩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "oversized breast cup",
    "zh": "過大罩杯",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "red sports bra",
    "zh": "紅色運動內衣",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "sports bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "satin panties",
    "zh": "緞面內褲",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_bottom",
    "bind": [],
    "implies": [
      "panties"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  },
  {
    "tag": "plaid bra",
    "zh": "格紋胸罩",
    "section": "clothing",
    "gate": "female",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": "underwear_top",
    "bind": [],
    "implies": [
      "bra"
    ],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_top"
  },
  {
    "tag": "underwear",
    "zh": "內衣褲",
    "section": "clothing",
    "gate": "any",
    "heat": [
      "tease",
      "flash",
      "sex"
    ],
    "mutex": None,
    "bind": [],
    "implies": [],
    "layer": "garment",
    "era": [
      "modern"
    ],
    "needs": [],
    "sub": "uw_bottom"
  }
]

GROUP_OF = {
  "headgear": "acc",
  "blue ribbon": "acc",
  "white ribbon": "acc",
  "yellow bow": "acc",
  "green bow": "acc",
  "pink ribbon": "acc",
  "purple bow": "acc",
  "swim ring": "acc",
  "yellow ribbon": "acc",
  "school bag": "acc",
  "striped bow": "acc",
  "mouth mask": "acc",
  "animal hood": "acc",
  "heart hair ornament": "acc",
  "tress ribbon": "acc",
  "green ribbon": "acc",
  "fake horns": "acc",
  "purple ribbon": "acc",
  "butterfly hair ornament": "acc",
  "spaghetti strap": "acc",
  "back bow": "acc",
  "orange bow": "acc",
  "animal ear hairband": "acc",
  "tail ornament": "acc",
  "emblem": "acc",
  "newsboy cap": "acc",
  "food-themed hair ornament": "acc",
  "frog hair ornament": "acc",
  "triangular headpiece": "acc",
  "pink hat": "acc",
  "rabbit ear hairband": "acc",
  "horn ornament": "acc",
  "holster": "acc",
  "red halo": "acc",
  "bridal veil": "acc",
  "mechanical halo": "acc",
  "forehead jewel": "acc",
  "arm strap": "acc",
  "ear ornament": "acc",
  "purple hat": "acc",
  "snake hair ornament": "acc",
  "blue gem": "acc",
  "animal hat": "acc",
  "unworn eyewear": "acc",
  "frilled bow": "acc",
  "striped necktie": "acc",
  "nun headdress": "acc",
  "sack": "acc",
  "harness": "acc",
  "white belt": "acc",
  "lolita hairband": "acc",
  "hat feather": "acc",
  "asymmetrical gloves": "acc",
  "tilted headwear": "acc",
  "headscarf": "acc",
  "leg ribbon": "acc",
  "crescent hair ornament": "acc",
  "rabbit hair ornament": "acc",
  "white collar": "acc",
  "animal ear piercing": "acc",
  "yellow halo": "acc",
  "strap": "acc",
  "spiked collar": "acc",
  "bow hairband": "acc",
  "leaf hair ornament": "acc",
  "belt pouch": "acc",
  "crescent hat ornament": "acc",
  "neck ring": "acc",
  "spiked bracelet": "acc",
  "charm (object)": "acc",
  "frilled hairband": "acc",
  "purple bowtie": "acc",
  "bead bracelet": "acc",
  "blue choker": "acc",
  "cross hair ornament": "acc",
  "badge": "acc",
  "ears through headwear": "acc",
  "aqua necktie": "acc",
  "polka dot bow": "acc",
  "yellow bowtie": "acc",
  "arm guards": "acc",
  "grey gloves": "acc",
  "yellow hairband": "acc",
  "floating earrings": "acc",
  "striped bowtie": "acc",
  "star hat ornament": "acc",
  "chest jewel": "acc",
  "ear bow": "acc",
  "shoulder pads": "acc",
  "traditional bowtie": "acc",
  "mini top hat": "acc",
  "arm ribbon": "acc",
  "cube hair ornament": "acc",
  "arm garter": "acc",
  "white neckerchief": "acc",
  "grey hat": "acc",
  "pink hairband": "acc",
  "green gloves": "acc",
  "heart brooch": "acc",
  "print gloves": "acc",
  "belt collar": "acc",
  "multiple rings": "acc",
  "chest harness": "acc",
  "aqua bow": "acc",
  "white necktie": "acc",
  "eye mask": "acc",
  "plaid bow": "acc",
  "pink choker": "acc",
  "whistle": "acc",
  "green bowtie": "acc",
  "multicolored gloves": "acc",
  "anchor hair ornament": "acc",
  "short necktie": "acc",
  "purple necktie": "acc",
  "cross earrings": "acc",
  "forehead protector": "acc",
  "animal ear headphones": "acc",
  "multiple hair bows": "acc",
  "tail bow": "acc",
  "yellow gloves": "acc",
  "barbell piercing": "acc",
  "skull hair ornament": "acc",
  "plaid scarf": "acc",
  "red gem": "acc",
  "dog tags": "acc",
  "horn ribbon": "acc",
  "brown bow": "acc",
  "flower knot": "acc",
  "pink necktie": "acc",
  "mismatched gloves": "acc",
  "frilled hair tubes": "acc",
  "aiguillette": "acc",
  "white wrist cuffs": "acc",
  "traditional halo": "acc",
  "waist bow": "acc",
  "dress bow": "acc",
  "frilled hat": "acc",
  "large bow": "acc",
  "studs": "acc",
  "black ascot": "acc",
  "fur hat": "acc",
  "arm belt": "acc",
  "fur-trimmed headwear": "acc",
  "yellow hat": "acc",
  "striped scarf": "acc",
  "striped ribbon": "acc",
  "tail ribbon": "acc",
  "pink neckerchief": "acc",
  "footwear bow": "acc",
  "brown bag": "acc",
  "cat hair ornament": "acc",
  "black bag": "acc",
  "earclip": "acc",
  "blue ascot": "acc",
  "closed umbrella": "acc",
  "ring piercing": "acc",
  "single elbow glove": "acc",
  "quiver": "acc",
  "loose necktie": "acc",
  "frilled gloves": "acc",
  "green sailor collar": "fabric",
  "metal collar": "acc",
  "towel around neck": "acc",
  "purple hairband": "acc",
  "unworn mask": "acc",
  "multiple belts": "acc",
  "green gem": "acc",
  "blue belt": "acc",
  "grey sailor collar": "fabric",
  "red sailor collar": "fabric",
  "red rope": "acc",
  "two-tone gloves": "acc",
  "super crown": "acc",
  "red headband": "acc",
  "red belt": "acc",
  "heart choker": "acc",
  "surgical mask": "acc",
  "musical note hair ornament": "acc",
  "orange bowtie": "acc",
  "heart necklace": "acc",
  "wrist ribbon": "acc",
  "pink scarf": "acc",
  "brown scarf": "acc",
  "anal tail": "acc",
  "pirate hat": "acc",
  "cat ear headphones": "acc",
  "green halo": "acc",
  "red sash": "acc",
  "rectangular eyewear": "acc",
  "carrot hair ornament": "acc",
  "backwards hat": "acc",
  "black mask": "acc",
  "orange ribbon": "acc",
  "earpiece": "acc",
  "heart-shaped eyewear": "acc",
  "tassel hair ornament": "acc",
  "pince-nez": "acc",
  "crescent pin": "acc",
  "orange necktie": "acc",
  "shark hair ornament": "acc",
  "yellow scarf": "acc",
  "unworn helmet": "acc",
  "wing hair ornament": "acc",
  "diagonal-striped bow": "acc",
  "red armband": "acc",
  "rectangular halo": "acc",
  "opaque glasses": "acc",
  "orange hat": "acc",
  "wiffle gag": "acc",
  "purple choker": "acc",
  "cat hood": "acc",
  "multiple earrings": "acc",
  "paper bag": "acc",
  "green scarf": "acc",
  "black veil": "acc",
  "bone hair ornament": "acc",
  "cow print gloves": "acc",
  "aqua bowtie": "acc",
  "gold earrings": "acc",
  "orange hairband": "acc",
  "o-ring choker": "acc",
  "wizard hat": "acc",
  "wing ornament": "acc",
  "ear ribbon": "acc",
  "goggles on headwear": "acc",
  "tie clip": "acc",
  "diagonal-striped necktie": "acc",
  "feather boa": "acc",
  "bat hair ornament": "acc",
  "whistle around neck": "acc",
  "green hairband": "acc",
  "white headband": "acc",
  "black headband": "acc",
  "flower earrings": "acc",
  "thigh belt": "acc",
  "button badge": "acc",
  "goggles around neck": "acc",
  "bag charm": "acc",
  "o-ring bottom": "bottom",
  "two-tone bow": "acc",
  "purple halo": "acc",
  "white scrunchie": "acc",
  "fur-trimmed hood": "acc",
  "checkered scarf": "acc",
  "horseshoe ornament": "acc",
  "white veil": "acc",
  "domino mask": "acc",
  "pom pom hair ornament": "acc",
  "single ear cover": "acc",
  "horned headwear": "acc",
  "orange gloves": "acc",
  "blue-framed eyewear": "acc",
  "nightcap": "acc",
  "sphere earrings": "acc",
  "rabbit hood": "acc",
  "crescent earrings": "acc",
  "gas mask": "acc",
  "strap between breasts": "acc",
  "black sash": "acc",
  "medal": "acc",
  "loose belt": "acc",
  "horn bow": "acc",
  "chest belt": "acc",
  "print bowtie": "acc",
  "plaid bowtie": "acc",
  "plastic bag": "acc",
  "qingdai guanmao": "acc",
  "pink scrunchie": "acc",
  "horned helmet": "acc",
  "shoulder spikes": "acc",
  "shoulder boards": "acc",
  "frilled ribbon": "acc",
  "purple scarf": "acc",
  "over-rim eyewear": "acc",
  "brown ribbon": "acc",
  "ankle ribbon": "acc",
  "purple umbrella": "acc",
  "single pauldron": "acc",
  "yellow scrunchie": "acc",
  "red umbrella": "acc",
  "single hair ring": "acc",
  "clover hair ornament": "acc",
  "porkpie hat": "acc",
  "neck ruff": "acc",
  "black halo": "acc",
  "snowflake hair ornament": "acc",
  "large hat": "acc",
  "grey halo": "acc",
  "thumb ring": "acc",
  "gold bracelet": "acc",
  "plaid necktie": "acc",
  "pendant choker": "acc",
  "talisman": "acc",
  "duffel bag": "acc",
  "ear tag": "acc",
  "feather earrings": "acc",
  "orange-tinted eyewear": "acc",
  "ankle lace-up": "feet",
  "grey bow": "acc",
  "red bag": "acc",
  "pink-framed eyewear": "acc",
  "fur scarf": "acc",
  "grey neckerchief": "acc",
  "uneven gloves": "acc",
  "safety pin": "acc",
  "brown sailor collar": "fabric",
  "diamond hairband": "acc",
  "aqua ribbon": "acc",
  "shako cap": "acc",
  "grey-framed eyewear": "acc",
  "pink bag": "acc",
  "green neckerchief": "acc",
  "torpedo tubes": "acc",
  "star halo": "acc",
  "blue sash": "acc",
  "no eyewear": "acc",
  "o-ring thigh strap": "acc",
  "white sash": "acc",
  "red bandana": "acc",
  "character hair ornament": "acc",
  "green choker": "acc",
  "nose piercing": "acc",
  "insignia": "acc",
  "animal ear headwear": "acc",
  "yellow belt": "acc",
  "cat hat": "acc",
  "gold necklace": "acc",
  "pith helmet": "acc",
  "winged hat": "acc",
  "fanny pack": "acc",
  "yellow-framed eyewear": "acc",
  "patch": "acc",
  "cloth gag": "acc",
  "white-framed eyewear": "acc",
  "transparent umbrella": "acc",
  "purple sailor collar": "fabric",
  "orange scrunchie": "acc",
  "ankle cuffs": "acc",
  "purple gem": "acc",
  "heart o-ring": "acc",
  "magatama necklace": "acc",
  "blue bag": "acc",
  "carrot necklace": "acc",
  "star choker": "acc",
  "studded belt": "acc",
  "red-tinted eyewear": "acc",
  "chest strap": "acc",
  "grey necktie": "acc",
  "orange choker": "acc",
  "white bag": "acc",
  "d-pad hair ornament": "acc",
  "oni mask": "acc",
  "gorget": "acc",
  "thigh ribbon": "acc",
  "alternate headwear": "acc",
  "sleeve garter": "acc",
  "black garter straps": "legs",
  "plaid hat": "acc",
  "satchel": "acc",
  "multicolored hairband": "acc",
  "school emblem": "acc",
  "helm": "acc",
  "tam o' shanter": "acc",
  "diving mask": "acc",
  "pearl": "acc",
  "orange neckerchief": "acc",
  "brown necktie": "acc",
  "shark hood": "acc",
  "yellow choker": "acc",
  "dynamax band": "acc",
  "tail bell": "acc",
  "single fingerless glove": "acc",
  "sweatband": "acc",
  "see-through veil": "acc",
  "fish hair ornament": "acc",
  "orange scarf": "acc",
  "purple belt": "acc",
  "lip piercing": "acc",
  "bear hair ornament": "acc",
  "dalachi (headdress)": "acc",
  "condom packet strip": "acc",
  "winged helmet": "acc",
  "brown hairband": "acc",
  "party hat": "acc",
  "black garter belt": "legs",
  "mouth veil": "acc",
  "utility belt": "acc",
  "leg belt": "acc",
  "grey scarf": "acc",
  "eyebrow piercing": "acc",
  "two-tone ribbon": "acc",
  "gold hairband": "acc",
  "spiked armlet": "acc",
  "space helmet": "acc",
  "hair through headwear": "acc",
  "star necklace": "acc",
  "fake wings": "acc",
  "heart button": "acc",
  "blue headband": "acc",
  "striped gloves": "acc",
  "multicolored bow": "acc",
  "pink belt": "acc",
  "two-tone bowtie": "acc",
  "single gauntlet": "acc",
  "flower ornament": "acc",
  "square-end necktie": "acc",
  "arm wrap": "acc",
  "claw ring": "acc",
  "checkered necktie": "acc",
  "leather belt": "acc",
  "skull earrings": "acc",
  "tricorne": "acc",
  "yellow sash": "acc",
  "animal bag": "acc",
  "blue collar": "acc",
  "multiple piercings": "acc",
  "shoulder strap": "acc",
  "yellow bag": "acc",
  "red hood": "acc",
  "loose bowtie": "acc",
  "ribbon-trimmed collar": "acc",
  "pillbox hat": "acc",
  "frilled cuffs": "acc",
  "pink sailor collar": "fabric",
  "unworn bag": "acc",
  "fake antlers": "acc",
  "bowl hat": "acc",
  "dixie cup hat": "acc",
  "triangle earrings": "acc",
  "gold choker": "acc",
  "bow earrings": "acc",
  "blue-tinted eyewear": "acc",
  "horns through headwear": "acc",
  "purple-tinted eyewear": "acc",
  "pink collar": "acc",
  "aqua neckerchief": "acc",
  "yellow armband": "acc",
  "eyewear on headwear": "acc",
  "respirator": "acc",
  "fur-trimmed collar": "acc",
  "combat helmet": "acc",
  "used tissue": "acc",
  "ammunition pouch": "acc",
  "bow choker": "acc",
  "grey belt": "acc",
  "brown-framed eyewear": "acc",
  "striped headwear": "acc",
  "skull mask": "acc",
  "ankle strap": "acc",
  "wrist guards": "acc",
  "neck flower": "acc",
  "green-framed eyewear": "acc",
  "unworn gloves": "acc",
  "linked piercing": "acc",
  "undone necktie": "acc",
  "brown bowtie": "acc",
  "sleep mask": "acc",
  "gold crown": "acc",
  "triangle hair ornament": "acc",
  "industrial piercing": "acc",
  "open belt": "acc",
  "pink-tinted eyewear": "acc",
  "sleeve bow": "acc",
  "bolo tie": "acc",
  "broken halo": "acc",
  "single strap": "acc",
  "moon (ornament)": "acc",
  "lube": "acc",
  "fishnet gloves": "acc",
  "rider belt": "acc",
  "eyewear strap": "acc",
  "cross tie": "acc",
  "tube": "acc",
  "magatama earrings": "acc",
  "white headdress": "acc",
  "sunflower hair ornament": "acc",
  "candy hair ornament": "acc",
  "mask around neck": "acc",
  "grey ribbon": "acc",
  "white garter straps": "legs",
  "two-tone headwear": "acc",
  "orange sailor collar": "fabric",
  "pearl earrings": "acc",
  "leather gloves": "acc",
  "green bag": "acc",
  "spiked choker": "acc",
  "deerstalker": "acc",
  "white mask": "acc",
  "bandaid hair ornament": "acc",
  "shin guards": "acc",
  "purple neckerchief": "acc",
  "earth (ornament)": "acc",
  "pearl bracelet": "acc",
  "white umbrella": "acc",
  "spiked halo": "acc",
  "tail piercing": "acc",
  "diagonal-striped bowtie": "acc",
  "crime prevention buzzer": "acc",
  "orange headband": "acc",
  "pink wrist cuffs": "acc",
  "key necklace": "acc",
  "aqua hat": "acc",
  "kepi": "acc",
  "huge bow": "acc",
  "kurokote": "acc",
  "lace choker": "acc",
  "no gloves": "acc",
  "star brooch": "acc",
  "snorkel": "acc",
  "purple sash": "acc",
  "white hood": "acc",
  "noh mask": "acc",
  "food-themed earrings": "acc",
  "tulip hat": "acc",
  "clitoral piercing": "acc",
  "lapel pin": "acc",
  "plume": "acc",
  "ninja mask": "acc",
  "orange ascot": "acc",
  "hauchiwa": "acc",
  "condom belt": "acc",
  "coif": "acc",
  "frilled ascot": "acc",
  "torn scarf": "acc",
  "sleeve ribbon": "acc",
  "strawberry hair ornament": "acc",
  "blue helmet": "acc",
  "trash bag": "acc",
  "dice hair ornament": "acc",
  "purple scrunchie": "acc",
  "print headwear": "acc",
  "two-tone hairband": "acc",
  "red mask": "acc",
  "neck tassel": "acc",
  "motorcycle helmet": "acc",
  "arched crown": "acc",
  "nejiri hachimaki": "era",
  "pink ascot": "acc",
  "diving mask on head": "acc",
  "papakha": "acc",
  "grey hairband": "acc",
  "lace-trimmed gloves": "acc",
  "polka dot headwear": "acc",
  "scarf over mouth": "acc",
  "wig": "acc",
  "wrist bow": "acc",
  "cat ear hairband": "acc",
  "black bridal gauntlets": "acc",
  "torn gloves": "acc",
  "ammunition belt": "acc",
  "bird mask": "acc",
  "blue armband": "acc",
  "coin on string": "acc",
  "single epaulette": "acc",
  "pointed crown": "acc",
  "green belt": "acc",
  "tail ring": "acc",
  "bicorne": "acc",
  "lace gloves": "acc",
  "shoulder sash": "acc",
  "boobplate": "acc",
  "crystal earrings": "acc",
  "no mask": "acc",
  "heart collar": "acc",
  "purple ascot": "acc",
  "anchor necklace": "acc",
  "black umbrella": "acc",
  "multicolored hat": "acc",
  "head chain": "acc",
  "green armband": "acc",
  "footwear ribbon": "acc",
  "bandolier": "acc",
  "brown choker": "acc",
  "grocery bag": "acc",
  "smokestack hair ornament": "acc",
  "egg hair ornament": "acc",
  "aviator sunglasses": "acc",
  "hexagon hair ornament": "acc",
  "chain headband": "acc",
  "usekh collar": "acc",
  "flower choker": "acc",
  "chinese hairpin": "acc",
  "single wrist cuff": "acc",
  "chinstrap": "acc",
  "anchor choker": "acc",
  "horn hairband": "acc",
  "single hair tube": "acc",
  "floating scarf": "acc",
  "multiple bracelets": "acc",
  "orange belt": "acc",
  "wrist wrap": "acc",
  "studded bracelet": "acc",
  "shoulder holster": "acc",
  "couter": "acc",
  "teardrop earrings": "acc",
  "flower brooch": "acc",
  "cross choker": "acc",
  "star ornament": "acc",
  "blue hood": "acc",
  "messenger bag": "acc",
  "frilled sailor collar": "fabric",
  "coin hair ornament": "acc",
  "pill earrings": "acc",
  "striped hairband": "acc",
  "amulet": "acc",
  "ornate ring": "acc",
  "brown collar": "acc",
  "white halo": "acc",
  "toe ring": "acc",
  "gift bag": "acc",
  "horn ring": "acc",
  "fake claws": "acc",
  "red mittens": "acc",
  "lace-trimmed choker": "acc",
  "aqua gloves": "acc",
  "sideways hat": "acc",
  "ribbon-trimmed headwear": "acc",
  "yellow-tinted eyewear": "acc",
  "flower bracelet": "acc",
  "white mittens": "acc",
  "black helmet": "acc",
  "shoulder cannon": "acc",
  "purple-framed eyewear": "acc",
  "unworn backpack": "acc",
  "single garter strap": "acc",
  "white garter belt": "legs",
  "ear protection": "acc",
  "halo behind head": "acc",
  "pearl hair ornament": "acc",
  "checkered sash": "acc",
  "cherry hair ornament": "acc",
  "rope belt": "acc",
  "medallion": "acc",
  "blue bandana": "acc",
  "green scrunchie": "acc",
  "lace-trimmed hairband": "acc",
  "four-leaf clover hair ornament": "acc",
  "multicolored scarf": "acc",
  "print necktie": "acc",
  "multicolored hair bobbles": "acc",
  "half mask": "acc",
  "shell necklace": "acc",
  "heart pendant": "acc",
  "arm cuffs": "acc",
  "black armband": "acc",
  "heart-shaped buckle": "acc",
  "black hood": "acc",
  "o-ring belt": "acc",
  "red helmet": "acc",
  "spiked hairband": "acc",
  "shoulder belt": "acc",
  "diamond hair ornament": "acc",
  "white helmet": "acc",
  "pink gem": "acc",
  "red crown": "acc",
  "green-tinted eyewear": "acc",
  "white bonnet": "acc",
  "blue umbrella": "acc",
  "purple collar": "acc",
  "pink umbrella": "acc",
  "shell hair ornament": "acc",
  "hat with ears": "acc",
  "bowler hat": "acc",
  "skull ornament": "acc",
  "biting glove": "acc",
  "rabbit hat": "acc",
  "pink sash": "acc",
  "kabuto (helmet)": "acc",
  "melting halo": "acc",
  "skirt bow": "acc",
  "eyelash ornament": "acc",
  "mitre": "acc",
  "green headband": "acc",
  "single arm warmer": "acc",
  "single knee pad": "acc",
  "penguin hood": "acc",
  "sam browne belt": "acc",
  "skull necklace": "acc",
  "dilation tape": "acc",
  "polka dot scrunchie": "acc",
  "wataboushi": "acc",
  "wing brooch": "acc",
  "plaid ribbon": "acc",
  "female service cap": "acc",
  "cat bag": "acc",
  "yellow gem": "acc",
  "pom pom beanie": "acc",
  "polka dot ribbon": "acc",
  "frilled headwear": "acc",
  "bikini skirt": "bottom",
  "sarong": "bottom",
  "red pants": "bottom",
  "cutoffs": "bottom",
  "showgirl skirt": "bottom",
  "green pants": "bottom",
  "torn pants": "bottom",
  "blue buruma": "bottom",
  "red buruma": "bottom",
  "track pants": "bottom",
  "baggy pants": "bottom",
  "bike shorts under skirt": "bottom",
  "gym shorts": "bottom",
  "multicolored skirt": "bottom",
  "checkered skirt": "bottom",
  "tight pants": "bottom",
  "two-tone skirt": "bottom",
  "purple pants": "bottom",
  "striped pants": "bottom",
  "open shorts": "bottom",
  "torn shorts": "bottom",
  "vertical-striped skirt": "bottom",
  "see-through skirt": "bottom",
  "open skirt": "bottom",
  "plaid pants": "bottom",
  "black buruma": "bottom",
  "chaps": "bottom",
  "open pants": "bottom",
  "puffy pants": "bottom",
  "fur-trimmed skirt": "bottom",
  "yellow pants": "bottom",
  "frilled shorts": "bottom",
  "orange pants": "bottom",
  "single pantsleg": "bottom",
  "harem pants": "bottom",
  "torn jeans": "bottom",
  "lace-trimmed skirt": "bottom",
  "overall shorts": "bottom",
  "fur-trimmed shorts": "bottom",
  "camouflage pants": "bottom",
  "kimono skirt": "bottom",
  "vertical-striped pants": "bottom",
  "lowleg pants": "bottom",
  "side slit shorts": "bottom",
  "print shorts": "bottom",
  "leather pants": "bottom",
  "polka dot skirt": "bottom",
  "cargo pants": "bottom",
  "bike shorts under shorts": "bottom",
  "pants under skirt": "bottom",
  "white sarong": "bottom",
  "half-skirt": "bottom",
  "blue sarong": "bottom",
  "green kimono": "era",
  "black armor": "era",
  "yellow kimono": "era",
  "black corset": "era",
  "frilled kimono": "era",
  "hagoromo": "era",
  "orange kimono": "era",
  "red armor": "era",
  "brown kimono": "era",
  "grey kimono": "era",
  "blue armor": "era",
  "checkered kimono": "era",
  "striped kimono": "era",
  "white armor": "era",
  "gold armor": "era",
  "fur-trimmed kimono": "era",
  "sideless kimono": "era",
  "leg armor": "era",
  "brown corset": "era",
  "arm armor": "era",
  "multicolored kimono": "era",
  "green hakama": "era",
  "hanten (clothes)": "era",
  "body armor": "era",
  "pink hakama": "era",
  "purple hakama": "era",
  "vertical-striped kimono": "era",
  "clothes writing": "fabric",
  "drawstring": "fabric",
  "center frills": "fabric",
  "center opening": "fabric",
  "bikini under clothes": "fabric",
  "lowleg": "fabric",
  "star print": "fabric",
  "paw print": "fabric",
  "hip vent": "fabric",
  "clothes around waist": "fabric",
  "v-neck": "fabric",
  "see-through sleeves": "fabric",
  "coat on shoulders": "fabric",
  "heart cutout": "fabric",
  "unworn skirt": "fabric",
  "low neckline": "fabric",
  "heart print": "fabric",
  "leotard under clothes": "fabric",
  "jacket partially removed": "fabric",
  "asymmetrical sleeves": "fabric",
  "unworn clothes": "fabric",
  "unworn jacket": "fabric",
  "see-through cleavage": "fabric",
  "covered collarbone": "fabric",
  "coattails": "fabric",
  "notched lapels": "fabric",
  "rose print": "fabric",
  "cat cutout": "fabric",
  "underboob cutout": "fabric",
  "see-through silhouette": "fabric",
  "american flag print": "fabric",
  "sideless outfit": "fabric",
  "jacket around waist": "fabric",
  "fruit print": "fabric",
  "unworn shirt": "fabric",
  "dragon print": "fabric",
  "wet swimsuit": "onepiece",
  "spider web print": "fabric",
  "borrowed clothes": "fabric",
  "undersized clothes": "fabric",
  "rabbit print": "fabric",
  "bodysuit under clothes": "fabric",
  "character print": "fabric",
  "snowflake print": "fabric",
  "enpera": "fabric",
  "shared clothes": "fabric",
  "stomach cutout": "fabric",
  "skull print": "fabric",
  "cat print": "fabric",
  "uneven sleeves": "fabric",
  "butterfly print": "fabric",
  "dirty clothes": "fabric",
  "spandex": "fabric",
  "diamond cutout": "fabric",
  "ofuda on clothes": "fabric",
  "feather-trimmed sleeves": "fabric",
  "constellation print": "fabric",
  "single vertical stripe": "fabric",
  "sweater around waist": "fabric",
  "loose clothes": "fabric",
  "fine fabric emphasis": "fabric",
  "front slit": "fabric",
  "strawberry print": "fabric",
  "thigh cutout": "fabric",
  "clover print": "fabric",
  "flame print": "fabric",
  "yellow trim": "fabric",
  "lace-trimmed sleeves": "fabric",
  "unworn bikini top": "fabric",
  "cutout above navel": "fabric",
  "snap-fit buckle": "acc",
  "single off shoulder": "top",
  "ribbed sleeves": "fabric",
  "yellow sleeves": "fabric",
  "shorts under dress": "onepiece",
  "ass cutout": "fabric",
  "full-length zipper": "fabric",
  "pants rolled up": "fabric",
  "mismatched sleeves": "fabric",
  "sweaty clothes": "fabric",
  "single horizontal stripe": "fabric",
  "food-themed clothes": "fabric",
  "pinching sleeves": "fabric",
  "triangle print": "fabric",
  "single stripe": "fabric",
  "fish print": "fabric",
  "pants tucked in": "fabric",
  "red trim": "fabric",
  "brown sleeves": "fabric",
  "burnt clothes": "fabric",
  "unworn coat": "fabric",
  "clothes between thighs": "fabric",
  "armpit cutout": "fabric",
  "expressive clothes": "fabric",
  "anchor print": "fabric",
  "frog print": "fabric",
  "cross-laced sleeves": "fabric",
  "unworn dress": "fabric",
  "sparkle print": "fabric",
  "silver trim": "fabric",
  "baggy clothes": "fabric",
  "white trim": "fabric",
  "cardigan around waist": "fabric",
  "orange sleeves": "fabric",
  "unworn swimsuit": "fabric",
  "double vertical stripe": "fabric",
  "unzipping": "fabric",
  "crotch cutout": "fabric",
  "skirt cutout": "fabric",
  "cross-laced slit": "fabric",
  "wet dress": "onepiece",
  "torn bodystocking": "onepiece",
  "jacket over swimsuit": "onepiece",
  "houndstooth": "fabric",
  "print sleeves": "fabric",
  "puff and slash sleeves": "fabric",
  "skirt under dress": "onepiece",
  "see-through body": "fabric",
  "patchwork clothes": "fabric",
  "embroidery": "fabric",
  "object in pocket": "fabric",
  "wringing clothes": "fabric",
  "double horizontal stripe": "fabric",
  "shorts around one leg": "fabric",
  "sayagata": "fabric",
  "square neckline": "fabric",
  "exposed pocket": "fabric",
  "unworn shoes": "fabric",
  "uwabaki": "feet",
  "tengu-geta": "feet",
  "grey boots": "feet",
  "purple boots": "feet",
  "rudder footwear": "feet",
  "green boots": "feet",
  "yellow boots": "feet",
  "multicolored shoes": "feet",
  "unworn boots": "fabric",
  "unworn sandals": "fabric",
  "fold-over boots": "feet",
  "orange boots": "feet",
  "leather boots": "feet",
  "multicolored boots": "feet",
  "gladiator sandals": "feet",
  "combat boots": "feet",
  "two-tone shoes": "feet",
  "belt boots": "feet",
  "cowboy boots": "feet",
  "single boot": "feet",
  "cross-laced shoes": "feet",
  "ice skates": "feet",
  "animal slippers": "feet",
  "crocs": "feet",
  "barefoot sandals (jewelry)": "feet",
  "blue sandals": "feet",
  "high tops": "feet",
  "dress shoes": "feet",
  "wedge heels": "feet",
  "two-tone boots": "feet",
  "fur boots": "feet",
  "open-toe shoes": "feet",
  "pink slippers": "feet",
  "winged shoes": "feet",
  "aqua shoes": "feet",
  "frilled thigh strap": "legs",
  "thighlet": "legs",
  "grey thighhighs": "legs",
  "vertical-striped thighhighs": "legs",
  "grey pantyhose": "legs",
  "blue socks": "legs",
  "single sock": "legs",
  "striped socks": "legs",
  "thigh holster": "legs",
  "print pantyhose": "legs",
  "single leg pantyhose": "legs",
  "no socks": "legs",
  "cow print thighhighs": "legs",
  "grey socks": "legs",
  "red socks": "legs",
  "ribbon-trimmed thighhighs": "legs",
  "black leggings": "legs",
  "single kneehigh": "legs",
  "american flag legwear": "legs",
  "frilled socks": "legs",
  "pink socks": "legs",
  "alternate legwear": "legs",
  "thigh pouch": "acc",
  "brown socks": "legs",
  "see-through legwear": "legs",
  "green socks": "legs",
  "fur-trimmed legwear": "legs",
  "multicolored thighhighs": "legs",
  "vertical-striped pantyhose": "legs",
  "argyle thighhighs": "legs",
  "ribbed socks": "legs",
  "unworn socks": "fabric",
  "purple socks": "legs",
  "orange pantyhose": "legs",
  "yellow socks": "legs",
  "green pantyhose": "legs",
  "white leggings": "legs",
  "gradient legwear": "legs",
  "animal ear legwear": "legs",
  "two-tone legwear": "legs",
  "shiny legwear": "legs",
  "thighhighs over pantyhose": "legs",
  "high-waist pantyhose": "legs",
  "single thigh boot": "legs",
  "leg wrap": "legs",
  "orange socks": "legs",
  "cat ear legwear": "legs",
  "yellow pantyhose": "legs",
  "white leg warmers": "legs",
  "bridal legwear": "legs",
  "fur-trimmed thighhighs": "legs",
  "fishnet socks": "legs",
  "vertical-striped socks": "legs",
  "detached leggings": "legs",
  "cross-laced legwear": "legs",
  "white apron": "onepiece",
  "skirt set": "onepiece",
  "winter uniform": "onepiece",
  "summer uniform": "onepiece",
  "black serafuku": "onepiece",
  "impossible clothes": "fabric",
  "print bikini": "onepiece",
  "tracen school uniform": "onepiece",
  "yellow bikini": "onepiece",
  "highleg bikini": "onepiece",
  "green bikini": "onepiece",
  "kita high school uniform": "onepiece",
  "mitakihara school uniform": "onepiece",
  "white bodysuit": "onepiece",
  "sakuragaoka high school uniform": "onepiece",
  "ooarai school uniform": "onepiece",
  "multicolored dress": "onepiece",
  "black suit": "onepiece",
  "male swimwear": "onepiece",
  "bikini bottom only": "bottom",
  "multi-strapped bikini bottom": "onepiece",
  "sailor senshi uniform": "onepiece",
  "competition school swimsuit": "onepiece",
  "tokiwadai school uniform": "onepiece",
  "otonokizaka school uniform": "onepiece",
  "cow print bikini": "onepiece",
  "old school swimsuit": "onepiece",
  "thong bikini": "onepiece",
  "purple leotard": "onepiece",
  "vertical-striped dress": "onepiece",
  "white robe": "outer",
  "multicolored bikini": "onepiece",
  "torn dress": "onepiece",
  "orange bikini": "onepiece",
  "garreg mach monastery uniform": "onepiece",
  "lowleg bikini": "onepiece",
  "strapless bikini": "onepiece",
  "tracen training uniform": "onepiece",
  "polka dot bikini": "onepiece",
  "pink leotard": "onepiece",
  "black robe": "outer",
  "demon slayer uniform": "onepiece",
  "blue serafuku": "onepiece",
  "multicolored bodysuit": "onepiece",
  "ryouou school uniform": "onepiece",
  "frilled one-piece swimsuit": "onepiece",
  "maid bikini": "onepiece",
  "green leotard": "onepiece",
  "see-through dress": "onepiece",
  "eyepatch bikini": "onepiece",
  "purple bodysuit": "onepiece",
  "blue overalls": "onepiece",
  "swim trunks": "bottom",
  "pink apron": "onepiece",
  "two-tone swimsuit": "onepiece",
  "open dress": "onepiece",
  "layered bikini": "onepiece",
  "tokyo-3 middle school uniform": "onepiece",
  "uranohoshi school uniform": "onepiece",
  "gekkoukan high school uniform": "onepiece",
  "sleepwear": "onepiece",
  "paradis military uniform": "onepiece",
  "nanamori school uniform": "onepiece",
  "american flag dress": "onepiece",
  "black apron": "onepiece",
  "ribbed dress": "onepiece",
  "pirate costume": "onepiece",
  "two-tone bikini": "onepiece",
  "multicolored swimsuit": "onepiece",
  "orange bodysuit": "onepiece",
  "sailor bikini": "onepiece",
  "blue apron": "onepiece",
  "asticassia school uniform": "onepiece",
  "mismatched bikini": "onepiece",
  "american flag bikini": "onepiece",
  "meiji schoolgirl uniform": "onepiece",
  "bow bikini": "onepiece",
  "pink bodysuit": "onepiece",
  "shimakaze (kancolle) (cosplay)": "onepiece",
  "white suit": "onepiece",
  "kuromorimine military uniform": "onepiece",
  "kitauji high school uniform": "onepiece",
  "gem uniform (houseki no kuni)": "onepiece",
  "gold bikini": "onepiece",
  "impossible bodysuit": "onepiece",
  "ruffle bikini": "onepiece",
  "hasu no sora school uniform": "onepiece",
  "zero suit": "onepiece",
  "backless leotard": "onepiece",
  "white romper": "onepiece",
  "aqua bikini": "onepiece",
  "nijigasaki school uniform": "onepiece",
  "santa bikini": "onepiece",
  "naoetsu high school uniform": "onepiece",
  "plaid bikini": "onepiece",
  "purple serafuku": "onepiece",
  "see-through leotard": "onepiece",
  "st. gloriana's school uniform": "onepiece",
  "millennium cheerleader outfit (blue archive)": "onepiece",
  "little busters! school uniform": "onepiece",
  "impossible leotard": "onepiece",
  "turtleneck leotard": "onepiece",
  "lycoris uniform": "onepiece",
  "impossible dress": "onepiece",
  "bondage outfit": "onepiece",
  "ooarai military uniform": "onepiece",
  "shuuchiin academy school uniform": "onepiece",
  "champion's tunic (zelda)": "onepiece",
  "green apron": "onepiece",
  "hikarizaka private high school uniform": "onepiece",
  "side-tie leotard": "onepiece",
  "pink pajamas": "onepiece",
  "tactical clothes": "onepiece",
  "impossible swimsuit": "onepiece",
  "multicolored leotard": "onepiece",
  "st. gloriana's military uniform": "onepiece",
  "anzio school uniform": "onepiece",
  "tankini": "onepiece",
  "hooded robe": "outer",
  "yasogami school uniform": "onepiece",
  "male playboy bunny": "onepiece",
  "kibito high school uniform": "onepiece",
  "two-tone bodysuit": "onepiece",
  "green bodysuit": "onepiece",
  "gradient dress": "onepiece",
  "vocaloid append": "onepiece",
  "rabbit house uniform": "onepiece",
  "blue robe": "outer",
  "reindeer costume": "onepiece",
  "diving suit": "onepiece",
  "embellished costume": "onepiece",
  "grey bodysuit": "onepiece",
  "red apron": "onepiece",
  "yellow apron": "onepiece",
  "off-shoulder bikini": "onepiece",
  "brown apron": "onepiece",
  "pink one-piece swimsuit": "onepiece",
  "team rocket uniform": "onepiece",
  "kuromorimine school uniform": "onepiece",
  "grey bikini": "onepiece",
  "kigurumi": "onepiece",
  "u.a. school uniform": "onepiece",
  "jujutsu tech uniform": "onepiece",
  "hatsune miku (cosplay)": "onepiece",
  "white serafuku": "onepiece",
  "frilled leotard": "onepiece",
  "yurigaoka girls academy school uniform": "onepiece",
  "hakurei reimu (cosplay)": "onepiece",
  "haneoka school uniform": "onepiece",
  "sakugawa school uniform": "onepiece",
  "brown bikini": "onepiece",
  "oohashi high school uniform": "onepiece",
  "two-tone leotard": "onepiece",
  "cross-laced dress": "onepiece",
  "icho private high school uniform": "onepiece",
  "ribbon-trimmed dress": "onepiece",
  "a certain high school uniform": "onepiece",
  "yellow bodysuit": "onepiece",
  "purple one-piece swimsuit": "onepiece",
  "ribbed bodysuit": "onepiece",
  "sleeved leotard": "onepiece",
  "athletic leotard": "onepiece",
  "hanasakigawa school uniform": "onepiece",
  "sobu high school uniform": "onepiece",
  "power suit (metroid)": "onepiece",
  "eden academy school uniform": "onepiece",
  "torn leotard": "onepiece",
  "naranja academy school uniform": "onepiece",
  "ribbed leotard": "onepiece",
  "new school swimsuit": "onepiece",
  "yellow leotard": "onepiece",
  "shark costume": "onepiece",
  "fourth east high school uniform": "onepiece",
  "shinda sekai sensen uniform": "onepiece",
  "vampire costume": "onepiece",
  "yuigaoka school uniform": "onepiece",
  "kiyosumi school uniform": "onepiece",
  "mummy costume": "onepiece",
  "kirin (armor)": "onepiece",
  "polka dot swimsuit": "onepiece",
  "bikesuit": "onepiece",
  "prison clothes": "onepiece",
  "shell bikini": "onepiece",
  "kourindou tengu costume": "onepiece",
  "loungewear": "onepiece",
  "ghost costume": "onepiece",
  "tracen swimsuit": "onepiece",
  "brown leotard": "onepiece",
  "shuka high school uniform": "onepiece",
  "tutu": "onepiece",
  "shuujin academy school uniform": "onepiece",
  "wagnaria uniform": "onepiece",
  "nanairogaoka middle school uniform": "onepiece",
  "power suit": "onepiece",
  "uva academy school uniform": "onepiece",
  "aria company uniform": "onepiece",
  "tight dress": "onepiece",
  "kamiyama high school uniform (hyouka)": "onepiece",
  "two-sided dress": "onepiece",
  "vertical-striped bikini": "onepiece",
  "hooded bodysuit": "onepiece",
  "griffin & kryuger military uniform": "onepiece",
  "pravda school uniform": "onepiece",
  "saiyan armor": "era",
  "swimsuit cover-up": "onepiece",
  "keizoku military uniform": "onepiece",
  "duel academy uniform (yu-gi-oh! gx)": "onepiece",
  "alice (alice in wonderland) (cosplay)": "onepiece",
  "torn swimsuit": "onepiece",
  "sukajan": "outer",
  "mash kyrielight (dangerous beast) (cosplay)": "onepiece",
  "blue pajamas": "onepiece",
  "saunders military uniform": "onepiece",
  "grey leotard": "onepiece",
  "taimanin suit": "onepiece",
  "grey serafuku": "onepiece",
  "kamiyama high school uniform (project sekai)": "onepiece",
  "coat dress": "onepiece",
  "bc freedom military uniform": "onepiece",
  "bear costume": "onepiece",
  "ashford academy school uniform": "onepiece",
  "hooded dress": "onepiece",
  "luna nova school uniform": "onepiece",
  "grey suit": "onepiece",
  "miyamasuzaka girls' academy school uniform": "onepiece",
  "fleur de lapin uniform": "onepiece",
  "print leotard": "onepiece",
  "strapless one-piece swimsuit": "onepiece",
  "youtou high school uniform": "onepiece",
  "virgin destroyer sweater": "top",
  "off-shoulder one-piece swimsuit": "onepiece",
  "hogwarts school uniform": "onepiece",
  "self-cosplay": "onepiece",
  "red robe": "outer",
  "wa lolita": "fabric",
  "undersuit": "onepiece",
  "amesuku gyaru": "fabric",
  "checkered dress": "onepiece",
  "tokisadame school uniform": "onepiece",
  "anzio military uniform": "onepiece",
  "cat costume": "onepiece",
  "sophist's robe (ff14)": "onepiece",
  "varia suit": "onepiece",
  "orange leotard": "onepiece",
  "pinstripe suit": "onepiece",
  "virgin killer outfit": "onepiece",
  "orange jumpsuit": "onepiece",
  "black slingshot swimsuit": "onepiece",
  "black cape": "era",
  "white capelet": "era",
  "white cape": "era",
  "blue cape": "era",
  "multicolored jacket": "outer",
  "collared jacket": "outer",
  "black capelet": "era",
  "red capelet": "era",
  "waist cape": "era",
  "two-tone jacket": "outer",
  "black cloak": "era",
  "blue capelet": "era",
  "striped jacket": "outer",
  "hooded capelet": "era",
  "green cape": "era",
  "yellow cardigan": "outer",
  "white cloak": "era",
  "purple cape": "era",
  "two-sided cape": "era",
  "red cloak": "era",
  "torn cape": "era",
  "two-sided jacket": "outer",
  "brown capelet": "era",
  "red hoodie": "top",
  "hooded cape": "era",
  "green hoodie": "top",
  "frilled capelet": "era",
  "brown cape": "era",
  "yellow hoodie": "top",
  "collared cape": "era",
  "plaid jacket": "outer",
  "fur-trimmed cloak": "era",
  "cropped hoodie": "top",
  "blue cloak": "era",
  "purple capelet": "era",
  "brown cloak": "era",
  "multicolored coat": "outer",
  "stole": "outer",
  "purple hoodie": "top",
  "print jacket": "outer",
  "green capelet": "era",
  "aqua jacket": "outer",
  "brown hoodie": "top",
  "orange hoodie": "top",
  "no jacket": "outer",
  "pink capelet": "era",
  "sleeveless coat": "outer",
  "overcoat": "outer",
  "yellow cape": "era",
  "torn jacket": "outer",
  "off-shoulder jacket": "outer",
  "floating cape": "era",
  "hooded cardigan": "outer",
  "two-tone cape": "era",
  "blue tabard": "era",
  "fur cape": "era",
  "grey capelet": "era",
  "pink cape": "era",
  "tied jacket": "outer",
  "vertical-striped jacket": "outer",
  "two-tone hoodie": "top",
  "grey cape": "era",
  "see-through jacket": "outer",
  "striped hoodie": "top",
  "two-sided coat": "outer",
  "green cloak": "era",
  "purple cardigan": "outer",
  "multicolored cape": "era",
  "hooded track jacket": "outer",
  "yellow raincoat": "outer",
  "print hoodie": "top",
  "fur cloak": "era",
  "two-tone coat": "outer",
  "blue shawl": "era",
  "frilled jacket": "outer",
  "orange cape": "era",
  "down jacket": "outer",
  "parka": "outer",
  "surcoat": "outer",
  "red cardigan": "outer",
  "front-tie top": "top",
  "front-tie bikini top": "top",
  "criss-cross halter": "top",
  "red vest": "top",
  "bandeau": "top",
  "blue vest": "top",
  "o-ring top": "top",
  "green vest": "top",
  "plaid vest": "top",
  "brown vest": "top",
  "open vest": "top",
  "chest sarashi": "top",
  "yellow sweater": "top",
  "grey vest": "top",
  "white vest": "top",
  "purple vest": "top",
  "brown sweater vest": "top",
  "purple sweater": "top",
  "yellow vest": "top",
  "bulletproof vest": "top",
  "open-chest sweater": "top",
  "fishnet top": "top",
  "pink vest": "top",
  "cropped vest": "top",
  "striped sweater": "top",
  "multicolored shirt": "top",
  "budget sarashi": "top",
  "hooded sweater": "top",
  "bodice": "top",
  "yellow sweater vest": "top",
  "cropped sweater": "top",
  "black sweater vest": "top",
  "multi-strapped bikini top": "top",
  "load-bearing vest": "top",
  "collared vest": "top",
  "orange vest": "top",
  "orange sweater": "top",
  "short-sleeved sweater": "top",
  "blue tunic": "era",
  "blue tank top": "top",
  "loose shirt": "top",
  "grey tank top": "top",
  "frilled camisole": "top",
  "green tunic": "era",
  "yellow tank top": "top",
  "racerback": "top",
  "green tank top": "top",
  "polka dot shirt": "top",
  "black tube top": "top",
  "checkered shirt": "top",
  "cross-laced top": "top",
  "black bandeau": "top",
  "blue camisole": "top",
  "argyle sweater": "top",
  "white tube top": "top",
  "sling bikini top": "top",
  "crotch seam": "underwear",
  "lowleg panties": "underwear",
  "wet panties": "underwear",
  "cat lingerie": "onepiece",
  "breastless clothes": "underwear",
  "trefoil": "underwear",
  "white sports bra": "underwear",
  "untied panties": "underwear",
  "open bra": "underwear",
  "yellow bra": "underwear",
  "belt bra": "underwear",
  "grey sports bra": "underwear",
  "stained panties": "underwear",
  "two-tone sports bra": "underwear",
  "brown panties": "underwear",
  "torn panties": "underwear",
  "plaid panties": "underwear",
  "star pasties": "acc",
  "jockstrap": "underwear",
  "back-print panties": "underwear",
  "string bra": "underwear",
  "panties under buruma": "bottom",
  "multi-strapped panties": "underwear",
  "brown bra": "underwear",
  "strawberry print panties": "underwear",
  "aqua bra": "underwear",
  "oversized breast cup": "underwear",
  "red sports bra": "underwear",
  "satin panties": "underwear",
  "plaid bra": "underwear",
  "underwear": "underwear"
}

SUB_OF = {
  "headgear": "acc_head",
  "blue ribbon": "acc_bow",
  "white ribbon": "acc_bow",
  "yellow bow": "acc_bow",
  "green bow": "acc_bow",
  "pink ribbon": "acc_bow",
  "purple bow": "acc_bow",
  "swim ring": "acc_carry",
  "yellow ribbon": "acc_bow",
  "school bag": "acc_carry",
  "striped bow": "acc_bow",
  "mouth mask": "acc_face",
  "animal hood": "acc_head",
  "heart hair ornament": "acc_head",
  "tress ribbon": "acc_bow",
  "green ribbon": "acc_bow",
  "fake horns": "acc_carry",
  "purple ribbon": "acc_bow",
  "butterfly hair ornament": "acc_head",
  "spaghetti strap": "acc_hand",
  "back bow": "acc_bow",
  "orange bow": "acc_bow",
  "animal ear hairband": "acc_head",
  "tail ornament": "acc_carry",
  "emblem": "acc_carry",
  "newsboy cap": "acc_head",
  "food-themed hair ornament": "acc_head",
  "frog hair ornament": "acc_head",
  "triangular headpiece": "acc_head",
  "pink hat": "acc_head",
  "rabbit ear hairband": "acc_head",
  "horn ornament": "acc_carry",
  "holster": "acc_hand",
  "red halo": "acc_head",
  "bridal veil": "acc_head",
  "mechanical halo": "acc_head",
  "forehead jewel": "acc_jewel",
  "arm strap": "acc_hand",
  "ear ornament": "acc_carry",
  "purple hat": "acc_head",
  "snake hair ornament": "acc_head",
  "blue gem": "acc_jewel",
  "animal hat": "acc_head",
  "unworn eyewear": "acc_face",
  "frilled bow": "acc_bow",
  "striped necktie": "acc_neck",
  "nun headdress": "acc_head",
  "sack": "acc_carry",
  "harness": "acc_hand",
  "white belt": "acc_hand",
  "lolita hairband": "acc_head",
  "hat feather": "acc_head",
  "asymmetrical gloves": "acc_hand",
  "tilted headwear": "acc_head",
  "headscarf": "acc_head",
  "leg ribbon": "acc_bow",
  "crescent hair ornament": "acc_head",
  "rabbit hair ornament": "acc_head",
  "white collar": "acc_neck",
  "animal ear piercing": "acc_jewel",
  "yellow halo": "acc_head",
  "strap": "acc_hand",
  "spiked collar": "acc_neck",
  "bow hairband": "acc_head",
  "leaf hair ornament": "acc_head",
  "belt pouch": "acc_carry",
  "crescent hat ornament": "acc_head",
  "neck ring": "acc_neck",
  "spiked bracelet": "acc_jewel",
  "charm (object)": "acc_carry",
  "frilled hairband": "acc_head",
  "purple bowtie": "acc_neck",
  "bead bracelet": "acc_jewel",
  "blue choker": "acc_neck",
  "cross hair ornament": "acc_head",
  "badge": "acc_carry",
  "ears through headwear": "acc_head",
  "aqua necktie": "acc_neck",
  "polka dot bow": "acc_bow",
  "yellow bowtie": "acc_neck",
  "arm guards": "acc_hand",
  "grey gloves": "acc_hand",
  "yellow hairband": "acc_head",
  "floating earrings": "acc_jewel",
  "striped bowtie": "acc_neck",
  "star hat ornament": "acc_head",
  "chest jewel": "acc_jewel",
  "ear bow": "acc_bow",
  "shoulder pads": "acc_hand",
  "traditional bowtie": "acc_neck",
  "mini top hat": "acc_head",
  "arm ribbon": "acc_bow",
  "cube hair ornament": "acc_head",
  "arm garter": "acc_hand",
  "white neckerchief": "acc_neck",
  "grey hat": "acc_head",
  "pink hairband": "acc_head",
  "green gloves": "acc_hand",
  "heart brooch": "acc_jewel",
  "print gloves": "acc_hand",
  "belt collar": "acc_neck",
  "multiple rings": "acc_jewel",
  "chest harness": "acc_hand",
  "aqua bow": "acc_bow",
  "white necktie": "acc_neck",
  "eye mask": "acc_face",
  "plaid bow": "acc_bow",
  "pink choker": "acc_neck",
  "whistle": "acc_carry",
  "green bowtie": "acc_neck",
  "multicolored gloves": "acc_hand",
  "anchor hair ornament": "acc_head",
  "short necktie": "acc_neck",
  "purple necktie": "acc_neck",
  "cross earrings": "acc_jewel",
  "forehead protector": "acc_head",
  "animal ear headphones": "acc_face",
  "multiple hair bows": "acc_bow",
  "tail bow": "acc_bow",
  "yellow gloves": "acc_hand",
  "barbell piercing": "acc_jewel",
  "skull hair ornament": "acc_head",
  "plaid scarf": "acc_neck",
  "red gem": "acc_jewel",
  "dog tags": "acc_neck",
  "horn ribbon": "acc_bow",
  "brown bow": "acc_bow",
  "flower knot": "acc_carry",
  "pink necktie": "acc_neck",
  "mismatched gloves": "acc_hand",
  "frilled hair tubes": "acc_head",
  "aiguillette": "acc_neck",
  "white wrist cuffs": "acc_jewel",
  "traditional halo": "acc_head",
  "waist bow": "acc_bow",
  "dress bow": "acc_bow",
  "frilled hat": "acc_head",
  "large bow": "acc_bow",
  "studs": "acc_carry",
  "black ascot": "acc_neck",
  "fur hat": "acc_head",
  "arm belt": "acc_hand",
  "fur-trimmed headwear": "acc_head",
  "yellow hat": "acc_head",
  "striped scarf": "acc_neck",
  "striped ribbon": "acc_bow",
  "tail ribbon": "acc_bow",
  "pink neckerchief": "acc_neck",
  "footwear bow": "acc_bow",
  "brown bag": "acc_carry",
  "cat hair ornament": "acc_head",
  "black bag": "acc_carry",
  "earclip": "acc_jewel",
  "blue ascot": "acc_neck",
  "closed umbrella": "acc_carry",
  "ring piercing": "acc_jewel",
  "single elbow glove": "acc_hand",
  "quiver": "acc_carry",
  "loose necktie": "acc_neck",
  "frilled gloves": "acc_hand",
  "green sailor collar": "fab_sleeve",
  "metal collar": "acc_neck",
  "towel around neck": "acc_neck",
  "purple hairband": "acc_head",
  "unworn mask": "acc_face",
  "multiple belts": "acc_hand",
  "green gem": "acc_jewel",
  "blue belt": "acc_hand",
  "grey sailor collar": "fab_sleeve",
  "red sailor collar": "fab_sleeve",
  "red rope": "acc_bind",
  "two-tone gloves": "acc_hand",
  "super crown": "acc_head",
  "red headband": "acc_head",
  "red belt": "acc_hand",
  "heart choker": "acc_neck",
  "surgical mask": "acc_face",
  "musical note hair ornament": "acc_head",
  "orange bowtie": "acc_neck",
  "heart necklace": "acc_jewel",
  "wrist ribbon": "acc_bow",
  "pink scarf": "acc_neck",
  "brown scarf": "acc_neck",
  "anal tail": "acc_toy",
  "pirate hat": "acc_head",
  "cat ear headphones": "acc_face",
  "green halo": "acc_head",
  "red sash": "acc_hand",
  "rectangular eyewear": "acc_face",
  "carrot hair ornament": "acc_head",
  "backwards hat": "acc_head",
  "black mask": "acc_face",
  "orange ribbon": "acc_bow",
  "earpiece": "acc_face",
  "heart-shaped eyewear": "acc_face",
  "tassel hair ornament": "acc_head",
  "pince-nez": "acc_face",
  "crescent pin": "acc_carry",
  "orange necktie": "acc_neck",
  "shark hair ornament": "acc_head",
  "yellow scarf": "acc_neck",
  "unworn helmet": "acc_head",
  "wing hair ornament": "acc_head",
  "diagonal-striped bow": "acc_bow",
  "red armband": "acc_hand",
  "rectangular halo": "acc_head",
  "opaque glasses": "acc_face",
  "orange hat": "acc_head",
  "wiffle gag": "acc_bind",
  "purple choker": "acc_neck",
  "cat hood": "acc_head",
  "multiple earrings": "acc_jewel",
  "paper bag": "acc_carry",
  "green scarf": "acc_neck",
  "black veil": "acc_head",
  "bone hair ornament": "acc_head",
  "cow print gloves": "acc_hand",
  "aqua bowtie": "acc_neck",
  "gold earrings": "acc_jewel",
  "orange hairband": "acc_head",
  "o-ring choker": "acc_neck",
  "wizard hat": "acc_head",
  "wing ornament": "acc_carry",
  "ear ribbon": "acc_bow",
  "goggles on headwear": "acc_face",
  "tie clip": "acc_neck",
  "diagonal-striped necktie": "acc_neck",
  "feather boa": "acc_neck",
  "bat hair ornament": "acc_head",
  "whistle around neck": "acc_neck",
  "green hairband": "acc_head",
  "white headband": "acc_head",
  "black headband": "acc_head",
  "flower earrings": "acc_jewel",
  "thigh belt": "acc_hand",
  "button badge": "acc_carry",
  "goggles around neck": "acc_face",
  "bag charm": "acc_carry",
  "o-ring bottom": "bot_pants",
  "two-tone bow": "acc_bow",
  "purple halo": "acc_head",
  "white scrunchie": "acc_hand",
  "fur-trimmed hood": "acc_head",
  "checkered scarf": "acc_neck",
  "horseshoe ornament": "acc_carry",
  "white veil": "acc_head",
  "domino mask": "acc_face",
  "pom pom hair ornament": "acc_head",
  "single ear cover": "acc_face",
  "horned headwear": "acc_head",
  "orange gloves": "acc_hand",
  "blue-framed eyewear": "acc_face",
  "nightcap": "acc_head",
  "sphere earrings": "acc_jewel",
  "rabbit hood": "acc_head",
  "crescent earrings": "acc_jewel",
  "gas mask": "acc_face",
  "strap between breasts": "acc_hand",
  "black sash": "acc_hand",
  "medal": "acc_neck",
  "loose belt": "acc_hand",
  "horn bow": "acc_bow",
  "chest belt": "acc_hand",
  "print bowtie": "acc_neck",
  "plaid bowtie": "acc_neck",
  "plastic bag": "acc_carry",
  "qingdai guanmao": "acc_head",
  "pink scrunchie": "acc_hand",
  "horned helmet": "acc_head",
  "shoulder spikes": "acc_jewel",
  "shoulder boards": "acc_carry",
  "frilled ribbon": "acc_bow",
  "purple scarf": "acc_neck",
  "over-rim eyewear": "acc_face",
  "brown ribbon": "acc_bow",
  "ankle ribbon": "acc_bow",
  "purple umbrella": "acc_carry",
  "single pauldron": "acc_hand",
  "yellow scrunchie": "acc_hand",
  "red umbrella": "acc_carry",
  "single hair ring": "acc_head",
  "clover hair ornament": "acc_head",
  "porkpie hat": "acc_head",
  "neck ruff": "acc_neck",
  "black halo": "acc_head",
  "snowflake hair ornament": "acc_head",
  "large hat": "acc_head",
  "grey halo": "acc_head",
  "thumb ring": "acc_jewel",
  "gold bracelet": "acc_jewel",
  "plaid necktie": "acc_neck",
  "pendant choker": "acc_neck",
  "talisman": "acc_carry",
  "duffel bag": "acc_carry",
  "ear tag": "acc_carry",
  "feather earrings": "acc_jewel",
  "orange-tinted eyewear": "acc_face",
  "ankle lace-up": "feet",
  "grey bow": "acc_bow",
  "red bag": "acc_carry",
  "pink-framed eyewear": "acc_face",
  "fur scarf": "acc_neck",
  "grey neckerchief": "acc_neck",
  "uneven gloves": "acc_hand",
  "safety pin": "acc_carry",
  "brown sailor collar": "fab_sleeve",
  "diamond hairband": "acc_head",
  "aqua ribbon": "acc_bow",
  "shako cap": "acc_head",
  "grey-framed eyewear": "acc_face",
  "pink bag": "acc_carry",
  "green neckerchief": "acc_neck",
  "torpedo tubes": "acc_carry",
  "star halo": "acc_head",
  "blue sash": "acc_hand",
  "no eyewear": "acc_face",
  "o-ring thigh strap": "acc_hand",
  "white sash": "acc_hand",
  "red bandana": "acc_neck",
  "character hair ornament": "acc_head",
  "green choker": "acc_neck",
  "nose piercing": "acc_jewel",
  "insignia": "acc_carry",
  "animal ear headwear": "acc_head",
  "yellow belt": "acc_hand",
  "cat hat": "acc_head",
  "gold necklace": "acc_jewel",
  "pith helmet": "acc_head",
  "winged hat": "acc_head",
  "fanny pack": "acc_carry",
  "yellow-framed eyewear": "acc_face",
  "patch": "acc_carry",
  "cloth gag": "acc_bind",
  "white-framed eyewear": "acc_face",
  "transparent umbrella": "acc_carry",
  "purple sailor collar": "fab_sleeve",
  "orange scrunchie": "acc_hand",
  "ankle cuffs": "acc_bind",
  "purple gem": "acc_jewel",
  "heart o-ring": "acc_hand",
  "magatama necklace": "acc_jewel",
  "blue bag": "acc_carry",
  "carrot necklace": "acc_jewel",
  "star choker": "acc_neck",
  "studded belt": "acc_hand",
  "red-tinted eyewear": "acc_face",
  "chest strap": "acc_hand",
  "grey necktie": "acc_neck",
  "orange choker": "acc_neck",
  "white bag": "acc_carry",
  "d-pad hair ornament": "acc_head",
  "oni mask": "acc_face",
  "gorget": "acc_carry",
  "thigh ribbon": "acc_bow",
  "alternate headwear": "acc_head",
  "sleeve garter": "acc_hand",
  "black garter straps": "legs",
  "plaid hat": "acc_head",
  "satchel": "acc_carry",
  "multicolored hairband": "acc_head",
  "school emblem": "acc_carry",
  "helm": "acc_carry",
  "tam o' shanter": "acc_carry",
  "diving mask": "acc_face",
  "pearl": "acc_carry",
  "orange neckerchief": "acc_neck",
  "brown necktie": "acc_neck",
  "shark hood": "acc_head",
  "yellow choker": "acc_neck",
  "dynamax band": "acc_carry",
  "tail bell": "acc_carry",
  "single fingerless glove": "acc_hand",
  "sweatband": "acc_carry",
  "see-through veil": "acc_head",
  "fish hair ornament": "acc_head",
  "orange scarf": "acc_neck",
  "purple belt": "acc_hand",
  "lip piercing": "acc_jewel",
  "bear hair ornament": "acc_head",
  "dalachi (headdress)": "acc_head",
  "condom packet strip": "acc_toy",
  "winged helmet": "acc_head",
  "brown hairband": "acc_head",
  "party hat": "acc_head",
  "black garter belt": "legs",
  "mouth veil": "acc_head",
  "utility belt": "acc_hand",
  "leg belt": "acc_hand",
  "grey scarf": "acc_neck",
  "eyebrow piercing": "acc_jewel",
  "two-tone ribbon": "acc_bow",
  "gold hairband": "acc_head",
  "spiked armlet": "acc_jewel",
  "space helmet": "acc_head",
  "hair through headwear": "acc_head",
  "star necklace": "acc_jewel",
  "fake wings": "acc_carry",
  "heart button": "acc_carry",
  "blue headband": "acc_head",
  "striped gloves": "acc_hand",
  "multicolored bow": "acc_bow",
  "pink belt": "acc_hand",
  "two-tone bowtie": "acc_neck",
  "single gauntlet": "acc_hand",
  "flower ornament": "acc_carry",
  "square-end necktie": "acc_neck",
  "arm wrap": "acc_carry",
  "claw ring": "acc_jewel",
  "checkered necktie": "acc_neck",
  "leather belt": "acc_hand",
  "skull earrings": "acc_jewel",
  "tricorne": "acc_carry",
  "yellow sash": "acc_hand",
  "animal bag": "acc_carry",
  "blue collar": "acc_neck",
  "multiple piercings": "acc_jewel",
  "shoulder strap": "acc_hand",
  "yellow bag": "acc_carry",
  "red hood": "acc_head",
  "loose bowtie": "acc_neck",
  "ribbon-trimmed collar": "acc_neck",
  "pillbox hat": "acc_head",
  "frilled cuffs": "acc_bind",
  "pink sailor collar": "fab_sleeve",
  "unworn bag": "acc_carry",
  "fake antlers": "acc_carry",
  "bowl hat": "acc_head",
  "dixie cup hat": "acc_head",
  "triangle earrings": "acc_jewel",
  "gold choker": "acc_neck",
  "bow earrings": "acc_jewel",
  "blue-tinted eyewear": "acc_face",
  "horns through headwear": "acc_head",
  "purple-tinted eyewear": "acc_face",
  "pink collar": "acc_neck",
  "aqua neckerchief": "acc_neck",
  "yellow armband": "acc_hand",
  "eyewear on headwear": "acc_face",
  "respirator": "acc_carry",
  "fur-trimmed collar": "acc_neck",
  "combat helmet": "acc_head",
  "used tissue": "acc_carry",
  "ammunition pouch": "acc_carry",
  "bow choker": "acc_neck",
  "grey belt": "acc_hand",
  "brown-framed eyewear": "acc_face",
  "striped headwear": "acc_head",
  "skull mask": "acc_face",
  "ankle strap": "acc_hand",
  "wrist guards": "acc_hand",
  "neck flower": "acc_carry",
  "green-framed eyewear": "acc_face",
  "unworn gloves": "acc_hand",
  "linked piercing": "acc_jewel",
  "undone necktie": "acc_neck",
  "brown bowtie": "acc_neck",
  "sleep mask": "acc_face",
  "gold crown": "acc_head",
  "triangle hair ornament": "acc_head",
  "industrial piercing": "acc_jewel",
  "open belt": "acc_hand",
  "pink-tinted eyewear": "acc_face",
  "sleeve bow": "acc_bow",
  "bolo tie": "acc_carry",
  "broken halo": "acc_head",
  "single strap": "acc_hand",
  "moon (ornament)": "acc_carry",
  "lube": "acc_toy",
  "fishnet gloves": "acc_hand",
  "rider belt": "acc_hand",
  "eyewear strap": "acc_face",
  "cross tie": "acc_carry",
  "tube": "acc_carry",
  "magatama earrings": "acc_jewel",
  "white headdress": "acc_head",
  "sunflower hair ornament": "acc_head",
  "candy hair ornament": "acc_head",
  "mask around neck": "acc_face",
  "grey ribbon": "acc_bow",
  "white garter straps": "legs",
  "two-tone headwear": "acc_head",
  "orange sailor collar": "fab_sleeve",
  "pearl earrings": "acc_jewel",
  "leather gloves": "acc_hand",
  "green bag": "acc_carry",
  "spiked choker": "acc_neck",
  "deerstalker": "acc_carry",
  "white mask": "acc_face",
  "bandaid hair ornament": "acc_head",
  "shin guards": "acc_carry",
  "purple neckerchief": "acc_neck",
  "earth (ornament)": "acc_carry",
  "pearl bracelet": "acc_jewel",
  "white umbrella": "acc_carry",
  "spiked halo": "acc_head",
  "tail piercing": "acc_jewel",
  "diagonal-striped bowtie": "acc_neck",
  "crime prevention buzzer": "acc_carry",
  "orange headband": "acc_head",
  "pink wrist cuffs": "acc_jewel",
  "key necklace": "acc_jewel",
  "aqua hat": "acc_head",
  "kepi": "acc_carry",
  "huge bow": "acc_bow",
  "kurokote": "acc_carry",
  "lace choker": "acc_neck",
  "no gloves": "acc_hand",
  "star brooch": "acc_jewel",
  "snorkel": "acc_carry",
  "purple sash": "acc_hand",
  "white hood": "acc_head",
  "noh mask": "acc_face",
  "food-themed earrings": "acc_jewel",
  "tulip hat": "acc_head",
  "clitoral piercing": "acc_jewel",
  "lapel pin": "acc_carry",
  "plume": "acc_carry",
  "ninja mask": "acc_face",
  "orange ascot": "acc_neck",
  "hauchiwa": "acc_carry",
  "condom belt": "acc_hand",
  "coif": "acc_carry",
  "frilled ascot": "acc_neck",
  "torn scarf": "acc_neck",
  "sleeve ribbon": "acc_bow",
  "strawberry hair ornament": "acc_head",
  "blue helmet": "acc_head",
  "trash bag": "acc_carry",
  "dice hair ornament": "acc_head",
  "purple scrunchie": "acc_hand",
  "print headwear": "acc_head",
  "two-tone hairband": "acc_head",
  "red mask": "acc_face",
  "neck tassel": "acc_bow",
  "motorcycle helmet": "acc_head",
  "arched crown": "acc_head",
  "nejiri hachimaki": "era_jp",
  "pink ascot": "acc_neck",
  "diving mask on head": "acc_face",
  "papakha": "acc_carry",
  "grey hairband": "acc_head",
  "lace-trimmed gloves": "acc_hand",
  "polka dot headwear": "acc_head",
  "scarf over mouth": "acc_neck",
  "wig": "acc_carry",
  "wrist bow": "acc_bow",
  "cat ear hairband": "acc_head",
  "black bridal gauntlets": "acc_hand",
  "torn gloves": "acc_hand",
  "ammunition belt": "acc_hand",
  "bird mask": "acc_face",
  "blue armband": "acc_hand",
  "coin on string": "acc_carry",
  "single epaulette": "acc_carry",
  "pointed crown": "acc_head",
  "green belt": "acc_hand",
  "tail ring": "acc_jewel",
  "bicorne": "acc_carry",
  "lace gloves": "acc_hand",
  "shoulder sash": "acc_hand",
  "boobplate": "acc_carry",
  "crystal earrings": "acc_jewel",
  "no mask": "acc_face",
  "heart collar": "acc_neck",
  "purple ascot": "acc_neck",
  "anchor necklace": "acc_jewel",
  "black umbrella": "acc_carry",
  "multicolored hat": "acc_head",
  "head chain": "acc_carry",
  "green armband": "acc_hand",
  "footwear ribbon": "acc_bow",
  "bandolier": "acc_carry",
  "brown choker": "acc_neck",
  "grocery bag": "acc_carry",
  "smokestack hair ornament": "acc_head",
  "egg hair ornament": "acc_head",
  "aviator sunglasses": "acc_face",
  "hexagon hair ornament": "acc_head",
  "chain headband": "acc_head",
  "usekh collar": "acc_neck",
  "flower choker": "acc_neck",
  "chinese hairpin": "acc_head",
  "single wrist cuff": "acc_hand",
  "chinstrap": "acc_carry",
  "anchor choker": "acc_neck",
  "horn hairband": "acc_head",
  "single hair tube": "acc_carry",
  "floating scarf": "acc_neck",
  "multiple bracelets": "acc_jewel",
  "orange belt": "acc_hand",
  "wrist wrap": "acc_hand",
  "studded bracelet": "acc_jewel",
  "shoulder holster": "acc_hand",
  "couter": "acc_carry",
  "teardrop earrings": "acc_jewel",
  "flower brooch": "acc_jewel",
  "cross choker": "acc_neck",
  "star ornament": "acc_carry",
  "blue hood": "acc_head",
  "messenger bag": "acc_carry",
  "frilled sailor collar": "fab_sleeve",
  "coin hair ornament": "acc_head",
  "pill earrings": "acc_jewel",
  "striped hairband": "acc_head",
  "amulet": "acc_carry",
  "ornate ring": "acc_jewel",
  "brown collar": "acc_neck",
  "white halo": "acc_head",
  "toe ring": "acc_jewel",
  "gift bag": "acc_carry",
  "horn ring": "acc_jewel",
  "fake claws": "acc_carry",
  "red mittens": "acc_hand",
  "lace-trimmed choker": "acc_neck",
  "aqua gloves": "acc_hand",
  "sideways hat": "acc_head",
  "ribbon-trimmed headwear": "acc_head",
  "yellow-tinted eyewear": "acc_face",
  "flower bracelet": "acc_jewel",
  "white mittens": "acc_hand",
  "black helmet": "acc_head",
  "shoulder cannon": "acc_carry",
  "purple-framed eyewear": "acc_face",
  "unworn backpack": "acc_carry",
  "single garter strap": "acc_hand",
  "white garter belt": "legs",
  "ear protection": "acc_carry",
  "halo behind head": "acc_head",
  "pearl hair ornament": "acc_head",
  "checkered sash": "acc_hand",
  "cherry hair ornament": "acc_head",
  "rope belt": "acc_hand",
  "medallion": "acc_carry",
  "blue bandana": "acc_neck",
  "green scrunchie": "acc_hand",
  "lace-trimmed hairband": "acc_head",
  "four-leaf clover hair ornament": "acc_head",
  "multicolored scarf": "acc_neck",
  "print necktie": "acc_neck",
  "multicolored hair bobbles": "acc_head",
  "half mask": "acc_face",
  "shell necklace": "acc_jewel",
  "heart pendant": "acc_jewel",
  "arm cuffs": "acc_bind",
  "black armband": "acc_hand",
  "heart-shaped buckle": "acc_hand",
  "black hood": "acc_head",
  "o-ring belt": "acc_hand",
  "red helmet": "acc_head",
  "spiked hairband": "acc_head",
  "shoulder belt": "acc_hand",
  "diamond hair ornament": "acc_head",
  "white helmet": "acc_head",
  "pink gem": "acc_jewel",
  "red crown": "acc_head",
  "green-tinted eyewear": "acc_face",
  "white bonnet": "acc_head",
  "blue umbrella": "acc_carry",
  "purple collar": "acc_neck",
  "pink umbrella": "acc_carry",
  "shell hair ornament": "acc_head",
  "hat with ears": "acc_head",
  "bowler hat": "acc_head",
  "skull ornament": "acc_carry",
  "biting glove": "acc_hand",
  "rabbit hat": "acc_head",
  "pink sash": "acc_hand",
  "kabuto (helmet)": "acc_head",
  "melting halo": "acc_head",
  "skirt bow": "acc_bow",
  "eyelash ornament": "acc_carry",
  "mitre": "acc_carry",
  "green headband": "acc_head",
  "single arm warmer": "acc_carry",
  "single knee pad": "acc_carry",
  "penguin hood": "acc_head",
  "sam browne belt": "acc_hand",
  "skull necklace": "acc_jewel",
  "dilation tape": "acc_carry",
  "polka dot scrunchie": "acc_hand",
  "wataboushi": "acc_carry",
  "wing brooch": "acc_jewel",
  "plaid ribbon": "acc_bow",
  "female service cap": "acc_head",
  "cat bag": "acc_carry",
  "yellow gem": "acc_jewel",
  "pom pom beanie": "acc_head",
  "polka dot ribbon": "acc_bow",
  "frilled headwear": "acc_head",
  "bikini skirt": "bot_skirt",
  "sarong": "bot_pants",
  "red pants": "bot_pants",
  "cutoffs": "bot_pants",
  "showgirl skirt": "bot_skirt",
  "green pants": "bot_pants",
  "torn pants": "bot_pants",
  "blue buruma": "bot_pants",
  "red buruma": "bot_pants",
  "track pants": "bot_pants",
  "baggy pants": "bot_pants",
  "bike shorts under skirt": "bot_skirt",
  "gym shorts": "bot_pants",
  "multicolored skirt": "bot_skirt",
  "checkered skirt": "bot_skirt",
  "tight pants": "bot_pants",
  "two-tone skirt": "bot_skirt",
  "purple pants": "bot_pants",
  "striped pants": "bot_pants",
  "open shorts": "bot_pants",
  "torn shorts": "bot_pants",
  "vertical-striped skirt": "bot_skirt",
  "see-through skirt": "bot_skirt",
  "open skirt": "bot_skirt",
  "plaid pants": "bot_pants",
  "black buruma": "bot_pants",
  "chaps": "bot_pants",
  "open pants": "bot_pants",
  "puffy pants": "bot_pants",
  "fur-trimmed skirt": "bot_skirt",
  "yellow pants": "bot_pants",
  "frilled shorts": "bot_pants",
  "orange pants": "bot_pants",
  "single pantsleg": "bot_pants",
  "harem pants": "bot_pants",
  "torn jeans": "bot_pants",
  "lace-trimmed skirt": "bot_skirt",
  "overall shorts": "bot_pants",
  "fur-trimmed shorts": "bot_pants",
  "camouflage pants": "bot_pants",
  "kimono skirt": "bot_skirt",
  "vertical-striped pants": "bot_pants",
  "lowleg pants": "bot_pants",
  "side slit shorts": "bot_pants",
  "print shorts": "bot_pants",
  "leather pants": "bot_pants",
  "polka dot skirt": "bot_skirt",
  "cargo pants": "bot_pants",
  "bike shorts under shorts": "bot_pants",
  "pants under skirt": "bot_skirt",
  "white sarong": "bot_pants",
  "half-skirt": "bot_pants",
  "blue sarong": "bot_pants",
  "green kimono": "era_jp",
  "black armor": "era_west",
  "yellow kimono": "era_jp",
  "black corset": "era_west",
  "frilled kimono": "era_jp",
  "hagoromo": "era_jp",
  "orange kimono": "era_jp",
  "red armor": "era_west",
  "brown kimono": "era_jp",
  "grey kimono": "era_jp",
  "blue armor": "era_west",
  "checkered kimono": "era_jp",
  "striped kimono": "era_jp",
  "white armor": "era_west",
  "gold armor": "era_west",
  "fur-trimmed kimono": "era_jp",
  "sideless kimono": "era_jp",
  "leg armor": "era_west",
  "brown corset": "era_west",
  "arm armor": "era_west",
  "multicolored kimono": "era_jp",
  "green hakama": "era_jp",
  "hanten (clothes)": "era_jp",
  "body armor": "era_west",
  "pink hakama": "era_jp",
  "purple hakama": "era_jp",
  "vertical-striped kimono": "era_jp",
  "clothes writing": "fab_detail",
  "drawstring": "fab_detail",
  "center frills": "fab_material",
  "center opening": "fab_detail",
  "bikini under clothes": "fab_detail",
  "lowleg": "fab_detail",
  "star print": "fab_material",
  "paw print": "fab_material",
  "hip vent": "fab_detail",
  "clothes around waist": "fab_detail",
  "v-neck": "fab_detail",
  "see-through sleeves": "fab_sleeve",
  "coat on shoulders": "fab_detail",
  "heart cutout": "fab_material",
  "unworn skirt": "fab_state",
  "low neckline": "fab_sleeve",
  "heart print": "fab_material",
  "leotard under clothes": "fab_detail",
  "jacket partially removed": "fab_detail",
  "asymmetrical sleeves": "fab_sleeve",
  "unworn clothes": "fab_state",
  "unworn jacket": "fab_state",
  "see-through cleavage": "fab_state",
  "covered collarbone": "fab_detail",
  "coattails": "fab_detail",
  "notched lapels": "fab_detail",
  "rose print": "fab_material",
  "cat cutout": "fab_material",
  "underboob cutout": "fab_material",
  "see-through silhouette": "fab_state",
  "american flag print": "fab_material",
  "sideless outfit": "fab_detail",
  "jacket around waist": "fab_detail",
  "fruit print": "fab_material",
  "unworn shirt": "fab_state",
  "dragon print": "fab_material",
  "wet swimsuit": "op_swim",
  "spider web print": "fab_material",
  "borrowed clothes": "fab_state",
  "undersized clothes": "fab_state",
  "rabbit print": "fab_material",
  "bodysuit under clothes": "fab_detail",
  "character print": "fab_material",
  "snowflake print": "fab_material",
  "enpera": "fab_detail",
  "shared clothes": "fab_state",
  "stomach cutout": "fab_material",
  "skull print": "fab_material",
  "cat print": "fab_material",
  "uneven sleeves": "fab_sleeve",
  "butterfly print": "fab_material",
  "dirty clothes": "fab_detail",
  "spandex": "fab_detail",
  "diamond cutout": "fab_material",
  "ofuda on clothes": "fab_detail",
  "feather-trimmed sleeves": "fab_sleeve",
  "constellation print": "fab_material",
  "single vertical stripe": "fab_material",
  "sweater around waist": "fab_detail",
  "loose clothes": "fab_detail",
  "fine fabric emphasis": "fab_detail",
  "front slit": "fab_detail",
  "strawberry print": "fab_material",
  "thigh cutout": "fab_material",
  "clover print": "fab_material",
  "flame print": "fab_material",
  "yellow trim": "fab_material",
  "lace-trimmed sleeves": "fab_sleeve",
  "unworn bikini top": "fab_state",
  "cutout above navel": "fab_material",
  "snap-fit buckle": "acc_hand",
  "single off shoulder": "top_tank",
  "ribbed sleeves": "fab_sleeve",
  "yellow sleeves": "fab_sleeve",
  "shorts under dress": "op_dress",
  "ass cutout": "fab_material",
  "full-length zipper": "fab_detail",
  "pants rolled up": "fab_detail",
  "mismatched sleeves": "fab_sleeve",
  "sweaty clothes": "fab_detail",
  "single horizontal stripe": "fab_material",
  "food-themed clothes": "fab_detail",
  "pinching sleeves": "fab_sleeve",
  "triangle print": "fab_material",
  "single stripe": "fab_material",
  "fish print": "fab_material",
  "pants tucked in": "fab_detail",
  "red trim": "fab_material",
  "brown sleeves": "fab_sleeve",
  "burnt clothes": "fab_detail",
  "unworn coat": "fab_state",
  "clothes between thighs": "fab_detail",
  "armpit cutout": "fab_material",
  "expressive clothes": "fab_detail",
  "anchor print": "fab_material",
  "frog print": "fab_material",
  "cross-laced sleeves": "fab_sleeve",
  "unworn dress": "fab_state",
  "sparkle print": "fab_material",
  "silver trim": "fab_material",
  "baggy clothes": "fab_detail",
  "white trim": "fab_material",
  "cardigan around waist": "fab_detail",
  "orange sleeves": "fab_sleeve",
  "unworn swimsuit": "fab_state",
  "double vertical stripe": "fab_material",
  "unzipping": "fab_detail",
  "crotch cutout": "fab_material",
  "skirt cutout": "fab_material",
  "cross-laced slit": "fab_detail",
  "wet dress": "op_dress",
  "torn bodystocking": "op_body",
  "jacket over swimsuit": "op_swim",
  "houndstooth": "fab_detail",
  "print sleeves": "fab_sleeve",
  "puff and slash sleeves": "fab_sleeve",
  "skirt under dress": "op_dress",
  "see-through body": "fab_state",
  "patchwork clothes": "fab_detail",
  "embroidery": "fab_detail",
  "object in pocket": "fab_detail",
  "wringing clothes": "fab_detail",
  "double horizontal stripe": "fab_material",
  "shorts around one leg": "fab_detail",
  "sayagata": "fab_detail",
  "square neckline": "fab_sleeve",
  "exposed pocket": "fab_detail",
  "unworn shoes": "fab_state",
  "uwabaki": "feet",
  "tengu-geta": "feet",
  "grey boots": "feet",
  "purple boots": "feet",
  "rudder footwear": "feet",
  "green boots": "feet",
  "yellow boots": "feet",
  "multicolored shoes": "feet",
  "unworn boots": "fab_state",
  "unworn sandals": "fab_state",
  "fold-over boots": "feet",
  "orange boots": "feet",
  "leather boots": "feet",
  "multicolored boots": "feet",
  "gladiator sandals": "feet",
  "combat boots": "feet",
  "two-tone shoes": "feet",
  "belt boots": "feet",
  "cowboy boots": "feet",
  "single boot": "feet",
  "cross-laced shoes": "feet",
  "ice skates": "feet",
  "animal slippers": "feet",
  "crocs": "feet",
  "barefoot sandals (jewelry)": "feet",
  "blue sandals": "feet",
  "high tops": "feet",
  "dress shoes": "feet",
  "wedge heels": "feet",
  "two-tone boots": "feet",
  "fur boots": "feet",
  "open-toe shoes": "feet",
  "pink slippers": "feet",
  "winged shoes": "feet",
  "aqua shoes": "feet",
  "frilled thigh strap": "legs",
  "thighlet": "legs",
  "grey thighhighs": "legs",
  "vertical-striped thighhighs": "legs",
  "grey pantyhose": "legs",
  "blue socks": "legs",
  "single sock": "legs",
  "striped socks": "legs",
  "thigh holster": "legs",
  "print pantyhose": "legs",
  "single leg pantyhose": "legs",
  "no socks": "legs",
  "cow print thighhighs": "legs",
  "grey socks": "legs",
  "red socks": "legs",
  "ribbon-trimmed thighhighs": "legs",
  "black leggings": "legs",
  "single kneehigh": "legs",
  "american flag legwear": "legs",
  "frilled socks": "legs",
  "pink socks": "legs",
  "alternate legwear": "legs",
  "thigh pouch": "acc_carry",
  "brown socks": "legs",
  "see-through legwear": "legs",
  "green socks": "legs",
  "fur-trimmed legwear": "legs",
  "multicolored thighhighs": "legs",
  "vertical-striped pantyhose": "legs",
  "argyle thighhighs": "legs",
  "ribbed socks": "legs",
  "unworn socks": "fab_state",
  "purple socks": "legs",
  "orange pantyhose": "legs",
  "yellow socks": "legs",
  "green pantyhose": "legs",
  "white leggings": "legs",
  "gradient legwear": "legs",
  "animal ear legwear": "legs",
  "two-tone legwear": "legs",
  "shiny legwear": "legs",
  "thighhighs over pantyhose": "legs",
  "high-waist pantyhose": "legs",
  "single thigh boot": "legs",
  "leg wrap": "legs",
  "orange socks": "legs",
  "cat ear legwear": "legs",
  "yellow pantyhose": "legs",
  "white leg warmers": "legs",
  "bridal legwear": "legs",
  "fur-trimmed thighhighs": "legs",
  "fishnet socks": "legs",
  "vertical-striped socks": "legs",
  "detached leggings": "legs",
  "cross-laced legwear": "legs",
  "white apron": "op_uniform",
  "skirt set": "op_dress",
  "winter uniform": "op_uniform",
  "summer uniform": "op_uniform",
  "black serafuku": "op_uniform",
  "impossible clothes": "fab_detail",
  "print bikini": "op_swim",
  "tracen school uniform": "op_uniform",
  "yellow bikini": "op_swim",
  "highleg bikini": "op_swim",
  "green bikini": "op_swim",
  "kita high school uniform": "op_uniform",
  "mitakihara school uniform": "op_uniform",
  "white bodysuit": "op_body",
  "sakuragaoka high school uniform": "op_uniform",
  "ooarai school uniform": "op_uniform",
  "multicolored dress": "op_dress",
  "black suit": "op_uniform",
  "male swimwear": "op_swim",
  "bikini bottom only": "op_only",
  "multi-strapped bikini bottom": "op_swim",
  "sailor senshi uniform": "op_uniform",
  "competition school swimsuit": "op_swim",
  "tokiwadai school uniform": "op_uniform",
  "otonokizaka school uniform": "op_uniform",
  "cow print bikini": "op_swim",
  "old school swimsuit": "op_swim",
  "thong bikini": "op_swim",
  "purple leotard": "op_body",
  "vertical-striped dress": "op_dress",
  "white robe": "outer",
  "multicolored bikini": "op_swim",
  "torn dress": "op_dress",
  "orange bikini": "op_swim",
  "garreg mach monastery uniform": "op_uniform",
  "lowleg bikini": "op_swim",
  "strapless bikini": "op_swim",
  "tracen training uniform": "op_uniform",
  "polka dot bikini": "op_swim",
  "pink leotard": "op_body",
  "black robe": "outer",
  "demon slayer uniform": "op_uniform",
  "blue serafuku": "op_uniform",
  "multicolored bodysuit": "op_body",
  "ryouou school uniform": "op_uniform",
  "frilled one-piece swimsuit": "op_swim",
  "maid bikini": "op_swim",
  "green leotard": "op_body",
  "see-through dress": "op_dress",
  "eyepatch bikini": "op_swim",
  "purple bodysuit": "op_body",
  "blue overalls": "op_uniform",
  "swim trunks": "bot_pants",
  "pink apron": "op_uniform",
  "two-tone swimsuit": "op_swim",
  "open dress": "op_dress",
  "layered bikini": "op_swim",
  "tokyo-3 middle school uniform": "op_uniform",
  "uranohoshi school uniform": "op_uniform",
  "gekkoukan high school uniform": "op_uniform",
  "sleepwear": "op_night",
  "paradis military uniform": "op_uniform",
  "nanamori school uniform": "op_uniform",
  "american flag dress": "op_dress",
  "black apron": "op_uniform",
  "ribbed dress": "op_dress",
  "pirate costume": "op_uniform",
  "two-tone bikini": "op_swim",
  "multicolored swimsuit": "op_swim",
  "orange bodysuit": "op_body",
  "sailor bikini": "op_swim",
  "blue apron": "op_uniform",
  "asticassia school uniform": "op_uniform",
  "mismatched bikini": "op_swim",
  "american flag bikini": "op_swim",
  "meiji schoolgirl uniform": "op_uniform",
  "bow bikini": "op_swim",
  "pink bodysuit": "op_body",
  "shimakaze (kancolle) (cosplay)": "op_uniform",
  "white suit": "op_uniform",
  "kuromorimine military uniform": "op_uniform",
  "kitauji high school uniform": "op_uniform",
  "gem uniform (houseki no kuni)": "op_uniform",
  "gold bikini": "op_swim",
  "impossible bodysuit": "op_body",
  "ruffle bikini": "op_swim",
  "hasu no sora school uniform": "op_uniform",
  "zero suit": "op_uniform",
  "backless leotard": "op_body",
  "white romper": "op_body",
  "aqua bikini": "op_swim",
  "nijigasaki school uniform": "op_uniform",
  "santa bikini": "op_swim",
  "naoetsu high school uniform": "op_uniform",
  "plaid bikini": "op_swim",
  "purple serafuku": "op_uniform",
  "see-through leotard": "op_body",
  "st. gloriana's school uniform": "op_uniform",
  "millennium cheerleader outfit (blue archive)": "op_dress",
  "little busters! school uniform": "op_uniform",
  "impossible leotard": "op_body",
  "turtleneck leotard": "op_body",
  "lycoris uniform": "op_uniform",
  "impossible dress": "op_dress",
  "bondage outfit": "op_dress",
  "ooarai military uniform": "op_uniform",
  "shuuchiin academy school uniform": "op_uniform",
  "champion's tunic (zelda)": "op_dress",
  "green apron": "op_uniform",
  "hikarizaka private high school uniform": "op_uniform",
  "side-tie leotard": "op_body",
  "pink pajamas": "op_night",
  "tactical clothes": "op_dress",
  "impossible swimsuit": "op_swim",
  "multicolored leotard": "op_body",
  "st. gloriana's military uniform": "op_uniform",
  "anzio school uniform": "op_uniform",
  "tankini": "op_dress",
  "hooded robe": "outer",
  "yasogami school uniform": "op_uniform",
  "male playboy bunny": "op_body",
  "kibito high school uniform": "op_uniform",
  "two-tone bodysuit": "op_body",
  "green bodysuit": "op_body",
  "gradient dress": "op_dress",
  "vocaloid append": "op_dress",
  "rabbit house uniform": "op_uniform",
  "blue robe": "outer",
  "reindeer costume": "op_uniform",
  "diving suit": "op_uniform",
  "embellished costume": "op_uniform",
  "grey bodysuit": "op_body",
  "red apron": "op_uniform",
  "yellow apron": "op_uniform",
  "off-shoulder bikini": "op_swim",
  "brown apron": "op_uniform",
  "pink one-piece swimsuit": "op_swim",
  "team rocket uniform": "op_uniform",
  "kuromorimine school uniform": "op_uniform",
  "grey bikini": "op_swim",
  "kigurumi": "op_dress",
  "u.a. school uniform": "op_uniform",
  "jujutsu tech uniform": "op_uniform",
  "hatsune miku (cosplay)": "op_uniform",
  "white serafuku": "op_uniform",
  "frilled leotard": "op_body",
  "yurigaoka girls academy school uniform": "op_uniform",
  "hakurei reimu (cosplay)": "op_uniform",
  "haneoka school uniform": "op_uniform",
  "sakugawa school uniform": "op_uniform",
  "brown bikini": "op_swim",
  "oohashi high school uniform": "op_uniform",
  "two-tone leotard": "op_body",
  "cross-laced dress": "op_dress",
  "icho private high school uniform": "op_uniform",
  "ribbon-trimmed dress": "op_dress",
  "a certain high school uniform": "op_uniform",
  "yellow bodysuit": "op_body",
  "purple one-piece swimsuit": "op_swim",
  "ribbed bodysuit": "op_body",
  "sleeved leotard": "op_body",
  "athletic leotard": "op_body",
  "hanasakigawa school uniform": "op_uniform",
  "sobu high school uniform": "op_uniform",
  "power suit (metroid)": "op_dress",
  "eden academy school uniform": "op_uniform",
  "torn leotard": "op_body",
  "naranja academy school uniform": "op_uniform",
  "ribbed leotard": "op_body",
  "new school swimsuit": "op_swim",
  "yellow leotard": "op_body",
  "shark costume": "op_uniform",
  "fourth east high school uniform": "op_uniform",
  "shinda sekai sensen uniform": "op_uniform",
  "vampire costume": "op_uniform",
  "yuigaoka school uniform": "op_uniform",
  "kiyosumi school uniform": "op_uniform",
  "mummy costume": "op_uniform",
  "kirin (armor)": "op_dress",
  "polka dot swimsuit": "op_swim",
  "bikesuit": "op_dress",
  "prison clothes": "op_dress",
  "shell bikini": "op_swim",
  "kourindou tengu costume": "op_uniform",
  "loungewear": "op_dress",
  "ghost costume": "op_uniform",
  "tracen swimsuit": "op_swim",
  "brown leotard": "op_body",
  "shuka high school uniform": "op_uniform",
  "tutu": "op_dress",
  "shuujin academy school uniform": "op_uniform",
  "wagnaria uniform": "op_uniform",
  "nanairogaoka middle school uniform": "op_uniform",
  "power suit": "op_uniform",
  "uva academy school uniform": "op_uniform",
  "aria company uniform": "op_uniform",
  "tight dress": "op_dress",
  "kamiyama high school uniform (hyouka)": "op_uniform",
  "two-sided dress": "op_dress",
  "vertical-striped bikini": "op_swim",
  "hooded bodysuit": "op_body",
  "griffin & kryuger military uniform": "op_uniform",
  "pravda school uniform": "op_uniform",
  "saiyan armor": "era_west",
  "swimsuit cover-up": "op_swim",
  "keizoku military uniform": "op_uniform",
  "duel academy uniform (yu-gi-oh! gx)": "op_uniform",
  "alice (alice in wonderland) (cosplay)": "op_uniform",
  "torn swimsuit": "op_swim",
  "sukajan": "outer",
  "mash kyrielight (dangerous beast) (cosplay)": "op_uniform",
  "blue pajamas": "op_night",
  "saunders military uniform": "op_uniform",
  "grey leotard": "op_body",
  "taimanin suit": "op_uniform",
  "grey serafuku": "op_uniform",
  "kamiyama high school uniform (project sekai)": "op_uniform",
  "coat dress": "op_dress",
  "bc freedom military uniform": "op_uniform",
  "bear costume": "op_uniform",
  "ashford academy school uniform": "op_uniform",
  "hooded dress": "op_dress",
  "luna nova school uniform": "op_uniform",
  "grey suit": "op_uniform",
  "miyamasuzaka girls' academy school uniform": "op_uniform",
  "fleur de lapin uniform": "op_uniform",
  "print leotard": "op_body",
  "strapless one-piece swimsuit": "op_swim",
  "youtou high school uniform": "op_uniform",
  "virgin destroyer sweater": "top_knit",
  "off-shoulder one-piece swimsuit": "op_swim",
  "hogwarts school uniform": "op_uniform",
  "self-cosplay": "op_dress",
  "red robe": "outer",
  "wa lolita": "fab_style",
  "undersuit": "op_dress",
  "amesuku gyaru": "fab_style",
  "checkered dress": "op_dress",
  "tokisadame school uniform": "op_uniform",
  "anzio military uniform": "op_uniform",
  "cat costume": "op_uniform",
  "sophist's robe (ff14)": "op_night",
  "varia suit": "op_uniform",
  "orange leotard": "op_body",
  "pinstripe suit": "op_uniform",
  "virgin killer outfit": "op_dress",
  "orange jumpsuit": "op_body",
  "black slingshot swimsuit": "op_swim",
  "black cape": "era_west",
  "white capelet": "era_west",
  "white cape": "era_west",
  "blue cape": "era_west",
  "multicolored jacket": "outer",
  "collared jacket": "outer",
  "black capelet": "era_west",
  "red capelet": "era_west",
  "waist cape": "era_west",
  "two-tone jacket": "outer",
  "black cloak": "era_west",
  "blue capelet": "era_west",
  "striped jacket": "outer",
  "hooded capelet": "era_west",
  "green cape": "era_west",
  "yellow cardigan": "outer",
  "white cloak": "era_west",
  "purple cape": "era_west",
  "two-sided cape": "era_west",
  "red cloak": "era_west",
  "torn cape": "era_west",
  "two-sided jacket": "outer",
  "brown capelet": "era_west",
  "red hoodie": "top_shirt",
  "hooded cape": "era_west",
  "green hoodie": "top_shirt",
  "frilled capelet": "era_west",
  "brown cape": "era_west",
  "yellow hoodie": "top_shirt",
  "collared cape": "era_west",
  "plaid jacket": "outer",
  "fur-trimmed cloak": "era_west",
  "cropped hoodie": "top_shirt",
  "blue cloak": "era_west",
  "purple capelet": "era_west",
  "brown cloak": "era_west",
  "multicolored coat": "outer",
  "stole": "outer",
  "purple hoodie": "top_shirt",
  "print jacket": "outer",
  "green capelet": "era_west",
  "aqua jacket": "outer",
  "brown hoodie": "top_shirt",
  "orange hoodie": "top_shirt",
  "no jacket": "outer",
  "pink capelet": "era_west",
  "sleeveless coat": "outer",
  "overcoat": "outer",
  "yellow cape": "era_west",
  "torn jacket": "outer",
  "off-shoulder jacket": "outer",
  "floating cape": "era_west",
  "hooded cardigan": "outer",
  "two-tone cape": "era_west",
  "blue tabard": "era_west",
  "fur cape": "era_west",
  "grey capelet": "era_west",
  "pink cape": "era_west",
  "tied jacket": "outer",
  "vertical-striped jacket": "outer",
  "two-tone hoodie": "top_shirt",
  "grey cape": "era_west",
  "see-through jacket": "outer",
  "striped hoodie": "top_shirt",
  "two-sided coat": "outer",
  "green cloak": "era_west",
  "purple cardigan": "outer",
  "multicolored cape": "era_west",
  "hooded track jacket": "outer",
  "yellow raincoat": "outer",
  "print hoodie": "top_shirt",
  "fur cloak": "era_west",
  "two-tone coat": "outer",
  "blue shawl": "era_west",
  "frilled jacket": "outer",
  "orange cape": "era_west",
  "down jacket": "outer",
  "parka": "outer",
  "surcoat": "outer",
  "red cardigan": "outer",
  "front-tie top": "top_shirt",
  "front-tie bikini top": "top_shirt",
  "criss-cross halter": "top_shirt",
  "red vest": "top_tank",
  "bandeau": "top_shirt",
  "blue vest": "top_tank",
  "o-ring top": "top_shirt",
  "green vest": "top_tank",
  "plaid vest": "top_tank",
  "brown vest": "top_tank",
  "open vest": "top_tank",
  "chest sarashi": "top_tank",
  "yellow sweater": "top_knit",
  "grey vest": "top_tank",
  "white vest": "top_tank",
  "purple vest": "top_tank",
  "brown sweater vest": "top_knit",
  "purple sweater": "top_knit",
  "yellow vest": "top_tank",
  "bulletproof vest": "top_tank",
  "open-chest sweater": "top_knit",
  "fishnet top": "top_shirt",
  "pink vest": "top_tank",
  "cropped vest": "top_tank",
  "striped sweater": "top_knit",
  "multicolored shirt": "top_shirt",
  "budget sarashi": "top_tank",
  "hooded sweater": "top_knit",
  "bodice": "top_shirt",
  "yellow sweater vest": "top_knit",
  "cropped sweater": "top_knit",
  "black sweater vest": "top_knit",
  "multi-strapped bikini top": "top_shirt",
  "load-bearing vest": "top_tank",
  "collared vest": "top_tank",
  "orange vest": "top_tank",
  "orange sweater": "top_knit",
  "short-sleeved sweater": "top_knit",
  "blue tunic": "era_west",
  "blue tank top": "top_tank",
  "loose shirt": "top_shirt",
  "grey tank top": "top_tank",
  "frilled camisole": "top_tank",
  "green tunic": "era_west",
  "yellow tank top": "top_tank",
  "racerback": "top_shirt",
  "green tank top": "top_tank",
  "polka dot shirt": "top_shirt",
  "black tube top": "top_tank",
  "checkered shirt": "top_shirt",
  "cross-laced top": "top_shirt",
  "black bandeau": "top_shirt",
  "blue camisole": "top_tank",
  "argyle sweater": "top_knit",
  "white tube top": "top_tank",
  "sling bikini top": "top_shirt",
  "crotch seam": "uw_bottom",
  "lowleg panties": "uw_bottom",
  "wet panties": "uw_bottom",
  "cat lingerie": "op_night",
  "breastless clothes": "uw_bottom",
  "trefoil": "uw_bottom",
  "white sports bra": "uw_top",
  "untied panties": "uw_bottom",
  "open bra": "uw_top",
  "yellow bra": "uw_top",
  "belt bra": "uw_top",
  "grey sports bra": "uw_top",
  "stained panties": "uw_bottom",
  "two-tone sports bra": "uw_top",
  "brown panties": "uw_bottom",
  "torn panties": "uw_bottom",
  "plaid panties": "uw_bottom",
  "star pasties": "acc_toy",
  "jockstrap": "uw_bottom",
  "back-print panties": "uw_bottom",
  "string bra": "uw_top",
  "panties under buruma": "bot_pants",
  "multi-strapped panties": "uw_bottom",
  "brown bra": "uw_top",
  "strawberry print panties": "uw_bottom",
  "aqua bra": "uw_top",
  "oversized breast cup": "uw_top",
  "red sports bra": "uw_top",
  "satin panties": "uw_bottom",
  "plaid bra": "uw_top",
  "underwear": "uw_bottom"
}

NARROW = {
  "anal tail": [
    "sex"
  ],
  "condom packet strip": [
    "sex"
  ],
  "used tissue": [
    "sex"
  ],
  "lube": [
    "sex"
  ],
  "clitoral piercing": [
    "sex"
  ],
  "condom belt": [
    "sex"
  ],
  "dilation tape": [
    "sex"
  ],
  "open shorts": [
    "flash",
    "sex"
  ],
  "open skirt": [
    "flash",
    "sex"
  ],
  "open pants": [
    "flash",
    "sex"
  ],
  "heart cutout": [
    "flash",
    "sex"
  ],
  "cat cutout": [
    "flash",
    "sex"
  ],
  "underboob cutout": [
    "flash",
    "sex"
  ],
  "stomach cutout": [
    "flash",
    "sex"
  ],
  "diamond cutout": [
    "flash",
    "sex"
  ],
  "thigh cutout": [
    "flash",
    "sex"
  ],
  "ass cutout": [
    "flash",
    "sex"
  ],
  "armpit cutout": [
    "flash",
    "sex"
  ],
  "crotch cutout": [
    "flash",
    "sex"
  ],
  "skirt cutout": [
    "flash",
    "sex"
  ],
  "bikini bottom only": [
    "flash",
    "sex"
  ],
  "open dress": [
    "flash",
    "sex"
  ],
  "bondage outfit": [
    "flash",
    "sex"
  ],
  "open vest": [
    "flash",
    "sex"
  ],
  "crotch seam": [
    "flash",
    "sex"
  ],
  "breastless clothes": [
    "flash",
    "sex"
  ],
  "untied panties": [
    "flash",
    "sex"
  ],
  "open bra": [
    "flash",
    "sex"
  ],
  "stained panties": [
    "sex"
  ]
}

ODD = [
  "a certain high school uniform",
  "alice (alice in wonderland) (cosplay)",
  "amesuku gyaru",
  "anzio military uniform",
  "anzio school uniform",
  "aria company uniform",
  "ashford academy school uniform",
  "asticassia school uniform",
  "bc freedom military uniform",
  "champion's tunic (zelda)",
  "crime prevention buzzer",
  "demon slayer uniform",
  "duel academy uniform (yu-gi-oh! gx)",
  "dynamax band",
  "eden academy school uniform",
  "fleur de lapin uniform",
  "fourth east high school uniform",
  "garreg mach monastery uniform",
  "gekkoukan high school uniform",
  "gem uniform (houseki no kuni)",
  "griffin & kryuger military uniform",
  "hakurei reimu (cosplay)",
  "hanasakigawa school uniform",
  "haneoka school uniform",
  "hasu no sora school uniform",
  "hatsune miku (cosplay)",
  "hikarizaka private high school uniform",
  "hogwarts school uniform",
  "icho private high school uniform",
  "jujutsu tech uniform",
  "kamiyama high school uniform (hyouka)",
  "kamiyama high school uniform (project sekai)",
  "keizoku military uniform",
  "kibito high school uniform",
  "kirin (armor)",
  "kita high school uniform",
  "kitauji high school uniform",
  "kiyosumi school uniform",
  "kourindou tengu costume",
  "kuromorimine military uniform",
  "kuromorimine school uniform",
  "little busters! school uniform",
  "luna nova school uniform",
  "lycoris uniform",
  "mash kyrielight (dangerous beast) (cosplay)",
  "meiji schoolgirl uniform",
  "millennium cheerleader outfit (blue archive)",
  "miyamasuzaka girls' academy school uniform",
  "naoetsu high school uniform",
  "naranja academy school uniform",
  "nijigasaki school uniform",
  "ooarai military uniform",
  "ooarai school uniform",
  "oohashi high school uniform",
  "otonokizaka school uniform",
  "paradis military uniform",
  "power suit",
  "power suit (metroid)",
  "pravda school uniform",
  "rabbit house uniform",
  "rider belt",
  "rudder footwear",
  "ryouou school uniform",
  "sailor senshi uniform",
  "saiyan armor",
  "sakuragaoka high school uniform",
  "saunders military uniform",
  "self-cosplay",
  "shimakaze (kancolle) (cosplay)",
  "shinda sekai sensen uniform",
  "shuka high school uniform",
  "shuuchiin academy school uniform",
  "shuujin academy school uniform",
  "sobu high school uniform",
  "sophist's robe (ff14)",
  "st. gloriana's military uniform",
  "st. gloriana's school uniform",
  "super crown",
  "taimanin suit",
  "team rocket uniform",
  "tokisadame school uniform",
  "tracen school uniform",
  "tracen swimsuit",
  "tracen training uniform",
  "u.a. school uniform",
  "uranohoshi school uniform",
  "uva academy school uniform",
  "varia suit",
  "vocaloid append",
  "wagnaria uniform",
  "yasogami school uniform",
  "youtou high school uniform",
  "yuigaoka school uniform",
  "yurigaoka girls academy school uniform",
  "zero suit"
]

SCHOOL = [
  "a certain high school uniform",
  "amesuku gyaru",
  "anzio school uniform",
  "ashford academy school uniform",
  "asticassia school uniform",
  "black buruma",
  "black serafuku",
  "blue buruma",
  "blue serafuku",
  "brown sailor collar",
  "competition school swimsuit",
  "duel academy uniform (yu-gi-oh! gx)",
  "eden academy school uniform",
  "fourth east high school uniform",
  "frilled sailor collar",
  "gekkoukan high school uniform",
  "green sailor collar",
  "grey sailor collar",
  "grey serafuku",
  "hanasakigawa school uniform",
  "haneoka school uniform",
  "hasu no sora school uniform",
  "hikarizaka private high school uniform",
  "hogwarts school uniform",
  "icho private high school uniform",
  "kamiyama high school uniform (hyouka)",
  "kamiyama high school uniform (project sekai)",
  "kibito high school uniform",
  "kita high school uniform",
  "kitauji high school uniform",
  "kiyosumi school uniform",
  "kuromorimine school uniform",
  "little busters! school uniform",
  "luna nova school uniform",
  "meiji schoolgirl uniform",
  "miyamasuzaka girls' academy school uniform",
  "naoetsu high school uniform",
  "naranja academy school uniform",
  "new school swimsuit",
  "nijigasaki school uniform",
  "old school swimsuit",
  "ooarai school uniform",
  "oohashi high school uniform",
  "orange sailor collar",
  "otonokizaka school uniform",
  "panties under buruma",
  "pink sailor collar",
  "pravda school uniform",
  "purple sailor collar",
  "purple serafuku",
  "red buruma",
  "red sailor collar",
  "ryouou school uniform",
  "sakuragaoka high school uniform",
  "school bag",
  "school emblem",
  "shuka high school uniform",
  "shuuchiin academy school uniform",
  "shuujin academy school uniform",
  "sobu high school uniform",
  "st. gloriana's school uniform",
  "summer uniform",
  "tokisadame school uniform",
  "tracen school uniform",
  "u.a. school uniform",
  "uranohoshi school uniform",
  "uva academy school uniform",
  "uwabaki",
  "white serafuku",
  "winter uniform",
  "yasogami school uniform",
  "youtou high school uniform",
  "yuigaoka school uniform",
  "yurigaoka girls academy school uniform"
]

BAN_NEW = [
  "mitakihara school uniform",
  "nanairogaoka middle school uniform",
  "nanamori school uniform",
  "sakugawa school uniform",
  "tokiwadai school uniform",
  "tokyo-3 middle school uniform"
]

ZH_CLOTHING = {
  "headgear": "頭戴裝備",
  "blue ribbon": "藍色緞帶",
  "white ribbon": "白色緞帶",
  "yellow bow": "黃色蝴蝶結",
  "green bow": "綠色蝴蝶結",
  "pink ribbon": "粉紅色緞帶",
  "purple bow": "紫色蝴蝶結",
  "swim ring": "游泳圈",
  "yellow ribbon": "黃色緞帶",
  "school bag": "書包",
  "striped bow": "條紋蝴蝶結",
  "mouth mask": "口罩／口鼻面罩",
  "animal hood": "動物兜帽",
  "heart hair ornament": "愛心髮飾",
  "tress ribbon": "髮束緞帶",
  "green ribbon": "綠色緞帶",
  "fake horns": "假角",
  "purple ribbon": "紫色緞帶",
  "butterfly hair ornament": "蝴蝶髮飾",
  "spaghetti strap": "細肩帶",
  "back bow": "背後蝴蝶結",
  "orange bow": "橘色蝴蝶結",
  "animal ear hairband": "動物耳髮箍",
  "tail ornament": "尾巴飾品",
  "emblem": "徽章／紋章",
  "newsboy cap": "報童帽",
  "food-themed hair ornament": "食物造型髮飾",
  "frog hair ornament": "青蛙髮飾",
  "triangular headpiece": "三角頭巾",
  "pink hat": "粉紅色帽子",
  "rabbit ear hairband": "兔耳髮箍",
  "horn ornament": "角飾",
  "holster": "槍套",
  "red halo": "紅色光環",
  "bridal veil": "新娘頭紗",
  "mechanical halo": "機械光環",
  "forehead jewel": "額頭寶石",
  "arm strap": "臂帶",
  "ear ornament": "耳飾",
  "purple hat": "紫色帽子",
  "snake hair ornament": "蛇造型髮飾",
  "blue gem": "藍色寶石",
  "animal hat": "動物帽子",
  "unworn eyewear": "未穿戴的眼鏡類",
  "frilled bow": "荷葉邊蝴蝶結",
  "striped necktie": "條紋領帶",
  "nun headdress": "修女頭巾",
  "sack": "麻袋",
  "harness": "馬具／束帶",
  "white belt": "白色腰帶",
  "lolita hairband": "洛麗塔髮箍",
  "hat feather": "帽上羽毛",
  "asymmetrical gloves": "不對稱手套",
  "tilted headwear": "歪戴的帽子",
  "headscarf": "頭巾（headscarf）",
  "leg ribbon": "腿上緞帶",
  "crescent hair ornament": "月牙髮飾",
  "rabbit hair ornament": "兔子髮飾",
  "white collar": "白色項圈／衣領",
  "animal ear piercing": "動物耳穿孔",
  "yellow halo": "黃色光環",
  "strap": "肩帶／綁帶",
  "spiked collar": "尖刺項圈／衣領",
  "bow hairband": "蝴蝶結髮箍",
  "leaf hair ornament": "葉子髮飾",
  "belt pouch": "腰帶小包",
  "crescent hat ornament": "月牙帽飾",
  "neck ring": "頸環（硬式）",
  "spiked bracelet": "尖刺手環",
  "charm (object)": "吊飾",
  "frilled hairband": "荷葉邊髮箍",
  "purple bowtie": "紫色領結",
  "bead bracelet": "珠串手環",
  "blue choker": "藍色項圈式頸飾",
  "cross hair ornament": "十字架髮飾",
  "badge": "徽章",
  "ears through headwear": "耳朵穿出帽子",
  "aqua necktie": "水藍色領帶",
  "polka dot bow": "圓點蝴蝶結",
  "yellow bowtie": "黃色領結",
  "arm guards": "護臂",
  "grey gloves": "灰色手套",
  "yellow hairband": "黃色髮箍",
  "floating earrings": "飄浮耳環",
  "striped bowtie": "條紋領結",
  "star hat ornament": "星星帽飾",
  "chest jewel": "胸前寶石",
  "ear bow": "耳朵蝴蝶結",
  "shoulder pads": "墊肩／護肩",
  "traditional bowtie": "傳統領結",
  "mini top hat": "迷你禮帽",
  "arm ribbon": "手臂緞帶",
  "cube hair ornament": "方塊髮飾",
  "arm garter": "臂環(袖箍)",
  "white neckerchief": "白色領巾",
  "grey hat": "灰色帽子",
  "pink hairband": "粉紅色髮箍",
  "green gloves": "綠色手套",
  "heart brooch": "愛心胸針",
  "print gloves": "印花手套",
  "belt collar": "皮帶項圈",
  "multiple rings": "多枚戒指",
  "chest harness": "胸前束帶",
  "aqua bow": "水藍色蝴蝶結",
  "white necktie": "白色領帶",
  "eye mask": "眼罩面具",
  "plaid bow": "格紋蝴蝶結",
  "pink choker": "粉紅色項圈式頸飾",
  "whistle": "哨子",
  "green bowtie": "綠色領結",
  "multicolored gloves": "多色手套",
  "anchor hair ornament": "船錨髮飾",
  "short necktie": "短領帶",
  "purple necktie": "紫色領帶",
  "cross earrings": "十字耳環",
  "forehead protector": "護額",
  "animal ear headphones": "動物耳耳機",
  "multiple hair bows": "多個髮蝴蝶結",
  "tail bow": "尾巴蝴蝶結",
  "yellow gloves": "黃色手套",
  "barbell piercing": "槓鈴型穿環",
  "skull hair ornament": "骷髏髮飾",
  "plaid scarf": "格紋圍巾",
  "red gem": "紅色寶石",
  "dog tags": "軍籍牌",
  "horn ribbon": "角上緞帶",
  "brown bow": "棕色蝴蝶結",
  "flower knot": "花結（中國結）",
  "pink necktie": "粉紅色領帶",
  "mismatched gloves": "左右不一致的手套",
  "frilled hair tubes": "荷葉邊髮管",
  "aiguillette": "飾繩(肩飾帶)",
  "white wrist cuffs": "白色腕套(袖口)",
  "traditional halo": "傳統光環",
  "waist bow": "腰前蝴蝶結",
  "dress bow": "洋裝蝴蝶結",
  "frilled hat": "荷葉邊帽子",
  "large bow": "大蝴蝶結",
  "studs": "鉚釘",
  "black ascot": "黑色領巾(ascot)",
  "fur hat": "毛皮帽",
  "arm belt": "臂帶（皮帶）",
  "fur-trimmed headwear": "毛皮滾邊頭飾／頭戴物",
  "yellow hat": "黃色帽子",
  "striped scarf": "條紋圍巾",
  "striped ribbon": "條紋緞帶",
  "tail ribbon": "尾巴緞帶",
  "pink neckerchief": "粉紅色領巾",
  "footwear bow": "鞋上蝴蝶結",
  "brown bag": "棕色包包",
  "cat hair ornament": "貓咪髮飾",
  "black bag": "黑色包包",
  "earclip": "耳夾",
  "blue ascot": "藍色領巾(ascot)",
  "closed umbrella": "收起的雨傘",
  "ring piercing": "環形穿孔",
  "single elbow glove": "單邊長手套",
  "quiver": "箭筒",
  "loose necktie": "寬鬆領帶",
  "frilled gloves": "荷葉邊手套",
  "green sailor collar": "綠色水手領",
  "metal collar": "金屬項圈",
  "towel around neck": "脖子上掛毛巾",
  "purple hairband": "紫色髮箍",
  "unworn mask": "未穿戴的面具／口罩",
  "multiple belts": "多條腰帶",
  "green gem": "綠色寶石",
  "blue belt": "藍色腰帶",
  "grey sailor collar": "灰色水手領",
  "red sailor collar": "紅色水手領",
  "red rope": "紅色繩子",
  "two-tone gloves": "雙色手套",
  "super crown": "超級皇冠",
  "red headband": "紅色頭帶",
  "red belt": "紅色腰帶",
  "heart choker": "愛心頸圈",
  "surgical mask": "醫用口罩",
  "musical note hair ornament": "音符髮飾",
  "orange bowtie": "橘色領結",
  "heart necklace": "愛心項鍊",
  "wrist ribbon": "手腕緞帶",
  "pink scarf": "粉紅色圍巾",
  "brown scarf": "棕色圍巾",
  "anal tail": "肛塞尾巴",
  "pirate hat": "海盜帽",
  "cat ear headphones": "貓耳耳機",
  "green halo": "綠色光環",
  "red sash": "紅色腰帶(綢帶)",
  "rectangular eyewear": "長方形眼鏡",
  "carrot hair ornament": "紅蘿蔔髮飾",
  "backwards hat": "反戴帽子",
  "black mask": "黑色面具／口罩",
  "orange ribbon": "橘色緞帶",
  "earpiece": "單邊耳機",
  "heart-shaped eyewear": "愛心形眼鏡類",
  "tassel hair ornament": "流蘇髮飾",
  "pince-nez": "夾鼻眼鏡",
  "crescent pin": "月牙胸針",
  "orange necktie": "橘色領帶",
  "shark hair ornament": "鯊魚髮飾",
  "yellow scarf": "黃色圍巾",
  "unworn helmet": "未穿戴的頭盔",
  "wing hair ornament": "翅膀髮飾",
  "diagonal-striped bow": "斜條紋蝴蝶結",
  "red armband": "紅色臂章／臂環",
  "rectangular halo": "長方形光環",
  "opaque glasses": "不透明鏡片眼鏡",
  "orange hat": "橘色帽子",
  "wiffle gag": "洞洞口球",
  "purple choker": "紫色項圈式頸飾",
  "cat hood": "貓耳兜帽",
  "multiple earrings": "多個耳環",
  "paper bag": "紙袋",
  "green scarf": "綠色圍巾",
  "black veil": "黑色面紗",
  "bone hair ornament": "骨頭髮飾",
  "cow print gloves": "乳牛紋手套",
  "aqua bowtie": "水藍色領結",
  "gold earrings": "金色耳環",
  "orange hairband": "橘色髮箍",
  "o-ring choker": "O環頸圈",
  "wizard hat": "巫師帽",
  "wing ornament": "翅膀飾品",
  "ear ribbon": "耳朵緞帶",
  "goggles on headwear": "頭飾上的護目鏡",
  "tie clip": "領帶夾",
  "diagonal-striped necktie": "斜條紋領帶",
  "feather boa": "羽毛圍巾(boa)",
  "bat hair ornament": "蝙蝠髮飾",
  "whistle around neck": "頸掛哨子",
  "green hairband": "綠色髮箍",
  "white headband": "白色頭帶",
  "black headband": "黑色頭帶",
  "flower earrings": "花朵耳環",
  "thigh belt": "大腿皮帶",
  "button badge": "圓形別針徽章",
  "goggles around neck": "脖子上掛護目鏡",
  "bag charm": "包包吊飾",
  "o-ring bottom": "O環下身",
  "two-tone bow": "雙色蝴蝶結",
  "purple halo": "紫色光環",
  "white scrunchie": "白色髮圈(scrunchie)",
  "fur-trimmed hood": "毛皮滾邊兜帽",
  "checkered scarf": "棋盤格紋圍巾",
  "horseshoe ornament": "馬蹄鐵飾品",
  "white veil": "白色面紗",
  "domino mask": "多米諾面具",
  "pom pom hair ornament": "絨球髮飾",
  "single ear cover": "單邊耳罩",
  "horned headwear": "有角頭飾",
  "orange gloves": "橘色手套",
  "blue-framed eyewear": "藍框眼鏡",
  "nightcap": "睡帽",
  "sphere earrings": "球形耳環",
  "rabbit hood": "兔耳兜帽",
  "crescent earrings": "月牙耳環",
  "gas mask": "防毒面具",
  "strap between breasts": "肩帶夾在胸間",
  "black sash": "黑色腰帶(綢帶)",
  "medal": "獎牌／勳章",
  "loose belt": "寬鬆腰帶",
  "horn bow": "角上蝴蝶結",
  "chest belt": "胸前皮帶",
  "print bowtie": "印花領結",
  "plaid bowtie": "格紋領結",
  "plastic bag": "塑膠袋",
  "qingdai guanmao": "清代官帽",
  "pink scrunchie": "粉紅色髮圈(scrunchie)",
  "horned helmet": "有角頭盔",
  "shoulder spikes": "肩刺",
  "shoulder boards": "肩章板",
  "frilled ribbon": "荷葉邊緞帶",
  "purple scarf": "紫色圍巾",
  "over-rim eyewear": "半框眼鏡（over-rim eyewear）",
  "brown ribbon": "棕色緞帶",
  "ankle ribbon": "腳踝緞帶",
  "purple umbrella": "紫色傘",
  "single pauldron": "單邊肩甲",
  "yellow scrunchie": "黃色髮圈(scrunchie)",
  "red umbrella": "紅色傘",
  "single hair ring": "單邊髮環",
  "clover hair ornament": "三葉草髮飾",
  "porkpie hat": "豬肉派帽",
  "neck ruff": "皺領(拉夫領)",
  "black halo": "黑色光環",
  "snowflake hair ornament": "雪花髮飾",
  "large hat": "大帽子",
  "grey halo": "灰色光環",
  "thumb ring": "拇指戒指",
  "gold bracelet": "金色手環",
  "plaid necktie": "格紋領帶",
  "pendant choker": "墜飾頸圈",
  "talisman": "護符",
  "duffel bag": "圓筒旅行包",
  "ear tag": "耳標",
  "feather earrings": "羽毛耳環",
  "orange-tinted eyewear": "橘色鏡片眼鏡",
  "ankle lace-up": "腳踝綁帶鞋",
  "grey bow": "灰色蝴蝶結",
  "red bag": "紅色包包",
  "pink-framed eyewear": "粉框眼鏡",
  "fur scarf": "毛皮圍巾",
  "grey neckerchief": "灰色領巾",
  "uneven gloves": "長短不一的手套",
  "safety pin": "別針",
  "brown sailor collar": "棕色水手領",
  "diamond hairband": "菱形髮箍",
  "aqua ribbon": "水藍色緞帶",
  "shako cap": "軍用高筒帽(shako)",
  "grey-framed eyewear": "灰框眼鏡",
  "pink bag": "粉紅色包包",
  "green neckerchief": "綠色領巾",
  "torpedo tubes": "魚雷發射管",
  "star halo": "星星光環",
  "blue sash": "藍色腰帶(綢帶)",
  "no eyewear": "沒戴眼鏡",
  "o-ring thigh strap": "O環大腿帶",
  "white sash": "白色腰帶(綢帶)",
  "red bandana": "紅色頭巾",
  "character hair ornament": "角色造型髮飾",
  "green choker": "綠色項圈式頸飾",
  "nose piercing": "鼻環（nose piercing）",
  "insignia": "徽記",
  "animal ear headwear": "動物耳頭飾",
  "yellow belt": "黃色腰帶",
  "cat hat": "貓耳帽",
  "gold necklace": "金色項鍊",
  "pith helmet": "殖民地盔(木髓盔)",
  "winged hat": "翼帽",
  "fanny pack": "腰包",
  "yellow-framed eyewear": "黃框眼鏡",
  "patch": "補丁／徽布",
  "cloth gag": "布塞口",
  "white-framed eyewear": "白框眼鏡",
  "transparent umbrella": "透明雨傘",
  "purple sailor collar": "紫色水手領",
  "orange scrunchie": "橘色髮圈(scrunchie)",
  "ankle cuffs": "腳踝束環",
  "purple gem": "紫色寶石",
  "heart o-ring": "愛心O環",
  "magatama necklace": "勾玉項鍊",
  "blue bag": "藍色包包",
  "carrot necklace": "紅蘿蔔項鍊",
  "star choker": "星星頸圈",
  "studded belt": "鉚釘腰帶",
  "red-tinted eyewear": "紅色鏡片眼鏡",
  "chest strap": "胸前綁帶",
  "grey necktie": "灰色領帶",
  "orange choker": "橘色項圈式頸飾",
  "white bag": "白色包包",
  "d-pad hair ornament": "十字鍵髮飾",
  "oni mask": "鬼面具",
  "gorget": "護喉甲",
  "thigh ribbon": "大腿緞帶",
  "alternate headwear": "替換頭飾",
  "sleeve garter": "袖箍",
  "black garter straps": "黑色吊襪帶",
  "plaid hat": "格紋帽子",
  "satchel": "郵差包／書包",
  "multicolored hairband": "多色髮箍",
  "school emblem": "校徽",
  "helm": "全罩式中世紀頭盔",
  "tam o' shanter": "蘇格蘭圓扁帽",
  "diving mask": "潛水鏡",
  "pearl": "珍珠",
  "orange neckerchief": "橘色領巾",
  "brown necktie": "棕色領帶",
  "shark hood": "鯊魚兜帽",
  "yellow choker": "黃色項圈式頸飾",
  "dynamax band": "極巨化手環",
  "tail bell": "尾巴鈴鐺",
  "single fingerless glove": "單邊無指手套",
  "sweatband": "吸汗帶",
  "see-through veil": "透視面紗",
  "fish hair ornament": "魚造型髮飾",
  "orange scarf": "橘色圍巾",
  "purple belt": "紫色腰帶",
  "lip piercing": "唇環",
  "bear hair ornament": "熊髮飾",
  "dalachi (headdress)": "大拉翅",
  "condom packet strip": "保險套包裝條",
  "winged helmet": "翼盔",
  "brown hairband": "棕色髮箍",
  "party hat": "派對帽",
  "black garter belt": "黑色吊襪帶腰帶",
  "mouth veil": "口罩面紗",
  "utility belt": "工具腰帶",
  "leg belt": "腿部皮帶",
  "grey scarf": "灰色圍巾",
  "eyebrow piercing": "眉環",
  "two-tone ribbon": "雙色緞帶",
  "gold hairband": "金色髮箍",
  "spiked armlet": "尖刺臂環",
  "space helmet": "太空頭盔",
  "hair through headwear": "頭髮穿出帽子",
  "star necklace": "星星項鍊",
  "fake wings": "假翅膀",
  "heart button": "愛心鈕扣",
  "blue headband": "藍色頭帶",
  "striped gloves": "條紋手套",
  "multicolored bow": "多色蝴蝶結",
  "pink belt": "粉紅色腰帶",
  "two-tone bowtie": "雙色領結",
  "single gauntlet": "單邊護手甲",
  "flower ornament": "花朵飾品",
  "square-end necktie": "平頭領帶",
  "arm wrap": "手臂纏布",
  "claw ring": "爪形戒指",
  "checkered necktie": "棋盤格紋領帶",
  "leather belt": "皮革腰帶",
  "skull earrings": "骷髏耳環",
  "tricorne": "三角帽",
  "yellow sash": "黃色腰帶(綢帶)",
  "animal bag": "動物包包",
  "blue collar": "藍色項圈／衣領",
  "multiple piercings": "多重穿孔",
  "shoulder strap": "單肩背帶",
  "yellow bag": "黃色包包",
  "red hood": "紅色兜帽",
  "loose bowtie": "寬鬆領結",
  "ribbon-trimmed collar": "緞帶滾邊項圈／衣領",
  "pillbox hat": "圓筒小帽(pillbox)",
  "frilled cuffs": "荷葉邊袖口",
  "pink sailor collar": "粉紅色水手領",
  "unworn bag": "未穿戴的包包",
  "fake antlers": "假鹿角",
  "bowl hat": "碗帽",
  "dixie cup hat": "海軍水兵帽",
  "triangle earrings": "三角形耳環",
  "gold choker": "金色項圈式頸飾",
  "bow earrings": "蝴蝶結耳環",
  "blue-tinted eyewear": "藍色鏡片眼鏡",
  "horns through headwear": "角穿出帽子",
  "purple-tinted eyewear": "紫色鏡片眼鏡",
  "pink collar": "粉紅色項圈／衣領",
  "aqua neckerchief": "水藍色領巾",
  "yellow armband": "黃色臂章／臂環",
  "eyewear on headwear": "眼鏡戴在帽子上",
  "respirator": "呼吸防護面罩",
  "fur-trimmed collar": "毛皮滾邊項圈／衣領",
  "combat helmet": "戰鬥頭盔",
  "used tissue": "用過的衛生紙",
  "ammunition pouch": "彈藥袋",
  "bow choker": "蝴蝶結頸圈",
  "grey belt": "灰色腰帶",
  "brown-framed eyewear": "棕框眼鏡",
  "striped headwear": "條紋頭飾／頭戴物",
  "skull mask": "骷髏面具",
  "ankle strap": "腳踝綁帶",
  "wrist guards": "護腕（wrist guards）",
  "neck flower": "頸部花飾",
  "green-framed eyewear": "綠框眼鏡",
  "unworn gloves": "未穿戴的手套",
  "linked piercing": "相連穿孔",
  "undone necktie": "鬆開的領帶",
  "brown bowtie": "棕色領結",
  "sleep mask": "睡眠眼罩",
  "gold crown": "金色皇冠",
  "triangle hair ornament": "三角形髮飾",
  "industrial piercing": "工業型穿環",
  "open belt": "敞開的腰帶",
  "pink-tinted eyewear": "粉色鏡片眼鏡",
  "sleeve bow": "袖子蝴蝶結",
  "bolo tie": "波羅領帶",
  "broken halo": "破損光環",
  "single strap": "單邊肩帶／綁帶",
  "moon (ornament)": "月亮飾品",
  "lube": "潤滑液",
  "fishnet gloves": "網狀手套",
  "rider belt": "騎士腰帶",
  "eyewear strap": "眼鏡繩",
  "cross tie": "交叉領帶",
  "tube": "管狀物",
  "magatama earrings": "勾玉耳環",
  "white headdress": "白色頭飾",
  "sunflower hair ornament": "向日葵髮飾",
  "candy hair ornament": "糖果髮飾",
  "mask around neck": "口罩掛脖子",
  "grey ribbon": "灰色緞帶",
  "white garter straps": "白色吊襪帶",
  "two-tone headwear": "雙色頭飾／頭戴物",
  "orange sailor collar": "橘色水手領",
  "pearl earrings": "珍珠耳環",
  "leather gloves": "皮革手套",
  "green bag": "綠色包包",
  "spiked choker": "尖刺項圈式頸飾",
  "deerstalker": "獵鹿帽",
  "white mask": "白色面具／口罩",
  "bandaid hair ornament": "OK繃髮飾",
  "shin guards": "護脛",
  "purple neckerchief": "紫色領巾",
  "earth (ornament)": "地球飾品",
  "pearl bracelet": "珍珠手環",
  "white umbrella": "白色傘",
  "spiked halo": "尖刺光環",
  "tail piercing": "尾巴穿孔",
  "diagonal-striped bowtie": "斜條紋領結",
  "crime prevention buzzer": "防身警報器",
  "orange headband": "橘色頭帶",
  "pink wrist cuffs": "粉紅色腕套(袖口)",
  "key necklace": "鑰匙項鍊",
  "aqua hat": "水藍色帽子",
  "kepi": "平頂軍帽(kepi)",
  "huge bow": "超大蝴蝶結",
  "kurokote": "黑小手（護手）",
  "lace choker": "蕾絲頸圈",
  "no gloves": "沒戴手套",
  "star brooch": "星星胸針",
  "snorkel": "呼吸管",
  "purple sash": "紫色腰帶(綢帶)",
  "white hood": "白色兜帽",
  "noh mask": "能劇面具",
  "food-themed earrings": "食物主題耳環",
  "tulip hat": "鬱金香帽",
  "clitoral piercing": "陰蒂穿孔",
  "lapel pin": "翻領別針",
  "plume": "羽飾",
  "ninja mask": "忍者面罩",
  "orange ascot": "橘色領巾(ascot)",
  "hauchiwa": "羽團扇",
  "condom belt": "保險套腰帶",
  "coif": "頭巾帽(coif)",
  "frilled ascot": "荷葉邊領巾(ascot)",
  "torn scarf": "破損的圍巾",
  "sleeve ribbon": "袖子緞帶",
  "strawberry hair ornament": "草莓髮飾",
  "blue helmet": "藍色頭盔",
  "trash bag": "垃圾袋",
  "dice hair ornament": "骰子髮飾",
  "purple scrunchie": "紫色髮圈(scrunchie)",
  "print headwear": "印花頭飾",
  "two-tone hairband": "雙色髮箍",
  "red mask": "紅色面具／口罩",
  "neck tassel": "頸部流蘇",
  "motorcycle helmet": "機車安全帽",
  "arched crown": "拱形王冠",
  "nejiri hachimaki": "扭轉頭巾(捻り鉢巻)",
  "pink ascot": "粉紅色領巾(ascot)",
  "diving mask on head": "潛水鏡推到頭上",
  "papakha": "高加索毛帽(papakha)",
  "grey hairband": "灰色髮箍",
  "lace-trimmed gloves": "蕾絲滾邊手套",
  "polka dot headwear": "圓點頭飾／頭戴物",
  "scarf over mouth": "圍巾遮嘴",
  "wig": "假髮",
  "wrist bow": "手腕蝴蝶結",
  "cat ear hairband": "貓耳髮箍",
  "black bridal gauntlets": "黑色新娘袖套",
  "torn gloves": "破損的手套",
  "ammunition belt": "彈鏈",
  "bird mask": "鳥面具",
  "blue armband": "藍色臂章／臂環",
  "coin on string": "繩上硬幣",
  "single epaulette": "單邊肩章",
  "pointed crown": "尖頂皇冠",
  "green belt": "綠色腰帶",
  "tail ring": "尾環",
  "bicorne": "雙角帽",
  "lace gloves": "蕾絲手套",
  "shoulder sash": "斜肩綬帶",
  "boobplate": "胸型鎧甲",
  "crystal earrings": "水晶耳環",
  "no mask": "沒戴面具",
  "heart collar": "愛心項圈",
  "purple ascot": "紫色領巾(ascot)",
  "anchor necklace": "船錨項鍊",
  "black umbrella": "黑色傘",
  "multicolored hat": "多色帽子",
  "head chain": "頭鍊",
  "green armband": "綠色臂章／臂環",
  "footwear ribbon": "鞋上緞帶",
  "bandolier": "斜背彈帶",
  "brown choker": "棕色項圈式頸飾",
  "grocery bag": "購物袋（grocery bag）",
  "smokestack hair ornament": "煙囪髮飾",
  "egg hair ornament": "蛋造型髮飾",
  "aviator sunglasses": "飛行員太陽眼鏡",
  "hexagon hair ornament": "六角形髮飾",
  "chain headband": "鏈條頭帶",
  "usekh collar": "古埃及寬項圈",
  "flower choker": "花朵頸圈",
  "chinese hairpin": "中式髮簪",
  "single wrist cuff": "單邊腕套(袖口)",
  "chinstrap": "下巴帶",
  "anchor choker": "船錨頸圈",
  "horn hairband": "角髮箍",
  "single hair tube": "單邊髮管",
  "floating scarf": "飄浮的圍巾",
  "multiple bracelets": "多個手環",
  "orange belt": "橘色腰帶",
  "wrist wrap": "手腕纏布",
  "studded bracelet": "鉚釘手環",
  "shoulder holster": "肩掛槍套",
  "couter": "肘甲",
  "teardrop earrings": "水滴耳環",
  "flower brooch": "花朵胸針",
  "cross choker": "十字架頸圈",
  "star ornament": "星形裝飾",
  "blue hood": "藍色兜帽",
  "messenger bag": "郵差包",
  "frilled sailor collar": "荷葉邊水手領",
  "coin hair ornament": "硬幣髮飾",
  "pill earrings": "藥丸耳環",
  "striped hairband": "條紋髮箍",
  "amulet": "護身符",
  "ornate ring": "華麗戒指",
  "brown collar": "棕色項圈／衣領",
  "white halo": "白色光環",
  "toe ring": "趾環",
  "gift bag": "禮物袋",
  "horn ring": "角環",
  "fake claws": "假爪",
  "red mittens": "紅色連指手套",
  "lace-trimmed choker": "蕾絲滾邊項圈式頸飾",
  "aqua gloves": "水藍色手套",
  "sideways hat": "側戴帽",
  "ribbon-trimmed headwear": "緞帶滾邊頭飾／頭戴物",
  "yellow-tinted eyewear": "黃色鏡片眼鏡",
  "flower bracelet": "花朵手環",
  "white mittens": "白色連指手套",
  "black helmet": "黑色頭盔",
  "shoulder cannon": "肩載砲",
  "purple-framed eyewear": "紫框眼鏡",
  "unworn backpack": "未穿戴的背包",
  "single garter strap": "單邊吊襪帶",
  "white garter belt": "白色吊襪帶腰帶",
  "ear protection": "護耳罩",
  "halo behind head": "頭後光環",
  "pearl hair ornament": "珍珠髮飾",
  "checkered sash": "棋盤格紋腰帶(綢帶)",
  "cherry hair ornament": "櫻桃髮飾",
  "rope belt": "繩腰帶",
  "medallion": "大型獎章墜飾",
  "blue bandana": "藍色頭巾",
  "green scrunchie": "綠色髮圈(scrunchie)",
  "lace-trimmed hairband": "蕾絲滾邊髮箍",
  "four-leaf clover hair ornament": "四葉草髮飾",
  "multicolored scarf": "多色圍巾",
  "print necktie": "印花領帶",
  "multicolored hair bobbles": "多色小球髮飾",
  "half mask": "半臉面具",
  "shell necklace": "貝殼項鍊",
  "heart pendant": "愛心墜飾",
  "arm cuffs": "臂環（arm cuffs）",
  "black armband": "黑色臂章／臂環",
  "heart-shaped buckle": "愛心扣環",
  "black hood": "黑色兜帽",
  "o-ring belt": "O環腰帶",
  "red helmet": "紅色頭盔",
  "spiked hairband": "尖刺髮箍",
  "shoulder belt": "肩帶式皮帶",
  "diamond hair ornament": "菱形髮飾",
  "white helmet": "白色頭盔",
  "pink gem": "粉紅色寶石",
  "red crown": "紅色皇冠",
  "green-tinted eyewear": "綠色鏡片眼鏡",
  "white bonnet": "白色軟帽(bonnet)",
  "blue umbrella": "藍色傘",
  "purple collar": "紫色項圈／衣領",
  "pink umbrella": "粉紅色傘",
  "shell hair ornament": "貝殼髮飾",
  "hat with ears": "帶耳朵的帽子",
  "bowler hat": "圓頂硬禮帽",
  "skull ornament": "骷髏飾品",
  "biting glove": "咬手套",
  "rabbit hat": "兔子帽",
  "pink sash": "粉紅色腰帶(綢帶)",
  "kabuto (helmet)": "兜(日本武士頭盔)",
  "melting halo": "融化的光環",
  "skirt bow": "裙上蝴蝶結",
  "eyelash ornament": "睫毛裝飾",
  "mitre": "主教冠(米特拉)",
  "green headband": "綠色頭帶",
  "single arm warmer": "單邊袖套",
  "single knee pad": "單邊護膝",
  "penguin hood": "企鵝連帽",
  "sam browne belt": "山姆布朗腰帶",
  "skull necklace": "骷髏項鍊",
  "dilation tape": "擴張膠帶",
  "polka dot scrunchie": "圓點髮圈(scrunchie)",
  "wataboushi": "綿帽子",
  "wing brooch": "翅膀胸針",
  "plaid ribbon": "格紋緞帶",
  "female service cap": "女性制服帽",
  "cat bag": "貓咪包",
  "yellow gem": "黃色寶石",
  "pom pom beanie": "絨球毛帽",
  "polka dot ribbon": "圓點緞帶",
  "frilled headwear": "荷葉邊頭飾／頭戴物",
  "bikini skirt": "裙式比基尼",
  "sarong": "紗龍裙",
  "red pants": "紅色長褲",
  "cutoffs": "割邊牛仔短褲",
  "showgirl skirt": "歌舞女郎裙",
  "green pants": "綠色長褲",
  "torn pants": "破損的長褲",
  "blue buruma": "藍色燈籠運動褲",
  "red buruma": "紅色燈籠運動褲",
  "track pants": "運動長褲",
  "baggy pants": "寬鬆垮長褲",
  "bike shorts under skirt": "裙下穿單車短褲",
  "gym shorts": "運動短褲",
  "multicolored skirt": "多色裙子",
  "checkered skirt": "棋盤格紋裙子",
  "tight pants": "緊身長褲",
  "two-tone skirt": "雙色裙子",
  "purple pants": "紫色長褲",
  "striped pants": "條紋長褲",
  "open shorts": "敞開的短褲",
  "torn shorts": "破損的短褲",
  "vertical-striped skirt": "直條紋裙子",
  "see-through skirt": "透視裙子",
  "open skirt": "敞開的裙子",
  "plaid pants": "格紋長褲",
  "black buruma": "黑色燈籠運動褲",
  "chaps": "皮護腿褲(chaps)",
  "open pants": "敞開的長褲",
  "puffy pants": "蓬蓬褲",
  "fur-trimmed skirt": "毛皮滾邊裙子",
  "yellow pants": "黃色長褲",
  "frilled shorts": "荷葉邊短褲",
  "orange pants": "橘色長褲",
  "single pantsleg": "單邊褲管",
  "harem pants": "阿拉丁褲",
  "torn jeans": "破損的牛仔褲",
  "lace-trimmed skirt": "蕾絲滾邊裙子",
  "overall shorts": "吊帶短褲（overall shorts）",
  "fur-trimmed shorts": "毛皮滾邊短褲",
  "camouflage pants": "迷彩褲",
  "kimono skirt": "和服裙",
  "vertical-striped pants": "直條紋長褲",
  "lowleg pants": "低腰長褲",
  "side slit shorts": "側開衩短褲",
  "print shorts": "印花短褲",
  "leather pants": "皮革長褲",
  "polka dot skirt": "圓點裙子",
  "cargo pants": "工作褲(口袋褲)",
  "bike shorts under shorts": "短褲下穿自行車褲",
  "pants under skirt": "裙下穿褲",
  "white sarong": "白色紗龍裙",
  "half-skirt": "半裙(單側開高衩裙)",
  "blue sarong": "藍色紗龍裙",
  "green kimono": "綠色和服",
  "black armor": "黑色盔甲",
  "yellow kimono": "黃色和服",
  "black corset": "黑色束腰",
  "frilled kimono": "荷葉邊和服",
  "hagoromo": "羽衣",
  "orange kimono": "橘色和服",
  "red armor": "紅色盔甲",
  "brown kimono": "棕色和服",
  "grey kimono": "灰色和服",
  "blue armor": "藍色盔甲",
  "checkered kimono": "棋盤格紋和服",
  "striped kimono": "條紋和服",
  "white armor": "白色盔甲",
  "gold armor": "金色盔甲",
  "fur-trimmed kimono": "毛皮滾邊和服",
  "sideless kimono": "側面鏤空和服",
  "leg armor": "腿部護甲",
  "brown corset": "棕色束腰",
  "arm armor": "手臂護甲",
  "multicolored kimono": "多色和服",
  "green hakama": "綠色袴",
  "hanten (clothes)": "半纏(日式短外褂)",
  "body armor": "防彈衣",
  "pink hakama": "粉紅色袴",
  "purple hakama": "紫色袴",
  "vertical-striped kimono": "直條紋和服",
  "clothes writing": "衣服上的文字",
  "drawstring": "抽繩",
  "center frills": "中央荷葉邊",
  "center opening": "中央開口",
  "bikini under clothes": "衣服下穿比基尼",
  "lowleg": "低腰設計",
  "star print": "星星圖樣",
  "paw print": "爪印圖樣",
  "hip vent": "腰側開衩",
  "clothes around waist": "衣服綁在腰間",
  "v-neck": "V領",
  "see-through sleeves": "透視袖子",
  "coat on shoulders": "外套披肩（coat on shoulders）",
  "heart cutout": "愛心鏤空",
  "unworn skirt": "未穿戴的裙子",
  "low neckline": "低領口",
  "heart print": "愛心圖樣",
  "leotard under clothes": "衣服下穿緊身衣",
  "jacket partially removed": "外套半脫",
  "asymmetrical sleeves": "不對稱袖子",
  "unworn clothes": "未穿戴的衣服",
  "unworn jacket": "未穿戴的夾克",
  "see-through cleavage": "透視乳溝",
  "covered collarbone": "被遮住的鎖骨",
  "coattails": "燕尾（後擺）",
  "notched lapels": "平駁領",
  "rose print": "玫瑰圖樣",
  "cat cutout": "貓形鏤空",
  "underboob cutout": "下乳鏤空",
  "see-through silhouette": "透視剪影",
  "american flag print": "美國國旗圖樣",
  "sideless outfit": "側面鏤空服裝",
  "jacket around waist": "外套綁在腰間",
  "fruit print": "水果圖樣",
  "unworn shirt": "未穿戴的襯衫",
  "dragon print": "龍圖樣",
  "wet swimsuit": "濕透的泳衣",
  "spider web print": "蜘蛛網圖樣",
  "borrowed clothes": "借來的衣服",
  "undersized clothes": "過小的衣服",
  "rabbit print": "兔圖樣",
  "bodysuit under clothes": "衣服下穿連身緊身衣",
  "character print": "角色圖樣",
  "snowflake print": "雪花圖樣",
  "enpera": "圍巾上蓬髮(enpera)",
  "shared clothes": "共穿衣物",
  "stomach cutout": "腹部鏤空",
  "skull print": "骷髏圖樣",
  "cat print": "貓圖樣",
  "uneven sleeves": "長短不一的袖子",
  "butterfly print": "蝴蝶圖樣",
  "dirty clothes": "髒衣服",
  "spandex": "萊卡彈性纖維",
  "diamond cutout": "菱形鏤空",
  "ofuda on clothes": "衣服上的符咒",
  "feather-trimmed sleeves": "羽毛滾邊袖",
  "constellation print": "星座圖樣",
  "single vertical stripe": "單條直條紋",
  "sweater around waist": "毛衣綁在腰間",
  "loose clothes": "寬鬆衣服",
  "fine fabric emphasis": "薄布料強調",
  "front slit": "前開衩",
  "strawberry print": "草莓圖樣",
  "thigh cutout": "大腿鏤空",
  "clover print": "三葉草圖樣",
  "flame print": "火焰圖樣",
  "yellow trim": "黃色滾邊",
  "lace-trimmed sleeves": "蕾絲滾邊袖子",
  "unworn bikini top": "未穿戴的比基尼上衣",
  "cutout above navel": "肚臍上方鏤空",
  "snap-fit buckle": "塑膠卡扣",
  "single off shoulder": "單邊露肩",
  "ribbed sleeves": "羅紋袖子",
  "yellow sleeves": "黃色袖子",
  "shorts under dress": "洋裝下穿短褲",
  "ass cutout": "臀部鏤空",
  "full-length zipper": "全長拉鍊",
  "pants rolled up": "捲起褲管",
  "mismatched sleeves": "左右不一致的袖子",
  "sweaty clothes": "汗濕的衣服",
  "single horizontal stripe": "單條橫條紋",
  "food-themed clothes": "食物主題衣服",
  "pinching sleeves": "捏著袖口",
  "triangle print": "三角形圖樣",
  "single stripe": "單條條紋",
  "fish print": "魚圖樣",
  "pants tucked in": "褲腳塞進鞋裡",
  "red trim": "紅色滾邊",
  "brown sleeves": "棕色袖子",
  "burnt clothes": "燒焦的衣服",
  "unworn coat": "未穿戴的大衣",
  "clothes between thighs": "衣物夾在大腿間",
  "armpit cutout": "腋下鏤空",
  "expressive clothes": "會表情的衣服",
  "anchor print": "船錨圖樣",
  "frog print": "青蛙圖樣",
  "cross-laced sleeves": "交叉綁帶袖子",
  "unworn dress": "未穿戴的洋裝",
  "sparkle print": "閃亮圖樣",
  "silver trim": "銀色滾邊",
  "baggy clothes": "寬鬆垮衣服",
  "white trim": "白色滾邊",
  "cardigan around waist": "開襟衫綁在腰間",
  "orange sleeves": "橘色袖子",
  "unworn swimsuit": "未穿戴的泳衣",
  "double vertical stripe": "雙直條紋",
  "unzipping": "拉下拉鍊",
  "crotch cutout": "胯部鏤空",
  "skirt cutout": "裙子鏤空",
  "cross-laced slit": "交叉綁帶開衩",
  "wet dress": "濕透的洋裝",
  "torn bodystocking": "破損的連身網襪",
  "jacket over swimsuit": "泳衣外罩外套",
  "houndstooth": "千鳥格紋",
  "print sleeves": "印花袖套",
  "puff and slash sleeves": "切口澎澎袖",
  "skirt under dress": "洋裝下穿裙",
  "see-through body": "透視身體",
  "patchwork clothes": "拼布衣物",
  "embroidery": "刺繡",
  "object in pocket": "口袋裡有物品",
  "wringing clothes": "擰衣服",
  "double horizontal stripe": "雙橫條紋",
  "shorts around one leg": "短褲掛在單腳",
  "sayagata": "紗綾形",
  "square neckline": "方領",
  "exposed pocket": "露出口袋布",
  "unworn shoes": "未穿戴的鞋子",
  "uwabaki": "室內鞋",
  "tengu-geta": "天狗木屐",
  "grey boots": "灰色靴子",
  "purple boots": "紫色靴子",
  "rudder footwear": "舵型鞋（艦娘）",
  "green boots": "綠色靴子",
  "yellow boots": "黃色靴子",
  "multicolored shoes": "多色鞋子",
  "unworn boots": "未穿戴的靴子",
  "unworn sandals": "未穿戴的涼鞋",
  "fold-over boots": "折邊靴",
  "orange boots": "橘色靴子",
  "leather boots": "皮革靴子",
  "multicolored boots": "多色靴子",
  "gladiator sandals": "羅馬涼鞋",
  "combat boots": "軍靴",
  "two-tone shoes": "雙色鞋子",
  "belt boots": "皮帶靴",
  "cowboy boots": "牛仔靴",
  "single boot": "單邊單隻靴子",
  "cross-laced shoes": "交叉綁帶鞋子",
  "ice skates": "溜冰鞋（ice skates）",
  "animal slippers": "動物拖鞋",
  "crocs": "洞洞鞋",
  "barefoot sandals (jewelry)": "赤足涼鞋(足飾)",
  "blue sandals": "藍色涼鞋",
  "high tops": "高筒運動鞋",
  "dress shoes": "皮鞋(正裝鞋)",
  "wedge heels": "楔型鞋跟",
  "two-tone boots": "雙色靴子",
  "fur boots": "毛皮靴",
  "open-toe shoes": "露趾鞋",
  "pink slippers": "粉紅色拖鞋",
  "winged shoes": "帶翅膀的鞋",
  "aqua shoes": "水藍色鞋子",
  "frilled thigh strap": "荷葉邊大腿綁帶",
  "thighlet": "大腿金屬環",
  "grey thighhighs": "灰色過膝襪",
  "vertical-striped thighhighs": "直條紋過膝襪",
  "grey pantyhose": "灰色連褲襪",
  "blue socks": "藍色襪子",
  "single sock": "單邊單隻襪子",
  "striped socks": "條紋襪子",
  "thigh holster": "大腿槍套",
  "print pantyhose": "印花連褲襪",
  "single leg pantyhose": "單邊單腿連褲襪",
  "no socks": "不穿襪子",
  "cow print thighhighs": "乳牛紋過膝襪",
  "grey socks": "灰色襪子",
  "red socks": "紅色襪子",
  "ribbon-trimmed thighhighs": "緞帶滾邊過膝襪",
  "black leggings": "黑色緊身褲",
  "single kneehigh": "單邊及膝襪",
  "american flag legwear": "美國國旗圖案腿部穿著",
  "frilled socks": "荷葉邊襪子",
  "pink socks": "粉紅色襪子",
  "alternate legwear": "替換腿部穿著",
  "thigh pouch": "大腿小包",
  "brown socks": "棕色襪子",
  "see-through legwear": "透視腿部穿著",
  "green socks": "綠色襪子",
  "fur-trimmed legwear": "毛皮滾邊腿部穿著",
  "multicolored thighhighs": "多色過膝襪",
  "vertical-striped pantyhose": "直條紋連褲襪",
  "argyle thighhighs": "菱格紋過膝襪",
  "ribbed socks": "羅紋襪子",
  "unworn socks": "未穿戴的襪子",
  "purple socks": "紫色襪子",
  "orange pantyhose": "橘色連褲襪",
  "yellow socks": "黃色襪子",
  "green pantyhose": "綠色連褲襪",
  "white leggings": "白色緊身褲",
  "gradient legwear": "漸層腿部穿著",
  "animal ear legwear": "動物耳造型襪",
  "two-tone legwear": "雙色腿部穿著",
  "shiny legwear": "光澤腿部服裝",
  "thighhighs over pantyhose": "連褲襪外穿過膝襪",
  "high-waist pantyhose": "高腰連褲襪",
  "single thigh boot": "單邊過膝靴",
  "leg wrap": "腿部纏布",
  "orange socks": "橘色襪子",
  "cat ear legwear": "貓耳襪",
  "yellow pantyhose": "黃色連褲襪",
  "white leg warmers": "白色腿套",
  "bridal legwear": "新娘襪",
  "fur-trimmed thighhighs": "毛皮滾邊過膝襪",
  "fishnet socks": "網狀襪子",
  "vertical-striped socks": "直條紋襪子",
  "detached leggings": "分離式緊身褲",
  "cross-laced legwear": "交叉綁帶腿部穿著",
  "white apron": "白色圍裙",
  "skirt set": "裙子套裝",
  "winter uniform": "冬季制服",
  "summer uniform": "夏季制服",
  "black serafuku": "黑色水手服",
  "impossible clothes": "極度緊繃的衣服",
  "print bikini": "印花比基尼",
  "tracen school uniform": "特雷森學園制服",
  "yellow bikini": "黃色比基尼",
  "highleg bikini": "高叉比基尼",
  "green bikini": "綠色比基尼",
  "kita high school uniform": "北高制服",
  "mitakihara school uniform": "見瀧原中學制服",
  "white bodysuit": "白色連身緊身衣",
  "sakuragaoka high school uniform": "櫻丘高中制服",
  "ooarai school uniform": "大洗女子學園制服",
  "multicolored dress": "多色洋裝",
  "black suit": "黑色西裝",
  "male swimwear": "男用泳裝",
  "bikini bottom only": "只穿比基尼下身",
  "multi-strapped bikini bottom": "多綁帶比基尼下身",
  "sailor senshi uniform": "水手戰士制服",
  "competition school swimsuit": "競速型學校泳衣",
  "tokiwadai school uniform": "常盤台中學制服",
  "otonokizaka school uniform": "音乃木坂學院制服",
  "cow print bikini": "乳牛紋比基尼",
  "old school swimsuit": "舊式學校泳衣",
  "thong bikini": "丁字褲比基尼",
  "purple leotard": "紫色緊身連衣褲(leotard)",
  "vertical-striped dress": "直條紋洋裝",
  "white robe": "白色長袍",
  "multicolored bikini": "多色比基尼",
  "torn dress": "破損的洋裝",
  "orange bikini": "橘色比基尼",
  "garreg mach monastery uniform": "加爾格．馬克修道院制服",
  "lowleg bikini": "低腰比基尼",
  "strapless bikini": "無肩帶比基尼",
  "tracen training uniform": "特雷森訓練服",
  "polka dot bikini": "圓點比基尼",
  "pink leotard": "粉紅色緊身連衣褲(leotard)",
  "black robe": "黑色長袍",
  "demon slayer uniform": "鬼殺隊制服",
  "blue serafuku": "藍色水手服",
  "multicolored bodysuit": "多色連身緊身衣",
  "ryouou school uniform": "陵桜學園制服",
  "frilled one-piece swimsuit": "荷葉邊連身泳衣",
  "maid bikini": "女僕比基尼",
  "green leotard": "綠色緊身連衣褲(leotard)",
  "see-through dress": "透視洋裝",
  "eyepatch bikini": "眼罩式比基尼",
  "purple bodysuit": "紫色連身緊身衣",
  "blue overalls": "藍色吊帶褲",
  "swim trunks": "泳褲",
  "pink apron": "粉紅色圍裙",
  "two-tone swimsuit": "雙色泳衣",
  "open dress": "敞開的洋裝",
  "layered bikini": "層疊比基尼",
  "tokyo-3 middle school uniform": "第3新東京市中學制服",
  "uranohoshi school uniform": "浦之星女學院制服",
  "gekkoukan high school uniform": "月光館學園制服",
  "sleepwear": "睡衣類",
  "paradis military uniform": "帕拉迪島軍服",
  "nanamori school uniform": "七森中學制服",
  "american flag dress": "美國國旗圖案洋裝",
  "black apron": "黑色圍裙",
  "ribbed dress": "羅紋洋裝",
  "pirate costume": "海盜裝",
  "two-tone bikini": "雙色比基尼",
  "multicolored swimsuit": "多色泳衣",
  "orange bodysuit": "橘色連身緊身衣",
  "sailor bikini": "水手比基尼",
  "blue apron": "藍色圍裙",
  "asticassia school uniform": "阿斯提卡西亞學園制服",
  "mismatched bikini": "左右不一致的比基尼",
  "american flag bikini": "美國國旗圖案比基尼",
  "meiji schoolgirl uniform": "明治女學生制服",
  "bow bikini": "蝴蝶結比基尼",
  "pink bodysuit": "粉紅色連身緊身衣",
  "shimakaze (kancolle) (cosplay)": "島風（艦これ）角色扮演",
  "white suit": "白色西裝",
  "kuromorimine military uniform": "黑森峰軍服",
  "kitauji high school uniform": "北宇治高中制服",
  "gem uniform (houseki no kuni)": "寶石制服（寶石之國）",
  "gold bikini": "金色比基尼",
  "impossible bodysuit": "極度緊繃的連身緊身衣",
  "ruffle bikini": "荷葉邊比基尼（ruffle bikini）",
  "hasu no sora school uniform": "蓮之空女學院制服",
  "zero suit": "零式裝甲",
  "backless leotard": "露背緊身連衣褲(leotard)",
  "white romper": "白色連身短褲",
  "aqua bikini": "水藍色比基尼",
  "nijigasaki school uniform": "虹咲學園制服",
  "santa bikini": "聖誕老人比基尼",
  "naoetsu high school uniform": "直江津高中制服",
  "plaid bikini": "格紋比基尼",
  "purple serafuku": "紫色水手服",
  "see-through leotard": "透視緊身連衣褲(leotard)",
  "st. gloriana's school uniform": "聖葛洛莉安娜女學院制服",
  "millennium cheerleader outfit (blue archive)": "千年啦啦隊服（蔚藍檔案）",
  "little busters! school uniform": "Little Busters! 學校制服",
  "impossible leotard": "極度緊繃的緊身連衣褲",
  "turtleneck leotard": "高領緊身衣(leotard)",
  "lycoris uniform": "莉可麗絲制服",
  "impossible dress": "極度緊繃的洋裝",
  "bondage outfit": "束縛風服裝",
  "ooarai military uniform": "大洗軍服",
  "shuuchiin academy school uniform": "秀知院學園制服",
  "champion's tunic (zelda)": "勇者之服（薩爾達）",
  "green apron": "綠色圍裙",
  "hikarizaka private high school uniform": "光坂高中制服",
  "side-tie leotard": "側綁緊身衣",
  "pink pajamas": "粉紅色睡衣",
  "tactical clothes": "戰術服",
  "impossible swimsuit": "極度緊繃的泳衣",
  "multicolored leotard": "多色緊身連衣褲(leotard)",
  "st. gloriana's military uniform": "聖葛洛莉安娜軍服",
  "anzio school uniform": "安齊奧高中制服",
  "tankini": "背心式比基尼",
  "hooded robe": "連帽長袍",
  "yasogami school uniform": "八十神高中制服",
  "male playboy bunny": "男性兔女郎",
  "kibito high school uniform": "私立吉備人高中制服",
  "two-tone bodysuit": "雙色連身緊身衣",
  "green bodysuit": "綠色連身緊身衣",
  "gradient dress": "漸層洋裝",
  "vocaloid append": "Vocaloid Append",
  "rabbit house uniform": "兔子屋制服（點兵點將）",
  "blue robe": "藍色長袍",
  "reindeer costume": "馴鹿裝",
  "diving suit": "潛水衣（diving suit）",
  "embellished costume": "華麗改造服",
  "grey bodysuit": "灰色連身緊身衣",
  "red apron": "紅色圍裙",
  "yellow apron": "黃色圍裙",
  "off-shoulder bikini": "露肩比基尼",
  "brown apron": "棕色圍裙",
  "pink one-piece swimsuit": "粉紅色連身泳衣",
  "team rocket uniform": "火箭隊制服",
  "kuromorimine school uniform": "黑森峰女學園制服",
  "grey bikini": "灰色比基尼",
  "kigurumi": "著ぐるみ(連身布偶裝)",
  "u.a. school uniform": "雄英高中制服",
  "jujutsu tech uniform": "咒術高專制服",
  "hatsune miku (cosplay)": "初音未來角色扮演",
  "white serafuku": "白色水手服",
  "frilled leotard": "荷葉邊緊身連衣褲(leotard)",
  "yurigaoka girls academy school uniform": "百合丘女子學園制服",
  "hakurei reimu (cosplay)": "博麗靈夢角色扮演",
  "haneoka school uniform": "羽丘女子學園制服",
  "sakugawa school uniform": "佐久川中學制服",
  "brown bikini": "棕色比基尼",
  "oohashi high school uniform": "大橋高中制服",
  "two-tone leotard": "雙色緊身連衣褲(leotard)",
  "cross-laced dress": "交叉綁帶洋裝",
  "icho private high school uniform": "私立銀杏高中制服",
  "ribbon-trimmed dress": "緞帶滾邊洋裝",
  "a certain high school uniform": "某高中制服",
  "yellow bodysuit": "黃色連身緊身衣",
  "purple one-piece swimsuit": "紫色連身泳衣",
  "ribbed bodysuit": "羅紋連身緊身衣",
  "sleeved leotard": "有袖緊身衣",
  "athletic leotard": "運動緊身衣",
  "hanasakigawa school uniform": "花咲川女子學園制服",
  "sobu high school uniform": "總武高中制服",
  "power suit (metroid)": "動力服（銀河戰士）",
  "eden academy school uniform": "伊甸學院制服",
  "torn leotard": "破損的緊身連衣褲(leotard)",
  "naranja academy school uniform": "橙子學園制服",
  "ribbed leotard": "羅紋緊身連衣褲(leotard)",
  "new school swimsuit": "新式學校泳衣(新スク)",
  "yellow leotard": "黃色緊身連衣褲(leotard)",
  "shark costume": "鯊魚裝",
  "fourth east high school uniform": "第四東高中制服",
  "shinda sekai sensen uniform": "死後世界戰線制服",
  "vampire costume": "吸血鬼裝",
  "yuigaoka school uniform": "由比濱丘高中制服",
  "kiyosumi school uniform": "清澄高中制服",
  "mummy costume": "木乃伊裝",
  "kirin (armor)": "麒麟（防具）",
  "polka dot swimsuit": "圓點泳衣",
  "bikesuit": "機車騎士連身衣",
  "prison clothes": "囚服",
  "shell bikini": "貝殼比基尼",
  "kourindou tengu costume": "香霖堂天狗服",
  "loungewear": "居家服",
  "ghost costume": "幽靈裝",
  "tracen swimsuit": "特雷森泳裝",
  "brown leotard": "棕色緊身連衣褲(leotard)",
  "shuka high school uniform": "修學院高中制服",
  "tutu": "芭蕾蓬裙(tutu)",
  "shuujin academy school uniform": "修央學園制服",
  "wagnaria uniform": "華格納利亞制服",
  "nanairogaoka middle school uniform": "七色之丘中學制服",
  "power suit": "動力裝甲（power suit）",
  "uva academy school uniform": "UVA 學園制服",
  "aria company uniform": "ARIA Company 制服",
  "tight dress": "緊身洋裝",
  "kamiyama high school uniform (hyouka)": "神山高中制服（冰菓）",
  "two-sided dress": "雙面洋裝",
  "vertical-striped bikini": "直條紋比基尼",
  "hooded bodysuit": "連帽連身緊身衣",
  "griffin & kryuger military uniform": "格里芬&克魯格軍服",
  "pravda school uniform": "真理女子學園制服",
  "saiyan armor": "賽亞人戰鬥服",
  "swimsuit cover-up": "泳衣罩衫",
  "keizoku military uniform": "繼續高中軍服",
  "duel academy uniform (yu-gi-oh! gx)": "決鬥學院制服（遊戲王GX）",
  "alice (alice in wonderland) (cosplay)": "愛麗絲（愛麗絲夢遊仙境）角色扮演",
  "torn swimsuit": "破損的泳衣",
  "sukajan": "橫須賀夾克(sukajan)",
  "mash kyrielight (dangerous beast) (cosplay)": "瑪修．基列萊特（危險野獸）角色扮演",
  "blue pajamas": "藍色睡衣",
  "saunders military uniform": "薩德斯軍服",
  "grey leotard": "灰色緊身連衣褲(leotard)",
  "taimanin suit": "對魔忍緊身衣",
  "grey serafuku": "灰色水手服",
  "kamiyama high school uniform (project sekai)": "神山高中制服（世界計畫）",
  "coat dress": "大衣式洋裝",
  "bc freedom military uniform": "BC自由學園軍服",
  "bear costume": "熊裝",
  "ashford academy school uniform": "阿什佛德學園制服",
  "hooded dress": "連帽洋裝",
  "luna nova school uniform": "露娜諾瓦魔法學院制服",
  "grey suit": "灰色西裝",
  "miyamasuzaka girls' academy school uniform": "宮益坂女學院制服",
  "fleur de lapin uniform": "Fleur de Lapin 制服",
  "print leotard": "印花緊身衣",
  "strapless one-piece swimsuit": "無肩帶連身泳衣",
  "youtou high school uniform": "陽東高中制服",
  "virgin destroyer sweater": "破處毛衣(梗服飾)",
  "off-shoulder one-piece swimsuit": "露肩連身泳衣",
  "hogwarts school uniform": "霍格華茲制服",
  "self-cosplay": "自我角色扮演",
  "red robe": "紅色長袍",
  "wa lolita": "和風蘿莉塔服飾",
  "undersuit": "內層服",
  "amesuku gyaru": "美式休閒辣妹",
  "checkered dress": "棋盤格紋洋裝",
  "tokisadame school uniform": "時定高中制服",
  "anzio military uniform": "安齊奧軍服",
  "cat costume": "貓裝（cat costume）",
  "sophist's robe (ff14)": "詭辯者長袍（FF14）",
  "varia suit": "變異服（銀河戰士）",
  "orange leotard": "橘色緊身連衣褲(leotard)",
  "pinstripe suit": "細條紋西裝",
  "virgin killer outfit": "殺死處男的服裝(梗服飾)",
  "orange jumpsuit": "橘色連身衣",
  "black slingshot swimsuit": "黑色彈弓式泳衣",
  "black cape": "黑色披風",
  "white capelet": "白色短披肩",
  "white cape": "白色披風",
  "blue cape": "藍色披風",
  "multicolored jacket": "多色夾克",
  "collared jacket": "有領夾克",
  "black capelet": "黑色短披肩",
  "red capelet": "紅色短披肩",
  "waist cape": "腰間披風",
  "two-tone jacket": "雙色夾克",
  "black cloak": "黑色斗篷",
  "blue capelet": "藍色短披肩",
  "striped jacket": "條紋夾克",
  "hooded capelet": "連帽短披肩",
  "green cape": "綠色披風",
  "yellow cardigan": "黃色開襟針織衫",
  "white cloak": "白色斗篷",
  "purple cape": "紫色披風",
  "two-sided cape": "雙面披風",
  "red cloak": "紅色斗篷",
  "torn cape": "破損的披風",
  "two-sided jacket": "雙面夾克",
  "brown capelet": "棕色短披肩",
  "red hoodie": "紅色連帽衫",
  "hooded cape": "連帽披風",
  "green hoodie": "綠色連帽衫",
  "frilled capelet": "荷葉邊短披肩",
  "brown cape": "棕色披風",
  "yellow hoodie": "黃色連帽衫",
  "collared cape": "有領披風",
  "plaid jacket": "格紋夾克",
  "fur-trimmed cloak": "毛皮滾邊斗篷",
  "cropped hoodie": "短版連帽衫",
  "blue cloak": "藍色斗篷",
  "purple capelet": "紫色短披肩",
  "brown cloak": "棕色斗篷",
  "multicolored coat": "多色大衣",
  "stole": "披肩長巾",
  "purple hoodie": "紫色連帽衫",
  "print jacket": "印花外套",
  "green capelet": "綠色短披肩",
  "aqua jacket": "水藍色夾克",
  "brown hoodie": "棕色連帽衫",
  "orange hoodie": "橘色連帽衫",
  "no jacket": "沒穿外套",
  "pink capelet": "粉紅色短披肩",
  "sleeveless coat": "無袖大衣",
  "overcoat": "長大衣（overcoat）",
  "yellow cape": "黃色披風",
  "torn jacket": "破損的夾克",
  "off-shoulder jacket": "露肩夾克",
  "floating cape": "飄浮的披風",
  "hooded cardigan": "連帽開襟針織衫",
  "two-tone cape": "雙色披風",
  "blue tabard": "藍色無袖罩袍",
  "fur cape": "毛皮披風",
  "grey capelet": "灰色短披肩",
  "pink cape": "粉紅色披風",
  "tied jacket": "外套打結穿法",
  "vertical-striped jacket": "直條紋夾克",
  "two-tone hoodie": "雙色連帽衫",
  "grey cape": "灰色披風",
  "see-through jacket": "透視夾克",
  "striped hoodie": "條紋連帽衫",
  "two-sided coat": "雙面大衣",
  "green cloak": "綠色斗篷",
  "purple cardigan": "紫色開襟針織衫",
  "multicolored cape": "多色披風",
  "hooded track jacket": "連帽運動外套",
  "yellow raincoat": "黃色雨衣",
  "print hoodie": "印花連帽衫",
  "fur cloak": "毛皮斗篷",
  "two-tone coat": "雙色大衣",
  "blue shawl": "藍色披肩",
  "frilled jacket": "荷葉邊夾克",
  "orange cape": "橘色披風",
  "down jacket": "羽絨外套",
  "parka": "派克大衣",
  "surcoat": "罩袍（surcoat）",
  "red cardigan": "紅色開襟針織衫",
  "front-tie top": "前綁上衣",
  "front-tie bikini top": "前綁比基尼上衣",
  "criss-cross halter": "交叉掛頸式",
  "red vest": "紅色背心(外搭)",
  "bandeau": "抹胸帶",
  "blue vest": "藍色背心(外搭)",
  "o-ring top": "O環上衣",
  "green vest": "綠色背心(外搭)",
  "plaid vest": "格紋背心(外搭)",
  "brown vest": "棕色背心(外搭)",
  "open vest": "敞開的背心(外搭)",
  "chest sarashi": "胸前白布(sarashi)",
  "yellow sweater": "黃色毛衣",
  "grey vest": "灰色背心(外搭)",
  "white vest": "白色背心(外搭)",
  "purple vest": "紫色背心(外搭)",
  "brown sweater vest": "棕色毛衣背心",
  "purple sweater": "紫色毛衣",
  "yellow vest": "黃色背心(外搭)",
  "bulletproof vest": "防彈背心",
  "open-chest sweater": "開胸毛衣",
  "fishnet top": "網狀上衣",
  "pink vest": "粉紅色背心(外搭)",
  "cropped vest": "短版背心(外搭)",
  "striped sweater": "條紋毛衣",
  "multicolored shirt": "多色襯衫",
  "budget sarashi": "迷你裹胸(budget_sarashi)",
  "hooded sweater": "連帽毛衣",
  "bodice": "緊身胸衣(bodice)",
  "yellow sweater vest": "黃色毛衣背心",
  "cropped sweater": "短版毛衣",
  "black sweater vest": "黑色毛衣背心",
  "multi-strapped bikini top": "多肩帶比基尼上衣",
  "load-bearing vest": "戰術背心",
  "collared vest": "有領背心(外搭)",
  "orange vest": "橘色背心(外搭)",
  "orange sweater": "橘色毛衣",
  "short-sleeved sweater": "短袖毛衣",
  "blue tunic": "藍色長版上衣(tunic)",
  "blue tank top": "藍色背心(tank top)",
  "loose shirt": "寬鬆襯衫",
  "grey tank top": "灰色背心(tank top)",
  "frilled camisole": "荷葉邊細肩帶背心",
  "green tunic": "綠色長版上衣(tunic)",
  "yellow tank top": "黃色背心(tank top)",
  "racerback": "工字背(競速背)",
  "green tank top": "綠色背心(tank top)",
  "polka dot shirt": "圓點襯衫",
  "black tube top": "黑色平口上衣",
  "checkered shirt": "棋盤格紋襯衫",
  "cross-laced top": "交叉綁帶上衣",
  "black bandeau": "黑色抹胸",
  "blue camisole": "藍色細肩帶背心",
  "argyle sweater": "菱格紋毛衣",
  "white tube top": "白色平口上衣",
  "sling bikini top": "吊帶式比基尼上衣",
  "crotch seam": "胯部接縫",
  "lowleg panties": "低腰內褲",
  "wet panties": "濕透的內褲",
  "cat lingerie": "貓咪內衣",
  "breastless clothes": "露胸服裝",
  "trefoil": "三葉形（緊貼輪廓）",
  "white sports bra": "白色運動內衣",
  "untied panties": "鬆開的內褲",
  "open bra": "敞開的胸罩",
  "yellow bra": "黃色胸罩",
  "belt bra": "皮帶胸衣",
  "grey sports bra": "灰色運動內衣",
  "stained panties": "沾污漬的內褲",
  "two-tone sports bra": "雙色運動內衣",
  "brown panties": "棕色內褲",
  "torn panties": "破損的內褲",
  "plaid panties": "格紋內褲",
  "star pasties": "星形乳貼",
  "jockstrap": "運動護襠(男用)",
  "back-print panties": "後片印花內褲",
  "string bra": "細繩胸罩",
  "panties under buruma": "燈籠褲下穿內褲",
  "multi-strapped panties": "多肩帶內褲",
  "brown bra": "棕色胸罩",
  "strawberry print panties": "草莓圖樣內褲",
  "aqua bra": "水藍色胸罩",
  "oversized breast cup": "過大罩杯",
  "red sports bra": "紅色運動內衣",
  "satin panties": "緞面內褲",
  "plaid bra": "格紋胸罩",
  "underwear": "內衣褲"
}

UMBRELLA_EXTRA = [
  "underwear"
]

HELD = [
  "condom packet strip",
  "crime prevention buzzer",
  "lube",
  "used tissue"
]

EXPLICIT_EXTRA = [
  "anal tail",
  "clitoral piercing",
  "dilation tape",
  "lube",
  "used tissue"
]

SENSITIVE_EXTRA = [
  "trefoil"
]


# 披風的顏色、剪裁會帶出 cape。父項 cape 含古希臘，十九件新披風一起進古希臘之後，
# 「cape」出現在 59% 的古希臘圖（門檻 55%）。新披風留在中世紀和維多利亞，不進古希臘。
for _row in ROWS:
    if _row["tag"].endswith(" cape"):
        _row["era"] = ["medieval", "victorian"]

# 部位或別的意思，不是那件連身衣。帶出 bikini／dress 會佔連身格，
# reconcile 接著把沒釘住的上下著刪掉，上衣＋外套的圖就只剩比基尼或洋裝。
# 裙式比基尼仍是裙子。皮鞋是鞋子，不是洋裝。比基尼上衣自己佔上衣格。
_PIECE_NOT_BODY = {
    "bikini skirt": ["skirt"],
    "dress shoes": ["shoes"],
    "front-tie bikini top": [],
    "multi-strapped bikini top": [],
    "sling bikini top": [],
}
for _row in ROWS:
    if _row["tag"] in _PIECE_NOT_BODY:
        _row["implies"] = list(_PIECE_NOT_BODY[_row["tag"]])


def extra_grok_clothing() -> list[dict]:
    return ROWS
