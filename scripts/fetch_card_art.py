"""卡面插畫：沒有就從 GitHub Release 下載（全年齡那一包），啟動檔會先叫這支。

    python scripts/fetch_card_art.py            # 缺圖才下載；已經有就什麼都不做
    python scripts/fetch_card_art.py --force    # 不管有沒有都再下載一次（一樣不覆蓋已經有的圖）
    python scripts/fetch_card_art.py --check    # 只看要不要下載：0 夠了、3 缺

插畫是用 ComfyUI 烘焙出來的（scripts/bake_card_art.py），不進 git（一包 50MB 以上，每次重烘都會讓歷史變大）。
git clone 下來的人第一次開墨池、疊印台、排字匣的卡牌模式時，這支把全年齡的那一包抓下來：
驗大小和 SHA-256、解壓到 web/cards/。已經有的圖（自己烘的）一張都不覆蓋，manifest 只補沒有的條目。
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
MARKER = CARDS / ".card-art-v5"

# v3（2026-09-28）：1160 張。跟 v2 只差拿掉 cel shading（Danbooru 停用、意思含糊）。v1、v2 留在 GitHub 給舊版本用。
# v4（2026-10-07）：1934 張。髮色、髮型改成頭肩特寫（字盒裡分得出差別）重烘；補上 v3 之後詞庫新增的全年齡牌。
#   已經有 v3 的人：圖都在但提示詞是舊的（have_enough 的 outdated）→ 抓一次，只換 v3 放的那些，自己烘的不碰。
# v5（2026-10-10）：1963 張。補上胸前互動、手的母題、擁抱的全年齡牌 29 張；group picture、sandwiched 重畫。
#   已經有 v4 的人：缺那 29 張（have_enough 一張一張看）→ 抓一次補上。
# CARD_ART_URL 可以換來源（測試時指向本機的 file:// 包）；大小、雜湊照樣要對。
URL = os.environ.get("CARD_ART_URL") or "https://github.com/bosen12/danbooru_tag_mochi/releases/download/card-art-v5/card-art-general.zip"
SIZE = 101518776
SHA256 = "87ebbbfcc170de54c4172c469a8f549db5f56c8890a1a21c467188323a8bb0b6"
EXPECTED = 1963  # 這一包裡全年齡的張數


JOBS = ROOT / "scripts" / "card_jobs.json"


def outdated(wanted) -> bool:
    """本機 manifest 裡，有沒有全年齡卡的提示詞跟卡面清單（card_jobs.json）對不上。"""
    try:
        manifest = json.loads((CARDS / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    if not isinstance(manifest, dict):
        return False
    for j in wanted:
        have = manifest.get(j.get("tag"))
        if isinstance(have, dict) and have.get("positive") and j.get("positive") and have["positive"] != j["positive"]:
            return True
    return False


def have_enough() -> bool:
    """要不要下載：這一包解過了，或「現在詞庫裡每一張全年齡卡都已經有圖」（自己烘的也算）。

    以前是數 manifest 裡全年齡的圖有沒有到 EXPECTED 張。詞庫一刪字（例如拿掉停用的 cel shading），
    本機就少一張、永遠到不了那個數字，於是每次啟動都整包 55 MB 重抓，還把刪掉的那張加回來。
    現在照 scripts/card_jobs.json（跟著詞庫產生的卡面清單）一張一張看檔案在不在。
    """
    if MARKER.exists():
        return True
    try:
        jobs = json.loads(JOBS.read_text(encoding="utf-8"))
        jobs = jobs if isinstance(jobs, list) else jobs.get("jobs", [])
    except (OSError, ValueError):
        jobs = None
    if jobs:
        # 角色牌不在公開包裡（版權角色，每台自己烘）：缺角色圖不是下載的理由。
        wanted = [j for j in jobs if isinstance(j, dict) and j.get("rating", "general") == "general"
                  and j.get("kind", "card") != "character" and j.get("file")]
        if not wanted or not all((CARDS / str(j["file"])).exists() for j in wanted):
            return False
        # 圖都在，但有的是舊版的（本機記的提示詞跟現在的卡面清單不一樣，例如 v4 把髮色、髮型改成頭肩特寫）：
        # 抓一次新的包。解包時只換「上一版公開包放的」那些（cards/previous.json），自己烘的不碰；
        # 抓完寫上這一版的標記，下次就不再抓，不會每次啟動都重抓。
        return not outdated(wanted)
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


# GitHub 放 release 檔的伺服器到台灣很慢（實測單一連線約 0.17 MB/s，55 MB 要 5 分多）。
# 切成幾段同時抓大約快一倍；每一段抓到哪裡都留在 PARTS 裡，斷線或下次啟動從斷的地方接著抓，不從頭來。
PARTS = CARDS / ".card-art-download"
# 切細一點（16 段）、同時跑 6 條：先抓完的連線接著抓下一段，最後不會只剩一兩條在慢慢收尾。
SEGMENTS = 16
WORKERS = 6
UA = {"User-Agent": "danbooru-tag-random/card-art"}


def _ranges_ok() -> bool:
    """伺服器肯不肯分段給（file:// 測試包、某些代理不給）：要一個位元組，回 206 才算。"""
    try:
        req = urllib.request.Request(URL, headers={**UA, "Range": "bytes=0-0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 206
    except Exception:  # noqa: BLE001
        return False


def _fetch_segment(i: int, start: int, end: int, progress: list) -> None:
    """抓 start..end（含）這一段到 PARTS/part-i；已經有的部分跳過，從斷的地方接著要。"""
    part = PARTS / f"part-{i}"
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
            req = urllib.request.Request(URL, headers={**UA, "Range": f"bytes={start + have}-{end}"})
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


def _download_parallel(dest: Path) -> None:
    import threading
    from concurrent.futures import ThreadPoolExecutor

    PARTS.mkdir(parents=True, exist_ok=True)
    (PARTS / "for").write_text(f"{URL} {SEGMENTS}\n", encoding="utf-8")
    step = -(-SIZE // SEGMENTS)
    spans = [(i, i * step, min(SIZE, (i + 1) * step) - 1) for i in range(SEGMENTS)]
    progress = [0] * SEGMENTS
    done = threading.Event()

    def report() -> None:
        t0 = time.time()
        base = None
        while not done.wait(3):
            got = sum(progress)
            if base is None:
                base = got
            speed = (got - base) / max(0.1, time.time() - t0) / 1e6
            print(f"  {got * 100 // SIZE:3d}%  {got / 1e6:5.1f}/{SIZE / 1e6:.1f} MB  {speed:.2f} MB/s", flush=True)

    threading.Thread(target=report, daemon=True).start()
    try:
        with ThreadPoolExecutor(WORKERS) as pool:
            for fut in [pool.submit(_fetch_segment, i, a, b, progress) for i, a, b in spans]:
                fut.result()
    finally:
        done.set()
    with dest.open("wb") as out:
        for i, _, _ in spans:
            out.write((PARTS / f"part-{i}").read_bytes())
    if dest.stat().st_size != SIZE:
        raise OSError(f"incomplete download ({dest.stat().st_size} bytes, want {SIZE})")


def _download_single(dest: Path) -> None:
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(URL, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r, dest.open("wb") as f:
                total = int(r.headers.get("Content-Length") or SIZE)
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
                        print(f"  {pct:3d}%  {got / 1e6:5.1f}/{total / 1e6:.1f} MB  {speed:.1f} MB/s", flush=True)
            # 連線提早關掉時 read() 會回空字串，不會丟例外。短檔若直接當成功，
            # 後面的大小檢查失敗就結束，三次重試根本不會跑。
            if got != SIZE:
                raise OSError(f"incomplete download ({got} bytes, want {SIZE})")
            return
        except (urllib.error.URLError, OSError, TimeoutError) as err:
            last = err
            print(f"  download failed ({err}); retrying...", flush=True)
            time.sleep(2 + attempt * 3)
    raise last or RuntimeError("download failed")


def download(dest: Path) -> None:
    # 上一次沒抓完、而且是別的網址（換版了）留下的片段不能接：清掉重來。
    try:
        # 換版（網址不同）或分段方式不同，留下的片段都對不上：清掉重來。
        if (PARTS / "for").read_text(encoding="utf-8").strip() != f"{URL} {SEGMENTS}":
            shutil.rmtree(PARTS, ignore_errors=True)
    except OSError:
        pass
    if _ranges_ok():
        _download_parallel(dest)
    else:
        _download_single(dest)


def verify(path: Path) -> bool:
    if path.stat().st_size != SIZE:
        print(f"  size mismatch: {path.stat().st_size} != {SIZE}")
        return False
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    if h.hexdigest() != SHA256:
        print("  sha256 mismatch")
        return False
    return True


def unpack(path: Path) -> tuple[int, int]:
    """解到 web/cards/：只放沒有的檔；manifest 只補沒有的條目。回傳（新放的圖、補的條目）。"""
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
        incoming = json.loads(z.read("cards/manifest.json").decode("utf-8"))
        try:
            previous = json.loads(z.read("cards/previous.json").decode("utf-8"))
        except KeyError:
            previous = {}
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
        return 0 if have_enough() else 3
    if not force and have_enough():
        return 0
    print("Card illustrations are missing. Downloading the all-ages set (about 100 MB) from GitHub...")
    with tempfile.TemporaryDirectory() as tmpdir:
        zpath = Path(tmpdir) / "card-art.zip"
        try:
            download(zpath)
        except Exception as err:  # noqa: BLE001 —— 沒網路就退回佔位牌，不要讓啟動檔停下來
            print(f"Could not download card art ({err}). Cards show a placeholder glyph for now.")
            return 1
        if not verify(zpath):
            # 片段本身壞了（雜湊對不上）：下次從頭抓，不要接著壞的片段。
            shutil.rmtree(PARTS, ignore_errors=True)
            print("The downloaded file does not match. Not unpacking it; cards show a placeholder glyph for now.")
            return 2
        added, entries = unpack(zpath)
    shutil.rmtree(PARTS, ignore_errors=True)
    MARKER.write_text(URL + "\n", encoding="utf-8")
    print(f"Card art ready: {added} images added, {entries} manifest entries added (existing files kept).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
