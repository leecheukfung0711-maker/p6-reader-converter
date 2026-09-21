/**
 * ColumnVisibilityPanel - Column visibility settings panel
 * Uses checkboxes to manage field display/hide, ensuring PDF export accuracy
 */
import { useState, useEffect } from "react";
import { Settings, Eye, EyeOff, X } from "lucide-react";

const COLUMN_GROUPS = [
  {
    name: "Basic Fields",
    columns: ["type", "rownum", "item", "activityId", "activity"]
  },
  {
    name: "Date Fields",
    columns: ["start", "end", "link"]
  },
  {
    name: "Progress Fields",
    columns: ["duration", "remainDur", "float", "pct"]
  },
  {
    name: "Baseline Fields",
    columns: ["blStart", "blEnd"]
  },
  {
    name: "P6 Advanced Fields",
    columns: ["earlyStart", "earlyEnd", "lateStart", "lateEnd", "freeFloat", "expectedFinish", "primaryResource", "durationType", "completePctType", "statusCode", "constraintType", "constraintDate", "constraintType2", "constraintDate2", "suspendDate", "resumeDate", "priorityType", "locationId", "estWt", "drivingPathFlag", "lockPlanFlag", "autoComputeActFlag", "actLaborUnits", "actNonlaborUnits", "remLaborUnits", "remNonlaborUnits", "planLaborUnits", "planNonlaborUnits", "reviewFinish", "reviewStatus", "externalEarlyStart", "externalLateFinish", "remEarlyStart", "remEarlyFinish", "remLateStart", "remLateFinish", "floatPath", "floatPathOrder", "p6Guid", "p6TaskId", "targetDuration", "calendar"]
  }
];

const COLUMN_LABELS = {
  type: "Type",
  rownum: "#",
  item: "Item",
  activityId: "Activity ID",
  activity: "Activity Name",
  start: "Start Date",
  end: "End Date",
  link: "Predecessor",
  duration: "Duration",
  remainDur: "Rem. Duration",
  float: "Total Float",
  pct: "% Complete",
  blStart: "BL Start",
  blEnd: "BL End",
  earlyStart: "Early Start",
  earlyEnd: "Early Finish",
  lateStart: "Late Start",
  lateEnd: "Late Finish",
  freeFloat: "Free Float",
  expectedFinish: "Expected Finish",
  primaryResource: "Primary Resource",
  durationType: "Duration Type",
  completePctType: "% Complete Type",
  statusCode: "Status Code",
  constraintType: "Constraint Type",
  constraintDate: "Constraint Date",
  constraintType2: "Secondary Constraint",
  constraintDate2: "Secondary Constraint Date",
  suspendDate: "Suspend Date",
  resumeDate: "Resume Date",
  priorityType: "Priority Type",
  locationId: "Location ID",
  estWt: "Est. Weight",
  drivingPathFlag: "Driving Path",
  lockPlanFlag: "Lock Plan",
  autoComputeActFlag: "Auto Compute Actuals",
  actLaborUnits: "Actual Labor Units",
  actNonlaborUnits: "Actual Nonlabor Units",
  remLaborUnits: "Remaining Labor Units",
  remNonlaborUnits: "Remaining Nonlabor Units",
  planLaborUnits: "Planned Labor Units",
  planNonlaborUnits: "Planned Nonlabor Units",
  reviewFinish: "Review Finish",
  reviewStatus: "Review Status",
  externalEarlyStart: "External Early Start",
  externalLateFinish: "External Late Finish",
  remEarlyStart: "Remaining Early Start",
  remEarlyFinish: "Remaining Early Finish",
  remLateStart: "Remaining Late Start",
  remLateFinish: "Remaining Late Finish",
  floatPath: "Float Path",
  floatPathOrder: "Float Path Order",
  p6Guid: "P6 GUID",
  p6TaskId: "P6 Task ID",
  targetDuration: "Target Duration",
  calendar: "Calendar"
};

export default function ColumnVisibilityPanel({ columnVisibility, setColumnVisibility, embedded = false, onClose }) {
  const [localVisibility, setLocalVisibility] = useState(columnVisibility || {});

  useEffect(() => {
    setLocalVisibility(columnVisibility || {});
  }, [columnVisibility]);

  const handleToggle = (colKey) => {
    const current = localVisibility || {};
    const next = {
      ...current,
      [colKey]: { ...current[colKey], visible: !current[colKey]?.visible }
    };
    setLocalVisibility(next);
    setColumnVisibility(next);
  };

  const handleToggleGroup = (groupColumns, visible) => {
    const current = localVisibility || {};
    const next = { ...current };
    groupColumns.forEach(col => {
      if (next[col]) {
        next[col] = { ...next[col], visible };
      }
    });
    setLocalVisibility(next);
    setColumnVisibility(next);
  };

  const handleShowAll = () => {
    const current = localVisibility || {};
    const next = {};
    Object.keys(current).forEach(key => {
      next[key] = { ...current[key], visible: true };
    });
    setLocalVisibility(next);
    setColumnVisibility(next);
  };

  const handleHideAll = () => {
    const current = localVisibility || {};
    const next = {};
    Object.keys(current).forEach(key => {
      next[key] = { ...current[key], visible: false };
    });
    setLocalVisibility(next);
    setColumnVisibility(next);
  };

  const handleReset = () => {
    // Reset to default: basic + date fields visible, others hidden
    const current = localVisibility || {};
    const next = {};
    const defaultVisible = ["type", "rownum", "item", "activityId", "activity", "start", "end", "link", "duration"];
    const allColumns = COLUMN_GROUPS.flatMap(g => g.columns || []);
    allColumns.forEach(key => {
      next[key] = { visible: defaultVisible.includes(key) };
    });
    setLocalVisibility(next);
    setColumnVisibility(next);
  };

  const getGroupVisibility = (groupColumns) => {
    if (!groupColumns || !Array.isArray(groupColumns) || !localVisibility) return false;
    const visible = groupColumns.filter(col => col && localVisibility[col]?.visible !== false);
    if (visible.length === 0) return false;
    if (visible.length === groupColumns.length) return true;
    return "partial";
  };

  return (
    <div className={embedded ? "flex flex-col" : "fixed inset-0 bg-black/50 flex items-center justify-center z-50"} onClick={embedded ? undefined : onClose}>
      <div 
        className={embedded ? "bg-surface flex flex-col w-full" : "bg-surface rounded-xl shadow-2xl flex flex-col"}
        style={embedded ? undefined : { width: 680, maxWidth: "96vw", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {!embedded && (
        <>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-primary" />
            <h2 className="text-base font-semibold text-text">Column Visibility Settings</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>
        </>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Quick Actions */}
          <div className="flex gap-2 mb-4 pb-4 border-b border-border">
            <button
              onClick={handleShowAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-surface-subtle hover:bg-surface-subtle active:bg-surface-subtle rounded transition-colors"
            >
              <Eye size={12} /> Show All
            </button>
            <button
              onClick={handleHideAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted bg-surface-muted hover:bg-surface-muted active:bg-surface-muted rounded transition-colors"
            >
              <EyeOff size={12} /> Hide All
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted bg-surface-muted hover:bg-surface-muted active:bg-surface-muted rounded transition-colors"
            >
              ↺ Reset to Default
            </button>
          </div>

          {/* Column Groups */}
          <div className="space-y-4">
            {COLUMN_GROUPS.map((group, groupIdx) => {
              if (!group || !group.columns) return null;
              const groupVis = getGroupVisibility(group.columns);
              return (
                <div key={groupIdx} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-surface-subtle px-4 py-2.5 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text">{group.name}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleGroup(group.columns, true)}
                        className="p-1 text-text-muted hover:text-primary active:text-primary transition-colors"
                        title="Show all fields in this group"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleGroup(group.columns, false)}
                        className="p-1 text-text-muted hover:text-text active:text-text transition-colors"
                        title="Hide all fields in this group"
                      >
                        <EyeOff size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 grid grid-cols-2 gap-2">
                    {group.columns.map(colKey => {
                      const isVisible = (localVisibility && localVisibility[colKey]?.visible) !== false;
                      return (
                        <label
                          key={colKey}
                          className="flex items-center gap-2 cursor-pointer hover:bg-surface-subtle rounded px-1 py-0.5 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => handleToggle(colKey)}
                            className="accent-primary w-4 h-4"
                          />
                          <span className="text-xs text-text">
                            {COLUMN_LABELS[colKey] || colKey}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!embedded && (
        <>
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="text-xs text-text-muted">
            ✓ Settings apply immediately and affect PDF export
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface bg-primary hover:bg-primary-active rounded transition-colors"
          >
            Done
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}