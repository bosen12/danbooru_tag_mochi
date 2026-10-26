"""卡面插畫：沒有就從 GitHub Release 下載（全年齡的縮圖包、原圖包），啟動檔會先叫這支。

    python scripts/fetch_card_art.py            # 缺圖才下載；已經有就什麼都不做
    python scripts/fetch_card_art.py --force    # 不管有沒有都再下載一次（一樣不覆蓋已經有的圖）
    python scripts/fetch_card_art.py --check    # 只看要不要下載：0 夠了、3 缺

插畫是用 ComfyUI 烘焙出來的（scripts/bake_card_art.py），不進 git（一包 50MB 以上，每次重烘都會讓歷史變大）。
git clone 下來的人第一次開墨池、疊印台、排字匣的卡牌模式時，這支把全年齡的兩包抓下來：
先抓縮圖包（約 30 MB，連 manifest），字盒馬上有圖；再抓原圖包（約 103 MB）。每一包都驗大小和 SHA-256、解壓到 web/cards/。
原圖還沒到的那段時間，伺服器拿縮圖頂著（server.py 的 static_path）。已經有的圖（自己烘的）一張都不覆蓋，manifest 只補沒有的條目。
唯一的例外：上一版公開包放的、之後重畫過的卡（包裡的 cards/previous.json 記著上一版的提示詞），
本機那張的提示詞跟上一版一模一樣時才換成新的 —— 那張是公開包放的、沒被自己重烘過。
打包用 scripts/pack_card_art.py。
敏感、色情分級的卡面不公開，要的話用自己的 ComfyUI 烘：python scripts/bake_card_art.py

退出碼：0 好了（或本來就有）、1 下載失敗（沒網路、GitHub 連不上）、2 檔案對不上（大小或雜湊錯）、3 缺圖（--check）。
輸出只用英文：cmd 的主控台字碼頁不是 UTF-8，中文會變亂碼。設 NO_CARD_FETCH=1 可以整個跳過。
只用標準函式庫。
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "web" / "cards"
# 換版時標記跟著換：有 v1 標記、沒有 v2 標記的人，下次啟動會去補 v2 多的那些。
MARKER = CARDS / ".card-art-v11"
# 縮圖包已經解好（原圖包還沒）：中斷、下次啟動直接從原圖包接著抓。
THUMB_MARKER = CARDS / ".card-art-v11-thumbs"
# 縮圖包裡記的「要換新的那些卡」（上一版公開包放的、這一版重畫了）：原圖包解的時候照它換原圖。
UPGRADE = CARDS / ".card-art-upgrade.json"

# v3（2026-09-28）：1160 張。跟 v2 只差拿掉 cel shading（Danbooru 停用、意思含糊）。v1、v2 留在 GitHub 給舊版本用。
# v4（2026-10-07）：1934 張。髮色、髮型改成頭肩特寫（字盒裡分得出差別）重烘；補上 v3 之後詞庫新增的全年齡牌。
#   已經有 v3 的人：圖都在但提示詞是舊的（have_enough 的 outdated）→ 抓一次，只換 v3 放的那些，自己烘的不碰。
# v5（2026-10-10）：1963 張。補上胸前互動、手的母題、擁抱的全年齡牌 29 張；group picture、sandwiched 重畫。
#   已經有 v4 的人：缺那 29 張（have_enough 一張一張看）→ 抓一次補上。
# v6（2026-10-12）：2564 張。補上 Grok 追加的帽子、手套、花紋、表情符號、焦點等 576 張全年齡牌；
#   騎馬、騎車、講電話帶出騎乘／說話之後提示詞變了，重畫 3 張。包裡有哪些卡記在 card_art_pack.json。
# v7（2026-10-13）：跟 v6 同一批圖，拆成縮圖包、原圖包。GitHub Release 到台灣每秒只有零點幾 MB，
#   一包 133 MB 要等快十分鐘，這段時間字盒全是字；先抓 30 MB 的縮圖，兩分鐘左右就有圖。
#   已經有 v6 的人：圖都在（have_enough 一張一張看）→ 不用抓。
# v8（2026-10-14）：2570 張。WAI v17 實測後的同名卡（scripts/alt_names.json）：舊名、替代字
#   （no legwear、sleeves past elbows、column、kyoto、gothic…）加成卡；只認新名的原卡（missing legwear、
#   three-quarter sleeves、colonnade…）不再放。v7 的卡沒有重畫。已經有 v7 的人：缺新加的那幾張 → 抓一次補上。
# v9（2026-10-24）：2613 張。補上摔角、觀眾、公開場合、族裔（Grok 兩輪實測）的全年齡牌 43 張；
#   彩球改成靜物。v8 的卡沒有重畫。已經有 v8 的人：缺那 43 張 → 抓一次補上。
# v10（2026-10-24）：3543 張。補上第四輪（Codex 468 張）和建議池（Grok 558 張）的全年齡牌 930 張；
#   romper、column lineup 抽檢後補提示詞重烤，性暗示改成敏感級不放。v9 的卡沒有重畫。已經有 v9 的人：缺那 930 張 → 抓一次補上。
# CARD_ART_BASE 可以換來源（測試時指向本機的 file:// 資料夾）；大小、雜湊照樣要對。
BASE = os.environ.get("CARD_ART_BASE") or "https://github.com/bosen12/danbooru_tag_mochi/releases/download/card-art-v11/"
THUMBS = {"name": "card-art-thumbs.zip", "size": 42723756, "sha256": "683c2831f8f0227217abd2e2c1d6a5451a1925510e13b7e1beb9fdd6d743ca8f"}
FULL = {"name": "card-art-full.zip", "size": 143243990, "sha256": "0403c486f07b9a616e85f289086df0827bc0f372c5e8a7cdb1fafe375257596c"}
EXPECTED = 3602  # 這一版全年齡的張數


JOBS = ROOT / "scripts" / "card_jobs.json"


def load_jobs():
    """卡面清單（card_jobs.json），換上卡冊「提示詞」視窗的自訂提示詞（card_art_custom.py）：
    改過的牌照自訂的比對，才不會被當成「舊版」又抓公開包回來。讀不到回 None。"""
    jobs = json.loads(JOBS.read_text(encoding="utf-8"))
    jobs = jobs if isinstance(jobs, list) else jobs.get("jobs", [])
    try:
        sys.path.insert(0, str(ROOT))
        import card_art_custom
        card_art_custom.apply(jobs)
    except Exception:  # noqa: BLE001 —— 自訂檔壞了照預設比對，不能讓第一次準備整個停掉
        pass
    return jobs


def stale_jobs(wanted) -> list:
    """本機 manifest 裡，全年齡卡的提示詞跟卡面清單（card_jobs.json）對不上的那些。"""
    try:
        manifest = json.loads((CARDS / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not isinstance(manifest, dict):
        return []
    out = []
    for j in wanted:
        have = manifest.get(j.get("tag"))
        if isinstance(have, dict) and have.get("positive") and j.get("positive") and have["positive"] != j["positive"]:
            out.append(j)
    return out


def outdated(wanted) -> bool:
    """本機 manifest 裡，有沒有全年齡卡的提示詞跟卡面清單（card_jobs.json）對不上。"""
    return bool(stale_jobs(wanted))


# 現在這一包公開卡面裡有哪些卡、各是哪一版的提示詞（{tag: positive}），pack_card_art.py 打包時寫。
# 換新包時跟著 BASE、THUMBS、FULL 一起換。讀不到就當作「包裡什麼都可能有」，照舊有缺就抓。
PACK_LIST = ROOT / "scripts" / "card_art_pack.json"


def pack_covers() -> dict | None:
    try:
        data = json.loads(PACK_LIST.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def have_enough() -> bool:
    """要不要下載：這一包解過了，或「現在詞庫裡每一張全年齡卡都已經有圖」（自己烘的也算）。

    以前是數 manifest 裡全年齡的圖有沒有到 EXPECTED 張。詞庫一刪字（例如拿掉停用的 cel shading），
    本機就少一張、永遠到不了那個數字，於是每次啟動都整包 55 MB 重抓，還把刪掉的那張加回來。
    現在照 scripts/card_jobs.json（跟著詞庫產生的卡面清單）一張一張看檔案在不在。
    """
    if MARKER.exists():
        return True
    try:
        jobs = load_jobs()
    except (OSError, ValueError):
        jobs = None
    if jobs:
        # 角色牌不在公開包裡（版權角色，每台自己烘）：缺角色圖不是下載的理由。
        wanted = [j for j in jobs if isinstance(j, dict) and j.get("rating", "general") == "general"
                  and j.get("kind", "card") != "character" and j.get("file")]
        if not wanted:
            return False
        absent = [j for j in wanted if not (CARDS / str(j["file"])).exists()]
        # 圖都在，但有的是舊版的（本機記的提示詞跟現在的卡面清單不一樣，例如 v4 把髮色、髮型改成頭肩特寫）：
        # 抓一次新的包。解包時只換「上一版公開包放的」那些（cards/previous.json），自己烘的不碰；
        # 抓完寫上這一版的標記，下次就不再抓，不會每次啟動都重抓。
        if not absent and not outdated(wanted):
            return True
        # 缺的、舊的都不在公開包裡（詞庫比包新，例如 2026-10-12 新加的 576 張）：抓一百 MB 也補不到，
        # 交給烘焙。包裡有哪些、各是哪一版提示詞記在 PACK_LIST（pack_card_art.py 打包時寫的）。
        covered = pack_covers()
        if covered is not None:
            gaps = absent + stale_jobs(wanted)
            return not any(covered.get(j.get("tag")) == j.get("positive") for j in gaps)
        return False
    # 讀不到卡面清單（檔案被刪了）：退回舊的數張數。
    try:
        manifest = json.loads((CARDS / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    ready = sum(
        1
        for v in manifest.values()
        if isinstance(v, dict) and v.get("rating", "general") == "general" and v.get("kind") != "character"
        and (CARDS / str(v.get("file", ""))).exists()
    )
    return ready >= EXPECTED


def missing_report() -> tuple[int, int, list[str]]:
    """缺什麼：(沒有圖的張數, 圖在但是舊版的張數, 幾個例子的 tag)。照 have_enough() 同一套判斷，
    給 --check 印出來（第一次準備的面板寫「缺幾張、例如哪些」）。讀不到卡面清單就回 (0, 0, [])。"""
    try:
        jobs = load_jobs()
    except (OSError, ValueError):
        return 0, 0, []
    wanted = [j for j in jobs if isinstance(j, dict) and j.get("rating", "general") == "general"
              and j.get("kind", "card") != "character" and j.get("file")]
    absent = [j for j in wanted if not (CARDS / str(j["file"])).exists()]
    try:
        manifest = json.loads((CARDS / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        manifest = {}
    stale = []
    if isinstance(manifest, dict):
        for j in wanted:
            have = manifest.get(j.get("tag"))
            if (CARDS / str(j["file"])).exists() and isinstance(have, dict) and have.get("positive")                     and j.get("positive") and have["positive"] != j["positive"]:
                stale.append(j)
    examples = [str(j.get("tag")) for j in (absent or stale)[:5]]
    return len(absent), len(stale), examples


# GitHub 放 release 檔的伺服器到台灣很慢（實測單一連線約 0.17 MB/s，55 MB 要 5 分多）。
# 切成幾段同時抓大約快一倍；每一段抓到哪裡都留在 PARTS 裡，斷線或下次啟動從斷的地方接著抓，不從頭來。
PARTS = CARDS / ".card-art-download"
# 切細一點（16 段）、同時跑 6 條：先抓完的連線接著抓下一段，最後不會只剩一兩條在慢慢收尾。
SEGMENTS = 16
WORKERS = 6
UA = {"User-Agent": "danbooru-tag-random/card-art"}


def _url(pack: dict) -> str:
    return BASE + pack["name"]


def _parts(pack: dict) -> Path:
    return PARTS / pack["name"].rsplit(".", 1)[0]


def _ranges_ok(url: str) -> bool:
    """伺服器肯不肯分段給（file:// 測試包、某些代理不給）：要一個位元組，回 206 才算。"""
    try:
        req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 206
    except Exception:  # noqa: BLE001
        return False


def _fetch_segment(url: str, parts: Path, i: int, start: int, end: int, progress: list) -> None:
    """抓 start..end（含）這一段到 parts/part-i；已經有的部分跳過，從斷的地方接著要。"""
    part = parts / f"part-{i}"
    want = end - start + 1
    for attempt in range(4):
        have = part.stat().st_size if part.exists() else 0
        if have > want:
            part.unlink()
            have = 0
        progress[i] = have
        if have == want:
            return
        try:
            req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={start + have}-{end}"})
            with urllib.request.urlopen(req, timeout=60) as r, part.open("ab") as f:
                if r.status != 206:
                    raise OSError(f"segment {i}: server ignored the range (HTTP {r.status})")
                while True:
                    chunk = r.read(1 << 16)
                    if not chunk:
                        break
                    f.write(chunk)
                    progress[i] += len(chunk)
            if part.stat().st_size == want:
                return
            raise OSError(f"segment {i} ended early")
        except (urllib.error.URLError, OSError, TimeoutError) as err:
            if attempt == 3:
                raise OSError(f"segment {i}: {err}") from err
            time.sleep(2 + attempt * 3)


def _download_parallel(dest: Path, url: str, size: int, parts: Path, label: str) -> None:
    import threading
    from concurrent.futures import ThreadPoolExecutor

    parts.mkdir(parents=True, exist_ok=True)
    (parts / "for").write_text(f"{url} {SEGMENTS}\n", encoding="utf-8")
    step = -(-size // SEGMENTS)
    spans = [(i, i * step, min(size, (i + 1) * step) - 1) for i in range(SEGMENTS)]
    progress = [0] * SEGMENTS
    done = threading.Event()

    def report() -> None:
        # 速度從第一次量到的那一刻算起（之前已經抓好的、上次接著抓的不算）；以前分母多算了開頭那三秒。
        t0 = None
        base = None
        while not done.wait(3):
            got = sum(progress)
            if base is None:
                base, t0 = got, time.time()
            speed = (got - base) / max(0.1, time.time() - t0) / 1e6
            print(f"  {label}{got * 100 // size:3d}%  {got / 1e6:5.1f}/{size / 1e6:.1f} MB  {speed:.2f} MB/s", flush=True)

    threading.Thread(target=report, daemon=True).start()
    try:
        with ThreadPoolExecutor(WORKERS) as pool:
            for fut in [pool.submit(_fetch_segment, url, parts, i, a, b, progress) for i, a, b in spans]:
                fut.result()
    finally:
        done.set()
    with dest.open("wb") as out:
        for i, _, _ in spans:
            out.write((parts / f"part-{i}").read_bytes())
    if dest.stat().st_size != size:
        raise OSError(f"incomplete download ({dest.stat().st_size} bytes, want {size})")


def _download_single(dest: Path, url: str, size: int, label: str) -> None:
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r, dest.open("wb") as f:
                total = int(r.headers.get("Content-Length") or size)
                got = 0
                shown = -1
                t0 = time.time()
                while True:
                    chunk = r.read(1 << 16)
                    if not chunk:
                        break
                    f.write(chunk)
                    got += len(chunk)
                    pct = got * 100 // max(1, total)
                    if pct // 10 != shown:
                        shown = pct // 10
                        speed = got / max(0.1, time.time() - t0) / 1e6
                        print(f"  {label}{pct:3d}%  {got / 1e6:5.1f}/{total / 1e6:.1f} MB  {speed:.1f} MB/s", flush=True)
            # 連線提早關掉時 read() 會回空字串，不會丟例外。短檔若直接當成功，
            # 後面的大小檢查失敗就結束，三次重試根本不會跑。
            if got != size:
                raise OSError(f"incomplete download ({got} bytes, want {size})")
            return
        except (urllib.error.URLError, OSError, TimeoutError) as err:
            last = err
            print(f"  download failed ({err}); retrying...", flush=True)
            time.sleep(2 + attempt * 3)
    raise last or RuntimeError("download failed")


def download(dest: Path, pack: dict, label: str = "") -> None:
    url, parts = _url(pack), _parts(pack)
    try:
        # 換版（網址不同）或分段方式不同，留下的片段都對不上：清掉重來。
        if (parts / "for").read_text(encoding="utf-8").strip() != f"{url} {SEGMENTS}":
            shutil.rmtree(parts, ignore_errors=True)
    except OSError:
        pass
    if _ranges_ok(url):
        _download_parallel(dest, url, pack["size"], parts, label)
    else:
        _download_single(dest, url, pack["size"], label)


def verify(path: Path, pack: dict) -> bool:
    if path.stat().st_size != pack["size"]:
        print(f"  size mismatch: {path.stat().st_size} != {pack['size']}")
        return False
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    if h.hexdigest() != pack["sha256"]:
        print("  sha256 mismatch")
        return False
    return True


def unpack(path: Path) -> tuple[int, int]:
    """解到 web/cards/：只放沒有的檔；manifest 只補沒有的條目。回傳（新放的圖、補的條目）。

    包裡有 manifest（縮圖包）：算出要換新的那些卡，記到 UPGRADE 給原圖包用。
    包裡沒有 manifest（原圖包）：照 UPGRADE 換原圖，換完刪掉它。"""
    CARDS.mkdir(parents=True, exist_ok=True)
    added = 0
    mpath = CARDS / "manifest.json"
    try:
        manifest = json.loads(mpath.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict):
            manifest = {}
    except (OSError, ValueError):
        manifest = {}
    with zipfile.ZipFile(path) as z:
        try:
            incoming = json.loads(z.read("cards/manifest.json").decode("utf-8"))
        except KeyError:
            incoming = None
        try:
            previous = json.loads(z.read("cards/previous.json").decode("utf-8"))
        except KeyError:
            previous = {}
        if incoming is None:
            # 原圖包：要換的那些是縮圖包解的時候算好的（那時 manifest 還是舊的，現在已經是新的了）。
            try:
                pending = json.loads(UPGRADE.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pending = []
            incoming, previous = {}, {}
        else:
            pending = None
        # 可以換新的：上一版公開包放的（本機提示詞 = 上一版的），而且這一版重畫了。
        upgrade = {
            k
            for k, v in incoming.items()
            if k in previous
            and isinstance(manifest.get(k), dict)
            and manifest[k].get("positive") == previous[k]
            and v.get("positive") != previous[k]
        }
        replace_files = set()
        for k in upgrade:
            f = str(incoming[k].get("file", ""))
            replace_files.update({f, f"thumb/{f}"})
        if pending is not None:
            replace_files.update(str(f) for f in pending if isinstance(f, str))
        elif upgrade:
            UPGRADE.write_text(json.dumps(sorted(f for f in replace_files if not f.startswith("thumb/"))), encoding="utf-8")
        for name in z.namelist():
            if not name.startswith("cards/") or name.endswith("/") or name in ("cards/manifest.json", "cards/previous.json"):
                continue
            rel = name[len("cards/"):]
            dest = (CARDS / rel).resolve()
            # 壓縮檔裡的路徑不能跑出 web/cards/（zip slip）。
            if not dest.is_relative_to(CARDS.resolve()):
                continue
            if dest.exists() and rel not in replace_files:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(z.read(name))
            os.replace(tmp, dest)
            added += 1
    if pending is not None:
        UPGRADE.unlink(missing_ok=True)
    fresh = {k: v for k, v in incoming.items() if k not in manifest or k in upgrade}
    if fresh:
        manifest.update(fresh)
        tmp = mpath.with_suffix(".json.part")
        tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, mpath)
    return added, len(fresh)


def main() -> int:
    if os.environ.get("NO_CARD_FETCH"):
        return 0
    force = "--force" in sys.argv
    if "--check" in sys.argv:
        # 啟動檔用：只看要不要下載，不下載。0 夠了、3 缺（啟動檔另開一個視窗去抓，網頁不用等）。
        if have_enough():
            return 0
        # 缺什麼印一行（只用英文：cmd 的主控台不是 UTF-8）。第一次準備的面板照這行寫中文。
        absent, stale, examples = missing_report()
        print(f"card art check: {absent} missing, {stale} outdated; e.g. {' | '.join(examples)}")
        return 3
    if not force and have_enough():
        return 0
    print(f"Card illustrations are missing. Downloading the all-ages set from GitHub: thumbnails first "
          f"(about {THUMBS['size'] // 1_000_000} MB), then full size (about {FULL['size'] // 1_000_000} MB)...")
    added = entries = 0
    with tempfile.TemporaryDirectory() as tmpdir:
        if force or not THUMB_MARKER.exists():
            rc, a, e = fetch_pack(THUMBS, Path(tmpdir), "")
            if rc:
                return rc
            added, entries = added + a, entries + e
            THUMB_MARKER.write_text(BASE + "\n", encoding="utf-8")
            # setup_tasks 認這一行：面板叫使用者重新整理（縮圖就有了），原圖背景接著抓。
            print("Card thumbnails ready. Reload the page to see them; full-size images continue in the background.", flush=True)
        rc, a, e = fetch_pack(FULL, Path(tmpdir), "[full] ")
        if rc:
            return rc
        added, entries = added + a, entries + e
    shutil.rmtree(PARTS, ignore_errors=True)
    MARKER.write_text(BASE + "\n", encoding="utf-8")
    THUMB_MARKER.unlink(missing_ok=True)
    print(f"Card art ready: {added} images added, {entries} manifest entries added (existing files kept).")
    return 0


def fetch_pack(pack: dict, tmpdir: Path, label: str) -> tuple[int, int, int]:
    """抓一包、驗、解。回傳（退出碼, 新放的圖, 補的條目）；退出碼 0 好了、1 下載失敗、2 對不上。"""
    zpath = tmpdir / pack["name"]
    try:
        download(zpath, pack, label)
    except Exception as err:  # noqa: BLE001 —— 沒網路就退回佔位牌（或縮圖），不要讓啟動檔停下來
        print(f"Could not download card art ({err}). Cards show a placeholder glyph for now.")
        return 1, 0, 0
    if not verify(zpath, pack):
        # 片段本身壞了（雜湊對不上）：下次從頭抓，不要接著壞的片段。
        shutil.rmtree(_parts(pack), ignore_errors=True)
        print("The downloaded file does not match. Not unpacking it; cards show a placeholder glyph for now.")
        return 2, 0, 0
    added, entries = unpack(zpath)
    shutil.rmtree(_parts(pack), ignore_errors=True)
    return 0, added, entries


if __name__ == "__main__":
    sys.exit(main())
