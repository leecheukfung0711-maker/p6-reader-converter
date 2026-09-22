import { useEffect, useRef, useState } from "react";
import { FolderTree, List, CalendarRange, BarChart3, Settings, X } from "lucide-react";
import WbsSettingsPanel from "./WbsSettingsPanel";
import LocalOcrSettings from "./LocalOcrSettings";
import GanttSettingsPanel from "./GanttSettingsPanel";
import ColumnVisibilityPanel from "./ColumnVisibilityPanel";

/**
 * Global settings panel — xerviewer.org-style layout.
 *
 * One right-hand panel with a vertical icon rail (WBS · Activity List ·
 * Timeline & Grid · Gantt Bars · Other) instead of the previous separate
 * "Gantt Settings" / "WBS Settings" modals and the header "Display" dropdown.
 * The inactive categories live behind the rail, exactly like the reference
 * panel, so the header stays clean.
 *
 * The category bodies are the app's existing panels, rendered in their
 * `embedded` mode (no own backdrop/title/tab bar):
 *   WBS             → WbsSettingsPanel
 *   Activity List   → ViewPresets (node) + ColumnVisibilityPanel
 *   Timeline & Grid → GanttSettingsPanel (grid + timeline sections)
 *   Gantt Bars      → GanttSettingsPanel (bars + labels sections)
 *   Other           → display toggles + relation-type extras + GanttSettingsPanel (structure)
 *
 * The left edge is draggable (like the reference panel) and the active
 * category / panel width are remembered in localStorage.
 */
const TAB_KEY = "gantt_global_settings_tab";
const WIDTH_KEY = "gantt_global_settings_width";
const MIN_W = 340;
const MAX_W = 760;
const DEFAULT_W = 410;

const CATEGORIES = [
  { id: "wbs",           label: "WBS",             title: "WBS Settings",             icon: FolderTree },
  { id: "activity-list", label: "Activity List",   title: "Activity List Settings",   icon: List },
  { id: "timeline-grid", label: "Timeline & Grid", title: "Timeline & Grid Settings", icon: CalendarRange },
  { id: "gantt-bars",    label: "Gantt Bars",      title: "Gantt Bar Settings",       icon: BarChart3 },
  { id: "other",         label: "Other",           title: "Other Settings",           icon: Settings },
];

export default function GlobalSettingsPanel({
  displaySettings, onChange,
  viewMode, onViewModeChange, collapsedCount = 0, onExpandAll, onCollapseAll,
  columnVisibility, setColumnVisibility,
  viewPresets = null, displayToggles = [], otherExtras = null, wbsLevels = null,
  initialTab = null, onClose,
}) {
  const [tab, setTab] = useState(() => {
    if (initialTab) return initialTab;
    try {
      const saved = localStorage.getItem(TAB_KEY);
      return CATEGORIES.some((c) => c.id === saved) ? saved : "wbs";
    } catch {
      return "wbs";
    }
  });
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY));
      return saved >= MIN_W && saved <= MAX_W ? saved : DEFAULT_W;
    } catch {
      return DEFAULT_W;
    }
  });
  const dragging = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ }
  }, [tab]);

  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* ignore */ }
  }, [width]);

  // Drag the left edge to resize, like the reference panel.
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setWidth(Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const shared = { displaySettings, onChange, viewMode, onViewModeChange, collapsedCount, onExpandAll, onCollapseAll, embedded: true };
  const active = CATEGORIES.find((c) => c.id === tab) || CATEGORIES[0];

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div
        className="relative bg-surface h-full shadow-2xl flex flex-row overflow-hidden"
        style={{ width, maxWidth: "95vw" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gantt-global-settings-title"
      >
        {/* ── Category rail ── */}
        <div className="w-16 bg-surface-subtle p-2 border-r border-border flex flex-col items-center space-y-1 shrink-0 overflow-y-auto custom-scrollbar">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const on = c.id === tab;
            return (
              <div key={c.id} className="flex flex-col items-center">
                <button
                  onClick={() => setTab(c.id)}
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={on}
                  className={`p-2 rounded-full transition-all duration-150 border-2 focus:outline-none ${
                    on
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-surface border-border text-text-muted hover:bg-surface-muted"
                  }`}
                >
                  <Icon size={18} />
                </button>
                <span className="text-[8px] text-text-muted text-center mt-0.5 leading-tight max-w-full break-words px-0.5">
                  {c.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-grow flex flex-col overflow-hidden min-w-0">
          <header className="flex justify-between items-center px-4 py-3 border-b border-border shrink-0 bg-surface-subtle">
            <h2 id="gantt-global-settings-title" className="text-md font-semibold text-text">{active.title}</h2>
            <button
              onClick={onClose}
              aria-label="Close settings panel"
              className="p-1.5 rounded-full text-text-muted hover:text-text hover:bg-surface-muted"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0 flex flex-col">
            {tab === "wbs" && <WbsSettingsPanel {...shared} wbsLevels={wbsLevels} />}

            {tab === "activity-list" && (
              <>
                {viewPresets}
                <ColumnVisibilityPanel
                  embedded
                  columnVisibility={columnVisibility}
                  setColumnVisibility={setColumnVisibility}
                />
              </>
            )}

            {tab === "timeline-grid" && (
              <>
                <GanttSettingsPanel {...shared} initialTab="grid" />
                <GanttSettingsPanel {...shared} initialTab="timeline" />
              </>
            )}

            {tab === "gantt-bars" && (
              <>
                <GanttSettingsPanel {...shared} initialTab="bars" />
                <GanttSettingsPanel {...shared} initialTab="labels" />
              </>
            )}

            {tab === "other" && (
              <>
                {/* Batch 25: pick which local OCR engine cross-checks scanned pages
                    (same control as the one inside the Import dialog). */}
                <div className="p-4 border-b border-border">
                  <div className="text-sm font-medium text-text mb-2">Local OCR (scan verification)</div>
                  <LocalOcrSettings />
                </div>
                {displayToggles.length > 0 && (
                  <div className="p-4 border-b border-border">
                    <div className="text-sm font-medium text-text mb-2">Display</div>
                    <div className="flex flex-col gap-1">
                      {displayToggles.map((item) => (
                        <button
                          key={item.label}
                          onClick={item.toggle}
                          title={item.hint || item.label}
                          className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-between ${
                            item.on ? "bg-surface-subtle text-primary" : "text-text hover:bg-surface-muted"
                          }`}
                        >
                          {item.label}
                          <span className={`w-8 h-4 rounded-full transition-all relative ${item.on ? "bg-primary" : "bg-surface-muted"}`}>
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-surface transition-all ${item.on ? "left-4" : "left-0.5"}`} />
                          </span>
                        </button>
                      ))}
                    </div>
                    {otherExtras}
                  </div>
                )}
                <GanttSettingsPanel {...shared} initialTab="structure" />
              </>
            )}
          </div>
        </div>

        {/* ── Resize handle (left edge) ── */}
        <div
          onMouseDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }}
          className="absolute top-0 left-0 w-2 h-full cursor-ew-resize"
          title="Drag to resize"
        />
      </div>
    </div>
  );
}

