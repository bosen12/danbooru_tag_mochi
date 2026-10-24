#!/usr/bin/env python3
"""Install what the 解析池 page (web6/parse.html) needs in ComfyUI, when it is missing.

  1. ComfyUI-WD14-Tagger (pysssss, MIT), the same way fetch_pose_assets.py installs nodes:
     git clone or the GitHub zip, then its requirements (onnxruntime) with ComfyUI's own python.
     ComfyUI must be restarted once afterwards.
  2. The default tagger model wd-vit-tagger-v3 (SmilingWolf, Apache-2.0): model.onnx + selected_tags.csv
     saved as wd-vit-tagger-v3.onnx / .csv in the node's models folder, where the node looks first.
     Checked by size + sha256. (The node would also download it by itself on the first parse, but then
     the first parse waits minutes with no progress shown.)

    python scripts/fetch_tagger.py            # install whatever is missing
    python scripts/fetch_tagger.py --check    # 0 nothing to do (or cannot), 3 something missing

The first-run panel (setup_tasks.py) calls --check, asks, then installs.
Only touches a ComfyUI on this machine. Set NO_TAGGER_FETCH=1 to skip.
Console text is ASCII: cmd is not UTF-8. Standard library only.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fetch_upscale_model as up  # noqa: E402  (config, Comfy address, sha256 helpers)
import fetch_pose_assets as pose  # noqa: E402  (ComfyUI folder, its python, node installer)
import fetch_face_detailer as face  # noqa: E402  (resumable, checked download)

NODE_DIR = "comfyui-wd14-tagger"
NODE_GIT = "https://github.com/pysssss/ComfyUI-WD14-Tagger.git"
NODE_ZIP = "https://github.com/pysssss/ComfyUI-WD14-Tagger/archive/refs/heads/main.zip"
NODE_CLASS = "WD14Tagger|pysssss"

MODEL = "wd-vit-tagger-v3"
BASE = "https://huggingface.co/SmilingWolf/wd-vit-tagger-v3/resolve/main/"
# Measured: the Hugging Face LFS oid / file of each, and the copy the project owner already uses.
FILES = (
    ("model.onnx", MODEL + ".onnx", 378536310, "35f23693620b668f4d53fd3c62bf65e40af739bc52c7eb0fbc49258b58d065b6"),
    ("selected_tags.csv", MODEL + ".csv", 308468, "298633d94d0031d2081c0893f29c82eab7f0df00b08483ba8f29d1e979441217"),
)


def node_folder(root: Path) -> Path | None:
    """custom_nodes/<the tagger>, whatever capitals a manual clone kept."""
    nodes = root / "custom_nodes"
    if not nodes.is_dir():
        return None
    for d in nodes.iterdir():
        if d.is_dir() and d.name.lower() in (NODE_DIR, "comfyui-wd14-tagger-main") and (d / "__init__.py").is_file():
            return d
    return None


def model_folders(root: Path) -> list[Path]:
    """Where the node reads models: models/wd14_tagger when extra_model_paths sets it up, else its own models/."""
    out = [root / "models" / "wd14_tagger"]
    node = node_folder(root)
    if node:
        out.append(node / "models")
    return out


def model_on_disk(root: Path) -> bool:
    return any((f / (MODEL + ".onnx")).is_file() and (f / (MODEL + ".csv")).is_file() for f in model_folders(root))


def status(config: dict | None = None) -> dict:
    """{'root', 'node', 'model', 'comfy_up'}. A node on disk but not loaded counts as installed (needs a restart)."""
    config = up.load_config() if config is None else config
    root = pose.comfy_root(config)
    base = up.comfy_base(config)
    comfy_up = pose.comfy_get(base, "/system_stats") is not None
    info = pose.comfy_get(base, "/object_info/" + NODE_CLASS.replace("|", "%7C")) if comfy_up else None
    node = bool(info and NODE_CLASS in info) or bool(root and node_folder(root))
    model = bool(root and model_on_disk(root))
    return {"root": root, "node": node, "model": model, "comfy_up": comfy_up}


def download_model(root: Path) -> bool:
    node = node_folder(root)
    if node is None:
        print("The tagger node is not on disk; cannot place its model.")
        return False
    ok = True
    for src, name, size, sha in FILES:
        if (node / "models" / name).is_file():
            continue
        ok = face._download(BASE + src, node / "models", name, size, sha, name) and ok
    return ok


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("NO_TAGGER_FETCH"):
        return 0
    argv = list(sys.argv[1:] if argv is None else argv)
    check_only = "--check" in argv
    config = up.load_config()
    if not pose.comfy_is_local(up.comfy_base(config)):
        return 0
    st = status(config)
    if st["root"] is None:
        if not check_only:
            print("Set comfy.checkpointDir in config.json so ComfyUI can be found. Not installing.")
        return 0
    if st["node"] and st["model"]:
        return 0
    if check_only:
        # 第一次準備的面板照這行寫要裝什麼（節點已經在、只缺模型的人不用重開 ComfyUI）。
        print(f"tagger check: node {'ok' if st['node'] else 'missing'}, model {'ok' if st['model'] else 'missing'}")
        return 3
    ok = True
    if not st["node"]:
        ok = pose.install_custom_node(st["root"], NODE_DIR, NODE_GIT, NODE_ZIP, "WD14 Tagger")
    if ok and not st["model"]:
        ok = download_model(st["root"])
    if ok:
        print("Done." + ("" if st["node"] else " Restart ComfyUI once so it loads the WD14 Tagger."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
