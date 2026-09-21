import { jsPDF } from "jspdf";
import { parseISO, isValid, differenceInDays, addDays, addMonths, startOfMonth, format, eachMonthOfInterval } from "date-fns";
import { countWorkingDays } from "@/lib/hkWorkingDays";
import {
  DEFAULT_DISPLAY_SETTINGS,
  formatDisplayDate,
  pdfDashPattern,
  hexToRgbArray,
  resolveWbsRowStyle,
} from "@/lib/displaySettings";

const BAR_COLOR = [41, 128, 185];
const DELAY_COLOR = [34, 197, 94];
const HEADER_BG = [240, 240, 240];
const GRID_LINE = [200, 200, 200];
const TEXT_DARK = [30, 30, 30];
const ROW_ALT = [248, 250, 252];
const RED = [239, 68, 68];

function sanitizePDFText(str) {
  if (!str) return "";
  return str
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u2023\u25E6\u2043]/g, '*')
    .replace(/[^\x00-\xFF]/g, '?');
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
  barLabelSide = "right", textColors = {}, showStaircase = true, 
  columnVisibility = null,
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
}) {
  const g = { ...DEFAULT_DISPLAY_SETTINGS.grid, ...(grid || {}) };
  const grpStyle = { ...DEFAULT_DISPLAY_SETTINGS.group, ...(group || {}) };
  const wbsStyle = { ...DEFAULT_DISPLAY_SETTINGS.wbs, ...(wbs || {}) };
  const barStyle = { ...DEFAULT_DISPLAY_SETTINGS.bar, ...(bar || {}) };
  barStyle.critical = { ...DEFAULT_DISPLAY_SETTINGS.bar.critical, ...((bar || {}).critical || {}) };
  const doc = new jsPDF({ orientation, unit: "mm", format: paperSize });
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

  // ── Draw rows ─────────────────────────────────────────────────────────────
  const barPositions = new Array(tasks.length).fill(null);
  const hexToRgb = (hex) => {
    const h = (hex || "#333333").replace("#", "");
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  };

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
      
      // Reduce font size if text is too wide (max 20% reduction)
      while (textWidth > cellWidth - 2 && currentFontSize > baseFontSize * 0.8) {
        currentFontSize -= 0.5;
        doc.setFontSize(currentFontSize);
        textWidth = doc.getTextWidth(sanitized);
      }
      
      // If still too wide, truncate with ellipsis
      if (textWidth > cellWidth - 2) {
        let truncated = sanitized;
        while (truncated.length > 3 && doc.getTextWidth(truncated + "...") > cellWidth - 2) {
          truncated = truncated.slice(0, -1);
        }
        return truncated + "...";
      }
      
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
      const isBlPurple = f.key === "blStart" || f.key === "blEnd";
      if (isBlPurple) doc.setTextColor(124, 58, 237);
      doc.text(fittedVal, cx + f.w / 2, textY, { align: "center" });
      cx += f.w;
      if (isBlPurple) doc.setTextColor(...TEXT_DARK);
    });
    doc.setFontSize(baseFontSize);
    doc.setTextColor(...TEXT_DARK);

    // Draw bar with comparison (BL or Late) OR milestone
    const barColor = task.barType === "delay" ? hexToRgbArray(barStyle.delayColor) : hexToRgbArray(barStyle.baselineColor);
    const COMPARISON_COLOR = [124, 58, 237]; // Purple for BL/Late
    const blVisible = columnVisibility?.blStart?.visible !== false || columnVisibility?.blEnd?.visible !== false;
    const lateVisible = columnVisibility?.lateStart?.visible !== false || columnVisibility?.lateEnd?.visible !== false;
    const earlyVisible = columnVisibility?.earlyStart?.visible !== false || columnVisibility?.earlyEnd?.visible !== false;
    const useLateAsComparison = lateVisible && !blVisible;
    const useEarlyAsComparison = earlyVisible && !blVisible && !lateVisible;
    const compStart = useLateAsComparison ? (task.lateStart || task.start) : useEarlyAsComparison ? (task.earlyStart || task.start) : task.baselineStart;
    const compEnd = useLateAsComparison ? (task.lateEnd || task.end) : useEarlyAsComparison ? (task.earlyEnd || task.end) : task.baselineFinish;
    const hasComparison = compStart && compEnd && (compStart !== task.start || compEnd !== task.end);
    // Bar height follows the Gantt Settings (18px on the 27px screen row = 0.67)
    const barFraction = Math.min(0.9, Math.max(0.25, (barStyle.heightPx || 18) / 27));
    const barH = Math.max(0.8, effectiveRowH * barFraction);
    const HALF_H = barH / 2;
    const barTopBase = rowY + (effectiveRowH - barH) / 2;
    const isCriticalBar = barStyle.critical.enabled && task.float != null && Number(task.float) <= 0;
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
        const hasCompMile = compMileDate && compMileDate !== mileDate;
        
        if (hasCompMile) {
          const compMileParsed = parseISO(compMileDate);
          if (isValid(compMileParsed)) {
            const compMileX = GANTT_X + differenceInDays(compMileParsed, tMinMonth) * pxPerDay;
            doc.setDrawColor(...COMPARISON_COLOR); // Purple
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
    } else if (task.start && task.end) {
      const s = parseISO(task.start), e = parseISO(task.end);
      if (isValid(s) && isValid(e) && e >= s) {
        const barLeft = GANTT_X + differenceInDays(s, tMinMonth) * pxPerDay;
        const barWidth = Math.max((differenceInDays(e, s) + 1) * pxPerDay, 1);
        
        if (hasComparison) {
          // Draw comparison bar (top half)
          const cs = parseISO(compStart), ce = parseISO(compEnd);
          if (isValid(cs) && isValid(ce) && ce >= cs) {
            const compBarLeft = GANTT_X + differenceInDays(cs, tMinMonth) * pxPerDay;
            const compBarWidth = Math.max((differenceInDays(ce, cs) + 1) * pxPerDay, 1);
            doc.setFillColor(...COMPARISON_COLOR); // Purple for BL/Late
            doc.rect(compBarLeft, barTopBase, compBarWidth, HALF_H, "F");
          }
          // Draw current bar (bottom half)
          drawBar(barLeft, barTopBase + HALF_H, barWidth, HALF_H, barFill, barBorder);
        } else {
          // Draw full bar (no comparison)
          drawBar(barLeft, barTopBase, barWidth, barH, barFill, barBorder);
        }
        
        barPositions[idx] = { left: barLeft, width: barWidth, top: barTopBase, height: HALF_H * 2, page };
      }
    }
  });

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
export function exportGanttPDF(options) {
  const { doc, filename } = buildGanttPDF(options);
  doc.save(filename);
  return { doc, filename };
}