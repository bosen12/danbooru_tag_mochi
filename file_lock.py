"""跨程序的檔案鎖：data/ 底下「讀 → 改 → 整份寫回」的存檔（使用次數、牌組、設定）用。

同時開著兩個版面的伺服器（例如 web6、web7，不同埠、同一個 data/）時，各自的 threading.Lock
只擋得住自己程序裡的執行緒：兩邊都讀到舊的那份、各改各的、先後寫回，後寫的把先寫的整份蓋掉
（Codex 2026-10-13 用兩個程序重現：次數只剩一邊的、牌組少一組）。這裡在旁邊放一個 <檔名>.lock，
整段讀改寫拿著它；暫存檔名也帶程序和執行緒編號，兩邊不會寫到同一個 .tmp。

只用標準函式庫：Windows 用 msvcrt.locking，其他用 fcntl.flock。
"""
from __future__ import annotations

import contextlib
import os
import threading
import time
from pathlib import Path

if os.name == "nt":
    import msvcrt
else:
    import fcntl


@contextlib.contextmanager
def locked(path: Path, timeout: float = 15.0):
    """拿著 path 旁邊的 .lock 做事；別的程序拿著就等（最多 timeout 秒，等不到丟 TimeoutError）。"""
    lock_path = Path(str(path) + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_path, "a+b") as fh:
        deadline = time.monotonic() + timeout
        while True:
            try:
                if os.name == "nt":
                    fh.seek(0)
                    msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError:
                if time.monotonic() > deadline:
                    raise TimeoutError(f"等不到 {lock_path.name}（另一個伺服器一直拿著）") from None
                time.sleep(0.01)
        try:
            yield
        finally:
            if os.name == "nt":
                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


def write_text(path: Path, text: str) -> None:
    """整份換掉：先寫到這個程序、這個執行緒自己的暫存檔，再一次換上去。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}-{threading.get_ident()}.tmp")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
    finally:
        with contextlib.suppress(OSError):
            tmp.unlink()
