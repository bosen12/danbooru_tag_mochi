"""在本機從 Danbooru 全站的 tag 資料算「相關的牌」，取代一張一張問 related_tag API 的爬蟲。

為什麼：爬蟲一個 tag 一次請求，Danbooru 只給每秒一次多一點，一萬五千張要四、五個小時，
而且 related_tag 是抽樣算的（frequency 是幾千張圖裡的比例）。整站的 tag 表下載下來在本機算：
- 幾分鐘算完全部的牌；
- 數字是全站精確值，不是抽樣；
- 不受每個 tag 只回前 100 名的限制。

資料（不進 git，放在 scripts/.cache_related_tags/hf/）：
- Hugging Face 資料集 Shio-Koube/danbooru2026-tags-uint32（2026-11-26，1,174 萬張圖、4.47 億個 tag）：
  image_ids.npy、offsets.npy、tag_ids.npy（CSR：第 i 張圖的 tag 是 tag_ids[offsets[i]:offsets[i+1]]）、
  vocab.tsv（tag_id、tag、category、count）。只用 numpy 讀（allow_pickle=False），不跑資料集附的程式。
- Danbooru 的別名表（tag_aliases.json?search[status]=active）：墨池有些牌用的是 Danbooru 的舊名
  （模型認得的寫法），要對到現在的名字才找得到。--aliases 下載一次，存 scripts/.cache_related_tags/aliases.json。

算法跟爬蟲的 --build 一樣（cosine、lift、guard、角色、人數組合的擋法都照抄），只是數字換成全站精確值：
- cosine(A,B) = 同時有 A、B 的圖數 ÷ √(A 的圖數 × B 的圖數)
- lift = P(B|A) ÷ P(B)
- guard：這張牌的圖裡，同時標了某個永遠不抽的字（HARD_BANNED）的比例，取最大的那個，≥ 12% 就不推薦、自己也不給清單。
- 「相關」那一方只收 Danbooru 上的一般 tag（category general），跟 API 的 category=0 一樣。
卡片名稱、提示詞都不動：關聯檔的鍵和值都是墨池詞庫原本的寫法，只是查資料時換成 Danbooru 現在的名字。

用法：
  python scripts/related_from_dataset.py --download        # 下載資料集（613 MB，解開 1.9 GB）
  python scripts/related_from_dataset.py --aliases         # 下載別名表（約一百多次請求，兩三分鐘）
  python scripts/related_from_dataset.py                   # 算、寫 web/related_tags.json，列出對不上的 tag
  python scripts/related_from_dataset.py --compare         # 另外跟爬蟲快取（results.jsonl）對照
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import tarfile
import time
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_related_tags import (  # noqa: E402
    DEFAULT_CACHE,
    DEFAULT_OUT,
    USER_AGENT,
    Cache,
    crawl_tags,
    hard_banned,
    lexicon_tags,
    load_lexicon,
    say,
    to_danbooru,
)

HF_REPO = "Shio-Koube/danbooru2026-tags-uint32"
HF_FILE = "danbooru2026_tags_uint32.tar.zst"
HF_DIR = DEFAULT_CACHE / "hf"
DATA_DIR = HF_DIR / "data"
ALIASES = DEFAULT_CACHE / "aliases.json"
ALIAS_API = "https://danbooru.donmai.us/tag_aliases.json"
BLOCK = 512  # 一次算幾張牌的共現（記憶體：BLOCK × 牌數 × 4 bytes）


# ---------------------------------------------------------------- 下載

def download():
    from huggingface_hub import hf_hub_download
    import zstandard

    dl = HF_DIR / "dl"
    dl.mkdir(parents=True, exist_ok=True)
    src = Path(hf_hub_download(HF_REPO, HF_FILE, repo_type="dataset", local_dir=str(dl)))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    dctx = zstandard.ZstdDecompressor(max_window_size=2**31)
    with src.open("rb") as f, dctx.stream_reader(f) as r, tarfile.open(fileobj=r, mode="r|") as tf:
        for m in tf:
            name = PurePosixPath(m.name)
            # 只解資料檔；資料夾、連結、程式（decode_tags.py）、絕對路徑、..：一律不碰。
            if not m.isfile() or name.is_absolute() or ".." in name.parts or name.suffix not in (".npy", ".tsv"):
                continue
            with tf.extractfile(m) as fsrc, (DATA_DIR / name.name).open("wb") as fdst:
                while chunk := fsrc.read(1 << 22):
                    fdst.write(chunk)
            say(f"  {name.name}：{m.size / 2**20:.0f} MB")
    say(f"資料集解在 {DATA_DIR}")


def fetch_aliases(rate: float = 1.0):
    """下載 Danbooru 全部有效的別名（舊名 → 新名）。照 id 往回翻頁（page=b<id>），一頁 1000 筆。"""
    out: dict[str, str] = {}
    before = None
    while True:
        q = {"search[status]": "active", "limit": "1000", "only": "id,antecedent_name,consequent_name"}
        if before:
            q["page"] = f"b{before}"
        url = ALIAS_API + "?" + urllib.parse.urlencode(q)
        for attempt in range(6):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=60) as r:
                    rows = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:  # noqa: BLE001
                wait = min(120, 2 ** (attempt + 1))
                say(f"  {e}，等 {wait} 秒")
                time.sleep(wait)
        else:
            raise SystemExit("別名表抓不下來，晚點再試。")
        if not rows:
            break
        for row in rows:
            out[row["antecedent_name"]] = row["consequent_name"]
        before = min(row["id"] for row in rows)
        say(f"  別名 {len(out)} 筆（id < {before}）")
        time.sleep(1.0 / rate)
    ALIASES.parent.mkdir(parents=True, exist_ok=True)
    ALIASES.write_bytes(json.dumps(out, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    say(f"別名表：{len(out)} 筆，存在 {ALIASES}")


# ---------------------------------------------------------------- 對名字

def load_vocab():
    names, cats, counts = [], [], []
    with (DATA_DIR / "vocab.tsv").open(encoding="utf-8") as f:
        next(f)
        for line in f:
            tid, tag, cat, count = line.rstrip("\n").split("\t")
            assert int(tid) == len(names)
            names.append(tag)
            cats.append(cat)
            counts.append(int(count))
    return names, cats, np.asarray(counts, dtype=np.int64)


def resolve(tags, vocab_index, aliases, crawled):
    """墨池的 tag → 資料集的 tag_id。順序：原名、別名表（照著鏈走到底）、爬蟲那時 Danbooru 回的新名（resolved）。
    回 {墨池 tag: (tag_id, 用了哪個名字)}，和對不上的清單。"""
    found, missing = {}, []
    for t in tags:
        name = to_danbooru(t)
        tried = [name]
        cur, seen = name, {name}
        while cur in aliases and aliases[cur] not in seen:
            cur = aliases[cur]
            seen.add(cur)
            tried.append(cur)
        rec = crawled.get(t)
        if rec and rec.get("resolved"):
            tried.append(rec["resolved"])
        for cand in tried:
            if cand in vocab_index:
                found[t] = (vocab_index[cand], cand)
                break
        else:
            missing.append(t)
    return found, missing


# ---------------------------------------------------------------- 共現

def cooccurrence(col_of_vocab: np.ndarray, k: int, groups=()):
    """全部圖裡、墨池用得到的字兩兩同時出現幾次（int32 方陣）。
    前 k 欄是一般的字（一個 tag_id 一欄）；後面每個 groups[j]（一串 tag_id）是一欄「合併的字」：
    圖裡有其中任何一個就算有（Danbooru 廢棄、拆成好幾個新字的牌，例如 black footwear ＝ black shoes ∪ black boots ∪ …）。
    只留墨池的字建一張稀疏表（圖 × 字），再一塊一塊乘：記憶體只要稀疏表＋一塊 BLOCK × 欄數。"""
    import scipy.sparse as sp

    offsets = np.load(DATA_DIR / "offsets.npy", mmap_mode="r", allow_pickle=False)
    tag_ids = np.load(DATA_DIR / "tag_ids.npy", mmap_mode="r", allow_pickle=False)
    n_img = len(offsets) - 1
    g = len(groups)
    # 合併欄：(tag_id, 第幾欄) 照 tag_id 排好；cnt[id]＝這個 id 屬於幾個合併欄、start[id]＝從哪開始。
    if g:
        pv = np.concatenate([np.asarray(ids, dtype=np.int64) for ids in groups])
        pc = np.concatenate([np.full(len(ids), j, dtype=np.int32) for j, ids in enumerate(groups)])
        order = np.argsort(pv, kind="stable")
        pv, pc = pv[order], pc[order]
        cnt = np.bincount(pv, minlength=len(col_of_vocab))
        start = np.concatenate(([0], np.cumsum(cnt)[:-1]))
    v_rows, v_cols = [], []
    step = 1_000_000  # 一次讀幾張圖
    idx_parts, indptr = [], np.zeros(n_img + 1, dtype=np.int64)
    kept = 0
    t0 = time.monotonic()
    for s in range(0, n_img, step):
        e = min(n_img, s + step)
        a, b = int(offsets[s]), int(offsets[e])
        t = np.asarray(tag_ids[a:b])
        cols = col_of_vocab[t]
        keep = cols >= 0
        # 每張圖留下幾個：用累加和在每張圖的開頭取差。
        csum = np.concatenate(([0], np.cumsum(keep, dtype=np.int64)))
        local = np.asarray(offsets[s:e + 1], dtype=np.int64) - a
        indptr[s + 1:e + 1] = kept + csum[local[1:]]
        idx_parts.append(cols[keep].astype(np.int32))
        kept += int(keep.sum())
        if g:
            hit = np.nonzero(cnt[t] > 0)[0]
            if len(hit):
                th = t[hit]
                c = cnt[th]
                rows = s + np.searchsorted(local, hit, side="right") - 1
                base = np.repeat(start[th], c)
                within = np.arange(int(c.sum())) - np.repeat(np.cumsum(c) - c, c)
                v_rows.append(np.repeat(rows, c).astype(np.int32))
                v_cols.append(pc[base + within])
        say(f"  讀圖 {e:,}/{n_img:,}，留下 {kept:,} 個 tag（{time.monotonic() - t0:.0f} 秒）")
    indices = np.concatenate(idx_parts)
    del idx_parts
    data = np.ones(len(indices), dtype=np.int32)
    x = sp.csr_matrix((data, indices, indptr), shape=(n_img, k))
    x.sort_indices()
    xt = x.T.tocsr()
    del data, indices
    v = vt = None
    if g:
        r = np.concatenate(v_rows) if v_rows else np.zeros(0, np.int32)
        c = np.concatenate(v_cols) if v_cols else np.zeros(0, np.int32)
        v = sp.csr_matrix((np.ones(len(r), dtype=np.int32), (r, c)), shape=(n_img, g))
        v.sum_duplicates()
        v.data[:] = 1  # 一張圖同時有 black shoes、black boots：合併欄只算一次
        vt = v.T.tocsr()
        del r, c, v_rows, v_cols
    co = np.zeros((k + g, k + g), dtype=np.int32)
    t0 = time.monotonic()
    for s in range(0, k, BLOCK):
        e = min(k, s + BLOCK)
        co[s:e, :k] = (xt[s:e] @ x).toarray()
        if g:
            co[s:e, k:] = (xt[s:e] @ v).toarray()
        say(f"  共現 {e}/{k}（{time.monotonic() - t0:.0f} 秒）")
    if g:
        co[k:, :k] = (vt @ x).toarray()
        co[k:, k:] = (vt @ v).toarray()
    return co, n_img


# ---------------------------------------------------------------- 廢棄的字：看 wiki 換成哪些字

WIKI_CACHE = DEFAULT_CACHE / "wiki_pages.json"
WIKI_API = "https://danbooru.donmai.us/wiki_pages.json"
LINK = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")
# 不照 wiki 換的（照原樣，多半對不上、沒有相關清單）：
# - wiki 寫的是「兩個一起」（AND），不是「擇一」（OR）：合併欄只能算「擇一」。
# - 歧義太大、合起來就沒意義了：light brown hair ＝ brown ∪ blonde ∪ grey ∪ pink hair、walther 連到 weapon、
#   gingham 連到 paisley、bars 連到 progress bar…
WIKI_SKIP = {
    "night_sky",
    "light_brown_hair", "light_blue_hair", "dark_blue_hair",
    "walther", "gingham", "tall", "bars", "entrance", "head", ">o<",
}
# 角色牌的名字對不上、規則也推不出來的，直接寫（墨池的寫法 → 資料集的寫法）。
CHAR_FIX = {
    "tamamo_(fate)": "tamamo_no_mae_(fate)",
    "sans": "sans_(undertale)",
    "prosciutto": "prosciutto_(jojo)",
    "fran_(final_fantasy_xii)": "fran_(ff12)",
    "lust_(fullmetal_alchemist)": "lust_(fma)",
    "mordekaiser_(league_of_legends)": "mordekaiser_(league)",
    "vertin_(reverse_1999)": "vertin_(reverse:1999)",
    "stormtrooper_(star_wars)": "stormtrooper",
    "the_mandalorian_(star_wars)": "mandalorian",
}
# 合併欄不收太泛的字（breast hold 的 wiki 連到 breasts：一百多萬張，整欄就變成「有胸部」）。
WIKI_MAX_POSTS = 1_000_000
# 只用「轉址」那種 wiki：開頭就是 See [[…]] / Use [[…]] / For the … see [[…]]，或寫明 deprecated、ambiguous。
# 一般的說明頁（gym、three quarter view 介紹時順便連到別的字）連到的不是替代字，照用會算錯。
# 寫明廢棄的，整頁的連結都算（black footwear 的替代字列在 See also 底下）；其他只看第一段（See also 不算）。
DEPRECATED = re.compile(r"deprecat|ambiguous", re.I)
REDIRECT = re.compile(r"\s*(see|use|for the)\b", re.I)


def fetch_wikis(names: list[str]) -> dict[str, str | None]:
    """Danbooru 的 wiki 內文（快取在 wiki_pages.json；沒有 wiki 的記 None，不再問）。一次問 20 頁。"""
    cache = json.loads(WIKI_CACHE.read_text(encoding="utf-8")) if WIKI_CACHE.exists() else {}
    todo = [n for n in names if n not in cache]
    for i in range(0, len(todo), 20):
        batch = todo[i:i + 20]
        q = {"search[title_comma]": ",".join(batch), "only": "title,body", "limit": "100"}
        url = WIKI_API + "?" + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.loads(r.read().decode("utf-8"))
        got = {w["title"]: w.get("body") or "" for w in rows}
        for n in batch:
            cache[n] = got.get(n)
        say(f"  wiki {min(i + 20, len(todo))}/{len(todo)}")
        time.sleep(1.0)
    if todo:
        WIKI_CACHE.write_bytes(json.dumps(cache, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    return cache


def replacements(tag: str, body: str | None, vocab_index, cats, counts, banned_names) -> list[str]:
    """wiki 連到的字裡，資料集有、是一般 tag、至少 20 張圖的（不含自己、不含永遠不抽的字）。"""
    if not body or to_danbooru(tag) in WIKI_SKIP:
        return []
    main = re.split(r"^h\d\.", body, maxsplit=1, flags=re.M)[0]
    dep = DEPRECATED.search(main)
    if not dep and not REDIRECT.match(main):
        return []
    # 「Use [[on ground]] + [[grass]]」是兩個一起（AND），合併欄只能算「擇一」：不用。
    if re.search(r"\]\]\s*\+\s*\[\[", main):
        return []
    out = []
    for m in LINK.findall(body if dep else main):
        name = to_danbooru(m.lower())
        if name == to_danbooru(tag) or name in banned_names or name in out:
            continue
        i = vocab_index.get(name)
        if i is not None and cats[i] == "general" and 20 <= counts[i] <= WIKI_MAX_POSTS:
            out.append(name)
    return out


# ---------------------------------------------------------------- 整理成關聯檔

def build(data, general, co, col_of_tag, n_img, out: Path, top: int, min_cos: float, min_lift: float,
          child_share: float, quiet=False) -> dict:
    tags = lexicon_tags(data)
    # 2026-11-27 專案主：資料照樣算、照樣存未成年的字（HARD_BANNED）和禁用角色的關聯 ——
    # 它們自己的清單、出現在別張的清單裡都留著；顯示時才由硬封鎖擋掉（server.py 的 related_payload
    # 回傳前把問的牌和清單裡的牌都過一次 _HARD_BANNED、characterBan；web6/related.js 再擋一次）。
    every = crawl_tags(data)  # 詞庫＋禁用角色＋永遠不抽的字
    banned = hard_banned()
    char_ban = {str(t).lower() for t in data.get("characterBan") or []}
    cast = {x["tag"] for x in data.get("tags", []) if x.get("section") == "subject" and x.get("group") != "character"}
    chars = {x["tag"] for x in data.get("tags", []) if x.get("group") == "character"} | {
        t for t in every if t.lower() in char_ban}
    # 人數、性別組合（1girl、solo、hetero…）是 chooseCast 決定的，不是「搭配」：兩邊都不收。
    blocked = lambda t: t in cast  # noqa: E731
    n = np.diag(co).astype(np.float64)  # 每個字幾張圖

    # guard：P(某個永遠不抽的字 | 這張牌) 取最大的。
    banned_cols = sorted({col_of_tag[b] for b in banned if b in col_of_tag})
    guard: dict[str, float] = {}
    if child_share and banned_cols:
        for t in tags:
            if t in banned or t not in col_of_tag:
                continue
            c = col_of_tag[t]
            if n[c] <= 0:
                continue
            share = float(co[c, banned_cols].max()) / n[c]
            if share >= child_share:
                guard[t] = share

    blocked_key = lambda t: blocked(t) or (t in guard and t not in chars)  # noqa: E731
    blocked_value = lambda t: blocked(t) or t in guard or t in chars  # noqa: E731
    # 「相關」那一方：詞庫的牌和永遠不抽的字、Danbooru 上是一般 tag（跟 API 的 category=0 一樣）。
    values = [t for t in every if t in col_of_tag and not blocked_value(t) and general.get(t)]
    vcols = np.asarray([col_of_tag[t] for t in values], dtype=np.int64)
    vn = n[vcols]
    related = {}
    keys = 0
    for t in every:
        if t not in col_of_tag or blocked_key(t):
            continue
        c = col_of_tag[t]
        if n[c] <= 0:
            continue
        keys += 1
        both = co[c, vcols].astype(np.float64)
        with np.errstate(divide="ignore", invalid="ignore"):
            cos = both / np.sqrt(n[c] * vn)
            lift = both * n_img / (n[c] * vn)
        ok = (cos >= min_cos) & (vcols != c)  # 同一個 Danbooru 字（詞庫的別名卡）不算相關
        if min_lift:
            ok &= lift >= min_lift
        idx = np.nonzero(ok)[0]
        if not len(idx):
            continue
        best = sorted(((-cos[i], values[i]) for i in idx))[:top]
        related[t] = [x for negcos, name in best for x in (name, int(round(-negcos * 1000)))]
    # 照詞庫順序寫（diff 好看），禁用角色、永遠不抽的字接在後面
    related = {t: related[t] for t in every if t in related}
    doc = {
        "version": 1,
        "source": f"{HF_REPO}（{n_img:,} 張圖）＋ Danbooru tag_aliases，本機全站精確計算",
        "built": time.strftime("%Y-%m-%d"),
        "minCos": min_cos,
        "minLift": min_lift,
        "childShare": child_share,
        "top": top,
        "fetched": keys,
        "count": len(related),
        "guard": sorted(guard),
        "related": related,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    out.write_bytes(text.encode("utf-8"))
    if not quiet:
        gz = len(gzip.compress(text.encode("utf-8"), 9))
        pairs = sum(len(v) // 2 for v in related.values())
        say(f"關聯檔：{out}")
        say(f"  算了 {keys} 張牌、有關聯的 {len(related)} 張、關聯 {pairs} 條")
        say(f"  {len(text.encode('utf-8')) / 1024:.1f} KB（gzip {gz / 1024:.1f} KB）")
        say(f"  guard（{child_share:.0%} 以上的圖同時有永遠不抽的字）{len(guard)} 張")
    return doc, guard


def compare(doc, cache: Cache, data, top: int):
    """跟爬蟲（API 抽樣）的結果對照：同一張牌，前 top 名重疊幾張。"""
    from fetch_related_tags import build as crawl_build

    tmp = DEFAULT_CACHE / "crawl_build.json"
    crawled = crawl_build(cache, data, tmp, top, doc["minCos"], doc["minLift"], doc["childShare"], quiet=True)
    a, b = doc["related"], crawled["related"]
    common = [t for t in b if t in a]
    overlaps, top3 = [], 0
    for t in common:
        la, lb = a[t][::2], b[t][::2]
        overlaps.append(len(set(la) & set(lb)) / max(1, min(len(la), len(lb))))
        top3 += la[0] in lb[:3]
    say(f"跟爬蟲對照：兩邊都有清單的 {len(common)} 張")
    if overlaps:
        say(f"  前 {top} 名平均重疊 {np.mean(overlaps):.0%}、中位數 {np.median(overlaps):.0%}；"
            f"本機第一名在爬蟲前三名的 {top3 / len(common):.0%}")
    ga, gb = set(doc["guard"]), set(crawled["guard"])
    say(f"  guard：本機 {len(ga)}、爬蟲 {len(gb)}（爬蟲只抓了一部分）；只在本機的 {len(ga - gb)}、只在爬蟲的 {len(gb - ga)}")
    worst = sorted(zip(overlaps, common))[:10]
    for ov, t in worst:
        say(f"  差最多：{t} {ov:.0%}　本機 {a[t][::2][:6]}　爬蟲 {b[t][::2][:6]}")
    tmp.unlink(missing_ok=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--download", action="store_true", help="下載、解開資料集")
    ap.add_argument("--aliases", action="store_true", help="下載 Danbooru 別名表")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--top", type=int, default=12)
    ap.add_argument("--min-cos", type=float, default=0.05)
    ap.add_argument("--min-lift", type=float, default=2.0)
    # 2026-11-27 專案主：guard 不擋（0）。12% 會擋掉 294 張，多半是普通的成人牌（pussy 15%、missionary 13%：
    # Danbooru 上這類圖混了不少 loli）。永遠不抽的字（HARD_BANNED）、禁用角色照舊兩邊都拿掉，跟 guard 無關。
    ap.add_argument("--child-share", type=float, default=0.0,
                    help="這張牌的圖有幾成同時標了永遠不抽的字，就不推薦、不給清單（預設 0＝不擋）")
    ap.add_argument("--compare", action="store_true", help="跟爬蟲快取對照")
    ap.add_argument("--report", type=Path, default=DEFAULT_CACHE / "dataset_report.json",
                    help="對不上的 tag、guard 清單寫在這")
    args = ap.parse_args(argv)
    if args.download:
        return download()
    if args.aliases:
        return fetch_aliases()
    if not (DATA_DIR / "tag_ids.npy").exists():
        raise SystemExit("還沒有資料集：先跑 --download。")
    if not ALIASES.exists():
        raise SystemExit("還沒有別名表：先跑 --aliases。")

    data = load_lexicon()
    tags = crawl_tags(data)  # 詞庫＋禁用角色＋永遠不抽的字（guard 要用）
    names, cats, counts = load_vocab()
    vocab_index = {t: i for i, t in enumerate(names)}
    aliases = json.loads(ALIASES.read_text(encoding="utf-8"))
    cache = Cache(DEFAULT_CACHE)
    crawled = cache.done()
    found, missing = resolve(tags, vocab_index, aliases, crawled)
    renamed = {t: v[1] for t, v in found.items() if v[1] != to_danbooru(t)}
    say(f"墨池 {len(tags)} 個字：對上 {len(found)}（其中 {len(renamed)} 個靠別名換成新名）、對不上 {len(missing)}")

    # Danbooru 廢棄的字（black footwear、breast hold、coffee cup…：0 張圖，沒有別名，被拆成好幾個新字）：
    # 看 wiki 寫「改用哪些」，這張牌就當「圖裡有其中任何一個」算。牌名、提示詞不動。
    # 對不上的、和資料集裡不到 20 張圖的詞庫牌都查（後者多半也是廢棄的：black headwear 剩 1 張）。
    lex = set(lexicon_tags(data))
    banned_names = {to_danbooru(b) for b in hard_banned()}
    cand = [t for t in tags if t in lex and (t not in found or counts[found[t][0]] < 20)]
    wikis = fetch_wikis([to_danbooru(t) for t in cand])
    merged = {}
    for t in cand:
        reps = replacements(t, wikis.get(to_danbooru(t)), vocab_index, cats, counts, banned_names)
        if reps:
            merged[t] = reps
    for t in merged:
        found.pop(t, None)
    # 資料集有些用的是舊名（china_dress，Danbooru 現在叫 qipao）：別名表反過來查，新名 → 資料集裡的舊名。
    rev: dict[str, list[str]] = {}
    for old, new in aliases.items():
        rev.setdefault(new, []).append(old)
    for t in [t for t in missing if t not in merged]:
        olds = sorted({o for o in rev.get(to_danbooru(t), []) if o in vocab_index}, key=lambda o: -counts[vocab_index[o]])
        if len(olds) == 1:
            found[t] = (vocab_index[olds[0]], olds[0])
            renamed[t] = olds[0]
        elif olds:
            merged[t] = olds
    # 角色牌：墨池在名字後面加了作品名（frieza (dragon ball)），Danbooru 沒加（frieza）；
    # 或 Danbooru 分成好幾階段（artoria caster (swimsuit berserker) (fate) → …_(first_ascension)_(fate)、second、third）。
    # 只認資料集裡分類是 character 的。先找「名字再往後細分」的（合併算），再找拿掉最後一個括號的。
    chars = {x["tag"] for x in data.get("tags", []) if x.get("group") == "character"}
    char_names = [n for n, c in zip(names, cats) if c == "character"]
    for t in [t for t in missing if t not in merged and t not in found and t in chars]:
        n = to_danbooru(t)
        if n in CHAR_FIX:
            if CHAR_FIX[n] in vocab_index:
                found[t] = (vocab_index[CHAR_FIX[n]], CHAR_FIX[n])
                renamed[t] = CHAR_FIX[n]
            continue
        m = re.match(r"^(.*)(_\([^)]*\))$", n)
        base, last = (m.group(1), m.group(2)) if m else (n, "")
        parts = [c for c in char_names if c.startswith(n + "_(")]
        if not parts and last:
            parts = [c for c in char_names if c.startswith(base + "_(") and c.endswith(last)]
        if len(parts) == 1:
            found[t] = (vocab_index[parts[0]], parts[0])
            renamed[t] = parts[0]
        elif parts:
            merged[t] = parts
        elif last and base in vocab_index and cats[vocab_index[base]] == "character":
            found[t] = (vocab_index[base], base)
            renamed[t] = base
    missing = [t for t in missing if t not in merged and t not in found]
    say(f"廢棄的字看 wiki 換成新字合併算：{len(merged)} 張（查了 {len(cand)} 張）")

    # 每個用得到的 tag_id 一欄（詞庫的別名卡兩張對到同一個 id，共用一欄）；合併的牌接在後面，一張一欄。
    ids = sorted({v[0] for v in found.values()})
    col_of_vocab = np.full(len(names), -1, dtype=np.int32)
    col_of_vocab[ids] = np.arange(len(ids), dtype=np.int32)
    col_of_tag = {t: int(col_of_vocab[v[0]]) for t, v in found.items()}
    general = {t: cats[v[0]] == "general" for t, v in found.items()}
    merged_tags = list(merged)
    for j, t in enumerate(merged_tags):
        col_of_tag[t] = len(ids) + j
        general[t] = True
    groups = [[vocab_index[n] for n in merged[t]] for t in merged_tags]
    co, n_img = cooccurrence(col_of_vocab, len(ids), groups)

    doc, guard = build(data, general, co, col_of_tag, n_img, args.out, args.top, args.min_cos, args.min_lift,
                       args.child_share)
    diag = np.diag(co)
    rare = sorted((int(diag[col_of_tag[t]]), t) for t in lex if t in col_of_tag and diag[col_of_tag[t]] < 20)
    report = {
        "built": doc["built"],
        "images": n_img,
        "missing": [{"tag": t, "lexicon": t in lex} for t in missing],
        "renamed": renamed,
        "merged": {t: {"from": merged[t], "posts": int(co[col_of_tag[t], col_of_tag[t]])} for t in merged_tags},
        "rare": [{"tag": t, "posts": c} for c, t in rare],
        "guard": {t: round(v, 3) for t, v in sorted(guard.items(), key=lambda kv: -kv[1])},
    }
    args.report.write_bytes(json.dumps(report, ensure_ascii=False, indent=1).encode("utf-8"))
    miss_lex = [t for t in missing if t in lex]
    say(f"對不上的：詞庫的牌 {len(miss_lex)} 張、禁用角色／永遠不抽的字 {len(missing) - len(miss_lex)} 個；"
        f"圖不到 20 張的牌 {len(rare)} 張。清單在 {args.report}")
    if args.compare:
        compare(doc, cache, data, args.top)


if __name__ == "__main__":
    main()
