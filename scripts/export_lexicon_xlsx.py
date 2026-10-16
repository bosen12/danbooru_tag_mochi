#!/usr/bin/env python3
"""詞庫一覽表：web/lexicon.json → danbooru_lexicon.xlsx（只供查找，不參與抽牌）。

    python scripts/export_lexicon_xlsx.py            # 寫到 repo 根目錄的 danbooru_lexicon.xlsx
    python scripts/export_lexicon_xlsx.py OUT.xlsx

要 openpyxl（pip install openpyxl；只有產這張表要，網頁和伺服器不用）。
角色另外兩張：「角色」（能用的，含作品、卡面提示詞）、「角色禁用」（scripts/characters.json 裡
character_ban 的，含原因、年齡出處）。詞庫改了就重跑這支，不要手改表。
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
except ImportError:  # pragma: no cover
    raise SystemExit("要先裝 openpyxl：pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
LEX = ROOT / "web" / "lexicon.json"
CHARS = ROOT / "scripts" / "characters.json"
JOBS = ROOT / "scripts" / "card_jobs.json"
OUT = ROOT / "danbooru_lexicon.xlsx"

SECTION = {"subject": "人物", "feature": "特徵", "clothing": "服裝", "pose": "姿勢", "env": "環境", "quality": "品質"}
# 分組的中文沿用這張表一直以來的寫法（字盒上的比較短，查表時這個比較好懂）；沒列的用詞庫的 groupZh。
GROUP = {
    "count_f": "女性人數", "count_m": "男性人數", "extra": "額外人物", "character": "角色",
    "body_f": "身材（女）", "body_m": "身材（男）", "race": "種族", "skin": "皮膚", "fabric": "布料",
    "era": "時代服", "effect": "效果", "furniture": "傢俱", "boost": "品質加強",
}
HEAT = {"tease": "誘惑", "flash": "走光", "sex": "性愛", "activity": "活動"}
GATE = {"any": "不限", "female": "女", "male": "男"}
LAYER = {"normal": "一般", "garment": "衣服", "accessory": "配件", "skin": "皮膚／裸", "underwear": "內衣"}
ERA = {"modern": "現代", "victorian": "維多利亞", "edo": "江戶", "medieval": "中世紀",
       "ancient_china": "古中國", "ancient_greece": "古希臘", "any": "不限時代"}
NEEDS = {"female": "女性", "male": "男性", "pair": "兩人", "group": "群體", "2male": "兩男", "2female": "兩女",
         "crowd": "人群", "yuri": "百合", "yaoi": "耽美", "five": "五人"}
BAN_REASON = {"minor": "未滿 18 歲", "student": "學生", "childlike": "外觀像兒童", "real_person": "真人／VTuber",
              "non_human": "非人形", "unsure": "年齡查不到或沒把握"}

HEAD_FILL = PatternFill("solid", fgColor="1F4E79")
ROW_FILL = PatternFill("solid", fgColor="F3F6F9")
HEAD_FONT = Font(bold=True, color="FFFFFF")
TITLE_FONT = Font(bold=True, size=16, color="1F4E79")
COLS = ["標籤", "中文", "區段", "分組", "細分類", "互斥", "額外互斥", "尺度", "性別", "層", "時代", "帶出", "綁定", "需要"]
WIDTHS = [34, 24, 16, 18, 33, 18, 36, 22, 12, 14, 28, 36, 28, 18]


def label(zh: str | None, code: str) -> str:
    return f"{zh}（{code}）" if zh else code


def row_of(t: dict, group_zh: dict) -> list:
    sec = t["section"]
    grp = t.get("group") or ""
    sub = t.get("sub") or grp
    joined = lambda xs, m=None: "、".join(label(m.get(x), x) if m else x for x in xs) or None  # noqa: E731
    return [
        t["tag"],
        t.get("zh") or "",
        label(SECTION.get(sec), sec),
        label(GROUP.get(grp) or group_zh.get(grp), grp),
        label(GROUP.get(grp) or group_zh.get(grp), grp) if sub == grp else label(group_zh.get(sub) or GROUP.get(sub), sub),
        t.get("mutex") or None,
        joined(t.get("mutexExtra") or []),
        joined(t.get("heat") or [], HEAT),
        label(GATE.get(t.get("gate") or "any"), t.get("gate") or "any"),
        label(LAYER.get(t.get("layer") or "normal"), t.get("layer") or "normal"),
        joined(t.get("era") or ["any"], ERA),
        joined(t.get("implies") or []),
        joined(t.get("bind") or []),
        joined(t.get("needs") or [], NEEDS),
    ]


def table(ws, header: list, rows: list, widths: list) -> None:
    ws.append(header)
    for c in ws[1]:
        c.font = HEAD_FONT
        c.fill = HEAD_FILL
        c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 22
    for r in rows:
        ws.append(r)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.fill = ROW_FILL
            c.alignment = Alignment(vertical="center")
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions
    ws.sheet_view.zoomScale = 110


def head_row(ws, values: list) -> None:
    ws.append(values)
    for c in ws[ws.max_row]:
        if c.value is not None:
            c.font = HEAD_FONT
            c.fill = HEAD_FILL


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    data = json.loads(LEX.read_text(encoding="utf-8"))
    group_zh = data.get("groupZh") or {}
    tags = sorted(data["tags"], key=lambda t: ((t.get("zh") or t["tag"]), t["tag"]))
    chars = [t for t in tags if t.get("group") == "character"]
    others = [t for t in tags if t.get("group") != "character"]
    try:
        roster = json.loads(CHARS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        roster = []
    by_tag = {c["tag"]: c for c in roster}
    try:
        card_pos = {j["tag"]: j["positive"] for j in json.loads(JOBS.read_text(encoding="utf-8"))}
    except (OSError, ValueError):
        card_pos = {}
    banned = [c for c in roster if c.get("character_ban")]

    wb = Workbook()
    ws = wb.active
    ws.title = "使用說明"
    lines = [
        ("Danbooru 詞庫一覽", TITLE_FONT),
        (f"共 {len(tags)} 個標籤（其中角色 {len(chars)} 個）。一列一個字。來源是 web/lexicon.json，這張表只供查找，不參與抽牌。", Font(size=12)),
        (None, None),
        ("怎麼找", Font(bold=True, size=12)),
        ("1. 開「全部」，點欄位右下角的漏斗。搜尋框可以打中文（韓服）或英文標籤（hanbok）。", Font(size=12)),
        ("2. 只想看某一段時，改開「人物／角色／特徵／服裝／姿勢／環境／品質」。", Font(size=12)),
        ("3. 互斥空白＝這個字不佔格子，可以跟同段其他字疊在同一張圖。", Font(size=12)),
        ("4. 帶出＝抽到這個字時會一起帶上的字。綁定＝必須同時成立。需要＝卡司條件。", Font(size=12)),
        ("5. 分組、細分類後面括號是程式裡的代碼，跟引擎、測試用的是同一個字。", Font(size=12)),
        ("6. 細分類在分組右邊，是畫面上的字盒。括號裡的代碼跟分組一樣時，這個字沒有再拆開。", Font(size=12)),
        ("7. 「總覽」是數量。一個標籤可以同時算進好幾個時代、好幾個尺度。", Font(size=12)),
        (f"8. 「角色」是能用的動漫角色（{len(chars)} 個），多兩欄：作品、卡面提示詞（烘牌面用的）。只能自己釘，或打開「抽角色」。", Font(size=12)),
        (f"9. 「角色禁用」是不能用的角色（{len(banned)} 個：未滿 18 歲、學生、外觀像兒童、真人／VTuber、非人形、年齡查不到）。不是牌，貼上提示詞、送去生圖都會被擋。", Font(size=12)),
        ("10. 這張表由 scripts/export_lexicon_xlsx.py 產生，詞庫改了重跑，不要手改。", Font(size=12)),
    ]
    for text, font in lines:
        ws.append([text])
        if font:
            ws.cell(ws.max_row, 1).font = font
    ws.column_dimensions["A"].width = 110

    ws = wb.create_sheet("總覽")
    ws.append(["數量"])
    ws["A1"].font = TITLE_FONT
    ws.append(["篩選與逐字內容在其他工作表。這裡只記有多少。"])
    head_row(ws, ["區段", "數量"])
    sec_count = Counter(t["section"] for t in tags)
    for sec, zh in SECTION.items():
        ws.append([label(zh, sec), sec_count.get(sec, 0)])
    ws.append(["合計", len(tags)])
    ws.append([])
    head_row(ws, ["區段", "分組", "數量"])
    grp_count = Counter((t["section"], t.get("group") or "") for t in tags)
    for sec in SECTION:
        groups = (data.get("groupOrder") or {}).get(sec, [])
        seen = [g for g in groups if grp_count.get((sec, g))] + sorted(g for (s2, g) in grp_count if s2 == sec and g not in groups)
        for g in seen:
            ws.append([label(SECTION[sec], sec), label(GROUP.get(g) or group_zh.get(g), g), grp_count[(sec, g)]])
    ws.append([])
    ws.append(["時代（含這個時代的標籤數，可重複計算）"])
    head_row(ws, ["時代", "數量"])
    era_count = Counter(e for t in tags for e in (t.get("era") or ["any"]))
    for e, zh in ERA.items():
        ws.append([label(zh, e), era_count.get(e, 0)])
    ws.append([])
    ws.append(["互斥格（空白的不佔格，不列在這裡）"])
    head_row(ws, ["互斥", "數量"])
    for m, n in sorted(Counter(t["mutex"] for t in tags if t.get("mutex")).items(), key=lambda kv: (-kv[1], kv[0])):
        ws.append([m, n])
    if roster:
        ws.append([])
        ws.append(["角色（scripts/characters.json）"])
        head_row(ws, ["狀態", "數量"])
        ws.append(["能用", len(roster) - len(banned)])
        for code, n in sorted(Counter(c.get("ban_reason") or "" for c in banned).items(), key=lambda kv: -kv[1]):
            ws.append([f"禁用・{BAN_REASON.get(code, code)}", n])
        ws.append(["合計", len(roster)])
    ws.column_dimensions["A"].width = 42
    ws.column_dimensions["B"].width = 28
    ws.column_dimensions["C"].width = 12

    table(wb.create_sheet("全部"), COLS, [row_of(t, group_zh) for t in tags], WIDTHS)
    sheets = [("人物", lambda t: t["section"] == "subject" and t.get("group") != "character")]
    for name, pick in sheets:
        table(wb.create_sheet(name), COLS, [row_of(t, group_zh) for t in others if pick(t)], WIDTHS)
    table(
        wb.create_sheet("角色"),
        COLS + ["作品", "作品中文", "卡面提示詞"],
        [row_of(t, group_zh) + [t.get("series") or "", (by_tag.get(t["tag"]) or {}).get("series_zh") or "", card_pos.get(t["tag"], "")] for t in chars],
        WIDTHS + [24, 26, 90],
    )
    for name, sec in [("特徵", "feature"), ("服裝", "clothing"), ("姿勢", "pose"), ("環境", "env"), ("品質", "quality")]:
        table(wb.create_sheet(name), COLS, [row_of(t, group_zh) for t in others if t["section"] == sec], WIDTHS)
    if roster:
        table(
            wb.create_sheet("角色禁用"),
            ["標籤", "卡名", "作品", "作品中文", "原因", "年齡（官方／出處）", "性別"],
            [
                [c["tag"], c.get("zh") or "", c.get("series") or "", c.get("series_zh") or "",
                 label(BAN_REASON.get(c.get("ban_reason")), c.get("ban_reason") or ""), c.get("age_source") or "",
                 GATE.get(c.get("gender"), c.get("gender") or "")]
                for c in sorted(banned, key=lambda c: (c.get("series") or "", c["tag"]))
            ],
            [36, 18, 30, 30, 26, 60, 8],
        )

    ws = wb.create_sheet("對照")
    ws.append(["代碼對照"])
    ws["A1"].font = TITLE_FONT
    ws.append(["括號裡的英文跟引擎裡的欄位相同。"])
    order = [g for sec in SECTION for g in (data.get("groupOrder") or {}).get(sec, [])]
    present = {t.get("group") for t in tags if t.get("group")}
    used_groups = [g for g in order if g in present] + sorted(present - set(order))
    used_subs = sorted({t.get("sub") for t in tags if t.get("sub") and t.get("sub") != t.get("group")})
    for title, items in [
        ("區段", SECTION.items()),
        ("分組", [(g, GROUP.get(g) or group_zh.get(g) or g) for g in used_groups]),
        ("細分類", [(s, group_zh.get(s) or s) for s in used_subs]),
        ("尺度", HEAT.items()),
        ("性別", GATE.items()),
        ("層", LAYER.items()),
        ("時代", ERA.items()),
        ("需要", NEEDS.items()),
        ("角色禁用原因", BAN_REASON.items()),
    ]:
        ws.append([])
        head_row(ws, [title, "中文", "代碼"])
        for code, zh in items:
            ws.append([None, zh, code])
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 24
    ws.column_dimensions["C"].width = 22

    wb.save(out)
    print(f"wrote {out}: {len(tags)} tags, {len(chars)} characters, {len(banned)} banned characters")
    return 0


if __name__ == "__main__":
    sys.exit(main())
