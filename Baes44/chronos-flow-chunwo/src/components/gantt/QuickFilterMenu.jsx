import { useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";
import {
  P6_STATUS_CODES, activeFilterBadgeCount, clearQuickFilters,
  countCustomFilterRules, toggleQuickFilter,
} from "@/lib/quickFilters";

/**
 * Quick Filter menu — the XER Viewer toolbar filter (status pills + flags),
 * reproduced with this app's palette.
 *
 * Layout/behaviour follow the reference menu:
 *   · "Last Recalc Date" (batch 21) — the date the loaded record is *at*
 *     (XER `PROJECT.last_recalc_date`). Editable here; the status pills are read
 *     as at this date, so actual progress dated after it is ignored.
 *   · pills:  All │ Not Started │ In Progress │ Completed │ Started │ Milestones │ Critical Path
 *     - status pills are multi-select ("All" clears them)
 *     - Started / Milestones / Critical Path are independent toggles
 *   · divider, then "Custom" → opens this app's full P6 filter dialog
 *   · the toolbar button carries a badge with the number of active criteria
 *
 * Badge count follows the reference `Iy()`: statuses + started + remaining +
 * milestones (+ custom-filter rules). Critical Path is intentionally not counted.
 *
 * Props: quickFilters, onChange(next), customFilter, onOpenCustom(),
 *        recalcDate, onRecalcDateChange(next), fileRecalcDate, defaultOpen (tests)
 */
export default function QuickFilterMenu({
  quickFilters, onChange, onOpenCustom, customFilter,
  recalcDate = "", onRecalcDateChange, fileRecalcDate = "", defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const qf = quickFilters || {};
  const statuses = Array.isArray(qf.statuses) ? qf.statuses : [];
  const badgeCount = activeFilterBadgeCount(qf, customFilter);
  const customOn = countCustomFilterRules(customFilter) > 0;

  const pillOn = (id) => {
    if (id === "all") return statuses.length === 0;
    if (id.startsWith("TK_")) return statuses.includes(id);
    return Boolean(qf[id]);
  };

  const pill = (id, label) => {
    const on = pillOn(id);
    return (
      <button
        key={id}
        onClick={() => onChange(toggleQuickFilter(qf, id))}
        aria-pressed={on}
        className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
          on ? "bg-primary text-surface border-primary" : "bg-surface text-text-muted border-border hover:bg-surface-muted"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Filter activities"
        title="Filter activities"
        aria-haspopup="true"
        aria-expanded={open}
        className={`relative p-1.5 md:p-2 rounded-md focus:outline-none transition-colors ${
          badgeCount > 0
            ? "text-primary bg-primary/10 hover:bg-primary/20"
            : "text-text-muted hover:bg-surface-muted focus:bg-surface-muted"
        } ${open ? "bg-surface-muted" : ""}`}
      >
        <Filter size={18} />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 flex items-center justify-center text-[10px] font-semibold text-surface bg-primary rounded-full ring-1 ring-surface">
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 w-72 p-3 bg-surface border border-border rounded-lg shadow-lg"
        >
          {/* Last Recalc Date — the date the record is at; drives the status pills */}
          <div className="mb-3">
            <label htmlFor="quick-filter-recalc-date" className="block text-[11px] font-semibold text-text-muted mb-1">
              Last Recalc Date
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="quick-filter-recalc-date"
                type="date"
                value={recalcDate || ""}
                onChange={e => { if (onRecalcDateChange) onRecalcDateChange(e.target.value); }}
                title="Date the loaded record is at — statuses are read as at this date"
                className="flex-1 min-w-0 h-7 rounded-md border border-border bg-surface px-1.5 text-xs text-text outline-none focus:border-primary"
              />
              {fileRecalcDate && recalcDate !== fileRecalcDate && (
                <button
                  type="button"
                  onClick={() => { if (onRecalcDateChange) onRecalcDateChange(fileRecalcDate); }}
                  title={`Use the date stored in the file (${fileRecalcDate})`}
                  className="h-7 px-1.5 text-[10px] font-semibold rounded-md border border-border text-text-muted hover:bg-surface-muted"
                >
                  File
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] leading-snug text-text-muted">
              {fileRecalcDate ? `File: ${fileRecalcDate}` : "Record date (XER last_recalc_date)"}
              {recalcDate ? " · actuals dated later are ignored" : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {pill("all", "All")}
            {P6_STATUS_CODES.map(s => pill(s.code, s.label))}
            {pill("started", "Started")}
            {pill("milestones", "Milestones")}
            {pill("critical", "Critical Path")}
          </div>

          <div className="border-t border-border pt-2 flex items-center justify-between gap-2">
            <button
              onClick={() => { setOpen(false); if (onOpenCustom) onOpenCustom(); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md focus:outline-none ${
                customOn ? "text-primary bg-surface-subtle hover:bg-surface-muted" : "text-text hover:bg-surface-muted"
              }`}
            >
              <Filter size={16} />
              Custom
              {customOn && <span className="text-[10px] font-semibold text-primary">On</span>}
            </button>

            {badgeCount > 0 && (
              <button
                onClick={() => onChange(clearQuickFilters())}
                title="Clear all filters"
                className="flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-text-muted hover:text-danger rounded-md focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 4.5 15 15" />
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
