"""Portable release checks. Python standard library and Node 20+; no downloads or real ComfyUI."""
from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
standalone = (ROOT / "tests/test_i18n.mjs").exists()
checks = [
    ("test_engine_release.mjs", "test_mochi_engine.mjs"), ("test_i18n.mjs", "test_web6_i18n.mjs"),
    ("test_fetch_lora_manager.py", "test_fetch_lora_manager.py"), ("test_setup_tasks.py", "test_setup_tasks.py"),
    ("test_fetch_card_art.py", "test_fetch_card_art.py"), ("test_fetch_upscale.py", "test_fetch_upscale.py"),
    ("test_fetch_pose.py", "test_fetch_pose.py"), ("test_server.py", "test_server.py"),
    ("test_launchers.py", "test_mochi_launchers.py"), ("test_smoke.py", "test_mochi_smoke.py"),
]
if "--full" in sys.argv:
    checks.append(("test_engine.mjs", "test_engine.mjs"))
if "--browser" in sys.argv:
    checks.append(("test_i18n_browser.mjs", "test_web6_i18n_browser.mjs"))
    checks.append(("test_setup_browser.mjs", "test_mochi_setup_browser.mjs"))
node = shutil.which("node")
if not node:
    sys.exit("Node.js 20+ is required to run the development tests")
stage = Path(tempfile.mkdtemp(prefix="mochi-checks-"))
env = {**os.environ, "PYTHONUTF8": "1", "APP_CONFIG": str(stage / "config.json"), "APP_SETTINGS": str(stage / "settings.json")}
failed = []
for target, source in checks:
    file = ROOT / ("tests" if standalone else "scripts") / (target if standalone else source)
    command = [node if file.suffix == ".mjs" else sys.executable, str(file)]
    try:
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1800 if target == "test_engine.mjs" else 600)
        print(("PASS " if result.returncode == 0 else "FAIL ") + target, flush=True)
        if result.returncode:
            failed.append(target)
            print(result.stdout + result.stderr)
    except subprocess.TimeoutExpired:
        failed.append(target)
        print("FAIL " + target + " (timed out)", flush=True)
print(f"{len(checks)-len(failed)}/{len(checks)} checks passed", flush=True)
sys.exit(1 if failed else 0)
