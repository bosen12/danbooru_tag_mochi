/* English UI copy. Chinese source phrases are stable presentation keys.
 * Keep canonical Danbooru tags and user-provided names out of this catalog. */
const copy = String.raw`
體型|Body type
膚質／標記|Skin / markings
種族|Species
其他長相|Other appearance
成人特徵|Adult features
裸身／衣著程度|Nudity / coverage
材質／衣服狀態|Fabric / garment state
主題／裝飾|Theme / decoration
道具|Props
鏡頭效果|Lens effects
更多種類|More kinds
種族需使用「多元／奇葩」場景。|Species require Diverse or Weird scene mode.
種類仍受分級、尺度與場景限制；沒有相容牌時留空。|Rating, content level and scene still apply; kinds with no compatible card stay empty.
只補 1 種、每種一件，點一顆換過去；釘選只佔同類格|Add 1 type, one item. Click a slot to change it. Pins occupy their own slot.
性愛與走光也受選格限制；仍須符合尺度與情境，無可用牌時會留空。|Sex and exposure follow the selected kinds too. Content level and context still apply; unavailable kinds are left empty.
選格時職業依這裡的選擇；自由補抽時依「抽職業」開關。體型依人物性別補。|In slot mode, the job choice here applies; in free mode, Draw jobs applies. Body types follow character gender.
長相、服裝、姿勢設 1–4，場景設 1–3，可選擇補抽種類；更高的數字為自由補抽。釘選、指定必抽與必要附帶照樣保留。|Choose kinds at 1–4 for appearance, clothing and pose, or 1–3 for scene. Higher counts use free drawing. Pinned cards, required draws and their dependencies stay.
點字盒的牌放進來，也可以拖曳|Click a library card to add it, or drag it here
選牌後直接生成。疊印台可先比較四組提示詞；兩邊的選牌與規則各自獨立。|Choose cards and generate directly. Fuse Bed lets you compare four prompts first; each room has its own cards and settings.
比較四組候選提示詞，選好再付印生圖。選牌與規則和墨池各自獨立。|Compare four candidate prompts, then print to generate an image. Cards and settings are independent from Ink Pool.
帶牌去疊印台|Take cards to the press
帶牌去墨池|Take cards to Ink Pool
無法交接選牌，請檢查瀏覽器儲存空間。|Could not transfer cards. Check browser storage.
更多規則：每段張數與選格、場景、職業、角色|More rules: counts and slots, scene, jobs, characters
這是候選提示詞，尚未生成圖片。按「付印」才會生圖。|This is a candidate prompt, with no image yet. Print to generate it.
四組候選提示詞，還不是圖片。≠ 表示與已選試印不同。|Four candidate prompts, with no images yet. ≠ marks differences from the selected proof.
與已選試印不同|Different from the selected proof
髮色|Hair color
特色|Highlight
看提示詞|View prompt
複製提示詞|Copy prompt
只有配方，尚無圖片|Recipe only, no image yet
圖片讀取失敗|Image could not load
圖片讀取失敗。可以重試，或把牌帶回墨池重新生成。|Image could not load. Retry, or take the cards to Ink Pool to generate it again.
重試讀取圖片|Retry image
正在重新讀取圖片…|Reloading image…
這件作品只存了配方。把牌帶回墨池，就能重新生成圖片。|This work contains a recipe only. Take its cards to Ink Pool to generate an image.
牌組保存整組選牌與權重，之後可以重新套用；偏好卡牌則是每個工作區常用的單張牌。|Decks save a full selection and its weights for reuse. Favorites hold individual cards for each workspace.
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
也收整個系列|Whole series too
這張圖的角色|Characters in this image
這張圖的牌|Cards in this image
整個系列|Whole series
找角色或系列：約兒、yor、間諜家家酒…|Find a character or series: Yor, Spy x Family…
角色或系列（合起來最多 3 個）|Characters or series (up to 3 in total)
開著|On
關著|Off
分頻道|Channels
＋ 新增頻道|+ Add channel
照分級、角色、tag 把圖分到不同頻道，一張圖符合幾個就送幾個。一個都沒對到的，送下面「其他」那條（可以不設）。|Route images to different channels by rating, character and tag. An image goes to every channel it matches; images that match none go to “Other” below (optional).
還沒有頻道。|No channels yet.
其他：沒對到任何頻道的圖|Other: images that match no channel
確定刪除？|Delete?
開著：照條件送|On: sends matching images
關著：這個頻道先不送|Off: this channel is paused
暫停：連續送不出去|Paused: kept failing
恢復|Resume
編輯|Edit
不限分級|Any rating
完整|Full
名稱|Name
例如：芙莉蓮、全年齡收藏|e.g. Frieren, General archive
Discord 頻道設定 → 整合 → 建立 Webhook → 複製網址。存在伺服器、不進 git、不會回傳瀏覽器。|Discord channel settings → Integrations → Create Webhook → Copy URL. Stored on the server, never in git, never sent back to the browser.
留空＝沿用已存的。| Leave blank to keep the saved one.
送到了。去那個頻道看一下。|Sent. Check that channel.
分級（不勾＝不限）|Rating (none = any)
只送圖和一行小字；關掉會多送中文標籤分欄和英文提示詞（方便重現）|Only the image and one line of details. Turn off to also post tag groups and the English prompt (handy for reproducing).
存頻道|Save channel
新增頻道|Add channel
編輯頻道|Edit channel
要取個名字|Give it a name
要貼上 webhook 網址|Paste the webhook URL
至少設一種條件（分級、角色或 tag）|Set at least one condition (rating, character or tag)
tag|Tags
找 tag：泳裝、swimsuit…|Find a tag: swimsuit…
任一個|Any
全部都要|All
拿掉|Remove
找不到|No match
tag（最多 5 個）|Tags (up to 5)
用這張開 Discord 頻道|New Discord channel from this
（全部）| (all)
（任一）| (any)
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
目前勾的尺度不收它|Excluded by the selected content levels
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
。規則（時代、尺度、人物…）改過，試印跟當時不一樣|. Rules have changed, so the proofs may differ from the original.
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
付印（G）|Generate (G)
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
互斥|Exclusive
帶上|Include
拿掉的不抽回來|Keep removed ones out
開：釘了一張牌，抽的時候把它附帶的牌一起帶上（夏日洋裝帶洋裝）。關：你從池子拿掉的附帶牌不會被抽回來|On: a pinned card brings its companion cards when drawing (sundress brings dress). Off: companions you removed from the pool stay out.
開：放一張牌時，池子裡跟它互斥的牌拿下來（放黑髮，紅髮下來）。關：互斥的牌都留著，兩張都寫進提示詞|On: adding a card takes conflicting cards out of the pool (black hair replaces red hair). Off: conflicting cards both stay and both go into the prompt.
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
抽並生圖／付印|Draw & generate / Generate
付印的快捷鍵改成 G 了（跟墨池一樣：G 會生圖，P 不會）|Generate is now G, as in Ink Pool: G generates, P does not
撤回／復原|Undo / Restore
選試印|Choose proof
鍵盤，比滑鼠快|Keyboard shortcuts
現在，換你了|Your turn
墨池 · 疊印台　放一張牌試試|Ink Pool · Fuse Bed · Try your first card
＋ 更多設定與操作|＋ More options
/ 找牌　Z 撤回　1–4 試印　R 換一批　G 付印|/ Search · Z Undo · 1–4 Proofs · R Reroll · G Generate
墨池|Ink Pool
疊印台|Fuse Bed
卡冊|Card Book
作品冊|Gallery
排字匣|Danbooru Case
墨池 · 抽牌生圖|Mochi · Ink Pool
墨池 · 疊印台|Mochi · Fuse Bed
墨池 · 卡冊|Mochi · Card Book
墨池 · 作品冊|Mochi · Gallery
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
讀不到作品冊：伺服器沒開，或連不到主機。作品都還在伺服器上。|Can’t load the gallery: the server isn’t running or can’t be reached. Your works are still on the server.
重試|Retry
讀不到伺服器上的使用次數：伺服器沒開，或連不到主機|Can’t load usage counts from the server: it isn’t running or can’t be reached
讀不到使用紀錄|Can’t load usage history
伺服器沒開，或連不到主機。紀錄都還在伺服器上，連上之後就會出來。|The server isn’t running or can’t be reached. The history is still on the server and will show once connected.
連不到主機，網路回來就接著印|Can’t reach the host; printing resumes when the network is back
連線沒有回應，重新接上…|The connection stopped responding; reconnecting…
連不到主機，停下來了|Can’t reach the host; stopped
伺服器的存檔壞了|A save file on the server is corrupted
這一頁開不起來|This page could not open
網路斷了，或伺服器沒開。網路回來（或開好伺服器）之後按重試。|The network dropped or the server is not running. Retry once it is back.
多半是這台瀏覽器裡墨池的本機存檔讀不懂（舊版留下的、或被別的程式改過）。先按重試；還是不行就重設本機存檔。|Mochi’s saved data in this browser is probably unreadable (left by an old version or changed by another program). Retry first; if it still fails, reset the saved data.
重設本機存檔|Reset saved data
清掉這台瀏覽器裡墨池的本機存檔（成品牆、規則、篩選、偏好卡牌）？伺服器上的牌組、作品冊、使用次數不會動。|Clear Mochi’s saved data in this browser (results, rules, filters, favorite cards)? Decks, gallery and usage on the server stay.
詳細|Details
牌的使用次數|card usage counts
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
性別|Gender
系列|Series
規則的「人物」沒開男生，男角色都收起來了。|Men are off under People in the rules, so male characters are hidden.
規則的「人物」沒開女生，女角色都收起來了。|Women are off under People in the rules, so female characters are hidden.
不限|Any
隨機（每張一個時代）|Random · one era per image
不限制開著：所有牌都不受全年齡／敏感／色情限制，右邊選的分級是圖本身標的分級|No limit is on: every card is allowed regardless of rating; the rating picked on the right is how each image is labeled
不限制：打開後所有牌都不受全年齡／敏感／色情限制|No limit: allow every card regardless of General / Sensitive / Explicit
混合|Mixed
混合（不同時代一起出現）|Mixed · eras can combine
每張隨機|Random each
每段抽幾個|Cards per category
每段補幾張|Cards per category
引擎每段補幾張|Cards added per category
場景合理度|Scene consistency
抽職業|Include occupations
字盒只看這個時代|Filter library by era
更多規則：每段張數與選格、尺寸、場景、職業|More rules: categories, size, scene, occupations
更多規則：每段張數與選格、尺寸、場景、職業、角色|More rules: categories, size, scene, occupations, characters
抽角色|Draw characters
加入系列名|Add series name
只抽同系列|Same series only
抽的角色都跟釘的角色同一部作品；沒釘就先挑一部人數、性別湊得齊的|Drawn characters all come from the pinned character's series; with none pinned, one series that fits the cast is picked first
只替「人物」選中的性別抽角色，一張最多三個；手動釘的角色照留|Draw characters only for the selected gender, up to three per image; pinned characters stay
角色後面接作品名（例：yor briar, spy x family）；釘的角色也一樣|Add the series after each character (e.g. yor briar, spy x family); pinned characters too
角色|Characters
▸ 更多規則：每段張數與選格、尺寸、場景、職業|More rules: categories, size, scene, occupations
疊印台自己的規則，跟墨池分開。改了之後四張試印會立刻重抽。|Fuse Bed has its own rules. Changes redraw all four proofs immediately.
一次|Batch
無限抽|Continuous
同一個人|Same character
同一個人：一次 2 張以上才有作用|Same character requires a batch of at least 2 images.
一次抽好幾張時，第 2 張起沿用第 1 張的長相：同一個角色換姿勢、換衣服|Reuse the first image's appearance throughout a batch, with new poses and outfits.
抽完一輪自動接著抽下一輪，一直到按「停」，或印到右邊設定的張數|Keep drawing new batches until you press Stop, or until the count set on the right is reached.
無限抽印到幾張停|Stop continuous generation after
無限抽印到這麼多張就停（一輪印完才停，不會切掉一半）|Continuous generation stops after this many images (the current batch always finishes)
印 {0} 張停|Stop after {0}
不限張數|No limit
無限抽 {0} / {1}|Continuous {0} / {1}
無限抽印完 {0} 張，到了設定的張數，停下了|Continuous generation stopped after {0} images, as set
只抽牌|Draw only
抽並生圖|Draw & generate
只抽牌，不送 Comfy（P）|Draw cards without generating an image (P)
只抽牌（P）|Draw only (P)
抽並生圖（G）|Draw & generate (G)
無限抽・下一輪…|Continuous · Next batch…
池子是空的，全靠抽|No pinned cards · All cards are random
這一輪抽牌失敗，請再試一次|This draw failed. Try again.
這一輪抽不出東西：合成池的字可能互相卡住，換一兩張試試|No combination found. Try replacing one or two pinned cards.
固定種子下抽不出新的組合，無限抽先停下：換幾張牌，或把種子改回隨機|Continuous stopped: with a fixed seed, no new combination came up. Swap a few cards or switch the seed back to random.
這幾張跟印過的一模一樣（固定種子），沒有再送：換幾張牌，或把種子改回隨機|Not sent: identical to images already printed with this fixed seed. Swap a few cards or switch the seed back to random.
略過 {0} 張：跟印過的一模一樣（固定種子）|Skipped {0}: identical to images already printed with this fixed seed
全部展開|Expand all
全部收起|Collapse all
每排自動|Auto per row
每排幾張|Images per row
每排幾張：圖小一點一次看得多，大一點看得清楚|Images per row: smaller shows more at once, larger shows more detail
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
收掉了一張取消的|Cleared a cancelled image
收掉了 {0} 張取消的|Cleared {0} cancelled images
這張正在印，先按「停」|This image is generating. Press Stop first.
另一個墨池分頁在印這張，到那邊撤下|Another Mochi tab is printing this one. Remove it from that tab.
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
新到舊|Newest
舊到新|Oldest
含禁用|Include blocked
加入|Added
沒有日期|No date
禁用|Blocked
未滿 18 歲|Under 18
學生|Student
外觀像兒童|Looks underage
真人／VTuber|Real person / VTuber
非人形|Not a person
年齡查不到或沒把握|Age unknown
打開「含禁用」才看得到。|Turn on Include blocked to see them.
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
日誌裡還沒有用它印好的圖|No generated images with this card in history yet.
還沒有用到它的成品。從現在起印的每一張都會記下來，這裡就看得到。|No images with this card yet. New generations will appear here.
用它做過的圖|Images using this card
再多看一些|Load more
撤下過|Previously discarded
按牌右下角的「＋」，把想用的牌放進來，再一起放進墨池。|Use + on a card to add it here, then send the whole box to Ink Pool.
全部放進墨池合成池|Send all to Ink Pool
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
規則（尺寸、人物、時代、尺度、每段補幾張）|Rules: size, cast, era, content level and card counts
字盒裡的牌：點一下放進卡池，再點一下拿下來|Library cards · Click to add or remove
字盒裡的牌：點一下放進合成池，拖進廢字簍封鎖|Library cards · Click to pin, drag to blocked cards to exclude
偏好卡牌：常用的牌收在視窗底部，點一下就放上版|Favorite cards wait in the tray. Click one to add it to layers.
偏好卡牌：常用的牌收在視窗底部，點一下就放進合成池|Favorite cards wait in the tray. Click one to pin it.
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
修臉中|Fixing faces
去看|View
收起偏好卡牌|Collapse favorites
打開偏好卡牌|Open favorites
＋ 挑牌|+ Browse cards
挑好了（Esc）|Done (Esc)
點字盒裡的牌加進來，再點一次拿掉|Click a library card to add it; click again to remove.
偏好卡牌都在卡池裡了，從卡池拿下來就回到這裡。|All favorites are pinned. Remove a card from the layers to return it here.
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
修臉|Face fix
修臉：只重畫臉|Face fix · Redraw faces only
開始修臉|Fix faces
再修一次|Fix again
拿掉修臉|Remove face fix
拿掉修臉了|Face fix removed
偏好角色|Favorite characters
只抽偏好角色|Only favorite characters
我的偏好|My favorites
加角色|Add characters
找角色或作品（例：芙莉蓮、one piece）|Find a character or series (e.g. frieren, one piece)
找角色或作品|Find a character or series
上一頁|Previous page
下一頁|Next page
還沒有偏好角色。|No favorite characters yet.
去挑角色|Pick characters
字盒裡沒有角色牌。|There are no character cards in the library.
先挑幾個偏好角色|Pick a few favorite characters first
「抽角色」也一起打開了|Draw characters was turned on too
抽角色時只從你的偏好角色裡抽；名單裡沒有那個性別的角色，那個人就照舊是一般人物|Draw characters only from your favorites. If the list has no character of that gender, that person stays an ordinary character
偏好角色：挑幾個常用的角色，打開「只抽偏好角色」就只從這裡面抽|Favorite characters: pick the ones you use often, then turn on Only favorite characters to draw from them alone
加入偏好角色|Add to favorite characters
從偏好角色拿掉|Remove from favorite characters
從原圖重修|Redo from original
在這張上再修|Fix this one again
退回上一層|Undo last fix
疊越多層，臉越容易糊、越不像原本的人。|The more fixes you stack, the softer the face gets and the less it looks like the original.
從原圖重修：換一個版本；在這張上再修：這次的方向對、只是不夠。|Redo from original for a different version; fix this one again when the result is right but not strong enough.
修過臉|Faces fixed
正在問 ComfyUI 有沒有 FaceDetailer…|Checking ComfyUI for FaceDetailer…
找到臉，只把臉放大重畫再貼回去，其他地方不動。全身、多人、臉小的圖最有感。|Finds each face, redraws it larger and pastes it back. Nothing else changes. Works best on full-body shots, groups and small faces.
會在 Hires 之後的大圖上修。|Runs on the upscaled image.
這張已經修過臉。|Faces in this image are already fixed.
ComfyUI 現在做不了修臉|ComfyUI cannot fix faces right now
修臉做不了|Face fix is unavailable
原圖已經不在 ComfyUI 的 output 了：收不進作品冊|The original is no longer in ComfyUI's output folder, so it cannot be saved to the Gallery
這張的原圖已經不在 ComfyUI 的 output 了（只留最近的圖）：沒辦法從它做 Hires、修臉|The original of this image is no longer in ComfyUI's output folder (only recent images are kept), so it cannot be upscaled or face-fixed
沒找到臉（背對鏡頭、側臉太偏或臉太小）：這張沒有修|No face found (facing away, too far in profile or too small). Nothing was changed.
這張圖在 ComfyUI 的輸出資料夾裡已經換成別張了（檔名被重用）|This image has been replaced in ComfyUI's output folder (the file name was reused).
找到臉、只重畫臉（FaceDetailer）|Find faces and redraw only them (FaceDetailer)
修好臉了：不滿意可以再修一次，或拿掉修臉|Faces fixed. Not happy? Fix again or remove the face fix.
這張正在修臉，先在圖上按「停」|Faces are being fixed. Press Stop on the image first.
這張正在修臉，圖上可以停|Fixing faces · Press Stop on the image to cancel.
修臉 排隊中…|Face fix queued…
連不到 ComfyUI|Cannot reach ComfyUI
Impact Pack 的 FaceDetailer 節點|the FaceDetailer node (Impact Pack)
Impact Subpack 的臉部偵測節點|the face detector node (Impact Subpack)
臉部偵測模型 face_yolov8m.pt|the face detection model face_yolov8m.pt
修臉（FaceDetailer）|Face fix (FaceDetailer)
選用：成品下多一顆「修臉」，只重畫臉。要裝 Impact Pack 節點、臉部偵測模型和 SAM（約 425 MB），裝完要重開 ComfyUI|Optional: adds a Face fix button under each image that redraws only faces. Installs the Impact Pack nodes, a face detection model and SAM (about 425 MB). Restart ComfyUI afterwards.
選用：修臉加上 SAM，只重畫臉的形狀，瀏海、髮飾、耳環不會跟著變（約 375 MB）|Optional: add SAM to Face fix so only the face shape is redrawn and bangs, hair ornaments and earrings stay as they are (about 375 MB).
安裝節點、下載臉部偵測模型和 SAM（約 425 MB）|Installing the nodes and downloading the face detection model and SAM (about 425 MB)
停了：下次啟動會再問|Stopped. You will be asked again next launch.
不再問（刪掉 .no-face-fetch 就會再問）|Will not ask again (delete .no-face-fetch to be asked)
節點在資料夾裡，ComfyUI 卻沒載入：重開 ComfyUI；還是不行，看 ComfyUI 啟動時 Impact Pack 的錯誤訊息|The nodes are installed but ComfyUI has not loaded them. Restart ComfyUI; if that does not help, check Impact Pack's errors in the ComfyUI startup log.
圖片解析（WD14 Tagger）|Image parsing (WD14 Tagger)
選用：解析池（丟一張圖、認出畫面裡的字變成牌）。要裝 WD14 Tagger 節點和 wd-vit-tagger-v3 模型（約 380 MB），裝完要重開 ComfyUI|Optional: the Parse room (drop in an image, turn the tags it recognizes into cards). Installs the WD14 Tagger node and the wd-vit-tagger-v3 model (about 380 MB). Restart ComfyUI afterwards.
選用：解析池要的 WD14 模型 wd-vit-tagger-v3（約 380 MB）。不先下載的話，第一次解析時 ComfyUI 會自己抓，要等好幾分鐘|Optional: the WD14 model wd-vit-tagger-v3 for the Parse room (about 380 MB). Without it, ComfyUI downloads it during your first parse, which takes several minutes.
安裝節點、下載 WD14 模型（約 380 MB）|Installing the node and downloading the WD14 model (about 380 MB)
不再問（刪掉 .no-tagger-fetch 就會再問）|Will not ask again (delete .no-tagger-fetch to be asked)
節點在資料夾裡，ComfyUI 卻沒載入：重開 ComfyUI；還是不行，看 ComfyUI 啟動時 WD14 Tagger 的錯誤訊息|The node is installed but ComfyUI has not loaded it. Restart ComfyUI; if that does not help, check WD14 Tagger's errors in the ComfyUI startup log.
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
內建的 Illustrious 流程|Built-in Illustrious workflow
匯入的 API workflow|Imported API workflow
取樣參數|Sampling parameters
全部恢復預設|Reset all defaults
取樣參數都回到預設了。|Sampling parameters reset to defaults.
改過的會描一道底線；清空欄位或改回預設值就回到預設。|Changed values are underlined. Clear a field or enter its default to reset it.
修臉細節（偵測框、臉形遮罩）|Face fix details (detection box, face mask)
成品上按「修臉」時用。沒把握就用預設；有臉沒被修到，先試著調低偵測門檻；臉修得糊，試著調低裁切倍數。|Used when you press “Fix faces” on an image. When in doubt, keep the defaults. If a face was missed, try a lower detection threshold; if fixed faces look soft, try a lower crop factor.
偵測門檻|Detection threshold
偵測框外擴|Box dilation
裁切倍數|Crop factor
忽略小臉|Skip tiny faces
臉形遮罩外擴|Mask dilation
臉形遮罩門檻|Mask threshold
修臉 {0}|Face fix {0}
臉部偵測的信心分數要超過多少才算臉。調低：小臉、側臉、半遮的臉比較抓得到，但也比較容易把不是臉的地方當成臉；調高相反。|How confident the face detector must be before something counts as a face. Lower it to catch small, side-on or partly hidden faces, at the risk of treating other things as faces; raise it for the opposite.
偵測到的臉框往外擴幾個像素再處理。太小可能切到下巴、髮際；太大會連周圍一起算進去。|How many pixels to grow each detected face box. Too small can cut off the chin or hairline; too large pulls in the surroundings.
拿臉框幾倍大的範圍去重畫。倍數越小，臉放得越大、細節越多（裁切最大 1024 像素：3 倍時臉只放到約 340 像素，1.6 倍約 640）；太小則周圍參考少，膚色、光線可能接不上。|How large an area around the face box to redraw. A smaller factor enlarges the face more and adds detail (the crop is capped at 1024 px, so at 3× the face only reaches about 340 px and at 1.6× about 640); too small leaves little context, so skin tone and lighting may not blend.
比這個還小（像素）的臉不修，多半是背景人物或圖案。|Faces smaller than this (in pixels) are skipped; they are usually background figures or patterns.
SAM 切出臉的形狀之後再往外擴幾個像素。太小眼角、臉的邊緣可能漏修；太大會連瀏海、髮飾一起重畫。ComfyUI 沒有 SAM 模型時用不到。|How many pixels to grow the face shape cut out by SAM. Too small can miss the corners of the eyes and the edge of the face; too large redraws bangs and hair accessories too. Unused when ComfyUI has no SAM model.
SAM 判斷「這塊算臉」的信心門檻。調低遮罩比較大、比較寬鬆；調高只留最確定的部分。ComfyUI 沒有 SAM 模型時用不到。|How confident SAM must be that a region is the face. Lower it for a larger, looser mask; raise it to keep only the surest part. Unused when ComfyUI has no SAM model.
正向、負向、LoRA 都照這裡選的組裝。|The positive prompt, negative prompt and LoRAs are built from your choices here.
至少選一個正向節點才能生圖。|Select a positive prompt node to generate images.
建議|Suggested
不改，保留 workflow 原值|Keep workflow value
這張圖沒有 LoRA 節點。|This workflow has no LoRA nodes.
不改，保留 workflow 裡的 LoRA|Keep workflow LoRA
最多對兩個 LoRA 節點（LoRA 面板只有兩格）。|Map up to two LoRA nodes (the LoRA panel has two slots).
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
目前用的是自己的工作流：生圖照它圖裡的 steps／CFG，這裡的「生圖」那一行不套用。Hires、修臉一律用這裡的。|Your imported workflow controls generation steps and CFG. The Hires and Face fix settings below still apply.
目前用的是自己的工作流：生圖照它圖裡的 steps／CFG，這裡的「生圖」那一行不套用。Hires 一律用這裡的。|Your imported workflow controls generation steps and CFG. The Hires settings below still apply.
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
Discord Developer Portal → 你的 application → Bot → Reset Token。存在伺服器的|Discord Developer Portal → your application → Bot → Reset Token. Saved on the server in
，不進 git、不會回傳瀏覽器。留空＝沿用已存的 token。|, excluded from Git and never returned to the browser. Leave blank to keep the saved token.
頻道 ID|Channel ID
在 Discord 開「開發者模式」後右鍵頻道 →「複製頻道 ID」。bot 要先邀進該伺服器，並且在那個頻道有|In Discord, turn on Developer Mode, then right-click the channel → Copy Channel ID. Invite the bot to the server and give it
發送訊息|Send Messages
和|and
附加檔案|Attach Files
權限。|permissions in that channel.
時代對不上|Era does not match
偏好路徑|Preferred folder
沒設定：列出 ComfyUI 的全部 LoRA|Not set: every LoRA ComfyUI knows
沒設定：列出 ComfyUI 的全部底模|Not set: every checkpoint ComfyUI knows
只看這個資料夾底下的 LoRA。點下面的資料夾，或貼上路徑。|Show only the LoRAs in this folder. Pick a folder below or paste a path.
只看這個資料夾底下的底模。點下面的資料夾，或貼上路徑。|Show only the checkpoints in this folder. Pick a folder below or paste a path.
LoRA 資料夾路徑|LoRA folder path
底模資料夾路徑|Checkpoint folder path
選資料夾…|Choose folder…
套用中…|Applying…
改回 ComfyUI 的全部|Showing everything ComfyUI knows
電腦上跳出了資料夾視窗，選好再按確定…|A folder window opened on this computer. Pick a folder and confirm…
沒有選資料夾|No folder chosen
開不了資料夾視窗|Could not open a folder window
只有在這台電腦上開的網頁能選資料夾；手機上請直接填路徑|Only a page opened on this computer can open a folder window. On a phone, type the path.
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
預覽縮圖（Pillow）|Preview thumbnails (Pillow)
安裝 Pillow（約 7 MB）：LoRA、底模的預覽圖會縮成小檔，開面板快很多|Installing Pillow (about 7 MB) so LoRA and checkpoint previews load as small files
裝好了：預覽圖從現在起縮成小檔|Installed. Previews now load as small files
裝不起來（照樣能用，預覽圖給原圖），詳情在 data/setup.log|Could not install it (everything still works; previews load at full size). Details are in data/setup.log
NO_PILLOW_INSTALL：預覽圖照舊給原圖|NO_PILLOW_INSTALL: previews load at full size
烘焙卡面|Bake card art
敏感、色情卡面|Sensitive and explicit card art
角色卡面|Character card art
Hires 放大模型|Hires upscale model
安裝|Install
允許|Allow
這次不要|Not now
不要再問|Never ask
烘|Bake
重開 ComfyUI|Restart ComfyUI
重新整理看新圖|Reload for new art
第一次使用的準備|First-time setup
第一次使用：準備中…|First-time setup…
ComfyUI 重開中，大約半分鐘|ComfyUI is restarting. This takes about half a minute.
已載入|Loaded
下載失敗|Download failed
安裝失敗|Installation failed
烘焙失敗|Baking failed
下載失敗，詳情在 data/setup.log|Download failed. Details are in data/setup.log
安裝失敗，詳情在 data/setup.log|Installation failed. Details are in data/setup.log
烘焙失敗，詳情在 data/setup.log|Baking failed. Details are in data/setup.log
檢查檔案…|Checking the file…
連線中斷，接著下載…|Connection dropped. Resuming…
從 GitHub 下載全年齡卡面：先抓縮圖（約 30 MB），再抓大圖（約 103 MB）|Downloading the all-ages card art from GitHub: thumbnails first (about 30 MB), then full size (about 103 MB)
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
另一個視窗正在烘；那邊烘完、重開一次就會接著檢查|Already baking in another window. Restart once it finishes and the check runs again
等前一批卡面烘完|Waiting for the other card batch to finish
另一個視窗正在烘：烘完後下次啟動會接著烘|Already baking in another window. The next launch continues baking
ComfyUI 沒開：下次啟動再檢查|ComfyUI is not running. It will be checked on the next launch
檢查失敗，詳情在 data/setup.log（下次啟動再檢查）|Check failed, details in data/setup.log (checked again on the next launch)
用你的 ComfyUI 烘還沒有的全年齡卡面|Baking missing all-ages cards with your ComfyUI
用你的 ComfyUI 烘敏感、色情卡面|Baking sensitive and explicit cards with your ComfyUI
用你的 ComfyUI 烘角色卡面|Baking character cards with your ComfyUI
版權角色不在公開下載包；用你的底模烘，要一段時間|Characters are copyrighted and not in the public download. Baking them with your checkpoint takes a while.
不再問（刪掉 .no-character-bake 就會再問）|Will not ask again (delete .no-character-bake to be asked)
不在公開下載包裡；用你的底模烘，要一段時間|Not in the public download. Baking them with your checkpoint takes a while.
不再問（刪掉 .no-pose-fetch 就會再問）|Will not ask again (delete .no-pose-fetch to be asked)
不再問（刪掉 .no-lora-manager-fetch 就會再問）|Will not ask again (delete .no-lora-manager-fetch to be asked)
選用：修改 LoRA Manager 的 loras.js，讓詳情連結直接開啟指定 LoRA；不用重開 ComfyUI|Optional: modify LoRA Manager's loras.js so Details opens the selected LoRA directly. No ComfyUI restart is needed.
選用：安裝 LoRA Manager 到 ComfyUI，安裝 Python 套件並加入詳情連結補丁；裝完要重開 ComfyUI|Optional: install LoRA Manager into ComfyUI, install its Python packages and add the Details link patch. Restart ComfyUI afterwards.
這次先不要：無法儲存略過設定|Skipped for now. Could not save this preference.
無法儲存略過設定，下次啟動會再問|Could not save this preference. You will be asked again next launch.
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
復原（Ctrl Z 也可以）：提示上的「復原」；沒有的話撿回剛才封鎖、拿出的那一張|Undo (Ctrl Z works too): the action in the toast, or else the card you just blocked or removed
字盒的牌：丟進廢字簍（按 Z 撿回來）|Library card: block it (Z takes it back)
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
尺度、時代、人物、尺寸、姿勢參考；「更多規則」裡是每段抽幾張、角色。灰掉的尺度要先在頂欄把分級換成敏感或色情。不確定就先用預設。|Set content level, era, cast, size and pose reference; More rules has card counts and characters. Greyed-out content levels need Sensitive or Explicit in the top bar first. Defaults are a good starting point.
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
印好的作品夾在這條繩上；點一張看大圖、收藏、Hires、修臉，或回到它當時的版。|Recent images appear here. Click one to view it, save it, upscale with Hires, fix faces or restore its layers.
疊幾張牌、挑一個試印、按「付印」試試看吧！之後想再看一次，按頂欄的「導覽」。|Add a few cards, choose a proof and press Generate. Restart this tour from the header any time.
卡冊是你的牌的紀錄：每張牌用過幾次、印出來好不好、收集了多少。|Explore how often you use each card, how it performs and your collection progress.
按花色篩選。花色圖章外圈那一圈，是這個花色點亮（用過）了幾成。|Filter by category. Each ring shows the proportion of cards you've used.
多到少、少到多、新到舊、舊到新；「出好圖」「常撤下」看哪些牌常出好圖、哪些常被你撤下（要先印一陣子才排得出來）。「含禁用」把不能用的角色也列出來。|Sort by usage, by the date a card was added, or by save and discard rates. Generate some images first to build a useful ranking. Include blocked lists characters that cannot be drawn.
作品＝你收藏的；日誌＝印過的每一張（沒收藏的也查得到）；模型＝每個底模、LoRA 的成績。|Saved contains your favorites. History tracks every generation. Models compares checkpoints and LoRA.
依時代、髮色、服裝、場景把作品分段。點一件作品看大圖、用了哪些牌、相似的作品，也能把牌帶回墨池。|Group images by era, hair, outfit or scene. Open an image to inspect its cards, find similar images or reuse its recipe.
日誌記著印過的每一張：時間、從哪一頁送的、花多久、有沒有收藏。|History records every generation: time, source page, duration and whether you saved it.
只看收藏的、撤下的、印壞的、Hires。點一列看配方，可以補收藏、把牌帶回墨池。|Filter saved, discarded, failed or upscaled images. Open a row to inspect its recipe, save it or reuse the cards.
使用教學|Tutorial
墨池 · 介紹影片|Mochi · Intro film
墨池 · 疊印台 · 使用教學|Mochi · Fuse Bed · Tutorial
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
螢幕保護|Screensaver
用了哪些牌|Cards used
上一張（←）|Previous (←)
下一張（→）|Next (→)
同樣的提示詞、同一顆種子再送一次|Send the same prompt with the same seed again
固定：每張都用這顆種子（一次多張、無限抽也一樣）。抽牌照樣每張隨機|Fixed: every image uses this seed, including several at once and Continuous. Card draws stay random.
全部加入合成池|Add all to pool
這張用到的牌（你選的＋抽到的）全部放進合成池；可以復原|Put every card this image used (yours and drawn) into the pool; you can undo
這張的牌都已經在合成池裡了|All of these cards are already in the pool
第一幕|Act I
第二幕|Act II
第三幕|Act III
第四幕|Act IV
牌河|The River
星河|The Galaxy
牌陣|The Mandala
一圈一圈，轉成一朵花|Ring by ring, turning into a flower
牌浪|The Wave
墨雨|Ink Rain
整副牌，繞著中間那一點光|The whole deck, circling a point of light
翻過去，就換成別張|Turn it over, and it is another card
一張一張，落下來|One by one, they fall
螢幕保護設定|Screensaver settings
閒置一陣子就飛進一條無盡的牌河，你最近生成的圖晾在中間，剛印好的會飛到眼前顯影。按 Enter 或空白鍵（或點一下）回來；滑鼠不小心動到不會關掉。|After a while idle, you fly into an endless river of cards. Your recent images hang down the middle, and a freshly printed one flies up and develops in front of you. Press Enter or Space (or click) to return; bumping the mouse will not close it.
閒置多久出現|Start after idle
放哪些牌和圖|Cards and images shown
跟頂端分級|Follow the rating
只放全年齡|General only
跟頂端分級：頂端選到哪一級，那一級以下的牌和圖都會出現。|Follow the rating: cards and images up to the rating chosen at the top appear.
要模糊的圖|Blur images
不模糊|No blur
色情的|Explicit
敏感和色情的|Sensitive and explicit
生成的圖和牌的插畫都算；模糊的只看得到顏色，牌名照樣看得到。|Applies to generated images and card art. Blurred images show only their colors; card names stay readable.
現在看看|Preview now
按 Enter 或空白鍵回來|Press Enter or Space to return
點一下或按 Enter 回來|Click or press Enter to return
點一下回來|Tap to return
新的一張|New image
30 秒|30 sec
1 分|1 min
3 分|3 min
5 分|5 min
10 分|10 min
關|Off
好|OK
隨機抽幾個 LoRA 攤開來看（點一張直接選中）|Spread out a few random LoRAs · Click one to select it
清單來自 ComfyUI。點一張換過去，之後生圖都用它。|Models come from ComfyUI. Click one to switch; new images use it.
還沒選底模——從中間挑一張|Pick a checkpoint from the grid.
ComfyUI 連線|ComfyUI connection
已連上|Connected
連不到|Not reachable
ComfyUI 在別台電腦、或改過埠號才要填。按「自動找」回到自動偵測（8188、ComfyUI Desktop 的 8000）。|Only needed when ComfyUI runs on another computer or a custom port. Auto-detect goes back to checking 8188 and 8000 (ComfyUI Desktop).
自動找|Auto-detect
看看|View
在 LoRA、底模面板：在卡之間移動；搜尋框按 ↓ 走進去，Enter 選中|In the LoRA and checkpoint panels: move between cards; ↓ from the search box steps in, Enter selects
LoRA 面板：換到 LoRA 1／LoRA 2 那一槽|LoRA panel: switch to slot LoRA 1 / LoRA 2
看這張用到的牌（成品詳情）|See the cards this image used (details)
改回自動找：找到哪個就連哪個。|Back to auto-detect: connects to whichever ComfyUI answers.
照這張再印|Print this again
牌、份量、時代、種子、底模、LoRA 一起帶去墨池|Send cards, weights, era, seed, checkpoint and LoRA to Ink Pool
只帶你選的牌|Send only your pinned cards
只帶牌|Send only the cards
更多動作|More actions
換成這組模型|Use these models
不用，照現在的|No, keep current
（跟現在選的一樣）|(same as your current selection)
換模型中…|Switching models…
換成這張的底模和 LoRA 了|Switched to this image's checkpoint and LoRA
預設底模|Default checkpoint
換掉這張重抽|Swap this card and redraw
這張成品的其他牌不動，只把這張換掉、同一顆種子重抽一次|Keep the other cards, swap only this one, and redraw once with the same seed
換一張|Swap this one
四張都一樣：|Same on all four:
詞庫裡沒有這張牌了|This card is no longer in the dictionary
卡冊工具|Card book tools
清除篩選|Clear filters
清除|Clear
全部花色|All suits
篩選都清掉了|Filters cleared
解析池|Parse Pool
墨池 · 解析池|Mochi · Parse Pool
墨池的解析池：丟一張圖進來，WD14 Tagger 認出畫面裡的字，變成牌帶去合成池或疊印台。|Drop in an image, let the WD14 Tagger read its tags, and take them to the Ink Pool or Fuse Bed as cards.
丟一張圖進來：認出畫面裡的字變成牌，帶去合成池或疊印台|Drop in an image: turn the tags it recognizes into cards for the Ink Pool or Fuse Bed
丟一張圖進來，認出畫面裡的字，變成牌。|Drop in an image. The tags it recognizes become cards.
解析設定|Parse settings
要解析的圖|Image to parse
把圖拖進來|Drop an image here
或貼上（Ctrl+V）、點這裡選圖|or paste it (Ctrl+V), or click to choose one
用新設定重新解析|Parse again with the new settings
換一張圖|Use another image
解析出來的牌|Parsed cards
要哪些牌|Which cards
解析出來的牌會落在這裡：照花色排好，每張標「確定」或「可能」，點一下就不帶它。|Parsed cards land here, sorted by suit and marked Sure or Likely. Click a card to leave it out.
送到疊印台|Send to Fuse Bed
帶去合成池|Take to Ink Pool
要一張圖（PNG、JPEG、WebP）|Please use an image (PNG, JPEG or WebP)
剪貼簿裡是文字。要變成牌的提示詞，到墨池按 Ctrl+V；這裡要貼一張圖。|The clipboard holds text. To turn a prompt into cards, press Ctrl+V in the Ink Pool; paste an image here.
這張圖打不開，換一張試試|This image cannot be opened. Try another one.
解析中…|Parsing…
還在解析…|Still parsing…
ComfyUI 可能正在印別張（等那張印完就輪到），或第一次用這個模型、正在下載。|ComfyUI may be busy with another image (this one is next), or it is downloading this model for the first time.
再試一次|Try again
解析失敗|Parsing failed
解析用的模型（解析設定裡換）|Model used for parsing (change it in Parse settings)
確定|Sure
可能|Likely
一張牌都對不上：詞庫沒有這些字。下面列出認出來的字，可以複製去別處用。|None of these tags are cards in the vocabulary. The recognized tags are listed below; copy them for use elsewhere.
張要帶走|to take
還沒選牌|No cards chosen
全選|Select all
全不選|Select none
認得出來、但詞庫沒有這張牌（或是引擎自己會處理的字）。粗體是確定的。|Recognized, but not a card in the vocabulary (or handled by the engine). Bold ones are sure.
解析模型|Tagger model
（預設）| (default)
最低信心|Minimum confidence
角色門檻|Character threshold
角色名字要多有把握才列出來；設 1 就不認角色。|How sure it must be before naming a character. Set 1 to skip characters.
不要的字|Tags to exclude
ComfyUI 的 WD14 Tagger 認得的模型。沒下載過的第一次用會先下載（幾百 MB）。|Models the WD14 Tagger in ComfyUI knows. One you have not used yet is downloaded first (a few hundred MB).
逗號分開，底線、空格都可以。這些字不會出現。|Separate with commas; underscores or spaces both work. These tags never show up.
例如：simple background, white background|For example: simple background, white background
恢復預設|Reset to defaults
存起來|Save
解析設定存好了|Parse settings saved
要一張 PNG、JPEG 或 WebP 的圖|Please use a PNG, JPEG or WebP image
圖片壞了|The image is damaged
圖片太大（上限 3MB；網頁會先縮小，還是太大就換一張）|The image is too large (3 MB limit after shrinking). Try another one.
ComfyUI 沒有裝 WD14 Tagger：在 ComfyUI Manager 搜「WD14 Tagger」（pysssss）安裝、重開 ComfyUI|ComfyUI does not have the WD14 Tagger. Install “WD14 Tagger” (pysssss) from ComfyUI Manager and restart ComfyUI.
解析太久沒回來（ComfyUI 可能還在下載模型，等一下再試）|Parsing took too long (ComfyUI may still be downloading the model). Try again in a moment.
Tagger 出錯（ComfyUI 的主控台有詳細原因）|The tagger failed (details in the ComfyUI console)
歡迎來到解析池|Welcome to the Parse Pool
丟一張圖進來，ComfyUI 的 WD14 Tagger 認出畫面裡的字，詞庫有的變成牌。|Drop in an image. ComfyUI's WD14 Tagger reads its tags, and the ones in the vocabulary become cards.
放圖|Add an image
把圖拖進來、貼上（Ctrl+V），或點一下選圖。放進來就開始解析，大約幾秒。|Drag an image in, paste it (Ctrl+V), or click to choose one. Parsing starts right away and takes a few seconds.
換模型、調最低信心（低一點認得多、也比較會亂猜）、角色門檻、不要的字。|Change the model, the minimum confidence (lower finds more but guesses more), the character threshold, and tags to exclude.
牌照花色排好，每張標「確定」或「可能」。點一張就不帶它；上面可以切換只要確定的。|Cards are sorted by suit and marked Sure or Likely. Click one to leave it out, or switch to sure ones only at the top.
帶走|Take them
選好的牌放進墨池的合成池，或送到疊印台一層層疊。|Add the chosen cards to the Ink Pool, or send them to the Fuse Bed to layer them.
貼上一張圖就開始解析|Paste an image to start parsing
自訂|Custom
修改|Edit
正面|Positive
負面|Negative
正面提示詞|Positive prompt
負面提示詞|Negative prompt
現在用的是|Using the
存下並重烤|Save and rebake
存不了|Couldn't save
存下了，送去烤…|Saved, sending to bake…
看、改這張牌卡面的正負面提示詞；改了就重烤|View or edit this card's art prompts; edits rebake the art
這張牌沒有卡面（純字牌），沒有提示詞可以改。|This card has no art (text-only card), so there is no prompt to edit.
卡面用的是自訂提示詞|Card art uses a custom prompt
存下了。下次烘焙卡面時（開墨池的第一次準備）會照這段提示詞烤。|Saved. The next card-art bake (Mochi's first-run setup) will use this prompt.
排隊中…別的卡面正在烤，輪到它就烤。|Queued… another card is baking; this one is next.
烤卡面中…大約 6 秒。|Baking the card art… about 6 seconds.
烤好了，卡面換成新的。|Done. The card art has been replaced.
ComfyUI 沒開，先存著；下次開墨池時會照這段提示詞烤。|ComfyUI isn't running. Saved for now; it will bake with this prompt next time Mochi starts.
烤失敗了，提示詞有存下來，可以再按一次存下並重烤。|Baking failed. The prompt is saved; press Save and rebake to try again.
墨池 · 原理|Mochi · How it works
原理|How it works
一張圖怎麼抽出來：分類、互斥、分級、擋未成年、整個程式的架構 · How it works|How a picture is drawn: categories, exclusions, ratings, blocking minors and the whole architecture
墨池是怎麼運作的：從啟動、偵測模型、烘卡面，到抽牌、分類、互斥、分級、擋未成年，五個房間各做什麼，程式架構一張圖看懂。|How Mochi works: startup, model checks and card baking; drawing, categories, exclusions, ratings and blocking minors; what each of the five rooms does; and the whole architecture on one map.
回到房間|Rooms
章節|Chapters
房間|Rooms
從啟動開始|Startup
架構一張圖|The map
牌與詞庫|Cards and vocabulary
抽一張|Draw one
互斥與附帶|Exclusive and included
分級、尺度、時代|Rating, content level, era
怎麼擋未成年|Blocking minors
五個房間|The five rooms
生圖之後|After generating
品質|Quality
一張圖，是怎麼|How a picture gets
抽出來的|drawn
墨池是一副|Mochi is a deck of
張的牌。每張牌是一個 Danbooru 標籤，配中文名和一張卡面。你放幾張，引擎照規則把其餘補完，排成一段提示詞，送進 ComfyUI 畫出來。|cards. Each card is one Danbooru tag with a name and its own art. You place a few, the engine fills in the rest by the rules, lines everything up as a prompt and sends it to ComfyUI to paint.
不懂程式也看得懂：往下捲，每一章都可以點、可以試。|No coding needed: scroll down. Every chapter can be clicked and tried.
從頭看|Start from the top
雙擊|Double-click
：它只做一件事，開一個小伺服器（|. It does one thing: starts a small server (
），再打開瀏覽器。第一次要準備的東西，都由伺服器在背景做，網頁左下角的面板一項項顯示。|) and opens your browser. Everything first-time setup needs is done by the server in the background, shown step by step in the panel at the bottom left.
卡面插畫|Card art
從 GitHub Release 下載公開的全年齡卡面（先抓幾十 MB 的縮圖，原圖背景接著抓）。不用 ComfyUI。|Downloads the public General card art from GitHub Releases (a few dozen MB of thumbnails first; full images follow in the background). No ComfyUI needed.
預覽縮圖（Pillow）|Preview thumbnails (Pillow)
沒裝就裝：LoRA、底模的預覽圖縮成小檔，面板開得快。|Installed if missing: shrinks LoRA and base model previews so the panel opens fast.
等 ComfyUI 開起來|Wait for ComfyUI
還沒開的話，下面這些先等著；一開就接著做，不用再跑一次 bat。|If it isn't running yet, the steps below wait, then continue as soon as it starts. No need to run the launcher again.
問過你才裝進 ComfyUI：LoRA 清單、預覽圖、觸發詞都從它來。|Installed into ComfyUI only after asking you. The LoRA list, previews and trigger words come from it.
Hires 放大模型|Hires upscale model
約 18 MB，放進 ComfyUI 的 upscale_models。|About 18 MB, placed in ComfyUI's upscale_models.
OpenPose 節點＋模型（約 2.5 GB）：照一張圖的姿勢擺。|OpenPose nodes and models (about 2.5 GB): copy the pose from an image.
修臉（FaceDetailer）|Face fix (FaceDetailer)
只重畫臉的那顆按鈕要的節點、偵測模型、SAM（約 425 MB）。|The nodes, detection model and SAM for the face-only redraw button (about 425 MB).
圖片解析（WD14 Tagger）|Image parsing (WD14 Tagger)
解析池要的節點和 wd-vit-tagger-v3 模型（約 380 MB）。|The node and wd-vit-tagger-v3 model the Parse Pool needs (about 380 MB).
缺的、提示詞改過的全年齡卡面，用你的 ComfyUI 直接畫。|General card art that is missing or whose prompt changed, painted by your own ComfyUI.
敏感、色情、角色卡面|Sensitive, Explicit and character art
不公開下載的那些：問一聲，要的話在你的電腦上烤。|The art that isn't offered for download: asks first, then bakes it on your computer if you want.
自己做|Automatic
先問你|Asks first
等 ComfyUI|Waits for ComfyUI
怎麼知道缺什麼？|How does it know what's missing?
伺服器問 ComfyUI「你有哪些節點、哪些模型」（object_info），再看資料夾裡的檔案；都有的人完全看不到這個面板。|The server asks ComfyUI which nodes and models it has (object_info), then checks the files in its folders. If everything is there, you never see the panel.
卡面怎麼烘？|How is card art baked?
每張牌一段固定的提示詞：一定寫 adult、mature，負面詞擋 loli、child；同一個種子，誰烤都一樣。烤好存一張原圖、兩種縮圖，清單記著每張是用哪段提示詞烤的，提示詞一改就知道要重烤。|Each card has a fixed prompt that always says adult and mature, with loli and child in the negative prompt, and a fixed seed, so anyone gets the same result. Each bake saves a full image and two thumbnails, and a manifest records which prompt made each one, so a changed prompt means a rebake.
抽牌在你的瀏覽器裡算，畫圖交給 ComfyUI，中間的伺服器負責轉送、存檔、記帳。點任何一塊看它在做什麼；下面的按鈕演一次「按下抽並生圖」資料怎麼走。|Cards are drawn in your browser and pictures are painted by ComfyUI; the server in between relays, saves and keeps count. Click any block to see what it does. The buttons below replay how the data moves.
演一次：抽並生圖|Play: draw and generate
演一次：詞庫怎麼做出來|Play: how the vocabulary is built
你|You
瀏覽器畫面|Browser
你在瀏覽器裡點牌、按按鈕。電腦、手機都行（手機走 Tailscale 連回家裡這台）。|You click cards and buttons in a browser, on a computer or a phone (phones connect back home over Tailscale).
墨池、疊印台、卡冊、作品冊、解析池。都是網頁，畫面、動畫、按鈕都在這裡。|Ink Pool, Fuse Bed, Card Book, Gallery and Parse Pool. They are web pages: every screen, animation and button lives here.
抽牌引擎|Draw engine
在你的瀏覽器裡跑：照規則把池子補完，排出提示詞。不用連網路就能算，所以抽牌是瞬間的。|Runs in your browser: completes the pool by the rules and lays out the prompt. It needs no network, so drawing is instant.
規則表|Rule tables
哪些字只在夜裡、哪些只在室內、哪個分級能用、誰跟誰不能同框、哪個動作要兩個人。引擎每抽一個字都問它。|Which tags only happen at night or indoors, which rating allows them, what can't share a picture, which actions need two people. The engine checks it for every tag.
每張牌的資料：中文名、花色、細分類、互斥格、附帶誰、哪些時代、哪些尺度。由原料用腳本產生，不手改。|Data for every card: name, category, subcategory, exclusive slot, what it includes, eras and content levels. Scripts generate it from the sources; nobody edits it by hand.
詞庫原料|Vocabulary sources
一行一個字的原料、角色表、建議清單。合併、對 Danbooru 改名、補中文名，產生詞庫。|Source lists with one tag per line, the character table and suggestions. Merged, checked against Danbooru renames and given names to become the vocabulary.
第一次準備|First-run setup
伺服器開機時在背景檢查：卡面、Pillow、LoRA Manager、放大模型、姿勢、修臉、WD14，缺什麼補什麼、要問的先問。|Checked in the background when the server starts: card art, Pillow, LoRA Manager, upscale model, pose, face fix, WD14. It adds what's missing and asks first where it should.
在你的電腦上跑的小伺服器：把提示詞套進工作流程送 ComfyUI、傳回進度和成品、存你的資料、送 Discord、解析圖片。|A small server on your computer: puts the prompt into a workflow for ComfyUI, relays progress and results, stores your data, posts to Discord and parses images.
真正畫圖的地方。墨池不碰模型本身，只把工作流程交給它、等它畫完。|Where the pictures are actually painted. Mochi never touches the models; it hands over a workflow and waits for the result.
底模、LoRA|Base models, LoRA
ComfyUI 裡的模型。底模決定畫風；LoRA 加角色、服裝、風格。在墨池的面板裡挑。|Models inside ComfyUI. The base model sets the look; LoRAs add characters, outfits and styles. Pick them in Mochi's panel.
你的資料|Your data
使用次數、牌組、偏好角色、作品冊、出圖日誌、設定。所有裝置共用一份，搬家帶這個資料夾就好。|Usage counts, decks, favorite characters, gallery, history and settings. One copy is shared by all your devices; to move, take this folder.
卡面|Card art
每張牌的插畫。全年齡的從 GitHub 下載；其他的用你的 ComfyUI 烤（bake_card_art.py）。|The art on each card. General art downloads from GitHub; the rest is baked by your ComfyUI (bake_card_art.py).
選用|Optional
印好的圖照分級、角色、標籤分頻道送出去。不設就不送。|Finished pictures go to Discord channels by rating, character or tag. Nothing is sent unless you set it up.
按下抽並生圖|Press Draw & generate
池子交給引擎|The pool goes to the engine
每個字問規則|Each tag checks the rules
查詞庫|Look up the vocabulary
排好提示詞|The prompt is ready
送伺服器|Send to the server
套進工作流程|Fill in the workflow
載入底模、LoRA|Load the base model and LoRA
邊畫邊傳預覽|Live previews while painting
寫進日誌、記次數|Log it and count usage
成品掛上牆|The result goes on the wall
你看到圖|You see the picture
（有設的話）送 Discord|Post to Discord (if set up)
原料合併成詞庫|Sources merge into the vocabulary
伺服器發給網頁|The server sends it to the pages
第一次準備：缺卡面就烤|First run: bake missing art
一張牌一張插畫|One picture per card
牌面上看得到|Shown on the cards
引擎照詞庫抽|The engine draws from the vocabulary
牌分七種花色，每種花色再分細分類。點一種花色看裡面有什麼。所有數字都是現在這份詞庫即時算的。|Cards come in seven categories, each split into subcategories. Click one to look inside. Every number is computed live from the current vocabulary.
張牌|cards
個細分類|subcategories
個互斥格|exclusive slots
張會附帶別張|cards that include others
詞庫是怎麼做出來的|How the vocabulary is built
原料|Sources
裡的原料、角色表、建議清單：一行一個字，寫它屬於哪裡、跟誰互斥、附帶什麼、哪些時代、哪些尺度。|source lists, the character table and suggestions: one tag per line, with its slot, exclusions, inclusions, eras and content levels.
合併|Merge
把原料併成一份，對 Danbooru 改名表，擋掉禁用字。|merges the sources into one file, applies Danbooru renames and drops banned tags.
中文名|Chinese names
補上每張的中文名。|adds each card's Chinese name.
卡面工作表|Card art jobs
算出每張牌的卡面提示詞；|works out each card's art prompt;
照它烤。|bakes from it.
互斥圖、加入日|Conflict map, dates added
誰跟誰不能同框的總表；每張牌第一次進詞庫的時間（卡冊排序用）。|A table of what can't appear together, and when each card first joined (used to sort the Card Book).
新字要先對 Danbooru（有沒有這個字、多少張圖），再用固定的五個種子試畫；畫不出來、畫錯、畫成小孩的不收。|New tags are checked on Danbooru first (does it exist, how many images), then test-rendered with five fixed seeds. Anything that won't render, renders wrong or looks like a child is rejected.
這是真的引擎：挑幾張牌放進池子、選分級，按「抽一張」。每個字照它是怎麼來的上色，滑鼠停上去看理由。|This is the real engine. Put a few cards in the pool, choose a rating and press Draw one. Each tag is colored by where it came from; hover to see why.
放進池子|Put in the pool
你放的牌先進場|Your cards go in first
池子裡的牌一定在，連它附帶的一起。|Cards in the pool always appear, along with what they include.
分級、尺度|Rating and content level
分級是上限；這一張抽一個尺度（活動、誘惑…）。|The rating is the ceiling; each picture draws one content level (Activity, Suggestive…).
沒指定就隨機挑一個，整張照那個時代。|Picked at random unless you set one; the whole picture follows that era.
幾個人、男女：決定哪些動作能用。|How many people, and who: this decides which actions are possible.
補骨架、補細節|Frame first, then details
髮長、瞳色、鏡頭、表情、場地、晝夜…每格補一張，再照「每段抽幾個」補細節。|Hair length, eye color, camera, expression, place, time of day… one card per slot, then details by the per-section counts.
互斥、規則、修補|Exclusions, rules, repairs
同一格只留一張；夜晚不配藍天、室內不配海浪；缺衣服就補一件。|One card per slot; no blue sky at night, no waves indoors; missing clothes get added.
排成提示詞|Build the prompt
人數在前、畫質在後，送 ComfyUI。|People first, quality tags last, then off to ComfyUI.
修補|Repair
畫質、評分詞|Quality and score tags
這一張沒有字被拿掉。|Nothing was dropped this time.
滑鼠停在字上看它從哪來。|Hover a tag to see where it came from.
你封鎖的|You blocked it
尺度不合|Wrong content level
分級擋掉|Blocked by rating
時代不合|Wrong era
人數不合|Wrong number of people
姿勢跟動作衝突|Pose conflicts with the action
場地跟動作衝突|Place conflicts with the action
運動跟場地不合|Sport doesn't fit the place
衣服層次不對|Clothing layers clash
內衣被蓋住|Underwear would be hidden
缺前提|Missing prerequisite
收尾整理|Final cleanup
修補拿掉|Removed by repair
被換掉|Replaced
一張圖只會有一種髮色、一種瞳色、一種髮長：同一格的牌「互斥」，新放的會把舊的換下來。有些牌放進來會「附帶」別張：夏日洋裝一定是洋裝。這兩件事都可以在墨池的規則裡關掉。|A picture has one hair color, one eye color, one hair length: cards in the same slot are exclusive, and a new one replaces the old. Some cards include others: a sundress is always a dress. Both can be switched off in the Ink Pool's rules.
互斥：點一個髮色放進池子|Exclusive: put a hair color in the pool
附帶：放一張會帶別張的牌|Included: place a card that brings others
互斥打開：同一格只留最新放的那張。|Exclusive is on: only the newest card in a slot stays.
互斥關掉：同一格的牌都留著。|Exclusive is off: every card in a slot stays.
池子裡有長髮。點紅髮，再點黑髮看看。|The pool has long hair. Click red hair, then black hair.
點上面一張牌|Click a card above
放回|Put back
最大的幾個互斥格|The largest exclusive slots
分級是上限：全年齡、敏感、色情，往上一級才多開一批牌。尺度是這一張要多露：活動、誘惑、走光、性愛。時代決定場景和衣服：江戶抽木屐、和服，現代抽球鞋、地鐵站。|Rating is the ceiling: General, Sensitive, Explicit, and each step up unlocks more cards. Content level is how much one picture shows: Activity, Suggestive, Exposure, Sexual. Era sets the places and clothes: Edo draws geta and kimono, Modern draws sneakers and subway stations.
最安全的一級|The safest level
全年齡：大部分的牌都在這一級。|General: most cards live here.
穿著整齊，做事情：讀書、跑步、做菜。|Fully dressed, doing things: reading, running, cooking.
撩人但不露點：泳裝、睡衣、姿勢。|Alluring without nudity: swimsuits, sleepwear, poses.
衣服掀開、意外露出。只在敏感以上。|Clothes lifted, accidental exposure. Sensitive and up only.
只在色情分級。要兩個人以上的動作，人數不夠就不抽。|Explicit only. Actions that need two or more people are skipped when there aren't enough.
不是只靠一道牆：從詞庫到送出前，一共五層。任何一層擋到，那個字就到不了 ComfyUI。|Not one wall but five layers, from the vocabulary to the moment of sending. If any layer catches a tag, it never reaches ComfyUI.
未成年角色|Underage characters
不做成牌|Never a card
loli、shota、baby 這類未成年相關的字：詞庫認得、但永遠不做成牌，抽不到、釘不住；從別處貼上的提示詞也不收（貼上會說「不收」）。|Minor-related tags such as loli, shota and baby are known to the vocabulary but never become cards: they can't be drawn or pinned, and pasted prompts can't bring them in (pasting says they were rejected).
瞳色|Eye color
胸部大小|Breast size
連身服裝|One-pieces
鞋類|Footwear
腿上|Legwear
頭部配件|Headwear
手上|Hands
首飾|Jewelry
內衣上|Bras
內衣下|Panties
瀏海|Bangs
腰|Waist
手勢|Hand gestures
性愛動作|Sex acts
禁用角色|Blocked characters
個角色查過年齡：未滿 18、學生、外觀像兒童、真人，一律不能抽。卡冊打開「含禁用」只列名字，不能用。|characters were checked for age: anyone under 18, students, childlike looks and real people can never be drawn. The Card Book's blocked list shows names only; they can't be used.
新字要試畫|New tags are test-rendered
每個新字用五個種子試畫，畫成小孩的不收。|Each new tag is rendered with five seeds; any that come out looking like a child are rejected.
卡面提示詞|Card art prompts
每張有人物的卡面都寫 adult、mature female／male，負面詞擋 loli、child、teenage；兩人以上的不畫成全家福。|Every card with people says adult and mature female/male, with loli, child and teenage in the negative prompt; groups are never painted as family portraits.
送出前再查一次|Checked again before sending
伺服器送 ComfyUI 之前把整段提示詞再對一次禁用表，有就整張不送。|Before anything goes to ComfyUI, the server checks the whole prompt against the block list again and refuses the picture on any match.
頂欄的五個分頁，各管一件事。點一個看它能做什麼。|The five tabs at the top each do one job. Click one to see what it can do.
抽牌、生圖的主房間。|The main room for drawing cards and generating pictures.
一張牌一層墨，看清楚引擎補了什麼再印。|One card per layer of ink: see exactly what the engine added before printing.
每張牌的來歷。|The history of every card.
收藏的成品和每一次出圖。|Saved pictures and every generation.
丟一張圖，讀出它的標籤變成牌。|Drop in an image and turn its tags into cards.
七種花色翻牌，中英文都能搜；角色可以照作品分格。|Browse seven categories and search in Chinese or English; characters can be grouped by series.
點牌或拖進來＝每張圖都一定有。可以調份量（0.8～1.4）；互斥、附帶兩個開關。|Click or drag a card in and every picture has it. Adjust its weight (0.8–1.4); switches for Exclusive and Included.
偏好卡牌、牌組、貼上|Favorites, decks, paste
常用的牌攤在底部；整組存成牌組；貼一段別處的提示詞，詞庫有的變成牌。|Favorite cards sit along the bottom; save a set as a deck; paste a prompt from elsewhere and known tags become cards.
尺度、時代、人物、尺寸、姿勢參考；每段抽幾個、只補哪幾種；場景、職業、抽角色。|Content level, era, cast, size, pose reference; how many per section and which kinds to add; scenes, jobs, random characters.
抽|Draw
一次幾張、無限抽（可設張數停）、同一個人、只抽牌不生圖、固定種子。|How many at once, continuous drawing (with an optional stop count), same person, draw without generating, fixed seed.
每張的牌攤開看；撤下、收藏、照這張再印；Hires 放大、修臉；選 LoRA、底模、工作流程。|See each picture's cards; remove, save or print again; Hires upscale and face fix; choose LoRA, base model and workflow.
放的牌照花色疊進六列；灰色的影子是引擎補的。|Your cards stack into six rows by category; gray shadows are what the engine added.
四張試印|Four proofs
同一個種子抽四組提示詞，加一張牌四組一起重抽，差在哪一眼看出來。|Four prompts from the same seed; add a card and all four redraw, so the difference is plain to see.
付印、晾紙|Print and hang
挑一組付印；印好的掛在晾紙繩上。|Pick one to print; finished prints hang on the line.
三十組常用的組合，一按就放好。|Thirty common combinations, placed in one click.
自己的規則|Its own rules
規則、偏好卡牌跟墨池分開；附帶開關在規則面板。|Rules and favorites are separate from the Ink Pool; the Included switch is in the rules panel.
用過幾次|Usage counts
多到少、少到多、新到舊（加入日）；只看用過的。|Most to least, least to most, newest first (by date added); used cards only.
哪些牌常出好圖、哪些常被撤下（從出圖日誌算）。|Which cards often make keepers and which often get removed (from the history).
一張牌的詳情|Card details
你親手放幾次、引擎補幾次、用它做過的圖，帶去墨池。|How often you placed it, how often the engine added it, pictures that used it; take it to the Ink Pool.
最多 24 張待用的牌，一次帶走。|Up to 24 cards set aside to take along together.
成就、偏好角色、含禁用|Achievements, favorite characters, blocked
收集進度；常用角色；禁用角色只列名字。|Collection progress; characters you use; blocked characters by name only.
大圖、用了哪些牌；照時代、髮色、服裝、場景分輯，看相似的作品。|Large view and the cards used; browse by era, hair color, outfit or scene, and find similar pictures.
牌、份量、時代、種子、尺寸、底模、LoRA 一起帶回墨池。|Cards, weights, era, seed, size, base model and LoRA all go back to the Ink Pool.
印過的每一張（沒收藏的也在）：時間、花多久、從哪一頁印的。|Every picture printed, saved or not: when, how long it took, and from which room.
模型成績單|Model report
每個底模、LoRA 印了幾張、收藏幾張、撤下幾張。|For each base model and LoRA: how many printed, saved and removed.
拖進來、貼上、選檔；網頁先縮小再送。|Drag, paste or choose a file; the page shrinks it before sending.
ComfyUI 認出畫面裡的字；跑兩個門檻，分出「確定」和「可能」。|ComfyUI reads the tags in the picture at two thresholds, sorting them into Sure and Likely.
對詞庫|Match the vocabulary
詞庫有的變成牌、照花色排；沒有的列出來可以複製；不能用的字不收。|Known tags become cards sorted by category; unknown ones are listed to copy; disallowed tags are dropped.
挑好的牌帶去合成池或疊印台；解析設定可以換模型、門檻、不要的字。|Take the chosen cards to Pinned cards or the Fuse Bed; parse settings change the model, thresholds and excluded tags.
按下「抽並生圖」之後，一張圖會走過這幾站。|After you press Draw & generate, a picture passes through these stops.
伺服器把提示詞套進工作流程（底模、LoRA、尺寸、種子），交給 ComfyUI。同時印好幾張會排隊。|The server fills the prompt into a workflow (base model, LoRA, size, seed) and hands it to ComfyUI. Several at once wait in line.
邊畫邊看|Watch it paint
ComfyUI 每一步的預覽即時傳回網頁；卡住、斷線會自己接回來，手機換頁也看得到進度。|ComfyUI's preview for every step streams back to the page. Stalls and dropped connections recover on their own, and a phone that switches pages still sees progress.
成品掛上牆。每張都記著「你放的牌」和「引擎補的牌」，可以單張撤下、收藏、照這張再印。|The result goes on the wall. Each one remembers your cards and the engine's, and can be removed, saved or printed again.
再加工|Touch-ups
Hires 放大、修臉（只重畫臉）、換底模重印，都從成品下面的按鈕。|Hires upscale, face fix (redraws only the face) and printing again with another base model, from the buttons under each result.
記帳|Bookkeeping
每張圖寫進出圖日誌；用到的牌各加一次，卡冊就知道誰常出好圖。|Each picture goes into the history and every card used gets +1, so the Card Book knows which cards do well.
送出去|Send it out
設定了 Discord，就照分級、角色、標籤分頻道送過去。|With Discord set up, pictures go to channels by rating, character and tag.
每改一次，整套測試跑一遍再推上去。|Every change runs the full test suite before it ships.
段測試，同時跑約 16 分鐘：抽牌規則、互斥、分級、時代、伺服器、網頁畫面、英文版。|test stages, about 16 minutes in parallel: drawing rules, exclusions, ratings, eras, server, pages and the English version.
張固定種子的抽牌指紋：引擎的抽法一變就知道。|fixed-seed draw fingerprints: any change in how the engine draws shows up.
個 repo：墨池另外開源成 danbooru_tag_mochi，每次同步、在 Windows、Mac、Linux 上自動測。|repositories: Mochi is also open source as danbooru_tag_mochi, synced every time and tested automatically on Windows, Mac and Linux.
看懂了，就去試一次。|Got it? Go try it.
去墨池|Go to the Ink Pool
看教學影片|Watch the tutorial
讀不到詞庫：請用啟動檔開（start.bat），不要直接點 HTML。|Couldn't load the vocabulary. Open Mochi with the launcher (start.bat), not by double-clicking the HTML file.
長期常用的單張牌，不限張數。|Long-term favorite cards, as many as you like.
點字盒裡的牌加進來。|Click library cards to add them.
點卡冊裡的牌加進來。|Click cards in the book to add them.
點卡冊裡的牌加進來，再點一次拿掉|Click cards in the book to add them; click again to remove
這張是禁用角色，不能帶去墨池，也不能加進偏好卡牌。|This character is blocked. It can't go to Ink Pool or into your favorite cards.
送墨池|Sent
禁用角色不能加進偏好卡牌|Blocked characters can't be added to favorite cards
加進偏好卡牌（再按一次拿掉）|Add to favorite cards (press again to remove)
送去墨池合成池，留在卡冊繼續挑（再按一次拿回來）|Send to the Ink Pool mix and keep browsing (press again to take it back)
長期常用的牌放進偏好卡牌（墨池底下那排）|Keep long-term favorites in your favorite cards (the row at the bottom of Ink Pool)
從偏好卡牌拿掉|Remove from favorite cards
打開、收起偏好卡牌|Open or close favorite cards
用過幾次、戰績、用它做過的圖都在這裡；可以帶去墨池，或加進偏好卡牌。|See usage, performance and images for this card. Send it to Ink Pool or add it to your favorite cards.
偏好卡牌、送去墨池|Favorite cards and sending to Ink Pool
牌上的 ＋ 把牌送去墨池合成池，人留在這裡繼續挑。展開底下的偏好卡牌時，點牌就收進長期常用的那一排（跟墨池同一份）。|+ on a card sends it to the Ink Pool mix while you keep browsing. With favorite cards open below, clicking a card adds it to that long-term row (shared with Ink Pool).
＋ 送去墨池、偏好卡牌|+ to Ink Pool, favorite cards
＋ 送牌去墨池合成池，留在卡冊繼續挑；展開偏好卡牌時點牌收進托盤（跟墨池同一份）。|+ sends a card to the Ink Pool mix while you stay in the book; with favorite cards open, clicking a card adds it to the tray (shared with Ink Pool).
把偏好卡牌存成牌組，或把牌組換成偏好卡牌|Save favorite cards as a deck, or load a deck as favorite cards
貼一段提示詞，詞庫有的變成偏好卡牌|Paste a prompt; cards in the lexicon become favorite cards
社群|Community
加入墨池的 Discord 伺服器、GitHub|Join the Ink Pool Discord server, or visit GitHub
加入墨池的 Discord？|Join the Ink Pool Discord?
墨池有一個 Discord 伺服器，要不要一起來？|Ink Pool has a Discord server. Want to join us?
墨池的 Discord 伺服器，歡迎加入。|The Ink Pool Discord server. Come say hi.
分享你印的圖、看別人怎麼配牌|Share your prints and see how others pick cards
問用法、回報問題，有人會回|Ask questions or report bugs, and someone will answer
許願想要的牌、規則、功能|Request cards, rules and features
新版、新卡面第一時間公告|Hear about new versions and card art first
原始碼在 GitHub：|Source code on GitHub:
之後想加入：按頂欄的「社群」。|To join later, press Community in the header.
看看墨池的介紹頁 →|See the Ink Pool intro page →
之後再說|Maybe later
加入 Discord|Join Discord
複製連結|Copy link
邀請連結複製好了|Invite link copied
複製不了：請手動選取網址|Could not copy. Select the link by hand.
加入社群|Join the community
頂欄的「社群」：加入墨池的 Discord 伺服器，分享作品、問用法、回報問題、許願新牌都在那裡；原始碼在 GitHub。|Community in the header opens the Ink Pool Discord server. Share prints, ask questions, report bugs and request cards there. The source code is on GitHub.
介紹|About
墨池：把 Danbooru 標籤變成一副有插畫的牌，挑幾張，引擎照規則補齊，送進你自己的 ComfyUI 畫。免費、開源，有 Discord 社群。|Ink Pool turns Danbooru tags into an illustrated deck. Pick a few cards, let the engine fill in the rest and render with your own ComfyUI. Free, open source, with a Discord community.
這一頁|On this page
開始用|Get started
免費|Free
開源|Open source
在你自己的電腦上跑|Runs on your own computer
把 Danbooru 標籤|Turn Danbooru tags
變成|into
一副牌|a deck of cards
挑幾張你想要的牌，其他的交給引擎照規則補齊，排成一段提示詞，送進你自己的 ComfyUI 畫出來。|Pick a few cards you want. The engine fills in the rest by its rules, writes the prompt and sends it to your own ComfyUI.
張牌，每張都有中文名和一張插畫。|cards, each with a name and its own illustration.
手機也能用|Works on phones too
墨池的數字|Ink Pool in numbers
個角色|characters
個房間|rooms
開源，免費|Open source and free
每個房間做一件事，牌可以在房間之間帶來帶去。|Each room does one job, and cards travel between rooms.
放幾張牌，按一下「抽並生圖」：引擎補齊其餘的牌，送 ComfyUI 畫。成品掛在牆上，可以收藏、放大、修臉、照這張再印。|Pin a few cards and press Draw & generate. The engine fills in the rest and ComfyUI renders it. Prints hang on the wall, ready to save, upscale, fix faces or print again.
一張牌一層墨，照花色疊進卡池。先看四張試印的提示詞，挑一張再付印。|One card, one layer of ink, stacked by suit. Compare four proof prompts, pick one, then print.
每張牌用過幾次、出過哪些好圖；收集進度和成就，喜歡的牌收進偏好卡牌。|How often each card was used and which prints it made. Collection progress, achievements, and a tray for your favorite cards.
收藏的、印過的每一張：大圖、用了哪些牌、哪個模型，一鍵帶回墨池再印。|Every saved and printed image, with its cards and model. Send any of them back to Ink Pool in one click.
丟一張圖進來，認出畫面裡的標籤，詞庫有的變成牌，帶去合成池或疊印台。|Drop in an image. Tags found in it become cards you can take to the pool or Fuse Bed.
不是亂抽|Not just random
引擎每抽一個字，都先問過規則。|Every tag the engine draws is checked against the rules first.
懂畫面|It understands the picture
一張圖只有一種髮色；雙馬尾帶出髮飾；夜景不配陽光；室內不下雨。互斥、附帶、時代、白天黑夜都有規則。|One hair color per image. Twintails bring hair ties. No sunlight at night, no rain indoors. Conflicts, dependencies, eras and time of day all have rules.
分級分得清|Clear ratings
全年齡、敏感、色情三段，再配尺度。跟未成年有關的字一律擋掉，不會抽到、也送不出去。|General, Sensitive and Explicit, plus content levels. Anything related to minors is blocked: never drawn and never sent.
你的電腦、你的模型|Your computer, your models
連你自己的 ComfyUI：底模、LoRA、放大、修臉、姿勢參考都在面板裡挑。資料只存在你的電腦上。|It drives your own ComfyUI. Choose checkpoints, LoRAs, upscaling, face fixes and pose references in the panels. Your data stays on your computer.
手機也能印|Print from your phone
走 Tailscale 連回家裡那台，躺在床上挑牌，電腦在書桌上畫。|Connect to your home PC over Tailscale. Pick cards from bed while the desktop renders.
一起來玩|Come hang out
有問題、有好圖、有想要的牌，都歡迎來。|Questions, great prints, card requests: all welcome.
加入 Discord 伺服器|Join the Discord server
在墨池裡也找得到：頂欄的「社群」。|Inside Ink Pool, it is under Community in the header.
GitHub 開源|Open source on GitHub
程式碼用 GPLv3 授權，誰都可以看、可以改。更新紀錄、卡面包也都在這裡。|The code is GPLv3, so anyone can read and change it. Release notes and card art packs live here too.
看原始碼|View source
下載最新版|Download the latest
回報問題|Report a bug
三步開始|Three steps to start
第一次準備的東西（卡面、模型）伺服器會在背景補，網頁上一項項看得到。|First-run downloads such as card art and models happen in the background, and the page shows each one.
裝好 ComfyUI|Install ComfyUI
墨池不碰模型本身，只把工作流程交給 ComfyUI 畫。底模推薦 WAI-Illustrious。|Ink Pool never touches the models. It hands workflows to ComfyUI. WAI-Illustrious is the recommended checkpoint.
下載墨池|Download Ink Pool
在 GitHub 按 Code → Download ZIP，或用 git：|On GitHub, press Code → Download ZIP, or use git:
雙擊 start.bat|Double-click start.bat
它開一個小伺服器、打開瀏覽器。第一次來會問你要不要加入 Discord，再帶你走一遍導覽。|It starts a small server and opens your browser. On the first visit it asks whether you want to join Discord, then offers a tour.
打開墨池|Open Ink Pool
看介紹影片|Watch the intro film
卡面、字型、第三方程式庫各自授權|Card art, fonts and third-party libraries keep their own licenses
自製|Custom
存檔|Save
找牌：紅髮、kimono…（Enter 加第一張）|Find cards: red hair, kimono… (Enter adds the first)
這一格沒有牌。|No cards here.
分類|Categories
或做成一張自製牌（可以調權重、加詞庫沒有的字）|Or make it a custom card (weights, words outside the lexicon)
帶去墨池|Take to Ink Pool
新增自製牌|New custom card
貼上分享碼|Paste share code
還沒有自製牌|No custom cards yet
把常用的幾張牌（可以調權重）加上詞庫沒有的字，包成一張自己的牌；墨池、疊印台放進去就是那幾張。|Bundle cards you use together (with weights) plus words the lexicon lacks into one card of your own. Put it in the Ink Pool or Fuse Press and you get those cards.
名字，例如：法琳海邊|Name, e.g. Falin at the beach
名字|Name
編輯方式|Editing mode
貼提示詞|Paste prompt
貼上一整串提示詞，用逗號分開：1girl, beach, (huge breasts:1.2), sparkle eyelashes|Paste a whole prompt, comma-separated: 1girl, beach, (huge breasts:1.2), sparkle eyelashes
詞庫有的變成牌，對不到的放進「詞庫外」；權重括號 (tag:1.2) 會讀進來。|Words in the lexicon become cards; the rest go under “Not in lexicon”. Weights like (tag:1.2) are kept.
卡面種子|Card art seed
烤卡面預覽|Bake art preview
重烤|Bake again
從填入重新產生|Rebuild from Fill
填入|Fill
送去生圖的|What gets generated
只拿來烤這張牌的插畫|Only used to bake this card’s art
放牌進來|Add cards
這張牌|This card
找不到。打的字詞庫沒有的話，可以切到「貼提示詞」直接打進來。|Nothing found. If the word isn’t in the lexicon, switch to “Paste prompt” and type it there.
這個花色沒有牌。|No cards in this suit.
一張自製牌最多 20 張牌|A custom card holds at most 20 cards
詞庫外|Not in lexicon
詞庫外：引擎不會檢查|Not in lexicon: the engine won’t check it
貼上提示詞，這裡就會列出拆好的牌。|Paste a prompt and the cards it contains show up here.
從左邊點牌加進來，或切到「貼提示詞」。|Pick cards on the left, or switch to “Paste prompt”.
詞庫外的字沒辦法確認分級：請自己確定它真的是全年齡。|Words outside the lexicon can’t be rated: make sure they really are all-ages.
手動改過|Edited
自動|Auto
卡面跟填入不一樣了：要的話按「從填入重新產生」，改完重烤一次。|Card art no longer matches Fill: press “Rebuild from Fill” if you want, then bake again.
還沒有卡面|No card art yet
至少要有一張牌或一個字|Add at least one card or word
卡面還在烤|Card art is still baking
種子要是數字（留空＝隨機）|The seed must be a number (empty = random)
烤好了：這是預覽，按「存檔」才會換上。|Baked: this is a preview; it replaces the art when you press Save.
ComfyUI 沒開：先用拼貼卡面，之後再回來烤。|ComfyUI isn’t running: the card uses a collage for now; bake later.
烤失敗了：|Baking failed:
複製不了：請自己選起來複製|Couldn’t copy: select it and copy it yourself
把分享碼貼在這裡（mochi-card: 開頭）|Paste the share code here (starts with mochi-card:)
墨池、疊印台放進去，就是裡面這幾張牌（照樣補其他段、照樣檢查互斥）；詞庫外的字接在提示詞裡。|In the Ink Pool or Fuse Press this card is the cards inside (other sections still fill, conflicts still apply); words outside the lexicon are added to the prompt.
複製分享碼|Copy share code
一行文字，貼到 Discord 給別人；對方在卡冊「自製」按「貼上分享碼」就拿到同一張|One line of text to post on Discord; others press “Paste share code” under Custom in the Card Book to get the same card
分享碼複製好了：貼給別人，對方在卡冊「自製」按「貼上分享碼」|Share code copied: send it, and they press “Paste share code” under Custom in the Card Book
複製這段分享碼|Copy this share code
不是自製牌的分享碼（要是 mochi-card: 開頭）|Not a custom card share code (it starts with mochi-card:)
分享碼壞掉了，請整段重新複製|The share code is broken; copy the whole thing again
去卡冊編輯|Edit in Card Book
拆開|Split
裡面的牌留在池子裡，變成一張張的牌|The cards inside stay in the pool as separate cards
裡面|Inside
放進合成池就是裡面這幾張牌：照樣補其他段、照樣檢查互斥；詞庫外的字接在提示詞裡。|In the mix this card is the cards inside: other sections still fill, conflicts still apply; words outside the lexicon are added to the prompt.
做成自製牌|Make custom card
把這張用到的牌包成一張自製牌（到卡冊編輯）|Bundle this image’s cards into a custom card (edit it in the Card Book)
把這件用到的牌包成一張自製牌（到卡冊編輯）|Bundle this work’s cards into a custom card (edit it in the Card Book)
把這組牌包成一張自製牌（到卡冊編輯）|Bundle this deck into a custom card (edit it in the Card Book)
存成自製牌|Save as custom card
無法交接，請檢查瀏覽器儲存空間。|Couldn’t hand off; check the browser’s storage.
自製牌要有名字|A custom card needs a name
卡面提示詞是空的|The card art prompt is empty
找不到這張自製牌|Custom card not found
自製牌最多 300 張，先刪掉一些|You can have at most 300 custom cards; delete some first
詞庫外的字太多了（最多 12 個、300 字）|Too many words outside the lexicon (at most 12, 300 characters)
分級要是全年齡、敏感或色情|Rating must be all-ages, sensitive or explicit
`;

export const messages = Object.freeze(Object.fromEntries(copy.trim().split("\n").map((line) => {
  const split = line.indexOf("|");
  return [line.slice(0, split), line.slice(split + 1)];
})));

// {0} is translated again (card names, ratings); {0!} is inserted verbatim
// because it is user content: deck, work, model and workflow names, search text.
const parameterized = String.raw`
「{0}」是禁用角色|“{0!}” is blocked
一共 {0} 張禁用角色被藏著|{0} blocked characters are hidden
用過 {0} 次，{1} 加入|Used {0} times, added {1!}
用過 {0} 次，第 {1} 名，{2} 加入|Used {0} times, rank {1}, added {2!}
還沒用過，{0} 加入|Never used, added {0!}
，{0} 加入|, added {0!}
，第 {0} 名，{1} 加入| · Rank #{0}, added {1!}
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
找不到「{0}」。|No match for “{0!}”.
頻道最多 {0} 個|Up to {0} channels
{0} 位角色|{0} characters
已送 {0}・失敗 {1}|Sent {0} · failed {1}
已送 {0}|Sent {0}
{0}搜尋結果|{0} results
{0}的比對方式|How {0} match
拿掉 {0}|Remove {0!}
最多 {0} 個|Up to {0}
連線超過 {0} 秒沒有回應，接不回這張|No response for {0} seconds; couldn’t get this image back
一直送不出去，停下來了：{0}|Kept failing to send, stopped: {0}
伺服器上的{0}存檔（{1}）壞了，也沒有能用的備份。壞掉的那份改名成 {2} 留著；之後存的會從空的開始。|The server’s {0} file ({1!}) is corrupted and has no usable backup. It was renamed to {2!}; new saves start from empty.
{0} 位|{0} characters
「{0}」加進偏好角色|Added “{0!}” to favorite characters
「{0}」拿出偏好角色|Removed “{0!}” from favorite characters
「{0}」已經是偏好角色|“{0!}” is already a favorite character
每排 {0} 張|{0} per row
這張修過 {0} 層臉。|Faces fixed {0} times on this image.
修過臉 ×{0}|Faces fixed ×{0}
退回上一層了：還有 {0} 層|Undid the last fix: {0} left
修臉 {0}%|Face fix {0}%
缺 {0}：重開墨池，第一次準備會問要不要裝；裝過了就重開 ComfyUI|Missing {0}. Restart Mochi and First-time setup will offer to install it. Already installed? Restart ComfyUI.
缺 {0}：之前選了不要再問：刪掉 .no-face-fetch 再重開墨池，第一次準備就會問要不要裝|Missing {0}. You chose not to be asked again: delete .no-face-fetch and restart Mochi, and First-time setup will offer to install it.
缺 {0}：ComfyUI 在別台電腦，請在那台裝 Impact Pack、Impact Subpack 和 face_yolov8m.pt|Missing {0}. ComfyUI runs on another computer: install Impact Pack, Impact Subpack and face_yolov8m.pt there.
跟 ComfyUI 要 FaceDetailer 的欄位失敗：{0}|Could not read FaceDetailer inputs from ComfyUI: {0!}
印製中，還有 {0} 張|Generating · {0} remaining
牌 · {0}|Cards · {0}
拖進合成池就釘住，丟進廢字簍就封鎖|Drag to pin or block
點牌：放進合成池或丟進廢字簍|Tap a card to pin or block it
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
分級切回「{0}」|Rating restored to {0}
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
{0} 張圖|{0} images
沒有一張同時有「{0}」，分別找到這些|No single card has all of “{0!}”; showing each separately
找不到「{0}」，你是不是要找這幾張？|No match for “{0!}”. Did you mean these?
印製中 {0}%|Printing {0}%
修臉 {0}%|Face fix {0}%
排隊 {0} 張|{0} queued
今晚印好 {0} 張|{0} printed tonight
今天印好 {0} 張|{0} printed today
這張會標成「{0}」，但尺度勾了{1}：內容可能比標的分級露骨|This image will be labeled {0}, but the content level includes {1}; it may be more explicit than the label
分級改成{0}|Set rating to {0}
時代改成「混合」：{0}放回來了，不同時代的牌可以一起出現|Era set to Mixed: {0} back in the pool; cards from different eras can appear together
從{0}帶來 {1} 張牌，換掉了原本的 {2} 張|Pinned {1} cards from {0}, replacing the {2} you had
「{0}」在{1}看不到|“{0}” is hidden at {1}
一共 {0} 張搜得到的被擋住；{1}以上才有，或打開分級左邊的「不限制」。|{0} matching cards are hidden; they appear at {1} and above, or turn on No limit next to the rating.
{0}以上才有，或打開分級左邊的「不限制」。|Appears at {0} and above, or turn on No limit next to the rating.
{0} 件作品在{1}看不到|{0} works are hidden at {1}
種子固定 {0}|Seed fixed {0}
{0} 張會一定進圖|{0} pinned cards
合成池 {0} 張|{0} pinned cards
點牌＝加進偏好卡牌 {0}/{1}|Tap a card = add to Favorite cards {0}/{1}
點牌＝加進偏好卡牌 {0}|Tap a card = add to Favorite cards {0}
點牌＝丟進廢字簍（{0}）|Tap a card = block it ({0} blocked)
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
「{0}」放回合成池了|Put “{0}” back in the pool
「{0}」從廢字簍撿回來了|Took “{0}” back out of Blocked cards
把「{0}」拿出合成池|Unpin “{0}”
偏好卡牌最多 {0} 張，先拿掉一張再加|Favorites holds up to {0} cards. Remove one first.
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
從{0}帶來的牌加進合成池了，共 {1} 張|Added the cards from {0} · {1} pinned in total
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
LoRA：清單來自 ComfyUI（{0} 個）。想要預覽圖和觸發詞：在 ComfyUI 裝 LoRA Manager（裝完重開 ComfyUI），或在 config.json 填 paths.loraRoot。|LoRA: list from ComfyUI ({0!}). For preview images and trigger words, install ComfyUI LoRA Manager (restart ComfyUI after installing it) or set paths.loraRoot in config.json.
LoRA：沒設定 paths.loraRoot，改問 ComfyUI 也失敗了：{0}|LoRA: no LoRA Manager or paths.loraRoot, and ComfyUI could not be reached: {0!}
第一次使用：準備中 {0}/{1}|First-time setup {0}/{1}
重開失敗（{0}）：請自己重開 ComfyUI|Restart failed ({0!}). Restart ComfyUI yourself.
{0}（下次啟動接著抓）|{0} (resumes next launch)
{0}：清掉篩選|{0}: clear filter
偵測到缺 {0} 張全年齡卡面、{1} 張是舊版（例：{2}）：從 GitHub 下載全年齡卡面：先抓縮圖（約 30 MB），再抓大圖（約 103 MB）|Found {0} all-ages cards missing and {1} outdated (e.g. {2}): downloading the all-ages card art from GitHub, thumbnails first (about 30 MB), then full size (about 103 MB)
偵測到缺 {0} 張全年齡卡面（例：{1}）：從 GitHub 下載全年齡卡面：先抓縮圖（約 30 MB），再抓大圖（約 103 MB）|Found {0} all-ages cards missing (e.g. {1}): downloading the all-ages card art from GitHub, thumbnails first (about 30 MB), then full size (about 103 MB)
偵測到{0} 張是舊版（例：{1}）：從 GitHub 下載全年齡卡面：先抓縮圖（約 30 MB），再抓大圖（約 103 MB）|Found {0} outdated all-ages cards (e.g. {1}): downloading the all-ages card art from GitHub, thumbnails first (about 30 MB), then full size (about 103 MB)
提示詞裡有不能用的字（未成年、真人等角色不收）：{0!}|The prompt has blocked tags (underage, real-person and similar characters are not allowed): {0!}
不在公開下載包裡；用你的底模烘 {0} 張，大約 {1} 分鐘|Not in the public download. Baking {0} cards with your checkpoint takes about {1} minutes.
版權角色不在公開下載包；用你的底模烘 {0} 張，大約 {1} 分鐘|Characters are copyrighted and not in the public download. Baking {0} cards with your checkpoint takes about {1} minutes.
顯示卡記憶體不夠（{0}）：尺寸調小、先不要 Hires，或關掉同時在跑的東西再試|Out of GPU memory ({0!}). Use a smaller size, skip Hires, or close whatever else is running, then try again.
顯示卡記憶體不夠：尺寸調小、先不要 Hires，或關掉同時在跑的東西再試|Out of GPU memory. Use a smaller size, skip Hires, or close whatever else is running, then try again.
ComfyUI 跑到一半出錯（{0}）：{1}|ComfyUI failed while generating ({0!}): {1!}
ComfyUI 跑到一半出錯：{0}|ComfyUI failed while generating: {0!}
ComfyUI 退件：{0}（另外還有 {1} 個）|ComfyUI rejected the workflow: {0} ({1} more)
ComfyUI 退件：{0}|ComfyUI rejected the workflow: {0}
節點 {0}（#{1}）的 {2} 是「{3}」，ComfyUI 裡沒有這個|{0!} (#{1}): {2!} is “{3!}”, which this ComfyUI does not have
節點 {0}（#{1}）少了輸入 {2}|{0!} (#{1}) is missing input {2!}
節點 {0}（#{1}）：{2}|{0!} (#{1}): {2!}
ComfyUI 沒有裝「{0}」這個節點：用 ComfyUI-Manager 的「Install Missing Custom Nodes」裝好、重開 ComfyUI 再試|This ComfyUI does not have the “{0!}” node. Install it with ComfyUI-Manager's Install Missing Custom Nodes, restart ComfyUI and try again.
字盒裡沒有「{0}」。|No card matches “{0!}”.
看全部|Show all
停止|Stop
現在沒有在跑|Nothing is running
停了：下次啟動會再問（下載會接著抓）|Stopped. You will be asked again next launch (the download resumes).
停了：已經烘好的留著；下次啟動接著烘|Stopped. Cards already baked are kept; baking resumes next launch.
停了：已經烘好的留著，重新整理就看得到；下次啟動會再問|Stopped. Cards already baked are kept; reload to see them. You will be asked again next launch.
ComfyUI 裡還沒有任何底模：下載一個 SDXL 底模（建議 Illustrious 系，例如 WAI-Illustrious）放進 ComfyUI 的 models/checkpoints，重開 ComfyUI 再試|ComfyUI has no checkpoints yet. Download an SDXL checkpoint (an Illustrious model such as WAI-Illustrious is recommended) into ComfyUI's models/checkpoints, restart ComfyUI and try again.
下面決定要改這套工作流的哪些地方，沒選的保留它的原值。|Choose what to change in this workflow. Anything not picked keeps the workflow's value.
沒選就是內建。要用自己的工作流：把 ComfyUI 用它畫的任何一張 PNG 拖進來，或匯入「匯出工作流 (API)」的 JSON。|Built in unless you pick one. To use your own workflow, drop any PNG ComfyUI made with it, or import the JSON from Export (API).
匯入工作流…|Import workflow…
ComfyUI 畫的 PNG 或 API JSON，拖進來或點這裡選檔|Drop a ComfyUI PNG or API JSON here, or click to choose
請拖入 ComfyUI 畫的 PNG，或工作流的 .json 檔。|Drop a PNG made by ComfyUI, or a workflow .json file.
讀不到這張圖：{0}|Could not read this image: {0!}
這不是 PNG 檔。|This is not a PNG file.
這張圖只存了編輯器格式的工作流：在 ComfyUI 打開它，再用「匯出工作流 (API)」存 JSON 匯入。|This image only has the editor workflow. Open it in ComfyUI, use Export (API), and import that JSON.
這張圖裡沒有 ComfyUI 的工作流（存圖時可能拿掉了）。|This image has no ComfyUI workflow (it may have been stripped when saved).
這張圖裡的工作流讀不懂。|The workflow in this image could not be read.
這套工作流沒有 LoRA 節點：LoRA 面板選的會自動接在底模後面。|This workflow has no LoRA nodes. LoRAs picked in the LoRA panel are added after the checkpoint.
不指定：LoRA 面板選的接在底模後面，工作流自己的 LoRA 照留|None: picked LoRAs go after the checkpoint; the workflow's own LoRAs stay
種子、尺寸、底模|Seed, size, checkpoint
種子：每張換新的（{0} 個取樣器跟著換）|Seed: new for every image ({0} samplers follow it)
種子：這套工作流找不到種子欄位，每張會用它自己寫死的那顆。|Seed: no seed field found. Every image uses the workflow's fixed seed.
尺寸：照規則裡選的尺寸|Size: follows the size in Rules
尺寸：保留工作流自己的|Size: keeps the workflow's own
底模：用頂欄選的|Checkpoint: use the one picked in the top bar
底模：保留工作流自己的|Checkpoint: keep the workflow's own
底模：這套工作流沒有底模節點，頂欄選的不會套用。|Checkpoint: this workflow has no checkpoint node, so the top-bar pick is not used.
工作流「{0}」用它自己的底模（在工作流面板可以改成用這裡選的）|Workflow “{0!}” uses its own checkpoint (change this in the Workflow panel)
人物改成不限|Set Cast to Any
顯示所有時代|Show all eras
時代改成混合|Switch era to Mixed
ComfyUI 連不上|ComfyUI unreachable
換種子再印|New seed, print again
同一組牌換一顆生圖種子，再印一張（G）|Print the same cards again with a new image seed (G)
ComfyUI 連不上，等它開好就接著印|ComfyUI is unreachable; printing resumes when it is back
ComfyUI 連不上，等它開好就接著印…|ComfyUI is unreachable; printing resumes when it is back…
ComfyUI 回來了，接著印|ComfyUI is back; printing resumes
ComfyUI 連不上（沒開或重開中），等它開好就接著印|ComfyUI is unreachable (closed or restarting); printing resumes when it is back
改成混合，兩張都留|Switch to Mixed, keep both
時代改成「混合」：不同時代的牌可以一起出現|Era set to Mixed: cards from different eras can appear together
不限制開著：所有牌都抽得到；右邊選的分級是圖本身標的分級|No limit is on: every card can be drawn; the rating on the right is how the image is labeled
不限制關了：牌照右邊選的分級篩選|No limit is off: cards follow the rating on the right
打開不限制|Turn on No limit
「{0}」在「{1}」裡|“{0}” is in {1}
「{0}」要在「{1}」才看得到|“{0}” only appears at {1}
切到{0}|Switch to {0}
「{0}」是男生的牌|“{0}” is a card for men
「{0}」是女生的牌|“{0}” is a card for women
「{0}」不屬於現在的時代|“{0}” is outside the selected era
「{0}」在廢字簍裡：從廢字簍拿出來就看得到|“{0}” is in Blocked cards. Take it out to see it here.
ComfyUI 網址（點一下修改）|ComfyUI URL (click to change)
ComfyUI 連不上 {0}：先開 ComfyUI；位址不對就點頂欄的 Comfy 燈號改|Cannot reach ComfyUI at {0!}. Start ComfyUI, or click the Comfy indicator in the top bar to change the URL.
下載中 {0}%（{1}）|Downloading {0}% ({1!})
下載中 {0}%（{1}，還要約 {2} 分鐘）|Downloading {0}% ({1!}, about {2} min left)
下載中 {0}%（{1}，快好了）|Downloading {0}% ({1!}, almost done)
縮圖好了，重新整理就有圖；大圖接著下載|Thumbnails ready, reload to see them. Full-size images continue in the background
縮圖好了，重新整理就有圖；大圖下載中 {0}%（{1}，還要約 {2} 分鐘）|Thumbnails ready, reload to see them. Full size {0}% ({1!}, about {2} min left)
縮圖好了，重新整理就有圖；大圖下載中 {0}%（{1}，快好了）|Thumbnails ready, reload to see them. Full size {0}% ({1!}, almost done)
縮圖好了，重新整理就有圖；大圖下載中 {0}%（{1}）|Thumbnails ready, reload to see them. Full size {0}% ({1!})
卡面還沒下載好：下次啟動接著抓，不先用你的 ComfyUI 烘|Card art has not finished downloading. It resumes on the next launch; nothing is baked with your ComfyUI meanwhile
公開包裡沒有；用你的底模烘 {0} 張，大約 {1} 分鐘|Not in the public pack. Bake {0} cards with your checkpoint, about {1} min
烘焙中 {0}/{1}|Baking {0}/{1}
下載 {0}…|Downloading {0!}…
安裝 {0} 的 Python 套件…|Installing Python packages for {0!}…
{0}（下次啟動接著做）|{0} (resumes next launch)
已固定成 {0}|Fixed to {0}
例如 {0}|e.g. {0!}
印好 {0} 張・收藏 {1}（{2}%）・撤下 {3}（{4}%）・張數還太少，不排名|{0} generated · {1} saved ({2}%) · {3} discarded ({4}%) · Too few to rank
印好 {0} 張・收藏 {1}（{2}%）・撤下 {3}（{4}%）|{0} generated · {1} saved ({2}%) · {3} discarded ({4}%)
找到 {0} 個 LoRA|{0} LoRAs found
找到 {0} 個底模|{0} checkpoints found
找不到這個資料夾：{0}|Folder not found: {0!}
偏好路徑 {0} 底下沒有 LoRA Manager 認得的 LoRA|LoRA Manager knows no LoRA in the preferred folder {0!}
LoRA：清單來自 ComfyUI（{0} 個）。想要預覽圖和觸發詞：在 ComfyUI 裝 LoRA Manager（裝完重開 ComfyUI），或在 LoRA 面板的「偏好路徑」選你的 LoRA 資料夾。|LoRA: list from ComfyUI ({0!}). For preview images and trigger words, install ComfyUI LoRA Manager (restart ComfyUI after installing it) or choose your LoRA folder under Preferred folder.
LoRA：沒設定偏好路徑，改問 ComfyUI 也失敗了：{0}|LoRA: no preferred folder set, and ComfyUI could not be reached: {0!}
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
已選試印 {0}|Proof {0} selected
起手：{0}|Starter: {0}
已選試印 {0}，尚未生成圖片|Proof {0} selected, no image generated yet
試印 {0} 的提示詞|Prompt for proof {0}
從墨池帶來 {0} 張牌；規則沿用疊印台的設定。|Brought {0} cards from Ink Pool; using the Fuse Bed settings.
從解析池帶來 {0} 張牌；規則沿用疊印台的設定。|Brought {0} cards from Parse Pool; using the Fuse Bed settings.
從解析池帶來 {0} 張牌；{1} 張跟別張互斥或被分級擋掉，沒放進去。|Brought {0} cards from Parse Pool; {1} clashed with other cards or were blocked by the rating and were left out.
試印 {0}|Proof {0}
常補 {0}/4|Used in {0}/4 proofs
你的 {0} 張・引擎補 {1} 張|{0} pinned · {1} engine additions
你的 {0} 張|{0} pinned
引擎補 {0} 張|{0} engine additions
這一版的牌（{0}）|Cards in this image ({0})
剛印好・{0}|Just printed · {0}
放進 {0} 張到合成池|Added {0} cards to the pool
要先在上面的尺度選「{0}」才會補|Turn on {0} in Content level above first
這幾格現在抽不到：要先在上面的尺度選「{0}」。|These kinds cannot be drawn now: turn on {0} in Content level above first.
要先在上面的尺度選「{0}」，選格才抽得到|Turn on {0} in Content level above first, then this kind can be drawn
{0} 張牌，從墨裡流過來|{0} cards, flowing out of the ink
你最近印的 {0} 張，繞著中間那一點光|Your {0} latest images, circling a point of light
一圈一圈轉成一朵花，中間是你最近印的 {0} 張|Ring by ring into a flower, with your {0} latest images at its heart
共 {0} 個|{0} items
再顯示 {0} 個|Show {0} more
LoRA {0} 空著——從中間挑一張|LoRA {0} is empty. Pick one from the grid.
已連上 {0}|Connected to {0!}
連不到 {0}|Cannot reach {0!}
印好 {0} 張了|{0} images ready
照這張再印：{0}帶去墨池…|Print this again: sending {0} to Ink Pool…
{0}・在卡冊看這張牌|{0!} · View this card in the card book
{0}・看這張牌|{0!} · View this card
時代：{0}|Era: {0}
這張用 {0}|This image used {0!}
換不了模型：{0}|Could not switch models: {0}
換好了，但這台找不到：{0}|Switched, but this computer is missing: {0!}
這台找不到 {0}，其他照那張|Missing {0!} here; everything else matches
模型換成 {0} 了|Models switched to {0!}
「{0}」這個位置抽不出別張了：規則、廢字簍把其他的都擋掉了|No other card fits “{0}”'s slot: rules and the trash block the rest
換了：{0} → {1}，送去印了|Swapped: {0} → {1}, sent to print
換了：{0} → {1}|Swapped: {0} → {1}
只重抽試印 {0} 的這個位置，其他補的牌不動|Redraw only this slot in proof {0}; other engine cards stay
試印 {0} 的這個位置抽不出別張了（規則、廢字簍擋掉了其他的）|No other card fits this slot in proof {0} (rules and the trash block the rest)
試印 {0} 換了：{1} → {2}|Proof {0} swapped: {1} → {2}
花色：{0}|Suit: {0}
排序：{0}|Sort: {0}
解析中 {0} 秒|Parsing {0} sec
認出 {0} 個字|{0} tags found
{0} 張是牌|{0} are cards
全部 {0}|All {0}
只要確定的 {0}|Sure only {0}
{0}：會帶走，點一下不帶|{0}: will be taken; click to leave it out
{0}：不帶，點一下帶走|{0}: left out; click to take it
{0}：{1}用不了（到頂欄換分級）|{0}: unavailable at {1} rating (change the rating at the top)
{0}：{1}用不了，到頂欄換分級|{0}: unavailable at {1} rating. Change the rating at the top.
詞庫沒有的字・{0}|Not in the vocabulary · {0}
不收 {0} 個字（未成年相關、或不能用的角色）。|Rejected {0} tags (minor-related, or characters that cannot be used).
低一點認得多、也比較會亂猜；{0} 以上的標「確定」。|Lower finds more but guesses more; {0} and above are marked Sure.
Tagger 出錯：{0}|The tagger failed: {0!}
連不到 ComfyUI：{0}|Cannot reach ComfyUI: {0!}
ComfyUI 不收：{0}|ComfyUI rejected it: {0!}
{0} → {1}|{0} → {1}
{0} ← {1}|{0} ← {1}
{0} 張、{1} 個細分類|{0} cards, {1} subcategories
{0} 附帶的|Included by {0}
引擎考慮過、又拿掉的 {0} 個字：{1}|The engine considered and dropped {0} tags: {1}
尺度：{0}|Content level: {0}
人數：{0}|People: {0}
放了{0}：{1}跟它同一格（{2}），換下來了。|Placed {0}: {1} shares its slot ({2}) and was swapped out.
互斥關著：{0}跟同一格的牌都留著，提示詞裡全部都寫。|Exclusive is off: {0} and the cards in its slot all stay, and all go into the prompt.
放了{0}：跟池子裡的牌不同格，可以並存。|Placed {0}: it's in a different slot from the pool, so they coexist.
拿掉了{0}，但附帶打開：抽的時候{1}會把它抽回來（虛線那張）。|Removed {0}, but Included is on: when drawing, {1} brings it back (the dashed one).
拿掉了{0}，附帶關著：抽的時候不會抽回來。|Removed {0} with Included off: drawing won't bring it back.
{0}放回來了。|{0} is back.
放了{0}：它附帶{1}，一起放進來。|Placed {0}: it includes {1}, so they came in too.
放了{0}：附帶的牌一起進來。按「拿掉」看附帶開關的差別。|Placed {0}: its included cards came too. Press Remove to see what the switch changes.
比{0}多 {1} 張|{1} more than {0}
{0}多開的牌（只列名字）：|Cards {0} adds (names only):
現代專用的牌 {0} 張，例如：|{0} cards only for Modern, for example:
{0}會出現、現代不會的牌 {1} 張，例如：|{1} cards that appear in {0} but not Modern, for example:
打開{0}|Open {0}
卡面提示詞・{0}|Card art prompt · {0}
提示詞讀不到：{0}|Couldn't load the prompt: {0!}
烤的時候負面詞一定會接上 {0}，避免畫成未成年的樣子；正面不能寫封鎖字。|Baking always adds {0!} to the negative prompt so nothing is drawn as a minor. Blocked words can't go in the positive prompt.
從偏好卡牌拿掉：{0}|Remove from favorite cards: {0}
加進偏好卡牌：{0}|Add to favorite cards: {0}
不送了，拿回來：{0}|Take back from Ink Pool: {0}
送去墨池合成池：{0}|Send to the Ink Pool mix: {0}
{0} 張送去墨池合成池了：回墨池就在池裡|{0} cards sent to the Ink Pool mix: they'll be in the pool when you go back
「{0}」已經送去墨池了|“{0}” is already on its way to Ink Pool
卡盒改成偏好卡牌了：原本卡盒裡的 {0} 張已經放進偏好卡牌|The card box is now favorite cards: its {0} cards were moved into favorite cards
{0}放進偏好卡牌了（{1} 張）|{0} · Now {1} favorite cards
編輯「{0}」|Edit “{0!}”
裡面有{0}級的牌，不能標{1}|It contains a {0} card, so it can’t be marked {1}
{0}：已經在這張牌裡（再點一下拿掉）|{0}: already in this card (click to remove)
{0}：加進這張牌|{0}: add to this card
「{0}」已經會帶出它|“{0}” already brings it in
跟「{0}」同一格，只會留一個|Same slot as “{0}”: only one is kept
{0}權重減 0.1|{0} weight −0.1
{0}權重加 0.1|{0} weight +0.1
拿掉「{0}」|Remove “{0}”
是不是「{0}」（{1}）？|Did you mean “{0}” ({1!})?
擋掉了：{0}（未成年、禁用角色不能用）|Blocked: {0!} (minors and banned characters aren’t allowed)
{0} 張牌|{0} cards
{0} 張牌・詞庫外 {1} 個|{0} cards · {1} not in lexicon
卡面提示詞有不能用的字：{0}|The card art prompt has words that aren’t allowed: {0!}
擋掉了 {0} 個不能用的字|Blocked {0} words that aren’t allowed
「{0}」存好了|“{0!}” saved
「{0}」做好了：墨池、疊印台的字盒「自製」裡找得到|“{0!}” is ready: find it under Custom in the Ink Pool and Fuse Press
自製・{0}・{1} 張牌|Custom · {0} · {1} cards
自製・{0}・{1} 張牌・詞庫外 {2} 個|Custom · {0} · {1} cards · {2} not in lexicon
「{0}」刪掉了|“{0!}” deleted
自製牌「{0}」：{1}|Custom card “{0!}”: {1}
「{0}」又合回一張了|“{0!}” is one card again
拆開了：詞庫外的字（{0}）不會再接進提示詞|Split: the words outside the lexicon ({0!}) are no longer added to the prompt
「{0}」裡的牌都已經在卡池上了|The cards in “{0!}” are already on the pool
自製牌「{0}」放上卡池：{1}被換下（同一格只留一張）|Custom card “{0!}” placed: {1} replaced (one card per slot)
分級不能低於裡面的牌（最低：{0}）|The rating can’t be lower than the cards inside (at least {0})
有不能用的字（未成年、禁用角色）：{0}|Contains words that aren’t allowed (minors, banned characters): {0!}
卡面提示詞裡有不能用的字（未成年、禁用角色）：{0}|The card art prompt contains words that aren’t allowed (minors, banned characters): {0!}
一張自製牌最多 {0} 張牌|A custom card holds at most {0} cards
把「{0}」當詞庫外的字加進來|Add “{0!}” as a word outside the lexicon
「{0}」不能用（未成年、禁用角色）|“{0!}” isn’t allowed (minors, banned characters)
詞庫外的字最多 {0} 個|At most {0} words outside the lexicon
`;
export const templates = parameterized.trim().split("\n").map((line) => {
  const split = line.indexOf("|");
  return [line.slice(0, split), line.slice(split + 1)];
});
