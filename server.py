#!/usr/bin/env python3
"""Serve the tag-case UI and proxy one-at-a-time gens to local ComfyUI."""
from __future__ import annotations

import base64
import gzip
import hashlib
import ipaddress
import json
import mimetypes

# Windows 的 mimetypes 讀登錄檔，常常沒有 webp（卡面插畫全是 webp），
# 不補的話會送 application/octet-stream，靠瀏覽器自己猜才顯示得出來。
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")
import os
import queue
import random
import re
import socket
import ssl
import struct
import subprocess
import sys
import threading
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# ComfyUI 的 embedded Python 透過 ._pth 隔離匯入路徑，直接執行本檔時不一定會
# 把腳本目錄放進 sys.path。先固定本地模組根目錄，否則第一個 import 就會因
# 找不到 lora_scan 而退出；一般 Python 下此操作是冪等的。
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import card_usage
import card_decks
import gen_log
import lora_scan
import recipes
import setup_tasks
import workflows

# 這支程式原本把機器專屬的路徑寫死在原始碼裡（checkpoint 目錄、ComfyUI 位址…），
# 別人要跑就得改 server.py。全部搬到 config.json，優先序是：
#   環境變數  >  config.json  >  這裡的預設值
# 環境變數擺第一是為了不打斷既有的啟動腳本。config.json 不進版控，
# config.example.json 才是給人抄的範本。
CONFIG_PATH = Path(os.environ.get("APP_CONFIG", ROOT / "config.json"))


def _load_config() -> dict:
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, ValueError) as exc:
        # 設定檔壞掉要吵，不要安靜地套預設值 —— 不然使用者會以為自己改的有生效。
        print(f"[config] 讀不到 {CONFIG_PATH}：{exc}", flush=True)
        return {}
    return raw if isinstance(raw, dict) else {}


CONFIG = _load_config()


def cfg(path: str, env: str = "", default=None):
    """依序看環境變數、config.json 的 "a.b.c" 路徑、預設值。"""
    if env:
        got = os.environ.get(env, "").strip()
        if got:
            return got
    node = CONFIG
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return default if node is None or node == "" else node


WEB = (ROOT / str(cfg("paths.webDir", "WEB_DIR", "web"))).resolve()
SHARED = (ROOT / "web").resolve()
CKPT = str(cfg("comfy.ckpt", "COMFY_CKPT", r"illurtrious\waiIllustriousSDXL_v170.safetensors"))
# 沒設定就是 None，不要退回 Path("")：那會變成專案根目錄，然後被當成
# checkpoint 資料夾掃一遍。沒設定時 /api/checkpoints 就回空清單。
_ckpt_dir = cfg("comfy.checkpointDir", "COMFY_CKPT_DIR", "")


def _existing_dir(raw) -> Path | None:
    text = str(raw or "").strip().strip('"')
    if not text:
        return None
    cands = [Path(text)]
    # WSL 讀 Windows 路徑：C:\foo → /mnt/c/foo
    if len(text) >= 3 and text[1] == ":" and text[0].isalpha() and text[2] in "\\/":
        cands.append(Path("/mnt") / text[0].lower() / text[3:].replace("\\", "/"))
    for p in cands:
        try:
            if p.is_dir():
                return p
        except OSError:
            continue
    return cands[0]


CKPT_DIR = _existing_dir(_ckpt_dir)
# checkpointDir 底下再多一層子資料夾時填它（ComfyUI 的名字會是「子資料夾\檔名」）。預設沒有。
CKPT_PREFIX = str(cfg("comfy.checkpointPrefix", "COMFY_CKPT_PREFIX", ""))


def _prefix_subdir(folder: Path | None, prefix: str) -> Path | None:
    r"""checkpointDir 應該指到 checkpointPrefix 那一層（…\checkpoints\illurtrious），
    list_ckpts 只掃這一層、名字拼成 prefix\檔名。不少舊的 config.json 填的是整個
    …\checkpoints：那就把 prefix 子資料夾接上去，否則預覽圖和離線清單都對不上。"""
    if folder is None or not prefix or not folder.is_dir():
        return folder
    if folder.name.lower() == prefix.replace("/", "\\").split("\\")[-1].lower():
        return folder
    sub = folder / prefix
    return sub if sub.is_dir() else folder


_ckpt_dir_given = CKPT_DIR
CKPT_DIR = _prefix_subdir(CKPT_DIR, CKPT_PREFIX)
CKPT_EXTS = {".safetensors", ".ckpt", ".pt"}
CKPT_PREVIEW_EXTS = (
    ".preview.png",
    ".preview.jpeg",
    ".preview.jpg",
    ".preview.webp",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
)
def _negative() -> str:
    path = SHARED / "lexicon.json"
    if not path.is_file():
        path = WEB / "lexicon.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        n = str(data.get("negative") or "").strip()
        if n:
            return n
    except Exception:
        pass
    # Last resort if lexicon.json is missing. Source of truth: merge_lexicon.NEGATIVE
    # —— test_server.py 會比對兩者，避免正式詞庫與備援路徑漂移。
    return (
        "worst quality, bad quality, worst detail, sketch, bad hands, extra digits, censored, bar censor, mosaic censoring, watermark, signature, english text, speech bubble, 3d, photorealistic, inset, loli, child, aged down"
    )


NEGATIVE = _negative()


def _rating_negative(key: str, fallback: list) -> list:
    path = SHARED / "lexicon.json"
    if not path.is_file():
        path = WEB / "lexicon.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        got = data.get(key)
        if isinstance(got, list) and got:
            return [str(x) for x in got if str(x).strip()]
    except Exception:
        pass
    return list(fallback)


def _sfw_negative() -> list:
    path = SHARED / "lexicon.json"
    if not path.is_file():
        path = WEB / "lexicon.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        got = data.get("sfwNegative")
        if isinstance(got, list) and got:
            return [str(x) for x in got if str(x).strip()]
    except Exception:
        pass
    return ["nsfw", "explicit", "nude", "nipples", "pussy", "penis", "sex"]


SFW_NEGATIVE = _sfw_negative()


SENSITIVE_NEGATIVE = _rating_negative(
    "sensitiveNegative",
    ["explicit", "nude", "nipples", "pussy", "penis", "sex", "cum"],
)


def negative_for(rating) -> str:
    """依分級決定負面詞。

    正面那邊由 engine.js 換掉尾巴，而且該級不能出現的字根本抽不出來；
    這裡是第二道保險 —— 模型就算自己想畫，負面也會把它拉回來。

    為了相容舊的呼叫方式，傳 True/False 仍然當成 general／explicit。
    """
    if rating is True:
        rating = "general"
    elif rating is False or rating is None:
        rating = "explicit"
    if rating == "explicit":
        return NEGATIVE
    extra = SFW_NEGATIVE if rating == "general" else SENSITIVE_NEGATIVE
    add = [t for t in extra if t not in NEGATIVE]
    return NEGATIVE + (", " + ", ".join(add) if add else "")
_DEFAULT_ALLOW_NET = "127.0.0.0/8,100.64.0.0/10"

# 卡面 manifest 裡給烘焙腳本的欄位（提示詞、種子）佔了一半以上，瀏覽器用不到：
# 每一頁都要載它（手機走 Tailscale 時更有感），送出去之前拿掉。檔案本身不動。
_MANIFEST_BUILD_ONLY = ("positive", "negative", "seed")


def slim_card_manifest(raw: bytes) -> bytes:
    try:
        data = json.loads(raw)
    except ValueError:
        return raw
    if not isinstance(data, dict):
        return raw
    out = {
        tag: ({k: v for k, v in entry.items() if k not in _MANIFEST_BUILD_ONLY} if isinstance(entry, dict) else entry)
        for tag, entry in data.items()
    }
    return json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def parse_allow_nets(raw: str | None = None):
    if raw is None:
        raw = str(cfg("server.allowNet", "ALLOW_NET", ""))
    text = raw.strip() or _DEFAULT_ALLOW_NET
    return [ipaddress.ip_network(part.strip(), strict=False) for part in text.split(",") if part.strip()]


ALLOW_NETS = parse_allow_nets()


def allowed_client(addr: str, nets=None) -> bool:
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    if ip.version == 6 and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return any(ip in net for net in (ALLOW_NETS if nets is None else nets))


def mutation_request_error(origin: str, host: str, content_type: str, require_json: bool = True):
    """Return an HTTP error for browser cross-site/non-JSON mutations."""
    if origin:
        parsed = urllib.parse.urlparse(origin)
        if not parsed.netloc or parsed.netloc.casefold() != str(host or "").casefold():
            return 403, "跨站寫入已拒絕。"
    media_type = str(content_type or "").split(";", 1)[0].strip().casefold()
    if require_json and media_type != "application/json":
        return 415, "寫入 API 只接受 application/json。"
    return None


STEPS = int(cfg("comfy.steps", "", 25))
CFG = float(cfg("comfy.cfg", "", 6.5))
SAMPLER = str(cfg("comfy.sampler", "", "euler_ancestral"))
SCHEDULER = str(cfg("comfy.scheduler", "", "normal"))

# 網頁（工作流面板的「取樣參數」）可以每次指定 steps／CFG／denoise。夾在這個範圍裡，
# 手滑打成 500 步或 CFG 0 不會把 Comfy 卡住、也不會畫出一片灰。沒給就用設定檔／預設。
SAMPLING_LIMITS = {"steps": (1, 80), "cfg": (1.0, 15.0), "denoise": (0.05, 1.0)}


def sampling_value(raw, kind: str, default):
    """payload 裡的一個取樣參數：沒給、不是數字就用 default；給了就夾在 SAMPLING_LIMITS。"""
    if raw is None or raw == "" or isinstance(raw, bool):
        return default
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return default
    if v != v:  # NaN
        return default
    lo, hi = SAMPLING_LIMITS[kind]
    v = min(hi, max(lo, v))
    return int(round(v)) if kind == "steps" else round(v, 2)
SEED_MAX = 0xFFFFFFFFFFFFFFFF

# LoRA Manager（獨立埠 7861）點「送到 workflow」時 POST /api/lora-push。
# 單一格、版本號遞增、最新覆蓋前一個。epoch 每次啟動都換，避免瀏覽器記住的舊 ver
# 在伺服器重啟後把新推送當成已看過。跟 flux2klein/darkroom/preview_ui.py 同一套。
_LORA_PUSH = {"ver": 0, "data": None}
_LORA_PUSH_LOCK = threading.Lock()
# 長輪詢：GET 帶 wait=N 就在這裡等，POST 一進來就叫醒大家。
_LORA_PUSH_COND = threading.Condition(_LORA_PUSH_LOCK)
LORA_PUSH_MAX_WAIT = 25.0
_LORA_PUSH_EPOCH = uuid.uuid4().hex
_LORA_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def comfy_base() -> str:
    env = os.environ.get("COMFY_API", "").strip()
    if env:
        return env.rstrip("/")
    saved = workflows.saved_comfy_api()
    if saved:
        return saved
    return str(cfg("comfy.api", "", "http://127.0.0.1:8188")).rstrip("/")


def api(method: str, path: str, data=None, timeout: float = 60):
    url = comfy_base() + path
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"} if body else {},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if not raw:
            return None
        ctype = resp.headers.get("Content-Type", "")
        if "json" in ctype or raw[:1] in (b"{", b"["):
            return json.loads(raw.decode("utf-8"))
        return raw


_PING = {"t": 0.0, "val": None}
_STATIC: dict[str, dict] = {}
_GZIP_TYPES = {
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/json",
    "image/svg+xml",
}


# === 網頁裡自己的程式檔、樣式表帶上內容指紋 ===================================
# 走 Tailscale 的時候，每次重新整理都要把二十幾個 .js 逐一回來問「改了沒」（no-cache）；
# HTTP/1.1 一次只開 6 條連線，排成五批，光這段就要半秒。送出 HTML 時把自己的 .js／.css
# 換成帶內容雜湊的網址（?v=，這種網址整年快取），模組之間的 `import "./engine.js"`
# 交給 import map 對到同一個帶版本的網址 —— 重新整理時瀏覽器連問都不必問。
# 檔案一改雜湊就換；HTML 本身是 no-cache，下一次重新整理就拿到新的對照表，不會跑到舊程式。
_ASSET_SKIP_DIRS = {"vendor", "node_modules", "cards", "art", "data", "__pycache__"}
_ASSET_SCAN: dict = {"t": 0.0, "files": []}
_HTML_OUT: dict[str, dict] = {}
_IMPORTMAP_RE = re.compile(r'<script\s+type="importmap"\s*>(.*?)</script>\s*', re.S | re.I)
_TAG_RE = re.compile(r"<(?:script|link)\b[^>]*>", re.I)
_URL_ATTR_RE = re.compile(r'\b(src|href)="([^"]+)"', re.I)


def static_path(rel: str) -> Path | None:
    """網站上的相對路徑 → 磁碟上的檔：先找這個房間（WEB），找不到再退回共用的 web/。"""
    dest = (WEB / rel).resolve()
    if dest.is_relative_to(WEB) and dest.is_file():
        return dest
    shared = (SHARED / rel).resolve()
    if shared.is_relative_to(SHARED) and shared.is_file():
        return shared
    return None


def own_js_files() -> list[str]:
    """WEB、SHARED 底下自己寫的 .js（相對路徑，/ 分隔）。第三方（vendor）不收。兩秒內不重掃。"""
    now = time.time()
    if _ASSET_SCAN["files"] and now - _ASSET_SCAN["t"] < 2:
        return _ASSET_SCAN["files"]
    seen: set[str] = set()
    for base in {WEB, SHARED}:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in _ASSET_SKIP_DIRS and not d.startswith(".")]
            for name in files:
                if name.endswith(".js"):
                    seen.add(Path(root, name).relative_to(base).as_posix())
    _ASSET_SCAN.update(t=now, files=sorted(seen))
    return _ASSET_SCAN["files"]


def _local_rel(url: str) -> str | None:
    """頁面上寫的相對網址 → 網站根目錄底下的相對路徑。外部網址、已經帶參數的都不動。"""
    if not url or "?" in url or "#" in url or ":" in url or url.startswith("//"):
        return None
    rel = url[2:] if url.startswith("./") else url.lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    return rel


def versioned_html(html: str, version_of, module_files) -> str:
    """HTML 裡自己的程式檔、樣式表和 fetch 預載換成帶版本的網址，並放入 import map。

    version_of(rel) → 短雜湊（找不到就 None，那個檔照舊）。
    module_files：放進 import map 的 .js（模組彼此 import 的時候用）。
    頁面原本就有 import map（排字匣的 three.js）就合併，並整張移到最前面 —— 放在 modulepreload
    後面的話，預載的模組會在對照表生效以前用舊網址載進來，同一支模組變成兩份。
    """
    imports: dict[str, str] = {}
    for rel in module_files:
        v = version_of(rel)
        if v:
            imports["/" + rel] = f"/{rel}?v={v}"
    old = _IMPORTMAP_RE.search(html)
    extra: dict = {}
    if old:
        try:
            extra = json.loads(old.group(1))
        except ValueError:
            return html  # 看不懂原本的 import map：整頁照舊，不冒險
        if not isinstance(extra, dict):
            return html
        html = html[: old.start()] + html[old.end():]
    merged = dict(extra)
    merged["imports"] = {**imports, **(extra.get("imports") or {})}

    def swap(m: re.Match) -> str:
        tag = m.group(0)
        low = tag.lower()
        if low.startswith("<script"):
            if 'type="module"' not in low:
                return tag
        elif ('rel="modulepreload"' not in low and 'rel="stylesheet"' not in low
              and not ('rel="preload"' in low and 'as="fetch"' in low)):
            return tag

        def one(a: re.Match) -> str:
            rel = _local_rel(a.group(2))
            v = version_of(rel) if rel else None
            return f'{a.group(1)}="{a.group(2)}?v={v}"' if v else a.group(0)

        return _URL_ATTR_RE.sub(one, tag)

    html = _TAG_RE.sub(swap, html)
    low = html.lower()
    spots = [i for i in (low.find("<link"), low.find("<script")) if i >= 0]
    if not spots:
        head = low.find("</head>")
        if head < 0:
            return html
        spots = [head]
    at = min(spots)
    block = '<script type="importmap">' + json.dumps(merged, ensure_ascii=False, separators=(",", ":")) + "</script>\n    "
    return html[:at] + block + html[at:]


def ping() -> dict:
    now = time.time()
    if _PING["val"] is not None and now - _PING["t"] < 2:
        return _PING["val"]
    try:
        stats = api("GET", "/system_stats", timeout=8)
        ver = ""
        if isinstance(stats, dict):
            ver = str((stats.get("system") or {}).get("comfyui_version") or "")
        val = {
            "ok": True,
            "base": comfy_base(),
            "version": ver,
            # 慢顯卡（AMD ROCm 載模型／搬顯存）可能安靜很久，前端的放棄門檻
            # 得跟著機器走，所以由 config.json 決定而不是寫死在 boot.js。
            "streamIdleMs": int(cfg("client.streamIdleMs", "", 90000)),
            "sampler": SAMPLER,
            "scheduler": SCHEDULER,
            "steps": STEPS,
            "cfg": CFG,
        }
    except Exception as exc:
        val = {
            "ok": False,
            "base": comfy_base(),
            "error": str(exc),
            "streamIdleMs": int(cfg("client.streamIdleMs", "", 90000)),
            "sampler": SAMPLER,
            "scheduler": SCHEDULER,
            "steps": STEPS,
            "cfg": CFG,
        }
    _PING["t"] = now
    _PING["val"] = val
    return val


def convert_loras(loras_in) -> list:
    """前端 [{folder, file, strength}] → [(lora_name, strength), …]，最多兩筆。

    ComfyUI 的 lora_name 是全部用反斜線的相對路徑。folder 可能是 Character/other
    這種 POSIX 路徑，混用正反斜線會整批 400。"""
    if not isinstance(loras_in, list):
        return []
    out = []
    for lora in loras_in[:2]:
        lora = lora or {}
        if not lora.get("file"):
            continue
        folder = (lora.get("folder") or "").replace("/", "\\")
        lname = (folder + "\\" + lora["file"]) if folder else lora["file"]
        try:
            strength = float(lora.get("strength", 0.8))
        except (TypeError, ValueError):
            strength = 0.8
        out.append((lname, strength))
    return out


def inject_lora(wf: dict, lora_name: str, strength: float) -> None:
    """插入一個 LoraLoader：把吃 checkpoint model([_,0])/clip([_,1]) 的節點改接到它。

    VAE([_,2]) 不動。連呼叫兩次會自動疊成 ckpt → LoRA2 → LoRA1 → 其餘。"""
    ckpt = None
    for nid, n in wf.items():
        if isinstance(n, dict) and n.get("class_type") in ("CheckpointLoaderSimple", "CheckpointLoader"):
            ckpt = str(nid)
            break
    if ckpt is None:
        return
    lid = "201"
    while lid in wf:
        lid = str(int(lid) + 1)
    wf[lid] = {
        "class_type": "LoraLoader",
        "inputs": {
            "lora_name": lora_name,
            "strength_model": float(strength),
            "strength_clip": float(strength),
            "model": [ckpt, 0],
            "clip": [ckpt, 1],
        },
    }
    for nid, n in wf.items():
        if nid == lid or not isinstance(n, dict):
            continue
        for k, v in (n.get("inputs") or {}).items():
            if isinstance(v, list) and len(v) == 2 and str(v[0]) == ckpt:
                if v[1] == 0:
                    n["inputs"][k] = [lid, 0]
                elif v[1] == 1:
                    n["inputs"][k] = [lid, 1]


def build_workflow(positive: str, width: int, height: int, seed: int, loras=None,
                   ckpt=None, sfw: bool = False, rating=None, steps=None, cfg_scale=None, pose=None) -> dict:
    ckpt_name = resolve_ckpt(ckpt)
    wf = {
        "13": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": ckpt_name},
        },
        "36": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive, "clip": ["13", 1]},
        },
        "37": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative_for(rating if rating is not None else sfw), "clip": ["13", 1]},
        },
        "119": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": int(width), "height": int(height), "batch_size": 1},
        },
        "35": {
            "class_type": "KSampler",
            "inputs": {
                "seed": int(seed),
                "steps": sampling_value(steps, "steps", STEPS),
                "cfg": sampling_value(cfg_scale, "cfg", CFG),
                "sampler_name": SAMPLER,
                "scheduler": SCHEDULER,
                "denoise": 1.0,
                "model": ["13", 0],
                "positive": ["36", 0],
                "negative": ["37", 0],
                "latent_image": ["119", 0],
            },
        },
        "85": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["35", 0], "vae": ["13", 2]},
        },
        "200": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "danbooru_case/case",
                "images": ["85", 0],
            },
        },
    }
    for lora_name, strength in convert_loras(loras):
        inject_lora(wf, lora_name, strength)
    if pose:
        inject_pose(wf, pose, int(width), int(height))
    return wf


# === 姿勢參考（web6／web7 規則裡的「姿勢」）=================================================
# 一張參考圖（照片、自己的成品、作品冊的圖）→ 裁成這張的長寬比 → AIO Aux Preprocessor 的
# OpenposePreprocessor 抓骨架（專案主指定，不用 DWPose）→ OpenPose ControlNet（SetUnionControlNetType=openpose）。
# 參考圖先由前端縮到 1024 以內，POST /api/pose/upload 傳進 Comfy 的 input/danbooru_pose（檔名是內容雜湊，
# 同一張不重複傳）；生圖時 payload 帶 {"pose": {"name", "strength", "end"}}。只套在內建工作流。
# 骨架節點每張都一樣：Comfy 會沿用上一張算好的結果，只有第一張多花幾秒。
POSE_SUBFOLDER = "danbooru_pose"
POSE_NAME_RE = re.compile(r"^danbooru_pose/pose_[0-9a-f]{16}\.(png|jpg|webp)$")
POSE_MAX_BYTES = 4 * 1024 * 1024
# 預設照專案主試好的那一份：strength 1、end 1。
POSE_STRENGTH = (0.2, 1.2, 1.0)
POSE_END = (0.3, 1.0, 1.0)
POSE_PREPROCESSOR = {"class_type": "AIO_Preprocessor", "preprocessor": "OpenposePreprocessor", "resolution": 512}


class PoseError(ValueError):
    pass


def parse_pose(raw) -> dict | None:
    """payload["pose"] → {"name", "strength", "end"}；沒給（或給的不是參考圖）回 None。"""
    if not isinstance(raw, dict):
        return None
    name = str(raw.get("name") or "").replace("\\", "/")
    if not POSE_NAME_RE.match(name):
        return None

    def clamp(v, lo, hi, default):
        try:
            x = float(v)
        except (TypeError, ValueError):
            return default
        return default if x != x else max(lo, min(hi, x))

    return {
        "name": name,
        "strength": round(clamp(raw.get("strength"), *POSE_STRENGTH), 2),
        "end": round(clamp(raw.get("end"), *POSE_END), 2),
        # 姿勢編輯器（pose-editor.js）畫的：本身就是 OpenPose 骨架圖，不必再抓一次。
        "skeleton": raw.get("skeleton") is True,
    }


def pose_controlnet() -> str:
    """ControlNet 檔名。設定檔 comfy.poseControlNet 可以指定；不然先找 Illustrious 的 OpenPose，
    再找任何 OpenPose，最後退到 Union。後面一律接 SetUnionControlNetType=openpose（專案主的工作流就是這樣接）。"""
    names = models_from_comfy("controlnet")
    want = str(cfg("comfy.poseControlNet", "POSE_CONTROLNET", "") or "").strip()
    if want:
        hit = next((n for n in names if n == want or n.replace("\\", "/").endswith(want.replace("\\", "/"))), None)
        if hit:
            return hit
    low = [(n, n.lower()) for n in names]
    for test in (lambda x: "openpose" in x and "illustrious" in x, lambda x: "openpose" in x, lambda x: "union" in x):
        hit = next((n for n, x in low if test(x)), None)
        if hit:
            return hit
    raise PoseError("ComfyUI 裡找不到 OpenPose 的 ControlNet：重開啟動檔會自動下載（約 2.5GB），下載完就能用")


_POSE_NODE_CACHE = {"t": 0.0, "ok": False}


def pose_node_ready() -> None:
    """ComfyUI 有沒有 AIO Aux Preprocessor（comfyui_controlnet_aux）。沒有就明講怎麼補，不丟 Comfy 的原始錯誤。"""
    now = time.time()
    if _POSE_NODE_CACHE["ok"] and now - _POSE_NODE_CACHE["t"] < 60:
        return
    try:
        info = api("GET", f"/object_info/{POSE_PREPROCESSOR['class_type']}", timeout=8)
    except Exception:
        return  # 問不到就讓 Comfy 自己說
    ok = isinstance(info, dict) and POSE_PREPROCESSOR["class_type"] in info
    _POSE_NODE_CACHE.update(t=now, ok=ok)
    if not ok:
        raise PoseError("ComfyUI 還沒有 AIO Aux Preprocessor（comfyui_controlnet_aux 節點）：重開啟動檔會自動裝，裝完重開一次 ComfyUI")


def inject_pose(wf: dict, pose: dict, width: int, height: int) -> None:
    """在內建工作流的 KSampler 前面接上姿勢：正負提示詞都經過 ControlNetApplyAdvanced。"""
    sampler = next((nid for nid, n in wf.items() if isinstance(n, dict) and n.get("class_type") == "KSampler"), None)
    ckpt = next((nid for nid, n in wf.items() if isinstance(n, dict) and n.get("class_type") == "CheckpointLoaderSimple"), None)
    if sampler is None or ckpt is None:
        return
    if not pose.get("skeleton"):
        pose_node_ready()
    net = pose_controlnet()
    ks = wf[sampler]["inputs"]
    wf["300"] = {"class_type": "LoadImage", "inputs": {"image": pose["name"]}}
    # 先裁成這一張的長寬比：不然 ControlNet 把骨架硬拉成畫布的比例，手腳會變形。
    wf["301"] = {"class_type": "ImageScale", "inputs": {"image": ["300", 0], "upscale_method": "lanczos", "width": width, "height": height, "crop": "center"}}
    hint = ["301", 0]
    if not pose.get("skeleton"):
        wf["302"] = {
            "class_type": POSE_PREPROCESSOR["class_type"],
            "inputs": {"image": ["301", 0], "preprocessor": POSE_PREPROCESSOR["preprocessor"], "resolution": POSE_PREPROCESSOR["resolution"]},
        }
        hint = ["302", 0]
    wf["303"] = {"class_type": "ControlNetLoader", "inputs": {"control_net_name": net}}
    wf["304"] = {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["303", 0], "type": "openpose"}}
    control = ["304", 0]
    wf["305"] = {
        "class_type": "ControlNetApplyAdvanced",
        "inputs": {
            "positive": ks["positive"],
            "negative": ks["negative"],
            "control_net": control,
            "image": hint,
            "strength": float(pose["strength"]),
            "start_percent": 0.0,
            "end_percent": float(pose["end"]),
            "vae": [ckpt, 2],
        },
    }
    ks["positive"] = ["305", 0]
    ks["negative"] = ["305", 1]


# 參考圖、編輯器畫的骨架都存在 Comfy 的 input/danbooru_pose：每改一次姿勢多一張，留最近這幾張。
# 同一張再用一次會重傳（覆蓋、時間變新），常用的不會被清掉。佇列裡正用著的不刪。
POSE_INPUT_KEEP = 60
POSE_FILE_RE = re.compile(r"^pose_[0-9a-f]{16}\.(png|jpg|webp)$")


def pose_input_dir() -> Path | None:
    hires = hires_input_dir()
    return hires.parent / POSE_SUBFOLDER if hires is not None else None


def prune_pose_inputs(keep: int = POSE_INPUT_KEEP, folder: Path | None = None, protect: set[str] | None = None) -> list[str]:
    """刪掉 input/danbooru_pose 裡較舊的參考圖。只在 Comfy 跑在這台、問得到佇列時才動（folder 給了就是測試）。"""
    if folder is None:
        if os.environ.get("NO_HIRES_PRUNE") or not comfy_is_local():
            return []
        folder = pose_input_dir()
        if folder is None or not folder.is_dir():
            return []
        try:
            queue = api("GET", "/queue", timeout=5)
        except Exception:
            return []
        protect = set(protect or ())
        for key in ("queue_running", "queue_pending"):
            for item in (queue or {}).get(key) or []:
                prompt = item[2] if isinstance(item, (list, tuple)) and len(item) > 2 else None
                for node in (prompt or {}).values() if isinstance(prompt, dict) else []:
                    if isinstance(node, dict) and node.get("class_type") == "LoadImage":
                        protect.add(str((node.get("inputs") or {}).get("image") or "").replace("\\", "/").split("/")[-1])
    files = []
    for path in Path(folder).iterdir():
        if path.is_file() and POSE_FILE_RE.match(path.name):
            try:
                files.append((path.stat().st_mtime, path.name, path))
            except OSError:
                continue
    files.sort()
    newest = {name for _, name, _ in files[-keep:]} if keep > 0 else set()
    deleted = []
    for _, name, path in files:
        if name in newest or name in (protect or set()):
            continue
        try:
            path.unlink()
            deleted.append(name)
        except OSError:
            continue
    return deleted


def pose_upload(payload: dict) -> dict:
    """{"image": "data:image/...;base64,..."} → 傳進 Comfy 的 input/danbooru_pose，回 {"name"}。"""
    raw = str((payload or {}).get("image") or "")
    m = re.match(r"^data:image/(png|jpeg|webp);base64,(.+)$", raw, re.S)
    if not m:
        raise PoseError("要一張 PNG、JPEG 或 WebP 的圖")
    try:
        data = base64.b64decode(m.group(2), validate=False)
    except (ValueError, TypeError):
        raise PoseError("圖片壞了")
    if not data or len(data) > POSE_MAX_BYTES:
        raise PoseError("圖片太大（上限 4MB；網頁會先縮小，還是太大就換一張）")
    ext = {"png": "png", "jpeg": "jpg", "webp": "webp"}[m.group(1)]
    name = f"pose_{hashlib.sha1(data).hexdigest()[:16]}.{ext}"
    stored = comfy_upload_image(data, name, subfolder=POSE_SUBFOLDER, mime=f"image/{m.group(1)}")
    if not POSE_NAME_RE.match(stored):
        stored = f"{POSE_SUBFOLDER}/{name}"
    try:
        prune_pose_inputs(protect={name})
    except OSError:
        pass
    return {"name": stored}


def _kps_people(data, w: int, h: int) -> list:
    """SavePoseKpsAsJsonFile 的內容 → [[ [x, y, on] × 18 ], …]（這張畫布的像素）。

    controlnet_aux 存的座標有的版本是 0～1、有的是像素：全部 ≤ 1 就當成比例。
    沒抓到的點 [0, 0, 0]：位置放在脖子（沒有脖子就畫面中間），標成藏起來，編輯器裡拉得出來。
    """
    frame = data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else {}
    cw = float(frame.get("canvas_width") or w)
    ch = float(frame.get("canvas_height") or h)
    out = []
    for person in (frame.get("people") or [])[:3]:
        k = person.get("pose_keypoints_2d") or []
        if len(k) < 54:
            continue
        raw = [(float(k[i * 3]), float(k[i * 3 + 1]), float(k[i * 3 + 2])) for i in range(18)]
        seen = [(x, y) for x, y, c in raw if c > 0 and (x or y)]
        if len(seen) < 3:
            continue
        unit = max(max(x, y) for x, y in seen) <= 1.01
        sx, sy = (w, h) if unit else (w / cw, h / ch)
        pts = [[x * sx, y * sy, bool(c > 0 and (x or y))] for x, y, c in raw]
        anchor = pts[1] if pts[1][2] else [w / 2, h / 2, False]
        out.append([p if p[2] else [anchor[0], anchor[1], False] for p in pts])
    return out


def pose_keypoints(payload: dict) -> dict:
    """參考圖 → 骨架座標（給姿勢編輯器接著改）。裁成這張的比例後用 OpenposePreprocessor 抓，跟出圖時同一種。"""
    name = str((payload or {}).get("name") or "")
    if not POSE_NAME_RE.match(name):
        raise PoseError("不是姿勢參考圖")
    try:
        w = max(256, min(2048, int(payload.get("w") or 1024)))
        h = max(256, min(2048, int(payload.get("h") or 1024)))
    except (TypeError, ValueError):
        raise PoseError("尺寸不對")
    pose_node_ready()
    wf = {
        "1": {"class_type": "LoadImage", "inputs": {"image": name}},
        "2": {"class_type": "ImageScale", "inputs": {"image": ["1", 0], "upscale_method": "lanczos", "width": w, "height": h, "crop": "center"}},
        "3": {"class_type": "OpenposePreprocessor", "inputs": {"image": ["2", 0], "detect_hand": "disable", "detect_body": "enable", "detect_face": "disable", "resolution": 512}},
        # 要一個輸出節點整條才會跑；骨架座標 OpenposePreprocessor 自己會放進執行紀錄（openpose_json）。
        "4": {"class_type": "PreviewImage", "inputs": {"images": ["3", 0]}},
    }
    prompt_id = api("POST", "/prompt", {"prompt": wf}, timeout=60)["prompt_id"]
    hist = wait_done(prompt_id, timeout=180)
    raw = ((hist.get("outputs") or {}).get("3") or {}).get("openpose_json") or []
    try:
        data = json.loads(raw[0]) if raw else []
    except (ValueError, TypeError):
        data = []
    return {"w": w, "h": h, "people": _kps_people(data, w, h)}


def pose_preview(payload: dict) -> dict:
    """只跑骨架偵測給人看：抓到幾個人、手腳對不對。回 {"image": 骨架圖網址}。"""
    name = str((payload or {}).get("name") or "")
    if not POSE_NAME_RE.match(name):
        raise PoseError("不是姿勢參考圖")
    pose_node_ready()
    wf = {
        "1": {"class_type": "LoadImage", "inputs": {"image": name}},
        "2": {"class_type": POSE_PREPROCESSOR["class_type"], "inputs": {"image": ["1", 0], "preprocessor": POSE_PREPROCESSOR["preprocessor"], "resolution": POSE_PREPROCESSOR["resolution"]}},
        "3": {"class_type": "PreviewImage", "inputs": {"images": ["2", 0]}},
    }
    prompt_id = api("POST", "/prompt", {"prompt": wf}, timeout=60)["prompt_id"]
    hist = wait_done(prompt_id, timeout=180)
    image = first_image_src(hist, ["3"])
    if not image:
        raise PoseError("骨架沒畫出來（Comfy 沒有回圖）")
    return {"image": image}


_MODEL_CACHE = {"t": 0.0, "data": {}}


def models_from_comfy(kind: str) -> list[str]:
    table = {
        "checkpoints": ("CheckpointLoaderSimple", "ckpt_name"),
        "loras": ("LoraLoader", "lora_name"),
        "vae": ("VAELoader", "vae_name"),
        "upscale": ("UpscaleModelLoader", "model_name"),
        "controlnet": ("ControlNetLoader", "control_net_name"),
    }
    if kind not in table:
        return []
    now = time.time()
    hit = _MODEL_CACHE["data"].get(kind)
    if hit is not None and now - _MODEL_CACHE["t"] < 30:
        return hit
    class_type, field = table[kind]
    info = api("GET", f"/object_info/{class_type}", timeout=8)
    names = workflows.combo_list(info, class_type, field)
    if now - _MODEL_CACHE["t"] >= 30:
        _MODEL_CACHE["data"] = {}
        _MODEL_CACHE["t"] = now
    _MODEL_CACHE["data"][kind] = names
    return names


_LM_CKPT = {"at": 0.0, "by_file": {}, "ok": False}
_LOOPBACK = {"127.0.0.1", "localhost", "::1"}
_REACH: dict = {}


def manager_url_for(host_header: str, path: str) -> str:
    """LoRA Manager 的網址，要是「開這一頁的裝置」連得到的那個。

    ComfyUI 在本機（127.0.0.1）時，手機走 Tailscale 開網頁得用這台的位址連 ComfyUI；
    但 ComfyUI 預設只聽 127.0.0.1（沒加 --listen），那樣手機點了也打不開 —— 這時回空字串，
    畫面上的 LoRA Manager 連結就藏起來，「詳情」改開 Civitai。結果快取一分鐘。"""
    base = comfy_base().rstrip("/")
    u = urllib.parse.urlparse(base)
    host = (host_header or "").strip()
    req_host = host[1:].split("]")[0] if host.startswith("[") else host.rsplit(":", 1)[0] if host.count(":") == 1 else host
    if (u.hostname or "") not in _LOOPBACK or not req_host or req_host in _LOOPBACK:
        return base + path
    port = u.port or (443 if u.scheme == "https" else 80)
    key = (req_host, port)
    hit = _REACH.get(key)
    if not hit or time.time() - hit[1] > 60:
        try:
            socket.create_connection((req_host, port), timeout=1.5).close()
            ok = True
        except OSError:
            ok = False
        hit = _REACH[key] = (ok, time.time())
    if not hit[0]:
        return ""
    shown = f"[{req_host}]" if ":" in req_host else req_host
    return f"{u.scheme}://{shown}:{port}{path}"


def lm_checkpoints() -> dict:
    """ComfyUI 的 LoRA Manager 認得的 checkpoint：檔名 → {title, previewUrl}。一分鐘快取（生圖時也會叫到）。"""
    now = time.time()
    if now - _LM_CKPT["at"] < 60:
        return _LM_CKPT["by_file"]
    by_file = {}
    raw = lora_scan.lora_manager_list("checkpoints")
    for it in raw or []:
        fn = str(it.get("file_path") or "").replace("\\", "/").rsplit("/", 1)[-1]
        name = lora_scan.lm_preview_name(it.get("preview_url") or "") or ""
        # 底模面板只放 <img>：影片預覽（實測有 27MB 的 mp4）下載了也顯示不出來，不給。
        if lora_scan.is_video_preview(name):
            it = {**it, "preview_url": ""}
            name = ""
        if fn:
            by_file[fn] = {
                "path": str(it.get("file_path") or ""),
                "title": str(it.get("model_name") or Path(fn).stem),
                "previewUrl": lora_scan.lm_preview_src(it.get("preview_url") or ""),
                "preview": name,
            }
    _LM_CKPT.update(at=now, by_file=by_file, ok=raw is not None)
    return by_file


# ---------- 底模的偏好路徑（畫面上的「偏好路徑」，存在 data/settings.json 的 ckptPath） ----------
# 只看這個資料夾底下的底模（原本 checkpointPrefix＝illurtrious 想做的就是這件事）。比 config.json 優先。
_PREF_CKPT = {"key": "", "at": 0.0, "files": {}}


def ckpt_pref() -> Path | None:
    got = str(workflows.load_settings().get("ckptPath") or "").strip()
    return Path(got) if got else None


def pref_ckpt_files(pref: Path | None = None) -> dict:
    """偏好路徑底下（含子資料夾）的底模檔：檔名 → 路徑。一分鐘快取。"""
    pref = ckpt_pref() if pref is None else pref
    if pref is None:
        return {}
    key = str(pref)
    if _PREF_CKPT["key"] == key and time.time() - _PREF_CKPT["at"] < 60:
        return _PREF_CKPT["files"]
    files = {}
    try:
        for f in pref.rglob("*"):
            if f.is_file() and f.suffix.lower() in CKPT_EXTS and not f.name.startswith("."):
                files.setdefault(f.name, f)
    except OSError:
        pass
    _PREF_CKPT.update(key=key, at=time.time(), files=files)
    return files


def _local_preview(model: Path) -> str:
    for ext in CKPT_PREVIEW_EXTS:
        cand = model.with_name(model.stem + ext)
        if cand.is_file():
            return cand.name
    return ""


def checkpoints_for_ui() -> tuple[list[dict], str]:
    """Use Comfy as the model source; names and previews from ComfyUI's LoRA Manager, else the local folder."""
    local = list_ckpts()
    by_file = {it["file"]: it for it in local}
    by_name = {str(it.get("ckpt_name") or "").replace("/", "\\"): it for it in local}
    try:
        names = [str(n).replace("/", "\\") for n in models_from_comfy("checkpoints")]
    except Exception:
        names = []
    if not names:
        return local, "local" if local else "none"
    lm = lm_checkpoints()
    items = []
    for raw in names:
        fn = raw.split("\\")[-1]
        loc = by_name.get(raw) or by_file.get(fn) or {}
        man = lm.get(fn) or {}
        item = {
            "file": fn,
            "ckpt_name": raw,
            "title": man.get("title") or loc.get("title") or Path(fn).stem,
            "preview": loc.get("preview") or "",
        }
        # 本機 checkpointDir 只掃一層；LoRA Manager 認得每個子資料夾。本機沒有圖才用它的。
        if not item["preview"] and man.get("previewUrl"):
            item["preview"] = man.get("preview") or "preview"
            item["previewUrl"] = man["previewUrl"]
        items.append(item)
    pref = ckpt_pref()
    if pref is not None:
        # 偏好路徑：只留那個資料夾底下的（LoRA Manager 知道每個檔在哪；沒有它就看資料夾裡的檔名）。
        local_files = pref_ckpt_files(pref)
        keep = set(local_files) | {fn for fn, man in lm.items() if lora_scan.is_under(man.get("path"), pref)}
        items = [it for it in items if it["file"] in keep]
        for it in items:
            if not it["preview"] and it["file"] in local_files:
                name = _local_preview(local_files[it["file"]])
                if name:
                    it["preview"] = name
                    it["previewUrl"] = "/api/ckpt-preview?file=" + urllib.parse.quote(name)
    return items, "comfy"



# ---------- 偏好路徑的 API（LoRA、底模面板的「偏好路徑」） ----------
PATH_KEYS = {"lora": "loraPath", "ckpt": "ckptPath"}
_SUGGEST = {"at": 0.0, "data": {}}


def _count_models(folder: Path, kind: str, cap: int = 5000) -> int:
    exts = {".safetensors"} if kind == "lora" else CKPT_EXTS
    n = 0
    try:
        for f in folder.rglob("*"):
            if f.suffix.lower() in exts and f.is_file():
                n += 1
                if n >= cap:
                    break
    except OSError:
        pass
    return n


def path_suggestions(kind: str) -> list[dict]:
    """可以直接點的資料夾：ComfyUI 回報的模型資料夾和它們底下的第一層子資料夾，附模型數。一分鐘快取。"""
    if time.time() - _SUGGEST["at"] < 60 and kind in _SUGGEST["data"]:
        return _SUGGEST["data"][kind]
    roots = lora_scan.comfy_model_dirs("loras" if kind == "lora" else "checkpoints")
    if kind == "lora" and lora_scan.LORA_ROOT:
        roots = roots + [lora_scan.LORA_ROOT]
    if kind == "ckpt" and CKPT_DIR:
        roots = roots + [CKPT_DIR]
    out, seen = [], set()
    for root in roots:
        if not root.is_dir() or lora_scan.norm_path(root) in seen:
            continue
        seen.add(lora_scan.norm_path(root))
        n = _count_models(root, kind)
        if not n:
            continue
        out.append({"path": str(root), "count": n, "depth": 0})
        try:
            subs = sorted((d for d in root.iterdir() if d.is_dir()), key=lambda d: d.name.lower())
        except OSError:
            subs = []
        for d in subs:
            if lora_scan.norm_path(d) in seen:
                continue
            k = _count_models(d, kind)
            if k:
                seen.add(lora_scan.norm_path(d))
                out.append({"path": str(d), "count": k, "depth": 1})
    _SUGGEST["data"][kind] = out
    _SUGGEST["at"] = time.time()
    return out


def paths_status(client_ip: str) -> dict:
    """GET /api/paths：目前的偏好路徑（沒設就是 ""）、config.json 的舊設定、建議清單、能不能開資料夾視窗。"""
    import importlib.util  # noqa: PLC0415

    saved = workflows.load_settings()
    local = client_ip in ("127.0.0.1", "::1", "::ffff:127.0.0.1")
    return {
        "ok": True,
        "pick": local and importlib.util.find_spec("tkinter") is not None,
        "lora": {"path": str(saved.get("loraPath") or ""), "config": str(lora_scan.LORA_ROOT or ""), "suggestions": path_suggestions("lora")},
        "ckpt": {"path": str(saved.get("ckptPath") or ""), "config": str(CKPT_DIR or ""), "suggestions": path_suggestions("ckpt")},
    }


def set_model_path(kind: str, raw) -> dict:
    """POST /api/paths：存偏好路徑（"" ＝ 清掉，回到 ComfyUI 的全部）。資料夾不存在就不存。"""
    if kind not in PATH_KEYS:
        raise ValueError("kind 要是 lora 或 ckpt")
    text = str(raw or "").strip().strip('"').strip()
    if text:
        folder = Path(os.path.expandvars(os.path.expanduser(text)))
        if not folder.is_dir():
            raise ValueError(f"找不到這個資料夾：{text}")
        text = str(folder.resolve())
        count = _count_models(folder, kind)
    else:
        count = None
    workflows.save_settings({PATH_KEYS[kind]: text})
    lora_scan.reset_cache()
    _LM_CKPT["at"] = 0.0
    _PREF_CKPT["at"] = 0.0
    return {"ok": True, "kind": kind, "path": text, "count": count}


def pick_folder(initial: str, title: str) -> str:
    """在這台電腦上跳出資料夾視窗（tkinter，另開一個程序，視窗放最上層）。按取消回 ""。"""
    code = (
        "import sys, tkinter as tk\n"
        "from tkinter import filedialog\n"
        "r = tk.Tk(); r.withdraw(); r.attributes('-topmost', True)\n"
        "p = filedialog.askdirectory(initialdir=sys.argv[1] or None, title=sys.argv[2], parent=r, mustexist=True)\n"
        "sys.stdout.write(p or '')\n"
    )
    try:
        done = subprocess.run([sys.executable, "-c", code, initial or "", title], capture_output=True, text=True, timeout=900)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return done.stdout.strip()

class HiresError(ValueError):
    """Hires 參數不合法。SSE 走 error 事件；沒有 SSE 的 POST 回 400。"""


# 放大倍率夾在這段。超過輸出上限就整次拒絕，不悄悄縮小。
HIRES_SCALE_MIN = 1.25
HIRES_SCALE_MAX = 3.0
HIRES_SIDE_MAX = 4096
HIRES_PIXEL_MAX = 4096 * 4096 // 2
HIRES_UPSCALE_NAME = "RealESRGAN_x4plus_anime_6B.pth"


def png_size(raw: bytes) -> tuple[int, int]:
    """PNG IHDR 的寬高。不靠 PIL。不是 PNG 或讀不到就講清楚。"""
    blob = bytes(raw or b"")
    if len(blob) < 24 or blob[:8] != b"\x89PNG\r\n\x1a\n" or blob[12:16] != b"IHDR":
        raise HiresError("讀不到原圖尺寸（要 PNG，而且檔頭要有 IHDR）")
    width, height = struct.unpack(">II", blob[16:24])
    if width <= 0 or height <= 0:
        raise HiresError("讀不到原圖尺寸（IHDR 的寬高是 0）")
    return int(width), int(height)


def hires_json_float(value: float) -> float:
    """工作流要先變成 JSON 才送進 Comfy，倍率用送出去的那個數，避免二進位小數對不上。"""
    return float(json.loads(json.dumps(float(value))))


def hires_deep_scale_by(scale: float, factor: int) -> float:
    """深度：模型先放大 factor 倍，ImageScaleBy 再乘 scale/factor，回到使用者要的倍率。"""
    factor = max(1, int(factor))
    return hires_json_float(float(scale) / float(factor))


def hires_output_size(width: int, height: int, scale: float, mode: str, factor: int = 4) -> tuple[int, int]:
    """放大後、存檔前的像素。兩種圖進 VAE 的方式不同，所以取 8 的倍數的方式也不同。

    quick：VAE 編碼後 latent 是寬高各 //8，LatentUpscaleBy 再 round(latent * scale)，解碼乘回 8。
    deep：模型放大 factor 倍，lanczos 乘 scale/factor，VAE 再把像素裁成 8 的倍數（居中裁，輸出是 //8*8）。
    """
    width, height = int(width), int(height)
    scale = float(scale)
    if mode == "quick":
        return (
            max(8, round((width // 8) * scale) * 8),
            max(8, round((height // 8) * scale) * 8),
        )
    by = hires_deep_scale_by(scale, factor)
    factor = max(1, int(factor))

    def side(n: int) -> int:
        scaled = round((n * factor) * by)
        return max(8, (scaled // 8) * 8)

    return side(width), side(height)


def hires_fits(width: int, height: int) -> bool:
    return (
        0 < width <= HIRES_SIDE_MAX
        and 0 < height <= HIRES_SIDE_MAX
        and width * height <= HIRES_PIXEL_MAX
    )


def format_scale(scale: float) -> str:
    return f"{float(scale):.2f}".rstrip("0").rstrip(".")


def max_hires_scale(width: int, height: int, mode: str, factor: int = 4) -> float | None:
    """1.25–3.0 裡、輸出還放得下的最大倍率（0.01 一格）。放不下就 None。"""
    best = None
    step = 125
    while step <= 300:
        scale = step / 100
        ow, oh = hires_output_size(width, height, scale, mode, factor)
        if hires_fits(ow, oh):
            best = scale
        step += 1
    return best


def parse_hires(raw) -> dict:
    """只檢查 payload。不連 Comfy、不讀圖。"""
    if not isinstance(raw, dict):
        raise HiresError("hires 要是物件")
    mode = str(raw.get("mode") or "")
    if mode not in ("quick", "deep"):
        raise HiresError("hires.mode 只收 quick 或 deep")
    try:
        scale = float(raw.get("scale"))
    except (TypeError, ValueError):
        raise HiresError("hires.scale 不是數字")
    if scale != scale:  # NaN
        raise HiresError("hires.scale 不是數字")
    scale = hires_json_float(min(HIRES_SCALE_MAX, max(HIRES_SCALE_MIN, scale)))
    image = str(raw.get("image") or "")
    if not image.startswith("/api/image?"):
        raise HiresError("hires.image 只收 /api/image? 開頭")
    query = urllib.parse.parse_qs(image.split("?", 1)[1], keep_blank_values=True)
    filename = (query.get("filename") or [""])[0]
    subfolder = (query.get("subfolder") or [""])[0]
    type_ = (query.get("type") or ["output"])[0]
    view = comfy_view_query(filename, subfolder, type_)
    if not view:
        raise HiresError("hires.image 路徑不合法")
    sampling = {k: raw.get(k) for k in ("steps", "cfg", "denoise") if raw.get(k) not in (None, "")}
    return {"mode": mode, "scale": scale, "view": view, "sampling": sampling}


def upscale_factor(name: str) -> int:
    low = str(name or "").lower().replace("\\", "/")
    for n in (8, 6, 4, 3, 2):
        if f"{n}x" in low or f"x{n}" in low:
            return n
    return 4


def pick_upscale_model(names: list[str], configured: str = "") -> str:
    """設定檔 → 指定的 6B → 檔名含 anime 的 4x → 任何 4x。都沒有就報深度做不了。"""
    pool = [str(n) for n in names if str(n).strip()]
    want = str(configured or "").strip().replace("\\", "/")
    if want:
        want_base = want.split("/")[-1]
        for name in pool:
            norm = name.replace("\\", "/")
            base = norm.split("/")[-1]
            if norm == want or base == want_base or norm.endswith("/" + want):
                return name
    for name in pool:
        if name.replace("\\", "/").endswith(HIRES_UPSCALE_NAME):
            return name
    for name in pool:
        low = name.lower()
        if "anime" in low and "4x" in low:
            return name
    for name in pool:
        if "4x" in name.lower():
            return name
    raise HiresError("Comfy 沒有放大模型，深度 Hires 做不了；快速 Hires 不需要")


def hires_defaults(mode: str) -> dict:
    """兩種 Hires 各自的預設（參考工作流）。設定檔 hires.<mode>.* 優先，其次 hires.*（兩種共用）。"""
    base = {"steps": 20, "cfg": 5.0, "denoise": 0.5 if mode == "quick" else 0.4}
    out = {}
    for k, d in base.items():
        raw = cfg(f"hires.{mode}.{k}", "", None)
        if raw is None or raw == "":
            raw = cfg(f"hires.{k}", "", None)
        out[k] = sampling_value(raw, k, d)
    return out


def hires_sampler(mode: str, overrides: dict | None = None) -> tuple[int, float, float]:
    """steps / cfg / denoise：網頁這次指定的 → 設定檔 → 預設。"""
    d = hires_defaults(mode)
    o = overrides or {}
    steps = sampling_value(o.get("steps"), "steps", d["steps"])
    cfg_v = sampling_value(o.get("cfg"), "cfg", d["cfg"])
    denoise = sampling_value(o.get("denoise"), "denoise", d["denoise"])
    return max(1, int(steps)), float(cfg_v), float(denoise)


def sampling_defaults() -> dict:
    """給工作流面板：目前這台的預設值和可調範圍（顯示用，沒改的就送空值、伺服器用這些）。"""
    return {
        "ok": True,
        "base": {"steps": STEPS, "cfg": CFG},
        "hires": {"quick": hires_defaults("quick"), "deep": hires_defaults("deep")},
        "limits": {k: list(v) for k, v in SAMPLING_LIMITS.items()},
    }


def build_hires_workflow(
    positive: str,
    seed: int,
    mode: str,
    scale: float,
    image_name: str,
    loras=None,
    ckpt=None,
    rating=None,
    sfw: bool = False,
    upscale_model: str = "",
    sampling: dict | None = None,
) -> dict:
    """內建 Hires 圖。不管原來是不是 profile 工作流，放大一律走這張。"""
    ckpt_name = resolve_ckpt(ckpt)
    steps, cfg_v, denoise = hires_sampler(mode, sampling)
    negative = negative_for(rating if rating is not None else sfw)
    wf = {
        "13": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": ckpt_name},
        },
        "36": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive, "clip": ["13", 1]},
        },
        "37": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative, "clip": ["13", 1]},
        },
        "50": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
        },
    }
    if mode == "quick":
        wf["51"] = {
            "class_type": "VAEEncode",
            "inputs": {"pixels": ["50", 0], "vae": ["13", 2]},
        }
        wf["52"] = {
            "class_type": "LatentUpscaleBy",
            "inputs": {
                "upscale_method": "nearest-exact",
                "scale_by": hires_json_float(scale),
                "samples": ["51", 0],
            },
        }
        latent = "52"
    else:
        factor = upscale_factor(upscale_model)
        wf["51"] = {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": upscale_model},
        }
        wf["52"] = {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["51", 0], "image": ["50", 0]},
        }
        wf["53"] = {
            "class_type": "ImageScaleBy",
            "inputs": {
                "upscale_method": "lanczos",
                "scale_by": hires_deep_scale_by(scale, factor),
                "image": ["52", 0],
            },
        }
        wf["54"] = {
            "class_type": "VAEEncode",
            "inputs": {"pixels": ["53", 0], "vae": ["13", 2]},
        }
        latent = "54"
    sampler = "60"
    decode = "61"
    wf[sampler] = {
        "class_type": "KSampler",
        "inputs": {
            "seed": int(seed),
            "steps": steps,
            "cfg": cfg_v,
            "sampler_name": "euler_ancestral",
            "scheduler": "normal",
            "denoise": denoise,
            "model": ["13", 0],
            "positive": ["36", 0],
            "negative": ["37", 0],
            "latent_image": [latent, 0],
        },
    }
    wf[decode] = {
        "class_type": "VAEDecode",
        "inputs": {"samples": [sampler, 0], "vae": ["13", 2]},
    }
    wf["62"] = {
        "class_type": "SaveImage",
        "inputs": {
            "filename_prefix": "danbooru_case/hires",
            "images": [decode, 0],
        },
    }
    for lora_name, strength in convert_loras(loras):
        inject_lora(wf, lora_name, strength)
    return wf


def comfy_upload_image(raw: bytes, filename: str, subfolder: str = "danbooru_hires", mime: str = "image/png") -> str:
    """把原圖 POST 到 Comfy /upload/image，回 LoadImage 用的名字（含子資料夾）。"""
    boundary = "----danbooruHires" + uuid.uuid4().hex
    chunks = []

    def add_field(name: str, value: str) -> None:
        chunks.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode("utf-8")
        )

    add_field("subfolder", subfolder)
    add_field("overwrite", "true")
    chunks.append(
        (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"image\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n"
        ).encode("utf-8")
        + bytes(raw)
        + b"\r\n"
    )
    chunks.append(f"--{boundary}--\r\n".encode("ascii"))
    body = b"".join(chunks)
    req = urllib.request.Request(
        comfy_base() + "/upload/image",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8") or "{}")
    name = str((payload or {}).get("name") or "")
    sub = str((payload or {}).get("subfolder") or "").replace("\\", "/").strip("/")
    if not name:
        raise HiresError("Comfy 沒有收下要放大的圖")
    return f"{sub}/{name}" if sub else name


# 同一張原圖再放大不會重複上傳（檔名是內容雜湊）。不同的原圖會各留一份，
# input/danbooru_hires 會一直長大。只留最近這幾張；佇列裡還指著的那張不刪。
HIRES_INPUT_KEEP = 24


def comfy_is_local(base: str | None = None) -> bool:
    """只在 Comfy 跑在這台機器上時才去清它的 input 目錄。"""
    raw = comfy_base() if base is None else str(base)
    host = (urllib.parse.urlparse(raw).hostname or "").strip().lower()
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    return host in {"127.0.0.1", "localhost", "::1"}


def hires_input_dir(checkpoint_dir: str | Path | None = None) -> Path | None:
    """checkpointDir 往上找到 models，旁邊就是 Comfy 根目錄的 input/danbooru_hires。"""
    text = str(_ckpt_dir if checkpoint_dir is None else checkpoint_dir).strip()
    if not text:
        return None
    current = Path(text)
    for parent in [current, *current.parents]:
        if parent.name.lower() == "models":
            return parent.parent / "input" / "danbooru_hires"
    return None


def _hires_basename(image: str) -> str:
    name = str(image or "").replace("\\", "/").split("/")[-1]
    if not name.startswith("hires_") or not name.endswith(".png"):
        return ""
    if name != Path(name).name:
        return ""
    return name


def queued_hires_names(queue) -> set[str]:
    """Comfy /queue 裡 LoadImage 正用著的 hires_*.png 檔名（不含資料夾）。"""
    found: set[str] = set()
    if not isinstance(queue, dict):
        return found
    for key in ("queue_running", "queue_pending"):
        items = queue.get(key) or []
        if not isinstance(items, list):
            continue
        for item in items:
            prompt = item[2] if isinstance(item, (list, tuple)) and len(item) > 2 else None
            if not isinstance(prompt, dict):
                continue
            for node in prompt.values():
                if not isinstance(node, dict) or node.get("class_type") != "LoadImage":
                    continue
                base = _hires_basename(str((node.get("inputs") or {}).get("image") or ""))
                if base:
                    found.add(base)
    return found


def prune_hires_dir(directory: Path, keep: int = HIRES_INPUT_KEEP, protect: set[str] | None = None) -> list[str]:
    """刪掉 directory 裡較舊的 hires_*.png，留下最近 keep 張。protect 裡的檔名一律不刪。

    只動這一層的檔案，不進子資料夾。目錄不在就什麼都不做。回傳刪掉的檔名。
    """
    folder = Path(directory)
    if not folder.is_dir():
        return []
    safe = {_hires_basename(n) for n in (protect or set())}
    safe.discard("")
    files: list[tuple[float, str, Path]] = []
    for path in folder.iterdir():
        if not path.is_file():
            continue
        name = path.name
        if not _hires_basename(name):
            continue
        if path.parent.resolve() != folder.resolve():
            continue
        try:
            stamp = path.stat().st_mtime
        except OSError:
            continue
        files.append((stamp, name, path))
    files.sort(key=lambda row: (row[0], row[1]))
    # 最新的 keep 張留下。更舊的如果正在佇列裡也留下，所以最後可能超過 keep 張。
    newest = {name for _, name, _ in files[-keep:]} if keep > 0 else set()
    deleted: list[str] = []
    for _, name, path in files:
        if name in newest or name in safe:
            continue
        try:
            path.unlink()
        except OSError:
            continue
        deleted.append(name)
    return deleted


def prune_hires_inputs(extra: set[str] | None = None) -> list[str]:
    """開機或上傳成功後呼叫。遠端 Comfy、問不到佇列、或不在本機，都不刪。"""
    if os.environ.get("NO_HIRES_PRUNE"):
        return []
    if not comfy_is_local():
        return []
    folder = hires_input_dir()
    if folder is None:
        return []
    try:
        queue = api("GET", "/queue", timeout=5)
    except Exception:
        return []
    if not isinstance(queue, dict):
        return []
    protect = queued_hires_names(queue)
    for name in extra or ():
        base = _hires_basename(name)
        if base:
            protect.add(base)
    try:
        return prune_hires_dir(folder, HIRES_INPUT_KEEP, protect)
    except OSError:
        return []


def prepare_hires(payload: dict) -> tuple[dict, dict]:
    """有 hires 就走這裡：下載原圖、量尺寸、上傳、組內建圖。workflowId 不用。"""
    spec = parse_hires(payload.get("hires"))
    positive = str(payload.get("positive") or "").strip()
    if not positive:
        raise ValueError("missing positive")
    seed = payload.get("seed")
    if seed is None or seed == "":
        seed = random.randint(0, SEED_MAX)
    seed = int(seed) & SEED_MAX
    raw = api("GET", "/view?" + spec["view"], timeout=120)
    if not isinstance(raw, (bytes, bytearray)) or not raw:
        raise HiresError("跟 Comfy 要原圖失敗")
    width, height = png_size(raw)
    mode = spec["mode"]
    scale = spec["scale"]
    # 深度的輸出尺寸跟模型倍率有關，要先選定模型再量放不放得下。
    if mode == "deep":
        try:
            names = models_from_comfy("upscale")
        except Exception as exc:
            raise HiresError("跟 Comfy 要放大模型清單失敗：" + str(exc)) from exc
        model = pick_upscale_model(names, str(cfg("hires.upscaleModel", "", "") or ""))
        factor = upscale_factor(model)
    else:
        model = ""
        factor = 4
    out_w, out_h = hires_output_size(width, height, scale, mode, factor)
    if not hires_fits(out_w, out_h):
        cap = max_hires_scale(width, height, mode, factor)
        if cap is None:
            raise HiresError("這張原圖已經到放大上限，放不進 4096 的邊長或總像素")
        raise HiresError(f"這張最多放大到 ×{format_scale(cap)}")
    # 檔名照內容雜湊：同一張再做一次 Hires（換倍率、換方式）用的是同一個上傳檔，
    # Comfy 的 input/danbooru_hires 不會每做一次就多一份原圖。
    filename = "hires_" + image_digest(bytes(raw))[:20] + ".png"
    image_name = comfy_upload_image(bytes(raw), filename)
    # 上傳成功才清。清失敗不影響這次放大；剛傳上去的這張和佇列裡的不刪。
    try:
        prune_hires_inputs({filename, image_name})
    except Exception:
        pass
    wf = build_hires_workflow(
        positive,
        seed,
        mode,
        scale,
        image_name,
        payload.get("loras"),
        payload.get("ckpt"),
        payload.get("rating"),
        sfw=bool(payload.get("sfw")),
        upscale_model=model,
        sampling=spec.get("sampling"),
    )
    meta = {
        "kind": "hires",
        "seed": seed,
        "width": out_w,
        "height": out_h,
        "positive": positive,
        "hires": {"mode": mode, "scale": scale},
    }
    return wf, meta


def prepare_workflow(payload: dict):
    """Builtin graph, or deepcopy of a stored API workflow with mapping applied."""
    payload = payload or {}
    if payload.get("hires"):
        return prepare_hires(payload)
    positive = str(payload.get("positive") or "").strip()
    if not positive:
        raise ValueError("missing positive")
    width = max(256, min(int(payload.get("width") or 1024), 2048))
    height = max(256, min(int(payload.get("height") or 1024), 2048))
    seed = payload.get("seed")
    if seed is None or seed == "":
        seed = random.randint(0, SEED_MAX)
    seed = int(seed) & SEED_MAX
    meta = {
        "kind": "builtin",
        "seed": seed,
        "width": width,
        "height": height,
        "positive": positive,
    }
    wid = str(payload.get("workflowId") or "").strip()
    if not wid:
        wf = build_workflow(
            positive,
            width,
            height,
            seed,
            payload.get("loras"),
            payload.get("ckpt"),
            sfw=bool(payload.get("sfw")),
            rating=payload.get("rating"),
            steps=payload.get("steps"),
            cfg_scale=payload.get("cfg"),
            pose=parse_pose(payload.get("pose")),
        )
        return wf, meta
    prof = workflows.get_profile(wid)
    if prof is None:
        raise workflows.WorkflowError("找不到這個 workflow profile。", "missing_profile")
    if not workflows.mapping_ready(prof["mapping"]):
        raise workflows.WorkflowError("先指定 Positive Prompt 要寫進哪個節點。", "need_mapping")
    mapping = prof["mapping"]
    # 這版以前存的工作流，種子只認唯一一個 seed：KSamplerAdvanced（noise_seed）、兩段式都沒對到，
    # 每張圖用的是工作流寫死的那顆。沒存過種子設定的，照現在的偵測補上（使用者明講「不改」的不動）。
    if "seed" not in mapping:
        suggested_seed = workflows.suggest_mapping(prof["workflow"]).get("seed")
        if suggested_seed:
            mapping = {**mapping, "seed": suggested_seed}
    values = {"positive": positive}
    neg_spec = mapping.get("negative") if isinstance(mapping.get("negative"), dict) else {}
    if (neg_spec.get("mode") or "keep") == "control":
        values["negative"] = negative_for(
            payload.get("rating") if payload.get("rating") is not None else bool(payload.get("sfw"))
        )
    seed_spec = mapping.get("seed") if isinstance(mapping.get("seed"), dict) else {}
    if (seed_spec.get("mode") or "keep") == "control":
        values["seed"] = seed
    w_spec = mapping.get("width") if isinstance(mapping.get("width"), dict) else {}
    if (w_spec.get("mode") or "keep") == "control":
        values["width"] = width
    h_spec = mapping.get("height") if isinstance(mapping.get("height"), dict) else {}
    if (h_spec.get("mode") or "keep") == "control":
        values["height"] = height
    ckpt_spec = mapping.get("checkpoint") if isinstance(mapping.get("checkpoint"), dict) else {}
    if (ckpt_spec.get("mode") or "keep") == "control":
        try:
            pool, _ = checkpoints_for_ui()
        except Exception:
            pool = list_ckpts()
        values["checkpoint"] = resolve_ckpt(payload.get("ckpt"), pool)
    lora_specs = mapping.get("loras") if isinstance(mapping.get("loras"), list) else []
    lora_mapped = any(isinstance(s, dict) and (s.get("mode") or "keep") == "control" for s in lora_specs)
    if lora_mapped:
        values["loras"] = convert_loras(payload.get("loras"))
    wf = workflows.apply_mapping(prof["workflow"], mapping, values)
    # 沒有指定要改哪個 LoRA 節點時，頂欄選的 LoRA 插在底模後面（跟內建一樣），不要默默丟掉。
    # 工作流自己的 LoRA 照留，接在這些後面。
    if not lora_mapped and mapping.get("loraInsert", True) is not False:
        for name, strength in convert_loras(payload.get("loras")):
            inject_lora(wf, name, strength)
    meta["kind"] = "profile"
    meta["id"] = wid
    meta["name"] = prof.get("name") or wid
    return wf, meta


def comfy_interrupt(prompt_id=None) -> None:
    """中斷生圖。給了 prompt_id 就只砍那一張。

    不給的話 Comfy 走的是全域中斷（後台會印 "Global interrupt (no prompt_id
    specified)"），砍掉的是它當下正在跑的任何東西。舊版一律送空的 {}，於是一張
    圖逾時或瀏覽器斷線之後補送的中斷，會落在使用者已經開始的下一張上 —— 畫面看
    起來就是「跑到一半自己停了」。
    """
    body = {"prompt_id": prompt_id} if prompt_id else {}
    api("POST", "/interrupt", body, timeout=8)


def wait_done(prompt_id: str, timeout: float = 600) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout:
        hist = api("GET", f"/history/{prompt_id}", timeout=30)
        if hist and prompt_id in hist:
            return hist[prompt_id]
        time.sleep(1.0)
    raise TimeoutError(prompt_id)


_VIEW_TYPES = {"output", "temp", "input"}


def comfy_view_query(filename: str, subfolder: str = "", type_: str = "output") -> str | None:
    if type_ not in _VIEW_TYPES:
        return None
    name = str(filename or "")
    if not name or name in {".", ".."} or "/" in name or "\\" in name:
        return None
    sub = str(subfolder or "").replace("\\", "/")
    if any(ord(c) < 0x20 or ord(c) == 0x7F for c in name + sub):
        return None
    parts = [p for p in sub.split("/") if p]
    if any(p in {".", ".."} for p in parts):
        return None
    return urllib.parse.urlencode({"filename": name, "subfolder": "/".join(parts), "type": type_})


def image_error_code(exc: BaseException) -> int:
    return 404 if getattr(exc, "code", None) == 404 else 502


# 成品網址上的內容指紋（h=）：原圖 sha1 的前 16 個字。
# 網址帶著它，就等於「這個網址永遠是這一張圖」—— 瀏覽器可以整年快取、重新整理時連問都不必問。
# ComfyUI 輸出資料夾清過、檔名重複時，指紋對不上，伺服器回 404，絕不拿別張圖頂替。
IMAGE_HASH_LEN = 16


def image_digest(raw: bytes) -> str:
    return hashlib.sha1(bytes(raw)).hexdigest()


# 上游 ETag 只用來確認檔案未變；對客戶端仍公開原圖內容雜湊。
# 不存 PNG，避免牆上數百張圖佔滿記憶體；換 Comfy 位址也不能沿用舊身分。
_IMAGE_VALIDATORS: dict[tuple[str, str], tuple[str, str]] = {}
_IMAGE_VALIDATORS_MAX = 1024
_IMAGE_VALIDATORS_LOCK = threading.Lock()


def comfy_image(q: str, *, require_body: bool = False, timeout: float = 60) -> tuple[bytes | None, str]:
    """每次確認上游；已知 ETag 未變時只回內容雜湊，需原檔時回完整 bytes。"""
    base = comfy_base()
    key = (base, q)
    with _IMAGE_VALIDATORS_LOCK:
        known = _IMAGE_VALIDATORS.get(key)
    for attempt in range(2):
        headers = {"Accept-Encoding": "identity"}
        if known and not require_body and attempt == 0:
            headers["If-None-Match"] = known[0]
        request = urllib.request.Request(base + "/view?" + q, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
                upstream_tag = response.headers.get("ETag", "")
                content_type = response.headers.get("Content-Type", "")
        except urllib.error.HTTPError as exc:
            if exc.code == 304:
                returned_tag = exc.headers.get("ETag", "")
                exc.close()
                if "If-None-Match" in headers and (not returned_tag or returned_tag == known[0]):
                    return None, known[1]
                # 非預期的 304 不足以證明身分；再問一次完整檔案。
                with _IMAGE_VALIDATORS_LOCK:
                    _IMAGE_VALIDATORS.pop(key, None)
                known = None
                continue
            if exc.code == 404:
                with _IMAGE_VALIDATORS_LOCK:
                    _IMAGE_VALIDATORS.pop(key, None)
            raise
        if not raw or "json" in content_type or raw[:1] in (b"{", b"["):
            raise ValueError("not an image")
        digest = image_digest(raw)
        with _IMAGE_VALIDATORS_LOCK:
            _IMAGE_VALIDATORS.pop(key, None)
            # 弱 ETag 只能保證語意相同，不能代替原檔 bytes 的內容指紋。
            if re.fullmatch(r'"[^"\r\n]*"', upstream_tag):
                _IMAGE_VALIDATORS[key] = (upstream_tag, digest)
                while len(_IMAGE_VALIDATORS) > _IMAGE_VALIDATORS_MAX:
                    _IMAGE_VALIDATORS.pop(next(iter(_IMAGE_VALIDATORS)))
        return raw, digest
    raise ValueError("unexpected upstream 304")


def valid_image_hash(h: str) -> bool:
    return 8 <= len(h) <= 40 and all(c in "0123456789abcdef" for c in h)


def image_cache_policy(want: str, digest: str) -> tuple[int, str]:
    """回 (狀態碼, Cache-Control)。

    沒帶指紋（舊的網址）：no-cache，每次回來問，ETag 是內容雜湊，內容一樣才回 304。
    帶了指紋而且對得上：整年快取 —— 內容一換，網址上的指紋就不一樣，不會拿到舊圖。
    帶了指紋但對不上：那個檔名現在是另一張圖了，回 404。
    """
    if not want:
        return 200, "private, no-cache"
    if not digest.startswith(want):
        return 404, "no-store"
    return 200, "private, max-age=31536000, immutable"


def with_content_hash(src: str) -> str:
    """成品網址加上內容指紋。拿不到圖（Comfy 忙、斷線）就照舊回原本的網址，不擋住出圖。"""
    if not src or not src.startswith("/api/image?") or "&h=" in src:
        return src
    try:
        raw = api("GET", "/view?" + src.split("?", 1)[1], timeout=30)
    except Exception:
        return src
    if not isinstance(raw, (bytes, bytearray)):
        return src
    return src + "&h=" + image_digest(raw)[:IMAGE_HASH_LEN]


# 成品轉成 webp 的快取。鑰匙是原圖的 sha1：同一張圖不管幾台裝置、幾個分頁來要都只轉一次。
# ComfyUI 轉一張 832×1216 約 0.1 秒，而且是在它自己的事件迴圈裡轉 —— 晾紙繩一次幾十張
# 全靠它現轉的話，正在跑的那張圖的進度回報會跟著卡。一張約 100 KB，留 200 張約 20 MB。
_WEBP_CACHE: dict[str, bytes] = {}
_WEBP_MAX = 200
_WEBP_LOCK = threading.Lock()
# 轉好的也存一份到硬碟（data/ 不進版控）：伺服器重開之後晾紙繩不必再請 ComfyUI 全部重轉一次。
# 檔名就是原圖的 sha1，內容不會變；超過上限就從最舊的刪（約 100 KB 一張，1500 張約 150 MB）。
WEBP_DIR = Path(os.environ.get("WEBP_CACHE_DIR") or ROOT / "data" / "webp-cache")
_WEBP_DISK_MAX = 1500
_WEBP_WRITES = {"n": 0}


def _webp_remember(digest: str, blob: bytes) -> None:
    with _WEBP_LOCK:
        _WEBP_CACHE[digest] = blob
        while len(_WEBP_CACHE) > _WEBP_MAX:
            _WEBP_CACHE.pop(next(iter(_WEBP_CACHE)))


def _webp_disk_put(digest: str, blob: bytes) -> None:
    try:
        WEBP_DIR.mkdir(parents=True, exist_ok=True)
        tmp = WEBP_DIR / f"{digest}.{os.getpid()}.{threading.get_ident()}.tmp"
        tmp.write_bytes(blob)
        os.replace(tmp, WEBP_DIR / f"{digest}.webp")
    except OSError:
        return
    _WEBP_WRITES["n"] += 1
    if _WEBP_WRITES["n"] % 50:
        return
    try:
        files = sorted(WEBP_DIR.glob("*.webp"), key=lambda f: f.stat().st_mtime)
        for f in files[: max(0, len(files) - _WEBP_DISK_MAX)]:
            f.unlink(missing_ok=True)
    except OSError:
        pass


def comfy_webp(q: str, digest: str) -> bytes | None:
    with _WEBP_LOCK:
        hit = _WEBP_CACHE.pop(digest, None)
        if hit is not None:
            _WEBP_CACHE[digest] = hit  # 放回最後面：最近用過的最晚被擠掉
            return hit
    try:
        blob = (WEBP_DIR / f"{digest}.webp").read_bytes()
    except OSError:
        blob = None
    if blob and blob[:4] == b"RIFF":
        _webp_remember(digest, blob)
        return blob
    try:
        blob = api("GET", f"/view?{q}&preview=" + urllib.parse.quote("webp;85"), timeout=60)
    except Exception:
        return None
    if not isinstance(blob, (bytes, bytearray)) or blob[:4] != b"RIFF":
        return None
    blob = bytes(blob)
    _webp_remember(digest, blob)
    _webp_disk_put(digest, blob)
    return blob


def first_image_src(history: dict, preferred_nodes=None) -> str | None:
    outputs = history.get("outputs") or {}
    node_ids = list(outputs)
    if preferred_nodes:
        preferred = {str(n) for n in preferred_nodes}
        node_ids = [nid for nid in node_ids if str(nid) in preferred]
    for nid in node_ids:
        node_out = outputs.get(nid) or {}
        for img in node_out.get("images") or []:
            q = comfy_view_query(
                img.get("filename") or "",
                img.get("subfolder") or "",
                img.get("type") or "output",
            )
            if q:
                return "/api/image?" + q
    return None


def sse(event: str, data: dict) -> bytes:
    return (
        f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
    ).encode("utf-8")


def parse_comfy_binary(buf: bytes):
    if len(buf) < 8:
        return None
    event_type, image_type = struct.unpack(">II", buf[:8])
    if event_type != 1:
        return None
    mime = {1: "image/jpeg", 2: "image/png"}.get(image_type)
    if not mime:
        return None
    return mime, buf[8:]


def ws_frame(payload: bytes, opcode: int = 1) -> bytes:
    n = len(payload)
    head = bytes([0x80 | opcode])
    if n < 126:
        head += bytes([0x80 | n])
    elif n < 65536:
        head += bytes([0x80 | 126]) + struct.pack(">H", n)
    else:
        head += bytes([0x80 | 127]) + struct.pack(">Q", n)
    key = os.urandom(4)
    masked = bytes(b ^ key[i % 4] for i, b in enumerate(payload))
    return head + key + masked


def mask_ws(frame: bytes) -> tuple[int, bytes]:
    opcode = frame[0] & 0x0F
    masked = frame[1] & 0x80
    n = frame[1] & 0x7F
    i = 2
    if n == 126:
        n = struct.unpack(">H", frame[i : i + 2])[0]
        i += 2
    elif n == 127:
        n = struct.unpack(">Q", frame[i : i + 8])[0]
        i += 8
    if masked:
        key = frame[i : i + 4]
        i += 4
        data = bytes(frame[i + j] ^ key[j % 4] for j in range(n))
    else:
        data = frame[i : i + n]
    return opcode, data


# 一張 1024 預覽 JPEG 大概幾百 KB。上限只是防呆：幀頭被讀錯位的時候，長度欄位
# 會解出天文數字，沒有這道閘就會一路吞資料把記憶體吃光。
WS_FRAME_MAX = 64 * 1024 * 1024


class Ws:
    def __init__(self, sock: socket.socket, buf: bytes = b""):
        self.sock = sock
        self.buf = buf

    def _fill(self, n: int) -> None:
        """把 buf 補到至少 n bytes。中途丟例外時 buf 原封不動，收到的那些照樣留著。"""
        while len(self.buf) < n:
            chunk = self.sock.recv(max(4096, n - len(self.buf)))
            if not chunk:
                raise ConnectionError("ws closed")
            self.buf += chunk

    def recv(self) -> tuple[int, bytes]:
        # 整幀到齊才動 buf。舊版是一個 byte 一個 byte 從 buf 吃掉，socket.timeout
        # 只要落在幀中間（大張預覽會跨好幾個 TCP segment，取樣時卡兩秒很常見），
        # 已經吃掉的頭就永遠消失，之後每一幀都錯位解讀 —— 呼叫端接住逾時重來一次
        # 也救不回來。現在逾時丟出去 buf 還是完整的，下次進來從同一個邊界再解一次。
        self._fill(2)
        b0, b1 = self.buf[0], self.buf[1]
        n = b1 & 0x7F
        head = 2
        if n == 126:
            self._fill(4)
            n = struct.unpack(">H", self.buf[2:4])[0]
            head = 4
        elif n == 127:
            self._fill(10)
            n = struct.unpack(">Q", self.buf[2:10])[0]
            head = 10
        if n > WS_FRAME_MAX:
            raise ConnectionError(f"ws frame too big: {n}")
        masked = bool(b1 & 0x80)
        if masked:
            head += 4
        self._fill(head + n)
        frame, self.buf = self.buf[: head + n], self.buf[head + n :]
        data = frame[head:]
        if masked:
            key = frame[head - 4 : head]
            data = bytes(c ^ key[i % 4] for i, c in enumerate(data))
        return b0 & 0x0F, data

    def send(self, data: bytes, opcode: int = 1) -> None:
        self.sock.sendall(ws_frame(data, opcode))

    def close(self) -> None:
        try:
            self.send(b"", 8)
        except Exception:
            pass
        try:
            self.sock.close()
        except Exception:
            pass


def ws_connect(http_base: str, client_id: str, timeout: float = 30) -> Ws:
    u = urllib.parse.urlparse(http_base)
    host = u.hostname or "127.0.0.1"
    port = u.port or (443 if u.scheme == "https" else 80)
    base_path = (u.path or "").rstrip("/")
    path = base_path + "/ws?clientId=" + urllib.parse.quote(client_id)
    sock = socket.create_connection((host, port), timeout=timeout)
    if u.scheme == "https":
        sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
    sock.settimeout(timeout)
    key = base64.b64encode(os.urandom(16)).decode("ascii")
    host_header = f"[{host}]" if ":" in host else host
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host_header}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    sock.sendall(req.encode("ascii"))
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("ws handshake")
        buf += chunk
    head, rest = buf.split(b"\r\n\r\n", 1)
    if b" 101 " not in head.split(b"\r\n", 1)[0] and not head.startswith(b"HTTP/1.1 101"):
        raise ConnectionError(head.decode("latin1", "replace")[:200])
    return Ws(sock, rest)


def _job(
    seed: int,
    width: int,
    height: int,
    positive: str,
    image: str,
    ckpt: str | None = None,
    hires: dict | None = None,
) -> dict:
    out = {
        "ok": True,
        "image": with_content_hash(image),
        "seed": seed,
        "ckpt": ckpt or CKPT,
        "width": width,
        "height": height,
        "positive": positive,
    }
    if hires:
        out["hires"] = {"mode": hires.get("mode"), "scale": hires.get("scale")}
    return out


# 單張圖的上限。超過就報錯收工，免得 Comfy 卡住的時候無限抽整晚空轉。
GEN_TIMEOUT = float(cfg("comfy.genTimeoutSec", "COMFY_GEN_TIMEOUT", 600))

# 預覽幀最短間隔（秒）。ComfyUI 每一步都送一張全尺寸預覽（1024² 的 JPEG 約 77 KB，
# 包成 base64 約 100 KB），25 步就是 2.5 MB —— 比成品原圖還大。本機無所謂，
# 從 Mac 走 Tailscale、手機走行動網路時，這 2.5 MB 會把進度和成品一起塞住。
# 0.6 秒一張：一張圖大約剩 8 幀（約 0.8 MB），看起來仍然是一路長出來的。0 = 每一步都送。
PREVIEW_MIN_GAP = float(cfg("comfy.previewGapSec", "COMFY_PREVIEW_GAP", 0.6))


def preview_due(last: float, now: float, gap: float = None) -> bool:
    """這一幀要不要送出去。第一幀一定送（last=0），之後至少隔 gap 秒。"""
    gap = PREVIEW_MIN_GAP if gap is None else gap
    return last <= 0 or gap <= 0 or now - last >= gap - 1e-6


class WsUnavailable(Exception):
    pass


def gen_via_ws(width: int, height: int, seed: int, positive: str, wf: dict, hires: dict | None = None):
    cid = uuid.uuid4().hex
    ckpt = workflows.ckpt_name_of(wf) or CKPT
    save_ids = set(workflows.image_output_nodes(wf))
    try:
        ws = ws_connect(comfy_base(), cid, timeout=20)
    except Exception as exc:
        raise WsUnavailable(str(exc)) from exc
    # POST /prompt 以前落在 try 外面：它一丟例外（Comfy 忙、顯存不夠、工作流被退件），
    # 剛開好的 websocket 就沒人關，跑一整晚會把 socket 和 Comfy 的 client 一起積爆。
    try:
        yield ("ping", {"stage": "connected"})
        posted = api("POST", "/prompt", {"prompt": wf, "client_id": cid}, timeout=60)
        prompt_id = (posted or {}).get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"Comfy 沒有回 prompt_id：{posted!r}"[:200])
        yield ("ping", {"stage": "queued", "prompt_id": prompt_id})
        t0 = time.time()
        beat = t0
        last_pv = 0.0
        while time.time() - t0 < GEN_TIMEOUT:
            try:
                ws.sock.settimeout(2.0)
                op, data = ws.recv()
            except socket.timeout:
                hist = api("GET", f"/history/{prompt_id}", timeout=20)
                if hist and prompt_id in hist:
                    image = first_image_src(hist[prompt_id], save_ids)
                    if image:
                        yield ("done", _job(seed, width, height, positive, image, ckpt, hires))
                        return
                # 心跳：載模型的時候 Comfy 可以安靜一分鐘以上。沒有這一下，前端分不出
                # 「還在載」和「伺服器這條執行緒卡死了」，寫也寫不出去的斷線也發現不了。
                now = time.time()
                if now - beat >= 5:
                    beat = now
                    yield ("ping", {"waited": round(now - t0, 1)})
                continue
            if op == 8:
                # 對面收線。先撈一次 history —— 圖可能已經存好了，只是收線比 executed 快。
                hist = api("GET", f"/history/{prompt_id}", timeout=20)
                image = first_image_src(hist[prompt_id], save_ids) if hist and prompt_id in hist else None
                if image:
                    yield ("done", _job(seed, width, height, positive, image, ckpt, hires))
                    return
                raise ConnectionError("Comfy 關掉了 websocket")
            if op == 9:
                ws.send(data, 10)
                continue
            if op == 2:
                now = time.time()
                if not preview_due(last_pv, now):
                    continue
                last_pv = now
                parsed = parse_comfy_binary(data)
                if parsed:
                    mime, blob = parsed
                    b64 = base64.b64encode(blob).decode("ascii")
                    yield ("preview", {"image": f"data:{mime};base64,{b64}"})
                continue
            if op != 1:
                continue
            try:
                msg = json.loads(data.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                # 單一壞幀不值得賠掉整張圖：跳過，讓 history 輪詢去撿結果。
                continue
            typ = msg.get("type")
            d = msg.get("data") or {}
            if typ == "progress":
                yield (
                    "progress",
                    {
                        "value": int(d.get("value") or 0),
                        "max": int(d.get("max") or STEPS),
                    },
                )
            elif typ == "execution_error":
                raise RuntimeError(str(d.get("exception_message") or d or "Comfy error"))
            elif typ == "execution_interrupted" and d.get("prompt_id") == prompt_id:
                # 這則是廣播給所有連線的：只認自己那張的 prompt_id，別張被中斷不關我的事。
                raise RuntimeError("ComfyUI 中斷了這張")
            elif typ in ("execution_success", "executed"):
                nid = str(d.get("node") or "")
                if typ == "executed" and save_ids and nid not in save_ids:
                    continue
                hist = api("GET", f"/history/{prompt_id}", timeout=30)
                if hist and prompt_id in hist:
                    image = first_image_src(hist[prompt_id], save_ids)
                    if image:
                        yield ("done", _job(seed, width, height, positive, image, ckpt, hires))
                        return
        raise TimeoutError(f"Comfy 超過 {GEN_TIMEOUT} 秒沒有產出（prompt {prompt_id}）")
    finally:
        ws.close()


# === 可以接回去的出圖工作 =====================================================
# 從別台裝置付印（Mac 走 Tailscale、手機）時，網路只要斷一下，舊流程就把 Comfy 正在畫的
# 那張中斷掉。網頁在請求上帶 `X-Gen-Resume: 1`（「我會接回來」）時改成：
#   - 出圖在自己的執行緒跑，事件記在 GenJob 裡（預覽只留最新一張）；
#   - 連線斷了先不砍：GEN_REATTACH_SEC 秒內用 GET /api/gen/attach?job= 接回來，從頭重播、接著收；
#   - 沒人接回來才照舊送 /interrupt（只砍自己那張）；
#   - POST /api/gen/cancel {job} 是明確的「停」：排隊中的從 Comfy 佇列刪掉，畫到一半的中斷。
# 沒帶這個 header 的房間，/api/gen 的行為一點都沒變（斷線就中斷）。
GEN_REATTACH_SEC = float(cfg("comfy.reattachSec", "GEN_REATTACH_SEC", 30))
# 印好的留多久給人接回去：離開墨池去翻作品冊時，那張照樣畫完（見 GEN_KEPT_SEC），回來才接得到。
GEN_KEEP_DONE_SEC = 1800.0
# 網站還有任何一頁開著（頂欄的生圖進度每幾秒問一次 /api/gen/active?keep=1），沒人接的那張也不砍。
# 背景分頁的計時器最慢一分鐘才跑一次，所以留兩分鐘。
GEN_KEPT_SEC = 120.0
_JOBS: dict[str, "GenJob"] = {}
_JOBS_LOCK = threading.Lock()


def active_jobs(keep: bool = False) -> list[dict]:
    """頂欄的生圖進度：還在排隊、畫到一半的，跟 GEN_KEEP_DONE_SEC 內印完的（按停的不算）。

    keep：問的那一頁還開著，替沒人接的那幾張續命 GEN_KEPT_SEC 秒（見 GenJob.abandoned）。
    """
    now = time.time()
    with _JOBS_LOCK:
        jobs = list(_JOBS.values())
    out = []
    for j in jobs:
        if j.cancelled or (j.finished and now - j.finished_at > GEN_KEEP_DONE_SEC):
            continue
        if keep and not j.finished:
            with j.cond:
                j.kept_until = now + GEN_KEPT_SEC
        state = ("error" if j.failed else "done") if j.finished else ("running" if j.started else "queued")
        out.append({
            "id": j.id,
            "origin": j.origin,
            "kind": j.kind,
            "state": state,
            "progress": round(j.progress, 3),
            "createdAt": int(j.created_at * 1000),
            "finishedAt": int(j.finished_at * 1000) if j.finished else 0,
        })
    out.sort(key=lambda x: x["createdAt"])
    return out


_STATS_CACHE: dict = {"key": None, "value": None}
_FAV_CACHE: dict = {"key": None, "value": None}


def _recipes_stamp() -> tuple:
    try:
        st = Path(recipes.DATA_DIR).stat()
        n = sum(1 for _ in Path(recipes.DATA_DIR).glob("*.json"))
        return (st.st_mtime_ns, n)
    except OSError:
        return (0, 0)


def favorite_index() -> dict:
    """作品冊每一筆的 fav_key → {"id", "thumb"}（gen_log 用種子＋牌認收藏）。作品冊沒變就用上一次的。
    "_known" 放詞庫的牌（算 fav_key 時只看牌）。"""
    key = (_recipes_stamp(), card_usage.LEXICON_PATH.stat().st_mtime_ns if card_usage.LEXICON_PATH.exists() else 0)
    if _FAV_CACHE["key"] == key and _FAV_CACHE["value"] is not None:
        return _FAV_CACHE["value"]
    known = card_usage._known_tags()
    idx: dict = {"_known": known}
    for r in recipes.list_recipes():
        cards = [t for t in gen_log.tags_of(r.get("positive")) if t in known]
        ref = r.get("thumbnail") or r.get("image") or {}
        thumb = f"/api/recipes/files/{urllib.parse.quote(str(ref.get('file')))}" if isinstance(ref, dict) and ref.get("file") else None
        idx[gen_log.fav_key(r.get("seed"), cards)] = {"id": r.get("id"), "thumb": thumb}
    _FAV_CACHE.update(key=key, value=idx)
    return idx


def genlog_stats() -> dict:
    """牌的戰績、模型成績單、成就用的統計。日誌、作品冊、詞庫都沒變就用上一次算好的
    （作品冊要把每一件的 JSON 讀一遍，卡冊每換一次排序都會問）。"""
    def stamp(path) -> tuple:
        try:
            st = Path(path).stat()
            return (st.st_mtime_ns, st.st_size)
        except OSError:
            return (0, 0)

    try:
        n_recipes = sum(1 for _ in Path(recipes.DATA_DIR).glob("*.json"))
    except OSError:
        n_recipes = 0
    key = (stamp(gen_log.LOG_PATH), stamp(recipes.DATA_DIR), n_recipes, stamp(card_usage.LEXICON_PATH))
    if _STATS_CACHE["key"] == key and _STATS_CACHE["value"] is not None:
        return _STATS_CACHE["value"]
    value = gen_log.stats(card_usage._known_tags(), recipes.list_recipes())
    _STATS_CACHE.update(key=key, value=value)
    return value


class GenJob:
    def __init__(self, events, payload: dict | None = None):
        self.id = uuid.uuid4().hex[:16]
        # 頂欄的生圖進度（GET /api/gen/active）：哪一頁送的、是不是 Hires、建立時間、畫到哪。
        src = payload if isinstance(payload, dict) else {}
        self.origin = src.get("origin") if src.get("origin") in ("mochi", "fuse") else ""
        self.kind = "hires" if src.get("hires") else "gen"
        self.created_at = time.time()
        self.progress = 0.0
        self.started = False
        self.failed = False
        self.kept_until = 0.0
        # 出圖日誌（gen_log.py）：做完時照這份配方記一行；第一格進度的時間用來算真的在畫多久。
        self.payload = src
        self.drawing_at: float | None = None
        self.cond = threading.Condition()
        self.log: list[tuple[str, dict]] = []  # 預覽以外的每一則；接回來的人從頭重播
        self.preview: tuple[int, dict] | None = None  # 預覽一張幾十 KB，只留最新的
        self.pv_seq = 0
        self.finished = False
        self.finished_at = 0.0
        self.prompt_id: str | None = None
        self.watchers = 0
        self.left_at = time.time()
        self.cancelled = False
        self._events = events

    def start(self) -> "GenJob":
        with _JOBS_LOCK:
            now = time.time()
            for jid, job in list(_JOBS.items()):
                if job.finished and now - job.finished_at > GEN_KEEP_DONE_SEC:
                    del _JOBS[jid]
            _JOBS[self.id] = self
        threading.Thread(target=self._run, name=f"gen-{self.id}", daemon=True).start()
        return self

    def push(self, event: str, data: dict) -> None:
        ended = False
        with self.cond:
            if self.finished:
                return
            if isinstance(data, dict) and data.get("prompt_id"):
                self.prompt_id = data["prompt_id"]
            if event == "preview":
                self.pv_seq += 1
                self.preview = (self.pv_seq, data)
                self.started = True
            else:
                self.log.append((event, data))
            if event == "progress" and isinstance(data, dict):
                self.started = True
                if self.drawing_at is None:
                    self.drawing_at = time.time()
                try:
                    self.progress = max(0.0, min(1.0, float(data.get("value") or 0) / float(data.get("max") or 25)))
                except (TypeError, ValueError):
                    pass
            if event in ("done", "error"):
                self.finished = True
                self.finished_at = time.time()
                self.failed = event == "error"
                ended = not self.cancelled
            self.cond.notify_all()
        if ended:
            gen_log.record(
                gen_log.entry_of(
                    self.id,
                    self.payload,
                    event == "done",
                    data,
                    origin=self.origin,
                    kind=self.kind,
                    created_at=self.created_at,
                    started_at=self.drawing_at,
                    finished_at=self.finished_at,
                )
            )

    def abandoned(self) -> bool:
        with self.cond:
            now = time.time()
            return self.cancelled or (self.watchers == 0 and now - self.left_at > GEN_REATTACH_SEC and now > self.kept_until)

    def _run(self) -> None:
        gave_up = False
        try:
            # gen_via_ws 在等的時候每 5 秒有一則心跳，所以「沒人接回來」最慢 5 秒內會被發現。
            for event, data in self._events:
                self.push(event, data)
                if event in ("done", "error"):
                    return
                if self.abandoned():
                    gave_up = True
                    return
        except Exception as exc:
            self.push("error", {"error": str(exc)})
        finally:
            try:
                self._events.close()
            except Exception:
                pass
            if gave_up and self.prompt_id:
                # 按停的時候 prompt_id 可能還沒回來（cancel() 那時什麼都做不了）：在這裡補做。
                # 沒人接回來的也一樣要從佇列拿掉 —— /interrupt 只砍正在畫的，還在排隊的會被
                # Comfy 照樣畫完（沒人要的圖），後面每一張都被往後推。刪一個已經在畫的是無害的。
                try:
                    api("POST", "/queue", {"delete": [self.prompt_id]}, timeout=8)
                except Exception:
                    pass
                try:
                    comfy_interrupt(self.prompt_id)
                except Exception:
                    pass
            if gave_up:
                self.push("error", {"error": "已取消" if self.cancelled else "連線斷了太久沒接回來，這張已經停掉"})
            self.push("error", {"error": "出圖流程中途結束"})  # 已經結束的不會再記

    def cancel(self) -> None:
        with self.cond:
            self.cancelled = True
            pid = self.prompt_id
            done = self.finished
        if done or not pid:
            return
        # 還在排隊的：從 Comfy 的佇列拿掉（/interrupt 只砍正在畫的那張）。畫到一半的：中斷。
        try:
            api("POST", "/queue", {"delete": [pid]}, timeout=8)
        except Exception:
            pass
        try:
            comfy_interrupt(pid)
        except Exception:
            pass


def find_job(jid: str) -> "GenJob | None":
    with _JOBS_LOCK:
        return _JOBS.get(str(jid or ""))


def gen_events(payload: dict):
    try:
        wf, meta = prepare_workflow(payload)
    except workflows.WorkflowError as exc:
        yield ("error", {"error": str(exc), "code": exc.code})
        return
    except (ValueError, TypeError) as exc:
        yield ("error", {"error": str(exc)})
        return
    seed, width, height, positive = meta["seed"], meta["width"], meta["height"], meta["positive"]
    yield ("queued", {"seed": seed, "width": width, "height": height})
    try:
        yield from gen_via_ws(width, height, seed, positive, wf, hires=meta.get("hires"))
        return
    except WsUnavailable:
        pass
    except Exception as exc:
        yield ("error", {"error": str(exc)})
        return
    try:
        yield ("done", gen(payload))
    except Exception as exc:
        yield ("error", {"error": str(exc)})


def gen(payload: dict) -> dict:
    wf, meta = prepare_workflow(payload)
    seed, width, height, positive = meta["seed"], meta["width"], meta["height"], meta["positive"]
    prompt_id = api("POST", "/prompt", {"prompt": wf}, timeout=60)["prompt_id"]
    hist = wait_done(prompt_id)
    image = first_image_src(hist)
    if not image:
        raise RuntimeError("Comfy 沒有產出圖片")
    out = {
        "ok": True,
        "image": image,
        "seed": seed,
        "ckpt": workflows.ckpt_name_of(wf) or CKPT,
        "width": width,
        "height": height,
        "positive": positive,
    }
    if meta.get("hires"):
        out["hires"] = meta["hires"]
    return out


# --- Telegram: 把成圖投到頻道 ---------------------------------------------
# token 只活在這支程式的記憶體和 .secrets/telegram.json 裡。/api/telegram/config
# 的 GET 只回末四碼，前端拿不到 token 本體。上傳跑在背景執行緒，抽圖不等它。

TG_API = str(cfg("telegram.api", "TELEGRAM_API", "https://api.telegram.org"))
TG_SECRETS = ROOT / ".secrets" / "telegram.json"
TG_CAPTION_MAX = 1024
TG_TEXT_MAX = 4096
TG_GAP = 1.0  # 頻道大約 20 則/分鐘，每則之間隔一秒
TG_RETRY_WAIT = 5.0
# 佇列上限。Telegram 連不上的時候每一張要等 60 秒才失敗，而無限抽十秒就出一張 ——
# 沒有上限就會一路積到記憶體爆掉，而且你按停之後它還要吐好幾個小時。
TG_QUEUE_MAX = int(cfg("telegram.queueMax", "", 200))

_tg_lock = threading.Lock()
_tg_queue: "queue.Queue[dict]" = queue.Queue()
_tg_worker: threading.Thread | None = None
_tg = {
    "token": "",
    "chatId": "",
    "enabled": False,
    "sent": 0,
    "failed": 0,
    "lastError": "",
}


def tg_load() -> None:
    try:
        raw = json.loads(TG_SECRETS.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(raw, dict):
        return
    with _tg_lock:
        _tg["token"] = str(raw.get("token") or "")
        _tg["chatId"] = str(raw.get("chatId") or "")
        _tg["enabled"] = bool(raw.get("enabled"))


def tg_save() -> None:
    with _tg_lock:
        body = {
            "token": _tg["token"],
            "chatId": _tg["chatId"],
            "enabled": _tg["enabled"],
        }
    TG_SECRETS.parent.mkdir(parents=True, exist_ok=True)
    TG_SECRETS.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(TG_SECRETS, 0o600)
    except OSError:
        pass  # Windows 上沒什麼效果，靠 .gitignore 擋 git


def tg_tail(token: str) -> str:
    t = str(token or "")
    return ("…" + t[-4:]) if len(t) >= 4 else ("…" if t else "")


def tg_scrub(text: str) -> str:
    """別讓 urllib 的例外把含 token 的 URL 帶回前端。"""
    out = str(text)
    with _tg_lock:
        token = _tg["token"]
    if token:
        out = out.replace(token, "***")
    return out


def tg_status() -> dict:
    with _tg_lock:
        return {
            "ok": True,
            "configured": bool(_tg["token"] and _tg["chatId"]),
            "tokenTail": tg_tail(_tg["token"]),
            "chatId": _tg["chatId"],
            "enabled": bool(_tg["enabled"]),
            "sent": _tg["sent"],
            "failed": _tg["failed"],
            "lastError": _tg["lastError"],
            "queued": _tg_queue.qsize(),
        }


def tg_caption(job: dict) -> tuple[str, str]:
    """回 (caption, 補發的文字)。caption 塞不下英文 POS 時，英文另發一則接在圖下面。"""
    head_bits = []
    if job.get("seed") is not None:
        head_bits.append(f"seed {job['seed']}")
    if job.get("width") and job.get("height"):
        head_bits.append(f"{job['width']}x{job['height']}")
    head = " · ".join(head_bits)
    zh = str(job.get("zh") or "").strip()
    en = str(job.get("en") or "").strip()

    full = "\n".join([p for p in (head, zh, en) if p])
    if len(full) <= TG_CAPTION_MAX:
        return full, ""

    short = "\n".join([p for p in (head, zh) if p])
    if len(short) > TG_CAPTION_MAX:
        short = short[: TG_CAPTION_MAX - 1] + "…"
    return short, en


def tg_multipart(fields: dict, filename: str, blob: bytes, mime: str,
                 field: str = "photo") -> tuple[bytes, str]:
    """Telegram 的檔案欄位叫 photo，Discord 要的是 files[0]，其餘完全一樣。"""
    boundary = "----paiziCase" + uuid.uuid4().hex
    sep = ("--" + boundary).encode("utf-8")
    out = bytearray()
    for key, val in fields.items():
        out += sep + b"\r\n"
        out += f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8")
        out += str(val).encode("utf-8") + b"\r\n"
    out += sep + b"\r\n"
    out += (
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8")
    out += blob + b"\r\n"
    out += sep + b"--\r\n"
    return bytes(out), boundary


def tg_call(method: str, body: bytes, ctype: str, timeout: float = 60) -> dict:
    with _tg_lock:
        token = _tg["token"]
    if not token:
        raise RuntimeError("沒有 bot token")
    req = urllib.request.Request(
        f"{TG_API}/bot{token}/{method}",
        data=body,
        headers={"Content-Type": ctype},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        try:
            got = json.loads(exc.read().decode("utf-8") or "{}")
        except Exception:
            got = {}
        desc = got.get("description") or f"HTTP {exc.code}"
        err = RuntimeError(f"{exc.code} {desc}")
        err.tg_code = exc.code  # type: ignore[attr-defined]
        raise err from None
    except Exception as exc:
        raise RuntimeError(tg_scrub(str(exc))) from None


def tg_form(method: str, fields: dict, timeout: float = 30) -> dict:
    body = urllib.parse.urlencode(fields).encode("utf-8")
    return tg_call(method, body, "application/x-www-form-urlencoded", timeout)


def tg_send_text(text: str, reply_to: int | None = None) -> dict:
    with _tg_lock:
        chat = _tg["chatId"]
    fields = {"chat_id": chat, "text": text[:TG_TEXT_MAX], "disable_web_page_preview": "true"}
    if reply_to:
        fields["reply_to_message_id"] = str(reply_to)
        fields["allow_sending_without_reply"] = "true"
    return tg_form("sendMessage", fields)


def tg_send_photo(job: dict) -> None:
    q = comfy_view_query(
        job.get("filename") or "",
        job.get("subfolder") or "",
        job.get("type") or "output",
    )
    if not q:
        raise RuntimeError("bad image query")
    blob = api("GET", f"/view?{q}", timeout=60)
    if not isinstance(blob, (bytes, bytearray)):
        raise RuntimeError("Comfy 沒給圖")
    mime = "image/png"
    if blob[:3] == b"\xff\xd8\xff":
        mime = "image/jpeg"
    elif blob[:4] == b"RIFF":
        mime = "image/webp"
    caption, tail = tg_caption(job)
    with _tg_lock:
        chat = _tg["chatId"]
    body, boundary = tg_multipart(
        {"chat_id": chat, "caption": caption},
        str(job.get("filename") or "shot.png"),
        bytes(blob),
        mime,
    )
    got = tg_call("sendPhoto", body, f"multipart/form-data; boundary={boundary}")
    if tail:
        mid = ((got.get("result") or {}).get("message_id")) if isinstance(got, dict) else None
        for i in range(0, len(tail), TG_TEXT_MAX):
            tg_send_text(tail[i : i + TG_TEXT_MAX], mid)
            mid = None


def tg_pump() -> None:
    while True:
        job = _tg_queue.get()
        try:
            try:
                tg_send_photo(job)
            except RuntimeError as exc:
                if getattr(exc, "tg_code", None) == 429:
                    time.sleep(TG_RETRY_WAIT)
                    tg_send_photo(job)
                else:
                    raise
            with _tg_lock:
                _tg["sent"] += 1
                _tg["lastError"] = ""
        except Exception as exc:  # worker 絕不能死
            with _tg_lock:
                _tg["failed"] += 1
                _tg["lastError"] = tg_scrub(str(exc))[:300]
        finally:
            _tg_queue.task_done()
        time.sleep(TG_GAP)


def tg_start() -> None:
    global _tg_worker
    if _tg_worker and _tg_worker.is_alive():
        return
    _tg_worker = threading.Thread(target=tg_pump, name="telegram", daemon=True)
    _tg_worker.start()


def tg_enqueue(job: dict) -> dict:
    with _tg_lock:
        ready = bool(_tg["token"] and _tg["chatId"] and _tg["enabled"])
    if not ready:
        return {"ok": False, "error": "Telegram 還沒設定或沒開"}
    if not comfy_view_query(
        job.get("filename") or "", job.get("subfolder") or "", job.get("type") or "output"
    ):
        return {"ok": False, "error": "bad image query"}
    deep = _tg_queue.qsize()
    if deep >= TG_QUEUE_MAX:
        return {"ok": False, "error": f"Telegram 佇列塞住了（{deep} 張待送），這張不排"}
    tg_start()
    _tg_queue.put(job)
    return {"ok": True, "queued": _tg_queue.qsize()}


def tg_apply_config(payload: dict) -> dict:
    token = str(payload.get("token") or "").strip()
    chat = str(payload.get("chatId") or "").strip()
    with _tg_lock:
        if token:
            _tg["token"] = token
        _tg["chatId"] = chat
        if "enabled" in payload:
            _tg["enabled"] = bool(payload.get("enabled"))
    try:
        tg_save()
    except Exception as exc:
        return {"ok": False, "error": tg_scrub(str(exc))}
    return tg_status()


# ---------------------------------------------------------------- Discord
# 和 Telegram 同一套形狀：設定存在 .secrets/、背景 worker 一張一張送、佇列有上限、
# worker 絕不能死。差別只有三處：認證放 header 不放 URL、頻道 ID 在路徑上、
# 訊息上限 2000 字（Telegram 的 caption 是 1024）。
DC_API = str(cfg("discord.api", "DISCORD_API", "https://discord.com/api/v10"))
DC_SECRETS = ROOT / ".secrets" / "discord.json"
DC_CONTENT_MAX = 2000
# Discord embed 的上限（官方文件）：標題 256、說明 4096、單一欄位值 1024。
DC_TITLE_MAX = 256
DC_DESC_MAX = 4096
# 左側色條。跟介面的 --color-accent 同一個硃砂調；Hires 的放大圖用金色，一眼分得開。
DC_COLOR = 0xE0563C
DC_COLOR_HIRES = 0xD9A441
# 欄位（官方上限：一個欄位值 1024、作者名 256、頁尾 2048、一則訊息所有 embed 加起來 6000）。
DC_FIELD_MAX = 1024
DC_AUTHOR_MAX = 256
DC_FOOTER_MAX = 2048
DC_RATING_ZH = {"general": "全年齡", "sensitive": "敏感", "explicit": "色情"}
# 中文標籤照詞庫的 section 分欄，順序就是畫面上的順序。查不到的（LoRA 觸發詞、手打的字）歸「其他」。
DC_SECTIONS = (
    ("subject", "人物"),
    ("feature", "外觀"),
    ("clothing", "服裝"),
    ("pose", "姿勢"),
    ("env", "場景"),
    ("quality", "畫質"),
)
DC_GAP = 1.0
DC_RETRY_WAIT = 5.0
DC_QUEUE_MAX = int(cfg("discord.queueMax", "", 200))
# Webhook 模式。Discord 的 webhook 不需要 bot：在頻道設定 → 整合 → 建立 Webhook
# 就拿得到一個網址，POST 上去就好，官方文件對那個端點的說法是
# "does not require authentication"。對「只是單向貼圖」的我們來說，它省掉建
# application、邀 bot 進伺服器、開開發者模式抓頻道 ID 那幾步；而且萬一外洩，
# 它能做的事只有「往那一個頻道貼文」，不像 bot token 是整包權限。
#
# 代價是**網址本身就是憑證**，所以一定要驗證它真的指向 Discord —— 使用者貼錯
# 一行的後果不是「送不出去」，是成圖被 POST 到別人的主機上。
DC_WEBHOOK_HOSTS = ("discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com")

_dc_lock = threading.Lock()
_dc_queue: "queue.Queue[dict]" = queue.Queue()
_dc_worker: threading.Thread | None = None
_dc = {
    "mode": "bot",
    "token": "",
    "channelId": "",
    "webhook": "",
    "enabled": False,
    # 精簡：只送第一個 embed（圖＋一行小字），不送分欄和英文。無限抽洗版時用。
    "compact": False,
    "sent": 0,
    "failed": 0,
    "lastError": "",
}


def dc_load() -> None:
    try:
        raw = json.loads(DC_SECRETS.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(raw, dict):
        return
    with _dc_lock:
        _dc["token"] = str(raw.get("token") or "")
        _dc["channelId"] = str(raw.get("channelId") or "")
        _dc["webhook"] = str(raw.get("webhook") or "")
        # 舊的設定檔沒有 mode，那時只有 bot 一條路 —— 預設回 bot，現有設定照舊能用。
        mode = str(raw.get("mode") or "bot")
        _dc["mode"] = mode if mode in ("bot", "webhook") else "bot"
        _dc["enabled"] = bool(raw.get("enabled"))
        _dc["compact"] = bool(raw.get("compact"))


def dc_save() -> None:
    with _dc_lock:
        body = {
            "mode": _dc["mode"],
            "token": _dc["token"],
            "channelId": _dc["channelId"],
            "webhook": _dc["webhook"],
            "enabled": _dc["enabled"],
            "compact": _dc["compact"],
        }
    DC_SECRETS.parent.mkdir(parents=True, exist_ok=True)
    DC_SECRETS.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(DC_SECRETS, 0o600)
    except OSError:
        pass  # Windows 上沒什麼效果，靠 .gitignore 擋 git


def dc_scrub(text: str) -> str:
    """別讓例外訊息把憑證帶回前端。

    webhook 網址整條都是憑證（token 就在路徑最後一段），而且它會出現在
    urllib 的錯誤訊息裡，所以兩種模式都要遮。
    """
    out = str(text)
    with _dc_lock:
        token = _dc["token"]
        hook = _dc["webhook"]
    if token:
        out = out.replace(token, "***")
    if hook:
        out = out.replace(hook, "***")
        tail = hook.rstrip("/").rsplit("/", 1)[-1]
        if len(tail) >= 8:
            out = out.replace(tail, "***")
    return out


def _dc_configured_locked() -> bool:
    """設定齊不齊 —— 兩種模式條件不同，所以只寫這一份。

    呼叫者必須已經持有 _dc_lock（它不是可重入鎖）。分成兩份寫過一次就出事：
    面板用模式判斷、佇列卻寫死 bot 的條件，於是 webhook 模式下面板顯示「已設定」，
    每一張圖卻被擋在佇列外，而且錯誤訊息還說「還沒設定」。
    """
    if _dc["mode"] == "webhook":
        return bool(_dc["webhook"])
    return bool(_dc["token"] and _dc["channelId"])


def dc_status() -> dict:
    with _dc_lock:
        mode = _dc["mode"]
        configured = _dc_configured_locked()
        return {
            "ok": True,
            "mode": mode,
            "configured": configured,
            "tokenTail": tg_tail(_dc["token"]),
            "webhookTail": tg_tail(_dc["webhook"]),
            "channelId": _dc["channelId"],
            "enabled": bool(_dc["enabled"]),
            "compact": bool(_dc["compact"]),
            "sent": _dc["sent"],
            "failed": _dc["failed"],
            "lastError": _dc["lastError"],
            "queued": _dc_queue.qsize(),
        }


def dc_safe_filename(name: str) -> str:
    """embed 的 attachment:// 必須和上傳的檔名一字不差，先把奇怪字元濾掉。"""
    keep = "".join(c for c in str(name or "") if c.isalnum() or c in "._-")
    return keep[-100:] or "shot.png"


def dc_fence(text: str, limit: int) -> str:
    """包成 code block，並保證連圍籬一起不超過 limit。"""
    nl = chr(10)
    fence = "```"
    cost = len(fence) * 2 + 2  # 兩道圍籬加兩個換行
    room = max(0, limit - cost)
    body = text if len(text) <= room else text[: max(0, room - 1)] + "…"
    return fence + nl + body + nl + fence


_dc_lex: dict = {"mtime": None, "tags": {}, "zh": {}}


def dc_lexicon() -> "tuple[dict, dict]":
    """tag → (section, 中文)，和詞庫外的中文對照。檔案沒變就不重讀。"""
    path = SHARED / "lexicon.json"
    if not path.is_file():
        path = WEB / "lexicon.json"
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {}, {}
    if _dc_lex["mtime"] != mtime:
        tags: dict = {}
        extra: dict = {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for item in data.get("tags") or []:
                if isinstance(item, dict) and item.get("tag"):
                    tags[str(item["tag"])] = (str(item.get("section") or ""), str(item.get("zh") or ""))
            for t in data.get("quality") or []:
                tags.setdefault(str(t), ("quality", ""))
            if isinstance(data.get("zh"), dict):
                extra = {str(k): str(v) for k, v in data["zh"].items()}
        except Exception:
            tags, extra = {}, {}
        _dc_lex.update(mtime=mtime, tags=tags, zh=extra)
    return _dc_lex["tags"], _dc_lex["zh"]


def dc_tag_of(part: str) -> str:
    """POS 裡的一段 → 標籤本身：去掉 (tag:1.2) 的權重、Comfy 的跳脫括號。"""
    t = str(part or "").strip()
    m = re.match(r"^\((.+):(\d+(?:\.\d+)?)\)$", t)
    if m:
        t = m.group(1).strip()
    return t.replace("\\(", "(").replace("\\)", ")")


def dc_groups(en: str) -> "list[tuple[str, list[str]]]":
    """英文 POS → [(欄名, [中文…])]，照 DC_SECTIONS 的順序，空的欄不出現。"""
    tags, extra = dc_lexicon()
    if not tags:
        return []
    buckets: dict = {sec: [] for sec, _ in DC_SECTIONS}
    other: list = []
    for part in str(en or "").split(","):
        tag = dc_tag_of(part)
        if not tag:
            continue
        sec, zh = tags.get(tag, ("", ""))
        label = zh or extra.get(tag) or tag
        (buckets[sec] if sec in buckets else other).append(label)
    out = [(name, buckets[sec]) for sec, name in DC_SECTIONS if buckets[sec]]
    if other:
        out.append(("其他", other))
    return out


def dc_clip(text: str, limit: int) -> str:
    text = str(text or "")
    return text if len(text) <= limit else text[: max(0, limit - 1)] + "…"


def dc_model_name(path: str) -> str:
    """底模、LoRA 只留檔名本身：資料夾和副檔名在 Discord 上只是雜訊。"""
    base = re.split(r"[\\/]", str(path or ""))[-1]
    return re.sub(r"\.(safetensors|ckpt|pt|pth|bin)$", "", base, flags=re.I)


def dc_footer(job: dict) -> str:
    bits = []
    if job.get("seed") is not None:
        bits.append(f"seed {job['seed']}")
    if job.get("width") and job.get("height"):
        bits.append(f"{job['width']}×{job['height']}")
    ckpt = dc_model_name(job.get("ckpt") or "")
    if ckpt:
        bits.append(ckpt)
    loras = []
    for lo in job.get("loras") or []:
        if not isinstance(lo, dict):
            continue
        name = dc_model_name(lo.get("file") or lo.get("name") or "")
        if not name:
            continue
        try:
            loras.append(f"{name} ×{float(lo.get('strength')):g}")
        except (TypeError, ValueError):
            loras.append(name)
    if loras:
        bits.append("LoRA " + "、".join(loras))
    return " · ".join(bits)


def dc_payload(job: dict, filename: str, compact: bool = False) -> dict:
    """一張成品的訊息：圖放第一個 embed，分欄和英文 POS 放第二個。

    Discord 把訊息本文排在 embed 上面、embed 裡的文字又排在圖上面，所以只要有字
    跟圖放在同一塊，圖就會被往下推。拆成兩個 embed（都不設 url，否則 Discord 會把
    它們併成相簿），第一塊只有一行來源、圖、一行小字頁尾，滑頻道時第一眼就是圖。
    """
    hires = str(job.get("hires") or "").strip()
    color = DC_COLOR_HIRES if hires else DC_COLOR
    head = [str(job.get("source") or "").strip() or "排字匣"]
    rating = DC_RATING_ZH.get(str(job.get("rating") or ""))
    if rating:
        head.append(rating)
    hero: dict = {
        "color": color,
        "author": {"name": dc_clip(" · ".join(head), DC_AUTHOR_MAX)},
        "image": {"url": f"attachment://{filename}"},
    }
    if hires:
        hero["title"] = dc_clip(hires, DC_TITLE_MAX)
    foot = dc_footer(job)
    if foot:
        hero["footer"] = {"text": dc_clip(foot, DC_FOOTER_MAX)}
    embeds = [hero]
    if compact:
        return {"embeds": embeds}

    detail: dict = {"color": color}
    en = str(job.get("en") or "").strip()
    groups = dc_groups(en)
    if groups:
        detail["fields"] = [
            {"name": name, "value": dc_clip("、".join(labels), DC_FIELD_MAX), "inline": True}
            for name, labels in groups
        ]
    else:
        # 詞庫讀不到：退回前端給的整串中文。
        zh = str(job.get("zh") or "").strip()
        if zh:
            detail["description"] = dc_clip(zh, DC_DESC_MAX)
    if en:
        # dc_fence 的兩道圍籬加換行佔 8 字。
        if len(en) + 8 <= DC_FIELD_MAX or "description" in detail:
            # 放在分欄最下面，複製時一整塊拿得到。
            detail.setdefault("fields", []).append(
                {"name": "英文提示詞", "value": dc_fence(en, DC_FIELD_MAX), "inline": False}
            )
        else:
            # 塞不進欄位：改放說明（4096 字），會排在分欄上面，但至少完整、可複製。
            detail["description"] = dc_fence(en, DC_DESC_MAX)
    if detail.get("fields") or detail.get("description"):
        embeds.append(detail)
    return {"embeds": embeds}


def dc_webhook_ok(url: str) -> str:
    """把使用者貼進來的 webhook 網址驗過再收。

    這裡寧可嚴格：網址就是憑證，貼錯一行的後果是成圖被 POST 到別人的主機，
    不是「送不出去」而已。所以只收 https、只收 Discord 的網域、路徑必須是
    /api/webhooks/<id>/<token>。回傳正規化後的網址（去掉查詢字串和結尾斜線）。
    """
    raw = str(url or "").strip()
    if not raw:
        return ""
    try:
        u = urllib.parse.urlsplit(raw)
    except ValueError:
        raise RuntimeError("webhook 網址看不懂") from None
    if u.scheme != "https":
        raise RuntimeError("webhook 網址必須是 https")
    if (u.hostname or "").lower() not in DC_WEBHOOK_HOSTS:
        raise RuntimeError(f"webhook 網址的網域不是 Discord：{u.hostname or '(空)'}")
    path = u.path.rstrip("/")
    if not path.startswith("/api/webhooks/"):
        raise RuntimeError("webhook 網址的路徑不是 /api/webhooks/…")
    bits = [x for x in path.split("/") if x]
    if len(bits) < 4 or not bits[2] or not bits[3]:
        raise RuntimeError("webhook 網址少了 id 或 token")
    return urllib.parse.urlunsplit((u.scheme, u.netloc, path, "", ""))


def dc_endpoint() -> "tuple[str, dict]":
    """要往哪送、要不要帶認證 —— 兩種模式只差這裡，其餘的組版與佇列完全共用。"""
    with _dc_lock:
        mode = _dc["mode"]
        token = _dc["token"]
        channel = _dc["channelId"]
        hook = _dc["webhook"]
    headers = {
        # Discord 會擋掉沒有 User-Agent 的請求。
        "User-Agent": "DanbooruTagMochi (https://github.com/bosen12/danbooru_tag_mochi, 1.0)",
    }
    if mode == "webhook":
        if not hook:
            raise RuntimeError("沒有 webhook 網址")
        # webhook 不帶 Authorization：token 已經在網址裡，官方文件說這個端點
        # 不需要認證。多送一個 Authorization 反而會被 Discord 當成壞請求。
        return hook, headers
    if not token:
        raise RuntimeError("沒有 bot token")
    if not channel:
        raise RuntimeError("沒有頻道 ID")
    headers["Authorization"] = f"Bot {token}"
    return f"{DC_API}/channels/{urllib.parse.quote(channel)}/messages", headers


def dc_call(body: bytes, ctype: str, timeout: float = 60) -> dict:
    url, headers = dc_endpoint()
    req = urllib.request.Request(
        url,
        data=body,
        headers={**headers, "Content-Type": ctype},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        try:
            got = json.loads(exc.read().decode("utf-8") or "{}")
        except Exception:
            got = {}
        desc = got.get("message") or f"HTTP {exc.code}"
        err = RuntimeError(f"{exc.code} {desc}")
        err.dc_code = exc.code  # type: ignore[attr-defined]
        # 429 要等多久 Discord 自己會講，照它說的等，不要拿固定值猜。
        try:
            err.dc_retry = float(got.get("retry_after") or DC_RETRY_WAIT)  # type: ignore[attr-defined]
        except (TypeError, ValueError):
            err.dc_retry = DC_RETRY_WAIT  # type: ignore[attr-defined]
        raise err from None
    except Exception as exc:
        raise RuntimeError(dc_scrub(str(exc))) from None


def dc_send_text(text: str) -> dict:
    body = json.dumps({"content": text[:DC_CONTENT_MAX]}, ensure_ascii=False).encode("utf-8")
    return dc_call(body, "application/json")


def dc_send_photo(job: dict) -> None:
    q = comfy_view_query(
        job.get("filename") or "",
        job.get("subfolder") or "",
        job.get("type") or "output",
    )
    if not q:
        raise RuntimeError("bad image query")
    blob = api("GET", f"/view?{q}", timeout=60)
    if not isinstance(blob, (bytes, bytearray)):
        raise RuntimeError("Comfy 沒給圖")
    mime = "image/png"
    if blob[:3] == b"\xff\xd8\xff":
        mime = "image/jpeg"
    elif blob[:4] == b"RIFF":
        mime = "image/webp"
    fname = dc_safe_filename(job.get("filename") or "shot.png")
    with _dc_lock:
        compact = bool(_dc["compact"])
    payload = dc_payload(job, fname, compact)
    body, boundary = tg_multipart(
        {"payload_json": json.dumps(payload, ensure_ascii=False)},
        fname,
        bytes(blob),
        mime,
        field="files[0]",
    )
    dc_call(body, f"multipart/form-data; boundary={boundary}")


def dc_pump() -> None:
    while True:
        job = _dc_queue.get()
        try:
            try:
                dc_send_photo(job)
            except RuntimeError as exc:
                if getattr(exc, "dc_code", None) == 429:
                    time.sleep(min(getattr(exc, "dc_retry", DC_RETRY_WAIT), 60))
                    dc_send_photo(job)
                else:
                    raise
            with _dc_lock:
                _dc["sent"] += 1
                _dc["lastError"] = ""
        except Exception as exc:  # worker 絕不能死
            with _dc_lock:
                _dc["failed"] += 1
                _dc["lastError"] = dc_scrub(str(exc))[:300]
        finally:
            _dc_queue.task_done()
        time.sleep(DC_GAP)


def dc_start() -> None:
    global _dc_worker
    if _dc_worker and _dc_worker.is_alive():
        return
    _dc_worker = threading.Thread(target=dc_pump, name="discord", daemon=True)
    _dc_worker.start()


def dc_enqueue(job: dict) -> dict:
    with _dc_lock:
        ready = _dc_configured_locked() and bool(_dc["enabled"])
    if not ready:
        return {"ok": False, "error": "Discord 還沒設定或沒開"}
    if not comfy_view_query(
        job.get("filename") or "", job.get("subfolder") or "", job.get("type") or "output"
    ):
        return {"ok": False, "error": "bad image query"}
    deep = _dc_queue.qsize()
    if deep >= DC_QUEUE_MAX:
        return {"ok": False, "error": f"Discord 佇列塞住了（{deep} 張待送），這張不排"}
    dc_start()
    _dc_queue.put(job)
    return {"ok": True, "queued": _dc_queue.qsize()}


def dc_apply_config(payload: dict) -> dict:
    token = str(payload.get("token") or "").strip()
    channel = str(payload.get("channelId") or "").strip()
    mode = str(payload.get("mode") or "").strip().lower()
    try:
        # 和 token 同一個規矩：留空＝沿用已存的，不是清掉。
        hook = dc_webhook_ok(payload.get("webhook"))
    except Exception as exc:
        return {"ok": False, "error": dc_scrub(str(exc))}
    with _dc_lock:
        if token:
            _dc["token"] = token
        _dc["channelId"] = channel
        if hook:
            _dc["webhook"] = hook
        if mode in ("bot", "webhook"):
            _dc["mode"] = mode
        if "enabled" in payload:
            _dc["enabled"] = bool(payload.get("enabled"))
        if "compact" in payload:
            _dc["compact"] = bool(payload.get("compact"))
    try:
        dc_save()
    except Exception as exc:
        return {"ok": False, "error": dc_scrub(str(exc))}
    return dc_status()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        # Windows Console 的 QuickEdit／文字選取會阻塞同步 WriteConsole。
        # BaseHTTPRequestHandler 又會在送 response headers 前記 access log，於是只要
        # 黑窗被選到，每個新請求都卡在這裡，連重新整理 HTML 都載不回來。一般 access
        # log 沒有診斷價值；真正未處理的例外仍由 socketserver 印出 traceback。
        return

    def handle_one_request(self) -> None:
        try:
            super().handle_one_request()
        except (ConnectionError, TimeoutError):
            # 瀏覽器取消還沒載完的圖是常態：八格牆換格、按停、關分頁都會。
            # 不擋的話 socketserver 會為每一次噴一整篇 traceback，跑一整晚就把
            # 真正該看的錯誤淹掉了。
            self.close_connection = True

    def _json(self, code: int, obj: dict, extra=None, *, cache_control="no-store", conditional=False) -> None:
        blob = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        if conditional:
            # The validator covers the complete JSON representation, regardless of transfer encoding.
            etag = f'W/"{hashlib.sha1(blob).hexdigest()}"'
            if self.headers.get("If-None-Match") == etag:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.send_header("Cache-Control", cache_control)
                self.send_header("Vary", "Accept-Encoding")
                self.end_headers()
                return
        # 跟靜態檔同一條規則：過 1 KB、客戶端收 gzip、壓完真的比較小才壓。
        # /api/loras 518 KB → 96 KB，手機開 LoRA 選單等的就是這一包。
        packed = None
        if len(blob) > 1024 and "gzip" in (self.headers.get("Accept-Encoding") or ""):
            packed = gzip.compress(blob, 5)
            if len(packed) >= len(blob):
                packed = None
        if packed is not None:
            blob = packed
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(blob)))
        self.send_header("Cache-Control", cache_control)
        if conditional:
            self.send_header("ETag", etag)
            self.send_header("Vary", "Accept-Encoding")
        if packed is not None:
            self.send_header("Content-Encoding", "gzip")
            if not conditional:
                self.send_header("Vary", "Accept-Encoding")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        # HEAD 只給標頭：主體寫出去會留在持續連線上，下一個回應就解析錯位。
        if getattr(self, "command", "GET") != "HEAD":
            self.wfile.write(blob)

    def _bytes(self, code: int, body: bytes, mime: str, extra=None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _serve_loras(self) -> None:
        data = lora_scan.list_loras()
        if data.get("manager"):
            data = {**data, "manager": manager_url_for(self.headers.get("Host") or "", "/loras")}
        self._json(200, data, cache_control="private, no-cache", conditional=True)

    def _serve_checkpoints(self) -> None:
        try:
            items, source = checkpoints_for_ui()
        except Exception:
            items, source = list_ckpts(), "local"
        self._json(
            200,
            {
                "ok": True,
                "dir": str(CKPT_DIR) if CKPT_DIR else "",
                "source": source,
                "current": resolve_ckpt(None, items),
                "items": items,
                # ComfyUI 有 LoRA Manager：畫面上「用 LoRA Manager 管理」連到它的 checkpoint 頁。
                "manager": manager_url_for(self.headers.get("Host") or "", "/checkpoints") if _LM_CKPT["ok"] else "",
            },
        )

    def _serve_models(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        kind = ((qs.get("kind") or ["checkpoints"])[0] or "checkpoints").strip()
        try:
            names = models_from_comfy(kind)
            self._json(200, {"ok": True, "kind": kind, "items": names, "count": len(names)})
        except Exception as exc:
            self._json(502, {"ok": False, "kind": kind, "error": str(exc), "items": [], "count": 0})

    def _serve_comfy_config(self) -> None:
        env = os.environ.get("COMFY_API", "").strip()
        self._json(
            200,
            {
                "ok": True,
                "api": comfy_base(),
                "saved": workflows.saved_comfy_api(),
                "fromEnv": bool(env),
                "default": workflows.DEFAULT_COMFY_API,
            },
        )

    def _apply_comfy_config(self, payload: dict) -> None:
        try:
            saved = workflows.set_comfy_api((payload or {}).get("api"))
        except workflows.WorkflowError as exc:
            self._json(400, {"ok": False, "error": str(exc), "code": exc.code})
            return
        _PING["val"] = None
        _MODEL_CACHE["t"] = 0
        _MODEL_CACHE["data"] = {}
        lora_scan.reset_cache()
        env = os.environ.get("COMFY_API", "").strip()
        self._json(
            200,
            {
                "ok": True,
                "api": comfy_base(),
                "saved": saved,
                "fromEnv": bool(env),
                "note": "目前被環境變數 COMFY_API 鎖定，畫面存的值下次沒設環境變數才會生效。" if env else "",
            },
        )

    def _workflow_pid(self, path: str):
        prefix = "/api/workflows/"
        if not path.startswith(prefix):
            return None
        rest = path[len(prefix) :].strip("/")
        if not rest or "/" in rest or rest in {".", ".."}:
            return None
        return urllib.parse.unquote(rest)

    def _serve_workflow_get(self, path: str) -> None:
        if path == "/api/workflows":
            self._json(200, {"ok": True, "items": workflows.list_profiles()})
            return
        pid = self._workflow_pid(path)
        if not pid:
            self._json(404, {"ok": False, "error": "not found"})
            return
        prof = workflows.get_profile(pid)
        if prof is None:
            self._json(404, {"ok": False, "error": "找不到這個 workflow profile。", "code": "missing_profile"})
            return
        self._json(200, workflows.profile_view(prof))

    def _serve_workflow_save(self, payload: dict) -> None:
        name = str((payload or {}).get("name") or "").strip() or "Workflow"
        wf = (payload or {}).get("workflow")
        mapping = (payload or {}).get("mapping")
        try:
            prof = workflows.save_profile(name, wf, mapping)
        except workflows.WorkflowError as exc:
            self._json(400, {"ok": False, "error": str(exc), "code": exc.code})
            return
        loaded = workflows.get_profile(prof["id"])
        self._json(200, workflows.profile_view(loaded or prof))

    def _serve_workflow_put(self, pid: str, payload: dict) -> None:
        try:
            if "mapping" in (payload or {}):
                workflows.update_mapping(pid, payload.get("mapping"))
            if payload.get("name"):
                prof = workflows.get_profile(pid)
                if prof is None:
                    raise workflows.WorkflowError("找不到這個 workflow profile。", "missing_profile")
                workflows.save_profile(str(payload.get("name")), prof["workflow"], payload.get("mapping") or prof["mapping"], pid=pid)
            loaded = workflows.get_profile(pid)
            if loaded is None:
                raise workflows.WorkflowError("找不到這個 workflow profile。", "missing_profile")
        except workflows.WorkflowError as exc:
            self._json(400, {"ok": False, "error": str(exc), "code": exc.code})
            return
        self._json(200, workflows.profile_view(loaded))

    def _recipe_pid(self, path: str):
        prefix = "/api/recipes/"
        if not path.startswith(prefix):
            return None
        rest = path[len(prefix) :].strip("/")
        if not rest or rest in {"export", "import"}:
            return None
        if rest.startswith("files/"):
            return None
        if "/image" in rest:
            return urllib.parse.unquote(rest.split("/image", 1)[0])
        if "/" in rest or rest in {".", ".."}:
            return None
        return urllib.parse.unquote(rest)

    def _recipe_missing(self, rec: dict) -> dict:
        miss = {"checkpoint": False, "loras": [], "workflow": False}
        ckpt = str(rec.get("checkpoint") or "").replace("/", "\\")
        names = set()
        try:
            items, _ = checkpoints_for_ui()
            for it in items:
                names.add(str(it.get("ckpt_name") or "").replace("/", "\\"))
                names.add(str(it.get("file") or ""))
        except Exception:
            names = set()
        if ckpt and names and ckpt not in names and ckpt.split("\\")[-1] not in names:
            miss["checkpoint"] = True
        have_lora = set()
        try:
            for it in lora_scan.list_loras().get("items") or []:
                have_lora.add(str(it.get("file") or it.get("name") or ""))
                have_lora.add(str(it.get("name") or ""))
        except Exception:
            have_lora = set()
        for lora in rec.get("loras") or []:
            fn = str(lora.get("file") or lora.get("name") or "")
            if fn and have_lora and fn not in have_lora and Path(fn).name not in have_lora:
                miss["loras"].append(fn)
        wid = str(rec.get("workflowId") or "")
        if wid:
            if workflows.get_profile(wid) is None:
                miss["workflow"] = True
        return miss

    def _serve_recipe_get(self, path: str) -> None:
        if path == "/api/recipes":
            self._json(200, {"ok": True, "items": recipes.list_recipes()})
            return
        if path == "/api/recipes/export":
            self._json(200, {"ok": True, "payload": recipes.export_payload()})
            return
        if path.startswith("/api/recipes/files/"):
            name = urllib.parse.unquote(path.split("/api/recipes/files/", 1)[-1])
            stored = recipes.resolve_stored_file(name)
            if stored is None:
                self._json(404, {"ok": False, "error": "not found", "code": "path"})
                return
            raw = stored.read_bytes()
            mime = mimetypes.guess_type(stored.name)[0] or "application/octet-stream"
            self._bytes(200, raw, mime)
            return
        pid = self._recipe_pid(path)
        if not pid:
            self._json(404, {"ok": False, "error": "not found"})
            return
        try:
            rec = recipes.get_recipe(pid)
        except recipes.RecipeError as exc:
            self._json(400, {"ok": False, "error": str(exc), "code": exc.code})
            return
        if rec is None:
            self._json(404, {"ok": False, "error": "找不到這個配方。", "code": "missing"})
            return
        self._json(200, {"ok": True, "recipe": rec, "missing": self._recipe_missing(rec), "reproduce": recipes.reproduce_payload(rec)})

    def _serve_recipe_write(self, path: str, payload: dict) -> None:
        try:
            if path == "/api/recipes/import":
                saved = recipes.import_payload(payload)
                self._json(200, {"ok": True, "items": saved})
                return
            if path == "/api/recipes":
                rec = recipes.save_recipe(payload)
                self._json(200, {"ok": True, "recipe": rec})
                return
            if path.endswith("/image"):
                pid = self._recipe_pid(path)
                if not pid:
                    self._json(404, {"ok": False, "error": "not found"})
                    return
                fn = str((payload or {}).get("filename") or "")
                q = comfy_view_query(fn, (payload or {}).get("subfolder"), (payload or {}).get("type") or "output")
                if not q:
                    self._json(400, {"ok": False, "error": "圖片路徑不合法。", "code": "path"})
                    return
                raw = api("GET", f"/view?{q}", timeout=60)
                if not isinstance(raw, (bytes, bytearray)):
                    self._json(502, {"ok": False, "error": "not an image"})
                    return
                ext = Path(fn).suffix.lower() or ".png"
                rec = recipes.save_image_bytes(pid, bytes(raw), suffix=ext)
                # 順便請 ComfyUI 轉一張 webp 當縮圖（作品冊的牆用）；轉不出來就算了，牆上用原圖。
                try:
                    thumb = api("GET", f"/view?{q}&preview=" + urllib.parse.quote("webp;82"), timeout=60)
                    if isinstance(thumb, (bytes, bytearray)) and bytes(thumb[:4]) == b"RIFF":
                        rec = recipes.save_thumbnail(pid, bytes(thumb))
                except Exception:
                    pass
                self._json(200, {"ok": True, "recipe": rec})
                return
            pid = self._recipe_pid(path)
            if not pid:
                self._json(404, {"ok": False, "error": "not found"})
                return
            rec = recipes.save_recipe(payload, rid=pid)
            self._json(200, {"ok": True, "recipe": rec})
        except recipes.RecipeError as exc:
            self._json(400, {"ok": False, "error": str(exc), "code": exc.code})
        except Exception as exc:
            self._json(502, {"ok": False, "error": str(exc)})

    def _serve_recipe_delete(self, path: str) -> None:
        pid = self._recipe_pid(path)
        if not pid:
            self._json(404, {"ok": False, "error": "not found"})
            return
        try:
            rec = recipes.delete_recipe(pid)
        except recipes.RecipeError as exc:
            self._json(400, {"ok": False, "error": str(exc), "code": exc.code})
            return
        if rec is None:
            self._json(404, {"ok": False, "error": "找不到這個配方。", "code": "missing"})
            return
        self._json(200, {"ok": True, "recipe": rec})

    def _serve_ckpt_preview(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        fn = ((qs.get("file") or [""])[0] or "")
        p = ckpt_preview_path(fn)
        if p is None:
            self._json(404, {"ok": False, "error": "not found"})
            return
        low = p.name.lower()
        if low.endswith(".webp"):
            mime = "image/webp"
        elif low.endswith(".png"):
            mime = "image/png"
        elif low.endswith(".jpg") or low.endswith(".jpeg"):
            mime = "image/jpeg"
        else:
            mime = "application/octet-stream"
        try:
            raw = p.read_bytes()
        except OSError as exc:
            self._json(502, {"ok": False, "error": str(exc)})
            return
        self._bytes(200, raw, mime, {"Cache-Control": "private, max-age=86400"})

    def _serve_lora_preview(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

        def one(key: str, default: str = "") -> str:
            vals = qs.get(key) or [default]
            return vals[0] if vals else default

        if one("lm"):
            self._serve_lm_preview(one("lm"))
            return
        p = lora_scan.preview_path(one("folder"), one("file"))
        if p is None:
            self._json(404, {"ok": False, "error": "not found"})
            return
        fn = p.name.lower()
        if fn.endswith(".mp4"):
            mime = "video/mp4"
        elif fn.endswith(".webm"):
            mime = "video/webm"
        elif fn.endswith(".webp"):
            mime = "image/webp"
        elif fn.endswith(".png"):
            mime = "image/png"
        elif fn.endswith(".jpg") or fn.endswith(".jpeg"):
            mime = "image/jpeg"
        else:
            mime = "application/octet-stream"
        try:
            raw = p.read_bytes()
        except OSError as exc:
            self._json(502, {"ok": False, "error": str(exc)})
            return
        extra = {"Cache-Control": "private, max-age=86400"}
        if lora_scan.is_video_preview(p.name):
            extra["Accept-Ranges"] = "bytes"
        self._bytes(200, raw, mime, extra)

    def _serve_lm_preview(self, src: str) -> None:
        """轉送 ComfyUI LoRA Manager 的預覽圖（LoRA、checkpoint 都是）。

        瀏覽器不一定連得到 ComfyUI（手機走 Tailscale、ComfyUI 只聽 127.0.0.1），所以由這裡去拿。
        只轉 /api/lm/previews?…，不能拿來打 ComfyUI 的其他網址。"""
        if not src.startswith(lora_scan.LM_PREVIEW_PREFIX) or any(c in src for c in "\r\n#") or "://" in src:
            self._json(404, {"ok": False, "error": "not found"})
            return
        try:
            req = urllib.request.Request(comfy_base() + src, method="GET")
            with urllib.request.urlopen(req, timeout=20) as r:
                raw = r.read()
                mime = (r.headers.get("Content-Type") or "").split(";")[0].strip()
        except urllib.error.HTTPError as exc:
            self._json(404 if exc.code == 404 else 502, {"ok": False, "error": f"LoRA Manager {exc.code}"})
            return
        except (OSError, urllib.error.URLError) as exc:
            self._json(502, {"ok": False, "error": str(exc)})
            return
        if not mime.startswith(("image/", "video/")):
            self._json(502, {"ok": False, "error": "not a preview"})
            return
        extra = {"Cache-Control": "private, max-age=86400"}
        if mime.startswith("video/"):
            extra["Accept-Ranges"] = "bytes"
        self._bytes(200, raw, mime, extra)

    def _serve_lora_push_get(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        try:
            since = int((qs.get("since") or ["0"])[0] or 0)
        except ValueError:
            since = 0
        # wait=N：沒有新的推送就在這裡最多等 N 秒（上限 25）。網頁原本每 2.5 秒問一次，
        # 走 Tailscale 時每一次都是一趟來回；改成長輪詢之後約 25 秒一次，推送反而更快到。
        try:
            wait = max(0.0, min(LORA_PUSH_MAX_WAIT, float((qs.get("wait") or ["0"])[0] or 0)))
        except ValueError:
            wait = 0.0
        with _LORA_PUSH_COND:
            if wait > 0:
                _LORA_PUSH_COND.wait_for(lambda: _LORA_PUSH["ver"] > since, timeout=wait)
            ver, data = _LORA_PUSH["ver"], _LORA_PUSH["data"]
        out = {"ver": ver, "epoch": _LORA_PUSH_EPOCH}
        if ver > since:
            out["data"] = data
        self._json(200, out, _LORA_CORS)

    def _serve_lora_push_post(self, payload: dict) -> None:
        folder = str(payload.get("folder") or "").strip()
        name = str(payload.get("name") or "").strip()
        if not name:
            self._json(400, {"error": "缺少 name"}, _LORA_CORS)
            return
        with _LORA_PUSH_COND:
            _LORA_PUSH["ver"] += 1
            _LORA_PUSH["data"] = {"folder": folder, "name": name}
            ver = _LORA_PUSH["ver"]
            _LORA_PUSH_COND.notify_all()
        print(f"[lora-push] {folder}/{name} (ver={ver})", flush=True)
        self._json(200, {"ok": True, "ver": ver}, _LORA_CORS)

    def _allowed(self) -> bool:
        if allowed_client(self.client_address[0]):
            return True
        self.close_connection = True
        self._json(403, {"ok": False, "error": "forbidden"})
        return False

    def _mutation_allowed(self, path: str, require_json: bool = True) -> bool:
        # LoRA manager runs on another local port and intentionally uses CORS.
        if path == "/api/lora-push":
            return True
        error = mutation_request_error(
            self.headers.get("Origin") or "",
            self.headers.get("Host") or "",
            self.headers.get("Content-Type") or "",
            require_json,
        )
        if error is None:
            return True
        code, message = error
        self.close_connection = True
        self._json(code, {"ok": False, "error": message, "code": "forbidden" if code == 403 else "content_type"})
        return False

    def _sse_job(self, job: GenJob, since: int = 0) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("X-Gen-Job", job.id)
        self.end_headers()
        with job.cond:
            job.watchers += 1
            # 接回來的網頁說它已經收過幾則：只補後面的（重新整理後接回來的給 0，整段重播）。
            sent = max(0, min(int(since), len(job.log)))
        seen_pv = 0
        try:
            while True:
                with job.cond:
                    while (
                        sent >= len(job.log)
                        and not (job.preview and job.preview[0] > seen_pv)
                        and not job.finished
                    ):
                        if not job.cond.wait(timeout=10):
                            break
                    batch = job.log[sent:]
                    sent = len(job.log)
                    pv = job.preview if job.preview and job.preview[0] > seen_pv else None
                    fin = job.finished
                out = b""
                if pv and not fin:
                    seen_pv = pv[0]
                    out += sse("preview", pv[1])
                for event, data in batch:
                    out += sse(event, data)
                # 十秒沒有新東西也寫一行註解：斷掉的連線才會在這裡被發現，不會一直占著。
                self.wfile.write(out or b": keepalive\n\n")
                self.wfile.flush()
                if fin:
                    break
        except OSError:
            pass  # 斷線：工作留著，等網頁接回來（或 GEN_REATTACH_SEC 後自己停）
        finally:
            with job.cond:
                job.watchers -= 1
                if job.watchers <= 0:
                    job.watchers = 0
                    job.left_at = time.time()

    def _sse(self, events) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        gone = False
        # 記下這條串流正在等哪一張。不記的話下面只能送「全域中斷」，那會砍掉
        # Comfy 當下正在跑的任何東西 —— 包含這張早就結束、而使用者已經開始的
        # 下一張。A 卡跑得慢、事件之間空窗大，特別容易踩到。
        prompt_id = None
        try:
            for event, data in events:
                if isinstance(data, dict) and data.get("prompt_id"):
                    prompt_id = data["prompt_id"]
                try:
                    self.wfile.write(sse(event, data))
                    self.wfile.flush()
                except OSError:
                    # 客戶端斷線。Windows 丟的是 ConnectionAbortedError(WinError 10053)，
                    # 它和 BrokenPipeError／ConnectionResetError 是兄弟不是子類 —— 舊寫法
                    # 接不到，於是 /interrupt 不會送，Comfy 繼續把沒人要的圖算完，
                    # 佇列一路積起來，後面每一張都卡在「排隊中」。
                    gone = True
                    break
                if event in ("done", "error"):
                    break
        finally:
            # 明確關掉產生器，讓 gen_via_ws 的 finally 立刻把 websocket 收掉，
            # 而不是等 GC 幫忙。
            try:
                events.close()
            except Exception:
                pass
        if gone:
            # 還在排隊的從佇列拿掉 —— /interrupt 只砍正在畫的那張，排隊中的會被 Comfy
            # 照樣畫完，沒人要的圖把後面每一張往後推（多台裝置一起抽的時候特別明顯）。
            if prompt_id:
                try:
                    api("POST", "/queue", {"delete": [prompt_id]}, timeout=8)
                except Exception:
                    pass
            try:
                comfy_interrupt(prompt_id)
            except Exception:
                pass

    def _serve_comfy_image(self) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

        def one(key: str, default: str = "") -> str:
            vals = qs.get(key) or [default]
            return vals[0] if vals else default

        q = comfy_view_query(one("filename"), one("subfolder"), one("type") or "output")
        want = one("h").lower()
        if not q or (want and not valid_image_hash(want)):
            self._json(400, {"ok": False, "error": "bad image query"})
            return
        try:
            raw, digest = comfy_image(q, require_body=not self.headers.get("If-None-Match") and one("fmt") != "webp")
        except Exception as exc:
            self._json(image_error_code(exc), {"ok": False, "error": str(exc)})
            return
        # 快取要用內容當鑰匙，不能用檔名。
        #
        # 以前這裡是 `max-age=86400`，而網址只有 filename/subfolder/type。ComfyUI 的
        # SaveImage 是看輸出資料夾現有的檔案來編號（prefix_00001_.png），所以只要那個
        # 資料夾被清空、或換了一台機器重裝，編號就從頭開始、檔名跟著重複 —— 瀏覽器
        # 於是拿 24 小時前的舊圖來顯示，畫面上看到的是「之前生成過的圖」。
        #
        # 所以 ETag 一律是內容雜湊；整年快取只給網址上帶著內容指紋（h=）、而且對得上的，
        # 規則在 image_cache_policy()。
        status, cache = image_cache_policy(want, digest)
        if status != 200:
            self._json(status, {"ok": False, "error": "這張圖在 ComfyUI 的輸出資料夾裡已經不在了（檔名被別張圖用掉）"})
            return
        # fmt=webp：晾紙繩、試印、成品預覽用的小檔（約原圖的 1/12）。「開原圖」不帶，拿原本的 PNG。
        webp = comfy_webp(q, digest) if one("fmt") == "webp" else None
        etag = '"' + digest + ("-webp" if webp else "") + '"'
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", cache)
            self.end_headers()
            return
        if not webp and raw is None:
            # 瀏覽器沒有這份 body（或 webp 失敗），仍須拿原檔；第二次讀取也要重驗身分。
            try:
                raw, digest = comfy_image(q, require_body=True)
            except Exception as exc:
                self._json(image_error_code(exc), {"ok": False, "error": str(exc)})
                return
            status, cache = image_cache_policy(want, digest)
            if status != 200:
                self._json(status, {"ok": False, "error": "這張圖在 ComfyUI 的輸出資料夾裡已經不在了（檔名被別張圖用掉）"})
                return
            etag = '"' + digest + '"'
            if self.headers.get("If-None-Match") == etag:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.send_header("Cache-Control", cache)
                self.end_headers()
                return
        body = webp or raw
        mime = "image/png"
        if body[:3] == b"\xff\xd8\xff":
            mime = "image/jpeg"
        elif body[:4] == b"RIFF":
            mime = "image/webp"
        safe = one("filename").replace('"', "")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("ETag", etag)
        self.send_header("Content-Disposition", f'inline; filename="{safe}"')
        self.end_headers()
        try:
            self.wfile.write(body)
        except OSError:
            self.close_connection = True

    def _static_dest(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", ""):
            path = "/index.html"
        return static_path(urllib.parse.unquote(path).lstrip("/"))

    def _cached_file(self, dest: Path) -> dict:
        st = dest.stat()
        key = str(dest)
        hit = _STATIC.get(key)
        if hit and hit["mtime"] == st.st_mtime_ns and hit["size"] == st.st_size:
            return hit
        raw = dest.read_bytes()
        if dest.name == "manifest.json" and dest.parent.name == "cards":
            raw = slim_card_manifest(raw)
        mime = mimetypes.guess_type(dest.name)[0] or "application/octet-stream"
        base = mime.split(";")[0]
        gz = None
        if base in _GZIP_TYPES and len(raw) > 1024:
            packed = gzip.compress(raw, 5)
            if len(packed) < len(raw):
                gz = packed
        rec = {
            "mtime": st.st_mtime_ns,
            "size": st.st_size,
            "raw": raw,
            "gz": gz,
            "mime": mime,
        }
        _STATIC[key] = rec
        return rec

    def _asset_version(self, rel: str) -> str | None:
        """網站上某個檔（相對路徑）的內容指紋：sha1 前 10 字。找不到就 None。"""
        dest = static_path(rel)
        if dest is None:
            return None
        rec = self._cached_file(dest)
        if "v" not in rec:
            rec["v"] = hashlib.sha1(rec["raw"]).hexdigest()[:10]
        return rec["v"]

    def _html_record(self, dest: Path, rec: dict) -> dict:
        """HTML 送出去之前換上帶版本的網址和 import map（見 versioned_html）。結果照內容快取。"""
        try:
            text = rec["raw"].decode("utf-8")
        except UnicodeDecodeError:
            return rec
        out = versioned_html(text, self._asset_version, own_js_files()).encode("utf-8")
        digest = hashlib.sha1(out).hexdigest()[:16]
        hit = _HTML_OUT.get(str(dest))
        if hit and hit["digest"] == digest:
            return hit
        gz = gzip.compress(out, 5) if len(out) > 1024 else None
        new = {
            "raw": out,
            "gz": gz if gz is not None and len(gz) < len(out) else None,
            "mime": rec["mime"],
            "size": len(out),
            "etag": f'"h{digest}"',
            "digest": digest,
        }
        _HTML_OUT[str(dest)] = new
        return new

    def _serve_static(self, body: bool) -> None:
        dest = self._static_dest()
        if dest is None:
            self._json(404, {"ok": False, "error": "not found"})
            return
        rec = self._cached_file(dest)
        if dest.suffix.lower() == ".html":
            rec = self._html_record(dest, rec)
        mime = rec["mime"]
        if mime.split(";")[0] in _GZIP_TYPES:
            mime = f"{mime}; charset=utf-8"
        etag = rec.get("etag") or f'"{rec["mtime"]:x}-{rec["size"]:x}"'
        # 網址帶 ?v=（內容雜湊，卡面 manifest 給的）就是「這個版本永遠不會變」：
        # 內容一換網址就換，所以可以放心整年快取，不必每次回來驗證。
        # 字盒一捲就是幾百張縮圖，手機走 Tailscale 時每張一個 304 來回很有感。
        # 沒帶版本的照舊 no-cache（每次回來問，內容一樣才回 304）。
        # 自己的 .js／.css／.json 的版本是這裡算的，要對得上現在的內容才給整年快取：改檔的那一瞬間
        # 拿著舊版本號來要的，拿到的是新內容 —— 不能讓新內容被記成舊版本號（之後改回去就會拿錯）。
        # 卡面縮圖的 v 是原圖的雜湊（不是縮圖自己的），所以只驗 .js／.css／.json。
        vq = (urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("v") or [""])[0]
        if vq and dest.suffix.lower() in (".js", ".css", ".json"):
            if "v" not in rec:
                rec["v"] = hashlib.sha1(rec["raw"]).hexdigest()[:10]
            versioned = vq == rec["v"]
        else:
            versioned = bool(vq)
        cache = "public, max-age=31536000, immutable" if versioned else "no-cache"
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", cache)
            self.end_headers()
            return
        use_gz = (
            body
            and rec["gz"] is not None
            and "gzip" in (self.headers.get("Accept-Encoding") or "")
        )
        data = rec["gz"] if use_gz else rec["raw"]
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data) if body else len(rec["raw"])))
        self.send_header("ETag", etag)
        self.send_header("Cache-Control", cache)
        self.send_header("Vary", "Accept-Encoding")
        if use_gz:
            self.send_header("Content-Encoding", "gzip")
        self.end_headers()
        if body:
            self.wfile.write(data)

    def do_HEAD(self) -> None:
        if not self._allowed():
            return
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/ping":
            self._json(200, ping())
            return
        self._serve_static(False)

    def do_GET(self) -> None:
        if not self._allowed():
            return
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/ping":
            self._json(200, ping())
            return
        # 卡冊：每張牌用過幾次（所有裝置共用一份，見 card_usage.py）。
        if path == "/api/usage":
            self._json(200, {"ok": True, **card_usage.load()})
            return
        # 牌組：取名存起來的一組牌（所有裝置共用一份，見 card_decks.py）。
        if path == "/api/decks":
            self._json(200, {"ok": True, "decks": card_decks.load()})
            return
        # 出圖日誌（作品冊的「日誌」）：新的在前，before＝從這個時間（毫秒）之前接著翻。
        # 牌的戰績（卡冊）、模型成績單（作品冊）：從日誌和作品冊算。
        # 卡冊「用它做過的圖」：日誌裡用到這張牌的每一張。
        if path == "/api/genlog/bytag":
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                limit = int((qs.get("limit") or ["48"])[0])
                offset = int((qs.get("offset") or ["0"])[0])
            except ValueError:
                self._json(400, {"ok": False, "error": "limit、offset 要是數字"})
                return
            self._json(200, {"ok": True, **gen_log.by_tag((qs.get("tag") or [""])[0], favorite_index(), limit, offset)})
            return
        if path == "/api/genlog/stats":
            self._json(200, {"ok": True, **genlog_stats()})
            return
        if path == "/api/genlog":
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            try:
                limit = int((qs.get("limit") or ["200"])[0])
                before = int((qs.get("before") or ["0"])[0]) or None
            except ValueError:
                self._json(400, {"ok": False, "error": "limit、before 要是數字"})
                return
            self._json(200, {"ok": True, **gen_log.page(limit, before)})
            return
        if path == "/api/gen/active":
            self._json(200, {"ok": True, "jobs": active_jobs(keep=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("keep") == ["1"])})
            return
        if path == "/api/gen/attach":
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            job = find_job((qs.get("job") or [""])[0])
            if job is None:
                self._json(404, {"ok": False, "error": "找不到這張（伺服器重開過，或已經結束太久）"})
                return
            try:
                since = int((qs.get("since") or ["0"])[0])
            except ValueError:
                since = 0
            self._sse_job(job, since)
            return
        if path == "/api/image":
            self._serve_comfy_image()
            return
        if path == "/api/loras":
            self._serve_loras()
            return
        if path == "/api/setup":
            self._json(200, {"ok": True, **setup_tasks.snapshot()}, cache_control="no-store")
            return
        if path == "/api/paths":
            self._json(200, paths_status(self.client_address[0]), cache_control="no-store")
            return
        if path == "/api/checkpoints":
            self._serve_checkpoints()
            return
        if path == "/api/sampling":
            self._json(200, sampling_defaults())
            return
        if path == "/api/models":
            self._serve_models()
            return
        if path == "/api/comfy":
            self._serve_comfy_config()
            return
        if path == "/api/workflows" or path.startswith("/api/workflows/"):
            self._serve_workflow_get(path)
            return
        if path == "/api/ckpt-preview":
            self._serve_ckpt_preview()
            return
        if path == "/api/lora-preview":
            self._serve_lora_preview()
            return
        if path == "/api/lora-push":
            self._serve_lora_push_get()
            return
        if path == "/api/telegram/config":
            self._json(200, tg_status())
            return
        if path == "/api/discord/config":
            self._json(200, dc_status())
            return
        if path == "/api/recipes" or path.startswith("/api/recipes/"):
            self._serve_recipe_get(path)
            return
        self._serve_static(True)

    def do_POST(self) -> None:
        if not self._allowed():
            return
        path = urllib.parse.urlparse(self.path).path
        if not self._mutation_allowed(path):
            return
        # 負數長度會讓 rfile.read(-1) 一直等到對方關連線，佔住一條執行緒；非數字直接 400。
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if length < 0:
            self.close_connection = True
            self._json(400, {"ok": False, "error": "Content-Length 不對。", "code": "invalid"})
            return
        if length > workflows.MAX_WORKFLOW_BYTES:
            self._json(413, {"ok": False, "error": "JSON 太大（上限 5MB）", "code": "too_large"})
            return
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            payload = None
        # 每一個 POST 端點都把 payload 當物件用；[]、"x"、1 會在 .get() 那裡炸掉連線。
        if not isinstance(payload, dict):
            self._json(400, {"ok": False, "error": "不是有效的 JSON。", "code": "invalid"})
            return
        if path == "/api/comfy":
            self._apply_comfy_config(payload)
            return
        if path == "/api/usage":
            try:
                self._json(200, {"ok": True, **card_usage.add(payload)})
            except card_usage.UsageError as exc:
                self._json(400, {"ok": False, "error": str(exc), "code": "invalid"})
            return
        # 姿勢參考：參考圖傳進 Comfy、只跑骨架偵測給人看。
        if path in ("/api/pose/upload", "/api/pose/preview", "/api/pose/keypoints"):
            try:
                out = {"/api/pose/upload": pose_upload, "/api/pose/preview": pose_preview, "/api/pose/keypoints": pose_keypoints}[path](payload)
            except PoseError as exc:
                self._json(400, {"ok": False, "error": str(exc), "code": "invalid"})
                return
            except Exception as exc:
                self._json(502, {"ok": False, "error": f"ComfyUI 那邊出錯：{exc}"[:300]})
                return
            self._json(200, {"ok": True, **out})
            return
        # 出圖日誌的註記：成品牆單張拿掉（"discard"），按復原送 null 蓋掉。
        if path == "/api/genlog/mark":
            try:
                gen_log.mark(payload.get("id"), payload.get("mark"))
            except ValueError as exc:
                self._json(400, {"ok": False, "error": str(exc), "code": "invalid"})
                return
            self._json(200, {"ok": True})
            return
        if path == "/api/decks":
            try:
                self._json(200, {"ok": True, **card_decks.save(payload)})
            except card_decks.DeckError as exc:
                self._json(400, {"ok": False, "error": str(exc), "code": "invalid"})
            return
        if path == "/api/workflows":
            self._serve_workflow_save(payload)
            return
        pid = self._workflow_pid(path)
        if pid:
            self._serve_workflow_put(pid, payload)
            return
        if path == "/api/gen":
            if not ping().get("ok"):
                # 第一次用的人最常遇到：說清楚下一步（開 ComfyUI，或改位址）。
                self._json(503, {"ok": False, "error": f"ComfyUI 連不上 {comfy_base()}：先開 ComfyUI；位址不對就點頂欄的 Comfy 燈號改"})
                return
            accept = self.headers.get("Accept") or ""
            if "text/event-stream" in accept:
                if self.headers.get("X-Gen-Resume") == "1":
                    self._sse_job(GenJob(gen_events(payload), payload).start())
                else:
                    self._sse(gen_events(payload))
                return
            try:
                self._json(200, gen(payload))
            except HiresError as exc:
                self._json(400, {"ok": False, "error": str(exc)})
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if path == "/api/gen/cancel":
            job = find_job((payload or {}).get("job"))
            if job is None:
                self._json(404, {"ok": False, "error": "找不到這張（伺服器重開過，或已經結束太久）"})
                return
            job.cancel()
            self._json(200, {"ok": True})
            return
        if path == "/api/interrupt":
            try:
                comfy_interrupt((payload or {}).get("prompt_id"))
                self._json(200, {"ok": True})
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if path == "/api/paths":
            try:
                self._json(200, set_model_path(str(payload.get("kind") or ""), payload.get("path")))
            except ValueError as exc:
                self._json(400, {"ok": False, "error": str(exc)})
            return
        if path == "/api/paths/pick":
            # 只在這台電腦上開的網頁才跳資料夾視窗（手機上按，視窗會跳在電腦上，沒人看得到）。
            if self.client_address[0] not in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
                self._json(403, {"ok": False, "error": "只有在這台電腦上開的網頁能選資料夾；手機上請直接填路徑"})
                return
            kind = str(payload.get("kind") or "")
            title = "選 LoRA 資料夾" if kind == "lora" else "選底模資料夾"
            self._json(200, {"ok": True, "path": pick_folder(str(payload.get("initial") or ""), title)})
            return
        if path == "/api/setup":
            # 第一次使用的準備：回答詢問（姿勢參考、成人卡面）或請 ComfyUI-Manager 重開 ComfyUI。
            done, message = setup_tasks.answer(str(payload.get("id") or ""), str(payload.get("answer") or ""))
            self._json(200 if done else 409, {"ok": done, "error": message, **setup_tasks.snapshot()})
            return
        if path == "/api/lora-push":
            self._serve_lora_push_post(payload)
            return
        if path == "/api/telegram/config":
            self._json(200, tg_apply_config(payload))
            return
        if path == "/api/telegram":
            if payload.get("test"):
                # 測試是同步的：面板要當場看到 Telegram 回什麼。
                try:
                    tg_send_text("排字匣測試訊息。看得到這行就代表 token 和 chat id 都對了。")
                    self._json(200, {"ok": True})
                except Exception as exc:
                    self._json(200, {"ok": False, "error": tg_scrub(str(exc))})
                return
            self._json(200, tg_enqueue(payload))
            return
        if path == "/api/discord/config":
            self._json(200, dc_apply_config(payload))
            return
        if path == "/api/recipes" or path.startswith("/api/recipes/"):
            self._serve_recipe_write(path, payload)
            return
        if path == "/api/discord":
            if payload.get("test"):
                # 測試是同步的：面板要當場看到 Discord 回什麼。
                try:
                    dc_send_text(
                        "排字匣測試訊息。看得到這行就代表 bot token 和頻道 ID 都對了。"
                    )
                    self._json(200, {"ok": True})
                except Exception as exc:
                    self._json(200, {"ok": False, "error": dc_scrub(str(exc))})
                return
            self._json(200, dc_enqueue(payload))
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_PUT(self) -> None:
        self.do_POST()

    def do_DELETE(self) -> None:
        if not self._allowed():
            return
        path = urllib.parse.urlparse(self.path).path
        if not self._mutation_allowed(path, require_json=False):
            return
        if path.startswith("/api/recipes/"):
            self._serve_recipe_delete(path)
            return
        if path.startswith("/api/decks/"):
            try:
                self._json(200, {"ok": True, **card_decks.delete(urllib.parse.unquote(path[len("/api/decks/"):]))})
            except card_decks.DeckError as exc:
                self._json(404, {"ok": False, "error": str(exc), "code": "missing"})
            return
        pid = self._workflow_pid(path)
        if not pid:
            self._json(404, {"ok": False, "error": "not found"})
            return
        ok = workflows.delete_profile(pid)
        if not ok:
            self._json(404, {"ok": False, "error": "找不到這個 workflow profile。", "code": "missing_profile"})
            return
        self._json(200, {"ok": True})

    def do_OPTIONS(self) -> None:
        if not self._allowed():
            return
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/lora-push":
            self.send_response(204)
            for k, v in _LORA_CORS.items():
                self.send_header(k, v)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()


def list_ckpts(root: Path | None = None, prefix: str | None = None) -> list[dict]:
    """Scan the Illustrious checkpoint folder. Comfy ckpt_name is prefix\\file."""
    folder = Path(root) if root is not None else CKPT_DIR
    pre = CKPT_PREFIX if prefix is None else prefix
    items = []
    if folder is None or not folder.is_dir():
        return items
    try:
        names = list(folder.iterdir())
    except OSError:
        return items
    for p in sorted(names, key=lambda x: x.name.lower()):
        if not p.is_file() or p.suffix.lower() not in CKPT_EXTS:
            continue
        if p.name.startswith("."):
            continue
        stem = p.stem
        preview = ""
        for ext in CKPT_PREVIEW_EXTS:
            cand = folder / (stem + ext)
            if cand.is_file():
                preview = cand.name
                break
        items.append(
            {
                "file": p.name,
                "ckpt_name": f"{pre}\\{p.name}" if pre else p.name,
                "title": stem,
                "preview": preview,
            }
        )
    return items


def pick_default_ckpt(names: list) -> str | None:
    """沒指定底模時用哪個。清單是空的就回 None（交給呼叫端退回 CKPT）。

    CKPT 是作者自己機器上的檔名。別台電腦從 GitHub 拉下來，ComfyUI 裡多半沒有它：
    網頁第一次生圖沒選過底模，就會送這個不存在的名字，每張都被 ComfyUI 退件（HTTP 400）。
    所以預設的在清單裡才用它；不在就挑一個看起來是 Illustrious／動漫 SDXL 的，都不像就第一個。
    """
    names = [str(n).replace("/", "\\") for n in names if n]
    if not names:
        return None
    default = str(CKPT).replace("/", "\\")
    for n in names:
        if n == default or n.split("\\")[-1] == default.split("\\")[-1]:
            return n
    anime = [n for n in names if re.search(r"illustrious|illu|noob|animagine|pony|anime", n, re.I)]
    xl = [n for n in names if re.search(r"xl", n, re.I)]
    return (anime or xl or names)[0]


def resolve_ckpt(name: str | None, items: list | None = None) -> str:
    """Allow names from the provided list (local folder or Comfy object_info).

    空清單代表「沒有白名單、但檔名仍要安全」——遠端 Comfy 的 extra_model_paths
    不會出現在本機 checkpointDir 裡，不能因此退回作者機器的預設檔名。
    """
    if items is None:
        try:
            items, _ = checkpoints_for_ui()
        except Exception:
            items = list_ckpts()
    pool = items
    allowed = {}
    for it in pool:
        key = str(it.get("ckpt_name") or "").replace("/", "\\")
        fn = str(it.get("file") or "")
        if key:
            allowed[key] = key
        if fn:
            allowed[fn] = key or fn
    # 沒指定（或指定的已經不在）時退回哪個：清單裡有預設的就是它，沒有就挑一個清單裡有的。
    fallback = pick_default_ckpt([it.get("ckpt_name") or it.get("file") for it in pool]) or str(CKPT).replace("/", "\\")
    if not name:
        return allowed.get(fallback, fallback)
    raw = str(name).replace("/", "\\").strip()
    parts = [p for p in raw.split("\\") if p]
    if not parts or any(p in (".", "..") for p in parts) or raw.startswith("\\"):
        return allowed.get(fallback, fallback)
    if raw in allowed:
        return allowed[raw]
    if parts[-1] in allowed:
        return allowed[parts[-1]]
    if not allowed:
        return raw
    return allowed.get(fallback, fallback)


def ckpt_preview_path(fn: str, root: Path | None = None) -> Path | None:
    if not fn or "/" in fn or "\\" in fn or fn in (".", "..") or ".." in fn:
        return None
    if root is None:
        # 偏好路徑底下（含子資料夾）的預覽圖：只認那些底模旁邊的同名預覽。
        for model in pref_ckpt_files().values():
            if model.with_name(fn).is_file() and model.with_name(fn).name.startswith(model.stem):
                return model.with_name(fn)
    base = Path(root) if root is not None else CKPT_DIR
    if base is None:
        return None
    folder = base.resolve()
    p = (folder / fn).resolve()
    try:
        p.relative_to(folder)
    except ValueError:
        return None
    if not p.is_file():
        return None
    return p


def checkpoints() -> list[str]:
    info = api("GET", "/object_info/CheckpointLoaderSimple", timeout=15)
    return workflows.combo_list(info, "CheckpointLoaderSimple", "ckpt_name")


def check_ckpt() -> None:
    """A fresh clone will not have the author's checkpoint. Say so before the first gen fails."""
    try:
        have = checkpoints()
    except Exception:
        return
    if not have:
        print(f"ckpt     {CKPT}（ComfyUI 沒有回報任何底模）")
        return
    if CKPT in have:
        print(f"ckpt     {CKPT}")
        return
    # 預設的底模（comfy.ckpt）這台的 ComfyUI 沒有：不是錯，生圖時會自動挑一個（pick_default_ckpt）。
    print(f"ckpt     {pick_default_ckpt(have)}（ComfyUI 沒有預設的 {CKPT}，先用這個；網頁頂欄的模型按鈕可以換，"
          "要固定就設 config.json 的 comfy.ckpt）")


class AppServer(ThreadingHTTPServer):
    # Windows 的 SO_REUSEADDR 讓第二份伺服器也綁得上同一個埠，而且不報錯：啟動檔點兩次，
    # 兩份就搶同一個埠的請求，生圖佇列各記各的（進度、接回都會莫名其妙不見）。改成獨佔。
    allow_reuse_address = os.name != "nt"

    def server_bind(self) -> None:
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main() -> None:
    host = str(cfg("server.host", "HOST", "127.0.0.1"))
    port = int(cfg("server.port", "PORT", 8796))
    tg_load()
    dc_load()
    try:
        httpd = AppServer((host, port), Handler)
    except OSError as err:
        print(f"port     {port} 已經有程式在用（{err.strerror or err}）")
        print(f"         如果是這個伺服器已經開著：直接開 http://127.0.0.1:{port}/ 就好。")
        print("         要同時開第二份：先設 PORT=別的埠 再啟動。")
        print(f"         Port {port} is already in use. If the server is already running, open http://127.0.0.1:{port}/.")
        raise SystemExit(1) from None
    print(f"排字匣  http://{host}:{port}   畫面 {WEB.name}   Comfy {comfy_base()}")
    print("allow    " + ",".join(str(n) for n in ALLOW_NETS))
    print(f"設定檔  {CONFIG_PATH}" + ("" if CONFIG else "（沒有，全部用預設值）"))
    # 第一次 clone 下來最常見的兩個「怎麼是空的」就是這兩項沒設定。
    # 與其讓使用者從空清單反推，開機就講清楚。
    if lora_scan.preferred_path():
        print(f"loras    偏好路徑 {lora_scan.preferred_path()}（在 LoRA 面板的「偏好路徑」改）")
    if ckpt_pref():
        print(f"ckpts    偏好路徑 {ckpt_pref()}（在底模面板的「偏好路徑」改）")
    lm_total = lora_scan.lora_manager_count()
    if lm_total is not None:
        print(f"loras    ComfyUI 的 LoRA Manager：{lm_total} 個，預覽圖和觸發詞從它來（{lora_scan.lm_manager_url()}）")
    elif not lora_scan.LORA_ROOT:
        print("loras    （ComfyUI 沒有 LoRA Manager、也沒設定 paths.loraRoot：LoRA 清單改問 Comfy，沒有預覽圖和觸發詞。"
              "墨池準備面板可選擇安裝 LoRA Manager，裝完重開 ComfyUI）")
    elif not lora_scan.LORA_ROOT.is_dir():
        print(
            f"loras    {lora_scan.LORA_ROOT}（路徑不存在，LoRA 面板會是空的）\n"
            "         請把 config.json 的 paths.loraRoot 改成這台電腦的 ComfyUI\\models\\loras"
        )
    else:
        print(f"loras    {lora_scan.LORA_ROOT}")
        if lora_scan.LORA_FOLDERS:
            missing = [f for f in lora_scan.LORA_FOLDERS if not (lora_scan.LORA_ROOT / f).is_dir()]
            print(f"         只掃 paths.loraFolders：{', '.join(lora_scan.LORA_FOLDERS)}（改成 [] 就掃全部子資料夾）")
            if missing:
                print(f"         這幾個資料夾不存在：{', '.join(missing)}")
    if not _ckpt_dir:
        print("ckptdir  （未設定 config.json 的 comfy.checkpointDir，換底模清單改問 Comfy）")
    elif CKPT_DIR is not None and CKPT_DIR.is_dir():
        print(f"ckptdir  {CKPT_DIR}")
        if CKPT_DIR != _ckpt_dir_given:
            print(f"         （comfy.checkpointDir 指到整個 checkpoints，自動接上 checkpointPrefix 子資料夾 {CKPT_PREFIX}）")
    else:
        print(f"ckptdir  {_ckpt_dir}（路徑不存在，換底模清單改問 Comfy）")
    st = tg_status()
    if st["configured"]:
        print(f"telegram {st['chatId']}  token {st['tokenTail']}  自動送 {'開' if st['enabled'] else '關'}")
    ds = dc_status()
    if ds["configured"]:
        where = (
            f"webhook {ds['webhookTail']}"
            if ds["mode"] == "webhook"
            else f"{ds['channelId']}  token {ds['tokenTail']}"
        )
        print(f"discord  {where}  自動送 {'開' if ds['enabled'] else '關'}")
    check_ckpt()
    if (WEB / "setup-panel.js").is_file():
        # 這個版面在網頁上顯示準備進度（web6/setup-panel.js）：卡面、LoRA Manager、放大模型、
        # 姿勢參考、烘焙都由 setup_tasks 在背景做，ComfyUI 什麼時候開都接得上。
        setup_tasks.start(comfy_base, on_lora_ready=lora_scan.reset_cache)
        print("setup    第一次使用的準備在背景做，進度和要回答的事在網頁上（data/setup.log 有紀錄）")
    else:
        start_card_fetch()
    removed = prune_hires_inputs()
    if removed:
        print(f"hires    清掉 {len(removed)} 張舊的上傳原圖，input/danbooru_hires 留下最近 {HIRES_INPUT_KEEP} 張")
    httpd.serve_forever()


def start_card_fetch() -> None:
    """卡面插畫不在（git clone 下來的第一次）：背景把全年齡那一包抓下來（scripts/fetch_card_art.py）。

    Windows 的啟動檔會自己另開一個視窗抓，並設 CARD_FETCH_STARTED，這裡就不重複抓；
    直接 `python server.py` 的（Mac、Linux）靠這裡。NO_CARD_FETCH=1 可以關掉。網頁照常先開，抓完重新整理就有圖。"""
    if os.environ.get("NO_CARD_FETCH") or os.environ.get("CARD_FETCH_STARTED"):
        return
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        import fetch_card_art  # noqa: PLC0415 —— 只有真的要抓時才載
    except ImportError:
        return
    if fetch_card_art.have_enough():
        return
    print("cards    插畫還沒有：背景從 GitHub 下載全年齡那一包（約 100MB），好了重新整理網頁就有圖")

    def run() -> None:
        try:
            fetch_card_art.main()
        except Exception as err:  # noqa: BLE001 —— 抓不到就維持佔位牌，不影響伺服器
            print(f"cards    下載失敗：{err}")

    threading.Thread(target=run, name="card-art-fetch", daemon=True).start()


if __name__ == "__main__":
    main()
