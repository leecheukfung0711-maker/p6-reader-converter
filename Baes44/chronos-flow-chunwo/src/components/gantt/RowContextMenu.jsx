/**
 * RowContextMenu — Right-click context menu for Gantt rows
 *
 * Batch 23A: section (programme) rows also get a WBS level editor — 7 direct
 * buttons plus Indent/Outdent — because non-XER imports (Excel / PDF / scanned
 * OCR) used to create every section at Level 1.
 *
 * Batch 27: the menu also edits the programme's **Last Recalc Date** (its data
 * date) — a date input plus shortcuts. Right-clicking a date **cell** in the
 * Activity List opens the same menu with an extra "use this cell" shortcut, so
 * the data date can be set straight from the date column.
 */
import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { clampWbsLevel, WBS_LEVEL_COUNT } from "@/lib/wbsLevel";

/** Column keys whose cells hold a date — right-clicking one offers "use this cell". */
const DATE_CELL_LABELS = {
  start: "Start", end: "End",
  blStart: "BL Start", blEnd: "BL Finish",
  earlyStart: "Early Start", earlyEnd: "Early Finish",
  lateStart: "Late Start", lateEnd: "Late Finish",
  expectedFinish: "Expected Finish",
  constraintDate: "Constraint", constraintDate2: "Constraint 2",
  suspendDate: "Suspend", resumeDate: "Resume", reviewFinish: "Review Finish",
  externalEarlyStart: "External Early Start", externalLateFinish: "External Late Finish",
  remEarlyStart: "Rem Early Start", remEarlyFinish: "Rem Early Finish",
  remLateStart: "Rem Late Start", remLateFinish: "Rem Late Finish",
  actStart: "Actual Start", actEnd: "Actual Finish",
};

/** Column key → task field, when the column shows another field (BL columns). */
const DATE_CELL_VALUE_KEY = { blStart: "baselineStart", blEnd: "baselineFinish" };

/** "2024-09-30 08:00" → "2024-09-30" (only the day matters). */
const dayOf = (value) => String(value ?? "").trim().slice(0, 10);

export default function RowContextMenu({
  x, y, task, taskIdx, onClose, onAction, onColorChange, onSectionColorChange,
  recalcDate = "", fileRecalcDate = "", onRecalcDateChange, dateCell = null,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  // Adjust position so menu doesn't go off screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, Math.max(8, window.innerHeight - 360));

  const isSec = task?.isSection;
  const isBlue = (task?.sectionType || "blue") === "blue";
  const isDelay = task?.barType === "delay";
  const barColor = task?.barColor || null;
  const sectionLevel = clampWbsLevel(task?.sectionLevel);
  const recalc = dayOf(recalcDate);
  const fileRecalc = dayOf(fileRecalcDate);
  // A date cell was right-clicked → offer its own value (that is the shortcut the
  // user asked for: set the data date straight from the date column).
  const cellDate = dateCell ? dayOf(task?.[DATE_CELL_VALUE_KEY[dateCell] || dateCell]) : "";
  const cellLabel = dateCell ? (DATE_CELL_LABELS[dateCell] || dateCell) : "";
  const rowStart = dayOf(task?.start);
  const rowEnd = dayOf(task?.end);
  const today = format(new Date(), "yyyy-MM-dd");

  const menuStyle = {
    position: "fixed",
    left: adjustedX,
    top: adjustedY,
    background: "#fff",
    border: "1px solid #cecece",
    borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    zIndex: 9999,
    minWidth: 232,
    fontSize: 13,
    overflowY: "auto",
    maxHeight: "calc(100vh - 16px)",
  };

  const Item = ({ label, icon, onClick, color, divider, disabled }) => (
    <>
      {divider && <div style={{ height: 1, background: "#f7f7f7", margin: "3px 0" }} />}
      <div
        onClick={disabled ? undefined : () => { onClick(); onClose(); }}
        style={{
          padding: "7px 14px",
          cursor: disabled ? "default" : "pointer",
          display: "flex", alignItems: "center", gap: 8,
          color: disabled ? "#cecece" : (color || "#003531"),
          opacity: disabled ? 0.5 : 1,
          transition: "background 0.1s",
        }}
        className={disabled ? "" : "hover:bg-surface-subtle"}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span>{label}</span>
      </div>
    </>
  );

  const Section = ({ label, divider }) => (
    <div style={{
      padding: divider ? "6px 14px 2px" : "4px 14px 2px",
      marginTop: divider ? 3 : 0,
      borderTop: divider ? "1px solid #f7f7f7" : undefined,
      fontSize: 10, fontWeight: 700, color: "#6c757d", textTransform: "uppercase", letterSpacing: "0.06em",
    }}>{label}</div>
  );

  return (
    <div ref={ref} style={menuStyle}>
      {/* Row info header */}
      <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid #f7f7f7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d" }}>
          {isSec ? `Programme Section · Level ${sectionLevel}` : `Row ${taskIdx + 1}`}
        </div>
        <div style={{ fontSize: 12, color: "#003531", fontWeight: 500, marginTop: 1, wordBreak: "break-word" }}>
          {task?.activity || "(Unnamed)"}
        </div>
      </div>

      {/* ── Batch 27: Last Recalc Date — the programme's own "now" ── */}
      <Section label="Last Recalc Date" />
      <div style={{ padding: "0 14px 4px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: recalc ? "#e88219" : "#6c757d" }} data-testid="row-menu-recalc-value">
          {recalc || "Not set"}
          {fileRecalc && recalc === fileRecalc ? " · from file" : ""}
        </div>
        <input
          type="date"
          value={recalc}
          aria-label="Last Recalc Date"
          id="row-menu-recalc-date"
          disabled={!onRecalcDateChange}
          onChange={(e) => onRecalcDateChange && onRecalcDateChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            marginTop: 4, width: "100%", fontSize: 12, padding: "3px 4px",
            border: "1px solid #cecece", borderRadius: 4, color: "#003531", background: "#fff",
          }}
        />
        <div style={{ fontSize: 10, color: "#6c757d", marginTop: 3, lineHeight: 1.3 }}>
          {recalc ? "Statuses are read as at this day" : "No data date — statuses come straight from the file"}
        </div>
      </div>
      {cellDate && (
        <Item icon="📌" label={`Use this cell — ${cellLabel} (${cellDate})`}
          disabled={!onRecalcDateChange}
          onClick={() => onRecalcDateChange && onRecalcDateChange(cellDate)} />
      )}
      {rowStart && rowStart !== cellDate && (
        <Item icon="⏮" label={`Use Start (${rowStart})`}
          disabled={!onRecalcDateChange}
          onClick={() => onRecalcDateChange && onRecalcDateChange(rowStart)} />
      )}
      {rowEnd && rowEnd !== cellDate && (
        <Item icon="⏭" label={`Use Finish (${rowEnd})`}
          disabled={!onRecalcDateChange}
          onClick={() => onRecalcDateChange && onRecalcDateChange(rowEnd)} />
      )}
      <Item icon="📅" label={`Use Today (${today})`}
        disabled={!onRecalcDateChange}
        onClick={() => onRecalcDateChange && onRecalcDateChange(today)} />
      {fileRecalc && fileRecalc !== recalc && (
        <Item icon="📄" label={`Use file date (${fileRecalc})`}
          disabled={!onRecalcDateChange}
          onClick={() => onRecalcDateChange && onRecalcDateChange(fileRecalc)} />
      )}
      {recalc && (
        <Item icon="✖" label="Clear Last Recalc Date"
          disabled={!onRecalcDateChange}
          onClick={() => onRecalcDateChange && onRecalcDateChange("")} />
      )}

      {/* Add */}
      <Section label="Add" divider />
      <Item icon="➕" label="Add Task Below" onClick={() => onAction("addTaskBelow")} />
      <Item icon="🟦" label="Add Blue Programme Below" onClick={() => onAction("addBlueProgBelow")} />
      <Item icon="🩷" label="Add Pink Programme Below" onClick={() => onAction("addPinkProgBelow")} />

      {/* Task-specific */}
      {!isSec && (
        <>
          <Section label="Task" />
          <Item icon={isDelay ? "🔵" : "🟢"} label={isDelay ? "Change to Baseline (BL)" : "Change to Delay (DE)"} onClick={() => onAction("toggleBarType")} />
          <Item icon="🎨" label="Change Bar Color" onClick={() => onColorChange && onColorChange(task, x, y)} />
          <Item icon="🔗" label="Fill Start from Previous End" onClick={() => onAction("fillPrev")} disabled={taskIdx === 0} />
          <Item icon="✅" label="Toggle Start Actual" onClick={() => onAction("toggleStartActual")} />
          <Item icon="✅" label="Toggle End Actual" onClick={() => onAction("toggleEndActual")} />
        </>
      )}

      {/* Section-specific */}
      {isSec && (
        <>
          <Section label="Programme" />
          <Item icon={isBlue ? "🩷" : "🟦"} label={isBlue ? "Change to Pink Programme" : "Change to Blue Programme"} onClick={() => onAction("toggleSectionType")} />
          <Item icon="🎨" label="Change Programme Colour" onClick={() => onSectionColorChange && onSectionColorChange(task, x, y)} />
          <Item icon="◈" label="Toggle Comparison Marker" onClick={() => onAction("toggleComparison")} />

          {/* ── Batch 23A: WBS level editor ── */}
          <Section label={`WBS Level — now ${sectionLevel}`} />
          <div style={{ display: "flex", gap: 4, padding: "2px 14px 6px", flexWrap: "wrap" }}>
            {Array.from({ length: WBS_LEVEL_COUNT }, (_, i) => i + 1).map((n) => {
              const current = n === sectionLevel;
              return (
                <button
                  key={n}
                  type="button"
                  title={current ? `Already Level ${n}` : `Set WBS Level ${n}`}
                  aria-pressed={current}
                  onClick={() => { onAction("setSectionLevel", n); onClose(); }}
                  className={current ? "" : "hover:bg-surface-subtle"}
                  style={{
                    width: 26, height: 22, borderRadius: 5, border: "1px solid #cecece",
                    fontSize: 11, fontWeight: 700, cursor: current ? "default" : "pointer",
                    background: current ? "#005a53" : "#fff", color: current ? "#fff" : "#333333",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <Item icon="↳" label="Indent (Level +1)" onClick={() => onAction("indentSection")} disabled={sectionLevel >= WBS_LEVEL_COUNT} />
          <Item icon="↰" label="Outdent (Level −1)" onClick={() => onAction("outdentSection")} disabled={sectionLevel <= 1} />
        </>
      )}

      {/* Delete */}
      <Item icon="🗑️" label="Delete Row" onClick={() => onAction("delete")} color="#dc3545" divider />
    </div>
  );
}