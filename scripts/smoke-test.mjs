import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Download, Upload, Trash2, RefreshCw, Undo, Redo, Link2, Search, GitCompare, Filter, Columns, Settings, SlidersHorizontal, Layers } from "lucide-react";
import HeaderDropdown from "@/components/gantt/HeaderDropdown";
import XmlRelationshipEditor from "@/components/gantt/XmlRelationshipEditor";
import XerMappingDialog from "@/components/gantt/XerMappingDialog";
import CompareDialog from "@/components/gantt/CompareDialog";
import { Input } from "@/components/ui/input";
import ExportDialog from "@/components/gantt/ExportDialog";
import SnapshotManager from "@/components/gantt/SnapshotManager";
import ImageImportDialog from "@/components/gantt/ImageImportDialog";
import UnifiedGanttLayout, { INIT_VISIBILITY, TIME_SCALES } from "@/components/gantt/UnifiedGanttLayout";
import FilterDialog, { applyFilters } from "@/components/gantt/FilterBar";
import ColumnVisibilityPanel from "@/components/gantt/ColumnVisibilityPanel";
import GanttSettingsPanel from "@/components/gantt/GanttSettingsPanel";
import GanttInfoPanel from "@/components/gantt/GanttInfoPanel";
import WbsSettingsPanel from "@/components/gantt/WbsSettingsPanel";
import { loadDisplaySettings, saveDisplaySettings, DATE_FORMATS } from "@/lib/displaySettings";
import ViewPresets from "@/components/gantt/ViewPresets";
import { base44 } from "@/api/base44Client";
import { computeItemLabels } from "@/lib/computeItemLabels";
import { refreshHolidaysFromWeb, getHolidaySourceInfo } from "@/lib/hkWorkingDays";
import FeedbackWidget from "@/components/FeedbackWidget";
import ImportStatusPanel, { buildImportReport } from "@/components/gantt/ImportStatusPanel";
import { hasTaskDifference } from "@/lib/taskDiff";
import { resolveImportedLinks } from "@/lib/buildRelationshipMap";
import ProjectBar from "@/components/gantt/ProjectBar";

const MIN_TABLE_W = 280;
const MAX_TABLE_W = 1400;

const DEFAULT_TASKS = [
  { id: 0,  isSection: true, sectionType: "blue", activity: "Baseline Programme (Planned Period)", showComparison: false },
  { id: 1,  item: "A1",  activityId: "CLP-5960",       activity: "Abandon 11kV cables at STK Road and MS Road (portion)",                                                      start: "2024-07-14", end: "2024-07-30", barType: "baseline" },
  { id: 2,  item: "A2",  activityId: "INTS2-1030a",    activity: "Noise Barier Footing-Northbound",                                                                             start: "2024-07-31", end: "2024-08-31", barType: "baseline" },
  { id: 3,  item: "A3",  activityId: "INTS2-1030-1",   activity: "Noise Barrier Footing-Central Median",                                                                        start: "2024-09-02", end: "2024-10-31", barType: "baseline" },
  { id: 4,  item: "A4",  activityId: "INTS2-1030-2",   activity: "Noise Barrier Footing-Southbound",                                                                            start: "2024-11-01", end: "2024-12-30", barType: "baseline" },
  { id: 5,  item: "A5",  activityId: "INTS2-1050",     activity: "UU Works (drainage)- Southbound Sha Tau Kok Road (after TTA2)-Part 1",                                       start: "2024-12-31", end: "2025-03-14", barType: "baseline" },
  { id: 6,  item: "A6",  activityId: "INTS2-1160",     activity: "Backfilling works (Sha Tau Kok Road)",                                                                        start: "2025-03-15", end: "2025-05-21", barType: "baseline" },
  { id: 7,  item: "A7",  activityId: "INTS2-1160a",    activity: "Pavement works (Sha Tau Kok Road)",                                                                           start: "2025-05-22", end: "2025-07-03", barType: "baseline" },
  { id: 8,  item: "A8",  activityId: "INTS2-1160b",    activity: "Road lighting along STK Road (for TTA no.3)",                                                                 start: "2025-07-04", end: "2025-08-01", barType: "baseline" },
  { id: 9,  item: "A9",  activityId: "PD-1140",        activity: "S11 Remainder of the works not covered by other sections of the works",                                      start: "2025-08-02", end: "2025-08-02", barType: "baseline" },
  { id: 10, isSection: true, sectionType: "pink", activity: "Delay Analysis Programme", showComparison: false },
  { id: 11, item: "B1",  activityId: "CLP-5960",       activity: "Abandon 11kV cables at STK Road and MS Road (portion)",                                                      start: "2024-07-14", end: "2024-07-30", barType: "baseline" },
  { id: 12, item: "B2",  activityId: "INTS2-1030a",    activity: "Noise Barier Footing-Northbound",                                                                             start: "2024-07-31", end: "2024-08-31", barType: "baseline" },
  { id: 13, item: "DE1", activityId: "UTR-3005 Cn CE", activity: "Noise Barier Footing-Northbound (Delay Period) (CE)",                                                        start: "2024-09-01", end: "2024-12-26", barType: "delay" },
  { id: 14, item: "B3",  activityId: "INTS2-1030-1",   activity: "Noise Barrier Footing-Central Median",                                                                        start: "2024-12-27", end: "2025-02-24", barType: "baseline" },
  { id: 15, item: "B4",  activityId: "INTS2-1030-2",   activity: "Noise Barrier Footing-Southbound",                                                                            start: "2025-02-25", end: "2025-04-25", barType: "baseline" },
  { id: 16, item: "B5",  activityId: "INTS2-1050",     activity: "UU Works (drainage)- Southbound Sha Tau Kok Road (after TTA2)-Part 1",                                       start: "2025-04-26", end: "2025-07-08", barType: "baseline" },
  { id: 17, item: "B6",  activityId: "INTS2-1160",     activity: "Backfilling works (Sha Tau Kok Road)",                                                                        start: "2025-07-09", end: "2025-09-14", barType: "baseline" },
  { id: 18, item: "B7",  activityId: "INTS2-1160a",    activity: "Pavement works (Sha Tau Kok Road)",                                                                           start: "2025-09-15", end: "2025-10-27", barType: "baseline" },
  { id: 19, item: "B8",  activityId: "INTS2-1160b",    activity: "Road lighting along STK Road (for TTA no.3)",                                                                 start: "2025-10-28", end: "2025-11-25", barType: "baseline" },
  { id: 20, item: "B9",  activityId: "PD-1140",        activity: "S11 Remainder of the works not covered by other sections of the works",                                      start: "2025-11-26", end: "2025-11-26", barType: "baseline" },
];

// nextId is now per-session, starting from max existing ID + 1
const getNextId = (tasks) => Math.max(0, ...tasks.map(t => t.id)) + 1;

function parseExcelDate(value) {
  if (!value) return null;
  const cleaned = value.trim();
  const num = Number(cleaned);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  const m1 = cleaned.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2,'0')}-${m1[3].padStart(2,'0')}`;
  const m2 = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
  const d = new Date(cleaned);
  if (!isNaN(d.getTime()) && cleaned.length >= 6) return d.toISOString().slice(0, 10);
  return null;
}

export default function GanttPage() {
  const [tasks, setTasks] = useState(() => {
    // Initialize with a fresh copy of DEFAULT_TASKS
    return JSON.parse(JSON.stringify(DEFAULT_TASKS));
  });
  const [searchQuery, setSearchQuery] = useState("");
  // Track nextId in state to avoid global variable issues
  const [nextId, setNextId] = useState(() => getNextId(DEFAULT_TASKS));
  
  const [labelOffsets, setLabelOffsets] = useState({});
  const [history, setHistory] = useState(() => [JSON.parse(JSON.stringify(DEFAULT_TASKS))]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [labelOffsetsHistory, setLabelOffsetsHistory] = useState([{}]);
  const [holidaySource, setHolidaySource] = useState(null);
  const [holidayRefreshing, setHolidayRefreshing] = useState(false);
  const [sortState, setSortState] = useState({ field: null, dir: null });
  const [ganttFilters, setGanttFilters] = useState({ logic: "all", conditions: [], groups: [] });
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);
  const [showRelationFilter, setShowRelationFilter] = useState(false);
  const [relationTypeFilter, setRelationTypeFilter] = useState({ FS: true, SS: true, FF: true, SF: true });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [columnVisibility, setColumnVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem("gantt_column_visibility");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          console.log("GanttPage: Loaded columnVisibility from localStorage", parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load column visibility:", e);
    }
    // Return null - UnifiedGanttLayout will use its default
    return null;
  });
  // Compute tasks on every render to ensure latest state is always shown (no caching)
  // NOTE: displaySettings must be declared BEFORE the derived-task block below,
  // because the "Hide Empty WBS Rows" filter reads it (batch 8).
  const [displaySettings, setDisplaySettings] = useState(loadDisplaySettings);
  useEffect(() => { saveDisplaySettings(displaySettings); }, [displaySettings]);
  const labeled = computeItemLabels(tasks);
  let filtered = labeled;

  // Search query filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.isSection ||
      (t.activity && t.activity.toLowerCase().includes(query)) ||
      (t.activityId && t.activityId.toLowerCase().includes(query)) ||
      (t.item && t.item.toLowerCase().includes(query))
    );
  }

  // P6-style conditions filter
  filtered = applyFilters(filtered, ganttFilters);

  // Relationship filter — show ONLY the selected task(s) and their DIRECT
  // predecessors/successors (one hop, not full graph traversal).
  // Optionally filtered by relationship type (FS/SS/FF/SF).
  if (showRelationFilter && selectedIds.size > 0) {
    // Build type-aware edges: Map<taskId, Map<neighborId, Set<type>>>
    const edges = new Map();
    const ensureEdge = (id) => {
      const n = Number(id);
      if (!edges.has(n)) edges.set(n, new Map());
      return edges.get(n);
    };
    tasks.forEach(t => {
      if (t.isSection) return;
      ensureEdge(t.id);
      if (t.links && Array.isArray(t.links)) {
        t.links.forEach(l => {
          if (!l.succId) return;
          const a = ensureEdge(t.id);
          const b = ensureEdge(l.succId);
          const tp = (l.type || "FS").toUpperCase();
          if (!a.has(Number(l.succId))) a.set(Number(l.succId), new Set());
          a.get(Number(l.succId)).add(tp);
          if (!b.has(Number(t.id))) b.set(Number(t.id), new Set());
          b.get(Number(t.id)).add(tp);
        });
      }
      if (t.link) {
        const a = ensureEdge(t.id);
        const b = ensureEdge(t.link);
        const tp = (t.linkType || "FS").toUpperCase();
        if (!a.has(Number(t.link))) a.set(Number(t.link), new Set());
        a.get(Number(t.link)).add(tp);
        if (!b.has(Number(t.id))) b.set(Number(t.id), new Set());
        b.get(Number(t.id)).add(tp);
      }
    });

    const anyTypeSelected = relationTypeFilter.FS || relationTypeFilter.SS || relationTypeFilter.FF || relationTypeFilter.SF;
    const relatedIds = new Set();
    selectedIds.forEach(id => {
      const numId = Number(id);
      relatedIds.add(numId);
      const neighbors = edges.get(numId);
      if (!neighbors) return;
      neighbors.forEach((types, neighborId) => {
        if (!anyTypeSelected) { relatedIds.add(neighborId); return; }
        for (const tp of types) {
          if (relationTypeFilter[tp]) { relatedIds.add(neighborId); return; }
        }
      });
    });
    // Work from the full labeled list (not pre-filtered) so related items are never hidden
    const taskFiltered = labeled.filter(t => t.isSection || relatedIds.has(t.id));
    filtered = taskFiltered.filter((t, i) => {
      if (!t.isSection) return true;
      // Keep section only if at least one non-section task follows it before the next section
      for (let j = i + 1; j < taskFiltered.length; j++) {
        if (taskFiltered[j].isSection) break;
        return true;
      }
      return false;
    });
  }

  // "Show only differences" quick filter — hide tasks with no diff AND sections with no visible tasks
  if (showOnlyDiff) {
    const diffFiltered = filtered.filter(t => t.isSection || hasTaskDifference(t, columnVisibility));
    filtered = diffFiltered.filter((t, i) => {
      if (!t.isSection) return true;
      // Keep section only if at least one non-section task follows it before the next section
      for (let j = i + 1; j < diffFiltered.length; j++) {
        if (diffFiltered[j].isSection) break;
        return true;
      }
      return false;
    });
  }

  // "Hide Empty WBS Rows" (WBS Settings) — drop WBS rows that hold no activities.
  // The XER parser tags them (`emptyWbs`) instead of deleting them, so the toggle can
  // bring them back; the default (hideEmpty !== false) reproduces the previous look.
  if (displaySettings?.wbs?.hideEmpty !== false) {
    filtered = filtered.filter(t => !(t.isSection && t.emptyWbs));
  }

  const computedTasks = filtered;

  // Apply the same sort that UnifiedGanttLayout uses, for export (no caching)
  let sortedComputedTasksForExport = computedTasks;
  if (sortState.field) {
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
    sortedComputedTasksForExport = result;
  }

  // Save to history before making changes (max 50 states)
  const saveToHistory = useCallback((newTasks) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newTasks)));
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
    setLabelOffsetsHistory(prev => {
      const newHist = prev.slice(0, historyIndex + 1);
      newHist.push({...labelOffsets});
      if (newHist.length > 50) newHist.shift();
      return newHist;
    });
  }, [historyIndex, labelOffsets]);



  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setTasks(prevState);
      setHistoryIndex(prev => prev - 1);
      setLabelOffsets(labelOffsetsHistory[historyIndex - 1] || {});
    }
  }, [history, historyIndex, labelOffsetsHistory]);

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setTasks(nextState);
      setHistoryIndex(prev => prev + 1);
      setLabelOffsets(labelOffsetsHistory[historyIndex + 1] || {});
    }
  }, [history, historyIndex, labelOffsetsHistory]);

  const [viewMode, setViewMode] = useState("month");
  const [showToday, setShowToday] = useState(true);
  const [projectTitle, setProjectTitle] = useState("Project Gantt Chart");
  // Active project in the LOCAL backend (project + version storage) — see ProjectBar.
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);
  const [importInitialFile, setImportInitialFile] = useState(null);
  const [showXerMapping, setShowXerMapping] = useState(false);
  const [showXmlRelEditor, setShowXmlRelEditor] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [tableWidth, setTableWidth] = useState(430);
  
  // Handler for column visibility changes from UnifiedGanttLayout
  const handleColumnVisibilityChange = useCallback((newVisibility) => {
    console.log("GanttPage: Received columnVisibility change", newVisibility);
    setColumnVisibility(newVisibility);
  }, []);
  
  // Default visibility for BL columns (matches UnifiedGanttLayout DEFAULT_HIDDEN)
  const BL_COLUMNS_HIDDEN_BY_DEFAULT = true;
  const [cw, setCw] = useState(() => {
    try {
      const saved = localStorage.getItem("gantt_column_widths");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [durMode, setDurMode] = useState("cal"); // "wd" | "cal"
  const [tableFontScale, setTableFontScale] = useState(1.0);
  const [showFontSlider, setShowFontSlider] = useState(false);
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);
  const [showStaircase, setShowStaircase] = useState(true);
  const [showRelationshipLines, setShowRelationshipLines] = useState(true);
  // (displaySettings is declared earlier — the WBS empty-row filter needs it first)
  const [staircaseFilter, setStaircaseFilter] = useState(null); // null = show all
  const [showFilter, setShowFilter] = useState(false);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showGanttSettings, setShowGanttSettings] = useState(false);
  const [showWbsSettings, setShowWbsSettings] = useState(false);
  // Raw XER tables of the imported programme (null when it did not come from an XER).
  // Passed to the export dialogs so XER → XER keeps every table and every value.
  const [xerSource, setXerSource] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // ── Information panel: header height (the panel is anchored under it) ──────
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(53);
  useEffect(() => {
    const measure = () => {
      const h = headerRef.current?.getBoundingClientRect().height;
      if (h) setHeaderHeight(Math.round(h));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // The panel follows the selection; only a single selected activity is shown
  const infoTask = useMemo(() => {
    if (!selectedIds || selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return computedTasks.find(t => t.id === id && !t.isSection) || null;
  }, [selectedIds, computedTasks]);

  const handleInfoJump = (id) => {
    setSelectedIds(new Set([id]));
    const el = document.querySelector(`[data-task-id="${id}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  // Programme structure: ids of collapsed sections (shared with the settings panel)
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const handleToggleSection = useCallback((id) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const handleExpandAllSections = useCallback(() => setCollapsedIds(new Set()), []);
  const handleCollapseAllSections = useCallback(() => {
    setCollapsedIds(new Set(tasks.filter(t => t.isSection).map(t => t.id)));
  }, [tasks]);
  const [importReport, setImportReport] = useState(null);
  const resizing = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showFontSlider && !e.target.closest("button")) {
        setShowFontSlider(false);
      }
      if (showViewModeDropdown && !e.target.closest("button")) {
        setShowViewModeDropdown(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [showFontSlider, showViewModeDropdown]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      // Ctrl+A: Select all tasks
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const allTaskIds = new Set(computedTasks.filter(t => !t.isSection).map(t => t.id));
        setSelectedIds(allTaskIds);
      }
      // Ctrl+Z: Undo
      else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y or Ctrl+Shift+Z: Redo
      else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        redo();
      }
      // Ctrl+Shift+S: Toggle staircase line
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setShowStaircase(v => !v);
      }
      // Ctrl+Shift+D: Toggle "show only differences"
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setShowOnlyDiff(v => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [computedTasks, setSelectedIds, undo, redo]);

  // Auto-refresh holidays on mount (non-blocking)
  useEffect(() => {
    const doRefresh = async () => {
      try {
        setHolidayRefreshing(true);
        await refreshHolidaysFromWeb(base44);
        setHolidaySource(getHolidaySourceInfo());
      } catch (e) {
        console.error("Failed to refresh holidays:", e);
      } finally {
        setHolidayRefreshing(false);
      }
    };
    // Run after initial render
    const timer = setTimeout(doRefresh, 100);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showFontSlider && !e.target.closest("button")) {
        setShowFontSlider(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [showFontSlider]);

  const startResize = (e) => {
    e.preventDefault();
    resizing.current = { startX: e.clientX, startW: tableWidth };
    const onMove = (ev) => {
      const delta = ev.clientX - resizing.current.startX;
      setTableWidth(Math.min(MAX_TABLE_W, Math.max(MIN_TABLE_W, resizing.current.startW + delta)));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Persist layout to localStorage
  useEffect(() => {
    if (columnVisibility) {
      console.log("GanttPage: Saving columnVisibility to localStorage", columnVisibility);
      localStorage.setItem("gantt_column_visibility", JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);
  
  // Debug: log columnVisibility changes in parent
  useEffect(() => {
    console.log("GanttPage: columnVisibility state changed", columnVisibility);
  }, [columnVisibility]);
  useEffect(() => {
    if (Object.keys(cw).length > 0) localStorage.setItem("gantt_column_widths", JSON.stringify(cw));
  }, [cw]);

  const handlePaste = useCallback((e) => {
    const text = e.clipboardData.getData("text");
    if (!text || !text.includes("\t")) return;
    const rows = text.trim().split(/\r?\n/);
    const parsedTasks = rows.map(row => {
      const cells = row.split("\t").map(c => c.trim());
      const task = { item: "", activity: "", start: "", end: "" };
      const dates = [];
      const texts = [];
      cells.forEach(cell => {
        const parsed = parseExcelDate(cell);
        if (parsed) dates.push(parsed);
        else if (cell) texts.push(cell);
      });
      if (texts[0] !== undefined) task.item = texts[0];
      if (texts[1] !== undefined) task.activity = texts[1];
      if (dates[0] !== undefined) task.start = dates[0];
      if (dates[1] !== undefined) task.end = dates[1];
      return task;
    }).filter(t => t.item || t.activity || t.start || t.end);
    if (parsedTasks.length === 0) return;

    saveToHistory(tasks);
    if (selectedIds.size > 0) {
      const selectedArr = [...tasks.map(t => t.id).filter(id => selectedIds.has(id))];
      setTasks(prev => {
        const updated = [...prev];
        selectedArr.forEach((id, i) => {
          if (i < parsedTasks.length) {
            const idx = updated.findIndex(t => t.id === id);
            if (idx !== -1) updated[idx] = { ...updated[idx], ...parsedTasks[i] };
          }
        });
        if (parsedTasks.length > selectedArr.length) {
          const extra = parsedTasks.slice(selectedArr.length).map(t => ({ ...t, id: getNextId(updated) }));
          return [...updated, ...extra];
        }
        return updated;
      });
      setNextId(prev => getNextId(tasks));
      setSelectedIds(new Set());
    } else {
      setTasks(prev => {
        const newTasks = [...prev, ...parsedTasks.map(t => ({ ...t, id: getNextId(prev) }))];
        return newTasks;
      });
      setNextId(getNextId(tasks) + parsedTasks.length);
    }
  }, [selectedIds, tasks, saveToHistory]);

  // Load a project / version payload into the editor — wired to ProjectBar.
  // Mirrors what an import does: resolve relationship links, push an undo step,
  // replace the task list, and keep the raw XER tables (for lossless XER export)
  // when the payload came straight from an uploaded .xer file.
  const handleProjectLoaded = useCallback((project, payload, xerTables) => {
    if (project) {
      setCurrentProjectId(project.id);
      if (project.name) setProjectTitle(project.name);
    } else {
      setCurrentProjectId(null);
    }
    if (payload && Array.isArray(payload.tasks)) {
      const resolvedTasks = resolveImportedLinks(payload.tasks);
      saveToHistory(tasks);
      if (xerTables) setXerSource(xerTables);
      setTasks(resolvedTasks);
      setNextId(getNextId(resolvedTasks) + 1);
      setSelectedIds(new Set());
    }
  }, [saveToHistory, tasks]);

  return (
    <div className="relative h-screen bg-surface-subtle flex flex-col overflow-hidden">
      {/* Header — fully sticky, never scrolls */}
      <div ref={headerRef} className="flex-shrink-0 bg-primary-dark text-surface px-6 py-3 flex items-center justify-between shadow-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-accent rounded-sm" />
          <Input
            value={projectTitle}
            onChange={e => setProjectTitle(e.target.value)}
            className="bg-transparent border-none text-surface font-semibold text-lg p-0 h-auto focus-visible:ring-0 w-80"
          />
          <ProjectBar
            currentProjectId={currentProjectId}
            tasks={tasks}
            onProjectLoaded={handleProjectLoaded}
          />
        </div>
        <div className="flex items-center gap-2">

          {/* ── Search ── */}
          <div className="relative flex items-center">
            <Search size={12} className="absolute left-2.5 text-surface/70 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="bg-primary-active/60 text-surface placeholder:text-surface/70 text-xs rounded-full pl-7 pr-3 py-1 outline-none focus:bg-primary-active/80 w-32 focus:w-48 transition-all"
            />
          </div>

          {/* ── Group 1: View mode ── */}
          <div className="relative">
            <button
              onClick={() => setShowViewModeDropdown(v => !v)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all text-surface/70 hover:text-surface flex items-center gap-1"
              title="View mode"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              {(TIME_SCALES.find(s => s.value === viewMode) || TIME_SCALES[0]).label}
            </button>
            {showViewModeDropdown && (
              <div className="absolute right-0 top-9 bg-surface rounded-lg shadow-xl border border-border p-2 z-50 w-40">
                <div className="px-2 pb-1 text-[10px] uppercase tracking-wide text-text-muted">Time Scale</div>
                {TIME_SCALES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => { setViewMode(s.value); setShowViewModeDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      viewMode === s.value ? "bg-primary text-surface" : "text-text hover:bg-surface-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Settings (unified panel: WBS / Activity List / Timeline & Grid / Gantt Bars / Other) ── */}
          <button
            onClick={() => setShowGlobalSettings(true)}
            className="px-2 py-1 rounded-full text-text-muted hover:text-surface hover:bg-primary-dark transition-all flex items-center gap-1"
            title="Settings — WBS, Activity List, Timeline & Grid, Gantt Bars, Other"
          >
            <Settings size={15} />
            <span className="text-xs font-medium">Settings</span>
          </button>

          {/* ── Activity information panel ── */}
          <button
            onClick={() => setShowInfoPanel(v => !v)}
            className={`px-2 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
              showInfoPanel ? "bg-primary text-surface" : "text-text-muted hover:text-surface hover:bg-primary-dark"
            }`}
            title="Information panel — activity details, resources, relationships, codes, notebook"
            aria-pressed={showInfoPanel}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853L14.25 14.25M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span className="hidden lg:inline">Info</span>
          </button>

          {/* ── Tools (collapsed) ── */}
          <HeaderDropdown
            icon={Settings}
            label="Tools"
            active={ganttFilters?.conditions?.length > 0 || ganttFilters?.groups?.length > 0}
            activeColor="bg-surface text-primary"
          >
            <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
              <ViewPresets
                columnVisibility={columnVisibility}
                onApply={(vis) => setColumnVisibility(vis)}
              />
              <button
                onClick={() => setShowColumnPanel(true)}
                className="w-full text-left px-3 py-1.5 rounded text-xs font-medium text-text hover:bg-surface-muted flex items-center gap-2"
              >
                <Columns size={14} /> Column Visibility
              </button>
              <button
                onClick={() => setShowFilter(true)}
                className="w-full text-left px-3 py-1.5 rounded text-xs font-medium text-text hover:bg-surface-muted flex items-center gap-2"
              >
                <Filter size={14} /> P6 Filters
                {(ganttFilters?.conditions?.length > 0 || ganttFilters?.groups?.length > 0) && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
              <button
                onClick={() => setShowCompare(true)}
                className="w-full text-left px-3 py-1.5 rounded text-xs font-medium text-text hover:bg-surface-muted flex items-center gap-2"
              >
                <GitCompare size={14} /> Compare Versions
              </button>
              <button
                onClick={() => setShowXmlRelEditor(true)}
                className="w-full text-left px-3 py-1.5 rounded text-xs font-medium text-text hover:bg-surface-muted flex items-center gap-2"
              >
                <Link2 size={14} /> XML Relationship Editor
              </button>
              <button
                onClick={async () => {
                  setHolidayRefreshing(true);
                  localStorage.removeItem("hk_holidays_cache");
                  await refreshHolidaysFromWeb(base44);
                  setHolidaySource(getHolidaySourceInfo());
                  setHolidayRefreshing(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded text-xs font-medium text-text hover:bg-surface-muted flex items-center gap-2"
              >
                <RefreshCw size={14} className={holidayRefreshing ? "animate-spin" : ""} /> Refresh Holidays
              </button>
              <div className="border-t border-border my-1" />
              <div className="px-3 py-1">
                <SnapshotManager
                  tasks={tasks}
                  columnVisibility={columnVisibility}
                  cw={cw}
                  onRestore={(restoredTasks, restoredColumnVisibility, restoredCw) => {
                    saveToHistory(tasks);
                    setTasks(restoredTasks);
                    if (restoredColumnVisibility) setColumnVisibility(restoredColumnVisibility);
                    if (restoredCw) setCw(prev => ({ ...prev, ...restoredCw }));
                    setSelectedIds(new Set());
                  }}
                />
              </div>
            </div>
          </HeaderDropdown>

          {/* ── Import / Export ── */}
          <div className="flex items-center bg-primary-active/60 rounded-full p-0.5 gap-0">
            <button
              onClick={() => setShowImageImport(true)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all text-surface/70 hover:text-surface flex items-center gap-1"
              title="Import data (PDF/Image/Excel/XER/XML)"
            >
              <Upload size={14} />
            </button>
            <button
              onClick={() => setShowExport(true)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all text-surface/70 hover:text-surface flex items-center gap-1"
              title="Export to PDF/Excel/XER/XML"
            >
              <Download size={14} />
            </button>
          </div>

          {/* ── Group 5: History + Clear ── */}
          <div className="flex items-center bg-primary-active/60 rounded-full p-0.5 gap-0">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                historyIndex <= 0 ? "text-surface/50 cursor-not-allowed" : "text-surface/70 hover:text-surface"
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo size={14} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                historyIndex >= history.length - 1 ? "text-surface/50 cursor-not-allowed" : "text-surface/70 hover:text-surface"
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo size={14} />
            </button>
          </div>

          {/* ── Clear (standalone, danger) ── */}
          <button
            onClick={() => { if (window.confirm("Clear all data? This cannot be undone.")) { setTasks([]); setSelectedIds(new Set()); } }}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all bg-primary-active/60 text-surface/70 hover:text-surface hover:bg-danger flex items-center gap-1"
            title="Clear all data"
          >
            <Trash2 size={14} />
          </button>

        </div>
      </div>

      {/* Filter dialog */}
      <FilterDialog open={showFilter} onClose={() => setShowFilter(false)} filters={ganttFilters} onFiltersChange={setGanttFilters} />

      {/* Column visibility panel */}
      {showColumnPanel && (
        <ColumnVisibilityPanel
          columnVisibility={columnVisibility}
          setColumnVisibility={setColumnVisibility}
          onClose={() => setShowColumnPanel(false)}
        />
      )}

      {/* Gantt Settings panel (bars / labels / grid / time scale) */}
      {showGanttSettings && (
        <GanttSettingsPanel
          displaySettings={displaySettings}
          onChange={setDisplaySettings}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          collapsedCount={collapsedIds.size}
          onExpandAll={handleExpandAllSections}
          onCollapseAll={handleCollapseAllSections}
          onClose={() => setShowGanttSettings(false)}
        />
      )}

      {/* WBS Settings panel (row colour scheme per WBS level) */}
      {showWbsSettings && (
        <WbsSettingsPanel
          displaySettings={displaySettings}
          onChange={setDisplaySettings}
          onClose={() => setShowWbsSettings(false)}
        />
      )}



      {/* Main content: unified layout with shared scroll */}
      <UnifiedGanttLayout
        tasks={tasks}
        setTasks={setTasks}
        computedTasks={computedTasks}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        onPaste={handlePaste}
        durMode={durMode}
        setDurMode={setDurMode}
        viewMode={viewMode}
        showToday={showToday}
        labelOffsets={labelOffsets}
        setLabelOffsets={setLabelOffsets}
        tableWidth={tableWidth}
        startResize={startResize}
        saveToHistory={saveToHistory}
        tableFontScale={tableFontScale}
        sortState={sortState}
        setSortState={setSortState}
        onOpenImport={() => { setImportInitialFile(null); setShowImageImport(true); }}
        onDropImport={(file) => { setImportInitialFile(file); setShowImageImport(true); }}
        showStaircase={showStaircase}
        showRelationshipLines={showRelationshipLines}
        staircaseFilter={staircaseFilter}
        onStaircaseFilterChange={setStaircaseFilter}
        onFiltersLoaded={setGanttFilters}
        columnVisibility={columnVisibility}
        cw={cw}
        setCw={setCw}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        onOpenColumnPanel={() => setShowColumnPanel(true)}
        displaySettings={displaySettings}
        collapsedIds={collapsedIds}
        onToggleSection={handleToggleSection}
        onExpandAll={handleExpandAllSections}
        onCollapseAll={handleCollapseAllSections}
      />

      {/* Activity information panel (slides in from the right) */}
      <GanttInfoPanel
        open={showInfoPanel}
        task={infoTask}
        tasks={computedTasks}
        onClose={() => setShowInfoPanel(false)}
        onJumpToTask={handleInfoJump}
        headerHeight={headerHeight}
        dateFormat={displaySettings.dateFormat || "yyyy-MM-dd"}
        durMode={durMode}
      />

      {showExport && (
        <ExportDialog
          tasks={sortedComputedTasksForExport}
          projectTitle={projectTitle}
          labelOffsets={labelOffsets}
          durMode={durMode}
          showStaircase={showStaircase}
          columnVisibilityProp={columnVisibility}
          cwProp={cw}
          displaySettings={displaySettings}
          onDisplaySettingsChange={setDisplaySettings}
          xerSource={xerSource}
          onClose={() => setShowExport(false)}
          onOpenXerMapping={() => { setShowExport(false); setShowXerMapping(true); }}
        />
      )}

      {showXerMapping && (
        <XerMappingDialog
          tasks={sortedComputedTasksForExport}
          onClose={() => setShowXerMapping(false)}
          onSave={() => { setShowXerMapping(false); setShowExport(true); }}
        />
      )}

      {showXmlRelEditor && (
        <XmlRelationshipEditor
          tasks={sortedComputedTasksForExport}
          exportOpts={{ projectId: "PROJ001", projectName: projectTitle, exportDate: new Date().toISOString().slice(0, 10) }}
          onClose={() => setShowXmlRelEditor(false)}
          onApplyToGantt={(updates) => {
            saveToHistory(tasks);
            setTasks(prev => prev.map(t =>
              updates[t.id] ? { ...t, ...updates[t.id] } : t
            ));
          }}
        />
      )}

      <FeedbackWidget />

      <ImportStatusPanel
        report={importReport}
        onClose={() => setImportReport(null)}
      />

      {showImageImport && (
        <ImageImportDialog
          initialFile={importInitialFile}
          onClose={() => { setShowImageImport(false); setImportInitialFile(null); }}
          onSetProjectTitle={(fileName) => setProjectTitle(fileName)}
          onImport={(rawTasks, importMode, fileType, xerTables) => {
            if (xerTables) setXerSource(xerTables);   // enables lossless XER → XER export
            saveToHistory(tasks);
            if (importMode === "set_baseline") {
              // Build a lookup: activityId (case-insensitive) → { blStart, blEnd, raw }
              // Prefer explicit BL fields from XER; fall back to start/end
              const blMap = {};
              rawTasks.forEach(t => {
                if (!t.isSection && t.activityId) {
                  blMap[t.activityId.trim().toLowerCase()] = {
                    blStart: t.baselineStart || t.start || "",
                    blEnd:   t.baselineFinish || t.end   || "",
                    raw: t,
                  };
                }
              });
              let matchedCount = 0;
              let unmatchedCount = 0;
              setTasks(prev => {
                // If no existing tasks — BL imported first into empty project.
                // Import BL as a full programme (with sections, start/end, activity
                // names) and set BL dates on each task. Don't create a "deleted"
                // section yet — we don't know what's deleted until the current
                // programme is appended.
                const hasExisting = prev.some(t => !t.isSection);
                if (!hasExisting) {
                  // BL imported into empty project: import full programme structure
                  // (sections, activities) but mark all tasks as deletedFromBL so
                  // bars render red. start/end stay empty — BL dates carry the bar.
                  const newBLTasks = rawTasks.map(t => ({
                    ...t,
                    id: getNextId(prev),
                    activityId: t.activityId || "",
                    activity: t.activity || "",
                    start: "",
                    end: "",
                    baselineStart: t.baselineStart || t.start || "",
                    baselineFinish: t.baselineFinish || t.end || "",
                    barType: t.barType || "baseline",
                    deletedFromBL: true,
                    ...(t.isSection ? { isSection: true, sectionType: t.sectionType || "blue" } : {}),
                  }));
                  const resolvedBL = resolveImportedLinks(newBLTasks);
                  setNextId(getNextId(resolvedBL));
                  return resolvedBL;
                }
                // Track which activityIds exist in current project
                const existingIds = new Set();
                const updated = prev.map(t => {
                  if (t.isSection || !t.activityId) return t;
                  existingIds.add(t.activityId.trim().toLowerCase());
                  const bl = blMap[t.activityId.trim().toLowerCase()];
                  if (!bl || (!bl.blStart && !bl.blEnd)) return t;
                  matchedCount++;
                  // Only update BL dates — no other fields are touched
                  return { ...t, baselineStart: bl.blStart, baselineFinish: bl.blEnd };
                });
                // Find BL items that don't exist in current project — add them as new rows
                const unmatchedBL = rawTasks.filter(t => {
                  if (t.isSection || !t.activityId) return false;
                  return !existingIds.has(t.activityId.trim().toLowerCase());
                });
                if (unmatchedBL.length === 0) return updated;
                unmatchedCount = unmatchedBL.length;
                // Add unmatched BL items under a BL section so they show in comparison
                // Mark each with deletedFromBL so the bar renders red
                // Compute item labels: for each deleted item, find its activityId
                // prefix (e.g. "WSD-W-A1-") among existing tasks to inherit the item
                // label prefix (e.g. "AH"). Then collect ALL numbers (existing +
                // deleted) for that prefix, sort them, and use the deleted item's
                // RANK in that sorted list as the sequence number.
                // e.g. existing: 110→AH1, 120→AH2, 130→AH3, 140→AH4
                //      deleted 115 → rank 2 → AH2, deleted 215 → rank 6 → AH6
                const labeledPrev = computeItemLabels(updated);
                const prefixLabel = {}; // activityIdPrefix → itemLabelPrefix
                const prefixNums = {}; // activityIdPrefix → [num, ...]
                labeledPrev.forEach(t => {
                  if (t.isSection || !t.activityId || !t._resolvedItem) return;
                  const idMatch = t.activityId.match(/^(.*?)(\d+)$/);
                  if (!idMatch) return;
                  const labelMatch = t._resolvedItem.match(/^(.*?)(\d+)$/);
                  if (!labelMatch) return;
                  const p = idMatch[1];
                  if (!prefixLabel[p]) prefixLabel[p] = labelMatch[1];
                  if (!prefixNums[p]) prefixNums[p] = [];
                  prefixNums[p].push(parseInt(idMatch[2], 10));
                });
                // Include deleted items' numbers in the sorted lists
                unmatchedBL.forEach(t => {
                  const idMatch = (t.activityId || "").match(/^(.*?)(\d+)$/);
                  if (!idMatch) return;
                  const p = idMatch[1];
                  if (!prefixNums[p]) prefixNums[p] = [];
                  prefixNums[p].push(parseInt(idMatch[2], 10));
                });
                Object.values(prefixNums).forEach(arr => arr.sort((a, b) => a - b));
                const blSection = {
                  id: getNextId(updated),
                  isSection: true,
                  sectionType: "pink",
                  activity: "Baseline (Deleted Activities)",
                  showComparison: false,
                };
                const newBLTasks = unmatchedBL.map(t => {
                  const idMatch = (t.activityId || "").match(/^(.*?)(\d+)$/);
                  let customItem = t.item;
                  if (!customItem && idMatch) {
                    const p = idMatch[1];
                    const labelPrefix = prefixLabel[p];
                    const nums = prefixNums[p];
                    if (labelPrefix && nums) {
                      const rank = nums.indexOf(parseInt(idMatch[2], 10)) + 1;
                      if (rank > 0) customItem = `${labelPrefix}${rank}`;
                    }
                  }
                  const newId = getNextId([...updated, blSection]);
                  return {
                    id: newId,
                    activityId: t.activityId || "",
                    activity: t.activity || "",
                    start: "",
                    end: "",
                    baselineStart: t.baselineStart || t.start || "",
                    baselineFinish: t.baselineFinish || t.end || "",
                    barType: t.barType || "baseline",
                    deletedFromBL: true,
                    ...(customItem ? { customItem } : {}),
                  };
                });
                const result = resolveImportedLinks([...updated, blSection, ...newBLTasks]);
                setNextId(getNextId(result));
                return result;
              });
              // Build a report that reflects the actual mapping result, not just raw import
              const nonSectionRaw = rawTasks.filter(t => !t.isSection);
              const blKeys = Object.keys(blMap).filter(k => blMap[k].blStart || blMap[k].blEnd);
              setImportReport({
                fileType: fileType || "File",
                total: nonSectionRaw.length,
                fields: [
                  { key: "activityId",    label: "Activity ID",       critical: true,  filled: nonSectionRaw.length, total: nonSectionRaw.length, pct: 100 },
                  { key: "activity",      label: "Activity Name",      critical: true,  filled: nonSectionRaw.length, total: nonSectionRaw.length, pct: 100 },
                  { key: "start",         label: "Start Date",         critical: true,  filled: nonSectionRaw.filter(t => t.start).length, total: nonSectionRaw.length, pct: Math.round(nonSectionRaw.filter(t => t.start).length / Math.max(1, nonSectionRaw.length) * 100) },
                  { key: "end",           label: "End Date",           critical: true,  filled: nonSectionRaw.filter(t => t.end).length, total: nonSectionRaw.length, pct: Math.round(nonSectionRaw.filter(t => t.end).length / Math.max(1, nonSectionRaw.length) * 100) },
                  { key: "remainDur",     label: "Remaining Duration", critical: false, filled: nonSectionRaw.filter(t => t.remainDur != null).length, total: nonSectionRaw.length, pct: Math.round(nonSectionRaw.filter(t => t.remainDur != null).length / Math.max(1, nonSectionRaw.length) * 100) },
                  { key: "float",         label: "Total Float",        critical: false, filled: nonSectionRaw.filter(t => t.float != null).length, total: nonSectionRaw.length, pct: Math.round(nonSectionRaw.filter(t => t.float != null).length / Math.max(1, nonSectionRaw.length) * 100) },
                  { key: "pct",           label: "% Complete",         critical: false, filled: nonSectionRaw.filter(t => t.pct != null).length, total: nonSectionRaw.length, pct: Math.round(nonSectionRaw.filter(t => t.pct != null).length / Math.max(1, nonSectionRaw.length) * 100) },
                  { key: "baselineStart", label: "BL Start",           critical: false, filled: blKeys.length,            total: nonSectionRaw.length, pct: Math.round(blKeys.length / Math.max(1, nonSectionRaw.length) * 100) },
                  { key: "baselineFinish",label: "BL End",             critical: false, filled: blKeys.length,            total: nonSectionRaw.length, pct: Math.round(blKeys.length / Math.max(1, nonSectionRaw.length) * 100) },
                ],
                timestamp: new Date(),
                matchedCount,
              });
              return;
            }
            // Filter out invalid tasks before processing
            const validRawTasks = rawTasks.filter(t => {
              if (t.isSection) return true; // Keep sections
              return t.activityId || t.activity || t.start || t.end;
            });
            
            const newTasks = validRawTasks.map((t, idx) => ({
              ...t,
              id: getNextId(tasks) + idx,
              activityId: t.activityId || "",
              activity: t.activity || "",
              start: t.start || "",
              end: t.end || "",
              barType: t.barType || "baseline",
              ...(t.baselineStart  ? { baselineStart:  t.baselineStart  } : {}),
              ...(t.baselineFinish ? { baselineFinish: t.baselineFinish } : {}),
              ...(t.remainDur != null ? { remainDur: t.remainDur } : {}),
              ...(t.float     != null ? { float:     t.float     } : {}),
              ...(t.pct       != null ? { pct:       t.pct       } : {}),
              ...(t.item ? { customItem: t.item } : {}),
              ...(t.isSection ? { isSection: true, sectionType: t.sectionType || "blue" } : {}),
            }));
            if (importMode === "replace") {
              const resolved = resolveImportedLinks(newTasks);
              setTasks(resolved);
              setNextId(getNextId(resolved));
            } else {
              // Append: match imported tasks to existing ones by activityId.
              // If matched, merge current data (start/end/activity/etc.) into the
              // existing task and clear deletedFromBL — this lets users import BL
              // first, then append the current programme to fill in matching rows.
              const rawById = {};
              rawTasks.forEach(t => {
                if (!t.isSection && t.activityId) {
                  rawById[t.activityId.trim().toLowerCase()] = t;
                }
              });
              setTasks(prev => {
                let matched = 0;
                const updated = prev.map(t => {
                  if (t.isSection || !t.activityId) return t;
                  const incoming = rawById[t.activityId.trim().toLowerCase()];
                  if (!incoming) return t;
                  matched++;
                  return {
                    ...t,
                    activity: incoming.activity || t.activity,
                    start: incoming.start || "",
                    end: incoming.end || "",
                    barType: incoming.barType || t.barType,
                    deletedFromBL: false,
                    ...(incoming.links ? { links: incoming.links } : {}),
                    ...(incoming.remainDur != null ? { remainDur: incoming.remainDur } : {}),
                    ...(incoming.float     != null ? { float:     incoming.float     } : {}),
                    ...(incoming.pct       != null ? { pct:       incoming.pct       } : {}),
                  };
                });
                // Only append tasks that didn't match an existing row
                const matchedIds = new Set(
                  prev.filter(t => !t.isSection && t.activityId && rawById[t.activityId.trim().toLowerCase()])
                    .map(t => t.activityId.trim().toLowerCase())
                );
                const unmatched = newTasks.filter(t =>
                  t.isSection || !t.activityId || !matchedIds.has(t.activityId.trim().toLowerCase())
                );
                // Re-evaluate: existing tasks with BL dates but no current match
                // are "deleted from BL" — move them to a dedicated section.
                const deletedTasks = [];
                const finalTasks = updated
                  .filter(t => !(t.isSection && t.activity === "Baseline (Deleted Activities)"))
                  .map(t => {
                    if (t.isSection || !t.activityId) return t;
                    if (matchedIds.has(t.activityId.trim().toLowerCase())) return t;
                    // Not matched by current — if it has BL dates, it's deleted from current
                    if (t.baselineStart || t.baselineFinish) {
                      deletedTasks.push({
                        ...t,
                        deletedFromBL: true,
                        start: "",
                        end: "",
                      });
                      return null;
                    }
                    return t;
                  })
                  .filter(Boolean);
                if (deletedTasks.length > 0) {
                  const blSection = {
                    id: getNextId(finalTasks),
                    isSection: true,
                    sectionType: "pink",
                    activity: "Baseline (Deleted Activities)",
                    showComparison: false,
                  };
                  const result = resolveImportedLinks([...finalTasks, blSection, ...deletedTasks, ...unmatched]);
                  setNextId(getNextId(result));
                  return result;
                }
                const result = resolveImportedLinks([...finalTasks, ...unmatched]);
                setNextId(getNextId(result));
                return result;
              });
            }
            // Generate import status report
            setImportReport(buildImportReport(rawTasks, fileType || "File"));
          }}
        />
      )}

      {showCompare && (
        <CompareDialog
          tasks={tasks}
          saveToHistory={saveToHistory}
          onClose={() => setShowCompare(false)}
          onReplaceWithVersionA={(parsed) => {
            // Replace all tasks with Version A data — dates stored as BL (Baseline) dates
            saveToHistory(tasks);
            const newTasks = parsed.map((t, idx) => ({
              ...t,
              id: idx + 1,
              activityId: t.activityId || "",
              activity: t.activity || "",
              // Keep start/end for bar rendering; also store as Baseline dates
              start: t.start || "",
              end: t.end || "",
              baselineStart: t.start || t.baselineStart || "",
              baselineFinish: t.end || t.baselineFinish || "",
              barType: t.barType || "baseline",
              ...(t.item ? { customItem: t.item } : {}),
              ...(t.isSection ? { isSection: true, sectionType: t.sectionType || "blue" } : {}),
            }));
            setTasks(newTasks);
            setNextId(getNextId(newTasks));
            setSelectedIds(new Set());
            // Show BL date columns so Version A baseline dates are visible
            setColumnVisibility(prev => {
              const base = prev || INIT_VISIBILITY;
              return {
                ...base,
                blStart: { ...base.blStart, visible: true },
                blEnd: { ...base.blEnd, visible: true },
              };
            });
          }}
          onApplyChanges={({ updates, newTasks }) => {
            setTasks(prev => {
              const updated = prev.map(t => updates[t.id] ? { ...t, ...updates[t.id] } : t);
              const maxId = Math.max(0, ...updated.map(t => t.id));
              const newTasksWithIds = newTasks.map((t, i) => ({ ...t, id: maxId + i + 1 }));
              const result = [...updated, ...newTasksWithIds];
              setNextId(getNextId(result));
              return result;
            });
            setSelectedIds(new Set());
            // Show BL date columns (Version A = Baseline) and Actual date columns (Version B = current start/end)
            setColumnVisibility(prev => {
              const base = prev || INIT_VISIBILITY;
              return {
                ...base,
                blStart: { ...base.blStart, visible: true },
                blEnd: { ...base.blEnd, visible: true },
                earlyStart: { ...base.earlyStart, visible: false },
                earlyEnd: { ...base.earlyEnd, visible: false },
                lateStart: { ...base.lateStart, visible: false },
                lateEnd: { ...base.lateEnd, visible: false },
              };
            });
          }}
        />
      )}
    </div>
  );
}