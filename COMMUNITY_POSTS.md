# Community post drafts

These drafts describe the latest main branch, which includes readiness fixes after the existing public v1.0 tag. The [cross-platform and browser CI](https://github.com/bosen12/danbooru_tag_mochi/actions/runs/37798386690) passed; review the verification record before posting. The repository and card-art download were verified accessible. These drafts have not been posted.

下方文案對應已推送、跨平台與瀏覽器 CI 通過的最新 main；既有 v1.0 標籤尚未包含這批改動。文案尚未發到社群。

## English

Title: Mochi — compose Danbooru prompts with illustrated cards, then generate in local ComfyUI

I'm bosen12, the creator of Mochi, a GPLv3 open-source card workbench for WAI / Illustrious-style image generation. Pick and pin the elements you want; a rules engine fills in the rest. Send the composition to your own ComfyUI, compare variations and save works with their cards.

It has English and Traditional Chinese UI, a layered composition view, a card book and a gallery. It runs locally. You'll need Python 3.9+, ComfyUI and an SDXL checkpoint; no frontend build step. Optional LoRA Manager installation/patching asks first. The demo uses General content level; the tool also supports adult content levels.

One-minute live demo and install instructions: https://github.com/bosen12/danbooru_tag_mochi

This is a preview. I'd like feedback from ComfyUI users, especially on first-time setup and whether the card approach helps you explore combinations. If something fails, please include your OS, ComfyUI version and GPU in a GitHub issue.

## 繁體中文

標題：墨池 Mochi 開源預覽：用插畫卡牌組 Danbooru 提示詞，送到本機 ComfyUI 生圖

我是 bosen12，Mochi 的原作者，這次以 GPLv3 開源發布。它把 Danbooru tags 變成可以挑選的插畫卡牌。固定你想要的元素，剩下交給規則引擎補齊，再送進自己的 ComfyUI。也能在疊印台比較組合，把成品與使用的牌一起收藏。

有繁體中文／英文介面、卡冊與作品冊，本機執行。需要 Python 3.9+、ComfyUI 和 SDXL 底模，適合 WAI／Illustrious 系列；LoRA Manager 的選用安裝與修補會先詢問。示範使用全年齡分級，工具也支援成人內容分級。

一分鐘實機影片、原始碼與安裝方式：https://github.com/bosen12/danbooru_tag_mochi

目前是預覽版，想找 ComfyUI 使用者試用，特別希望知道第一次安裝順不順，以及卡牌操作是否有助於探索提示詞。問題請開 GitHub issue，附系統、ComfyUI 版本與顯卡資訊。

## Posting assets and follow-up

Use `.github/mochi-demo.mp4` with `.github/mochi-demo-poster.jpg` and the existing General-level screenshots. Lead with pin → draw → generate → save. Link Mochi as the main install destination and describe Random as its upstream project. Check each community's current posting rules before publishing. Reply to installation reports with the issue link so fixes remain discoverable.
