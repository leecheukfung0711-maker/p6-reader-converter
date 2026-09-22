import { Clock, RefreshCw } from "lucide-react";
import { versionOptions } from "@/lib/projectOptions";

/**
 * Batch 54 — the version picker of the P6 Data Explorer.
 *
 * Presentational: the page owns the version list (from the local backend) and the
 * shared selection. Switching here loads that version's tables and publishes the
 * choice, so the Gantt page opens the same version. Palette tokens only.
 */
export default function VersionSelector({
  versions = [],
  value = null,
  onChange = () => {},
  loading = false,
  error = "",
  onRefresh = null,
}) {
  const options = versionOptions(versions);

  return (
    <div className="flex items-center gap-2 min-w-0" data-version-selector="true" data-version-id={value ?? ""}>
      <label className="text-xs text-surface/80 flex items-center gap-1 shrink-0" htmlFor="data-explorer-version">
        <Clock size={14} /> Version
      </label>
      <select
        id="data-explorer-version"
        value={value ?? ""}
        disabled={loading || options.length === 0}
        onChange={(e) => onChange(e.target.value || null)}
        title={options.length ? `${options.length} stored version(s)` : "No stored versions yet"}
        className="text-xs rounded-full px-2 py-1 bg-surface text-text border border-border max-w-[300px] focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {options.length === 0 && (
          <option value="">{loading ? "Loading versions..." : "No versions yet"}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh version list"
          aria-label="Refresh version list"
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
