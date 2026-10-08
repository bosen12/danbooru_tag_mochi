#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第一次使用的準備工作，一次啟動做完。

以前寫在啟動檔裡：bat 只跑一次，所以 ComfyUI 沒開就全部跳過、卡面下載完要「下次啟動」才烘、
裝完 LoRA Manager 要重開 ComfyUI 再跑一次 bat、兩個 Y/N 卡在黑窗裡網頁還沒開。
現在由伺服器在背景做（伺服器一直開著）：ComfyUI 什麼時候開起來就什麼時候接著做，要問的在網頁上問
（web6/setup-panel.js 讀 /api/setup），要重開 ComfyUI 也是網頁上一顆鈕（透過 ComfyUI-Manager）。

順序：
  cards       卡面插畫（全年齡包，GitHub Release）—— 不用 ComfyUI，一開機就抓
  ── 等 ComfyUI 開起來 ──
  lora        ComfyUI 的 LoRA Manager：沒有就裝，裝完要重開 ComfyUI      （只動這台機器上的 ComfyUI）
  upscale     Hires 放大模型（RealESRGAN_x4plus_anime_6B）                  （同上）
  pose        姿勢參考（ControlNet 節點＋模型，2.5 GB）：先問               （同上）
  bake        卡面下載完，全年齡缺的、提示詞改過的直接烘
  bake_adult  敏感／色情卡面不公開下載：先問（每次啟動缺的時候都問，不記答案）

每一步都是現成的腳本（scripts/fetch_*.py、bake_card_art.py），用同一個 Python 開子程序跑，
輸出最後一行就是畫面上的進度。各自的環境變數（NO_CARD_FETCH…）照樣有效。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPTS = ROOT / "scripts"
LOG = ROOT / "data" / "setup.log"

# 畫面上的名字（web6/locales/en.js 有英文）。
TITLES = {
    "cards": "卡面插畫",
    "lora": "LoRA Manager",
    "upscale": "Hires 放大模型",
    "pose": "姿勢參考",
    "bake": "烘焙卡面",
    "bake_adult": "敏感、色情卡面",
}
ORDER = list(TITLES)

_lock = threading.Lock()
_state: dict = {k: {"state": "idle", "text": ""} for k in ORDER}
_events = {"cards_done": threading.Event()}
_started = False
_comfy_base = None  # callable → str，由 server.py 傳進來
_on_lora_ready = None  # callable，LoRA Manager 載入後清掉 LoRA 清單快取


def _set(key: str, state: str, text: str = "", **extra) -> None:
    with _lock:
        _state[key] = {"state": state, "text": text, **extra}
    _log(f"{key}: {state} {text}")


def _log(line: str) -> None:
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + line + "\n")
    except OSError:
        pass


def snapshot() -> dict:
    """/api/setup：每一項的狀態、要不要重開 ComfyUI、還有沒有事在做。

    state：idle 還沒輪到、wait 等 ComfyUI 開、run 進行中、ask 等你回答、restart 等重開 ComfyUI、
    done 好了、skip 不用做（或做不了，text 說為什麼）、error 失敗（下次啟動再試）。"""
    with _lock:
        items = [{"id": k, "title": TITLES[k], **_state[k]} for k in ORDER]
    restart = any(it["state"] == "restart" for it in items)
    active = any(it["state"] in ("idle", "wait", "run", "ask", "restart") for it in items)
    return {"items": items, "active": active, "restart": restart, "started": _started}


# ---------- 跑腳本 ----------

def _run(key: str, args: list[str], show: bool = True) -> int:
    """開子程序跑 scripts/ 底下的腳本。show：把輸出的最後一行當成畫面上的進度。"""
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8", "CARD_FETCH_STARTED": "1"}
    cmd = [sys.executable, "-u", str(SCRIPTS / args[0]), *args[1:]]
    _log("run " + " ".join(args))
    try:
        proc = subprocess.Popen(cmd, cwd=str(ROOT), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, text=True, encoding="utf-8", errors="replace", bufsize=1)
    except OSError as err:
        _log(f"{key}: cannot start {args[0]}: {err}")
        return 1
    last = ""
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        last = line
        _log(f"{key}> {line}")
        if show and key in _state:
            with _lock:
                _state[key]["text"] = line[-160:]
    code = proc.wait()
    if key in _state:
        with _lock:
            _state[key]["last"] = last[-160:]
    return code


def _check(script: str, *args: str) -> int:
    """腳本的「只看不做」：fetch_* 用 --check，bake_card_art 用 --status。回傳退出碼。"""
    flag = "--status" if script == "bake_card_art.py" else "--check"
    return _run("check", [script, flag, *args], show=False)


# ---------- ComfyUI ----------

def _base() -> str:
    return (_comfy_base() if _comfy_base else "http://127.0.0.1:8188").rstrip("/")


def _get(path: str, timeout: float = 5):
    try:
        with urllib.request.urlopen(urllib.request.Request(_base() + path), timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except Exception:
        return None


def comfy_up() -> bool:
    return _get("/system_stats") is not None


def comfy_local() -> bool:
    host = urllib.parse.urlparse(_base()).hostname or ""
    return host in {"127.0.0.1", "localhost", "::1"}


def lora_manager_running() -> bool:
    data = _get("/api/lm/loras/list?page=1&page_size=1")
    return isinstance(data, dict) and "items" in data


def pose_node_loaded() -> bool:
    info = _get("/object_info/AIO_Preprocessor")
    return bool(info and "AIO_Preprocessor" in info)


def can_restart() -> bool:
    """ComfyUI-Manager 在才重開得了（它有 /manager/reboot）。"""
    return _get("/api/manager/version") is not None


def restart_comfy() -> tuple[bool, str]:
    """請 ComfyUI-Manager 重開 ComfyUI。佇列裡還有東西在畫就不重開。"""
    q = _get("/queue") or {}
    if q.get("queue_running") or q.get("queue_pending"):
        return False, "ComfyUI 還有圖在畫，畫完再重開"
    req = urllib.request.Request(_base() + "/api/manager/reboot", data=b"{}", method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=10).close()
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 404):
            return False, "ComfyUI-Manager 不讓重開（或沒裝）：請自己重開 ComfyUI"
        return False, f"重開失敗（{exc.code}）：請自己重開 ComfyUI"
    except Exception:
        pass  # 重開的時候連線本來就會斷
    _log("restart: asked ComfyUI-Manager to restart ComfyUI")
    return True, ""


# ---------- 各步驟 ----------

def _cards() -> None:
    try:
        if os.environ.get("NO_CARD_FETCH"):
            _set("cards", "skip", "NO_CARD_FETCH")
            return
        if _check("fetch_card_art.py") == 0:
            _set("cards", "done", "")
            return
        _set("cards", "run", "從 GitHub 下載全年齡卡面（約 100 MB）")
        code = _run("cards", ["fetch_card_art.py"])
        if code == 0:
            _set("cards", "done", "下載好了：重新整理網頁就有圖", reload=True)
        else:
            _set("cards", "error", (_state["cards"].get("last") or "下載失敗") + "（下次啟動接著抓）")
    finally:
        _events["cards_done"].set()


def _wait_comfy(keys: list[str]) -> None:
    """ComfyUI 沒開就一直等：開起來的那一刻接著做，不用再跑一次啟動檔。"""
    shown = False
    while not comfy_up():
        if not shown:
            for k in keys:
                _set(k, "wait", "等 ComfyUI 開起來")
            shown = True
        time.sleep(5)


def _lora() -> None:
    if os.environ.get("NO_LORA_MANAGER_FETCH"):
        _set("lora", "skip", "NO_LORA_MANAGER_FETCH")
        return
    if lora_manager_running():
        _set("lora", "done", "")
        return
    if not comfy_local():
        _set("lora", "skip", "ComfyUI 在別台電腦：請在那台裝 LoRA Manager")
        return
    code = _check("fetch_lora_manager.py")
    if code == 3:
        _set("lora", "run", "安裝到 ComfyUI 的 custom_nodes")
        if _run("lora", ["fetch_lora_manager.py"]) != 0:
            _set("lora", "error", _state["lora"].get("last") or "安裝失敗")
            return
        code = 4
    if code == 4:
        _set("lora", "restart", "裝好了，重開 ComfyUI 才會生效")
        _wait_loaded("lora", lora_manager_running)
        return
    _set("lora", "skip", "找不到 ComfyUI 的資料夾")


def _wait_loaded(key: str, loaded) -> None:
    """等 ComfyUI 重開（自己重開或按畫面上的鈕）。載入了就算好。"""
    while not loaded():
        time.sleep(5)
    _set(key, "done", "已載入")
    if key == "lora" and _on_lora_ready:
        _on_lora_ready()


def _upscale() -> None:
    if os.environ.get("NO_UPSCALE_FETCH"):
        _set("upscale", "skip", "NO_UPSCALE_FETCH")
        return
    if _check("fetch_upscale_model.py") != 3:
        _set("upscale", "done", "")
        return
    _set("upscale", "run", "下載到 ComfyUI 的 upscale_models（約 18 MB）")
    code = _run("upscale", ["fetch_upscale_model.py"])
    _set("upscale", "done" if code == 0 else "error", "" if code == 0 else (_state["upscale"].get("last") or "下載失敗"))


def _pose() -> None:
    if os.environ.get("NO_POSE_FETCH") or (ROOT / ".no-pose-fetch").exists():
        _set("pose", "skip", "")
        return
    if _check("fetch_pose_assets.py") != 3:
        _set("pose", "done", "")
        return
    _set("pose", "ask", "選用：ComfyUI 節點＋OpenPose 模型，約 2.5 GB，裝完要重開 ComfyUI", answers=["yes", "no", "never"])


def _pose_install() -> None:
    _set("pose", "run", "安裝節點、下載模型（約 2.5 GB）")
    if _run("pose", ["fetch_pose_assets.py"]) != 0:
        _set("pose", "error", (_state["pose"].get("last") or "安裝失敗") + "（下次啟動接著做）")
        return
    if pose_node_loaded():
        _set("pose", "done", "")
        return
    _set("pose", "restart", "裝好了，重開 ComfyUI 才會生效")
    _wait_loaded("pose", pose_node_loaded)


def _bake() -> None:
    """卡面下載完接著烘：全年齡缺的、提示詞改過的直接烘；敏感／色情的先問。"""
    _events["cards_done"].wait()
    if os.environ.get("NO_CARD_BAKE") or (ROOT / ".no-card-bake").exists():
        _set("bake", "skip", "")
        _set("bake_adult", "skip", "")
        return
    code = _check("bake_card_art.py", "--rating", "general")
    if code == 12:
        _set("bake", "skip", "另一個視窗正在烘")
        _set("bake_adult", "skip", "")
        return
    if code == 10:
        _set("bake", "run", "用你的 ComfyUI 烘還沒有的全年齡卡面")
        rc = _run("bake", ["bake_card_art.py", "--rating", "general"])
        if rc != 0:
            _set("bake", "error", _state["bake"].get("last") or "烘焙失敗")
            _set("bake_adult", "skip", "")
            return
        _set("bake", "done", "烘好了：重新整理網頁就有圖", reload=True)
    else:
        _set("bake", "done", "")
    if _check("bake_card_art.py") == 10:
        _set("bake_adult", "ask", "不在公開下載包裡；用你的底模烘約 600 張，要一小時以上", answers=["yes", "no"])
    else:
        _set("bake_adult", "done", "")


def _bake_adult() -> None:
    _set("bake_adult", "run", "用你的 ComfyUI 烘敏感、色情卡面")
    rc = _run("bake_adult", ["bake_card_art.py"])
    _set("bake_adult", "done" if rc == 0 else "error", "烘好了：重新整理網頁就有圖" if rc == 0 else (_state["bake_adult"].get("last") or "烘焙失敗"), reload=rc == 0)


def _thread(fn, *a) -> None:
    threading.Thread(target=fn, args=a, daemon=True, name="setup-" + fn.__name__).start()


def _main() -> None:
    _thread(_cards)
    comfy_keys = ["lora", "upscale", "pose", "bake", "bake_adult"]
    _wait_comfy(comfy_keys)
    if comfy_local():
        _lora()
        _upscale()
        _pose()
    else:
        for k in ("lora", "upscale", "pose"):
            _set(k, "skip", "ComfyUI 在別台電腦：這台不動它")
    _thread(_bake)


def answer(key: str, value: str) -> tuple[bool, str]:
    """網頁上的回答：pose yes/no/never、bake_adult yes/no、restart。"""
    if key == "restart":
        return restart_comfy()
    with _lock:
        cur = _state.get(key) or {}
    if cur.get("state") != "ask" or value not in (cur.get("answers") or []):
        return False, "現在不用回答這一項"
    if value == "yes":
        _thread(_pose_install if key == "pose" else _bake_adult)
    elif value == "never" and key == "pose":
        try:
            (ROOT / ".no-pose-fetch").write_text("", encoding="utf-8")
        except OSError:
            pass
        _set(key, "skip", "不再問（刪掉 .no-pose-fetch 就會再問）")
    else:
        _set(key, "skip", "這次先不要")
    return True, ""


def start(comfy_base, on_lora_ready=None) -> None:
    """server.py 開機時呼叫一次。NO_SETUP=1 整個關掉（測試、或想全部自己來）。"""
    global _started, _comfy_base, _on_lora_ready
    if _started or os.environ.get("NO_SETUP"):
        return
    _started = True
    _comfy_base = comfy_base
    _on_lora_ready = on_lora_ready
    _log("---- setup start ----")
    _thread(_main)

