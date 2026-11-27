"""Danbooru 的 wiki 說明：卡片詳情（字盒、卡冊）顯示「這張牌在 Danbooru 上的說明」。

兩步：
  python scripts/fetch_tag_wiki.py --fetch   # 下載全部 wiki（照 id 往回翻，一頁 1000 筆，約 300 次請求、5 分鐘）
  python scripts/fetch_tag_wiki.py           # 從快取整理出墨池用得到的字，寫 web/tag_wiki.json

- 全部 wiki 存在 scripts/.cache_related_tags/wiki_all.jsonl（不進 git）。
- 整理的對象＝詞庫的牌＋禁用角色＋永遠不抽的字（跟「相關的牌」一樣：資料照存，
  顯示時才由 hardban 擋 —— server.py 回傳前、web6 前端各擋一次）。
- 名字對法跟 related_from_dataset.py 一樣：原名 → 別名表的新名 → 反查舊名。
- 只留第一段、轉成純文字（DText 的 [[連結]]、[b]、h4.、!post #123 這些拿掉），最多 MAX_CHARS 字。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_related_tags import DEFAULT_CACHE, ROOT, USER_AGENT, crawl_tags, load_lexicon, say, to_danbooru  # noqa: E402

API = "https://danbooru.donmai.us/wiki_pages.json"
ALL = DEFAULT_CACHE / "wiki_all.jsonl"
ALIASES = DEFAULT_CACHE / "aliases.json"
OUT = ROOT / "web" / "tag_wiki.json"
MAX_CHARS = 320


def fetch(rate: float = 1.0):
    """全部 wiki 頁（沒刪掉的）。照 id 往回翻頁（page=b<id>），寫成一行一頁。"""
    tmp = ALL.with_suffix(".part")
    n = 0
    # 第一頁也要帶 page=b<很大的 id>：不帶的話 Danbooru 照更新時間排，最小的 id 可能是 10，
    # 下一頁「id < 10」就沒了（2026-11-27 第一次跑只抓到 1,204 頁）。
    before = 2**31 - 1
    with tmp.open("w", encoding="utf-8", newline="\n") as out:
        while True:
            q = {"limit": "1000", "only": "id,title,body,other_names,is_deleted,updated_at",
                 "search[is_deleted]": "false"}
            q["page"] = f"b{before}"
            url = API + "?" + urllib.parse.urlencode(q)
            for attempt in range(6):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(req, timeout=90) as r:
                        rows = json.loads(r.read().decode("utf-8"))
                    break
                except Exception as e:  # noqa: BLE001
                    wait = min(120, 2 ** (attempt + 1))
                    say(f"  {e}，等 {wait} 秒")
                    time.sleep(wait)
            else:
                raise SystemExit("wiki 抓不下來，晚點再試（已抓的沒寫進快取）。")
            if not rows:
                break
            for w in rows:
                out.write(json.dumps({"title": w.get("title"), "body": w.get("body") or "",
                                      "other": w.get("other_names") or [], "updated": w.get("updated_at")},
                                     ensure_ascii=False) + "\n")
            n += len(rows)
            before = min(w["id"] for w in rows)
            say(f"  wiki {n:,} 頁（id < {before}）")
            time.sleep(1.0 / rate)
    tmp.replace(ALL)
    say(f"全部 wiki：{n:,} 頁，存在 {ALL}")


# ---------------------------------------------------------------- DText → 純文字

def plain(body: str) -> str:
    """第一段、純文字。"""
    text = body.replace("\r\n", "\n")
    # 第一個小標題（h1.～h6.）之前才是說明；之後是 See also、Examples…
    text = re.split(r"^h[1-6](?:#[\w-]+)?\.", text, maxsplit=1, flags=re.M)[0]
    # 圖、表格、引用、展開區塊整段拿掉
    text = re.sub(r"\[(table|quote|expand|code|spoiler)[^\]]*\].*?\[/\1\]", " ", text, flags=re.S | re.I)
    text = re.sub(r"!(post|asset) #\d+(:\s*)?", "", text)
    # [[tag|顯示字]] → 顯示字；[[tag]] → tag（底線換空白）
    text = re.sub(r"\[\[([^\]|]+)\|([^\]]*)\]\]", lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"\[\[([^\]]+)\]\]", lambda m: m.group(1).replace("_", " "), text)
    text = re.sub(r"\{\{([^}|]+)(?:\|[^}]*)?\}\}", lambda m: m.group(1).replace("_", " "), text)
    # "文字":[網址] / "文字":/路徑 → 文字
    text = re.sub(r'"([^"]+)":\[[^\]]+\]', r"\1", text)
    text = re.sub(r'"([^"]+)":(?:https?://|/)\S+', r"\1", text)
    text = re.sub(r"<(https?://[^>]+)>", r"\1", text)
    # 其他 [b] [i] [u] [s] [tn] [url] 標記
    text = re.sub(r"\[/?(b|i|u|s|tn|sup|sub|url|nodtext|br)(=[^\]]*)?\]", "", text, flags=re.I)
    # 清單符號
    text = re.sub(r"^\s*\*+\s*", "• ", text, flags=re.M)
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paras:
        return ""
    first = re.sub(r"\s+", " ", paras[0]).strip()
    if len(first) > MAX_CHARS:
        cut = first[:MAX_CHARS]
        # 盡量切在句點
        dot = max(cut.rfind(". "), cut.rfind("。"))
        first = (cut[:dot + 1] if dot > MAX_CHARS * 0.5 else cut.rstrip() + "…")
    return first


REDIRECT = re.compile(r"^\s*(deprecated|ambiguous|see |use |for the )", re.I)
LINK = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")


def with_targets(text: str, body: str) -> str:
    """廢棄／轉址的頁（「Deprecated tag. Use one of the tags below instead.」）：把它連到的字接在後面，
    不然詳情只看到一句「改用下面這些」卻沒有下面。"""
    if not REDIRECT.match(text):
        return text
    names = []
    for m in LINK.findall(body):
        n = m.strip().replace("_", " ")
        if ":" in n or n.lower() in (x.lower() for x in names):
            continue
        names.append(n)
        if len(names) >= 8:
            break
    if not names or all(n.lower() in text.lower() for n in names):
        return text
    return f"{text} → {', '.join(names)}"


def build():
    if not ALL.exists():
        raise SystemExit("還沒有 wiki 快取：先跑 --fetch。")
    pages = {}
    with ALL.open(encoding="utf-8") as f:
        for line in f:
            w = json.loads(line)
            if w.get("title"):
                pages[w["title"]] = w
    aliases = json.loads(ALIASES.read_text(encoding="utf-8")) if ALIASES.exists() else {}
    # related_from_dataset.py 對好的名字（角色去掉作品名、Fate 靈基階段、寫死的對照）：有的話一起用。
    report_path = DEFAULT_CACHE / "dataset_report.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    known = {t: [n] for t, n in (report.get("renamed") or {}).items()}
    for t, rec in (report.get("merged") or {}).items():
        known.setdefault(t, []).extend(rec.get("from") or [])
    rev: dict[str, list[str]] = {}
    for old, new in aliases.items():
        rev.setdefault(new, []).append(old)
    data = load_lexicon()
    tags = crawl_tags(data)  # 詞庫＋禁用角色＋永遠不抽的字
    out, missing, via = {}, [], 0
    for t in tags:
        name = to_danbooru(t).lower()
        cands = [name]
        cur, seen = name, {name}
        while cur in aliases and aliases[cur] not in seen:
            cur = aliases[cur]
            seen.add(cur)
            cands.append(cur)
        cands += rev.get(name, [])
        cands += [str(n).lower() for n in known.get(t, [])]
        for c in cands:
            w = pages.get(c)
            if w and w.get("body"):
                text = with_targets(plain(w["body"]), w["body"])
                if text:
                    out[t] = text
                    via += c != name
                    break
        else:
            missing.append(t)
    doc = {
        "version": 1,
        "source": "danbooru wiki_pages.json",
        "built": time.strftime("%Y-%m-%d"),
        "maxChars": MAX_CHARS,
        "count": len(out),
        "wiki": out,
    }
    text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    OUT.write_bytes(text.encode("utf-8"))
    lex = {x["tag"] for x in data.get("tags", [])}
    miss_lex = [t for t in missing if t in lex]
    say(f"wiki 說明：{OUT}（{len(text.encode('utf-8')) / 1024:.0f} KB）")
    say(f"  有說明 {len(out)}（其中 {via} 個靠別名）；詞庫的牌沒有說明 {len(miss_lex)} 張、禁用角色／永遠不抽的字 {len(missing) - len(miss_lex)} 個")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fetch", action="store_true", help="下載全部 wiki")
    args = ap.parse_args(argv)
    if args.fetch:
        fetch()
    build()


if __name__ == "__main__":
    main()
