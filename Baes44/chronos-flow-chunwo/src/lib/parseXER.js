/**
 * Primavera P6 XER file parser
 *
 * XER format:
 *   %T <TABLE_NAME>       – starts a table section
 *   %F <col1>\t<col2>...  – field names (tab-separated)
 *   %R <val1>\t<val2>...  – data rows (tab-separated)
 *   %E                    – end of file
 *
 * Tables parsed: TASK, PROJWBS, PROJECT, TASKPRED
 */

// ── P6 pred_type → link type ─────────────────────────────────────────────
const P6_LINK_TYPE = { PR_FS: "FS", PR_FF: "FF", PR_SS: "SS", PR_SF: "SF" };

// ── Raw table parser ──────────────────────────────────────────────────────
/** Parse every `%T`/`%F`/`%R` block of an XER file into { name: { fields, rows } }. */
export function parseXerTables(text) {
  const tables = {};
  let currentTable = null;
  let currentFields = [];

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("%T\t") || line.startsWith("%T ")) {
      currentTable = line.slice(3).trim();
      currentFields = [];
      if (!tables[currentTable]) tables[currentTable] = [];
    } else if (line.startsWith("%F\t")) {
      // trim() each field name to remove stray whitespace / CR characters
      currentFields = line.slice(3).split("\t").map(f => f.trim());
    } else if (line.startsWith("%R\t") && currentTable) {
      const values = line.slice(3).split("\t");
      const row = {};
      currentFields.forEach((f, i) => { row[f] = (values[i] || "").trim(); });
      tables[currentTable].push(row);
    }
  }
  return tables;
}

// ── Date parser ───────────────────────────────────────────────────────────
function parseP6Date(raw) {
  if (!raw) return "";
  const s = raw.trim();
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const MONTHS = { JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",
                   JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12" };
  const m2 = s.match(/^(\d{1,2})-([A-Z]{3})-(\d{2,4})$/i);
  if (m2) {
    const yr = m2[3].length === 2 ? "20" + m2[3] : m2[3];
    return `${yr}-${MONTHS[m2[2].toUpperCase()] || "01"}-${m2[1].padStart(2,"0")}`;
  }
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[1].padStart(2,"0")}-${m3[2].padStart(2,"0")}`;
  return "";
}

// ── Hours → working days helper ───────────────────────────────────────────
// P6 XER stores _drtn_hr_cnt fields as HOURS (e.g. 136 = 17 days × 8h).
// 1 working day = 8 hours per P6 default calendar.
function hrsTodays(raw) {
  if (raw == null || raw === "") return undefined;
  // Handle comma-as-decimal-separator locales (e.g. "136,00")
  const n = parseFloat(String(raw).replace(",", "."));
  if (isNaN(n)) return undefined;
  return Math.round(n / 8);
}

// ── Build a task object from a raw XER TASK row ───────────────────────────
function buildTask(t, predLinks, originalTaskData) {
  const start = parseP6Date(t.act_start_date || t.early_start_date || t.target_start_date || t.restart_date || "");
  const end   = parseP6Date(t.act_end_date   || t.early_end_date   || t.target_end_date   || t.reend_date   || "");

  let taskStart = start, taskEnd = end;
  if (t.task_type === "TT_Mile" || t.task_type === "TT_StartMile") {
    taskStart = start || end; taskEnd = "";
  } else if (t.task_type === "TT_FinMile") {
    taskEnd = end || start; taskStart = "";
  }

  const pls = predLinks[t.task_code] || [];
  // Legacy single link (first relationship) for backward compat
  const pl0 = pls[0];
  const linkType = pl0?.link || undefined;
  const linkSuccCode = pl0?.succCode || undefined;
  const linkLag = pl0?.link != null ? (pl0.lag ?? 0) : undefined;
  // All relationships for display and rendering
  const links = pls.map(r => ({ succCode: r.succCode, type: r.link, lag: r.lag }));

  // pct: P6 stores phys_complete_pct as 0–100 integer.
  // complete_pct_type determines which field to use:
  //   CP_Phys → phys_complete_pct (physical)
  //   CP_Drtn → derived: (1 - remain/target) * 100
  let pct;
  const pctType = (t.complete_pct_type || "").trim();
  const statusCode = (t.status_code || "").trim();

  if (pctType === "CP_Phys" || pctType === "CP_Units") {
    // XER stores as 0–100 integer, handle comma decimal separator
    const v = parseFloat(String(t.phys_complete_pct || "").replace(",", "."));
    if (!isNaN(v)) pct = Math.round(v);
  } else if (pctType === "CP_Drtn") {
    if (statusCode === "TK_Complete") {
      pct = 100;
    } else if (statusCode === "TK_NotStart") {
      pct = 0;
    } else {
      const remain = parseFloat(t.remain_drtn_hr_cnt || "");
      const target = parseFloat(t.target_drtn_hr_cnt || "");
      if (!isNaN(remain) && !isNaN(target) && target > 0 && remain <= target) {
        pct = Math.round((1 - remain / target) * 100);
      }
    }
  } else {
    // Fallback: try phys_complete_pct first, then sched_complete_pct
    const raw = t.phys_complete_pct || t.sched_complete_pct || "";
    const v = parseFloat(raw);
    if (!isNaN(v)) {
      // Some exports store as 0–1 fraction, others as 0–100 integer
      pct = v <= 1 && v > 0 ? Math.round(v * 100) : Math.round(v);
    }
  }

  const blStart = parseP6Date(t.primary_base_start_date || t.secondary_base_start_date || t.base_start_date || "");
  const blEnd   = parseP6Date(t.primary_base_end_date   || t.secondary_base_end_date   || t.base_end_date   || "");

  // ── Additional P6 fields extracted for display / round-trip ───────────────
  const extractDate = (val) => parseP6Date(val) || undefined;
  const extractHrs = (val) => {
    if (val == null || val === "") return undefined;
    const n = parseFloat(String(val).replace(",", "."));
    return isNaN(n) ? undefined : Math.round(n / 8);
  };
  const extractNum = (val) => {
    if (val == null || val === "") return undefined;
    const n = parseFloat(String(val).replace(",", "."));
    return isNaN(n) ? undefined : n;
  };
  const extractStr = (val) => val ? String(val).trim() : undefined;

  return {
    activityId:     t.task_code || "",
    activity:       t.task_name || "",
    start:          taskStart,
    end:            taskEnd,
    barType:        "baseline",
    baselineStart:  blStart || undefined,
    baselineFinish: blEnd   || undefined,
    startActual: (t.act_start_date && t.act_start_date.trim()) ? true : undefined,
    endActual:   (t.act_end_date   && t.act_end_date.trim())   ? true : undefined,
    linkType:     linkType,
    linkOffset:   linkLag,
    linkSuccCode: linkSuccCode,
    relType:      linkType,
    links:        links.length > 0 ? links : undefined,
    remainDur:   hrsTodays(t.remain_drtn_hr_cnt),
    float: (() => {
      const raw = t.total_float_hr_cnt;
      if (raw == null || raw === "") return undefined;
      const n = parseFloat(String(raw).replace(",", "."));
      return isNaN(n) ? undefined : Math.round(n / 8);
    })(),
    pct,
    // ── Additional P6 scheduling fields ────────────────────────────────────
    earlyStart:       extractDate(t.early_start_date),
    earlyEnd:         extractDate(t.early_end_date),
    lateStart:        extractDate(t.late_start_date),
    lateEnd:          extractDate(t.late_end_date),
    freeFloat:        extractHrs(t.free_float_hr_cnt),
    expectedFinish:   extractDate(t.expect_end_date),
    primaryResource:  extractStr(t.rsrc_id),
    durationType:     extractStr(t.duration_type),
    completePctType:  extractStr(t.complete_pct_type),
    statusCode:       extractStr(t.status_code),
    constraintType:   extractStr(t.cstr_type),
    constraintDate:   extractDate(t.cstr_date),
    constraintType2:  extractStr(t.cstr_type2),
    constraintDate2:  extractDate(t.cstr_date2),
    suspendDate:      extractDate(t.suspend_date),
    resumeDate:       extractDate(t.resume_date),
    priorityType:     extractStr(t.priority_type),
    locationId:       extractStr(t.location_id),
    estWt:            extractNum(t.est_wt),
    drivingPathFlag:  extractStr(t.driving_path_flag),
    lockPlanFlag:     extractStr(t.lock_plan_flag),
    autoComputeActFlag: extractStr(t.auto_compute_act_flag),
    actLaborUnits:    extractNum(t.act_work_qty),
    actNonlaborUnits: extractNum(t.act_equip_qty),
    remLaborUnits:    extractNum(t.remain_work_qty),
    remNonlaborUnits: extractNum(t.remain_equip_qty),
    planLaborUnits:   extractNum(t.target_work_qty),
    planNonlaborUnits: extractNum(t.target_equip_qty),
    reviewFinish:     extractDate(t.review_end_date),
    reviewStatus:     extractStr(t.review_type),
    externalEarlyStart: extractDate(t.external_early_start_date),
    externalLateFinish: extractDate(t.external_late_end_date),
    remEarlyStart:    extractDate(t.restart_date),
    remEarlyFinish:   extractDate(t.reend_date),
    remLateStart:     extractDate(t.rem_late_start_date),
    remLateFinish:    extractDate(t.rem_late_end_date),
    floatPath:        extractNum(t.float_path),
    floatPathOrder:   extractNum(t.float_path_order),
    p6Guid:           extractStr(t.guid),
    p6TaskId:         extractStr(t.task_id),
    targetDuration:   extractHrs(t.target_drtn_hr_cnt),
    showComparison: false,
    _originalXerData: originalTaskData[t.task_code] || {},
  };
}

// ── Main export ───────────────────────────────────────────────────────────
export function parseXER(text) {
  const tables = parseXerTables(text);

  // Debug: log first TASK row's actual field names and values so the user
  // can verify which fields are present in their XER file.
  const _dbgTask = (tables["TASK"] || [])[0];
  if (_dbgTask) {
    console.log("[parseXER] First TASK row fields:", Object.keys(_dbgTask));
    console.log("[parseXER] First TASK row sample values:", {
      task_code: _dbgTask.task_code,
      remain_drtn_hr_cnt: _dbgTask.remain_drtn_hr_cnt,
      total_float_hr_cnt: _dbgTask.total_float_hr_cnt,
      phys_complete_pct: _dbgTask.phys_complete_pct,
      complete_pct_type: _dbgTask.complete_pct_type,
      status_code: _dbgTask.status_code,
      target_drtn_hr_cnt: _dbgTask.target_drtn_hr_cnt,
    });
  }

  const taskRows  = tables["TASK"]     || [];
  const wbsRows   = tables["PROJWBS"]  || [];
  const projRows  = tables["PROJECT"]  || [];
  const predRows  = tables["TASKPRED"] || [];

  if (taskRows.length === 0) return null;

  // task_id → task_code lookup
  const taskIdToCode = {};
  for (const t of taskRows) taskIdToCode[t.task_id] = t.task_code;

  // Preserve ALL original XER fields for round-trip export
  const originalTaskData = {};
  for (const t of taskRows) originalTaskData[t.task_code] = { ...t };

  // Build ALL relationships: pred_task_code → [{ link, lag, succCode }]
  const predLinks = {};
  for (const p of predRows) {
    const predCode = taskIdToCode[p.pred_task_id];
    const succCode = taskIdToCode[p.task_id];
    if (!predCode || !succCode) continue;
    const linkType = P6_LINK_TYPE[p.pred_type];
    if (!linkType) continue;
    const lagDays = Math.round((parseFloat(p.lag_hr_cnt || "0") || 0) / 8);
    if (!predLinks[predCode]) predLinks[predCode] = [];
    predLinks[predCode].push({ link: linkType, lag: lagDays, succCode });
  }

  // WBS lookup (the raw row is kept so an XER → XER export can pass it through unchanged)
  const wbsMap = {};
  for (const w of wbsRows) {
    wbsMap[w.wbs_id] = {
      name: w.wbs_name || w.wbs_short_name || w.wbs_id,
      parentId: w.parent_wbs_id || null,
      raw: w,
    };
  }

  const wbsIds = new Set(wbsRows.map(w => w.wbs_id));
  const topLevelWbs = wbsRows.filter(w => !w.parent_wbs_id || !wbsIds.has(w.parent_wbs_id));

  const tasksByWbs = {};
  for (const t of taskRows) {
    if (!tasksByWbs[t.wbs_id]) tasksByWbs[t.wbs_id] = [];
    tasksByWbs[t.wbs_id].push(t);
  }

  // Flatten WBS tree recursively (sectionLevel = 1-based depth, used for WBS row colours)
  function flattenWbs(wbsId, level = 1) {
    const items = [];
    const name = wbsMap[wbsId]?.name || wbsId;
    items.push({
      isSection: true, sectionType: "blue", activity: name, showComparison: false, sectionLevel: level,
      // XER identity — lets an XER → XER export write the original PROJWBS row back untouched
      p6WbsId: wbsId,
      _originalWbsData: wbsMap[wbsId]?.raw || null,
    });
    for (const t of (tasksByWbs[wbsId] || [])) {
      items.push(buildTask(t, predLinks, originalTaskData));
    }
    for (const child of wbsRows.filter(w => w.parent_wbs_id === wbsId)) {
      items.push(...flattenWbs(child.wbs_id, level + 1));
    }
    return items;
  }

  const result = [];

  if (wbsRows.length > 0) {
    for (const w of topLevelWbs) result.push(...flattenWbs(w.wbs_id, 1));

    // Unassigned tasks (not under any WBS)
    const assigned = new Set(result.filter(r => r.activityId).map(r => r.activityId));
    const unassigned = taskRows.filter(t => !assigned.has(t.task_code));
    if (unassigned.length > 0) {
      result.push({ isSection: true, sectionType: "blue", activity: "Other Activities", showComparison: false, sectionLevel: 1 });
      for (const t of unassigned) result.push(buildTask(t, predLinks, originalTaskData));
    }
  } else {
    // No WBS — flat list under project name
    const projName = projRows[0]?.proj_short_name || projRows[0]?.proj_id || "Imported Activities";
    result.push({ isSection: true, sectionType: "blue", activity: projName, showComparison: false, sectionLevel: 1 });
    for (const t of taskRows) result.push(buildTask(t, predLinks, originalTaskData));
  }

  // WBS nodes that contain no activities are KEPT but tagged, so the "Hide Empty WBS
  // Rows" display setting can decide whether to show them (default: hidden).
  const tagged = result.map((r, i) => {
    if (!r.isSection) return r;
    const next = result[i + 1];
    return (next && !next.isSection) ? r : { ...r, emptyWbs: true };
  });

  return tagged.length > 0 ? tagged : null;
}