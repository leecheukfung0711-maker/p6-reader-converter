/**
 * XerMappingDialog — XER field-mapping settings
 * Lets the user map Gantt columns to the P6 XER fields (task_code, task_name,
 * wbs_name, dates …) and previews how the first rows convert.
 */
import { useState, useMemo } from "react";
import { X, Settings2, Eye, RotateCcw, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

import { loadMapping, saveMapping, DEFAULT_MAPPING } from "@/lib/xerFieldMapping";

// Simulates what buildXER would produce for task_code / task_name
function previewMapping(task, mapping, idx) {
  if (task.isSection) return null;

  // task_code
  let rawCode = "";
  if (mapping.task_code === "activityId") rawCode = task.activityId || "";
  else if (mapping.task_code === "item") rawCode = task.item || task._resolvedItem || task.customItem || "";
  else if (mapping.task_code === "activity") rawCode = (task.activity || "").slice(0, 20);
  rawCode = rawCode.replace(/\t/g, "").trim();
  if (mapping.task_code_prefix) rawCode = mapping.task_code_prefix + rawCode;
  if (!rawCode) {
    if (mapping.task_code_fallback === "item") rawCode = task.item || task._resolvedItem || task.customItem || `A${String(idx + 1).padStart(4, "0")}`;
    else rawCode = `A${String(idx + 1).padStart(4, "0")}`;
  }
  // Ensure not purely numeric
  if (/^\d+$/.test(rawCode)) rawCode = "A" + rawCode;

  // task_name
  let taskName = "";
  if (mapping.task_name === "activity") taskName = task.activity || "";
  else if (mapping.task_name === "activityId") taskName = task.activityId || "";
  else if (mapping.task_name === "item") taskName = task.item || task._resolvedItem || task.customItem || "";
  else if (mapping.task_name === "activityId_activity") taskName = [task.activityId, task.activity].filter(Boolean).join(" - ");
  taskName = taskName.replace(/\t/g, " ");

  // Dates
  let start = "", end = "";
  if (mapping.date_source === "baselineStartEnd") {
    start = task.baselineStart || task.start || "";
    end   = task.baselineFinish || task.end || task.start || "";
  } else {
    start = task.start || "";
    end   = task.end || task.start || "";
  }

  const hasDate = !!(start || end);
  const skipped = mapping.skip_no_dates && !hasDate;

  return { task_code: rawCode, task_name: taskName, start, end, skipped };
}

const FIELD_OPTIONS_CODE = [
  { value: "activityId",  label: "Activity ID" },
  { value: "item",        label: "Item No. (Gantt bar label)" },
  { value: "activity",    label: "Activity Name (first 20 chars)" },
];

const FIELD_OPTIONS_NAME = [
  { value: "activity",          label: "Activity Name" },
  { value: "activityId_activity", label: "ID + Activity Name (joined with \" - \")" },
  { value: "activityId",        label: "Activity ID only" },
  { value: "item",              label: "Item No. only" },
];

export default function XerMappingDialog({ tasks, onClose, onSave }) {
  const [mapping, setMapping] = useState(loadMapping);
  const [tab, setTab] = useState("mapping"); // "mapping" | "preview"

  const set = (key, val) => setMapping(prev => ({ ...prev, [key]: val }));

  const previewRows = useMemo(() => {
    if (!tasks) return [];
    let taskIdx = 0;
    return tasks.slice(0, 60).map(t => {
      if (t.isSection) return { isSection: true, activity: t.activity, sectionType: t.sectionType };
      const result = previewMapping(t, mapping, taskIdx++);
      return { ...result, original: t };
    }).filter(Boolean);
  }, [tasks, mapping]);

  const skippedCount = previewRows.filter(r => !r.isSection && r.skipped).length;
  const validCount   = previewRows.filter(r => !r.isSection && !r.skipped).length;

  const handleSave = () => {
    saveMapping(mapping);
    onSave && onSave(mapping);
    onClose();
  };

  const handleReset = () => setMapping({ ...DEFAULT_MAPPING });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl shadow-2xl flex flex-col" style={{ width: 720, maxWidth: "96vw", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="px-6 pt-5 pb-0 flex-shrink-0 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              <Settings2 size={18} className="text-accent-selected" />
              XER Field Mapping Settings
            </h2>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="flex gap-1 mb-0">
            {[
              { key: "mapping", label: "Mapping Settings", icon: <Settings2 size={12} /> },
              { key: "preview", label: "Preview Results", icon: <Eye size={12} /> },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                  tab === t.key ? "border-accent-accessible text-accent-selected" : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {tab === "mapping" && (
            <div className="space-y-5">

              {/* task_code */}
              <Section title="task_code (P6 Activity ID)" desc="P6 requires task_code to be non-numeric and unique.">
                <Row label="Source Field">
                  <Select value={mapping.task_code} onChange={v => set("task_code", v)} options={FIELD_OPTIONS_CODE} />
                </Row>
                <Row label="Prefix (optional)" hint="e.g. enter 'A' to turn '1001' into 'A1001'">
                  <input
                    type="text" maxLength={10} value={mapping.task_code_prefix}
                    onChange={e => set("task_code_prefix", e.target.value)}
                    placeholder="Leave blank for no prefix"
                    className="border border-border rounded px-2 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-accent-accessible"
                  />
                </Row>
                <Row label="Fallback when no ID">
                  <RadioGroup
                    value={mapping.task_code_fallback}
                    onChange={v => set("task_code_fallback", v)}
                    options={[
                      { value: "auto",  label: "Auto-generate A0001, A0002…" },
                      { value: "item",  label: "Use Item column (A1, B2…)" },
                    ]}
                  />
                </Row>
              </Section>

              {/* task_name */}
              <Section title="task_name (P6 Activity Name)" desc="The activity name displayed in P6.">
                <Row label="Source Field">
                  <Select value={mapping.task_name} onChange={v => set("task_name", v)} options={FIELD_OPTIONS_NAME} />
                </Row>
              </Section>

              {/* Dates */}
              <Section title="Date Source" desc="Choose which date columns to use when exporting to P6.">
                <Row label="">
                  <RadioGroup
                    value={mapping.date_source}
                    onChange={v => set("date_source", v)}
                    options={[
                      { value: "startEnd",          label: "Use Start / End columns (current Gantt dates)" },
                      { value: "baselineStartEnd",  label: "Use Baseline Start / Finish columns (falls back to Start/End if absent)" },
                    ]}
                  />
                </Row>
                <Row label="Tasks without dates">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={mapping.skip_no_dates}
                      onChange={e => set("skip_no_dates", e.target.checked)}
                      className="accent-primary w-4 h-4" />
                    <span className="text-sm text-text">Skip tasks with no dates (recommended)</span>
                  </label>
                </Row>
              </Section>

              {/* WBS */}
              <Section title="WBS Node Settings" desc="Programme sections in the Gantt will be converted to P6 WBS nodes.">
                <Row label="WBS Short Name format">
                  <RadioGroup
                    value={mapping.wbs_short_name_mode}
                    onChange={v => set("wbs_short_name_mode", v)}
                    options={[
                      { value: "ascii_truncate", label: "Auto-strip non-ASCII chars, truncate to 20 chars (recommended)" },
                      { value: "index",          label: "Use WBS1, WBS2… format (safest)" },
                    ]}
                  />
                </Row>
              </Section>

              {/* Duration */}
              <Section title="Duration Calculation" desc="P6 stores duration in hours.">
                <Row label="">
                  <RadioGroup
                    value={mapping.duration_unit}
                    onChange={v => set("duration_unit", v)}
                    options={[
                      { value: "hours8", label: "Calendar days × 8 hours (standard)" },
                      { value: "hours1", label: "Calendar days × 1 hour (lightweight)" },
                    ]}
                  />
                </Row>
              </Section>

            </div>
          )}

          {tab === "preview" && (
            <div>
              <div className="flex items-center gap-3 mb-3 text-xs">
                <span className="flex items-center gap-1 text-success bg-surface-subtle border border-border rounded px-2 py-1">
                  <CheckCircle size={11} /> {validCount} task(s) will be exported
                </span>
                {skippedCount > 0 && (
                  <span className="flex items-center gap-1 text-accent-selected bg-table-header border border-border rounded px-2 py-1">
                    <AlertCircle size={11} /> {skippedCount} task(s) will be skipped (no dates)
                  </span>
                )}
                <span className="text-text-muted flex items-center gap-1">
                  <Info size={11} /> Showing first 60 rows
                </span>
              </div>
              <div className="border border-border rounded-lg overflow-auto max-h-[50vh]">
                <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: 580 }}>
                  <thead>
                    <tr style={{ background: "#003531", color: "#fff", fontSize: 11 }}>
                      <th style={{ width: 130, padding: "5px 8px", textAlign: "left", border: "1px solid #003531" }}>task_code</th>
                      <th style={{ padding: "5px 8px", textAlign: "left", border: "1px solid #003531" }}>task_name</th>
                      <th style={{ width: 100, padding: "5px 8px", textAlign: "center", border: "1px solid #003531" }}>start</th>
                      <th style={{ width: 100, padding: "5px 8px", textAlign: "center", border: "1px solid #003531" }}>end</th>
                      <th style={{ width: 60, padding: "5px 8px", textAlign: "center", border: "1px solid #003531" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => {
                      if (r.isSection) {
                        const bg = r.sectionType === "pink" ? "#733208" : "#005a53";
                        const col = r.sectionType === "pink" ? "#ffffff" : "#003531";
                        return (
                          <tr key={i} style={{ background: bg }}>
                            <td colSpan={5} style={{ padding: "4px 8px", fontSize: 12, fontWeight: 700, color: col, border: "1px solid #cecece" }}>
                              📁 WBS: {r.activity}
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={i} style={{ background: r.skipped ? "#fff2ea" : i % 2 === 0 ? "#fff" : "#f7f7f7", opacity: r.skipped ? 0.6 : 1 }}>
                          <td style={{ padding: "3px 8px", fontSize: 11, fontFamily: "monospace", color: "#005a53", border: "1px solid #cecece" }}>
                            {r.task_code}
                          </td>
                          <td style={{ padding: "3px 8px", fontSize: 12, border: "1px solid #cecece", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                            {r.task_name}
                          </td>
                          <td style={{ padding: "3px 8px", fontSize: 11, textAlign: "center", color: "#333333", border: "1px solid #cecece" }}>{r.start}</td>
                          <td style={{ padding: "3px 8px", fontSize: 11, textAlign: "center", color: "#333333", border: "1px solid #cecece" }}>{r.end}</td>
                          <td style={{ padding: "3px 8px", fontSize: 11, textAlign: "center", border: "1px solid #cecece" }}>
                            {r.skipped
                              ? <span className="text-accent-selected font-semibold">Skip</span>
                              : <span className="text-success">✓</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="flex items-center gap-1.5 text-text-muted">
            <RotateCcw size={13} /> Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="bg-accent-accessible hover:bg-accent-accessible text-surface" onClick={handleSave}>
              <CheckCircle size={14} className="mr-1" /> Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, desc, children }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-surface-subtle px-4 py-2.5 border-b border-border">
        <div className="text-sm font-semibold text-text">{title}</div>
        {desc && <div className="text-xs text-text-muted mt-0.5">{desc}</div>}
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-start gap-3">
      {label && (
        <div className="w-32 flex-shrink-0 pt-1.5">
          <span className="text-xs font-medium text-text-muted">{label}</span>
          {hint && <div className="text-xs text-text-muted mt-0.5">{hint}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border border-border rounded px-2 py-1.5 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-accent-accessible"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function RadioGroup({ value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      {options.map(o => (
        <label key={o.value} className="flex items-center gap-2 cursor-pointer">
          <input type="radio" value={o.value} checked={value === o.value}
            onChange={() => onChange(o.value)} className="accent-primary w-4 h-4" />
          <span className="text-sm text-text">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export { loadMapping } from "@/lib/xerFieldMapping";