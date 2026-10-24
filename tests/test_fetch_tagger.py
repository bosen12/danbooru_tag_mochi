#!/usr/bin/env python3
"""fetch_tagger.py（解析池的 WD14 Tagger）：缺什麼、模型放哪裡。不碰真的 ComfyUI、不真的下載。"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_tagger as ft  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


tmp = Path(tempfile.mkdtemp())
root = tmp / "ComfyUI_windows_portable" / "ComfyUI"
(root / "models" / "checkpoints" / "ill").mkdir(parents=True)
(root / "custom_nodes").mkdir()
config = {"comfy": {"api": "http://127.0.0.1:1", "checkpointDir": str(root / "models" / "checkpoints" / "ill")}}
pose = ft.pose
saved_get = pose.comfy_get

# ComfyUI 沒開：看資料夾。
pose.comfy_get = lambda base, path, timeout=8: None
st = ft.status(config)
ok("都沒有：節點、模型都缺", not st["node"] and not st["model"] and not st["comfy_up"], str(st))

node = root / "custom_nodes" / "ComfyUI-WD14-Tagger"
(node / "models").mkdir(parents=True)
(node / "__init__.py").write_text("", encoding="utf-8")
st = ft.status(config)
ok("手動 clone 的大寫資料夾也算裝了節點", st["node"] and not st["model"], str(st))
(node / "models" / "wd-vit-tagger-v3.onnx").write_bytes(b"x")
ok("只有 onnx 沒有 csv：模型不算有", not ft.status(config)["model"])
(node / "models" / "wd-vit-tagger-v3.csv").write_bytes(b"x")
ok("onnx＋csv 都在：模型有了", ft.status(config)["model"])

# extra_model_paths 設了 models/wd14_tagger 的人：放那裡也算。
for p in (node / "models").iterdir():
    p.unlink()
(root / "models" / "wd14_tagger").mkdir()
for ext in ("onnx", "csv"):
    (root / "models" / "wd14_tagger" / f"wd-vit-tagger-v3.{ext}").write_bytes(b"x")
ok("models/wd14_tagger 裡的也算", ft.status(config)["model"])

# ComfyUI 開著、節點已載入（資料夾找不到也算）。
(node / "__init__.py").unlink()
pose.comfy_get = lambda base, path, timeout=8: ({"ok": 1} if path == "/system_stats" else {ft.NODE_CLASS: {}} if "WD14Tagger" in path else None)
st = ft.status(config)
ok("ComfyUI 說節點載入了：算裝了", st["node"] and st["comfy_up"], str(st))
ok("問 ComfyUI 時節點名稱的 | 要轉碼", "%7C" in ("/object_info/" + ft.NODE_CLASS.replace("|", "%7C")))

# --check 的退出碼：缺東西 3；面板照那一行決定問法。
pose.comfy_get = lambda base, path, timeout=8: None
ft.up.load_config = lambda: config
for p in (root / "models" / "wd14_tagger").iterdir():
    p.unlink()
(node / "__init__.py").write_text("", encoding="utf-8")
import contextlib, io  # noqa: E402,E401

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    code = ft.main(["--check"])
ok("只缺模型：--check 回 3、寫 node ok, model missing", code == 3 and "node ok, model missing" in buf.getvalue(), f"{code} {buf.getvalue()!r}")
for ext in ("onnx", "csv"):
    (node / "models" / f"wd-vit-tagger-v3.{ext}").write_bytes(b"x")
with contextlib.redirect_stdout(io.StringIO()):
    code = ft.main(["--check"])
ok("都在：--check 回 0", code == 0)

# 下載：照 Hugging Face 的檔名抓、存成節點讀的名字，大小＋sha256 都對才收。
for p in (node / "models").iterdir():
    p.unlink()
calls = []
saved_dl = ft.face._download
ft.face._download = lambda url, folder, name, size, sha, label: calls.append((url, folder, name, size, sha)) or True
ok("下載成功", ft.download_model(root))
ok("model.onnx → wd-vit-tagger-v3.onnx、selected_tags.csv → .csv，放在節點的 models",
   [(c[0].rsplit("/", 1)[-1], c[2]) for c in calls] == [("model.onnx", "wd-vit-tagger-v3.onnx"), ("selected_tags.csv", "wd-vit-tagger-v3.csv")] and all(c[1] == node / "models" for c in calls), str(calls))
ok("每個檔都有大小和 sha256", all(c[3] > 0 and len(c[4]) == 64 for c in calls))
ft.face._download = saved_dl

pose.comfy_get = saved_get
print("全部通過" if not failed else f"{failed} 項失敗")
sys.exit(1 if failed else 0)
