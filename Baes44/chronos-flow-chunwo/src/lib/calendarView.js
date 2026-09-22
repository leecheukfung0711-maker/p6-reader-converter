/**
 * Batch 63 — Calendars view (modelled on xerviewer.org's "Calendars").
 *
 * A P6 calendar is one row in the CALENDAR table whose whole definition sits in the
 * `clndr_data` column, in P6's own nested syntax:
 *
 *   (0||CalendarData()(
 *      (0||DaysOfWeek()( (0||1()( (0||0(s|07:00|f|17:00)()) ) … (0||7()( … ) ))
 *      (0||VIEW(ShowTotal|Y)())
 *      (0||Exceptions()( (0||0(d|40179)()) … ) ))
 *
 * Weekday keys are 1 = Sunday … 7 = Saturday (which is also how the reference viewer
 * lays the week out: Sun first). An exception normally means "holiday, non-working";
 * when it carries its own periods (`s|`/`f|`) it is a *working* exception.
 *
 * The rows also carry `day_hr_cnt` / `week_hr_cnt` (and `clndr_type` = CA_Base /
 * CA_Project / CA_Rsrc), which is what the cards show. Everything here is pure.
 */

export const WEEK_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PERIOD_RE = /s\|(\d{1,2}:\d{2})\|f\|(\d{1,2}:\d{2})/g;

const round2 = (n) => Math.round(n * 100) / 100;

/** P6 (OLE automation) day serial → ISO date; "" when it is not a usable number. */
export function p6SerialToISO(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

function hoursBetween(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  return minutes > 0 ? round2(minutes / 60) : 0;
}

/** The work periods inside a chunk of clndr_data: [{ start, end, hours }]. */
export function periodsIn(text) {
  const periods = [];
  for (const m of String(text || "").matchAll(PERIOD_RE)) {
    periods.push({ start: m[1], end: m[2], hours: hoursBetween(m[1], m[2]) });
  }
  return periods;
}

/** "07:00–17:00" (multiple periods joined with ", "), or "" for none. */
export function periodText(periods) {
  return (periods || []).map((p) => `${p.start}–${p.end}`).join(", ");
}

/** The body of a named section, e.g. "(0||DaysOfWeek()(" up to the end of the string. */
function sectionBody(data, name) {
  const marker = `(0||${name}()(`;
  const text = String(data || "");
  const start = text.indexOf(marker);
  return start < 0 ? "" : text.slice(start + marker.length);
}

/** The numbered children of a section as [key, content] pairs. */
function numberedChildren(body) {
  const parts = String(body || "").split(/\(0\|\|(\d+)\(\)\(?/);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) out.push([parts[i], parts[i + 1] || ""]);
  return out;
}

/**
 * The week pattern as 7 entries, Sunday first:
 * `{ index, label, working, hours, periods, time }`.
 */
export function workWeekFromClndrData(data) {
  const week = WEEK_DAY_LABELS.map((label, index) => ({
    index, label, working: false, hours: 0, periods: [], time: "",
  }));
  for (const [key, body] of numberedChildren(sectionBody(data, "DaysOfWeek"))) {
    const day = Number(key) - 1;
    if (!(day >= 0 && day < 7)) continue;
    const periods = periodsIn(body);
    week[day] = {
      ...week[day],
      working: periods.length > 0,
      hours: round2(periods.reduce((sum, p) => sum + p.hours, 0)),
      periods,
      time: periodText(periods),
    };
  }
  return week;
}

/**
 * The exceptions of a calendar, sorted by date:
 * `{ serial, iso, working, hours, periods, time }` — `working` marks the rarer case of
 * an exception that turns a non-working day into a working one.
 */
export function exceptionsFromClndrData(data) {
  const parts = sectionBody(data, "Exceptions").split(/\(0\|\|(\d+)\(d\|(\d+)\)\(/);
  const out = [];
  for (let i = 1; i < parts.length; i += 3) {
    const serial = parts[i + 1];
    const iso = p6SerialToISO(serial);
    if (!iso) continue;
    const periods = periodsIn(parts[i + 2] || "");
    out.push({
      serial: Number(serial),
      iso,
      working: periods.length > 0,
      hours: round2(periods.reduce((sum, p) => sum + p.hours, 0)),
      periods,
      time: periodText(periods),
    });
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso));
}

function toNumber(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Everything a card and the dialog need for one CALENDAR row. */
export function calendarSummary(row = {}) {
  const week = workWeekFromClndrData(row.clndr_data);
  const exceptions = exceptionsFromClndrData(row.clndr_data);
  const type = String(row.clndr_type || "").trim();
  const dayHours = toNumber(row.day_hr_cnt) || round2(Math.max(0, ...week.map((d) => d.hours)));
  const weekHours = toNumber(row.week_hr_cnt) || round2(week.reduce((sum, d) => sum + d.hours, 0));
  return {
    id: String(row.clndr_id ?? ""),
    name: String(row.clndr_name || "").trim() || "Unnamed calendar",
    type,
    typeLabel: type.replace(/^CA_/, "") || "—",
    isDefault: String(row.default_flag || "").trim().toUpperCase() === "Y",
    hoursPerDay: dayHours,
    hoursPerWeek: weekHours,
    workDaysPerWeek: week.filter((d) => d.working).length,
    exceptionCount: exceptions.length,
    week,
    exceptions,
    subtitle: [
      type,
      `${dayHours} h/day`,
      `${weekHours}h/week`,
      `${exceptions.length} exception${exceptions.length === 1 ? "" : "s"}`,
    ].filter(Boolean).join(" · "),
  };
}

/** The CALENDAR rows as card-ready summaries, in file order. */
export function calendarsFromRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object")
    .map((row) => calendarSummary(row));
}

/** "January 2010" */
export function monthLabel(year, month) {
  return `${MONTH_LABELS[month] || ""} ${year}`.trim();
}

function cellLabel(status, hours) {
  if (status === "holiday") return "Holiday / non-working";
  if (status === "nonworking") return "Non-working day";
  if (status === "exception") return hours ? `Working exception · ${hours}h` : "Working exception";
  return hours ? `Working day · ${hours}h` : "Working day";
}

/**
 * One month as six Sunday-first weeks of day cells:
 * `{ iso, day, inMonth, status, hours, label }` with status
 * `working | nonworking | holiday | exception`.
 */
export function monthGrid(year, month, week, exceptions) {
  const byDate = new Map((exceptions || []).map((e) => [e.iso, e]));
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const start = Date.UTC(year, month, 1 - firstOfMonth.getUTCDay());
  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    const row = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start + (w * 7 + d) * 86400000);
      const iso = date.toISOString().slice(0, 10);
      const exception = byDate.get(iso);
      const pattern = (week || [])[date.getUTCDay()] || { working: false, hours: 0 };
      let status = pattern.working ? "working" : "nonworking";
      let hours = pattern.hours;
      if (exception) {
        if (exception.working) { status = "exception"; hours = exception.hours; }
        else { status = "holiday"; hours = 0; }
      }
      row.push({
        iso,
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month,
        status,
        hours,
        label: cellLabel(status, hours),
      });
    }
    weeks.push(row);
  }
  return { year, month, label: monthLabel(year, month), weeks };
}

/** The exceptions inside one month, with the note the dialog lists them under. */
export function exceptionsInMonth(exceptions, year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return (exceptions || [])
    .filter((e) => String(e.iso || "").startsWith(prefix))
    .map((e) => ({
      ...e,
      note: e.working
        ? (e.hours ? `Working exception (${e.hours}h)` : "Working exception")
        : "Non-working (holiday)",
    }));
}
