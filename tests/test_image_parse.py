#!/usr/bin/env python3
"""image_parse.py（解析池）：設定清理、工作流、讀結果、清上傳檔。ComfyUI 是假的，不碰真的。"""
from __future__ import annotations

import base64
import os
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import image_parse as ip  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


# ---- 設定 ----
d = ip.clean_settings(None)
ok("沒給設定就用預設（vit v3、0.35、0.85）", d == {**ip.DEFAULTS}, str(d))
d = ip.clean_settings({"model": "wd-swinv2-tagger-v3.onnx", "threshold": "0.5", "characterThreshold": 3, "exclude": "a_b，c\n d ,, "})
ok("模型拿掉 .onnx、門檻夾在範圍內、排除字整理成逗號分隔", d == {"model": "wd-swinv2-tagger-v3", "threshold": 0.5, "characterThreshold": 1.0, "exclude": "a_b, c, d"}, str(d))
d = ip.clean_settings({"model": "../../evil", "threshold": float("nan"), "characterThreshold": -1})
ok("怪模型名、NaN 不收（回預設），角色門檻夾到 0.05", d["model"] == ip.DEFAULTS["model"] and d["threshold"] == ip.DEFAULTS["threshold"] and d["characterThreshold"] == 0.05, str(d))

# ---- 工作流 ----
s = ip.clean_settings({"threshold": 0.35, "exclude": "Simple Background"})
wf = ip.build_workflow("danbooru_parse/parse_x.png", s)
taggers = [n for n in wf.values() if n["class_type"] == ip.TAGGER]
ok("兩層門檻：最低信心＋確定（0.7）", [n["inputs"]["threshold"] for n in taggers] == [0.35, ip.SURE], str(taggers))
ok("只有 LoadImage 和 Tagger（不生圖、不存檔）", {n["class_type"] for n in wf.values()} == {"LoadImage", ip.TAGGER})
ok("排除字底線、空格、小寫都放進去", taggers[0]["inputs"]["exclude_tags"] == "simple background,simple_background", taggers[0]["inputs"]["exclude_tags"])
ok("最低信心已經 ≥ 確定門檻：只跑一層", ip.tiers(ip.clean_settings({"threshold": 0.8})) == [0.8])

# ---- 讀結果 ----
entry = {
    "status": {"status_str": "success"},
    "outputs": {
        "10": {"tags": ["1girl, solo, yae_miko_\\(fox\\), long_hair, ^_^, solo"]},
        "11": {"tags": ["1girl, yae_miko_\\(fox\\)"]},
    },
}
got = ip.read_outputs(entry, s)
ok("照最低一層的順序、去重、括號還原、底線留著；確定那層有的標 sure",
   got == [{"tag": "1girl", "sure": True}, {"tag": "solo", "sure": False}, {"tag": "yae_miko_(fox)", "sure": True}, {"tag": "long_hair", "sure": False}, {"tag": "^_^", "sure": False}], str(got))
ok("什麼都沒認出來（成功但空白）：空清單", ip.read_outputs({"status": {"status_str": "success"}, "outputs": {"10": {"tags": [""]}, "11": {"tags": [""]}}}, s) == [])
try:
    ip.read_outputs({"status": {"status_str": "error", "messages": [["execution_error", {"exception_message": "model not found"}]]}, "outputs": {}}, s)
    ok("Tagger 出錯要報錯", False)
except ip.ParseError as exc:
    ok("Tagger 出錯：把 ComfyUI 的錯誤原因帶出來", "model not found" in str(exc) and exc.code == "tagger_failed", str(exc))

# ---- 圖 ----
png = base64.b64encode(b"\x89PNG fake").decode()
data, ext = ip.decode_image("data:image/png;base64," + png)
ok("data URL 解得開", data == b"\x89PNG fake" and ext == "png")
for bad in ("", "data:image/gif;base64,AAAA", "data:text/plain;base64,AAAA"):
    try:
        ip.decode_image(bad)
        ok(f"不收 {bad[:20]!r}", False)
    except ip.ParseError:
        ok(f"不收 {bad[:20]!r}", True)
try:
    ip.decode_image("data:image/jpeg;base64," + base64.b64encode(b"x" * (ip.MAX_BYTES + 1)).decode())
    ok("太大要擋", False)
except ip.ParseError as exc:
    ok("太大要擋（伺服器收 JSON 的上限 5MB 之內）", "太大" in str(exc) and ip.MAX_BYTES * 4 / 3 < 5 * 1024 * 1024)
ok("檔名是內容雜湊（同一張圖重丟蓋同一個檔）", ip.file_name(b"abc", "png") == ip.file_name(b"abc", "png") and ip.NAME_RE.match(ip.file_name(b"abc", "png")))

# ---- 模型清單 ----
info = {ip.TAGGER: {"input": {"required": {"model": [["wd-vit-tagger-v3", "wd-eva02-large-tagger-v3"], {"default": "x"}]}}}}
ok("object_info 讀得出模型", ip.models_from(info) == ["wd-vit-tagger-v3", "wd-eva02-large-tagger-v3"])
ok("沒裝 Tagger：空清單", ip.models_from({}) == [] and ip.models_from(None) == [])

# ---- 整段流程（假的 ComfyUI）----
calls = []


def upload(data, name, mime):
    calls.append(("upload", name, mime))
    return f"{ip.SUBFOLDER}/{name}"


def queue(wf):
    calls.append(("queue", wf))
    return "pid-1"


def wait(pid):
    calls.append(("wait", pid))
    return entry


def forget(pid):
    calls.append(("forget", pid))


def prune(protect):
    calls.append(("prune", sorted(protect)))


out = ip.parse({"image": "data:image/jpeg;base64," + png, "settings": {"threshold": 0.35}}, upload=upload, queue=queue, wait=wait, forget=forget, prune=prune)
kinds = [c[0] for c in calls]
ok("上傳 → 排隊 → 等 → 刪歷史 → 清舊檔", kinds == ["upload", "queue", "wait", "forget", "prune"], str(kinds))
ok("jpg 上傳用 image/jpeg", calls[0][2] == "image/jpeg")
ok("工作流指著剛上傳的那張", calls[1][1]["1"]["inputs"]["image"] == f"{ip.SUBFOLDER}/{calls[0][1]}")
ok("清舊檔時保護剛上傳的那張", calls[4][1] == [calls[0][1]])
ok("回傳字、清過的設定、門檻", out["tags"][0] == {"tag": "1girl", "sure": True} and out["settings"]["model"] == ip.DEFAULTS["model"] and out["tiers"] == [0.35, ip.SURE])

calls.clear()


def wait_boom(pid):
    raise TimeoutError(pid)


try:
    ip.parse({"image": "data:image/png;base64," + png}, upload=upload, queue=queue, wait=wait_boom, forget=forget)
    ok("等不到要報錯", False)
except TimeoutError:
    ok("等不到也要刪掉這一筆歷史", ("forget", "pid-1") in calls, str(calls))

# ---- 清上傳檔 ----
tmp = Path(tempfile.mkdtemp())
names = [f"parse_{i:016x}.png" for i in range(5)]
for i, n in enumerate(names):
    p = tmp / n
    p.write_bytes(b"x")
    os.utime(p, (time.time() - 100 + i, time.time() - 100 + i))
(tmp / "someone_else.png").write_bytes(b"x")
gone = ip.prune_inputs(tmp, keep=2, protect={names[0]})
left = sorted(p.name for p in tmp.iterdir())
ok("只留最新的幾張＋保護的那張；別人的檔不動", sorted(gone) == names[1:3] and left == sorted([names[0], names[3], names[4], "someone_else.png"]), f"gone={gone} left={left}")

print("全部通過" if not failed else f"{failed} 項失敗")
sys.exit(1 if failed else 0)
