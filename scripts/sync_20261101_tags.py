# -*- coding: utf-8 -*-
"""2026-11-01 sync_suggestions_20261031_v2.xlsx 的 260 個字。

分級和分組不照表抄。每個字都在 GROUP_OF，避免 groups.py 用名字裡的
字（eye、light、gate=male）改組。細分類只用既有的格子。

只在釘了才出現的字在 ODD。品質段沒有隨機配額，四個畫風不進 ODD。
衣物要停在性愛或走光的，同時放 CLOTHING_STATE_EXTRA 和 NARROW，
免得 widen_heat 攤成三檔。環境段一定會被攤開，所以沒戴的口塞只靠 NARROW。
"""
from __future__ import annotations

import json
from pathlib import Path

# tag|zh|section|group|sub|heat|mutex|needs|implies|gate|era|layer
# heat: all / sex / flash（flash = 走光+性愛）
# 空的 mutex、needs、implies、era 寫 -
# era 寫 - 代表 any，之後若 implies 的父字時代較窄，merge 會收斂
_LINES = """
hanging light|吊燈（單燈）|env|light|light|all|lighting|-|-|any|modern|normal
firing|開火射擊|pose|activity|act_sport|all|activity|-|gun|any|modern|normal
butterfly brooch|蝴蝶胸針|clothing|acc|acc_jewel|all|jewelry|-|brooch|any|-|accessory
holding bow (music)|拿著琴弓|pose|tease|pose_hold|all|-|-|-|any|-|normal
aqua hairband|水藍髮箍|clothing|acc|acc_head|all|-|-|hairband|any|-|accessory
planet hair ornament|行星髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|any|-|accessory
blue suit|藍色西裝|clothing|onepiece|op_uniform|all|onepiece|-|suit|any|modern,victorian|garment
jetpack|噴射背包|clothing|acc|acc_carry|all|-|-|-|any|modern|accessory
used condom on penis|陰莖上用過的保險套|feature|body_m|bm_penis|sex|-|male|used condom|male|modern|skin
two-sided skirt|雙面色裙|clothing|bottom|bot_skirt|all|bottom|-|skirt|female|-|garment
shirt overhang|上衣胸前垂空|pose|tease|pose_situ|all|-|-|-|any|-|normal
pinstripe jacket|細條紋外套|clothing|outer|outer|all|outer|-|jacket|any|-|garment
analogous colors|類似色配色|quality|style|style_palette|all|-|-|-|any|-|normal
rubber gloves|橡膠手套|clothing|acc|acc_hand|all|hands|-|gloves|any|modern|accessory
holding cake|拿著蛋糕|pose|tease|pose_hold|all|-|-|cake|any|-|normal
lying on lap|躺在別人腿上|pose|tease|pose_two|all|-|pair|-|any|-|normal
butterfly sitting|蝴蝶坐|pose|body|body|all|body_pose|-|-|any|-|normal
ball and chain restraint|腳鐐鐵球|clothing|acc|acc_bind|sex|-|-|shackles|any|-|accessory
green one-piece swimsuit|綠色連身泳裝|clothing|onepiece|op_swim|all|onepiece|-|one-piece swimsuit,swimsuit|female|modern|garment
striped vest|條紋背心|clothing|top|top_tank|all|top|-|vest|any|-|garment
sickle|鐮刀（手鐮）|env|other|obj_weapon|all|-|-|-|any|-|normal
arm on knee|手臂搭在膝上|pose|tease|pose_hand|all|-|-|-|any|-|normal
determined|堅定的表情|pose|face|face_mood|all|expression|-|-|any|-|normal
band uniform|樂隊制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
horseshoe|馬蹄鐵|env|other|obj_hand|all|-|-|-|any|-|normal
object head|物品頭|feature|race|race_fantasy|all|race|-|-|any|-|normal
facing up|閉眼仰臉|pose|gaze|gaze|all|gaze|-|-|any|-|normal
clothesline|曬衣繩|env|other|obj_street|all|-|-|-|any|modern|normal
jaguar tail|美洲豹尾巴|feature|other|nonhuman|all|-|-|tail|any|-|normal
facing down|閉眼低頭|pose|gaze|gaze|all|gaze|-|-|any|-|normal
red track suit|紅色運動套裝|clothing|onepiece|op_uniform|all|onepiece|-|track suit|any|modern|garment
hooded vest|連帽背心|clothing|top|top_tank|all|top|-|vest|any|-|garment
red nose|紅鼻子|feature|skin|skin_flush|all|-|-|-|any|-|normal
footwear flower|鞋上花飾|clothing|feet|feet|all|-|-|-|any|-|accessory
applying own makeup|自己上妝|pose|activity|act_daily|all|activity|-|makeup|female|-|normal
x3|x3 表情|pose|face|face_mouth|all|expression|-|-|any|-|normal
implied kiss|暗示接吻|pose|tease|pose_two|all|-|pair|-|any|-|normal
flower in mouth|嘴裡咬花|pose|face|face_mouth|all|-|-|-|any|-|normal
circle formation|圍成一圈|pose|tease|pose_situ|all|-|group|-|any|-|normal
green eyeshadow|綠色眼影|feature|eyes|makeup|all|-|-|eyeshadow|female|-|normal
labret piercing|下唇環|clothing|acc|acc_jewel|all|-|-|piercing|any|-|accessory
cellphone charm|手機吊飾|clothing|acc|acc_carry|all|-|-|-|any|modern|accessory
nudist|天體主義者|clothing|nude|nude|all|nudity|-|nude|any|-|skin
presenting own ass|展示自己的屁股|pose|flash|flash_pose|flash|-|-|-|female|-|normal
groom|新郎|feature|other|persona|all|-|male|-|male|-|normal
glory wall|穿牆卡住（性）|pose|sex|sex_fetish|sex|-|-|glory hole|any|modern|normal
wheelbarrow|手推車（獨輪）|env|other|obj_furn|all|-|-|-|any|modern|normal
lone nape hair|一撮後頸髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
tucked penis|陰莖夾藏|feature|body_m|bm_penis|sex|-|male|-|male|-|skin
pointing forward|往前指|pose|tease|pose_sign|all|-|-|-|any|-|normal
food bite|咬痕缺口|env|other|obj_food|all|-|-|-|any|-|normal
honeycomb background|蜂巢背景|env|background|background|all|background|-|-|any|-|normal
skeleton print|骷髏骨架印花|clothing|fabric|fab_material|all|-|-|-|any|-|garment
cardigan under jacket|外套內穿開襟衫|clothing|fabric|fab_state|all|-|-|jacket|any|-|garment
huge dildo|巨大假陽具|clothing|acc|acc_toy|all|-|-|dildo|any|modern|accessory
leaf umbrella|葉子當傘|pose|tease|pose_hold|all|-|-|-|any|-|normal
purple pupils|紫色瞳孔|feature|eyes|eye_shape|all|-|-|-|any|-|normal
twintails with hair base|雙馬尾帶髮包|feature|hair_style|hair_shape|all|hair_style|-|twintails|any|-|normal
jewel under eye|眼下寶石|feature|skin|skin_mark|all|-|-|-|any|-|normal
finger to another's mouth|手指按對方嘴|pose|tease|pose_two|all|-|pair|-|any|-|normal
sharp tail|尖尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
stitched arm|手臂縫線|feature|skin|skin_mark|all|-|-|stitches|any|-|normal
ankle wrap|腳踝纏布|clothing|feet|feet|all|-|-|-|any|-|accessory
white pubic hair|白色陰毛|feature|sex|bf_intimate|sex|-|-|colored pubic hair|any|-|normal
clawed gauntlets|爪形護手|clothing|acc|acc_hand|all|hands|-|gauntlets|any|-|accessory
cuff links|袖扣|clothing|acc|acc_hand|all|-|-|-|any|modern,victorian|accessory
van|廂型車|env|other|obj_tech|all|-|-|-|any|modern|normal
unworn bikini bottom|脫下的比基尼褲|env|other|obj_hand|all|-|-|-|any|modern|normal
menu board|菜單看板|env|other|obj_furn|all|-|-|-|any|modern|normal
adapted uniform|改造制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
soap bottle|沐浴乳瓶|env|other|obj_hand|all|-|-|-|any|modern|normal
pink horns|粉紅色角|feature|other|nonhuman|all|-|-|horns|any|-|normal
forehead tattoo|額頭刺青|feature|skin|tattoo|all|-|-|tattoo|any|-|normal
chained wrists|手腕被鎖鏈綁住|pose|sex|sex_bdsm|sex|-|-|-|any|-|normal
side ahoge|側呆毛|feature|hair_style|hair_detail|all|-|-|ahoge|any|-|normal
hand on table|手放桌上|pose|tease|pose_hand|all|-|-|-|any|-|normal
4others|四個其他角色|subject|extra|cast_mix|all|-|-|-|any|-|normal
facing ahead|閉眼面向前方|pose|gaze|gaze|all|gaze|-|-|any|-|normal
bent over furniture|趴靠家具彎腰|pose|flash|flash_pose|flash|-|-|bent over|any|-|normal
clownfish|小丑魚|env|other|obj_plant|all|-|-|-|any|-|normal
fishing line|釣魚線|env|other|obj_sport|all|-|-|-|any|-|normal
white scales|白色鱗片|feature|other|nonhuman|all|-|-|scales|any|-|normal
gradient horns|漸層色角|feature|other|nonhuman|all|-|-|horns|any|-|normal
white sky|白色天空|env|sky|sky|all|-|-|-|any|-|normal
heart on chest|胸口愛心|feature|skin|tattoo|all|-|-|-|any|-|normal
cart|推車|env|other|obj_furn|all|-|-|-|any|-|normal
grey bowtie|灰色領結|clothing|acc|acc_neck|all|neckwear|-|bowtie|any|modern,victorian|accessory
mannequin|人台模特兒|env|other|obj_furn|all|-|-|-|any|modern|normal
stopwatch|碼錶|env|other|obj_hand|all|-|-|-|any|modern|normal
holding with feet|用腳拿東西|pose|tease|pose_act|all|-|-|-|any|-|normal
unworn necktie|脫下的領帶|env|other|obj_hand|all|-|-|-|any|modern|normal
layered shirt|多層上衣|clothing|top|top_shirt|all|top|-|shirt|any|-|garment
gradient wings|漸層色翅膀|feature|other|nonhuman|all|-|-|wings|any|-|normal
ehoumaki|惠方卷|env|other|obj_food|all|-|-|-|any|edo,modern|normal
thong aside|丁字褲撥到一旁|pose|flash|flash_expose|flash|clothes_action|-|thong|female|-|normal
studded choker|鉚釘頸圈|clothing|acc|acc_neck|all|neckwear|-|choker|female|-|accessory
black eyeliner|黑色眼線|feature|makeup|makeup|all|-|-|-|female|-|normal
hat tassel|帽穗|clothing|acc|acc_head|all|-|-|-|any|-|accessory
lightning bolt print|閃電印花|clothing|fabric|fab_material|all|-|-|-|any|-|garment
holding mirror|拿著鏡子|pose|tease|pose_hold|all|-|-|mirror|any|-|normal
gingham clothes|格紋衣|clothing|fabric|fab_material|all|-|-|-|any|-|garment
folder|文件夾|env|other|obj_hand|all|-|-|-|any|modern|normal
eye reflection|眼中倒影|feature|eyes|eye_shape|all|-|-|-|any|-|normal
humping|隔衣磨蹭|pose|sex|sex_oral|sex|-|pair|-|any|-|normal
clothed male nude male|穿衣男與裸男|pose|flash|flash_expose|flash|-|male,2male,pair,yaoi|yaoi|male|-|normal
fur-trimmed shirt|毛邊上衣|clothing|top|top_shirt|all|top|-|shirt|any|-|garment
otter|水獺|env|other|obj_plant|all|-|-|-|any|-|normal
purple butterfly|紫色蝴蝶|env|other|obj_plant|all|-|-|butterfly|any|-|normal
holding photo|拿著照片|pose|tease|pose_hold|all|-|-|-|any|-|normal
bee|蜜蜂|env|other|obj_plant|all|-|-|-|any|-|normal
exercise ball|瑜伽球|env|other|obj_sport|all|-|-|-|any|modern|normal
blue pubic hair|藍色陰毛|feature|sex|bf_intimate|sex|-|-|colored pubic hair|any|-|normal
lowleg skirt|低腰裙|clothing|bottom|bot_skirt|all|bottom|-|skirt|female|-|garment
inflatable raft|充氣筏|env|other|obj_sport|all|-|-|-|any|modern|normal
webbed hands|蹼手|feature|other|nonhuman|all|-|-|-|any|-|normal
cola|可樂|env|other|obj_food|all|-|-|-|any|modern|normal
frilled umbrella|荷葉邊洋傘|env|other|obj_hand|all|-|-|umbrella|any|-|normal
mast|船桅|env|other|obj_build|all|-|-|-|any|-|normal
uneven twintails|不對稱雙馬尾|feature|hair_style|hair_shape|all|hair_style|-|twintails|any|-|normal
holding scroll|拿著卷軸|pose|tease|pose_hold|all|-|-|scroll|any|-|normal
holding shirt|拿著上衣|pose|tease|pose_hold|all|-|-|shirt|any|-|normal
undone neck ribbon|鬆開的領口緞帶|clothing|acc|acc_neck|all|neckwear|-|neck ribbon|any|-|accessory
ferret|雪貂|env|other|obj_plant|all|-|-|-|any|-|normal
cigarette pack|菸盒|env|other|obj_hand|all|-|-|-|any|modern|normal
seatbelt|安全帶|env|other|obj_tech|all|-|-|-|any|modern|normal
red suit|紅色西裝|clothing|onepiece|op_uniform|all|onepiece|-|suit|any|modern,victorian|garment
listening to music|聽音樂|pose|activity|act_daily|all|activity|-|-|any|modern|normal
gyaruo|辣男（男版辣妹）|feature|other|persona|all|-|male|-|male|modern|normal
foreplay|前戲|pose|sex|sex_touch|sex|-|pair|-|any|-|normal
keep out|KEEP OUT 字樣|env|other|obj_street|all|-|-|-|any|modern|normal
on roof|在斜屋頂上|pose|tease|pose_stance|all|-|-|-|any|-|normal
cum on eyewear|眼鏡上的精液|pose|sex|sex_cum|sex|-|male,female,pair|cum|any|-|normal
vertical-striped panties|直條紋內褲|clothing|underwear|uw_bottom|all|underwear_bottom|-|panties|female|modern|garment
heart-shaped eyes|愛心形眼睛|feature|eyes|eye_shape|all|-|-|-|any|-|normal
toe cleavage|鞋口露趾縫|clothing|feet|feet|all|-|-|-|any|-|normal
strapless bottom|無帶遮私下身|clothing|underwear|uw_bottom|flash|underwear_bottom|-|-|female|modern|underwear
naked tabard|只穿前垂布|clothing|onepiece|op_only|flash|onepiece|-|-|any|-|garment
hugging book|抱著書|pose|tease|pose_act|all|-|-|book|any|-|normal
prostration|伏地跪拜（orz）|pose|body|body|all|body_pose|-|-|any|-|normal
star-shaped eyewear|星形眼鏡|clothing|acc|acc_face|all|eyewear|-|-|any|-|accessory
grey apron|灰色圍裙|clothing|onepiece|op_uniform|all|onepiece|-|apron|female|-|garment
holly hair ornament|冬青髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|any|-|accessory
black male swimwear|黑色男泳褲|clothing|onepiece|op_swim|all|onepiece|-|male swimwear|male|modern|garment
biting own finger|咬自己的手指|pose|face|face_part|all|-|-|-|any|-|normal
hand wraps|手部纏布|clothing|acc|acc_bandage|all|-|-|-|any|-|accessory
corsage|胸花|clothing|acc|acc_jewel|all|-|-|-|any|modern|accessory
jiangshi costume|殭屍服裝|clothing|era|era_cn|all|onepiece|-|-|any|ancient_china,modern|garment
dragonfly|蜻蜓|env|other|obj_plant|all|-|-|-|any|-|normal
lipgloss|唇蜜|feature|makeup|makeup|all|-|-|-|female|-|normal
holding fish|拿著魚|pose|tease|pose_hold|all|-|-|fish|any|-|normal
braiding hair|編頭髮|pose|activity|act_daily|all|activity|-|-|any|-|normal
marking on cheek|臉頰記號|feature|skin|skin_mark|all|-|-|-|any|-|normal
hugging viewer|要抱觀眾|pose|tease|pose_act|all|-|-|-|any|-|normal
rabbit costume|兔子布偶裝|clothing|onepiece|op_body|all|onepiece|-|-|any|modern|garment
pelvic curtain lift|掀起腰前垂布|pose|flash|flash_expose|flash|clothes_action|-|pelvic curtain|female|-|normal
leaf earrings|葉子耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
hand grip|吊環（車廂把手）|env|other|obj_furn|all|-|-|-|any|modern|normal
brown lips|棕色嘴唇|feature|makeup|makeup|all|-|-|-|female|-|normal
casting spell|施法|pose|activity|act_fun|all|activity|-|-|any|-|normal
checkered bow|棋盤格蝴蝶結|clothing|acc|acc_bow|all|-|-|bow|any|-|accessory
yellow camisole|黃色細肩帶背心|clothing|top|top_tank|all|top|-|camisole|female|modern|garment
floating headgear|漂浮頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
behind-the-head headphones|後掛式耳機|clothing|acc|acc_face|all|headwear|-|headphones|any|modern|accessory
white bandeau|白色抹胸|clothing|top|top_shirt|all|top|-|bandeau|any|modern|garment
red petals|紅色花瓣|env|effect|fx_fall|all|effect|-|petals|any|-|normal
gold coin|金幣|env|other|obj_hand|all|-|-|-|any|-|normal
chakram|環刃|env|other|obj_weapon|all|-|-|-|any|-|normal
nipple chain|乳頭鏈|clothing|acc|acc_toy|sex|-|-|-|female|-|accessory
stained clothes|衣服污漬|clothing|fabric|fab_state|all|-|-|-|any|-|garment
nebula|星雲|env|sky|sky|all|-|-|-|any|-|normal
penis in panties|陰莖在內褲裡|feature|body_m|bm_penis|flash|-|male|-|male|-|skin
cuirass|胸背甲|clothing|era|era_west|all|-|-|-|any|medieval|garment
midriff sarashi|腹部纏布|clothing|top|top_tank|all|top|-|sarashi|female|-|garment
soft serve|霜淇淋|env|other|obj_food|all|-|-|-|any|modern|normal
tamagoyaki|玉子燒|env|other|obj_food|all|-|-|-|any|edo,modern|normal
giant monster|巨大怪獸|env|other|obj_plant|all|-|-|-|any|-|normal
holding flute|拿著長笛|pose|tease|pose_hold|all|-|-|flute|any|-|normal
implied masturbation|暗示自慰|pose|sex|sex_touch|sex|-|-|masturbation|any|-|normal
holed coin|方孔錢|env|other|obj_hand|all|-|-|-|any|ancient_china,edo|normal
police badge|警徽|clothing|acc|acc_jewel|all|-|-|-|any|modern|accessory
covering another's eyes|遮住對方眼睛|pose|tease|pose_two|all|-|pair|-|any|-|normal
protecting|保護他人|pose|tease|pose_two|all|-|pair|-|any|-|normal
unworn eyepatch|拿下的眼罩|env|other|obj_hand|all|-|-|-|any|-|normal
crotch zipper|襠部拉鍊|clothing|fabric|fab_detail|all|-|-|-|any|-|garment
hexagon print|六角形印花|clothing|fabric|fab_material|all|-|-|-|any|-|garment
clock eyes|時鐘眼|feature|eyes|eye_shape|all|-|-|-|any|-|normal
scoop neck|U 字領|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
black tiara|黑色頭冠|clothing|acc|acc_head|all|headwear|-|tiara|female|-|accessory
holding another's horns|抓住對方的角|pose|sex|sex_touch|sex|-|pair|-|any|-|normal
aqua leotard|水藍色緊身衣|clothing|onepiece|op_body|all|onepiece|-|leotard|female|modern|garment
locomotive|火車頭|env|other|obj_tech|all|-|-|-|any|modern|normal
cut bangs|參差瀏海|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
unworn gag|沒戴著的口塞|env|other|obj_hand|sex|-|-|-|any|modern|normal
pastry bag|擠花袋|env|other|obj_food|all|-|-|-|any|modern|normal
crowbar|撬棍|env|other|obj_weapon|all|-|-|-|any|-|normal
nail bat|釘棒|env|other|obj_weapon|all|-|-|-|any|-|normal
multicolored bowtie|多色領結|clothing|acc|acc_neck|all|neckwear|-|bowtie|any|modern,victorian|accessory
brown sash|棕色腰帶布|clothing|acc|acc_hand|all|waist|-|sash|any|-|accessory
arthropod boy|節肢特徵男性|feature|race|race_fantasy|all|race|male|-|male|-|normal
borderless panels|無框分格|quality|style|style_tech|all|-|-|-|any|-|normal
single braided sidelock|單邊鬢辮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
carapace|甲殼|feature|other|nonhuman|all|-|-|-|any|-|normal
cobblestone|石板路|env|background|background|all|background|-|-|any|-|normal
ticket|票券|env|other|obj_hand|all|-|-|-|any|modern|normal
at computer|在電腦前|pose|activity|act_daily|all|activity|-|computer|any|modern|normal
studded collar|鉚釘項圈|clothing|acc|acc_neck|all|neckwear|-|collar|any|-|accessory
raccoon|浣熊|env|other|obj_plant|all|-|-|-|any|-|normal
animal head|動物頭|feature|race|race_fantasy|all|race|-|-|any|-|normal
surrounded|被包圍|pose|tease|pose_situ|all|-|group|-|any|-|normal
adjusting panties|調整內褲|pose|flash|flash_expose|flash|clothes_action|-|panties|female|-|normal
chibikemo|Q 版獸人|quality|style|style_tech|all|-|-|chibi|any|-|normal
cauldron|大鍋（魔女鍋）|env|other|obj_classic|all|-|-|-|any|-|normal
model kit|模型套件|env|other|obj_hand|all|-|-|-|any|modern|normal
volleyball net|排球網|env|other|obj_sport|all|-|-|-|any|modern|normal
fat rolls|肚子肥肉|feature|body_f|bf_shape|all|-|-|-|any|-|normal
holding shovel|拿著鏟子|pose|tease|pose_hold|all|-|-|shovel|any|-|normal
blue sweater vest|藍色毛衣背心|clothing|top|top_knit|all|top|-|sweater vest|any|modern|garment
throwing knife|飛刀|env|other|obj_weapon|all|-|-|-|any|-|normal
holding lipstick tube|拿著口紅|pose|tease|pose_hold|all|-|-|lipstick tube|any|-|normal
unworn bikini|脫下的比基尼|env|other|obj_hand|all|-|-|-|any|modern|normal
crazy straw|造型吸管|env|other|obj_food|all|-|-|-|any|modern|normal
patterned hair|花紋頭髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
cum on fingers|手指上的精液|pose|sex|sex_cum|sex|-|male,female,pair|cum|any|-|normal
aqua kimono|水藍色和服|clothing|era|era_jp|all|-|-|-|any|edo|garment
low-cut armhole|低開袖孔|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
seal (animal)|海豹|env|other|obj_plant|all|-|-|-|any|-|normal
stuffed penguin|企鵝玩偶|env|other|obj_hand|all|-|-|-|any|modern|normal
bloodshot eyes|眼睛布滿血絲|feature|eyes|eye_shape|all|-|-|-|any|-|normal
unworn hair ornament|拿下的髮飾|env|other|obj_hand|all|-|-|-|any|-|normal
purple armor|紫色盔甲|clothing|era|era_west|all|onepiece|-|armor|any|-|garment
cat on shoulder|肩上的貓|pose|tease|pose_situ|all|-|-|cat|any|-|normal
frilled wrist cuffs|荷葉邊袖套|clothing|acc|acc_jewel|all|-|-|wrist cuffs|any|-|accessory
maple leaf print|楓葉印花|clothing|fabric|fab_material|all|-|-|-|any|-|garment
shippou (pattern)|七寶紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
pig ears|豬耳|feature|other|nonhuman|all|animal_ear|-|animal ears|any|-|normal
looking at hand|看著手|pose|gaze|gaze|all|gaze|-|-|any|-|normal
brown neckerchief|棕色領巾|clothing|acc|acc_neck|all|neckwear|-|neckerchief|any|-|accessory
jersey maid|運動服女僕|clothing|onepiece|op_uniform|all|onepiece|-|-|female|modern|garment
brown mittens|棕色連指手套|clothing|acc|acc_hand|all|hands|-|gloves|any|modern|accessory
pumpkin hair ornament|南瓜髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|any|-|accessory
dress swimsuit|洋裝式泳裝|clothing|onepiece|op_swim|all|onepiece|-|swimsuit|female|modern|garment
one-piece thong|丁字連身泳裝|clothing|onepiece|op_swim|all|onepiece|-|one-piece swimsuit|female|modern|garment
fried chicken|炸雞|env|other|obj_food|all|-|-|-|any|modern|normal
vertical-striped shorts|直條紋短褲|clothing|bottom|bot_pants|all|bottom|-|shorts|any|modern|garment
pink tank top|粉紅色背心|clothing|top|top_tank|all|top|-|tank top|any|modern|garment
partial humanization|部分擬人化|feature|other|persona|all|-|-|-|any|-|normal
clueless|一臉茫然|pose|face|face_mood|all|expression|-|-|any|-|normal
green cardigan|綠色開襟衫|clothing|outer|outer|all|outer|-|cardigan|any|modern|garment
lop rabbit ears|垂耳兔耳|feature|other|nonhuman|all|animal_ear|-|animal ears|any|-|normal
shrugging|聳肩|pose|tease|pose_hand|all|-|-|-|any|-|normal
gothic punk|哥德龐克|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
flower trim|花朵滾邊|clothing|fabric|fab_detail|all|-|-|-|any|-|garment
christmas stocking|聖誕襪|env|other|obj_fest|all|-|-|-|any|modern|normal
male on futa|男對扶她|pose|sex|sex_pos|sex|sex_act|male,female,pair|futanari|female|-|normal
bikini shorts|比基尼短褲|clothing|underwear|uw_bottom|all|underwear_bottom|-|-|female|modern|underwear
red wine|紅酒|env|other|obj_food|all|-|-|-|any|-|normal
combat knife|戰鬥刀|env|other|obj_weapon|all|-|-|-|any|-|normal
deer tail|鹿尾巴|feature|other|nonhuman|all|-|-|tail|any|-|normal
blue outline|藍色外框線|quality|style|style_tech|all|-|-|outline|any|-|normal
drugged|下藥|pose|sex|sex_fetish|sex|-|-|-|any|-|normal
""".strip().splitlines()

_HEAT = {
    "all": ["tease", "flash", "sex"],
    "sex": ["sex"],
    "flash": ["flash", "sex"],
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

# 正常模式不自己補。非自願、拘束、只有性愛，以及會改寫整張圖的字。
ODD = [
    "drugged",
    "chained wrists",
    "ball and chain restraint",
    "unworn gag",
    "glory wall",
    "keep out",
    "4others",
    "giant monster",
]

# 環境一定被 widen 成三檔。沒戴的口塞不是能出現在誘惑裡的道具。
# 衣服若已在 CLOTHING_STATE_EXTRA，這裡再寫一次，避免只改一邊。
NARROW = {
    "ball and chain restraint": ["sex"],
    "nipple chain": ["sex"],
    "unworn gag": ["sex"],
    "strapless bottom": ["flash", "sex"],
    "naked tabard": ["flash", "sex"],
}

CLOTHING_STATE_EXTRA = {
    "ball and chain restraint",
    "nipple chain",
    "strapless bottom",
    "naked tabard",
}

NEEDS_MALE_EXTRA = {
    "gyaruo",
    "groom",
    "arthropod boy",
    "black male swimwear",
    "tucked penis",
    "penis in panties",
    "used condom on penis",
    "male on futa",
    "clothed male nude male",
    "cum on eyewear",
    "cum on fingers",
}
NEEDS_FEMALE_EXTRA = {
    "male on futa",
    "cum on eyewear",
    "cum on fingers",
}
NEEDS_PAIR_EXTRA = {
    "humping",
    "foreplay",
    "holding another's horns",
    "male on futa",
    "clothed male nude male",
    "lying on lap",
    "implied kiss",
    "finger to another's mouth",
    "covering another's eyes",
    "protecting",
    "cum on eyewear",
    "cum on fingers",
}
NEEDS_2MALE_EXTRA = {"clothed male nude male"}
NEEDS_GROUP_EXTRA = {"circle formation", "surrounded"}

ZH_SYNC = {row["tag"]: row["zh"] for row in ROWS}
GROUP_OF = {row["tag"]: row["group"] for row in ROWS}


def extra_sync_20261101_tags():
    return ROWS


def _check() -> None:
    tags = [row["tag"] for row in ROWS]
    if len(tags) != 260:
        raise SystemExit(f"應為 260 個字，實際 {len(tags)}")
    if len(tags) != len(set(tags)):
        raise SystemExit("這批有重複的 tag")
    zhs: dict[str, list[str]] = {}
    for row in ROWS:
        zhs.setdefault(row["zh"], []).append(row["tag"])
    collided = {name: owners for name, owners in zhs.items() if len(owners) > 1}
    if collided:
        raise SystemExit(f"這批中文撞名 {collided}")
    known = set(tags)
    for name in (
        ODD,
        list(NARROW),
        CLOTHING_STATE_EXTRA,
        NEEDS_MALE_EXTRA,
        NEEDS_FEMALE_EXTRA,
        NEEDS_PAIR_EXTRA,
        NEEDS_2MALE_EXTRA,
        NEEDS_GROUP_EXTRA,
    ):
        missing = set(name) - known
        if missing:
            raise SystemExit(f"名單有詞庫沒有的字 {sorted(missing)}")
    by = {row["tag"]: row for row in ROWS}
    for tag, heat in NARROW.items():
        if by[tag]["heat"] != heat:
            raise SystemExit(f"{tag} 的熱度跟 NARROW 不一致")
    root = Path(__file__).resolve().parents[1]
    path = root / "web" / "lexicon.json"
    # 重做測試在暫存資料夾跑，那裡還沒有詞庫。有詞庫才對父字和中文。
    if not path.is_file():
        return
    lex = json.loads(path.read_text(encoding="utf-8"))
    existing = {item["tag"] for item in lex["tags"]}
    zh_owner: dict[str, str] = {}
    for item in lex["tags"]:
        if item.get("zh"):
            zh_owner.setdefault(item["zh"], item["tag"])
    chars_path = root / "scripts" / "characters.json"
    if chars_path.is_file():
        chars = json.loads(chars_path.read_text(encoding="utf-8"))
        if isinstance(chars, dict):
            chars = chars.get("characters") or chars.get("rows") or []
        for char in chars:
            if char.get("zh"):
                zh_owner.setdefault(char["zh"], "CHAR:" + char.get("tag", ""))
    problems = []
    for row in ROWS:
        owner = zh_owner.get(row["zh"])
        if owner and owner != row["tag"]:
            problems.append(f"中文撞名 {row['zh']} = {owner}")
        for parent in row["implies"]:
            if parent not in existing and parent not in known:
                problems.append(f"{row['tag']} implies 不存在的 {parent}")
    if problems:
        raise SystemExit("\n".join(problems))


_check()
