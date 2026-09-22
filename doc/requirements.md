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
| **Other** | 6 個顯示開關（Holiday Markers／Staircase Line／Relationship Lines／Comparison Arrows（批次 37 由 Compare Bars 改名，見該批次）／Diff Only／Relation Filter）＋關係類型篩選（FS/SS/FF/SF）＋清除選取＋字級滑桿＋`GanttSettingsPanel` 的 structure 段 | header「Display」下拉整組 ＋「Gantt Settings ▸ Structure」 |

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

---

## 🔧 批次 23A／23C（2026-09-21）— 右鍵手動調整 WBS Level ＋ 匯入依編號自動推導層級

### 使用者回饋
「我需要右鍵功能裏可以手動調整 WBS 的 Level 層級，**或**者 OCR 功能裏增加根據顔色區分 WBS 層級的功能。」
→ 決定：**先做 23A（右鍵手動）＋ 23C（匯入依編號推導）**；23B（OCR 依顏色／LLM 判層級）待 A/B 實測數據出來再定。

### 問題根因（既有行為）
`doc/requirements.md`（批次 8 限制段）已載明：**WBS 階層只來自 XER 的 `PROJWBS`**；Excel／PDF／**掃描 OCR** 匯入與手動新增的 section **一律視為 Level 1**（整段同色），而且**沒有任何手動調整入口**。結果是：非 XER 來源的 programme 在畫面上完全扁平，WBS 分頁的 `To Level` 也無從作用。

### 23A — 右鍵 WBS 層級控制（＋每層縮排）

| 檔案 | 改動 |
|------|------|
| `src/components/gantt/RowContextMenu.jsx` | 標題顯示 `Programme Section · Level n`；新增區塊 `WBS Level — now n`＋**7 顆層級按鈕**（目前層級反白、`title="Already Level n"`）＋`Indent (Level +1)`／`Outdent (Level −1)`（邊界停用） |
| `src/components/gantt/UnifiedGanttLayout.jsx` | `handleContextAction(action, payload)` 新增 3 個動作：`setSectionLevel`／`indentSection`／`outdentSection`，全部經 `clampWbsLevel()` 夾在 1–7；**表格列與甘特圖標題**的 `paddingLeft` 改為 `4/8 + wbsIndentPx(level, grp.indent, indentByLevel)` |
| `src/lib/displaySettings.js` | `DEFAULT_DISPLAY_SETTINGS.wbs.indentByLevel = true`（新預設） |
| `src/components/gantt/WbsSettingsPanel.jsx` | WBS 分頁新增開關 **`Indent by WBS Level`**（關閉即回復批次 23 之前的「只有顏色」外觀） |

**行為**：調整層級會同時改變 **底色階（7 階配色）／縮排（12px/層）／`To Level` 分組／面板層級統計／PDF 匯出顏色**（PDF 走既有的 `resolveWbsRowStyle`）；變更進 undo/redo 與專案版本 payload。

### 23C — 匯入時依 WBS 編號自動推導層級

| 檔案 | 改動 |
|------|------|
| **新增** `src/lib/wbsLevel.js` | `clampWbsLevel()`、`levelFromTitle()`（純函式）、`inferSectionLevels(tasks,{overwrite})`、`levelStats()`、`levelStatsLabel()`、`wbsIndentPx()` |
| `src/components/gantt/ImageImportDialog.jsx` | `handleImport()`（**所有匯入路徑的唯一出口**：Excel／PDF／掃描 OCR／XER／XML）先跑 `inferSectionLevels()`，再把統計以第 5 個參數傳給 `onImport` |
| `src/pages/GanttPage.jsx` | `onImport(..., wbsLevelStats)` 寫入 `importReport.wbsLevels`（一般路徑與 baseline 路徑都帶）；`handleProjectLoaded()`（本機後端專案載入）同樣套用推導 |
| `src/components/gantt/ImportStatusPanel.jsx` | 匯入報告新增 **WBS Levels** 區塊：`n of m section titles carried WBS numbering — levels derived: L1 x ／ L2 y ／ L3 z`＋提示「右鍵可手動調整」 |

**支援的編號（13 個測試案例）**：`1`／`1.1`／`1.1.1`／`1.0`（尾端 `.0` 剝除 → L1）／`A.2`／`CW.1.1`（P6 WBS code）／`第1章`／`3)`／全形數字；`Contract No. DC/2023/08` 這類含冒號的抬頭**不會**被誤判。層級上限 7（超出夾住）。

**安全準則（不可回歸）**
1. **只補不覆寫**：已有 `sectionLevel`（XER 的 `PROJWBS` 階層）一律保留。
2. **只動 section**：活動列完全不變。
3. **不猜**：標題沒有可辨識編號 → 維持 Level 1，並在匯入報告標示數量。

**驗收證據（2026-09-21 實測）**
```
node scripts/smoke-test.mjs → exit 0，全表 0 UNEXPECTED / 0 FAILED / 0 MISSING
  WBS level helpers (numbering parse + inference + clamp + indent):
      OK (parser 13 cases, inferred 3/5, clamp 1..7, indent 12px/level)
  RowContextMenu WBS level editor (7 buttons + indent/outdent): OK (all 7 markers present)
  ImageImportDialog vision schema (row-count guard): OK (16 row fields, 2 vision call sites)   ← 未受影響
  GanttPage (full page render): OK (193981 chars)

ESLint（wbsLevel / RowContextMenu / UnifiedGanttLayout / WbsSettingsPanel /
        ImageImportDialog / ImportStatusPanel / displaySettings / GanttPage）0 error
轉譯 HTTP 200：wbsLevel.js、RowContextMenu.jsx、UnifiedGanttLayout.jsx、WbsSettingsPanel.jsx、
              ImageImportDialog.jsx、ImportStatusPanel.jsx、GanttPage.jsx

修改檔案
  src/lib/wbsLevel.js                        新增（層級解析／推導／縮排）
  src/components/gantt/RowContextMenu.jsx    7 顆層級按鈕 + Indent/Outdent + 目前層級
  src/components/gantt/UnifiedGanttLayout.jsx 3 個動作 + 每層縮排（表格列與甘特標題）
  src/components/gantt/WbsSettingsPanel.jsx  Indent by WBS Level 開關
  src/components/gantt/ImageImportDialog.jsx handleImport() 套用推導
  src/components/gantt/ImportStatusPanel.jsx WBS Levels 匯入報告
  src/pages/GanttPage.jsx                    onImport 統計接線 + 專案載入推導
  src/lib/displaySettings.js                 wbs.indentByLevel 預設
  scripts/smoke-test.mjs                     2 項新檢查（層級函式、右鍵標記）
```

### 已知限制／刻意未做
| 項目 | 說明 |
|------|------|
| XER 匯出 | 仍為**原檔直通**（`_originalWbsData`），手動層級**不會**寫回 P6 `PROJWBS.parent_wbs_id` |
| CompareDialog | 版本 B 的匯入走另一套 schema/prompt，尚未接 23C（該處 section 仍為 Level 1，可用右鍵修正） |
| 23B（OCR 依顏色／LLM） | **尚未實作**：待以真實掃描圖做 16 vs 17 vs 18 欄 A/B 實測（確認不影響每頁抽取行數）後再定 |
| 「重新推導層級」按鈕 | 目前只在匯入時推導；既有已載入資料可用右鍵逐列修正（可另開批次加面板按鈕） |

**RTM（批次 23A／23C）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2301 | 右鍵選單可將 section 設為 Level 1–7（含 Indent/Outdent、顯示目前層級） | `RowContextMenu.jsx` | Planner wants manual WBS level control | Verified |
| FR-2302 | 層級變更同時影響色階、縮排、To Level 分組、統計與 PDF 匯出 | `UnifiedGanttLayout.jsx` / `resolveWbsRowStyle` | Planner wants manual WBS level control | Verified |
| FR-2303 | 每層縮排 12px，可由 WBS 分頁開關關閉（回復舊外觀） | `displaySettings.js` / `WbsSettingsPanel.jsx` | Planner wants manual WBS level control | Verified |
| FR-2304 | 匯入時依 WBS 編號自動推導層級（Excel／PDF／OCR／XML 全部路徑） | `wbsLevel.js` / `ImageImportDialog.jsx` | Planner wants levels detected on import | Verified |
| FR-2305 | 推導**不覆寫** XER 既有層級、**不動**活動列、無編號不猜 | `inferSectionLevels()` | Planner wants levels detected on import | Verified |
| FR-2306 | 匯入報告顯示推導統計與數量 | `ImportStatusPanel.jsx` | Planner wants levels detected on import | Verified |
| NFR-2301 | 零新增相依；層級一律夾在 1–7（既有 7 階配色） | `wbsLevel.js` | Planner wants levels detected on import | Verified |
| NFR-2302 | 預設 `wbs.indentByLevel = true` 但可關閉（可逆的外觀變更） | `displaySettings.js` | Planner wants manual WBS level control | Verified |
| AC-2301 | 13 個編號案例解析正確（含 `1.0`→1、`CW.1.1`→3、`第1章`→1、非編號→0） | smoke-test batch 23 guard | Planner wants levels detected on import | Verified |
| AC-2302 | 推導統計正確（inferred 3/5、kept 1、unresolved 1）且活動列不動 | smoke-test batch 23 guard | Planner wants levels detected on import | Verified |
| AC-2303 | 右鍵選單 SSR 標記 7 項齊全（層級按鈕、Indent/Outdent、目前層級） | smoke-test batch 23 guard | Planner wants manual WBS level control | Verified |
| AC-2304 | 縮排數學：L1→0px、L2→12px、L3(基礎 4px)→28px、關閉→4px | smoke-test batch 23 guard | Planner wants manual WBS level control | Verified |

---

## 🧪 批次 23B 前期實測（2026-09-21）— vision schema 欄位數 vs 抽取行數（A/B）

批次 6 的教訓是「`response_json_schema` 欄位過多 → 模型只回少數行」（37 欄 → 3 行；16 欄 → 31 行），因此 23B 若要新增 `section_level` / `section_color`，**必須先實測不會掉行數**才能動 schema。

### 方法（可重現）
- 素材：真實水務 programme PDF `20231024-1046_01649 (September 2023)-4.pdf` 第 4 頁（A4 橫向），以 `pypdfium2` 渲染成 **2800×1980 JPEG q75（705 KB）**——與 App（批次 7）的渲染設定一致。
- 呼叫路徑：`POST http://localhost:15156/api/apps/6a38f8c8aae6ce8a8b2b1096/integration-endpoints/Core/UploadFile`（FormData `file`）→ 取得 `file_url`，再 `POST .../Core/InvokeLLM`（`prompt` / `file_urls` / `response_json_schema` / `model: gemini_3_1_pro`）。
- **Prompt 直接從 `ImageImportDialog.jsx` 的 `GANTT_PROMPT_BASE` 原文取出**，因此三個變體只有「schema 欄位數（＋對應的層級指示規則）」不同，其餘完全相同。
- 腳本：**`Baes44\chronos-flow-chunwo\scripts\ab-vision-schema.mjs`**（`node scripts/ab-vision-schema.mjs <image> [prefix]`，日後可重跑）；原始回傳：`%TEMP%\ab1-{16-baseline,17-plus-level,18-level-colour}.json`。

### 結果

| 變體 | 欄位數 | **抽取行數** | sections | activities | 有 `section_level` | 有 `section_color` | 耗時 |
|------|-------|-------------|----------|------------|-------------------|--------------------|------|
| 16-baseline（現行 schema） | 16 | **41** | 13 | 28 | 0 | 0 | 60.7 s |
| 17-plus-level | 17 | **41** | 12 | 29 | **12** | 0 | 53.3 s |
| 18-level-colour | 18 | **41** | 13 | 28 | **13** | **13** | 57.3 s |

**結論**
1. **加欄位沒有掉行數**：三個變體的總行數完全相同（41），批次 6 的災難（37 欄 → 3 行）在 17–18 欄不會重現。
2. **層級可被正確判讀**（17／18 欄皆然），且與人工判讀的 WBS 結構一致：
   ```
   1: 2/F-3/F MiC Installation
   2:   2/F-3/F All Zones AS & BS
   2:   Fitting-Out Works
   3:     LG/F - Offices Fitting-Out
   3:     G/F - Laboratory/ Vistory Rece
   ```
3. **顏色欄位有抓但不足以單獨判層級**：抓到的色帶為 `light green` / `light yellow` / `light blue`，但 `light green` 同時出現在 Level 1 與 Level 2 → 顏色適合作為「顯示忠實度／除錯」資訊，**層級仍應以編號與縮排為主**（與 23C 的 `levelFromTitle()` 互補：23C 先判，LLM 只補缺口）。
4. 每次呼叫約 53–61 秒（與現況同級，沒有變慢）。

**建議實作方式**：採用 **17 欄（只加 `section_level`）** 為主的 B1 精簡版（風險最低、已證明不掉行數）；`section_color` 列為選配，若要做視覺除錯再加。

**RTM（批次 23B 前期實測）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| AC-23B1 | 新增 1–2 個 vision 欄位不得降低每頁抽取行數（41 vs 41 vs 41） | `scripts\smoke-test.mjs` guard + A/B harness | Planner wants levels detected on import | Verified |
| AC-23B2 | LLM 能依編號／縮排／色帶判出 section 層級（與人工判讀一致） | A/B harness（`ab1-17-plus-level.json`） | Planner wants levels detected on import | Verified |
| AC-23B3 | 顏色不足以單獨決定層級 → 顏色僅作輔助 | A/B harness（`ab1-18-level-colour.json`） | Planner wants levels detected on import | Verified |

---

## 🤖 批次 23B（2026-09-21）— 掃描／OCR 匯入由模型判讀 WBS 層級與色帶

### 決策
A/B 實測（見上節）顯示 17／18 欄都不掉行數 → 使用者選擇 **B1 完整 18 欄版**（`section_level` ＋ `section_color`）。

### 實作

| 檔案 | 改動 |
|------|------|
| `src/components/gantt/ImageImportDialog.jsx` | `GANTT_VISION_TASK_SCHEMA` 16 → **18 欄**；新增 `GANTT_VISION_PROMPT_SUFFIX`（層級＋顏色判讀規則）並**只套用於 2 個 vision 呼叫點**（文字／Excel 路徑完全不受影響）；`aiResultToTasks()`：`section_level` → `aiSectionLevel`（**hint**）、`section_color` → `sectionColorName` |
| `src/components/gantt/CompareDialog.jsx` | 掃描比對的 vision schema 同步（14 → 16 欄）＋同一組規則；同樣對應 `aiSectionLevel` / `sectionColorName` |
| `src/lib/wbsLevel.js` | 推導順序定為 **① 標題編號（決定性，23C）→ ② `aiSectionLevel`（模型判讀，23B）→ ③ 不猜**；統計新增 `fromTitle` / `fromAi` |
| `src/components/gantt/ImportStatusPanel.jsx` | 匯入報告拆出來源：「… got a level — *n* from the title numbering and *m* from the WBS bands on the chart — L1 x ／ L2 y ／ L3 z」 |
| `src/pages/GanttPage.jsx` | CompareDialog 的版本 A／B 匯入也套用同一推導 |
| `scripts/smoke-test.mjs` | schema guard 由「≤18」收緊為「**恰好 18**（A/B 驗證上限）」＋檢查兩個 vision prompt 都套用 `GANTT_VISION_PROMPT_SUFFIX`＋欄位確實對應到 `aiSectionLevel`；推導測試新增「AI hint 補位」與「編號優先於 AI」案例 |
| `scripts/ab-vision-schema.mjs` | A/B 工具改為直接從原始碼抽出 `GANTT_PROMPT_BASE` / `GANTT_VISION_PROMPT_SUFFIX`，因此 variant 18 ＝ **App 實際上線的 prompt + schema**；新增第 4 個參數「只跑指定變體」（例：`… ab5 18`）以便重測 |
| `ImageImportDialog.jsx`（防護） | 新增 `invokeVisionLLM()` 統一兩個 vision 呼叫點，並在回答行數 `< VISION_MIN_ROWS (=2)` 時**自動重試一次**（取較大者），進度列顯示 `only 1 row(s) read — retrying once...` |

### 推導順序（單一真相）

```
① XER PROJWBS 已有層級        → 保留（永不覆寫）
② 標題帶 WBS 編號             → levelFromTitle()（決定性，可重現）
③ 模型判讀的 section_level     → clamp 到 1–7 後採用（只在 ② 無值時）
④ 以上皆無                    → 維持 Level 1，並在匯入報告標示「無法辨識」
＋ 使用者右鍵手動修正（23A）永遠可覆蓋以上任何結果
```

### 驗收證據

- 煙霧測試：**67 項 OK、0 FAILED／0 UNEXPECTED／0 MISSING**，其中
  `ImageImportDialog vision schema (row-count guard): OK (18 row fields — the A/B-verified ceiling, 2 vision call sites, fidelity rule, WBS level/colour rules on both vision prompts, fields mapped to aiSectionLevel)`
- ESLint：**0 error**（27 個既有 warning）
- 轉譯 HTTP 200：`wbsLevel.js`／`RowContextMenu.jsx`／`ImageImportDialog.jsx`／`CompareDialog.jsx`／`ImportStatusPanel.jsx`／`GanttPage.jsx`／`UnifiedGanttLayout.jsx`
- **上線設定 A/B 重跑**（同一張圖、variant 18 ＝ App 實際 prompt＋schema，`scripts/ab-vision-schema.mjs <img> <prefix> 18`）：

  | 回合 | prompt 來源 | 抽取行數 | 耗時 |
  |------|-------------|---------|------|
  | ab1 | 第一版規則（層級＋顏色併寫） | **41** | 57.3 s |
  | ab2 | 上線 `GANTT_VISION_PROMPT_SUFFIX` | **1** ⚠️ | **4.4 s** |
  | ab3 | 上線 `GANTT_VISION_PROMPT_SUFFIX` | **41** | 62.6 s |
  | ab4 | 上線 `GANTT_VISION_PROMPT_SUFFIX` | **41** | 53.6 s |

  → **4 次中 3 次 41 行**；ab2 那次 4.4 秒只回 1 行、`section_level=0`／`section_color="white"`，屬 **API／模型層瞬時塌陷**（同一段 prompt 的 17 欄變體在同一回合回 41 行，故非 schema 造成）。
  → 樣本數小（4 次），**無法完全排除低機率抖動**，因此新增了自動重試防護（見下）。

### 刻意界線（不可回歸）

1. `section_color` **只**存為 `sectionColorName`（來源色帶名稱，供除錯／追溯），**不**改寫 `sectionBg`、也不參與配色方案。
2. 模型值永遠只是 hint：XER `PROJWBS` 與 23C 編號推導優先。
3. 文字／Excel 路徑的 schema **不加**欄位（那裡看不到色帶，編號由 23C 決定性處理）。
4. XER 匯出仍為原檔直通 —— 手動／推導的層級**不會**寫回 P6 `PROJWBS.parent_wbs_id`。

**RTM（批次 23B）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-23B1 | 掃描／OCR 匯入可取得 section 層級（`section_level`） | `ImageImportDialog.jsx` / `CompareDialog.jsx` vision schema | Planner wants levels detected on import | Verified |
| FR-23B2 | 掃描／OCR 匯入可取得來源色帶（`section_color`） | 同上（`sectionColorName`） | Planner wants levels detected on import | Verified |
| FR-23B3 | 層級判定順序：XER → 編號 → 模型 hint → 不猜 | `wbsLevel.js` `inferSectionLevels()` | Planner wants levels detected on import | Verified |
| FR-23B4 | 匯入報告顯示層級來源拆分 | `ImportStatusPanel.jsx` | Planner wants levels detected on import | Verified |
| NFR-23B1 | 欄位數上限 18，且不得降低抽取行數（A/B 舉證） | `scripts/ab-vision-schema.mjs` + smoke guard | Planner wants levels detected on import | Verified |
| NFR-23B2 | 文字／Excel 路徑 schema 不變（零回歸） | smoke guard（18 欄只算 vision schema） | Planner wants levels detected on import | Verified |
| AC-23B4 | 兩個 vision 呼叫點都套用層級規則（`GANTT_VISION_PROMPT_SUFFIX` × 3 出現 = 1 定義＋2 使用） | smoke-test batch 23 guard | Planner wants levels detected on import | Verified |
| AC-23B5 | 欄位確實映射到 task（`aiSectionLevel` / `sectionColorName`）且經 `inferSectionLevels` | smoke-test batch 23 guard | Planner wants levels detected on import | Verified |
| FR-23B5 | 低行數（< 2）自動重試一次，取較大者；進度列提示 | `ImageImportDialog.jsx` `invokeVisionLLM()` | Planner wants levels detected on import | Verified |

> 尚未處理（刻意）：若模型連續兩次都只回極少行，App 仍會以該結果匯入（不阻擋使用者）；目前只在進度列提示重試。

---

## 🧩 批次 24（2026-09-21）— 逐頁文字匯入（修「內容缺漏」根因）

### 使用者回報
> 「我測試了兩次，兩次的結果都有内容不同缺漏問題，能更仔細的逐頁進行 OCR 嗎？」

### 根因（實測舉證，非推論）
- 測試檔 `6WSD21-DP_202409 (1).pdf`：**27 頁 A3、有文字層**（每頁 3,000–4,400 字）→ 走**文字路徑**（不是視覺路徑；`detectTrueRotation`／vision 完全沒參與）。
- 舊程式只有一個呼叫，且把整份文字**硬切在 24,000 字元**：
  `prompt: ...\n\nText content:\n${nativeText.substring(0, 24000)}`
- 實測：整份 **98,799 字、614 個活動 ID**；前 24,000 字僅含 **213 個 ID（34.7%）**、以字元計僅 **24.3%**。
  → **約 3/4 的 programme 永遠不可能被匯入**；且在可見的前段內，每次保留哪些列還會變動 → 使用者看到「兩次缺的內容都不一樣」。
- 同類 bug 也存在于 Excel AI 備援路徑：`parseExcelWithAI()` 把所有工作表串接後 `substring(0, 20000)` → 後面工作表整批消失。

### 修法：逐頁對齊分批（page-aligned batching）

| 檔案 | 改動 |
|------|------|
| **新增** `src/lib/textChunks.js` | `planTextChunks()`（頁對齊分批：≤12,000 字且 ≤3 頁）、`splitLongText()`（超長頁／工作表按行切分，不丟尾）、`mergeChunkTasks()`（依文件順序合併＋精確去重）、`mapWithConcurrency()`（3 併發、**回傳順序保持文件順序**）、`looksLikeProgrammeText()`（判斷空白批次是否值得重試） |
| `ImageImportDialog.jsx`（PDF 文字路徑） | `extractNativePDFTextByPage()` 保留頁邊界 → `splitLongText()` → `planTextChunks()` → **每批一次模型呼叫**（prompt 明示「part x of n、pages a–b、其他批次另行處理、不可摘要」）→ `mergeChunkTasks()`；單批 0 列但看似表格時自動重試一次；進度列逐批回報 `Parsed pages 4-6 (batch 2/10) — 21 row(s)` |
| `ImageImportDialog.jsx`（Excel AI 備援） | 改為逐工作表／逐段分批＋合併，移除 20,000 字截斷 |
| `ImportStatusPanel.jsx` + `GanttPage.jsx` | 匯入報告新增 **Source Coverage** 區塊（文字／掃描／單圖／Excel／內嵌資料五態）：`All 27 page(s) sent in 10 batch(es) · 98,799 characters · N rows read` |

### 驗收證據（2026-09-21 實測）
- **真實 27 頁檔驗算**（套用與 App 相同的分批規則）：
  `batches: 10 · pages covered: 27 of 27 · max batch chars: 11,545 · first/last: [1,2,3] … [25,26,27]`
  舊制 24,000 字 ＝ **24.3%** ；新制 **100%（98,799 字）**
- **端到端實測（新流程、真實資料）**：取第 **10–12 頁**（舊制因截斷**從來沒送出過**的區段），用 App 相同的 `extractNativePDFTextByPage` 演算法（`scripts/pdf-page-text.mjs`）取出文字後走新批次流程：
  - 真實內容：**97 個活動列**（+ 摘要列）
  - 模型回傳：**120 列（97 活動 + 23 摘要）** ＝ 近乎全數回收 ✓
  - 該批 10,650 字、37 欄 schema、耗時 **242.8 秒** → 由此推算整份 27 頁（10 批、併發 5）約 **8–16 分鐘**
- **煙霧測試 69 項 OK、0 失敗**，含兩項新 guard：
  - `textChunks (page-aligned batches + merge + order-preserving pool): OK (27 pages → 9 batches of ≤3 pages, merge dedupes repeats, order kept, long text split without loss)`
  - `ImageImportDialog text/Excel paths (per-page batching, no 24k/20k truncation): OK` ← 回歸 guard：原始碼中不得再出現 `substring(0, 24000)` 或 `substring(0, 20000)`
- ESLint **0 error**；`textChunks.js`／`ImageImportDialog.jsx`／`ImportStatusPanel.jsx`／`GanttPage.jsx` 轉譯 HTTP 200

### 取捨（必須揭露）
1. **呼叫次數與時間**：27 頁由 **1 次 → 10 次**（併發 5）。單批實測約 **4 分鐘**（輸出量大：37 欄 × ~120 列），整份估 **8–16 分鐘**；內容完整但明顯變慢。進度列會逐批顯示（`Parsed pages 4-6 (batch 2/10) — 21 row(s)`），不會像以前一樣「看似完成卻少了大半」。
   可再優化的方向（未做）：文字路徑改用品瘦 schema（批次 6 對 vision 做過類似精簡）、或分成「快速前 24k 先出結果、其餘背景續跑」。
2. **分帶（band）實驗已做過並否決**：把同一頁切 3 條水平帶分別判讀，只多抓到 **1** 列、卻漏掉 **12** 個 section 列（工具：`scripts/vision-band-recall.mjs`）。因此掃描路徑維持「整頁 ＋ 低行數自動重試」，不採分帶。
3. 若單批仍回 0 列，最多重試一次後照原樣匯入（不阻擋使用者），並在報告中呈現列數。

**RTM（批次 24）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2401 | PDF 文字路徑必須送達**全部頁面**（不得截斷整份文件） | `textChunks.js` + `ImageImportDialog.jsx` | Planner wants every activity imported | Verified |
| FR-2402 | 分批須為頁對齊、保持文件順序，且合併時去重 | `planTextChunks()` / `mergeChunkTasks()` | Planner wants every activity imported | Verified |
| FR-2403 | 超長頁／工作表按行切分，不丟尾部文字 | `splitLongText()` | Planner wants every activity imported | Verified |
| FR-2404 | Excel AI 備援同樣分批（移除 20,000 字截斷） | `parseExcelWithAI()` | Planner wants every activity imported | Verified |
| FR-2405 | 匯入報告顯示來源覆蓋率（頁數／批次／字元／列數） | `ImportStatusPanel.jsx` | Planner wants every activity imported | Verified |
| FR-2406 | 空白批次（看似表格）自動重試一次 | `looksLikeProgrammeText()` | Planner wants every activity imported | Verified |
| NFR-2401 | 併發 5、回傳順序＝文件順序（否則列序會亂） | `mapWithConcurrency()` | Planner wants every activity imported | Verified |
| NFR-2402 | 原始碼不得再出現 `substring(0, 24000)` / `substring(0, 20000)` | smoke-test batch 24 guard | Planner wants every activity imported | Verified |
| AC-2401 | 27 頁真實檔：10 批、27/27 頁、單批 ≤12,000 字 | 批次實測（見上） | Planner wants every activity imported | Verified |

---

## 🔒 批次 12 補強（2026-09-21）— 「重新上傳瞬間還原」的保證強化

使用者回饋：
> 「如果是已經有 metadata 內嵌完整資料 + 重新上傳瞬間還原，那就不用特別弄注脚了，能保證重新上傳瞬間還原的功能就行。」

→ 因此**不做 PDF 上的可見注脚**，改為把「瞬間還原」這條路徑做**稽核與加固**。

### 稽核發現（三個縫隙）
| # | 發現 | 處置 |
|---|------|------|
| 1 | `exportGanttPDF(options)`（早期公開入口）**不會內嵌資料** → 任何未來的呼叫端都會產出「無法瞬間還原」的 PDF | 改為 `async`，自動 `encodeTasksForPDF(options.tasks)`（有 `embedData` 時沿用），＝「本模組產出的 PDF 一律帶標記」 |
| 2 | 匯入報告的 **Source Coverage** 區塊條件是 `coverage.pages > 0`，而內嵌還原沒有 `pages` → **恰恰在「瞬間還原」時不顯示** | 條件改為 `coverage` 有值即顯示；內嵌時明確標示 `🔖 Instant restore — this PDF carried the full programme (N rows, every field). No AI reading was needed.` |
| 3 | 第三方 PDF／被其他工具重存的 PDF 會靜默走 AI 讀取，使用者不知道「為什麼這次少了很多」 | 非內嵌來源時，報告加註：`No embedded data in this file …` ＋ `Tip: a PDF exported by this app re-imports instantly and losslessly. Re-saving or printing this file with another tool strips that marker.` |

### 新增驗收：真實規模的來回測試
既有測試只有 **4 列**，無法證明多 chunk（`Subject = chunk 0`、`Keywords = overflow`）在真實規模下可行。新增 **600 列 × 全欄位** 測試（含繁中、長名稱、`links[]`、baseline、actuals、constraint、section 列）：

```
PDF embedded data round trip (600 rows, multi-chunk payload): OK
  (600 rows, 379,328 bytes JSON → 26,678 chars in 7 chunks, 15 page(s), every field identical)
```

→ 證明 **379 KB 的 programme（gzip 後 26.7 k 字元）寫進 PDF metadata 再讀回，逐欄位完全相同**；7 個 chunk 的溢出機制正常。

### 稽核確認（無縫隙的部分）
- 匯出端**只有** `ExportDialog.handleExportPDF` 一條路徑，且 **Preview 與下載用的是同一份 bytes**（`pdfDocRef`）→ 預覽看到的檔案就是會帶標記的檔案。
- `src` 內除了 `exportGanttPDF.js` 之外**沒有**其他 jsPDF 使用點 → 沒有第二條漏掉標記的產出路徑。
- 匯入端 `processPDF` 的順序是 **① metadata 內嵌 → ② 文字分批 → ③ 逐頁 vision** ✓，內嵌命中時完全不呼叫 AI。
- 舊格式 `GANTT_DATA_V2`（未壓縮）仍可解 → 既有檔案不會失效。

### 已知邊界（誠實揭露）
- 若 PDF 被**第三方工具重存／列印成 PDF／線上轉檔**，Info 字典可能被清掉 → 該檔就無法瞬間還原，會退回 AI 讀取（此時報告會顯示 `No embedded data`）。這是 PDF 格式層面的限制，無法從本 App 端阻止。
- 600 列實測通過；理論上限取決於 PDF Info 字串長度（本次 26.7 k 字元無問題）。若日後遇到數千列以上的專案，建議再跑一次同等規模驗證（測試已內建於煙霧測試）。

**RTM（批次 12 補強）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-1205 | 本模組任何匯出入口都必須內嵌資料（含 legacy `exportGanttPDF`） | `exportGanttPDF.js` | Planner wants instant lossless re-import | Verified |
| FR-1206 | 內嵌還原時匯入報告必須明確顯示「瞬間還原」 | `ImportStatusPanel.jsx` | Planner wants instant lossless re-import | Verified |
| FR-1207 | 非內嵌來源必須說明原因並提示標記會被第三方工具清除 | `ImportStatusPanel.jsx` | Planner wants instant lossless re-import | Verified |
| AC-1205 | 600 列全欄位真實規模來回（多 chunk）逐欄位完全相同 | smoke-test batch 12 guard | Planner wants instant lossless re-import | Verified |
| AC-1206 | 無標記 PDF 仍回 `null`（走 AI）／舊 V2 可解 | smoke-test batch 12 guard | Planner wants instant lossless re-import | Verified |

---

## 🔁 批次 25（2026-09-21）— 逐頁雲端讀取 ＋ 本地 OCR 交叉復核（疑似缺漏就單頁重讀並插回原位）

### 使用者需求
> 「逐頁OCR，在交予Base44的LLM的同時，也啓動本地OCR進行逐頁對照復核，如果出現某一頁的大幅度缺漏，就對該頁的内容重新進行一次單獨的再OCR處理，然後插回原本位置」

### 本地通道選型（**實測後**定案，不是推測）
| 通道 | 單頁耗時 | ID 品質 | 結論 |
|------|---------|---------|------|
| Ollama `ovisocr2:bf`（已在跑，port 11434，CORS 可用） | >4 分鐘仍未完成 | — | ✗ 太慢 |
| PaddleOCR 全頁 2800px（PP-OCRv6 medium） | >4 分鐘 | 多錯字 | ✗ |
| PaddleOCR 全頁 1400px（PP-OCRv5 mobile） | 88.3 秒 | 15/29，含錯字（`WSD-MC-1790`） | △ |
| **PaddleOCR 左側 ID 欄細條 616×1980（原生解析度）** | **34.6 秒** | **20/20 全對、零錯字** | ✅ 採用 |

復核只需要「這頁有哪些活動 ID」，而 ID 全在左側那一欄；細條保持原生解析度 → 又快又準。

### 新增元件
| 檔案 | 內容 |
|------|------|
| **新增 `C:\dev\paddle-ocr\ocr_server.py`** | PP-OCR 的**零相依** HTTP 包裝（純標準庫 `ThreadingHTTPServer`）：`GET /health`、`POST /ocr`（base64 JSON → `lines`/`text`/`ms`）、`POST /ocr/file`；CORS 回呼 origin（瀏覽器可直呼）；`PADDLE_OCR_VERSION=PP-OCRv5`（mobile，預設）／`PP-OCRv6`（高精度但 >2 分鐘/頁）；模型只載入一次、推論加鎖。啟動：`C:\dev\paddle-ocr\run-ocr-server.bat`（port 8199） |
| **新增 `src/lib/localOcr.js`** | `foldOcrId()`（大小寫／分隔符＋ OCR 混淆折疊 O↔0、I/L↔1、S/Z↔5、B↔8）、`extractActivityIds()`（三段式 ID 如 `WSD-W-ELS-1470` 要抓到；`BR1`／`A1` 這種表格格不算）、`comparePageCoverage()`（判定規則見下）、`cropIdColumn()`（左 22% 細條裁切）、`probeLocalOcr()` / `readPageLocally()`（含逾時；服務不在＝回 `null`，**絕不讓匯入失敗**）、`buildRecoveryPrompt()`、`mergeRecoveredRows()`（**插回原位**）；設定持久化於 `gantt_local_ocr` |
| `src/components/gantt/ImageImportDialog.jsx` | 每個掃描頁在送出雲端 vision 的**同時**啟動本地細條 OCR（`Promise.all`，只等較慢的一方）；`crossCheckPage()` 比對後若判定缺漏 → **單頁重讀**（同一張圖＋本地 OCR 文字當檢核清單＋缺漏 ID 清單）→ `mergeRecoveredRows()` 插回**該頁原本位置**；單圖匯入路徑同樣處理；UI 新增 `Local OCR cross-check` 開關＋服務位址＋狀態燈（off／checking／ready（引擎版本、每頁約 35 秒）／not reachable） |
| `src/components/gantt/ImportStatusPanel.jsx` | 匯入報告新增一行：`Local OCR cross-check: N page(s) verified against a local OCR pass · M page(s) re-read → +X row(s) recovered, Y row(s) completed`；服務沒開則顯示 `service not reachable — pages were not verified` |

### 判定門檻（常數，可調）
`OCR_MISSING_RATIO = 0.4`、`OCR_MIN_MISSING = 3`、`OCR_MIN_LOCAL_IDS = 5`
→ 本地讀到的 ID 中有 **≥40% 且 ≥3 個**不在雲端結果裡 ⇒ 觸發單頁重讀；本地只讀到 **<5 個 ID** ⇒ 視為訊號不足、不觸發（避免 OCR 噪聲造成無謂重讀）。

### 驗收證據
```
煙霧測試：71 項 OK / 0 FAILED，其中
  localOcr (fold + id extraction + short-page verdict + splice back):
    OK（1 列 vs 6 個本地 ID → 83% 缺漏 → 需重讀；完整答案不重讀；本地僅 2 個 ID → 不重讀；
        插回順序 A-1,A-2,A-3,A-4、既有列只補空白欄位）
ESLint 0 error ｜ localOcr.js／ImageImportDialog.jsx／ImportStatusPanel.jsx 轉譯 HTTP 200
本地服務實測：GET /health 首次 6.9 s（載入模型）、其後 0.0 s；
              POST /ocr 細條 34.6 s／80 行／20 個 ID 全對（對照雲端同頁 29 個 ID）
```

### 已知限制（誠實揭露）
1. **服務沒開也能匯入**：只有雲端讀取，報告標示 `service not reachable`。
2. **時間**：本地每頁約 35 秒（CPU）且與雲端**並行** → 單頁耗時＝兩者較慢者；27 頁約十幾分鐘。可在匯入對話框關閉。
3. **本地引擎會漏讀**（此頁 20/28）→ 只用來「發現大幅缺漏」，**不用來取代雲端**；因此 OCR 錯字不會寫進資料（重讀仍以雲端 vision 為準，本地文字僅作檢核清單）。
4. 重讀只針對被標記的頁面，且新列只插在該頁範圍內；既有列僅補空白欄位，不覆寫。

**RTM（批次 25）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2501 | 每個掃描頁在送雲端 LLM 的同時啟動本地 OCR（並行） | `ImageImportDialog.jsx` | Planner wants each page double-checked | Verified |
| FR-2502 | 以「ID 覆蓋率」判定單頁大幅缺漏（≥40% 且 ≥3 個） | `comparePageCoverage()` | Planner wants each page double-checked | Verified |
| FR-2503 | 被標記的頁面單獨重讀一次（雲端 vision ＋ 本地文字檢核清單） | `buildRecoveryPrompt()` / `crossCheckPage()` | Planner wants each page double-checked | Verified |
| FR-2504 | 重讀結果**插回該頁原本位置**，既有列不覆寫只補空白 | `mergeRecoveredRows()` | Planner wants each page double-checked | Verified |
| FR-2505 | 本地服務位址／開關可由使用者設定並記憶 | `localOcr.js` / import dialog UI | Planner wants each page double-checked | Verified |
| FR-2506 | 匯入報告顯示復核與重讀統計 | `ImportStatusPanel.jsx` | Planner wants each page double-checked | Verified |
| NFR-2501 | 本地服務不可用時匯入照常、不得報錯 | `readPageLocally()` 回 null | Planner wants each page double-checked | Verified |
| NFR-2502 | 本地 OCR 只作檢核，不以其文字寫入資料（避免 OCR 錯字污染） | 重讀仍走雲端 vision | Planner wants each page double-checked | Verified |
| NFR-2503 | 零新增前端相依；本地服務為零相依標準庫實作 | `ocr_server.py` | Planner wants each page double-checked | Verified |
| AC-2501 | 1 列 vs 6 本地 ID → 83% → 需重讀；完整答案 → 不重讀 | smoke-test batch 25 guard | Planner wants each page double-checked | Verified |
| AC-2502 | 插回原位：A-1 補空白、A-2/A-4 插在相鄰位置、順序保持 | smoke-test batch 25 guard | Planner wants each page double-checked | Verified |
| AC-2503 | 本地細條 OCR 20/20 ID 全對、34.6 s/頁（實測） | 本地服務實測（2026-09-21） | Planner wants each page double-checked | Verified |

---

## 🎛 批次 25b（2026-09-21）— 本地 OCR 引擎可自選、可對照

### 使用者需求
> 「我能怎麽去自主選擇使用哪種本地 OCR 進行測試？」

### 做法
| 檔案 | 內容 |
|------|------|
| `src/lib/localOcr.js` | 新增引擎註冊表 `LOCAL_OCR_ENGINES` 與 `engineById()`：**① PP-OCR 服務**（`ocr_server.py`，`:8199`）、**② Ollama 本機模型**（`:11434`，需選模型）、**③ PST-OCR 服務**（OvisOCR2，`:7861`）。`probeLocalOcr()` / `readPageLocally()` 依引擎分派到各自 API 形狀：PP-OCR `GET /health` + `POST /ocr {image}`、Ollama `GET /api/tags` + `POST /api/generate {model,prompt,images,stream:false}`、PST-OCR `GET /health` + `POST /ocr/base64 {data}`（回 `{markdown,text,pages}`）。設定改為 `{enabled, engine, url, model}`（`gantt_local_ocr`） |
| `src/components/gantt/ImageImportDialog.jsx` | UI 改為 **引擎下拉＋模型輸入（Ollama，附 `/api/tags` 的 datalist 建議）＋位址輸入＋狀態燈**；切換引擎會自動帶入該引擎的預設位址；狀態顯示 `ready — <engine> <version>（N 個模型）` 或 `not reachable — <該引擎的啟動提示>` |
| **新增 `scripts/local-ocr-compare.mjs`** | 用 **App 同一份適配器**（Vite SSR 載入 `src/lib/localOcr.js`）在同一張圖上跑各引擎，輸出 **耗時／行數／ID 數／樣本** 表格；自動裁左側 22 % 細條（Node 無 canvas，改用 Paddle venv 的 Pillow）；`--engines`、`--model`、`--timeout` 可調 |

### 實測（同一頁 `20231024-1046_01649` 第 4 頁、左側 ID 欄細條 616×1980、本機 CPU）
| 引擎 | 耗時 | 行數 | ID 數 | 備註 |
|------|------|------|-------|------|
| **PP-OCR 服務（PP-OCRv5 mobile）** | **35.4 s** | 80 | **21**（乾淨，零錯字） | 建議預設 |
| **Ollama（`ovisocr2:bf`）** | **77.0 s** | 10 | **29**（舊過濾器；新過濾器會更乾淨） | 已在本機運行、零設定，但慢一倍 |
| **PST-OCR 服務（OvisOCR2）** | 服務未啟動（`fetch failed`，3 ms 內判定） | — | — | 需先跑 portable 服務 |

> 註：先前量到 Ollama「>4 分鐘」是**整頁 2800px**；改用**細條**後降到 77 秒，因此 Ollama 也是可用選項。

### 同時修正（精度）
1. **ID 抽取精度**：加入「**末段必須是數字**」規則（P6 ID 都以數字結尾，如 `WSD-W-ELS-1470`）；修正前細條 OCR 的 42 個「ID」含活動名稱片段（`F_MiCZoneJ1a-M1F01B`）→ 修正後 **21 個全部乾淨**。未修正會造成幽靈缺漏、白白重讀。
2. `blobToBase64()` 支援 Node（`FileReader` 只在瀏覽器存在）→ 腳本與測試可共用同一份程式碼。
3. `readPageLocally()` 回報服務端 `ms`。

### 驗收證據
```
煙霧測試：72 項 OK / 0 FAILED
  localOcr (fold + id extraction + short-page verdict + splice back): OK
  localOcr engines (registry + adapters + graceful failure):
    OK (3 engines: ppocr/ollama/pstocr; dead endpoint → null, no throw)
ESLint 0 error ｜ localOcr.js、ImageImportDialog.jsx 轉譯 HTTP 200
引擎對照實測（見上表）
```

### 怎麼選（給使用者的操作路徑）
1. **同一張圖比一比**：`node scripts/local-ocr-compare.mjs <圖檔> --engines ppocr,ollama,pstocr --model ovisocr2:bf`
2. **App 內切換**：Import 對話框底部 → `Local OCR cross-check` 勾選 → 下拉選引擎（Ollama 要填模型，狀態燈會列出可用模型）→ 位址自動帶入 → 下次匯入即套用（設定記憶在本機）
3. **看結果**：匯入報告的 `Local OCR cross-check` 一行會顯示該次使用哪個引擎、驗證幾頁、重讀幾頁、補回幾列

**RTM（批次 25b）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2507 | 使用者可在 App 內選擇本地 OCR 引擎（PP-OCR／Ollama／PST-OCR）並記憶 | `localOcr.js` + import dialog | Planner wants to choose the local OCR engine | Verified |
| FR-2508 | 各引擎以各自的 API 形狀驅動，回傳統一格式（lines/text/ids/engine） | `probeLocalOcr()` / `readPageLocally()` | Planner wants to choose the local OCR engine | Verified |
| FR-2509 | 提供離線對照工具，同圖量測各引擎的耗時與 ID 召回 | `scripts/local-ocr-compare.mjs` | Planner wants to choose the local OCR engine | Verified |
| NFR-2504 | 未啟動／不可達的引擎必須快速判定且不影響匯入 | 死埠測試（3 s 內回 null／`available:false`） | Planner wants to choose the local OCR engine | Verified |
| AC-2504 | ID 抽取不得把活動名稱片段當 ID（42 → 21，末段須為數字） | smoke-test batch 25 guard | Planner wants to choose the local OCR engine | Verified |
| AC-2505 | 三引擎實測數據（35.4 s/21 IDs；77.0 s/29 IDs；服務未啟動） | 引擎對照（2026-09-21） | Planner wants to choose the local OCR engine | Verified |

---

## 🎛 批次 25c（2026-09-21）— 本地 OCR 引擎切換的**位置**（可發現性）

使用者回饋：
> 「我在前端頁面内的哪裏可以自己選擇切換使用的本地OCR？」

→ 原本只放在**匯入對話框最下方**（不易發現），因此抽出共用元件並**同時掛在 Global Settings**。

### 做法
| 檔案 | 內容 |
|------|------|
| **新增 `src/components/gantt/LocalOcrSettings.jsx`** | 把開關／引擎下拉／模型輸入／位址輸入／狀態燈抽成**共用元件**（自己讀寫 `gantt_local_ocr` 並自行探測服務） |
| `src/components/gantt/ImageImportDialog.jsx` | 匯入對話框底部改為掛載 `<LocalOcrSettings />`；匯入時**即時重讀設定**（`loadLocalOcrSettings()`），因此在任一處改動都會在下次匯入生效 |
| `src/components/gantt/GlobalSettingsPanel.jsx` | **Global Settings → Other** 最上方新增區塊 `Local OCR (scan verification)`，掛載同一元件 |

### 兩個入口（都在前端頁面內）
1. **設定面板**：工具列的 **Settings** → 左側分類 **Other** → 最上方 **Local OCR (scan verification)**
2. **匯入對話框**：按 **Import**（或拖入檔案）→ 視窗**最下方**、按鈕列（Download Template／Cancel／Confirm Import）**下面**那一行

兩處操作的是同一份設定（localStorage），改一處另一處下次開啟即同步。

### 驗收證據
```
煙霧測試：73 項 OK / 0 FAILED，新增
  Local OCR engine picker (rendered + mounted in Import dialog and Settings):
    OK (all 5 markers; both mount points present)
      檢查：元件渲染出「Local OCR cross-check」＋三個引擎選項＋預設位址，
            且同時掛載於 ImageImportDialog 與 GlobalSettingsPanel 的 other 分頁
ESLint 0 error ｜ LocalOcrSettings.jsx、GlobalSettingsPanel.jsx、ImageImportDialog.jsx 轉譯 HTTP 200
```

**RTM（批次 25c）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2510 | 引擎切換必須在**設定面板**（Settings → Other）可直接操作 | `GlobalSettingsPanel.jsx` / `LocalOcrSettings.jsx` | Planner wants to choose the local OCR engine | Verified |
| FR-2511 | 匯入對話框內亦可切換，且兩處共用同一份設定 | `ImageImportDialog.jsx` / localStorage | Planner wants to choose the local OCR engine | Verified |
| AC-2506 | 選單在兩個位置都實際渲染並掛載（SSR 標記 + 原始碼掛載檢查） | smoke-test batch 25c guard | Planner wants to choose the local OCR engine | Verified |

---

## 🚀 批次 25d（2026-09-21）— 切換引擎後**自動嘗試啓動**該服務

### 使用者需求
> 「請在我切換后自動嘗試啓動」

瀏覽器無法直接開本地程序 → 讓**已在運行的 PP-OCR 服務（`:8199`）兼任啓動器**。

### 實作
| 檔案 | 內容 |
|------|------|
| `C:\dev\paddle-ocr\ocr_server.py` | 新增**受控啓動器**：`GET /launch/services`（列出各引擎、是否在跑、是否可啓動）、`POST /launch/start {id}`、`POST /launch/stop {id}`。**只接受預先註冊的指令**（`pstocr` → 可攜版 `python\python.exe server.py`；`ollama` → `ollama.exe serve`），路徑可用 `PST_OCR_DIR` / `OLLAMA_DIR` 覆寫；記住 PID 以支援停止。另加「**同一 port 已有實例就拒絕再啓動**」保護（先前兩個實例搶 `:8199` 造成隨機 404） |
| `src/lib/localOcr.js` | `probeLauncher()`、`startLocalService()`、`stopLocalService()`、**`ensureEngineRunning()`**（探測 → 不可達就請啓動器啓動 → **輪詢直到就緒**，含逾時與進度回報） |
| `src/components/gantt/LocalOcrSettings.jsx` | **切換引擎／位址／模型即自動嘗試啓動**；首次掛載**只探測不啓動**（避免開啟面板就亂開服務）；狀態列顯示 `starting …`／`waiting … Ns`／`service started ✓`；不可達但可自動啓動時提供 **`Start now`** 按鈕；若連啓動器都沒開，明確提示先執行 `run-ocr-server.bat` |

### 端到端實測（在你的機器上實際跑過）
```
POST http://127.0.0.1:8199/launch/start {"id":"pstocr"}
  → {"ok":true,"started":true,"id":"pstocr","pid":41948,"url":"http://127.0.0.1:7861"}
12–24 秒後 GET http://127.0.0.1:7861/health
  → {"status":"ok","service":"pst-ocr","engine":"transformers","model":"…\\models\\OvisOCR2" …}
（面板上由 `not reachable` 變成 ready ✓）

目前三引擎：ppocr :8199 ✓（單一實例）／pstocr :7861 ✓（由啓動器帶起）／ollama :11434 ✓
```

### 驗收證據
```
煙霧測試：74 項 OK / 0 FAILED，新增
  localOcr launcher (probe / start / ensure + UI auto-start wiring):
    OK (dead launcher stays silent and spawns nothing; auto-start wired on engine switch + Start now button)
      ← 測試全部打向死埠（127.0.0.1:9），確保「探測失敗時絕不會亂開程序」
ESLint 0 error ｜ localOcr.js、LocalOcrSettings.jsx 轉譯 HTTP 200
`/launch/services` 回應：pstocr canStart:true/running:true、ollama canStart:true/running:true
```

### 界線（誠實揭露）
1. **前提**：啓動器本身（PP-OCR 服務）必須在跑 —— 執行一次 `C:\dev\paddle-ocr\run-ocr-server.bat` 即可；它沒開時 App 會顯示該指令，不會假裝能啓動。
2. **只允許預先註冊的引擎**被啓動（`pstocr`／`ollama`），不接受任意命令（安全）。
3. PST-OCR **`/health` 先就緒、模型後載入**：第一次真正讀頁仍需 1–3 分鐘。
4. `stopLocalService()` 已實作但 UI 尚未放「停止」按鈕（需要時再加）。

**RTM（批次 25d）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2512 | 切換引擎後若不可達，系統自動嘗試啓動該服務並等待就緒 | `ensureEngineRunning()` / `LocalOcrSettings.jsx` | Planner wants engines started automatically | Verified |
| FR-2513 | 提供受控啓動端點（列出／啓動／停止），只接受預先註冊指令 | `ocr_server.py` `/launch/*` | Planner wants engines started automatically | Verified |
| FR-2514 | 首次掛載只探測不啓動；另備 `Start now` 手動按鈕 | `LocalOcrSettings.jsx` | Planner wants engines started automatically | Verified |
| NFR-2505 | 探測失敗或啓動器不在時**不得**亂開程序，且須告知手動指令 | 死埠測試 + `hint` 文案 | Planner wants engines started automatically | Verified |
| NFR-2506 | 同一 port 不得有兩個服務實例（避免路由不一致） | `ocr_server.py` 啓動時自檢 | Planner wants engines started automatically | Verified |
| AC-2507 | 端到端：`POST /launch/start {pstocr}` → 12–24 秒後 `:7861/health` 200 | 實機實測（2026-09-21） | Planner wants engines started automatically | Verified |

---

## 🖨 批次 26（2026-09-21）— Print Preview 內自選「要列印哪些內容」

### 使用者需求
> 「在 Print Preview 中顯示讓我可以決定需要列印出哪些其他資料，比如 Other Settings 中的 Display」

### 稽核發現
- **Print Preview 只有唯讀檢視器**（工具列：頁數／新分頁／下載／關閉），沒有任何列印內容選項。
- `buildGanttPDF` 雖然早就有 `showStaircase` 參數，但**收了卻完全沒畫**（dead parameter）；`Other Settings ▸ Display` 的其他項目（假日標記、關係線…）在 PDF 裡也都不存在。

### 實作
| 檔案 | 內容 |
|------|------|
| `src/lib/exportGanttPDF.js` | 新增 5 個列印內容選項並**真的畫出來**：`showHolidays`（HK 公眾假期淡紅底＋紅線，畫在長條**下方**，用 `getHolidaysInRange()`）、`showToday`（今天的紅色垂直線）、`showStaircase`（每個 programme 一組階梯線，用繪圖時記錄的 `barPositions[]`）、`showRelationshipLines`（FS/SS/FF/SF 折線＋箭頭，依 `links[]`／`link` 資料）、`showComparisonBars`（原本的紫色 BL/Late 比較條改為可關閉）。**全部預設維持原輸出**（新的四個預設 false、比較條預設 true）|
| `src/components/gantt/PdfPreviewDialog.jsx` | 左側新增 **Print content** 面板（可用工具列按鈕收起）：5 個勾選項（含說明文字）＋跨頁說明＋重建中提示；**勾選即重建 PDF、預覽同步刷新**，下載永遠等於畫面上那一份。未傳入選項時（其他呼叫端）維持純檢視器 |
| `src/components/gantt/ExportDialog.jsx` | 新增 `printOptions` 狀態（含從 `localStorage` 記憶的 `printOptions`）、`handlePrintOptionChange()`：重建 PDF、替換 blob URL、並保留新的 jsPDF 實例供下載；`buildPdfOptions()` 帶入 5 個選項；`embedData` 以 ref 快取避免每次勾選都重新編碼 metadata |

### 驗收證據
```
煙霧測試：75 項 OK / 0 FAILED，新增
  PDF print content (holidays / today / staircase / links / comparison):
    OK (defaults byte-identical, all 5 options change the output, preview panel shows 7 markers)
      ← 同時驗證「不勾任何新選項時輸出與舊版完全相同」（NFR-2601）
      ← 並驗證五個選項各自都真的改變 PDF 輸出（不是死參數）
ESLint 0 error ｜ exportGanttPDF.js、ExportDialog.jsx、PdfPreviewDialog.jsx 轉譯 HTTP 200
```

### 使用方式
1. Export ▸ **PDF** ▸ **Preview PDF**
2. 預覽左側 **Print content** 面板勾選：Holiday markers／Today line／Staircase line／Relationship lines／Comparison bars
3. 每勾一次，右側預覽即時重建；滿意後按 **Download PDF**（下載的就是畫面上那一份，仍內嵌完整資料可瞬間還原）
4. 選擇會被記住（與 PDF 頁面設定一起存於 localStorage）

### 已知限制（誠實揭露）
1. **關係線與階梯線只畫在同一頁內**：跨越分頁的連結會被略過（PDF 分頁是各自列印的區塊），面板上已註明。
2. `Other Settings ▸ Display` 的 **Compare Bars／Diff Only／Relation Filter** 屬「畫面檢視狀態」而非列印內容：Diff Only／Relation Filter 會改變要匯出的列本身（應在匯出前先過濾），因此未放進列印面板；Compare Bars 在 PDF 對應的是 `Comparison bars` 開關 ✓。
3. 假日採 `hkWorkingDays` 的**現行假期集**（含靜態後備清單），未涵蓋的年份會少畫。

**RTM（批次 26）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2601 | Print Preview 內可自選列印內容（假日／今天線／階梯／關係線／比較條） | `PdfPreviewDialog.jsx` | Planner wants to choose what gets printed | Verified |
| FR-2602 | 勾選後即時重建預覽，且下載檔＝預覽檔 | `ExportDialog.handlePrintOptionChange` | Planner wants to choose what gets printed | Verified |
| FR-2603 | `buildGanttPDF` 必須真的實作這些選項（不得再是死參數） | `exportGanttPDF.js` | Planner wants to choose what gets printed | Verified |
| FR-2604 | 選擇需被記憶 | `localStorage` `printOptions` | Planner wants to choose what gets printed | Verified |
| NFR-2601 | 不勾任何新選項時，輸出必須與舊版**位元組相同** | smoke-test batch 26 guard | Planner wants to choose what gets printed | Verified |
| NFR-2602 | 未傳入選項的呼叫端維持純檢視器行為 | smoke-test batch 26 guard | Planner wants to choose what gets printed | Verified |
| AC-2601 | 5 個選項各自都改變 PDF 輸出（以 data-URI 長度比對） | smoke-test batch 26 guard | Planner wants to choose what gets printed | Verified |
| AC-2602 | 面板渲染 7 個標記（含 5 個選項與跨頁說明） | smoke-test batch 26 guard | Planner wants to choose what gets printed | Verified |

---

## 📐 批次 26b（2026-09-21）— 階梯線改為與畫面完全一致（並以**像素量測**驗證）

### 使用者回報
> 「爲什麽 Staircase Line不是按照原本頁面内的紅綫展示模式？」

### 根因（我第一版確實畫錯了）
畫面實作（`UnifiedGanttLayout` 的 `<polyline>`）是三條規則的組合：
```js
const fbt = fb.idx*ROW_H + (ROW_H - BH)/2;              // ① 貼齊長條「上緣」
… if (bx2 < mx) continue; …                             // ② 只往前推進（被線擋住的長條跳過）
if (pts.length) pts.push(`${mx},${ly + ROW_H/2}`);      // ③ 結尾下垂半列；strokeWidth = 2（在 27px 列高上）
```
我的 PDF 版有三處偏離：**① 畫在列中央**（`row.y + effectiveRowH/2`）、**② 少了結尾下垂段**、**③ 線寬固定 0.5mm 未按列高換算**。

### 修正
- y 改用 **長條上緣**（直接使用繪圖時已記錄的 `barPositions[idx].top`，與長條本身完全同一來源）
- 沿用「只往前推進」的判斷：`if (step.right < reach) continue;`
- 補上**結尾下垂** `effectiveRowH / 2`
- 線寬改為 **`effectiveRowH × 2/27`**（畫面 2px／27px 的等比換算）
- 顏色同畫面 `#dc3545`；section 列只當「新 programme 的起點」，本身不畫線（與畫面一致）

### 驗證方式：不是讀程式碼，而是**量渲染出來的圖**
產生 PDF → `pypdfium2` 以 288 dpi 渲染 → 量紅色像素與各長條的相對位置：
```
page 4763×3368 px (11.3 px/mm)      teal px 45130   red px 7356
  bar 2: y=547..588 h=42px   red median y=544  → 上緣 -0.26mm ／ 列中央 -2.07mm  → HUGS TOP ✓
  bar 3: y=615..656 h=42px   red median y=602  → 上緣 -1.15mm ／ 列中央 -2.95mm  → HUGS TOP ✓
  bar 4: y=683..724 h=42px   red median y=685  → 上緣 +0.22mm ／ 列中央 -1.59mm  → HUGS TOP ✓
RESULT: staircase hugs the bar tops (matches the on-screen line)
```
（bar 3 的 −1.15mm 是因為量測窗包含了上一條長條的垂直降落段，屬預期行為；section 列那條 bar 完全沒有紅線經過 ✓ 與畫面一致。）

- 煙霧測試 **75 項 OK / 0 FAILED**；ESLint 0 error（`exportGanttPDF.js`）

**RTM（批次 26b）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2605 | PDF 階梯線必須與畫面同一呈現規則（貼長條上緣、只前進、結尾下垂、等比線寬） | `exportGanttPDF.js` | Planner wants the print to match the screen | Verified |
| AC-2603 | 以實際渲染量測：紅線須落於各長條上緣而非列中央（288 dpi 像素量測） | 渲染量測（2026-09-21） | Planner wants the print to match the screen | Verified |
| AC-2604 | section 列不得被階梯線經過（畫面亦同） | 渲染量測 | Planner wants the print to match the screen | Verified |

---

## 🩹 批次 26c（2026-09-21）— 「Print Preview 的 Staircase line 看起來是灰色」的診斷與修正

### 使用者回報
> 「在Print Preview中顯示的Staircase line是灰色的」

### 診斷：先量檔案，不憑猜測
用**同一份程式碼**產生 PDF，再以 72／96／150／300 dpi 渲染並量測線條顏色：
```
  72 dpi: line pixels=   929  strongest sample=#db3645（目標 #dc3545，色距 2）  strong-red=369
  96 dpi: line pixels=  1375  strongest sample=#db3645                        strong-red=694
 150 dpi: line pixels=  3271  strongest sample=#db3645                        strong-red=1885
 300 dpi: line pixels= 11888  strongest sample=#db3645                        strong-red=7728
```
→ **檔案內容確實是 #dc3545 紅，不是灰色**。會「看起來灰」的兩個原因：
1. **線太細**：當時線寬 = `列高 × 2/27` ≈ **0.41 mm**；PDF 檢視器以 fit-width 顯示時約 1 px，反鋸齒把紅色洗成灰粉。
2. **可能是舊預覽**：舊版預覽沒有任何建置時間／大小標示，無法分辨新舊。

### 修正
| # | 改動 |
|---|------|
| 1 | **階梯線加粗並設下限**：`clamp(列高 × 2/27, 0.6, 1.2) mm`（保留畫面比例關係，但在預覽縮放下仍讀得出紅色） |
| 2 | **關係線箭頭同步加粗** 0.3 → 0.45 mm（同樣的細線問題） |
| 3 | **預覽工具列顯示 `built HH:MM:SS · NN KB`** → 一眼分辨是否為最新建置的檔案 |

### 驗證（同一量測腳本重跑，檔案層級）
```
  72 dpi: strong-red pixels   369 → 716（+94%）
  96 dpi: strong-red pixels   694 → 987（+42%）
 150 dpi: strong-red pixels  1885 → 2520
 300 dpi: strong-red pixels  7728 → 10534
最強樣本仍為 #db3645（＝畫面用的 #dc3545，色距 2）→ 顏色未變、只有粗細改變
```
- 煙霧測試 **75 項 OK / 0 FAIL**；ESLint 0 error；`exportGanttPDF.js`／`PdfPreviewDialog.jsx`／`ExportDialog.jsx` 轉譯 HTTP 200

### 若仍然偏灰（下一步）
可能與 **PDF 檢視器的顯示模式**有關（例如 Chrome 的深色模式會把 PDF 反轉／壓暗），或那份 PDF 不是最新建置。請把匯出的 PDF 放進 `Downloads` 並告知檔名，我可以**直接量測你的檔案**：若你的檔案同樣是紅色，即為檢視器端效果，與檔案內容無關。

**RTM（批次 26c）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2606 | 階梯線在預覽縮放下必須可辨識為紅色（線寬下限 0.6 mm） | `exportGanttPDF.js` | Planner wants the print to match the screen | Verified |
| FR-2607 | 關係線箭頭同樣需在預覽縮放下可見（0.45 mm） | `exportGanttPDF.js` | Planner wants the print to match the screen | Verified |
| FR-2608 | 預覽工具列顯示建置時間與檔案大小（可辨識新舊） | `PdfPreviewDialog.jsx` / `ExportDialog.jsx` | Planner wants the print to match the screen | Verified |
| AC-2605 | 檔案層級量測：紅線最強樣本 #db3645、72/96 dpi 實心紅像素顯著增加 | 渲染量測（2026-09-21） | Planner wants the print to match the screen | Verified |

---

## 🔧 批次 27（2026-09-21）— Last Recalc Date：可設定、可在 Display 顯示、可在日期欄右鍵編輯

### 使用者需求（原話）
> 「讓我可以設置一個 Last Recalc Date，作爲當下 Programme 的當下日期，也需要在 Display 中點選顯示，但編輯 Last Recalc Date 請直接讓我在日期欄右鍵中顯示修改」

### 對照現況（為何要再做一次）
| 面向 | 批次 21 的現況 | 缺口 |
|------|----------------|------|
| 設定 | Quick Filter 選單有 `Last Recalc Date` 日期欄，狀態膠囊依它判讀 | 藏在漏斗選單裡、畫面上完全看不到 |
| 顯示 | 無 | 沒有任何 data date 標示 |
| 編輯 | 只能在漏斗選單改 | 日期欄右鍵沒有入口 |
| 保存 | 只存在記憶體 | 存檔/載入不帶資料日期，重開就回 XER 舊值 |

### 實作
| # | 功能 | 位置 |
|---|------|------|
| 1 | 圖表繪製 **data date 線**：橘色 `#e88219`、2px、虛線（7,3）＋頂端三角與標籤 `Last Recalc 2026-09-21`（白底描邊，壓在 bar 上仍可讀）。刻意與番茄紅 today 線區隔，避免混淆 | `UnifiedGanttLayout.jsx` |
| 2 | Display 新增開關 **「Last Recalc Date line」**（Other ▸ Display；預設開，但**沒有日期就不畫線**） | `GanttPage.jsx` |
| 3 | **日期欄右鍵** → 選單最上方新增「Last Recalc Date」區塊：日期輸入框 + `Use this cell — <欄名> (<日期>)`（右鍵哪一格就用那格）/ `Use Start` / `Use Finish` / `Use Today` / `Use file date` / `Clear Last Recalc Date` | `RowContextMenu.jsx`；日期儲存格（Start/End/BL/Early/Late…）接上 `openCellMenu` | 
| 4 | 資料日期隨 programme 走：存檔與上傳寫入 payload `meta.last_recalc_date`，載入時還原（XER 值為後備） | `ProjectBar.jsx` / `GanttPage.jsx` |
| 5 | 匯出一致性：XER/XML 的 export date 預設 = 設定的資料日期（原本只讀 XER） | `ExportDialog.jsx` |
| 6 | Print Preview 第 6 個選項 **「Last Recalc Date line」**（預設關 → 既有輸出位元組不變） | `exportGanttPDF.js` / `PdfPreviewDialog.jsx` |

### 驗收（自動化）
- 煙霧測試新增「Last Recalc Date（右鍵日期欄 · Display 開關 · 隨 programme 儲存 · PDF 選項）」→ **76 項 OK / 0 FAIL**（新增後仍全綠）
- Print content 測試擴充：6 個選項都會改變輸出，且 `showRecalcDate` 沒給日期時輸出與預設**完全一致**
- ESLint 0 error；7 個受影響模組 Vite 轉譯 HTTP 200

### 驗收（PDF 真實位元組量測，150/300 dpi 算圖）
```
資料日期 = 今天  ：橘線 x=1672，today 紅線 x=1671 → 同日落在同一格（差 1 px）
由 30 天跨度推得  ：10.933 px/day
資料日期 = 今天−3：橘線 x=1638，期望 1639.2     → 差 1.2 px（同一格）
線條顏色          ：#e8821a（畫面用 #e88219，色距 1）
虛線              ：同一欄內 8 段空隙（dashed ✓），欄內著色像素 83
選項關閉（預設）  ：該處無橘線；14810 bytes → 開啟後 15225 bytes（預設輸出未變）
```

### 已知限制
- 資料日期是 **Programme 層級**（P6 定義），所以每一列看到／設定的都是同一個日期。
- 線只涵蓋資料列範圍（與 today 線一致）；跨頁時每一頁各畫一次。
- 「Use this cell」只在右鍵那一格真的有日期時出現。

**RTM（批次 27）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2701 | 可設定 Programme 的 Last Recalc Date（作為當下日期） | Last Recalc Date 編輯器（RowContextMenu） | Planner wants to set the programme's current date | Verified |
| FR-2702 | 日期欄右鍵即可修改（含「用這一格日期」捷徑） | 日期儲存格 `openCellMenu` + RowContextMenu | Planner wants to edit it straight from the date column | Verified |
| FR-2703 | Display 可勾選顯示 data date 線（橘色虛線 + 標籤） | Other Settings ▸ Display `showRecalcLine` | Planner wants to see the data date on the chart | Verified |
| FR-2704 | 資料日期隨 programme 儲存／載入 | ProjectBar payload `meta.last_recalc_date` | Planner wants the date to stay with the programme | Verified |
| FR-2705 | 匯出沿用：XER/XML export date 預設 = 資料日期 | ExportDialog exportDate | Planner wants the exported record to carry the data date | Verified |
| FR-2706 | Print Preview 可將 data date 線印出（預設關） | exportGanttPDF `showRecalcDate` / PdfPreviewDialog | Planner wants the print to match the screen | Verified |
| AC-2701 | PDF 實測：資料日期 = 今天時與 today 線同格（差 1px）；今天−3 差 1.2px；色距 1 | 渲染量測（2026-09-21） | Planner wants the data date on the chart | Verified |
| AC-2702 | 預設輸出未變（選項關閉時該處無線，檔案大小不變） | 煙霧測試 print content | Planner wants no surprise changes | Verified |

---

## 🔧 批次 28（2026-09-21）— Gantt Bar Info：Show Names / Start / Finish on Bars

### 使用者需求（附 xerviewer.org 參考 markup）
> 「在 Gantt Bar Settings 中參考 https://www.xerviewer.org/ 中的內容增加 Gantt Bar Info：Show Names on Bars / Show Start Date on Bars / Show Finish Date on Bars」

### 實作
| # | 內容 | 位置 |
|---|------|------|
| 1 | 三個獨立開關，**id 與參考 markup 完全一致**（`ganttbar-shownames` / `ganttbar-showstartdate` / `ganttbar-showfinishdate`），帶 `role="switch"` + `aria-checked`，20×12 圓形滑鈕（xerviewer 的緊湊樣式；配色改用本專案 CLF 的 primary / surface） | `GanttSettingsPanel.jsx`（Gantt Bars ▸ Bars 分頁 ▸ Bar Info） |
| 2 | 新設定 `bar.info = { showName, showStart, showFinish }`，**預設全關**（畫面與匯出都不變） | `displaySettings.js` |
| 3 | 共用文字組合器 `buildBarText(task, bar, dateFormat)`：Labels 分頁欄位優先，再疊加已開啟的 Bar Info（名稱／開始／完成），**自動去重**並以 ` · ` 連接；日期跟隨 Display 的日期格式 | `displaySettings.js` |
| 4 | 畫面 bar 標籤改用同一組合器（Labels 關閉時仍可只靠 Bar Info 顯示文字） | `UnifiedGanttLayout.jsx` |
| 5 | PDF 同步（WYSIWYG）：`hasBarInfo()` 為真才畫字（預設輸出位元組不變）；放得下畫在 bar 內（白字），放不下自動畫到 bar 右側 | `exportGanttPDF.js` |

### 疊加規則（實測輸出）
```
Labels(Item) + 三個全開   → "A1 · Excavate · 2026-09-01 · 2026-11-30"
Labels 關閉  + 三個全開   → "Excavate · 2026-09-01 · 2026-11-30"
Labels(Activity) + Show Names → "Excavate"           （同名不會印兩次）
日期格式改 dd/MM/yyyy     → "25/09/2024 · 04/10/2024"
三個全關（預設）          → "A1"                     （＝本批次之前的外觀）
```
放不進 bar 時（短 bar、或 bar 被比較條切成半高）→ 文字自動畫到 bar 右側，**不會消失**（畫面與 PDF 同一規則）。

### 驗收（自動化）
- 煙霧測試新增「Gantt Bar Info (Show Names / Start / Finish on Bars · screen + PDF)」→ **77 項 OK / 0 FAIL**
  - 文字規則 6 組斷言、三個 switch 的 id/label/`role="switch"`、面板 SSR 標記、**畫面 chart SSR 實際渲染字串**、PDF 位元組（預設不變 / 開啟後改變）
- ESLint 0 error；`displaySettings.js`、`GanttSettingsPanel.jsx`、`UnifiedGanttLayout.jsx`、`exportGanttPDF.js` Vite 轉譯 HTTP 200

### 驗收（PDF 真實位元組 + 300 dpi 算圖目視）
```
Bar Info 全開 ：「A1 · Excavate · 2026-09-01 · 2026-09-30」畫在 bar 內（白字）
               「A2 · Piling … · 2026-10-01 · 2026-11-06」畫在 bar 內
               短 bar → 自動畫到右側：「A3 · Slab · 2026-10-20 · 2026-11-03」
只開 Show Names（Labels 關）→ bar 上只有「Excavate」／「Piling」／「Slab」
檔案大小：預設 14247 bytes → 全開 14610 bytes（預設輸出未變）
```

### 已知限制
- PDF 全篇使用 jsPDF 內建 `helvetica`，且 `sanitizePDFText()` 會把非 Latin-1 字元轉成 `?` → **中文活動名稱在 PDF 顯示為 `????`**（左側 Activity 欄位本來就是這樣，非本批次造成）。要修正需嵌入 CJK 字型，屬另一個批次。
- Bar Info 文字放不進 bar 時改畫右側；若右側也超出紙邊，目前不做自動截斷（與既有 bar 標籤行為一致）。

**RTM（批次 28）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2801 | Gantt Bar Settings 提供三個 Bar Info 開關（名稱／開始／完成日期） | GanttSettingsPanel ▸ Bars ▸ Bar Info | Planner wants names and dates written on the bars | Verified |
| FR-2802 | Bar Info 與 Labels 分頁欄位可疊加且不重複，日期跟隨 Display 格式 | `buildBarText()`（displaySettings） | Planner wants one consistent bar caption | Verified |
| FR-2803 | 畫面 bar 與 PDF 使用同一組合器（WYSIWYG） | UnifiedGanttLayout / exportGanttPDF | Planner wants the print to match the screen | Verified |
| FR-2804 | 預設全關，未開啟時畫面與 PDF 輸出皆不變 | `bar.info` 預設 + `hasBarInfo()` | Planner wants no surprise changes | Verified |
| AC-2801 | 煙霧測試：6 組文字規則 + 3 個 switch id + 畫面 SSR + PDF 位元組，全數通過（77 OK / 0 FAIL） | scripts/smoke-test.mjs | Planner wants names and dates written on the bars | Verified |
| AC-2802 | PDF 目視：bar 內白字、短 bar 自動右移、預設檔大小不變 | 渲染量測（2026-09-21） | Planner wants the print to match the screen | Verified |

---

## 🔧 批次 29（2026-09-21）— Bar 文字的位置、字體家族、大小與顏色

### 使用者需求
> 「幫我再加上可以調整相關内容處於的位置（Bar chart 的前方或者後方）以及字體大小顔色等」
> （並附上 xerviewer 的 a11y 清單：Font Family 下拉、Text Color on Bars 色票、Text Size on Bars 6–16 預設 10）

### 實作
| # | 內容 | 位置 |
|---|------|------|
| 1 | **位置**三選一：`Inside the bar`（條內）／`Before the bar (left)`（bar 前方）／`After the bar (right)`（bar 後方）。舊值 `right` 自動視為 `after`（`normalizeBarTextPosition()`），既有設定不會失效 | `displaySettings.js` + 面板 + 畫面 + PDF |
| 2 | **字體家族**（`label.fontFamily`，預設 System Default）：共用 `WBS_FONT_FAMILIES` 清單，補上使用者清單中的 **Comic Sans MS / Fira Sans / Monaco**（共 17 種） | 同上 |
| 3 | **文字大小** 6–16 px（`label.fontSize`，預設 10，與參考 UI 的 valuemin=6 / valuemax=16 一致）+ 一鍵 Reset | 同上 |
| 4 | **兩個顏色**：`label.color`（畫在 bar 上，預設白）與 `label.colorOutside`（畫在 bar 前／後，預設 `#333333`） | 同上 |
| 5 | 設定集中處：**Gantt Bars ▸ Bars ▸ Bar Info ▸ Text style**（Labels 分頁只留「內容」與最小 bar 寬度，並提示樣式改到 Bars 分頁） | `GanttSettingsPanel.jsx` |
| 6 | 「before」文字靠 bar 左緣**右對齊**（畫面 `translate(-100%, -50%)` + text-align:right；PDF `doc.text(..., { align:"right" })`），「after」貼 bar 右緣；`inside` 放不下時自動改到 after（文字不會消失） | `UnifiedGanttLayout.jsx` / `exportGanttPDF.js` |
| 7 | PDF 字型對應：jsPDF 只有四種內建字型 → mono→`courier`、serif→`times`、其餘→`helvetica`（`pdfCoreFontFor()`，面板有提示） | `exportGanttPDF.js` |

### 驗收（自動化）
- 煙霧測試新增「Bar text style (position · font family · size · colours)」→ **78 項 OK / 0 FAIL**
  - 位置正規化 6 組、PDF 字型對應 7 組、面板 11 個標記、畫面 SSR（`translate(-100%, -50%)` / `text-align:right` / `font-size:15px` / 自訂顏色 hex）
  - PDF **dataURI 內容比對**：before ≠ inside ≠ after、Georgia ≠ Courier ≠ 預設、大小/顏色改變 → 都確實改變輸出
- ESLint 0 error；4 個模組 Vite 轉譯 HTTP 200

### 驗收（PDF 真實位元組 + 200 dpi 算圖目視）
```
position = before ：文字緊貼 bar 左緣右對齊，例如 "A1 · Excavate · 2026-09-15 · 2026-10-15"
position = inside ：白字畫在 bar 內（原行為）
position = after  ：文字緊接 bar 右緣
15px + Georgia + #b15315 → PDF 以 Times 系列字型 + 棕紅色 + 放大字級呈現
Courier New             → PDF 以 Courier 呈現
檔案大小：before 12399 / inside 12397 / after 12399 / styled 12461 / mono 12431 bytes
```

### 已知限制
- PDF 內建字型只有 4 種，所以 17 種家族會**歸類**成 Courier／Times／Helvetica（畫面仍用真正的字體家族）。
- 文字過長時 PDF 不做裁切（bar 前／後的文字可能與相鄰列的 bar 重疊，屬規劃師自行判斷）。
- 中文活動名稱在 PDF 仍為 `????`（既有全域限制，需嵌入 CJK 字型，見批次 28）。

**RTM（批次 29）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-2901 | Bar 文字位置可選條內／bar 前方／bar 後方，舊值 `right` 相容 | `normalizeBarTextPosition()` + BAR_TEXT_POSITIONS | Planner wants the caption placed where it fits | Verified |
| FR-2902 | 字體家族可選（17 種含 Comic Sans MS / Fira Sans / Monaco） | `bar.label.fontFamily` + WBS_FONT_FAMILIES | Planner wants to control the bar text font | Verified |
| FR-2903 | 文字大小 6–16 px 可調（預設 10） | `bar.label.fontSize` | Planner wants to control the bar text size | Verified |
| FR-2904 | 條內與條外文字顏色各自可調 | `bar.label.color` / `colorOutside` | Planner wants to control the bar text colour | Verified |
| FR-2905 | PDF 依位置對齊並將字型家族映射到最接近的內建字型 | `pdfCoreFontFor()` + exportGanttPDF | Planner wants the print to match the screen | Verified |
| AC-2901 | 煙霧測試 78 OK / 0 FAIL：位置、字型對應、面板、畫面 SSR、PDF dataURI 內容比對 | scripts/smoke-test.mjs | Planner wants to control the bar text | Verified |
| AC-2902 | PDF 目視：before 右對齊貼左緣、inside 白字、after 貼右緣、Georgia→Times、Courier→Courier | 渲染量測（2026-09-21） | Planner wants the print to match the screen | Verified |

---

## 🔧 批次 30（2026-09-21）— 完整顯示所有資料（不再以「…」省略）

### 使用者需求
> 「幫我調整完整顯示出所有資料，而不是以……省略」

### 診斷：先找出所有「會把資料藏起來」的地方
| 位置 | 原本行為 |
|------|----------|
| 甘特圖 bar 上的文字 | `overflow:hidden; text-overflow:ellipsis` → 文字比 bar 長就變成「A1 · Excava…」 |
| 甘特圖程式（WBS）名稱 | `text-overflow:ellipsis` → 長程式名稱被截斷 |
| 活動清單欄位（Resource / Duration Type / Status / Calendar / P6 ID / GUID…） | Tailwind `truncate` → 一律「…」 |
| PDF 表格每個欄位 | `fitTextInCell()`：最多只縮 20% 字級，然後**砍掉字尾接 `...`** |
| 資訊面板的資源代碼／名稱、面板標題 | `truncate` |

### 實作
| # | 內容 | 位置 |
|---|------|------|
| 1 | 新增**文字量測**工具：`measureTextWidth()`（瀏覽器用 canvas `measureText` 取得真實字寬；無 canvas 環境如 SSR/測試自動改用逐字估算，CJK 以 1 em 計）＋ `textFits()` ＋ `fitFontSizeToWidth()`（縮字級直到放得下，有下限）＋ 快取（600 列圖表每回合量測上千字串） | `displaySettings.js` |
| 2 | **bar 文字改用「實測寬度」判斷**是否放得進 bar（原本只比對固定的 Minimum bar width）：放得下→畫在 bar 內（並移除 ellipsis）；放不下→**整串畫到 bar 外**（依 Position 決定條前／條後）。完全不裁切、不省略 | `UnifiedGanttLayout.jsx` |
| 3 | 程式（WBS）名稱：移除 ellipsis，**完整顯示**（必要時延伸到時間軸上，與 P6 的 programme bar 標示一致） | `UnifiedGanttLayout.jsx` |
| 4 | 活動清單欄位：以 `fitFontSizeToWidth()` **自動縮字級塞進欄寬**（下限 6.5 px）取代 `truncate`；`title` 提示保留 | `UnifiedGanttLayout.jsx` |
| 5 | PDF `fitTextInCell()`：**永不截斷**，改為一路縮字級（下限 3.5 pt）直到整個值放得下 | `exportGanttPDF.js` |
| 6 | 資訊面板：資源代碼／名稱與標題改為 `break-words`（換行完整顯示） | `GanttInfoPanel.jsx` |
| 7 | 其他顯示資料名稱處：右鍵選單的活動名稱、快照名稱、專案名稱清單改為換行完整顯示（工具列上的專案名另加 `title` 提示） | `RowContextMenu.jsx` / `SnapshotManager.jsx` / `ProjectBar.jsx` |

### 驗收（自動化）
- 煙霧測試新增「Full values everywhere (no "…" truncation · chart + PDF text layer)」→ **79 項 OK / 0 FAIL**
  - 量測工具：正數、長字串更寬、CJK 約 1 em、縮字級有下限、短字串不縮
  - 畫面 SSR：長程式名稱與 65 字元活動名稱**完整出現**，且整份圖表 HTML **完全不含 `ellipsis` / `truncate`**
  - **PDF 文字層**（pdfjs `getTextContent()`）直接驗證：完整活動名稱與程式名稱都在，且整份 PDF **不含 `...`**
- ESLint 0 error；4 個模組 Vite 轉譯 HTTP 200

### 驗收（PDF 目視，220 dpi）
```
表格：Activity 欄完整印出
      "Excavate and cart away unsuitable material from the basement footprint"
      "Piling works - bored piles, 1.2 m diameter, incl. pile caps and testing"
      程式列 "PHASE ONE - Site preparation, drainage and piling works (Zone A to D)"
bar ：太窄的 bar 其說明整串移到 bar 後方：
      "A1 · Excavate and cart away unsuitable material from the basement footprint · 2026-09-01 · 2026-09-25"
```

### 行為改變（刻意，符合本次需求）
- 短 bar 的標籤不再「隱藏」或「省略」，而是**移到 bar 外完整顯示**（含預設的 Item 代碼）。
- 密集欄位改為縮字級顯示，字級最小到 6.5 px（畫面）／3.5 pt（PDF）。

### 已知限制
- 固定欄寬的極端長值（例如 36 字元 GUID 擠在 15 mm 欄位）：PDF 會縮到 3.5 pt 後仍可能略微溢出該欄；畫面則在 6.5 px 後由 `overflow:hidden` 裁切（不會顯示「…」，滑鼠移上去仍有完整 `title`）。要 100% 保證，需改成可變列高或讓欄位自動加寬（破壞與甘特圖的列對齊），故未採用。
- 以下**選擇器／清單**的窄列仍保留 `truncate`（不屬甘特圖的資料列，且換行會破壞對話框版面）：合併對話框活動清單、比較對話框、XML 關聯編輯器、區域選擇器、欄位篩選下拉、Export 未配對清單、PDF 預覽的檔名。若也要一併改，請告知。
- 中文活動名稱在 PDF 仍為 `????`（既有全域限制，需嵌入 CJK 字型，見批次 28）。

**RTM（批次 30）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3001 | 提供文字量測與縮字級工具（canvas + 估算後備） | `measureTextWidth()` / `textFits()` / `fitFontSizeToWidth()` | Planner wants every value shown in full | Verified |
| FR-3002 | bar 文字以實測寬度判斷，放不下就整串移到 bar 外（不省略） | UnifiedGanttLayout bar caption | Planner wants every value shown in full | Verified |
| FR-3003 | 程式名稱與活動清單欄位不再截斷（縮字級或完整顯示） | UnifiedGanttLayout | Planner wants every value shown in full | Verified |
| FR-3004 | PDF 表格欄位永不截斷（縮字級取代 `...`） | `fitTextInCell()` | Planner wants the print to show every value | Verified |
| FR-3005 | 資訊面板資源名稱／標題可換行完整顯示 | GanttInfoPanel | Planner wants every value shown in full | Verified |
| AC-3001 | 煙霧測試 79 OK / 0 FAIL：畫面 HTML 無 `ellipsis`/`truncate`，PDF 文字層含完整值且無 `...` | scripts/smoke-test.mjs | Planner wants every value shown in full | Verified |
| AC-3002 | PDF 目視：長活動名稱與長 bar 說明皆完整印出 | 渲染量測（2026-09-21） | Planner wants the print to show every value | Verified |

---

## 🔧 批次 31（2026-09-21）— Print content 面板加入「Bar text」開關

### 使用者需求
> 「該顯示點選請增加到 Print content 中」

### 實作
| # | 內容 | 位置 |
|---|------|------|
| 1 | Print Preview 的 **Print content** 面板新增第二個區塊 **「Bar text」**，內含三個與 Gantt Bars ▸ Bar Info **完全相同**的開關：**Names on bars／Start dates on bars／Finish dates on bars**（含說明文字） | `PdfPreviewDialog.jsx` |
| 2 | 這三個開關是**共用設定**（寫回 `displaySettings.bar.info`）：在列印預覽勾選 → **甘特圖同步改變**、預覽立即重建，畫面與紙本永遠一致 | `ExportDialog.jsx`（`handleBarInfoChange` → `updateDisplay({ bar })`） |
| 3 | 預覽重建時使用**新的** bar 設定（`buildPdfOptions({ bar: nextBar })`），因為 React state 尚未套用；舊的 blob URL 會撤銷避免記憶體洩漏 | `ExportDialog.jsx` |
| 4 | 沒傳 `onBarInfoChange` 的呼叫者不會看到這個區塊（向後相容，原有測試不變） | `PdfPreviewDialog.jsx` |
| 5 | 面板並提示「字體、大小、顏色、位置（條內／條前／條後）在 Gantt Bars ▸ Bar Info ▸ Text style」 | `PdfPreviewDialog.jsx` |

### 關於 Display 面板的另外兩個開關（Diff Only / Relation Filter）
**不需要加到 Print content**：匯出用的任務清單 `sortedComputedTasksForExport` 來自 `computedTasks = filtered`，而 `filtered` 已經包含 Diff Only 與 Relation Filter 的結果 → **PDF 印的就是篩選後的清單**（WYSIWYG）。因此它們在列印時本來就生效，加 checkbox 只會變成重複控制。

### 驗收（自動化）
- 煙霧測試新增「Print preview · bar text switches (shared with Gantt Bars ▸ Bar Info)」→ **80 項 OK / 0 FAIL**
  - 面板含 5 個標記（Bar text / 三個開關 / Text style 提示）
  - 勾選狀態跟著共用設定（勾 2 個 → 畫面多 2 個 `checked`）
  - 沒傳 handler 時區塊不出現（向後相容）
  - 原始碼驗證：`barInfo={barInfo}`、`onBarInfoChange={handleBarInfoChange}`、`updateDisplay({ bar: nextBar })`、`buildPdfOptions({ bar: nextBar })` 都在
- ESLint 0 error；2 個模組 Vite 轉譯 HTTP 200

### 已知限制
- 「Bar text」只放**三個內容開關**（避免面板過長）；樣式（字體／大小／顏色／位置）仍在 Gantt Bars ▸ Bar Info ▸ Text style，兩邊是同一組設定。

**RTM（批次 31）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3101 | Print content 面板提供 Bar text 的三個開關（Names／Start／Finish on bars） | PdfPreviewDialog `BAR_TEXT_OPTIONS` | Planner wants the display choices in the print preview | Verified |
| FR-3102 | 預覽上的開關與畫面共用同一設定（勾選後甘特圖同步改變） | ExportDialog `handleBarInfoChange` → `updateDisplay` | Planner wants one source of truth | Verified |
| FR-3103 | 切換後以新設定立即重建預覽（並撤銷舊 blob URL） | ExportDialog `buildPdfOptions({ bar })` | Planner wants what-you-see-is-what-you-download | Verified |
| FR-3104 | 未提供 handler 的呼叫者不受影響（區塊不顯示） | PdfPreviewDialog `canChooseBarText` | Planner wants no regressions | Verified |
| AC-3101 | 煙霧測試 80 OK / 0 FAIL：標記、勾選狀態、向後相容、原始碼接線 | scripts/smoke-test.mjs | Planner wants the display choices in the print preview | Verified |

---

## 🔧 批次 32（2026-09-21）— Start／Finish 同時開啟時：開始日期放 bar 前端、完成日期放 bar 後端

### 使用者需求
> 「如果同時點選了 Show Start Date on Bars 與 Show Finish Date on Bars 請分別將兩個日期放置到 Bar chart 的前端與後端分開顯示」

### 規則
只有在 **Show Start Date on Bars 與 Show Finish Date on Bars 兩個都勾選**時才拆開；只勾其中一個（或都不勾）維持原本「合併成一行」的標籤，行為完全不變。

```
                 ┌──── 前端（條前）────┐  ┌──── bar ────┐  ┌──── 後端（條後）────┐
兩個日期都勾選：  2026-08-20              [ A1 · Excavate ]  2026-10-20
                                        （名稱或 Item 依 Position 設定）
只勾開始：       [ A1 · Excavate · 2026-08-20 ]              ← 合併，原行為
只勾完成：       [ A1 · Excavate · 2026-10-20 ]              ← 合併，原行為
```

| # | 內容 | 位置 |
|---|------|------|
| 1 | 新共用函式 `buildBarTextParts(task, bar, dateFormat)` → `{ front, main, back, split }`：`split` 為真時 front＝開始日期、back＝完成日期、main＝其餘說明（名稱／Item…）；Labels 分頁的欄位若本來就是 `start`／`finish`，main 會自動留空避免重複 | `displaySettings.js` |
| 2 | 畫面：前端與後端各自是一個 **flex 列**（`gap: 6px`），前端整列右對齊貼在 bar 左緣（`translate(-100%, -50%)`）、後端貼 bar 右緣；main 依 Position 決定在條內或條前／條後，**任何長度都不會互相重疊** | `UnifiedGanttLayout.jsx` |
| 3 | PDF：同樣三個插槽，以前端右對齊（`align:"right"`）往左堆、後端往右堆，並用 `getTextWidth()` 計算間距 → 畫面與紙本一致 | `exportGanttPDF.js` |
| 4 | main 放不進 bar 時（條太窄或比較條切成半高）自動移到**後端**（完成日期之後），文字仍完整顯示 | 同上 |

### 驗收（自動化）
- 煙霧測試新增「Bar dates split (start in front · finish behind when both switches are on)」→ **81 項 OK / 0 FAIL**
  - `buildBarTextParts`：兩日期 → front/back/main 正確且 `split=true`；只勾一個 → `split=false` 且維持合併文字；Labels 欄位為 `start` 時 main 不留重複
  - 畫面 SSR：前端盒（`translate(-100%, -50%)` 僅 1 個）＋後端盒、日期各為獨立 span、名稱 span 不含日期、合併字串**不存在**；只勾一個時維持合併且無前端盒
  - PDF：內容與「只勾開始」及「預設」都不同
- 既有兩項測試（batch 28／30）依新規則更新預期 → 全數仍通過
- ESLint 0 error；3 個模組 Vite 轉譯 HTTP 200

### 驗收（PDF 目視，220 dpi）
```
兩日期都勾選
  寬 bar ：2026-08-20   [ A1 · Excavate ]   2026-10-20      ← 前端 / 條內 / 後端
  窄 bar ：2026-10-01   [ A2 · Piling ]     2026-10-10      ← 條太窄時 main 仍正確落位
只勾 Show Start Date（對照組）
  [ A1 · Excavate · 2026-08-20 ]                           ← 合併顯示，未改變
```

### 已知限制
- 前端沒有空間（bar 太靠時間軸左緣）時，日期會延伸到表格與時間軸交界處；PDF 亦同（不裁切、不省略）。
- 若 Position 設為 `before` 且同時開啟兩個日期：main 會排在**開始日期之前**（同一前端列，`gap` 分隔）。

**RTM（批次 32）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3201 | 同時勾選 Start／Finish 時，開始日期顯示在 bar 前端、完成日期在 bar 後端（分開顯示） | `buildBarTextParts()` + 畫面／PDF 插槽 | Planner wants the two dates at opposite ends of the bar | Verified |
| FR-3202 | 只勾選一個日期時維持原本合併標籤（行為不變） | `buildBarTextParts()` split 條件 | Planner wants no change to the single-date case | Verified |
| FR-3203 | 其餘說明（名稱／Item）依 Position 擺放，條內放不下時移到後端；各段不重疊（flex 列 + 間距） | UnifiedGanttLayout / exportGanttPDF | Planner wants readable captions | Verified |
| FR-3204 | 日期重複時自動省略（Labels 欄位＝start／finish） | `buildBarTextParts()` | Planner wants no duplicated dates | Verified |
| AC-3201 | 煙霧測試 81 OK / 0 FAIL（parts / 畫面 SSR / PDF 三層） | scripts/smoke-test.mjs | Planner wants the two dates at opposite ends of the bar | Verified |
| AC-3202 | PDF 目視：前後端各一日期、條內名稱、單日期仍合併 | 渲染量測（2026-09-21） | Planner wants the two dates at opposite ends of the bar | Verified |

---

## 🩹 批次 33（2026-09-21）— 修正 Print Preview「Comparison bars」的 bug

### 使用者回報
> 「請修正 Print Preview 中 Comparison bars 出現的 bug」

### 先重現，再修（實測結果）
```
printOptions.showComparisonBars = undefined → 勾選框 CHECKED   （預設開啟，正確）
printOptions.showComparisonBars = true      → 勾選框 CHECKED   （正確）
printOptions.showComparisonBars = false     → 勾選框 CHECKED   ✗ ← BUG：取消勾選後又自己跳回勾選
PDF 完全沒有讀 section 的 showComparison    ✗ ← BUG：畫面 Display ▸ Compare Bars 關掉，列印仍畫紫色對比條
```

### 根因
1. **勾選狀態判斷式寫錯**：`printOptions[key] !== false && printOptions[key] !== undefined ? !!printOptions[key] : key === "showComparisonBars"` —— 當值是 `false` 時第一個條件不成立，於是落到「沒設定 → 用預設值」的分支，而該分支的預設是 `true` → 永遠顯示勾選。**只有 `undefined`（從未設定）才應該回退到預設**。
2. **PDF 只認 `showComparisonBars` 這個全域選項**，沒有讀每個 programme 的 `showComparison` 旗標（畫面的「Compare Bars」開關設定的就是這個旗標）→ 列印與畫面不一致。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 勾選狀態改為 `isChecked()`：`undefined` → 用預設（Comparison bars 預設 true、其餘 false）；`false` → **未勾選**；`true` → 勾選 | `PdfPreviewDialog.jsx` |
| 2 | Comparison bars 改為**與畫面共用同一設定**：新增 `comparisonsOn` / `onComparisonChange`，勾選框直接反映 Display ▸ Compare Bars 的狀態，勾／取消都會同步改變畫面 | `PdfPreviewDialog.jsx` / `ExportDialog.jsx` |
| 3 | PDF **讀取每個 programme 的 `showComparison`**（列迴圈追蹤目前所屬 programme），對比條與對比里程碑都依此決定是否繪製 | `exportGanttPDF.js` |
| 4 | GanttPage 抽出 `handleSetComparisonBars()` 供 Display 開關與 Print Preview 共用（不再兩份邏輯） | `GanttPage.jsx` |

### 驗收（實測）
```
勾選框（SSR 直接渲染面板）
  printOptions=false        → unchecked ✓（bug 修正）
  comparisonsOn=false 而 printOption=true  → unchecked ✓（以畫面設定為準）
  comparisonsOn=true  而 printOption=false → CHECKED   ✓
PDF 像素（150 dpi 算圖，數紫色 #7c3aed 像素）
  Display ▸ Compare Bars 開（預設）→ 4356 px
  Display ▸ Compare Bars 關        → 0 px ✓（且與 ExportDialog 自身關閉選項的輸出「長度完全相同」）
煙霧測試  → 82 項 OK / 0 FAIL（新增「Print preview · Comparison bars」整項）
ESLint 0 error；4 個模組 Vite 轉譯 HTTP 200
```

### 一併修正：測試方法的弱點（工程誠實）
原本有幾項測試用「兩個 PDF 的 `dataURI` 字串不相等」來證明繪製有變化 —— 但 **jsPDF 每次都會寫入不同的 `CreationDate` 時間戳**，所以兩個 build 永遠不相等，那些斷言其實沒證明任何事。已改為有意義的量測：
- 文字層 **x 座標**（before < inside < after；拆分的 start < 名稱 < finish）
- 文字層 **字寬**（15 px 比 10 px 寬、Courier 與 Helvetica 不同）
- 檔案長度（時間戳寬度固定，可用於「輸出是否有變」）
- 面板 DOM 的勾選狀態

**RTM（批次 33）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3301 | Print Preview 的 Comparison bars 勾選狀態必須正確反映設定（false → 未勾選） | PdfPreviewDialog `isChecked()` | Planner wants the print options to be trustworthy | Fixed |
| FR-3302 | Comparison bars 與畫面 Display ▸ Compare Bars 共用同一設定（單一來源） | GanttPage `handleSetComparisonBars` + ExportDialog | Planner wants chart and paper to agree | Fixed |
| FR-3303 | PDF 依每個 programme 的 `showComparison` 決定是否繪製對比條／對比里程碑 | exportGanttPDF `sectionAllowsComparison` | Planner wants the print to match the screen | Fixed |
| AC-3301 | 勾選狀態 5 種組合全部正確；PDF 紫色像素 4356 → 0；與全域關閉選項輸出一致 | 量測（2026-09-21） | Planner wants the print options to be trustworthy | Verified |
| AC-3302 | 煙霧測試 82 OK / 0 FAIL；並改用文字層座標／字寬取代不可靠的 dataURI 比較 | scripts/smoke-test.mjs | Planner wants reliable regression tests | Verified |

---

## 🩹 批次 34（2026-09-21）— 階梯線又變灰 + Comparison bars 預設值與「勾了沒反應」

### 使用者回報（三個症狀）
1. Print Preview 裡的 **Staircase line 又變成灰色**。
2. Comparison bars 的**相關日期對比應該默認不顯示**。
3. 在 Print Preview **勾選 Comparison bars 也沒有任何額外顯示**。

### 根因（逐一實測）
1. **階梯線其實還是紅的**（#dc3545、1.7008 pt = 0.6 mm、實心無虛線），問題在**量測尺度選錯**：
   批次 26c 是用 150–300 dpi 驗收的，但使用者看的是 A3 橫式（420 mm）放進約 1100 px 寬的預覽 iframe ≈ **66 dpi**，
   0.6 mm 在該尺度只有約 1.5 px，抗鋸齒佔掉一半以上 → 肉眼看就是灰的。
   同一 fixture 實測 66 dpi：**全強度 654 px、灰階 794 px（灰比紅多）**。
2. **預設值**：`printOptions.showComparisonBars` 自批次 26 起預設 `true`，於是每次列印都出現紫色的 baseline 對比條。
3. **勾選無效**：勾選後立即重建預覽用的是**當下的 `tasks`**（React state 還沒套用），
   而批次 33 在 PDF 端新增的 `sectionAllowsComparison` 閘門讀的正是 programme 的 `showComparison`，
   舊值為 `false` 時就**什麼都不畫** → 使用者看到「點了沒反應」。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 階梯線寬度下限 0.6 → **1.0 mm**（上限 1.2 mm），繪製前 `resetLineStyle()` 重設虛線樣式 | `exportGanttPDF.js` |
| 2 | 「Comparison bars」**列印預設改為 OFF**（畫面 Display ▸ Compare Bars 不受影響，仍預設開） | `ExportDialog.jsx` / `PdfPreviewDialog.jsx` |
| 3 | 舊設定遷移：新增 `printOptionsVersion`（現為 2）；讀到沒有版本標記的舊設定時**一次性丟棄**舊預設帶來的 `showComparisonBars: true` | `ExportDialog.migratePrintOptions()` |
| 4 | 勾選框狀態＝**列印選項本身**（不再由畫面旗標決定）；勾選時同步打開 programme 旗標，避免被閘門擋掉 | `PdfPreviewDialog.jsx` |
| 5 | 重建預覽時帶入 **patched tasks**（`withComparisonFlag()`）→ 勾選立刻生效，不可能再「沒反應」 | `ExportDialog.handleComparisonBarsChange` |

### 驗收（實測）
```
階梯線（66 dpi = 預覽實際尺度，同一 fixture 前後對比）
  修正前：全強度   654 px／灰階   794 px   ← 灰比紅多，看起來就是灰的
  修正後：全強度  1281 px／灰階   941 px   ← 線寬 2.8346 pt = 1.00 mm
  放大檢視：線心每一列都是純 #db3645，不再是洗白的粉灰
PDF 內容串流：階梯線之前的最後一個虛線運算子為空樣式 → 確認實心

Comparison bars（150 dpi 數紫色 #7c3aed 像素）
  列印預設（未勾選）                          →    0 px ✓
  未勾選、但畫面 Compare Bars 開（出廠預設）    →    0 px ✓
  勾選後（畫面旗標原為關，走 patched 重建路徑） → 9192 px ✓ ←「勾了沒反應」修正

煙霧測試 → 83 OK / 0 FAIL（新增「Print PDF · Staircase line stays red at preview zoom」）
ESLint 0 error；4 個模組 Vite 轉譯 HTTP 200
```

### 一併修正：量測尺度（工程誠實）
批次 26c 的「階梯線已修好」是在 **150–300 dpi** 量的，那是預覽尺度的 2～4 倍，
等於答錯了問題。本批次改用**使用者真正看到的 66 dpi** 驗證，煙霧測試也直接從 PDF 內容串流
讀出線寬（需 ≥1.00 mm）與虛線狀態，避免再憑高解析假象過關。

**RTM（批次 34）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3401 | 列印階梯線在預覽尺度仍須清楚呈色（寬度下限 1.0 mm、實心） | exportGanttPDF 階梯線繪製 | Planner wants the printed line to match the chart | Fixed |
| FR-3402 | Comparison bars 列印預設不顯示（畫面 Compare Bars 不受影響） | ExportDialog `printOptions` | Planner wants a clean default print | Fixed |
| FR-3403 | Print Preview 勾選 Comparison bars 必須立即畫出紫色對比條 | ExportDialog `withComparisonFlag` + 預覽重建 | Planner wants every switch to do something | Fixed |
| NFR-3401 | 舊存檔不得讓新預設失效（`printOptionsVersion` 一次性遷移） | ExportDialog `migratePrintOptions` | Planner wants predictable defaults | Fixed |
| AC-3401 | 66 dpi 量測：全強度像素 654 → 1281、線寬 1.00 mm、無虛線洩漏 | 量測（2026-09-21） | Planner wants the printed line to match the chart | Verified |
| AC-3402 | 紫色像素：預設 0、未勾選 0、勾選 9192；煙霧測試 83 OK / 0 FAIL | scripts/smoke-test.mjs | Planner wants reliable regression tests | Verified |

---

## 🩹 批次 35（2026-09-21）— 多頁列印：只有最後一頁是紅色，其餘都是灰色

### 使用者回報
五頁的 programme 列印時，**只有最後一頁的紅線是正確顏色**，其他四頁都是灰色。

### 根因（PDF 內部實證）
jsPDF 的 `setDrawColor` / `setLineWidth` 會把運算子寫進**呼叫當下所在那一頁**的內容串流。
階梯線是在迴圈**外面**設定一次樣式，因此：
- 樣式只落在「呼叫當時剛好是當前頁」的那一頁（列迴圈最後停在最後一頁）→ 只有那一頁是紅色；
- 其他頁面的串流裡沒有任何樣式運算子 → 使用 PDF 預設狀態（黑色 1 pt）→ 預覽尺度看起來就是灰的。

實證（4 頁 fixture，統計「紅色 stroke 運算子」與逐頁差異像素）：
```
修正前：紅色 stroke 運算子全檔 1 個
  page 1: 階梯線 1079 px，紅色 0%（全灰）
  page 2-4: 完全沒畫
修正後：紅色 stroke 運算子全檔 4 個
  page 1: 2448 px，紅色 66%      page 2: 3845 px，紅色 77%
  page 3: 3851 px，紅色 65%      page 4: 2283 px，紅色 50%
  灰／黑像素：四頁合計 7 px（僅邊緣抗鋸齒）
```

### 順帶修好的第二個多頁缺陷
原本只要某列的頁碼與 programme 起始頁不同就**直接丟棄**該 step，因此一個 programme 跨頁時，
階梯線到第一頁底部就斷掉，後面幾頁完全沒有線。現在每個 step 帶自己的頁碼，
換頁時把「目前最大完成位置（running maximum）」帶到下一頁、從圖表左緣續畫，
符合畫面上那一條連續折線的樣子。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 樣式（`resetLineStyle` + `setDrawColor` + `setLineWidth`）改為**每次 `setPage()` 之後**套用（`applyStaircaseStyle()`） | `exportGanttPDF.js` |
| 2 | step 帶頁碼；跨頁時延續 running maximum，不再丟棄後續 step | `exportGanttPDF.js` |
| 3 | 煙霧測試新增多頁斷言：紅色樣式運算子數量必須**等於頁數** | `scripts/smoke-test.mjs` |

同批稽核（同類風險）：Today line、Last Recalc line、Holiday shading、Relationship arrows、外框、頁尾
的樣式設定都已在 `setPage()` **之後**，沒有此問題；對比條在每一頁實測也都是紫色
（31.7k / 34.8k / 34.7k / 9.5k px，非灰色）。

### 驗收
```
煙霧測試 83 OK / 0 FAIL（新增「4 styled pages for 4 printed pages」斷言）
ESLint 0 error
```

**RTM（批次 35）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3501 | 列印時每一頁的階梯線都必須套用自己的樣式（顏色／線寬須在 `setPage()` 之後設定） | exportGanttPDF `applyStaircaseStyle()` | Planner wants the printed line to match the chart | Fixed |
| FR-3502 | 階梯線跨頁時必須延續，不得在換頁處斷掉 | exportGanttPDF 階梯線 step 帶頁碼 | Planner wants a continuous progress line | Fixed |
| NFR-3501 | 同類頁面範圍狀態檢查：其餘逐頁繪製元素不得有相同缺陷 | exportGanttPDF（Today／Recalc／Holiday／Arrows／外框／頁尾） | Planner wants predictable output | Verified |
| AC-3501 | 4 頁 fixture：紅色樣式運算子 1 → 4；每頁階梯線紅色佔比 50–77%、灰黑像素 ≤7 | 量測（2026-09-21） | Planner wants the printed line to match the chart | Verified |
| AC-3502 | 煙霧測試 83 OK / 0 FAIL，含「每頁都有樣式」斷言 | scripts/smoke-test.mjs | Planner wants reliable regression tests | Verified |

---

## 🔍 批次 36（2026-09-21）— 畫面的 Comparison bars vs 列印的 Comparison bars：完整比對與修正

### 使用者提問
「基礎頁面（畫面甘特圖）能顯示的兩段對比時長，為什麼在匯出預覽與最終 PDF 裡都沒有了？」

### 完整比對（逐條從程式碼取出，非推測）

| 項目 | 畫面 `UnifiedGanttLayout` | PDF `exportGanttPDF`（修正前） | 修正後 |
|------|--------------------------|-------------------------------|--------|
| **對比條何時畫** | 只要「比較日期 ≠ 現行日期」就畫（`hasBL` / `hasLate` / `hasEarly`） | 相同 ＋ **額外被 `showComparison` 閘門擋掉** ✗ | ✅ 與畫面同規則（移除閘門） |
| **`showComparison`（Display ▸ Compare Bars）** | 只用於 **programme 之間的對比箭頭**；對紫色/棕色對比條**沒有影響** | 批次 33 誤把它當成對比條的總開關 ✗ | ✅ 不再影響對比條 |
| **總開關** | 無（永遠畫） | Print 選項 `showComparisonBars`（批次 34 起預設 OFF） | 保留（列印專用） |
| **BL / Late / Early 選擇** | BL 欄隱藏且 Late 可見→Late；再否則 Early；否則 BL | 相同 | 相同 ✅ |
| **顏色** | **#733208 棕**（opacity 0.85）、對比里程碑空心棕 | **#7c3aed 紫** ✗ | ✅ 改為 #733208 棕 |
| **表格 BL 欄文字** | #733208 棕 | 紫色 ✗ | ✅ 改為棕 |
| **位置** | 對比條在**上半**、現行條在**下半** | 相同 | 相同 ✅ |
| **已刪除列（`deletedFromBL`）** | 不畫對比條 | 仍畫 ✗ | ✅ 不畫 |
| **日期範圍** | 只由現行 start/end 決定（−7 / +14 天） | 只由現行 start/end 決定（±15 天→月界），比畫面略寬 | 相同 ✅ |

### 主因（為什麼畫面的對比條在 PDF 消失）
1. **批次 33 的錯誤閘門**（主因）：批次 33 我讓 PDF 依「每個 programme 的 `showComparison`」決定是否畫對比條。
   但**匯入的程式（XER / Excel parser）把每一列的 `showComparison` 都設成 `false`**（`parseXER.js:284`、`excel_parser.py` 多處），
   而**畫面根本不看這個旗標** → 畫面上有、列印全部消失。
2. **列印預設 OFF**（批次 34，你要求的「默認不顯示」）：沒勾選時列印不會有對比條。
3. 顏色不一致（畫面棕、PDF 紫）讓「畫面上看到的」與「列印出來的」看起來像不同東西。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 移除 `sectionAllowsComparison` 閘門：對比條改為只受列印選項 `showComparisonBars` ＋「比較日期不同」控制（與畫面同規則） | `exportGanttPDF.js` |
| 2 | 對比條／對比里程碑／表格 BL 欄文字顏色改為 **#733208 棕**（與畫面一致，紫色 `#7c3aed` 全部移除） | `exportGanttPDF.js` |
| 3 | `deletedFromBL` 列不畫對比條（畫面的 `isDeleted` 規則） | `exportGanttPDF.js` |
| 4 | Print 面板提示文字更新（「Purple…」→「brown, same as the chart」） | `PdfPreviewDialog.jsx` |
| 5 | 煙霧測試改為斷言「與畫面同規則」：匯入檔（`showComparison: false`）＋列印開 ⇒ 與正常情況輸出**完全相同**；刪除列 ⇒ 與「不畫對比條」輸出相同；顏色運算子必須是棕且不得有紫 | `scripts/smoke-test.mjs` |

### 驗收（實測）
```
煙霧測試 83 OK / 0 FAIL
  ・匯入檔（每列 showComparison:false）＋列印開 = 一般輸出一致（修正前 = 「完全不畫」）
  ・刪除列 = 不畫對比條的輸出
  ・內容串流：0.45 0.2 0.03 rg（#733208 棕）存在、0.49 0.23 0.93 rg（紫）不存在
像素（scale=2 算圖）
  匯入檔＋列印開：棕 13,176 px、紫 0 px；外觀＝上半棕 + 下半青（與畫面同構）
ESLint 0 error
```

**RTM（批次 36）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3601 | 列印對比條必須與畫面同規則（比較日期不同即繪製），不得被 programme 的 `showComparison` 擋掉 | exportGanttPDF（移除 `sectionAllowsComparison`） | Planner wants print == chart | Fixed |
| FR-3602 | 對比條／對比里程碑／BL 欄文字顏色須與畫面一致（#733208 棕） | exportGanttPDF `COMPARISON_COLOR` | Planner wants print == chart | Fixed |
| FR-3603 | `deletedFromBL` 列不得繪製對比條 | exportGanttPDF `hasComparison` / `hasCompMile` | Planner wants print == chart | Fixed |
| — | **FR-3303 已被 FR-3601 取代**（批次 33 的「PDF 依 programme 旗標決定」是錯的） | — | — | Reverted |
| AC-3601 | 匯入檔＋列印開＝一般輸出；刪除列＝不畫；棕存在／紫不存在；煙霧測試 83 OK / 0 FAIL | 量測（2026-09-21） | Planner wants print == chart | Verified |

---

## 🏷️ 批次 37（2026-09-21）— Display 面板開關正名：「Compare Bars」→「Comparison Arrows」

### 使用者決定
批次 36 的選項 (A)：不改語意（該開關確實是 **programme 之間的對比箭頭**），但把標籤改清楚，
避免與 Print Preview 的「Comparison bars」混淆。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | Display 面板標籤 `Compare Bars` → **`Comparison Arrows`**，並加上 tooltip 說明：「Arrows between the current and comparison programmes — the comparison bars themselves follow the compared dates」 | `GanttPage.jsx` |
| 2 | Display 開關的按鈕加上 `title={item.hint \|\| item.label}`，讓 hint 可作為 tooltip 顯示（原本只顯示標籤） | `GlobalSettingsPanel.jsx` |
| 3 | 相關註解同步更新（不再寫「Compare Bars」） | `GanttPage.jsx` / `ExportDialog.jsx` / `PdfPreviewDialog.jsx` / `scripts/smoke-test.mjs` |
| 4 | 面板清單文件同步更新 | `doc/requirements.md`（面板分類表） |
| 5 | 煙霧測試新增斷言：標籤必須是 `Comparison Arrows`、不得再有 `Compare Bars`，且 hint 有接上 tooltip | `scripts/smoke-test.mjs` |

**語意釐清（現行行為）**
- **Display ▸ Comparison Arrows**（`showComparison`，每個 programme 一個旗標）→ 控制「現行 programme ↔ 對比 programme」之間的**對比箭頭**與群組。
- **Print Preview ▸ Comparison bars**（列印選項，預設 OFF）→ 控制列印是否畫出**對比條**。
- 畫面上的對比條（棕色 `#733208`）只要「比較日期 ≠ 現行日期」就會出現，與上面兩者無關（批次 36 已讓 PDF 同規則）。
- 勾選列印的 Comparison bars 時，會同時把 `showComparison` 打開，讓畫面的對比箭頭與紙本一致。

### 驗收
```
煙霧測試 83 OK / 0 FAIL（斷言：標籤＝Comparison Arrows、無 Compare Bars、tooltip 有接）
ESLint 0 error
```

**RTM（批次 37）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3701 | Display 面板開關改名為「Comparison Arrows」並提供 tooltip，避免與列印的「Comparison bars」混淆 | GanttPage `displayToggles` | Planner wants labels that match what they do | Fixed |
| FR-3702 | Display 開關須支援 `hint` 作為 tooltip | GlobalSettingsPanel | Planner wants labels that match what they do | Fixed |
| AC-3701 | 煙霧測試斷言標籤正確且舊標籤不再出現；83 OK / 0 FAIL | scripts/smoke-test.mjs | Planner wants reliable regression tests | Verified |

---

## 🪜 批次 38（2026-09-21）— 畫面的 Staircase line vs 列印的 Staircase line：完整比對與修正（**以畫面為準**）

### 使用者要求
「兩邊的 Staircase line 顯示結果也存在差異，幫我檢查問題所在，以基礎頁面為主。」

### 完整比對（畫面 `UnifiedGanttLayout`：`bpMap` + `staircases` + `<polyline>` ⚔ PDF `exportGanttPDF`）

| 項目 | 畫面（**基準**） | PDF 修正前 | 修正後 |
|------|------------------|-----------|--------|
| 參與的列 | 每個「有位置」的非 section 列；`bpMap` 由 `start/end` 決定，`deletedFromBL` 用 **BL 日期** | 只有「同時有 start 與 end 的長條」✗ | ✅ 同畫面 |
| **里程碑列** | **參與**（`bpos(start, start)` → 寬 1 天） | 不參與（里程碑沒有位置）✗ | ✅ 參與（1 天寬） |
| **第一個 section 之前的列** | **參與**（自成 leading group） | 直接跳過（`current == null`）✗ | ✅ 參與 |
| BulkEditBar「Staircase filter」 | 生效（只畫被選取的列） | 忽略 ✗ | ✅ 生效（新選項 `staircaseFilterIds`） |
| 線的高度 | 貼齊每個長條的 **上緣**（`idx*ROW_H + (ROW_H−BH)/2`） | 相同（`barTopBase`） | 相同 ✅ |
| 起點／終點 | 第一列 left → running max，尾端再掉半個 row | 相同 | 相同 ✅ |
| 只往右前進 | `if (bx2 < mx) continue` | `if (step.right < reach) continue` | 相同 ✅ |
| 顏色／線寬 | `#dc3545`、2 px（27 px 列高） | `#dc3545`、下限 1.0 mm（批次 34／35 的預覽可讀性） | ✅ |
| **已刪除列的長條** | `deletedFromBL` → 用 BL 日期定位、畫 **紅** `#dc3545`、不算 critical、不畫對比條 | 完全不畫 ✗ | ✅ 同畫面 |
| 跨頁 | 畫面無分頁 | 批次 35 起「跨頁延續 running maximum」 | ✅（唯一刻意的差異，見下） |

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 抽出 `collectStaircaseSteps()`：與畫面同規則（leading group／里程碑／filter／丟棄空群組），PDF 與測試共用 | `exportGanttPDF.js` |
| 2 | 里程碑加入階梯線位置（1 天寬），且**不影響** relationship arrows（另存 `staircasePositions`） | `exportGanttPDF.js` |
| 3 | `deletedFromBL` 列：以 BL 日期定位、畫紅色長條、排除 critical 判定 | `exportGanttPDF.js` |
| 4 | 新增 `staircaseFilterIds` 選項，並由 GanttPage → ExportDialog → PDF 傳遞（BulkEditBar 的 Staircase filter） | `GanttPage.jsx` / `ExportDialog.jsx` |
| 5 | 煙霧測試新增整項「Staircase line takes part the same rows as the chart」 | `scripts/smoke-test.mjs` |

### 驗收（實測）
```
fixture：leading 列 + 1 section + 長條 + 里程碑 + 長條 + 已刪除列（僅 BL 日期）
  修正前：只畫主要群組的長條，里程碑與刪除列不參與
  修正後：階梯線段數 = 10（leading 1 步 + 主要群組 4 步，每步 2 段）
  套用 Staircase filter（只選 2 列）→ 4 段 ✓
  座標換算回日期：A110 09-05..09-20 ✓、里程碑 09-25..09-26（1 天）✓、
                  A130 09-22..10-05 ✓、刪除列 BL 09-28..10-15 ✓
  目視：紅線貼齊長條上緣、跨過里程碑菱形後續行、刪除列顯示為紅條
煙霧測試 84 OK / 0 FAIL；ESLint 0 error
```

### 唯一刻意的差異（未改，待你決定）
畫面若**收合（collapse）**某些 section，那些列不在 `displayTasks` 內 → 畫面的階梯線會跳過它們；
列印一律印出所有列，因此階梯線也會經過它們。若你要「列印也跟著收合狀態」請告知（需把 `collapsedIds` 傳進 PDF）。

**RTM（批次 38）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3801 | 列印階梯線必須與畫面同規則：領先群組、里程碑、`deletedFromBL` 列皆須參與 | exportGanttPDF `collectStaircaseSteps()` | Planner wants print == chart | Fixed |
| FR-3802 | 里程碑以「1 天寬」的位置參與階梯線（`bpos(start,start)` 等價），且不得改變 relationship arrows 行為 | exportGanttPDF `staircasePositions` | Planner wants print == chart | Fixed |
| FR-3803 | `deletedFromBL` 列以 BL 日期定位並以 `#dc3545` 紅條繪製 | exportGanttPDF 列迴圈 | Planner wants print == chart | Fixed |
| FR-3804 | 列印階梯線須尊重畫面的 BulkEditBar「Staircase filter」 | `staircaseFilterIds`（GanttPage → ExportDialog → PDF） | Planner wants print == chart | Fixed |
| AC-3801 | fixture 段數 10／篩選後 4；座標換算日期全部吻合；煙霧測試 84 OK / 0 FAIL | 量測（2026-09-21） | Planner wants print == chart | Verified |

---

## 📐 批次 39（2026-09-21）— Comparison Arrows（programme 完工日差幾天）也能列印到 PDF

### 使用者要求
「顯示兩部分 programme 之間的 Finish date 相差多少 days 的 Comparison Arrows，
也應該能夠被點選顯示在匯出的 pdf 中。」

### 畫面原本的實作（基準，`UnifiedGanttLayout` ▸ `cmp-*`）
- 只有**相鄰的兩個 programme**（`staircases` 群組）且**兩者的 Compare 旗標都不是 false** 才畫。
- `x1/x2` = 該 programme「最右邊的長條邊緣」（`gex` = `max(pos.left + pos.width)`）。
- `d1/d2` = 該 programme「最晚的完成日」（`ged` = `max(end || start)`）。
- 內容：兩個完工日各一條**棕色 `#733208` 虛線豎線**＋**菱形**；兩者之間一條**雙向箭頭**（箭頭朝外），
  畫在**第二個 programme 的 section 列**中央；中間一個**白底標籤**顯示 `{n} WD` 或 `{n} Cal`：
  `Cal = |differenceInDays(d1,d2)| + 1`、`WD = countWorkingDays(較早, 較晚)`。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | PDF 新增 `showComparisonArrows` 選項，依畫面同一套規則繪製（虛線豎線貫穿每一頁的圖表區、菱形、雙向箭頭、`{n} WD/Cal` 白底標籤） | `exportGanttPDF.js` |
| 2 | 尺寸依 `effectiveRowH / 27` 等比換算（與長條／階梯線同一比例），線寬／字級設有下限以維持列印可讀性 | `exportGanttPDF.js` |
| 3 | `collectStaircaseSteps()` 的每個群組額外帶 `showComparison`、`sectionIdx`（箭頭要畫在哪一列）與每步的 `finish`（畫面的 `ged`） | `exportGanttPDF.js` |
| 4 | Print Preview 面板新增列印開關「**Comparison arrows**」（預設 OFF） | `PdfPreviewDialog.jsx` |
| 5 | 勾選時同時打開 programme 的 Compare 旗標並以 patched tasks 重建預覽 → 匯入檔（旗標為 false）也能一勾就出現，不會再有「點了沒反應」 | `ExportDialog.handleComparisonArrowsChange` |
| 6 | 煙霧測試新增整項「Print PDF · Comparison arrows」 | `scripts/smoke-test.mjs` |

### 驗收（實測）
```
fixture：Current programme 完工 2026-09-30、Comparison programme 完工 2026-10-20
  打開選項：PDF 文字層出現 "21 Cal"（= |20 天| + 1 ✔ 與畫面公式相同）
            內容串流有 2 個虛線運算子 [3.40 2.27] 0. d（兩個完工日豎線）＋ 棕色 0.451 0.196 0.031 rg
  durMode = wd：標籤 "17 WD"（香港工作日，扣除 10-01 國慶）
  關閉選項：沒有任何標籤 ✓
  兩個 programme 的 Compare 旗標為 false：沒有標籤 ✓（與畫面同一道閘門）
  面板：Print Preview ▸ Print content 出現「Comparison arrows」且預設未勾選 ✓
  目視：虛線豎線、菱形、雙向箭頭、白底「21 Cal」標籤，與畫面一致
煙霧測試 85 OK / 0 FAIL；ESLint 0 error
```

**RTM（批次 39）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-3901 | Print Preview 必須提供「Comparison arrows」列印開關（預設 OFF） | PdfPreviewDialog `PRINT_CONTENT` | Planner wants the chart annotation on paper | Fixed |
| FR-3902 | PDF 依畫面規則繪製對比箭頭（相鄰 programme、`gex` 為 x、`ged` 為完工日、`\|diff\|+1`／`countWorkingDays` 標籤） | exportGanttPDF `showComparisonArrows` | Planner wants print == chart | Fixed |
| FR-3903 | 勾選時須同時打開 programme 的 Compare 旗標並即時重建預覽（匯入檔也能一勾就出現） | ExportDialog `handleComparisonArrowsChange` | Planner wants every switch to do something | Fixed |
| NFR-3901 | 開關預設 OFF，未勾選時輸出與之前完全相同（其他選項不受影響） | exportGanttPDF / ExportDialog | Planner wants a clean default print | Verified |
| AC-3901 | 標籤 "21 Cal"／WD 模式 "17 WD"；關閉或旗標為 false 時無標籤；虛線運算子 2 個；煙霧測試 85 OK / 0 FAIL | 量測（2026-09-21） | Planner wants print == chart | Verified |

---

## 🗑️ 批次 40（2026-09-21）— Programme 列（section）也加上跟其他列一樣的刪除鍵

### 使用者要求
「跟其他 item 欄目一樣，在左欄欄目内的右邊增加一個刪除鍵。」

### 原本的狀況
- 活動列的左欄最右邊（Duration 儲存格內）已有一個垃圾桶圖示：滑鼠移上去才出現，按一下即刪除該列
  （`UnifiedGanttLayout.jsx` ▸ `case "duration"`，`opacity-0 group-hover:opacity-100`）。
- **programme（section）列不走逐欄渲染**：它的左欄是一個 flex 容器（收合箭頭 ＋ 名稱輸入框），
  所以那個垃圾桶不會出現 ✗ → 只能靠右鍵選單 `Delete Row` 刪除。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | programme 列的名稱輸入框**右邊**加上同一顆垃圾桶按鈕（同樣的 class／圖示大小／hover 行為，`stopPropagation` 以免觸發列選取） | `UnifiedGanttLayout.jsx`（`{isSec ? (` … `) : (` 分支） |
| 2 | 兩顆垃圾桶都加上 `title="Delete row (Ctrl+Z to undo)"` 與 `type="button"`（可測試、也提示可復原） | `UnifiedGanttLayout.jsx` |
| 3 | 煙霧測試新增整項「Row delete button on every row (programmes included)」 | `scripts/smoke-test.mjs` |

### 驗收（實測）
```
SSR 渲染 layout（fixture：1 個 programme 列 + 2 個活動列）
  → 刪除按鈕數量 = 3（每列一個，含 programme 列）✓
  → programme 列的按鈕位於其名稱輸入框之後（同一 flex 容器內、容器右端）✓
  → 原始碼檢查：section 分支內含 del(task.id) 與 <Trash2 size={10} />，且全檔共有 2 顆（programme + 活動）✓
抽樣 DOM：chevron@8172 … delete@8866（箭頭在前、刪除鍵在後，名稱輸入框位於兩者之間）
煙霧測試 86 OK / 0 FAIL；ESLint 0 error；Vite 轉譯 200
```

**操作方式**：滑鼠移到 programme 列（例如殘留的 “New Programme”）→ 右端出現 🗑️ → 按一下即刪除；刪錯可按 **Ctrl+Z** 復原。

**RTM（批次 40）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4001 | programme（section）列在左欄右端須提供與活動列相同的刪除按鈕 | UnifiedGanttLayout section 分支 | Planner wants one consistent way to delete a row | Fixed |
| FR-4002 | 刪除按鈕不得觸發列選取（`stopPropagation`）且可復原（沿用 `del()` 的歷史紀錄） | 同上 | Planner wants safe editing | Fixed |
| AC-4001 | fixture 3 列 → 3 顆刪除按鈕；section 分支含 `del(task.id)`；煙霧測試 86 OK / 0 FAIL | 量測（2026-09-21） | Planner wants one consistent way to delete a row | Verified |

---

## ✂️ 批次 41（2026-09-21）— 單點刪除 programme 只刪那一列（不連同下方活動列）

### User Story
As a **planner**, I want **clicking the delete button on a programme row to remove only that programme row**, so that **the activities listed under it are not lost by accident**.

### 需求釐清（使用者確認）
「單一點選刪除 programme 時，只刪除 programme，不包括下方其他活動列。」

### 現況（已符合，非新增行為）
刪除路徑只有兩種，都**沒有**任何串聯刪除：

| 路徑 | 實作 | 結果 |
|------|------|------|
| 左欄垃圾桶（活動列 Duration 儲存格／programme 列右端） | `del(task.id)` → `setTasks(p => p.filter(t => t.id !== id))` | **只刪那一列** |
| 右鍵選單 ▸ 🗑️ Delete Row | 同上（`action === "delete"` → `del(task.id)`） | **只刪那一列** |
| BulkEditBar ▸ Delete（批次） | `updated.filter(t => !selectedIds?.has(t.id))` | 只刪**被選取**的 ids（要整段刪除時，用 Ctrl+Click 把 programme 列一起選進來） |

刪除後，下方活動列會留在原位、只是上方不再有 programme 標題（各活動列自己的欄位／日期／連結完全不動）。

### 補強：把這個行為鎖進測試（避免日後不小心加出串聯刪除）
| # | 內容 | 位置 |
|---|------|------|
| 1 | 煙霧測試新增整項「Deleting a programme row keeps the activity rows below it」：<br>· 原始碼：`del()` 必須是 `filter(t=>t.id!==id)` 且**不得提及 `isSection`**（＝沒有連子列一起刪）<br>· 批次刪除必須只依 `selectedIds`<br>· SSR：刪掉 programme 列後的畫面仍要有兩個活動列、且 programme 標題消失 | `scripts/smoke-test.mjs` |

### 驗收（實測）
```
SSR（fixture：1 programme + 2 活動）
  刪除 programme 後：activitiesKept=true（Excavate / Piling 都還在）
                     programmeGone=true（New Programme 標題消失）
  原始碼：idOnly=true（del 僅按 id 過濾、無 isSection）／bulkOnly=true／noCascade=true
煙霧測試 87 OK / 0 FAIL；ESLint 0 error；UnifiedGanttLayout 轉譯 200
```

**RTM（批次 41）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4101 | 單點刪除 programme 列只刪該列，不得連同下方活動列一起刪除 | UnifiedGanttLayout `del()` | Planner wants safe row deletion | Verified |
| FR-4102 | 刪除後活動列必須完整保留（欄位／日期／連結不變），只是沒有 programme 標題 | UnifiedGanttLayout 列渲染 | Planner wants safe row deletion | Verified |
| AC-4101 | SSR：刪除後仍渲染 2 個活動列、programme 標題消失；`del()` 為 id-only filter；煙霧測試 87 OK / 0 FAIL | 量測（2026-09-21） | Planner wants safe row deletion | Verified |

---

## 🩺 批次 42（2026-09-21）— 排查「本地後端未啟動 — 請執行 scripts\start-backend.bat」

### 症狀
App 出現：`本地後端未啟動 — 請執行 scripts\start-backend.bat（或 set START_BACKEND=1 後跑 scripts\start-all.bat）`

### 診斷（逐項實測）
| 檢查 | 結果 |
|------|------|
| 訊息來源 | `src/lib/localApi.js` 的 `BACKEND_HINT`：`/local-api/...` 連不上時丟出（`ProjectBar.jsx` 用它顯示錯誤） |
| 這個後端是什麼 | 工作區根目錄的 FastAPI scaffold：`P6 Reader & Converter\backend\`（`main.py` 有 `GET /health`、`projects`/`versions` routers；DB `backend/db/pyworkflow.db`）。**只服務 ProjectBar 的「選擇專案／上傳／存檔」** |
| 前端如何連它 | `vite.config.js`：`/local-api` → `http://localhost:${BACKEND_PORT}`；`BACKEND_PORT` 讀自工作區根目錄 `.env` = **25156** |
| 當時狀態 | **port 25156 沒有在監聽** → 後端確實沒啟動（`Get-NetTCPConnection` 無結果）✓ 症狀成立 |
| 為何沒被啟動 | 根目錄 `scripts\start-all.bat` 說明：後端是 opt-in（`set START_BACKEND=1`）；App 自己的 `scripts\` 只有 `start-local.bat`（純前端）→ 只跑前端的啟動方式不會帶起後端 |

### 處理
| # | 內容 |
|---|------|
| 1 | 依專案規則用**根目錄腳本**啟動：`scripts\start-backend.bat`（讀 root `.env` 的 `BACKEND_PORT` → `uv sync` → `uv run uvicorn main:app --port 25156`） |
| 2 | 因為是前景服務，這裡以背景方式啟動（隱藏視窗、log 寫到 `%TEMP%\p6-backend.log`）；平常請在自己的 cmd 視窗執行該腳本 |
| 3 | 訊息文字更清楚：註明要在**工作區根目錄**執行，並說明此後端只用於「選擇專案／存檔」 |

### 驗收（實測）
```
Uvicorn: "Application startup complete" / "Uvicorn running on http://0.0.0.0:25156"（pid 28220）
port 25156 listening  = True
GET  http://localhost:25156/health              -> 200 {"status":"ok"}
GET  http://localhost:15156/local-api/projects  -> 200 []        ← App 實際走的代理路徑（修好）
ESLint(src/lib/localApi.js) = 0 error；煙霧測試對 BACKEND_HINT/localApi 的引用數 = 0（字串變更不影響測試）
```

### 日常操作
- 啟動後端（cmd.exe，工作區根目錄）：`scripts\start-backend.bat`
- 或一次帶起前後端：`set START_BACKEND=1 && scripts\start-all.bat`（後端失敗只算警告，見該腳本說明）
- 檢查狀態：`scripts\status.bat`；全部停止：`scripts\stop-all.bat`
- 沒有後端時 App 仍可正常使用，只有 ProjectBar 的專案／版本功能會顯示上述提示

**RTM（批次 42）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4201 | 「本地後端未啟動」提示須明確指出應在工作區根目錄執行 `scripts\start-backend.bat`，並說明其用途 | `src/lib/localApi.js` `BACKEND_HINT` | Planner wants actionable error messages | Fixed |
| NFR-4201 | 後端未啟動時 App 其餘功能不受影響（僅 ProjectBar 專案／版本功能提示） | Vite proxy + ProjectBar | Planner wants a resilient app | Verified |
| AC-4201 | 後端啟動後 `GET /health` 200、經代理的 `/local-api/projects` 200；port 25156 監聽中 | 量測（2026-09-21） | Planner wants a working local backend | Verified |

---

## 📋 批次 43（2026-09-21）— 全面功能現況檢查（環境／測試／功能盤點）

### 一、環境與服務
| 項目 | 結果 | 證據 |
|------|------|------|
| 前端（Vite） | ✅ 運行中 | port **15156** 監聽中；`GET /` → 200 |
| 本地後端（FastAPI） | ✅ 運行中 | port **25156** 監聽中；`GET /health` → `{"status":"ok"}`；經 Vite 代理 `GET /local-api/projects` → 200 |
| 後端 CRUD 實測 | ✅ 專案建立／版本存檔／列出／刪除全部成功 | `POST /projects` → id；`POST /projects/{id}/versions` → `task_count:1`；`GET .../versions` → 1 筆；`DELETE` → 200；**測試資料已全部刪除，`GET /projects` 回到 `[]`** |
| 資料庫 | ✅ | `backend/db/pyworkflow.db`（原本 0 個專案，檢查後仍為 0） |
| ESLint（全專案 `eslint . --quiet`） | ✅ | exit 0、0 問題 |
| 煙霧測試 | ✅ | **87 OK / 0 FAIL**（218 行輸出） |

### 二、功能盤點（全部有測試或實測覆蓋）
| 領域 | 覆蓋內容 | 狀態 |
|------|----------|------|
| **匯入** | XER（WBS 層級、空 WBS 標記、關係 TASKPRED）、Excel（P6 樣式）、P6 XML（links[]／succCode fallback）、PDF 文字分批（24k 截斷已移除）、掃描 PDF + AI vision（18 欄 schema、頁碼 1..N、2800px 渲染、低列數重試）、**本機 OCR**（ppocr／ollama／pstocr 引擎註冊、launcher、UI 自動啟動）、textChunks 分批與合併 | ✅ |
| **PDF 內嵌資料往返** | 4 筆／600 筆多 chunk（15 頁）／legacy V2 → 匯出再上傳欄位完全一致（免 AI 還原） | ✅ |
| **甘特圖** | WBS 列配色（classic／cool-blues／per-level／override／clamp）、收合、focus 模式、長條外觀（preset／critical／delay／milestone）、Bar text（inside／before／after、字體／字級／內外色）、Bar Info 3 開關、**不再截斷**（量測式排版）、拆分日期（start 前／finish 後）、階梯線、對比條、對比箭頭、關係箭頭 | ✅ |
| **列印／匯出** | Print Preview 面板（8 個列印選項）、頁面設定（A3/A4、方向、邊界、頁尾 `{page}/{pages}`）、PDF、Excel（P6 樣式）、XER、P6 XML、關係 XML | ✅ |
| **編輯操作** | 選取（click／Ctrl+Click／Ctrl+Shift 範圍）、BulkEditBar（套色／綁鏈／解除／刪除／Staircase filter）、Undo/Redo（Ctrl+Z／Ctrl+Y）、右鍵選單（新增列／WBS 7 級／縮排凸排／改色／Comparison 標記／刪除）、每列刪除鍵（含 programme；單點只刪該列不串聯）、快照、比較／合併 | ✅ |
| **篩選與檢視** | Quick filters（status／started／milestones／critical）、badge 數學、Last Recalc Date 綁定、8 個篩選範本、FilterDialog、欄位顯示／View Presets、日期格式／格線／時間刻度 | ✅ |
| **設定面板** | GlobalSettingsPanel（5 分類 + 可拖曳 + Local OCR）、Display 開關（Holiday／Staircase／Relationship／**Comparison Arrows**（批次 37 改名）／Diff Only／Relation Filter）、WbsSettingsPanel、GanttSettingsPanel、GanttInfoPanel（7 分頁） | ✅ |
| **專案管理** | ProjectBar（本地專案／版本：選擇、建立、存檔、讀取、刪除）＋ 後端提示訊息（批次 42） | ✅ |

### 三、本次檢查發現（未動，供決策）
| # | 發現 | 建議 |
|---|------|------|
| 1 | `dist/` 建置產物**已過期**（`index-CVzS5iRF.js`，2026-09-21 13:59，仍含舊的 `BACKEND_HINT` 字串） | 若要部署或以 `dist` 預覽，需重新 `vite build` |
| 2 | **死碼**：`src/components/gantt/TaskTable.jsx`、`GanttChart.jsx` 被引用 0 次 | 可刪除（或保留作參考） |
| 3 | 工作區所有批次（23–42）**尚未 commit**；`main` 與 `origin/main` 在 `59dbdc1`，無未推送 commit | 需 commit + push 才會上 GitHub |
| 4 | 煙霧測試輸出中的 pdfjs `standardFontDataUrl` 警告 | Node 環境正常現象，不影響結果 |
| 5 | 收合的 section 在列印時仍全部印出（批次 38 已列為刻意差異） | 如要 100% WYSIWYG 需把 `collapsedIds` 傳進 PDF |

**RTM（批次 43）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| NFR-4301 | 交付前須有可重複的全功能健康檢查（環境 + 測試 + lint + API 實測） | scripts/smoke-test.mjs / ESLint / backend API | Planner wants confidence before shipping | Verified |
| AC-4301 | 前端 200、後端 /health 200、`/local-api/projects` 200、ESLint 0 問題、煙霧測試 87 OK / 0 FAIL、後端 CRUD 四項操作全通且無殘留資料 | 量測（2026-09-21） | Planner wants confidence before shipping | Verified |

---

## 🌴 批次 44（2026-09-21）— Holiday Markers 預設關閉 ＋ 與 Today Line 拆成獨立開關

### 使用者要求
「Holiday Markers 默認為關閉」

### 修正前的狀況（兩個問題）
1. **畫面預設是開的**：`GanttPage.jsx` 的 `const [showToday, setShowToday] = useState(true)`。
2. **假日標記與今日線綁在一起**：`UnifiedGanttLayout.jsx` 有 `const showHolidays = showToday;`
   （註解也寫「Holiday markers are shown together with Today line」），而 Display 面板那顆開關標示為
   「Holiday Markers」卻同時控制今日線 → 想關掉假日標記就會**順便關掉今日線**。
   （列印端的兩個選項 `showHolidays` / `showToday` 本來就是分開且預設關閉 ✓）

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 新增獨立的 `showHolidays` 狀態，**預設 `false`** | `GanttPage.jsx` |
| 2 | Display 面板拆成兩顆開關：**Holiday Markers**（`showHolidays`，預設關）＋ **Today Line**（`showToday`，維持預設開），各自附 tooltip | `GanttPage.jsx` |
| 3 | Layout 收下 `showHolidays` prop（預設 `false`），移除 `showHolidays = showToday` 的耦合 | `UnifiedGanttLayout.jsx` |
| 4 | 煙霧測試新增整項「Holiday Markers (chart) default OFF + separate from the Today line」 | `scripts/smoke-test.mjs` |

### 驗收（實測）
```
SSR（fixture 2026-09-01..2026-10-20，含 10-01 國慶）
  showHolidays 未指定（預設）→ 假日色帶 0 個 ✓（預設關閉）
  showHolidays: true        → 假日色帶 3 個 ✓（可正常開啟）
  showHolidays: false 時今日線仍會繪製 ✓（已解耦）
原始碼：GanttPage `useState(false)` ✓；Display 面板 `on: showHolidays` 與 `on: showToday` 分開 ✓；
        layout 收到 `showHolidays={showHolidays}` ✓
煙霧測試 88 OK / 0 FAIL；ESLint 0 error；Vite 轉譯 200
列印端維持原本的預設關閉（`showHolidays` / `showToday` 皆 false，批次 26 測試仍通過）
```

**RTM（批次 44）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4401 | 畫面假日標記（Holiday Markers）預設必須為關閉 | GanttPage `showHolidays` 狀態 | Planner wants a clean default chart | Fixed |
| FR-4402 | 假日標記與今日線須為兩個獨立開關（關假日不得影響今日線） | GanttPage Display 面板 + UnifiedGanttLayout prop | Planner wants independent display switches | Fixed |
| AC-4401 | 預設 0 個假日色帶、開啟時 3 個；假日關閉時今日線仍在；煙霧測試 88 OK / 0 FAIL | 量測（2026-09-21） | Planner wants a clean default chart | Verified |

---

## 🈶 批次 45（2026-09-21）— 嵌入 CJK 字型：中文列印成真正的文字（不再是 `????`）

### 使用者要求
「先做 b」——嵌入 CJK 字型，讓 PDF 中文正常顯示（原本是 `????`）。

### 技術驗證（先做實驗才實作）
| 問題 | 實驗結果 |
|------|----------|
| jsPDF 會不會 subset？ | **會** ✓ 嵌入 11.4 MB 中文字型、畫兩行中文 → PDF 只有 **275 KB** |
| 文字層能取回中文嗎？ | **能** ✓ `pypdfium2` 取回 `'樁基工程 Piling 2026-09-01\r\n鋼筋混凝土樓板 Slab'`（可選取、可搜尋的真文字） |
| 字型授權？ | **SIL OFL 1.1** ✓ 字型 name table：`Copyright 2014-2021 Adobe …, with Reserved Font Name 'Source'`（＝ Noto Sans HK／Source Han Sans），與 `public/fonts/OFL.txt` 全文一致 → 可隨專案散布並嵌入 PDF |
| 為何不用 OTF/TTC？ | jsPDF 需要 `glyf` 輪廓的單一 **TrueType (.ttf)**；OTF/CFF 與 `.ttc` 集合都不支援 |

### 實作
| # | 內容 | 位置 |
|---|------|------|
| 1 | 字型資產：`public/fonts/NotoSansHK-VF.ttf`（11.36 MB，Noto Sans HK）、`OFL.txt`（授權全文）、`README.md`（來源／授權／如何更換） | `public/fonts/` |
| 2 | 新模組 `cjkFont.js`：`hasNonLatinText()`、`programmeNeedsCjk()`（含標題／公司／頁尾）、`loadCjkFont()`（HTTP 取得 → 分塊 base64 → 記憶體快取）、`cjkFontBase64()`、`CJK_FONT_URL/NAME/LABEL` | `src/lib/cjkFont.js` |
| 3 | PDF builder 新增 `cjkFont: { name, base64 }`：`addFileToVFS` + `addFont`，並**攔截 `doc.setFont`** 把 `helvetica/courier/times` 一律導向 CJK 字型（單一字重，粗體／斜體正規化），同時 `sanitizePDFText()` 在啟用時**保留** Unicode（不再換成 `?`），build 結束後清除模組旗標 | `src/lib/exportGanttPDF.js` |
| 4 | Print Preview 新增「**Chinese / CJK text**」開關（預設 ON）：**只在程式含非 Latin-1 文字時**才抓字型（拉丁文專案完全不抓 11 MB）；顯示狀態（ready／loading／error） | `PdfPreviewDialog.jsx` |
| 5 | ExportDialog：`embedCjkFont` 列印選項、`needsCjk` memo、載入 effect、字型到達時**自動重建已開啟的預覽**（避免第一次看到 `?`）、`handleCjkFontChange` | `ExportDialog.jsx` |
| 6 | 煙霧測試新增整項「PDF · Chinese text (embedded CJK font, subsetted)」 | `scripts/smoke-test.mjs` |

### 驗收（實測）
```
煙霧測試 89 OK / 0 FAIL；ESLint 0 error

PDF 文字層（fixture：樁基工程／鋼筋混凝土樓板 Slab／竣工里程碑／啟德發展計劃）
  有字型：文字層包含全部中文字串 ✓；PDF 288 KB
  無字型：中文字串不存在、仍為 "?" ✓（向後相容，未勾選時行為不變）
  字型 subset 保護：< 2 MB（避免哪天變成整份 11 MB）
  資產：public/fonts/NotoSansHK-VF.ttf（> 5 MB）＋ OFL.txt 含 "SIL Open Font License, Version 1.1" ✓

模擬瀏覽器完整流程（從 dev server 抓字型 → build → 抽文字層）
  GET /fonts/NotoSansHK-VF.ttf → 200，11.36 MB ✓
  PDF 292 KB ✓
  programmeNeedsCjk(中文專案) = true；hasNonLatinText("Excavate") = false ✓（拉丁文專案不會下載字型）
  文字層包含 試樁及樁帽施工／鋼筋混凝土樓板／啟德發展計劃／範例工程有限公司 ✓（四項全中）

目視（算圖）
  有字型：範例工程有限公司／啟德發展計劃 - 第三期／樁基工程 (Piling Works)／試樁及樁帽施工 正常顯示 ✓
  無字型：??????? （原本行為）
```

### 已知限制（誠實說明）
1. 字型為**單一字重** → PDF 的粗體／斜體會被正規化（jsPDF 無法用嵌入字型合成粗體）；純拉丁文且未啟用時不受影響。
2. 首次使用需下載 11 MB（Vite dev／部署主機皆為靜態資產 ✓ 之後由瀏覽器快取）。
3. **非 BMP 罕見字**（CJK 擴充 B 區以後、emoji）可能缺字；常用繁簡中文、HK 變體字形完整。
4. 字型檔案會進 git（11.36 MB）；`.gitignore` 不會排除 `public/` ✓（已用 `git check-ignore` 確認）。

**RTM（批次 45）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4501 | PDF 中的中文（活動名稱、專案標題、公司、頁尾）必須列印成真正的文字而非 `????` | exportGanttPDF（嵌入 CJK 字型） | Planner wants Chinese programmes to print correctly | Fixed |
| FR-4502 | CJK 字型只在程式含非 Latin-1 文字且選項開啟時才載入（拉丁文專案不受影響、不增加 PDF 大小） | cjkFont.js `programmeNeedsCjk` + ExportDialog | Planner wants no wasted work | Fixed |
| FR-4503 | Print Preview 須提供「Chinese / CJK text」開關與載入狀態（ready／loading／error） | PdfPreviewDialog | Planner wants to see what happens | Fixed |
| NFR-4501 | 嵌入字型必須被 subset（PDF 不得膨脹為 11 MB）；未啟用時輸出行為與舊版相同 | exportGanttPDF / smoke test guard | Planner wants small files | Verified |
| NFR-4502 | 字型須為可再散布授權並附授權全文（SIL OFL 1.1） | public/fonts（字型 + OFL.txt + README） | Legal/compliance | Verified |
| AC-4501 | 文字層可取回中文字串；288 KB（有字型）vs 11 KB（無）；HTTP 200 取得 11.36 MB；89 OK / 0 FAIL | 量測（2026-09-21） | Planner wants Chinese programmes to print correctly | Verified |

---

## 📦 Batch 46 — start-all 一次啟動全部服務（前端＋後端＋OCR 插件）

### 使用者需求（2026-09-21）
> 「當我啓動 `scripts\start-all.bat` 時就應該將所有相關前後端以及插件全部啓動了。」

### User Story
As an **operator**, I want **`scripts\start-all.bat` to bring up the frontend, the local backend and the local OCR plugin in one command**, so that **I never have to remember which of the five services is still missing**.

### Requirements
- **Functional**
  - FR-4601：`start-all.bat/.sh` 預設啟動**三群**服務：①前端（Vite，`FRONTEND_PORT`）②本地 FastAPI 後端（`BACKEND_PORT`）③OCR 插件＝PP-OCR helper（`:8199`）＋它可帶起的引擎（`pstocr :7861`、`ollama :11434`）。
  - FR-4602：OCR helper 未啟動時，`.bat` 以 `OCR_HELPER_BAT`（預設 `C:\dev\paddle-ocr\run-ocr-server.bat`）帶起；`.sh` 用 `OCR_HELPER_CMD`（未設定則只提示）。
  - FR-4603：helper 起來後對 `/launch/start`（`{"id":"pstocr"}`、`{"id":"ollama"}`）各發一次請求（idempotent；已在跑的引擎回 `alreadyRunning`）。
  - FR-4604：`status.bat/.sh` 增加「Local OCR plugin」段：helper 是否在跑、兩個引擎各自 running／stopped。
  - FR-4605：`stop-all.bat/.sh` 預設**不動** OCR（可能與其他工具共用）；`STOP_OCR=1` 才對 `/launch/stop` 發請求。
- **Non-Functional**
  - NFR-4601：`.env` 仍為**唯一**埠來源（`FRONTEND_PORT`／`BACKEND_PORT`）且**未修改**；OCR 端點預設值與 `src/lib/localOcr.js` 一致，可用選配鍵 `OCR_LAUNCHER_URL`／`OCR_HELPER_BAT` 覆寫。
  - NFR-4602：後端／OCR 失敗只 **WARNING**，不阻斷（前端失敗才 exit 1）。
  - NFR-4603：可退出：`SKIP_BACKEND=1`、`SKIP_OCR=1`（`START_BACKEND=1` 保留但已無作用＝預設）。
  - NFR-4604：`start-all` 保持 idempotent（重跑時「已在跑 → 跳過」）。
- **Constraints**
  - 只動 `scripts/**`；`.env`、`devops/**`、`src/**` 不改。
  - `.bat` 保持 ASCII 訊息＋CRLF；`.sh` 同步相同行為。

### 實作
| 檔案 | 變更 |
|---|---|
| `scripts/start-all.bat` | 後端改為**預設啟動**（`SKIP_BACKEND=1` 才略過）；新增 OCR 段（helper → 等就緒 → 對兩引擎發 `/launch/start`）；彙總列出 App／Backend／OCR plugin 三段狀態 |
| `scripts/start-all.sh` | 同步（OCR helper 以 `OCR_HELPER_CMD` 選配啟動） |
| `scripts/status.bat`、`status.sh` | 新增 OCR 段 + `:ocr_engine`（解析 `/launch/services` 的 `"running": true`） |
| `scripts/stop-all.bat`、`stop-all.sh` | 新增 `STOP_OCR=1`（`/launch/stop`），預設不動 OCR |
| 四支 `.bat` | `ROOT_DIR` 以 `for %%I in ("%~dp0..") do set "ROOT_DIR=%%~fI"` 正規化（輸出不再出現 `\scripts\..`） |

### 驗證（2026-09-21）
```
scripts\stop-all.bat   → 15156 / 25156 killed；8199 / 7861 / 11434 保留（自訂 STOP_OCR=1 才停）
scripts\start-all.bat  → Frontend is ready / Backend is ready
                         OCR helper already running (http://127.0.0.1:8199)
                         OCR engine pstocr: start requested / ollama: start requested
                         彙總 App + Backend running + OCR plugin running，exit 0
再跑一次 start-all      → Frontend / Backend already running - skipping start（idempotent，exit 0）
scripts\status.bat      → port 15156 / 25156 正確讀取；OCR helper RUNNING + pstocr / ollama running
```

### 踩到並修掉的坑
- **cmd `if` 引號不對稱**：`if /i "%%A"==FRONTEND_PORT` 永遠不成立（左側有引號、右側沒有）→ 整個 `.env` 讀取失效、埠印成空白。`.bat` 一律寫成 `if /i "%%A"=="FRONTEND_PORT"`。
- `.bat` 內 `echo` 段若含 `%ROOT_DIR%`（路徑帶 `&`）必須**加引號**（`"..."`），否則 `&` 會被 cmd 當成命令分隔。
- 既有 `.bat`／本文件是 CRLF：用 LF 樣式做比對會失敗 → 追加改用行號（append at EOF）或單行錨點。

**RTM（批次 46）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4601 | start-all 預設啟動前端＋後端＋OCR 插件三群 | `scripts/start-all.bat` + `.sh` | Operator wants everything up in one command | Verified |
| FR-4602 | OCR helper 可用 OCR_HELPER_BAT／OCR_HELPER_CMD 帶起 | start-all | Operator wants no manual helper start | Verified |
| FR-4603 | 對 launcher 發 /launch/start 帶起 pstocr + ollama（idempotent） | start-all / PP-OCR launcher | Operator wants OCR engines ready | Verified |
| FR-4604 | status 顯示 OCR helper 與各引擎狀態 | `scripts/status.bat` + `.sh` | Operator wants to see what is missing | Verified |
| FR-4605 | stop-all 預設不動 OCR，STOP_OCR=1 才停 | `scripts/stop-all.bat` + `.sh` | Operator wants OCR shared with other tools | Verified |
| NFR-4601 | .env 仍是唯一埠來源且未被修改；OCR 端點可選配覆寫 | 四支腳本 | Port conflict rule | Verified |
| NFR-4602 | 後端／OCR 失敗只 WARNING，前端失敗才 exit 1 | start-all | Operator wants a reliable launcher | Verified |
| NFR-4603 | SKIP_BACKEND / SKIP_OCR 可退出 | start-all | Operator wants control | Verified |
| NFR-4604 | start-all idempotent（重跑不重啟已在跑的服務） | start-all | Operator wants safe re-runs | Verified |
| AC-4601 | 實測 stop→start：15156/25156 皆起來、8199/7861/11434 保持、exit 0 | 手測 2026-09-21 | Operator wants everything started | Verified |

---

## 📦 Batch 47 — 點選活動即高亮其 Relationship Lines（臨時顯示效果）

### 使用者需求（2026-09-22）
> 「Relationship Lines 在點選後，如果點擊某一活動項，該活動項所關聯的 Relationship Lines 應該特別高亮起來，淡化其他無關活動項的 Relationship Lines，該設定為臨時顯示效果。」

### User Story
As a **planner**, I want **clicking an activity to emphasise only the relationship lines that touch it**, so that **I can trace one activity's logic at a glance instead of untangling every link on the chart**.

### Requirements
- **Functional**
  - FR-4701：點選活動列後，**與該活動相關**（作為 predecessor 或 successor）的關係線（FS/SS/FF/SF）全不透明繪製並加粗（線寬 1.2 → 2.2），箭頭與類型標籤同時提亮。
  - FR-4702：同時**其他無關**關係線淡化（線 12%／箭頭 15%／標籤 15% 不透明度）。
  - FR-4703：Ctrl／Cmd 多選採**聯集**——任一被選活動涉及的線皆高亮，其餘淡化。
  - FR-4704：**未選取**任何活動，或只選到 WBS 分段列時，維持原繪製（線／箭頭 60%、標籤 65%），不淡化任何線。
  - FR-4705：**臨時效果**——完全由 `selectedIds` 推導，清除選取即恢復（Other ▸ Clear selection）；不寫入 `displaySettings`／localStorage，也不影響列印／PDF 輸出。
- **Non-Functional**
  - NFR-4701：顏色沿用既有 `REL_COLORS`（`#005a53` FS／`#003531` SS／`#733208` FF／`#e88219` SF），僅調整不透明度與線寬 → 符合 Common Look and Feel（light-only）。
  - NFR-4702：不改變關係線的**幾何路徑**（折線轉角、箭頭位置）與資料來源（`task.links` / `task.link`）。
- **Constraints**：只改 `UnifiedGanttLayout.jsx` 的關係線繪製區塊；不新增 React 狀態、不新增設定項、不動 print/PDF。

### 實作
| 檔案 | 變更 |
|---|---|
| `src/components/gantt/UnifiedGanttLayout.jsx` | 關係線區塊新增 `focusIds`（選取 ∩ 有 bar 的活動，自動排除分段列）與 `relState`（`focus`／`dim`／`normal`）；`<g>` 加上 `data-rel-key` 與 `data-rel-state`（供回歸測試與除錯）；線／箭頭／標籤依狀態採 1（focus）、0.12–0.15（dim）、0.6–0.65（normal）不透明度 |
| `scripts/smoke-test.mjs` | 新增批次 47 回歸測試（4 個活動 + 3 條 FS/SS/FF 連結 + 1 個 WBS 分段） |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：先加測試 → `Gantt relationship-line focus (batch 47): FAILED (lines=0, none f0/d0, section f0/d0, t2 f0/d0, t3 f0/d0, t2+t4 f0/d0)` ✓（功能未實作）
2. **GREEN**：實作後 → `OK (3 links; clicking an activity focuses the lines that touch it and dims the rest; sections / no selection leave it unchanged)`；整體 **90 OK / 0 FAIL**（89 + 新增 1）、`eslint` exit 0
3. 建置：`node node_modules/vite/bin/vite.js build` exit 0；dev server `/src/components/gantt/UnifiedGanttLayout.jsx`、`/src/pages/GanttPage.jsx`、`/` 皆 HTTP 200
4. 測試涵蓋：未選取不變、只選分段列不淡化、選中間活動（2 亮 1 暗）、選另一活動（2 亮 1 暗）、多選聯集（3 亮 0 暗）

**RTM（批次 47）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4701 | 點選活動 → 相關關係線全亮並加粗（含箭頭與標籤） | UnifiedGanttLayout 關係線區塊 | Planner wants to trace one activity's logic | Verified |
| FR-4702 | 無關關係線淡化（12%／15%／15%） | UnifiedGanttLayout 關係線區塊 | Planner wants the rest to recede | Verified |
| FR-4703 | 多選時採聯集高亮 | UnifiedGanttLayout（`focusIds`） | Planner wants several activities at once | Verified |
| FR-4704 | 未選取／只選分段列 → 完全不變（60%／65%） | UnifiedGanttLayout（`relState="normal"`） | Planner wants no surprise dimming | Verified |
| FR-4705 | 臨時效果：由 selectedIds 推導、清除即恢復、不持久化、不影響列印 | UnifiedGanttLayout（無新 state） | Planner wants a temporary aid | Verified |
| NFR-4701 | 顏色沿用 REL_COLORS，僅改不透明度／線寬（light-only 合規） | UnifiedGanttLayout | Common Look and Feel | Verified |
| NFR-4702 | 幾何路徑與資料來源不變 | UnifiedGanttLayout | No regression risk | Verified |
| AC-4701 | smoke test 90 OK / 0 FAIL、eslint 0、vite build 0、模組 200 | 量測（2026-09-22） | Planner wants a safe change | Verified |

---

## 📦 Batch 48 — 全新獨立頁面：P6 Data Explorer（原始數據表瀏覽，參考 xerviewer.org）

### 使用者需求（2026-09-22）
> 「參考 https://www.xerviewer.org/ 增加一整個數據解析展示的頁面，製作一片**新的獨立頁面**顯示：左側 Tables 側欄（分類摺疊清單）＋右上表名／篩選／Export to Excel＋內容卡片（General／Dates／Settings／Defaults／Calculations／Other）＋頁尾 Displaying N properties…／Current File…／Total Displayable Tables…」

### User Story
As a **planner / data reviewer**, I want **a dedicated page that lists every raw table of my P6 file and shows the records inside them**, so that **I can inspect data the Gantt view never shows (codes, resources, financial, UDF …) without leaving the app**.

### Requirements
- **Functional**
  - FR-4801：獨立頁面 `/data-explorer`（P6 Data Explorer），可由 Gantt 工具列 **Tools ▸ Data Explorer** 進入，頁內有 **Back to Gantt** 返回。
  - FR-4802：載入 **XER**（用既有 `parseXerTables()` 取出檔案內**每一張** `%T` 表）或 **P6 XML**（以元素標籤分組、屬性為欄位）；支援點選與**拖放**，可 Clear 重載；檔案只在瀏覽器內處理、不上傳。
  - FR-4803：左側 **Tables** 側欄依 7 分類呈現（Project Structure／Resources／Codes／Financial／Documents／User Defined／Other），每組可摺疊、顯示各表筆數，並有**表名搜尋**；側欄可整組收合／展開。
  - FR-4804：主區依表性質自動選檢視：**單筆 → 屬性卡片**（General／Dates／Settings／Defaults／Calculations／Other）；**多筆 → 資料表格**（表頭固定、zebra 列、欄位顯示可讀標籤）。
  - FR-4805：主區上方有**欄位／屬性篩選**（同時比對原始欄名與可讀標籤）＋ **Export to Excel**（`xlsx`，匯出目前表、欄位保留原始欄名）。
  - FR-4806：頁尾顯示 **Displaying N properties/columns for table 'X'**、**Current File**、**Total Displayable Tables**。
  - FR-4807：空值（`""`／`null`）一律顯示 **N/A**（斜體淡化）；≥500 筆的表先渲染前 500 列並註明。
- **Non-Functional**
  - NFR-4801：純前端、**零上傳**；沿用既有 parser，不在解析器內新增邏輯。
  - NFR-4802：**Common Look and Feel（light-only）**——只用專案 palette token（`surface*`／`text*`／`border`／`primary`／`table-header`／`accent-selected`／`danger`／`focus`），**不得**沿用參考站的 slate/blue，也不得出現 `dark:`／`prefers-color-scheme`（由 smoke test palette guard 強制）。
  - NFR-4803：不影響既有 Gantt 頁與列印／PDF 輸出（只新增路由與一個連結）。
- **Constraints**：資料層全部放 `src/lib/dataExplorer.js`（純函式、可直接斷言）；UI 為 presentational `TableBrowser`（可 SSR 測試）。

### 實作
| 檔案 | 內容 |
|---|---|
| `src/lib/dataExplorer.js`（新） | `categoriseTable`／`buildTableIndex`／`groupTableIndex`／`filterTableIndex`／`columnKeys`／`formatCell`／`fieldLabel`（＋`FIELD_LABELS`）／`propertyGroupsFor`（＋`PROPERTY_GROUPS`）／`visibleRows`／`tablesFromXml` |
| `src/components/dataexplorer/TableBrowser.jsx`（新） | 側欄（分類／摺疊／搜尋／收合）＋主區（卡片或表格）＋頁尾統計；`data-*` 供測試（`data-category`／`data-table-name`／`data-active-table`／`data-view`／`data-row-count`／`data-table-count`） |
| `src/pages/DataExplorerPage.jsx`（新） | 檔案選擇／拖放、依副檔名解析（`.xer`／`.xml`）、錯誤與讀取狀態、Excel 匯出、Back to Gantt |
| `src/App.jsx` | 新增 `DataExplorerPage` import 與 `<Route path="/data-explorer" …>` |
| `src/pages/GanttPage.jsx` | Tools 下拉新增 **Data Explorer** 連結（`Link to="/data-explorer"`） |
| `scripts/smoke-test.mjs` | 批次 48 三段回歸測試（helpers／render／wiring＋palette guard） |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：先寫測試 → `Data Explorer (batch 48): FAILED: Error: Failed to load url /src/lib/dataExplorer.js … Does the file exist?` ✓
2. **GREEN**：實作後 → 三段全綠，總計 **93 OK / 0 FAIL**（90 + 新增 3）、`eslint` exit 0、`vite build` exit 0
3. 模組健康：`/data-explorer`、`/src/pages/DataExplorerPage.jsx`、`/src/components/dataexplorer/TableBrowser.jsx`、`/src/lib/dataExplorer.js` 全部 HTTP 200
4. **真實 XER 語法端對端**：以合成 `%T/%F/%R` 檔餵既有 `parseXerTables()` → `PROJECT(1), RSRC(1), TASK(2), TASKPRED(1)`；側欄 `Project Structure=3, Resources=1`；PROJECT 卡片 `general[2] dates[2] defaults[1] other[1]`；`proj_id=HOSPEXP`、空值 → `N/A` ✓

**RTM（批次 48）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4801 | 獨立頁面 /data-explorer ＋ Gantt Tools 入口 ＋ 返回連結 | `src/pages/DataExplorerPage.jsx`、`App.jsx`、`GanttPage.jsx` | Reviewer wants a dedicated data page | Verified |
| FR-4802 | 載入 XER（全表）／P6 XML；支援拖放與 Clear；零上傳 | DataExplorerPage ＋ `parseXerTables`／`tablesFromXml` | Reviewer wants to open any programme | Verified |
| FR-4803 | 7 分類側欄、可摺疊、筆數、表名搜尋、可收合 | `TableBrowser`＋`groupTableIndex`／`filterTableIndex` | Reviewer wants to find a table fast | Verified |
| FR-4804 | 單筆 → 屬性卡片（6 分組）；多筆 → 資料表格 | `TableBrowser`＋`propertyGroupsFor` | Reviewer wants readable records | Verified |
| FR-4805 | 欄位／屬性篩選 ＋ Export to Excel（目前表） | `TableBrowser`＋`xlsx` | Reviewer wants to export/apart | Verified |
| FR-4806 | 頁尾統計（properties／Current File／Total Displayable Tables） | `TableBrowser` footer | Reviewer wants context | Verified |
| FR-4807 | 空值顯示 N/A；≥500 列先截斷並註明 | `formatCell`／`visibleRows` | Reviewer wants honest values | Verified |
| NFR-4801 | 純前端零上傳、沿用既有 parser | DataExplorerPage | Privacy | Verified |
| NFR-4802 | 只用 palette token、light-only、無 slate/blue 或 dark: | `TableBrowser`／DataExplorerPage（smoke palette guard） | Common Look and Feel | Verified |
| NFR-4803 | 不影響既有 Gantt 與列印／PDF | 只新增路由＋連結 | No regression | Verified |
| AC-4801 | smoke 93 OK / 0 FAIL、eslint 0、build 0、模組 200、真實 XER 端對端 | 量測（2026-09-22） | Reviewer wants a safe new page | Verified |

---

## 📦 Batch 49 — 兩頁共用同一個 Programme（Gantt ⇄ P6 Data Explorer 同步）

### 使用者需求（2026-09-22）
> 「如果我在 Gantt 那邊已經上傳過了 XER 文件，那麽也應該同步到 P6 Data Explorer 裏，并且資料與選擇專案同步，兩邊的數據與資料都應該同步。」

### User Story
As a **planner**, I want **the Gantt page and the Data Explorer to share the same loaded programme and the same selected project**, so that **I never upload the same XER twice or wonder which file each page is showing**.

### Requirements
- **Functional**
  - FR-4901：新增共用狀態 `ProgrammeProvider`（包住兩個路由）：`{ fileName, format, tables, text, projectId, projectName, source, revision }`——兩頁的**單一真相來源**。
  - FR-4902：**Gantt → Explorer**：Gantt 載入 XER（上傳／`onImport`）或從 ProjectBar 載入專案／版本時，發佈 `tables`／`fileName`／`projectId`／`projectName`；Explorer 開啟即**直接顯示**（檔名、表格、專案）並標示來源徽章「**Loaded in the Gantt page**」。
  - FR-4903：**Explorer → Gantt**：Explorer 載入 `.xer` 時發佈 `text`＋`tables`；Gantt 監聽（`source==="explorer"` 且 `revision` 有變）後以既有流程重建（`parseXER` → `inferSectionLevels` → `resolveImportedLinks`）、更新 `xerSource`／標題、清空選取；解析失敗時**保留**目前畫面（try/catch）。
  - FR-4904：**防迴圈**：以 `revision` ＋ `source` 判斷，Gantt 自己發佈的變更不會再被自己消費。
  - FR-4905：**持久化**：localStorage 只存輕量資料（檔名／格式／專案／來源／revision）與 **≤ 2 MB** 的檔案文字；超過即整筆跳過（回傳 false）；已解析的 `tables` 只留記憶體。
  - FR-4906：Explorer 重新載入後若只有持久化的 `text`，會**自動重建** tables（`parseXerTables`／`tablesFromXml`）；Explorer 的 Clear 同時清除共用狀態。
- **Non-Functional**
  - NFR-4901：`useProgramme()` 在無 Provider 時回傳安全 no-op（smoke test 直接 render GanttPage 不會因缺 Provider 而失敗）。
  - NFR-4902：不得破壞既有 Gantt 行為（匯入、undo、Last Recalc Date、XER→XER 匯出皆維持）。
  - NFR-4903：不新增任何網路請求；XER／XML 仍只在瀏覽器內處理。
- **Constraints**：僅新增 `src/lib/programmeStore.jsx` 並在 App／GanttPage／DataExplorerPage 接線；不改解析器與後端。

### 實作
| 檔案 | 內容 |
|---|---|
| `src/lib/programmeStore.jsx`（新） | `ProgrammeProvider`／`useProgramme`／`emptyProgramme`／`readPersistedProgramme`／`writePersistedProgramme`（`PROGRAMME_STORAGE_KEY="p6_shared_programme"`、`MAX_PERSISTED_TEXT=2 MB`） |
| `src/App.jsx` | 以 `<ProgrammeProvider>` 包住路由 |
| `src/pages/GanttPage.jsx` | `useProgramme()` ＋ 3 個發佈點（`onSetProjectTitle`／`onImport`（有 `xerTables` 時）／`handleProjectLoaded`）＋ mirror effect（`mirroredRevision` 防迴圈） |
| `src/pages/DataExplorerPage.jsx` | 讀共用狀態（`viewTables = local \\|\\| shared`）、來源徽章 `data-shared-programme`、載入即發佈、Clear 同步清除、由 `text` 重建 tables |
| `scripts/smoke-test.mjs` | 批次 49 回歸測試（持久化契約／Explorer 渲染共用資料＋徽章／接線守門） |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：先寫測試 → `Shared programme store (batch 49): FAILED: Error: Failed to load url /src/lib/programmeStore.jsx … Does the file exist?` ✓
2. **GREEN**：實作後 → `OK (metadata persisted + restored, oversized payloads skipped, Explorer renders the Gantt-loaded file/project/tables with a provenance hint, both pages publish, routes wrapped)`；總計 **94 OK / 0 FAILED**（93 + 新增 1）、`eslint` exit 0、`vite build` exit 0
3. 模組健康：`/data-explorer`、`programmeStore.jsx`、`DataExplorerPage.jsx`、`GanttPage.jsx`、`App.jsx`、`/` 全部 HTTP 200

**RTM（批次 49）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-4901 | 共用狀態 Provider（兩頁單一真相來源） | `src/lib/programmeStore.jsx` ＋ `App.jsx` | Planner wants one programme for both pages | Verified |
| FR-4902 | Gantt 載入後 Explorer 直接顯示（含來源徽章） | GanttPage 3 個發佈點 ＋ DataExplorerPage | Planner wants no second upload | Verified |
| FR-4903 | Explorer 載入 XER 後 Gantt 同步重建 tasks | GanttPage mirror effect | Planner wants both sides in step | Verified |
| FR-4904 | revision ＋ source 防迴圈 | programmeStore／GanttPage | No feedback loops | Verified |
| FR-4905 | 只持久化輕量資料 ＋ ≤2 MB 文字 | `writePersistedProgramme` | Storage quota safety | Verified |
| FR-4906 | 由持久化 text 重建 tables；Clear 同步清除 | DataExplorerPage | Reload-friendly | Verified |
| NFR-4901 | 無 Provider 時安全 no-op | `useProgramme` | No regression in tests | Verified |
| NFR-4902 | 既有 Gantt 行為不變 | GanttPage | No regression | Verified |
| NFR-4903 | 零網路請求、純前端 | 全部 | Privacy | Verified |
| AC-4901 | smoke 94 OK / 0 FAILED、eslint 0、build 0、模組全 200 | 量測（2026-09-22） | Planner wants a safe sync | Verified |

---

## 📦 Batch 50 — Data Explorer 專案選擇器（與 Gantt 的「選擇專案」雙向同步）

### 使用者需求（2026-09-22）
> 「Explorer 也要能切換專案（加專案選擇器，雙向同步）」

### User Story
As a **planner**, I want **to switch the active project from the Data Explorer as well**, so that **both pages always work on the same stored project — whichever page I pick it in**.

### Requirements
- **Functional**
  - FR-5001：Explorer 標題列新增**專案選擇器**：列出本地後端專案（`localApi.listProjects`）、可手動刷新、顯示已選專案；後端未啟動時停用並顯示 `BACKEND_HINT`。
  - FR-5002：切換專案 → `localApi.getProject(id)` → 發佈 `{ projectId, projectName, fileName, format, tables: null, text: "" }`（`source:"explorer"`）——**清掉上一份檔案的共享表**，避免顯示舊資料。
  - FR-5003：後端版本只存已解析活動（`{ tasks, meta }`，無原始表）→ Explorer 以 `storedVersionTables()` 把該版本活動呈現為 **`TASK` 表**（欄位沿用 XER 欄名，可讀標籤與 TASK 分類照常生效）。
  - FR-5004：**Explorer → Gantt**：Gantt 開啟時若發現 `source:"explorer"` 且 `projectId` ≠ 目前專案 → `localApi.getProject` → 走 **ProjectBar 同一條載入路徑**（`handleProjectLoaded(project, latest_version.payload, null)`）→ 之後以 `source:"gantt"` 回寫（含 `projectId`），Explorer 的選擇器顯示同一個專案（**雙向**）。
  - FR-5005：**Gantt → Explorer**：ProjectBar 選專案（`handleProjectLoaded`）已會發佈 `projectId`／`projectName` → Explorer 選擇器 `value` 同步。
  - FR-5006：顯示檔名優先序：本頁載入的檔案 → 共享狀態的檔名 → 所選專案版本的 `meta.source_filename`。
- **Non-Functional**
  - NFR-5001：鏡射 effect 必須放在 `handleProjectLoaded` **之後**（依賴陣列求值時機），否則 TDZ crash——由 smoke test 的「GanttPage full page render」把關。
  - NFR-5002：後端不可用時只顯示提示、不影響本頁既有的檔案瀏覽；版本沒有 `latest_version` 時 `storedVersionTables` 回 `null`（保留畫面上既有表格）。
  - NFR-5003：選擇器只用 Common Look and Feel palette（由測試的 palette guard 把關）。
- **Constraints**：新增 `src/lib/projectOptions.js` 與 `src/components/dataexplorer/ProjectSelector.jsx`；不更動後端 API 與 ProjectBar。

### 實作
| 檔案 | 內容 |
|---|---|
| `src/lib/projectOptions.js`（新） | `projectOptions`（排序後的選項）、`findProjectById`、`versionSummary`（版本名／筆數／來源檔名／格式／recalc）、`storedVersionTables`（版本活動 → `TASK` 表） |
| `src/components/dataexplorer/ProjectSelector.jsx`（新） | 純呈現：`projects`／`value`／`onChange`／`loading`／`error`／`onRefresh`；`data-project-selector`／`data-project-id` 供測試 |
| `src/pages/DataExplorerPage.jsx` | 專案清單載入＋刷新、`handleProjectChange`（發佈＋顯示版本活動）、`viewTables = 本頁檔 → 共享 → 專案版本` |
| `src/pages/GanttPage.jsx` | mirror effect 新增「Explorer 選了專案」分支（`localApi.getProject` → `handleProjectLoaded`）；effect 移到 `handleProjectLoaded` 之後 |
| `scripts/smoke-test.mjs` | 批次 50 回歸測試（helpers／選擇器 render＋空狀態＋後端提示＋palette／雙頁接線守門） |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：先寫測試 → `Project selector + project sync (batch 50): FAILED: Error: Failed to load url /src/lib/projectOptions.js … Does the file exist?` ✓
2. 首次 GREEN 執行抓到**既有迴歸**：`GanttPage (full page render): FAILED: ReferenceError: Cannot access 'handleProjectLoaded' before initialization`（依賴陣列 TDZ）→ 把 effect 移到 `handleProjectLoaded` 之後 ✓
3. **GREEN**：`OK (projects listed + summarised, stored version rendered as a TASK table, selector renders/selects/empty-state/backend hint with palette tokens, both pages wired)`；總計 **95 OK / 0 FAILED**（94 + 新增 1）、`eslint` exit 0、`vite build` exit 0
4. 模組健康：`/data-explorer`、`projectOptions.js`、`ProjectSelector.jsx`、`DataExplorerPage.jsx`、`/` 全部 HTTP 200

**RTM（批次 50）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5001 | Explorer 專案選擇器（後端清單／刷新／後端未啟動提示） | `ProjectSelector` ＋ `localApi.listProjects` | Planner wants to switch project in both pages | Verified |
| FR-5002 | 切換即發佈並清空舊共享表 | DataExplorerPage `handleProjectChange` | No stale data | Verified |
| FR-5003 | 版本活動呈現為 TASK 表 | `storedVersionTables` | Browsable stored project | Verified |
| FR-5004 | Explorer → Gantt：載入同一專案（ProjectBar 路徑） | GanttPage mirror effect | Bidirectional sync | Verified |
| FR-5005 | Gantt → Explorer：選擇器同步 | `handleProjectLoaded` 發佈 | Bidirectional sync | Verified |
| FR-5006 | 檔名優先序（本頁檔 → 共享 → 版本 meta） | DataExplorerPage | Clear provenance | Verified |
| NFR-5001 | 鏡射 effect 位置（避免 TDZ） | GanttPage | No crash | Verified（smoke 曾抓到並修正） |
| NFR-5002 | 後端不可用／無版本時優雅降級 | ProjectSelector／storedVersionTables | Robustness | Verified |
| NFR-5003 | 選擇器 light-only palette | ProjectSelector（palette guard） | Common Look and Feel | Verified |
| AC-5001 | smoke 95 OK / 0 FAILED、eslint 0、build 0、模組全 200 | 量測（2026-09-22） | Safe project switching | Verified |

---

## 📦 Batch 51 — 修正：在 Gantt 選了「儲存的專案」後，Data Explorer 沒有資料

### 使用者回報（2026-09-22）
> 「我選擇了儲存的『選擇專案』后，進入『Data Explorer』後依然沒有資料顯示。」

### 根因（Root cause）
- Gantt 的 `handleProjectLoaded()` 發佈共用 programme 時，對**後端專案**而言 `xerTables` 是 `null`（後端版本只存 `{ tasks, meta }`，**沒有原始表**）→ 共用狀態只有 `projectId`／`projectName`，**沒有 `tables`**。
- Explorer 的顯示來源是 `tables → 共享 tables → 專案版本`；當共享 tables 與 text 都是空的時候，畫面只剩空狀態（拖放區），**沒有任何資料** → 使用者看到「沒有資料」。
- 附帶問題：專案發佈時沒有清掉上一個檔案遺留的 `text`／重建結果，可能顯示**過期**表格。

### 修正
| 檔案 | 變更 |
|---|---|
| `src/pages/DataExplorerPage.jsx` | 新增 **adopt effect**（`adoptedProjectRef` 去重）：當共用狀態有 `projectId` 但沒有 `tables`／`text` 時，Explorer 自己 `localApi.getProject(id)` → `storedVersionTables()` 把該版本的活動呈現為 `TASK` 表 → 設定檔名（版本 `meta.source_filename`）與錯誤提示；切專案／重建時 `setRebuilt(null)` 避免殘留舊檔表格。新增**專案專屬空狀態**（`data-empty-project`）：說明「此專案尚無儲存版本可顯示」＋提示可在 Gantt 存檔或改上傳檔案。 |
| `src/pages/GanttPage.jsx` | `handleProjectLoaded()` 的發佈補上 `text: ""`，確保切換到後端專案時不會殘留上一份檔案的文字／重建表格。 |
| `scripts/smoke-test.mjs` | 批次 51 回歸測試：以共用狀態「只有 projectId、沒有 tables／text」渲染 Explorer → 必須出現 `data-project-id`、專案名稱、`data-empty-project` 與「stored version」說明；並以原始碼守門檢查 adopt effect 與 `text: ""`。 |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`Stored project shows data in the Explorer (batch 51): FAILED (rendered=false, wiring=false)` ✓
2. **GREEN**：`OK (the shared project is fetched by the Explorer and rendered as its stored activities; the empty state explains itself; a project publish clears the previous file's text)`；總計 **96 OK / 0 FAILED**（95 + 新增 1）、`eslint` exit 0、`vite build` exit 0
3. **真實後端端對端**：`GET /projects` → 1 個專案 `6WSD21-DP_202409`；`GET /projects/{id}` → latest version「Save 22/09/2026, 13:49:13」含 **886 個活動**（+191 分段）→ 修正後 Explorer 會把這 886 筆顯示成 `TASK` 表 ✓

### 已知界限
後端版本**不含原始表**（僅 `tasks`＋`meta`），因此切換到後端專案時 Explorer 顯示的是「該版本活動」的 `TASK` 表，而非檔案的全部原始表（PROJECT／TASKPRED／RSRC…）。要瀏覽完整原始表需載入 XER／P6 XML（或先在 Gantt 上傳，兩頁共用）。

**RTM（批次 51）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5101 | Explorer 在共用狀態只有 projectId 時自行抓取該版本並顯示活動 | DataExplorerPage adopt effect | 使用者回報「沒有資料」 | Fixed |
| FR-5102 | 切換到後端專案時清除舊檔 `text`／重建表格 | GanttPage `handleProjectLoaded`／DataExplorerPage | 避免顯示過期資料 | Fixed |
| FR-5103 | 專案無儲存版本時顯示可理解的空狀態 | `data-empty-project` | 不讓畫面變成「空白」 | Fixed |
| AC-5101 | smoke 96 OK / 0 FAILED、eslint 0、build 0；後端實測 886 活動可顯示 | 量測（2026-09-22） | 問題已解 | Verified |

---

## 📦 Batch 52 — 修正：Explorer 仍空白 ＆ 回 Gantt 被重置

### 使用者回報（2026-09-22）
> 「還是不行，我啓動了專案 6WSD21-DP_202409 在 Gantt 后，轉到 data-explorer 裏還是空白的，而再回到 Gantt 那邊，也被切回到了初始首頁。」

### 根因（兩個獨立缺口）
1. **Explorer 空白**：共用狀態裡的 `projectId` 只有在**批次 49/50 之後**選專案才會被發佈。若專案是在此之前選的（或該次 session 的共用狀態沒有 `projectId`），Explorer 沒有任何可抓取的目標——批次 51 的 adopt effect 以 `projectId` 為前提，因此仍然空白。
2. **回 Gantt 被重置**：Gantt 的 programme 是**元件內 state**，切換路由會 unmount → 狀態消失；而 mirror effect 開頭即要求 `source === "explorer"`，**不會還原 Gantt 自己**發佈的專案 → 回到 Gantt 就落回 `DEFAULT_TASKS`（「初始首頁」）。

### 修正
| 檔案 | 變更 |
|---|---|
| `src/lib/projectOptions.js` | 新增 `newestProject(projects)`：取「最新儲存版本」的專案（`latest_version.created_at` 排序，無版本者以名稱排序殿後；空清單回 `null`）。 |
| `src/pages/DataExplorerPage.jsx` | adopt effect 改為 `targetId = programme?.projectId \|\| newestProject(projects)?.id`：**沒有 projectId 時自動採用後端最新專案**（因此只要後端有 programme，Explorer 不會空白），並把該選擇**發佈**（`source:"explorer"`）讓 Gantt 跟進；仍保留「真實檔案的 tables／text 優先」兩道守衛。 |
| `src/pages/GanttPage.jsx` | mirror effect 改為：先做 **還原共用專案**（`sharedProgramme.projectId !== currentProjectId` → `localApi.getProject` → `handleProjectLoaded`，**不分來源**），之後才套用「只鏡射 Explorer 載入的檔案（`source === "explorer"`）」的分支。 |
| `scripts/smoke-test.mjs` | 批次 52 回歸測試：`newestProject` 純函式契約、Explorer 的 `targetId = projectId \|\| newestProject(projects)` ＋發佈、以及 Gantt 的**專案還原分支必須早於** `source !== "explorer"` 守門（以索引比較，避免只是「有字」的假通過）。 |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：批次 52 檢查 FAILED（helpers 與接線都還不存在）✓
2. **GREEN**：**97 OK / 0 FAILED**（96 + 新增 1）、`eslint` 0 問題、`vite build` exit 0 ✓
3. **真實後端模擬（用真正的 `projectOptions.js` ＋ 本地 FastAPI）**：
```
projects in backend : 6WSD21-DP_202409
auto-adopted project: 6WSD21-DP_202409
latest version      : Save 22/09/2026, 13:49:13 (886 activities)
Explorer TASK rows  : 886
first row           : {"task_code":"WSD-CD-01","task_name":"6WSD21 Contract Date","act_start_date":"2021-11-10","phys_complete_pct":"100"}
```
→ 即使共用狀態沒有 `projectId`，Explorer 也會顯示 886 筆活動；回 Gantt 亦會還原同一專案 ✓

**RTM（批次 52）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5201 | 共用狀態無 projectId 時自動採用後端最新專案 | `newestProject` ＋ DataExplorerPage adopt effect | 使用者回報 Explorer 空白 | Fixed |
| FR-5202 | 自動採用後發佈該專案（兩頁一致） | `publishProgramme(..., "explorer")` | 兩邊同步 | Fixed |
| FR-5203 | Gantt 重掛載時還原共用專案（不分來源） | GanttPage mirror effect 順序調整 | 使用者回報回 Gantt 被重置 | Fixed |
| AC-5201 | smoke 97 OK / 0 FAILED、eslint 0、build 0；真實後端模擬 886 筆可顯示 | 量測（2026-09-22） | 兩個症狀皆已解 | Verified |

---

## 📦 Batch 53 — 後端版本也存原始表（切專案即可看 PROJECT／TASKPRED／RSRC 全部原始表）

### 使用者需求（2026-09-22）
> 「後端版本也要存原始表（切專案也能看 PROJECT／TASKPRED／RSRC 全部原始表）」

### User Story
As a **planner**, I want **every stored version to keep the file's own raw tables**, so that **opening a stored project in the Data Explorer shows the same tables as the original XER, not just the parsed activities**.

### Requirements
- **Functional**
  - FR-5301：**儲存時帶上原始表**——ProjectBar 上傳（`parseFileInBrowser` 的 `xerTables`）與存檔（新增 `xerTables` prop，由 GanttPage 傳入 `xerSource`）都把 `payload.xerTables` 寫進版本。
  - FR-5302：**大小守衛**——`tablesWithinLimit()`（預設 24 MB JSON，約 40 MB 的 XER）超限就只存活動，不讓 payload 爆掉。
  - FR-5303：**載入時恢復**——`handleProjectLoaded()` 讀 `payload.xerTables`（優先於匯入時的 tables）→ 設定 `xerSource`（後端專案也能 XER→XER 無損輸出）→ 並把 `tables`／`format` 發佈到共用狀態。
  - FR-5304：**Explorer 優先顯示原始表**——`explorerTableSource(project)` 回 `{ tables, source }`：`"raw"`（版本存了原始表）→ 否則 `"activities"`（由活動重建的 TASK 表）→ 否則 `null`；畫面上以 `data-table-source` 標示來源，舊版本顯示「predates raw-table storage…」提示。
  - FR-5305：`versionSummary()` 增加 `hasRawTables`／`tableCount`（供 UI 與測試判斷）。
- **Non-Functional**
  - NFR-5301：**後端零改動**——`POST /projects/{id}/versions` 已原樣保存任意 `payload` dict；`GET /versions`（清單）不回傳 payload，因此清單不會變胖。
  - NFR-5302：既有（無原始表的）版本必須**繼續可用**：Explorer 退回活動檢視並說明原因。
- **Constraints**：只改前端 `projectOptions.js`／`ProjectBar.jsx`／`GanttPage.jsx`／`DataExplorerPage.jsx`；不動後端 API 與資料庫 schema。

### 實作
| 檔案 | 內容 |
|---|---|
| `src/lib/projectOptions.js` | 新增 `MAX_STORED_TABLES_CHARS`、`tablesJsonSize`、`tablesWithinLimit`、`versionRawTables`、`explorerTableSource`；`versionSummary` 加 `hasRawTables`／`tableCount` |
| `src/components/gantt/ProjectBar.jsx` | 新增 `xerTables` prop；上傳與存檔的 payload 皆帶 `...(xerTables && tablesWithinLimit(xerTables) ? { xerTables } : {})` |
| `src/pages/GanttPage.jsx` | `handleProjectLoaded` 讀 `payload?.xerTables`（`storedTables`；`sourceTables` 決定 `xerSource`／recalc 來源）；發佈 `tables: storedTables \|\| xerTables \|\| null` 與對應 `format`；`<ProjectBar xerTables={xerSource} …>` |
| `src/pages/DataExplorerPage.jsx` | 改用 `explorerTableSource()`；新增 `projectSource` 狀態；標題列下方以 `data-table-source` 顯示來源說明；載入檔案／Clear 時清除來源 |
| `scripts/smoke-test.mjs` | 批次 53 回歸測試（大小守衛、`versionRawTables`、`explorerTableSource` 三態、`versionSummary` 新欄位、四檔接線守門） |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`Stored versions carry the raw tables (batch 53): FAILED: TypeError: lib.tablesJsonSize is not a function` ✓
2. **GREEN**：**98 OK / 0 FAILED**（97 + 新增 1）、`eslint` 0 問題、`vite build` exit 0 ✓
   （過程中兩個舊斷言因重構改為意圖層級：`storedVersionTables` → `explorerTableSource`）
3. **後端來回實測（臨時專案，測完刪除）**：
```
created temp project : smoke-rawtables-1790058189185
stored version       : round trip  (payload chars 194)
raw tables returned  : PROJECT, TASKPRED, RSRC  identical=true
Explorer will show   : source="raw", 3 tables, 1 TASKPRED row(s), hasRawTables=true
cleanup              : temp project deleted, projects now = 6WSD21-DP_202409
```
→ 原始表經後端保存後**完全一致**取回，且 Explorer 會走 `raw` 路徑 ✓

### 使用注意
既有版本（例如使用者的 `6WSD21-DP_202409` 於 2026-09-22 13:49 存的那版）是在本批次**之前**存的，**沒有原始表** → Explorer 會顯示活動檢視並提示「predates raw-table storage」。**在 Gantt 頁重新上傳該 XER（或按存檔）一次**，之後該版本就帶著全部原始表 ✓

**RTM（批次 53）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5301 | 上傳／存檔時把原始表寫入版本 payload | ProjectBar（`xerTables` prop） | 想在 Explorer 看全部原始表 | Verified |
| FR-5302 | 24 MB 大小守衛（超限只存活動） | `tablesWithinLimit` | 避免 payload 爆掉 | Verified |
| FR-5303 | 載入版本時恢復 `xerSource` 並發佈 tables | GanttPage `handleProjectLoaded` | 無損 XER→XER、兩頁一致 | Verified |
| FR-5304 | Explorer 優先原始表，否則活動並標示來源 | `explorerTableSource` ＋ `data-table-source` | 誠實呈現資料來源 | Verified |
| FR-5305 | `hasRawTables`／`tableCount` 摘要 | `versionSummary` | UI／測試判斷 | Verified |
| NFR-5301 | 後端零改動、清單不回傳 payload | FastAPI versions router | 不改基礎設施 | Verified |
| NFR-5302 | 舊版本仍可用（活動檢視＋說明） | `explorerTableSource` `"activities"` | 向後相容 | Verified |
| AC-5301 | smoke 98 OK / 0 FAILED、eslint 0、build 0；後端來回 identical=true | 量測（2026-09-22） | 功能可用 | Verified |

---

## 📦 Batch 54 — 兩頁真正共用同一份 programme ＋ Explorer 可選版本

### 使用者需求（2026-09-22）
> 「兩邊頁面應該共享同一套數據，而不是跳換兩邊畫面后就刷新掉數據，Explorer 也要能選版本（目前只選專案，挑最新版）」

### User Story
As a **planner**, I want **both pages to keep showing the same programme when I swap between them, and to pick which stored version the Data Explorer opens**, so that **I never lose the loaded programme or have to re-upload it**.

### Requirements
- **Functional**
  - FR-5401：共用狀態新增 `tasks`（記憶體）／`versionId`／`versionName`（後兩者持久化）——兩頁的**同一份 programme**。
  - FR-5402：Gantt 每次 tasks 變動（參照比較、防迴圈）即 `publishProgramme({ tasks }, "gantt")`，因此切換路由或重新掛載都不會掉資料。
  - FR-5403：Gantt 重新掛載時的還原優先序：**(1) 共用 versionId → `getVersion` 載入該版本** → (2) 共用 projectId 不同 → `getProject` → (3) 共用 tasks（不同參照）→ 直接還原 tasks／tables／標題 → (4) Explorer 載入的檔案（tables／text）。以 `appliedVersionRef`＋`mirroredRevision` 防迴圈。
  - FR-5404：Explorer 新增**版本選擇器**（`VersionSelector`）：`localApi.listVersions()`（**最新在前**，標籤含名稱／時間／活動數）→ 選版本時 `getVersion()` 取該版本 payload → `explorerTableSource()` 顯示原始表或活動，並發佈 `versionId`／`versionName`。
  - FR-5405：`pickVersionTarget({ project, versions, wantedId })` 決定要開哪一版：共用版本（屬於此專案）→ 最新版本 → 專案的 `latest_version` → 無。
  - FR-5406：helpers 同時接受「專案（含 `latest_version`）」或「版本物件」本身（`asVersion()`），因此專案與版本兩條路徑共用同一套判斷。
  - FR-5407：切專案時同時載入該專案的版本清單；`versionSummary` 只依 payload 判斷，不需額外請求。
- **Non-Functional**
  - NFR-5401：tasks 只留記憶體（不寫 localStorage，避免 quota 與序列化成本）。
  - NFR-5402：版本清單 API（`GET /versions`）不回傳 payload，清單不會因原始表而變胖。
  - NFR-5403：選擇器沿用 Common Look and Feel palette（測試含 palette guard）。
- **Constraints**：不改後端；只動 `programmeStore.jsx`／`projectOptions.js`／`DataExplorerPage.jsx`／`GanttPage.jsx`，並新增 `VersionSelector.jsx`。

### 實作
| 檔案 | 內容 |
|---|---|
| `src/lib/programmeStore.jsx` | `emptyProgramme()` 加 `tasks`／`versionId`／`versionName`；持久化只寫 versionId／versionName |
| `src/lib/projectOptions.js` | 新增 `asVersion`（內部）、`versionOptions`（最新在前）、`newestVersion`、`pickVersionTarget`；`versionSummary`／`storedVersionTables`／`versionRawTables` 改走 `asVersion` |
| `src/components/dataexplorer/VersionSelector.jsx`（新） | 純呈現版本選單（`data-version-selector`／`data-version-id`），含刷新與空狀態 |
| `src/pages/DataExplorerPage.jsx` | 以 `applyVersion(projectId, versionId)` 統一「取專案＋版本＋tables」流程；新增 `versions`／`versionId` 狀態、`handleVersionChange`、版本選擇器；改為呼叫 `explorerTableSource` 判斷來源 |
| `src/pages/GanttPage.jsx` | mirror effect 加入 (1) 版本還原（`getVersion`＋`appliedVersionRef`）與 (3) tasks 還原；新增 tasks 發佈 effect |
| `scripts/smoke-test.mjs` | 批次 54 回歸測試（version options 最新在前、`newestVersion`、`pickVersionTarget` 四情境、store 新欄位、`VersionSelector` render 與選取、兩頁接線守門） |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`Shared programme + version picking (batch 54): FAILED: TypeError: lib.versionOptions is not a function` ✓
2. **GREEN**：**99 OK / 0 FAILED**（98 + 新增 1）、`eslint` 0 問題、`vite build` exit 0、模組（`/data-explorer`、`VersionSelector.jsx`、`DataExplorerPage.jsx`、`projectOptions.js`、`GanttPage.jsx`）全 200 ✓
3. **真實後端檢查**：`6WSD21-DP_202409` 現有 **1 個版本**（`Save 22/09/2026, 14:18:47`，886 活動；清單不含 payload）→ 以真實 helper 判定 `hasRawTables=false`、`source="activities"`（顯示 886 筆活動表）✓

**RTM（批次 54）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5401 | 共用狀態含 tasks／versionId／versionName | `programmeStore.jsx` | 兩頁共享同一套數據 | Verified |
| FR-5402 | tasks 變動即發佈（防迴圈） | GanttPage tasks effect | 跳換頁面不掉資料 | Verified |
| FR-5403 | Gantt 還原優先序（版本 → 專案 → tasks → Explorer 檔案） | GanttPage mirror effect | 同上 | Verified |
| FR-5404 | Explorer 版本選擇器（最新在前） | `VersionSelector` ＋ `applyVersion` | Explorer 要能選版本 | Verified |
| FR-5405 | `pickVersionTarget` 決策（共用版本／最新／latest_version） | `projectOptions.js` | 選版本行為明確 | Verified |
| FR-5406 | helpers 同時接受專案或版本 | `asVersion` | 兩條路徑共用 | Verified |
| FR-5407 | 切專案同時載入版本清單 | `listVersions` | 版本可選 | Verified |
| NFR-5401 | tasks 不落地（記憶體） | `writePersistedProgramme` | 效能／quota | Verified |
| NFR-5402 | 版本清單不含 payload | FastAPI `to_dict()` | 清單不會變胖 | Verified |
| NFR-5403 | 選擇器 light-only palette | `VersionSelector`（palette guard） | Common Look and Feel | Verified |
| AC-5401 | smoke 99 OK / 0 FAILED、eslint 0、build 0、模組全 200 | 量測（2026-09-22） | 功能可用 | Verified |


---

## 📦 Batch 54b — 修正「切換頁面時畫面閃現」

### 使用者回報（2026-09-22）
> 「爲什麽會閃現畫面」

### 根因
1. **首繪閃現**：Gantt 的 `tasks`／`currentProjectId`／`projectTitle`／`xerSource` 都用「預設值」初始化，掛載後才由還原 effect 換成共用 programme → 使用者會先看到**預設 programme**（`DEFAULT_TASKS`）再跳成真實資料（含標題／專案列）。
2. **多餘重繪**：tasks 每次變動都立即發佈（拖曳、儲存格、undo…）→ 共用 context 變更 → Gantt（與 Explorer）每次都整體重繪。
3. **表格來源跳動**：Explorer 的 `viewTables` 以「共享 tables 優先於專案/版本 tables」→ 兩者都存在時會在「原始表」與「活動表」之間來回跳。

### 修正
| 檔案 | 變更 |
|---|---|
| `src/pages/GanttPage.jsx` | 把 `useProgramme()` 提到元件**最前面**，並讓 `tasks`／`history`／`nextId`／`projectTitle`／`currentProjectId`／`xerSource` 的 `useState` 初始值**優先採用共用 programme** → 首繪就是正確資料；tasks 發佈改為 **800 ms debounce**（`setTimeout` + cleanup）。 |
| `src/pages/DataExplorerPage.jsx` | 新增 `seenRevisionRef`：偵測到**新的**共享 programme（revision 變更且非首次）時，清掉先前載入的專案/版本 tables（`setProjectTables(null)`／`setProjectSource(null)`）→ 表格來源單一化；`viewTables` 優先序改為 `本頁檔 → 專案/版本 → 共享`。 |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：新增批次 54b 檢查 → `No-flicker first paint + debounced publish (batch 54b): FAILED (noFlash=false)` ✓（其餘 99 OK）
2. **GREEN**：**100 OK / 0 FAILED**（99 + 新增 1）、`eslint` 0 問題、`vite build` exit 0 ✓
3. 模組：`/data-explorer`、`DataExplorerPage.jsx`、`GanttPage.jsx` 等全部 HTTP 200 ✓

**RTM（批次 54b）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5408 | Gantt 首繪即採用共用 programme（不再先畫預設） | GanttPage state initialisers | 使用者回報畫面閃現 | Fixed |
| FR-5409 | tasks 發佈 debounce 800ms（降低重繪） | GanttPage tasks effect | 同上 | Fixed |
| FR-5410 | Explorer 表格來源單一化（新共享 programme 取代舊專案/版本 tables） | `seenRevisionRef`＋`viewTables` 優先序 | 同上 | Fixed |
| AC-5402 | smoke 100 OK / 0 FAILED、eslint 0、build 0 | 量測（2026-09-22） | 症狀已解 | Verified |

---

## 🔤 批次 55（2026-09-22）— 資料表出現亂碼 `�G` / `�D` / `��`：根因是**來源 XER 檔本身已損毀**

### 使用者提問
「Data Explorer 的表格為什麼會有亂碼？能幫我檢查修正一下可能的問題嗎？」
（截圖：`CURRTYPE` 表 `curr_symbol` 欄分別顯示 `�G`、`�D`、`��`）

### 追查（以真實檔案逐位元組驗證，非推測）
使用者實際匯入的檔案：`C:\Users\ken.li\Downloads\6WSD21-DP_202409.xer`（617.9 KB）

| 驗證項目 | 方法 | 結果 |
|---|---|---|
| 檔案是否為合法 UTF-8 | `new TextDecoder("utf-8",{fatal:true}).decode(buf)` | ✅ 通過（**檔案本身是合法 UTF-8**） |
| 全檔 U+FFFD 數量 | `buf.toString("utf8").match(/\uFFFD/g).length` | **5**（僅 5 個字元損毀，其餘 886 個活動完全乾淨） |
| `curr_symbol` 原始位元組 | 由 `%F` / `%R` 取欄位、逐 byte 轉 hex | `ef bf bd 47`（GBP）／`ef bf bd 44`（JPY）／`ef bf bd ef bf bd`（EUR） |
| `ef bf bd` 是什麼 | UTF-8 解碼 | 就是 **U+FFFD 本身的 UTF-8 編碼** |

### 根因（結論）
`ef bf bd` **已經寫在檔案裡**：原始貨幣符號（單一位元組，如 `£` = `0xA3`、`¥` = `0xA5`、`€` = `0x80`）
在 P6 匯出時被當成 UTF-8 解碼 → 產生 U+FFFD → 再以 UTF-8 寫回檔案（`ef bf bd`），
而後面的 ASCII 尾位元組（`G`、`D`）原樣保留。

```
原始位元組：      0xA3 0x47
匯出管線以 UTF-8：0xA3 無效 → U+FFFD ；0x47 = "G" 保留
寫回檔案：        ef bf bd 47     → 讀入後顯示 "�G"     ← 檔案內就是這個內容
```

因此：**這不是本應用的解碼錯誤，而是來源檔案在匯出階段就已遺失資料**。
本應用忠實顯示檔案內容（沒有改寫、沒有猜測），所以看到的就是 `�G`；同一份檔案用任何工具開啟都會一樣。

### 修正（做了什麼、刻意不做什麼）
| # | 內容 | 位置 |
|---|------|------|
| 1 | 新增 `brokenValues(tables)`：掃描所有資料表，統計並取樣含 U+FFFD 的值（最多 5 筆樣本） | `src/lib/dataExplorer.js` |
| 2 | 有損毀值時顯示提示條（`data-broken-values`，hover 列出 `表.欄 = 值` 樣本）：說明檔案本身含無法還原的字元、請由 P6 重新匯出 | `src/pages/DataExplorerPage.jsx` |
| 3 | **刻意不做**「自動修補」：遺失的位元組無從得知（`0xA3` 只是推測），猜測等於**捏造資料**，違反本專案「不臆測、忠實呈現」原則 | — |
| 4 | 迴歸測試：U+FFFD 值必須被計數與取樣、空／null 輸入安全、頁面必須有提示條與 `data-broken-values` | `scripts/smoke-test.mjs` |

### 建議（使用者端）
1. **在 P6 端修正貨幣符號後重新匯出 XER**（最乾淨的解法）。
2. 若只需辨識貨幣：`curr_short_name` 欄（USD／GBP／JPY／EUR／CNY）完全正常，可依它判斷；損毀的只有裝飾性的 `curr_symbol`。
3. 本檔案其餘 15 個資料表、886 個活動、關係、日曆等**完全正常**，可放心使用。

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：新增批次 55 檢查 → `Broken file characters are surfaced (batch 55): FAILED: TypeError: lib.brokenValues is not a function` ✓（其餘 100 OK）
2. **GREEN**：**101 OK / 0 FAILED**（100 + 新增 1）、`eslint` 0 error、`vite build` exit 0 ✓
3. 檔案層級驗證：`strict utf-8 = OK`、全檔僅 5 個 U+FFFD、偵測出的樣本與畫面顯示一致 ✓

**RTM（批次 55）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5501 | 載入檔案含無法解碼字元（U+FFFD）時，介面必須明確告知使用者 | `brokenValues()` ＋ Explorer 提示條 | 使用者回報資料表出現亂碼 | Complete |
| FR-5502 | 應用不得「修補」或猜測遺失字元（維持忠實呈現） | 設計決策（無自動修補） | 使用者要求查出原因 | Complete |
| NFR-5501 | 損毀偵測須為 O(資料量) 且對空／`null` 輸入安全 | `brokenValues()` | 使用者要求效能無感 | Verified |
| AC-5501 | 真實 XER（`6WSD21-DP_202409.xer`）：檔案本身為合法 UTF-8、全檔僅 5 個 U+FFFD、`curr_symbol` 位元組為 `ef bf bd 47`／`ef bf bd 44`／`ef bf bd ef bf bd` | 位元組層級量測（2026-09-22） | 亂碼根因確認 | Verified |
| AC-5502 | 煙霧測試 101 OK / 0 FAILED（含批次 55 斷言） | `scripts/smoke-test.mjs` | — | Verified |

---

## 💱 批次 56（2026-09-22）— 貨幣符號還原：以未損毀的 ISO 代碼補回 `£` `¥` `€`

### 使用者需求
「幫我重塑增加相關字符，以保證能夠正確顯示所有貨幣符號」

### 追查（兩顆真實檔案逐位元組比對）
| 檔案 | GBP | JPY | EUR | CNY |
|---|---|---|---|---|
| `6WSD21-DP_202403.xer`（舊，2024-04） | bytes `A2 47` → 顯示 `¢G` | `A2 44` → `¢D` | `A3 E1` → `£á` | `A2 44` → `¢D` |
| `6WSD21-DP_202409.xer`（新，2026-09 匯入） | `ef bf bd 47` → `�G` | `ef bf bd 44` → `�D` | `ef bf bd ef bf bd` → `��` | `ef bf bd 44` → `�D` |

兩顆檔案的**尾位元組完全相同**（GBP `47` = `G`、JPY／CNY `44` = `D`）→ 新檔就是同一批位元組被 UTF-8 重編碼（每個非 ASCII byte → U+FFFD），損毀確實發生在**匯出來源**（批次 55 已證實）。

**關鍵事實**：18 個貨幣中**只有 4 個非 ASCII 符號壞掉**（GBP `£`、JPY `¥`、CNY `¥`、EUR `€`），
其餘 ASCII 符號（`$` `R$` `$b` `Gs` `S/.` `Bs` `RUB` `$U`）全部完好；`curr_short_name`（ISO 4217）也全部完好
→ 這是可靠、**非臆測**的還原依據。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 新增 `currencySymbols.js`：`CURRENCY_SYMBOLS`（ISO 4217 → 符號，約 90 種）、`currencySymbolFor()`、`currencyCodeOf()`、`isBrokenValue()`、`restoreCurrencySymbols()` | `src/lib/currencySymbols.js`（新） |
| 2 | Explorer 以**還原後**的表渲染與匯出（Excel 也拿到正確符號），原始表永不改寫 | `src/pages/DataExplorerPage.jsx` |
| 3 | 還原提示條（`data-restored-symbols`，hover 顯示 `表.欄: GBP → £ (the file had "�G")`） | 同上 |
| 4 | 儲存格／屬性卡以 `*` 標示還原值，hover 顯示原檔內容 | `src/components/dataexplorer/TableBrowser.jsx` |
| 5 | 迴歸測試：4 個符號還原、完好值不得被動、輸入不得被改、無法還原者列入 `unresolved`、真實 18 列還原後零 U+FFFD | `scripts/smoke-test.mjs` |

### 還原規則（刻意保守，避免臆測）
1. 只有**含 U+FFFD** 的值會被取代；
2. 只處理**符號欄位**（`curr_symbol`／P6 XML 的 `CurrencySymbol`）；
3. 只有列上帶**已知 ISO 代碼**時才還原，否則原值保留並列入 `unresolved`（例如 `XXX`、非貨幣列）；
4. 輸入物件**不被修改**（回傳新物件；未變更時回傳原物件，memo 友善）；
5. ASCII 符號永不變動（`R$`、`Bs`、`S/.` 等保留 P6 原樣，不強改成標準符號）。

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`Currency symbols restored from the ISO code (batch 56): FAILED: Error: Failed to load url /src/lib/currencySymbols.js … Does the file exist?`（其餘 101 OK）
2. **GREEN**：**102 OK / 0 FAILED**、`eslint` 0 error、`vite build` exit 0；真實檔還原後 `brokenValues().count === 0` ✓
3. 過程中測試自身有一個自相矛盾的斷言（拿已損毀列去比對還原後的值）→ 已修正為「只檢查本來完好的列」✓
4. 批次 54b 的接線斷言原本綁在 `const viewTables = tables \|\| projectTables \|\| sharedTables;` 這一行字面上；
   由於 `viewTables` 現在代表**還原後**的表，改為 `rawTables`（同一條優先序）＋新增 `const { tables: viewTables` 斷言
   → 行為不變、守門更完整 ✓

**RTM（批次 56）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5601 | 匯出損毀的貨幣符號必須以列上的 ISO 4217 代碼還原並正確顯示 | `restoreCurrencySymbols()` ＋ Explorer | 使用者要求「保證正確顯示所有貨幣符號」 | Complete |
| FR-5602 | 本來完好的符號不得被改寫（保留 P6 原始慣例，如 `R$`、`Bs`、`S/.`） | 同上（只處理含 U+FFFD 的值） | 使用者要求忠實呈現 | Complete |
| FR-5603 | 無 ISO 代碼可依據的損毀值必須原樣顯示並列入 `unresolved` 回報 | `restoreCurrencySymbols()` ＋ 提示條 | 使用者要求可追溯 | Complete |
| NFR-5601 | 還原須為純函式（不得修改輸入），未變更時回傳原物件 | `restoreCurrencySymbols()` | — | Verified |
| NFR-5602 | 符號表須涵蓋主要 ISO 4217 貨幣（約 90 種）；未知代碼回傳空字串而非臆造符號 | `CURRENCY_SYMBOLS` | 使用者要求「所有貨幣符號」 | Complete |
| AC-5601 | 真實檔 18 列：4 列還原為 `£`／`¥`／`€`／`¥`，14 列維持原值，還原後 U+FFFD 值為 0 | smoke test fixture（真實值） | — | Verified |
| AC-5602 | 煙霧測試 102 OK / 0 FAILED、eslint 0 error、build exit 0 | 量測（2026-09-22） | — | Verified |

---

## 💾 批次 57（2026-09-22）— 存專案時保存「全部資料」：兩邊頁面互跳與日後重開都完整

### 使用者需求
「存儲專案的功能裏，應該儲存所有資料，包括轉到 data-explorer 那邊顯示的資料也一并儲存，
保證兩邊頁面跳轉時，或者之後啓動已存儲的專案都能在兩邊頁面完整展示」

### 盤點：原本少了什麼
| 項目 | 批次 57 之前的狀態 |
|---|---|
| 活動 `tasks`（含 `links` 關聯） | ✅ 有存 |
| 版本資訊 `meta`（來源檔名／格式／Last Recalc Date） | ✅ 有存 |
| 原始表 `xerTables`（Explorer 顯示用） | ✅ 批次 53 起有存，但**受限於 24 MB 守衛**：超限就只存活動 |
| **檔案原文 `xerText`** | ❌ **完全沒存** → 原始表一旦被守衛擋掉，Explorer 只能退回「活動表」，Gantt 也失去 `xerSource`（無法 XER→XER 無損輸出） |
| 開啟已存專案後的共用狀態 `text` | ❌ 被清成 `""`（批次 51 的防殘留設計）→ 無法由原文重建 |

### 量測（真實檔 `6WSD21-DP_202409.xer`）
```
檔案原文        :  618 KB（632,682 chars）
解析後表 JSON   : 2153 KB（15 tables）
比例            : 3.48x
```
→ **存原文最省，而且原文是真相來源**（有原文就能重建任何表）。
策略：**原始表與原文都存** —— 表提供快速路徑，原文作為保底。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 新增 `versionRawText(project)`、`MAX_STORED_TEXT_CHARS`、`textWithinLimit()` | `src/lib/projectOptions.js` |
| 2 | `explorerTableSource()` 新增第 3 態 `"rebuild"`（版本只存原文時回傳 `text` 供呼叫端解析）；`versionSummary()` 加 `hasRawText` | 同上 |
| 3 | ProjectBar 新增 `xerText` prop；上傳（`parseFileInBrowser` 回傳 `text`）與存檔兩條路徑都以 `textWithinLimit()` 守衛寫入 `payload.xerText` | `src/components/gantt/ProjectBar.jsx` |
| 4 | Gantt `handleProjectLoaded()` 讀 `payload?.xerText`，沒有 `xerTables` 時**用原文重建**（`parseXerTables`／`tablesFromXml`）→ 設定 `xerSource`，並把 `tables`＋`text` 一起發佈（不再清成 `""`） | `src/pages/GanttPage.jsx` |
| 5 | Explorer `applyVersion()` 支援 `"rebuild"`（由版本原文重建全部表）、發佈 `tables` 與 `text`；來源提示新增「rebuilt from the file text stored with this version」 | `src/pages/DataExplorerPage.jsx` |
| 6 | 迴歸測試：原文存取契約／大小守衛／`explorerTableSource` 四態／`hasRawText`／三檔接線守門 | `scripts/smoke-test.mjs` |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`Stored version keeps every piece of the programme (batch 57): FAILED: TypeError: lib.versionRawText is not a function` ✓
2. **GREEN**：**103 OK / 0 FAILED**（102 + 新增 1）、`eslint` 0 error、`vite build` exit 0 ✓
3. **真實後端來回實測**（臨時專案，測後刪除）：
```
temp project      : smoke-batch57-1790060534972
stored version    : tasks=1  tables=15 (2153 KB)  text=618 KB
stored intact     : text identical=true  tables identical=true
Explorer source   : raw  15 tables  (currency restored: GBP->£, JPY->¥, EUR->€, CNY->¥)
summary           : hasRawTables=true hasRawText=true tables=15 file=6WSD21-DP_202409.xer format=xer recalc=2024-09-30
text-only version : source=rebuild  text identical=true  -> rebuildable
cleanup           : delete=200  projects now=0
```
4. 過程中兩個測試問題已修正並記錄：批次 51／53 的接線斷言綁在舊字面值（`text: ""`、`tables: storedTables`）→ 改為新契約 ✓

**RTM（批次 57）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5701 | 存檔／上傳時必須把檔案原文（`payload.xerText`）一併寫入版本 | ProjectBar（`xerText` prop ＋ `parseFileInBrowser`） | 使用者要求「儲存所有資料」 | Complete |
| FR-5702 | 版本未存原始表但存有原文時，Explorer 必須由原文重建全部原始表 | `explorerTableSource` `"rebuild"` ＋ DataExplorerPage | 上述需求 | Complete |
| FR-5703 | 載入已存專案時 Gantt 必須由 `xerTables` 或原文恢復 `xerSource`，並把 `tables`＋`text` 發佈到共用狀態 | GanttPage `handleProjectLoaded` | 兩邊頁面互跳／重開專案完整展示 | Complete |
| FR-5704 | 開啟已存版本後不得把 `text` 清空（原文隨版本走，不會殘留上一份檔案） | GanttPage／DataExplorerPage 發佈 | 上述需求 | Complete |
| NFR-5701 | 原文儲存須有大小守衛（`MAX_STORED_TEXT_CHARS` 24 MB），且表與原文各自獨立判斷 | `textWithinLimit`／`tablesWithinLimit` | 避免 payload 爆掉 | Complete |
| AC-5701 | 真實 XER：原文 618 KB vs 表 2153 KB（3.48x）→ 原文為最省的真相來源 | 量測（2026-09-22） | 設計決策 | Verified |
| AC-5702 | 後端來回：`xerTables`／`xerText` 讀回後與寫入**完全相同**；Explorer 得 15 張表；純原文版本可重建 | 臨時專案實測（2026-09-22） | — | Verified |
| AC-5703 | 煙霧測試 103 OK / 0 FAILED、eslint 0 error、build exit 0 | 量測（2026-09-22） | — | Verified |

---

## 🐞 批次 58（2026-09-22）— 點擊已存專案後「閃退回原始頁」

### 使用者回報
「爲什麽點擊了儲存的專案后，會閃退回原始頁」

### 根因（讀 effect 得出，可證明）
`GanttPage.handleProjectLoaded()` 發佈共用 programme 時**沒有帶 `versionId`** ✗，
所以共用狀態會**保留上一次的 versionId**（例如先前在 Data Explorer 挑過的版本）。

接著 Gantt 的 mirror effect 分支 (1)：

```js
if (sharedProgramme.projectId && sharedProgramme.versionId
  && String(sharedProgramme.versionId) !== appliedVersionRef.current) { /* 再載入該版本 */ }
```

看到「有 projectId ＋ 一個尚未套用的 versionId」→ **又去載入那個舊版本** ✗，
把你剛點選的專案整個覆蓋回去 → 畫面就是「先顯示正確資料 → 立刻退回原狀」。

次要原因（同一症狀的第二條路徑）：Explorer 的 `applyVersion()` 在 `picked.source === "rebuild"`
（版本只存原文）而該次重建失敗時，會 `publishProgramme({ tables: null })` ✗ → `viewTables` 變 `null`
→ **退回空狀態**（也是使用者眼中的「原始頁」）。此外 Explorer 的 revision effect 對「自己發出的發佈」
也會清掉剛套用的表格來源 ✗（來源標籤消失）。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | `handleProjectLoaded(project, payload, xerTables, version = null)`：發佈 `versionId`／`versionName`，並把 `appliedVersionRef` 記為該版本 | `src/pages/GanttPage.jsx` |
| 2 | mirror effect 分支 (1) 加上來源守門：**只有 `source === "explorer"`（Explorer 真的挑了版本）才重載版本**；本頁 ProjectBar 的點擊不再被殘留的舊 versionId 反覆載入 | 同上 |
| 3 | ProjectBar 四個入口都把版本物件傳出去（建立 → `null`、選專案 → `latest_version`、後端匯入 → `result.version`、上傳存檔 → 新建的 `version`） | `src/components/gantt/ProjectBar.jsx` |
| 4 | `explorerTableSource()` 每個回傳都附帶 `activities` 保底；Explorer 改用 `picked.tables → rebuilt → picked.activities`，**不會因重建失敗而變空** | `src/lib/projectOptions.js`、`src/pages/DataExplorerPage.jsx` |
| 5 | Explorer revision effect：`programme.source === "explorer"`（自己的發佈）直接略過，不再清掉剛套用的表 | 同上 |
| 6 | 批次 58 回歸測試（四態保底／四個入口的版本傳遞／來源守門／Explorer 保底與自身發佈略過） | `scripts/smoke-test.mjs` |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`A stored project click survives a stale version (batch 58): FAILED (fallback=false, click=false, guard=false, explorer=false)` ✓
2. **GREEN**：**104 OK / 0 FAILED**（103 + 新增 1）、`eslint` 0 error、`vite build` exit 0 ✓
3. 診斷過程（真實後端，臨時專案測後刪除）：建立含「完整版本 ＋ 純原文版本」的專案，重放 `applyVersion()` 的判定鏈 →
   確認版本清單端點不回 payload（正常）、最新版本捷徑正常、`explorerTableSource` 對純原文版本回 `rebuild`，
   並因此查出「重建失敗 → 發佈 `tables: null` → 空狀態」這條路徑 ✓

**RTM（批次 58）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5801 | 點選專案後不得被共用狀態中殘留的舊 `versionId` 覆蓋（僅 Explorer 真的挑版本才重載） | GanttPage mirror effect (1) ＋ `appliedVersionRef` | 使用者回報點專案後閃退回原始頁 | Fixed |
| FR-5802 | 載入專案／版本時必須把 `versionId`／`versionName` 寫回共用狀態 | `handleProjectLoaded` ＋ ProjectBar 四入口 | 同上 | Fixed |
| FR-5803 | 版本內容無法由原文重建時，必須退回該版本的活動清單，不得顯示空狀態 | `explorerTableSource().activities` ＋ DataExplorerPage | 同上 | Fixed |
| FR-5804 | 頁面自身的發佈不得清除自己剛套用的表格來源 | Explorer revision effect（`source === "explorer"` 略過） | 同上 | Fixed |
| AC-5801 | 批次 58 斷言紅→綠；煙霧測試 104 OK / 0 FAILED、eslint 0 error、build exit 0 | 量測（2026-09-22） | — | Verified |

---

## 🐞 批次 59（2026-09-22）— 閃退的真正主因：**發佈時沒有帶 `tasks`**，mirror effect 把舊 programme 放回來

### 回報延續
批次 58 修正「殘留 versionId 被重載」後仍會閃退 → 再往下追，找到兩條**同類型但更致命**的路徑
（都是「舊資料覆蓋剛載入的專案」）。

### 主因 1（Gantt 頁）— `handleProjectLoaded` 不發佈 `tasks`
```
點選專案 → handleProjectLoaded() 設定新的 tasks（畫面正確 ✓）
        → publishProgramme({ tables, text, projectId … })      ← 沒有 tasks ✗
        → 共用狀態裡仍是【上一份載入的檔案】的 tasks
        → mirror effect 因 revision 變更而執行
        → 分支 (3)：if (sharedProgramme.tasks && sharedProgramme.tasks !== tasks) setTasks(sharedProgramme.tasks)
        → 剛載入的專案被【舊 programme】覆蓋 → 閃退回原始頁 ✗
```
**修正**：`handleProjectLoaded` 把剛套用的 `tasks` 一併發佈（`...(publishTasks ? { tasks: publishTasks } : {})`），
共用狀態立刻與畫面一致；分支 (3) 再加上 `sharedProgramme.source === "explorer"` 守門，
**本頁自己的發佈永遠不會把自己覆蓋**。

### 主因 2（Explorer 頁）— 本頁載入的檔案永遠優先
`viewTables = tables || projectTables || sharedTables` → 若**先在 Explorer 載入過檔案**，
之後點儲存專案時 `tables`（本頁檔案）仍然優先 → 畫面**回到原本載入的檔案** ✗（＝使用者看到的「退回原始頁」）。
**修正**：`applyVersion()` 一開始就清掉本頁檔案狀態（`setTables(null)`／`setFileName("")`）——
選專案＝取代本頁檔案，與 `loadFile()` 反向清除 `projectTables` 對稱。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 載入專案／版本後，發佈時帶上剛套用的 `tasks` | `src/pages/GanttPage.jsx` |
| 2 | mirror effect 分支 (3) 只鏡射 **peer page（Explorer）** 的發佈 | 同上 |
| 3 | Explorer 選專案／版本時清除本頁載入的檔案（`tables`／`fileName`） | `src/pages/DataExplorerPage.jsx` |
| 4 | 批次 59 回歸測試（tasks 發佈、分支來源守門、選專案清除本頁檔案） | `scripts/smoke-test.mjs` |

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`A fresh project load is never reverted by stale programme data (batch 59): FAILED (tasks=false, mirror=false, pickWins=false)` ✓
2. **GREEN**：**105 OK / 0 FAILED**（104 + 新增 1）、`eslint` 0 error、`vite build` exit 0 ✓

**RTM（批次 59）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-5901 | 載入專案／版本後，共用狀態必須立即同步該專案的 `tasks`（不得留下前一份 programme） | GanttPage `handleProjectLoaded` | 使用者回報點專案後閃退回原始頁 | Fixed |
| FR-5902 | mirror effect 的「沿用儲存任務」分支只可鏡射 peer page 的發佈 | GanttPage mirror effect (3) | 同上 | Fixed |
| FR-5903 | Explorer 選專案／版本時，本頁先前載入的檔案必須讓位（清除），不得蓋回畫面 | DataExplorerPage `applyVersion` | 同上 | Fixed |
| AC-5901 | 批次 59 斷言紅→綠；煙霧測試 105 OK / 0 FAILED、eslint 0 error、build exit 0 | 量測（2026-09-22） | — | Verified |

---

## 🔁 批次 60（2026-09-22）— 共用 programme 必須撐得住「重新載入 / 重新掛載」

### 為什麼會「退回原始頁」的第二條路徑
`writePersistedProgramme()` 舊行為：

```js
const text = String(programme.text || "");
if (text.length > MAX_PERSISTED_TEXT) return false;   // ← 直接放棄，什麼都沒寫 ✗
```

只要檔案原文超過 2 MB，就**連 `projectId`／`versionId`／`fileName` 都不寫** ✗。
於是任何「重新載入」或「路由被卸載再掛回」（例如 `AuthProvider` 檢查期間顯示 spinner，
`AuthenticatedApp` 會整段 unmount ✓）之後：

- Gantt：`sharedProgramme?.tasks` 為空 → 回到內建 `DEFAULT_TASKS`（＝使用者眼中的「原始頁」）✗
- Explorer：沒有 `projectId` 可自我修復 → 只能靠 adopt 最新專案（若後端沒資料就是空狀態）✗

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | `writePersistedProgramme()` 改為：**metadata 一定寫**；`tasks` 在 `MAX_PERSISTED_TASKS`（1.5 MB）內就寫；`text` 在 2 MB 內才寫。回傳值仍代表「**text 是否寫入**」，維持既有契約 | `src/lib/programmeStore.jsx` |
| 2 | 新增常數 `MAX_PERSISTED_TASKS = 1536 * 1024` | 同上 |
| 3 | 批次 60 回歸測試（大 text 仍保留 project/version/tasks；小 text 正常；tasks 過大時略過但 metadata 保留） | `scripts/smoke-test.mjs` |

### 效果
- 重新載入 / 重新掛載後，Gantt **直接回到同一份 programme**（不再先閃 `DEFAULT_TASKS`）✓
- Explorer 由持久化的 `projectId`／`versionId` 還原同一專案／版本（配合批次 51/52/54）✓
- 大量資料時仍不會撐爆 localStorage（tasks 1.5 MB、text 2 MB 兩道守衛）✓

### 驗證
**GREEN：106 OK / 0 FAILED**（105 + 新增 1）、`eslint` 0 error、`vite build` exit 0 ✓
（註：此批與批次 59 同批交付；批次 49 既有的「大 text 回傳 false」斷言仍為綠 ✓）

**RTM（批次 60）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-6001 | 檔案原文過大時，metadata（projectId／versionId／fileName）仍必須持久化 | `writePersistedProgramme` | 使用者回報點專案後閃退回原始頁 | Fixed |
| FR-6002 | 解析後的 `tasks` 必須持久化（≤1.5 MB），使重新載入／重新掛載回到同一 programme | `MAX_PERSISTED_TASKS` | 兩邊頁面完整展示 | Fixed |
| NFR-6001 | 兩道獨立大小守衛（tasks 1.5 MB、text 2 MB），任一超限不影響其他欄位 | 同上 | Storage quota safety | Verified |
| AC-6001 | 批次 60 斷言：大 text 仍保留 project/version/tasks、小 text 正常、超大 tasks 被略過但 metadata 保留 | 量測（2026-09-22） | — | Verified |
| AC-6002 | 煙霧測試 106 OK / 0 FAILED、eslint 0 error、build exit 0 | 量測（2026-09-22） | — | Verified |

---

## 🗂️ 批次 61（2026-09-22）— Data Explorer 預設開啟 `PROJECT`

### 使用者需求
「data-explorer 中，預設優先顯示 PROJECT 頁的內容」

### 問題
`TableBrowser` 的預設選取是 `index[0]`（`buildTableIndex` 依字母排序）✗。
真實 XER 有 15 張表，`APPLYACTOPTIONS` 排在 `PROJECT` 前面 → 一開頁看到的是沒人看的表 ✗。

### 修正
| # | 內容 | 位置 |
|---|------|------|
| 1 | 新增純函式 `defaultTableName(index)`：有 `PROJECT`（不分大小寫，故 P6 XML 的 `Project` 也適用）就回它，否則回索引第一張表；空索引／`null` 回 `null` | `src/lib/dataExplorer.js` |
| 2 | `TableBrowser` 以 `fallbackName = defaultTableName(index)` 決定預設選取：使用者既有選擇（`activeName`）優先 → 否則預設表 → 否則第一張 | `src/components/dataexplorer/TableBrowser.jsx` |
| 3 | 批次 61 回歸測試（真實字母序、XML 大小寫、無 PROJECT 的檔案、空輸入、瀏覽器接線） | `scripts/smoke-test.mjs` |

### 行為
- 開檔／切專案／切版本後，若目前選取的表格不存在，就落在 `PROJECT`（而不是 `APPLYACTOPTIONS`）✓
- 使用者手動選過的表在切換資料來源時仍會保留（同名表存在時）✓
- 檔案沒有 `PROJECT`（例如只有 `TASK`）→ 維持字母序第一張（不會空白）✓

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：`The Explorer opens on PROJECT by default (batch 61): FAILED: TypeError: lib.defaultTableName is not a function` ✓（其餘 106 OK）
2. 期間修正了一條**測試期望寫錯**（無 PROJECT 時的 fallback 是字母序第一張 `CURRTYPE`，不是 `TASK`）✓
3. **GREEN**：**107 OK / 0 FAILED**（106 + 新增 1）、`eslint` 0 error、`vite build` exit 0 ✓

**RTM（批次 61）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-6101 | Data Explorer 預設必須顯示 `PROJECT` 表（存在時），不得落在字母序第一張 | `defaultTableName()` ＋ TableBrowser | 使用者要求預設顯示 PROJECT | Complete |
| FR-6102 | 無 `PROJECT` 的檔案必須退回第一張表（不得空白） | 同上 | 同上 | Complete |
| NFR-6101 | 大小寫不敏感（P6 XML 的 `Project` 亦適用）；空索引／`null` 安全 | `defaultTableName()` | — | Verified |
| AC-6101 | 真實字母序 fixture（APPLYACTOPTIONS/CALENDAR/CURRTYPE/PROJECT/TASK）→ 選中 `PROJECT` | 量測（2026-09-22） | — | Verified |
| AC-6102 | 煙霧測試 107 OK / 0 FAILED、eslint 0 error、build exit 0 | 量測（2026-09-22） | — | Verified |

---

## 📦 批次 62（2026-09-22）— 打包成單一獨立 `P6ReaderConverter.exe`

### 使用者需求
「將該程序的所有相關功能、內容、插件、資料、數據，全部打包生成一個獨立的 exe 程序文件」

### 做法（單檔 exe，免 Node／免 Python／免 Docker）
| 步驟 | 內容 |
|---|---|
| 1 | 前端 `vite build` → `dist/`，由 FastAPI 託管（SPA fallback，`/data-explorer` 硬重新整理可用） |
| 2 | 單一埠同時提供：UI、`/local-api/*`（＋裸路徑 `/projects/*` 供開發對照）、`/api/*`（**反向代理到 Base44 雲端**，取代 Vite plugin） |
| 3 | PyInstaller onefile 入口＝啟動器：挑埠、設資料目錄、開瀏覽器、偵測 OCR 插件 |
| 4 | SQLite 落在使用者資料夾（`%LOCALAPPDATA%\\P6ReaderConverter\\db`），**不寫入 exe 內部** |

### 新增／修改
| 檔案 | 內容 |
|---|---|
| `backend/desktop_server.py`（新） | 桌面版 FastAPI：UI 靜態託管＋SPA fallback、`/local-api` 與裸路徑雙掛載、`/api/{path}` → Base44 反向代理（httpx，過濾 hop-by-hop 標頭、雲端不可達回 502 不影響 UI） |
| `desktop/app_launcher.py`（新） | 入口：`--port`（預設 27815，佔用則退空閒埠；固定埠讓 localStorage 跨次保存）、`--data-dir`、`--no-browser`；啟動時印出位址／資料夾／OCR 插件狀態 |
| `desktop/p6reader.spec`（新） | PyInstaller onefile spec：`frontend/`（含 11.4 MB CJK 字型）＋ hidden imports（uvicorn 各實作、aiosqlite、SQLAlchemy dialect、multipart、httpx、openpyxl、routers、parsers）＋ 排除 tkinter/numpy/pandas/matplotlib |
| `scripts/build-exe.bat`（新） | 一鍵建置（前端 → PyInstaller → 產物路徑） |
| `backend/database.py` | 新增 `P6_DB_PATH`（**dotenv 無法覆蓋**）作為打包版權威 DB 位置；開發版行為不變（`backend/db` 或 `DATABASE_URL`） |
| `backend/requirements.txt`／`pyproject.toml` | 新增 `httpx`（執行期 `/api` 代理用） |
| `.gitignore` | 排除 `/desktop/build/`、`/desktop/dist/`（exe 以 release asset 發佈，不進 git） |
| `doc/DESKTOP.md`（新） | 建置／執行／旗標／資料位置／插件／限制 |

### 驗證（實測產物，非推論）
```
exe                     : desktop\dist\P6ReaderConverter.exe  27.7 MB（單檔）
build                   : PYI_EXIT=0（Build complete!）
啟動 banner             : Address http://127.0.0.1:27898 / Data folder …\p6exe-test / UI bundle: bundled
                          OCR: PP-OCR helper available / PST-OCR available / Ollama available
HTTP（由 exe 提供）      : /health 200 · / 200（1.5 KB index.html）· /data-explorer 200（SPA fallback）
                          /local-api/projects 200 · /fonts/NotoSansHK-VF.ttf 200（11.4 MB CJK 字型）
/api 代理                : 對 Base44 上游回傳 404（＝已正確轉發，非本機 404 JSON）
寫入測試                 : POST /local-api/projects 200 → 建立成功並可列出（list count 1）
資料落地                 : exe 資料夾 DB 建立並寫入（mtime 15:45:51）
                          ★ 開發用 backend\db\pyworkflow.db 完全未被觸碰（仍為 15:26:27）
回歸                     : 煙霧測試 107 OK / 0 FAILED（前端無回歸）
```

### 明確不在 exe 內（外部已安裝工具，啟動時偵測）
PP-OCR helper `:8199`、PST-OCR `:7861`、Ollama `:11434`（使用者自行安裝／由工作區 `scripts\start-all` 啟動）；
缺乏時 OCR 匯入路徑降級，其餘功能不受影響。需要連線者僅 `/api`（Base44 登入、雲端 LLM 圖片匯入、Feedback）。

**RTM（批次 62）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-6201 | 提供單一獨立 Windows exe，內含 UI／後端／解析器／字型，免安裝 Node、Python | `desktop/p6reader.spec` ＋ `scripts/build-exe.bat` | 使用者要求打包成獨立 exe | Complete |
| FR-6202 | exe 以單一埠提供 UI、`/local-api` 與 `/api`（代理至 Base44） | `backend/desktop_server.py` | 同上 | Complete |
| FR-6203 | 專案資料必須存在使用者資料夾，不寫入 exe；開發環境 DB 不受影響 | `desktop/app_launcher.py` ＋ `P6_DB_PATH` | 使用者要求「資料、數據」一併打包可用 | Complete |
| FR-6204 | 啟動器需顯示位址、資料夾與 OCR 插件可用狀態 | `app_launcher.py` banner | 插件狀態可視 | Complete |
| NFR-6201 | 埠可設定且預設固定（27815），佔用時自動退空閒埠（保 localStorage 狀態） | `pick_port()` | 使用體驗 | Complete |
| NFR-6202 | exe 產物不進 git（release asset），建置可重複 | `.gitignore` ＋ spec | 版本庫衛生 | Complete |
| AC-6201 | 產物 27.7 MB 單檔；`/health`、`/`、`/data-explorer`、`/local-api`、字型皆 200；`/api` 正確代理 | 實機量測（2026-09-22） | — | Verified |
| AC-6202 | 經 exe 建立專案成功，資料寫入 exe 資料夾；開發用 DB 未被觸碰 | 實機量測（2026-09-22） | — | Verified |
| AC-6203 | 煙霧測試 107 OK / 0 FAILED、前端建置 exit 0 | 量測（2026-09-22） | — | Verified |

---

## 📅 批次 63（2026-09-22）— CALENDAR 改為 Calendars 檢視（對齊 xerviewer.org）

### 使用者需求
「參考 xerviewer.org 的 Calendars，對 data-explorer 的 CALENDAR 顯示模式進行更新」
（並附上參考站的卡片清單與點開後明細的實際 HTML）

### 資料來源（真實檔實證）
P6 把整個日曆定義放在**一個欄位** `CALENDAR.clndr_data`，語法為巢狀括號：

```
(0||CalendarData()(
   (0||DaysOfWeek()( (0||1()( (0||0(s|07:00|f|17:00)()) ) … (0||7()( … ) ))
   (0||VIEW(ShowTotal|Y)())
   (0||Exceptions()( (0||0(d|40179)()) … ) ))
```

- 星期鍵 **1 = 週日 … 7 = 週六** → 「6d/week」日曆的 day 1 無時段（週日休息 ✓，與 `week_hr_cnt=60` 相符 ✓）
- 例外是 **P6/OLE 日期序號**：`40179 → 2010-01-01` ✓（與參考站 January 2010 的 1/1 假期一致 ✓）
- 例外若帶自己的時段（`s|`/`f|`）＝ **working exception**（即參考站圖例第 4 種狀態 ✓）
- 本檔實測：`7d/w x10` 7×10h／24 假期；`Working Day(6d/week)-updated` 週日休息／6 日／**126 假日** ✓
- `parseXerTables()` 保留所有欄位（無白名單 ✓），因此 `clndr_data` 完整進入 Explorer ✓

### 實作
| 檔案 | 內容 |
|---|---|
| `src/lib/calendarView.js`（新） | 純函式：`p6SerialToISO`、`periodsIn`、`periodText`、`workWeekFromClndrData`、`exceptionsFromClndrData`、`calendarSummary`、`calendarsFromRows`、`monthGrid`、`exceptionsInMonth`、`monthLabel` |
| `src/components/dataexplorer/CalendarBrowser.jsx`（新） | 卡片清單（數量說明＋「Filter calendars...」＋每卡：名稱／`Default` 徽章／類型 Base·Project·Rsrc／**h/day · work days/wk · holidays**）＋ `CalendarDialog`（週工時 7 格含時段 tooltip、月份導覽 `« ‹ › »`、月曆格 4 種狀態、圖例、該月例外清單 `Fri, 01 Jan 2010 · Non-working (holiday)`） |
| `src/components/dataexplorer/TableBrowser.jsx` | `CALENDAR`（不分大小寫，含 P6 XML 的 `Calendar`）改走 `CalendarBrowser`；其餘表維持資料格 |
| `scripts/smoke-test.mjs` | 批次 63 兩組回歸測試（真實 `clndr_data` 解析 ＋ UI 渲染＋palette 守門） |

### 配色（Common Look and Feel，light-only）
參考站用 slate/blue/rose/sky ✗（本專案禁用），改以調色盤 ＋ 透明度修飾：
工作日 `bg-surface`／非工作日 `bg-surface-muted`＋`text-text-muted`／**假期 `bg-danger/10` ＋ `bg-danger` 圓點**／
**工作例外 `bg-primary/10` ＋ `bg-primary` 圓點**／月外日期 `opacity-40`（與參考站一致 ✓）✓

### 驗證（TDD：先 RED 再 GREEN）
1. **RED**：兩項檢查皆 `Failed to load url /src/lib/calendarView.js` ✓（其餘 107 OK）
2. 過程中修正兩條**測試期望寫錯**：`40329` 實為 `2010-05-31`（非 06-30）；7 日曆的週六本來就是工作日，非工作日必須用 6 日曆的**週日**（2010-01-03）驗證 ✓
3. **GREEN**：**109 OK / 0 FAILED**（107 ＋ 新增 2）、`eslint` 0 error、`vite build` exit 0 ✓
4. 真實檔端對端：5 個日曆 → 卡片統計全部正確、January 2010 假期清單 ✓

**RTM（批次 63）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-6301 | CALENDAR 以卡片清單呈現（名稱／Default／類型／h/day／work days/wk／holidays）＋篩選 | `CalendarBrowser` | 使用者要求對齊 xerviewer.org | Complete |
| FR-6302 | 點卡片顯示週工時、可導覽月曆（工作日／非工作日／假期／工作例外）與該月例外清單 | `CalendarDialog` ＋ `monthGrid` | 同上 | Complete |
| FR-6303 | 必須解析 `clndr_data`（1=週日、Exceptions 為 P6 序號、帶時段者為工作例外） | `calendarView.js` | 忠實呈現 P6 資料 | Complete |
| NFR-6301 | 僅用 CLF 調色盤（禁用 slate/blue/gray/`dark:`） | `STATUS_STYLES`／palette 守門 | Common Look and Feel | Verified |
| AC-6301 | 真實檔 5 個日曆：7×10h／24 假期、6 日／126 假日、Sun 休息、January 2010 假期 | 實機量測（2026-09-22） | — | Verified |
| AC-6302 | 煙霧測試 109 OK / 0 FAILED、eslint 0 error、build exit 0 | 量測（2026-09-22） | — | Verified |

---

## 🌐 批次 64（2026-09-22）— 前後端重啟 ＋ 前端全面英文化

### 使用者需求
1. 重啟所有啟動中的前後端
2. 檢查完整前端內容，所有使用中文的內容改為英文顯示

### 1. 服務重啟（依 AGENTS.md：一律用腳本，不直接跑 uvicorn/vite）
```
scripts\stop-all.bat   →  killing frontend PID 30776 on port 15156
                          killing backend  PID 10816 on port 25156
scripts\start-all.bat  （NO_BROWSER=1；腳本自行讀 .env 的 15156 / 25156）
驗證：http://localhost:15156/ 200、/data-explorer 200、http://localhost:25156/health 200
```

### 2. 中文盤點（先量測，後動手）
| 項目 | 數量 |
|---|---|
| 含中文的檔案 | 17 |
| 可見文字行（strings / JSX） | 64 |
| 註解行 | 11 |
| 唯一中文詞 | 109 |
| 後端 `backend/` 含中文行 | **0**（無需處理 ✓） |

**關鍵辨識**：`繚`（U+7E5A）不是中文 ✗ — 它是 `•`／`·` 分隔符被錯誤編碼後的 mojibake ✓
（出現在 `Excel 繚 XER 繚 XML …` 這類字串 ✓）→ 統一修回 `·`（11 處 / 4 檔 ✓）。

### 3. 翻譯
| 檔案 | 內容 |
|---|---|
| `ProjectBar.jsx` | 21 處：錯誤訊息、`alert`、按鈕（Upload／Save）、tooltip、`New project name…`、`No projects yet`、`N versions`、`Delete project` |
| `GanttInfoPanel.jsx` | 5 處提示（資源指派／活動代碼／NOTEBOOK／未選活動） |
| `LocalOcrSettings.jsx` | OCR 狀態字串（模型數、每頁秒數） |
| `ExportDialog.jsx` | PDF 標記說明 ＋ `·` 分隔符 |
| `WbsSettingsPanel.jsx` | WBS 層級摘要 → `WBS levels: 3 (L1 184 · L2 4 · L3 3 groups) · showing 191 group headings` |
| `GlobalSettingsPanel.jsx` | `Drag to resize` |
| `hkWorkingDays.js` | 假期來源 → `Labour Department website (updated …)`（日期改 `en-GB`）、`Local backup data` |
| `localApi.js` | `BACKEND_HINT` 全英文 ＋ `isBackendDown()` 改比對英文訊息 |
| `CompareDialog.jsx`／`SnapshotManager.jsx`／`UnifiedGanttLayout.jsx` | `繚` → `·` |
| 註解英文化 | `ImportStatusPanel`／`XerMappingDialog`／`ProjectBar`／`localOcr`／`wbsLevel`／`ImageImportDialog`／`BulkEditBar`（色名） |

**刻意保留中文（非顯示、純功能）**：`ImageImportDialog.jsx` 14 行與 `wbsLevel.js` 1 行的**正則**含中文 ✓ —
用於**辨識**匯入圖面的中文欄名（開始／結束／完成／工序／工程／項目／活動／內容／事項／代號／代碼／編號／序號）
與中文 WBS 代碼（`第1章` 樣式）；改了會讓中文來源的圖面無法匯入 ✗，且這些字串**永不顯示** ✓。

### 4. 驗證
```
中文掃描（批次前）：17 檔 / 64 可見行 / 11 註解行
中文掃描（批次後）：15 行、全部為 CODE 且位於正則內；註解 0、顯示文字 0
煙霧測試：110 OK / 0 faults（新增批次 64 守門測試）
ESLint 0 error ／ vite build exit 0
服務：/ 200、/data-explorer 200、/health 200；後端 0 處中文
```

**RTM（批次 64）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-6401 | 前端所有顯示文字必須為英文（JSX、字串、tooltip、`alert`、`placeholder`、狀態列） | 17 個前端檔案 | 使用者要求「所有使用中文的內容改為英文顯示」 | Complete |
| FR-6402 | 程式註解同步英文化（避免混語） | 同上（7 檔） | 同上 | Complete |
| FR-6403 | 前後端服務必須以腳本重啟並確認可用 | `scripts\stop-all.bat`／`start-all.bat` | 使用者要求重啟 | Verified |
| NFR-6401 | 辨識用正則（中文欄名／中文 WBS 代碼）不得改動，且永不顯示 | `ImageImportDialog.jsx`／`wbsLevel.js` | 功能不得退化 | Verified |
| NFR-6402 | 以自動掃描守門，防止中文再次進入顯示文字 | 煙霧測試批次 64 | 長期一致性 | Verified |
| AC-6401 | 掃描結果：顯示文字 0、註解 0、僅 15 行功能正則含中文 | 量測（2026-09-22） | — | Verified |
| AC-6402 | 煙霧測試 110 OK / 0 faults、eslint 0 error、build exit 0、三個端點 200 | 量測（2026-09-22） | — | Verified |

---

## 📦 批次 65（2026-09-22）— 重新打包 exe（含 Calendars ＋ 英文介面）並驗證「可直接轉發到其他電腦」

### 使用者需求
1. 更新 exe 程式
2. 確保該 exe 可以直接轉發到其他電腦上直接啟用

### 1. 重新打包
```
1) 前端重建（含批次 63 Calendars ＋ 批次 64 英文介面）
   vite build → exit 0；dist = 13.9 MB / 10 files
   靜態檢查：No projects yet ✓、Filter calendars ✓、Choose a project ✓、WBS levels: ✓
2) PyInstaller
   首次失敗：PermissionError WinError 5（OneDrive 鎖住 desktop\build\p6reader\localpycs）
   → 改以 OneDrive 之外的 workpath（%TEMP%\p6build65）打包，成功
   → desktop\dist\P6ReaderConverter.exe（27.7 MB，16:15:36）
```

### 2. 可攜性驗證（模擬「複製到另一台電腦」）
| 驗證 | 做法 | 結果 |
|---|---|---|
| 不依賴本 repo／工作目錄 | 把 exe 複製到 `%TEMP%\p6-transfer\`，以**該資料夾**為工作目錄啟動 | `UI bundle: bundled` ✓ |
| 全新資料夾 | `--data-dir <scratch>\mydata`（全新） | `db\pyworkflow.db` 在該處建立 ✓ |
| UI | `/` 200（1.5 KB index.html）、`/data-explorer` 200（SPA fallback） | ✓ |
| 內建 UI 是**最新版** | 取 `assets/index-CBB2ERyV.js`（1.8 MB）檢查字串 | `No projects yet`／`Filter calendars`／`Choose a project`／`WBS levels:`／`Working exception` 皆 ✓；**中文 `建立專案失敗` 不存在 ✓** |
| 資源 | `/fonts/NotoSansHK-VF.ttf` | 200、11.4 MB ✓ |
| API 與寫入 | `POST /local-api/projects` → 再列出 | 建立成功、清單遞增 ✓ |
| `--data-dir` 真的生效 | 比對兩顆 DB 內容 | scratch DB 3 筆（＝本次 POST）、`%LOCALAPPDATA%\P6ReaderConverter` 0 筆 ✓ |
| 無本機綁定字串 | 掃描 exe 內容（Buffer 搜尋） | `ken.li` / `Vibe Code Challenge` / `OneDrive` / `C:\dev\paddle-ocr` 全部 **0** ✓ |

### 3. 文件
`doc/DESKTOP.md` 新增 **「Forward it to another computer」** 章節：單檔複製即可、系統需求
（Windows 10/11 x64、`/api` 相關功能需連網、OCR 為外部工具、埠可自動退讓）、新機 30 秒自檢、
SmartScreen 未簽章提醒、以及「連同專案一起搬」的做法（複製 `db` 資料夾 ＋ `--data-dir`）✓

**RTM（批次 65）**

| Requirement ID | Requirement Description | Feature/Module | User Story Reference | Status |
|----------------|-------------------------|----------------|----------------------|--------|
| FR-6501 | exe 必須重新打包，內含最新前端（Calendars 檢視 ＋ 全英文介面） | `scripts/build-exe.bat` ＋ `desktop/p6reader.spec` | 使用者要求更新 exe | Complete |
| FR-6502 | exe 必須可單檔複製到其他電腦直接執行，不依賴本 repo／Python／Node | `desktop/app_launcher.py` | 使用者要求可直接轉發 | Verified |
| FR-6503 | 資料必須落在使用者資料夾，且 `--data-dir` 可帶著專案一起搬 | `P6_DB_PATH` ＋ launcher | 同上 | Verified |
| NFR-6501 | 打包流程不得被 OneDrive 檔案鎖阻斷 | build script 以 OneDrive 之外的 workpath | 可重複建置 | Complete |
| NFR-6502 | exe 內不得含本機路徑／使用者名稱等功能性字串 | PyInstaller datas＝相對路徑 | 可攜性 | Verified |
| AC-6501 | 複製到 scratch 資料夾、不同工作目錄啟動：UI／API／字型／寫入全部正常，內建 UI 為最新版 | 實機量測（2026-09-22） | — | Verified |
| AC-6502 | 產物 27.7 MB；`--data-dir` 生效（scratch DB 有資料、預設資料夾 0 筆） | 實機量測（2026-09-22） | — | Verified |
