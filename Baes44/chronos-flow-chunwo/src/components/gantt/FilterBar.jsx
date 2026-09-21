import { useState, useMemo, useRef, useEffect, forwardRef } from "react";
import { createPortal } from "react-dom";
import { Filter, X, Plus, Trash2, CornerDownRight, ChevronDown } from "lucide-react";
import { isMilestoneTask } from "@/lib/quickFilters";

// ── Field definitions ─────────────────────────────────────────────────
// `virtual` fields are derived from the task (and, for links, from the whole
// list) instead of being read straight off the task object — see VALUE_OF below.
const FIELDS = [
  { value: "activityId",     label: "Activity ID",      type: "text" },
  { value: "activity",       label: "Activity Name",    type: "text" },
  { value: "start",           label: "Start Date",       type: "date" },
  { value: "end",             label: "Finish Date",      type: "date" },
  { value: "barType",         label: "Bar Type",         type: "select", options: ["baseline","delay"] },
  { value: "baselineStart",   label: "BL Start",         type: "date" },
  { value: "baselineFinish",  label: "BL Finish",        type: "date" },
  { value: "earlyStart",      label: "Early Start",      type: "date" },
  { value: "earlyEnd",        label: "Early Finish",     type: "date" },
  { value: "lateStart",       label: "Late Start",       type: "date" },
  { value: "lateEnd",         label: "Late Finish",      type: "date" },
  { value: "expectedFinish",  label: "Expected Finish",  type: "date" },
  { value: "remainDur",       label: "Rem. Duration",    type: "number" },
  { value: "float",           label: "Total Float",      type: "number" },
  { value: "freeFloat",       label: "Free Float",       type: "number" },
  { value: "pct",             label: "% Complete",       type: "number" },
  // Values must be the P6 codes (TK_*): the XER parser stores those on the task.
  // The labels are kept for the UI and for filter files saved before batch 22 —
  // evalCond() normalises both sides through STATUS_ALIAS.
  { value: "statusCode",      label: "Status",           type: "select",
    options: [
      { value: "TK_NotStart", label: "Not Started" },
      { value: "TK_Active",   label: "In Progress" },
      { value: "TK_Complete", label: "Completed" },
    ] },
  { value: "primaryResource", label: "Primary Resource", type: "text" },
  { value: "durationType",    label: "Duration Type",    type: "text" },
  { value: "completePctType", label: "% Complete Type",  type: "text" },
  { value: "constraintType",  label: "Constraint Type",  type: "text" },
  { value: "constraintType2", label: "Constraint Type 2",type: "text" },
  { value: "priorityType",    label: "Priority Type",    type: "text" },
  { value: "locationId",      label: "Location",         type: "text" },
  { value: "drivingPathFlag", label: "Driving Path",     type: "text" },
  { value: "targetDuration",  label: "Target Duration",  type: "number" },
  { value: "estWt",           label: "Est. Weight",      type: "number" },
  { value: "p6Guid",          label: "GUID",             type: "text" },
  // ── Derived fields (batch 22) — needed by the reference filter templates ──
  { value: "predecessors",    label: "Has Predecessor",  type: "select", options: ["yes","no"], virtual: true },
  { value: "successors",      label: "Has Successor",    type: "select", options: ["yes","no"], virtual: true },
  { value: "milestone",       label: "Milestone",        type: "select", options: ["yes","no"], virtual: true },
  { value: "startActual",     label: "Start Actual",     type: "select", options: ["yes","no"], virtual: true },
  { value: "endActual",       label: "Finish Actual",    type: "select", options: ["yes","no"], virtual: true },
];

const FIELD_MAP = Object.fromEntries(FIELDS.map(f => [f.value, f]));

// P6 status codes ↔ the labels used in the UI / in filter files. Both sides of a
// Status comparison are normalised, so old files that stored "In Progress" and
// new conditions that store "TK_Active" behave identically.
const STATUS_ALIAS = {
  "not started": "TK_NotStart", "tk_notstart": "TK_NotStart",
  "in progress": "TK_Active",   "tk_active": "TK_Active",
  completed: "TK_Complete",     "tk_complete": "TK_Complete",
};
const normaliseValue = (field, value) => {
  const s = String(value ?? "").trim();
  if (field !== "statusCode") return s;
  return STATUS_ALIAS[s.toLowerCase()] || s;
};

const OPERATORS = {
  text:   ["contains","not contains","equals","not equals","starts with","is empty","is not empty"],
  number: ["equals","not equals","greater than","less than","greater or equal","less or equal","between","is empty","is not empty"],
  date:   ["equals","not equals","after","before","after or equal","before or equal","between","is empty","is not empty"],
  select: ["equals","not equals"],
};

const OP_LABEL = {
  "contains":"contains","not contains":"does not contain","equals":"equals",
  "not equals":"≠","starts with":"starts with","greater than":">","less than":"<",
  "greater or equal":"≥","less or equal":"≤","after":"after","before":"before",
  "after or equal":"on or after","before or equal":"on or before",
  "between":"is between","is empty":"empty","is not empty":"not empty",
};

// ── Filter templates (batch 22) ────────────────────────────────────────
// The reference "Filter Activities" dialog's "Load template…" list. Each
// template expands into an ordinary condition tree, so it stays editable (and
// clearable) like any hand-made filter.
// "3-week lookahead" is anchored on the record's Last Recalc Date (batch 21);
// without one the window simply starts today.
export const FILTER_TEMPLATES = [
  { id: "withoutPredecessors", label: "Activities without predecessors" },
  { id: "withoutSuccessors",   label: "Activities without successors" },
  { id: "threeWeekLookahead",  label: "3-week lookahead" },
  { id: "startedNotFinished",  label: "Started, not finished" },
  { id: "withConstraints",     label: "Activities with constraints" },
  { id: "negativeFloat",       label: "Negative float" },
  { id: "highFloat",           label: "High float (> 20 days)" },
  { id: "milestones",          label: "Milestones" },
];

const LOOKAHEAD_DAYS = 21;   // "3-week lookahead"
const isoDay = (d) => d.toISOString().slice(0, 10);

/** Window of the 3-week lookahead: [record date, record date + 21 days]. */
function lookaheadWindow(recalcDate) {
  const raw = String(recalcDate || "").trim();
  const from = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : isoDay(new Date());
  const to = isoDay(new Date(new Date(`${from}T00:00:00Z`).getTime() + LOOKAHEAD_DAYS * 86400000));
  return { from, to };
}

/** Condition tree of a reference template — null for an unknown id. */
export function buildTemplateFilters(id, recalcDate) {
  const cond = (field, operator, value, value2) =>
    (value2 === undefined ? { field, operator, value } : { field, operator, value, value2 });
  const only = (c) => ({ logic: "all", conditions: [c], groups: [] });
  switch (id) {
    case "withoutPredecessors": return only(cond("predecessors", "equals", "no"));
    case "withoutSuccessors":   return only(cond("successors", "equals", "no"));
    case "threeWeekLookahead": {
      const { from, to } = lookaheadWindow(recalcDate);
      return {
        logic: "any",
        conditions: [cond("start", "between", from, to), cond("end", "between", from, to)],
        groups: [],
      };
    }
    case "startedNotFinished":
      return {
        logic: "all",
        conditions: [cond("startActual", "equals", "yes"), cond("statusCode", "not equals", "TK_Complete")],
        groups: [],
      };
    case "withConstraints":
      // Either constraint slot counts as "with constraints".
      return {
        logic: "any",
        conditions: [cond("constraintType", "is not empty"), cond("constraintType2", "is not empty")],
        groups: [],
      };
    case "negativeFloat": return only(cond("float", "less than", "0"));
    case "highFloat":     return only(cond("float", "greater than", "20"));
    case "milestones":    return only(cond("milestone", "equals", "yes"));
    default: return null;
  }
}

// ── Custom dropdown (portal-based, never clipped) ──────────────────────
function Dropdown({ value, onChange, options, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(v => !v);
  };

  const sel = options.find(o => o.value === value);
  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} className={className}>
        <span className="truncate">{sel?.label || placeholder || "—"}</span>
        <ChevronDown size={12} className="flex-shrink-0 opacity-40" />
      </button>
      {open && (
        <PortalMenu ref={menuRef} pos={pos} options={options} value={value}
          onSelect={v => { onChange(v); setOpen(false); }} />
      )}
    </>
  );
}

// Portal-rendered menu
const PortalMenu = forwardRef(({ pos, options, value, onSelect }, ref) => {
  return createPortal(
    <div ref={ref} style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
      className="bg-surface border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
      {options.map(o => (
        <button key={o.value} type="button"
          onClick={() => onSelect(o.value)}
          className={`block w-full text-left px-3 py-2 text-[12px] hover:bg-surface-subtle whitespace-nowrap transition-colors ${o.value === value ? "bg-surface-subtle text-primary font-semibold" : "text-text"}`}>
          {o.label}
        </button>
      ))}
    </div>,
    document.body
  );
});
PortalMenu.displayName = "PortalMenu";

// ── Condition defaults ─────────────────────────────────────────────────
function freshCond() {
  return { field: "activity", operator: "contains", value: "" };
}

function freshGroup() {
  return { logic: "all", conditions: [freshCond()], groups: [] };
}

// ── Deep clone (simple, no circular refs possible here) ────────────────
function deepClone(obj) {
  if (!obj || typeof obj !== "object") return obj;
  return JSON.parse(JSON.stringify(obj));
}

// ═══════════════════════════════════════════════════════════════════════
//  GroupBlock — module level, stable reference
// ═══════════════════════════════════════════════════════════════════════
function GroupBlock({ group, path, depth, onUpdate, removeSelf, showLogic = true }) {
  const conds = group.conditions || [];
  const subgroups = group.groups || [];

  // Update a condition at this group level
  const updateCond = (idx, patch) => {
    const next = deepClone(group);
    next.conditions[idx] = { ...next.conditions[idx], ...patch };
    onUpdate(next);
  };

  const updateCondField = (idx, field) => {
    const next = deepClone(group);
    const def = FIELD_MAP[field];
    const ops = OPERATORS[def?.type || "text"];
    next.conditions[idx] = { field, operator: ops[0], value: "" };
    onUpdate(next);
  };

  const addCond = () => {
    const next = deepClone(group);
    next.conditions.push(freshCond());
    onUpdate(next);
  };

  const removeCond = (idx) => {
    const next = deepClone(group);
    next.conditions.splice(idx, 1);
    if (next.conditions.length === 0 && next.groups.length === 0) {
      next.conditions.push(freshCond());
    }
    onUpdate(next);
  };

  const setLogic = (logic) => {
    const next = deepClone(group);
    next.logic = logic;
    onUpdate(next);
  };

  const addSub = () => {
    const next = deepClone(group);
    next.groups.push(freshGroup());
    onUpdate(next);
  };

  const updateSub = (idx, sub) => {
    const next = deepClone(group);
    next.groups[idx] = sub;
    onUpdate(next);
  };

  const removeSub = (idx) => {
    const next = deepClone(group);
    next.groups.splice(idx, 1);
    if (next.conditions.length === 0 && next.groups.length === 0) {
      next.conditions.push(freshCond());
    }
    onUpdate(next);
  };

  const totalItems = conds.length + subgroups.length;

  const selCls = "w-full flex items-center justify-between border border-border rounded-md px-2.5 py-2 text-[12px] text-text bg-surface hover:border-primary focus:outline-none";

  return (
    <div className={depth > 0 ? "ml-5 pl-3 border-l-2 border-border" : ""}>
      {showLogic && totalItems >= 2 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Where</span>
          <div className="inline-flex rounded-md overflow-hidden border border-border">
            <button type="button" onClick={() => setLogic("all")}
              className={`px-3 py-1 text-[12px] font-semibold transition-colors ${group.logic === "all" ? "bg-primary text-surface" : "bg-surface text-text-muted hover:bg-surface-muted"}`}>
              All
            </button>
            <button type="button" onClick={() => setLogic("any")}
              className={`px-3 py-1 text-[12px] font-semibold transition-colors ${group.logic === "any" ? "bg-primary text-surface" : "bg-surface text-text-muted hover:bg-surface-muted"}`}>
              Any
            </button>
          </div>
          <span className="text-[11px] text-text-muted">of the following</span>
          {removeSelf && (
            <button type="button" onClick={removeSelf} className="ml-auto text-text-muted hover:text-danger">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {conds.length > 0 && (
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="text-[11px] font-semibold text-text-muted uppercase tracking-wider text-left pb-2" style={{ width: "34%" }}>Parameter</th>
              <th className="text-[11px] font-semibold text-text-muted uppercase tracking-wider text-left pb-2" style={{ width: "26%" }}>Is</th>
              <th className="text-[11px] font-semibold text-text-muted uppercase tracking-wider text-left pb-2">Value</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {conds.map((cond, idx) => {
              const fieldDef = FIELD_MAP[cond.field];
              const fType = fieldDef?.type || "text";
              const ops = OPERATORS[fType] || OPERATORS.text;
              const needsValue = cond.operator !== "is empty" && cond.operator !== "is not empty";
              const needsValue2 = cond.operator === "between";

              return (
                <tr key={idx} className="border-t border-border">
                  <td className="py-1.5 pr-2">
                    <Dropdown
                      value={cond.field}
                      onChange={v => updateCondField(idx, v)}
                      options={FIELDS}
                      placeholder="Select…"
                      className={selCls}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Dropdown
                      value={cond.operator}
                      onChange={v => updateCond(idx, { operator: v })}
                      options={ops.map(o => ({ value: o, label: OP_LABEL[o] || o }))}
                      className={selCls}
                    />
                  </td>
                  <td className="py-1.5 pr-1">
                    {!needsValue ? (
                      <span className="text-[12px] text-text-muted italic pl-2">—</span>
                    ) : fType === "select" ? (
                      <Dropdown
                        value={cond.value}
                        onChange={v => updateCond(idx, { value: v })}
                        options={[{ value: "", label: "—" }, ...(fieldDef.options || []).map(o => (typeof o === "string" ? { value: o, label: o } : o))]}
                        placeholder="—"
                        className={selCls}
                      />
                    ) : fType === "date" ? (
                      needsValue2 ? (
                        <div className="flex items-center gap-1.5">
                          <input type="date" value={cond.value || ""}
                            onChange={e => updateCond(idx, { value: e.target.value })}
                            className="flex-1 border border-border rounded-md px-2 py-2 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-focus focus:border-primary" />
                          <span className="text-[12px] text-text-muted font-medium">–</span>
                          <input type="date" value={cond.value2 || ""}
                            onChange={e => updateCond(idx, { value2: e.target.value })}
                            className="flex-1 border border-border rounded-md px-2 py-2 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-focus focus:border-primary" />
                        </div>
                      ) : (
                        <input type="date" value={cond.value || ""}
                          onChange={e => updateCond(idx, { value: e.target.value })}
                          className="w-full border border-border rounded-md px-2.5 py-2 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-focus focus:border-primary" />
                      )
                    ) : fType === "number" ? (
                      needsValue2 ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" value={cond.value || ""}
                            onChange={e => updateCond(idx, { value: e.target.value })}
                            placeholder="Min"
                            className="flex-1 border border-border rounded-md px-2 py-2 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-focus focus:border-primary" />
                          <span className="text-[12px] text-text-muted font-medium">–</span>
                          <input type="number" value={cond.value2 || ""}
                            onChange={e => updateCond(idx, { value2: e.target.value })}
                            placeholder="Max"
                            className="flex-1 border border-border rounded-md px-2 py-2 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-focus focus:border-primary" />
                        </div>
                      ) : (
                        <input type="number" value={cond.value || ""}
                          onChange={e => updateCond(idx, { value: e.target.value })}
                          className="w-full border border-border rounded-md px-2.5 py-2 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-focus focus:border-primary" />
                      )
                    ) : (
                      <input type="text" value={cond.value || ""}
                        onChange={e => updateCond(idx, { value: e.target.value })}
                        placeholder="Enter value…"
                        className="w-full border border-border rounded-md px-2.5 py-2 text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:border-primary" />
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    <button type="button" onClick={() => removeCond(idx)} className="text-text-muted hover:text-danger p-1">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {subgroups.map((sg, i) => (
        <div key={i} className="mt-2">
          <GroupBlock group={sg} path={[...path, i]} depth={depth + 1}
            onUpdate={sub => updateSub(i, sub)}
            removeSelf={() => removeSub(i)} />
        </div>
      ))}

      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border">
        <button type="button" onClick={addCond}
          className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary font-medium transition-colors">
          <Plus size={14} /> Add condition
        </button>
        <button type="button" onClick={addSub}
          className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary font-medium transition-colors">
          <CornerDownRight size={14} /> Add sub-group
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  FILTER DIALOG (controlled externally)
// ═══════════════════════════════════════════════════════════════════════
export default function FilterDialog({ open, onClose, filters, onFiltersChange, recalcDate = "" }) {
  // A draft is also initialised during the very first render (React's useState
  // initialiser), so the dialog markup is complete even without effects — the
  // same reason the panels render in their `embedded` mode for the smoke test.
  const [draft, setDraft] = useState(() => {
    if (!open) return null;
    const hasRules = (filters?.conditions?.length || 0) > 0 || (filters?.groups?.length || 0) > 0;
    return deepClone(hasRules ? filters : freshGroup());
  });
  const [templateId, setTemplateId] = useState("");

  const rootGroup = useMemo(() => {
    if (!filters || !filters.conditions || filters.conditions.length === 0) return null;
    return deepClone(filters);
  }, [filters]);

  // Init draft when opening
  useEffect(() => {
    if (open) {
      setDraft(deepClone(rootGroup || freshGroup()));
      setTemplateId("");
    }
  }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps

  const setRootLogic = (logic) => {
    setDraft(d => (d ? { ...d, logic } : d));
  };

  // "Load template…" — replaces the draft with the template's condition tree.
  const loadTemplate = (id) => {
    setTemplateId("");
    if (!id) return;
    const built = buildTemplateFilters(id, recalcDate);
    if (built) setDraft(deepClone(built));
  };

  const applyDraft = () => {
    const clean = (g) => ({
      logic: g.logic,
      conditions: g.conditions.filter(c => {
        if (c.operator === "is empty" || c.operator === "is not empty") return true;
        return (c.value || "").trim() !== "";
      }),
      groups: (g.groups || []).map(clean).filter(g => g.conditions.length > 0 || g.groups.length > 0),
    });
    if (!draft) return;
    const result = clean(draft);
    if (result.conditions.length === 0 && result.groups.length === 0) {
      onFiltersChange({ logic: "all", conditions: [], groups: [] });
    } else {
      onFiltersChange(result);
    }
    onClose();
  };

  const clearAll = () => {
    onFiltersChange({ logic: "all", conditions: [], groups: [] });
    onClose();
  };

  const segBtn = (logic, label) => (
    <button
      type="button"
      onClick={() => setRootLogic(logic)}
      aria-pressed={(draft?.logic || "all") === logic}
      className={`px-3 py-1.5 text-[12px] transition-colors ${
        (draft?.logic || "all") === logic
          ? "bg-primary text-surface font-semibold"
          : "bg-surface text-text-muted hover:bg-surface-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`fixed inset-0 bg-black/40 flex items-center justify-center z-[60] ${open && draft ? "" : "hidden"}`}>
      <div className="bg-surface rounded-xl shadow-2xl w-[720px] max-w-[97vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-[15px] font-semibold text-text flex items-center gap-2">
            <Filter size={17} className="text-primary" />
            Filter Activities
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text p-1">
            <X size={20} />
          </button>
        </div>

        {/* Template picker + root Match logic (reference toolbar row) */}
        <div className="flex flex-wrap items-center gap-3 px-6 pt-4 flex-shrink-0">
          <select
            aria-label="Load filter template"
            value={templateId}
            onChange={e => loadTemplate(e.target.value)}
            className="px-2 py-1.5 text-[12px] border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-focus focus:border-primary w-72"
          >
            <option value="">Load template...</option>
            {FILTER_TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <span className="text-[12px] text-text-muted">Match</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {segBtn("all", "All conditions")}
            {segBtn("any", "Any condition")}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {draft && (
            <GroupBlock group={draft} path={[]} depth={0} onUpdate={setDraft} showLogic={false} />
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border flex-shrink-0">
          <button type="button" onClick={clearAll} className="text-[12px] text-text-muted hover:text-danger font-medium transition-colors">
            Clear filter
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2 text-[12px] font-medium text-text-muted border border-border rounded-md hover:bg-surface-subtle transition-colors">
              Cancel
            </button>
            <button type="button" onClick={applyDraft}
              className="px-5 py-2 text-[12px] font-medium text-surface bg-primary rounded-md hover:bg-primary-active transition-colors">
              Apply filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Derived field resolvers (batch 22) ─────────────────────────────────
// Successor keys used to decide "has a predecessor": XER links carry the
// successor's task_code, other importers carry ids — both are collected.
function linkTargetKeys(task) {
  const keys = [];
  if (Array.isArray(task.links)) {
    for (const l of task.links) {
      const k = l?.succId ?? l?.succCode ?? l?.id;
      if (k != null && k !== "") keys.push(String(k));
    }
  }
  if (task.link != null && task.link !== "") keys.push(String(task.link));
  if (task.linkSuccCode) keys.push(String(task.linkSuccCode));
  return keys;
}

const YES = "yes", NO = "no";
const DERIVED_VALUES = {
  predecessors: (t, successorKeys) =>
    (successorKeys.has(String(t.id)) || successorKeys.has(String(t.activityId)) ? YES : NO),
  successors:   (t) => (linkTargetKeys(t).length > 0 ? YES : NO),
  // Same milestone rule as the Gantt / Quick Filters "Milestones" pill.
  milestone:    (t) => (isMilestoneTask(t) ? YES : NO),
  startActual:  (t) => (t.startActual === true ? YES : NO),
  endActual:    (t) => (t.endActual === true ? YES : NO),
};

function rawValueOf(task, field, successorKeys) {
  const fn = DERIVED_VALUES[field];
  return fn ? fn(task, successorKeys) : task[field];
}

// ═══════════════════════════════════════════════════════════════════════
//  applyFilters — exported for GanttPage
// ═══════════════════════════════════════════════════════════════════════
export function applyFilters(tasks, filters) {
  const group = filters || {};
  const conditions = group.conditions || [];
  const subGroups = group.groups || [];

  if (conditions.length === 0 && subGroups.length === 0) return tasks;

  const logic = group.logic || "all";

  // Pre-pass for the derived link fields
  const successorKeys = new Set();
  for (const t of tasks) {
    if (!t || t.isSection) continue;
    for (const key of linkTargetKeys(t)) successorKeys.add(key);
  }

  function evalCond(task, cond) {
    if (task.isSection) return true;
    const fd = FIELD_MAP[cond.field];
    const type = fd?.type || "text";
    const op = cond.operator;
    const raw = rawValueOf(task, cond.field, successorKeys);

    if (op === "is empty") return raw == null || String(raw).trim() === "";
    if (op === "is not empty") return raw != null && String(raw).trim() !== "";

    const v = raw != null ? String(raw).trim() : "";
    if (!v) return false;

    if (type === "number") {
      const num = parseFloat(v);
      if (isNaN(num)) return false;
      const cv = parseFloat(cond.value);
      if (isNaN(cv)) return false;
      switch (op) {
        case "equals": return num === cv;
        case "not equals": return num !== cv;
        case "greater than": return num > cv;
        case "less than": return num < cv;
        case "greater or equal": return num >= cv;
        case "less or equal": return num <= cv;
        case "between": {
          const cv2 = parseFloat(cond.value2);
          if (isNaN(cv2)) return false;
          return num >= Math.min(cv, cv2) && num <= Math.max(cv, cv2);
        }
        default: return true;
      }
    }

    if (type === "date") {
      const d = new Date(v);
      const cd = new Date(cond.value);
      if (isNaN(d) || isNaN(cd)) return false;
      if (op === "between") {
        const cd2 = cond.value2 ? new Date(cond.value2) : null;
        if (!cd2 || isNaN(cd2)) return d >= cd;
        return d >= new Date(Math.min(cd, cd2)) && d <= new Date(Math.max(cd, cd2));
      }
      switch (op) {
        case "equals": return d.getTime() === cd.getTime();
        case "not equals": return d.getTime() !== cd.getTime();
        case "after": return d > cd;
        case "before": return d < cd;
        case "after or equal": return d >= cd;
        case "before or equal": return d <= cd;
        default: return true;
      }
    }

    const cv = normaliseValue(cond.field, cond.value).toLowerCase();
    const lv = normaliseValue(cond.field, v).toLowerCase();
    switch (op) {
      case "contains": return lv.includes(cv);
      case "not contains": return !lv.includes(cv);
      case "equals": return lv === cv;
      case "not equals": return lv !== cv;
      case "starts with": return lv.startsWith(cv);
      default: return true;
    }
  }

  function evalGroup(g, task) {
    const results = [];
    for (const c of g.conditions) results.push(evalCond(task, c));
    for (const sg of g.groups) results.push(evalGroup(sg, task));
    if (results.length === 0) return true;
    return g.logic === "all" ? results.every(Boolean) : results.some(Boolean);
  }

  const result = [];
  for (const t of tasks) {
    if (t.isSection) { result.push(t); continue; }
    let ok;
    if (logic === "all") {
      ok = true;
      for (const c of conditions) { if (!evalCond(t, c)) { ok = false; break; } }
      if (ok) for (const sg of subGroups) { if (!evalGroup(sg, t)) { ok = false; break; } }
    } else {
      ok = false;
      for (const c of conditions) { if (evalCond(t, c)) { ok = true; break; } }
      if (!ok) for (const sg of subGroups) { if (evalGroup(sg, t)) { ok = true; break; } }
    }
    if (ok) result.push(t);
  }

  const clean = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i].isSection) {
      if (result[i + 1] && !result[i + 1].isSection) clean.push(result[i]);
    } else {
      clean.push(result[i]);
    }
  }
  return clean;
}