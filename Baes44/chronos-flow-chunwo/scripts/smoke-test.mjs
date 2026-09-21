// TEMPORARY smoke test: render the Gantt layout with react-dom/server to catch
// runtime errors (undefined variables, TDZ, bad hooks) that would blank the page.
// NOTE: the app reads window/localStorage at import time, so we shim them here.

const store = new Map();
const localStorageShim = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
const win = {
  location: { search: "", pathname: "/", href: "http://localhost:15156/", hash: "" },
  localStorage: localStorageShim,
  history: { replaceState() {}, pushState() {} },
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: () => {},
  screenX: 0, screenY: 0, outerWidth: 1200, outerHeight: 800, innerWidth: 1200, innerHeight: 800,
  open: () => null, scrollTo() {},
};
win.self = win; win.top = win; win.parent = win; win.window = win;
// jsPDF binds window.btoa/atob when a `window` global exists — provide them so
// the PDF build check below can run head-less (Node has no window.btoa).
win.btoa = (s) => Buffer.from(String(s), "binary").toString("base64");
win.atob = (s) => Buffer.from(String(s), "base64").toString("binary");
globalThis.window = win;
globalThis.localStorage = localStorageShim;
globalThis.document = {
  documentElement: { style: {} },
  body: { appendChild() {}, style: {} },
  addEventListener() {}, removeEventListener() {},
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, getContext: () => null }),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
};
globalThis.matchMedia = win.matchMedia;

import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const server = await createServer({
  root: process.cwd(),
  logLevel: "error",
  server: { middlewareMode: true },
  appType: "custom",
});

const results = [];
async function check(path, label, props) {
  try {
    const mod = await server.ssrLoadModule(path);
    const Comp = mod.default;
    if (typeof Comp !== "function") {
      results.push([label, "NO DEFAULT EXPORT"]);
      return;
    }
    const html = renderToString(React.createElement(Comp, props));
    results.push([label, `OK (${html.length} chars)`]);
  } catch (e) {
    results.push([label, `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
  }
}

const tasks = [
  { id: "s1", isSection: true, activity: "Site Preparation", sectionType: "blue" },
  { id: "t1", activityId: "A1010", activity: "Excavation", start: "2025-01-06", end: "2025-01-20" },
];

const baseProps = {
  tasks, setTasks: () => {}, computedTasks: tasks, selectedIds: new Set(), setSelectedIds: () => {},
  durMode: "wd", setDurMode: () => {}, viewMode: "month", showToday: true,
  labelOffsets: {}, setLabelOffsets: () => {}, tableWidth: 430, startResize: () => {},
  saveToHistory: () => {}, sortState: { field: null, dir: null }, setSortState: () => {},
  showStaircase: true, showRelationshipLines: true, columnVisibility: null, cw: {}, setCw: () => {},
};

await check("/src/components/gantt/UnifiedGanttLayout.jsx", "UnifiedGanttLayout (displaySettings=null)", { ...baseProps, displaySettings: null });
await check("/src/components/gantt/UnifiedGanttLayout.jsx", "UnifiedGanttLayout (displaySettings=default)", {
  ...baseProps,
  displaySettings: { dateFormat: "dd/MM/yyyy", grid: { rowVisible: true, colVisible: true, groupVisible: true, timelineMajorVisible: true, timelineMinorVisible: true } },
});
for (const mode of ["auto", "year", "month", "week", "day", "weekDay"]) {
  await check("/src/components/gantt/UnifiedGanttLayout.jsx", `UnifiedGanttLayout (timeScale=${mode})`, { ...baseProps, viewMode: mode });
}

// Bar appearance settings (batch 2): every option switched on at once
const barDisplay = {
  dateFormat: "dd/MM/yyyy",
  grid: { rowVisible: true, colVisible: true, groupVisible: true, timelineMajorVisible: true, timelineMinorVisible: true },
  bar: {
    heightPx: 14, cornerRadius: 8, borderWidth: 2, borderColor: "#0f172a", borderStyle: "dashed",
    baselineColor: "#f59e0b", delayColor: "#fb923c", milestoneShape: "circle", milestoneSize: 7,
    shadow: true, shadowColor: "#94a3b8", shadowBlur: 5, shadowOffsetY: 2,
    critical: { enabled: true, color: "#ef4444", borderColor: "#991b1b", borderWidth: 2 },
    label: { show: true, field: "activityId", position: "right", fontSize: 12, color: "#0f172a", minWidth: 30 },
  },
};
await check("/src/components/gantt/UnifiedGanttLayout.jsx", "UnifiedGanttLayout (all bar options on)", { ...baseProps, displaySettings: barDisplay });
await check("/src/components/gantt/UnifiedGanttLayout.jsx", "UnifiedGanttLayout (milestone + critical)", {
  ...baseProps,
  computedTasks: [
    { id: "m1", activityId: "M100", activity: "Start Milestone", start: "2025-01-06", float: 0 },
    { id: "m2", activityId: "M200", activity: "Finish Milestone", end: "2025-02-10", float: 5 },
  ],
  tasks: [
    { id: "m1", activityId: "M100", activity: "Start Milestone", start: "2025-01-06", float: 0 },
    { id: "m2", activityId: "M200", activity: "Finish Milestone", end: "2025-02-10", float: 5 },
  ],
  displaySettings: barDisplay,
});

await check("/src/components/gantt/GanttSettingsPanel.jsx", "GanttSettingsPanel (bars tab)", {
  displaySettings: barDisplay, onChange: () => {}, viewMode: "month", onViewModeChange: () => {},
  onClose: () => {},
});
for (const t of ["labels", "grid", "timeline", "structure"]) {
  await check("/src/components/gantt/GanttSettingsPanel.jsx", `GanttSettingsPanel (${t} tab)`, {
    displaySettings: barDisplay, onChange: () => {}, viewMode: "month", onViewModeChange: () => {},
    collapsedCount: 2, onExpandAll: () => {}, onCollapseAll: () => {}, initialTab: t, onClose: () => {},
  });
}

// ── Batch 8: WBS row colours (WBS Settings panel + per-level styles) ────────
const {
  WBS_COLOR_SCHEMES, levelStylesFromScheme, expandSchemeColors,
  wbsTextColorFor, resolveWbsRowStyle,
} = await server.ssrLoadModule("/src/lib/displaySettings.js");

const coolBlues = levelStylesFromScheme("cool-blues");

await check("/src/components/gantt/WbsSettingsPanel.jsx", "WbsSettingsPanel (classic scheme)", {
  displaySettings: { wbs: { schemeId: "classic", levels: null, hideEmpty: true, groupHeadersOnGantt: true } },
  onChange: () => {}, onClose: () => {},
});
await check("/src/components/gantt/WbsSettingsPanel.jsx", "WbsSettingsPanel (Cool Blues scheme)", {
  displaySettings: { wbs: { schemeId: "cool-blues", levels: coolBlues, hideEmpty: false, groupHeadersOnGantt: false } },
  onChange: () => {}, onClose: () => {},
});

// The panel must contain the reference structure (schemes, toggles, level table)
try {
  const { default: WbsSettingsPanel } = await server.ssrLoadModule("/src/components/gantt/WbsSettingsPanel.jsx");
  const html = renderToString(React.createElement(WbsSettingsPanel, {
    displaySettings: { wbs: { schemeId: "cool-blues", levels: coolBlues, hideEmpty: true, groupHeadersOnGantt: true } },
    onChange: () => {}, onClose: () => {},
  })).replace(/<!--[^>]*-->/g, "");
  const markers = [
    "WBS Settings",
    "WBS Row Color Scheme:",
    "Hide Empty WBS Rows",
    "Show Group Headers on Gantt",
    "Custom WBS Level Styles",
    "WBS Level 1",
    "WBS Level 7",
    'aria-pressed="true"',
    // Batch 19 — Customise Grouping (reference: Group By | To Level | Status)
    "Customise Grouping",
    "Group By",
    "To Level",
    "Status",
    "All Levels",
    "+ Add New Grouping Header",
    ...WBS_COLOR_SCHEMES.map(s => s.name),
  ];
  const missing = markers.filter(m => !html.includes(m));
  results.push([
    "WbsSettingsPanel markup (schemes + toggles + grouping + level styles)",
    missing.length === 0 ? `OK (all ${markers.length} markers present)` : `MISSING: ${missing.join(", ")}`,
  ]);
} catch (e) {
  results.push(["WbsSettingsPanel markup (schemes + toggles + grouping + level styles)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 19: Customise Grouping (WBS only) — logic guard ───────────────────
// The grouping rows must filter the group-header rows exactly as the panel
// promises (All Levels / down to level N / grouping off) and never touch the
// activity rows.
try {
  const { applyWbsGrouping, cloneGrouping, defaultGrouping, WBS_GROUP_LEVELS } =
    await server.ssrLoadModule("/src/lib/displaySettings.js");
  const fixture = [
    { id: 1, isSection: true, sectionLevel: 1, activity: "Phase A" },
    { id: 2, activityId: "A100", activity: "Excavate" },
    { id: 3, isSection: true, sectionLevel: 2, activity: "Sub A1" },
    { id: 4, activityId: "A110", activity: "Pour" },
    { id: 5, isSection: true, sectionLevel: 3, activity: "Sub A1.1" },
  ];
  const sectionIds = (list) => list.filter(t => t.isSection).map(t => t.id);
  const activityCount = (list) => list.filter(t => !t.isSection).length;
  const all = applyWbsGrouping(fixture, defaultGrouping());
  const lvl1 = applyWbsGrouping(fixture, [{ groupBy: "wbs", toLevel: 1, enabled: true }]);
  const off = applyWbsGrouping(fixture, [{ groupBy: "wbs", toLevel: "all", enabled: false }]);
  const clone = cloneGrouping(undefined);
  const ok =
    JSON.stringify(sectionIds(all)) === JSON.stringify([1, 3, 5]) &&
    JSON.stringify(sectionIds(lvl1)) === JSON.stringify([1]) &&
    JSON.stringify(sectionIds(off)) === JSON.stringify([]) &&
    activityCount(all) === 2 && activityCount(lvl1) === 2 && activityCount(off) === 2 &&
    clone.length === 1 && clone[0].toLevel === "all" && clone[0].enabled === true &&
    WBS_GROUP_LEVELS.length === 8 && WBS_GROUP_LEVELS[0].label === "All Levels" &&
    WBS_GROUP_LEVELS[7].label === "Level 7";
  results.push([
    "Customise Grouping (applyWbsGrouping: all / to level / off)",
    ok
      ? `OK (group headers all=[${sectionIds(all)}] level1=[${sectionIds(lvl1)}] off=[${sectionIds(off)}], activities kept)`
      : `UNEXPECTED (all=[${sectionIds(all)}] level1=[${sectionIds(lvl1)}] off=[${sectionIds(off)}], activities ${activityCount(all)}/${activityCount(lvl1)}/${activityCount(off)})`,
  ]);
} catch (e) {
  results.push(["Customise Grouping (applyWbsGrouping)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// Reference behaviour (xerviewer): the "To Level" list is built from the file's
// deepest WBS level — All Levels + Level 1..maxLevel — not a fixed 1..7 list.
try {
  const { wbsLevelOptions, wbsLevelCounts, wbsVisibleGroupCount } =
    await server.ssrLoadModule("/src/lib/displaySettings.js");
  // Distribution taken from a real P6 export (6WSD21-DP_202409.xer): almost flat.
  const flat = wbsLevelCounts([
    ...Array.from({ length: 184 }, () => ({ isSection: true, sectionLevel: 1 })),
    ...Array.from({ length: 4 }, () => ({ isSection: true, sectionLevel: 2 })),
    ...Array.from({ length: 3 }, () => ({ isSection: true, sectionLevel: 3 })),
    { activityId: "A1" },
  ]);
  const nested = wbsLevelCounts([
    { isSection: true, sectionLevel: 1 },
    { isSection: true, sectionLevel: 2 },
    { isSection: true, sectionLevel: 3 },
    { isSection: true, sectionLevel: 4 },
  ]);
  const plain = wbsLevelCounts([{ isSection: true }, { activityId: "A1" }]);
  const values = (max) => wbsLevelOptions(max).map(o => o.value).join(",");
  const ok =
    flat.maxLevel === 3 && flat.counts[1] === 184 &&
    values(3) === "all,1,2,3" && wbsLevelOptions(3)[3].label === "Level 3" &&
    nested.maxLevel === 4 && values(4) === "all,1,2,3,4" &&
    plain.maxLevel === 1 && plain.counts[1] === 1 &&
    wbsVisibleGroupCount(flat.counts, "all") === 191 &&
    wbsVisibleGroupCount(flat.counts, 1) === 184 &&
    wbsVisibleGroupCount(flat.counts, 2) === 188 &&
    wbsVisibleGroupCount(nested.counts, 2) === 2;
  results.push([
    "Customise Grouping level options + inventory (data-driven, xerviewer parity)",
    ok
      ? `OK (flat: 3 層 → ${values(3)}，群組 191/184/188；nested: 4 層 → ${values(4)}；無階層 → ${plain.maxLevel} 層)`
      : `UNEXPECTED (flat max=${flat.maxLevel} opts=${values(3)} groups=${wbsVisibleGroupCount(flat.counts, "all")}/${wbsVisibleGroupCount(flat.counts, 1)}/${wbsVisibleGroupCount(flat.counts, 2)}; nested max=${nested.maxLevel} opts=${values(4)})`,
  ]);
} catch (e) {
  results.push(["Customise Grouping level options + inventory", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// The panel must offer only the levels present in the file and summarise them,
// so it is obvious what "To Level" can change.
try {
  const { default: WbsSettingsPanel } = await server.ssrLoadModule("/src/components/gantt/WbsSettingsPanel.jsx");
  const html = renderToString(React.createElement(WbsSettingsPanel, {
    displaySettings: { wbs: { schemeId: "cool-blues", levels: coolBlues, hideEmpty: true, groupHeadersOnGantt: true } },
    onChange: () => {}, onClose: () => {},
    wbsLevels: { counts: { 1: 184, 2: 4, 3: 3 }, maxLevel: 3, levelList: [1, 2, 3] },
  })).replace(/<!--[^>]*-->/g, "");
  const markers = ["Customise Grouping", "Level 3", "WBS 層級：3 層", "L1 184", "L3 3", "目前顯示 191 個群組標題"];
  const missing = markers.filter(m => !html.includes(m));
  results.push([
    "WbsSettingsPanel grouping inventory (levels present in the file)",
    missing.length === 0 ? "OK (All Levels + Level 1-3 only, level summary shown)" : `MISSING: ${missing.join(", ")}`,
  ]);
} catch (e) {
  results.push(["WbsSettingsPanel grouping inventory", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 20: Quick Filters (status pills / started / milestones / critical) ──
// Same predicates as the reference toolbar menu, mapped onto this app's tasks.
try {
  const {
    applyQuickFilters, toggleQuickFilter, countActiveQuickFilters, statusOf,
    isMilestoneTask, isCriticalTask,
  } = await server.ssrLoadModule("/src/lib/quickFilters.js");
  const task = (over) => ({ start: "2025-01-01", end: "2025-01-10", ...over });
  const rows = [
    { id: 1, isSection: true, activity: "Phase A" },
    task({ id: 2, activityId: "A1", statusCode: "TK_NotStart", start: "2025-02-01", end: "2025-02-10", float: 5 }),
    task({ id: 3, activityId: "A2", statusCode: "TK_Active", startActual: true, float: 0 }),
    task({ id: 4, activityId: "A3", statusCode: "TK_Complete", startActual: true, endActual: true, pct: 100, float: -3 }),
    task({ id: 5, activityId: "M1", statusCode: "TK_NotStart", start: "2025-03-01", end: "", float: 2 }),
    task({ id: 6, activityId: "M2", statusCode: "TK_NotStart", start: "", end: "2025-03-05", float: 2 }),
    { id: 7, isSection: true, activity: "Phase B" },
    task({ id: 8, activityId: "B1", statusCode: "TK_Active" }),
  ];
  const ids = (list) => list.map(t => t.id).join(",");
  const statuses = (codes) => ({ statuses: codes, started: false, remaining: false, milestones: false, critical: false });
  const notStarted = applyQuickFilters(rows, statuses(["TK_NotStart"]));
  const active = applyQuickFilters(rows, statuses(["TK_Active"]));
  const started = applyQuickFilters(rows, toggleQuickFilter(undefined, "started"));
  const milestones = applyQuickFilters(rows, toggleQuickFilter(undefined, "milestones"));
  const critical = applyQuickFilters(rows, toggleQuickFilter(undefined, "critical"));
  const off = applyQuickFilters(rows, toggleQuickFilter(undefined, "started"));
  const ok =
    ids(notStarted) === "1,2,5,6" &&       // section kept while it holds matching rows
    ids(active) === "1,3,7,8" &&           // Phase B section kept (holds activity 8)
    ids(started) === "1,3,4" &&
    ids(milestones) === "1,5,6" &&         // only-start / only-end
    ids(critical) === "1,3,4" &&           // Total Float <= 0
    ids(off) === ids(started) &&
    ids(applyQuickFilters(rows, statuses([]))) === ids(rows) &&   // nothing active → untouched
    statusOf({ pct: 100 }) === "TK_Complete" && statusOf({ pct: 0 }) === "TK_NotStart" &&
    statusOf({ pct: 40 }) === "TK_Active" && statusOf({ statusCode: "TK_Active" }) === "TK_Active" &&
    isMilestoneTask({ start: "x", end: "" }) === true && isMilestoneTask({ start: "x", end: "y" }) === false &&
    isCriticalTask({ float: 0 }) === true && isCriticalTask({ float: 1 }) === false && isCriticalTask({}) === false &&
    countActiveQuickFilters(statuses(["TK_NotStart"])) === 1 &&
    countActiveQuickFilters(toggleQuickFilter(toggleQuickFilter(undefined, "TK_Active"), "TK_Active")) === 0;
  results.push([
    "Quick Filters (status / started / milestones / critical predicates)",
    ok
      ? `OK (notStarted=[${ids(notStarted)}] inProgress=[${ids(active)}] started=[${ids(started)}] milestones=[${ids(milestones)}] critical=[${ids(critical)}], none=[${ids(rows)}])`
      : `UNEXPECTED (notStarted=[${ids(notStarted)}] inProgress=[${ids(active)}] started=[${ids(started)}] milestones=[${ids(milestones)}] critical=[${ids(critical)}])`,
  ]);
} catch (e) {
  results.push(["Quick Filters (predicates)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// The menu must reproduce the reference option set: toolbar funnel button with a
// corner badge, the seven pills, and the Custom (+ "On") / Clear footer.
try {
  const { default: QuickFilterMenu } = await server.ssrLoadModule("/src/components/gantt/QuickFilterMenu.jsx");
  const menuProps = {
    quickFilters: { statuses: ["TK_NotStart"], started: true, remaining: false, milestones: true, critical: true },
    customFilter: { enabled: true, matchType: "all", rules: [{ field: "activity", op: "contains", value: "x" }], conditions: [{ field: "activity", op: "contains", value: "x" }], groups: [] },
    onChange: () => {}, onOpenCustom: () => {}, defaultOpen: true,
  };
  const html = renderToString(React.createElement(QuickFilterMenu, {
    ...menuProps, recalcDate: "2024-09-30", fileRecalcDate: "2024-09-30",
  })).replace(/<!--[^>]*-->/g, "");
  const markers = [
    'aria-label="Filter activities"', "All", "Not Started", "In Progress", "Completed",
    "Started", "Milestones", "Critical Path", "Custom", ">On<", "Clear",
    'role="menu"', ">4<",            // badge = 3 quick criteria + 1 custom rule (critical excluded)
    "Last Recalc Date", 'id="quick-filter-recalc-date"', 'type="date"', 'value="2024-09-30"',
  ];
  // A date that differs from the file's must offer the "File" reset affordance.
  const editedHtml = renderToString(React.createElement(QuickFilterMenu, {
    ...menuProps, recalcDate: "2024-10-15", fileRecalcDate: "2024-09-30",
  })).replace(/<!--[^>]*-->/g, "");
  const editedMarkers = ['value="2024-10-15"', ">File<", "File: 2024-09-30"];
  const editedMissing = editedMarkers.filter(m => !editedHtml.includes(m));
  const missing = markers.filter(m => !html.includes(m));
  results.push([
    "QuickFilterMenu markup (funnel button + badge + 7 pills + Custom/On + Clear + Last Recalc Date)",
    missing.length === 0 && editedMissing.length === 0
      ? `OK (all ${markers.length + editedMarkers.length} markers present)`
      : `MISSING: ${[...missing, ...editedMissing].join(", ")}`,
  ]);
} catch (e) {
  results.push(["QuickFilterMenu markup", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// Badge maths must match the reference `Iy()` (critical excluded, custom rules added).
try {
  const { activeFilterBadgeCount, clearQuickFilters, countCustomFilterRules, countQuickFilterCriteria, countActiveQuickFilters } =
    await server.ssrLoadModule("/src/lib/quickFilters.js");
  const qf = { statuses: ["TK_NotStart", "TK_Active"], started: true, remaining: false, milestones: true, critical: true };
  const custom = { conditions: [{ field: "activity" }, {}], groups: [{ conditions: [] }] };
  const ok =
    countQuickFilterCriteria(qf) === 4 &&              // 2 statuses + started + milestones
    countActiveQuickFilters(qf) === 5 &&               // + critical
    countCustomFilterRules(custom) === 2 &&            // 1 valid condition + 1 group
    countCustomFilterRules(undefined) === 0 &&
    activeFilterBadgeCount(qf, custom) === 6 &&
    activeFilterBadgeCount(qf, undefined) === 4 &&     // critical never counted
    JSON.stringify(clearQuickFilters()) === JSON.stringify({ statuses: [], started: false, remaining: false, milestones: false, critical: false });
  results.push([
    "Quick filter badge / clear maths (reference Iy parity)",
    ok ? "OK (badge 6 = 4 quick + 2 custom rules; critical excluded from badge; Clear resets everything)" : "UNEXPECTED",
  ]);
} catch (e) {
  results.push(["Quick filter badge / clear maths", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 21: "Last Recalc Date" binds the status pills to the record date ────
// Actual progress dated AFTER the record date had not happened yet as at that
// date, so the pills must read the task "as at" it. No date → stored statuses.
try {
  const {
    applyQuickFilters, statusAsOf, isStartedAsOf, toggleQuickFilter,
    normalizeRecalcDate, recalcDateFromXerTables,
  } = await server.ssrLoadModule("/src/lib/quickFilters.js");
  const RECALC = "2024-09-30";
  const rows = [
    { id: 1, activityId: "R1", statusCode: "TK_Complete", startActual: true, endActual: true, pct: 100, start: "2024-08-01", end: "2024-10-15" }, // finished after
    { id: 2, activityId: "R2", statusCode: "TK_Active", startActual: true, pct: 30, start: "2024-10-05", end: "2024-11-01" },                      // started after
    { id: 3, activityId: "R3", statusCode: "TK_Active", startActual: true, pct: 50, start: "2024-09-10", end: "2024-10-20" },                      // genuinely underway
  ];
  const ids = (list) => list.map(t => t.id).join(",");
  const statuses = (codes) => ({ statuses: codes, started: false, remaining: false, milestones: false, critical: false });
  const activeAsOf = ids(applyQuickFilters(rows, statuses(["TK_Active"]), RECALC));
  const completeAsOf = applyQuickFilters(rows, statuses(["TK_Complete"]), RECALC).length;
  const startedAsOf = ids(applyQuickFilters(rows, toggleQuickFilter(undefined, "started"), RECALC));
  const activeRaw = ids(applyQuickFilters(rows, statuses(["TK_Active"])));
  const ok =
    activeAsOf === "1,3" && completeAsOf === 0 && startedAsOf === "1,3" &&
    activeRaw === "2,3" &&                                          // no record date → stored statuses
    statusAsOf(rows[0], RECALC) === "TK_Active" && statusAsOf(rows[0], "") === "TK_Complete" &&
    statusAsOf(rows[1], RECALC) === "TK_NotStart" && statusAsOf(rows[2], RECALC) === "TK_Active" &&
    isStartedAsOf(rows[1], RECALC) === false && isStartedAsOf(rows[1], "") === true &&
    normalizeRecalcDate("2024-09-30 08:00") === "2024-09-30" && normalizeRecalcDate("n/a") === "" &&
    recalcDateFromXerTables({ PROJECT: [{ last_recalc_date: "2024-09-30 08:00" }] }) === "2024-09-30" &&
    recalcDateFromXerTables(null) === "" &&
    ids(applyQuickFilters(rows, statuses([]), RECALC)) === "1,2,3";  // the date alone never hides rows
  results.push([
    "Last Recalc Date binding (statuses read as at the record date)",
    ok
      ? `OK (asAt=${activeAsOf} completedAsAt=${completeAsOf} startedAsAt=${startedAsOf} noDate=${activeRaw})`
      : `UNEXPECTED (asAt=${activeAsOf} completedAsAt=${completeAsOf} started=${startedAsOf} noDate=${activeRaw})`,
  ]);
} catch (e) {
  results.push(["Last Recalc Date binding", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 21: one filter entry point ─────────────────────────────────────────
// The funnel menu (pills + Last Recalc Date + Custom + Clear) replaces the old
// Tools ▸ "P6 Filters" duplicate, and the page must wire the record date through.
try {
  const { readFile } = await import("node:fs/promises");
  const pageSrc = await readFile("src/pages/GanttPage.jsx", "utf8");
  const menuSrc = await readFile("src/components/gantt/QuickFilterMenu.jsx", "utf8");
  const ok =
    !pageSrc.includes("<Filter size={14} /> P6 Filters") &&
    pageSrc.includes("onOpenCustom={() => setShowFilter(true)}") &&
    pageSrc.includes("applyQuickFilters(filtered, quickFilters, lastRecalcDate)") &&
    pageSrc.includes("recalcDateFromXerTables(xerSource)") &&
    menuSrc.includes('htmlFor="quick-filter-recalc-date"');
  results.push([
    "Filter entry points integrated (no Tools duplicate; record date wired page → menu → predicates)",
    ok ? "OK (funnel = pills + Last Recalc Date + Custom; Tools menu de-duplicated)" : "UNEXPECTED",
  ]);
} catch (e) {
  results.push(["Filter entry points integrated", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 22: reference "Filter Activities" dialog (templates + Match + footer) ──
// Every template from xerviewer.org must expand into a legal condition tree and
// actually filter the way its label promises.
try {
  const { FILTER_TEMPLATES, buildTemplateFilters, applyFilters } = await server.ssrLoadModule(
    "/src/components/gantt/FilterBar.jsx"
  );
  const REF_IDS = ["withoutPredecessors", "withoutSuccessors", "threeWeekLookahead",
    "startedNotFinished", "withConstraints", "negativeFloat", "highFloat", "milestones"];
  const REF_LABELS = ["Activities without predecessors", "Activities without successors",
    "3-week lookahead", "Started, not finished", "Activities with constraints",
    "Negative float", "High float (> 20 days)", "Milestones"];

  const t = (id, over) => ({ id, activityId: `A${id}`, activity: `Task ${id}`, start: "2024-09-01", end: "2024-09-10", ...over });
  const rows = [
    { id: "s1", isSection: true, activity: "Phase A" },
    t(1, { links: [{ succCode: "A2", type: "FS", lag: 0 }] }),                                     // successor, no predecessor
    t(2, { links: [{ succCode: "A3", type: "FS", lag: 0 }] }),                                     // predecessor (from 1) + successor
    t(3, {}),                                                                                       // predecessor (from 2), no successor
    t(4, { statusCode: "TK_Active", startActual: true, start: "2024-09-05", end: "2024-12-01" }),   // started, not finished
    t(5, { statusCode: "TK_Complete", startActual: true, endActual: true, end: "2024-09-20" }),     // started AND finished
    t(6, { constraintType: "CS_MSOA", float: -3 }),                                                 // constraint + negative float
    t(7, { float: 25, start: "2024-10-10", end: "2024-10-30" }),                                    // high float, starts inside window
    t(8, { start: "", end: "2024-09-30" }),                                                         // finish-only milestone, inside window
    t(9, { start: "2024-11-01", end: "2024-11-10" }),                                               // no links, outside window
  ];
  const RECALC = "2024-09-30";
  const ids = (list) => list.filter(r => !r.isSection).map(r => r.id).join(",");
  const run = (id) => ids(applyFilters(rows, buildTemplateFilters(id, RECALC)));
  const got = {
    withoutPredecessors: run("withoutPredecessors"),
    withoutSuccessors: run("withoutSuccessors"),
    threeWeekLookahead: run("threeWeekLookahead"),
    startedNotFinished: run("startedNotFinished"),
    withConstraints: run("withConstraints"),
    negativeFloat: run("negativeFloat"),
    highFloat: run("highFloat"),
    milestones: run("milestones"),
  };

  // 3-week lookahead window = record date … record date + 21 days
  const look = buildTemplateFilters("threeWeekLookahead", RECALC);
  const okTemplates =
    FILTER_TEMPLATES.length === 8 &&
    FILTER_TEMPLATES.map(x => x.id).join(",") === REF_IDS.join(",") &&
    FILTER_TEMPLATES.map(x => x.label).join("|") === REF_LABELS.join("|") &&
    buildTemplateFilters("nope", RECALC) === null &&
    look.conditions.length === 2 && look.logic === "any" &&
    look.conditions.every(c => c.operator === "between" && c.value === RECALC && c.value2 === "2024-10-21");
  const okResults =
    got.withoutPredecessors === "1,4,5,6,7,8,9" &&
    got.withoutSuccessors === "3,4,5,6,7,8,9" &&
    got.threeWeekLookahead === "7,8" &&
    got.startedNotFinished === "4" &&
    got.withConstraints === "6" &&
    got.negativeFloat === "6" &&
    got.highFloat === "7" &&
    got.milestones === "8";
  results.push([
    "Filter templates (reference list + derived fields + 3-week lookahead on the record date)",
    okTemplates && okResults
      ? `OK (8 templates; withoutPred=[${got.withoutPredecessors}] withoutSucc=[${got.withoutSuccessors}] lookahead=[${got.threeWeekLookahead}] startedNotFinished=[${got.startedNotFinished}] constraints=[${got.withConstraints}] negFloat=[${got.negativeFloat}] highFloat=[${got.highFloat}] milestones=[${got.milestones}])`
      : `UNEXPECTED (templates=${okTemplates} results=${okResults} ${JSON.stringify(got)})`,
  ]);
} catch (e) {
  results.push(["Filter templates", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// The dialog itself: reference title / template picker / Match segmented / footer
// buttons, plus Status comparisons that must accept P6 codes *and* old labels.
try {
  const { default: FilterDialog, applyFilters } = await server.ssrLoadModule("/src/components/gantt/FilterBar.jsx");
  const html = renderToString(React.createElement(FilterDialog, {
    open: true,
    onClose: () => {},
    filters: { logic: "all", conditions: [{ field: "activity", operator: "contains", value: "x" }], groups: [] },
    onFiltersChange: () => {},
    recalcDate: "2024-09-30",
  })).replace(/<!--[^>]*-->/g, "");
  const markers = [
    "Filter Activities", 'aria-label="Load filter template"', "Load template...", "Match",
    "All conditions", "Any condition", "Clear filter", "Cancel", "Apply filter",
    "Add condition", "Add sub-group", "Parameter", "Is", "Value",
    // every reference template must be offered
    "Activities without predecessors", "Activities without successors", "3-week lookahead",
    "Started, not finished", "Activities with constraints", "Negative float",
    "High float (&gt; 20 days)", "Milestones",
  ];
  const missing = markers.filter(m => !html.includes(m));

  const st = (value) => applyFilters(
    [{ id: 1, activityId: "A1", statusCode: "TK_Active" }, { id: 2, activityId: "A2", statusCode: "TK_NotStart" }],
    { logic: "all", conditions: [{ field: "statusCode", operator: "equals", value }], groups: [] }
  ).map(x => x.id).join(",");
  const aliasOk = st("TK_Active") === "1" && st("In Progress") === "1" &&
                  st("TK_NotStart") === "2" && st("Not Started") === "2";

  results.push([
    "FilterDialog markup (Filter Activities + template picker + Match segmented + footers)",
    missing.length === 0 && aliasOk
      ? `OK (all ${markers.length} markers present; Status accepts TK_* codes and labels)`
      : `MISSING: ${[...missing, ...(aliasOk ? [] : ["status alias"])].join(", ")}`,
  ]);
} catch (e) {
  results.push(["FilterDialog markup", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// Scheme expansion must reproduce the XER Viewer level colours (3 swatches → 7 levels)
try {
  const REF_COOL_BLUES = ["#2e5cb8", "#4171d0", "#648bd8", "#87a5e1", "#a9bfea", "#ccd9f2", "#eff3fb"];
  const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const near = (a, b) => rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]) <= 1); // ±1 rounding
  const got = expandSchemeColors(["#2e5cb8", "#87a5e1", "#eff3fb"]);
  const colorsOk = got.length === 7 && got.every((c, i) => near(c, REF_COOL_BLUES[i]));
  // Text colour follows the Common Look and Feel palette (--color-text #333333 /
  // --color-surface #ffffff): the first two swatches are dark enough for white
  // text, the remaining five take #333333.
  const REF_TEXT = "#ffffff,#ffffff,#333333,#333333,#333333,#333333,#333333";
  const textOk = got.map(wbsTextColorFor).join(",") === REF_TEXT;
  results.push([
    "expandSchemeColors (Cool Blues → 7 levels)",
    colorsOk && textOk
      ? `OK (${got.join(" ")} | CLF text colours ${REF_TEXT})`
      : `UNEXPECTED (colors=${colorsOk} text=${textOk} → ${got.join(" ")})`,
  ]);

  const classic = resolveWbsRowStyle({ isSection: true, sectionLevel: 3 }, { wbs: { schemeId: "classic" } });
  const classicPink = resolveWbsRowStyle({ isSection: true, sectionLevel: 3, sectionType: "pink" }, { wbs: { schemeId: "classic" } });
  const lvl3 = resolveWbsRowStyle({ isSection: true, sectionLevel: 3 }, { wbs: { schemeId: "cool-blues", levels: coolBlues } });
  const deep = resolveWbsRowStyle({ isSection: true, sectionLevel: 12 }, { wbs: { schemeId: "cool-blues", levels: coolBlues } });
  const override = resolveWbsRowStyle({ isSection: true, sectionLevel: 1, sectionBg: "#123456", sectionText: "#abcdef" }, { wbs: { schemeId: "cool-blues", levels: coolBlues } });
  const ok =
    classic.bg === "#005a53" && classic.text === "#ffffff" &&           // CLF primary
    classicPink.bg === "#733208" && classicPink.text === "#ffffff" &&   // CLF accent
    lvl3.bg === coolBlues[2].bg && lvl3.text === coolBlues[2].text && lvl3.fontWeight === 700 &&
    deep.bg === coolBlues[6].bg &&                 // deeper than 7 levels → lightest
    override.bg === "#123456" && override.text === "#abcdef" &&
    resolveWbsRowStyle({ id: 1, activity: "task" }, {}) === null;
  results.push([
    "resolveWbsRowStyle (classic · per level · override · clamp)",
    ok
      ? `OK (classic ${classic.bg}/${classic.text}, L3 ${lvl3.bg}/${lvl3.text}, >L7 clamps, manual override wins)`
      : `UNEXPECTED (classic=${classic.bg}/${classic.text} pink=${classicPink.bg}/${classicPink.text} l3=${lvl3.bg}/${lvl3.text} deep=${deep.bg} expectedL3=${coolBlues[2].bg}/${coolBlues[2].text})`,
  ]);
} catch (e) {
  results.push(["expandSchemeColors / resolveWbsRowStyle", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}


// Batch 3: collapsed sections + focus mode
const relTasks = [
  { id: 1, activityId: "A", activity: "First", start: "2025-01-06", end: "2025-01-10", link: 2 },
  { id: 2, activityId: "B", activity: "Second", start: "2025-01-13", end: "2025-01-17", link: 3 },
  { id: 3, activityId: "C", activity: "Third", start: "2025-01-20", end: "2025-01-24" },
  { id: 4, activityId: "D", activity: "Unrelated", start: "2025-02-01", end: "2025-02-05" },
];
await check("/src/components/gantt/UnifiedGanttLayout.jsx", "UnifiedGanttLayout (collapsed sections)", {
  ...baseProps, collapsedIds: new Set(["s1"]), onToggleSection: () => {}, onExpandAll: () => {}, onCollapseAll: () => {},
});
await check("/src/components/gantt/UnifiedGanttLayout.jsx", "UnifiedGanttLayout (focus mode on)", {
  ...baseProps,
  tasks: relTasks, computedTasks: relTasks, selectedIds: new Set([2]),
  displaySettings: { ...barDisplay, focus: { enabled: true, dim: 0.3 } },
});

// Batch 4: PDF print preview (dialog rendering + real jsPDF build)
await check("/src/components/gantt/PdfPreviewDialog.jsx", "PdfPreviewDialog (preview open)", {
  pdfUrl: "blob:http://localhost:15156/preview",
  filename: "Smoke Programme.pdf",
  pageCount: 3,
  onDownload: () => {},
  onClose: () => {},
});
await check("/src/components/gantt/PdfPreviewDialog.jsx", "PdfPreviewDialog (no pdf → renders nothing)", {
  pdfUrl: null, onDownload: () => {}, onClose: () => {},
});

try {
  const { buildGanttPDF } = await server.ssrLoadModule("/src/lib/exportGanttPDF.js");
  const { doc, filename, pageCount } = buildGanttPDF({
    tasks: [
      { id: "s1", isSection: true, activity: "Section A", sectionType: "blue" },
      { id: "t1", item: "A1", activityId: "A1010", activity: "Excavation", start: "2025-01-06", end: "2025-01-20", float: 0 },
      { id: "t2", item: "A2", activityId: "A1020", activity: "Footing", start: "2025-01-21", end: "2025-02-28", progress: 40 },
      { id: "t3", item: "A3", activityId: "M100", activity: "Milestone", start: "2025-03-01" },
    ],
    projectTitle: "Smoke Programme",
    companyName: "Smoke Co.",
    programmeRef: "Smoke",
    subtitle: "Preview check",
    footerCenter: "Page {page} of {pages}",
    paperSize: "a3",
    orientation: "landscape",
  });
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const header = String.fromCharCode(...bytes.slice(0, 5));
  const blob = doc.output("blob");
  const ok = pageCount > 0 && bytes.length > 1000 && header === "%PDF-" && blob.size === bytes.length && filename.endsWith(".pdf");
  results.push([
    "buildGanttPDF (real doc → preview bytes)",
    ok
      ? `OK (${pageCount} page(s), ${bytes.length} bytes, header '${header}', blob ${blob.size} bytes, '${filename}')`
      : `UNEXPECTED (pages=${pageCount}, bytes=${bytes.length}, header='${header}', blob=${blob?.size})`,
  ]);
} catch (e) {
  results.push(["buildGanttPDF (real doc → preview bytes)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// Batch 5: activity information panel (rail, tabs, relationship tables)
const infoTasks = [
  { id: 1, activityId: "A1010", activity: "Excavation", start: "2025-01-06", end: "2025-01-20", float: 0, statusCode: "TK_Active", pct: 40, links: [{ succId: 2, type: "FS", lag: 0 }] },
  { id: 2, activityId: "A1020", activity: "Footing", start: "2025-01-21", end: "2025-02-28", float: 3, links: [{ succId: 3, type: "SS", lag: 2 }] },
  { id: 3, activityId: "A1030", activity: "Superstructure", start: "2025-03-02", end: "2025-04-30" },
];
await check("/src/components/gantt/GanttInfoPanel.jsx", "GanttInfoPanel (no selection)", {
  open: true, task: null, tasks: infoTasks, onClose: () => {}, onJumpToTask: () => {},
});
await check("/src/components/gantt/GanttInfoPanel.jsx", "GanttInfoPanel (general tab)", {
  open: true, task: infoTasks[0], tasks: infoTasks, onClose: () => {}, onJumpToTask: () => {},
  dateFormat: "dd/MM/yyyy", durMode: "wd", headerHeight: 53,
});
await check("/src/components/gantt/GanttInfoPanel.jsx", "GanttInfoPanel (relationships tab)", {
  open: true, task: infoTasks[1], tasks: infoTasks, onClose: () => {}, onJumpToTask: () => {},
  initialTab: "relationships",
});
for (const t of ["status", "resources", "codes", "notebook"]) {
  await check("/src/components/gantt/GanttInfoPanel.jsx", `GanttInfoPanel (${t} tab)`, {
    open: true, task: infoTasks[0], tasks: infoTasks, onClose: () => {}, onJumpToTask: () => {}, initialTab: t,
  });
}

// The Relationships tab must contain the reference table structure
try {
  const { default: GanttInfoPanel } = await server.ssrLoadModule("/src/components/gantt/GanttInfoPanel.jsx");
  const html = renderToString(React.createElement(GanttInfoPanel, {
    open: true, task: infoTasks[1], tasks: infoTasks, initialTab: "relationships",
    onClose: () => {}, onJumpToTask: () => {},
  }));
  const markers = [
    "gantt-information-panel-title",
    "Predecessors (1)",
    "Successors (1)",
    "A1010",            // predecessor of task 2
    "A1030",            // successor of task 2
    "Finish-to-Start",  // rel type tooltip (FS)
    "Start-to-Start",   // rel type tooltip (SS)
    "Driving",          // driving column
    "driving path",     // driving checkbox tooltip
    "Drag to resize sections",
  ];
  // React SSR inserts <!-- --> between text nodes — strip them before matching
  const plain = html.replace(/<!--[^>]*-->/g, "");
  const missing = markers.filter(m => !plain.includes(m));
  results.push([
    "GanttInfoPanel relationships markup",
    missing.length === 0
      ? `OK (all ${markers.length} markers present)`
      : `MISSING: ${missing.join(", ")}`,
  ]);
} catch (e) {
  results.push(["GanttInfoPanel relationships markup", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

try {
  const { buildRelationshipDetails } = await server.ssrLoadModule("/src/lib/buildRelationshipMap.js");
  const map = buildRelationshipDetails(infoTasks);
  const succOf1 = map.get(1).successors;
  const predOf2 = map.get(2).predecessors;
  const succOf2 = map.get(2).successors;
  const ok =
    succOf1.length === 1 && succOf1[0].id === 2 && succOf1[0].type === "FS" && succOf1[0].lag === 0 &&
    predOf2.length === 1 && predOf2[0].id === 1 &&
    succOf2.length === 1 && succOf2[0].id === 3 && succOf2[0].type === "SS" && succOf2[0].lag === 2 &&
    map.get(1).predecessors.length === 0 && map.get(3).successors.length === 0;
  results.push([
    "buildRelationshipDetails (type + lag per edge)",
    ok
      ? `OK (1→2 ${succOf1[0].type}/${succOf1[0].lag}, 2→3 ${succOf2[0].type}/${succOf2[0].lag})`
      : `UNEXPECTED (${JSON.stringify({ succOf1, predOf2, succOf2 })})`,
  ]);
} catch (e) {
  results.push(["buildRelationshipDetails (type + lag per edge)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 8: WBS colours inside the layout + WBS levels from the XER parser ──
try {
  const { default: Layout } = await server.ssrLoadModule("/src/components/gantt/UnifiedGanttLayout.jsx");
  const wbsTasks = [
    { id: "s1", isSection: true, sectionLevel: 1, activity: "PHASE ONE" },
    { id: "t1", activityId: "A1", activity: "Task 1", start: "2025-01-06", end: "2025-01-20" },
    { id: "s2", isSection: true, sectionLevel: 3, activity: "SUB PHASE" },
    { id: "t2", activityId: "A2", activity: "Task 2", start: "2025-01-21", end: "2025-01-25" },
  ];
  const render = (patch) => renderToString(React.createElement(Layout, {
    ...baseProps, tasks: wbsTasks, computedTasks: wbsTasks,
    displaySettings: { group: null, wbs: { schemeId: "cool-blues", levels: coolBlues, ...patch } },
  })).replace(/<!--[^>]*-->/g, "");

  const html = render({ groupHeadersOnGantt: true });
  const l1 = html.includes(coolBlues[0].bg);       // level 1 background (Cool Blues)
  const l3 = html.includes(coolBlues[2].bg);       // level 3 background
  const classicHtml = renderToString(React.createElement(Layout, {
    ...baseProps, tasks: wbsTasks, computedTasks: wbsTasks,
    displaySettings: { wbs: { schemeId: "classic", levels: null } },
  })).replace(/<!--[^>]*-->/g, "");
  // Classic keeps the CLF blue rows (--color-primary) and must not borrow a level colour.
  const classicOk = classicHtml.includes("#005a53") && !classicHtml.includes(coolBlues[2].bg);

  const countName = (s) => s.split("PHASE ONE").length - 1;
  const withLabels = countName(html);
  const withoutLabels = countName(render({ groupHeadersOnGantt: false }));
  const toggleOk = withLabels === 2 && withoutLabels === 1;   // table row + chart label → chart label only when on

  results.push([
    "UnifiedGanttLayout WBS row colours (level 1 / 3 + classic + label toggle)",
    l1 && l3 && classicOk && toggleOk
      ? `OK (L1 ${coolBlues[0].bg}, L3 ${coolBlues[2].bg}, classic CLF blue kept, chart label toggles)`
      : `UNEXPECTED (l1=${l1} l3=${l3} classic=${classicOk} labels=${withLabels}/${withoutLabels})`,
  ]);
} catch (e) {
  results.push(["UnifiedGanttLayout WBS row colours", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

try {
  const { parseXER } = await server.ssrLoadModule("/src/lib/parseXER.js");
  const XER_FIXTURE = [
    "ERMHDR\t16.2\t2023-09-01\tProject\tuser\tdb\t2\tP6\t\t\t\t\t\t\t",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\tP1\tSmoke Project",
    "%T\tPROJWBS",
    "%F\twbs_id\tparent_wbs_id\twbs_short_name\twbs_name",
    "%R\tW1\t\tA\tPhase A",
    "%R\tW2\tW1\tA.1\tSub A1",
    "%R\tW3\t\tB\tEmpty Phase B",
    "%T\tTASK",
    "%F\ttask_id\ttask_code\ttask_name\twbs_id\tearly_start_date\tearly_end_date",
    "%R\tT1\tA100\tExcavate\tW1\t2023-09-01 08:00\t2023-09-05 17:00",
    "%R\tT2\tA110\tPour\tW2\t2023-09-06 08:00\t2023-09-07 17:00",
    "%T\tTASKPRED",
    "%F\tpred_task_id\ttask_id\tpred_type\tlag_hr_cnt",
    "%R\tT1\tT2\tPR_FS\t0",
    "%E",
  ].join("\n");
  const parsed = parseXER(XER_FIXTURE) || [];
  const sections = parsed.filter(t => t.isSection);
  const levels = sections.map(t => t.sectionLevel);
  const levelsOk = JSON.stringify(levels) === "[1,2,1]";                       // Phase A → Sub A1 → Empty Phase B
  const emptyOk = sections.filter(t => t.emptyWbs).length === 1 &&
    sections[sections.length - 1].emptyWbs === true &&
    sections[sections.length - 1].activity === "Empty Phase B";
  const tasksOk = parsed.filter(t => !t.isSection).map(t => t.activityId).join(",") === "A100,A110";
  results.push([
    "parseXER WBS levels + empty-WBS tagging",
    levelsOk && emptyOk && tasksOk
      ? "OK (levels [1,2,1], empty WBS tagged, 2 activities)"
      : `UNEXPECTED (levels=${JSON.stringify(levels)} empty=${emptyOk} tasks=${tasksOk})`,
  ]);
} catch (e) {
  results.push(["parseXER WBS levels + empty-WBS tagging", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 9: relationships must survive export (XER TASKPRED / P6 XML) ───────
// Regression: exportXER wrote the TASKPRED header but NO %R rows, so every
// relationship was lost on export (P6 imported the programme with zero links).
try {
  const { buildXER } = await server.ssrLoadModule("/src/lib/exportXER.js");
  const { parseXER } = await server.ssrLoadModule("/src/lib/parseXER.js");

  const relTasks = [
    { id: "s1", isSection: true, activity: "Phase A" },
    { id: 1, activityId: "A100", activity: "Task 1", start: "2025-01-06", end: "2025-01-10", links: [{ succId: 2, type: "FS", lag: 2 }] },
    { id: 2, activityId: "A200", activity: "Task 2", start: "2025-01-13", end: "2025-01-17", link: 3, relType: "SS", linkOffset: 0 },
    { id: 3, activityId: "A300", activity: "Task 3", start: "2025-01-20", end: "2025-01-24", links: [{ succId: 4, type: "FF", lag: 1 }] },
    { id: 4, activityId: "A400", activity: "Task 4 (no dates → not exported)" },
    { id: 5, activityId: "A500", activity: "Task 5", start: "2025-02-03", end: "2025-02-07",
      links: [{ succId: 2, type: "FS", lag: 0 }, { succId: 2, type: "FS", lag: 0 }] },  // duplicate → 1 row
  ];
  const xer = buildXER(relTasks, { version: "20.12", projectId: "PROJ001", projectName: "Rel Test" });
  const xerLines = xer.split("\r\n");
  const predStart = xerLines.findIndex(l => l === "%T\tTASKPRED");
  const predFields = (xerLines[predStart + 1] || "").replace("%F\t", "").split("\t");
  const predRows = [];
  for (let i = predStart + 2; i < xerLines.length && xerLines[i] !== "%E"; i++) {
    if (xerLines[i].startsWith("%R\t")) {
      const v = xerLines[i].slice(3).split("\t");
      predRows.push(Object.fromEntries(predFields.map((f, k) => [f, v[k]])));
    }
  }
  // A100→A200 (FS, 2d=16h) · A200→A300 (SS, 0) · A500→A200 (FS, 0)
  // A300→A400 is dropped because A400 has no dates and therefore no TASK row.
  const relOk = predRows.length === 3 &&
    predRows[0].task_id === "2" && predRows[0].pred_task_id === "1" && predRows[0].pred_type === "PR_FS" && predRows[0].lag_hr_cnt === "16" &&
    predRows[1].task_id === "3" && predRows[1].pred_task_id === "2" && predRows[1].pred_type === "PR_SS" && predRows[1].lag_hr_cnt === "0" &&
    predRows[2].task_id === "2" && predRows[2].pred_task_id === "4" && predRows[2].pred_type === "PR_FS";

  results.push([
    "buildXER TASKPRED (relationships exported)",
    relOk ? `OK (${predRows.length} rows: FS/lag16, SS/lag0, FS/lag0; skipped-task edge dropped; duplicate de-duped)`
          : `UNEXPECTED (${predRows.length} rows: ${JSON.stringify(predRows)})`,
  ]);

  // Round trip: re-importing the exported file must restore the relationships
  const back = parseXER(xer) || [];
  const find = (code) => back.find(r => !r.isSection && r.activityId === code);
  const a100 = find("A100"), a200 = find("A200");
  const rtOk = a100?.links?.length === 1 && a100.links[0].succCode === "A200" && a100.links[0].type === "FS" && a100.links[0].lag === 2 &&
    a200?.links?.length === 1 && a200.links[0].succCode === "A300" && a200.links[0].type === "SS";
  results.push([
    "XER relationship round-trip (buildXER → parseXER)",
    rtOk ? "OK (A100→A200 FS/2 and A200→A300 SS/0 restored)" : `UNEXPECTED (A100=${JSON.stringify(a100?.links)} A200=${JSON.stringify(a200?.links)})`,
  ]);

  // A file with no relationships must still produce a well-formed (empty) TASKPRED table
  const plain = buildXER([{ id: 1, activityId: "B1", activity: "Solo", start: "2025-01-01", end: "2025-01-02" }]);
  const pl = plain.split("\r\n");
  const ps = pl.findIndex(l => l === "%T\tTASKPRED");
  const emptyRows = pl.slice(ps + 2).filter(l => l.startsWith("%R\t")).length;
  results.push([
    "buildXER TASKPRED (no relationships)",
    emptyRows === 0 ? "OK (header written, 0 data rows)" : `UNEXPECTED (${emptyRows} rows)`,
  ]);

  // Links that carry only `succCode` (not yet resolved to a task id) must still export
  const codeOnly = buildXER([
    { id: 1, activityId: "C1", activity: "A", start: "2025-03-03", end: "2025-03-04", links: [{ succCode: "C2", type: "FF", lag: 3 }] },
    { id: 2, activityId: "C2", activity: "B", start: "2025-03-05", end: "2025-03-07" },
  ]);
  const cl = codeOnly.split("\r\n");
  const cs = cl.findIndex(l => l === "%T\tTASKPRED");
  const cRows = cl.slice(cs + 2).filter(l => l.startsWith("%R\t")).map(l => l.slice(3).split("\t"));
  const codeOk = cRows.length === 1 && cRows[0][1] === "2" && cRows[0][2] === "1" && cRows[0][5] === "PR_FF" && cRows[0][6] === "24";
  results.push([
    "buildXER TASKPRED (succCode-only link fallback)",
    codeOk ? "OK (resolved by activity code, FF with lag 24h)" : `UNEXPECTED (${JSON.stringify(cRows)})`,
  ]);

  // Raw parseXER output (no resolveImportedLinks) must still export relationships
  const RAW_XER = [
    "ERMHDR\t19.12\t2023-09-01\tProject\tADMIN\tUser\tdbx\tProject Management\tUSD",
    "%T\tTASK",
    "%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\tearly_start_date\tearly_end_date",
    "%R\t501\t1\t2\t1\tA100\tExcavate\t2023-09-01 08:00\t2023-09-05 17:00",
    "%R\t502\t1\t2\t1\tA110\tPiling\t2023-09-06 08:00\t2023-09-08 17:00",
    "%T\tTASKPRED",
    "%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt",
    "%R\t1\t502\t501\t1\t1\tPR_FS\t0",
    "%E",
  ].join("\r\n");
  const rawXer = buildXER(parseXER(RAW_XER), {});
  const rl = rawXer.split("\r\n");
  const rs = rl.findIndex(l => l === "%T\tTASKPRED");
  const rawRows = rl.slice(rs + 2).filter(l => l.startsWith("%R\t")).map(l => l.slice(3).split("\t"));
  const rawOk = rawRows.length === 1 && rawRows[0][5] === "PR_FS";
  results.push([
    "buildXER TASKPRED (raw parseXER output, linkSuccCode)",
    rawOk ? "OK (relationship kept straight after parseXER, no resolveImportedLinks step)" : `UNEXPECTED (${JSON.stringify(rawRows)})`,
  ]);
} catch (e) {
  results.push(["buildXER TASKPRED (relationships exported)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

try {
  const { buildP6XML } = await server.ssrLoadModule("/src/lib/exportP6XML.js");
  const xmlTasks = [
    { id: "s1", isSection: true, activity: "Phase A" },
    { id: 1, activityId: "A100", activity: "Task 1", start: "2025-01-06", end: "2025-01-10",
      links: [{ succId: 2, type: "FS", lag: 2 }, { succId: 3, type: "SS", lag: 1 }] },
    { id: 2, activityId: "A200", activity: "Task 2", start: "2025-01-13", end: "2025-01-17" },
    { id: 3, activityId: "A300", activity: "Task 3", start: "2025-01-20", end: "2025-01-24" },
  ];
  const xml = buildP6XML(xmlTasks, { projectId: "PROJ001", projectName: "Rel Test" });
  const relBlocks = (xml.match(/<Relationship>/g) || []).length;
  const hasFS = /<Type>Finish to Start<\/Type>/.test(xml);
  const hasSS = /<Type>Start to Start<\/Type>/.test(xml);
  const lagOk = /<Lag>16<\/Lag>/.test(xml) && /<Lag>8<\/Lag>/.test(xml);
  results.push([
    "buildP6XML relationships (links[] array)",
    relBlocks === 2 && hasFS && hasSS && lagOk
      ? "OK (2 relationships from links[], FS + SS with lag 16h / 8h)"
      : `UNEXPECTED (blocks=${relBlocks} fs=${hasFS} ss=${hasSS} lag=${lagOk})`,
  ]);

  // succCode-only fallback (link not yet resolved to a task id)
  const xmlCode = buildP6XML([
    { id: 1, activityId: "C1", activity: "A", start: "2025-03-03", end: "2025-03-04", links: [{ succCode: "C2", type: "SS", lag: 0 }] },
    { id: 2, activityId: "C2", activity: "B", start: "2025-03-05", end: "2025-03-07" },
  ], { projectId: "PROJ001", projectName: "Rel Test" });
  const xmlCodeBlocks = (xmlCode.match(/<Relationship>/g) || []).length;
  results.push([
    "buildP6XML relationships (succCode-only fallback)",
    xmlCodeBlocks === 1 && /<Type>Start to Start<\/Type>/.test(xmlCode)
      ? "OK (resolved by activity code)"
      : `UNEXPECTED (blocks=${xmlCodeBlocks})`,
  ]);
} catch (e) {
  results.push(["buildP6XML relationships (links[] array)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── PDF embedded-data round trip (export → re-upload) ────────────────────────
// Every PDF exported by the app carries the whole task array in its metadata, so
// re-uploading it must restore every field exactly (no AI/OCR pass).
try {
  const { buildGanttPDF } = await server.ssrLoadModule("/src/lib/exportGanttPDF.js");
  const { encodeTasksForPDF, decodeTasksFromPDFInfo } = await server.ssrLoadModule("/src/lib/ganttPDFData.js");

  const richTasks = [
    { id: "s1", isSection: true, sectionLevel: 1, activity: "Phase A — Foundations", sectionType: "blue" },
    { id: 1, activityId: "A100", activity: "Excavate", item: "1", start: "2025-01-06", end: "2025-01-10",
      baselineStart: "2025-01-02", baselineFinish: "2025-01-08", startActual: true, endActual: true,
      remainDur: 0, float: 0, pct: 100, earlyStart: "2025-01-06", earlyEnd: "2025-01-10",
      lateStart: "2025-01-07", lateEnd: "2025-01-13", freeFloat: 0, primaryResource: "CARP",
      durationType: "DT_FixedDUR2", statusCode: "TK_Complete", drivingPathFlag: "Y",
      locationId: "Z1", p6Guid: "GUID-1", links: [{ succId: 2, type: "FS", lag: 2 }] },
    { id: 2, activityId: "A110", activity: "Piling 樁", item: "2", start: "2025-01-13", end: "2025-01-17",
      baselineStart: "2025-01-09", baselineFinish: "2025-01-15", startActual: true, remainDur: 3, float: 5, pct: 40,
      link: 3, relType: "SS", linkOffset: 1, constraintType: "CS_MSO", constraintDate: "2025-01-13" },
    { id: 3, activityId: "A120", activity: "Cast slab", item: "3", start: "2025-01-20", end: "2025-01-24" },
  ];

  const embedData = await encodeTasksForPDF(richTasks);
  const { doc } = buildGanttPDF({ tasks: richTasks, projectTitle: "Round Trip", programmeRef: "RTT-1", embedData });
  const bytes = new Uint8Array(doc.output("arraybuffer"));

  const pdf = await pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const info = (await pdf.getMetadata()).info;
  const back = await decodeTasksFromPDFInfo(info);
  await pdf.destroy();

  const same = JSON.stringify(back) === JSON.stringify(richTasks);
  results.push([
    "PDF embedded data round trip (export → re-upload)",
    same
      ? `OK (${richTasks.length} records, ${embedData.bytes} bytes JSON → ${embedData.subject.length + embedData.keywords.length} chars embedded, every field identical)`
      : `UNEXPECTED (decoded ${back ? back.length : 0} records)${back ? `: ${JSON.stringify(back).slice(0, 300)}` : ""}`,
  ]);

  // A foreign PDF (no marker) must NOT be mistaken for embedded data
  const plainDoc = buildGanttPDF({ tasks: richTasks, projectTitle: "No marker" }).doc;
  const plainPdf = await pdfjsLib.getDocument({ data: new Uint8Array(plainDoc.output("arraybuffer")), isEvalSupported: false }).promise;
  const plainInfo = (await plainPdf.getMetadata()).info;
  const plainBack = await decodeTasksFromPDFInfo(plainInfo);
  await plainPdf.destroy();
  results.push([
    "PDF without embedded marker → falls back to AI path",
    plainBack === null ? "OK (decode returns null)" : `UNEXPECTED (${JSON.stringify(plainBack).slice(0, 120)})`,
  ]);

  // Legacy V2 payload (plain base64) must still decode
  const legacyJson = JSON.stringify([{ id: 9, activityId: "L1", activity: "Legacy", start: "2025-02-03", end: "2025-02-04" }]);
  const legacyInfo = {
    Subject: "GANTT_DATA_V2:" + Buffer.from(legacyJson, "utf8").toString("base64"),
    Author: "chunks:1",
    Keywords: "",
  };
  const legacyBack = await decodeTasksFromPDFInfo(legacyInfo);
  results.push([
    "PDF embedded data (legacy V2 payload)",
    legacyBack && legacyBack.length === 1 && legacyBack[0].activityId === "L1"
      ? "OK (old-format PDFs still restore)"
      : `UNEXPECTED (${JSON.stringify(legacyBack)})`,
  ]);
} catch (e) {
  results.push(["PDF embedded data round trip (export → re-upload)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Page-level render guard ──────────────────────────────────────────────────
// Renders the REAL page (no props) so TDZ / undefined-variable / bad-hook errors
// that blank the whole app are caught here instead of in the browser.
await check("/src/pages/GanttPage.jsx", "GanttPage (full page render)");

// ── Batch 18 regression guard: unified settings panel (xerviewer-style rail) ──
// The panel hosts the existing panels in their `embedded` mode, so this also
// guards those panels' chromeless rendering path (no backdrop / title / tabs).
const COLUMN_VIS_FIXTURE = { item: true, activityId: true, activity: true, start: true, end: true };
const PANEL_PROPS = {
  displaySettings: {
    dateFormat: "yyyy-MM-dd",
    bar: { label: { show: true } },
    grid: {},
    wbs: { schemeId: "cool-blues", levels: null, hideEmpty: true, groupHeadersOnGantt: true },
  },
  onChange: () => {},
  viewMode: "month",
  onViewModeChange: () => {},
  collapsedCount: 2,
  onExpandAll: () => {},
  onCollapseAll: () => {},
  columnVisibility: COLUMN_VIS_FIXTURE,
  setColumnVisibility: () => {},
  displayToggles: [
    { label: "Holiday Markers", on: true, toggle: () => {} },
    { label: "Staircase Line", on: false, toggle: () => {} },
  ],
  otherExtras: null,
  onClose: () => {},
};
for (const t of ["wbs", "activity-list", "timeline-grid", "gantt-bars", "other"]) {
  await check("/src/components/gantt/GlobalSettingsPanel.jsx", `GlobalSettingsPanel (${t} tab)`, {
    ...PANEL_PROPS,
    initialTab: t,
  });
}
// Structure guard: the rail must carry all five categories, every category body
// must be present, and the embedded panels must NOT render their own titles
// (that is the whole point of moving them behind the rail).
try {
  const { default: GlobalSettingsPanel } = await server.ssrLoadModule("/src/components/gantt/GlobalSettingsPanel.jsx");
  const html = (tab) => renderToString(
    React.createElement(GlobalSettingsPanel, { ...PANEL_PROPS, initialTab: tab })
  ).replace(/<!--[^>]*-->/g, "");
  const wbsHtml = html("wbs");
  const markers = [
    ...["WBS", "Activity List", "Timeline &amp; Grid", "Gantt Bars", "Other"].map((r) => [`rail label ${r}`, wbsHtml.includes(`>${r}<`)]),
    ["wbs body (schemes + toggles + grouping + level styles)", ["WBS Row Color Scheme", "Hide Empty WBS Rows", "Customise Grouping", "Custom WBS Level Styles"].every((m) => wbsHtml.includes(m))],
    ["activity list body (column settings)", html("activity-list").includes("Show All")],
    ["timeline & grid body", html("timeline-grid").includes("Timeline")],
    ["gantt bars body (presets)", html("gantt-bars").includes("Preset")],
    ["other body (display toggles)", html("other").includes("Holiday Markers")],
    ["embedded: no duplicate panel titles", !wbsHtml.includes("gantt-wbs-settings-title") && !html("timeline-grid").includes("Gantt Settings")],
  ];
  const missing = markers.filter(([, ok]) => !ok).map(([m]) => m);
  results.push([
    "GlobalSettingsPanel markup (rail + 5 category bodies + chromeless embed)",
    missing.length === 0 ? "OK (rail 5 labels, all bodies present, no duplicate titles)" : `UNEXPECTED (missing: ${missing.join(", ")})`,
  ]);
} catch (e) {
  results.push(["GlobalSettingsPanel markup (rail + bodies)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 6 regression guard ─────────────────────────────────────────────────
// A very verbose per-row schema makes the model stop after 2-3 rows on dense
// pages. Measured on a real A4 P6 print (20231024-1046_01649 … page 2):
//   37 row fields → 3 rows   |   16 row fields → 31 rows
// The vision paths must therefore keep using the lean GANTT_VISION_TASK_SCHEMA.
try {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/components/gantt/ImageImportDialog.jsx", "utf8");
  const block = (src.match(/const GANTT_VISION_TASK_SCHEMA = \{[\s\S]*?\n\};/) || [""])[0];
  const fieldCount = (block.match(/\{\s*type:\s*"(string|number|boolean)"\s*\}/g) || []).length;
  const visionCallSites = (src.match(/response_json_schema: GANTT_VISION_TASK_SCHEMA/g) || []).length;
  const fidelityRule = /NEVER invent values/.test(src);
  const ok = fieldCount > 0 && fieldCount <= 18 && visionCallSites === 2 && fidelityRule;
  results.push([
    "ImageImportDialog vision schema (row-count guard)",
    ok
      ? `OK (${fieldCount} row fields, ${visionCallSites} vision call sites, fidelity rule present)`
      : `FAILED (row fields=${fieldCount}, vision call sites=${visionCallSites}, fidelity rule=${fidelityRule})`,
  ]);
} catch (e) {
  results.push(["ImageImportDialog vision schema (row-count guard)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 7 regression guard ─────────────────────────────────────────────────
// A 4-page scan-only programme lost 25% of its pages because page 1 was always
// dropped, and pages were re-rendered at only ~1263px long edge (108 dpi) while the
// embedded scan was 300 dpi. Both must stay fixed.
try {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/components/gantt/ImageImportDialog.jsx", "utf8");
  // strip full-line comments so the explanatory comments about the old behaviour
  // don't make this guard trip on itself
  const code = src.replace(/^\s*\/\/.*$/gm, "");
  const dropsPageOne = /totalPages === 1 \? 1 : 2/.test(code);
  const sendsAllPages = /Array\.from\(\{ length: totalPages \}, \(_, i\) => i \+ 1\)/.test(code);
  const longEdge = Number((src.match(/const PDF_RENDER_LONG_EDGE = (\d+)/) || [])[1] || 0);
  const retargetsRender = /const scale = Math\.min\(PDF_RENDER_MAX_SCALE, PDF_RENDER_LONG_EDGE \/ longEdge\)/.test(code);
  const ok = !dropsPageOne && sendsAllPages && longEdge >= 2600 && retargetsRender;
  results.push([
    "ImageImportDialog page range + render size (batch 7 guard)",
    ok
      ? `OK (all pages sent, long edge ${longEdge}px)`
      : `FAILED (dropsPage1=${dropsPageOne}, sendsAllPages=${sendsAllPages}, longEdge=${longEdge}, retargetsRender=${retargetsRender})`,
  ]);
} catch (e) {
  results.push(["ImageImportDialog page range + render size (batch 7 guard)", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

console.log("SMOKE TEST RESULTS");
for (const [l, r] of results) console.log(`  ${l}: ${r}`);
await server.close();
process.exit(0);
