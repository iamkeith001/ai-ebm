# ANTIGRAVITY.md — AI EBM 專案駕駛艙

## 專案定位

「AI EBM 實證醫學智慧助理與分析平台」— 三軍總醫院臨床病理科的 EBM 工作台展示系統。
純靜態前端（無後端、無建置流程），整合五大模組：

1. 總覽 Dashboard
2. PICO 檢索式生成
3. CASP 文獻評讀
4. GRADE 證據合成
5. EBM 臨床報告

## 檔案結構

| 檔案 | 說明 |
|------|------|
| `index.html` | 單頁應用主體，sidebar + 五個 tab 版面 |
| `app.js` | 全部互動邏輯（tab 切換、表單、模擬 AI 輸出） |
| `styles.css` | 全站樣式 |
| `ebm_system_introduction_slides.docx` | 系統介紹簡報素材（不入版控可再議） |

## 開發約定

- 語言：繁體中文（zh-TW），醫學術語保留英文原文（PICO、CASP、GRADE）
- 無框架、無打包工具；直接開 `index.html` 或 `python3 -m http.server` 預覽
- 外部依賴僅 FontAwesome CDN；新增依賴前先確認離線展示需求
- 不放任何 API 金鑰進前端；若未來接真 AI 後端，金鑰走 `.env`（已在 .gitignore）

## 第二大腦

專案區：`secondbrain/projects/AI EBM/`
每日進度寫入 `secondbrain/每日筆記/YYYY-MM-DD.md`
