import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Settings2, Link2, Wand2, Loader2, Plus, Trash2, Download, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, FileDown, FileText, FileSpreadsheet, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { buildGanttPDF } from "@/lib/exportGanttPDF";
import { encodeTasksForPDF } from "@/lib/ganttPDFData";
import PdfPreviewDialog from "@/components/gantt/PdfPreviewDialog";
import { buildXER, P6_VERSIONS } from "@/lib/exportXER";
import { buildP6XML } from "@/lib/exportP6XML";
import { loadMapping } from "@/components/gantt/XerMappingDialog";
import { parseISO, isValid, format } from "date-fns";
import { normalizeRecalcDate } from "@/lib/quickFilters";
import { DATE_FORMATS, LINE_STYLES } from "@/lib/displaySettings";
import { loadCjkFont, cjkFontBase64, programmeNeedsCjk, CJK_FONT_NAME } from "@/lib/cjkFont";
import * as XLSX from "xlsx";

const STORAGE_KEY = "gantt_export_settings";
const PAGE_SETUP_KEY = "gantt_pdf_page_setup";

function loadPageSetup() {
  try {
    return JSON.parse(localStorage.getItem(PAGE_SETUP_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadSavedSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load export settings:", e);
  }
  return null;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save export settings:", e);
  }
}

/**
 * Batch 34 — "Comparison bars" now default to OFF on paper (the chart draws them whenever
 * the compared dates differ). Settings saved before that change contain an explicit `true`
 * that merely came from the old default, so it is dropped once;
 * from the next save on (printOptionsVersion 2) the user's own choice is preserved.
 */
export const PRINT_OPTIONS_VERSION = 2;

export function migratePrintOptions(savedPrint = {}, savedVersion = 1) {
  if (savedVersion >= PRINT_OPTIONS_VERSION) return { ...savedPrint };
  const rest = { ...savedPrint };
  delete rest.showComparisonBars;          // came from the old "on" default
  return rest;
}

/**
 * The printed "Comparison bars" switch also flips the programmes' `showComparison` flag
 * (Display ▸ Comparison Arrows), and the preview rebuild needs the new value right away:
 * React state is not applied yet when the rebuild runs.
 */
export function withComparisonFlag(tasks, value) {
  return (tasks || []).map((t) => (t.isSection ? { ...t, showComparison: !!value } : t));
}

// ── Relationship helpers ──────────────────────────────────────────────────────
const REL_TYPES = ["Finish to Start", "Start to Start", "Finish to Finish", "Start to Finish"];
const REL_SHORT = { "Finish to Start": "FS", "Start to Start": "SS", "Finish to Finish": "FF", "Start to Finish": "SF" };
const REL_COLORS = {
  "Finish to Start": "bg-surface-subtle text-primary border-primary",
  "Start to Start":  "bg-surface-subtle text-success border-success",
  "Finish to Finish":"bg-surface-subtle text-primary border-primary",
  "Start to Finish": "bg-table-header text-accent-selected border-accent-accessible",
};

function parseActivitiesFromXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  const activities = [];
  doc.querySelectorAll("Activity").forEach(act => {
    const get = (tag) => act.querySelector(tag)?.textContent?.trim() || "";
    activities.push({ objectId: get("ObjectId"), id: get("Id"), name: get("Name"), startDate: get("StartDate") || get("PlannedStartDate"), finishDate: get("FinishDate") || get("PlannedFinishDate") });
  });
  return activities;
}

function parseRelationshipsFromXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  const rels = [];
  doc.querySelectorAll("Relationship").forEach(rel => {
    const get = (tag) => rel.querySelector(tag)?.textContent?.trim() || "";
    rels.push({ objectId: get("ObjectId"), predObjId: get("PredecessorActivityObjectId"), succObjId: get("SuccessorActivityObjectId"), type: get("Type"), lag: get("Lag") || "0" });
  });
  return rels;
}

function injectRelationshipsIntoXML(xmlText, newRels, existingRels, activities) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return xmlText;
  const actObjByCode = {};
  activities.forEach(a => { actObjByCode[a.id] = a.objectId; });
  let maxRelId = Math.max(0, ...existingRels.map(r => parseInt(r.objectId) || 0));
  const projects = doc.querySelectorAll("Project");
  if (!projects.length) return xmlText;
  const project = projects[0];
  project.querySelectorAll("Relationship").forEach(r => r.remove());
  const projObjId = project.querySelector("ObjectId")?.textContent?.trim() || "5844";
  const ns = "http://xmlns.oracle.com/Primavera/P6Professional/V22.12/API/BusinessObjects";
  const xsi = "http://www.w3.org/2001/XMLSchema-instance";
  const makeRelNode = (rel, objId) => {
    const el = doc.createElementNS(ns, "Relationship");
    const c = (tag, val, isNil = false) => { const child = doc.createElementNS(ns, tag); if (isNil) child.setAttributeNS(xsi, "xsi:nil", "true"); else child.textContent = val; el.appendChild(child); };
    c("Comments", "", true); c("Lag", rel.lag || "0"); c("ObjectId", String(objId));
    c("PredecessorActivityObjectId", rel.predObjId); c("PredecessorProjectObjectId", projObjId);
    c("SuccessorActivityObjectId", rel.succObjId); c("SuccessorProjectObjectId", projObjId);
    c("Type", rel.type);
    return el;
  };
  const scheduleOptions = project.querySelector("ScheduleOptions");
  const allRels = [...existingRels, ...newRels.map((r, i) => ({ ...r, predObjId: actObjByCode[r.predId] || r.predId, succObjId: actObjByCode[r.succId] || r.succId, objectId: String(maxRelId + i + 1) }))];
  allRels.forEach((rel, i) => { const node = makeRelNode(rel, rel.objectId || (maxRelId + i + 1)); if (scheduleOptions) project.insertBefore(node, scheduleOptions); else project.appendChild(node); });
  const serializer = new XMLSerializer();
  return '<?xml version="1.0" encoding="utf-8"?>\n' + serializer.serializeToString(doc).replace(/^<\?xml[^>]*\?>/, "").trim();
}

export default function ExportDialog({ tasks, projectTitle, labelOffsets = {}, durMode = "wd", columnVisibilityProp = null, displaySettings = null, onDisplaySettingsChange = null, xerSource = null, recalcDate = "", staircaseFilterIds = null, onToggleComparisonBars = null, onClose, onOpenXerMapping }) {
  const [mode, setMode] = useState("pdf"); // "pdf" | "excel" | "xer" | "xml" | "rel"
  const [excelType, setExcelType] = useState("gantt"); // "gantt" | "p6"

  // ── Shared on-screen display settings (date format + grid lines) ──────────
  const ds = displaySettings || {};
  const dsGrid = ds.grid || {};
  const updateDisplay = (patch) => { if (onDisplaySettingsChange) onDisplaySettingsChange({ ...ds, ...patch }); };
  const updateGrid = (patch) => updateDisplay({ grid: { ...dsGrid, ...patch } });

  // ── PDF page setup (persisted separately, defaults = previous behaviour) ──
  const savedPage = useMemo(loadPageSetup, []);
  const [paperSize, setPaperSize] = useState(savedPage.paperSize || "a3");
  const [orientation, setOrientation] = useState(savedPage.orientation || "landscape");
  const [pdfMargin, setPdfMargin] = useState(typeof savedPage.margin === "number" ? savedPage.margin : 8);
  const [footerLeft, setFooterLeft] = useState(savedPage.footerLeft || "");
  const [footerCenter, setFooterCenter] = useState(savedPage.footerCenter || "");
  const [footerRight, setFooterRight] = useState(savedPage.footerRight || "");

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_SETUP_KEY, JSON.stringify({
        paperSize, orientation, margin: pdfMargin, footerLeft, footerCenter, footerRight,
      }));
    } catch { /* ignore */ }
  }, [paperSize, orientation, pdfMargin, footerLeft, footerCenter, footerRight]);

  // columnVisibility is passed directly from parent - no caching, always uses latest state

  // Relationship editor state
  const [relXmlSource, setRelXmlSource] = useState(null);
  const [relXmlText, setRelXmlText] = useState("");
  const [relActivities, setRelActivities] = useState([]);
  const [relExisting, setRelExisting] = useState([]);
  const [relNew, setRelNew] = useState([]);
  const [relAiPrompt, setRelAiPrompt] = useState("");
  const [relAiLoading, setRelAiLoading] = useState(false);
  const [relAiError, setRelAiError] = useState("");
  const [relManualPred, setRelManualPred] = useState("");
  const [relManualSucc, setRelManualSucc] = useState("");
  const [relManualType, setRelManualType] = useState("Finish to Start");
  const [relManualLag, setRelManualLag] = useState("0");
  const relFileRef = useRef();
  
  // Load saved settings on mount
  const savedSettings = loadSavedSettings();

  // PDF state — sync programmeRef with projectTitle prop
  const [companyName, setCompanyName] = useState(savedSettings?.pdf?.companyName || "Chun Wo Construction and Engineering Company Ltd.");
  const [programmeRef, setProgrammeRef] = useState(projectTitle || "Programme");
  
  // Sync programmeRef when projectTitle prop changes (e.g., after import)
  useEffect(() => {
    setProgrammeRef(projectTitle || "Programme");
  }, [projectTitle]);
  const [subtitle, setSubtitle] = useState(savedSettings?.pdf?.subtitle || "As-planned Impacted (Delay Analysis)");
  const [fitOnePage, setFitOnePage] = useState(savedSettings?.pdf?.fitOnePage || false);
  const [fontScale, setFontScale] = useState(savedSettings?.pdf?.fontScale || 1.2);
  const [barLabel, setBarLabel] = useState(savedSettings?.pdf?.barLabel || "none"); // "none"|"item"|"activityId"|"activity"
  const [barLabelSide, setBarLabelSide] = useState(savedSettings?.pdf?.barLabelSide || "right"); // "left"|"right"

  const [showTextColors, setShowTextColors] = useState(false);
  const [textColors, setTextColors] = useState(savedSettings?.pdf?.textColors || {
    activityText: "#333333",   // main activity text
    activityId:   "#005a53",   // ID column
    dateText:     "#333333",   // start/end dates
    barLabelText: "#333333",   // label after bar
    sectionBlue:  "#ffffff",   // blue section header text
    sectionPink:  "#ffffff",   // pink section header text
  });
  const setColor = (key, val) => setTextColors(p => ({ ...p, [key]: val }));
  const [useCustomRange, setUseCustomRange] = useState(savedSettings?.pdf?.useCustomRange || false);
  const [customStart, setCustomStart] = useState(savedSettings?.pdf?.customStart || "");
  const [customEnd, setCustomEnd] = useState(savedSettings?.pdf?.customEnd || "");
  // ── Print content (batch 26): what else goes on the paper, chosen in the
  //    Print Preview. Every option defaults to OFF — batch 34 flipped "Comparison
  //    bars" from on to off, because the purple baseline bars are an exception view
  //    and the printed sheet should show the current programme only unless asked.
  const [printOptions, setPrintOptions] = useState(() => ({
    showHolidays: false, showToday: false, showStaircase: false,
    showRelationshipLines: false, showComparisonBars: false,
    // Batch 39 — the chart's comparison arrows (finish-date difference between programmes)
    showComparisonArrows: false,
    // Batch 45 — embed the CJK font so Chinese prints as real text (only fetched when the
    // programme actually contains non-Latin text, see the effect below).
    embedCjkFont: true,
    showRecalcDate: false,          // batch 27 — the programme's data date line
    ...migratePrintOptions(savedSettings?.pdf?.printOptions, savedSettings?.pdf?.printOptionsVersion),
  }));

  // Batch 45 — CJK font state ("idle" | "loading" | "ready" | "error") + lazy loading.
  const [cjkFont, setCjkFont] = useState(() => cjkFontBase64());
  const [cjkStatus, setCjkStatus] = useState(() => (cjkFontBase64() ? "ready" : "idle"));

  // XER state
  const today = new Date().toISOString().slice(0, 10);
  const earliestDate = useMemo(() => {
    const dates = tasks.filter(t => !t.isSection && t.start).map(t => t.start);
    if (!dates.length) return today;
    return dates.reduce((a, b) => a < b ? a : b);
  }, [tasks]);
  const [version, setVersion] = useState(savedSettings?.xer?.version || "15.1");
  // When the programme came from an XER, seed the project fields from it so the defaults
  // reproduce the original file (the pass-through export writes them back unchanged).
  const srcProjRow = (xerSource && xerSource.PROJECT && xerSource.PROJECT[0]) || null;
  const srcRootWbs = (xerSource && xerSource.PROJWBS || []).find(r => r.proj_node_flag === "Y") || null;
  const [projectId, setProjectId] = useState(srcProjRow?.proj_short_name || savedSettings?.xer?.projectId || "PROJ001");
  const [xerProjectName, setXerProjectName] = useState(srcRootWbs?.wbs_name || savedSettings?.xer?.projectName || "Exported Project");
  const [calendarName, setCalendarName] = useState(savedSettings?.xer?.calendarName || "Standard");
  const [exportDate, setExportDate] = useState(() => (
    // Batch 27: the data date set in the app (right-click a date column) is what
    // the exported record should carry — the XER/XML file's own value is the fallback.
    normalizeRecalcDate(recalcDate)
    || srcProjRow?.last_recalc_date?.slice(0, 10)
    || earliestDate || savedSettings?.xer?.exportDate || today
  ));

  // Auto date range from tasks
  const autoRange = useMemo(() => {
    const validTasks = tasks.filter((t) => !t.isSection && t.start && t.end);
    if (!validTasks.length) return { min: "", max: "" };
    const starts = validTasks.map((t) => parseISO(t.start)).filter(isValid);
    const ends = validTasks.map((t) => parseISO(t.end)).filter(isValid);
    return {
      min: format(new Date(Math.min(...starts)), "yyyy-MM-dd"),
      max: format(new Date(Math.max(...ends)), "yyyy-MM-dd"),
    };
  }, [tasks]);

  const taskCount = tasks.filter(t => !t.isSection).length;
  const sectionCount = tasks.filter(t => t.isSection).length;

  // ── PDF preview: the previewed document IS the exported document ──────────
  const [pdfPreview, setPdfPreview] = useState(null); // { url, filename, pageCount }
  const pdfDocRef = useRef(null);                     // jsPDF instance kept for download
  const pdfPreviewUrlRef = useRef(null);
  useEffect(() => { pdfPreviewUrlRef.current = pdfPreview?.url || null; }, [pdfPreview]);
  // Revoke the blob URL if the dialog is unmounted while the preview is open
  useEffect(() => () => {
    if (pdfPreviewUrlRef.current) URL.revokeObjectURL(pdfPreviewUrlRef.current);
  }, []);

  const buildPdfOptions = (overrides = {}) => {
    const dateRange = useCustomRange && customStart && customEnd ? { start: customStart, end: customEnd } : null;
    // Pass current columnVisibility to PDF export - only visible columns will be exported
    return { tasks, projectTitle: programmeRef, companyName, programmeRef, subtitle, labelOffsets, fitOnePage, dateRange, durMode, fontScale, barLabel, barLabelSide, textColors, showStaircase: printOptions.showStaircase, staircaseFilterIds, columnVisibility: columnVisibilityProp,
      // Batch 45 — Chinese prints as real text once the font is loaded (see the effect below)
      cjkFont: cjkFont ? { name: CJK_FONT_NAME, base64: cjkFont } : null,
      // page setup + grid/date format (batch 1)
      paperSize, orientation, margin: pdfMargin, footerLeft, footerCenter, footerRight,
      grid: dsGrid, dateFormat: ds.dateFormat || "yyyy-MM-dd", bar: overrides.bar || ds.bar || null,
      // WBS row colours (batch 8) — keeps the PDF in sync with the WBS Settings panel
      group: ds.group || null, wbs: ds.wbs || null,
      // print content (batch 26) — chosen in the Print Preview
      showHolidays: printOptions.showHolidays, showToday: printOptions.showToday,
      showRelationshipLines: printOptions.showRelationshipLines, showComparisonBars: printOptions.showComparisonBars,
      showComparisonArrows: printOptions.showComparisonArrows,     // batch 39
      // batch 27 — the programme's data date (set by right-clicking a date column)
      showRecalcDate: printOptions.showRecalcDate,
      recalcDate: normalizeRecalcDate(recalcDate) || srcProjRow?.last_recalc_date?.slice(0, 10) || "" };
  };

  // "Preview PDF" — build once, show it, keep the document for the download
  const embedDataRef = useRef(null);
  const handleExportPDF = async () => {
    // Embed the FULL task array in the PDF metadata so re-uploading this file restores
    // every field (no AI/vision pass). See src/lib/ganttPDFData.js.
    const embedData = await encodeTasksForPDF(tasks);
    embedDataRef.current = embedData;
    const { doc, filename, pageCount } = buildGanttPDF({ ...buildPdfOptions(), embedData });
    pdfDocRef.current = doc;
    const blob = doc.output("blob");
    setPdfPreview({ url: URL.createObjectURL(blob), filename, pageCount, builtAt: Date.now(), sizeBytes: blob?.size ?? null });
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd, printOptions, printOptionsVersion: PRINT_OPTIONS_VERSION },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
  };

  /**
   * Batch 26 — re-render the preview when a "Print content" toggle changes, so the
   * file being previewed stays the file that gets downloaded.
   */
  const handlePrintOptionChange = (patch) => {
    const next = { ...printOptions, ...patch };
    setPrintOptions(next);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd, printOptions: next, printOptionsVersion: PRINT_OPTIONS_VERSION },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    const buildOptions = { ...buildPdfOptions(), ...next, embedData: embedDataRef.current };
    const { doc, filename, pageCount } = buildGanttPDF(buildOptions);
    pdfDocRef.current = doc;
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { url, filename, pageCount, builtAt: Date.now(), sizeBytes: blob?.size ?? null };
    });
  };

  /**
   * Batch 31 — the bar-text switches are also offered in the Print Preview. They
   * are a *shared* setting (Gantt Bars ▸ Bar Info), so changing one here updates
   * the chart as well; the preview is rebuilt with the NEW bar object right away
   * because React state has not been applied yet at this point.
   */
  const barInfo = { showName: false, showStart: false, showFinish: false, ...((ds.bar && ds.bar.info) || {}) };
  const handleBarInfoChange = (patch) => {
    const nextBar = { ...(ds.bar || {}), info: { ...barInfo, ...patch } };
    updateDisplay({ bar: nextBar });
    const { doc, filename, pageCount } = buildGanttPDF({
      ...buildPdfOptions({ bar: nextBar }),
      embedData: embedDataRef.current,
    });
    pdfDocRef.current = doc;
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { url, filename, pageCount, builtAt: Date.now(), sizeBytes: blob?.size ?? null };
    });
  };

  /**
   * Batch 34/36/37 — "Comparison bars" in the preview is the *print* switch (default OFF);
   * the chart draws its comparison bars whenever the compared dates differ. The Display
   * panel's "Comparison Arrows" switch (programme `showComparison`) is therefore a
   * different thing and no longer affects either renderer's bars.
   *
   * On a tick the preview is rebuilt right away, and the programme flags are flipped as
   * well so the chart's comparison arrows stay in step with the printout.
   */
  /**
   * Batch 39 — "Comparison arrows" (the chart's finish-date comparison between adjacent
   * programmes) is offered in the preview as a print option. Ticking it also opens the
   * programmes' Compare flag (`showComparison`), because the chart gates the arrows on it
   * and every imported programme carries it as `false`; the rebuild uses the patched task
   * array so the arrows appear immediately.
   */
  const pdfPreviewFrom = (buildOptions) => {
    const { doc, filename, pageCount } = buildGanttPDF(buildOptions);
    pdfDocRef.current = doc;
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { url, filename, pageCount, builtAt: Date.now(), sizeBytes: blob?.size ?? null };
    });
  };

  /**
   * Batch 45 — CJK font. Loaded lazily and only when the printed text really contains
   * non-Latin characters (title, company, footers or any activity), so a Latin-only
   * programme never downloads the 11 MB font. Once it is there, an open preview is rebuilt
   * so the Chinese stops being "?" immediately.
   */
  const needsCjk = useMemo(
    () => programmeNeedsCjk(tasks, [projectTitle, companyName, subtitle, programmeRef, footerLeft, footerCenter, footerRight]),
    [tasks, projectTitle, companyName, subtitle, programmeRef, footerLeft, footerCenter, footerRight],
  );

  useEffect(() => {
    if (!printOptions.embedCjkFont || !needsCjk || cjkFont) return undefined;
    let cancelled = false;
    setCjkStatus("loading");
    loadCjkFont()
      .then((base64) => { if (!cancelled) { setCjkFont(base64); setCjkStatus("ready"); } })
      .catch(() => { if (!cancelled) setCjkStatus("error"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCjk, cjkFont, printOptions.embedCjkFont]);

  /**
   * When the font arrives while the preview is already open, rebuild it once so the Chinese
   * replaces the "?" placeholders without the user having to touch any option.
   */
  const cjkRebuiltRef = useRef(false);
  useEffect(() => {
    if (!cjkFont || cjkRebuiltRef.current || !pdfPreviewUrlRef.current) return;
    cjkRebuiltRef.current = true;
    pdfPreviewFrom({
      ...buildPdfOptions(),
      ...printOptions,
      cjkFont: { name: CJK_FONT_NAME, base64: cjkFont },
      embedData: embedDataRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cjkFont]);

  const handleComparisonArrowsChange = (value) => {
    const on = !!value;
    if (on && onToggleComparisonBars) onToggleComparisonBars(true);
    const nextPrint = { ...printOptions, showComparisonArrows: on };
    setPrintOptions(nextPrint);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd, printOptions: nextPrint, printOptionsVersion: PRINT_OPTIONS_VERSION },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    pdfPreviewFrom({
      ...buildPdfOptions(),
      ...nextPrint,
      tasks: on ? withComparisonFlag(tasks, true) : tasks,
      embedData: embedDataRef.current,
    });
  };

  /**
   * Batch 45 — the "Chinese / CJK text" switch. Turning it on loads the font first (so the
   * preview that is rebuilt right after already has real Chinese), turning it off rebuilds
   * without it.
   */
  const handleCjkFontChange = (value) => {
    const on = !!value;
    const nextPrint = { ...printOptions, embedCjkFont: on };
    setPrintOptions(nextPrint);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd, printOptions: nextPrint, printOptionsVersion: PRINT_OPTIONS_VERSION },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    const rebuild = (base64) => pdfPreviewFrom({
      ...buildPdfOptions(),
      ...nextPrint,
      cjkFont: base64 ? { name: CJK_FONT_NAME, base64 } : null,
      embedData: embedDataRef.current,
    });
    if (!on) { rebuild(null); return; }
    if (cjkFont) { rebuild(cjkFont); return; }
    setCjkStatus("loading");
    loadCjkFont()
      .then((base64) => { setCjkFont(base64); setCjkStatus("ready"); rebuild(base64); })
      .catch(() => setCjkStatus("error"));
  };

  const handleComparisonBarsChange = (value) => {
    const on = !!value;
    if (onToggleComparisonBars) onToggleComparisonBars(on);
    const nextPrint = { ...printOptions, showComparisonBars: on };
    setPrintOptions(nextPrint);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd, printOptions: nextPrint, printOptionsVersion: PRINT_OPTIONS_VERSION },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    const { doc, filename, pageCount } = buildGanttPDF({
      ...buildPdfOptions(),
      ...nextPrint,
      tasks: withComparisonFlag(tasks, on),
      embedData: embedDataRef.current,
    });
    pdfDocRef.current = doc;
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { url, filename, pageCount, builtAt: Date.now(), sizeBytes: blob?.size ?? null };
    });
  };

  const closePdfPreview = () => {
    if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    pdfPreviewUrlRef.current = null;
    setPdfPreview(null);
  };

  const handleDownloadPreviewedPdf = () => {
    const doc = pdfDocRef.current;
    const filename = pdfPreview?.filename || `${programmeRef || "Gantt"}.pdf`;
    if (doc) doc.save(filename);
    pdfDocRef.current = null;
    closePdfPreview();
    onClose();
  };

  const handleExportXML = () => {
    const content = buildP6XML(tasks, { projectId, projectName: xerProjectName, exportDate });
    const blob = new Blob([content], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectId || "export"}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    onClose();
  };

  const handleExportXER = () => {
    const xerMapping = loadMapping();
    // When the programme came from an XER we pass its raw tables back so the export is
    // lossless (buildXERPassThrough): untouched rows are written verbatim.
    const content = buildXER(tasks, {
      version, projectId, projectName: xerProjectName, calendarName, exportDate,
      mapping: xerMapping, sourceTables: xerSource,
    });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectId || "export"}.xer`;
    a.click();
    URL.revokeObjectURL(url);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    onClose();
  };

  // Export in full P6-style Excel format matching reference template:
  // Sheets: TASK, RSRC, TASKPRED, PROJCOST, TASKRSRC, USERDATA
  const handleExportP6Excel = () => {
    const wb = XLSX.utils.book_new();
    const proj = projectId || "PROJECT";

    // ── Build WBS codes per section ──────────────────────────────────────────
    const sectionWbsCodes = [];
    tasks.forEach(t => {
      if (t.isSection) {
        const ascii = (t.activity || "").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_").slice(0, 20) || `WBS${sectionWbsCodes.length + 1}`;
        sectionWbsCodes.push(`${proj}.${ascii}`);
      }
    });

    // ── Collect task records ─────────────────────────────────────────────────
    // taskMap: task_code → { wbsCode, taskName, statusCode, start, end }
    const taskMap = {};
    let secIdx = -1;
    let curWbsCode = proj;
    let autoCounter = 1;

    // Detect optional fields for round-trip inclusion
    const hasBL2     = tasks.some(t => !t.isSection && (t.baselineStart || t.baselineFinish));
    const hasRemDur2 = tasks.some(t => !t.isSection && t.remainDur != null);
    const hasFloat2  = tasks.some(t => !t.isSection && t.float != null);
    const hasPct2    = tasks.some(t => !t.isSection && t.pct != null);

    const taskDataRows = [];
    tasks.forEach(t => {
      if (t.isSection) {
        secIdx++;
        curWbsCode = sectionWbsCodes[secIdx] || proj;
        return;
      }
      let taskCode = (t.activityId || "").trim();
      if (!taskCode) { taskCode = `A${String(autoCounter).padStart(4, "0")}`; }
      autoCounter++;
      let statusCode = "Not Started";
      if (t.endActual)        statusCode = "Completed";
      else if (t.startActual) statusCode = "In Progress";
      const start = t.start ? `${t.start} 07:00:00` : "";
      const end   = t.end   ? `${t.end} 17:00:00`   : "";
      taskMap[taskCode] = { wbsCode: curWbsCode, taskName: t.activity || "", statusCode, start, end };

      const row = [taskCode, statusCode, curWbsCode, (t.activity || "").replace(/\t/g, " "), start, end, "", ""];
      // Append optional fields in fixed order for round-trip compatibility
      if (hasBL2)     row.push(t.baselineStart ? `${t.baselineStart} 07:00:00` : "", t.baselineFinish ? `${t.baselineFinish} 17:00:00` : "");
      if (hasRemDur2) row.push(t.remainDur != null ? String(t.remainDur * 8) : ""); // days → hours
      if (hasFloat2)  row.push(t.float != null ? String(t.float * 8) : "");          // days → hours
      if (hasPct2)    row.push(t.pct != null ? String(t.pct) : "");
      taskDataRows.push(row);
    });

    // ── TASK sheet ───────────────────────────────────────────────────────────
    // Row 0: internal field names; Row 1: human-readable labels; then data
    const tHdr0 = ["task_code",   "status_code",     "wbs_id",   "task_name",       "start_date", "end_date",   "resource_list", "delete_record_flag"];
    const tHdr1 = ["Activity ID", "Activity Status", "WBS Code", "Activity Name",   "(*)Start",   "(*)Finish",  "(*)Resources",  "Delete This Row"];
    if (hasBL2)     { tHdr0.push("bl_start_date", "bl_end_date");                  tHdr1.push("BL Start", "BL End"); }
    if (hasRemDur2) { tHdr0.push("remain_drtn_hr_cnt");                           tHdr1.push("Rem. Duration"); }
    if (hasFloat2)  { tHdr0.push("total_float_hr_cnt");                           tHdr1.push("Total Float"); }
    if (hasPct2)    { tHdr0.push("phys_complete_pct");                            tHdr1.push("% Complete"); }

    const taskSheet = [tHdr0, tHdr1, ...taskDataRows];
    const wsTask = XLSX.utils.aoa_to_sheet(taskSheet);
    wsTask["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 32 }, { wch: 55 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 14 }];

    // ── RSRC sheet ───────────────────────────────────────────────────────────
    const rsrcSheet = [
      ["rsrc_short_name", "rsrc_name",     "rsrc_title_name"],
      ["Resource ID",     "Resource Name", "Title"],
    ];
    const wsRsrc = XLSX.utils.aoa_to_sheet(rsrcSheet);
    wsRsrc["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }];

    // ── TASKPRED sheet ───────────────────────────────────────────────────────
    // Collect predecessor relationships from _originalXerData links and Gantt link fields
    // Build a code→task lookup for quick access
    const predDataRows = [];

    // First try to reconstruct from Gantt link field (link is stored on predecessor task)
    // link field on task T means: T → successor (succCode stored in lag/link)
    // Actually in parseXER, link/lag is stored ON the predecessor task.
    // So we iterate tasks: if t has .link, t is the predecessor, find the next non-section task as successor.
    const nonSectionTasks = [];
    let si = -1;
    let curWbs2 = proj;
    tasks.forEach(t => {
      if (t.isSection) { si++; curWbs2 = sectionWbsCodes[si] || proj; return; }
      let code = (t.activityId || "").trim() || `A${String(nonSectionTasks.length + 1).padStart(4, "0")}`;
      nonSectionTasks.push({ _id: t.id, code, name: t.activity || "", wbs: curWbs2, link: t.link, lag: t.lag, linkOffset: t.linkOffset });
    });

    // Build a taskId → nonSectionTask lookup for resolving bindChainMode links (link = numeric task id)
    const taskIdMap = {};
    nonSectionTasks.forEach(t => { taskIdMap[t._id] = t; });

    nonSectionTasks.forEach((t, idx) => {
      if (!t.link) return;
      // bindChainMode stores link as a numeric task id; XER imports store link as a string ("FS"/"FF"/"SS"/"SF")
      const isBindChainLink = typeof t.link === "number" || /^\d+$/.test(String(t.link));
      const succ = isBindChainLink
        ? taskIdMap[t.link] || nonSectionTasks[idx + 1]
        : nonSectionTasks[idx + 1];
      if (!succ) return;
      const relType = isBindChainLink ? "FS" : t.link; // preserve original XER relationship type
      const lagDays = t.lag ?? t.linkOffset ?? 0;
      predDataRows.push([
        proj, proj,
        t.wbs, succ.wbs,
        t.code, succ.code,
        t.name, succ.name,
        relType, String(lagDays),
        taskMap[t.code]?.statusCode || "Not Started",
        taskMap[succ.code]?.statusCode || "Not Started",
        "", "", "",
      ]);
    });

    const taskPredSheet = [
      ["pred_proj_id",        "proj_id",           "PREDTASK__PROJWBS__wbs_full_name", "TASK__PROJWBS__wbs_full_name",
       "pred_task_id",        "task_id",            "PREDTASK__task_name",             "TASK__task_name",
       "pred_type",           "lag_hr_cnt",         "PREDTASK__status_code",           "TASK__status_code",
       "PREDTASK__rsrc_id",   "TASK__rsrc_id",      "delete_record_flag"],
      ["(*)Predecessor Project", "(*)Successor Project", "(*)Predecessor WBS",         "(*)Successor WBS",
       "Predecessor",         "Successor",          "(*)Predecessor Activity Name",    "(*)Successor Activity Name",
       "Relationship Type",   "Lag(d)",             "(*)Predecessor Activity Status",  "(*)Successor Activity Status",
       "(*)Predecessor Primary Resource", "(*)Successor Primary Resource",             "Delete This Row"],
      ...predDataRows,
    ];
    const wsTaskPred = XLSX.utils.aoa_to_sheet(taskPredSheet);
    wsTaskPred["!cols"] = [
      { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 28 },
      { wch: 16 }, { wch: 16 }, { wch: 36 }, { wch: 36 },
      { wch: 18 }, { wch: 10 }, { wch: 22 }, { wch: 22 },
      { wch: 20 }, { wch: 20 }, { wch: 14 },
    ];

    // ── PROJCOST sheet ────────────────────────────────────────────────────────
    const projCostSheet = [
      ["task_id",      "cost_name",    "TASK__status_code",        "target_cost",    "act_cost",    "remain_cost",      "total_cost",            "delete_record_flag"],
      ["Activity ID",  "Expense Item", "(*)Activity Status",       "Budgeted Cost ", "Actual Cost", "Remaining Cost",   "At Completion Cost",    "Delete This Row"],
    ];
    const wsProjCost = XLSX.utils.aoa_to_sheet(projCostSheet);
    wsProjCost["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 14 }];

    // ── TASKRSRC sheet ────────────────────────────────────────────────────────
    const taskRsrcSheet = [
      ["task_id",     "TASK__status_code",   "rsrc_id",     "role_id", "acct_id",        "rsrc_type",           "start_date", "end_date",  "delete_record_flag"],
      ["Activity ID", "(*)Activity Status",  "Resource ID", "Role ID", "Cost Account ID","(*)Resource Type",    "(*)Start",   "(*)Finish", "Delete This Row"],
    ];
    const wsTaskRsrc = XLSX.utils.aoa_to_sheet(taskRsrcSheet);
    wsTaskRsrc["!cols"] = [{ wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 14 }];

    // ── USERDATA sheet ────────────────────────────────────────────────────────
    const userDataSheet = [
      ["user_data"],
      ["UserSettings Do Not Edit"],
      ["DurationQtyType=QT_Day\nShowAsPercentage=0\nSmallScaleQtyType=QT_Hour\nDateFormat=d/M/yyyy\nCurrencyFormat=US Dollar"],
    ];
    const wsUserData = XLSX.utils.aoa_to_sheet(userDataSheet);

    // ── Assemble workbook (sheet order matches reference) ────────────────────
    XLSX.utils.book_append_sheet(wb, wsTask,     "TASK");
    XLSX.utils.book_append_sheet(wb, wsRsrc,     "RSRC");
    XLSX.utils.book_append_sheet(wb, wsTaskPred, "TASKPRED");
    XLSX.utils.book_append_sheet(wb, wsProjCost, "PROJCOST");
    XLSX.utils.book_append_sheet(wb, wsTaskRsrc, "TASKRSRC");
    XLSX.utils.book_append_sheet(wb, wsUserData, "USERDATA");

    const filename = `${proj}-Activities.xlsx`;
    XLSX.writeFile(wb, filename);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    onClose();
  };

  // ── Relationship handlers ──────────────────────────────────────────────────
  function relLoadXML(text, source) {
    const acts = parseActivitiesFromXML(text);
    if (!acts || acts.length === 0) { alert("Could not parse activities from this XML file."); return; }
    setRelXmlText(text); setRelActivities(acts); setRelExisting(parseRelationshipsFromXML(text)); setRelNew([]); setRelXmlSource(source);
  }

  function relHandleFileUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => relLoadXML(ev.target.result, "upload");
    reader.readAsText(f, "utf-8");
  }

  function relHandleUseCurrent() {
    import("@/lib/exportP6XML").then(mod => {
      const xml = mod.buildP6XML(tasks, { projectId, projectName: xerProjectName, exportDate });
      relLoadXML(xml, "current");
    });
  }

  async function relHandleAI() {
    if (!relAiPrompt.trim()) return;
    setRelAiLoading(true); setRelAiError("");
    try {
      // ── 1. Map activities → section using tasks prop ──────────────────────
      const actToSection = {};
      let curSection = "(No Section)";
      tasks.forEach(t => {
        if (t.isSection) { curSection = t.activity || "Section"; }
        else {
          const act = relActivities.find(a => a.id === (t.activityId || "").trim() || a.name === t.activity);
          if (act) actToSection[act.id] = curSection;
        }
      });
      relActivities.forEach(a => { if (!actToSection[a.id]) actToSection[a.id] = "(No Section)"; });

      // ── 2. Group by section, sort each group by start date ────────────────
      const sectionMap = {};
      relActivities.forEach(a => {
        const sec = actToSection[a.id];
        if (!sectionMap[sec]) sectionMap[sec] = [];
        sectionMap[sec].push(a);
      });
      Object.values(sectionMap).forEach(arr =>
        arr.sort((a, b) => (a.startDate || a.finishDate || "").localeCompare(b.startDate || b.finishDate || ""))
      );

      // ── 3. Build existing rel set ─────────────────────────────────────────
      const existingRelSet = new Set(relExisting.map(r => {
        const p = relActivities.find(a => a.objectId === r.predObjId);
        const s = relActivities.find(a => a.objectId === r.succObjId);
        return `${p?.id}|${s?.id}`;
      }));

      // ── 4. Pre-compute consecutive candidates within each section ─────────
      const candidates = [];
      Object.entries(sectionMap).forEach(([section, sorted]) => {
        for (let i = 0; i < sorted.length - 1; i++) {
          const pred = sorted[i];
          const succ = sorted[i + 1];
          if (existingRelSet.has(`${pred.id}|${succ.id}`)) continue;

          const predFinish = pred.finishDate ? new Date(pred.finishDate.slice(0, 10)) : null;
          const succStart  = succ.startDate  ? new Date(succ.startDate.slice(0, 10))  : null;
          const predStart  = pred.startDate  ? new Date(pred.startDate.slice(0, 10))  : null;
          const succFinish = succ.finishDate ? new Date(succ.finishDate.slice(0, 10)) : null;

          let relType = "Finish to Start";
          let lag = 0;

          if (predFinish && succStart) {
            const gapDays = Math.round((succStart - predFinish) / 86400000);
            if (gapDays < 0 && predStart && succStart) {
              const startDiff  = Math.round((succStart - predStart) / 86400000);
              const finishDiff = predFinish && succFinish ? Math.round((succFinish - predFinish) / 86400000) : 999;
              if (Math.abs(startDiff) <= 1)       { relType = "Start to Start";   lag = startDiff; }
              else if (Math.abs(finishDiff) <= 1) { relType = "Finish to Finish"; lag = finishDiff; }
              else                                { relType = "Finish to Start";  lag = gapDays; }
            } else {
              relType = "Finish to Start";
              lag = gapDays > 0 ? gapDays : 0;
            }
          }

          candidates.push({ predId: pred.id, succId: succ.id, relType, lag, section, predName: pred.name, succName: succ.name });
        }
      });

      // ── 5. Build AI context ───────────────────────────────────────────────
      const actList = Object.entries(sectionMap).map(([section, acts]) =>
        acts.map(a => `[Section: ${section}] [${a.id}] ${a.name} | Start: ${a.startDate?.slice(0,10)||"?"} | Finish: ${a.finishDate?.slice(0,10)||"?"}`).join("\n")
      ).join("\n");

      const chainList = candidates.map(c =>
        `CANDIDATE: ${c.predId} (${c.predName}) → ${c.succId} (${c.succName}) | Type: ${c.relType} | Lag: ${c.lag}d | Section: ${c.section}`
      ).join("\n");

      const existList = relExisting.map(r => {
        const p = relActivities.find(a => a.objectId === r.predObjId);
        const s = relActivities.find(a => a.objectId === r.succObjId);
        return `${p?.id||r.predObjId} → ${s?.id||r.succObjId} [${REL_SHORT[r.type]||r.type}] Lag:${r.lag}d`;
      }).join("\n");

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Primavera P6 scheduling expert.

All date calculations are already done. Your ONLY job is to SELECT which CANDIDATES to include based on the user's instruction.

ACTIVITIES (for reference):
${actList}

PRE-COMPUTED CANDIDATES (consecutive pairs sorted by Start Date within each Section):
${chainList || "(none — no consecutive pairs found)"}

EXISTING RELATIONSHIPS (already in file — do NOT duplicate):
${existList || "(none)"}

USER INSTRUCTION:
"${relAiPrompt}"

SELECTION RULES:
1. Match "Section" names and activity names case-insensitively (e.g. "Noise Barrier" matches section or activity containing those words).
2. If the user specifies a relationship type (e.g. "FS"), override the candidate's computed Type with that type; keep computed Lag unless user specifies one.
3. If user says "all" or doesn't filter, include ALL candidates.
4. Only return candidates from the list above — do NOT invent new pairs.
5. Do NOT return pairs already in EXISTING RELATIONSHIPS.

Return the selected relationships as: predId, succId, type, lag (integer), reason (one sentence).`,
        response_json_schema: { type: "object", properties: { relationships: { type: "array", items: { type: "object", properties: { predId: {type:"string"}, succId: {type:"string"}, type: {type:"string"}, lag: {type:"number"}, reason: {type:"string"} } } } } },
        model: "claude_sonnet_4_6",
      });

      const suggested = (result?.relationships || []).filter(r =>
        relActivities.some(a => a.id === r.predId) &&
        relActivities.some(a => a.id === r.succId) &&
        REL_TYPES.includes(r.type)
      );
      setRelNew(prev => {
        const existing = new Set(prev.map(r => `${r.predId}|${r.succId}|${r.type}`));
        return [...prev, ...suggested.filter(r => !existing.has(`${r.predId}|${r.succId}|${r.type}`))];
      });
    } catch(e) { setRelAiError("AI failed: " + e.message); }
    finally { setRelAiLoading(false); }
  }

  function relAddManual() {
    if (!relManualPred || !relManualSucc || relManualPred === relManualSucc) return;
    setRelNew(prev => [...prev, { predId: relManualPred, succId: relManualSucc, type: relManualType, lag: parseInt(relManualLag)||0, reason: "Manual" }]);
    setRelManualPred(""); setRelManualSucc("");
  }

  function relDownload() {
    const output = injectRelationshipsIntoXML(relXmlText, relNew, relExisting, relActivities);
    const blob = new Blob([output], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${projectId||"export"}_with_relationships.xml`; a.click(); URL.revokeObjectURL(url);
  }

  const relActById = Object.fromEntries(relActivities.map(a => [a.id, a]));

  // ── All fields that can appear in Gantt table and should be preserved round-trip ──
  const ALL_EXTRA_FIELDS = [
    // Baseline
    { key: "baselineStart",     header: "BL Start",           type: "date", colKey: "blStart" },
    { key: "baselineFinish",    header: "BL Finish",          type: "date", colKey: "blEnd" },
    // Scheduling
    { key: "remainDur",         header: "Rem.Dur",            type: "number", colKey: "remainDur" },
    { key: "float",             header: "Float",              type: "number", colKey: "float" },
    { key: "pct",               header: "% Comp",             type: "number", colKey: "pct" },
    { key: "earlyStart",        header: "Early Start",        type: "date", colKey: "earlyStart" },
    { key: "earlyEnd",          header: "Early Finish",       type: "date", colKey: "earlyEnd" },
    { key: "lateStart",         header: "Late Start",         type: "date", colKey: "lateStart" },
    { key: "lateEnd",           header: "Late Finish",        type: "date", colKey: "lateEnd" },
    { key: "freeFloat",         header: "Free Float",         type: "number", colKey: "freeFloat" },
    { key: "expectedFinish",    header: "Exp. Finish",        type: "date", colKey: "expectedFinish" },
    // Metadata
    { key: "primaryResource",   header: "Resource",           type: "text", colKey: "primaryResource" },
    { key: "durationType",      header: "Dur. Type",          type: "text", colKey: "durationType" },
    { key: "completePctType",   header: "% Type",             type: "text", colKey: "completePctType" },
    { key: "statusCode",        header: "Status",             type: "text", colKey: "statusCode" },
    { key: "constraintType",    header: "Constraint",         type: "text", colKey: "constraintType" },
    { key: "constraintDate",    header: "Const. Date",        type: "date", colKey: "constraintDate" },
    { key: "constraintType2",   header: "Const.2",            type: "text", colKey: "constraintType2" },
    { key: "constraintDate2",   header: "Const.2 Date",       type: "date", colKey: "constraintDate2" },
    { key: "suspendDate",       header: "Suspend",            type: "date", colKey: "suspendDate" },
    { key: "resumeDate",        header: "Resume",             type: "date", colKey: "resumeDate" },
    { key: "priorityType",      header: "Priority",           type: "text", colKey: "priorityType" },
    { key: "locationId",        header: "Location",           type: "text", colKey: "locationId" },
    { key: "estWt",             header: "Est Wt",             type: "number", colKey: "estWt" },
    { key: "drivingPathFlag",   header: "Long.Path",          type: "text", colKey: "drivingPathFlag" },
    { key: "lockPlanFlag",      header: "Lock Plan",          type: "text", colKey: "lockPlanFlag" },
    { key: "autoComputeActFlag",header: "Auto Actuals",       type: "text", colKey: "autoComputeActFlag" },
    // Units
    { key: "actLaborUnits",     header: "Act.Labor",          type: "number", colKey: "actLaborUnits" },
    { key: "actNonlaborUnits",  header: "Act.NonLabor",       type: "number", colKey: "actNonlaborUnits" },
    { key: "remLaborUnits",     header: "Rem.Labor",          type: "number", colKey: "remLaborUnits" },
    { key: "remNonlaborUnits",  header: "Rem.NonLabor",       type: "number", colKey: "remNonlaborUnits" },
    { key: "planLaborUnits",    header: "Plan Labor",         type: "number", colKey: "planLaborUnits" },
    { key: "planNonlaborUnits", header: "Plan NonLabor",      type: "number", colKey: "planNonlaborUnits" },
    // Review
    { key: "reviewFinish",      header: "Review Finish",      type: "date", colKey: "reviewFinish" },
    { key: "reviewStatus",      header: "Review Status",      type: "text", colKey: "reviewStatus" },
    // External / Remaining dates
    { key: "externalEarlyStart",header: "Ext.ES",             type: "date", colKey: "externalEarlyStart" },
    { key: "externalLateFinish",header: "Ext.LF",             type: "date", colKey: "externalLateFinish" },
    { key: "remEarlyStart",     header: "Rem.ES",             type: "date", colKey: "remEarlyStart" },
    { key: "remEarlyFinish",    header: "Rem.EF",             type: "date", colKey: "remEarlyFinish" },
    { key: "remLateStart",      header: "Rem.LS",             type: "date", colKey: "remLateStart" },
    { key: "remLateFinish",     header: "Rem.LF",             type: "date", colKey: "remLateFinish" },
    // Float Path / IDs
    { key: "floatPath",         header: "Float Path",         type: "text", colKey: "floatPath" },
    { key: "floatPathOrder",    header: "FP Order",           type: "number", colKey: "floatPathOrder" },
    { key: "p6Guid",            header: "GUID",               type: "text", colKey: "p6Guid" },
    { key: "p6TaskId",          header: "P6 ID",              type: "text", colKey: "p6TaskId" },
    { key: "targetDuration",    header: "Plan.Dur",           type: "number", colKey: "targetDuration" },
    { key: "calendar",          header: "Calendar",           type: "text", colKey: "calendar" },
  ];

  // Filter fields by data presence only (ignore UI visibility — export ALL data)
  const isFieldVisible = (colKey) => {
    if (!columnVisibilityProp) return true;
    const col = columnVisibilityProp[colKey];
    return col && col.visible !== false;
  };

  const activeFields = ALL_EXTRA_FIELDS.filter(f =>
    tasks.some(t => !t.isSection && t[f.key] != null && t[f.key] !== "" && t[f.key] !== undefined)
  );
  const hasAnyExtra = activeFields.length > 0;

  const buildExportRows = () => {
    // Always export core columns + ALL extra fields that have data (regardless of visibility)
    const header = ["Color", "Type", "Item", "ID", "Activity", "Start", "End", ...activeFields.map(f => f.header)];
    const rows = [header];
    tasks.forEach(t => {
      if (t.isSection) {
        const color = (t.sectionType === "pink") ? "B" : "A";
        const row = [color, "", "", "", t.activity || "", "", ""];
        if (hasAnyExtra) activeFields.forEach(() => row.push(""));
        rows.push(row);
      } else {
        const typeVal = (t.barType || "baseline") === "delay" ? "DE" : "BL";
        const startVal = t.startActual ? `${t.start} A` : (t.start || "");
        const endVal   = t.endActual   ? `${t.end} A`   : (t.end   || "");
        const row = ["", typeVal, t.item || t._resolvedItem || "", t.activityId || "", t.activity || "", startVal, endVal];
        activeFields.forEach(f => {
          const v = t[f.key];
          row.push(v != null && v !== "" ? v : "");
        });
        rows.push(row);
      }
    });
    return rows;
  };

  const handleExportExcel = () => {
    const rows = buildExportRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const coreCols = [{ wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 42 }, { wch: 14 }, { wch: 14 }];
    ws["!cols"] = [...coreCols, ...activeFields.map(() => ({ wch: 16 }))];

    const instrData = [
      ["Column", "Description", "Example"],
      ["Color", "Leave empty for normal rows. 'A' = blue section header, 'B' = pink section header.", "A"],
      ["Type", "Bar type: BL = Baseline (default), DE = Delay.", "DE"],
      ["Item", "Item label on the Gantt bar (e.g. A1, B2).", "A1"],
      ["ID", "Activity ID / code.", "S9-CW0610"],
      ["Activity", "Activity name or section title.", "Site Preparation"],
      ["Start", "Start date YYYY-MM-DD. Append ' A' for Actual Date (e.g. 2025-01-06 A).", "2025-01-06"],
      ["End", "End date YYYY-MM-DD. Append ' A' for Actual Date.", "2025-02-15"],
      ["", "", ""],
      ["NOTE:", "Re-upload this file via Import to restore all data.", ""],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr["!cols"] = [{ wch: 12 }, { wch: 65 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Gantt Data");
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");

    const filename = `${projectTitle || "gantt"}.xlsx`.replace(/[^\w\s.-]/g, "_");
    XLSX.writeFile(wb, filename);
    saveSettings({
      pdf: { companyName, programmeRef, subtitle, fitOnePage, fontScale, barLabel, barLabelSide, textColors, useCustomRange, customStart, customEnd },
      xer: { version, projectId, projectName: xerProjectName, calendarName, exportDate },
    });
    onClose();
  };



  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl shadow-2xl w-[500px] max-w-[95vw] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              <FileDown size={18} className="text-primary" />
              Export
            </h2>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>

          {/* Format tabs */}
          <div className="flex gap-1 mb-5 bg-surface-muted rounded-lg p-1 flex-wrap">
            {[
              { key: "pdf",   label: "PDF",           icon: <FileDown size={13} />,        color: "text-primary" },
              { key: "excel", label: "Excel",          icon: <FileSpreadsheet size={13} />, color: "text-success" },
              { key: "xer",   label: "P6 XER",         icon: <FileText size={13} />,        color: "text-accent-selected" },
              { key: "xml",   label: "P6 XML",         icon: <FileText size={13} />,        color: "text-accent-selected" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  mode === tab.key ? "bg-surface shadow text-text" : "text-text-muted hover:text-text"
                }`}
              >
                <span className={mode === tab.key ? tab.color : ""}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 px-6">
        {/* PDF options */}
        {mode === "pdf" && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Company Name</label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Programme Reference</label>
                <Input value={programmeRef} onChange={(e) => setProgrammeRef(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Subtitle (optional)</label>
                <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="text-sm" placeholder="e.g. As-planned Impacted (Delay Analysis)" />
              </div>
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text">Timeline Range</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={useCustomRange} onChange={(e) => {
                      setUseCustomRange(e.target.checked);
                      if (e.target.checked && !customStart) setCustomStart(autoRange.min);
                      if (e.target.checked && !customEnd) setCustomEnd(autoRange.max);
                    }} className="accent-primary" />
                    <span className="text-xs text-text-muted">Custom range</span>
                  </label>
                </div>
                {!useCustomRange && <p className="text-xs text-text-muted">Auto: {autoRange.min} → {autoRange.max}</p>}
                {useCustomRange && (
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs text-text-muted mb-0.5 block">From</label>
                      <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-xs" />
                    </div>
                    <span className="text-text-muted mt-4">→</span>
                    <div className="flex-1">
                      <label className="text-xs text-text-muted mb-0.5 block">To</label>
                      <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-xs" />
                    </div>
                  </div>
                )}
              </div>
              <div className="border border-border rounded-lg p-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text">Font Size</span>
                    <span className="text-xs text-primary font-semibold">{Math.round(fontScale * 100)}%</span>
                  </div>
                  <input
                    type="range" min="0.6" max="1.6" step="0.05"
                    value={fontScale}
                    onChange={e => setFontScale(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-0.5">
                    <span>60%</span><span>100%</span><span>160%</span>
                  </div>
                </div>
              </div>
              {/* Page setup */}
              <div className="border border-border rounded-lg p-3 space-y-3">
                <span className="text-xs font-medium text-text block">Page Setup</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-text-muted block">
                    Paper
                    <select value={paperSize} onChange={e => setPaperSize(e.target.value)} className="mt-1 w-full border border-border rounded px-2 py-1 text-xs bg-surface">
                      <option value="a3">A3 (297 × 420 mm)</option>
                      <option value="a4">A4 (210 × 297 mm)</option>
                    </select>
                  </label>
                  <label className="text-xs text-text-muted block">
                    Orientation
                    <select value={orientation} onChange={e => setOrientation(e.target.value)} className="mt-1 w-full border border-border rounded px-2 py-1 text-xs bg-surface">
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </label>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-muted">Page margin</span>
                    <span className="text-xs text-primary font-semibold">{pdfMargin} mm</span>
                  </div>
                  <input type="range" min="4" max="20" step="1" value={pdfMargin}
                    onChange={e => setPdfMargin(Number(e.target.value))} className="w-full accent-primary" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-text-muted">
                    Footer <span className="text-text-muted">(optional · {"{page}"} / {"{pages}"})</span>
                  </span>
                  <Input value={footerLeft} onChange={e => setFooterLeft(e.target.value)} className="text-xs h-7" placeholder="Left" />
                  <Input value={footerCenter} onChange={e => setFooterCenter(e.target.value)} className="text-xs h-7" placeholder="Centre — e.g. Page {page} of {pages}" />
                  <Input value={footerRight} onChange={e => setFooterRight(e.target.value)} className="text-xs h-7" placeholder="Right — e.g. Rev A" />
                </div>
              </div>

              {/* Grid lines + date format (shared with the on-screen table) */}
              <div className="border border-border rounded-lg p-3 space-y-2">
                <span className="text-xs font-medium text-text block">
                  Grid &amp; Date Format <span className="font-normal text-text-muted">(also applies on screen)</span>
                </span>
                <label className="text-xs text-text-muted block">
                  Date format
                  <select
                    value={ds.dateFormat || "yyyy-MM-dd"}
                    onChange={e => updateDisplay({ dateFormat: e.target.value })}
                    disabled={!onDisplaySettingsChange}
                    className="mt-1 w-full border border-border rounded px-2 py-1 text-xs bg-surface disabled:opacity-50"
                  >
                    {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </label>
                <div className="space-y-1">
                  {[
                    { key: "rowVisible",           label: "Activity row lines" },
                    { key: "colVisible",           label: "Column dividers" },
                    { key: "groupVisible",         label: "Group header lines" },
                    { key: "timelineMajorVisible", label: "Timeline — year lines" },
                    { key: "timelineMinorVisible", label: "Timeline — month lines" },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox"
                        checked={dsGrid[item.key] !== false}
                        onChange={e => updateGrid({ [item.key]: e.target.checked })}
                        disabled={!onDisplaySettingsChange}
                        className="accent-primary" />
                      <span className="text-xs text-text-muted">{item.label}</span>
                    </label>
                  ))}
                </div>
                <details>
                  <summary className="text-xs text-text-muted cursor-pointer">Line colour / weight / style</summary>
                  <div className="mt-2 space-y-2">
                    {[
                      { k: "row",           label: "Row" },
                      { k: "col",           label: "Column" },
                      { k: "group",         label: "Group" },
                      { k: "timelineMinor", label: "Timeline minor" },
                      { k: "timelineMajor", label: "Timeline major" },
                    ].map(gp => (
                      <div key={gp.k} className="flex items-center gap-1.5">
                        <span className="text-xs text-text-muted w-24">{gp.label}</span>
                        <input type="color" value={dsGrid[`${gp.k}Color`] || "#cecece"}
                          onChange={e => updateGrid({ [`${gp.k}Color`]: e.target.value })}
                          className="w-6 h-5 border border-border rounded cursor-pointer" title="Colour" />
                        <input type="number" min="1" max="4" step="1" value={dsGrid[`${gp.k}Weight`] ?? 1}
                          onChange={e => updateGrid({ [`${gp.k}Weight`]: Number(e.target.value) })}
                          className="w-12 border border-border rounded px-1 py-0.5 text-xs" title="Weight" />
                        <select value={dsGrid[`${gp.k}Style`] || "solid"}
                          onChange={e => updateGrid({ [`${gp.k}Style`]: e.target.value })}
                          className="flex-1 border border-border rounded px-1 py-0.5 text-xs bg-surface" title="Style">
                          {LINE_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              <div className="border border-border rounded-lg p-3 space-y-2">
                <span className="text-xs font-medium text-text block">Bar Label (shown next to each bar)</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "none",       label: "None" },
                    { value: "item",       label: "Item (A1, B2…)" },
                    { value: "activityId", label: "ID" },
                    { value: "activity",   label: "Activity Name" },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="barLabel" value={opt.value} checked={barLabel === opt.value} onChange={() => setBarLabel(opt.value)} className="accent-primary" />
                      <span className="text-xs text-text">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {barLabel !== "none" && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-text-muted">Position:</span>
                    <div className="flex gap-1">
                      {[{ value: "left", label: "◀ Left" }, { value: "right", label: "Right ▶" }].map(opt => (
                        <button key={opt.value} onClick={() => setBarLabelSide(opt.value)}
                          className={`px-2 py-0.5 text-xs rounded border transition-all ${barLabelSide === opt.value ? "bg-primary text-surface border-primary" : "bg-surface text-text-muted border-border hover:border-primary"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowTextColors(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-text hover:bg-surface-subtle transition-colors"
                >
                  <span>Text Colours</span>
                  <ChevronDown size={13} className={`transition-transform ${showTextColors ? "rotate-180" : ""}`} />
                </button>
                {showTextColors && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        { key: "activityText", label: "Activity text" },
                        { key: "activityId",   label: "ID text" },
                        { key: "dateText",     label: "Date text" },
                        { key: "barLabelText", label: "Bar label" },
                        { key: "sectionBlue",  label: "Blue section" },
                        { key: "sectionPink",  label: "Pink section" },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="color"
                            value={textColors[key]}
                            onChange={e => setColor(key, e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border border-border"
                          />
                          <span className="text-xs text-text-muted">{label}</span>
                        </label>
                      ))}
                    </div>
                    <button onClick={() => setTextColors({ activityText:"#333333", activityId:"#005a53", dateText:"#333333", barLabelText:"#333333", sectionBlue:"#ffffff", sectionPink:"#ffffff" })}
                      className="text-xs text-primary hover:underline mt-1">Reset to defaults</button>
                  </div>
                )}
              </div>
              <div className="border border-border rounded-lg p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fitOnePage} onChange={(e) => setFitOnePage(e.target.checked)} className="accent-primary" />
                  <div>
                    <span className="text-xs font-medium text-text">Fit all content on one page</span>
                    <p className="text-xs text-text-muted mt-0.5">Compresses all rows to fit a single A3 landscape page.</p>
                  </div>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Excel options */}
        {mode === "excel" && (
          <div className="space-y-3 mb-2">
            {/* Excel type selector */}
            <div className="flex gap-2">
              {[
                { value: "gantt", label: "Gantt Format", desc: "Color/Type/Item/ID format — fully re-importable" },
                { value: "p6",    label: "P6 Activities", desc: "TASK + USERDATA sheets — compatible with P6 import" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExcelType(opt.value)}
                  className={`flex-1 border rounded-lg p-3 text-left transition-all ${excelType === opt.value ? "border-success bg-surface-subtle" : "border-border hover:border-border"}`}
                >
                  <div className={`text-xs font-semibold mb-0.5 ${excelType === opt.value ? "text-success" : "text-text"}`}>{opt.label}</div>
                  <div className="text-xs text-text-muted">{opt.desc}</div>
                </button>
              ))}
            </div>
            {excelType === "gantt" && (
              <div className="p-3 bg-surface-subtle border border-border rounded-lg text-xs text-success">
                Exporting <strong>{taskCount}</strong> activities across <strong>{sectionCount}</strong> sections in <strong>Color/Type/Item/ID/Activity/Start/End</strong> format. Type column: BL = Baseline, DE = Delay.
              </div>
            )}
            {excelType === "p6" && (
              <div className="p-3 bg-surface-subtle border border-border rounded-lg text-xs text-success">
                Exporting <strong>{taskCount}</strong> activities across <strong>{sectionCount}</strong> WBS sections in P6-format xlsx (TASK + USERDATA sheets).
              </div>
            )}
          </div>
        )}

        {/* XER options */}
        {mode === "xer" && (
          <div className="space-y-3 pb-2">
            <div className="mb-2 p-3 bg-table-header border border-border rounded-lg text-xs text-accent-selected">
              Exporting <strong>{taskCount}</strong> activities across <strong>{sectionCount}</strong> WBS sections.
            </div>
            {/* Mapping settings shortcut */}
            <div className="p-3 bg-table-header border border-border rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-accent-selected">Field Mapping Settings</div>
                <div className="text-xs text-accent-selected mt-0.5">Customise task_code, task_name, date source and other field mappings</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { onOpenXerMapping && onOpenXerMapping(); }}
                className="flex items-center gap-1.5 text-accent-selected border-accent-accessible hover:bg-table-header flex-shrink-0 ml-3">
                <Settings2 size={13} /> Mapping Settings
              </Button>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">P6 Version</label>
              <select value={version} onChange={e => setVersion(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible">
                {P6_VERSIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Project ID <span className="text-text-muted">(max 20 chars)</span></label>
              <Input maxLength={20} value={projectId} onChange={e => setProjectId(e.target.value)} className="text-sm" placeholder="e.g. PROJ001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Project Name</label>
              <Input value={xerProjectName} onChange={e => setXerProjectName(e.target.value)} className="text-sm" placeholder="Full project name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Calendar Name</label>
              <Input value={calendarName} onChange={e => setCalendarName(e.target.value)} className="text-sm" placeholder="e.g. Standard" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Data Date</label>
              <input type="date" value={exportDate} onChange={e => setExportDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible" />
            </div>
          </div>
        )}
        {/* P6 XML options */}
        {mode === "xml" && !relXmlSource && (
          <div className="space-y-3 pb-2">
            <div className="mb-2 p-3 bg-table-header border border-border rounded-lg text-xs text-accent-selected">
              Exports <strong>{taskCount}</strong> activities across <strong>{sectionCount}</strong> WBS sections as a Primavera P6 PMXML file (.xml), importable directly into P6 Professional or EPPM.
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Project ID <span className="text-text-muted">(max 20 chars)</span></label>
              <Input maxLength={20} value={projectId} onChange={e => setProjectId(e.target.value)} className="text-sm" placeholder="e.g. PROJ001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Project Name</label>
              <Input value={xerProjectName} onChange={e => setXerProjectName(e.target.value)} className="text-sm" placeholder="Full project name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Data Date</label>
              <input type="date" value={exportDate} onChange={e => setExportDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-accessible" />
            </div>
            <div className="border border-border bg-surface-subtle rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-primary">Edit Relationships</div>
                <div className="text-xs text-primary mt-0.5">Add FS/SS/FF/SF dependencies before exporting</div>
              </div>
              <Button size="sm" variant="outline" onClick={relHandleUseCurrent}
                className="flex items-center gap-1.5 text-primary border-primary hover:bg-surface-subtle flex-shrink-0 ml-3">
                <Link2 size={13} /> Edit
              </Button>
            </div>
          </div>
        )}
        {/* XML + Relationships editor (inline when relXmlSource is loaded from xml tab) */}
        {mode === "xml" && relXmlSource && (
          <div className="space-y-4 pb-2">
            <input ref={relFileRef} type="file" accept=".xml" className="hidden" onChange={relHandleFileUpload} />
            {/* Status */}
            <div className="flex items-center gap-2 p-2.5 bg-surface-subtle border border-border rounded-lg text-xs text-primary">
              <CheckCircle size={13} className="text-primary flex-shrink-0" />
              <span><strong>{relActivities.length}</strong> activities · <strong>{relExisting.length}</strong> existing rels · <strong className="text-success">{relNew.length}</strong> new</span>
              <button onClick={() => { setRelXmlSource(null); setRelActivities([]); setRelExisting([]); setRelNew([]); }} className="ml-auto text-primary hover:text-primary text-xs underline">← Back</button>
            </div>
            {/* AI */}
            <div>
              <div className="text-xs font-semibold text-text mb-1.5">AI Generator</div>
              <textarea value={relAiPrompt} onChange={e => setRelAiPrompt(e.target.value)}
                placeholder={'e.g. "Link all activities in sequence with FS" or "Add SS between A1000 and A1010 with 5 day lag"'}
                className="w-full border border-border rounded-lg p-3 text-xs text-text resize-none focus:outline-none focus:ring-2 focus:ring-focus"
                rows={3} />
              {relAiError && <p className="text-xs text-danger mt-1">{relAiError}</p>}
              <Button size="sm" disabled={!relAiPrompt.trim() || relAiLoading} onClick={relHandleAI}
                className="mt-2 bg-primary hover:bg-primary-active text-surface w-full">
                {relAiLoading ? <><Loader2 size={12} className="animate-spin mr-1"/>Analysing...</> : <><Wand2 size={12} className="mr-1"/>Generate with AI</>}
              </Button>
            </div>
            {/* Manual */}
            <div>
              <div className="text-xs font-semibold text-text mb-1.5">Add Manually</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-text-muted mb-0.5 block">Predecessor</label>
                  <select value={relManualPred} onChange={e => setRelManualPred(e.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                    <option value="">Select...</option>
                    {relActivities.map(a => <option key={a.objectId} value={a.id}>{a.id} — {a.name.slice(0,30)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-0.5 block">Successor</label>
                  <select value={relManualSucc} onChange={e => setRelManualSucc(e.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                    <option value="">Select...</option>
                    {relActivities.map(a => <option key={a.objectId} value={a.id}>{a.id} — {a.name.slice(0,30)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-0.5 block">Type</label>
                  <select value={relManualType} onChange={e => setRelManualType(e.target.value)} className="w-full border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                    {REL_TYPES.map(t => <option key={t} value={t}>{REL_SHORT[t]} — {t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-0.5 block">Lag (days)</label>
                  <div className="flex gap-1">
                    <input type="number" value={relManualLag} onChange={e => setRelManualLag(e.target.value)} className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                    <Button size="sm" onClick={relAddManual} disabled={!relManualPred || !relManualSucc} className="bg-primary-dark hover:bg-primary-dark text-surface px-2">
                      <Plus size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            {/* New rels list */}
            {relNew.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-text mb-1.5">New Relationships ({relNew.length})</div>
                <div className="border border-border rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                  {relNew.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 text-xs ${i%2===0?"bg-surface":"bg-surface-subtle"} border-b border-border last:border-0`}>
                      <span className="font-mono text-primary font-semibold min-w-0 truncate">{r.predId}</span>
                      <span className="text-text-muted">→</span>
                      <span className="font-mono text-primary font-semibold min-w-0 truncate">{r.succId}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-xs font-bold flex-shrink-0 ${REL_COLORS[r.type]||"bg-surface-muted text-text-muted"}`}>{REL_SHORT[r.type]||r.type}</span>
                      <span className="text-text-muted flex-shrink-0">{r.lag||0}d</span>
                      <span className="text-text-muted italic truncate flex-1">{r.reason}</span>
                      <button onClick={() => setRelNew(prev => prev.filter((_,j)=>j!==i))} className="text-danger hover:text-danger flex-shrink-0"><Trash2 size={11}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        </div>{/* end scrollable */}

        {/* Sticky footer buttons */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0 flex justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          {mode === "pdf" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted leading-tight text-right max-w-[220px]"
                title="This PDF embeds the complete task data (all fields). Uploading it back restores everything instantly, without AI/OCR.">
                🔖 Tagged with the complete data embedded<br />Upload this PDF back to restore everything (no AI/OCR needed)
              </span>
              <Button size="sm" className="bg-primary hover:bg-primary-active text-surface" onClick={handleExportPDF} title="Preview the PDF, then download it">
                <Eye size={14} className="mr-1" /> Preview PDF
              </Button>
            </div>
          )}
          {mode === "excel" && excelType === "gantt" && (
            <Button size="sm" className="bg-success hover:bg-primary-dark text-surface" onClick={handleExportExcel}>
              <FileSpreadsheet size={14} className="mr-1" /> Download Excel
            </Button>
          )}
          {mode === "excel" && excelType === "p6" && (
            <Button size="sm" className="bg-success hover:bg-primary-dark text-surface" onClick={handleExportP6Excel}>
              <FileSpreadsheet size={14} className="mr-1" /> Export P6 Excel
            </Button>
          )}
          {mode === "xer" && (
            <Button size="sm" className="bg-accent-accessible hover:bg-accent-accessible text-surface" onClick={handleExportXER} disabled={!projectId || !xerProjectName}>
              <FileText size={14} className="mr-1" /> Export .xer
            </Button>
          )}
          {mode === "xml" && !relXmlSource && (
            <Button size="sm" className="bg-accent-accessible hover:bg-accent-selected text-surface" onClick={handleExportXML} disabled={!projectId || !xerProjectName}>
              <FileText size={14} className="mr-1" /> Export .xml
            </Button>
          )}
          {mode === "xml" && relXmlSource && (
            <Button size="sm" className="bg-primary hover:bg-primary-active text-surface" onClick={relDownload} disabled={relActivities.length === 0}>
              <Download size={14} className="mr-1" /> Download XML ({relExisting.length + relNew.length} rels)
            </Button>
          )}
        </div>
      </div>

      {/* Print preview — shows the exact PDF bytes produced above */}
      {pdfPreview && (
        <PdfPreviewDialog
          pdfUrl={pdfPreview.url}
          filename={pdfPreview.filename}
          pageCount={pdfPreview.pageCount}
          builtAt={pdfPreview.builtAt}
          sizeBytes={pdfPreview.sizeBytes}
          printOptions={printOptions}
          onPrintOptionChange={handlePrintOptionChange}
          barInfo={barInfo}
          onBarInfoChange={handleBarInfoChange}
          onComparisonChange={handleComparisonBarsChange}
          onComparisonArrowsChange={handleComparisonArrowsChange}
          onCjkFontChange={handleCjkFontChange}
          cjkStatus={cjkStatus}
          onDownload={handleDownloadPreviewedPdf}
          onClose={closePdfPreview}
        />
      )}
    </div>
  );
}