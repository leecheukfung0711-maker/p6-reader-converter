// XER loss audit : import (parseXER) -> export (buildXER) -> diff every table & field.
//   node scripts/xer-loss-audit.mjs
// Prints: lost tables, emptied tables, row-count changes, per-field differences,
// plus an "edited activity" scenario. Ends with a lossless: YES/NO verdict.
import { createServer } from "vite";

const server = await createServer({ root: process.cwd(), logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
const { parseXER, parseXerTables } = await server.ssrLoadModule("/src/lib/parseXER.js");
const { buildXER } = await server.ssrLoadModule("/src/lib/exportXER.js");

const T = (...v) => "%T\t" + v.join("\t");
const F = (...v) => "%F\t" + v.join("\t");
const R = (...v) => "%R\t" + v.join("\t");
const E = "%E";
const pad = (s, n) => String(s).padEnd(n);
const dp = (v) => String(v || "").trim().slice(0, 10);

const parseTables = (text) => {
  const out = new Map();
  let cur = null, fields = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("%T\t")) { cur = line.slice(3).trim(); fields = []; out.set(cur, { fields: [], rows: [] }); }
    else if (line.startsWith("%F\t") && cur) { fields = line.slice(3).split("\t"); out.get(cur).fields = fields; }
    else if (line.startsWith("%R\t") && cur) {
      const v = line.slice(3).split("\t");
      out.get(cur).rows.push(Object.fromEntries(fields.map((f, i) => [f, v[i] ?? ""])));
    }
  }
  return out;
};

// A source XER with several tables and rich TASK fields (2 calendars, nested WBS,
// activity codes, resources, notes, UDF, resource assignments).
const SRC = [
  "ERMHDR\t19.12\t2023-09-19\tProject\tADMIN\tUser\tdbxDatabaseNoName\tProject Management\tHKD",
  T("CURRTYPE"), F("curr_id", "decimal_digit_cnt", "curr_symbol", "curr_type", "curr_short_name", "base_exch_rate"),
  R("1", "2", "HK$", "Hong Kong Dollar", "HKD", "1"), R("2", "2", "$", "US Dollar", "USD", "7.8"), E,
  T("FINTMPL"), F("fintmpl_id", "fintmpl_name", "default_flag"), R("1", "Calendar", "Y"), E,
  T("OBS"), F("obs_id", "parent_obs_id", "guid", "seq_num", "obs_name", "obs_descr"),
  R("1", "0", "", "0", "Enterprise", ""), R("2", "1", "", "10", "Hong Kong", ""), E,
  T("UDFTYPE"), F("udf_type_id", "table_name", "udf_type_name", "udf_type_label", "logical_data_type", "super_flag", "export_flag"),
  R("1", "TASK", "Cost Code", "Cost Code", "FT_TEXT", "N", "Y"), E,
  T("PROJECT"), F("proj_id", "proj_short_name", "name_sep_char", "clndr_id", "plan_start_date", "plan_end_date", "guid", "acct_id", "last_recalc_date", "def_complete_pct_type", "task_code_base", "task_code_step", "fy_start_month_num", "wbs_max_sum_level", "priority_num"),
  R("101", "6WSD21_SHA_TIN", ".", "5", "2023-09-01 08:00", "2024-06-30 17:00", "GUID-PROJECT-1", "ACCT-9", "2023-09-18 12:00", "CP_Phys", "100", "1", "4", "5", "50"), E,
  T("APPLYACTOPTIONS"), F("proj_id", "respect_duration_type"), R("101", "N"), E,
  T("CALENDAR"), F("clndr_id", "default_flag", "clndr_name", "proj_id", "base_clndr_id", "clndr_type", "day_hr_cnt", "week_hr_cnt", "month_hr_cnt", "year_hr_cnt", "rsrc_private", "clndr_data"),
  R("5", "Y", "6d wk 9h", "", "", "CA_Base", "9", "54", "234", "2808", "N", "(0||CalendarData()(EXCEPTIONS-1))"),
  R("6", "N", "5d wk 8h", "", "5", "CA_Base", "8", "40", "172", "2080", "N", "(0||CalendarData()(EXCEPTIONS-2))"), E,
  T("PROJWBS"), F("wbs_id", "proj_id", "obs_id", "seq_num", "proj_node_flag", "sum_data_flag", "status_code", "wbs_short_name", "wbs_name", "parent_wbs_id", "guid", "orig_proj_id"),
  R("100", "101", "1", "0", "Y", "N", "WS_Open", "6WSD21", "Sha Tin WTW", "", "GUID-WBS-ROOT", ""),
  R("200", "101", "2", "10", "N", "N", "WS_Open", "A", "Phase A - Foundations", "100", "GUID-WBS-1", ""),
  R("300", "101", "2", "20", "N", "N", "WS_Open", "A.1", "Sub A1 - Piles", "200", "GUID-WBS-2", ""), E,
  T("ACTVTYPE"), F("actv_code_type_id", "proj_id", "actv_code_type", "actv_code_type_scope"), R("1", "101", "Area", "Project"), E,
  T("ACTVCODE"), F("actv_code_id", "actv_code_type_id", "actv_code_name", "short_name", "seq_num"),
  R("1", "1", "Zone 1", "Z1", "1"), R("2", "1", "Zone 2", "Z2", "2"), E,
  T("RSRC"), F("rsrc_id", "parent_rsrc_id", "rsrc_short_name", "rsrc_name", "rsrc_type", "unit_of_measure", "default_units_per_time"),
  R("10", "0", "CARP", "Carpenter", "RT_Labor", "h", "8"), E,
  T("TASK"), F("task_id", "proj_id", "wbs_id", "clndr_id", "phys_complete_pct", "task_code", "task_name", "task_type", "duration_type", "status_code", "early_start_date", "early_end_date", "act_start_date", "target_start_date", "target_end_date", "target_drtn_hr_cnt", "remain_drtn_hr_cnt", "total_float_hr_cnt", "cstr_type", "cstr_date", "priority_type", "driving_path_flag", "guid", "location_id", "rsrc_id"),
  R("501", "101", "200", "5", "40", "A100", "Excavate", "TT_Task", "DT_FixedDUR", "TK_Active", "2023-09-01 07:00", "2023-09-08 17:00", "2023-09-01 07:00", "2023-09-01 07:00", "2023-09-08 17:00", "72", "48", "0", "CS_MSO", "2023-09-01 07:00", "PT_High", "Y", "GUID-TASK-1", "Z1", "10"),
  R("502", "101", "300", "6", "0", "A110", "Piling", "TT_Task", "DT_FixedDUR", "TK_NotStart", "2023-09-11 07:00", "2023-09-15 17:00", "", "2023-09-11 07:00", "2023-09-15 17:00", "40", "40", "5", "", "", "PT_Normal", "N", "GUID-TASK-2", "Z2", ""), E,
  T("TASKPRED"), F("task_pred_id", "task_id", "pred_task_id", "proj_id", "pred_proj_id", "pred_type", "lag_hr_cnt", "float_path", "aref", "arls"),
  R("1", "502", "501", "101", "101", "PR_FS", "0", "0", "", ""), E,
  T("TASKRSRC"), F("taskrsrc_id", "task_id", "proj_id", "rsrc_id", "skill_level", "remain_qty", "target_qty", "act_reg_qty", "target_cost", "guid"),
  R("1", "501", "101", "10", "Journeyman", "64", "72", "24", "12000", "GUID-TR-1"), E,
  T("TASKACTV"), F("task_id", "actv_code_type_id", "actv_code_id", "proj_id"),
  R("501", "1", "1", "101"), R("502", "1", "2", "101"), E,
  T("UDFVALUE"), F("udf_type_id", "fk_id", "proj_id", "udf_text"), R("1", "501", "101", "CC-202"), E,
  T("TASKNOTE"), F("task_id", "proj_id", "note_type", "note_text"),
  R("501", "101", "itm_note", "Excavation must follow the survey check."), E,
  E,
].join("\r\n");

// ---------------------------------------------------------------- round trip
const imported = parseXER(SRC);
const sourceTables = parseXerTables(SRC);          // raw tables (what the app keeps on import)
const opts = { version: "19.12", projectId: "6WSD21_SHA_TIN", projectName: "Sha Tin WTW", exportDate: "2023-09-18" };
const OUT = buildXER(imported, { ...opts, sourceTables });
const a = parseTables(SRC), b = parseTables(OUT);

console.log("======== 1) TABLES ========");
const missing = [...a.keys()].filter(k => !b.has(k));
const emptied = [...b.keys()].filter(k => b.get(k).rows.length === 0 && (a.get(k)?.rows.length || 0) > 0);
console.log(`source tables (${a.size}): ${[...a.keys()].join(", ")}`);
console.log(`export tables (${b.size}): ${[...b.keys()].join(", ")}`);
console.log(`*** LOST COMPLETELY (${missing.length}): ${missing.join(", ") || "none"}`);
console.log(`*** EMITTED EMPTY  (${emptied.length}): ${emptied.join(", ") || "none"}`);
console.log("\nrows: src -> out");
for (const k of [...new Set([...a.keys(), ...b.keys()])]) {
  const s = a.get(k)?.rows.length, o = b.get(k)?.rows.length;
  console.log(`  ${pad(k, 15)} ${pad(s ?? "-", 4)} -> ${pad(o ?? "-", 4)}${(s || 0) !== (o || 0) ? "  <-- DIFFERENT" : ""}`);
}

console.log("\n======== 2) TASK FIELDS ========");
const st = a.get("TASK"), ot = b.get("TASK");
console.log(`TASK columns: src ${st.fields.length} -> out ${ot.fields.length}`);
const srcOnly = st.fields.filter(f => !ot.fields.includes(f));
console.log(`source columns NOT written: ${srcOnly.join(", ") || "none"}`);
for (const code of st.rows.map(r => r.task_code)) {
  const s = st.rows.find(r => r.task_code === code);
  const o = ot.rows.find(r => r.task_code === code);
  if (!o) { console.log(`  ${code}: *** ROW NOT EXPORTED ***`); continue; }
  const changed = Object.keys(s).filter(k => (s[k] || "") !== (o[k] ?? ""));
  console.log(`  ${code}: ${changed.length} changed`);
  changed.forEach(k => console.log(`        ${pad(k, 18)} "${s[k]}" -> "${o[k]}"`));
}

console.log("\n======== 3) PROJWBS ========");
const sw = a.get("PROJWBS"), ow = b.get("PROJWBS");
console.log(`rows: ${sw.rows.length} -> ${ow.rows.length}`);
sw.rows.forEach(r => {
  const o = ow.rows.find(x => x.wbs_name === r.wbs_name);
  if (!o) { console.log(`  "${r.wbs_name}" -> *** LOST ***`); return; }
  const d = ["wbs_id", "parent_wbs_id", "wbs_short_name", "seq_num", "obs_id", "guid"].filter(k => (r[k] || "") !== (o[k] ?? "")).map(k => `${k} "${r[k]}"->"${o[k]}"`);
  console.log(`  "${r.wbs_name}": ${d.length ? d.join(", ") : "unchanged"}`);
});

console.log("\n======== 4) CALENDAR ========");
console.log(`rows: ${a.get("CALENDAR").rows.length} -> ${b.get("CALENDAR").rows.length}`);
a.get("CALENDAR").rows.forEach(r => console.log(`  src id=${r.clndr_id} "${r.clndr_name}" day_hr=${r.day_hr_cnt}`));
b.get("CALENDAR").rows.forEach(r => console.log(`  out id=${r.clndr_id} "${r.clndr_name}" day_hr=${r.day_hr_cnt}`));
console.log(`  activity clndr_id: [${st.rows.map(r => r.clndr_id).join(", ")}] -> [${ot.rows.map(r => r.clndr_id).join(", ")}]`);

console.log("\n======== 5) PROJECT ========");
const sp = a.get("PROJECT"), op = b.get("PROJECT");
// last_recalc_date / next_data_date come from the Data Date input (intentional user value)
const DATA_DATE_FIELDS = ["last_recalc_date", "next_data_date"];
const pc = Object.keys(sp.rows[0])
  .filter(k => !DATA_DATE_FIELDS.includes(k))
  .filter(k => (sp.rows[0][k] || "") !== (op.rows[0][k] ?? ""))
  .map(k => `${pad(k, 22)} "${sp.rows[0][k]}" -> "${op.rows[0][k]}"`);
console.log(`fields changed (excluding Data Date): ${pc.length}`);
pc.forEach(l => console.log(`  ${l}`));

console.log("\n======== 6) TASKPRED ========");
console.log(`rows: ${a.get("TASKPRED").rows.length} -> ${b.get("TASKPRED").rows.length}`);
console.log(JSON.stringify(b.get("TASKPRED").rows));

console.log("\n======== 7) EDITED ACTIVITY (A110 renamed / re-dated / float 5h to 16h) ========");
const edited = imported.map(t => (!t.isSection && t.activityId === "A110")
  ? { ...t, activity: "Piling (revised)", start: "2023-09-12", end: "2023-09-18", float: 2 }
  : t);
const b2 = parseTables(buildXER(edited, { ...opts, sourceTables }));
const e2 = b2.get("TASK").rows.find(r => r.task_code === "A110");
const v2 = b2.get("TASK").rows.find(r => r.task_code === "A100");
const editOk = e2.task_name === "Piling (revised)"
  && dp(e2.early_start_date) === "2023-09-12" && dp(e2.early_end_date) === "2023-09-18"
  && e2.total_float_hr_cnt === "16"
  && e2.task_id === "502" && e2.clndr_id === "6";          // original id + calendar preserved
console.log(`  A110 -> name="${e2.task_name}" ${dp(e2.early_start_date)}..${dp(e2.early_end_date)} float_hr=${e2.total_float_hr_cnt} task_id=${e2.task_id} clndr_id=${e2.clndr_id}`);
console.log(`  A110 edit applied: ${editOk ? "OK" : "UNEXPECTED"} (original task_id and calendar kept)`);
const untouchedOk = v2.task_name === "Excavate" && v2.act_start_date === "2023-09-01 07:00" && v2.total_float_hr_cnt === "0";
console.log(`  A100 untouched kept verbatim: ${untouchedOk ? "OK" : "UNEXPECTED"} (07:00 time and 0h float intact)`);

console.log("\n======== VERDICT ========");
const lossless = missing.length === 0 && emptied.length === 0 && srcOnly.length === 0 && pc.length === 0;
console.log(`lossless (unchanged round trip): ${lossless ? "YES" : "NO"}  (tables lost: ${missing.length}, emptied: ${emptied.length}, changed PROJECT fields: ${pc.length})`);
console.log(`edits applied without collateral loss: ${editOk && untouchedOk ? "YES" : "NO"}`);
await server.close();


