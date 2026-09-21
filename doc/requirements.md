# Project Requirements

本文件依 `.clinerules/requirement_tracking.md` 持續更新：記錄 user story、需求、以及 Requirement Traceability Matrix (RTM)。

---

## 📖 User Stories

- 2026-09-17 ｜ As a **developer / operator**, I want **to run the existing Base44 app (chronos-flow-chunwo) locally on my own machine while still using the original Base44 LLM**, so that **I can iterate on the app locally without the UI, prompts, model or workflow changing at all**.

---

## 📝 Requirements

### Entry — 2026-09-17：chronos-flow-chunwo 本地版（保留原 base44 LLM）

**User Story**
As a **developer**, I want **a local version of chronos-flow-chunwo that keeps talking to the original Base44 backend (LLM included)**, so that **I can run and iterate on my machine with zero behavioural change**.

**Functional Requirements**
- FR-101：前端必須能在本機（Vite dev server）啟動並提供完整功能（Gantt 檢視、匯入、比對、合併、匯出、意見回饋）。
- FR-102：所有後端呼叫（`integrations.Core.InvokeLLM` / `UploadFile` / `SendEmail`、`functions.invoke`、`auth.*`）必須送往原本的 Base44 後端 `https://chronos-flow-chunwo.base44.app/api`（appId `6a38f8c8aae6ce8a8b2b1096`），即 **直接沿用原本 base44 的 LLM**。
- FR-103：LLM 呼叫參數（`prompt`、`file_urls`、`response_json_schema`、`model` 如 `gemini_3_1_pro`）與呼叫位置必須與原版完全相同。
- FR-104：認證沿用 API Documentation 的 `Authorization: Bearer <PERSONAL_ACCESS_TOKEN>`；token 只以官方既有機制帶入（URL 參數 `access_token`，由 `src/lib/app-params.js` 存入 localStorage 並自網址移除）。
- FR-105：dev server 埠必須讀取 workspace 根目錄 `.env` 的 `FRONTEND_PORT`（不硬編碼、不使用埠+1）。

**Non-Functional Requirements**
- NFR-101：`src/**` 的所有應用程式碼（UI、流程、提示詞、模型參數、預設設定）不得變更。
- NFR-102：`strictPort` 必須開啟；埠被佔用時直接失敗，不可自動遞增。
- NFR-103：啟動/停止一律透過 `scripts/start-local.bat`、`scripts/stop-local.bat`，不直接呼叫 `npm run dev`。

**Constraints**
- C-101：`.env`（root）為不可變更檔，`FRONTEND_PORT`、`BACKEND_PORT`、`VITE_BACKEND_URL` 不得修改。
- C-102：`devops/**` 與 Docker 設定不在本次範圍。
- C-103：專案路徑含 `&`（`P6 Reader & Converter`），在 Windows/cmd 下會破壞 npm 的 `.bin` postinstall 腳本，因此依賴安裝需 `--ignore-scripts`。
- C-104：LLM 費用仍計入原 Base44 App 的額度（不在本地執行模型）。

**Acceptance Criteria**
- AC-101：`GET http://localhost:15156/api/apps/public/prod/public-settings/by-id/6a38f8c8aae6ce8a8b2b1096` 在本機回傳 JSON（證明 `/api` 已代理到原 base44 後端）。
- AC-102：頁面載入後功能列與原版一致（無缺失元件、無白屏）。
- AC-103：匯入 PDF/圖片時，瀏覽器 Network 出現 `POST /api/apps/6a38f8c8aae6ce8a8b2b1096/integration-endpoints/Core/InvokeLLM` 且成功回應。
- AC-104：`git diff` 中 `src/**` 沒有任何變更。

---

## 📊 Requirement Traceability Matrix (RTM)

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-101 | 本機啟動完整前端功能 | `Baes44/chronos-flow-chunwo`（Vite dev server on 15156） | 本地版本（2026-09-17） | Verified |
| FR-102 | 後端呼叫導向原 base44 API（含 LLM） | `@base44/vite-plugin` 的 `VITE_BASE44_APP_BASE_URL` 代理 | 本地版本（2026-09-17） | Verified |
| FR-103 | LLM 參數/呼叫點不變 | `src/components/gantt/*`、`src/lib/*` | 本地版本（2026-09-17） | Verified（未修改） |
| FR-104 | PAT 帶入方式 | `src/lib/app-params.js` + `access_token` URL 參數 | 本地版本（2026-09-17） | Optional（實測匿名即可呼叫 LLM） |
| FR-105 | 埠由 workspace `.env` 決定 | `vite.config.js`（`loadEnv` + `strictPort`） | 本地版本（2026-09-17） | Complete |
| NFR-101 | `src/**` 零變更 | 全部應用程式碼 | 本地版本（2026-09-17） | Verified |
| NFR-102 | 埠衝突時直接失敗 | `vite.config.js`（`strictPort: true`） | 本地版本（2026-09-17） | Complete |
| NFR-103 | 只用 scripts 啟停 | `scripts/start-local.bat`、`scripts/stop-local.bat` | 本地版本（2026-09-17） | Complete |
| C-101 | root `.env` 不可變更 | `.env` | 本地版本（2026-09-17） | Verified（未修改） |
| C-103 | 路徑含 `&` 的安裝限制 | `npm install --ignore-scripts`、腳本改用 `node node_modules\vite\bin\vite.js` | 本地版本（2026-09-17） | Complete |
| C-104 | LLM 額度仍計入原 App | Base44 平台 | 本地版本（2026-09-17） | Accepted |
| AC-101 | 本機 `/api` 代理回傳 JSON | dev proxy | 本地版本（2026-09-17） | Verified |
| AC-102 | 介面與原版一致 | `src/pages/GanttPage.jsx` | 本地版本（2026-09-17） | Verified（模組層級，瀏覽器目視待確認） |
| AC-103 | InvokeLLM 端點成功 | `Core/InvokeLLM` | 本地版本（2026-09-17） | Verified |
| AC-104 | `src/**` 無 diff | git（此 workspace 非 git repo，改以時間戳驗證） | 本地版本（2026-09-17） | Verified |

---

## 🗂 變更紀錄（本地化）

| 檔案 | 變更 | 類型 |
|------|------|------|
| `Baes44/chronos-flow-chunwo/.env.local` | 新增 `VITE_BASE44_APP_ID`、`VITE_BASE44_APP_BASE_URL`（指向原 base44 後端） | 新增 |
| `Baes44/chronos-flow-chunwo/vite.config.js` | 加入 `loadEnv` 讀 workspace `.env` 的 `FRONTEND_PORT` + `strictPort`（其餘選項原樣保留） | 最小修改 |
| `Baes44/chronos-flow-chunwo/scripts/start-local.bat` | 讀 `.env` 取得埠、檢查佔用、啟動 dev server | 新增 |
| `Baes44/chronos-flow-chunwo/scripts/stop-local.bat` | 釋放該埠 | 新增 |
| `src/**` | 無任何變更 | — |

---

## 📝 Requirements（追加 3）

### Entry — 2026-09-17：參考 XER Viewer 的 Gantt Settings 進行功能改善

**User Story**
As an **operator**, I want **the Gantt display settings to cover what other P6 viewers offer (date format, gridlines, bar appearance, print setup)** so that **the printed/exported programme is presentation-ready without manual editing**.

**參考來源（實測）**
- <https://www.xerviewer.org/> 主 bundle `/assets/index-zfbWkdqs.js`（1,999 KB）內的 Gantt Settings 面板 schema 已抽出，分頁為：**WBS / Activity List / Timeline & Grid / Gantt Bars / Customise Grouping**。
- 其設定鍵（節錄）：`timelineDisplayMode`、`enableTimelineAutoModeSwitch`、`dateFormat`、
  `horizontalGridLines` / `verticalGridLines` / `majorHorizontalGridLines` / `majorVerticalGridLines` / `minorVerticalGridLines`（各含 `visible` / `color` / `weight` / `lineStyle`）`dataDateLine`、
  `rowHeight` / `fontFamily` / `fontSize` / `fontWeight`、
  `taskBarHeightPx` / `taskBarShape` / `taskBarColor` / `milestoneColor` / `milestoneShape`、
  `showTaskNamesOnBars` / `showTaskStartDateOnBars` / `showTaskFinishDateOnBars` / `taskNameFontSizePx`、
  `actualBar*` / `remainingBar*` / `criticalBar*` / `levelOfEffortBar*` / `wbsSummaryBar*`（color / border / corner / gradient）、`barShadow*`、
  `selectedPresetId`（Primavera Classic、Modern Rounded、Classic Square、Sharp Geometric、Professional Gray、Sunny Orange Rounded、Remaining Only）、
  `paperSizeValue`（A3 / A4）/ `orientation` / `margins` / `headerHeight` / `footerHeight` / `pageHeaderFooter` / `printTaskColumns` / `printDayCellWidth` / `scaleToFitWidth`、
  `groupHeaderHorizontalGridLines` / `groupHeaderVerticalGridLines`、`Customise Grouping`（WBS grouping on/off）。

**現有 vs 缺口（本專案）**

| XER Viewer 設定 | 本專案現況 | 缺口 |
|-----------------|-----------|------|
| Date Format（4 種） | 固定 `YYYY-MM-DD` | 無 |
| Row Gridlines / Group Header Gridlines（顯示、顏色、線型） | 固定 1px 實線 | 無 |
| Row Height / Font Family / Font Weight | 僅字級滑桿（`tableFontScale`） | 部分 |
| Timeline scale（Year / Y-M / M-W / M-D / W-D + auto） | Month / Week / Day（3 級） | 部分 |
| Bar Height / Shape / Corner / Border / Shadow | 固定 | 無 |
| Bar 上顯示名稱 / 開始 / 完成（畫面） | 僅 PDF `barLabel`（none/item/id/activity） | 無（畫面） |
| Critical Bar / Level-of-Effort / WBS Summary Bar 樣式 | 僅 baseline / delay / custom 顏色 | 部分 |
| 外觀 Presets（Primavera Classic 等 7 組） | 只有欄位預設（ViewPresets） | 無 |
| Print / PDF：紙張（A3/A4）、方向、邊界、頁首頁尾、要印欄位 | A3 橫向固定 + fitOnePage + 標題/公司/日期範圍 | 部分 |
| Grouping / Collapse to level / Styled group headers | 有區段（section）與收合，但無層級收合 | 部分 |
| Global vs Selected formatting、Clear text styles | 有 per-task 長條色 + Bulk Edit | 部分 |

**Functional Requirements（提案，尚未實作）**
- FR-401：日期格式可選（`YYYY-MM-DD` / `DD/MM/YYYY` / `MM/DD/YYYY` / `DD-MMM-YY`），套用於表格與 PDF。
- FR-402：PDF 可選紙張（A3 / A4）、方向（橫 / 直）、頁邊距、頁首頁尾文字與要列印的欄位。
- FR-403：網格線設定（表格水平／垂直、群組標題線、時間軸主要／次要線）：顯示、顏色、線寬、線型。
- FR-404：長條外觀設定（高度、圓角、邊框類型/顏色/寬度、里程碑形狀、陰影）與外觀 Presets。
- FR-405：畫面 Gantt 長條上顯示名稱／開始／完成日期（字級、顏色），與 PDF 的 `barLabel` 對齊。
- FR-406：WBS／區段「收合到第 N 層」、「全部展開／收合」與群組標題樣式。
- FR-407：Critical 長條樣式（依 Total Float ≤ 0 判定）。

**Non-Functional Requirements**
- NFR-401：全部為**新增選項**；不改變現有預設外觀與操作流程（預設值＝現行行為）。
- NFR-402：設定需持久化（沿用 localStorage 模式）。
- NFR-403：不得影響 XER / XML / Excel 匯出與 P6 往返相容性。

**Acceptance Criteria**
- AC-401：切換日期格式後，表格與 PDF 同步變更。
- AC-402：PDF 可輸出 A4 橫向，且內容不裁切。
- AC-403：關閉網格線後，表格與時間軸僅保留外框。
- AC-404：套用 `Primavera Classic` preset 後，長條顏色/圓角/邊框符合該 preset 定義。
- AC-405：預設值狀態下，畫面與修改前完全一致（回歸比對）。

### Requirement Traceability Matrix (RTM) — 追加 3

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-401 | 日期格式可選（表格＋PDF） | `UnifiedGanttLayout` / `exportGanttPDF` | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| FR-402 | PDF 紙張/方向/邊界/頁首頁尾/欄位 | `ExportDialog` / `exportGanttPDF` | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| FR-403 | 網格線設定（顯示/顏色/線寬/線型） | `UnifiedGanttLayout` | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| FR-404 | 長條外觀設定 + 外觀 Presets | `UnifiedGanttLayout` / 新 `BarStyleSettings` | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| FR-405 | 畫面上 bar 名稱/日期標籤 | `UnifiedGanttLayout` | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| FR-406 | 收合到層級 / 展開收合 / 群組標題樣式 | `UnifiedGanttLayout` | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| FR-407 | Critical 長條樣式 | `UnifiedGanttLayout` | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| NFR-401 | 預設＝現行行為，零回歸 | 全部 | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| NFR-402 | 設定持久化 | localStorage | XER Viewer Gantt Settings（2026-09-17） | Proposed |
| NFR-403 | 不影響 P6/XER 匯出 | `exportXER.js` 等 | XER Viewer Gantt Settings（2026-09-17） | Proposed |

---

## 🐞 修正 — 畫面空白（2026-09-17，由批次 1 引入）

**Root Cause（兩個 JavaScript TDZ / 作用域錯誤）**
1. `UnifiedGanttLayout.jsx`：`timelineGridLines` 的 `useMemo` 被放在 `topRow` 宣告**之前** → 渲染時 `ReferenceError: Cannot access 'topRow' before initialization`。
2. `UnifiedGanttLayout.jsx`：模組層元件 `function C(...)` 使用了**元件內**的 `BD_COL` → 渲染時 `ReferenceError: BD_COL is not defined`。
   → 修正：把 `timelineGridLines` 移到 `topRow` 之後；`C` 改用 CSS 變數 `var(--gantt-col-border, 1px solid #d1d5db)`，由根節點 `style={{ "--gantt-col-border": BD_COL }}` 提供（免改 50 個呼叫點）。
3. 併同修掉潛在的第三個同類問題：`startTimelineResize` 的依賴陣列引用 `resolvedViewMode`（宣告在後）→ 改用 `resolvedViewModeRef`。

**新增防護：SSR 煙霧測試 `__smoke.mjs`**
以 Vite `ssrLoadModule` + `react-dom/server` 真實渲染元件（含 window/localStorage shim），一次驗證 8 個情境：

```
SMOKE TEST RESULTS
  UnifiedGanttLayout (displaySettings=null): OK (20608 chars)
  UnifiedGanttLayout (displaySettings=default): OK (20608 chars)
  UnifiedGanttLayout (timeScale=auto): OK (44736 chars)
  UnifiedGanttLayout (timeScale=year): OK (20310 chars)
  UnifiedGanttLayout (timeScale=month): OK (20608 chars)
  UnifiedGanttLayout (timeScale=week): OK (22989 chars)
  UnifiedGanttLayout (timeScale=day): OK (44736 chars)
  UnifiedGanttLayout (timeScale=weekDay): OK (40861 chars)
```
（此測試正是抓出 `BD_COL is not defined` 的工具；批次 3 結束後會移除或移到 `scripts/`。）

---

## 🕒 追加 4 — Time Scale 時間尺度模式（對應 XER Viewer「Timeline & Grid」）

`UnifiedGanttLayout.jsx` 新增 `TIME_SCALES`（6 種）與 `resolveTimeScale()`；`GanttPage.jsx` 原本的 Month／Week／Day 三選下拉改為 **Time Scale** 六選：

| 模式 | 第一列（分組） | 欄位 | 欄寬預設 |
|------|---------------|------|---------|
| **Auto** | 依工期自動 | 依工期自動 | — |
| **Year** | 年 | 年 | 160 |
| **Year - Month** | 年 | 月（MMM yy） | 60 |
| **Month - Week** | 月（MMM yy） | 週（MM/dd） | 40 |
| **Month - Day** | 月（MMM yy） | 日（dd） | 24 |
| **Week - Day** | 週（dd MMM） | 日（dd） | 32 |

**Auto 規則**（`resolveTimeScale`）：>550 天 → Year；>130 → Year-Month；>45 → Month-Week；>21 → Month-Day；否則 Week-Day。

**Requirement Traceability**

| Requirement ID | Requirement Description | Feature/Module | Status |
|---|---|---|---|
| FR-408 | Time Scale 6 種模式（含 Auto） | `UnifiedGanttLayout` / `GanttPage` | Complete |
| FR-409 | 日期格式選項（DD/MM/YYYY 等，表格＋PDF） | `displaySettings` / `exportGanttPDF` | Complete（批次 1） |
| NFR-404 | 新增 SSR 煙霧測試防止白屏回歸 | `__smoke.mjs` | Complete |
| AC-406 | 6 種時間尺度皆能正常渲染 | SSR 煙霧測試 | Verified |

---

## ✅ 批次 2 完成報告（2026-09-17）— 長條外觀 · 標籤 · Critical · Gantt Settings 齒輪面板

**狀態：FR-404 / FR-405 / FR-407 → Complete & Verified。**

### 新增檔案
| 檔案 | 內容 |
|------|------|
| `src/components/gantt/GanttSettingsPanel.jsx` | **Gantt Settings 齒輪面板**（右側抽屜，4 分頁）：**Bars** / **Labels** / **Grid & Format** / **Timeline**。所有值寫回 `displaySettings`（與畫面、PDF 共用同一份設定） |

### 修改檔案
| 檔案 | 變更 |
|------|------|
| `src/lib/displaySettings.js` | 新增 `bar` 設定區塊（高度、圓角、邊框寬/色/線型、Baseline/Delay 顏色、里程碑形狀與大小、陰影、Critical、標籤）、`BAR_PRESETS`（7 組：Current / Primavera Classic / Modern Rounded / Classic Square / Sharp Geometric / Professional Gray / Sunny Orange Rounded）、`BAR_LABEL_FIELDS`、`MILESTONE_SHAPES`、`mergeDisplaySettings()` |
| `src/components/gantt/UnifiedGanttLayout.jsx` | 長條依設定渲染：高度、圓角、邊框（實/虛/點）、陰影、Baseline/Delay 顏色、里程碑形狀（菱形/方形/圓形）與大小、**Critical 上色（Total Float ≤ 0）**、bar 標籤（Item / ID / 名稱 / 開始 / 完成 / 工期，可選位置 inside/right、字級、顏色、最小寬度）。新增模組層 `MileShape` 元件（props-only，避免作用域錯誤） |
| `src/lib/exportGanttPDF.js` | PDF 長條同步套用：`bar.heightPx`（換算列高比例）、圓角（`roundedRect`）、邊框（含虛線）、Baseline/Delay/Critical 顏色、里程碑形狀（菱形/方形/圓形）、Legend 色塊同步 |
| `src/components/gantt/ExportDialog.jsx` | 匯出時傳遞 `bar: ds.bar` 給 PDF |
| `src/pages/GanttPage.jsx` | 工具列新增 **Gantt Settings** 齒輪按鈕（`Settings` icon）＋面板掛載 |

### 驗收證據

**(1) SSR 煙霧測試（11 項全過）**
```
UnifiedGanttLayout (displaySettings=null/default):        OK
UnifiedGanttLayout (timeScale=auto/year/month/week/day/weekDay): OK
UnifiedGanttLayout (all bar options on):                  OK (20853 chars)
UnifiedGanttLayout (milestone + critical):                OK (25224 chars)
GanttSettingsPanel (bars tab):                            OK (8275 chars)
```

**(2) PDF 實測（Node + jsPDF，6 個情境）**
```
[w_default]      page=420x297mm fills=16 strokes=227 curves=8
[w_sunny_circle] page=420x297mm fills=15 strokes=225 curves=20   ← 圓角 8 + 圓形里程碑
[w_square_mile]  page=420x297mm fills=15 strokes=224 curves=0    ← 圓角 0 + 方形里程碑
[w_diamond_mile] page=420x297mm fills=16 strokes=227 curves=8
[w_a4_bars]      page=297x210mm fills=16 strokes=119 curves=8    ← A4 + 長條設定
[w_pdf_colours]  page=420x297mm
```
PDF 顏色（解碼 `rg` 運算子）：
```
w_default      -> #3b82f6 (Baseline) #22c55e (Delay) #7c3aed (BL)
w_sunny_circle -> #f59e0b (Preset 橘) #fb923c (Delay) #ef4444 (Critical 紅)
w_pdf_colours  -> #2980b9 (自訂 PDF 藍) #22c55e
```

### 行為變更說明（預設值）
- 預設外觀與修改前**一致**：高度 18px、圓角 2px、無邊框/陰影、Baseline `#3b82f6`、Delay `#22c55e`、里程碑菱形 8px、標籤顯示 Item（與原本 `pos.width>50 && !hasComp` 條件相同）、Critical 預設關閉。
- PDF 的長條顏色改由同一份設定驅動（預設 `#3b82f6`，原本為 `#2980b9`）→ PDF 與畫面現在完全同色。
- **PDF 不支援陰影**（jsPDF 無陰影 API）：陰影僅套用於畫面。

**Requirement Traceability**

| Requirement ID | Requirement Description | Feature/Module | Status |
|---|---|---|---|
| FR-404 | 長條外觀設定 + 外觀 Preset | `displaySettings` / `UnifiedGanttLayout` / `GanttSettingsPanel` | Complete |
| FR-405 | 畫面 bar 標籤（欄位/位置/字級/顏色） | `UnifiedGanttLayout` / `GanttSettingsPanel` | Complete |
| FR-407 | Critical 長條（Total Float ≤ 0） | `UnifiedGanttLayout` / `exportGanttPDF` | Complete |
| FR-410 | 影像／列印同步（PDF 套用長條設定） | `exportGanttPDF` | Complete |
| AC-407 | 11 項 SSR 煙霧測試通過 | `__smoke.mjs` | Verified |
| AC-408 | PDF 顏色/圓角/里程碑形状可驗證 | Node + jsPDF 實測 | Verified |

---

## ✅ 批次 3 完成報告（2026-09-17）— 結構（收合／群組樣式）· 焦點模式 · 清除選取

**狀態：FR-406 / FR-411 / FR-412 → Complete & Verified。**

### 功能
| 功能 | 位置 | 說明 |
|------|------|------|
| **收合／展開單一 programme** | 區段列左側的 ▸ / ▾ 箭頭 | 點箭頭切換；收合後該 programme 的活動不顯示，右側區段名稱會加 ▸ 提示 |
| **全部展開 / 全部收合** | Gantt Settings → **Structure** 分頁 | 收合時顯示「N collapsed」數量 |
| **群組標題樣式** | Gantt Settings → Structure | 字級（10–14px）、字重（Semibold/Bold/Extra bold）、縮排（0–40px）、藍／粉 programme 的底色與文字色 |
| **Focus mode（前後關係聚焦）** | Gantt Settings → Structure | 勾選後，只高亮「選取活動的前置＋後續鏈」（`buildRelationshipMap` 遞迴展開），其餘淡化（可調 10–90% 不透明度） |
| **Clear selection** | Display 選單（選取時顯示）＋ **Esc** 鍵 | 一鍵清除選取（輸入框聚焦時 Esc 不會誤觸） |

### 修改檔案
| 檔案 | 變更 |
|------|------|
| `src/lib/displaySettings.js` | 新增 `group`（群組標題樣式）與 `focus`（焦點模式）設定、`GROUP_FONT_SIZES` / `GROUP_FONT_WEIGHTS`、`mergeDisplaySettings` 同步合併 |
| `src/components/gantt/UnifiedGanttLayout.jsx` | 新增 `displayTasks`（收合後實際渲染的列）並套用到兩個面板的列、階梯線、關係線、SVG 高度、區段索引；區段列加 ▸/▾ 切換鈕；群組標題依設定渲染；Focus mode 遞迴關係運算 + 淡化；Esc 清除選取。收合狀態可外部傳入（props）或使用內部狀態 |
| `src/pages/GanttPage.jsx` | 提升 `collapsedIds` 狀態與處理器、傳給版面與設定面板；Display 選單新增 Clear selection |
| `src/components/gantt/GanttSettingsPanel.jsx` | 新增第 5 個分頁 **Structure**；`initialTab` 參數（供測試用） |
| `scripts/smoke-test.mjs` | 由專案根目錄移入 `scripts/`（SSR 回歸測試工具，17 項情境） |

### 驗收證據（SSR 煙霧測試，17 項全過）
```
UnifiedGanttLayout (null / default):            OK (21206)
UnifiedGanttLayout (timeScale=auto/year/month/week/day/weekDay): OK
UnifiedGanttLayout (all bar options on):        OK (21401)
UnifiedGanttLayout (milestone + critical):      OK (25264)
UnifiedGanttLayout (collapsed sections):        OK (14321)   ← 列真的被移除（21,206 → 14,321）
UnifiedGanttLayout (focus mode on):             OK (47091)
GanttSettingsPanel (bars/labels/grid/timeline/structure tabs): OK
```
（執行方式：`cd Baes44/chronos-flow-chunwo && node scripts/smoke-test.mjs`）

### 行為變更說明（預設值）
- 預設**沒有**任何收合、Focus mode 關閉、群組標題樣式＝原本外觀（藍 `#bfdbfe`/`#1e3a8a`、粉 `#fce7f3`/`#9d174d`、12px、粗體、無縮排）。
- 收合是「檢視狀態」，不影響任何匯出（PDF／XER／XML／Excel 仍輸出全部活動）。

**Requirement Traceability**

| Requirement ID | Requirement Description | Feature/Module | Status |
|---|---|---|---|
| FR-406 | 收合到層級／展開收合／群組標題樣式 | `UnifiedGanttLayout` / `GanttPage` / `GanttSettingsPanel` | Complete |
| FR-411 | Focus mode（前後關係鏈高亮 + 淡化其餘） | `UnifiedGanttLayout`（`buildRelationshipMap`） | Complete |
| FR-412 | Clear selection（選單 + Esc） | `UnifiedGanttLayout` / `GanttPage` | Complete |
| NFR-405 | 收合不影響匯出結果 | `exportGanttPDF` / `exportXER` 等 | Verified |
| AC-409 | 收合後渲染列數正確減少 | SSR 煙霧測試（21206 → 14321） | Verified |
| AC-410 | 5 個設定分頁皆可渲染 | SSR 煙霧測試 | Verified |

---

## 📌 三批總覽（2026-09-17）

| 批次 | 內容 | 狀態 |
|------|------|------|
| 1 | PDF 紙張（A3/A4）· 方向 · 邊界 · 頁尾、日期格式、網格線設定、Time Scale 六模式 | ✅ Verified |
| 2 | 長條外觀（高度/圓角/邊框/陰影/顏色/里程碑形狀）、7 組外觀 Preset、Bar 標籤、Critical 高亮、Gantt Settings 齒輪面板；PDF 同步套用 | ✅ Verified |
| 3 | 收合／展開 programme、群組標題樣式、Focus mode（前後關係鏈）、Clear selection | ✅ Verified |

**尚未採用（XER Viewer 有、本專案尚未實作，如有需要可再開批次 4）**：Resource View／資源直方圖（S-curve）、DCMA 14 點排程檢查、Monte Carlo 風險分析、Band（拖曳框選）選取、歷史紀錄（File History）、多專案同時開啟。




---

## ✅ 批次 1 完成報告（2026-09-17）— 列印與閱讀性

**狀態：FR-401 / FR-402 / FR-403 → Complete & Verified；FR-404～407 待做（批次 2 / 3）。**

### 新增檔案
| 檔案 | 內容 |
|------|------|
| `src/lib/displaySettings.js` | 共用顯示設定（日期格式、五組網格線：row / col / group / timeline major / timeline minor，各含 visible / color / weight / style）、`loadDisplaySettings` / `saveDisplaySettings`（localStorage `gantt_display_settings`）、`formatDisplayDate`、`cssGridBorder`、`pdfDashPattern`、`hexToRgbArray` |

### 修改檔案
| 檔案 | 變更 |
|------|------|
| `src/lib/exportGanttPDF.js` | 新增 `paperSize`（a3/a4）、`orientation`、`margin`、`footerLeft/Center/Right`（支援 `{page}` / `{pages}`）、`grid`、`dateFormat`；列線／群組線／時間軸線改用設定值（支援實線/虛線/點線與顏色、線寬）；日期欄位依 `dateFormat` 輸出；頁尾與頁面保留區計算；版面保護（時間軸最少 80mm，超量欄位自動縮至 30%，仍不足時省略末端欄位並 `console.warn`） |
| `src/components/gantt/ExportDialog.jsx` | PDF 面板新增 **Page Setup**（紙張／方向／頁邊距／頁尾三段文字）與 **Grid & Date Format**（日期格式、五組線開關、顏色/線寬/線型）；page setup 以 localStorage `gantt_pdf_page_setup` 記憶 |
| `src/components/gantt/UnifiedGanttLayout.jsx` | 表格列線、欄分隔線、群組標題線、時間軸年/月直線改由設定驅動（新增絕對定位網格層，z-index 1，不遮擋長條）；`blStart` / `blEnd` 及所有唯讀日期欄位套用 `dateFormat` |
| `src/pages/GanttPage.jsx` | 新增 `displaySettings` 狀態（持久化）並傳給 `UnifiedGanttLayout` 與 `ExportDialog`；Display 選單新增 **Grid & Date Format** 區塊（日期格式 + 5 個開關） |

### 驗收證據（Node + jsPDF 實測，10 個情境）
```
[v_A3_default]  page=420x297mm bytes=14375 fullMonths=4 ISO=true
[v_A4_land]     page=297x210mm bytes=14343 fullMonths=4 ISO=true
[v_A4_portrait] page=210x297mm bytes=11901 fullMonths=4 ISO=true
[v_ddMMyyyy]    ISO=false dd/MM=true        ← 日期格式生效
[v_ddMMMyy]     ISO=false dd-MMM=true       ← 日期格式生效
[v_footer]      footer=true （Chun Wo / Page 1 of …）  ← 頁尾生效
[v_grid_off]    bytes=11090（-23%）          ← 關閉網格線生效
[v_margin20]    page=420x297mm bytes=14378   ← 頁邊距生效
[v_all_extras]  53 欄全開 bytes=30930 fullMonths=4 ← 時間軸未被壓扁
```
另：五個模組經 Vite dev server transform 全部 200（`GanttPage` 224KB、`UnifiedGanttLayout` 464KB、`ExportDialog` 320KB、`exportGanttPDF` 216KB、`displaySettings` 21KB），dev server stderr 無錯誤。

### 行為變更說明（預設值）
- 螢幕：**不變**（列線／欄線／時間軸線預設外觀與原本一致）。
- PDF 新增：**欄分隔線**（預設開啟，與螢幕一致；可於 Grid & Date Format 關閉）+ 頁尾（預設空白＝不畫）。
- 時間軸「年線 / 月線」預設與原本 PDF 的月線相同（#dcdcdc / 0.4mm）。



---

## 📝 Requirements（追加 2）

### Entry — 2026-09-17：修正 Export P6 XER 的檔案結構（每表 `%E`）

**User Story**
As an **operator**, I want **the exported .xer to be structurally identical to a real P6 export** so that **I can import it into Primavera P6 without errors**.

**Root Cause（實測定位）**
- `src/lib/exportXER.js` 在每張表之後寫入的是**空白行**（`lines.push("")`），整份檔案只在結尾寫一個 `%E`。真實 P6 XER 是**每張表以 `%E` 結束**且**完全沒有空白行**。
- 本專案自己的 `src/lib/parseXER.js` 只讀 `%T / %F / %R`（`%E` 被註解為 end of file），所以 App 內「匯出→匯入」往返正常，掩蓋了此問題。
- 另一個獨立問題（本次未修，見 FR-303）：`P6 Version` 目前只改 ERMHDR 的版本字串，欄位集完全沒有隨版本改變。

**Functional Requirements**
- FR-301：每一張表都必須以 `%E` 作為結束標記，且表格與表格之間不得出現空白行。
- FR-302：輸出行為不得改變任何資料內容（欄位集、欄位順序、日期格式、ID 對應、欄位值全部維持原樣）。
- FR-303（未修，另案追蹤）：`P6 Version` 應輸出對應版本的 ERMHDR 與欄位集。

**Non-Functional Requirements**
- NFR-301：App 自身的 `parseXER()` 仍必須能讀取自己的匯出檔（往返不中斷）。
- NFR-302：檔案結尾需保留結尾換行（與真實匯出檔一致）。

**Acceptance Criteria**
- AC-301：匯出檔的表數 = `%E` 數，且無任何空白行。（13 表 / 13 `%E` / 0 空白行）
- AC-302：PyP6Xer 1.16.0 能成功解析（修正前為 `IndexError` 崩潰）。
- AC-303：`xer-parser` 2.1.0 解析 + `validate()` 無 error/warn。
- AC-304：`parseXER()` 往返仍能得到相同活動數與日期。

### Requirement Traceability Matrix (RTM) — 追加 2

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-301 | 每表 `%E`、無空白行 | `src/lib/exportXER.js`（13 處表結束 + 檔尾組裝） | XER 可匯入 P6（2026-09-17） | Complete |
| FR-302 | 資料內容零變更 | 同上（僅改表結束標記與檔尾） | XER 可匯入 P6（2026-09-17） | Verified |
| FR-303 | 版本對應的欄位集 | `exportXER.js` / `ExportXERDialog.jsx` | XER 可匯入 P6（2026-09-17） | Pending（使用者選擇先不處理） |
| NFR-301 | 自家 parser 往返不中斷 | `src/lib/parseXER.js` | XER 可匯入 P6（2026-09-17） | Verified |
| NFR-302 | 保留結尾換行 | `exportXER.js` | XER 可匯入 P6（2026-09-17） | Complete |
| AC-301 | 表數 = `%E` 數、無空白行 | 結構檢查腳本 | XER 可匯入 P6（2026-09-17） | Verified |
| AC-302 | PyP6Xer 可解析 | PyP6Xer 1.16.0 | XER 可匯入 P6（2026-09-17） | Verified |
| AC-303 | xer-parser 驗證通過 | xer-parser 2.1.0 | XER 可匯入 P6（2026-09-17） | Verified |
| AC-304 | parseXER 往返一致 | `src/lib/parseXER.js` | XER 可匯入 P6（2026-09-17） | Verified |
| AC-305 | 在真實 P6 匯入成功 | Primavera P6（需使用者實測） | XER 可匯入 P6（2026-09-17） | 待使用者驗證 |

**驗收證據（修正後，2026-09-17）**

```
結構：13 tables / 13 %E / 0 blank lines / unterminated tables: none / endsWith("\r\n%E\r\n")

PyP6Xer 1.16.0（修正前 IndexError 崩潰）
  fixed_15.1.xer  -> OK | projects: ['PROJ001'] | activities: 3 | codes: ['A1010','A1020','A1030']
  fixed_20.12.xer -> OK | projects: ['PROJ001'] | activities: 3 | codes: ['A1010','A1020','A1030']

xer-parser 2.1.0（parse + validate）
  fixed_15.1.xer  -> version=15.1 tables=13 projects=1 tasks=3 wbs=3 calendars=1 validate=0 (no issues)
  fixed_20.12.xer -> version=20.12 tables=13 projects=1 tasks=3 wbs=3 calendars=1 validate=0 (no issues)

自家往返（parseXER）
  fixed_15.1.xer -> 3 activities, 2 sections
  A1010/Excavation/2025-01-06->2025-01-20 ; A1020/Piling/2025-02-03->2025-03-10 ; A1030/Pile Cap/2025-03-11->2025-04-05
```

**仍未解決（需留意）**
- AC-305：必須在真實 Primavera P6 實際 Import 才能最終確認（本次無法代測）。
- FR-303：`P6 Version` 下拉目前只改 ERMHDR 字串；UI 下方「v20+ includes create_date / update_date fields」的描述與實作不符。
- ERMHDR 的欄位組成（末欄為 `USD` 而非貨幣全名）、`CALENDAR.clndr_data` 自訂字串、空的 `UDFTYPE / TASKPRED / TASKRSRC / TASKACTV / UDFVALUE` 表，是否被各版本 P6 接受仍未知。


---

## 📝 Requirements（追加）

### Entry — 2026-09-17：PDF 匯出需依「已選擇顯示的欄目」輸出

**User Story**
As an **operator**, I want **the PDF export to contain exactly the columns I have chosen to display** so that **the printed programme matches what I see on screen instead of expanding every field**.

**Root Cause（已定位）**
`GanttPage` 在 localStorage 沒有 `gantt_column_visibility` 時，`columnVisibility` 初始值為 **`null`**（畫面由 `UnifiedGanttLayout` 的 `INIT_VISIBILITY` 自行套用預設）。但 `exportGanttPDF` 遇到 `columnVisibility == null` 時走的是「**除了 blStart/blEnd/remainDur/float/pct 以外全部顯示**」的 fallback，且 `EXTRA_FIELDS` 只涵蓋 19 個可用欄位中的一部分、順序固定不依 `position`。

**Functional Requirements**
- FR-201：PDF 匯出的欄位集合必須與畫面上表格完全相同（同一套 `visible !== false` 判定）。
- FR-202：`columnVisibility` 為 `null` 時，PDF 必須沿用畫面預設（`INIT_VISIBILITY`：僅核心欄位，所有額外欄位隱藏），不得擴張全部欄位。
- FR-203：PDF 支援所有可選的額外欄位（共 47 個），使用者勾選即輸出。
- FR-204：PDF 欄位順序必須依使用者的 `position`（拖曳排序）排列。
- FR-205：使用者勾選大量欄位時，時間軸必須保留最小可用寬度（不得被壓成 0）。

**Non-Functional Requirements**
- NFR-201：不改動既有 PDF 視覺（字型、欄寬、分頁、里程碑、比較長條、頁首頁尾）。
- NFR-202：未勾選的欄位不得出現在 PDF 中。

**Acceptance Criteria**
- AC-201：`columnVisibility = null` → PDF 只有 Item/ID/Activity/Start/End/Dur。
- AC-202：勾選 BL Start、Early Start、Calendar、GUID 並取消 Duration → PDF 只出現這 4 個額外欄位。
- AC-203：只顯示 Activity → PDF 只有 Activity 欄。
- AC-204：全部欄位開啟 → 所有欄位出現且時間軸仍有月份刻度。

### Requirement Traceability Matrix (RTM) — 追加

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-201 | PDF 欄位集合＝畫面表格 | `src/lib/exportGanttPDF.js`（`isFieldVisible`） | PDF 依所選欄目（2026-09-17） | Verified |
| FR-202 | null 時沿用畫面預設 | `exportGanttPDF.js`（`CORE_DEFAULT_VISIBLE`） | PDF 依所選欄目（2026-09-17） | Verified |
| FR-203 | 支援全部 47 個可選欄位 | `exportGanttPDF.js`（`EXTRA_FIELDS`） | PDF 依所選欄目（2026-09-17） | Verified |
| FR-204 | 依 `position` 排序 | `exportGanttPDF.js`（`fieldPosition` / `sortedExtraFields`） | PDF 依所選欄目（2026-09-17） | Verified |
| FR-205 | 大量欄位時保留時間軸 | `exportGanttPDF.js`（`extraScale` / `MIN_GANTT_W`） | PDF 依所選欄目（2026-09-17） | Verified |
| NFR-201 | 既有 PDF 視覺不變 | 同上（僅動欄位選擇邏輯） | PDF 依所選欄目（2026-09-17） | Verified |
| AC-201 | null → 僅核心欄位 | 離線 jsPDF 實測 | PDF 依所選欄目（2026-09-17） | Verified |
| AC-202 | 勾選 4 欄、取消 Duration | 離線 jsPDF 實測 | PDF 依所選欄目（2026-09-17） | Verified |
| AC-203 | 只顯示 Activity | 離線 jsPDF 實測 | PDF 依所選欄目（2026-09-17） | Verified |
| AC-204 | 全開仍保留時間軸 | 離線 jsPDF 實測 | PDF 依所選欄目（2026-09-17） | Verified |

**驗收方式（可重現）**：以 Node 直接載入 `exportGanttPDF`（暫存副本，把 `@/lib/hkWorkingDays` 改為相對路徑、`doc.save()` 改寫成 `fs.writeFileSync`），用五種 `columnVisibility` 情境各輸出一份 PDF，再檢查 PDF 內文字串與時間軸月份刻度：

| 情境 | 結果 |
|------|------|
| A `columnVisibility = null` | 只出現 `Item`、`ID`；所有額外欄位皆無；時間軸 4 個月刻度 |
| B 畫面預設（core 可見、其餘隱藏） | 同 A |
| C 勾選 BL Start / Early Start / Calendar / GUID、取消 Duration | 只出現這 4 個額外欄位（其餘如 Float、Rem.Dur、Act.Labor 皆無） |
| D 只顯示 Activity | `Item` 不出現、所有額外欄位不出現 |
| E 56 欄全開 | 全部欄位出現，且時間軸仍有 4 個月刻度（`extraScale` 壓縮生效） |

（註：探針 `ID` 會誤中 PDF trailer 的 `/ID`、`Dur(WD)` 因括號轉義偵測不到，皆為量測誤差，非程式問題。）


---

## ✅ 驗收證據（2026-09-17 實測）

**啟動輸出（`scripts\start-local.bat`）**
```
[start-local] FRONTEND_PORT=15156
[start-local] starting vite ...
[base44] Proxy enabled: /api -> https://chronos-flow-chunwo.base44.app
```

**本機 `/api` 代理（AC-101）**
```
GET  http://localhost:15156/api/apps/public/prod/public-settings/by-id/6a38f8c8aae6ce8a8b2b1096
→ 200 {"id":"6a38f8c8aae6ce8a8b2b1096","public_settings":"public_without_login"}
```

**原本 base44 的 LLM（AC-103）— 經本機代理，匿名即可**
```
POST http://localhost:15156/api/apps/6a38f8c8aae6ce8a8b2b1096/integration-endpoints/Core/InvokeLLM
     {"prompt":"Say: local ok"}
→ 200 "local ok"

POST http://localhost:15156/api/apps/6a38f8c8aae6ce8a8b2b1096/functions/fetchHKHolidays  {}
→ 200 {"holidays":["2017-01-01", ... ]}   （真實香港假期資料）
```

**模組編譯（AC-102，模組層級）**
```
/src/main.jsx                           → 200
/src/App.jsx                            → 200
/src/api/base44Client.js                → 200
/src/pages/GanttPage.jsx                → 200 (212 KB)
/src/components/gantt/UnifiedGanttLayout.jsx → 200 (455 KB)
/src/components/gantt/ImageImportDialog.jsx  → 200 (335 KB)
dev server stderr → 僅 browserslist 資料較舊的提醒，無錯誤
```

**啟停腳本實測（NFR-103）**
```
scripts\stop-local.bat   → [stop-local] Killing PID 29872 listening on port 15156
scripts\start-local.bat  → [start-local] FRONTEND_PORT=15156 → 15156 LISTENING (PID 42144)
```

**`src/**` 未被修改（NFR-101 / AC-104）**
```
src 目錄最新 LastWriteTime = 2026-09-17 15:23:39
本次變更檔案（vite.config.js 等）LastWriteTime ≥ 15:58
→ 應用程式碼完全未動
```

---

## ▶️ 操作方式

**啟動**（在 cmd.exe 內執行，勿直接呼叫 `npm run dev`）
```
Baes44\chronos-flow-chunwo\scripts\start-local.bat
```
**停止**
```
Baes44\chronos-flow-chunwo\scripts\stop-local.bat
```
**開啟**：<http://localhost:15156>

**一鍵按鈕（桌面捷徑）— 2026-09-21 重建**
```
（桌面）啟動 P6 Reader.lnk   → 呼叫 workspace `scripts\start-all.bat`（批次 14 改；原本指向 App 的 start-local.bat）
（桌面）停止 P6 Reader.lnk   → 呼叫 workspace `scripts\stop-all.bat`（批次 14 改；原本指向 App 的 stop-local.bat）
P6 Reader & Converter\start-local - 捷徑.lnk（專案根目錄原本那一顆，仍指 App 的 start-local.bat）
```
> 捷徑只負責呼叫腳本；埠號一律由腳本讀 workspace 根目錄 `.env` 的 `FRONTEND_PORT`（目前 15156），捷徑內不含任何埠號或參數。
> ⚠️ 命名限制：本機 ACP = 950（Big5），`IShellLink.Save()` 對 ACP 無法表示的字元會失敗 ——「啓」(U+5553) 不在 Big5 內，故一律使用標準繁體「啟」(U+555F)。

**scripts\ 服務腳本（2026-09-21 對齊 AGENTS.md 與 py-workflow-PST Viewer 專案的作法）**
```
scripts\start-all.bat       啟動本 App（預設只起前端）；加 START_BACKEND=1 才一併啟動本地 FastAPI scaffold
scripts\start-frontend.bat  只啟動前端（＝本 App），內部委派 Baes44\chronos-flow-chunwo\scripts\start-local.bat
scripts\start-backend.bat   只啟動本地 FastAPI（uv sync → uv run uvicorn，刻意不加 --reload）
scripts\stop-all.bat        依 .env 埠停止全部服務（只殺 LISTENING 的行程，不動其他專案）
scripts\status.bat          服務狀態（前端 / 後端 / SQLite / Base44 雲端 / 埠）
（macOS / Linux 對應檔：同名 .sh，例如 bash scripts/start-all.sh）
```
- 所有腳本都從 **workspace 根目錄 `.env`** 讀埠（目前 `FRONTEND_PORT=15156`、`BACKEND_PORT=25156`）：**不硬編、不用埠+1**（AGENTS.md 埠衝突規則）。
- **本地後端是 opt-in（預設不起）**：`scripts\start-all.bat` 只起本 App。要本地 FastAPI 時用 `set START_BACKEND=1 && scripts\start-all.bat`，或直接執行 `scripts\start-backend.bat`（舊旗標 `set SKIP_BACKEND=1` 仍有效＝強制略過）。後端失敗只印 WARNING，不影響前端（本 App 走 Base44 雲端 API，`src/**` 內沒有任何 `25156`／`VITE_BACKEND_URL` 字樣）。
- 前端一律經 App 自己的 `start-local.bat` 啟動（`npm run dev` 不可用：路徑含 `&`）；後端刻意不加 `--reload`，讓 `stop-all.bat` 能乾淨收尾（不會殘留 reloader）。
- 桌面「啟動 / 停止 P6 Reader」兩顆捷徑即分別呼叫 `scripts\start-all.bat` 與 `scripts\stop-all.bat`。
- **就緒後自動開啟 App 頁面**：`start-all.bat` 在確認前端埠 LISTENING 後，用預設瀏覽器開啟 `http://localhost:<FRONTEND_PORT>/`（本 App 是單頁應用，所有工具都在這一頁）。不想自動開：`set NO_BROWSER=1 && scripts\start-all.bat`；要多開其他頁面：`set OPEN_URLS=http://localhost:25156/docs https://...`（空白分隔）。`start-frontend.bat` 只在 App 已在回應時才開，避免與 `start-all.bat` 開兩次。
- **專案管理（選擇專案／上傳／存檔）需要本地後端**：這三顆按鈕把專案與版本存到 `backend/db/pyworkflow.db`（SQLite），前端經 Vite proxy `/local-api` → `http://localhost:<BACKEND_PORT>/projects` 呼叫。使用前先啓動後端（`set START_BACKEND=1 && scripts\start-all.bat` 或 `scripts\start-backend.bat`）；後端沒開時按鈕會顯示提示，App 其餘功能（Gantt、匯入、匯出、Base44 LLM）完全不受影響。
- **設定面板（2026-09-21 起，批次 18）**：header 只有一顆 **Settings** 按鈕 → 右側面板＋左側分類軌（**WBS / Activity List / Timeline & Grid / Gantt Bars / Other**），可拖左緣調整寬度。原本的「Gantt Settings」「WBS Settings」按鈕與「Display」下拉已全部整合進去（Display 的功能在 **Other** 分頁）。
- **Customise Grouping（批次 19／19.1）**：設定面板 ▸ **WBS** 分頁 → `Group By`（WBS）／ `To Level`（`All Levels`・`Level 1`-`Level N`，**N ＝ 載入檔案實際最深 WBS 層級**）／ `Status`（眼睛開關），以及依參考站維持停用的 `+ Add New Grouping Header`。`To Level` 只改變「WBS 群組標題顯示到第幾層」（活動列內容與順序不受影響）；面板下方會顯示各層群組數量與目前顯示／隱藏的群組標題數，因此切換層級時看得到差異。`Status` 關閉＝隱藏全部 WBS 群組標題（平面活動清單），此時 `To Level` 會被鎖住。
- **Quick Filters（批次 20／20.1／21）**：header 搜尋框右側的**漏斗圖示按鈕**（右上角徽章顯示使用中條件數）＝**唯一的篩選入口**（`Tools ▸ P6 Filters` 已於批次 21 移除）。選單由上而下為：**`Last Recalc Date`**（記錄日期，載入 XER 時自動帶入 `PROJECT.last_recalc_date`；與檔案值不同時可按 `File` 回復）→ 選項組 `All`／`Not Started`／`In Progress`／`Completed`／`Started`／`Milestones`／`Critical Path`（狀態可多選、`All` 清空狀態；其餘三項為獨立開關）→ `Custom`（自訂篩選有規則時顯示 `On`，點擊開啟既有 P6 篩選對話框）與 `Clear`（僅在有條件時出現，一鍵重置全部 quick 條件與 Critical Path）。徽章計數＝quick 條件 ＋ 自訂規則數（Critical Path 不計入，與參考站 `Iy()` 一致）。**狀態類條件以 `Last Recalc Date` 為準**：該日期之後才發生的實際進度視為尚未發生（完成日在那之後 → 顯示為 `In Progress`；開始日在那之後 → 視為 `Not Started` 且不計入 `Started`），未填日期時完全沿用 XER 的 `status_code`；日期本身不會隱藏任何活動。篩選只影響活動列（沒有符合活動的群組標題會一併隱藏），活動本身不會被增刪或重排。
- **Filter Activities 對話框（批次 22，`Custom` 開啟）**：頂部為 **`Load template...`** 範本選單（8 個參考站範本：Activities without predecessors／without successors／3-week lookahead／Started, not finished／Activities with constraints／Negative float／High float (> 20 days)／Milestones）＋ **`Match`** 分段控制（`All conditions`／`Any condition`，即根群組邏輯）；中段為條件表格（Parameter／Is／Value，可 `Add condition`、`Add sub-group` 巢狀子群組）；底部為 `Clear filter`（清空並套用）／`Cancel`／`Apply filter`。`3-week lookahead` 以 **`Last Recalc Date`** 為基準（視窗＝記錄日期 ~ +21 天）；另新增 5 個**衍生欄位**可手動組合：`Has Predecessor`、`Has Successor`、`Milestone`、`Start Actual`、`Finish Actual`。


**（可選）需要以特定 Base44 身分操作時**，只需開啟一次：
```
http://localhost:15156/?app_id=6a38f8c8aae6ce8a8b2b1096&access_token=<PERSONAL_ACCESS_TOKEN>
```
`access_token` 會由 `src/lib/app-params.js` 存入 localStorage 並自動從網址移除；之後所有 SDK 請求都會帶 `Authorization: Bearer <PAT>`。

---

## ⚠️ 已知事項（刻意不改）

| 項目 | 說明 |
|------|------|
| `npm run dev` 不可用 | 專案路徑含 `&`（`P6 Reader & Converter`），會截斷 cmd 的 `.bin` shim；故腳本改以 `node node_modules\vite\bin\vite.js` 啟動（等同 `vite`，設定完全相同）。 |
| `npm install` 需 `--ignore-scripts` | 同為路徑 `&` 造成 tesseract.js 的 postinstall 失敗；`--ignore-scripts` 後 502 個套件安裝完成、esbuild 執行檔齊備。 |
| `/manifest.json` 404 | `index.html` 有引用，但本機無此檔（原平台於部署時提供），僅 console 404，不影響功能。 |
| browserslist 資料偏舊 | dev server stderr 的提醒訊息，不影響執行。 |
| `hkWorkingDays.js` 走 static fallback | `res.data.holidays` 與函式回傳 `{holidays,...}` 結構不符（原版既有行為），本次不更動。 |
| 先前佔用 15156 的行程 | 原為另一專案 `VibeCode\py-workflow-programme reader\frontend` 的 Vite（PID 37224），已依使用者指示終止。 |

---

## ✅ 批次 4 完成報告（2026-09-17）— PDF 匯出前預覽（Print Preview）

### User Story
As an **operator**, I want **to see the PDF before it is downloaded**, so that **I can confirm the page layout / page count is right (and re-tune the export options) without generating and opening files repeatedly**.

### Entry — 2026-09-17：PDF 匯出增加「匯出前預覽」

**參考來源**
- <https://www.xerviewer.org/> 的列印預覽對話框（深色工具列 + 白底頁面 + Close）。
- 使用者決策：**預覽用真正的 jsPDF 輸出**（內嵌預覽、WYSIWYG、改動最小、零回歸），不另外用 HTML 重畫頁面。

**Functional Requirements**
- FR-501：PDF 分頁的動作由「直接下載」改為「**先前置預覽**」；`ExportDialog` 的 PDF 主按鈕文字由 `Download PDF` 改為 `Preview PDF`。
- FR-502：預覽對話框（`PdfPreviewDialog`）顯示**即將匯出的同一份 PDF 位元組**（jsPDF 產出 → `Blob` → `URL.createObjectURL` → `iframe`）。
- FR-503：工具列提供：檔名 + 頁數、Open in new tab、Download PDF、Close（Esc 亦可關閉）。
- FR-504：按「Download PDF」即下載**預覽中的同一份文件**（已在預覽階段建好，不重新繪製）並關閉預覽與匯出對話框。
- FR-505：關閉預覽（不下載）時回到 `ExportDialog`，可調整頁面設定後再預覽一次。

**Non-Functional Requirements**
- NFR-501：**預覽＝匯出**：預覽與下載使用同一個 `doc` 實例，不可能出現「預覽與檔案不一致」。
- NFR-502：`exportGanttPDF()` 對外行為不變（既有呼叫點、既有 PDF 視覺與檔名皆不變）。
- NFR-503：Blob URL 必須釋放（下載後、關閉預覽後、對話框卸載時）。
- NFR-504：不新增任何 npm 相依（沿用既有 `jspdf@^4`）。

**Constraints**
- C-501：`.env`、`devops/**` 不變更。
- C-502：PDF 繪製邏輯（816 行）不得改寫，只在最外層切出「建構」與「儲存」。
- C-503：不得影響 XER / XML / Excel 匯出與 P6 往返相容性。

**Acceptance Criteria**
- AC-501：按 `Preview PDF` 後出現預覽，且**不**直接下載檔案。
- AC-502：預覽頁數 = PDF 實際頁數；`%PDF-` 檔頭存在；預覽內容與下載檔案位元組相同。
- AC-503：預覽中按 `Download PDF` → 下載檔名為 `<programmeRef>.pdf`，且預覽與匯出對話框同時關閉。
- AC-504：關閉預覽後 `ExportDialog` 仍在（可再調整再預覽）。
- AC-505：既有 17 項 SSR 煙霧測試結果不變（零回歸）。


**Requirement Traceability Matrix (RTM)**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-501 | PDF 匯出改為先前置預覽 | `src/components/gantt/ExportDialog.jsx` | 匯出前預覽（2026-09-17） | Complete |
| FR-502 | 預覽顯示真正的 jsPDF 輸出 | `src/lib/exportGanttPDF.js`（`buildGanttPDF`）+ `PdfPreviewDialog` | 匯出前預覽（2026-09-17） | Complete |
| FR-503 | 預覽工具列（頁數／新分頁／下載／關閉／Esc） | `src/components/gantt/PdfPreviewDialog.jsx` | 匯出前預覽（2026-09-17） | Complete |
| FR-504 | 下載＝預覽中的同一份 doc | `ExportDialog`（`pdfDocRef` + `handleDownloadPreviewedPdf`） | 匯出前預覽（2026-09-17） | Complete |
| FR-505 | 關閉預覽後可回上層續調設定 | `ExportDialog`（`closePdfPreview`） | 匯出前預覽（2026-09-17） | Complete |
| NFR-501 | 預覽＝匯出（同一 doc 實例） | `buildGanttPDF` 回傳 `{ doc, filename, pageCount }` | 匯出前預覽（2026-09-17） | Verified |
| NFR-502 | `exportGanttPDF()` 行為與視覺不變 | `exportGanttPDF` = `buildGanttPDF` + `doc.save()` | 匯出前預覽（2026-09-17） | Verified |
| NFR-503 | Blob URL 生命週期管理 | `ExportDialog`（`pdfPreviewUrlRef` + unmount cleanup） | 匯出前預覽（2026-09-17） | Complete |
| NFR-504 | 零新增相依 | 沿用 `jspdf@^4` | 匯出前預覽（2026-09-17） | Verified |
| C-502 | PDF 繪製邏輯不改寫 | `exportGanttPDF.js`（僅函式切分與結尾 return） | 匯出前預覽（2026-09-17） | Verified |
| C-503 | 不影響其他匯出 | `exportXER` / `exportP6XML` / Excel 皆未觸及 | 匯出前預覽（2026-09-17） | Verified |
| AC-501 | 點擊後出現預覽、不直接下載 | 手動流程（`handleExportPDF` 不再呼叫 `doc.save()`） | 匯出前預覽（2026-09-17） | Verified（程式碼層級） |
| AC-502 | 頁數／檔頭／位元組一致 | 煙霧測試 `buildGanttPDF (real doc → preview bytes)` | 匯出前預覽（2026-09-17） | Verified |
| AC-503 | 下載檔名與關閉行為 | `handleDownloadPreviewedPdf` | 匯出前預覽（2026-09-17） | Verified（程式碼層級） |
| AC-504 | 關閉後回上層 | `closePdfPreview` | 匯出前預覽（2026-09-17） | Verified（程式碼層級） |
| AC-505 | 零回歸 | `scripts/smoke-test.mjs`（17 舊 + 3 新 = 20） | 匯出前預覽（2026-09-17） | Verified |

### 變更檔案

| 檔案 | 變更 | 類型 |
|------|------|------|
| `src/components/gantt/PdfPreviewDialog.jsx` | **新增**：深色工具列（檔名＋頁數／Open in new tab／Download PDF／Close）＋內嵌 PDF iframe；Esc 關閉；載入中提示置於 iframe 之後（PDF 一繪出即被覆蓋） | 新增 |
| `src/lib/exportGanttPDF.js` | 原 `exportGanttPDF` 更名為 `buildGanttPDF`（回傳 `{ doc, filename, pageCount }`），檔尾新增 `exportGanttPDF()` 薄包裝（`doc.save(filename)`）→ **繪製程式碼 0 行改動** | 重構（無行為變更） |
| `src/components/gantt/ExportDialog.jsx` | 匯入改為 `buildGanttPDF` + `PdfPreviewDialog`；新增 `pdfPreview` state／`pdfDocRef`／`pdfPreviewUrlRef` 與 `buildPdfOptions`、`handleDownloadPreviewedPdf`、`closePdfPreview`；按鈕改為 `Eye` + `Preview PDF`；檔尾渲染預覽；順手移除 3 個原本就未使用的 import（`useCallback`、`Upload`、`FileTextIcon`） | 修改 |
| `scripts/smoke-test.mjs` | 新增 3 個檢查（見下）；shim 補 `window.btoa/atob`（jsPDF 在有 `window` 全域時會 bind 它們，Node 沒有） | 修改 |


### 驗收證據

**1) SSR 煙霧測試（`node scripts/smoke-test.mjs`）— 20/20 OK**
```
  UnifiedGanttLayout (displaySettings=null): OK (21206 chars)
  UnifiedGanttLayout (displaySettings=default): OK (21206 chars)
  UnifiedGanttLayout (timeScale=auto): OK (45213 chars)
  UnifiedGanttLayout (timeScale=year): OK (20908 chars)
  UnifiedGanttLayout (timeScale=month): OK (21206 chars)
  UnifiedGanttLayout (timeScale=week): OK (23466 chars)
  UnifiedGanttLayout (timeScale=day): OK (45213 chars)
  UnifiedGanttLayout (timeScale=weekDay): OK (41338 chars)
  UnifiedGanttLayout (all bar options on): OK (21401 chars)
  UnifiedGanttLayout (milestone + critical): OK (25264 chars)
  GanttSettingsPanel (bars tab): OK (8985 chars)
  GanttSettingsPanel (labels tab): OK (5726 chars)
  GanttSettingsPanel (grid tab): OK (9396 chars)
  GanttSettingsPanel (timeline tab): OK (5206 chars)
  GanttSettingsPanel (structure tab): OK (7234 chars)
  UnifiedGanttLayout (collapsed sections): OK (14321 chars)
  UnifiedGanttLayout (focus mode on): OK (47091 chars)
  PdfPreviewDialog (preview open): OK (3079 chars)
  PdfPreviewDialog (no pdf -> renders nothing): OK (0 chars)
  buildGanttPDF (real doc -> preview bytes): OK (1 page(s), 14854 bytes, header '%PDF-', blob 14854 bytes, 'Smoke Programme.pdf')
```
→ 最後一項即 AC-502 的直接證據：**預覽用的 Blob 位元組數與 PDF 檔完全相同（14854 bytes）**。

**2) ESLint（僅本次觸及的檔案）**
```
node node_modules/eslint/bin/eslint.js \
  src/components/gantt/PdfPreviewDialog.jsx \
  src/components/gantt/ExportDialog.jsx \
  src/lib/exportGanttPDF.js scripts/smoke-test.mjs --quiet
→ exit 0（0 problems）
```

**3) Vite dev server 實際 transform（dev server on 15156）**
```
/src/components/gantt/PdfPreviewDialog.jsx -> 200 len=21308
/src/components/gantt/ExportDialog.jsx     -> 200 len=329056
/src/lib/exportGanttPDF.js                 -> 200 len=236089
```

### 行為變更說明
- 「PDF 匯出」多了一步**預覽**：`Preview PDF` → 預覽視窗 → `Download PDF`（存檔後關閉）或 `Close`／Esc（回上一層改設定）。
- 下載的檔案與預覽內容**保證相同**（同一個 jsPDF 實例、同一份 Blob）。
- 預覽內的縮放／翻頁／列印由瀏覽器 PDF 檢視器提供；另附 `Open in new tab`（等同列印／另存 PDF 的完整功能）。
- 其餘匯出格式（Excel／XER／XML）與 Gantt 畫面完全不受影響。

### 刻意未做（如需可再開批次）
| 項目 | 說明 |
|------|------|
| HTML 版逐頁預覽（比照 xerviewer.org 的 DOM） | 需把 jsPDF 版面數學在 HTML/CSS 重做一次（分頁、欄寬、時軸刻度、長條幾何）；本次依使用者決策改採「真 PDF 內嵌」，避免兩套版面日後不一致。 |
| 自製 Zoom／Layout 工具列 | 內嵌 PDF 檢視器已提供縮放、翻頁與列印；另做會與檢視器功能重疊。 |


---

## ✅ 批次 5 完成報告（2026-09-17）— 活動資訊面板（Gantt Information Panel）

### User Story
As an **operator**, I want **to inspect the selected activity's details (dates, status, resources, relationships, codes) in a side panel without leaving the Gantt**, so that **I can answer "why is this activity where it is?" on the spot instead of exporting to Excel and searching there**.

### Entry — 2026-09-17：參考 XER Viewer 的資訊面板

**參考來源（使用者提供的實際 DOM）**
- <https://www.xerviewer.org/> 右側滑入面板：`absolute right-0 … z-30 … translate-x-0`、`role="dialog" aria-modal="true" aria-labelledby="gantt-information-panel-title"`、`top: 53px; height: 836px; width: 568px`。
- 左側 `w-16` 圓形圖示列 6 頁籤：**General / Status / Resources / Relationships / Codes / Notebook**。
- 內容為 **Relationships**：`Predecessors (n)` 與 `Successors (n)` 兩張卡（可拖曳分割），欄位 `Activity ID | Activity Name | Rel. Type | Lag | Driving`（Driving 為唯讀 checkbox，tooltip「Predecessor activity is not on the driving path」），列可點擊「Click to jump to this activity」。

**Functional Requirements**
- FR-601：提供活動資訊面板（`GanttInfoPanel`），由工具列 **Info** 按鈕開關，Esc 可關閉。
- FR-602：面板跟隨目前選取的單一活動（`selectedIds.size === 1`）；未選取時顯示提示，點選其他列即時更新。
- FR-603：左側 6 個圓形頁籤（General / Status / Resources / Relationships / Codes / Notebook），圖示與參考實作相同；點選切換內容。
- FR-604：Relationships 頁籤須有 `Predecessors (n)` / `Successors (n)` 兩張卡、`Rel. Type`（FS/SS/FF/SF，tooltip 為完整名稱）、`Lag`、僅前導卡有 `Driving` 欄（唯讀 checkbox + driving path tooltip）。
- FR-605：兩張卡之間有可拖曳的水平分隔條（`Drag to resize sections`），可調整上下比例。
- FR-606：點擊關聯列＝「jump to this activity」：選取該活動並捲動到該列。
- FR-607：面板左緣可拖曳調整寬度（360–900px）。
- FR-608：General／Status 顯示 XER 解析出的欄位（日期、工期、baseline、early/late、float、status、constraint、units…）；缺值顯示 `—`。

**Non-Functional Requirements**
- NFR-601：**不新增相依套件**；沿用既有 `date-fns`、`buildRelationshipMap`、`displaySettings`、`hkWorkingDays`。
- NFR-602：面板為覆蓋層（不壓縮 Gantt），開關動畫 `transition-transform duration-300`；預設關閉 → 未開啟時畫面與批次 4 完全相同。
- NFR-603：面板高度隨 header 實際高度自動計算（`ResizeObserver` 替代方案：`getBoundingClientRect` + window resize），不寫死 53px。
- NFR-604：資料缺漏（Resources / Codes / Notebook 在目前 XER 解析器沒有來源）必須顯示明確空狀態，不得假造資料。
- NFR-605：不改變既有畫面表格、匯出（PDF/XER/XML/Excel）行為。

**Constraints**
- C-601：`.env`、`devops/**` 不變更。
- C-602：不得改動 `parseXER` 的輸出欄位與 `buildRelationshipMap`（Focus mode 依賴它）——僅**新增** `buildRelationshipDetails`。
- C-603：XER 解析器目前不解析 ACTIVITYCODE / TASKACTV / NOTEBOOK / TASKRSRC 明細，故該三頁以實際可得資料為限。

**Acceptance Criteria**
- AC-601：工具列 Info 按鈕可開/關面板，Esc 亦可關閉。
- AC-602：選取一個活動後，General 頁顯示該活動的 ID/名稱/日期/工期（工期依 Dur.(WD)/Cal 設定）。
- AC-603：Relationships 頁的前導/後繼清單、Rel. Type、Lag 與 `[data-task-id]` 目標活動一致（以 SSR 標記驗證）。
- AC-604：點擊關聯列後該活動被選取，且 `data-task-id` 對應列被捲入視野。
- AC-605：批次 1–4 的既有檢查全部維持 OK（零回歸）。



**Requirement Traceability Matrix (RTM)**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-601 | 資訊面板開關（工具列 Info / Esc） | `GanttPage` / `GanttInfoPanel` | 活動資訊面板（2026-09-17） | Complete |
| FR-602 | 面板跟隨單一選取活動 | `GanttPage`（`infoTask`） | 活動資訊面板（2026-09-17） | Complete |
| FR-603 | 6 個圓形頁籤切換 | `GanttInfoPanel`（`TABS` / 圖示列） | 活動資訊面板（2026-09-17） | Complete |
| FR-604 | Predecessors / Successors 表格 + Driving | `GanttInfoPanel`（`RelCard`） | 活動資訊面板（2026-09-17） | Complete |
| FR-605 | 兩卡可拖曳分割 | `GanttInfoPanel`（`RelationshipsTab`） | 活動資訊面板（2026-09-17） | Complete |
| FR-606 | 點列 jump to activity（選取＋捲動） | `GanttPage`（`handleInfoJump`）+ `UnifiedGanttLayout`（`data-task-id`） | 活動資訊面板（2026-09-17） | Complete |
| FR-607 | 面板寬度可拖曳（360–900） | `GanttInfoPanel`（左緣 handle） | 活動資訊面板（2026-09-17） | Complete |
| FR-608 | General / Status 顯示 XER 欄位 | `GanttInfoPanel`（`GeneralTab` / `StatusTab`） | 活動資訊面板（2026-09-17） | Complete |
| NFR-601 | 零新增相依 | 沿用 `date-fns` 等 | 活動資訊面板（2026-09-17） | Verified |
| NFR-602 | 覆蓋層、預設關閉、零回歸 | `GanttInfoPanel`（`translate-x-full`） | 活動資訊面板（2026-09-17） | Verified（SSR 檢查） |
| NFR-603 | 面板高度隨 header 實測 | `GanttPage`（`headerRef` + `headerHeight`） | 活動資訊面板（2026-09-17） | Complete |
| NFR-604 | 無資料顯示空狀態 | Resources / Codes / Notebook 頁 | 活動資訊面板（2026-09-17） | Complete |
| NFR-605 | 不影響既有表格與匯出 | 僅新增檔案/屬性 | 活動資訊面板（2026-09-17） | Verified |
| C-602 | 只新增 `buildRelationshipDetails` | `src/lib/buildRelationshipMap.js` | 活動資訊面板（2026-09-17） | Verified |
| C-603 | 未解析的 P6 表不假造 | Codes / Notebook 空狀態文案 | 活動資訊面板（2026-09-17） | Complete |
| AC-601 | 開關面板（按鈕 / Esc） | `GanttPage` / `GanttInfoPanel` | 活動資訊面板（2026-09-17） | Verified（程式碼層級） |
| AC-602 | General 顯示 ID/名稱/日期/工期 | 煙霧測試 `GanttInfoPanel (general tab)` | 活動資訊面板（2026-09-17） | Verified |
| AC-603 | Relationships 內容正確 | 煙霧測試 `GanttInfoPanel relationships markup`（10 個標記） | 活動資訊面板（2026-09-17） | Verified |
| AC-604 | jump to activity | `handleInfoJump` + `data-task-id` | 活動資訊面板（2026-09-17） | Verified（程式碼層級） |
| AC-605 | 零回歸 | `scripts/smoke-test.mjs`（30 項） | 活動資訊面板（2026-09-17） | Verified |

### 變更檔案

| 檔案 | 變更 | 類型 |
|------|------|------|
| `src/components/gantt/GanttInfoPanel.jsx` | **新增**：面板殼（`absolute right-0`、slide-in、`role="dialog"`、`aria-labelledby="gantt-information-panel-title"`）＋ 6 頁籤圓形圖示列 ＋ 標題列（含關閉鈕）＋ 內容區；`RelationshipsTab`（可拖曳分割的 Predecessors/Successors）＋ `GeneralTab` / `StatusTab` / `ResourcesTab` / `CodesTab` / `NotebookTab`；driving path 以「(前導 finish + lag) 最接近本活動 start 且差距 ≤ 1 天」判定 | 新增 |
| `src/lib/buildRelationshipMap.js` | **新增 `buildRelationshipDetails(tasks)`**：回傳 `Map<taskId, { predecessors/successors: [{ id, type, lag }] }>`（保留型別與 lag）；原 `buildRelationshipMap` / `resolveImportedLinks` 未改 | 新增函式 |
| `src/pages/GanttPage.jsx` | 新增 `GanttInfoPanel` import、`showInfoPanel` state、`headerRef`/`headerHeight` 量測、`infoTask` 選取衍生、`handleInfoJump`；工具列新增 Info 按鈕（heroicons information-circle）；root 加 `relative`；header 加 `ref`；`UnifiedGanttLayout` 後渲染面板；移除 3 個原本未使用的 import（`Type`、`Share2`、`buildRelationshipMap`） | 修改 |
| `src/components/gantt/UnifiedGanttLayout.jsx` | 表格列與圖表列各加 `data-task-id={task.id}`（供 jump to activity 捲動定位）；移除原本未使用的 import `DEFAULT_DISPLAY_SETTINGS` | 修改（+2 屬性） |
| `src/index.css` | 新增 `.custom-scrollbar`（細捲軸；參考實作使用的 class） | 新增 |
| `scripts/smoke-test.mjs` | 新增 8 個檢查：面板（無選取／general／relationships／status／resources／codes／notebook）、Relationships 標記驗證、`buildRelationshipDetails` 邊（type+lag）驗證 | 修改 |

### 驗收證據

**1) SSR 煙霧測試（`node scripts/smoke-test.mjs`）— 30/30 OK**
```
  UnifiedGanttLayout (displaySettings=null): OK (21278 chars)
  UnifiedGanttLayout (displaySettings=default): OK (21278 chars)
  UnifiedGanttLayout (timeScale=auto): OK (45285 chars)
  UnifiedGanttLayout (timeScale=year): OK (20980 chars)
  UnifiedGanttLayout (timeScale=month): OK (21278 chars)
  UnifiedGanttLayout (timeScale=week): OK (23538 chars)
  UnifiedGanttLayout (timeScale=day): OK (45285 chars)
  UnifiedGanttLayout (timeScale=weekDay): OK (41410 chars)
  UnifiedGanttLayout (all bar options on): OK (21473 chars)
  UnifiedGanttLayout (milestone + critical): OK (25336 chars)
  GanttSettingsPanel (bars tab): OK (8985 chars)
  GanttSettingsPanel (labels tab): OK (5726 chars)
  GanttSettingsPanel (grid tab): OK (9396 chars)
  GanttSettingsPanel (timeline tab): OK (5206 chars)
  GanttSettingsPanel (structure tab): OK (7234 chars)
  UnifiedGanttLayout (collapsed sections): OK (14357 chars)
  UnifiedGanttLayout (focus mode on): OK (47227 chars)
  PdfPreviewDialog (preview open): OK (3079 chars)
  PdfPreviewDialog (no pdf -> renders nothing): OK (0 chars)
  buildGanttPDF (real doc -> preview bytes): OK (1 page(s), 14854 bytes, header '%PDF-', blob 14854 bytes, 'Smoke Programme.pdf')
  GanttInfoPanel (no selection): OK (6493 chars)
  GanttInfoPanel (general tab): OK (14014 chars)
  GanttInfoPanel (relationships tab): OK (13233 chars)
  GanttInfoPanel (status tab): OK (11802 chars)
  GanttInfoPanel (resources tab): OK (6600 chars)
  GanttInfoPanel (codes tab): OK (7807 chars)
  GanttInfoPanel (notebook tab): OK (6574 chars)
  GanttInfoPanel relationships markup: OK (all 10 markers present)
  buildRelationshipDetails (type + lag per edge): OK (1→2 FS/0, 2→3 SS/2)
```
（第一組 17 項為批次 1–4 既有檢查，字元數因新增 `data-task-id` 而略增，結果仍為 OK。）

**2) ESLint（本次觸及的全部檔案）**
```
node node_modules/eslint/bin/eslint.js \
  src/components/gantt/GanttInfoPanel.jsx src/pages/GanttPage.jsx \
  src/lib/buildRelationshipMap.js src/components/gantt/UnifiedGanttLayout.jsx \
  scripts/smoke-test.mjs --quiet
→ exit 0（0 problems）
```
（同時清掉了 4 個原本就存在的未使用 import：`Type`、`Share2`、`buildRelationshipMap`、`DEFAULT_DISPLAY_SETTINGS`。）

**3) Vite dev server 實際 transform（dev server on 15156）**
```
/src/pages/GanttPage.jsx                      -> 200 len=245199
/src/components/gantt/GanttInfoPanel.jsx      -> 200 len=141660
/src/components/gantt/UnifiedGanttLayout.jsx  -> 200 len=495227
/src/lib/buildRelationshipMap.js              -> 200 len=30820
/src/index.css                                -> 200 len=116294
```

### 行為變更說明（預設值）
- 面板**預設關閉**；未按 Info 按鈕時，畫面與批次 4 完全一致（僅每列多一個 `data-task-id` 屬性）。
- 面板跟隨「單一選取」；多選或未選取時顯示提示文字。
- **driving path** 為由日期推算的近似值（`|（前導 finish + lag） − 本活動 start| ≤ 1 天` 中的最接近者），非讀取 P6 的 `driving_path_flag`（該旗標是活動層級、非關聯層級）。

### 刻意未做／限制（如需可再開批次）
| 項目 | 說明 |
|------|------|
| Resources 明細表 | XER 解析器只取 `rsrc_id`（單一主要資源）＋ units 彙總；未解析 `TASKRSRC` 逐筆指派。 |
| Codes | 未解析 `ACTIVITYCODE` / `TASKACTV`，故只顯示本專案自有代碼（Item、Bar type、Status code）並加註說明。 |
| Notebook | 未解析 P6 `NOTEBOOK` topics，顯示空狀態（無本地記事功能）。 |
| 多活動／群組統計 | 面板目前只處理單一活動；xerviewer 在群組選取時的彙總統計未實作。 |
| 直方圖／S-curve | 屬另一批（Resource View），本次不含。 |

---

## ✅ 批次 6 完成報告（2026-09-18）— 掃描式 PDF 匯入只抓到 3 行的根因修正

### User Story
As an **operator**, I want **a scanned PDF programme to import ALL of its activity rows (not just the first 2-3)**, so that **the Gantt I review is the real programme instead of a sample I have to complete by hand**.

### Entry — 2026-09-18：使用者回報「PDF OCR 只抓到三行」

**重現檔案**：`C:\Users\ken.li\Downloads\20231024-1046_01649 (September 2023)-4.pdf`
**症狀**：匯入後只得到 **3 行**活動資料。

**目標檔案的客觀事實（量測，非推測）**

| 項目 | 實測值 |
|------|--------|
| 頁數 | 4 頁 |
| 頁面尺寸 | A4 橫向 842×595 pt（297×210 mm），page 2/4 帶 `/Rotate 180` |
| 文字層 | **4 頁文字項目數皆為 0、字元數 0**（純掃描，無可搜尋文字） |
| 每頁內嵌影像 | **1 張 3520×2464 px JPEG**（約 300 dpi），`/Filter [/FlateDecode /DCTDecode]` |
| app 實際送 AI 的圖 | `renderPageAsBlob` 以 scale 1.5 重繪 → **1263×893 px**（原圖像素僅保留約 13%） |
| app 掃描的頁面 | page **2,3,4**（`firstPage = totalPages === 1 ? 1 : 2` → 第 1 頁永久跳過） |

**假設逐一排除（以同一支 `Core/InvokeLLM`、`gemini_3_1_pro`、正式 prompt 做 A/B）**

| 假設 | 實測結果 | 結論 |
|------|----------|------|
| 原生文字路徑短路，只送 24,000 字元文字 | 文字項目 = 0，`hasStructuredText` 為 false | 排除 |
| 解析度太低（1263×893） | 換成原生 300 dpi 原圖 → **同樣只有 3 行** | 非主因（仍為次要因素） |
| 第 1 頁被跳過 | 確實少 1/4 頁面 | 次要缺陷 |
| prompt 未要求完整 | prompt 已 6 次寫明 extract EVERY row / Do NOT skip any row | 排除 |
| AI 服務/上傳失敗 | HTTP 200、model 正常回 JSON、無錯誤 | 排除 |
| **`response_json_schema` 每列 37 個欄位** | **同一張圖：37 欄 → 3 行；16 欄 → 31 行** | **✅ 主因** |

**A/B 實測表（同一頁掃描圖，同一個 prompt 與模型）**

| 測試 | 送出的圖 | schema 欄位數 | 抓到行數 | 回應字元數 |
|------|----------|---------------|----------|------------|
| A | 原生 3520×2464 | 37（正式版） | **3** | 2,855 |
| B | 原生 3520×2464 | 5 | **31** | 6,133 |
| E | 原生 3520×2464 | 10 | **31** | 10,414 |
| F | 原生 3520×2464 | 16 | **31** | 16,175 |
| G | 原生 3520×2464 | 37 + 額外「必須全部回傳」指令 | 15 | 21,119 |
| C | 上半頁切條 3520×1232 | 37 | 1 | 814 |
| D | 上半頁切條 3520×1232 | 5 | 15 | 2,966 |

**根因**：每列背 37 個欄位時，模型產生的每一列要輸出約 950 字元；模型在第 2–3 列就停止輸出（JSON 是**完整閉合**的，不是被截斷）。把每列的欄位數降到 16 以下，同一張圖即可穩定輸出全部 31 行。附帶發現：37 欄版本會**編造圖上不存在的欄位值**（`primary_resource:"Carpenter"`、`calendar:"Standard 5-Day Workweek"`、`suspend_date`、constraint 系列等），該 A4 圖實際只有 Activity ID / Name / MC Install'n Rate / Dur / Start / Finish / Float / Path 八欄。

**修正後實測（同一重現檔案、正式 prompt + 正式 schema）**

| 情境 | 修正前 | 修正後 |
|------|--------|--------|
| app 實際送出的 1263×893 | 1 行 | **12 行** |
| 原生 3520×2464 | 3 行 | **31 行 + 13 個段落標題** |

**Functional Requirements**
- FR-701：vision 路徑（掃描式 PDF 逐頁、圖片匯入）改用精簡 schema `GANTT_VISION_TASK_SCHEMA`，每列僅 16 欄：`is_section`、`section_type`、`activity_id`、`activity`、`item`、`start`、`end`、`baseline_start`、`baseline_finish`、`bar_type`、`start_actual`、`end_actual`、`remain_dur`、`float`、`pct`、`driving_path_flag`。
- FR-702：文字來源（Excel／CSV、原生文字 PDF）維持原本 37 欄 `GANTT_TASK_SCHEMA`（那些來源真的可能有這些欄位）。
- FR-703：`GANTT_PROMPT_BASE` 新增「COMPLETENESS AND FIDELITY」規則：不得只回前幾行、必須依照來源順序抽完全部可見列；不得編造來源沒有的值（資源、日曆、限制條件、狀態碼、日期）。
- FR-704：新增原始碼層級回歸檢查（煙霧測試），確保 vision 路徑不會再被改回 37 欄 schema。

**Non-Functional Requirements**
- NFR-701：零新增相依套件。
- NFR-702：不改變 AI 回傳後的資料形狀 —— `aiResultToTasks()` 與其後續欄位對應完全不動（精簡 schema 只是少送「圖上沒有的欄位」）。
- NFR-703：重現檔案的修正必須以「同一支正式 prompt／schema／模型」實測舉證，不得只憑推論。
- NFR-704：不得為了修這個問題而改動 XER 匯出／PDF 匯出／資訊面板等既有功能（零回歸）。

**Constraints**
- C-701：`.env`、`devops/**` 不變更。
- C-702：`renderPageAsBlob` 的解析度上限與「跳過第 1 頁」兩個既有行為本次**刻意不動**（改動會影響上傳量、AI 成本與其他 PDF 的行為，另開批次決定）→ **已於批次 7 處理**（見下）。

**Acceptance Criteria**
- AC-701：同一份重現 PDF，vision 路徑行數由 1–3 行提升到 12 行（app 實際送的 1263×893）／31 行（原生 300 dpi），實測記錄於上表。
- AC-702：`node scripts/smoke-test.mjs` 全數 OK（含新增 guard），零失敗。
- AC-703：ESLint 對本批次改動的檔案（`ImageImportDialog.jsx`、`scripts/smoke-test.mjs`）僅剩既有問題，無新增。
- AC-704：批次 1–5 的既有檢查維持 OK（零回歸）。

---

**Requirement Traceability Matrix (RTM) — 批次 6**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-701 | vision 路徑改用 16 欄精簡 schema | `ImageImportDialog.jsx`（`GANTT_VISION_TASK_SCHEMA`） | 掃描 PDF 完整匯入（2026-09-18） | Complete |
| FR-702 | 文字來源維持 37 欄 schema | `GANTT_TASK_SCHEMA`（Excel / 原生文字 PDF 路徑） | 掃描 PDF 完整匯入（2026-09-18） | Verified（未改動） |
| FR-703 | prompt 增列完整性與不得編造規則 | `GANTT_PROMPT_BASE` | 掃描 PDF 完整匯入（2026-09-18） | Complete |
| FR-704 | 原始碼層級回歸 guard | `scripts/smoke-test.mjs`（row-count guard） | 掃描 PDF 完整匯入（2026-09-18） | Complete |
| NFR-701 | 零新增相依 | 使用既有 `pdfjs-dist` / base44 SDK | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| NFR-702 | 回傳資料形狀不變 | `aiResultToTasks()` 未修改 | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| NFR-703 | 以實測舉證根因 | A/B 七組實驗（見上表） | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| NFR-704 | 零回歸 | 煙霧測試 30 項 0 失敗 | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| C-701 | 不動 `.env` / `devops/**` | — | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| C-702 | 不動渲染解析度與跳頁行為 | 列為「刻意未做」 | 掃描 PDF 完整匯入（2026-09-18） | Acknowledged |
| AC-701 | 行數由 3 → 12／31 | 修正前後對照表 | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| AC-702 | 煙霧測試全 OK | `scripts/smoke-test.mjs` | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| AC-703 | 無新增 lint 問題 | ESLint（本批次檔案） | 掃描 PDF 完整匯入（2026-09-18） | Verified |
| AC-704 | 零回歸 | 煙霧測試 | 掃描 PDF 完整匯入（2026-09-18） | Verified |

### 變更檔案

| 檔案 | 變更 | 類型 |
|------|------|------|
| `src/components/gantt/ImageImportDialog.jsx` | 新增 `GANTT_VISION_TASK_SCHEMA`（16 欄）；掃描 PDF 逐頁 vision 呼叫與圖片匯入 vision 呼叫改用它；`GANTT_PROMPT_BASE` 新增「COMPLETENESS AND FIDELITY — CRITICAL」兩條規則 | 修改 |
| `scripts/smoke-test.mjs` | 新增 1 項回歸檢查：vision schema 每列欄位數 ≤ 18、兩個 vision 呼叫點都使用它、prompt 含不得編造規則 | 修改 |
| `doc/requirements.md` | 本篇批次 6 記錄（診斷證據、需求、RTM、驗收證據） | 文件 |

### 驗收證據

**1) 修正前後 A/B（同一支正式 prompt／schema／模型 `gemini_3_1_pro`）**

| 測試 | 圖 | schema 欄位 | 行數 |
|------|----|-------------|------|
| 修正前 | app 1263×893（16 欄前） | 37 | 1 |
| 修正前 | 原生 3520×2464 | 37 | 3 |
| 修正後 | app 1263×893 | 16 | **12** |
| 修正後 | 原生 3520×2464 | 16 | **31 + 13 sections** |

**2) SSR 煙霧測試（`node scripts/smoke-test.mjs`）— 30 項檢查、0 失敗**

```
ImageImportDialog vision schema (row-count guard): OK (16 row fields, 2 vision call sites, fidelity rule present)
buildGanttPDF (real doc → preview bytes): OK (1 page(s), 14854 bytes, header '%PDF-')
GanttInfoPanel relationships markup: OK (all 10 markers present)
buildRelationshipDetails (type + lag per edge): OK (1→2 FS/0, 2→3 SS/2)
```

**3) ESLint**：`ImageImportDialog.jsx` 與 `scripts/smoke-test.mjs` 無新增問題（該檔僅剩既有 2 errors / 2 warnings：第 3 行未使用的 `FileText`、`Image` import；`catch (_)` 未使用變數；一條無效的 eslint-disable 註解，皆非本批次造成）。

### 行為變更說明

- **掃描式 PDF／圖片匯入回傳的欄位變少**：只保留圖上真的印得出來的欄位（16 欄）。被移除的 21 欄（resources、calendars、constraints、suspend/resume、priority、location…）在掃描圖上本來就讀不到，過去是模型**編造**出來的，移除後資料反而更可信。
- **Excel／CSV／原生文字 PDF 匯入完全不受影響**（仍用 37 欄 schema）。
- **殘留變異性**：16–21 欄時模型仍偶爾提早停止（實測同一張縮圖在 16 欄時曾回 12 行、21 欄時回 31 行）。schema 精簡把失敗率大幅降低，但非 100% 保證。

### 刻意未做／限制（如需可再開批次）

| 項目 | 說明 |
|------|------|
| 跳過第 1 頁 | ~~`firstPage = totalPages === 1 ? 1 : 2`（假設多頁 PDF 首頁是封面）~~ → **已於批次 7 修正**：所有頁面都會送 AI。 |
| 渲染解析度 | ~~`renderPageAsBlob` 以 scale 1.5 重繪（A4 → 1263×893 ≈ 108 dpi）~~ → **已於批次 7 修正**：長邊目標 2800px（A4 → 2800×1980 ≈ 252 dpi）。 |
| 完整性硬保證 | 若要 100% 保證不漏行，可採「切條（tiling）＋合併」或「回報可見列數 → 不足時自動二次呼叫」。實測切條 3520×1232 + 5 欄可穩定取回該區全部 15 行。 |
| 文字路徑的同一風險 | 37 欄 schema 對 Excel／文字路徑有相同風險（列數多時可能提早停止），本次未動；若日後大量列數匯入出問題，可一併改用精簡 schema＋分批。 |

---

## ✅ 批次 7 完成報告（2026-09-18）— 掃描式 PDF：不再跳過第 1 頁 ＋ 提高渲染解析度

### User Story
As an **operator**, I want **every page of a scanned PDF to be read at full readable resolution**, so that **a 4-page programme gives me all four pages of activities instead of only three, and the fine print in dense tables actually gets read**.

### Entry — 2026-09-18：批次 6 診斷後續的兩個資料遺失點

批次 6 已把「只抓到 3 行」的主因（37 欄 schema 導致模型提早停手）修掉。診斷過程中另外量到兩個**獨立**的資料遺失點，本次一併修正：

| 缺陷 | 修正前 | 影響 |
|------|--------|------|
| 多頁 PDF 永遠跳過第 1 頁 | `firstPage = totalPages === 1 ? 1 : 2`（假設首頁是封面） | 重現檔 4 頁全是圖表 → **直接少 25% 資料** |
| 掃描頁被降解析度重繪 | `renderPageAsBlob` 固定 scale 1.5、長邊上限 1800px → A4 只有 **1263×893 px（約 108 dpi）** | 內嵌掃描原為 3520×2464（300 dpi），**丟掉約 87% 像素**；同一張圖實測 1263px → 12 行、2800px 以上 → 31 行 |

**Functional Requirements**
- FR-801：多頁 PDF 的**所有頁面**都要送進 AI（不再預設跳過第 1 頁）；沒有表格的頁面自然回傳 0 列，匯入前的預覽表可刪除多餘列。
- FR-802：掃描頁渲染改為**以長邊目標 2800px** 計算縮放（上限 scale 4），使 A4 掃描頁維持約 250 dpi 的可讀度。
- FR-803：新增批次 7 回歸檢查（原始碼層級），確保「跳過第 1 頁」不會被改回來、渲染長邊目標不得低於 2600px。

**Non-Functional Requirements**
- NFR-801：不新增相依套件；不改動 `detectTrueRotation`、上傳流程、`aiResultToTasks()` 與其他匯出功能。
- NFR-802：上傳量增加需可量化並可接受：單頁 JPEG（A4、q75）由約 **317 KB → 731 KB**（約 2.3 倍）。
- NFR-803：渲染尺寸必須有上限（`PDF_RENDER_MAX_SCALE = 4`），避免 A0/A1 大圖造成超大 canvas 或超大上傳。

**Constraints**
- C-801：`.env`、`devops/**` 不變更。
- C-802：不改動批次 6 已定案的 vision schema 與 prompt。

**Acceptance Criteria**
- AC-801：重現檔（4 頁）的頁碼陣列為 `[1,2,3,4]`（修正前為 `[2,3,4]`）。
- AC-802：重現檔每頁渲染尺寸為 **2800×1980 px**（修正前 1263×893），且 scale 3.326 未超過上限 4。
- AC-803：煙霧測試全數 OK（含批次 6、7 兩個 guard），零失敗、exit code 0。
- AC-804：ESLint 對改動檔案無新增問題。

---

**Requirement Traceability Matrix (RTM) — 批次 7**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-801 | 多頁 PDF 不跳過第 1 頁 | `ImageImportDialog.jsx`（`schedulePageNums`） | 掃描 PDF 全頁完整匯入（2026-09-18） | Complete |
| FR-802 | 掃描頁長邊 2800px 渲染 | `ImageImportDialog.jsx`（`renderPageAsBlob` / `PDF_RENDER_LONG_EDGE`） | 掃描 PDF 全頁完整匯入（2026-09-18） | Complete |
| FR-803 | 批次 7 原始碼回歸 guard | `scripts/smoke-test.mjs` | 掃描 PDF 全頁完整匯入（2026-09-18） | Complete |
| NFR-801 | 零新增相依、零回歸 | 未新增套件；其他模組未動 | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |
| NFR-802 | 上傳量增量已量化 | 317 KB → 731 KB／頁（實測） | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |
| NFR-803 | 渲染尺寸有上限 | `PDF_RENDER_MAX_SCALE = 4` | 掃描 PDF 全頁完整匯入（2026-09-18） | Complete |
| C-801 | 不動 `.env` / `devops/**` | — | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |
| C-802 | 不動批次 6 的 schema／prompt | 僅改頁碼與渲染 | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |
| AC-801 | 頁碼 `[1,2,3,4]` | 實測（pdfjs viewport 腳本） | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |
| AC-802 | 每頁 2800×1980 px | 實測（同一腳本） | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |
| AC-803 | 煙霧測試全 OK | `scripts/smoke-test.mjs` | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |
| AC-804 | 無新增 lint 問題 | ESLint | 掃描 PDF 全頁完整匯入（2026-09-18） | Verified |

### 變更檔案

| 檔案 | 變更 | 類型 |
|------|------|------|
| `src/components/gantt/ImageImportDialog.jsx` | `renderPageAsBlob` 改為「長邊目標 2800px、上限 scale 4」（新增 `PDF_RENDER_LONG_EDGE` / `PDF_RENDER_MAX_SCALE`），移除固定 scale 1.5 與 1800px 上限；`schedulePageNums` 改為全部頁面 | 修改 |
| `scripts/smoke-test.mjs` | 新增「page range + render size (batch 7 guard)」檢查（並以去除行註解後的程式碼判定，避免註解自我觸發） | 修改 |
| `doc/requirements.md` | 批次 6 的兩項「刻意未做」標記為已處理；新增本篇批次 7 記錄 | 文件 |

### 驗收證據

**1) 頁碼與渲染尺寸實測（同一支 PDF，無 AI 呼叫）**

```
pages: 4 | NEW code sends all pages: [1, 2, 3, 4] | OLD code sent: [2, 3, 4]
  page 1: rot=0   | NEW scale 3.326 → 2800x1980 px (5.54 MP) | OLD 1263x893 px (1.13 MP)
  page 2: rot=180 | NEW scale 3.326 → 2800x1980 px (5.54 MP) | OLD 1263x893 px (1.13 MP)
  page 3: rot=0   | NEW scale 3.326 → 2800x1980 px (5.54 MP) | OLD 1263x893 px (1.13 MP)
  page 4: rot=180 | NEW scale 3.326 → 2800x1980 px (5.54 MP) | OLD 1263x893 px (1.13 MP)
```

**2) 上傳量（A4 掃描頁、JPEG q75，實測）**：舊 1263×893 → **317 KB**；新 2800×1980 → **731 KB**（約 2.3 倍）。

**3) SSR 煙霧測試（`node scripts/smoke-test.mjs`）— 31 項檢查、0 失敗、exit code 0**

```
ImageImportDialog vision schema (row-count guard): OK (16 row fields, 2 vision call sites, fidelity rule present)
ImageImportDialog page range + render size (batch 7 guard): OK (all pages sent, long edge 2800px)
```

**4) ESLint**：`scripts/smoke-test.mjs` 全乾淨；`ImageImportDialog.jsx` 仍只有批次 6 之前就存在的 4 項（第 3 行未使用的 `FileText`、`Image`；`catch (_)` 未使用變數；一條無效 eslint-disable 註解），**無新增**。

### 行為變更說明

- **多頁 PDF 的 AI 呼叫數 +1**（每份文件多送一頁）。若該頁是封面/標題頁，模型通常回 0 列；若回出 1 列雜訊，可在匯入預覽表直接刪除。
- **每頁上傳檔案變大約 2.3 倍、AI 影像 token 增加**（這是使用者選擇接受的代價）。
- **渲染尺寸仍有上限**：A0/A1 大圖不會被無限放大（scale 上限 4）。
- 批次 6 的精簡 schema 與 prompt 規則完全不變。

### 刻意未做／限制（如需可再開批次）

| 項目 | 說明 |
|------|------|
| 完整性硬保證 | schema 精簡已大幅降低「提早停止」機率，但仍有殘留變異性。要 100% 保證可用「切條（tiling）＋合併」或「模型自報可見列數 → 不足時自動二次呼叫」。 |
| 文字路徑同一風險 | Excel／原生文字 PDF 仍用 37 欄 schema；大量列數時可能同樣提早停止，本次未動。 |
| 封面頁自動判斷 | 目前不再區分封面頁（一律送出）。若要省成本，可先用「頁面是否含大量文字/表格線」判斷後再跳過。 |

---

## ✅ 批次 8 完成報告（2026-09-18）— WBS 階層配色（WBS Settings 面板）

### User Story
As a **planner**, I want **each WBS level to be coloured differently (and to control those colours myself)**, so that **I can see the programme hierarchy at a glance instead of every section row looking the same blue**.

### Entry — 2026-09-18：參考 xerviewer.org 的「WBS Settings」面板

**參考來源（使用者提供的實際 DOM）**
- 面板標題 `WBS Settings`；內容順序：**WBS Row Color Scheme**（可捲動清單，每項 3 色塊預覽＋名稱，選中樣式 `bg-blue-100 border-blue-500 ring-1 ring-blue-500`、`aria-pressed="true"`）→ **Hide Empty WBS Rows** 開關 → **Show Group Headers on Gantt** 開關 → **Customise Grouping** → **Custom WBS Level Styles**（7 列，欄位 `Level/Group | BG | Text | Font | Size | Weight | Default`）。
- 14 組配色：Neutral Grays、Cool Blues（預設選中）、Forest Greens、Warm Tones、Red Autumn、Ocean Blue、Candy Shop、Deep Wood、Lilac Wine、First Love、Earth Brown、Grayscale、Primavera Classic、Print Friendly。
- 每組只給 **3 個色塊**，但 7 階樣式表顯示完整 7 色（Cool Blues：`#2e5cb8 #4171d0 #648bd8 #87a5e1 #a9bfea #ccd9f2 #eff3fb`）→ 推得 3 色塊 = **level 1 / 4 / 7**，其餘以 HSL 內插產生。

**Functional Requirements**
- FR-901：提供 **WBS Settings 面板**（`WbsSettingsPanel`），由工具列 **WBS Settings**（Layers 圖示）開啟，右上關閉鈕可關閉。
- FR-902：面板提供 **WBS Row Color Scheme**：15 個選項（14 組參考配色 ＋ 本專案原有 `Current (Blue / Pink)`），每個顯示 3 色塊（level 1/4/7）＋名稱；選中項以 `bg-blue-100 border-blue-500 ring-1 ring-blue-500` 標示並帶 `aria-pressed`。
- FR-903：選定配色後，**同一個 WBS 階層用同一個顏色**、不同階層不同顏色；套用於**左側活動表格列**、**甘特圖列標題**與 **PDF 匯出**（三處共用 `resolveWbsRowStyle`，所見即所得）。
- FR-904：**Custom WBS Level Styles**：7 階各自的 BG 色、文字色、字型、字級、字重（Normal/Bold/Italic）與「回復此階預設」按鈕；欄位排列與參考面板相同。
- FR-905：**Hide Empty WBS Rows** 開關：控制「沒有任何活動的 WBS 列」是否顯示（XER 解析器改為保留並標記 `emptyWbs`，由顯示層決定）。
- FR-906：**Show Group Headers on Gantt** 開關：控制甘特圖時間軸區是否繪製 WBS 列標題。
- FR-907：配色產生器 `expandSchemeColors`：3 色塊 → 7 階色（HSL 內插，與參考站差 ≦ 1/255）；文字色依亮度自動選 `#f8fafc` / `#334155`（與參考站 7 階完全一致）。

**Non-Functional Requirements**
- NFR-901：**預設值必須維持原有外觀**：`wbs.schemeId = "classic"` → 沿用原本藍/粉 programme header 樣式；`hideEmpty = true`、`groupHeadersOnGantt = true` 皆等同批次 7 之前的行為。
- NFR-902：零新增相依套件（配色內插自行實作）。
- NFR-903：設定持久化沿用 `gantt_display_settings`（localStorage），舊存檔載入時自動補上 `wbs` 區塊（`mergeDisplaySettings`）。
- NFR-904：不得改動既有 XER/PDF/XML/Excel 匯出與資訊面板行為（零回歸）。

**Constraints**
- C-901：`.env`、`devops/**` 不變更。
- C-902：`parseXER` 改為「保留空 WBS 並標記」，不得改變預設可見列（顯示層仍預設隱藏）。

**Acceptance Criteria**
- AC-901：選 Cool Blues 後，WBS level 1 列為 `#2e5cb8`、level 3 列為 `#648bd8`（表格與甘特列皆同）。
- AC-902：`expandSchemeColors(["#2e5cb8","#87a5e1","#eff3fb"])` 產出的 7 色與參考站每通道差 ≦ 1；7 階文字色與參考站完全相同。
- AC-903：`classic` 預設仍輸出 `#bfdbfe` / `#fce7f3`（藍 / 粉），且不輸出任何 scheme 色。
- AC-904：`Show Group Headers on Gantt` 關閉後，甘特圖區不再出現該列標題（表格仍保留）。
- AC-905：XER 解析結果的 section 帶 `sectionLevel`（`[1,2,1]`），空 WBS 帶 `emptyWbs: true`。
- AC-906：煙霧測試 38 項全 OK、0 失敗、exit code 0；GanttPage／新面板經 dev server 轉譯 HTTP 200；ESLint 無新增問題。

---

**Requirement Traceability Matrix (RTM) — 批次 8**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-901 | WBS Settings 面板與工具列入口 | `WbsSettingsPanel.jsx` / `GanttPage.jsx` | WBS 階層配色（2026-09-18） | Complete |
| FR-902 | 15 組配色清單＋3 色塊預覽＋選中樣式 | `WbsSettingsPanel.jsx`（`WBS_COLOR_SCHEMES`） | WBS 階層配色（2026-09-18） | Complete |
| FR-903 | 依 WBS 階層上色（表格／甘特／PDF 同步） | `resolveWbsRowStyle` + `UnifiedGanttLayout` + `exportGanttPDF` | WBS 階層配色（2026-09-18） | Complete |
| FR-904 | 7 階自訂樣式（BG/文字/字型/字級/字重/回復） | `WbsSettingsPanel.jsx`（level 表格） | WBS 階層配色（2026-09-18） | Complete |
| FR-905 | Hide Empty WBS Rows 開關 | `parseXER`（`emptyWbs`）+ `GanttPage`（`computedTasks` 過濾） | WBS 階層配色（2026-09-18） | Complete |
| FR-906 | Show Group Headers on Gantt 開關 | `UnifiedGanttLayout`（時間軸標題） | WBS 階層配色（2026-09-18） | Complete |
| FR-907 | 3 色塊 → 7 階色內插＋自動文字色 | `expandSchemeColors` / `wbsTextColorFor` | WBS 階層配色（2026-09-18） | Complete |
| NFR-901 | 預設維持原有外觀 | `DEFAULT_DISPLAY_SETTINGS.wbs` | WBS 階層配色（2026-09-18） | Verified |
| NFR-902 | 零新增相依 | 自行實作 HSL 內插 | WBS 階層配色（2026-09-18） | Verified |
| NFR-903 | 設定持久化＋舊存檔相容 | `mergeDisplaySettings` / `saveDisplaySettings` | WBS 階層配色（2026-09-18） | Verified |
| NFR-904 | 零回歸 | 煙霧測試 38 項 | WBS 階層配色（2026-09-18） | Verified |
| C-901 | 不動 `.env` / `devops/**` | — | WBS 階層配色（2026-09-18） | Verified |
| C-902 | 空 WBS 預設仍隱藏 | `hideEmpty: true` 預設 | WBS 階層配色（2026-09-18） | Verified |
| AC-901 | L1 `#2e5cb8` / L3 `#648bd8` | 煙霧測試（layout SSR） | WBS 階層配色（2026-09-18） | Verified |
| AC-902 | 配色與參考站一致（±1/255） | 煙霧測試（`expandSchemeColors`） | WBS 階層配色（2026-09-18） | Verified |
| AC-903 | classic 仍為藍/粉 | 煙霧測試（`resolveWbsRowStyle` + layout） | WBS 階層配色（2026-09-18） | Verified |
| AC-904 | 標題開關生效 | 煙霧測試（出現次數 2 → 1） | WBS 階層配色（2026-09-18） | Verified |
| AC-905 | `sectionLevel` / `emptyWbs` | 煙霧測試（XER fixture） | WBS 階層配色（2026-09-18） | Verified |
| AC-906 | 38 項煙霧測試／轉譯／ESLint | `scripts/smoke-test.mjs` 等 | WBS 階層配色（2026-09-18） | Verified |

### 變更檔案

| 檔案 | 變更 | 類型 |
|------|------|------|
| `src/components/gantt/WbsSettingsPanel.jsx` | **新增**：WBS Settings 面板（15 組配色清單、2 個開關、7 階樣式表） | 新增 |
| `src/lib/displaySettings.js` | 新增 `WBS_COLOR_SCHEMES`（15 組）、`WBS_FONT_FAMILIES/SIZES/WEIGHTS`、HSL 內插、`expandSchemeColors`、`wbsTextColorFor`、`levelStylesFromScheme`、`resolveWbsRowStyle`；`DEFAULT_DISPLAY_SETTINGS.wbs` 與 merge/clone 支援 `wbs` | 修改 |
| `src/lib/parseXER.js` | `flattenWbs(wbsId, level)` → section 帶 `sectionLevel`；空 WBS 由「刪除」改為標記 `emptyWbs: true` | 修改 |
| `src/components/gantt/UnifiedGanttLayout.jsx` | 表格列與甘特列改用 `resolveWbsRowStyle`；甘特列標題受 `groupHeadersOnGantt` 控制 | 修改 |
| `src/lib/exportGanttPDF.js` | `buildGanttPDF` 新增 `group` / `wbs` 參數，section 列改用 `resolveWbsRowStyle`（預設輸出與原本硬編碼藍/粉完全相同） | 修改 |
| `src/components/gantt/ExportDialog.jsx` | `buildPdfOptions` 傳入 `group` / `wbs` | 修改 |
| `src/pages/GanttPage.jsx` | WBS Settings 工具列按鈕與面板狀態；`computedTasks` 依 `hideEmpty` 過濾 `emptyWbs` 列 | 修改 |
| `scripts/smoke-test.mjs` | 新增 7 項檢查（面板 ×2、面板標記 23 項、配色展開、樣式解析、layout 上色＋標題開關、XER 階層／空 WBS） | 修改 |
| `doc/requirements.md` | 本篇批次 8 記錄 | 文件 |

### 驗收證據

**1) 配色展開 vs 參考站（Cool Blues，3 色塊 → 7 階）**

| 階層 | 本專案 | 參考站 | 差異 |
|------|--------|--------|------|
| 1 | `#2e5cb8` | `#2e5cb8` | 0 |
| 2 | `#4271d0` | `#4171d0` | 1/255 |
| 3 | `#648bd8` | `#648bd8` | 0 |
| 4 | `#87a5e1` | `#87a5e1` | 0 |
| 5 | `#aabfea` | `#a9bfea` | 1/255 |
| 6 | `#ccd9f2` | `#ccd9f2` | 0 |
| 7 | `#eff3fb` | `#eff3fb` | 0 |
| 文字色 | `#f8fafc #f8fafc #334155 #334155 #334155 #334155 #334155` | 同 | 全部相同 |

**2) SSR 煙霧測試（`node scripts/smoke-test.mjs`）— 38 項檢查、0 失敗、exit 0**

```
WbsSettingsPanel (classic scheme): OK (12402 chars)
WbsSettingsPanel (Cool Blues scheme): OK (34520 chars)
WbsSettingsPanel markup (schemes + toggles + level styles): OK (all 23 markers present)
expandSchemeColors (Cool Blues → 7 levels): OK (#2e5cb8 #4271d0 ... | text colours match reference)
resolveWbsRowStyle (classic · per level · override · clamp): OK
UnifiedGanttLayout WBS row colours (level 1 / 3 + classic + label toggle): OK (L1 #2e5cb8, L3 #648bd8, classic blue/pink kept, chart label toggles)
parseXER WBS levels + empty-WBS tagging: OK (levels [1,2,1], empty WBS tagged, 2 activities)
```

**3) Vite dev server 轉譯**：`GanttPage.jsx` 244 KB、`WbsSettingsPanel.jsx` 52 KB、`displaySettings.js` 103 KB、`UnifiedGanttLayout.jsx` 483 KB、`ExportDialog.jsx` 322 KB — 全部 **HTTP 200**。

**4) ESLint**：批次 8 觸及的 6 個檔案（含新面板）**零問題**。

### 行為變更說明（預設值）

- **預設外觀完全不變**：`wbs.schemeId = "classic"` → WBS／programme 列仍為原本的藍（`#bfdbfe`/`#1e3a8a`）與粉（`#fce7f3`/`#9d174d`）。
- 一旦選擇配色（例如 Cool Blues），**同階層同色、不同階層不同色**，並同步套用到表格、甘特列標題與 PDF。
- `Hide Empty WBS Rows` 預設開啟（＝批次 7 以前的行為）；關閉後會多出沒有任何活動的 WBS 列。
- `Show Group Headers on Gantt` 預設開啟（＝原本甘特圖時間軸會畫出列標題）。參考站預設為關閉 —— 本專案以「不改變既有外觀」優先。

### 刻意未做／限制（如需可再開批次）

| 項目 | 說明 |
|------|------|
| Customise Grouping（Group By / To Level / Status ＋ Add New Grouping Header） | 參考面板中的**結構性重排**功能（依 WBS 或其他欄位重新分組），與配色無關，本次未做。 |
| 非 XER 來源的階層 | WBS 階層目前來自 XER 的 `PROJWBS`；Excel／PDF／圖片匯入與手動新增的 section 皆視為 **level 1**（整段同色）。 |
| 自動縮排 | 參考面板有層級縮排概念；本專案沿用既有 `group.indent`（不隨階層自動加寬），以免改變現有版面。 |
| Print Friendly 純白 | `#ffffff` 三色塊 → 7 階全白，列與背景同色（與參考站行為相同；此時建議改用其他配色）。 |

### 🔥 批次 8.1 熱修（2026-09-18）— 重新整理後整頁空白（TDZ）

**症狀**：批次 8 完成後重新整理瀏覽器 → **整頁空白**（白畫面，無錯誤畫面）。

**根因**：批次 8 在 `GanttPage` 的衍生資料區塊（約第 206 行）加入「Hide Empty WBS Rows」過濾，讀取了 `displaySettings`；但該 state 的宣告原本在**第 318 行**（衍生計算之後）→ JavaScript **TDZ（暫時死區）**：`ReferenceError: Cannot access 'displaySettings' before initialization`，每次渲染立即拋錯，React 整棵樹卸載 → 白畫面。

**修正**：把 `const [displaySettings, setDisplaySettings] = useState(loadDisplaySettings)` 與其 `useEffect(saveDisplaySettings)` **上移到衍生任務計算之前**（第 114-115 行），並在原處留下註解說明原因。行為與設定內容完全不變。

**為什麼先前沒被抓到（流程缺口）**：煙霧測試載入了 `UnifiedGanttLayout`、面板、PDF 等元件，但**從未渲染 `GanttPage` 本身**，而這個錯誤只會在整頁渲染時出現。

**新增防護**：煙霧測試加入 **`GanttPage (full page render)`** 檢查（不傳 props 直接 SSR 整頁），專門攔截 TDZ／未定義變數／hook 順序等「會讓整頁空白」的錯誤。

| 項目 | 內容 |
|------|------|
| FR-908 | 煙霧測試必須渲染實際頁面（`GanttPage`），以攔截空白頁等級的執行期錯誤。 |
| AC-907 | `GanttPage (full page render)` 檢查通過（19 萬字元 SSR 輸出），煙霧測試 **39 項 0 失敗、exit 0**。 |

**驗收證據（診斷方式）**：以 Vite SSR 逐一模組載入並渲染，輸出每個模組的結果 —— 修正前 `[pages/GanttPage.jsx] *** ReferenceError: Cannot access 'displaySettings' before initialization`，修正後 `[pages/GanttPage.jsx] OK — 190503 chars`。

---

## ✅ 批次 9 完成報告（2026-09-18）— 匯出的 XER 遺失所有 Relationships

### User Story
As a **planner**, I want **the XER / P6 XML I export to keep every relationship (link type + lag)**, so that **the programme I hand over to P6 still has its logic network instead of importing as a pile of unlinked activities**.

### Entry — 2026-09-18：使用者回報「匯出的 XER 丟失所有 Relationships」

**症狀**：用 Export 匯出的 `.xer` 匯入 P6（或本 app 重新匯入）後，**所有邏輯關係（predecessor / successor）都不見了**。

**根因（程式碼層級）**：`src/lib/exportXER.js` 的 TASKPRED 區塊只寫了**表頭**，從來沒有寫入任何 `%R` 資料列：

```js
// 修正前
lines.push(...tableHeader("TASKPRED", ["task_pred_id","task_id", ... ]));
lines.push("%E");          // ← 直接結束表格，一列資料都沒有
```

因此每份匯出的 XER 的 TASKPRED 都是**空表**，P6 匯入後自然沒有任何關係。

**同時發現的第二個同類缺陷**：`src/lib/exportP6XML.js` 產生關係時只讀**舊的單一 `link` 欄位**，完全忽略 `links[]` 陣列；而 XER／XML 匯入的活動關係是存在 `links[]` 裡的（可一對多）。結果：P6 XML 匯出只會保留每個活動的**第一條**關係，其餘全部靜默丟失。

**Functional Requirements**
- FR-1001：`buildXER` 必須為每一條關係輸出一個 TASKPRED `%R` 列：`task_pred_id`（遞增唯一）、`task_id`（**後繼**活動的 XER task_id）、`pred_task_id`（**前導**活動的 XER task_id）、`proj_id`、`pred_proj_id`、`pred_type`（`PR_FS` / `PR_SS` / `PR_FF` / `PR_SF`）、`lag_hr_cnt`（**小時**，lag 天數 × 8）。
- FR-1002：關係來源必須同時涵蓋 `links[]`（匯入的多重關係，含各自的 type 與 lag）與舊的單一 `link` + `linkOffset`（手動綁定），且同一組前導→後繼只輸出一列（去重）。
- FR-1003：若 `links[]` 只帶 `succCode`（尚未解析成 task id），必須用 `activityId → task id` 對照表解析後照樣匯出。
- FR-1004：只有**兩端都被匯出**的關係才寫入（無日期的活動會被 TASK 略過、沒有 task_id 可指向）；self-link 不寫。
- FR-1005：`buildP6XML` 必須輸出 `links[]` 中的**所有**關係（各自的 type 與 lag，lag 轉小時），並以 `link` 作為補充。
- FR-1006：無關係的檔案必須仍輸出格式正確的**空** TASKPRED 表（表頭 + `%E`）。

**Non-Functional Requirements**
- NFR-1001：零新增相依套件；不改變 `buildXER` / `buildP6XML` 的函式簽章與其他既有輸出（欄位順序、其他表不變）。
- NFR-1002：所有匯出／預覽路徑（`ExportDialog` 的 XER 與 XML、`ExportXERDialog`、`XmlRelationshipEditor` 的 XML 預覽）共用同一份修正，不需分別改。
- NFR-1003：必須有可重複執行的回歸檢查（煙霧測試），涵蓋方向、型別、lag 單位、去重、略過與 fallback。

**Constraints**
- C-1001：`.env`、`devops/**` 不變更。
- C-1002：不改變「無日期的活動不匯出」這項既有規則（因此指向它們的關係只能略過）。

**Acceptance Criteria**
- AC-1001：含 3 條可匯出關係的測試資料，TASKPRED 必須有 3 列，且第 1 列為 `task_id=2, pred_task_id=1, PR_FS, lag_hr_cnt=16`（2 天 × 8 小時）。
- AC-1002：`buildXER → parseXER` 來回測試可還原關係（A100→A200 FS/2、A200→A300 SS/0）。
- AC-1003：重複的關係只輸出 1 列；指向未匯出活動的關係不輸出。
- AC-1004：`succCode`-only 的關係（XER 與 XML 各一例）仍可匯出。
- AC-1005：煙霧測試 45 項全 OK、0 失敗、exit 0；ESLint 對 `exportXER.js` / `exportP6XML.js` / `smoke-test.mjs` 零問題。

---

**Requirement Traceability Matrix (RTM) — 批次 9**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1001 | TASKPRED 每條關係一列（方向／型別／lag 小時） | `src/lib/exportXER.js`（TASKPRED 區塊） | XER 保留 Relationships（2026-09-18） | Complete |
| FR-1002 | 來源涵蓋 `links[]` + legacy `link`，並去重 | `exportXER.js`（`outgoingEdges`） | XER 保留 Relationships（2026-09-18） | Complete |
| FR-1003 | `succCode`-only 的關係可解析匯出 | `exportXER.js`（`idByActivityCode`） | XER 保留 Relationships（2026-09-18） | Complete |
| FR-1004 | 只寫兩端都已匯出的關係、不寫 self-link | `exportXER.js`（`xerTaskIdByAppId` 檢查） | XER 保留 Relationships（2026-09-18） | Complete |
| FR-1005 | P6 XML 輸出 `links[]` 全部關係 | `src/lib/exportP6XML.js`（`pushRel`） | XER 保留 Relationships（2026-09-18） | Complete |
| FR-1006 | 無關係時輸出空 TASKPRED（合法格式） | `exportXER.js` | XER 保留 Relationships（2026-09-18） | Verified |
| NFR-1001 | 零新增相依、簽章與其他輸出未變 | 僅在既有函式內新增邏輯 | XER 保留 Relationships（2026-09-18） | Verified |
| NFR-1002 | 所有匯出／預覽路徑共用修正 | 4 個呼叫端皆走 `buildXER` / `buildP6XML` | XER 保留 Relationships（2026-09-18） | Verified |
| NFR-1003 | 可重複的回歸檢查 | `scripts/smoke-test.mjs`（新增 6 項） | XER 保留 Relationships（2026-09-18） | Verified |
| C-1001 | 不動 `.env` / `devops/**` | — | XER 保留 Relationships（2026-09-18） | Verified |
| C-1002 | 保持「無日期不匯出」規則 | `skip_no_dates` 未動 | XER 保留 Relationships（2026-09-18） | Verified |
| AC-1001 | TASKPRED 3 列且方向／lag 正確 | 煙霧測試 `buildXER TASKPRED (relationships exported)` | XER 保留 Relationships（2026-09-18） | Verified |
| AC-1002 | 匯出→再匯入可還原關係 | 煙霧測試 `XER relationship round-trip` | XER 保留 Relationships（2026-09-18） | Verified |
| AC-1003 | 去重／略過未匯出活動 | 同 AC-1001 檢查 | XER 保留 Relationships（2026-09-18） | Verified |
| AC-1004 | `succCode`-only fallback | 煙霧測試（XER + XML 各 1 項） | XER 保留 Relationships（2026-09-18） | Verified |
| AC-1005 | 45 項煙霧測試 + ESLint | `scripts/smoke-test.mjs` | XER 保留 Relationships（2026-09-18） | Verified |

### 變更檔案

| 檔案 | 變更 | 類型 |
|------|------|------|
| `src/lib/exportXER.js` | 新增 `outgoingEdges()`（`links[]` + legacy `link`，含 `succCode` fallback 與去重）；TASK 迴圈建立 `xerTaskIdByAppId`（app id → XER task_id）；TASKPRED 由「只有表頭」改為輸出真正的 `%R` 資料列 | 修改（修 bug） |
| `src/lib/exportP6XML.js` | activity 帶出 `links`；新增 `pushRel()`；關係產生改為「先寫 `links[]` 全部關係、再補 legacy `link`」並去重；新增 `actByCode` 作 `succCode` fallback | 修改（修 bug） |
| `scripts/smoke-test.mjs` | 新增 6 項檢查（XER TASKPRED 內容／來回測試／無關係檔／succCode fallback；XML links[]／succCode fallback） | 修改 |
| `doc/requirements.md` | 本篇批次 9 記錄 | 文件 |

### 驗收證據

**1) 煙霧測試（`node scripts/smoke-test.mjs`）— 45 項檢查、0 失敗、exit 0**

```
buildXER TASKPRED (relationships exported): OK (3 rows: FS/lag16, SS/lag0, FS/lag0; skipped-task edge dropped; duplicate de-duped)
XER relationship round-trip (buildXER → parseXER): OK (A100→A200 FS/2 and A200→A300 SS/0 restored)
buildXER TASKPRED (no relationships): OK (header written, 0 data rows)
buildXER TASKPRED (succCode-only link fallback): OK (resolved by activity code, FF with lag 24h)
buildP6XML relationships (links[] array): OK (2 relationships from links[], FS + SS with lag 16h / 8h)
buildP6XML relationships (succCode-only fallback): OK (resolved by activity code)
```

**2) 實際輸出片段（TASKPRED，節錄）**

```
%T	TASKPRED
%F	task_pred_id	task_id	pred_task_id	proj_id	pred_proj_id	pred_type	lag_hr_cnt	float_path	aref	arls
%R	1	2	1	1	1	PR_FS	16	0		
%R	2	3	2	1	1	PR_SS	0	0		
%R	3	2	4	1	1	PR_FS	0	0		
%E
```

**3) ESLint**：`exportXER.js`、`exportP6XML.js`、`scripts/smoke-test.mjs` → **exit 0（零問題）**。

**4) 呼叫端盤點**（確認所有匯出路徑都吃到修正）：`ExportDialog.jsx`（XER + XML）、`ExportXERDialog.jsx`（XER）、`XmlRelationshipEditor.jsx`（XML 預覽）皆透過 `buildXER` / `buildP6XML`。

### 行為變更說明

- **匯出的 XER 現在會帶 Relationships**：P6 匯入後邏輯鏈完整；本 app 自己重新匯入也能還原（`buildXER → parseXER` 已驗證）。
- **P6 XML 匯出現在保留每個活動的所有關係**（過去只保留第一條）。
- **無日期的活動仍不匯出**（原規則），因此指向它的關係也會被略過 —— 這是 P6 格式限制（無法引用不存在的 task_id）。若要保留，需先補上日期。
- `TASKRSRC` / `TASKACTV` / `UDFVALUE` 仍為空表（本次未動，屬另一批）。

### 刻意未做／限制（如需可再開批次）

| 項目 | 說明 |
|------|------|
| 跨專案關係 | 目前所有關係的 `proj_id` / `pred_proj_id` 都寫本專案 ID；外部專案關係（`external_*`）未處理。 |
| 關係的 `aref` / `arls` | 以空字串輸出（P6 用於關係參照，一般匯入不需要）。 |
| 資源／代碼表 | `TASKRSRC`（資源指派）、`TASKACTV`（活動代碼）、`UDFVALUE`（UDF 值）仍為空表。 |
| P6 XML 的 `lag` 曆法 | 固定用 8 小時／天換算（既有行為），未依各活動曆法換算。 |

---

## 🔍 批次 10 稽核報告（2026-09-18）— XER → 匯出 XER 的資料缺漏清單

### 使用者提問
「能幫我再度確定，從 XER 轉 XER 匯出時，不會對任何數據造成缺漏嗎？」

### 稽核方法（可重現）
以一份含 17 個資料表、豐富欄位的測試 XER，執行 **`parseXER`（匯入）→ `buildXER`（匯出）→ 逐表逐欄位比對**，並以程式輸出「遺失表 / 空表 / 每列差異 / 每欄位差異」。

> 🔧 **可重複執行的稽核工具**：`node scripts/xer-loss-audit.mjs`（會列出遺失表、空表、列數差異與逐欄位差異，最後給出 `lossless: YES/NO`）。修正這類問題後請重跑此腳本確認缺漏清單縮短。

### 稽核結論
**❌ 目前不是零缺漏（lossless: NO）。** 實測：**完全遺失的表 4 個、被輸出成空表的表 4 個**，另有 4 張表的列數不同、以及多個欄位值被改寫。

#### A. 完全遺失的資料表（來源有、輸出完全沒有）

| 表 | 內容 | 影響 |
|----|------|------|
| `ACTVTYPE` | 活動代碼類型（例如 "Area"） | 代碼分類消失 |
| `ACTVCODE` | 活動代碼值（Zone 1 / Zone 2） | 活動代碼值消失 |
| `RSRC` | 資源主檔（Carpenter…） | 資源消失 |
| `TASKNOTE` | 活動記事 | 備註消失 |

> 真實 P6 檔案還會有更多（`NOTEBOOK`/`TASKMEMO`、`ROLERATE`、`ACCOUNT`、`PCATTYPE`、`FILES`…），因匯出端採「固定表清單」，未列入的表一律不輸出。

#### B. 被輸出成空表的資料表（表頭有、0 列）

| 表 | 內容 | 影響 |
|----|------|------|
| `TASKRSRC` | 資源指派（工種、數量、成本） | 資源/成本全部消失 |
| `TASKACTV` | 活動代碼指派 | 代碼指派全部消失 |
| `UDFVALUE` | UDF 值 | 自訂欄位值消失 |
| `UDFTYPE` | UDF 定義 | 自訂欄位定義消失 |

#### C. 列數改變

| 表 | 來源 | 輸出 | 原因 |
|----|------|------|------|
| `CURRTYPE` | 2 | 1 | 只寫 1 筆固定 USD |
| `OBS` | 2（Enterprise/Hong Kong） | 1 | 只寫 Enterprise |
| `CALENDAR` | 2（6d 9h / 5d 8h） | 1 | 只寫 1 個合成 5 天 8 小時曆 |
| `PROJWBS` | 3（含 2 層階層） | 4 | 重建為 root + 扁平 section |

#### D. 欄位值被改寫（實測差異）

**TASK**（每個活動）
| 欄位 | 來源 → 輸出 | 說明 |
|------|-------------|------|
| `task_id` / `proj_id` | 501/101 → 1/1 | 重新編號（連帶使其他表無法引用） |
| `wbs_id` | 200 / 300 → 3 / 4 | 對應重建後的 WBS |
| `clndr_id` | 5 / 6 → 1 / 1 | **曆法指派遺失**（一律指向合成曆） |
| `act_start_date` | `…07:00` → `…08:00` | **時間部分被覆寫**（固定 08:00/17:00） |
| `target_start_date` | `…07:00` → `…08:00` | 同上 |
| `target_drtn_hr_cnt` | 72 → 64 | 以「日 × 8 小時」重算，**原始工時遺失** |
| `total_float_hr_cnt` | 5 → 8 | 天數四捨五入後再乘 8，**工時精度遺失** |

**PROJWBS**
| 欄位 | 差異 |
|------|------|
| `wbs_id` | 100/200/300 → 1/3/4 |
| `parent_wbs_id` | 子節點 200 → 1 → **多層階層被壓平** |
| `wbs_short_name` | `A` / `A.1` → 由名稱自動產生（`Phase_A_-_Foundation`） |
| `guid` / `obs_id` | 被丟棄／固定為 1 |

**PROJECT**：13 個欄位被改寫（`proj_id`、`clndr_id`、`plan_start/end_date`、`guid`、`acct_id`、`last_recalc_date`、`def_complete_pct_type`、`task_code_base/step`、`fy_start_month_num`、`wbs_max_sum_level`、`priority_num`）。

**CALENDAR**：原始 2 個曆（6 天/週 9 小時、5 天/週 8 小時）→ 只剩 1 個合成「Standard」5 天/週 8 小時；**假日／例外日全部消失**。

### 本次已修（稽核過程發現的隱性缺漏）
- **FR-1007**：`buildXER` 的關係來源新增第三種 — `linkSuccCode`（`parseXER` 的原始輸出尚未經 `resolveImportedLinks` 時只有這個欄位）。修正前直接 `buildXER(parseXER(xer))` 會產生**空的 TASKPRED**（稽核實測 1 列 → 0 列）；修正後為 1 列 → 1 列。
- 同步改為以「**app task id 或活動代碼**」作為識別鍵（`keyOf`），因為剛解析出的活動還沒有 `id`（`id` 由 GanttPage 匯入時指派）。
- **FR-1008**：P6 XML 匯出同步支援 `linkSuccCode` 來源。
- 新增煙霧檢查：`buildXER TASKPRED (raw parseXER output, linkSuccCode)`（**46 項、0 失敗、exit 0**）。

### RTM — 批次 10

| Requirement ID | Requirement Description | Feature/Module | Status |
|----------------|-------------------------|----------------|--------|
| FR-1007 | 關係來源含 `linkSuccCode`（原始解析輸出可匯出） | `exportXER.js`（`outgoingEdges` / `keyOf`） | Complete |
| FR-1008 | P6 XML 同步支援 `linkSuccCode` | `exportP6XML.js` | Complete |
| AC-1006 | 原始 `parseXER` 輸出匯出後 TASKPRED 不為空 | 煙霧測試（46 項 0 失敗） | Verified |
| AC-1007 | 稽核可重現並列出缺漏 | 差異測試腳本（逐表逐欄位比對） | Verified |

### 待處理（尚未修，需決定範圍）
| 優先 | 項目 | 建議做法 |
|------|------|----------|
| 高 | `TASKRSRC` / `TASKACTV` / `UDFVALUE` / `UDFTYPE` 空表 | **原檔直通（pass-through）**：匯入時保留原始表資料，匯出時原樣寫回 |
| 高 | `CALENDAR` 被合成曆取代、`clndr_id` 遺失 | 保留原始 CALENDAR 全部列，活動沿用 `orig.clndr_id` |
| 高 | `TASK` 值被改寫（時間部分、工時、float） | 未經使用者修改的活動**原樣寫回原列**（只重編 task_id 或直接沿用原 id） |
| 中 | WBS 階層被壓平、`guid`/`short_name` 遺失 | 保留原始 PROJWBS 樹（`wbs_id`/`parent_wbs_id`/`guid`） |
| 中 | `PROJECT` 13 欄被改寫 | 保留原 PROJECT 列的未使用欄位（只覆寫專案名稱等由 UI 決定的欄位） |
| 低 | 未知表（NOTEBOOK、ACCOUNT…） | 原檔直通 |

---

## ✅ 批次 11 完成報告（2026-09-18）— XER 匯出「原檔直通」：達到真正零缺漏

### User Story
As a **planner**, I want **an XER I export after importing an XER to be byte-faithful for everything I did not touch**, so that **handing the programme back to P6 / to a client never silently drops calendars, resources, codes, notes or precision**.

### 做法：直通模式（pass-through）
匯入 XER 時保留**所有原始資料表**（`parseXerTables`）；匯出時改由 `buildXERPassThrough()` 產生檔案 —— 以原始檔為底，只改動「使用者真的動過的部分」。

| 表 | 匯出策略 |
|----|----------|
| `TASK` | **未修改的活動：原列原樣輸出**（保留 `task_id`、`clndr_id`、guid、所有欄位、日期時間部分如 07:00、原始工時 72h、float 5h）。修改過的活動：複製原列後**只覆寫 App 擁有的欄位**（名稱、日期、實際日期、工期、float、完成率、狀態、類型、所屬 WBS），`task_id`/`clndr_id`/`guid` 保持不變。App 新增的活動：以原檔欄位集產生新列並配發新 `task_id`。App 刪除的活動：該列移除。 |
| `TASKPRED` | 關係未變動 → **原列原樣輸出**；有變動 → 只重生該活動的關係列。兩端任一方被刪除的列移除。 |
| `PROJWBS` | 未變動 → 原列（保留 `wbs_id`/`parent_wbs_id`/`guid`/`wbs_short_name`，**多層階層不再被壓平**）；改名 → 只更新 `wbs_name`；新增 section → 新 `wbs_id`。 |
| `PROJECT` | 原列；只套用使用者輸入的 **Project ID（= `proj_short_name`）**、**Data Date**（`last_recalc_date`/`next_data_date`）。`proj_id` 為 P6 內部識別碼，**永不改寫**（因此其他表的引用一律有效）。 |
| `CALENDAR` | **全部原樣輸出**（含假日/例外日）；活動保留原 `clndr_id`。 |
| 其他所有表（`RSRC`、`ACTVCODE`、`ACTVTYPE`、`TASKRSRC`、`TASKACTV`、`UDFTYPE`、`UDFVALUE`、`TASKNOTE`、`OBS`、`CURRTYPE`… 以及未知表） | **原樣輸出**，且保持原檔的**表順序**與**欄位順序**。若有列引用到已刪除的活動（`task_id` 欄位比對不到），為避免 P6 匯入孤兒列，該列會被剔除。 |
| 專案名稱 | 寫入根 WBS 節點的 `wbs_name`（P6 的專案名稱所在）。 |

### 接線（讓 App 真的用到）
- `ImageImportDialog`：匯入 .xer 時同時 `parseXerTables(text)`，隨 `onImport(..., xerTableMap)` 傳給頁面。
- `GanttPage`：新增 `xerSource` state，傳給 `ExportDialog`。
- `ExportDialog` / `ExportXERDialog`：把 `sourceTables` 傳進 `buildXER`；**預設值改由匯入檔帶出**（Project ID = 原 `proj_short_name`、Project Name = 原根 WBS 名稱、Data Date = 原 `last_recalc_date`），因此「不動任何欄位按匯出」＝原檔不變。

**Functional / Non-Functional Requirements**
- FR-1101：匯入 XER 時保留全部原始資料表；FR-1102：匯出時以原始表為底，未修改的列／欄位原樣輸出；FR-1103：修改過的活動沿用原 `task_id`／`clndr_id`／`guid`，只覆寫 App 擁有欄位；FR-1104：CALENDAR／資源／代碼／UDF／記事等表原樣輸出；FR-1105：PROJWBS 保留原樹狀結構；FR-1106：`proj_id` 不可改寫；FR-1107：被刪除活動的相依列要剔除；FR-1108：沒有來源（Excel／PDF／XML 匯入）時仍用原有產生器（行為不變）。
- NFR-1101：零新增相依；NFR-1102：`sourceTables` 缺省時完全等同舊行為；NFR-1103：大型 XER 的記憶體成本＝原始表資料（僅存於記憶體，不落地）。
- C-1101：`.env`／`devops/**` 不變更；C-1102：不改動 P6 XML 匯出（本次只做 XER；XML 的關係匯出已在批次 9 修好）。

**Acceptance Criteria / 驗收證據**
- **AC-1101：未修改的來回測試 → `lossless: YES`**（0 遺失表、0 空表、TASK 兩列 0 欄位變動、PROJWBS 全部 unchanged、CALENDAR 2→2 且 `clndr_id` [5,6]→[5,6]、PROJECT 0 欄變動、TASKPRED 原樣）。

```
======== VERDICT ========
lossless (unchanged round trip): YES  (tables lost: 0, emptied: 0, changed PROJECT fields: 0)
edits applied without collateral loss: YES
```

- **AC-1102：修改過的活動仍正確套用且無連帶損失** —— A110 改名 + 改日期 + float 改 2 天 → 輸出 `name="Piling (revised)"`、`2023-09-12..2023-09-18`、`float_hr=16`，且 **`task_id=502`、`clndr_id=6` 原樣保留**；未動的 A100 仍保有 `act_start_date="2023-09-01 07:00"`（時間部分不變）與 `total_float_hr_cnt="0"`。
- **AC-1103：稽核工具可重跑** —— `node scripts/xer-loss-audit.mjs`（7 段報告 + VERDICT）。
- **AC-1104：零回歸** —— 煙霧測試 **46 項、0 失敗、exit 0**；ESLint 對本次觸及的檔案**無新增問題**；6 個檔案 dev server 轉譯 **HTTP 200**。

### 已知限制（誠實揭露）
| 項目 | 說明 |
|------|------|
| 來源只在同一次工作階段 | 原始表存於記憶體（GanttPage state）。**重新載入頁面後**再匯出會走回產生器模式（無來源）。若需要跨工作階段，得把原始表存進 localStorage／快照（另開批次）。 |
| Data Date／Project ID／Project Name 是**刻意套用**的使用者輸入 | 這三項即使原檔有值也會被對話框的值覆寫（預設已由原檔帶出，不動即等於原值）。 |
| 刪除活動會連帶移除其相依列 | `TASKRSRC`／`TASKACTV`／`TASKNOTE` 等表中指向已刪活動的列會被剔除（否則 P6 匯入會出現孤兒列）。 |
| XML 來源 | P6 XML 匯入沒有 XER 表可直通，仍走原產生器。 |

---

## ✅ 批次 12 完成報告（2026-09-18）— 匯出的 PDF 標記內嵌完整資料，重新上傳可完整還原

### User Story
As a **planner**, I want **a PDF exported from this app to carry the whole programme inside it**, so that **if I (or a colleague) upload that same PDF back, every field comes back exactly — no OCR, no AI guessing, no missing rows**.

### 問題（稽核發現）
匯入端（`ImageImportDialog.processPDF`）**早就有**「讀取 PDF metadata 內嵌資料」的快速路徑（`GANTT_DATA_V2:` / `chunks:N` / `GANTT_OVERFLOW:`），但**匯出端從來沒有寫入這個標記** —— 搜尋整個 `src` 只找到讀取端、找不到寫入端。因此重新上傳自家匯出的 PDF 一律走 AI/vision 辨識（有損、且掃描式版面可能只抓到少數列，見批次 6）。

### 做法
| 檔案 | 內容 |
|------|------|
| `src/lib/ganttPDFData.js`（新） | 共用編解碼：`encodeTasksForPDF(tasks)` / `decodeTasksFromPDFInfo(info)` / `hasEmbeddedGanttData(info)`。格式：`Subject = "GANTT_DATA_V3:" + base64(chunk0)`、`Author = "chunks:N"`、`Keywords = "GANTT_OVERFLOW:" + chunk1|chunk2|…`。**V3 為 gzip 壓縮**（`CompressionStream`，瀏覽器與 Node 18+ 皆有），失敗時自動退回舊的未壓縮 V2 格式。 |
| `src/lib/exportGanttPDF.js` | `buildGanttPDF({ …, embedData })`：建立 jsPDF 後 `doc.setProperties({ title, subject, author, keywords, creator })` 寫入標記（best-effort，失敗不影響匯出）。 |
| `src/components/gantt/ExportDialog.jsx` | `handleExportPDF` 改為 async：先 `await encodeTasksForPDF(tasks)`（**完整 task 陣列，含段落列與所有 P6 欄位**）再建 PDF；按鈕旁新增標示「🔖 已標記並內嵌完整資料／重新上傳此 PDF 可完整還原（不經 AI 辨識）」。 |
| `src/components/gantt/ImageImportDialog.jsx` | 快速路徑改用共用 `decodeTasksFromPDFInfo(info)`（支援 V3 gzip 與舊 V2），命中即直接回傳完整資料、跳過全部頁面渲染與 AI 呼叫。 |

**Requirements / Acceptance Criteria**
- FR-1201：匯出的 PDF 必須在 metadata 內嵌**完整** task 陣列（含 `isSection`／`sectionLevel`／`link`／`links`／baseline／actuals／float／pct／資源／限制條件／guid… 全部欄位）。FR-1202：重新上傳此 PDF 時必須**直接還原**、不呼叫 AI。FR-1203：沒有標記的 PDF（第三方／掃描檔）必須維持原本的 AI/vision 流程。FR-1204：舊格式（V2）仍可讀。
- NFR-1201：零新增相依（gzip 用平台內建 `CompressionStream`）。NFR-1202：metadata 大小要可被一般 PDF 接受（實測 gzip 後僅數百～數十 KB）。
- AC-1201：真實來回測試（jsPDF 產生 → pdfjs 讀 metadata → 解碼）**逐欄位完全相同**。AC-1202：無標記 PDF 解碼回 `null`。AC-1203：舊 V2 payload 可解。AC-1204：零回歸。

### 驗收證據
```
PDF embedded data round trip (export → re-upload): OK (4 records, 1040 bytes JSON → 666 chars embedded, every field identical)
PDF without embedded marker → falls back to AI path: OK (decode returns null)
PDF embedded data (legacy V2 payload): OK (old-format PDFs still restore)
```
- 煙霧測試 **49 項、0 失敗、exit 0**（新增 3 項，含用 pdfjs 實際讀回 PDF metadata 的端到端驗證；測試資料刻意包含中文名稱「Piling 樁」、`links[]`、baseline、actuals、constraint 等欄位，全數一致）。
- ESLint：本次觸及檔案**無新增問題**（僅剩 `ImageImportDialog` 既有的 2 個未使用 import 等）。dev server 轉譯 4 個檔案 **HTTP 200**。

### 使用方式
1. Export → **PDF** → **Preview PDF** → Download（現在的 PDF 已帶標記）。
2. 把同一份 PDF（Image Import 或拖進甘特圖）上傳 → 進度訊息顯示「✓ Embedded data found — N records restored instantly!」→ 全部資料（含所有欄位）**瞬間還原，不經 AI**。

### 已知限制
| 項目 | 說明 |
|------|------|
| 依賴 metadata | 若第三方工具「清除 PDF metadata」或重新列印（print to PDF）就會失去標記，此時自動退回 AI 流程（不會壞，只是變有損）。 |
| 非加密 | 內嵌資料是 base64（可 gzip）純文字，任何 PDF 工具都看得到內容 —— 這是「可還原」的交換條件，不是保密機制。 |
| 極大專案 | gzip 後仍有實際上線（數千活動約數十 KB），一般 PDF 讀者均可接受；若日後遇到超大專案再評估改存附件（jsPDF 4 無原生附件支援）。 |










---

## 📄 批次 12 補充（2026-09-18）— XER 匯出完整性說明文件 + 版本欄位說明修正

- **交付文件**：`C:\Users\ken.li\Downloads\XER匯出資料完整性與輸出模式說明.txt`（173 行、UTF-8 BOM 純文字）
  內容：兩種匯出模式（原檔直通／產生器）觸發條件與行為、逐表輸出規則、匯出對話框三個欄位的作用、
        P6 版本選擇的實際影響、完整性保證 G1~G4、稽核工具指令與最近實測數據、自行驗證 3 步驟、
        已知限制（含「僅同一次工作階段」）、其他匯出格式（PDF／XML／Excel）現況、相關程式檔案位置。
- **程式碼修正**：`ExportXERDialog.jsx` 版本欄位說明由「Affects the ERMHDR version tag and field set…」改為
  「只影響檔案第一行 ERMHDR 的版本標記；輸出欄位集不分版本、一律完整」——實測 `version` 只用在 ERMHDR，
  且 create_date／update_date 不分版本都會輸出，舊說明已過時。
- **技術實作文件**：`C:\Users\ken.li\Downloads\XER直通模式-實作細節與指令.txt`（383 行、UTF-8 BOM）
  內容：資料流圖與三種情境、匯入端（parseXerTables／parseXER 附加的原檔欄位）、匯出端
        `buildXER` 分派（exportXER.js:141）與 `buildXERPassThrough`（:709）九步驟流程、
        逐函式行號對照（isTaskUnchanged :644、applyAppEdits :660-703、edgeKeysResolved :757-762、
        wbsIdForTask :806-811、pushEdge :883-897、emit :943-948）、可直接複製的指令
        （start-local.bat／stop-local.bat、`node scripts/xer-loss-audit.mjs`、`node scripts/smoke-test.mjs`、
        eslint、Vite 轉譯檢查）、設計決策 D1~D6、需求↔程式對照表、Runbook 七步驗收清單。
- **實測數據**（2026-09-18 重跑）：`xer-loss-audit.mjs` → `lossless: YES (tables lost: 0, emptied: 0,
  changed PROJECT fields: 0)`、`edits applied without collateral loss: YES`；`smoke-test.mjs` → 49 OK / 0 FAILED。



---

## ✅ 批次 13（2026-09-21）— 找回「啟動按鈕」：桌面一鍵啓停捷徑

### User Story
As an **operator**, I want **a one-click button on the Desktop that starts (and stops) the P6 Reader & Converter app**, so that **I can launch it without remembering the deep project path or typing the `.bat` command**.

### Entry — 2026-09-21：使用者提問「幫我重新找回這個程序的啓動按鈕」

**診斷（實地勘查，非臆測）**
- 這個專案唯一的官方啓停入口是 `Baes44/chronos-flow-chunwo/scripts/start-local.bat` 與 `stop-local.bat`（NFR-103）；專案根目錄**沒有** `scripts/` 資料夾（`AGENTS.md` 裡 `scripts/start-all.bat` 那段是模板樣板文字，不適用此專案）。
- 「按鈕」＝ Windows 捷徑（`.lnk`）。勘查時全機**只剩一顆**，而且躺在**專案資料夾內**：`P6 Reader & Converter\start-local - 捷徑.lnk`（target／working directory 皆正確）；**桌面已無任何 P6 相關捷徑** → 這正是「按鈕不見了」的原因。
- 當時 dev server 其實還在跑（PID 5300 = `node node_modules\vite\bin\vite.js`，15156 LISTENING）。
- 重建過程撞到的環境陷阱（已寫入 NFR-1302）：本機 ACP = **950（Big5）**，`WScript.Shell.CreateShortcut().Save()` 對 ACP 無法表示的字元會擲 `FileNotFoundException`，訊息中的檔名會變成 `?動`；「啓」(U+5553) 不在 Big5 內，改用標準繁體「啟」(U+555F) 即完全正常（含 icon 讀回）。

**Functional Requirements**
- FR-1301：桌面提供「**啟動 P6 Reader**」一鍵按鈕（`.lnk` → `scripts\start-local.bat`，工作目錄 `scripts`），雙擊即啟動本機 Vite dev server。
- FR-1302：桌面提供「**停止 P6 Reader**」一鍵按鈕（`.lnk` → `scripts\stop-local.bat`），用於釋放 `FRONTEND_PORT`。
- FR-1303：按鈕只指向既有官方腳本，**不得**新增第二套啓動邏輯、**不得**直接呼叫 `npm run dev`／`vite`。
- FR-1304：專案根目錄原有那顆 `start-local - 捷徑.lnk` 一併重建（名稱、目標、工作目錄與原狀一致），避免出現兩種入口版本。

**Non-Functional Requirements**
- NFR-1301：埠號只能來自 workspace 根目錄 `.env` 的 `FRONTEND_PORT`（本次 15156）；捷徑內不得硬編埠號或參數。
- NFR-1302：捷徑檔名必須是 ACP 950 可表示的字元（用「啟」不用「啓」），否則 `IShellLink.Save()` 會失敗。
- NFR-1303：不修改 `.env`、`devops/**`、`src/**`（本次為純工具／文件工作，應用程式碼零變更）。

**Constraints**
- C-1301：不在專案內新增非必要檔案；桌面捷徑屬使用者層級資產。
- C-1302：`.lnk` 內容必須能被 `IShellLink` 正確讀回（target／working directory／icon）。
- C-1303：文件 `doc/requirements.md` 維持 UTF-8（無 BOM）＋ CRLF 行尾。

**Acceptance Criteria**
- AC-1301：雙擊「啟動 P6 Reader」→ 出現 cmd 視窗顯示 `[start-local] FRONTEND_PORT=15156`／`starting vite ...`，且 `http://localhost:15156/` 回 **HTTP 200**。
- AC-1302：雙擊「停止 P6 Reader」→ 顯示 `[stop-local] Killing PID <n> listening on port 15156`，且該埠不再 LISTENING。
- AC-1303：三顆捷徑讀回驗證：`TargetPath`、`WorkingDirectory`、`IconLocation` 正確且目標檔存在。
- AC-1304：桌面無殘留測試檔（`ZZ*.lnk` 全部清除）。

**驗收證據（2026-09-21 實測）**
```
停止：scripts\stop-local.bat → [stop-local] Killing PID 5300 listening on port 15156
      停止後 netstat：15156 的 LISTENING 消失（僅餘 FIN_WAIT_2／CLOSE_WAIT 殘項）
啟動：以桌面「啟動 P6 Reader.lnk」啟動（以 Start-Process 呼叫 .lnk，行為等同雙擊）
      → HTTP 200 after ~2s (bytes 1639)
      → 15156 LISTENING PID 20840，cmdline = node "node_modules\vite\bin\vite.js"
      → 父行程 cmd.exe（PID 27860）正在執行 scripts\start-local.bat（主控台視窗保留日誌）
頁面：GET / → 200 (1639 bytes)；GET /src/main.jsx → 200 (1945 bytes)
捷徑：桌面「啟動 P6 Reader.lnk」「停止 P6 Reader.lnk」＋ 根目錄「start-local - 捷徑.lnk」
      三者 TargetPath／WorkingDirectory 指向 scripts 下的 .bat、TargetExists = True、icon = C:\Program Files\nodejs\node.exe,0
```

**RTM（批次 13）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1301 | 桌面「啟動 P6 Reader」一鍵按鈕 | `%Desktop%\啟動 P6 Reader.lnk` → `scripts/start-local.bat` | Operator wants a one-click launch button | Verified |
| FR-1302 | 桌面「停止 P6 Reader」一鍵按鈕 | `%Desktop%\停止 P6 Reader.lnk` → `scripts/stop-local.bat` | Operator wants a one-click launch button | Verified |
| FR-1303 | 按鈕沿用官方腳本、不新增啓動邏輯 | `scripts/start-local.bat` / `stop-local.bat` | Operator wants a one-click launch button | Verified |
| FR-1304 | 專案根目錄既有捷徑同步重建 | `P6 Reader & Converter\start-local - 捷徑.lnk` | Operator wants a one-click launch button | Verified |
| NFR-1301 | 埠號只讀 `.env`，不硬編 | 捷徑／`.bat` | Operator wants a one-click launch button | Verified |
| NFR-1302 | 捷徑檔名須為 ACP 950 可表示字元（用「啟」） | 捷徑命名 | Operator wants a one-click launch button | Verified |
| NFR-1303 | 不動 `.env`／`devops/**`／`src/**` | — | Operator wants a one-click launch button | Verified |
| C-1301 | 不在專案內新增非必要檔案 | — | Operator wants a one-click launch button | Complete |
| C-1302 | `.lnk` 可被 IShellLink 正確讀回 | 捷徑 | Operator wants a one-click launch button | Complete |
| C-1303 | 文件維持 UTF-8（無 BOM）＋ CRLF | `doc/requirements.md` | Operator wants a one-click launch button | Complete |
| AC-1301 | 雙擊啓動 → HTTP 200 | 本機 dev server（15156） | Operator wants a one-click launch button | Verified |
| AC-1302 | 雙擊停止 → 埠釋放 | `stop-local.bat` | Operator wants a one-click launch button | Verified |
| AC-1303 | 三顆捷徑屬性讀回正確 | 捷徑 | Operator wants a one-click launch button | Verified |
| AC-1304 | 桌面無測試殘留檔 | 桌面 | Operator wants a one-click launch button | Verified |


---

## ✅ 批次 14（2026-09-21）— 建立 workspace `scripts\` 服務腳本套組（start-all／stop-all／status）

### User Story
As an **operator / developer**, I want **the same `scripts\` launcher set the other Vibe-Code projects have (start-all, start-frontend, start-backend, stop-all, status)**, so that **I can start, stop and inspect this project with one documented command instead of remembering the app-internal `.bat` paths**.

### Entry — 2026-09-21：使用者要求「scripts\start-all.bat 這類啓動文件以及其他 scripts 文件夾内的文件内容」，並指定參考 `py-workflow-PST Viewer\scripts`

**參考專案的作法（實讀 `py-workflow-PST Viewer\scripts` 全部 12 個檔案）**
- `start-all.bat/.sh`：讀根目錄 `.env` → 已在跑就跳過 → `start "title" /MIN cmd /c "<script>"` → 以 retry 迴圈等就緒 → 印 URL 彙總。
- `start-backend.bat/.sh`：檢查 `uv`（缺則 `pip install uv`）→ `uv sync` → `uv run uvicorn main:app --host 0.0.0.0 --port <BACKEND_PORT> --reload`。
- `start-frontend.bat/.sh`、`start-<app>.bat/.sh`：檢查 node →（首次）`npm install` → `npx vite --port <FRONTEND_PORT> --host --strictPort`。
- `stop-all.bat/.sh`：依 `.env` 埠 `taskkill /f /t /pid`（或以 `lsof -ti` + kill）；`status.bat/.sh`：`curl -w "%{http_code}"` 檢查 health／首頁。

**本專案落地差異（刻意，已寫入腳本註解）**
1. 前端**不呼叫 `npx vite`**，而是委派 App 自己的 `Baes44\chronos-flow-chunwo\scripts\start-local.bat`（路徑含 `&`，`npm run dev` 與 `.bin` shim 會壞；埠規則 strictPort 也維持單一來源）。
2. 子視窗改用 `pushd "%~dp0." + start "title" /MIN cmd /c "start-frontend.bat"`，**不用 `start /D "<含 & 的路徑>"`**（實測 `/D` 版本不會建立子視窗，前端永遠起不來）。
3. `start-all.bat` **先起前端、後起後端**，且**後端失敗只 WARNING**（本 App 走 Base44 雲端 API，本地 FastAPI 只是 scaffold）；可用 `SKIP_BACKEND=1` 略過。
4. 後端**不加 `--reload`**：單一行程持有埠，`stop-all.bat` 不會留下 reloader 孤兒行程。
5. `.bat` 訊息全 ASCII 英文（避開 CP950 主控台亂碼）；`.bat` 一律 **CRLF**（LF 會讓 label／goto 失效），`.sh` 維持 LF。
6. `stop-all` **只**殺 `.env` 埠上 LISTENING 的行程，不做 `pkill -f vite` / `taskkill /im uvicorn.exe` 這種會波及別的專案的廣殺。

**Functional Requirements**
- FR-1401：提供 `scripts\start-all.bat`：讀 workspace `.env` 的 `FRONTEND_PORT`／`BACKEND_PORT`；已在跑就跳過；逐一啟動並等待就緒後印出 URL 與 stop 提示。
- FR-1402：提供 `scripts\start-frontend.bat`：啟動本 App 的 Vite dev server（委派 `start-local.bat`），缺 `node_modules` 時才 `npm install --ignore-scripts`。
- FR-1403：提供 `scripts\start-backend.bat`：`uv sync` 後以 `uv run uvicorn main:app --host 0.0.0.0 --port <BACKEND_PORT>` 啟動本地 scaffold。
- FR-1404：提供 `scripts\stop-all.bat`：依 `.env` 埠 `taskkill /f /t /pid`，並逐一回報每個埠的處理結果。
- FR-1405：提供 `scripts\status.bat`：檢查前端首頁、`/health`、SQLite 檔、Base44 雲端可達性與埠佔用。
- FR-1406：每個 `.bat` 都要有 macOS／Linux 對應的 `.sh`（`bash scripts/start-all.sh` 等）。
- FR-1407：桌面「啟動 / 停止 P6 Reader」捷徑改指向 `scripts\start-all.bat` / `scripts\stop-all.bat`。

**Non-Functional Requirements**
- NFR-1401：所有埠只來自 workspace 根 `.env`；腳本內不得出現硬編埠號。
- NFR-1402：腳本不得修改 `.env`／`devops/**`（AGENTS.md 禁改），亦不得改動 `src/**`。
- NFR-1403：`.bat` 必須是 CRLF 且訊息為 ASCII；`.sh` 必須通過 `bash -n`。
- NFR-1404：`start-all` 必須是 idempotent（重複執行不會啟動第二份服務）。

**Constraints**
- C-1401：只能使用既有工具鏈（node 24、uv、curl、netstat、taskkill），不新增依賴。
- C-1402：`scripts\` 屬 workspace 層（AGENTS.md 指定），App 內既有 `Baes44\chronos-flow-chunwo\scripts\` 保留為 App 專屬啓停腳本。

**Acceptance Criteria**
- AC-1401：`scripts\start-all.bat` 在服務全關時 → 前端 HTTP 200、後端 `/health` 200，exit 0。
- AC-1402：服務已在跑時再執行 `start-all.bat` → 兩者都印「already running - skipping start」且不重複啟動。
- AC-1403：`scripts\stop-all.bat` → 兩個埠都不再 LISTENING。
- AC-1404：`scripts\status.bat` 正確反映 RUNNING／STOPPED。
- AC-1405：5 個 `.sh` 全部 `bash -n` exit 0；5 個 `.bat` 全部 CRLF。
- AC-1406：桌面按鈕實測：按「停止」→ 埠全釋放；按「啟動」→ 4 秒內兩個服務都起來。

**驗收證據（2026-09-21 實測）**
```
scripts\start-all.bat（服務全關時）
  >>> Starting frontend (the app) on port 15156 ...
  [start-all] Frontend is ready.
  >>> Starting local backend on port 25156 ...
  [start-all] Backend is ready.
  All services started / Open: http://localhost:15156 / Health: http://localhost:25156/health
  exit=0

scripts\status.bat
  Frontend / app (15156)  : Status: RUNNING  (http://localhost:15156)
  Local backend (25156)   : Status: RUNNING  (health OK)
  Database                : Status: SQLite file present (backend\db\pyworkflow.db)
  Base44 cloud API        : Status: REACHABLE (https://chronos-flow-chunwo.base44.app)
  Listening ports         : 0.0.0.0:25156 28560 / [::1]:15156 33732

scripts\stop-all.bat
  [stop-all] killing frontend PID 34828 on port 15156
  [stop-all] port 25156 (backend) is already free.
  → netstat：15156 / 25156 皆無 LISTENING

桌面按鈕（雙擊等同）
  停止 P6 Reader.lnk → 兩埠皆釋放（STOP OK: both ports free）
  啟動 P6 Reader.lnk → frontend HTTP 200 ~2s、backend {"status":"ok"} → both up after ~4s

語法檢查
  bash -n start-all.sh / start-frontend.sh / start-backend.sh / stop-all.sh / status.sh → 全部 exit 0
  5 個 .bat：CR 數 = LF 數（純 CRLF、無 BOM）

過程中修掉的兩個真實 bug（皆已驗證修正）
  1) start /D "<路徑含 &>" 不會建立子視窗 → 改 pushd + 相對檔名。
  2) if 區塊內 echo 的未轉義括號（(first run only, may take minutes)）→ cmd 報
     「這個時候不應有 ...。」並中止腳本 → 改 ^( ... ^)。
（另：echo %VAR% 若變數值含 & 會被當成命令分隔符，因 %-展開早於特殊字元解析 → 路徑一律加引號輸出。）
```


**RTM（批次 14）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1401 | start-all 依 .env 啟動全部服務（idempotent） | `scripts/start-all.bat` + `.sh` | Operator wants the standard scripts launcher set | Verified |
| FR-1402 | start-frontend 啟動本 App dev server | `scripts/start-frontend.bat` + `.sh` | Operator wants the standard scripts launcher set | Verified |
| FR-1403 | start-backend 啟動本地 FastAPI（uv） | `scripts/start-backend.bat` + `.sh` | Operator wants the standard scripts launcher set | Verified |
| FR-1404 | stop-all 依 .env 埠停止服務 | `scripts/stop-all.bat` + `.sh` | Operator wants the standard scripts launcher set | Verified |
| FR-1405 | status 顯示前端／後端／DB／雲端／埠 | `scripts/status.bat` + `.sh` | Operator wants the standard scripts launcher set | Verified |
| FR-1406 | 每個 .bat 都有對應 .sh | `scripts/*.sh` | Operator wants the standard scripts launcher set | Verified（bash -n 全通過） |
| FR-1407 | 桌面按鈕改指向 scripts\ | `%Desktop%\啟動 P6 Reader.lnk`、`停止 P6 Reader.lnk` | Operator wants the standard scripts launcher set | Verified |
| NFR-1401 | 埠不硬編、只讀 .env | 全部 `scripts/*` | Operator wants the standard scripts launcher set | Verified |
| NFR-1402 | 不動 .env／devops／src | — | Operator wants the standard scripts launcher set | Verified |
| NFR-1403 | .bat CRLF＋ASCII、.sh 過 bash -n | `scripts/*` | Operator wants the standard scripts launcher set | Verified |
| NFR-1404 | start-all 可重複執行 | `scripts/start-all.bat` | Operator wants the standard scripts launcher set | Verified |
| C-1401 | 只用既有工具鏈 | node / uv / curl / netstat / taskkill | Operator wants the standard scripts launcher set | Complete |
| C-1402 | workspace scripts 與 App scripts 並存 | `scripts/`、`Baes44/chronos-flow-chunwo/scripts/` | Operator wants the standard scripts launcher set | Complete |
| AC-1401 | start-all 全關時兩服務都起來，exit 0 | `scripts/start-all.bat` | Operator wants the standard scripts launcher set | Verified |
| AC-1402 | 已在跑時不重複啟動 | `scripts/start-all.bat` | Operator wants the standard scripts launcher set | Verified |
| AC-1403 | stop-all 後兩埠皆非 LISTENING | `scripts/stop-all.bat` | Operator wants the standard scripts launcher set | Verified |
| AC-1404 | status 反映 RUNNING／STOPPED | `scripts/status.bat` | Operator wants the standard scripts launcher set | Verified |
| AC-1405 | bash -n 全通過、.bat 全 CRLF | `scripts/*` | Operator wants the standard scripts launcher set | Verified |
| AC-1406 | 桌面啓停按鈕實測正常 | 桌面捷徑 | Operator wants the standard scripts launcher set | Verified |

---

## ✅ 批次 15（2026-09-21）— `start-all` 改為「後端 opt-in」（預設只起 App）

### User Story
As an **operator**, I want **`scripts\start-all.bat` to start only the app by default**, so that **I don't get an extra local FastAPI service (with its 404-on-`/` console noise) that this app never calls**.

### Entry — 2026-09-21：使用者看到後端 console 的 `GET / → 404`、`GET /favicon.ico → 404` 後決定改為 opt-in

**判讀（實測，非臆測）**：後端本身**完全正常**（`Application startup complete`、`Uvicorn running on http://0.0.0.0:25156`、`GET /health → 200`、`GET /docs → 200`、`GET /openapi.json → 200`）。那兩條 404 是因為 `backend/main.py` 只註冊了 `GET /health` 一個路由（`openapi.json`：`"paths":{"/health":{...}}`），而瀏覽器開 `http://localhost:25156/` 時會自動要求 `/` 與 `/favicon.ico` → FastAPI 一律回 404。本 App 也完全不呼叫這個後端（`Baes44/chronos-flow-chunwo/src/**` 內沒有任何 `25156`／`VITE_BACKEND_URL` 字樣；所有 API 走 Vite proxy 到 Base44 雲端）。

**Functional Requirements**
- FR-1501：`scripts\start-all.bat` 預設**只啟動本 App（前端）**，不啟動本地 FastAPI。
- FR-1502：需要本地後端時可 opt-in：`set START_BACKEND=1 && scripts\start-all.bat`，或單獨執行 `scripts\start-backend.bat`。
- FR-1503：舊旗標 `set SKIP_BACKEND=1` 仍有效（＝強制略過後端）；`.sh` 版行為一致（`START_BACKEND=1 bash scripts/start-all.sh`）。
- FR-1504：彙總輸出要正確反映後端狀態：已啟動 → 印 `Health`；未啟動 → 印 `Backend : not running (opt-in: scripts\start-backend.bat)`；偵測到外部已啟動 → 印「already running on port … - this script did not start it」。

**Non-Functional Requirements**
- NFR-1501：不改變前端行為（App 仍由 `start-frontend.bat` → `start-local.bat` 啟動；埠仍來自 `.env`）。
- NFR-1502：`.bat` 維持 CRLF＋ASCII；`.sh` 維持 `bash -n` 通過。

**Acceptance Criteria**
- AC-1501：全關狀態下跑 `scripts\start-all.bat` → 前端 200、**25156 不 LISTENING**、exit 0。
- AC-1502：`set START_BACKEND=1 && scripts\start-all.bat` → 後端 `/health` 200 且彙總印 `Health`。
- AC-1503：後端已在跑時跑預設 `start-all.bat` → 訊息明確說「this script did not start it」且不重啟。

**驗收證據（2026-09-21 實測）**
```
A) 兩服務都在跑 → scripts\start-all.bat（exit 0）
   [start-all] Frontend already running on port 15156 - skipping start.
   [start-all] Local backend already running on port 25156 - this script did not start it.
   Health     : http://localhost:25156/health

B) stop-all 後 → scripts\start-all.bat（預設，exit 0）
   [start-all] Frontend is ready.
   [start-all] Local backend is opt-in - not started (run scripts\start-backend.bat when you need it).
   Backend    : not running (opt-in: scripts\start-backend.bat)
   → 埠：僅 [::1]:15156 LISTENING；frontend → 200；backend is DOWN (as intended)

C) set START_BACKEND=1 && scripts\start-all.bat（exit 0）
   [start-all] Frontend already running on port 15156 - skipping start.
   >>> Starting local backend on port 25156 ...
   [start-all] Backend is ready.
   Health     : http://localhost:25156/health
   → backend /health → {"status":"ok"}；15156 與 25156 皆 LISTENING
```

**RTM（批次 15）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1501 | start-all 預設只起 App | `scripts/start-all.bat` + `.sh` | Operator wants start-all to start only the app by default | Verified |
| FR-1502 | START_BACKEND=1 可 opt-in 本地後端 | 同上 | Operator wants start-all to start only the app by default | Verified |
| FR-1503 | SKIP_BACKEND=1 仍有效；.sh 行為一致 | 同上 | Operator wants start-all to start only the app by default | Verified |
| FR-1504 | 彙總正確反映後端狀態（started／opt-in／external） | 同上 | Operator wants start-all to start only the app by default | Verified |
| NFR-1501 | 前端行為不變 | `start-frontend.bat` → `start-local.bat` | Operator wants start-all to start only the app by default | Verified |
| NFR-1502 | .bat CRLF＋ASCII、.sh 過 bash -n | `scripts/*` | Operator wants start-all to start only the app by default | Verified |
| AC-1501 | 預設：前端 200、25156 不 LISTENING | `scripts/start-all.bat` | Operator wants start-all to start only the app by default | Verified |
| AC-1502 | opt-in：後端 /health 200 | `scripts/start-all.bat` | Operator wants start-all to start only the app by default | Verified |
| AC-1503 | 外部已啟動時不重啟且訊息明確 | `scripts/start-all.bat` | Operator wants start-all to start only the app by default | Verified |

---

## ✅ 批次 16（2026-09-21）— `start-all` 就緒後自動開啟 App 工具頁

### User Story
As an **operator**, I want **launching `scripts\start-all.bat` to open the app page automatically**, so that **all the tools (Gantt view, import, compare, merge, export, feedback) are immediately in front of me instead of me having to copy the URL**.

### Entry — 2026-09-21：使用者要求「啓動 start-all.bat 後，應該直接開啓全部插件以及工具頁面」

**前置確認（實測）**：本 App 是**單頁應用** —— `src/App.jsx` 只有 `<Route path="/" element={<GanttPage />} />`（其餘路由為 `PageNotFound`），所以**所有工具都在 `/` 這一頁**；自動開啟該網址即涵蓋「全部工具頁面」。`index.html` 的標題為 `Base44 APP`（用作驗證依據）。

**Functional Requirements**
- FR-1601：`scripts\start-all.bat` 在服務就緒（已確認埠 LISTENING）後，以**預設瀏覽器**開啟 `http://localhost:<FRONTEND_PORT>/`。
- FR-1602：`set NO_BROWSER=1` 可停用自動開啟；`set OPEN_URLS="url1 url2"`（空白分隔）可額外開啟其他頁面。
- FR-1603：`start-all.bat` 產生前端子視窗時傳入 `NO_BROWSER=1`，確保每個入口只開一次（不會與子腳本重複開）。
- FR-1604：`scripts\start-frontend.bat` 單獨執行時，若 App 已在回應則開啟；若由它自己啟動 dev server 則維持不開（`call start-local.bat` 是前景阻塞，無法等到就緒才開），並提示改用 `start-all.bat`。
- FR-1605：`.sh` 版行為對齊（macOS `open`、Linux `xdg-open`）。

**Non-Functional Requirements**
- NFR-1601：開啟動作只在**服務就緒後**發生，避免瀏覽器先開而顯示「無法連線」。
- NFR-1602：不改變既有啓停邏輯與埠來源（仍讀 `.env`）；`.bat` 維持 CRLF＋ASCII，`.sh` 維持 `bash -n` 通過。

**Acceptance Criteria**
- AC-1601：全關狀態跑 `scripts\start-all.bat` → 輸出 `[start-all] Opening the app in your default browser: http://localhost:15156/`，且瀏覽器視窗標題為 `Base44 APP`，exit 0。
- AC-1602：`set NO_BROWSER=1 && scripts\start-all.bat` → 只印 `NO_BROWSER=1 - not opening a browser.`，不開啟瀏覽器。
- AC-1603：`set OPEN_URLS=... && scripts\start-all.bat` → App 頁與指定頁面都被開啟。
- AC-1604：`set NO_BROWSER=1 && scripts\start-frontend.bat`（App 已在跑）→ 印 `[start-frontend] NO_BROWSER=1 - not opening a browser.`，且不會啟動第二份 dev server。

**驗收證據（2026-09-21 實測）**
```
預設瀏覽器（URL handler）：HKCU\\...\\UrlAssociations\\http\\UserChoice = ChromeHTML

A) stop-all 後 → scripts\\start-all.bat（exit 0）
   [start-all] Frontend is ready.
   [start-all] Local backend is opt-in - not started (run scripts\\start-backend.bat when you need it).
   [start-all] Opening the app in your default browser: http://localhost:15156/
   → app GET / = HTTP 200；Chrome 視窗標題 = "Base44 APP - Google Chrome"   ← 確認真的開啟

B) set NO_BROWSER=1 && scripts\\start-all.bat（exit 0）
   [start-all] NO_BROWSER=1 - not opening a browser.

C) set OPEN_URLS=http://localhost:15156/src/main.jsx && scripts\\start-all.bat（exit 0）
   [start-all] Opening the app in your default browser: http://localhost:15156/
   [start-all] Opening http://localhost:15156/src/main.jsx

D) set NO_BROWSER=1 && scripts\\start-frontend.bat（App 已在跑）
   [start-frontend] NO_BROWSER=1 - not opening a browser.
   [start-local] Port 15156 is already in use.     ← 不會啟動第二份 dev server（exit 1 屬預期）
```

**RTM（批次 16）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1601 | start-all 就緒後自動開 App 頁 | `scripts/start-all.bat` + `.sh`（`:open_app`） | Operator wants the app page to open automatically | Verified |
| FR-1602 | NO_BROWSER=1 停用、OPEN_URLS 加開頁面 | 同上 | Operator wants the app page to open automatically | Verified |
| FR-1603 | 每個入口只開一次（子視窗帶 NO_BROWSER=1） | `scripts/start-all.bat` 子視窗啟動行 | Operator wants the app page to open automatically | Verified |
| FR-1604 | start-frontend 僅在 App 已在回應時才開 | `scripts/start-frontend.bat` + `.sh` | Operator wants the app page to open automatically | Verified |
| FR-1605 | macOS／Linux 對齊 | `scripts/*.sh`（open／xdg-open） | Operator wants the app page to open automatically | Verified |
| NFR-1601 | 只在服務就緒後才開（避免連線失敗頁） | `start-all.bat`（等埠 LISTENING 後才呼叫 `:open_app`） | Operator wants the app page to open automatically | Verified |
| NFR-1602 | 不改啓停邏輯與埠來源；格式規範不變 | `scripts/*` | Operator wants the app page to open automatically | Verified |
| AC-1601 | 預設會開啟且視窗標題為 Base44 APP，exit 0 | `scripts/start-all.bat` | Operator wants the app page to open automatically | Verified |
| AC-1602 | NO_BROWSER=1 不開啟 | 同上 | Operator wants the app page to open automatically | Verified |
| AC-1603 | OPEN_URLS 額外頁面也開啟 | 同上 | Operator wants the app page to open automatically | Verified |
| AC-1604 | start-frontend 不重複開、不啟動第二份 server | `scripts/start-frontend.bat` | Operator wants the app page to open automatically | Verified |

---

## ✅ 批次 17（2026-09-21）— 專案管理（選擇專案／上傳／存檔）：接上本機後端

### User Story
As an **operator**, I want **the same 選擇專案 / 上傳 / 存檔 toolbar that the `py-workflow-programme reader` project has**, so that **I can keep several programmes in named projects, upload a programme file and pick up where I left off**.

### Entry — 2026-09-21：使用者提供參考專案的 ProjectBar HTML，要求把該功能帶進本 App

**參考專案作法（實讀原始碼）**
- UI：`frontend/src/components/gantt/ProjectBar.jsx`（掛在 GanttPage header 專案標題右側）；下拉支援新增／切換／刪除專案，顯示來源格式與版本數。
- 後端：`backend/models.py`（`Project` / `ProgrammeVersion`，SQLite，`payload` JSON）、`routers/projects.py`（list/create/get/delete + `/import`）、`routers/versions.py`（versions CRUD + tasks update/bulk/replace + compare）。
- 資料形狀：`payload = { tasks, meta: { source_filename, source_format } }`；切換專案時以 `latest_version.payload` 灌回編輯器。
- 參考專案把 Base44 SDK 換成自家 `/api/*` client（他們沒有雲端代理）。

**本專案落地差異（已寫入程式註解）**
1. `/api` 在本 App 屬 **Base44 雲端代理** → 本機 API 改用 `/local-api` 前綴，由 Vite proxy 轉到 `http://localhost:<BACKEND_PORT>`（埠讀根目錄 `.env`，不硬編）；後端 router 前綴為 `/projects`（參考專案為 `/api/projects`）。
2. App 本體**完全不變**：仍走 Base44 雲端 LLM／proxy；專案管理另走本機後端（不改 `src/api/base44Client.js`）。
3. 「上傳」預設在**瀏覽器解析**（用本 App 自己的 parser：`parseXER` + `parseXerTables`、`parseP6XML`、`parseExcelFile`），所以與 App 既有 Import 行為一致，並保留 XER 無損原表；後端**仍保留** `POST /projects/{id}/import`（Python parsers，備援直上大檔）。
4. 後端 parsers 為參考專案的 Python ports，其欄位是本 App JS parser 的子集（無 `sectionLevel` / `p6WbsId`），故 `/import` 會標記 `meta.import_source="server"`，僅作備援。

**Functional Requirements**
- FR-1701：GanttPage header 提供「選擇專案／上傳／存檔」三顆按鈕（文案、圖示、樣式與參考專案一致），下拉支援新增、切換、刪除專案與重新整理。
- FR-1702：`選擇專案` 列出本機後端專案（名稱、來源格式、版本數）；選取後以 `latest_version.payload.tasks` 載入編輯器（解析關係連結、寫入 undo 歷史、重設選取、同步專案標題）。
- FR-1703：`上傳` 接受 `.xer/.xml/.xlsx/.xls/.csv`；未選專案時提示先建立／選擇專案。
- FR-1704：`上傳` 預設於瀏覽器解析 → 建立新版本（`meta.import_source="client"`）→ 立即載入編輯器；`.xer` 另保留原始表以維持無損 XER→XER 匯出。
- FR-1705：`存檔` 以目前編輯器 tasks 建立新版本（名稱 `Save <時間>`），成功後顯示 ✓ 提示。
- FR-1706：後端提供 `GET/POST /projects`、`GET/DELETE /projects/{id}`、`GET/POST /projects/{id}/versions[...]`、`POST /projects/{id}/import`（伺服器端解析）。
- FR-1707：後端不可用時 UI 顯示可讀提示（「本地後端未啟動 — 請執行 scripts\start-backend.bat」），且不影響 App 其他功能。

**Non-Functional Requirements**
- NFR-1701：本機 API 埠只來自 workspace 根目錄 `.env` 的 `BACKEND_PORT`；前端不得硬編埠號（由 Vite proxy 轉發）。
- NFR-1702：`src/**` 既有行為不變——只新增檔案（`src/lib/localApi.js`、`src/components/gantt/ProjectBar.jsx`）＋ GanttPage 三處最小改動；對 Base44 的呼叫完全不動。
- NFR-1703：ESLint 對新增／修改檔案 0 error；`node scripts/smoke-test.mjs` 仍 exit 0（`GanttPage (full page render)` OK）。
- NFR-1704：後端既有 `/health` 與 scaffold 行為不變（新增 router，不取代）。

**Constraints**
- C-1701：`.env`（root）、`devops/**` 不可修改。
- C-1702：不得把 Base44 SDK 換成本機 client（與參考專案不同）——App 的 LLM／雲端流程必須維持原狀。
- C-1703：新相依僅限後端：`openpyxl`（xlsx 解析）、`python-multipart`（FastAPI `Form`／`UploadFile`）。

**Acceptance Criteria**
- AC-1701：`POST /projects`（multipart）建立成功；`GET /projects` 回傳含 `version_count`。
- AC-1702：`POST /projects/{id}/versions` 後，`GET /projects/{id}` 的 `latest_version.payload.tasks` 與送出內容一致。
- AC-1703：`POST /projects/{id}/import` 對真實 632 KB XER 回報 `task_count=886`、`section_count=191`，且 `meta.import_source="server"`。
- AC-1704：經 Vite proxy（`http://localhost:15156/local-api/...`）可完成 建立／列表／建立版本／刪除。
- AC-1705：`ProjectBar.jsx`、`localApi.js`、`GanttPage.jsx` 由 dev server 轉譯皆 **HTTP 200**。
- AC-1706：ESLint 0 error；smoke test exit 0。

**驗收證據（2026-09-21 實測）**
```
1) 建專案（multipart）：POST /projects → id=ca0f713e-… name=Smoke Project versions=0
2) 建版本（JSON）：POST /projects/{id}/versions → version=v1 tasks=2 task_count=1
3) 讀回：GET /projects/{id} → latest=v1 tasks=2 meta={"source_format":"manual","import_source":"client"}
4) 伺服器端解析真實 XER（632 KB, C:\Users\ken.li\Downloads\6WSD21-DP_202409.xer）：
   POST /projects/{id}/import → format=xer tasks=886 sections=191 total=1077
   payload.meta={"source_filename":"6WSD21-DP_202409.xer","source_format":"xer","import_source":"server"}
   首個 task 具備 activityId / activity / start / links[{succId,type,lag}] / p6Guid / earlyStart / _originalXerData …
5) Vite proxy：GET http://localhost:15156/local-api/projects → "Proxy Test"
   POST …/local-api/projects/{id}/versions → v-proxy tasks=1；DELETE → 0 left
6) 前端轉譯：ProjectBar.jsx 200 (46.9 KB)、localApi.js 200 (18.1 KB)、GanttPage.jsx 200 (251.3 KB)
7) 品質：ESLint 0 error（GanttPage 另有 6 個既有 warning，與本次無關）；
        smoke test exit 0，GanttPage full page render OK (193821 chars)
8) SQLite：tables = ['programme_versions','projects']；測試資料已刪除 + VACUUM（24 KB）

新增／修改檔案
  backend/models.py                                    新增（源自參考專案）
  backend/parsers/{__init__,xer_parser,p6xml_parser,excel_parser}.py  新增（複製自參考專案）
  backend/routers/{__init__,projects,versions}.py      新增（前綴 /projects；import 標記 import_source=server）
  backend/main.py                                     掛載兩個 router；/health 不變
  backend/pyproject.toml、backend/requirements.txt       +openpyxl、+python-multipart
  src/lib/localApi.js                                  新增（/local-api client + 後端未啟動提示）
  src/components/gantt/ProjectBar.jsx                  新增（UI 與參考專案一致；上傳預設前端解析）
  src/pages/GanttPage.jsx                              +import ProjectBar、+currentProjectId、+handleProjectLoaded、header 掛載
  vite.config.js                                      + /local-api proxy → BACKEND_PORT（埠讀 .env）
  doc/requirements.md                                  本篇

已知／刻意差異
  * smoke test 的「UnifiedGanttLayout WBS row colours」顯示 UNEXPECTED：該斷言寫於 9/18 10:46，而
    UnifiedGanttLayout.jsx 於同日 18:10 才被更新 → 屬既有過時斷言（與本次改動無關，本次未修改它）。
  * /import（後端解析）欄位較少（無 sectionLevel / p6WbsId）→ 僅作備援路徑。
  * 本機後端仍為 opt-in：要用專案管理時請 `set START_BACKEND=1` 或執行 `scripts\start-backend.bat`。
```

**RTM（批次 17）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1701 | header 三顆按鈕＋下拉（新增/切換/刪除/重新整理） | `ProjectBar.jsx`、`GanttPage.jsx` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| FR-1702 | 選取專案載入 latest_version.payload.tasks | `ProjectBar.jsx`、`handleProjectLoaded` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| FR-1703 | 上傳接受 .xer/.xml/.xlsx/.xls/.csv | `ProjectBar.jsx` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| FR-1704 | 上傳＝前端解析＋建立版本＋載入編輯器 | `ProjectBar.jsx`、App parsers | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| FR-1705 | 存檔＝以目前 tasks 建新版本 | `ProjectBar.jsx` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| FR-1706 | 後端 projects/versions/import API | `backend/routers/*`、`models.py` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| FR-1707 | 後端不可用時的 UI 提示，不影響其他功能 | `localApi.js`、`ProjectBar.jsx` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| NFR-1701 | 埠只讀 .env（Vite proxy） | `vite.config.js`、`localApi.js` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| NFR-1702 | src/** 既有行為不變（最小改動） | `GanttPage.jsx` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| NFR-1703 | ESLint 0 error、smoke test exit 0 | dev 品質閘門 | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| NFR-1704 | /health 與 scaffold 行為不變 | `backend/main.py` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| C-1701 | .env／devops/** 未修改 | — | Operator wants the 選擇專案/上傳/存檔 toolbar | Complete |
| C-1702 | 保留 Base44 SDK（不換成 local client） | `src/api/base44Client.js`（未改） | Operator wants the 選擇專案/上傳/存檔 toolbar | Complete |
| C-1703 | 新相依僅 openpyxl／python-multipart | `backend/pyproject.toml` | Operator wants the 選擇專案/上傳/存檔 toolbar | Complete |
| AC-1701 | 建立專案＋列表含 version_count | `POST/GET /projects` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| AC-1702 | latest_version.payload 與送出內容一致 | `GET /projects/{id}` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| AC-1703 | /import 解析真實 632 KB XER（886 activities） | `POST /projects/{id}/import` | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| AC-1704 | 經 Vite proxy 完成 CRUD | `/local-api` proxy | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| AC-1705 | 三個前端檔案轉譯 HTTP 200 | dev server | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |
| AC-1706 | ESLint 0 error、smoke exit 0 | 品質閘門 | Operator wants the 選擇專案/上傳/存檔 toolbar | Verified |

---

## ✅ 批次 18（2026-09-21）— Tools / Display 大整理：xerviewer 式「統一設定面板」

### User Story
As an **operator**, I want **every Gantt / display setting grouped in one right-hand panel with a category rail (WBS · Activity List · Timeline & Grid · Gantt Bars · Other), like xerviewer.org**, so that **I no longer have to hunt through two header dropdowns and two separate modals to change how the chart looks**.

### Entry — 2026-09-21：使用者提供 xerviewer.org 的 Global Settings 面板 HTML，要求「根據設定模板，重新整理所有 Tools 與 Display 等功能的擺放」

**參考對象（xerviewer.org Global Settings 面板）**
- 右側滑出面板（約 410px 寬、可拖左緣調整），左側為 **w-16 圖示分類軌**：`WBS` / `Activity List` / `Timeline & Grid` / `Gantt Bars` / `Other`（圓形按鈕＋8px 標籤，選中＝藍框）。
- 內容區＝標題（如 `WBS Settings`）＋右上 `×`，下方可捲動的設定區塊；panel 左緣是 `cursor-ew-resize` 拖曳把手。

**本專案的整理（舊位置 → 新位置）**

| 面板分類 | 內容來源 | 原本位置 |
|---|---|---|
| **WBS** | `WbsSettingsPanel`（15 組配色、Hide Empty WBS Rows、Show Group Headers、Customise Grouping、Custom WBS Level Styles） | header「WBS Settings」按鈕（獨立模態） |
| **Activity List** | `ViewPresets` ＋ `ColumnVisibilityPanel`（欄位顯示／Presets） | header「Tools ▸ ViewPresets / Column Visibility」 |
| **Timeline & Grid** | `GanttSettingsPanel` 的 grid ＋ timeline 兩段（日期格式、格線開關、時間刻度） | 「Gantt Settings ▸ Grid & Format / Timeline」＋ Display 下拉的日期格式／格線 |
| **Gantt Bars** | `GanttSettingsPanel` 的 bars ＋ labels 兩段（Preset、Bar 外觀、標籤） | 「Gantt Settings ▸ Bars / Labels」 |
| **Other** | 6 個顯示開關（Holiday Markers／Staircase Line／Relationship Lines／Compare Bars／Diff Only／Relation Filter）＋關係類型篩選（FS/SS/FF/SF）＋清除選取＋字級滑桿＋`GanttSettingsPanel` 的 structure 段 | header「Display」下拉整組 ＋「Gantt Settings ▸ Structure」 |

**Functional Requirements**
- FR-1801：新增 `GlobalSettingsPanel.jsx`：右側面板＋左側 5 類圖示軌＋標題／關閉鈕；點分類即時切換內容（單一分頁顯示）。
- FR-1802：面板左緣可拖曳調整寬度（340–760px），並記住寬度與最後使用的分類（localStorage `gantt_global_settings_width` / `gantt_global_settings_tab`）。
- FR-1803：面板內容由既有面板以 **embedded 模式** 提供，不重複外殼／標題／分頁：`WbsSettingsPanel`、`ColumnVisibilityPanel`、`GanttSettingsPanel`（可用 `initialTab` 指定 bars / labels / grid / timeline / structure 段）。
- FR-1804：header 只保留 **一顆 Settings 按鈕** 開啟面板；移除原本的「Gantt Settings」「WBS Settings」按鈕與「Display」下拉。
- FR-1805：Display 下拉的功能必須全部保留並搬進 Other 分頁（6 開關＋關係類型篩選＋清除選取＋字級滑桿）；日期格式／格線開關由 Timeline & Grid 分頁承接，不重複。
- FR-1806：Tools 下拉保留動作類工具（P6 Filters、Compare Versions、XML Relationship Editor、Refresh Holidays、Snapshots）與 Import／Export、Undo／Redo、Clear、Info、Search、時間刻度；設定類（ViewPresets、Column Visibility）移入面板。
- FR-1807：`ColumnVisibilityPanel` 由甘特表頭（`onOpenColumnPanel`）開啟的快速入口維持可用（非嵌入模式）。

**Non-Functional Requirements**
- NFR-1801：既有設定鍵與預設值不變（`displaySettings` 結構、localStorage key 皆不動），外觀與行為一致。
- NFR-1802：`embedded` 模式不得改變面板「獨立開啟」時的既有外觀與行為（原模態仍可用）。
- NFR-1803：ESLint 0 error；煙霧測試新增 6 項檢查且維持 exit 0。
- NFR-1804：檔案行尾維持既有慣例（`src/*.jsx` = LF、`scripts/*.mjs` = CRLF）。

**Constraints**
- C-1801：不改變 Gantt 資料流（`tasks` / `displaySettings` / 欄位狀態來源不變），僅調整 UI 擺放。
- C-1802：不新增任何第三方依賴。

**Acceptance Criteria**
- AC-1801：SSR 可渲染面板 5 個分類（wbs / activity-list / timeline-grid / gantt-bars / other）皆不拋錯。
- AC-1802：SSR 標記檢查：圖示軌 5 個標籤齊全、各分類內容存在、且**嵌入時不出現重複標題**（無 `gantt-wbs-settings-title`、無 `Gantt Settings`）。
- AC-1803：header 只剩一顆 Settings 按鈕（`Display`／`Gantt Settings`／`WBS Settings` 字樣不再出現於 GanttPage header）。
- AC-1804：5 個前端模組由 dev server 轉譯皆 HTTP 200。

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs（exit 0）
  GanttPage (full page render): OK (191971 chars)
  GlobalSettingsPanel (wbs tab): OK (17327 chars)
  GlobalSettingsPanel (activity-list tab): OK (28525 chars)
  GlobalSettingsPanel (timeline-grid tab): OK (12312 chars)
  GlobalSettingsPanel (gantt-bars tab): OK (11468 chars)
  GlobalSettingsPanel (other tab): OK (9819 chars)
  GlobalSettingsPanel markup (rail + 5 category bodies + chromeless embed):
      OK (rail 5 labels, all bodies present, no duplicate titles)

Vite dev server 轉譯
  /src/components/gantt/GlobalSettingsPanel.jsx     HTTP 200 (40.6 KB)
  /src/pages/GanttPage.jsx                          HTTP 200 (228.7 KB)
  /src/components/gantt/GanttSettingsPanel.jsx      HTTP 200 (102.1 KB)
  /src/components/gantt/WbsSettingsPanel.jsx        HTTP 200 (53.0 KB)
  /src/components/gantt/ColumnVisibilityPanel.jsx   HTTP 200 (49.8 KB)

ESLint（新增／修改檔案）0 error（`--fix` 清掉 6 個因重整而變成未使用的 import）
GanttPage.jsx：1364 → 1230 行（header 三個舊入口 → 一顆 Settings 按鈕），純 LF、無 BOM

新增／修改檔案
  src/components/gantt/GlobalSettingsPanel.jsx   新增（xerviewer 式面板：圖示軌＋分類內容＋可拖寬度＋記憶分類／寬度）
  src/components/gantt/GanttSettingsPanel.jsx    +embedded 模式（隱藏外殼／標題／分頁列）
  src/components/gantt/WbsSettingsPanel.jsx      +embedded 模式
  src/components/gantt/ColumnVisibilityPanel.jsx +embedded 模式（隱藏外框／標題／Done 頁尾）
  src/pages/GanttPage.jsx                        header 改為單一 Settings；Display 下拉功能搬入面板；
                                                 +displayToggles / +otherExtras / +viewPresetsNode；移除 2 個舊模態與 2 個 Tools 項目
  scripts/smoke-test.mjs                         +6 項批次 18 迴歸檢查

已知／刻意差異
  * header 的「Display」下拉不再存在（內容全部移到面板的 Other 與 Timeline & Grid 分頁）。
  * Tools 下拉僅保留動作類工具；設定類（ViewPresets、Column Visibility）改由面板提供。
  * 煙霧測試的「UnifiedGanttLayout WBS row colours」仍為 UNEXPECTED：該斷言寫於 9/18 10:46，
    而 UnifiedGanttLayout.jsx 於同日 18:10 才更新 → 既有過時斷言，與本批次無關（本次未修改）。
```

**RTM（批次 18）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1801 | 統一設定面板（圖示軌＋5 分類＋標題／關閉） | `GlobalSettingsPanel.jsx` | Operator wants all settings in one xerviewer-style panel | Verified |
| FR-1802 | 左緣可拖曳調寬＋記憶分類／寬度 | `GlobalSettingsPanel.jsx`（localStorage） | Operator wants all settings in one xerviewer-style panel | Verified |
| FR-1803 | 既有面板 embedded 模式（無重複外殼） | `GanttSettingsPanel` / `WbsSettingsPanel` / `ColumnVisibilityPanel` | Operator wants all settings in one xerviewer-style panel | Verified |
| FR-1804 | header 只留一顆 Settings 按鈕 | `GanttPage.jsx` | Operator wants all settings in one xerviewer-style panel | Verified |
| FR-1805 | Display 下拉功能全數保留（Other 分頁） | `GanttPage.jsx`（`displayToggles` / `otherExtras`） | Operator wants all settings in one xerviewer-style panel | Verified |
| FR-1806 | Tools 保留動作類工具、設定類移入面板 | `GanttPage.jsx` | Operator wants all settings in one xerviewer-style panel | Verified |
| FR-1807 | 甘特表頭的欄位面板快速入口仍可用 | `onOpenColumnPanel` → `ColumnVisibilityPanel` | Operator wants all settings in one xerviewer-style panel | Verified |
| NFR-1801 | 設定鍵／預設值／外觀不變 | `displaySettings`、localStorage keys | Operator wants all settings in one xerviewer-style panel | Verified |
| NFR-1802 | embedded 不影響獨立開啟的外觀 | 三個面板 | Operator wants all settings in one xerviewer-style panel | Verified |
| NFR-1803 | ESLint 0 error、煙霧測試 exit 0（+6 檢查） | 品質閘門 | Operator wants all settings in one xerviewer-style panel | Verified |
| NFR-1804 | 行尾慣例維持（jsx LF／mjs CRLF） | `src/**`、`scripts/smoke-test.mjs` | Operator wants all settings in one xerviewer-style panel | Verified |
| C-1801 | 不改 Gantt 資料流 | `GanttPage.jsx` | Operator wants all settings in one xerviewer-style panel | Complete |
| C-1802 | 不新增第三方依賴 | — | Operator wants all settings in one xerviewer-style panel | Complete |
| AC-1801 | 5 個分類 SSR 皆 OK | `GlobalSettingsPanel.jsx` | Operator wants all settings in one xerviewer-style panel | Verified |
| AC-1802 | 標記檢查（軌 5 標籤／內容／無重複標題） | smoke-test batch 18 guard | Operator wants all settings in one xerviewer-style panel | Verified |
| AC-1803 | header 舊入口字樣不再出現 | `GanttPage.jsx` | Operator wants all settings in one xerviewer-style panel | Verified |
| AC-1804 | 5 個模組轉譯 HTTP 200 | dev server | Operator wants all settings in one xerviewer-style panel | Verified |

---

## ✅ 批次 19（2026-09-21）— 補上 xerviewer 的「Customise Grouping」（Group By / To Level / Status）

### User Story
As a **planner**, I want **to control how the WBS grouping is presented — or switch it off — right from the settings panel**, so that **I can show only the top-level phases, drill down to a chosen WBS level, or work with a flat activity list**.

### Entry — 2026-09-21：使用者提供 xerviewer.org 的「Customise Grouping」區塊 HTML，要求整理後補上該功能

**參考對象（xerviewer.org ▸ WBS Settings ▸ Customise Grouping）**
- 可收合區塊（標題＋ chevron 展開／收合），表格式三欄：`Group By | To Level | Status`。
- 目前僅一列：`WBS` ／ To Level 下拉（`All Levels`）／ Status（眼睛圖示＝啟用／停用該分組）。
- 底部 `+ Add New Grouping Header`（參考站為**停用**狀態）。

**本專案落地（批次 8 曾列為「刻意未做」，本次補齊）**

| 參考元素 | 本專案實作 |
|---|---|
| `Group By` | 固定 `WBS`（本 App 的 WBS 列由 XER／Excel 匯入產生，其他分組來源未匯入 → 下拉僅一個選項，與參考站一致） |
| `To Level` | `All Levels` ＋ `Level 1..7`（`WBS_GROUP_LEVELS`）；只影響 **WBS 群組標題列**，活動列完全不動 |
| `Status` | 眼睛圖示切換該分組啟用／停用（`role="checkbox"` ＋ `aria-checked`）；關閉＝隱藏全部 WBS 標題列（平面活動清單） |
| `+ Add New Grouping Header` | 依參考站維持**停用**，並以 tooltip 說明原因 |
| 位置 | 設定面板 ▸ **WBS** 分頁，介於「Show Group Headers on Gantt」與「Custom WBS Level Styles」之間（與參考站同序） |
| 儲存 | `displaySettings.grouping`（top level，隨 `gantt_display_settings` 一起持久化；舊資料自動補預設值） |

**Functional Requirements**
- FR-1901：WBS 分頁提供可收合的 **Customise Grouping** 區塊，含 `Group By | To Level | Status` 表頭與一列 WBS 分組列。
- FR-1902：`To Level` 可選 `All Levels` / `Level 1..7`；套用後只保留 `sectionLevel <= N` 的 **WBS 群組標題列**。
- FR-1903：`Status` 眼睛切換可停用分組 → 隱藏全部 WBS 標題列，再切回即恢復。
- FR-1904：`+ Add New Grouping Header` 依參考站保持停用並說明原因。
- FR-1905：設定存放於 `displaySettings.grouping`（`cloneGrouping` 正規化、`mergeDisplaySettings` 補預設、`cloneDefaults` 深拷貝）。
- FR-1906：`applyWbsGrouping(tasks, grouping)` 為純函式，於 GanttPage 衍生資料管線中套用（接在「Hide Empty WBS Rows」之後）。
- FR-1907：預設值＝一列啟用的 WBS＋`All Levels` → **既有外觀完全不變**。

**Non-Functional Requirements**
- NFR-1901：活動列（非 section）在任何設定下都不得被增刪或重排。
- NFR-1902：只影響畫面（表格／甘特／PDF 取自同一 `computedTasks`），不寫入 XER／XML 匯出內容。
- NFR-1903：ESLint 0 error；煙霧測試新增／擴充檢查並維持 exit 0。

**Constraints**
- C-1901：不新增第三方依賴；不改變 `displaySettings` 既有鍵。
- C-1902：`src/**` 行尾慣例維持（各檔自身一致：本批三個檔案維持原 LF／CRLF）。

**Acceptance Criteria**
- AC-1901：`applyWbsGrouping` 對 fixture（level 1/2/3 ＋ 2 個活動）→ `All Levels` 保留 [1,3,5]、`Level 1` 只留 [1]、停用留 `[]`，且活動數恆為 2。
- AC-1902：`cloneGrouping(undefined)` → 1 列、`toLevel="all"`、`enabled=true`；`WBS_GROUP_LEVELS` 長度 8（All Levels ＋ Level 1..7）。
- AC-1903：WbsSettingsPanel SSR 標記 29 項齊全（含 `Customise Grouping`／`Group By`／`To Level`／`Status`／`All Levels`／`+ Add New Grouping Header`）。
- AC-1904：`displaySettings.js`／`WbsSettingsPanel.jsx`／`GanttPage.jsx` 由 dev server 轉譯 HTTP 200。

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs（exit 0）
  WbsSettingsPanel markup (schemes + toggles + grouping + level styles): OK (all 29 markers present)
  Customise Grouping (applyWbsGrouping: all / to level / off):
      OK (group headers all=[1,3,5] level1=[1] off=[], activities kept)
  GanttPage (full page render): OK (191971 chars)
  GlobalSettingsPanel (wbs tab): OK (20154 chars)         ← 批次 18 時為 17327（新增分組區塊）

Vite dev server 轉譯
  /src/lib/displaySettings.js                       HTTP 200 (120.3 KB)
  /src/components/gantt/WbsSettingsPanel.jsx        HTTP 200 (77.2 KB)
  /src/pages/GanttPage.jsx                          HTTP 200 (228.5 KB)
  /src/components/gantt/GlobalSettingsPanel.jsx     HTTP 200 (40.6 KB)
ESLint（新增／修改檔案）0 error

修改檔案
  src/lib/displaySettings.js                  +grouping 預設／正規化／merge／cloneDefaults；
                                              +WBS_GROUP_LEVELS、GROUP_BY_OPTIONS、defaultGrouping、cloneGrouping、applyWbsGrouping
  src/components/gantt/WbsSettingsPanel.jsx   +Customise Grouping 區塊（可收合、Group By／To Level／Status、停用的 Add 按鈕）
  src/pages/GanttPage.jsx                     衍生管線套用 applyWbsGrouping（Hide Empty WBS Rows 之後）
  scripts/smoke-test.mjs                      WBS 標記 23→29；新增分組邏輯檢查；批次 18 的 wbs body 標記加 "Customise Grouping"

限制（與參考站一致）
  * Group By 只有 WBS 一個選項；`+ Add New Grouping Header` 停用（本 App 未匯入資源／活動代碼等其他分組來源）。
  * To Level 指的是「WBS 群組標題顯示到第幾層」，不是重新分組活動——活動列的內容與順序不變。
```

**RTM（批次 19）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1901 | WBS 分頁的可收合 Customise Grouping 區塊 | `WbsSettingsPanel.jsx` | Planner wants to control the WBS grouping presentation | Verified |
| FR-1902 | To Level（All Levels／Level 1..7）只影響群組標題列 | `applyWbsGrouping` + `GanttPage.jsx` | Planner wants to control the WBS grouping presentation | Verified |
| FR-1903 | Status 眼睛切換停用／啟用分組 | `WbsSettingsPanel.jsx`（`role="checkbox"`） | Planner wants to control the WBS grouping presentation | Verified |
| FR-1904 | Add New Grouping Header 依參考站停用＋說明 | `WbsSettingsPanel.jsx` | Planner wants to control the WBS grouping presentation | Verified |
| FR-1905 | 設定存於 displaySettings.grouping（含舊資料相容） | `displaySettings.js`（merge／clone） | Planner wants to control the WBS grouping presentation | Verified |
| FR-1906 | applyWbsGrouping 純函式，接在 Hide Empty 之後 | `displaySettings.js` + `GanttPage.jsx` | Planner wants to control the WBS grouping presentation | Verified |
| FR-1907 | 預設＝All Levels＋啟用 → 外觀不變 | `DEFAULT_DISPLAY_SETTINGS.grouping` | Planner wants to control the WBS grouping presentation | Verified |
| NFR-1901 | 活動列不被增刪或重排 | `applyWbsGrouping` | Planner wants to control the WBS grouping presentation | Verified |
| NFR-1902 | 只影響畫面，不寫入 XER／XML 匯出 | GanttPage 衍生管線 | Planner wants to control the WBS grouping presentation | Verified |
| NFR-1903 | ESLint 0 error、煙霧測試 exit 0 | 品質閘門 | Planner wants to control the WBS grouping presentation | Verified |
| C-1901 | 不新增依賴、不改既有設定鍵 | `displaySettings.js` | Planner wants to control the WBS grouping presentation | Complete |
| C-1902 | 行尾慣例維持 | 三個檔案 | Planner wants to control the WBS grouping presentation | Verified |
| AC-1901 | applyWbsGrouping 三種情境結果正確 | smoke-test batch 19 guard | Planner wants to control the WBS grouping presentation | Verified |
| AC-1902 | cloneGrouping／WBS_GROUP_LEVELS 內容正確 | 同上 | Planner wants to control the WBS grouping presentation | Verified |
| AC-1903 | 面板 SSR 標記 29 項齊全 | `WbsSettingsPanel.jsx` | Planner wants to control the WBS grouping presentation | Verified |
| AC-1904 | 三個模組轉譯 HTTP 200 | dev server | Planner wants to control the WBS grouping presentation | Verified |

---

## 🔥 批次 19.1 熱修（2026-09-21）— Customise Grouping 的「To Level」看起來沒作用

### 使用者回報
「點選 Customise Grouping 中的 To Level 選擇不同 level 後，並沒有按我預期內直接改變顯示的 level」，並要求回去 <https://www.xerviewer.org/> 確認對應的**顯示變動模式**。

### 調查（一）參考站的實際邏輯（下載 bundle 分析）
- 參考站主 bundle：`https://www.xerviewer.org/assets/index-Dk7vBzdm.js`（2,078,462 bytes；雜湊與批次 2／8 記錄的不同 → 網站已更新）。
- 找到 `collapseToActivityCodeGroup` 的實作（節錄）：
  ```js
  const q = T === "all" || W.level <= T ? [...path, W.id] : path;  // T = wbsGroupingLevel
  W.tasks.forEach(task => N.set(task.id, q));                      // 每個 task 的「群組路徑」
  W.children && B(W.children, q);
  ```
  → **To Level 的語意＝限制「群組路徑」深度**：只有 `level <= T` 的 WBS 節點會進入群組路徑，更深節點的活動自動歸到最接近的祖先群組列；`level > T` 的 WBS 列不再顯示。
- `To Level` 選項是**依檔案實際最深層級生成**（`All Levels` + `Level 1..maxLevel`），不是固定 1..7。
- 當 WBS 分組被關閉（眼睛 off）時，`To Level` 下拉會被**鎖住**（`!isWbsGroupingEnabled && <div className="absolute inset-0 … cursor-not-allowed">`）。
- 官方說明頁：`Customise Grouping controls WBS levels and activity-code grouping headers.`

**結論：批次 19 的 `applyWbsGrouping` 語意與參考站一致**（剔除 `level > T` 的群組列、活動列不動）。批次 19 的實作沒有理解錯誤。

### 調查（二）為什麼「看不出變化」——資料本身幾乎是平的
以使用者實際使用的 XER 直接量測（`C:\Users\ken.li\Downloads\6WSD21-DP_202409.xer`）：

```
PROJWBS rows: 191（以 parent_wbs_id 走訪父鏈計算深度）
depth distribution (0 = top): 1=184, 2=4, 3=3
parseXER → sections 191，sectionLevel {1: 184, 2: 4, 3: 3}   ← 與原始檔完全一致（parser 正確）
applyWbsGrouping：all = 191 群組列 / Level 1 = 184 / Level 2 = 188 / Level 3+ = 191（activities 一律 886）
```

→ 這個檔案的 WBS **有 184 個節點直接掛在專案根下**（僅 4 個第 2 層、3 個第 3 層），所以切換 Level 只會少 3～7 個標題列 → 幾乎看不出差異。**同一份檔案在參考站也會得到同樣結果**（他們的 `maxLevel` 同樣是 3）。

### 修正（讓控制項「看得出在做什麼」）
- **選項改為資料驅動**：`All Levels` + `Level 1..maxLevel`（依載入的 programme 實際層級），不再固定列到 Level 7。
- **新增層級統計提示**（表格下方）：
  `WBS 層級：3 層（L1 184 ／ L2 4 ／ L3 3 個群組）・目前顯示 191 個群組標題`
  → 選 Level 2 會變成 `… 目前顯示 188 個群組標題（隱藏 3 個）`；若資料沒有任何階層則顯示「此檔案 WBS 只有 1 層，Level 1 與 All Levels 相同」。
- **分組關閉時鎖住 To Level 下拉**（與參考站一致），tooltip 說明「先把眼睛打開才能選層級」。
- 新增純函式並納入測試：`wbsLevelOptions(maxLevel)`、`wbsLevelCounts(tasks)`、`wbsVisibleGroupCount(counts, toLevel)`。

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs（exit 0）
  Customise Grouping (applyWbsGrouping: all / to level / off): OK (all=[1,3,5] level1=[1] off=[], activities kept)
  Customise Grouping level options + inventory (data-driven, xerviewer parity):
      OK (flat: 3 層 → all,1,2,3，群組 191/184/188；nested: 4 層 → all,1,2,3,4；無階層 → 1 層)
  WbsSettingsPanel grouping inventory (levels present in the file):
      OK (All Levels + Level 1-3 only, level summary shown)
  WbsSettingsPanel markup (schemes + toggles + grouping + level styles): OK (all 29 markers present)

Vite dev server 轉譯：displaySettings.js 200 (129.7 KB)、WbsSettingsPanel.jsx 200、
                     GlobalSettingsPanel.jsx 200 (40.7 KB)、GanttPage.jsx 200 (229.1 KB)
ESLint（修改檔案）0 error

修改檔案
  src/lib/displaySettings.js                    +wbsLevelOptions / wbsLevelCounts / wbsVisibleGroupCount（純函式）
  src/components/gantt/WbsSettingsPanel.jsx     選項資料驅動、分組關閉時 disabled、新增層級統計提示
  src/components/gantt/GlobalSettingsPanel.jsx  轉傳 wbsLevels
  src/pages/GanttPage.jsx                       useMemo(wbsLevelCounts(tasks)) → wbsLevels
  scripts/smoke-test.mjs                        +2 項檢查（層級選項／統計、面板標記）

仍待處理（既有、與本批次無關）
  * 煙霧測試另有 3 項 UNEXPECTED：`expandSchemeColors (text)`、`resolveWbsRowStyle`、
    `UnifiedGanttLayout WBS row colours` —— 皆為 9/18 上午寫的斷言在當日 18:02／18:10 程式更新後過時
    （批次 8 的驗收數據仍可查；本次未修改這些斷言）。
```

**RTM（批次 19.1）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1911 | To Level 選項依檔案實際最深層級生成 | `wbsLevelOptions` + `WbsSettingsPanel.jsx` | Planner: To Level 要能看出效果 | Verified |
| FR-1912 | 面板顯示各層群組數量與切換後結果 | `wbsLevelCounts` / `wbsVisibleGroupCount` + 面板提示 | Planner: To Level 要能看出效果 | Verified |
| FR-1913 | 分組關閉時鎖住 To Level（參考站一致） | `WbsSettingsPanel.jsx` | Planner: To Level 要能看出效果 | Verified |
| NFR-1911 | 語意與參考站一致（限制群組路徑深度、活動列不動） | `applyWbsGrouping` | Planner: To Level 要能看出效果 | Verified（bundle 實證） |
| AC-1911 | 平坦 WBS（184/4/3）→ 選項 all,1,2,3、群組 191/184/188 | smoke-test 新增檢查 | Planner: To Level 要能看出效果 | Verified |
| AC-1912 | 面板帶 `wbsLevels` 時顯示層級統計與 Level 3 | smoke-test 新增檢查 | Planner: To Level 要能看出效果 | Verified |

---

## ✅ 批次 20（2026-09-21）— xerviewer 的「Quick Filters」快速篩選列（狀態／里程碑／要徑）

### User Story
As a **planner**, I want **one-click filters for Not Started / In Progress / Completed / Started / Milestones / Critical Path — with a badge showing how many are active**, so that **I can focus the activity list on the slice I care about without building rules in the custom filter dialog**.

### Entry — 2026-09-21：使用者提供 xerviewer 的快速篩選下拉 HTML，要求分析如何加進本 App

**參考實作（下載 bundle 反查：`https://www.xerviewer.org/assets/index-Dk7vBzdm.js`）**
- State：`quickFilters = { statuses: [], started: false, remaining: false, milestones: false }`，另有獨立開關 `ganttCriticalPathOnly`。
- 判定（節錄原碼）：
  ```js
  const wm = { statuses: [], started: false, remaining: false, milestones: false };
  function matches(task, qf) {
    return !((qf.statuses.length > 0 && !qf.statuses.includes(task.status))
          || (qf.started    && task.actualStartDate == null)
          || (qf.remaining  && task.status === "TK_Complete")
          || (qf.milestones && !task.isMilestone));
  }
  ```
- UI：pills `All │ Not Started │ In Progress │ Completed │ Started │ Milestones │ Critical Path`；**狀態為多選**（`All` 清空狀態）、其餘為獨立開關；工具列按鈕帶**數量徽章**；下方分隔線 + `Custom`（開啟完整規則式篩選器）。

**本專案落地（欄位對照）**

| 參考判定 | 本 App 的欄位 | 說明 |
|---|---|---|
| `task.status` | `statusCode`（`parseXER`） | 無值時由 `pct` 推導（100→Complete、0→NotStart、其他→Active） |
| `task.actualStartDate` | `startActual === true` | `parseXER` 對 `act_start_date` 有值時標記 |
| `task.isMilestone` | 只有 start 或只有 end | 與甘特圖既有判定（`TT_Mile`／`TT_FinMile`）完全一致 |
| `ganttCriticalPathOnly` | `float <= 0` | 與 App 既有 Critical Bar 規則相同（tooltip 即「Critical (Total Float ≤ 0)」，等同參考站預設 `zeroFloat`） |
| `Custom` | 既有 `FilterDialog`（P6 Filters） | 同一個自訂篩選對話框 |

**Functional Requirements**
- FR-2001：工具列新增 **Quick Filters** 按鈕（漏斗圖示＋標題＋**使用中條件數量徽章**），點擊開啟選單。
- FR-2002：選單提供 pills：`All`／`Not Started`／`In Progress`／`Completed`／`Started`／`Milestones`／`Critical Path`；狀態可多選（`All` 清空狀態），其餘為獨立開關。
- FR-2003：套用後只保留符合的活動列；**沒有任何符合活動的群組標題列會被隱藏**（與既有 `Diff Only` 行為一致），活動本身不新增、不刪除、不重排。
- FR-2004：選單底部提供 `Custom`，開啟既有 P6 篩選對話框（有條件時高亮）。
- FR-2005：條件全空＝完全不影響顯示（預設狀態）。
- FR-2006：判定邏輯抽為純函式 `src/lib/quickFilters.js`（`matchesQuickFilters`／`applyQuickFilters`／`toggleQuickFilter`／`countActiveQuickFilters`／`statusOf`／`isMilestoneTask`／`isCriticalTask`）。

**Non-Functional Requirements**
- NFR-2001：`quickFilters` state 必須宣告在衍生任務區塊**之前**（避免批次 8.1 的 TDZ 白畫面；已由 `GanttPage (full page render)` 守衛守住）。
- NFR-2002：與既有篩選可並存，順序為：搜尋 → P6 Filters → Diff Only → **Quick Filters** → Hide Empty WBS → Customise Grouping。
- NFR-2003：ESLint 0 error；煙霧測試新增檢查並維持 exit 0。

**Constraints**
- C-2001：不新增第三方依賴；不改動 `parseXER` 產出的欄位。
- C-2002：`remaining` 條件（參考站 state 有、UI 無 pill）保留下來但**不顯示 pill**（與參考站畫面一致）。

**Acceptance Criteria**
- AC-2001：`applyQuickFilters` 對 8 列 fixture（2 群組 ＋ 6 活動）→ Not Started=`[1,2,5,6]`、In Progress=`[1,3,7,8]`、Started=`[1,3,4]`、Milestones=`[1,5,6]`、Critical=`[1,3,4]`、無條件＝原順序。
- AC-2002：`statusOf`／`isMilestoneTask`／`isCriticalTask`／`countActiveQuickFilters` 邊界正確（pct 推導、float 0／1／undefined、toggle 兩次歸零）。
- AC-2003：選單 SSR 標記 11 項齊全（7 個 pill 標籤、`Custom`、`role="menu"`、`aria-pressed`）。
- AC-2004：`quickFilters.js`／`QuickFilterMenu.jsx`／`GanttPage.jsx` 轉譯 HTTP 200。

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs（exit 0）
  Quick Filters (status / started / milestones / critical predicates):
      OK (notStarted=[1,2,5,6] inProgress=[1,3,7,8] started=[1,3,4] milestones=[1,5,6] critical=[1,3,4], none=[1,2,3,4,5,6,7,8])
  QuickFilterMenu markup (pills + Custom, reference layout): OK (all 11 markers present)
  GanttPage (full page render): OK (192589 chars)          ← 修正 TDZ 後

Vite dev server 轉譯：quickFilters.js 200 (30.8 KB)、QuickFilterMenu.jsx 200 (19.7 KB)、GanttPage.jsx 200 (231.9 KB)
ESLint（新增／修改檔案）0 error

新增／修改檔案
  src/lib/quickFilters.js                    新增（pills 定義＋判定純函式＋toggle／徽章計算）
  src/components/gantt/QuickFilterMenu.jsx   新增（工具列按鈕＋徽章＋pills 選單＋Custom 入口；`defaultOpen` 供 SSR 測試）
  src/pages/GanttPage.jsx                    +quickFilters state（置於衍生區塊之前）、衍生管線套用、header 掛載
  scripts/smoke-test.mjs                     +2 項檢查（判定邏輯、選單標記）

過程中修掉的問題
  * 首次掛載時 `quickFilters` 宣告在衍生區塊之後 → `ReferenceError: Cannot access 'quickFilters' before initialization`（TDZ）
    → 批次 8.1 加的 `GanttPage (full page render)` 守衛**立刻抓到**；已把 state 上移到 `displaySettings` 旁並加註解。
```

**RTM（批次 20）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2001 | 工具列 Quick Filters 按鈕＋使用中數量徽章 | `QuickFilterMenu.jsx` | Planner wants one-click status filters | Verified |
| FR-2002 | 7 個 pill（狀態多選／其餘獨立開關） | `quickFilters.js` + `QuickFilterMenu.jsx` | Planner wants one-click status filters | Verified |
| FR-2003 | 只保留符合活動；空的群組標題列隱藏、活動不重排 | `applyQuickFilters` | Planner wants one-click status filters | Verified |
| FR-2004 | 選單底部 Custom → 開啟既有 P6 篩選對話框 | `QuickFilterMenu.jsx` + `FilterDialog` | Planner wants one-click status filters | Verified |
| FR-2005 | 條件全空＝不影響顯示 | `hasActiveQuickFilters`／`applyQuickFilters` | Planner wants one-click status filters | Verified |
| FR-2006 | 判定邏輯抽為純函式（可測） | `src/lib/quickFilters.js` | Planner wants one-click status filters | Verified |
| NFR-2001 | state 宣告在衍生區塊之前（TDZ 防護） | `GanttPage.jsx` + smoke guard | Planner wants one-click status filters | Verified |
| NFR-2002 | 與既有篩選可並存（固定套用順序） | `GanttPage.jsx` 衍生管線 | Planner wants one-click status filters | Verified |
| NFR-2003 | ESLint 0 error、煙霧測試 exit 0 | 品質閘門 | Planner wants one-click status filters | Verified |
| C-2001 | 不新增依賴、不改 parseXER 欄位 | — | Planner wants one-click status filters | Complete |
| C-2002 | `remaining` 保留但無 pill（與參考站一致） | `quickFilters.js` | Planner wants one-click status filters | Complete |
| AC-2001 | 六種條件組合結果正確 | smoke-test batch 20 guard | Planner wants one-click status filters | Verified |
| AC-2002 | 邊界判定（pct／float／toggle）正確 | 同上 | Planner wants one-click status filters | Verified |
| AC-2003 | 選單 SSR 標記 11 項齊全 | `QuickFilterMenu.jsx` | Planner wants one-click status filters | Verified |
| AC-2004 | 三個模組轉譯 HTTP 200 | dev server | Planner wants one-click status filters | Verified |

---

## 🔧 批次 20.1（2026-09-21）— Quick Filters 補齊「完整選項組」（圖示按鈕＋角落徽章＋Custom／Clear）

### 使用者回饋
「我想要的是 **All / Not Started / In Progress / Completed / Started / Milestones / Critical Path / Custom** 這一整套選項組」——即工具列按鈕與底部列要與參考站**完全一致**（含 `Clear`）。

### 參考站補充反查（bundle）
```jsx
// 工具列按鈕：只有圖示 + 右上角徽章
<button className={`relative p-1.5 md:p-2 rounded-md focus:outline-none transition-colors ${
          kr > 0 ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-slate-400 hover:bg-slate-100"}`}
        aria-label="Filter activities" title="Filter activities" aria-haspopup="true" aria-expanded={…}>
  <FunnelIcon className="w-5 h-5" />
  <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 … ring-1 ring-white">{kr}</span>
</button>

// 徽章計數（Iy）：quick 條件 + 自訂規則；**Critical Path 不計入**
function Iy(qf, customFilter) {
  let c = qf.statuses.length + (qf.started?1:0) + (qf.remaining?1:0) + (qf.milestones?1:0);
  if (customFilter.enabled) c += customFilter.rules.filter(r => r.field).length;
  return c;
}

// 底部列：Custom（自訂篩選啟用時多一個 "On"）＋ Clear（僅在 kr > 0 時出現）
<button onClick={() => { closeMenu(); openCustomPanel(); }}>…Custom {enabled && <span>On</span>}</button>
{kr > 0 && <button title="Clear all filters"
  onClick={() => { resetQuickFilters(); critical && toggleCritical(); }}>…Clear</button>}
```

### 本批次補齊

| 項目 | 內容 |
|---|---|
| 工具列按鈕 | 改為**圖示型**（漏斗、`p-1.5 md:p-2`）＋ **右上角 `-top-1 -right-1` 徽章**顯示使用中條件數；有條件＝強調色底、選單開啟＝淡灰底；`aria-label`／`title="Filter activities"`、`aria-haspopup`、`aria-expanded` |
| 徽章計數 | 與參考站 `Iy()` 一致：`statuses + started + remaining + milestones + 自訂規則數`，**Critical Path 不計入** |
| Custom | 自訂篩選有規則時顯示 **`On`** 小標（`countCustomFilterRules`） |
| Clear | **新增**：僅在徽章 > 0 時出現，`title="Clear all filters"`，一鍵重置**全部 quick 條件 ＋ Critical Path**（`clearQuickFilters()`） |
| 選項組 | `All │ Not Started │ In Progress │ Completed │ Started │ Milestones │ Critical Path`（狀態多選、`All` 清空；其餘獨立開關）＋ 底部 `Custom`／`Clear` |

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs（exit 0）
  QuickFilterMenu markup (funnel button + badge + 7 pills + Custom/On + Clear): OK (all 13 markers present)
  Quick filter badge / clear maths (reference Iy parity):
      OK (badge 6 = 4 quick + 2 custom rules; critical excluded from badge; Clear resets everything)
  Quick Filters (status / started / milestones / critical predicates): OK
  GanttPage (full page render): OK (192545 chars)

Vite dev server 轉譯：quickFilters.js 200 (36.6 KB)、QuickFilterMenu.jsx 200 (25.3 KB)、GanttPage.jsx 200 (231.8 KB)
ESLint（修改檔案）0 error

修改檔案
  src/lib/quickFilters.js                    +countQuickFilterCriteria、countCustomFilterRules、activeFilterBadgeCount、clearQuickFilters
  src/components/gantt/QuickFilterMenu.jsx   圖示型按鈕＋角落徽章；Custom 加 "On"；新增 Clear；prop 改為 customFilter
  src/pages/GanttPage.jsx                    傳入 customFilter={ganttFilters}
  scripts/smoke-test.mjs                     標記檢查擴充為 13 項；新增徽章／Clear 數學檢查
```

**RTM（批次 20.1）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2011 | 工具列改為圖示型按鈕＋右上角徽章 | `QuickFilterMenu.jsx` | Planner wants the full reference option set | Verified |
| FR-2012 | 徽章計數＝quick 條件＋自訂規則（不含 Critical Path） | `activeFilterBadgeCount` | Planner wants the full reference option set | Verified |
| FR-2013 | Custom 於自訂篩選有規則時顯示 "On" | `countCustomFilterRules` + 元件 | Planner wants the full reference option set | Verified |
| FR-2014 | Clear（僅在有條件時出現）重置全部 quick 條件＋Critical Path | `clearQuickFilters` + 元件 | Planner wants the full reference option set | Verified |
| FR-2015 | 完整 7 顆 pill ＋ Custom ＋ Clear 選項組 | `QuickFilterMenu.jsx` | Planner wants the full reference option set | Verified |
| AC-2011 | SSR 標記 13 項齊全（含 `Filter activities`、`>On<`、`Clear`、徽章 `>4<`） | smoke-test batch 20.1 guard | Planner wants the full reference option set | Verified |
| AC-2012 | 徽章數學與參考站 `Iy()` 一致（badge 6＝4 quick＋2 custom） | smoke-test batch 20.1 guard | Planner wants the full reference option set | Verified |

---

## 🔧 批次 21（2026-09-21）— Filters 入口整合 ＋ Last Recalc Date（記錄日期）綁定

### 使用者回饋
「Tools ▸ P6 Filters 與 lucide filter 功能是否重複？請整合處理，以及讓我有一個區域填寫 **Last Recalc Date** 確定該記錄所處於的日期，Filters 的顯示也需要跟該日期綁定。」

### 1) 入口整合（去重）
兩個入口原本開啟**同一個** `FilterDialog`（`FilterBar.jsx`）：

| 入口 | 處置 |
|------|------|
| header 漏斗圖示（批次 20.1，選單底部的 `Custom`） | **保留為唯一入口** |
| `Tools ▸ P6 Filters`（含條件數小紅點） | **移除**；`Tools` 下拉不再因篩選條件而亮起，篩選狀態改由漏斗圖示右上角徽章呈現 |

篩選相關的一切現在都收在漏斗選單：7 顆 pill → `Last Recalc Date` → `Custom`（自訂篩選有規則時顯示 `On`）→ `Clear`。

### 2) Last Recalc Date（記錄日期）
- **來源**：XER `PROJECT.last_recalc_date`（使用者檔案為 `2024-09-30 08:00` → 正規化 `2024-09-30`）。載入程式時自動帶入（`recalcDateFromXerTables()`）；Excel／PDF 匯入無此欄位時可手動填寫。
- **填寫位置**：漏斗選單最上方 `Last Recalc Date` 日期欄（`<input type="date">`，id `quick-filter-recalc-date`）。手動值與檔案值不同時出現 **`File`** 按鈕可一鍵回復檔案值，下方固定顯示 `File: <日期>`。
- **綁定語意**（`statusAsOf()` / `isStartedAsOf()`）：狀態 pill 與 `Started` 一律以「**as at 該日期**」判讀 —— **日期之後才發生的實際進度視為尚未發生**：

| 情況 | 未填日期 | 有填日期（該日之前） |
|------|----------|----------------------|
| 實際完成日 > 記錄日期 | `Completed` | **`In Progress`** |
| 實際開始日 > 記錄日期 | `Started` | **`Not Started`**（且不計入 `Started`） |
| 實際開始／完成 ≤ 記錄日期 | 不變 | 不變 |

  - 未填日期 → 完全沿用 `status_code` 原始值（不做任何 as-at 判斷）。
  - 日期本身不隱藏任何活動（未勾選任何 pill 時清單完全不變）。
  - `Critical Path`（`Total Float <= 0`）與 `Milestones` 為排程／幾何屬性，不受日期影響。
- **實作**：`normalizeRecalcDate()`、`recalcDateFromXerTables()`、`statusAsOf()`、`isStartedAsOf()`；`matchesQuickFilters(task, qf, recalcDate)` / `applyQuickFilters(tasks, qf, recalcDate)` 新增第三參數；`GanttPage` 以 `lastRecalcDate` state 串接（宣告於衍生清單之前，沿用批次 8.1 的 TDZ 防線）。

### 3) 附帶修正 — 煙霧測試 WBS 配色期望值對齊 CLF 調色盤
先前批次已把 `WBS_COLOR_SCHEMES` 與 `wbsTextColorFor()` 改為 **Common Look and Feel 調色盤**（`--color-primary #005a53`、`--color-accent-selected #733208`、`--color-text #333333`、`--color-surface #ffffff`），但煙霧測試仍寫死參考站（xerviewer）的 Tailwind 色，造成 3 筆 `UNEXPECTED`（測試漂移，程式碼本身正確）：

| 檢查 | 舊期望（參考站） | 新期望（CLF／自資料反查） |
|------|------------------|---------------------------|
| `expandSchemeColors` 文字色 | `#f8fafc` / `#334155` | `#ffffff` / `#333333` |
| `resolveWbsRowStyle` classic | `#bfdbfe`/`#1e3a8a`、`#fce7f3`/`#9d174d` | `#005a53`/`#ffffff`、`#733208`/`#ffffff`；階層色改由 `coolBlues[2]`／`coolBlues[6]` 反查 |
| `UnifiedGanttLayout WBS row colours` | `#2e5cb8` / `#648bd8` | `coolBlues[0].bg` / `coolBlues[2].bg`（現值 `#005a53` / `#396c80`） |

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs → exit 0（全表 0 UNEXPECTED / 0 FAILED / 0 MISSING）
  Quick Filters (status / started / milestones / critical predicates): OK
  QuickFilterMenu markup (funnel button + badge + 7 pills + Custom/On + Clear + Last Recalc Date): OK (all 20 markers present)
  Quick filter badge / clear maths (reference Iy parity): OK (badge 6 = 4 quick + 2 custom rules)
  Last Recalc Date binding (statuses read as at the record date): OK (asAt=1,3 completedAsAt=0 startedAsAt=1,3 noDate=2,3)
  Filter entry points integrated (no Tools duplicate; record date wired page → menu → predicates): OK
  expandSchemeColors (3 swatches → 7 levels): OK (#2e5cb8 #4271d0 … | CLF text colours #ffffff,#ffffff,#333333,…)
  resolveWbsRowStyle (classic · per level · override · clamp): OK (classic #005a53/#ffffff, L3 #396c80/#ffffff, >L7 clamps)
  UnifiedGanttLayout WBS row colours: OK (L1 #005a53, L3 #396c80, classic CLF blue kept, chart label toggles)
  GanttPage (full page render): OK (192545 chars)
轉譯 HTTP 200：quickFilters.js 51 KB、QuickFilterMenu.jsx 33.1 KB、GanttPage.jsx 231.8 KB、displaySettings.js 129.7 KB；app / → 200
ESLint（quickFilters.js / QuickFilterMenu.jsx / GanttPage.jsx / smoke-test.mjs）0 error

修改檔案
  src/lib/quickFilters.js                    +normalizeRecalcDate、recalcDateFromXerTables、statusAsOf、isStartedAsOf；matchesQuickFilters / applyQuickFilters 新增 recalcDate
  src/components/gantt/QuickFilterMenu.jsx   +Last Recalc Date 日期欄（含 File 回復鈕、檔案值提示）
  src/pages/GanttPage.jsx                    移除 Tools ▸ P6 Filters（去重）與未使用的 Filter icon；+lastRecalcDate state / 檔案預填 effect / handleRecalcDateChange；傳 recalcDate 給選單與 predicates
  scripts/smoke-test.mjs                     +Last Recalc Date 綁定檢查、+入口整合檢查、選單標記擴充為 20 項、WBS 配色期望值對齊 CLF
```

**RTM（批次 21）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2101 | 移除 `Tools ▸ P6 Filters`，漏斗選單（含 `Custom`）為唯一篩選入口 | `GanttPage.jsx` / `QuickFilterMenu.jsx` | Planner wants one obvious filter entry | Verified |
| FR-2102 | 提供 `Last Recalc Date` 日期欄可填寫／修改記錄日期 | `QuickFilterMenu.jsx` + `lastRecalcDate` state | Planner wants to fix the date the record is at | Verified |
| FR-2103 | 載入 XER 時自動帶入 `PROJECT.last_recalc_date`（可手動覆寫、可回復檔案值） | `recalcDateFromXerTables()` / `File` 按鈕 | Planner wants to fix the date the record is at | Verified |
| FR-2104 | 狀態 pill 與 `Started` 以記錄日期判讀：日期之後的實際進度視為未發生 | `statusAsOf()` / `isStartedAsOf()` | Planner wants filters bound to that date | Verified |
| FR-2105 | 未填日期時完全沿用 `status_code`；日期本身不隱藏任何活動 | `matchesQuickFilters()` / `applyQuickFilters()` | Planner wants filters bound to that date | Verified |
| FR-2106 | WBS 配色期望值對齊 CLF 調色盤（測試漂移修正） | `scripts/smoke-test.mjs` / `displaySettings.js` | Developer wants a trustworthy green suite | Verified |
| AC-2101 | SSR 標記 20 項齊全（含 `Last Recalc Date`、`id="quick-filter-recalc-date"`、`type="date"`、`>File<`） | smoke-test batch 21 guard | Planner wants one obvious filter entry | Verified |
| AC-2102 | 綁定數學：完成日 > 記錄日期 → `In Progress`；開始日 > 記錄日期 → `Not Started`／不計入 `Started` | smoke-test batch 21 guard | Planner wants filters bound to that date | Verified |

---

## 🔧 批次 22（2026-09-21）— Filter Activities 對話框對齊 xerviewer（範本／Match／衍生欄位）

### 使用者回饋
貼出 xerviewer.org 的 `Filter Activities` 對話框結構，要求更新本專案的同名對話框（`FilterBar.jsx` 的 `FilterDialog`）。

### 對照與差異（參考站 → 本批次後）

| 參考站元素 | 本批次前 | 本批次後 |
|------------|----------|----------|
| 標題 `Filter Activities`（漏斗圖示＋關閉鈕） | `Filters` | **`Filter Activities`**（＋`aria-label="Close"`） |
| `Load template...` 範本選單（8 個範本） | 無 | **新增**（8 個範本，見下表） |
| `Match` ＋ `All conditions`／`Any condition` 分段 | 僅根群組 ≥2 項時顯示 `Where All/Any` | **新增頂部 Match 分段**（控制根群組 `logic`；子群組仍保留自己的 Where 標頭） |
| 條件列 `Where`／欄位／運算子／值／刪除 | 已有（Parameter／Is／Value 表格） | 保留（本專案表格化呈現） |
| `Add condition` | 已有 | 保留（另保留本專案的 `Add sub-group`） |
| `Clear filter`／`Cancel`／`Apply filter` | `Clear All`／`Cancel`／`Apply` | **按鈕文字對齊參考站** |

### 範本（`FILTER_TEMPLATES` / `buildTemplateFilters()`）
| 範本 | 產生條件 | 真實檔案（886 活動） |
|------|----------|----------------------|
| Activities without predecessors | `Has Predecessor equals no` | 3 |
| Activities without successors | `Has Successor equals no` | 18 |
| 3-week lookahead | `Start between <記錄日期>..<+21天>` **or** `Finish between …` | 63 |
| Started, not finished | `Start Actual equals yes` **and** `Status not equals Completed` | 33 |
| Activities with constraints | `Constraint Type is not empty` **or** `Constraint Type 2 is not empty` | 19 |
| Negative float | `Total Float < 0` | 456 |
| High float (> 20 days) | `Total Float > 20` | 57 |
| Milestones | `Milestone equals yes` | 225 |

- 範本載入後即為**一般條件樹**，可再手動編修、可 `Clear filter` 清空（不是唯讀預設）。
- **`3-week lookahead` 以批次 21 的 `Last Recalc Date` 為基準**（視窗 `2024-09-30 ～ 2024-10-21`）；未填記錄日期時以今天起算。`FilterDialog` 因此新增 `recalcDate` prop（`GanttPage` 傳入 `lastRecalcDate`）。

### 新增 5 個衍生（virtual）欄位
XER 沒有「有無前後置作業」之類的欄位，故在 `applyFilters()` 內以 `DERIVED_VALUES` 解析：

| 欄位 | 判定 |
|------|------|
| `Has Predecessor` | 本活動的 `id` 或 `activityId` 出現在其他活動的後置清單（`links[].succId`／`succCode`／`link`／`linkSuccCode`） |
| `Has Successor` | 本活動有任一後置（同上來源） |
| `Milestone` | 與 Gantt／Quick Filters 的 `Milestones` 同一規則（僅有 start 或僅有 end）；真實檔案驗證：start-only 13 = `TT_Mile` 13、end-only 212 = `TT_FinMile` 212 ✓ |
| `Start Actual` / `Finish Actual` | `startActual === true` / `endActual === true` |

### 附帶修正 — Status 條件原本永遠不成立（bug）
`Status` 選單存的是 UI 標籤（`Not Started`／`In Progress`／`Completed`），但任務上的 `statusCode` 是 P6 代碼（`TK_NotStart`／`TK_Active`／`TK_Complete`），**字串永遠不相等** → 狀態篩選實際無效。
- 選單選項改為 `{ value: "TK_*", label: "標籤" }`。
- `evalCond()` 以 `STATUS_ALIAS` **正規化比較雙方**，因此**舊的篩選檔案（存標籤）仍然可用**；`Started, not finished` 範本也才能正確運作。
- smoke test 以 `TK_Active`／`In Progress` 兩種寫法驗證同一結果 ✓。

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs → exit 0（全表 0 UNEXPECTED / 0 FAILED / 0 MISSING）
  Filter templates (reference list + derived fields + 3-week lookahead on the record date):
      OK (8 templates; withoutPred=[1,4,5,6,7,8,9] withoutSucc=[3,4,5,6,7,8,9] lookahead=[7,8]
          startedNotFinished=[4] constraints=[6] negFloat=[6] highFloat=[7] milestones=[8])
  FilterDialog markup (Filter Activities + template picker + Match segmented + footers):
      OK (all 22 markers present; Status accepts TK_* codes and labels)
  GanttPage (full page render): OK (193877 chars)

真實檔案（6WSD21-DP_202409.xer，886 activities／記錄日期 2024-09-30）：8 個範本結果如上表
轉譯 HTTP 200：FilterBar.jsx 132.9 KB、QuickFilterMenu.jsx 33.1 KB、GanttPage.jsx 231.9 KB；app / → 200
ESLint（FilterBar.jsx / GanttPage.jsx / smoke-test.mjs）0 error

修改檔案
  src/components/gantt/FilterBar.jsx   +FILTER_TEMPLATES / buildTemplateFilters / 3-week 視窗；+5 個衍生欄位與 DERIVED_VALUES；
                                       +STATUS_ALIAS 正規化（修 Status 條件）；選單標題、範本列、Match 分段、footer 文字；+recalcDate prop、+首次渲染即建立 draft
  src/pages/GanttPage.jsx              FilterDialog 傳入 recalcDate={lastRecalcDate}
  scripts/smoke-test.mjs               +Filter templates 檢查、+FilterDialog markup／Status 相容性檢查（共 22 標記）
```

**RTM（批次 22）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2201 | 對話框標題／按鈕對齊參考站（`Filter Activities`、`Clear filter`／`Apply filter`） | `FilterDialog` | Planner wants the reference filter dialog | Verified |
| FR-2202 | 提供 8 個 `Load template...` 範本並可直接載入編修 | `FILTER_TEMPLATES` / `buildTemplateFilters()` | Planner wants the reference filter dialog | Verified |
| FR-2203 | 頂部 `Match`（All／Any conditions）控制根群組邏輯 | `FilterDialog` | Planner wants the reference filter dialog | Verified |
| FR-2204 | 新增 5 個衍生欄位（前後置／里程碑／實際開始完成） | `DERIVED_VALUES` / `applyFilters()` | Planner wants the reference filter dialog | Verified |
| FR-2205 | `3-week lookahead` 以 `Last Recalc Date` 為基準（未填時以今天起算） | `buildTemplateFilters()` + `recalcDate` prop | Planner wants filters bound to the record date | Verified |
| FR-2206 | 修正 Status 條件（P6 代碼 vs 標籤）並保留舊篩選檔相容 | `STATUS_ALIAS` / `evalCond()` | Planner wants working status filters | Verified |
| AC-2201 | 8 個範本條件與標籤與參考站一致，且各自篩出預期活動 | smoke-test batch 22 guard | Planner wants the reference filter dialog | Verified |
| AC-2202 | 對話框 SSR 標記 22 項齊全（含範本選單、Match、footer） | smoke-test batch 22 guard | Planner wants the reference filter dialog | Verified |
| AC-2203 | Status 條件對 `TK_*` 與舊標籤兩種寫法結果相同 | smoke-test batch 22 guard | Planner wants working status filters | Verified |

---

## 📄 相關文件（2026-09-21）

- **`doc\feature-parity-report.txt`**（**純文字版**，UTF-8 with BOM／CRLF，1,185 行）＋ **`doc\feature-parity-report.md`**（Markdown 來源，872 行）：現行版本 × Base44 參考版本（`C:\Users\ken.li\Downloads\chronos-flow-chunwo`）**完整對照報告**：
  - 摘要與兩份內容的身分
  - 檔案級差異（MD5 逐檔：**63 相同／49 變更／1 移除／21 新增**）
  - 架構差異（Base44 雲端 → 「雲端 + 本機 FastAPI／SQLite」雙軌）＋ 具體程式碼
  - 逐項功能差異（ProjectBar／統一設定面板／WBS 配色與 Grouping／Quick Filters／Last Recalc Date／Filter Activities／Time Scale／PDF 預覽／XER 直通／PDF 內嵌 V3／資訊面板／OCR 修正／CLF 換色／腳本與測試），每項含**參考版描述**與**具體程式碼**
  - 現行版本完整功能清單（依 UI 區域）、功能對照總表、未變更與限制、驗證與再現方式
  - 附錄 A：批次 1–22 一覽；附錄 B：差異清單（可直接用於 code review）
- `doc\requirements.md`（本檔）— 需求、RTM（313 列）與每批次驗收證據。
