"""墨池模型連線。對話由頁面保管，模型只提出工具呼叫，由頁面驗證後執行。"""
from __future__ import annotations

import concurrent.futures
import contextlib
import http.client
import ipaddress
import json
import os
import queue
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import uuid
from pathlib import Path

import file_lock


MAX_CHAT_BYTES = 400 * 1024
MAX_MESSAGES = 200
PROBE_TIMEOUT = 4
CONNECT_TIMEOUT = 10
CHAT_TIMEOUT = 120
TEST_TIMEOUT = 25
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
API_BASES = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "xai": "https://api.x.ai/v1",
    "custom": None,
}
CLI_NAMES = {"claude": "Claude Code", "grok": "Grok Build", "codex": "Codex CLI"}
API_NAMES = {"openai": "OpenAI API", "anthropic": "Anthropic API", "xai": "xAI API", "custom": "自訂 API"}
# 推理強度：各家接受的值不一樣（CLI 的 --help／錯誤訊息、API 文件）。None＝不送，用 CLI／模型自己的預設。
EFFORTS = {
    "claude": ("low", "medium", "high", "xhigh", "max"),
    "grok": ("low", "medium", "high", "xhigh"),
    "codex": ("low", "medium", "high", "xhigh"),
    "openai": ("low", "medium", "high", "xhigh"),
    "anthropic": ("low", "medium", "high", "xhigh", "max"),
    "xai": ("low", "high"),
    "custom": ("low", "medium", "high"),
}
BUILTINS = {
    "claude": ("sonnet", "opus", "haiku"),
    "grok": ("grok-build",),
    "codex": (),
    "openai": ("gpt-5-mini", "gpt-5"),
    "anthropic": ("claude-sonnet-4-6", "claude-haiku-4-5"),
    "xai": ("grok-4.7",),
    "custom": (),
}
CLI_ISOLATION = {
    "claude": {"level": "strict", "note": "模型的本機工具、MCP 和斜線指令都已關閉。"},
    # 2026-11-18 在 Grok Build 1.0.77 實測：這組旗標下 available_commands 的 tools 是空的（模型手上沒有任何工具）。
    "grok": {"level": "strict", "note": "模型的本機工具、MCP 和網頁搜尋都已關閉（實測沒有任何工具）。"},
    "codex": {"level": "readonly", "note": "已停用 shell 工具並使用唯讀沙箱。這條連線的模型理論上能讀這台電腦的檔案（不能改）。"},
}
CLI_SCHEMA = {
    "type": "object",
    "properties": {
        "say": {"type": "string"},
        "calls": {"type": "array", "items": {
            "type": "object",
            "properties": {"name": {"type": "string"}, "args": {"type": "object"}},
            "required": ["name", "args"],
            "additionalProperties": False,
        }},
    },
    "required": ["say", "calls"],
    "additionalProperties": False,
}
ERRORS = {
    "login": "這套 CLI 尚未登入。請在主機登入後再試。",
    "model": "這個模型目前無法使用。請確認模型名稱與帳號權限。",
    "key": "API 金鑰缺少、無效或權限不足。請檢查助理設定。",
    "timeout": "等待模型回應逾時。請稍後再試。",
    "rate": "模型服務暫時限制請求或額度用完了。請稍後再試，或查看帳號額度。",
    "format": "模型回應的格式不完整或無法辨識。請重試或換一個模型。",
    "unavailable": "目前連不上模型服務。請檢查連線設定後再試。",
    "aborted": "已停止等待模型回應。",
    "local_only": "這項操作只開放給執行墨池的電腦。",
    "too_large": "聊天內容太多了。每次最多 400 KB、200 則訊息，請先清除部分對話。",
}
TOOL_NAME = re.compile(r"[A-Za-z0-9_-]{1,64}")
VERSION = re.compile(r"\b\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b")
_settings_lock = threading.Lock()
_keys = {}
_custom_env_bases = {}


class AssistantError(Exception):
    """只讓可顯示的訊息進 HTTP 和 SSE，避免上游把金鑰或帳號資料夾帶回頁面。"""

    def __init__(self, code, message=None, status=400):
        super().__init__(message or ERRORS[code])
        self.code = code
        self.status = status

    def payload(self):
        """JSON 路由需要一致的錯誤欄位。"""
        return {"ok": False, "code": self.code, "error": str(self)}


def is_local(addr):
    """來源以 TCP 對端為準，不能用瀏覽器能自己填的標頭。"""
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    if ip.version == 6 and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return str(ip) in ("127.0.0.1", "::1")


def trusted_host(host_header):
    """遠端裝置連進來時，Host 要是這台機器本來會被叫的名字：IP、MagicDNS 的單字名、*.ts.net、*.local。
    DNS 重綁的網頁會帶它自己的網域（有點、不是 ts.net），在叫模型、花額度之前就擋掉。"""
    host = urllib.parse.urlsplit("//" + (host_header or "")).hostname
    if not host:
        return False
    host = host.rstrip(".").lower()
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass
    return host == "localhost" or "." not in host or host.endswith((".ts.net", ".local"))


def _config_path():
    """測試及各實例可指定不同存檔，金鑰也跟著該實例的設定路徑分開。"""
    override = os.environ.get("ASSISTANT_CONFIG_PATH")
    return Path(override or Path(__file__).resolve().parent / "data" / "assistant.json").resolve()


def _clean_text(value, maximum):
    """拒絕控制字元與無法編碼的設定值，避免 URL、標頭和存檔收到壞資料。"""
    return (isinstance(value, str) and len(value) <= maximum
            and all(ord(c) >= 32 and ord(c) != 127 and not 0xD800 <= ord(c) <= 0xDFFF for c in value))


def _base_url(value):
    """Base URL 是 API 根路徑。帳密、查詢參數或片段會被存檔，因此拒絕這些寫法。"""
    if not _clean_text(value, 2048) or any(c.isspace() or c in "\\?#" for c in value):
        raise AssistantError("format", "請填入有效的 API Base URL，網址裡不能帶金鑰或查詢參數。")
    try:
        url = urllib.parse.urlsplit(value)
        if url.scheme not in ("http", "https") or not url.hostname or url.username is not None:
            raise ValueError
        if url.port is not None and not 1 <= url.port <= 65535:
            raise ValueError
        if not value.isascii():
            raise ValueError
    except ValueError:
        raise AssistantError("format", "API Base URL 請填 HTTP 或 HTTPS 網址，網址裡不能帶帳密。") from None
    return urllib.parse.urlunsplit((url.scheme, url.netloc.lower(), url.path.rstrip("/"), "", ""))


def _connection(raw, *, require_base=True):
    """只擷取公開欄位，讓舊檔或輸入裡多出的欄位都進不了回應與存檔。"""
    if not isinstance(raw, dict):
        raise AssistantError("format", "請選擇助理的連線方式。")
    kind, provider = raw.get("kind"), raw.get("provider")
    providers = CLI_NAMES if kind == "cli" else API_NAMES if kind == "api" else {}
    if not isinstance(provider, str) or provider not in providers:
        raise AssistantError("format", "請選擇支援的模型供應商。")
    model = raw.get("model")
    if model is not None:
        if not _clean_text(model, 256):
            raise AssistantError("model")
        model = model.strip() or None
    effort = raw.get("effort")
    if effort in (None, ""):
        effort = None
    elif effort not in EFFORTS[provider]:
        raise AssistantError("format", "推理強度只能選：" + "、".join(EFFORTS[provider]) + "，或留預設。")
    conn = {"kind": kind, "provider": provider, "model": model, "effort": effort}
    if provider == "custom" and (require_base or raw.get("baseUrl") not in (None, "")):
        conn["baseUrl"] = _base_url(raw.get("baseUrl"))
    return conn


def _stored(path):
    """呼叫端持鎖，讓自動備份還原與儲存的讀改寫依序進行。"""
    raw = file_lock.read_json(path, label="助理設定")
    if raw is None:
        return {"connection": None, "allowRemote": False}
    if not isinstance(raw, dict) or not isinstance(raw.get("allowRemote", False), bool):
        raise AssistantError("format", "助理設定檔的格式有誤，請先檢查存檔。", status=503)
    conn = raw.get("connection")
    # 環境金鑰（MOCHI_CUSTOM_API_KEY）上次綁的自訂端點：重開之後照舊只給它，不會變成「重開後第一個讀到的」。
    bound = raw.get("customEnvBase")
    if isinstance(bound, str) and bound:
        _custom_env_bases.setdefault(path, bound)
    return {"connection": _connection(conn) if conn is not None else None, "allowRemote": raw.get("allowRemote", False)}


def _identity(conn):
    """自訂服務的金鑰要與完整 Base URL 配對，切換端點時不轉送舊金鑰。"""
    return (conn["provider"], conn.get("baseUrl")) if conn and conn["kind"] == "api" else None


def _key_input(raw):
    """空字串視為未填，清除由 clearKey 明確表示。"""
    key = raw.get("apiKey")
    if key is None or key == "":
        return None
    if not _clean_text(key, 4096) or not key.isascii():
        raise AssistantError("key", "API 金鑰的格式有誤，請重新貼上。")
    return key.strip() or None


def _bind_custom_env(path, conn):
    """環境金鑰在這次服務啟動期間，只能給第一次讀到的自訂端點。"""
    identity = _identity(conn)
    if identity and identity[0] == "custom" and os.environ.get("MOCHI_CUSTOM_API_KEY"):
        _custom_env_bases.setdefault(path, identity[1])


def _api_key(path, conn, saved):
    """查詢別的自訂網址不可借用已存的金鑰。環境金鑰只對已選定的自訂端點生效。"""
    _bind_custom_env(path, saved)
    identity = _identity(conn)
    if not identity:
        return None
    provider, base = identity
    saved_key = _keys.get(path)
    if saved_key is not None and saved_key[0] == identity:
        return saved_key[1]
    if provider == "custom" and (identity != _identity(saved) or _custom_env_bases.get(path) != base):
        return None
    with contextlib.suppress(AssistantError):
        return _key_input({"apiKey": os.environ.get(f"MOCHI_{provider.upper()}_API_KEY")})
    return None  # 環境設定有誤時仍可開啟設定頁，換成有效的金鑰。


def _public_config(data, key):
    """把記憶體或環境金鑰縮成一個有無欄位。"""
    conn = data["connection"]
    return {"ok": True, "connection": {**conn, "hasKey": bool(key)} if conn else None,
            "allowRemote": data["allowRemote"]}


def _snapshot():
    """固定同一次模型請求用的設定與金鑰，避免設定半途被換成另一家。"""
    path = _config_path()
    with _settings_lock, file_lock.locked(path):
        data = _stored(path)
        conn = data["connection"]
        return data, _api_key(path, conn, conn)


def get_config():
    """瀏覽器只能知道金鑰是否已設定。"""
    return _public_config(*_snapshot())


def save_config(payload):
    """先確定存檔成功，再換記憶體內的金鑰，讀取才不會拿到一半更新。"""
    path = _config_path()
    raw = payload.get("connection")
    conn = _connection(raw) if raw is not None else None
    clear = raw.get("clearKey", False) if conn else False
    allow_remote = payload.get("allowRemote")
    if not isinstance(clear, bool) or ("allowRemote" in payload and not isinstance(allow_remote, bool)):
        raise AssistantError("format", "允許遠端和清除金鑰的值應為開或關。")
    supplied = _key_input(raw) if conn and conn["kind"] == "api" else None
    if supplied and clear:
        raise AssistantError("format", "請選擇更新或清除金鑰。")
    with _settings_lock, file_lock.locked(path):
        old = _stored(path)
        _bind_custom_env(path, old["connection"])
        if "connection" not in payload:
            conn = old["connection"]
        data = {"connection": conn, "allowRemote": old["allowRemote"] if allow_remote is None else allow_remote}
        if os.environ.get("MOCHI_CUSTOM_API_KEY") and _custom_env_bases.get(path):
            # 只存端點網址（不是金鑰）：伺服器重開後，環境金鑰還是只給原本那個端點。
            data["customEnvBase"] = _custom_env_bases[path]
        file_lock.write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        identity = _identity(conn)
        if clear or identity != _identity(old["connection"]):
            _keys.pop(path, None)
        if identity and supplied:
            _keys[path] = (identity, supplied)
        return _public_config(data, _api_key(path, conn, conn))


def status(*, local):
    """聊天入口需要連線名稱及可用範圍，詳細設定留在本機設定端點。"""
    path = _config_path()
    with _settings_lock, file_lock.locked(path):
        data = _stored(path)
    conn = data["connection"]
    public = None
    if conn:
        kind, provider, model, effort = conn["kind"], conn["provider"], conn["model"], conn["effort"]
        name = (CLI_NAMES if kind == "cli" else API_NAMES)[provider]
        public = {"kind": kind, "provider": provider, "model": model, "effort": effort,
                  "label": f"{name} · {model or '預設模型'}" + (f" · {effort}" if effort else "")}
    return {"ok": True, "configured": public is not None, "connection": public,
            "allowRemote": data["allowRemote"], "local": local}


def _json_value(raw):
    """拒絕 Python 額外接受的 NaN／Infinity，保持工具參數可由瀏覽器解析。"""
    def invalid_constant(_):
        raise ValueError
    return json.loads(raw, parse_constant=invalid_constant)


def _json_bytes(value):
    """送出標準 JSON，讓換行與非 ASCII 字元不影響工具參數的內容。"""
    return json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")


def _builtin(provider):
    """內建項目只拿來試選，帳號能否用該模型仍由測試連線驗證。"""
    return _model_items(BUILTINS[provider])


def _model_items(items):
    """各家模型清單欄位命名不同，只保留可供選擇的 ID 與顯示名稱。"""
    models = {}
    for item in items:
        if isinstance(item, str):
            model = label = item
        elif isinstance(item, dict):
            model = item.get("model") or item.get("id")
            label = item.get("display_name") or item.get("displayName") or item.get("name") or model
        else:
            continue
        if _clean_text(model, 256) and model.strip() and model not in models:
            models[model] = {"id": model, "label": label if _clean_text(label, 256) else model}
    return list(models.values())


def find_cli(provider):
    """桌面程式內附的真 CLI 常不在 PATH。檢查已知安裝布局，不掃整台電腦。"""
    # Windows 批次檔會經 cmd.exe 解讀參數，聊天只直接啟動原生執行檔。
    found = shutil.which(provider + ".exe" if os.name == "nt" else provider)
    if found and Path(found).resolve().parent != Path.cwd():
        return [str(Path(found).resolve())]
    if os.name == "nt" and os.environ.get("LOCALAPPDATA"):
        local = Path(os.environ["LOCALAPPDATA"])
        patterns = {
            # MSIX 允許直達套件資料夾，但從 Claude-Data 枚舉可能被拒絕。
            "claude": "Claude-Data/claude_pzs8sxrjxfjjc/claude-code/*/*/claude.exe",
            "codex": "OpenAI/Codex/bin/*/codex.exe",
            "grok": "",
        }
        pattern = patterns[provider]
        candidates = [p for p in local.glob(pattern) if p.is_file()] if pattern else []
        if candidates:
            return [str(max(candidates, key=lambda p: p.stat().st_mtime))]
    try:
        home = Path.home()
    except RuntimeError:
        return None
    dirs = {"claude": ".local/bin", "grok": ".grok/bin", "codex": ".codex/bin"}
    executable = home / dirs[provider] / (provider + (".exe" if os.name == "nt" else ""))
    return [str(executable)] if executable.is_file() and os.access(executable, os.X_OK) else None


def _run_probe(command, args, cwd):
    """只用固定的官方狀態命令。關閉 stdin，逾時由 subprocess.run 終止該程序。"""
    child = subprocess.run(command + args, cwd=cwd, stdin=subprocess.DEVNULL, capture_output=True,
                           encoding="utf-8", errors="replace", timeout=PROBE_TIMEOUT, env=_cli_env())
    return child.returncode, child.stdout, child.stderr


def _cli_env():
    """CLI 探測和聊天用 CLI 自己的認證，四家的墨池 API 金鑰不必交給子程序。"""
    private = {f"MOCHI_{provider.upper()}_API_KEY" for provider in API_NAMES}
    return {name: value for name, value in os.environ.items() if name.upper() not in private}


def _cli_version(command, cwd):
    """不要把啟動警告、完整檔案路徑或帳號資訊當成版本回傳。"""
    code, out, _ = _run_probe(command, ["--version"], cwd)
    version = VERSION.search(out) if code == 0 else None
    return version.group() if version else None


def _grok_models(out):
    """grok models 會印文字目錄。只讀模型 ID，略過表格標題、提示與帳號資訊。"""
    try:
        value = _json_value(out)
    except ValueError:
        value = None
    if isinstance(value, dict):
        value = value.get("models") or value.get("data")
    if isinstance(value, list):
        return _model_items(value)
    ids = []
    for line in out.splitlines():
        # grok 1.0.77：預設那個寫「* grok-4.7 (default)」，其他寫「- grok-4.6」：兩種項目符號都要剝掉。
        fields = re.split(r"[\s│|]+", line.strip(" \t│|*•-"))
        if fields and re.fullmatch(r"grok-[a-zA-Z0-9_.:-]+", fields[0]):
            ids.append(fields[0])
    return _model_items(ids)


def _codex_models(command, cwd):
    """只對 App Server 做初始化和 model/list，讓帳號目錄可查又不開聊天。"""
    incoming = queue.Queue()
    with subprocess.Popen(command + ["app-server", "--stdio", "-c", "mcp_servers={}"],
                          cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, env=_cli_env()) as proc:
        def read_messages():
            try:
                while line := proc.stdout.readline(MAX_RESPONSE_BYTES + 1):
                    incoming.put(line)
            finally:
                incoming.put(None)

        def send(method, ident=None, params=None):
            msg = {"method": method}
            if ident is not None:
                msg["id"] = ident
            if params is not None:
                msg["params"] = params
            proc.stdin.write(_json_bytes(msg) + b"\n")
            proc.stdin.flush()

        def receive(ident):
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise queue.Empty
                line = incoming.get(timeout=remaining)
                if line is None or len(line) > MAX_RESPONSE_BYTES:
                    return None
                try:
                    msg = _json_value(line)
                except (ValueError, RecursionError):
                    continue
                if isinstance(msg, dict) and msg.get("id") == ident:
                    return msg.get("result")

        reader = threading.Thread(target=read_messages, daemon=True)
        reader.start()
        deadline = time.monotonic() + PROBE_TIMEOUT
        try:
            send("initialize", 1, {"clientInfo": {"name": "mochi", "version": "1.0"}})
            if receive(1) is not None:
                send("initialized")
                send("model/list", 2, {"limit": 100})
                result = receive(2)
                if isinstance(result, dict) and isinstance(result.get("data"), list):
                    return _model_items(result["data"])
        except queue.Empty:
            pass  # 目錄逾時不代表登出，仍可在畫面顯示獨立的登入結果。
        finally:
            with contextlib.suppress(OSError):
                proc.kill()
            reader.join(timeout=1)
    return []


def _probe_cli(provider):
    """版本、登入、模型分開驗證，某個選項不支援時仍保留已確認的資料。"""
    result = {"id": provider, "name": CLI_NAMES[provider], "installed": False, "version": None,
              "login": "unknown", "loginCode": "missing", "loginNote": "尚未安裝或找不到執行檔。", "models": [],
              "usable": False, "note": "找不到執行檔。", "isolation": dict(CLI_ISOLATION[provider])}
    try:
        command = find_cli(provider)
        if not command:
            return result
        # loginCode 跟中文短句分開：頁面照代碼取一句，英文才翻得動，不會跟隔離說明黏成一段。
        result.update(installed=True, path=command[0], usable=True, note="", models=_builtin(provider),
                      loginCode="unconfirmed", loginNote="這版 CLI 未能確認登入狀態。")
        with tempfile.TemporaryDirectory(prefix="mochi-cli-probe-") as cwd:
            result["version"] = _cli_version(command, cwd)
            args = {"claude": ["auth", "status", "--json"], "grok": ["models"],
                    "codex": ["login", "status"]}[provider]
            code, out, err = _run_probe(command, args, cwd)
            if provider == "claude":
                data = _json_value(out)
                logged = data.get("loggedIn") if isinstance(data, dict) else None
                if isinstance(logged, bool):
                    result["login"] = "ok" if logged else "no"
            elif provider == "codex":
                log = (out + "\n" + err).lower()
                if "not logged in" in log:
                    result["login"] = "no"
                elif code == 0 and "logged in" in log:
                    result["login"] = "ok"
                try:
                    result["models"] = _codex_models(command, cwd)
                except (OSError, ValueError):
                    pass  # 安裝包可能沒有提供 app-server，這不影響 login status。
            else:
                if _provider_error(out + "\n" + err, cli=True).code == "login":
                    result["login"] = "no"
                elif code == 0:
                    result["models"] = _grok_models(out) or result["models"]
                    # grok models 第一行就說登入狀態：「You are logged in with grok.com.」（1.0.77 實測）。
                    # 以前沒讀這一行，明明登入了還寫「登入待確認」。
                    log = (out + "\n" + err).lower()
                    if "not logged in" in log or "not signed in" in log:
                        result["login"] = "no"
                    elif re.search(r"\b(logged|signed) in\b", log):
                        result["login"] = "ok"
                    else:
                        result["loginCode"] = "catalog"
                        result["loginNote"] = "已查詢模型目錄，登入狀態仍待確認。"
            if result["login"] != "unknown":
                result["loginCode"] = "ok" if result["login"] == "ok" else "no"
                result["loginNote"] = "已登入。" if result["login"] == "ok" else "尚未登入。"
    except subprocess.TimeoutExpired:
        result["loginCode"] = "timeout"
        result["loginNote"] = "CLI 偵測逾時，請稍後再試。"
    except (OSError, ValueError, RecursionError):
        result["loginCode"] = "read_failed"
        result["loginNote"] = "CLI 的狀態讀取失敗。"
    return result


def detect():
    """各套 CLI 獨立探測，單一程序卡住時不延後另外兩套的檢查。"""
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(CLI_NAMES)) as pool:
        return {"ok": True, "clis": list(pool.map(_probe_cli, CLI_NAMES))}


def _provider_error(details, status=None, *, cli=False):
    """只用上游錯誤做分類。網頁看到固定的中文訊息，避免回應夾帶憑證和路徑。"""
    if isinstance(details, dict):
        fields = (details.get("code"), details.get("type"), details.get("message"))
        hint = " ".join(str(v) for v in fields if isinstance(v, str)).casefold()
    else:
        hint = str(details).casefold()
    if status in (408, 504) or any(s in hint for s in ("timed out", "timeout", "deadline exceeded")):
        return AssistantError("timeout", status=504)
    if status in (402, 429, 529) or any(s in hint for s in (
        "rate_limit", "rate limit", "too many requests", "overloaded", "insufficient_quota", "credit balance",
    )):
        return AssistantError("rate", status=429)
    if any(s in hint for s in ("invalid_api_key", "invalid api key", "invalid x-api-key", "incorrect api key")):
        return AssistantError("key", status=401)
    if "model_not_found" in hint or (
        "model" in hint and any(s in hint for s in (
            "not found", "does not exist", "not supported", "unavailable", "not available", "no access",
            "does not have access", "do not have access", "invalid model", "is invalid", "not allowed", "not enabled",
        ))
    ):
        return AssistantError("model", status=404)
    if cli and any(s in hint for s in ("not logged in", "not authenticated", "please log in", "please login",
                                        "sign in", "login required", "no credentials", "unauthorized")):
        return AssistantError("login", status=401)
    if status in (401, 403) or any(s in hint for s in ("authentication_error", "permission_error", "unauthorized")):
        return AssistantError("login" if cli else "key", status=401)
    if status == 404:
        return AssistantError("model", status=404)
    if status in (400, 422) or any(s in hint for s in ("schema", "invalid json", "structured output")):
        return AssistantError("format", status=502)
    return AssistantError("unavailable", status=502)


class _CancelScope:
    """模型工作只有一個活躍連線或程序，取消時先中斷其 I/O，工作執行緒再收尾。"""

    def __init__(self):
        self._lock = threading.Lock()
        self._cancelled = False
        self._interrupt = None

    def stop(self):
        """中斷已經拿到的資源，也阻止遲到的資源繼續服務。"""
        with self._lock:
            self._cancelled = True
            if self._interrupt is not None:
                with contextlib.suppress(OSError):
                    self._interrupt()

    def check(self):
        """取消後不再送出文字或可被執行的工具呼叫。"""
        with self._lock:
            if self._cancelled:
                raise AssistantError("aborted")

    @contextlib.contextmanager
    def interrupt_with(self, action):
        # stop 可能發生在 connect 或 Popen 回來之前。就算已取消也要斷掉新資源。
        try:
            with self._lock:
                self._interrupt = action
                if self._cancelled:
                    with contextlib.suppress(OSError):
                        action()
                    raise AssistantError("aborted")
            yield
        finally:
            with self._lock:
                self._interrupt = None


@contextlib.contextmanager
def _api_request(conn, key, endpoint, *, body=None, cancel=None):
    """使用明確選定的主機。一個連線對應一個請求，避免跟隨重導而傳出金鑰。"""
    provider = conn["provider"]
    if not key and provider != "custom":
        raise AssistantError("key", status=401)
    base = conn.get("baseUrl") if provider == "custom" else API_BASES[provider]
    url = urllib.parse.urlsplit(base)
    headers = {"Accept": "text/event-stream" if body is not None else "application/json"}
    if provider == "anthropic":
        headers.update({"x-api-key": key, "anthropic-version": "2023-06-01"})
    elif key:
        headers["Authorization"] = f"Bearer {key}"
    if body is not None:
        headers["Content-Type"] = "application/json"
    cls = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
    upstream = cls(url.hostname, url.port, timeout=CONNECT_TIMEOUT)
    cancel = cancel if cancel is not None else _CancelScope()
    try:
        cancel.check()
        upstream.connect()
        sock = upstream.sock
        with cancel.interrupt_with(lambda: sock.shutdown(socket.SHUT_RDWR)):
            sock.settimeout(CHAT_TIMEOUT if body is not None else CONNECT_TIMEOUT)
            upstream.request("POST" if body is not None else "GET", url.path + endpoint, body, headers)
            with upstream.getresponse() as response:
                if not 200 <= response.status < 300:
                    if body is None and response.status in (404, 405, 501):
                        yield None  # 有些 OpenAI 相容服務只提供聊天，仍可手填模型。
                        return
                    raw = response.read(16384)
                    try:
                        parsed = _json_value(raw)
                        info = parsed.get("error", parsed) if isinstance(parsed, dict) else parsed
                    except (ValueError, RecursionError):
                        info = raw.decode("utf-8", "replace")
                    raise _provider_error(info, response.status)
                yield response
    except TimeoutError:
        raise AssistantError("timeout", status=504) from None
    except (OSError, http.client.HTTPException):
        cancel.check()
        raise AssistantError("unavailable", status=502) from None
    finally:
        upstream.close()


def _response_json(raw):
    """串流或目錄回應不合格式時，只送一個能讓使用者重試的錯誤。"""
    try:
        value = _json_value(raw)
    except (ValueError, RecursionError):
        raise AssistantError("format", status=502) from None
    if not isinstance(value, dict):
        raise AssistantError("format", status=502)
    return value


def _models_out(conn, models, source):
    """帶回這次問的是哪一條連線。頁面拿慢回來的清單時要對得上，切換後的舊回應不能套到新的。"""
    out = {"ok": True, "models": models, "source": source, "provider": conn["provider"]}
    if conn.get("baseUrl"):
        out["baseUrl"] = conn["baseUrl"]
    return out


def models(payload):
    """可先用暫填的金鑰看清單，確認後才另外存入設定。"""
    conn = _connection(payload, require_base=False)
    provider = conn["provider"]
    builtin = _builtin(provider)
    if conn["kind"] == "cli":
        items = _probe_cli(provider)["models"]
        return _models_out(conn, items, "list" if items and items != builtin else "builtin")
    path = _config_path()
    with _settings_lock, file_lock.locked(path):
        saved = _stored(path)["connection"]
        if provider == "custom" and "baseUrl" not in conn:
            if not saved or saved["provider"] != "custom":
                raise AssistantError("format", "請先填入自訂服務的 API Base URL。")
            conn["baseUrl"] = saved["baseUrl"]
        key = _key_input(payload) or _api_key(path, conn, saved)
    if not key and provider != "custom":
        return _models_out(conn, builtin, "builtin")
    items = []
    endpoint = "/models"
    seen_cursors = set()
    while True:
        with _api_request(conn, key, endpoint) as response:
            if response is None:
                return _models_out(conn, builtin, "builtin")
            raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise AssistantError("format", "模型清單太大，請直接填寫模型名稱。", status=502)
        data = _response_json(raw)
        if not isinstance(data.get("data"), list):
            raise AssistantError("format", "讀不到模型清單，請檢查連線或直接填寫模型名稱。", status=502)
        items.extend(_model_items(data["data"]))
        if provider != "anthropic" or not data.get("has_more"):
            break
        cursor = data.get("last_id")
        if not _clean_text(cursor, 256) or not cursor or cursor in seen_cursors or len(seen_cursors) >= 10:
            raise AssistantError("format", "模型清單的分頁有誤，請直接填寫模型名稱。", status=502)
        seen_cursors.add(cursor)
        endpoint = "/models?" + urllib.parse.urlencode({"after_id": cursor})
    unique = {item["id"]: item for item in items}
    return _models_out(conn, list(unique.values()), "list")


def _name_ok(name):
    """沿用 API 工具名稱的共同字元集，避免某家接受、另一家拒絕。"""
    return isinstance(name, str) and TOOL_NAME.fullmatch(name) is not None


def validate_chat(payload):
    """先擋超量或不完整的對話，再開 SSE 和扣用模型額度。"""
    system = payload.get("system", "")
    tools = payload.get("tools", [])
    messages = payload.get("messages")
    if isinstance(messages, list) and len(messages) > MAX_MESSAGES:
        raise AssistantError("too_large", status=413)
    if not isinstance(system, str) or not isinstance(tools, list) or not isinstance(messages, list) or not messages:
        raise AssistantError("format", "聊天需要有效的系統提示、工具清單和至少一則訊息。")
    names = set()
    clean_tools = []
    for tool in tools:
        if (not isinstance(tool, dict) or not _name_ok(tool.get("name")) or tool["name"] in names
                or not isinstance(tool.get("description"), str) or not isinstance(tool.get("input_schema"), dict)):
            raise AssistantError("format", "聊天工具的定義不完整，請重新開啟聊天室再試。")
        names.add(tool["name"])
        clean_tools.append({field: tool[field] for field in ("name", "description", "input_schema")})
    clean_messages = []
    pending = {}
    for message in messages:
        if not isinstance(message, dict) or not isinstance(message.get("content"), str):
            raise AssistantError("format", "聊天訊息缺少有效內容。")
        role = message.get("role")
        item = {"role": role, "content": message["content"]}
        if role == "user" and pending:
            # 按停可能只留下部分工具結果。新一輪仍可開始，且模型必須重讀工作台確認結果。
            result = json.dumps({
                "ok": False, "status": "unknown", "code": "aborted",
                "error": "前一輪這個工具未回報結果。請重讀工作台確認目前狀態。",
            }, ensure_ascii=False)
            clean_messages.extend({"role": "tool", "toolCallId": ident, "name": name, "content": result}
                                  for ident, name in pending.items())
            pending.clear()
        if role == "tool":
            ident, name = message.get("toolCallId"), message.get("name")
            if not _clean_text(ident, 256) or pending.pop(ident, None) != name or not _name_ok(name):
                raise AssistantError("format", "聊天記錄裡有對不上的工具結果。請清除對話後再試。")
            item.update(toolCallId=ident, name=name)
        elif role in ("assistant", "user") and not pending:
            if role == "assistant":
                calls = message.get("toolCalls", [])
                if not isinstance(calls, list):
                    raise AssistantError("format", "聊天記錄裡有不完整的工具呼叫。")
                if calls:
                    item["toolCalls"] = []
                for call in calls:
                    if (not isinstance(call, dict) or not _name_ok(call.get("name"))
                            or not isinstance(call.get("args"), dict) or not _clean_text(call.get("id"), 256)
                            or not call["id"] or call["id"] in pending):
                        raise AssistantError("format", "聊天記錄裡有不完整或重複的工具呼叫。")
                    pending[call["id"]] = call["name"]
                    item["toolCalls"].append({field: call[field] for field in ("id", "name", "args")})
        else:
            raise AssistantError("format", "聊天記錄裡有無效的角色或缺少工具結果。")
        clean_messages.append(item)
    if pending:
        raise AssistantError("format", "聊天記錄裡缺少工具結果。請清除對話後再試。")
    chat = {"system": system, "tools": clean_tools, "messages": clean_messages}
    try:
        _json_bytes(chat)
    except (ValueError, RecursionError):
        raise AssistantError("format", "聊天內容有無法讀取的字元或數值。") from None
    return chat


def _api_body(conn, chat, force_tool):
    """兩套原生工具協定各自重建歷史，Anthropic 的並列結果要放進同一則 user 訊息。"""
    anthropic = conn["provider"] == "anthropic"
    system, tools = chat["system"], chat["tools"]
    messages = []
    if not anthropic and system:
        messages.append({"role": "system", "content": system})
    for entry in chat["messages"]:
        role, text = entry["role"], entry["content"]
        if role == "tool":
            ident = entry["toolCallId"]
            if anthropic:
                block = {"type": "tool_result", "tool_use_id": ident, "content": text}
                if messages and messages[-1]["role"] == "user" and isinstance(messages[-1]["content"], list):
                    messages[-1]["content"].append(block)
                else:
                    messages.append({"role": "user", "content": [block]})
            else:
                messages.append({"role": "tool", "tool_call_id": ident, "content": text})
            continue
        message = {"role": role, "content": text}
        calls = entry.get("toolCalls", [])
        if calls and anthropic:
            message["content"] = ([{"type": "text", "text": text}] if text else []) + [
                {"type": "tool_use", "id": c["id"], "name": c["name"], "input": c["args"]} for c in calls
            ]
        elif calls:
            message["tool_calls"] = [
                {"type": "function", "id": c["id"],
                 "function": {"name": c["name"], "arguments": _json_bytes(c["args"]).decode("utf-8")}}
                for c in calls
            ]
        messages.append(message)
    body = {"model": conn["model"], "messages": messages, "stream": True}
    effort = conn.get("effort")
    if anthropic:
        # 新模型的思考算在 max_tokens 裡，4096 在 high 以上會切掉；串流送出不怕逾時。
        body["max_tokens"] = 16000
        if effort:
            body["output_config"] = {"effort": effort}
        if system:
            body["system"] = system
        if tools:
            body["tools"] = tools
        # 自動快取到最後一個區塊：同一輪的下一步、下一句話，前面的工具、系統說明和舊對話都從快取讀，
        # 第一個字出來得快。系統說明裡沒有時間（時間在使用者訊息），前綴才每次一樣。
        body["cache_control"] = {"type": "ephemeral"}
        # Opus 5.5、Sonnet 5.5、Fable 5.1 以後指定工具（type tool／any）會回 400。
        # 測試連線的 system 已經說只呼叫這個工具，用 auto 讓新舊模型都能過。
    else:
        if effort:
            body["reasoning_effort"] = effort
        if tools:
            body["tools"] = [{"type": "function", "function": {"name": tool["name"],
                             "description": tool["description"], "parameters": tool["input_schema"]}}
                             for tool in tools]
        if force_tool:
            body["tool_choice"] = {"type": "function", "function": {"name": force_tool}}
    return body


def _sse_frames(response):
    """SSE 之內可有多行 data，HTTP 分段也可能切在 UTF-8 字中間。"""
    remaining = MAX_RESPONSE_BYTES
    fields = []
    while line := response.readline(remaining + 1):
        remaining -= len(line)
        if remaining < 0:
            raise AssistantError("format", "模型的回應太長，請縮短問題後再試。", status=502)
        line = line.rstrip(b"\r\n")
        if not line:
            if fields:
                data = b"\n".join(fields)
                if data.strip() == b"[DONE]":
                    yield None
                    return
                yield _response_json(data)
                fields.clear()
            continue
        if line.startswith(b"data:"):
            fields.append(line[5:].removeprefix(b" "))
    if fields:
        raise AssistantError("format", status=502)


def _call_result(ident, name, args):
    """工具呼叫只接受物件參數，JSON 壞掉整批退回，避免頁面只執行了半個指令。"""
    try:
        args = _json_value(args) if isinstance(args, str) else args
        if not _name_ok(name) or not isinstance(args, dict):
            raise ValueError
        _json_bytes(args)
    except (ValueError, RecursionError):
        raise AssistantError("format", "模型送來的工具參數讀不懂，請重試。", status=502) from None
    if ident is not None and not _clean_text(ident, 256):
        raise AssistantError("format", status=502)
    return {"id": ident or "call_" + uuid.uuid4().hex, "name": name, "args": args}


def _text_event(text):
    """確保串流的文字可以用 UTF-8 編碼，避免壞輸出讓 SSE 卡在半個事件。"""
    if not isinstance(text, str) or any(0xD800 <= ord(c) <= 0xDFFF for c in text):
        raise AssistantError("format", status=502)
    return "text", {"delta": text}


def _end_events(calls, tools, usage):
    """只有完整且屬於這輪工具清單的呼叫才發給頁面。"""
    done = {"reason": "tool_calls" if calls else "end"}
    if calls:
        names = {tool["name"] for tool in tools}
        ids = set()
        for call in calls:
            if call["name"] not in names or call["id"] in ids:
                raise AssistantError("format", "模型提出了未定義或重複的工具呼叫，請重試。", status=502)
            ids.add(call["id"])
        yield "tool_calls", {"calls": calls}
    counts = {k: v for k, v in usage.items() if k in (
        "input_tokens", "output_tokens", "prompt_tokens", "completion_tokens", "total_tokens",
    ) and type(v) is int and v >= 0}
    if counts:
        done["usage"] = counts
    yield "done", done


def _chat_completions(frames, tools):
    """以 delta 的 index 合併並行呼叫，直到收到正常的完成訊號才解析 JSON。"""
    parts, usage = {}, {}
    finish = None
    sentinel = False
    for frame in frames:
        if frame is None:
            sentinel = True
            break
        if "error" in frame:
            raise _provider_error(frame["error"])
        usage.update(frame.get("usage") or {})
        for choice in frame.get("choices", []):
            if choice.get("index", 0) != 0:
                continue
            finish = choice.get("finish_reason") or finish
            delta = choice.get("delta") or choice.get("message") or {}
            text = delta.get("content") or delta.get("refusal")
            if text:
                yield _text_event(text)
            for pos, call in enumerate(delta.get("tool_calls") or []):
                idx = call.get("index", pos)
                if type(idx) is not int or idx < 0 or call.get("type", "function") != "function":
                    raise AssistantError("format", status=502)
                part = parts.setdefault(idx, {"id": None, "names": [], "arguments": []})
                if call.get("id"):
                    if part["id"] and call["id"] != part["id"]:
                        raise AssistantError("format", status=502)
                    part["id"] = call["id"]
                function = call.get("function") or {}
                if function.get("name"):
                    part["names"].append(function["name"])
                if function.get("arguments") is not None:
                    part["arguments"].append(function["arguments"])
    if (not sentinel and not finish) or finish in ("length", "content_filter", "function_call"):
        raise AssistantError("format", status=502)
    if finish == "tool_calls" and not parts:
        raise AssistantError("format", status=502)
    calls = [_call_result(p["id"], "".join(p["names"]), "".join(p["arguments"]))
             for _, p in sorted(parts.items())]
    yield from _end_events(calls, tools, usage)


def _anthropic_messages(frames, tools):
    """工具的起始 input 通常是空物件，分段 JSON 才是完整的參數。"""
    pending, calls, usage = {}, {}, {}
    reason = None
    stopped = False
    for frame in frames:
        if frame is None:
            break
        kind = frame.get("type")
        index = frame.get("index")
        if kind == "error" or "error" in frame:
            raise _provider_error(frame.get("error"))
        if kind == "message_start":
            usage.update(frame.get("message", {}).get("usage") or {})
        elif kind == "content_block_start":
            block = frame["content_block"]
            if block.get("type") == "text" and block.get("text"):
                yield _text_event(block["text"])
            elif block.get("type") == "tool_use":
                if type(index) is not int or index < 0 or index in pending or index in calls:
                    raise AssistantError("format", status=502)
                pending[index] = (block, [])
        elif kind == "content_block_delta":
            delta = frame["delta"]
            if delta.get("type") == "text_delta":
                yield _text_event(delta["text"])
            elif delta.get("type") == "input_json_delta":
                pending[index][1].append(delta["partial_json"])
        elif kind == "content_block_stop" and index in pending:
            block, fragments = pending.pop(index)
            args = "".join(fragments) if fragments else block["input"]
            calls[index] = _call_result(block.get("id"), block["name"], args)
        elif kind == "message_delta":
            reason = frame.get("delta", {}).get("stop_reason") or reason
            usage.update(frame.get("usage") or {})
        elif kind == "message_stop":
            stopped = True
            break
    if not stopped or pending or reason in ("max_tokens", "refusal") or (reason == "tool_use" and not calls):
        raise AssistantError("format", status=502)
    yield from _end_events([call for _, call in sorted(calls.items())], tools, usage)


def _api_events(conn, key, chat, cancel, force_tool):
    """依 API 協定轉成同一組事件，單獨一個 JSON 回應也能接相容服務。"""
    anth = conn["provider"] == "anthropic"
    endpoint = "/messages" if anth else "/chat/completions"
    body = _json_bytes(_api_body(conn, chat, force_tool))
    with _api_request(conn, key, endpoint, body=body, cancel=cancel) as response:
        content_type = response.headers.get_content_type()
        if content_type == "application/json" and not anth:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise AssistantError("format", status=502)
            yield from _chat_completions([_response_json(raw)], chat["tools"])
        else:
            parse = _anthropic_messages if anth else _chat_completions
            yield from parse(_sse_frames(response), chat["tools"])


@contextlib.contextmanager
def _cli_invocation(conn, chat):
    """聊天和實機探測共用指令。提示詞與 schema 放在空工作目錄之外。"""
    provider = conn["provider"]
    command = find_cli(provider)
    if not command:
        raise AssistantError("unavailable", "找不到所選的 CLI。請重新偵測或改用 API。", status=503)
    model = conn["model"]
    if model and model.startswith("-"):
        raise AssistantError("model")
    model_args = ["--model", model] if model else []
    effort = conn.get("effort")
    if effort and effort not in EFFORTS[provider]:
        raise AssistantError("format", "推理強度的值不對，請到助手設定重選。")
    with tempfile.TemporaryDirectory(prefix="mochi-assistant-") as directory:
        scratch = Path(directory)
        cwd = scratch / "work"
        cwd.mkdir()
        # Grok 的 --prompt-file 看副檔名：.json 會當成 ACP 內容區塊（要有 "type"），一般文字要用 .txt。
        prompt_file = scratch / ("prompt.txt" if provider == "grok" else "prompt.json")
        instruction = ("請按 system 回答 messages 的最後一則，只輸出符合指定格式的 say 和 calls。"
                       "如需操作墨池，只能使用 tools 列出的名稱與參數，交給頁面執行。")
        if provider == "codex":
            instruction += '每筆 calls 的 args 欄位請填 JSON 物件字串。空參數填 "{}"。'
        prompt_file.write_bytes(_json_bytes({
            "instruction": instruction,
            **chat,
        }))
        schema = _json_bytes(CLI_SCHEMA).decode("utf-8")
        if provider == "claude":
            args = ["--print", "--safe-mode", "--tools", "", "--strict-mcp-config",
                    "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands",
                    "--setting-sources", "user", "--no-chrome", "--no-session-persistence",
                    "--verbose", "--output-format", "stream-json", "--include-partial-messages",
                    "--json-schema", schema, *model_args]
            if effort:
                args += ["--effort", effort]
        elif provider == "grok":
            # 空白 --tools 可能沿用預設值，先只選一項再由 denylist 剔除。
            args = ["--prompt-file", str(prompt_file), "--tools", "read_file",
                    "--disallowed-tools", "read_file,search_tool,use_tool,Agent",
                    "--permission-mode", "dontAsk", "--deny", "*", "--deny", "MCPTool",
                    "--sandbox", "strict", "--no-subagents", "--disable-web-search", "--no-plan",
                    "--no-memory", "--no-auto-update", "--output-format", "streaming-json",
                    "--json-schema", schema, *model_args]
            if effort:
                args += ["--reasoning-effort", effort]
            prompt_file = None
        else:
            # Codex 的 strict schema 不接受任意物件鍵。args 在 CLI 內用 JSON 字串傳輸。
            codex_schema = _json_value(schema)
            codex_schema["properties"]["calls"]["items"]["properties"]["args"] = {"type": "string"}
            schema_file = scratch / "schema.json"
            schema_file.write_bytes(_json_bytes(codex_schema))
            overrides = ['approval_policy="never"', 'web_search="disabled"',
                         "features.shell_tool=false", "features.view_image=false", "features.apps=false",
                         "features.plugins=false", "features.multi_agent=false", "features.multi_agent_v2=false"]
            if os.name == "nt":
                overrides.append('windows.sandbox="unelevated"')
            if effort:
                # --ignore-user-config 之後 config.toml 的強度不算數，要另外帶。
                overrides.append(f'model_reasoning_effort="{effort}"')
            args = ["exec", "--sandbox", "read-only", "--ignore-user-config", "--ignore-rules",
                    "--skip-git-repo-check", "--ephemeral", "--output-schema", str(schema_file),
                    "--json", *model_args]
            for override in overrides:
                args.extend(("-c", override))
            args.append("-")
        yield command + args, cwd, prompt_file


def _kill_tree(proc):
    """CLI 會再開子程序（node、模型的工具程序）：只殺最外層，底下那層照樣跑完、花額度。整棵一起收。"""
    if proc.poll() is not None:
        return
    if os.name == "nt":
        with contextlib.suppress(OSError, subprocess.SubprocessError):
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    else:
        with contextlib.suppress(OSError):
            os.killpg(proc.pid, signal.SIGKILL)
    with contextlib.suppress(OSError):
        proc.kill()


def _cli_process(argv, cwd, cancel, *, prompt_file, timeout, on_start=None):
    """用檔案收取輸出，取消時直接終止 CLI，不等待繼承管線的其他程序。"""
    cancel.check()
    with contextlib.ExitStack() as stack:
        stdin = stack.enter_context(prompt_file.open("rb")) if prompt_file else subprocess.DEVNULL
        out_file = stack.enter_context(tempfile.TemporaryFile())
        err_file = stack.enter_context(tempfile.TemporaryFile())
        proc = stack.enter_context(subprocess.Popen(
            argv, cwd=cwd, stdin=stdin, stdout=out_file, stderr=err_file, env=_cli_env(),
            # POSIX：自己一個程序群組，取消時 killpg 收整棵；Windows 用 taskkill /T。
            **({} if os.name == "nt" else {"start_new_session": True}),
        ))
        timed_out = False
        with cancel.interrupt_with(lambda: _kill_tree(proc)):
            try:
                if on_start is not None:
                    on_start(proc)
                proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
            except KeyboardInterrupt:
                cancel.stop()
            finally:
                if proc.poll() is None:
                    _kill_tree(proc)
                    proc.wait()
        out_file.seek(0)
        err_file.seek(0)
        out = out_file.read(MAX_RESPONSE_BYTES + 1)
        err = err_file.read(MAX_RESPONSE_BYTES + 1)
        if timed_out:
            raise subprocess.TimeoutExpired(argv, timeout, output=out, stderr=err)
        return proc.returncode, out, err


def _cli_output(provider, raw):
    """合併各家事件，等結束後讀 schema 欄位或完整的替代文字。"""
    try:
        events = [_json_value(raw)]
    except ValueError:
        events = [_response_json(line) for line in raw.splitlines() if line.strip()]
    result = None
    text = []
    complete = False
    schema_tool_ids = set()
    tool_error = "CLI 回傳了純對話以外的事件。"
    for event in events:
        if not isinstance(event, dict):
            raise AssistantError("format", status=502)
        typ = event.get("type")
        if typ in ("error", "turn.failed") or event.get("is_error"):
            raise _provider_error(event.get("error") or event.get("errors") or event.get("result") or event, cli=True)
        if event.get("structured_output_error") or event.get("structuredOutputError"):
            raise AssistantError("format", status=502)
        stop = event.get("stopReason") or event.get("stop_reason")
        if typ in ("result", "end", "turn.completed") or (typ is None and len(events) == 1):
            if stop in ("max_tokens", "max_turn_requests", "refusal", "cancelled", "canceled"):
                raise AssistantError("format", status=502)
            complete = True
            if "structured_output" in event or "structuredOutput" in event:
                result = event.get("structured_output", event.get("structuredOutput"))
            else:
                result = event if "say" in event else event.get("result") or event.get("text")
        elif provider == "codex" and typ in ("item.started", "item.updated", "item.completed"):
            item = event.get("item", {})
            if item.get("type") == "agent_message" and typ == "item.completed":
                text = [item.get("text", "")]
            elif item.get("type") not in ("agent_message", "reasoning", "todo_list"):
                raise AssistantError("format", tool_error, status=502)
        elif provider == "grok" and typ == "text":
            text.append(event.get("data", ""))
        elif typ in ("assistant", "user", "stream_event"):
            wrapper = event.get("event", {})
            blocks = event.get("message", {}).get("content", [])
            if wrapper.get("type") == "content_block_start":
                blocks = [wrapper.get("content_block", {})]
            for block in blocks:
                block_type = block.get("type")
                if block_type == "tool_use" and provider == "claude" and block.get("name") == "StructuredOutput":
                    if isinstance(block.get("id"), str):
                        schema_tool_ids.add(block["id"])
                elif block_type == "tool_result" and block.get("tool_use_id") in schema_tool_ids:
                    pass
                elif block_type not in ("text", "thinking", "redacted_thinking"):
                    raise AssistantError("format", tool_error, status=502)
            if typ == "assistant":
                text = [block.get("text", "") for block in blocks if block.get("type") == "text"]
            delta = wrapper.get("delta", {})
            if delta.get("type") == "text_delta":
                text.append(delta.get("text", ""))
        elif typ in ("tool_call", "tool_call_update"):
            raise AssistantError("format", tool_error, status=502)

    if not complete:
        raise AssistantError("format", status=502)
    if result is None and all(isinstance(part, str) for part in text):
        result = "".join(text)
    if isinstance(result, str):
        result = _response_json(result)
    if (not isinstance(result, dict) or not isinstance(result.get("say"), str)
            or not isinstance(result.get("calls"), list)):
        raise AssistantError("format", status=502)
    calls = []
    for call in result["calls"]:
        if not isinstance(call, dict) or not _name_ok(call.get("name")):
            raise AssistantError("format", status=502)
        args = call.get("args")
        if provider == "codex" and isinstance(args, str):
            args = _response_json(args)
        if not isinstance(args, dict):
            raise AssistantError("format", "CLI 回傳的工具參數需要是 JSON 物件。", status=502)
        calls.append({"name": call["name"], "args": args})
    return {"say": result["say"], "calls": calls}


def _cli_reply(provider, code, out, err):
    """先檢查程序結果，再把有效的結構化內容交給聊天或 probe。"""
    if len(out) + len(err) > MAX_RESPONSE_BYTES:
        raise AssistantError("format", "CLI 回傳的內容太長，請縮短問題後再試。", status=502)
    if code != 0:
        raise _provider_error((err + b"\n" + out).decode("utf-8", "replace"), cli=True)
    try:
        result = _cli_output(provider, out)
        _json_bytes(result)
    except (ValueError, TypeError, AttributeError, RecursionError):
        raise AssistantError("format", status=502) from None
    return result


def _cli_events(conn, chat, cancel, timeout):
    with _cli_invocation(conn, chat) as (argv, cwd, prompt_file):
        output = _cli_process(argv, cwd, cancel, prompt_file=prompt_file, timeout=timeout)
    cancel.check()
    result = _cli_reply(conn["provider"], *output)
    calls = [_call_result(None, call["name"], call["args"]) for call in result["calls"]]
    if result["say"]:
        yield _text_event(result["say"])
    yield from _end_events(calls, chat["tools"], {})


def _model_events(chat, cancel, timeout, force_tool):
    """每次請求使用固定連線。途中切換設定會留到下一輪才生效。"""
    data, key = _snapshot()
    conn = data["connection"]
    if not conn:
        raise AssistantError("unavailable", "請先在助理設定選擇一個模型連線。", status=503)
    if conn["kind"] == "cli":
        yield from _cli_events(conn, chat, cancel, timeout)
    else:
        if not conn["model"]:
            raise AssistantError("model", "請先在助理設定選擇或填寫模型名稱。")
        yield from _api_events(conn, key, chat, cancel, force_tool)


def chat_events(payload, *, disconnected=None, timeout=None, force_tool=None):
    """先完成驗證，再交出串流；路由可以在送出 200 之前回格式或大小錯誤。"""
    return _stream_chat(validate_chat(payload), disconnected, timeout, force_tool)


def _stream_chat(chat, disconnected, timeout, force_tool):
    """主執行緒能在模型完全沒回資料時察覺客戶端關閉，並直接中斷活躍資源。"""
    timeout = CHAT_TIMEOUT if timeout is None else timeout
    cancel = _CancelScope()
    outgoing = queue.SimpleQueue()

    def produce():
        try:
            for event in _model_events(chat, cancel, timeout, force_tool):
                cancel.check()
                outgoing.put(event)
        except AssistantError as exc:
            outgoing.put(("error", {"code": exc.code, "error": str(exc)}))
        except (TimeoutError, subprocess.TimeoutExpired):
            outgoing.put(("error", {"code": "timeout", "error": ERRORS["timeout"]}))
        except (OSError, file_lock.StoreCorrupt):
            outgoing.put(("error", {"code": "unavailable", "error": ERRORS["unavailable"]}))
        except (ValueError, TypeError, KeyError, IndexError, AttributeError, RecursionError):
            outgoing.put(("error", {"code": "format", "error": ERRORS["format"]}))
        finally:
            outgoing.put(None)

    yield "status", {"stage": "connecting"}
    if disconnected and disconnected():
        return
    worker = threading.Thread(target=produce, daemon=True)
    deadline = time.monotonic() + timeout
    worker.start()
    try:
        yield "status", {"stage": "thinking"}
        while True:
            if disconnected and disconnected():
                return
            left = deadline - time.monotonic()
            if left <= 0:
                cancel.stop()
                yield "error", {"code": "timeout", "error": ERRORS["timeout"]}
                return
            try:
                event = outgoing.get(timeout=min(left, 0.2))
            except queue.Empty:
                continue
            if event is None:
                return
            yield event
            if event[0] in ("done", "error"):
                return
    finally:
        cancel.stop()


def test_connection(disconnected=None):
    """只送固定的最小測試，不附工作台內容，也不執行模型提出的操作。"""
    name = "check_connection"
    chat = {
        "system": "請只呼叫 check_connection 工具一次，參數填空物件。",
        "tools": [{"name": name, "description": "確認能送出工具呼叫。",
                   "input_schema": {"type": "object", "additionalProperties": False}}],
        "messages": [{"role": "user", "content": "測試連線。"}],
    }
    started = time.monotonic()
    passed = False
    failure = AssistantError("format", "模型沒有回傳預期的測試工具呼叫，請換一個模型再試。")
    # 關掉設定視窗、離開頁面：跟聊天一樣立刻收掉，不要跑滿 25 秒。
    for event, data in chat_events(chat, timeout=TEST_TIMEOUT, force_tool=name, disconnected=disconnected):
        if event == "error":
            failure = AssistantError(data["code"], data["error"])
        elif event == "tool_calls":
            calls = data["calls"]
            passed = len(calls) == 1 and calls[0]["name"] == name and calls[0]["args"] == {}
        elif event == "done" and passed and data["reason"] == "tool_calls":
            return {"ok": True, "stage": "ok", "ms": round((time.monotonic() - started) * 1000)}
    stage = {"rate": "timeout", "aborted": "timeout", "unavailable": "model"}.get(failure.code, failure.code)
    return {**failure.payload(), "stage": stage, "ms": round((time.monotonic() - started) * 1000)}
