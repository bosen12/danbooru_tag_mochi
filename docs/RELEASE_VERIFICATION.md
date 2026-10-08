# Release verification — 2026-10-08

This record captures local readiness verification performed after the public v1.0 release and before pushing these changes. Remote CI evidence is recorded separately below. The existing v1.0 tag predates these fixes. Community drafts have not been posted.

## Local automated checks

Environment: Windows, Python 3.12.14, Node.js 24.18.0, Playwright 1.62.1 with Chromium.

| Check | Result |
| --- | --- |
| Standalone `python tests/run.py` | 10/10 suites passed |
| Focused composition engine | General/Sensitive/Explicit draws, pin conflicts, bans, content constraints and deterministic seeds passed |
| Setup and LoRA patch | Consent, read-only detection, repeated-answer guard, Never ask persistence, nonblocking restart and failed-patch state passed |
| Python compatibility | Python 3.9 pathlib signature exercised by regression fixture; Windows launcher rejects simulated 3.8 and accepts simulated 3.9 |
| Windows launcher | Actual cmd launcher preserves custom PORT/HOST and applies defaults |
| Clean-copy HTTP smoke | 18 pages/APIs returned 200; setup/downloads disabled and a local fake unavailable ComfyUI used |
| Bilingual workbench browser | 137 scenarios passed; no untranslated UI or geometry issues in the tested fixtures |
| Bilingual setup browser | Install/patch questions in English/Traditional Chinese, three choices, no pre-consent request and choice submission passed |
| Full historical engine | `node tests/test_engine.mjs` exited 0; 3,002 passing assertions, zero failures (about 18 minutes locally) |
| Shared source/export | Random core checks also passed 10/10; `sync_mochi.py --check` reports zero updates |
| Static release files | 24 Python files parse with Python 3.9 grammar; both touched batch launchers use CRLF; relative release-document links exist; `git diff --check` passed |

The Python 3.9 check above is a compatibility regression on this Windows Python 3.12 installation, not a claim that a real Python 3.9 runtime was run locally. The new CI matrix provides that runtime check after pushing.

## Real public card-art download

Downloaded [card-art-general.zip from card-art-v4](https://github.com/bosen12/danbooru_tag_mochi/releases/download/card-art-v4/card-art-general.zip) into a separate temporary directory and unpacked it using the application's downloader.

- Archive: 100,099,803 bytes.
- SHA-256: `5150ab40c284457ca4cda7db46e32c54b162314c14c118dd06da2b56dc09d49d` (matched GitHub's release asset digest).
- Manifest: 1,934 cards; 3,868 full/thumbnail image files. The downloader's completeness check passed.
- Observed download/unpack time: 9.97 seconds on this connection; not a download-speed guarantee.

## Real ComfyUI generation and gallery save

Used a clean temporary Mochi copy with background setup disabled, checked that the real ComfyUI queue was idle, generated one image, retrieved it, and saved the image and its recipe/cards through the gallery API. The temporary app data was separate from the existing gallery.

| Setting | Observed value |
| --- | --- |
| OS / app Python | Windows / 3.12.14 |
| ComfyUI / its Python | 0.37.1 / 3.13.12 |
| PyTorch | 2.11.0+cu130 |
| GPU | NVIDIA GeForce RTX 5070 Ti, reported 15.9 GiB VRAM |
| Checkpoint | waiIllustriousSDXL_v170.safetensors |
| Image / sampling | 512 × 768, 8 steps, CFG 5.5, seed 20261008 |
| Content level | General |
| Result | PNG retrieved (563,859 bytes); gallery save and stored-file retrieval succeeded |
| Observed generation round trip | 3.09 seconds |

This is one generation on an existing ComfyUI installation. It does not test every checkpoint, every GPU or a new ComfyUI installation. No custom nodes were installed, no pip packages were installed, and ComfyUI was not restarted for this verification.

## GitHub status and pending external checks

The repository is public and [v1.0](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/v1.0) was published at 2026-10-08 13:03:10 UTC. [The existing CI run](https://github.com/bosen12/danbooru_tag_mochi/actions/runs/37785155517) succeeded for commit `36f1689311804cff349f3970ec26e38e769831e3`; it validates the earlier workflow, not the newly prepared configuration.

New CI is configured for Linux Python 3.9/3.13, Windows/macOS Python 3.13, and Linux bilingual Chromium checks. Manual dispatch also runs the longer historical engine suite. Those remote results are pending until these changes are pushed.

Optional first-time LoRA Manager/pip installation and pose-model downloads still need an independent fresh-user installation trial. Their control flow is covered by fixtures. No universal minimum VRAM claim is made. A scan of 209 historical text blobs found no matches for the checked credential patterns; this is a limited scan, not an exhaustive security audit.

## 維護者核對

本次已驗證本機核心測試、中英文瀏覽器、公開卡圖下載，以及 RTX 5070 Ti 的實機生圖／作品儲存。跨平台新 CI 要推送後才有結果；首次 LoRA 套件安裝和姿勢模型下載尚未以全新 ComfyUI 實測。v1.0 已公開，這批修正屬該標籤之後的 main 更新，社群文案尚未發布。社群文案在 [COMMUNITY_POSTS.md](../COMMUNITY_POSTS.md)。
