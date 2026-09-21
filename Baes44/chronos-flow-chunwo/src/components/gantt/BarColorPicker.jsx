import { useEffect, useRef } from "react";

const PRESET_COLORS = [
  "#005a53", // baseline blue
  "#e88219", // delay green
  "#001c19", // red
  "#e88219", // orange
  "#b15315", // purple
  "#733208", // teal
  "#333333", // dark grey
  "#b15315", // dark orange
  "#003531", // green teal
  "#dc3545", // dark red
  "#eaeaea", // navy
  "#dc3545", // pumpkin
];

export default function BarColorPicker({ x, y, currentColor, onClose, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 200);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        background: "#fff",
        border: "1px solid #cecece",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        zIndex: 9999,
        minWidth: 200,
        padding: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6c757d", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #f7f7f7" }}>
        Select Bar Color
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onSelect(color)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: color,
              border: currentColor === color ? "2px solid #003531" : "2px solid transparent",
              cursor: "pointer",
              transition: "transform 0.1s",
            }}
            className="hover:scale-110"
            title={color}
          />
        ))}
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid #f7f7f7", textAlign: "right" }}>
        <button
          onClick={onClose}
          className="text-xs text-text-muted hover:text-text px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}