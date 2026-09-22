import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Database, FolderOpen, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import TableBrowser from "@/components/dataexplorer/TableBrowser";
import ProjectSelector from "@/components/dataexplorer/ProjectSelector";
import VersionSelector from "@/components/dataexplorer/VersionSelector";
import { brokenValues, tablesFromXml } from "@/lib/dataExplorer";
import { restoreCurrencySymbols } from "@/lib/currencySymbols";
import { parseXerTables } from "@/lib/parseXER";
import { useProgramme } from "@/lib/programmeStore";
import { BACKEND_HINT, isBackendDown, localApi } from "@/lib/localApi";
import { explorerTableSource, findProjectById, newestProject, pickVersionTarget } from "@/lib/projectOptions";

/**
 * Batch 48 — P6 Data Explorer page (xerviewer-style, standalone).
 *
 * Loads an XER or P6 XML file, keeps *every* raw table it contains (not just the
 * ones the Gantt needs) and hands them to TableBrowser. Reachable at
 * /data-explorer and from the Gantt toolbar's Tools menu.
 */
export default function DataExplorerPage() {
  const [fileName, setFileName] = useState("");      // a file loaded on this page
  const [tables, setTables] = useState(null);
  const [rebuilt, setRebuilt] = useState(null);      // rebuilt from the shared file text
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // Batch 49 — the Gantt page publishes its programme here, so an XER uploaded
  // there shows up without a second upload (and vice versa).
  const { programme, publishProgramme, clearProgramme } = useProgramme();
  const [projects, setProjects] = useState([]);        // batch 50 — local backend projects
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [versions, setVersions] = useState([]);        // batch 54 — versions of the open project
  const [versionId, setVersionId] = useState(null);
  const [projectTables, setProjectTables] = useState(null);   // tables of the picked project
  const [projectSource, setProjectSource] = useState(null);   // "raw" (file tables) | "activities"
  const [projectFileName, setProjectFileName] = useState("");

  const sharedTables = programme?.tables || rebuilt || null;
  const rawTables = tables || projectTables || sharedTables;
  const viewFileName = fileName || programme?.fileName || projectFileName;
  const isShared = !tables && !!sharedTables;
  // Batch 56 — a P6 export can lose the non-ASCII currency symbols (�G �D ��); the
  // intact ISO code (curr_short_name) restores them. Cells, cards and the Excel
  // export all use the restored set — the raw tables are never rewritten.
  const { tables: viewTables, restored, unresolved } = useMemo(() => restoreCurrencySymbols(rawTables), [rawTables]);
  const restoredMap = useMemo(() => {
    const map = {};
    for (const r of restored) map[`${r.table}|${r.field}`] = r;
    return map;
  }, [restored]);
  // Batch 55 — characters the file itself could not decode (still flagged after batch 56).
  const broken = useMemo(() => brokenValues(viewTables), [viewTables]);

  // The project list comes from the local backend (same storage the ProjectBar uses).
  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const list = await localApi.listProjects();
      setProjects(Array.isArray(list) ? list : []);
      setProjectsError("");
    } catch (e) {
      setProjects([]);
      setProjectsError(isBackendDown(e) ? BACKEND_HINT : `Could not load projects: ${e.message}`);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  /**
   * Picking a project here is published with source "explorer", so the Gantt page
   * loads the same project when it is opened. Stored versions keep parsed
   * activities only, so they are shown as a TASK table.
   */
  const applyVersion = useCallback(async (targetProjectId, targetVersionId, fallbackName = "") => {
    if (!targetProjectId) return;
    setProjectsLoading(true);
    // Batch 59 — a project picked here replaces a file loaded earlier on this page:
    // `viewTables` prefers this page's own file, so without clearing it the page
    // snapped straight back to that file (the reported flash).
    if (tables || fileName) {
      setTables(null);
      setFileName("");
    }
    try {
      const project = await localApi.getProject(targetProjectId);
      const list = await localApi.listVersions(targetProjectId).catch(() => []);
      setVersions(Array.isArray(list) ? list : []);
      setProjects((prev) => prev.map((p) => (String(p.id) === String(targetProjectId) ? { ...p, ...project } : p)));
      const latestId = project?.latest_version?.id ? String(project.latest_version.id) : null;
      const targetId = pickVersionTarget({ project, versions: list, wantedId: targetVersionId });
      const version = targetId && targetId !== latestId
        ? await localApi.getVersion(targetProjectId, targetId)
        : (project?.latest_version || null);
      const picked = explorerTableSource(version);
      // Batch 57 — the version may carry the file text instead of the tables (the
      // parsed tables were too big, or it was stored before they were kept):
      // rebuild every table from it so the Explorer shows the whole programme.
      const rebuilt = picked.source === "rebuild"
        ? (picked.summary.format === "xml" ? tablesFromXml(picked.text) : parseXerTables(picked.text))
        : null;
      // Batch 58 — never end up with nothing: raw tables, then a rebuild from the
      // stored text, then the stored activities. A failed rebuild used to publish
      // `tables: null`, which dropped the page back to its empty state.
      const shownTables = picked.tables || rebuilt || picked.activities;
      setVersionId(targetId);
      setProjectTables(shownTables);
      setProjectSource(picked.tables ? "raw" : rebuilt ? "rebuilt" : (shownTables ? "activities" : null));
      setProjectFileName(picked.summary.fileName || project?.name || fallbackName || "");
      setRebuilt(null);   // drop any table rebuilt from an earlier file
      setProjectsError("");
      publishProgramme({
        projectId: project?.id ?? targetProjectId,
        projectName: project?.name || findProjectById(projects, targetProjectId)?.name || fallbackName || "",
        fileName: picked.summary.fileName || project?.name || "",
        format: shownTables ? (picked.summary.format || "xer") : null,
        tables: shownTables,
        text: picked.text || "",     // batch 57 — the version's own file text
        versionId: targetId,
        versionName: picked.summary.versionName || "",
      }, "explorer");
    } catch (e) {
      setProjectsError(isBackendDown(e) ? BACKEND_HINT : `Could not open the project: ${e.message}`);
    } finally {
      setProjectsLoading(false);
    }
  }, [projects, publishProgramme, tables, fileName]);

  const handleProjectChange = useCallback((id) => applyVersion(id, null), [applyVersion]);
  const handleVersionChange = useCallback(
    (id) => applyVersion(programme?.projectId, id),
    [applyVersion, programme?.projectId]
  );

  /**
   * Batch 51/52 — the Explorer must never open empty while a programme exists:
   * with a projectId from the store it loads THAT project; without one it adopts
   * the newest stored project (and publishes the choice, so the Gantt follows).
   * Versions keep parsed activities only, so they are shown as a TASK table.
   */
  const adoptedProjectRef = useRef(null);
  useEffect(() => {
    const targetId = programme?.projectId || newestProject(projects)?.id || null;
    if (!targetId) return;
    if (programme?.tables) return;                              // a real file's tables always win
    if (!programme?.projectId && programme?.text) return;       // …and so does a loaded file's text
    if (adoptedProjectRef.current === String(targetId)) return;
    adoptedProjectRef.current = String(targetId);
    applyVersion(targetId, programme?.versionId || null, programme?.projectName || "");
  }, [programme?.projectId, programme?.tables, programme?.text, programme?.projectName,
    programme?.versionId, projects, applyVersion]);

  /**
   * Batch 54b — a NEW programme published by the Gantt page (a freshly loaded or
   * saved file) replaces whatever project/version this page was showing, so the
   * table source never flaps between the two.
   */
  const seenRevisionRef = useRef(-1);
  useEffect(() => {
    if (!programme?.revision) return;
    if (programme.revision === seenRevisionRef.current) return;
    const first = seenRevisionRef.current === -1;
    seenRevisionRef.current = programme.revision;
    if (first) return;                                   // the mount path handled that value
    // Batch 58 — our own publishes (source "explorer") are never a reason to drop the
    // tables this page just applied; only the Gantt loading something new is.
    if (programme.source === "explorer") return;
    if (!programme.tables && !programme.text) return;     // nothing new to show
    setProjectTables(null);
    setProjectSource(null);
  }, [programme?.revision, programme?.source, programme?.tables, programme?.text]);

  // A reload only keeps the metadata + the file text, so rebuild the tables once.
  useEffect(() => {
    if (tables || programme?.tables || !programme?.text) return;
    try {
      const parsed = programme.format === "xml" ? tablesFromXml(programme.text) : parseXerTables(programme.text);
      if (parsed && Object.keys(parsed).length) setRebuilt(parsed);
    } catch {
      /* ignore — the user can load the file again */
    }
  }, [tables, programme?.tables, programme?.text, programme?.format]);

  const loadFile = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const name = file.name || "";
      const ext = name.toLowerCase().split(".").pop();
      const text = await file.text();
      let parsed = null;
      if (ext === "xer") parsed = parseXerTables(text);
      else if (ext === "xml") parsed = tablesFromXml(text);
      else throw new Error(`Unsupported file type ".${ext}" — load a .xer or .xml file.`);
      const count = Object.keys(parsed || {}).length;
      if (!count) throw new Error(`No tables found in "${name}".`);
      setTables(parsed);
      setFileName(name);
      setRebuilt(null);
      setProjectTables(null);   // the file wins over a previously picked project
      setProjectSource(null);
      publishProgramme({ fileName: name, format: ext, tables: parsed, text }, "explorer");
    } catch (e) {
      setTables(null);
      setFileName("");
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }, [publishProgramme]);

  const handleExport = useCallback((tableName) => {
    const rows = (viewTables && viewTables[tableName]) || [];
    if (!rows.length) return;
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, tableName.slice(0, 31));
    const base = (viewFileName || "programme").replace(/\.[^.]+$/, "");
    XLSX.writeFile(book, `${base}-${tableName}.xlsx`);
  }, [viewTables, viewFileName]);

  const clearFile = useCallback(() => {
    setTables(null);
    setFileName("");
    setRebuilt(null);
    setProjectTables(null);
    setProjectSource(null);
    setProjectFileName("");
    setError("");
    clearProgramme();
    if (inputRef.current) inputRef.current.value = "";
  }, [clearProgramme]);

  return (
    <div className="h-screen flex flex-col bg-surface-subtle text-text">
      <header className="shrink-0 bg-primary text-surface px-4 py-2.5 flex flex-wrap items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-1 text-xs font-medium text-surface/80 hover:text-surface focus:outline-none focus:ring-2 focus:ring-surface rounded"
        >
          <ArrowLeft size={14} /> Back to Gantt
        </Link>
        <span className="w-px h-4 bg-surface/30" aria-hidden="true" />
        <h1 className="text-sm font-semibold flex items-center gap-2">
          <Database size={16} /> P6 Data Explorer
        </h1>
        <span className="text-xs text-surface/80 truncate max-w-[280px]" title={viewFileName}>
          {viewFileName || "No file loaded"}
        </span>
        {programme?.projectName && (
          <span className="text-xs text-surface/80 truncate max-w-[220px]" title={programme.projectName}>
            Project: {programme.projectName}
          </span>
        )}
        {isShared && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-surface text-primary"
            data-shared-programme={programme?.source || ""}
            title="This programme was loaded in the Gantt page — both pages share it."
          >
            Loaded in the Gantt page
          </span>
        )}
        <div className="flex-grow" />
        <ProjectSelector
          projects={projects}
          value={programme?.projectId ?? null}
          onChange={handleProjectChange}
          loading={projectsLoading}
          error={projectsError}
          onRefresh={refreshProjects}
        />
        <VersionSelector
          versions={versions}
          value={versionId ?? programme?.versionId ?? null}
          onChange={handleVersionChange}
          loading={projectsLoading}
          onRefresh={() => programme?.projectId && applyVersion(programme.projectId, versionId)}
        />
        <input
          ref={inputRef}
          type="file"
          accept=".xer,.xml"
          className="hidden"
          aria-label="Load an XER or P6 XML file"
          onChange={(e) => loadFile(e.target.files && e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current && inputRef.current.click()}
          className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-primary hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-surface flex items-center gap-1"
        >
          <FolderOpen size={14} /> {viewTables ? "Load another file" : "Choose file"}
        </button>
        {viewTables && (
          <button
            type="button"
            onClick={clearFile}
            className="px-3 py-1 rounded-full text-xs font-medium text-surface/80 hover:text-surface focus:outline-none focus:ring-2 focus:ring-surface flex items-center gap-1"
          >
            <Trash2 size={14} /> Clear
          </button>
        )}
      </header>

      {error && (
        <p className="shrink-0 px-4 py-2 bg-surface text-danger text-xs border-b border-border" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p className="shrink-0 px-4 py-2 bg-surface-subtle text-text-muted text-xs border-b border-border">
          Reading file…
        </p>
      )}

      <main className="flex-grow min-h-0 flex flex-col">
        {viewTables && projectSource && (
          <div
            className="shrink-0 px-3 py-1 border-b border-border bg-surface-subtle text-[11px] text-text-muted"
            data-table-source={projectSource}
          >
            {projectSource === "raw"
              ? "Showing the raw tables stored with this version."
              : projectSource === "rebuilt"
              ? "Showing every table rebuilt from the file text stored with this version."
              : "This stored version predates raw-table storage — showing its activities. Re-save it in the Gantt page to include every raw table."}
          </div>
        )}
        {viewTables && restored.length > 0 && (
          <div
            className="shrink-0 px-3 py-1 border-b border-border bg-surface-muted text-[11px] text-text"
            data-restored-symbols={restored.length}
            title={restored.map((r) => `${r.table}.${r.field}: ${r.code} → ${r.to}   (the file had "${r.from}")`).join("\n")}
          >
            {restored.length} currency symbol{restored.length === 1 ? "" : "s"} were lost by the P6 export and
            restored from the ISO code: {restored.map((r) => `${r.code} → ${r.to}`).join(", ")}.
            {unresolved.length > 0 ? ` ${unresolved.length} more could not be restored.` : ""}
            {" "}Cells marked * show a restored value — hover one to see what the file actually contained.
          </div>
        )}
        {viewTables && broken.count > 0 && (
          <div
            className="shrink-0 px-3 py-1 border-b border-border bg-table-header text-[11px] text-accent-selected"
            data-broken-values={broken.count}
            title={broken.samples.map((s) => `${s.table}.${s.field} = ${s.value}`).join("\n")}
          >
            {broken.count} value{broken.count === 1 ? "" : "s"} in this file could not be decoded — the file
            itself contains broken characters (e.g. {broken.samples[0].table}.{broken.samples[0].field}).
            Re-export the programme from P6 to recover them; nothing is rewritten here.
          </div>
        )}
        <div className="flex-grow min-h-0">
        {viewTables ? (
          <TableBrowser fileName={viewFileName} tables={viewTables} onExport={handleExport} restoredMap={restoredMap} />
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              loadFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
            }}
            className={`h-full flex items-center justify-center p-6 transition-colors ${dragging ? "bg-table-header" : "bg-surface-subtle"}`}
          >
            {programme?.projectId ? (
              <div
                className="max-w-lg w-full bg-surface rounded-xl shadow-sm ring-1 ring-border p-8 text-center"
                data-empty-project={String(programme.projectId)}
              >
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-table-header text-accent-selected mb-3">
                  <FolderOpen size={22} />
                </span>
                <h2 className="text-base font-semibold text-text truncate" title={programme.projectName || "Selected project"}>
                  {programme.projectName || "Selected project"}
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  This project has no stored version to show yet — open it in the Gantt page and save
                  the programme there, or drop a file below.
                </p>
                {projectsError && (
                  <p className="text-[11px] text-danger mt-2 break-words" role="alert">{projectsError}</p>
                )}
                <button
                  type="button"
                  onClick={() => inputRef.current && inputRef.current.click()}
                  className="mt-4 px-4 py-2 rounded-full text-xs font-semibold bg-primary text-surface hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Load a file instead
                </button>
              </div>
            ) : (
            <div className="max-w-lg w-full bg-surface rounded-xl shadow-sm ring-1 ring-border p-8 text-center">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-table-header text-accent-selected mb-3">
                <Upload size={22} />
              </span>
              <h2 className="text-base font-semibold text-text">Browse every table of a programme</h2>
              <p className="text-xs text-text-muted mt-1">
                Drop an <span className="font-medium text-text">XER</span> or{" "}
                <span className="font-medium text-text">P6 XML</span> file here — all of its raw tables
                (PROJECT, TASK, TASKPRED, RSRC, …) are listed on the left.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current && inputRef.current.click()}
                className="mt-4 px-4 py-2 rounded-full text-xs font-semibold bg-primary text-surface hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Choose a file
              </button>
              <p className="text-[11px] text-text-muted mt-3">
                The file stays in your browser — nothing is uploaded.
              </p>
            </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
