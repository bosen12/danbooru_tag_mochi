# 墨池 Mochi · Danbooru 卡牌生圖工作臺

[English](#english) · 繁體中文

把 Danbooru 標籤做成一張張有插畫的牌：挑幾張放進合成池，引擎依規則抽牌補齊，整組送進本機的 ComfyUI（WAI / Illustrious SDXL）生圖。

畫面是中文或英文（依瀏覽器語言自動選，頂欄地球選單可切換）；真正送給 ComfyUI 的永遠是英文 tag。

> **成人向。** 這個工具可以產生成人內容，頂欄的分級預設是「全年齡」。詞庫與負向提示詞會擋 `loli`、`shota`、`teen`、`child` 等字，這些牌永遠不會畫也不會抽。
> 伺服器只在你自己的機器上跑，預設只接受本機與 Tailscale 的連線。

從 [danbooru_tag_random](https://github.com/bosen12/danbooru_tag_random)（排字匣）拆出來的獨立版本，只留墨池這一套介面。

## 四個房間

| 房間 | 做什麼 |
|---|---|
| **墨池** `/` | 左邊字盒依花色（人數、長相、服裝、姿勢、場景、風格）翻牌，中英文都能搜。點牌或拖進**合成池**＝每張圖都一定有；剩下的格子由引擎抽牌補齊。底下的規則管尺度、時代、畫面裡有誰、姿勢參考、尺寸。可以一次抽幾張、無限抽、只抽牌不生圖。 |
| **疊印台** `/fuse.html` | 一張牌一層墨：放的牌照花色疊進六列卡池，灰色的影子是引擎補的牌。四張同種子的試印即時重抽，看清楚加了這張之後引擎補了什麼，挑一張再付印。 |
| **卡冊** `/book.html` | 每張牌用過幾次、收藏和撤下的比例、這張牌進過哪些圖。成就牆。 |
| **作品冊** `/album.html` | 收藏的成品、每一張出圖的日誌、每個底模和 LoRA 的成績單；作品上的牌可以帶回墨池再印。 |

另外有兩支在頁面裡即時產生的影片：**介紹影片**（`/intro.html`，3 分鐘）和**使用教學**（`/tutorial.html`，4 分半），畫面和配樂都是真的引擎、真的牌現場算的。頂欄的「導覽」會一步一步帶你操作。

## 你需要先有什麼

| | 版本 | 為什麼 |
|---|---|---|
| **Python** | 3.9 以上 | 跑 `server.py`。只用標準函式庫，不必 `pip install` |
| **ComfyUI** | 預設 `http://127.0.0.1:8188` | 真正生圖的是它 |
| **SDXL checkpoint** | 建議 WAI / Illustrious 系列 | 詞庫照 Danbooru tag 調的 |
| 瀏覽器 | 近三年的 Chrome / Edge / Firefox / Safari | 用到 `:has()`、`popover`、`oklch()`、container queries |

## 上手

```bash
git clone https://github.com/bosen12/danbooru_tag_mochi.git
cd danbooru_tag_mochi
```

1. **先把 ComfyUI 開起來**，確認瀏覽器打得開 <http://127.0.0.1:8188>。
2. **開伺服器。**
   - Windows：雙擊 `start.bat`。會自動找 Python、開瀏覽器。
   - macOS / Linux：`python3 server.py`，然後開 <http://127.0.0.1:8796>。
3. **選底模。** 頂欄的模型按鈕列出 ComfyUI 認得的 checkpoint，點一個就好。想固定預設值，見下面〈設定〉的 `comfy.ckpt`。

視窗不要關。更新程式後在瀏覽器按 **Ctrl+F5**。

### 第一次啟動會自動準備的東西

| 東西 | 大小 | 怎麼來 | 不想要 |
|---|---|---|---|
| 卡牌插畫（全年齡 1160 張） | 約 100 MB | 從 GitHub Release 下載、驗 SHA-256、解到 `web/cards/`。斷了下次接著抓；已經有的圖不覆蓋 | `NO_CARD_FETCH=1` |
| 敏感／色情分級的卡面 | — | 不公開下載。ComfyUI 開著時 `start.bat` 每次都會先問你要不要用自己的底模烘（`scripts/bake_card_art.py`） | `NO_CARD_BAKE=1` 或放一個 `.no-card-bake` 檔 |
| Hires 放大模型 `RealESRGAN_x4plus_anime_6B` | 約 18 MB | 放進 ComfyUI 的 `models/upscale_models` | `NO_UPSCALE_FETCH=1` |
| 姿勢參考（OpenPose ControlNet＋`comfyui_controlnet_aux`） | 約 2.5 GB | 裝進本機 ComfyUI；裝完要重開一次 ComfyUI | `NO_POSE_FETCH=1` |

Windows 的啟動檔會把下載開在另一個縮小的視窗，網頁照常先開（沒插畫時先顯示字的佔位牌），下載完重新整理就有圖。macOS / Linux 直接跑 `server.py` 時，卡面由伺服器在背景下載；放大模型和姿勢參考可以手動跑 `python3 scripts/fetch_upscale_model.py`、`python3 scripts/fetch_pose_assets.py`。

## 設定

機器專屬的東西都在 `config.json`（不進版控），從範本複製一份再改：

```bash
cp config.example.json config.json
```

新 clone 通常什麼都不用改：底模、LoRA 清單直接問 ComfyUI。要改的話：

| `config.json` | 說明 |
|---|---|
| `comfy.api` | ComfyUI 位址（畫面右上的 Comfy 指示燈也能改） |
| `comfy.ckpt` | 預設底模檔名，要跟 ComfyUI 下拉選單裡的字**一模一樣**（含子資料夾） |
| `comfy.checkpointDir` | 填了才有底模預覽圖；生圖不受影響 |
| `paths.loraRoot` | 填了才讀得到 LoRA 的預覽圖和觸發詞；留空就問 ComfyUI 要清單 |
| `server.port` / `server.host` / `server.allowNet` | 預設 `8796`、`127.0.0.1`、只收本機與 Tailscale |
| `client.streamIdleMs` | ComfyUI 靜默多久就放棄該張；慢顯卡（例如 AMD ROCm）調大 |

環境變數優先於 `config.json`：`COMFY_API`、`COMFY_CKPT`、`PORT`、`HOST`、`ALLOW_NET`、`LORA_ROOT`。

**自己的 ComfyUI workflow**：在 ComfyUI 用「匯出工作流 (API)」，把 JSON 拖進畫面的「工作流」面板，指定 Positive Prompt 寫進哪個 node。原始 JSON 不會被改。

**送到 Discord**：頂欄的 Discord 按鈕，貼上頻道的 webhook 網址，成圖就自動送進頻道。網址存在 `.secrets/`（不進版控、不回傳瀏覽器）。

**手機**：`start.bat` 把伺服器綁在 `0.0.0.0`，但只收 loopback 和 Tailscale（`100.64.0.0/10`）。手機走 Tailscale，用黑窗印出的 `Tailscale http://100.x.x.x:8796/`。

## 資料存在哪

全部在專案底下的 `data/`（不進版控）：卡牌使用次數、牌組、作品冊、出圖日誌、匯入的 workflow、成品的 webp 快取。搬家時整個 `data/` 和 `config.json` 一起帶走就好。

## 檔案結構

```
server.py            API、生圖佇列、ComfyUI 代理、靜態檔
card_usage.py …      卡冊、牌組、作品冊、出圖日誌、LoRA、workflow 的伺服器端
web/                 前端（不必建置，瀏覽器直接載 ES modules）
  engine.js          抽牌引擎：規則、互斥、附帶、分級
  lexicon.json       詞庫（tag、中文名、分類、互斥群組）
  index.html …       四個房間
  i18n.js, locales/  英文版
  cards/             卡牌插畫（下載或自己烘，不進版控）
scripts/             插畫下載與烘焙、放大模型、姿勢參考
```

## 跑不起來時

- **bat 一閃就關**：要先裝 Python 3，安裝時勾 *Add python.exe to PATH*。或在本資料夾手動跑 `py -3 server.py` 看錯誤訊息。
- **右上角一直是「Comfy 未連上」**：ComfyUI 沒開，或不在 `comfy.api` 指的位址。
- **畫面寫「讀不到詞庫」**：用 `start.bat`／`server.py` 開，不要直接點 HTML 檔。
- **生圖到一半停掉**：慢顯卡把 `client.streamIdleMs` 調大。

## 測試

```bash
node tests/test_i18n.mjs
```

語言判斷、英文翻譯、使用者內容不被翻、切換語言保留選牌。不需要開 ComfyUI。

## 授權

程式碼：MIT，見 [LICENSE](LICENSE)。
字型 Chiron Hei HK：SIL Open Font License 1.1（`web/fonts/OFL.txt`）。three.js：MIT（`web/vendor/three/LICENSE`）。
詞庫裡的 tag 名稱來自 Danbooru；生成內容的責任在使用者自己。

---

<a id="english"></a>

# Mochi · a card workbench for Danbooru-tag image generation

Danbooru tags as illustrated cards. Pin a few cards, let the engine draw the rest by its rules, and send the composition to your local ComfyUI (WAI / Illustrious SDXL).

The interface is English or Traditional Chinese (follows your browser; switch with the globe menu in the top bar). ComfyUI always receives the canonical English tags.

> **Adult content.** This tool can generate adult images. The rating switch starts at *General*. The lexicon and negative prompt block `loli`, `shota`, `teen`, `child` and similar tags; those cards are never drawn or illustrated.
> The server runs on your own machine and only accepts loopback and Tailscale connections by default.

Split out of [danbooru_tag_random](https://github.com/bosen12/danbooru_tag_random) with only the Mochi interface.

## Four rooms

| Room | What it does |
|---|---|
| **Ink Pool** `/` | Browse the card library by suit (Cast, Appearance, Clothing, Pose, Scene, Style) or search in English or Chinese. Pinned cards appear in every image; the engine fills the remaining slots. Rules set content level, era, characters, pose reference and size. Batch, continuous and draw-only modes. |
| **Fuse Bed** `/fuse.html` | One card per ink layer. Pinned cards stack into six suit rows; grey shadows are the engine's additions. Four same-seed proofs redraw instantly, so you see what each card changes before you generate. |
| **Card Book** `/book.html` | How often each card was used, save and discard rates, and the images it appeared in. Achievements. |
| **Gallery** `/album.html` | Saved images, the full generation history, and a report card for every checkpoint and LoRA. Send a work's cards back to the Ink Pool. |

The **Intro film** (`/intro.html`, 3 min) and **Tutorial** (`/tutorial.html`, 4.5 min) are rendered live in the page with the real engine and cards. **Tour** in the top bar walks you through each room.

## Requirements

Python 3.9+ (standard library only), ComfyUI (default `http://127.0.0.1:8188`), an SDXL checkpoint (WAI / Illustrious recommended), and a current Chrome, Edge, Firefox or Safari.

## Getting started

```bash
git clone https://github.com/bosen12/danbooru_tag_mochi.git
cd danbooru_tag_mochi
```

1. Start ComfyUI.
2. Windows: double-click `start.bat`. macOS / Linux: `python3 server.py`, then open <http://127.0.0.1:8796>.
3. Choose a checkpoint with the model button in the top bar.

On first start the all-ages card art (about 100 MB) downloads from the GitHub release into `web/cards/`; until then cards show placeholder glyphs, so reload when it finishes. `start.bat` also offers to bake sensitive and explicit card art with your own checkpoint, and installs the Hires upscale model and the pose-reference ControlNet into your local ComfyUI. Skip any of them with `NO_CARD_FETCH=1`, `NO_CARD_BAKE=1`, `NO_UPSCALE_FETCH=1` or `NO_POSE_FETCH=1`.

## Configuration

Copy `config.example.json` to `config.json` (git-ignored). Most installs need nothing: checkpoints and LoRAs come from ComfyUI. Useful keys: `comfy.api`, `comfy.ckpt` (must match ComfyUI's list exactly), `comfy.checkpointDir` (preview images), `paths.loraRoot` (LoRA previews and trigger words), `server.port` (default 8796), `client.streamIdleMs` (raise for slow GPUs). Environment variables override the file: `COMFY_API`, `COMFY_CKPT`, `PORT`, `HOST`, `ALLOW_NET`, `LORA_ROOT`.

Import your own ComfyUI workflow (*Export (API)*) from the Workflow panel. Share generated images to Discord from the Discord button in the top bar (paste a channel webhook URL; it stays in `.secrets/`). Your data (usage, decks, gallery, history, imported workflows) lives in `data/`.

## License

Code: MIT ([LICENSE](LICENSE)). Chiron Hei HK font: SIL OFL 1.1. three.js: MIT. Tag names come from Danbooru; you are responsible for what you generate.
