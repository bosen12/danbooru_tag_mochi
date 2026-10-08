#!/usr/bin/env python3
"""Install ComfyUI LoRA Manager (willmiao/ComfyUI-Lora-Manager) into ComfyUI when it is missing.

The LoRA panel takes its list, preview images and Civitai trigger words from it, and the
checkpoint panel its names and previews. Without it LoRAs have no previews or trigger words
unless paths.loraRoot is set in config.json.

    python scripts/fetch_lora_manager.py            # install if missing
    python scripts/fetch_lora_manager.py --check    # 0 present (or cannot install here), 3 missing, 4 installed but ComfyUI not restarted
    python scripts/fetch_lora_manager.py --patch    # only make /loras?open=<folder>/<file> open that LoRA (see patch_open_param)

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
    return node_dir(root) is not None


def status(config: dict | None = None) -> dict:
    """{'root', 'running', 'on_disk', 'comfy_up'}."""
    config = up.load_config() if config is None else config
    base = up.comfy_base(config)
    root = pose.comfy_root(config)
    comfy_up = pose.comfy_get(base, "/system_stats") is not None
    listed = pose.comfy_get(base, LIST_PATH) if comfy_up else None
    running = isinstance(listed, dict) and "items" in listed
    return {"root": root, "running": running, "on_disk": bool(root and on_disk(root)), "comfy_up": comfy_up}


# ---------- 「詳情」直達：LoRA Manager 讀 ?open=<folder>/<file> 打開那個 LoRA ----------
# 上游的 LoRA 清單頁不吃網址參數；LoRA 面板的「詳情」要直接打開那一個 LoRA 的詳情視窗，
# 就在它的 static/js/loras.js 補一段（跟 flux2klein 自帶那份 LoRA Manager 的改法一樣）。
# LoRA Manager 更新會蓋掉，所以每次開機都檢查、缺了再補。檔案長得跟預期不一樣就不動它
# （「詳情」退回開清單頁），不會把它弄壞。
PATCH_MARK = "danbooru-tag: open=<folder>/<file>"
PATCH_IMPORTS = (
    "import { showModelModal } from './components/shared/ModelModal.js';\n"
    "import { MODEL_TYPES } from './api/apiConfig.js';\n"
    "import { showToast } from './utils/uiHelpers.js';\n"
)
PATCH_FUNCTION = r"""
// danbooru-tag: open=<folder>/<file> — added by danbooru_tag_random / danbooru_tag_mochi
// (scripts/fetch_lora_manager.py). Their LoRA panel links "/loras?open=<folder>/<file.safetensors>"
// so the details of that LoRA open directly. Re-applied after LoRA Manager updates.
async function openModelFromUrlParam() {
    const raw = new URLSearchParams(location.search).get('open');
    if (!raw) return;
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete('open');
    history.replaceState(null, '', cleanUrl);
    const slashAt = raw.lastIndexOf('/');
    const folder = slashAt >= 0 ? raw.slice(0, slashAt) : '';
    const fileName = slashAt >= 0 ? raw.slice(slashAt + 1) : raw;
    const stem = fileName.replace(/\.[^./]+$/, '');
    try {
        const qs = new URLSearchParams({ folder, search: stem, search_filename: 'true', page_size: '100' });
        const res = await fetch(`/api/lm/loras/list?${qs}`);
        const data = await res.json();
        const model = (data.items || []).find(m => m.folder === folder && m.file_name === stem);
        if (!model) {
            showToast('toast.general.openFromUrlNotFound', {}, 'error', `Not found: ${fileName}`);
            return;
        }
        await showModelModal(model, MODEL_TYPES.LORA);
    } catch (e) {
        console.error('openModelFromUrlParam failed:', e);
    }
}

"""
PATCH_CALL_AFTER = "    await loraPage.initialize();\n"
PATCH_CALL = "    await openModelFromUrlParam(); // danbooru-tag\n"


def node_dir(root: Path) -> Path | None:
    nodes = root / "custom_nodes"
    if not nodes.is_dir():
        return None
    for d in sorted(nodes.iterdir()):
        name = d.name.lower().replace("_", "-")
        if d.is_dir() and "lora-manager" in name and not name.endswith(".disabled") and (d / "__init__.py").is_file():
            return d
    return None


def patch_open_param(node: Path) -> str:
    """'patched' 補好了、'already' 本來就有、'unsupported' 檔案跟預期不一樣（不動）。"""
    js = node / "static" / "js" / "loras.js"
    try:
        text = js.read_text(encoding="utf-8")
    except OSError:
        return "unsupported"
    if PATCH_MARK in text or "openModelFromUrlParam" in text:
        return "already"
    anchor_fn = "export async function initializeLoraPage"
    if text.count(anchor_fn) != 1 or text.count(PATCH_CALL_AFTER) != 1 or not text.startswith("import "):
        return "unsupported"
    # 要用到的三個函式：檔案真的存在、名字也對，才補。
    js_root = node / "static" / "js"
    needs = {
        "components/shared/ModelModal.js": "export async function showModelModal",
        "api/apiConfig.js": "export const MODEL_TYPES",
        "utils/uiHelpers.js": "export function showToast",
    }
    for rel, sig in needs.items():
        try:
            if sig not in (js_root / rel).read_text(encoding="utf-8"):
                return "unsupported"
        except OSError:
            return "unsupported"
    patched = PATCH_IMPORTS + text
    patched = patched.replace(anchor_fn, PATCH_FUNCTION.lstrip("\n") + anchor_fn, 1)
    patched = patched.replace(PATCH_CALL_AFTER, PATCH_CALL_AFTER + PATCH_CALL, 1)
    try:
        js.write_text(patched, encoding="utf-8", newline="")
    except OSError:
        return "unsupported"
    return "patched"


def ensure_open_param(config: dict | None = None) -> str:
    """這台的 ComfyUI 有 LoRA Manager 就確認「詳情直達」補過了。回傳 patch_open_param 的結果或 'none'。"""
    config = up.load_config() if config is None else config
    if not pose.comfy_is_local(up.comfy_base(config)):
        return "none"
    root = pose.comfy_root(config)
    node = node_dir(root) if root else None
    return patch_open_param(node) if node else "none"


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("NO_LORA_MANAGER_FETCH"):
        return 0
    argv = list(sys.argv[1:] if argv is None else argv)
    check_only = "--check" in argv
    config = up.load_config()
    if "--patch" in argv:
        # 只補「詳情直達」（伺服器每次開機、啟動檔都會叫）。
        print(f"LoRA Manager open-link patch: {ensure_open_param(config)}")
        return 0
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
    ensure_open_param(config)
    print("ComfyUI LoRA Manager installed. Restart ComfyUI once; then the LoRA panel shows previews and trigger words.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
