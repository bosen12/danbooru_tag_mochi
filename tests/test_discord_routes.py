#!/usr/bin/env python3
"""Discord 分頻道送圖（discord_routes.py＋server.py 的分流、送出、暫停）。不連 Discord、不連 ComfyUI。失敗會印 FAIL 並 exit 1。"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# 跟 test_server.py 一樣：輸出清理、出圖日誌、偏好設定都導去暫存目錄，碰不到真的資料。
os.environ["NO_OUTPUT_PRUNE"] = "1"
os.environ["GEN_LOG_PATH"] = str(Path(tempfile.mkdtemp()) / "gen_log.jsonl")
os.environ["APP_SETTINGS"] = str(Path(tempfile.mkdtemp()) / "settings.json")
os.environ["THUMB_CACHE_DIR"] = str(Path(tempfile.mkdtemp()) / "thumb-cache")

import discord_routes as dr  # noqa: E402
import server  # noqa: E402

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


# --- 拆提示詞 ---------------------------------------------------------------
tags = dr.tags_of("masterpiece, (frieren:1.2), fern \\(sousou no frieren\\), Long_Hair, <lora:abc:0.8>,  , smile")
ok("權重括號拿掉", "frieren" in tags, str(tags))
ok("跳脫括號還原", "fern (sousou no frieren)" in tags, str(tags))
ok("大寫、底線正規化", "long hair" in tags, str(tags))
ok("LoRA 那段不算", not any("lora" in t for t in tags), str(tags))
ok("空段略過", "" not in tags)


def route(**kw):
    base = {"id": "r1", "name": "x", "webhook": "h", "ratings": [], "chars": [], "charMode": "any",
            "tags": [], "tagMode": "any", "compact": False, "enabled": True, "paused": False}
    base.update(kw)
    return base


img = dr.tags_of("frieren, fern (sousou no frieren), swimsuit, beach")
# --- 比對 -------------------------------------------------------------------
ok("分級不限就過", dr.route_matches(route(chars=["frieren"]), img, "explicit"))
ok("分級對上", dr.route_matches(route(ratings=["general", "sensitive"]), img, "sensitive"))
ok("分級對不上", not dr.route_matches(route(ratings=["general"]), img, "explicit"))
ok("沒分級當全年齡", dr.route_matches(route(ratings=["general"]), img, ""))
ok("角色任一個", dr.route_matches(route(chars=["frieren", "himmel"]), img, "general"))
ok("角色全部都要（缺一個）", not dr.route_matches(route(chars=["frieren", "himmel"], charMode="all"), img, "general"))
ok("角色全部都要（都在）", dr.route_matches(route(chars=["frieren", "fern (sousou no frieren)"], charMode="all"), img, "general"))
ok("tag 任一個", dr.route_matches(route(tags=["bikini", "swimsuit"]), img, "general"))
ok("tag 全部都要", not dr.route_matches(route(tags=["bikini", "swimsuit"], tagMode="all"), img, "general"))
ok("三種條件都要符合", not dr.route_matches(route(ratings=["general"], chars=["frieren"], tags=["bikini"]), img, "general"))
ok("停用不送", not dr.route_matches(route(chars=["frieren"], enabled=False), img, "general"))
ok("暫停不送", not dr.route_matches(route(chars=["frieren"], paused=True), img, "general"))

routes = [route(id="a", chars=["frieren"]), route(id="b", ratings=["general"]), route(id="c", chars=["himmel"])]
ok("符合的都送、照清單順序", dr.targets_for(routes, "frieren, smile", "general", True) == ["a", "b"])
ok("都不符合送其他", dr.targets_for(routes, "himmel2", "explicit", True) == ["other"])
ok("其他沒設就不送", dr.targets_for(routes, "himmel2", "explicit", False) == [])
ok("沒有頻道＝跟以前一樣送其他", dr.targets_for([], "anything", "general", True) == ["other"])

# --- 整個系列 ---------------------------------------------------------------
series_of = {"yor briar": "spy x family", "anya (spy x family)": "spy x family", "frieren": "sousou no frieren"}
spy = dr.tags_of("1girl, yor briar, smile")
seen = dr.series_in(spy, series_of)
ok("系列：角色換成系列", "spy x family" in seen, str(seen))
ok("系列：有這個系列的角色就算", dr.route_matches(route(series=["spy x family"]), spy, "general", seen))
ok("系列：沒有就不算", not dr.route_matches(route(series=["sousou no frieren"]), spy, "general", seen))
ok("系列：提示詞直接寫系列名也算", dr.route_matches(route(series=["spy x family"]), dr.tags_of("spy x family, 1girl"), "general", dr.series_in(dr.tags_of("spy x family, 1girl"), {})))
ok("系列＋角色任一個", dr.route_matches(route(chars=["himmel"], series=["spy x family"]), spy, "general", seen))
ok("系列＋角色全部都要（缺角色）", not dr.route_matches(route(chars=["himmel"], series=["spy x family"], charMode="all"), spy, "general", seen))
both = dr.tags_of("yor briar, frieren")
ok("兩個系列全部都要", dr.route_matches(route(series=["spy x family", "sousou no frieren"], charMode="all"), both, "general", dr.series_in(both, series_of)))
ok("targets_for 用系列對照", dr.targets_for([route(id="s", series=["spy x family"])], "yor briar", "general", True, series_of) == ["s"])
ok("沒給對照表時照舊（只認提示詞）", dr.targets_for([route(id="s", series=["spy x family"])], "yor briar", "general", True) == ["other"])

# --- 存檔檢查 ---------------------------------------------------------------
HOOK = "https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz"
HOOK2 = "https://discord.com/api/webhooks/2222222222/zyxwvutsrqponmlkjihgfedcba"


def bad(raw, old=None) -> str:
    try:
        dr.clean_route(raw, old, server.dc_webhook_ok)
        return ""
    except ValueError as exc:
        return str(exc)


good = dr.clean_route({"name": "芙莉蓮", "webhook": HOOK, "chars": ["Frieren"], "ratings": ["general"]}, None, server.dc_webhook_ok)
ok("存檔：產生 id", good["id"].startswith("r_"))
ok("存檔：角色正規化", good["chars"] == ["frieren"])
ok("存檔：沒名字擋下", "名字" in bad({"webhook": HOOK, "chars": ["a"]}))
ok("存檔：名字太長擋下", "最多" in bad({"name": "x" * 41, "webhook": HOOK, "chars": ["a"]}))
ok("存檔：新增沒網址擋下", "webhook" in bad({"name": "x", "chars": ["a"]}))
ok("存檔：別人的網域擋下", bad({"name": "x", "webhook": HOOK.replace("discord.com", "evil.example"), "chars": ["a"]}) != "")
ok("存檔：角色超過 3 個擋下", "最多 3" in bad({"name": "x", "webhook": HOOK, "chars": ["a", "b", "c", "d"]}))
ok("存檔：tag 超過 5 個擋下", "最多 5" in bad({"name": "x", "webhook": HOOK, "tags": list("abcdef")}))
ok("存檔：沒有條件擋下", "至少" in bad({"name": "x", "webhook": HOOK}))
ok("存檔：只有系列也算條件", bad({"name": "x", "webhook": HOOK, "series": ["spy x family"]}) == "")
ok("存檔：角色＋系列合起來超過 3 個擋下", "合起來最多 3" in bad({"name": "x", "webhook": HOOK, "chars": ["a", "b"], "series": ["c", "d"]}))
ok("存檔：系列正規化", dr.clean_route({"name": "x", "webhook": HOOK, "series": ["Spy_X_Family"]}, None, server.dc_webhook_ok)["series"] == ["spy x family"])
ok("存檔：分級亂填擋下", bad({"name": "x", "webhook": HOOK, "ratings": ["nsfw"]}) != "")
kept = dr.clean_route({"name": "改名", "chars": ["frieren"]}, good, server.dc_webhook_ok)
ok("編輯：網址留空沿用、id 不變", kept["webhook"] == HOOK and kept["id"] == good["id"])
ok("讀檔：壞資料略過", len(dr.load_routes([good, {"id": ""}, "x", {**good}])) == 1)
ok("讀檔：不是清單＝沒有頻道", dr.load_routes(None) == [])

# --- 伺服器：角色 → 系列對照從詞庫來 --------------------------------------
real = server.dc_series_of()
ok("詞庫的角色對到系列", real.get("yor briar") == "spy x family", str(real.get("yor briar")))
ok("對照表夠大（每個角色都有）", len(real) > 500, str(len(real)))

# --- 伺服器：分流、送出、暫停 ----------------------------------------------
server.DC_SECRETS = Path(tempfile.mkdtemp()) / ".secrets" / "discord.json"
backup = dict(server._dc)
sent: "list[tuple[str, dict]]" = []
fetches = []
fail_targets: "set[str]" = set()


def fake_fetch(job):
    fetches.append(job.get("filename"))
    return b"\x89PNG", "image/png", "shot.png"


def fake_call(body, ctype, timeout=60, target=dr.OTHER):
    if target in fail_targets:
        raise RuntimeError(f"404 Unknown Webhook {HOOK2}")
    payload = {}
    if b"payload_json" in body:
        start = body.index(b"{")
        end = body.index(b"\r\n", start)
        payload = json.loads(body[start:end].decode("utf-8"))
    sent.append((target, payload))
    return {}


real_fetch, real_call, real_gap = server.dc_fetch_image, server.dc_call, server.DC_GAP
server.dc_fetch_image = fake_fetch
server.dc_call = fake_call
server.DC_GAP = 0
# 不開真的送圖執行緒：它會跟下面的 get_nowait() 搶佇列裡的圖，也會把等著重試的提早排回去。
server.dc_start = lambda: None
try:
    server._dc.update({"mode": "webhook", "webhook": HOOK, "token": "", "channelId": "", "enabled": True, "compact": False, "routes": []})
    a = server.dc_apply_config({"route": {"op": "save", "name": "芙莉蓮", "webhook": HOOK2, "chars": ["frieren"], "compact": True}})
    ok("新增頻道成功", a.get("ok") and len(a["routes"]) == 1, str(a))
    rid = a["routes"][0]["id"]
    ok("網頁拿不到頻道的網址", "webhook" not in a["routes"][0] and a["routes"][0]["webhookTail"].endswith(HOOK2[-4:]))
    ok("存進設定檔", json.loads(server.DC_SECRETS.read_text(encoding="utf-8"))["routes"][0]["webhook"] == HOOK2)
    b = server.dc_apply_config({"route": {"op": "save", "name": "全年齡", "webhook": HOOK2, "ratings": ["general"]}})
    rid2 = b["routes"][1]["id"]

    job = {"filename": "ComfyUI_1.png", "subfolder": "", "type": "output", "en": "frieren, smile", "rating": "general", "seed": 1}
    q = server.dc_enqueue(job)
    ok("對到兩個頻道", q.get("ok") and q.get("targets") == 2, str(q))
    queued = server._dc_queue.get_nowait()
    server._dc_queue.task_done()
    ok("佇列記著目標", queued["_targets"] == [rid, rid2], str(queued.get("_targets")))
    server.dc_deliver(queued)
    ok("一張圖只拿一次", fetches == ["ComfyUI_1.png"], str(fetches))
    ok("兩個頻道各送一則", [t for t, _ in sent] == [rid, rid2], str([t for t, _ in sent]))
    ok("頻道各自的精簡設定", len(sent[0][1]["embeds"]) == 1 and len(sent[1][1]["embeds"]) == 2)

    sent.clear()
    other = dict(job, en="himmel", rating="explicit")
    q = server.dc_enqueue(other)
    queued = server._dc_queue.get_nowait()
    server._dc_queue.task_done()
    ok("都不符合送其他", queued["_targets"] == ["other"], str(queued.get("_targets")))

    # 「其他」沒設：沒對到的圖不送；有頻道就還是算可以送。
    server._dc.update({"webhook": ""})
    st = server.dc_status()
    ok("只有頻道也算可以送", st["configured"] is True and st["otherConfigured"] is False)
    ok("其他沒設、沒對到的不送", server.dc_enqueue(other).get("error") == "沒有符合的頻道")
    server._dc.update({"webhook": HOOK})

    # 一個頻道壞掉：其他目標照送；連續 5 次自動暫停、存檔；恢復後再送。
    sent.clear()
    fail_targets.add(rid)
    for _ in range(dr.PAUSE_AFTER):
        server.dc_deliver(dict(job, _targets=[rid, rid2]))
    ok("壞掉的頻道不影響其他頻道", [t for t, _ in sent].count(rid2) == dr.PAUSE_AFTER)
    st = server.dc_status()
    r1 = next(r for r in st["routes"] if r["id"] == rid)
    ok("連續失敗自動暫停", r1["paused"] is True and r1["failed"] == dr.PAUSE_AFTER, str(r1))
    ok("暫停存進設定檔", json.loads(server.DC_SECRETS.read_text(encoding="utf-8"))["routes"][0]["paused"] is True)
    ok("錯誤訊息遮掉頻道網址", HOOK2 not in r1["lastError"] and HOOK2.rsplit("/", 1)[-1] not in r1["lastError"], r1["lastError"])
    q = server.dc_enqueue(job)
    queued = server._dc_queue.get_nowait()
    server._dc_queue.task_done()
    ok("暫停的頻道不排", queued["_targets"] == [rid2], str(queued.get("_targets")))
    fail_targets.clear()
    res = server.dc_apply_config({"route": {"op": "resume", "id": rid}})
    ok("恢復", next(r for r in res["routes"] if r["id"] == rid)["paused"] is False)

    d = server.dc_apply_config({"route": {"op": "delete", "id": rid2}})
    ok("刪除", [r["id"] for r in d["routes"]] == [rid], str(d))
    ok("刪不存在的回錯誤", server.dc_apply_config({"route": {"op": "delete", "id": "nope"}}).get("ok") is False)
    server._dc["routes"] = [dict(server._dc["routes"][0], id=f"z{i}") for i in range(dr.MAX_ROUTES)]
    over = server.dc_apply_config({"route": {"op": "save", "name": "x", "webhook": HOOK2, "chars": ["a"]}})
    ok("超過 20 個擋下", over.get("ok") is False and "20" in over.get("error", ""), str(over))

    # 舊設定檔（沒有 routes）讀得懂：行為跟以前一樣。
    server.DC_SECRETS.write_text(json.dumps({"mode": "webhook", "webhook": HOOK, "enabled": True}), encoding="utf-8")
    server.dc_load()
    ok("舊設定檔沒有頻道", server._dc["routes"] == [])
    q = server.dc_enqueue(job)
    queued = server._dc_queue.get_nowait()
    server._dc_queue.task_done()
    ok("舊設定檔照舊送其他", queued["_targets"] == ["other"])
    server._dc.update({"enabled": False})
    ok("總開關關著不送", server.dc_enqueue(job).get("ok") is False)
finally:
    server.dc_fetch_image, server.dc_call, server.DC_GAP = real_fetch, real_call, real_gap
    server._dc.clear()
    server._dc.update(backup)
    server._dc_rstat.clear()

# --- 送不出去：5xx／網路錯誤／429 排回佇列尾重試，不睡在送圖的執行緒裡 --------------------
import threading  # noqa: E402
import time  # noqa: E402
import urllib.error  # noqa: E402
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer  # noqa: E402


def http_err(code: int, retry=None) -> RuntimeError:
    e = RuntimeError(f"{code} x")
    e.dc_code = code
    if retry is not None:
        e.dc_retry = retry
    return e


def net_err() -> RuntimeError:
    e = RuntimeError("[WinError 10054] 遠端主機已強制關閉一個現存的連線。")
    e.dc_net = True
    return e


plan: "dict[str, list]" = {}  # target -> 每次送出時要丟的例外（None＝成功）
sent2: "list[str]" = []


def plan_call(body, ctype, timeout=None, target=dr.OTHER):
    steps = plan.get(target) or []
    exc = steps.pop(0) if steps else None
    if exc is not None:
        raise exc
    sent2.append(target)
    return {}


server.DC_SECRETS = Path(tempfile.mkdtemp()) / ".secrets" / "discord.json"
backup = dict(server._dc)
real_fetch, real_call, real_gap = server.dc_fetch_image, server.dc_call, server.DC_GAP
server.dc_fetch_image = fake_fetch
server.dc_call = plan_call
server.DC_GAP = 0
try:
    server._dc.update({"mode": "webhook", "webhook": HOOK, "token": "", "channelId": "", "enabled": True, "compact": False, "routes": [], "fails": 0, "otherPaused": False, "sent": 0, "failed": 0, "lastError": ""})
    a = server.dc_apply_config({"route": {"op": "save", "name": "A", "webhook": HOOK2, "chars": ["frieren"]}})
    ra = a["routes"][0]["id"]
    server._dc_later.clear()
    plan.update({ra: [http_err(503)], dr.OTHER: []})
    sent2.clear()
    t0 = time.monotonic()
    server.dc_deliver({"filename": "x.png", "_targets": [ra, dr.OTHER]})
    ok("5xx：送圖的執行緒不睡著等退避", time.monotonic() - t0 < 1.0, f"{time.monotonic() - t0:.2f}s")
    ok("5xx：同一張的其他目標照送", sent2 == [dr.OTHER], str(sent2))
    ok("5xx：排一張重試（只帶失敗的那個目標、嘗試次數 1）", len(server._dc_later) == 1 and server._dc_later[0][1]["_targets"] == [ra] and server._dc_later[0][1]["_tries"] == 1, str(server._dc_later))
    due, retry = server._dc_later[0]
    ok("5xx：第一次隔 DC_RETRY_BACKOFF[0] 秒", abs(due - time.time() - server.DC_RETRY_BACKOFF[0]) < 1.0, str(due - time.time()))
    st = server.dc_status()
    r1 = next(r for r in st["routes"] if r["id"] == ra)
    ok("5xx：重試前不算失敗，但面板看得到原因和幾秒後重試", r1["failed"] == 0 and "503" in r1["lastError"] and "秒後重試" in r1["lastError"], str(r1))
    ok("5xx：排隊中算進等著重試的", st["queued"] >= 1 and st["retrying"] == 1, str(st))
    ok("沒到時間不排回佇列", server.dc_requeue_due(due - 0.5) == 0 and len(server._dc_later) == 1)
    ok("到時間排回佇列尾", server.dc_requeue_due(due + 0.1) == 1 and server._dc_later == [])
    back = server._dc_queue.get_nowait()
    server._dc_queue.task_done()
    sent2.clear()
    server.dc_deliver(back)
    ok("重試成功就送出、記成功", sent2 == [ra] and next(r for r in server.dc_status()["routes"] if r["id"] == ra)["lastError"] == "")

    # 一直 5xx：試了 DC_RETRY_BACKOFF 那麼多次才算一次失敗。
    server._dc_later.clear()
    n = len(server.DC_RETRY_BACKOFF)
    plan[ra] = [http_err(500) for _ in range(n + 1)]
    job = {"filename": "x.png", "_targets": [ra]}
    waits = []
    for _ in range(n + 1):
        server.dc_deliver(job)
        if server._dc_later:
            at, job = server._dc_later.pop()
            waits.append(round(at - time.time()))
    r1 = next(r for r in server.dc_status()["routes"] if r["id"] == ra)
    ok("一直 5xx：退避一次比一次久，用完才算失敗", waits == [round(w) for w in server.DC_RETRY_BACKOFF] and r1["failed"] == 1, f"{waits} {r1}")

    # 網路錯誤（連不上、被重設）也重試；4xx 不重試。
    server._dc_later.clear()
    plan[ra] = [net_err()]
    server.dc_deliver({"filename": "x.png", "_targets": [ra]})
    ok("網路錯誤排重試", len(server._dc_later) == 1)
    server._dc_later.clear()
    plan[ra] = [http_err(404)]
    server.dc_deliver({"filename": "x.png", "_targets": [ra]})
    ok("4xx 不重試，直接記失敗", server._dc_later == [] and next(r for r in server.dc_status()["routes"] if r["id"] == ra)["failed"] == 2)

    # 429：照 Discord 給的 retry_after 排回去，同樣不卡住別的頻道。
    plan[ra] = [http_err(429, retry=7.5)]
    sent2.clear()
    t0 = time.monotonic()
    server.dc_deliver({"filename": "x.png", "_targets": [ra, dr.OTHER]})
    ok("429：不睡著等", time.monotonic() - t0 < 1.0)
    ok("429：照 retry_after 排", len(server._dc_later) == 1 and abs(server._dc_later[0][0] - time.time() - 7.5) < 1.0 and sent2 == [dr.OTHER], str(server._dc_later))
    server._dc_later.clear()

    # 網頁送來的底線欄位不收（_targets、_tries 是佇列自己用的）。
    q = server.dc_enqueue({"filename": "x.png", "en": "himmel", "rating": "general", "_targets": ["evil"], "_tries": 99})
    queued = server._dc_queue.get_nowait()
    server._dc_queue.task_done()
    ok("佇列不收網頁送來的 _targets／_tries", queued["_targets"] == [dr.OTHER] and "_tries" not in queued, str(queued))

    # 「其他」那條也照 PAUSE_AFTER 自動暫停、存檔；暫停時沒對到頻道的不排；恢復／重新存設定解開。
    server._dc.update({"fails": 0, "otherPaused": False, "failed": 0})
    for _ in range(dr.PAUSE_AFTER):
        plan[dr.OTHER] = [http_err(404)]
        server.dc_deliver({"filename": "x.png", "_targets": [dr.OTHER]})
    st = server.dc_status()
    ok("其他：連續失敗自動暫停", st["otherPaused"] is True and st["failed"] == dr.PAUSE_AFTER, str({k: st[k] for k in ("otherPaused", "failed")}))
    ok("其他：暫停存進設定檔", json.loads(server.DC_SECRETS.read_text(encoding="utf-8")).get("otherPaused") is True)
    res = server.dc_enqueue({"filename": "x.png", "en": "himmel", "rating": "general"})
    ok("其他：暫停時沒對到頻道的不排", res.get("code") == "nomatch", str(res))
    res = server.dc_enqueue({"filename": "x.png", "en": "frieren", "rating": "general"})
    queued = server._dc_queue.get_nowait()
    server._dc_queue.task_done()
    ok("其他：暫停時頻道照送", res.get("ok") and queued["_targets"] == [ra], str(queued.get("_targets")))
    server.dc_load()
    ok("其他：重開伺服器還是暫停", server._dc["otherPaused"] is True)
    st = server.dc_apply_config({"route": {"op": "resume", "id": "other"}})
    ok("其他：按恢復解開", st.get("ok") and st["otherPaused"] is False and server._dc["fails"] == 0, str(st.get("otherPaused")))
    for _ in range(dr.PAUSE_AFTER):
        plan[dr.OTHER] = [http_err(404)]
        server.dc_deliver({"filename": "x.png", "_targets": [dr.OTHER]})
    ok("其他：又暫停", server._dc["otherPaused"] is True)
    st = server.dc_apply_config({"mode": "webhook", "webhook": "", "enabled": True})
    ok("其他：重新存設定也解開", st.get("ok") and st["otherPaused"] is False, str(st))
    # 跟 ComfyUI 拿不到圖不是頻道的錯：照記失敗，但不算進連續失敗。
    def no_image(job):
        raise RuntimeError("Comfy 沒給圖")
    server.dc_fetch_image = no_image
    for _ in range(dr.PAUSE_AFTER + 1):
        server.dc_deliver({"filename": "x.png", "_targets": [dr.OTHER, ra]})
    ok("拿不到圖不會讓頻道被暫停", server._dc["otherPaused"] is False and not server.dc_route(ra)["paused"])
    server.dc_fetch_image = fake_fetch
    for _ in range(dr.PAUSE_AFTER + 1):
        plan[dr.OTHER] = [http_err(413)]
        plan[dr.OTHER][0].args = (server.DC_TOO_BIG,)
        server.dc_deliver({"filename": "x.png", "_targets": [dr.OTHER]})
    ok("圖太大（413）不算頻道連續失敗、不重試", server._dc["otherPaused"] is False and server._dc_later == [] and server._dc["lastError"] == server.DC_TOO_BIG, str(server._dc["lastError"]))
finally:
    server.dc_fetch_image, server.dc_call, server.DC_GAP = real_fetch, real_call, real_gap
    server._dc.clear()
    server._dc.update(backup)
    server._dc_rstat.clear()
    server._dc_later.clear()

# --- 圖太大：超過約 9.5MB 改抓 ComfyUI 轉的 webp；還是太大、413、WinError 10053 都講同一句白話 -------
real_api = server.api
views = []


def big_api(method, path, data=None, timeout=60):
    views.append(path)
    if "preview=" in path:
        return b"RIFF" + b"w" * (small_size["n"] - 4)
    return b"\x89PNG" + b"p" * (12 * 1024 * 1024)


small_size = {"n": 3 * 1024 * 1024}
server.api = big_api
try:
    blob, mime, fname = server.dc_fetch_image({"filename": "ComfyUI_00001_.png", "subfolder": "", "type": "output"})
    ok("大圖：改抓 webp（preview=webp;90）", any("preview=webp%3B90" in p for p in views) and mime == "image/webp" and blob[:4] == b"RIFF", str(views))
    ok("大圖：檔名跟著換成 .webp（attachment:// 要一字不差）", fname == "ComfyUI_00001_.webp", fname)
    small_size["n"] = 11 * 1024 * 1024
    try:
        server.dc_fetch_image({"filename": "a.png"})
        ok("webp 也太大：報太大", False)
    except RuntimeError as exc:
        ok("webp 也太大：報太大", str(exc) == server.DC_TOO_BIG, str(exc))
    small_size["n"] = 1024
    views.clear()
finally:
    server.api = real_api
ok("小圖不轉", True)


class _Hook(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    mode = {"code": 200}

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(n)
        code = self.mode["code"]
        body = json.dumps({"message": "Request entity too large"} if code == 413 else {"message": "Internal Server Error"} if code >= 500 else {"retry_after": 2.5} if code == 429 else {"id": "1"}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


hook_srv = ThreadingHTTPServer(("127.0.0.1", 0), _Hook)
threading.Thread(target=hook_srv.serve_forever, daemon=True).start()
saved = (server.DC_API, dict(server._dc))
server.DC_API = f"http://127.0.0.1:{hook_srv.server_address[1]}"
server._dc.update({"mode": "bot", "token": "tok-secret-123", "channelId": "42"})


def call_err(code: int) -> "RuntimeError | None":
    _Hook.mode["code"] = code
    try:
        server.dc_call(b"{}", "application/json")
        return None
    except RuntimeError as exc:
        return exc


try:
    ok("假 webhook：200 送得出去", call_err(200) is None)
    e = call_err(413)
    ok("413 翻成白話", e is not None and str(e) == server.DC_TOO_BIG and server.dc_retry_wait(e, 0) is None, str(e))
    e = call_err(502)
    ok("502 會重試", e is not None and server.dc_retry_wait(e, 0) == server.DC_RETRY_BACKOFF[0], str(e))
    e = call_err(429)
    ok("429 照 retry_after", e is not None and server.dc_retry_wait(e, 0) == 2.5, str(e))
    e = call_err(400)
    ok("400 不重試", e is not None and server.dc_retry_wait(e, 0) is None)
    import socket as _sock  # noqa: E402
    dead = _sock.socket()
    dead.bind(("127.0.0.1", 0))
    dead_port = dead.getsockname()[1]
    dead.close()
    server.DC_API = f"http://127.0.0.1:{dead_port}"
    try:
        server.dc_call(b"{}", "application/json")
        ok("連不上：網路錯誤會重試", False)
    except RuntimeError as exc:
        ok("連不上：網路錯誤會重試", server.dc_retry_wait(exc, 0) == server.DC_RETRY_BACKOFF[0] and "tok-secret-123" not in str(exc), str(exc))
    real_open = server.urllib.request.urlopen

    def aborted(*a, **k):
        raise urllib.error.URLError(ConnectionAbortedError(10053, "連線已被您主機上的軟體中止。"))

    server.urllib.request.urlopen = aborted
    try:
        server.dc_call(b"x" * 100, "application/json")
        ok("WinError 10053 翻成白話", False)
    except RuntimeError as exc:
        ok("WinError 10053 翻成白話（不重試）", str(exc) == server.DC_TOO_BIG and server.dc_retry_wait(exc, 0) is None, str(exc))
    finally:
        server.urllib.request.urlopen = real_open
finally:
    server.DC_API = saved[0]
    server._dc.clear()
    server._dc.update(saved[1])
    hook_srv.shutdown()
    hook_srv.server_close()

# --- 設定檔安全寫入：暫存檔＋換上＋.bak；正本壞了用 .bak；兩個執行緒同時存不會寫壞 ------------------
import io  # noqa: E402
import contextlib  # noqa: E402

server.DC_SECRETS = Path(tempfile.mkdtemp()) / ".secrets" / "discord.json"
saved = dict(server._dc)
try:
    server._dc.update({"mode": "webhook", "webhook": HOOK, "enabled": True, "routes": []})
    server.dc_save()
    bak = server.DC_SECRETS.with_name(server.DC_SECRETS.name + ".bak")
    ok("存檔：正本和 .bak 都在", server.DC_SECRETS.is_file() and bak.is_file())
    ok("存檔：沒有留下暫存檔", not list(server.DC_SECRETS.parent.glob("*.tmp")))
    if os.name != "nt":
        ok("存檔：只給自己讀（0600）", (server.DC_SECRETS.stat().st_mode & 0o777) == 0o600 and (bak.stat().st_mode & 0o777) == 0o600)
    server.DC_SECRETS.write_text('{"mode": "webhook", "webh', encoding="utf-8")  # 寫到一半當掉的樣子
    server._dc.update({"webhook": "", "enabled": False})
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        server.dc_load()
    ok("讀檔：正本壞了用 .bak 換回來", server._dc["webhook"] == HOOK and server._dc["enabled"] is True, out.getvalue())
    ok("讀檔：壞的那份留著、有印訊息", list(server.DC_SECRETS.parent.glob("discord.json.corrupt-*")) and "換回" in out.getvalue(), out.getvalue())
    server.DC_SECRETS.write_text("{壞", encoding="utf-8")
    bak.write_text("{也壞", encoding="utf-8")
    server._dc.update({"webhook": "keep"})
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        server.dc_load()
    ok("讀檔：兩份都壞，印出來、不當成空設定蓋掉記憶體裡的", server._dc["webhook"] == "keep" and "壞了" in out.getvalue(), out.getvalue())

    # 自動暫停（送圖的執行緒）和面板存檔同時寫：每一次都要是完整的 JSON，最後一次是最新的。
    server._dc.update({"webhook": HOOK, "routes": []})
    errors = []

    def hammer(i):
        try:
            for j in range(15):
                with server._dc_lock:
                    server._dc["channelId"] = f"{i}-{j}"
                server.dc_save()
                # 讀也要拿鎖（跟 dc_load 一樣）：Windows 上有人開著檔，os.replace 換不上去。
                with server.file_lock.locked(server.DC_SECRETS):
                    json.loads(server.DC_SECRETS.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            errors.append(repr(exc))

    ths = [threading.Thread(target=hammer, args=(i,)) for i in range(4)]
    for t in ths:
        t.start()
    for t in ths:
        t.join()
    final = json.loads(server.DC_SECRETS.read_text(encoding="utf-8"))
    ok("同時存檔：沒有寫壞、也沒有讀到半個檔", not errors, str(errors[:3]))
    ok("同時存檔：檔案是最後的狀態", final["channelId"] == server._dc["channelId"], f"{final['channelId']} vs {server._dc['channelId']}")
    src = (Path(server.__file__)).read_text(encoding="utf-8")
    body = src[src.index("def dc_save()"):src.index("def dc_scrub(")]
    ok("dc_save 不再直接 write_text", "write_text(" not in body.replace("file_lock.write_text", ""))
finally:
    server._dc.clear()
    server._dc.update(saved)

if failed:
    print(f"{failed} failed")
    sys.exit(1)
print("all discord route checks passed")
