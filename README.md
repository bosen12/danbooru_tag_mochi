# Mochi · a card workbench for Danbooru-tag image generation

[![test](https://github.com/bosen12/danbooru_tag_mochi/actions/workflows/test.yml/badge.svg)](https://github.com/bosen12/danbooru_tag_mochi/actions/workflows/test.yml)

English · [繁體中文](#繁體中文)

Danbooru tags as illustrated cards. Pin a few cards, let the engine draw the rest by its rules, and send the composition to your local ComfyUI (WAI / Illustrious SDXL).

The interface is in English or Traditional Chinese. It follows your browser language, and the globe menu in the top bar switches it. ComfyUI always receives the canonical English tags.

> **Adult content.** This tool can generate adult images. The rating switch starts at *General*. The lexicon and negative prompt block `loli`, `shota`, `teen`, `child` and similar tags; those cards are never drawn or illustrated.
> The server runs on your own machine and only accepts loopback and Tailscale connections by default.

Mochi is the card interface of [danbooru_tag_random](https://github.com/bosen12/danbooru_tag_random), released on its own.

## Four rooms

| Room | What it does |
|---|---|
| **Ink Pool** `/` | Browse the card library by suit (Cast, Appearance, Clothing, Pose, Scene, Style), or search in English or Chinese. Pinned cards appear in every image; the engine fills the remaining slots. Rules set content level, era, characters, pose reference and size. Batch, continuous and draw-only modes. |
| **Fuse Bed** `/fuse.html` | One card per ink layer. Pinned cards stack into six suit rows; grey shadows are the engine's additions. Four same-seed proofs redraw instantly, so you see what each card changes before you generate. |
| **Card Book** `/book.html` | How often each card was used, its save and discard rates, and the images it appeared in. Achievements. |
| **Gallery** `/album.html` | Saved images, the full generation history, and a report card for every checkpoint and LoRA. Send a work's cards back to the Ink Pool. |

The **Intro film** (`/intro.html`, 3 min) and the **Tutorial** (`/tutorial.html`, 4.5 min) are rendered live in the page with the real engine and cards. **Tour** in the top bar walks you through each room step by step.

## Requirements

| | Version | Why |
|---|---|---|
| **Python** | 3.9 or newer | Runs `server.py`. Standard library only; nothing to `pip install` |
| **ComfyUI** | default `http://127.0.0.1:8188` | Generates the images |
| **SDXL checkpoint** | WAI / Illustrious recommended | The lexicon is tuned for Danbooru tags |
| Browser | Chrome, Edge, Firefox or Safari from the last three years | Uses `:has()`, `popover`, `oklch()` and container queries |

## Getting started

```bash
git clone https://github.com/bosen12/danbooru_tag_mochi.git
cd danbooru_tag_mochi
```

1. **Start ComfyUI** and check that <http://127.0.0.1:8188> opens.
2. **Start Mochi.**
   - Windows: double-click `start.bat`. It finds Python (or opens the download page if you have none) and opens your browser.
   - macOS / Linux: `./start.sh`, or `python3 server.py` and open <http://127.0.0.1:8796>.
3. **Choose a checkpoint** with the model button in the top bar. It lists what ComfyUI has. Until you choose, Mochi picks an Illustrious / SDXL model from that list.

Keep the server window open. After updating, reload the page with **Ctrl+F5**.

### Prepared on first start

| What | Size | How | Skip |
|---|---|---|---|
| Card art, all ages (1934 files) | ~100 MB | Downloaded from this repo's [release](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/card-art-v4), checked with SHA-256, unpacked into `web/cards/`. Resumes if interrupted; never overwrites cards you baked yourself | `NO_CARD_FETCH=1` |
| Sensitive / explicit card art | — | Not published. Once the download is in, the page asks whether to bake them with your checkpoint (`scripts/bake_card_art.py`). Missing or outdated all-ages cards are baked without asking | `NO_CARD_BAKE=1` or a `.no-card-bake` file |
| Hires upscale model `RealESRGAN_x4plus_anime_6B` | ~18 MB | Saved to ComfyUI's `models/upscale_models` | `NO_UPSCALE_FETCH=1` |
| [ComfyUI LoRA Manager](https://github.com/willmiao/ComfyUI-Lora-Manager) (custom node) | small | The LoRA panel takes its list, preview images and Civitai trigger words from it, and the checkpoint panel its names and previews. Installed automatically if ComfyUI lacks it (git clone into `custom_nodes`, packages with ComfyUI's own Python); restart ComfyUI once afterwards | `NO_LORA_MANAGER_FETCH=1` |
| Pose reference (OpenPose ControlNet + `comfyui_controlnet_aux`) | ~2.5 GB | Optional. The page asks first (install / not now / never); ComfyUI needs one restart afterwards | `NO_POSE_FETCH=1` or answer *A* |

**One launch does all of it**, on Windows, macOS and Linux alike. The server does the work in the background and a panel in the lower-left corner of the page shows each step, asks the two questions, and offers **Restart ComfyUI** after something is installed into it (through ComfyUI-Manager; otherwise restart it yourself). If ComfyUI is not running yet, the steps that need it wait and continue as soon as you start it; there is no need to run `start.bat` again. The page opens straight away with placeholder cards; the panel tells you when to reload. Everything is logged in `data/setup.log`. People who already have everything never see the panel.

## Configuration

Machine-specific settings live in `config.json`, which git ignores. Start from the template:

```bash
cp config.example.json config.json
```

A fresh clone usually needs nothing: checkpoints and LoRAs come from ComfyUI, and with ComfyUI LoRA Manager (installed on first start) they have names, preview images and trigger words. Previews are relayed by this server, so they also show on a phone over Tailscale.

| `config.json` | Meaning |
|---|---|
| `comfy.api` | ComfyUI address (also editable from the Comfy indicator in the top bar) |
| `comfy.ckpt` | Default checkpoint. Must match ComfyUI's list **exactly**, including subfolders |
| `comfy.checkpointDir` | Enables checkpoint preview images. Generation works without it |
| `paths.loraRoot` | Only without ComfyUI LoRA Manager: scan this folder for LoRA previews and trigger words. Empty = ask ComfyUI for the bare list |
| `server.port` / `server.host` / `server.allowNet` | Default `8796`, `127.0.0.1`, loopback and Tailscale only |
| `client.streamIdleMs` | How long ComfyUI may stay silent before an image is abandoned. Raise it for slow GPUs (for example AMD ROCm) |

Environment variables override the file: `COMFY_API`, `COMFY_CKPT`, `PORT`, `HOST`, `ALLOW_NET`, `LORA_ROOT`.

**Your own ComfyUI workflow.** In ComfyUI choose *Export (API)*, drop the JSON on the Workflow panel, and pick the node that receives the positive prompt. The original JSON is never modified.

ComfyUI LoRA Manager is a separate project (GPLv3). It is installed into your own ComfyUI, not shipped with Mochi. So that **Details** in the LoRA panel opens that LoRA directly (`/loras?open=<folder>/<file>`), Mochi adds a few lines to LoRA Manager's `static/js/loras.js` (`scripts/fetch_lora_manager.py --patch`, no ComfyUI restart). An update of LoRA Manager replaces the file; Mochi re-applies it on the next start, and leaves the file alone if it no longer looks as expected. On a phone (Tailscale) these links point at this computer's ComfyUI, so they only open if ComfyUI was started with `--listen`; Mochi checks first and hides them otherwise (Details then opens Civitai; previews still show, because this server relays them).

**Discord.** The Discord button in the top bar takes a channel webhook URL, and generated images are posted there. The URL is stored in `.secrets/`, never committed and never sent back to the browser.

**Phones.** `start.bat` binds `0.0.0.0` but accepts only loopback and Tailscale (`100.64.0.0/10`). On a phone, use the `Tailscale http://100.x.x.x:8796/` address printed in the server window.

## Your data

Everything you create stays in `data/` (git-ignored): card usage, decks, the gallery, the generation history, imported workflows and a webp cache of results. To move to another machine, copy `data/` and `config.json`.

## Layout

```
server.py            API, generation queue, ComfyUI proxy, static files
card_usage.py …      server side of the card book, decks, gallery, history, LoRAs, workflows
web/                 front end (no build step; the browser loads ES modules directly)
  engine.js          draw engine: rules, mutual exclusion, implications, ratings
  lexicon.json       tags, Chinese names, categories, exclusion groups
  index.html …       the four rooms
  i18n.js, locales/  the English edition
  cards/             card art (downloaded or baked; not in git)
scripts/             card art download and baking, upscale model, pose reference
tests/               node tests/test_i18n.mjs
```

## Troubleshooting

- **The `.bat` window closes at once.** Install Python 3 with *Add python.exe to PATH* ticked, or run `py -3 server.py` in this folder to read the error.
- **"Port 8796 is already in use".** Mochi is probably already running: open <http://127.0.0.1:8796/>. To run a second copy, set `PORT` to another port first.
- **The top bar keeps saying Comfy is offline.** ComfyUI is not running, or not at `comfy.api`.
- **"Could not load the card library".** Open Mochi through `start.bat`, `start.sh` or `server.py`, not by opening the HTML file.
- **Generation stops half-way.** Raise `client.streamIdleMs` for slow GPUs.

## Tests

```bash
node tests/test_i18n.mjs
```

Language detection, English translation, user content left untranslated, and selections kept across a language switch. ComfyUI is not needed.

## License

Code: MIT, see [LICENSE](LICENSE). The Chiron Hei HK font is under the SIL Open Font License 1.1 (`web/fonts/OFL.txt`); three.js is MIT (`web/vendor/three/LICENSE`). Tag names come from Danbooru. You are responsible for what you generate.

---

<a id="繁體中文"></a>

# 墨池 Mochi · Danbooru 卡牌生圖工作臺

把 Danbooru 標籤做成一張張有插畫的牌：挑幾張放進合成池，引擎依規則抽牌補齊，整組送進本機的 ComfyUI（WAI / Illustrious SDXL）生圖。

畫面是中文或英文（依瀏覽器語言自動選，頂欄地球選單可切換）；真正送給 ComfyUI 的永遠是英文 tag。

> **成人向。** 這個工具可以產生成人內容，頂欄的分級預設是「全年齡」。詞庫與負向提示詞會擋 `loli`、`shota`、`teen`、`child` 等字，這些牌永遠不會畫也不會抽。
> 伺服器只在你自己的機器上跑，預設只接受本機與 Tailscale 的連線。

墨池是 [danbooru_tag_random](https://github.com/bosen12/danbooru_tag_random)（排字匣）的卡牌介面，獨立出來發布。

## 四個房間

| 房間 | 做什麼 |
|---|---|
| **墨池** `/` | 左邊字盒依花色（人數、長相、服裝、姿勢、場景、風格）翻牌，中英文都能搜。點牌或拖進**合成池**＝每張圖都一定有；剩下的格子由引擎抽牌補齊。底下的規則管尺度、時代、畫面裡有誰、姿勢參考、尺寸。可以一次抽幾張、無限抽、只抽牌不生圖。 |
| **疊印台** `/fuse.html` | 一張牌一層墨：放的牌照花色疊進六列卡池，灰色的影子是引擎補的牌。四張同種子的試印即時重抽，看清楚加了這張之後引擎補了什麼，挑一張再付印。 |
| **卡冊** `/book.html` | 每張牌用過幾次、收藏和撤下的比例、這張牌進過哪些圖。成就牆。 |
| **作品冊** `/album.html` | 收藏的成品、每一張出圖的日誌、每個底模和 LoRA 的成績單；作品上的牌可以帶回墨池再印。 |

另外有兩支在頁面裡即時產生的影片：**介紹影片**（`/intro.html`，3 分鐘）和**使用教學**（`/tutorial.html`，4 分半）。頂欄的「導覽」會一步一步帶你操作。

## 你需要先有什麼

Python 3.9 以上（只用標準函式庫）、ComfyUI（預設 `http://127.0.0.1:8188`）、SDXL checkpoint（建議 WAI / Illustrious）、近三年的 Chrome / Edge / Firefox / Safari。

## 上手

```bash
git clone https://github.com/bosen12/danbooru_tag_mochi.git
cd danbooru_tag_mochi
```

1. **先把 ComfyUI 開起來**，確認 <http://127.0.0.1:8188> 打得開。
2. **開墨池。** Windows 雙擊 `start.bat`（沒裝 Python 會直接打開下載頁）；macOS / Linux 跑 `./start.sh`，或 `python3 server.py` 再開 <http://127.0.0.1:8796>。
3. **選底模。** 頂欄的模型按鈕列出 ComfyUI 有的 checkpoint。還沒選之前，墨池會從清單裡挑一個 Illustrious／SDXL 的。

### 第一次啟動會準備的東西

| 東西 | 大小 | 怎麼來 | 不想要 |
|---|---|---|---|
| 卡牌插畫（全年齡 1934 個檔） | 約 100 MB | 從本 repo 的 [Release](https://github.com/bosen12/danbooru_tag_mochi/releases/tag/card-art-v4) 下載、驗 SHA-256、解到 `web/cards/`。斷了會接著抓；自己烘的圖不覆蓋 | `NO_CARD_FETCH=1` |
| 敏感／色情分級的卡面 | — | 不公開。卡面下載好之後，網頁上問你要不要用你的底模烘；全年齡卡缺的、過時的直接烘，不問 | `NO_CARD_BAKE=1` 或 `.no-card-bake` 檔 |
| Hires 放大模型 | 約 18 MB | 放進 ComfyUI 的 `models/upscale_models` | `NO_UPSCALE_FETCH=1` |
| [ComfyUI LoRA Manager](https://github.com/willmiao/ComfyUI-Lora-Manager)（custom node） | 不大 | LoRA 面板的清單、預覽圖、Civitai 觸發詞，底模面板的名稱和預覽圖都從它來。ComfyUI 沒有就自動裝（git clone 進 `custom_nodes`、用 ComfyUI 自己的 Python 裝套件），裝完重開一次 ComfyUI | `NO_LORA_MANAGER_FETCH=1` |
| 姿勢參考（OpenPose ControlNet＋`comfyui_controlnet_aux`） | 約 2.5 GB | 選用。網頁上先問（安裝／這次不要／不要再問），裝完要重開一次 ComfyUI | `NO_POSE_FETCH=1` 或回答 A |

**啟動一次就全部做完**（Windows、macOS、Linux 都一樣）：伺服器在背景做，網頁左下角的面板顯示每一步、問那兩個問題，裝進 ComfyUI 的東西需要重開時給一顆「重開 ComfyUI」（透過 ComfyUI-Manager；沒有就自己重開）。ComfyUI 還沒開的話，要用到它的步驟會等，一開就接著做，不用再跑一次 `start.bat`。網頁照常先開（先是字的佔位牌），面板會告訴你什麼時候重新整理。過程記在 `data/setup.log`。東西都已經有的人完全看不到這個面板。

## 設定

`cp config.example.json config.json` 再改（不進版控）。新 clone 通常什麼都不用改：底模、LoRA 清單直接問 ComfyUI，有 LoRA Manager（第一次啟動會裝）就連預覽圖、觸發詞都有，手機走 Tailscale 也看得到。常用的有 `comfy.api`、`comfy.ckpt`（要跟 ComfyUI 清單一字不差）、`comfy.checkpointDir`（底模預覽圖）、`paths.loraRoot`（沒有 LoRA Manager 時才用：自己掃資料夾拿預覽圖與觸發詞）、`server.port`（預設 8796）、`client.streamIdleMs`（慢顯卡調大）。環境變數優先於設定檔。

LoRA 面板的「詳情」在 ComfyUI 的 LoRA Manager 直接打開那一個 LoRA：墨池在它的 `static/js/loras.js` 補一小段（`scripts/fetch_lora_manager.py --patch`，不用重開 ComfyUI），LoRA Manager 更新蓋掉後下次啟動會再補。手機（Tailscale）上這些連結指向這台的 ComfyUI，ComfyUI 要用 `--listen` 開才點得開；連不到時連結會藏起來，「詳情」改開 Civitai（預覽圖照樣看得到）。

自己的 ComfyUI workflow：用「匯出工作流 (API)」，拖進畫面的「工作流」面板。送到 Discord：頂欄的 Discord 按鈕貼上頻道 webhook。手機走 Tailscale，用黑窗印出的 `Tailscale http://100.x.x.x:8796/`。

你的資料（使用次數、牌組、作品冊、出圖日誌、匯入的 workflow）都在 `data/`，搬家時連同 `config.json` 一起帶走。

## 跑不起來時

- **bat 一閃就關**：要先裝 Python 3，安裝時勾 *Add python.exe to PATH*；或在本資料夾跑 `py -3 server.py` 看錯誤。
- **「8796 已經有程式在用」**：多半是墨池已經開著，直接開 <http://127.0.0.1:8796/>。要同時開第二份，先設 `PORT=別的埠`。
- **一直顯示 Comfy 未連上**：ComfyUI 沒開，或不在 `comfy.api` 的位址。
- **「讀不到詞庫」**：用 `start.bat`／`start.sh`／`server.py` 開，不要直接點 HTML。
- **生圖到一半停掉**：把 `client.streamIdleMs` 調大。

## 授權

程式碼 MIT（[LICENSE](LICENSE)）。字型 Chiron Hei HK 為 SIL OFL 1.1；three.js 為 MIT。tag 名稱來自 Danbooru；生成內容的責任在使用者自己。
