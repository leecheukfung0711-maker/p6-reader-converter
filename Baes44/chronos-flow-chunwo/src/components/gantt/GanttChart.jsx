import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { parseISO, isValid, differenceInDays, addDays, addMonths, startOfMonth, startOfWeek, format, eachMonthOfInterval, eachWeekOfInterval } from "date-fns";
import { countWorkingDays } from "@/lib/hkWorkingDays";

const ROW_HEIGHT = 26;
const COL_WIDTH = { month: 60, week: 40, day: 24 };

function getTimelineColumns(minDate, maxDate, viewMode) {
  const cols = [];
  if (viewMode === "month") {
    const months = eachMonthOfInterval({ start: startOfMonth(minDate), end: maxDate });
    months.forEach(m => cols.push({ label: format(m, "MMM yy"), date: m }));
  } else if (viewMode === "week") {
    const weeks = eachWeekOfInterval({ start: startOfWeek(minDate, { weekStartsOn: 1 }), end: maxDate }, { weekStartsOn: 1 });
    weeks.forEach(w => cols.push({ label: format(w, "MM/dd"), date: w }));
  } else {
    let d = minDate;
    while (d <= maxDate) {
      cols.push({ label: format(d, "dd"), date: d, month: format(d, "MM/yy") });
      d = addDays(d, 1);
    }
  }
  return cols;
}

function getTimelineStartEnd(cols, viewMode) {
  if (!cols.length) return { start: new Date(), end: new Date() };
  const start = cols[0].date;
  let end;
  if (viewMode === "month") end = addMonths(cols[cols.length - 1].date, 1);
  else if (viewMode === "week") end = addDays(cols[cols.length - 1].date, 7);
  else end = addDays(cols[cols.length - 1].date, 1);
  return { start, end };
}

function getBarPosition(taskStart, taskEnd, timelineStart, pxPerDay) {
  const left = differenceInDays(taskStart, timelineStart) * pxPerDay;
  const width = (differenceInDays(taskEnd, taskStart) + 1) * pxPerDay;
  return { left: Math.max(0, left), width: Math.max(0, width) };
}

export default function GanttChart({ tasks, viewMode, showToday = true, labelOffsets = {}, setLabelOffsets = () => {}, onTaskUpdate = () => {}, chartScrollRef: externalScrollRef, onChartScroll }) {
  const draggingLabel = useRef(null);
  const [draggingBar, setDraggingBar] = useState(null);
  const headerRef = useRef(null);
  const internalScrollRef = useRef(null);
  const chartScrollRef = externalScrollRef || internalScrollRef;

  const resolveEnd = (t) => t.end || t.start;

  const validTasks = tasks.filter(t => {
    if (t.isSection) return false;
    const s = parseISO(t.start), e = parseISO(resolveEnd(t));
    return isValid(s) && isValid(e) && e >= s;
  });

  const { minDate, maxDate } = useMemo(() => {
    if (!validTasks.length) {
      const now = new Date();
      return { minDate: now, maxDate: addMonths(now, 6) };
    }
    const starts = validTasks.map(t => parseISO(t.start));
    const ends = validTasks.map(t => parseISO(resolveEnd(t)));
    const mn = new Date(Math.min(...starts));
    const mx = new Date(Math.max(...ends));
    return { minDate: addDays(mn, -7), maxDate: addDays(mx, 14) };
  }, [validTasks]);

  const cols = useMemo(() => getTimelineColumns(minDate, maxDate, viewMode), [minDate, maxDate, viewMode]);
  const colWidth = COL_WIDTH[viewMode];
  const totalWidth = cols.length * colWidth;
  const timelineStart = cols.length ? cols[0].date : minDate;
  const pxPerDay = useMemo(() => {
    const { start, end } = getTimelineStartEnd(cols, viewMode);
    const totalDays = differenceInDays(end, start);
    return totalDays > 0 ? totalWidth / totalDays : 1;
  }, [cols, viewMode, totalWidth]);
  const today = new Date();

  const monthGroups = useMemo(() => {
    if (viewMode !== "day") return [];
    const groups = [];
    cols.forEach((col) => {
      if (!groups.length || groups[groups.length - 1].label !== col.month) {
        groups.push({ label: col.month, count: 1 });
      } else { groups[groups.length - 1].count++; }
    });
    return groups;
  }, [cols, viewMode]);

  const yearGroups = useMemo(() => {
    if (viewMode === "day") return [];
    const groups = [];
    cols.forEach((col) => {
      const yr = format(col.date, "yyyy");
      if (!groups.length || groups[groups.length - 1].label !== yr) {
        groups.push({ label: yr, count: 1 });
      } else { groups[groups.length - 1].count++; }
    });
    return groups;
  }, [cols, viewMode]);

  const todayLeft = useMemo(() => differenceInDays(today, timelineStart) * pxPerDay, [timelineStart, pxPerDay]);

  const barPositions = tasks.map((task) => {
    if (task.isSection) return null;
    const s = parseISO(task.start), e = parseISO(resolveEnd(task));
    const valid = isValid(s) && isValid(e) && e >= s;
    return valid ? getBarPosition(s, e, timelineStart, pxPerDay) : null;
  });

  const handleBarMouseDown = useCallback((e, task, dragType) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDraggingBar({ taskId: task.id, type: dragType, startX: e.clientX, origStart: task.start, origEnd: task.end || task.start });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!draggingBar) return;
    const deltaDay = Math.round((e.clientX - draggingBar.startX) / pxPerDay);
    const task = tasks.find(t => t.id === draggingBar.taskId);
    const startLocked = task?.startActual, endLocked = task?.endActual;

    if (draggingBar.type === "move") {
      if (startLocked || endLocked) return;
      onTaskUpdate(draggingBar.taskId, {
        start: format(addDays(parseISO(draggingBar.origStart), deltaDay), "yyyy-MM-dd"),
        end: format(addDays(parseISO(draggingBar.origEnd), deltaDay), "yyyy-MM-dd"),
      });
    } else if (draggingBar.type === "left" && !startLocked) {
      const newStart = format(addDays(parseISO(draggingBar.origStart), deltaDay), "yyyy-MM-dd");
      if (parseISO(newStart) <= parseISO(draggingBar.origEnd)) onTaskUpdate(draggingBar.taskId, { start: newStart });
    } else if (draggingBar.type === "right" && !endLocked) {
      const newEnd = format(addDays(parseISO(draggingBar.origEnd), deltaDay), "yyyy-MM-dd");
      if (parseISO(newEnd) >= parseISO(draggingBar.origStart)) onTaskUpdate(draggingBar.taskId, { end: newEnd });
    }
  }, [draggingBar, tasks, pxPerDay, onTaskUpdate]);

  const handleMouseUp = useCallback(() => setDraggingBar(null), []);

  useEffect(() => {
    if (draggingBar) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    }
  }, [draggingBar, handleMouseMove, handleMouseUp]);

  const handleBodyScroll = useCallback((e) => {
    if (headerRef.current) headerRef.current.scrollLeft = e.target.scrollLeft;
    if (onChartScroll) onChartScroll(e);
  }, [onChartScroll]);

  // Build staircase + comparison SVG data
  const svgOverlay = useMemo(() => {
    const programmes = [];
    let cur = [], curType = "blue", curComp = false;
    tasks.forEach((task, idx) => {
      if (task.isSection) {
        if (cur.length > 0) { programmes.push({ bars: cur, sectionType: curType, showComparison: curComp }); cur = []; }
        curType = task.sectionType || "blue"; curComp = task.showComparison !== false;
      } else if (barPositions[idx]) {
        cur.push({ idx, pos: barPositions[idx], task });
      }
    });
    if (cur.length > 0) programmes.push({ bars: cur, sectionType: curType, showComparison: curComp });
    return { programmes };
  }, [tasks, barPositions]);

  return (
    <div className="bg-surface h-full flex flex-col overflow-hidden">
      {/* Frozen header */}
      <div className="flex-shrink-0 bg-primary-dark text-surface select-none" style={{ overflowX: "hidden" }} ref={headerRef}>
        <div style={{ minWidth: totalWidth + "px" }}>
          <div className="flex" style={{ height: ROW_HEIGHT + "px", overflow: "hidden" }}>
            {viewMode === "day"
              ? monthGroups.map((g, i) => (
                <div key={i} className="border-r border-text-muted flex items-center justify-center text-xs font-semibold bg-primary-dark overflow-hidden flex-shrink-0"
                  style={{ width: g.count * colWidth + "px" }}>{g.label}</div>
              ))
              : yearGroups.map((g, i) => (
                <div key={i} className="border-r border-text-muted flex items-center justify-center text-xs font-semibold bg-primary-dark overflow-hidden flex-shrink-0"
                  style={{ width: g.count * colWidth + "px" }}>{g.label}</div>
              ))
            }
          </div>
          <div className="flex" style={{ height: ROW_HEIGHT + "px", overflow: "hidden" }}>
            {cols.map((col, i) => (
              <div key={i} className="border-r border-text-muted flex items-center justify-center text-xs overflow-hidden flex-shrink-0"
                style={{ width: colWidth + "px" }}>{col.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto" ref={chartScrollRef} onScroll={handleBodyScroll}>
        <div style={{ minWidth: totalWidth + "px", position: "relative" }}>
          {/* Grid lines */}
          <div className="absolute inset-0 flex pointer-events-none" style={{ zIndex: 0 }}>
            {cols.map((_, i) => (
              <div key={i} className="border-r border-border flex-shrink-0" style={{ width: colWidth + "px", height: "100%" }} />
            ))}
          </div>

          {/* Today marker */}
          {showToday && todayLeft > 0 && todayLeft < totalWidth && (
            <div className="absolute top-0 bottom-0 w-px bg-danger pointer-events-none" style={{ left: todayLeft + "px", zIndex: 10 }} />
          )}

          {/* Rows — each exactly ROW_HEIGHT, vertically centred bar */}
          {tasks.map((task, idx) => {
            if (task.isSection) {
              const isBlue = (task.sectionType || "blue") === "blue";
              return (
                <div key={task.id} style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT, maxHeight: ROW_HEIGHT, overflow: "hidden", background: isBlue ? "#005a53" : "#733208", display: "flex", alignItems: "center" }}>
                  <span className="text-xs font-bold px-2 truncate" style={{ color: isBlue ? "#fff" : "#ffffff" }}>{task.activity}</span>
                </div>
              );
            }

            const pos = barPositions[idx];
            const barType = task.barType || "baseline";
            const color = barType === "delay" ? "#e88219" : "#005a53";
            const isDelay = barType === "delay";
            const duration = isDelay && task.start && task.end ? countWorkingDays(task.start, task.end) : 0;
            const startLocked = task.startActual, endLocked = task.endActual, fullyLocked = startLocked && endLocked;
            const rowBg = idx % 2 === 0 ? "#ffffff" : "rgba(249,250,251,0.5)";

            return (
              <div key={task.id} style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT, maxHeight: ROW_HEIGHT, overflow: "hidden", background: rowBg, position: "relative", display: "flex", alignItems: "center" }}>
                {pos && (
                  <>
                    {/* Left resize */}
                    {!startLocked && (
                      <div className="absolute cursor-ew-resize rounded-l-sm opacity-0 hover:opacity-100 transition-opacity"
                        style={{ left: pos.left, width: 6, height: 18, backgroundColor: "rgba(0,0,0,0.3)", top: "50%", transform: "translateY(-50%)", zIndex: 5 }}
                        onMouseDown={e => handleBarMouseDown(e, task, "left")} />
                    )}
                    {/* Main bar */}
                    <div className="absolute rounded-sm flex items-center px-1.5 overflow-hidden hover:opacity-80 transition-opacity"
                      style={{ left: pos.left, width: pos.width, height: 18, backgroundColor: color, top: "50%", transform: "translateY(-50%)", cursor: fullyLocked ? "not-allowed" : "move", opacity: draggingBar?.taskId === task.id ? 0.7 : 1, zIndex: 4 }}
                      title={`${task.activity}: ${task.start} ~ ${task.end}${fullyLocked ? " (Locked)" : ""}`}
                      onMouseDown={e => !fullyLocked && handleBarMouseDown(e, task, "move")}>
                      {pos.width > 50 && (
                        <span className="text-surface whitespace-nowrap overflow-hidden text-ellipsis font-medium" style={{ fontSize: 10 }}>
                          {task._resolvedItem || task.item || ""}
                        </span>
                      )}
                    </div>
                    {/* Right resize */}
                    {!endLocked && (
                      <div className="absolute cursor-ew-resize rounded-r-sm opacity-0 hover:opacity-100 transition-opacity"
                        style={{ left: pos.left + pos.width - 6, width: 6, height: 18, backgroundColor: "rgba(0,0,0,0.3)", top: "50%", transform: "translateY(-50%)", zIndex: 5 }}
                        onMouseDown={e => handleBarMouseDown(e, task, "right")} />
                    )}
                    {/* DE duration label */}
                    {isDelay && duration > 0 && (
                      <div draggable
                        onDragStart={e => { draggingLabel.current = { taskId: task.id, startX: e.clientX, startY: e.clientY, offsetX: labelOffsets[task.id]?.x || 0, offsetY: labelOffsets[task.id]?.y || 0 }; e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={e => {
                          const c = draggingLabel.current;
                          if (c) { setLabelOffsets(prev => ({ ...prev, [c.taskId]: { x: c.offsetX + e.clientX - c.startX, y: c.offsetY + e.clientY - c.startY } })); draggingLabel.current = null; }
                        }}
                        className="absolute flex items-center justify-center cursor-move select-none"
                        style={{ left: pos.left + pos.width / 2 - 40 + (labelOffsets[task.id]?.x || 0), top: (labelOffsets[task.id]?.y !== undefined ? labelOffsets[task.id].y : -26), width: 80, height: 22, border: "2px solid #005a53", backgroundColor: "#fff", borderRadius: 3, fontSize: 12, fontWeight: "bold", color: "#005a53", zIndex: 5 }}>
                        {duration} WD
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* HTML overlay: staircase + comparison (avoids SVG elements which break the vite plugin's DOM observer) */}
          <div className="absolute top-0 left-0 pointer-events-none" style={{ width: totalWidth, height: tasks.length * ROW_HEIGHT, zIndex: 20 }}>
            {/* Staircase lines */}
            {svgOverlay.programmes.map((programme, progIdx) => {
              const bars = programme.bars;
              if (bars.length < 1) return null;
              const BAR_H = 18;
              const pts = [];
              const firstBar = bars[0];
              const firstBarTop = firstBar.idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_H) / 2;
              pts.push({ x: firstBar.pos.left, y: firstBarTop });
              let maxX = firstBar.pos.left + firstBar.pos.width;
              pts.push({ x: maxX, y: firstBarTop });
              for (let i = 1; i < bars.length; i++) {
                const b = bars[i], bx2 = b.pos.left + b.pos.width;
                if (bx2 < maxX) continue;
                const bt = b.idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_H) / 2;
                pts.push({ x: maxX, y: bt }); pts.push({ x: bx2, y: bt }); maxX = bx2;
              }
              if (pts.length > 0) { const lastY = pts[pts.length - 1].y; pts.push({ x: maxX, y: lastY + ROW_HEIGHT / 2 }); }
              // Convert consecutive points to horizontal/vertical div segments
              const segs = [];
              for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i + 1];
                if (p1.y === p2.y) {
                  segs.push({ key: `s${i}`, left: Math.min(p1.x, p2.x), top: p1.y, w: Math.max(1, Math.abs(p2.x - p1.x)), h: 2 });
                } else {
                  segs.push({ key: `s${i}`, left: p1.x, top: Math.min(p1.y, p2.y), w: 2, h: Math.max(1, Math.abs(p2.y - p1.y)) });
                }
              }
              return segs.map(s => (
                <div key={`${progIdx}-${s.key}`} className="absolute" style={{ left: s.left, top: s.top, width: s.w, height: s.h, backgroundColor: "#dc3545" }} />
              ));
            })}

            {/* Comparison overlay */}
            {(() => {
              const { programmes } = svgOverlay;
              const should = programmes.length >= 2 && (programmes[0].showComparison || programmes[1].showComparison);
              if (!should) return null;
              const getLastEndX = p => p.bars.reduce((m, b) => Math.max(m, b.pos.left + b.pos.width), 0);
              const getLastEndDate = p => p.bars.reduce((m, b) => { const e = parseISO(b.task.end || b.task.start); return isValid(e) && (!m || e > m) ? e : m; }, null);
              const x1 = getLastEndX(programmes[0]), x2 = getLastEndX(programmes[1]);
              const d1 = getLastEndDate(programmes[0]), d2 = getLastEndDate(programmes[1]);
              if (!x1 || !x2 || !d1 || !d2) return null;
              const diffDays = Math.abs(countWorkingDays(format(d1 < d2 ? d1 : d2, "yyyy-MM-dd"), format(d1 < d2 ? d2 : d1, "yyyy-MM-dd")));
              const leftX = Math.min(x1, x2), rightX = Math.max(x1, x2);
              let sectionRowIdx = 0, sectionCount = 0;
              for (let i = 0; i < tasks.length; i++) { if (tasks[i].isSection) { sectionCount++; if (sectionCount === 2) { sectionRowIdx = i; break; } } }
              const arrowY = sectionRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
              const divH = tasks.length * ROW_HEIGHT;
              const ds = 5, labelW = 80, labelH = 20;
              const labelX = leftX + (rightX - leftX) / 2 - labelW / 2, labelY = arrowY - labelH / 2;
              return (
                <div key="comparison" className="absolute inset-0">
                  {/* Vertical dashed lines */}
                  <div className="absolute" style={{ left: x1, top: 0, width: 1.5, height: divH, backgroundColor: "#733208", opacity: 0.7 }} />
                  <div className="absolute" style={{ left: x2, top: 0, width: 1.5, height: divH, backgroundColor: "#733208", opacity: 0.7 }} />
                  {/* Diamond markers at arrowY */}
                  <div className="absolute" style={{ left: x1 - ds, top: arrowY - ds, width: ds * 2, height: ds * 2, backgroundColor: "#733208", transform: "rotate(45deg)" }} />
                  <div className="absolute" style={{ left: x2 - ds, top: arrowY - ds, width: ds * 2, height: ds * 2, backgroundColor: "#733208", transform: "rotate(45deg)" }} />
                  {/* Horizontal line between the two markers */}
                  <div className="absolute" style={{ left: leftX, top: arrowY - 0.75, width: rightX - leftX, height: 1.5, backgroundColor: "#733208" }} />
                  {/* Left arrowhead (triangle pointing left) */}
                  <div className="absolute" style={{ left: leftX - 1, top: arrowY - 4, width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderRight: "6px solid #733208" }} />
                  {/* Right arrowhead (triangle pointing right) */}
                  <div className="absolute" style={{ left: rightX - 5, top: arrowY - 4, width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #733208" }} />
                  {/* Label box */}
                  <div className="absolute flex items-center justify-center" style={{ left: labelX, top: labelY, width: labelW, height: labelH, backgroundColor: "#fff", border: "1.5px solid #733208", borderRadius: 3 }}>
                    <span style={{ color: "#733208", fontSize: 11, fontWeight: "bold", fontFamily: "sans-serif" }}>{diffDays} WD</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}