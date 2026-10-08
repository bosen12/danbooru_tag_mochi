# Contributing to Mochi

Issues and pull requests are welcome. For bugs, use the bug report form and include the steps to reproduce, OS, Python/ComfyUI versions, GPU/VRAM and the relevant error text. Remove webhook URLs, tokens, personal paths and private prompts from logs.

## Contribution license

New contributions to Mochi are accepted under GNU GPLv3 only (`GPL-3.0-only`), the code license in [LICENSE](LICENSE). Submit only work you may license on these terms and preserve existing copyright and third-party notices. See [NOTICE](NOTICE) for the earlier MIT publication and separately licensed assets.

## Development checks

Python 3.9+ and Node.js 20+ are needed for tests. The application server itself only uses Python's standard library.

```sh
python tests/run.py
```

This runs engine, language, setup, asset, server, Windows launcher (Windows only) and clean-copy HTTP checks. It does not download models, install custom nodes or generate against a real ComfyUI.

The broader historical engine regression suite is optional because it runs thousands of compositions and can take many minutes:

```sh
python tests/run.py --full
```

GitHub Actions runs the focused checks on each push/PR; manually dispatching the workflow also runs this full engine suite.

Optional browser checks use the real pages with fake API data:

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
python tests/run.py --browser
```

`PLAYWRIGHT_MODULE` may point to an already installed Playwright module. Screenshots/results go to an OS temporary directory; `BROWSER_RESULTS_DIR` sets a specific output directory for the workbench test.

## Shared source and translations

Most runtime code and tests are synchronized from [danbooru_tag_random](https://github.com/bosen12/danbooru_tag_random). Contributors may change this standalone repository normally. The maintainer carries merged changes back to upstream before synchronizing again, so contributions are preserved. Add English UI translations to `web/locales/en.js`; keep user-entered names and machine prompts unchanged. Bat files use CRLF.

Maintainers work on shared code in upstream, run its tests, run `python scripts/sync_mochi.py`, then run these standalone checks. README, launchers, `.github`, CONTRIBUTING, release notes and community copy belong to Mochi. Font rebuilding is performed in upstream; see `web/fonts/README.md`.

## 繁體中文

新提交的 Mochi 程式貢獻採 GNU GPLv3（僅第 3 版，`GPL-3.0-only`）；請確認有權以此授權提交，並保留既有作者與第三方授權聲明。先前 MIT 版本與獨立素材授權見 [NOTICE](NOTICE)。

歡迎開 issue 或送 PR。錯誤回報請附重現步驟、作業系統、Python／ComfyUI 版本、GPU／VRAM 與相關錯誤訊息，先移除憑證及私人資料。

開發測試需要 Python 3.9+、Node.js 20+；跑 `python tests/run.py`；完整歷史引擎回歸用 `python tests/run.py --full`，需要較長時間。安裝上方 Playwright 開發依賴後，可用 `python tests/run.py --browser` 驗證真實頁面與中英文安裝選擇。測試使用假 API，不會安裝套件或送到你的 ComfyUI 生圖。

可以直接在本 repo 提 PR；維護者會先把合併內容搬回 Random，再同步，避免貢獻被覆蓋。新增介面文字時補英文翻譯；bat 保留 CRLF。
