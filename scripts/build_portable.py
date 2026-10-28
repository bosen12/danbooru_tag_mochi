"""打 Windows 免安裝包：墨池的程式（git 裡的檔）＋官方的免安裝 Python（embeddable）＋ Pillow，壓成一個 zip。

使用者解壓、雙擊 start.bat 就能跑，不用先裝 Python（start.bat 看到旁邊有 python\\python.exe 就用它）。
ComfyUI、模型照舊自己裝；卡面、放大模型這些第一次啟動時伺服器在背景補（setup_tasks.py）。

    python scripts/build_portable.py                     # 在 danbooru_tag_mochi 裡跑：打包這個 repo
    python scripts/build_portable.py --repo ../danbooru_tag_mochi --version v1.3

做的事：
  1. git archive 取出 repo 裡已提交的檔（data/、config.json、.secrets 這些不會進去）。
  2. 下載 python-<版本>-embed-amd64.zip（python.org），解到 python/；改 ._pth：加 Lib\\site-packages、
     上一層（墨池的根目錄），打開 import site。
  3. 下載對應版本的 Pillow wheel（只要 Windows 64 位元的二進位），解進 python/Lib/site-packages。
     免安裝的 Python 沒有 pip：第一次準備裝 Pillow 那一步會看到已經裝好，直接略過。
  4. 用包裡的 Python 開一次伺服器（隔離的資料夾、不找 ComfyUI），/api/ping 回得來才算數。
  5. 壓成 <out>/Mochi-<版本>-windows-portable.zip，印出大小和 SHA-256。

下載的東西放在 ~/.cache/mochi-portable，第二次打包不用重抓。
"""
from __future__ import annotations

import argparse
import hashlib
import io
import os
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY_VERSION = "3.12.10"
CACHE = Path.home() / ".cache" / "mochi-portable"


def log(msg: str) -> None:
    print(msg, flush=True)


def download(url: str, dest: Path) -> Path:
    if dest.is_file() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"download {url}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f)
    os.replace(tmp, dest)
    return dest


def git_files(repo: Path, stage: Path) -> str:
    """repo 已提交的檔解到 stage（跟 GitHub 的 Download ZIP 一樣乾淨）。回傳版本字（最近的 tag 或 commit）。"""
    raw = subprocess.run(["git", "-C", str(repo), "archive", "--format=tar", "HEAD"], check=True, capture_output=True).stdout
    with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
        tar.extractall(stage, filter="data")
    ver = subprocess.run(["git", "-C", str(repo), "describe", "--tags", "--always"], capture_output=True, text=True).stdout.strip()
    return ver or "dev"


def add_python(stage: Path, version: str) -> Path:
    py_dir = stage / "python"
    z = download(f"https://www.python.org/ftp/python/{version}/python-{version}-embed-amd64.zip", CACHE / f"python-{version}-embed-amd64.zip")
    with zipfile.ZipFile(z) as zf:
        zf.extractall(py_dir)
    # ._pth：免安裝 Python 的 sys.path 只看這個檔。加上 site-packages（Pillow）和上一層（墨池的根目錄，
    # server.py import 旁邊的 custom_cards.py 這些），打開 import site。
    pth = next(py_dir.glob("python*._pth"))
    lines = [ln for ln in pth.read_text(encoding="utf-8").splitlines() if ln.strip() and ln.strip() != "#import site"]
    lines += ["Lib\\site-packages", "..", "import site"]
    pth.write_text("\n".join(lines) + "\n", encoding="utf-8")
    (py_dir / "Lib" / "site-packages").mkdir(parents=True, exist_ok=True)
    return py_dir


def add_pillow(py_dir: Path, version: str) -> None:
    short = "".join(version.split(".")[:2])  # 3.12.10 → 312
    wheels = CACHE / f"wheels-cp{short}"
    wheels.mkdir(parents=True, exist_ok=True)
    have = list(wheels.glob("pillow-*.whl"))
    if not have:
        log("download Pillow wheel (win_amd64)")
        subprocess.run([sys.executable, "-m", "pip", "download", "pillow", "--only-binary=:all:", "--no-deps",
                        "--platform", "win_amd64", "--python-version", ".".join(version.split(".")[:2]),
                        "--implementation", "cp", "-d", str(wheels), "-q"], check=True)
        have = list(wheels.glob("pillow-*.whl"))
    # wheel 就是 zip：直接解進 site-packages（Pillow 沒有要裝的指令檔）。
    with zipfile.ZipFile(sorted(have)[-1]) as zf:
        zf.extractall(py_dir / "Lib" / "site-packages")


def smoke(stage: Path) -> None:
    """用包裡的 Python 開伺服器一次：隔離的資料夾、不找 ComfyUI、不開瀏覽器。/api/ping 回得來才算數。"""
    py = stage / "python" / "python.exe"
    out = subprocess.run([str(py), "-c", "import sys, PIL; print(sys.version.split()[0], PIL.__version__)"], capture_output=True, text=True, cwd=stage)
    if out.returncode:
        raise SystemExit("bundled Python failed: " + out.stderr)
    log(f"bundled Python {out.stdout.strip()} (Python, Pillow)")
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    data = Path(tempfile.mkdtemp(prefix="mochi-portable-smoke-"))
    env = {**os.environ, "PORT": str(port), "HOST": "127.0.0.1", "PYTHONUTF8": "1", "NO_SETUP": "1", "NO_CARD_FETCH": "1",
           "NO_CARD_BAKE": "1", "COMFY_API": "http://127.0.0.1:1", "OPEN_BROWSER": "0", "APP_SETTINGS": str(data / "settings.json"),
           "CARD_USAGE_PATH": str(data / "usage.json"), "CARD_DECKS_PATH": str(data / "decks.json"), "GEN_LOG_PATH": str(data / "log.jsonl"),
           "RECIPE_DATA_DIR": str(data / "recipes"), "WORKFLOW_DATA_DIR": str(data / "workflows"), "CUSTOM_CARDS_PATH": str(data / "custom.json"),
           "CUSTOM_CARDS_DIR": str(data / "custom"), "CARD_FAV_CHARS_PATH": str(data / "fav.json")}
    env.pop("PYTHONPATH", None)
    proc = subprocess.Popen([str(py), "server.py"], cwd=stage, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        for _ in range(80):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/index.html", timeout=2) as r:
                    if r.status == 200:
                        log(f"server answered on {port} (bundled Python)")
                        return
            except OSError:
                time.sleep(0.25)
        proc.terminate()
        raise SystemExit("server did not start with the bundled Python:\n" + proc.communicate(timeout=10)[0].decode("utf-8", "replace")[-2000:])
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
        shutil.rmtree(data, ignore_errors=True)


def pack(stage: Path, files: list[Path], zip_path: Path) -> None:
    """只收 files（試跑之前的清單）：伺服器試跑時建的 .secrets/*.lock、data/、__pycache__ 都不進包。"""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = zip_path.with_suffix(".zip.part")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in files:
            zf.write(f, Path(stage.name) / f.relative_to(stage))
    os.replace(tmp, zip_path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=str(ROOT), help="要打包的 repo（預設：這支腳本所在的 repo）")
    ap.add_argument("--python", default=PY_VERSION, help=f"免安裝 Python 的版本（預設 {PY_VERSION}）")
    ap.add_argument("--version", default="", help="檔名上的版本（預設：git describe）")
    ap.add_argument("--out", default="", help="zip 放哪（預設：repo 旁邊的 mochi-portable/）")
    ap.add_argument("--no-smoke", action="store_true", help="不開伺服器試跑（不在 Windows 上打包時用）")
    args = ap.parse_args()
    repo = Path(args.repo).resolve()
    if not (repo / "server.py").is_file():
        raise SystemExit(f"{repo} 不是墨池的 repo（沒有 server.py）")
    with tempfile.TemporaryDirectory(prefix="mochi-portable-") as tmp:
        stage = Path(tmp) / "Mochi"
        stage.mkdir()
        ver = args.version or git_files(repo, stage)
        if args.version:
            git_files(repo, stage)
        py_dir = add_python(stage, args.python)
        add_pillow(py_dir, args.python)
        files = sorted(f for f in stage.rglob("*") if f.is_file() and "__pycache__" not in f.parts)
        if not args.no_smoke and os.name == "nt":
            smoke(stage)
        out = Path(args.out).resolve() if args.out else repo.parent / "mochi-portable"
        zip_path = out / f"Mochi-{ver}-windows-portable.zip"
        pack(stage, files, zip_path)
    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    log(f"done  {zip_path}  {zip_path.stat().st_size / 1e6:.1f} MB  sha256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
