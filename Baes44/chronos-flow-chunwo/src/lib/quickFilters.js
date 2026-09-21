/**
 * Quick Filters (batch 20) — the status / flag pill menu from the XER Viewer
 * toolbar (https://www.xerviewer.org/), adapted to this app's task model.
 *
 * Reference implementation (xerviewer bundle, `ganttView` slice):
 *   const defaults = { statuses: [], started: false, remaining: false, milestones: false };
 *   function matches(task, qf) {
 *     return !((qf.statuses.length > 0 && !qf.statuses.includes(task.status))
 *           || (qf.started   && task.actualStartDate == null)
 *           || (qf.remaining && task.status === "TK_Complete")
 *           || (qf.milestones && !task.isMilestone));
 *   }
 *   // "Critical Path" is a separate switch (ganttCriticalPathOnly) in the same menu,
 *   // and "Custom" opens their full rule-based filter editor.
 *
 * Mapped to this app:
 *   status    → `statusCode` (parseXER), falling back to a value derived from `pct`
 *   started   → `startActual === true` (parseXER marks backfilled actual starts)
 *   milestone → only-start or only-end — the same rule UnifiedGanttLayout uses
 *   critical  → `float <= 0` — the same rule as the "Critical (Total Float <= 0)"
 *               bar colour, i.e. the reference's default `zeroFloat` method
 *   Custom    → opens this app's existing P6 filter dialog (FilterBar / FilterDialog)
 */
export const QUICK_FILTER_PILLS = [
  { id: "all", label: "All", kind: "all" },
  { id: "TK_NotStart", label: "Not Started", kind: "status" },
  { id: "TK_Active", label: "In Progress", kind: "status" },
  { id: "TK_Complete", label: "Completed", kind: "status" },
  { id: "started", label: "Started", kind: "flag" },
  { id: "milestones", label: "Milestones", kind: "flag" },
  { id: "critical", label: "Critical Path", kind: "flag" },
];

/** P6 status codes and their labels (same wording as the reference menu). */
export const P6_STATUS_CODES = [
  { code: "TK_NotStart", label: "Not Started" },
  { code: "TK_Active", label: "In Progress" },
  { code: "TK_Complete", label: "Completed" },
];

/** Fresh (empty) quick-filter state — matches the reference defaults. */
export function defaultQuickFilters() {
  return { statuses: [], started: false, remaining: false, milestones: false, critical: false };
}

/**
 * Task status: `statusCode` when present, else derived from the % complete.
 */
export function statusOf(task) {
  const raw = String(task?.statusCode || "").trim();
  if (raw) return raw;
  const pct = Number(task?.pct);
  if (Number.isFinite(pct)) {
    if (pct >= 100) return "TK_Complete";
    if (pct <= 0) return "TK_NotStart";
    return "TK_Active";
  }
  return "";
}

// ── Last Recalc Date (batch 21) ─────────────────────────────────────────────
// P6 stamps every programme with `PROJECT.last_recalc_date` — the date the
// record is *at* (the data date). The status pills are read as at that date, so
// any actual progress dated after it had not happened yet as far as the record
// is concerned. Editing the field therefore changes what the pills show.

/** Normalise a P6 / ISO date ("2024-09-30 08:00", "2024-09-30") → "YYYY-MM-DD". */
export function normalizeRecalcDate(value) {
  const m = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** `last_recalc_date` of the loaded programme (XER `PROJECT` table); "" when absent. */
export function recalcDateFromXerTables(tables) {
  const rows = tables?.PROJECT;
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return normalizeRecalcDate(rows[0]?.last_recalc_date);
}

/** Day part of a task date — task dates are stored as "YYYY-MM-DD" (parseXER). */
function dayOf(value) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, 10) : "";
}

/**
 * Status **as at** the record's last recalc date.
 *   · a completion dated after the record date → still In Progress
 *   · a start dated after the record date     → still Not Started
 * With no record date the stored `statusCode` is returned unchanged.
 */
export function statusAsOf(task, recalcDate) {
  const base = statusOf(task);
  const date = normalizeRecalcDate(recalcDate);
  if (!date) return base;
  const after = (value) => { const d = dayOf(value); return Boolean(d) && d > date; };
  if (base === "TK_Complete" && task?.endActual === true && after(task?.end)) return "TK_Active";
  if (task?.startActual === true && after(task?.start)) return "TK_NotStart";
  return base;
}

/** "Started" as at the record date: an actual start that is not dated after it. */
export function isStartedAsOf(task, recalcDate) {
  if (task?.startActual !== true) return false;
  const date = normalizeRecalcDate(recalcDate);
  if (!date) return true;
  const d = dayOf(task?.start);
  return !d || d <= date;
}

/** Milestone = the Gantt's own rule: only a start (TT_Mile) or only an end (TT_FinMile). */
export function isMilestoneTask(task) {
  const hasStart = Boolean(task?.start);
  const hasEnd = Boolean(task?.end);
  return hasStart !== hasEnd;
}

/** Critical = Total Float <= 0 (the app's critical-bar rule / reference `zeroFloat`). */
export function isCriticalTask(task) {
  const f = task?.float;
  return f != null && Number(f) <= 0;
}

/**
 * Does one task pass the quick filters? Group-header rows always pass.
 * `recalcDate` (Last Recalc Date) makes the status / started predicates read the
 * task *as at* that date — see `statusAsOf()` / `isStartedAsOf()`.
 */
export function matchesQuickFilters(task, qf, recalcDate) {
  if (!task || task.isSection) return true;
  const f = qf || {};
  if (Array.isArray(f.statuses) && f.statuses.length > 0 && !f.statuses.includes(statusAsOf(task, recalcDate))) return false;
  if (f.started && !isStartedAsOf(task, recalcDate)) return false;
  if (f.remaining && statusAsOf(task, recalcDate) === "TK_Complete") return false;
  if (f.milestones && !isMilestoneTask(task)) return false;
  if (f.critical && !isCriticalTask(task)) return false;
  return true;
}

/** How many quick-filter criteria are active (drives the toolbar badge). */
export function countActiveQuickFilters(qf) {
  const f = qf || {};
  return (Array.isArray(f.statuses) ? f.statuses.length : 0)
    + (f.started ? 1 : 0)
    + (f.remaining ? 1 : 0)
    + (f.milestones ? 1 : 0)
    + (f.critical ? 1 : 0);
}

/**
 * Criteria counted for the toolbar badge — the reference's `Iy()`:
 *   statuses + started + remaining + milestones   (+ custom-filter rules)
 * "Critical Path" is deliberately NOT counted (it is a separate switch in the
 * reference, and its "Clear" resets it separately).
 */
export function countQuickFilterCriteria(qf) {
  return countActiveQuickFilters({ ...(qf || {}), critical: false });
}

/** Number of custom-filter rules currently defined (same idea as the reference). */
export function countCustomFilterRules(customFilter) {
  if (!customFilter) return 0;
  const conditions = Array.isArray(customFilter.conditions)
    ? customFilter.conditions.filter(c => c && c.field).length
    : 0;
  const groups = Array.isArray(customFilter.groups) ? customFilter.groups.length : 0;
  return conditions + groups;
}

/** Badge value shown on the toolbar button (`kr` in the reference). */
export function activeFilterBadgeCount(qf, customFilter) {
  return countQuickFilterCriteria(qf) + countCustomFilterRules(customFilter);
}

/** "Clear" in the reference: reset every quick criterion *and* Critical Path. */
export function clearQuickFilters() {
  return defaultQuickFilters();
}

export function hasActiveQuickFilters(qf) {
  return countActiveQuickFilters(qf) > 0;
}

/**
 * Apply the quick filters to the task list.
 * Group headers whose activities are all filtered out are dropped (the same
 * behaviour as the existing "Diff Only" quick filter); activities themselves are
 * never touched or reordered.
 *
 * `recalcDate` = the record's Last Recalc Date; the status / started predicates
 * are evaluated as at that date (batch 21). With no criteria active nothing is
 * filtered, so the date alone never hides rows.
 */
export function applyQuickFilters(tasks, qf, recalcDate) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!hasActiveQuickFilters(qf)) return list;
  const kept = list.filter(t => matchesQuickFilters(t, qf, recalcDate));
  return kept.filter((t, i) => {
    if (!t.isSection) return true;
    for (let j = i + 1; j < kept.length; j++) {
      if (kept[j].isSection) break;
      return true;                       // section still holds an activity
    }
    return false;                        // empty group header → hide
  });
}

/**
 * Pill click behaviour (mirrors the reference menu):
 *   · "all"          → clear the status pills (flags stay as they are)
 *   · status pills   → multi-select toggle
 *   · flag pills     → boolean toggle ("started" / "milestones" / "critical")
 */
export function toggleQuickFilter(qf, id) {
  const f = { ...defaultQuickFilters(), ...(qf || {}) };
  if (id === "all") return { ...f, statuses: [] };
  if (id === "started" || id === "milestones" || id === "critical") return { ...f, [id]: !f[id] };
  const statuses = Array.isArray(f.statuses) ? f.statuses : [];
  return {
    ...f,
    statuses: statuses.includes(id) ? statuses.filter(s => s !== id) : [...statuses, id],
  };
}
