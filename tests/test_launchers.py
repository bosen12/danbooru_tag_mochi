"""Exercise Windows launchers with isolated server/version fixtures; no browser opens."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
launcher = ROOT / ("start-web6.bat" if (ROOT / "start-web6.bat").exists() else "start.bat")
if os.name != "nt":
    print("Windows launcher checks skipped on this platform")
    sys.exit(0)

stage = Path(tempfile.mkdtemp(prefix="mochi-launcher-test-"))
text = launcher.read_text(encoding="utf-8")
# These two start commands open external windows, unrelated to Python/settings selection.
text = "\n".join("rem browser suppressed by fixture" if line.startswith('start ""') or line.strip().startswith('start ""') else line for line in text.splitlines())
(stage / "start.bat").write_bytes(text.replace("\n", "\r\n").encode())
(stage / "server.py").write_text("import json,os; print('SERVER ' + json.dumps({k:os.environ.get(k) for k in ['PORT','HOST']}))", encoding="utf-8")
(stage / "sitecustomize.py").write_text(
    "import os,sys\nfrom collections import namedtuple\n"
    "v=os.environ.get('TEST_PY_VERSION','3.13').split('.')\n"
    "sys.version_info=namedtuple('V','major minor micro releaselevel serial')(int(v[0]),int(v[1]),0,'final',0)\n", encoding="utf-8")

def launch(version="3.13", **settings):
    env={k:v for k,v in os.environ.items() if k.upper() not in {"PORT","HOST","PYTHONPATH","PROGRAMFILES","PROGRAMFILES(X86)","PROGRAMW6432"}}
    env.update(PATH=str(Path(sys.executable).parent)+os.pathsep+str(Path(os.environ['SystemRoot'])/'System32'),
               PYTHONPATH=str(stage), TEST_PY_VERSION=version, PROGRAMFILES=str(stage), PROGRAMW6432=str(stage), **settings)
    cmd=str(Path(os.environ['SystemRoot'])/'System32'/'cmd.exe')
    # 64-bit cmd can restore ProgramFiles from ProgramW6432. Both must point
    # at the fixture so this test never invokes the real Tailscale executable.
    # cmd writes in the console code page (cp950 on Traditional Chinese Windows); only the ASCII SERVER line is parsed.
    probe=subprocess.run([cmd,'/d','/c','echo %ProgramFiles%'],env=env,text=True,errors='replace',capture_output=True,timeout=5)
    assert probe.returncode == 0 and probe.stdout.strip() == str(stage), "ProgramFiles fixture was overridden"
    result=subprocess.run([cmd,'/d','/c',str(stage/'start.bat')],
                          cwd=stage,env=env,input='\n',text=True,errors='replace',capture_output=True,timeout=15)
    values=[line.removeprefix('SERVER ') for line in result.stdout.splitlines() if line.startswith('SERVER ')]
    return result, json.loads(values[-1]) if values else None

failed=0
for name, version, settings, expected in [
    ('explicit PORT/HOST survive launch','3.13',{'PORT':'18812','HOST':'127.0.0.1'},{'PORT':'18812','HOST':'127.0.0.1'}),
    ('defaults remain available','3.13',{}, {'PORT':'8796','HOST':'0.0.0.0'}),
    ('Python 3.8 is rejected before server launch','3.8',{},None),
    ('Python 3.9 is accepted','3.9',{}, {'PORT':'8796','HOST':'0.0.0.0'}),
]:
    result, values=launch(version,**settings)
    passed=values==expected and ((result.returncode==0) if expected is not None else result.returncode!=0)
    print(('ok   ' if passed else 'FAIL ')+name)
    if not passed:
        failed+=1; print(result.stdout,result.stderr)
sys.exit(1 if failed else 0)
