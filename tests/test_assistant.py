#!/usr/bin/env python3
"""用暫存設定、假 CLI 和本機 HTTP 驗證助理，不碰真帳號或工作台。"""
from __future__ import annotations

import contextlib
import http.client
import importlib
import ipaddress
import json
import os
import socket
import sys
import tempfile
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

TOOLS = [
    {"name": name, "description": "測試", "input_schema": {"type": "object"}}
    for name in ("find_cards", "get_workspace")
]
CHAT = {"system": "測試系統提示", "tools": TOOLS, "messages": [{"role": "user", "content": "測試"}]}
KEY = "fake-secret-for-tests"

FAKE_CLI = '''
import json, os, sys, time
from pathlib import Path
provider, mode, *args = sys.argv[1:]
assert not any(k.startswith("MOCHI_") and k.endswith("_API_KEY") for k in os.environ)
if args == ["--version"]:
    if mode == "timeout":
        time.sleep(20)
    print(provider + " 9.8.7")
elif args[:2] == ["auth", "status"]:
    print(json.dumps({"loggedIn": mode != "login", "email": "secret@example.invalid"}))
    sys.exit(int(mode == "login"))
elif args[:2] == ["login", "status"]:
    print("Not logged in" if mode == "login" else "Logged in using ChatGPT")
    sys.exit(int(mode == "login"))
elif args[0] == "models":
    # flaky：第一次說沒登入（Grok 正在換登入憑證），第二次才正常
    calls = Path(os.environ["ASSISTANT_CONFIG_PATH"]).with_name("grok-models.calls")
    calls.write_text(calls.read_text() + "x" if calls.exists() else "x")
    if mode == "flaky":
        mode = "login" if len(calls.read_text()) == 1 else "ready"
    if mode == "login":
        print("You are not logged in. Run grok login.")
    else:
        print("You are logged in with grok.com.\\n\\nDefault model: grok-fake\\n\\nAvailable models:\\n  * grok-fake (default)\\n  - grok-fake-fast\\n  - grok-old")
elif args[0] == "app-server":
    for line in sys.stdin:
        req = json.loads(line)
        if req["method"] == "initialize":
            print(json.dumps({"id": req["id"], "result": {}}), flush=True)
        if req["method"] == "model/list":
            print(json.dumps({"id": req["id"], "result": {
                "data": [{"id": "internal-id", "model": "fake-codex", "displayName": "Fake Codex"}]
            }}), flush=True)
elif args[0] in ("--print", "--prompt-file", "exec"):
    if mode in ("login", "model", "key", "rate"):
        print({
            "login": "Not logged in", "model": "model_not_found",
            "key": "invalid_api_key", "rate": "rate_limit_exceeded",
        }[mode], file=sys.stderr)
        sys.exit(1)
    assert not list(Path.cwd().iterdir())
    assert "--model" in args and args[args.index("--model") + 1] == "fake-model"
    if provider == "grok":
        body = json.loads(Path(args[1]).read_text(encoding="utf-8"))
    else:
        body = json.loads(sys.stdin.buffer.read())
    def emit(**event):
        print(json.dumps(event), flush=True)
    if mode == "wait":
        import subprocess
        marker = Path(os.environ["ASSISTANT_CONFIG_PATH"]).with_name("grandchild.done")
        subprocess.Popen([sys.executable, "-c", "import sys, time; time.sleep(3); open(sys.argv[1], 'w').write('x')", str(marker)])
        Path(os.environ["ASSISTANT_CONFIG_PATH"]).with_name("cli.pid").write_text(
            str(os.getpid()), encoding="ascii"
        )
        time.sleep(20)
    elif mode == "format":
        print('{"type":"result","structured_output":{"say":"bad","calls":[{"name":"find_cards","args":[]}]}}')
    else:
        # 墨池工具在 mochi_tools（不叫 tools：CLI 模型會跟自己被關掉的工具清單搞混）
        assert "tools" not in body and "不要說沒有墨池工具" in body["instruction"]
        tool = body["mochi_tools"][0]["name"]
        params = {} if tool == "check_connection" else {"query": "海邊"}
        result = {"say": "找到", "calls": [{"name": tool, "args": params}]}
        if provider == "claude":
            emit(type="system", subtype="init", tools=[])
            emit(type="stream_event", event={"type": "content_block_delta",
                 "delta": {"type": "text_delta", "text": "partial"}})
            emit(type="assistant", message={"content": [
                {"type": "tool_use", "name": "StructuredOutput", "input": result}
            ]})
            emit(type="result", subtype="success", is_error=False, structured_output=result)
        elif provider == "grok":
            emit(type="thought", data="hidden")
            emit(type="text", data=json.dumps(result))
            emit(type="end", stopReason="end_turn", structuredOutput=result)
        else:
            emit(type="thread.started", thread_id="fake-thread")
            emit(type="turn.started")
            result["calls"][0]["args"] = json.dumps(params)
            emit(type="item.completed", item={"type": "agent_message", "text": json.dumps(result)})
            emit(type="turn.completed", usage={"input_tokens": 5, "output_tokens": 3})
else:
    sys.exit(2)
'''


def config(provider="openai", **connection):
    """測試一律存到 main() 提供的暫存路徑。"""
    kind = "cli" if provider in ("claude", "grok", "codex") else "api"
    return assistant.save_config({"connection": {"kind": kind, "provider": provider, "model": "fake-model", **connection}})


def expect_error(code, action):
    """比對穩定的錯誤代碼，避免把測試綁在 UI 的中文字句。"""
    try:
        action()
    except assistant.AssistantError as exc:
        assert exc.code == code, (code, exc.code, str(exc))
        return
    raise AssertionError(f"應該回 {code}")


@contextlib.contextmanager
def serving(handler):
    """測完就收掉本機假端點，讓同一個埠和前一項測試無關。"""
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as httpd:
        runner = threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True)
        runner.start()
        try:
            yield httpd.server_port
        finally:
            httpd.shutdown()
            runner.join()


def config_storage():
    assert assistant.get_config() == {"ok": True, "connection": None, "allowRemote": False}
    assert config(apiKey=KEY)["connection"]["hasKey"]
    stored = Path(os.environ["ASSISTANT_CONFIG_PATH"])
    for path in (stored, stored.with_suffix(".json.bak")):
        assert KEY not in path.read_text(encoding="utf-8")
        assert "apiKey" not in path.read_text(encoding="utf-8")
    assert KEY not in json.dumps(assistant.get_config())
    assert KEY not in json.dumps(assistant.status(local=True))
    assert config()["connection"]["hasKey"]
    assert not config(clearKey=True)["connection"]["hasKey"]
    with patch.dict(os.environ, {"MOCHI_OPENAI_API_KEY": KEY}):
        assert assistant.get_config()["connection"]["hasKey"]
        assert KEY not in json.dumps(assistant.get_config())
    expect_error("format", lambda: config("custom", baseUrl="http://user:secret@localhost/v1"))
    expect_error("format", lambda: config("custom", baseUrl="http://localhost/v1?key=secret"))
    with patch.dict(os.environ, {"MOCHI_CUSTOM_API_KEY": KEY}):
        assert config("custom", baseUrl="http://127.0.0.1:8123/v1")["connection"]["hasKey"]
        assert not config("custom", baseUrl="http://127.0.0.1:8124/v1")["connection"]["hasKey"]
        # 伺服器重開（記憶體清空）：環境金鑰還是只認原本那個端點，不會變成給重開後第一個讀到的 8124
        stored_text = Path(os.environ["ASSISTANT_CONFIG_PATH"]).read_text(encoding="utf-8")
        assert KEY not in stored_text and "8123" in stored_text
        assistant._custom_env_bases.clear()
        assistant._keys.clear()
        assert not assistant.get_config()["connection"]["hasKey"]
        assert config("custom", baseUrl="http://127.0.0.1:8123/v1")["connection"]["hasKey"]
    # 推理強度：每家接受的值不一樣；空字串＝預設（不送）
    assert config("claude", effort="max")["connection"]["effort"] == "max"
    assert assistant.status(local=True)["connection"]["label"] == "Claude Code · fake-model · max"
    assert config("claude", effort="")["connection"]["effort"] is None
    assert assistant.status(local=True)["connection"]["label"] == "Claude Code · fake-model"
    expect_error("format", lambda: config("grok", effort="max"))
    expect_error("format", lambda: config("xai", effort="medium"))
    expect_error("format", lambda: config("codex", effort="--yolo"))
    assert config("codex", effort="xhigh")["connection"]["effort"] == "xhigh"


def detection():
    def command(provider):
        modes = {"claude": "login", "grok": "ready", "codex": "ready"}
        return fake_command(provider, modes[provider])

    with patch.object(assistant, "find_cli", command):
        results = {cli["id"]: cli for cli in assistant.detect()["clis"]}
    assert results["claude"]["installed"] and results["claude"]["version"] == "9.8.7"
    assert results["claude"]["login"] == "no"
    assert "secret@example.invalid" not in json.dumps(results)
    assert [m["id"] for m in results["grok"]["models"]] == ["grok-fake", "grok-fake-fast", "grok-old"]
    # grok models 第一行就說登入了：要認得（以前一律「登入待確認」）
    assert results["grok"]["login"] == "ok" and results["grok"]["loginNote"] == "已登入。"
    # 登入短句跟隔離說明要能分開翻：代碼穩定，句子留在頁面上對。
    assert results["claude"]["loginCode"] == "no"
    assert results["grok"]["loginCode"] == "ok"
    assert results["codex"]["loginCode"] == "ok"
    assert results["codex"]["models"][0]["id"] == "fake-codex"
    assert all(cli["usable"] and cli["isolation"]["note"] for cli in results.values())
    assert [cli["isolation"]["level"] for cli in results.values()] == ["strict", "strict", "readonly"]
    with patch.object(assistant, "find_cli", lambda provider: (
        fake_command(provider, "timeout" if provider == "claude" else "ready") if provider != "codex" else None
    )), patch.object(assistant, "PROBE_TIMEOUT", 0.6):
        results = assistant.detect()["clis"]
    assert results[0]["installed"] and results[0]["login"] == "unknown" and "逾時" in results[0]["loginNote"]
    assert results[0]["loginCode"] == "timeout"
    assert results[1]["loginCode"] == "ok" and results[1]["models"][0]["id"] == "grok-fake"
    assert not results[2]["installed"] and results[2]["loginCode"] == "missing"
    # Grok 換登入憑證那一下會說沒登入：再問一次才算數；真的沒登入，兩次都說沒登入。
    calls = Path(os.environ["ASSISTANT_CONFIG_PATH"]).with_name("grok-models.calls")
    for mode, login, asked in (("flaky", "ok", 2), ("login", "no", 2), ("ready", "ok", 1)):
        calls.unlink(missing_ok=True)
        with patch.object(assistant, "find_cli", lambda provider, m=mode: (
            fake_command(provider, m) if provider == "grok" else None
        )), patch.object(assistant, "LOGIN_RETRY_DELAY", 0.05):
            grok = assistant.detect()["clis"][1]
        assert grok["login"] == login, (mode, grok)
        assert len(calls.read_text()) == asked, (mode, calls.read_text())
        if login == "ok":
            assert grok["models"][0]["id"] == "grok-fake"
    calls.unlink(missing_ok=True)


def fake_command(provider, mode):
    """用 Python 腳本當 CLI，在 Windows 也可測真實的管線和終止。"""
    return [sys.executable, str(Path(os.environ["ASSISTANT_CONFIG_PATH"]).with_name("fake_cli.py")), provider, mode]


def cli_efforts():
    flags = {"claude": ["--effort", "high"], "grok": ["--reasoning-effort", "high"],
             "codex": ["-c", 'model_reasoning_effort="high"']}
    for provider, pair in flags.items():
        with patch.object(assistant, "find_cli", return_value=[provider]):
            with assistant._cli_invocation({"provider": provider, "model": None, "effort": "high"}, CHAT) as (argv, *_):
                i = argv.index(pair[0]) if provider != "codex" else argv.index(pair[1]) - 1
                assert argv[i:i + 2] == pair, argv
                if provider == "codex":
                    assert argv[-1] == "-"
            # 存檔被手改成怪值也不能變成 CLI 參數
            try:
                with assistant._cli_invocation({"provider": provider, "model": None, "effort": "--x"}, CHAT):
                    raise AssertionError("應該擋掉")
            except assistant.AssistantError as exc:
                assert exc.code == "format"


def cli_commands():
    for provider in ("claude", "grok", "codex"):
        conn = {"provider": provider, "model": None}
        with patch.object(assistant, "find_cli", return_value=[provider]):
            with assistant._cli_invocation(conn, CHAT) as (argv, cwd, prompt_file):
                assert not list(Path(cwd).iterdir())
                assert "--model" not in argv
                assert not any("effort" in a for a in argv)

                def option(flag):
                    return argv[argv.index(flag) + 1]

                if provider == "claude":
                    assert option("--tools") == "" and option("--setting-sources") == "user"
                    assert json.loads(option("--mcp-config")) == {"mcpServers": {}}
                    assert {"--strict-mcp-config", "--disable-slash-commands", "--safe-mode",
                            "--include-partial-messages", "--verbose"} <= set(argv)
                    assert option("--output-format") == "stream-json"
                    schema = json.loads(option("--json-schema"))
                elif provider == "grok":
                    denied = set(option("--disallowed-tools").split(","))
                    assert option("--tools") in denied and {"search_tool", "use_tool", "Agent"} <= denied
                    assert option("--permission-mode") == "dontAsk"
                    assert option("--output-format") == "streaming-json" and option("--sandbox") == "strict"
                    assert option("--deny") == "*" and "MCPTool" in argv
                    assert {"--no-subagents", "--disable-web-search", "--no-memory", "--no-plan"} <= set(argv)
                    assert prompt_file is None
                    prompt = json.loads(Path(option("--prompt-file")).read_text(encoding="utf-8"))
                    assert prompt["messages"] == CHAT["messages"]
                    schema = json.loads(option("--json-schema"))
                else:
                    assert argv[1] == "exec" and argv[-1] == "-"
                    assert option("--sandbox") == "read-only"
                    assert {"--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--json",
                            'approval_policy="never"', "features.shell_tool=false", "features.apps=false",
                            "features.plugins=false"} <= set(argv)
                    if os.name == "nt":
                        assert 'windows.sandbox="unelevated"' in argv
                    schema = json.loads(Path(option("--output-schema")).read_text(encoding="utf-8"))
                assert schema["required"] == ["say", "calls"]
                args_type = schema["properties"]["calls"]["items"]["properties"]["args"]["type"]
                assert args_type == ("string" if provider == "codex" else "object")
                if prompt_file is not None:
                    prompt = json.loads(prompt_file.read_text(encoding="utf-8"))
                    assert prompt["messages"] == CHAT["messages"]
                assert list(prompt) == ["instruction", "system", "mochi_tools", "messages"]
                assert prompt["mochi_tools"] == CHAT["tools"] and prompt["system"] == CHAT["system"]
        assert not Path(cwd).exists()


def cli_chat():
    for provider in ("claude", "grok", "codex"):
        config(provider)
        with patch.object(assistant, "find_cli", lambda p: fake_command(p, "ready")):
            assert assistant.test_connection()["ok"]
            events = dict(assistant.chat_events(CHAT))
            assert events["text"]["delta"] == "找到"
            calls = events["tool_calls"]["calls"]
            assert calls[0]["id"] and calls[0]["args"] == {"query": "海邊"}
            assert events["done"]["reason"] == "tool_calls"
    config("claude")
    for mode in ("login", "model", "key", "rate", "format"):
        with patch.object(assistant, "find_cli", lambda provider: fake_command(provider, mode)):
            assert list(assistant.chat_events(CHAT))[-1][1]["code"] == mode
            result = assistant.test_connection()
            assert not result["ok"] and result["code"] == mode


def cli_output_formats():
    reply = {"say": "ok", "calls": []}
    encoded = json.dumps(reply)

    def frames(*events):
        return "\n".join(json.dumps(event) for event in events).encode()

    parse = assistant._cli_output
    assert parse("claude", frames(
        {"type": "system", "subtype": "init"},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": encoded}]}},
        {"type": "result", "subtype": "success", "result": ""},
    )) == reply
    assert parse("grok", frames(
        {"type": "text", "data": encoded[:8]}, {"type": "text", "data": encoded[8:]},
        {"type": "end", "stopReason": "end_turn"},
    )) == reply
    assert parse("grok", frames({"text": encoded, "stopReason": "end_turn"})) == reply
    assert parse("codex", frames(
        {"type": "item.completed", "item": {"type": "agent_message", "text": "前言"}},
        {"type": "item.completed", "item": {"type": "agent_message", "text": encoded}},
        {"type": "turn.completed"},
    )) == reply
    for provider, event in (
        ("claude", {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Bash"}]}}),
        ("grok", {"type": "tool_call", "toolName": "use_tool"}),
        ("codex", {"type": "item.started", "item": {"type": "command_execution"}}),
    ):
        expect_error("format", lambda: parse(provider, frames(event, reply)))
    expect_error("login", lambda: parse("grok", frames({"type": "error", "message": "Not logged in"})))
    expect_error("format", lambda: parse("grok", frames(
        {"type": "text", "data": encoded}, {"type": "end", "stopReason": "max_tokens"},
    )))
    expect_error("format", lambda: parse("codex", frames(
        {"type": "item.completed", "item": {"type": "agent_message", "text": encoded}},
    )))


def openai_frames(broken=False):
    return [
        {"choices": [{"delta": {"content": "海邊"}}]},
        {"choices": [{"delta": {"tool_calls": [
            {"index": 1, "id": "c2", "function": {"name": "get_workspace", "arguments": "{}"}},
            {"index": 0, "id": "c1", "function": {"name": "find_cards", "arguments": '{"query":'}},
        ]}}]},
        {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {
            "arguments": "!" if broken else '"海邊"}'
        }}]}}]},
        {"choices": [{"delta": {}, "finish_reason": "tool_calls"}]},
        {"choices": [], "usage": {"completion_tokens": 3}},
        "[DONE]",
    ]


def anthropic_frames(broken=False):
    return [
        {"type": "message_start", "message": {"usage": {"input_tokens": 5}}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "海邊"}},
        {"type": "content_block_stop", "index": 0},
        {"type": "content_block_start", "index": 1, "content_block": {"type": "tool_use", "id": "c1", "name": "find_cards", "input": {}}},
        {"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": '{"query":'}},
        {"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": "!" if broken else '"海邊"}'}},
        {"type": "content_block_stop", "index": 1},
        {"type": "content_block_start", "index": 2, "content_block": {"type": "tool_use", "id": "c2", "name": "get_workspace", "input": {}}},
        {"type": "content_block_stop", "index": 2},
        {"type": "message_delta", "delta": {"stop_reason": "tool_use"}, "usage": {"output_tokens": 7}},
        {"type": "message_stop"},
    ]


def api_provider(provider):
    """以真 HTTP 傳半個 UTF-8 字與多筆 SSE，驗證轉換和下一輪的工具結果。"""
    state = {"broken": False, "status": 200, "seen": []}
    anth = provider == "anthropic"

    class FakeAPI(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            state["seen"].append((self.path, dict(self.headers), None))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"data":[{"id":"fake-model","display_name":"Fake Model"}]}')

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            state["seen"].append((self.path, dict(self.headers), body))
            self.send_response(state["status"])
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            if state["status"] != 200:
                self.wfile.write(json.dumps({"error": {"message": state["message"] + " " + KEY}}).encode())
                return
            frames = anthropic_frames(state["broken"]) if anth else openai_frames(state["broken"])
            names = [t.get("name") or t.get("function", {}).get("name") for t in body.get("tools", [])]
            if names == ["check_connection"]:
                if anth:
                    assert "tool_choice" not in body
                    frames[4]["content_block"]["name"] = "check_connection"
                    frames = frames[:5] + frames[7:8] + frames[-2:]
                else:
                    assert body["tool_choice"] == {"type": "function", "function": {"name": "check_connection"}}
                    frames[1]["choices"][0]["delta"]["tool_calls"] = [
                        {"index": 0, "function": {"name": "check_connection", "arguments": "{}"}},
                    ]
                    frames.pop(2)
            encoded = []
            for frame in frames:
                if isinstance(frame, str):
                    encoded.append(f"data: {frame}\r\n\r\n")
                else:
                    # 多行 data 屬於同一事件，event / comment 也不能當 JSON。
                    label = frame.get("type", "message")
                    encoded.append(f": heartbeat\r\nevent: {label}\r\ndata: {{\r\ndata: {json.dumps(frame, ensure_ascii=False)[1:]}\r\n\r\n")
            wire = "".join(encoded).encode()
            split = wire.index("海".encode()) + 1
            self.wfile.write(wire[:split])
            self.wfile.flush()
            time.sleep(0.01)
            self.wfile.write(wire[split:])

    with serving(FakeAPI) as port:
        url = f"http://127.0.0.1:{port}/v1"
        with patch.dict(assistant.API_BASES, {provider: url}):
            config(provider, apiKey=KEY, **({"baseUrl": url} if provider == "custom" else {}))
            listing = assistant.models({"kind": "api", "provider": provider})
            assert listing["source"] == "list" and listing["models"][0]["id"] == "fake-model"
            # 清單要帶回這次問的是哪一家，頁面才丟得掉切換前的慢回應。
            assert listing["provider"] == provider
            if provider == "custom":
                assert listing["baseUrl"] == url
            else:
                assert "baseUrl" not in listing
            events = dict(assistant.chat_events(CHAT))
            assert events["text"]["delta"] == "海邊" and events["done"]["reason"] == "tool_calls"
            calls = events["tool_calls"]["calls"]
            assert [call["id"] for call in calls] == ["c1", "c2"]
            assert [call["args"] for call in calls] == [{"query": "海邊"}, {}]
            history = CHAT["messages"] + [{"role": "assistant", "content": "", "toolCalls": calls}] + [
                {"role": "tool", "toolCallId": c["id"], "name": c["name"], "content": "{}"} for c in calls
            ]
            assert list(assistant.chat_events({**CHAT, "messages": history}))[-1][0] == "done"
            path, headers, body = state["seen"][-1]
            headers = {k.lower(): v for k, v in headers.items()}
            if anth:
                assert path == "/v1/messages" and headers["x-api-key"] == KEY
                assert "output_config" not in body and body["max_tokens"] == 16000
                assert body["system"] == CHAT["system"] and body["tools"] == TOOLS
                # 整段前綴自動快取：下一步、下一句的第一個字才出來得快
                assert body["cache_control"] == {"type": "ephemeral"}
                assert [b["tool_use_id"] for b in body["messages"][-1]["content"]] == ["c1", "c2"]
            else:
                assert path == "/v1/chat/completions" and headers["authorization"] == "Bearer " + KEY
                assert "reasoning_effort" not in body
                assert body["tools"][0]["function"]["parameters"] == TOOLS[0]["input_schema"]
                assert [m["tool_call_id"] for m in body["messages"][-2:]] == ["c1", "c2"]
            partial = history[:-1] + [{"role": "user", "content": "上輪按停，開始新一輪。"}]
            assert list(assistant.chat_events({**CHAT, "messages": partial}))[-1][0] == "done"
            sent = state["seen"][-1][2]["messages"]
            result = sent[-2]["content"][-1]["content"] if anth else sent[-2]["content"]
            assert json.loads(result)["code"] == "aborted"
            assert assistant.test_connection()["ok"]
            config(provider, effort="high", **({"baseUrl": url} if provider == "custom" else {}))
            assert list(assistant.chat_events(CHAT))[-1][0] == "done"
            body = state["seen"][-1][2]
            assert (body["output_config"] == {"effort": "high"}) if anth else (body["reasoning_effort"] == "high")
            state["broken"] = True
            events = dict(assistant.chat_events(CHAT))
            assert "tool_calls" not in events and events["error"]["code"] == "format"
            for status, message, code in ((401, "invalid API key", "key"), (404, "model not found", "model"),
                                          (429, "too many requests", "rate"), (504, "gateway timeout", "timeout")):
                state.update(status=status, message=message)
                events = dict(assistant.chat_events(CHAT))
                assert events["error"]["code"] == code and KEY not in json.dumps(events)


def routes():
    """改 socket 來源資訊模擬白名單裝置，實際 HTTP 仍全走 loopback。"""
    for addr, allowed in (("127.0.0.1", True), ("::1", True), ("::ffff:127.0.0.1", True),
                          ("127.0.0.2", False), ("100.64.1.2", False)):
        assert assistant.is_local(addr) == allowed

    class Routed(server.Handler):
        def setup(self):
            super().setup()
            self.client_address = (origin[0], self.client_address[1])

        def log_message(self, *args):
            pass

    def request(method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        try:
            conn.request(method, "/api/assistant/" + path, body, headers or {"Content-Type": "application/json"})
            res = conn.getresponse()
            return res.status, res.read()
        finally:
            conn.close()

    origin = ["127.0.0.1"]
    nets = [ipaddress.ip_network(net) for net in ("127.0.0.0/8", "100.64.0.0/10")]
    with serving(Routed) as port, patch.object(server, "ALLOW_NETS", nets):
        assert request("GET", "status")[0] == 200
        assert request("POST", "chat", b"a" * (assistant.MAX_CHAT_BYTES + 1))[0] == 413
        long_chat = {**CHAT, "messages": CHAT["messages"] * 201}
        assert request("POST", "chat", json.dumps(long_chat))[0] == 413
        assert request("POST", "config", "{}", {"Content-Type": "text/plain"})[0] == 415
        assert request("POST", "config", "{}", {
            "Content-Type": "application/json", "Origin": "http://elsewhere.invalid"
        })[0] == 403
        status, result = request("POST", "config", "{}", {
            "Content-Type": "application/json", "Host": "elsewhere.invalid", "Origin": "http://elsewhere.invalid",
        })
        assert status == 403 and json.loads(result)["code"] == "local_only"
        body = json.dumps({"connection": None, "allowRemote": True})
        origin[0] = "100.64.1.2"
        assert not json.loads(request("GET", "status")[1])["local"]
        for method, path in (("GET", "config"), ("POST", "config"), ("POST", "test"),
                             ("POST", "models"), ("POST", "detect"), ("POST", "chat")):
            status, result = request(method, path, body if method == "POST" else None)
            assert status == 403 and json.loads(result)["code"] == "local_only", (path, result)
        origin[0] = "127.0.0.1"
        assert request("POST", "config", body)[0] == 200
        origin[0] = "100.64.1.2"
        assert request("POST", "chat", json.dumps(CHAT))[0] == 200
        assert request("GET", "config")[0] == 403
        # 遠端也擋 DNS 重綁：允許的網段、但 Host 是別人的網域，在叫模型之前就拒絕
        status, result = request("POST", "chat", json.dumps(CHAT), {
            "Content-Type": "application/json", "Host": "rebind.example.com", "Origin": "http://rebind.example.com",
        })
        assert status == 403 and json.loads(result)["code"] == "local_only", result
        assert request("GET", "status", None, {"Host": "rebind.example.com"})[0] == 403
        assert request("GET", "status", None, {"Host": "mypc.tail1234.ts.net:8796"})[0] == 200
        origin[0] = "192.0.2.1"
        status, result = request("POST", "chat", json.dumps(CHAT))
        assert status == 403 and json.loads(result)["code"] == "local_only"


def cli_cancel():
    """HTTP 客戶端在 CLI 沒有任何輸出時斷開，伺服器也要結束該程序。"""
    config("claude")
    pidfile = Path(os.environ["ASSISTANT_CONFIG_PATH"]).with_name("cli.pid")
    child = []
    original_popen = assistant.subprocess.Popen

    def popen(cmd, *args, **kwargs):
        proc = original_popen(cmd, *args, **kwargs)
        if "--print" in cmd:
            child.append(proc)
        return proc

    with serving(server.Handler) as port:
        with patch.object(assistant, "find_cli", lambda provider: fake_command(provider, "wait")), patch.object(
            assistant.subprocess, "Popen", popen
        ):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
            conn.request("POST", "/api/assistant/chat", json.dumps(CHAT), {"Content-Type": "application/json"})
            res = conn.getresponse()
            deadline = time.monotonic() + 3
            while not pidfile.exists() and time.monotonic() < deadline:
                time.sleep(0.025)
            try:
                assert child and pidfile.exists() and child[0].poll() is None
            finally:
                res.close()
                conn.close()
            assert child[0].wait(timeout=3) != 0
            pidfile.unlink()
            # CLI 自己開的下一層程序也要一起收：不然它照樣跑完（花模型額度）。
            marker = pidfile.with_name("grandchild.done")
            time.sleep(4)
            assert not marker.exists(), "取消後孫程序還在跑"
            with patch.object(assistant, "CHAT_TIMEOUT", 0.6):
                assert list(assistant.chat_events(CHAT))[-1][1]["code"] == "timeout"


def api_cancel():
    """上游卡在回應開頭或讀取串流時，關頁都要中止同一條 TCP 連線。"""
    state = {"stream": False}
    entered = threading.Event()
    closed = threading.Event()

    class WaitingAPI(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            self.rfile.read(int(self.headers["Content-Length"]))
            if state["stream"]:
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                self.wfile.write(b'data: {"choices":[{"delta":{"content":"providing text"}}]}\n\n')
                self.wfile.flush()
            entered.set()
            self.connection.settimeout(3)
            try:
                if self.connection.recv(1) == b"":
                    closed.set()
            except ConnectionError:
                closed.set()
            except socket.timeout:
                pass

    with serving(WaitingAPI) as api, serving(server.Handler) as app:
        config("custom", baseUrl=f"http://127.0.0.1:{api}/v1")
        for stream in (False, True):
            entered.clear()
            closed.clear()
            state["stream"] = stream
            conn = http.client.HTTPConnection("127.0.0.1", app, timeout=3)
            conn.request("POST", "/api/assistant/chat", json.dumps(CHAT), {"Content-Type": "application/json"})
            response = conn.getresponse()
            try:
                assert entered.wait(2)
                if stream:
                    while (line := response.readline()) and line != b"event: text\n":
                        pass
                    assert line == b"event: text\n"
            finally:
                response.close()
                conn.close()
            assert closed.wait(2), f"上游仍連著，stream={stream}"


def main():
    """每項測試單獨繼續跑，讓輸出能看出是哪條連線壞了。"""
    global assistant, server
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        (root / "fake_cli.py").write_text(FAKE_CLI, encoding="utf-8")
        env = {"ASSISTANT_CONFIG_PATH": str(root / "initial.json"), "APP_CONFIG": str(root / "app.json"),
               "APP_SETTINGS": str(root / "settings.json"), "NO_OUTPUT_PRUNE": "1", "NO_CARD_BAKE": "1"}
        for provider in ("OPENAI", "ANTHROPIC", "XAI", "CUSTOM"):
            env[f"MOCHI_{provider}_API_KEY"] = ""
        with patch.dict(os.environ, env):
            try:
                assistant = importlib.import_module("assistant")
                server = importlib.import_module("server")
            except ImportError as exc:
                print(f"FAIL 載入助理後端 {exc}")
                return 1
            connect = socket.create_connection

            def loopback_only(address, *args, **kwargs):
                # 測試有回歸時也不准誤用真端點。
                assert address[0] in ("127.0.0.1", "::1"), "測試只允許連本機"
                return connect(address, *args, **kwargs)

            cases = [
                ("設定存讀與金鑰", config_storage), ("CLI 偵測與模型目錄", detection),
                ("CLI 指令與隔離旗標", cli_commands), ("CLI 推理強度參數", cli_efforts), ("CLI 結構化回應與錯誤", cli_chat),
                ("三套 CLI 的串流格式", cli_output_formats),
                *((f"{p} 原生工具串流、壞 JSON 與錯誤分類", lambda p=p: api_provider(p))
                  for p in ("openai", "anthropic", "xai", "custom")),
                ("HTTP 路由與本機限制", routes), ("客戶端斷線與逾時終止 CLI", cli_cancel),
                ("模型尚未回應或正在串流時斷開 HTTP", api_cancel),
            ]
            failed = 0
            with patch.object(socket, "create_connection", loopback_only), patch.object(
                assistant, "find_cli", return_value=None
            ):
                for i, (name, case) in enumerate(cases):
                    os.environ["ASSISTANT_CONFIG_PATH"] = str(root / f"assistant-{i}.json")
                    try:
                        case()
                        print(f"ok   {name}")
                    except Exception:
                        failed += 1
                        print(f"FAIL {name}", flush=True)
                        traceback.print_exc()
            print("all ok" if not failed else f"{failed} failed")
            return int(bool(failed))


if __name__ == "__main__":
    sys.exit(main())
