/**
 * Export Gantt tasks to Primavera P6 XER format.
 *
 * Reference: real P6 R15.1 XER file analyzed for exact field names, order, and calendar format.
 *
 * Minimum required tables for P6 to import:
 *   CALENDAR, PROJECT, PROJWBS, TASK
 *
 * Table write order (per reference XER):
 *   CURRTYPE, FINTMPL, OBS, UDFTYPE, PROJECT, APPLYACTOPTIONS,
 *   CALENDAR, PROJWBS, TASK, TASKPRED, TASKRSRC, TASKACTV, UDFVALUE
 */

const P6_VERSIONS = [
  { value: "15.1",  label: "P6 R15.1" },
  { value: "15.2",  label: "P6 R15.2" },
  { value: "18.8",  label: "P6 R18.8" },
  { value: "19.12", label: "P6 R19.12" },
  { value: "20.12", label: "P6 R20.12" },
  { value: "21.12", label: "P6 R21.12" },
  { value: "22.12", label: "P6 R22.12 (EPPM)" },
];

/** Format YYYY-MM-DD → "YYYY-MM-DD HH:MM" for P6 datetime fields */
function p6dt(dateStr, time = "00:00") {
  if (!dateStr) return "";
  const d = dateStr.slice(0, 10);
  if (d.length < 10) return "";
  return `${d} ${time}`;
}

/** Diff in calendar days, minimum 1 */
function calDays(start, end) {
  if (!start || !end) return 1;
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/** Build a TSV row string: %R\t<v1>\t<v2>... */
function row(...vals) {
  return "%R\t" + vals.map(v => (v == null ? "" : String(v))).join("\t");
}

/** Build a table header block */
function tableHeader(name, fields) {
  return [`%T\t${name}`, `%F\t${fields.join("\t")}`];
}

const LINK_TYPES = ["FS", "SS", "FF", "SF"];

/**
 * Outgoing relationship edges of a task — the task is the PREDECESSOR and each edge
 * points at a successor. Three sources, matching buildRelationshipMap() + parseXER:
 *   1. `links` array (imported, multiple) — [{ succId, succCode, type, lag }]
 *   2. legacy single `link` (successor task id) + relType/linkType + linkOffset lag
 *   3. freshly parsed XER — `linkSuccCode` (+ linkType/relType/linkOffset) before
 *      resolveImportedLinks() has turned it into `link`
 * Each edge keeps whichever identifier it has (app task id and/or activity code);
 * the caller resolves it to an exported task_id. De-duplicated.
 */
function outgoingEdges(t) {
  const edges = [];
  const seen = new Set();
  const normType = (v) => {
    const s = String(v || "FS").toUpperCase().replace(/^PR_/, "");
    return LINK_TYPES.includes(s) ? s : "FS";
  };
  const push = (succId, succCode, type, lag) => {
    const hasId = succId != null && succId !== "";
    const hasCode = !!succCode && String(succCode).trim() !== "";
    if (!hasId && !hasCode) return;
    const key = hasId ? `id:${succId}` : `code:${String(succCode).trim().toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ succId: hasId ? succId : null, succCode: hasCode ? succCode : null, type: normType(type), lag: Number(lag) || 0 });
  };
  if (Array.isArray(t.links)) t.links.forEach((l) => { if (l) push(l.succId, l.succCode, l.type, l.lag); });
  if (t.link != null && t.link !== "") push(t.link, null, t.relType || t.linkType, t.linkOffset);
  else if (t.linkSuccCode) push(null, t.linkSuccCode, t.relType || t.linkType, t.linkOffset ?? t.linkLag);
  return edges;
}


/**
 * Generate a standard 5-day working week calendar data string in P6 R15+ format.
 * Uses the nested CalendarData() / DaysOfWeek() structure found in real XER files.
 * Day index: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
 * Work days Mon–Fri: 07:00–17:00 (10h). Sun/Sat: no hours (off).
 */
function makeCalendarData() {
  const workDay = "(0||0(s|07:00|f|17:00)())";
  const offDay  = "()";
  // Days 1(Sun)=off, 2(Mon-Fri)=work, 7(Sat)=off
  const days = [
    `(0||1${offDay})`,
    `(0||2(${workDay}))`,
    `(0||3(${workDay}))`,
    `(0||4(${workDay}))`,
    `(0||5(${workDay}))`,
    `(0||6(${workDay}))`,
    `(0||7${offDay})`,
  ].join(" ");
  return `(0||CalendarData()( (0||DaysOfWeek()( ${days})) (0||VIEW(ShowTotal|Y)()) (0||Exceptions())))`;
}

/**
 * Build complete XER file content string.
 */
export function buildXER(tasks, options = {}) {
  const {
    version     = "15.1",
    projectId   = "PROJ001",
    projectName = "Exported Project",
    calendarName = "Standard",
    exportDate  = new Date().toISOString().slice(0, 10),
    mapping     = null,
    sourceTables = null,
  } = options;

  // Resolved mapping with defaults
  const map = {
    task_code:            "activityId",
    task_name:            "activity",
    task_code_prefix:     "",
    task_code_fallback:   "auto",
    date_source:          "startEnd",
    skip_no_dates:        true,
    wbs_short_name_mode:  "ascii_truncate",
    duration_unit:        "hours8",
    ...( mapping || {} ),
  };

  const lines = [];
  const ts = p6dt(exportDate, "08:00");

  // ── Pass-through mode ──────────────────────────────────────────────────────
  // When the project was imported from an XER we still have its original tables:
  // write them back VERBATIM and only touch what the user actually changed. This is
  // what makes XER → XER round trips lossless (previously every table outside the
  // fixed generator list was dropped and precision was lost on re-computed fields).
  if (sourceTables && Object.keys(sourceTables).length) {
    return buildXERPassThrough(tasks, { version, projectId, projectName, calendarName, exportDate, hrsPerDay: (mapping?.duration_unit === "hours1" ? 1 : 8), sourceTables });
  }

  // ── ERMHDR ─────────────────────────────────────────────────────────────────
  // XER files contain no blank lines: every line belongs to the header line or a
  // table block (see the %E terminator pushed after each table).
  lines.push(`ERMHDR\t${version}\t${exportDate}\tProject\tADMIN\tUser\tdbxDatabaseNoName\tProject Management\tUSD`);

  // ── IDs ────────────────────────────────────────────────────────────────────
  const CURR_ID  = "1";
  const CAL_ID   = "1";
  const PROJ_ID  = "1";
  const ROOT_WBS = "1";
  const OBS_ID   = "1";

  // ── CURRTYPE ───────────────────────────────────────────────────────────────
  // Field order from reference XER (11 fields, no curr_name/base_flag/curr_rate/curr_scale)
  lines.push(...tableHeader("CURRTYPE", [
    "curr_id","decimal_digit_cnt","curr_symbol","decimal_symbol","digit_group_symbol",
    "pos_curr_fmt_type","neg_curr_fmt_type","curr_type","curr_short_name","group_digit_cnt","base_exch_rate",
  ]));
  lines.push(row(CURR_ID, "2", "$", ".", ",", "#1.1", "(#1.1)", "US Dollar", "USD", "3", "1"));
  lines.push("%E");

  // ── FINTMPL ────────────────────────────────────────────────────────────────
  lines.push(...tableHeader("FINTMPL", [
    "fintmpl_id","fintmpl_name","default_flag",
  ]));
  lines.push(row("1", "Calendar", "Y"));
  lines.push("%E");

  // ── OBS ────────────────────────────────────────────────────────────────────
  // Field order from reference: obs_id, parent_obs_id, guid, seq_num, obs_name, obs_descr
  lines.push(...tableHeader("OBS", [
    "obs_id","parent_obs_id","guid","seq_num","obs_name","obs_descr",
  ]));
  lines.push(row(OBS_ID, "0", "", "0", "Enterprise", ""));
  lines.push("%E");

  // ── UDFTYPE ────────────────────────────────────────────────────────────────
  // Reference includes export_flag as last field
  lines.push(...tableHeader("UDFTYPE", [
    "udf_type_id","table_name","udf_type_name","udf_type_label","logical_data_type",
    "super_flag","indicator_expression","summary_indicator_expression","export_flag",
  ]));
  lines.push("%E");

  // ── PROJECT ────────────────────────────────────────────────────────────────
  const hrsPerDay = map.duration_unit === "hours1" ? 1 : 8;

  const taskItems = tasks.filter(t => {
    if (t.isSection) return false;
    const s = map.date_source === "baselineStartEnd" ? (t.baselineStart || t.start) : t.start;
    return s && s.length === 10;
  });
  const starts = taskItems.map(t => map.date_source === "baselineStartEnd" ? (t.baselineStart || t.start) : t.start).sort();
  const ends   = taskItems.map(t => map.date_source === "baselineStartEnd" ? (t.baselineFinish || t.end || t.start) : (t.end || t.start)).sort().reverse();
  const projStart = p6dt(starts[0] || exportDate, "00:00");
  const projEnd   = p6dt(ends[0]   || exportDate, "17:00");
  const projShortName = projectId.slice(0, 20).replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_") || "PROJECT";

  // Field order exactly as reference XER PROJECT row
  lines.push(...tableHeader("PROJECT", [
    "proj_id","fy_start_month_num","rsrc_self_add_flag","allow_complete_flag",
    "rsrc_multi_assign_flag","checkout_flag","project_flag","step_complete_flag",
    "cost_qty_recalc_flag","batch_sum_flag","name_sep_char","def_complete_pct_type",
    "proj_short_name","acct_id","orig_proj_id","source_proj_id","base_type_id",
    "clndr_id","sum_base_proj_id","task_code_base","task_code_step","priority_num",
    "wbs_max_sum_level","strgy_priority_num","last_checksum","critical_drtn_hr_cnt",
    "def_cost_per_qty","last_recalc_date","plan_start_date","plan_end_date",
    "scd_end_date","add_date","last_tasksum_date","fcst_start_date","def_duration_type",
    "task_code_prefix","guid","def_qty_type","add_by_name","web_local_root_path",
    "proj_url","def_rate_type","add_act_remain_flag","act_this_per_link_flag",
    "def_task_type","act_pct_link_flag","critical_path_type","task_code_prefix_flag",
    "def_rollup_dates_flag","use_project_baseline_flag","rem_target_link_flag",
    "reset_planned_flag","allow_neg_act_flag","sum_assign_level","last_fin_dates_id",
    "fintmpl_id","last_baseline_update_date","cr_external_key","apply_actuals_date",
    "location_id","loaded_scope_level","export_flag","new_fin_dates_id",
    "baselines_to_export","baseline_names_to_export","next_data_date","close_period_flag",
    "sum_refresh_date","trsrcsum_loaded","sumtask_loaded",
  ]));

  lines.push(row(
    PROJ_ID,          // proj_id
    "1",              // fy_start_month_num
    "Y",              // rsrc_self_add_flag
    "Y",              // allow_complete_flag
    "Y",              // rsrc_multi_assign_flag
    "N",              // checkout_flag
    "Y",              // project_flag
    "N",              // step_complete_flag
    "N",              // cost_qty_recalc_flag
    "Y",              // batch_sum_flag
    ".",              // name_sep_char
    "CP_Drtn",        // def_complete_pct_type (reference uses CP_Drtn)
    projShortName,    // proj_short_name
    "",               // acct_id
    "",               // orig_proj_id
    "",               // source_proj_id
    "",               // base_type_id
    CAL_ID,           // clndr_id
    "",               // sum_base_proj_id
    "1000",           // task_code_base
    "10",             // task_code_step
    "10",             // priority_num
    "2",              // wbs_max_sum_level (reference: 2)
    "500",            // strgy_priority_num
    "",               // last_checksum
    "0",              // critical_drtn_hr_cnt
    "0.0000",         // def_cost_per_qty (reference uses 0.0000)
    ts,               // last_recalc_date
    projStart,        // plan_start_date
    projEnd,          // plan_end_date
    projEnd,          // scd_end_date
    ts,               // add_date
    "",               // last_tasksum_date (reference often blank)
    "",               // fcst_start_date
    "DT_FixedDUR2",   // def_duration_type (reference: DT_FixedDUR2)
    "",               // task_code_prefix
    "",               // guid
    "QT_Hour",        // def_qty_type
    "Admin",          // add_by_name
    "",               // web_local_root_path
    "",               // proj_url
    "RT_Std",         // def_rate_type — not in reference but safe default
    "N",              // add_act_remain_flag
    "Y",              // act_this_per_link_flag
    "TT_Task",        // def_task_type
    "Y",              // act_pct_link_flag
    "CT_TotFloat",    // critical_path_type (reference: CT_TotFloat)
    "N",              // task_code_prefix_flag
    "Y",              // def_rollup_dates_flag
    "Y",              // use_project_baseline_flag
    "Y",              // rem_target_link_flag
    "N",              // reset_planned_flag
    "N",              // allow_neg_act_flag
    "SL_Taskrsrc",    // sum_assign_level (reference: SL_Taskrsrc)
    "",               // last_fin_dates_id
    "1",              // fintmpl_id  ← reference has this BEFORE last_baseline_update_date
    "",               // last_baseline_update_date
    "",               // cr_external_key
    "",               // apply_actuals_date
    "",               // location_id
    "",               // loaded_scope_level
    "Y",              // export_flag
    "",               // new_fin_dates_id
    "",               // baselines_to_export
    "",               // baseline_names_to_export
    p6dt(exportDate, "08:00"), // next_data_date
    "N",              // close_period_flag
    "",               // sum_refresh_date
    "N",              // trsrcsum_loaded
    "N",              // sumtask_loaded
  ));
  lines.push("%E");

  // ── APPLYACTOPTIONS ────────────────────────────────────────────────────────
  // Present in reference XER; P6 Professional requires it for scheduling options
  lines.push(...tableHeader("APPLYACTOPTIONS", [
    "proj_id","respect_duration_type",
  ]));
  lines.push(row(PROJ_ID, "N"));
  lines.push("%E");

  // ── CALENDAR ───────────────────────────────────────────────────────────────
  const calData = makeCalendarData();
  lines.push(...tableHeader("CALENDAR", [
    "clndr_id","default_flag","clndr_name","proj_id","base_clndr_id",
    "last_chng_date","clndr_type","day_hr_cnt","week_hr_cnt",
    "month_hr_cnt","year_hr_cnt","rsrc_private","clndr_data",
  ]));
  lines.push(row(
    CAL_ID,       // clndr_id
    "Y",          // default_flag
    calendarName, // clndr_name
    "",           // proj_id (empty = global calendar)
    "",           // base_clndr_id
    ts,           // last_chng_date
    "CA_Base",    // clndr_type
    "8",          // day_hr_cnt
    "40",         // week_hr_cnt
    "172",        // month_hr_cnt
    "2080",       // year_hr_cnt
    "N",          // rsrc_private
    calData,      // clndr_data
  ));
  lines.push("%E");

  // ── PROJWBS ────────────────────────────────────────────────────────────────
  lines.push(...tableHeader("PROJWBS", [
    "wbs_id","proj_id","obs_id","seq_num","est_wt","proj_node_flag",
    "sum_data_flag","status_code","wbs_short_name","wbs_name",
    "phase_id","parent_wbs_id","ev_user_pct","ev_etc_user_value",
    "orig_cost","indep_remain_total_cost","ann_dscnt_rate_pct","dscnt_period_type",
    "indep_remain_work_qty","anticip_start_date","anticip_end_date",
    "ev_compute_type","ev_etc_compute_type","guid","tmpl_guid","orig_proj_id",
  ]));

  // Root WBS node
  lines.push(row(
    ROOT_WBS, PROJ_ID, OBS_ID, "0", "1", "Y",
    "N", "WS_Open", projShortName, projectName,
    "", "", "0", "0", "0", "0", "0", "DP_Year", "0", "", "", "EC_Act", "EE_Act", "", "", "",
  ));

  // Section WBS nodes
  const sectionWbsIds = {};
  let wbsCounter = 2;
  let secIdx = 0;
  tasks.forEach((t) => {
    if (t.isSection) {
      const wbsId = String(wbsCounter++);
      sectionWbsIds[secIdx] = wbsId;
      const sname = (t.activity || `WBS${secIdx}`).slice(0, 40).replace(/\t/g, " ");
      const sshort = map.wbs_short_name_mode === "index"
        ? `WBS${secIdx + 1}`
        : (sname.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_").slice(0, 20) || `WBS${secIdx + 1}`);
      lines.push(row(
        wbsId, PROJ_ID, OBS_ID, String(secIdx * 10), "1", "N",
        "N", "WS_Open", sshort, sname,
        "", ROOT_WBS, "0", "0", "0", "0", "0", "DP_Year", "0", "", "", "EC_Act", "EE_Act", "", "", "",
      ));
      secIdx++;
    }
  });
  lines.push("%E");

  // ── TASK ───────────────────────────────────────────────────────────────────
  lines.push(...tableHeader("TASK", [
    "task_id","proj_id","wbs_id","clndr_id","phys_complete_pct",
    "rev_fdbk_flag","est_wt","lock_plan_flag","auto_compute_act_flag",
    "complete_pct_type","task_type","duration_type","status_code",
    "task_code","task_name","rsrc_id","total_float_hr_cnt","free_float_hr_cnt",
    "remain_drtn_hr_cnt","act_work_qty","remain_work_qty","target_work_qty",
    "target_drtn_hr_cnt","target_equip_qty","act_equip_qty","remain_equip_qty",
    "cstr_date","act_start_date","act_end_date","late_start_date",
    "late_end_date","expect_end_date","early_start_date","early_end_date",
    "restart_date","reend_date","target_start_date","target_end_date",
    "rem_late_start_date","rem_late_end_date","cstr_type","priority_type",
    "suspend_date","resume_date","float_path","float_path_order",
    "guid","tmpl_guid","cstr_date2","cstr_type2","driving_path_flag",
    "act_this_per_work_qty","act_this_per_equip_qty","external_early_start_date",
    "external_late_end_date","create_date","update_date","create_user",
    "update_user","location_id",
  ]));

  let taskCounter = 1;
  let curSecIdx = -1;
  let curWbsId = ROOT_WBS;
  // Stable identity for a task: its app id when present, else its activity code.
  // (Freshly parsed XER rows have no `id` yet — GanttPage assigns ids during import.)
  const keyOf = (t) => (t.id != null && t.id !== "" ? `id:${t.id}` : `code:${String(t.activityId || "").trim().toLowerCase()}`);
  // identity key → XER task_id of the exported TASK row (needed for TASKPRED)
  const xerTaskIdByKey = new Map();
  const keyById = new Map();
  const keyByCode = new Map();
  tasks.forEach((t) => {
    if (t.isSection) return;
    const k = keyOf(t);
    if (t.id != null && t.id !== "") keyById.set(String(t.id), k);
    if (t.activityId) keyByCode.set(String(t.activityId).trim().toLowerCase(), k);
  });

  tasks.forEach((t) => {
    if (t.isSection) {
      curSecIdx++;
      curWbsId = sectionWbsIds[curSecIdx] || ROOT_WBS;
      return;
    }

    const mappedStart = map.date_source === "baselineStartEnd" ? (t.baselineStart || t.start || "") : (t.start || "");
    const mappedEnd   = map.date_source === "baselineStartEnd" ? (t.baselineFinish || t.end || "") : (t.end || "");

    if (map.skip_no_dates && !mappedStart && !mappedEnd) return;

    // Milestone detection
    const isStartMile  = !!mappedStart && !mappedEnd;
    const isFinishMile = !mappedStart && !!mappedEnd;
    const isMilestone  = isStartMile || isFinishMile;
    const mileDate     = isStartMile ? mappedStart : mappedEnd;

    const taskId = String(taskCounter++);
    xerTaskIdByKey.set(keyOf(t), taskId);

    // Resolve task_code
    let rawCode = "";
    if (map.task_code === "activityId")  rawCode = (t.activityId || "").replace(/\t/g, "").trim();
    else if (map.task_code === "item")   rawCode = (t.item || t._resolvedItem || t.customItem || "").replace(/\t/g, "").trim();
    else if (map.task_code === "activity") rawCode = (t.activity || "").replace(/\t/g, "").trim().slice(0, 20);
    if (map.task_code_prefix) rawCode = map.task_code_prefix + rawCode;
    if (!rawCode) {
      rawCode = map.task_code_fallback === "item"
        ? (t.item || t._resolvedItem || t.customItem || `A${String(taskCounter - 1).padStart(4, "0")}`)
        : `A${String(taskCounter - 1).padStart(4, "0")}`;
    }
    if (/^\d+$/.test(rawCode)) rawCode = "A" + rawCode;
    const taskCode = rawCode;

    // Resolve task_name
    let taskName = "";
    if (map.task_name === "activity")               taskName = (t.activity || "");
    else if (map.task_name === "activityId")        taskName = (t.activityId || "");
    else if (map.task_name === "item")              taskName = (t.item || t._resolvedItem || t.customItem || "");
    else if (map.task_name === "activityId_activity") taskName = [t.activityId, t.activity].filter(Boolean).join(" - ");
    taskName = taskName.replace(/\t/g, " ");

    const orig = t._originalXerData || {};

    // Dates: milestones use the single date for both start and end
    const tStart = isMilestone ? p6dt(mileDate, "08:00") : p6dt(mappedStart, "08:00");
    const tEnd   = isMilestone ? p6dt(mileDate, "17:00") : p6dt(mappedEnd,   "17:00");
    const aStart = t.startActual ? p6dt(isMilestone ? mileDate : mappedStart, "08:00") : (orig.act_start_date || "");
    const aEnd   = t.endActual   ? p6dt(isMilestone ? mileDate : mappedEnd,   "17:00") : (orig.act_end_date   || "");

    const dDays  = isMilestone ? 0 : calDays(mappedStart, mappedEnd || mappedStart);
    const durHr  = String(dDays * hrsPerDay);
    // Use actual remainDur (converted to hours) if available, else XER original or computed
    const remDurHr = t.endActual ? "0"
      : (t.remainDur != null ? String(t.remainDur * hrsPerDay) : (orig.remain_drtn_hr_cnt || durHr));

    const statusCode = t.endActual ? "TK_Complete" : t.startActual ? "TK_Active" : (orig.status_code || "TK_NotStart");
    // Use actual pct if available, else derived from actuals, else XER original
    const pct = t.pct != null ? String(t.pct)
      : t.endActual ? "100"
      : t.startActual ? "50"
      : (orig.phys_complete_pct || "0");
    const taskType   = isMilestone
      ? (isFinishMile ? "TT_FinMile" : "TT_Mile")
      : (orig.task_type || "TT_Task");

    lines.push(row(
      taskId,
      PROJ_ID,
      curWbsId,
      CAL_ID,
      pct,
      orig.rev_fdbk_flag        || "N",
      orig.est_wt               || "1",
      orig.lock_plan_flag       || "N",
      orig.auto_compute_act_flag || "N",
      orig.complete_pct_type    || "CP_Drtn",
      taskType,
      orig.duration_type        || "DT_FixedDUR2",
      statusCode,
      taskCode,
      taskName,
      orig.rsrc_id              || "",
      // Use actual float (converted to hours) if available, else XER original
      (t.float != null ? String(t.float * hrsPerDay) : orig.total_float_hr_cnt) || "0",
      orig.free_float_hr_cnt    || "0",
      remDurHr,
      orig.act_work_qty         || "0",
      orig.remain_work_qty      || "0",
      orig.target_work_qty      || "0",
      durHr,
      orig.target_equip_qty     || "0",
      orig.act_equip_qty        || "0",
      orig.remain_equip_qty     || "0",
      orig.cstr_date            || "",
      aStart,
      aEnd,
      orig.late_start_date      || tStart,
      orig.late_end_date        || tEnd,
      orig.expect_end_date      || "",
      orig.early_start_date     || tStart,
      orig.early_end_date       || tEnd,
      orig.restart_date         || tStart,
      orig.reend_date           || tEnd,
      tStart,
      tEnd,
      orig.rem_late_start_date  || tStart,
      orig.rem_late_end_date    || tEnd,
      orig.cstr_type            || "",
      orig.priority_type        || "PT_Normal",
      orig.suspend_date         || "",
      orig.resume_date          || "",
      orig.float_path           || "0",
      orig.float_path_order     || "0",
      orig.guid                 || "",
      orig.tmpl_guid            || "",
      orig.cstr_date2           || "",
      orig.cstr_type2           || "",
      orig.driving_path_flag    || "N",
      orig.act_this_per_work_qty  || "0",
      orig.act_this_per_equip_qty || "0",
      orig.external_early_start_date || "",
      orig.external_late_end_date    || "",
      ts,
      ts,
      orig.create_user          || "Admin",
      orig.update_user          || "Admin",
      orig.location_id          || "",
    ));
  });
  lines.push("%E");

  // ── TASKPRED (relationships) ───────────────────────────────────────────────
  // One %R row per exported relationship. In XER, TASKPRED.task_id is the SUCCESSOR
  // and TASKPRED.pred_task_id is the PREDECESSOR (matching parseXER's reader).
  // Only edges where BOTH ends were exported into TASK get a row — tasks without
  // dates are skipped from TASK (skip_no_dates), so they have no task_id to point at.
  lines.push(...tableHeader("TASKPRED", [
    "task_pred_id","task_id","pred_task_id","proj_id","pred_proj_id",
    "pred_type","lag_hr_cnt","float_path","aref","arls",
  ]));
  let predCounter = 1;
  const seenEdges = new Set();
  // Resolve an edge's successor to the identity key of the matching task
  const resolveSuccKey = (e) => {
    if (e.succId != null && e.succId !== "") {
      const byId = keyById.get(String(e.succId));
      if (byId) return byId;
    }
    if (e.succCode) return keyByCode.get(String(e.succCode).trim().toLowerCase()) || null;
    return null;
  };
  tasks.forEach((t) => {
    if (t.isSection) return;
    const edges = outgoingEdges(t);
    if (!edges.length) return;
    const predXerId = xerTaskIdByKey.get(keyOf(t));
    if (!predXerId) return;
    edges.forEach((e) => {
      const succKey = resolveSuccKey(e);
      const succXerId = succKey ? xerTaskIdByKey.get(succKey) : null;
      if (!succXerId || succXerId === predXerId) return;   // unresolvable / self-link / not exported
      const key = `${predXerId}>${succXerId}`;
      if (seenEdges.has(key)) return;                      // no duplicate edges
      seenEdges.add(key);
      lines.push(row(
        String(predCounter++),
        succXerId,                       // task_id      = successor
        predXerId,                       // pred_task_id = predecessor
        PROJ_ID,
        PROJ_ID,                         // pred_proj_id
        `PR_${e.type}`,                  // PR_FS / PR_SS / PR_FF / PR_SF
        String(Math.round(e.lag * hrsPerDay)),  // lag stored in HOURS by P6
        "0", "", "",
      ));
    });
  });
  lines.push("%E");

  // ── TASKRSRC ───────────────────────────────────────────────────────────────
  lines.push(...tableHeader("TASKRSRC", [
    "taskrsrc_id","task_id","proj_id","cost_qty_link_flag","role_id",
    "acct_id","rsrc_id","pobs_id","skill_level","remain_qty",
    "target_qty","act_reg_qty","act_ot_qty","target_cost",
    "act_reg_cost","act_ot_cost","remain_cost","act_start_date",
    "act_end_date","restart_date","reend_date","target_start_date",
    "target_end_date","rem_late_start_date","rem_late_end_date",
    "rollup_dates_flag","target_crv","remain_crv","actual_crv",
    "ts_pend_act_end_flag","guid","rate_type","act_this_per_qty",
    "curv_id","auto_compute_act_flag","has_rsrchrs_flag",
  ]));
  lines.push("%E");

  // ── TASKACTV ───────────────────────────────────────────────────────────────
  lines.push(...tableHeader("TASKACTV", [
    "task_id","actv_code_type_id","actv_code_id","proj_id",
  ]));
  lines.push("%E");

  // ── UDFVALUE ───────────────────────────────────────────────────────────────
  lines.push(...tableHeader("UDFVALUE", [
    "udf_type_id","fk_id","proj_id","udf_date","udf_number",
    "udf_text","udf_code_id","change_date",
  ]));
  lines.push("%E");

  // ── End of file ─────────────────────────────────────────────────────────────
  // Every table above is already closed by its own %E terminator (P6 XER files have
  // no blank lines and no extra terminator at the end). Trailing newline kept.
  return lines.join("\r\n") + "\r\n";
}

export { P6_VERSIONS };

// ─────────────────────────────────────────────────────────────────────────────
//  Pass-through export (lossless XER → XER)
//
//  Design: the imported file's tables are the source of truth. We write every table
//  back verbatim, in its original order, and only:
//    · TASK      — drop rows for deleted activities, update rows for edited ones
//                  (keeping their original task_id so other tables stay valid),
//                  append generated rows for new activities
//    · TASKPRED  — keep rows verbatim while an activity's links are unchanged,
//                  regenerate just the changed ones
//    · PROJWBS   — same treatment for WBS nodes (original ids/parents kept)
//    · PROJECT   — original row; only name / proj_id / data-date are applied
//    · every other table (CALENDAR, RSRC, ACTVCODE, TASKRSRC, UDFVALUE, notes, …)
//                — byte-for-byte verbatim
// ─────────────────────────────────────────────────────────────────────────────

const datePart = (v) => String(v || "").trim().slice(0, 10);
const numOrNull = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
};
const hrsToDays = (v) => { const n = numOrNull(v); return n == null ? null : Math.round(n / 8); };

/** Was this activity left untouched since the XER import? (compared field by field) */
function isTaskUnchanged(t, r) {
  if (datePart(t.start) !== datePart(r.early_start_date || r.target_start_date || r.act_start_date)) return false;
  if (datePart(t.end) !== datePart(r.early_end_date || r.target_end_date || r.act_end_date)) return false;
  if (String(t.activityId || "") !== String(r.task_code || "")) return false;
  if (String(t.activity || "") !== String(r.task_name || "")) return false;
  if (!!t.startActual !== !!(r.act_start_date && String(r.act_start_date).trim())) return false;
  if (!!t.endActual !== !!(r.act_end_date && String(r.act_end_date).trim())) return false;
  if (t.remainDur != null && t.remainDur !== hrsToDays(r.remain_drtn_hr_cnt)) return false;
  if (t.float != null && t.float !== hrsToDays(r.total_float_hr_cnt)) return false;
  if (t.pct != null && Number(t.pct) !== Number(r.phys_complete_pct || 0)) return false;
  if (datePart(t.baselineStart) !== datePart(r.primary_base_start_date || r.secondary_base_start_date || r.base_start_date)) return false;
  if (datePart(t.baselineFinish) !== datePart(r.primary_base_end_date || r.secondary_base_end_date || r.base_end_date)) return false;
  return true;
}

/** Copy the original TASK row and overwrite only what the app owns. */
function applyAppEdits(appTask, r, ctx) {
  const { fields, hrsPerDay, wbsIdFor, origProjId } = ctx;
  const out = { ...r };
  const set = (f, v) => { if (fields.includes(f)) out[f] = v; };
  const isStartMile = !!appTask.start && !appTask.end;
  const isFinishMile = !appTask.start && !!appTask.end;
  const isMile = isStartMile || isFinishMile;
  const mileDate = isStartMile ? appTask.start : appTask.end;
  const tS = isMile ? p6dt(mileDate, "08:00") : p6dt(appTask.start, "08:00");
  const tE = isMile ? p6dt(mileDate, "17:00") : p6dt(appTask.end, "17:00");
  // identity / labels owned by the app
  if (fields.includes("task_code") && appTask.activityId) out.task_code = appTask.activityId;
  if (fields.includes("task_name")) out.task_name = appTask.activity || "";
  // dates (early/target always; actual only when flagged)
  set("early_start_date", tS);
  set("early_end_date", tE);
  set("target_start_date", tS);
  set("target_end_date", tE);
  if (appTask.startActual) set("act_start_date", tS); else if (fields.includes("act_start_date")) out.act_start_date = "";
  if (appTask.endActual) set("act_end_date", tE); else if (fields.includes("act_end_date")) out.act_end_date = "";
  // baseline (only when the app has values)
  if (appTask.baselineStart) set("primary_base_start_date", p6dt(appTask.baselineStart, "08:00"));
  if (appTask.baselineFinish) set("primary_base_end_date", p6dt(appTask.baselineFinish, "17:00"));
  // progress / durations / float
  if (appTask.pct != null) set("phys_complete_pct", String(appTask.pct));
  if (appTask.remainDur != null) set("remain_drtn_hr_cnt", String(appTask.remainDur * hrsPerDay));
  if (appTask.float != null) set("total_float_hr_cnt", String(appTask.float * hrsPerDay));
  else if (appTask.float === 0) set("total_float_hr_cnt", "0");
  if (appTask.start || appTask.end) {
    const days = isMile ? 0 : calDays(appTask.start, appTask.end || appTask.start);
    set("target_drtn_hr_cnt", String(days * hrsPerDay));
    if (!appTask.endActual && fields.includes("remain_drtn_hr_cnt") && appTask.remainDur == null) {
      out.remain_drtn_hr_cnt = String(days * hrsPerDay);
    }
  }
  // type / status
  set("task_type", isMile ? (isFinishMile ? "TT_FinMile" : "TT_Mile") : (r.task_type || "TT_Task"));
  set("status_code", appTask.endActual ? "TK_Complete" : appTask.startActual ? "TK_Active" : (r.status_code || "TK_NotStart"));
  if (appTask.drivingPathFlag) set("driving_path_flag", appTask.drivingPathFlag);
  // identity kept: task_id / clndr_id / proj_id / guid unchanged; only the owning WBS may move
  const wbsId = wbsIdFor(appTask);
  if (wbsId) set("wbs_id", wbsId);
  return out;
}

/**
 * Lossless XER → XER export. `sourceTables` is the raw table map captured at import
 * (see `parseXerTables`). Returns the full XER file text.
 */
export function buildXERPassThrough(tasks, { version, projectId, projectName, exportDate, hrsPerDay = 8, sourceTables }) {
  const src = sourceTables;
  // parseXerTables returns { NAME: [rowObj, …] }; row objects keep the original column
  // order as their key order, so the %F field list can be recovered from row 0.
  const norm = (name) => {
    const t = src[name];
    if (!t) return { fields: [], rows: [] };
    if (Array.isArray(t)) return { fields: t.length ? Object.keys(t[0]) : [], rows: t };
    return { fields: t.fields || (t.rows?.length ? Object.keys(t.rows[0]) : []), rows: t.rows || [] };
  };
  const srcTask = norm("TASK");
  const srcPred = norm("TASKPRED");
  const srcWbs = norm("PROJWBS");
  const srcProj = norm("PROJECT");
  const srcCal = norm("CALENDAR");

  const origProjId = String(srcProj.rows[0]?.proj_id ?? "1");
  // NOTE: PROJECT.proj_id is P6's internal id — keep it untouched so every table that
  // references it stays valid. The dialog's "Project ID" is proj_short_name (the value
  // P6 shows in its UI), and the project *name* lives on the root WBS node.
  const outProjId = origProjId;
  const ts = p6dt(exportDate, "08:00");

  const appTasks = tasks.filter(t => !t.isSection);
  const sections = tasks.filter(t => t.isSection);

  // ── identity maps ──────────────────────────────────────────────────────────
  // Activities parsed straight from an XER have no app `id` yet (GanttPage assigns
  // ids during import), so identity is "app id if present, else activity code".
  const taskKey = (t) => (t.id != null && t.id !== "" ? `id:${t.id}` : `code:${String(t.activityId || "").trim().toLowerCase()}`);
  const origTaskIdByAppId = new Map();     // app id → original XER task_id
  const keyByAppId = new Map();            // app id → identity key
  const taskByOrigId = new Map();          // original XER task_id → app task
  appTasks.forEach((t) => {
    const oid = t._originalXerData?.task_id || t.p6TaskId;
    if (t.id != null && t.id !== "") keyByAppId.set(String(t.id), taskKey(t));
    if (oid) {
      taskByOrigId.set(String(oid), t);
      if (t.id != null && t.id !== "") origTaskIdByAppId.set(String(t.id), String(oid));
    }
  });
  const origIdOf = (appTaskId) => origTaskIdByAppId.get(String(appTaskId)) || null;
  const origIdByCode = new Map();          // activity code → original XER task_id
  appTasks.forEach((t) => {
    const oid = t._originalXerData?.task_id || t.p6TaskId;
    if (oid && t.activityId) origIdByCode.set(String(t.activityId).trim().toLowerCase(), String(oid));
  });
  /** Edges of an app task resolved to ORIGINAL task ids where possible (for comparison). */
  const edgeKeysResolved = (task) => outgoingEdges(task).map((e) => {
    let succ = e.succId != null ? origIdOf(e.succId) : null;
    if (!succ && e.succCode) succ = origIdByCode.get(String(e.succCode).trim().toLowerCase()) || null;
    if (!succ) succ = `code:${String(e.succCode || "").toLowerCase()}`;
    return `${e.type}|${Math.round(e.lag * 8)}|${succ}`;
  }).sort();
  const sectionKey = (s) => (s.id != null && s.id !== "" ? `id:${s.id}` : `wbs:${String(s.p6WbsId || "")}`);
  const sectionByOrigWbsId = new Map();
  sections.forEach(s => { if (s.p6WbsId) sectionByOrigWbsId.set(String(s.p6WbsId), s); });
  const sectionOfTask = new Map();
  { let cur = null; for (const t of tasks) { if (t.isSection) cur = t; else sectionOfTask.set(taskKey(t), cur); } }

  const rootWbsId = String(srcWbs.rows.find(r => r.proj_node_flag === "Y")?.wbs_id ?? srcWbs.rows[0]?.wbs_id ?? "1");

  // ── PROJWBS: keep original rows, add new sections, update renamed ones ─────
  const rowObj = (fields, vals) => Object.fromEntries(fields.map((f, i) => [f, vals[i] ?? ""]));

  let nextWbsId = (() => {
    const nums = srcWbs.rows.map(r => Number(r.wbs_id)).filter(n => !Number.isNaN(n));
    return nums.length ? Math.max(...nums) + 1 : 2;
  })();
  const newWbsIdBySection = new Map();
  const wbsRows = [];
  const wbsFields = srcWbs.fields.length ? srcWbs.fields : ["wbs_id", "proj_id", "obs_id", "seq_num", "proj_node_flag", "sum_data_flag", "status_code", "wbs_short_name", "wbs_name", "parent_wbs_id"];
  for (const r of srcWbs.rows) {
    const sec = sectionByOrigWbsId.get(String(r.wbs_id));
    if (!sec) continue;                                     // WBS node deleted in the app
    const name = String(sec.activity ?? "");
    const row = { ...r };
    if (name && name !== String(r.wbs_name ?? "")) row.wbs_name = name;
    wbsRows.push(row);
  }
  for (const s of sections) {
    if (s.p6WbsId && sectionByOrigWbsId.has(String(s.p6WbsId))) continue;   // already written
    const id = String(nextWbsId++);
    newWbsIdBySection.set(sectionKey(s), id);
    const row = rowObj(wbsFields, []);
    row.wbs_id = id;
    row.proj_id = outProjId;
    row.obs_id = srcWbs.rows[0]?.obs_id ?? "1";
    row.seq_num = "0";
    row.proj_node_flag = "N";
    row.sum_data_flag = "N";
    row.status_code = "WS_Open";
    row.wbs_short_name = String(s.activity || `WBS${id}`).replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_").slice(0, 20);
    row.wbs_name = String(s.activity || "");
    row.parent_wbs_id = rootWbsId;
    wbsRows.push(row);
  }
  const wbsIdForTask = (appTask) => {
    const sec = sectionOfTask.get(taskKey(appTask));
    if (!sec) return rootWbsId;
    if (sec.p6WbsId && sectionByOrigWbsId.has(String(sec.p6WbsId))) return String(sec.p6WbsId);
    return newWbsIdBySection.get(sectionKey(sec)) || rootWbsId;
  };

  // ── TASK: verbatim for untouched activities, edited copy for changed ones ──
  const taskFields = srcTask.fields;
  const defaultClndrId = String(srcTask.rows.find(r => r.clndr_id)?.clndr_id ?? srcCal.rows.find(r => r.default_flag === "Y")?.clndr_id ?? srcCal.rows[0]?.clndr_id ?? "1");
  const nextNumeric = (rows, col, fallback) => {
    const nums = rows.map(r => Number(r[col])).filter(n => !Number.isNaN(n));
    return nums.length ? Math.max(...nums) + 1 : fallback;
  };
  let nextTaskId = nextNumeric(srcTask.rows, "task_id", 1);
  const taskRows = [];
  const xerIdByKey = new Map();                               // identity key → XER task_id
  const editCtx = { fields: taskFields, hrsPerDay, wbsIdFor: wbsIdForTask, origProjId, outProjId };
  for (const r of srcTask.rows) {
    const app = taskByOrigId.get(String(r.task_id));
    if (!app) continue;                                       // activity deleted in the app
    xerIdByKey.set(taskKey(app), String(r.task_id));
    const out = isTaskUnchanged(app, r) ? { ...r } : applyAppEdits(app, r, editCtx);
    taskRows.push(out);
  }
  for (const t of appTasks) {                                 // activities added in the app
    if (xerIdByKey.has(taskKey(t))) continue;
    const id = String(nextTaskId++);
    xerIdByKey.set(taskKey(t), id);
    const o = rowObj(taskFields, []);
    const isStartMile = !!t.start && !t.end, isFinishMile = !t.start && !!t.end;
    const isMile = isStartMile || isFinishMile;
    const mileDate = isStartMile ? t.start : t.end;
    const tS = isMile ? p6dt(mileDate, "08:00") : p6dt(t.start, "08:00");
    const tE = isMile ? p6dt(mileDate, "17:00") : p6dt(t.end, "17:00");
    const days = isMile ? 0 : calDays(t.start, t.end || t.start);
    Object.assign(o, {
      task_id: id, proj_id: outProjId, wbs_id: wbsIdForTask(t), clndr_id: defaultClndrId,
      phys_complete_pct: t.pct != null ? String(t.pct) : "0",
      complete_pct_type: "CP_Drtn", status_code: t.endActual ? "TK_Complete" : t.startActual ? "TK_Active" : "TK_NotStart",
      task_code: t.activityId || `A${id}`, task_name: t.activity || "",
      task_type: isMile ? (isFinishMile ? "TT_FinMile" : "TT_Mile") : "TT_Task",
      duration_type: t.durationType || "DT_FixedDUR2",
      early_start_date: tS, early_end_date: tE, target_start_date: tS, target_end_date: tE,
      target_drtn_hr_cnt: String(days * hrsPerDay),
      remain_drtn_hr_cnt: String((t.endActual ? 0 : (t.remainDur != null ? t.remainDur : days)) * hrsPerDay),
      total_float_hr_cnt: String((t.float != null ? t.float : 0) * hrsPerDay),
      driving_path_flag: t.drivingPathFlag || "N",
    });
    if (t.startActual) o.act_start_date = tS;
    if (t.endActual) o.act_end_date = tE;
    if (taskFields.includes("guid")) o.guid = t.p6Guid || "";
    taskRows.push(o);
  }
  const xerIdOfAppId = (appId) => {
    const k = keyByAppId.get(String(appId));
    return k ? xerIdByKey.get(k) || null : null;
  };                                                          // app id (when it exists) → XER task_id

  // ── TASKPRED: keep original rows while an activity's links are unchanged ───
  const predFields = srcPred.fields.length ? srcPred.fields : [
    "task_pred_id", "task_id", "pred_task_id", "proj_id", "pred_proj_id",
    "pred_type", "lag_hr_cnt", "float_path", "aref", "arls",
  ];
  let predCounter = nextNumeric(srcPred.rows, "task_pred_id", 1);
  const origPredRowsBypred = new Map();
  srcPred.rows.forEach((r) => {
    const k = String(r.pred_task_id);
    if (!origPredRowsBypred.has(k)) origPredRowsBypred.set(k, []);
    origPredRowsBypred.get(k).push(r);
  });
  const predRows = [];
  const codeToXerId = new Map();
  appTasks.forEach((t) => {
    const xid = xerIdByKey.get(taskKey(t));
    if (xid && t.activityId) codeToXerId.set(String(t.activityId).trim().toLowerCase(), xid);
  });
  const pushEdge = (predXerId, e) => {
    const succXerId = (e.succId != null && xerIdOfAppId(e.succId))
      || (e.succCode ? codeToXerId.get(String(e.succCode).trim().toLowerCase()) : null);
    if (!succXerId || succXerId === predXerId) return;
    const o = rowObj(predFields, []);
    o.task_pred_id = String(predCounter++);
    o.task_id = succXerId;                 // successor
    o.pred_task_id = predXerId;            // predecessor
    o.proj_id = outProjId;
    if (predFields.includes("pred_proj_id")) o.pred_proj_id = outProjId;
    o.pred_type = `PR_${e.type}`;
    o.lag_hr_cnt = String(Math.round(e.lag * hrsPerDay));
    if (predFields.includes("float_path")) o.float_path = "0";
    predRows.push(o);
  };
  for (const t of appTasks) {
    const predXerId = xerIdByKey.get(taskKey(t));
    if (!predXerId) continue;
    const rows = origPredRowsBypred.get(String(t._originalXerData?.task_id || t.p6TaskId || "")) || [];
    const origKeys = rows.map(r => `${String(r.pred_type || "").replace(/^PR_/, "")}|${Math.round(numOrNull(r.lag_hr_cnt) ?? 0)}|${String(r.task_id)}`).sort();
    const appKeys = edgeKeysResolved(t);
    const unchanged = rows.length > 0 && origKeys.length === appKeys.length && origKeys.every((k, i) => k === appKeys[i]);
    if (unchanged) { rows.forEach(r => predRows.push({ ...r })); continue; }
    outgoingEdges(t).forEach(e => pushEdge(predXerId, e));
  }

  // ── PROJECT: original row, only user-controlled fields applied ─────────────
  const projFields = srcProj.fields;
  const projRows = srcProj.rows.map(r => ({ ...r }));
  if (projRows[0]) {
    const o = projRows[0];
    // "Project ID" in the dialog = proj_short_name (P6's visible project id)
    if (projFields.includes("proj_short_name") && projectId) {
      const short = String(projectId).slice(0, 20).replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");
      if (short) o.proj_short_name = short;
    }
    if (projFields.includes("last_recalc_date")) o.last_recalc_date = ts;
    if (projFields.includes("next_data_date")) o.next_data_date = ts;
  }
  // Project name lives on the root WBS node in P6
  if (projectName) {
    for (const r of wbsRows) if (String(r.proj_node_flag) === "Y") r.wbs_name = projectName;
  }

  // ── every other table: verbatim (orphaned task rows pruned, proj_id remapped) ─
  const aliveTaskIds = new Set([...xerIdByKey.values()].map(String));
  const otherRows = new Map();
  for (const name of Object.keys(src)) {
    if (["TASK", "TASKPRED", "PROJWBS", "PROJECT"].includes(name)) continue;
    const tbl = norm(name);
    const rows = tbl.rows
      .map(r => ({ ...r }))
      // rows that referenced a deleted activity would be orphans in P6 → prune them
      .filter(r => !tbl.fields.includes("task_id") || aliveTaskIds.has(String(r.task_id)));
    otherRows.set(name, rows);
  }

  // ── serialise, in the original table order ────────────────────────────────
  const lines = [];
  lines.push(`ERMHDR\t${version}\t${exportDate}\tProject\tADMIN\tUser\tdbxDatabaseNoName\tProject Management\tUSD`);
  const emit = (name, fields, rows) => {
    lines.push(`%T\t${name}`);
    lines.push(`%F\t${fields.join("\t")}`);
    rows.forEach(r => lines.push(row(...fields.map(f => r[f] ?? ""))));
    lines.push("%E");
  };
  for (const name of Object.keys(src)) {
    if (name === "TASK") emit("TASK", taskFields, taskRows);
    else if (name === "TASKPRED") emit("TASKPRED", predFields, predRows);
    else if (name === "PROJWBS") emit("PROJWBS", wbsFields, wbsRows);
    else if (name === "PROJECT") emit("PROJECT", projFields, projRows);
    else emit(name, norm(name).fields, otherRows.get(name) || []);
  }
  if (!src.TASKPRED) emit("TASKPRED", predFields, predRows);   // relationships added in the app
  return lines.join("\r\n") + "\r\n";
}




