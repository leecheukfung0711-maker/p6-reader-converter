import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, PanelLeftClose, PanelLeftOpen, Search, Table2 } from "lucide-react";
import {
  buildTableIndex,
  defaultTableName,
  fieldLabel,
  filterTableIndex,
  formatCell,
  groupTableIndex,
  propertyGroupsFor,
  visibleRows,
} from "@/lib/dataExplorer";

/**
 * Batch 48 — P6 Data Explorer browser (xerviewer-style).
 *
 * Presentational only: it receives the already-parsed `tables` of a file, lists
 * them in a categorised sidebar and shows the selected table either as property
 * cards (a single record, like PROJECT) or as a data grid. Colours come from the
 * Common Look and Feel palette only — this stays light-only.
 */
export default function TableBrowser({ fileName = "", tables = {}, initialTable = null, onExport = null, restoredMap = null }) {
  const index = useMemo(() => buildTableIndex(tables), [tables]);
  const groups = useMemo(() => groupTableIndex(index), [index]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [tableQuery, setTableQuery] = useState("");
  const [fieldQuery, setFieldQuery] = useState("");
  const [activeName, setActiveName] = useState(initialTable);

  // Batch 61 — open on PROJECT (the table people came for) instead of the first
  // table alphabetically; fall back to the first table for files without one.
  const fallbackName = useMemo(() => defaultTableName(index), [index]);
  const active = useMemo(
    () => index.find((t) => t.name === activeName) || index.find((t) => t.name === fallbackName) || index[0] || null,
    [index, activeName, fallbackName]
  );
  const shownGroups = useMemo(() => filterTableIndex(groups, tableQuery), [groups, tableQuery]);

  const single = !!active && active.rows.length === 1;
  const slice = active ? visibleRows(active.rows) : { rows: [], truncated: false, total: 0 };
  const query = fieldQuery.trim().toLowerCase();
  const fields = active
    ? active.fields.filter((f) => !query
      || f.toLowerCase().includes(query)
      || fieldLabel(f).toLowerCase().includes(query))
    : [];
  const record = single ? active.rows[0] : null;
  const cards = single ? propertyGroupsFor(fields) : [];

  const toggleGroup = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (!active) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-subtle text-text-muted text-sm">
        No tables loaded yet.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-surface-subtle text-text">
      {/* ── Tables sidebar ── */}
      {sidebarOpen && (
        <aside className="shrink-0 w-56 md:w-60 bg-surface border-r border-border flex flex-col overflow-hidden min-w-0" aria-label="Available tables">
          <div className="shrink-0 px-3 py-2.5 border-b border-border flex justify-between items-center gap-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider truncate" title="Available Tables">Tables</h2>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
              title="Hide Table List"
              aria-label="Hide table list sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="shrink-0 px-2 py-2 border-b border-border">
            <div className="relative">
              <input
                type="search"
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="Search tables..."
                aria-label="Search tables"
                className="w-full pl-2 pr-7 py-1 border border-border rounded-md text-xs bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus"
              />
              <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>
          </div>

          <div className="flex-grow overflow-y-auto px-1.5 py-2">
            <nav className="flex flex-col" aria-label="Table list">
              {shownGroups.map((g) => {
                const isCollapsed = collapsed.has(g.id);
                return (
                  <div key={g.id} className="mb-1" data-category={g.id}>
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleGroup(g.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-semibold text-text-muted uppercase tracking-wider hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <span className="truncate">{g.label}</span>
                      <span className="ml-2 shrink-0 text-text-muted">
                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="flex flex-col">
                        {g.tables.map((t) => {
                          const isActive = t.name === active.name;
                          return (
                            <button
                              key={t.name}
                              type="button"
                              data-table-name={t.name}
                              data-active={isActive ? "true" : "false"}
                              onClick={() => { setActiveName(t.name); setFieldQuery(""); }}
                              title={`${t.name} (${t.rows.length} records)`}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 border-l-2 transition-colors ${
                                isActive
                                  ? "border-primary bg-table-header text-primary font-medium"
                                  : "border-transparent text-text hover:bg-surface-subtle"
                              }`}
                            >
                              <Table2 size={14} className="shrink-0 text-text-muted" />
                              <span className="truncate flex-1">{t.name}</span>
                              <span className="shrink-0 text-[10px] text-text-muted">{t.rows.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {shownGroups.length === 0 && (
                <p className="px-2 py-3 text-xs text-text-muted">No table matches this search.</p>
              )}
            </nav>
          </div>
        </aside>
      )}

      {/* ── Main panel ── */}
      <div className="flex-grow flex flex-col min-w-0">
        {!sidebarOpen && (
          <div className="shrink-0 px-2 py-1.5 border-b border-border bg-surface flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
              title="Show Table List"
              aria-label="Show table list sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
            <span className="text-xs text-text-muted">{index.length} tables</span>
          </div>
        )}

        <div
          className="bg-surface shadow-lg flex flex-col overflow-hidden flex-grow min-h-0"
          data-active-table={active.name}
          data-view={single ? "cards" : "grid"}
        >
          <header className="shrink-0 p-3 border-b border-border bg-surface-subtle flex flex-wrap gap-2 justify-between items-center">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-text truncate" title={active.name}>{active.name}</h1>
              <p className="text-xs text-text-muted">
                {single ? "1 record" : `${active.rows.length} records`} · {active.fields.length} columns
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="search"
                  value={fieldQuery}
                  onChange={(e) => setFieldQuery(e.target.value)}
                  placeholder={`Filter ${active.name}...`}
                  aria-label={`Filter ${single ? "properties" : "columns"} in ${active.name}`}
                  className="pl-3 pr-8 py-1.5 border border-border rounded-full text-sm bg-surface text-text focus:outline-none focus:ring-2 focus:ring-focus w-64"
                />
                <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
              <button
                type="button"
                disabled={!onExport}
                onClick={() => onExport && onExport(active.name)}
                title="Export to Excel"
                aria-label="Export to Excel"
                className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet size={18} />
              </button>
            </div>
          </header>

          {/* body — property cards for a single record, data grid for many */}
          <div className="flex-grow overflow-auto min-h-0 p-4 md:p-6 bg-surface-subtle">
            {single ? (
              <div className="grid grid-cols-1 min-[1400px]:grid-cols-3 gap-6 items-start">
                {cards.map((g) => (
                  <div key={g.id} data-card={g.id} className="bg-surface rounded-xl shadow-sm ring-1 ring-border flex flex-col min-w-[300px]">
                    <div className="px-4 py-2 border-b border-border bg-table-header">
                      <h3 className="text-sm font-semibold text-accent-selected">{g.label}</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {g.fields.map((f) => {
                        const value = formatCell(record ? record[f] : "");
                        const isNull = value === "N/A";
                        const note = restoredMap ? restoredMap[`${active.name}|${f}`] : null;
                        return (
                          <div key={f} className="px-4 py-2 grid grid-cols-4 gap-1 items-center hover:bg-surface-subtle transition-colors">
                            <dt className="text-xs font-medium text-text-muted break-words col-span-2" title={fieldLabel(f)}>{fieldLabel(f)}</dt>
                            <dd
                              className={`text-xs col-span-2 break-words ${isNull ? "italic text-text-muted" : "font-medium text-text"}`}
                              title={note ? `Restored from the ISO code ${note.code} — the file contained "${note.from}".` : value}
                            >
                              {value}
                              {note && <sup className="ml-0.5 text-accent-selected" aria-label="restored from the ISO code">*</sup>}
                            </dd>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <p className="text-xs text-text-muted">No property matches this filter.</p>}
              </div>
            ) : (
              <div className="bg-surface rounded-xl shadow-sm ring-1 ring-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs" data-row-count={active.rows.length}>
                    <thead className="bg-table-header sticky top-0">
                      <tr>
                        {fields.map((f) => (
                          <th key={f} scope="col" title={f} className="px-3 py-2 text-left font-semibold text-accent-selected whitespace-nowrap">
                            {fieldLabel(f)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {slice.rows.map((row, i) => (
                        <tr key={i} className={i % 2 ? "bg-surface-subtle" : "bg-surface"}>
                          {fields.map((f) => {
                            const value = formatCell(row[f]);
                            const note = restoredMap ? restoredMap[`${active.name}|${f}`] : null;
                            return (
                              <td
                                key={f}
                                className={`px-3 py-1.5 whitespace-nowrap ${value === "N/A" ? "italic text-text-muted" : "text-text"}`}
                                title={note ? `Restored from the ISO code ${note.code} — the file contained "${note.from}".` : undefined}
                              >
                                {value}
                                {note && <sup className="ml-0.5 text-accent-selected" aria-label="restored from the ISO code">*</sup>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {slice.truncated && (
                  <p className="px-3 py-2 text-xs text-text-muted border-t border-border">
                    Showing the first {slice.rows.length} of {slice.total} records.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* footer — property count + current file + total tables */}
          <footer className="shrink-0 border-t border-border" data-table-count={index.length}>
            <div className="p-2 bg-surface-subtle text-xs text-text-muted flex justify-between items-center">
              <span>
                Displaying {fields.length} {single ? "properties" : "columns"} for table &apos;
                <span className="font-semibold text-primary">{active.name}</span>&apos;.
              </span>
            </div>
            <div className="p-2 bg-surface-muted text-xs text-text border-t border-border">
              <div className="flex justify-between items-center">
                <span>Current File: <span className="font-semibold text-text">{fileName || "N/A"}</span></span>
                <span>Total Displayable Tables: <span className="font-semibold">{index.length}</span></span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
