# chronos-flow-chunwo — 現行版本功能總覽 × Base44 參考版本對照報告

> 產出日期：2026-09-21
> 對照標的
> - **現行版（WS）**：`P6 Reader & Converter\Baes44\chronos-flow-chunwo`（＋同一 workspace 的 `backend\`、`scripts\`、`doc\`）
> - **參考版（REF）**：`C:\Users\ken.li\Downloads\chronos-flow-chunwo`（Base44 雲端專案的乾淨匯出）
> 資料來源：兩份檔案樹逐檔 MD5 比對、逐行 `Compare-Object` 差異、`doc\requirements.md`（批次 1–22、313 筆 RTM）、`scripts\smoke-test.mjs` 實測結果。

---

## 0. 摘要（TL;DR）

| 項目 | 參考版（REF） | 現行版（WS） |
|------|---------------|--------------|
| 檔案數（不含 node_modules/dist） | 113 | 133 |
| 佔用大小 | 1.3 MB | （含新增功能與 CLF，約 1.6 MB） |
| 架構 | 純前端 + Base44 雲端（LLM／functions） | 同上 **＋ 本機 FastAPI + SQLite**（專案／版本儲存） |
| 啟動方式 | `npm run dev`（手動） | `scripts\start-all.bat`（讀 workspace `.env`、就緒後自動開瀏覽器、後端 opt-in） |
| 自動化測試 | 無 | `scripts\smoke-test.mjs`（SSR 煙霧測試，全表 0 FAILED）+ `xer-loss-audit.mjs`（XER 缺漏稽核） |
| 主題 | Tailwind 預設色（slate/blue/green/red…） | **Common Look and Feel（CLF）** 單一淺色調色盤（`#005a53` / `#733208` / `#333333` / `#f7f7f7`…） |
| 檔案比對結果 | — | **完全相同 63 檔、變更 49 檔、移除 1 檔、新增 21 項** |

**一句話總結**：現行版＝參考版（Base44 原版）＋**13 個功能批次**（設定面板、WBS 配色與分組、Quick Filters、記錄日期、Filter Activities 範本、Time Scale、PDF 預覽、XER 零遺漏直通、PDF 內嵌資料 V3、資訊面板重寫、PDF OCR 修正）＋**本機化基礎**（FastAPI/SQLite、啟動腳本、煙霧測試）＋**CLF 全站換色**。

---

## 1. 兩份內容的身分

### 1.1 參考版（`C:\Users\ken.li\Downloads\chronos-flow-chunwo`）

Base44 平台的專案匯出，`README.md` 內容即為 Base44 樣板：

```
**Welcome to your Base44 project**
View and Edit your app on [Base44.com](http://Base44.com)
1. Clone the repository using the project's Git URL
4. Create an `.env.local` file and set the right environment variables
   VITE_BASE44_APP_ID=your_app_id
   VITE_BASE44_APP_BASE_URL=your_backend_url
Run the app: `npm run dev`
```

- 只有 `src\`、`base44\`、根設定檔（**無** `node_modules`、`dist`、`scripts`、`backend`、`doc`）。
- 認證與雲端整合仍在：`src\lib\AuthContext.jsx`、`src\components\{AuthLayout,ProtectedRoute,UserNotRegisteredError}.jsx`、`src\api\base44Client.js`、`base44\functions\fetchHKHolidays\entry.ts`（Deno function，抓香港勞工處假期）。
- `package.json`：`"name": "base44-app"`，`dev: vite`、`lint: eslint . --quiet`、`typecheck: tsc -p ./jsconfig.json`；相依含 `@base44/sdk ^0.8.48`、`@base44/vite-plugin ^1.0.40`、shadcn/radix 全套、`jspdf`、`pdfjs-dist`、`tesseract.js`、`xlsx`、`recharts`、`three`、`@stripe/*` 等。

### 1.2 現行版（`Baes44\chronos-flow-chunwo` + workspace）

- 保留上述全部 Base44 檔案（**63 檔與參考版位元組完全相同**），並在其上加功能與換色。
- 同一 workspace 多了三個「本機化」區塊：

```
P6 Reader & Converter\
├── .env                    FRONTEND_PORT=15156 / BACKEND_PORT=25156 / VITE_BACKEND_URL
├── backend\                FastAPI + SQLAlchemy + SQLite（uv 管理）
│   ├── main.py             FastAPI(title="P6 Reader & Converter — local backend")
│   ├── routers\projects.py, routers\versions.py
│   ├── parsers\xer_parser.py, p6xml_parser.py, excel_parser.py
│   ├── db\pyworkflow.db    SQLite（專案／版本）
│   └── .env                DATABASE_URL=sqlite+aiosqlite:///./db/pyworkflow.db
├── scripts\                start-all / start-frontend / start-backend / stop-all / status（.bat + .sh）+ smoke-test.mjs
├── doc\requirements.md     批次 1–22 需求、RTM（313 列）、驗收證據
└── Baes44\chronos-flow-chunwo\
    ├── scripts\            start-local.bat / stop-local.bat / smoke-test.mjs / xer-loss-audit.mjs
    └── src\                應用本體
```

---

## 2. 檔案層級差異（MD5 逐檔比對）

| 分類 | 數量 | 說明 |
|------|------|------|
| 完全相同 | **63** | Base44 基礎建設、多數 shadcn UI、`hkWorkingDays.js`、`parsePLF.js`、`AuthContext.jsx`… |
| 內容變更 | **49** | 功能新增、CLF 換色、設定變更（見 2.3） |
| 僅存在於參考版（移除／改名） | **1** | `src\components\gantt\ActivityInfoPanel.jsx` |
| 僅存在於現行版（新增） | **21 項** | 見 2.1 |

### 2.1 新增（僅現行版）

| 路徑 | 大小／行數 | 用途 |
|------|-----------|------|
| `src\lib\displaySettings.js` | 23.2 KB / 500 | 顯示設定模型（日期格式、網格、長條、標籤、WBS 配色／分組）＋ localStorage 持久化 |
| `src\lib\quickFilters.js` | 9.6 KB / 223 | Quick Filters 判定、徽章數學、Last Recalc Date as-at 語意 |
| `src\lib\localApi.js` | 3.3 KB / 92 | 本機 FastAPI（`/local-api`）客戶端：專案／版本 |
| `src\components\gantt\GlobalSettingsPanel.jsx` | 9.1 KB / 215 | xerviewer 式統一設定面板（5 分類軌） |
| `src\components\gantt\GanttSettingsPanel.jsx` | 17.6 KB / 334 | Timeline & Grid／Gantt Bars／Structure（可 `embedded`） |
| `src\components\gantt\WbsSettingsPanel.jsx` | 18.2 KB / 289 | WBS 階層配色＋Customise Grouping |
| `src\components\gantt\GanttInfoPanel.jsx` | 27.3 KB / 619 | 活動資訊面板（取代 `ActivityInfoPanel.jsx`，功能擴充） |
| `src\components\gantt\ProjectBar.jsx` | 11.3 KB / 272 | 專案管理（選擇／上傳／存檔／刪除） |
| `src\components\gantt\QuickFilterMenu.jsx` | 7.9 KB / 172 | 漏斗按鈕＋徽章＋7 pills＋Last Recalc Date＋Custom／Clear |
| `src\components\gantt\PdfPreviewDialog.jsx` | 3.8 KB / 99 | PDF 匯出前預覽（Print Preview） |
| `scripts\smoke-test.mjs`（app 內） | 65.2 KB / 1123 | SSR 煙霧測試（全表 0 FAILED） |
| `scripts\xer-loss-audit.mjs` | 11.9 KB / 160 | XER 匯出缺漏稽核工具 |
| `scripts\start-local.bat` / `stop-local.bat` | 1.5 KB / 1.0 KB | 應用本體啟停（繞開路徑含 `&` 的 npm shim 問題） |
| `.env.local` | 110 B / 2 | `VITE_BASE44_APP_ID=6a38f8c8aae6ce8a8b2b1096`、`VITE_BASE44_APP_BASE_URL=https://chronos-flow-chunwo.base44.app` |
| `common-look-and-feel.json` | 22 B / 1 | CLF 前端政策檔 |
| `API Documentation\`（cURL／JS Fetch／JS SDK／Python） | 3.6～4.2 KB ×4 | Base44 API 呼叫範例（參考用） |
| `JS SDK.txt` | 0 B | 空檔（暫存） |

> workspace 根目錄另有（不屬於 REF 範圍）：`backend\`（FastAPI）、`scripts\start-all.bat` 等 5 組腳本、`doc\requirements.md`、`.env`、`AGENTS.md`。

### 2.2 移除／改名

| 參考版 | 現行版 | 處置 |
|--------|--------|------|
| `src\components\gantt\ActivityInfoPanel.jsx`（368 行） | `src\components\gantt\GanttInfoPanel.jsx`（619 行） | **改名＋大幅擴充**（批次 5：分頁式資訊面板、資源／關係／代碼／Notebook），`GanttPage.jsx` 的 import 同步改為 `GanttInfoPanel` |

### 2.3 變更檔案（49 檔，依「功能影響」排序）

**A. 功能新增／重寫（行數明顯變化）**

| 檔案 | 參考版 → 現行版 | 主要變動 |
|------|-----------------|----------|
| `src\pages\GanttPage.jsx` | 1162L → **1337L** | 統一設定面板、Quick Filters、Last Recalc Date、ProjectBar、`xerSource` 串接、Display/Tools 大整理 |
| `src\components\gantt\UnifiedGanttLayout.jsx` | 1835L → **2027L** | `TIME_SCALES`（6 模式）＋Auto、`resolveTimeScale()`、`displaySettings` 接入（網格／長條／標籤／WBS 列樣式） |
| `src\components\gantt\FilterBar.jsx` | 533L → **725L** | 批次 22：Filter Activities（範本／Match／衍生欄位／Status 修正） |
| `src\components\gantt\ExportDialog.jsx` | 1121L → **1295L** | PDF 欄位選擇、匯出前預覽接線、XER 直通選項、CLF |
| `src\lib\exportGanttPDF.js` | 662L → **863L** | PDF 依所選欄目輸出、長條／標籤設定套用、CLF 色 |
| `src\lib\buildRelationshipMap.js` | 105L → **170L** | 新增 `buildRelationshipDetails()`（含 type／lag） |
| `src\lib\exportP6XML.js` | 488L → **524L** | 多重關係（`links[]`／`linkSuccCode`）與 lag 匯出 |
| `src\lib\exportXER.js` | 1014L → **962L** | 直通模式 `buildXERPassThrough()`（`sourceTables` + `_originalXerData` + `_originalWbsData`） |
| `src\lib\ganttPDFData.js` | 142L → **116L** | `GANTT_DATA_V3`（gzip）＋ V2 相容解碼 |
| `src\lib\parseXER.js` | 331L → **326L** | `parseXerTables()` 保留原表、WBS 攤平帶 `sectionLevel`／`_originalWbsData` |
| `src\components\gantt\ImageImportDialog.jsx` | 1607L → **1638L** | 掃描 PDF：不再跳過第 1 頁、渲染解析度提高（批次 6／7） |
| `src\components\gantt\ColumnVisibilityPanel.jsx` | 270L → **278L** | `embedded` 模式（供統一設定面板內嵌）、CLF |
| `src\components\gantt\ExportXERDialog.jsx` | 134L → **137L** | 預設值改由來源 XER 帶入（`last_recalc_date`／`proj_short_name`／根 WBS） |
| `src\vite.config.js` | 20L → **43L** | 讀 workspace `.env` 的 `FRONTEND_PORT`／`BACKEND_PORT`、`strictPort`、`/local-api` proxy |
| `src\index.css` | 108L → **120L** | CLF CSS 變數（`--color-primary #005a53` 等） |
| `tailwind.config.js` | 89L → **111L** | CLF palette（`text.DEFAULT #333333`、`surface.*`、`primary.dark/active`、`accent.accessible/selected`…） |

**B. 純 CLF 換色／小幅修正（無功能變化）**

`src\App.jsx`、`src\components\{FeedbackWidget,UserNotRegisteredError,ProtectedRoute}.jsx`、`src\lib\PageNotFound.jsx`、
`src\components\gantt\{BarColorPicker,BulkEditBar,CompareDialog,GanttChart,HeaderDropdown,ImportStatusPanel,MergeDialog,RegionSelector,RowContextMenu,SectionColorPicker,SnapshotManager,TaskTable,ViewPresets,XerMappingDialog,XmlRelationshipEditor}.jsx`、
`src\components\ui\{alert,button,calendar,chart,context-menu,dropdown-menu,menubar,navigation-menu,select,toast,toggle}.jsx`、`package.json`／`package-lock.json`（僅 `@base44/vite-plugin` 1.0.40 → **1.0.41**）。

### 2.4 與參考版位元組完全相同（63 檔）

```
.gitignore, base44\config.jsonc, base44\entities\User.jsonc,
base44\functions\fetchHKHolidays\entry.ts, components.json, eslint.config.js,
index.html, jsconfig.json, postcss.config.js, README.md,
src\api\base44Client.js, src\main.jsx, src\utils\index.ts,
src\components\{AuthLayout}.jsx,
src\hooks\use-mobile.jsx,
src\lib\{app-params.js, AuthContext.jsx, computeItemLabels.js, hkWorkingDays.js,
         parsePLF.js, query-client.js, taskDiff, utils.js, xerFieldMapping.js}
src\pages\OAuthConsent.jsx,
src\components\ui\{accordion, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, card,
  carousel, checkbox, collapsible, command, dialog, drawer, form, hover-card, input,
  input-otp, label, pagination, popover, progress, radio-group, resizable, scroll-area,
  separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea,
  toaster, toggle-group, tooltip, use-toast}.jsx
```

> 意涵：**Base44 雲端整合、認證、香港假期 function、OCR（tesseract）、Excel（xlsx）、PDF 解析（pdfjs）、PLF 匯入、作業差異比對（taskDiff）、工作日曆（hkWorkingDays）等核心邏輯完全沿用參考版**，沒有被改動。

---

## 3. 架構差異：Base44 雲端 → 「雲端 + 本機」雙軌

### 3.1 參考版架構

```
Browser ──► Vite dev server ──► /api (Base44 vite plugin) ──► chronos-flow-chunwo.base44.app
                                   ↑ base44Client.js（LLM / functions / entities）
```
所有後端能力（LLM 智慧合併、假期抓取…）都在 Base44 雲端，本機沒有資料庫。

### 3.2 現行版架構（本機化）

```
Browser ──► Vite :15156 ──┬─► /api       (Base44 vite plugin) ──► Base44 雲端（LLM／functions，維持原樣）
                          └─► /local-api (proxy) ──► FastAPI :25156 ──► SQLite backend\db\pyworkflow.db
                                                     ↑ 專案 / 版本（ProjectBar）
```

**`vite.config.js`（現行版新增的關鍵接線）**

```js
// Workspace root (the folder holding the shared .env with FRONTEND_PORT).
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig(({ mode }) => {
  const workspaceEnv = loadEnv(mode, workspaceRoot, '')
  return {
    server: {
      // Port always comes from the workspace root .env (never hardcoded, never port+1).
      port: Number(workspaceEnv.FRONTEND_PORT) || 5173,
      strictPort: true,
      proxy: {
        '/local-api': {
          target: `http://localhost:${workspaceEnv.BACKEND_PORT || 8080}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/local-api/, ''),
        },
      },
    },
    plugins: [ base44({ legacySDKImports: ..., hmrNotifier: true, navigationNotifier: true,
                        analyticsTracker: true, visualEditAgent: true }), react() ],
  }
})
```
> 參考版同一檔案僅有 `base44()` + `react()` 兩個 plugin，沒有 `server.port`／`strictPort`／`proxy`。

**`src\lib\localApi.js`（新增的本機 API 客戶端，節錄）**

```js
const API_BASE = "/local-api";
export const BACKEND_HINT =
  "本地後端未啟動 — 請執行 scripts\\start-backend.bat（或 set START_BACKEND=1 後跑 scripts\\start-all.bat）";

export const localApi = {
  listProjects: () => request("/projects"),
  createProject: (name, description = "") => { /* FormData */ },
  getProject: (id) => request(`/projects/${id}`),
  deleteProject: (id) => request(`/projects/${id}`, { method: "DELETE" }),
  listVersions: (projectId) => request(`/projects/${projectId}/versions`),
  createVersion: (projectId, payload, name, isSnapshot = false) =>
    request(`/projects/${projectId}/versions`, { method: "POST", body: JSON.stringify({ payload, name, is_snapshot: isSnapshot }) }),
  getVersion: (projectId, versionId) => request(`/projects/${projectId}/versions/${versionId}`),
  importFile: (projectId, file, createVersion = true) => { /* 後端解析（Python parsers） */ },
};
export function isBackendDown(err) { /* 後端未啟動的友善提示 */ }
```

**FastAPI 後端（workspace `backend\`）**

```python
# backend/main.py
app = FastAPI(title="P6 Reader & Converter — local backend", lifespan=lifespan)
@app.get("/health") ...
app.include_router(projects.router)
app.include_router(versions.router)
```
- `routers\projects.py` / `routers\versions.py`：專案 CRUD、版本（含 snapshot）儲存
- `parsers\{xer_parser,p6xml_parser,excel_parser}.py`：伺服端解析（大型檔案的備援路徑）
- `backend\.env`：`DATABASE_URL=sqlite+aiosqlite:///./db/pyworkflow.db`
- 使用 `uv`（`pyproject.toml`／`uv.lock`）

**啟動腳本（現行版新增，批次 13–16）**

`scripts\start-all.bat` 重點行為（節錄註解與流程）：

```bat
rem   * Ports are ALWAYS read from the workspace root .env - never hardcoded and
rem     never port+1 (see AGENTS.md "Port conflict rule").
rem   * The local FastAPI backend (backend\ - starter scaffold) is NOT started by
rem     default: this app talks to the Base44 cloud API and never calls it.
rem     Opt in with "set START_BACKEND=1" ...
rem   * When everything is ready the app is opened in the default browser ...
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
  if /i "%%A"=="BACKEND_PORT" set "BACKEND_PORT=%%B"
)
:is_listening
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
```

| 腳本 | 功能 |
|------|------|
| `scripts\start-all.bat` / `.sh` | 讀 `.env` 埠號 → 已在監聽則跳過 → 起前端（`start-frontend.bat`） → 等就緒 → 後端 opt-in → 開瀏覽器（`NO_BROWSER=1` 可關） |
| `scripts\start-frontend.bat` | 呼叫 app 內 `scripts\start-local.bat`（避免路徑含 `&` 破壞 npm shim） |
| `scripts\start-backend.bat` | 起 FastAPI（`uv run uvicorn`） |
| `scripts\stop-all.bat` / `status.bat` | 停止／檢查服務狀態 |

---

## 4. 功能差異逐項（參考版 → 現行版）

> 每個項目都標示：**參考版有什麼**、**現行版改成什麼**、**具體程式碼**、**驗收**。

### 4.1 專案管理 ProjectBar（全新，批次 17）

**參考版**：無。程式只有單一 `projectTitle` 文字輸入（`<Input value={projectTitle} onChange=.../>`），資料只存在瀏覽器狀態／匯出的檔案裡。

**現行版**：標題右側新增 `ProjectBar`，接本機 FastAPI + SQLite：

```jsx
// src/pages/GanttPage.jsx
const [currentProjectId, setCurrentProjectId] = useState(null);
...
<ProjectBar
  currentProjectId={currentProjectId}
  tasks={tasks}
  onProjectLoaded={handleProjectLoaded}   // (project, payload, xerTables)
/>
```

```jsx
// src/components/gantt/ProjectBar.jsx（節錄）
title="專案管理"
title="上傳 programme 檔案 (.xer/.xml/.xlsx/.csv) 並解析"
title="儲存目前進度為新版本（由甘特圖頁面提供 tasks）"
<button onClick={handleCreate} title="建立專案" />
<div className="text-xs text-text-muted text-center py-3">尚無專案</div>
// localApi.listProjects / createProject / getProject / deleteProject /
//          importFile / createVersion / getVersion
```
- 選擇專案 → 載入最新版本 → 直接回到甘特圖；上傳檔案 → 解析 → 匯入目前工作區；`存檔` → 產生新版本（可標記 snapshot）。
- 後端未啟動時顯示友善提示（`BACKEND_HINT`），不是原始 500。
- **驗收**：真實 632 KB XER 上傳／存檔通過（886 activities / 191 sections）。

### 4.2 統一設定面板 GlobalSettingsPanel（全新，批次 18）

**參考版**：header 有多個分散入口 — `Display` 下拉（Holiday Markers / Staircase Line / Relationship Lines / Diff Only / Relation Filter）、`Tools` 下拉（Column Visibility / P6 Filters / Compare / XmlRelEditor / Import / Export…）、`Type`（字級滑桿）、齒輪 `Settings`；`Display` 與 `Tools` 內容互相重疊、難以查找。

```jsx
// REF src/pages/GanttPage.jsx（節錄）
label="Display"
{ label: "Holiday Markers", on: showToday, toggle: () => setShowToday(v => !v) },
{ label: "Staircase Line",  on: showStaircase, ... },
{ label: "Relationship Lines", on: showRelationshipLines, ... },
{ label: "Diff Only", on: showOnlyDiff, ... },
{ label: "Relation Filter", on: showRelationFilter, ... },
label="Tools"   // 內含 Column Visibility / P6 Filters / Compare / XmlRelEditor …
```

**現行版**：比照 xerviewer.org 的 Global Settings，**header 只留一顆 Settings 齒輪**，開啟右側面板＋左側分類軌（可拖曳調寬），分類與內容如下：

```jsx
// src/components/gantt/GlobalSettingsPanel.jsx（節錄）
const CATEGORIES = [
  { id: "wbs",           label: "WBS",             title: "WBS Settings",             icon: FolderTree },
  { id: "activity-list", label: "Activity List",   title: "Activity List Settings",   icon: List },
  { id: "timeline-grid", label: "Timeline & Grid", title: "Timeline & Grid Settings", icon: CalendarRange },
  { id: "gantt-bars",    label: "Gantt Bars",      title: "Gantt Bar Settings",       icon: BarChart3 },
  { id: "other",         label: "Other",           title: "Other Settings",           icon: Settings },
];
const TAB_KEY = "gantt_global_settings_tab";     // 分類與面板寬度記憶在 localStorage

// 內嵌既有面板（chromeless 模式）
{tab === "wbs" && <WbsSettingsPanel {...shared} wbsLevels={wbsLevels} />}
{tab === "activity-list" && <ColumnVisibilityPanel {...shared} embedded />}
{tab === "timeline-grid" && <><GanttSettingsPanel {...shared} initialTab="grid" />…</>}
{tab === "gantt-bars"    && <><GanttSettingsPanel {...shared} initialTab="bars" />…</>}
{tab === "other"         && <><GanttSettingsPanel {...shared} initialTab="structure" />…</>}
```
- `Display` 下拉的功能全部移入 **Other**；`Column Visibility` 與 `Filter` 分別改為 Activity List 分頁與漏斗選單。
- `ColumnVisibilityPanel` 為此新增 `embedded` prop（不畫自己的遮罩／標題列）：

```jsx
export default function ColumnVisibilityPanel({ columnVisibility, setColumnVisibility, embedded = false, onClose }) {
  <div className={embedded ? "flex flex-col" : "fixed inset-0 bg-black/50 flex items-center justify-center z-50"} …>
```

### 4.3 WBS 階層配色 ＋ Customise Grouping（全新，批次 8／19／19.1；CLF 換色）

**參考版**：WBS 列固定藍／粉（`#bfdbfe/#1e3a8a`、`#fce7f3/#9d174d`），沒有配色 scheme 也沒有分組層級控制。

**現行版**：
1. **15 組配色 scheme**（3 色塊 → 7 階 HSL 內插），文字色自動取 CLF 的 `#ffffff`／`#333333`：

```js
// src/lib/displaySettings.js
export const WBS_LEVEL_COUNT = 7;
export const WBS_COLOR_SCHEMES = [
  { id: "classic", name: "Current (Blue / Pink)", swatches: ["#fff2ea", "#ffffff", "#733208"], legacy: true },
  { id: "cool-blues", name: "Cool Blues", swatches: ["#005a53", "#6c757d", "#f7f7f7"] }, …
];
export function expandSchemeColors(swatches) {          // 3 swatches → 7 levels（HSL 內插）
  const [a, b, c] = …;
  return [a, mixHexColors(a,b,1/3), mixHexColors(a,b,2/3), b, mixHexColors(b,c,1/3), mixHexColors(b,c,2/3), c];
}
export function wbsTextColorFor(hex) {                  // CLF：--color-text #333333 / --color-surface #ffffff
  … return L > 0.179 ? "#333333" : "#ffffff";
}
export function resolveWbsRowStyle(task, displaySettings) { /* 表格、甘特圖標籤、PDF 三處共用同一規則 */ }
```
2. **Customise Grouping**（Group By / To Level / Status ＋停用的 Add New Grouping Header）：

```js
export const WBS_GROUP_LEVELS = [{ value: "all", label: "All Levels" }, …];  // 靜態 fallback
export function wbsLevelOptions(maxLevel) {   // 依檔案實際最深層級產生選項（批次 19.1）
  return [{ value: "all", label: "All Levels" },
          ...Array.from({ length: maxLevel }, (_, i) => ({ value: i + 1, label: `Level ${i + 1}` }))];
}
export function wbsLevelCounts(tasks)      { /* 每層群組數統計，顯示在面板上 */ }
export function wbsVisibleGroupCount(counts, toLevel) { … }
export function applyWbsGrouping(tasks, grouping) { /* 只影響群組標題列，活動列不動 */ }
```
- `GanttPage` 端接線（順序固定：搜尋 → P6 條件 → 關係 → Diff → Quick Filters → Hide Empty WBS → WBS 分組）：

```jsx
const [displaySettings, setDisplaySettings] = useState(loadDisplaySettings);
useEffect(() => { saveDisplaySettings(displaySettings); }, [displaySettings]);
...
if (displaySettings?.wbs?.hideEmpty !== false) filtered = filtered.filter(t => !(t.isSection && t.emptyWbs));
filtered = applyWbsGrouping(filtered, displaySettings?.grouping);
const wbsLevels = useMemo(() => wbsLevelCounts(tasks), [tasks]);
```
- **驗收**：`WbsSettingsPanel grouping inventory` 檢查（層級統計、`To Level` 依資料生成）通過。

### 4.4 Quick Filters ＋ Last Recalc Date（全新，批次 20／20.1／21）

**參考版**：xerviewer 有工具列的漏斗快速篩選，但本 app 只有 `Tools ▸ P6 Filters`（條件編輯器）與 `Diff Only`／`Relation Filter` 兩個開關，**沒有**狀態 pill。

**現行版**：header 搜尋框右側＝**漏斗圖示按鈕**（右上角徽章）→ 選單內容：

| 區塊 | 內容 |
|------|------|
| Last Recalc Date | `<input type="date">`（載入 XER 自動帶入 `PROJECT.last_recalc_date`；與檔案值不同時出現 `File` 一鍵回復） |
| pills | `All`／`Not Started`／`In Progress`／`Completed`／`Started`／`Milestones`／`Critical Path` |
| 底部 | `Custom`（自訂篩選有規則時顯示 `On`）／`Clear`（僅在有條件時出現） |

**純函式模組（可測）**

```js
// src/lib/quickFilters.js
export const QUICK_FILTER_PILLS = [ {id:"all"…}, {id:"TK_NotStart",label:"Not Started"} … ];

/** 徽章計數＝參考站 Iy()：statuses + started + remaining + milestones（+ 自訂規則）；
 *  Critical Path 刻意不計入。 */
export function countQuickFilterCriteria(qf) {
  return countActiveQuickFilters({ ...(qf || {}), critical: false });
}
export function activeFilterBadgeCount(qf, customFilter) {
  return countQuickFilterCriteria(qf) + countCustomFilterRules(customFilter);
}

/** 記錄日期：P6 PROJECT.last_recalc_date（"2024-09-30 08:00" → "2024-09-30"） */
export function normalizeRecalcDate(value) {
  const m = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
export function recalcDateFromXerTables(tables) {
  const rows = tables?.PROJECT;
  return Array.isArray(rows) && rows.length ? normalizeRecalcDate(rows[0]?.last_recalc_date) : "";
}

/** 狀態以「截至記錄日期」判讀：日期之後才發生的實際進度視為尚未發生 */
export function statusAsOf(task, recalcDate) {
  const base = statusOf(task);
  const date = normalizeRecalcDate(recalcDate);
  if (!date) return base;
  const after = (v) => { const d = dayOf(v); return Boolean(d) && d > date; };
  if (base === "TK_Complete" && task?.endActual === true && after(task?.end)) return "TK_Active";
  if (task?.startActual === true && after(task?.start)) return "TK_NotStart";
  return base;
}
export function isStartedAsOf(task, recalcDate) { … }
export function applyQuickFilters(tasks, qf, recalcDate) { /* 空的群組標題會被移除，活動不重排 */ }
```

**接線（`GanttPage.jsx`，注意 TDZ 順序）**

```jsx
// 必須宣告在衍生清單之前（批次 8.1 的 TDZ 陷阱）
const [quickFilters, setQuickFilters] = useState(defaultQuickFilters);
const [lastRecalcDate, setLastRecalcDate] = useState("");
...
filtered = applyQuickFilters(filtered, quickFilters, lastRecalcDate);

// 載入新檔案時重新讀取記錄日期；手動編輯則保留到下次載入
useEffect(() => { if (!xerSource) return; setLastRecalcDate(recalcDateFromXerTables(xerSource)); }, [xerSource]);
const handleRecalcDateChange = useCallback((value) => setLastRecalcDate(normalizeRecalcDate(value)), []);
```

- **入口去重（批次 21）**：移除 `Tools ▸ P6 Filters`（與漏斗 `Custom` 重複開啟同一個對話框），`Tools` 下拉不再因篩選條件而亮起。
- **真實檔案實測**（886 activities，檔案日期 `2024-09-30`）：as at 2024-09-30 → **0 筆反轉**（與 XER 原始 `status_code` 一致，無副作用）；as at 2024-08-31 → 30 筆反轉（`Completed 403→381`、`Started 443→411`）；as at 2024-05-31 → 76 筆反轉。

### 4.5 Filter Activities 對話框（改寫，批次 22）

**參考版（＝現行版批次 22 之前）**：標題 `Filters`；條件表格 `Parameter / Is / Value`；底部 `Clear All`／`Cancel`／`Apply`；沒有範本、沒有 Match 控制。

**xerviewer 參考結構**（使用者提供）：標題 `Filter Activities`；`Load template...`（8 範本）＋`Match`＋`All conditions`／`Any condition`；條件列 `Where`＋欄位＋運算子（contains / does not contain / equals / starts with / is empty / is not empty）＋值＋刪除；`Add condition`；底部 `Clear filter`／`Cancel`／`Apply filter`。

**現行版**：以上全部實作（保留本專案已有的 `Add sub-group` 巢狀群組）：

```jsx
// src/components/gantt/FilterBar.jsx（節錄）
export const FILTER_TEMPLATES = [
  { id: "withoutPredecessors", label: "Activities without predecessors" },
  { id: "withoutSuccessors",   label: "Activities without successors" },
  { id: "threeWeekLookahead",  label: "3-week lookahead" },
  { id: "startedNotFinished",  label: "Started, not finished" },
  { id: "withConstraints",     label: "Activities with constraints" },
  { id: "negativeFloat",       label: "Negative float" },
  { id: "highFloat",           label: "High float (> 20 days)" },
  { id: "milestones",          label: "Milestones" },
];

export function buildTemplateFilters(id, recalcDate) {
  const cond = (field, operator, value, value2) => …;
  switch (id) {
    case "withoutPredecessors": return only(cond("predecessors", "equals", "no"));
    case "threeWeekLookahead": {                       // 以 Last Recalc Date 為基準（+21 天）
      const { from, to } = lookaheadWindow(recalcDate);
      return { logic: "any",
               conditions: [cond("start", "between", from, to), cond("end", "between", from, to)], groups: [] };
    }
    case "startedNotFinished":
      return { logic: "all",
               conditions: [cond("startActual", "equals", "yes"), cond("statusCode", "not equals", "TK_Complete")], groups: [] };
    …
  }
}
```

**新增 5 個衍生欄位**（XER 沒有這些欄位，改由 `applyFilters()` 解析）：

```js
function linkTargetKeys(task) { /* links[].succId／succCode／link／linkSuccCode */ }
const DERIVED_VALUES = {
  predecessors: (t, successorKeys) => (successorKeys.has(String(t.id)) || successorKeys.has(String(t.activityId)) ? YES : NO),
  successors:   (t) => (linkTargetKeys(t).length > 0 ? YES : NO),
  milestone:    (t) => (isMilestoneTask(t) ? YES : NO),      // 與 Quick Filters 同一規則
  startActual:  (t) => (t.startActual === true ? YES : NO),
  endActual:    (t) => (t.endActual === true ? YES : NO),
};
```

**🐞 附帶修正：Status 條件原本永遠不成立**

```js
// 修前：選單存 UI 標籤（"In Progress"），任務上是 P6 代碼（"TK_Active"）→ 永不等於
{ value: "statusCode", label: "Status", type: "select",
  options: ["Not Started","In Progress","Completed"] }

// 修後：選單存代碼、比較時雙邊正規化（舊篩選檔仍可用）
const STATUS_ALIAS = {
  "not started": "TK_NotStart", "tk_notstart": "TK_NotStart",
  "in progress": "TK_Active",   "tk_active": "TK_Active",
  completed: "TK_Complete",     "tk_complete": "TK_Complete",
};
const cv = normaliseValue(cond.field, cond.value).toLowerCase();
const lv = normaliseValue(cond.field, v).toLowerCase();
```

- **驗收**：範本以真實檔實測 — without predecessors 3、without successors 18、3-week lookahead 63、started not finished 33、with constraints 19、negative float 456、high float 57、milestones 225。

### 4.6 Timeline「Time Scale」6 種模式 ＋ Auto（改，批次 2 追加 4）

**參考版**：`UnifiedGanttLayout.jsx` 只有 3 種模式（month／week／day），欄寬表也只定義這 3 種：

```js
// REF
const COL_WIDTH_DEFAULT = { month: 60, week: 40, day: 24 };
...
if (viewMode === "month") { … }
```

**現行版**：比照 xerviewer 的 Timeline & Grid，改為 6 模式＋Auto，並支援欄寬拖曳：

```js
// src/components/gantt/UnifiedGanttLayout.jsx
const COL_WIDTH_DEFAULT = { year: 160, month: 60, week: 40, day: 24, weekDay: 32 };
const COL_WIDTH_MIN     = { year: 40,  month: 20, week: 14, day: 8,  weekDay: 12 };
const COL_WIDTH_MAX     = { year: 400, month: 200, week: 120, day: 60, weekDay: 80 };

export const TIME_SCALES = [
  { value: "auto",    label: "Auto",         col: "auto",  top: "auto"  },
  { value: "year",    label: "Year",         col: "year",  top: "year"  },
  { value: "month",   label: "Year - Month", col: "month", top: "year"  },
  { value: "week",    label: "Month - Week", col: "week",  top: "month" },
  { value: "day",     label: "Month - Day",  col: "day",   top: "month" },
  { value: "weekDay", label: "Week - Day",   col: "day",   top: "week"  },
];

/** Auto: 依工期長度自動選尺度（>550 天 → year、>130 → month、>45 → week、>21 → day、其餘 weekDay） */
export function resolveTimeScale(viewMode, minDate, maxDate) { … }
```
- 驗收：6 種尺度各渲染一次皆通過（`UnifiedGanttLayout (timeScale=…)` 檢查）。

### 4.7 PDF 匯出前預覽 Print Preview（全新，批次 4）

**參考版**：按 Export → 直接下載 PDF。
**現行版**：先產生同一份 jsPDF doc 並以 Blob URL 預覽，可看頁數、開新分頁、下載、關閉（Esc）：

```jsx
// src/components/gantt/PdfPreviewDialog.jsx
<PdfPreviewDialog pdfUrl={"blob:…"} filename="Smoke Programme.pdf" pageCount={3}
                  onDownload={…} onClose={…} />
// ExportDialog: import { buildGanttPDF } from "@/lib/exportGanttPDF";
//               import { encodeTasksForPDF } from "@/lib/ganttPDFData";
```
- 驗收：預覽＝匯出（同一 doc 實例）、Blob URL 生命週期管理、`exportGanttPDF()` 視覺不變。

### 4.8 XER → XER「零缺漏直通」匯出（改，批次 9／10／11）

**參考版**：`exportXER.js` 以「重新組表」方式輸出，遺失所有 relationships（批次 9 的原始 bug）與部分欄位。
**現行版**：新增**直通模式**，匯入時保留原始表，匯出時原封寫回：

```js
// src/lib/exportXER.js
export function buildXER(tasks, { version, projectId, projectName, calendarName, exportDate, sourceTables = null }) {
  // ── Pass-through mode ──
  if (sourceTables && Object.keys(sourceTables).length) {
    return buildXERPassThrough(tasks, { version, projectId, projectName, calendarName, exportDate, hrsPerDay, sourceTables });
  }
  …
}
/** Lossless XER → XER export. `sourceTables` is the raw table map captured at import */
export function buildXERPassThrough(tasks, { …, sourceTables }) {
  const src = sourceTables;
  const oid = t._originalXerData?.task_id || t.p6TaskId;      // 原 task_id 回寫
  const rows = origPredRowsByPred.get(String(t._originalXerData?.task_id …));  // 原 relationships 回寫
}
```
```jsx
// src/pages/GanttPage.jsx — 讓 App 真的用到（Import 時記下原表）
const [xerSource, setXerSource] = useState(null);   // 「Raw XER tables of the imported programme」
if (xerTables) setXerSource(xerTables);
<ExportXERDialog tasks={tasks} onClose={…} xerSource={xerSource} />
```
```jsx
// src/components/gantt/ExportXERDialog.jsx — 預設值來自原檔
const srcProjRow = (xerSource && xerSource.PROJECT && xerSource.PROJECT[0]) || null;
const [projectId, setProjectId] = useState(srcProjRow?.proj_short_name || "PROJ001");
const [exportDate, setExportDate] = useState(srcProjRow?.last_recalc_date?.slice(0, 10) || today);
```
- 稽核工具：`scripts\xer-loss-audit.mjs`（批次 10 的可重現稽核），`parseXER.js` 新增 `parseXerTables()` 與 `_originalWbsData`。

### 4.9 匯出 PDF 內嵌完整資料（改，批次 12）

**參考版**：PDF 只有畫面，重新上傳無法還原資料。
**現行版**：把任務陣列塞進 PDF Info 字典（V3 起為 gzip），重新上傳同一份 PDF 即還原：

```js
// src/lib/ganttPDFData.js
const MARK_GZ    = "GANTT_DATA_V3:";   // V3 = gzip-compressed JSON（CompressionStream）
const MARK_PLAIN = "GANTT_DATA_V2:";   // V2 = legacy, uncompressed（仍可解碼）
async function gzipToBase64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")); …
}
// Subject: "GANTT_DATA_V3:" + chunk0   Author: "chunks:<n>"   Keywords: "GANTT_OVERFLOW:" + …
```
- 驗收：`PDF embedded data round trip (export → re-upload)` 與 legacy V2 相容性檢查通過。

### 4.10 活動資訊面板：`ActivityInfoPanel.jsx` → `GanttInfoPanel.jsx`（改名＋擴充，批次 5）

**參考版**：368 行的 `ActivityInfoPanel`。
**現行版**：619 行的 `GanttInfoPanel`（活動細節／資源／關係／代碼／Notebook），header 的 `Info` 按鈕（`title="Information panel — activity details, resources, relationships, codes, notebook"`）開啟，面板高度依 header 實際高度定位（`headerRef` + `headerHeight`）。
- 依賴 `buildRelationshipMap.js` 新增的**關係明細**版本（含 type／lag）：

```js
// src/lib/buildRelationshipMap.js
/** Like `buildRelationshipMap`, but keeps the relationship **details** the
 *  activity information panel needs: type (FS/SS/FF/SF) and lag for every edge. */
```

### 4.11 掃描式 PDF 匯入修正（改，批次 6／7）

**參考版**：PDF OCR 只抓到 3 行（跳過第 1 頁、渲染解析度不足）。
**現行版**：`ImageImportDialog.jsx` 修正兩個資料遺失點：

```jsx
// Render a PDF page upright and return a Blob (faster than base64 toDataURL).
// Target ~2800px on the long edge so a 300 dpi A4 programme scan keeps its detail and
// dense ~6pt table text stays legible for the vision model.
```

### 4.12 Common Look and Feel（CLF）全站換色（改，貫穿所有批次）

**參考版**：Tailwind 預設色（`slate-*`、`blue-*`、`green-*`、`red-*`、`#2980b9`…）。
**現行版**：單一淺色調色盤，集中於 CSS 變數＋Tailwind 擴充，其餘檔案改為語意 class：

```css
/* src/index.css */
/* ── Common Look and Feel palette (light only) ──
   Source of truth: .agents/skills/common-look-and-feel/theme.css
   Frontend policy: common-look-and-feel.json */
--color-primary: #005a53;       --color-primary-dark: #003531;
--color-accent-selected: #733208;
--color-text: #333333;          --color-text-muted: #6c757d;  --color-text-on-accent: #001c19;
--color-surface: #ffffff;       --color-surface-subtle: #f7f7f7;
--color-surface-muted: #ececec; --color-surface-disabled: #eaeaea;
--color-focus: #005a53;         --color-success: #005a53;
```
```js
// tailwind.config.js（新增 CLF 段落）
// Values come from .agents/skills/common-look-and-feel/tailwind.theme.json
text:    { DEFAULT: '#333333', muted: '#6C757D', 'on-accent': '#001C19' },
primary: { …, dark: 'hsl(var(--primary-dark))', active: 'hsl(var(--primary-active))' },
accent:  { …, accessible: 'hsl(var(--accent-accessible))', selected: 'hsl(var(--accent-selected))' },
```

| 位置 | 參考版 | 現行版 |
|------|--------|--------|
| 載入轉圈（`App.jsx`／`ProtectedRoute.jsx`） | `border-slate-200 border-t-slate-800` | `border-border border-t-primary` |
| shadcn Button ghost（`ui/button.jsx`） | `hover:bg-accent hover:text-accent-foreground` | `hover:bg-surface-subtle hover:text-text` |
| Header 下拉（`HeaderDropdown.jsx`） | `text-blue-400 bg-slate-600`／`text-slate-400 hover:text-white` | `text-primary bg-surface`／`text-text-muted hover:text-text` |
| 甘特長條預設（`UnifiedGanttLayout.jsx`） | `baseline:#2980b9, delay:#22c55e, custom:[#2980b9,#22c55e,#e74c3c,…]` | `baseline:#005a53, delay:#e88219, custom:[#005a53,#e88219,#b15315,#733208,#003531,#001c19,#333333,#6c757d]` |
| 表頭／今日線（`GanttChart.jsx`） | `#475569`／`#d1d5db` | `#003531`／`#cecece`（CLF 灰階） |
| WBS 列配色（`TaskTable.jsx`／scheme） | `#bfdbfe/#1e3a8a`、`#2e5cb8`… | `#005a53/#ffffff`、`#396c80`…（CLF scheme） |
| 專案列、對話框、快照、合併、比較、XML 編輯器… | slate／blue／green／red | `text-*`／`surface-*`／`primary`／`accent-selected` 語意 token |

### 4.13 腳本與自動化測試（全新，批次 13–16）

| 項目 | 參考版 | 現行版 |
|------|--------|--------|
| 啟動 | 手動 `npm run dev` | `scripts\start-all.bat`（埠來自 `.env`、就緒偵測、自動開瀏覽器、後端 opt-in） |
| 停止／狀態 | 無 | `scripts\stop-all.bat`、`scripts\status.bat` |
| 測試 | 無 | `scripts\smoke-test.mjs`：以 Vite SSR 渲染**真實頁面與面板**，抓 TDZ／未定義變數／壞 hook 造成的白屏，並驗證純函式（WBS 配色、Quick Filters、範本、PDF 內嵌往返、徽章數學…） |
| 稽核 | 無 | `scripts\xer-loss-audit.mjs`：XER → XER 缺漏清單 |
| 桌面一鍵 | 無 | workspace 根 `start-local - 捷徑.lnk`（批次 13） |

---

## 5. 現行版本完整功能清單（依 UI 區域）

### 5.1 Header（`GanttPage.jsx`，左 → 右）

| 區域 | 元件／按鈕 | 功能 |
|------|-----------|------|
| 左 | 色條 + 專案標題 `Input` | 專案名稱（可直接編輯） |
| 左 | **ProjectBar**（新） | 專案管理：選擇／建立／刪除專案、上傳檔案解析、存檔為新版本（本機後端） |
| 右 | `Search` | 活動名稱／ID 即時搜尋（模糊包含） |
| 右 | **QuickFilterMenu**（新，漏斗＋徽章） | Last Recalc Date／7 pills／Custom／Clear（批次 20–21） |
| 右 | View mode 下拉 | Auto／Year／Year-Month／Month-Week／Month-Day／Week-Day |
| 右 | **Settings**（統一設定面板，新） | WBS／Activity List／Timeline & Grid／Gantt Bars／Other 五大分類 |
| 右 | **Info** | `GanttInfoPanel`（活動細節／資源／關係／代碼／Notebook） |
| 右 | **Tools** 下拉 | Compare Versions、XML Relationship Editor、Refresh Holidays、**SnapshotManager**（快照） |
| 右 | Import／Export 膠囊 | Import（PDF／圖片／Excel／XER／XML）、Export（PDF／Excel／XER／XML） |
| 右 | Undo／Redo 膠囊 | 復原／重做（`Ctrl+Z` / `Ctrl+Y`） |
| 右 | Trash | 清除全部資料（二次確認） |

### 5.2 活動表格區

- 47 個可選欄位（`INIT_VISIBILITY`）、**Column Visibility** 面板（含 View Presets 套用）、欄寬拖曳、欄位排序。
- 內嵌編輯（雙擊）、**貼上匯入**（`onPaste`）、**Bulk Edit Bar**（多選批次修改，含 Staircase 篩選設定）、**Row Context Menu**（右鍵：新增／刪除／插入／連結…）。
- WBS 群組標題（階層配色、可收合／展開全部、群組字型大小與粗斜體）。
- **Staircase 篩選**（`staircaseFilter`）：只畫出選取活動的階梯線（由 BulkEditBar 設定／清除）。
- **Region Selector**（`RegionSelector({ imageUrl, initialRegions, onRunOcr, onBack })`）：掃描檔的 OCR 框選（`Full Table (auto-parse)` 等資料型別），框好後送 OCR。
- **Diff Only**（只顯示與基準的差異列）與 **Relation Filter**（只顯示選取活動的 FS/SS/FF/SF 直接前後置）。

### 5.3 甘特圖區（`UnifiedGanttLayout.jsx`）

- Time Scale 6 模式＋Auto、時間軸欄寬拖曳、Today 線、月／年表頭。
- 長條外觀設定（高度／圓角／邊框／樣式）、里程碑形狀、**Critical 長條**（Total Float ≤ 0）、延遲長條（`delay`）、自訂色盤。
- 長條標籤（欄位／位置 inside-outside／字級／顏色）、**關係線**（FS/SS/FF/SF）、**Staircase 線**、群組標題顯示於甘特圖。
- **Focus mode**（前後關係鏈高亮、其餘淡化 0.3）、**收合到層級／展開／收合**、**Clear selection**。
- 網格線設定（列／欄／群組／時間軸主次線：顯示、顏色、線寬、線型）。

### 5.4 對話框與浮動面板（現行版全集）

`ImageImportDialog`（PDF／掃描 OCR／Excel／XER／XML）、`ImportStatusPanel`、`ExportDialog`（PDF／Excel／XER／XML＋欄位與紙張設定）、`PdfPreviewDialog`（新）、`ExportXERDialog`、`XerMappingDialog`、`CompareDialog`（版本比較）、`MergeDialog`（Smart Merge，用 Base44 LLM）、`XmlRelationshipEditor`、`FilterBar`＝`FilterDialog`（Filter Activities，8 範本）、`QuickFilterMenu`（新）、`GlobalSettingsPanel`（新）、`GanttSettingsPanel`／`WbsSettingsPanel`／`ColumnVisibilityPanel`（皆可 `embedded`）、`GanttInfoPanel`（新）、`BarColorPicker`／`SectionColorPicker`、`SnapshotManager`、`ViewPresets`、`ProjectBar`（新）、`FeedbackWidget`、`PageNotFound`、`UserNotRegisteredError`。

### 5.5 資料流與匯出

- 匯入：XER（`parseXER` + `parseXerTables` 原表保留）、P6 XML、Excel、PLF、PDF（文字層／掃描 OCR／**內嵌 V3 資料還原**）。
- 匯出：PDF（依所選欄目＋長條設定，內嵌完整資料）、Excel、XER（**直通零缺漏**）、P6 XML（含多重關係 type／lag）。
- 香港假期：Base44 function `fetchHKHolidays`（**與參考版完全相同**，未被改動）。

---

## 6. 功能對照總表

| # | 功能 | 參考版 | 現行版 | 主要檔案 |
|---|------|--------|--------|----------|
| 1 | 互動甘特圖（表格＋時間軸） | ✅ | ✅（不變） | `UnifiedGanttLayout.jsx`、`TaskTable.jsx` |
| 2 | 匯入 PDF／OCR／Excel／XER／XML／PLF | ✅ | ✅（PDF OCR 修正） | `ImageImportDialog.jsx`、`lib\parse*.js` |
| 3 | 匯出 PDF／Excel／XER／XML | ✅ | ✅ **＋ PDF 預覽、XER 直通、PDF 內嵌 V3** | `ExportDialog.jsx`、`lib\export*.js` |
| 4 | 版本比較 / Smart Merge（LLM） | ✅ | ✅（CLF 換色） | `CompareDialog.jsx`、`MergeDialog.jsx` |
| 5 | XML 關係編輯器 | ✅ | ✅（CLF） | `XmlRelationshipEditor.jsx` |
| 6 | 條件篩選（Parameter/Is/Value） | ✅ | ✅ **＋ 8 範本、Match、衍生欄位、Status 修正** | `FilterBar.jsx` |
| 7 | 快速篩選（狀態／里程碑／要徑） | ✖ | **✅ Quick Filters（批次 20–21）** | `quickFilters.js`、`QuickFilterMenu.jsx` |
| 8 | 記錄日期（Data Date） | ✖ | **✅ Last Recalc Date（可填寫、篩選綁定）** | `quickFilters.js`、`QuickFilterMenu.jsx` |
| 9 | 顯示設定集中管理 | 分散（Display／Tools／Type／Settings） | **✅ 統一設定面板 5 分類** | `GlobalSettingsPanel.jsx` |
| 10 | WBS 階層配色 | ✖（固定藍／粉） | **✅ 15 scheme × 7 階＋自動文字色** | `displaySettings.js`、`WbsSettingsPanel.jsx` |
| 11 | Customise Grouping（To Level） | ✖ | **✅ 依資料生成層級＋統計** | `displaySettings.js`、`WbsSettingsPanel.jsx` |
| 12 | Time Scale | 3 模式 | **✅ 6 模式＋Auto** | `UnifiedGanttLayout.jsx` |
| 13 | 專案／版本管理 | ✖ | **✅ ProjectBar + FastAPI + SQLite** | `ProjectBar.jsx`、`localApi.js`、`backend\` |
| 14 | 啟動／停止腳本 | ✖（手動 npm run dev） | **✅ scripts 全套＋自動開瀏覽器** | `scripts\*.bat|.sh` |
| 15 | 自動化測試 | ✖ | **✅ SSR 煙霧測試 + XER 稽核** | `scripts\smoke-test.mjs`、`xer-loss-audit.mjs` |
| 16 | 主題色 | Tailwind 預設 | **✅ CLF 單一淺色調色盤** | `index.css`、`tailwind.config.js`、49 檔 |
| 17 | 認證／LLM／假期雲端 | Base44 | Base44（**完全相同**） | `AuthContext.jsx`、`base44Client.js`、`base44\` |
| 18 | 資訊面板 | `ActivityInfoPanel`（368L） | **`GanttInfoPanel`（619L，擴充）** | `GanttInfoPanel.jsx` |

---

## 7. 未變更與保留（63 檔完全相同）

- **Base44 雲端整合**：`src\api\base44Client.js`、`src\lib\app-params.js`、`src\lib\AuthContext.jsx`、`OAuthConsent.jsx`、`AuthLayout.jsx`、`ProtectedRoute.jsx`、`UserNotRegisteredError.jsx`、`base44\config.jsonc`、`base44\entities\User.jsonc`、`base44\functions\fetchHKHolidays\entry.ts`。
  → 現行版**仍然**透過 `/api`（Base44 vite plugin）呼叫雲端 LLM（Smart Merge、OCR 文字判讀）與假期 function；`vite.config.js` 只多加了 `/local-api` 這條本機 proxy。
- **shadcn/radix UI 元件庫**（37 檔）大多原封不動，只有 12 檔做了 CLF 色票替換。
- **檔案解析核心**：`parsePLF.js`、`hkWorkingDays.js`、`taskDiff`、`xerFieldMapping.js`、`computeItemLabels.js`、`utils.js` 完全相同。
- **依賴版本**：`package.json` 僅 `@base44/vite-plugin` 由 `^1.0.40` → `^1.0.41`；其餘 100+ 套件版本不變（無新增任何 runtime 依賴）。

### 已知限制／刻意不做

| 項目 | 說明 |
|------|------|
| 本機後端為 opt-in | 專案／版本管理需要 `scripts\start-backend.bat`；其餘功能（含 Base44 LLM）不需後端 |
| Base44 依賴仍在 | LLM（Smart Merge、OCR 判讀）與假期資料仍走 Base44 雲端，額度計入原 App |
| LLM 匯入靠雲端 | 掃描 PDF 的「表格辨識」由 Base44 LLM 完成，屬外部服務 |
| `Tools ▸ P6 Filters` 已移除 | 篩選入口統一在漏斗選單（批次 21），若需要可再開批次加回 |

---

## 8. 驗證與再現方式

```bat
:: 1) 啟動（cmd.exe，非 PowerShell）
scripts\start-all.bat                 :: 前端 :15156（.env），就緒後自動開瀏覽器；後端 opt-in
set START_BACKEND=1 && scripts\start-all.bat   :: 連本機 FastAPI :25156 一起起

:: 2) 自動化測試（工作目錄 = Baes44\chronos-flow-chunwo）
cd Baes44\chronos-flow-chunwo
node scripts\smoke-test.mjs           :: SSR 煙霧測試，exit 0 且全表 0 FAILED/MISSING/UNEXPECTED
node scripts\xer-loss-audit.mjs       :: XER 匯出缺漏稽核
node node_modules\eslint\bin\eslint.js src\... :: ESLint 0 error

:: 3) 服務狀態／停止
scripts\status.bat
scripts\stop-all.bat
```

最近一次實測結果（2026-09-21）：

```
node scripts/smoke-test.mjs → exit 0，全表 0 UNEXPECTED / 0 FAILED / 0 MISSING
  QuickFilterMenu markup (funnel + badge + 7 pills + Custom/On + Clear + Last Recalc Date): OK (20 markers)
  Last Recalc Date binding: OK (asAt=1,3 completedAsAt=0 startedAsAt=1,3 noDate=2,3)
  Filter templates (8 templates + derived fields + lookahead on the record date): OK
  FilterDialog markup (Filter Activities + template picker + Match + footers): OK (22 markers)
  GanttPage (full page render): OK
ESLint 0 error；Vite 轉譯 200（FilterBar.jsx 132.9KB／GanttPage.jsx 231.9KB／QuickFilterMenu.jsx 33.1KB）
真實檔案 6WSD21-DP_202409.xer：886 activities / 191 sections / last_recalc_date 2024-09-30
```

---

## 9. 附錄 A：批次一覽（需求文件 `doc\requirements.md` 共 313 筆 RTM）

| 批次 | 日期 | 主題 | 代表檔案 |
|------|------|------|----------|
| 本地化 Entry／追加 1–3 | 2026-09-17 | 本機啟動、`/api` 代理、XER 每表 `%E`、PDF 依所選欄目輸出 | `vite.config.js`、`exportXER.js`、`exportGanttPDF.js` |
| 1 | 2026-09-17 | 列印與閱讀性（PDF 欄位、日期格式） | `exportGanttPDF.js` |
| 2 | 2026-09-17 | 長條外觀／標籤／Critical／Gantt Settings 齒輪面板 | `displaySettings.js`、`GanttSettingsPanel.jsx` |
| 3 | 2026-09-17 | 結構（收合／群組樣式）、焦點模式、清除選取 | `UnifiedGanttLayout.jsx` |
| 4 | 2026-09-17 | PDF 匯出前預覽 | `PdfPreviewDialog.jsx` |
| 5 | 2026-09-17 | 活動資訊面板（參考 XER Viewer） | `GanttInfoPanel.jsx`、`buildRelationshipMap.js` |
| 6 | 2026-09-18 | 掃描 PDF 只抓到 3 行的根因修正 | `ImageImportDialog.jsx` |
| 7 | 2026-09-18 | 掃描 PDF 不跳過第 1 頁＋提高解析度 | `ImageImportDialog.jsx` |
| 8 | 2026-09-18 | WBS 階層配色（WBS Settings 面板） | `displaySettings.js`、`WbsSettingsPanel.jsx` |
| 8.1 | 2026-09-18 | 🔥 熱修：TDZ 造成整頁空白 | `GanttPage.jsx` |
| 9 | 2026-09-18 | 匯出 XER 遺失所有 Relationships | `exportXER.js` |
| 10 | 2026-09-18 | XER → XER 缺漏稽核報告 | `xer-loss-audit.mjs` |
| 11 | 2026-09-18 | XER 匯出「原檔直通」零缺漏 | `exportXER.js`、`parseXER.js` |
| 12 | 2026-09-18 | PDF 內嵌完整資料（可重新上傳還原） | `ganttPDFData.js` |
| 13 | 2026-09-21 | 找回「啟動按鈕」桌面捷徑 | `start-local - 捷徑.lnk` |
| 14 | 2026-09-21 | `scripts\` 服務腳本套組（start-all／stop-all／status） | `scripts\*.bat|.sh` |
| 15 | 2026-09-21 | `start-all` 改為後端 opt-in | `scripts\start-all.bat` |
| 16 | 2026-09-21 | 就緒後自動開啟 App | `scripts\start-all.bat` |
| 17 | 2026-09-21 | 專案管理（選擇／上傳／存檔）＋本機 FastAPI | `ProjectBar.jsx`、`localApi.js`、`backend\` |
| 18 | 2026-09-21 | Tools／Display 大整理：統一設定面板 | `GlobalSettingsPanel.jsx` |
| 19／19.1 | 2026-09-21 | Customise Grouping（Group By／To Level／Status）＋熱修 | `displaySettings.js`、`WbsSettingsPanel.jsx` |
| 20／20.1 | 2026-09-21 | Quick Filters（7 pills＋徽章＋Custom／Clear） | `quickFilters.js`、`QuickFilterMenu.jsx` |
| 21 | 2026-09-21 | Filters 入口整合＋**Last Recalc Date** 綁定 | `quickFilters.js`、`QuickFilterMenu.jsx` |
| 22 | 2026-09-21 | Filter Activities 對齊 xerviewer（範本／Match／衍生欄位／Status 修正） | `FilterBar.jsx` |

---

## 10. 附錄 B：差異清單（可直接用於 code review）

**新增（21）**
```
.env.local
common-look-and-feel.json
JS SDK.txt
API Documentation\{cURL.txt, JS Fetch.txt, JS SDK.txt, Python.txt}
scripts\{smoke-test.mjs, xer-loss-audit.mjs, start-local.bat, stop-local.bat}
src\lib\{displaySettings.js, quickFilters.js, localApi.js}
src\components\gantt\{GlobalSettingsPanel.jsx, GanttSettingsPanel.jsx, WbsSettingsPanel.jsx,
                      GanttInfoPanel.jsx, ProjectBar.jsx, QuickFilterMenu.jsx, PdfPreviewDialog.jsx}
```
**移除（1）**：`src\components\gantt\ActivityInfoPanel.jsx`
**變更（49）**：見 2.3（A 類 17 檔為功能變更、B 類 32 檔為 CLF／設定變更）
**完全相同（63）**：見 2.4

> 本報告由 `doc\requirements.md`（批次 1–22、313 筆 RTM）、兩份檔案樹的 MD5／逐行差異比對，以及 `scripts\smoke-test.mjs` 的實測輸出彙整而成；所有數字均可在報告所述的指令下重新產生。
