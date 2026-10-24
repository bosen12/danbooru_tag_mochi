"""解析池：一張圖丟進 ComfyUI 的 WD14 Tagger（ComfyUI-WD14-Tagger，pysssss），讀回 Danbooru 字。

Tagger 只回「超過門檻的字」，不回分數；而且照模型標籤表的順序排，不是照信心。所以同一張圖跑兩個門檻：
  - 使用者設的最低信心（預設 0.35）：全部的字。
  - 確定門檻（0.7）：這一層也有的標「確定」，其他的是「可能」。
多跑一層約多 2 秒（每個節點都要重新載入模型）；兩層就夠網頁上「只要確定的／全部」即時切換，不必重跑。

這裡只管：設定的清理、組工作流、讀結果、清掉自己的上傳檔。跟 ComfyUI 講話的函式由 server.py 傳進來（測試換成假的）。
"""
from __future__ import annotations

import base64
import hashlib
import re
from pathlib import Path

TAGGER = "WD14Tagger|pysssss"
SUBFOLDER = "danbooru_parse"
NAME_RE = re.compile(r"^parse_[0-9a-f]{16}\.(png|jpg|webp)$")
# 伺服器收 JSON 的上限是 5MB，base64 會膨脹三分之一。網頁送之前會縮到長邊 1024（Tagger 本來就縮成 448 才看）。
MAX_BYTES = 3 * 1024 * 1024
KEEP = 30
SURE = 0.7
# 使用者給的那一份（ComfyUI 節點的預設是 moat v2；專案主用的是 vit v3，比較新、認得的字多）。
DEFAULTS = {"model": "wd-vit-tagger-v3", "threshold": 0.35, "characterThreshold": 0.85, "exclude": ""}
_MODEL_RE = re.compile(r"^[\w.\-]{1,96}$")


class ParseError(ValueError):
    """使用者那邊的問題（圖不對、設定不對、沒裝 Tagger）：回 400，字直接給人看。"""

    def __init__(self, message: str, code: str = "invalid"):
        super().__init__(message)
        self.code = code


def _num(v, lo: float, hi: float, default: float) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    if x != x:  # NaN
        return default
    return round(min(hi, max(lo, x)), 2)


def clean_settings(raw) -> dict:
    """網頁送來的設定 → 可以放進工作流的值。認不得的就用預設，不報錯（設定是存在瀏覽器裡的，可能是舊版的）。"""
    raw = raw if isinstance(raw, dict) else {}
    model = str(raw.get("model") or "").strip()
    if model.endswith(".onnx"):
        model = model[:-5]
    exclude = ", ".join(s.strip() for s in str(raw.get("exclude") or "").replace("，", ",").replace("\n", ",").split(",") if s.strip())
    return {
        "model": model if _MODEL_RE.match(model) else DEFAULTS["model"],
        "threshold": _num(raw.get("threshold"), 0.05, 0.95, DEFAULTS["threshold"]),
        "characterThreshold": _num(raw.get("characterThreshold"), 0.05, 1.0, DEFAULTS["characterThreshold"]),
        # Tagger 比對 exclude 時是把整段轉小寫、照逗號切：底線、空格兩種寫法都放進去，使用者寫哪種都擋得到。
        "exclude": exclude[:2000],
    }


def _exclude_for_node(text: str) -> str:
    out = []
    for s in text.split(","):
        s = s.strip().lower()
        if not s:
            continue
        for v in (s, s.replace(" ", "_"), s.replace("_", " ")):
            if v not in out:
                out.append(v)
    return ",".join(out)


def tiers(settings: dict) -> list[float]:
    """要跑的門檻，由低到高。最低信心本身就 ≥ 確定門檻時只跑一層（全部都算確定）。"""
    t = settings["threshold"]
    return [t] if t >= SURE else [t, SURE]


def build_workflow(image_name: str, settings: dict) -> dict:
    wf = {"1": {"class_type": "LoadImage", "inputs": {"image": image_name}}}
    for i, t in enumerate(tiers(settings)):
        wf[str(10 + i)] = {
            "class_type": TAGGER,
            "inputs": {
                "image": ["1", 0],
                "model": settings["model"],
                "threshold": t,
                "character_threshold": settings["characterThreshold"],
                "replace_underscore": False,
                "trailing_comma": False,
                "exclude_tags": _exclude_for_node(settings["exclude"]),
            },
        }
    return wf


def split_tags(text: str) -> list[str]:
    """Tagger 的輸出字串 → 字。它把括號跳脫成 \\( \\)，這裡還原；底線留著（網頁比對時兩種寫法都試）。"""
    out = []
    for s in str(text or "").split(", "):
        s = s.strip().strip(",").strip().replace("\\(", "(").replace("\\)", ")")
        if s and s not in out:
            out.append(s)
    return out


def read_outputs(entry: dict, settings: dict) -> list[dict]:
    """/history 那一筆 → [{"tag", "sure"}]，照最低那一層的順序（模型的標籤表順序：先角色、再一般字）。"""
    outs = (entry or {}).get("outputs") or {}
    layers = []
    for i, _ in enumerate(tiers(settings)):
        node = outs.get(str(10 + i)) or {}
        got = node.get("tags") or []
        layers.append(split_tags(got[0] if isinstance(got, list) and got else got if isinstance(got, str) else ""))
    if not layers or not any(layers):
        status = (entry or {}).get("status") or {}
        if status.get("status_str") == "error":
            raise ParseError(_error_text(status), "tagger_failed")
        return []
    sure = set(layers[-1])
    return [{"tag": t, "sure": t in sure} for t in layers[0]]


def _error_text(status: dict) -> str:
    for m in status.get("messages") or []:
        if isinstance(m, (list, tuple)) and len(m) > 1 and m[0] == "execution_error" and isinstance(m[1], dict):
            msg = str(m[1].get("exception_message") or "").strip()
            if msg:
                return f"Tagger 出錯：{msg[:200]}"
    return "Tagger 出錯（ComfyUI 的主控台有詳細原因）"


def decode_image(data_url: str) -> tuple[bytes, str]:
    """data:image/...;base64,... → (bytes, 副檔名)。"""
    m = re.match(r"^data:image/(png|jpeg|webp);base64,(.+)$", str(data_url or ""), re.S)
    if not m:
        raise ParseError("要一張 PNG、JPEG 或 WebP 的圖")
    try:
        data = base64.b64decode(m.group(2), validate=False)
    except (ValueError, TypeError):
        raise ParseError("圖片壞了")
    if not data:
        raise ParseError("圖片壞了")
    if len(data) > MAX_BYTES:
        raise ParseError("圖片太大（上限 3MB；網頁會先縮小，還是太大就換一張）")
    return data, {"png": "png", "jpeg": "jpg", "webp": "webp"}[m.group(1)]


def file_name(data: bytes, ext: str) -> str:
    return f"parse_{hashlib.sha1(data).hexdigest()[:16]}.{ext}"


def models_from(info: dict) -> list[str]:
    """/object_info/WD14Tagger|pysssss → 模型清單（沒裝 Tagger 是空的）。"""
    node = (info or {}).get(TAGGER) or {}
    spec = ((node.get("input") or {}).get("required") or {}).get("model")
    names = spec[0] if isinstance(spec, (list, tuple)) and spec and isinstance(spec[0], list) else []
    return [str(n) for n in names if isinstance(n, str)]


def parse(payload: dict, *, upload, queue, wait, forget, prune=None) -> dict:
    """{"image": dataURL, "settings": {...}} → {"tags": [{"tag", "sure"}], "settings", "tiers"}。

    upload(data, name, mime) → LoadImage 用的名字；queue(workflow) → prompt_id；wait(prompt_id) → /history 那一筆；
    forget(prompt_id)：刪掉這一筆歷史（解析不是作品，不留在 ComfyUI 的佇列紀錄裡）；prune(protect)：清掉舊的上傳檔。
    """
    payload = payload if isinstance(payload, dict) else {}
    data, ext = decode_image(payload.get("image"))
    settings = clean_settings(payload.get("settings"))
    name = file_name(data, ext)
    stored = upload(data, name, "image/jpeg" if ext == "jpg" else f"image/{ext}")
    pid = queue(build_workflow(stored, settings))
    try:
        entry = wait(pid)
    finally:
        try:
            forget(pid)
        except Exception:
            pass
    tags = read_outputs(entry, settings)
    if prune:
        try:
            prune({name})
        except OSError:
            pass
    return {"tags": tags, "settings": settings, "tiers": tiers(settings)}


def prune_inputs(folder: Path, keep: int = KEEP, protect: set[str] | None = None) -> list[str]:
    """input/danbooru_parse 只留最近 keep 張（同一張圖重丟會覆蓋同名檔，不會越積越多）。"""
    files = []
    for path in Path(folder).iterdir():
        if path.is_file() and NAME_RE.match(path.name):
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
