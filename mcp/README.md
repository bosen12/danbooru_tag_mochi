# 墨池 MCP（給 AI 用）

讓 Claude（Claude Code、Claude Desktop）、Codex、Grok Build 用墨池的詞庫和抽牌規則，再經墨池生圖。

| 工具 | 做什麼 | 要開墨池嗎 |
|---|---|---|
| `mochi_guide` | 墨池的架構說明（五段、尺度、分級、時代、互斥、建議流程） | 不用 |
| `search_cards` | 中英文查牌（含「胖」「黑絲」「人妻」這類同義詞） | 不用 |
| `explain_card` | 一張牌跟誰互斥、帶出什麼、在哪些尺度／分級／時代才會出現 | 不用 |
| `check_cards` | 一組牌放在一起會怎樣：誰被換掉、誰被擋、原因 | 不用 |
| `draw_prompt` | 照墨池的規則抽提示詞，每張牌標來源（釘選、附帶、隨機）。可以帶份量 `(smile:1.3)` | 不用（套牌組、自製牌、偏好角色時要） |
| `my_cards` | 你在墨池存的牌組、自製牌、卡冊標的偏好角色；抽牌時可以直接套用 | 要 |
| `generate_image` | 經墨池的生圖排程送 ComfyUI，回縮圖和網址；記進作品冊的日誌（來源寫 AI）。AI 自己寫的提示詞會先照墨池補齊 adult、分級字、品質字 | 要（還有 ComfyUI） |
| `fix_image` | 對印好的圖修臉、快速或深度放大（跟成品牆的修臉、Hires 同一條路） | 要（還有 ComfyUI） |
| `image_status` | 接著等還沒畫完的那張 | 要 |
| `list_models`、`recent_images` | 底模與 LoRA、最近印的圖 | 要 |

只開放「查、抽、生圖、修圖」：不刪東西、不改設定、不送 Discord。
沒指定尺度和分級時一律抽全年齡；生圖沒給分級就看提示詞尾巴的 general／sensitive／explicit。
未成年的字、禁用角色（詞庫的 2000 多個，多半年齡不明）一律擋，查牌時也會說明是禁用的。

需要 Node.js 18 以上（墨池本來就要）。下面的路徑換成你電腦上的位置。
墨池不在 `http://127.0.0.1:8796` 的話，加環境變數 `MOCHI_URL`。

## Claude Code

```bash
claude mcp add --scope user mochi -- node C:\projects\danbooru_tag_mochi\mcp\mochi-mcp.mjs
```

## Claude Desktop

設定 → 開發者 → 編輯設定（`%APPDATA%\Claude\claude_desktop_config.json`），加進 `mcpServers`，存檔後重開 Claude Desktop：

```json
{
  "mcpServers": {
    "mochi": {
      "command": "node",
      "args": ["C:\\projects\\danbooru_tag_mochi\\mcp\\mochi-mcp.mjs"]
    }
  }
}
```

## Codex

`~/.codex/config.toml`（Codex App 和 Codex CLI 共用）：

```toml
[mcp_servers.mochi]
command = "node"
args = ['C:\projects\danbooru_tag_mochi\mcp\mochi-mcp.mjs']
# 生圖最多等 50 秒才回；Codex 預設工具 60 秒逾時，夠用。要等更久就調大這個、generate_image 給 wait_seconds。
tool_timeout_sec = 120
```

## Grok Build

```bash
grok mcp add --scope user mochi node -- C:\projects\danbooru_tag_mochi\mcp\mochi-mcp.mjs
```

## 怎麼用

直接用中文講，例如「用墨池抽一張人妻在公園打棒球，全年齡，直圖，然後生圖」。
AI 會先讀 `mochi_guide`、查牌、檢查、抽提示詞，再送去生圖。生圖時墨池頂欄看得到「AI 印製中」，印好的圖在作品冊的「日誌」。

## 測試

```bash
node scripts/test_mochi_mcp.mjs
```

生圖的部分接的是測試自己開的假墨池，不會真的送 ComfyUI。
