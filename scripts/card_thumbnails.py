"""牌面的「細縮圖」（mini）：墨池（web6）照牌實際畫出來的大小挑一張剛好的圖。

為什麼不是一張 200px 縮圖就好：
  牌面插畫是 object-fit: cover，桌機 DPR 1 一張牌約 91px 寬，插畫要縮到整張牌的寬度。
  Chromium 把圖縮小超過一半時改用 mipmap，線條會出現鋸齒（毛邊）；200px → 91px（2.2 倍）、
  原圖 480px → 92px（5.2 倍）都踩在這裡。實測（.planning/card-thumbnail-quality-2026-10-04.md）
  來源寬是畫出寬的 1.4～2 倍、而且長寬比跟原圖一樣時，最接近 8 倍超取樣的參考圖，所以準備一排寬度，網頁照
  「牌寬 × DPR」挑落在這個區間的那張。

檔案：web/cards/mini/<寬>/<檔名主幹>-<內容雜湊>.webp。檔名帶自己的雜湊：
  重做一張不會蓋掉舊網址的內容（舊 manifest 指的舊檔還在，換完 manifest 才清掉）。
manifest 那筆加 "mini": {"src": 原圖的 v, "w": {"120": 雜湊, ...}}。src 對不上原圖
  現在的 v（原圖重烤過）網頁就不用它，退回舊的縮圖／原圖。原圖、舊縮圖一個 byte 都不動。

只用 ffmpeg（make_card_thumbs.py 本來就靠它）；沒有 ffmpeg 就什麼都不做。
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
from pathlib import Path

MINI_DIR_NAME = "mini"
# 寬都是 80 的倍數：高 = 寬 × 702/480 剛好是整數，長寬比跟原圖一模一樣。實測比例差 0.3% 的
# （144×211）在某些牌寬會整張偏半個像素、糊一點；比例精確的在 89～94px 每種牌寬都穩。
# （試過給 70px 手牌的 120×176：比例差 0.3%，結果比 2.3 倍的 160 還差，所以不做。）
# 怎麼挑見 web6/card-images.js：大約 1.2～2 倍。桌機 DPR 1 的牌（90～92px）拿 160，
# DPR 1.5～2（含手機）拿 240，更大的拿 320；超過就用 480 的原圖（那時原圖也在 2 倍以內）。
MINI_WIDTHS = (160, 240, 320)
SRC_W, SRC_H = 480, 702
# 桌機 DPR 1 那張用 q95（跟無損幾乎一樣，SSIM 差 0.0001，檔案小一半多）；
# 給高 DPR 的大張 q90（像素小、看不出來），不然 320 就跟 480 原圖一樣大。
QUALITY = {160: 95}
QUALITY_DEFAULT = 90
_NAME = re.compile(r"^(?P<stem>.+)-(?P<h>[0-9a-f]{10})\.webp$")


def content_hash(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()[:10]


def mini_height(w: int) -> int:
    return max(1, round(SRC_H * w / SRC_W))


def mini_name(file: str, h: str) -> str:
    return f"{Path(file).stem}-{h}.webp"


def is_animated_webp(data: bytes) -> bool:
    """RIFF/WEBP 的 VP8X 區塊旗標第 2 位是動畫。動畫圖縮出來只剩第一格，不做。"""
    if len(data) < 21 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return False
    return data[12:16] == b"VP8X" and bool(data[20] & 0x02)


def probe_size(ffprobe: str, path: Path) -> tuple[int, int] | None:
    r = subprocess.run(
        [ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    try:
        w, h = (int(x) for x in r.stdout.strip().split(",")[:2])
        return w, h
    except ValueError:
        return None


def encode(ffmpeg: str, src: Path, dst: Path, w: int) -> bool:
    """縮到 w 寬：bicubic（實測比 lanczos、area 都更接近參考，振鈴也少）、全彩度縮放後才轉 webp。"""
    r = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-vf", f"scale={w}:{mini_height(w)}:flags=bicubic+accurate_rnd+full_chroma_int",
         "-c:v", "libwebp", "-quality", str(QUALITY.get(w, QUALITY_DEFAULT)), "-compression_level", "6", "-f", "webp", str(dst)],
        capture_output=True,
    )
    return r.returncode == 0 and dst.exists() and dst.stat().st_size > 0


def entry_is_current(card_dir: Path, entry: dict, widths=MINI_WIDTHS) -> bool:
    """manifest 那筆的 mini 還對得上原圖，而且每個檔都在。"""
    mini = entry.get("mini")
    if not isinstance(mini, dict) or not entry.get("v") or mini.get("src") != entry["v"]:
        return False
    hs = mini.get("w") or {}
    if not isinstance(hs, dict) or set(hs) != {str(w) for w in widths}:
        return False  # 牌階換過：重做
    return all(
        isinstance(hs.get(str(w)), str) and (card_dir / MINI_DIR_NAME / str(w) / mini_name(entry["file"], hs[str(w)])).is_file()
        for w in widths
    )


def build_entry(ffmpeg: str, ffprobe: str, card_dir: Path, entry: dict, widths=MINI_WIDTHS) -> dict | None:
    """做一張牌的整排 mini。全部做好、驗過尺寸才回傳要寫進 manifest 的 mini；任何一張失敗回 None
    （manifest 不動，網頁照舊用舊縮圖／原圖）。原圖只讀不寫。"""
    src = card_dir / entry["file"]
    try:
        data = src.read_bytes()
    except OSError:
        return None
    if is_animated_webp(data):
        return None
    v = content_hash(data)
    out = {"src": v, "w": {}}
    for w in widths:
        folder = card_dir / MINI_DIR_NAME / str(w)
        folder.mkdir(parents=True, exist_ok=True)
        tmp = folder / f".{Path(entry['file']).stem}.{os.getpid()}.tmp"
        try:
            if not encode(ffmpeg, src, tmp, w) or probe_size(ffprobe, tmp) != (w, mini_height(w)):
                return None
            h = content_hash(tmp.read_bytes())
            dst = folder / mini_name(entry["file"], h)
            if dst.is_file():
                tmp.unlink()
            else:
                os.replace(tmp, dst)
            out["w"][str(w)] = h
        finally:
            if tmp.exists():
                tmp.unlink()
    return out


def prune(card_dir: Path, manifest: dict) -> int:
    """manifest 已經不指的舊 mini 檔清掉（只動 mini/ 底下、檔名合規矩的）。回傳刪了幾個。"""
    keep: dict[str, set[str]] = {}
    for entry in manifest.values():
        mini = entry.get("mini") if isinstance(entry, dict) else None
        if isinstance(mini, dict):
            for w, h in (mini.get("w") or {}).items():
                keep.setdefault(w, set()).add(mini_name(entry["file"], h))
    removed = 0
    root = card_dir / MINI_DIR_NAME
    folders = [d for d in root.iterdir() if d.is_dir() and d.name.isdigit()] if root.is_dir() else []
    for folder in folders:
        w = folder.name
        for p in folder.iterdir():
            if p.is_file() and _NAME.match(p.name) and p.name not in keep.get(w, set()):
                p.unlink()
                removed += 1
        if not any(folder.iterdir()):
            folder.rmdir()  # 不再做的寬度
    return removed
