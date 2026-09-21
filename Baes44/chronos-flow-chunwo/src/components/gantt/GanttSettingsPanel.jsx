/**
 * Gantt Settings panel — one consolidated place for appearance / display settings,
 * modelled on the XER Viewer "Gantt Settings" panel
 * (tabs: Bars · Labels · Grid & Format · Timeline).
 *
 * Every value lives in `displaySettings` (owned & persisted by GanttPage) so the
 * on-screen table, the Gantt bars and the PDF export stay in sync.
 */
import { useState } from "react";
import { X, BarChart3, Tag, Grid3x3, CalendarRange, Layers } from "lucide-react";
import {
  BAR_PRESETS, BAR_LABEL_FIELDS, MILESTONE_SHAPES, DATE_FORMATS, LINE_STYLES,
  GROUP_FONT_SIZES, GROUP_FONT_WEIGHTS,
} from "@/lib/displaySettings";
import { TIME_SCALES } from "@/components/gantt/UnifiedGanttLayout";

// ── Presentational helpers (props only: never capture component-scope values) ─
function Field({ label, children, hint }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`w-full text-left px-2 py-1 rounded text-xs font-medium transition-all flex items-center justify-between ${checked ? "bg-surface-subtle text-primary" : "text-text hover:bg-surface-muted"}`}>
      {label}
      <span className={`w-8 h-4 rounded-full transition-all relative ${checked ? "bg-primary" : "bg-surface-muted"}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-surface transition-all ${checked ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}


function Rng({ value, min, max, step = 1, onChange }) {
  return (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
  );
}

function Sel({ value, options, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border rounded px-2 py-1 text-xs bg-surface">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Col({ value, onChange, title }) {
  return (
    <input type="color" value={value || "#333333"} onChange={(e) => onChange(e.target.value)}
      className="w-7 h-6 border border-border rounded cursor-pointer" title={title || "Colour"} />
  );
}

export default function GanttSettingsPanel({ displaySettings, onChange, viewMode, onViewModeChange, collapsedCount = 0, onExpandAll, onCollapseAll, initialTab = "bars", embedded = false, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const settings = displaySettings || {};
  const bar = settings.bar || {};
  const grid = settings.grid || {};
  const group = settings.group || {};
  const focus = settings.focus || {};
  const label = bar.label || {};
  const critical = bar.critical || {};

  const setBar = (patch) => onChange({ ...settings, bar: { ...bar, ...patch } });
  const setBarSub = (key, patch) => setBar({ [key]: { ...bar[key], ...patch } });
  const setGrid = (patch) => onChange({ ...settings, grid: { ...grid, ...patch } });
  const setGroup = (patch) => onChange({ ...settings, group: { ...group, ...patch } });
  const setFocus = (patch) => onChange({ ...settings, focus: { ...focus, ...patch } });

  const TABS = [
    { id: "bars",      label: "Bars",          icon: <BarChart3 size={14} /> },
    { id: "labels",    label: "Labels",        icon: <Tag size={14} /> },
    { id: "grid",      label: "Grid & Format", icon: <Grid3x3 size={14} /> },
    { id: "timeline",  label: "Timeline",      icon: <CalendarRange size={14} /> },
    { id: "structure", label: "Structure",     icon: <Layers size={14} /> },
  ];

  return (
    <div className={embedded ? "flex flex-col" : "fixed inset-0 bg-black/40 flex justify-end z-50"} onClick={embedded ? undefined : onClose}>
      <div className={embedded ? "bg-surface flex flex-col w-full" : "bg-surface h-full w-[380px] max-w-[95vw] shadow-2xl flex flex-col"} onClick={(e) => e.stopPropagation()}>
        {!embedded && (
        <>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" /> Gantt Settings
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>

        <div className="flex border-b border-border bg-surface-subtle">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium border-b-2 transition-all ${tab === t.id ? "border-primary text-primary bg-surface" : "border-transparent text-text-muted hover:text-text"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        </>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "bars" && (
            <>
              <Field label="Preset">
                <div className="flex flex-wrap gap-1.5">
                  {BAR_PRESETS.map((p) => (
                    <button key={p.id} onClick={() => setBar({ ...p.bar })}
                      className="px-2 py-1 rounded border border-border text-xs text-text hover:bg-surface-subtle hover:border-primary">
                      {p.name}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={`Bar height — ${bar.heightPx}px`}>
                <Rng value={bar.heightPx} min={6} max={26} onChange={(v) => setBar({ heightPx: v })} />
              </Field>

              <Field label={`Corner radius — ${bar.cornerRadius}px`}>
                <Rng value={bar.cornerRadius} min={0} max={10} onChange={(v) => setBar({ cornerRadius: v })} />
              </Field>

              <Field label={`Border width — ${bar.borderWidth}px`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Rng value={bar.borderWidth} min={0} max={3} onChange={(v) => setBar({ borderWidth: v })} /></div>
                  <Col value={bar.borderColor} onChange={(v) => setBar({ borderColor: v })} title="Border colour" />
                </div>
                <div className="mt-1"><Sel value={bar.borderStyle} options={LINE_STYLES} onChange={(v) => setBar({ borderStyle: v })} /></div>
              </Field>

              <Field label="Bar colours">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">Baseline</span>
                  <Col value={bar.baselineColor} onChange={(v) => setBar({ baselineColor: v })} />
                  <span className="text-xs text-text-muted">Delay</span>
                  <Col value={bar.delayColor} onChange={(v) => setBar({ delayColor: v })} />
                </div>
              </Field>

              <Field label="Milestone">
                <div className="flex items-center gap-2">
                  <Sel value={bar.milestoneShape} options={MILESTONE_SHAPES} onChange={(v) => setBar({ milestoneShape: v })} />
                  <div className="w-24"><Rng value={bar.milestoneSize} min={4} max={14} onChange={(v) => setBar({ milestoneSize: v })} /></div>
                </div>
              </Field>

              <div className="border-t border-border my-3" />

              <Field label="Shadow">
                <Toggle label="Drop shadow" checked={!!bar.shadow} onChange={(v) => setBar({ shadow: v })} />
                {bar.shadow && (
                  <div className="flex items-center gap-2 mt-2">
                    <Col value={bar.shadowColor} onChange={(v) => setBar({ shadowColor: v })} title="Shadow colour" />
                    <div className="flex-1"><Rng value={bar.shadowBlur} min={1} max={12} onChange={(v) => setBar({ shadowBlur: v })} /></div>
                    <div className="flex-1"><Rng value={bar.shadowOffsetY} min={0} max={6} onChange={(v) => setBar({ shadowOffsetY: v })} /></div>
                  </div>
                )}
              </Field>

              <Field label="Critical activities (Total Float ≤ 0)">
                <Toggle label="Highlight critical bars" checked={!!critical.enabled} onChange={(v) => setBarSub("critical", { enabled: v })} />
                {critical.enabled && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-text-muted">Bar</span>
                    <Col value={critical.color} onChange={(v) => setBarSub("critical", { color: v })} />
                    <span className="text-xs text-text-muted">Border</span>
                    <Col value={critical.borderColor} onChange={(v) => setBarSub("critical", { borderColor: v })} />
                    <div className="w-20"><Rng value={critical.borderWidth} min={0} max={3} onChange={(v) => setBarSub("critical", { borderWidth: v })} /></div>
                  </div>
                )}
              </Field>
            </>
          )}

          {tab === "labels" && (
            <>
              <Field label="Show label on bars">
                <Toggle label="Enabled" checked={!!label.show} onChange={(v) => setBarSub("label", { show: v })} />
              </Field>
              <Field label="Content">
                <Sel value={label.field} options={BAR_LABEL_FIELDS} onChange={(v) => setBarSub("label", { field: v })} />
              </Field>
              <Field label="Position">
                <Sel value={label.position}
                  options={[{ value: "inside", label: "Inside the bar" }, { value: "right", label: "Right of the bar" }]}
                  onChange={(v) => setBarSub("label", { position: v })} />
              </Field>
              <Field label={`Font size — ${label.fontSize}px`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Rng value={label.fontSize} min={8} max={16} onChange={(v) => setBarSub("label", { fontSize: v })} /></div>
                  <Col value={label.color} onChange={(v) => setBarSub("label", { color: v })} title="Label colour" />
                </div>
              </Field>
              {label.position === "inside" && (
                <Field label={`Minimum bar width for the label — ${label.minWidth ?? 50}px`} hint="Inside labels are hidden on short bars.">
                  <Rng value={label.minWidth ?? 50} min={10} max={200} step={5} onChange={(v) => setBarSub("label", { minWidth: v })} />
                </Field>
              )}
            </>
          )}

          {tab === "grid" && (
            <>
              <Field label="Date format">
                <Sel value={settings.dateFormat || "yyyy-MM-dd"} options={DATE_FORMATS} onChange={(v) => onChange({ ...settings, dateFormat: v })} />
              </Field>
              <Field label="Grid lines">
                <div className="space-y-1">
                  {[
                    { key: "rowVisible", label: "Activity row lines" },
                    { key: "colVisible", label: "Column dividers" },
                    { key: "groupVisible", label: "Group header lines" },
                    { key: "timelineMajorVisible", label: "Timeline — year lines" },
                    { key: "timelineMinorVisible", label: "Timeline — month lines" },
                  ].map((it) => (
                    <Toggle key={it.key} label={it.label} checked={grid[it.key] !== false} onChange={(v) => setGrid({ [it.key]: v })} />
                  ))}
                </div>
              </Field>
              <Field label="Line colour / weight / style">
                <div className="space-y-2">
                  {[
                    { k: "row", label: "Row" },
                    { k: "col", label: "Column" },
                    { k: "group", label: "Group" },
                    { k: "timelineMinor", label: "Timeline minor" },
                    { k: "timelineMajor", label: "Timeline major" },
                  ].map((g) => (
                    <div key={g.k} className="flex items-center gap-1.5">
                      <span className="text-xs text-text-muted w-24">{g.label}</span>
                      <Col value={grid[`${g.k}Color`]} onChange={(v) => setGrid({ [`${g.k}Color`]: v })} />
                      <input type="number" min="1" max="4" step="1" value={grid[`${g.k}Weight`] ?? 1}
                        onChange={(e) => setGrid({ [`${g.k}Weight`]: Number(e.target.value) })}
                        className="w-12 border border-border rounded px-1 py-0.5 text-xs" />
                      <div className="flex-1">
                        <Sel value={grid[`${g.k}Style`] || "solid"} options={LINE_STYLES} onChange={(v) => setGrid({ [`${g.k}Style`]: v })} />
                      </div>
                    </div>
                  ))}
                </div>
              </Field>
            </>
          )}

          {tab === "timeline" && (
            <Field label="Time scale" hint="Auto picks a scale from the schedule length.">
              <div className="space-y-1">
                {TIME_SCALES.map((s) => (
                  <button key={s.value} onClick={() => onViewModeChange && onViewModeChange(s.value)}
                    className={`w-full text-left px-2 py-1 rounded text-xs font-medium transition-all ${viewMode === s.value ? "bg-surface-subtle text-primary" : "text-text hover:bg-surface-muted"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {tab === "structure" && (
            <>
              <Field label={`Programme sections — ${collapsedCount} collapsed`}
                hint="Tip: click the ▸ / ▾ arrow on any programme row to collapse or expand it.">
                <div className="flex gap-2">
                  <button onClick={() => onExpandAll && onExpandAll()}
                    className="flex-1 px-2 py-1.5 rounded border border-border text-xs text-text hover:bg-surface-subtle hover:border-primary">
                    Expand all
                  </button>
                  <button onClick={() => onCollapseAll && onCollapseAll()}
                    className="flex-1 px-2 py-1.5 rounded border border-border text-xs text-text hover:bg-surface-subtle hover:border-primary">
                    Collapse all
                  </button>
                </div>
              </Field>

              <Field label="Group header text">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Sel value={String(group.fontSize ?? 12)} options={GROUP_FONT_SIZES}
                      onChange={(v) => setGroup({ fontSize: Number(v) })} />
                  </div>
                  <div className="flex-1">
                    <Sel value={String(group.fontWeight ?? 700)} options={GROUP_FONT_WEIGHTS}
                      onChange={(v) => setGroup({ fontWeight: Number(v) })} />
                  </div>
                </div>
              </Field>

              <Field label={`Text indent — ${group.indent ?? 0}px`}>
                <Rng value={group.indent ?? 0} min={0} max={40} step={2} onChange={(v) => setGroup({ indent: v })} />
              </Field>

              <Field label="Group header colours">
                <div className="space-y-2">
                  {[
                    { k: "blue", label: "Blue programme", bg: "blueBg", tx: "blueText" },
                    { k: "pink", label: "Pink programme", bg: "pinkBg", tx: "pinkText" },
                  ].map((g) => (
                    <div key={g.k} className="flex items-center gap-2">
                      <span className="text-xs text-text-muted w-28">{g.label}</span>
                      <span className="text-xs text-text-muted">Fill</span>
                      <Col value={group[g.bg]} onChange={(v) => setGroup({ [g.bg]: v })} title="Header fill" />
                      <span className="text-xs text-text-muted">Text</span>
                      <Col value={group[g.tx]} onChange={(v) => setGroup({ [g.tx]: v })} title="Header text" />
                    </div>
                  ))}
                </div>
              </Field>

              <div className="border-t border-border my-3" />

              <Field label="Focus mode" hint="Dims every activity that is not part of the selected activity's chain (predecessors & successors).">
                <Toggle label="Highlight selected chain only" checked={!!focus.enabled}
                  onChange={(v) => setFocus({ enabled: v })} />
              </Field>
              {focus.enabled && (
                <Field label={`Dim other activities — ${Math.round((focus.dim ?? 0.35) * 100)}% opacity`}>
                  <Rng value={focus.dim ?? 0.35} min={0.1} max={0.9} step={0.05} onChange={(v) => setFocus({ dim: v })} />
                </Field>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
