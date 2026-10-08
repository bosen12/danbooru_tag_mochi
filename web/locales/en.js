/* English UI copy. Chinese source phrases are stable presentation keys.
 * Keep canonical Danbooru tags and user-provided names out of this catalog. */
const copy = String.raw`
送到 Discord|Share to Discord
尚未設定。貼上 webhook 網址再按存設定。|Not configured. Paste a webhook URL and save.
連接方式|Connection
Webhook 不必建機器人，在頻道設定裡建一個就好；萬一外洩，它也只能往那一個頻道貼文。|Create a webhook in your channel settings. It can only post to that channel.
Webhook 網址|Webhook URL
頻道設定 → 整合 → 建立 Webhook → 複製 Webhook 網址。|Channel Settings → Integrations → Create Webhook → Copy Webhook URL.
不必建 bot、不必邀請、不必抓頻道 ID|No bot, invitation or channel ID needed
—— 網址本身就含頻道和憑證。也因為如此它就是密碼：存在伺服器的|The URL contains the channel and credentials. Treat it as a password. It is saved on the server in
，不進 git、不會回傳瀏覽器。留空＝沿用已存的。|, excluded from Git and never returned to the browser. Leave blank to keep the saved URL.
每張成圖自動送|Share each generated image
一般抽、無限抽都送。送失敗不會中斷抽圖|Applies to single and continuous generation. Sharing failures do not interrupt generation.
精簡|Compact posts
只送圖和底下一行小字（seed、尺寸、模型、LoRA），不送分類標籤和英文提示詞。無限抽時頻道比較不會被洗版|Post the image with seed, dimensions, model and LoRA. Omit tags and prompts to keep continuous generation posts compact.
存設定|Save settings
送一則測試|Send test post
送出|Sent
失敗|Failed
還沒有牌|No cards yet
空白的版|Start your composition
從字盒挑牌，或用下方起手式；留白的層由引擎補上。|Choose cards from the library or try a starter below. The engine fills empty layers.
或者從這裡起手|Try a starter
換一組|More starters
雨後公園|Park after the rain
櫻花校園|Cherry blossom campus
霓虹街頭|Neon streets
春日和服|Spring kimono
電車窗邊|Train window
海邊黃昏|Seaside sunset
選試印後付印|Choose a proof to generate
從下方選一張試印，再付印成圖。|Choose a proof below, then generate the image.
更多設定與操作|More options
看 POS|View prompt
把這一版放進墨池的合成池|Send these cards to Ink Pool
不罩色|No overlay
好了|Ready
次|uses
種|cards
個|items
張|images
件|images
天|days
沒說原因|No reason provided
（還有更早的）|(older entries available)
這張用到的牌|Cards used
女生|female characters
男生|male characters
下一輪…|Next round…
無限抽開著|Continuous generation on
換成|Replaced with
加進|Added
張數還太少，不排名|Not enough images to rank
（收藏過）|(saved)
（撤下過）|(discarded)
把它拿出卡盒|Remove from card box
字|C
開著|on
關著|off
雨夜街角|Rainy street corner
書房午後|Afternoon study
咖啡店|Coffee shop
放學教室|After school
屋頂星空|Rooftop stars
白底立繪|White backdrop portrait
閃亮舞台|Bright stage
夏日泳池|Summer pool
單車兜風|Bicycle ride
早晨廚房|Morning kitchen
賴床|Slow morning
樹影散步|Walk in the shade
秋日落葉|Autumn leaves
街頭帽T|Streetwear hoodie
溫泉|Hot spring
像素小品|Pixel art
九〇年代|The nineties
魔法光點|Magic lights
夏祭浴衣|Summer festival yukata
道場|Dojo
古風庭園|Traditional garden
城堡騎士|Castle knight
維多利亞茶會|Victorian tea party
希臘神殿|Greek temple
跟那一張的時代對不上|Different era from this proof
目前勾的情境不收它|Excluded by the selected themes
被同一格或相剋的字擠掉|Replaced by a slot or tag conflict
時代不合拿下|Removed: different era
拿下（沒有人物）|Removed: no characters
被換下|Replaced
起手|Starter
清版了。按撤回可以拿回來|Layers cleared. Undo to restore them.
換了一批試印|New proofs ready
連不到主機（網路斷了？），網路回來就接著印|Server disconnected. Generation resumes when the connection returns.
這一張已經在印了|This proof is already generating.
連不到主機（網路斷了？），接上再送|Server disconnected. Reconnect before generating.
印刷機（ComfyUI）沒開，先不送|ComfyUI is offline. Start it before generating.
回到舊版之前|Before restoring composition
尺寸也換回當時的|Dimensions restored
。規則（時代、情境、人物…）改過，試印跟當時不一樣|. Rules have changed, so the proofs may differ from the original.
回到這一版了|Composition restored
排隊等印…|Queued…
預覽：選試印後付印|Preview: choose a proof to generate
晾紙繩上還有一張在印；這一版也可以先付印。|Another image is still generating. You can queue this composition too.
ComfyUI 的輸出資料夾裡找不到這張，可能被刪掉了。按「再印一次」照原樣重印。|The original image is missing from ComfyUI output. Choose Generate again to recreate it.
固定 seed|Lock seed
收起|Collapse
空著|Empty
疊上|Layer
在廢字簍，會跳過|Blocked; will be skipped
你的牌組|Your decks
長按一張牌放開，可以看它的說明。|Long press a card and release to view details.
沒有可以撤回的|Nothing to undo
上墨|Included
四張試印都有它|Included in all four proofs
沒上墨|Excluded
引擎|Engine
收下這張|Pin this card
Hires 排隊中…|Upscale queued…
付印（P）|Generate (P)
連不到主機（網路斷了？）。可以繼續疊版、挑試印，接上了再付印。|Server disconnected. You can keep arranging cards and proofs. Reconnect to generate.
印刷機（ComfyUI）沒開。可以繼續疊版、挑試印，開了再付印。|ComfyUI is offline. You can keep arranging cards and proofs. Start ComfyUI to generate.
複製好了|Copied
複製不了，請手動選取|Could not copy. Select and copy the text manually.
放好了：回墨池工作臺就看得到|Cards ready in Ink Pool
這一版的牌放進墨池的合成池了|Composition sent to Ink Pool
排隊|Queued
停了|Stopped
原檔已刪|Original missing
回到這一版|Restore composition
撤下了這一張|Image discarded
從繩上撤下了一張|Image removed from results
放回繩上了|Image restored to results
從繩上撤下|Discard image
放一張牌上版，這裡會列出跟它呼應的牌，和引擎常常補進來的牌。|Add a card to see related cards and frequent engine additions here.
重畫中|Upscaling
選底模|Choose checkpoint
自己擺的|Edited pose
照這張|Reference image
種、每種一件|types, one item each
格|slots
做做看，做到了會自動到下一步。|Try it. The tour advances when you complete the action.
沒填頻道 ID|No channel ID
尚未設定。填好下面兩格再按存設定。|Not configured. Complete both fields below and save.
Bot 要自己建 application、邀進伺服器、再抓頻道 ID，但日後可以擴充成互動功能。|Create a Discord application, invite the bot to your server and enter a channel ID. Bots can support interactive features.
存設定 · 尚未套用|Save settings · Pending changes
最後錯誤|Last error
存檔中…|Saving…
存不進去|Could not save
送出中…|Sending…
送到了。去頻道看一下。|Sent. Check your Discord channel.
Discord 沒收|Discord rejected the post
已排進 Discord 佇列|Queued for Discord
節點|Node
附帶：牌會把上一層帶上來|Dependencies bring another layer with the card
張牌可抽|cards available
這條線以上的字，一個都抽不到 · 負面詞自動補上|Cards beyond this level are excluded · Negative prompts are added automatically
重畫細節|Refine details
張會一定進圖|pinned cards in every image
拖牌進來收藏，一鍵送進池子|Drag cards here to save favorites, then pin with one click
張牌 · CARDS|CARDS
花色 · SUITS|CATEGORIES
互相打架 · CONFLICTS|CONFLICTS
時代不對|Different era
好了 · done|Done
原圖留著 · 隨時還原|Original preserved · Restore anytime
不罩色 · no overlay|No overlay
空著：引擎會補 · the engine fills it|Empty · Filled by the engine
一次幾張、無限抽，每張都用同一顆 · 抽牌照樣隨機|Reuse the same seed in batches and continuous generation · Cards stay random
觸發詞拼進 POS|Trigger words added to the prompt
Positive ← 排字匣|Positive ← Danbooru Case
→ 墨池|→ Ink Pool
連線中斷… 伺服器先把這一張留著|Disconnected… The server keeps the current image.
接回來了 · 同一張、同一個進度|Reconnected · Same image, same progress
# 成品|# results
文件 · README|Docs · README
印好了 · 墨池|Done · Ink Pool
Python 3 · 標準函式庫，不用裝任何套件|Python 3 · Standard library, no extra packages
墨池    http://127.0.0.1:8796|Ink Pool    http://127.0.0.1:8796
只收本機與 Tailscale 的連線|Local and Tailscale connections only
排字匣　·　墨池　·　疊印台|Danbooru Case · Ink Pool · Fuse Bed
排星河 · Building the galaxy|Building the galaxy…
還沒有卡面插畫：牌會是字的佔位牌 · No card art yet — cards show placeholders|No card art yet · Cards show text placeholders
認識畫面|Meet the workbench
放牌的三種方法|Three ways to pin
牌跟牌的關係|Card relationships
抽牌與生圖|Draw and generate
成品牆|Results
偏好卡牌與廢字簍|Favorites and blocked cards
一張牌，一層墨|One card, one layer
放牌|Place cards
影子與關係|Engine additions and links
四張試印|Four proofs
付印與晾紙|Generate and collect
撤回、清版、起手式|Undo, clear and starters
六列＝六層墨|Six rows, six layers
四張，選一張付印|Choose one of four proofs
影子：引擎替你補的牌|Ghost cards: engine additions
四張試印：同一批種子|Four proofs, shared seeds
停一下：先預覽 B 補的|Hover to preview proof B
牌角四個點：四張試印有幾張用到|Four dots show which proofs include the card
每個字是一張牌|Each tag is a card
放進來的，每張圖都有|Pinned cards appear in every image
印好的圖收在這裡|Your generated images appear here
放進池|Pin card
附帶：牌自己帶上來的|Dependencies: included with this card
尺度：抽牌會出現到哪一種程度|Content level: how explicit a draw can be
時代：字盒只留江戶的牌|Era: the library shows Edo cards
人物：女、男、不限|Characters: female, male or any
這是規則在幫你擋掉會壞掉的組合|Rules prevent incompatible combinations
抽牌中…|Drawing cards…
無限抽中…|Continuous generation…
已停|Stopped
換場景，人不變|Change the scene, keep the character
拖到畫面邊緣，頁面自己捲|Drag to the edge to scroll
撤下了一張成品|Image discarded
再來，換疊印台|Next: Fuse Bed
取消／停|Cancel / Stop
只抽牌／付印|Draw / Generate
撤回／復原|Undo / Restore
選試印|Choose proof
鍵盤，比滑鼠快|Keyboard shortcuts
現在，換你了|Your turn
墨池 · 疊印台　放一張牌試試|Ink Pool · Fuse Bed · Try your first card
＋ 更多設定與操作|＋ More options
/ 找牌　Z 撤回　1–4 試印　R 換一批　P 付印|/ Search · Z Undo · 1–4 Proofs · R Reroll · P Generate
墨池|Ink Pool
疊印台|Fuse Bed
卡冊|Card Book
作品冊|Gallery
排字匣|Danbooru Case
排字匣 · 墨池|Danbooru Case · Ink Pool
墨池 · 疊印台|Danbooru Case · Fuse Bed
墨池 · 卡冊|Danbooru Case · Card Book
墨池 · 作品冊|Danbooru Case · Gallery
墨池頁面|Workbench navigation
介紹影片|Intro film
教學|Tutorial
導覽|Tour
字盒|Card library
合成池|Pinned cards
卡池|Card layers
成品|Results
作品|Saved
日誌|History
模型|Models
全部|All
找牌|Search cards
找作品|Search gallery
搜尋字盒|Search card library
搜尋：紅髮、kimono…（按 / 跳到這裡）|Search red hair, kimono… (press /)
找牌：紅髮、kimono…（按 /）|Search red hair, kimono… (press /)
找牌：紅髮、kimono…|Search red hair, kimono…
找作品：牌名、提示詞…|Search cards or prompts…
找印過的：牌名、提示詞、底模、LoRA…|Search cards, prompts, models, LoRA…
找模型：底模、LoRA 的名字…|Search models or LoRA…
花色|Category
小分類|Subcategory
尺度分級|Content rating
分級|Rating
尺度|Content level
全年齡|General
敏感|Sensitive
色情|Explicit
時代|Era
不限時代|Any era
現代|Modern
古中國|Ancient China
古希臘|Ancient Greece
中世紀|Medieval
江戶|Edo
維多利亞|Victorian
沒標時代|Unspecified era
不分|None
髮色|Hair color
人數|Cast
人物|Cast
長相|Appearance
服裝|Clothing
姿勢|Pose
場景|Scene
風格|Style
畫質|Quality
罩色|Style
底色|Scene
活動|Activity
誘惑|Suggestive
走光|Exposure
性愛|Sexual
情境|Context
規則|Rules
尺寸|Size
種子|Seed
生圖種子|Generation seed
底模|Checkpoint
取樣|Sampling
時間|Time
從|Source
結果|Result
耗時|Duration
預設|Default
沒有|None
提示詞|Prompt
正向|Positive
負向|Negative
強度|Strength
份量|Weight
快速|Fast
深度|Detailed
倍率|Scale
隨機|Random
固定|Fixed
方|Square
直|Portrait
橫|Landscape
方 1024²|Square 1024²
直 832×1216|Portrait 832×1216
橫 1216×832|Landscape 1216×832
聲音：開|Sound on
聲音：開（點一下關掉）|Sound on · Click to mute
聲音：關（點一下打開）|Sound off · Click to enable
Comfy 已連|Comfy connected
Comfy 未連|Comfy offline
連不到主機|Server offline
讀取中…|Loading…
載入中…|Loading…
翻譯中…|Translating…
關閉|Close
完成|Done
取消|Cancel
停|Stop
知道了|Got it
復原|Undo
撤回|Undo
換回|Restore
刪除|Delete
清空|Clear
清版|Clear layers
貼上|Paste
牌組|Decks
牌|Cards
牌友|Card collector
偏好卡牌|Favorite cards
廢字簍|Blocked cards
卡盒|Card box
狀態|Status
池中|Pinned
封鎖|Blocked
在廢字簍|Blocked
盒中|In box
你選的|Pinned
你放的|Pinned
你放的牌|Your pinned cards
你選的牌|Your pinned cards
你親手放|Manually pinned
引擎補的|Engine additions
引擎抽的|Drawn by the engine
抽到的|Drawn
附帶|Included
補位|Fallback
必抽|Required
組合|Preset
沒進圖|Not used
相剋|Conflict
相配|Related
呼應|Related
同一格|Shared slot
一張圖只留一個|One per image
只在有女性時|Requires a woman
只在有男性時|Requires a man
分級擋掉|Hidden by rating
在合成池裡：每張圖都會有|Pinned · Included in every image
在廢字簍裡：不會抽到|Blocked · Never drawn
放了人物的牌：「沒有人物」拿下來了|Character cards added; no humans was removed.
合成池還是空的|No pinned cards yet
卡池還是空的|No pinned cards yet
版還是空的|No cards in the layers yet
按上面的「挑牌」選牌放進來|Open Browse cards to choose your first card.
點字盒的牌放進來|Click a library card to pin it here.
把字拖進來|Drop a card here
放進來的字，每一張圖都一定有；其他格子引擎補。|Pinned cards appear in every image. The engine fills the other slots.
長按一張牌放開，可以看它的詳情。|Press and hold a card to see its details.
點開看詳情；滾輪或 +／− 調份量|Click for details. Scroll or use + / − to change weight.
沒有符合的牌|No matching cards
沒有符合的牌。|No matching cards.
沒有符合的|No matches
這一格沒有字。|No cards in this category.
。其餘被花色、分類或搜尋篩掉|. Other cards are filtered by category or search.
挑牌|Browse cards
展開全部|Show all
收起字盒|Collapse library
Enter 放進第一張，↓ 走進字盒|Enter pins the first result; ↓ moves into the library.
Enter 放上第一張，↓ 走進字盒|Enter adds the first result; ↓ moves into the library.
畫面裡有誰|Characters
女|Women
男|Men
不限|Any
混合（每張隨機）|Mixed · Random per image
每張隨機|Random each
每段抽幾個|Cards per category
每段補幾張|Cards per category
引擎每段補幾張|Cards added per category
場景合理度|Scene consistency
抽職業|Include occupations
字盒只看這個時代|Filter library by era
更多規則：每段張數與選格、尺寸、場景、職業|More rules: categories, size, scene, occupations
▸ 更多規則：每段張數與選格、尺寸、場景、職業|More rules: categories, size, scene, occupations
疊印台自己的規則，跟墨池分開。改了之後四張試印會立刻重抽。|Fuse Bed has its own rules. Changes redraw all four proofs immediately.
一次|Batch
無限抽|Continuous
同一個人|Same character
同一個人：一次 2 張以上才有作用|Same character requires a batch of at least 2 images.
一次抽好幾張時，第 2 張起沿用第 1 張的長相：同一個角色換姿勢、換衣服|Reuse the first image's appearance throughout a batch, with new poses and outfits.
抽完一輪自動接著抽下一輪，一直到按「停」|Keep drawing new batches until you press Stop.
只抽牌|Draw only
抽並生圖|Draw & generate
只抽牌，不送 Comfy（P）|Draw cards without generating an image (P)
只抽牌（P）|Draw only (P)
抽並生圖（G）|Draw & generate (G)
無限抽・下一輪…|Continuous · Next batch…
池子是空的，全靠抽|No pinned cards · All cards are random
這一輪抽牌失敗，請再試一次|This draw failed. Try again.
這一輪抽不出東西：合成池的字可能互相卡住，換一兩張試試|No combination found. Try replacing one or two pinned cards.
全部展開|Expand all
全部收起|Collapse all
展開／收起這張用到的牌|Expand or collapse the cards used in this image
每張圖用了哪些牌收在「牌 · N」裡：你放進池子的，和引擎抽到的。|Open Cards to see your pins and the engine's additions for each image.
還沒有成品|Your first image starts here
放幾個字進合成池，就能抽牌並生圖。|Pin a few cards, then draw and generate an image.
這張沒有放字，全部是抽的|All cards in this image were drawn randomly.
只抽了牌，還沒送去印|Cards drawn · Ready to generate
排隊等印|Queued
排隊等 ComfyUI|Waiting for ComfyUI
印製中|Generating
印製中…|Generating…
印好|Generated
印好了|Generated
印好了，後來撤下|Generated, then discarded
印壞|Failed
印壞了|Generation failed
取消了|Canceled
上次中斷了|Previous generation interrupted
送去印這張|Generate this image
再印一次|Generate again
同種子重印|Regenerate with same seed
同樣的 POS、同一顆種子再送一次|Generate again with the same prompt and seed
照原樣再印|Regenerate original
這張還沒有圖。|No image generated yet.
原圖|Original
原圖不在了|Original missing
原檔不在了|Original file missing
ComfyUI 的輸出資料夾裡找不到這張，可能被刪掉了。|This file is missing from the ComfyUI output folder. It may have been deleted.
全部撤下|Discard all
撤下|Discard
撤下的|Discarded
撤下了一張|Image discarded
這張還在印，先按「停」|This image is generating. Press Stop first.
這張正在 Hires，先在圖上按「停」|This image is being upscaled. Press Stop on the image first.
這張正在 Hires，圖上可以停|Upscaling · Press Stop on the image to cancel.
換回原圖了|Original restored
複製 POS|Copy prompt
POS 複製好了|Prompt copied
複製不了，請點圖打開後手動選取|Copy failed. Open the image and select the prompt manually.
已複製|Copied
已複製 ✓|Copied ✓
複製了|Copied
複製|Copy
開原圖|Open original
收藏|Save
★ 收藏|★ Saved
★ 收藏的|★ Saved
★ 已收藏|★ Saved
☆ 收藏|☆ Save
★ 收藏過|★ Previously saved
★ 收進作品冊了|★ Saved to gallery
收藏中…|Saving…
這張已經在作品冊裡|This image is already saved.
這張已經在作品冊裡了|This image is already saved.
已經在作品冊裡（點一下打開）|Saved · Click to open
收進作品冊：存一份圖，ComfyUI 那邊的原圖刪了也還在|Save a copy in Gallery, independent of the original ComfyUI file
收進作品冊了|Saved to gallery
打開作品冊|Open gallery
去墨池|Open Ink Pool
去墨池抽幾張|Draw in Ink Pool
看合成池|View pinned cards
帶去墨池合成池|Send to Ink Pool
牌帶回墨池|Send cards to Ink Pool
你選的牌帶回墨池|Send pinned cards to Ink Pool
全部的牌帶回墨池|Send all cards to Ink Pool
帶過去了…|Opening Ink Pool…
從偏好卡牌拿掉|Remove from favorites
加入偏好卡牌|Add to favorites
加進偏好卡牌|Add to favorites
從廢字簍撿回來|Unblock card
丟進廢字簍（不再抽到）|Block card · Never draw it
拿出合成池|Unpin card
放進合成池|Pin card
點一下放進卡池|Add to layers
貼上的提示詞|Pasted prompt
多到少|Most used
少到多|Least used
出好圖|Most saved
常撤下|Most discarded
排序|Sort
只看用過的|Used only
日誌裡印好|Generated in history
共|Total
未使用|Unused
還沒用過|Never used
用過|Used
剛剛|Just now
名次|Rank
還沒上榜|Unranked
最近一次|Last used
最近|Recent
戰績|Performance
張圖用過它|images used this card
還沒進過任何一張圖|Not used in any image yet
讀不到出圖日誌|Generation history unavailable
這一區還排不出來|Not enough history to rank cards
出圖日誌還是空的|No generation history yet
還沒有使用紀錄|No usage history yet
還沒有使用紀錄。|No usage history yet.
去墨池抽幾張、或在疊印台付印一張，用到的牌就會記在這裡。|Draw in Ink Pool or generate in Fuse Bed to start tracking cards.
換個花色、清掉搜尋，或關掉「只看用過的」。|Try another category, clear search, or turn off Used only.
從現在起，墨池、疊印台印好的每一張都會記下來；收藏喜歡的、撤下不要的，這裡就排得出哪些牌常出好圖。|New generations are tracked here. Save images you like and discard others to rank your cards.
從現在起，墨池、疊印台每印好（或印壞）一張都會記在這裡，沒收藏的也查得到。|All new generations, including failures and unsaved images, appear here.
讀不到日誌：伺服器沒開、或還是舊版（重開一次伺服器）。|History unavailable. Start or restart the server.
讀不到統計：伺服器沒開、或還是舊版（重開一次伺服器）。|Statistics unavailable. Start or restart the server.
伺服器沒開、或還是舊版（重開一次伺服器）。|Start or restart the server.
日誌還是空的。|No generation history yet.
讀取日誌…|Loading history…
讀取統計…|Loading statistics…
還沒有成績。|No model statistics yet.
從現在起印的每一張都會記下用了哪個底模、哪些 LoRA；收藏喜歡的、撤下不要的，這裡就看得出哪個模型最合你。|New images track their checkpoint and LoRA. Save or discard results to compare model performance.
讀不到作品冊：伺服器沒開，或連不到主機|Gallery unavailable. Check that the server is running and reachable.
讀不到作品冊。|Gallery unavailable.
代表作在這一級分級看不到|Representative image hidden by your rating setting
還沒有印好的|No generated images yet
平均畫|Average generation
常配的牌|Frequently used cards
分輯|Group by
這一級分級看不到任何作品|No saved images visible at this rating
沒有圖|No image
這件作品不在作品冊裡了|This image was removed from the gallery.
收藏於|Saved on
從作品冊拿掉|Remove from gallery
再按一次：連存的圖一起刪|Press again to delete the saved image too
從卡盒拿出來|Remove from card box
放進卡盒|Add to card box
日誌裡還沒有用它印好的圖|No generated images with this card in history yet.
還沒有用到它的成品。從現在起印的每一張都會記下來，這裡就看得到。|No images with this card yet. New generations will appear here.
用它做過的圖|Images using this card
再多看一些|Load more
撤下過|Previously discarded
把卡盒存成牌組，或把牌組放進卡盒|Save the card box as a deck, or load a deck into it
收起卡盒|Close card box
按牌右下角的「＋」，把想用的牌放進來，再一起放進墨池。|Use + on a card to add it here, then send the whole box to Ink Pool.
全部放進墨池合成池|Send all to Ink Pool
卡盒（B）|Card box (B)
重新排序|Re-sort
原圖 ↔ Hires|Original ↔ Hires
分隔線：左邊原圖、右邊 Hires|Comparison divider · Original on left, Hires on right
在「符合視窗」和「1:1 實際像素」之間切換（雙擊圖也可以）|Switch between fit and actual pixels · Double-click the image
拖分隔線比較・雙指縮放・拖曳移動・點兩下 1:1|Drag to compare · Pinch to zoom · Drag to pan · Double-tap for 1:1
拖分隔線比較・滾輪放大・拖曳移動・雙擊 1:1|Drag to compare · Scroll to zoom · Drag to pan · Double-click for 1:1
關閉對比（Esc）|Close comparison (Esc)
讀取牌組…|Loading decks…
幫這組牌取個名字|Name this deck
牌組名字|Deck name
更新同名牌組|Update existing deck
存成牌組|Save deck
貼上提示詞變成牌…|Paste prompt as cards…
套用|Apply
更新了 ✓|Updated ✓
存好了 ✓|Saved ✓
讀不到牌組：伺服器沒開，或連不到主機。|Decks unavailable. Check that the server is running and reachable.
還沒有牌組。把常用的一組牌存起來，下次在墨池、疊印台一點就放回來。|Save your favorite combination as a deck to reuse it in Ink Pool or Fuse Bed.
試印|Proofs
試印 A～D|Proofs A–D
付印|Generate
付 印|Generate
預覽|Preview
還沒付印|Ready to generate
換一批|Redraw
同一批種子，每疊一張就重抽一次。|Same seeds. A fresh combination with every card.
同一批種子，每疊一張牌就重跑|Same seeds. Updated with each card.
晾紙繩|Recent images
晾紙|Recent images
付印的作品會夾在這條繩上。點一張可以回到它的版。|Generated images appear here. Click one to restore its layers.
引擎在選中的試印補的，點一下可以收下|Engine additions in this proof · Click to pin
牌角四點：四張試印有沒有收到它|Four corner dots show which proofs use this card.
換一批種子（R）|Redraw with new seeds (R)
回到卡池|Back to layers
往下到字盒挑牌|Scroll to card library
規則（尺寸、人物、時代、情境、每段補幾張）|Rules: size, cast, era, context and card counts
字盒裡的牌：點一下放進卡池，再點一下拿下來|Library cards · Click to add or remove
字盒裡的牌：點一下放進合成池，拖進廢字簍封鎖|Library cards · Click to pin, drag to blocked cards to exclude
偏好卡牌：挑最多十張常用的牌，攤在視窗底部，點一下就放上版|Keep up to 10 favorite cards in the tray. Click to add to layers.
偏好卡牌：挑最多十張常用的牌，攤在視窗底部，點一下就放進合成池|Keep up to 10 favorite cards in the tray. Click to pin.
把卡池存成牌組，或套用存過的牌組|Save or load a deck of cards
把合成池存成牌組，或套用存過的牌組|Save or load a deck of pinned cards
合成池：放進來的字每張圖都一定有|Pinned cards · Included in every image
抽牌（浮動）|Draw controls
一張牌一層墨：照花色疊進卡池，看引擎補了什麼再付印|Layer cards by category, inspect engine additions, then generate an image
每張牌用過幾次：多到少、少到多，點開看它的來歷|Explore card usage and performance
收藏的成品：大圖、用了哪些牌、帶回墨池再印|Saved images, their cards and reusable recipes
三分鐘的介紹影片（畫面、配樂即時產生）· Intro film|Three-minute intro film with live visuals and music
墨池與疊印台的使用教學影片 · How-to film|Learn Ink Pool and Fuse Bed
作品冊分頁|Gallery tabs
篩選日誌|Filter history
分輯：依什麼把作品分段|Group saved images
還沒有收藏的作品。|No saved images yet.
在墨池的成品、疊印台的作品上按「☆ 收藏」，就會收進這裡；圖另存一份，ComfyUI 那邊的原圖刪了也還在。|Press ☆ Save on any generated image. Gallery keeps its own copy, even if you delete the original ComfyUI file.
作品冊：點一張看大圖和用了哪些牌|Gallery · Click an image to see its cards
出圖日誌：印過的每一張，點一張看配方|Generation history · Click a row to see the recipe
模型成績單：每個底模、LoRA 印了幾張、收藏幾成|Model statistics · Image counts and save rates
在墨池抽牌、或在疊印台付印，用到的牌會記在這裡，越用越往前排。|Draw in Ink Pool or generate in Fuse Bed to track which cards you use most.
卡冊：點一張牌看它用過幾次|Card Book · Click a card for usage details
排字匣的卡牌版：把字拖進合成池，引擎抽牌補齊，每張圖底下攤開用了哪些牌。|Compose prompts with illustrated cards. Pin your choices, let the engine fill the rest, and see every card used in your images.
墨池的疊印台：牌照花色疊進六列卡池，引擎補的牌以影子排在旁邊；挑好一張試印再付印。|Layer illustrated cards across six categories, explore four proofs, and generate your favorite combination.
墨池的卡冊：每張牌進過幾張圖，多到少、少到多排開，點一張看它的來歷。|Explore the usage and performance of every card in your library.
墨池的作品冊：收藏的成品一張張攤開，點一張看大圖、用了哪些牌，把那組牌帶回墨池再印。|Browse saved images, inspect their cards, and reuse recipes in Ink Pool.
貼上一段提示詞，詞庫有的變成牌（電腦上也可以在空白處直接按 Ctrl+V）|Paste a prompt to find matching cards · Ctrl+V on the workbench also works
讀不到詞庫。請用 start.bat 開，而不是直接點 HTML。|Could not load the card library. Launch start.bat to start the server.
連不到主機，網路回來就接著印…|Disconnected. Generation will resume when the connection returns…
網路回來了，接著印|Reconnected · Resuming generation
連線中途斷了|Connection interrupted
連線斷了，重新接上…|Disconnected · Reconnecting…
連線斷了，重試幾次都接不回去|Could not reconnect after several attempts.
連續失敗三張，停下來了|Stopped after three consecutive failures.
連續失敗三張，停下來了：|Stopped after three consecutive failures:
等前面的印完|Waiting for earlier images
連不到主機：網路斷了，或伺服器沒開|Server unreachable. Check your connection and the server.
接回剛才那張…|Resuming the previous image…
排隊中|Queued
預覽中|Previewing
Comfy 報錯|ComfyUI error
Hires 中|Upscaling
去看|View
收起偏好卡牌|Collapse favorites
打開偏好卡牌|Open favorites
＋ 挑牌|+ Browse cards
挑好了（Esc）|Done (Esc)
點字盒裡的牌加進來，再點一次拿掉|Click a library card to add it; click again to remove.
偏好卡牌都在卡池裡了，從卡池拿下來就回到這裡。|All favorites are pinned. Remove a card from the layers to return it here.
點字盒裡的牌加進來，最多十張。|Click library cards to add up to 10 favorites.
把字盒的牌拖到這裡，或按「＋ 挑牌」。|Drag cards here or press + Browse cards.
放大並重畫細節（快速／深度）|Upscale and refine details · Fast or Detailed
在原圖上放大，再重畫一次細節。快，構圖不動。|Upscale the original and refine details. Fast, with the composition preserved.
在 latent 裡放大，再重畫一次細節。快，構圖不動。|Upscale in latent space and refine details while preserving the composition.
先用放大模型補細節，再輕輕重畫。慢一些，線條最乾淨。|Use an upscaling model, then gently refine. Slower, with cleaner lines.
先用放大模型補細節，再輕輕重畫。線條最乾淨。|Upscale with a model, then gently refine for cleaner lines.
倍率少一格|Decrease scale
倍率多一格|Increase scale
開始 Hires|Start upscale
Hires 方式|Upscale method
Hires：放大並重畫細節|Hires · Upscale and refine
這張已經太大，不能再放大。|This image is already at the maximum size.
還原原圖|Restore original
原圖不在了（ComfyUI 那邊刪掉了）|Original missing from ComfyUI
這張沒印成|This generation failed
今天|Today
昨天|Yesterday
印壞的|Failed
再往前翻|Load earlier
收集進度|Collection progress
成就|Achievements
成就牆|Achievements
看成就|View achievements
銅|Bronze
銀|Silver
金|Gold
白金|Platinum
一門到底|Category master
花色大全|Full spectrum
老朋友|Old favorite
親手挑|Hand picked
印刷工|Printmaker
收藏家|Collector
好眼光|Good eye
印好 40 張以上，收藏率到兩成五|Generate 40+ images with a save rate of at least 25%.
天天印|Daily practice
一日百張|Century day
夜貓|Night owl
達成|Complete
要出圖日誌（重開一次伺服器）|Requires generation history · Restart the server
全部撿回來|Unblock all
點左邊字盒的牌就丟進來，再點一次撿回去。這裡的字不會被抽到。|Click library cards to block them. Click again to unblock. Blocked cards are never drawn.
還是空的。點字盒裡不想看到的牌，或把牌拖進來。|No blocked cards. Click or drag library cards here to exclude them.
點一下撿回去|Click to unblock
會變成牌|Matching cards
詞庫沒有（略過）|Unknown tags · Skipped
畫質、評分詞（引擎自己會加）|Quality and score tags · Added by the engine
LoRA（不是牌，請到「選 LoRA」選）|LoRA · Choose these in the LoRA panel
不是牌（引擎自己處理）|Other tags · Managed by the engine
不收（禁用的字）|Blocked tags
一張牌都對不上。|No matching cards found.
貼上提示詞變成牌|Paste prompt as cards
換成這些牌|Replace with these cards
貼上一段提示詞：1girl, (black_hair:1.2), school uniform, classroom…|Paste a prompt: 1girl, (black_hair:1.2), school uniform, classroom…
工作流|Workflow
工作流：內建|Workflow: Built-in
匯入 API JSON…|Import API JSON…
拖進來或點這裡選檔|Drop a file here or click to browse
ComfyUI 網址|ComfyUI URL
存位址|Save URL
內建|Built-in
排字匣那套 Illustrious 流程|Built-in Illustrious workflow
匯入的 API workflow|Imported API workflow
取樣參數|Sampling parameters
全部恢復預設|Reset all defaults
取樣參數都回到預設了。|Sampling parameters reset to defaults.
改過的會描一道底線；清空欄位或改回預設值就回到預設。|Changed values are underlined. Clear a field or enter its default to reset it.
正向、負向、LoRA 都由排字匣組裝。|Danbooru Case builds the positive prompt, negative prompt and LoRA inputs.
至少選一個正向節點才能生圖。|Select a positive prompt node to generate images.
建議|Suggested
不改，保留 workflow 原值|Keep workflow value
這張圖沒有 LoRA 節點。|This workflow has no LoRA nodes.
不改，保留 workflow 裡的 LoRA|Keep workflow LoRA
最多對兩個 LoRA 節點，跟排字匣槽數一樣。|Map up to two LoRA nodes to the two slots.
刪掉這套|Delete workflow
存不起來|Could not save
已存。|Saved.
還要選正向節點。|Select a positive prompt node.
正向／負向不能是同一個節點，另一邊改成不改。|Positive and negative prompts need different nodes. The other selection was reset.
讀不到，已改回內建。|Workflow unavailable. Switched to built-in.
選右邊一個 CLIP 節點。|Select a CLIP node on the right.
讀不到 ComfyUI 設定|ComfyUI settings unavailable
ComfyUI 網址存不起來|Could not save the ComfyUI URL
ComfyUI 網址已儲存。|ComfyUI URL saved.
匯入中…|Importing…
匯入失敗|Import failed
已匯入。選 tags 要寫進哪個節點。|Imported. Select the node to receive your tags.
JSON 太大（上限 5 MB）。|JSON file too large · Maximum 5 MB.
不是有效的 JSON。|Invalid JSON.
刪掉這套自己匯入的 workflow？內建還在。|Delete this imported workflow? The built-in workflow will remain available.
刪除失敗|Delete failed
已刪除，改回內建。|Deleted. Switched to built-in.
請拖入 .json 檔。|Drop a .json file.
沒選就是內建。要自己的圖，匯入 ComfyUI「匯出工作流 (API)」的 JSON。|Use the built-in workflow, or import a JSON file from ComfyUI's Export (API).
目前用的是自己的工作流：生圖照它圖裡的 steps／CFG，這裡的「生圖」那一行不套用。Hires 一律用這裡的。|Your imported workflow controls generation steps and CFG. The Hires settings below still apply.
下面三欄決定排字匣要改哪些節點。沒選的會保留 workflow 原值。|Map the nodes below. Unselected nodes keep their original workflow values.
每張都用這顆種子生圖；抽牌照樣每張隨機|Use this generation seed for every image; card draws remain random.
每張隨機。填一個數字就固定下來|Random seed per image. Enter a number to use a fixed seed.
種子模式|Seed mode
固定的生圖種子|Fixed generation seed
換一顆新的固定種子|Choose a new fixed seed
用這顆種子固定生圖|Use this seed for generation
選 LoRA|LoRA
選 LoRA（L）|Choose LoRA (L)
設定：底模|Checkpoint settings
設定底模|Choose checkpoint
設定|Settings
快捷鍵|Keyboard shortcuts
快捷鍵介紹|Keyboard shortcuts
關閉 (Esc)|Close (Esc)
LoRA 清單載入失敗：|Could not load LoRA:
(根目錄)|Root folder
找不到 LoRA|No LoRA found
‹ 上一頁|‹ Previous
下一頁 ›|Next ›
未選擇|Not selected
詳情|Details
基礎模型（來自 metadata.json）|Base model · From metadata
觸發詞|Trigger words
LoRA 強度|LoRA strength
LoRA 清單還沒載入或是空的|LoRA list is empty or still loading.
隨機瀏覽 LoRA（點一張直接選中）|Browse random LoRA · Click to select
隨機瀏覽|Random browse
搜尋 LoRA…|Search LoRA…
用 LoRA Manager 管理（新分頁）|Open LoRA Manager in a new tab
目前選擇|Current selection
搜尋底模…|Search checkpoints…
隨機瀏覽 LoRA|Browse random LoRA
點任一張直接選中並返回；Esc 關閉|Click to select and return · Esc to close
焦點在輸入框時不會觸發。Esc 只關最上面那層。|Shortcuts are disabled while typing. Esc closes the topmost panel.
LoRA／底模|LoRA / Checkpoint
還沒選底模——從左邊清單點一個|Select a checkpoint from the list on the left.
這個資料夾沒有 checkpoint|No checkpoints in this folder
生圖會用這顆底模。|Generation uses this checkpoint.
在 LoRA Manager 開（新分頁）|Open in LoRA Manager · New tab
在 LoRA Manager 開這個 LoRA 的完整詳情（新分頁）|View LoRA details in LoRA Manager · New tab
在 Civitai 開這個 LoRA 的頁面（新分頁）|Open this LoRA on Civitai · New tab
個 Danbooru tag · 每個都有中文|Danbooru tags, each with a Chinese name
種花色 ＝ 六條旋臂|suits = six spiral arms
同一格只留一張|One card per slot
伺服器|Server
你的電腦|Your computer
秒內斷線都接得回來|seconds: a dropped connection picks up again
開源 · 自由改|Open source · Change anything
看中文、送英文，規則替你把關|Pick cards by name. ComfyUI gets checked Danbooru tags.
每個字都是一張牌，放進去的一定有|Every tag is a card. Pinned cards always make it in.
一張牌一層墨，看得見引擎補了什麼|One card per ink layer. See what the engine adds.
張牌面，每一張都是 ComfyUI 畫的|card faces, every one painted by ComfyUI
墨池 與 疊印台|Ink Pool and Fuse Bed
墨池　放牌 · 規則 · 抽圖 · 成品牆|Ink Pool · Pin · Rules · Draw · Results
疊印台　疊層 · 影子 · 試印 · 付印|Fuse Bed · Layers · Shadows · Proofs · Generate
從字盒挑牌，或用下面的起手式；留白的層由引擎補上。|Choose cards from the library or try a starter below. The engine fills empty layers.
卡面插畫|Card art
烘焙卡面|Bake card art
敏感、色情卡面|Sensitive and explicit card art
Hires 放大模型|Hires upscale model
安裝|Install
這次不要|Not now
不要再問|Never ask
烘|Bake
重開 ComfyUI|Restart ComfyUI
重新整理看新圖|Reload for new art
第一次使用的準備|First-time setup
ComfyUI 重開中，大約半分鐘|ComfyUI is restarting. This takes about half a minute.
已載入|Loaded
下載失敗|Download failed
安裝失敗|Installation failed
烘焙失敗|Baking failed
從 GitHub 下載全年齡卡面（約 100 MB）|Downloading the all-ages card art from GitHub (about 100 MB)
下載好了：重新整理網頁就有圖|Downloaded. Reload the page to see the art.
烘好了：重新整理網頁就有圖|Baked. Reload the page to see the art.
等 ComfyUI 開起來|Waiting for ComfyUI to start
ComfyUI 在別台電腦：請在那台裝 LoRA Manager|ComfyUI runs on another computer. Install LoRA Manager there.
ComfyUI 在別台電腦：這台不動它|ComfyUI runs on another computer. Nothing is installed from here.
安裝到 ComfyUI 的 custom_nodes|Installing into ComfyUI's custom_nodes
裝好了，重開 ComfyUI 才會生效|Installed. Restart ComfyUI to load it.
找不到 ComfyUI 的資料夾|ComfyUI folder not found
下載到 ComfyUI 的 upscale_models（約 18 MB）|Downloading into ComfyUI's upscale_models (about 18 MB)
選用：ComfyUI 節點＋OpenPose 模型，約 2.5 GB，裝完要重開 ComfyUI|Optional: a ComfyUI node and an OpenPose model, about 2.5 GB. Restart ComfyUI afterwards.
安裝節點、下載模型（約 2.5 GB）|Installing the node and downloading the model (about 2.5 GB)
另一個視窗正在烘|Already baking in another window
用你的 ComfyUI 烘還沒有的全年齡卡面|Baking missing all-ages cards with your ComfyUI
用你的 ComfyUI 烘敏感、色情卡面|Baking sensitive and explicit cards with your ComfyUI
不在公開下載包裡；用你的底模烘約 600 張，要一小時以上|Not in the public download. Baking about 600 cards with your checkpoint takes over an hour.
不再問（刪掉 .no-pose-fetch 就會再問）|Will not ask again (delete .no-pose-fetch to be asked)
這次先不要|Skipped for now
現在不用回答這一項|Nothing to answer for this item now
ComfyUI 還有圖在畫，畫完再重開|ComfyUI is still generating. Restart it when it finishes.
ComfyUI-Manager 不讓重開（或沒裝）：請自己重開 ComfyUI|ComfyUI-Manager cannot restart ComfyUI here. Restart ComfyUI yourself.
LoRA：ComfyUI 沒有回報任何 LoRA|LoRA: ComfyUI reported no LoRAs.
底模清單載入失敗：|Could not load checkpoints:
找不到底模|No checkpoints found
ComfyUI 沒有回報 checkpoint|ComfyUI returned no checkpoints.
清單來自 ComfyUI。點左邊換一顆，生圖用目前這顆。|Models come from ComfyUI. Select one on the left; new images use the current model.
這個資料夾沒有 checkpoint。連上 ComfyUI 後會改問它要清單。|No checkpoints in this folder. Connect to ComfyUI to load its model list.
生圖|Generate
快速 Hires|Fast Hires
深度 Hires|Detailed Hires
連線逾時，請確認伺服器或 ComfyUI 是否仍有回應。|Connection timed out. Check that the server and ComfyUI are responding.
（空）|(Empty)
正常|Consistent
多元|Varied
奇葩|Experimental
髮長|Hair length
眼睛|Eyes
髮型|Hairstyle
身材（女）|Body · Female
身體姿勢|Body pose
表情|Expression
鏡頭|Camera
視線|Gaze
地點|Location
室內外|Indoor / Outdoor
晝夜|Time of day
光線|Lighting
連身／套裝|One-piece / Outfit
腿襪|Legwear
飾品|Accessories
鞋履|Footwear
上衣|Tops
下身|Bottoms
外套|Outerwear
內衣|Underwear
姿勢參考|Pose reference
不用|Off
輕|Light
中|Medium
強|Strong
自己擺|Edit skeleton
上傳|Upload
參考圖|Reference image
底圖|Background image
起手式|Starter presets
自訂工作流不套用|Unavailable with custom workflows
姿勢參考：人物照這張圖的姿勢擺（點一下換或拿掉）|Pose reference enabled · Click to replace or remove
姿勢參考：挑一張圖，人物照它的姿勢擺|Choose a reference image for your character's pose
人物會照參考圖的姿勢擺；臉、衣服、場景還是照牌。只套在內建工作流。|Use a reference for the pose; cards still control appearance, clothing and scene. Built-in workflow only.
照著擺的強度|Pose strength
你擺的姿勢|Your skeleton pose
抓到的骨架|Detected skeleton
骨架沒抓到|No skeleton detected
抓骨架中…|Detecting skeleton…
還沒選。從下面挑一張，或上傳一張照片。|Choose an image below, or upload a photo.
改這個姿勢|Edit this pose
打開姿勢編輯器|Open pose editor
處理參考圖…|Processing reference…
好了：之後印的都照這個姿勢。|Pose enabled for future generations.
存姿勢…|Saving pose…
好了：之後印的都照你擺的姿勢。|Your skeleton pose is enabled for future generations.
把這張參考圖抓到的骨架放進編輯器，自己再調|Open the detected skeleton in the editor
拿這張的骨架來改|Edit detected skeleton
抓骨架中…（第一次會久一點）|Detecting skeleton… First use may take longer.
沒抓到人：從站姿開始，對著底圖擺。|No person detected. Start with a standing pose and use the image as a guide.
上傳一張圖當姿勢參考|Upload a pose reference
上傳一張|Upload image
拿掉了：之後印的不照姿勢。|Pose reference removed.
不用姿勢|Disable reference
照這張的姿勢|Use this pose
讀取作品冊…|Loading gallery…
作品冊裡還沒有（這一級分級看得到的）作品。|No gallery images visible at this rating.
照片、截圖都可以；網頁會先縮小再傳|Use a photo or screenshot. Images are resized before upload.
最近印的|Recent generations
這裡還沒有印好的。|No generated images here yet.
拖骨架擺姿勢，有起手式可以套；可以擺 2～3 個人。選了參考圖，可以拿它的骨架來改|Drag joints or use a preset for up to 3 people. You can also edit a skeleton detected from your reference.
姿勢：拖骨架上的點來擺|Pose · Drag joints to adjust
拖骨架上的點來擺（繞著上一節轉，長度不變；按住 Shift 可以拉長縮短）；拖空白處移動整個人。紅橘那側是人物的右手（畫面左邊）。|Drag joints to rotate limbs. Hold Shift to change length. Drag empty space to move the person. Orange marks their right side.
顯示這一點|Show joint
藏起這一點|Hide joint
側身、背面看不到的點（耳朵、眼睛、被擋住的手）藏起來，畫出來就沒有它|Hide joints that are occluded in a side or back view.
回到上一步（Ctrl Z）|Undo (Ctrl+Z)
＋加一個人|+ Add person
刪掉這個人|Delete person
刪掉選到的人|Delete selected person
長度不變|Lock limb length
開：拖的點繞著上一節轉，手腳不會被拉長縮短。關（或拖的時候按住 Shift）：整段平移，可以拉長縮短|On: rotate joints with fixed limb lengths. Off, or hold Shift: move joints freely.
開：拖手肘時前臂和手跟著動。關：只動那一點|On: connected limbs follow the joint. Off: move only the selected joint.
連動|Move connected joints
參考圖淡淡墊在底下對照（送出去的骨架不會有它）|Show a faint reference behind the skeleton. It is excluded from the exported pose.
鏡像|Mirror
左右翻過來|Flip horizontally
往左轉|Rotate left
往右轉|Rotate right
縮小|Zoom out
整個人縮小|Scale person down
放大|Zoom in
整個人放大|Scale person up
拉回中間|Center
選到的人放回畫面中間（太大就縮到放得下）|Center the selected person and fit them inside the canvas
調整|Transform
用這個姿勢|Use this pose
鼻子|Nose
脖子|Neck
右肩|Right shoulder
右手肘|Right elbow
右手腕|Right wrist
左肩|Left shoulder
左手肘|Left elbow
左手腕|Left wrist
右髖|Right hip
右膝|Right knee
右腳踝|Right ankle
左髖|Left hip
左膝|Left knee
左腳踝|Left ankle
右眼|Right eye
左眼|Left eye
右耳|Right ear
左耳|Left ear
站|Standing
叉腰|Hands on hips
舉雙手|Arms raised
揮手|Waving
抱胸|Arms crossed
手托臉|Hand on cheek
雙手背後|Hands behind back
走|Walking
跑|Running
坐|Sitting
跪坐|Kneeling
蹲|Crouching
躺|Lying
每一頁|Every page
在輸入框裡打字時不會觸發。|Shortcuts are disabled while typing.
快捷鍵（?）|Keyboard shortcuts (?)
游標跳到找牌（找作品）的框|Focus search
關掉最上面那一層（彈窗、選單）|Close the topmost dialog or menu
打開這份說明|Open keyboard shortcuts
滾輪|Scroll
滑鼠停在牌上一下再滾：調份量（一格一檔）|Hover a card and scroll to adjust its weight
焦點在牌上：加重、減輕|Focused card: increase or decrease weight
焦點在牌上：份量回到 1.0|Focused card: reset weight to 1.0
抽牌|Draw
抽牌、生圖進行中：停下來|Stop drawing or generating
提示上有「復原」時：復原（清空合成池、撤下成品…）|Undo the action shown in the toast
在頁面空白處：把剪貼簿的提示詞貼成牌|Paste a prompt as cards on the workbench
在找牌的框：把第一張放進合成池|In search: pin the first matching card
在找牌的框：走進字盒|In search: move focus into the library
在字盒裡移動；最上面一排按 ↑ 回到找牌的框|Navigate the library; ↑ from the top row returns to search
合成池的牌|Pinned cards
試印與付印|Proofs and generation
選試印 A～D|Choose proof A–D
換一批試印|Redraw proofs
撤回（Ctrl Z 也可以）|Undo · Ctrl+Z also works
卡池的牌|Layer cards
拿下來|Remove
打開、收起卡盒|Open or close card box
在找牌的框：打開第一張|In search: open the first matching card
在找牌的框：清空|In search: clear query
在找作品的框：清空|In gallery search: clear query
開選 LoRA 大面板|Open LoRA panel
開設定（底模）|Open checkpoint settings
面板開著時切 LoRA 1／LoRA 2|Switch LoRA slot while the panel is open
面板開著搜 LoRA，否則搜詞庫|Search LoRA in the panel, otherwise search cards
詞庫|Card library
焦點在字牌上時開權重（再按一次關）|Toggle weight control for the focused card
權重開著時加減 0.1|Change weight by 0.1
無限抽：開始／停下|Start or stop continuous generation
生圖／大圖|Generation / Image viewer
沒開疊層時曝光生圖；疊層開著時關閉|Generate when no panel is open; otherwise close the panel
關閉最上層（說明／大圖／LoRA）|Close the topmost panel
大圖切上一張／下一張|Previous or next image in the viewer
新手導覽|Quick tour
一步一步帶你走一遍，邊看邊操作，大約一分鐘。|Learn by doing. This guided tour takes about a minute.
開始導覽|Start tour
不用了|Maybe later
上一步|Back
下一步|Next
跳過這步|Skip step
結束導覽|End tour
結束導覽（Esc）|End tour (Esc)
✓ 做到了！|✓ Done!
歡迎來到墨池|Welcome to Ink Pool
字盒：所有的牌|Your card library
放一張牌進合成池|Pin your first card
點字盒裡的牌，它就會飛進右邊的合成池。|Click a library card to pin it in the pool.
點任何一張牌（例如「長髮」）。|Click any card, such as long hair.
打開字盒|Open the library
按「挑牌」。|Press Browse cards.
挑一張牌|Choose a card
挑好了|Finish choosing
可以一次挑好幾張。挑完按「完成」收起字盒。|Choose as many cards as you like, then press Done.
按「完成」。|Press Done.
底模與 LoRA|Checkpoint and LoRA
其他房間|Explore the workbench
準備好了|Ready to create
歡迎來到疊印台|Welcome to Fuse Bed
疊一張牌上去|Add your first layer
點字盒裡的牌，它就疊上中間的卡池。|Click a library card to add it to the layers.
點任何一張牌。|Click any card.
手機上字盒收在「挑牌」裡。|On your phone, press Browse cards to open the library.
點一張牌，它就疊上卡池。|Click a card to add it to the layers.
挑完按「完成」收起字盒。|Press Done to close the library.
點另一個試印（例如 B）。|Choose another proof, such as B.
尺寸、畫面裡有誰、時代、尺度、姿勢參考都在這顆鈕裡。|Set size, characters, era, content level and pose reference here.
歡迎來到卡冊|Welcome to Card Book
看一張牌|Inspect a card
點一張牌，打開它的詳情。|Click a card to open its details.
牌的詳情|Card details
看完按右上的 ✕ 關掉。|Press ✕ in the corner to close.
每個花色的收集進度和成就。只看不擋：沒解鎖的牌照樣能用。|Track collection progress and achievements. All cards remain available regardless of achievements.
就是這樣|You're ready
之後想再看一次，按頂欄的「導覽」。|Press Tour in the header to see this again.
歡迎來到作品冊|Welcome to Gallery
收藏的作品、印過的每一張、每個模型的成績都在這裡。|Your saved images, generation history and model performance live here.
三個分頁|Three views
找|Search
打牌名、提示詞、底模都找得到。|Search by card name, prompt or checkpoint.
看日誌|Explore history
點「日誌」。|Press History.
篩選|Filters
墨池是「抽牌生圖」的地方：你挑幾張想要的牌，其他的交給引擎補，按一下就送去 ComfyUI 畫。跟著做一次就會了。|Pin the cards you want, let the engine fill the rest, then generate with ComfyUI. Let's try it.
每張牌是一個元素：髮色、服裝、姿勢、場景…。上面可以打字找（中文、英文都可以），或按花色篩選。|Each card is an element: hair, outfit, pose or scene. Search in English or Chinese, or filter by category.
手機上字盒收在這顆「挑牌」裡：所有的牌（髮色、服裝、姿勢、場景…）都在裡面。|Browse cards opens your library of hair, outfits, poses and scenes.
點一張牌，它就收進下面的合成池。上面可以打字找，或按花色篩選。|Click a card to pin it. Search or filter by category to find more.
放進來的牌，每一張圖都一定會有。點牌看詳情；滑鼠停在牌上滾輪（或按 ＋／−）調份量，數字在牌的右下角。不要了再點一次字盒裡那張。|Pinned cards appear in every image. Click for details; scroll or use + / − to adjust weight. Click the library card again to remove it.
尺度、時代、畫面裡有誰、姿勢參考。按「更多規則」還有尺寸、每段抽幾張。不確定就先用預設。|Set content level, era, characters and pose reference. More rules controls size and card counts. Defaults are a good starting point.
頂欄右邊可以換底模（畫風的基礎）、加 LoRA。不確定就先用預設的。|Choose your checkpoint and LoRA in the header. Start with the defaults if you're unsure.
按下去：引擎照規則補齊其他牌，送 ComfyUI 畫。「一次」可以一次印好幾張；「只抽牌」只看抽到什麼、不畫。|Draw & generate fills the remaining cards and sends the prompt to ComfyUI. Set Batch for multiple images, or Draw only to inspect cards first.
畫好的會出現在這下面：點開看大圖、☆ 收藏進作品冊、Hires 放大、不要的撤下。印的時候頂欄也看得到進度。|Results appear below. Open an image, save it to Gallery, upscale with Hires, or discard it. Progress also appears in the header.
疊印台：一層層疊牌，先看四張試印再付印。卡冊：每張牌用過幾次、成就。作品冊：收藏的、印過的每一張。每個房間都有自己的導覽。|Fuse Bed lets you layer cards and choose from four proofs. Card Book tracks usage. Gallery stores images and history. Each page has its own tour.
挑幾張牌、按「抽並生圖」試試看吧！之後想再看一次，按頂欄的「導覽」。|Pin a few cards and press Draw & generate. You can restart this tour from the header.
疊印台是「先看再印」：你一張張把牌疊上卡池，引擎同時補出四種組合（試印 A～D），挑你喜歡的那個再付印。|Layer your cards, inspect four combinations in proofs A–D, then generate your favorite.
所有的牌都在這。點一下放上卡池，再點一下拿下來；上面可以打字找。|Search your library here. Click a card to add it to the layers; click again to remove.
你疊上的牌照花色排好，每一張都會進付印的圖。還空著時，可以點起手式或你的牌組直接套用；右上有撤回、清版。|Your cards are grouped by category and included in every image. Start with a preset or deck, or use Undo and Clear layers.
引擎用你的牌補出四種組合，圓圈是它補進來的牌。點一格看它的組合；「換一批」整批重抽。|The engine creates four combinations. Dots show its additions. Choose a proof to inspect it, or Redraw for a new set.
選好了按「付印」，送 ComfyUI 畫。畫的時候可以接著疊下一版。|Press Generate to send your proof to ComfyUI. You can keep composing while it runs.
印好的作品夾在這條繩上；點一張回到它當時的版，也可以收藏、Hires 放大。|Recent images appear here. Click one to restore its layers, save it or upscale with Hires.
疊幾張牌、挑一個試印、按「付印」試試看吧！之後想再看一次，按頂欄的「導覽」。|Add a few cards, choose a proof and press Generate. Restart this tour from the header any time.
卡冊是你的牌的紀錄：每張牌用過幾次、印出來好不好、收集了多少。|Explore how often you use each card, how it performs and your collection progress.
按花色篩選。花色圖章外圈那一圈，是這個花色點亮（用過）了幾成。|Filter by category. Each ring shows the proportion of cards you've used.
多到少、少到多；「出好圖」「常撤下」看哪些牌常出好圖、哪些常被你撤下（要先印一陣子才排得出來）。|Sort by usage or by save and discard rates. Generate some images first to build a useful ranking.
用過幾次、戰績、用它做過的圖都在這裡；可以帶去墨池，或放進卡盒。|See usage, performance and images for this card. Send it to Ink Pool or collect it in your card box.
邊逛邊把牌收進卡盒（牌上的 ＋），收好一次帶去墨池，或存成牌組。|Use + to collect cards in the box. Send them to Ink Pool together, or save them as a deck.
作品＝你收藏的；日誌＝印過的每一張（沒收藏的也查得到）；模型＝每個底模、LoRA 的成績。|Saved contains your favorites. History tracks every generation. Models compares checkpoints and LoRA.
依時代、髮色、服裝、場景把作品分段。點一件作品看大圖、用了哪些牌、相似的作品，也能把牌帶回墨池。|Group images by era, hair, outfit or scene. Open an image to inspect its cards, find similar images or reuse its recipe.
日誌記著印過的每一張：時間、從哪一頁送的、花多久、有沒有收藏。|History records every generation: time, source page, duration and whether you saved it.
只看收藏的、撤下的、印壞的、Hires。點一列看配方，可以補收藏、把牌帶回墨池。|Filter saved, discarded, failed or upscaled images. Open a row to inspect its recipe, save it or reuse the cards.
使用教學|Tutorial
排字匣 · 介紹影片 Intro|Danbooru Case · Intro film
墨池 · 疊印台 · 使用教學|Ink Pool · Fuse Bed · Tutorial
排字匣 · Danbooru case|Danbooru Case
排字匣 · 墨池 · 疊印台|Danbooru Case · Ink Pool · Fuse Bed
墨池 & 疊印台 · How to|Ink Pool & Fuse Bed
墨池 · 疊印台 · How to|Ink Pool · Fuse Bed · How to
選版本 · Version|Choose film
選影片 · Film|Choose film
完整版 3:00|Intro film 3:00
介紹影片 3:00|Intro film 3:00
使用教學 4:30|Tutorial 4:30
準備中 · Loading…|Loading…
好了 · Ready|Ready
播放 Play|Play
暫停 Pause|Pause
再播一次 Replay|Replay
畫面、配樂都是這一頁即時產生的 · Picture and score are generated live in this page|Visuals and music are generated live in your browser.
看完就會用：放牌、規則、抽牌、生圖，到疊印台的試印、付印、晾紙 · Every feature, step by step|Learn to pin cards, set rules, draw and generate, then explore proofs and layers in Fuse Bed.
建議開聲音、全螢幕 · 空白鍵 暫停 · ← → 快轉 · F 全螢幕 · M 靜音  /  Sound on · Space pause · ← → seek · F fullscreen · M mute|Sound on · Space to pause · ← → to seek · F for fullscreen · M to mute
排字匣、墨池、疊印台的三分鐘介紹影片：畫面與配樂都是這一頁即時產生的。|A three-minute introduction to Danbooru Case, Ink Pool and Fuse Bed, with live visuals and music.
墨池與疊印台的使用教學影片：從放第一張牌到付印晾紙，畫面與配樂都是這一頁即時產生的。|Learn Ink Pool and Fuse Bed, from your first card to a finished image.
`;

export const messages = Object.freeze(Object.fromEntries(copy.trim().split("\n").map((line) => {
  const split = line.indexOf("|");
  return [line.slice(0, split), line.slice(split + 1)];
})));

// {0} is translated again (card names, ratings); {0!} is inserted verbatim
// because it is user content: deck, work, model and workflow names, search text.
const parameterized = String.raw`
繪製 {0}/25 · ComfyUI 即時預覽|Generating {0}/25 · ComfyUI live preview
第 {0} 張|Image {0}
卡面 ✓ {0} 張|Card art ✓ {0} cards
排星河 {0}/{1} · Building the galaxy|Building the galaxy {0}/{1}
載入插畫 {0}/{1} · Loading art|Loading art {0}/{1}
分級：全年齡 {0} → 敏感 {1} 張|Rating: General {0} → Sensitive {1} cards
清空了 {0} 張|Cleared {0} cards
Hires 深度 {0}× · {1}/20|Detailed upscale {0}× · {1}/20
Hires 深度 {0}×|Detailed upscale {0}×
印製中 {0}/25|Generating {0}/25
補 {0} 現代|+{0} · Modern
{0} 張在{1}看不到|{0} images hidden at {1} rating
{0} 件在{1}看不到|{0} saved images hidden at {1} rating
畫面沒有人物：{0}拿下來了|No characters · Removed {0}
同一格只留一張：{0}換成「{1}」|One per slot · Replaced {0} with “{1}”
{0}跟「{1}」不是同一個時代，先拿下來了|Removed {0}: different era from “{1}”
（還有 {0} 組）|({0} more conflicts)
「{0}」跟「{1}」同時成立不了，引擎會摘掉其中一個{2}|“{0}” conflicts with “{1}”. The engine will remove one{2}.
Hires 好了：{0}×{1}|Upscale ready · {0}×{1}
印製中，還有 {0} 張|Generating · {0} remaining
牌 · {0}|Cards · {0}
拖進合成池就釘住，丟進廢字簍就封鎖|Drag to pin or block
Hires {0}×{1}（原圖 {2}×{3}）|Upscale {0}×{1} (original {2}×{3})
{0}：{1} {2} 張，合成池共 {3} 張|{0} · {1} {2} cards · {3} pinned in total
整體收藏 {0}%|Overall save rate {0}%
撤下 {0}%|Discard rate {0}%
印過 {0} 張，收藏 {1} 張、撤下 {2} 張{3}|{0} generated · {1} saved · {2} discarded{3}
，第 {0} 名| · Rank #{0}
一張牌要在 {0} 張以上印好的圖裡出現過才排：換個花色、清掉搜尋，或多印幾張、收藏喜歡的、撤下不要的。|Cards are ranked after appearing in at least {0} generated images. Try another category, clear the search, or generate more images and save your favorites.
最近 {0}|Last used {0}
收藏 {0}（{1}%）|{0} saved ({1}%)
撤下 {0}（{1}%）|{0} discarded ({1}%)
{0}的成品{1}，{2}，點一下放大|{0} result {1} · {2} · Click to enlarge
先看 {0} 張|Showing {0} images
{0}的成品|{0} result
{0}放進卡盒了（{1} 張）|{0} · Added {1} cards to the card box
開啟 Hires 對比：原圖 {0}×{1}，Hires {2}×{3}|Compare original {0}×{1} with upscale {2}×{3}
{0}×{1} → {2}×{3}・點開左右拉動比較|{0}×{1} → {2}×{3} · Click to compare with a slider
原圖 {0}×{1}|Original {0}×{1}
Hires 對比：原圖 {0}×{1}，Hires {2}×{3}|Compare original {0}×{1} with upscale {2}×{3}
（{0} 張詞庫裡已經沒有）|({0} cards no longer in the library)
Discord 設定（自動傳送{0}）|Discord settings (auto sharing {0})
{0}抽不到它|Excluded at {0} rating
放上「{0}」|Layered “{0}”
帶上{0}|Included {0}
拿下「{0}」{1}|Removed “{0}”{1}
，連同它帶上來的{0}|, along with {0}
{0}：{1}，疊上{2}|{0} · {1} · Layered {2}
撤回：{0}|Undo · {0}
付印試印 {0}|Generate proof {0}
尺度切回「{0}」|Rating restored to {0}
回到這一版{0}{1}|Composition restored{0}{1}
印製中 {0}%|Generating · {0}%
試印 {0} 的成品，點開看大圖|Proof {0} result · Click to enlarge
試印 {0} 的成品|Proof {0} result
試印 {0}：{1}|Proof {0} · {1}
沒進這張：{0}|Not included: {0}
缺 {0}|Missing {0}
，有 {0} 張你的牌沒進去| · {0} pinned cards excluded
收起{0}的影子|Collapse {0} additions
再看 {0} 張引擎補的{1}|Show {0} more {1} additions
{0}（{1}）：你的 {2} 張{3}|{0} ({1}) · {2} pinned{3}
，引擎補 {0} 張| · {0} engine additions
{0}的牌在{1}都出不了|{0} has no cards available at {1} rating.
（{0} 張這一級出不了或在廢字簍，先跳過）|({0} unavailable or blocked cards skipped)
{0}出不了，會跳過|Unavailable at {0}; will be skipped
，{0}/{1} 張試印有它：{2}| · In {0}/{1} proofs: {2}
{0}（{1}）{2}{3}。Enter 看選項，Delete 拿掉|{0} ({1}){2}{3}. Enter for options, Delete to remove
跟著「{0}」上來|Included with “{0}”
{0}（{1}）：引擎在試印 {2} 補的。Enter 看選項，可以收下|{0} ({1}) · Added by the engine in proof {2}. Enter for options or to pin
相剋：「{0}」跟「{1}」同時成立不了，引擎會擠掉其中一個|Conflict: “{0}” and “{1}” cannot coexist. The engine will remove one.
呼應：「{0}」配「{1}」，這個地方做這件事剛好|Related: “{0}” and “{1}” suit the same setting.
{0}/{1} 張試印有它；其他張{2}|In {0}/{1} proofs · Others: {2}
跟著「{0}」上來的|Included with “{0}”
帶上了「{0}」|Includes “{0}”
跟「{0}」|With “{0}”
跟「{0}」同時成立不了|Conflicts with “{0}”
試印 {0} 補的。收下就固定在版上，每張都會有|Added in proof {0}. Pin it to include it in every proof.
晾紙繩上有 {0} 張的原檔被刪了|{0} result images have missing originals
這張沒收到：{0}|Excluded from this proof: {0}
試印 {0} 的 POS|Proof {0} prompt
試印 {0}・{1}・你的 {2} 張牌。點開看，或回到這一版|Proof {0} · {1} · {2} pinned cards. Open or restore the composition.
試印 {0}・{1}|Proof {0} · {1}
{0}/{1} 張試印有它|In {0}/{1} proofs
{0}：{1}。點一下回{2}|{0} · {1}. Click to return to {2}
第 {0} 個人的|Person {0} ·
（藏起來了）|(hidden)
目前走 webhook · {0}|Webhook · {0}
目前走 bot · token {0} · {1}|Bot · token {0} · {1}
還沒套用 —— 按下面的「存設定」才會換成{0}。{1}|Pending changes. Save settings to switch to {0}. {1}
已存 · {0}|Saved · {0}
一張圖只留一個：跟{0} 等 {1} 個互斥|One per image · {1} cards share this slot, including {0}
一張圖只留一個：跟{0}互斥|One per image · Conflicts with {0}
試印 {0}：你的 {1} 張，引擎補 {2} 張|Proof {0} · {1} pinned · {2} engine additions
試印 {0}：引擎補 {1} 張，{2}|Proof {0} · {1} engine additions · {2}
預覽試印 {0}：引擎補 {1} 張・點一下換過去|Preview proof {0} · {1} additions · Click to select
補 {0}|+{0}
換到試印 {0}|Switch to proof {0}
方 {0}|Square {0}
直 {0}|Portrait {0}
橫 {0}|Landscape {0}
{0} / {1} 種|{0} / {1} cards
{0} / {1} 天|{0} / {1} days
{0}（{1}）|{0} ({1})
{0} 張|{0} cards
{0} 張會一定進圖|{0} pinned cards
合成池 {0} 張|{0} pinned cards
池裡 {0} 張|{0} pinned cards
卡池 {0} 張|{0} pinned cards
偏好卡牌 {0}|Favorites {0}
{0} / {1} 張|{0} / {1} cards
字盒共 {0} 張，這裡顯示 {1} 張|Showing {1} of {0} library cards
{0} 張被分級收起來|{0} cards hidden by rating
{0} 張不屬於這個時代|{0} cards from other eras
{0} 張是{1}專用（{2}沒開）|{0} cards require {1} (disabled)
找不到「{0}」|No results for “{0!}”
字盒裡沒有「{0}」。可能被分級、性別或時代收起來了。|No cards matching “{0}”. Check rating, characters and era filters.
「{0}」已經在合成池裡|“{0}” is already pinned.
「{0}」已經在版上|“{0}” is already in the layers.
「{0}」放進合成池|Pinned “{0}”
「{0}」加進偏好卡牌|Added “{0}” to favorites
「{0}」拿出偏好卡牌|Removed “{0}” from favorites
「{0}」撿回來了，之後又可能抽到|Unblocked “{0}”
「{0}」丟進廢字簍了，之後不會抽到|Blocked “{0}”
把「{0}」拿出合成池|Unpin “{0}”
把「{0}」放進卡盒|Add “{0}” to card box
把「{0}」拿出卡盒|Remove “{0}” from card box
偏好卡牌最多 {0} 張，先拿掉一張再加|Favorites holds up to {0} cards. Remove one first.
卡盒最多 {0} 張，先放進墨池或拿掉幾張|Card box holds up to {0} cards. Send it to Ink Pool or remove some cards.
卡盒：{0} 張，點開看|Card box · {0} cards · Click to open
卡盒 {0}/{1}|Card box {0}/{1}
回到卡池（{0} 張）|Back to layers ({0} cards)
跟著「{0}」進來的|Included with “{0}”
{0}（滾輪或 +／− 調份量）|{0} (scroll or + / − to change weight)
{0}不會出現{1}|{1} is unavailable at the {0} rating.
{0}用不了|Unavailable at {0} rating
{0}少一個|Decrease {0}
{0}多一個|Increase {0}
{0}少一張|Decrease {0}
{0}多一張|Increase {0}
{0}不會出現{1}：要用的話，先把頂端的分級換成「敏感」或「色情」|{1} is unavailable at {0}. Choose Sensitive or Explicit in the header.
印製中・還有 {0} 張|Generating · {0} remaining
接著印剛才排著的 {0} 張|Resuming {0} queued images
清空了合成池（{0} 張）|Cleared {0} pinned cards
有 {0} 張成品的原檔被刪了|{0} original image files are missing
廢字簍：封鎖了 {0} 個字，點開可以一直點字盒的牌丟進來|{0} blocked cards · Click to edit
{0} 個字都撿回來了|Unblocked {0} cards
從{0}帶來 {1} 張牌，已經放進合成池|Pinned {1} cards from {0}
牌組「{0}」|Deck “{0!}”
{0}帶去墨池…|Sending {0} to Ink Pool…
你選的牌・{0}|Pinned cards · {0}
你選的 {0} 張|{0} pinned cards
全部 {0} 張|All {0} cards
這張的 {0} 張牌|{0} cards used in this image
這張的 {0} 張牌帶回墨池|Send these {0} cards to Ink Pool
用到的牌・{0}|Cards used · {0}
第 {0} 名|Rank #{0}
{0} 次|{0} uses
用過 {0} 次|Used {0} times
用過 {0} 次{1}|Used {0} times{1}
第 {0} / {1} 頁 · 共 {2} 個|Page {0} / {1} · {2} items
全部第 {0} 名・{1}第 {2} 名|Overall #{0} · {1} #{2}
{0} 分鐘前|{0} minutes ago
{0} 小時前|{0} hours ago
{0} 天前|{0} days ago
{0} 秒|{0} sec
{0} 分 {1} 秒|{0} min {1} sec
{0} 步|{0} steps
伺服器回 {0}|Server returned {0}
伺服器回了 {0}|Server returned {0}
圖存不下來：{0}|Could not save the image: {0}
收不進去：{0}|Could not save: {0}
拿不掉：{0}|Could not remove: {0}
印壞：{0}|Generation failed: {0}
「{0}」拿出作品冊了|Removed “{0!}” from Gallery
{0} 件作品{1}|{0} saved images{1}
{0} 件作品|{0} saved images
{0} 件|{0} images
相似的作品・{0}|Similar images · {0}
{0}：{1} 張牌一樣|{0} · {1} shared cards
{0} 張一樣|{0} shared cards
從日誌裡印好的 {0} 張算|Based on {0} generated images in history
看用「{0}」印的（日誌）|View images using “{0!}” in history
{0} 個|{0} items
{0} 個・一張圖掛幾個就各算一次|{0} models · Each LoRA is counted separately
成就 {0} / {1}|Achievements {0} / {1}
成就牆：解鎖 {0} / {1} 項，還有每個花色的收集進度|{0} / {1} achievements unlocked · View category progress
{0}：點亮 {1} / {2} 張|{0} · {1} / {2} used
{0}點亮 {1} / {2}|{0} · {1} / {2} used
用過 {0} 種不同的牌|Use {0} different cards
集滿 {0} 個細分類（裡面每張都用過）|Use every card in {0} subcategories
{0} 個花色全部集滿|Complete all {0} categories
集滿 {0} 個花色|Complete {0} categories
同一張牌用過 {0} 次|Use one card {0} times
親手放進池子的牌累計 {0} 次|Pin cards {0} times
印好 {0} 張|Generate {0} images
作品冊收了 {0} 件|Save {0} images to Gallery
連續 {0} 天都有印|Generate on {0} consecutive days
同一天印好 {0} 張|Generate {0} images in one day
半夜十二點到五點印好 {0} 張|Generate {0} images between midnight and 5am
成就牆開張：已經解鎖 {0} 項|Achievements ready · {0} unlocked
解鎖成就：{0}（{1}）|Achievement unlocked: {0} ({1})
解鎖了 {0} 項成就|Unlocked {0} achievements
解鎖於 {0}|Unlocked on {0}
{0}・全部達成|{0} · Completed
點亮 {0} 種・集滿 {1} / {2} 個細分類・以目前分級看得到的牌算|{0} cards used · {1} / {2} subcategories complete · Based on current rating
{0} / {1} 項・只看不擋，沒解鎖的牌照樣能用|{0} / {1} achievements · All cards are available
{0} 張用過|{0} cards used
／ {0} 張用過|/ {0} cards used
沒有{0}的牌|No {0} cards
…（{0} 張）|… ({0} cards)
{0}（畫 {1}，前面排隊 {2}）|{0} (generation {1}, queue {2})
卡盒清空了（{0} 張）|Cleared {0} cards from the box
剛剛又記了 {0} 張牌的使用次數|Usage updated for {0} cards
把{0}裡的 {1} 張存成一組：|Save {1} cards from {0} as a deck:
{0}是空的：先放幾張牌，就能存成一組。|{0} is empty. Add cards before saving a deck.
刪掉牌組「{0}」|Delete deck “{0!}”
刪掉了牌組「{0}」|Deleted deck “{0!}”
刪不掉：{0}|Could not delete: {0}
復原不了：{0}|Could not undo: {0}
存不了：{0}|Could not save: {0}
{0} 張在卡池裡|{0} cards pinned
滿 {0} 張了，先拿掉一張|Limit of {0} cards reached. Remove one first.
{0}：現在的設定抽不到它|{0} · Unavailable with the current rules
{0} 張沒印成|{0} generations failed
還有 {0} 張待印|{0} images waiting
正在印 {0} 張|Generating {0} images
正在印，畫到 {0}%|Generating · {0}%
還有 {0} 張排著，回去才接著印|{0} queued images will resume when you return
{0}印好了 {1} 張|{0} generated {1} images
繪製 {0}/{1}|Generating {0}/{1}
Comfy 靜默超過 {0} 秒，這張放棄|ComfyUI did not respond for {0} seconds. Generation stopped.
（還有 {0} 張）|({0} remaining)
這张最多放大到 {0}|Maximum upscale: {0}
這張最多放大到 {0}|Maximum upscale: {0}
現在是 {0} {1}（{2}×{3}）|Current: {0} {1} ({2}×{3})
快捷鍵・{0}|Keyboard shortcuts · {0}
加進{0}|Add to {0}
換成這 {0} 張牌|Replace with {0} cards
貼上之後，詞庫有的會變成牌放進{0}；畫質詞、LoRA、詞庫沒有的會分開列出來。|Matching tags become cards in {0}. Quality tags, LoRA and unknown tags are listed separately.
選到：{0}|Selected: {0}
最多 {0} 個人|Up to {0} people
自己擺姿勢・{0}×{1}|Pose editor · {0}×{1}
讀不到圖（{0}）|Could not load image ({0})
骨架預覽沒做成：{0}（還是可以照用，印出來看看）|Skeleton preview failed: {0}. You can still try generating with this pose.
用不了這張：{0}|Could not use this image: {0}
存不了這個姿勢：{0}|Could not save pose: {0}
抓到 {0} 個人，拖點來改。|Detected {0} people. Drag joints to adjust.
抓不到骨架：{0}|Could not detect skeleton: {0}
只補 1 {0}，點一顆換過去；釘選只佔同類格|Add 1 {0}. Click a slot to change it. Pins occupy their own slot.
只補 {0} {1}，點暗的會換掉最早選的；釘選只佔同類格|Add {0} {1}. Selecting an inactive slot replaces the oldest choice. Pins occupy their own slot.
會補「{0}」|Add “{0}”
換成「{0}」|Replace with “{0}”
{0}補哪幾格|{0} slots
{0}導覽・{1} / {2}|{0} tour · {1} / {2}
👉 {0}|👉 {0}
一步一步帶你用{0}（文字導覽，配合畫面操作）|Learn {0} with a guided tour
第一次來{0}？|New to {0}?
份量 {0}|Weight {0}
清空 LoRA {0}|Clear LoRA {0}
LoRA {0} 尚未選擇——從左邊清單點一個|Select LoRA {0} from the list on the left.
觸發詞（共 {0} 段，勾選要用哪幾段）|Trigger words · {0} groups · Select which to use
翻譯服務 {0}|Translation service returned {0}
「{0}」底下沒有 LoRA|No LoRA in “{0!}”
{0} 隨機 {1} 個 LoRA|{0} · {1} random LoRA
隨機瀏覽 {0} 個 LoRA|Browse {0} random LoRA
LoRA Manager 送來的「{0}」在這裡的清單找不到|LoRA “{0!}” from LoRA Manager was not found in this list.
已從 LoRA Manager 選入 LoRA {0}：「{1}」|Selected LoRA {0!} from LoRA Manager: “{1!}”
LoRA：清單來自 ComfyUI（{0} 個）。想要預覽圖和觸發詞：在 ComfyUI 裝 LoRA Manager（啟動檔會自動裝，裝完重開 ComfyUI），或在 config.json 填 paths.loraRoot。|LoRA: list from ComfyUI ({0!}). For preview images and trigger words, install ComfyUI LoRA Manager (the launcher installs it; restart ComfyUI afterwards) or set paths.loraRoot in config.json.
LoRA：沒設定 paths.loraRoot，改問 ComfyUI 也失敗了：{0}|LoRA: no LoRA Manager or paths.loraRoot, and ComfyUI could not be reached: {0!}
第一次使用：準備中 {0}/{1}|First-time setup {0}/{1}
重開失敗（{0}）：請自己重開 ComfyUI|Restart failed ({0!}). Restart ComfyUI yourself.
{0}（下次啟動接著抓）|{0} (resumes next launch)
{0}（下次啟動接著做）|{0} (resumes next launch)
「{0}」跟「{1}」同時成立不了，引擎會擠掉其中一個|“{0}” and “{1}” cannot both apply. The engine drops one.
「{0}」跟「{1}」同時成立不了，引擎會摘掉其中一個{2}|“{0}” and “{1}” cannot both apply. The engine removes one.{2}
設定 · 底模 {0}|Checkpoint settings · {0!}
底模已換成「{0}」|Checkpoint changed to “{0!}”
工作流：{0}|Workflow: {0!}
預設 {0}|Default {0}
已匯入「{0}」。|Imported “{0!}”.
只能填 0 到 {0} 的整數|Enter an integer between 0 and {0}.
讀不到檔案：{0}|Could not read file: {0}
{0} 跟現在的人數對不上|{0} conflicts with the selected characters.
{0} 和 {1} 不能同時成立|{0} and {1} cannot be used together.
{0}・排隊中|{0} · Queued
{0}・排隊|{0} · Queued
{0}沒做成：{1}|{0} failed: {1}
試印 {0}|Proof {0}
常補 {0}/4|Used in {0}/4 proofs
你的 {0} 張・引擎補 {1} 張|{0} pinned · {1} engine additions
你的 {0} 張|{0} pinned
引擎補 {0} 張|{0} engine additions
這一版的牌（{0}）|Cards in this image ({0})
`;
export const templates = parameterized.trim().split("\n").map((line) => {
  const split = line.indexOf("|");
  return [line.slice(0, split), line.slice(split + 1)];
});
