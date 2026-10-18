"""跨程序的檔案鎖：data/ 底下「讀 → 改 → 整份寫回」的存檔（使用次數、牌組、設定）用。

同時開著兩個版面的伺服器（例如 web6、web7，不同埠、同一個 data/）時，各自的 threading.Lock
只擋得住自己程序裡的執行緒：兩邊都讀到舊的那份、各改各的、先後寫回，後寫的把先寫的整份蓋掉
（Codex 2026-10-13 用兩個程序重現：次數只剩一邊的、牌組少一組）。這裡在旁邊放一個 <檔名>.lock，
整段讀改寫拿著它；暫存檔名也帶程序和執行緒編號，兩邊不會寫到同一個 .tmp。

只用標準函式庫：Windows 用 msvcrt.locking，其他用 fcntl.flock。
"""
from __future__ import annotations

import contextlib
import json
import os
import shutil
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


class StoreCorrupt(Exception):
    """存檔讀不懂、也沒有能用的備份。不能當成空的：下一次寫入會用空的那份把整份蓋掉（使用次數、牌組歸零）。"""


def backup_path(path: Path) -> Path:
    return path.with_name(path.name + ".bak")


def write_text(path: Path, text: str) -> None:
    """整份換掉：先寫到這個程序、這個執行緒自己的暫存檔，寫進磁碟（fsync）再一次換上去。

    寫完再同樣寫一份 .bak（也是先寫暫存檔再換上去）：正本被弄壞時（磁碟、手改、別的程式），
    read_json 用 .bak 換回來，拿到的是最新那份。沒有 fsync 的話，停電或藍屏可能留下 0 位元組的檔。
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    for dest in (path, backup_path(path)):
        tmp = dest.with_name(f"{dest.name}.{os.getpid()}-{threading.get_ident()}.tmp")
        try:
            with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(text)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, dest)
        except OSError:
            if dest is path:
                raise
            # 備份寫不了不影響正本：下一次再寫。
        finally:
            with contextlib.suppress(OSError):
                tmp.unlink()


def read_json(path: Path, *, label: str = ""):
    """讀 JSON 存檔。沒有檔：回 None。讀不懂：試 .bak，讀得懂就換回去用；也不行就把壞檔改名留著、丟 StoreCorrupt。

    壞檔改名成 <檔名>.corrupt-<時間>，不刪：裡面可能還救得回東西。
    """
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError):
        pass
    stamp = time.strftime("%Y%m%d-%H%M%S")
    aside = path.with_name(f"{path.name}.corrupt-{stamp}")
    with contextlib.suppress(OSError):
        shutil.copyfile(path, aside)
    bak = backup_path(path)
    try:
        data = json.loads(bak.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError):
        with contextlib.suppress(OSError):
            path.unlink()
        name = label or path.name
        raise StoreCorrupt(
            f"伺服器上的{name}存檔（{path.name}）壞了，也沒有能用的備份。"
            f"壞掉的那份改名成 {aside.name} 留著；之後存的會從空的開始。"
        ) from None
    shutil.copyfile(bak, path)
    print(f"[存檔] {path.name} 壞了，已用 {bak.name} 換回（壞的留在 {aside.name}）", flush=True)
    return data
