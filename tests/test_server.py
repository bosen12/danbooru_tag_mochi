#!/usr/bin/env python3
"""SSE / Comfy binary preview helpers. Failures print and exit 1."""
from __future__ import annotations

import inspect
import json
import re
import socket
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import os as _env_os  # noqa: E402
import tempfile as _env_tmp  # noqa: E402

# 出圖日誌（gen_log.py）：這裡會造假的出圖工作，不能寫進真的 data/gen_log.jsonl。
_env_os.environ["GEN_LOG_PATH"] = str(Path(_env_tmp.mkdtemp()) / "gen_log.jsonl")
# 使用者在網頁上選的偏好路徑、底模（data/settings.json）不能影響測試，也不能被測試改到。
_env_os.environ["APP_SETTINGS"] = str(Path(_env_tmp.mkdtemp()) / "settings.json")
from server import (  # noqa: E402
    CKPT,
    Handler,
    allowed_client,
    build_workflow,
    ckpt_preview_path,
    comfy_view_query,
    convert_loras,
    first_image_src,
    image_error_code,
    inject_lora,
    list_ckpts,
    mask_ws,
    parse_allow_nets,
    parse_comfy_binary,
    resolve_ckpt,
    sse,
    ws_frame,
)
from lora_scan import preview_path, strip_angle_tags  # noqa: E402
import shutil  # noqa: E402
import server  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

failed = 0


def ok(name: str, cond: bool, detail: str = "") -> None:
    global failed
    if not cond:
        failed += 1
        print(f"FAIL {name}" + (f"\n  {detail}" if detail else ""))
    else:
        print(f"ok   {name}")


blob = sse("progress", {"value": 3, "max": 25})
ok("sse is bytes", isinstance(blob, bytes))
text = blob.decode("utf-8")
ok("sse has event line", "event: progress\n" in text)
ok("sse has blank terminator", text.endswith("\n\n"))
payload = json.loads(text.split("data: ", 1)[1].strip())
ok("sse data json", payload == {"value": 3, "max": 25})

raw = struct.pack(">II", 1, 1) + b"\xff\xd8fakejpeg"
parsed = parse_comfy_binary(raw)
ok("jpeg preview parsed", parsed == ("image/jpeg", b"\xff\xd8fakejpeg"), str(parsed))

png = struct.pack(">II", 1, 2) + b"\x89PNG"
ok("png preview parsed", parse_comfy_binary(png) == ("image/png", b"\x89PNG"))
ok("short buffer ignored", parse_comfy_binary(b"xxxx") is None)
ok("unknown event ignored", parse_comfy_binary(struct.pack(">II", 9, 1) + b"x") is None)

frame = ws_frame(b"hello", opcode=1)
ok("client frame is masked", frame[1] & 0x80 == 0x80)
ok("unmask roundtrip", mask_ws(frame) == (1, b"hello"), str(mask_ws(frame)))


class _Req:
    def __init__(self, path: str) -> None:
        self.path = path


ok("static allows styles.css", Handler._static_dest(_Req("/styles.css")) is not None)
ok("static allows rules/rating.js", Handler._static_dest(_Req("/rules/rating.js")) is not None)
ok("static allows trace.js", Handler._static_dest(_Req("/trace.js")) is not None)
ok("static blocks ../web2", Handler._static_dest(_Req("/../web2/styles.css")) is None)
ok("static blocks encoded ..", Handler._static_dest(_Req("/%2e%2e/web2/styles.css")) is None)

ok("view query ok", comfy_view_query("ComfyUI_1.png") == "filename=ComfyUI_1.png&subfolder=&type=output")
ok("view query keeps subfolder", comfy_view_query("a.png", "batch/out") == "filename=a.png&subfolder=batch%2Fout&type=output")
ok("view query rejects slash in name", comfy_view_query("a/b.png") is None)
ok("view query rejects .. name", comfy_view_query("..") is None)
ok("view query rejects .. subfolder", comfy_view_query("a.png", "../x") is None)
ok("view query rejects type", comfy_view_query("a.png", type_="etc") is None)
ok("view query rejects CR in name", comfy_view_query("a.png\r\nX-Injected: yes") is None)
ok("view query rejects NUL in subfolder", comfy_view_query("a.png", "out\x00") is None)
ok("http/1.1", Handler.protocol_version == "HTTP/1.1")
ok(
    "history becomes /api/image url",
    first_image_src({"outputs": {"9": {"images": [{"filename": "x.png", "type": "output"}]}}})
    == "/api/image?filename=x.png&subfolder=&type=output",
)
ok("empty history has no image", first_image_src({"outputs": {}}) is None)


class _Http:
    def __init__(self, code: int) -> None:
        self.code = code


ok("missing image is 404", image_error_code(_Http(404)) == 404)
ok("comfy down is 502", image_error_code(OSError("refused")) == 502)

nets = parse_allow_nets("")
ok("loopback allowed", allowed_client("127.0.0.1", nets))
ok("loopback net allowed", allowed_client("127.0.0.2", nets))
ok("tailscale allowed", allowed_client("100.79.212.103", nets))

# ComfyUI 退件（/prompt 400）翻成看得懂的話，不是「HTTP Error 400: Bad Request」。
_rej = server.comfy_rejection_text({
    "error": {"type": "prompt_outputs_failed_validation", "message": "Prompt outputs failed validation"},
    "node_errors": {"4": {"class_type": "CheckpointLoaderSimple", "errors": [
        {"type": "value_not_in_list", "message": "Value not in list", "details": "ckpt_name: 'gone.safetensors' not in ['a.safetensors']"}]}},
})
ok("comfy rejection: missing model named", "gone.safetensors" in _rej and "CheckpointLoaderSimple" in _rej and "#4" in _rej, _rej)
_rej2 = server.comfy_rejection_text({"error": {"type": "missing_node_type", "message": "Node 'FooNode' not found.", "extra_info": {"class_type": "FooNode"}}, "node_errors": {}})
ok("comfy rejection: missing custom node named", "FooNode" in _rej2 and "Install Missing Custom Nodes" in _rej2, _rej2)
_oom = server.comfy_exec_error_text({"node_type": "KSampler", "exception_message": "Allocation on device 0 would exceed allowed memory. (out of memory)\nCurrently allocated: 7.2 GiB"})
ok("comfy exec error: out of memory explained", "顯示卡記憶體不夠" in _oom and "KSampler" in _oom, _oom)
ok("comfy exec error: other errors keep the first line", server.comfy_exec_error_text({"node_type": "VAEDecode", "exception_message": "boom\nstack"}) == "ComfyUI 跑到一半出錯（VAEDecode）：boom")

# 卡面 manifest 送給瀏覽器時拿掉烘焙用的欄位，畫面要的欄位全留著。
_slim = json.loads(server.slim_card_manifest(json.dumps({
    "red hair": {"file": "red_hair.webp", "seed": 7, "positive": "1girl, red hair", "negative": "x", "rating": "general",
                 "thumb": True, "v": "abc", "mini": {"src": "abc", "w": {"160": "d"}}},
}).encode()))
ok("card manifest: build-only fields dropped", set(_slim["red hair"]) == {"file", "rating", "thumb", "v", "mini"}, str(_slim))
ok("card manifest: invalid JSON passes through", server.slim_card_manifest(b"not json") == b"not json")
ok("cgnat low allowed", allowed_client("100.64.0.1", nets))
ok("cgnat high allowed", allowed_client("100.127.255.254", nets))
ok("wifi blocked", not allowed_client("192.168.1.101", nets))
ok("hotspot blocked", not allowed_client("192.168.137.1", nets))
ok("wsl blocked", not allowed_client("172.17.64.1", nets))

ok("convert empty", convert_loras(None) == [])
ok("convert skips blank file", convert_loras([{"folder": "style", "file": ""}]) == [])
ok(
    "convert max two",
    len(convert_loras([
        {"folder": "style", "file": "a.safetensors"},
        {"folder": "Character", "file": "b.safetensors"},
        {"folder": "illus", "file": "c.safetensors"},
    ])) == 2,
)
ok(
    "convert subfolder uses backslash",
    convert_loras([{"folder": "Character/other", "file": "x.safetensors", "strength": 0.5}])
    == [(r"Character\other\x.safetensors", 0.5)],
)
ok("strip angle tags", strip_angle_tags("foo, <lora:bar:1>, baz") == "foo, baz")
ok("preview rejects slash in file", preview_path("style", "a/b.png") is None)
ok("preview rejects dotdot folder", preview_path("style/../Character", "a.png") is None)
ok("preview rejects unknown category", preview_path("not-a-folder", "a.png") is None)

wf = build_workflow("1girl", 1024, 1024, 1, [{"folder": "style", "file": "a.safetensors", "strength": 0.8}])
loaders = [n for n in wf.values() if n.get("class_type") == "LoraLoader"]
ok("workflow injects one lora", len(loaders) == 1)
ok("lora name has backslash", loaders[0]["inputs"]["lora_name"] == r"style\a.safetensors")
ok("sampler model is lora not ckpt", wf["35"]["inputs"]["model"][0] != "13")
ok("vae still ckpt", wf["85"]["inputs"]["vae"] == ["13", 2])
ok("clip encode uses lora", wf["36"]["inputs"]["clip"][0] != "13")

wf2 = {"13": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "x"}}}
wf2["36"] = {"class_type": "CLIPTextEncode", "inputs": {"text": "a", "clip": ["13", 1]}}
inject_lora(wf2, r"style\a.safetensors", 0.8)
inject_lora(wf2, r"Character\b.safetensors", 0.6)
lora_ids = [nid for nid, n in wf2.items() if n.get("class_type") == "LoraLoader"]
ok("two loras chained", len(lora_ids) == 2)
first, second = lora_ids
ok("second lora eats ckpt", wf2[second]["inputs"]["model"] == ["13", 0])
ok("first lora eats second", wf2[first]["inputs"]["model"] == [second, 0])
ok("cgnat below blocked", not allowed_client("100.63.255.255", nets))
ok("mapped tailscale allowed", allowed_client("::ffff:100.79.212.103", nets))
ok("mapped wifi blocked", not allowed_client("::ffff:192.168.1.101", nets))
ok("garbage blocked", not allowed_client("not-an-ip", nets))
ok("allow-all env", allowed_client("192.168.1.101", parse_allow_nets("0.0.0.0/0")))


class _BlockedConsole:
    def write(self, _text):
        raise AssertionError("HTTP access log touched the blocking console")


_handler = Handler.__new__(Handler)
_handler.address_string = lambda: "client"
_old_stderr = server.sys.stderr
try:
    server.sys.stderr = _BlockedConsole()
    try:
        _handler.log_message('"%s" %s', "GET /", "200")
    except AssertionError as exc:
        ok("HTTP requests never write to the Windows console", False, str(exc))
    else:
        ok("HTTP requests never write to the Windows console", True)
finally:
    server.sys.stderr = _old_stderr

import tempfile

td = Path(tempfile.mkdtemp())
(td / "alpha.safetensors").write_bytes(b"x")
(td / "beta.safetensors").write_bytes(b"x")
(td / "alpha.png").write_bytes(b"png")
(td / "notes.txt").write_text("no")
found = list_ckpts(td, "illurtrious")
ok("list skips non-ckpt", [x["file"] for x in found] == ["alpha.safetensors", "beta.safetensors"])
ok("list ckpt_name prefix", found[0]["ckpt_name"] == r"illurtrious\alpha.safetensors")
ok("list preview next to weights", found[0]["preview"] == "alpha.png")

_old_list_ckpts = server.list_ckpts
_old_models_from_comfy = server.models_from_comfy
try:
    server.list_ckpts = lambda: [
        {
            "file": "alpha.safetensors",
            "ckpt_name": r"illurtrious\alpha.safetensors",
            "title": "Alpha local title",
            "preview": "alpha.png",
        }
    ]
    server.models_from_comfy = lambda kind: [
        r"illurtrious\alpha.safetensors",
        r"extra\remote.safetensors",
    ]
    merged_ckpts, merged_source = server.checkpoints_for_ui()
    ok(
        "local previews do not hide Comfy extra_model_paths",
        [x["ckpt_name"] for x in merged_ckpts]
        == [r"illurtrious\alpha.safetensors", r"extra\remote.safetensors"],
        str(merged_ckpts),
    )
    ok("Comfy checkpoint source is reported", merged_source == "comfy", merged_source)
    ok("local checkpoint preview is attached", merged_ckpts[0]["preview"] == "alpha.png", str(merged_ckpts[0]))
finally:
    server.list_ckpts = _old_list_ckpts
    server.models_from_comfy = _old_models_from_comfy

ok("resolve by file", resolve_ckpt("beta.safetensors", found) == r"illurtrious\beta.safetensors")
ok("resolve by full name", resolve_ckpt(r"illurtrious\beta.safetensors", found) == r"illurtrious\beta.safetensors")
ok("resolve rejects parent", resolve_ckpt(r"..\evil.safetensors", found) == resolve_ckpt(None, found))
ok("preview rejects slash", ckpt_preview_path("a/b.png", td) is None)
ok("preview rejects dotdot", ckpt_preview_path("..", td) is None)
ok("preview allows sibling png", ckpt_preview_path("alpha.png", td) is not None)

# 舊 config.json：checkpointDir 指整個 checkpoints、另填 checkpointPrefix。
_ck_root = Path(tempfile.mkdtemp()) / "checkpoints"
(_ck_root / "illurtrious").mkdir(parents=True)
ok("old checkpointDir gains prefix subfolder", server._prefix_subdir(_ck_root, "illurtrious") == _ck_root / "illurtrious")
ok("checkpointDir already at prefix stays", server._prefix_subdir(_ck_root / "illurtrious", "illurtrious") == _ck_root / "illurtrious")
ok("checkpointDir without prefix subfolder stays", server._prefix_subdir(_ck_root, "other") == _ck_root)
ok("missing checkpointDir stays", server._prefix_subdir(td / "nope", "illurtrious") == td / "nope")


class _Client:
    def __init__(self, ip: str) -> None:
        self.client_address = (ip, 9)
        self.close_connection = False
        self.dumped = None

    def _json(self, code, obj):
        self.dumped = (code, obj)


wifi = _Client("192.168.1.101")
ok(
    "wifi handler 403",
    Handler._allowed(wifi) is False
    and wifi.close_connection
    and wifi.dumped == (403, {"ok": False, "error": "forbidden"}),
)
loop = _Client("127.0.0.1")
ok("loopback handler ok", Handler._allowed(loop) is True and loop.dumped is None)



# --- Telegram -------------------------------------------------------------

tg_dir = Path(tempfile.mkdtemp())
server._tg.update({"token": "", "chatId": "", "enabled": False, "sent": 0, "failed": 0, "lastError": ""})
server.TG_SECRETS = tg_dir / ".secrets" / "telegram.json"

st = server.tg_apply_config({"token": "123456:SECRET-TOKEN", "chatId": "@chan", "enabled": True})
ok("config saves", st["ok"] and st["configured"] and st["chatId"] == "@chan")
ok("config hides token", "token" not in st and st["tokenTail"] == "…OKEN")
ok("config never returns token body", "SECRET-TOKEN" not in json.dumps(st))
ok("secrets file written", server.TG_SECRETS.is_file())
ok(
    "secrets file holds token",
    json.loads(server.TG_SECRETS.read_text(encoding="utf-8"))["token"] == "123456:SECRET-TOKEN",
)

# 留空的 token 代表「沿用已存的」，不是「清掉」。
st = server.tg_apply_config({"token": "", "chatId": "@other", "enabled": False})
ok("blank token keeps old", server._tg["token"] == "123456:SECRET-TOKEN")
ok("blank token updates rest", st["chatId"] == "@other" and st["enabled"] is False)

ok("scrub hides token", server.tg_scrub("boom https://x/bot123456:SECRET-TOKEN/send") ==
   "boom https://x/bot***/send")

# 重讀檔案要拿回一樣的東西。
server._tg.update({"token": "", "chatId": "", "enabled": False})
server.tg_load()
ok("reload restores", server._tg["token"] == "123456:SECRET-TOKEN" and server._tg["chatId"] == "@other")

# caption：短的一則解決，長的把英文 POS 切出去。
short = server.tg_caption({"seed": 7, "width": 1024, "height": 1024, "zh": "藍髮", "en": "blue hair"})
ok("short caption one message", short == ("seed 7 · 1024x1024\n藍髮\nblue hair", ""))

long_en = ", ".join(["long english tag"] * 120)
cap, tail = server.tg_caption({"seed": 7, "width": 1024, "height": 1024, "zh": "藍髮", "en": long_en})
ok("long caption splits", tail == long_en and len(cap) <= server.TG_CAPTION_MAX)
ok("long caption keeps zh", cap == "seed 7 · 1024x1024\n藍髮")

# 中文 POS 自己就爆掉時要截斷，不能超過上限。
huge_zh = "字" * 3000
cap, tail = server.tg_caption({"seed": 1, "zh": huge_zh, "en": "x"})
ok("huge zh truncated", len(cap) <= server.TG_CAPTION_MAX and cap.endswith("…"))
ok("huge zh still tails en", tail == "x")

body, boundary = server.tg_multipart({"chat_id": "@chan", "caption": "hi"}, "a.png", b"\x89PNG", "image/png")
ok("multipart boundary used", body.startswith(("--" + boundary).encode()))
ok("multipart has chat_id", b'name="chat_id"' in body and b"@chan" in body)
ok("multipart has caption", b'name="caption"' in body and b"hi" in body)
ok("multipart has photo part", b'name="photo"; filename="a.png"' in body and b"\x89PNG" in body)
ok("multipart closes", body.endswith(("--" + boundary + "--\r\n").encode()))

# 路徑白名單：../ 這種進不了佇列。
server._tg.update({"token": "t", "chatId": "@c", "enabled": True})
ok("enqueue rejects bad name", server.tg_enqueue({"filename": "../etc/passwd"})["ok"] is False)
ok("enqueue rejects empty name", server.tg_enqueue({"filename": ""})["ok"] is False)

server._tg["enabled"] = False
ok("enqueue refuses when off", server.tg_enqueue({"filename": "a.png"})["ok"] is False)
server._tg.update({"token": "", "chatId": "", "enabled": True})
ok("enqueue refuses unconfigured", server.tg_enqueue({"filename": "a.png"})["ok"] is False)

server._tg.update({"token": "", "chatId": "", "enabled": False, "sent": 0, "failed": 0, "lastError": ""})
shutil.rmtree(tg_dir, ignore_errors=True)

# --- websocket 幀解析：逾時落在幀中間也不能掉格 ---------------------------
# Comfy 的預覽是幾百 KB 的二進位幀，會跨好幾個 TCP segment。取樣忙起來時
# gen_via_ws 的 2 秒 socket timeout 很容易剛好落在幀中間；舊的 _read() 是一個
# byte 一個 byte 從 buf 吃掉，逾時丟出去時已經吃掉的幀頭就永遠消失，之後每一幀
# 都錯位解讀 —— 那張圖不是超時十分鐘就是整條串流無聲卡死。


class ScriptedSock:
    """照劇本吐資料。bytes 就送出去，None 代表這一刻卡住（socket.timeout）。"""

    def __init__(self, script):
        self.script = list(script)

    def recv(self, _n):
        if not self.script:
            return b""
        item = self.script.pop(0)
        if item is None:
            raise socket.timeout()
        return item

    def settimeout(self, _t):
        pass


def server_frame(payload: bytes, opcode: int = 2) -> bytes:
    """Comfy → 我們的方向不遮罩，所以不能用 ws_frame()（那支是我們送出去用的）。"""
    n = len(payload)
    head = bytes([0x80 | opcode])
    if n < 126:
        head += bytes([n])
    elif n < 65536:
        head += bytes([126]) + struct.pack(">H", n)
    else:
        head += bytes([127]) + struct.pack(">Q", n)
    return head + payload


def drain(ws, tries: int = 200):
    """像 gen_via_ws 那樣：逾時就接住重來。"""
    for _ in range(tries):
        try:
            return ws.recv()
        except socket.timeout:
            continue
    raise AssertionError("recv 一直逾時")


preview = struct.pack(">II", 1, 1) + (b"\xff\xd8" + b"J" * 400)
wire = server_frame(preview)

ok("ws frame in one piece", drain(server.Ws(ScriptedSock([wire]))) == (2, preview))

# 每一個 byte 之間都卡一次 —— 幀頭、126 長度欄位、payload 全都被逾時切開。
split = []
for b in wire[:8]:
    split += [bytes([b]), None]
split += [wire[8:200], None, wire[200:]]
ok(
    "ws frame survives mid-frame timeouts",
    drain(server.Ws(ScriptedSock(split))) == (2, preview),
    "逾時落在幀中間時幀頭被吃掉了",
)

# 兩幀擠在同一個 TCP 段裡：第二幀要留在 buf 等下一次 recv。
two = server.Ws(ScriptedSock([server_frame(b"AA", 1) + server_frame(b"BBB", 1)]))
ok("ws two frames one chunk #1", drain(two) == (1, b"AA"))
ok("ws two frames one chunk #2", drain(two) == (1, b"BBB"))

# 長度欄位被讀成天文數字時要當場報錯，不能一路吞資料把記憶體吃光。
huge = bytes([0x82, 127]) + struct.pack(">Q", server.WS_FRAME_MAX + 1)
try:
    server.Ws(ScriptedSock([huge])).recv()
    ok("ws rejects absurd frame length", False, "沒有擋下來")
except ConnectionError as exc:
    ok("ws rejects absurd frame length", "too big" in str(exc), str(exc))

# 遮罩過的幀（我們自己送出去的格式）照樣解得開。
masked = ws_frame(b"hello", opcode=1)
ok("ws parses masked frame", drain(server.Ws(ScriptedSock([masked]))) == (1, b"hello"))

# 對面收線：讀不到東西要報 ws closed，不是安靜地回空幀。
try:
    server.Ws(ScriptedSock([])).recv()
    ok("ws closed raises", False, "沒有報錯")
except ConnectionError as exc:
    ok("ws closed raises", "closed" in str(exc), str(exc))


class HandshakeSock:
    def __init__(self):
        self.sent = []
        self.replied = False

    def settimeout(self, _t):
        pass

    def sendall(self, data):
        self.sent.append(data)

    def recv(self, _n):
        if self.replied:
            return b""
        self.replied = True
        return b"HTTP/1.1 101 Switching Protocols\r\n\r\n"


_raw_tls_sock = HandshakeSock()
_tls_wrapped = []


class FakeSslContext:
    def wrap_socket(self, sock, server_hostname=None):
        _tls_wrapped.append((sock, server_hostname))
        return sock


class FakeSslModule:
    @staticmethod
    def create_default_context():
        return FakeSslContext()


_old_create_connection = server.socket.create_connection
_had_ssl = hasattr(server, "ssl")
_old_ssl = getattr(server, "ssl", None)
try:
    server.socket.create_connection = lambda *_a, **_k: _raw_tls_sock
    server.ssl = FakeSslModule()
    server.ws_connect("https://gpu.example:8188", "client", timeout=1)
    ok(
        "https Comfy websocket is wrapped in TLS",
        _tls_wrapped == [(_raw_tls_sock, "gpu.example")],
        str(_tls_wrapped),
    )
finally:
    server.socket.create_connection = _old_create_connection
    if _had_ssl:
        server.ssl = _old_ssl
    else:
        del server.ssl

_proxy_sock = HandshakeSock()
try:
    server.socket.create_connection = lambda *_a, **_k: _proxy_sock
    server.ws_connect("http://[::1]:8188/comfy", "client id", timeout=1)
    request = b"".join(_proxy_sock.sent).decode("ascii")
    ok("websocket keeps reverse-proxy base path", request.startswith("GET /comfy/ws?clientId=client%20id HTTP/1.1"), request)
    ok("IPv6 websocket Host header is bracketed", "Host: [::1]:8188\r\n" in request, request)
finally:
    server.socket.create_connection = _old_create_connection

multi_history = {
    "outputs": {
        "2": {"images": [{"filename": "preview.png", "subfolder": "", "type": "temp"}]},
        "9": {"images": [{"filename": "final.png", "subfolder": "", "type": "output"}]},
    }
}
ok(
    "preferred output node returns the final image",
    "filename=final.png" in (first_image_src(multi_history, {"9"}) or ""),
    str(first_image_src(multi_history, {"9"})),
)

# === /api/image 的快取：鑰匙必須是內容，不能是檔名 =============================
# ComfyUI 的 SaveImage 依輸出資料夾現有檔案編號，資料夾清空後編號從頭開始，
# 檔名就會重複。舊版送的是一天份的 max-age，於是瀏覽器連問都不問，直接拿同檔名
# 的舊圖顯示 —— 使用者看到的是「之前生成過的圖」。
# 現在的規則：ETag 一律是內容雜湊；整年快取只給網址上帶著內容指紋（h=）而且對得上的
# —— 內容一換網址就換，不會再拿到舊圖；指紋對不上（檔名被別張圖用掉）回 404，不拿別張頂替。
_img_src = inspect.getsource(server.Handler._serve_comfy_image)
_img_headers = [
    ln for ln in _img_src.splitlines()
    if "send_header" in ln and not ln.lstrip().startswith("#")
]
_img_joined = chr(10).join(_img_headers)
ok("handler 裡不另寫 max-age：快取規則只走 image_cache_policy()", "max-age" not in _img_joined, _img_joined)
ok("有回 ETag", "ETag" in _img_joined)
ok("有處理 If-None-Match", "If-None-Match" in _img_src)
ok("ETag 算在內容上而不是檔名上", "image_digest(raw)" in inspect.getsource(server.comfy_image) and "image_cache_policy(want, digest)" in _img_src)

_d = server.image_digest(b"same bytes")
ok("沒帶指紋的舊網址：每次回來驗證", server.image_cache_policy("", _d) == (200, "private, no-cache"))
_st, _cc = server.image_cache_policy(_d[: server.IMAGE_HASH_LEN], _d)
ok("帶著對得上的指紋：整年快取", _st == 200 and "immutable" in _cc and "max-age=31536000" in _cc, _cc)
ok(
    "指紋對不上（輸出資料夾清過、檔名換成別張）：404，不拿別張頂替",
    server.image_cache_policy(server.image_digest(b"other")[: server.IMAGE_HASH_LEN], _d)[0] == 404,
)
ok(
    "指紋只收 8～40 個十六進位字",
    server.valid_image_hash(_d[:16]) and not server.valid_image_hash("zz" * 8) and not server.valid_image_hash("abc123"),
)

_real_api = server.api
_real_webp_dir = server.WEBP_DIR
import tempfile as _tempfile  # noqa: E402

server.WEBP_DIR = Path(_tempfile.mkdtemp(prefix="webp-cache-test-"))
try:
    server.api = lambda method, path, data=None, timeout=60: b"PNG BYTES" if path.startswith("/view?") else None
    _src = "/api/image?filename=x.png&subfolder=&type=output"
    _got = server.with_content_hash(_src)
    ok("出圖完成的網址帶上內容指紋", _got == _src + "&h=" + server.image_digest(b"PNG BYTES")[:16], _got)
    ok("已經帶指紋的不再加一次", server.with_content_hash(_got) == _got)
    ok("_job 送出去的網址就是帶指紋的", server._job(1, 64, 64, "p", _src)["image"] == _got)

    def _down(*a, **k):
        raise OSError("comfy down")

    server.api = _down
    ok("拿不到圖就照舊回原本的網址，不擋住出圖", server.with_content_hash(_src) == _src)
    ok("webp 轉不出來就回 None（改送原圖）", server.comfy_webp("filename=x.png&subfolder=&type=output", "f" * 40) is None)

    _calls = []

    def _webp(method, path, data=None, timeout=60):
        _calls.append(path)
        return b"RIFF....WEBPVP8 "

    server.api = _webp
    _q = "filename=y.png&subfolder=&type=output"
    _a = server.comfy_webp(_q, "a" * 40)
    _b = server.comfy_webp(_q, "a" * 40)
    ok("webp 用 ComfyUI 的 preview 轉", _a == b"RIFF....WEBPVP8 " and "preview=webp%3B85" in _calls[0], str(_calls))
    ok("同一張圖只轉一次（快取鑰匙是內容雜湊）", _a == _b and len(_calls) == 1, str(_calls))
    ok("轉好的存到硬碟", (server.WEBP_DIR / ("a" * 40 + ".webp")).read_bytes() == _a)
    server._WEBP_CACHE.clear()  # 當作伺服器重開：記憶體裡的沒了
    _c = server.comfy_webp(_q, "a" * 40)
    ok("伺服器重開後從硬碟拿，不再請 ComfyUI 轉", _c == _a and len(_calls) == 1, str(_calls))
finally:
    server.api = _real_api
    server._WEBP_CACHE.clear()
    shutil.rmtree(server.WEBP_DIR, ignore_errors=True)
    server.WEBP_DIR = _real_webp_dir


# === HTML 裡自己的程式檔帶版本（versioned_html）==================================
# 走 Tailscale 時每次重新整理要把二十幾個 .js 逐一回來問；換成帶內容雜湊的網址就整年快取。
_V = {"boot.js": "aaaaaaaaaa", "engine.js": "bbbbbbbbbb", "app.js": "cccccccccc", "styles.css": "dddddddddd"}
_html = (
    '<!doctype html><html><head><meta charset="utf-8" />'
    '<link rel="icon" href="logo.svg" />'
    '<link rel="modulepreload" href="boot.js" />'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X" />'
    '<link rel="stylesheet" href="styles.css" />'
    '<link rel="stylesheet" href="missing.css" />'
    '<script type="importmap">{"imports": {"three": "./vendor/three.js"}}</script>'
    '</head><body><script type="module" src="app.js"></script></body></html>'
)
_out = server.versioned_html(_html, lambda rel: _V.get(rel), ["boot.js", "engine.js", "app.js"])
_maps = re.findall(r'<script type="importmap">(.*?)</script>', _out)
ok("import map 只有一份（原本的合併進來）", len(_maps) == 1, _out)
_m = json.loads(_maps[0]) if _maps else {}
ok("模組彼此 import 的網址對到帶版本的", _m.get("imports", {}).get("/engine.js") == "/engine.js?v=bbbbbbbbbb", str(_m))
ok("原本的 three.js 對照保留", _m.get("imports", {}).get("three") == "./vendor/three.js", str(_m))
ok(
    "import map 在所有 <link>／<script> 前面（預載的模組才不會先用舊網址載一份）",
    _out.find('type="importmap"') < _out.find("<link") and _out.find('type="importmap"') < _out.find('rel="modulepreload"'),
    _out,
)
ok("modulepreload、入口模組、樣式表都換成帶版本的網址",
   'href="boot.js?v=aaaaaaaaaa"' in _out and 'src="app.js?v=cccccccccc"' in _out and 'href="styles.css?v=dddddddddd"' in _out, _out)
ok("外部網址、找不到的檔、icon 都不動",
   'href="https://fonts.googleapis.com/css2?family=X"' in _out and 'href="missing.css"' in _out and 'href="logo.svg"' in _out, _out)
ok("看不懂原本的 import map 就整頁照舊", server.versioned_html('<head><script type="importmap">{bad</script></head>', lambda r: "x", ["a.js"]) == '<head><script type="importmap">{bad</script></head>')
ok("第三方的 vendor 不收進 import map", not any(f.startswith("vendor/") or "/vendor/" in f for f in server.own_js_files()), str([f for f in server.own_js_files() if "vendor" in f][:3]))

# --- Discord embed ---------------------------------------------------------

NL = chr(10)
FENCE = "```"

dc_job = {
    "filename": "ComfyUI_00042_.png",
    "seed": 786465539,
    "width": 1024,
    "height": 1216,
    "zh": "1個女性、單人、長髮、排球服",
    "en": "1girl, solo, long hair, volleyball uniform, masterpiece",
}

# 檔名清洗：attachment:// 必須和上傳的檔名一字不差
ok("safe filename keeps a normal comfy name", server.dc_safe_filename("ComfyUI_00042_.png") == "ComfyUI_00042_.png")
ok("safe filename drops spaces and punctuation", " " not in server.dc_safe_filename("a b!c.png"))
ok("safe filename falls back when empty", server.dc_safe_filename("") == "shot.png")
ok("safe filename falls back when all stripped", server.dc_safe_filename("!!!") == "shot.png")

# code block 圍籬
fenced = server.dc_fence("abc", 100)
ok("fence wraps in a code block", fenced.startswith(FENCE + NL) and fenced.endswith(NL + FENCE))
ok("fence keeps short text intact", "abc" in fenced)
tight = server.dc_fence("x" * 500, 40)
ok("fence never exceeds the limit", len(tight) <= 40, f"len={len(tight)}")
ok("fence marks truncation", "…" in tight)
ok("fence still closed when truncated", tight.startswith(FENCE + NL) and tight.endswith(NL + FENCE))

# 版面：圖在第一個 embed，分欄與英文在第二個（Discord 把文字排在圖上面，拆開圖才會在最上面）
dc_full = dict(
    dc_job,
    source="墨池",
    rating="general",
    ckpt="Illustrious\\waiNSFWIllustrious_v140.safetensors",
    loras=[{"file": "style/ink_v2.safetensors", "strength": 0.8}],
)
pay = server.dc_payload(dc_full, server.dc_safe_filename(dc_full["filename"]))
hero = pay["embeds"][0]
ok("payload has no message content above the image", "content" not in pay)
ok("hero embed carries the accent colour", hero["color"] == server.DC_COLOR)
ok("hero embed shows the image inline", hero["image"]["url"] == "attachment://ComfyUI_00042_.png", hero["image"]["url"])
ok("hero embed has no text block above the image", "description" not in hero and "fields" not in hero)
ok("hero author line names the page and rating", hero["author"]["name"] == "墨池 · 全年齡", hero["author"]["name"])
foot = hero["footer"]["text"]
ok("footer has seed and size", foot.startswith("seed 786465539 · 1024×1216"), foot)
ok("footer drops model folder and extension", "waiNSFWIllustrious_v140" in foot and ".safetensors" not in foot and "Illustrious\\" not in foot, foot)
ok("footer lists lora with strength", "LoRA ink_v2 ×0.8" in foot, foot)
ok("embeds never share a url (would merge into a gallery)", all("url" not in e for e in pay["embeds"]))

detail = pay["embeds"][1]
names = [f["name"] for f in detail["fields"]]
ok("detail groups follow lexicon sections", names[:3] == ["人物", "外觀", "服裝"], str(names))
ok("detail puts the english pos last", names[-1] == "英文提示詞", str(names))
ok("english pos is copy-friendly in a code block", detail["fields"][-1]["value"].startswith(FENCE + NL))
ok("quality tags land in their own field", "畫質" in names, str(names))

# 權重、查不到的字
grouped = dict(server.dc_groups("(red hair:1.2), my_lora_trigger"))
ok("weights are stripped before lookup", grouped.get("外觀") == ["紅髮"], str(grouped))
ok("unknown tags go to 其他 as-is", grouped.get("其他") == ["my_lora_trigger"], str(grouped))

# 精簡：只剩圖那塊
compact = server.dc_payload(dc_full, "x.png", True)
ok("compact sends only the hero embed", len(compact["embeds"]) == 1 and "image" in compact["embeds"][0])

# Hires：金色、標題標出模式和倍率
hi = server.dc_payload(dict(dc_full, hires="Hires 深度 1.5×"), "x.png")
ok("hires uses the gold colour", all(e["color"] == server.DC_COLOR_HIRES for e in hi["embeds"]))
ok("hires label is the hero title", hi["embeds"][0]["title"] == "Hires 深度 1.5×")
ok("non-hires has no title", "title" not in hero)

# attachment:// 一定要對得上實際上傳的檔名
dirty = dict(dc_job, filename="a b!c.png")
fn = server.dc_safe_filename(dirty["filename"])
ok("attachment url matches the uploaded name", server.dc_payload(dirty, fn)["embeds"][0]["image"]["url"] == "attachment://" + fn)

# 沒有 seed / 尺寸 / 來源時的退路
bare = server.dc_payload({"filename": "x.png"}, "x.png")
ok("missing source falls back to 排字匣", bare["embeds"][0]["author"]["name"] == "排字匣")
ok("no footer when nothing to say", "footer" not in bare["embeds"][0])
ok("no detail embed when there is no text", len(bare["embeds"]) == 1)

# 上限
long_en = ", ".join(["some very long danbooru tag"] * 200)
big = server.dc_payload({"en": long_en}, "x.png")["embeds"][1]
ok("too-long english moves to the description", big["description"].startswith(FENCE + NL) and len(big["description"]) <= server.DC_DESC_MAX)
ok("every field stays under the field limit", all(len(f["value"]) <= server.DC_FIELD_MAX for f in big.get("fields", [])))

def dc_text_len(p):
    # Discord 的 6000 字算的是 title、description、欄位名與值、頁尾、作者名。
    n = 0
    for e in p["embeds"]:
        n += len(e.get("title", "")) + len(e.get("description", ""))
        n += len(e.get("footer", {}).get("text", "")) + len(e.get("author", {}).get("name", ""))
        n += sum(len(f["name"]) + len(f["value"]) for f in e.get("fields", []))
    return n


worst = server.dc_payload(dict(dc_full, en=long_en), "x.png")
ok("all embeds stay under discord's 6000 total", dc_text_len(worst) <= 6000, str(dc_text_len(worst)))

# multipart 仍然用 Discord 要的欄位名
dc_body, dc_boundary = server.tg_multipart(
    {"payload_json": "{}"}, "ComfyUI_00042_.png", b"\x89PNG", "image/png", field="files[0]"
)
ok("discord multipart uses files[0]", b'name="files[0]"' in dc_body)
ok("discord multipart carries payload_json", b'name="payload_json"' in dc_body)
ok("discord multipart keeps the filename", b'filename="ComfyUI_00042_.png"' in dc_body)
ok("discord multipart closes", dc_body.endswith(("--" + dc_boundary + "--" + chr(13) + NL).encode()))


# --- Discord webhook 模式 ------------------------------------------------
# 先把設定檔導去暫存目錄，跟上面 Telegram 同一個做法。這一段會改 server._dc，
# 而 dc_apply_config() 會寫檔 —— 現在的測試沒呼叫它，但只要有人補一條就會直接
# 蓋掉使用者真正的 .secrets/discord.json。這條防線要在那之前就先架好。
dc_dir = Path(tempfile.mkdtemp())
server.DC_SECRETS = dc_dir / ".secrets" / "discord.json"

# webhook 網址整條都是憑證，而且它決定圖送去哪台主機，所以驗證那一關是安全問題
# 不是體驗問題：貼錯一行的後果是成圖被 POST 到別人家。
GOOD_HOOK = "https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz"
ok("webhook 收下正常的網址", server.dc_webhook_ok(GOOD_HOOK) == GOOD_HOOK)
ok("webhook 砍掉查詢字串與結尾斜線", server.dc_webhook_ok(GOOD_HOOK + "/?wait=true") == GOOD_HOOK)
ok("webhook 接受 discordapp.com", server.dc_webhook_ok(GOOD_HOOK.replace("discord.com", "discordapp.com")).endswith("uvwxyz"))
ok("webhook 空字串當作沒填", server.dc_webhook_ok("") == "")


def dc_rejects(url: str) -> bool:
    try:
        server.dc_webhook_ok(url)
        return False
    except RuntimeError:
        return True


ok("webhook 擋掉 http", dc_rejects(GOOD_HOOK.replace("https://", "http://")))
ok("webhook 擋掉別人的網域", dc_rejects(GOOD_HOOK.replace("discord.com", "evil.example")))
ok("webhook 擋掉相似網域", dc_rejects(GOOD_HOOK.replace("discord.com", "discord.com.evil.example")))
ok("webhook 擋掉不是 webhook 的路徑", dc_rejects("https://discord.com/api/v10/channels/1/messages"))
ok("webhook 擋掉少了 token 的網址", dc_rejects("https://discord.com/api/webhooks/1234567890"))

_dc_backup = dict(server._dc)
try:
    # webhook 模式：送到那個網址，而且**不可以**帶 Authorization。
    server._dc.update({"mode": "webhook", "webhook": GOOD_HOOK, "token": "botsecret", "channelId": "999"})
    url, headers = server.dc_endpoint()
    ok("webhook 模式送到 webhook 網址", url == GOOD_HOOK, url)
    ok("webhook 模式不帶 Authorization", "Authorization" not in headers, str(sorted(headers)))
    ok("webhook 模式仍帶 User-Agent", "User-Agent" in headers)
    ok("webhook 模式算設定好了", server.dc_status()["configured"] is True)

    # 佇列的「設定好了沒」必須和面板同一份。分兩份寫過一次就出事：面板用模式判斷、
    # 佇列寫死 bot 的條件，於是 webhook 模式下面板說「已設定」，每張圖卻被擋在
    # 佇列外，錯誤訊息還說「還沒設定」。這裡用空的 job：過得了設定這一關就會
    # 倒在「bad image query」，不會真的啟動背景執行緒。
    # 必須把 bot 的欄位清空才隔離得出 webhook 模式 —— 第一版沒清，
    # 舊的 bot 條件照樣成立，於是把判斷改回寫死也還是綠的（假綠）。
    server._dc.update({"token": "", "channelId": "", "enabled": True})
    queued = server.dc_enqueue({})
    ok(
        "webhook 模式的圖排得進佇列",
        queued.get("error") != "Discord 還沒設定或沒開",
        str(queued),
    )
    server._dc.update({"token": "botsecret", "channelId": "999", "enabled": False})

    # bot 模式：走 API 路徑，帶 Bot 認證。
    server._dc.update({"mode": "bot"})
    url, headers = server.dc_endpoint()
    ok("bot 模式走 channels 路徑", url == f"{server.DC_API}/channels/999/messages", url)
    ok("bot 模式帶 Bot 認證", headers.get("Authorization") == "Bot botsecret")

    # 設定不全時要講得出是缺什麼，而不是送出去才錯。
    server._dc.update({"mode": "webhook", "webhook": ""})
    ok("webhook 模式沒網址就不算設定好", server.dc_status()["configured"] is False)
    try:
        server.dc_endpoint()
        ok("webhook 模式沒網址會擋下來", False)
    except RuntimeError:
        ok("webhook 模式沒網址會擋下來", True)

    # 憑證不可以從錯誤訊息漏回前端 —— webhook 的 token 就在網址最後一段。
    server._dc.update({"mode": "webhook", "webhook": GOOD_HOOK})
    scrubbed = server.dc_scrub(f"HTTP 401 from {GOOD_HOOK}")
    ok("dc_scrub 遮掉整條 webhook 網址", GOOD_HOOK not in scrubbed, scrubbed)
    ok("dc_scrub 遮掉 webhook 的 token 段", "abcdefghijklmnopqrstuvwxyz" not in scrubbed, scrubbed)
    ok("dc_scrub 仍遮掉 bot token", "botsecret" not in server.dc_scrub("boom botsecret"))
finally:
    server._dc.clear()
    server._dc.update(_dc_backup)
# 這一段**必須排在下面的 sys.exit(1) 之前**。它原本寫在檔尾，也就是腳本已經
# 印完 ok、決定通過之後才跑 —— 印了 FAIL 也不會讓測試失敗。實際踩到了：
# 負向詞加了 cross-section／x-ray／uterus／inset 之後備援脫節，這條印了紅字，
# 整支卻還是 exit 0。它自己的註解說「沒有人會自然發現它壞掉」，
# 而它本身就待在沒有人會發現它壞掉的位置。
# 2026-09-28：基礎負面補上 loli、child、aged down。卡面本來就有這幾個字，
# 生圖用的這條以前沒有。順序接在 inset 後面。
# --- 備援負面字串不能跟 lexicon.json 脫節 -------------------------------------
# server._negative() 讀不到 lexicon.json 時會退回一個寫死的字串，而它的註解一直
#宣稱 merge_lexicon.NEGATIVE 是唯一來源。實際上它脫節了：正式那份已經把
# censor / extra fingers / fused fingers / missing fingers / extra limbs /
# disfigured / ugly 換成 Danbooru 的正名，備援還留著舊的，還多塞了
# loli / shota / teen / child —— 備援比正式嚴格，是最難查的那種不一致。
#
# 這條直接比對兩者。只有在檔案真的不見時才會用到備援，所以沒有人會自然發現它壞掉。
def _fallback_negative() -> str:
    src = (ROOT / "server.py").read_text(encoding="utf-8")
    at = src.index("# Last resort if lexicon.json is missing")
    ret = src.index("return (", at)
    end = src.index(chr(10) + "    )", ret)
    q = chr(34)
    return "".join(re.findall(q + "([^" + q + "]*)" + q, src[ret:end]))


_fb = [t.strip() for t in _fallback_negative().split(",") if t.strip()]
_live = [t.strip() for t in server.NEGATIVE.split(",") if t.strip()]
_requested_base_negative = [
    "worst quality", "bad quality", "worst detail", "sketch", "bad hands", "extra digits",
    "censored", "bar censor", "mosaic censoring", "watermark", "signature", "english text",
    "speech bubble", "3d", "photorealistic", "inset",
    "loli", "child", "aged down",
]
ok(
    "基礎 negative prompt 使用指定的 19 個 tag 且順序一致",
    _live == _requested_base_negative,
    f"實際為 {_live}",
)
ok(
    "server.py 的備援負面字串跟 lexicon.json 一致",
    _fb == _live,
    f"備援多了 {[t for t in _fb if t not in _live]}，少了 {[t for t in _live if t not in _fb]}",
)

# --- user workflow profiles -----------------------------------------------
import workflows as wfmod

wf_td = Path(tempfile.mkdtemp())
wfmod.DATA_DIR = wf_td / "workflows"
wfmod.SETTINGS_PATH = wf_td / "settings.json"

# LoRA discovery must use the same saved Comfy URL as ping/checkpoints/generation.
import os as _os  # noqa: E402
import urllib.request as _urllib_request  # noqa: E402

_old_comfy_env = _os.environ.pop("COMFY_API", None)
_old_urlopen = _urllib_request.urlopen
_lora_urls = []

class _LoraResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({"LoraLoader": {"input": {"required": {"lora_name": [["style\\saved.safetensors"], {}]}}}}).encode()

def _lora_urlopen(req, timeout=0):
    _lora_urls.append((req.full_url, timeout))
    return _LoraResponse()

try:
    wfmod.set_comfy_api("http://saved.example:9191/base")
    _urllib_request.urlopen = _lora_urlopen
    names = server.lora_scan.lora_names_from_comfy()
    ok("LoRA discovery uses saved Comfy URL", _lora_urls == [("http://saved.example:9191/base/object_info/LoraLoader", 10)], str(_lora_urls))
    ok("LoRA discovery still parses names", names == ["style\\saved.safetensors"], str(names))

    # ComfyUI 的 LoRA Manager：分頁抓完、對成 /api/loras 的格式；lora_name = folder\檔名。
    _lm_pages = {
        1: {"items": [
            {"model_name": "Pretty Name", "file_name": "b", "file_path": "E:/loras/Character/sub/b.safetensors", "folder": "Character/sub",
             "preview_url": "/api/lm/previews?path=E%3A%2Floras%2FCharacter%2Fsub%2Fb.preview.mp4", "base_model": "Illustrious",
             "civitai": {"id": 22, "modelId": 11, "trainedWords": ["<lora:b:1> girl b, red dress", "smile"]}},
            {"model_name": "Hidden", "file_path": "E:/loras/style/x.safetensors", "folder": "style", "exclude": True},
        ], "total_pages": 2},
        2: {"items": [{"model_name": "", "file_path": "E:/loras/a.safetensors", "folder": "", "preview_url": "", "civitai": {}}], "total_pages": 2},
    }
    _lm_seen = []

    class _JsonResp:
        def __init__(self, data):
            self._b = json.dumps(data).encode()

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

        def read(self):
            return self._b

    def _lm_urlopen(req, timeout=0):
        url = req.full_url
        _lm_seen.append(url)
        page = int(url.split("page=")[1].split("&")[0])
        return _JsonResp(_lm_pages[page])

    _urllib_request.urlopen = _lm_urlopen
    raw = server.lora_scan.lora_manager_list("loras", "http://lm.example:8188")
    ok("LoRA Manager: every page is fetched", len(raw or []) == 3 and len(_lm_seen) == 2, str(_lm_seen))
    _keep_folders = list(server.lora_scan.LORA_FOLDERS)
    server.lora_scan.LORA_FOLDERS[:] = []
    lm = server.lora_scan.from_lora_manager(raw)
    server.lora_scan.LORA_FOLDERS[:] = _keep_folders
    names = [((i["folder"].replace("/", "\\") + "\\") if i["folder"] else "") + i["file"] for i in lm["items"]]
    ok("LoRA Manager: lora_name is folder\\file, excluded ones dropped", names == ["a.safetensors", "Character\\sub\\b.safetensors"], str(names))
    b = lm["items"][1]
    ok("LoRA Manager: trigger words without <lora:…>", b["trainedWords"] == ["girl b, red dress", "smile"], str(b["trainedWords"]))
    ok("LoRA Manager: title, base model, Civitai ids", (b["title"], b["base_model"], b["civitai"]) == ("Pretty Name", "Illustrious", {"modelId": 11, "versionId": 22}), str(b))
    ok("LoRA Manager: preview goes through this server, name keeps the video extension",
       b["previewUrl"].startswith("/api/lora-preview?lm=%2Fapi%2Flm%2Fpreviews%3F") and b["preview"] == "b.preview.mp4", str(b))
    ok("LoRA Manager: no preview, no previewUrl", lm["items"][0]["previewUrl"] is None and lm["items"][0]["preview"] is None)
    ok("LoRA Manager: only its preview endpoint is proxied",
       server.lora_scan.lm_preview_src("/api/lm/previews?path=x.png") and not server.lora_scan.lm_preview_src("/prompt") and not server.lora_scan.lm_preview_src("http://evil/api/lm/previews?"))

    def _lm_missing(req, timeout=0):
        raise _urllib_request.HTTPError(req.full_url, 404, "Not Found", {}, None)

    # LoRA Manager 的連結要是開網頁那台裝置連得到的：ComfyUI 只聽 127.0.0.1 時，手機（Tailscale）點了打不開 → 不給。
    import socket as _socket  # noqa: E402

    _only_local = _socket.socket()
    _only_local.bind(("127.0.0.1", 0))
    _only_local.listen()
    _lp = _only_local.getsockname()[1]
    _old_base = server.comfy_base
    server.comfy_base = lambda: f"http://127.0.0.1:{_lp}"
    server._REACH.clear()
    try:
        ok("LoRA Manager link: same machine uses 127.0.0.1", server.manager_url_for(f"127.0.0.1:8796", "/loras") == f"http://127.0.0.1:{_lp}/loras")
        _remote = server.manager_url_for("192.0.2.10:8796", "/loras")
        ok("LoRA Manager link: ComfyUI only on 127.0.0.1 → no link for another device", _remote == "", _remote)
    finally:
        server.comfy_base = _old_base
        _only_local.close()
        server._REACH.clear()

    _urllib_request.urlopen = _lm_missing
    ok("LoRA Manager not installed: list is None (falls back)", server.lora_scan.lora_manager_list("loras", "http://lm.example:8188") is None)
    ok("LoRA Manager not installed: count is None", server.lora_scan.lora_manager_count("http://lm.example:8188") is None)
finally:
    _urllib_request.urlopen = _old_urlopen
    if _old_comfy_env is not None:
        _os.environ["COMFY_API"] = _old_comfy_env

_PROFILE_WF = {
    "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "kept.safetensors"}},
    "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "OLD POS", "clip": ["4", 1]}},
    "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "OLD NEG", "clip": ["4", 1]}},
    "3": {
        "class_type": "KSampler",
        "inputs": {
            "seed": 1,
            "steps": 20,
            "cfg": 7,
            "sampler_name": "euler",
            "scheduler": "normal",
            "denoise": 1,
            "model": ["4", 0],
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0],
        },
    },
    "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
    "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
    "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "x", "images": ["8", 0]}},
    "40": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "keep_me.safetensors"}},
}

builtin_wf, builtin_meta = server.prepare_workflow(
    {"positive": "1girl", "width": 512, "height": 512, "seed": 7}
)
ok("no workflowId uses builtin SaveImage 200", builtin_wf.get("200", {}).get("class_type") == "SaveImage")
ok("no workflowId uses builtin ckpt node 13", builtin_wf.get("13", {}).get("class_type") == "CheckpointLoaderSimple")
ok("builtin meta kind", builtin_meta.get("kind") == "builtin", str(builtin_meta))
ok("blank workflowId still builtin", server.prepare_workflow({"positive": "1girl", "workflowId": ""})[1].get("kind") == "builtin")

_prof = wfmod.save_profile(
    "case",
    _PROFILE_WF,
    {
        "positive": {"node": "6", "input": "text", "mode": "control"},
        "negative": {"node": "7", "input": "text", "mode": "keep"},
        "seed": {"node": "3", "input": "seed", "mode": "keep"},
        "checkpoint": {"node": "4", "input": "ckpt_name", "mode": "keep"},
    },
)
user_wf, user_meta = server.prepare_workflow(
    {
        "positive": "1girl, from profile",
        "negative": "SHOULD NOT",
        "seed": 99,
        "ckpt": "other.safetensors",
        "workflowId": _prof["id"],
        "width": 1024,
        "height": 1024,
    }
)
ok("profile kind", user_meta.get("kind") == "profile", str(user_meta))
ok("profile injects positive", user_wf["6"]["inputs"]["text"] == "1girl, from profile")
ok("profile keeps negative", user_wf["7"]["inputs"]["text"] == "OLD NEG")
ok("profile keeps seed", user_wf["3"]["inputs"]["seed"] == 1)
ok("profile keeps checkpoint", user_wf["4"]["inputs"]["ckpt_name"] == "kept.safetensors")
ok("profile keeps ControlNet", user_wf["40"]["inputs"]["control_net_name"] == "keep_me.safetensors")
ok("profile does not grow builtin node 200", "200" not in user_wf)
ok(
    "on-disk original still OLD POS",
    json.loads((wfmod.DATA_DIR / _prof["id"] / "workflow.json").read_text(encoding="utf-8"))["6"]["inputs"]["text"]
    == "OLD POS",
)

_bare = wfmod.save_profile("bare", _PROFILE_WF, {})
ok("import without mapping auto-detects positive", wfmod.mapping_ready(wfmod.get_profile(_bare["id"])["mapping"]))
wfmod.update_mapping(_bare["id"], {})
try:
    server.prepare_workflow({"positive": "1girl", "workflowId": _bare["id"]})
    ok("unmapped profile refused", False)
except Exception as exc:
    ok("unmapped profile refused", "Positive" in str(exc) or "positive" in str(exc).lower() or "節點" in str(exc), str(exc))

try:
    server.prepare_workflow({"positive": "1girl", "workflowId": "no-such"})
    ok("missing profile refused", False)
except Exception as exc:
    ok("missing profile refused", True, str(exc))

# 種子：KSamplerAdvanced（noise_seed）、兩段式、Primitive 接過來的種子都要換；舊版存檔沒有 seed 設定的自動補。
import copy as _copy
_adv = _copy.deepcopy(_PROFILE_WF)
_adv["3"] = {"class_type": "KSamplerAdvanced", "inputs": {**{k: v for k, v in _PROFILE_WF["3"]["inputs"].items() if k != "seed"}, "noise_seed": 5}}
ok("seed: noise_seed detected", wfmod.suggest_mapping(_adv).get("seed", {}).get("input") == "noise_seed", str(wfmod.suggest_mapping(_adv).get("seed")))
_two = _copy.deepcopy(_PROFILE_WF)
_two["30"] = {"class_type": "KSampler", "inputs": {**_PROFILE_WF["3"]["inputs"], "seed": 7, "latent_image": ["3", 0]}}
_two["8"]["inputs"]["samples"] = ["30", 0]
_two_seed = wfmod.suggest_mapping(_two).get("seed") or {}
ok("seed: two samplers both controlled", _two_seed.get("mode") == "control" and len(_two_seed.get("also") or []) == 1, str(_two_seed))
_prim = _copy.deepcopy(_PROFILE_WF)
_prim["50"] = {"class_type": "PrimitiveInt", "inputs": {"value": 3}}
_prim["3"]["inputs"]["seed"] = ["50", 0]
ok("seed: linked primitive followed", (wfmod.suggest_mapping(_prim).get("seed") or {}).get("node") == "50", str(wfmod.suggest_mapping(_prim).get("seed")))
_legacy_map = wfmod.suggest_mapping(_two)
_legacy_map.pop("seed")
_legacy = wfmod.save_profile("legacy-two-pass", _two, _legacy_map)
_lw, _ = server.prepare_workflow({"positive": "1girl", "seed": 4242, "workflowId": _legacy["id"]})
ok("seed: legacy profile without seed setting gets every sampler seeded", _lw["3"]["inputs"]["seed"] == 4242 and _lw["30"]["inputs"]["seed"] == 4242, str((_lw["3"]["inputs"]["seed"], _lw["30"]["inputs"]["seed"])))
_lw2, _ = server.prepare_workflow({"positive": "1girl", "seed": 4242, "workflowId": _prof["id"]})
ok("seed: an explicit keep is still respected", _lw2["3"]["inputs"]["seed"] == 1)

# LoRA：沒有指定 LoRA 節點時，LoRA 面板選的接在底模後面；指定了就照指定。
_lr, _ = server.prepare_workflow({"positive": "1girl", "workflowId": _legacy["id"], "loras": [{"file": "a.safetensors", "strength": 0.6}]})
_lora_nodes = [k for k, n in _lr.items() if n["class_type"] == "LoraLoader"]
ok("lora: inserted after the checkpoint", len(_lora_nodes) == 1 and _lr[_lora_nodes[0]]["inputs"]["model"] == ["4", 0], str(_lora_nodes))
ok("lora: samplers and text encoders use the LoRA", _lr["3"]["inputs"]["model"] == [_lora_nodes[0], 0] and _lr["6"]["inputs"]["clip"] == [_lora_nodes[0], 1])
ok("lora: VAE still from the checkpoint", _lr["8"]["inputs"]["vae"] == ["4", 2])
_nolora, _ = server.prepare_workflow({"positive": "1girl", "workflowId": _legacy["id"]})
ok("lora: nothing inserted when none picked", not any(n["class_type"] == "LoraLoader" for n in _nolora.values()))

ok(
    "empty ckpt pool accepts a Comfy-style name",
    server.resolve_ckpt(r"extra\remote.safetensors", []) == r"extra\remote.safetensors",
)
ok(
    "empty ckpt pool still rejects parent",
    server.resolve_ckpt(r"..\evil.safetensors", []) == str(server.CKPT).replace("/", "\\"),
)

# === 沒選底模時：預設的不在這台 ComfyUI 就挑一個有的 ==============================
# 別台電腦從 GitHub 拉下來，ComfyUI 裡沒有作者的底模檔名，網頁第一次生圖沒選過底模就會被退件。
_pool = [
    {"ckpt_name": r"sd15\dreamshaper_8.safetensors", "file": "dreamshaper_8.safetensors"},
    {"ckpt_name": r"SDXL\animagineXL40_v4.safetensors", "file": "animagineXL40_v4.safetensors"},
]
ok("預設的底模不在：沒選時挑動漫 XL 的那個", server.resolve_ckpt(None, _pool) == r"SDXL\animagineXL40_v4.safetensors", server.resolve_ckpt(None, _pool))
ok("指定的底模已經不在：也退回挑出來的那個", server.resolve_ckpt(r"gone\old.safetensors", _pool) == r"SDXL\animagineXL40_v4.safetensors")
_withdef = _pool + [{"ckpt_name": str(server.CKPT).replace("/", "\\"), "file": str(server.CKPT).replace("/", "\\").split("\\")[-1]}]
ok("預設的底模在清單裡就用預設的", server.resolve_ckpt(None, _withdef) == str(server.CKPT).replace("/", "\\"))
ok("都不像動漫底模就用第一個", server.pick_default_ckpt([r"a\x.safetensors", r"b\y.safetensors"]) == r"a\x.safetensors")
ok("清單是空的回 None（呼叫端退回預設）", server.pick_default_ckpt([]) is None)

# === 預覽幀節流：遠端連線不被 2.5 MB 的預覽塞住 =====================================
ok("第一幀一定送", server.preview_due(0.0, 100.0, 0.6))
ok("間隔不到就不送", not server.preview_due(100.0, 100.3, 0.6))
ok("間隔到了就送", server.preview_due(100.0, 100.6, 0.6))
ok("gap=0 每一步都送", server.preview_due(100.0, 100.01, 0))
_ws_src = (ROOT / "server.py").read_text(encoding="utf-8")
ok("gen_via_ws 的預覽走 preview_due", "if not preview_due(last_pv, now):" in _ws_src)
ok("斷線時排隊中的那張從佇列拿掉", _ws_src.count('api("POST", "/queue", {"delete": [prompt_id]}') >= 1)

# === lora-push 長輪詢 ===============================================================
_ws_src2 = (ROOT / "server.py").read_text(encoding="utf-8")
ok("lora-push 有長輪詢（wait=N，最多 25 秒）", "_LORA_PUSH_COND.wait_for(" in _ws_src2 and "LORA_PUSH_MAX_WAIT = 25.0" in _ws_src2)
ok("推送一進來就叫醒等著的人", "_LORA_PUSH_COND.notify_all()" in _ws_src2)
ok("沒人接回的工作也從佇列拿掉（不只按停的）", "沒人接回來的也一樣要從佇列拿掉" in _ws_src2 and "                if self.cancelled:\n                    try:\n                        api(\"POST\", \"/queue\"" not in _ws_src2)

src = (ROOT / "server.py").read_text(encoding="utf-8")
ok(
    "gen no longer waits only on node 200",
    'd.get("node") not in (None, "200")' not in src,
)

# --- JSON API 也要 gzip -------------------------------------------------------
# 靜態檔早就有 gzip + ETag，JSON 這條路漏了：/api/loras 實測 518 KB（938 顆 LoRA，
# trainedWords 佔一半），gzip 5 級壓到 96 KB，花 5 ms。手機走 Tailscale 開 LoRA 選單
# 等的就是這 518 KB。小回應不壓（標頭比省下的還多），沒說收 gzip 的客戶端照原樣給。
import gzip as _gzip
import io as _io


class _JsonProbe:
    def __init__(self, accept):
        self.headers = {"Accept-Encoding": accept} if accept else {}
        self.sent = {}
        self.code = None
        self.wfile = _io.BytesIO()

    def send_response(self, code):
        self.code = code

    def send_header(self, k, v):
        self.sent[k] = v

    def end_headers(self):
        pass


def _json_via(accept, obj):
    probe = _JsonProbe(accept)
    Handler._json(probe, 200, obj)
    return probe, probe.wfile.getvalue()


_big = {"items": [{"file": f"lora_{i}.safetensors", "trainedWords": ["alpha beta gamma"] * 6} for i in range(400)]}
_probe, _body = _json_via("gzip, deflate, br", _big)
_gz = _probe.sent.get("Content-Encoding") == "gzip"
ok("大的 JSON 回應在客戶端收 gzip 時壓縮", _gz, str(_probe.sent))
if _gz:
    _plain = _gzip.decompress(_body)
    ok("壓縮後解開跟原本一模一樣", json.loads(_plain) == _big)
    ok("Content-Length 是壓縮後的長度", _probe.sent.get("Content-Length") == str(len(_body)))
    ok("壓縮後的回應標明 Vary: Accept-Encoding", _probe.sent.get("Vary") == "Accept-Encoding")
    ok("壓縮真的有省", len(_body) < len(_plain) / 3, f"{len(_body)} vs {len(_plain)}")

_probe, _body = _json_via(None, _big)
ok("客戶端沒說收 gzip 就不壓", "Content-Encoding" not in _probe.sent and json.loads(_body) == _big)

_probe, _body = _json_via("gzip", {"ok": True})
ok("小回應不壓", "Content-Encoding" not in _probe.sent and json.loads(_body) == {"ok": True})
ok("JSON 仍然不准快取", _probe.sent.get("Cache-Control") == "no-store")


def _ihdr(width: int, height: int) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + struct.pack(">I", 13)
        + b"IHDR"
        + struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    )


# === Hires：內建圖、倍率、上限、路徑、放大模型 =================================
_q = server.build_hires_workflow("1girl", 7, "quick", 1.5, "danbooru_hires/a.png", rating="explicit")
ok("quick LoadImage", _q["50"]["class_type"] == "LoadImage" and _q["50"]["inputs"]["image"] == "danbooru_hires/a.png")
ok("quick VAEEncode then LatentUpscaleBy", _q["51"]["class_type"] == "VAEEncode" and _q["52"]["class_type"] == "LatentUpscaleBy")
ok("quick nearest-exact", _q["52"]["inputs"]["upscale_method"] == "nearest-exact" and _q["52"]["inputs"]["scale_by"] == 1.5)
ok("quick has no pixel upscale nodes", "53" not in _q and "54" not in _q)
_ks = _q["60"]["inputs"]
ok(
    "quick sampler",
    _q["60"]["class_type"] == "KSampler"
    and _ks["steps"] == 20
    and _ks["cfg"] == 5
    and _ks["sampler_name"] == "euler_ancestral"
    and _ks["scheduler"] == "normal"
    and _ks["denoise"] == 0.5
    and _ks["latent_image"] == ["52", 0]
    and _ks["seed"] == 7,
    str(_ks),
)
ok("quick decode and save", _q["61"]["class_type"] == "VAEDecode" and _q["62"]["inputs"]["filename_prefix"] == "danbooru_case/hires")
ok("quick negative follows rating", _q["37"]["inputs"]["text"] == server.negative_for("explicit"))

_d = server.build_hires_workflow(
    "1girl",
    9,
    "deep",
    2.0,
    "danbooru_hires/b.png",
    upscale_model="RealESRGAN_x4plus_anime_6B.pth",
    loras=[{"file": "a.safetensors", "strength": 0.4}],
)
ok("deep loader", _d["51"]["class_type"] == "UpscaleModelLoader" and _d["51"]["inputs"]["model_name"].endswith("6B.pth"))
ok("deep ImageUpscaleWithModel", _d["52"]["class_type"] == "ImageUpscaleWithModel")
ok(
    "deep lanczos scale/4",
    _d["53"]["class_type"] == "ImageScaleBy"
    and _d["53"]["inputs"]["upscale_method"] == "lanczos"
    and _d["53"]["inputs"]["scale_by"] == 0.5,
    str(_d["53"]["inputs"]),
)
ok("deep encode after the pixel scale", _d["54"]["class_type"] == "VAEEncode" and _d["60"]["inputs"]["latent_image"] == ["54", 0])
ok("deep denoise 0.4", _d["60"]["inputs"]["denoise"] == 0.4 and _d["60"]["inputs"]["steps"] == 20 and _d["60"]["inputs"]["cfg"] == 5)
ok("deep lora rewires model and clip, not vae", _d["201"]["class_type"] == "LoraLoader" and _d["60"]["inputs"]["model"] == ["201", 0])
ok("deep clip goes through the lora", _d["36"]["inputs"]["clip"] == ["201", 1] and _d["54"]["inputs"]["vae"] == ["13", 2])

_old_cfg = server.CONFIG
server.CONFIG = {"hires": {"steps": 11, "cfg": 3, "denoise": 0.25}}
try:
    _over = server.build_hires_workflow("1girl", 1, "quick", 1.5, "danbooru_hires/a.png")
    _ok = _over["60"]["inputs"]
    ok("hires steps/cfg/denoise settings", _ok["steps"] == 11 and _ok["cfg"] == 3 and _ok["denoise"] == 0.25, str(_ok))
finally:
    server.CONFIG = _old_cfg

_hi = server.parse_hires({"mode": "quick", "scale": 9, "image": "/api/image?filename=a.png&type=output&h=abc"})
_lo = server.parse_hires({"mode": "deep", "scale": 0.2, "image": "/api/image?filename=a.png"})
_mid = server.parse_hires({"mode": "quick", "scale": "1.5", "image": "/api/image?filename=a.png&subfolder=batch&type=output"})
ok("scale clamps high", _hi["scale"] == 3.0, str(_hi))
ok("scale clamps low", _lo["scale"] == 1.25, str(_lo))
ok("scale keeps a number inside the range", _mid["scale"] == 1.5 and "subfolder=batch" in _mid["view"], str(_mid))
for _bad, _label in (("nope", "text"), (None, "none"), (float("nan"), "nan")):
    try:
        server.parse_hires({"mode": "quick", "scale": _bad, "image": "/api/image?filename=a.png"})
        ok(f"scale {_label} rejected", False)
    except server.HiresError as exc:
        ok(f"scale {_label} rejected", "不是數字" in str(exc), str(exc))
try:
    server.parse_hires({"mode": "fast", "scale": 1.5, "image": "/api/image?filename=a.png"})
    ok("mode rejected", False)
except server.HiresError as exc:
    ok("mode rejected", "quick" in str(exc), str(exc))
try:
    server.parse_hires({"mode": "quick", "scale": 1.5, "image": "https://evil.example/a.png"})
    ok("non /api/image rejected", False)
except server.HiresError as exc:
    ok("non /api/image rejected", "/api/image" in str(exc), str(exc))
for _bad_image, _label in (
    ("/api/image?filename=../a.png", "slash name"),
    ("/api/image?filename=a.png&subfolder=../x", "dotdot subfolder"),
    ("/api/image?filename=%2e%2e", "encoded dotdot"),
    ("/api/image?filename=a%2Fb.png", "encoded slash"),
):
    try:
        server.parse_hires({"mode": "quick", "scale": 1.5, "image": _bad_image})
        ok(f"path {_label} rejected", False)
    except server.HiresError as exc:
        ok(f"path {_label} rejected", "不合法" in str(exc), str(exc))

_pool = [
    "4x-UltraSharp.pth",
    "packs/4x-AnimeSharp.pth",
    r"esrgan\RealESRGAN_x4plus_anime_6B.pth",
]
ok(
    "model pick prefers the configured name",
    server.pick_upscale_model(_pool, "4x-UltraSharp.pth") == "4x-UltraSharp.pth",
)
ok(
    "model pick then the 6B file",
    server.pick_upscale_model(_pool, "") == r"esrgan\RealESRGAN_x4plus_anime_6B.pth",
)
ok(
    "model pick then an anime 4x",
    server.pick_upscale_model(["4x-UltraSharp.pth", "packs/4x-AnimeSharp.pth"], "") == "packs/4x-AnimeSharp.pth",
)
ok(
    "model pick then any 4x",
    server.pick_upscale_model(["2x.pth", "foo/4x-UltraSharp.pth"], "") == "foo/4x-UltraSharp.pth",
)
try:
    server.pick_upscale_model(["2x.pth"], "")
    ok("model pick explains when nothing matches", False)
except server.HiresError as exc:
    ok(
        "model pick explains when nothing matches",
        str(exc) == "Comfy 沒有放大模型，深度 Hires 做不了；快速 Hires 不需要",
        str(exc),
    )

for _w, _h, _scale, _mode in ((1024, 1024, 1.25, "quick"), (1000, 803, 1.37, "quick"), (832, 1216, 1.5, "deep"), (640, 480, 2.0, "deep")):
    _ow, _oh = server.hires_output_size(_w, _h, _scale, _mode)
    ok(f"output multiple of 8 {_mode} {_w}x{_h}", _ow % 8 == 0 and _oh % 8 == 0 and _ow >= 8 and _oh >= 8, f"{_ow}x{_oh}")

_saved_api = server.api
_saved_upload = server.comfy_upload_image
_saved_models = server.models_from_comfy
_saved_hires_dir = server.hires_input_dir
# 放大測試會順手清上傳目錄。指到暫存，不要碰到本機 Comfy 的 input。
server.hires_input_dir = lambda checkpoint_dir=None: Path(_tempfile.mkdtemp(prefix="hires-prune-test-"))


class _HiresHold:
    png = _ihdr(64, 64)
    uploads = 0
    model_calls = 0


def _hires_api(method, path, data=None, timeout=60):
    if method == "GET" and str(path).startswith("/view?"):
        return _HiresHold.png
    if method == "GET" and path == "/queue":
        return {"queue_running": [], "queue_pending": []}
    raise AssertionError((method, path))


def _hires_upload(raw, filename):
    _HiresHold.uploads += 1
    return "danbooru_hires/" + filename


def _hires_models(kind):
    # resolve_ckpt 也會來問 checkpoints。這裡只計深度放大要的那一份。
    if kind != "upscale":
        return ["fake.safetensors"]
    _HiresHold.model_calls += 1
    return [r"esrgan\RealESRGAN_x4plus_anime_6B.pth", "4x-UltraSharp.pth"]


server.api = _hires_api
server.comfy_upload_image = _hires_upload
server.models_from_comfy = _hires_models
try:
    _HiresHold.png = _ihdr(32, 48)
    _wf, _meta = server.prepare_workflow(
        {
            "positive": "1girl",
            "seed": 4,
            "workflowId": "no-such-profile",
            "hires": {"mode": "quick", "scale": 1.25, "image": "/api/image?filename=out.png&type=output"},
        }
    )
    ok("hires ignores workflowId", _meta.get("kind") == "hires" and _wf["50"]["class_type"] == "LoadImage", str(_meta))
    ok("quick output size is the upscaled size", (_meta["width"], _meta["height"]) == (40, 64), str(_meta))
    ok("quick meta hires", _meta.get("hires") == {"mode": "quick", "scale": 1.25}, str(_meta.get("hires")))
    ok("quick does not ask for an upscale model", _HiresHold.model_calls == 0, str(_HiresHold.model_calls))
    _uploads_before_limit = _HiresHold.uploads
    _HiresHold.png = _ihdr(1024, 1024)
    try:
        server.prepare_workflow(
            {
                "positive": "1girl",
                "seed": 1,
                "hires": {"mode": "quick", "scale": 3, "image": "/api/image?filename=big.png"},
            }
        )
        ok("over-limit quick says the max scale", False)
    except server.HiresError as exc:
        ok("over-limit quick says the max scale", str(exc).startswith("這張最多放大到 ×"), str(exc))
    _HiresHold.png = _ihdr(4000, 4000)
    try:
        server.prepare_workflow(
            {
                "positive": "1girl",
                "seed": 1,
                "hires": {"mode": "quick", "scale": 1.25, "image": "/api/image?filename=huge.png"},
            }
        )
        ok("already over the cap", False)
    except server.HiresError as exc:
        ok("already over the cap", "已經到放大上限" in str(exc), str(exc))
    _before_uploads = _HiresHold.uploads
    ok("limit errors do not upload", _before_uploads == _uploads_before_limit, str(_before_uploads))
    _HiresHold.png = _ihdr(64, 64)
    _wf, _meta = server.prepare_workflow(
        {
            "positive": "1girl",
            "seed": 5,
            "workflowId": "no-such-profile",
            "rating": "general",
            "hires": {"mode": "deep", "scale": 2, "image": "/api/image?filename=out.png"},
        }
    )
    ok("deep uses the 6B model", _wf["51"]["inputs"]["model_name"].endswith("6B.pth"), str(_wf["51"]))
    ok("deep meta size", (_meta["width"], _meta["height"]) == server.hires_output_size(64, 64, 2, "deep", 4), str(_meta))
    ok("deep negative follows rating", _wf["37"]["inputs"]["text"] == server.negative_for("general"))
    ok("deep uploads the source image", _HiresHold.uploads == _before_uploads + 1, str(_HiresHold.uploads))
    server.models_from_comfy = lambda kind: ["2x.pth"]
    try:
        server.prepare_workflow(
            {
                "positive": "1girl",
                "seed": 1,
                "hires": {"mode": "deep", "scale": 1.5, "image": "/api/image?filename=out.png"},
            }
        )
        ok("deep without a model", False)
    except server.HiresError as exc:
        ok(
            "deep without a model",
            str(exc) == "Comfy 沒有放大模型，深度 Hires 做不了；快速 Hires 不需要",
            str(exc),
        )
    _HiresHold.png = b"GIF89a"
    try:
        server.prepare_workflow(
            {
                "positive": "1girl",
                "seed": 1,
                "hires": {"mode": "quick", "scale": 1.5, "image": "/api/image?filename=a.png"},
            }
        )
        ok("non-png explains itself", False)
    except server.HiresError as exc:
        ok("non-png explains itself", "PNG" in str(exc) or "IHDR" in str(exc), str(exc))
finally:
    server.api = _saved_api
    server.comfy_upload_image = _saved_upload
    server.models_from_comfy = _saved_models
    server.hires_input_dir = _saved_hires_dir


# ---- 取樣參數（工作流面板）：payload 指定 steps／CFG／denoise，夾在範圍裡，沒給用預設 ----
sv = server.sampling_value
ok("sampling: 沒給用預設", sv(None, "steps", 25) == 25 and sv("", "cfg", 6.5) == 6.5 and sv(True, "steps", 25) == 25)
ok("sampling: 夾在範圍裡", sv(500, "steps", 25) == 80 and sv(0, "cfg", 6.5) == 1.0 and sv(3, "denoise", 0.5) == 1.0 and sv(0, "denoise", 0.5) == 0.05)
ok("sampling: 不是數字用預設", sv("abc", "steps", 25) == 25 and sv(float("nan"), "cfg", 6.5) == 6.5)
ok("sampling: steps 是整數", sv("30.6", "steps", 25) == 31 and isinstance(sv(30.6, "steps", 25), int))
wf_b = server.build_workflow("1girl", 1024, 1024, 1, steps=30, cfg_scale=4.5)
ok("sampling: 內建生圖套用 steps／CFG", wf_b["35"]["inputs"]["steps"] == 30 and wf_b["35"]["inputs"]["cfg"] == 4.5)
wf_d = server.build_workflow("1girl", 1024, 1024, 1)
ok("sampling: 沒給就是設定檔的", wf_d["35"]["inputs"]["steps"] == server.STEPS and wf_d["35"]["inputs"]["cfg"] == server.CFG)
st, cf, dn = server.hires_sampler("quick", {"steps": 12, "cfg": 7, "denoise": 0.35})
ok("sampling: Hires 套用這次指定的", (st, cf, dn) == (12, 7.0, 0.35), str((st, cf, dn)))
st, cf, dn = server.hires_sampler("deep", {"denoise": 9})
ok("sampling: Hires 沒給的用預設、給的夾範圍", st == server.hires_defaults("deep")["steps"] and dn == 1.0, str((st, cf, dn)))
spec = server.parse_hires({"mode": "deep", "scale": 2, "image": "/api/image?filename=a.png&type=output", "steps": 25, "denoise": 0.3})
ok("sampling: parse_hires 帶出取樣參數", spec["sampling"] == {"steps": 25, "denoise": 0.3}, str(spec.get("sampling")))
d = server.sampling_defaults()
ok("sampling: /api/sampling 給兩種 Hires 各自的預設", d["hires"]["quick"]["denoise"] != d["hires"]["deep"]["denoise"] and d["base"]["steps"] == server.STEPS)

# ---- 頂欄的生圖進度：GET /api/gen/active（gen-status.js）----
import threading as _th  # noqa: E402
import time as _time  # noqa: E402

_gate = _th.Event()


def _events():
    yield ("progress", {"value": 5, "max": 20})
    _gate.wait(5)
    yield ("done", {"image": "/api/image?filename=x.png"})


_job = server.GenJob(_events(), {"origin": "mochi", "positive": r"1girl, ganyu \(genshin impact\), (smile:1.2)", "seed": 7, "width": 832, "height": 1216, "ckpt": "a.safetensors", "loras": [{"folder": "style", "file": "ink.safetensors", "strength": 0.8}], "steps": 30}).start()
for _ in range(200):
    if _job.started:
        break
    _time.sleep(0.01)
_act = {j["id"]: j for j in server.active_jobs()}.get(_job.id) or {}
ok("active: 畫到一半的看得到（哪一頁送的、畫到幾成）", _act.get("state") == "running" and _act.get("progress") == 0.25 and _act.get("origin") == "mochi" and _act.get("kind") == "gen", str(_act))
_job.left_at = _time.time() - server.GEN_REATTACH_SEC - 1
ok("active: 沒人接、也沒有頁面在問：照舊算放棄", _job.abandoned())
server.active_jobs()
ok("active: 只是看看（沒帶 keep）不續命", _job.abandoned())
server.active_jobs(keep=True)
ok("active: 還有頁面開著（keep）就不砍", not _job.abandoned())
_gate.set()
for _ in range(200):
    if _job.finished:
        break
    _time.sleep(0.01)
_act = {j["id"]: j for j in server.active_jobs()}.get(_job.id) or {}
ok("active: 印好的留著給別頁說「印好了」", _act.get("state") == "done" and _act.get("finishedAt", 0) > 0, str(_act))
_job.finished_at -= server.GEN_KEEP_DONE_SEC + 1
ok("active: 太久以前印好的不列", _job.id not in {j["id"] for j in server.active_jobs()})

# ---- 出圖日誌（gen_log.py）：做完記一行，按停的不記；拿掉的註記、復原 ----
import gen_log as _gl  # noqa: E402

ok("genlog: 測試寫在暫存，不碰真的 data/", "gen_log.jsonl" in str(_gl.LOG_PATH) and str(server.ROOT / "data") not in str(_gl.LOG_PATH), str(_gl.LOG_PATH))
for _ in range(200):
    _row = next((r for r in _gl.all_items() if r["id"] == _job.id), None) or {}
    if _row:
        break
    _time.sleep(0.01)
ok("genlog: 印好的記一行（哪一頁、配方、耗時、圖）", _row.get("ok") is True and _row.get("origin") == "mochi" and _row.get("image") == "/api/image?filename=x.png" and _row.get("width") == 832 and _row.get("steps") == 30 and isinstance(_row.get("ms"), int) and _row.get("drawMs") is not None, str(_row))
ok("genlog: 提示詞還原成牌的寫法（Comfy 的跳脫拿掉）", _row.get("positive") == "1girl, ganyu (genshin impact), (smile:1.2)", str(_row.get("positive")))
ok("genlog: LoRA 記資料夾／檔名和強度", _row.get("loras") == [{"folder": "style", "file": "ink.safetensors", "strength": 0.8}], str(_row.get("loras")))


def _bad():
    yield ("error", {"error": "Comfy 爆了"})


_b = server.GenJob(_bad(), {"origin": "fuse", "positive": "x", "seed": 1}).start()
# 日誌在放開鎖之後才寫：等那一行出現，不是等 finished。
for _ in range(200):
    _brow = next((r for r in _gl.all_items() if r["id"] == _b.id), None) or {}
    if _brow:
        break
    _time.sleep(0.01)
ok("genlog: 印壞的也記（帶原因）", _brow.get("ok") is False and _brow.get("error") == "Comfy 爆了" and _brow.get("origin") == "fuse", str(_brow))
_cg = _th.Event()


def _slow():
    _cg.wait(5)
    yield ("done", {"image": "/y"})


_cj = server.GenJob(_slow(), {"origin": "mochi", "positive": "x"}).start()
_cj.cancelled = True
_cj.push("error", {"error": "已取消"})
_cg.set()
ok("genlog: 按停的不記", not any(r["id"] == _cj.id for r in _gl.all_items()))
_gl.mark(_job.id, "discard")
ok("genlog: 單張拿掉記成 discard", next(r for r in _gl.all_items() if r["id"] == _job.id).get("mark") == "discard")
_gl.mark(_job.id, None)
ok("genlog: 復原蓋掉 discard", not next(r for r in _gl.all_items() if r["id"] == _job.id).get("mark"))
try:
    _gl.mark(_job.id, "love")
    ok("genlog: 不認得的註記擋掉", False)
except ValueError:
    ok("genlog: 不認得的註記擋掉", True)
_pg = _gl.page(1)
ok("genlog: 新的在前、分頁有 more", len(_pg["items"]) == 1 and _pg["more"] and _pg["total"] >= 2 and _pg["items"][0]["at"] >= _gl.page(1, _pg["items"][0]["at"])["items"][0]["at"])
with open(_gl.LOG_PATH, "a", encoding="utf-8") as _f:
    _f.write("{壞掉的一行" + chr(10))
ok("genlog: 壞一行不連累整份", len(_gl.all_items()) >= 2)

# ---- 統計：牌的戰績、模型成績單 ----
_saved_log = _gl.LOG_PATH
_gl.LOG_PATH = Path(_env_tmp.mkdtemp()) / "stats.jsonl"
_t0 = _time.time()


def _put(i, positive, ok=True, ckpt="m/a.safetensors", loras=(), kind="gen", seed=None):
    p = {"positive": positive, "seed": seed if seed is not None else i, "ckpt": ckpt, "loras": list(loras)}
    if kind == "hires":
        p["hires"] = {"mode": "quick", "scale": 1.5, "image": "/x"}
    d = {"image": f"/api/image?filename={i}.png", "seed": p["seed"]} if ok else {"error": "x"}
    _gl.record(_gl.entry_of(f"s{i}", p, ok, d, origin="mochi", kind=kind, created_at=_t0 - 30, started_at=_t0 - 20, finished_at=_t0 + i))


_put(1, "1girl, kimono, (rain:1.2)")
_put(2, "1girl, kimono, night")
_put(3, "1girl, school uniform", loras=[{"folder": "s", "file": "ink.safetensors", "strength": 1}])
_put(4, "1girl, kimono", ok=False)
_put(5, "1girl, kimono, (rain:1.2)", kind="hires", seed=1)
_put(6, "1girl, school uniform", ckpt="m/b.safetensors")
_gl.mark("s2", "discard")
_known = frozenset({"1girl", "kimono", "rain", "night", "school uniform"})
_st = _gl.stats(_known, [{"id": "w1", "seed": 1, "positive": "1girl, kimono, (rain:1.2)"}, {"id": "w9", "seed": 999, "positive": "1girl"}])
ok("stats: 每張牌 [印好幾張, 收藏, 撤下]（Hires、印壞的不算）", _st["cards"].get("kimono") == [2, 1, 1] and _st["cards"].get("rain") == [1, 1, 0] and _st["cards"].get("1girl") == [4, 1, 1] and _st["total"] == 4 and _st["fav"] == 1 and _st["discard"] == 1, str(_st["cards"]))
ok("stats: 收藏靠種子＋牌對上（權重寫法不影響）", _st["cards"]["rain"][1] == 1)
ok("stats: 成就用的每天張數、24 小時分布、作品冊件數", sum(_st["days"].values()) == 4 and len(_st["hours"]) == 24 and sum(_st["hours"]) == 4 and _st["works"] == 2, str((_st["days"], _st["works"])))
_ma = next((m for m in _st["models"] if m["kind"] == "ckpt" and m["name"] == "a"), {})
_ml = next((m for m in _st["models"] if m["kind"] == "lora" and m["name"] == "ink"), {})
ok("stats: 底模成績（張數、收藏、撤下、印壞、平均畫多久、常配的牌、代表作先挑收藏的）", _ma.get("n") == 3 and _ma.get("fav") == 1 and _ma.get("discard") == 1 and _ma.get("failed") == 1 and _ma.get("drawMs") == 22000 and _ma.get("cards", [None])[0] == "1girl" and (_ma.get("best") or {}).get("id") == "s1", str(_ma))
ok("stats: LoRA 也各算一份；多的排前面", _ml.get("n") == 1 and _st["models"][0]["name"] == "a", str(_st["models"]))
_fi = {"_known": _known, _gl.fav_key(1, ["1girl", "kimono", "rain"]): {"id": "w1", "thumb": "/api/recipes/files/w1.webp"}}
_bt = _gl.by_tag("kimono", _fi)
ok("bytag: 用到這張牌、印好的才算（Hires、印壞的不算）", _bt["total"] == 2 and {r["id"] for r in _bt["items"]} == {"s1", "s2"}, str(_bt))
ok("bytag: 收藏過的排第一、帶作品冊的縮圖；撤下的排最後", _bt["items"][0]["id"] == "s1" and _bt["items"][0]["fav"] == "w1" and _bt["items"][0]["albumThumb"].endswith("w1.webp") and _bt["items"][-1]["mark"] == "discard")
ok("bytag: 分頁", _gl.by_tag("kimono", _fi, limit=1, offset=1)["items"][0]["id"] == "s2" and _gl.by_tag("", _fi)["total"] == 0)
ok("stats: 提示詞拆字跟 usage.js 一樣", _gl.tags_of("(smile:1.2), 1girl,1girl ,  (a (b):0.9)") == ["smile", "1girl", "a (b)"])
_gl.LOG_PATH = _saved_log

# ---- 姿勢參考：parse_pose、接進內建工作流、上傳（Comfy 用假的）----
_pn = "danbooru_pose/pose_0123456789abcdef.png"
ok("pose: 沒給、亂給的名字當沒有", server.parse_pose(None) is None and server.parse_pose({"name": "../x.png"}) is None and server.parse_pose({"name": "danbooru_hires/a.png"}) is None)
_pp = server.parse_pose({"name": _pn, "strength": 9, "end": "x"})
ok("pose: 強度夾在範圍裡、壞的用預設（end 預設 1，照專案主的工作流）", _pp == {"name": _pn, "strength": 1.2, "end": 1.0, "skeleton": False}, str(_pp))
ok("pose: 沒給強度就是 1", server.parse_pose({"name": _pn})["strength"] == 1.0)
_saved_models = server.models_from_comfy
_saved_ready = server.pose_node_ready
server.pose_node_ready = lambda: None
try:
    server.models_from_comfy = lambda kind: ["SDXL\\controlnet-union-sdxl-1.0\\promax.safetensors", "Illustrious-XL ControlNet Openpose\\illustriousXL_v10.safetensors"] if kind == "controlnet" else []
    ok("pose: 先挑 Illustrious 的 OpenPose", server.pose_controlnet() == "Illustrious-XL ControlNet Openpose\\illustriousXL_v10.safetensors")
    _wf0 = server.build_workflow("1girl", 832, 1216, 1)
    _wfp = server.build_workflow("1girl", 832, 1216, 1, loras=[{"folder": "", "file": "a.safetensors", "strength": 1}], pose=server.parse_pose({"name": _pn, "strength": 0.6}))
    _ks = _wfp["35"]["inputs"]
    ok("pose: 沒給姿勢，工作流一點都沒變", not any(n in _wf0 for n in ("300", "301", "302", "303", "305")))
    ok("pose: KSampler 的正負提示詞改走 ControlNet", _ks["positive"] == ["305", 0] and _ks["negative"] == ["305", 1] and _wfp["305"]["inputs"]["positive"][0] in ("36",) and _wfp["305"]["inputs"]["strength"] == 0.6)
    ok("pose: 參考圖先裁成這張的比例再抓骨架", _wfp["301"]["inputs"]["width"] == 832 and _wfp["301"]["inputs"]["height"] == 1216 and _wfp["301"]["inputs"]["crop"] == "center" and _wfp["302"]["class_type"] == "AIO_Preprocessor" and _wfp["302"]["inputs"]["preprocessor"] == "OpenposePreprocessor" and _wfp["302"]["inputs"]["resolution"] == 512 and _wfp["300"]["inputs"]["image"] == _pn)
    ok("pose: 跟專案主的工作流一樣接 SetUnionControlNetType=openpose", _wfp["304"]["inputs"] == {"control_net": ["303", 0], "type": "openpose"} and _wfp["305"]["inputs"]["control_net"] == ["304", 0])
    _wfs = server.build_workflow("1girl", 832, 1216, 1, pose=server.parse_pose({"name": _pn, "skeleton": True}))
    ok("pose: 編輯器畫的骨架不再抓一次，直接進 ControlNet", "302" not in _wfs and _wfs["305"]["inputs"]["image"] == ["301", 0] and _wfp["305"]["inputs"]["image"] == ["302", 0])
    ok("pose: skeleton 只認真的 true", server.parse_pose({"name": _pn, "skeleton": "yes"})["skeleton"] is False and server.parse_pose({"name": _pn, "skeleton": True})["skeleton"] is True)
    server.models_from_comfy = lambda kind: ["SDXL\\controlnet-union-sdxl-1.0\\promax.safetensors"] if kind == "controlnet" else []
    _wfu = server.build_workflow("1girl", 1024, 1024, 1, pose=server.parse_pose({"name": _pn}))
    ok("pose: 沒有 OpenPose 專用的就退到 Union", _wfu["303"]["inputs"]["control_net_name"].endswith("promax.safetensors") and _wfu["304"]["inputs"]["type"] == "openpose")
    server.models_from_comfy = lambda kind: []
    try:
        server.build_workflow("1girl", 1024, 1024, 1, pose=server.parse_pose({"name": _pn}))
        ok("pose: 沒有 ControlNet 就明講", False)
    except server.PoseError as exc:
        ok("pose: 沒有 ControlNet 就明講", "ControlNet" in str(exc))
    _wfw, _ = server.prepare_workflow({"positive": "1girl", "seed": 1, "pose": {"name": "evil/../x.png"}})
    ok("pose: prepare_workflow 不認得的參考圖直接忽略", "300" not in _wfw)
finally:
    server.models_from_comfy = _saved_models
    server.pose_node_ready = _saved_ready
# ---- 從參考圖抓骨架：openpose_json → 編輯器的點 ----
_k = [0.0] * 54
for _i, (_x, _y) in enumerate([(0.5, 0.1), (0.5, 0.2), (0.4, 0.2), (0.35, 0.35), (0.3, 0.5)]):
    _k[_i * 3:_i * 3 + 3] = [_x, _y, 1.0]
_ppl = server._kps_people([{"people": [{"pose_keypoints_2d": _k}], "canvas_width": 512, "canvas_height": 768}], 832, 1216)
ok("pose: 抓到的骨架（0～1 的比例）換成這張畫布的像素", len(_ppl) == 1 and _ppl[0][1][:2] == [416.0, 243.20000000000002] and _ppl[0][1][2] is True, str(_ppl[:1]))
ok("pose: 沒抓到的點放在脖子、標成藏起來", _ppl[0][10] == [416.0, 243.20000000000002, False])
_kp = [v * (512 if i % 3 == 0 else 768) if i % 3 != 2 else v for i, v in enumerate(_k)]
_ppx = server._kps_people([{"people": [{"pose_keypoints_2d": _kp}], "canvas_width": 512, "canvas_height": 768}], 832, 1216)
ok("pose: 像素座標也照比例換", abs(_ppx[0][1][0] - 416) < 0.01 and abs(_ppx[0][1][1] - 243.2) < 0.01, str(_ppx[0][1]))
ok("pose: 沒有人、點太少就不算", server._kps_people([], 832, 1216) == [] and server._kps_people([{"people": [{"pose_keypoints_2d": [0.0] * 54}]}], 832, 1216) == [])

# ---- 姿勢參考圖只留最近幾張 ----
_pd = Path(_env_tmp.mkdtemp())
import os as _os2  # noqa: E402

for _i in range(5):
    _f = _pd / f"pose_{_i:016x}.png"
    _f.write_bytes(b"x")
    _os2.utime(_f, (1000 + _i, 1000 + _i))
(_pd / "other.png").write_bytes(b"x")
_gone = server.prune_pose_inputs(keep=2, folder=_pd, protect={f"pose_{0:016x}.png"})
ok("pose: 參考圖留最近幾張，佇列裡用著的不刪，別的檔不碰", sorted(_gone) == [f"pose_{1:016x}.png", f"pose_{2:016x}.png"] and (_pd / "other.png").exists(), str(_gone))

# ---- 統計：資料沒變就用上一次的 ----
_calls = []
_saved_stats = server.gen_log.stats
server.gen_log.stats = lambda known, favs: _calls.append(1) or {"total": len(_calls)}
try:
    server._STATS_CACHE.update(key=None, value=None)
    _a = server.genlog_stats()
    _b = server.genlog_stats()
    ok("stats: 日誌、作品冊沒變就不重算", _a is _b and len(_calls) == 1)
    with open(server.gen_log.LOG_PATH, "a", encoding="utf-8") as _f:
        _f.write("{}" + chr(10))
    server.genlog_stats()
    ok("stats: 日誌多一行就重算", len(_calls) == 2)
finally:
    server.gen_log.stats = _saved_stats
    server._STATS_CACHE.update(key=None, value=None)

_saved_api3 = server.api
try:
    server._POSE_NODE_CACHE.update(t=0.0, ok=False)
    server.api = lambda method, path, body=None, timeout=0: {}
    try:
        server.pose_node_ready()
        ok("pose: ComfyUI 沒裝節點就明講怎麼補", False)
    except server.PoseError as exc:
        ok("pose: ComfyUI 沒裝節點就明講怎麼補", "AIO Aux Preprocessor" in str(exc) and "啟動檔" in str(exc))
    server.api = lambda method, path, body=None, timeout=0: {"AIO_Preprocessor": {}}
    server.pose_node_ready()
    ok("pose: 有節點就放行（記一分鐘）", server._POSE_NODE_CACHE["ok"] is True)
finally:
    server.api = _saved_api3
    server._POSE_NODE_CACHE.update(t=0.0, ok=False)
_saved_upload2 = server.comfy_upload_image
_got = {}
try:
    def _fake_upload(data, name, subfolder="danbooru_hires", mime="image/png"):
        _got.update(name=name, subfolder=subfolder, mime=mime, n=len(data))
        return f"{subfolder}/{name}"

    server.comfy_upload_image = _fake_upload
    import base64 as _b64  # noqa: E402

    _r = server.pose_upload({"image": "data:image/jpeg;base64," + _b64.b64encode(b"\xff\xd8fakejpeg").decode()})
    ok("pose: 上傳到 input/danbooru_pose、檔名是內容雜湊", server.POSE_NAME_RE.match(_r["name"]) is not None and _got["subfolder"] == "danbooru_pose" and _got["mime"] == "image/jpeg" and _r["name"].endswith(".jpg"), str((_r, _got)))
    for _bad in ({"image": "data:text/html;base64,PGI+"}, {"image": ""}, {}):
        try:
            server.pose_upload(_bad)
            ok("pose: 不是圖片擋掉", False)
            break
        except server.PoseError:
            pass
    else:
        ok("pose: 不是圖片擋掉", True)
    try:
        server.pose_preview({"name": "../../secret.png"})
        ok("pose: 骨架預覽只收姿勢參考圖", False)
    except server.PoseError:
        ok("pose: 骨架預覽只收姿勢參考圖", True)
finally:
    server.comfy_upload_image = _saved_upload2
_h = server.GenJob(iter(()), {"origin": "evil", "hires": {"mode": "quick"}})
ok("active: 不認得的 origin 當空的；Hires 標出來", _h.origin == "" and _h.kind == "hires")
_c = server.GenJob(iter(()), {"origin": "fuse"})
_c.cancelled = True
with server._JOBS_LOCK:
    server._JOBS[_c.id] = _c
ok("active: 按停的不列", _c.id not in {j["id"] for j in server.active_jobs()})
with server._JOBS_LOCK:
    server._JOBS.pop(_c.id, None)
    server._JOBS.pop(_job.id, None)

# --- 偏好路徑（畫面上選 LoRA／底模資料夾，不必碰 config.json） ---
_pref_td = Path(tempfile.mkdtemp())
_lroot = _pref_td / "loras"
(_lroot / "A").mkdir(parents=True)
(_lroot / "B").mkdir()
(_lroot / "A" / "x.safetensors").write_bytes(b"")
(_lroot / "A" / "x.preview.png").write_bytes(b"png")
(_lroot / "B" / "y.safetensors").write_bytes(b"")
_ls = server.lora_scan
_saved = (_ls.lora_manager_list, _ls.comfy_model_dirs, server.models_from_comfy, server.lm_checkpoints)
_ls.lora_manager_list = lambda *a, **k: None
_ls.comfy_model_dirs = lambda kind: [_lroot] if kind == "loras" else []
try:
    got = server.set_model_path("lora", str(_lroot / "A"))
    ok("preferred path: LoRA folder saved with its count", got["count"] == 1 and wfmod.load_settings().get("loraPath") == str((_lroot / "A").resolve()), str(got))
    _ls.reset_cache()
    _d = _ls.build_lora_list()
    _names = [((i["folder"] + "\\") if i["folder"] else "") + i["file"] for i in _d["items"]]
    ok("preferred path: a subfolder still names LoRAs from ComfyUI's loras root", _names == ["A\\x.safetensors"], str(_names))
    ok("preferred path: previews inside the folder are served", _ls.preview_path("A", "x.preview.png") is not None)
    ok("preferred path: files outside the folder are not", _ls.preview_path("B", "y.safetensors") is None and _ls.preview_path("..", "x.png") is None)
    _alias = _pref_td / "lora-root-alias"
    try:
        _alias.symlink_to(_lroot, target_is_directory=True)
    except OSError:
        print("skip preferred path symlink fixture (not permitted on this system)")
    else:
        _ls.comfy_model_dirs = lambda kind: [_alias] if kind == "loras" else []
        _ls.reset_cache()
        _alias_items = _ls.build_lora_list()["items"]
        _alias_names = [((i["folder"] + "\\") if i["folder"] else "") + i["file"] for i in _alias_items]
        ok("preferred path: aliased ComfyUI root keeps model names", _alias_names == ["A\\x.safetensors"], str(_alias_names))
        ok("preferred path: aliased root serves only selected previews", _ls.preview_path("A", "x.preview.png") is not None and _ls.preview_path("B", "y.safetensors") is None)
        _ls.comfy_model_dirs = lambda kind: [_lroot] if kind == "loras" else []
    try:
        server.set_model_path("lora", str(_pref_td / "missing"))
        ok("preferred path: a missing folder is refused", False)
    except ValueError:
        ok("preferred path: a missing folder is refused", True)
    ok("preferred path: empty clears it", server.set_model_path("lora", "")["path"] == "" and not wfmod.load_settings().get("loraPath"))

    _croot = _pref_td / "ckpt"
    (_croot / "sub").mkdir(parents=True)
    (_croot / "sub" / "m1.safetensors").write_bytes(b"")
    server.models_from_comfy = lambda kind: ["sub\\m1.safetensors", "other\\m2.safetensors"]
    server.lm_checkpoints = lambda: {}
    server.set_model_path("ckpt", str(_croot))
    _items, _ = server.checkpoints_for_ui()
    ok("preferred path: checkpoints outside the folder are hidden", [i["ckpt_name"] for i in _items] == ["sub\\m1.safetensors"], str(_items))
    server.set_model_path("ckpt", "")
    _items, _ = server.checkpoints_for_ui()
    ok("preferred path: cleared shows every checkpoint again", len(_items) == 2, str(_items))
    ok("preferred path: folder window only for a page opened on this computer", server.paths_status("100.64.0.9")["pick"] is False)
finally:
    _ls.lora_manager_list, _ls.comfy_model_dirs, server.models_from_comfy, server.lm_checkpoints = _saved
    _ls.reset_cache()

# 出圖日誌：上次寫到半行就斷電，下一筆不能黏在殘行後面一起丟掉。
import gen_log as _gl
_glp = _gl._path()
with _glp.open("a", encoding="utf-8") as _f:
    _f.write('{"t":"gen","id":"torn-half","at":1,"pos')
_gl._append({"t": "gen", "id": "after-torn", "at": 2})
ok("gen log: entry after a torn line survives", any(r.get("id") == "after-torn" for r in _gl._load()))

if failed:
    print(f"\n{failed} failed")
    sys.exit(1)
print("\nok")
