#!/usr/bin/env python3
"""Install what pose reference (web6/web7 rules: pose) needs in ComfyUI, when it is missing.

  1. The custom node comfyui_controlnet_aux (AIO Aux Preprocessor / OpenposePreprocessor).
     git clone when git is on PATH, otherwise the GitHub zip; then its requirements are
     installed with ComfyUI's own python (python_embeded in the portable build).
     ComfyUI must be restarted once afterwards to load the node.
  2. The Illustrious-XL OpenPose ControlNet (windsingai/Illustrious-XL-openpose-test,
     openpose_s6000.safetensors, Apache-2.0) into models/controlnet, checked by size + sha256.

    python scripts/fetch_pose_assets.py            # install whatever is missing
    python scripts/fetch_pose_assets.py --check    # 0 nothing to do (or cannot), 3 something missing

Startup bats call --check, then install in a minimized window so the page can open.
Only touches a ComfyUI on this machine (found from comfy.checkpointDir in config.json).
Set NO_POSE_FETCH=1 to skip. Console text is ASCII: cmd is not UTF-8.
Standard library only.
"""
from __future__ import annotations

import io
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fetch_upscale_model as up  # noqa: E402  (config, Comfy address, sha256 helpers)

NODE_DIR = "comfyui_controlnet_aux"
NODE_GIT = "https://github.com/Fannovel16/comfyui_controlnet_aux.git"
NODE_ZIP = "https://github.com/Fannovel16/comfyui_controlnet_aux/archive/refs/heads/main.zip"
NODE_CLASS = "AIO_Preprocessor"

MODEL_URL = "https://huggingface.co/windsingai/Illustrious-XL-openpose-test/resolve/main/openpose_s6000.safetensors"
# Measured: the Hugging Face LFS oid of that file, and the copy the project owner already uses.
MODEL_SHA256 = "0d8bacf24534dc6f2716f5d0ffa6085571928776f8687565ef290a17d9f3615c"
MODEL_SIZE = 2502140008
# Same folder/name as the owner's copy: server.py picks a ControlNet with "illustrious" + "openpose".
MODEL_SUBDIR = "Illustrious-XL ControlNet Openpose"
MODEL_NAME = "illustriousXL_v10.safetensors"
UA = {"User-Agent": "danbooru-tag-random/pose-assets"}


def comfy_is_local(base: str) -> bool:
    host = (urllib.parse.urlparse(base).hostname or "").strip().lower().strip("[]")
    return host in {"127.0.0.1", "localhost", "::1"}


def comfy_root(config: dict | None = None) -> Path | None:
    """ComfyUI folder = the parent of models/ above comfy.checkpointDir.

    No config.json yet (first run): ask a running local ComfyUI where its custom_nodes folder is.
    """
    config = up.load_config() if config is None else config
    found = _root_from_config(config)
    if found is not None:
        return found
    nodes = up.comfy_folders(up.comfy_base(config)).get("custom_nodes") or []
    for p in nodes:
        if isinstance(p, str) and Path(p).is_dir():
            return Path(p).parent
    return None


def _root_from_config(config: dict) -> Path | None:
    comfy = config.get("comfy") if isinstance(config.get("comfy"), dict) else {}
    text = str(comfy.get("checkpointDir") or "").strip()
    if not text:
        return None
    current = Path(text)
    for parent in [current, *current.parents]:
        if parent.name.lower() == "models":
            return parent.parent
    return None


def embedded_python(root: Path) -> Path | None:
    """ComfyUI portable keeps its python next to the ComfyUI folder."""
    for cand in (root.parent / "python_embeded" / "python.exe", root / "python_embeded" / "python.exe", root.parent / "python_embedded" / "python.exe"):
        if cand.is_file():
            return cand
    return None


def node_on_disk(root: Path) -> bool:
    nodes = root / "custom_nodes"
    if not nodes.is_dir():
        return False
    for d in nodes.iterdir():
        if d.is_dir() and "controlnet_aux" in d.name.lower() and not d.name.endswith(".disabled") and (d / "__init__.py").is_file():
            return True
    return False


def model_on_disk(root: Path) -> bool:
    folder = root / "models" / "controlnet"
    if not folder.is_dir():
        return False
    for dirpath, dirnames, filenames in os.walk(folder):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for fn in filenames:
            path = Path(dirpath) / fn
            if "openpose" in str(path).lower() and fn.lower().endswith((".safetensors", ".pth", ".bin")):
                return True
    return False


def comfy_get(base: str, path: str, timeout: float = 8):
    try:
        req = urllib.request.Request(base.rstrip("/") + path, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")
    except (OSError, urllib.error.URLError, TimeoutError, ValueError):
        return None


def status(config: dict | None = None) -> dict:
    """{'root', 'node', 'model', 'comfy_up'}: node/model True when present.

    Comfy running: ask it (it knows extra_model_paths and disabled nodes).
    Comfy down: look at the folders.
    """
    config = up.load_config() if config is None else config
    root = comfy_root(config)
    base = up.comfy_base(config)
    info = comfy_get(base, f"/object_info/{NODE_CLASS}")
    comfy_up = info is not None
    node = bool(info and NODE_CLASS in info) if comfy_up else bool(root and node_on_disk(root))
    if comfy_up and not node and root and node_on_disk(root):
        node = True  # installed, ComfyUI just has not been restarted yet
    model = False
    if comfy_up:
        cn = comfy_get(base, "/object_info/ControlNetLoader") or {}
        try:
            names = cn["ControlNetLoader"]["input"]["required"]["control_net_name"][0]
        except (KeyError, IndexError, TypeError):
            names = []
        model = any("openpose" in str(n).lower() for n in names or [])
    if not model and root:
        model = model_on_disk(root)
    return {"root": root, "node": node, "model": model, "comfy_up": comfy_up}


def install_node(root: Path) -> bool:
    nodes = root / "custom_nodes"
    dest = nodes / NODE_DIR
    if not nodes.is_dir():
        print(f"No custom_nodes folder under {root}. Not installing the node.")
        return False
    if not dest.exists():
        git = shutil.which("git")
        ok = False
        if git:
            print("Cloning comfyui_controlnet_aux ...", flush=True)
            ok = subprocess.call([git, "clone", "--depth", "1", NODE_GIT, str(dest)]) == 0
        if not ok:
            print("Downloading comfyui_controlnet_aux (zip) ...", flush=True)
            try:
                req = urllib.request.Request(NODE_ZIP, headers=UA)
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = resp.read()
                with zipfile.ZipFile(io.BytesIO(data)) as zf:
                    top = zf.namelist()[0].split("/")[0]
                    tmp = nodes / (".tmp_" + NODE_DIR)
                    shutil.rmtree(tmp, ignore_errors=True)
                    zf.extractall(tmp)
                    os.replace(tmp / top, dest)
                    shutil.rmtree(tmp, ignore_errors=True)
            except (OSError, urllib.error.URLError, zipfile.BadZipFile) as err:
                print(f"Could not download the node ({err}).")
                return False
    py = embedded_python(root)
    req = dest / "requirements.txt"
    if py and req.is_file():
        print("Installing the node's python packages with ComfyUI's python ...", flush=True)
        code = subprocess.call([str(py), "-s", "-m", "pip", "install", "-r", str(req)])
        if code != 0:
            print("pip did not finish. Open ComfyUI Manager and use 'Try fix' on comfyui_controlnet_aux.")
            return False
    elif not py:
        print("ComfyUI's own python was not found (not the portable build?).")
        print(f"Install the packages yourself:  <ComfyUI python> -m pip install -r \"{req}\"")
    print("Node installed. Restart ComfyUI once so it loads AIO Aux Preprocessor.")
    return True


def download_model(root: Path) -> bool:
    folder = root / "models" / "controlnet" / MODEL_SUBDIR
    # extra_model_paths 把 controlnet 放到別處的：照 ComfyUI 自己說的第一個 controlnet 資料夾放。
    if not (root / "models" / "controlnet").is_dir():
        cn = [p for p in up.comfy_folders(up.comfy_base()).get("controlnet") or [] if isinstance(p, str) and Path(p).is_dir()]
        if cn:
            folder = Path(cn[0]) / MODEL_SUBDIR
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / MODEL_NAME
    part = folder / (MODEL_NAME + ".part")
    last: Exception | None = None
    for attempt in range(4):
        try:
            have = part.stat().st_size if part.is_file() else 0
            if have >= MODEL_SIZE:
                part.unlink()
                have = 0
            headers = dict(UA)
            if have:
                headers["Range"] = f"bytes={have}-"
            req = urllib.request.Request(MODEL_URL, headers=headers)
            with urllib.request.urlopen(req, timeout=180) as resp:
                # 206 = the server continues where the last try stopped; 200 = start over.
                mode = "ab" if have and resp.status == 206 else "wb"
                got = have if mode == "ab" else 0
                shown = -1
                with part.open(mode) as handle:
                    while True:
                        chunk = resp.read(1 << 20)
                        if not chunk:
                            break
                        handle.write(chunk)
                        got += len(chunk)
                        pct = got * 100 // MODEL_SIZE
                        if pct // 5 != shown:
                            shown = pct // 5
                            print(f"  {pct:3d}%  {got / 1e9:.2f}/{MODEL_SIZE / 1e9:.2f} GB", flush=True)
            if part.stat().st_size < MODEL_SIZE:
                raise OSError("connection closed early")
            print("  checking sha256 ...", flush=True)
            if up.commit_part(part, dest, MODEL_SIZE, MODEL_SHA256):
                print("ControlNet saved.")
                return True
            # 檢查碼不對：再抓一次也是 2.5GB，先停下來（多半是來源換了檔），下次啟動再試。
            print("  size or sha256 mismatch. Not saved. It will be tried again next start.", flush=True)
            return False
        except (urllib.error.URLError, OSError, TimeoutError) as err:
            last = err
            print(f"  download interrupted ({err}); continuing...", flush=True)
        if attempt < 3:
            time.sleep(3 + attempt * 4)
    print(f"Could not download the ControlNet ({last}). It continues from where it stopped next time.")
    return False


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("NO_POSE_FETCH"):
        return 0
    argv = list(sys.argv[1:] if argv is None else argv)
    check_only = "--check" in argv
    config = up.load_config()
    base = up.comfy_base(config)
    # ComfyUI 在別台（走 Tailscale）：那台的資料夾不歸這裡管。
    if not comfy_is_local(base):
        return 0
    st = status(config)
    if st["root"] is None:
        if not check_only:
            print("Set comfy.checkpointDir in config.json so ComfyUI can be found. Not installing.")
        return 0
    if st["node"] and st["model"]:
        return 0
    if check_only:
        return 3
    ok = True
    if not st["node"]:
        ok = install_node(st["root"]) and ok
    if not st["model"]:
        ok = download_model(st["root"]) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
