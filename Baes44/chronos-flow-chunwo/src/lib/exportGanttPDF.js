import { jsPDF } from "jspdf";
import { parseISO, isValid, differenceInDays, addDays, addMonths, startOfMonth, format, eachMonthOfInterval } from "date-fns";
import { countWorkingDays, getHolidaysInRange } from "@/lib/hkWorkingDays";
import {
  DEFAULT_DISPLAY_SETTINGS,
  formatDisplayDate,
  pdfDashPattern,
  hexToRgbArray,
  resolveWbsRowStyle,
  buildBarTextParts,
  hasBarInfo,
  normalizeBarTextPosition,
  pdfCoreFontFor,
} from "@/lib/displaySettings";
import { encodeTasksForPDF } from "@/lib/ganttPDFData";

const BAR_COLOR = [41, 128, 185];
const DELAY_COLOR = [34, 197, 94];
const HEADER_BG = [240, 240, 240];
const GRID_LINE = [200, 200, 200];
const TEXT_DARK = [30, 30, 30];
const ROW_ALT = [248, 250, 252];
const RED = [239, 68, 68];
// The chart's comparison colour (BL/late bars, comparison milestones and the
// comparison-arrow annotation are all #733208 there — batch 36/39).
const COMPARISON_BROWN = [115, 50, 8];

/**
 * Batch 38/39 — collects the printed staircase's steps **exactly like the chart does**
 * (`UnifiedGanttLayout` ▸ `bpMap` + `staircases` + the `<polyline>`):
 *
 *   · one group per section, plus a leading group for rows that come before the first
 *     section (the chart pushes those too),
 *   · every non-section row that has a position takes part — bars *and milestones*
 *     (the chart's `bpMap` gives a milestone `bpos(start, start)`: one day wide),
 *   · rows without a position are skipped, and `filterIds` mirrors the BulkEditBar
 *     "Staircase filter" (only the selected rows take part),
 *   · steps keep their page so the line can continue over a page break.
 *
 * Each group also carries what the chart's comparison arrows need (batch 39):
 * `showComparison` (the programmes that may be compared), `sectionIdx` (the row the arrow
 * is drawn on) and, per step, `finish` (the chart's `ged`: latest `end`, else `start`).
 *
 * Exported so the smoke test can pin the rule down without rendering a PDF.
 */
export function collectStaircaseSteps(tasks, positionOf, filterIds = null) {
  const programmes = [];
  let current = null;
  const open = () => {
    if (!current) {
      // Rows before the first section: the chart starts such a group "comparable" too.
      current = { steps: [], showComparison: true, sectionIdx: null };
      programmes.push(current);
    }
    return current;
  };
  (tasks || []).forEach((task, idx) => {
    if (task && task.isSection) {
      current = { steps: [], showComparison: task.showComparison !== false, sectionIdx: idx };
      programmes.push(current);
      return;
    }
    const group = open();
    if (filterIds && !filterIds.has(task ? task.id : idx)) return;
    const pos = positionOf(idx);
    if (!pos) return;
    group.steps.push({
      page: pos.page, left: pos.left, right: pos.left + pos.width, top: pos.top,
      finish: task ? (task.end || task.start || null) : null,
    });
  });
  return programmes.filter((programme) => programme.steps.length);
}

/**
 * Batch 45 — set while a PDF is built with an embedded CJK font. jsPDF's core fonts are
 * Latin-1 only, so without this flag non-Latin characters are replaced with "?".
 */
let unicodeFontActive = false;

function sanitizePDFText(str) {
  if (!str) return "";
  const normalised = String(str)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u2023\u25E6\u2043]/g, '*');
  // With an embedded CJK font the real characters are kept (they are real, selectable text
  // in the PDF); otherwise anything outside Latin-1 has to become "?".
  return unicodeFontActive ? normalised : normalised.replace(/[^\x00-\xFF]/g, '?');
}

/**
 * Build the Gantt PDF document **without saving it**.
 *
 * Split out of `exportGanttPDF` so the print-preview dialog can show the very
 * same bytes that will be downloaded (WYSIWYG preview) instead of a
 * re-implementation of the layout. Drawing code is unchanged.
 *
 * @returns {{ doc: import("jspdf").jsPDF, filename: string, pageCount: number }}
 */
export function buildGanttPDF({ 
  tasks, projectTitle, companyName, programmeRef, subtitle, 
  labelOffsets = {}, fitOnePage = false, dateRange = null, 
  durMode = "wd", fontScale = 1.0, barLabel = "item", 
  barLabelSide = "right", textColors = {}, showStaircase = false, 
  staircaseFilterIds = null,   // batch 38 — chart's "Staircase filter" (BulkEditBar) rows
  columnVisibility = null,
  // ── Print content (batch 26 — chosen in the Print Preview) ────────────────
  // All off/false by default so an export looks exactly as before unless asked.
  showHolidays = false,        // shade HK public holidays in the timeline
  showToday = false,           // red "today" line
  showRecalcDate = false,      // dashed orange line at the programme's data date
  recalcDate = "",             // that date, "YYYY-MM-DD" (Last Recalc Date)
  showRelationshipLines = false, // predecessor → successor arrows (within a page)
  showComparisonBars = true,   // purple BL/late comparison bars (long-standing behaviour)
  showComparisonArrows = false, // batch 39 — finish-date comparison between programmes
  // ── Page setup ────────────────────────────────────────────────────────────
  paperSize = "a3",           // "a3" | "a4"
  orientation = "landscape",  // "landscape" | "portrait"
  margin = 8,                 // mm
  footerLeft = "", footerCenter = "", footerRight = "",  // {page} / {pages} placeholders supported
  // ── Grid & date format ────────────────────────────────────────────────────
  grid = null,
  dateFormat = "yyyy-MM-dd",
  // ── Bar appearance (shared with the Gantt Settings panel) ─────────────────
  bar = null,
  // ── WBS rows (shared with the WBS Settings panel) ─────────────────────────
  group = null,
  wbs = null,
  // ── Embedded data (see ganttPDFData.js): lets this PDF be re-imported with
  //    every field restored instead of going through AI/vision extraction ────
  embedData = null,
  // ── CJK text (batch 45) ───────────────────────────────────────────────────
  // { name, base64 } of a Unicode-capable TrueType font (see src/lib/cjkFont.js).
  // When given, Chinese etc. is written as real text instead of "?"; jsPDF subsets the
  // font, so the file only grows by the glyphs actually used (~0.3 MB for a page).
  cjkFont = null,
}) {
  const g = { ...DEFAULT_DISPLAY_SETTINGS.grid, ...(grid || {}) };
  const grpStyle = { ...DEFAULT_DISPLAY_SETTINGS.group, ...(group || {}) };
  const wbsStyle = { ...DEFAULT_DISPLAY_SETTINGS.wbs, ...(wbs || {}) };
  const barStyle = { ...DEFAULT_DISPLAY_SETTINGS.bar, ...(bar || {}) };
  barStyle.critical = { ...DEFAULT_DISPLAY_SETTINGS.bar.critical, ...((bar || {}).critical || {}) };
  const doc = new jsPDF({ orientation, unit: "mm", format: paperSize });
  // ── CJK support (batch 45) ────────────────────────────────────────────────
  // Register the Unicode font and route every core-font request to it, so all the drawing
  // code below keeps asking for helvetica/courier/times and still writes real Chinese text.
  // The font is a single weight (jsPDF cannot synthesise bold from an embedded font), so
  // bold/italic requests are normalised to it as well.
  unicodeFontActive = !!(cjkFont && cjkFont.base64);
  if (unicodeFontActive) {
    const cjkName = cjkFont.name || "CJK";
    const coreFont = /^(helvetica|courier|times|symbol|zapfdingbats)/i;
    doc.addFileToVFS(`${cjkName}.ttf`, cjkFont.base64);
    doc.addFont(`${cjkName}.ttf`, cjkName, "normal");
    const coreSetFont = doc.setFont.bind(doc);
    doc.setFont = (family, style) => coreSetFont(coreFont.test(String(family)) ? cjkName : family, coreFont.test(String(family)) ? "normal" : style);
    doc.setFont(cjkName, "normal");
  }
  // ── Mark the file so re-uploading it restores every field (see ganttPDFData.js) ──
  if (embedData && embedData.subject) {
    try {
      doc.setProperties({
        title: programmeRef || projectTitle || "Gantt Chart",
        subject: embedData.subject,
        author: embedData.author,
        keywords: embedData.keywords || "",
        creator: `Chronos Flow Gantt — ${embedData.count ?? 0} activities embedded`,
      });
    } catch { /* metadata is best-effort: never block the export */ }
  }
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = margin;
  const FOOTER_H = (footerLeft || footerCenter || footerRight) ? 8 : 0;

  // ── Line helpers (respect the grid-line settings) ─────────────────────────
  const applyLineStyle = (visible, color, weight, style) => {
    if (!visible) return false;
    doc.setDrawColor(...hexToRgbArray(color));
    doc.setLineWidth(Math.max(0.05, weight * 0.25));
    if (typeof doc.setLineDashPattern === "function") {
      const [pattern, phase] = pdfDashPattern(style);
      doc.setLineDashPattern(pattern, phase);
    }
    return true;
  };
  const resetLineStyle = () => {
    if (typeof doc.setLineDashPattern === "function") doc.setLineDashPattern([], 0);
  };

  // ── Bar drawing (height / corner radius / border from the Gantt Settings) ──
  const drawBar = (x, y, w, h, rgb, borderRgb) => {
    const width = Math.max(w, 0.3);
    const r = Math.min((barStyle.cornerRadius || 0) * 0.22, h / 2);
    doc.setFillColor(...rgb);
    if (r > 0.05 && typeof doc.roundedRect === "function") doc.roundedRect(x, y, width, h, r, r, "F");
    else doc.rect(x, y, width, h, "F");
    if (barStyle.borderWidth > 0 && borderRgb) {
      if (applyLineStyle(true, borderRgb, barStyle.borderWidth * 0.5, barStyle.borderStyle)) {
        doc.setDrawColor(...hexToRgbArray(borderRgb));
        if (r > 0.05 && typeof doc.roundedRect === "function") doc.roundedRect(x, y, width, h, r, r, "S");
        else doc.rect(x, y, width, h, "S");
        resetLineStyle();
      }
    }
  };

  // ── Column visibility — mirrors the on-screen table exactly ──────────────
  // columnVisibility structure: { fieldKey: { visible: true/false, position: N }, ... }
  // Rules (same as UnifiedGanttLayout, so the PDF matches the table):
  //   * an existing entry is shown when visible !== false
  //   * when the parent has no visibility state yet (GanttPage keeps `null` until
  //     the user changes a column) the table falls back to INIT_VISIBILITY → core
  //     columns only, every extra field hidden. The PDF must use that same default,
  //     otherwise it expands every column while the table only shows a few.
  const CORE_DEFAULT_VISIBLE = new Set(["item", "activityId", "activity", "start", "end", "duration"]);
  const isFieldVisible = (fieldKey) => {
    if (columnVisibility) return columnVisibility[fieldKey]?.visible !== false;
    return CORE_DEFAULT_VISIBLE.has(fieldKey);
  };
  // Column order follows the user's own column order (drag & drop position)
  const fieldPosition = (fieldKey) => {
    const p = columnVisibility ? columnVisibility[fieldKey]?.position : undefined;
    return typeof p === "number" ? p : Number.MAX_SAFE_INTEGER;
  };

  // All supported extra fields for PDF export (beyond the fixed core)
  const EXTRA_FIELDS = [
    { key: "remainDur",          colKey: "remainDur",          label: "Rem.Dur",     w: 14, taskKey: "remainDur",         fmt: v => v != null ? String(v) : "" },
    { key: "float",              colKey: "float",              label: "Float",       w: 12, taskKey: "float",             fmt: v => v != null ? String(v) : "" },
    { key: "pct",                colKey: "pct",                label: "% Comp",      w: 12, taskKey: "pct",               fmt: v => v != null ? `${v}%` : "" },
    { key: "blStart",            colKey: "blStart",            label: "BL Start",    w: 20, taskKey: "baselineStart",     fmt: v => v || "" },
    { key: "blEnd",              colKey: "blEnd",              label: "BL End",      w: 20, taskKey: "baselineFinish",    fmt: v => v || "" },
    { key: "earlyStart",         colKey: "earlyStart",         label: "Early Start", w: 20, taskKey: "earlyStart",        fmt: v => v || "" },
    { key: "earlyEnd",           colKey: "earlyEnd",           label: "Early Finish",w: 20, taskKey: "earlyEnd",          fmt: v => v || "" },
    { key: "lateStart",          colKey: "lateStart",          label: "Late Start",  w: 20, taskKey: "lateStart",         fmt: v => v || "" },
    { key: "lateEnd",            colKey: "lateEnd",            label: "Late Finish", w: 20, taskKey: "lateEnd",           fmt: v => v || "" },
    { key: "freeFloat",          colKey: "freeFloat",          label: "Free Float",  w: 12, taskKey: "freeFloat",         fmt: v => v != null ? String(v) : "" },
    { key: "expectedFinish",     colKey: "expectedFinish",     label: "Exp. Finish", w: 20, taskKey: "expectedFinish",    fmt: v => v || "" },
    { key: "primaryResource",    colKey: "primaryResource",    label: "Resource",    w: 16, taskKey: "primaryResource",   fmt: v => v || "" },
    { key: "durationType",       colKey: "durationType",       label: "Dur. Type",   w: 14, taskKey: "durationType",      fmt: v => v || "" },
    { key: "completePctType",    colKey: "completePctType",    label: "% Type",      w: 12, taskKey: "completePctType",   fmt: v => v || "" },
    { key: "statusCode",         colKey: "statusCode",         label: "Status",      w: 14, taskKey: "statusCode",        fmt: v => v || "" },
    { key: "constraintType",     colKey: "constraintType",     label: "Constraint",  w: 16, taskKey: "constraintType",    fmt: v => v || "" },
    { key: "constraintDate",     colKey: "constraintDate",     label: "Const. Date", w: 20, taskKey: "constraintDate",    fmt: v => v || "" },
    // Remaining selectable P6 fields (same labels / order as the column menu)
    { key: "constraintType2",    colKey: "constraintType2",    label: "Const.2",     w: 12, taskKey: "constraintType2",   fmt: v => v || "" },
    { key: "constraintDate2",    colKey: "constraintDate2",    label: "Const.2 Date",w: 20, taskKey: "constraintDate2",   fmt: v => v || "" },
    { key: "suspendDate",        colKey: "suspendDate",        label: "Suspend",     w: 20, taskKey: "suspendDate",       fmt: v => v || "" },
    { key: "resumeDate",         colKey: "resumeDate",         label: "Resume",      w: 20, taskKey: "resumeDate",        fmt: v => v || "" },
    { key: "priorityType",       colKey: "priorityType",       label: "Priority",    w: 12, taskKey: "priorityType",      fmt: v => v || "" },
    { key: "locationId",         colKey: "locationId",         label: "Location",    w: 14, taskKey: "locationId",        fmt: v => v || "" },
    { key: "estWt",              colKey: "estWt",              label: "Est Wt",      w: 10, taskKey: "estWt",             fmt: v => v != null ? String(v) : "" },
    { key: "drivingPathFlag",    colKey: "drivingPathFlag",    label: "Long.Path",   w: 11, taskKey: "drivingPathFlag",   fmt: v => v || "" },
    { key: "lockPlanFlag",       colKey: "lockPlanFlag",       label: "Lock Plan",   w: 12, taskKey: "lockPlanFlag",      fmt: v => v || "" },
    { key: "autoComputeActFlag", colKey: "autoComputeActFlag", label: "Auto Actuals",w: 14, taskKey: "autoComputeActFlag",fmt: v => v || "" },
    { key: "actLaborUnits",      colKey: "actLaborUnits",      label: "Act.Labor",   w: 13, taskKey: "actLaborUnits",     fmt: v => v != null ? String(v) : "" },
    { key: "actNonlaborUnits",   colKey: "actNonlaborUnits",   label: "Act.NonLabor",w: 15, taskKey: "actNonlaborUnits",  fmt: v => v != null ? String(v) : "" },
    { key: "remLaborUnits",      colKey: "remLaborUnits",      label: "Rem.Labor",   w: 13, taskKey: "remLaborUnits",     fmt: v => v != null ? String(v) : "" },
    { key: "remNonlaborUnits",   colKey: "remNonlaborUnits",   label: "Rem.NonLabor",w: 15, taskKey: "remNonlaborUnits",  fmt: v => v != null ? String(v) : "" },
    { key: "planLaborUnits",     colKey: "planLaborUnits",     label: "Plan Labor",  w: 14, taskKey: "planLaborUnits",    fmt: v => v != null ? String(v) : "" },
    { key: "planNonlaborUnits",  colKey: "planNonlaborUnits",  label: "Plan NonLabor",w:17, taskKey: "planNonlaborUnits", fmt: v => v != null ? String(v) : "" },
    { key: "reviewFinish",       colKey: "reviewFinish",       label: "Review Finish",w:20, taskKey: "reviewFinish",      fmt: v => v || "" },
    { key: "reviewStatus",       colKey: "reviewStatus",       label: "Review Status",w:14, taskKey: "reviewStatus",      fmt: v => v || "" },
    { key: "externalEarlyStart", colKey: "externalEarlyStart", label: "Ext.ES",      w: 15, taskKey: "externalEarlyStart",fmt: v => v || "" },
    { key: "externalLateFinish", colKey: "externalLateFinish", label: "Ext.LF",      w: 15, taskKey: "externalLateFinish",fmt: v => v || "" },
    { key: "remEarlyStart",      colKey: "remEarlyStart",      label: "Rem.ES",      w: 15, taskKey: "remEarlyStart",     fmt: v => v || "" },
    { key: "remEarlyFinish",     colKey: "remEarlyFinish",     label: "Rem.EF",      w: 15, taskKey: "remEarlyFinish",    fmt: v => v || "" },
    { key: "remLateStart",       colKey: "remLateStart",       label: "Rem.LS",      w: 15, taskKey: "remLateStart",      fmt: v => v || "" },
    { key: "remLateFinish",      colKey: "remLateFinish",      label: "Rem.LF",      w: 15, taskKey: "remLateFinish",     fmt: v => v || "" },
    { key: "floatPath",          colKey: "floatPath",          label: "Float Path",  w: 14, taskKey: "floatPath",         fmt: v => v || "" },
    { key: "floatPathOrder",     colKey: "floatPathOrder",     label: "FP Order",    w: 13, taskKey: "floatPathOrder",    fmt: v => v != null ? String(v) : "" },
    { key: "p6Guid",             colKey: "p6Guid",             label: "GUID",        w: 24, taskKey: "p6Guid",            fmt: v => v || "" },
    { key: "p6TaskId",           colKey: "p6TaskId",           label: "P6 ID",       w: 12, taskKey: "p6TaskId",          fmt: v => v || "" },
    { key: "targetDuration",     colKey: "targetDuration",     label: "Plan.Dur",    w: 14, taskKey: "targetDuration",    fmt: v => v != null ? String(v) : "" },
    { key: "calendar",           colKey: "calendar",           label: "Calendar",    w: 16, taskKey: "calendar",          fmt: v => v || "" },
  ];

  const visibleFields = {
    item: isFieldVisible("item"),
    id: isFieldVisible("activityId"),
    activity: isFieldVisible("activity"),
    start: isFieldVisible("start"),
    end: isFieldVisible("end"),
    duration: isFieldVisible("duration"),
  };

  // ── Column widths ──────────────────────────────────────────────────────────
  const COL_ITEM = visibleFields.item ? 10 : 0;
  const COL_ID = visibleFields.id ? 18 : 0;
  const COL_START = visibleFields.start ? 20 : 0;
  const COL_END = visibleFields.end ? 20 : 0;
  const COL_DUR = visibleFields.duration ? 14 : 0;

  // Measure activity column width - cap at reasonable max to prevent overflow
  const actFontSize = Math.max(4, 6 * fontScale);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(actFontSize);
  const longestActW = tasks
    .filter(t => !t.isSection && t.activity)
    .reduce((max, t) => Math.max(max, doc.getTextWidth(sanitizePDFText(t.activity))), 0);
  const COL_ACT = Math.max(40, Math.min(120, Math.ceil(longestActW) + 4));

  // Extra columns whose value is a date → rendered with the chosen date format
  const DATE_COL_KEYS = new Set([
    "blStart", "blEnd", "earlyStart", "earlyEnd", "lateStart", "lateEnd",
    "expectedFinish", "constraintDate", "constraintDate2", "suspendDate", "resumeDate",
    "reviewFinish", "externalEarlyStart", "externalLateFinish",
    "remEarlyStart", "remEarlyFinish", "remLateStart", "remLateFinish",
  ]);

  // Visible extra columns, in exactly the order the user has them on screen
  let sortedExtraFields = EXTRA_FIELDS
    .filter(f => isFieldVisible(f.colKey))
    .sort((a, b) => fieldPosition(a.colKey) - fieldPosition(b.colKey));

  const TOTAL_W = PAGE_W - 2 * MARGIN;
  // The timeline must always stay usable: extras are shrunk (never below 30% of
  // their designed width) and, if they still cannot fit, the last extras are left
  // out of the PDF entirely (they remain visible in the app table).
  const MIN_GANTT_W = 80;
  const MIN_EXTRA_SCALE = 0.3;
  const CORE_LEFT_W = COL_ITEM + COL_ID + COL_ACT + COL_START + COL_END + COL_DUR;
  const EXTRA_BUDGET = Math.max(0, TOTAL_W - MIN_GANTT_W - CORE_LEFT_W);
  const RAW_EXTRAS_W = sortedExtraFields.reduce((sum, f) => sum + f.w, 0);
  const extraScale = (RAW_EXTRAS_W > EXTRA_BUDGET && RAW_EXTRAS_W > 0)
    ? Math.max(MIN_EXTRA_SCALE, Math.min(1, EXTRA_BUDGET / RAW_EXTRAS_W))
    : 1;
  if (RAW_EXTRAS_W * extraScale > EXTRA_BUDGET) {
    const kept = [];
    let used = 0;
    for (const f of sortedExtraFields) {
      if (used + f.w * extraScale > EXTRA_BUDGET) break;
      used += f.w * extraScale;
      kept.push(f);
    }
    if (kept.length < sortedExtraFields.length) {
      console.warn(`[exportGanttPDF] ${sortedExtraFields.length - kept.length} extra column(s) omitted — not enough page width for all selected columns.`);
    }
    sortedExtraFields = kept;
  }
  const activeExtraFields = sortedExtraFields.map(f => ({ ...f, w: f.w * extraScale }));

  const COL_EXTRAS_W = activeExtraFields.reduce((sum, f) => sum + f.w, 0);
  const FIXED_LEFT_W = COL_ITEM + COL_ID + COL_ACT + COL_START + COL_END + COL_DUR + COL_EXTRAS_W;
  let LEFT_W = FIXED_LEFT_W;
  let GANTT_W = TOTAL_W - LEFT_W;
  let GANTT_X = MARGIN + LEFT_W;

  const HDR_YEAR_H = 6;
  const HDR_MON_H = 5;
  const HDR_H = HDR_YEAR_H + HDR_MON_H;
  const ROW_H = 6;

  // ── Compute timeline ──────────────────────────────────────────────────────
  const validTasks = tasks.filter(t => {
    if (t.isSection) return false;
    const sd = t.start || (t.deletedFromBL ? t.baselineStart : null);
    const ed = t.end || (t.deletedFromBL ? t.baselineFinish : null);
    const d = sd || ed;
    if (!d) return false;
    if (sd && ed) {
      const s = parseISO(sd), e = parseISO(ed);
      return isValid(s) && isValid(e) && e >= s;
    }
    return isValid(parseISO(d));
  });

  let tMin, tMax;
  if (dateRange && dateRange.start && dateRange.end) {
    tMin = parseISO(dateRange.start);
    tMax = parseISO(dateRange.end);
  } else if (validTasks.length) {
    const allDates = validTasks.flatMap(t => {
      const dates = [];
      const sd = t.start || (t.deletedFromBL ? t.baselineStart : null);
      const ed = t.end || (t.deletedFromBL ? t.baselineFinish : null);
      if (sd && isValid(parseISO(sd))) dates.push(parseISO(sd));
      if (ed && isValid(parseISO(ed))) dates.push(parseISO(ed));
      return dates;
    });
    tMin = addDays(new Date(Math.min(...allDates)), -15);
    tMax = addDays(new Date(Math.max(...allDates)), 15);
  } else {
    tMin = new Date();
    tMax = addMonths(tMin, 12);
  }

  const tMinMonth = startOfMonth(tMin);
  const tMaxMonth = addMonths(startOfMonth(tMax), tMax.getDate() > 1 ? 1 : 0);
  const months = eachMonthOfInterval({ start: tMinMonth, end: addDays(tMaxMonth, -1) });
  const totalDays = differenceInDays(tMaxMonth, tMinMonth);

  const yearGroups = [];
  months.forEach(m => {
    const yr = format(m, "yyyy");
    if (!yearGroups.length || yearGroups[yearGroups.length - 1].label !== yr) {
      yearGroups.push({ label: yr, count: 1 });
    } else {
      yearGroups[yearGroups.length - 1].count++;
    }
  });
  const monW = GANTT_W / months.length;
  const pxPerDay = GANTT_W / totalDays;

  // ── Helper: draw header ────────────────────────────────────────────────────
  function drawPageHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text(sanitizePDFText(companyName || ""), MARGIN, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(sanitizePDFText(programmeRef || projectTitle), MARGIN, 18);
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(8);
    doc.setTextColor(180, 50, 50);
    doc.text(sanitizePDFText(subtitle || ""), MARGIN, 24);
    doc.setTextColor(...TEXT_DARK);

    const LEG_X = PAGE_W - MARGIN - 70;
    const LEG_Y = 10;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("Legend:", LEG_X, LEG_Y);
    doc.setFillColor(...hexToRgbArray(barStyle.baselineColor));
    doc.rect(LEG_X, LEG_Y + 2, 8, 3, "F");
    doc.setTextColor(...TEXT_DARK);
    doc.text(": Baseline Programme (Planned Period)", LEG_X + 10, LEG_Y + 5);
    doc.setFillColor(...hexToRgbArray(barStyle.delayColor));
    doc.rect(LEG_X, LEG_Y + 8, 8, 3, "F");
    doc.text(": Delay Event", LEG_X + 10, LEG_Y + 11);
  }

  // ── Helper: draw column header ─────────────────────────────────────────────
  function drawTableHeader(tableTop) {
    doc.setFillColor(...HEADER_BG);
    doc.rect(MARGIN, tableTop, LEFT_W, HDR_H, "F");
    doc.setFillColor(200, 220, 240);
    doc.rect(GANTT_X, tableTop, GANTT_W, HDR_H, "F");

    // Helper to fit text in timeline header cells
    const fitTimelineText = (text, cellWidth, maxFontSize, minFontSize = 4) => {
      if (!text) return { text, fontSize: maxFontSize };
      let fontSize = maxFontSize;
      doc.setFontSize(fontSize);
      let textWidth = doc.getTextWidth(text);
      
      while (textWidth > cellWidth - 1 && fontSize > minFontSize) {
        fontSize -= 0.3;
        doc.setFontSize(fontSize);
        textWidth = doc.getTextWidth(text);
      }
      
      // If still too wide and it's a month abbreviation, use single letters
      if (textWidth > cellWidth - 1 && text.length === 3) {
        text = text.charAt(0);
        fontSize = Math.max(minFontSize, fontSize);
        doc.setFontSize(fontSize);
      }
      
      return { text, fontSize };
    };

    let xCursor = GANTT_X;
    yearGroups.forEach(g => {
      const gw = g.count * monW;
      doc.setFillColor(170, 200, 230);
      doc.rect(xCursor, tableTop, gw, HDR_YEAR_H, "F");
      doc.setDrawColor(...GRID_LINE);
      doc.rect(xCursor, tableTop, gw, HDR_YEAR_H);
      doc.setFont("helvetica", "bold");
      
      const yearResult = fitTimelineText(g.label, gw, 7 * fontScale, 5);
      doc.setFontSize(yearResult.fontSize);
      doc.setTextColor(...TEXT_DARK);
      doc.text(yearResult.text, xCursor + gw / 2, tableTop + HDR_YEAR_H - 1.5, { align: "center" });
      xCursor += gw;
    });

    months.forEach((m, i) => {
      const mx = GANTT_X + i * monW;
      doc.setDrawColor(...GRID_LINE);
      doc.rect(mx, tableTop + HDR_YEAR_H, monW, HDR_MON_H);
      doc.setFont("helvetica", "normal");
      const monLabel = format(m, "MMM");
      
      const monResult = fitTimelineText(monLabel, monW, 6 * fontScale, 4);
      doc.setFontSize(monResult.fontSize);
      doc.setTextColor(...TEXT_DARK);
      doc.text(monResult.text, mx + monW / 2, tableTop + HDR_YEAR_H + HDR_MON_H - 1.5, { align: "center" });
    });

    const drawHdrCell = (text, x, w) => {
      doc.setFillColor(...HEADER_BG);
      doc.setDrawColor(...GRID_LINE);
      doc.rect(x, tableTop, w, HDR_H);
      doc.setFont("helvetica", "bold");
      
      const hdrResult = fitTimelineText(text, w, 7 * fontScale, 5);
      doc.setFontSize(hdrResult.fontSize);
      doc.setTextColor(...TEXT_DARK);
      doc.text(hdrResult.text, x + w / 2, tableTop + HDR_H / 2 + 1.5, { align: "center" });
    };

    let lx = MARGIN;
    if (COL_ITEM > 0) { drawHdrCell("Item", lx, COL_ITEM); lx += COL_ITEM; }
    if (COL_ID > 0) { drawHdrCell("ID", lx, COL_ID); lx += COL_ID; }
    drawHdrCell("Activity", lx, COL_ACT); lx += COL_ACT;
    if (COL_START > 0) { drawHdrCell("Start", lx, COL_START); lx += COL_START; }
    if (COL_END > 0) { drawHdrCell("End", lx, COL_END); lx += COL_END; }
    if (COL_DUR > 0) { drawHdrCell(durMode === "wd" ? "Dur(WD)" : "Dur(Cal)", lx, COL_DUR); lx += COL_DUR; }
    activeExtraFields.forEach(f => { drawHdrCell(f.label, lx, f.w); lx += f.w; });
  }

  // ── Pagination by Programme Sections ──────────────────────────────────────
  const PAGE_HEADER_H = 30;
  const TABLE_TOP_FIRST = PAGE_HEADER_H;
  const TABLE_TOP_CONT = 14;
  const dataTasks = tasks.filter(t => !t.isSection);
  const totalRowCount = tasks.length;
  const availableH = PAGE_H - MARGIN - FOOTER_H - TABLE_TOP_FIRST - HDR_H;
  const fittedRowH = fitOnePage && totalRowCount > 0
    ? Math.max(3, Math.floor(availableH / totalRowCount))
    : ROW_H;
  const effectiveRowH = fitOnePage ? fittedRowH : ROW_H;
  const ROWS_PER_FIRST = Math.floor((PAGE_H - MARGIN - FOOTER_H - TABLE_TOP_FIRST - HDR_H) / effectiveRowH);
  const ROWS_PER_CONT = Math.floor((PAGE_H - MARGIN - FOOTER_H - TABLE_TOP_CONT - HDR_H) / effectiveRowH);

  // Identify section groups: each group = [sectionHeaderIdx, ...childIdxs]
  // Orphan tasks (no preceding section) form their own group
  const groups = [];
  let currentGroup = null;
  tasks.forEach((task, idx) => {
    if (task.isSection) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = [idx];
    } else {
      if (!currentGroup) currentGroup = [idx];
      else currentGroup.push(idx);
    }
  });
  if (currentGroup) groups.push(currentGroup);

  // Assign pages: keep each section group together when possible
  const taskPageMap = new Map();
  const pageRowCounts = [];
  let currentPage = 0;
  let usedRowsOnPage = 0;
  const MIN_KEEP_WITH_HEADER = 2; // minimum children to keep with a section header

  groups.forEach(group => {
    const groupSize = group.length;
    const isSectionGroup = group.length > 0 && tasks[group[0]].isSection;
    const rowsPerPageCurrent = currentPage === 0 ? ROWS_PER_FIRST : ROWS_PER_CONT;

    // If the entire group fits on a fresh page but not in remaining space, move to next page
    if (groupSize <= rowsPerPageCurrent && usedRowsOnPage + groupSize > rowsPerPageCurrent) {
      pageRowCounts[currentPage] = usedRowsOnPage;
      currentPage++;
      usedRowsOnPage = 0;
    }

    // For large groups that span multiple pages, ensure the header has at least MIN_KEEP_WITH_HEADER children
    if (isSectionGroup && groupSize > rowsPerPageCurrent) {
      const remaining = (currentPage === 0 ? ROWS_PER_FIRST : ROWS_PER_CONT) - usedRowsOnPage;
      if (remaining < 1 + Math.min(MIN_KEEP_WITH_HEADER, groupSize - 1)) {
        pageRowCounts[currentPage] = usedRowsOnPage;
        currentPage++;
        usedRowsOnPage = 0;
      }
    }

    // Place each item in the group
    group.forEach(taskIdx => {
      const currentRowsPerPage = currentPage === 0 ? ROWS_PER_FIRST : ROWS_PER_CONT;
      if (usedRowsOnPage >= currentRowsPerPage) {
        pageRowCounts[currentPage] = usedRowsOnPage;
        currentPage++;
        usedRowsOnPage = 0;
      }
      taskPageMap.set(taskIdx, { page: currentPage, localRowIdx: usedRowsOnPage });
      usedRowsOnPage++;
    });
  });
  if (usedRowsOnPage > 0) pageRowCounts[currentPage] = usedRowsOnPage;

  const lastUsedPage = Math.max(...Array.from(pageRowCounts.keys()).filter(p => pageRowCounts[p] > 0));
  const totalPages = lastUsedPage + 1;

  // ── Create all pages ──────────────────────────────────────────────────────
  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage();
    if (p === 0) drawPageHeader();
    const tableTop = p === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
    drawTableHeader(tableTop);
  }

  // ── Holiday shading (opt-in from Print Preview) must sit UNDER the bars ────
  if (showHolidays) {
    const holidays = getHolidaysInRange(format(tMinMonth, "yyyy-MM-dd"), format(tMaxMonth, "yyyy-MM-dd"));
    if (holidays.length) {
      for (let p = 0; p < totalPages; p++) {
        const tableTop = p === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
        const top = tableTop + HDR_H;
        const bottom = top + (pageRowCounts[p] || 0) * effectiveRowH;
        doc.setPage(p + 1);
        holidays.forEach((iso) => {
          const parsed = parseISO(iso);
          if (!isValid(parsed)) return;
          const x = GANTT_X + differenceInDays(parsed, tMinMonth) * pxPerDay;
          if (x < GANTT_X || x > GANTT_X + GANTT_W) return;
          const width = Math.max(pxPerDay, 0.5);
          doc.setFillColor(250, 224, 226);              // pale red — survives printing
          doc.rect(x, top, width, bottom - top, "F");
          doc.setDrawColor(220, 53, 69);
          doc.setLineWidth(0.2);
          doc.line(x + width / 2, top, x + width / 2, bottom);
        });
      }
    }
  }

  // ── Draw rows ─────────────────────────────────────────────────────────────
  const barPositions = new Array(tasks.length).fill(null);
  // Batch 38 — positions for the printed staircase. Bars use their drawn geometry; a
  // milestone gets its own entry (the chart's staircase steps through milestones too,
  // because its bpMap treats a milestone as a one-day bar).
  const staircasePositions = new Array(tasks.length).fill(null);
  const hexToRgb = (hex) => {
    const h = (hex || "#333333").replace("#", "");
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  };

  // Batch 36 — the per-programme `showComparison` flag is NOT what hides the purple/brown
  // comparison bars: on screen the bars are drawn whenever the compared dates differ
  // (`hasBL`/`hasLate`/`hasEarly` in UnifiedGanttLayout) and that flag only drives the
  // comparison arrows between programmes. Batch 33 wrongly used it as a gate here, so an
  // imported programme (parsers set `showComparison: false` on every row) printed no
  // comparison bars at all while the chart showed them. The printed bars now follow the
  // Print Preview switch (`showComparisonBars`) and the date comparison — exactly the
  // screen's rule.
  tasks.forEach((task, idx) => {
    const pos = taskPageMap.get(idx);
    if (!pos) return;
    const { page, localRowIdx } = pos;
    const tableTop = page === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
    const rowY = tableTop + HDR_H + localRowIdx * effectiveRowH;

    doc.setPage(page + 1);

    if (task.isSection) {
      // WBS row colours — same source of truth as the on-screen table / chart
      const st = resolveWbsRowStyle(task, { group: grpStyle, wbs: wbsStyle }) || {};
      const bg = hexToRgbArray(st.bg || "#fff2ea");
      const textColor = hexToRgbArray(st.text || "#003531");
      doc.setFillColor(...bg);
      doc.rect(MARGIN, rowY, LEFT_W + GANTT_W, effectiveRowH, "F");
      doc.setFont("helvetica", st.fontStyle === "italic" ? "italic" : (Number(st.fontWeight) >= 700 ? "bold" : "normal"));
      doc.setFontSize(Math.max(4, effectiveRowH * 0.9 * fontScale));
      doc.setTextColor(...textColor);
      doc.text(sanitizePDFText(task.activity || ""), MARGIN + 2, rowY + effectiveRowH - 1.2);
      if (applyLineStyle(g.groupVisible, g.groupColor, g.groupWeight, g.groupStyle)) {
        doc.line(MARGIN, rowY + effectiveRowH, MARGIN + LEFT_W + GANTT_W, rowY + effectiveRowH);
      }
      resetLineStyle();
      return;
    }

    const isAlt = idx % 2 !== 0;
    doc.setFillColor(...(isAlt ? ROW_ALT : [255, 255, 255]));
    doc.rect(MARGIN, rowY, LEFT_W + GANTT_W, effectiveRowH, "F");

    months.forEach((m, mi) => {
      const mx = GANTT_X + mi * monW;
      // Year boundaries are the "major" divisions, every other month is "minor"
      const ok = m.getMonth() === 0
        ? applyLineStyle(g.timelineMajorVisible, g.timelineMajorColor, g.timelineMajorWeight, g.timelineMajorStyle)
        : applyLineStyle(g.timelineMinorVisible, g.timelineMinorColor, g.timelineMinorWeight, g.timelineMinorStyle);
      if (ok) doc.line(mx, rowY, mx, rowY + effectiveRowH);
    });
    resetLineStyle();

    // Vertical dividers between activity-list columns (off by default → previous look)
    if (g.colVisible) {
      applyLineStyle(true, g.colColor, g.colWeight, g.colStyle);
      const colWidths = [COL_ITEM, COL_ID, COL_ACT, COL_START, COL_END, COL_DUR, ...activeExtraFields.map(f => f.w)];
      let vx = MARGIN;
      colWidths.forEach(w => {
        vx += w;
        if (w > 0 && vx < GANTT_X) doc.line(vx, rowY, vx, rowY + effectiveRowH);
      });
      resetLineStyle();
    }

    if (applyLineStyle(g.rowVisible, g.rowColor, g.rowWeight, g.rowStyle)) {
      doc.line(MARGIN, rowY + effectiveRowH, MARGIN + LEFT_W + GANTT_W, rowY + effectiveRowH);
    }
    resetLineStyle();

    const textY = rowY + effectiveRowH - 1.2;
    const baseFontSize = Math.max(4, effectiveRowH * 0.85 * fontScale);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(baseFontSize);
    doc.setTextColor(...TEXT_DARK);

    let cx = MARGIN;

    // Helper function to fit text within column width
    const fitTextInCell = (text, cellWidth, align = "left") => {
      if (!text) return "";
      const sanitized = sanitizePDFText(text);
      let currentFontSize = baseFontSize;
      doc.setFontSize(currentFontSize);
      let textWidth = doc.getTextWidth(sanitized);
      
      // Batch 30: shrink the font until the WHOLE value fits (3.5pt floor) instead
      // of cutting it off with "..." — nothing is hidden in the PDF any more.
      while (textWidth > cellWidth - 2 && currentFontSize > 3.5) {
        currentFontSize = Math.max(3.5, currentFontSize - 0.25);
        doc.setFontSize(currentFontSize);
        textWidth = doc.getTextWidth(sanitized);
      }
      
      // (batch 30) no "...": the value is never truncated, only scaled down
      
      return sanitized;
    };

    if (COL_ITEM > 0) {
      const itemText = fitTextInCell(task._resolvedItem || task.customItem || "", COL_ITEM, "center");
      doc.text(itemText, cx + COL_ITEM / 2, textY, { align: "center" });
      cx += COL_ITEM;
    }

    if (COL_ID > 0) {
      const idText = fitTextInCell(task.activityId || "", COL_ID, "center");
      doc.setFontSize(Math.max(3.5, baseFontSize - 1));
      doc.setTextColor(3, 105, 161);
      doc.text(idText, cx + COL_ID / 2, textY, { align: "center" });
      doc.setFontSize(baseFontSize);
      doc.setTextColor(...TEXT_DARK);
      cx += COL_ID;
    }

    const actText = fitTextInCell(task.activity || "", COL_ACT, "left");
    doc.text(actText, cx + 1, textY);
    cx += COL_ACT;

    if (COL_START > 0) {
      const startText = fitTextInCell(formatDisplayDate(task.start, dateFormat), COL_START, "center");
      // Actual date: show in red with "A" indicator after the date
      if (task.startActual && task.start) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...RED);
        doc.text(startText + " A", cx + COL_START / 2, textY, { align: "center" });
      } else {
        doc.text(startText, cx + COL_START / 2, textY, { align: "center" });
      }
      cx += COL_START;
    }

    if (COL_END > 0) {
      const endText = fitTextInCell(formatDisplayDate(task.end, dateFormat), COL_END, "center");
      // Actual date: show in red with "A" indicator after the date
      if (task.endActual && task.end) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...RED);
        doc.text(endText + " A", cx + COL_END / 2, textY, { align: "center" });
      } else {
        doc.text(endText, cx + COL_END / 2, textY, { align: "center" });
      }
      cx += COL_END;
    }

    if (COL_DUR > 0) {
      const dur = (() => {
        try {
          const s = parseISO(task.start), e = parseISO(task.end);
          if (!isValid(s) || !isValid(e)) return "-";
          if (durMode === "cal") {
            const d = differenceInDays(e, s) + 1;
            return d > 0 ? String(d) : "-";
          }
          const wd = countWorkingDays(task.start, task.end);
          return wd > 0 ? String(wd) : "-";
        } catch {
          return "-";
        }
      })();
      const durText = fitTextInCell(dur, COL_DUR, "center");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...hexToRgbArray(task.barType === "delay" ? barStyle.delayColor : barStyle.baselineColor));
      doc.text(durText, cx + COL_DUR / 2, textY, { align: "center" });
      cx += COL_DUR;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_DARK);
    }

    // Extra fields - apply font fitting to each
    activeExtraFields.forEach(f => {
      const rawVal = DATE_COL_KEYS.has(f.colKey) ? formatDisplayDate(task[f.taskKey], dateFormat) : task[f.taskKey];
      const val = f.fmt(rawVal);
      const fittedVal = fitTextInCell(val, f.w, "center");
      doc.setFontSize(Math.max(3.5, baseFontSize - 1));
      const isBlCell = f.key === "blStart" || f.key === "blEnd";
      // Batch 36 — the chart's BL columns are brown (#733208), not purple.
      if (isBlCell) doc.setTextColor(...hexToRgbArray("#733208"));
      doc.text(fittedVal, cx + f.w / 2, textY, { align: "center" });
      cx += f.w;
      if (isBlCell) doc.setTextColor(...TEXT_DARK);
    });
    doc.setFontSize(baseFontSize);
    doc.setTextColor(...TEXT_DARK);

    // Draw bar with comparison (BL or Late) OR milestone
    // Batch 38 — the same row rules as the chart: a `deletedFromBL` row is positioned with
    // its BL dates (chart's bpMap does the same) and painted #dc3545, and it is never
    // treated as "critical".
    const isDeletedRow = !!task.deletedFromBL;
    const rowStart = task.start || (isDeletedRow ? task.baselineStart : null) || task.end;
    const rowEnd = task.end || (isDeletedRow ? task.baselineFinish : null) || task.start;
    const barColor = isDeletedRow ? hexToRgbArray("#dc3545")
      : task.barType === "delay" ? hexToRgbArray(barStyle.delayColor)
      : hexToRgbArray(barStyle.baselineColor);
    // Batch 36/39 — same brown as the chart (#733208) for the comparison bars and
    // milestones; see COMPARISON_BROWN.
    const COMPARISON_COLOR = COMPARISON_BROWN;
    const blVisible = columnVisibility?.blStart?.visible !== false || columnVisibility?.blEnd?.visible !== false;
    const lateVisible = columnVisibility?.lateStart?.visible !== false || columnVisibility?.lateEnd?.visible !== false;
    const earlyVisible = columnVisibility?.earlyStart?.visible !== false || columnVisibility?.earlyEnd?.visible !== false;
    const useLateAsComparison = lateVisible && !blVisible;
    const useEarlyAsComparison = earlyVisible && !blVisible && !lateVisible;
    const compStart = useLateAsComparison ? (task.lateStart || task.start) : useEarlyAsComparison ? (task.earlyStart || task.start) : task.baselineStart;
    const compEnd = useLateAsComparison ? (task.lateEnd || task.end) : useEarlyAsComparison ? (task.earlyEnd || task.end) : task.baselineFinish;
    const hasComparison = showComparisonBars && !isDeletedRow && compStart && compEnd && (compStart !== task.start || compEnd !== task.end);
    // Bar height follows the Gantt Settings (18px on the 27px screen row = 0.67)
    const barFraction = Math.min(0.9, Math.max(0.25, (barStyle.heightPx || 18) / 27));
    const barH = Math.max(0.8, effectiveRowH * barFraction);
    const HALF_H = barH / 2;
    const barTopBase = rowY + (effectiveRowH - barH) / 2;
    const isCriticalBar = !isDeletedRow && barStyle.critical.enabled && task.float != null && Number(task.float) <= 0;
    const barFill = isCriticalBar ? hexToRgbArray(barStyle.critical.color) : barColor;
    const barBorder = isCriticalBar ? barStyle.critical.borderColor : barStyle.borderColor;
    
    // Milestone detection: only start XOR only end
    const isStartMile = !!task.start && !task.end;
    const isFinishMile = !task.start && !!task.end;
    const isMilestone = isStartMile || isFinishMile;
    const mileDate = isStartMile ? task.start : task.end;
    
    if (isMilestone && mileDate) {
      const mileParsed = parseISO(mileDate);
      if (isValid(mileParsed)) {
        const mileX = GANTT_X + differenceInDays(mileParsed, tMinMonth) * pxPerDay;
        // Batch 38 — the chart's staircase steps through milestone rows as well, so give
        // the milestone a step position (its bpMap entry is bpos(start, start): one day).
        staircasePositions[idx] = { page, left: mileX, width: Math.max(pxPerDay, 0.5), top: barTopBase };
        const DS = Math.max(1.2, (barStyle.milestoneSize || 8) * 0.32); // half-size in mm
        const centerY = barTopBase + HALF_H;
        const shape = barStyle.milestoneShape || "diamond";

        // Draw milestone marker in the current shape (diamond | square | circle)
        doc.setFillColor(...barFill);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);

        // Diamond via 4 lines forming a rotated square
        const top = centerY - DS;
        const bottom = centerY + DS;
        const left = mileX - DS;
        const right = mileX + DS;

        if (shape === "circle" && doc.circle) {
          doc.circle(mileX, centerY, DS, "F");
        } else if (shape === "square") {
          doc.rect(left, top, DS * 2, DS * 2, "F");
          doc.rect(left, top, DS * 2, DS * 2, "S");
        } else {
          // Fill by drawing 2 triangles
          doc.triangle && doc.triangle(left, centerY, right, centerY, mileX, top, "F");
          doc.triangle && doc.triangle(left, centerY, right, centerY, mileX, bottom, "F");

          // If triangle not available, use simple rect
          if (!doc.triangle) {
            doc.rect(mileX - DS, centerY - DS, DS * 2, DS * 2, "F");
          }

          // Draw outline
          doc.setDrawColor(255, 255, 255);
          doc.line(left, centerY, mileX, top);
          doc.line(mileX, top, right, centerY);
          doc.line(right, centerY, mileX, bottom);
          doc.line(mileX, bottom, left, centerY);
        }
        
        // Draw comparison milestone (hollow purple diamond) if applicable
        const compMileDate = useLateAsComparison
          ? (isStartMile ? (task.lateStart || task.start) : (task.lateEnd || task.end))
          : useEarlyAsComparison
          ? (isStartMile ? (task.earlyStart || task.start) : (task.earlyEnd || task.end))
          : (isStartMile ? task.baselineStart : task.baselineFinish);
        const hasCompMile = showComparisonBars && !isDeletedRow && compMileDate && compMileDate !== mileDate;
        
        if (hasCompMile) {
          const compMileParsed = parseISO(compMileDate);
          if (isValid(compMileParsed)) {
            const compMileX = GANTT_X + differenceInDays(compMileParsed, tMinMonth) * pxPerDay;
            doc.setDrawColor(...COMPARISON_COLOR); // hollow brown marker, like the chart
            doc.setLineWidth(0.5);
            // Hollow marker in the configured shape
            if (shape === "circle" && doc.circle) {
              doc.circle(compMileX, centerY, DS, "S");
            } else if (shape === "square") {
              doc.rect(compMileX - DS, centerY - DS, DS * 2, DS * 2, "S");
            } else {
              doc.line(compMileX - DS, centerY, compMileX, centerY - DS);
              doc.line(compMileX, centerY - DS, compMileX + DS, centerY);
              doc.line(compMileX + DS, centerY, compMileX, centerY + DS);
              doc.line(compMileX, centerY + DS, compMileX - DS, centerY);
            }
          }
        }
      }
    } else if (rowStart && rowEnd) {
      const s = parseISO(rowStart), e = parseISO(rowEnd);
      if (isValid(s) && isValid(e) && e >= s) {
        const barLeft = GANTT_X + differenceInDays(s, tMinMonth) * pxPerDay;
        const barWidth = Math.max((differenceInDays(e, s) + 1) * pxPerDay, 1);
        
        if (hasComparison) {
          // Draw comparison bar (top half)
          const cs = parseISO(compStart), ce = parseISO(compEnd);
          if (isValid(cs) && isValid(ce) && ce >= cs) {
            const compBarLeft = GANTT_X + differenceInDays(cs, tMinMonth) * pxPerDay;
            const compBarWidth = Math.max((differenceInDays(ce, cs) + 1) * pxPerDay, 1);
            doc.setFillColor(...COMPARISON_COLOR); // brown #733208, same as the chart
            doc.rect(compBarLeft, barTopBase, compBarWidth, HALF_H, "F");
          }
          // Draw current bar (bottom half)
          drawBar(barLeft, barTopBase + HALF_H, barWidth, HALF_H, barFill, barBorder);
        } else {
          // Draw full bar (no comparison)
          drawBar(barLeft, barTopBase, barWidth, barH, barFill, barBorder);
        }
        
        barPositions[idx] = { left: barLeft, width: barWidth, top: barTopBase, height: HALF_H * 2, page };

        // ── Bar Info (batch 28) — the xerviewer.org switches ──────────────────
        // Only drawn when a Bar Info switch is actually on, so an export that
        // never touched that section stays byte-identical. Text matches the
        // on-screen chart exactly (same helper): Labels field + name/dates.
        // Batch 29: position (inside / before / after), font family (mapped to the
        // closest jsPDF core font), size and both colours come from the panel.
        if (hasBarInfo(barStyle)) {
          const caption = buildBarTextParts(task, barStyle, dateFormat);
          const labelPos = normalizeBarTextPosition(barStyle.label?.position);
          const baseline = barTopBase + barH / 2 + 1.1;
          doc.setFont(pdfCoreFontFor(barStyle.label?.fontFamily), "normal");
          doc.setFontSize(Math.max(4, (barStyle.label?.fontSize || 10) * 0.75));
          const widthOf = (t) => (typeof doc.getTextWidth === "function" ? doc.getTextWidth(t) : t.length * 1.2);
          const fitsInside = barWidth >= widthOf(caption.main) + 2.4;
          // Batch 32: with both dates on, the main caption sits inside (when it fits)
          // or on its Position side; the two dates always take the bar's front/back.
          const mainSide = !caption.main ? null
            : (labelPos === "inside" && fitsInside) ? "inside"
            : labelPos === "before" ? "front" : "back";

          if (mainSide === "inside") {
            doc.setTextColor(...hexToRgbArray(barStyle.label?.color || "#ffffff"));
            doc.text(sanitizePDFText(caption.main), barLeft + 1.2, baseline);
          }
          doc.setTextColor(...hexToRgbArray(barStyle.label?.colorOutside || "#333333"));
          // In front of the bar (right-aligned against its left edge): caption then date.
          let frontX = barLeft - 1.5;
          if (caption.front) {
            doc.text(sanitizePDFText(caption.front), frontX, baseline, { align: "right" });
            frontX -= widthOf(caption.front) + 2;
          }
          if (mainSide === "front") doc.text(sanitizePDFText(caption.main), frontX, baseline, { align: "right" });
          // Behind the bar: date then caption.
          let backX = barLeft + barWidth + 1.5;
          if (caption.back) {
            doc.text(sanitizePDFText(caption.back), backX, baseline);
            backX += widthOf(caption.back) + 2;
          }
          if (mainSide === "back") doc.text(sanitizePDFText(caption.main), backX, baseline);

          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "normal");
        }
      }
    }
  });

  // ── Print content (batch 26): today line, staircase, relationship arrows ──
  // Everything below is opt-in from the Print Preview, uses the bar geometry
  // recorded while drawing, and is drawn on top of the bars.
  const dateToX = (iso) => {
    const parsed = parseISO(iso);
    if (!isValid(parsed)) return null;
    return GANTT_X + differenceInDays(parsed, tMinMonth) * pxPerDay;
  };
  const rowYOf = (idx) => {
    const pos = taskPageMap.get(idx);
    if (!pos) return null;
    const tableTop = pos.page === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
    return { page: pos.page, y: tableTop + HDR_H + pos.localRowIdx * effectiveRowH };
  };

  if (showToday) {
    const todayX = dateToX(format(new Date(), "yyyy-MM-dd"));
    if (todayX != null && todayX >= GANTT_X && todayX <= GANTT_X + GANTT_W) {
      for (let p = 0; p < totalPages; p++) {
        const tableTop = p === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
        const bottom = tableTop + HDR_H + (pageRowCounts[p] || 0) * effectiveRowH;
        doc.setPage(p + 1);
        doc.setDrawColor(220, 53, 69);
        doc.setLineWidth(0.35);
        doc.line(todayX, tableTop + HDR_H, todayX, bottom);
      }
    }
  }

  if (showRecalcDate && recalcDate) {
    // Mirrors the on-screen "Last Recalc Date" line (UnifiedGanttLayout): a dashed
    // orange data-date line with a small label, so it can never be mistaken for
    // the solid red today line. Drawn only when the date falls inside the range.
    const recalcX = dateToX(recalcDate);
    if (recalcX != null && recalcX >= GANTT_X && recalcX <= GANTT_X + GANTT_W) {
      const label = `Last Recalc ${recalcDate}`;
      for (let p = 0; p < totalPages; p++) {
        const tableTop = p === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
        const top = tableTop + HDR_H;
        const bottom = top + (pageRowCounts[p] || 0) * effectiveRowH;
        doc.setPage(p + 1);
        doc.setDrawColor(232, 130, 25);
        doc.setLineWidth(0.5);
        if (typeof doc.setLineDashPattern === "function") doc.setLineDashPattern(...pdfDashPattern("dashed"));
        doc.line(recalcX, top, recalcX, bottom);
        resetLineStyle();
        // Label on a small plate so it stays readable over any bar.
        doc.setFontSize(5.5);
        const textW = typeof doc.getTextWidth === "function" ? doc.getTextWidth(label) : label.length * 1.0;
        doc.setFillColor(255, 249, 241);
        doc.rect(recalcX + 0.8, top - 0.4, Math.min(textW + 1.6, GANTT_X + GANTT_W - recalcX - 1), 3.4, "F");
        doc.setTextColor(232, 130, 25);
        doc.text(label, recalcX + 1.6, top + 2);
      }
      doc.setTextColor(0, 0, 0);
    }
  }

  // Batch 38/39 — the programme groups (chart rule) are shared by the printed staircase
  // and by the printed comparison arrows.
  const staircaseGroups = (showStaircase || showComparisonArrows)
    ? collectStaircaseSteps(tasks, (idx) => barPositions[idx] || staircasePositions[idx], staircaseFilterIds)
    : [];

  if (showStaircase) {
    // Mirrors the on-screen "Staircase Line" exactly (UnifiedGanttLayout):
    //   · the line hugs the TOP edge of each bar (not the row centre),
    //   · it only moves right (bars that finish behind the running maximum are skipped),
    //   · it ends with a short tail dropping half a row below the last point,
    //   · stroke width 2 px on a 27 px row, scaled to the printed row height.
    //
    // Batch 35 — two multi-page bugs:
    //   · jsPDF writes setDrawColor / setLineWidth into the page that is current *when
    //     they are called*. Setting them once before the loop therefore painted exactly
    //     one page red (the page that happened to be current) and left the others in the
    //     PDF default state — thin black, which reads as grey at preview zoom. The style
    //     is now applied after every setPage().
    //   · steps used to be dropped as soon as the row moved to the next page, so a
    //     programme crossing a page break lost the rest of its staircase. Steps now carry
    //     their page and the running maximum is carried over the break.
    //
    // Batch 38 — which rows take part is now the chart's rule (see collectStaircaseSteps):
    // milestones count, `deletedFromBL` rows count, a leading group without a section
    // counts, and the BulkEditBar "Staircase filter" restricts the rows.
    const programmes = staircaseGroups;
    const applyStaircaseStyle = () => {
      // A stale dash pattern from the grid / recalc line must never reach the staircase
      // (a dashed red line reads grey as well).
      resetLineStyle();
      doc.setDrawColor(220, 53, 69);
      // Width: 2 px on a 27 px row (same proportion as the screen), but never below 1 mm.
      // Measured at 66 dpi (what the preview panel shows) a 0.6 mm line was roughly half
      // anti-aliasing and read as grey; 1 mm keeps a solid red core at every zoom level.
      doc.setLineWidth(Math.min(1.2, Math.max(1.0, (effectiveRowH * 2) / 27)));
    };
    programmes.forEach((programme) => {
      const first = programme.steps[0];
      let page = first.page;
      let reach = first.right;
      let currentY = first.top;
      doc.setPage(page + 1);
      applyStaircaseStyle();
      doc.line(first.left, currentY, reach, currentY);
      for (let i = 1; i < programme.steps.length; i += 1) {
        const step = programme.steps[i];
        if (step.page !== page) {
          // Page break: continue the running maximum from the chart's left edge.
          page = step.page;
          doc.setPage(page + 1);
          applyStaircaseStyle();
          doc.line(GANTT_X, currentY, Math.max(reach, GANTT_X), currentY);
        }
        if (step.right < reach) continue;                 // a bar hidden behind the line
        doc.line(reach, currentY, reach, step.top);       // step down to the next bar top
        doc.line(reach, step.top, step.right, step.top);  // run along that bar's top
        reach = step.right;
        currentY = step.top;
      }
      doc.line(reach, currentY, reach, currentY + effectiveRowH / 2);   // closing tail
    });
  }

  if (showComparisonArrows) {
    // Mirrors the chart's "Comparison Arrows" (UnifiedGanttLayout ▸ the `cmp-*` group):
    //   · one arrow per adjacent pair of programmes whose Compare flag is on,
    //   · x1/x2 = the programme's right-most bar edge (`gex`), i.e. its finish,
    //   · dashed #733208 verticals at both finishes, a diamond at each, a double-headed
    //     arrow between them on the SECOND programme's section row, and a white label with
    //     the difference in days — working days or calendar days (Dur mode), like the chart
    //     (`|differenceInDays| + 1` for calendar, `countWorkingDays` for working).
    const rowScale = effectiveRowH / 27;               // same scale the bars/staircase use
    const lineW = Math.max(0.3, 1.5 * rowScale);
    const diamond = Math.max(1.2, 5 * rowScale);
    const headSize = Math.max(1.2, 5 * rowScale);
    const labelW = Math.max(14, 80 * rowScale);
    const labelH = Math.max(4.5, 20 * rowScale);
    const applyArrowStyle = () => {
      resetLineStyle();
      doc.setDrawColor(...COMPARISON_BROWN);
      doc.setLineWidth(lineW);
      if (typeof doc.setLineDashPattern === "function") {
        // the chart's `strokeDasharray="5,3"`, in mm
        doc.setLineDashPattern([Math.max(1.2, 5 * rowScale), Math.max(0.8, 3 * rowScale)], 0);
      }
    };
    const finishOf = (programme) => programme.steps.reduce((latest, step) => {
      const d = step.finish ? parseISO(step.finish) : null;
      return d && isValid(d) && (!latest || d > latest) ? d : latest;
    }, null);

    for (let i = 0; i < staircaseGroups.length - 1; i += 1) {
      const a = staircaseGroups[i];
      const b = staircaseGroups[i + 1];
      if (a.showComparison === false || b.showComparison === false) continue;
      const x1 = Math.max(...a.steps.map((s) => s.right));
      const x2 = Math.max(...b.steps.map((s) => s.right));
      const d1 = finishOf(a);
      const d2 = finishOf(b);
      if (!d1 || !d2) continue;
      const earlier = d1 < d2 ? d1 : d2;
      const later = d1 < d2 ? d2 : d1;
      const diffCal = differenceInDays(later, earlier) + 1;
      const diffWd = countWorkingDays(format(earlier, "yyyy-MM-dd"), format(later, "yyyy-MM-dd"));
      const value = durMode === "wd" ? diffWd : diffCal;
      const unit = durMode === "wd" ? "WD" : "Cal";
      const lx = Math.min(x1, x2);
      const rx = Math.max(x1, x2);

      // Dashed verticals down every page's chart area (the chart draws them over all rows)
      for (let p = 0; p < totalPages; p += 1) {
        const tableTop = p === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
        const top = tableTop + HDR_H;
        const bottom = top + (pageRowCounts[p] || 0) * effectiveRowH;
        doc.setPage(p + 1);
        applyArrowStyle();
        doc.line(x1, top, x1, bottom);
        doc.line(x2, top, x2, bottom);
        resetLineStyle();
      }

      // Arrow + label on the second programme's section row
      const sectionRow = b.sectionIdx != null ? rowYOf(b.sectionIdx) : null;
      const arrowPage = sectionRow ? sectionRow.page : (b.steps[0].page || 0);
      const tableTop = arrowPage === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
      const ay = (sectionRow ? sectionRow.y : tableTop + HDR_H) + effectiveRowH / 2;
      doc.setPage(arrowPage + 1);
      applyArrowStyle();
      doc.line(lx, ay, rx, ay);                      // the measured span itself
      resetLineStyle();
      doc.setFillColor(...COMPARISON_BROWN);
      // Diamonds on both finishes (the chart's 4-point diamond = two triangles)
      doc.triangle(x1, ay - diamond, x1, ay + diamond, x1 + diamond, ay, "F");
      doc.triangle(x1, ay - diamond, x1, ay + diamond, x1 - diamond, ay, "F");
      doc.triangle(x2, ay - diamond, x2, ay + diamond, x2 + diamond, ay, "F");
      doc.triangle(x2, ay - diamond, x2, ay + diamond, x2 - diamond, ay, "F");
      // Arrowheads pointing outwards, like the chart's `ah()` polygons
      doc.triangle(lx, ay, lx + headSize, ay - headSize / 2, lx + headSize, ay + headSize / 2, "F");
      doc.triangle(rx, ay, rx - headSize, ay - headSize / 2, rx - headSize, ay + headSize / 2, "F");
      // Label plate with the day difference
      const labX = lx + (rx - lx) / 2 - labelW / 2;
      const labY = ay - labelH / 2;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...COMPARISON_BROWN);
      doc.setLineWidth(lineW);
      if (typeof doc.roundedRect === "function") doc.roundedRect(labX, labY, labelW, labelH, 0.8, 0.8, "FD");
      else doc.rect(labX, labY, labelW, labelH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(5.5, 11 * 0.75));
      doc.setTextColor(...COMPARISON_BROWN);
      doc.text(`${value} ${unit}`, labX + labelW / 2, labY + labelH * 0.66, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
    }
  }

  if (showRelationshipLines) {
    const REL_COLORS = { FS: [0, 90, 83], SS: [0, 53, 49], FF: [115, 50, 8], SF: [232, 130, 25] };
    const lookup = new Map();
    tasks.forEach((task, idx) => {
      if (task.isSection) return;
      const geom = barPositions[idx];
      const row = rowYOf(idx);
      if (geom && row) lookup.set(task.id, { geom, row, task });
    });
    const arrow = (fromX, fromY, toX, toY, colour) => {
      const elbowX = toX >= fromX ? fromX + 2 : fromX - 2;
      doc.setDrawColor(...colour);
      doc.setLineWidth(0.45);                 // visible at preview zoom (was 0.3)
      doc.line(fromX, fromY, elbowX, fromY);
      doc.line(elbowX, fromY, elbowX, toY);
      doc.line(elbowX, toY, toX, toY);
      const size = 1.1;
      const goingRight = toX >= elbowX;
      doc.setFillColor(...colour);
      if (goingRight) doc.triangle(toX, toY, toX - size, toY - size / 2, toX - size, toY + size / 2, "F");
      else doc.triangle(toX, toY, toX + size, toY - size / 2, toX + size, toY + size / 2, "F");
    };
    const seen = new Set();
    lookup.forEach(({ task, row, geom }) => {
      const rels = [];
      if (Array.isArray(task.links)) {
        task.links.forEach((link) => rels.push({ succId: link.succId, type: link.type || "FS" }));
      }
      if (task.link != null && !(Array.isArray(task.links) && task.links.some((l) => Number(l.succId) === Number(task.link)))) {
        rels.push({ succId: task.link, type: task.linkType || "FS" });
      }
      rels.forEach((rel) => {
        const succ = lookup.get(rel.succId) || lookup.get(Number(rel.succId)) || lookup.get(String(rel.succId));
        if (!succ) return;
        if (succ.row.page !== row.page) return;                 // cross-page links are not drawn
        const key = `${task.id}-${rel.succId}-${rel.type}`;
        if (seen.has(key)) return;
        seen.add(key);
        const predY = row.y + effectiveRowH / 2;
        const succY = succ.row.y + effectiveRowH / 2;
        const type = rel.type || "FS";
        const colour = REL_COLORS[type] || REL_COLORS.FS;
        const fromX = (type === "FS" || type === "FF") ? geom.left + geom.width : geom.left;
        const toX = (type === "FS" || type === "SS") ? succ.geom.left : succ.geom.left + succ.geom.width;
        doc.setPage(row.page + 1);
        arrow(fromX, predY, toX, succY, colour);
      });
    });
  }

  // ── Outer borders ─────────────────────────────────────────────────────────
  for (let p = 0; p < totalPages; p++) {
    doc.setPage(p + 1);
    const tableTop = p === 0 ? TABLE_TOP_FIRST : TABLE_TOP_CONT;
    const rowsOnPage = pageRowCounts[p] || 0;
    const tableBottom = tableTop + HDR_H + rowsOnPage * effectiveRowH;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.4);
    doc.rect(MARGIN, tableTop, LEFT_W + GANTT_W, HDR_H + rowsOnPage * effectiveRowH);
  }

  // ── Footer (optional): {page} / {pages} placeholders ──────────────────────
  if (FOOTER_H) {
    const fill = (t, p) => String(t || "")
      .replace(/\{page\}/gi, String(p))
      .replace(/\{pages\}/gi, String(totalPages));
    for (let p = 0; p < totalPages; p++) {
      doc.setPage(p + 1);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_DARK);
      const fy = PAGE_H - MARGIN + 4;
      const tableRight = MARGIN + LEFT_W + GANTT_W;
      if (footerLeft)   doc.text(sanitizePDFText(fill(footerLeft, p + 1)),   MARGIN, fy);
      if (footerCenter) doc.text(sanitizePDFText(fill(footerCenter, p + 1)), (MARGIN + tableRight) / 2, fy, { align: "center" });
      if (footerRight)  doc.text(sanitizePDFText(fill(footerRight, p + 1)),  tableRight, fy, { align: "right" });
    }
  }

  // Batch 45 — the CJK flag is module state (the build is synchronous), so clear it here.
  unicodeFontActive = false;

  return {
    doc,
    filename: `${projectTitle || "Gantt"}.pdf`,
    pageCount: typeof doc.internal.getNumberOfPages === "function"
      ? doc.internal.getNumberOfPages()
      : totalPages,
  };
}

/**
 * Build the PDF and immediately download it.
 * Kept as the public entry point so every existing caller behaves exactly as before.
 */
export async function exportGanttPDF(options = {}) {
  const { tasks, embedData: given, ...rest } = options;
  // Batch 12: a PDF must never leave this module without the re-import marker,
  // so this legacy entry point embeds the full task array too.
  const embedData = given ?? (Array.isArray(tasks) && tasks.length ? await encodeTasksForPDF(tasks) : null);
  const { doc, filename } = buildGanttPDF({ ...rest, tasks, embedData });
  doc.save(filename);
  return { doc, filename };
}