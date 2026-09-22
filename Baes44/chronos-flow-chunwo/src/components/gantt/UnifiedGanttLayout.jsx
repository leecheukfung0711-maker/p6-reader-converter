/**
 * UnifiedGanttLayout — SPLIT LAYOUT
 *
 * Left panel: fixed width, NO horizontal scroll, vertical scroll only.
 * Right panel: horizontal + vertical scroll (Gantt area).
 * Both panels share the same vertical scroll position (synced via JS).
 *
 * Row heights are physically identical because left/right rows are paired
 * and both set to the same ROW_H constant.
 */
import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import {
  parseISO, isValid, differenceInDays, addDays, addMonths,
  startOfMonth, startOfWeek, format, eachMonthOfInterval, eachWeekOfInterval
} from "date-fns";
import { countWorkingDays, addWorkingDays, getHolidaysInRange } from "@/lib/hkWorkingDays";
import { Plus, Trash2, Link2, GripVertical, ArrowUp, ArrowDown, ChevronsUpDown, ChevronRight, ChevronDown, Lock, LockOpen, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import RowContextMenu from "./RowContextMenu";
import BulkEditBar from "./BulkEditBar";
import BarColorPicker from "./BarColorPicker";
import SectionColorPicker from "./SectionColorPicker";
import { buildPLF, parsePLF } from "@/lib/parsePLF";
import { cssGridBorder, formatDisplayDate, mergeDisplaySettings, resolveWbsRowStyle, buildBarTextParts, normalizeBarTextPosition, barTextFontFamilyCss, measureTextWidth, fitFontSizeToWidth } from "@/lib/displaySettings";
import { clampWbsLevel, wbsIndentPx } from "@/lib/wbsLevel";
import { buildRelationshipMap } from "@/lib/buildRelationshipMap";
import { normalizeRecalcDate } from "@/lib/quickFilters";

const ROW_H = 27;
const COL_WIDTH_DEFAULT = { year: 160, month: 60, week: 40, day: 24, weekDay: 32 };
const COL_WIDTH_MIN = { year: 40, month: 20, week: 14, day: 8, weekDay: 12 };
const COL_WIDTH_MAX = { year: 400, month: 200, week: 120, day: 60, weekDay: 80 };

/**
 * Timeline "Time Scale" modes (mirrors the XER Viewer Gantt Settings → Timeline & Grid).
 *   Auto · Year · Year-Month · Month-Week · Month-Day · Week-Day
 * `col` = granularity of the timeline columns (second header row)
 * `top` = granularity of the grouping row (first header row)
 */
export const TIME_SCALES = [
  { value: "auto",    label: "Auto",          col: "auto",  top: "auto"  },
  { value: "year",    label: "Year",          col: "year",  top: "year"  },
  { value: "month",   label: "Year - Month",  col: "month", top: "year"  },
  { value: "week",    label: "Month - Week",  col: "week",  top: "month" },
  { value: "day",     label: "Month - Day",   col: "day",   top: "month" },
  { value: "weekDay", label: "Week - Day",    col: "day",   top: "week"  },
];
export const SCALE_OF = Object.fromEntries(TIME_SCALES.filter(s => s.value !== "auto").map(s => [s.value, s]));

/** Auto: pick a scale from the schedule length (XER Viewer's auto mode switch). */
export function resolveTimeScale(viewMode, minDate, maxDate) {
  if (viewMode && viewMode !== "auto") return SCALE_OF[viewMode] ? viewMode : "month";
  const days = Math.max(1, differenceInDays(maxDate, minDate));
  if (days > 550) return "year";
  if (days > 130) return "month";
  if (days > 45)  return "week";
  if (days > 21)  return "day";
  return "weekDay";
}
const INIT_W = { type: 36, rownum: 32, item: 48, activityId: 100, activity: 160, start: 110, end: 110, link: 36, duration: 72, remainDur: 72, float: 72, pct: 66, blStart: 110, blEnd: 110 };
// Additional P6 fields — hidden by default, available via column menu
const INIT_W_EXTRA = { earlyStart: 110, earlyEnd: 110, lateStart: 110, lateEnd: 110, freeFloat: 72, expectedFinish: 110, primaryResource: 72, durationType: 60, completePctType: 60, statusCode: 60, constraintType: 60, constraintDate: 110, constraintType2: 60, constraintDate2: 110, suspendDate: 110, resumeDate: 110, priorityType: 60, locationId: 72, estWt: 50, drivingPathFlag: 50, lockPlanFlag: 50, autoComputeActFlag: 50, actLaborUnits: 72, actNonlaborUnits: 72, remLaborUnits: 72, remNonlaborUnits: 72, planLaborUnits: 72, planNonlaborUnits: 72, reviewFinish: 110, reviewStatus: 60, externalEarlyStart: 110, externalLateFinish: 110, remEarlyStart: 110, remEarlyFinish: 110, remLateStart: 110, remLateFinish: 110, floatPath: 50, floatPathOrder: 50, p6Guid: 100, p6TaskId: 60, targetDuration: 72, calendar: 80 };
const COL_KEYS = [...Object.keys(INIT_W), ...Object.keys(INIT_W_EXTRA)];
const DEFAULT_HIDDEN = new Set(["blStart", "blEnd", "remainDur", "float", "pct", ...Object.keys(INIT_W_EXTRA)]);
export const INIT_VISIBILITY = Object.fromEntries(COL_KEYS.map((k, i) => [k, { visible: !DEFAULT_HIDDEN.has(k), position: i }]));
// Link now stores predecessor task ID, default FS logic with lag days
const BAR_COLORS = {
  baseline: "#005a53",
  delay: "#e88219",
  custom: ["#005a53", "#e88219", "#b15315", "#733208", "#003531", "#001c19", "#333333", "#6c757d"],
};

// Apply link constraint: Fixed date offset
// When task.link points to nextTask, moving task will shift nextTask
// offset = succ.start - pred.end (stored in succ.linkOffset)
// newSucc.start = pred.end + offset, newSucc.end = newSucc.start + duration
function applyLink(pred, succ, offset) {
  if (!pred || !succ) return succ;
  const predEnd = pred.end && isValid(parseISO(pred.end)) ? parseISO(pred.end) : null;
  const succStart = succ.start && isValid(parseISO(succ.start)) ? parseISO(succ.start) : null;
  const succEnd = succ.end && isValid(parseISO(succ.end)) ? parseISO(succ.end) : null;
  const dur = (succStart && succEnd) ? differenceInDays(succEnd, succStart) : 0;

  if (!predEnd) return succ;
  
  const newStart = addDays(predEnd, offset);
  const newEnd = dur > 0 ? addDays(newStart, dur) : newStart;
  
  return {
    ...succ,
    start: format(newStart, "yyyy-MM-dd"),
    end: format(newEnd, "yyyy-MM-dd"),
  };
}

function getTimelineColumns(minDate, maxDate, viewMode) {
  const cols = [];
  const scale = SCALE_OF[viewMode] || SCALE_OF.month;
  if (scale.col === "year") {
    let d = new Date(minDate.getFullYear(), 0, 1);
    while (d <= maxDate) { cols.push({ label: format(d, "yyyy"), date: d }); d = addMonths(d, 12); }
  } else if (scale.col === "month") {
    eachMonthOfInterval({ start: startOfMonth(minDate), end: maxDate }).forEach(m =>
      cols.push({ label: format(m, "MMM yy"), date: m }));
  } else if (scale.col === "week") {
    eachWeekOfInterval({ start: startOfWeek(minDate, { weekStartsOn: 1 }), end: maxDate }, { weekStartsOn: 1 }).forEach(w =>
      cols.push({ label: format(w, "MM/dd"), date: w }));
  } else {
    let d = minDate;
    while (d <= maxDate) { cols.push({ label: format(d, "dd"), date: d }); d = addDays(d, 1); }
  }
  return cols;
}





function calcWD(s, e) { if (!s) return ""; const n = countWorkingDays(s, e || s); return n > 0 ? String(n) : ""; }
function calcCal(s, e) {
  try { const sd = parseISO(s), ed = parseISO(e || s); if (!isValid(sd)||!isValid(ed)) return ""; const d = differenceInDays(ed,sd)+1; return d>=1?String(d):""; }
  catch { return ""; }
}
function bpos(s, e, tl, ppd) {
  return { left: Math.max(0, differenceInDays(s,tl)*ppd), width: Math.max(0, (differenceInDays(e,s)+1)*ppd) };
}

function RH({ onMouseDown }) {
  return <div onMouseDown={onMouseDown} style={{ position:"absolute",right:0,top:0,bottom:0,width:8,cursor:"col-resize",zIndex:100, background:"transparent" }} />;
}

// ── Milestone marker (diamond / square / circle).
// Module level on purpose: everything it needs comes from props, so it can never
// capture component-scope values that are not initialised yet.
function MileShape({ size, shape, fill, stroke, strokeWidth }) {
  const s = size;
  const common = { fill, stroke, strokeWidth, strokeLinejoin: "round" };
  return (
    <svg width={s * 2} height={s * 2} style={{ overflow: "visible" }}>
      {shape === "square" ? (
        <rect x={0} y={0} width={s * 2} height={s * 2} rx={1} {...common} />
      ) : shape === "circle" ? (
        <circle cx={s} cy={s} r={s} {...common} />
      ) : (
        <polygon points={`${s},0 ${s * 2},${s} ${s},${s * 2} 0,${s}`} {...common} />
      )}
    </svg>
  );
}

const BD = "1px solid #cecece";
const HD = "1px solid #003531";
const HD_BG = "#003531";

export default function UnifiedGanttLayout({
  tasks, setTasks, computedTasks,
  selectedIds, setSelectedIds, onPaste,
  durMode, setDurMode,
  viewMode, showToday,
  // Batch 44 — holiday markers are their own switch (default OFF) instead of riding on the
  // Today line: the two are separate options in the Print Preview too.
  showHolidays = false,
  labelOffsets, setLabelOffsets,
  tableWidth, startResize,
  saveToHistory,
  tableFontScale = 1.0,
  sortState: sortStateProp,
  setSortState: setSortStateProp,
  onOpenImport,
  onDropImport,
  showStaircase = true,
  showRelationshipLines = true,
  // Batch 27 — Last Recalc Date (the programme's data date): the line on the
  // chart, and the editor behind the row right-click menu.
  showRecalcLine = true,
  recalcDate = "",
  fileRecalcDate = "",
  onRecalcDateChange,
  staircaseFilter = null,
  onStaircaseFilterChange,
  onFiltersLoaded,
  columnVisibility: columnVisibilityProp = null,
  cw: cwProp,
  setCw: setCwProp,
  onColumnVisibilityChange,
  onOpenColumnPanel,
  displaySettings: displaySettingsProp = null,
  collapsedIds: collapsedIdsProp = null,
  onToggleSection,
  onExpandAll,
  onCollapseAll,
}) {
  // ── Grid lines + date format + bar appearance (shared with the PDF export) ─
  const dsp = mergeDisplaySettings(displaySettingsProp);
  const grid = dsp.grid;
  const bar = dsp.bar;
  const grp = dsp.group;
  const dateFormat = dsp.dateFormat || "yyyy-MM-dd";
  const BD_ROW   = cssGridBorder(grid.rowVisible,   grid.rowWeight,   grid.rowStyle,   grid.rowColor);
  const BD_COL   = cssGridBorder(grid.colVisible,   grid.colWeight,   grid.colStyle,   grid.colColor);
  const BD_GROUP = cssGridBorder(grid.groupVisible, grid.groupWeight, grid.groupStyle, grid.groupColor);
  // Batch 44 — holiday markers have their own switch (`showHolidays`, default OFF). They
  // used to be tied to the Today line, so "Holiday Markers: off" also removed the today line.
  // Local state for columnVisibility and cw if not provided by parent
  const [localColumnVisibility, setLocalColumnVisibility] = useState(INIT_VISIBILITY);
  const [localCw, setLocalCw] = useState(INIT_W);
  // Use parent's columnVisibility if provided, otherwise use local state
  const columnVisibility = columnVisibilityProp !== null && columnVisibilityProp !== undefined ? columnVisibilityProp : localColumnVisibility;
  const cw = cwProp ?? localCw;
  const setCwInternal = setCwProp ?? setLocalCw;
  // setColumnVisibility: update local state and notify parent
  const setColumnVisibility = useCallback((updater) => {
    setLocalColumnVisibility(prev => {
      const base = prev || INIT_VISIBILITY;
      const next = typeof updater === "function" ? updater(base) : updater;
      // Notify parent with the new state
      if (onColumnVisibilityChange) {
        onColumnVisibilityChange(next);
      }
      return next;
    });
  }, [onColumnVisibilityChange]);
  
  const [bindChainMode, setBindChainMode] = useState(false);
  const [durLocked, setDurLocked] = useState(false);
  const lastClickedIdx = useRef(null);
  const [colWidth, setColWidth] = useState(COL_WIDTH_DEFAULT);
  const [headerMenu, setHeaderMenu] = useState(null); // { x, y }
  const headerMenuRef = useRef(null);
  const plfInputRef = useRef(null);

  const [colDragOver, setColDragOver] = useState(null);
  const [plfDragOver, setPlfDragOver] = useState(false);
  const [plfLoading, setPlfLoading] = useState(false);
  const [saveName, setSaveName] = useState("");


  // ── Layout templates (localStorage) ──────────────────────────────────────
  const LS_KEY = "gantt_layout_templates";
  const [savedTemplates, setSavedTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  });

  function saveTemplate(name) {
    const templates = savedTemplates.filter(t => t.name !== name);
    const entry = { name, columnVisibility, cw, savedAt: new Date().toISOString() };
    const updated = [entry, ...templates].slice(0, 20);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    setSavedTemplates(updated);
  }

  function loadTemplate(template) {
    setColumnVisibility(template.columnVisibility);
    setCwInternal(prev => ({ ...prev, ...template.cw }));
    setHeaderMenu(null);
  }

  function deleteTemplate(name) {
    const updated = savedTemplates.filter(t => t.name !== name);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    setSavedTemplates(updated);
  }





  // Column definitions for dynamic rendering: header label + row cell renderer
  const COL_DEFS = {
    type:       { header: "Type",       key: "type" },
    rownum:     { header: "#",          key: "rownum" },
    item:       { header: "Item",       key: "item" },
    activityId: { header: "ID",         key: "activityId" },
    activity:   { header: "Activity",   key: "activity" },
    start:      { header: "Start",      key: "start" },
    end:        { header: "End",        key: "end" },
    link:       { header: "Link",       key: "link" },
    duration:   { header: durMode === "wd" ? "Dur.(WD)" : "Dur.(Cal)", key: "duration" },
    remainDur:  { header: "Rem.Dur",    key: "remainDur" },
    float:      { header: "Float",      key: "float" },
    pct:        { header: "% Comp",     key: "pct" },
    blStart:    { header: "BL Start",   key: "blStart" },
    blEnd:      { header: "BL End",     key: "blEnd" },
    // ── Additional P6 scheduling fields (hidden by default) ────────────────
    earlyStart:       { header: "Early Start",      key: "earlyStart" },
    earlyEnd:         { header: "Early Finish",     key: "earlyEnd" },
    lateStart:        { header: "Late Start",       key: "lateStart" },
    lateEnd:          { header: "Late Finish",      key: "lateEnd" },
    freeFloat:        { header: "Free Float",       key: "freeFloat" },
    expectedFinish:   { header: "Exp. Finish",      key: "expectedFinish" },
    primaryResource:  { header: "Resource",         key: "primaryResource" },
    durationType:     { header: "Dur. Type",        key: "durationType" },
    completePctType:  { header: "% Type",            key: "completePctType" },
    statusCode:       { header: "Status",           key: "statusCode" },
    constraintType:   { header: "Constraint",       key: "constraintType" },
    constraintDate:   { header: "Const. Date",      key: "constraintDate" },
    constraintType2:  { header: "Const.2",           key: "constraintType2" },
    constraintDate2:  { header: "Const.2 Date",     key: "constraintDate2" },
    suspendDate:      { header: "Suspend",          key: "suspendDate" },
    resumeDate:       { header: "Resume",           key: "resumeDate" },
    priorityType:     { header: "Priority",        key: "priorityType" },
    locationId:       { header: "Location",         key: "locationId" },
    estWt:            { header: "Est Wt",            key: "estWt" },
    drivingPathFlag:  { header: "Long.Path",         key: "drivingPathFlag" },
    lockPlanFlag:     { header: "Lock Plan",         key: "lockPlanFlag" },
    autoComputeActFlag: { header: "Auto Actuals",    key: "autoComputeActFlag" },
    actLaborUnits:    { header: "Act.Labor",         key: "actLaborUnits" },
    actNonlaborUnits: { header: "Act.NonLabor",      key: "actNonlaborUnits" },
    remLaborUnits:    { header: "Rem.Labor",         key: "remLaborUnits" },
    remNonlaborUnits: { header: "Rem.NonLabor",      key: "remNonlaborUnits" },
    planLaborUnits:   { header: "Plan Labor",        key: "planLaborUnits" },
    planNonlaborUnits:{ header: "Plan NonLabor",     key: "planNonlaborUnits" },
    reviewFinish:     { header: "Review Finish",     key: "reviewFinish" },
    reviewStatus:     { header: "Review Status",     key: "reviewStatus" },
    externalEarlyStart: { header: "Ext.ES",           key: "externalEarlyStart" },
    externalLateFinish: { header: "Ext.LF",           key: "externalLateFinish" },
    remEarlyStart:    { header: "Rem.ES",             key: "remEarlyStart" },
    remEarlyFinish:   { header: "Rem.EF",             key: "remEarlyFinish" },
    remLateStart:     { header: "Rem.LS",             key: "remLateStart" },
    remLateFinish:    { header: "Rem.LF",             key: "remLateFinish" },
    floatPath:        { header: "Float Path",         key: "floatPath" },
    floatPathOrder:   { header: "FP Order",           key: "floatPathOrder" },
    p6Guid:           { header: "GUID",               key: "p6Guid" },
    p6TaskId:         { header: "P6 ID",              key: "p6TaskId" },
    targetDuration:   { header: "Plan.Dur",          key: "targetDuration" },
    calendar:         { header: "Calendar",          key: "calendar" },
  };



  // Close header menu on outside click
  useEffect(() => {
    if (!headerMenu) return;
    const close = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenu(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [headerMenu]);

  // Keyboard shortcut: Ctrl+L to open layout menu on the grip icon
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        // Position menu near top-left of screen as fallback
        setHeaderMenu(prev => prev ? null : { x: 24, y: 54 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Effective column width respecting visibility (uses INIT_W_EXTRA fallback for extra cols)
  const ecw = useMemo(() => {
    const result = {};
    COL_KEYS.forEach(k => {
      const fallback = INIT_W[k] ?? INIT_W_EXTRA[k] ?? 72;
      const isVisible = columnVisibility[k]?.visible !== false;
      result[k] = isVisible ? (cw[k] ?? fallback) : 0;

    });
    return result;
  }, [cw, columnVisibility]);

  // Sorted column keys by position - filter out hidden columns
  const sortedColKeys = useMemo(() => {
    const visible = [...COL_KEYS]
      .filter(k => columnVisibility[k]?.visible !== false)
      .sort((a, b) => (columnVisibility[a]?.position ?? 0) - (columnVisibility[b]?.position ?? 0));

    return visible;
  }, [columnVisibility]);

  function handleSaveLayout() {
    const xml = buildPLF(columnVisibility, cw);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "gantt_layout.plf"; a.click();
    URL.revokeObjectURL(url);
    setHeaderMenu(null);
  }

  function handleLoadLayout() {
    plfInputRef.current?.click();
    setHeaderMenu(null);
  }

  function handlePLFFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parsePLF(ev.target.result);
      if (!result) {
        alert("Unable to parse this PLF file. Please ensure the format is correct.");
        return;
      }
      // Build visibility from scratch:
      // - Columns present in the PLF → use their saved visible state and position
      // - Columns NOT in the PLF → hidden (visible: false), keep at end
      const newVisibility = {};
      const plfKeys = new Set(Object.keys(result.columnVisibility));
      // First, set all known columns to hidden
      COL_KEYS.forEach((k, i) => {
        newVisibility[k] = { visible: false, position: 1000 + i };
      });
      // Then, apply PLF columns with their saved visible state and positions
      Object.entries(result.columnVisibility).forEach(([k, v]) => {
        if (newVisibility[k] !== undefined) {
          // Respect the saved visible state — v.visible may be true or false
          // from custom XML format, or always true from P6 native formats
          newVisibility[k] = { visible: v.visible !== false, position: v.position };
        }
      });
      // Always keep these core columns visible if PLF doesn't mention them at all
      // (type, rownum are UI-only and not in P6 PLF — keep them as default)
      // Only apply if PLF explicitly provides at least some columns
      if (plfKeys.size > 0) {
        setColumnVisibility(newVisibility);
      }
      setCwInternal(prev => ({ ...prev, ...result.cw }));
      // Apply filters from PLF if present
      if (result.filters && onFiltersLoaded) {
        onFiltersLoaded(result.filters);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // Header → internal key mapping (case-insensitive matching)
  // Each key can have multiple alias entries that all map to the same internal key
  const HEADER_TO_KEY = {
    // Core
    "Type": "type", "#": "rownum", "Item": "item", "Activity ID": "activityId",
    "Activity": "activity", "Start": "start", "End": "end", "Link": "link",
    // Duration
    "Dur.": "duration", "Dur.(WD)": "duration", "Dur.(Cal)": "duration",
    "Duration": "duration", "Original Duration": "duration",
    "Planned Duration": "duration", "Plan Duration": "duration",
    // Remaining Duration
    "Rem.Dur": "remainDur", "Remaining Duration": "remainDur",
    // Float
    "Float": "float", "Total Float": "float", "TF": "float",
    // % Complete
    "% Comp": "pct", "% Complete": "pct", "Pct": "pct",
    "Schedule % Complete": "pct", "Performance % Complete": "pct",
    // Baseline
    "BL Start": "blStart", "Baseline Start": "blStart",
    "BL End": "blEnd", "Baseline Finish": "blEnd",
    // Early dates
    "Early Start": "earlyStart", "Early Finish": "earlyEnd",
    "Start Date": "earlyStart", "Finish Date": "earlyEnd",
    // Late dates
    "Late Start": "lateStart", "Late Finish": "lateEnd",
    // Free Float
    "Free Float": "freeFloat", "FF": "freeFloat",
    // Expected Finish
    "Exp. Finish": "expectedFinish", "Expected Finish": "expectedFinish",
    // Resource
    "Resource": "primaryResource", "Primary Resource": "primaryResource",
    "Res.": "primaryResource",
    // Duration Type
    "Dur. Type": "durationType", "Duration Type": "durationType",
    // % Type
    "% Type": "completePctType", "Percent Complete Type": "completePctType",
    // Status
    "Status": "statusCode", "Activity Status": "statusCode",
    // Constraints
    "Constraint": "constraintType", "Primary Constraint": "constraintType",
    "Const. Date": "constraintDate", "Constraint Date": "constraintDate",
    "Const.2": "constraintType2", "Secondary Constraint": "constraintType2",
    "Const.2 Date": "constraintDate2", "Constraint Date 2": "constraintDate2",
    // Suspend / Resume
    "Suspend": "suspendDate", "Suspend Date": "suspendDate",
    "Resume": "resumeDate", "Resume Date": "resumeDate",
    // Priority
    "Priority": "priorityType", "Priority Type": "priorityType",
    "Leveling Priority": "priorityType",
    // Location
    "Location": "locationId", "Location ID": "locationId",
    // Est Weight
    "Est Wt": "estWt", "Estimated Weight": "estWt",
    // Driving Path
    "Long.Path": "drivingPathFlag", "Longest Path": "drivingPathFlag",
    "Driving Path": "drivingPathFlag",
    // Lock Plan
    "Lock Plan": "lockPlanFlag", "Lock Plan Flag": "lockPlanFlag",
    // Auto Actuals
    "Auto Actuals": "autoComputeActFlag", "Auto Compute Actuals": "autoComputeActFlag",
    // Labor / Nonlabor units
    "Act.Labor": "actLaborUnits", "Actual Labor Units": "actLaborUnits",
    "Act.NonLabor": "actNonlaborUnits", "Actual Nonlabor Units": "actNonlaborUnits",
    "Rem.Labor": "remLaborUnits", "Remaining Labor Units": "remLaborUnits",
    "Rem.NonLabor": "remNonlaborUnits", "Remaining Nonlabor Units": "remNonlaborUnits",
    "Plan Labor": "planLaborUnits", "Planned Labor Units": "planLaborUnits",
    "Plan NonLabor": "planNonlaborUnits", "Planned Nonlabor Units": "planNonlaborUnits",
    // Review
    "Review Finish": "reviewFinish", "Review Finish Date": "reviewFinish",
    "Review Status": "reviewStatus",
    // External dates
    "Ext.ES": "externalEarlyStart", "External Early Start": "externalEarlyStart",
    "Ext.LF": "externalLateFinish", "External Late Finish": "externalLateFinish",
    // Remaining dates
    "Rem.ES": "remEarlyStart", "Remaining Early Start": "remEarlyStart",
    "Rem.EF": "remEarlyFinish", "Remaining Early Finish": "remEarlyFinish",
    "Rem.LS": "remLateStart", "Remaining Late Start": "remLateStart",
    "Rem.LF": "remLateFinish", "Remaining Late Finish": "remLateFinish",
    // Float Path
    "Float Path": "floatPath", "Float Path ID": "floatPath",
    "FP Order": "floatPathOrder", "Float Path Order": "floatPathOrder",
    // GUID / P6 ID
    "GUID": "p6Guid", "Global ID": "p6Guid",
    "P6 ID": "p6TaskId", "Task ID": "p6TaskId",
    // Target / Plan Duration
    "Plan.Dur": "targetDuration", "Target Duration": "targetDuration",
    "Plan Dur": "targetDuration",
    // Calendar
    "Working Calendars": "calendar", "Calendar": "calendar",
    "Calendar ID": "calendar", "Cal.": "calendar",
  };

  // Normalize header text for matching (case-insensitive, trim, collapse spaces)
  function normalizeHeader(text) {
    return (text || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  // Build a normalized lookup map from HEADER_TO_KEY
  const NORMALIZED_HEADER_MAP = {};
  Object.entries(HEADER_TO_KEY).forEach(([header, key]) => {
    NORMALIZED_HEADER_MAP[normalizeHeader(header)] = key;
  });

  // Fuzzy match: given a raw column name from the LLM (or directly from OCR),
  // try to find the best matching internal key
  function fuzzyMatchColumn(raw) {
    const norm = normalizeHeader(raw);
    if (!norm) return null;

    // 1. Exact normalized match
    if (NORMALIZED_HEADER_MAP[norm]) return NORMALIZED_HEADER_MAP[norm];

    // 2. Check if the raw value is already an internal key
    if (COL_KEYS.includes(raw)) return raw;

    // 3. Substring / partial match — header contains the raw text or vice versa
    for (const [hdr, key] of Object.entries(NORMALIZED_HEADER_MAP)) {
      if (hdr.includes(norm) || norm.includes(hdr)) return key;
    }

    // 4. Token-based match: check individual words
    const tokens = norm.split(/[\s.()]+/).filter(t => t.length >= 2);
    for (const [hdr, key] of Object.entries(NORMALIZED_HEADER_MAP)) {
      const hdrTokens = hdr.split(/[\s.()]+/).filter(t => t.length >= 2);
      const overlap = tokens.filter(t => hdrTokens.includes(t)).length;
      if (overlap >= 2 || (hdrTokens.length === 1 && overlap >= 1)) return key;
    }

    return null;
  }

  async function handleDropFile(file) {
    if (/\.plf$/i.test(file.name)) {
      const r = new FileReader();
      r.onload = ev => handlePLFFile({ target: { files: [file] } });
      r.readAsText(file);
      setHeaderMenu(null);
      return;
    }
    setPlfLoading(true);
    try {
      let fileUrls = [];
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPagesToCheck = Math.min(pdf.numPages, 6);
        for (let p = 1; p <= numPagesToCheck; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext("2d");
          await page.render({ canvasContext: ctx, viewport }).promise;
          const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.65));
          const imgFile = new File([blob], `page${p}.jpg`, { type: "image/jpeg" });
          const upload = await base44.integrations.Core.UploadFile({ file: imgFile });
          fileUrls.push(upload.file_url);
        }
      } else {
        const upload = await base44.integrations.Core.UploadFile({ file });
        fileUrls = [upload.file_url];
      }

      const headerList = Object.entries(HEADER_TO_KEY).map(([h, k]) => `${h} → ${k}`).join("\n");
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Primavera P6 and Gantt chart expert. I have a multi-page PDF document (or a single image) containing a construction programme / schedule.

STEP 1: Identify which page(s) contain the PROGRAMME table — look for the table with column headers like Activity ID, Activity Name, Start, Finish, Duration etc. Ignore cover pages, summaries, legends.

STEP 2: From the programme table HEADER ROW, read the column headers from LEFT to RIGHT. Return ONLY the columns that are clearly printed. Do NOT guess or infer.

IMPORTANT: Return columns in the EXACT left-to-right order they appear in the PDF.

Reference — column header text → internal key:
${headerList}

Return an array of internal keys (right side of →) in LEFT-TO-RIGHT order.`,
        response_json_schema: {
          type: "object",
          properties: {
            columns: { type: "array", items: { type: "string" } }
          }
        },
        file_urls: fileUrls,
      });
      // First pass: filter to valid keys
      let detectedKeys = (result?.columns || []).filter(k => COL_KEYS.includes(k));
      // Second pass: fuzzy match any unrecognized values
      const rawColumns = result?.columns || [];
      if (detectedKeys.length === 0 && rawColumns.length > 0) {
        detectedKeys = rawColumns.map(fuzzyMatchColumn).filter(Boolean);
      }
      if (detectedKeys.length === 0) {
        alert("Unable to identify programme columns from the file. Please ensure your PDF/image contains clear Gantt table headers.");
        return;
      }
      const newVisibility = {};
      COL_KEYS.forEach((k, i) => {
        newVisibility[k] = { visible: false, position: i };
      });
      detectedKeys.forEach((k, idx) => {
        newVisibility[k] = { visible: true, position: idx };
      });
      ["type", "rownum"].forEach(k => {
        newVisibility[k] = { ...newVisibility[k], visible: true };
      });
      setColumnVisibility(newVisibility);
    } catch (e) {
      alert("OCR analysis failed: " + e.message);
    } finally {
      setPlfLoading(false);
      setHeaderMenu(null);
    }
  }

  function handleResetLayout() {
    setColumnVisibility(INIT_VISIBILITY);
    setCwInternal(INIT_W);
    setHeaderMenu(null);
  }

  // ── Timeline column resize (drag header to zoom) ──────────────────────────
  const startTimelineResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const mode = resolvedViewModeRef.current;
    const startW = colWidth[mode];
    const min = COL_WIDTH_MIN[mode];
    const max = COL_WIDTH_MAX[mode];
    const onMove = ev => {
      const newW = Math.min(max, Math.max(min, startW + ev.clientX - startX));
      setColWidth(prev => ({ ...prev, [mode]: newW }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidth]);
  // Sort state: lifted to parent if provided, otherwise local
  const [localSortState, setLocalSortState] = useState({ field: null, dir: null });
  const sortState = sortStateProp ?? localSortState;
  const setSortState = setSortStateProp ?? setLocalSortState;

  const handleHeaderSort = useCallback((field) => {
    setSortState(prev => {
      if (prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return { field: null, dir: null }; // reset
    });
  }, []);

  // Sort computedTasks within each programme segment for display only
  const sortedComputedTasks = useMemo(() => {
    if (!sortState.field) return computedTasks;
    const result = [];
    let segStart = -1;
    for (let i = 0; i <= computedTasks.length; i++) {
      const isEndOfSeg = i === computedTasks.length || computedTasks[i].isSection;
      if (isEndOfSeg && segStart >= 0) {
        const seg = computedTasks.slice(segStart, i);
        const sorted = [...seg].sort((a, b) => {
          let va = "", vb = "";
          if (sortState.field === "item") {
            va = (a.customItem ?? a._resolvedItem ?? a.item ?? "").toString();
            vb = (b.customItem ?? b._resolvedItem ?? b.item ?? "").toString();
          } else {
            va = a[sortState.field] || "";
            vb = b[sortState.field] || "";
          }
          const cmp = va.localeCompare(vb, undefined, { numeric: true });
          return sortState.dir === "asc" ? cmp : -cmp;
        });
        result.push(...sorted);
        segStart = -1;
      }
      if (i < computedTasks.length) {
        if (computedTasks[i].isSection) result.push(computedTasks[i]);
        else if (segStart < 0) segStart = i;
      }
    }
    return result;
  }, [computedTasks, sortState]);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, taskIdx }
  const [colorPicker, setColorPicker] = useState(null); // { x, y, task }
  const [sectionColorPicker, setSectionColorPicker] = useState(null); // { x, y, task }
  const dragSrc = useRef(null);
  const draggingLabel = useRef(null);
  const [draggingBar, setDraggingBar] = useState(null);
  const nextId = useRef(tasks.length ? Math.max(...tasks.map(t=>t.id))+1 : 1);

  // Two scroll containers — synced vertically
  const leftBodyRef = useRef(null);
  const rightBodyRef = useRef(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const left = leftBodyRef.current;
    const right = rightBodyRef.current;
    if (!left || !right) return;
    const onLeft = () => { if (syncingRef.current) return; syncingRef.current = true; right.scrollTop = left.scrollTop; syncingRef.current = false; };
    const onRight = () => { if (syncingRef.current) return; syncingRef.current = true; left.scrollTop = right.scrollTop; syncingRef.current = false; };
    left.addEventListener("scroll", onLeft);
    right.addEventListener("scroll", onRight);
    return () => { left.removeEventListener("scroll", onLeft); right.removeEventListener("scroll", onRight); };
  }, []);

  // ── Timeline ──────────────────────────────────────────────────────────────
  const { minDate, maxDate, validT } = useMemo(() => {
    const validT = sortedComputedTasks.filter(t => {
      if (t.isSection) return false;
      // For deletedFromBL tasks, fall back to BL dates for positioning
      const sd = t.start || (t.deletedFromBL ? t.baselineStart : null);
      const ed = t.end || (t.deletedFromBL ? t.baselineFinish : null);
      if (!sd && !ed) return false;
      const s=parseISO(sd||ed), e=parseISO(ed||sd);
      return isValid(s)&&isValid(e)&&e>=s;
    });
    
    if (!validT.length) { const n=new Date(); return { minDate:n, maxDate:addMonths(n,6), validT }; }
    const ss=validT.map(t=>parseISO(t.start||(t.deletedFromBL?t.baselineStart:t.end)||t.end)).filter(isValid);
    const es=validT.map(t=>parseISO(t.end||(t.deletedFromBL?t.baselineFinish:t.start)||t.start)).filter(isValid);
    return { 
      minDate:addDays(new Date(Math.min(...ss)),-7), 
      maxDate:addDays(new Date(Math.max(...es)),14),
      validT
    };
  }, [sortedComputedTasks]);

  // XER-Viewer-style time scale (Auto · Year · Year-Month · Month-Week · Month-Day · Week-Day)
  const resolvedViewMode = useMemo(() => resolveTimeScale(viewMode, minDate, maxDate), [viewMode, minDate, maxDate]);
  const scale = SCALE_OF[resolvedViewMode] || SCALE_OF.month;
  // Column resize needs the *current* scale; a ref avoids referring to
  // resolvedViewMode before it is declared (that would throw during render).
  const resolvedViewModeRef = useRef(resolvedViewMode);
  useEffect(() => { resolvedViewModeRef.current = resolvedViewMode; }, [resolvedViewMode]);

  const cols = useMemo(() => getTimelineColumns(minDate,maxDate,resolvedViewMode), [minDate,maxDate,resolvedViewMode]);
  const cw2 = colWidth[resolvedViewMode];
  const totalW = cols.length * cw2;
  const tlStart = cols[0]?.date || minDate;

  const ppd = useMemo(() => {
    if (!cols.length) return 1;
    const last = cols[cols.length-1].date;
    const end = scale.col === "year" ? addMonths(last,12)
      : scale.col === "month" ? addMonths(last,1)
      : scale.col === "week" ? addDays(last,7)
      : addDays(last,1);
    const days = differenceInDays(end, tlStart);
    return days>0 ? totalW/days : 1;
  }, [cols,scale.col,totalW,tlStart]);

  const todayLeft = useMemo(() => differenceInDays(new Date(), tlStart) * ppd, [tlStart, ppd]);

  // Last Recalc Date (batch 27) — the date the programme is *at*. Drawn as a
  // dashed orange line so it can never be confused with the solid red today line.
  const recalcIso = useMemo(() => normalizeRecalcDate(recalcDate), [recalcDate]);
  const recalcLeft = useMemo(() => {
    if (!recalcIso) return null;
    const parsed = parseISO(recalcIso);
    if (!isValid(parsed)) return null;
    const x = differenceInDays(parsed, tlStart) * ppd;
    return Number.isFinite(x) ? x : null;
  }, [recalcIso, tlStart, ppd]);

  // First header row: group the columns by the scale's top granularity
  const topRow = useMemo(() => {
    const labelOf = (d) =>
      scale.top === "year" ? format(d, "yyyy")
      : scale.top === "month" ? format(d, "MMM yy")
      : format(startOfWeek(d, { weekStartsOn: 1 }), "dd MMM");   // "week" grouping
    const g = [];
    cols.forEach(c => {
      const k = labelOf(c.date);
      if (!g.length || g[g.length-1].label !== k) g.push({ label: k, count: 1 });
      else g[g.length-1].count++;
    });
    return g;
  }, [cols,scale.top]);

  // Vertical grid lines over the timeline: major = top-row group boundary (year in
  // month view, month in week/day view), minor = individual column boundary.
  const timelineGridLines = useMemo(() => {
    if (!grid.timelineMajorVisible && !grid.timelineMinorVisible) return [];
    const out = [];
    let x = 0;
    topRow.forEach(g => {
      if (x > 0 && grid.timelineMajorVisible) out.push({ x, kind: "major" });
      if (grid.timelineMinorVisible) {
        for (let i = 1; i < g.count; i++) out.push({ x: x + i * cw2, kind: "minor" });
      }
      x += g.count * cw2;
    });
    return out;
  }, [topRow, cw2, grid.timelineMajorVisible, grid.timelineMinorVisible]);

  const bpMap = useMemo(() => {
    const m=new Map();
    sortedComputedTasks.forEach(t=>{
      if(t.isSection) return;
      // For deletedFromBL tasks, fall back to BL dates for bar positioning
      const sd = t.start || (t.deletedFromBL ? t.baselineStart : null) || t.end;
      const ed = t.end || (t.deletedFromBL ? t.baselineFinish : null) || t.start;
      if(!sd && !ed) return;
      const s=parseISO(sd), e=parseISO(ed);
      if(isValid(s)&&isValid(e)&&e>=s) m.set(t.id, bpos(s,e,tlStart,ppd));
    });
    return m;
  }, [sortedComputedTasks,tlStart,ppd]);

  // ── Column resize ─────────────────────────────────────────────────────────
  const startCR = useCallback((key, e) => {
    e.preventDefault();
    const sx=e.clientX, sw=cw[key] ?? INIT_W[key] ?? INIT_W_EXTRA[key] ?? 72, mw=key==="activity"?60:18;
    const mv = ev => setCwInternal(p=>({...p,[key]:Math.max(mw,sw+ev.clientX-sx)}));
    const up = () => { window.removeEventListener("mousemove",mv); window.removeEventListener("mouseup",up); };
    window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up);
  }, [cw]);

  // ── Task ops ──────────────────────────────────────────────────────────────
  const upd = useCallback((id,f,v)=>{
    saveToHistory && saveToHistory(tasks);
    setTasks(p=>{
      const updated = p.map(t=>t.id===id?{...t,[f]:v}:t);
      // After updating, propagate link constraint to linked tasks (chain propagation)
      const idx = updated.findIndex(t=>t.id===id);
      if (idx>=0 && !updated[idx].isSection) {
        let changedTask = updated[idx];
        // Propagate through the chain: A1 -> A2 -> A3 -> ...
        while (changedTask && changedTask.link) {
          const linkedTaskIdx = updated.findIndex(t => t.id === changedTask.link);
          if (linkedTaskIdx < 0 || updated[linkedTaskIdx].isSection) break;
          const linked = applyLink(changedTask, updated[linkedTaskIdx], changedTask.linkOffset || 0);
          updated[linkedTaskIdx] = linked;
          changedTask = updated[linkedTaskIdx];
        }
      }
      return updated;
    });
  },[setTasks,tasks,saveToHistory]);
  const del = useCallback((id)=>{ saveToHistory && saveToHistory(tasks); setTasks(p=>p.filter(t=>t.id!==id)); },[setTasks,tasks,saveToHistory]);
  const updFields = useCallback((id, fields) => {
    saveToHistory && saveToHistory(tasks);
    setTasks(p => {
      const updated = p.map(t => t.id === id ? { ...t, ...fields } : t);
      const idx = updated.findIndex(t => t.id === id);
      if (idx >= 0 && !updated[idx].isSection) {
        let changedTask = updated[idx];
        while (changedTask && changedTask.link) {
          const linkedTaskIdx = updated.findIndex(t => t.id === changedTask.link);
          if (linkedTaskIdx < 0 || updated[linkedTaskIdx].isSection) break;
          const linked = applyLink(changedTask, updated[linkedTaskIdx], changedTask.linkOffset || 0);
          updated[linkedTaskIdx] = linked;
          changedTask = updated[linkedTaskIdx];
        }
      }
      return updated;
    });
  }, [setTasks, tasks, saveToHistory]);
  const add = ()=>{ saveToHistory && saveToHistory(tasks); setTasks(p=>[...p,{id:nextId.current++,activity:"",start:"",end:"",barType:"baseline"}]); };
  const addSec = type=>{ saveToHistory && saveToHistory(tasks); setTasks(p=>[...p,{id:nextId.current++,isSection:true,sectionType:type,activity:"New Programme"}]); };

  // Batch 27 — right-clicking a *date cell* opens the same row menu, plus a
  // "use this cell" shortcut so the programme's Last Recalc Date can be set
  // straight from the date column.
  const openCellMenu = useCallback((e, idx, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, taskIdx: idx, dateCell: colKey });
  }, []);

  const handleContextAction = useCallback((action, payload) => {
    if (!contextMenu) return;
    const { taskIdx } = contextMenu;
    const task = tasks[taskIdx];
    if (!task) return;
    saveToHistory && saveToHistory(tasks);
    if (action === "toggleBarType") upd(task.id, "barType", (task.barType||"baseline")==="baseline"?"delay":"baseline");
    else if (action === "fillPrev") fillPrev(task.id);
    else if (action === "toggleStartActual") upd(task.id, "startActual", !task.startActual);
    else if (action === "toggleEndActual") upd(task.id, "endActual", !task.endActual);
    else if (action === "toggleSectionType") upd(task.id, "sectionType", (task.sectionType||"blue")==="blue"?"pink":"blue");
    else if (action === "toggleComparison") upd(task.id, "showComparison", task.showComparison===false);
    // ── Batch 23A: manual WBS level control (clamped to the 7 colour steps) ──
    else if (action === "setSectionLevel") upd(task.id, "sectionLevel", clampWbsLevel(payload));
    else if (action === "indentSection") upd(task.id, "sectionLevel", clampWbsLevel((Number(task.sectionLevel) || 1) + 1));
    else if (action === "outdentSection") upd(task.id, "sectionLevel", clampWbsLevel((Number(task.sectionLevel) || 1) - 1));
    else if (action === "delete") del(task.id);
   
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu, tasks, upd, del, saveToHistory]);

  const handleColorSelect = useCallback((color) => {
    if (!colorPicker) return;
    upd(colorPicker.task.id, "barColor", color);
    setColorPicker(null);
  }, [colorPicker, upd]);

  // ── Bulk edit (multi-select) ──────────────────────────────────────────────
  const selectedNonSectionCount = useMemo(() =>
    sortedComputedTasks.filter(t => selectedIds?.has(t.id)).length,
  [sortedComputedTasks, selectedIds]);

  const handleBulkApply = useCallback((update) => {
    saveToHistory && saveToHistory(tasks);
    
    setTasks(p => {
      const updated = [...p];
      
      if (update.bindChain) {
        // Bind selected tasks into a chain: first → second → third → ...
        const selectedTasks = p.filter(t => !t.isSection && selectedIds?.has(t.id));
        if (selectedTasks.length < 2) return updated;
        
        for (let i = 0; i < selectedTasks.length - 1; i++) {
          const currentTask = selectedTasks[i];
          const nextTask = selectedTasks[i + 1];
          const currentIdx = updated.findIndex(t => t.id === currentTask.id);
          // Calculate offset: nextTask.start - currentTask.end
          const currentEnd = currentTask.end && isValid(parseISO(currentTask.end)) ? parseISO(currentTask.end) : null;
          const nextStart = nextTask.start && isValid(parseISO(nextTask.start)) ? parseISO(nextTask.start) : null;
          const offset = (currentEnd && nextStart) ? differenceInDays(nextStart, currentEnd) : 0;
          
          if (currentIdx >= 0) {
            updated[currentIdx] = {
            ...updated[currentIdx],
            link: nextTask.id,
            linkType: "FS",
            linkOffset: offset,
            };
          }
        }
        // Remove link from the last task
        const lastTask = selectedTasks[selectedTasks.length - 1];
        const lastIdx = updated.findIndex(t => t.id === lastTask.id);
        if (lastIdx >= 0) {
          const { link, linkOffset, ...rest } = updated[lastIdx];
          updated[lastIdx] = rest;
        }
      } else if (update.unlink) {
        // Remove all links from selected tasks
        for (let i = 0; i < updated.length; i++) {
          const t = updated[i];
          if (!t.isSection && selectedIds?.has(t.id) && (t.link || t.linkOffset)) {
            const { link, linkOffset, ...rest } = t;
            updated[i] = rest;
          }
        }
      } else if (update.color) {
        // Apply color to selected tasks
        for (let i = 0; i < updated.length; i++) {
          const t = updated[i];
          if (!t.isSection && selectedIds?.has(t.id)) {
            updated[i] = { ...t, barColor: update.color };
          }
        }
      } else if (update.delete) {
        // Delete selected tasks
        return updated.filter(t => !selectedIds?.has(t.id));
      }
      
      return updated;
    });

    // Handle staircase filter (doesn't modify tasks)
    if (update.setStaircaseFilter) {
      onStaircaseFilterChange && onStaircaseFilterChange(update.setStaircaseFilter);
    } else if (update.clearStaircaseFilter) {
      onStaircaseFilterChange && onStaircaseFilterChange(null);
    }
  }, [setTasks, selectedIds, saveToHistory, onStaircaseFilterChange]);

  const fillPrev = useCallback(id=>{
    saveToHistory && saveToHistory(tasks);
    setTasks(p=>{
      const i=p.findIndex(t=>t.id===id);
      if(i<=0||!p[i-1].end) return p;
      const prevEnd = parseISO(p[i-1].end);
      if(!isValid(prevEnd)) return p;
      const newStart = format(addDays(prevEnd, 1), "yyyy-MM-dd");
      return p.map((t,j)=>{
        if(j!==i) return t;
        if(durLocked && t.start && t.end && isValid(parseISO(t.start)) && isValid(parseISO(t.end))) {
          const diff = differenceInDays(parseISO(t.end), parseISO(t.start));
          return {...t, start: newStart, end: format(addDays(parseISO(newStart), diff), "yyyy-MM-dd")};
        }
        return {...t, start: newStart};
      });
    });
  },[setTasks,tasks,saveToHistory,durLocked]);

  // ── Row drag (supports multi-select) ─────────────────────────────────────
  const drStart = (e, i) => {
    dragSrc.current = i;
    // If the dragged row is part of multi-selection, drag all selected rows together
    const task = tasks[i];
    if (selectedIds && selectedIds.size > 1 && selectedIds.has(task?.id)) {
      e.dataTransfer.effectAllowed = "move";
    }
  };
  const drOver  = (e,i)=>{ e.preventDefault(); setDragOverIdx(i); };
  const drDrop  = i=>{
    const s=dragSrc.current;
    if(s==null||s===i){setDragOverIdx(null);return;}
    saveToHistory && saveToHistory(tasks);
    const draggedTask = tasks[s];
    const isMulti = selectedIds && selectedIds.size > 1 && selectedIds.has(draggedTask?.id);
    setTasks(p=>{
      if (!isMulti) {
        const a=[...p]; const[m]=a.splice(s,1); a.splice(i,0,m); return a;
      }
      // Multi-drag: pull all selected rows out, insert them at drop target
      const selectedSet = selectedIds;
      const selected = p.filter(t => selectedSet.has(t.id));
      const rest = p.filter(t => !selectedSet.has(t.id));
      // Find insertion point in "rest" array
      const dropTask = p[i];
      let insertAt = rest.findIndex(t => t.id === dropTask?.id);
      if (insertAt < 0) insertAt = rest.length;
      // If dropping after the drop target
      const srcBeforeDrop = p.slice(0,i).some(t=>selectedSet.has(t.id));
      if (!srcBeforeDrop) insertAt = Math.max(0, insertAt);
      const result = [...rest];
      result.splice(insertAt, 0, ...selected);
      return result;
    });
    dragSrc.current=null; setDragOverIdx(null);
  };
  const drEnd   = ()=>{ dragSrc.current=null; setDragOverIdx(null); };

  // ── Bar drag ──────────────────────────────────────────────────────────────
  const barDown = useCallback((e,t,type)=>{ if(e.button!==0)return; e.preventDefault(); setDraggingBar({taskId:t.id,type,startX:e.clientX,origStart:t.start,origEnd:t.end||t.start}); },[]);
  const barMove = useCallback(e=>{
    if(!draggingBar) return;
    const dd=Math.round((e.clientX-draggingBar.startX)/ppd);
    const task=tasks.find(t=>t.id===draggingBar.taskId);
    const sl=task?.startActual, el=task?.endActual;
    if(draggingBar.type==="move"&&!sl&&!el){
      setTasks(p=>p.map(t=>t.id===draggingBar.taskId?{...t,start:format(addDays(parseISO(draggingBar.origStart),dd),"yyyy-MM-dd"),end:format(addDays(parseISO(draggingBar.origEnd),dd),"yyyy-MM-dd")}:t));
    } else if(draggingBar.type==="left"&&!sl){
      const ns=format(addDays(parseISO(draggingBar.origStart),dd),"yyyy-MM-dd");
      if(parseISO(ns)<=parseISO(draggingBar.origEnd)) setTasks(p=>p.map(t=>t.id===draggingBar.taskId?{...t,start:ns}:t));
    } else if(draggingBar.type==="right"&&!el){
      const ne=format(addDays(parseISO(draggingBar.origEnd),dd),"yyyy-MM-dd");
      if(parseISO(ne)>=parseISO(draggingBar.origStart)) setTasks(p=>p.map(t=>t.id===draggingBar.taskId?{...t,end:ne}:t));
    }
  },[draggingBar,tasks,ppd,setTasks]);
  const barUp = useCallback(()=>{
    if (draggingBar) {
      // After dragging, propagate link constraint through the chain
      setTasks(p => {
        const task = p.find(t => t.id === draggingBar.taskId);
        if (!task || !task.link) return p;
        
        const updated = [...p];
        let changedTask = task;
        
        // Propagate through the chain: A1 -> A2 -> A3 -> ...
        while (changedTask && changedTask.link) {
          const linkedTaskIdx = updated.findIndex(t => t.id === changedTask.link);
          if (linkedTaskIdx < 0 || updated[linkedTaskIdx].isSection) break;
          const linked = applyLink(changedTask, updated[linkedTaskIdx], changedTask.linkOffset || 0);
          updated[linkedTaskIdx] = linked;
          changedTask = updated[linkedTaskIdx];
        }
        return updated;
      });
    }
    setDraggingBar(null);
  },[draggingBar]);
  useEffect(()=>{
    if(draggingBar){
      window.addEventListener("mousemove",barMove);
      const onUp = () => { barUp(); saveToHistory && saveToHistory(tasks); };
      window.addEventListener("mouseup",onUp);
      return()=>{ window.removeEventListener("mousemove",barMove); window.removeEventListener("mouseup",onUp); };
    }
  },[draggingBar,barMove,barUp,saveToHistory,tasks]);

  // ── Programme structure: collapse / expand sections ───────────────────────
  // The parent (GanttPage) owns the state so the Gantt Settings panel can drive
  // it; a local state is used as a fallback when no handlers are provided.
  const [localCollapsedIds, setLocalCollapsedIds] = useState(() => new Set());
  const collapsedIds = collapsedIdsProp || localCollapsedIds;
  const toggleSection = useCallback((id) => {
    if (onToggleSection) { onToggleSection(id); return; }
    setLocalCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [onToggleSection]);
  const expandAllSections = useCallback(() => {
    if (onExpandAll) { onExpandAll(); return; }
    setLocalCollapsedIds(new Set());
  }, [onExpandAll]);
  const collapseAllSections = useCallback(() => {
    if (onCollapseAll) { onCollapseAll(); return; }
    setLocalCollapsedIds(new Set(sortedComputedTasks.filter(t => t.isSection).map(t => t.id)));
  }, [onCollapseAll, sortedComputedTasks]);
  // Rows actually rendered (children of collapsed sections are hidden)
  const displayTasks = useMemo(() => {
    if (!collapsedIds.size) return sortedComputedTasks;
    const out = [];
    let hidden = false;
    sortedComputedTasks.forEach(t => {
      if (t.isSection) { hidden = collapsedIds.has(t.id); out.push(t); return; }
      if (!hidden) out.push(t);
    });
    return out;
  }, [sortedComputedTasks, collapsedIds]);

  // Esc clears the current selection (parity with XER Viewer's "Clear selection")
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedIds && selectedIds.size > 0 && setSelectedIds) setSelectedIds(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, setSelectedIds]);

  // ── Focus mode: highlight the selected activity chain, dim everything else ─
  const focusCfg = dsp.focus;
  const relMap = useMemo(() => buildRelationshipMap(displayTasks), [displayTasks]);
  const focusIds = useMemo(() => {
    if (!focusCfg.enabled) return null;
    const seeds = [...(selectedIds || [])].map(Number).filter(n => !Number.isNaN(n));
    if (!seeds.length) return null;
    const out = new Set();
    const stack = [...seeds];
    while (stack.length) {
      const id = stack.pop();
      if (out.has(id)) continue;
      out.add(id);
      const e = relMap.get(id);
      if (!e) continue;
      e.predecessors.forEach(p => { if (!out.has(p)) stack.push(p); });
      e.successors.forEach(s => { if (!out.has(s)) stack.push(s); });
    }
    return out;
  }, [focusCfg.enabled, selectedIds, relMap]);
  const rowOpacity = (task) => (focusIds && task && !task.isSection && !focusIds.has(Number(task.id)))
    ? Math.min(1, Math.max(0.1, Number(focusCfg.dim) || 0.35))
    : 1;

  // ── Staircase data ────────────────────────────────────────────────────────
  const staircases = useMemo(()=>{
    const progs=[]; let cur=[], curComp=true;
    displayTasks.forEach((t,idx)=>{
      if(t.isSection){ if(cur.length){progs.push({bars:cur,showComparison:curComp});cur=[];} curComp=t.showComparison!==false; }
      else {
        // If staircaseFilter is active, only include tasks in the filter
        if (staircaseFilter !== null && !staircaseFilter.has(t.id)) return;
        const p=bpMap.get(t.id); if(p) cur.push({idx,pos:p,task:t});
      }
    });
    if(cur.length) progs.push({bars:cur,showComparison:curComp});
    return progs;
  },[displayTasks,bpMap,staircaseFilter]);

  // Left panel total width (cols + grip + resize handle)
  const leftW = 18 + COL_KEYS.reduce((sum, k) => sum + ecw[k], 0) + 5;

  // Header cell style helper
  const thS = key => ({
    width:ecw[key], minWidth:ecw[key], maxWidth:ecw[key], flexShrink:0,
    height:ROW_H, display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:11, fontWeight:600, color:"#fff", background:HD_BG,
    border:HD, position:"relative", userSelect:"none", overflow:"hidden",
  });

  return (
    <div style={{ display:"flex", flex:1, overflow:"hidden", "--gantt-col-border": BD_COL }} onPaste={onPaste}>
      {selectedNonSectionCount >= 1 && (
        <BulkEditBar
          selectedCount={selectedNonSectionCount}
          onApply={handleBulkApply}
          onClear={() => { setSelectedIds && setSelectedIds(new Set()); }}
          bindChainMode={bindChainMode}
          setBindChainMode={setBindChainMode}
          staircaseFilter={staircaseFilter}
          selectedIds={selectedIds}
        />
      )}
      {contextMenu && (
        <RowContextMenu
          x={contextMenu.x} y={contextMenu.y}
          task={tasks[contextMenu.taskIdx]}
          taskIdx={contextMenu.taskIdx}
          dateCell={contextMenu.dateCell || null}
          recalcDate={recalcDate}
          fileRecalcDate={fileRecalcDate}
          onRecalcDateChange={onRecalcDateChange}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
          onColorChange={(task, menuX, menuY) => {
            setContextMenu(null);
            setColorPicker({ x: menuX, y: menuY, task });
          }}
          onSectionColorChange={(task, menuX, menuY) => {
            setContextMenu(null);
            setSectionColorPicker({ x: menuX, y: menuY, task });
          }}
        />
      )}
      {colorPicker && (
        <BarColorPicker
          x={colorPicker.x} y={colorPicker.y}
          currentColor={colorPicker.task.barColor}
          onClose={() => setColorPicker(null)}
          onSelect={handleColorSelect}
        />
      )}
      {sectionColorPicker && (
        <SectionColorPicker
          x={sectionColorPicker.x} y={sectionColorPicker.y}
          currentBg={sectionColorPicker.task.sectionBg}
          onClose={() => setSectionColorPicker(null)}
          onSelect={(bg, text) => {
            saveToHistory && saveToHistory(tasks);
            setTasks(p => p.map(t => t.id === sectionColorPicker.task.id
              ? { ...t, sectionBg: bg || undefined, sectionText: text || undefined }
              : t
            ));
            setSectionColorPicker(null);
          }}
        />
      )}

      {/* Hidden PLF file input */}
      <input ref={plfInputRef} type="file" accept=".plf" style={{ display:"none" }} onChange={handlePLFFile} />



      {/* Header context menu */}
      {headerMenu && (
        <div ref={headerMenuRef} style={{ position:"fixed", left:headerMenu.x, top:headerMenu.y, zIndex:9999, background:"#fff", border:"1px solid #cecece", borderRadius:6, boxShadow:"0 8px 24px rgba(0,0,0,0.13)", minWidth:180, padding:"4px 0" }}>
          <button onClick={handleSaveLayout} style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 14px", fontSize:12, color:"#003531", background:"none", border:"none", cursor:"pointer" }}
            onMouseEnter={e=>e.target.style.background="#f7f7f7"} onMouseLeave={e=>e.target.style.background="none"}>
            💾 Save Layout (.plf)
          </button>
          <button onClick={handleLoadLayout} style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 14px", fontSize:12, color:"#003531", background:"none", border:"none", cursor:"pointer" }}
            onMouseEnter={e=>e.target.style.background="#f7f7f7"} onMouseLeave={e=>e.target.style.background="none"}>
            📂 Load Layout (.plf)
          </button>
          {/* Drag & drop PLF zone */}
          <div style={{ margin:"3px 8px", padding:"10px 8px", border:`2px dashed ${plfDragOver?"#005a53":"#cecece"}`, borderRadius:6, textAlign:"center", cursor:"default", background: plfDragOver?"#f7f7f7":"#f7f7f7", transition:"all 0.15s" }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setPlfDragOver(true); }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setPlfDragOver(false); }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); setPlfDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleDropFile(f); }}>
            <div style={{ fontSize:10, color:plfDragOver?"#005a53":"#6c757d", lineHeight:1.4, pointerEvents:"none" }}>
              {plfLoading ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}><Loader2 size={12} className="animate-spin" /> Analyzing...</span> : plfDragOver ? "📥 Release to load" : "📥 Drop .plf / PDF here"}
            </div>
          </div>
          <div style={{ height:1, background:"#cecece", margin:"3px 0" }} />
          {/* ── Save as Template ─────────────────────────────────────────── */}
          <div style={{ padding:"4px 10px", display:"flex", gap:4 }}>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && saveName.trim()) { saveTemplate(saveName.trim()); setSaveName(""); } }}
              placeholder="Template name…"
              style={{ flex:1, border:"1px solid #cecece", borderRadius:4, padding:"4px 6px", fontSize:11, outline:"none" }}
              onClick={e => e.stopPropagation()}
            />
            <button
              disabled={!saveName.trim()}
              onClick={e => { e.stopPropagation(); if (saveName.trim()) { saveTemplate(saveName.trim()); setSaveName(""); } }}
              style={{ background: saveName.trim() ? "#005a53" : "#cecece", color: saveName.trim() ? "#fff" : "#6c757d", border:"none", borderRadius:4, padding:"4px 10px", fontSize:11, fontWeight:600, cursor: saveName.trim() ? "pointer" : "default", whiteSpace:"nowrap" }}
            >Save</button>
          </div>
          {/* ── Saved templates list ──────────────────────────────────────── */}
          {savedTemplates.length > 0 && (
            <>
              <div style={{ fontSize:10, color:"#6c757d", padding:"2px 14px 4px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Templates</div>
              {savedTemplates.map(t => (
                <div key={t.name} style={{ display:"flex", alignItems:"center", padding:"3px 6px 3px 14px", fontSize:11, cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#f7f7f7"}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>
                  <button
                    onClick={() => loadTemplate(t)}
                    style={{ flex:1, textAlign:"left", background:"none", border:"none", cursor:"pointer", fontSize:11, color:"#003531", padding:0 }}
                    title={`Saved ${new Date(t.savedAt).toLocaleString()}`}>
                    📌 {t.name}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteTemplate(t.name); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#cecece", padding:"2px 4px" }}
                    onMouseEnter={e=>e.currentTarget.style.color="#dc3545"}
                    onMouseLeave={e=>e.currentTarget.style.color="#cecece"}
                    title="Delete template">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </>
          )}
          <div style={{ height:1, background:"#cecece", margin:"3px 0" }} />
          <button onClick={() => { setColumnVisibility(prev => { const n = {}; COL_KEYS.forEach(k => { n[k] = { ...prev[k], visible: true }; }); return n; }); setHeaderMenu(null); }} style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 14px", fontSize:12, color:"#005a53", background:"none", border:"none", cursor:"pointer" }}
            onMouseEnter={e=>e.target.style.background="#f7f7f7"} onMouseLeave={e=>e.target.style.background="none"}>
            👁 Show All Columns
          </button>
          <button onClick={handleResetLayout} style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 14px", fontSize:12, color:"#6c757d", background:"none", border:"none", cursor:"pointer" }}
            onMouseEnter={e=>e.target.style.background="#f7f7f7"} onMouseLeave={e=>e.target.style.background="none"}>
            ↺ Reset Layout
          </button>
          <div style={{ height:1, background:"#cecece", margin:"3px 0" }} />
          <div style={{ fontSize:10, color:"#6c757d", padding:"2px 14px 4px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Quick Toggle</div>
          {[
            { key:"blStart",   label:"📅 BL Start",   color:"#733208" },
            { key:"blEnd",     label:"📅 BL End",     color:"#733208" },
            { key:"remainDur", label:"⏱ Rem.Dur",    color:"#003531" },
            { key:"float",     label:"🔷 Float",      color:"#003531" },
            { key:"pct",       label:"📊 % Comp",     color:"#003531" },
          ].map(item => {
            const isVisible = columnVisibility[item.key]?.visible !== false;
            return (
              <button key={item.key}
                onClick={() => {
                  setColumnVisibility(prev => ({
                    ...prev,
                    [item.key]: { ...prev[item.key], visible: !isVisible },
                  }));
                }}
                style={{ display:"flex", width:"100%", alignItems:"center", gap:6, textAlign:"left", padding:"5px 14px", fontSize:11, color:isVisible?item.color:"#6c757d", background:"none", border:"none", cursor:"pointer" }}
                onMouseEnter={e=>e.target.style.background="#f7f7f7"} onMouseLeave={e=>e.target.style.background="none"}>
                <span style={{ width:12, fontSize:10, textAlign:"center" }}>{isVisible ? "✓" : ""}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          LEFT PANEL — fixed, no horizontal scroll
          ══════════════════════════════════════════════════════════ */}
      <div style={{ width:leftW, minWidth:leftW, flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden", borderRight:"2px solid #6c757d", zIndex:20 }}>

        {/* Left header */}
        <div style={{ flexShrink:0, background:HD_BG }}>
          {/* Spacer row (matches gantt year row) */}
          <div style={{ height:ROW_H }} />
          {/* Column labels */}
          <div style={{ display:"flex", height:ROW_H }} onContextMenu={e=>{ e.preventDefault(); setHeaderMenu({ x:e.clientX, y:e.clientY }); }}>
            <div
              onClick={e=>setHeaderMenu({ x:e.currentTarget.getBoundingClientRect().left, y:e.currentTarget.getBoundingClientRect().bottom })}
              title="Layout options (Ctrl+L)"
              style={{ width:18, minWidth:18, flexShrink:0, height:ROW_H, border:HD, background:HD_BG, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#6c757d", userSelect:"none" }}
            >⋮</div>
            {sortedColKeys.map(colKey => {
              if (ecw[colKey] <= 0) return null;
              const def = COL_DEFS[colKey];
              if (!def) return null;
              const isSortable = colKey === "item" || colKey === "start" || colKey === "end";
              const s = thS(colKey);
              return (
                <div key={colKey}
                  draggable={false}
                  onDragOver={e => { e.preventDefault(); setColDragOver(colKey); }}
                  onDragLeave={() => setColDragOver(null)}
                  onDragEnd={() => setColDragOver(null)}
                  onDoubleClick={colKey === "duration" ? () => setDurMode && setDurMode(m => m === "wd" ? "cal" : "wd") : undefined}
                  onClick={isSortable ? () => handleHeaderSort(colKey) : undefined}
                  title={colKey === "link" ? "Link to predecessor task (FS logic)" : colKey === "remainDur" ? "Remaining Duration" : colKey === "float" ? "Total Float" : colKey === "pct" ? "Schedule % Complete" : colKey === "blStart" ? "Baseline Start" : colKey === "blEnd" ? "Baseline End" : `Drag to reorder${colKey === "duration" ? " · Double-click to toggle WD/Cal" : ""}`}
                  style={{ ...s, cursor: "default", outline: colDragOver === colKey ? "2px dashed #e88219" : undefined, outlineOffset: colDragOver === colKey ? -2 : 0, transition: "outline 0.1s" }}>
                {colKey === "duration" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    {durMode === "wd" ? "Dur.(WD)" : "Dur.(Cal)"}
                    <button onClick={e => { e.stopPropagation(); setDurLocked(v => !v); }} title={durLocked ? "Duration locked — click to unlock" : "Click to lock duration"} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: durLocked ? "#e88219" : "#6c757d", display: "flex", alignItems: "center" }}>
                      {durLocked ? <Lock size={10} /> : <LockOpen size={10} />}
                    </button>
                  </span>
                ) : isSortable ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {def.header}
                    {sortState.field === colKey ? (sortState.dir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ChevronsUpDown size={9} style={{ opacity: 0.4 }} />}
                  </span>
                ) : def.header}
                <RH onMouseDown={e => { e.stopPropagation(); e.preventDefault(); startCR(colKey, e); }} />
              </div>
              );
            })}
            <div onMouseDown={startResize} style={{ width:5, minWidth:5, background:"#cecece", cursor:"col-resize" }} className="hover:bg-primary transition-colors" />
          </div>
        </div>

        {/* Left body — vertical scroll only, hidden scrollbar */}
        <div ref={leftBodyRef} style={{ flex:1, overflowY:"scroll", overflowX:"hidden", scrollbarWidth:"none", position:"relative" }}
          className="[&::-webkit-scrollbar]:hidden"
          onDragOver={tasks.length === 0 ? e => e.preventDefault() : undefined}
          onDrop={tasks.length === 0 ? e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f && onDropImport) onDropImport(f);
            else onOpenImport && onOpenImport();
          } : undefined}
        >
          {/* Empty state drop zone */}
          {tasks.length === 0 && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, color:"#6c757d", pointerEvents:"none", userSelect:"none" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style={{ fontSize:12, fontWeight:600, textAlign:"center", lineHeight:1.5 }}>Drop a file here to import<br/><span style={{ fontSize:11, fontWeight:400, color:"#cecece" }}>PDF 繚 Excel 繚 XER 繚 Image</span></span>
            </div>
          )}
          {displayTasks.map((task, idx) => {
            const isSec = task.isSection;
            const isAlt = idx%2!==0, isSel = selectedIds?.has(task.id);
            const secStyle = isSec ? resolveWbsRowStyle(task, dsp) : null;
            const rowBg = isSec ? secStyle.bg : (isSel?"#fff2ea":isAlt?"#f7f7f7":"#fff");
            const rowDragOver = dragOverIdx===idx;
            const bt=task.barType||"baseline", btColor=bt==="delay"?"#e88219":"#005a53";

            return (
              <div key={task.id}
                data-task-id={task.id}
                draggable
                onDragStart={e=>drStart(e,idx)} onDragOver={e=>drOver(e,idx)} onDrop={()=>drDrop(idx)} onDragEnd={drEnd}
                onClick={e=>{
                  if(isSec){
                    if(e.ctrlKey||e.metaKey){
                      e.preventDefault();
                      setSelectedIds&&setSelectedIds(prev=>{const s=new Set(prev||[]);if(s.has(task.id))s.delete(task.id);else s.add(task.id);return s;});
                    } else {
                      setSelectedIds&&setSelectedIds(new Set([task.id]));
                    }
                    lastClickedIdx.current=idx;
                    return;
                  }
                  if(e.shiftKey&&e.ctrlKey&&lastClickedIdx.current!==null){
                    // Range select: select all tasks between last clicked and current
                    e.preventDefault();
                    const startIdx=Math.min(lastClickedIdx.current,idx);
                    const endIdx=Math.max(lastClickedIdx.current,idx);
                    const newSet=new Set(selectedIds||[]);
                    for(let i=startIdx;i<=endIdx;i++){
                      if(!displayTasks[i].isSection) newSet.add(displayTasks[i].id);
                    }
                    setSelectedIds&&setSelectedIds(newSet);
                  } else if(e.ctrlKey||e.metaKey||bindChainMode){
                    e.preventDefault();
                    setSelectedIds&&setSelectedIds(prev=>{
                      const s=new Set(prev||[]);
                      if(s.has(task.id)) s.delete(task.id);
                      else s.add(task.id);
                      return s;
                    });
                    lastClickedIdx.current=idx;
                  } else {
                    setSelectedIds&&setSelectedIds(new Set([task.id]));
                    lastClickedIdx.current=idx;
                  }
                }}
                onContextMenu={e=>{ e.preventDefault(); setContextMenu({ x:e.clientX, y:e.clientY, taskIdx:idx }); }}
                style={{ display:"flex", height:ROW_H, minHeight:ROW_H, maxHeight:ROW_H, background:rowDragOver?"#fff2ea":rowBg, outline:isSel?"2px solid #005a53":(rowDragOver?"2px solid #ffffff":"none"), opacity: rowOpacity(task), flexShrink:0, borderBottom: isSec ? BD_GROUP : BD_ROW, boxSizing:"border-box", cursor:"default" }}
                className={isSec?"group gantt-row":"group hover:brightness-95 gantt-row"}
              >
                {/* Grip */}
                <div style={{ width:18, minWidth:18, flexShrink:0, height:ROW_H, display:"flex", alignItems:"center", justifyContent:"center", borderRight:BD_COL, cursor:"grab", color:"#6c757d" }}>
                  <GripVertical size={11}/>
                </div>

                {isSec ? (
                  <div style={{ flex:1, height:ROW_H, display:"flex", alignItems:"center", overflow:"hidden", paddingRight:5 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSection(task.id); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title={collapsedIds.has(task.id) ? "Expand this programme" : "Collapse this programme"}
                      style={{ width:18, height:ROW_H, flexShrink:0, border:"none", background:"transparent", cursor:"pointer", color:secStyle.text, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
                    >
                      {collapsedIds.has(task.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <input type="text" value={task.activity} onChange={e=>upd(task.id,"activity",e.target.value)}
                      className="w-full font-bold outline-none bg-transparent px-2"
                      style={{ height:ROW_H, border:"none", color:secStyle.text, fontSize: Math.round((secStyle.fontSize || grp.fontSize)*tableFontScale), fontWeight: secStyle.fontWeight, fontStyle: secStyle.fontStyle, fontFamily: secStyle.fontFamily || undefined, paddingLeft: 4 + wbsIndentPx(task.sectionLevel, grp.indent, dsp.wbs.indentByLevel !== false) }}/>
                    {/* Batch 40 — the same delete button the activity rows carry, at the right
                        edge of the row, so a programme (e.g. a leftover "New Programme") can be
                        removed without going through the right-click menu. */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); del(task.id); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Delete row (Ctrl+Z to undo)"
                      className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger flex-shrink-0"
                      tabIndex={-1}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ) : (
                  <>
                    {sortedColKeys.map(colKey => {
                      if (ecw[colKey] <= 0) return null;
                      const cellW = ecw[colKey];
                      const fs = Math.round((colKey === "activityId" || colKey === "start" || colKey === "end" || colKey === "link" ? 11 : colKey === "duration" ? 9 : 12) * tableFontScale);
                      const fsSmall = Math.round(10 * tableFontScale);
                      switch (colKey) {
                        case "type":
                          return <C key={colKey} w={cellW} p={0}><button onClick={() => upd(task.id, "barType", bt === "baseline" ? "delay" : "baseline")} style={{ width: "100%", height: ROW_H, fontSize: 9, fontWeight: 700, color: "#fff", background: btColor, border: "none", cursor: "pointer" }}>{bt === "baseline" ? "BL" : "DE"}</button></C>;
                        case "rownum":
                          return <C key={colKey} w={cellW}><input type="text" value={task.id_label ?? String(idx + 1)} onChange={e => upd(task.id, "id_label", e.target.value)} className="w-full outline-none bg-transparent text-center focus:bg-surface-subtle" style={{ height: ROW_H, border: "none", color: "#6c757d", fontSize: fs }} /></C>;
                        case "item":
                          return <C key={colKey} w={cellW}><input type="text" value={task.customItem != null ? task.customItem : task._resolvedItem || ""} placeholder={task._resolvedItem || ""} onChange={e => upd(task.id, "customItem", e.target.value === "" ? null : e.target.value)} className="w-full outline-none bg-transparent text-center focus:bg-surface-subtle" style={{ height: ROW_H, border: "none", color: task.customItem ? "#733208" : undefined, fontSize: fs }} /></C>;
                        case "activityId":
                          return <C key={colKey} w={cellW}><input type="text" value={task.activityId || ""} placeholder="e.g. S9-CW0610" onChange={e => upd(task.id, "activityId", e.target.value)} className="w-full outline-none bg-transparent text-center focus:bg-surface-subtle" style={{ height: ROW_H, border: "none", color: "#005a53", fontFamily: "monospace", fontSize: fs }} /></C>;
                        case "activity":
                          return <C key={colKey} w={cellW}><div className="relative w-full h-full flex items-center">{task.isMergeResult && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#733208", borderRadius: 1, flexShrink: 0 }} />}<input type="text" value={task.activity} placeholder="Activity Name" onChange={e => upd(task.id, "activity", e.target.value)} className="w-full outline-none bg-transparent focus:bg-surface-subtle" style={{ height: ROW_H, border: "none", paddingLeft: task.isMergeResult ? 8 : 4, color: task.isMergeResult ? "#733208" : undefined, fontStyle: task.isMergeResult ? "italic" : undefined, fontSize: fs }} /></div></C>;
                        case "start": {
                           const _blVisS = columnVisibility?.blStart?.visible !== false || columnVisibility?.blEnd?.visible !== false;
                           const _lateVisS = columnVisibility?.lateStart?.visible !== false || columnVisibility?.lateEnd?.visible !== false;
                           const _earlyVisS = columnVisibility?.earlyStart?.visible !== false || columnVisibility?.earlyEnd?.visible !== false;
                           const _useLateCompS = !_blVisS && _lateVisS;
                           const _useEarlyCompS = !_blVisS && !_lateVisS && _earlyVisS;
                           const _compStartS = _useLateCompS ? (task.lateStart || task.start) : _useEarlyCompS ? (task.earlyStart || task.start) : task.baselineStart;
                           const _diffStartS = _compStartS && _compStartS !== task.start;
                           const _compLabelS = _useLateCompS ? `Late: ${_compStartS}` : _useEarlyCompS ? `Early: ${_compStartS}` : `BL: ${_compStartS}`;
                           return <C key={colKey} w={cellW} onContextMenu={(e) => openCellMenu(e, idx, colKey)} style={{ overflow: "hidden", maxWidth: cellW, background: _diffStartS ? "#fff2ea" : undefined }}>
                             <div style={{ display: "flex", alignItems: "center", height: ROW_H, overflow: "hidden", width: "100%" }} title={_diffStartS ? _compLabelS : undefined}>
                              <input type="date" value={task.start} onChange={e => { if (task.startActual) return; const newStart = e.target.value; if (durLocked && task.start && task.end && newStart && isValid(parseISO(newStart))) { const diff = differenceInDays(parseISO(task.end), parseISO(task.start)); updFields(task.id, { start: newStart, end: format(addDays(parseISO(newStart), diff), "yyyy-MM-dd") }); } else { upd(task.id, "start", newStart); } }} onKeyDown={e => { if (!task.startActual && (e.key === "=" || e.key === "`")) { e.preventDefault(); fillPrev(task.id); } }} readOnly={task.startActual} title={!task.start && task.end ? "No Start → Finish Milestone (TT_FinMile) in P6" : undefined} className="outline-none bg-transparent px-1 focus:bg-surface-subtle" style={{ height: ROW_H, border: "none", width: 0, flex: "1 1 0", minWidth: 0, maxWidth: "100%", color: task.startActual ? "#dc3545" : (!task.start && task.end ? "#733208" : undefined), fontWeight: task.startActual ? 700 : (!task.start && task.end ? 600 : undefined), cursor: task.startActual ? "not-allowed" : undefined, fontSize: fs }} />
                              <button onClick={() => upd(task.id, "startActual", !task.startActual)} tabIndex={-1} className="flex-shrink-0 px-0.5" style={{ color: task.startActual ? "#dc3545" : "#cecece", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>A</button>
                              {idx > 0 && tasks[idx - 1]?.end && <button onClick={() => fillPrev(task.id)} className="opacity-0 group-hover:opacity-100 text-primary hover:text-primary pr-1 flex-shrink-0" tabIndex={-1}><Link2 size={10} /></button>}
                              </div></C>;
                              }
                        case "end": {
                           const _blVisE = columnVisibility?.blStart?.visible !== false || columnVisibility?.blEnd?.visible !== false;
                           const _lateVisE = columnVisibility?.lateStart?.visible !== false || columnVisibility?.lateEnd?.visible !== false;
                           const _earlyVisE = columnVisibility?.earlyStart?.visible !== false || columnVisibility?.earlyEnd?.visible !== false;
                           const _useLateCompE = !_blVisE && _lateVisE;
                           const _useEarlyCompE = !_blVisE && !_lateVisE && _earlyVisE;
                           const _compEndE = _useLateCompE ? (task.lateEnd || task.end) : _useEarlyCompE ? (task.earlyEnd || task.end) : task.baselineFinish;
                           const _diffEndE = _compEndE && _compEndE !== task.end;
                           const _compLabelE = _useLateCompE ? `Late: ${_compEndE}` : _useEarlyCompE ? `Early: ${_compEndE}` : `BL: ${_compEndE}`;
                           return <C key={colKey} w={cellW} onContextMenu={(e) => openCellMenu(e, idx, colKey)} style={{ overflow: "hidden", maxWidth: cellW, background: _diffEndE ? "#fff2ea" : undefined }}>
                             <div style={{ display: "flex", alignItems: "center", height: ROW_H, overflow: "hidden", width: "100%" }} title={_diffEndE ? _compLabelE : undefined}>
                              <input type="date" value={task.end} onChange={e => { if (task.endActual) return; const newEnd = e.target.value; if (durLocked && task.start && task.end && newEnd && isValid(parseISO(newEnd))) { const diff = differenceInDays(parseISO(task.end), parseISO(task.start)); updFields(task.id, { start: format(addDays(parseISO(newEnd), -diff), "yyyy-MM-dd"), end: newEnd }); } else { upd(task.id, "end", newEnd); } }} readOnly={task.endActual} title={task.start && !task.end ? "No End → Start Milestone (TT_Mile) in P6" : undefined} className="outline-none bg-transparent px-1 focus:bg-surface-subtle" style={{ height: ROW_H, border: "none", width: 0, flex: "1 1 0", minWidth: 0, maxWidth: "100%", color: task.endActual ? "#dc3545" : (task.start && !task.end ? "#733208" : undefined), fontWeight: task.endActual ? 700 : (task.start && !task.end ? 600 : undefined), cursor: task.endActual ? "not-allowed" : undefined, fontSize: fs }} />
                              <button onClick={() => upd(task.id, "endActual", !task.endActual)} tabIndex={-1} className="flex-shrink-0 px-0.5" style={{ color: task.endActual ? "#dc3545" : "#cecece", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>A</button>
                              </div></C>;
                              }
                        case "link":
                          return <C key={colKey} w={cellW} p={0}><button onClick={(e) => { e.stopPropagation(); if (e.shiftKey && e.ctrlKey && lastClickedIdx.current !== null) { e.preventDefault(); const si = Math.min(lastClickedIdx.current, idx); const ei = Math.max(lastClickedIdx.current, idx); const ns = new Set(selectedIds || []); for (let i = si; i <= ei; i++) { if (!displayTasks[i]?.isSection) ns.add(displayTasks[i]?.id); } setSelectedIds && setSelectedIds(ns); } else if (e.ctrlKey || e.metaKey || bindChainMode) { e.preventDefault(); setSelectedIds && setSelectedIds(prev => { const s = new Set(prev || []); if (s.has(task.id)) s.delete(task.id); else s.add(task.id); return s; }); lastClickedIdx.current = idx; } else { setSelectedIds(new Set([task.id])); lastClickedIdx.current = idx; } }} style={{ width: "100%", height: ROW_H, fontSize: 9, fontWeight: 700, border: "none", cursor: "pointer", background: task.link ? "#005a53" : "transparent", color: task.link ? "#fff" : "#6c757d", outline: "none", textAlign: "center" }} title={(() => { if (task.links?.length > 0) return task.links.map(l => `${l.type||"FS"} → #${l.succId}`).join(", "); if (task.link) return `Binds to task #${task.link} (fixed offset: ${task.linkOffset || 0} days)`; return "Click to select a task to link to"; })()}>{(() => { const lc = (task.links?.length||0) + (task.link ? 1 : 0); if (lc === 0) return "–"; if (task.links?.length > 0) return `${task.links.length}🔗`; return `→#${task.link}`; })()}</button></C>;
                        case "remainDur":
                          return <C key={colKey} w={cellW}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: "#003531" }}>{task.remainDur != null ? task.remainDur : "–"}</span></C>;
                        case "float":
                          return <C key={colKey} w={cellW}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: task.float != null && Number(task.float) < 0 ? "#dc3545" : "#003531" }}>{task.float != null ? task.float : "–"}</span></C>;
                        case "pct":
                          return <C key={colKey} w={cellW}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: "#003531" }}>{task.pct != null ? `${task.pct}%` : "–"}</span></C>;
                        case "blStart":
                          return <C key={colKey} w={cellW} onContextMenu={(e) => openCellMenu(e, idx, colKey)}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: "#733208" }}>{formatDisplayDate(task.baselineStart, dateFormat) || "–"}</span></C>;
                        case "blEnd":
                          return <C key={colKey} w={cellW} onContextMenu={(e) => openCellMenu(e, idx, "blEnd")}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: "#733208" }}>{formatDisplayDate(task.baselineFinish, dateFormat) || "–"}</span></C>;
                        case "duration":
                          return <C key={colKey} w={cellW}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: ROW_H, overflow: "hidden", paddingLeft: 4, paddingRight: 2 }}><div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, justifyContent: "center" }}>{durMode === "wd" ? (<><input type="number" min="0" value={(!task.start || !task.end) ? "0" : calcWD(task.start, task.end) || ""} onChange={e => { const wd = parseInt(e.target.value, 10); if (wd > 0 && task.start && task.end && !task.endActual) { upd(task.id, "end", addWorkingDays(task.start, wd)); } }} disabled={!task.start && !task.end} className="font-bold font-mono text-center outline-none bg-transparent focus:bg-surface-subtle rounded" style={{ fontSize: 9, color: bt === "delay" ? "#005a53" : "#005a53", width: 28, height: 14, border: "none", padding: 0 }} /><span className="font-bold font-mono" style={{ fontSize: 9, color: bt === "delay" ? "#005a53" : "#005a53" }}>WD</span></>) : (<><input type="number" min="0" value={(!task.start || !task.end) ? "0" : calcCal(task.start, task.end) || ""} onChange={e => { const c = parseInt(e.target.value, 10); if (c > 0 && task.start && task.end && !task.endActual) { upd(task.id, "end", format(addDays(parseISO(task.start), c - 1), "yyyy-MM-dd")); } }} disabled={!task.start && !task.end} className="font-bold font-mono text-center outline-none bg-transparent focus:bg-surface-subtle rounded" style={{ fontSize: 9, color: bt === "delay" ? "#005a53" : "#005a53", width: 28, height: 14, border: "none", padding: 0 }} /><span className="font-bold font-mono" style={{ fontSize: 9, color: bt === "delay" ? "#005a53" : "#005a53" }}>Cal</span></>)}</div><button type="button" onClick={() => del(task.id)} title="Delete row (Ctrl+Z to undo)" className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger flex-shrink-0" tabIndex={-1}><Trash2 size={10} /></button></div></C>;
                        // ── Additional P6 fields (readonly display) ────────────────────
                        case "earlyStart": case "earlyEnd": case "lateStart": case "lateEnd":
                        case "expectedFinish": case "constraintDate": case "constraintDate2":
                        case "suspendDate": case "resumeDate": case "reviewFinish":
                        case "externalEarlyStart": case "externalLateFinish":
                        case "remEarlyStart": case "remEarlyFinish": case "remLateStart": case "remLateFinish":
                          return <C key={colKey} w={cellW} onContextMenu={(e) => openCellMenu(e, idx, colKey)}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: "#003531" }}>{formatDisplayDate(task[colKey], dateFormat) || "–"}</span></C>;
                        case "freeFloat": case "targetDuration":
                          return <C key={colKey} w={cellW}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: task[colKey] != null && Number(task[colKey]) < 0 ? "#dc3545" : "#003531" }}>{task[colKey] != null ? task[colKey] : "–"}</span></C>;
                        case "primaryResource": case "durationType": case "completePctType":
                        case "statusCode": case "constraintType": case "constraintType2":
                        case "priorityType": case "locationId": case "reviewStatus": case "p6Guid": case "p6TaskId": case "calendar":
                          return (
                            <C key={colKey} w={cellW} style={{ overflow: "hidden" }}>
                              <span className="w-full text-center px-1" title={task[colKey]}
                                style={{ fontSize: fitFontSizeToWidth(task[colKey] || "", cellW - 8, fsSmall, "", 6.5), color: "#003531" }}>
                                {task[colKey] || "–"}
                              </span>
                            </C>
                          );
                        case "drivingPathFlag": case "lockPlanFlag": case "autoComputeActFlag":
                          return <C key={colKey} w={cellW}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: task[colKey] === "Y" ? "#005a53" : "#6c757d" }}>{task[colKey] || "–"}</span></C>;
                        case "estWt": case "floatPath": case "floatPathOrder":
                        case "actLaborUnits": case "actNonlaborUnits": case "remLaborUnits":
                        case "remNonlaborUnits": case "planLaborUnits": case "planNonlaborUnits":
                          return <C key={colKey} w={cellW}><span className="w-full text-center font-mono" style={{ fontSize: fsSmall, color: "#003531" }}>{task[colKey] != null ? task[colKey] : "–"}</span></C>;
                        default: return null;
                      }
                    })}
                    <div style={{ width:5, minWidth:5, flexShrink:0, cursor:"col-resize", background:"#cecece" }} onMouseDown={startResize} className="hover:bg-primary transition-colors" />
                  </>
                )}
              </div>
            );
          })}

          {/* Add buttons */}
          <div style={{ display:"flex", borderTop:"1px solid #cecece", padding:"6px 8px", gap:6, background:"#fff", flexShrink:0 }}>
            <button onClick={add} className="flex items-center justify-center gap-1 text-xs text-primary border border-dashed border-primary rounded hover:bg-surface-subtle py-1 px-3"><Plus size={12}/>Add Task</button>
            <button onClick={()=>addSec("blue")} className="flex items-center justify-center gap-1 text-xs text-primary border border-dashed border-primary rounded hover:bg-surface-subtle py-1 px-3"><Plus size={12}/>Blue Prog.</button>
            <button onClick={()=>addSec("pink")} className="flex items-center justify-center gap-1 text-xs text-accent-selected border border-dashed border-primary rounded hover:bg-table-header py-1 px-3"><Plus size={12}/>Pink Prog.</button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL — Gantt, horizontal + vertical scroll
          ══════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Right header — horizontal scroll synced with body */}
        <GanttHeaderSync rightBodyRef={rightBodyRef} totalW={totalW}>
          {/* Year row */}
          <div style={{ display:"flex", height:ROW_H }}>
            {topRow.map((g,i)=>(
              <div key={i} style={{ width:g.count*cw2, minWidth:g.count*cw2, flexShrink:0, height:ROW_H, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, border:HD, background:"#003531", overflow:"hidden", color:"#fff" }}>{g.label}</div>
            ))}
          </div>
          {/* Month/week row — drag last cell edge to resize column width */}
          <div style={{ display:"flex", height:ROW_H }}>
            {cols.map((col,i)=>{
              const isNarrow = cw2 < 28;
              return (
                <div key={i} style={{ width:cw2, minWidth:cw2, flexShrink:0, height:ROW_H, display:"flex", alignItems:"center", justifyContent:"center", fontSize:isNarrow?8:11, border:HD, overflow:"hidden", color:"#fff", position:"relative", userSelect:"none" }}>
                  {isNarrow ? (
                    <span style={{ display:"flex", flexDirection:"column", alignItems:"center", lineHeight:1, fontSize:8 }}>
                      {col.label.split("").map((ch,ci)=><span key={ci}>{ch}</span>)}
                    </span>
                  ) : col.label}
                  {/* Drag handle — drag to zoom, double-click to reset */}
                  <div
                    onMouseDown={startTimelineResize}
                    onDoubleClick={() => setColWidth(prev => ({ ...prev, [resolvedViewMode]: COL_WIDTH_DEFAULT[resolvedViewMode] }))}
                    style={{ position:"absolute", right:0, top:0, bottom:0, width:6, cursor:"col-resize", zIndex:3 }}
                    title="Drag to zoom · Double-click to reset"
                  />
                </div>
              );
            })}
          </div>
        </GanttHeaderSync>

        {/* Right body — both H and V scroll */}
        <div ref={rightBodyRef} style={{ flex:1, overflow:"auto", position:"relative" }}>
          <div style={{ minWidth:totalW, position:"relative" }}>

            {/* Vertical grid lines (major = year/month boundary, minor = column) */}
            {timelineGridLines.length > 0 && (
              <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1 }}>
                {timelineGridLines.map((ln, i) => {
                  const isMajor = ln.kind === "major";
                  return (
                    <div key={i} style={{
                      position:"absolute", top:0, bottom:0, left:ln.x, width:0,
                      borderLeft: `${isMajor ? grid.timelineMajorWeight : grid.timelineMinorWeight}px ${isMajor ? grid.timelineMajorStyle : grid.timelineMinorStyle} ${isMajor ? grid.timelineMajorColor : grid.timelineMinorColor}`,
                    }} />
                  );
                })}
              </div>
            )}

            {/* Gantt rows */}
            {displayTasks.map((task, idx) => {
              const isSec = task.isSection;
              const isAlt = idx%2!==0;
              const isSel = selectedIds?.has(task.id);
              const secStyle = isSec ? resolveWbsRowStyle(task, dsp) : null;
              const rowBg = isSec ? secStyle.bg : (isSel?"#fff2ea":isAlt?"rgba(249,250,251,0.5)":"#fff");
              const bt=task.barType||"baseline", btColor=bt==="delay"?bar.delayColor:bar.baselineColor;
              const isDeleted = !!task.deletedFromBL;
              const pos = bpMap.get(task.id);
              const isDelay=bt==="delay", dur=isDelay&&task.start&&task.end?countWorkingDays(task.start,task.end):0;
              const sl=task.startActual, el=task.endActual, fl=sl&&el;

              return (
                <div key={task.id}
                  data-task-id={task.id}
                  onContextMenu={e=>{ e.preventDefault(); setContextMenu({ x:e.clientX, y:e.clientY, taskIdx:idx }); }}
                  style={{ height:ROW_H, minHeight:ROW_H, maxHeight:ROW_H, background:rowBg, position:"relative", opacity: rowOpacity(task), borderBottom: isSec ? BD_GROUP : BD_ROW, overflow:"visible", flexShrink:0, display:"flex", alignItems:"center" }}>
                  {isSec && dsp.wbs.groupHeadersOnGantt !== false && (
                    <span style={{ fontSize: Math.max(9, (secStyle.fontSize || grp.fontSize) - 1), fontWeight: secStyle.fontWeight, fontStyle: secStyle.fontStyle, fontFamily: secStyle.fontFamily || undefined, color: secStyle.text, whiteSpace:"nowrap", paddingTop:0, paddingBottom:0, paddingRight:8, paddingLeft: 8 + wbsIndentPx(task.sectionLevel, 0, dsp.wbs.indentByLevel !== false), pointerEvents:"none" }}>
                      {collapsedIds.has(task.id) ? "▸ " : ""}{task.activity}
                    </span>
                  )}
                  {!isSec && (() => {
                    // Milestone detection: only start XOR only end
                    const isStartMile = !!task.start && !task.end;
                    const isFinishMile = !task.start && !!task.end;
                    const isMilestone = isStartMile || isFinishMile;
                    const mileDate = isStartMile ? task.start : task.end;
                    const mileParsed = mileDate ? parseISO(mileDate) : null;
                    const mileX = mileParsed && isValid(mileParsed) ? differenceInDays(mileParsed, tlStart) * ppd : null;
                    // Critical activity (Total Float <= 0) — optional highlight bar
                    const isCriticalBar = bar.critical.enabled && !isDeleted && task.float != null && Number(task.float) <= 0;
                    const mileColor = isCriticalBar ? bar.critical.color : (task.barColor || btColor);
                    const DS = bar.milestoneSize; // milestone half-size
                    const mileStroke = isCriticalBar ? bar.critical.borderColor : "#fff";
                    const mileStrokeW = isCriticalBar ? bar.critical.borderWidth : 1.5;

                    // Check if Late or Early dates should be used as comparison (when BL is hidden)
                    const blVisible = columnVisibility?.blStart?.visible !== false || columnVisibility?.blEnd?.visible !== false;
                    const lateVisible = columnVisibility?.lateStart?.visible !== false || columnVisibility?.lateEnd?.visible !== false;
                    const earlyVisible = columnVisibility?.earlyStart?.visible !== false || columnVisibility?.earlyEnd?.visible !== false;
                    const useLateAsComparison = !blVisible && lateVisible;
                    const useEarlyAsComparison = !blVisible && !lateVisible && earlyVisible;
                    const useCompAsComparison = useLateAsComparison || useEarlyAsComparison;

                    if (isMilestone && mileX !== null) {
                      // BL milestone: hollow purple diamond if BL date differs from current
                      const blMileDate = isStartMile ? task.baselineStart : task.baselineFinish;
                      const hasBLMile = !useCompAsComparison && blMileDate && blMileDate !== mileDate;
                      const blMileParsed = hasBLMile ? parseISO(blMileDate) : null;
                      const blMileX = blMileParsed && isValid(blMileParsed) ? differenceInDays(blMileParsed, tlStart) * ppd : null;

                      // Late/Early milestone: hollow purple diamond (when BL hidden, Late or Early visible)
                      const compMileDate = useLateAsComparison ? (isStartMile ? task.lateStart : task.lateEnd) : useEarlyAsComparison ? (isStartMile ? task.earlyStart : task.earlyEnd) : null;
                      const hasCompMile = useCompAsComparison && compMileDate && compMileDate !== mileDate;
                      const compMileParsed = hasCompMile ? parseISO(compMileDate) : null;
                      const compMileX = compMileParsed && isValid(compMileParsed) ? differenceInDays(compMileParsed, tlStart) * ppd : null;
                      const compMileLabel = useLateAsComparison ? `Late` : useEarlyAsComparison ? `Early` : `BL`;

                      return (
                        <>
                          {/* BL milestone — hollow purple diamond (when BL visible) */}
                          {hasBLMile && blMileX !== null && (
                            <div style={{ position:"absolute", left:blMileX - DS, top:"50%", transform:"translateY(-50%)", width:DS*2, height:DS*2, zIndex:5, pointerEvents:"none" }}
                              title={`BL ${isStartMile ? "Start" : "Finish"} Milestone: ${blMileDate}`}>
                              <MileShape size={DS} shape={bar.milestoneShape} fill="none" stroke="#733208" strokeWidth={2} />
                            </div>
                          )}
                          {/* Late/Early milestone — hollow purple diamond (when BL hidden, Late or Early visible) */}
                          {hasCompMile && compMileX !== null && (
                            <div style={{ position:"absolute", left:compMileX - DS, top:"50%", transform:"translateY(-50%)", width:DS*2, height:DS*2, zIndex:5, pointerEvents:"none" }}
                              title={`${compMileLabel} ${isStartMile ? "Start" : "Finish"} Milestone: ${compMileDate}`}>
                              <MileShape size={DS} shape={bar.milestoneShape} fill="none" stroke="#733208" strokeWidth={2} />
                            </div>
                          )}
                          {/* Current milestone — solid diamond */}
                          <div style={{ position:"absolute", left:mileX - DS, top:"50%", transform:"translateY(-50%)", width:DS*2, height:DS*2, zIndex:6, cursor:"pointer" }}
                            title={isStartMile ? "Start Milestone (TT_Mile)" : "Finish Milestone (TT_FinMile)"}
                            onMouseDown={e=>barDown(e,task,"move")}>
                            <MileShape size={DS} shape={bar.milestoneShape} fill={mileColor} stroke={mileStroke} strokeWidth={mileStrokeW} />
                          </div>
                        </>
                      );
                    }

                    if (!pos) return null;

                    // Check if BL dates differ from current dates
                    // For deletedFromBL tasks, render a full red bar (not split)
                    const hasBL = !isDeleted && !useCompAsComparison && (task.baselineStart && task.baselineFinish) &&
                      (task.baselineStart !== task.start || task.baselineFinish !== task.end);
                    const blPos = hasBL ? (() => {
                      const bs = parseISO(task.baselineStart), be = parseISO(task.baselineFinish);
                      if (!isValid(bs) || !isValid(be)) return null;
                      return bpos(bs, be, tlStart, ppd);
                    })() : null;

                    // Check if Late dates differ from current dates (when BL is hidden)
                    const hasLate = useLateAsComparison && !isDeleted && (task.lateStart || task.lateEnd) &&
                      (task.lateStart !== task.start || task.lateEnd !== task.end);
                    const latePos = hasLate ? (() => {
                      // Use lateStart/lateEnd if available, otherwise fall back to start/end for positioning
                      const ls = task.lateStart && isValid(parseISO(task.lateStart)) ? parseISO(task.lateStart) : (task.start && isValid(parseISO(task.start)) ? parseISO(task.start) : null);
                      const le = task.lateEnd && isValid(parseISO(task.lateEnd)) ? parseISO(task.lateEnd) : (task.end && isValid(parseISO(task.end)) ? parseISO(task.end) : null);
                      if (!ls || !le) return null;
                      return bpos(ls, le, tlStart, ppd);
                    })() : null;

                    // Check if Early dates differ from current dates (when BL and Late are hidden)
                    const hasEarly = useEarlyAsComparison && !isDeleted && (task.earlyStart || task.earlyEnd) &&
                      (task.earlyStart !== task.start || task.earlyEnd !== task.end);
                    const earlyPos = hasEarly ? (() => {
                      const es = task.earlyStart && isValid(parseISO(task.earlyStart)) ? parseISO(task.earlyStart) : (task.start && isValid(parseISO(task.start)) ? parseISO(task.start) : null);
                      const ee = task.earlyEnd && isValid(parseISO(task.earlyEnd)) ? parseISO(task.earlyEnd) : (task.end && isValid(parseISO(task.end)) ? parseISO(task.end) : null);
                      if (!es || !ee) return null;
                      return bpos(es, ee, tlStart, ppd);
                    })() : null;

                    const hasComp = hasBL || hasLate || hasEarly;
                    const compTooltip = hasLate ? `Late: ${task.lateStart} → ${task.lateEnd}` : hasEarly ? `Early: ${task.earlyStart} → ${task.earlyEnd}` : undefined;

                    // Bar geometry / appearance from the Gantt Settings panel
                    const barH = Math.max(4, Math.min(ROW_H - 2, bar.heightPx));
                    const HALF = Math.round(barH / 2);
                    const barColor = isDeleted ? "#dc3545" : (isCriticalBar ? bar.critical.color : (task.barColor || btColor));
                    const barBorder = bar.borderWidth > 0 ? `${bar.borderWidth}px ${bar.borderStyle} ${isCriticalBar ? bar.critical.borderColor : bar.borderColor}` : "none";
                    const barShadow = bar.shadow ? `0 ${bar.shadowOffsetY}px ${bar.shadowBlur}px ${bar.shadowColor}` : "none";
                    const barRadius = hasComp ? `0 0 ${bar.cornerRadius}px ${bar.cornerRadius}px` : `${bar.cornerRadius}px`;
                    const cmpRadius = `${bar.cornerRadius}px ${bar.cornerRadius}px 0 0`;
                    // Batch 28: text = Labels-tab field + every enabled Bar Info
                    // part (name / start / finish), de-duplicated — one helper,
                    // shared with the PDF so both show the same thing.
                    // Batch 32: with BOTH date switches on, the two dates are split
                    // apart — start date in front of the bar, finish date behind it.
                    const parts = buildBarTextParts(task, bar, dateFormat);
                    const labelText = parts.main;
                    // Batch 29: where it sits and how it looks.
                    // Batch 30: "fit" is *measured* (not the fixed minimum width),
                    // so a caption is never rendered as "A1 · Excava…" — if the whole
                    // text does not fit inside the bar it is drawn outside instead.
                    const labelPos = normalizeBarTextPosition(bar.label.position);
                    const labelFontFamily = barTextFontFamilyCss(bar.label.fontFamily);
                    const minLabelW = bar.label.minWidth ?? 50;
                    const labelWidth = measureTextWidth(labelText, bar.label.fontSize, labelFontFamily || "");
                    const insideRoom = pos.width - 6;
                    const showInsideLabel = labelPos === "inside" && !hasComp
                      && insideRoom >= Math.max(minLabelW, labelWidth);
                    // front | inside | back for the main caption (the dates keep their
                    // own slots in split mode)
                    const mainSide = !labelText ? null
                      : showInsideLabel ? "inside"
                      : labelPos === "before" ? "front" : "back";
                    const frontText = [mainSide === "front" ? labelText : "", parts.front].filter(Boolean);
                    const backText = [parts.back, mainSide === "back" ? labelText : ""].filter(Boolean);
                    // One flex row per side, flush against the bar edge, so nothing
                    // can overlap however long the pieces are.
                    const captionBox = (side) => ({
                      position: "absolute", top: "50%", zIndex: 5, pointerEvents: "none",
                      display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                      fontSize: bar.label.fontSize, fontFamily: labelFontFamily,
                      color: bar.label.colorOutside,
                      ...(side === "front"
                        ? { left: pos.left - 4, transform: "translate(-100%, -50%)" }
                        : { left: pos.left + pos.width + 4, transform: "translateY(-50%)" }),
                    });

                    return (
                    <>
                      {/* BL bar — top half, only when BL differs and BL is visible */}
                      {blPos && (
                        <div style={{ position:"absolute", left:blPos.left, width:blPos.width, height:HALF, top: Math.floor((ROW_H - HALF*2) / 2), background:"#733208", borderRadius:cmpRadius, opacity:0.85, zIndex:3, overflow:"hidden" }}
                          title={`BL: ${task.baselineStart} → ${task.baselineFinish}`}>
                        </div>
                      )}
                      {/* Late bar — top half, when BL is hidden and Late differs */}
                      {latePos && (
                        <div style={{ position:"absolute", left:latePos.left, width:latePos.width, height:HALF, top: Math.floor((ROW_H - HALF*2) / 2), background:"#733208", borderRadius:cmpRadius, opacity:0.85, zIndex:3, overflow:"hidden" }}
                          title={`Late: ${task.lateStart} → ${task.lateEnd}`}>
                        </div>
                      )}
                      {/* Early bar — top half, when BL and Late are hidden and Early differs */}
                      {earlyPos && (
                        <div style={{ position:"absolute", left:earlyPos.left, width:earlyPos.width, height:HALF, top: Math.floor((ROW_H - HALF*2) / 2), background:"#733208", borderRadius:cmpRadius, opacity:0.85, zIndex:3, overflow:"hidden" }}
                          title={`Early: ${task.earlyStart} → ${task.earlyEnd}`}>
                        </div>
                      )}
                      {/* Current bar — bottom half when comparison exists, else full */}
                      {!sl&&<div style={{ position:"absolute", left:pos.left, width:6, height:hasComp?HALF:barH, top:hasComp ? Math.floor((ROW_H - HALF*2)/2)+HALF : "50%", transform:hasComp?"none":"translateY(-50%)", background:"rgba(0,0,0,0.3)", cursor:"ew-resize", zIndex:5, borderRadius:2, opacity:0 }} className="hover:opacity-100 transition-opacity" onMouseDown={e=>barDown(e,task,"left")} />}
                      <div style={{ position:"absolute", left:pos.left, width:pos.width, height:hasComp?HALF:barH, top:hasComp ? Math.floor((ROW_H - HALF*2)/2)+HALF : "50%", transform:hasComp?"none":"translateY(-50%)", background:barColor, cursor:fl?"not-allowed":"move", opacity:draggingBar?.taskId===task.id?0.7:1, borderRadius:barRadius, border:barBorder, boxShadow:barShadow, boxSizing:"border-box", display:"flex", alignItems:"center", paddingLeft:4, overflow:"hidden", zIndex:4 }}
                        title={isDeleted ? "Deleted — this activity does not exist in the comparison programme" : (isCriticalBar ? "Critical (Total Float <= 0)" : compTooltip)}
                        onMouseDown={e=>!fl&&barDown(e,task,"move")}>
                        {showInsideLabel && labelText && (
                          <span style={{ color:bar.label.color, fontSize:bar.label.fontSize, fontFamily:labelFontFamily, fontWeight:500, whiteSpace:"nowrap" }}>{labelText}</span>
                        )}
                      </div>
                      {/* In front of the bar: the main caption (when its Position is
                          "before") followed by the start date in split mode. */}
                      {frontText.length > 0 && (
                        <div style={captionBox("front")}>
                          {frontText.map((t, i) => <span key={i}>{t}</span>)}
                        </div>
                      )}
                      {/* Behind the bar: the finish date in split mode, then the main
                          caption (its Position is "after", or inside did not fit). */}
                      {backText.length > 0 && (
                        <div style={captionBox("back")}>
                          {backText.map((t, i) => <span key={i}>{t}</span>)}
                        </div>
                      )}
                      {!el&&<div style={{ position:"absolute", left:pos.left+pos.width-6, width:6, height:hasComp?HALF:barH, top:hasComp ? Math.floor((ROW_H - HALF*2)/2)+HALF : "50%", transform:hasComp?"none":"translateY(-50%)", background:"rgba(0,0,0,0.3)", cursor:"ew-resize", zIndex:5, borderRadius:2, opacity:0 }} className="hover:opacity-100 transition-opacity" onMouseDown={e=>barDown(e,task,"right")} />}
                      {isDelay&&dur>0&&(
                        <div draggable
                          onDragStart={e=>{draggingLabel.current={taskId:task.id,startX:e.clientX,startY:e.clientY,ox:labelOffsets[task.id]?.x||0,oy:labelOffsets[task.id]?.y||0};e.dataTransfer.effectAllowed="move";}}
                          onDragEnd={e=>{const c=draggingLabel.current;if(c){setLabelOffsets(p=>({...p,[c.taskId]:{x:c.ox+e.clientX-c.startX,y:c.oy+e.clientY-c.startY}}));draggingLabel.current=null;}}}
                          style={{ position:"absolute", left:pos.left+pos.width/2-40+(labelOffsets[task.id]?.x||0), top:labelOffsets[task.id]?.y??-26, width:80, height:22, border:"2px solid #005a53", background:"#fff", borderRadius:3, fontSize:12, fontWeight:"bold", color:"#005a53", zIndex:5, display:"flex", alignItems:"center", justifyContent:"center", cursor:"move", userSelect:"none" }}>
                          {durMode==="wd"?dur:task.start&&task.end?differenceInDays(parseISO(task.end),parseISO(task.start))+1:""} {durMode==="wd"?"WD":"Cal"}
                        </div>
                      )}
                    </>
                    );
                  })()}
                </div>
              );
            })}

            {/* Add buttons spacer row (right side) — matches left panel height */}
            <div style={{ height:41, borderTop:"1px solid #cecece", background:"#fff" }} />

            {/* SVG grid + overlays */}
            <svg style={{ position:"absolute", top:0, left:0, width:totalW, height:displayTasks.length*ROW_H, pointerEvents:"none", zIndex:20 }}>
              {cols.map((_,i)=><line key={i} x1={i*cw2} y1={0} x2={i*cw2} y2={displayTasks.length*ROW_H} stroke="#cecece" strokeWidth="0.5" strokeDasharray="2,2"/>)}
              {/* Holiday markers — light red vertical bands with red dashed lines (shown with Today line) */}
              {(() => {
                if (!showHolidays) return null;
                const fmtStart = format(minDate, "yyyy-MM-dd");
                const fmtEnd = format(maxDate, "yyyy-MM-dd");
                const holidays = getHolidaysInRange(fmtStart, fmtEnd);
                const svgH = displayTasks.length * ROW_H;
                return holidays.map(d => {
                  const x = differenceInDays(parseISO(d), tlStart) * ppd;
                  if (x < 0 || x > totalW) return null;
                  return (
                    <g key={`hol-${d}`} style={{ pointerEvents: "none" }}>
                      {/* Semi-transparent red background band */}
                      <rect x={x} y={0} width={Math.max(ppd, 2)} height={svgH} fill="#dc3545" opacity={0.15} />
                      {/* Red dashed line */}
                      <line x1={x + ppd/2} y1={0} x2={x + ppd/2} y2={svgH} stroke="#dc3545" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.8} />
                    </g>
                  );
                });
              })()}
              {showToday&&todayLeft>0&&todayLeft<totalW&&<line x1={todayLeft} y1={0} x2={todayLeft} y2={displayTasks.length*ROW_H} stroke="#dc3545" strokeWidth="1.5"/>}
              {/* Last Recalc Date — the programme's data date (batch 27).
                  Dashed orange + a label chip, so it reads as "the record is at
                  this day" and never as "today". */}
              {showRecalcLine && recalcLeft !== null && recalcLeft > 0 && recalcLeft < totalW && (
                <g data-recalc-line={recalcIso}>
                  <line x1={recalcLeft} y1={0} x2={recalcLeft} y2={displayTasks.length*ROW_H} stroke="#e88219" strokeWidth="2" strokeDasharray="7,3"/>
                  <polygon points={`${recalcLeft-4},0 ${recalcLeft+4},0 ${recalcLeft},7`} fill="#e88219"/>
                  <text x={recalcLeft+5} y={14} fontSize="10" fontWeight="700" fill="#e88219" stroke="#fff" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">Last Recalc {recalcIso}</text>
                </g>
              )}
              {/* Staircase */}
              {showStaircase && staircases.map((prog,pi)=>{
                if(!prog.bars.length) return null;
                const BH=bar.heightPx, pts=[], fb=prog.bars[0], fbt=fb.idx*ROW_H+(ROW_H-BH)/2;
                pts.push(`${fb.pos.left},${fbt}`);
                let mx=fb.pos.left+fb.pos.width; pts.push(`${mx},${fbt}`);
                for(let i=1;i<prog.bars.length;i++){
                  const b=prog.bars[i], bx2=b.pos.left+b.pos.width;
                  if(bx2<mx) continue;
                  const bt2=b.idx*ROW_H+(ROW_H-BH)/2; pts.push(`${mx},${bt2}`); pts.push(`${bx2},${bt2}`); mx=bx2;
                }
                if(pts.length){const ly=parseFloat(pts[pts.length-1].split(",")[1]);pts.push(`${mx},${ly+ROW_H/2}`);}
                return <polyline key={pi} points={pts.join(" ")} fill="none" stroke="#dc3545" strokeWidth="2"/>;
              })}

              {/* Relationship arrows (FS/SS/FF/SF) from imported data */}
              {showRelationshipLines && (() => {
                const taskLookup = {};
                displayTasks.forEach((t, idx) => {
                  if (t.isSection) return;
                  const p = bpMap.get(t.id);
                  if (p) taskLookup[t.id] = { idx, pos: p, task: t };
                });

                const REL_COLORS = { FS: "#005a53", SS: "#003531", FF: "#733208", SF: "#e88219" };
                const arrows = [];
                const seen = new Set();

                Object.values(taskLookup).forEach(({ task, idx, pos }) => {
                  const rels = [];
                  if (task.links && task.links.length > 0) {
                    task.links.forEach(l => rels.push({ succId: l.succId, type: l.type || "FS", lag: l.lag || 0 }));
                  }
                  if (task.link && !(task.links && task.links.some(l => Number(l.succId) === Number(task.link)))) {
                    rels.push({ succId: task.link, type: task.linkType || "FS", lag: task.linkOffset || 0 });
                  }

                  rels.forEach(r => {
                    const succ = taskLookup[r.succId];
                    if (!succ) return;
                    const key = `${task.id}-${r.succId}-${r.type}`;
                    if (seen.has(key)) return;
                    seen.add(key);

                    const predY = idx * ROW_H + ROW_H / 2;
                    const succY = succ.idx * ROW_H + ROW_H / 2;
                    const type = r.type || "FS";
                    const color = REL_COLORS[type] || "#005a53";

                    const predStartX = pos.left;
                    const predEndX = pos.left + pos.width;
                    const succStartX = succ.pos.left;
                    const succEndX = succ.pos.left + succ.pos.width;

                    let startX, endX;
                    if (type === "FS") { startX = predEndX; endX = succStartX; }
                    else if (type === "SS") { startX = predStartX; endX = succStartX; }
                    else if (type === "FF") { startX = predEndX; endX = succEndX; }
                    else { startX = predStartX; endX = succEndX; }

                    const elbowX = endX >= startX ? startX + 8 : startX - 8;
                    const pts = `${startX},${predY} ${elbowX},${predY} ${elbowX},${succY} ${endX},${succY}`;

                    const aSize = 4;
                    const goingRight = endX >= elbowX;
                    const ah = goingRight
                      ? `${endX},${succY} ${endX - aSize},${succY - aSize/2} ${endX - aSize},${succY + aSize/2}`
                      : `${endX},${succY} ${endX + aSize},${succY - aSize/2} ${endX + aSize},${succY + aSize/2}`;

                    arrows.push(
                      <g key={`rel-${key}`}>
                        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" opacity="0.6" />
                        <polygon points={ah} fill={color} opacity="0.6" />
                        <text x={elbowX + 2} y={(predY + succY) / 2 + 3} fill={color} fontSize="7" opacity="0.65" fontFamily="sans-serif">{type}</text>
                      </g>
                    );
                  });
                });

                return arrows;
              })()}

              {/* Comparison — render one arrow per adjacent enabled pair */}
              {(()=>{
                const p=staircases;
                if(p.length<2) return null;
                const gex=pg=>pg.bars.reduce((m,b)=>Math.max(m,b.pos.left+b.pos.width),0);
                const ged=pg=>pg.bars.reduce((m,b)=>{const e=parseISO(b.task.end||b.task.start);return isValid(e)&&(!m||e>m)?e:m;},null);
                const svgH=displayTasks.length*ROW_H;
                const ds=5,lw=80,lh=20;
                const ah=(px,py,dir)=>{const s=5;return dir==="left"?`${px},${py} ${px+s},${py-s/2} ${px+s},${py+s/2}`:`${px},${py} ${px-s},${py-s/2} ${px-s},${py+s/2}`;};

                // Build section row index map: sectionTaskIndex → row index in computedTasks
                const sectionRowIdxs=[];
                displayTasks.forEach((t,i)=>{ if(t.isSection) sectionRowIdxs.push(i); });

                const pairs=[];
                for(let i=0;i<p.length-1;i++){
                  if(p[i].showComparison!==false && p[i+1].showComparison!==false){
                    pairs.push([i,i+1]);
                  }
                }
                if(!pairs.length) return null;

                return pairs.map(([ai,bi],pi)=>{
                  const x1=gex(p[ai]),x2=gex(p[bi]),d1=ged(p[ai]),d2=ged(p[bi]);
                  if(!x1||!x2||!d1||!d2) return null;
                  const diffCal=Math.abs(differenceInDays(d1<d2?d2:d1,d1<d2?d1:d2))+1;
                  const diffWD=countWorkingDays(format(d1<d2?d1:d2,"yyyy-MM-dd"),format(d1<d2?d2:d1,"yyyy-MM-dd"));
                  const lx=Math.min(x1,x2),rx=Math.max(x1,x2);
                  // Arrow Y: midpoint of the second programme's section row
                  const secRowIdx = sectionRowIdxs[bi] ?? 0;
                  const ay=secRowIdx*ROW_H+ROW_H/2;
                  const labX=lx+(rx-lx)/2-lw/2,labY=ay-lh/2;
                  return (
                    <g key={`cmp-${pi}`}>
                      <line x1={x1} y1={0} x2={x1} y2={svgH} stroke="#733208" strokeWidth="1.5" strokeDasharray="5,3"/>
                      <line x1={x2} y1={0} x2={x2} y2={svgH} stroke="#733208" strokeWidth="1.5" strokeDasharray="5,3"/>
                      <polygon points={`${x1},${ay-ds} ${x1+ds},${ay} ${x1},${ay+ds} ${x1-ds},${ay}`} fill="#733208"/>
                      <polygon points={`${x2},${ay-ds} ${x2+ds},${ay} ${x2},${ay+ds} ${x2-ds},${ay}`} fill="#733208"/>
                      <line x1={lx} y1={ay} x2={rx} y2={ay} stroke="#733208" strokeWidth="1.5"/>
                      <polygon points={ah(lx,ay,"left")} fill="#733208"/>
                      <polygon points={ah(rx,ay,"right")} fill="#733208"/>
                      <rect x={labX} y={labY} width={lw} height={lh} fill="white" stroke="#733208" strokeWidth="1.5" rx="3"/>
                      <text x={labX+lw/2} y={labY+13} textAnchor="middle" fill="#733208" fontSize="11" fontWeight="bold" fontFamily="sans-serif">{durMode==="wd"?diffWD:diffCal} {durMode==="wd"?"WD":"Cal"}</text>
                    </g>
                  );
                });
              })()}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cell helper ──────────────────────────────────────────────────────────────
function C({ w, children, p = undefined, style, ...rest }) {
  return (
    <div {...rest} style={{ width:w, minWidth:w, maxWidth:w, flexShrink:0, height:"100%", borderRight:"var(--gantt-col-border, 1px solid #cecece)", overflow:"hidden", display:"flex", alignItems:"center", padding: p !== undefined ? p : undefined, ...style }}>
      {children}
    </div>
  );
}

// ── Right header synced to right body scroll ─────────────────────────────────
function GanttHeaderSync({ rightBodyRef, totalW, children }) {
  const ref = useRef(null);

  useEffect(()=>{
    const body = rightBodyRef?.current;
    if (!body) return;
    const handler = ()=>{ if(ref.current) ref.current.scrollLeft = body.scrollLeft; };
    body.addEventListener("scroll", handler);
    return ()=>body.removeEventListener("scroll", handler);
  }, [rightBodyRef]);

  return (
    <div style={{ overflow:"hidden", background:HD_BG, flexShrink:0 }} ref={ref}>
      <div style={{ minWidth:totalW }}>
        {children}
      </div>
    </div>
  );
}