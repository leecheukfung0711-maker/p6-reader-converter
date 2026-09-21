import { useState, useRef, useEffect, useCallback } from "react";
import { Trash2, Play, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = [
  { border: "#005a53", bg: "rgba(124,58,237,0.15)", label: "#005a53" },
  { border: "#003531", bg: "rgba(8,145,178,0.15)",  label: "#003531" },
  { border: "#b15315", bg: "rgba(217,119,6,0.15)",  label: "#b15315" },
  { border: "#733208", bg: "rgba(5,150,105,0.15)",  label: "#733208" },
  { border: "#dc3545", bg: "rgba(220,38,38,0.15)",  label: "#dc3545" },
  { border: "#e88219", bg: "rgba(147,51,234,0.15)", label: "#e88219" },
];

const DATA_TYPES = [
  { value: "full_table",  label: "Full Table (auto-parse)" },
  { value: "item",        label: "Item" },
  { value: "activity_id", label: "ID" },
  { value: "activity",    label: "Activity" },
  { value: "start",       label: "Start" },
  { value: "end",         label: "End" },
];

// Handle types for resize
const HANDLES = [
  { id: "nw", cursor: "nw-resize", x: 0,   y: 0   },
  { id: "n",  cursor: "n-resize",  x: 0.5, y: 0   },
  { id: "ne", cursor: "ne-resize", x: 1,   y: 0   },
  { id: "e",  cursor: "e-resize",  x: 1,   y: 0.5 },
  { id: "se", cursor: "se-resize", x: 1,   y: 1   },
  { id: "s",  cursor: "s-resize",  x: 0.5, y: 1   },
  { id: "sw", cursor: "sw-resize", x: 0,   y: 1   },
  { id: "w",  cursor: "w-resize",  x: 0,   y: 0.5 },
];

const HANDLE_SIZE = 8; // px

export default function RegionSelector({ imageUrl, initialRegions, onRunOcr, onBack }) {
  const [regions, setRegions] = useState(initialRegions || []);
  const [drawing, setDrawing] = useState(null);       // new region being drawn
  const [dragging, setDragging] = useState(null);     // { id, type: "move"|handle, startX, startY, origReg }
  const [expanded, setExpanded] = useState(() => {
    const ex = {};
    (initialRegions || []).forEach(r => { ex[r.id] = true; });
    return ex;
  });
  const imgRef = useRef();
  const containerRef = useRef();

  const toRatio = useCallback((px, py) => {
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (px - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (py - rect.top) / rect.height)),
    };
  }, []);

  // ── Drawing new region ──────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    // If clicking on a handle or move area, ignore (handled by region events)
    if (e.target !== containerRef.current && e.target !== imgRef.current) return;
    e.preventDefault();
    const { x, y } = toRatio(e.clientX, e.clientY);
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const onMouseMove = useCallback((e) => {
    if (drawing) {
      const { x, y } = toRatio(e.clientX, e.clientY);
      setDrawing(d => ({ ...d, currentX: x, currentY: y }));
    }
    if (dragging) {
      const { x, y } = toRatio(e.clientX, e.clientY);
      const dx = x - dragging.startX;
      const dy = y - dragging.startY;
      const orig = dragging.origReg;

      setRegions(r => r.map(reg => {
        if (reg.id !== dragging.id) return reg;
        let { x1, y1, x2, y2 } = orig;

        if (dragging.type === "move") {
          const w = x2 - x1, h = y2 - y1;
          x1 = Math.max(0, Math.min(1 - w, x1 + dx));
          y1 = Math.max(0, Math.min(1 - h, y1 + dy));
          x2 = x1 + w; y2 = y1 + h;
        } else {
          const h = dragging.type;
          if (h.includes("w")) x1 = Math.max(0, Math.min(x2 - 0.01, orig.x1 + dx));
          if (h.includes("e")) x2 = Math.min(1, Math.max(x1 + 0.01, orig.x2 + dx));
          if (h.includes("n")) y1 = Math.max(0, Math.min(y2 - 0.01, orig.y1 + dy));
          if (h.includes("s")) y2 = Math.min(1, Math.max(y1 + 0.01, orig.y2 + dy));
        }
        return { ...reg, x1, y1, x2, y2 };
      }));
    }
  }, [drawing, dragging, toRatio]);

  const onMouseUp = useCallback((e) => {
    if (drawing) {
      const { x, y } = toRatio(e.clientX, e.clientY);
      const x1 = Math.min(drawing.startX, x);
      const y1 = Math.min(drawing.startY, y);
      const x2 = Math.max(drawing.startX, x);
      const y2 = Math.max(drawing.startY, y);
      if (x2 - x1 > 0.02 && y2 - y1 > 0.02) {
        const idx = regions.length;
        const newId = Date.now();
        setRegions(r => [...r, {
          id: newId, x1, y1, x2, y2,
          label: `Programme ${idx + 1}`,
          dataType: "full_table",
          color: COLORS[idx % COLORS.length],
        }]);
        setExpanded(ex => ({ ...ex, [newId]: true }));
      }
      setDrawing(null);
    }
    if (dragging) setDragging(null);
  }, [drawing, dragging, regions.length, toRatio]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── Region interaction ──────────────────────────────────────
  const startMove = (e, reg) => {
    e.preventDefault(); e.stopPropagation();
    const { x, y } = toRatio(e.clientX, e.clientY);
    setDragging({ id: reg.id, type: "move", startX: x, startY: y, origReg: { ...reg } });
  };

  const startResize = (e, reg, handleId) => {
    e.preventDefault(); e.stopPropagation();
    const { x, y } = toRatio(e.clientX, e.clientY);
    setDragging({ id: reg.id, type: handleId, startX: x, startY: y, origReg: { ...reg } });
  };

  // ── Region management ───────────────────────────────────────
  const deleteRegion = (id) => {
    setRegions(r => {
      const filtered = r.filter(reg => reg.id !== id);
      return filtered.map((reg, i) => ({
        ...reg,
        label: reg.label.startsWith("Programme ") ? `Programme ${i + 1}` : reg.label,
        color: COLORS[i % COLORS.length],
      }));
    });
    setExpanded(ex => { const next = { ...ex }; delete next[id]; return next; });
  };

  const updateRegion = (id, patch) => setRegions(r => r.map(reg => reg.id === id ? { ...reg, ...patch } : reg));
  const toggleExpand = (id) => setExpanded(ex => ({ ...ex, [id]: !ex[id] }));

  const handleRun = () => {
    if (regions.length === 0) return;
    onRunOcr(regions.map(reg => ({
      label: reg.label,
      dataType: reg.dataType,
      x: reg.x1, y: reg.y1,
      w: reg.x2 - reg.x1,
      h: reg.y2 - reg.y1,
    })));
  };

  const drawingStyle = drawing ? {
    position: "absolute",
    left:   `${Math.min(drawing.startX, drawing.currentX) * 100}%`,
    top:    `${Math.min(drawing.startY, drawing.currentY) * 100}%`,
    width:  `${Math.abs(drawing.currentX - drawing.startX) * 100}%`,
    height: `${Math.abs(drawing.currentY - drawing.startY) * 100}%`,
    border: "2px dashed #733208",
    background: "rgba(124,58,237,0.1)",
    pointerEvents: "none",
    boxSizing: "border-box",
  } : null;

  const isDraggingAny = !!dragging;

  return (
    <div className="flex flex-col gap-3">
      {/* Instruction bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          🖱 Draw regions by dragging. Drag inside to move, drag corners/edges to resize.
        </span>
        <button onClick={onBack} className="text-xs text-text-muted hover:text-text underline flex items-center gap-1">
          <RotateCcw size={11} /> Re-upload
        </button>
      </div>

      {/* Auto-detected banner */}
      {initialRegions && initialRegions.length > 0 && (
        <div className="flex items-center gap-2 bg-surface-subtle border border-border rounded-lg px-3 py-2 text-xs text-primary">
          ✨ <strong>{initialRegions.length}</strong> region{initialRegions.length !== 1 ? "s" : ""} auto-detected. Review the types below and adjust if needed, then run OCR.
        </div>
      )}

      {/* Image canvas */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          cursor: isDraggingAny ? "grabbing" : "crosshair",
          userSelect: "none",
          borderRadius: 8, overflow: "hidden",
          border: "1px solid #cecece", maxHeight: 340,
        }}
        onMouseDown={onMouseDown}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Select regions"
          style={{ display: "block", width: "100%", maxHeight: 340, objectFit: "contain", pointerEvents: "none" }}
          draggable={false}
        />

        {/* Drawn regions */}
        {regions.map((reg, i) => {
          const left   = `${reg.x1 * 100}%`;
          const top    = `${reg.y1 * 100}%`;
          const width  = `${(reg.x2 - reg.x1) * 100}%`;
          const height = `${(reg.y2 - reg.y1) * 100}%`;

          return (
            <div
              key={reg.id}
              style={{
                position: "absolute", left, top, width, height,
                border: `2px solid ${reg.color.border}`,
                background: reg.color.bg,
                boxSizing: "border-box",
                cursor: "move",
              }}
              onMouseDown={e => startMove(e, reg)}
            >
              {/* Index badge */}
              <div style={{
                position: "absolute", top: 2, left: 2,
                background: reg.color.border, color: "#fff",
                fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                pointerEvents: "none", whiteSpace: "nowrap",
              }}>
                {i + 1}
              </div>

              {/* Resize handles */}
              {HANDLES.map(h => (
                <div
                  key={h.id}
                  onMouseDown={e => startResize(e, reg, h.id)}
                  style={{
                    position: "absolute",
                    left: `calc(${h.x * 100}% - ${HANDLE_SIZE / 2}px)`,
                    top:  `calc(${h.y * 100}% - ${HANDLE_SIZE / 2}px)`,
                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                    background: "#fff",
                    border: `2px solid ${reg.color.border}`,
                    borderRadius: 2,
                    cursor: h.cursor,
                    zIndex: 10,
                  }}
                />
              ))}
            </div>
          );
        })}

        {/* Drawing preview */}
        {drawingStyle && <div style={drawingStyle} />}
      </div>

      {/* Region list */}
      {regions.length > 0 && (
        <div className="flex flex-col gap-1.5 pr-1">
          {regions.map((reg, i) => (
            <div key={reg.id} style={{ border: `1px solid ${reg.color.border}`, borderRadius: 6, overflow: "hidden" }}>
              <div
                className="flex items-center gap-2 px-2 py-1 cursor-pointer select-none"
                style={{ background: reg.color.bg }}
                onClick={() => toggleExpand(reg.id)}
              >
                <span style={{ width: 18, height: 18, background: reg.color.border, color: "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span className="flex-1 text-xs font-medium truncate" style={{ color: reg.color.label }}>
                  {reg.label}
                </span>
                <span className="text-xs text-text-muted truncate hidden sm:block">
                  {DATA_TYPES.find(d => d.value === reg.dataType)?.label}
                </span>
                <ChevronDown size={12} className="text-text-muted flex-shrink-0 transition-transform" style={{ transform: expanded[reg.id] ? "rotate(180deg)" : "rotate(0deg)" }} />
                <button onClick={e => { e.stopPropagation(); deleteRegion(reg.id); }} className="text-danger hover:text-danger flex-shrink-0">
                  <Trash2 size={11} />
                </button>
              </div>

              {expanded[reg.id] && (
                <div className="flex flex-col gap-2 px-3 py-2 bg-surface">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-text-muted w-16 flex-shrink-0">Label</label>
                    <input
                      type="text"
                      value={reg.label}
                      onChange={e => updateRegion(reg.id, { label: e.target.value })}
                      className="flex-1 text-xs border border-border rounded px-2 py-0.5 outline-none focus:border-text-muted"
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-text-muted w-16 flex-shrink-0">Data type</label>
                    <select
                      value={reg.dataType}
                      onChange={e => updateRegion(reg.id, { dataType: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 text-xs border border-border rounded px-2 py-0.5 outline-none focus:border-text-muted bg-surface"
                    >
                      {DATA_TYPES.map(dt => (
                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {regions.length === 0 && (
        <div className="text-center text-xs text-text-muted py-2">
          No regions drawn yet — drag on the image above to select areas
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" disabled={regions.length === 0} onClick={handleRun} className="bg-primary hover:bg-primary-active text-surface">
          <Play size={13} className="mr-1" /> Run OCR on {regions.length} Region{regions.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}