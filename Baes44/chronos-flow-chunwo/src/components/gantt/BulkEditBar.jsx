/**
 * BulkEditBar — floating toolbar that appears when multiple tasks are selected.
 * Allows binding all selected tasks into a chain (first → second → third → ...).
 */
import { useState } from "react";
import { X, Link2, Trash2, Palette, TrendingUp } from "lucide-react";

const DEFAULT_COLORS = [
  "#005a53", // default blue
  "#e88219", // green
  "#dc3545", // red
  "#e88219", // orange
  "#b15315", // purple
  "#003531", // teal
  "#333333", // dark grey
  "#b15315", // light orange
];

export default function BulkEditBar({ selectedCount, onApply, onClear, bindChainMode, setBindChainMode, staircaseFilter, selectedIds }) {
  const [unlink, setUnlink] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColors, setCustomColors] = useState(DEFAULT_COLORS);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleApply = () => {
    if (bindChainMode) {
      onApply({ bindChain: true });
      setBindChainMode(false);
    } else if (unlink) {
      onApply({ unlink: true });
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onApply({ delete: true });
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleColorSelect = (color) => {
    onApply({ color });
    setShowColorPicker(false);
  };

  const handleCustomColorChange = (index, newColor) => {
    const newColors = [...customColors];
    newColors[index] = newColor;
    setCustomColors(newColors);
  };

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: "#003531", color: "#fff", borderRadius: 10, padding: "8px 14px",
      display: "flex", alignItems: "center", gap: 10, zIndex: 200,
      boxShadow: "0 4px 24px rgba(0,0,0,0.35)", fontSize: 12, userSelect: "none",
      whiteSpace: "nowrap",
    }}>
      {/* Color Picker Popup */}
      {showColorPicker && (
        <div style={{
          position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
          background: "#fff", borderRadius: 8, padding: 12, zIndex: 201,
          boxShadow: "0 4px 24px rgba(0,0,0,0.35)", minWidth: 280,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#003531", marginBottom: 8 }}>
            Select Bar Color
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
            {customColors.map((color, idx) => (
              <button
                key={idx}
                onClick={() => handleColorSelect(color)}
                style={{
                  width: 48, height: 32, background: color, border: "2px solid #cecece",
                  borderRadius: 4, cursor: "pointer", transition: "transform 0.1s",
                }}
                className="hover:scale-105 hover:border-text-muted"
                title={`Color ${idx + 1}`}
              />
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6c757d", marginBottom: 6 }}>Customize Colors:</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
            {customColors.map((color, idx) => (
              <input
                key={idx}
                type="color"
                value={color}
                onChange={(e) => handleCustomColorChange(idx, e.target.value)}
                style={{
                  width: "100%", height: 24, border: "1px solid #cecece", borderRadius: 3,
                  cursor: "pointer", padding: 0, background: "none",
                }}
                title={`Edit color ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}
      <Link2 size={14} style={{ color: "#ffffff", flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: "#ffffff" }}>{selectedCount} task{selectedCount > 1 ? "s" : ""} selected</span>
      <div style={{ width: 1, height: 20, background: "#6c757d" }} />

      <button
        onClick={() => { setBindChainMode(true); setUnlink(false); }}
        style={{
          height: 26, padding: "0 12px", background: bindChainMode ? "#005a53" : "#001c19",
          color: bindChainMode ? "#fff" : "#6c757d", border: "none", borderRadius: 5,
          fontWeight: 700, fontSize: 11, cursor: "pointer",
        }}
        className={bindChainMode ? "hover:bg-primary" : "hover:bg-primary"}
        title="Bind selected tasks in order (first → second → third)"
      >
        Bind Chain
      </button>

      <button
        onClick={() => { setUnlink(true); setBindChainMode(false); }}
        style={{
          height: 26, padding: "0 12px", background: unlink ? "#dc3545" : "#001c19",
          color: unlink ? "#fff" : "#6c757d", border: "none", borderRadius: 5,
          fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
        }}
        className={unlink ? "hover:bg-danger" : "hover:bg-primary"}
        title="Remove all links from selected tasks"
      >
        <Trash2 size={12} /> Unlink
      </button>

      <button
        onClick={() => setShowColorPicker(!showColorPicker)}
        style={{
          height: 26, padding: "0 12px", background: showColorPicker ? "#733208" : "#001c19",
          color: showColorPicker ? "#fff" : "#6c757d", border: "none", borderRadius: 5,
          fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
        }}
        className={showColorPicker ? "hover:bg-primary" : "hover:bg-primary"}
        title="Change bar color for selected tasks"
      >
        <Palette size={12} /> Color
      </button>

      {/* Staircase filter */}
      {(() => {
        const isActive = staircaseFilter !== null && staircaseFilter !== undefined;
        // Check if current selection matches the active filter
        const isCurrentFilter = isActive && selectedIds && staircaseFilter.size === selectedIds.size &&
          [...selectedIds].every(id => staircaseFilter.has(id));
        return (
          <button
            onClick={() => {
              if (isCurrentFilter) {
                onApply({ clearStaircaseFilter: true });
              } else {
                onApply({ setStaircaseFilter: new Set(selectedIds) });
              }
            }}
            style={{
              height: 26, padding: "0 12px",
              background: isCurrentFilter ? "#dc3545" : isActive ? "#733208" : "#001c19",
              color: (isCurrentFilter || isActive) ? "#fff" : "#6c757d",
              border: "none", borderRadius: 5,
              fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}
            title={isCurrentFilter ? "Clear staircase filter (show all)" : "Show staircase only for selected tasks"}
          >
            <TrendingUp size={12} /> {isCurrentFilter ? "Clear ╱" : "╱ Filter"}
          </button>
        );
      })()}

      <button
        onClick={handleDelete}
        style={{
          height: 26, padding: "0 12px", background: showDeleteConfirm ? "#dc3545" : "#001c19",
          color: showDeleteConfirm ? "#fff" : "#6c757d", border: "none", borderRadius: 5,
          fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
        }}
        className={showDeleteConfirm ? "hover:bg-danger" : "hover:bg-primary"}
        title={showDeleteConfirm ? "Click again to confirm delete" : "Delete selected tasks"}
      >
        <Trash2 size={12} /> {showDeleteConfirm ? "Confirm?" : "Delete"}
      </button>

      <div style={{ width: 1, height: 20, background: "#6c757d" }} />

      <button
        onClick={handleApply}
        disabled={!bindChainMode && !unlink}
        style={{
          height: 26, padding: "0 12px", background: (bindChainMode || unlink) ? "#005a53" : "#001c19",
          color: (bindChainMode || unlink) ? "#fff" : "#6c757d", border: "none", borderRadius: 5,
          fontWeight: 700, fontSize: 11, cursor: (bindChainMode || unlink) ? "pointer" : "not-allowed",
        }}
        className={(bindChainMode || unlink) ? "hover:bg-primary" : ""}
      >
        Apply
      </button>

      <button
        onClick={onClear}
        title="Deselect all"
        style={{ background: "transparent", border: "none", color: "#6c757d", cursor: "pointer", padding: 2 }}
        className="hover:text-surface"
      >
        <X size={14} />
      </button>
    </div>
  );
}