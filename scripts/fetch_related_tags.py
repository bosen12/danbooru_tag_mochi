#!/usr/bin/env python3
"""
從 Danbooru 的 Related Tags API 抓詞庫每張牌的「相關標籤」，整理成本地關聯檔（原型）。

  python scripts/fetch_related_tags.py --status            # 看進度：抓完幾個、空的、失敗的、還剩多少、估計還要多久
  python scripts/fetch_related_tags.py                     # 抓整本（一萬多個，好幾個小時；Ctrl+C 隨時停，下次接著抓）
  python scripts/fetch_related_tags.py --max 50            # 只抓 50 個還沒抓的就停
  python scripts/fetch_related_tags.py --tags "school uniform,cat ears"   # 只抓這幾個（測試用）
  python scripts/fetch_related_tags.py --retry-failed      # 上次重試用完還是失敗的，再試一次
  python scripts/fetch_related_tags.py --build             # 不連網，只把快取整理成關聯檔
  python scripts/fetch_related_tags.py --build --out .planning/related-tags/related_tags.preview.json

打的是 https://danbooru.donmai.us/related_tag.json?query=<tag>&category=0&order=cosine&limit=100
- category=0：只要一般標籤（衣服、姿勢、場景…）。角色牌問到的也是一般標籤（它的髮型、衣服）；
  不拿角色（category=4）：一般牌的詳情不會冒出角色推薦，也就不會推到禁用角色。
- order=cosine：照 cosine 相似度排（預設是照 frequency，前面全是 1girl、solo 這種到處都有的字）。
- limit=100：最多 500；實測 cosine 排第 100 名之後幾乎都低於 0.02，留 100 就夠，下載量只有 500 的五分之一。

快取（預設 scripts/.cache_related_tags/，不進 git）：
  results.jsonl   一行一個 tag 的結果（ok／empty／not_found）。只會往後加，重跑跳過已經有的。
  failures.jsonl  暫時失敗（逾時、5xx、429 重試用完）的紀錄；--retry-failed 才再抓。
  run.lock        同時只能跑一份；被強制關掉留下來的話，確定沒有在跑就刪掉。

限速：預設每秒最多 1 次（--rate 調，最多 2）。429 照 Retry-After 等；5xx、逾時、連線錯誤指數退避重試；
連續好幾次 403（Cloudflare 擋人）就整個停下來，不硬打。

關聯檔（--build，預設寫 web/related_tags.json）：
  只留詞庫裡有的牌、cosine 過門檻的；兩個方向取大的（A 的清單有 B、B 的清單沒有 A 也算）；
  每張牌留前 N 個。永遠不抽的字（web/card-art.js 的 HARD_BANNED）和禁用角色（lexicon.json 的
  characterBan）兩邊都拿掉：不會因為「相關」被推薦或被抽出來。

只用標準庫。User-Agent 固定 tag-check/1.0，不帶任何個人資訊。
"""
from __future__ import annotations

import argparse
import email.utils
import gzip
import json
import os
import random
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))  # hardban.py
LEXICON = ROOT / "web" / "lexicon.json"
CARD_ART = ROOT / "web" / "card-art.js"
DEFAULT_CACHE = ROOT / "scripts" / ".cache_related_tags"
DEFAULT_OUT = ROOT / "web" / "related_tags.json"

API = "https://danbooru.donmai.us/related_tag.json"
USER_AGENT = "tag-check/1.0"
PER_QUERY = 100  # 一次要幾筆（Danbooru 上限 500）
TIMEOUT = 30
MAX_ATTEMPTS = 6  # 一個 tag 最多試幾次（含第一次）
BACKOFF_BASE = 2.0  # 第 n 次重試等 2^n 秒（加一點亂數），最多 BACKOFF_CAP
BACKOFF_CAP = 120.0
MAX_FORBIDDEN_STREAK = 3
TOTAL_POSTS_FALLBACK = 12_583_571  # 2026-11-27 query 空白時回的 post_count（全站帖數）  # 連續幾個 tag 都 403 就停（多半是 Cloudflare 擋了）


def say(*parts):
    # Windows 主控台不一定是 UTF-8：印不出來的字換成 ?，不要讓爬蟲因為印字當掉。
    text = " ".join(str(p) for p in parts)
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        enc = sys.stdout.encoding or "ascii"
        print(text.encode(enc, "replace").decode(enc, "replace"), flush=True)


# ---------------------------------------------------------------- 詞庫

def load_lexicon(path: Path = LEXICON):
    data = json.loads(path.read_text(encoding="utf-8"))
    return data


def lexicon_tags(data) -> list[str]:
    return [t["tag"] for t in data.get("tags", [])]


def crawl_tags(data) -> list[str]:
    """要爬的字：詞庫的牌，加上禁用角色（characterBan）和永遠不抽的字（HARD_BANNED）。
    2026-11-27 專案主：任何 tag 都要爬，包括被 ban 的（資料留著看）。整理關聯檔時這些照舊兩邊都拿掉，
    不會被推薦、不會被抽出來（build 的 char_ban、HARD_BANNED、guard）。"""
    tags = lexicon_tags(data)
    seen = set(tags)
    extra = [str(t) for t in (data.get("characterBan") or [])]
    try:
        extra += sorted(hard_banned())
    except SystemExit:
        pass
    for t in extra:
        if t and t not in seen:
            seen.add(t)
            tags.append(t)
    return tags


def to_danbooru(tag: str) -> str:
    """墨池的 tag 用空白，Danbooru 用底線（跟 web6/danbooru-link.js 的 danbooruTag 一樣）。"""
    return re.sub(r"\s+", "_", tag.strip())


def hard_banned() -> set[str]:
    """永遠不抽的字（web/rules/hardban.js，唯一的一份；根目錄 hardban.py 讀）。讀不到就整個停：寧可不產檔。"""
    import hardban

    return set(hardban.load_hard_ban())


# ---------------------------------------------------------------- 快取

class Cache:
    def __init__(self, folder: Path):
        self.folder = folder
        self.results = folder / "results.jsonl"
        self.failures = folder / "failures.jsonl"
        self.lock = folder / "run.lock"
        self.meta = folder / "meta.json"
        folder.mkdir(parents=True, exist_ok=True)
        # 快取不進 git（.gitignore 的 scripts/.cache_*.json 只管檔案，管不到資料夾）：資料夾自己放一個。
        ignore = folder / ".gitignore"
        if not ignore.exists():
            ignore.write_bytes(b"*\n")

    @staticmethod
    def _read_jsonl(path: Path) -> list[dict]:
        if not path.exists():
            return []
        out = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    # 上次在寫到一半時被關掉：那一行不算，下次重抓那個 tag。
                    continue
        return out

    def done(self) -> dict[str, dict]:
        """已經有結果的 tag（後寫的蓋前面的）。"""
        out = {}
        for rec in self._read_jsonl(self.results):
            if isinstance(rec, dict) and rec.get("tag"):
                out[rec["tag"]] = rec
        return out

    def failed(self) -> dict[str, dict]:
        out = {}
        for rec in self._read_jsonl(self.failures):
            if isinstance(rec, dict) and rec.get("tag"):
                out[rec["tag"]] = rec
        return out

    @staticmethod
    def _append(path: Path, rec: dict):
        # 上一行沒寫完（沒有換行）就先補一個換行，新的這筆才不會黏在壞掉的那行後面。
        if path.exists() and path.stat().st_size:
            with path.open("rb") as f:
                f.seek(-1, os.SEEK_END)
                tail = f.read(1)
            if tail != b"\n":
                with path.open("ab") as f:
                    f.write(b"\n")
        line = json.dumps(rec, ensure_ascii=False, separators=(",", ":")) + "\n"
        with path.open("ab") as f:
            f.write(line.encode("utf-8"))
            f.flush()
            os.fsync(f.fileno())

    def total_posts(self) -> int:
        """Danbooru 全站帖數（算 lift 用）。沒抓過就用 2026-11 實測的數字。"""
        try:
            return int(json.loads(self.meta.read_text(encoding="utf-8")).get("total_posts")) or TOTAL_POSTS_FALLBACK
        except (OSError, ValueError, TypeError, AttributeError):
            return TOTAL_POSTS_FALLBACK

    def save_total(self, n: int):
        self.meta.write_bytes(json.dumps({"total_posts": n, "at": time.strftime("%Y-%m-%dT%H:%M:%S")}).encode("utf-8"))

    _write_lock = threading.Lock()

    def add_result(self, rec: dict):
        with self._write_lock:
            self._append(self.results, rec)

    def add_failure(self, rec: dict):
        with self._write_lock:
            self._append(self.failures, rec)

    def acquire(self, force: bool):
        if force and self.lock.exists():
            self.lock.unlink()
        try:
            fd = os.open(str(self.lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            raise SystemExit(
                f"另一份爬蟲好像在跑（{self.lock} 存在）。確定沒有在跑的話刪掉它，或加 --force。"
            )
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(f"pid {os.getpid()} since {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    def release(self):
        try:
            self.lock.unlink()
        except FileNotFoundError:
            pass


# ---------------------------------------------------------------- 連線

class Throttle:
    """兩次請求「開始」之間至少隔 interval 秒；429 的 Retry-After 讓整條線一起等。"""

    def __init__(self, rate: float):
        self.interval = 1.0 / rate
        self.next_at = 0.0
        self._lock = threading.Lock()

    def wait(self):
        # 多條連線（--workers）共用一個節流：輪到誰就先把下一個時間點佔好，再出去睡，彼此不會撞在同一刻。
        with self._lock:
            now = time.monotonic()
            start = max(now, self.next_at)
            self.next_at = start + self.interval
        if start > now:
            time.sleep(start - now)

    def hold(self, seconds: float):
        with self._lock:
            self.next_at = max(self.next_at, time.monotonic() + seconds)


class Fatal(Exception):
    """不該再打下去（一直被 403）。"""


def retry_after_seconds(value: str | None) -> float | None:
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return float(value)
    try:
        when = email.utils.parsedate_to_datetime(value)
        return max(0.0, when.timestamp() - time.time())
    except (TypeError, ValueError):
        return None


def backoff(attempt: int) -> float:
    return min(BACKOFF_CAP, BACKOFF_BASE ** attempt) + random.uniform(0, 1)


def request_once(query: str, per_query: int):
    params = urllib.parse.urlencode({"query": query, "category": 0, "order": "cosine", "limit": per_query})
    req = urllib.request.Request(
        f"{API}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json", "Accept-Encoding": "gzip"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read()
        size = len(raw)
        if resp.headers.get("Content-Encoding", "").lower() == "gzip":
            raw = gzip.decompress(raw)
        return json.loads(raw.decode("utf-8")), size


def compact(payload: dict, query: str) -> dict:
    """只留要用的欄位；小數留 4 位。related 每筆：[名字, 類別, 帖數, cosine, jaccard, overlap, frequency]。"""
    tag = payload.get("tag") or {}
    rel = []
    for r in payload.get("related_tags") or []:
        t = r.get("tag") or {}
        name = t.get("name")
        if not name:
            continue
        rel.append([
            name,
            t.get("category"),
            t.get("post_count"),
            round(float(r.get("cosine_similarity") or 0), 4),
            round(float(r.get("jaccard_similarity") or 0), 4),
            round(float(r.get("overlap_coefficient") or 0), 4),
            round(float(r.get("frequency") or 0), 4),
        ])
    return {
        "query": query,
        # 舊名（alias）Danbooru 會自己轉成現在的名字：query 是送出去的，resolved 是它回的。
        "resolved": payload.get("query"),
        "post_count": payload.get("post_count"),
        "category": tag.get("category"),
        "deprecated": tag.get("is_deprecated"),
        "related": rel,
        # 廢棄的 tag（night_sky 2025 年底被拆成 night＋sky）related 是空的，但 wiki 會列它該換成哪些字。
        # 只有空結果才記（有結果的不需要，省空間）。
        **({"wiki": [w.get("name") for w in payload.get("wiki_page_tags") or [] if w.get("name")][:20]} if not rel else {}),
    }


def fetch_tag(tag: str, throttle: Throttle, per_query: int, stats: dict):
    """回 (紀錄, None) 或 (None, 失敗原因)。紀錄的 status：ok／empty／not_found。"""
    query = to_danbooru(tag)
    if not query:
        return {"tag": tag, "status": "not_found", "reason": "空字串"}, None
    last = ""
    for attempt in range(MAX_ATTEMPTS):
        throttle.wait()
        t0 = time.monotonic()
        try:
            payload, size = request_once(query, per_query)
        except urllib.error.HTTPError as e:
            code = e.code
            last = f"HTTP {code}"
            if code == 429:
                wait = retry_after_seconds(e.headers.get("Retry-After")) or backoff(attempt + 2)
                stats["throttled"] += 1
                say(f"   429 太快了，等 {wait:.0f} 秒")
                throttle.hold(wait)
                continue
            if code == 403:
                stats["forbidden"] += 1
                raise Fatal(f"{tag}: HTTP 403（多半是 Cloudflare 擋了）")
            if 500 <= code < 600:
                wait = backoff(attempt + 1)
                say(f"   {last}，{wait:.0f} 秒後重試（第 {attempt + 1} 次）")
                throttle.hold(wait)
                continue
            if code in (404, 410, 422):
                return {"tag": tag, "query": query, "status": "not_found", "reason": last}, None
            # 其他 4xx：參數有問題，重試也一樣。
            return None, last
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = f"{type(e).__name__}: {getattr(e, 'reason', e)}"
            wait = backoff(attempt + 1)
            say(f"   連線失敗（{last}），{wait:.0f} 秒後重試")
            throttle.hold(wait)
            continue
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            # 回的不是 JSON（Cloudflare 的驗證頁之類）：當暫時錯誤重試。
            last = f"不是 JSON：{e}"
            throttle.hold(backoff(attempt + 1))
            continue
        stats["bytes"] += size
        stats["seconds"] += time.monotonic() - t0
        if not isinstance(payload, dict) or "related_tags" not in payload:
            last = "回傳格式不對"
            throttle.hold(backoff(attempt + 1))
            continue
        rec = {"tag": tag, **compact(payload, query), "fetched": time.strftime("%Y-%m-%dT%H:%M:%S")}
        # 不存在的 tag、廢棄的 tag（masterpiece 這種）：200 但 related 是空的。記下來，不重試。
        rec["status"] = "ok" if rec["related"] else "empty"
        return rec, None
    return None, last or "重試用完"


# ---------------------------------------------------------------- 整理成關聯檔

def build(cache: Cache, data, out: Path, top: int, min_cos: float, min_lift: float = 2.0, child_share: float = 0.12, quiet: bool = False) -> dict:
    tags = lexicon_tags(data)
    lex = set(tags)
    banned = hard_banned()
    char_ban = {str(t).lower() for t in data.get("characterBan") or []}
    # 人數、性別組合（1girl、solo、multiple girls、hetero…）是 chooseCast 決定的，不是「搭配」：兩邊都不收。
    cast = {x["tag"] for x in data.get("tags", []) if x.get("section") == "subject" and x.get("group") != "character"}
    blocked = lambda t: t in banned or t.lower() in char_ban or t in cast  # noqa: E731
    # Danbooru 名字 → 詞庫的 tag。詞庫用模型認得的寫法，有些是 Danbooru 的舊名：
    # 抓過的 tag 如果被轉成新名（resolved），新名也對回詞庫那張。
    name_to_lex = {to_danbooru(t): t for t in tags}
    results = cache.done()
    for t, rec in results.items():
        r = rec.get("resolved")
        if t in lex and r and r not in name_to_lex:
            name_to_lex[r] = t
    total = cache.total_posts()
    # 跟未成年的字（HARD_BANNED）很常一起出現的牌：這張牌的圖裡，有幾成同時標了 child、kindergarten uniform、
    # aged down… —— eden academy school uniform 68%、school hat 60%、kindergarten 46%、hairpods 30%、family 29%。
    # 這些牌本身照舊抽得到（不改現有規則），但不當任何牌的「相關」、自己也不給相關清單：
    # 關聯抽卡不會把它們往上推，詳情也不推薦。school uniform 只有 1.5%，不受影響。
    # 比例＝P(未成年的字 | 這張牌)：從未成年那張的清單算是 frequency × 它的帖數 ÷ 這張的帖數；
    # 從這張自己的清單算就是 frequency。兩邊取大的。
    banned_names = {to_danbooru(b) for b in banned}
    guard: dict[str, float] = {}
    if child_share:
        def mark(tag, share):
            if share >= child_share and tag not in banned:
                guard[tag] = max(guard.get(tag, 0), share)
        for t, rec in results.items():
            if rec.get("status") != "ok" or t not in lex:
                continue
            posts_t = rec.get("post_count") or 0
            for name, _cat, posts, _cos, _jac, _ovl, freq in rec.get("related") or []:
                other = name_to_lex.get(name)
                if t in banned and other and posts:
                    mark(other, freq * posts_t / posts)
                elif name in banned_names:
                    mark(t, freq)
    # 角色牌只當「問的那一方」：它的清單是它的招牌搭配（一般標籤）。它自己不當別張牌的相關
    # （API 只拿 category=0，本來就不會出現角色；這裡擋的是反方向補回來的那條）。
    # 角色被 guard 到（twilight、yor briar：跟女兒 anya 同框很多）只擋「被推薦」，自己的清單照留 ——
    # 清單裡每一張一般牌都各自過一次 guard。
    chars = {x["tag"] for x in data.get("tags", []) if x.get("group") == "character"}
    blocked_key = lambda t: blocked(t) or (t in guard and t not in chars)  # noqa: E731
    blocked_value = lambda t: blocked(t) or t in guard or t in chars  # noqa: E731
    edges: dict[str, dict[str, float]] = {}
    seen = 0
    for t, rec in results.items():
        if t not in lex or rec.get("status") != "ok" or blocked_key(t):
            continue
        seen += 1
        resolved = rec.get("resolved") or rec.get("query")
        for name, _cat, posts, cos, _jac, _ovl, freq in rec.get("related") or []:
            # Danbooru 上是同一個字（詞庫的別名卡：see-through ↔ see-through clothes、china dress ↔ qipao）：不算相關。
            if name == resolved:
                continue
            # 到處都有的字（1girl、long_hair、smile、looking_at_viewer…）cosine 不低，但只是「哪裡都有」：
            # 看 lift＝P(B|A) ÷ P(B)。school_uniform→long_hair 只有 1.1 倍（等於沒關係）、→skirt 3.0、→serafuku 11。
            # 不到 min_lift 倍的不收。lift 本來就對稱，兩個方向擋掉的是同一條。
            if min_lift and posts and total and freq / (posts / total) < min_lift:
                continue
            other = name_to_lex.get(name)
            if not other or other == t or blocked_value(other) or cos < min_cos:
                continue
            # 兩個方向都記、取大的：cosine 本來就對稱，只是各自的清單被截在前 100 名。
            # 反方向（other 的清單裡補上 t）要 t 也能當「相關」：角色、guard 的不補。
            for a, b in ((t, other), (other, t)):
                if b == t and blocked_value(t):
                    continue
                row = edges.setdefault(a, {})
                if cos > row.get(b, 0):
                    row[b] = cos
    related = {}
    for t in tags:  # 照詞庫的順序寫，diff 好看
        row = edges.get(t)
        if not row:
            continue
        best = sorted(row.items(), key=lambda kv: (-kv[1], kv[0]))[:top]
        # 扁平陣列：名字、cosine×1000（整數）、名字、cosine×1000…（比 [[名字, 數字], …] 小兩成）。
        related[t] = [x for name, cos in best for x in (name, int(round(cos * 1000)))]
    doc = {
        "version": 1,
        "source": "danbooru related_tag.json?category=0&order=cosine",
        "built": time.strftime("%Y-%m-%d"),
        "minCos": min_cos,
        "minLift": min_lift,
        "childShare": child_share,
        "top": top,
        "fetched": seen,
        "count": len(related),
        # 跟未成年的字常一起出現、所以不推薦也不加權的牌（給人看、也給網頁再擋一次）。
        "guard": sorted(guard),
        "related": related,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    out.write_bytes(text.encode("utf-8"))  # write_bytes：不要變成 CRLF
    if not quiet:
        gz = len(gzip.compress(text.encode("utf-8"), 9))
        pairs = sum(len(v) // 2 for v in related.values())
        say(f"關聯檔：{out}")
        say(f"  抓過的牌 {seen}、有關聯的牌 {len(related)}、關聯 {pairs} 條")
        say(f"  {len(text.encode('utf-8')) / 1024:.1f} KB（gzip {gz / 1024:.1f} KB）")
        if guard:
            say(f"  跟未成年的字常一起出現、不推薦不加權的 {len(guard)} 張（{child_share:.0%} 以上的圖同時有未成年的字）：")
            say("   ", "、".join(f"{t}（{guard[t]:.2f}）" for t in sorted(guard, key=lambda x: -guard[x])))
    return doc


# ---------------------------------------------------------------- 主程式

def status(cache: Cache, data, rate: float):
    tags = crawl_tags(data)
    done = cache.done()
    failed = cache.failed()
    lex = set(tags)
    kinds = {"ok": 0, "empty": 0, "not_found": 0}
    for t, rec in done.items():
        if t in lex:
            kinds[rec.get("status", "ok")] = kinds.get(rec.get("status", "ok"), 0) + 1
    left = [t for t in tags if t not in done]
    still_failed = [t for t in failed if t not in done]
    say(f"要爬 {len(tags)} 個（詞庫的牌＋禁用角色＋永遠不抽的字）；抓完 {sum(kinds.values())}（有結果 {kinds['ok']}、空的 {kinds['empty']}、"
        f"找不到 {kinds['not_found']}）；重試用完的 {len(still_failed)}；還剩 {len(left)}")
    # 實測一個請求約 0.5～1.5 秒；限速是「開始到開始」至少隔 1/rate 秒。
    per = max(1.0 / rate, 1.1)
    hrs = len(left) * per / 3600
    say(f"照每秒 {rate:g} 次估：還要大約 {hrs:.1f} 小時")
    if cache.results.exists():
        say(f"快取 {cache.results}：{cache.results.stat().st_size / 1024 / 1024:.1f} MB")


def main(argv=None):
    ap = argparse.ArgumentParser(description="抓 Danbooru 相關標籤，整理成墨池的關聯檔")
    ap.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help="快取資料夾")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="關聯檔要寫到哪")
    ap.add_argument("--rate", type=float, default=1.0, help="每秒最多幾次（預設 1，最多 3）")
    ap.add_argument("--workers", type=int, default=1, help="同時幾條連線（預設 1，最多 3）。一個請求要 0.5～1 秒，單條連線實際只到每秒 1.3 次")
    ap.add_argument("--max", type=int, default=0, help="這次最多抓幾個新的就停（0＝不限）")
    ap.add_argument("--tags", default="", help="只抓這幾個（逗號分開，墨池的寫法：空白不是底線）")
    ap.add_argument("--section", default="", help="只抓這一段（subject、feature、clothing、pose、env、quality）")
    ap.add_argument("--refetch", action="store_true", help="已經抓過的也重抓（配 --tags 用）")
    ap.add_argument("--retry-failed", action="store_true", help="只重抓上次重試用完的")
    ap.add_argument("--per-query", type=int, default=PER_QUERY, help="一次要幾筆（預設 100，Danbooru 上限 500）")
    ap.add_argument("--top", type=int, default=20, help="關聯檔每張牌留幾個（預設 20）")
    ap.add_argument("--min-cos", type=float, default=0.05, help="cosine 門檻（預設 0.05）")
    ap.add_argument("--child-share", type=float, default=0.0, help="這張牌的圖有幾成同時標了永遠不抽的字，就不推薦、不加權（預設 0＝不擋；2026-11-27 專案主決定）")
    ap.add_argument("--min-lift", type=float, default=2.0, help="lift 門檻：A 的圖裡出現 B 的比例，至少要是 B 平常比例的幾倍（預設 2；0＝不擋）")
    ap.add_argument("--build", action="store_true", help="不連網，只整理關聯檔")
    ap.add_argument("--no-build", action="store_true", help="抓完不整理關聯檔")
    ap.add_argument("--status", action="store_true", help="只看進度")
    ap.add_argument("--force", action="store_true", help="不管 run.lock")
    args = ap.parse_args(argv)

    rate = max(0.05, min(3.0, args.rate))
    workers = max(1, min(3, args.workers))
    per_query = max(1, min(500, args.per_query))
    cache = Cache(args.cache)
    data = load_lexicon()

    if args.status:
        status(cache, data, rate)
        return 0
    if args.build:
        build(cache, data, args.out, args.top, args.min_cos, args.min_lift, args.child_share)
        return 0

    tags = crawl_tags(data)
    lex = set(tags)
    lex_names = {to_danbooru(t) for t in tags}
    done = cache.done()
    if args.tags:
        todo = [t.strip() for t in args.tags.split(",") if t.strip()]
        for t in todo:
            if t not in lex:
                say(f"注意：「{t}」不在詞庫裡（照樣抓，整理關聯檔時不會用到）")
        if not args.refetch:
            todo = [t for t in todo if t not in done]
    elif args.retry_failed:
        todo = [t for t in cache.failed() if t not in done]
    else:
        todo = [t for t in tags if t not in done]
        if args.section:
            sec = {x["tag"]: x["section"] for x in data["tags"]}
            todo = [t for t in todo if sec.get(t) == args.section]
    if args.max > 0:
        todo = todo[: args.max]
    if not todo:
        say("沒有要抓的。")
        if not args.no_build:
            build(cache, data, args.out, args.top, args.min_cos, args.min_lift, args.child_share)
        return 0

    cache.acquire(args.force)
    throttle = Throttle(rate)
    stats = {"bytes": 0, "seconds": 0.0, "throttled": 0, "forbidden": 0, "ok": 0, "empty": 0, "not_found": 0, "failed": 0}
    started = time.monotonic()
    forbidden_streak = 0
    interrupted = False
    say(f"要抓 {len(todo)} 個，每秒最多 {rate:g} 次；Ctrl+C 隨時停，下次接著抓。")
    try:
        # 算 lift 要 Danbooru 全站帖數：query 空白時回的 post_count。一個月內抓過就不抓。
        fresh = cache.meta.exists() and time.time() - cache.meta.stat().st_mtime < 30 * 86400
        if not fresh:
            try:
                throttle.wait()
                payload, _ = request_once("", 1)
                if isinstance(payload, dict) and int(payload.get("post_count") or 0) > 1_000_000:
                    cache.save_total(int(payload["post_count"]))
            except Exception as e:  # noqa: BLE001 — 抓不到就用內建的數字，不影響爬
                say(f"   全站帖數抓不到（{e}），用內建的 {TOTAL_POSTS_FALLBACK}")
        lock = threading.Lock()
        stop = threading.Event()
        streak = [0]

        def one(i, tag):
            if stop.is_set():
                return
            try:
                rec, err = fetch_tag(tag, throttle, per_query, stats)
                with lock:
                    streak[0] = 0
            except Fatal as e:
                cache.add_failure({"tag": tag, "reason": str(e), "at": time.strftime("%Y-%m-%dT%H:%M:%S")})
                with lock:
                    streak[0] += 1
                    stats["failed"] += 1
                    if streak[0] >= MAX_FORBIDDEN_STREAK and not stop.is_set():
                        stop.set()
                        say(f"連續 {streak[0]} 次 403，先停下來（過一陣子再跑，會接著抓；或改回 --workers 1）。")
                throttle.hold(backoff(4))
                return
            if rec is None:
                cache.add_failure({"tag": tag, "reason": err, "at": time.strftime("%Y-%m-%dT%H:%M:%S")})
                with lock:
                    stats["failed"] += 1
                say(f"[{i}/{len(todo)}] {tag}：失敗（{err}），記下來，--retry-failed 再抓")
                return
            cache.add_result(rec)
            n = len(rec.get("related") or [])
            inlex = sum(1 for r in rec.get("related") or [] if r[0] in lex_names and r[0] != rec.get("resolved"))
            alias = f"（Danbooru 轉成 {rec['resolved']}）" if rec.get("resolved") and rec.get("resolved") != rec.get("query") else ""
            with lock:
                stats[rec["status"]] += 1
                say(f"[{i}/{len(todo)}] {tag}：{rec['status']} {n} 筆、詞庫裡有 {inlex}{alias}")

        if workers == 1:
            for i, tag in enumerate(todo, 1):
                one(i, tag)
                if stop.is_set():
                    break
        else:
            from concurrent.futures import ThreadPoolExecutor

            say(f"同時 {workers} 條連線。")
            with ThreadPoolExecutor(max_workers=workers) as pool:
                for i, tag in enumerate(todo, 1):
                    if stop.is_set():
                        break
                    pool.submit(one, i, tag)
                    # 不要一次把一萬多個都排進去（停下來時還要一個個清掉）：排著的超過 workers 的幾倍就等一下。
                    while pool._work_queue.qsize() > workers * 4 and not stop.is_set():
                        time.sleep(0.05)
    except KeyboardInterrupt:
        interrupted = True
        say("\n停了。抓好的都存著，下次照樣跑就接著抓。")
    finally:
        cache.release()
    took = time.monotonic() - started
    got = stats["ok"] + stats["empty"] + stats["not_found"]
    say(f"這次：有結果 {stats['ok']}、空的 {stats['empty']}、找不到 {stats['not_found']}、失敗 {stats['failed']}、"
        f"被要求放慢 {stats['throttled']} 次；{took:.0f} 秒、下載 {stats['bytes'] / 1024:.0f} KB（壓縮後）")
    if got:
        say(f"平均一個 {took / got:.2f} 秒、{stats['bytes'] / got / 1024:.1f} KB；請求本身平均 {stats['seconds'] / got:.2f} 秒")
    if not interrupted and not args.no_build:
        build(cache, data, args.out, args.top, args.min_cos, args.min_lift, args.child_share)
    return 130 if interrupted else 0


if __name__ == "__main__":
    sys.exit(main())
