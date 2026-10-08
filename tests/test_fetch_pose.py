#!/usr/bin/env python3
"""fetch_pose_assets.py：缺什麼、裝哪裡、下載續傳與檢查碼。不碰真的 ComfyUI、不真的下載。"""
from __future__ import annotations

import hashlib
import io
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_pose_assets as fp  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


tmp = Path(tempfile.mkdtemp())
portable = tmp / "ComfyUI_windows_portable"
root = portable / "ComfyUI"
(root / "models" / "checkpoints" / "ill").mkdir(parents=True)
(root / "custom_nodes").mkdir()
config = {"comfy": {"api": "http://127.0.0.1:1", "checkpointDir": str(root / "models" / "checkpoints" / "ill")}}

ok("ComfyUI 資料夾從 checkpointDir 往上找", fp.comfy_root(config) == root)
ok("只管這台機器上的 ComfyUI", fp.comfy_is_local("http://127.0.0.1:8188") and fp.comfy_is_local("http://localhost:8188") and not fp.comfy_is_local("http://100.64.0.2:8188"))

saved_get = fp.comfy_get
fp.comfy_get = lambda base, path, timeout=8: None  # ComfyUI 沒開：看資料夾
st = fp.status(config)
ok("都沒有：節點、模型都缺", st["node"] is False and st["model"] is False and st["comfy_up"] is False, str(st))
(root / "custom_nodes" / "comfyui_controlnet_aux").mkdir()
(root / "custom_nodes" / "comfyui_controlnet_aux" / "__init__.py").write_text("")
(root / "models" / "controlnet" / "x").mkdir(parents=True)
(root / "models" / "controlnet" / "x" / "my_openpose.safetensors").write_bytes(b"x")
st = fp.status(config)
ok("資料夾裡有就算有（任何 openpose 的 ControlNet 都行）", st["node"] and st["model"], str(st))
(root / "custom_nodes" / "comfyui_controlnet_aux").rename(root / "custom_nodes" / "comfyui_controlnet_aux.disabled")
ok("停用的節點不算", fp.status(config)["node"] is False)

# ComfyUI 開著：問它
fp.comfy_get = lambda base, path, timeout=8: {"AIO_Preprocessor": {}} if "AIO" in path else {"ControlNetLoader": {"input": {"required": {"control_net_name": [["a\\b_openpose.safetensors"]]}}}}
st = fp.status(config)
ok("ComfyUI 開著就問它", st["node"] and st["model"] and st["comfy_up"], str(st))
fp.comfy_get = lambda base, path, timeout=8: {} if "AIO" in path else {"ControlNetLoader": {"input": {"required": {"control_net_name": [["canny.safetensors"]]}}}}
(root / "models" / "controlnet" / "x" / "my_openpose.safetensors").unlink()
st = fp.status(config)
ok("ComfyUI 說沒有：兩個都缺", not st["node"] and not st["model"], str(st))
fp.comfy_get = saved_get

# 下載：續傳＋檢查碼（假的伺服器）
payload = b"pose-model-bytes" * 1000
fp.MODEL_SIZE = len(payload)
fp.MODEL_SHA256 = hashlib.sha256(payload).hexdigest()


class Resp(io.BytesIO):
    def __init__(self, data, status):
        super().__init__(data)
        self.status = status
        self.headers = {}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


calls = []


def fake_urlopen(req, timeout=0):
    rng = req.headers.get("Range")
    calls.append(rng)
    if len(calls) == 1:
        return Resp(payload[:5000], 200)  # 第一次斷在一半
    start = int(rng.split("=")[1].rstrip("-")) if rng else 0
    return Resp(payload[start:], 206 if rng else 200)


saved_open = fp.urllib.request.urlopen
saved_sleep = fp.time.sleep
fp.urllib.request.urlopen = fake_urlopen
fp.time.sleep = lambda s: None
try:
    good = fp.download_model(root)
finally:
    fp.urllib.request.urlopen = saved_open
dest = root / "models" / "controlnet" / fp.MODEL_SUBDIR / fp.MODEL_NAME
ok("斷線之後從斷的地方接著下載（Range）", calls[1] == "bytes=5000-", str(calls))
ok("下載完檢查大小和 sha256 才改名放好", good and dest.read_bytes() == payload and not dest.with_name(dest.name + ".part").exists())
ok("放的位置讓伺服器挑得到（資料夾名有 Illustrious、OpenPose）", "illustrious" in str(dest).lower() and "openpose" in str(dest).lower())


def bad_urlopen(req, timeout=0):
    return Resp(b"x" * fp.MODEL_SIZE, 200)


dest.unlink()
fp.urllib.request.urlopen = bad_urlopen
try:
    good = fp.download_model(root)
finally:
    fp.urllib.request.urlopen = saved_open
    fp.time.sleep = saved_sleep
ok("檢查碼不對就不放（也不留壞檔）", not good and not dest.exists() and not dest.with_name(dest.name + ".part").exists())

# 節點：沒有 git 走 zip；用 ComfyUI 自己的 python 裝套件
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as zf:
    zf.writestr("comfyui_controlnet_aux-main/__init__.py", "")
    zf.writestr("comfyui_controlnet_aux-main/requirements.txt", "opencv-python\n")
zipdata = buf.getvalue()
(portable / "python_embeded").mkdir()
(portable / "python_embeded" / "python.exe").write_bytes(b"")
shutil_which = fp.shutil.which
pip_calls = []
fp.shutil.which = lambda name: None
fp.subprocess.call = lambda args: pip_calls.append(args) or 0
fp.urllib.request.urlopen = lambda req, timeout=0: Resp(zipdata, 200)
try:
    good = fp.install_node(root)
finally:
    fp.urllib.request.urlopen = saved_open
    fp.shutil.which = shutil_which
node = root / "custom_nodes" / "comfyui_controlnet_aux"
ok("沒有 git：下載 zip 解到 custom_nodes/comfyui_controlnet_aux", good and (node / "__init__.py").is_file() and not any(p.name.startswith(".tmp_") for p in (root / "custom_nodes").iterdir()))
ok("套件用 ComfyUI 自己的 python（python_embeded）裝", pip_calls and pip_calls[0][0].endswith("python.exe") and "python_embeded" in pip_calls[0][0] and pip_calls[0][-1].endswith("requirements.txt"), str(pip_calls))

_saved_cf = fp.up.comfy_folders
fp.up.comfy_folders = lambda base, timeout=5: {"custom_nodes": [str(root / "custom_nodes")]}
ok("第一次用、沒有 config.json：問開著的 ComfyUI 它裝在哪", fp.comfy_root({}) == root)
fp.up.comfy_folders = lambda base, timeout=5: {}
ok("沒有 config.json、ComfyUI 也沒開：找不到就不裝", fp.comfy_root({}) is None)
fp.up.comfy_folders = _saved_cf

ok("NO_POSE_FETCH 就什麼都不做", (fp.os.environ.__setitem__("NO_POSE_FETCH", "1") or fp.main(["--check"])) == 0)

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
