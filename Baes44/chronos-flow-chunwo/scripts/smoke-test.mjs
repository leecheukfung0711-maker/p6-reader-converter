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

/**
 * Text items of a built PDF, with their x/y position (PDF points). Used instead of
 * byte comparisons for "where is this drawn" assertions: two builds always differ by
 * a CreationDate timestamp, so string equality proves nothing — coordinates do.
 */
async function pdfTextItems(doc) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(doc.output("arraybuffer")), isEvalSupported: false }).promise;
  const items = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    for (const it of content.items) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height });
  }
  await pdf.destroy();
  return items;
}
/**
 * x of a bar caption: the right-most match. The same text also appears in the left
 * activity table (Activity / Start / End columns), so the caption on the chart is the
 * match furthest to the right.
 */
const itemX = (items, needle) => {
  const xs = items.filter((i) => i.str.includes(needle)).map((i) => i.x);
  return xs.length ? Math.max(...xs) : null;
};
/** Width (in points) of that same bar caption. */
const itemWidth = (items, needle) => {
  const hits = items.filter((i) => i.str.includes(needle));
  if (!hits.length) return null;
  return hits.reduce((a, b) => (b.x > a.x ? b : a)).width;
};
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

// ── Batch 23A/23C: WBS level editing + numbering-based inference ──────────────
// Non-XER imports used to create every section at Level 1; levels can now be
// derived from the section numbering and corrected from the row context menu.
try {
  const {
    levelFromTitle, inferSectionLevels, clampWbsLevel, wbsIndentPx, levelStatsLabel, WBS_INDENT_STEP,
  } = await server.ssrLoadModule("/src/lib/wbsLevel.js");

  const parsed = {
    "1 Site Preparation": 1, "1.0 Site Preparation": 1, "1.1 Excavation": 2,
    "1.1.1 Trial Pit": 3, "2.1.0.0 Backfill": 2, "A.2 Sub-phase": 2,
    "CW.1.1 Manhole": 3, "第1章 概述": 1, "3) Drainage": 1,
    "No numbering here": 0, "Contract No. DC/2023/08": 0, "": 0,
    "9.9.9.9.9.9.9.9 Too deep": 7,          // clamped to the 7 colour steps
  };
  const parserOk = Object.entries(parsed).every(([title, level]) => levelFromTitle(title) === level);

  // Inference: numbering wins, the vision model's WBS-band hint is the fallback,
  // XER levels are never overwritten.
  const fixture = [
    { id: 1, isSection: true, activity: "1 Site Preparation" },                 // → L1 (numbering)
    { id: 2, activityId: "A100", activity: "Excavate" },                        // activity: untouched
    { id: 3, isSection: true, activity: "1.1 Excavation" },                     // → L2 (numbering)
    { id: 4, isSection: true, activity: "1.1.1 Trial Pit" },                    // → L3 (numbering)
    { id: 5, isSection: true, activity: "2.0 Site Clearance", sectionLevel: 2 },// XER level kept
    { id: 6, isSection: true, activity: "No numbering" },                       // → unresolved
    { id: 7, isSection: true, activity: "MiC Installation", aiSectionLevel: 1 },// → L1 (AI hint)
    { id: 8, isSection: true, activity: "All Zones AS & BS", aiSectionLevel: 2 },// → L2 (AI hint)
    { id: 9, isSection: true, activity: "1.9 Numbered wins", aiSectionLevel: 3 },// numbering wins → L2
  ];
  const { tasks: levelled, stats } = inferSectionLevels(fixture);
  const byId = Object.fromEntries(levelled.map(t => [t.id, t]));
  const inferOk =
    byId[1].sectionLevel === 1 && byId[3].sectionLevel === 2 && byId[4].sectionLevel === 3 &&
    byId[5].sectionLevel === 2 &&                       // kept, not re-derived
    byId[6].sectionLevel === undefined && byId[2].sectionLevel === undefined &&
    byId[7].sectionLevel === 1 && byId[8].sectionLevel === 2 &&   // AI hint used
    byId[9].sectionLevel === 2 &&                       // deterministic numbering beats the AI hint
    levelled[1].activity === "Excavate" &&              // activities untouched
    stats.sections === 8 && stats.inferred === 6 &&
    stats.fromTitle === 4 && stats.fromAi === 2 && stats.kept === 1 && stats.unresolved === 1 &&
    levelStatsLabel(stats) === "L1 2 ／ L2 4 ／ L3 1";

  // Level clamp + indent maths (12px per level, base indent preserved)
  const clampOk = clampWbsLevel(0) === 1 && clampWbsLevel(9) === 7 && clampWbsLevel(undefined) === 1 &&
                  clampWbsLevel("3") === 3;
  const indentOk = wbsIndentPx(1) === 0 && wbsIndentPx(2) === WBS_INDENT_STEP &&
                   wbsIndentPx(3, 4) === 4 + 2 * WBS_INDENT_STEP &&
                   wbsIndentPx(3, 4, false) === 4;      // toggle off → pre-23 look

  results.push([
    "WBS level helpers (numbering parse + inference + clamp + indent)",
    parserOk && inferOk && clampOk && indentOk
      ? `OK (parser ${Object.keys(parsed).length} cases, inferred ${stats.inferred}/${stats.sections}, clamp 1..7, indent ${WBS_INDENT_STEP}px/level)`
      : `UNEXPECTED (parser=${parserOk} infer=${inferOk} clamp=${clampOk} indent=${indentOk})`,
  ]);
} catch (e) {
  results.push(["WBS level helpers", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// The row context menu must expose the level editor for programme rows.
try {
  const { default: RowContextMenu } = await server.ssrLoadModule("/src/components/gantt/RowContextMenu.jsx");
  const html = renderToString(React.createElement(RowContextMenu, {
    x: 10, y: 10,
    task: { id: 1, isSection: true, activity: "1.1 Excavation", sectionLevel: 2 },
    taskIdx: 3,
    onClose: () => {}, onAction: () => {}, onColorChange: () => {}, onSectionColorChange: () => {},
  })).replace(/<!--[^>]*-->/g, "");
  const markers = [
    "Programme Section · Level 2", "WBS Level — now 2",
    "Set WBS Level 1", "Set WBS Level 7", "Already Level 2",
    "Indent (Level +1)", "Outdent (Level −1)",
  ];
  const missing = markers.filter(m => !html.includes(m));
  results.push([
    "RowContextMenu WBS level editor (7 buttons + indent/outdent)",
    missing.length === 0 ? `OK (all ${markers.length} markers present)` : `MISSING: ${missing.join(", ")}`,
  ]);
} catch (e) {
  results.push(["RowContextMenu WBS level editor", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 24: page-by-page text import (chunk planning + merge + wiring) ─────
try {
  const {
    planTextChunks, mergeChunkTasks, mapWithConcurrency, looksLikeProgrammeText,
    TEXT_CHUNK_MAX_CHARS, TEXT_CHUNK_MAX_PAGES,
  } = await server.ssrLoadModule("/src/lib/textChunks.js");

  // 27 pages × ~3600 chars (a real 6WSD21-DP monthly print) → page-aligned batches
  const pageTexts = Array.from({ length: 27 }, (_, i) => ({ page: i + 1, text: "x".repeat(3600) }));
  const chunks = planTextChunks(pageTexts);
  const chunkOk =
    chunks.length === Math.ceil(27 / TEXT_CHUNK_MAX_PAGES) &&
    chunks.every((c) => c.pages.length <= TEXT_CHUNK_MAX_PAGES && c.text.length <= TEXT_CHUNK_MAX_CHARS) &&
    chunks[0].pages[0] === 1 && chunks[chunks.length - 1].pages.slice(-1)[0] === 27 &&
    chunks.reduce((n, c) => n + c.pages.length, 0) === 27 &&            // no page dropped
    JSON.stringify(planTextChunks([{ page: 1, text: "y".repeat(30000) }])[0].pages) === "[1]";  // oversized page kept whole

  // Merge: chunk order preserved, exact repeats (page overlap) dropped, blanks kept
  const merged = mergeChunkTasks([
    [{ activityId: "A1", activity: "One", start: "2024-01-01", end: "2024-01-02" }],
    [{ activityId: "A1", activity: "One", start: "2024-01-01", end: "2024-01-02" }, { activityId: "A2", activity: "Two" }],
    [{ activity: "", activityId: "", start: "", end: "" }, { activity: "Section" }],
  ]);
  const mergeOk = merged.length === 4 && merged[0].activityId === "A1" && merged[1].activityId === "A2"
    && merged[2].activity === "" && merged[3].activity === "Section";

  // Concurrency helper must return results in the input order (document order),
  // even though the work itself finishes out of order.
  const finished = [];
  const ordered = await mapWithConcurrency([30, 10, 20, 5], 2, async (ms) => {
    await new Promise(r => setTimeout(r, ms));
    finished.push(ms);
    return ms;
  });
  const concOk = JSON.stringify(ordered) === JSON.stringify([30, 10, 20, 5])
    && JSON.stringify(finished) !== JSON.stringify([30, 10, 20, 5]);

  const looksOk = looksLikeProgrammeText("WSD-MiC-1790  1/F 02-Jan-24 04-Jan-24") === true
    && looksLikeProgrammeText("Cover page\nRevision A") === false
    && looksLikeProgrammeText("") === false;

  // splitLongText: an over-long sheet/page is cut on line boundaries, nothing lost
  const { splitLongText } = await server.ssrLoadModule("/src/lib/textChunks.js");
  const longLines = Array.from({ length: 40 }, (_, i) => `row ${i} ${"z".repeat(400)}`).join("\n");
  const split = splitLongText(longLines);
  const splitOk = split.length > 1 && split.every((p) => p.length <= TEXT_CHUNK_MAX_CHARS)
    && split.join("\n").replace(/\n/g, "").length === longLines.replace(/\n/g, "").length
    && splitLongText("short text")[0] === "short text";

  results.push([
    "textChunks (page-aligned batches + merge + order-preserving pool)",
    chunkOk && mergeOk && concOk && looksOk && splitOk
      ? `OK (27 pages → ${chunks.length} batches of ≤${TEXT_CHUNK_MAX_PAGES} pages, merge dedupes repeats, order kept, long text split without loss)`
      : `UNEXPECTED (chunks=${chunkOk} merge=${mergeOk} concurrency=${concOk} looks=${looksOk} split=${splitOk})`,
  ]);

  // Regression guard: the old single call silently dropped everything past
  // character 24 000 (35 % of a 27-page print). Page-by-page batching must stay wired.
  const { readFileSync: readSrc } = await import("node:fs");
  const impSrc = readSrc("src/components/gantt/ImageImportDialog.jsx", "utf8");
  const wired = /extractNativePDFTextByPage\(pdf, schedulePageNums\)/.test(impSrc)
    && /planTextChunks\(units\)/.test(impSrc)
    && /mergeChunkTasks\(chunkTasks\)/.test(impSrc)
    && /onCoverage && onCoverage\(coverage\)/.test(impSrc)
    && !/substring\(0, 24000\)/.test(impSrc)
    && !/substring\(0, 20000\)/.test(impSrc);       // Excel path: same class of bug
  results.push([
    "ImageImportDialog text/Excel paths (per-page batching, no 24k/20k truncation)",
    wired ? "OK (all pages batched; the 24 000-character truncation is gone)"
      : `UNEXPECTED (extract=${/extractNativePDFTextByPage/.test(impSrc)} plan=${/planTextChunks\(pageTexts\)/.test(impSrc)} merge=${/mergeChunkTasks\(chunkTasks\)/.test(impSrc)} coverage=${/onCoverage && onCoverage\(coverage\)/.test(impSrc)} truncation=${/substring\(0, 24000\)/.test(impSrc)} srcLen=${impSrc.length})`,
  ]);
} catch (e) {
  results.push(["textChunks batch 24", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 25: local OCR cross-check (compare → re-read → splice back) ─────────
try {
  const {
    foldOcrId, extractActivityIds, comparePageCoverage, mergeRecoveredRows, buildRecoveryPrompt,
    OCR_MISSING_RATIO, OCR_MIN_MISSING,
  } = await server.ssrLoadModule("/src/lib/localOcr.js");

  // OCR noise folding: separators ignored, classic confusions mapped
  const foldOk = foldOcrId("WSD-MiC-1790") === foldOcrId("wsd mic 1790")
    && foldOcrId("WSD-MIC-179O") === foldOcrId("WSD-MIC-1790")      // letter O vs zero
    && foldOcrId("WSD-KD1-12a") === foldOcrId("WSD-KD1-12A");

  const ids = extractActivityIds("Project…\nBR1 WSD-W-ELS-1470 Footing\nWSD-MiC-1790 1/F\nnot an id here\n2024-01-02\nA1 short cell");
  const extractOk = ids.length === 2                                   // "BR1"/"A1" are table cells, not IDs
    && ids.some((i) => i.folded === foldOcrId("WSD-W-ELS-1470"))
    && ids.some((i) => i.folded === foldOcrId("WSD-MiC-1790"));

  // Real data: a cloud run that returned a single row for this page (saved A/B output)
  // must be flagged, while a complete-looking answer must not.
  const localIds = idsFor(["WSD-MiC-1790", "WSD-MiC-1810", "WSD-MiC-1830", "WSD-MiC-1850", "WSD-MiC-1870", "WSD-KD1-11"]);
  const shortAnswer = comparePageCoverage([{ activityId: "WSD-MiC-1790" }], localIds);
  const fullAnswer = comparePageCoverage(localIds.map((id) => ({ activityId: id.display })), localIds);
  const smallLocal = comparePageCoverage([], localIds.slice(0, 2));
  const compareOk = shortAnswer.needsRerun === true
    && shortAnswer.missing.length === 5
    && Math.round(shortAnswer.missingRatio * 100) === 83
    && fullAnswer.needsRerun === false && fullAnswer.missing.length === 0
    && smallLocal.needsRerun === false                              // not enough signal
    && comparePageCoverage([], localIds, { minMissing: 9 }).needsRerun === false;

  // Splice back: new rows land next to their neighbours, existing rows keep order
  const base = [
    { id: 1, activityId: "A-1", activity: "One", start: "2024-01-01", end: "" },
    { id: 2, activityId: "A-3", activity: "Three", start: "2024-03-01", end: "2024-03-05" },
  ];
  const recovered = [
    { activityId: "A-1", activity: "One", start: "2024-01-01", end: "2024-01-09" },   // completes the end date
    { activityId: "A-2", activity: "Two", start: "2024-02-01", end: "2024-02-05" },   // new, belongs between A-1 and A-3
    { activityId: "A-3", activity: "Three", start: "2024-03-01", end: "2024-03-05" }, // anchor: we already had it
    { activityId: "A-4", activity: "Four", start: "2024-04-01", end: "2024-04-05" },  // new, after A-3
  ];
  const spliced = mergeRecoveredRows(base, recovered);
  const spliceOk = spliced.rows.length === 4
    && spliced.rows.map((r) => r.activityId).join(",") === "A-1,A-2,A-3,A-4"    // position preserved
    && spliced.rows[0].end === "2024-01-09"                                     // gap filled, not overwritten
    && spliced.rows[0].start === "2024-01-01"
    && spliced.added === 2 && spliced.enriched === 1
    && mergeRecoveredRows(base, []).rows.length === 2;

  const promptOk = /A first pass over this page MISSED rows/.test(buildRecoveryPrompt({ pageLabel: "page 3", missingIds: localIds.slice(0, 2), localText: "x" }))
    && /WSD-MiC-1790/.test(buildRecoveryPrompt({ pageLabel: "page 3", missingIds: localIds.slice(0, 2), localText: "x" }));

  results.push([
    "localOcr (fold + id extraction + short-page verdict + splice back)",
    foldOk && extractOk && compareOk && spliceOk && promptOk
      ? `OK (short answer flagged ${Math.round(shortAnswer.missingRatio * 100)}% missing, splice keeps order, thresholds ${OCR_MISSING_RATIO}/${OCR_MIN_MISSING})`
      : `UNEXPECTED (fold=${foldOk} extract=${extractOk} compare=${compareOk} splice=${spliceOk} prompt=${promptOk})`,
  ]);
} catch (e) {
  results.push(["localOcr cross-check", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

function idsFor(list) {
  // Mirrors what readPageLocally() returns: display text + the folded key.
  return list.map((display) => ({ folded: display.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/[OQG]/g, "0").replace(/[IL]/g, "1").replace(/[SZ]/g, "5").replace(/B/g, "8"), display }));
}

// ── Batch 25b: local OCR engine selection (adapters + graceful failure) ───────
try {
  const {
    LOCAL_OCR_ENGINES, engineById, blobToBase64, readPageLocally, probeLocalOcr, loadLocalOcrSettings,
  } = await server.ssrLoadModule("/src/lib/localOcr.js");

  const registryOk = LOCAL_OCR_ENGINES.length === 3
    && LOCAL_OCR_ENGINES.map((e) => e.id).join(",") === "ppocr,ollama,pstocr"
    && new Set(LOCAL_OCR_ENGINES.map((e) => e.defaultUrl)).size === 3      // no shared default
    && engineById("ollama").needsModel === true && engineById("ppocr").needsModel === false
    && engineById("does-not-exist").id === "ppocr";                        // unknown → safe default

  // Settings fall back cleanly when localStorage does not exist (SSR / Node)
  const defaults = loadLocalOcrSettings();
  const settingsOk = defaults.enabled === true && defaults.engine === "ppocr" && /8199/.test(defaults.url);

  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" });
  const b64 = await blobToBase64(blob);
  const base64Ok = b64 === Buffer.from([1, 2, 3, 4]).toString("base64");

  // A dead port must never throw — the import simply runs without a cross-check.
  const dead = { engine: "ppocr", url: "http://127.0.0.1:9" };
  const deadProbe = await probeLocalOcr(dead, 3000);
  const deadRead = await readPageLocally(blob, dead, 3000);
  const ollamaNoModel = await readPageLocally(blob, { engine: "ollama", url: "http://127.0.0.1:9", model: "" }, 3000);
  const gracefulOk = deadProbe.available === false && typeof deadProbe.error === "string"
    && deadRead === null && ollamaNoModel === null;

  results.push([
    "localOcr engines (registry + adapters + graceful failure)",
    registryOk && settingsOk && base64Ok && gracefulOk
      ? `OK (${LOCAL_OCR_ENGINES.length} engines: ${LOCAL_OCR_ENGINES.map((e) => e.id).join("/")}; dead endpoint → null, no throw)`
      : `UNEXPECTED (registry=${registryOk} settings=${settingsOk} base64=${base64Ok} graceful=${gracefulOk})`,
  ]);
} catch (e) {
  results.push(["localOcr engines", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 25c: the engine picker must be reachable from the UI ────────────────
try {
  const { default: LocalOcrSettings } = await server.ssrLoadModule("/src/components/gantt/LocalOcrSettings.jsx");
  const html = renderToString(React.createElement(LocalOcrSettings)).replace(/<!--[^>]*-->/g, "");
  const markers = [
    "Local OCR cross-check",
    "PP-OCR service (ocr_server.py)", "Ollama local model", "PST-OCR service (OvisOCR2)",
    "http://127.0.0.1:8199",
  ];
  const missing = markers.filter((m) => !html.includes(m));

  // Mounted in both surfaces: the Import dialog footer and Global Settings → Other.
  const { readFileSync: readSrc2 } = await import("node:fs");
  const dialogSrc = readSrc2("src/components/gantt/ImageImportDialog.jsx", "utf8");
  const settingsSrc = readSrc2("src/components/gantt/GlobalSettingsPanel.jsx", "utf8");
  const mounted = /import LocalOcrSettings from "\.\/LocalOcrSettings"/.test(dialogSrc) && /<LocalOcrSettings \/>/.test(dialogSrc)
    && /import LocalOcrSettings from "\.\/LocalOcrSettings"/.test(settingsSrc) && /<LocalOcrSettings \/>/.test(settingsSrc)
    && /tab === "other"/.test(settingsSrc);

  results.push([
    "Local OCR engine picker (rendered + mounted in Import dialog and Settings)",
    missing.length === 0 && mounted
      ? `OK (all ${markers.length} markers; both mount points present)`
      : `MISSING: ${missing.join(", ") || "(none)"} | mounted=${mounted}`,
  ]);
} catch (e) {
  results.push(["Local OCR engine picker", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 25d: launcher (auto-start the selected local engine) ────────────────
try {
  const {
    probeLauncher, startLocalService, ensureEngineRunning, LOCAL_OCR_LAUNCHER_URL,
  } = await server.ssrLoadModule("/src/lib/localOcr.js");

  const launcherOk = LOCAL_OCR_LAUNCHER_URL === "http://127.0.0.1:8199";   // PP-OCR doubles as launcher

  // Nothing listening: reporting unavailable must be fast and must NOT spawn anything.
  const deadLauncher = await probeLauncher("http://127.0.0.1:9", 3000);
  const deadStart = await startLocalService("pstocr", "http://127.0.0.1:9");

  // ensureEngineRunning with no engine and no launcher → the honest "start the helper once" hint
  const ensured = await ensureEngineRunning(
    { engine: "pstocr", url: "http://127.0.0.1:9" },
    { launcherUrl: "http://127.0.0.1:9", waitMs: 2000, pollMs: 500 },
  );
  const ensureOk = ensured.available === false && ensured.started === false
    && ensured.canAutoStart === false && /run-ocr-server\.bat/.test(String(ensured.hint));

  // The UI must auto-start on switch (or when the user presses the button) — and only then.
  const { readFileSync: readSrc3 } = await import("node:fs");
  const uiSrc = readSrc3("src/components/gantt/LocalOcrSettings.jsx", "utf8");
  const uiOk = /ensureEngineRunning\(config/.test(uiSrc)
    && /firstRun\.current/.test(uiSrc)                 // first render only probes, never spawns
    && /\[settings\.engine, settings\.url, settings\.model\]/.test(uiSrc)
    && /Start now/.test(uiSrc);

  results.push([
    "localOcr launcher (probe / start / ensure + UI auto-start wiring)",
    launcherOk && !deadLauncher.available && !deadStart.started && ensureOk && uiOk
      ? "OK (dead launcher stays silent and spawns nothing; auto-start wired on engine switch + Start now button)"
      : `UNEXPECTED (url=${launcherOk} deadProbe=${!deadLauncher.available} deadStart=${!deadStart.started} ensure=${ensureOk} ui=${uiOk})`,
  ]);
} catch (e) {
  results.push(["localOcr launcher", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 26: print content options, chosen in the Print Preview ─────────────
try {
  const { buildGanttPDF } = await server.ssrLoadModule("/src/lib/exportGanttPDF.js");
  const { default: PdfPreviewDialog } = await server.ssrLoadModule("/src/components/gantt/PdfPreviewDialog.jsx");

  // Dates are relative to today so the "today line" option really has something to draw.
  const isoDay = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const printTasks = [
    { id: 1, isSection: true, activity: "Phase 1 — Foundations", sectionLevel: 1 },
    { id: 2, activityId: "A100", activity: "Excavate", start: isoDay(-20), end: isoDay(-9),
      float: 0, baselineStart: isoDay(-24), baselineFinish: isoDay(-16) },
    { id: 3, activityId: "A110", activity: "Piling 樁基", start: isoDay(-6), end: isoDay(11),
      link: 4, relType: "FS", links: [{ succId: 4, type: "FS", lag: 0 }] },
    { id: 4, activityId: "A120", activity: "Slab", start: isoDay(14), end: isoDay(25),
      baselineStart: isoDay(7), baselineFinish: isoDay(18) },
  ];
  // Size via the data-URI string: stable in Node regardless of Blob support.
  const sizeOf = (extra) => {
    const { doc } = buildGanttPDF({ tasks: printTasks, projectTitle: "Print content", ...extra });
    return doc.output("datauristring").length;
  };

  const base = sizeOf({});
  const explicitDefaults = sizeOf({
    showHolidays: false, showToday: false, showStaircase: false,
    showRelationshipLines: false, showComparisonBars: true,
  });
  const defaultsUnchanged = base === explicitDefaults        // NFR: nothing changes unless asked
    && sizeOf({}) === base;

  const withHolidays = sizeOf({ showHolidays: true });
  const withToday = sizeOf({ showToday: true });
  const withStaircase = sizeOf({ showStaircase: true });
  const withLinks = sizeOf({ showRelationshipLines: true });
  const withoutComparison = sizeOf({ showComparisonBars: false });
  // Batch 27 — the Last Recalc Date line only draws when a date is supplied.
  const withRecalcLine = sizeOf({ showRecalcDate: true, recalcDate: isoDay(-3) });
  const recalcLineWithoutDate = sizeOf({ showRecalcDate: true });
  const honoured = withHolidays !== base && withToday !== base && withStaircase !== base
    && withLinks !== base && withoutComparison !== base && withRecalcLine !== base
    && recalcLineWithoutDate === base;      // no date → nothing drawn, output unchanged

  const stripHtml = (h) => h.replace(/<!--[^>]*-->/g, "");
  const withPanel = stripHtml(renderToString(React.createElement(PdfPreviewDialog, {
    pdfUrl: "blob:test", filename: "Print content.pdf", pageCount: 2,
    printOptions: { showComparisonBars: true }, onPrintOptionChange: () => {},
    onDownload: () => {}, onClose: () => {},
  })));
  const markers = ["Print content", "Holiday markers", "Today line", "Staircase line", "Relationship lines", "Last Recalc Date line", "Comparison bars", "cross a page break"];
  const missing = markers.filter((m) => !withPanel.includes(m));

  // Callers that pass no options must keep the old behaviour: viewer only, no panel.
  const withoutPanel = stripHtml(renderToString(React.createElement(PdfPreviewDialog, {
    pdfUrl: "blob:test", filename: "plain.pdf", onDownload: () => {}, onClose: () => {},
  })));
  const panelOptional = !withoutPanel.includes("Holiday markers");

  // ── Batch 31: the bar-text switches (shared with the chart) also live here ──
  const panelBarText = (info) => stripHtml(renderToString(React.createElement(PdfPreviewDialog, {
    pdfUrl: "blob:test", filename: "Bar text.pdf", pageCount: 1,
    printOptions: { showComparisonBars: true }, onPrintOptionChange: () => {},
    barInfo: info, onBarInfoChange: () => {},
    onDownload: () => {}, onClose: () => {},
  })));
  const barTextOn = panelBarText({ showName: true, showFinish: true });
  const barTextOff = panelBarText({});
  const countChecked = (h) => (h.match(/checked=""/g) || []).length;
  const barTextMarkers = ["Bar text", "Names on bars", "Start dates on bars", "Finish dates on bars", "Text style"];
  const barTextMissing = barTextMarkers.filter((m) => !barTextOn.includes(m));
  // No bar-info handler → the group must not appear (callers stay backwards compatible),
  // and a ticked box really renders ticked.
  const barTextOk = barTextMissing.length === 0
    && !withPanel.includes("Names on bars")
    && countChecked(barTextOn) === countChecked(barTextOff) + 2;

  // The dialog must write the switch into the shared display settings and rebuild
  // the preview with the NEW bar object (state is not applied yet at that point).
  const { readFileSync: readSrc26 } = await import("node:fs");
  const exportSrc26 = readSrc26("src/components/gantt/ExportDialog.jsx", "utf8");
  const barTextWired = exportSrc26.includes("onBarInfoChange={handleBarInfoChange}")
    && exportSrc26.includes("barInfo={barInfo}")
    && exportSrc26.includes("buildPdfOptions({ bar: nextBar })")
    && exportSrc26.includes("updateDisplay({ bar: nextBar })");

  results.push([
    "Print preview · bar text switches (shared with Gantt Bars ▸ Bar Info)",
    barTextOk && barTextWired
      ? "OK (3 switches offered in the preview, tick state follows the shared setting, chart + preview updated together)"
      : `UNEXPECTED (panel=${barTextOk}${barTextMissing.length ? ` missing:${barTextMissing.join("|")}` : ""} wired=${barTextWired})`,
  ]);

  results.push([
    "PDF print content (holidays / today / staircase / links / recalc date / comparison)",
    defaultsUnchanged && honoured && missing.length === 0 && panelOptional
      ? `OK (defaults byte-identical, all 6 options change the output, preview panel shows ${markers.length} markers)`
      : `UNEXPECTED (defaults=${defaultsUnchanged} honoured=${honoured} missing=${missing.join(",") || "none"} panelOptional=${panelOptional})`,
  ]);
} catch (e) {
  results.push(["PDF print content", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 27: Last Recalc Date — settable, shown in Display, right-click editable
try {
  const { default: RowContextMenu } = await server.ssrLoadModule("/src/components/gantt/RowContextMenu.jsx");
  const { readFileSync: readSrc4 } = await import("node:fs");
  const pageSrc27 = readSrc4("src/pages/GanttPage.jsx", "utf8");
  const layoutSrc27 = readSrc4("src/components/gantt/UnifiedGanttLayout.jsx", "utf8");
  const barSrc27 = readSrc4("src/components/gantt/ProjectBar.jsx", "utf8");
  const exportSrc27 = readSrc4("src/components/gantt/ExportDialog.jsx", "utf8");

  const row = { id: 2, activityId: "A100", activity: "Excavate", start: "2024-09-25", end: "2024-10-04" };
  const strip27 = (h) => h.replace(/<!--[^>]*-->/g, "");
  // Right-click on the Start cell: the menu must carry the data-date editor and
  // the "use this cell" shortcut for the column that was clicked.
  const cellMenu = strip27(renderToString(React.createElement(RowContextMenu, {
    x: 10, y: 10, task: row, taskIdx: 1, dateCell: "start",
    recalcDate: "2024-09-30", fileRecalcDate: "2024-09-30",
    onAction: () => {}, onClose: () => {}, onRecalcDateChange: () => {},
  })));
  // With no data date: "Not set" + the file date is offered instead of "Clear".
  const emptyMenu = strip27(renderToString(React.createElement(RowContextMenu, {
    x: 10, y: 10, task: row, taskIdx: 1,
    recalcDate: "", fileRecalcDate: "2024-09-15",
    onAction: () => {}, onClose: () => {},
  })));
  const menuWanted = ['Last Recalc Date', 'id="row-menu-recalc-date"', 'type="date"', 'value="2024-09-30"',
    "Use this cell — Start (2024-09-25)", "Use Today (", "Use Finish (2024-10-04)", "Clear Last Recalc Date"];
  const menuMissing = menuWanted.filter((m) => !cellMenu.includes(m));
  const menuOk = menuMissing.length === 0
    && emptyMenu.includes("Not set")
    && emptyMenu.includes("Use file date (2024-09-15)")
    && !emptyMenu.includes("Clear Last Recalc Date")
    && !emptyMenu.includes("Use this cell");         // no date cell → no cell shortcut

  // Display toggle + the line itself + the date-cell hook-up.
  const displayOk = pageSrc27.includes('{ label: "Last Recalc Date line"')
    && pageSrc27.includes("showRecalcLine={showRecalcLine}")
    && pageSrc27.includes("recalcDate={lastRecalcDate}")
    && pageSrc27.includes("onRecalcDateChange={handleRecalcDateChange}");
  const chartOk = layoutSrc27.includes("data-recalc-line")
    && layoutSrc27.includes("strokeDasharray=\"7,3\"")
    && layoutSrc27.includes("openCellMenu(e, idx, colKey)")
    && layoutSrc27.includes("dateCell={contextMenu.dateCell || null}");
  // The data date travels with the stored programme and onto the exported record.
  const persistOk = barSrc27.includes("last_recalc_date: lastRecalcDate")
    && pageSrc27.includes("payload?.meta?.last_recalc_date")
    && exportSrc27.includes("normalizeRecalcDate(recalcDate)")
    && exportSrc27.includes("showRecalcDate: printOptions.showRecalcDate");

  results.push([
    "Last Recalc Date (right-click a date column · Display toggle · stored with the programme)",
    menuOk && displayOk && chartOk && persistOk
      ? "OK (editor + shortcuts, Display toggle + dashed line, saved in the version payload, PDF option)"
      : `UNEXPECTED (menu=${menuOk}${menuMissing.length ? ` missing:${menuMissing.join("|")}` : ""} display=${displayOk} chart=${chartOk} persist=${persistOk})`,
  ]);
} catch (e) {
  results.push(["Last Recalc Date", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 28: Gantt Bar Info — "Show Names / Start / Finish on Bars" ──────────
// Reference: xerviewer.org's Gantt Bar Info block (ids kept identical).
try {
  const { buildBarText, hasBarInfo, BAR_INFO_TOGGLES, BAR_TEXT_POSITIONS, DEFAULT_DISPLAY_SETTINGS,
    normalizeBarTextPosition, pdfCoreFontFor, barTextFontFamilyCss } =
    await server.ssrLoadModule("/src/lib/displaySettings.js");
  const { default: GanttSettingsPanel } = await server.ssrLoadModule("/src/components/gantt/GanttSettingsPanel.jsx");
  const { buildGanttPDF } = await server.ssrLoadModule("/src/lib/exportGanttPDF.js");

  const defBar = DEFAULT_DISPLAY_SETTINGS.bar;
  const barWith = (info, labelPatch = {}) => ({
    ...defBar,
    label: { ...defBar.label, ...labelPatch },
    info: { ...defBar.info, ...info },
  });
  const row = { id: 2, _resolvedItem: "A1", item: "A1", activityId: "A100", activity: "Excavate", start: "2024-09-25", end: "2024-10-04" };

  const off = buildBarText(row, barWith({}), "yyyy-MM-dd");
  const nameOnly = buildBarText(row, barWith({ showName: true }), "yyyy-MM-dd");
  const allThree = buildBarText(row, barWith({ showName: true, showStart: true, showFinish: true }), "yyyy-MM-dd");
  const noLabel = buildBarText(row, barWith({ showName: true, showStart: true, showFinish: true }, { show: false }), "yyyy-MM-dd");
  const noDuplicate = buildBarText(row, barWith({ showName: true }, { field: "activity" }), "yyyy-MM-dd");
  const euroDates = buildBarText(row, barWith({ showStart: true, showFinish: true }, { show: false }), "dd/MM/yyyy");

  const textOk = off === "A1"                                     // defaults untouched
    && nameOnly === "A1 · Excavate"                                // stacks on the Labels field
    && allThree === "A1 · Excavate · 2024-09-25 · 2024-10-04"
    && noLabel === "Excavate · 2024-09-25 · 2024-10-04"            // Labels off → pure Bar Info
    && noDuplicate === "Excavate"                                  // name never printed twice
    && euroDates === "25/09/2024 · 04/10/2024";                    // display date format honoured
  const switchesOk = !hasBarInfo(barWith({})) && hasBarInfo(barWith({ showName: true }))
    && !hasBarInfo(undefined)
    && BAR_INFO_TOGGLES.map((t) => t.id).join(",")
       === "ganttbar-shownames,ganttbar-showstartdate,ganttbar-showfinishdate";

  // The panel renders the three switches exactly as the reference labels them.
  const strip28 = (h) => h.replace(/<!--[^>]*-->/g, "");
  const panel = strip28(renderToString(React.createElement(GanttSettingsPanel, {
    displaySettings: { ...DEFAULT_DISPLAY_SETTINGS, bar: barWith({}) },
    onChange: () => {}, viewMode: "month", onViewModeChange: () => {},
    initialTab: "bars", embedded: true, onClose: () => {},
  })));
  const panelWanted = [
    "Show Names on Bars", "Show Start Date on Bars", "Show Finish Date on Bars",
    'id="ganttbar-shownames"', 'id="ganttbar-showstartdate"', 'id="ganttbar-showfinishdate"',
    'role="switch"', 'aria-checked="false"',
  ];
  const panelMissing = panelWanted.filter((m) => !panel.includes(m));

  // PDF: bar text appears only once a Bar Info switch is on (defaults unchanged).
  const pdfTasks = [
    { id: 1, isSection: true, activity: "Phase 1 — Foundations", sectionLevel: 1 },
    { id: 2, activityId: "A100", activity: "Excavate", start: "2026-09-01", end: "2026-09-12" },
    { id: 3, activityId: "A110", activity: "Piling", start: "2026-09-15", end: "2026-10-02" },
  ];
  const size28 = (extra) =>
    buildGanttPDF({ tasks: pdfTasks, projectTitle: "Bar info", ...extra }).doc.output("datauristring").length;
  const pdfBase = size28({});
  const pdfDefaults = size28({ bar: barWith({}) });
  const pdfName = size28({ bar: barWith({ showName: true }) });
  const pdfDates = size28({ bar: barWith({ showStart: true, showFinish: true }) });
  const pdfOk = pdfDefaults === pdfBase && pdfName !== pdfBase && pdfDates !== pdfBase;

  // Screen side: the same text has to appear on the chart bars. The fixture spans
  // ~90 days so the inside-the-bar label clears the default 50px threshold.
  const { default: Layout } = await server.ssrLoadModule("/src/components/gantt/UnifiedGanttLayout.jsx");
  const chartTasks = [
    { id: "s1", isSection: true, activity: "PHASE ONE", sectionType: "blue" },
    { id: "t1", activityId: "A100", activity: "Excavate", item: "A1", start: "2026-09-01", end: "2026-11-30" },
  ];
  const chart = (infoPatch, labelPatch = {}) => strip28(renderToString(React.createElement(Layout, {
    ...baseProps, tasks: chartTasks, computedTasks: chartTasks,
    displaySettings: { ...DEFAULT_DISPLAY_SETTINGS, bar: barWith(infoPatch, labelPatch) },
  })));
  const chartDefault = chart({});
  const chartInfo = chart({ showName: true, showStart: true, showFinish: true });
  const chartPast = chart({ showStart: true, showFinish: true });
  // Batch 32: with BOTH date switches on the two dates are no longer part of the
  // caption — they are split to the bar's front/back, so the caption holds the name.
  const chartOk = chartDefault.includes("A1")                      // default: item code on the bar
    && !chartDefault.includes("A1 · ")                             // …and nothing joined yet
    && chartDefault !== chartInfo
    && chartInfo.includes(">A1 · Excavate</span>")
    && chartInfo.includes(">2026-09-01</span>") && chartInfo.includes(">2026-11-30</span>")
    && chartPast.includes(">2026-09-01</span>") && chartPast.includes(">2026-11-30</span>");

  // Narrow bar: the Bar Info text must move to the right of the bar, never vanish
  // (the on-screen default label is still skipped below the 50px minimum width).
  const narrowTasks = [
    { id: "s1", isSection: true, activity: "PHASE ONE", sectionType: "blue" },
    { id: "t9", activityId: "A900", activity: "Handover", item: "Z9", start: "2026-09-01", end: "2026-09-03" },
  ];
  const narrow = (infoPatch) => strip28(renderToString(React.createElement(Layout, {
    ...baseProps, tasks: narrowTasks, computedTasks: narrowTasks,
    displaySettings: { ...DEFAULT_DISPLAY_SETTINGS, bar: barWith(infoPatch) },
  })));
  const narrowOff = narrow({});
  const narrowOn = narrow({ showName: true });
  // Batch 30: the caption of a short bar now moves outside the bar (in full)
  // instead of being cut off — so the plain item code is visible too.
  const narrowOk = narrowOff.includes("Z9")             // item code shown after the bar
    && narrowOn.includes("Z9 · Handover");               // Bar Info caption shown in full

  // ── Batch 29: where the text sits (before / inside / after) + font & colours ──
  const posOk = BAR_TEXT_POSITIONS.map((p) => p.value).join(",") === "inside,before,after"
    && normalizeBarTextPosition("right") === "after"        // legacy value from the Labels tab
    && normalizeBarTextPosition("inside") === "inside"
    && normalizeBarTextPosition("before") === "before"
    && normalizeBarTextPosition(undefined) === "inside"
    && normalizeBarTextPosition("nonsense") === "inside";
  const fontMapOk = pdfCoreFontFor("inherit") === "helvetica"
    && pdfCoreFontFor("'Courier New', Courier, monospace") === "courier"
    && pdfCoreFontFor("Monaco, Consolas, monospace") === "courier"
    && pdfCoreFontFor("Georgia, serif") === "times"
    && pdfCoreFontFor("Arial, Helvetica, sans-serif") === "helvetica"
    && barTextFontFamilyCss("inherit") === undefined
    && barTextFontFamilyCss("Georgia, serif") === "Georgia, serif";

  const chartBefore = chart({ showName: true }, { position: "before" });
  const chartAfter = chart({ showName: true }, { position: "after" });
  const chartFont = chart({ showName: true }, { fontFamily: "'Courier New', Courier, monospace" });
  const chartStyle = chart({ showName: true }, { position: "after", fontSize: 15, colorOutside: "#123456" });
  const styleOk = chartBefore.includes("translate(-100%, -50%)")   // in front of / left of the bar
    && !chartAfter.includes("translate(-100%, -50%)")               // after: normal left-to-right
    && chartAfter.includes("translateY(-50%)")
    && chartBefore !== chartAfter
    && chartFont.includes("Courier New")                            // font family reaches the DOM
    && chartStyle.includes("font-size:15px") && chartStyle.includes("#123456");
  const chartState = { before: chartBefore.includes("translate(-100%, -50%)"), after: chartAfter.includes("translateY(-50%)"),
    family: chartFont.includes("Courier New"),
    size: chartStyle.includes("font-size:15px"), colour: chartStyle.includes("#123456") };

  // PDF: each position lays the text out differently, default output still untouched.
  // Measured by the caption's x coordinate in the text layer (byte equality would be
  // meaningless — every build carries a different CreationDate timestamp).
  const pdfOut = (extra) => buildGanttPDF({ tasks: pdfTasks, projectTitle: "Bar info", ...extra }).doc;
  const pdfBefore = pdfOut({ bar: barWith({ showName: true }, { position: "before" }) });
  const pdfInside = pdfOut({ bar: barWith({ showName: true }, { position: "inside" }) });
  const pdfAfter = pdfOut({ bar: barWith({ showName: true }, { position: "after" }) });
  const xBefore = itemX(await pdfTextItems(pdfBefore), "Excavate");
  const xInside = itemX(await pdfTextItems(pdfInside), "Excavate");
  const xAfter = itemX(await pdfTextItems(pdfAfter), "Excavate");
  const pdfPosOk = xBefore !== null && xInside !== null && xAfter !== null
    && xBefore < xInside && xInside < xAfter;
  const pdfGeorgia = pdfOut({ bar: barWith({ showName: true }, { fontFamily: "Georgia, serif" }) });
  const pdfCourier = pdfOut({ bar: barWith({ showName: true }, { fontFamily: "'Courier New', Courier, monospace" }) });
  const pdfStyled = pdfOut({ bar: barWith({ showName: true }, { fontSize: 15, colorOutside: "#123456" }) });
  const pdfPlain = pdfOut({ bar: barWith({ showName: true }) });
  const lenOf = (d) => d.output("datauristring").length;
  // The caption's width in the text layer proves a font/size change reached the PDF
  // (byte lengths are useless: jsPDF writes a different CreationDate every build).
  const wPlain = itemWidth(await pdfTextItems(pdfPlain), "Excavate");
  const wCourier = itemWidth(await pdfTextItems(pdfCourier), "Excavate");
  const wStyled = itemWidth(await pdfTextItems(pdfStyled), "Excavate");
  const wGeorgia = itemWidth(await pdfTextItems(pdfGeorgia), "Excavate");
  const pdfStyleOk = wPlain !== null && wStyled !== null && wCourier !== null
    && wStyled > wPlain                                          // 15px is wider than 10px
    && wCourier !== wPlain;                                      // monospace advances differ
  const pdfStyleState = { before: xBefore, inside: xInside, after: xAfter,
    widths: { plain: wPlain, courier: wCourier, styled: wStyled, georgia: wGeorgia },
    georgiaDiffers: wGeorgia !== wPlain };

  const panelStyleOk = [
    "Text style", "Position", "Font family", "Text size", "On the bar", "Before / after",
    "Inside the bar", "Before the bar (left)", "After the bar (right)", "Courier New", "Monaco",
  ].every((m) => panel.includes(m));

  results.push([
    "Bar text style (position · font family · size · colours)",
    posOk && fontMapOk && styleOk && pdfPosOk && pdfStyleOk && panelStyleOk
      ? "OK (inside / before / after, font family incl. PDF core-font mapping, size + both colours, chart & PDF)"
      : `UNEXPECTED (pos=${posOk} font=${fontMapOk} chart=${styleOk}${JSON.stringify(chartState)} pdfPos=${pdfPosOk} pdfStyle=${pdfStyleOk}${JSON.stringify(pdfStyleState)} panel=${panelStyleOk})`,
  ]);

  results.push([
    "Gantt Bar Info (Show Names / Start / Finish on Bars · screen + PDF)",
    textOk && switchesOk && panelMissing.length === 0 && chartOk && narrowOk && pdfOk
      ? "OK (3 switches, text stacks on the Labels field, dates follow the date format, chart + PDF in sync, narrow bars move the text right, PDF unchanged until switched on)"
      : `UNEXPECTED (text=${textOk} switches=${switchesOk}${panelMissing.length ? ` missing:${panelMissing.join("|")}` : ""} chart=${chartOk} narrow=${narrowOk} pdf=${pdfOk})`,
  ]);
} catch (e) {
  results.push(["Gantt Bar Info", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 33/34: Comparison bars — tick state, print default, no dead click ────
try {
  const { default: PdfPreviewDialog33 } = await server.ssrLoadModule("/src/components/gantt/PdfPreviewDialog.jsx");
  const { buildGanttPDF: build33, collectStaircaseSteps: collect38 } = await server.ssrLoadModule("/src/lib/exportGanttPDF.js");
  const exp34 = await server.ssrLoadModule("/src/components/gantt/ExportDialog.jsx");
  const strip33 = (h) => h.replace(/<!--[^>]*-->/g, "");

  // The tick must follow the stored value. Every print option now defaults to OFF and the
  // chart's own "Comparison Arrows" flag no longer decides how the box looks (batch 34/37).
  const rowOf = (html) => {
    const i = html.indexOf("Comparison bars");
    return i < 0 ? "" : html.slice(html.lastIndexOf("<label", i), i);
  };
  const tick = (props) => /checked=""/.test(rowOf(strip33(renderToString(React.createElement(PdfPreviewDialog33, {
    pdfUrl: "blob:test", filename: "t.pdf", pageCount: 1,
    printOptions: {}, onPrintOptionChange: () => {}, onComparisonChange: () => {},
    onDownload: () => {}, onClose: () => {},
    ...props,
  })))));
  const tickOk = tick({}) === false                                    // never chosen → off
    && tick({ printOptions: { showComparisonBars: false } }) === false  // ← the batch-33 bug: stayed ticked
    && tick({ printOptions: { showComparisonBars: true } }) === true;

  // A saved `true` from before the default changed is dropped exactly once.
  const migrated = exp34.migratePrintOptions({ showHolidays: true, showComparisonBars: true }, 1);
  const keptChoice = exp34.migratePrintOptions({ showHolidays: true, showComparisonBars: true }, exp34.PRINT_OPTIONS_VERSION);
  const migrationOk = migrated.showHolidays === true && !("showComparisonBars" in migrated)
    && keptChoice.showComparisonBars === true;

  // The PDF must follow the SAME rule as the chart: comparison bars are gated by the
  // print switch and by "the compared dates differ" — not by the per-programme
  // `showComparison` flag (which only drives the comparison arrows on screen, and which
  // every imported programme carries as `false`).
  const cmpTasks = [
    { id: 1, isSection: true, activity: "Phase 1", sectionLevel: 1 },
    { id: 2, activityId: "A100", activity: "Excavate", start: "2026-09-01", end: "2026-09-30",
      baselineStart: "2026-08-01", baselineFinish: "2026-08-20" },
  ];
  const size34 = (tasks, extra) => build33({ tasks, projectTitle: "Compare", ...extra })
    .doc.output("datauristring").length;
  const flagOff = cmpTasks.map((t, i) => (i === 0 ? { ...t, showComparison: false } : t));
  const deleted = cmpTasks.map((t, i) => (i === 1 ? { ...t, deletedFromBL: true } : t));
  const refOn = size34(cmpTasks, { showComparisonBars: true });          // print switch on, dates differ
  const switchOff = size34(cmpTasks, { showComparisonBars: false });     // print switch off → none
  const importedData = size34(flagOff, { showComparisonBars: true });    // ← imported programme (flag false)
  const deletedRow = size34(deleted, { showComparisonBars: true });      // deleted row: chart skips it too
  const pdfOk34 = switchOff !== refOn && importedData === refOn && deletedRow === switchOff;

  // Colour must match the chart: comparison bars / BL columns are brown (#733208) there,
  // the PDF used to draw them purple (#7c3aed).
  const cmpRaw = Buffer.from(build33({ tasks: cmpTasks, projectTitle: "Compare", showComparisonBars: true })
    .doc.output("arraybuffer")).toString("latin1");
  const colourOk = /0\.45\d*\s+0\.2\d*\s+0\.03\d*\s+rg/.test(cmpRaw)        // #733208 written as 0.45 0.2 0.03
    && !/0\.49\d*\s+0\.23\d*\s+0\.93\d*\s+rg/.test(cmpRaw);               // no purple left

  const { readFileSync: readSrc34 } = await import("node:fs");
  const page34 = readSrc34("src/pages/GanttPage.jsx", "utf8");
  const export34 = readSrc34("src/components/gantt/ExportDialog.jsx", "utf8");
  const pdf34 = readSrc34("src/lib/exportGanttPDF.js", "utf8");
  const wiredOk = page34.includes("onToggleComparisonBars={handleSetComparisonBars}")
    && export34.includes("onComparisonChange={handleComparisonBarsChange}")
    && export34.includes("tasks: withComparisonFlag(tasks, on)")       // rebuild keeps chart + paper in step
    && !export34.includes("comparisonsOn=")                            // the tick is the print switch
    && /showRelationshipLines: false,\s*showComparisonBars: false/.test(export34)  // print default off
    && !pdf34.includes("sectionAllowsComparison");                     // never gated by the programme flag

  // Batch 37 — the Display panel switch is the comparison ARROWS, so it says so: the old
  // "Compare Bars" label made it look like the Print Preview's "Comparison bars" option.
  const settingsPanel34 = readSrc34("src/components/gantt/GlobalSettingsPanel.jsx", "utf8");
  const labelOk = page34.includes('label: "Comparison Arrows"')
    && !page34.includes('label: "Compare Bars"')
    && settingsPanel34.includes("title={item.hint || item.label}");     // the hint is reachable

  results.push([
    "Print preview · Comparison bars (same rule as the chart, off by default in print)",
    tickOk && migrationOk && pdfOk34 && colourOk && wiredOk && labelOk
      ? "OK (unticked by default; a saved old default is migrated once; imported programmes print them too; brown #733208 like the chart; deleted rows skipped; Display switch renamed \"Comparison Arrows\")"
      : `UNEXPECTED (tick=${tickOk} migration=${migrationOk} pdf=${pdfOk34} colour=${colourOk} wired=${wiredOk} label=${labelOk} sizes on=${refOn} off=${switchOff} imported=${importedData} deleted=${deletedRow})`,
  ]);

  // ── Batch 34: the staircase line must stay red at *preview* zoom ─────────────
  // Measured at 66 dpi (an A3 page in the preview panel): a 0.6 mm line was ~1.5 px
  // wide, so over half of it was anti-aliasing and it read as grey. 1 mm keeps a solid
  // red core. The dash pattern must be reset too — a dashed line reads grey as well.
  const stairDoc = build33({ tasks: cmpTasks, projectTitle: "Stair", showStaircase: true }).doc;
  const stairRaw = Buffer.from(stairDoc.output("arraybuffer")).toString("latin1");
  const colourOp = "0.86 0.21 0.27 RG";                                 // #dc3545 = staircase / today
  // jsPDF separates the operators with newlines, not spaces.
  const widthsPt = [...stairRaw.matchAll(/0\.86 0\.21 0\.27 RG\s+([\d.]+)\s+w/g)].map((m) => Number(m[1]));
  const widthMm = widthsPt.length ? (Math.max(...widthsPt) * 25.4) / 72 : 0;
  const beforeStaircase = stairRaw.slice(Math.max(0, stairRaw.indexOf(colourOp) - 700), stairRaw.indexOf(colourOp));
  const dashLeak = /\[[^\]]*[1-9][^\]]*\]\s*[\d.]+\s*d/.test(beforeStaircase);   // a non-empty dash array
  const staircaseOk = widthMm >= 0.99 && !dashLeak;

  // Multi-page: EVERY page must carry the staircase style. jsPDF writes the colour/width
  // into the page that is current when they are called, so a single setDrawColor before
  // the loop painted exactly one page red and left the rest in the default (thin black =
  // grey at preview zoom) — the "only the last page is red" bug. The staircase also has
  // to continue over a page break instead of stopping with the first page.
  const manyTasks = [{ id: 0, isSection: true, activity: "Phase 1", sectionLevel: 1 }];
  for (let i = 1; i <= 140; i += 1) {
    const d1 = String((i % 25) + 1).padStart(2, "0");
    const d2 = String(((i + 5) % 25) + 1).padStart(2, "0");
    manyTasks.push({
      id: i, activityId: `A${100 + i}`, activity: `Activity ${i}`, item: `A${i}`,
      start: `2026-09-${d1}`, end: `2026-10-${d2}`,
      baselineStart: "2026-08-01", baselineFinish: "2026-08-20",
    });
  }
  const multi = build33({ tasks: manyTasks, projectTitle: "Multi page", showStaircase: true });
  const multiRaw = Buffer.from(multi.doc.output("arraybuffer")).toString("latin1");
  const styleOps = (multiRaw.match(/0\.86 0\.21 0\.27 RG\s+[\d.]+\s+w/g) || []).length;
  const multiOk = multi.pageCount >= 3 && styleOps === multi.pageCount;

  // ── Batch 40: every row carries the row-delete button (programmes included) ──
  // The chart's left panel used to offer the little trash icon on activity rows only
  // (inside the duration cell), so a leftover programme like "New Programme" could only be
  // removed through the right-click menu. The section row now carries the same button at
  // the right edge of its left-panel cell.
  const { default: Layout40 } = await server.ssrLoadModule("/src/components/gantt/UnifiedGanttLayout.jsx");
  const tasks40 = [
    { id: "s1", isSection: true, activity: "New Programme", sectionType: "blue" },
    { id: "t1", activityId: "A100", activity: "Excavate", item: "A1", start: "2026-09-01", end: "2026-09-30" },
    { id: "t2", activityId: "A110", activity: "Piling", item: "A2", start: "2026-10-01", end: "2026-10-20" },
  ];
  const html40 = renderToString(React.createElement(Layout40, {
    ...baseProps, tasks: tasks40, computedTasks: tasks40, displaySettings: null,
  }));
  const deleteButtons40 = (html40.match(/title="Delete row \(Ctrl\+Z to undo\)"/g) || []).length;
  // …and the programme's own button sits between its name input and the end of its cell
  const sectionHtml40 = html40.slice(html40.indexOf("New Programme"), html40.indexOf("Excavate"));
  const programmeDelete40 = sectionHtml40.includes('title="Delete row (Ctrl+Z to undo)"');
  const layoutSrc40 = readSrc34("src/components/gantt/UnifiedGanttLayout.jsx", "utf8");
  // the section branch of the left panel: from `{isSec ? (` to its `) : (`
  const secStart40 = layoutSrc40.indexOf("{isSec ? (");
  const secEnd40 = layoutSrc40.indexOf(") : (", secStart40);
  const sectionBranch40 = secStart40 >= 0 && secEnd40 > secStart40
    ? layoutSrc40.slice(secStart40, secEnd40)
    : "";
  const wired40 = sectionBranch40.includes("del(task.id)")
    && sectionBranch40.includes("<Trash2 size={10} />")
    && (layoutSrc40.match(/<Trash2 size=\{10\} \/>/g) || []).length === 2;   // section + activity row

  results.push([
    "Row delete button on every row (programmes included)",
    deleteButtons40 === tasks40.length && programmeDelete40 && wired40
      ? `OK (${deleteButtons40} rows → ${deleteButtons40} delete buttons, the programme row's one sits right of its name; same markup as the activity rows)`
      : `UNEXPECTED (buttons=${deleteButtons40} of ${tasks40.length}, programmeRow=${programmeDelete40}, wired=${wired40})`,
  ]);

  // ── Batch 41: deleting a programme row must not touch the activities below it ──
  // Requirement: one click on a programme's delete button removes that row only — the
  // activity rows underneath stay exactly as they are (they simply have no programme
  // header above them any more). The delete path is an id-only filter; the bulk path only
  // removes the explicitly selected ids. Checked on the source and on the SSR output.
  const afterDelete41 = tasks40.filter((t) => t.id !== "s1");       // exactly what del() does
  const html41 = renderToString(React.createElement(Layout40, {
    ...baseProps, tasks: afterDelete41, computedTasks: afterDelete41, displaySettings: null,
  }));
  const activitiesKept41 = html41.includes("Excavate") && html41.includes("Piling");
  const programmeGone41 = !html41.includes("New Programme");
  const delSrc41 = layoutSrc40.slice(layoutSrc40.indexOf("const del = useCallback"));
  const delImpl41 = delSrc41.slice(0, delSrc41.indexOf("\n"));       // the helper is one line
  const idOnly41 = /filter\(t=>t\.id!==id\)/.test(delImpl41) && !/isSection/.test(delImpl41);
  const bulkOnly41 = layoutSrc40.includes("updated.filter(t => !selectedIds?.has(t.id))");
  const noCascade41 = idOnly41 && !/isSection/.test(delImpl41);

  results.push([
    "Deleting a programme row keeps the activity rows below it",
    activitiesKept41 && programmeGone41 && idOnly41 && bulkOnly41 && noCascade41
      ? "OK (single click = id-only filter: the programme header goes, both activities and their rows stay — nothing cascades; the bulk bar still deletes only the explicitly selected ids)"
      : `UNEXPECTED (activitiesKept=${activitiesKept41} programmeGone=${programmeGone41} idOnly=${idOnly41} bulkOnly=${bulkOnly41} noCascade=${noCascade41})`,
  ]);

  // ── Batch 39: the comparison arrows (programme finish-date difference) are printable ──
  // Same rule as the chart: one arrow per adjacent pair whose Compare flag is on, and the
  // label is |differenceInDays| + 1 (Cal) or countWorkingDays (WD).
  const arrowTasks39 = [
    { id: 1, isSection: true, activity: "Current programme", sectionLevel: 1 },
    { id: 2, activityId: "A100", activity: "Excavate", start: "2026-09-01", end: "2026-09-30" },
    { id: 3, activityId: "A110", activity: "Piling", start: "2026-09-10", end: "2026-09-28" },
    { id: 4, isSection: true, activity: "Comparison programme", sectionLevel: 1 },
    { id: 5, activityId: "A200", activity: "Excavate (BL)", start: "2026-10-05", end: "2026-10-20" },
  ];
  const arrows39 = (extra, taskList) => {
    const { doc } = build33({ tasks: taskList || arrowTasks39, projectTitle: "Arrows", durMode: "cal", ...extra });
    const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    return {
      labels: (raw.match(/\((\d+ (?:Cal|WD))\) Tj/g) || []).map((m) => m.slice(1).split(")")[0]),
      dashed: (raw.match(/\[[\d.]+ [\d.]+\] [\d.]+ d/g) || []).length,   // the two verticals
      brownText: raw.includes("0.451 0.196 0.031 rg"),
    };
  };
  const on39 = arrows39({ showComparisonArrows: true });
  const off39 = arrows39({ showComparisonArrows: false });
  const flagOff39 = arrows39(
    { showComparisonArrows: true },
    arrowTasks39.map((t) => (t.isSection ? { ...t, showComparison: false } : t)),
  );
  const wd39 = arrows39({ showComparisonArrows: true, durMode: "wd" });
  // 2026-09-30 → 2026-10-20 = 20 days apart → the chart's Cal value is 21.
  const arrowsOk39 = on39.labels.join(",") === "21 Cal" && on39.dashed === 2 && on39.brownText
    && off39.labels.length === 0 && flagOff39.labels.length === 0
    && wd39.labels.length === 1 && wd39.labels[0].endsWith(" WD");

  // …and the switch is offered in the Print Preview panel (print option, default off).
  const panel39 = strip33(renderToString(React.createElement(PdfPreviewDialog33, {
    pdfUrl: "blob:test", filename: "t.pdf", pageCount: 1,
    printOptions: {}, onPrintOptionChange: () => {}, onComparisonArrowsChange: () => {},
    onDownload: () => {}, onClose: () => {},
  })));
  const arrowsWired39 = panel39.includes("Comparison arrows")
    && export34.includes("onComparisonArrowsChange={handleComparisonArrowsChange}")
    && export34.includes("showComparisonArrows: printOptions.showComparisonArrows")
    && /showComparisonArrows: false,/.test(export34);

  results.push([
    "Print PDF · Comparison arrows (finish-date difference between programmes)",
    arrowsOk39 && arrowsWired39
      ? `OK (label "${on39.labels[0]}" matches the chart's formula, ${on39.dashed} dashed verticals, brown #733208, off by default, gated by the same Compare flag as the chart; WD mode → "${wd39.labels[0]}")`
      : `UNEXPECTED (labels=${on39.labels.join("|")} dashed=${on39.dashed} brown=${on39.brownText} off=${off39.labels.length} flagOff=${flagOff39.labels.length} wd=${wd39.labels.join("|")} wired=${arrowsWired39})`,
  ]);

  // ── Batch 45: Chinese prints as real text (embedded CJK font, jsPDF subsets it) ──
  const cjkTasks45 = [
    { id: 1, isSection: true, activity: "樁基工程 (Piling Works)", sectionLevel: 1 },
    { id: 2, activityId: "A100", activity: "鋼筋混凝土樓板 Slab", item: "A1", start: "2026-09-01", end: "2026-09-30" },
    { id: 3, activityId: "A110", activity: "竣工里程碑", start: "2026-10-05" },
  ];
  const cjkFontBytes45 = readSrc34("public/fonts/NotoSansHK-VF.ttf");          // Buffer (11 MB)
  const cjkFont45 = { name: "NotoSansHK", base64: cjkFontBytes45.toString("base64") };
  const cjkDoc45 = (extra) => build33({ tasks: cjkTasks45, projectTitle: "啟德發展計劃", ...extra }).doc;
  const withFont45 = cjkDoc45({ cjkFont: cjkFont45 });
  const withoutFont45 = cjkDoc45({});
  const text45 = async (doc) => (await pdfTextItems(doc)).map((i) => i.str).join(" ");
  const withText45 = await text45(withFont45);
  const withoutText45 = await text45(withoutFont45);
  const cjkText45 = withText45.includes("鋼筋混凝土樓板") && withText45.includes("樁基工程") && withText45.includes("啟德發展計劃");
  const fallback45 = !withoutText45.includes("鋼筋混凝土樓板") && withoutText45.includes("?");
  // jsPDF subsets, so the file stays small instead of carrying the whole 11 MB font
  const withSize45 = Buffer.from(withFont45.output("arraybuffer")).length;
  const subset45 = withSize45 < 2 * 1024 * 1024;
  const asset45 = cjkFontBytes45.length > 5 * 1024 * 1024
    && readSrc34("public/fonts/OFL.txt", "utf8").includes("SIL Open Font License, Version 1.1");
  const cjkSrc45 = readSrc34("src/lib/cjkFont.js", "utf8");
  const previewSrc45 = readSrc34("src/components/gantt/PdfPreviewDialog.jsx", "utf8");
  const wiredCjk45 = cjkSrc45.includes("programmeNeedsCjk") && cjkSrc45.includes("hasNonLatinText")
    && export34.includes("onCjkFontChange={handleCjkFontChange}")
    && export34.includes("cjkFont: cjkFont ? { name: CJK_FONT_NAME, base64: cjkFont } : null")
    && previewSrc45.includes('key: "embedCjkFont"')
    && export34.includes("cjkStatus={cjkStatus}");

  results.push([
    "PDF · Chinese text (embedded CJK font, subsetted)",
    cjkText45 && fallback45 && subset45 && asset45 && wiredCjk45
      ? `OK (text layer returns 樁基工程 / 鋼筋混凝土樓板 / 啟德發展計劃; ${(withSize45 / 1024).toFixed(0)} KB with font vs ${(Buffer.from(withoutFont45.output("arraybuffer")).length / 1024).toFixed(0)} KB without; font + OFL license shipped in public/fonts; lazy load only when the programme has non-Latin text)`
      : `UNEXPECTED (text=${cjkText45} fallback=${fallback45} subset=${subset45} size=${withSize45} asset=${asset45} wired=${wiredCjk45})`,
  ]);

  // ── Batch 44: Holiday Markers are their own switch and default to OFF ─────────
  // They used to ride on the Today line (`const showHolidays = showToday`), so turning
  // "Holiday Markers" off also removed the today line, and the chart started with the
  // holiday shading already on.
  const holidayHtml44 = (props) => renderToString(React.createElement(Layout40, {
    ...baseProps, tasks: tasks40, computedTasks: tasks40, displaySettings: null, ...props,
  }));
  const bands44 = (html) => (html.match(/opacity="0\.15"/g) || []).length;          // holiday band
  const bandsOn44 = bands44(holidayHtml44({ showHolidays: true }));
  const bandsDefault44 = bands44(holidayHtml44({}));                                 // default → off
  const todayKept44 = /stroke="#dc3545" stroke-width="1\.5"/.test(holidayHtml44({ showHolidays: false }));
  const pageSrc44 = readSrc34("src/pages/GanttPage.jsx", "utf8");
  const defaultOff44 = /const \[showHolidays, setShowHolidays\] = useState\(false\)/.test(pageSrc44);
  const split44 = /label: "Holiday Markers"[^}]*on: showHolidays/.test(pageSrc44)
    && /label: "Today Line"[^}]*on: showToday/.test(pageSrc44)
    && pageSrc44.includes("showHolidays={showHolidays}");

  results.push([
    "Holiday Markers (chart) default OFF + separate from the Today line",
    bandsOn44 > 0 && bandsDefault44 === 0 && todayKept44 && defaultOff44 && split44
      ? `OK (bands: off by default, ${bandsOn44} when switched on; the Today line still draws with holidays off; Display panel has separate "Holiday Markers" + "Today Line" switches)`
      : `UNEXPECTED (bandsOn=${bandsOn44} bandsDefault=${bandsDefault44} todayKept=${todayKept44} defaultOff=${defaultOff44} split=${split44})`,
  ]);

  // ── Batch 38: the printed staircase must take part the same rows the chart does ──
  // Chart rules (UnifiedGanttLayout ▸ bpMap + staircases): rows before the first section
  // form a leading group, milestones count (one day wide), `deletedFromBL` rows fall back
  // to their BL dates, and the BulkEditBar "Staircase filter" restricts the rows.
  const stairTasks38 = [
    { id: 1, activityId: "A100", activity: "Preliminaries", start: "2026-09-01", end: "2026-09-10" },
    { id: 2, isSection: true, activity: "Phase 1", sectionLevel: 1 },
    { id: 3, activityId: "A110", activity: "Excavate", start: "2026-09-05", end: "2026-09-20" },
    { id: 4, activityId: "A120", activity: "Milestone", start: "2026-09-25" },
    { id: 5, activityId: "A130", activity: "Piling", start: "2026-09-22", end: "2026-10-05" },
    { id: 6, activityId: "A140", activity: "Removed activity", deletedFromBL: true,
      baselineStart: "2026-09-28", baselineFinish: "2026-10-15" },
  ];
  // Each step draws 2 segments (a drop + a run), so n steps on one page = 2n segments;
  // the fixture's rows all advance the running maximum.
  const stairSegments38 = (extra) => {
    const { doc } = build33({ tasks: stairTasks38, projectTitle: "Staircase parity", showStaircase: true, ...extra });
    const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    const from = raw.indexOf("0.86 0.21 0.27 RG");
    if (from < 0) return 0;
    return (raw.slice(from).match(/[\d.]+ [\d.]+ m\s+[\d.]+ [\d.]+ l\s+S/g) || []).length;
  };
  const allRows38 = stairSegments38({});                                  // 1 + 4 steps → 10
  const filtered38 = stairSegments38({ staircaseFilterIds: new Set([3, 5]) }); // 2 steps → 4
  // …and the shared rule itself, on synthetic positions (2 groups, empty groups dropped).
  const groups38 = collect38(
    [{ id: 1 }, { id: 2, isSection: true }, { id: 3 }, { id: 4, isSection: true }, { id: 5 }],
    (idx) => ([{ page: 0, left: 0, width: 10, top: 5 }, null, { page: 0, left: 20, width: 10, top: 15 },
      null, { page: 0, left: 40, width: 10, top: 25 }][idx]),
    null,
  );
  const parityOk = allRows38 === 10 && filtered38 === 4
    && groups38.length === 3 && groups38.map((g) => g.steps.length).join(",") === "1,1,1";

  results.push([
    "Print PDF · Staircase line takes part the same rows as the chart",
    parityOk
      ? `OK (leading row + milestones + deleted-from-baseline rows all step; BulkEditBar staircase filter honoured; ${allRows38} segments unfiltered → ${filtered38} filtered)`
      : `UNEXPECTED (all=${allRows38} expected 10, filtered=${filtered38} expected 4, groups=${groups38.map((g) => g.steps.length).join("|")})`,
  ]);

  results.push([
    "Print PDF · Staircase line stays red at preview zoom",
    staircaseOk && multiOk
      ? `OK (line is ${widthMm.toFixed(2)} mm (~2.6 px at 66 dpi, full-strength #db3645), dash pattern reset; ${styleOps} styled pages for ${multi.pageCount} printed pages)`
      : `UNEXPECTED (width=${widthMm.toFixed(2)}mm needs >=1.0, dashLeak=${dashLeak}, styledPages=${styleOps} of ${multi.pageCount})`,
  ]);
} catch (e) {
  results.push(["Print preview · Comparison bars", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 32: both date switches on → start date in front, finish date behind ──
try {
  const { buildBarTextParts, DEFAULT_DISPLAY_SETTINGS: D32 } = await server.ssrLoadModule("/src/lib/displaySettings.js");
  const { default: Layout32 } = await server.ssrLoadModule("/src/components/gantt/UnifiedGanttLayout.jsx");
  const { buildGanttPDF: build32 } = await server.ssrLoadModule("/src/lib/exportGanttPDF.js");
  const strip32 = (h) => h.replace(/<!--[^>]*-->/g, "");

  const barWith32 = (info, labelPatch = {}) => ({
    ...D32.bar,
    label: { ...D32.bar.label, ...labelPatch },
    info: { ...D32.bar.info, ...info },
  });
  const row32 = { id: "t1", item: "A1", activity: "Excavate", start: "2026-09-01", end: "2026-11-30" };

  // 1 ── the parts helper
  const split = buildBarTextParts(row32, barWith32({ showName: true, showStart: true, showFinish: true }));
  const startOnly = buildBarTextParts(row32, barWith32({ showName: true, showStart: true }));
  const finishOnly = buildBarTextParts(row32, barWith32({ showName: true, showFinish: true }));
  const noneOn = buildBarTextParts(row32, barWith32({}));
  const labelIsStart = buildBarTextParts(row32, barWith32({ showStart: true, showFinish: true }, { field: "start" }));
  const partsOk = split.front === "2026-09-01" && split.back === "2026-11-30"
    && split.main === "A1 · Excavate" && split.split === true
    // one date only → the caption stays together (unchanged behaviour)
    && startOnly.split === false && startOnly.main === "A1 · Excavate · 2026-09-01"
    && finishOnly.split === false && finishOnly.main === "A1 · Excavate · 2026-11-30"
    && noneOn.split === false && noneOn.main === "A1"
    && labelIsStart.main === "";                     // no duplicate of the split date

  // 2 ── on screen: two separate captions, one at each end of the bar
  const tasks32 = [
    { id: "s1", isSection: true, activity: "PHASE ONE", sectionType: "blue" },
    { ...row32, activityId: "A100" },
  ];
  const chart32 = (info) => strip32(renderToString(React.createElement(Layout32, {
    ...baseProps, tasks: tasks32, computedTasks: tasks32,
    displaySettings: { ...D32, bar: barWith32(info) },
  })));
  const splitHtml = chart32({ showName: true, showStart: true, showFinish: true });
  const joinedHtml = chart32({ showName: true, showStart: true });
  const splitOk = splitHtml.includes(">2026-09-01</span>")          // start date on its own
    && splitHtml.includes(">2026-11-30</span>")                     // finish date on its own
    && splitHtml.includes(">A1 · Excavate</span>")                  // name without dates inside
    && !splitHtml.includes("A1 · Excavate · 2026-09-01 · 2026-11-30")
    && splitHtml.includes("translate(-100%, -50%)")                 // front box sits before the bar
    && (splitHtml.match(/translate\(-100%, -50%\)/g) || []).length === 1
    && (splitHtml.match(/translateY\(-50%\)/g) || []).length >= 1   // back box after the bar
    // with a single date the caption is still joined (no split)
    && joinedHtml.includes(">A1 · Excavate · 2026-09-01</span>")
    && !joinedHtml.includes("translate(-100%, -50%)");

  // 3 ── PDF: the start date must sit left of the caption, the finish date right of it
  const barPlain = build32({ tasks: tasks32, projectTitle: "Split dates", bar: barWith32({ showName: true, showStart: true }) }).doc;
  const barSplit = build32({ tasks: tasks32, projectTitle: "Split dates", bar: barWith32({ showName: true, showStart: true, showFinish: true }) }).doc;
  const splitItems = await pdfTextItems(barSplit);
  const joinedItems = await pdfTextItems(barPlain);
  const xStart = itemX(splitItems, "2026-09-01");
  const xName = itemX(splitItems, "Excavate");
  const xFinish = itemX(splitItems, "2026-11-30");
  const hasItem = (items, s) => items.some((i) => i.str.trim() === s);
  const pdfSplitOk = xStart !== null && xName !== null && xFinish !== null
    && xStart < xName && xName < xFinish                          // front · inside · back
    // split build: three separate items, and the caption carries no date
    && hasItem(splitItems, "A1 · Excavate") && hasItem(splitItems, "2026-09-01") && hasItem(splitItems, "2026-11-30")
    && !splitItems.some((i) => i.str.includes("A1 · Excavate ·"))
    // single date stays in one caption
    && hasItem(joinedItems, "A1 · Excavate · 2026-09-01");
  const splitState = { xStart, xName, xFinish,
    joinedStart: itemX(joinedItems, "2026-09-01"), joinedFinish: itemX(joinedItems, "2026-11-30") };

  results.push([
    "Bar dates split (start in front · finish behind when both switches are on)",
    partsOk && splitOk && pdfSplitOk
      ? "OK (split only when both dates are on: start date before the bar, finish date after it, name stays inside; single date keeps the old joined caption; chart + PDF)"
      : `UNEXPECTED (parts=${partsOk} chart=${splitOk} pdf=${pdfSplitOk}${JSON.stringify(splitState)})`,
  ]);
} catch (e) {
  results.push(["Bar dates split", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
}

// ── Batch 30: nothing is hidden behind "…" — every value is shown in full ─────
try {
  const { measureTextWidth, fitFontSizeToWidth, textFits } = await server.ssrLoadModule("/src/lib/displaySettings.js");
  const { default: Layout30 } = await server.ssrLoadModule("/src/components/gantt/UnifiedGanttLayout.jsx");
  const { buildGanttPDF: build30 } = await server.ssrLoadModule("/src/lib/exportGanttPDF.js");
  const { DEFAULT_DISPLAY_SETTINGS: D30 } = await server.ssrLoadModule("/src/lib/displaySettings.js");
  const strip30 = (h) => h.replace(/<!--[^>]*-->/g, "");

  // 1 ── measurement helpers (no canvas in this environment → estimate path)
  const wShort = measureTextWidth("A1", 10);
  const wLong = measureTextWidth("A1 · Excavate · 2026-09-01", 10);
  const wCjk = measureTextWidth("樁基工程", 10);
  const shrink = fitFontSizeToWidth("Excavate and cart away unsuitable material", 60, 10, "", 6.5);
  const fontOk = wShort > 0 && wLong > wShort && wCjk > measureTextWidth("abcd", 10)
    && wCjk <= 4 * 10 + 0.01                                        // CJK ≈ 1 em per glyph
    && textFits("A1", 50, 10) && !textFits("Excavate and cart away unsuitable material", 60, 10)
    && shrink < 10 && shrink >= 6.5
    && fitFontSizeToWidth("A1", 50, 10) === 10;                     // short text keeps its size

  // 2 ── on-screen: long names are printed in full, never as "…"
  const longName = "PHASE ONE — Site preparation, drainage and piling works (Zone A to D)";
  const longActivity = "Excavate and cart away unsuitable material from the basement footprint";
  const tasks30 = [
    { id: "s1", isSection: true, activity: longName, sectionType: "blue" },
    { id: "t1", activityId: "A100", activity: longActivity, item: "A1", start: "2026-09-01", end: "2026-09-25" },
  ];
  const chart30 = strip30(renderToString(React.createElement(Layout30, {
    ...baseProps, tasks: tasks30, computedTasks: tasks30,
    displaySettings: { ...D30, bar: { ...D30.bar, info: { ...D30.bar.info, showName: true, showStart: true, showFinish: true } } },
  })));
  // A ~48px bar cannot hold the whole caption, so it is drawn outside the bar —
  // the full string must be there and no ellipsis/truncate style may survive.
  // (Batch 32 splits the two dates to the bar's ends, so the caption is the name.)
  const chartOk = chart30.includes(longName)                        // programme name in full
    && chart30.includes(`A1 · ${longActivity}`)
    && chart30.includes(">2026-09-01</span>") && chart30.includes(">2026-09-25</span>")
    && !chart30.includes("ellipsis")
    && !chart30.includes("truncate");

  // 3 ── PDF: the text layer must contain the whole value (was "…" before)
  const pdf30 = build30({ tasks: tasks30, projectTitle: "No ellipsis" }).doc;
  const pdfObj = await pdfjsLib.getDocument({ data: new Uint8Array(pdf30.output("arraybuffer")), isEvalSupported: false }).promise;
  let pdfText = "";
  for (let p = 1; p <= pdfObj.numPages; p++) {
    const page = await pdfObj.getPage(p);
    const content = await page.getTextContent();
    pdfText += content.items.map((it) => it.str).join(" ") + " ";
  }
  await pdfObj.destroy();
  const pdfOk30 = pdfText.includes(longActivity)
    && pdfText.includes(longName.replace("—", "-"))   // the em-dash is sanitised in the PDF
    && !pdfText.includes("Excavat...") && !pdfText.includes("...");

  results.push([
    "Full values everywhere (no \"…\" truncation · chart + PDF text layer)",
    fontOk && chartOk && pdfOk30
      ? "OK (measured fit: long captions move outside the bar, long names/activities appear complete on screen and in the PDF text layer)"
      : `UNEXPECTED (measure=${fontOk} chart=${chartOk} pdf=${pdfOk30}${pdfOk30 ? "" : ` text:${pdfText.slice(0, 160)}`})`,
  ]);
} catch (e) {
  results.push(["Full values everywhere", `FAILED: ${e.constructor.name}: ${String(e.message).split("\n")[0]}`]);
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

  // ── Large round trip: a real programme-sized payload (600 rows, every field) ──
  // Small fixtures cannot prove the chunking works: this payload spans several
  // metadata chunks (Subject holds chunk 0, Keywords the overflow) and must still
  // decode identically after a real jsPDF write followed by a pdfjs read.
  const bigTasks = Array.from({ length: 600 }, (_, i) => {
    if (i % 40 === 0) {
      return {
        id: `s${i}`, isSection: true, sectionLevel: (i % 3) + 1,
        sectionType: i % 80 === 0 ? "pink" : "blue", sectionBg: "#e8f1ee",
        activity: `Section ${i / 40 + 1} — bilingual heading 樁基工程 with a longer title to fill the payload (${i})`,
      };
    }
    return {
      id: i, activityId: `WSD-MiC-${1000 + i}`, item: String(i),
      activity: `Activity ${i} — slope works, drainage & 樁基 (long name to fill the payload)`,
      start: "2025-01-06", end: "2025-02-11", baselineStart: "2025-01-02", baselineFinish: "2025-02-05",
      startActual: i % 2 === 0, endActual: i % 3 === 0, remainDur: i % 17, float: i % 11, pct: i % 101,
      earlyStart: "2025-01-06", earlyEnd: "2025-02-11", lateStart: "2025-01-09", lateEnd: "2025-02-14",
      freeFloat: i % 5, primaryResource: `RES-${i % 7}`, durationType: "DT_FixedDUR2", statusCode: "TK_NotStart",
      drivingPathFlag: i % 4 === 0 ? "Y" : "N", locationId: `Z${i % 9}`, p6Guid: `GUID-${i}-abcdef`,
      links: [{ succId: i + 1, type: i % 2 ? "SS" : "FS", lag: i % 6 }],
      calendar: "5-Day Work Week",
    };
  });
  const bigEmbed = await encodeTasksForPDF(bigTasks);
  const bigDoc = buildGanttPDF({ tasks: bigTasks, projectTitle: "Big Round Trip", programmeRef: "BIG-1", embedData: bigEmbed }).doc;
  const bigBytes = new Uint8Array(bigDoc.output("arraybuffer"));
  const bigPdf = await pdfjsLib.getDocument({ data: bigBytes, isEvalSupported: false }).promise;
  const bigInfo = (await bigPdf.getMetadata()).info;
  const bigPages = bigPdf.numPages;
  const bigBack = await decodeTasksFromPDFInfo(bigInfo);
  await bigPdf.destroy();
  const bigSame = JSON.stringify(bigBack) === JSON.stringify(bigTasks);
  const chunks = Number(String(bigInfo.Author || bigInfo.author || "").replace(/[^0-9]/g, "")) || 0;
  results.push([
    "PDF embedded data round trip (600 rows, multi-chunk payload)",
    bigSame && chunks > 1
      ? `OK (${bigTasks.length} rows, ${bigEmbed.bytes.toLocaleString()} bytes JSON → ${(bigEmbed.subject.length + bigEmbed.keywords.length).toLocaleString()} chars in ${chunks} chunks, ${bigPages} page(s), every field identical)`
      : `UNEXPECTED (same=${bigSame}, chunks=${chunks}, decoded=${bigBack ? bigBack.length : 0})`,
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
  // Both vision paths go through invokeVisionLLM() (1 definition + 3 call sites:
  // first pass, single-page re-read, single image), which is the only place the
  // vision schema is referenced.
  const visionCallSites = (src.match(/invokeVisionLLM\(/g) || []).length;
  const schemaRefs = (src.match(/response_json_schema: GANTT_VISION_TASK_SCHEMA/g) || []).length;
  const retryGuard = /VISION_MIN_ROWS/.test(src) && /const VISION_MIN_ROWS = 2;/.test(src);
  const fidelityRule = /NEVER invent values/.test(src);
  // Batch 23B added section_level + section_color (16 → 18). 18 is the measured
  // ceiling: on a real programme page 16 / 17 / 18 fields all returned 41 rows,
  // while batch 6's 37 fields collapsed to 3 rows. Do not grow past 18 without a
  // fresh A/B run (scripts/ab-vision-schema.mjs).
  const levelRules = /section_level/.test(src) && /section_color/.test(src) && /WBS LEVELS/.test(src);
  // The new fields must actually reach the tasks: aiResultToTasks() keeps them as
  // a hint (aiSectionLevel) so the deterministic numbering pass can win first.
  const mapsToTask = /aiSectionLevel: Number\(t\.section_level\)/.test(src)
    && /sectionColorName: String\(t\.section_color\)/.test(src)
    && /inferSectionLevels\(parsedTasks\)/.test(src);
  const visionRules = (src.match(/GANTT_VISION_PROMPT_SUFFIX/g) || []).length === 3;  // 1 const + 2 call sites
  const ok = fieldCount === 18 && visionCallSites === 4 && schemaRefs === 1
    && fidelityRule && levelRules && mapsToTask && visionRules && retryGuard;
  results.push([
    "ImageImportDialog vision schema (row-count guard)",
    ok
      ? `OK (${fieldCount} row fields — the A/B-verified ceiling, ${visionCallSites - 1} vision call sites via invokeVisionLLM, 1 schema reference, fidelity rule, WBS level/colour rules on both vision prompts, fields mapped to aiSectionLevel, low-row retry guard)`
      : `FAILED (row fields=${fieldCount}, visionCallSites=${visionCallSites}, schemaRefs=${schemaRefs}, fidelity rule=${fidelityRule}, level rules=${levelRules}, mapped=${mapsToTask}, prompt suffix uses=${visionRules}, retry guard=${retryGuard})`,
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
