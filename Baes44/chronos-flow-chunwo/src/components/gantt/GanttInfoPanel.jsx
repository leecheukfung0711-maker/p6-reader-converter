import { useEffect, useMemo, useRef, useState } from "react";
import { parseISO, isValid, differenceInDays } from "date-fns";
import { buildRelationshipDetails } from "@/lib/buildRelationshipMap";
import { formatDisplayDate } from "@/lib/displaySettings";
import { countWorkingDays } from "@/lib/hkWorkingDays";

// ── Relationship types ───────────────────────────────────────────────────────
// Accepts every spelling used across the app ("FS", "PR_FS", "Finish to Start").
const REL_NAMES = {
  FS: "Finish-to-Start",
  SS: "Start-to-Start",
  FF: "Finish-to-Finish",
  SF: "Start-to-Finish",
};
function normRelType(value) {
  const s = String(value || "").trim().toUpperCase();
  if (REL_NAMES[s]) return s;
  if (/^PR_[A-Z]{2}$/.test(s)) return s.slice(3);
  if (s.startsWith("FINISH TO")) return s.includes("START") ? "FS" : "FF";
  if (s.startsWith("START TO")) return s.includes("START") ? "SS" : "SF";
  const short = s.replace(/[^A-Z]/g, "");
  return REL_NAMES[short] ? short : "FS";
}

/**
 * P6 "driving path" for the predecessors table: a predecessor drives its
 * successor when it is the one that constrains the start — i.e. its finish
 * (+ lag) is closest to the successor's start. Only the closest predecessor(s)
 * within one day are flagged, which matches P6's single driving predecessor in
 * the normal case (FS relationships, as drawn in the pasted reference).
 */
function computeDrivingPredecessors(task, rows) {
  const driving = new Set();
  if (!task) return driving;
  const succStart = parseISO(task.start || task.earlyStart || "");
  if (!isValid(succStart)) return driving;

  const scored = [];
  rows.forEach(r => {
    const t = r.task;
    if (!t) return;
    const finish = parseISO(t.end || t.earlyEnd || t.start || "");
    if (!isValid(finish)) return;
    scored.push({ id: r.id, delta: Math.abs(differenceInDays(succStart, finish) - (Number(r.lag) || 0)) });
  });
  if (!scored.length) return driving;
  const min = Math.min(...scored.map(s => s.delta));
  if (min > 1) return driving;
  scored.filter(s => s.delta === min).forEach(s => driving.add(s.id));
  return driving;
}

// ── Tab definitions (icons identical to the reference implementation) ────────
const TABS = [
  {
    key: "general",
    label: "General",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853L14.25 14.25M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    ),
  },
  {
    key: "status",
    label: "Status",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="4" fill="currentColor" />
      </>
    ),
  },
  {
    key: "resources",
    label: "Resources",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    ),
  },
  {
    key: "relationships",
    label: "Relationships",
    icon: (
      <>
        <circle cx="5" cy="6" r="2.6"></circle>
        <path d="M3.7 6 H6.2"></path>
        <path d="M5.2 5 L6.4 6 L5.2 7"></path>
        <path d="M7.6 6 H10.2"></path>
        <circle cx="11.5" cy="6" r="1.25"></circle>
        <path d="M12.7 6 C 15.7 6.3 15.8 10.3 11.2 11"></path>
        <circle cx="10" cy="12" r="1.25"></circle>
        <path d="M9 12.7 C 6 13.6 6.3 17.8 11.8 17.8"></path>
        <circle cx="13" cy="18" r="1.25"></circle>
        <path d="M14.3 18 H16.4"></path>
        <circle cx="19" cy="18" r="2.6"></circle>
        <circle cx="19" cy="18" r="1"></circle>
      </>
    ),
  },
  {
    key: "codes",
    label: "Codes",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"></path>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z"></path>
      </>
    ),
  },
  {
    key: "notebook",
    label: "Notebook",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    ),
  },
];

function TabIcon({ tab, className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      {tab.icon}
    </svg>
  );
}

// ── Small building blocks ────────────────────────────────────────────────────
function InfoRow({ label, value, mono = false }) {
  const empty = value == null || value === "";
  return (
    <div className="flex items-start gap-2 px-3 py-1 border-b border-border last:border-0">
      <span className="text-[10px] uppercase tracking-wide text-text-muted w-32 shrink-0 pt-0.5">{label}</span>
      <span
        className={`text-[11px] break-words min-w-0 ${mono ? "font-mono" : ""} ${empty ? "text-text-muted" : "text-text"}`}
        title={empty ? undefined : String(value)}
      >
        {empty ? "—" : value}
      </span>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="border border-border rounded-md overflow-hidden bg-surface mb-2">
      <div className="bg-surface-subtle px-3 py-2 border-b border-border">
        <h4 className="text-xs font-semibold text-text">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 gap-1">
      <span className="text-xs font-medium text-text-muted">{title}</span>
      {hint && <span className="text-[10px] text-text-muted leading-relaxed">{hint}</span>}
    </div>
  );
}

/** One of the two stacked tables (Predecessors / Successors) in the reference DOM. */
function RelCard({ title, rows, showDriving, height, onJump }) {
  return (
    <div className="flex flex-col border border-border rounded-md overflow-hidden bg-surface" style={{ height }}>
      <div className="bg-surface-subtle px-3 py-2 border-b border-border flex-shrink-0">
        <h4 className="text-sm font-semibold text-text">{title} ({rows.length})</h4>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse table-fixed">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-muted border-b border-border">
              {[["Activity ID", 80, "t"], ["Activity Name", 200, "t"], ["Rel. Type", 60, "c"], ["Lag", 60, "c"], ...(showDriving ? [["Driving", 64, "c"]] : [])]
                .map(([label, width, align]) => (
                  <th
                    key={label}
                    className={`px-2 py-1 font-semibold text-[10px] text-text whitespace-nowrap border-r border-border bg-surface-muted relative ${align === "t" ? "text-left" : "text-center"}`}
                    style={{ width }}
                  >
                    <div className={`flex items-center ${align === "t" ? "" : "justify-center"}`}>{label}</div>
                    <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary opacity-0 hover:opacity-100 transition-opacity z-10" title="Drag to resize column" />
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                title="Click to jump to this activity"
                onClick={() => onJump && onJump(r.id)}
                className={`${i % 2 === 0 ? "bg-surface" : ""} hover:bg-surface-subtle transition-colors duration-150 cursor-pointer`}
              >
                <td className="px-2 py-1 text-[10px] text-text font-medium border-r border-border align-middle" title={r.code} style={{ width: 80 }}>
                  <div className="truncate" style={{ maxWidth: 64 }}>{r.code || "—"}</div>
                </td>
                <td className="px-2 py-1 text-[10px] text-text-muted border-r border-border align-middle" title={r.name} style={{ width: 200 }}>
                  <div className="truncate" style={{ maxWidth: 184 }}>{r.name || "—"}</div>
                </td>
                <td className="px-2 py-1 text-[10px] text-text whitespace-nowrap border-r border-border text-center align-middle" title={REL_NAMES[r.type]} style={{ width: 60 }}>
                  {r.type}
                </td>
                <td className="px-2 py-1 text-[10px] text-text-muted whitespace-nowrap text-center border-r border-border align-middle" title={String(r.lag)} style={{ width: 60 }}>
                  {r.lag}
                </td>
                {showDriving && (
                  <td
                    className="px-2 py-1 text-[10px] whitespace-nowrap text-center align-middle"
                    title={r.driving ? "Predecessor is on the driving path" : "Predecessor activity is not on the driving path"}
                    style={{ width: 64 }}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      tabIndex={-1}
                      checked={!!r.driving}
                      aria-label={`${r.code} ${r.driving ? "is on the driving path" : "is not on the driving path"}`}
                      className="h-3.5 w-3.5 align-middle accent-primary pointer-events-none"
                    />
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showDriving ? 5 : 4} className="px-2 py-3 text-[10px] text-text-muted text-center">
                  No {showDriving ? "predecessors" : "successors"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab content ──────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  TK_NotStart: "Not Started",
  TK_Active: "Active",
  TK_Complete: "Completed",
};
function statusLabel(code) {
  if (!code) return "";
  return STATUS_LABELS[code] || code;
}

function GeneralTab({ task, d, durationText }) {
  return (
    <div className="px-2">
      <InfoCard title="Activity">
        <InfoRow label="Activity ID" value={task.activityId} mono />
        <InfoRow label="Activity Name" value={task.activity} />
        <InfoRow label="Item" value={task.item} />
        <InfoRow label="Bar type" value={task.barType === "delay" ? "Delay" : "Baseline"} />
        <InfoRow label="P6 Task ID" value={task.p6TaskId} mono />
        <InfoRow label="GUID" value={task.p6Guid} mono />
      </InfoCard>
      <InfoCard title="Dates & duration">
        <InfoRow label="Start" value={d(task.start)} />
        <InfoRow label="Finish" value={d(task.end)} />
        <InfoRow label="Duration" value={durationText} />
        <InfoRow label="Baseline start" value={d(task.baselineStart)} />
        <InfoRow label="Baseline finish" value={d(task.baselineFinish)} />
        <InfoRow label="Expected finish" value={d(task.expectedFinish)} />
      </InfoCard>
      <InfoCard title="Scheduling">
        <InfoRow label="Early start" value={d(task.earlyStart)} />
        <InfoRow label="Early finish" value={d(task.earlyEnd)} />
        <InfoRow label="Late start" value={d(task.lateStart)} />
        <InfoRow label="Late finish" value={d(task.lateEnd)} />
        <InfoRow label="Total float" value={task.float != null ? `${task.float} d` : ""} />
        <InfoRow label="Free float" value={task.freeFloat != null ? `${task.freeFloat} d` : ""} />
        <InfoRow label="Duration type" value={task.durationType} />
        <InfoRow label="Calendar" value={task.calendar} />
      </InfoCard>
      <InfoCard title="Classification">
        <InfoRow label="Status" value={statusLabel(task.statusCode)} />
        <InfoRow label="Constraint" value={task.constraintType} />
        <InfoRow label="Constraint date" value={d(task.constraintDate)} />
        <InfoRow label="Priority" value={task.priorityType} />
        <InfoRow label="Location" value={task.locationId} />
      </InfoCard>
    </div>
  );
}

function StatusTab({ task, d, rawDate }) {
  return (
    <div className="px-2">
      <InfoCard title="Progress">
        <InfoRow label="Status" value={statusLabel(task.statusCode)} />
        <InfoRow label="Status code" value={task.statusCode} mono />
        <InfoRow label="% complete" value={task.pct != null ? `${task.pct}%` : ""} />
        <InfoRow label="Remaining duration" value={task.remainDur != null ? `${task.remainDur} d` : ""} />
        <InfoRow label="Complete % type" value={task.completePctType} />
      </InfoCard>
      <InfoCard title="Actual dates">
        <InfoRow label="Actual start" value={rawDate(task._originalXerData?.act_start_date)} />
        <InfoRow label="Actual finish" value={rawDate(task._originalXerData?.act_end_date)} />
        <InfoRow label="Suspend date" value={d(task.suspendDate)} />
        <InfoRow label="Resume date" value={d(task.resumeDate)} />
      </InfoCard>
      <InfoCard title="Units">
        <InfoRow label="Planned labour" value={task.planLaborUnits} />
        <InfoRow label="Actual labour" value={task.actLaborUnits} />
        <InfoRow label="Remaining labour" value={task.remLaborUnits} />
        <InfoRow label="Planned non-labour" value={task.planNonlaborUnits} />
        <InfoRow label="Actual non-labour" value={task.actNonlaborUnits} />
        <InfoRow label="Remaining non-labour" value={task.remNonlaborUnits} />
      </InfoCard>
      <InfoCard title="Review">
        <InfoRow label="Review status" value={task.reviewStatus} />
        <InfoRow label="Review finish" value={d(task.reviewFinish)} />
      </InfoCard>
    </div>
  );
}

function ResourcesTab({ task }) {
  const unitValues = [
    task.planLaborUnits, task.actLaborUnits, task.remLaborUnits,
    task.planNonlaborUnits, task.actNonlaborUnits, task.remNonlaborUnits,
  ];

  if (!task.primaryResource && !unitValues.some(v => v != null)) {
    return (
      <EmptyState
        title="No resources assigned"
        hint="此 programme 未帶入資源指派（P6 TASKKSRC / TASKRSRC）。XER 的 rsrc_id 有值時會顯示在這裡。"
      />
    );
  }

  const rows = [
    { label: "Labour", plan: task.planLaborUnits, act: task.actLaborUnits, rem: task.remLaborUnits },
    { label: "Non-labour", plan: task.planNonlaborUnits, act: task.actNonlaborUnits, rem: task.remNonlaborUnits },
  ];

  return (
    <div className="px-2">
      <InfoCard title="Primary resource">
        <InfoRow label="Resource" value={task.primaryResource} />
      </InfoCard>
      <InfoCard title="Units">
        <table className="w-full border-collapse table-fixed text-[10px]">
          <thead>
            <tr className="bg-surface-muted border-b border-border">
              <th className="px-2 py-1 text-left font-semibold text-text border-r border-border">Units</th>
              <th className="px-2 py-1 text-center font-semibold text-text border-r border-border" style={{ width: 70 }}>Planned</th>
              <th className="px-2 py-1 text-center font-semibold text-text border-r border-border" style={{ width: 70 }}>Actual</th>
              <th className="px-2 py-1 text-center font-semibold text-text" style={{ width: 70 }}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={i === 0 ? "bg-surface" : ""}>
                <td className="px-2 py-1 text-left text-text border-r border-border">{r.label}</td>
                <td className="px-2 py-1 text-center text-text-muted border-r border-border">{r.plan ?? "—"}</td>
                <td className="px-2 py-1 text-center text-text-muted border-r border-border">{r.act ?? "—"}</td>
                <td className="px-2 py-1 text-center text-text-muted">{r.rem ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </InfoCard>
    </div>
  );
}

/** Predecessors / Successors stacked tables with the draggable divider. */
function RelationshipsTab({ rows, onJump }) {
  const [splitPct, setSplitPct] = useState(49);
  const containerRef = useRef(null);

  const startSplitDrag = (e) => {
    e.preventDefault();
    const box = containerRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const onMove = (ev) => {
      const pct = ((ev.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
      setSplitPct(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full py-2 px-0 relative gap-1">
      <RelCard title="Predecessors" rows={rows.preds} showDriving height={`${splitPct}%`} onJump={onJump} />
      <div
        className="h-1 cursor-ns-resize hover:bg-primary bg-surface-muted border-y border-border flex items-center justify-center group relative z-10 transition-colors duration-150 my-1"
        onMouseDown={startSplitDrag}
        title="Drag to resize sections"
      >
        <div className="w-12 h-1 bg-border rounded-full group-hover:bg-primary transition-colors duration-150 shadow-sm" />
      </div>
      <RelCard title="Successors" rows={rows.succs} height={`${Math.max(20, 98 - splitPct)}%`} onJump={onJump} />
    </div>
  );
}

function CodesTab({ task }) {
  if (!task.item && !task.activityId && !task.barType && !task.statusCode) {
    return (
      <EmptyState
        title="No activity codes"
        hint="P6 活動代碼（ACTIVITYCODE / TASKACTV）未在 XER 匯入時解析，因此沒有代碼可顯示。"
      />
    );
  }
  return (
    <div className="px-2">
      <InfoCard title="Programme codes">
        <InfoRow label="Item" value={task.item} />
        <InfoRow label="Activity ID" value={task.activityId} mono />
        <InfoRow label="Bar type" value={task.barType === "delay" ? "Delay" : "Baseline"} />
        <InfoRow label="Status code" value={task.statusCode} mono />
      </InfoCard>
      <p className="text-[10px] text-text-muted leading-relaxed px-1">
        P6 活動代碼（ACTIVITYCODE / TASKACTV）與 UDF 未在 XER 匯入時解析；若需要顯示，請提供含代碼表的 XER。
      </p>
    </div>
  );
}

function NotebookTab() {
  return (
    <EmptyState
      title="No notebook entries"
      hint="P6 NOTEBOOK topics 未在 XER 匯入時解析，因此此活動沒有記事可顯示。"
    />
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
/**
 * Gantt information panel — port of xerviewer.org's activity information side
 * panel: a round-icon tab rail (General / Status / Resources / Relationships /
 * Codes / Notebook), a titled header with a close button, and a scrollable body.
 *
 * It overlays the Gantt (absolute, right aligned, slides in) and follows the
 * current selection, so clicking another activity updates it in place.
 */
export default function GanttInfoPanel({
  open = false,
  task = null,
  tasks = [],
  onClose,
  onJumpToTask,
  headerHeight = 53,
  dateFormat = "yyyy-MM-dd",
  durMode = "cal",
  initialTab = "general",
}) {
  const [tab, setTab] = useState(initialTab);
  const [panelWidth, setPanelWidth] = useState(568);

  // Esc closes the panel (same convention as the other dialogs in the app)
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const byId = useMemo(() => {
    const m = new Map();
    tasks.forEach(t => m.set(Number(t.id), t));
    return m;
  }, [tasks]);

  const relDetails = useMemo(() => buildRelationshipDetails(tasks), [tasks]);

  const relRows = useMemo(() => {
    const nothing = { preds: [], succs: [] };
    if (!task) return nothing;
    const entry = relDetails.get(Number(task.id));
    if (!entry) return nothing;
    const build = (list) => list.map(e => {
      const other = byId.get(Number(e.id)) || null;
      return {
        id: Number(e.id),
        code: other?.activityId || String(e.id),
        name: other?.activity || "",
        type: normRelType(e.type),
        lag: Number(e.lag) || 0,
        task: other,
      };
    });
    const preds = build(entry.predecessors);
    const driving = computeDrivingPredecessors(task, preds);
    preds.forEach(p => { p.driving = driving.has(p.id); });
    return { preds, succs: build(entry.successors) };
  }, [task, relDetails, byId]);

  const fmtDate = (value) => {
    if (!value) return "";
    const s = String(value).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? (formatDisplayDate(s, dateFormat) || s) : String(value).trim();
  };

  const durationText = (() => {
    if (!task || !task.start) return "";
    if (durMode === "wd") {
      const n = countWorkingDays(task.start, task.end || task.start);
      return n > 0 ? `${n} WD` : "";
    }
    const s = parseISO(task.start), e = parseISO(task.end || task.start);
    if (!isValid(s) || !isValid(e)) return "";
    const n = differenceInDays(e, s) + 1;
    return n >= 1 ? `${n} Cal` : "";
  })();

  // Drag the left edge to resize the panel
  const startWidthDrag = (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = panelWidth;
    const onMove = (ev) => setPanelWidth(Math.min(900, Math.max(360, w0 + (x0 - ev.clientX))));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const active = TABS.find(t => t.key === tab) || TABS[0];

  let body;
  if (!task) body = <EmptyState title="No activity selected" hint="在 Gantt 表格或圖表中點選一個活動，即可在此查看內容。" />;
  else if (tab === "general") body = <GeneralTab task={task} d={fmtDate} durationText={durationText} />;
  else if (tab === "status") body = <StatusTab task={task} d={fmtDate} rawDate={fmtDate} />;
  else if (tab === "resources") body = <ResourcesTab task={task} />;
  else if (tab === "relationships") body = <RelationshipsTab rows={relRows} onJump={onJumpToTask} />;
  else if (tab === "codes") body = <CodesTab task={task} />;
  else body = <NotebookTab />;

  return (
    <div
      className={`absolute right-0 bg-surface-subtle shadow-2xl z-30 transition-transform duration-300 ease-in-out flex flex-row overflow-hidden ${open ? "translate-x-0" : "translate-x-full"}`}
      role="dialog"
      aria-hidden={!open}
      aria-modal="true"
      aria-labelledby="gantt-information-panel-title"
      style={{
        top: headerHeight,
        height: `calc(100% - ${headerHeight}px)`,
        width: panelWidth,
        maxWidth: "calc(-1rem + 100vw)",
      }}
    >
      {/* Round-icon tab rail */}
      <div className="w-16 bg-surface-muted p-2 border-r border-border flex flex-col items-center space-y-1 shrink-0">
        {TABS.map(t => {
          const isActive = t.key === tab;
          return (
            <div key={t.key} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setTab(t.key)}
                aria-label={t.label}
                title={t.label}
                aria-pressed={isActive}
                className={`p-2 rounded-full transition-all duration-150 border-2 focus:outline-none ${
                  isActive ? "bg-surface-subtle border-primary" : "bg-surface-muted hover:bg-surface-muted border-border"
                }`}
              >
                <TabIcon tab={t} className="w-6 h-6 text-text-muted" />
              </button>
              <span className="text-[8px] text-text-muted text-center mt-0.5 leading-tight max-w-full break-words px-0.5">
                {t.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Header + body */}
      <div className="flex-grow flex flex-col overflow-hidden min-w-0">
        <header className="flex justify-between items-center p-4 border-b border-border shrink-0 bg-surface-muted">
          <h2 id="gantt-information-panel-title" className="text-base font-semibold text-text truncate">
            {active.label}
            {task && <span className="ml-2 text-xs font-normal text-text-muted">{task.activityId}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close information panel"
            className="p-1.5 rounded-full text-text-muted hover:text-text-muted hover:bg-surface-muted focus:outline-none shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-grow overflow-y-auto custom-scrollbar py-3 px-0.5 bg-surface-subtle">{body}</div>
      </div>

      {/* Left-edge width handle */}
      <div className="absolute top-0 left-0 w-2 h-full cursor-ew-resize" onMouseDown={startWidthDrag} title="Drag to resize panel" />
    </div>
  );
}





