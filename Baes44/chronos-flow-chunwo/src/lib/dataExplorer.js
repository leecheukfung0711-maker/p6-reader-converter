/**
 * Batch 48 — raw-table helpers for the P6 Data Explorer page.
 *
 * An XER file is a set of `%T` tables, so a loaded programme can be browsed
 * table by table (like xerviewer.org). Everything here is pure so the smoke test
 * can assert it directly; the page only adds file reading and Excel export.
 */

/** Sidebar order — mirrors the reference viewer's "Tables" panel. */
export const TABLE_CATEGORIES = [
  { id: "project-structure", label: "Project Structure" },
  { id: "resources", label: "Resources" },
  { id: "codes", label: "Codes" },
  { id: "financial", label: "Financial" },
  { id: "documents", label: "Documents" },
  { id: "user-defined", label: "User Defined" },
  { id: "other", label: "Other" },
];

/** Most specific rule first: TASKRSRC must not fall into the TASK rule, nor PROJCODE into PROJECT. */
const CATEGORY_RULES = [
  ["resources", /^(RSRC|ROLE|TASKRSRC|RSRCRATE|RSRCASSIGN|RSRCROLE)/],
  ["codes", /(CODE|ACTVTYPE|UDFTYPE|CATEGORY)/],
  ["financial", /(COST|EXPENSE|CURR|FINANC|BUDGET|SPEND|BENEFIT|FUND|RATE)/],
  ["documents", /(DOC|WORKPRODUCT|MEMO|WBSMEMO)/],
  ["user-defined", /^(UDF|NOTEBOOK|USERFIELD|USER_DEFINED|MEMOTYPE)/],
  ["project-structure", /^(PROJECT|PROJWBS|PROJ|TASK|WBS|CALENDAR|SCHED|FINDATE|PRJ|OBS|ACTIVITY|ACTV)/],
];

/** Which sidebar category a raw table belongs to (unknown tables land in "other"). */
export function categoriseTable(name) {
  const n = String(name || "").toUpperCase();
  for (const [id, re] of CATEGORY_RULES) if (re.test(n)) return id;
  return "other";
}

/** Ordered union of every key used by the rows — the table's columns. */
export function columnKeys(rows) {
  const seen = new Set();
  for (const r of rows || []) for (const k of Object.keys(r || {})) seen.add(k);
  return [...seen];
}

/** Every table of the file as { name, rows, fields, categoryId, categoryLabel }. */
export function buildTableIndex(tables) {
  return Object.keys(tables || {})
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const rows = Array.isArray(tables[name]) ? tables[name] : [];
      const categoryId = categoriseTable(name);
      const category = TABLE_CATEGORIES.find((c) => c.id === categoryId);
      return {
        name,
        rows,
        fields: columnKeys(rows),
        categoryId,
        categoryLabel: category ? category.label : "Other",
      };
    });
}

/**
 * Batch 61 — which table the Explorer opens on: PROJECT when the file has one (any
 * casing, so the P6 XML spelling `Project` works too), otherwise the first table of
 * the index. A real XER has 15 tables and APPLYACTOPTIONS sorts before PROJECT, so
 * without this the page opened on a table nobody looks at.
 */
export function defaultTableName(index) {
  const list = Array.isArray(index) ? index : [];
  if (!list.length) return null;
  const project = list.find((t) => String(t?.name || "").toUpperCase() === "PROJECT");
  return project ? project.name : list[0].name;
}

/** The index grouped into the fixed category order; empty categories are dropped. */
export function groupTableIndex(index) {
  return TABLE_CATEGORIES
    .map((c) => ({ ...c, tables: (index || []).filter((t) => t.categoryId === c.id) }))
    .filter((g) => g.tables.length > 0);
}

/** Case-insensitive table-name search that keeps only the groups still matching. */
export function filterTableIndex(groups, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return groups || [];
  return (groups || [])
    .map((g) => ({ ...g, tables: g.tables.filter((t) => t.name.toLowerCase().includes(q)) }))
    .filter((g) => g.tables.length > 0);
}

/** P6 writes "" or the literal "null" for "no value" — both read as N/A. */
export function formatCell(value) {
  const s = value == null ? "" : String(value).trim();
  return s === "" || s.toLowerCase() === "null" ? "N/A" : s;
}

/** Curated labels for the fields people read; anything else keeps its raw name. */
export const FIELD_LABELS = {
  proj_id: "Project ID", proj_short_name: "Project Name", proj_short_name_pfx: "Project Name Prefix",
  proj_web_site_url: "Project Web Site URL", leveling_priority: "Project Leveling Priority",
  last_recalc_date: "Last Recalc Date", plan_start_date: "Planned Start", plan_end_date: "Planned Finish",
  must_finish_date: "Must Finish By", sched_finish_date: "Schedule Finish", date_added: "Date Added",
  last_sum_date: "Last Summarized Date", sum_refresh_date: "Sum Refresh Date",
  last_apply_actuals_date: "Last Apply Actuals Date", proj_forecast_start_date: "Project Forecast Start",
  fiscal_year_start: "Fiscal Year Begins", code_sep: "Code Separator", act_id_suffix: "Activity ID Suffix",
  act_id_prefix: "Activity ID Prefix", act_id_increment: "Activity Increment",
  wbs_max_sum_level: "WBS Max Summarization Level", crit_path_type: "Critical Path Type",
  crit_drtn_hr_cnt: "Critical activities have float less than or equal to",
  def_complete_pct_type: "Default Percent Complete Type", def_duration_type: "Default Duration Type",
  def_activity_type: "Default Activity Type", def_price_per_unit: "Default Price / Unit",
  def_price_time_unit: "Default Price Time Units", clndr_id: "Default Calendar", rate_type: "Rate Type",
  drive_act_dates_flag: "Drive Activity Dates Default", cost_qty_recalc_flag: "Cost Qty Recalc Flag",
  add_actual_to_remain_flag: "Add Actual To Remaining", link_actual_pct_complete: "Link Percent Complete With Actual",
  link_budget_at_completion: "Link Budget and At Completion", reset_original_to_remaining: "Reset Original to Remaining",
  task_code: "Activity ID", task_name: "Activity Name", task_id: "Task ID", task_type: "Activity Type",
  target_drtn_hr_cnt: "Original Duration (hr)", remain_drtn_hr_cnt: "Remaining Duration (hr)",
  phys_complete_pct: "Percent Complete", status_code: "Status", early_start_date: "Early Start",
  early_end_date: "Early Finish", late_start_date: "Late Start", late_end_date: "Late Finish",
  act_start_date: "Actual Start", act_end_date: "Actual Finish", target_start_date: "Target Start",
  target_end_date: "Target Finish", total_float_hr_cnt: "Total Float (hr)", free_float_hr_cnt: "Free Float (hr)",
  wbs_id: "WBS ID", wbs_short_name: "WBS Code", wbs_name: "WBS Name", parent_wbs_id: "Parent WBS ID",
  pred_task_id: "Predecessor Task ID", pred_type: "Relationship Type", lag_hr_cnt: "Lag (hr)",
  rsrc_id: "Resource ID", rsrc_name: "Resource Name", rsrc_short_name: "Resource Code",
};

/** Human label for a raw field name (falls back to the raw name). */
export function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

/** Property-card groups for a single-record table (mirrors the reference layout). */
export const PROPERTY_GROUPS = [
  {
    id: "general", label: "General",
    fields: ["proj_id", "proj_short_name", "proj_short_name_pfx", "proj_web_site_url", "leveling_priority", "notebook_topic_id", "chk_out_status"],
  },
  {
    id: "dates", label: "Dates",
    fields: ["last_recalc_date", "plan_start_date", "plan_end_date", "must_finish_date", "sched_finish_date", "date_added", "last_sum_date", "sum_refresh_date", "last_apply_actuals_date", "proj_forecast_start_date", "next_data_date"],
  },
  {
    id: "settings", label: "Settings",
    fields: ["fiscal_year_start", "code_sep", "act_id_suffix", "act_id_prefix", "wbs_max_sum_level", "crit_drtn_hr_cnt", "crit_path_type"],
  },
  {
    id: "defaults", label: "Defaults",
    fields: ["def_complete_pct_type", "clndr_id", "act_id_increment", "def_price_per_unit", "def_duration_type", "def_price_time_unit", "rate_type", "def_activity_type", "drive_act_dates_flag"],
  },
  {
    id: "calculations", label: "Calculations",
    fields: ["cost_qty_recalc_flag", "add_actual_to_remain_flag", "link_actual_pct_complete", "link_budget_at_completion", "reset_original_to_remaining"],
  },
  { id: "other", label: "Other", fields: [] },
];

/** The property cards for the fields present in this record (empty groups dropped, "other" last). */
export function propertyGroupsFor(fields) {
  const wanted = new Set(fields || []);
  return PROPERTY_GROUPS
    .map((g) => ({
      id: g.id,
      label: g.label,
      fields: g.id === "other"
        ? [...wanted].filter((f) => !PROPERTY_GROUPS.some((o) => o.id !== "other" && o.fields.includes(f)))
        : [...wanted].filter((f) => g.fields.includes(f)),
    }))
    .filter((g) => g.fields.length > 0);
}

/** Safety valve for very large tables: render the first N rows and say so. */
export const DEFAULT_ROW_LIMIT = 500;
export function visibleRows(rows, limit = DEFAULT_ROW_LIMIT) {
  const all = Array.isArray(rows) ? rows : [];
  return { rows: all.slice(0, limit), truncated: all.length > limit, total: all.length };
}

const XML_ELEMENT_RE = /<([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*\/?>/g;
const XML_ATTR_RE = /([\w.:-]+)\s*=\s*"([^"]*)"/g;

/**
 * P6 XML has no `%T` tables, but it is a flat list of elements carrying
 * attributes, so grouping every element by tag name gives the same table view as
 * the XER one. Elements without attributes (pure containers) are skipped.
 */
export function tablesFromXml(xmlText) {
  const tables = {};
  for (const m of String(xmlText || "").matchAll(XML_ELEMENT_RE)) {
    const row = {};
    let hasAttr = false;
    for (const a of m[2].matchAll(XML_ATTR_RE)) { row[a[1]] = a[2]; hasAttr = true; }
    if (!hasAttr) continue;
    const name = m[1];
    if (!tables[name]) tables[name] = [];
    tables[name].push(row);
  }
  return tables;
}
/**
 * Batch 55 — values the FILE itself could not decode (U+FFFD).
 *
 * A real P6 export can contain them (a symbol written through a UTF-8 pipeline:
 * the bytes `ef bf bd 47` spell "�G" inside the XER). They are reported, never
 * "repaired" — guessing the lost byte would invent data.
 */
export function brokenValues(tables) {
  const samples = [];
  let count = 0;
  for (const [table, rows] of Object.entries(tables || {})) {
    for (const row of Array.isArray(rows) ? rows : []) {
      for (const [field, value] of Object.entries(row || {})) {
        if (typeof value === "string" && value.includes("\uFFFD")) {
          count += 1;
          if (samples.length < 5) samples.push({ table, field, value });
        }
      }
    }
  }
  return { count, tables: [...new Set(samples.map((s) => s.table))], samples };
}

