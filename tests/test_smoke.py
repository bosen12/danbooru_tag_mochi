"""Run all Mochi pages and read-only APIs from a clean copy, without ComfyUI or downloads."""
from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
stage = Path(tempfile.mkdtemp(prefix="mochi-smoke-"))
for base, target in [(ROOT, stage), (ROOT / "scripts", stage / "scripts")]:
    for source in base.glob("*.py"):
        dest = target / source.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
for base in [ROOT / "web", ROOT / "web6"]:
    if not base.exists():
        continue
    for source in base.rglob("*"):
        rel = source.relative_to(base)
        if not source.is_file() or rel.parts[0] == "cards":
            continue
        dest = stage / "web" / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
class OfflineComfy(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(503)
        self.end_headers()
    def log_message(self, *_):
        pass

backend = ThreadingHTTPServer(("127.0.0.1", 0), OfflineComfy)
threading.Thread(target=backend.serve_forever, daemon=True).start()
env = {**os.environ, "PORT": str(port), "HOST": "127.0.0.1", "WEB_DIR": "web", "COMFY_API": f"http://127.0.0.1:{backend.server_port}", "PYTHONUTF8": "1"}
env["APP_CONFIG"] = str(stage / "config.json")
env["APP_SETTINGS"] = str(stage / "data/settings.json")
for key in ["NO_SETUP", "NO_CARD_FETCH", "NO_CARD_BAKE", "NO_LORA_MANAGER_FETCH", "NO_UPSCALE_FETCH", "NO_POSE_FETCH", "NO_HIRES_PRUNE"]:
    env[key] = "1"
paths = ["/", "/fuse.html", "/book.html", "/album.html", "/intro.html", "/tutorial.html", "/lexicon.json", "/engine.js",
         "/api/ping", "/api/setup", "/api/decks", "/api/usage", "/api/recipes", "/api/genlog", "/api/genlog/stats", "/api/workflows", "/api/checkpoints", "/api/loras"]
with (stage / "server.log").open("wb") as log:
    proc = subprocess.Popen([sys.executable, "-u", "server.py"], cwd=stage, env=env, stdout=log, stderr=subprocess.STDOUT,
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        for _ in range(120):
            if proc.poll() is not None:
                raise RuntimeError((stage / "server.log").read_text(encoding="utf-8", errors="replace"))
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1).close()
                break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError("Server startup timed out")
        for path in paths:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}" + path, timeout=10) as response:
                assert response.status == 200, path
                response.read()
        print(f"Clean-copy server smoke: {len(paths)}/{len(paths)} passed")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        backend.shutdown()
        backend.server_close()
# Only this test-created directory inside the OS temp directory can be removed.
assert stage.resolve().parent == Path(tempfile.gettempdir()).resolve() and stage.name.startswith("mochi-smoke-")
shutil.rmtree(stage)
