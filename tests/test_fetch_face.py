#!/usr/bin/env python3
"""fetch_face_detailer.py：缺什麼、裝哪裡、下載續傳與檢查碼。不碰真的 ComfyUI、不真的下載。"""
from __future__ import annotations

import hashlib
import io
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_face_detailer as ff  # noqa: E402

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
pose = ff.pose
saved_get = pose.comfy_get

# ComfyUI 沒開：看資料夾。
pose.comfy_get = lambda base, path, timeout=8: None
st = ff.status(config)
ok("都沒有：兩個節點、偵測模型都缺", not any(st["nodes"].values()) and not st["model"] and not st["comfy_up"], str(st))
for name in ("ComfyUI-Impact-Pack", "comfyui-impact-subpack"):
    (root / "custom_nodes" / name).mkdir()
    (root / "custom_nodes" / name / "__init__.py").write_text("")
(root / "models" / "ultralytics" / "bbox").mkdir(parents=True)
(root / "models" / "ultralytics" / "bbox" / "face_yolov8n.pt").write_bytes(b"x")
st = ff.status(config)
ok("資料夾裡有就算有（大小寫不同的資料夾名、任何 face 偵測模型都行）", all(st["nodes"].values()) and st["model"], str(st))
(root / "custom_nodes" / "comfyui-impact-subpack").rename(root / "custom_nodes" / "comfyui-impact-subpack.disabled")
ok("停用的節點不算", ff.status(config)["nodes"]["comfyui-impact-subpack"] is False)
(root / "custom_nodes" / "comfyui-impact-subpack.disabled").rename(root / "custom_nodes" / "comfyui-impact-subpack")
(root / "models" / "ultralytics" / "bbox" / "face_yolov8n.pt").unlink()
(root / "models" / "ultralytics" / "bbox" / "hand_yolov8s.pt").write_bytes(b"x")
ok("只有手的偵測模型不算", ff.status(config)["model"] is False)


# ComfyUI 開著：問它（新版下拉選單格式）。
def comfy(objects):
    def get(base, path, timeout=8):
        if path == "/system_stats":
            return {"system": {}}
        cls = path.rsplit("/", 1)[-1]
        return {cls: objects[cls]} if cls in objects else {}
    return get


det = {"input": {"required": {"model_name": ["COMBO", {"options": ["bbox/hand_yolov8s.pt", "bbox/face_yolov8m.pt"]}]}}}
pose.comfy_get = comfy({"FaceDetailer": {}, "UltralyticsDetectorProvider": det})
st = ff.status(config)
ok("ComfyUI 開著就問它：載入了、清單裡有 bbox/face", all(st["nodes"].values()) and st["model"] and st["comfy_up"], str(st))
old = {"input": {"required": {"model_name": [["segm/face_yolov8m-seg.pt", "bbox/hand_yolov8s.pt"]]}}}
pose.comfy_get = comfy({"FaceDetailer": {}, "UltralyticsDetectorProvider": old})
ok("舊版清單格式也讀得懂；分割模型、手的不算", ff.status(config)["model"] is False)
pose.comfy_get = comfy({})
ok("裝了還沒重開：ComfyUI 說沒有，資料夾有就算裝好（只差重開）", all(ff.status(config)["nodes"].values()))
pose.comfy_get = saved_get

# 下載：續傳＋檢查碼（假的伺服器）
payload = b"face-model-bytes" * 1000
ff.MODEL_SIZE = len(payload)
ff.MODEL_SHA256 = hashlib.sha256(payload).hexdigest()


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


saved_open = ff.urllib.request.urlopen
saved_sleep = ff.time.sleep
ff.urllib.request.urlopen = fake_urlopen
ff.time.sleep = lambda s: None
try:
    good = ff.download_model(root)
finally:
    ff.urllib.request.urlopen = saved_open
dest = root / "models" / "ultralytics" / "bbox" / ff.MODEL_NAME
ok("斷線之後從斷的地方接著下載（Range）", calls[1] == "bytes=5000-", str(calls))
ok("放進 models/ultralytics/bbox，檢查大小和 sha256 才改名", good and dest.read_bytes() == payload and not dest.with_name(dest.name + ".part").exists())
ok("放好的檔伺服器挑得到", ff.model_on_disk(root) and ff.is_face_model("bbox/" + ff.MODEL_NAME))
dest.unlink()
ff.urllib.request.urlopen = lambda req, timeout=0: Resp(b"x" * ff.MODEL_SIZE, 200)
try:
    good = ff.download_model(root)
finally:
    ff.urllib.request.urlopen = saved_open
    ff.time.sleep = saved_sleep
ok("檢查碼不對就不放（也不留壞檔）", not good and not dest.exists() and not dest.with_name(dest.name + ".part").exists())

# 節點：沒有 git 走 zip；git+ 的套件（Impact Pack 選用的 sam2）沒 git 裝不了，拿掉再裝。
for name in ("ComfyUI-Impact-Pack", "comfyui-impact-subpack"):
    for p in (root / "custom_nodes" / name).iterdir():
        p.unlink()
    (root / "custom_nodes" / name).rmdir()
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as zf:
    zf.writestr("ComfyUI-Impact-Pack-Main/__init__.py", "")
    zf.writestr("ComfyUI-Impact-Pack-Main/requirements.txt", "scipy\ngit+https://github.com/facebookresearch/sam2\nnumpy\n")
zipdata = buf.getvalue()
(portable / "python_embeded").mkdir()
(portable / "python_embeded" / "python.exe").write_bytes(b"")
saved_which, saved_call = pose.shutil.which, pose.subprocess.call
pip_reqs = []
pose.shutil.which = lambda name: None
pose.subprocess.call = lambda args: pip_reqs.append(Path(args[-1]).read_text(encoding="utf-8")) or 0
pose.urllib.request.urlopen = lambda req, timeout=0: Resp(zipdata, 200)
try:
    good = pose.install_custom_node(root, ff.NODES[0][0], ff.NODES[0][1], ff.NODES[0][2], "impact")
finally:
    pose.urllib.request.urlopen = saved_open
    pose.shutil.which, pose.subprocess.call = saved_which, saved_call
node = root / "custom_nodes" / "comfyui-impact-pack"
ok("沒有 git：zip 解到 ComfyUI-Manager 用的資料夾名", good and (node / "__init__.py").is_file())
ok("沒有 git：pip 不裝 git+ 那行，其他照裝", pip_reqs and "git+" not in pip_reqs[0] and "scipy" in pip_reqs[0] and "numpy" in pip_reqs[0], str(pip_reqs))

ok("zip 的分支名對得上（Impact Pack 是 Main）", ff.NODES[0][2].endswith("/Main.zip") and ff.NODES[1][2].endswith("/main.zip"))
ok("NO_FACE_FETCH 就什麼都不做", (ff.os.environ.__setitem__("NO_FACE_FETCH", "1") or ff.main(["--check"])) == 0)
ff.os.environ.pop("NO_FACE_FETCH", None)
ok("ComfyUI 在別台：不管", (setattr(ff.up, "load_config", lambda: {"comfy": {"api": "http://100.64.0.2:8188"}}) or ff.main(["--check"])) == 0)

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
