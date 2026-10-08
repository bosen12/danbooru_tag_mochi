# danbooru_tag_mochi（墨池 Mochi）

這個 repo 是從 **`../danbooru_tag_random`** 的 `web6/` 同步出來的開源版。

## 改程式要改上游，不要在這邊改

`web/`、`server.py` 與其他 Python 模組、`scripts/`、`tests/test_i18n.mjs` 都由上游的
`scripts/sync_mochi.py` 產生，在這邊直接改，下次同步就會被蓋掉。

1. 到 `../danbooru_tag_random` 改（前端是 `web6/`，共用檔是 `web/`）。
2. 那邊跑 `python scripts/sync_mochi.py`。
3. 回這邊 `node tests/test_i18n.mjs`、看 `git diff`，commit、push。

對應：上游 `web6/X` 與 web6 會載入的 `web/X` → 這邊的 `web/X`（伺服器本來就先找 web6 再找 web，合成一個資料夾後路徑不變）。
這邊不一樣的字樣（`start.bat`、預設埠 8796、卡面 Release 網址、影片裡的 clone 網址）寫在上游腳本的 `REWRITES`。

## 只屬於這個 repo 的檔（在這邊改）

`README.md`（**英文在上、中文在下**）、`CLAUDE.md`、`start.bat`、`start.sh`、`.gitignore`、`.gitattributes`、`LICENSE`、`.github/workflows/test.yml`。

- CI（GitHub Actions）在 Linux／Windows、Python 3.9 與最新版跑：編譯、`tests/test_i18n.mjs`、不連 ComfyUI 啟動伺服器打遍頁面和 API。新增頁面或唯讀 API 時加進 smoke test 的清單。

- `.bat` 一律 CRLF（`.gitattributes` 管）：LF 的批次檔 `goto` 會失效。
- 卡面插畫從**這個 repo 的 Release** `card-art-v4` 下載。上游發新卡面包時，這邊也要發同一個 zip（`gh release create card-art-vN ... -R bosen12/danbooru_tag_mochi`）。
- 給陌生人用：改了啟動流程、第一次啟動會下載或安裝的東西，README 的〈Prepared on first start〉兩種語言都要跟著改。
