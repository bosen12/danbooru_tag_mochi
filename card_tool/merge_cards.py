"""把舊版烤好的卡面合併進新版（cards 資料夾＋manifest.json）。

情境：舊版已經烤了很多卡，又裝了新版、新版也烤完了，結果新版少了舊版烤過的那些。
這支把「新版缺、舊版有」的卡搬過去：原圖、thumb/ 縮圖、mini/ 細縮圖，加上 manifest.json 那一筆。

規則：
- 新版有的一律用新版（不覆蓋）。新版 manifest 有記、但原圖檔不見的，當成缺。
- hardban 的字一律不搬：以新版的永遠不抽的字（web/rules/hardban.js）＋禁用角色（web/lexicon.json 的 characterBan）為準。
  舊版可能烤過後來才禁止的牌。
- 新版詞庫已經沒有的牌不搬（只列出來）。
- 先列出要搬幾張、問過才動手；動手前把新版的 manifest.json 備份成 manifest.json.bak-日期時間。
- 舊版的 manifest 是舊格式（沒有 mini、v）也照搬：新版之後烤卡時發現提示詞改過、細縮圖缺，會自己補做。

用法：雙擊 card_tool/merge-cards.bat，照提示貼上舊版、新版的路徑。
也可以直接：python card_tool/merge_cards.py 舊版路徑 新版路徑 [--yes]
路徑可以是 cards 資料夾，也可以是整個安裝資料夾（會自己找 web/cards）。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
MINI_WIDTHS = ("160", "240", "320")


def say(*parts):
    print(*parts, flush=True)


def clean_path(raw: str) -> Path:
    """貼上的路徑：去掉前後空白和引號（檔案總管「複製路徑」會帶雙引號）。"""
    s = raw.strip().strip('"').strip("'").strip()
    return Path(s).expanduser()


def find_cards(p: Path) -> Path | None:
    """給 cards 資料夾或整個安裝資料夾都可以。"""
    for cand in (p, p / "web" / "cards", p / "cards"):
        if (cand / "manifest.json").is_file():
            return cand.resolve()
    return None


def load_manifest(cards: Path) -> dict:
    try:
        data = json.loads((cards / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise SystemExit(f"讀不到 {cards / 'manifest.json'}：{e}")
    if not isinstance(data, dict):
        raise SystemExit(f"{cards / 'manifest.json'} 格式不對（不是 JSON 物件）。")
    return data


def hardban(new_cards: Path) -> tuple[set[str], set[str], set[str] | None]:
    """新版的永遠不抽的字、characterBan、詞庫的牌。找不到永遠不抽的字就停：寧可不搬。
    名單在 web/rules/hardban.js（2026-11-28 起）；更早的版本在 web/card-art.js 的 HARD_BANNED，兩種都認。"""
    web = new_cards.parent
    candidates = [
        (web / "rules" / "hardban.js", r"export const HARD_BAN = Object\.freeze\(\[(.*?)\]\);"),
        (web / "card-art.js", r"export const HARD_BANNED = Object\.freeze\(\[(.*?)\]\);"),
        (HERE.parent / "web" / "rules" / "hardban.js", r"export const HARD_BAN = Object\.freeze\(\[(.*?)\]\);"),
    ]
    m = None
    src = None
    for path, pattern in candidates:
        if not path.is_file():
            continue
        m = re.search(pattern, path.read_text(encoding="utf-8"), re.S)
        if m:
            src = path
            break
    if not m:
        raise SystemExit("找不到新版的永遠不抽的字（web/rules/hardban.js）：未成年保護對不上，不合併。")
    body = re.sub(r"//[^\n]*", "", m.group(1))
    banned = {w.lower() for w in re.findall(r'"([^"\\]*)"', body)}
    # 名單長短不管；但除了雙引號字串還有別的寫法（單引號…）就是讀不懂，不合併（以免讀成 0 個字、什麼都沒擋）。
    if re.sub(r'"[^"\\]*"', "", body).replace(",", "").strip():
        raise SystemExit(f"{src} 的名單有讀不懂的寫法：不合併。")
    chars: set[str] = set()
    lex_tags = None
    for lex_path in (web / "lexicon.json", HERE.parent / "web" / "lexicon.json"):
        if lex_path.is_file():
            lex = json.loads(lex_path.read_text(encoding="utf-8"))
            chars = {str(t).lower() for t in lex.get("characterBan") or []}
            lex_tags = {str(t.get("tag")).lower() for t in lex.get("tags") or [] if t.get("tag")}
            break
    return banned, chars, lex_tags


def files_of(entry: dict) -> list[str]:
    """這張卡在 cards 資料夾裡的檔（相對路徑）：原圖、thumb、mini。"""
    name = entry.get("file")
    if not isinstance(name, str) or not name or "/" in name or "\\" in name or ".." in name:
        return []
    out = [name, f"thumb/{name}"]
    mini = entry.get("mini")
    if isinstance(mini, dict) and isinstance(mini.get("w"), dict):
        stem = name[:-5] if name.endswith(".webp") else name
        for w, h in mini["w"].items():
            if str(w).isdigit() and isinstance(h, str) and re.fullmatch(r"[0-9a-f]{6,40}", h):
                out.append(f"mini/{w}/{stem}-{h}.webp")
    return out


def plan(old: Path, new: Path):
    old_m, new_m = load_manifest(old), load_manifest(new)
    banned, chars, lex_tags = hardban(new)
    take, skip_ban, skip_gone, skip_nofile, kept = [], [], [], [], 0
    for tag, entry in old_m.items():
        if not isinstance(entry, dict):
            continue
        key = str(tag).lower()
        mine = new_m.get(tag)
        if isinstance(mine, dict) and isinstance(mine.get("file"), str) and (new / mine["file"]).is_file():
            kept += 1
            continue
        if key in banned or key in chars:
            skip_ban.append(tag)
            continue
        if lex_tags is not None and key not in lex_tags:
            skip_gone.append(tag)
            continue
        files = files_of(entry)
        if not files or not (old / files[0]).is_file():
            skip_nofile.append(tag)
            continue
        take.append((tag, entry, [f for f in files if (old / f).is_file()]))
    return old_m, new_m, take, skip_ban, skip_gone, skip_nofile, kept


def merge(old: Path, new: Path, yes: bool) -> int:
    if old == new:
        raise SystemExit("舊版和新版是同一個資料夾。")
    old_m, new_m, take, skip_ban, skip_gone, skip_nofile, kept = plan(old, new)
    say("")
    say(f"舊版 {old}：{len(old_m)} 張")
    say(f"新版 {new}：{len(new_m)} 張")
    say(f"  兩邊都有（用新版，不動）：{kept}")
    say(f"  要從舊版搬過來：{len(take)}")
    if skip_ban:
        say(f"  不搬（新版禁止的字）：{len(skip_ban)}")
    if skip_gone:
        say(f"  不搬（新版詞庫已經沒有）：{len(skip_gone)}：{'、'.join(skip_gone[:20])}{'…' if len(skip_gone) > 20 else ''}")
    if skip_nofile:
        say(f"  不搬（舊版 manifest 有記、圖檔不在）：{len(skip_nofile)}")
    if not take:
        say("\n新版沒有缺舊版的卡，不用合併。")
        return 0
    if take:
        sample = "、".join(t for t, _, _ in take[:15])
        say(f"  例：{sample}{'…' if len(take) > 15 else ''}")
    if not yes:
        ans = input(f"\n要把這 {len(take)} 張搬進新版嗎？輸入 Y 確定：").strip().lower()
        if ans not in ("y", "yes"):
            say("沒有動任何檔。")
            return 1
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = new / f"manifest.json.bak-{stamp}"
    shutil.copy2(new / "manifest.json", backup)
    copied = 0
    for tag, entry, files in take:
        for rel in files:
            dst = new / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(old / rel, dst)
            copied += 1
        new_m[tag] = entry
    # 跟 bake_card_art.py 的 save_manifest 一樣：先寫暫存檔再換名（伺服器剛好在讀也不會讀到半個檔）。
    tmp = new / "manifest.json.tmp"
    tmp.write_bytes(json.dumps(new_m, ensure_ascii=False, indent=0).encode("utf-8"))
    tmp.replace(new / "manifest.json")
    say(f"\n合併好了：搬了 {len(take)} 張（{copied} 個檔），新版現在 {len(new_m)} 張。")
    say(f"原本的 manifest.json 備份在 {backup}")
    say("墨池開著的話，重新整理網頁就看得到。")
    return 0


def ask(prompt: str, default: Path | None = None) -> Path:
    while True:
        hint = f"（直接按 Enter＝{default}）" if default else ""
        raw = input(f"{prompt}{hint}：")
        if not raw.strip() and default:
            return default
        p = clean_path(raw)
        cards = find_cards(p)
        if cards:
            return cards
        say(f"  {p} 裡找不到 manifest.json（給 cards 資料夾，或整個墨池資料夾）。再貼一次。")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="把舊版烤好的卡面合併進新版")
    ap.add_argument("old", nargs="?", help="舊版的 cards 資料夾（或整個安裝資料夾）")
    ap.add_argument("new", nargs="?", help="新版的 cards 資料夾（或整個安裝資料夾）")
    ap.add_argument("--yes", action="store_true", help="不問，直接合併")
    args = ap.parse_args(argv)
    say("合併卡面：把舊版烤好、新版沒有的卡搬進新版（新版有的不動）。")
    if args.old:
        old = find_cards(clean_path(args.old))
        if not old:
            raise SystemExit(f"{args.old} 裡找不到 manifest.json。")
    else:
        old = ask("貼上【舊版】的路徑")
    here = find_cards(HERE.parent)
    if args.new:
        new = find_cards(clean_path(args.new))
        if not new:
            raise SystemExit(f"{args.new} 裡找不到 manifest.json。")
    else:
        new = ask("貼上【新版】的路徑", here if here and here != old else None)
    return merge(old, new, args.yes)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        say("\n取消了，沒有動任何檔。")
        sys.exit(1)
