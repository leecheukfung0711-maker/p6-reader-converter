/**
 * ViewPresets — Save and quickly switch column visibility presets.
 * Built-in presets: Standard, Progress, Diff, P6 Full. Custom presets also supported.
 */
import { useState, useEffect } from "react";
import { Layout, ChevronDown, Trash2, Plus, X, Check } from "lucide-react";

const STORAGE_KEY = "gantt_view_presets";

// Built-in presets
const BUILTIN_PRESETS = [
  {
    id: "__builtin_standard",
    name: "Standard View",
    builtin: true,
    visibility: makeVisibility({
      visible: ["type", "rownum", "item", "activityId", "activity", "start", "end", "link", "duration"],
    }),
  },
  {
    id: "__builtin_progress",
    name: "Progress Tracking",
    builtin: true,
    visibility: makeVisibility({
      visible: ["type", "rownum", "item", "activityId", "activity", "start", "end", "duration", "remainDur", "float", "pct"],
    }),
  },
  {
    id: "__builtin_diff",
    name: "Comparison View",
    builtin: true,
    visibility: makeVisibility({
      visible: ["type", "rownum", "item", "activityId", "activity", "start", "end", "blStart", "blEnd", "duration"],
    }),
  },
  {
    id: "__builtin_p6_full",
    name: "P6 Full View",
    builtin: true,
    visibility: makeVisibility({ visible: null }), // all visible
  },
];

// Build visibility object from a list of visible column keys
function makeVisibility({ visible }) {
  const ALL_KEYS = [
    "type", "rownum", "item", "activityId", "activity",
    "start", "end", "link", "duration", "remainDur", "float", "pct",
    "blStart", "blEnd",
    "earlyStart", "earlyEnd", "lateStart", "lateEnd", "freeFloat", "expectedFinish",
    "primaryResource", "durationType", "completePctType", "statusCode",
    "constraintType", "constraintDate", "constraintType2", "constraintDate2",
    "suspendDate", "resumeDate", "priorityType", "locationId", "estWt",
    "drivingPathFlag", "lockPlanFlag", "autoComputeActFlag",
    "actLaborUnits", "actNonlaborUnits", "remLaborUnits", "remNonlaborUnits",
    "planLaborUnits", "planNonlaborUnits", "reviewFinish", "reviewStatus",
    "externalEarlyStart", "externalLateFinish",
    "remEarlyStart", "remEarlyFinish", "remLateStart", "remLateFinish",
    "floatPath", "floatPathOrder", "p6Guid", "p6TaskId", "targetDuration", "calendar",
  ];
  const visSet = visible ? new Set(visible) : null;
  const result = {};
  ALL_KEYS.forEach((k, i) => {
    result[k] = { visible: visSet ? visSet.has(k) : true, position: i };
  });
  return result;
}

function loadCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCustomPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export default function ViewPresets({ columnVisibility, onApply }) {
  const [open, setOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    if (open) setCustomPresets(loadCustomPresets());
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('[data-view-presets]')) setOpen(false);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [open]);

  const handleSave = () => {
    const name = nameInput.trim() || `View ${new Date().toLocaleString("en-GB", { hour12: false })}`;
    const newPreset = {
      id: `custom_${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      visibility: JSON.parse(JSON.stringify(columnVisibility || {})),
    };
    const updated = [...customPresets, newPreset].slice(-30);
    saveCustomPresets(updated);
    setCustomPresets(updated);
    setNameInput("");
    setSaving(false);
  };

  const handleDelete = (id) => {
    const updated = customPresets.filter(p => p.id !== id);
    saveCustomPresets(updated);
    setCustomPresets(updated);
  };

  const handleApply = (preset) => {
    onApply(JSON.parse(JSON.stringify(preset.visibility)));
    setOpen(false);
  };

  const allPresets = [...BUILTIN_PRESETS, ...customPresets];

  return (
    <div className="relative" data-view-presets>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
          open ? "text-primary" : "text-text-muted hover:text-text"
        }`}
        title="View presets — quickly switch column layouts"
      >
        <Layout size={14} />
        Views
        <ChevronDown size={10} className="opacity-60" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 bg-surface rounded-xl shadow-2xl border border-border z-50 overflow-hidden"
          style={{ width: 280 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-text text-sm flex items-center gap-2">
              <Layout size={15} className="text-primary" /> View Presets
            </span>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text">
              <X size={15} />
            </button>
          </div>

          {/* Save current view */}
          <div className="px-4 py-3 border-b border-border bg-surface-subtle">
            {saving ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setSaving(false); }}
                  placeholder="View name…"
                  className="flex-1 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-focus text-text bg-surface"
                />
                <button onClick={handleSave} className="bg-primary text-surface text-xs px-3 py-1 rounded hover:bg-primary-active font-medium flex items-center gap-1">
                  <Check size={12} /> Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSaving(true)}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-surface text-sm font-medium py-1.5 rounded transition-colors"
              >
                <Plus size={14} /> Save Current View
              </button>
            )}
          </div>

          {/* Preset list */}
          <div className="max-h-80 overflow-y-auto">
            {allPresets.length === 0 ? (
              <div className="text-center text-text-muted text-xs py-8">No presets saved</div>
            ) : (
              allPresets.map(preset => (
                <div
                  key={preset.id}
                  className="group flex items-center gap-2 px-4 py-2.5 hover:bg-surface-subtle border-b border-border last:border-0 cursor-pointer"
                  onClick={() => handleApply(preset)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate flex items-center gap-1.5">
                      {preset.name}
                      {preset.builtin && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-surface-muted text-text-muted font-normal">Built-in</span>
                      )}
                    </div>
                    {!preset.builtin && preset.savedAt && (
                      <div className="text-xs text-text-muted mt-0.5">
                        {new Date(preset.savedAt).toLocaleString("en-GB", { hour12: false })}
                      </div>
                    )}
                  </div>
                  {!preset.builtin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
                      className="text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Delete preset"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 text-xs text-text-muted border-t border-border text-center">
            4 built-in · up to 30 custom
          </div>
        </div>
      )}
    </div>
  );
}