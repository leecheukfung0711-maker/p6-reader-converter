import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { MONTH_LABELS, WEEK_DAY_LABELS, exceptionsInMonth, monthGrid } from "@/lib/calendarView";

/**
 * Batch 63 — the CALENDAR table explorer, modelled on xerviewer.org's "Calendars":
 * a card per calendar (name, type, hours/day, work days/week, holidays) and a dialog
 * that shows the week pattern, a navigable month calendar and the exception list.
 *
 * Presentational only: `calendars` comes from `calendarsFromRows(rows)` (lib/calendarView),
 * and every colour is a Common Look and Feel palette token with an opacity modifier —
 * this stays light-only.
 */
const CARD_STATS = [
  ["hoursPerDay", "h/day"],
  ["workDaysPerWeek", "work days/wk"],
  ["exceptionCount", "holidays"],
];

/** Card + day colours per state (palette tokens only — no slate/blue/gray). */
const STATUS_STYLES = {
  working: "bg-surface text-text border-border",
  nonworking: "bg-surface-muted text-text-muted border-border",
  holiday: "bg-danger/10 text-danger border-danger/40",
  exception: "bg-primary/10 text-primary border-primary/40",
};
const STATUS_DOT = {
  working: "bg-surface-muted",
  nonworking: "bg-border",
  holiday: "bg-danger",
  exception: "bg-primary",
};

export default function CalendarBrowser({ calendars = [], fileName = "" }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calendars;
    return calendars.filter((c) => c.name.toLowerCase().includes(q) || c.typeLabel.toLowerCase().includes(q));
  }, [calendars, query]);

  const open = openId ? calendars.find((c) => String(c.id) === String(openId)) || null : null;

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface-subtle" data-calendar-browser={fileName || "true"}>
      <div className="flex-grow overflow-auto custom-scrollbar min-h-0 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            {list.length} calendar{list.length === 1 ? "" : "s"}.
            {" "}Select one to view its working days, hours and holidays.
          </p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter calendars..."
            aria-label="Filter calendars"
            className="px-3 py-1.5 border border-border rounded-full text-sm shadow-sm bg-surface text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus w-56"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-calendar-count={list.length}>
          {list.map((c) => (
            <button
              key={c.id || c.name}
              type="button"
              onClick={() => setOpenId(c.id)}
              data-calendar-card={c.id}
              className="text-left bg-surface border border-border rounded-lg p-3 hover:border-primary hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <div className="flex items-start gap-2">
                <CalendarDays size={20} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-text truncate" title={c.name}>{c.name}</h3>
                    {c.isDefault && (
                      <span className="text-[9px] font-medium uppercase tracking-wide bg-table-header text-accent-selected px-1 py-0.5 rounded shrink-0">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{c.typeLabel}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                    {CARD_STATS.map(([field, unit]) => (
                      <span key={field}>
                        <span className="font-medium text-text">{c[field]}</span> {unit}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {list.length === 0 && <p className="text-xs text-text-muted">No calendar matches this filter.</p>}
      </div>

      {open && <CalendarDialog calendar={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/**
 * The calendar detail: week pattern, a navigable month calendar (Sunday-first, like
 * P6 numbers its weekdays) and the exception list of the month on screen. It opens on
 * the month of the calendar's first exception, so there is something to look at.
 */
export function CalendarDialog({ calendar, onClose }) {
  const [cursor, setCursor] = useState(() => {
    const first = (calendar.exceptions || [])[0];
    if (first && first.iso) {
      const [year, month] = first.iso.split("-").map(Number);
      if (year && month) return { year, month: month - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const grid = useMemo(
    () => monthGrid(cursor.year, cursor.month, calendar.week, calendar.exceptions),
    [cursor, calendar]
  );
  const monthExceptions = useMemo(
    () => exceptionsInMonth(calendar.exceptions, cursor.year, cursor.month),
    [cursor, calendar]
  );

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shift = (months) => setCursor(({ year, month }) => {
    const moved = new Date(Date.UTC(year, month + months, 1));
    return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() };
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-primary-active/40 flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={calendar.name}
        data-calendar-dialog={calendar.id}
        onClick={(event) => event.stopPropagation()}
        className="bg-surface rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <CalendarDays size={24} className="text-primary shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text truncate" title={calendar.name}>
                {calendar.name}
                {calendar.isDefault && (
                  <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-wide bg-table-header text-accent-selected px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
              </h2>
              <p className="text-xs text-text-muted truncate">{calendar.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text focus:outline-none shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 p-4 space-y-4">
          <div className="grid grid-cols-7 gap-1.5" data-week-pattern="true">
            {calendar.week.map((day) => (
              <div
                key={day.label}
                data-day-state={day.working ? "working" : "nonworking"}
                title={day.working ? day.time : "Non-working"}
                className={`rounded-md border text-center py-2 px-1 ${STATUS_STYLES[day.working ? "working" : "nonworking"]}`}
              >
                <div className="text-[11px] font-medium text-text-muted">{day.label}</div>
                <div className={`text-xs font-semibold ${day.working ? "text-primary" : "text-text-muted"}`}>
                  {day.working ? `${day.hours}h` : "—"}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shift(-12)} title="Previous year" className="p-1 rounded hover:bg-surface-muted text-text-muted focus:outline-none">
                <ChevronsLeft size={16} />
              </button>
              <button type="button" onClick={() => shift(-1)} title="Previous month" className="p-1 rounded hover:bg-surface-muted text-text-muted focus:outline-none">
                <ChevronLeft size={16} />
              </button>
            </div>
            <div className="text-sm font-semibold text-text" data-month-label={grid.label}>{grid.label}</div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shift(1)} title="Next month" className="p-1 rounded hover:bg-surface-muted text-text-muted focus:outline-none">
                <ChevronRight size={16} />
              </button>
              <button type="button" onClick={() => shift(12)} title="Next year" className="p-1 rounded hover:bg-surface-muted text-text-muted focus:outline-none">
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <div className="grid grid-cols-7 bg-surface-subtle border-b border-border">
              {WEEK_DAY_LABELS.map((label) => (
                <div key={label} className="text-center text-[11px] font-semibold text-text-muted py-1.5">{label}</div>
              ))}
            </div>
            {grid.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7">
                {week.map((cell) => (
                  <div
                    key={cell.iso}
                    data-day-status={cell.status}
                    data-day-iso={cell.iso}
                    title={cell.label}
                    className={`relative h-16 border-b border-r border-border p-1 ${STATUS_STYLES[cell.status]} ${cell.inMonth ? "" : "opacity-40"}`}
                  >
                    <div className="text-xs font-medium">{cell.day}</div>
                    {cell.hours > 0 && (
                      <div className="absolute bottom-1 right-1.5 text-[10px] font-medium opacity-80">{cell.hours}h</div>
                    )}
                    {(cell.status === "holiday" || cell.status === "exception") && (
                      <div className={`absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full ${STATUS_DOT[cell.status]}`} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted" data-calendar-legend="true">
            {[
              ["working", "Working"],
              ["nonworking", "Non-working"],
              ["holiday", "Holiday"],
              ["exception", "Working exception"],
            ].map(([status, label]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm border ${STATUS_STYLES[status]}`} />
                {label}
              </span>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-text mb-1.5">Exceptions in {grid.label}</h3>
            {monthExceptions.length === 0 ? (
              <p className="text-xs text-text-muted">No exceptions this month.</p>
            ) : (
              <ul className="text-xs text-text space-y-1">
                {monthExceptions.map((exception) => (
                  <li key={exception.iso} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[exception.working ? "exception" : "holiday"]}`} />
                    <span className="font-medium">{formatLongDate(exception.iso)}</span>
                    <span className="text-text-muted">{exception.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Fri, 01 Jan 2010" — how the exception list dates its rows. */
function formatLongDate(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthName = (MONTH_LABELS[month - 1] || "").slice(0, 3);
  return `${labels[date.getUTCDay()]}, ${String(day).padStart(2, "0")} ${monthName} ${year}`;
}
