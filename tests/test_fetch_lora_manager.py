#!/usr/bin/env python3
"""fetch_lora_manager.py：什麼時候算裝了、什麼時候裝、裝哪裡。不碰真的 ComfyUI、不真的下載。"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_lora_manager as fl  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


tmp = Path(tempfile.mkdtemp())
# 這台機器存的 ComfyUI 網址（畫面上改過的、環境變數）會蓋過 config：測試不吃它們。
os.environ.pop("COMFY_API", None)
os.environ["APP_SETTINGS"] = str(tmp / "settings.json")
portable = tmp / "ComfyUI_windows_portable"
root = portable / "ComfyUI"
(root / "models" / "checkpoints" / "ill").mkdir(parents=True)
(root / "custom_nodes").mkdir()
config = {"comfy": {"api": "http://127.0.0.1:1", "checkpointDir": str(root / "models" / "checkpoints" / "ill")}}
fl.up.load_config = lambda: config

answers: dict = {}
fl.pose.comfy_get = lambda base, path, timeout=8: answers.get(path.split("?")[0])
installs = []


def fake_install(r, name, git, zip_url, label):
    installs.append((r, name, git))
    d = r / "custom_nodes" / name
    d.mkdir(parents=True)
    (d / "__init__.py").write_text("")
    return True


fl.pose.install_custom_node = fake_install

# ComfyUI 沒開、資料夾裡也沒有。
ok("沒裝：--check 回 3", fl.main(["--check"]) == 3)
ok("沒裝：裝進 custom_nodes/comfyui-lora-manager", fl.main([]) == 0 and installs == [(root, "comfyui-lora-manager", fl.NODE_GIT)], str(installs))
ok("裝好了但 ComfyUI 還沒重開：--check 回 4", fl.main(["--check"]) == 4)
installs.clear()
ok("裝過了不重裝", fl.main([]) == 0 and installs == [], str(installs))

# ComfyUI 開著而且回得出 LoRA 清單：什麼都不做。
answers.update({"/system_stats": {}, "/api/lm/loras/list": {"items": [], "total": 0}})
ok("ComfyUI 有 LoRA Manager：--check 回 0", fl.main(["--check"]) == 0)

# 停用的（.disabled）不算裝了。
(root / "custom_nodes" / "comfyui-lora-manager").rename(root / "custom_nodes" / "comfyui-lora-manager.disabled")
answers.clear()
ok("停用的不算裝了", fl.main(["--check"]) == 3)

# 遠端 ComfyUI（Tailscale）不歸這台管；設了 NO_LORA_MANAGER_FETCH 也不做。
config["comfy"]["api"] = "http://100.64.0.2:8188"
ok("遠端 ComfyUI：不裝", fl.main(["--check"]) == 0)
config["comfy"]["api"] = "http://127.0.0.1:1"
os.environ["NO_LORA_MANAGER_FETCH"] = "1"
ok("NO_LORA_MANAGER_FETCH 就什麼都不做", fl.main(["--check"]) == 0)
del os.environ["NO_LORA_MANAGER_FETCH"]

# 找不到 ComfyUI（沒 config、ComfyUI 也沒開）：不裝也不報錯。
config["comfy"].pop("checkpointDir")
fl.up.comfy_folders = lambda base: {}
ok("找不到 ComfyUI：不裝", fl.main(["--check"]) == 0 and fl.main([]) == 0)

# 「詳情」直達：在 LoRA Manager 的 loras.js 補 ?open=。長得跟上游一樣才補，補過不重補。
node = tmp / "lm"
js = node / "static" / "js"
(js / "components" / "shared").mkdir(parents=True)
(js / "api").mkdir()
(js / "utils").mkdir()
(node / "__init__.py").write_text("")
(js / "components" / "shared" / "ModelModal.js").write_text("export async function showModelModal(model, modelType) {}\n")
(js / "api" / "apiConfig.js").write_text("export const MODEL_TYPES = { LORA: 'loras' };\n")
(js / "utils" / "uiHelpers.js").write_text("export function showToast(key, params = {}, type = 'info', fallback = null) {}\n")
upstream = (
    "import { appCore } from './core.js';\n\n"
    "export async function initializeLoraPage() {\n"
    "    await appCore.initialize();\n"
    "    const loraPage = new LoraPageManager();\n"
    "    await loraPage.initialize();\n\n"
    "    return loraPage;\n"
    "}\n"
)
(js / "loras.js").write_text(upstream, encoding="utf-8")
from unittest.mock import patch

original_write_text = Path.write_text


def python39_write_text(self, data, encoding=None, errors=None):
    """Python 3.9's real signature: no newline keyword."""
    return original_write_text(self, data, encoding=encoding, errors=errors)


with patch.object(Path, "write_text", python39_write_text):
    try:
        result = fl.patch_open_param(node)
    except TypeError as exc:
        result = str(exc)
ok("Python 3.9：詳情補丁不使用新版 pathlib 參數", result == "patched", result)
patched = (js / "loras.js").read_text(encoding="utf-8")
ok("詳情直達：初始化之後才開、只呼叫一次", patched.count("await openModelFromUrlParam()") == 1
   and patched.index("await loraPage.initialize();") < patched.index("await openModelFromUrlParam()"))
ok("詳情直達：補過不重補（LoRA Manager 沒更新就不動）", fl.patch_open_param(node) == "already" and (js / "loras.js").read_text(encoding="utf-8") == patched)
(js / "loras.js").write_text(upstream, encoding="utf-8")
try:
    result = fl.patch_open_param(node, check_only=True)
except TypeError as exc:
    result = str(exc)
ok("啟動檢查：只看需不需要補，不改第三方檔案", result == "needed" and (js / "loras.js").read_text(encoding="utf-8") == upstream, result)
(js / "loras.js").write_text("console.log('upstream changed');\n", encoding="utf-8")
ok("詳情直達：檔案跟預期不一樣就不動它", fl.patch_open_param(node) == "unsupported"
   and (js / "loras.js").read_text(encoding="utf-8") == "console.log('upstream changed');\n")
(js / "loras.js").write_text(upstream, encoding="utf-8")
(js / "utils" / "uiHelpers.js").write_text("export function notify() {}\n")
ok("詳情直達：要用的函式不在了也不補", fl.patch_open_param(node) == "unsupported" and (js / "loras.js").read_text(encoding="utf-8") == upstream)

# CLI 的退出碼是準備面板判斷成功/失敗的依據；不能把未修改的檔案當作成功。
import shutil
cli_root = tmp / "cli/ComfyUI"
cli_node = cli_root / "custom_nodes/comfyui-lora-manager"
shutil.copytree(node, cli_node)
fl.pose.comfy_root = lambda cfg: cli_root
ok("CLI：補丁不支援時回報失敗", fl.main(["--patch"]) == 1)
(cli_node / "static/js/utils/uiHelpers.js").write_text("export function showToast() {}\n", encoding="utf-8")
ok("CLI：成功補上才回 0", fl.main(["--patch"]) == 0)
ok("CLI：已經有補丁仍算成功", fl.main(["--patch"]) == 0)
fl.pose.comfy_root = lambda cfg: tmp / "missing"
ok("CLI：找不到可修改的節點回報失敗", fl.main(["--patch"]) == 1)

print()
print("ok" if not failed else f"{failed} failed")
sys.exit(1 if failed else 0)
