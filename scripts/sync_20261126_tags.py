# -*- coding: utf-8 -*-
"""2026-11-26 專案主給的模型認得清單（mochi-missing-tags.md，716 個）與 alltags.txt 剩下的一般字（941 個），加上專案主說要收的版面、外框、畫材 43 個與審過放行的絞索、自殘、兩件制服、幼稚園，與八個照 loli 處理的未成年字、推車體位（tags-1126c），和專案主指定、親自測過的 39 個（tags-1126d），共 1753 個。

Grok 4.7（high）六批＋七批填，Opus 驗收（.planning/tags-1126/、tags-1126b/）。tag 照專案主的清單原樣收：
Danbooru 已經淘汰（black footwear、french braid、plaid）或改名的照收，模型是用舊資料學的。
同一件事的另一種寫法（china dress＝qipao、doughnut＝donut…）不在這裡，寫在 alt_names.json 並排。

格式跟 sync_20261101_tags.py 一樣。分組、細分類、互斥格都用既有的值。
只在釘了才出現的（各校制服、獵奇、會改寫整張圖的）在 web/engine.js 的 ODD_MOTIF。
不是全年齡的衣物同時放 CLOTHING_STATE_EXTRA 和 NARROW，免得 widen_heat 攤成三檔；環境一定會被攤開，只靠 NARROW。
"""
from __future__ import annotations

# tag|zh|section|group|sub|heat|mutex|needs|implies|gate|era|layer
# heat: all / sex / flash（flash = 走光+性愛）；空的 mutex、needs、implies、era 寫 -
_LINES = """
black footwear|黑色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
white footwear|白色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
brown footwear|棕色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
red footwear|紅色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
blue footwear|藍色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
green footwear|綠色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
pink footwear|粉紅色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
grey footwear|灰色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
yellow footwear|黃色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
cross-laced footwear|交叉綁帶鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
platform footwear|厚底鞋履|clothing|feet|feet|all|feet|-|-|any|modern|garment
toeless footwear|露趾鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
black headwear|黑色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
white headwear|白色頭戴物|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
red headwear|紅色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
blue headwear|藍色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
green headwear|綠色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
brown headwear|棕色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
pink headwear|粉紅色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
purple headwear|紫色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
grey headwear|灰色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
yellow headwear|黃色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
bloomers|泡泡短褲|clothing|bottom|bot_pants|all|bottom|-|-|female|victorian,modern|garment
white bloomers|白色泡泡短褲|clothing|bottom|bot_pants|all|bottom|-|bloomers|female|victorian,modern|garment
lace-trimmed legwear|蕾絲邊襪類|clothing|legs|legs|all|legs|-|lace trim|female|-|garment
argyle legwear|菱格紋襪類|clothing|legs|legs|all|legs|-|argyle clothes|female|-|garment
ribbon-trimmed legwear|緞帶邊襪類|clothing|legs|legs|all|legs|-|ribbon trim|female|-|garment
plaid legwear|格紋襪類|clothing|legs|legs|all|legs|-|plaid clothes|female|modern|garment
white jumpsuit|白連身褲|clothing|onepiece|op_uniform|all|onepiece|-|jumpsuit|any|modern|garment
see-through sarong|透視紗龍裙|clothing|bottom|bot_pants|all|bottom|-|sarong|any|modern|garment
sheep costume|綿羊裝|clothing|onepiece|op_uniform|all|onepiece|-|animal costume|any|modern|garment
vertical-striped coat|直條紋大衣|clothing|outer|outer|all|outer|-|striped coat|any|modern|garment
black blindfold|黑眼罩|clothing|acc|acc_bind|all|eyewear|-|blindfold|any|-|accessory
dangle earrings|垂墜耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
diamond earrings|菱形耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
boutonniere|鈕孔花|clothing|acc|acc_jewel|all|-|-|-|any|modern,victorian|accessory
pom pom|毛球統稱|clothing|acc|acc_head|all|-|-|-|any|-|accessory
soul gem|靈魂寶石|clothing|acc|acc_jewel|all|-|-|-|any|modern|accessory
unmoving pattern|花紋不變形|clothing|fabric|fab_material|all|-|-|-|any|-|garment
untied bikini|解開的比基尼|pose|flash|flash_lift|flash|clothes_action|-|bikini|female|modern|normal
no headwear|沒戴頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
adjusting leotard|整理連身衣|pose|tease|pose_act|all|-|-|adjusting clothes,leotard|female|modern|normal
adjusting scarf|整理圍巾|pose|tease|pose_act|all|-|-|scarf|any|-|normal
alternate hair ornament|替換髮飾|clothing|acc|acc_head|all|headwear|-|-|female|-|accessory
american flag shirt|美國國旗圖案襯衫|clothing|top|top_shirt|all|top|-|print shirt,american flag print|any|modern|garment
aqua footwear|水色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
aqua headwear|水藍色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
aqua shorts|水色短褲|clothing|bottom|bot_pants|all|bottom|-|shorts|any|modern|garment
aqua thighhighs|水色過膝襪|clothing|legs|legs|all|legs|female|thighhighs|female|modern,victorian|garment
backless swimsuit|露背泳裝|clothing|onepiece|op_swim|all|onepiece|-|swimsuit|female|modern|garment
bandages over clothes|衣外繃帶|clothing|acc|acc_bandage|all|-|-|bandages|any|-|accessory
bat ornament|蝙蝠飾品|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
belt skirt|皮帶裙|clothing|bottom|bot_skirt|all|bottom|-|belt,skirt|female|modern|garment
black undershirt|黑內搭衫|clothing|top|top_shirt|all|top|-|undershirt|any|modern,victorian|garment
boater hat|船夫草帽|clothing|acc|acc_head|all|headwear|-|hat|any|victorian,modern|accessory
camouflage headwear|迷彩頭飾|clothing|acc|acc_head|all|headwear|-|camouflage|any|modern|accessory
camouflage shirt|迷彩襯衫|clothing|top|top_shirt|all|top|-|shirt,camouflage|any|modern|garment
cardigan vest|開襟背心|clothing|top|top_knit|all|top|-|vest|any|modern|garment
checkered legwear|棋盤格紋襪類|clothing|legs|legs|all|legs|-|checkered clothes|female|-|garment
clothes|衣服總稱|clothing|fabric|fab_style|all|-|-|-|any|-|garment
clothes on floor|地上的衣服|env|other|obj_hand|all|-|-|-|any|-|normal
costume|戲服總稱|clothing|fabric|fab_style|all|-|-|-|any|-|garment
cow costume|乳牛裝|clothing|onepiece|op_uniform|all|onepiece|-|animal costume|any|modern|garment
denim jacket|丹寧夾克|clothing|outer|outer|all|outer|-|jacket,denim|any|modern|garment
dog hair ornament|狗形髮飾|clothing|acc|acc_head|all|-|-|hair ornament|female|-|accessory
egyptian clothes|埃及服裝|clothing|era|era_folk|all|-|-|-|any|-|garment
folded clothes|疊好的衣服|env|other|obj_hand|all|-|-|-|any|-|normal
front zipper swimsuit|前拉鍊泳裝|clothing|onepiece|op_swim|all|onepiece|-|swimsuit|any|modern|garment
fruit hat ornament|水果帽飾|clothing|acc|acc_head|all|-|-|hat|any|-|accessory
fur jacket|毛皮夾克|clothing|outer|outer|all|outer|-|jacket|any|modern|garment
fur-trimmed bikini|毛邊比基尼|clothing|onepiece|op_swim|all|onepiece|-|bikini|female|modern|garment
fur-trimmed footwear|毛邊鞋履|clothing|feet|feet|all|feet|-|-|any|medieval,victorian,modern|garment
fur-trimmed leotard|毛邊連身衣|clothing|onepiece|op_body|all|onepiece|-|leotard|female|modern|garment
german flag bikini|德國國旗圖案比基尼|clothing|onepiece|op_swim|all|onepiece|-|bikini|female|modern|garment
gold footwear|金色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
gradient ribbon|漸層緞帶|clothing|acc|acc_bow|all|-|-|ribbon|any|-|accessory
green collar|綠項圈|clothing|acc|acc_neck|all|neckwear|-|collar|any|-|accessory
green sweater vest|綠毛衣背心|clothing|top|top_knit|all|top|-|sweater vest|any|modern|garment
grey sweater vest|灰毛衣背心|clothing|top|top_knit|all|top|-|sweater vest|any|modern|garment
hat belt|帽箍|clothing|acc|acc_head|all|-|-|-|any|-|accessory
hat over eyes|帽簷遮雙眼|pose|tease|pose_act|all|-|-|-|any|-|normal
hawaiian shirt|夏威夷襯衫|clothing|top|top_shirt|all|top|-|shirt|any|modern|garment
high-low skirt|前短後長裙|clothing|bottom|bot_skirt|all|bottom|-|skirt|female|modern|garment
holding footwear|拿著鞋履|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding jacket|拿著夾克|pose|tease|pose_hold|all|-|-|unworn jacket|any|modern|normal
holographic clothing|虹彩衣料|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
jacket over shoulder|夾克搭單肩|clothing|fabric|fab_state|all|-|-|unworn jacket|any|modern|garment
lace-trimmed shirt|蕾絲邊襯衫|clothing|top|top_shirt|all|top|-|shirt,lace trim|any|modern,victorian|garment
latex leotard|乳膠連衣褲|clothing|onepiece|op_body|all|onepiece|-|leotard|female|modern|garment
leotard peek|連身衣露一角|clothing|fabric|fab_state|all|-|-|-|female|modern|garment
long ribbon|長緞帶|clothing|acc|acc_bow|all|-|-|ribbon|any|-|accessory
long scarf|長圍巾|clothing|acc|acc_neck|all|neckwear|-|scarf|any|-|accessory
mini witch hat|迷你女巫帽|clothing|acc|acc_head|all|headwear|-|witch hat,mini hat|any|medieval,victorian|accessory
mismatched earrings|左右不對稱耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
mole on collarbone|鎖骨上的痣|feature|skin|skin_mark|all|-|-|mole,collarbone|any|-|normal
multicolored footwear|多色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
multicolored headwear|多色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
multicolored hoodie|多色連帽衫|clothing|top|top_shirt|all|top|-|hoodie|any|modern|garment
multicolored legwear|多色襪類|clothing|legs|legs|all|legs|-|-|female|-|garment
multicolored ribbon|多色緞帶|clothing|acc|acc_bow|all|-|-|ribbon|any|-|accessory
no hair ornament|沒戴髮飾|clothing|acc|acc_head|all|-|-|-|female|-|accessory
orange apron|橘色圍裙|clothing|onepiece|op_uniform|all|onepiece|-|apron|female|-|garment
orange coat|橘大衣|clothing|outer|outer|all|outer|-|coat|any|modern|garment
orange footwear|橘色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
orange headwear|橘色頭飾|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
ornament|飾品總稱|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
patterned clothing|花紋衣物|clothing|fabric|fab_material|all|-|-|-|any|-|garment
penguin costume|企鵝裝|clothing|onepiece|op_uniform|all|onepiece|-|animal costume|any|modern|garment
plaid headwear|格紋頭飾|clothing|acc|acc_head|all|headwear|-|plaid clothes|any|modern|accessory
plaid shorts|格紋短褲|clothing|bottom|bot_pants|all|bottom|-|shorts,plaid clothes|any|modern|garment
pointy footwear|尖頭鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
pointy hat|尖頂帽|clothing|acc|acc_head|all|headwear|-|hat|any|-|accessory
print footwear|印花鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
print ribbon|印花緞帶|clothing|acc|acc_bow|all|-|-|ribbon|any|-|accessory
print scarf|印花圍巾|clothing|acc|acc_neck|all|neckwear|-|scarf|any|-|accessory
print sweater|印花毛衣|clothing|top|top_knit|all|top|-|sweater|any|modern|garment
print swimsuit|印花泳裝|clothing|onepiece|op_swim|all|onepiece|-|swimsuit|any|modern|garment
pumpkin hat|南瓜帽|clothing|acc|acc_head|all|headwear|-|hat|any|modern|accessory
purple apron|紫色圍裙|clothing|onepiece|op_uniform|all|onepiece|-|apron|female|-|garment
purple footwear|紫色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
removing jacket|脫下夾克|pose|tease|pose_act|all|-|-|jacket|any|modern|normal
ribbed legwear|羅紋襪類|clothing|legs|legs|all|legs|-|-|any|-|garment
ribbon braid|緞帶辮|feature|hair_style|hair_shape|all|hair_style|-|braid|any|-|normal
rice hat|斗笠|clothing|acc|acc_head|all|headwear|-|hat|any|-|accessory
right-over-left kimono|右衽和服|clothing|era|era_jp|all|onepiece|-|kimono|any|edo|garment
santa boots|聖誕靴|clothing|feet|feet|all|feet|-|boots|any|modern|garment
santa gloves|聖誕手套|clothing|acc|acc_hand|all|hands|-|gloves|any|modern|accessory
school hat|學生帽|clothing|acc|acc_head|all|headwear|-|hat|any|modern|accessory
shiny swimsuit|亮面泳裝|clothing|onepiece|op_swim|all|onepiece|-|swimsuit|any|modern|garment
shirt around waist|襯衫綁在腰間|clothing|fabric|fab_detail|all|-|-|clothes around waist|any|modern|garment
side-tie shirt|側綁襯衫|clothing|top|top_shirt|all|top|-|shirt|any|modern|garment
side-tie skirt|側綁裙子|clothing|bottom|bot_skirt|all|bottom|-|skirt|female|modern|garment
side-tie swimsuit|側綁泳裝|clothing|onepiece|op_swim|all|onepiece|-|swimsuit|female|modern|garment
silver dress|銀洋裝|clothing|onepiece|op_dress|all|onepiece|-|dress|female|modern,victorian|garment
single-shoulder dress|單肩洋裝|clothing|onepiece|op_dress|all|onepiece|-|dress|female|modern,victorian|garment
single-shoulder shirt|單肩襯衫|clothing|top|top_shirt|all|top|-|shirt|any|modern|garment
sleeveless turtleneck leotard|無袖高領連身衣|clothing|onepiece|op_body|all|onepiece|-|leotard|female|modern|garment
snake earrings|蛇形耳環|clothing|acc|acc_jewel|all|jewelry|-|earrings|any|-|accessory
sparkle hair ornament|閃光髮飾|clothing|acc|acc_head|all|-|-|hair ornament|female|-|accessory
striped coat|條紋大衣|clothing|outer|outer|all|outer|-|coat|any|modern|garment
taut leotard|繃緊的連身衣|clothing|onepiece|op_body|all|onepiece|-|leotard|female|modern|garment
taut swimsuit|繃緊的泳裝|clothing|onepiece|op_swim|all|onepiece|-|swimsuit|any|modern|garment
tiger costume|老虎裝|clothing|onepiece|op_uniform|all|onepiece|-|animal costume,tiger print|any|modern|garment
torn bike shorts|破損的自行車短褲|clothing|bottom|bot_pants|all|bottom|-|bike shorts|any|modern|garment
torn bikini|破比基尼|clothing|onepiece|op_swim|all|onepiece|-|bikini|female|modern|garment
torn coat|破損的大衣|clothing|outer|outer|all|outer|-|coat|any|modern|garment
torn hat|破損的帽子|clothing|acc|acc_head|all|headwear|-|hat|any|-|accessory
turtleneck jacket|高領夾克|clothing|outer|outer|all|outer|-|jacket|any|modern|garment
unworn legwear|未穿戴的襪類|clothing|fabric|fab_state|all|-|-|-|any|-|garment
unworn scarf|未穿戴的圍巾|clothing|acc|acc_neck|all|-|-|-|any|-|accessory
unworn shorts|未穿戴的短褲|clothing|fabric|fab_state|all|-|-|-|any|modern|garment
unworn thighhighs|未穿戴的過膝襪|clothing|fabric|fab_state|all|-|-|-|any|modern,victorian|garment
upshirt|撩起的上衣|pose|flash|flash_lift|flash|clothes_action|-|-|any|modern|normal
upshorts|拉高的短褲|pose|flash|flash_lift|flash|clothes_action|-|-|any|modern|normal
very long sleeves|非常長的袖子|clothing|fabric|fab_sleeve|all|-|-|long sleeves|any|-|garment
wet skirt|濕裙子|clothing|bottom|bot_skirt|all|bottom|-|skirt|female|modern|garment
whale hair ornament|鯨魚髮飾|clothing|acc|acc_head|all|-|-|hair ornament|female|-|accessory
wolf costume|狼裝|clothing|onepiece|op_uniform|all|onepiece|-|animal costume|any|modern|garment
zipper dress|拉鍊洋裝|clothing|onepiece|op_dress|all|onepiece|-|dress|female|modern|garment
night sky|夜空|env|sky|sky|all|-|-|-|any|-|normal
on grass|在草地上|env|furniture|furniture|all|furniture|-|-|any|-|normal
starry background|星星背景|env|background|background|all|background|-|-|any|-|normal
multicolored background|多色背景|env|background|background|all|background|-|-|any|-|normal
flag background|旗幟背景|env|background|background|all|background|-|-|any|-|normal
text background|文字背景|env|background|background|all|background|-|-|any|-|normal
5boys|5個男性|subject|count_m|count_m|all|male_count|-|-|male|-|normal
2others|兩個其他角色|subject|extra|cast_mix|all|-|-|-|any|-|normal
multiple others|多名其他角色|subject|extra|cast_mix|all|-|-|2others|any|-|normal
nintendo switch|任天堂Switch|env|other|obj_tech|all|-|-|-|any|modern|normal
disembodied limb|浮空肢體|pose|tease|pose_situ|all|-|-|-|any|-|normal
interracial|異族配對|feature|other|relation|all|-|pair|-|any|-|normal
traditional media|傳統媒材|quality|style|style_tech|all|-|-|-|any|-|normal
graphite (medium)|石墨素描|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
colored pencil (medium)|色鉛筆畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
nihonga|日本畫|quality|style|style_tech|all|medium|-|-|any|-|normal
concept art|概念設定圖|quality|style|style_tech|all|-|-|-|any|-|normal
fishnet armwear|網狀臂套|clothing|fabric|fab_sleeve|all|-|-|fishnets|any|modern|garment
fishnet bra|網狀胸罩|clothing|underwear|uw_top|flash|underwear_top|-|bra|female|modern|underwear
fishnet leotard|網狀連身衣|clothing|onepiece|op_body|flash|onepiece|-|leotard,fishnets|female|modern|garment
fishnet panties|網狀內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|-|panties|female|modern|garment
fishnet cutout|網紗挖空|clothing|fabric|fab_detail|flash|-|-|fishnets|any|modern|garment
fishnet fabric|網紗布料|clothing|fabric|fab_material|all|-|-|fishnets|any|modern|garment
bullet nipple rings|子彈頭乳環|clothing|acc|acc_toy|sex|-|female|nipple rings|female|-|accessory
homurahara academy school uniform|穗群原學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
champion uniform|寶可夢冠軍服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
galaxy expedition team survey corps uniform|銀河隊調查服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
st. chronica academy school uniform|聖克羅尼卡學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
pravda military uniform|真理學園軍服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
chi-hatan military uniform|知波單軍服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
tsab ground military uniform|時空局地面軍服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
kousaka kirino's school uniform|桐乃的校服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
saunders school uniform|薩德斯學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
sainan high school uniform|彩南高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
shimokitazawa high school uniform|下北澤高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
motosu school uniform|本栖高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
keizoku school uniform|繼續高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
amestris military uniform|亞美斯多利斯軍服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
bc freedom school uniform|BC自由學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
starlight academy school uniform|星光學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
azumanga daioh's school uniform|笑園漫畫校服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
stile uniform|調教咖啡廳制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
itan private high school uniform|伊旦高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
kin-iro mosaic high school uniform|黃金拼圖高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
hope's peak academy school uniform|希望峰學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
selection university military uniform|大學選拔軍服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
white uniform|白色制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
fast food uniform|速食店制服|clothing|onepiece|op_uniform|all|onepiece|-|employee uniform|any|modern|garment
megurigaoka high school uniform|巡之丘高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
kafuu chino's school uniform|智乃的校服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
kobeya uniform|神戶屋店員服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
akatsuki uniform|曉組織制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
kibina high school uniform|輝日南高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
yuyushiki's school uniform|悠悠式校服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
tsab air military uniform|時空局航空軍服|clothing|onepiece|op_uniform|all|onepiece|-|military uniform|any|modern|garment
delmogeny uniform|德爾莫制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
orange planet uniform|橙星領航服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
national shin ooshima school uniform|國立新大島制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
kazamatsuri institute high school uniform|風祭學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
hakuo school uniform|白皇學院制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
achiga school uniform|阿知賀學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
himeya company uniform|姬屋領航服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
nudist beach uniform|裸體海灘制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
st. theresa's girls academy school uniform|聖特蕾莎女學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
lillian girls' academy school uniform|莉莉安女學園制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
kanba girls high school uniform|神庭藝術女高制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
yokosuka girls marine high school uniform|橫須賀海洋高中制服|clothing|onepiece|op_uniform|all|onepiece|-|school uniform|any|modern|garment
black sky|黑色天空|env|sky|sky|all|-|-|sky|any|-|normal
bubble background|泡泡背景|env|background|background|all|background|-|-|any|-|normal
dotted background|細點背景|env|background|background|all|background|-|-|any|-|normal
green sky|綠色天空|env|sky|sky|all|-|-|sky|any|-|normal
in water|人在水裡|pose|tease|act_water|all|-|-|-|any|-|normal
lace background|蕾絲背景|env|background|background|all|background|-|-|any|-|normal
leaf background|葉子背景|env|background|background|all|background|-|leaf|any|-|normal
light blue background|淺藍背景|env|background|background|all|background|-|simple background|any|-|normal
light brown background|淺棕背景|env|background|background|all|background|-|simple background|any|-|normal
on scooter|騎速克達|pose|activity|act_sport|all|activity|-|scooter|any|modern|normal
on vehicle|人在載具上|pose|tease|pose_stance|all|-|-|-|any|modern|normal
paw print background|爪印背景|env|background|background|all|background|-|-|any|-|normal
pink sky|粉色天空|env|sky|sky|all|-|-|sky|any|-|normal
rainbow background|彩虹背景|env|background|background|all|background|-|-|any|-|normal
sepia background|深褐背景|env|background|background|all|background|-|-|any|-|normal
snowflake background|雪花背景|env|background|background|all|background|-|-|any|-|normal
yellow sky|黃色天空|env|sky|sky|all|-|-|sky|any|-|normal
bikini pull|拉扯比基尼|pose|flash|flash_lift|flash|-|female|bikini|female|modern|normal
grabbing|抓握|pose|tease|pose_act|all|-|-|-|any|-|normal
leg grab|抓腿|pose|tease|pose_hold|all|-|-|-|any|-|normal
thigh grab|抓大腿|pose|flash|flash_pose|flash|-|-|-|any|-|normal
skirt hold|捏著裙襬|pose|tease|pose_act|all|-|female|-|female|-|normal
holding clothes|拿著衣服|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding hair|抓著頭髮|pose|tease|pose_act|all|-|-|-|any|-|normal
holding hat|拿著帽子|pose|tease|pose_hold|all|-|-|hat|any|-|normal
hands in hair|雙手埋進頭髮|pose|tease|pose_hand|all|-|-|-|any|-|normal
presenting removed panties|展示脫下的內褲|pose|flash|flash_pose|flash|-|female|holding panties|female|modern|normal
belly on glass|肚子貼著玻璃|pose|tease|pose_stance|all|-|-|against glass|any|-|normal
fff threesome|三女三人行|pose|sex|sex_group|sex|-|pair,female,group,2female,yuri|threesome,yuri|female|-|normal
deep skin|指頭陷進肉|feature|other|body_part|all|-|-|-|any|-|normal
three quarter view|四分之三側面|pose|camera|cam_angle|all|camera|-|-|any|-|normal
out-of-frame censoring|出框遮重點|pose|camera|cam_frame|all|camera|-|out of frame|any|-|normal
cropped arms|裁掉手臂|pose|camera|cam_frame|all|camera|-|-|any|-|normal
equine penis|馬科陰莖|feature|sex|bm_penis|sex|-|-|horse penis|any|-|normal
dark penis|深色陰莖|feature|body_m|bm_penis|sex|-|male|penis|male|-|skin
invisible penis|沒畫出的陰莖|feature|sex|bm_penis|sex|-|male|penis|male|-|normal
knotted penis|有結陰莖|feature|sex|bm_penis|sex|-|-|animal penis|any|-|normal
penis tentacle|陰莖狀觸手|feature|sex|bm_penis|sex|-|female|tentacles|any|-|normal
no testicles|沒有睪丸|feature|sex|bm_penis|sex|-|male|-|male|-|normal
erect clitoris|勃起的陰蒂|feature|body_f|bf_intimate|sex|-|female|clitoris|female|-|skin
covered clitoris|陰蒂被遮住|feature|body_f|bf_intimate|flash|-|female|clitoris|female|-|skin
mole on pussy|陰部上的痣|feature|body_f|skin_mark|sex|-|female|mole|female|-|normal
long labia|長小陰唇|feature|body_f|bf_intimate|sex|-|female|pussy|female|-|skin
dark labia|深色小陰唇|feature|body_f|bf_intimate|sex|-|female|pussy|female|-|skin
artificial vagina|飛機杯|clothing|acc|acc_toy|sex|-|male|sex toy|male|modern|accessory
red pubic hair|紅色陰毛|feature|sex|bf_intimate|sex|-|-|colored pubic hair|any|-|normal
brown pubic hair|棕色陰毛|feature|sex|bf_intimate|sex|-|-|colored pubic hair|any|-|normal
purple pubic hair|紫色陰毛|feature|sex|bf_intimate|sex|-|-|colored pubic hair|any|-|normal
dark areolae|深色乳暈|feature|body_f|bf_intimate|flash|-|female|-|female|-|normal
small nipples|小乳頭|feature|body_f|bf_intimate|flash|-|female|nipples|female|-|skin
penis grab|抓對方陰莖|pose|sex|sex_touch|sex|-|pair,male|penis|any|-|normal
kissing penis|親吻陰莖|pose|sex|sex_oral|sex|sex_act|male,pair|penis|any|-|normal
smelling penis|聞陰莖|pose|sex|sex_oral|sex|sex_act|male,pair|smelling,penis|any|-|normal
licking testicle|舔睪丸|pose|sex|sex_oral|sex|sex_act|male,pair|testicles,oral,licking|any|-|normal
penises touching|兩根陰莖相抵|pose|sex|sex_pos|sex|-|pair|penis|any|-|normal
penis on pussy|陰莖抵著陰部|pose|sex|sex_pos|sex|-|pair,male,female|penis,pussy|any|-|normal
penis on head|陰莖放在頭上|pose|sex|sex_oral|sex|-|male,female|penis|any|-|normal
penis over one eye|陰莖擋單眼|pose|sex|sex_oral|sex|-|male,female|penis on face|any|-|normal
penis under another's clothes|陰莖伸進別人衣服|pose|sex|sex_pos|sex|-|pair,male|penis|any|-|normal
penis shadow|陰莖的影子|pose|sex|sex_fetish|sex|-|male|penis|male|-|normal
clothed masturbation|穿著衣服自慰|pose|sex|sex_touch|flash|-|-|-|any|-|normal
fingering through clothes|隔衣手指插入|pose|sex|sex_touch|sex|-|female|fingering,through clothes|female|-|normal
fingering through panties|隔內褲手指插入|pose|sex|sex_touch|sex|-|female|fingering through clothes,panties|female|modern|normal
after masturbation|自慰之後|pose|sex|sex_after|sex|-|-|masturbation|any|-|normal
handjob gesture|手交的手勢|pose|sex|pose_sign|sex|-|-|-|any|-|normal
cooperative paizuri|合力乳交|pose|sex|sex_oral|sex|sex_act|male,female,pair,group,2female|paizuri,teamwork (sexual)|female|-|normal
handsfree paizuri|不用手的乳交|pose|sex|sex_oral|sex|sex_act|male,female,pair|paizuri|female|-|normal
paizuri invitation|邀請乳交|pose|sex|pose_sign|sex|-|female|-|female|-|normal
ejaculation under clothes|衣服裡面射精|pose|sex|sex_cum|sex|-|male|ejaculation|male|-|normal
cum in clothes|精液留在衣服裡|pose|sex|sex_cum|sex|-|male|cum|any|-|normal
cum on floor|精液在地板上|pose|sex|sex_cum|sex|-|male|cum|any|-|normal
mutual orgasm|同時高潮|pose|sex|sex_after|sex|-|pair|orgasm|any|-|normal
implied cunnilingus|暗示舔陰|pose|sex|sex_oral|sex|-|female,pair|-|female|-|normal
presenting pussy|展示陰部|pose|sex|sex_touch|sex|-|female|pussy|female|-|normal
covered penetration|被遮住的插入|pose|sex|sex_pos|sex|-|pair|-|any|-|normal
covered anus|肛門被遮住|feature|body_f|bf_intimate|flash|-|-|anus|any|-|skin
mmm threesome|三男三人行|pose|sex|sex_group|sex|-|pair,male,group,2male,yaoi|threesome,yaoi|male|-|normal
futanari pov|扶他第一人稱|pose|camera|cam_angle|sex|camera|female|futanari,pov|female|-|normal
double dildo|雙頭假陽具|clothing|acc|acc_toy|all|-|-|dildo|any|modern|accessory
vibrator in thigh strap|大腿綁帶裡的跳蛋|clothing|acc|acc_toy|sex|-|female|vibrator,thigh strap|female|modern|accessory
pointless condom|沒用上的保險套|clothing|acc|acc_toy|sex|-|-|condom|any|modern|accessory
cock ring|陰莖環|clothing|acc|acc_toy|sex|-|male|sex toy|male|modern|accessory
dry humping|乾式磨蹭|pose|sex|sex_oral|sex|-|pair|humping|any|-|normal
table humping|往桌子磨蹭|pose|sex|sex_touch|sex|sex_act|-|-|any|-|normal
hands on ass|手放在屁股上|pose|flash|flash_pose|flash|-|-|-|any|-|normal
naked kimono|只披和服|clothing|onepiece|op_only|flash|onepiece|-|kimono,japanese clothes|any|edo|garment
naked hoodie|只穿連帽衫|clothing|onepiece|op_only|flash|onepiece|-|hoodie|any|modern|garment
naked overalls|只穿吊帶褲|clothing|onepiece|op_only|flash|onepiece|-|overalls|any|modern|garment
naked scarf|只圍圍巾|clothing|onepiece|op_only|flash|onepiece|-|scarf|any|-|garment
naked cloak|只披長斗篷|clothing|onepiece|op_only|flash|onepiece|-|cloak|any|medieval,victorian|garment
naked capelet|只披短披肩|clothing|onepiece|op_only|flash|onepiece|-|capelet|any|medieval,victorian|garment
nearly naked apron|幾乎裸身圍裙|clothing|onepiece|op_only|flash|onepiece|-|apron|female|-|garment
crotchless pantyhose|開襠褲襪|clothing|legs|legs|flash|legs|female|pantyhose,crotchless|female|modern|garment
underbutt|臀下緣露出|pose|flash|flash_expose|flash|-|-|-|any|-|normal
panty lift|提起內褲|pose|flash|flash_lift|flash|-|female|panties|female|modern|normal
see-through panties|透視內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|female|panties,see-through clothes|female|modern|garment
see-through swimsuit|透視泳裝|clothing|onepiece|op_swim|flash|onepiece|-|swimsuit,see-through clothes|any|modern|garment
nipple cutout|乳頭處開洞|clothing|fabric|fab_detail|flash|-|female|-|female|-|garment
tape on nipples|乳頭上的膠帶|clothing|acc|acc_toy|flash|-|female|pasties,tape|female|modern|accessory
nippleless clothes|不遮乳頭的衣服|clothing|fabric|fab_state|flash|-|female|-|female|-|garment
implied pantyshot|暗示內褲走光|pose|flash|flash_expose|flash|-|female|-|female|modern|normal
panties under shorts|短褲裡的內褲|clothing|underwear|uw_bottom|flash|-|female|panties,shorts|female|modern|garment
panties over pantyhose|褲襪外的內褲|clothing|underwear|uw_bottom|flash|-|female|panties,pantyhose|female|modern|garment
panties over garter belt|吊襪帶外的內褲|clothing|underwear|uw_bottom|flash|-|female|panties,garter belt|female|modern|garment
backless panties|後空內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|female|panties|female|modern|garment
boyshort panties|平口女內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|female|panties|female|modern|garment
bear panties|熊圖樣內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|female|print panties,panties|female|modern|garment
heart panties|愛心圖樣內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|female|print panties,panties|female|modern|garment
front-print panties|正面印花內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|female|print panties,panties|female|modern|garment
pantyhose under swimsuit|泳裝裡的褲襪|clothing|legs|legs|all|legs|female|pantyhose,swimsuit|female|modern|garment
arm around back|手臂環住後背|pose|tease|pose_two|all|-|pair|-|any|-|normal
arm around waist|手臂環住腰|pose|tease|pose_two|all|-|pair|-|any|-|normal
arm between legs|手臂夾在腿間|pose|flash|flash_pose|flash|-|-|-|any|-|normal
arm on own head|手臂放自己頭上|pose|tease|pose_hand|all|-|-|-|any|-|normal
arm on shoulder|手臂搭別人肩|pose|tease|pose_two|all|-|pair|-|any|-|normal
hand on forehead|手貼額頭|pose|tease|pose_hand|all|-|-|-|any|-|normal
hand on leg|手放在腿上|pose|tease|pose_hand|all|-|-|-|any|-|normal
hand on own ear|手摸自己耳朵|pose|tease|pose_hand|all|-|-|-|any|-|normal
hand on own forehead|手貼自己額頭|pose|tease|pose_hand|all|-|-|-|any|-|normal
hand on own shoulder|手搭自己的肩|pose|tease|pose_hand|all|-|-|-|any|-|normal
hands on own legs|雙手放自己腿上|pose|tease|pose_hand|all|-|-|-|any|-|normal
hands on shoulders|雙手搭在肩上|pose|tease|pose_hand|all|-|-|-|any|-|normal
holding candle|拿著蠟燭|pose|tease|pose_hold|all|-|-|candle|any|-|normal
holding dog|抱著狗|pose|tease|pose_hold|all|-|-|dog|any|-|normal
holding head|捧著頭|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding heart|拿著愛心|pose|tease|pose_hold|all|-|-|heart|any|-|normal
holding helmet|拿著頭盔|pose|tease|pose_hold|all|-|-|helmet|any|-|normal
holding leg|抓著一條腿|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding legs|抱著雙腿|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding necklace|拿著項鍊|pose|tease|pose_hold|all|-|-|necklace|any|-|normal
holding own foot|抓著自己的腳|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding pole|握著桿子|pose|tease|pose_hold|all|-|-|pole|any|-|normal
holding shoes|拿著鞋子|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding with tail|用尾巴拿東西|pose|tease|pose_act|all|-|-|prehensile tail|any|-|normal
sitting on bench|坐在長椅上|env|furniture|furniture|all|furniture|-|sitting,on bench|any|-|normal
sitting on shoulder|坐在別人肩上|pose|tease|pose_two|all|-|pair|sitting|any|-|normal
sitting on table|坐在桌子上|env|furniture|furniture|all|furniture|-|sitting,table|any|-|normal
sitting on water|坐在水面上|pose|tease|act_water|all|-|-|sitting|any|-|normal
light brown hair|淺棕髮|feature|hair_color|hair_color|all|hair_color|-|-|any|-|normal
light blue hair|淺藍髮|feature|hair_color|hair_color|all|hair_color|-|-|any|-|normal
dark blue hair|深藍髮|feature|hair_color|hair_color|all|hair_color|-|-|any|-|normal
rainbow hair|彩虹髮|feature|hair_color|hair_color|all|-|-|multicolored hair|any|-|normal
striped hair|條紋髮|feature|hair_color|hair_color|all|-|-|-|any|-|normal
french braid|法式辮|feature|hair_style|hair_shape|all|hair_style|-|braid|any|-|normal
long braid|長辮|feature|hair_style|hair_shape|all|hair_style|-|braid|any|-|normal
medium bangs|中長瀏海|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
excited|興奮|pose|face|face_mood|all|expression|-|-|any|-|normal
squinting|瞇起眼|pose|face|face_eyes|all|-|-|-|any|-|normal
panicking|驚慌|pose|face|face_mood|all|expression|-|-|any|-|normal
glasgow smile|裂嘴疤|feature|skin|skin_mark|all|-|-|-|any|-|normal
lonely|寂寞|pose|face|face_mood|all|expression|-|-|any|-|normal
sad smile|苦笑|pose|face|face_mood|all|expression|-|-|any|-|normal
in heat|發情|pose|face|face_lewd|flash|-|-|-|any|-|normal
green pupils|綠色瞳孔|feature|eyes|eye_shape|all|-|-|-|any|-|normal
orange sclera|橙色眼白|feature|eyes|eye_shape|all|-|-|colored sclera|any|-|normal
no sclera|無眼白|feature|eyes|eye_shape|all|-|-|-|any|-|normal
flaming eyes|雙火焰眼|feature|eyes|eye_shape|all|-|-|-|any|-|normal
crotch|胯下|feature|body_f|bf_intimate|flash|-|-|-|any|-|skin
transparent body|透明身體|feature|skin|skin_tone|all|-|-|-|any|-|normal
plaid|格紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
argyle|菱格紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
serval print|藪貓紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
multicolored stripes|多色條紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
colored stripes|彩色條紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
wolf tail|狼尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
dragon tail|龍尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
fish tail|魚尾|feature|other|nonhuman|all|-|-|fins,tail|any|-|normal
cow horns|牛角|feature|other|nonhuman|all|-|-|horns|any|-|normal
goat horns|山羊角|feature|other|nonhuman|all|-|-|horns|any|-|normal
sheep horns|綿羊角|feature|other|nonhuman|all|-|-|horns|any|-|normal
furry|獸化人|feature|race|race_kemono|all|-|-|-|any|-|normal
raccoon girl|浣熊少女|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
mouse girl|鼠娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
mouse|小鼠|env|other|obj_plant|all|-|-|-|any|-|normal
arthropod girl|節肢動物娘|feature|race|race_fantasy|all|race|female|-|female|-|normal
creature|非人生物|feature|race|race_fantasy|all|-|-|-|any|-|normal
doll joints|人偶關節|feature|other|nonhuman|all|-|-|joints|any|-|normal
butterfly wings|蝴蝶翅膀|feature|other|nonhuman|all|-|-|insect wings|any|-|normal
winged arms|翅膀手臂|feature|other|nonhuman|all|-|-|wings|any|-|normal
ambiguous gender|性別不明|feature|other|persona|all|-|-|-|any|-|normal
dark persona|黑暗人格|feature|other|persona|all|-|-|-|any|-|normal
pilot suit|飛行服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
ahoge wag|呆毛晃動|feature|hair_style|hair_detail|all|-|-|ahoge,expressive hair|any|-|normal
armpit hair peek|露出腋毛|feature|body_f|body_part|flash|-|-|-|any|-|normal
artificial eye|義眼|feature|eyes|eye_shape|all|-|-|-|any|-|normal
beach chair|沙灘椅|env|other|obj_furn|all|-|-|chair|any|modern|normal
blood from eyes|眼角流血|feature|skin|skin_mark|all|-|-|-|any|-|normal
brushing own hair|自己梳髮|pose|tease|pose_hand|all|-|-|brushing hair|any|-|normal
bulging eyes|凸眼|feature|eyes|eye_shape|all|-|-|-|any|-|normal
crystal hair|水晶髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
detached ahoge|分離呆毛|feature|hair_style|hair_detail|all|-|-|ahoge|any|-|normal
detached hair|自然分離髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
drying hair|擦乾頭髮|pose|activity|act_daily|all|activity|-|drying|any|-|normal
extra pupils|額外瞳孔|feature|eyes|eye_shape|all|-|-|-|any|-|normal
eye black|眼下黑油|feature|eyes|makeup|all|-|-|-|any|modern|normal
eyes in shadow|眼在陰影|feature|eyes|eye_shape|all|-|-|-|any|-|normal
feet on chair|腳放椅上|pose|tease|pose_stance|all|-|-|chair|any|-|normal
folded hair|摺疊頭髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
hair over face|頭髮遮臉|feature|eyes|hair_detail|all|-|-|-|any|-|normal
hair wings|頭髮翅膀|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
heart hair|心形頭髮|feature|hair_style|hair_shape|all|hair_style|-|-|any|-|normal
liquid hair|液態頭髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
living hair|活體頭髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
long eyebrows|長眉毛|feature|eyes|eye_shape|all|-|-|-|any|-|normal
mismatched eyelashes|不對稱睫毛|feature|eyes|eye_shape|all|-|-|colored eyelashes|any|-|normal
mole above eye|眼上痣|feature|eyes|skin_mark|all|-|-|mole|any|-|normal
severed hair|剪落的髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
solid eyes|實心眼睛|feature|eyes|eye_shape|all|-|-|-|any|-|normal
starry hair|星空頭髮|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
unworn hairband|未戴髮箍|clothing|acc|acc_head|all|-|-|-|any|-|accessory
wide oval eyes|寬橢圓眼|feature|eyes|eye_shape|all|-|-|-|any|-|normal
alternate wings|替換翅膀|feature|other|nonhuman|all|-|-|wings|any|-|normal
bat girl|蝙蝠娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
bear girl|熊娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
bee girl|蜜蜂娘|feature|race|race_fantasy|all|race|female|arthropod girl|female|-|normal
bird boy|鳥男|feature|race|race_kemono|all|race|male|-|male|-|normal
bird girl|鳥娘|feature|race|race_kemono|all|race|female|-|female|-|normal
cow boy|乳牛男|feature|race|race_kemono|all|race|male|-|male|-|normal
deer girl|鹿娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
dinosaur tail|恐龍尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
drawn ears|畫上的耳朵|feature|other|nonhuman|all|-|-|-|any|-|normal
fiery tail|火焰尾巴|feature|other|nonhuman|all|-|-|fire,tail|any|-|normal
fiery wings|火焰翅膀|feature|other|nonhuman|all|-|-|wings|any|-|normal
forked tail|分岔尾巴|feature|other|nonhuman|all|-|-|tail|any|-|normal
frog girl|蛙娘|feature|race|race_fantasy|all|race|female|-|female|-|normal
glowing horns|發光角|feature|other|nonhuman|all|-|-|horns|any|-|normal
glowing wings|發光翅膀|feature|other|nonhuman|all|-|-|wings,glowing|any|-|normal
goat boy|山羊男|feature|race|race_kemono|all|race|male|-|male|-|normal
goat girl|山羊娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
hedgehog ears|刺蝟耳|feature|other|nonhuman|all|animal_ear|-|animal ears|any|-|normal
hedgehog tail|刺蝟尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
hugging own tail|抱自己的尾巴|pose|tease|pose_act|all|-|-|hugging tail|any|-|normal
implied extra ears|暗示多耳|feature|other|nonhuman|all|-|-|extra ears|any|-|normal
large wings|過大翅膀|feature|other|nonhuman|all|-|-|wings|any|-|normal
leopard boy|豹男|feature|race|race_kemono|all|race|male|-|male|-|normal
leopard ears|豹耳|feature|other|nonhuman|all|animal_ear|-|animal ears|any|-|normal
leopard girl|豹娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
leopard tail|豹尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
lifted by tail|被拎尾巴|pose|tease|pose_two|all|-|pair|tail|any|-|normal
lizard tail|蜥蜴尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
long tail|長尾巴|feature|other|nonhuman|all|-|-|tail|any|-|normal
monkey boy|猴男|feature|race|race_kemono|all|race|male|-|male|-|normal
monkey girl|猴娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
moose ears|駝鹿耳|feature|other|nonhuman|all|animal_ear|-|animal ears|any|-|normal
moth girl|蛾娘|feature|race|race_fantasy|all|race|female|arthropod girl|female|-|normal
multicolored tail|多色尾巴|feature|other|nonhuman|all|-|-|tail|any|-|normal
no tail|沒有尾巴|feature|other|nonhuman|all|-|-|-|any|-|normal
no wings|沒有翅膀|feature|other|nonhuman|all|-|-|-|any|-|normal
orange horns|橙色角|feature|other|nonhuman|all|-|-|horns|any|-|normal
otter tail|水獺尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
owl girl|貓頭鷹娘|feature|race|race_kemono|all|race|female|-|female|-|normal
penguin tail|企鵝尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
sheep girl|綿羊娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
sheep tail|綿羊尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
spider girl|蜘蛛娘|feature|race|race_fantasy|all|race|female|arthropod girl|female|-|normal
squirrel girl|松鼠娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
torn wings|撕裂翅膀|feature|other|nonhuman|all|-|-|wings|any|-|normal
weasel girl|鼬娘|feature|race|race_kemono|all|race|female|animal ears|female|-|normal
weasel tail|鼬尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
wing ears|翼狀耳|feature|other|nonhuman|all|-|-|animal ears|any|-|normal
above clouds|雲層之上|env|sky|sky|all|-|-|cloud|any|-|normal
against fourth wall|靠著畫面框|pose|tease|pose_stance|all|-|-|-|any|-|normal
alternate muscle size|肌肉量不同|feature|other|body_part|all|-|-|-|any|-|normal
animal around neck|動物纏在頸上|pose|tease|pose_act|all|-|-|-|any|-|normal
animal on hand|動物停在手上|pose|tease|pose_act|all|-|-|-|any|-|normal
ankle bow|腳踝蝴蝶結|clothing|acc|acc_bow|all|-|-|bow|any|-|accessory
ankle garter|腳踝吊帶|clothing|legs|legs|all|-|-|-|female|modern,victorian|garment
ankleband|腳踝環帶|clothing|acc|acc_hand|all|-|-|-|any|modern|accessory
aqua halo|水色光環|clothing|acc|acc_head|all|-|-|halo|any|-|accessory
arms around waist|摟住對方的腰|pose|tease|pose_two|all|-|pair|-|any|-|normal
bad food|難吃的食物|env|other|obj_food|all|-|-|-|any|-|normal
bandaged chest|胸口纏繃帶|clothing|acc|acc_bandage|all|-|-|bandages|any|-|accessory
bandaged fingers|手指包繃帶|clothing|acc|acc_bandage|all|-|-|bandages|any|-|accessory
bandaged foot|腳掌纏繃帶|clothing|acc|acc_bandage|all|-|-|bandages|any|-|accessory
bandaid on head|頭上貼OK繃|clothing|acc|acc_bandage|all|-|-|bandaid|any|-|accessory
bandaid on neck|脖子貼OK繃|clothing|acc|acc_bandage|all|-|-|bandaid|any|-|accessory
barcode|條碼|env|other|obj_hand|all|-|-|-|any|modern|normal
baseball|棒球舊標|env|other|obj_sport|all|-|-|-|any|modern|normal
basketball|籃球舊標|env|other|obj_sport|all|-|-|-|any|modern|normal
beach volleyball|沙灘排球|pose|activity|act_sport|all|activity|-|beach|any|modern|normal
beaker|燒杯|env|other|obj_food|all|-|-|-|any|modern|normal
bear hood|熊兜帽|clothing|acc|acc_head|all|headwear|-|animal hood|any|-|accessory
bed frame|床架|env|other|obj_furn|all|-|-|bed|any|-|normal
bird on arm|鳥停在手臂|pose|tease|pose_act|all|-|-|bird|any|-|normal
black bracelet|黑手鍊|clothing|acc|acc_jewel|all|jewelry|-|bracelet|any|-|accessory
black jumpsuit|黑連身褲|clothing|onepiece|op_uniform|all|onepiece|-|jumpsuit|any|modern|garment
black wristband|黑腕帶|clothing|acc|acc_hand|all|-|-|wristband|any|modern|accessory
blood in mouth|嘴裡含血|feature|skin|skin_mark|all|-|-|blood|any|-|normal
blood on bandages|繃帶上有血|clothing|fabric|fab_state|all|-|-|bandages,blood|any|-|garment
blue brooch|藍胸針|clothing|acc|acc_jewel|all|jewelry|-|brooch|any|-|accessory
blue jumpsuit|藍連身褲|clothing|onepiece|op_uniform|all|onepiece|-|jumpsuit|any|modern|garment
blue wristband|藍腕帶|clothing|acc|acc_hand|all|-|-|wristband|any|modern|accessory
box tie|箱縛|clothing|acc|acc_bind|all|-|-|arms behind back,shibari|any|-|accessory
broken armor|破掉的盔甲|clothing|era|era_west|all|onepiece|-|armor|any|medieval,edo|garment
broken sword|斷掉的劍|env|other|obj_weapon|all|-|-|sword|any|-|normal
brushing teeth|刷牙|pose|activity|act_daily|all|activity|-|toothbrush|any|modern|normal
cameo|客串出場|subject|extra|cast_mix|all|-|-|-|any|-|normal
cat mask|貓咪面具|clothing|acc|acc_face|all|headwear|-|mask|any|-|accessory
cheek rest|臉頰靠住|pose|tease|pose_hand|all|-|-|-|any|-|normal
chicken leg|雞腿|env|other|obj_food|all|-|-|chicken (food)|any|modern|normal
christmas lights|聖誕燈串|env|other|obj_fest|all|-|-|christmas|any|modern,victorian|normal
claw foot bathtub|爪足浴缸|env|place|pl_home|all|place|-|bathtub|any|modern,victorian|normal
cloth|一塊布|env|other|obj_hand|all|-|-|-|any|-|normal
cocktail shaker|雪克杯|env|other|obj_hand|all|-|-|-|any|modern|normal
coffee cup|咖啡茶杯|env|other|obj_food|all|-|-|coffee,cup|any|modern|normal
coffee table|茶几|env|other|obj_furn|all|-|-|-|any|modern|normal
compass|指南針|env|other|obj_hand|all|held_prop|-|-|any|-|normal
contrast|對比度|quality|style|style_palette|all|palette|-|-|any|-|normal
corpse|屍體|pose|sex|sex_fetish|sex|-|-|-|any|-|normal
cream puff|奶油泡芙|env|other|obj_food|all|-|-|food|any|modern|normal
creature on head|生物停在頭上|pose|tease|pose_act|all|-|-|-|any|-|normal
creature on shoulder|生物停在肩上|pose|tease|pose_act|all|-|-|on shoulder|any|-|normal
cupping hands|雙手捧成碗|pose|tease|pose_hand|all|-|-|own hands together|any|-|normal
daisy|小雛菊|env|other|obj_plant|all|-|-|flower|any|-|normal
dark clouds|烏雲|env|sky|sky|all|-|-|cloud|any|-|normal
dark halo|暗黑光環|clothing|acc|acc_head|all|-|-|halo|any|-|accessory
dark room|昏暗的房間|env|light|light|all|lighting|-|dark|any|-|normal
diadem|冠冕|clothing|acc|acc_head|all|headwear|-|-|any|medieval,ancient_greece|accessory
digital media player|數位播放器|env|other|obj_tech|all|-|-|-|any|modern|normal
disembodied head|沒有身體的頭|feature|other|nonhuman|all|-|-|-|any|-|normal
dorsal fin|背鰭|feature|race|nonhuman|all|-|-|fins|any|-|normal
dragon tattoo|龍形刺青|feature|skin|tattoo|all|-|-|tattoo|any|-|normal
drill ponytail|鑽捲馬尾|feature|hair_style|hair_shape|all|hair_style|-|drill hair,ponytail|any|-|normal
ear chain|耳鍊|clothing|acc|acc_jewel|all|-|-|linked piercing|any|-|accessory
ear scrunchie|耳上大腸圈|clothing|acc|acc_head|all|-|-|scrunchie|any|-|accessory
egyptian|埃及風格|env|other|obj_theme|all|-|-|-|any|-|normal
extra mouth|多一張嘴|feature|other|nonhuman|all|-|-|-|any|-|normal
face punch|一拳打在臉上|pose|tease|pose_two|all|-|pair|punching|any|-|normal
fake halo|假光環|clothing|acc|acc_head|all|-|-|halo|any|-|accessory
fake nails|假指甲|feature|makeup|makeup|all|-|-|fingernails|any|-|normal
fanning face|搧著臉|pose|tease|pose_act|all|-|-|-|any|-|normal
feet on table|腳放在桌上|pose|tease|pose_stance|all|-|-|-|any|-|normal
fingers to cheeks|手指抵雙頰|pose|tease|pose_hand|all|-|-|-|any|-|normal
fingers to mouth|手指抵著嘴|pose|tease|pose_hand|all|-|-|-|any|-|normal
flaming hand|手上著火|feature|other|nonhuman|all|-|-|fire|any|-|normal
flashback|回憶分鏡|pose|camera|cam_fx|all|camera|-|-|any|-|normal
food on hand|掌心托食物|pose|tease|pose_act|all|-|-|-|any|-|normal
fourth wall|打破第四面牆|pose|tease|pose_situ|all|-|-|-|any|-|normal
frilled straps|荷葉邊肩帶|clothing|acc|acc_hand|all|-|-|frills|any|-|accessory
fruit cup|水果杯|env|other|obj_food|all|-|-|fruit|any|modern|normal
fruit on head|頭上放水果|pose|tease|pose_act|all|-|-|food on head,fruit|any|-|normal
full mouth|嘴巴塞滿|pose|face|face_mouth|all|-|-|-|any|-|normal
fur choker|毛皮頸環|clothing|acc|acc_neck|all|neckwear|-|choker|female|-|accessory
fur cuffs|毛皮袖口|clothing|acc|acc_hand|all|-|-|-|any|-|accessory
gesture|籠統手勢|pose|tease|pose_sign|all|-|-|-|any|-|normal
glass door|玻璃門|env|other|obj_build|all|-|-|door|any|-|normal
glass table|玻璃桌|env|other|obj_furn|all|-|-|-|any|modern|normal
glowing flower|發光的花|env|other|obj_plant|all|-|-|flower,glowing|any|-|normal
glowing hand|發光的手|feature|other|nonhuman|all|-|-|glowing|any|-|normal
glowing tattoo|發光刺青|feature|skin|tattoo|all|-|-|tattoo,glowing|any|-|normal
golden arms|金色手臂|feature|skin|skin_tone|all|-|-|colored skin|any|-|normal
gradient skin|漸層膚色|feature|skin|skin_tone|all|-|-|colored skin|any|-|normal
green armor|綠色盔甲|clothing|era|era_west|all|onepiece|-|armor|any|medieval,edo|garment
green feathers|綠色羽毛|feature|other|nonhuman|all|-|-|feathers|any|-|normal
green fire|綠火|env|effect|fx_glow|all|effect|-|fire|any|-|normal
green jumpsuit|綠連身褲|clothing|onepiece|op_uniform|all|onepiece|-|jumpsuit|any|modern|garment
green rose|綠玫瑰|env|other|obj_plant|all|-|-|flower|any|-|normal
grey bag|灰色包包|clothing|acc|acc_carry|all|-|-|bag|any|-|accessory
grey cat|灰貓|env|other|obj_plant|all|-|-|cat|any|-|normal
grey choker|灰頸環|clothing|acc|acc_neck|all|neckwear|-|choker|female|-|accessory
grey cloak|灰色斗篷|clothing|era|era_west|all|outer|-|cloak|any|medieval,victorian|garment
gun on back|槍背在背上|pose|tease|pose_hold|all|-|-|gun,weapon on back|any|modern|normal
hand gesture|籠統手部動作|pose|tease|pose_sign|all|-|-|-|any|-|normal
hand over face|手蓋在臉上|pose|tease|pose_hand|all|-|-|-|any|-|normal
hands in pocket|雙手插單口袋|pose|tease|pose_hand|all|-|-|-|any|-|normal
happy facial|開心顏射|pose|sex|sex_cum|sex|-|male,female|facial|any|-|normal
head|頭部|feature|other|body_part|all|-|-|-|any|-|normal
head on head|頭疊在頭上|pose|tease|pose_two|all|-|pair|-|any|-|normal
head steam|頭上冒煙|env|effect|fx_comic|all|effect|-|-|any|-|normal
headlight|車頭燈|env|other|obj_tech|all|-|-|-|any|modern|normal
holographic interface|全息介面|env|other|obj_tech|all|-|-|hologram|any|modern|normal
huge moon|巨大月亮|env|other|sky|all|-|-|moon|any|-|normal
humanoid robot|人形機器人|feature|race|race_fantasy|all|race|-|robot|any|modern|normal
invisible|隱形|env|effect|fx_comic|all|-|-|-|any|-|normal
jet|噴射飛機|env|other|obj_tech|all|-|-|-|any|modern|normal
kappa|河童|feature|race|race_fantasy|all|race|-|-|any|-|normal
knees out of frame|膝在畫面外|pose|camera|cam_frame|all|camera|-|-|any|-|normal
knives between fingers|指間夾刀|pose|tease|pose_hold|all|-|-|between fingers,holding knife|any|-|normal
leaning on table|身子靠桌|pose|tease|pose_stance|all|-|-|-|any|-|normal
lights|許多燈|env|light|light|all|lighting|-|-|any|-|normal
looking at food|看向食物|pose|gaze|gaze|all|gaze|-|food|any|-|normal
loose thighhigh|滑落過膝襪|clothing|legs|legs|all|legs|-|thighhighs|female|modern,victorian|garment
lying on water|躺在水面|pose|body|body|all|body_pose|-|lying|any|-|normal
mall|商場|env|place|pl_shop|all|place|-|indoors|any|modern|normal
merchandise|動漫周邊|env|other|obj_hand|all|-|-|-|any|modern|normal
mole on arm|手臂上的痣|feature|skin|skin_mark|all|-|-|mole|any|-|normal
mole on armpit|腋下的痣|feature|skin|skin_mark|all|-|-|mole|any|-|normal
muffin|瑪芬蛋糕|env|other|obj_food|all|-|-|food|any|modern|normal
muffin top|腰腹肉摺|feature|body_f|bf_shape|all|-|-|-|any|-|normal
multiple scars|身上多疤|feature|skin|skin_mark|all|-|-|scar|any|-|normal
nail|可見指甲|feature|makeup|makeup|all|-|-|-|any|-|normal
nail polish bottle|指甲油瓶|env|other|obj_hand|all|-|-|cosmetics|any|modern|normal
neck|頸部|feature|body_f|body_part|all|-|-|-|any|-|normal
neck garter|頸上襪帶|clothing|acc|acc_neck|all|neckwear|-|-|any|-|accessory
no halo|沒有光環|clothing|acc|acc_head|all|-|-|-|any|-|accessory
noses touching|鼻尖相觸|pose|tease|pose_two|all|-|pair|-|any|-|normal
note|小紙條|env|other|obj_hand|all|-|-|paper|any|modern|normal
ofuda on head|頭上貼符|pose|tease|pose_act|all|-|-|ofuda|any|edo,ancient_china,modern|normal
orange goggles|橙色蛙鏡|clothing|acc|acc_face|all|eyewear|-|goggles|any|modern|accessory
pants around one leg|褲褪到一腿|pose|flash|flash_expose|flash|-|-|pants|any|-|normal
party|聚會派對|env|other|obj_fest|all|-|-|-|any|modern|normal
patterned|有圖案|clothing|fabric|fab_material|all|fabric|-|-|any|-|garment
peacock feathers|孔雀羽|env|other|obj_plant|all|-|-|feathers|any|-|normal
person on head|人在頭頂|pose|tease|pose_act|all|-|pair|on head|any|-|normal
pink arm warmers|粉紅臂套|clothing|acc|acc_hand|all|-|-|arm warmers|any|-|accessory
pipe in mouth|口含菸斗|pose|tease|pose_act|all|-|-|smoking pipe|any|victorian|normal
playing piano|在彈鋼琴|pose|activity|act_fun|all|activity|-|-|any|modern,victorian|normal
pointing weapon|拿武器指人|pose|tease|pose_hold|all|-|-|holding weapon|any|-|normal
police car|警車|env|place|pl_ride|all|place|-|car|any|modern|normal
print socks|印花襪子|clothing|legs|legs|all|feet|-|socks|any|modern|garment
puffy cheeks|雙頰鼓起|pose|face|face_mouth|all|-|-|-|any|-|normal
purple cloak|紫色斗篷|clothing|era|era_west|all|outer|-|cloak|any|medieval,victorian|garment
purple robe|紫色長袍|clothing|outer|outer|all|outer|-|robe|any|-|garment
rabbit on head|頭上有兔子|pose|tease|pose_act|all|-|-|rabbit,animal on head|any|-|normal
red curtains|紅窗簾|env|other|obj_furn|all|-|-|curtains|any|-|normal
red star|紅色星星|env|effect|fx_comic|all|effect|-|star (symbol)|any|-|normal
red wristband|紅色腕帶|clothing|acc|acc_hand|all|-|-|wristband|any|modern|accessory
ring necklace|戒指項鍊|clothing|acc|acc_jewel|all|jewelry|-|ring,necklace|any|-|accessory
runny nose|流鼻涕|pose|face|face_mood|all|expression|-|snot|any|-|normal
scar on hand|手上疤痕|feature|skin|skin_mark|all|-|-|scar|any|-|normal
scar on leg|腿上疤痕|feature|skin|skin_mark|all|-|-|scar|any|-|normal
school of fish|一群魚|env|other|obj_plant|all|-|-|fish|any|-|normal
scratching|在抓癢|pose|tease|pose_act|all|-|-|-|any|-|normal
scratching cheek|搔臉頰|pose|tease|pose_act|all|-|-|-|any|-|normal
scratching head|搔頭|pose|tease|pose_act|all|-|-|-|any|-|normal
screen light|螢幕的光|env|light|light|all|lighting|-|-|any|modern|normal
severed head|斬下的頭|pose|sex|sex_fetish|sex|-|-|guro|any|-|normal
severed limb|斬下的肢|pose|sex|sex_fetish|sex|-|-|guro|any|-|normal
shaking head|左右搖頭|pose|tease|pose_sign|all|-|-|-|any|-|normal
shark fin|鯊魚背鰭|feature|other|nonhuman|all|-|-|fins|any|-|normal
shark print|鯊魚印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
shield on back|背著盾|pose|tease|pose_hold|all|-|-|shield|any|medieval,ancient_greece,ancient_china|normal
shopping mall|購物中心|env|place|pl_shop|all|place|-|indoors|any|modern|normal
short sidetail|短側馬尾|feature|hair_style|hair_shape|all|hair_style|-|side ponytail|any|-|normal
short yukata|短浴衣|clothing|era|era_jp|all|onepiece|-|yukata,short kimono|any|edo|garment
shoulder guard|護肩|clothing|acc|acc_hand|all|-|-|shoulder armor|any|-|accessory
shoulder plates|肩甲片|clothing|acc|acc_hand|all|-|-|shoulder armor|any|medieval|accessory
side drill|側邊鑽捲|feature|hair_style|hair_shape|all|hair_style|-|drill hair|any|-|normal
side-tie peek|側綁露肉|pose|flash|flash_expose|flash|-|-|-|female|-|normal
single bare leg|單腿赤裸|clothing|legs|legs|all|legs|-|-|any|-|normal
single head wing|單邊頭翅|feature|other|nonhuman|all|-|-|head wings|any|-|normal
skeletal arm|白骨手臂|feature|other|nonhuman|all|-|-|-|any|-|normal
skull on head|頭頂骷髏|pose|tease|pose_act|all|-|-|skull|any|-|normal
sky print|天空印花|clothing|fabric|fab_material|all|fabric|-|-|any|-|garment
sleeveless bodysuit|無袖緊身衣|clothing|onepiece|op_body|all|onepiece|-|bodysuit,sleeveless|any|modern|garment
slim legs|瘦腿|feature|body_f|bf_shape|all|-|-|-|any|-|normal
snake print|蛇皮印花|clothing|fabric|fab_material|all|-|-|-|any|modern|garment
spread navel|撐開肚臍|feature|body_f|body_part|flash|-|-|navel|any|-|normal
square|方形|env|other|obj_theme|all|-|-|-|any|-|normal
stitched leg|腿部縫線|feature|skin|skin_mark|all|-|-|stitches|any|-|normal
striped fur|條紋毛皮|feature|other|nonhuman|all|-|-|body fur|any|-|normal
surprised arms|受驚張臂|pose|tease|pose_hand|all|-|-|-|any|-|normal
sword behind back|背後藏劍|pose|tease|pose_hold|all|-|-|holding sword,holding behind back|any|-|normal
tall|個子很高|feature|body_f|bf_shape|all|-|-|-|any|-|normal
team 9|第九隊|feature|other|persona|all|-|-|-|any|-|normal
team skull|骷髏隊|feature|other|persona|all|-|-|-|any|-|normal
thick arms|粗手臂|feature|body_m|bm_build|all|-|-|-|any|-|normal
tickling feet|搔腳心|pose|activity|act_daily|all|activity|-|tickling|any|-|normal
toggles|牛角扣|clothing|fabric|fab_detail|all|-|-|-|any|-|garment
torn|有破損|clothing|fabric|fab_state|all|-|-|-|any|-|garment
torn cloak|破斗篷|clothing|era|era_west|all|outer|-|torn clothes,cloak|any|medieval,victorian|garment
towel around waist|腰圍毛巾|clothing|fabric|fab_detail|flash|-|-|towel|any|-|garment
tri braids|三條辮|feature|hair_style|hair_shape|all|hair_style|-|multiple braids|any|-|normal
twintails day|雙馬尾日|env|other|obj_fest|all|-|-|-|any|modern|normal
tying|在打結|pose|tease|pose_act|all|-|-|-|any|-|normal
under tree|在樹下|pose|tease|pose_stance|all|-|-|tree|any|-|normal
unworn bowtie|未戴領結|env|other|obj_hand|all|-|-|bowtie|any|modern,victorian|normal
unworn goggles|未戴護目鏡|env|other|obj_hand|all|-|-|goggles|any|modern|normal
unworn necklace|未戴項鍊|env|other|obj_hand|all|-|-|necklace|any|-|normal
unworn pants|脫下長褲|env|other|obj_hand|all|-|-|-|any|modern|normal
user interface|操作介面|pose|camera|cam_fx|all|-|-|-|any|modern|normal
veiny hands|手有青筋|feature|skin|skin_mark|all|-|-|veins|any|-|normal
very long tongue|特長舌頭|feature|other|mouth_bits|all|-|-|long tongue|any|-|normal
volleyball|打排球|pose|activity|act_sport|all|activity|-|playing sports|any|modern|normal
waiter|男侍|feature|job|job_modern|all|job|male|-|male|modern|normal
walking on liquid|液上行走|pose|tease|pose_stance|all|-|-|walking|any|-|normal
waving arms|揮雙臂|pose|tease|pose_hand|all|-|-|waving|any|-|normal
weapon bag|武器包|clothing|acc|acc_carry|all|-|-|bag|any|-|accessory
weapon behind back|背後藏武器|pose|tease|pose_hold|all|-|-|holding behind back,holding weapon|any|-|normal
wet face|濕臉|feature|skin|skin_flush|all|-|-|wet|any|-|normal
wet floor|濕地板|env|other|obj_build|all|-|-|floor|any|-|normal
white flag|白旗|env|other|obj_flag|all|-|-|flag|any|modern|normal
white towel|白毛巾|clothing|acc|acc_carry|all|-|-|towel|any|-|accessory
white wristband|白色腕帶|clothing|acc|acc_hand|all|-|-|wristband|any|modern|accessory
wide face|寬臉|pose|face|face_part|all|-|-|-|any|-|normal
wiping|正在擦|pose|activity|act_daily|all|activity|-|-|any|-|normal
wiping mouth|擦嘴巴|pose|activity|act_daily|all|activity|-|-|any|-|normal
wrist straps|手腕束帶|clothing|acc|acc_hand|all|-|-|-|any|-|accessory
x fingers|手指打叉|pose|tease|pose_sign|all|-|-|-|any|-|normal
yes|YES字樣|env|other|obj_theme|all|-|-|-|any|-|normal
habit|修道袍|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
harem|後宮關係|feature|other|relation|all|-|group|-|any|-|normal
ushanka|蘇聯毛帽|clothing|acc|acc_head|all|-|-|hat|any|-|accessory
nike (company)|耐吉標誌|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
phoenix crown|鳳冠|clothing|acc|acc_head|all|-|-|crown|female|ancient_china|accessory
winged footwear|帶翼鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
two-tone footwear|雙色鞋履|clothing|feet|feet|all|feet|-|-|any|modern,victorian,medieval|garment
boxer briefs|男四角褲|clothing|underwear|uw_bottom|flash|-|male|male underwear|male|modern|garment
calico|三色斑紋|clothing|fabric|fab_material|all|-|-|-|any|-|garment
polka dot legwear|圓點襪類|clothing|legs|legs|all|legs|-|polka dot|female|modern,victorian|garment
test plugsuit|試驗插栓服|clothing|onepiece|op_body|all|-|-|plugsuit|any|modern|garment
adidas|愛迪達標誌|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
hitodama print|人魂印花|clothing|fabric|fab_material|all|-|-|-|any|-|garment
striped one-piece swimsuit|條紋連身泳裝|clothing|onepiece|op_swim|all|-|-|one-piece swimsuit,striped clothes|female|modern|garment
popped button|鈕扣崩開|clothing|fabric|fab_state|flash|-|-|-|any|-|garment
mitsudomoe|三巴家紋|clothing|fabric|fab_material|all|-|-|-|any|edo|garment
legband|腿環帶|clothing|acc|acc_hand|all|-|-|-|any|-|accessory
pegasus knight uniform (fire emblem)|天馬騎士制服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|medieval|garment
spaceship hair ornament|太空船髮飾|clothing|acc|acc_head|all|-|-|hair ornament|any|modern|accessory
speaking tube headset|傳聲管耳機|clothing|acc|acc_face|all|-|-|headset|any|modern|accessory
bralines|胸罩痕跡|clothing|fabric|fab_state|flash|-|female|-|female|modern|garment
unfastened|沒扣上|clothing|fabric|fab_state|all|-|-|-|any|-|garment
print sarong|印花紗龍裙|clothing|bottom|bot_pants|all|-|-|sarong|any|modern|garment
pendant watch|懷錶墜飾|clothing|acc|acc_jewel|all|-|-|pendant|any|victorian,modern|accessory
tengu mask|天狗面具|clothing|acc|acc_face|all|-|-|mask|any|edo,modern|accessory
elbow sleeve|肘部袖套|clothing|acc|acc_hand|all|-|-|-|any|-|accessory
mizu happi|水法被|clothing|outer|outer|all|-|-|happi|any|modern,edo|garment
converse|匡威鞋|clothing|feet|feet|all|-|-|sneakers|any|modern|garment
kerchief|頭帕|clothing|acc|acc_head|all|-|-|headscarf|any|-|accessory
white stripes|白色條紋|clothing|fabric|fab_material|all|-|-|striped clothes|any|-|garment
honey strap|細肩飾帶|clothing|fabric|fab_detail|all|-|-|-|any|modern|garment
carrying bag|提著袋子|pose|tease|pose_hold|all|-|-|-|any|-|normal
micro bra|極小胸罩|clothing|underwear|uw_top|flash|-|female|bra|female|modern|garment
bust cup|胸罩罩杯|clothing|underwear|uw_top|flash|-|female|bra|female|modern|garment
brown serafuku|棕色水手服|clothing|onepiece|op_uniform|all|-|-|serafuku|female|modern|garment
panda hood|貓熊兜帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
little red riding hood (grimm) (cosplay)|小紅帽扮裝|clothing|fabric|fab_style|all|-|-|cosplay|any|-|garment
lifebuoy ornament|救生圈飾品|clothing|acc|acc_jewel|all|-|-|-|any|modern|accessory
camisole lift|掀起吊帶衫|pose|flash|flash_lift|flash|-|female|clothes lift,camisole|female|modern|normal
print mug|印花馬克杯|env|other|obj_food|all|-|-|mug|any|-|normal
exploding clothes|衣服炸開|clothing|fabric|fab_state|flash|-|-|-|any|-|garment
safety glasses|安全眼鏡|clothing|acc|acc_face|all|-|-|glasses|any|modern|accessory
flippers|蛙鞋|clothing|feet|feet|all|feet|-|-|any|modern|garment
spade hair ornament|黑桃髮飾|clothing|acc|acc_head|all|-|-|hair ornament|any|-|accessory
red male underwear|紅色男內褲|clothing|underwear|uw_bottom|flash|-|male|male underwear|male|modern|garment
kariyushi shirt|沖繩花襯衫|clothing|top|top_shirt|all|-|-|shirt|any|modern|garment
policeman|男警官|feature|job|job_modern|all|job|male|police uniform|male|modern|normal
dissolving clothes|衣服溶解|clothing|fabric|fab_state|flash|-|-|-|any|-|garment
male underwear peek|男內褲露邊|pose|flash|flash_expose|flash|-|male|male underwear|male|modern|normal
unworn jewelry|沒戴的首飾|env|other|obj_hand|all|-|-|-|any|-|normal
wardrobe error|穿錯衣服|clothing|fabric|fab_state|all|-|-|-|any|-|garment
propeller hair ornament|螺旋槳髮飾|clothing|acc|acc_head|all|-|-|hair ornament|any|modern|accessory
o-ring swimsuit|環扣連身泳裝|clothing|onepiece|op_swim|all|-|-|swimsuit|female|modern|garment
red bandeau|紅色抹胸|clothing|top|top_shirt|all|-|-|bandeau|any|modern|garment
starfish hair ornament|海星髮飾|clothing|acc|acc_head|all|-|-|hair ornament|any|-|accessory
throat microphone|喉頭麥|clothing|acc|acc_carry|all|-|-|microphone|any|modern|accessory
ski goggles|滑雪護目鏡|clothing|acc|acc_face|all|-|-|goggles|any|modern|accessory
pom pom earrings|毛球耳環|clothing|acc|acc_jewel|all|-|-|earrings|any|-|accessory
paw print pattern|爪印花紋|clothing|fabric|fab_material|all|-|-|paw print|any|modern|garment
layered kimono|層疊和服|clothing|era|era_jp|all|-|-|kimono|any|edo|garment
holding bra|手拿胸罩|pose|tease|pose_hold|flash|-|female|unworn bra|female|modern|normal
triangular eyewear|三角眼鏡|clothing|acc|acc_face|all|eyewear|-|-|any|modern|accessory
multiple hairpins|多支髮夾|clothing|acc|acc_head|all|-|-|hairclip|female|-|accessory
yellow one-piece swimsuit|黃色連身泳裝|clothing|onepiece|op_swim|all|-|-|one-piece swimsuit,swimsuit|female|modern|garment
fishnet bodysuit|漁網連身衣|clothing|onepiece|op_body|flash|-|female|bodystocking,fishnets|female|modern|garment
translucent|半透明材質|clothing|fabric|fab_material|flash|fabric|-|-|any|-|garment
hakama shorts|短袴|clothing|era|era_jp|all|bottom|-|-|any|modern|garment
masked|蒙面|clothing|acc|acc_face|all|-|-|mask|any|-|accessory
overall skirt|背帶裙|clothing|bottom|bot_skirt|all|-|female|skirt|female|modern|garment
karate gi|空手道服|clothing|era|era_jp|all|-|-|dougi|any|edo,modern|garment
disguise|喬裝|clothing|fabric|fab_style|all|-|-|-|any|-|garment
frontless outfit|前側空裝|clothing|fabric|fab_state|flash|-|-|-|any|-|garment
armored leotard|鎧甲連身衣|clothing|onepiece|op_body|all|onepiece|female|-|female|-|garment
metamoran vest|賽亞人背心|clothing|top|top_tank|all|top|-|-|any|modern|garment
lightning bolt hair ornament|閃電髮飾|clothing|acc|acc_head|all|-|-|hair ornament|any|-|accessory
normal suit|標準駕駛服|clothing|onepiece|op_uniform|all|-|-|pilot suit|any|modern|garment
orange bra|橙色胸罩|clothing|underwear|uw_top|flash|-|female|bra|female|modern|garment
two-sided cloak|兩面披風|clothing|era|era_west|all|-|-|cloak,two-sided fabric|any|medieval,victorian|garment
kirisame marisa (cosplay)|魔理沙扮裝|clothing|fabric|fab_style|all|-|-|cosplay|any|-|garment
paint on clothes|衣上顏料|clothing|fabric|fab_state|all|-|-|-|any|-|garment
cassock|司祭長袍|clothing|onepiece|op_uniform|all|onepiece|-|-|any|medieval,victorian|garment
adjusting buruma|拉整體操褲|pose|tease|pose_act|all|-|-|adjusting clothes,buruma|any|modern|normal
cross-laced skirt|交叉綁繩裙|clothing|bottom|bot_skirt|all|-|female|skirt,cross-laced clothes|female|modern,victorian,medieval,ancient_china|garment
suspenders slip|吊帶滑落|pose|flash|flash_lift|flash|-|-|suspenders|any|modern,victorian|normal
yellow sailor collar|黃色水手領|clothing|fabric|fab_sleeve|all|-|-|sailor collar|any|modern|garment
sweet lolita|甜系蘿莉塔|clothing|fabric|fab_style|all|-|female|lolita fashion|female|modern|garment
gingham|小方格布|clothing|fabric|fab_material|all|-|-|checkered clothes|any|modern,victorian|garment
anchor earrings|船錨耳環|clothing|acc|acc_jewel|all|-|-|earrings|any|-|accessory
sweater tucked in|毛衣塞進褲|clothing|fabric|fab_state|all|-|-|sweater|any|modern|garment
kittysuit|貓耳兔女郎裝|clothing|onepiece|op_body|all|-|female|playboy bunny|female|modern|garment
prehensile ribbon|會動的緞帶|clothing|acc|acc_bow|all|-|-|ribbon|any|-|accessory
broken eyewear|破裂的眼鏡|clothing|acc|acc_face|all|eyewear|-|-|any|modern,victorian|accessory
aviator cap|飛行帽|clothing|acc|acc_head|all|-|-|hat|any|modern|accessory
yin yang print|太極印花|clothing|fabric|fab_material|all|-|-|-|any|-|garment
black babydoll|黑色娃娃睡衣|clothing|onepiece|op_night|all|-|female|babydoll|female|modern|garment
blue male underwear|藍色男內褲|clothing|underwear|uw_bottom|flash|-|male|male underwear|male|modern|garment
frilled armband|荷葉臂章|clothing|acc|acc_hand|all|-|-|armband|any|-|accessory
glove bow|手套蝴蝶結|clothing|acc|acc_bow|all|-|-|bow|any|-|accessory
green serafuku|綠色水手服|clothing|onepiece|op_uniform|all|-|-|serafuku|female|modern|garment
headphones removed|摘下的耳機|env|other|obj_hand|all|-|-|-|any|modern|normal
black coat (kingdom hearts)|王國之心黑袍|clothing|outer|outer|all|outer|-|-|any|modern|garment
kataginu|肩衣|clothing|era|era_jp|all|-|-|japanese clothes|any|edo|garment
funeral dress|喪禮洋裝|clothing|onepiece|op_dress|all|-|female|dress|female|modern,victorian|garment
kamina shades|卡米那尖框眼鏡|clothing|acc|acc_face|all|-|-|sunglasses|any|modern|accessory
green ascot|綠色寬領巾|clothing|acc|acc_neck|all|-|-|ascot|any|victorian|accessory
aqua gemstone|水藍寶石|clothing|acc|acc_jewel|all|-|-|gem|any|-|accessory
haramaki|腹卷|clothing|top|top_tank|all|top|-|-|any|edo,modern|garment
chin piercing|下巴環|clothing|acc|acc_jewel|all|-|-|piercing|any|modern|accessory
peony print|牡丹印花|clothing|fabric|fab_material|all|-|-|floral print|any|-|garment
front-seamed legwear|前縫線襪|clothing|legs|legs|all|-|-|seamed legwear|any|modern,victorian|garment
white babydoll|白色娃娃睡衣|clothing|onepiece|op_night|all|-|female|babydoll|female|modern|garment
load bearing equipment|戰術負重帶|clothing|acc|acc_hand|all|-|-|harness|any|modern|accessory
front-tie bra|前綁胸罩|clothing|underwear|uw_top|flash|-|female|bra|female|modern|garment
fascinator|小禮帽飾|clothing|acc|acc_head|all|-|-|hat|female|victorian,modern|accessory
pink track suit|粉紅運動套裝|clothing|onepiece|op_uniform|all|-|-|track suit|any|modern|garment
space print|宇宙印花|clothing|fabric|fab_material|all|-|-|starry sky print|any|-|garment
pink serafuku|粉紅水手服|clothing|onepiece|op_uniform|all|-|-|serafuku|female|modern|garment
grey ascot|灰色寬領巾|clothing|acc|acc_neck|all|-|-|ascot|any|victorian|accessory
stahlhelm|德式鋼盔|clothing|acc|acc_head|all|-|-|combat helmet|any|modern|accessory
cherry print|櫻桃印花|clothing|fabric|fab_material|all|-|-|fruit print|any|modern|garment
crescent necklace|月牙項鍊|clothing|acc|acc_jewel|all|-|-|necklace|any|-|accessory
fishnet sleeves|網紗袖套|clothing|fabric|fab_sleeve|all|-|-|-|any|modern|garment
peach hat ornament|桃飾帽|clothing|acc|acc_head|all|-|-|hat ornament|any|-|accessory
fortified suit|強化駕駛服|clothing|onepiece|op_uniform|all|-|-|mecha pilot suit|any|modern|garment
butterfly ornament|蝴蝶小飾|clothing|acc|acc_jewel|all|-|-|-|any|-|accessory
c-string|無帶丁字褲|clothing|underwear|uw_bottom|flash|-|female|strapless bottom|female|modern|underwear
arm cutout|手臂挖空|clothing|fabric|fab_state|all|-|-|clothing cutout|any|-|garment
single bridal gauntlet|單邊新娘手套|clothing|acc|acc_hand|all|-|female|bridal gauntlets|female|-|accessory
pearl thong|珍珠丁褲|clothing|underwear|uw_bottom|flash|-|female|thong|female|modern|garment
blue male swimwear|藍色男泳褲|clothing|onepiece|op_swim|all|-|male|male swimwear|male|modern|garment
brown shawl|棕色披巾|clothing|era|era_west|all|-|female|shawl|female|victorian,ancient_greece|garment
white bandana|白色頭巾|clothing|acc|acc_neck|all|-|-|bandana|any|-|accessory
collared capelet|有領短披肩|clothing|era|era_west|all|-|-|capelet|any|medieval,victorian|garment
padlocked collar|上鎖項圈|clothing|acc|acc_neck|all|neckwear|-|collar,padlock|any|modern,victorian|accessory
anchor ornament|錨形飾|clothing|acc|acc_jewel|all|-|-|ornament|any|-|accessory
polka dot pajamas|圓點睡衣|clothing|onepiece|op_night|all|onepiece|-|pajamas,polka dot|any|modern|garment
striped neckerchief|條紋領巾|clothing|acc|acc_neck|all|neckwear|-|neckerchief,striped clothes|any|-|accessory
red shawl|紅披肩|clothing|outer|outer|all|outer|-|-|any|-|garment
green bandana|綠頭巾|clothing|acc|acc_neck|all|-|-|bandana|any|-|accessory
changpao|中式長袍|clothing|era|era_cn|all|onepiece|-|-|any|ancient_china,modern|garment
magatama hair ornament|勾玉髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
original race uniform (umamusume)|馬娘賽服|clothing|onepiece|op_uniform|all|onepiece|-|-|any|modern|garment
green sash|綠腰帶|clothing|acc|acc_hand|all|waist|-|-|any|ancient_china,edo,modern|accessory
impossible sweater|破綻毛衣|clothing|top|top_knit|all|top|-|sweater,impossible clothes|any|modern|garment
basketball jersey|籃球球衣|clothing|top|top_shirt|all|top|-|jersey|any|modern|garment
red camisole|紅細肩背心|clothing|top|top_tank|all|top|-|camisole|female|modern|garment
scale armor|鱗甲|clothing|era|era_west|all|onepiece|-|armor|any|medieval,edo|garment
two-tone kimono|雙色和服|clothing|era|era_jp|all|onepiece|-|kimono|any|edo|garment
single sandal|單腳涼鞋|clothing|feet|feet|all|feet|-|sandals|any|-|garment
brown ascot|棕領巾|clothing|acc|acc_neck|all|neckwear|-|ascot|any|victorian|accessory
monoglove|併臂手套|clothing|acc|acc_bind|all|hands|-|-|any|modern|accessory
winged hair ornament|翼形髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament|female|-|accessory
morrigan aensland (cosplay)|莫莉卡扮演|clothing|fabric|fab_style|all|-|-|cosplay|any|modern|garment
puppet rings|人偶戒指|clothing|acc|acc_jewel|all|jewelry|-|ring|any|-|accessory
plague doctor mask|瘟疫醫生面具|clothing|acc|acc_face|all|headwear|-|mask|any|medieval,victorian|accessory
tsumami kanzashi|花瓣簪|clothing|acc|acc_head|all|headwear|-|kanzashi|female|edo|accessory
zebra print|斑馬紋|clothing|fabric|fab_material|all|-|-|animal print|any|modern|garment
vertical-striped bra|直紋胸罩|clothing|underwear|uw_top|all|underwear_top|-|striped bra,vertical-striped clothes|female|modern|garment
blue mittens|藍連指手套|clothing|acc|acc_hand|all|hands|-|mittens|any|-|accessory
red tassel|紅流蘇|clothing|acc|acc_bow|all|-|-|tassel|any|-|accessory
obidome|和服帶飾|clothing|acc|acc_jewel|all|-|-|obi|any|edo|accessory
translucent bunnysuit|透明兔女郎|clothing|onepiece|op_body|flash|onepiece|-|playboy bunny,see-through clothes|female|modern|garment
grey male underwear|灰男內褲|clothing|underwear|uw_bottom|flash|underwear_bottom|-|male underwear|male|modern|garment
kagura suzu|神樂鈴|clothing|acc|acc_jewel|all|-|-|jingle bell|any|edo,modern|accessory
side-seamed legwear|側縫襪|clothing|legs|legs|all|-|-|seamed legwear|any|modern,victorian|garment
arm sling|手臂吊帶|clothing|acc|acc_bandage|all|-|-|-|any|modern|accessory
tank helmet|戰車頭盔|clothing|acc|acc_head|all|-|-|helmet|any|modern|accessory
white nightgown|白睡裙|clothing|onepiece|op_night|all|onepiece|-|nightgown|female|victorian,modern|garment
orca hood|虎鯨兜帽|clothing|acc|acc_head|all|headwear|-|-|any|-|accessory
suneate|日式脛甲|clothing|era|era_jp|all|-|-|-|any|edo|accessory
lowleg shorts|低腰短褲|clothing|bottom|bot_pants|all|bottom|-|shorts,lowleg|any|modern|garment
gerudo set (zelda)|格魯德套裝|clothing|onepiece|op_uniform|all|onepiece|-|-|any|-|garment
gambeson|棉甲|clothing|era|era_west|all|onepiece|-|-|any|medieval|garment
too many frills|過量荷葉邊|clothing|fabric|fab_material|all|-|-|-|any|-|garment
white corset|白束腰|clothing|era|era_west|all|top|-|corset|female|victorian|garment
object in clothes|衣內塞物|clothing|fabric|fab_state|all|-|-|-|any|-|garment
royal robe|王袍|clothing|era|era_west|all|onepiece|-|-|any|-|garment
jack-o'-lantern hair ornament|南瓜燈髮飾|clothing|acc|acc_head|all|headwear|-|hair ornament,jack-o'-lantern|female|modern|accessory
aqua sailor collar|水色水手領|clothing|fabric|fab_sleeve|all|-|-|sailor collar|any|modern|garment
white shawl|白披肩|clothing|outer|outer|all|outer|-|-|any|-|garment
shorts tan|短褲曬痕|feature|skin|skin_tone|all|-|-|tanlines|any|-|normal
ribbon-trimmed capelet|緞邊短披|clothing|era|era_west|all|outer|-|capelet,ribbon trim|any|medieval,victorian|garment
baseball jersey|棒球球衣|clothing|top|top_shirt|all|top|-|jersey|any|modern|garment
hat bell|帽上鈴|clothing|acc|acc_head|all|-|-|jingle bell|any|-|accessory
armored gloves|甲手套|clothing|acc|acc_hand|all|hands|-|gloves|any|medieval,modern|accessory
chrysanthemum print|菊花紋|clothing|fabric|fab_material|all|-|-|floral print|any|-|garment
grey one-piece swimsuit|灰連身泳裝|clothing|onepiece|op_swim|all|onepiece|-|one-piece swimsuit|female|modern|garment
tied sleeves|綁起袖子|clothing|fabric|fab_sleeve|all|-|-|-|any|-|garment
kalashnikov rifle|AK步槍|env|other|obj_weapon|all|-|-|assault rifle,rifle|any|modern|normal
different reflection|鏡中異影|env|other|obj_land|all|-|-|reflection|any|-|normal
rainbow order|彩虹排列|env|other|obj_theme|all|-|-|-|any|-|normal
magical musket|魔法火槍|env|other|obj_weapon|all|-|-|-|any|-|normal
menu|菜單|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
m4 carbine|M4卡賓槍|env|other|obj_weapon|all|-|-|assault rifle|any|modern|normal
window shade|遮光簾|env|other|obj_furn|all|-|-|-|any|modern|normal
bardiche|月刃斧|env|other|obj_weapon|all|-|-|polearm|any|medieval|normal
video game|電子遊戲|env|other|obj_tech|all|-|-|-|any|modern|normal
heckler & koch|HK槍廠|env|other|obj_weapon|all|-|-|-|any|modern|normal
h&k hk416|HK416步槍|env|other|obj_weapon|all|-|-|assault rifle|any|modern|normal
playstation controller|PS手把|env|other|obj_tech|all|held_prop|-|game controller|any|modern|normal
playstation portable|PSP掌機|env|other|obj_tech|all|-|-|handheld game console|any|modern|normal
sig sauer|SIG槍廠|env|other|obj_weapon|all|-|-|-|any|modern|normal
gibson les paul|萊斯保羅吉他|env|other|obj_music|all|held_prop|-|electric guitar|any|modern|normal
monster energy|魔爪飲料|env|other|obj_food|all|-|-|-|any|modern|normal
cup ramen|杯麵|env|other|obj_food|all|-|-|instant noodles|any|modern|normal
iphone|蘋果手機|env|other|obj_hand|all|held_prop|-|smartphone|any|modern|normal
glowing butterfly|發光蝴蝶|env|other|obj_plant|all|-|-|butterfly|any|-|normal
ipod|蘋果隨身聽|env|other|obj_tech|all|-|-|-|any|modern|normal
ar-15|AR15步槍|env|other|obj_weapon|all|-|-|rifle|any|modern|normal
wooden chair|木椅|env|other|obj_furn|all|-|-|chair|any|-|normal
m1911|M1911手槍|env|other|obj_weapon|all|-|-|handgun|any|modern|normal
nintendo ds|任天堂DS|env|other|obj_tech|all|-|-|handheld game console|any|modern|normal
bean bag chair|豆袋椅|env|other|obj_furn|all|-|-|-|any|modern|normal
tire|輪胎|env|other|obj_street|all|-|-|-|any|modern|normal
panzer iv|四號戰車|env|other|obj_weapon|all|-|-|tank|any|modern|normal
hammock|吊床|env|other|obj_furn|all|-|-|-|any|-|normal
h&k ump|UMP衝鋒槍|env|other|obj_weapon|all|-|-|submachine gun|any|modern|normal
keystone|要石|env|other|obj_classic|all|-|-|-|any|-|normal
telstar|特爾斯塔球|env|other|obj_sport|all|sport_ball|-|soccer ball|any|modern|normal
game boy|遊戲小子|env|other|obj_tech|all|-|-|handheld game console|any|modern|normal
p90|P90衝鋒槍|env|other|obj_weapon|all|-|-|submachine gun|any|modern|normal
joy-con|分離手把|env|other|obj_tech|all|held_prop|-|game controller|any|modern|normal
card parody|卡牌仿作|pose|camera|cam_fx|all|-|-|-|any|-|normal
cartridge|遊戲卡匣|env|other|obj_tech|all|-|-|-|any|modern|normal
baby bottle|奶瓶|env|other|obj_food|all|-|-|bottle|any|modern|normal
heart lock (kantai collection)|艦娘心鎖|clothing|acc|acc_jewel|all|-|-|-|any|modern|accessory
joystick|搖桿|env|other|obj_tech|all|held_prop|-|controller|any|modern|normal
nissin cup noodle|日清杯麵|env|other|obj_food|all|-|-|instant noodles|any|modern|normal
glock|格洛克手槍|env|other|obj_weapon|all|-|-|handgun|any|modern|normal
variable fighter|可變戰機|env|other|obj_theme|all|-|-|mecha|any|modern|normal
training corps (emblem)|訓練兵團徽|clothing|acc|acc_carry|all|-|-|emblem|any|modern|accessory
super soaker|超級水槍|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
paralyzer|麻痺手槍|env|other|obj_weapon|all|-|-|handgun|any|modern|normal
duel disk|決鬥盤|env|other|obj_tech|all|-|-|-|any|modern|normal
z-ring|寶可夢Z環|clothing|acc|acc_hand|all|-|-|wristband|any|modern|accessory
hook|鉤子|env|other|obj_hand|all|-|-|-|any|-|normal
masu|升斗|env|other|obj_food|all|-|-|cup|any|edo,modern|normal
vacuum cleaner|吸塵器|env|other|obj_tech|all|-|-|-|any|modern|normal
qingxin flower|清心花|env|other|obj_plant|all|-|-|flower|any|-|normal
beretta 92|貝瑞塔92|env|other|obj_weapon|all|-|-|handgun|any|modern|normal
knight (chess)|西洋棋騎士|env|other|obj_hand|all|-|-|-|any|-|normal
nintendo 3ds|任天堂3DS|env|other|obj_tech|all|-|-|handheld game console|any|modern|normal
bishamonten's spear|毘沙門槍|env|other|obj_weapon|all|-|-|-|any|-|normal
bamboo shoot|竹筍|env|other|obj_food|all|-|-|-|any|-|normal
roasted sweet potato|烤地瓜|env|other|obj_food|all|-|-|sweet potato|any|modern|normal
miracle mallet|萬寶槌|env|other|obj_hand|all|held_prop|-|mallet|any|-|normal
stuffed dog|狗布偶|env|other|obj_hand|all|held_prop|-|stuffed animal|any|modern|normal
battleship|戰艦|env|other|obj_tech|all|-|-|warship|any|modern|normal
clothes pin|衣夾|env|other|obj_hand|all|-|-|-|any|modern|normal
scouter|戰鬥探測器|clothing|acc|acc_face|all|eyewear|-|-|any|modern|accessory
stakes of purgatory|煉獄釘|env|other|obj_weapon|all|-|-|-|any|-|normal
ashtray|菸灰缸|env|other|obj_furn|all|-|-|-|any|modern|normal
bipod|槍腳架|env|other|obj_weapon|all|-|-|-|any|modern|normal
beer bottle|啤酒瓶|env|other|obj_food|all|-|-|bottle,beer|any|modern,victorian|normal
walther|瓦爾特槍廠|env|other|obj_weapon|all|-|-|-|any|modern|normal
year of the dog|狗年|env|other|obj_theme|all|-|-|chinese zodiac|any|-|normal
dream soul|夢魂|env|other|obj_hand|all|-|-|-|any|-|normal
shamoji|飯勺|env|other|obj_hand|all|held_prop|-|-|any|edo,modern|normal
year of the pig|豬年|env|other|obj_theme|all|-|-|chinese zodiac|any|-|normal
grimoire of alice|愛麗絲魔導書|env|other|obj_classic|all|-|-|grimoire|any|-|normal
laundry basket|洗衣籃|env|other|obj_hand|all|-|-|basket|any|modern|normal
broccoli|青花菜|env|other|obj_food|all|-|-|vegetable|any|modern|normal
through screen|隔著螢幕|pose|camera|cam_fx|all|camera|-|-|any|modern|normal
stiletto (weapon)|細長匕首|env|other|obj_weapon|all|-|-|dagger|any|-|normal
floating rock|浮空岩石|env|other|obj_land|all|-|-|rock|any|-|normal
cabbage|高麗菜|env|other|obj_food|all|-|-|vegetable|any|modern|normal
canned coffee|罐裝咖啡|env|other|obj_food|all|-|-|drink can,coffee|any|modern|normal
chess|西洋棋|env|other|obj_hand|all|-|-|-|any|modern,victorian,medieval|normal
eel|鰻魚|env|other|obj_plant|all|-|-|fish|any|-|normal
materia|魔石|env|other|obj_hand|all|-|-|-|any|modern|normal
jolly roger|海盜旗|env|other|obj_flag|all|-|-|flag|any|modern|normal
firelock|火銃|env|other|obj_weapon|all|-|-|antique firearm|any|victorian,modern|normal
oonusa|大御幣|env|other|obj_classic|all|-|-|gohei|any|edo,modern|normal
groceries|生鮮雜貨|env|other|obj_food|all|-|-|-|any|modern|normal
window (computing)|程式視窗|env|other|obj_tech|all|-|-|-|any|modern|normal
smartphone case|手機殼|env|other|obj_hand|all|-|-|smartphone|any|modern|normal
kickboard|滑板車|env|other|obj_sport|all|-|-|-|any|modern|normal
honda|本田車|env|other|obj_tech|all|-|-|-|any|modern|normal
carton|硬紙盒|env|other|obj_hand|all|-|-|-|any|-|normal
cash register|收銀機|env|other|obj_tech|all|-|-|-|any|modern|normal
ooarai (emblem)|大洗校徽|clothing|acc|acc_carry|all|-|-|emblem|any|modern|accessory
ray gun|射線槍|env|other|obj_weapon|all|-|-|energy gun|any|modern|normal
bolt|螺栓|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
trash|垃圾|env|other|obj_street|all|-|-|-|any|modern|normal
chili pepper|辣椒|env|other|obj_food|all|-|-|-|any|modern|normal
tambourine|鈴鼓|env|other|obj_music|all|held_prop|-|-|any|-|normal
jam|果醬|env|other|obj_food|all|-|-|-|any|modern|normal
biwa lute|琵琶|env|other|obj_music|all|-|-|lute (instrument)|any|edo,modern|normal
craft essence (fate)|概念禮裝|env|other|obj_hand|all|-|-|card|any|modern|normal
sprinkles|彩糖|env|other|obj_food|all|-|-|-|any|modern|normal
phoenix|鳳凰|env|other|obj_plant|all|-|-|bird|any|-|normal
canteen|行軍水壺|env|other|obj_food|all|-|-|-|any|modern,victorian|normal
lime (fruit)|萊姆|env|other|obj_food|all|-|-|fruit|any|modern|normal
croissant|可頌麵包|env|other|obj_food|all|-|-|food|any|modern|normal
cork|軟木塞|env|other|obj_hand|all|-|-|-|any|-|normal
lance of longinus (evangelion)|朗基努斯之槍|env|other|obj_weapon|all|-|-|-|any|modern|normal
cupboard|碗櫃|env|other|obj_furn|all|-|-|cabinet|any|-|normal
orca|虎鯨|env|other|obj_plant|all|-|-|-|any|-|normal
fern|蕨類|env|other|obj_plant|all|-|-|-|any|-|normal
war hammer|戰鎚|env|other|obj_weapon|all|-|-|hammer,weapon|any|medieval,victorian,modern|normal
sauce|醬汁|env|other|obj_food|all|-|-|-|any|modern|normal
casing ejection|拋殼|env|other|obj_weapon|all|-|-|shell casing|any|modern|normal
coffee pot|咖啡壺|env|other|obj_food|all|-|-|coffee|any|modern|normal
m16|M16步槍|env|other|obj_weapon|all|-|-|assault rifle|any|modern|normal
yumi (bow)|和弓|env|other|obj_weapon|all|-|-|bow (weapon)|any|edo,modern|normal
star wand|星形魔杖|env|other|obj_hand|all|-|-|wand|any|-|normal
kanshou & bakuya (fate)|干將莫邪|env|other|obj_weapon|all|-|-|sword|any|-|normal
kadomatsu|門松|env|other|obj_fest|all|-|-|-|any|edo,modern|normal
paint can|油漆罐|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
raspberry|覆盆子果|env|other|obj_food|all|-|-|fruit|any|modern|normal
musket|滑膛槍|env|other|obj_weapon|all|-|-|antique firearm|any|victorian,modern|normal
temari ball|手鞠球|env|other|obj_sport|all|-|-|ball|any|edo,modern|normal
microwave|微波爐|env|other|obj_tech|all|-|-|-|any|modern|normal
weights|重訓槓片|env|other|obj_sport|all|-|-|-|any|modern|normal
wafer stick|威化棒|env|other|obj_food|all|-|-|food|any|modern|normal
container|容器|env|other|obj_hand|all|-|-|-|any|-|normal
ak-47|AK-47步槍|env|other|obj_weapon|all|-|-|assault rifle|any|modern|normal
pitcher (container)|水罐|env|other|obj_food|all|-|-|-|any|-|normal
coin purse|零錢包|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
dollar sign|美元符號|env|other|obj_theme|all|-|-|-|any|modern|normal
crescent rose|新月玫瑰|env|other|obj_weapon|all|-|-|scythe,gun|any|modern|normal
stuffed panda|貓熊玩偶|env|other|obj_hand|all|-|-|stuffed animal|any|modern|normal
holographic monitor|全息螢幕|env|other|obj_tech|all|-|-|monitor,hologram|any|modern|normal
cello|大提琴|env|other|obj_music|all|-|-|-|any|victorian,modern|normal
scalpel|手術刀|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
whip sword|鞭劍|env|other|obj_weapon|all|-|-|weapon|any|-|normal
wanted|通緝令|env|other|obj_street|all|-|-|-|any|modern|normal
pawn (chess)|西洋棋兵|env|other|obj_hand|all|held_prop|-|chess piece|any|modern,victorian,medieval|normal
popsicle stick|冰棒棍|env|other|obj_hand|all|-|-|-|any|modern|normal
anti-aircraft|防空武器|env|other|obj_weapon|all|-|-|-|any|modern|normal
hashitsuki nata|端付柴刀|env|other|obj_weapon|all|-|-|nata (tool)|any|-|normal
keyblade|鑰匙劍|env|other|obj_weapon|all|-|-|sword|any|modern|normal
chessboard|西洋棋盤|env|other|obj_hand|all|-|-|chess|any|modern,victorian,medieval|normal
saury|秋刀魚|env|other|obj_plant|all|-|-|fish|any|-|normal
digital clock|數字時鐘|env|other|obj_tech|all|-|-|-|any|modern|normal
saint quartz (fate)|聖晶石|env|other|obj_hand|all|-|-|-|any|modern|normal
vertical foregrip|垂直前握把|env|other|obj_weapon|all|-|-|foregrip|any|modern|normal
aegis sword (xenoblade)|天啟之劍|env|other|obj_weapon|all|-|-|sword|any|modern|normal
poke ball (legends)|洗翠球|env|other|obj_hand|all|-|-|poke ball|any|modern|normal
tack (riding)|馬具|env|other|obj_sport|all|-|-|-|any|-|normal
bridle|馬勒|env|other|obj_sport|all|-|-|-|any|-|normal
coconut tree|椰子樹|env|other|obj_plant|all|-|-|palm tree|any|-|normal
baton (weapon)|警棍|env|other|obj_weapon|all|-|-|weapon|any|modern|normal
pregnancy test|驗孕棒|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
anti-aircraft gun|高射砲|env|other|obj_weapon|all|-|-|gun|any|modern|normal
drum magazine|彈鼓|env|other|obj_weapon|all|-|-|magazine (weapon)|any|modern|normal
fried rice|炒飯|env|other|obj_food|all|-|-|rice|any|modern|normal
mg42|MG42機槍|env|other|obj_weapon|all|-|-|machine gun|any|modern|normal
red carpet|紅地毯|env|other|obj_furn|all|-|-|carpet|any|-|normal
bacon|培根|env|other|obj_food|all|-|-|food|any|modern|normal
shogi|將棋|env|other|obj_hand|all|-|-|-|any|edo,modern|normal
banana peel|香蕉皮|env|other|obj_food|all|-|-|-|any|modern|normal
senbei|仙貝|env|other|obj_food|all|-|-|food|any|edo,modern|normal
jump rope|跳繩|env|other|obj_sport|all|-|-|-|any|modern|normal
bc freedom (emblem)|BC自由校徽|clothing|acc|acc_carry|all|-|-|emblem|any|modern|accessory
jug (bottle)|水甕|env|other|obj_food|all|-|-|-|any|-|normal
oar|船槳|env|other|obj_sport|all|held_prop|-|-|any|-|normal
hawk|鷹|env|other|obj_plant|all|-|-|bird|any|-|normal
audio jack|耳機孔|env|other|obj_tech|all|-|-|-|any|modern|normal
minigun|迷你加特林|env|other|obj_weapon|all|-|-|gatling gun|any|modern|normal
oven|烤箱|env|other|obj_furn|all|-|-|-|any|modern|normal
soy sauce|醬油|env|other|obj_food|all|-|-|-|any|ancient_china,edo,modern|normal
bull|公牛|env|other|obj_plant|all|-|-|-|any|-|normal
tripod|三腳架|env|other|obj_tech|all|-|-|-|any|modern,victorian|normal
year of the rooster|雞年|env|other|obj_fest|all|-|-|-|any|edo,modern|normal
piano keys|鋼琴琴鍵|env|other|obj_music|all|-|-|-|any|victorian,modern|normal
package|包裹|env|other|obj_hand|all|-|-|-|any|modern|normal
cockroach|蟑螂|env|other|obj_plant|all|-|-|bug|any|-|normal
flying button|飛出的扣子|env|other|obj_hand|all|-|-|-|any|-|normal
bald eagle|白頭海鵰|env|other|obj_plant|all|-|-|eagle|any|-|normal
rag|抹布|env|other|obj_hand|all|-|-|-|any|-|normal
pocari sweat|寶礦力|env|other|obj_food|all|-|-|-|any|modern|normal
shampoo bottle|洗髮精瓶|env|other|obj_hand|all|-|-|-|any|modern|normal
flail|鏈鎚|env|other|obj_weapon|all|-|-|weapon|any|medieval,victorian,modern|normal
log pose|記錄指針|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
dirigible|硬式飛船|env|other|obj_tech|all|-|-|-|any|victorian,modern|normal
fleur-de-lis|鳶尾紋|env|other|obj_theme|all|-|-|-|any|-|normal
rooster|公雞|env|other|obj_plant|all|-|-|chicken|any|-|normal
price tag|標價牌|env|other|obj_hand|all|-|-|-|any|modern|normal
crutch|拐杖|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
pet food|寵物飼料|env|other|obj_food|all|-|-|-|any|modern|normal
doorknob|門把|env|other|obj_build|all|-|-|-|any|-|normal
worm|蠕蟲|env|other|obj_plant|all|-|-|-|any|-|normal
nissan|日產車|env|other|obj_tech|all|-|-|-|any|modern|normal
brass knuckles|指虎|env|other|obj_weapon|all|-|-|weapon|any|modern|normal
clarent (fate)|克拉倫特|env|other|obj_weapon|all|-|-|sword|any|-|normal
tofu|豆腐|env|other|obj_food|all|-|-|food|any|ancient_china,edo,modern|normal
dualshock|雙震手把|env|other|obj_tech|all|-|-|game controller|any|modern|normal
depth charge|深水炸彈|env|other|obj_weapon|all|-|-|-|any|modern|normal
gae dearg (fate)|赤紅迦耶|env|other|obj_weapon|all|-|-|weapon|any|-|normal
desert eagle|沙漠之鷹|env|other|obj_weapon|all|-|-|handgun|any|modern|normal
chocolate banana|巧克力香蕉|env|other|obj_food|all|-|-|chocolate,banana|any|modern|normal
tuanshan|紈扇|env|other|obj_hand|all|-|-|hand fan|any|ancient_china,edo|normal
dusk ball|黑暗球|env|other|obj_hand|all|-|-|poke ball|any|modern|normal
chibi on head|頭上小人|env|other|obj_plant|all|-|-|on head|any|-|normal
vodka|伏特加|env|other|obj_food|all|-|-|alcohol|any|modern|normal
fish tank|魚缸|env|other|obj_furn|all|-|-|-|any|modern|normal
mauser 98|毛瑟步槍|env|other|obj_weapon|all|-|-|rifle,bolt action|any|modern|normal
fluorescent lamp|日光燈|env|light|light|all|-|-|lamp|any|modern|normal
flintlock|燧發槍|env|other|obj_weapon|all|-|-|firelock|any|victorian,modern|normal
too many cats|一群貓|env|other|obj_plant|all|-|-|cat|any|-|normal
flagpole|旗桿|env|other|obj_flag|all|-|-|-|any|-|normal
duct tape|銀色膠帶|env|other|obj_hand|all|-|-|tape|any|modern|normal
ketchup bottle|番茄醬瓶|env|other|obj_food|all|-|-|ketchup,bottle|any|modern|normal
daikon|白蘿蔔|env|other|obj_food|all|-|-|-|any|edo,modern|normal
tart (food)|塔派|env|other|obj_food|all|-|-|food|any|modern|normal
broken mirror|破裂的鏡子|env|other|obj_furn|all|-|-|mirror|any|-|normal
windsock|風向袋|env|other|obj_flag|all|-|-|-|any|modern|normal
persimmon|柿子|env|other|obj_food|all|-|-|fruit|any|-|normal
signpost|路標柱|env|other|obj_street|all|-|-|-|any|modern|normal
stick poster|手舉海報|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
floating skull|浮空頭骨|env|other|obj_hand|all|-|-|-|any|-|normal
toothpick|牙籤|env|other|obj_food|all|-|-|-|any|-|normal
hanging scroll|掛軸|env|other|obj_classic|all|-|-|-|any|ancient_china,edo,modern|normal
toyota|豐田汽車|env|other|obj_tech|all|-|-|-|any|modern|normal
bonsai|盆景|env|other|obj_plant|all|-|-|-|any|ancient_china,edo,modern|normal
magnet|磁鐵|env|other|obj_hand|all|-|-|-|any|modern|normal
golden apple|金蘋果|env|other|obj_food|all|-|-|-|any|ancient_greece,modern|normal
centipede|蜈蚣|env|other|obj_plant|all|-|-|bug|any|-|normal
flat screen tv|平面電視|env|other|obj_tech|all|-|-|television|any|modern|normal
kitten|幼貓|env|other|obj_plant|all|-|-|baby animal,cat|any|-|normal
stuffed unicorn|獨角獸布偶|env|other|obj_hand|all|-|-|stuffed animal|any|modern|normal
blue innertube|藍色泳圈|env|other|obj_sport|all|-|-|innertube|any|modern|normal
super mushroom|超級蘑菇|env|other|obj_hand|all|-|-|-|any|modern|normal
rattle|嬰兒搖鈴|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
spray bottle|噴霧瓶|env|other|obj_hand|all|held_prop|-|bottle|any|modern|normal
sleigh|雪橇|env|other|pl_ride|all|-|-|-|any|modern,victorian|normal
mousetrap|捕鼠夾|env|other|obj_hand|all|-|-|-|any|modern|normal
christmas wreath|聖誕花環|env|other|obj_fest|all|-|-|-|any|modern,victorian|normal
udon|烏龍麵|env|other|obj_food|all|-|-|noodles|any|edo,modern|normal
spray paint|噴漆罐|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
ball and chain (weapon)|鏈錘|env|other|obj_weapon|all|-|-|-|any|medieval|normal
drain (object)|排水孔|env|other|obj_furn|all|-|-|-|any|modern|normal
grenade pin|手榴彈插銷|env|other|obj_weapon|all|-|-|-|any|modern|normal
stuffed frog|青蛙布偶|env|other|obj_hand|all|-|-|stuffed animal|any|modern|normal
gingerbread man|薑餅人|env|other|obj_fest|all|-|-|-|any|modern,victorian|normal
furoshiki|包袱巾|env|other|obj_hand|all|-|-|-|any|edo,modern|normal
hanafuda|花札|env|other|obj_hand|all|-|-|card|any|edo,modern|normal
plastic bottle|寶特瓶|env|other|obj_food|all|-|-|bottle|any|modern|normal
hylian shield|海利亞盾|env|other|obj_weapon|all|-|-|-|any|-|normal
hatsumoude|新年參拜|env|other|obj_fest|all|-|-|-|any|edo,modern|normal
evoker|喚起器|env|other|obj_weapon|all|-|-|-|any|modern|normal
stapler|釘書機|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
slug|蛞蝓|env|other|obj_plant|all|-|-|-|any|-|normal
twig|小樹枝|env|other|obj_plant|all|-|-|branch|any|-|normal
madoka runes|魔女文字|env|other|obj_theme|all|-|-|-|any|-|normal
ginkgo tree|銀杏樹|env|other|obj_plant|all|-|-|tree|any|-|normal
yakisoba|日式炒麵|env|other|obj_food|all|-|-|noodles|any|modern|normal
fly|蒼蠅|env|other|obj_plant|all|-|-|bug|any|-|normal
sharing food|分食|pose|tease|pose_two|all|-|pair|-|any|-|normal
tarot (card)|塔羅牌|env|other|obj_hand|all|-|-|card|any|-|normal
shakujou|錫杖|env|other|obj_weapon|all|-|-|staff|any|ancient_china,edo,modern|normal
usb|USB接頭|env|other|obj_tech|all|-|-|-|any|modern|normal
water yoyo|祭典水球|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
plumeria|雞蛋花|env|other|obj_plant|all|-|-|flower|any|-|normal
balance scale|天平|env|other|obj_hand|all|-|-|-|any|-|normal
seal impression|鈐印|env|other|obj_classic|all|-|-|-|any|ancient_china,edo,modern|normal
control rod|阿空控制棒|env|other|obj_weapon|all|-|-|-|any|-|normal
welsh corgi|柯基犬|env|other|obj_plant|all|-|-|dog|any|-|normal
koinobori|鯉魚旗|env|other|obj_flag|all|-|-|-|any|edo,modern|normal
bident|雙叉戟|env|other|obj_weapon|all|-|-|-|any|ancient_greece|normal
kantele|康特列琴|env|other|obj_music|all|-|-|instrument|any|-|normal
undersized animal|偏小動物|env|other|obj_plant|all|-|-|-|any|-|normal
manta ray|蝠魟|env|other|obj_plant|all|-|-|fish|any|-|normal
hoshi no tsue|星之杖|env|other|obj_hand|all|-|-|wand|any|-|normal
pickup truck|皮卡車|env|other|obj_tech|all|-|-|truck|any|modern|normal
erlenmeyer flask|錐形瓶|env|other|obj_food|all|-|-|flask|any|modern|normal
wax seal|火漆印|env|other|obj_hand|all|-|-|-|any|medieval,victorian,modern|normal
rubik's cube|魔術方塊|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
boulder|巨石|env|other|obj_land|all|-|-|rock|any|-|normal
orange juice|柳橙汁|env|other|obj_food|all|-|-|juice|any|modern|normal
mosin-nagant|莫辛納甘槍|env|other|obj_weapon|all|-|-|rifle|any|modern|normal
gorilla|大猩猩|env|other|obj_plant|all|-|-|-|any|-|normal
fishbowl|玻璃魚缸|env|other|obj_furn|all|-|-|-|any|modern|normal
large syringe|大型針筒|env|other|obj_hand|all|-|-|syringe,oversized object|any|modern|normal
turkey (food)|烤火雞|env|other|obj_food|all|-|-|food|any|modern|normal
chisel|鑿刀|env|other|obj_hand|all|held_prop|-|-|any|-|normal
ring-con|健身環|env|other|obj_sport|all|held_prop|-|-|any|modern|normal
artillery|火砲|env|other|obj_weapon|all|-|-|-|any|modern|normal
tiger i|虎式戰車|env|other|obj_weapon|all|-|-|tank|any|modern|normal
champagne bottle|香檳瓶|env|other|obj_food|all|-|-|champagne,bottle|any|modern|normal
water lily flower|睡蓮花|env|other|obj_plant|all|-|-|flower|any|-|normal
energy weapon|能量武器|env|other|obj_weapon|all|-|-|-|any|modern|normal
trowel|泥刀|env|other|obj_hand|all|held_prop|-|-|any|-|normal
food insertion|食物插入|pose|sex|sex_insert|sex|-|-|object insertion,food|any|-|normal
angelfish|神仙魚|env|other|obj_plant|all|-|-|fish|any|-|normal
kriss vector|克里斯向量槍|env|other|obj_weapon|all|-|-|submachine gun|any|modern|normal
eggshell|蛋殼|env|other|obj_food|all|-|-|-|any|modern|normal
seed|種子|env|other|obj_plant|all|-|-|-|any|-|normal
mint|薄荷葉|env|other|obj_food|all|-|-|-|any|-|normal
diploma|畢業證書|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
cattail|香蒲|env|other|obj_plant|all|-|-|plant|any|-|normal
aburaage|油豆腐|env|other|obj_food|all|-|-|food|any|edo,modern|normal
rina-chan board|璃奈扇板|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
toothpaste|牙膏|env|other|obj_hand|all|-|-|-|any|modern|normal
planted umbrella|插地傘|env|other|obj_plant|all|-|-|planted|any|-|normal
ikea shark|宜家鯊布偶|env|other|obj_hand|all|-|-|stuffed shark|any|modern|normal
canopy (aircraft)|飛機座艙罩|env|other|obj_tech|all|-|-|aircraft|any|modern|normal
maracas|沙鈴|env|other|obj_music|all|held_prop|-|instrument|any|-|normal
mousepad (object)|滑鼠墊|env|other|obj_tech|all|-|-|-|any|modern|normal
heater|電暖器|env|other|obj_tech|all|-|-|-|any|modern|normal
heart straw|愛心吸管|env|other|obj_food|all|-|-|crazy straw|any|modern|normal
pear|梨子|env|other|obj_food|all|-|-|fruit|any|-|normal
poison|毒藥瓶|env|other|obj_classic|all|-|-|-|any|-|normal
energy blade|能量刃|env|other|obj_weapon|all|-|-|sword|any|modern|normal
rubber band|橡皮筋|env|other|obj_hand|all|-|-|-|any|modern|normal
lime slice|萊姆片|env|other|obj_food|all|-|-|-|any|modern|normal
barbell|槓鈴|env|other|obj_sport|all|held_prop|-|-|any|modern|normal
joker (playing card)|鬼牌|env|other|obj_hand|all|-|-|playing card|any|-|normal
myrtenaster|懷絲刺劍|env|other|obj_weapon|all|-|-|sword|any|modern|normal
flamethrower|噴火器|env|other|obj_weapon|all|-|-|-|any|modern|normal
cardiogram|心電圖|env|other|obj_tech|all|-|-|-|any|modern|normal
toolbox|工具箱|env|other|obj_hand|all|-|-|-|any|modern|normal
sakura empire (emblem)|重櫻徽記|env|other|obj_theme|all|-|-|-|any|modern|normal
butterflyfish|蝴蝶魚|env|other|obj_plant|all|-|-|fish|any|-|normal
dragonslayer (sword)|屠龍大劍|env|other|obj_weapon|all|-|-|sword|any|-|normal
pravda (emblem)|真理學園徽|env|other|obj_theme|all|-|-|-|any|modern|normal
mailbox (incoming mail)|收件信箱|env|other|obj_street|all|-|-|-|any|modern|normal
pink butterfly|粉紅蝴蝶|env|other|obj_plant|all|-|-|butterfly|any|-|normal
tuna|鮪魚|env|other|obj_food|all|-|-|-|any|edo,modern|normal
laser sight|雷射瞄準器|env|other|obj_weapon|all|-|-|-|any|modern|normal
cheese trail|起司痕跡|env|other|obj_food|all|-|-|cheese|any|modern|normal
tucked money|衣內夾鈔|env|other|obj_hand|all|-|-|money|any|modern|normal
aircraft carrier|航空母艦|env|other|obj_tech|all|-|-|warship|any|modern|normal
traffic baton|交通指揮棒|env|other|obj_hand|all|held_prop|-|-|any|modern|normal
satellite dish|衛星天線|env|other|obj_tech|all|-|-|-|any|modern|normal
presenting armpit|展示腋下|pose|flash|flash_pose|flash|-|-|armpits|any|-|normal
hugging doll|抱著人偶|pose|body|body|all|-|-|hugging object,doll|any|-|normal
foot up|墊高單腳|pose|tease|pose_stance|all|-|-|-|any|-|normal
freediving|自由潛水|pose|activity|act_water|all|-|-|diving|any|-|normal
impaled|被刺穿|pose|sex|sex_fetish|sex|-|-|-|any|-|normal
high kick|高踢腿|pose|body|body|all|-|-|kicking|any|-|normal
palms together|雙掌相貼|pose|tease|pose_hand|all|-|-|-|any|-|normal
breast conscious|在意胸部|pose|tease|pose_situ|all|-|female|-|female|-|normal
hitting|揮擊|pose|tease|pose_act|all|-|-|-|any|-|normal
climbing|攀爬|pose|activity|act_sport|all|activity|-|-|any|-|normal
belly grab|抓住肚子|pose|tease|pose_two|flash|-|pair|-|any|-|normal
ready to draw|拔武器預備|pose|body|body|all|-|-|fighting stance|any|-|normal
clapping|鼓掌拍手|pose|tease|pose_sign|all|-|-|-|any|-|normal
ballet|芭蕾舞|pose|activity|act_fun|all|activity|-|-|any|modern,victorian|normal
washing|清洗東西|pose|activity|act_daily|all|activity|-|-|any|-|normal
outstretched leg|把腿伸直|pose|tease|pose_stance|all|-|-|-|any|-|normal
presenting foot|展示腳|pose|flash|flash_pose|flash|-|-|-|any|-|normal
pov doorway|從門口看入|pose|camera|cam_angle|all|-|-|pov,doorway|any|-|normal
hands on own stomach|雙手貼肚子|pose|tease|pose_hand|all|-|-|-|any|-|normal
sitting on rock|坐在石上|pose|tease|pose_stance|all|-|-|sitting,rock|any|-|normal
ankle grab|抓住腳踝|pose|tease|pose_two|flash|-|pair|-|any|-|normal
watching television|看著電視|pose|activity|act_daily|all|activity|-|television|any|modern|normal
breast poke|戳一下胸|pose|tease|pose_two|flash|-|female,pair|-|female|-|normal
sleeve grab|揪住袖子|pose|tease|pose_act|all|-|pair|clothes grab|any|-|normal
massage|幫人按摩|pose|tease|pose_two|all|-|pair|-|any|-|normal
text messaging|在傳簡訊|pose|activity|act_daily|all|activity|-|cellphone|any|modern|normal
bullying|欺負人|pose|tease|pose_two|all|-|pair|-|any|-|normal
torture|刑求場面|pose|sex|sex_bdsm|sex|-|pair|-|any|-|normal
decapitation|把人斬首|pose|sex|sex_fetish|sex|-|-|guro|any|-|normal
negative space|大片留白|pose|camera|cam_fx|all|-|-|-|any|-|normal
sewing|在縫衣服|pose|activity|act_daily|all|activity|-|sewing needle|any|-|normal
clothes theft|偷走衣服|pose|activity|act_daily|all|-|pair|theft|any|-|normal
prank|跟人惡作劇|pose|tease|pose_two|all|-|pair|-|any|-|normal
kyuudou|日式弓道|pose|activity|act_sport|all|-|-|archery|any|edo,modern|normal
horn grab|揪住角|pose|tease|pose_act|flash|-|-|-|any|-|normal
flapping|撲動著|pose|tease|pose_act|all|-|-|-|any|-|normal
finger sucking|含住手指|pose|tease|pose_hand|all|-|-|-|any|-|normal
dogeza|土下座|pose|body|body|all|body_pose|-|-|any|-|normal
incoming kiss|湊近要親|pose|tease|pose_sign|all|-|-|-|any|-|normal
drowning|人在溺水|pose|activity|act_water|all|activity|-|-|any|-|normal
holding cross|拿著十字|pose|tease|pose_hold|all|-|-|cross|any|-|normal
marriage proposal|向人求婚|pose|tease|pose_two|all|-|pair|-|any|-|normal
mami mogu mogu|麻美大吃|pose|activity|act_daily|all|-|-|eating|any|modern|normal
hunched over|駝著背|pose|tease|pose_stance|all|-|-|-|any|-|normal
smelling clothes|拿衣服聞|pose|tease|pose_act|all|-|-|smelling|any|-|normal
entangled|肢體交纏|pose|tease|pose_two|all|-|pair|-|any|-|normal
surfing|在衝浪|pose|activity|act_sport|all|activity|-|surfboard|any|modern|normal
dodging|身子一閃|pose|tease|pose_act|all|-|-|-|any|-|normal
holding another's foot|托著對方腳|pose|tease|pose_hold|all|-|pair|-|any|-|normal
sitting sideways|側身坐著|pose|tease|pose_stance|all|-|-|sitting|any|-|normal
handshake|互相握手|pose|tease|pose_two|all|-|pair|-|any|-|normal
crushing|壓扁東西|pose|tease|pose_act|all|-|-|-|any|-|normal
holding surfboard|拿著衝浪板|pose|tease|pose_hold|all|-|-|surfboard|any|modern|normal
flat chest grab|抓著平胸|pose|tease|pose_two|flash|-|female,pair|flat chest|female|-|normal
holding map|拿著地圖|pose|tease|pose_hold|all|-|-|map|any|-|normal
grabbing another's ear|揪對方耳朵|pose|tease|pose_two|all|-|pair|hand on another's ear|any|-|normal
flailing|手腳亂揮|pose|tease|pose_act|all|-|-|-|any|-|normal
stomping|用力跺腳|pose|tease|pose_act|all|-|-|-|any|-|normal
chocolate making|製作巧克力|pose|activity|act_daily|all|-|-|cooking,chocolate|any|modern|normal
mtu virus|雙層裙底|pose|camera|cam_fx|flash|-|-|multiple views|any|modern|normal
holding toothbrush|拿著牙刷|pose|tease|pose_hold|all|-|-|toothbrush|any|modern|normal
pushing away|把人推開|pose|tease|pose_two|all|-|pair|pushing|any|-|normal
fist pump|單拳上揮|pose|tease|pose_sign|all|-|-|-|any|-|normal
holding magnifying glass|拿著放大鏡|pose|tease|pose_hold|all|-|-|magnifying glass|any|modern,victorian|normal
baking|在烘焙|pose|activity|act_daily|all|-|-|cooking|any|-|normal
holding key|拿著鑰匙|pose|tease|pose_hold|all|-|-|key|any|-|normal
holding torch|拿著火把|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding newspaper|拿著報紙|pose|tease|pose_hold|all|-|-|newspaper|any|modern,victorian|normal
thumbs down|拇指往下|pose|tease|pose_sign|all|-|-|-|any|-|normal
covering with blanket|用毯蓋上|pose|tease|pose_act|all|-|-|blanket|any|-|normal
cowering|縮著身子|pose|tease|pose_stance|all|-|-|-|any|-|normal
holding bell|拿著鈴鐺|pose|tease|pose_hold|all|-|-|bell|any|-|normal
squeezing|緊緊擠壓|pose|tease|pose_act|all|-|-|-|any|-|normal
watching|盯著看|pose|tease|pose_act|all|-|-|-|any|-|normal
mamemaki|撒豆驅鬼|pose|activity|act_fun|all|activity|-|setsubun|any|edo,modern|normal
grilling|用火烤食|pose|activity|act_daily|all|-|-|cooking|any|-|normal
stacking|往上疊放|pose|tease|pose_act|all|-|-|-|any|-|normal
polearm behind back|長柄藏背後|pose|tease|pose_hold|all|-|-|holding polearm|any|-|normal
stomach growling|肚子在叫|env|effect|fx_comic|all|-|-|-|any|-|normal
reloading|給槍上膛|pose|tease|pose_act|all|-|-|gun|any|modern|normal
sinking|人往下沉|pose|activity|act_water|all|activity|-|-|any|-|normal
buried|被人埋住|pose|tease|pose_situ|all|-|-|-|any|-|normal
holding egg|拿著蛋|pose|tease|pose_hold|all|-|-|-|any|-|normal
suikawari|砸開西瓜|pose|activity|act_fun|all|activity|-|watermelon|any|modern|normal
pov across bed|床對側看|pose|camera|cam_angle|all|-|-|pov,on bed|any|-|normal
cat on lap|腿上有貓|pose|tease|pose_act|all|-|-|animal on lap,cat|any|-|normal
holding spring onion|拿著青蔥|pose|tease|pose_hold|all|-|-|spring onion,holding vegetable|any|modern|normal
cross-body stretch|拉臂伸展|pose|activity|act_sport|all|-|-|stretching|any|-|normal
blocking|用手格擋|pose|tease|pose_act|all|-|-|-|any|-|normal
holding spatula|拿著鍋鏟|pose|tease|pose_hold|all|-|-|spatula|any|modern|normal
interview|在受訪|pose|activity|act_daily|all|activity|pair|-|any|modern|normal
holding binoculars|拿著雙筒鏡|pose|tease|pose_hold|all|-|-|binoculars|any|modern,victorian|normal
tickling sides|撓腰兩側|pose|activity|act_daily|all|-|pair|tickling|any|-|normal
skating|在溜冰|pose|activity|act_sport|all|activity|-|-|any|modern|normal
elbow on knee|手肘抵膝|pose|tease|pose_hand|all|-|-|-|any|-|normal
holding carton|拿著紙盒|pose|tease|pose_hold|all|-|-|-|any|modern|normal
holding torpedo|拿著魚雷|pose|tease|pose_hold|all|-|-|torpedo|any|modern|normal
foot dangle|小腿懸空|pose|tease|pose_stance|all|-|-|-|any|-|normal
immobilization|動彈不得|pose|tease|pose_situ|all|-|-|-|any|-|normal
holding pocky|拿著百奇|pose|tease|pose_hold|all|-|-|pocky,holding food|any|modern|normal
dating|出去約會|pose|tease|pose_situ|all|-|pair|couple|any|modern|normal
licking another's neck|舔著脖子|pose|flash|pose_two|flash|-|pair|licking|any|-|normal
trying on clothes|在試衣服|pose|activity|act_daily|all|-|-|dressing|any|-|normal
special feeling (meme)|特別心情|pose|tease|pose_situ|all|-|pair|couple|any|modern|normal
holding marker|拿著麥克筆|pose|tease|pose_hold|all|-|-|marker|any|modern|normal
hand on another's knee|按住對方膝|pose|tease|pose_two|all|-|pair|-|any|-|normal
nico nico nii|妮可手勢|pose|tease|pose_sign|all|-|-|v|any|modern|normal
swallowing|往下吞|pose|tease|pose_act|all|-|-|-|any|-|normal
holding quill|拿著羽毛筆|pose|tease|pose_hold|all|-|-|quill|any|medieval,victorian|normal
holding notepad|拿著便條本|pose|tease|pose_hold|all|-|-|notepad|any|modern|normal
rolling|在地上滾|pose|tease|pose_act|all|-|-|-|any|-|normal
hands on headphones|雙手按耳機|pose|tease|pose_hand|all|-|-|-|any|-|normal
holding menu|拿著菜單|pose|tease|pose_hold|all|-|-|-|any|modern|normal
dying|瀕死|pose|tease|pose_situ|all|-|-|-|any|-|normal
imitating|模仿別人|pose|tease|pose_act|all|-|-|-|any|-|normal
hand on railing|扶住欄杆|pose|tease|pose_hand|all|-|-|railing|any|-|normal
holding another's head|托著對方頭|pose|tease|pose_two|all|-|pair|-|any|-|normal
rhythmic gymnastics|做韻律操|pose|activity|act_sport|all|-|-|gymnastics|any|modern|normal
blowing smoke|吐出煙|pose|tease|pose_act|all|-|-|smoking|any|modern,edo,victorian|normal
holding scepter|拿著權杖|pose|tease|pose_hold|all|-|-|scepter|any|-|normal
whistling|在吹口哨|pose|tease|pose_act|all|-|-|-|any|-|normal
caramelldansen|跳焦糖舞|pose|activity|act_fun|all|activity|-|-|any|modern|normal
scolding|開口責罵|pose|tease|pose_two|all|-|pair|-|any|-|normal
imminent hug|即將擁抱|pose|tease|pose_two|all|-|pair|-|any|-|normal
incoming punch|拳頭打來|pose|activity|act_sport|all|-|pair|attacking viewer,punching|any|-|normal
holding rope|拿著繩子|pose|tease|pose_hold|all|-|-|-|any|-|normal
holding plant|拿著植物|pose|tease|pose_hold|all|-|-|plant|any|-|normal
dynamic pose|動態姿勢|pose|tease|pose_stance|all|-|-|-|any|-|normal
vomiting|嘔吐|pose|tease|pose_act|all|-|-|-|any|-|normal
arguing|跟人爭吵|pose|tease|pose_two|all|-|pair|-|any|-|normal
knitting|在打毛線|pose|activity|act_daily|all|activity|-|-|any|-|normal
trapped|被人困住|pose|tease|pose_situ|all|-|-|-|any|-|normal
gendou pose|源堂姿勢|pose|tease|pose_hand|all|-|-|own hands clasped|any|-|normal
holding feather|拿著羽毛|pose|tease|pose_hold|all|-|-|-|any|-|normal
bleeding|正在流血|env|effect|fx_fall|all|-|-|-|any|-|normal
power symbol|電源標記|env|other|obj_theme|all|-|-|-|any|-|normal
visible air|可見氣流|env|effect|fx_fall|all|-|-|-|any|-|normal
gym|體育館|env|place|pl_sport|all|place|-|indoors|any|modern|normal
dust cloud|揚起塵土|env|effect|fx_fall|all|-|-|dust|any|-|normal
brick floor|磚地板|env|other|obj_build|all|-|-|-|any|-|normal
galaxy|一片星系|env|sky|sky|all|-|-|-|any|-|normal
storefront|店鋪門口|env|place|pl_shop|all|place|-|outdoors|any|modern|normal
voile|紅魔館書庫|env|place|pl_school|all|-|-|library|any|-|normal
united states|美國場景|env|other|obj_theme|all|-|-|-|any|modern|normal
frozen|凍在冰裡|env|effect|fx_fall|all|-|-|-|any|-|normal
hakurei shrine|博麗神社|env|place|pl_history|all|-|-|shrine|any|edo,modern|normal
soviet|蘇聯|env|other|obj_theme|all|-|-|-|any|modern|normal
japan|日本|env|other|obj_theme|all|-|-|-|any|edo,modern|normal
hanami|賞櫻|env|other|obj_fest|all|-|-|cherry blossoms|any|edo,modern|normal
rei no pool|綾波泳池|env|place|pl_bath|all|-|-|pool|any|modern|normal
digital dissolve|數位溶解|env|effect|fx_comic|all|effect|-|-|any|modern|normal
spoken food|對話食物|env|effect|fx_comic|all|effect|-|-|any|-|normal
storm|暴風雨|env|weather|weather|all|weather|-|-|any|-|normal
glitter|閃粉|env|effect|fx_glow|all|effect|-|-|any|-|normal
rust|鏽蝕|env|other|obj_build|all|-|-|-|any|-|normal
interior|室內空間|env|inout|inout|all|in_out|-|-|any|-|normal
wind turbine|風力發電機|env|other|obj_build|all|-|-|-|any|modern|normal
lane line|車道線|env|other|obj_street|all|-|-|road|any|modern|normal
urinal|小便斗|env|other|obj_furn|all|-|-|-|any|modern|normal
numbers (nanoha)|奈葉魔陣|env|effect|fx_glow|all|-|-|magic circle|any|modern|normal
graduation|畢業典禮|env|other|obj_fest|all|-|-|-|any|modern|normal
meteor shower|流星雨|env|sky|sky|all|-|-|night|any|-|normal
super saiyan 4|超級賽亞人四|env|effect|fx_comic|all|-|-|super saiyan|any|-|normal
originium arts (arknights)|源石技藝|env|effect|fx_glow|all|effect|-|-|any|modern|normal
monochrome background|單色背景|env|background|background|all|background|-|-|any|-|normal
fading|淡出|env|effect|fx_comic|all|effect|-|-|any|-|normal
sixteenth note|十六分音符|env|effect|fx_comic|all|-|-|musical note|any|-|normal
sky lantern|天燈|env|other|obj_fest|all|-|-|-|any|modern,ancient_china|normal
black keys (type-moon)|型月黑鍵|env|other|obj_weapon|all|-|-|-|any|modern|normal
germany|德國場景|env|other|obj_theme|all|-|-|-|any|modern,victorian|normal
beach mat|沙灘墊|env|other|obj_sport|all|-|-|-|any|modern|normal
dawn|黎明|env|time|time|all|day_night|-|-|any|-|normal
spoken expression|對話表情|env|effect|fx_comic|all|effect|-|-|any|-|normal
refraction|折射|env|effect|fx_lens|all|effect|-|-|any|-|normal
fireball|火球|env|effect|fx_glow|all|-|-|fire|any|-|normal
announcement celebration|發表慶祝|env|other|obj_fest|all|-|-|-|any|modern|normal
comiket|同人誌展|env|place|pl_fun|all|place|-|indoors|any|modern|normal
comet|彗星|env|sky|sky|all|-|-|-|any|-|normal
ambiguous red liquid|不明紅液|env|effect|fx_fall|all|effect|-|-|any|-|normal
blood drip|滴血|env|effect|fx_fall|all|effect|-|-|any|-|normal
wreckage|殘骸|env|other|obj_street|all|-|-|-|any|-|normal
bars|鐵柵|env|other|obj_build|all|-|-|-|any|-|normal
booth seating|餐廳卡座|env|other|obj_furn|all|-|-|-|any|modern|normal
tactile paving|導盲磚|env|other|obj_street|all|-|-|-|any|modern|normal
distortion|畫面扭曲|env|effect|fx_lens|all|effect|-|-|any|-|normal
snow globe|雪花球|env|other|obj_hand|all|-|-|-|any|modern|normal
mud|泥濘|env|other|obj_land|all|-|-|-|any|-|normal
hinamatsuri|雛祭|env|other|obj_fest|all|-|-|-|any|edo,modern|normal
senkou hanabi|線香花火|env|effect|fx_glow|all|-|-|sparkler|any|modern|normal
hangar|機庫|env|place|pl_passage|all|place|-|indoors|any|modern|normal
iridescent|虹彩|env|effect|fx_glow|all|-|-|-|any|-|normal
moon phases|月相|env|sky|sky|all|-|-|moon|any|-|normal
spoken zzz|對話打呼|env|effect|fx_comic|all|-|-|zzz|any|-|normal
menacing (jojo)|威脅音效|env|effect|fx_comic|all|effect|-|-|any|-|normal
different shadow|異形影子|env|light|light|all|lighting|-|-|any|-|normal
grid|格子畫面|env|background|background|all|background|-|-|any|-|normal
zero gravity|無重力|env|other|obj_theme|all|-|-|-|any|-|normal
transmission tower|輸電鐵塔|env|other|obj_build|all|-|-|-|any|modern|normal
convertible|敞篷車|env|place|pl_ride|all|place|-|outdoors|any|modern|normal
eclipse|日月食|env|sky|sky|all|-|-|-|any|-|normal
concrete|混凝土|env|other|obj_build|all|-|-|-|any|modern|normal
awning|遮雨棚|env|other|obj_build|all|-|-|-|any|modern|normal
russia|俄羅斯|env|other|obj_theme|all|-|-|-|any|modern,victorian|normal
cracked glass|玻璃裂痕|env|effect|fx_comic|all|-|-|crack|any|-|normal
sports festival|運動會|env|other|obj_fest|all|-|-|outdoors|any|modern|normal
icicle|冰柱|env|other|obj_land|all|-|-|-|any|-|normal
slide|溜滑梯|env|other|obj_sport|all|-|-|-|any|modern|normal
half note|二分音符|env|effect|fx_comic|all|-|-|musical note|any|-|normal
field of blades|滿地劍|env|place|pl_landmark|all|place|-|-|any|modern|normal
squat toilet|蹲式馬桶|env|other|obj_furn|all|-|-|toilet|any|modern|normal
night vision device|夜視器材|env|other|obj_tech|all|-|-|-|any|modern|normal
mechanical parts|機械零件|feature|other|nonhuman|all|-|-|-|any|-|normal
creature and personification|生物與擬人|feature|other|persona|all|-|pair|creature|any|-|normal
monsterification|魔物化|feature|race|race_fantasy|all|race|-|-|any|-|normal
harvin|碧藍小人|feature|race|race_fantasy|all|race|-|-|any|-|normal
psychic|超能力者|feature|other|persona|all|-|-|-|any|-|normal
mascot|吉祥物|feature|other|persona|all|-|-|-|any|-|normal
yordle|約德爾|feature|race|race_fantasy|all|race|-|-|any|-|normal
lalafell|拉拉菲爾|feature|race|race_fantasy|all|race|-|-|any|-|normal
elezen|FF14精靈|feature|race|race_fantasy|all|race|-|-|any|-|normal
native american|美洲原住民|feature|skin|ethnicity|all|ethnicity|-|-|any|-|normal
sheikah|希卡族|feature|race|race_fantasy|all|race|-|-|any|-|normal
undead|不死族|feature|race|race_fantasy|all|race|-|-|any|-|normal
gerudo|格魯德|feature|race|race_fantasy|all|race|-|-|any|-|normal
arachne|蜘蛛人身|feature|race|race_fantasy|all|-|female|taur,monster girl|female|-|normal
clown|小丑|feature|job|job_modern|all|job|-|-|any|modern|normal
zora|卓拉族|feature|race|race_fantasy|all|race|-|fins|any|-|normal
valkyrie|女武神戰士|feature|job|job_classic|all|job|female|-|female|medieval|normal
elvaan|FF11精靈|feature|race|race_fantasy|all|race|-|-|any|-|normal
mummy|木乃伊|feature|race|race_fantasy|all|race|-|-|any|-|normal
ganguro|黑辣妹|feature|other|persona|all|-|female|gyaru,tan|female|modern|normal
jester|弄臣|feature|job|job_classic|all|job|-|-|any|medieval|normal
scylla|斯庫拉|feature|race|race_fantasy|all|race|female|monster girl|female|-|normal
magical boy|魔法少年|feature|other|persona|all|-|male|-|male|modern|normal
pegasus|飛馬|feature|race|race_fantasy|all|race|-|wings|any|-|normal
sukusuku hakutaku|幼白澤|feature|race|race_fantasy|all|race|-|-|any|-|normal
warrior|戰士|feature|job|job_classic|all|job|-|-|any|-|normal
sextuplets|六胞胎|feature|other|relation|all|-|group|siblings|any|-|normal
reptile girl|爬蟲娘|feature|race|race_fantasy|all|race|female|scales|female|-|normal
standard bearer|旗手|feature|job|job_classic|all|job|-|-|any|-|normal
blob|軟泥生物|feature|race|race_fantasy|all|race|-|-|any|-|normal
chuunibyou|中二病|feature|other|persona|all|-|-|-|any|modern|normal
magician|魔術師|feature|job|job_classic|all|job|-|-|any|-|normal
arrancar|破面|feature|race|race_fantasy|all|race|-|-|any|-|normal
military operator|軍方操作員|feature|job|job_modern|all|job|-|military|any|modern|normal
vehicle and personification|載具與擬人|feature|other|persona|all|-|pair|-|any|modern|normal
walker (robot)|行走機甲|feature|race|race_fantasy|all|race|-|mecha|any|modern|normal
body switch|身體對調|feature|other|persona|all|-|pair|-|any|-|normal
female goblin|女哥布林|feature|race|race_fantasy|all|race|female|monster girl|female|-|normal
travel attendant|乘務員|feature|job|job_modern|all|job|-|-|any|modern|normal
pokemon ears|寶可夢耳|feature|other|nonhuman|all|animal_ear|-|animal ears|any|-|normal
wyvern|雙足飛龍|feature|race|race_fantasy|all|-|-|dragon|any|-|normal
covering own ears|遮住自己的耳朵|pose|tease|pose_hand|all|-|-|-|any|-|normal
felyne|艾路貓|feature|race|race_kemono|all|race|-|animal ears|any|-|normal
ainu|阿伊努|feature|skin|ethnicity|all|ethnicity|-|-|any|-|normal
saiyan|賽亞人|feature|race|race_fantasy|all|race|-|-|any|-|normal
exoskeleton|外骨骼|feature|other|nonhuman|all|-|-|-|any|-|normal
scorpion tail|蠍尾|feature|other|nonhuman|all|-|-|tail|any|-|normal
nerv|NERV機關|feature|job|job_modern|all|job|-|-|any|modern|normal
aunt and niece|姑姨與姪女|feature|other|relation|all|-|female,2female,pair|-|any|-|normal
gigantamax|超極巨化|feature|other|persona|all|-|-|-|any|-|normal
uncle and niece|叔舅與姪女|feature|other|relation|all|-|pair,male,female|-|any|-|normal
game boy (original)|初代Game Boy|env|other|obj_tech|all|-|-|-|any|modern|normal
netnavi|網路領航員|feature|race|race_fantasy|all|race|-|-|any|modern|normal
yandere trance|病嬌恍神|pose|face|face_lewd|all|expression|-|yandere|any|-|normal
tied ears|綁住獸耳|feature|other|nonhuman|all|-|-|animal ears|any|-|normal
dullahan|杜拉罕|feature|race|race_fantasy|all|race|-|-|any|medieval|normal
sheet ghost|白布幽靈|feature|race|race_fantasy|all|-|-|ghost|any|modern|normal
fallen angel|墮天使|feature|race|race_fantasy|all|-|-|angel|any|-|normal
shinigami|死神造型|feature|job|job_classic|all|job|-|-|any|edo,modern|normal
seraph|熾天使|feature|race|race_fantasy|all|-|-|angel,multiple wings|any|-|normal
dragon ball (object)|龍珠道具|env|other|obj_hand|all|-|-|-|any|modern|normal
female butler|女管家|feature|job|job_classic|all|job|female|-|female|victorian,modern|normal
japan self-defense force|自衛隊|feature|job|job_modern|all|job|-|military|any|modern|normal
clothed robot|穿衣機器人|feature|race|race_fantasy|all|-|-|robot|any|modern|normal
hume|FF11人族|feature|race|race_fantasy|all|race|-|-|any|-|normal
hirschgeweih antennas|鹿角天線|feature|race|nonhuman|all|-|-|antennae,antlers|any|-|normal
familiar|使魔|feature|other|persona|all|-|-|-|any|-|normal
himejoshi|姬女子|feature|other|persona|all|-|female|-|female|modern|normal
zentradi|傑特拉帝|feature|race|race_fantasy|all|race|-|-|any|modern|normal
bisexual male|雙性戀男|feature|body_m|persona|all|-|male|-|male|-|normal
cowboy|牛仔|feature|job|job_modern|all|job|-|-|any|victorian,modern|normal
kneeless mermaid|無膝人魚|feature|race|race_fantasy|all|-|-|merfolk|any|-|normal
single mechanical hand|單隻機械手|feature|other|nonhuman|all|-|-|-|any|modern,victorian,medieval|normal
blue oni|藍鬼|env|other|obj_theme|all|-|-|-|any|-|normal
housewife|家庭主婦|feature|job|job_modern|all|job|female|-|female|modern|normal
decora|裝飾系穿搭|clothing|fabric|fab_style|all|-|-|-|any|modern|garment
breast curtain|單側髮簾蓋胸|feature|hair_style|hair_detail|all|-|female|-|female|-|normal
full-body tattoo|全身刺青|feature|skin|tattoo|all|-|-|tattoo|any|-|normal
mechanical eye|單眼機械眼|feature|eyes|eye_shape|all|-|-|mechanical eyes|any|-|normal
breast cutout|胸部開洞|clothing|fabric|fab_detail|flash|-|female|-|female|-|garment
headless|無頭|feature|other|nonhuman|all|-|-|-|any|-|normal
stain|污漬|feature|skin|skin_mark|all|-|-|-|any|-|normal
mole on stomach|肚子上的痣|feature|skin|skin_mark|all|-|-|mole|any|-|normal
extra faces|多餘的臉|feature|other|nonhuman|all|-|-|-|any|-|normal
mole on body|身上的痣|feature|skin|skin_mark|all|-|-|mole|any|-|normal
alternate pectoral size|另一種胸肌大小|feature|body_m|bm_build|all|-|male|-|male|-|normal
hair between breasts|髮絲夾乳溝|feature|hair_style|hair_detail|all|-|female|-|female|-|normal
long toenails|長腳趾甲|feature|body_f|body_part|all|-|-|toenails|any|-|normal
intestines|腸子外露|pose|sex|sex_fetish|sex|-|-|guro|any|-|normal
heart (organ)|心臟器官|feature|other|body_part|all|-|-|-|any|-|normal
object on breast|胸口放物品|env|other|obj_theme|all|-|female|-|female|-|normal
tooth|一顆牙|feature|other|mouth_bits|all|-|-|-|any|-|normal
tickling armpits|搔腋下|pose|activity|act_daily|all|-|pair|tickling|any|-|normal
brain|露出大腦|pose|sex|sex_fetish|sex|-|-|guro|any|-|normal
hair over one breast|髮遮單側胸|feature|hair_style|hair_detail|all|-|female|hair over breasts|female|-|normal
butterfly tattoo|蝴蝶刺青|feature|skin|tattoo|all|-|-|tattoo|any|-|normal
flattop|平頂頭|feature|hair_style|hair_shape|all|hair_style|-|-|any|-|normal
oversized forearms|誇大前臂|feature|body_f|body_part|all|-|-|oversized limbs|any|-|normal
inconvenient breasts|礙事的巨乳|feature|body_f|bf_breast|all|-|female|-|female|-|normal
playing with another's hair|玩別人頭髮|pose|tease|pose_two|all|-|pair|-|any|-|normal
blowhole|噴氣孔|feature|other|nonhuman|all|-|-|-|any|-|normal
glands of montgomery|乳暈腺|feature|body_f|bf_intimate|flash|-|female|-|female|-|skin
carried breast rest|被抱著墊胸|pose|tease|pose_two|all|-|pair,female|carrying,breast rest|female|-|normal
stitched torso|軀幹縫線|feature|skin|skin_mark|all|-|-|stitches|any|-|normal
blood on breasts|胸口有血|feature|skin|skin_mark|all|-|female|-|female|-|normal
sharingan|寫輪眼|feature|eyes|eye_shape|all|-|-|-|any|-|normal
widow's peak|美人尖|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
hole on body|身上有洞|feature|other|body_part|all|-|-|-|any|-|normal
missing tooth|缺了一顆牙|feature|other|mouth_bits|all|-|-|teeth|any|-|normal
huge pectorals|超大胸肌|feature|body_m|bm_build|all|-|male|-|male|-|normal
hairstyle switch|髮型切換|feature|hair_style|hair_detail|all|-|-|alternate hairstyle|any|-|normal
grey eyeshadow|灰色眼影|feature|eyes|makeup|all|-|-|eyeshadow|female|-|normal
mutton chops|絡腮鬍|feature|body_m|bm_hair|all|-|male|-|male|-|normal
fever|發燒|pose|face|face_mood|all|-|-|-|any|-|normal
mullet|鯉魚頭|feature|hair_style|hair_shape|all|hair_style|-|-|any|-|normal
burnt|燒焦|feature|skin|skin_mark|all|-|-|-|any|-|normal
quad drills|四捲鑽髮|feature|hair_style|hair_shape|all|-|-|drill hair|any|-|normal
byakugan|白眼瞳|feature|eyes|eye_shape|all|-|-|-|any|-|normal
implied pregnancy|暗示懷孕|feature|body_f|bf_shape|all|-|female|-|female|-|normal
poop|糞便|pose|sex|sex_fetish|sex|-|-|scat|any|-|normal
braces|牙套|feature|other|mouth_bits|all|-|-|teeth|any|modern|normal
mane|鬃毛|feature|hair_style|hair_detail|all|-|-|-|any|-|normal
markings|身體斑紋|feature|skin|skin_mark|all|-|-|-|any|-|normal
kimono pull|拉扯和服|pose|flash|flash_lift|flash|clothes_action|-|kimono|any|edo|normal
newhalf|無陰扶他|feature|sex|bf_intimate|sex|-|female|futanari,no pussy|female|-|normal
tented shirt|襯衫被頂起|pose|flash|flash_expose|flash|-|-|-|any|modern|normal
buruma pull|拉扯體操褲|pose|flash|flash_lift|flash|clothes_action|-|-|any|modern|normal
strap lift|掀起肩帶|pose|flash|flash_lift|flash|-|-|-|any|-|normal
opened by self|自己掀開衣服|pose|flash|flash_lift|flash|clothes_action|-|-|any|-|normal
hoodie lift|掀起連帽衫|pose|flash|flash_lift|flash|-|-|-|any|modern|normal
jacket pull|拉扯夾克|pose|flash|flash_lift|flash|clothes_action|-|-|any|modern|normal
apron lift|掀起圍裙|pose|flash|flash_lift|flash|-|female|-|female|-|normal
skirt flip|翻起裙子|pose|flash|flash_lift|flash|-|female|-|female|-|normal
ero guro|情色獵奇|pose|sex|sex_fetish|sex|-|-|guro|any|-|normal
breast milk|母乳|feature|other|bf_intimate|flash|-|female|lactation|female|-|normal
shared object insertion|共用異物插入|pose|sex|sex_insert|sex|-|pair,female|object insertion|any|-|normal
gesugao|卑劣笑臉|pose|face|face_mood|all|expression|-|-|any|-|normal
wakamezake|裸背倒酒|pose|sex|sex_fetish|sex|-|female|-|female|-|normal
sock pull|拉扯襪子|pose|flash|flash_lift|flash|clothes_action|-|-|any|-|normal
shoujo kitou-chuu|少女祈禱中|pose|sex|sex_touch|sex|-|female|masturbation|female|-|normal
jacket lift|掀起夾克|pose|flash|flash_lift|flash|-|-|-|any|modern|normal
glansjob|龜頭奉仕|pose|sex|sex_oral|sex|sex_act|male,pair|sex|any|-|normal
stained sheets|污漬床單|pose|sex|sex_after|sex|-|-|after sex|any|-|normal
sailor collar lift|掀起水手領|pose|flash|flash_lift|flash|-|-|sailor collar|any|modern|normal
heart-shaped boob challenge|愛心胸挑戰|pose|flash|flash_pose|flash|-|female|-|female|-|normal
crotchless pants|開襠長褲|clothing|bottom|bot_pants|flash|-|-|pants|any|modern|garment
seikan hikou|子宮口插入|pose|sex|sex_insert|sex|sex_act|female|-|female|-|normal
hand over another's mouth|手摀對方的嘴|pose|sex|sex_bdsm|sex|-|pair|covering another's mouth|any|-|normal
vest lift|掀起背心|pose|flash|flash_lift|flash|-|-|-|any|modern|normal
smegma|包皮垢|feature|body_m|bm_penis|sex|-|male|penis|male|-|skin
glove pull|拉扯手套|pose|flash|flash_lift|flash|clothes_action|-|-|any|-|normal
pee stain|尿漬|pose|sex|sex_fetish|sex|-|-|pee|any|-|normal
shaft look|看向莖身|pose|gaze|gaze|flash|-|male|looking at penis|any|-|normal
fine art parody|名畫仿作|quality|style|style_tech|all|-|-|-|any|-|normal
tokusatsu|特攝風|env|other|obj_theme|all|-|-|-|any|modern|normal
tegaki|手繪稿|quality|style|style_tech|all|-|-|-|any|-|normal
faux figurine|假手辦畫風|quality|style|style_tech|all|-|-|-|any|-|normal
alphes (style)|Alphes畫風|quality|style|style_tech|all|-|-|-|any|-|normal
title parody|標題仿作|quality|style|style_tech|all|-|-|-|any|-|normal
zun (style)|ZUN畫風|quality|style|style_tech|all|-|-|-|any|-|normal
logo parody|標誌仿作|quality|style|style_tech|all|-|-|-|any|-|normal
dithering|抖色|quality|style|style_tech|all|-|-|-|any|-|normal
araki hirohiko (style)|荒木飛呂彥畫風|quality|style|style_tech|all|-|-|-|any|-|normal
through medium|隔著媒材|pose|camera|cam_fx|all|-|-|-|any|-|normal
western comics (style)|美漫畫風|quality|style|style_tech|all|-|-|-|any|-|normal
riyo (lyomsnpmp) (style)|Riyo畫風|quality|style|style_tech|all|-|-|-|any|-|normal
k-pop|韓流風|env|other|obj_theme|all|-|-|-|any|modern|normal
1970s (style)|1970s 畫風|quality|style|style_era|all|era_style|-|-|any|-|normal
ligne claire|清線畫風|quality|style|style_tech|all|-|-|-|any|-|normal
visual novel|視覺小說風|quality|style|style_tech|all|-|-|-|any|-|normal
crosshatching|交叉排線|quality|style|style_tech|all|-|-|hatching (texture)|any|-|normal
inktober|墨水月挑戰|quality|style|style_tech|all|-|-|-|any|-|normal
black outline|黑色描邊|quality|style|style_tech|all|-|-|-|any|-|normal
pink outline|粉色描邊|quality|style|style_tech|all|-|-|-|any|-|normal
bkub (style)|bkub畫風|quality|style|style_tech|all|-|-|-|any|-|normal
takeuchi takashi (style)|武內崇畫風|quality|style|style_tech|all|-|-|-|any|-|normal
toriyama akira (style)|鳥山明畫風|quality|style|style_tech|all|-|-|-|any|-|normal
pinup (style)|海報女郎風|quality|style|style_tech|all|-|-|-|any|-|normal
yellow outline|黃色描邊|quality|style|style_tech|all|-|-|-|any|-|normal
ishikei (style)|石惠畫風|quality|style|style_tech|all|-|-|-|any|-|normal
what|問號臉|pose|face|face_mood|all|expression|-|-|any|-|normal
>o<|>o<表情|pose|face|face_mouth|all|expression|-|-|any|-|normal
pursed lips|抿嘴|pose|face|face_mouth|all|-|-|-|any|-|normal
affectionate|親暱|pose|face|face_mood|all|expression|-|-|any|-|normal
misunderstanding|會錯意|pose|face|face_mood|all|expression|-|-|any|-|normal
gao|嗷嗚聲|pose|face|face_mouth|all|-|-|-|any|-|normal
fingersmile|指尖抵笑|pose|tease|pose_hand|all|-|-|-|any|-|normal
nyan|喵聲|pose|face|face_mouth|all|-|-|-|any|-|normal
flying teardrops|飛散淚滴|feature|other|eye_shape|all|-|-|tears|any|-|normal
igote|居高臨下臉|pose|face|face_mood|all|expression|-|-|any|-|normal
depressed|沮喪|pose|face|face_mood|all|expression|-|-|any|-|normal
homu|哼姆聲|pose|face|face_mouth|all|-|-|-|any|-|normal
cross-eyed|鬥雞眼|pose|face|face_eyes|all|-|-|-|any|-|normal
remembering|回想|pose|face|face_mood|all|-|-|-|any|-|normal
;(|;(表情|pose|face|face_eyes|all|-|-|frown,one eye closed|any|-|normal
:c|:c表情|pose|face|face_mouth|all|expression|-|-|any|-|normal
unhappy|不高興|pose|face|face_mood|all|expression|-|-|any|-|normal
mukyuu|悶呼聲|pose|face|face_mouth|all|-|-|-|any|-|normal
tantrum|耍脾氣|pose|face|face_mood|all|expression|-|-|any|-|normal
single tear|單滴淚|feature|other|eye_shape|all|-|-|tears|any|-|normal
curious|好奇|pose|face|face_mood|all|expression|-|-|any|-|normal
charisma break|氣場崩壞|pose|face|face_mood|all|expression|-|-|any|-|normal
iei|咿欸聲|pose|face|face_mouth|all|-|-|-|any|-|normal
:s|:s表情|pose|face|face_mouth|all|expression|-|-|any|-|normal
uu~|嗚嗚聲|pose|face|face_mouth|all|-|-|-|any|-|normal
3others|三個其他角色|subject|extra|cast_mix|all|-|-|-|any|-|normal
6+others|六人以上其他角色|subject|extra|cast_mix|all|-|-|-|any|-|normal
marker (medium)|麥克筆畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
millipen (medium)|代針筆畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
nib pen (medium)|沾水筆畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
ink (medium)|墨水畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
ballpoint pen (medium)|原子筆畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
watercolor pencil (medium)|水彩色鉛筆畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
calligraphy brush (medium)|毛筆畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
pastel (medium)|粉彩畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
oil painting (medium)|油畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
acrylic paint (medium)|壓克力畫|quality|style|style_tech|all|medium|-|traditional media|any|-|normal
mixed media|混合媒材|quality|style|style_tech|all|-|-|-|any|-|normal
border|外框|quality|style|style_tech|all|-|-|-|any|-|normal
grey border|灰色外框|quality|style|style_tech|all|-|-|border|any|-|normal
pink border|粉紅外框|quality|style|style_tech|all|-|-|border|any|-|normal
red border|紅色外框|quality|style|style_tech|all|-|-|border|any|-|normal
blue border|藍色外框|quality|style|style_tech|all|-|-|border|any|-|normal
yellow border|黃色外框|quality|style|style_tech|all|-|-|border|any|-|normal
brown border|棕色外框|quality|style|style_tech|all|-|-|border|any|-|normal
green border|綠色外框|quality|style|style_tech|all|-|-|border|any|-|normal
purple border|紫色外框|quality|style|style_tech|all|-|-|border|any|-|normal
ornate border|華麗外框|quality|style|style_tech|all|-|-|border|any|-|normal
lace border|蕾絲外框|quality|style|style_tech|all|-|-|border|any|-|normal
inset border|小框外框|quality|style|style_tech|all|-|-|-|any|-|normal
4koma|四格漫畫|quality|style|style_tech|all|-|-|comic|any|-|normal
1koma|單格漫畫|quality|style|style_tech|all|-|-|comic|any|-|normal
5koma|五格漫畫|quality|style|style_tech|all|-|-|comic|any|-|normal
multiple 4koma|多篇四格|quality|style|style_tech|all|-|-|4koma|any|-|normal
square 4koma|方形四格|quality|style|style_tech|all|-|-|4koma|any|-|normal
right-to-left comic|右往左漫畫|quality|style|style_tech|all|-|-|comic|any|-|normal
sequential|連續分鏡|quality|style|style_tech|all|-|-|-|any|-|normal
inset|插圖小框|quality|style|style_tech|all|-|-|-|any|-|normal
photo inset|照片小框|quality|style|style_tech|all|-|-|inset|any|-|normal
projected inset|投影小框|quality|style|style_tech|all|-|-|inset|any|-|normal
round image|圓形構圖|quality|style|style_tech|all|-|-|-|any|-|normal
film strip|底片格|quality|style|style_tech|all|-|-|-|any|-|normal
character profile|角色介紹頁|quality|style|style_tech|all|-|-|-|any|-|normal
expressions|表情集|quality|style|style_tech|all|-|-|-|any|-|normal
expression chart|表情表|quality|style|style_tech|all|-|-|expressions|any|-|normal
variations|差分|quality|style|style_tech|all|-|-|-|any|-|normal
color guide|配色指南|quality|style|style_tech|all|-|-|-|any|-|normal
diagram|圖解|quality|style|style_tech|all|-|-|-|any|-|normal
chart|圖表|quality|style|style_tech|all|-|-|-|any|-|normal
how to|教學圖|quality|style|style_tech|all|-|-|-|any|-|normal
noose|絞索|clothing|acc|acc_bind|sex|-|-|-|any|-|accessory
self-harm|自殘|feature|skin|skin_mark|sex|-|-|-|any|-|normal
seishou elementary school uniform|聖祥小學制服|clothing|onepiece|op_uniform|all|onepiece|-|-|female|modern|garment
nami junior high school uniform|奈美國中制服|clothing|onepiece|op_uniform|all|onepiece|-|-|female|modern|garment
kindergarten|幼稚園|env|place|pl_school|tease|place|-|indoors|any|modern|normal
if they mated|假如他們生了孩子|subject|extra|cast_mix|all|-|-|-|any|-|normal
kono lolicon domome|你這蘿莉控|pose|face|face_mood|all|-|-|-|any|-|normal
age regression|返老還童|feature|body_f|bf_shape|all|-|-|-|any|-|normal
lolidom|蘿莉調教|pose|sex|sex_fetish|all|-|-|-|any|-|normal
mesugaki|雌小鬼|feature|body_f|bf_shape|all|-|-|-|female|-|normal
onee-loli|姊姊×蘿莉|subject|extra|cast_mix|all|-|-|-|any|-|normal
onii-shota|哥哥×正太|subject|extra|cast_mix|all|-|-|-|any|-|normal
wheelbarrow pose|推車體位|pose|sex|sex_pos|sex|sex_act|pair,male|sex|any|-|normal
child on child|兒童間性行為|pose|sex|sex_fetish|all|-|-|-|any|-|normal
perversion of games|遊戲變色情|pose|flash|pose_situ|flash|-|-|-|any|-|normal
hanging legs|雙腿懸空|pose|tease|pose_stance|all|-|-|-|any|-|normal
competition|比賽|env|other|obj_theme|all|-|pair|-|any|-|normal
fighting over penis|爭搶陰莖|pose|sex|sex_group|sex|-|pair,group,male|penis|any|-|normal
living fleshlight|活人飛機杯|pose|sex|sex_bdsm|sex|-|pair,male|objectification|any|-|normal
twister (game)|扭扭樂|pose|activity|act_fun|all|-|pair|playing games|any|modern|normal
kissing another during penetration|插入時吻別人|pose|sex|sex_group|sex|-|pair,group|group sex,sex,kiss|any|-|normal
kissing viewer|親向觀眾|pose|tease|pose_act|all|-|-|-|any|-|normal
reverse netorare|逆NTR|pose|tease|pose_situ|all|-|pair,female,male|netorare|any|-|normal
thigh straddling|跨坐大腿|pose|flash|flash_pose|flash|-|pair|straddling|any|-|normal
hand wrapped around waist|大手圈腰|pose|tease|pose_two|all|-|pair|size difference|any|-|normal
unwanted creampie|不願體內射精|pose|sex|sex_cum|sex|-|pair,male|cum|any|-|normal
forced kiss|強吻|pose|sex|sex_bdsm|all|-|pair|kiss|any|-|normal
hand between own legs|手放自己腿間|pose|tease|pose_hand|all|-|-|-|any|-|normal
holding own legs back|自己把腿扳回|pose|flash|flash_pose|flash|-|-|-|any|-|normal
bound thighs|綁住大腿|clothing|acc|acc_bind|all|-|-|-|any|-|accessory
figure four sitting|翹二郎腿|pose|body|body|all|-|-|sitting|any|-|normal
legs bound apart|雙腿綁開|pose|sex|sex_bdsm|sex|-|-|bound,spread legs|any|-|normal
reverse squatting cowgirl position|蹲姿反向騎乘|pose|sex|sex_pos|sex|-|pair,male,female|reverse cowgirl position,squatting,sex|female|-|normal
over the knee|趴在膝上|pose|sex|sex_bdsm|flash|-|pair|-|any|-|normal
footjob with footwear|穿鞋足交|pose|sex|sex_oral|sex|-|pair|-|any|-|normal
panties around thighs|內褲退至大腿|clothing|underwear|uw_bottom|flash|underwear_bottom|-|panty pull|female|modern|garment
sitting split|坐姿劈腿|pose|body|body|all|-|-|split|any|-|normal
v legs|V字開腿|pose|flash|flash_pose|flash|-|-|spread legs|any|-|normal
panties around ankles|內褲退至腳踝|clothing|underwear|uw_bottom|flash|underwear_bottom|-|panty pull|female|modern|garment
frontal thigh sex|正面股交|pose|sex|sex_oral|sex|-|pair,male,female|thigh sex|any|-|normal
legs behind head|雙腿在頭後|pose|flash|flash_pose|flash|-|-|-|any|-|normal
holding party popper|拿著拉炮|pose|tease|pose_hold|all|-|-|party popper|any|modern|normal
snowball fight|打雪仗|pose|activity|act_fun|all|activity|pair|snowball|any|-|normal
birthday party|生日派對|env|other|obj_fest|all|-|pair|birthday,party|any|modern|normal
water fight|打水仗|pose|activity|act_fun|all|activity|pair|-|any|-|normal
pillow fight|打枕頭仗|pose|activity|act_fun|all|activity|pair|pillow|any|-|normal
holding unworn clothes|拿著沒穿的衣服|pose|tease|pose_hold|all|-|-|-|any|-|normal
mind break|精神崩壞|pose|sex|sex_fetish|sex|-|-|-|any|-|normal
anal only|只限肛交|pose|sex|sex_fetish|sex|-|female|-|female|-|normal
condom left inside|套留在體內|pose|sex|sex_after|sex|-|-|condom|any|modern|normal
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

# 正常模式不自己補、只在釘了才出現（也寫在 web/engine.js 的 ODD_MOTIF；test_lexicon_integrity 對兩邊）。
ODD = ["soul gem", "right-over-left kimono", "2others", "multiple others", "homurahara academy school uniform", "champion uniform", "galaxy expedition team survey corps uniform", "st. chronica academy school uniform", "pravda military uniform", "chi-hatan military uniform", "tsab ground military uniform", "kousaka kirino's school uniform", "saunders school uniform", "sainan high school uniform", "shimokitazawa high school uniform", "motosu school uniform", "keizoku school uniform", "amestris military uniform", "bc freedom school uniform", "starlight academy school uniform", "azumanga daioh's school uniform", "stile uniform", "itan private high school uniform", "kin-iro mosaic high school uniform", "hope's peak academy school uniform", "selection university military uniform", "megurigaoka high school uniform", "kafuu chino's school uniform", "kobeya uniform", "akatsuki uniform", "kibina high school uniform", "yuyushiki's school uniform", "tsab air military uniform", "delmogeny uniform", "orange planet uniform", "national shin ooshima school uniform", "kazamatsuri institute high school uniform", "hakuo school uniform", "achiga school uniform", "himeya company uniform", "nudist beach uniform", "st. theresa's girls academy school uniform", "lillian girls' academy school uniform", "kanba girls high school uniform", "yokosuka girls marine high school uniform", "out-of-frame censoring", "futanari pov", "dark persona", "alternate muscle size", "cameo", "corpse", "disembodied head", "flashback", "invisible", "severed head", "severed limb", "team 9", "team skull", "yes", "test plugsuit", "pegasus knight uniform (fire emblem)", "little red riding hood (grimm) (cosplay)", "metamoran vest", "normal suit", "kirisame marisa (cosplay)", "black coat (kingdom hearts)", "kamina shades", "fortified suit", "original race uniform (umamusume)", "morrigan aensland (cosplay)", "gerudo set (zelda)", "different reflection", "rainbow order", "keystone", "card parody", "heart lock (kantai collection)", "variable fighter", "training corps (emblem)", "paralyzer", "duel disk", "z-ring", "qingxin flower", "scouter", "stakes of purgatory", "dream soul", "grimoire of alice", "materia", "ooarai (emblem)", "craft essence (fate)", "lance of longinus (evangelion)", "kanshou & bakuya (fate)", "crescent rose", "keyblade", "saint quartz (fate)", "aegis sword (xenoblade)", "bc freedom (emblem)", "log pose", "clarent (fate)", "gae dearg (fate)", "super mushroom", "hylian shield", "evoker", "madoka runes", "control rod", "hoshi no tsue", "rina-chan board", "myrtenaster", "sakura empire (emblem)", "dragonslayer (sword)", "pravda (emblem)", "impaled", "bullying", "torture", "decapitation", "drowning", "mtu virus", "buried", "immobilization", "special feeling (meme)", "dying", "trapped", "voile", "hakurei shrine", "rei no pool", "numbers (nanoha)", "super saiyan 4", "originium arts (arknights)", "black keys (type-moon)", "comiket", "menacing (jojo)", "field of blades", "harvin", "yordle", "lalafell", "elezen", "sheikah", "gerudo", "zora", "elvaan", "sukusuku hakutaku", "arrancar", "pokemon ears", "felyne", "saiyan", "nerv", "gigantamax", "netnavi", "dragon ball (object)", "japan self-defense force", "hume", "zentradi", "headless", "extra faces", "alternate pectoral size", "intestines", "heart (organ)", "brain", "sharingan", "hole on body", "hairstyle switch", "byakugan", "poop", "ero guro", "wakamezake", "shoujo kitou-chuu", "smegma", "pee stain", "fine art parody", "faux figurine", "alphes (style)", "title parody", "zun (style)", "logo parody", "araki hirohiko (style)", "riyo (lyomsnpmp) (style)", "bkub (style)", "takeuchi takashi (style)", "toriyama akira (style)", "ishikei (style)", "homu", "charisma break", "3others", "6+others", "noose", "self-harm", "living fleshlight", "unwanted creampie", "forced kiss", "mind break"]

NARROW = {"untied bikini": ["flash", "sex"], "upshirt": ["flash", "sex"], "upshorts": ["flash", "sex"], "fishnet bra": ["flash", "sex"], "fishnet leotard": ["flash", "sex"], "fishnet panties": ["flash", "sex"], "fishnet cutout": ["flash", "sex"], "bullet nipple rings": ["sex"], "bikini pull": ["flash", "sex"], "thigh grab": ["flash", "sex"], "presenting removed panties": ["flash", "sex"], "fff threesome": ["sex"], "equine penis": ["sex"], "dark penis": ["sex"], "invisible penis": ["sex"], "knotted penis": ["sex"], "penis tentacle": ["sex"], "no testicles": ["sex"], "erect clitoris": ["sex"], "covered clitoris": ["flash", "sex"], "mole on pussy": ["sex"], "long labia": ["sex"], "dark labia": ["sex"], "artificial vagina": ["sex"], "red pubic hair": ["sex"], "brown pubic hair": ["sex"], "purple pubic hair": ["sex"], "dark areolae": ["flash", "sex"], "small nipples": ["flash", "sex"], "penis grab": ["sex"], "kissing penis": ["sex"], "smelling penis": ["sex"], "licking testicle": ["sex"], "penises touching": ["sex"], "penis on pussy": ["sex"], "penis on head": ["sex"], "penis over one eye": ["sex"], "penis under another's clothes": ["sex"], "penis shadow": ["sex"], "clothed masturbation": ["flash", "sex"], "fingering through clothes": ["sex"], "fingering through panties": ["sex"], "after masturbation": ["sex"], "handjob gesture": ["sex"], "cooperative paizuri": ["sex"], "handsfree paizuri": ["sex"], "paizuri invitation": ["sex"], "ejaculation under clothes": ["sex"], "cum in clothes": ["sex"], "cum on floor": ["sex"], "mutual orgasm": ["sex"], "implied cunnilingus": ["sex"], "presenting pussy": ["sex"], "covered penetration": ["sex"], "covered anus": ["flash", "sex"], "mmm threesome": ["sex"], "futanari pov": ["sex"], "vibrator in thigh strap": ["sex"], "pointless condom": ["sex"], "cock ring": ["sex"], "dry humping": ["sex"], "table humping": ["sex"], "hands on ass": ["flash", "sex"], "naked kimono": ["flash", "sex"], "naked hoodie": ["flash", "sex"], "naked overalls": ["flash", "sex"], "naked scarf": ["flash", "sex"], "naked cloak": ["flash", "sex"], "naked capelet": ["flash", "sex"], "nearly naked apron": ["flash", "sex"], "crotchless pantyhose": ["flash", "sex"], "underbutt": ["flash", "sex"], "panty lift": ["flash", "sex"], "see-through panties": ["flash", "sex"], "see-through swimsuit": ["flash", "sex"], "nipple cutout": ["flash", "sex"], "tape on nipples": ["flash", "sex"], "nippleless clothes": ["flash", "sex"], "implied pantyshot": ["flash", "sex"], "panties under shorts": ["flash", "sex"], "panties over pantyhose": ["flash", "sex"], "panties over garter belt": ["flash", "sex"], "backless panties": ["flash", "sex"], "boyshort panties": ["flash", "sex"], "bear panties": ["flash", "sex"], "heart panties": ["flash", "sex"], "front-print panties": ["flash", "sex"], "arm between legs": ["flash", "sex"], "in heat": ["flash", "sex"], "crotch": ["flash", "sex"], "armpit hair peek": ["flash", "sex"], "corpse": ["sex"], "happy facial": ["sex"], "pants around one leg": ["flash", "sex"], "severed head": ["sex"], "severed limb": ["sex"], "side-tie peek": ["flash", "sex"], "spread navel": ["flash", "sex"], "towel around waist": ["flash", "sex"], "boxer briefs": ["flash", "sex"], "popped button": ["flash", "sex"], "bralines": ["flash", "sex"], "micro bra": ["flash", "sex"], "bust cup": ["flash", "sex"], "camisole lift": ["flash", "sex"], "exploding clothes": ["flash", "sex"], "red male underwear": ["flash", "sex"], "dissolving clothes": ["flash", "sex"], "male underwear peek": ["flash", "sex"], "holding bra": ["flash", "sex"], "fishnet bodysuit": ["flash", "sex"], "translucent": ["flash", "sex"], "frontless outfit": ["flash", "sex"], "orange bra": ["flash", "sex"], "suspenders slip": ["flash", "sex"], "blue male underwear": ["flash", "sex"], "front-tie bra": ["flash", "sex"], "c-string": ["flash", "sex"], "pearl thong": ["flash", "sex"], "translucent bunnysuit": ["flash", "sex"], "grey male underwear": ["flash", "sex"], "food insertion": ["sex"], "presenting armpit": ["flash", "sex"], "impaled": ["sex"], "belly grab": ["flash", "sex"], "presenting foot": ["flash", "sex"], "ankle grab": ["flash", "sex"], "breast poke": ["flash", "sex"], "torture": ["sex"], "decapitation": ["sex"], "horn grab": ["flash", "sex"], "flat chest grab": ["flash", "sex"], "mtu virus": ["flash", "sex"], "licking another's neck": ["flash", "sex"], "breast cutout": ["flash", "sex"], "intestines": ["sex"], "brain": ["sex"], "glands of montgomery": ["flash", "sex"], "poop": ["sex"], "kimono pull": ["flash", "sex"], "newhalf": ["sex"], "tented shirt": ["flash", "sex"], "buruma pull": ["flash", "sex"], "strap lift": ["flash", "sex"], "opened by self": ["flash", "sex"], "hoodie lift": ["flash", "sex"], "jacket pull": ["flash", "sex"], "apron lift": ["flash", "sex"], "skirt flip": ["flash", "sex"], "ero guro": ["sex"], "breast milk": ["flash", "sex"], "shared object insertion": ["sex"], "wakamezake": ["sex"], "sock pull": ["flash", "sex"], "shoujo kitou-chuu": ["sex"], "jacket lift": ["flash", "sex"], "glansjob": ["sex"], "stained sheets": ["sex"], "sailor collar lift": ["flash", "sex"], "heart-shaped boob challenge": ["flash", "sex"], "crotchless pants": ["flash", "sex"], "seikan hikou": ["sex"], "hand over another's mouth": ["sex"], "vest lift": ["flash", "sex"], "smegma": ["sex"], "glove pull": ["flash", "sex"], "pee stain": ["sex"], "shaft look": ["flash", "sex"], "noose": ["sex"], "self-harm": ["sex"], "kindergarten": ["tease"], "wheelbarrow pose": ["sex"], "perversion of games": ["flash", "sex"], "fighting over penis": ["sex"], "living fleshlight": ["sex"], "kissing another during penetration": ["sex"], "thigh straddling": ["flash", "sex"], "unwanted creampie": ["sex"], "holding own legs back": ["flash", "sex"], "legs bound apart": ["sex"], "reverse squatting cowgirl position": ["sex"], "over the knee": ["flash", "sex"], "footjob with footwear": ["sex"], "panties around thighs": ["flash", "sex"], "v legs": ["flash", "sex"], "panties around ankles": ["flash", "sex"], "frontal thigh sex": ["sex"], "legs behind head": ["flash", "sex"], "mind break": ["sex"], "anal only": ["sex"], "condom left inside": ["sex"]}

CLOTHING_STATE_EXTRA = set(["artificial vagina", "backless panties", "bear panties", "blue male underwear", "boxer briefs", "boyshort panties", "bralines", "breast cutout", "bullet nipple rings", "bust cup", "c-string", "cock ring", "crotchless pants", "crotchless pantyhose", "dissolving clothes", "exploding clothes", "fishnet bodysuit", "fishnet bra", "fishnet cutout", "fishnet leotard", "fishnet panties", "front-print panties", "front-tie bra", "frontless outfit", "grey male underwear", "heart panties", "micro bra", "naked capelet", "naked cloak", "naked hoodie", "naked kimono", "naked overalls", "naked scarf", "nearly naked apron", "nipple cutout", "nippleless clothes", "noose", "orange bra", "panties around ankles", "panties around thighs", "panties over garter belt", "panties over pantyhose", "panties under shorts", "pearl thong", "pointless condom", "popped button", "red male underwear", "see-through panties", "see-through swimsuit", "tape on nipples", "towel around waist", "translucent", "translucent bunnysuit", "vibrator in thigh strap"])

ZH_SYNC = {row["tag"]: row["zh"] for row in ROWS}
GROUP_OF = {row["tag"]: row["group"] for row in ROWS}


def extra_sync_20261126_tags():
    return ROWS


def _check() -> None:
    tags = [row["tag"] for row in ROWS]
    if len(tags) != 1753:
        raise SystemExit(f"應為 1753 個字，實際 {len(tags)}")
    if len(tags) != len(set(tags)):
        raise SystemExit("這批有重複的 tag")
    zhs: dict[str, list[str]] = {}
    for row in ROWS:
        zhs.setdefault(row["zh"], []).append(row["tag"])
    collided = {name: owners for name, owners in zhs.items() if len(owners) > 1}
    if collided:
        raise SystemExit(f"這批中文撞名 {collided}")
    known = set(tags)
    for name in (ODD, list(NARROW), CLOTHING_STATE_EXTRA):
        missing = set(name) - known
        if missing:
            raise SystemExit(f"名單有這批沒有的字 {sorted(missing)}")
    by = {row["tag"]: row for row in ROWS}
    for tag, heat in NARROW.items():
        if by[tag]["heat"] != heat:
            raise SystemExit(f"{tag} 的熱度跟 NARROW 不一致")


_check()
