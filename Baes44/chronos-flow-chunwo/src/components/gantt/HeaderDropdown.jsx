import { useState, useRef, useEffect } from "react";

/**
 * A collapsible dropdown menu for the Gantt header toolbar.
 * Renders a trigger button and a dropdown panel with children.
 */
export default function HeaderDropdown({ icon: Icon, label, active = false, activeColor = "text-primary bg-surface", children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
          open || active ? activeColor : "text-surface/70 hover:text-surface"
        }`}
      >
        {Icon && <Icon size={14} />}
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, opacity: 0.6 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 bg-surface rounded-lg shadow-xl border border-border p-2 z-50 min-w-52"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}