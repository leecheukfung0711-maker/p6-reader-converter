/**
 * Shared display settings for the on-screen Gantt (table + timeline) and the PDF export.
 *
 * Everything here is ADDITIVE: the defaults reproduce the previous fixed behaviour, so
 * the app looks and behaves exactly as before until the user changes a control.
 *
 * Persisted in localStorage under "gantt_display_settings".
 */
import { format, parseISO, isValid, differenceInDays } from "date-fns";

export const DATE_FORMATS = [
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD" },
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY" },
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY" },
  { value: "dd-MMM-yy",  label: "DD-MMM-YY"  },
];

export const LINE_STYLES = [
  { value: "solid",  label: "Solid"  },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

export const DEFAULT_DISPLAY_SETTINGS = {
  dateFormat: "yyyy-MM-dd",
  grid: {
    // Activity list body (defaults reproduce the previous fixed 1px #cecece look on screen)
    rowVisible:   true, rowColor:   "#cecece", rowWeight:   1, rowStyle:   "solid",
    // Vertical dividers between activity-list columns (also drawn in the PDF)
    colVisible:   true, colColor:  "#cecece", colWeight:   1, colStyle:   "solid",
    // Section / group header rows
    groupVisible: true, groupColor: "#003531", groupWeight: 1, groupStyle: "solid",
    // Timeline: year boundaries = major, month boundaries = minor
    // (colours/weights chosen so the PDF output is unchanged by default)
    timelineMajorVisible: true, timelineMajorColor: "#cecece", timelineMajorWeight: 0.4, timelineMajorStyle: "solid",
    timelineMinorVisible: true, timelineMinorColor: "#cecece", timelineMinorWeight: 0.4, timelineMinorStyle: "solid",
  },
  // ── Gantt bar appearance (defaults = the previous hard-coded look) ────────
  bar: {
    heightPx: 18,
    cornerRadius: 2,
    borderWidth: 0,
    borderColor: "#003531",
    borderStyle: "solid",
    baselineColor: "#005a53",
    delayColor: "#e88219",
    milestoneShape: "diamond",     // diamond | square | circle
    milestoneSize: 8,
    shadow: false,
    shadowColor: "#6c757d",
    shadowBlur: 4,
    shadowOffsetY: 2,
    critical: { enabled: false, color: "#dc3545", borderColor: "#733208", borderWidth: 1 },
    // label = the bar caption: content (Labels tab) + how it looks (Bar Info ▸ Text style)
    label: {
      show: true, field: "item",
      position: "inside",          // inside | before (left of the bar) | after (right of it)
      fontSize: 10, color: "#ffffff",
      colorOutside: "#333333",     // used when the text sits before/after the bar
      fontFamily: "inherit",       // CSS stack, or "inherit" = System Default
      minWidth: 50,
    },
    // ── Bar Info (batch 28) — xerviewer.org's "Gantt Bar Info" switches.
    // All off by default so nothing changes until they are turned on.
    info: { showName: false, showStart: false, showFinish: false },
  },
  // ── Programme structure: group (section) header styling ───────────────────
  group: {
    fontSize: 12, fontWeight: 700, indent: 0,
    blueBg: "#005a53", blueText: "#ffffff",
    pinkBg: "#733208", pinkText: "#ffffff",
  },
  // ── Customise Grouping (batch 19, modelled on the XER Viewer panel) ───────
  // Rows of { id, groupBy, toLevel, enabled } where toLevel = "all" | 1..7.
  // Only "wbs" can be grouped today (the XER/Excel importers create the WBS
  // rows), which is why the panel disables "+ Add New Grouping Header" exactly
  // like the reference site does.
  grouping: defaultGrouping(),

  // ── WBS rows (batch 8): colour each WBS level differently ─────────────────
  // schemeId "classic" keeps the previous blue/pink programme-header look.
  // `levels` = 7 per-level styles [{ bg, text, fontFamily, fontSize, fontWeight }]
  // (null while "classic" is selected). Modelled on the XER Viewer "WBS Settings" panel.
  wbs: {
    schemeId: "classic",
    levels: null,
    hideEmpty: true,          // hide WBS rows that contain no activities
    groupHeadersOnGantt: true, // draw the section label inside the timeline area
    // Batch 23A: indent WBS rows one step per level so a deeper level is visible
    // even before its colour is noticed. Turn off in WBS Settings to keep the
    // pre-batch-23 (colour-only) look.
    indentByLevel: true,
  },
  // ── Focus mode: dim everything that is not part of the selected chain ─────
  focus: { enabled: false, dim: 0.35 },
};

/** Bar appearance presets (ids follow the XER Viewer preset list where they overlap). */
export const BAR_PRESETS = [
  { id: "default", name: "Current (Default)", bar: {
      heightPx: 18, cornerRadius: 2, borderWidth: 0, borderColor: "#003531", borderStyle: "solid",
      baselineColor: "#005a53", delayColor: "#e88219", milestoneShape: "diamond", milestoneSize: 8, shadow: false } },
  { id: "primavera", name: "Primavera Classic", bar: {
      heightPx: 14, cornerRadius: 0, borderWidth: 1, borderColor: "#003531", borderStyle: "solid",
      baselineColor: "#005a53", delayColor: "#e88219", milestoneShape: "diamond", milestoneSize: 7, shadow: false } },
  { id: "modern", name: "Modern Rounded", bar: {
      heightPx: 16, cornerRadius: 8, borderWidth: 0, borderStyle: "solid",
      baselineColor: "#005a53", delayColor: "#e88219", milestoneShape: "circle", milestoneSize: 7, shadow: true,
      shadowColor: "#6c757d", shadowBlur: 5, shadowOffsetY: 2 } },
  { id: "classic", name: "Classic Square", bar: {
      heightPx: 18, cornerRadius: 0, borderWidth: 1, borderColor: "#003531", borderStyle: "solid",
      baselineColor: "#005a53", delayColor: "#005a53", milestoneShape: "square", milestoneSize: 7, shadow: false } },
  { id: "sharp", name: "Sharp Geometric", bar: {
      heightPx: 12, cornerRadius: 0, borderWidth: 2, borderColor: "#333333", borderStyle: "solid",
      baselineColor: "#005a53", delayColor: "#e88219", milestoneShape: "square", milestoneSize: 6, shadow: false } },
  { id: "gray", name: "Professional Gray", bar: {
      heightPx: 16, cornerRadius: 3, borderWidth: 1, borderColor: "#6c757d", borderStyle: "solid",
      baselineColor: "#6c757d", delayColor: "#b15315", milestoneShape: "diamond", milestoneSize: 7, shadow: false } },
  { id: "sunny", name: "Sunny Orange Rounded", bar: {
      heightPx: 17, cornerRadius: 6, borderWidth: 0, borderStyle: "solid",
      baselineColor: "#e88219", delayColor: "#e88219", milestoneShape: "circle", milestoneSize: 8, shadow: true,
      shadowColor: "#e88219", shadowBlur: 6, shadowOffsetY: 2 } },
];

export const BAR_LABEL_FIELDS = [
  { value: "none",       label: "None" },
  { value: "item",       label: "Item (A1, B2…)" },
  { value: "activityId", label: "Activity ID" },
  { value: "activity",   label: "Activity Name" },
  { value: "start",      label: "Start date" },
  { value: "finish",     label: "Finish date" },
  { value: "duration",   label: "Duration (days)" },
];

/**
 * Bar Info (batch 28) — xerviewer.org's "Gantt Bar Info" block: three
 * independent switches, all off by default. `id` matches the reference markup
 * so the panel and the tests can be traced straight back to it.
 */
export const BAR_INFO_TOGGLES = [
  { key: "showName",   id: "ganttbar-shownames",      label: "Show Names on Bars" },
  { key: "showStart",  id: "ganttbar-showstartdate",  label: "Show Start Date on Bars" },
  { key: "showFinish", id: "ganttbar-showfinishdate", label: "Show Finish Date on Bars" },
];

/** Text for one "Labels" tab field; "" when that field is not shown. */
function labelFieldText(task, bar, dateFormat) {
  if (!bar?.label?.show) return "";
  switch (bar.label.field) {
    case "item":       return task?._resolvedItem || task?.item || task?.customItem || "";
    case "activityId": return task?.activityId || "";
    case "activity":   return task?.activity || "";
    case "start":      return formatDisplayDate(task?.start, dateFormat);
    case "finish":     return formatDisplayDate(task?.end, dateFormat);
    case "duration":   return (task?.start && task?.end)
      ? `${differenceInDays(parseISO(task.end), parseISO(task.start)) + 1}d` : "";
    default:           return "";
  }
}

/**
 * The text written on a bar — shared by the on-screen chart and the PDF, so both
 * show exactly the same thing (WYSIWYG).
 *
 *   · the "Labels" tab field first (only when that switch is on),
 *   · then every enabled "Bar Info" part (name / start / finish),
 *   · de-duplicated and joined with " · " (an Item code plus the name reads
 *     "A1 · Excavate", never "Excavate · Excavate").
 *
 * Returns "" when nothing should be shown — i.e. with the defaults only the
 * label field (Item) is on, exactly as before this batch.
 */
export function buildBarText(task, bar, dateFormat = "yyyy-MM-dd") {
  const parts = [];
  const push = (value) => {
    const s = String(value ?? "").trim();
    if (s && !parts.includes(s)) parts.push(s);
  };
  push(labelFieldText(task, bar, dateFormat));
  const info = bar?.info || {};
  if (info.showName)   push(task?.activity);
  if (info.showStart)  push(formatDisplayDate(task?.start, dateFormat));
  if (info.showFinish) push(formatDisplayDate(task?.end, dateFormat));
  return parts.join(" · ");
}

/** True when any Bar Info switch is on (used by the PDF to stay byte-identical
 *  for exports that never touched the Bar Info section). */
export function hasBarInfo(bar) {
  const info = bar?.info || {};
  return Boolean(info.showName || info.showStart || info.showFinish);
}

/**
 * Split the bar caption into its three slots (batch 32).
 *
 * When **both** date switches are on, the two dates are shown apart instead of
 * inside one caption line: the start date in front of (left of) the bar and the
 * finish date behind (right of) it, with the rest of the caption — name, item
 * code, … — still following the Position setting:
 *
 *     2026-09-01   [=== Excavate ===]   2026-11-06
 *        front            bar              back
 *
 * With only one (or neither) date switch on, the whole caption stays together in
 * `main` exactly as before this batch.
 *
 * @returns {{ front: string, main: string, back: string, split: boolean }}
 */
export function buildBarTextParts(task, bar, dateFormat = "yyyy-MM-dd") {
  const info = bar?.info || {};
  const split = Boolean(info.showStart && info.showFinish);
  if (!split) return { front: "", main: buildBarText(task, bar, dateFormat), back: "", split: false };

  const start = formatDisplayDate(task?.start, dateFormat);
  const finish = formatDisplayDate(task?.end, dateFormat);
  // Main caption without the two dates (the label field may still add its own
  // value); a duplicate of a split date is dropped by the callers.
  const withoutDates = { ...bar, info: { ...info, showStart: false, showFinish: false } };
  let main = buildBarText(task, withoutDates, dateFormat);
  if (main === start || main === finish) main = "";
  return { front: start, main, back: finish, split: true };
}

/**
 * Where the bar caption is drawn (batch 29):
 *   inside — on the bar itself        before — in front of / left of the bar
 *   after  — behind / right of the bar
 * The legacy value "right" (from the first Labels tab) means "after".
 */
export const BAR_TEXT_POSITIONS = [
  { value: "inside", label: "Inside the bar" },
  { value: "before", label: "Before the bar (left)" },
  { value: "after",  label: "After the bar (right)" },
];

/** Normalise a stored position value → "inside" | "before" | "after". */
export function normalizeBarTextPosition(position) {
  const p = String(position || "").toLowerCase();
  if (p === "before" || p === "left" || p === "front") return "before";
  if (p === "after" || p === "right" || p === "back" || p === "rear") return "after";
  return "inside";
}

/** CSS font-family stack for a stored setting ("inherit" → undefined = use the app font). */
export function barTextFontFamilyCss(fontFamily) {
  const f = String(fontFamily || "").trim();
  return !f || f === "inherit" ? undefined : f;
}

/**
 * jsPDF only ships the four core font families, so a CSS stack is mapped onto the
 * closest one (documented in the panel hint): mono → courier, serif → times,
 * everything else → helvetica.
 */
export function pdfCoreFontFor(fontFamily) {
  const f = String(fontFamily || "").toLowerCase();
  if (!f || f === "inherit") return "helvetica";
  if (/mono/.test(f)) return "courier";
  if (/serif/.test(f) && !/sans-serif/.test(f)) return "times";
  return "helvetica";
}

// ── Text measurement (batch 30) ──────────────────────────────────────────────
// Nothing on the chart may be cut off with "…" any more, so the bar captions and
// the table cells have to know how wide a piece of text actually is. A canvas
// gives exact glyph widths in the browser; where there is no canvas (SSR / tests)
// a per-character estimate is used. Results are cached — a 600-row chart measures
// thousands of strings per render.
let _measureCtx = null;
let _measureUnavailable = false;
const _measureCache = new Map();
const _CJK = /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff01-\uff60\uffe0-\uffe6]/;

/** Rough advance width of one character, relative to the font size. */
function estimateCharWidth(ch, fontSizePx) {
  if (_CJK.test(ch)) return fontSizePx;            // full-width glyphs ≈ 1 em
  if (" .,:;'|!i[]()·".includes(ch)) return fontSizePx * 0.33;
  if (/[A-Z0-9]/.test(ch)) return fontSizePx * 0.62;
  return fontSizePx * 0.55;
}

/** Width of `text` in px at the given size/family (canvas-backed when available). */
export function measureTextWidth(text, fontSizePx = 10, fontFamily = "") {
  const str = String(text ?? "");
  if (!str) return 0;
  const size = Number(fontSizePx) || 10;
  const key = `${size}|${fontFamily}|${str}`;
  const cached = _measureCache.get(key);
  if (cached !== undefined) return cached;

  let width = null;
  if (!_measureUnavailable && typeof document !== "undefined") {
    try {
      if (!_measureCtx) {
        const canvas = document.createElement("canvas");
        _measureCtx = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
        if (!_measureCtx) _measureUnavailable = true;
      }
      if (_measureCtx) {
        _measureCtx.font = `${size}px ${fontFamily || "sans-serif"}`;
        width = _measureCtx.measureText(str).width;
      }
    } catch {
      _measureUnavailable = true;
    }
  }
  if (width == null || !Number.isFinite(width) || width <= 0) {
    width = 0;
    for (const ch of str) width += estimateCharWidth(ch, size);
  }
  if (_measureCache.size > 8000) _measureCache.clear();
  _measureCache.set(key, width);
  return width;
}

/** Does `text` fit into `maxWidthPx` at the given size? */
export function textFits(text, maxWidthPx, fontSizePx = 10, fontFamily = "") {
  return measureTextWidth(text, fontSizePx, fontFamily) <= maxWidthPx;
}

/**
 * Largest font size (never below `minPx`) at which the whole `text` still fits —
 * the screen counterpart of the PDF's shrink-to-fit, so long values are shown in
 * full instead of ending in "…".
 */
export function fitFontSizeToWidth(text, maxWidthPx, basePx = 10, fontFamily = "", minPx = 7) {
  const base = Number(basePx) || 10;
  if (!text || maxWidthPx <= 0) return base;
  let size = base;
  while (size > minPx && measureTextWidth(text, size, fontFamily) > maxWidthPx) {
    size = Math.max(minPx, size - 0.5);
  }
  return Number(size.toFixed(1));
}

export const MILESTONE_SHAPES = [
  { value: "diamond", label: "Diamond" },
  { value: "square",  label: "Square" },
  { value: "circle",  label: "Circle" },
];

export const GROUP_FONT_SIZES = [
  { value: "10", label: "10 px" },
  { value: "11", label: "11 px" },
  { value: "12", label: "12 px" },
  { value: "13", label: "13 px" },
  { value: "14", label: "14 px" },
];

export const GROUP_FONT_WEIGHTS = [
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra bold" },
];

const STORAGE_KEY = "gantt_display_settings";

function cloneDefaults() {
  const d = DEFAULT_DISPLAY_SETTINGS;
  return {
    ...d,
    grid: { ...d.grid },
    bar: { ...d.bar, critical: { ...d.bar.critical }, label: { ...d.bar.label }, info: { ...d.bar.info } },
    group: { ...d.group },
    wbs: { ...d.wbs, levels: d.wbs.levels ? d.wbs.levels.map(l => ({ ...l })) : null },
    grouping: cloneGrouping(d.grouping),
    focus: { ...d.focus },
  };
}

/** Merge a (possibly partial / older) saved settings object with the defaults. */
export function mergeDisplaySettings(parsed) {
  if (!parsed || typeof parsed !== "object") return cloneDefaults();
  const d = DEFAULT_DISPLAY_SETTINGS;
  const pBar = parsed.bar || {};
  const bar = { ...d.bar, ...pBar };
  bar.critical = { ...d.bar.critical, ...(pBar.critical || {}) };
  bar.label = { ...d.bar.label, ...(pBar.label || {}) };
  bar.info = { ...d.bar.info, ...(pBar.info || {}) };   // batch 28 — Bar Info switches
  // WBS: keep a customised level list only when it is a valid array
  const pWbs = parsed.wbs || {};
  const wbs = { ...d.wbs, ...pWbs };
  wbs.levels = Array.isArray(pWbs.levels) && pWbs.levels.length
    ? pWbs.levels.map(l => ({ ...l }))
    : null;
  if (wbs.schemeId !== "classic" && !wbs.levels) wbs.levels = levelStylesFromScheme(wbs.schemeId);
  return {
    ...d, ...parsed,
    grid: { ...d.grid, ...(parsed.grid || {}) },
    bar,
    group: { ...d.group, ...(parsed.group || {}) },
    wbs,
    // Customise Grouping: keep saved rows when they are valid, else the default.
    grouping: cloneGrouping(parsed.grouping),
    focus: { ...d.focus, ...(parsed.focus || {}) },
  };
}

export function loadDisplaySettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    return mergeDisplaySettings(JSON.parse(raw));
  } catch {
    return cloneDefaults();
  }
}

export function saveDisplaySettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore quota / private mode */ }
}

/**
 * ISO date (or any parseable date string) → formatted string.
 * Falls back to the raw value when it is not a valid date, and keeps the previous
 * behaviour (raw ISO) for the default format.
 */
export function formatDisplayDate(value, dateFormat = "yyyy-MM-dd") {
  if (!value) return "";
  const s = String(value);
  if (!dateFormat || dateFormat === "yyyy-MM-dd") return s.slice(0, 10);
  const iso = s.length > 10 ? s.slice(0, 10) : s;
  const d = parseISO(iso);
  return isValid(d) ? format(d, dateFormat) : s;
}

/** CSS border shorthand for a grid-line block */
export function cssGridBorder(visible, weight, style, color) {
  if (!visible) return "none";
  return `${weight}px ${style} ${color}`;
}

/** jsPDF dash pattern for a line style */
export function pdfDashPattern(style) {
  if (style === "dashed") return [[1.6, 1.2], 0];
  if (style === "dotted") return [[0.3, 1.1], 0];
  return [[], 0];
}

/** "#rrggbb" → [r, g, b] (safe fallback) */
export function hexToRgbArray(hex, fallback = [120, 120, 120]) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return fallback;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b].some(Number.isNaN) ? fallback : [r, g, b];
}

// ─────────────────────────────────────────────────────────────────────────────
// WBS row colours (batch 8)
//
// Each scheme is defined by 3 swatches (level 1, level 4, level 7) exactly as in
// the XER Viewer "WBS Settings" panel; the 7 level colours are generated by
// interpolating in HSL, which reproduces the reference within 1-2/255
// (Cool Blues → #005a53 #005a53 #6c757d #6c757d #6c757d #f7f7f7 #f7f7f7).
// ─────────────────────────────────────────────────────────────────────────────
export const WBS_LEVEL_COUNT = 7;

export const WBS_COLOR_SCHEMES = [
  { id: "classic",           name: "Current (Blue / Pink)", swatches: ["#fff2ea", "#ffffff", "#733208"], legacy: true },
  { id: "neutral-grays",     name: "Neutral Grays",     swatches: ["#6c757d", "#cecece", "#f7f7f7"] },
  { id: "cool-blues",        name: "Cool Blues",        swatches: ["#005a53", "#6c757d", "#f7f7f7"] },
  { id: "forest-greens",     name: "Forest Greens",     swatches: ["#005a53", "#6c757d", "#f7f7f7"] },
  { id: "warm-tones",        name: "Warm Tones",        swatches: ["#b15315", "#e88219", "#f7f7f7"] },
  { id: "red-autumn",        name: "Red Autumn",        swatches: ["#733208", "#b15315", "#f7f7f7"] },
  { id: "ocean-blue",        name: "Ocean Blue",        swatches: ["#005a53", "#6c757d", "#f7f7f7"] },
  { id: "candy-shop",        name: "Candy Shop",        swatches: ["#733208", "#e88219", "#fff2ea"] },
  { id: "deep-wood",         name: "Deep Wood",         swatches: ["#005a53", "#f7f7f7", "#f7f7f7"] },
  { id: "lilac-wine",        name: "Lilac Wine",        swatches: ["#733208", "#b15315", "#fff2ea"] },
  { id: "first-love",        name: "First Love",        swatches: ["#dc3545", "#dc3545", "#f7f7f7"] },
  { id: "earth-brown",       name: "Earth Brown",       swatches: ["#733208", "#b15315", "#fff2ea"] },
  { id: "grayscale",         name: "Grayscale",         swatches: ["#6c757d", "#cecece", "#f7f7f7"] },
  { id: "primavera-classic", name: "Primavera Classic", swatches: ["#005a53", "#005a53", "#e88219"] },
  { id: "print-friendly",    name: "Print Friendly",    swatches: ["#ffffff", "#ffffff", "#ffffff"] },
];

export const WBS_FONT_FAMILIES = [
  { value: "inherit", label: "System Default" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "'Century Gothic', Arial, sans-serif", label: "Century Gothic" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Courier New', Courier, monospace", label: "Courier New" },
  { value: "'Comic Sans MS', 'Comic Sans', cursive", label: "Comic Sans MS" },
  { value: "Segoe UI, Arial, sans-serif", label: "Segoe UI" },
  { value: "Calibri, Candara, Segoe, sans-serif", label: "Calibri" },
  { value: "Garamond, Baskerville, serif", label: "Garamond" },
  { value: "'Fira Sans', Arial, sans-serif", label: "Fira Sans" },
  { value: "Ubuntu, Arial, sans-serif", label: "Ubuntu" },
  { value: "'Trebuchet MS', Arial, sans-serif", label: "Trebuchet MS" },
  { value: "Monaco, Consolas, monospace", label: "Monaco" },
];

export const WBS_FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20].map(v => ({ value: String(v), label: `${v} px` }));
export const WBS_FONT_WEIGHTS = [
  { value: "normal", label: "Normal" },
  { value: "bold",   label: "Bold" },
  { value: "italic", label: "Italic" },
];

// ── Colour maths (HSL interpolation reproduces the reference level colours) ──
function rgbToHsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

function toHex6(rgb) {
  return "#" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

/** HSL interpolation between two "#rrggbb" colours, t = 0..1 */
export function mixHexColors(a, b, t) {
  const [r1, g1, b1] = hexToRgbArray(a, [255, 255, 255]);
  const [r2, g2, b2] = hexToRgbArray(b, [255, 255, 255]);
  const [h1, s1, l1] = rgbToHsl(r1, g1, b1);
  const [h2, s2, l2] = rgbToHsl(r2, g2, b2);
  let dh = h2 - h1;                       // shortest way around the hue circle
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  return toHex6(hslToRgb((h1 + dh * t + 1) % 1, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t));
}

/**
 * 3 scheme swatches (L1 / L4 / L7) → the 7 level colours for WBS levels 1-7.
 * Levels deeper than 7 reuse the lightest colour (level 7).
 */
export function expandSchemeColors(swatches) {
  const [a, b, c] = Array.isArray(swatches) && swatches.length >= 3 ? swatches : ["#fff2ea", "#ffffff", "#733208"];
  return [
    a,
    mixHexColors(a, b, 1 / 3),
    mixHexColors(a, b, 2 / 3),
    b,
    mixHexColors(b, c, 1 / 3),
    mixHexColors(b, c, 2 / 3),
    c,
  ];
}

/** Readable text colour for a row background — matches the reference picks (#f7f7f7 / #003531). */
export function wbsTextColorFor(hex) {
  const [r, g, b] = hexToRgbArray(hex, [255, 255, 255]);
  const toLinear = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#333333" : "#ffffff";
}

/** Scheme id → the 7 editable level styles (null for the "classic" blue/pink scheme). */
export function levelStylesFromScheme(schemeId) {
  const scheme = WBS_COLOR_SCHEMES.find(s => s.id === schemeId);
  if (!scheme || scheme.legacy) return null;
  return expandSchemeColors(scheme.swatches).map(bg => ({
    bg, text: wbsTextColorFor(bg), fontFamily: "inherit", fontSize: null, fontWeight: "bold",
  }));
}

/**
 * Resolve the row style of a section (WBS) row — shared by the activity table,
 * the Gantt chart labels and the PDF export so all three stay in sync.
 *
 * @returns {null|{bg:string,text:string,fontWeight:number,fontStyle:string,fontFamily:string|null,fontSize:number}}
 */
export function resolveWbsRowStyle(task, displaySettings) {
  if (!task || !task.isSection) return null;
  const d = displaySettings || DEFAULT_DISPLAY_SETTINGS;
  const grp = { ...DEFAULT_DISPLAY_SETTINGS.group, ...(d.group || {}) };
  const wbs = { ...DEFAULT_DISPLAY_SETTINGS.wbs, ...(d.wbs || {}) };
  const isBlue = (task.sectionType || "blue") === "blue";

  // Legacy blue / pink look — also the fallback for any missing value
  const s = {
    bg: isBlue ? grp.blueBg : grp.pinkBg,
    text: isBlue ? grp.blueText : grp.pinkText,
    fontWeight: Number(grp.fontWeight) || 700,
    fontStyle: "normal",
    fontFamily: null,
    fontSize: Number(grp.fontSize) || 12,
  };
  if (task.sectionBg) s.bg = task.sectionBg;
  if (task.sectionText) s.text = task.sectionText;

  if (wbs.schemeId === "classic" || !Array.isArray(wbs.levels) || !wbs.levels.length) return s;

  const level = Math.min(Math.max(Number(task.sectionLevel) || 1, 1), WBS_LEVEL_COUNT);
  const l = wbs.levels[level - 1] || {};
  const bg = task.sectionBg || l.bg || s.bg;
  const weight = l.fontWeight || "bold";
  return {
    bg,
    text: task.sectionText || l.text || wbsTextColorFor(bg),
    fontWeight: weight === "bold" ? 700 : 400,
    fontStyle: weight === "italic" ? "italic" : "normal",
    fontFamily: l.fontFamily && l.fontFamily !== "inherit" ? l.fontFamily : null,
    fontSize: l.fontSize ? Number(l.fontSize) : s.fontSize,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  Customise Grouping (batch 19) — XER Viewer "Customise Grouping" parity
//  Reference layout: Group By | To Level | Status  +  "+ Add New Grouping Header"
//  Only WBS grouping exists in this app (the WBS rows are produced by the
//  XER / Excel importers), so "Group By" has a single option and the add button
//  stays disabled — exactly like the reference panel.
// ══════════════════════════════════════════════════════════════════════════

/** "To Level" choices for a grouping row. */
export const WBS_GROUP_LEVELS = [
  { value: "all", label: "All Levels" },
  ...Array.from({ length: WBS_LEVEL_COUNT }, (_, i) => ({ value: i + 1, label: `Level ${i + 1}` })),
];

/** "Group By" choices (only WBS is supported today). */
export const GROUP_BY_OPTIONS = [{ value: "wbs", label: "WBS" }];

/**
 * "To Level" choices for the CURRENT data — exactly like the reference panel,
 * which builds its options from the file's deepest WBS level (`All Levels` +
 * `Level 1..maxLevel`). With a flat WBS that means few (or one) options instead
 * of the misleading fixed 1..7 list.
 */
export function wbsLevelOptions(maxLevel) {
  const max = Math.max(1, Math.min(WBS_LEVEL_COUNT, Number(maxLevel) || 1));
  return [
    { value: "all", label: "All Levels" },
    ...Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `Level ${i + 1}` })),
  ];
}

/**
 * How many WBS group headers exist per level (for the panel's level inventory,
 * so it is obvious what "To Level" can actually change).
 * Returns { counts: {level: n}, maxLevel, levelList }.
 */
export function wbsLevelCounts(tasks) {
  const counts = {};
  (Array.isArray(tasks) ? tasks : []).forEach(t => {
    if (!t?.isSection) return;
    const lvl = Number(t.sectionLevel) || 1;
    counts[lvl] = (counts[lvl] || 0) + 1;
  });
  const levelList = Object.keys(counts).map(Number).sort((a, b) => a - b);
  return { counts, maxLevel: levelList.length ? levelList[levelList.length - 1] : 1, levelList };
}

/** How many group headers a "To Level" selection keeps (for the panel hint). */
export function wbsVisibleGroupCount(counts, toLevel) {
  const c = counts || {};
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  if (toLevel === "all" || toLevel === undefined || toLevel === null) return total;
  const max = Number(toLevel);
  if (!Number.isFinite(max)) return total;
  return Object.entries(c).reduce((acc, [level, n]) => (Number(level) <= max ? acc + n : acc), 0);
}

/** The default grouping rows (one enabled WBS row showing every level). */
export function defaultGrouping() {
  return [{ id: "wbs", groupBy: "wbs", toLevel: "all", enabled: true }];
}

/** Normalise / deep-copy grouping rows (falls back to the default row). */
export function cloneGrouping(list) {
  const src = Array.isArray(list) && list.length ? list : defaultGrouping();
  return src.map((g, i) => ({
    id: g?.id || `g${i}`,
    groupBy: g?.groupBy || "wbs",
    toLevel: g?.toLevel ?? "all",
    enabled: g?.enabled !== false,
  }));
}

/**
 * Apply "Customise Grouping" to the task list (WBS only).
 *   · row disabled      → every WBS group header disappears (flat activity list)
 *   · To Level = 1..7   → keep only the group headers down to that level
 *   · To Level = "all"  → keep them all (default behaviour)
 * Activity rows are never touched, so the schedule itself is unaffected.
 */
export function applyWbsGrouping(tasks, grouping) {
  const list = Array.isArray(tasks) ? tasks : [];
  const rows = Array.isArray(grouping) ? grouping : [];
  const row = rows.find(g => (g?.groupBy || "wbs") === "wbs");
  if (!row) return list;
  if (row.enabled === false) return list.filter(t => !t.isSection);
  const toLevel = row.toLevel ?? "all";
  if (toLevel === "all") return list;
  const max = Number(toLevel);
  if (!Number.isFinite(max)) return list;
  return list.filter(t => !t.isSection || (Number(t.sectionLevel) || 1) <= max);
}
