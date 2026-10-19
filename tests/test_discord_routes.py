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

if failed:
    print(f"{failed} failed")
    sys.exit(1)
print("all discord route checks passed")
