#!/usr/bin/env python3
"""setup_tasks.py：第一次使用的準備一次做完。腳本、ComfyUI 都是假的，不下載、不烘、不碰真的 ComfyUI。"""
from __future__ import annotations

import os
import sys
import tempfile
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
for k in ("NO_CARD_FETCH", "NO_LORA_MANAGER_FETCH", "NO_UPSCALE_FETCH", "NO_POSE_FETCH", "NO_CARD_BAKE", "NO_SETUP"):
    os.environ.pop(k, None)
import setup_tasks as st  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


tmp = Path(tempfile.mkdtemp())
st.ROOT = tmp  # .no-pose-fetch／.no-card-bake 寫在這裡，不碰專案
st.LOG = tmp / "setup.log"
st.time.sleep = lambda s: None


def reset(codes: dict, comfy=True, local=True, lm=False, pose_loaded=False) -> list:
    """codes：('fetch_card_art.py','--check') → 退出碼。回傳跑過的指令。"""
    ran = []
    world = {"lm": lm, "pose": pose_loaded}

    def fake_run(key, args, show=True):
        ran.append(tuple(args))
        code = codes.get(tuple(args), 0)
        if args[0] == "fetch_lora_manager.py" and len(args) == 1 and code == 0:
            codes[("fetch_lora_manager.py", "--check")] = 4  # 裝好了，還沒重開
        return code

    st._run = fake_run
    st.comfy_up = lambda: comfy
    st.comfy_local = lambda: local
    st.lora_manager_running = lambda: world["lm"]
    st.pose_node_loaded = lambda: world["pose"]
    st._events["cards_done"] = threading.Event()
    for k in st.ORDER:
        st._state[k] = {"state": "idle", "text": ""}
    reset.world = world
    return ran


def state(k):
    return st._state[k]["state"]


# 1. 第一次：卡面要下載，下載完接著烘全年齡、成人卡面先問。
ran = reset({("fetch_card_art.py", "--check"): 3, ("bake_card_art.py", "--status", "--rating", "general"): 10, ("bake_card_art.py", "--status"): 10})
st._cards()
ok("卡面：缺就下載，好了提示重新整理", state("cards") == "done" and st._state["cards"].get("reload") and ("fetch_card_art.py",) in ran, str(st._state["cards"]))
st._bake()
ok("卡面下載完：全年齡缺的直接烘（同一次啟動）", ("bake_card_art.py", "--rating", "general") in ran and state("bake") == "done", str(ran))
ok("成人卡面：先問，不自己烘", state("bake_adult") == "ask" and ("bake_card_art.py",) not in ran, str(st._state["bake_adult"]))
ok("回答「烘」才烘", st.answer("bake_adult", "yes")[0])
threading.Event().wait(0.2)
ok("烘成人卡面", ("bake_card_art.py",) in ran and state("bake_adult") == "done", str(ran))

# 2. 烘焙要等卡面下載完（不能先烘下載包裡就有的卡）。
ran = reset({("fetch_card_art.py", "--check"): 3})
t = threading.Thread(target=st._bake)
t.start()
t.join(0.3)
ok("下載還沒好：烘焙在等", t.is_alive() and not any(a[0] == "bake_card_art.py" for a in ran), str(ran))
st._events["cards_done"].set()
t.join(2)
ok("下載好了才檢查要不要烘", not t.is_alive() and ("bake_card_art.py", "--status", "--rating", "general") in ran, str(ran))

# 3. LoRA Manager：安裝/修補先問；不妨礙其他準備步驟。
ran = reset({("fetch_lora_manager.py", "--check"): 3})
reloaded = []
st._on_lora_ready = lambda: reloaded.append(1)
def wait_for(predicate):
    for _ in range(200):
        if predicate():
            return True
        threading.Event().wait(0.01)
    return False


t = threading.Thread(target=st._lora, daemon=True)
t.start()
t.join(0.2)
ok("LoRA Manager：沒有先問、不自動裝", state("lora") == "ask" and ("fetch_lora_manager.py",) not in ran, str(st._state["lora"]))
ok("安裝問題不阻擋其餘準備步驟", not t.is_alive())
if state("lora") == "ask":
    ok("回答安裝才裝", st.answer("lora", "yes")[0])
    ok("連按兩次也只接受一次", not st.answer("lora", "yes")[0])
wait_for(lambda: state("lora") == "restart")
ok("裝完：等重開 ComfyUI（畫面上有重開鈕）", state("lora") == "restart" and st.snapshot()["restart"], str(st._state["lora"]))
reset.world["lm"] = True
t.join(2)
wait_for(lambda: state("lora") == "done")
ok("重開後載入了：算好、清掉 LoRA 清單快取", state("lora") == "done" and reloaded == [1], str(st._state["lora"]))

ran = reset({}, lm=True)
st._lora()
ok("已經有補丁：只讀檢查，不改檔", state("lora") == "done" and ran == [("fetch_lora_manager.py", "--check-patch")], str(ran))
ran = reset({("fetch_lora_manager.py", "--check-patch"): 3}, lm=True)
st._lora()
ok("第三方檔需要補：先問，不自動修補", state("lora") == "ask" and ("fetch_lora_manager.py", "--patch") not in ran, str(ran))
if state("lora") == "ask":
    st.answer("lora", "no")
ok("略過修補：不改檔", state("lora") == "skip" and ("fetch_lora_manager.py", "--patch") not in ran, str(ran))
ran = reset({("fetch_lora_manager.py", "--check-patch"): 3}, lm=True)
st._lora()
if state("lora") == "ask":
    st.answer("lora", "yes")
    wait_for(lambda: state("lora") == "done")
ok("同意修補：只補 JS，不安裝也不重開", state("lora") == "done" and ("fetch_lora_manager.py", "--patch") in ran and ("fetch_lora_manager.py",) not in ran, str(ran))
ran = reset({("fetch_lora_manager.py", "--check-patch"): 3, ("fetch_lora_manager.py", "--patch"): 1}, lm=True)
st._lora()
st.answer("lora", "yes")
wait_for(lambda: state("lora") == "error")
ok("修補失敗：顯示錯誤，不假報已完成", state("lora") == "error", str(st._state["lora"]))
ran = reset({("fetch_lora_manager.py", "--check"): 3})
t = threading.Thread(target=st._lora, daemon=True)
t.start()
t.join(0.2)
if state("lora") == "ask":
    st.answer("lora", "never")
else:
    reset.world["lm"] = True
    t.join(2)
ok("LoRA 不要再問：寫本機記號", (tmp / ".no-lora-manager-fetch").exists())
ran = reset({("fetch_lora_manager.py", "--check"): 3})
t = threading.Thread(target=st._lora, daemon=True)
t.start()
t.join(0.2)
ok("LoRA 有略過記號：不安裝也不問", state("lora") == "skip" and ran == [], str(ran))
reset.world["lm"] = True
t.join(2)
if (tmp / ".no-lora-manager-fetch").exists():
    (tmp / ".no-lora-manager-fetch").unlink()
ran = reset({}, local=False)
st._lora()
ok("ComfyUI 在別台：不裝", state("lora") == "skip" and ran == [], str(ran))

# 4. 姿勢參考：先問；never 寫記號、下次不問。
ran = reset({("fetch_pose_assets.py", "--check"): 3})
st._pose()
ok("姿勢參考：先問", state("pose") == "ask" and ("fetch_pose_assets.py",) not in ran)
ok("回答不在選項裡：不接受", not st.answer("pose", "maybe")[0])
st.answer("pose", "never")
ok("不要再問：寫 .no-pose-fetch", state("pose") == "skip" and (tmp / ".no-pose-fetch").exists())
ran = reset({("fetch_pose_assets.py", "--check"): 3})
st._pose()
ok("有 .no-pose-fetch：不問", state("pose") == "skip" and ran == [], str(ran))
(tmp / ".no-pose-fetch").unlink()
ran = reset({("fetch_pose_assets.py", "--check"): 3})
st._pose()
st.answer("pose", "yes")
threading.Event().wait(0.2)
ok("回答安裝：裝完沒載入就等重開", ("fetch_pose_assets.py",) in ran and state("pose") == "restart", str(st._state["pose"]))
reset.world["pose"] = True
threading.Event().wait(0.2)
ok("重開後載入了：算好", state("pose") == "done")

# 5. ComfyUI 沒開：不跳過，等它開（同一次啟動接著做）。
ran = reset({})
st.comfy_up = lambda: False
calls = {"n": 0}


def comes_up():
    calls["n"] += 1
    return calls["n"] > 2


st.comfy_up = comes_up
st._wait_comfy(["lora", "pose"])
ok("ComfyUI 沒開：顯示在等，開了就往下", state("lora") == "wait" and calls["n"] == 3, str(calls))

# 6. 不用做的事都不出現在畫面上：active=False。
ran = reset({}, lm=True)
for k in st.ORDER:
    st._set(k, "done", "")
snap = st.snapshot()
ok("全部好了：沒有進行中的事", not snap["active"] and not snap["restart"], str(snap))

# 8. 烘幾百張卡面、下載 2.5 GB 可以停：子程序收到 terminate，已經做好的留著，狀態寫「停了」。
ran = reset({})
st._stopped.clear()
ok("沒在跑的不能停", st.answer("bake_adult", "stop")[0] is False)
class _FakeProc:
    terminated = False
    def poll(self):
        return None
    def terminate(self):
        _FakeProc.terminated = True
st._procs["bake_adult"] = _FakeProc()
ok("跑著的可以停", st.answer("bake_adult", "stop")[0] and _FakeProc.terminated)
st._procs.clear()
st._stopped.clear()
st._run = lambda key, args, show=True: (st._stopped.add(key), 1)[1]  # 跑到一半被按了停止
st._bake_adult()
ok("停了：不算失敗，提示重新整理看已烘好的", state("bake_adult") == "skip" and st._state["bake_adult"].get("reload"), str(st._state["bake_adult"]))
st._stopped.clear()

# 9. 角色卡面：每次啟動都看；缺得少直接烘，缺得多先問；不要再問寫記號。
def chars_world(missing):
    ran = reset({})
    def fake(key, args, show=True):
        ran.append(tuple(args))
        if args[:3] == ["bake_card_art.py", "--status", "--kind"]:
            st._last_check[0] = f"character art: 0/430 ready, {missing} missing; ComfyUI is running" if missing else "character art: 430/430 ready"
            return 10 if missing else 0
        return 0
    st._run = fake
    return ran
ran = chars_world(5)
st._chars()
ok("角色卡面缺 5 張：直接烘，不問", ("bake_card_art.py", "--kind", "character") in ran and state("bake_chars") == "done", str(ran))
ran = chars_world(430)
st._chars()
ok("角色卡面缺 430 張：先問，寫出張數和時間", state("bake_chars") == "ask" and "430 張" in st._state["bake_chars"]["text"]
   and ("bake_card_art.py", "--kind", "character") not in ran, str(st._state["bake_chars"]))
ok("回答「烘」才烘", st.answer("bake_chars", "yes")[0])
threading.Event().wait(0.2)
ok("烘角色卡面", ("bake_card_art.py", "--kind", "character") in ran and state("bake_chars") == "done", str(ran))
ran = chars_world(430)
st._chars()
st.answer("bake_chars", "never")
ok("不要再問：寫 .no-character-bake", state("bake_chars") == "skip" and (tmp / ".no-character-bake").exists())
ran = chars_world(430)
st._chars()
ok("有 .no-character-bake：不檢查也不問", state("bake_chars") == "skip" and ran == [], str(ran))
(tmp / ".no-character-bake").unlink()
ran = chars_world(0)
st._chars()
ok("角色卡面都有了：算好", state("bake_chars") == "done" and ("bake_card_art.py", "--kind", "character") not in ran, str(ran))

# 10. 要下載卡面時先說缺什麼、缺幾張。
cm = st.cards_missing_text
ok("缺卡面：寫張數和例子", cm("card art check: 12 missing, 3 outdated; e.g. red hair | rain").startswith("偵測到缺 12 張全年齡卡面、3 張是舊版（例："), cm("card art check: 12 missing, 3 outdated; e.g. red hair | rain"))
ok("只有舊版：不寫缺 0 張", cm("card art check: 0 missing, 4 outdated; e.g. rain").startswith("偵測到4 張是舊版"), cm("card art check: 0 missing, 4 outdated; e.g. rain"))
ok("認不得的行：不加說明", cm("garbage") == "")

# 7. 腳本印給終端機的英文不上畫面：進度換成中文（英文版再由 en.js 翻），其他行不顯示。
pt = st.progress_text
ok("下載進度換成中文", pt("45%   12.3/100.0 MB  2.31 MB/s") == "下載中 45%（12.3/100.0 MB）", pt("45%   12.3/100.0 MB"))
ok("烘焙進度換成中文", pt("[3/60] ok   red_hair  4.1s") == "烘焙中 3/60")
ok("認不得的英文不顯示", pt("Card illustrations are missing. Downloading ...") == "")

print()
print("ok" if not failed else f"{failed} failed")
sys.exit(1 if failed else 0)
