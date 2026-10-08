#!/usr/bin/env python3
"""Download RealESRGAN_x4plus_anime_6B.pth into ComfyUI's upscale_models when it is missing.

    python scripts/fetch_upscale_model.py            # download only if missing
    python scripts/fetch_upscale_model.py --check    # 0 present (or nowhere to put it), 3 missing

Startup bats call --check, then download in a minimized window so the page can open.
Set NO_UPSCALE_FETCH=1 to skip. Console text is ASCII: cmd is not UTF-8.
Standard library only.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = "RealESRGAN_x4plus_anime_6B.pth"
URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"
# Measured from that release file (17,938,799 bytes), not copied from a web page.
SHA256 = "f872d837d3c90ed2e05227bed711af5671a6fd1c9f7d7e91c911a61f155e99da"
SIZE = 17938799
UA = {"User-Agent": "danbooru-tag-random/upscale-model"}
NOWHERE = (
    "Set comfy.upscaleModelDir in config.json to your ComfyUI models/upscale_models folder. "
    "Not downloading."
)


def load_config() -> dict:
    path = Path(os.environ.get("APP_CONFIG") or (ROOT / "config.json"))
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return raw if isinstance(raw, dict) else {}


def comfy_base(config: dict | None = None) -> str:
    env = os.environ.get("COMFY_API", "").strip()
    if env:
        return env.rstrip("/")
    settings = Path(os.environ.get("APP_SETTINGS") or (ROOT / "data" / "settings.json"))
    try:
        saved = json.loads(settings.read_text(encoding="utf-8"))
        api = str((saved or {}).get("comfyApi") or "").strip()
    except (OSError, ValueError, AttributeError):
        api = ""
    if api:
        return api.rstrip("/")
    config = load_config() if config is None else config
    api = str(((config.get("comfy") or {}).get("api") or "")).strip()
    return (api or "http://127.0.0.1:8188").rstrip("/")


def derive_upscale_dir(checkpoint_dir: str | Path | None) -> Path | None:
    """Walk up from checkpointDir to the models directory, then models/upscale_models."""
    text = str(checkpoint_dir or "").strip()
    if not text:
        return None
    current = Path(text)
    for parent in [current, *current.parents]:
        if parent.name.lower() == "models":
            return parent / "upscale_models"
    return None


def extra_yaml_beside_models(checkpoint_dir: str | Path | None) -> Path | None:
    """ComfyUI root is the parent of models/. The yaml lives there."""
    text = str(checkpoint_dir or "").strip()
    if not text:
        return None
    current = Path(text)
    for parent in [current, *current.parents]:
        if parent.name.lower() == "models":
            return parent.parent / "extra_model_paths.yaml"
    return None


def resolve_model_path(raw: str, base: str | None, yaml_dir: Path) -> Path:
    """Same join rules as ComfyUI utils/extra_config.py."""
    item = os.path.expandvars(os.path.expanduser(str(raw).strip()))
    if base:
        root = os.path.expandvars(os.path.expanduser(str(base).strip()))
        if not os.path.isabs(root):
            root = os.path.abspath(os.path.join(str(yaml_dir), root))
        full = os.path.join(root, item)
    elif not os.path.isabs(item):
        full = os.path.abspath(os.path.join(str(yaml_dir), item))
    else:
        full = item
    return Path(os.path.normpath(full))


def upscale_dirs_from_yaml(text: str, yaml_dir: Path) -> list[Path]:
    """Pull upscale_models paths out of extra_model_paths.yaml. No PyYAML."""
    sections: list[dict] = []
    current: dict | None = None
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        if not raw.strip() or raw.lstrip().startswith("#"):
            i += 1
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()
        if indent == 0 and line.endswith(":") and ":" not in line[:-1]:
            current = {"base": None, "ups": []}
            sections.append(current)
            i += 1
            continue
        if current is None or ":" not in line:
            i += 1
            continue
        key, val = line.split(":", 1)
        key = key.strip()
        val = val.strip().strip("'\"")
        if key == "base_path":
            current["base"] = val or None
            i += 1
            continue
        if key != "upscale_models":
            i += 1
            continue
        if val in {"", "|", ">", "|-", ">-", "|+", ">+"}:
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if not nxt.strip() or nxt.lstrip().startswith("#"):
                    i += 1
                    continue
                nindent = len(nxt) - len(nxt.lstrip(" "))
                if nindent <= indent:
                    break
                current["ups"].append(nxt.strip().strip("'\""))
                i += 1
            continue
        current["ups"].append(val)
        i += 1
    out: list[Path] = []
    for sec in sections:
        for item in sec["ups"]:
            if item:
                out.append(resolve_model_path(item, sec["base"], yaml_dir))
    return out


def _dedupe(dirs: list[Path]) -> list[Path]:
    seen: set[str] = set()
    out: list[Path] = []
    for path in dirs:
        key = os.path.normcase(os.path.abspath(str(path)))
        if key in seen:
            continue
        seen.add(key)
        out.append(path)
    return out


def collect_dirs(config: dict | None = None, yaml_path: Path | None = None) -> list[Path]:
    """upscaleModelDir, then the folder next to checkpoints, then yaml extras."""
    config = load_config() if config is None else config
    comfy = config.get("comfy") if isinstance(config.get("comfy"), dict) else {}
    checkpoint_dir = str(comfy.get("checkpointDir") or "")
    configured = str(comfy.get("upscaleModelDir") or "").strip()
    dirs: list[Path] = []
    if configured:
        dirs.append(Path(configured))
    derived = derive_upscale_dir(checkpoint_dir)
    if derived is not None:
        dirs.append(derived)
    ypath = yaml_path
    if ypath is None and checkpoint_dir.strip():
        ypath = extra_yaml_beside_models(checkpoint_dir)
    if ypath is not None and Path(ypath).is_file():
        try:
            text = Path(ypath).read_text(encoding="utf-8")
        except OSError:
            text = ""
        if text:
            dirs.extend(upscale_dirs_from_yaml(text, Path(ypath).parent))
    return _dedupe(dirs)


def model_listed(names, filename: str = NAME) -> bool:
    needle = filename.replace("\\", "/").lower()
    base = needle.split("/")[-1]
    for name in names or []:
        norm = str(name).replace("\\", "/").lower()
        if norm == needle or norm == base or norm.endswith("/" + base):
            return True
    return False


def find_model_file(dirs, filename: str = NAME) -> Path | None:
    needle = filename.lower()
    for folder in dirs or []:
        root = Path(folder)
        if not root.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d != ".git" and not d.startswith(".")]
            for fn in filenames:
                if fn.lower() == needle:
                    return Path(dirpath) / fn
    return None


def destination_dir(dirs) -> Path | None:
    """First folder we can write: one that exists, or whose parent exists so we can create it."""
    for folder in dirs or []:
        path = Path(folder)
        if path.is_dir() or path.parent.is_dir():
            return path
    return None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def file_matches(path: Path, size: int = SIZE, digest: str = SHA256) -> bool:
    file = Path(path)
    try:
        if not file.is_file() or file.stat().st_size != size:
            return False
    except OSError:
        return False
    return sha256_file(file) == digest


def commit_part(part: Path, dest: Path, size: int, digest: str) -> bool:
    """Rename part onto dest only when size and sha256 match. Otherwise delete part."""
    part = Path(part)
    dest = Path(dest)
    try:
        ok = part.is_file() and part.stat().st_size == size and sha256_file(part) == digest
    except OSError:
        ok = False
    if not ok:
        try:
            part.unlink()
        except OSError:
            pass
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    os.replace(part, dest)
    return True


def decide(comfy_names, dirs, dest_ok: bool = False) -> str:
    """skip: already present. unlisted: good file on disk, Comfy did not list it.

    nowhere: no folder to save into. download: go get the file.
    comfy_names is None when Comfy did not answer, or a list when it did.
    """
    if comfy_names is not None and model_listed(comfy_names):
        return "skip"
    if comfy_names is None and find_model_file(dirs) is not None:
        return "skip"
    if destination_dir(dirs) is None:
        return "nowhere"
    if dest_ok:
        return "unlisted"
    return "download"


def list_upscale_names(base: str, timeout: float = 8) -> list[str] | None:
    """None means Comfy is down. A list (maybe empty) means it answered."""
    url = base.rstrip("/") + "/object_info/UpscaleModelLoader"
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8") or "{}")
    except (OSError, urllib.error.URLError, TimeoutError, ValueError):
        return None
    if not isinstance(payload, dict):
        return []
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    import workflows

    return workflows.combo_list(payload, "UpscaleModelLoader", "model_name")


def execute(comfy_names, dirs, dest_ok: bool, download, check_only: bool = False) -> int:
    decision = decide(comfy_names, dirs, dest_ok)
    if decision == "skip":
        return 0
    if decision == "unlisted":
        print(
            "The upscale model is already on disk, but ComfyUI has not listed it. "
            "Restart ComfyUI if deep Hires cannot see it."
        )
        return 0
    if decision == "nowhere":
        print(NOWHERE)
        return 0
    if check_only:
        return 3
    return int(download(destination_dir(dirs)))


def download_to(dest_dir: Path) -> int:
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / NAME
    part = dest_dir / (NAME + ".part")
    last: Exception | None = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(URL, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as resp, part.open("wb") as handle:
                total = int(resp.headers.get("Content-Length") or SIZE)
                got = 0
                shown = -1
                while True:
                    chunk = resp.read(1 << 16)
                    if not chunk:
                        break
                    handle.write(chunk)
                    got += len(chunk)
                    pct = got * 100 // max(1, total)
                    if pct // 10 != shown:
                        shown = pct // 10
                        print(f"  {pct:3d}%  {got / 1e6:.1f}/{total / 1e6:.1f} MB", flush=True)
            if commit_part(part, dest, SIZE, SHA256):
                return 0
            print("  size or sha256 mismatch; retrying...", flush=True)
            last = RuntimeError("checksum")
        except (urllib.error.URLError, OSError, TimeoutError) as err:
            last = err
            print(f"  download failed ({err}); retrying...", flush=True)
            try:
                part.unlink()
            except OSError:
                pass
        if attempt < 2:
            time.sleep(2 + attempt * 3)
    try:
        part.unlink()
    except OSError:
        pass
    print(f"Could not download the upscale model ({last}).")
    return 1


def _announce_saved(base: str) -> None:
    names = list_upscale_names(base)
    if names is None:
        print("Saved. ComfyUI is not running; it will see the model the next time it starts.")
        return
    if not model_listed(names):
        # Comfy refreshes the model list from the folder mtime. Give that one beat.
        time.sleep(1)
        names = list_upscale_names(base) or []
    if model_listed(names):
        print("Saved. ComfyUI lists the model (no restart needed).")
        return
    print("Saved, but ComfyUI has not listed the model. Restart ComfyUI, then try deep Hires again.")


def comfy_folders(base: str, timeout: float = 5) -> dict:
    """開著的本機 ComfyUI 自己回報的資料夾（GET /internal/folder_paths）：{"upscale_models": [路徑…], …}。
    第一次用、還沒有 config.json 的人靠這個找到 ComfyUI 在哪。遠端的 ComfyUI、沒開、版本太舊都回 {}。"""
    host = (urllib.parse.urlparse(base).hostname or "").strip().lower().strip("[]")
    if host not in {"127.0.0.1", "localhost", "::1"}:
        return {}
    try:
        req = urllib.request.Request(base.rstrip("/") + "/internal/folder_paths", headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8") or "{}")
    except (OSError, urllib.error.URLError, TimeoutError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("NO_UPSCALE_FETCH"):
        return 0
    argv = list(sys.argv[1:] if argv is None else argv)
    check_only = "--check" in argv
    config = load_config()
    dirs = collect_dirs(config)
    base = comfy_base(config)
    if destination_dir(dirs) is None:
        # 沒有 config.json（第一次用）：ComfyUI 開著的話，問它的 upscale_models 在哪。
        dirs = _dedupe(dirs + [Path(x) for x in comfy_folders(base).get("upscale_models") or [] if isinstance(x, str)])
    names = list_upscale_names(base)
    dest = destination_dir(dirs)
    dest_ok = bool(dest and file_matches(dest / NAME))
    code = execute(names, dirs, dest_ok, download_to, check_only=check_only)
    if code == 0 and not check_only and not dest_ok and dest and file_matches(dest / NAME):
        _announce_saved(base)
    return code


if __name__ == "__main__":
    sys.exit(main())
