import { useCallback, useRef, useState } from "react";
import { Plus, Trash2, Link2, GripVertical } from "lucide-react";
import { differenceInDays, parseISO, isValid, addDays, format } from "date-fns";
import { computeItemLabels } from "@/lib/computeItemLabels";
import { countWorkingDays, addWorkingDays } from "@/lib/hkWorkingDays";

function calcDuration(start, end) {
  try {
    const s = parseISO(start);
    const e = parseISO(end || start);
    if (!isValid(s) || !isValid(e)) return "";
    const d = differenceInDays(e, s) + 1;
    return d >= 1 ? String(d) : "";
  } catch { return ""; }
}

function calcWorkingDays(start, end) {
  if (!start) return "";
  const effectiveEnd = end || start;
  const n = countWorkingDays(start, effectiveEnd);
  return n > 0 ? String(n) : "";
}

function ResizeHandle({ onMouseDown }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: 5, cursor: "col-resize", zIndex: 1,
        background: "transparent",
      }}
      onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
      onMouseOut={e => e.currentTarget.style.background = "transparent"}
    />
  );
}

const INIT_WIDTHS = { checkbox: 28, rownum: 32, item: 48, activityId: 100, activity: 160, start: 110, end: 110, duration: 64, type: 60 };

// Bar type options
const BAR_TYPES = [
  { value: "baseline", label: "Baseline", color: "#005a53" },
  { value: "delay",    label: "Delay",    color: "#005a53" },
];

export default function TaskTable({ tasks, setTasks, selectedIds, setSelectedIds, onPaste, durMode = "wd", setDurMode, tableScrollRef, onScroll }) {
  const nextId = useRef(tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1);
  const [colWidths, setColWidths] = useState(INIT_WIDTHS);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrcIdx = useRef(null);

  const startResize = useCallback((colKey, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[colKey];
    const minW = colKey === "activity" ? 60 : 28;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      setColWidths(prev => ({ ...prev, [colKey]: Math.max(minW, startW + delta) }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths]);

  const updateTask = useCallback((id, field, value) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }, [setTasks]);

  const removeTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [setTasks]);

  const addTask = () => {
    setTasks(prev => [...prev, { id: nextId.current++, activity: "", start: "", end: "", barType: "baseline" }]);
  };

  const addSection = (sectionType = "blue") => {
    setTasks(prev => [...prev, { id: nextId.current++, isSection: true, sectionType, activity: "New Programme" }]);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = (idx) => { dragSrcIdx.current = idx; };
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx) => {
    const src = dragSrcIdx.current;
    if (src === null || src === idx) { setDragOverIdx(null); return; }
    setTasks(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(src, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { dragSrcIdx.current = null; setDragOverIdx(null); };

  const fillFromPrevEnd = useCallback((taskId) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx <= 0) return prev;
      const prevEnd = prev[idx - 1].end;
      if (!prevEnd) return prev;
      return prev.map((t, i) => i === idx ? { ...t, start: prevEnd } : t);
    });
  }, [setTasks]);

  const ROW_H = 26;
  const w = colWidths;

  const Th = ({ colKey, label, align = "center", children }) => (
    <th style={{
      border: "1px solid #003531", fontSize: 11, fontWeight: 600,
      width: w[colKey], minWidth: w[colKey], maxWidth: w[colKey],
      textAlign: align, paddingLeft: align === "left" ? 4 : 0,
      position: "relative", userSelect: "none", overflow: "hidden",
    }}>
      {children || label}
      <ResizeHandle onMouseDown={(e) => startResize(colKey, e)} />
    </th>
  );

  // Shared colgroup definition
  const colGroup = (
    <colgroup>
      <col style={{ width: 18 }} />
      <col style={{ width: w.type }} />
      <col style={{ width: w.rownum }} />
      <col style={{ width: w.item }} />
      <col style={{ width: w.activityId }} />
      <col style={{ width: w.activity }} />
      <col style={{ width: w.start }} />
      <col style={{ width: w.end }} />
      <col style={{ width: w.duration }} />
    </colgroup>
  );

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border" onPaste={onPaste}>
      {/* Frozen header — never scrolls */}
      <div className="flex-shrink-0" style={{ background: "#003531" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
          {colGroup}
          <thead>
            {/* Row 1: blank spacer to match Gantt year row */}
            <tr style={{ height: ROW_H, background: "#003531", color: "#fff" }}>
              <th colSpan={9}></th>
            </tr>
            {/* Row 2: column labels */}
            <tr style={{ height: ROW_H, background: "#003531", color: "#fff" }}>
              <th style={{ width: 18, minWidth: 18, border: "1px solid #003531" }} />
              <Th colKey="type" label="Type" />
              <Th colKey="rownum" label="#" />
              <Th colKey="item" label="Item" />
              <Th colKey="activityId" label="ID" />
              <Th colKey="activity" label="Activity" align="left" />
              <Th colKey="start" label="Start" />
              <Th colKey="end" label="End" />
              <th
                onDoubleClick={() => setDurMode && setDurMode(m => m === "wd" ? "cal" : "wd")}
                title="雙擊切換 WD / Cal 顯示"
                style={{
                  border: "1px solid #003531", fontSize: 11, fontWeight: 600,
                  width: w.duration, minWidth: w.duration, maxWidth: w.duration,
                  textAlign: "center", position: "relative", userSelect: "none",
                  overflow: "hidden", cursor: "pointer",
                }}
              >
                {durMode === "wd" ? "Dur.(WD)" : "Dur.(Cal)"}
                <ResizeHandle onMouseDown={(e) => startResize("duration", e)} />
              </th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto" ref={tableScrollRef} onScroll={onScroll}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", tableLayout: "fixed" }}>
          {colGroup}
          <tbody>
            {computeItemLabels(tasks).map((task, idx) => {
              // ── Section header row ──
              if (task.isSection) {
                const isBlue = (task.sectionType || "blue") === "blue";
                const sectionBg = isBlue ? "#005a53" : "#733208";
                const sectionColor = isBlue ? "#ffffff" : "#ffffff";
                const focusCls = isBlue ? "focus:bg-primary-active" : "focus:bg-table-header";
                return (
                  <tr
                   key={task.id}
                   draggable
                   onDragStart={() => handleDragStart(idx)}
                   onDragOver={e => handleDragOver(e, idx)}
                   onDrop={() => handleDrop(idx)}
                   onDragEnd={handleDragEnd}
                   style={{ height: ROW_H, maxHeight: ROW_H, background: dragOverIdx === idx ? "#fff2ea" : sectionBg, outline: dragOverIdx === idx ? "2px solid #005a53" : "none", overflow: "hidden" }}
                   className="group gantt-row"
                  >
                   <td style={{ border: "1px solid #cecece", textAlign: "center", padding: 0, cursor: "grab", color: "#6c757d" }}>
                     <GripVertical size={11} style={{ margin: "auto" }} />
                   </td>
                   <td colSpan={6} style={{ border: "1px solid #cecece", padding: 0 }}>
                     <input
                       type="text"
                       value={task.activity}
                       onChange={e => updateTask(task.id, "activity", e.target.value)}
                       className={`w-full text-xs font-bold outline-none bg-transparent px-2 ${focusCls}`}
                       style={{ height: ROW_H, border: "none", color: sectionColor }}
                       placeholder="Programme title..."
                     />
                   </td>
                   {/* Comparison toggle */}
                   <td style={{ border: "1px solid #cecece", padding: 0, textAlign: "center" }}>
                     <button
                       onClick={() => updateTask(task.id, "showComparison", task.showComparison === false ? true : false)}
                       title={task.showComparison === false ? "顯示比較標注（紫色虛線）" : "隱藏比較標注（紫色虛線）"}
                        style={{
                         width: "100%", height: ROW_H, fontSize: 9, fontWeight: 700,
                         color: task.showComparison === false ? (isBlue ? "rgba(255,255,255,0.4)" : "rgba(157,23,77,0.3)") : "#ffffff",
                         background: "transparent", border: "none", cursor: "pointer",
                       }}
                     >
                       ◈
                     </button>
                   </td>
                   <td style={{ border: "1px solid #cecece", padding: 0, textAlign: "center" }}>
                     <button onClick={() => removeTask(task.id)}
                       className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger px-1" tabIndex={-1}>
                       <Trash2 size={10} />
                     </button>
                   </td>

                   </tr>
                );
              }

              // ── Normal task row ──
              const isSelected = selectedIds.has(task.id);
              const isAlt = idx % 2 !== 0;
              const rowBg = isSelected ? "#fff2ea" : isAlt ? "#f7f7f7" : "#ffffff";
              const barType = task.barType || "baseline";
              const typeColor = barType === "delay" ? "#e88219" : "#005a53";

              return (
                <tr
                   key={task.id}
                   draggable
                   onDragStart={() => handleDragStart(idx)}
                   onDragOver={e => handleDragOver(e, idx)}
                   onDrop={() => handleDrop(idx)}
                   onDragEnd={handleDragEnd}
                   style={{ height: ROW_H, maxHeight: ROW_H, background: dragOverIdx === idx ? "#fff2ea" : rowBg, outline: dragOverIdx === idx ? "2px solid #005a53" : "none", overflow: "hidden" }}
                   className="group hover:brightness-95 gantt-row"
                 >
                   {/* Drag handle */}
                   <td style={{ border: "1px solid #cecece", textAlign: "center", padding: 0, cursor: "grab", color: "#6c757d" }}>
                     <GripVertical size={11} style={{ margin: "auto" }} />
                   </td>

                   {/* Bar Type toggle */}
                   <td style={{ border: "1px solid #cecece", padding: 0, textAlign: "center" }}>
                     <button
                       onClick={() => updateTask(task.id, "barType", barType === "baseline" ? "delay" : "baseline")}
                       title={barType === "baseline" ? "Baseline (click to switch to Delay)" : "Delay Event (click to switch to Baseline)"}
                       style={{
                         width: "100%", height: ROW_H, fontSize: 9, fontWeight: 700,
                         color: "#fff", background: typeColor, border: "none", cursor: "pointer",
                         transition: "background 0.2s",
                       }}
                     >
                       {barType === "baseline" ? "BL" : "DE"}
                     </button>
                   </td>

                   {/* Row number / ID */}
                  <td style={{ border: "1px solid #cecece", padding: 0 }}>
                    <input
                      type="text"
                      value={task.id_label ?? String(idx + 1)}
                      onChange={e => updateTask(task.id, "id_label", e.target.value)}
                      className="w-full text-xs outline-none bg-transparent text-center px-1 focus:bg-surface-subtle"
                      style={{ height: ROW_H, border: "none", color: "#6c757d" }}
                    />
                  </td>

                  {/* Item */}
                  <td style={{ border: "1px solid #cecece", padding: 0 }}>
                    <input
                      type="text"
                      value={task.customItem !== undefined && task.customItem !== null ? task.customItem : task._resolvedItem || ""}
                      placeholder={task._resolvedItem || ""}
                      onChange={e => {
                        const val = e.target.value;
                        // If user clears the field, remove customItem to revert to auto
                        updateTask(task.id, "customItem", val === "" ? null : val);
                      }}
                      className="w-full text-xs outline-none bg-transparent text-center px-1 focus:bg-surface-subtle"
                      style={{ height: ROW_H, border: "none", color: task.customItem ? "#733208" : undefined }}
                    />
                  </td>

                  {/* Activity ID */}
                  <td style={{ border: "1px solid #cecece", padding: 0 }}>
                    <input
                      type="text"
                      value={task.activityId || ""}
                      placeholder="e.g. S9-CW0610"
                      onChange={e => updateTask(task.id, "activityId", e.target.value)}
                      className="w-full text-xs outline-none bg-transparent text-center px-1 focus:bg-surface-subtle"
                      style={{ height: ROW_H, border: "none", color: "#005a53", fontFamily: "monospace" }}
                    />
                  </td>

                  {/* Activity */}
                  <td style={{ border: "1px solid #cecece", padding: 0 }}>
                    <input
                      type="text" value={task.activity} placeholder="Activity Name"
                      onChange={e => updateTask(task.id, "activity", e.target.value)}
                      className="w-full text-xs outline-none bg-transparent px-1 focus:bg-surface-subtle"
                      style={{ height: ROW_H, border: "none" }}
                    />
                  </td>

                  {/* Start */}
                  <td style={{ border: "1px solid #cecece", padding: 0, overflow: "hidden", maxHeight: ROW_H }}>
                    <div className="flex items-center" style={{ height: ROW_H, overflow: "hidden" }}>
                      <input
                        type="date" value={task.start}
                        onChange={e => !task.startActual && updateTask(task.id, "start", e.target.value)}
                        onKeyDown={e => { if (!task.startActual && (e.key === "=" || e.key === "`")) { e.preventDefault(); fillFromPrevEnd(task.id); } }}
                        title={task.startActual ? "Locked (Actual Date)" : "Press = to copy previous row's End date"}
                        readOnly={task.startActual}
                        className="flex-1 text-xs outline-none bg-transparent px-1 focus:bg-surface-subtle"
                        style={{ height: ROW_H, maxHeight: ROW_H, lineHeight: ROW_H + "px", border: "none", minWidth: 0, color: task.startActual ? "#dc3545" : undefined, fontWeight: task.startActual ? 700 : undefined, cursor: task.startActual ? "not-allowed" : undefined }}
                      />
                      <button
                        onClick={() => updateTask(task.id, "startActual", !task.startActual)}
                        title={task.startActual ? "Unmark Actual Date" : "Mark as Actual Date (red)"}
                        className="flex-shrink-0 px-0.5"
                        tabIndex={-1}
                        style={{ color: task.startActual ? "#dc3545" : "#cecece", fontSize: 9, fontWeight: 900, lineHeight: 1 }}
                      >A</button>
                      {idx > 0 && tasks[idx - 1].end && (
                        <button onClick={() => fillFromPrevEnd(task.id)} title={`Fill from previous End: ${tasks[idx - 1].end}`}
                          className="opacity-0 group-hover:opacity-100 text-primary hover:text-primary pr-1 flex-shrink-0" tabIndex={-1}>
                          <Link2 size={10} />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* End */}
                  <td style={{ border: "1px solid #cecece", padding: 0, overflow: "hidden", maxHeight: ROW_H }}>
                    <div className="flex items-center" style={{ height: ROW_H, overflow: "hidden" }}>
                      <input
                        type="date" value={task.end}
                        onChange={e => !task.endActual && updateTask(task.id, "end", e.target.value)}
                        readOnly={task.endActual}
                        title={task.endActual ? "Locked (Actual Date)" : undefined}
                        className="flex-1 text-xs outline-none bg-transparent px-1 focus:bg-surface-subtle"
                        style={{ height: ROW_H, maxHeight: ROW_H, lineHeight: ROW_H + "px", border: "none", minWidth: 0, color: task.endActual ? "#dc3545" : undefined, fontWeight: task.endActual ? 700 : undefined, cursor: task.endActual ? "not-allowed" : undefined }}
                      />
                      <button
                        onClick={() => updateTask(task.id, "endActual", !task.endActual)}
                        title={task.endActual ? "Unmark Actual Date" : "Mark as Actual Date (red)"}
                        className="flex-shrink-0 px-0.5"
                        tabIndex={-1}
                        style={{ color: task.endActual ? "#dc3545" : "#cecece", fontSize: 9, fontWeight: 900, lineHeight: 1 }}
                      >A</button>
                    </div>
                  </td>

                  {/* Duration + delete */}
                  <td style={{ border: "1px solid #cecece", padding: 0, overflow: "hidden", maxHeight: ROW_H }}>
                    <div className="flex items-center justify-between px-1" style={{ height: ROW_H, overflow: "hidden" }}>
                      <div className="flex items-center gap-0.5 flex-1 justify-center">
                        {durMode === "wd" ? (
                          <>
                            <input
                              type="number"
                              min="1"
                              value={calcWorkingDays(task.start, task.end) || ""}
                              onChange={e => {
                                const wd = parseInt(e.target.value, 10);
                                if (wd > 0) {
                                  if (task.endActual && !task.startActual && task.end) {
                                    // End is locked → compute new start by going backwards from end
                                    // addWorkingDays(newStart, wd) should equal task.end
                                    // So newStart = addWorkingDays(task.end, -(wd-1)) going backwards
                                    let d = parseISO(task.end);
                                    let remaining = wd - 1;
                                    while (remaining > 0) {
                                      d = addDays(d, -1);
                                      const dayStr = format(d, "yyyy-MM-dd");
                                      if (countWorkingDays(dayStr, dayStr) > 0) remaining--;
                                    }
                                    updateTask(task.id, "start", format(d, "yyyy-MM-dd"));
                                  } else if (!task.endActual && task.start) {
                                    const newEnd = addWorkingDays(task.start, wd);
                                    updateTask(task.id, "end", newEnd);
                                  }
                                }
                              }}
                              disabled={!task.start && !task.end || (task.startActual && task.endActual)}
                              title={task.startActual && task.endActual ? "Both dates locked (Actual)" : task.endActual ? "End locked — will adjust Start date" : "Edit to recalculate End date"}
                              className="font-bold font-mono text-center outline-none bg-transparent focus:bg-surface-subtle rounded"
                              style={{ fontSize: 9, color: barType === "delay" ? "#005a53" : "#005a53", width: 28, height: 14, border: "none", padding: 0 }}
                            />
                            <span className="font-bold font-mono" style={{ fontSize: 9, color: barType === "delay" ? "#005a53" : "#005a53" }}>WD</span>
                          </>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="1"
                              value={calcDuration(task.start, task.end) || ""}
                              onChange={e => {
                                const cal = parseInt(e.target.value, 10);
                                if (cal > 0) {
                                  if (task.endActual && !task.startActual && task.end) {
                                    // End is locked → adjust start instead
                                    const newStart = format(addDays(parseISO(task.end), -(cal - 1)), "yyyy-MM-dd");
                                    updateTask(task.id, "start", newStart);
                                  } else if (!task.endActual && task.start) {
                                    const newEnd = format(addDays(parseISO(task.start), cal - 1), "yyyy-MM-dd");
                                    updateTask(task.id, "end", newEnd);
                                  }
                                }
                              }}
                              disabled={!task.start && !task.end || (task.startActual && task.endActual)}
                              title={task.startActual && task.endActual ? "Both dates locked (Actual)" : task.endActual ? "End locked — will adjust Start date" : "Edit to recalculate End date"}
                              className="font-bold font-mono text-center outline-none bg-transparent focus:bg-surface-subtle rounded"
                              style={{ fontSize: 9, color: barType === "delay" ? "#005a53" : "#005a53", width: 28, height: 14, border: "none", padding: 0 }}
                            />
                            <span className="font-bold font-mono" style={{ fontSize: 9, color: barType === "delay" ? "#005a53" : "#005a53" }}>Cal</span>
                          </>
                        )}
                      </div>
                      <button onClick={() => removeTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger flex-shrink-0" tabIndex={-1}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                  </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ borderTop: "1px solid #cecece", padding: "6px 8px", display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={addTask}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-primary border border-dashed border-primary rounded hover:bg-surface-subtle py-1">
          <Plus size={12} /> Add Task
        </button>
        <button onClick={() => addSection("blue")}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-primary border border-dashed border-primary rounded hover:bg-surface-subtle py-1">
          <Plus size={12} /> Add Programme (Blue)
        </button>
        <button onClick={() => addSection("pink")}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-accent-selected border border-dashed border-primary rounded hover:bg-table-header py-1">
          <Plus size={12} /> Add Programme (Pink)
        </button>
      </div>
    </div>
  );
}