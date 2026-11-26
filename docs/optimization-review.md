# 墨池優化審查

2026-11-26。七個唯讀審查看過抽牌與搜尋、卡圖、啟動下載、生圖、首頁載入、動畫、JSON 存檔。伺服器熱路徑、作品冊 DOM、測試與 CI 這三塊由同一次閱讀補上（那三個任務沒能派出去）。沒有改過程式。

`web/`、`server.py`、其他 Python 模組、`scripts/`、`tests/` 都由上游 `danbooru_tag_random` 的 `scripts/sync_mochi.py` 產生。下面的程式改動要改上游再同步。只有 `CLAUDE.md`、`.github/`、`start.bat`、`start.sh`、README 這類檔在這個 repo 改。不要把下載步驟加回啟動檔。

這台量到的體積：`web/lexicon.json` 3,745,972 bytes、`web/tag_dates.json` 1,935,608 bytes、`web/engine.js` 438,000 bytes、`web/app.js` 294,348 bytes、`web/styles.css` 242,102 bytes、`web/cards/manifest.json` 2,030,273 bytes。`web/` 裡扣掉 `vendor/` 與 `cards/` 有 137 個 `.js`。`server.py` 約 6784 行。這台的 `data/gen_log.jsonl` 只有 3768 bytes。

## 先做這些

使用者每次抽牌、打字、連續生圖會碰到的，排在前面。

1. 每一抽仍把姿勢、環境整段送進 `allow()`。見「抽牌」。
2. 全年齡時，每個候選在便宜檢查之前跑兩次大正規。見「抽牌」。
3. 字盒與卡冊的搜尋，落空時把約八千張牌掃十幾次。見「搜尋」。
4. 開機時主執行緒與 draw worker 各解析、各索引一次詞庫（3.7 MB）。見「開機」。
5. 連續生圖要等上一張的 SSE 結束才送下一張，而且同一張圖把底模清單組了兩輪。見「生圖」。
6. 讀 Comfy websocket 的那條執行緒，途中同步打 `/history` 與 `/queue`。見「生圖」。
7. Hires／修臉在取樣前把原圖整張下載再上傳，這段結束前取消不會生效。見「生圖」。
8. 浮空放大、群組扇面用 480 原圖；公開包幾乎沒有細縮圖。見「卡圖」。

啟動時烘焙題目的張數、介紹片隱藏後的繪製迴圈、CI 的引擎測試，是下一階。JSON 整檔重寫現在不必動。

## 抽牌

索引只在載入時建一次。`indexLexicon` 的 `byTag`、`bySection`、`byMutex`、`byGroup`、`bySub`，以及 `keyCache`、`nameDict`，都留在該執行緒的詞庫物件上。詞庫現在 8824 筆（服裝 2695、環境 1989、姿勢 1730、特徵 1248、人物 1085）。主執行緒與 worker 各持有一份，這是對的。

每一抽仍然貴，是因為 `fill()` 為了均勻抽樣，對整段呼叫 `allow()`。

- 位置：`web/engine.js` 的 `fill`（約 7230–7265 行）。`fillAllowed` 就是 `allow`。姿勢約 1730 筆、環境約 1989 筆都會走進去。`allow` 前半已擋掉尺度、時代、互斥；時代是 `any` 的牌仍會進後面那串很長的 `item.tag === …`。`takeFromPool` 還會再呼叫一次 `allow`。
- 方向：時代與尺度定了之後，每個 section 建一次「這一抽靜態合格」的陣列，後面的 `fill` 走那份。標籤專用規則改成依 tag 查找，一般牌不要跑完整條 if。洗牌仍要用主亂數，抽到名額就停會讓種子漂掉。
- 影響：色情分級下這是每抽的主成本。註解裡慢手機約 150–300 ms；worker 還沒好時落在主執行緒（`web/app.js` 約 3870 行）。這次沒有重跑計時。
- 改上游 `web6/engine.js`。

全年齡／敏感再多一層。`allow()` 在較便宜的熱度、時代檢查之前呼叫 `ratingBlocked`。`explicit` 立刻返回；`general` 則對多數牌跑 `SFW_NSFW_RE` 與 `EXPLICIT_RE`。這兩個正規表達式在 `web/rules/rating.js` 載入時就編好了，貴在每抽對整段重跑 `.test`。字盒那邊已經用 `WeakMap` 擋住同樣的事，註解寫整盒 regex 約 10 ms、手機降速約 40 ms。`indexLexicon` 沒有把結果寫進每張牌。

- 方向：索引時為每張牌存 `general`／`sensitive` 兩個布林，`allow()` 改讀旗標。
- 影響：只影響全年齡與敏感。色情分級幾乎沒差。第一次開字盒時分級就是 general。
- 改上游 `web6/engine.js` 與 `web6/rules/rating.js`。

有卡片群組時，每一次 `commit` 還會對該格成員再跑 `allow()`，而且不看 `used._rev`（`web/engine.js` 約 5184–5212 行）。沒有群組時這段不跑。可以依修訂號記住「這一格還抽不抽得到」。

開頁後第一張：主執行緒 `indexLexicon` 的同時，worker 再 `fetch` 同一份 JSON、再索引一次（`web/draw-worker.js` 約 22–28 行）。worker 還沒好時，主執行緒改走 `drawWithSeed`。穩態每抽沒有這份成本。暖機完成前不要讓這兩件事搶 CPU。不要 `postMessage` 整份詞庫，structured clone 又是主執行緒上的一次完整複製。

先不要動：

- 走光、性愛動作那些路徑在 mutex 不符時就短路，換索引用不到 `allowSlow`。
- 迴圈裡沒有 `new RegExp`。`LazySiblings` 故意第一次抽才建，註解寫一開機算完會在第一次抽牌多 70–80 ms。

## 搜尋

`web/card-search.js` 的 `searchInner`（約 200–239 行）先 `pool.filter(cardMatches)`。有命中就停。落空時 `guessCards` 對池裡每一張配置字元陣列（約 124 行），`shorterTerms` 最多再試十幾個較短片段，每一段再全池 `filter`。六個字的中文落空，大約是一輪全池、一輪猜測、再加十幾輪全池。`nameDict` 只服務中文斷詞，沒有加速 `includes`。`keyCache` 已經避免重做簡繁轉換。

- 方向：在現有的 `indexSearchNames`（整本只走一次）順便建 bigram 的 posting list。查詢先取最稀有的 bigram，再對那份短名單做 `cardMatches`。
- 改上游 `web6/card-search.js`。

已經找到牌時，字盒仍再掃一輪。`web/app.js` 約 1014–1022 行先 `searchCards`，命中後又把幾乎整本丟進 `searchAlso`。落空時 `some(cardMatches)` 為真就改模式，接著 `libraryMiss` 再 `filter` 一次。卡冊（`web/book.js` 約 1166–1200 行）落空再加「分級擋住／廢字／別的花色」三輪，而且每次搜尋都 `new Map` 整庫順序（8824 筆）。打字有 140–160 ms 防抖，擋的是重畫次數，不是單次的重複掃描。註解寫這段含重排 DOM，電腦約 30–60 ms、手機約 0.1–0.25 秒。

- 方向：命中路徑只走「沒進這一輪結果、但仍要出現在也看看」的差集。落空路徑一次掃描同時得到「有沒有」和要顯示的那張。卡冊三輪合成一次。順序 Map 在建庫後留著。
- 改上游 `web6/app.js`、`web6/lib-hint.js`、`web6/book.js`。

## 開機

`web/index.html` 222–233 行依序載入 12 份沒有 `media` 的樣式表：`fonts.css`、`card.css`、`tokens.css`、`styles.css`、`custom.css`、`groups.css`、`lora.css`、`models.css`、`discord.css`、`assistant.css`、`assistant-chat.css`、`locale.css`。第一次繪製要等它們全部建成 CSSOM。`fonts.css` 裡還有主畫面不用的 Noto Serif TC（影片、介紹、教學才用）。`font-display: swap` 只讓字型檔晚到，樣式表本身仍然擋畫面。

- 方向：Noto 的 `@font-face` 移到影片頁自己的 CSS。`assistant.css` 若開機畫不到，可以改成不擋第一次繪製。`lora.css`、`models.css`、`discord.css` 先留著：`boot()` 會把那些鈕插進頂欄，`index.html` 54–58 行的墊寬就是在防那一下跳動。不要改回 `@import`。
- 改上游。

`app.js` 頂部約有 80 個靜態 `import`。`<script type="module" src="app.js">` 在 body 底（327–328 行）。head 只 `modulepreload` 了 `engine.js`（221 行），沒有入口 `app.js`。預載掃描器會先抓 `app.js` 本身，它的依賴要等這份檔解析完才開始。

- 方向：在 head、import map 之後加 `modulepreload` `app.js`。`server.py` 的 `versioned_html` 會加上 `?v=`，import map 也插在第一個 script 之前，同一支模組不會變成兩份。不要上打包器。

詞庫下載有避開兩次，解析沒有。`boot()` 用 preload 的網址 `fetch` 再 `json()`，同時抓 `cards/manifest.json`。worker 仍是再 `fetch`、再 `json`、再 `indexLexicon`。主執行緒接著 `indexLexicon`、`buildLibrary`、`registerLexicon`。字盒 DOM 已改成先畫 24 張（註解：821 張約 270 ms），建庫仍走全本。

- 方向：主執行緒建完索引再暖 worker，兩份索引不要同時跑。`json()` 和 `indexLexicon` 之間可 `scheduler.yield()`，讓「正在讀詞庫」至少能畫一幀。

閒置時，speculation rules（`eagerness: "moderate"`，`index.html` 約 191–196 行）和 `prerender.js` 還會預繪相鄰房間，那些頁再解析一份詞庫。卡冊還會預載 `tag_dates.json`（1.9 MB）。預繪本身要留：註解寫冷開要 1.5–2.4 秒。可以讓預繪頁先不要暖 draw worker。

`tag_dates.json` 不是墨池開機路徑，偏好角色搜尋落空才抓。`language.js`、`theme.js` 要在第一個畫面之前跑，不必改成 `defer`。

詞庫的 `fetch` 不看 HTTP 狀態（`app.js` 約 187 行），manifest 有看。伺服器回 404 JSON 時會在 `indexLexicon` 才炸。這是正確性，優先級低。

## 生圖

抽圖步數本身不在這份範圍裡。空窗在墨池這層。

同一張內建圖會把底模清單組兩輪。`prepare_workflow`（`server.py` 3583–3589 行）先 `resolve_ckpt`，再 `lookup_base_model`。兩者在沒有傳入清單時都會呼叫 `checkpoints_for_ui`（7749–7751 行、1977 行）。接著 `build_workflow`（1216–1217 行）再做一次 `resolve_ckpt` 和 `lookup_base_model`。`checkpoints_for_ui` 會掃本機底模，必要時打 Comfy 的 `/object_info`（`models_from_comfy` 只快取 30 秒，1693 行）和 LoRA Manager（約 60 秒）。同一請求裡後面幾次吃得到快取；一張圖常常超過 30 秒，下一張又是冷的。`/api/gen` 還先同步 `ping()`，快取只有 2 秒。

連續張更明顯。`web/gen.js` 的 `pump`（330–339 行）`await runOne(shot)` 之後才處理佇列裡的下一張。上一張的 SSE 結束、下一張才開始組圖並 `POST /prompt`。組清單的 Comfy 請求就落在 GPU 空窗。

- 方向：同一請求只解析一次底模與家族，把組好的清單放進跟檔名同一層的短快取。連續張在上一張還在畫時就把下一張送進 Comfy 佇列。取消已經有刪佇列的路徑。
- 改上游 `server.py` 與 `web6/gen.js`。

`gen_via_ws`（4400 行起）在讀 websocket 的同一條執行緒上同步問 Comfy。有事件時，每 5 秒 `completed_image()` 打 `/history`（4486 行）；每 10 秒 `check_queue()` 打 `/queue`（4487 行，`QUEUE_CHECK_EVERY` 在 4298 行）。socket 安靜時 `settimeout(2.0)`，逾時後只要距上次 history 已滿 2 秒就再查（4502 行）。這些呼叫回來之前不會再 `recv`。註解寫明：別人的廣播可能讓 `recv` 永不逾時，所以不能只在安靜時查。查詢要留，但可以挪到旁邊的執行緒，避免堵住預覽。載模型時 2 秒一次可以放寬到跟 5–10 秒同一節奏。

Hires／修臉：`prepare_hires`（3088 行）以較長的 timeout 把原圖從 Comfy `GET /view` 下來，核對雜湊後再 `comfy_upload_image` 傳回去。檔名已經是內容雜湊、同一張可以重複使用時，這段仍會傳。`gen_events` 在 `prepare_workflow` 回傳後才送出事件；`GenJob.cancel` 還沒有 `prompt_id` 就直接返回。取消要等下載與上傳都做完。修臉的 `face_status` 每次打多個 `/object_info`，沒走已經有的 `object_info_cached`（30 秒，1709 行）。

- 方向：本機 Comfy 改為把 output 裡那張硬連結或複製進 `input/danbooru_hires`；雜湊檔已在就不要再傳。`prepare_*` 每一步看 `cancelled`。修臉改用 `object_info_cached`。
- 影響：Hires 取樣前少掉兩次整張 PNG 的 HTTP。按停不用等這段跑完。

自訂工作流每次生圖都從磁碟重讀 `workflow.json` 再 deepcopy（`workflows.py` 的 `get_profile`，全程拿著鎖）。內建圖只有一小份 dict，不受影響。用自訂工作流而且 JSON 很大時，才值得依 mtime 快取已讀的內容。

先不要動：生圖日誌是追加一行，整檔重寫只在超過約 5500 筆時。負面詞一張只拼一次。預覽已有最短間隔。WebSocket 失敗改走輪詢時會沿用組好的圖，不會把 Hires 原圖再抓一次。

## 卡圖

卡圖請求路徑不會在每次瀏覽時轉檔。公開包是 `card-art-v13`：縮圖包約 75 MB、原圖包約 244 MB，先解縮圖、原圖在背景再抓。字盒格子走 200px 的 `srcset`。

這台 `web/cards`：原圖約 6586 檔、約 245 MB（均 37 KB）；`thumb/` 約 6582 檔、約 71 MB（均 11 KB）；`mini/` 只有 15 檔。6582 筆 manifest 裡只有 5 筆有 `mini`。

浮空放大直接要原圖。`web/cards.js` 462–464 行的 `art()` 註明給放大牌、校樣、詳情。`web/app.js` 1514 行把 `assets.art(card.tag)` 放進 peek。`web/card-peek.js` 117 行設成 `img.src`，沒有 `loading="lazy"`。`artUrl`（`web/card-art.js` 203–205 行）就是 `cards/<檔>.webp`，沒有縮圖。放大卡寬約 248 px、圖欄約 190 px；群組葉片約 48 px；自製扇面是牌面的 62%。這些槽遠小於 480。

- 方向：小槽改走 `chooseArt`／`sources`。沒有 mini 就用 200px 縮圖。詳情欄在高 DPR 用 480 仍然合理。
- 改上游 `web6/`。

細縮圖沒有進下載包。打包時拿掉 `mini` 是為了避免 404。`bindArt` 因此退回 `srcset` 的 200w。註解寫 200px 畫進約 91px 的牌會走 mipmap。mini 載入失敗時又會直接跳 480。

- 方向：原圖包落地後，用現成的 `card_thumbnails.build_entry` 就地補 160／240／320。沒有 ffmpeg 就維持現狀。不要把三階 mini 塞進先抓的縮圖包，也不必為這件事重發 Release。

文案還停在舊包的大小。程式抓的是 v13 的 75 MB + 244 MB。面板和 `web/locales/en.js` 仍寫縮圖約 30 MB、大圖約 103 MB；`server.py` 約 8019 行寫「約 100MB」。本 repo 的 `CLAUDE.md` 仍寫 Release `card-art-v7`。下載迴圈的百分比是對的，使用者看的那行不是。把數字改成跟實際的 thumbs／full 一致。`CLAUDE.md` 在這個 repo 改，其餘改上游再同步。

另外兩件，優先級較低：

- `server.py` 的 `_cached_file`（6892–6915 行）把每個靜態檔的完整 bytes 留在 `_STATIC`，沒有上限。卡圖不走 webp／thumb 那兩個有上限的目錄。長開著把卡冊捲完，縮圖約 71 MB 會留在程序裡，滑過的原圖再各留約 37 KB，重開才放。
- `scripts/fetch_card_art.py` 有完成標記就不再看檔還在不在。標記只能代表「這一包解完」。缺檔仍要走逐張檢查。

先不要動：送進瀏覽器的卡面清單已經削過。磁碟上的 manifest 是 2,030,273 bytes（含提示詞）；`slim_card_manifest`（`server.py` 273–286 行）去掉 `positive`／`negative`／`seed` 後約 607 KB，gzip 約 122 KB。`data/webp-cache`（這台 207 檔、約 23 MB）和 `data/thumb-cache`（4 檔）只服務 Comfy 成品與模型預覽，與卡圖無關，離 1500／3000 的上限還遠。`crack/cards`（約 2.9 萬檔）是本機額外圖，不在 Release 路徑上。不要改 AVIF，也不要改成永不抓原圖。

## 啟動與下載

`start.bat` 與 `start.sh` 只負責找 Python 並執行 `server.py`。卡圖與模型在伺服器開始接線之後，由 `setup_tasks.start()` 在背景做。有 `web/setup-panel.js` 時不會再走另一條抓卡。這台在卡面標記已在、ComfyUI 已開時，定常檢查約 3 秒，不擋接線，也不會連到 GitHub。大檔已有斷點續傳；解壓會跳過已存在的圖。

卡面下載失敗時，全年齡不會自動烘，但 `_bake`（`setup_tasks.py` 644–681 行）在設定 skip 之後沒有 return。接著仍執行不帶 `--rating` 的 `bake_card_art.py --status`（673 行）。使用者若在成人那一題按烘，`_bake_adult`（714–715 行）跑的也是不帶 `--rating` 的 `bake_card_art.py`。全年齡缺很多、或整包下載失敗時，這題的張數與工作清單會把那些全年齡算進去。這台目前全年齡是齊的，所以成人題的張數是準的。

- 方向：仍然詢問敏感／色情。status 與實際烘焙只含 sensitive 與 explicit。全年齡缺很多時，不要把它們算進成人題。
- 改上游 `setup_tasks.py`（分級篩選在 `bake_card_art.py`）。不要改 `start.bat`。

每次啟動在 ComfyUI 就緒後，仍依序開子程序做各項 `--check`，再跑三次 `bake_card_art.py --status`（全年齡、全部等級、角色）。後兩次各自再 import server、讀 `card_jobs.json` 與 manifest，並對檔案做 `stat`。審查時這台實測：卡面 `--check` 0.12 秒、五個 fetch 各 0.14–0.20 秒、三次 status 0.73 + 0.74 + 0.54 秒。全部等級那輪會把剛查過的全年齡再查一次。

- 方向：一次行程回報三段 status。`--status` 直接讀已進版控的 `card_jobs.json`，不要為了現算再開 Node。ComfyUI 是否在線沿用 `setup_tasks` 已經知道的結果。
- 影響：每次啟動的背景檢查從約 3 秒收成一輪。

`web/setup-panel.js` 的 `quiet` 只在第一次 poll 把當時已是 done/skip 的項目記下來。檢查約 3 秒，瀏覽器常在這之前就載入，當時還是 `idle`。全部做完後，面板會再留約 6 秒的「準備完成」。這個分頁沒看過 run/ask、後來才變成 done/skip 的，可以事後補進 `quiet`。有成人／角色要問時，面板本來就該留下。

先不要動：`data/setup.log` 這台約 7 KB，啟動不重讀它。放大模型的 `--check` 這台 0.15 秒就結束。`start.bat` 裡的 `tailscale ip -4` 這台是 0.06 秒。卡面標記在時，`--check` 不會連 GitHub。

## 動畫

主工作台的飛牌、開場、螢幕保護（載入完成之後）在隱藏時會停。下面是還在跑的。

介紹片的 `frame()`（`web/film.js` 2154–2169 行）只在時間變了才 `render`，但每一格都無條件再排 `requestAnimationFrame`，也不聽 `visibilitychange`。暫停時同一格不會重畫，迴圈本身還在。教學片同一結構，而且暫停後仍每一格改進度條。播放中 `score.play()` 會留下 `setInterval(pump, 80)`，只有使用者暫停才清掉。隱藏分頁時瀏覽器多半不送 rAF，所以 WebGL 通常會停；程式自己沒停，配樂泵會繼續，分頁一回來就接著滿速畫。

- 方向：記住 raf id。分頁隱藏時取消，並暫停配樂但留下播放頭。回到前景且原本在播，再排一格。教學片的進度寫入挪進「時間變了」那個判斷裡。
- 改上游 `web6/film.js`、`web6/tutorial.js`、`web6/synth-engine.js`。

螢幕保護在 `gl` 已經存在時，隱藏會 `pause`。`gl` 要等動態載入之後才賦值（`web/screensaver.js`）。這段 `await` 期間若分頁已隱藏，當時 `active.gl` 仍是 `null`，接著 `gl.start()` 照樣把迴圈打開。`start()` 之後若 `document.hidden` 就立刻 `pause`。

導覽開著時，`web/tour.js` 的 `setInterval(tick, 250)` 不看分頁是否隱藏，每次都量位置並寫 `left`／`top`。註解寫明用計時器就是為了分頁在背景也跟。隱藏時不要 `place()`，回到前景再對一次位置。

影片頁的 `.world`、字幕、按鍵、進度在 `web/intro.css`、`web/tutorial.css` 裡整頁都掛著 `will-change`，暫停之後合成層還在。別處（`compare.js`、`styles.css`）是動的時候才掛。改成只在實際在播時加上。

先不要動：`card-tilt.js` 只在滑鼠移動時排一格。`motion.js` 的飛牌有逾時落地。`about.css`、`arch.css`、`styles.css` 的無限 CSS 都有 `prefers-reduced-motion`。不要為了風格拆這些。

## 作品冊

作品分頁已經避免「每次整片重建 DOM」。`web/album.js` 812–829 行的 `tileCache` 用簽名重用格子；註解寫以前 150 件時手機換回「作品」要 256 ms。圖片有 `loading="lazy"` 與 `decoding="async"`（832–851 行）。日誌分頁有游標翻頁（`web/album-log.js` 的 `PAGE`）。成品牆的瀑布流先寫完寬度再一起量高度（`web/wall-masonry.js` 52–67 行），並註明只演畫面附近的格子；牆上也有「超過 80 張就裁」的說法。

作品分頁沒有同樣的上限。`render()`（662 行起）把目前看得到的作品全部放進 `album-grid`。換篩選、換搜尋會 `replaceChildren` 整批格子，再對畫面附近的格子量 `getBoundingClientRect` 做位移動畫。點格子時用 `works.find` 線性找那一件（約 861 行）。

作品少於一兩百件時，現有的格子快取就夠。作品冊長到幾百、幾千件時，再讓作品牆只掛視窗裡的格子，沿用日誌那套翻頁或牆的 80 張上限。現在先不要為了虛擬化重寫作品冊。

`/api/recipes` 沒有分頁。`recipes.list_recipes`（`recipes.py` 549–574 行）每次把目錄裡每個 JSON 讀進來、正規化、再收成摘要。`server.py` 的 `favorite_index`（4652 行）在快取命中前會走這條，而且每次呼叫都先 `_recipes_stamp()`（4643–4648 行），那一步會 `glob("*.json")` 數檔案。卡冊問某張牌的作品（約 7248 行）會碰到它。作品少時無感；作品變多之後，這次 glob 與整目錄重讀會先成為卡冊的成本。快取鍵可以改成目錄的 mtime 加一個記憶體裡的筆數，不必每次列目錄。

## 伺服器上已經有的快取

這些已經做過，不要再當成缺口：

- 靜態檔依 mtime 留在 `_STATIC`，HTML 依內容留在 `_HTML_OUT`，帶 `?v=` 的網址可以快取一年。
- `own_js_files` 兩秒內不重掃，而且跳過 `cards/`、`vendor/`、`data/`（`server.py` 516、564–572 行）。
- `dc_lexicon` 與 `character_ban` 依 mtime 重讀。詞庫改了才會再 `json.loads` 那份 3.7 MB。
- 行程啟動時 `_negative`、`_rating_negative`、`_sfw_negative`（191–246 行）各讀一次詞庫，之後用常數。這是開行程付一次，不是每個請求。若要收，三次合成一次讀取即可，優先級低。
- Comfy 的 `object_info` 有 30 秒快取。修臉那條還沒用它，見「生圖」。

`gen_log.page` 會把日誌讀進記憶體並依 mtime 快取（`gen_log.py` 207–265 行）。這台日誌只有幾 KB。上限 5000 筆，超過才整檔整理。現在不必換儲存方式。

## 測試與 CI

`.github/workflows/test.yml`：每次 push 與 pull request，四個工作（Ubuntu Python 3.9、Ubuntu 3.13、Windows 3.13、macOS 3.13）各自 `compileall` 再跑 `python tests/run.py`。另一個 Ubuntu 工作每次 `npm install --no-save playwright`、安裝 Chromium，再跑兩支瀏覽器測試和 `python tests/run.py --playwright`。完整歷史引擎回歸 `test_engine.mjs` 只在手動 dispatch。

`tests/run.py` 預設約 50 項，一項一個子程序，依序跑。`test_engine_release.mjs` 在預設清單裡，而且標成慢測試（逾時 1800 秒，100–101 行）。註解寫詞庫變大之後，GitHub 的 Windows 機器跑這支會超過 600 秒。`--full` 才加上已拆開的 `test_engine_shards.mjs`（註解：約 7 分鐘，原本約 28 分鐘）。

- 方向：引擎 release 留在一個 Linux 工作。另外三個 OS 跑其餘檢查。瀏覽器工作為 Playwright 的瀏覽器目錄加快取，避免每次重新下載 Chromium。
- 改這個 repo 的 `.github/workflows/test.yml`。測試本體的改動仍回上游。
- 不要把預設檢查改成平行硬跑。多支測試會自己開伺服器，埠會撞。

`needs_browser` 會把每個測試檔讀一遍找 `playwright` 字樣，這點成本可以忽略。

## 存檔

走 `file_lock.write_text` 的存檔，每一次都是整份換掉，正本和 `.bak` 各寫一次，有 `fsync`。這是斷電與兩個伺服器對打時的寫法。牌組、使用次數、偏好名單都有筆數上限，註解寫的是幾 KB 到幾十 KB。使用次數加一筆也整份重寫，檔案這個大小時不必改。

瀏覽器的 `web/store.js` 把最多 80 筆成品 `JSON.stringify` 進同一把 `localStorage` 鑰匙，不含預覽圖。維持整把覆寫即可。

`gen_log` 平常是追加。它沒有用 `file_lock`。兩個程序同時寫同一份 `data/` 時，追加和 `_trim` 的 `os.replace` 可能搶。這次沒有重現。比「少寫幾個位元組」更值得以後再看，但不是現在的優先。

## 審查沒有覆蓋的

沒有重跑抽牌計時、沒有開瀏覽器量開機，也沒有對 Comfy 送出真正的生圖。上面的毫秒數，除了啟動檢查那一輪是這次實測，其餘來自程式裡已有的註解。卡圖的檔案數與位元組來自卡圖審查對這台目錄的統計。
