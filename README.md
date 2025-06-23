# RoleCounter - Discord 身分組計數機器人

> 🎯 **自動追蹤Discord身分組人數，即時更新語音頻道顯示**
> 
> 🎨 **新成員歡迎圖片生成，自動發送個人化歡迎訊息**

這個Discord機器人包含兩個主要功能：
1. **身分組計數器** - 追蹤指定身分組的人數，並在語音頻道名稱中顯示
2. **歡迎圖片系統** - 為新加入成員生成個人化歡迎圖片

## 功能特色

### 身分組計數器
- 自動計算身分組成員數量
- 創建鎖定的語音頻道顯示人數
- 支援多個身分組同時追蹤
- Slash commands 方便管理
- 自動更新人數變化
- 可自訂更新間隔

### 歡迎圖片系統
- 自動為新成員生成歡迎圖片
- 圓形頭像處理與背景合成
- 可自訂頭像位置、大小、縮放模式
- 透明區域填充功能
- 支援自訂背景圖片

## 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 設定機器人

**首次執行會自動創建配置檔：**
```bash
npm start
```

機器人會自動創建 `config.json` 並提示你填入必要資訊：

**在 Discord Developer Portal 創建應用程式：**
1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 創建新應用程式 → 進入「Bot」頁面
3. 複製 **Bot Token** 和 **Application ID**
4. 編輯 `config.json` 填入資訊：

```json
{
  "token": "你的機器人token",
  "clientId": "你的應用程式ID",
  "trackedRoles": {},
  "updateInterval": 60000
}
```

### 3. 邀請機器人到伺服器

使用以下權限邀請機器人：
- ✅ **管理頻道** - 創建和修改語音頻道
- ✅ **使用應用程式指令** - 執行 Slash Commands
- ✅ **查看頻道** - 讀取伺服器資訊

### 4. 啟動機器人
```bash
npm start
```

## Slash Commands

### 身分組計數指令
- `/addrole [身分組] [模板]` - 添加要追蹤的身分組（可選自訂名稱模板）
- `/removerole [身分組]` - 移除追蹤的身分組
- `/settemplate [身分組] [模板]` - 設定身分組的頻道名稱模板
- `/listroles` - 列出所有追蹤的身分組及其模板
- `/setinterval [秒數]` - 設定更新間隔（10-3600秒）
- `/updateall` - 立即更新所有頻道

### 歡迎圖片指令
- `/setwelcomechannel [頻道]` - 設定歡迎圖片發送頻道
- `/welcometoggle [啟用/停用]` - 啟用或停用歡迎功能
- `/testwelcome [用戶]` - 測試歡迎圖片功能（可選指定用戶）

## 頻道名稱模板系統

### 可用參數
| 參數 | 說明 | 範例 |
|------|------|------|
| `{count}` | 身分組人數 | `42` |
| `{role}` | 身分組名稱 | `管理員` |
| `{roleid}` | 身分組ID | `123456789` |
| `{guild}` | 伺服器名稱 | `我的伺服器` |

## 使用說明

### 身分組計數器
1. 使用 `/addrole` 添加要追蹤的身分組
2. 機器人會自動創建一個鎖定的語音頻道
3. 頻道名稱格式：`人數 - 身分組名稱`
4. 當成員加入/離開或身分組變更時會自動更新
5. 可以同時追蹤多個身分組

### 歡迎圖片系統
1. 使用 `/setwelcomechannel` 設定歡迎圖片發送頻道
2. 使用 `/welcometoggle enabled:True` 啟用歡迎功能
3. 當新成員加入時，機器人會自動生成並發送歡迎圖片
4. 使用 `/testwelcome` 測試功能是否正常運作

## 配置檔案

### config.json - 主要設定
```json
{
  "token": "你的機器人token",
  "clientId": "你的應用程式ID",
  "trackedRoles": {},  // 追蹤的身分組資料
  "updateInterval": 10000  // 更新間隔(毫秒)
}
```

### welcome-config.json - 歡迎圖片設定
```json
{
  "enabled": true,  // 啟用/停用歡迎功能
  "channelId": "",  // 歡迎圖片發送的頻道ID
  "backgroundPath": "./welcome_background1.png",  // 背景圖片路徑
  "avatarSize": 256,  // 頭像大小 (像素)
  "avatarPosition": { "x": 480, "y": 170 },  // 頭像位置
  "avatarScaleMode": "fixed",  // 縮放模式 [original/fixed/scale]
  "avatarScaleFactor": 1,  // 縮放倍數
  "fillTransparent": true,  // 是否填充透明區域
  "transparentFillColor": "#000000"  // 透明區域填充顏色
}
```

## 重要須知

### ⚠️ 權限要求
- 📋 **用戶權限**：只有具有「管理頻道」權限的用戶可以使用指令
- 🤖 **機器人權限**：需要「管理頻道」和「使用應用程式指令」權限

### 💡 使用提醒
- 🔒 創建的語音頻道會被自動鎖定，防止用戶意外連線
- ⏱️ 建議設定適當的更新間隔（預設60秒）避免API限制
- 📊 支援多伺服器同時使用，各伺服器設定獨立
- 🔄 機器人重啟後會保留所有追蹤設定
- 🎨 歡迎圖片系統需要 Canvas 依賴，請確保已正確安裝

## 支援性

- **Node.js**: >= 16.0.0
- **Discord.js**: ^14.14.1
- **Canvas**: ^2.11.2 (歡迎圖片功能)
- **Axios**: ^1.6.0 (圖片下載功能)
- **更新頻率**: 可調整（10-3600秒）
- **支援**: 多伺服器、多身分組同時追蹤、歡迎圖片生成