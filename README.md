# AI-ready 實證醫學智慧輔助平台

三軍總醫院臨床病理科 — 以詞庫、規則、PubMed 與人工審定流程，協助臨床人員完成可追溯 EBM 決策的一站式工作台。

## 平台定位

本系統是 **AI-ready** 的臨床工作流：目前提供可解釋的詞庫／規則式輔助與 PubMed 資料串接，並保留未來接入具來源約束之 AI copilot 的介面空間。

系統不將規則式結果偽稱為生成式 AI，也不自動代替臨床人員形成評讀、GRADE 推薦或醫療建議。

## 功能模組

- **總覽 Dashboard**：各模組入口與狀態摘要
- **PICO 檢索式生成**：以臨床詞庫輔助結構化 PICO，並產生可編修的檢索式
- **CASP 文獻評讀**：以 CASP 檢核表記錄逐題判定與理由；不將 CASP 轉為數值品質分數
- **GRADE 與 EtD**：由評讀者調整 certainty，並以 Evidence-to-Decision（EtD）另行形成推薦
- **EBM 臨床報告**：整合 PICO、證據來源、CASP、GRADE 與 SDM；未完成必要資料時不得複製至 EMR

## 使用方式

純靜態網頁，無需安裝：

```bash
# 直接開啟
open index.html

# 或起本地伺服器
python3 -m http.server 8000
```

## 技術

HTML / CSS / Vanilla JavaScript，僅依賴 FontAwesome CDN 圖示。PICO 與摘要結構辨識為本機規則／詞庫輔助，並非連接生成式 AI。

## 臨床安全守門

- 自由輸入的臨床問題不會自動套用教學範例。
- 必須提供證據來源與摘要、完成每個 CASP 判定及理由，才能評定 GRADE certainty。
- 臨床推薦必須完整填寫 EtD 並由評讀者明確選定；系統不會由 certainty 自動推論推薦。
- 病人溝通內容須由臨床人員撰寫或審定；系統不提供硬編碼療效或安全性聲明。
