#!/usr/bin/env python3
"""Install what the 修臉 button (FaceDetailer, web6) needs in ComfyUI, when it is missing.

  1. ComfyUI-Impact-Pack (FaceDetailer) and ComfyUI-Impact-Subpack (UltralyticsDetectorProvider),
     the same way fetch_pose_assets.py installs nodes: git clone or the GitHub zip, then their
     requirements with ComfyUI's own python. ComfyUI must be restarted once afterwards.
  2. The face detector face_yolov8m.pt (Bingsu/adetailer, Apache-2.0) into models/ultralytics/bbox,
     checked by size + sha256.

    python scripts/fetch_face_detailer.py            # install whatever is missing
    python scripts/fetch_face_detailer.py --check    # 0 nothing to do (or cannot), 3 something missing

The first-run panel (setup_tasks.py) calls --check, asks, then installs.
Only touches a ComfyUI on this machine. Set NO_FACE_FETCH=1 to skip.
Console text is ASCII: cmd is not UTF-8. Standard library only.
"""
from __future__ import annotations

import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fetch_upscale_model as up  # noqa: E402  (config, Comfy address, sha256 helpers)
import fetch_pose_assets as pose  # noqa: E402  (ComfyUI folder, its python, node installer)

# (folder name ComfyUI-Manager uses, git, zip, node class it adds)
NODES = (
    ("comfyui-impact-pack", "https://github.com/ltdrdata/ComfyUI-Impact-Pack.git",
     "https://github.com/ltdrdata/ComfyUI-Impact-Pack/archive/refs/heads/Main.zip", "FaceDetailer"),
    ("comfyui-impact-subpack", "https://github.com/ltdrdata/ComfyUI-Impact-Subpack.git",
     "https://github.com/ltdrdata/ComfyUI-Impact-Subpack/archive/refs/heads/main.zip", "UltralyticsDetectorProvider"),
)
DETECTOR_NODE = "UltralyticsDetectorProvider"

MODEL_URL = "https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov8m.pt"
# Measured: the Hugging Face LFS oid of that file, and the copy the project owner already uses.
MODEL_SHA256 = "717923c19b3f4bbf5250b728f1fa6b2cb72a33aed1d236ea9caf0e21ad943e5f"
MODEL_SIZE = 52026019
MODEL_NAME = "face_yolov8m.pt"
UA = {"User-Agent": "danbooru-tag-random/face-detailer"}


def node_on_disk(root: Path, dir_name: str) -> bool:
    """Same folder name in any case (manual clones keep GitHub's capitals), not disabled."""
    nodes = root / "custom_nodes"
    if not nodes.is_dir():
        return False
    want = dir_name.lower()
    for d in nodes.iterdir():
        if d.is_dir() and d.name.lower() == want and (d / "__init__.py").is_file():
            return True
    return False


def is_face_model(name: str) -> bool:
    low = str(name).replace("\\", "/").lower()
    return low.startswith("bbox/") and "face" in low.rsplit("/", 1)[-1]


def model_on_disk(root: Path) -> bool:
    folder = root / "models" / "ultralytics" / "bbox"
    if not folder.is_dir():
        return False
    return any(p.is_file() and "face" in p.name.lower() and p.suffix.lower() in (".pt", ".safetensors") for p in folder.iterdir())


def detector_names(info) -> list:
    try:
        rule = info[DETECTOR_NODE]["input"]["required"]["model_name"]
    except (KeyError, TypeError):
        return []
    # Old enum format [[...]]; new ["COMBO", {"options": [...]}].
    if isinstance(rule, list) and rule and isinstance(rule[0], list):
        return rule[0]
    if isinstance(rule, list) and len(rule) > 1 and isinstance(rule[1], dict):
        return list(rule[1].get("options") or [])
    return []


def status(config: dict | None = None) -> dict:
    """{'root', 'nodes': {dir: bool}, 'model', 'comfy_up'}.

    Comfy running: ask it (it knows disabled nodes and extra paths); a node that is on disk but
    not loaded counts as installed (ComfyUI just needs a restart). Comfy down: look at the folders.
    """
    config = up.load_config() if config is None else config
    root = pose.comfy_root(config)
    base = up.comfy_base(config)
    comfy_up = pose.comfy_get(base, "/system_stats") is not None
    nodes = {}
    det_info = None
    for dir_name, _git, _zip, cls in NODES:
        info = pose.comfy_get(base, f"/object_info/{cls}") if comfy_up else None
        if cls == DETECTOR_NODE:
            det_info = info
        loaded = bool(info and cls in info)
        nodes[dir_name] = loaded or bool(root and node_on_disk(root, dir_name))
    model = any(is_face_model(n) for n in detector_names(det_info))
    if not model and root:
        model = model_on_disk(root)
    return {"root": root, "nodes": nodes, "model": model, "comfy_up": comfy_up}


def model_folder(root: Path) -> Path:
    return root / "models" / "ultralytics" / "bbox"


def download_model(root: Path) -> bool:
    folder = model_folder(root)
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
            with urllib.request.urlopen(req, timeout=120) as resp:
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
                        if pct // 10 != shown:
                            shown = pct // 10
                            print(f"  {pct:3d}%  {got / 1e6:.0f}/{MODEL_SIZE / 1e6:.0f} MB", flush=True)
            if part.stat().st_size < MODEL_SIZE:
                raise OSError("connection closed early")
            if up.commit_part(part, dest, MODEL_SIZE, MODEL_SHA256):
                print("Face detector saved.")
                return True
            print("  size or sha256 mismatch. Not saved. It will be tried again next start.", flush=True)
            return False
        except (urllib.error.URLError, OSError, TimeoutError) as err:
            last = err
            print(f"  download interrupted ({err}); continuing...", flush=True)
        if attempt < 3:
            time.sleep(3 + attempt * 4)
    print(f"Could not download the face detector ({last}). It continues from where it stopped next time.")
    return False


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("NO_FACE_FETCH"):
        return 0
    argv = list(sys.argv[1:] if argv is None else argv)
    check_only = "--check" in argv
    config = up.load_config()
    # ComfyUI 在別台（走 Tailscale）：那台的資料夾不歸這裡管。
    if not pose.comfy_is_local(up.comfy_base(config)):
        return 0
    st = status(config)
    if st["root"] is None:
        if not check_only:
            print("Set comfy.checkpointDir in config.json so ComfyUI can be found. Not installing.")
        return 0
    if all(st["nodes"].values()) and st["model"]:
        return 0
    if check_only:
        return 3
    ok = True
    for dir_name, git_url, zip_url, _cls in NODES:
        if not st["nodes"][dir_name]:
            ok = pose.install_custom_node(st["root"], dir_name, git_url, zip_url, dir_name) and ok
    if not st["model"]:
        ok = download_model(st["root"]) and ok
    if ok:
        print("Done. Restart ComfyUI once so it loads FaceDetailer.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
