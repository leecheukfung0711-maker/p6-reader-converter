/**
 * Batch 50 — helpers for picking a stored project from the P6 Data Explorer.
 *
 * A stored version now keeps the whole programme (batch 57): the parsed activities
 * (`tasks`), the file's raw tables (`xerTables`) **and** the file text (`xerText`).
 * The text is the source of truth — measured on a real XER it is 618 KB against
 * 2.1 MB of tables JSON — so every table can be rebuilt even when the tables were
 * too big to store. Versions saved earlier fall back to their activities.
 */

/** Options for the project selector, sorted by label. */
export function projectOptions(projects) {
  return (Array.isArray(projects) ? projects : [])
    .map((p) => ({ value: String(p.id ?? ""), label: p?.name || `Project ${p?.id ?? ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** The project with this id (tolerant about string/number ids). */
export function findProjectById(projects, id) {
  if (id === null || id === undefined || id === "") return null;
  return (Array.isArray(projects) ? projects : [])
    .find((p) => String(p?.id) === String(id)) || null;
}

/**
/**
 * How much room a set of raw tables may take when stored with a version. Roughly
 * an XER of 40 MB; anything bigger keeps the activities only.
 */
export const MAX_STORED_TABLES_CHARS = 24 * 1024 * 1024;

/** JSON size of a raw-tables object (0 when there is nothing to store). */
export function tablesJsonSize(tables) {
  if (!tables || typeof tables !== "object") return 0;
  try { return JSON.stringify(tables).length; } catch { return Number.MAX_SAFE_INTEGER; }
}

/** Whether these tables are small enough to store with a version. */
export function tablesWithinLimit(tables, limit = MAX_STORED_TABLES_CHARS) {
  if (!tables || typeof tables !== "object") return true;   // nothing to store
  return tablesJsonSize(tables) <= limit;
}

/**
 * How much room the file text may take when stored with a version. The text is the
 * cheapest form of "everything" (618 KB of XER against 2.1 MB of tables JSON), so it
 * keeps the tables rebuildable even when they were too big to store directly.
 */
export const MAX_STORED_TEXT_CHARS = 24 * 1024 * 1024;

/** Whether this file text is small enough to store with a version. */
export function textWithinLimit(text, limit = MAX_STORED_TEXT_CHARS) {
  if (!text) return true;                                   // nothing to store
  return String(text).length <= limit;
}

/** Accept either a project (with `latest_version`) or a version object itself. */
function asVersion(source) {
  if (!source) return null;
  return source.payload !== undefined ? source : (source.latest_version || null);
}

/** Version choices, newest first (label: name · stamp · activities). */
export function versionOptions(versions) {
  return [...(Array.isArray(versions) ? versions : [])]
    .sort((a, b) => String(b?.created_at || "").localeCompare(String(a?.created_at || "")))
    .map((v) => ({
      value: String(v?.id ?? ""),
      label: [
        v?.name || "Version",
        v?.created_at ? String(v.created_at).slice(0, 16).replace("T", " ") : "",
        v?.task_count ? `${v.task_count} activities` : "",
      ].filter(Boolean).join(" · "),
    }));
}

/** The newest version of a list (null when there is none). */
export function newestVersion(versions) {
  const list = Array.isArray(versions) ? versions : [];
  if (!list.length) return null;
  return [...list].sort((a, b) => String(b?.created_at || "").localeCompare(String(a?.created_at || "")))[0];
}

/**
 * Which stored version to open for a project: the one already shared (when it
 * belongs to this project), else the newest one, else the project's own latest.
 */
export function pickVersionTarget({ project = null, versions = [], wantedId = null } = {}) {
  if (!project) return null;
  const list = Array.isArray(versions) ? versions : [];
  const wanted = wantedId ? String(wantedId) : null;
  if (wanted && list.some((v) => String(v?.id) === wanted)) return wanted;
  const newest = newestVersion(list);
  if (newest?.id) return String(newest.id);
  const latest = asVersion(project);
  return latest?.id ? String(latest.id) : null;
}

/** The raw tables a stored version kept (batch 53), or null for older versions. */
export function versionRawTables(project) {
  const raw = asVersion(project)?.payload?.xerTables;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return Object.keys(raw).length ? raw : null;
}

/**
 * The programme file's own text a stored version kept (batch 57), or null. With it
 * the Explorer can rebuild every raw table and the Gantt can re-export the file.
 */
export function versionRawText(project) {
  const text = asVersion(project)?.payload?.xerText;
  return typeof text === "string" && text ? text : null;
}

/**
 * Which tables the Explorer should show for a stored project, and where they come
 * from:
 *   "raw"        — the file's own tables are stored with the version;
 *   "rebuild"    — the version kept the file text and `text` is returned for the
 *                  caller to parse (the tables were too big to store, or cleared);
 *   "activities" — rebuilt from the stored activities (versions saved before raw
 *                  tables were kept);
 *   null         — nothing usable stored.
 */
export function explorerTableSource(project) {
  const summary = versionSummary(project);
  const raw = versionRawTables(project);
  // Batch 58 — the activities are always returned as the last-resort fallback, so a
  // click on a stored project can never leave the page with nothing to show.
  const activities = storedVersionTables(project);
  if (raw) return { tables: raw, source: "raw", summary, text: null, activities };
  const text = versionRawText(project);
  if (text) return { tables: null, source: "rebuild", summary, text, activities };
  if (activities) return { tables: activities, source: "activities", summary, text: null, activities };
  return { tables: null, source: null, summary, text: null, activities };
}

/** The project with the most recent stored version (fallback: the first named one).
 * Used when the shared store has no project yet, so the Explorer never opens empty
 * while the backend holds programmes.
 */
export function newestProject(projects) {
  const list = (Array.isArray(projects) ? projects : []).filter(Boolean);
  if (!list.length) return null;
  const stamp = (p) => String(p?.latest_version?.created_at || "");
  return [...list].sort((a, b) => {
    const diff = stamp(b).localeCompare(stamp(a));
    return diff !== 0 ? diff : String(a?.name || "").localeCompare(String(b?.name || ""));
  })[0];
}

/** What the latest stored version holds — shown next to the selector. */
export function versionSummary(project) {
  const version = asVersion(project);
  const payload = version?.payload || null;
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const meta = payload?.meta || {};
  const raw = versionRawTables(project);
  return {
    versionId: version?.id ?? null,
    versionName: version?.name || "",
    createdAt: version?.created_at || "",
    taskCount: tasks.filter((t) => t && !t.isSection).length,
    sectionCount: tasks.filter((t) => t && t.isSection).length,
    fileName: meta.source_filename || "",
    format: meta.source_format || "",
    recalcDate: meta.last_recalc_date || "",
    hasRawTables: !!raw,
    hasRawText: !!versionRawText(project),
    tableCount: raw ? Object.keys(raw).length : 0,
  };
}

/**
 * The stored activities as a TASK table (same field names the XER view uses, so
 * the readable labels and the TASK category apply). Null when there is nothing
 * stored — the selector then keeps whatever tables are already on screen.
 */
export function storedVersionTables(project) {
  const tasks = asVersion(project)?.payload?.tasks;
  if (!Array.isArray(tasks)) return null;
  const rows = tasks
    .filter((t) => t && !t.isSection)
    .map((t) => ({
      task_code: t.activityId || t.item || "",
      task_name: t.activity || "",
      wbs_short_name: t.item || "",
      act_start_date: t.start || "",
      act_end_date: t.end || "",
      phys_complete_pct: t.pct === null || t.pct === undefined ? "" : String(t.pct),
    }));
  return rows.length ? { TASK: rows } : null;
}
