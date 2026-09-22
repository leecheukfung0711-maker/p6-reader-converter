import { FolderOpen, RefreshCw } from "lucide-react";
import { projectOptions } from "@/lib/projectOptions";

/**
 * Batch 50 — the project picker of the P6 Data Explorer.
 *
 * Presentational: the page owns the project list (from the local backend) and the
 * shared selection. Switching here publishes the project to the shared store, so
 * the Gantt page opens the same project. Common Look and Feel palette only.
 */
export default function ProjectSelector({
  projects = [],
  value = null,
  onChange = () => {},
  loading = false,
  error = "",
  onRefresh = null,
}) {
  const options = projectOptions(projects);
  const hint = projects.length
    ? `${projects.length} stored project${projects.length === 1 ? "" : "s"}`
    : "";

  return (
    <div className="flex items-center gap-2 min-w-0" data-project-selector="true" data-project-id={value ?? ""}>
      <label className="text-xs text-surface/80 flex items-center gap-1 shrink-0" htmlFor="data-explorer-project">
        <FolderOpen size={14} /> Project
      </label>
      <select
        id="data-explorer-project"
        value={value ?? ""}
        disabled={loading || options.length === 0}
        onChange={(e) => onChange(e.target.value || null)}
        title={hint || "No stored projects yet"}
        className="text-xs rounded-full px-2 py-1 bg-surface text-text border border-border max-w-[240px] focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {options.length === 0 && (
          <option value="">{loading ? "Loading projects..." : "No projects yet"}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh project list"
          aria-label="Refresh project list"
          className="p-1 rounded-full text-surface/80 hover:text-surface focus:outline-none focus:ring-2 focus:ring-surface shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      )}
      {error && (
        <span className="text-[11px] text-danger truncate max-w-[320px]" title={error} role="alert">{error}</span>
      )}
    </div>
  );
}
