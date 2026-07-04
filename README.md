# AI EBM 實證醫學智慧助理與分析平台

三軍總醫院臨床病理科 — AI 輔助實證醫學（Evidence-Based Medicine）一站式工作台。

## 功能模組

- **總覽 Dashboard**：各模組入口與狀態摘要
- **PICO 檢索式生成**：結構化萃取臨床問題（Patient / Intervention / Comparison / Outcome）並產生檢索式
- **CASP 文獻評讀**：依 CASP 2026 checklist 進行文獻品質評讀
- **GRADE 證據合成**：實證證據等級評估
- **EBM 臨床報告**：整合前述模組輸出臨床報告

## 使用方式

純靜態網頁，無需安裝：

```bash
# 直接開啟
open index.html

# 或起本地伺服器
python3 -m http.server 8000
```

## 技術

HTML / CSS / Vanilla JavaScript，僅依賴 FontAwesome CDN 圖示。
