import { useEffect, useRef, useState } from "react";
import { FolderOpen, Save, Upload, Trash2, Plus, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { localApi, BACKEND_HINT, isBackendDown } from "@/lib/localApi";
import { parseXerTables } from "@/lib/parseXER";
// The app's own parsers — the very same ones the Import dialog uses.
import { parseExcelFile, parseXERFile, parseXMLFile } from "@/components/gantt/ImageImportDialog";

/**
 * Project management bar — connects the Gantt page to the LOCAL backend
 * (projects + programme versions stored in backend/db/pyworkflow.db).
 *
 * Ported from `py-workflow-programme reader/frontend/src/components/gantt/ProjectBar.jsx`
 * (same UI, labels and behaviour) with two differences for this app:
 *   * it talks to /local-api (this app's Vite proxy to the local backend) —
 *     /api belongs to the Base44 cloud proxy here;
 *   * 上傳 parses the file IN THE BROWSER by default, with this app's own
 *     parsers, so the imported tasks match the Import dialog exactly (including
 *     the raw XER tables that make lossless XER → XER export possible).
 *     Set SERVER_PARSE_ON_UPLOAD = true to let the backend parse instead
 *     (POST /projects/{id}/import, Python parsers — lower fidelity, intended
 *     for very large files).
 *
 * Props:
 *   currentProjectId — active project (or null)
 *   onProjectLoaded  — (project, payload, xerTables) => void  (load into editor)
 *   tasks            — current editor tasks (used by the save button)
 */
const SERVER_PARSE_ON_UPLOAD = false;

export default function ProjectBar({ currentProjectId, onProjectLoaded, tasks }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTip, setSavedTip] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await localApi.listProjects();
      setProjects(list);
      setError("");
    } catch (e) {
      console.error("Failed to load projects:", e);
      setError(isBackendDown(e) ? BACKEND_HINT : `載入專案失敗：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const project = await localApi.createProject(newName.trim());
      await refresh();
      setNewName("");
      setMenuOpen(false);
      if (onProjectLoaded) onProjectLoaded(project, null, null);
    } catch (e) {
      console.error("Failed to create project:", e);
      setError(isBackendDown(e) ? BACKEND_HINT : `建立專案失敗：${e.message}`);
    }
  };

  const handleSelect = async (projectId) => {
    try {
      const project = await localApi.getProject(projectId);
      const payload = project.latest_version?.payload || null;
      if (onProjectLoaded) onProjectLoaded(project, payload, null);
      setMenuOpen(false);
      setError("");
    } catch (e) {
      console.error("Failed to load project:", e);
      setError(isBackendDown(e) ? BACKEND_HINT : `載入專案失敗：${e.message}`);
    }
  };

  const handleDelete = async (projectId, name) => {
    if (!window.confirm(`Delete project "${name}" and all its versions?`)) return;
    try {
      await localApi.deleteProject(projectId);
      if (currentProjectId === projectId && onProjectLoaded) onProjectLoaded(null, null, null);
      await refresh();
    } catch (e) {
      console.error("Failed to delete project:", e);
      setError(isBackendDown(e) ? BACKEND_HINT : `刪除專案失敗：${e.message}`);
    }
  };

  /** Parse a picked programme file with the app's own (in-browser) parsers. */
  const parseFileInBrowser = async (file) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "xer") {
      const text = await file.text();
      const parsedTasks = parseXERFile(text) || [];
      // Keep every raw table so lossless XER → XER export keeps working.
      return { tasks: parsedTasks, xerTables: parseXerTables(text), format: "xer" };
    }
    if (ext === "xml") {
      const parsedTasks = parseXMLFile(await file.text()) || [];
      return { tasks: parsedTasks, xerTables: null, format: "xml" };
    }
    if (["xlsx", "xls", "csv"].includes(ext)) {
      const parsedTasks = (await parseExcelFile(file)) || [];
      return { tasks: parsedTasks, xerTables: null, format: ext === "csv" ? "csv" : "xlsx" };
    }
    throw new Error(`不支援的檔案類型 .${ext}（可用 .xer / .xml / .xlsx / .xls / .csv）`);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!currentProjectId) {
      alert("請先建立或選擇一個專案，再上傳 programme 檔案。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (SERVER_PARSE_ON_UPLOAD) {
        // Fallback path: the backend parses the file (Python parsers).
        const result = await localApi.importFile(currentProjectId, file, true);
        await refresh();
        if (onProjectLoaded) onProjectLoaded(result.project, result.payload, null);
      } else {
        // Default path: parse in the browser, then store the result as a version.
        const { tasks: parsedTasks, xerTables, format } = await parseFileInBrowser(file);
        if (!parsedTasks.length) throw new Error("檔案中找不到任何 activity。");
        const payload = {
          tasks: parsedTasks,
          meta: { source_filename: file.name, source_format: format, import_source: "client" },
        };
        const version = await localApi.createVersion(
          currentProjectId,
          payload,
          `Import ${new Date().toLocaleString()}`,
          false
        );
        const project = projects.find((p) => p.id === currentProjectId) || { id: currentProjectId };
        await refresh();
        if (onProjectLoaded) onProjectLoaded(project, version.payload || payload, xerTables);
      }
    } catch (err) {
      console.error("Import failed:", err);
      alert(`匯入失敗: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!currentProjectId) {
      alert("請先選擇專案。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await localApi.createVersion(
        currentProjectId,
        { tasks: tasks || [], meta: { import_source: "client" } },
        `Save ${new Date().toLocaleString()}`,
        false
      );
      setSavedTip(true);
      setTimeout(() => setSavedTip(false), 2000);
      await refresh();
    } catch (e) {
      console.error("Failed to save version:", e);
      setError(isBackendDown(e) ? BACKEND_HINT : `存檔失敗：${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const current = projects.find((p) => p.id === currentProjectId);

  return (
    <div className="relative flex items-center gap-1 ml-2">
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="px-2.5 py-1 rounded-md bg-primary-active/60 hover:bg-primary-active text-surface text-xs font-medium flex items-center gap-1.5"
        title="專案管理"
      >
        <FolderOpen size={13} />
        <span className="max-w-[140px] truncate">{current?.name || "選擇專案"}</span>
        <RefreshCw size={11} className={loading ? "animate-spin" : "opacity-50"} />
      </button>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={saving}
        className="px-2.5 py-1 rounded-md bg-primary-active/60 hover:bg-primary-active text-surface text-xs font-medium flex items-center gap-1.5"
        title="上傳 programme 檔案 (.xer/.xml/.xlsx/.csv) 並解析"
      >
        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
        上傳
      </button>
      <input ref={fileRef} type="file" accept=".xer,.xml,.xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-2.5 py-1 rounded-md bg-primary-active/60 hover:bg-primary-active text-surface text-xs font-medium flex items-center gap-1.5"
        title="儲存目前進度為新版本（由甘特圖頁面提供 tasks）"
      >
        <Save size={13} />
        存檔
      </button>
      {savedTip && <Check size={14} className="text-surface" />}

      {menuOpen && (
        <div className="absolute left-0 top-9 w-72 bg-surface rounded-lg shadow-xl border border-border z-[60] p-2">
          <div className="flex items-center gap-1 mb-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="新增專案名稱…"
              className="flex-1 text-xs text-text border border-border rounded px-2 py-1 outline-none focus:border-primary"
            />
            <button onClick={handleCreate} className="p-1 rounded bg-primary text-surface hover:bg-primary-active" title="建立專案">
              <Plus size={13} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-border">
            {projects.length === 0 && (
              <div className="text-xs text-text-muted text-center py-3">尚無專案</div>
            )}
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-1 py-1">
                <button
                  onClick={() => handleSelect(p.id)}
                  className={`flex-1 text-left text-xs px-2 py-1.5 rounded hover:bg-surface-muted font-medium ${
                    p.id === currentProjectId ? "text-primary bg-surface-subtle" : "text-text"
                  }`}
                >
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-[10px] text-text-muted">
                    {p.source_format || "—"} · {p.version_count} 版本
                  </span>
                </button>
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="p-1 text-text-muted hover:text-danger rounded"
                  title="刪除專案"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!menuOpen && error && (
        <div className="absolute left-0 top-9 flex items-start gap-1.5 max-w-md bg-surface border border-border text-[11px] text-danger rounded-md px-2 py-1.5 shadow-lg z-[60]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
