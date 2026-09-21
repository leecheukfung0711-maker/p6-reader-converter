/**
 * SectionColorPicker — floating colour picker for programme section rows.
 * Shows a palette of bg colours; text colour is auto-selected for contrast.
 */
import { useEffect, useRef } from "react";

// Luminance-based contrast: returns "#fff" or "#333333" for best readability
function contrastColor(hex) {
  const h = (hex || "#ffffff").replace("#", "");
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  // Relative luminance (sRGB)
  const toLinear = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#333333" : "#ffffff";
}

const PALETTE = [
  // Blues  -> primary ramp
  "#f7f7f7", "#ececec", "#cecece", "#005a53", "#003531", "#001c19",
  // Pinks / Reds -> danger / warm accent ramp
  "#fff2ea", "#f7f7f7", "#eaeaea", "#dc3545", "#b15315", "#733208",
  // Greens -> primary (success) ramp
  "#f7f7f7", "#ececec", "#6c757d", "#005a53", "#003531", "#001c19",
  // Yellows / Oranges -> accent ramp
  "#fff2ea", "#f7f7f7", "#cecece", "#e88219", "#b15315", "#733208",
  // Purples -> the palette is light-only and has no purple hue: primary depth
  "#eaeaea", "#ececec", "#cecece", "#6c757d", "#003531", "#001c19",
  // Neutrals -> surfaces, borders and text
  "#ffffff", "#f7f7f7", "#ececec", "#cecece", "#6c757d", "#333333",
];

export default function SectionColorPicker({ x, y, currentBg, onClose, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  // Keep within viewport
  const W = 212, H = 200;
  const adjX = Math.min(x, window.innerWidth - W - 8);
  const adjY = Math.min(y, window.innerHeight - H - 8);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed", left: adjX, top: adjY,
        background: "#fff", border: "1px solid #cecece",
        borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
        zIndex: 10000, padding: 12, width: W,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6c757d", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Programme Colour
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
        {PALETTE.map(color => {
          const textCol = contrastColor(color);
          const isActive = currentBg === color;
          return (
            <button
              key={color}
              onClick={() => { onSelect(color, textCol); onClose(); }}
              title={color}
              style={{
                width: 28, height: 28, borderRadius: 5,
                background: color,
                border: isActive ? `2.5px solid ${textCol}` : "1.5px solid rgba(0,0,0,0.12)",
                cursor: "pointer",
                boxShadow: isActive ? "0 0 0 2px #005a53" : undefined,
                transition: "transform 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.18)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            />
          );
        })}
      </div>
      <button
        onClick={() => { onSelect(null, null); onClose(); }}
        style={{
          marginTop: 10, width: "100%", fontSize: 11, padding: "4px 0",
          border: "1px dashed #cecece", borderRadius: 5, cursor: "pointer",
          color: "#6c757d", background: "transparent",
        }}
      >
        Reset to default
      </button>
    </div>
  );
}

export { contrastColor };