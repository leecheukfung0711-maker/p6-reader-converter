import { useState, useEffect } from "react";
import { Camera, Trash2, RotateCcw, X, Clock } from "lucide-react";

const STORAGE_KEY = "gantt_snapshots";

function loadSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSnapshots(snaps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snaps));
}

export default function SnapshotManager({ tasks, columnVisibility, cw, onRestore }) {
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [open, setOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync from storage whenever panel opens
  useEffect(() => {
    if (open) setSnapshots(loadSnapshots());
  }, [open]);

  const handleSave = () => {
    const name = nameInput.trim() || `Snapshot ${new Date().toLocaleString("en-GB", { hour12: false })}`;
    const newSnap = {
      id: Date.now(),
      name,
      savedAt: new Date().toISOString(),
      tasks: JSON.parse(JSON.stringify(tasks)),
      columnVisibility: JSON.parse(JSON.stringify(columnVisibility || {})),
      cw: JSON.parse(JSON.stringify(cw || {})),
    };
    const updated = [newSnap, ...snapshots].slice(0, 20); // keep max 20
    saveSnapshots(updated);
    setSnapshots(updated);
    setNameInput("");
    setSaving(false);
  };

  const handleDelete = (id) => {
    const updated = snapshots.filter(s => s.id !== id);
    saveSnapshots(updated);
    setSnapshots(updated);
  };

  const handleRestore = (snap) => {
    if (window.confirm(`Restore snapshot "${snap.name}"? Unsaved changes will be lost.`)) {
      onRestore(snap.tasks, snap.columnVisibility, snap.cw);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
          open ? "text-accent-selected" : "text-text-muted hover:text-text"
        }`}
        title="Snapshot manager"
      >
        <Camera size={14} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 bg-surface rounded-xl shadow-2xl border border-border z-50"
          style={{ width: 340 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-text text-sm flex items-center gap-2">
              <Camera size={15} className="text-accent-selected" /> Gantt Snapshots
            </span>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text">
              <X size={15} />
            </button>
          </div>

          {/* Save area */}
          <div className="px-4 py-3 border-b border-border bg-table-header">
            {saving ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setSaving(false); }}
                  placeholder="Name this snapshot (optional)"
                  className="flex-1 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent-accessible text-text bg-surface"
                />
                <button onClick={handleSave} className="bg-accent-accessible text-surface text-xs px-3 py-1 rounded hover:bg-accent-accessible font-medium">
                  Save
                </button>
                <button onClick={() => setSaving(false)} className="text-text-muted hover:text-text text-xs px-1">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSaving(true)}
                className="w-full flex items-center justify-center gap-2 bg-accent-accessible hover:bg-accent-accessible text-surface text-sm font-medium py-1.5 rounded transition-colors"
              >
                <Camera size={14} /> Save Current State as Snapshot
              </button>
            )}
          </div>

          {/* Snapshot list */}
          <div className="max-h-72 overflow-y-auto">
            {snapshots.length === 0 ? (
              <div className="text-center text-text-muted text-xs py-8">
                No snapshots saved yet
              </div>
            ) : (
              snapshots.map(snap => (
                <div
                  key={snap.id}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-subtle border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text break-words">{snap.name}</div>
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                      <Clock size={10} />
                      {new Date(snap.savedAt).toLocaleString("en-GB", { hour12: false })}
                      <span className="ml-1 text-text-muted">·</span>
                      <span>{snap.tasks.filter(t => !t.isSection).length} tasks</span>
                      {snap.columnVisibility && <span className="ml-1 text-text-muted">·</span>}
                      {snap.columnVisibility && <span title="Layout saved">📐</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(snap)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary px-2 py-1 rounded border border-border hover:bg-surface-subtle flex-shrink-0"
                    title="Restore this snapshot"
                  >
                    <RotateCcw size={11} /> Restore
                  </button>
                  <button
                    onClick={() => handleDelete(snap.id)}
                    className="text-text-muted hover:text-danger flex-shrink-0"
                    title="Delete snapshot"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {snapshots.length > 0 && (
            <div className="px-4 py-2 text-xs text-text-muted border-t border-border text-center">
              Up to 20 snapshots · stored locally in browser
            </div>
          )}
        </div>
      )}
    </div>
  );
}