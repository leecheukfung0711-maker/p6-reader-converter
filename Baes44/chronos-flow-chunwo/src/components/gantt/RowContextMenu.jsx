/**
 * RowContextMenu — Right-click context menu for Gantt rows
 */
import { useEffect, useRef } from "react";

export default function RowContextMenu({ x, y, task, taskIdx, onClose, onAction, onColorChange, onSectionColorChange }) {
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
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const isSec = task?.isSection;
  const isBlue = (task?.sectionType || "blue") === "blue";
  const isDelay = task?.barType === "delay";
  const barColor = task?.barColor || null;

  const menuStyle = {
    position: "fixed",
    left: adjustedX,
    top: adjustedY,
    background: "#fff",
    border: "1px solid #cecece",
    borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    zIndex: 9999,
    minWidth: 200,
    fontSize: 13,
    overflow: "hidden",
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

  const Section = ({ label }) => (
    <div style={{ padding: "4px 14px 2px", fontSize: 10, fontWeight: 700, color: "#6c757d", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
  );

  return (
    <div ref={ref} style={menuStyle}>
      {/* Row info header */}
      <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid #f7f7f7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d" }}>
          {isSec ? "Programme Section" : `Row ${taskIdx + 1}`}
        </div>
        <div style={{ fontSize: 12, color: "#003531", fontWeight: 500, marginTop: 1, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task?.activity || "(Unnamed)"}
        </div>
      </div>

      {/* Add */}
      <Section label="Add" />
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
        </>
      )}

      {/* Delete */}
      <Item icon="🗑️" label="Delete Row" onClick={() => onAction("delete")} color="#dc3545" divider />
    </div>
  );
}