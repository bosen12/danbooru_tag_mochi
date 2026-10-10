#!/usr/bin/env python3
"""卡牌插畫烘焙：整本詞庫的卡面（墨池、字鋪、排字匣的卡牌模式共用，放在 web/cards），加上字鋪的道具、客人、背景。

走 server.py 的內建工作流（同一個底模、同一套分級負面、同一組取樣參數），
只把最後的 SaveImage 換成「縮圖 → 存 webp」，所以 ComfyUI 的 output 資料夾不會
堆一千張 800KB 的 PNG，遊戲拿到的直接是 40KB 左右的卡圖。

    python scripts/bake_card_art.py                  # 整本詞庫的卡面，已經有的跳過
    python scripts/bake_card_art.py --rating general # 只烘全年齡（字鋪只用得到這些）
    python scripts/bake_card_art.py --only "red hair,kimono" --force
    python scripts/bake_card_art.py --extras         # 字鋪的道具、客人、背景（zipu/art/extras.json）
    python scripts/bake_card_art.py --limit 20
    python scripts/bake_card_art.py --status --rating general  # 啟動檔用：缺幾張、ComfyUI 有沒有開

沒裝 node 也能烤：清單會讀 scripts/card_jobs.json（`node scripts/card_art.mjs --write` 產生，跟詞庫一起進版控）。
同一時間只能有一個烘焙在跑（web/cards/.baking 心跳檔），兩個啟動檔都按了烘焙也不會重工。

每張卡照它自己的分級送（全年齡／敏感／色情），server 會配對應的負面詞。
loli、shota 不在清單裡（web/card-art.js 的 HARD_BANNED），永遠不畫。

插畫取決於你的底模，所以產物不進版控；沒有烘焙過的卡，遊戲會用純字版卡面。
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import server  # noqa: E402
sys.path.insert(0, str(ROOT / "scripts"))
import card_thumbnails  # noqa: E402

CARD_DIR = ROOT / "web" / "cards"
ART_DIR = ROOT / "zipu" / "art"
SEED = 1383
CARD_W, CARD_H = 832, 1216
THUMB_W, THUMB_H = 480, 702
# 格子用的小圖（字盒、牌堆）：一格約 90px，雙倍像素 180px。網頁用 srcset 自己挑。
THUMB_DIR_NAME = "thumb"
THUMB_SMALL_W, THUMB_SMALL_H = 200, 292
FFMPEG, FFPROBE = shutil.which("ffmpeg"), shutil.which("ffprobe")
EXTRA_TAIL = "sfw, general, masterpiece, best quality, amazing quality"


JOBS_FILE = ROOT / "scripts" / "card_jobs.json"
LOCK_NAME = ".baking"
LOCK_STALE = 600  # 心跳超過十分鐘沒更新，就當那個烘焙已經死了


def card_job_list() -> list[dict]:
    """有 node 就現算（改過詞庫也對）；沒有 node（一般使用者）就讀進版控的 card_jobs.json。"""
    try:
        out = subprocess.run(
            ["node", str(ROOT / "scripts" / "card_art.mjs"), "--prompts"],
            check=True, capture_output=True, text=True, encoding="utf-8",
        ).stdout
        return json.loads(out)
    except (OSError, subprocess.CalledProcessError, ValueError):
        return json.loads(JOBS_FILE.read_text(encoding="utf-8"))


def card_jobs() -> list[dict]:
    return [
        {"key": j["tag"], "file": j["file"], "positive": j["positive"], "negative": j.get("negative", ""),
         "rating": j["rating"], "kind": j.get("kind", "card"), "width": CARD_W, "height": CARD_H,
         "thumb": (THUMB_W, THUMB_H), "seed": SEED, "small": True}
        for j in card_job_list()
    ]


def extra_jobs() -> list[dict]:
    spec = json.loads((ART_DIR / "extras.json").read_text(encoding="utf-8"))
    jobs = []
    for j in spec["items"]:
        w, h = j.get("size", [CARD_W, CARD_H])
        tw, th = j.get("thumb", [THUMB_W, THUMB_H])
        jobs.append({"key": j["id"], "file": j["id"] + ".webp", "positive": j["positive"] + ", " + EXTRA_TAIL,
                     "width": w, "height": h, "thumb": (tw, th), "seed": j.get("seed", SEED)})
    return jobs


# 用哪個底模烤。main() 開烤前問過 ComfyUI 之後設好（見 pick_ckpt）。
CKPT_USE: str | None = None


def _same_ckpt(a: str, b: str) -> bool:
    a = a.replace("/", "\\")
    b = b.replace("/", "\\")
    return a == b or a.split("\\")[-1] == b.split("\\")[-1]


def pick_ckpt(wanted: str = "") -> tuple[str | None, str]:
    """挑烤卡面用的底模，回 (名稱, 要印出來的說明)。

    預設是 server.py 的 CKPT —— 那是作者自己機器上的檔名。別台電腦從 GitHub 拉下來，
    ComfyUI 裡多半沒有這個檔，每一張都會被退件（HTTP 400），一千多張全部失敗、
    下次啟動又問一次、永遠烤不出來。所以先問 ComfyUI 有哪些底模：
      - 指定了 --ckpt（或 COMFY_CKPT）就用那個，ComfyUI 沒有就報錯不烤；
      - 預設的有就用預設的；
      - 沒有就挑一個看起來是 Illustrious／SDXL 動漫底模的，都不像就第一個，並且說出來。
    插畫的畫風跟著底模走（卡面本來就不進版控），換一個底模烤出來的也能用。
    """
    try:
        names = [str(n).replace("/", "\\") for n in server.models_from_comfy("checkpoints")]
    except Exception:  # noqa: BLE001 —— 問不到就照舊用預設的，讓 ComfyUI 自己報錯
        names = []
    if wanted:
        hit = next((n for n in names if _same_ckpt(n, wanted)), None)
        if hit or not names:
            return hit or wanted, f"checkpoint: {hit or wanted}"
        return None, f"checkpoint {wanted} is not in ComfyUI ({len(names)} available). Nothing baked."
    default = str(server.CKPT)
    if not names:
        return default, f"checkpoint: {default} (ComfyUI did not list its checkpoints)"
    pick = server.pick_default_ckpt(names)
    if _same_ckpt(pick, default):
        return pick, f"checkpoint: {pick}"
    return pick, (
        f"checkpoint: {pick}  (the default {default} is not in this ComfyUI; "
        f"pass --ckpt NAME to choose another)"
    )


def workflow(job: dict) -> dict:
    wf = server.build_workflow(
        job["positive"], job["width"], job["height"], job["seed"], ckpt=CKPT_USE, rating=job.get("rating", "general")
    )
    # 這張牌自己的負面詞（web/card-art.js 的 artNegative：擋未成年、擋全家福構圖），
    # 接在 server 的分級負面詞後面。
    if job.get("negative"):
        wf["37"]["inputs"]["text"] = wf["37"]["inputs"]["text"] + ", " + job["negative"]
    tw, th = job["thumb"]
    wf.pop("200", None)
    wf["201"] = {
        "class_type": "ImageScale",
        "inputs": {"image": ["85", 0], "upscale_method": "lanczos", "width": tw, "height": th, "crop": "disabled"},
    }
    wf["202"] = {
        "class_type": "SaveAnimatedWEBP",
        "inputs": {"images": ["201", 0], "filename_prefix": "zipu/art", "fps": 1.0,
                   "lossless": False, "quality": 84, "method": "default"},
    }
    if job.get("small"):
        # 同一張圖再縮一份給格子用，一次生圖兩個尺寸，不必另外裝 ffmpeg。
        wf["203"] = {
            "class_type": "ImageScale",
            "inputs": {"image": ["85", 0], "upscale_method": "lanczos", "width": THUMB_SMALL_W, "height": THUMB_SMALL_H, "crop": "disabled"},
        }
        wf["204"] = {
            "class_type": "SaveAnimatedWEBP",
            "inputs": {"images": ["203", 0], "filename_prefix": "zipu/thumb", "fps": 1.0,
                       "lossless": False, "quality": 82, "method": "default"},
        }
    return wf


def fetch_output(hist: dict, node: str = "202") -> bytes:
    for img in (hist.get("outputs", {}).get(node, {}) or {}).get("images") or []:
        q = server.comfy_view_query(img.get("filename") or "", img.get("subfolder") or "", img.get("type") or "output")
        if q:
            with urllib.request.urlopen(server.comfy_base() + "/view?" + q, timeout=60) as r:
                return r.read()
    raise RuntimeError("ComfyUI 沒有產出 webp")


def save_manifest(path: Path, manifest: dict) -> None:
    """先寫暫存檔再換名。Windows 上網頁伺服器或測試剛好在讀 manifest 時，直接覆寫會
    丟 [Errno 22]（實際烤一千多張時碰過兩次）；write_text 又是先截斷再寫，失敗會留下
    半個 JSON。換名是原子的，被擋住就等一下再試。"""
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=0), encoding="utf-8")
    for attempt in range(8):
        try:
            os.replace(tmp, path)
            return
        except OSError:
            if attempt == 7:
                raise
            time.sleep(0.25 * (attempt + 1))


def pid_alive(pid: int) -> bool:
    """這個 pid 的程式還在不在。查不出來就當作還在（寧可多等，不要兩個烘焙同時跑）。"""
    if pid <= 0:
        return False
    if os.name == "nt":
        # Windows 不能用 os.kill(pid, 0)：0 以外的訊號會直接把那個程式殺掉。
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        try:
            code = ctypes.c_ulong()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                return True
            return code.value == 259  # STILL_ACTIVE
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except OSError:
        return True
    return True


def lock_state(out_dir: Path) -> bool:
    """另一個烘焙正在跑嗎：心跳檔夠新，而且寫它的那個程式還在。
    網頁上按「停止」是直接結束程式（Windows 來不及跑 release），鎖檔會留著、時間還很新；
    只看時間的話，十分鐘內重開就以為「另一個視窗正在烘」，角色、成人卡面也就不問了。"""
    lock = out_dir / LOCK_NAME
    try:
        if time.time() - lock.stat().st_mtime >= LOCK_STALE:
            return False
        text = lock.read_text(encoding="utf-8").strip()
    except OSError:
        return False
    return pid_alive(int(text)) if text.isdigit() else True


def heartbeat(out_dir: Path) -> None:
    try:
        (out_dir / LOCK_NAME).write_text(str(os.getpid()), encoding="utf-8")
    except OSError:
        pass


def release(out_dir: Path) -> None:
    try:
        (out_dir / LOCK_NAME).unlink()
    except OSError:
        pass


def pending(jobs: list[dict], out_dir: Path, manifest: dict) -> list[dict]:
    """圖在、而且 manifest 裡的提示詞還是現在這版，才算烤過。

    只有圖沒有紀錄的（上次寫 manifest 失敗）要補。提示詞或分級改過的也要重烤，
    不然啟動檔會把舊圖當成完成、新字永遠停在字形佔位牌。
    """
    todo = []
    for job in jobs:
        rec = manifest.get(job["key"])
        if not ((out_dir / job["file"]).exists() and isinstance(rec, dict)):
            todo.append(job)
            continue
        if rec.get("positive") != job.get("positive"):
            todo.append(job)
            continue
        if "rating" in job and rec.get("rating", "general") != job.get("rating", "general"):
            todo.append(job)
    return todo


def comfy_up() -> bool:
    try:
        return bool(server.ping().get("ok"))
    except Exception:  # noqa: BLE001 —— 連不上就是沒開
        return False


def status(args, out_dir: Path, manifest: dict, jobs: list[dict]) -> int:
    """給啟動檔用。退出碼：0 都有了、10 缺圖且 ComfyUI 開著、11 缺圖但 ComfyUI 沒開、12 已經在烤了。
    輸出只用英文：cmd 的主控台字碼頁不是 UTF-8，中文會變亂碼。"""
    todo = pending(jobs, out_dir, manifest)
    what = "zipu extras" if args.extras else (
        "character art" if args.kind == "character" else f"card art ({args.rating or 'all ratings'})")
    have = len(jobs) - len(todo)
    if not todo:
        print(f"{what}: {have}/{len(jobs)} ready")
        return 0
    if lock_state(out_dir):
        print(f"{what}: {have}/{len(jobs)} ready, baking in another window")
        return 12
    up = comfy_up()
    print(f"{what}: {have}/{len(jobs)} ready, {len(todo)} missing; ComfyUI {'is running' if up else 'is not running'}")
    return 10 if up else 11


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--extras", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--rating", choices=["general", "sensitive", "explicit"], default="")
    # 角色牌（版權角色）另外烘：不混進「全年齡缺的直接烘」，那一步會一次烘幾百張而不先問。
    ap.add_argument("--kind", choices=["card", "character"], default="card")
    ap.add_argument("--ckpt", default="", help="用哪個底模烤（ComfyUI 裡的名稱）；不給就用預設的，沒有就挑一個有的")
    args = ap.parse_args()

    out_dir = ART_DIR if args.extras else CARD_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    jobs = extra_jobs() if args.extras else card_jobs()
    if not args.extras:
        jobs = [j for j in jobs if j.get("kind", "card") == args.kind]
    if args.rating:
        jobs = [j for j in jobs if j.get("rating", "general") == args.rating]
    if args.only:
        want = {s.strip() for s in args.only.split(",") if s.strip()}
        jobs = [j for j in jobs if j["key"] in want]
    if args.status:
        return status(args, out_dir, manifest, jobs)
    if not args.force:
        jobs = pending(jobs, out_dir, manifest)
    if args.limit:
        jobs = jobs[: args.limit]
    if not jobs:
        print("nothing to bake", flush=True)
        return 0
    if lock_state(out_dir):
        print("another bake is already running (web/cards/.baking); not starting a second one", flush=True)
        return 0

    if not comfy_up():
        print("ComfyUI is not reachable at " + server.comfy_base())
        return 1
    global CKPT_USE
    CKPT_USE, note = pick_ckpt(args.ckpt or os.environ.get("COMFY_CKPT_BAKE", ""))
    print(note, flush=True)
    if CKPT_USE is None:
        return 1
    heartbeat(out_dir)

    print(f"{len(jobs)} to bake into {out_dir}", flush=True)
    t_all = time.time()
    try:
        return bake(jobs, out_dir, manifest_path, manifest, t_all)
    finally:
        release(out_dir)


def bake(jobs, out_dir, manifest_path, manifest, t_all) -> int:
    failed = 0
    for i, job in enumerate(jobs, 1):
        heartbeat(out_dir)
        t0 = time.time()
        try:
            prompt_id = server.api("POST", "/prompt", {"prompt": workflow(job)}, timeout=60)["prompt_id"]
            hist = server.wait_done(prompt_id)
            full = fetch_output(hist)
            (out_dir / job["file"]).write_bytes(full)
            # v：內容雜湊。網頁把它接在網址後面（?v=），伺服器看到就整年快取；重烤內容變了網址就跟著變。
            entry = {"file": job["file"], "seed": job["seed"], "positive": job["positive"],
                     "negative": job.get("negative", ""), "rating": job.get("rating", "general"),
                     "v": hashlib.sha1(full).hexdigest()[:10]}
            if job.get("kind") == "character":
                entry["kind"] = "character"
            if job.get("small"):
                try:
                    (out_dir / THUMB_DIR_NAME).mkdir(exist_ok=True)
                    (out_dir / THUMB_DIR_NAME / job["file"]).write_bytes(fetch_output(hist, "204"))
                    entry["thumb"] = True
                except Exception:  # noqa: BLE001 —— 縮圖沒拿到就用原圖，不算這張失敗
                    pass
            # 墨池的細縮圖（card_thumbnails.py）：有 ffmpeg 才做，沒做成照樣用上面的縮圖／原圖。
            if FFMPEG and FFPROBE:
                try:
                    mini = card_thumbnails.build_entry(FFMPEG, FFPROBE, out_dir, entry)
                    if mini and mini["src"] == entry["v"]:
                        entry["mini"] = mini
                except Exception:  # noqa: BLE001
                    pass
            manifest[job["key"]] = entry
            save_manifest(manifest_path, manifest)
            print(f"[{i}/{len(jobs)}] ok   {job['key']}  {time.time() - t0:.1f}s", flush=True)
        except Exception as exc:  # 一張失敗不擋整批，跑完再重跑就會補上
            failed += 1
            print(f"[{i}/{len(jobs)}] FAIL {job['key']}  {exc}", flush=True)
    if FFMPEG and FFPROBE:
        card_thumbnails.prune(out_dir, manifest)  # 重烤掉的那幾張舊細縮圖
    print(f"done {len(jobs) - failed}/{len(jobs)} in {time.time() - t_all:.0f}s", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
