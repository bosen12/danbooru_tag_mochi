#!/usr/bin/env python3
"""Install ComfyUI LoRA Manager (willmiao/ComfyUI-Lora-Manager) into ComfyUI when it is missing.

The LoRA panel takes its list, preview images and Civitai trigger words from it, and the
checkpoint panel its names and previews. Without it LoRAs have no previews or trigger words
unless paths.loraRoot is set in config.json.

    python scripts/fetch_lora_manager.py            # install if missing
    python scripts/fetch_lora_manager.py --check    # 0 present (or cannot install here), 3 missing, 4 installed but ComfyUI not restarted

Installed means: ComfyUI answers /api/lm/loras/list. ComfyUI not running: the custom_nodes
folder is looked at instead. Only touches a ComfyUI on this machine (a remote one, reached over
Tailscale, is that machine's business). Startup bats call --check, then install in a minimized
window so the page can open. ComfyUI must be restarted once to load it.
Set NO_LORA_MANAGER_FETCH=1 to skip. Console text is ASCII: cmd is not UTF-8.
Standard library only.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fetch_pose_assets as pose  # noqa: E402  (ComfyUI folder, embedded python, node installer)
import fetch_upscale_model as up  # noqa: E402  (config, Comfy address)

NODE_DIR = "comfyui-lora-manager"  # the folder name ComfyUI Manager uses
NODE_GIT = "https://github.com/willmiao/ComfyUI-Lora-Manager.git"
NODE_ZIP = "https://github.com/willmiao/ComfyUI-Lora-Manager/archive/refs/heads/main.zip"
LIST_PATH = "/api/lm/loras/list?page=1&page_size=1"


def on_disk(root: Path) -> bool:
    nodes = root / "custom_nodes"
    if not nodes.is_dir():
        return False
    for d in nodes.iterdir():
        name = d.name.lower().replace("_", "-")
        if d.is_dir() and "lora-manager" in name and not name.endswith(".disabled") and (d / "__init__.py").is_file():
            return True
    return False


def status(config: dict | None = None) -> dict:
    """{'root', 'running', 'on_disk', 'comfy_up'}."""
    config = up.load_config() if config is None else config
    base = up.comfy_base(config)
    root = pose.comfy_root(config)
    comfy_up = pose.comfy_get(base, "/system_stats") is not None
    listed = pose.comfy_get(base, LIST_PATH) if comfy_up else None
    running = isinstance(listed, dict) and "items" in listed
    return {"root": root, "running": running, "on_disk": bool(root and on_disk(root)), "comfy_up": comfy_up}


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("NO_LORA_MANAGER_FETCH"):
        return 0
    argv = list(sys.argv[1:] if argv is None else argv)
    check_only = "--check" in argv
    config = up.load_config()
    base = up.comfy_base(config)
    if not pose.comfy_is_local(base):
        return 0
    st = status(config)
    if st["running"]:
        return 0
    if st["on_disk"]:
        # Installed (maybe just now) but this ComfyUI has not loaded it yet.
        if check_only:
            return 4
        print("ComfyUI LoRA Manager is installed. Restart ComfyUI once to load it.")
        return 0
    if st["root"] is None:
        if not check_only:
            print("ComfyUI was not found (start it, or set comfy.checkpointDir in config.json). Not installing.")
        return 0
    if check_only:
        return 3
    if not pose.install_custom_node(st["root"], NODE_DIR, NODE_GIT, NODE_ZIP, "ComfyUI LoRA Manager"):
        return 1
    print("ComfyUI LoRA Manager installed. Restart ComfyUI once; then the LoRA panel shows previews and trigger words.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
