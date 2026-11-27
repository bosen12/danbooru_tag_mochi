# -*- coding: utf-8 -*-
"""2026-11-27 tagcomplete（a1111-sd-webui-tagcomplete 的 tags/danbooru.csv，Danbooru 2024 年底）裡墨池還沒有的一般字。
Grok 4.7 整理報告（.planning/tac-1127/report.md），專案主審過：收「建議收」1042 個，加他從待審禁用、不收清單挑的 33 個；
其中 10 個跟詞庫已有的字同一件事，做成別名卡（scripts/alt_names.json），這裡收 1065 個。

欄位由 Opus 照詞庫同一格最像的牌填、Danbooru 的 implications 帶父字，再逐類驗收（.planning/tac-1127/work/）。
有校名的高中、大學制服、學生打扮（kogal、sukeban）、VTuber 團服、自殘疤痕、漫畫分格：只在釘了才出現（ODD，也在 web/engine.js 的 ODD_MOTIF）。
國中、小學、幼兒相關（常盤台體操服、神濱附校、雷門、藍莓學園、小學生書包、便利屋68）和專案主要禁的抱著嬰兒：收進詞庫但永遠不抽、不烤（web/engine.js 的 NEVER_DRAW）。
格式跟 sync_20261126_tags.py 一樣。
"""
from __future__ import annotations

# tag|zh|section|group|sub|heat|mutex|needs|implies|gate|era|layer
# heat: all / sex / flash（flash = 走光+性愛）；空的 mutex、needs、implies、era 寫 -
_LINES = """
multicolored clothes|多色衣服|clothing|fabric|fab_style|all|-|-|-|any|-|garment
interface headset|通訊耳麥|clothing|acc|acc_face|all|headwear|-|-|any|modern|accessory
horizontal-striped thighhighs|橫條紋過膝襪|clothing|legs|legs|all|legs|-|-|female|modern,victorian|garment
military combat uniform|戰鬥軍服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
single shoulder pad|單邊護肩|clothing|acc|acc_hand|all|-|-|-|any|-|accessory
shirt under shirt|襯衫內搭襯衫|clothing|top|top_shirt|all|top|-|-|any|modern,victorian|garment
metal hairband|金屬髮箍|clothing|acc|acc_head|all|hair_acc|-|hairband|female|-|accessory
blue trim|藍色滾邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
green visor|綠色遮陽帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
animal ear hood|動物耳兜帽|clothing|acc|acc_head|all|headwear|-|hood|any|medieval|accessory
purple rope|紫色繩子|clothing|acc|acc_bind|sex|-|-|rope|any|-|accessory
sideless dress|露側洋裝|clothing|onepiece|op_dress|flash|onepiece|-|-|female|modern,victorian|garment
black wrist cuffs|黑色腕套(袖口)|clothing|acc|acc_jewel|all|jewelry|-|wrist cuffs|any|-|accessory
two-tone scarf|雙色圍巾|clothing|acc|acc_neck|all|neckwear|-|scarf|any|-|accessory
gold ring|金戒指|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
red brooch|紅胸針|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
black shrug|黑色短罩衫|clothing|outer|outer|all|outer|-|shrug (clothing)|any|modern|garment
mouth piercing|嘴部穿環|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
two-tone one-piece swimsuit|雙色連身泳裝|clothing|onepiece|op_swim|all|onepiece|-|-|female|modern|garment
untied footwear|未繫鞋履|clothing|feet|feet|all|feet|-|-|any|victorian,modern|garment
short-sleeved jacket|短袖夾克|clothing|outer|outer|all|outer|-|jacket,short sleeves|any|modern|garment
white shrug|白色短罩衫|clothing|outer|outer|all|outer|-|shrug (clothing)|any|modern|garment
two-tone thighhighs|雙色過膝襪|clothing|legs|legs|all|legs|-|multicolored thighhighs|female|modern,victorian|garment
purple veil|紫色面紗|clothing|acc|acc_head|all|headwear|-|veil|any|-|accessory
blue veil|藍色面紗|clothing|acc|acc_head|all|headwear|-|veil|any|-|accessory
ring hair ornament|環形髮飾|clothing|acc|acc_head|all|headwear|-|-|female|-|accessory
bandaid on thigh|大腿貼OK繃|clothing|acc|acc_bandage|all|-|-|bandaid on leg|any|-|accessory
two-tone sweater|雙色毛衣|clothing|top|top_knit|all|top|-|-|any|modern|garment
two-tone necktie|雙色領帶|clothing|acc|acc_neck|all|neckwear|-|necktie|any|modern,victorian|accessory
two-sided headwear|雙面頭飾|clothing|acc|acc_head|all|headwear|-|two-sided fabric|any|-|accessory
emo fashion|emo風|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
number print|數字印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
chihaya (clothing)|千早|clothing|era|era_jp|all|top|-|-|female|edo,modern|garment
multiple necklaces|多條項鍊|clothing|acc|acc_jewel|all|jewelry|-|necklace|any|-|accessory
han'eri|半襟|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
white hanfu|白漢服|clothing|era|era_cn|all|onepiece|-|hanfu|any|ancient_china|garment
front-hook bra|前扣胸罩|clothing|underwear|uw_top|flash|underwear_top|-|-|female|modern|garment
pink trim|粉色滾邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
flak jacket|防彈夾克|clothing|outer|outer|all|outer|-|jacket|any|modern|garment
red tabard|紅色無袖罩袍|clothing|era|era_west|all|outer|-|tabard|any|medieval|garment
bandana around neck|頭巾圍脖子|clothing|acc|acc_neck|all|neckwear|-|bandana|any|-|accessory
muzzle (mask)|嘴套|clothing|acc|acc_face|all|headwear|-|-|any|-|accessory
single bare foot|單腳赤腳|clothing|feet|feet|all|-|-|-|any|-|garment
white undershirt|白內搭衫|clothing|top|top_shirt|all|top|-|-|any|modern,victorian|garment
blue visor|藍色遮陽帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
qixiong ruqun|齊胸襦裙|clothing|era|era_cn|all|onepiece|-|hanfu|female|ancient_china|garment
pinstripe pants|細條紋長褲|clothing|bottom|bot_pants|all|bottom|-|pants,pinstripe pattern|any|modern,victorian|garment
character charm|角色吊飾|clothing|acc|acc_carry|all|-|-|charm (object)|any|modern|accessory
black leg warmers|黑色腿套|clothing|legs|legs|all|legs|-|leg warmers|any|modern|garment
spiked ear piercing|尖刺耳釘|clothing|acc|acc_jewel|all|-|-|ear piercing|any|-|accessory
black arm warmers|黑臂套|clothing|acc|acc_hand|all|-|-|arm warmers|any|-|accessory
aqua sleeves|水藍袖|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
rerebrace|上臂甲|clothing|era|era_west|all|-|-|-|any|-|garment
coat partially removed|大衣半脫|clothing|fabric|fab_detail|all|-|-|-|any|modern|garment
unworn footwear|脫下鞋履|clothing|feet|feet|all|-|-|-|any|victorian,modern|garment
pinstripe dress|細條紋洋裝|clothing|onepiece|op_dress|all|onepiece|-|dress,pinstripe pattern|female|modern,victorian|garment
fur shawl|毛皮披巾|clothing|era|era_west|all|outer|-|shawl|female|victorian,ancient_greece|garment
orange halo|橙色光環|clothing|acc|acc_head|all|-|-|halo|any|-|accessory
brazilian flag print|巴西國旗圖樣|clothing|fabric|fab_material|all|-|-|flag print|any|modern|garment
lace sleeves|蕾絲袖|clothing|fabric|fab_sleeve|all|-|-|lace|any|victorian|garment
gold armlet|金臂環|clothing|acc|acc_jewel|all|jewelry|-|armlet|any|-|accessory
detached hood|獨立兜帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
qi lolita|中華風蘿莉塔服飾|clothing|fabric|fab_style|all|-|female|lolita fashion|female|modern|garment
middle ring|中指戒指|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
animal helmet|動物形頭盔|clothing|acc|acc_head|all|-|-|-|any|modern|accessory
undersized breast cup|過小罩杯|clothing|underwear|uw_top|flash|underwear_top|-|-|female|modern|garment
race bib|比賽號碼布|clothing|acc|acc_neck|all|-|-|-|any|modern|accessory
pendant collar|吊墜項圈|clothing|acc|acc_neck|all|neckwear|-|-|any|-|accessory
yami kawaii|暗黑可愛風|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
cross-laced cutout|交叉綁帶鏤空|clothing|fabric|fab_material|flash|-|-|clothing cutout,cross-laced clothes|any|-|garment
belt chain|腰帶鏈|clothing|acc|acc_hand|all|waist|-|-|any|-|accessory
two-tone pants|雙色長褲|clothing|bottom|bot_pants|all|bottom|-|pants|any|modern,victorian|garment
stirrup footwear|踩腳短襪|clothing|legs|legs|all|feet|-|-|any|-|garment
purple tabard|紫色無袖罩袍|clothing|era|era_west|all|outer|-|tabard|any|medieval|garment
letter hair ornament|字母髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
aqua trim|水藍滾邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
waist ribbon|腰間緞帶|clothing|acc|acc_bow|all|-|-|-|any|-|accessory
heart-shaped gem|愛心寶石|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
shirt partially tucked in|下擺半紮進|clothing|top|top_shirt|all|top|-|-|any|modern|garment
blue wrist cuffs|藍色腕套(袖口)|clothing|acc|acc_jewel|all|jewelry|-|wrist cuffs|any|-|accessory
vertical-striped headwear|直條紋頭飾／頭戴物|clothing|acc|acc_head|all|headwear|-|vertical-striped clothes,striped headwear|any|-|accessory
poleyn|膝甲|clothing|era|era_west|all|-|-|-|any|-|garment
frilled wristband|荷葉邊腕帶|clothing|acc|acc_hand|all|-|-|-|any|modern|accessory
single fishnet legwear|單腿網襪|clothing|legs|legs|all|legs|female|-|female|modern|garment
vertical-striped sleeves|直條紋袖|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
high-visibility clothing|反光衣|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
white tunic|白色長版上衣|clothing|era|era_west|all|onepiece|-|tunic|any|medieval|garment
leaf hat ornament|葉子帽飾|clothing|acc|acc_head|all|-|-|hat ornament|any|-|accessory
spiked pauldrons|尖刺肩鎧|clothing|acc|acc_hand|all|-|-|spikes,pauldrons|any|medieval|accessory
empire waist|帝國腰線|clothing|onepiece|op_dress|all|onepiece|-|-|female|-|garment
two-tone hat|雙色帽子|clothing|acc|acc_head|all|headwear|-|hat|any|-|accessory
green robe|綠色長袍|clothing|outer|outer|all|outer|-|robe|any|-|garment
black bandana|黑色頭巾|clothing|acc|acc_neck|all|-|-|bandana|any|-|accessory
print pants|印花長褲|clothing|bottom|bot_pants|all|bottom|-|pants|any|modern,victorian|garment
checkered hairband|格紋髮箍|clothing|acc|acc_head|all|hair_acc|-|hairband|female|-|accessory
pink sweater vest|粉色毛衣背心|clothing|top|top_knit|all|top|-|sweater vest|any|modern|garment
black overalls|黑色吊帶褲|clothing|onepiece|op_uniform|all|onepiece|-|overalls|any|modern|garment
sabaton|甲靴|clothing|era|feet|all|feet|-|-|any|-|garment
waist sash|腰部飾帶|clothing|acc|acc_hand|all|waist|-|sash|any|ancient_china,edo|accessory
orange gemstone|橙色寶石|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
yellow capelet|黃色短披肩|clothing|era|era_west|all|outer|-|capelet|any|medieval,victorian|garment
cross-laced bikini|交叉綁帶比基尼|clothing|onepiece|op_swim|all|onepiece|-|bikini,cross-laced clothes|female|modern|garment
high-visibility vest|反光背心|clothing|top|top_tank|all|top|-|high-visibility clothing|any|modern|garment
aristocratic clothes|貴族服裝|clothing|fabric|fab_style|all|-|-|-|any|-|garment
high belt|高腰皮帶|clothing|acc|acc_hand|all|waist|-|-|any|-|accessory
white pajamas|白色睡衣|clothing|onepiece|op_night|all|onepiece|-|pajamas|any|modern|garment
lace-trimmed collar|蕾絲滾邊項圈|clothing|acc|acc_neck|all|neckwear|-|lace trim|any|-|accessory
yellow headband|黃色頭帶|clothing|acc|acc_head|all|hair_acc|-|headband|any|-|accessory
purple bag|紫色包包|clothing|acc|acc_carry|all|-|-|bag|any|-|accessory
leggings under shorts|短褲下穿內搭褲|clothing|legs|legs|all|legs|-|-|any|modern|garment
compression shirt|壓縮上衣|clothing|top|top_shirt|all|top|-|-|any|modern|garment
sweater jacket|毛衣外套|clothing|outer|outer|all|outer|-|-|any|modern|garment
camera around neck|頸掛相機|clothing|acc|acc_carry|all|-|-|camera|any|modern|accessory
eye print|眼睛印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
rosary|玫瑰念珠|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
military dress uniform|軍禮服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
o-ring harness|O環束帶|clothing|acc|acc_hand|all|-|-|harness,o-ring|any|-|accessory
white arm warmers|白臂套|clothing|acc|acc_hand|all|-|-|arm warmers|any|-|accessory
purple tank top|紫背心|clothing|top|top_tank|all|top|-|tank top|any|modern|garment
turtleneck bodysuit|高領緊身衣|clothing|onepiece|op_body|all|onepiece|-|bodysuit,turtleneck|any|modern|garment
gem hair ornament|寶石髮飾|clothing|acc|acc_head|all|headwear|-|-|female|-|accessory
broken mask|破面具|clothing|acc|acc_face|all|headwear|-|mask|any|-|accessory
grey camisole|灰細肩帶背心|clothing|top|top_tank|all|top|-|camisole|female|modern|garment
grape hair ornament|葡萄髮飾|clothing|acc|acc_head|all|headwear|-|food-themed hair ornament|female|-|accessory
striped pajamas|條紋睡衣|clothing|onepiece|op_night|all|onepiece|-|striped clothes,pajamas|any|modern|garment
tooth earrings|牙齒耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
torn socks|破襪子|clothing|legs|legs|all|feet|-|torn clothes|any|-|garment
floating neckwear|漂浮頸飾|clothing|acc|acc_neck|all|neckwear|-|-|any|-|accessory
bird hair ornament|鳥形髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
ghost hair ornament|幽靈髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
white bridal gauntlets|白色新娘袖套|clothing|acc|acc_hand|all|hands|-|bridal gauntlets|female|-|accessory
multicolored necktie|多色領帶|clothing|acc|acc_neck|all|neckwear|-|necktie|any|modern,victorian|accessory
collar jewel|領口寶石|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
balaclava|頭套面罩|clothing|acc|acc_face|all|headwear|-|-|any|-|accessory
green brooch|綠胸針|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
xiao guan (headdress)|小冠|clothing|acc|acc_head|all|headwear|-|-|any|ancient_china|accessory
wide brim|寬帽簷|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
brown robe|棕色長袍|clothing|outer|outer|all|outer|-|robe|any|-|garment
heart belt|愛心皮帶|clothing|acc|acc_hand|all|waist|-|-|any|-|accessory
purple headband|紫色頭帶|clothing|acc|acc_head|all|hair_acc|-|headband|any|-|accessory
character hood|角色兜帽|clothing|acc|acc_head|all|headwear|-|-|any|modern|accessory
chest guard|護胸|clothing|acc|acc_hand|all|-|-|-|any|-|accessory
xiangyun|祥雲紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
animal hair ornament|動物髮飾|clothing|acc|acc_head|all|headwear|-|-|female|-|accessory
glass slipper|玻璃鞋|clothing|feet|feet|all|feet|-|-|any|-|accessory
floral print dress|碎花洋裝|clothing|onepiece|op_dress|all|onepiece|-|floral print,print dress|female|modern,victorian|garment
single knee boot|單邊及膝靴|clothing|feet|feet|all|feet|-|knee boots|any|modern|garment
butterfly earrings|蝴蝶耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
yellow umbrella|黃色傘|clothing|acc|acc_carry|all|-|-|umbrella|any|-|accessory
black trim|黑色滾邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
fur bikini|毛皮比基尼|clothing|onepiece|op_swim|all|onepiece|-|-|female|modern|garment
shirt under dress|洋裝下穿衫|clothing|top|top_shirt|all|top|-|-|female|modern,victorian|garment
gradient skirt|漸層裙子|clothing|bottom|bot_skirt|all|bottom|-|skirt,gradient clothes|female|modern,victorian,medieval,ancient_china|garment
arm pouch|手臂小包|clothing|acc|acc_carry|all|-|-|-|any|-|accessory
red corset|紅色束腰|clothing|era|era_west|all|top|-|corset|female|victorian|garment
see-through one-piece swimsuit|透視連身泳裝|clothing|onepiece|op_swim|flash|onepiece|-|one-piece swimsuit,see-through clothes|female|modern|garment
latex thighhighs|乳膠過膝襪|clothing|legs|legs|all|legs|-|thighhighs,latex|female|modern|garment
bikini under shorts|短褲內比基尼|clothing|underwear|uw_bottom|all|underwear_bottom|-|-|female|modern|underwear
black bustier|黑色馬甲胸衣|clothing|underwear|uw_top|all|underwear_top|female|bustier|female|modern,victorian|garment
heart-shaped ornament|愛心飾品|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
black nightgown|黑睡裙|clothing|onepiece|op_night|all|onepiece|-|nightgown|female|victorian,modern|garment
aqua pants|水藍褲|clothing|bottom|bot_pants|all|bottom|-|pants|any|modern,victorian|garment
lace-trimmed headwear|蕾絲滾邊頭飾／頭戴物|clothing|acc|acc_head|all|headwear|-|lace trim|any|-|accessory
aqua vest|水藍馬甲|clothing|top|top_tank|all|top|-|vest|any|modern|garment
aqua scarf|水藍圍巾|clothing|acc|acc_neck|all|neckwear|-|scarf|any|-|accessory
white hakama|白袴|clothing|era|era_jp|all|bottom|-|hakama|any|edo|garment
two-tone shorts|雙色短褲|clothing|bottom|bot_pants|all|bottom|-|-|any|modern|garment
red tube top|紅色平口上衣|clothing|top|top_tank|all|top|female|tube top|female|modern|garment
horned hood|帶角兜帽|clothing|acc|acc_head|all|headwear|-|hood,horns|any|medieval|accessory
mortarboard|學士帽|clothing|acc|acc_head|all|headwear|-|hat|any|modern|accessory
spider print|蜘蛛印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
wrist flower|腕花|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
winged halo|翅膀光環|clothing|acc|acc_head|all|-|-|halo|any|-|accessory
fox hair ornament|狐狸髮飾|clothing|acc|acc_head|all|headwear|-|-|female|-|accessory
bead choker|串珠頸環|clothing|acc|acc_neck|all|neckwear|-|beads|female|ancient_china,edo,medieval,victorian|accessory
green pajamas|綠色睡衣|clothing|onepiece|op_night|all|onepiece|-|pajamas|any|modern|garment
crown hair ornament|皇冠髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
zipper skirt|拉鍊裙|clothing|bottom|bot_skirt|all|bottom|-|skirt|female|modern|garment
orange tank top|橙背心|clothing|top|top_tank|all|top|-|tank top|any|modern|garment
striped arm warmers|條紋臂套|clothing|acc|acc_hand|all|-|-|arm warmers|any|-|accessory
horned hat|帶角帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
shirt bow|襯衫蝴蝶結|clothing|acc|acc_bow|all|-|-|bow|any|-|accessory
plackart|腹甲|clothing|era|era_west|all|-|-|-|any|-|garment
horned mask|帶角面具|clothing|acc|acc_face|all|headwear|-|mask|any|-|accessory
multicolored halo|多色光環|clothing|acc|acc_head|all|-|-|halo|any|-|accessory
black bikini bottom|黑色比基尼下裝|clothing|bottom|op_swim|all|bottom|female|-|female|modern|garment
bone necklace|骨項鍊|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
pink headband|粉色頭帶|clothing|acc|acc_head|all|hair_acc|-|headband|any|-|accessory
armored bodysuit|裝甲緊身衣|clothing|onepiece|op_body|all|onepiece|-|-|any|modern|garment
two-tone veil|雙色面紗|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
asymmetrical pants|不對稱長褲|clothing|bottom|bot_pants|all|bottom|-|-|any|modern,victorian|garment
cuisses|大腿甲|clothing|era|era_west|all|-|-|-|any|-|garment
brown suit|棕色西裝|clothing|onepiece|op_uniform|all|onepiece|-|suit|any|modern,victorian|garment
ribbon earrings|緞帶耳環|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
green trim|綠色滾邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
gold belt|金色皮帶|clothing|acc|acc_hand|all|waist|-|belt|any|-|accessory
white armband|白色臂章|clothing|acc|acc_hand|all|-|-|armband|any|-|accessory
criss-cross straps|交叉細帶|clothing|fabric|fab_detail|all|-|-|-|any|-|garment
oxygen mask|氧氣面罩|clothing|acc|acc_face|all|headwear|-|-|any|modern|accessory
studded gloves|鉚釘手套|clothing|acc|acc_hand|all|hands|-|gloves,studs|any|-|accessory
vertical-striped vest|直條紋背心|clothing|top|top_tank|all|top|-|vertical-striped clothes,striped vest|any|modern|garment
two-tone vest|雙色背心|clothing|top|top_tank|all|top|-|-|any|modern|garment
green hood|綠色兜帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
colored eyepatch|彩色眼罩|clothing|acc|acc_face|all|eyewear|-|eyepatch|any|-|accessory
morning glory print|牽牛花紋|clothing|fabric|fab_material|all|-|-|floral print|any|modern|garment
two-tone panties|雙色內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|-|-|female|modern|garment
pants under dress|洋裝裡穿長褲|clothing|bottom|bot_pants|all|bottom|-|pants|female|modern,victorian|garment
black headphones|黑色耳機|clothing|acc|acc_face|all|headwear|-|-|any|modern|accessory
cloud hair ornament|雲朵髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
lipstick ring|口紅戒指|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
white slingshot swimsuit|白色彈弓式泳衣|clothing|onepiece|op_swim|all|onepiece|-|slingshot swimsuit|female|modern|garment
striped belt|條紋皮帶|clothing|acc|acc_hand|all|waist|-|belt|any|-|accessory
spiked footwear|帶刺的鞋|clothing|feet|feet|all|feet|-|-|any|victorian,modern|garment
piano print|鋼琴印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
pleated shirt|褶襉襯衫|clothing|top|top_shirt|all|top|-|-|any|modern,victorian|garment
red wrist cuffs|紅色腕套(袖口)|clothing|acc|acc_jewel|all|jewelry|-|wrist cuffs|any|-|accessory
baseball helmet|棒球頭盔|clothing|acc|acc_head|all|-|-|helmet|any|modern|accessory
purple trim|紫色滾邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
swimsuit skirt|泳裝裙|clothing|bottom|bot_skirt|all|bottom|-|swimsuit|female|modern|garment
green camisole|綠細肩帶背心|clothing|top|top_tank|all|top|-|camisole|female|modern|garment
frilled vest|荷葉邊背心|clothing|top|top_tank|all|top|-|-|any|modern|garment
orange-framed eyewear|橘框眼鏡|clothing|acc|acc_face|all|eyewear|-|-|any|modern|accessory
black pouch|黑色小袋|clothing|acc|acc_carry|all|-|-|-|any|-|accessory
just shoes|只穿鞋|clothing|onepiece|op_only|flash|onepiece|-|-|any|-|garment
collared leotard|有領連身衣|clothing|onepiece|op_body|all|onepiece|-|-|female|modern|garment
captive bead ring|珠環|clothing|acc|acc_jewel|all|jewelry|-|piercing|any|-|accessory
pen in pocket|口袋插筆|clothing|fabric|fab_detail|all|-|-|object in pocket|any|-|garment
classic lolita|古典蘿莉塔|clothing|fabric|fab_style|all|-|female|lolita fashion|female|modern|garment
carrot print|紅蘿蔔印花|clothing|fabric|fab_material|all|-|-|food print|any|modern|garment
gradient kimono|漸層和服|clothing|era|era_jp|all|onepiece|-|kimono,gradient clothes|any|edo|garment
purple hood|紫色兜帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
motoyui|元結|clothing|acc|acc_head|all|headwear|-|-|any|edo,modern|accessory
plaid apron|格紋圍裙|clothing|onepiece|op_uniform|all|onepiece|-|plaid clothes,apron|female|modern|garment
white sneakers|白色運動鞋|clothing|feet|feet|all|feet|-|-|any|modern|garment
frilled shawl|荷葉邊披巾|clothing|era|era_west|all|outer|-|shawl,frills|female|victorian|garment
o-ring panties|圓環內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|-|o-ring bottom,panties|female|modern|garment
bike jersey|自行車衣|clothing|top|top_shirt|all|top|-|-|any|modern|garment
knit hat|針織帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
grey robe|灰色長袍|clothing|outer|outer|all|outer|-|robe|any|-|garment
print hairband|印花髮箍|clothing|acc|acc_head|all|hair_acc|-|hairband|female|-|accessory
polka dot bowtie|圓點領結|clothing|acc|acc_neck|all|neckwear|-|bowtie,polka dot bow|any|modern,victorian|accessory
yellow cloak|黃色斗篷|clothing|era|era_west|all|outer|-|-|any|medieval,victorian|garment
metal gloves|金屬手套|clothing|acc|acc_hand|all|hands|-|-|any|-|accessory
yellow jumpsuit|黃連身褲|clothing|onepiece|op_uniform|all|onepiece|-|jumpsuit|any|modern|garment
bandaid on shoulder|肩膀貼OK繃|clothing|acc|acc_bandage|all|-|-|bandaid|any|-|accessory
lemon print|檸檬印花|clothing|fabric|fab_material|all|-|-|fruit print|any|modern|garment
pinstripe vest|細條紋背心|clothing|top|top_tank|all|top|-|vest,pinstripe pattern|any|modern|garment
blue corset|藍色束腰|clothing|era|era_west|all|top|-|corset|female|victorian|garment
character mask|角色面具|clothing|acc|acc_face|all|headwear|-|mask|any|-|accessory
hockey mask|冰球面罩|clothing|acc|acc_face|all|headwear|-|mask|any|-|accessory
armored skirt|裝甲裙|clothing|bottom|bot_skirt|all|bottom|-|-|female|modern,victorian,medieval,ancient_china|garment
wool|羊毛|clothing|fabric|fab_material|all|-|-|-|any|-|garment
crown of thorns|荊棘冠|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
long hoodie|長版連帽衫|clothing|top|top_shirt|all|top|-|-|any|modern|garment
paw print soles|肉球鞋底|clothing|feet|feet|all|-|-|-|any|-|accessory
skull hat ornament|骷髏帽飾|clothing|acc|acc_head|all|-|-|hat ornament|any|-|accessory
mascot costume|吉祥物裝|clothing|fabric|fab_style|all|-|-|-|any|-|garment
red jumpsuit|紅連身褲|clothing|onepiece|op_uniform|all|onepiece|-|jumpsuit|any|modern|garment
spiked armor|帶刺鎧甲|clothing|era|era_west|all|onepiece|-|spikes,armor|any|medieval,edo|garment
green suit|綠色西裝|clothing|onepiece|op_uniform|all|onepiece|-|suit|any|modern,victorian|garment
purple arm warmers|紫臂套|clothing|acc|acc_hand|all|-|-|arm warmers|any|-|accessory
sleeping bag|睡袋|clothing|acc|acc_carry|all|-|-|-|any|-|accessory
waraji|草鞋|clothing|feet|feet|all|feet|-|-|any|edo,modern|garment
print pajamas|印花睡衣|clothing|onepiece|op_night|all|onepiece|-|pajamas|any|modern|garment
spiked belt|帶刺皮帶|clothing|acc|acc_hand|all|waist|-|-|any|-|accessory
dolphin hair ornament|海豚髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
wrist belt|腕部皮帶|clothing|acc|acc_hand|all|-|-|-|any|-|accessory
padded jacket|鋪棉外套|clothing|outer|outer|all|outer|-|jacket|any|modern|garment
brown hakama|棕袴|clothing|era|era_jp|all|bottom|-|hakama|any|edo|garment
green overalls|綠色吊帶褲|clothing|onepiece|op_uniform|all|onepiece|-|overalls|any|modern|garment
pink sarong|粉色紗龍裙|clothing|bottom|bot_pants|all|bottom|-|sarong|any|modern|garment
shell earrings|貝殼耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
hip armor|護髖甲|clothing|era|era_west|all|-|-|-|any|medieval,edo|garment
liquid halo|液態光環|clothing|acc|acc_head|all|-|-|halo|any|-|accessory
single elbow pad|單邊護肘|clothing|acc|acc_carry|all|-|-|elbow pads|any|modern|accessory
spurs|馬刺|clothing|feet|feet|all|-|-|-|any|-|accessory
onigiri print|飯糰印花|clothing|fabric|fab_material|all|-|-|food print|any|modern|garment
grey overalls|灰色吊帶褲|clothing|onepiece|op_uniform|all|onepiece|-|overalls|any|modern|garment
aqua scrunchie|水色髮圈|clothing|acc|acc_head|all|-|-|scrunchie|any|-|accessory
yellow bandana|黃色頭巾|clothing|acc|acc_neck|all|-|-|bandana|any|-|accessory
ribbon-trimmed shirt|緞帶滾邊襯衫|clothing|top|top_shirt|all|top|-|shirt,ribbon trim|any|modern,victorian|garment
black sarong|黑色紗龍裙|clothing|bottom|bot_pants|all|bottom|-|sarong|any|modern|garment
wireless earphones|無線耳機|clothing|acc|acc_face|all|headwear|-|-|any|modern|accessory
brown bodysuit|棕緊身衣|clothing|onepiece|op_body|all|onepiece|-|bodysuit|any|modern|garment
spiked anklet|帶刺腳鍊|clothing|acc|acc_jewel|all|jewelry|-|spikes,anklet|any|-|accessory
print apron|印花圍裙|clothing|onepiece|op_uniform|all|onepiece|-|apron|female|-|garment
frilled bikini top|荷葉邊比基尼上衣|clothing|onepiece|op_swim|all|onepiece|-|-|female|-|garment
green sports bra|綠運動內衣|clothing|underwear|uw_top|flash|underwear_top|female|sports bra|female|modern|garment
dinosaur costume|恐龍裝|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
flower hairpin|花朵髮釵|clothing|acc|acc_head|all|headwear|-|-|female|ancient_china,edo|accessory
furisode sleeves|振袖袖子|clothing|fabric|fab_sleeve|all|-|-|-|any|edo|garment
torn sweater|破毛衣|clothing|top|top_knit|all|top|-|sweater,torn clothes|any|modern|garment
spiked helmet|帶刺頭盔|clothing|acc|acc_head|all|-|-|-|any|modern|accessory
floating hair ornament|漂浮髮飾|clothing|acc|acc_head|all|headwear|-|-|female|-|accessory
floral print bikini|碎花比基尼|clothing|onepiece|op_swim|all|onepiece|-|print bikini,floral print|female|modern|garment
underworld (ornament)|冥界飾品|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
multicolored pants|多色長褲|clothing|bottom|bot_pants|all|bottom|-|pants|any|modern,victorian|garment
barding|馬鎧|clothing|era|era_west|all|-|-|-|any|-|garment
layered gloves|分層手套|clothing|acc|acc_hand|all|hands|-|-|any|-|accessory
undone bra|解開的胸罩|clothing|underwear|uw_top|flash|underwear_top|-|-|female|modern|garment
unworn crown|脫下的皇冠|clothing|acc|acc_head|all|-|-|-|any|-|accessory
side-tie dress|側綁洋裝|clothing|onepiece|op_dress|all|onepiece|-|-|female|modern,victorian|garment
hannya|般若面具|clothing|acc|acc_face|all|headwear|-|noh mask|any|-|accessory
gradient jacket|漸層夾克|clothing|outer|outer|all|outer|-|gradient clothes,jacket|any|modern|garment
underwear writing|內褲上寫字|clothing|fabric|fab_detail|flash|-|-|clothes writing|any|-|garment
pankou|盤扣|clothing|fabric|fab_detail|all|-|-|-|any|ancient_china,modern|garment
grey hakama|灰袴|clothing|era|era_jp|all|bottom|-|hakama|any|edo|garment
victorian maid|維多利亞女僕|clothing|onepiece|op_uniform|all|onepiece|-|maid|female|victorian,modern|garment
bone print|骨頭印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
arm out of sleeve|手臂伸出袖外|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
purple camisole|紫細肩帶背心|clothing|top|top_tank|all|top|-|camisole|female|modern|garment
brown-tinted eyewear|棕色鏡片眼鏡|clothing|acc|acc_face|all|-|-|tinted eyewear|any|modern|accessory
aqua pantyhose|水藍褲襪|clothing|legs|legs|all|legs|-|pantyhose|female|modern|garment
sleeveless duster|無袖長外套|clothing|outer|outer|all|outer|-|-|any|-|garment
feather dress|羽毛洋裝|clothing|onepiece|op_dress|all|onepiece|-|-|female|modern,victorian|garment
dou|胴鎧|clothing|era|era_jp|all|top|-|-|any|-|garment
camouflage bikini|迷彩比基尼|clothing|onepiece|op_swim|all|onepiece|-|bikini,camouflage|female|modern|garment
naked paint|只塗顏料|clothing|nude|nude|flash|nudity|-|bodypaint|any|modern|skin
white sleeve cuffs|白色袖口|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
purple corset|紫色束腰|clothing|era|era_west|all|top|-|corset|female|victorian|garment
asymmetrical armor|不對稱鎧甲|clothing|era|era_west|all|onepiece|-|armor|any|medieval,edo|garment
anna miller|安娜制服|clothing|onepiece|op_uniform|all|onepiece|-|waitress|female|modern|garment
hooded shirt|連帽襯衫|clothing|top|top_shirt|all|top|-|-|any|modern,victorian|garment
purple armband|紫色臂章|clothing|acc|acc_hand|all|-|-|armband|any|-|accessory
undone neckerchief|解開的頸巾|clothing|acc|acc_neck|all|neckwear|-|neckerchief|any|-|accessory
clothes in front|衣物在前|clothing|fabric|fab_state|all|-|-|-|any|-|garment
unworn slippers|脫下的拖鞋|clothing|feet|feet|all|-|-|-|any|-|accessory
spiked jacket|帶刺夾克|clothing|outer|outer|all|outer|-|spikes,jacket|any|modern|garment
cycling uniform|自行車制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
red blindfold|紅眼罩|clothing|acc|acc_bind|all|eyewear|-|-|any|-|accessory
naked chocolate|只淋巧克力|clothing|onepiece|op_only|flash|onepiece|-|chocolate,nude|female|modern|garment
battle damage|戰損|clothing|fabric|fab_state|all|-|-|-|any|-|garment
bell-bottoms|喇叭褲|clothing|bottom|bot_pants|all|bottom|-|pants|any|modern|garment
whale hat|鯨魚帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
breast zipper|胸口拉鍊|clothing|fabric|fab_detail|all|-|-|-|any|modern|garment
monocle chain|單眼鏡鏈|clothing|acc|acc_jewel|all|jewelry|-|-|any|-|accessory
earphones removed|摘下的耳塞式耳機|clothing|acc|acc_face|all|-|-|-|any|modern|accessory
detached pants|分離式長褲|clothing|bottom|bot_pants|all|bottom|-|-|any|modern,victorian|garment
latex boots|乳膠靴|clothing|feet|feet|all|feet|-|boots,latex|any|modern|garment
whale tail (clothing)|鯨魚尾內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|-|-|female|-|garment
yellow armor|黃色盔甲|clothing|era|era_west|all|onepiece|-|armor|any|medieval,edo|garment
tote bag|托特包|clothing|acc|acc_carry|all|-|-|bag|any|-|accessory
black sleeve cuffs|黑色袖口|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
frilled sash|荷葉邊腰封|clothing|acc|acc_hand|all|waist|-|sash|any|ancient_china,edo|accessory
pill hair ornament|藥丸髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
paw hair ornament|肉球髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
sleeve rolled up|單袖捲起|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
heart eyepatch|愛心眼罩|clothing|acc|acc_face|all|eyewear|-|eyepatch|any|-|accessory
ghost print|幽靈印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
pleated sleeves|褶襉袖|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
food on clothes|衣上有食物|clothing|fabric|fab_state|all|-|-|-|any|-|garment
black straps|黑色細帶|clothing|fabric|fab_detail|all|-|-|-|any|-|garment
headwear with attached mittens|連手套的帽子|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
hat pin|帽針|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
see-through shawl|透膚披巾|clothing|era|era_west|flash|outer|-|see-through clothes,shawl|female|victorian,ancient_greece|garment
unworn cape|脫下的斗篷|clothing|era|era_west|all|-|-|-|any|medieval,victorian,ancient_greece|garment
undone sarashi|解開的纏胸布|clothing|top|top_tank|flash|top|female|sarashi|female|modern,edo|garment
plaid trim|格紋滾邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
single earphone removed|摘下一邊耳機|clothing|acc|acc_face|all|-|-|-|any|-|accessory
purple suit|紫色西裝|clothing|onepiece|op_uniform|all|onepiece|-|suit|any|modern,victorian|garment
orange bandana|橙色頭巾|clothing|acc|acc_neck|all|-|-|bandana|any|-|accessory
cat choker|貓頸環|clothing|acc|acc_neck|all|neckwear|-|-|female|-|accessory
dress ribbon|洋裝緞帶|clothing|acc|acc_bow|all|-|-|-|any|-|accessory
ribbon-trimmed bra|緞帶滾邊胸罩|clothing|underwear|uw_top|flash|underwear_top|-|bra,ribbon trim|female|modern|garment
skull belt|骷髏皮帶|clothing|acc|acc_hand|all|waist|-|-|any|-|accessory
multicolored shorts|多色短褲|clothing|bottom|bot_pants|all|bottom|-|shorts|any|modern|garment
collared shrug|有領罩衫|clothing|outer|outer|all|outer|-|shrug (clothing)|any|modern|garment
socks over pantyhose|襪套在褲襪外|clothing|legs|legs|all|legs|-|-|female|modern|garment
leg cutout|腿側挖空|clothing|fabric|fab_state|all|-|-|clothing cutout|any|-|garment
gradient sleeves|漸層袖|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
shibari under clothes|衣內繩縛|clothing|acc|acc_bind|all|-|-|shibari|any|-|accessory
purple sweater vest|紫色毛衣背心|clothing|top|top_knit|all|top|-|sweater vest|any|modern|garment
naked necktie|只戴領帶|clothing|onepiece|op_only|flash|onepiece|-|necktie|female|modern,victorian|garment
wolf cut|狼尾頭|feature|hair_style|hair_shape|all|hair_style|-|-|any|-|normal
braided sidelock|編辮鬢髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
hair extensions|接髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
ring hair extensions|環扣接髮|feature|hair_style|hair_shape|all|-|-|hair extensions|any|-|normal
sidelocks tied back|後紮鬢髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
fluffy hair|蓬鬆頭髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
hair vines|髮間藤蔓|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
fanged bangs|尖牙瀏海|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
bun with braided base|基部編髮髻|feature|hair_style|hair_shape|all|hair_style|-|hair bun|any|-|normal
shuangyaji|雙丫髻|feature|hair_style|hair_shape|all|hair_style|-|-|any|-|normal
plant hair|植物頭髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
quad braids|四條辮|feature|hair_style|hair_shape|all|hair_style|-|multiple braids|any|-|normal
beehive hairdo|蜂巢頭|feature|hair_style|hair_shape|all|hair_style|-|-|any|modern|normal
tall hair|高聳髮型|feature|hair_style|hair_shape|all|hair_style|-|-|any|-|normal
short braid|短辮|feature|hair_style|hair_shape|all|hair_style|-|braid|any|-|normal
balding|禿頂|feature|hair_len|hair_len|all|hair_length|male|-|male|-|normal
nihongami|日本髮|feature|hair_style|hair_shape|all|hair_style|-|-|any|edo,modern|normal
single drill|單邊鑽髮|feature|hair_style|hair_shape|all|hair_style|-|-|any|-|normal
translucent hair|半透明髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
white eyelashes|白睫毛|feature|eyes|eye_shape|all|-|-|colored eyelashes|any|-|normal
butterfly-shaped pupils|蝴蝶形瞳孔|feature|eyes|eye_shape|all|-|-|symbol-shaped pupils|any|-|normal
official alternate eye color|官方替代眼色|feature|eyes|eye_shape|all|-|-|-|any|-|normal
lazy eye|斜視|feature|eyes|eye_shape|all|-|-|-|any|-|normal
orange pupils|橙瞳孔|feature|eyes|eye_shape|all|-|-|-|any|-|normal
white mouth|嘴內全白|feature|other|mouth_bits|all|-|-|-|any|-|normal
pink sclera|粉紅眼白|feature|eyes|eye_shape|all|-|-|colored sclera|any|-|normal
missing eye|缺一隻眼|feature|eyes|eye_shape|all|-|-|-|any|-|normal
glowing mouth|發光嘴|feature|other|mouth_bits|all|-|-|-|any|-|normal
purple sclera|紫眼白|feature|eyes|eye_shape|all|-|-|colored sclera|any|-|normal
grey sclera|灰眼白|feature|eyes|eye_shape|all|-|-|colored sclera|any|-|normal
smeared lipstick|暈開口紅|feature|makeup|makeup|all|-|-|lipstick|female|-|normal
triangle-shaped pupils|三角形瞳孔|feature|eyes|eye_shape|all|-|-|symbol-shaped pupils|any|-|normal
aqua lips|水色唇|feature|makeup|makeup|all|-|female|-|female|-|normal
green tongue|綠舌頭|feature|other|mouth_bits|all|-|-|colored tongue|any|-|normal
single blush sticker|單邊臉紅貼紙|feature|makeup|makeup|all|-|-|blush stickers|female|-|normal
gradient nails|漸層指甲|feature|makeup|makeup|all|-|-|-|female|-|normal
blue eyeliner|藍色眼線|feature|makeup|makeup|all|-|-|-|female|-|normal
yellow lips|黃唇|feature|makeup|makeup|all|-|female|-|female|-|normal
orange eyeshadow|橙眼影|feature|eyes|makeup|all|-|-|eyeshadow|female|-|normal
aqua pupils|水色瞳孔|feature|eyes|eye_shape|all|-|-|-|any|-|normal
yellow teeth|黃牙|feature|other|mouth_bits|all|-|-|-|any|-|normal
sweaty armpits|腋下出汗|feature|body_f|body_part|all|-|-|-|any|-|normal
gauze on cheek|頰上紗布|feature|skin|skin_mark|all|-|-|gauze|any|-|normal
thick chest hair|濃密胸毛|feature|body_m|bm_hair|all|-|-|-|male|-|normal
outie navel|凸肚臍|feature|body_f|body_part|all|-|-|-|any|-|normal
mark under both eyes|雙眼下標記|feature|skin|tattoo|all|-|-|-|any|-|normal
winged heart tattoo|帶翼愛心刺青|feature|skin|tattoo|all|-|-|winged heart,tattoo|any|-|normal
medium sideburns|中等鬢角|feature|body_m|bm_hair|all|-|male|sideburns|male|-|normal
alternate body size|體型不同|feature|other|body_part|all|-|-|-|any|-|normal
black hands|黑色的手|feature|skin|skin_tone|all|-|-|colored extremities|any|-|normal
thick arm hair|濃密手臂毛|feature|body_m|bm_hair|all|-|male|-|male|-|normal
thick navel hair|濃密肚臍毛|feature|body_m|bm_hair|all|-|-|-|male|-|normal
blood on chest|胸膛有血|feature|skin|skin_mark|sex|-|-|blood|any|-|normal
disembodied eye|脫離眼球|feature|other|body_part|all|-|-|-|any|-|normal
scar on back|背疤|feature|skin|skin_mark|all|-|-|scar|any|-|normal
sparse navel hair|稀疏肚臍毛|feature|body_m|bm_hair|all|-|-|-|male|-|normal
circle facial mark|圓形臉部標記|feature|skin|tattoo|all|-|-|facial mark|any|-|normal
asymmetrical arms|不對稱手臂|feature|other|body_part|all|-|-|-|any|-|normal
stitched neck|頸部縫線|feature|skin|skin_mark|all|-|-|stitches|any|-|normal
sparse arm hair|稀疏手臂毛|feature|body_m|bm_hair|all|-|male|-|male|-|normal
scar on shoulder|肩疤|feature|skin|skin_mark|all|-|-|scar|any|-|normal
cloud tattoo|雲朵刺青|feature|skin|tattoo|all|-|-|tattoo|any|-|normal
scars all over|全身疤痕|feature|skin|skin_mark|all|-|-|multiple scars,scar|any|-|normal
aroused nosebleed|性興奮鼻血|feature|skin|skin_mark|flash|-|-|nosebleed|any|-|normal
organs|內臟|feature|other|body_part|all|-|-|-|any|-|normal
sparse leg hair|稀疏腿毛|feature|body_m|bm_hair|all|-|male|-|male|-|normal
mole on shoulder|肩上痣|feature|skin|skin_mark|all|-|-|mole|any|-|normal
very hairy|極多體毛|feature|body_m|bm_hair|all|-|-|-|male|-|normal
arrow in body|身上中箭|feature|skin|skin_mark|all|-|-|arrow (projectile)|any|-|normal
triangle facial mark|三角臉部標記|feature|skin|tattoo|all|-|-|facial mark|any|-|normal
alternate facial hair|鬍型不同|feature|body_m|bm_hair|all|-|-|-|male|-|normal
long fingers|長手指|feature|other|body_part|all|-|-|-|any|-|normal
hole in chest|胸口有洞|feature|other|body_part|all|-|-|hole on body|any|-|normal
paint on body|身上有顏料|feature|skin|skin_mark|all|-|-|-|any|-|normal
long arms|長手臂|feature|other|body_part|all|-|-|-|any|-|normal
bruised eye|眼眶瘀青|feature|other|skin_mark|all|-|-|bruise|any|-|normal
v-taper|倒三角體|feature|body_m|bm_build|all|male_build|-|-|male|-|normal
skeletal hand|骷髏手|feature|other|body_part|all|-|-|-|any|-|normal
bite mark on neck|頸部咬痕|feature|skin|skin_mark|all|-|-|bite mark|any|-|normal
bursting pectorals|撐爆胸肌|feature|body_m|bm_build|all|-|-|pectorals|male|-|normal
deep wound|深傷口|feature|skin|skin_mark|all|-|-|injury|any|-|normal
big head|大頭|feature|other|body_part|all|-|-|-|any|-|normal
severed arm|斷臂|feature|other|body_part|sex|-|-|severed limb|any|-|normal
scar on tail|尾巴疤痕|feature|skin|skin_mark|all|-|-|scar|any|-|normal
thick leg hair|濃密腿毛|feature|body_m|bm_hair|all|-|male|-|male|-|normal
bleeding from forehead|額頭流血|feature|skin|skin_mark|all|-|-|-|any|-|normal
cleft chin|下巴中溝|feature|other|body_part|all|-|-|-|any|-|normal
alternate height|身高不同|feature|body_f|bf_shape|all|-|-|-|any|-|normal
hand hair|手毛|feature|body_m|bm_hair|all|-|-|-|male|-|normal
single bare arm|單臂裸露|feature|body_f|body_part|all|-|-|-|any|-|normal
finger tattoo|手指刺青|feature|skin|tattoo|all|-|-|tattoo|any|-|normal
ass hair|臀毛|feature|body_m|bm_hair|flash|-|-|-|male|-|normal
long mustache|長鬍髭|feature|body_m|bm_hair|all|-|-|mustache|male|-|normal
bursting ass|撐爆臀部|feature|body_f|body_part|flash|-|female|-|female|-|normal
personification|擬人|feature|other|persona|all|-|-|-|any|-|normal
mecha musume|機甲娘|feature|race|race_fantasy|all|race|female|-|female|-|normal
multiple persona|多重人格|feature|other|persona|all|-|-|-|any|-|normal
humanization|擬人化|feature|other|persona|all|-|-|-|any|-|normal
panther ears|黑豹耳|feature|other|nonhuman|all|-|-|animal ears|any|-|normal
eastern dragon horns|東方龍角|feature|other|nonhuman|all|-|-|dragon horns|any|-|normal
panther girl|黑豹娘|feature|race|race_kemono|all|race|female|-|female|-|normal
japan national police|日本警察|feature|job|job_modern|all|job|-|police|any|modern|normal
yellow feathers|黃色羽毛|feature|other|nonhuman|all|-|-|feathers|any|-|normal
hyena ears|鬣狗耳|feature|other|nonhuman|all|-|-|-|any|-|normal
single ear down|單耳下垂|feature|other|nonhuman|all|-|-|-|any|-|normal
step-siblings|繼手足|feature|other|relation|all|-|pair|siblings|any|-|normal
panther tail|黑豹尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
eastern dragon tail|東方龍尾|feature|other|nonhuman|all|-|-|dragon tail|any|-|normal
dragon ears|龍耳|feature|other|nonhuman|all|-|-|-|any|-|normal
red scales|紅色鱗片|feature|other|nonhuman|all|-|-|-|any|-|normal
hedgehog girl|刺蝟娘|feature|race|race_kemono|all|race|female|-|female|-|normal
chest tuft|胸口毛簇|feature|other|nonhuman|all|-|-|-|any|-|normal
two-tone wings|雙色翅膀|feature|other|nonhuman|all|-|-|-|any|-|normal
long horns|長角|feature|other|nonhuman|all|-|-|horns|any|-|normal
halfling|半身人|feature|race|race_fantasy|all|race|male|-|male|-|normal
fur-tipped tail|毛尖尾巴|feature|other|nonhuman|all|-|-|-|any|-|normal
green scales|綠色鱗片|feature|other|nonhuman|all|-|-|-|any|-|normal
large horns|大角|feature|other|nonhuman|all|-|-|-|any|-|normal
reptile boy|爬蟲男|feature|race|race_kemono|all|race|male|-|male|-|normal
drawn whiskers|畫上貓鬚|feature|other|nonhuman|all|-|-|-|any|-|normal
brown feathers|棕色羽毛|feature|other|nonhuman|all|-|-|feathers|any|-|normal
mimic|擬態魔物|feature|race|race_fantasy|all|race|male|-|any|-|normal
komainu ears|狛犬耳|feature|other|nonhuman|all|-|-|-|any|-|normal
chipmunk girl|花栗鼠娘|feature|race|race_kemono|all|race|female|-|female|-|normal
goat tail|山羊尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
yuki onna|雪女|feature|race|race_fantasy|all|race|female|-|female|-|normal
jaguar girl|美洲豹娘|feature|race|race_kemono|all|race|female|-|female|-|normal
golem|魔像|feature|race|race_fantasy|all|race|male|-|any|-|normal
red panda ears|小熊貓耳|feature|other|nonhuman|all|animal_ear|-|-|any|-|normal
hedgehog boy|刺蝟男|feature|race|race_kemono|all|race|male|-|male|-|normal
spines|身上的棘刺|feature|other|nonhuman|all|-|-|-|any|-|normal
hook hand|鉤子手|feature|other|nonhuman|all|-|-|-|any|-|normal
pink feathers|粉色羽毛|feature|other|nonhuman|all|-|-|feathers|any|-|normal
penguin girl|企鵝娘|feature|race|race_kemono|all|race|female|-|female|-|normal
intertwined tails|交纏尾巴|feature|other|nonhuman|all|-|-|-|any|-|normal
screw in head|頭部螺絲|feature|other|nonhuman|all|-|-|-|any|-|normal
huge horns|超大角|feature|other|nonhuman|all|-|-|-|any|-|normal
mimic chest|擬態寶箱|feature|race|race_fantasy|all|race|male|mimic|any|-|normal
extra legs|額外腿|feature|other|nonhuman|all|-|-|-|any|-|normal
tiefling|提夫林|feature|race|race_fantasy|all|race|male|-|male|-|normal
electric plug tail|插頭尾|feature|other|nonhuman|all|-|-|cable tail|any|-|normal
train conductor|列車長|feature|job|job_modern|all|job|-|-|any|modern|normal
chipmunk tail|花栗鼠尾|feature|other|nonhuman|all|-|-|-|any|-|normal
hyena boy|鬣狗男|feature|race|race_kemono|all|race|male|-|male|-|normal
blue scales|藍色鱗片|feature|other|nonhuman|all|-|-|-|any|-|normal
pegasus wings|飛馬翅膀|feature|other|nonhuman|all|-|-|-|any|-|normal
orange wings|橙色翅膀|feature|other|nonhuman|all|-|-|wings|any|-|normal
prince|王子|feature|job|job_classic|all|job|male|-|male|-|normal
orca girl|虎鯨娘|feature|race|race_kemono|all|race|female|-|female|-|normal
tendril|卷鬚|feature|other|nonhuman|all|-|-|-|any|-|normal
tree horns|樹枝角|feature|other|nonhuman|all|-|-|horns|any|-|normal
accidental pervert|意外色狼|feature|other|persona|flash|-|-|-|any|-|normal
food-themed creature|食物主題生物|feature|race|race_fantasy|all|race|-|-|any|-|normal
moth wings|飛蛾翅膀|feature|other|nonhuman|all|-|-|insect wings|any|-|normal
giraffe ears|長頸鹿耳|feature|other|nonhuman|all|-|-|animal ears|any|-|normal
drawn wings|畫上翅膀|feature|other|nonhuman|all|-|-|-|any|-|normal
wolf paws|狼掌|feature|other|nonhuman|all|-|-|-|any|-|normal
dj|唱片騎師|feature|job|job_modern|all|job|-|-|any|modern|normal
fujoshi|腐女|feature|job|persona|all|job|female|-|female|-|normal
core|核心|feature|other|nonhuman|all|-|-|-|any|-|normal
dolphin girl|海豚娘|feature|race|race_kemono|all|race|female|-|female|-|normal
mismatched wings|不對稱翅膀|feature|other|nonhuman|all|-|-|asymmetrical wings|any|-|normal
snow leopard girl|雪豹娘|feature|race|race_kemono|all|race|female|-|female|-|normal
tour guide|導遊|feature|job|job_modern|all|job|-|-|any|modern|normal
two-tone horns|雙色角|feature|other|nonhuman|all|-|-|multicolored horns|any|-|normal
female orc|女半獸人|feature|race|race_fantasy|all|race|female|-|female|-|normal
jackal boy|胡狼男|feature|race|race_kemono|all|race|male|-|male|-|normal
forward facing horns|朝前角|feature|other|nonhuman|all|-|-|-|any|-|normal
imperial japanese navy|日本海軍|feature|job|job_modern|all|job|-|-|any|modern|normal
hand between legs|手放腿間|pose|tease|pose_hand|all|-|-|-|any|-|normal
4-finger heart hands|四指比心|pose|tease|pose_sign|all|-|-|-|any|-|normal
on rock|在岩石上|pose|tease|pose_stance|all|-|-|-|any|-|normal
swinging|擺盪|pose|body|body|all|body_pose|-|-|any|-|normal
cropped head|裁頭|pose|camera|cam_frame|all|camera|-|-|any|-|normal
gun to head|槍抵著頭|pose|tease|pose_act|all|-|-|-|any|-|normal
gyaru v|辣妹倒比耶|pose|tease|pose_sign|all|-|-|v|any|-|normal
offering hand|伸手邀人|pose|tease|pose_sign|all|-|-|-|any|-|normal
helmet over eyes|頭盔遮雙眼|pose|tease|pose_act|all|-|-|helmet,covered eyes|any|modern|normal
powering up|蓄力|pose|activity|act_fun|all|activity|-|-|any|-|normal
hands on another's waist|雙手摟腰|pose|tease|pose_two|all|-|pair|-|any|-|normal
hands on own chin|雙手托下巴|pose|tease|pose_hand|all|-|-|-|any|-|normal
band (music)|樂團|pose|activity|act_fun|all|activity|-|-|any|-|normal
mask lift|掀起面具|pose|tease|pose_act|all|-|-|-|any|-|normal
hands on another's back|雙手扶對方背|pose|tease|pose_two|all|-|pair|-|any|-|normal
flirting|調情|pose|tease|pose_situ|all|-|-|-|any|-|normal
heart hands failure|比心失敗|pose|tease|pose_sign|all|-|-|-|any|-|normal
sitting on branch|坐在樹枝上|pose|body|body|all|body_pose|-|-|any|-|normal
sway back|站姿後仰|pose|tease|pose_stance|all|-|-|-|any|-|normal
biting neck|咬脖子|pose|tease|pose_act|all|-|pair|biting|any|-|normal
catching|接住|pose|activity|act_daily|all|activity|-|-|any|-|normal
mugshot|嫌犯照|pose|camera|cam_frame|all|camera|-|-|any|-|normal
bag over head|頭上套袋|pose|tease|pose_act|all|-|-|-|any|-|normal
hand on hand|手疊手|pose|tease|pose_two|all|-|pair|-|any|-|normal
arms on knees|手臂放膝蓋|pose|tease|pose_hand|all|-|-|-|any|-|normal
henshin pose|變身擺姿勢|pose|tease|pose_stance|all|-|-|-|any|-|normal
waving arm|揮動手臂|pose|tease|pose_sign|all|-|-|-|any|-|normal
book on lap|書在腿上|pose|tease|pose_act|all|-|-|book|any|-|normal
feet only|雙腳特寫|pose|camera|cam_frame|all|camera|-|-|any|-|normal
mask over one eye|面具遮單眼|pose|tease|pose_act|all|-|-|-|any|-|normal
front-to-back|前胸貼後背|pose|tease|pose_two|all|-|pair|-|any|-|normal
arms on table|雙臂放桌上|pose|tease|pose_stance|all|-|-|-|any|-|normal
pointing down|向下指|pose|tease|pose_sign|all|-|-|pointing|any|-|normal
toothbrush in mouth|嘴含牙刷|pose|tease|pose_act|all|-|-|toothbrush|any|modern|normal
reaching towards another|伸手向對方|pose|tease|pose_two|all|-|pair|reaching|any|-|normal
typing|打字|pose|activity|act_daily|all|activity|-|-|any|-|normal
x arms|雙手交叉成X|pose|tease|pose_hand|all|-|-|-|any|-|normal
adjusting footwear|整理鞋子|pose|tease|pose_act|all|-|-|-|any|-|normal
object floating above hand|手上方浮物|pose|tease|pose_act|all|-|-|-|any|-|normal
multiple hands|多隻手|pose|tease|pose_situ|all|-|-|-|any|-|normal
on water|在水面上|pose|tease|act_water|all|-|-|-|any|-|normal
rubbing|摩擦|pose|tease|pose_act|all|-|-|-|any|-|normal
arm on table|手臂放桌上|pose|tease|pose_stance|all|-|-|-|any|-|normal
cat's cradle|翻花繩|pose|activity|act_fun|all|activity|-|-|any|-|normal
hiding behind another|躲在人身後|pose|tease|pose_two|all|-|pair|hiding|any|-|normal
removing eyewear|摘下眼鏡|pose|tease|pose_act|all|-|-|-|any|-|normal
riding animal|騎動物|pose|activity|act_daily|all|activity|-|riding|any|-|normal
hugging another's leg|抱住對方腿|pose|tease|pose_two|all|-|pair|-|any|-|normal
chocolate on face|臉沾巧克力|pose|tease|pose_act|all|-|-|chocolate,food on face|any|modern|normal
hands on floor|雙手撐地|pose|tease|pose_hand|all|-|-|-|any|-|normal
sitting on animal|坐在動物上|pose|body|body|all|body_pose|-|-|any|-|normal
racing|競速|pose|activity|act_sport|all|activity|-|-|any|-|normal
licking another's cheek|舔對方臉頰|pose|tease|pose_two|all|-|pair|licking another's face|any|-|normal
head on table|頭靠在桌上|pose|tease|pose_stance|all|-|-|-|any|-|normal
relaxing|放鬆|pose|activity|act_daily|all|activity|-|-|any|-|normal
on crescent|在月牙上|pose|tease|pose_stance|all|-|-|-|any|-|normal
fake video|假影片畫面|pose|camera|cam_frame|all|camera|-|-|any|-|normal
nuzzle|用臉蹭|pose|tease|pose_two|all|-|pair|-|any|-|normal
collar grab|抓住衣領|pose|tease|pose_two|all|-|pair|neckwear grab|any|-|normal
apologizing|道歉|pose|activity|act_daily|all|activity|-|-|any|-|normal
smelling flower|聞花|pose|tease|pose_act|all|-|-|smelling,flower|any|-|normal
cracking knuckles|扳手指|pose|tease|pose_act|all|-|-|-|any|-|normal
hands on another's stomach|雙手貼對方腹|pose|tease|pose_two|all|-|pair|-|any|-|normal
arms around back|雙臂環住後背|pose|tease|pose_two|all|-|pair|-|any|-|normal
peeling|剝皮|pose|activity|act_daily|all|activity|-|-|any|-|normal
w over eye|眼前比W|pose|tease|pose_sign|all|-|-|-|any|-|normal
sliding|滑行|pose|body|body|all|body_pose|-|-|any|-|normal
flower on chest|胸前有花|pose|tease|pose_act|all|-|-|-|any|-|normal
carrying overhead|高舉搬運|pose|activity|act_daily|all|activity|pair|-|any|-|normal
stirring|攪拌|pose|activity|act_daily|all|activity|-|-|any|-|normal
en pointe|足尖站|pose|activity|act_fun|all|activity|-|-|any|-|normal
faceplant|臉貼地|pose|body|body|all|body_pose|-|-|any|-|normal
skateboarding|溜滑板|pose|activity|act_sport|all|activity|-|-|any|modern|normal
adjusting another's clothes|整理對方衣服|pose|tease|pose_act|all|-|pair|-|any|-|normal
ear cleaning|掏耳朵|pose|activity|act_daily|all|activity|-|-|any|-|normal
head on arm|頭枕手臂|pose|tease|pose_act|all|-|-|-|any|-|normal
toasting (gesture)|舉杯乾杯|pose|tease|pose_sign|all|-|-|-|any|-|normal
at gunpoint|被槍指著|pose|tease|pose_two|all|-|pair|-|any|-|normal
uppercut|上勾拳|pose|activity|act_sport|all|activity|-|-|any|-|normal
flower over mouth|花擋在嘴前|pose|tease|pose_act|all|-|-|flower|any|-|normal
rock paper scissors|猜拳|pose|tease|pose_sign|all|-|-|-|any|-|normal
on innertube|坐在泳圈上|pose|body|body|all|body_pose|-|innertube|any|modern|normal
against fence|靠著籬笆|pose|tease|pose_stance|all|-|-|fence|any|-|normal
pinky swear|勾小指|pose|tease|pose_sign|all|-|pair|-|any|-|normal
spraying|噴灑|pose|activity|act_daily|all|activity|-|-|any|-|normal
drawing on another's face|畫在對方臉上|pose|activity|act_daily|all|activity|pair|-|any|-|normal
waist hug|抱住腰|pose|tease|pose_two|all|-|pair|hug|any|-|normal
arm pillow|用手當枕頭|pose|tease|pose_act|all|-|-|-|any|-|normal
picking up|撿東西|pose|activity|act_daily|all|activity|-|-|any|-|normal
peeking through fingers|指縫偷看|pose|tease|pose_hand|all|-|-|-|any|-|normal
paper on head|頭上有紙|pose|tease|pose_act|all|-|-|-|any|-|normal
face grab|抓住對方臉|pose|tease|pose_two|all|-|pair|-|any|-|normal
one arm handstand|單手倒立|pose|body|body|all|body_pose|-|handstand|any|-|normal
bikini tug|拽比基尼|pose|tease|pose_act|flash|-|-|-|any|-|normal
gunbuster pose|Gunbuster姿勢|pose|tease|pose_stance|all|-|-|-|any|-|normal
taking shelter|躲避|pose|activity|act_daily|all|activity|-|-|any|-|normal
sitting on head|坐在頭上|pose|body|body|all|body_pose|pair|sitting on person|any|-|normal
thumb sucking|吮拇指|pose|tease|pose_hand|all|-|-|-|any|-|normal
sweeping|掃地|pose|activity|act_daily|all|activity|-|-|any|-|normal
tasting|品嚐|pose|activity|act_daily|all|activity|-|-|any|-|normal
slouching|癱坐|pose|body|body|all|body_pose|-|-|any|-|normal
delivery|外送|pose|activity|act_daily|all|activity|-|-|any|-|normal
finger counting|數手指|pose|tease|pose_sign|all|-|-|-|any|-|normal
three quarter profile|四分之三側臉|pose|camera|cam_angle|all|camera|-|-|any|-|normal
snapping fingers|打響指|pose|tease|pose_sign|all|-|-|-|any|-|normal
glove in mouth|嘴裡咬手套|pose|tease|pose_act|all|-|-|gloves,mouth hold|any|-|normal
mudra|結手印|pose|tease|pose_sign|all|-|-|-|any|-|normal
collar tug|拽領口|pose|tease|pose_act|all|-|-|-|any|-|normal
kung fu|功夫|pose|activity|act_sport|all|activity|-|-|any|-|normal
after battle|戰鬥剛結束|pose|activity|act_sport|all|activity|-|-|any|-|normal
partially shaded face|局部陰影臉|pose|face|face_mood|all|-|-|-|any|-|normal
clown nose|小丑鼻|pose|face|face_part|all|-|-|-|any|-|normal
wall-eyed|外斜眼|pose|face|face_eyes|all|expression|-|-|any|-|normal
furious|暴怒|pose|face|face_mood|all|expression|-|angry|any|-|normal
despair|絕望|pose|face|face_mood|all|expression|-|-|any|-|normal
diamond mouth|菱形嘴|pose|face|face_mouth|all|-|-|-|any|-|normal
aquiline nose|鷹鉤鼻|pose|face|face_part|all|-|-|nose|any|-|normal
evil eyes|兇惡眼神|pose|face|face_eyes|all|-|-|-|any|-|normal
horrified|驚恐|pose|face|face_mood|all|expression|-|-|any|-|normal
holding crepe|拿可麗餅|pose|tease|pose_hold|all|-|-|crepe,holding food|any|modern|normal
holding watermelon|拿西瓜|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding burger|拿漢堡|pose|tease|pose_hold|all|-|-|burger,holding food|any|modern|normal
holding skewer|拿串籤|pose|tease|pose_hold|all|-|-|skewer,holding|any|modern|normal
holding glowstick|拿螢光棒|pose|tease|pose_hold|all|-|-|holding,glowstick|any|modern|normal
holding ice cream cone|拿甜筒|pose|tease|pose_hold|all|-|-|holding,ice cream cone|any|modern|normal
holding trident|拿三叉戟|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding gem|拿著寶石|pose|tease|pose_hold|all|-|-|gem,holding|any|-|normal
holding whisk|拿打蛋器|pose|tease|pose_hold|all|-|-|whisk,holding|any|modern|normal
holding lighter|拿打火機|pose|tease|pose_hold|all|-|-|lighter,holding|any|modern|normal
holding crossbow|拿十字弓|pose|tease|pose_hold|all|-|-|crossbow,holding weapon|any|ancient_china,ancient_greece,edo,medieval|normal
holding crowbar|拿撬棍|pose|tease|pose_hold|all|-|-|holding,crowbar|any|-|normal
holding watering can|拿著澆水壺|pose|tease|pose_hold|all|-|-|watering can,holding|any|modern|normal
holding flask|拿燒瓶|pose|tease|pose_hold|all|-|-|flask,holding|any|modern|normal
holding blanket|拿毯子|pose|tease|pose_hold|all|-|-|blanket,holding|any|-|normal
holding chainsaw|拿電鋸|pose|tease|pose_hold|all|-|-|chainsaw,holding|any|modern|normal
holding reins|拿韁繩|pose|tease|pose_hold|all|-|-|reins,holding|any|ancient_china,ancient_greece,edo,medieval|normal
holding jar|拿廣口瓶|pose|tease|pose_hold|all|-|-|jar,holding|any|modern|normal
holding necktie|拿著領帶|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding handcuffs|拿著手銬|pose|tease|pose_hold|all|-|-|handcuffs,holding|any|modern|normal
holding another's tail|抱著對方尾巴|pose|tease|pose_hold|all|-|pair|tail|any|-|normal
holding comb|拿梳子|pose|tease|pose_hold|all|-|-|comb,holding|any|-|normal
holding whistle|拿著哨子|pose|tease|pose_hold|all|-|-|whistle,holding|any|-|normal
holding mahjong tile|拿麻將牌|pose|tease|pose_hold|all|-|-|holding,mahjong tile|any|-|normal
holding sketchbook|拿素描本|pose|tease|pose_hold|all|-|-|sketchbook,holding|any|modern,victorian|normal
holding shower head|拿蓮蓬頭|pose|tease|pose_hold|all|-|-|shower head,holding|any|modern|normal
holding flower pot|拿花盆|pose|tease|pose_hold|all|-|-|flower pot,holding|any|-|normal
holding paddle|拿槳／板拍|pose|tease|pose_hold|all|-|-|paddle,holding|any|modern|normal
holding mallet|拿木槌|pose|tease|pose_hold|all|-|-|mallet,holding|any|-|normal
holding carrot|拿紅蘿蔔|pose|tease|pose_hold|all|-|-|carrot,holding|any|-|normal
holding club|拿棍棒|pose|tease|pose_hold|all|-|-|holding weapon,club (weapon)|any|-|normal
holding scarf|拿圍巾|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding pregnancy test|拿驗孕棒|pose|tease|pose_hold|all|-|-|pregnancy test,holding|female|modern|normal
holding bird|拿鳥|pose|tease|pose_hold|all|-|-|bird,holding animal|any|-|normal
holding pocket watch|拿懷錶|pose|tease|pose_hold|all|-|-|pocket watch,holding|any|victorian|normal
instrument on back|背著樂器|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding milk carton|拿牛奶紙盒|pose|tease|pose_hold|all|-|-|milk carton,holding|any|modern|normal
holding palette|拿著調色盤|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding pickaxe|拿十字鎬|pose|tease|pose_hold|all|-|-|pickaxe,holding|any|-|normal
holding lightsaber|拿光劍|pose|tease|pose_hold|all|-|-|-|any|modern|normal
holding barcode scanner|拿掃描器|pose|tease|pose_hold|all|-|-|barcode scanner,holding|any|modern|normal
holding racket|拿球拍|pose|tease|pose_hold|all|-|-|racket,holding|any|modern|normal
holding flashlight|拿手電筒|pose|tease|pose_hold|all|-|-|flashlight,holding|any|modern|normal
ofuda between fingers|指縫夾符紙|pose|tease|pose_hold|all|-|-|ofuda,between fingers|any|ancient_china,edo,modern|normal
holding handkerchief|拿手帕|pose|tease|pose_hold|all|-|-|handkerchief,holding|any|modern|normal
holding cigar|拿雪茄|pose|tease|pose_hold|all|-|-|cigar,holding|any|victorian|normal
holding duster|拿撢子|pose|tease|pose_hold|all|-|-|duster,holding|any|-|normal
holding pumpkin|拿南瓜|pose|tease|pose_hold|all|-|-|holding,pumpkin|any|-|normal
holding petal|拿花瓣|pose|tease|pose_hold|all|-|-|petals,holding|any|-|normal
holding pointer|拿教鞭|pose|tease|pose_hold|all|-|-|pointer,holding|any|modern|normal
holding butterfly net|拿捕蝶網|pose|tease|pose_hold|all|-|-|holding,butterfly net|any|modern|normal
holding bass guitar|拿電貝斯|pose|tease|pose_hold|all|-|-|bass guitar,holding instrument|any|modern|normal
holding star|拿星星|pose|tease|pose_hold|all|-|-|star (symbol),holding|any|-|normal
sitting on throne|坐王座|env|furniture|furniture|all|furniture|-|-|any|ancient_china,medieval,ancient_greece,edo|normal
propeller fighter|螺旋槳戰鬥機|env|place|pl_ride|all|place|-|military vehicle,airplane|any|modern|normal
sparkling aura|閃光氣場|env|effect|fx_glow|all|effect|-|sparkle|any|-|normal
happy aura|開心氣場|env|effect|fx_glow|all|effect|-|-|any|-|normal
aqua flower|水藍花|env|other|obj_plant|all|-|-|flower|any|-|normal
poppy (flower)|罌粟花|env|other|obj_plant|all|-|-|flower|any|-|normal
black bird|黑鳥|env|other|obj_plant|all|-|-|bird|any|-|normal
blue bird|藍鳥|env|other|obj_plant|all|-|-|bird|any|-|normal
black hole|黑洞|env|place|pl_landmark|all|-|-|-|any|-|normal
cerise bouquet|櫻桃紅花束|env|other|obj_plant|all|-|-|-|any|-|normal
red butterfly|紅蝶|env|other|obj_plant|all|-|-|butterfly|any|-|normal
on tank|在戰車上|env|place|pl_ride|all|place|-|-|any|modern|normal
orange cat|橙貓|env|other|obj_plant|all|-|-|cat|any|-|normal
blood on wall|牆上有血|env|other|obj_build|sex|-|-|blood|any|-|normal
tile ceiling|磁磚天花板|env|other|obj_build|all|-|-|ceiling,tiles|any|-|normal
multiple unit train|電聯車|env|place|pl_ride|all|place|-|train|any|modern|normal
loving aura|愛心氣場|env|effect|fx_glow|all|effect|-|-|any|-|normal
static|雪花雜訊|env|effect|fx_lens|all|-|-|-|any|-|normal
queen of spades symbol|黑桃Q符號|env|effect|fx_comic|sex|effect|-|-|any|-|normal
bellflower|風鈴草|env|other|obj_plant|all|-|-|flower|any|-|normal
lotus leaf|荷葉|env|other|obj_plant|all|-|-|-|any|-|normal
pink fire|粉紅火|env|effect|fx_glow|all|effect|-|fire|any|-|normal
cosmos (flower)|波斯菊|env|other|obj_plant|all|-|-|flower|any|-|normal
gleam|微光|env|effect|fx_glow|all|-|-|-|any|-|normal
diorama|箱庭模型|env|other|obj_theme|all|-|-|-|any|-|normal
lgbt pride|彩虹驕傲|env|other|obj_theme|all|-|-|-|any|modern|normal
white rabbit (animal)|白兔|env|other|obj_plant|all|-|-|-|any|-|normal
wall lamp|壁燈|env|light|light|all|lighting|-|-|any|modern,victorian|normal
stop sign|停止標誌|env|other|obj_street|all|-|-|road sign|any|modern|normal
lampshade|燈罩|env|other|obj_furn|all|-|-|-|any|-|normal
pleading face emoji|懇求表情符號|env|effect|fx_comic|all|effect|-|emoji|any|modern|normal
greek cross|希臘十字|env|other|obj_theme|all|-|-|cross|any|-|normal
sprout|嫩芽|env|other|obj_plant|all|-|-|-|any|-|normal
racetrack|賽道|env|place|pl_sport|all|place|-|-|any|modern|normal
blue petals|藍色花瓣|env|effect|fx_fall|all|effect|-|petals|any|-|normal
piano bench|鋼琴椅|env|other|obj_furn|all|-|-|-|any|-|normal
cryokinesis|操冰|env|effect|fx_glow|all|effect|-|-|any|-|normal
tall grass|高草|env|other|obj_plant|all|-|-|grass|any|-|normal
shared blanket|共蓋毯子|env|other|obj_furn|all|-|pair|blanket|any|-|normal
aztec|阿茲特克風|env|other|obj_theme|all|-|-|-|any|-|normal
blue blood|藍色血液|env|effect|fx_fall|flash|effect|-|colored blood|any|-|normal
nemophila (flower)|粉蝶花|env|other|obj_plant|all|-|-|flower|any|-|normal
iris (flower)|鳶尾花|env|other|obj_plant|all|-|-|flower|any|-|normal
dome|圓頂|env|other|obj_build|all|-|-|-|any|-|normal
horn flower|角狀花|env|other|obj_plant|all|-|-|flower|any|-|normal
white dog|白狗|env|other|obj_plant|all|-|-|dog|any|-|normal
carnation|康乃馨|env|other|obj_plant|all|-|-|flower|any|-|normal
hay|乾草|env|other|obj_plant|all|-|-|-|any|-|normal
brown cat|棕貓|env|other|obj_plant|all|-|-|cat|any|-|normal
red sun|紅日|env|light|light|all|lighting|-|-|any|-|normal
crosshair|準星|env|effect|fx_lens|all|-|-|-|any|-|normal
white petals|白色花瓣|env|effect|fx_fall|all|effect|-|petals|any|-|normal
garland (decoration)|花環裝飾|env|other|obj_fest|all|-|-|-|any|-|normal
tile roof|瓦片屋頂|env|other|obj_build|all|-|-|-|any|-|normal
pink tulip|粉鬱金香|env|other|obj_plant|all|-|-|tulip,pink flower|any|-|normal
conch|海螺|env|other|obj_land|all|-|-|-|any|-|normal
seaplane|水上飛機|env|place|pl_ride|all|place|-|airplane|any|modern|normal
swing set|鞦韆架|env|other|obj_sport|all|-|-|-|any|modern|normal
stone walkway|石板步道|env|other|obj_street|all|-|-|-|any|-|normal
snow on head|頭上有雪|env|effect|fx_fall|all|-|-|snow|any|-|normal
mazda|馬自達|env|place|pl_ride|all|place|-|-|any|modern|normal
crocodile|鱷魚|env|other|obj_plant|all|-|-|crocodilian|any|-|normal
fiery background|火焰背景|env|background|background|all|background|-|fire|any|-|normal
swan|天鵝|env|other|obj_plant|all|-|-|bird|any|-|normal
super saiyan 2|超級賽亞人2|env|effect|fx_comic|all|effect|-|super saiyan|any|-|normal
sail|船帆|env|other|obj_build|all|-|-|-|any|-|normal
pansy|三色堇|env|other|obj_plant|all|-|-|flower|any|-|normal
starfighter|星際戰機|env|place|pl_ride|all|place|-|spacecraft|any|modern|normal
underground|地下|env|place|pl_passage|all|place|-|-|any|-|normal
crater|隕石坑|env|other|obj_land|all|-|-|-|any|-|normal
meteor|隕石|env|sky|sky|all|-|-|-|any|-|normal
lavender (flower)|薰衣草|env|other|obj_plant|all|-|-|flower|any|-|normal
saturn (planet)|土星|env|place|pl_landmark|all|place|-|-|any|-|normal
clam|蛤蜊|env|other|obj_plant|all|-|-|-|any|-|normal
invisible floor|透明地板|env|other|obj_build|all|-|-|-|any|-|normal
sacabambaspis|薩卡班甲魚|env|other|obj_plant|all|-|-|-|any|-|normal
pinecone|松果|env|other|obj_plant|all|-|-|-|any|-|normal
tyrannosaurus rex|霸王龍|env|other|obj_plant|all|-|-|-|any|-|normal
energy barrier|能量屏障|env|effect|fx_glow|all|effect|-|-|any|-|normal
multicolored sky|多彩天空|env|sky|sky|all|-|-|sky|any|-|normal
orchid|蘭花|env|other|obj_plant|all|-|-|flower|any|-|normal
entrance|入口|env|place|pl_passage|all|place|-|-|any|-|normal
eurasian tree sparrow|樹麻雀|env|other|obj_plant|all|-|-|sparrow|any|-|normal
body pillow|抱枕|env|other|obj_furn|all|-|-|pillow|any|modern|normal
pony (animal)|小馬|env|other|obj_plant|all|-|-|-|any|-|normal
lobster|龍蝦|env|other|obj_plant|all|-|-|-|any|-|normal
falling flower|落花|env|other|obj_plant|all|-|-|-|any|-|normal
no symbol|禁止標誌|env|other|obj_street|all|-|-|-|any|-|normal
flower bed|花圃|env|place|pl_nature|all|place|-|-|any|-|normal
glowing petals|發光花瓣|env|effect|fx_fall|all|effect|-|glowing,petals|any|-|normal
giraffe|長頸鹿|env|other|obj_plant|all|-|-|-|any|-|normal
biplane|雙翼機|env|place|pl_ride|all|place|-|airplane|any|modern|normal
on boat|在船上|env|place|pl_ride|all|place|-|boat|any|-|normal
getabako|鞋格櫃|env|other|obj_furn|all|-|-|-|any|-|normal
boom barrier|擋車桿|env|other|obj_street|all|-|-|-|any|modern|normal
pixel heart|像素愛心|env|effect|fx_comic|all|effect|-|heart|any|-|normal
hot air balloon|熱氣球|env|place|pl_ride|all|place|-|aircraft|any|modern|normal
ant|螞蟻|env|other|obj_plant|all|-|-|bug|any|-|normal
black butterfly|黑蝶|env|other|obj_plant|all|-|-|butterfly|any|-|normal
rose bush|玫瑰叢|env|other|obj_plant|all|-|-|-|any|-|normal
postbox (outgoing mail)|郵筒|env|other|obj_street|all|-|-|-|any|modern|normal
traffic mirror|道路反射鏡|env|other|obj_street|all|-|-|mirror|any|modern|normal
handrail|扶手|env|other|obj_build|all|-|-|-|any|-|normal
mistletoe|槲寄生|env|other|obj_plant|all|-|-|-|any|-|normal
planetary ring|行星環|env|other|obj_land|all|-|-|-|any|-|normal
tiger cub|虎寶寶|env|other|obj_plant|all|-|-|baby animal,tiger|any|-|normal
blood spray|噴血|env|effect|fx_fall|sex|effect|-|blood|any|-|normal
in orbit|軌道上|env|place|pl_landmark|all|place|-|-|any|-|normal
crustacean|甲殼類|env|other|obj_plant|all|-|-|-|any|-|normal
tokyo big sight|東京國際展示場|env|place|pl_landmark|all|place|-|-|any|modern|normal
mother's day|母親節|env|other|obj_fest|all|-|-|-|any|modern|normal
broken wall|破洞牆|env|other|obj_build|all|-|-|-|any|-|normal
ice crystal|冰晶|env|other|obj_land|all|-|-|-|any|-|normal
grate|格柵|env|other|obj_build|all|-|-|-|any|-|normal
mexico|墨西哥|env|other|obj_theme|all|-|-|-|any|-|normal
string of light bulbs|燈泡串|env|light|light|all|lighting|-|-|any|modern|normal
food-themed background|食物主題背景|env|background|background|all|background|-|-|any|-|normal
bishie sparkle|美少年閃光|env|effect|fx_glow|all|effect|-|-|any|-|normal
empty picture frame|空相框|env|other|obj_furn|all|-|-|picture frame|any|-|normal
ship turret|艦炮|env|other|obj_weapon|all|-|-|-|any|modern|normal
record|黑膠唱片|env|other|obj_tech|all|-|-|-|any|modern|normal
food wrapper|食物包裝紙|env|other|obj_food|all|-|-|-|any|modern|normal
polaroid photo|拍立得照片|env|other|obj_hand|all|-|-|-|any|modern|normal
fender stratocaster|芬達電吉他|env|other|obj_music|all|held_prop|-|electric guitar|any|modern|normal
food packaging|食品包裝盒|env|other|obj_food|all|-|-|-|any|-|normal
narutomaki|鳴門卷|env|other|obj_food|all|-|-|kamaboko|any|modern|normal
lead pipe|鉛管|env|other|obj_weapon|all|-|-|-|any|-|normal
kiwi slice|奇異果片|env|other|obj_food|all|-|-|kiwi (fruit)|any|modern|normal
wok|炒鍋|env|other|obj_hand|all|-|-|-|any|-|normal
inflatable whale|充氣鯨魚|env|other|obj_hand|all|-|-|inflatable toy|any|modern|normal
chocolate syrup|巧克力糖漿|env|other|obj_food|all|-|-|syrup|any|modern|normal
circular saw|圓鋸|env|other|obj_hand|all|held_prop|-|saw|any|modern|normal
cherry tomato|聖女番茄|env|other|obj_food|all|-|-|tomato|any|modern|normal
strawberry slice|草莓片|env|other|obj_food|all|-|-|strawberry|any|modern|normal
on box|在箱子上|env|furniture|furniture|all|furniture|-|box|any|-|normal
pin|大頭針|env|other|obj_hand|all|-|-|-|any|modern|normal
tomato slice|番茄片|env|other|obj_food|all|-|-|tomato|any|modern|normal
digital thermometer|電子體溫計|env|other|obj_hand|all|held_prop|-|thermometer|any|modern|normal
waffle|格子鬆餅|env|other|obj_food|all|-|-|food|any|-|normal
strawberry cake|草莓口味蛋糕|env|other|obj_food|all|-|-|cake|any|modern|normal
asahi breweries|朝日啤酒|env|other|obj_food|all|-|-|-|any|modern|normal
stuffed bird|鳥填充玩具|env|other|obj_hand|all|held_prop|-|stuffed animal|any|modern|normal
wooden box|木箱|env|other|obj_hand|all|-|-|-|any|-|normal
barcode scanner|條碼掃描器|env|other|obj_tech|all|-|-|-|any|modern|normal
chocolate chip cookie|巧克力豆餅乾|env|other|obj_food|all|-|-|cookie|any|modern|normal
keyring|鑰匙圈|env|other|obj_hand|all|-|-|-|any|-|normal
jiaozi|水餃|env|other|obj_food|all|-|-|dumpling|any|modern|normal
egg yolk|蛋黃|env|other|obj_food|all|-|-|-|any|-|normal
bell pepper|甜椒|env|other|obj_food|all|-|-|-|any|modern|normal
spork|叉匙|env|other|obj_food|all|-|-|-|any|-|normal
cue stick|撞球桿|env|other|obj_sport|all|-|-|-|any|-|normal
kebab|烤肉串|env|other|obj_food|all|-|-|-|any|-|normal
shopping basket|購物籃|env|other|obj_hand|all|-|-|-|any|-|normal
beretta 1301|貝瑞塔1301|env|other|obj_weapon|all|-|-|-|any|modern|normal
basketball hoop|籃框|env|other|obj_sport|all|-|-|-|any|-|normal
floating sword|浮空的劍|env|other|obj_weapon|all|-|-|floating weapon,sword|any|-|normal
pon de ring|波堤甜甜圈|env|other|obj_food|all|-|-|donut|any|modern|normal
cymbals|銅鈸|env|other|obj_music|all|-|-|instrument|any|-|normal
animal-themed food|動物造型食物|env|other|obj_food|all|-|-|-|any|-|normal
multiple monitors|多螢幕|env|other|obj_tech|all|-|-|monitor|any|modern|normal
double scoop|雙球冰淇淋|env|other|obj_food|all|-|-|-|any|-|normal
fighting game|格鬥遊戲|env|other|obj_tech|all|-|-|-|any|modern|normal
spiked ball and chain|釘球鎖鏈|env|other|obj_weapon|all|-|-|ball and chain (weapon)|any|medieval|normal
cd case|光碟盒|env|other|obj_hand|all|-|-|-|any|modern|normal
puzzle piece|拼圖片|env|other|obj_hand|all|-|-|-|any|modern|normal
kite|風箏|env|other|obj_hand|all|-|-|-|any|-|normal
pitchfork|草叉|env|other|obj_hand|all|-|-|-|any|-|normal
iv stand|點滴架|env|other|obj_tech|all|-|-|-|any|modern|normal
snowboard|滑雪板|env|other|obj_sport|all|-|-|-|any|-|normal
strong zero|強零酒|env|other|obj_food|all|-|-|-|any|modern|normal
crumpled paper|皺紙|env|other|obj_hand|all|-|-|-|any|modern|normal
grease (mechanical)|潤滑脂|env|other|obj_hand|all|-|-|-|any|-|normal
nori (seaweed)|海苔|env|other|obj_food|all|-|-|-|any|modern|normal
ballistic shield|防彈盾|env|other|obj_weapon|all|-|-|-|any|modern|normal
board eraser|板擦|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
beam cannon|光束砲|env|other|obj_weapon|all|-|-|-|any|modern|normal
character-themed food|角色造型食物|env|other|obj_food|all|-|-|-|any|-|normal
wooden spoon|木湯匙|env|other|obj_food|all|-|-|spoon|any|-|normal
eotech|全息瞄具|env|other|obj_weapon|all|-|-|-|any|modern|normal
boomerang|迴力鏢|env|other|obj_weapon|all|-|-|-|any|-|normal
lighting cigarette|點菸|env|other|obj_hand|all|held_prop|-|-|any|modern,victorian|normal
saxophone|薩克斯風|env|other|obj_music|all|-|-|instrument|any|-|normal
boombox|手提音響|env|other|obj_tech|all|-|-|-|any|modern|normal
flower basket|花籃|env|other|obj_hand|all|-|-|-|any|-|normal
razor|剃刀|env|other|obj_hand|all|-|-|-|any|-|normal
heart wand|愛心魔杖|env|other|obj_hand|all|held_prop|-|-|any|-|normal
ice cream cup|冰淇淋杯|env|other|obj_food|all|-|-|-|any|-|normal
melon soda|哈密瓜汽水|env|other|obj_food|all|-|-|-|any|modern|normal
in bowl|在碗裡|env|other|obj_food|all|-|-|in container|any|modern|normal
liquor|烈酒|env|other|obj_food|all|-|-|alcohol|any|-|normal
target|標靶|env|other|obj_sport|all|-|-|-|any|-|normal
metal baseball bat|金屬球棒|env|other|obj_sport|all|sport_prop|-|baseball bat|any|modern|normal
tako-san wiener|章魚香腸|env|other|obj_food|all|-|-|food art|any|modern|normal
nunchaku|雙節棍|env|other|obj_weapon|all|-|-|weapon|any|-|normal
gelatin|果凍|env|other|obj_food|all|-|-|food|any|-|normal
pastry box|點心盒|env|other|obj_hand|all|-|-|-|any|-|normal
radar|雷達|env|other|obj_tech|all|-|-|-|any|modern|normal
medicine|藥品|env|other|obj_hand|all|-|-|-|any|-|normal
fire extinguisher|滅火器|env|other|obj_hand|all|-|-|-|any|modern|normal
heavy machine gun|重機槍|env|other|obj_weapon|all|-|-|machine gun|any|modern|normal
paperclip|迴紋針|env|other|obj_hand|all|-|-|-|any|-|normal
tank shell|戰車砲彈|env|other|obj_weapon|all|-|-|ammunition|any|modern|normal
rpg (weapon)|RPG火箭彈|env|other|obj_weapon|all|-|-|rocket launcher|any|modern|normal
taiko drum|太鼓|env|other|obj_music|all|-|-|drum|any|edo|normal
tupet|管狀冰棒|env|other|obj_food|all|-|-|-|any|-|normal
fishing hook|魚鉤|env|other|obj_hand|all|-|-|-|any|-|normal
lunchbox|便當盒|env|other|obj_food|all|-|-|-|any|-|normal
stuffed whale|鯨魚填充玩具|env|other|obj_hand|all|held_prop|-|stuffed animal|any|modern|normal
gunpla|鋼普拉|env|other|obj_hand|all|-|-|model kit|any|modern|normal
coffee maker|咖啡機|env|other|obj_tech|all|-|-|-|any|modern|normal
milkshake|奶昔|env|other|obj_food|all|-|-|-|any|-|normal
battery|電池|env|other|obj_tech|all|-|-|-|any|-|normal
nigirizushi|握壽司|env|other|obj_food|all|-|-|sushi|any|edo,modern|normal
pliers|鉗子|env|other|obj_hand|all|-|-|-|any|-|normal
alcohol carton|酒類紙盒|env|other|obj_hand|all|-|-|drink carton|any|modern|normal
apple slice|蘋果片|env|other|obj_food|all|-|-|apple|any|modern|normal
mayonnaise|美乃滋|env|other|obj_food|all|-|-|-|any|-|normal
oden|關東煮|env|other|obj_food|all|-|-|food|any|-|normal
shot glass|一口杯|env|other|obj_food|all|-|-|drinking glass|any|modern|normal
rice cooker|電鍋|env|other|obj_tech|all|-|-|-|any|modern|normal
tank turret|戰車砲塔|env|other|obj_weapon|all|-|-|-|any|modern|normal
salt shaker|鹽罐|env|other|obj_hand|all|-|-|-|any|modern|normal
incoming drink|飛來的飲料|env|other|obj_food|all|-|-|-|any|-|normal
ocarina|陶笛|env|other|obj_music|all|-|-|instrument|any|-|normal
hamburger steak|漢堡排|env|other|obj_food|all|-|-|-|any|modern|normal
billiard ball|撞球|env|other|obj_sport|all|-|-|ball|any|-|normal
m16a1|M16A1步槍|env|other|obj_weapon|all|-|-|m16|any|modern|normal
kayari buta|蚊香豬|env|other|obj_hand|all|-|-|-|any|modern|normal
chocolate cornet|巧克力螺旋麵包|env|other|obj_food|all|-|-|food|any|-|normal
canister|密封罐|env|other|obj_hand|all|-|-|-|any|-|normal
marionette|牽線木偶|env|other|obj_hand|all|held_prop|-|puppet|any|modern|normal
pink innertube|粉色泳圈|env|other|obj_sport|all|-|-|-|any|modern|normal
disco ball|迪斯可球|env|other|obj_hand|all|-|-|-|any|modern|normal
stuffed fish|魚填充玩具|env|other|obj_hand|all|held_prop|-|stuffed animal|any|modern|normal
euphonium|上低音號|env|other|obj_music|all|-|-|instrument|any|-|normal
queen (playing card)|皇后牌|env|other|obj_hand|all|-|-|playing card|any|-|normal
stuffed sheep|綿羊填充玩具|env|other|obj_hand|all|held_prop|-|stuffed animal|any|modern|normal
turntable|唱盤|env|other|obj_tech|all|-|-|-|any|modern|normal
ipad|iPad平板|env|other|obj_tech|all|held_prop|-|tablet pc|any|modern|normal
tanghulu|糖葫蘆|env|other|obj_food|all|-|-|-|any|-|normal
cheesecake|起司蛋糕|env|other|obj_food|all|-|-|food|any|-|normal
puzzle|拼圖|env|other|obj_hand|all|-|-|-|any|-|normal
starting block|起跑器|env|other|obj_sport|all|-|-|-|any|-|normal
shamisen|三味線|env|other|obj_music|all|-|-|instrument|any|edo,modern|normal
cupping glass|拔罐杯|env|other|obj_hand|all|held_prop|-|-|any|modern,victorian|normal
ammunition box|彈藥箱|env|other|obj_hand|all|-|-|-|any|-|normal
sledgehammer|大錘|env|other|obj_hand|all|held_prop|-|hammer|any|-|normal
stuffing|填充棉|env|other|obj_hand|all|-|-|-|any|-|normal
horn (instrument)|銅管號|env|other|obj_music|all|-|-|-|any|-|normal
red outline|紅色描邊|quality|style|style_tech|all|-|-|outline|any|-|normal
screenshot inset|截圖小框|quality|style|style_tech|all|-|-|-|any|-|normal
body horror|肉體恐怖|quality|style|style_era|all|-|-|-|any|-|normal
game screenshot inset|遊戲截圖小框|quality|style|style_tech|all|-|-|screenshot inset|any|-|normal
doodle inset|塗鴉小框|quality|style|style_tech|all|-|-|-|any|-|normal
double exposure|雙重曝光|quality|style|style_tech|all|-|-|-|any|-|normal
orange border|橙色外框|quality|style|style_tech|all|-|-|border|any|-|normal
color contrast|色彩對比|quality|style|style_palette|all|palette|-|-|any|-|normal
low poly|低多邊形|quality|style|style_tech|all|-|-|-|any|-|normal
green outline|綠色描邊|quality|style|style_tech|all|-|-|outline|any|-|normal
scanlines|掃描線|quality|style|style_tech|all|-|-|-|any|-|normal
cartoonized|卡通化|quality|style|style_tech|all|-|-|toon (style)|any|-|normal
sprite|遊戲點陣|quality|style|style_tech|all|-|-|-|any|-|normal
paper texture|紙張質感|quality|style|style_tech|all|-|-|-|any|-|normal
grey outline|灰色描邊|quality|style|style_tech|all|-|-|outline|any|-|normal
round border|圓形外框|quality|style|style_tech|all|-|-|border|any|-|normal
revealing layer|撕層揭示|quality|style|style_tech|all|-|-|-|any|-|normal
fading border|淡出外框|quality|style|style_tech|all|-|-|border|any|-|normal
transparent border|透明外框|quality|style|style_tech|all|-|-|border|any|-|normal
purple outline|紫色描邊|quality|style|style_tech|all|-|-|outline|any|-|normal
spreading own pussy|掰開自己陰部|pose|sex|sex_touch|sex|-|female|spread pussy|female|-|normal
half-spread pussy|半張開陰部|pose|sex|sex_touch|sex|-|female|spread pussy|female|-|normal
saliva on penis|唾液沾陰莖|pose|sex|sex_oral|sex|sex_act|male,pair|penis,saliva|male|-|normal
assisted rape|協助強暴|pose|sex|sex_bdsm|sex|-|pair,male,female|-|any|-|normal
lipstick mark on penis|陰莖唇印|pose|sex|sex_oral|sex|sex_act|male,pair|penis,lipstick mark|male|-|normal
implied after sex|暗示事後|pose|sex|sex_after|sex|-|-|-|any|-|normal
ascot between breasts|領巾夾乳溝|pose|flash|flash_pose|flash|-|-|clothes between breasts,ascot|female|victorian|normal
ass press|屁股壓貼|pose|flash|flash_pose|flash|-|-|-|any|-|normal
spread armpit|撐開腋下|pose|flash|flash_pose|all|-|-|armpits|any|-|normal
shoulder peek|肩膀微露|pose|flash|flash_expose|all|-|-|-|female|-|normal
face in ass|臉埋臀縫|pose|sex|sex_oral|sex|sex_act|pair|-|any|-|normal
cum in cup|精液裝杯|pose|sex|sex_cum|sex|-|male|cum in container|any|-|normal
implied paizuri|暗示乳交|pose|sex|sex_oral|sex|sex_act|male,female,pair|-|female|-|normal
covering chest|遮住胸口|pose|flash|flash_pose|flash|-|-|-|female|-|normal
spreading another's pussy|掰開對方陰部|pose|sex|sex_touch|sex|-|female,pair|spread pussy|female|-|normal
shorts aside|撥開短褲|pose|flash|flash_lift|flash|-|-|shorts,clothing aside|any|modern|normal
blue nipples|藍色乳頭|feature|body_f|bf_intimate|flash|-|female|colored nipples|female|-|skin
cbt|陰莖責罰|pose|sex|sex_fetish|sex|-|male|penis,bdsm|male|-|normal
multiple anal|多插肛|pose|sex|sex_group|sex|sex_act|female,male,pair,group|anal|female|-|normal
black pasties|黑色乳貼|clothing|acc|acc_toy|flash|-|female|-|female|modern|garment
shaped pubic hair|造型陰毛|feature|body_f|bf_intimate|sex|-|-|pubic hair|female|-|skin
grey pubic hair|灰色陰毛|feature|sex|bf_intimate|sex|-|-|pubic hair|any|-|normal
cum on back|射在背上|pose|sex|sex_cum|sex|-|male|cum on body|any|-|normal
pussy cutout|私處開洞|clothing|fabric|fab_state|sex|-|-|-|female|-|garment
suspenders pull|拉扯吊帶|pose|flash|flash_lift|flash|-|-|-|any|-|normal
penetration gesture|插入手勢|pose|sex|pose_sign|sex|-|-|-|any|-|normal
colored condom|彩色保險套|clothing|acc|acc_toy|all|-|-|condom|any|modern|accessory
bouncing penis|陰莖彈動|pose|sex|sex_pos|sex|-|male|penis|male|-|normal
bikini around one leg|比基尼掛在腿上|clothing|fabric|fab_state|flash|-|-|-|any|-|garment
penis on stomach|陰莖貼肚子|pose|sex|sex_pos|sex|-|pair,male|penis|male|-|normal
green pubic hair|綠色陰毛|feature|sex|bf_intimate|sex|-|-|colored pubic hair|any|-|normal
kupaa|私處張開|pose|sex|sex_touch|sex|-|female|-|female|-|normal
tailjob|尾交|pose|sex|sex_oral|sex|sex_act|male,pair|tail|any|-|normal
extra penises|多根陰莖|feature|body_m|bm_penis|sex|-|male|-|male|-|skin
viewer on leash|視角者被牽|pose|sex|sex_bdsm|sex|-|-|leash,pov|any|modern|normal
skirt caught on object|裙子勾到東西|pose|flash|flash_lift|flash|-|-|-|female|-|normal
gigantic penis|超巨陰莖|feature|body_m|bm_penis|sex|-|male|penis|male|-|skin
pussy juice on fingers|手指沾愛液|pose|sex|sex_after|sex|-|female|pussy juice|female|-|normal
ribbon between breasts|緞帶夾乳溝|pose|flash|flash_pose|flash|-|-|-|female|-|normal
autofacial|自顏射|pose|sex|sex_cum|sex|-|male|cum on self|any|-|normal
female ejaculation through clothes|隔衣潮吹|pose|sex|sex_after|sex|-|female|-|female|-|normal
dildo under panties|內褲內假陽具|pose|sex|sex_touch|sex|-|-|-|female|modern|normal
spiked penis|帶刺陰莖|feature|body_m|bm_penis|sex|-|male|-|male|-|skin
fingering from behind|從後指交|pose|sex|sex_touch|sex|-|pair,female|fingering|female|-|normal
bulge to ass|鼓包抵屁股|pose|sex|sex_pos|sex|-|male,pair|bulge|any|-|normal
testicle peek|睪丸露出|pose|flash|flash_expose|sex|-|male|testicles|male|-|normal
buttjob over clothes|隔衣用臀磨|pose|sex|sex_oral|sex|sex_act|male,female,pair|buttjob|female|-|normal
hand on own penis|手握自己陰莖|pose|sex|sex_touch|sex|-|male|-|male|-|normal
alternate breast size|另一種胸圍|feature|body_f|bf_breast|all|-|female|-|female|-|normal
alternate hair length|另一種髮長|feature|hair_len|hair_len|all|hair_length|-|-|any|-|normal
2koma|兩格漫畫|quality|style|style_tech|all|-|-|comic|any|-|normal
3koma|三格漫畫|quality|style|style_tech|all|-|-|comic|any|-|normal
1other|一個其他角色|subject|extra|cast_mix|all|-|-|-|any|-|normal
convenient censoring|巧妙遮擋|pose|flash|flash_pose|flash|-|-|-|any|-|normal
advanced nurturing high school uniform|高度育成制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
hyakkaou academy school uniform|百花王學園服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
herensuge girls academy school uniform|赫倫蘇格制服|clothing|onepiece|op_uniform|all|onepiece|-|-|female|modern|garment
seishou music academy uniform|聖翔音樂學院制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
summer pockets school uniform|夏日口袋制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
yumenosaki school uniform|夢之咲制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
odaiba girls high school uniform|御台場女校服|clothing|onepiece|op_uniform|all|onepiece|-|-|female|modern|garment
night raven college uniform|夜鴉學院制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
tsukinomori school uniform|月之森制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
trinity general school swimsuit|聖三一校園泳衣|clothing|onepiece|op_swim|all|onepiece|-|-|female|modern|garment
sailor swimsuit (idolmaster)|學園水手泳裝|clothing|onepiece|op_swim|all|onepiece|-|-|any|-|garment
serasuku|水手衫罩泳衣|clothing|onepiece|op_swim|all|onepiece|-|-|female|modern|garment
angel's 24 uniform (blue archive)|天使24制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
kogal|校服辣妹|clothing|fabric|fab_style|all|-|-|gyaru|female|modern|garment
sukeban|女高不良|clothing|fabric|fab_style|all|-|-|delinquent|female|modern|garment
bloomers pull|拉燈籠褲|pose|flash|flash_lift|flash|-|-|bloomers|female|modern,victorian|normal
hololive summer 2023 swimsuit|Hololive 2023泳裝|clothing|onepiece|op_swim|all|onepiece|-|-|any|modern|garment
hololive idol uniform (origin)|Hololive初代團服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
self-harm scar|自殘疤痕|feature|skin|skin_mark|all|-|-|scar|any|-|normal
tokiwadai school gym uniform|常盤台體操服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
kamihama university affiliated school uniform|神濱附校制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
raimon soccer uniform|雷門足球隊服|clothing|onepiece|op_uniform|all|onepiece|-|soccer uniform,raimon|any|modern|garment
blueberry academy school uniform|藍莓學園制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
randoseru|小學生書包|clothing|acc|acc_carry|all|-|-|backpack|any|modern|accessory
problem solver 68 (blue archive)|便利屋68|subject|extra|cast_mix|all|-|-|-|any|-|normal
holding baby|抱著嬰兒|pose|tease|pose_hold|all|-|-|-|any|-|normal
hatsuboshi gakuen school uniform|初星學園制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
washbowl|洗臉盆|env|other|obj_classic|all|-|-|-|any|-|normal
""".strip().splitlines()

_HEAT = {
    "all": ["tease", "flash", "sex"],
    "sex": ["sex"],
    "flash": ["flash", "sex"],
    "tease": ["tease"],
}


def _seq(text: str) -> list[str]:
    if not text or text == "-":
        return []
    return [part.strip() for part in text.split(",") if part.strip()]


def _row(line: str) -> dict:
    parts = [part.strip() for part in line.split("|")]
    if len(parts) != 12:
        raise SystemExit(f"欄位數 {len(parts)}：{line}")
    tag, zh, section, group, sub, heat, mutex, needs, implies, gate, era, layer = parts
    return {
        "tag": tag,
        "zh": zh,
        "section": section,
        "group": group,
        "sub": sub,
        "gate": gate or "any",
        "heat": list(_HEAT[heat or "all"]),
        "mutex": None if mutex in ("", "-") else mutex,
        "bind": [],
        "implies": _seq(implies),
        "layer": layer or "normal",
        "era": _seq(era) or ["any"],
        "needs": _seq(needs),
    }


ROWS = [_row(line) for line in _LINES if line.strip() and not line.startswith("#")]

# 正常模式不自己補、只在釘了才出現（也寫在 web/engine.js 的 ODD_MOTIF）。
ODD = ["chihaya (clothing)", "muzzle (mask)", "xiao guan (headdress)", "underworld (ornament)", "anna miller", "whale tail (clothing)", "official alternate eye color", "alternate body size", "alternate facial hair", "alternate height", "accidental pervert", "band (music)", "fake video", "toasting (gesture)", "poppy (flower)", "cosmos (flower)", "white rabbit (animal)", "nemophila (flower)", "iris (flower)", "garland (decoration)", "lavender (flower)", "saturn (planet)", "pony (animal)", "postbox (outgoing mail)", "grease (mechanical)", "nori (seaweed)", "rpg (weapon)", "queen (playing card)", "horn (instrument)", "screenshot inset", "body horror", "game screenshot inset", "doodle inset", "double exposure", "assisted rape", "alternate breast size", "alternate hair length", "2koma", "3koma", "1other", "advanced nurturing high school uniform", "hyakkaou academy school uniform", "herensuge girls academy school uniform", "seishou music academy uniform", "summer pockets school uniform", "yumenosaki school uniform", "odaiba girls high school uniform", "night raven college uniform", "tsukinomori school uniform", "trinity general school swimsuit", "sailor swimsuit (idolmaster)", "serasuku", "angel's 24 uniform (blue archive)", "kogal", "sukeban", "bloomers pull", "hololive summer 2023 swimsuit", "hololive idol uniform (origin)", "self-harm scar", "tokiwadai school gym uniform", "kamihama university affiliated school uniform", "raimon soccer uniform", "blueberry academy school uniform", "randoseru", "problem solver 68 (blue archive)", "holding baby", "hatsuboshi gakuen school uniform"]

# 永遠不抽、不烤（也寫在 web/engine.js 的 NEVER_DRAW）。
NEVER = ["tokiwadai school gym uniform", "kamihama university affiliated school uniform", "raimon soccer uniform", "blueberry academy school uniform", "randoseru", "problem solver 68 (blue archive)", "holding baby"]

NARROW = {"purple rope": ["sex"], "sideless dress": ["flash", "sex"], "front-hook bra": ["flash", "sex"], "undersized breast cup": ["flash", "sex"], "cross-laced cutout": ["flash", "sex"], "see-through one-piece swimsuit": ["flash", "sex"], "two-tone panties": ["flash", "sex"], "just shoes": ["flash", "sex"], "o-ring panties": ["flash", "sex"], "green sports bra": ["flash", "sex"], "undone bra": ["flash", "sex"], "underwear writing": ["flash", "sex"], "naked paint": ["flash", "sex"], "naked chocolate": ["flash", "sex"], "whale tail (clothing)": ["flash", "sex"], "see-through shawl": ["flash", "sex"], "undone sarashi": ["flash", "sex"], "ribbon-trimmed bra": ["flash", "sex"], "naked necktie": ["flash", "sex"], "blood on chest": ["sex"], "aroused nosebleed": ["flash", "sex"], "severed arm": ["sex"], "ass hair": ["flash", "sex"], "bursting ass": ["flash", "sex"], "accidental pervert": ["flash", "sex"], "bikini tug": ["flash", "sex"], "blood on wall": ["sex"], "queen of spades symbol": ["sex"], "blue blood": ["flash", "sex"], "blood spray": ["sex"], "spreading own pussy": ["sex"], "half-spread pussy": ["sex"], "saliva on penis": ["sex"], "assisted rape": ["sex"], "lipstick mark on penis": ["sex"], "implied after sex": ["sex"], "ascot between breasts": ["flash", "sex"], "ass press": ["flash", "sex"], "face in ass": ["sex"], "cum in cup": ["sex"], "implied paizuri": ["sex"], "covering chest": ["flash", "sex"], "spreading another's pussy": ["sex"], "shorts aside": ["flash", "sex"], "blue nipples": ["flash", "sex"], "cbt": ["sex"], "multiple anal": ["sex"], "black pasties": ["flash", "sex"], "shaped pubic hair": ["sex"], "grey pubic hair": ["sex"], "cum on back": ["sex"], "pussy cutout": ["sex"], "suspenders pull": ["flash", "sex"], "penetration gesture": ["sex"], "bouncing penis": ["sex"], "bikini around one leg": ["flash", "sex"], "penis on stomach": ["sex"], "green pubic hair": ["sex"], "kupaa": ["sex"], "tailjob": ["sex"], "extra penises": ["sex"], "viewer on leash": ["sex"], "skirt caught on object": ["flash", "sex"], "gigantic penis": ["sex"], "pussy juice on fingers": ["sex"], "ribbon between breasts": ["flash", "sex"], "autofacial": ["sex"], "female ejaculation through clothes": ["sex"], "dildo under panties": ["sex"], "spiked penis": ["sex"], "fingering from behind": ["sex"], "bulge to ass": ["sex"], "testicle peek": ["sex"], "buttjob over clothes": ["sex"], "hand on own penis": ["sex"], "convenient censoring": ["flash", "sex"], "bloomers pull": ["flash", "sex"]}

CLOTHING_STATE_EXTRA = set(["bikini around one leg", "black pasties", "cross-laced cutout", "front-hook bra", "green sports bra", "just shoes", "naked chocolate", "naked necktie", "naked paint", "o-ring panties", "purple rope", "pussy cutout", "ribbon-trimmed bra", "see-through one-piece swimsuit", "see-through shawl", "sideless dress", "two-tone panties", "undersized breast cup", "underwear writing", "undone bra", "undone sarashi", "whale tail (clothing)"])

ZH_SYNC = {row["tag"]: row["zh"] for row in ROWS}
GROUP_OF = {row["tag"]: row["group"] for row in ROWS}


def extra_sync_20261127_tags():
    return ROWS


def _check() -> None:
    tags = [row["tag"] for row in ROWS]
    if len(tags) != 1065:
        raise SystemExit(f"應為 1065 個字，實際 {len(tags)}")
    if len(tags) != len(set(tags)):
        raise SystemExit("這批有重複的 tag")
    zhs: dict[str, list[str]] = {}
    for row in ROWS:
        zhs.setdefault(row["zh"], []).append(row["tag"])
    collided = {name: owners for name, owners in zhs.items() if len(owners) > 1}
    if collided:
        raise SystemExit(f"這批中文撞名 {collided}")
    known = set(tags)
    for name in (ODD, NEVER, list(NARROW), CLOTHING_STATE_EXTRA):
        missing = set(name) - known
        if missing:
            raise SystemExit(f"名單有這批沒有的字 {sorted(missing)}")
    by = {row["tag"]: row for row in ROWS}
    for tag, heat in NARROW.items():
        if by[tag]["heat"] != heat:
            raise SystemExit(f"{tag} 的熱度跟 NARROW 不一致")


_check()
